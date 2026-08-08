import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test, { afterEach } from "node:test";

import {
  resolveAiCooperativeCemSelectionSharedClaimPaths,
} from "../scripts/ai-cooperative-cem-selection-attempt.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
} from "../scripts/ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "../scripts/ai-cooperative-cem-selection-registration.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
} from "../scripts/ai-cooperative-cem-training-result.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  atomicAppendOnlySelectionWriteForTest,
  claimSharedAiCooperativeCemSelectionAttemptForTest,
} from "../scripts/ai-cooperative-cem-selection.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  mainAiCooperativeCemSelectionCli,
  parseAiCooperativeCemSelectionCliArguments,
  preflightAiCooperativeCemSelectionCli,
  runAiCooperativeCemSelectionCli,
  type AiCooperativeCemSelectionCliConfiguration,
} from "../scripts/run-ai-cooperative-cem-selection.ts";

const SOURCE_REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const temporaryRepositories: string[] = [];

function temporaryRepository(): string {
  const path = mkdtempSync(join(tmpdir(), "hstone-cem-selection-cli-"));
  mkdirSync(join(path, ".git"));
  temporaryRepositories.push(path);
  return path;
}

afterEach(() => {
  for (const path of temporaryRepositories.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

function validArguments(): string[] {
  return [
    "--run-registered-selection",
    AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
    "--protocol-sha256",
    AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    "--implementation-sha256",
    AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    "--training-result-sha256",
    AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    "--checkpoint-dir",
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
    "--output",
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  ];
}

function validConfiguration(
  repository: string,
): AiCooperativeCemSelectionCliConfiguration {
  return parseAiCooperativeCemSelectionCliArguments(
    validArguments(),
    repository,
  );
}

test("cooperative CEM selection CLI has no implicit, partial, duplicate, or resume capability", () => {
  const repository = temporaryRepository();
  assert.throws(
    () => parseAiCooperativeCemSelectionCliArguments([], repository),
    /incomplete cooperative CEM selection capability/,
  );
  assert.throws(
    () =>
      parseAiCooperativeCemSelectionCliArguments(
        validArguments().slice(0, -2),
        repository,
      ),
    /incomplete cooperative CEM selection capability/,
  );
  assert.throws(
    () =>
      parseAiCooperativeCemSelectionCliArguments(
        [...validArguments(), "--resume-search-only"],
        repository,
      ),
    /unknown cooperative CEM selection argument --resume-search-only/,
  );
  assert.throws(
    () =>
      parseAiCooperativeCemSelectionCliArguments(
        [...validArguments(), "--output", "duplicate.json"],
        repository,
      ),
    /--output may only be supplied once/,
  );
  for (const customDirectory of ["custom-a", "custom-b"]) {
    const customArguments = validArguments();
    customArguments[9] =
      `outputs/ai-cooperative-cem-selection/${customDirectory}/checkpoints`;
    customArguments[11] =
      `outputs/ai-cooperative-cem-selection/${customDirectory}/artifact.json`;
    assert.throws(
      () =>
        parseAiCooperativeCemSelectionCliArguments(
          customArguments,
          repository,
        ),
      /must claim the one fixed reservation directory and artifact/,
    );
  }
});

test("cooperative CEM selection CLI requires all four exact authorization values", () => {
  const repository = temporaryRepository();
  const mismatches: readonly [number, RegExp][] = [
    [1, /confirmation mismatch/],
    [3, /protocol hash mismatch/],
    [5, /implementation hash mismatch/],
    [7, /training result hash mismatch/],
  ];
  for (const [index, expected] of mismatches) {
    const argumentsWithMismatch = validArguments();
    argumentsWithMismatch[index] = "f".repeat(64);
    assert.throws(
      () =>
        parseAiCooperativeCemSelectionCliArguments(
          argumentsWithMismatch,
          repository,
        ),
      expected,
    );
  }

  const configuration = validConfiguration(repository);
  assert.equal(
    configuration.checkpointDirectory,
    resolve(
      repository,
      AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
    ),
  );
  assert.equal(
    configuration.outputPath,
    resolve(
      repository,
      AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
    ),
  );
});

test("retired selection preflight rejects before reading authorization or mutating output", () => {
  const repository = temporaryRepository();
  const configuration = validConfiguration(repository);
  const unreadableConfiguration = new Proxy(configuration, {
    get() {
      throw new Error("completed preflight must not read configuration");
    },
  });
  assert.throws(
    () =>
      preflightAiCooperativeCemSelectionCli(
        unreadableConfiguration,
        repository,
        join(repository, "missing-evidence"),
      ),
    (error: unknown) =>
      error instanceof Error &&
      error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  );
  assert.equal(existsSync(join(repository, "outputs")), false);
});

test("retired selection CLI run rejects full historical authorization before report or output", () => {
  const repository = temporaryRepository();
  const configuration = validConfiguration(repository);
  let reportCalls = 0;
  assert.throws(
    () =>
      runAiCooperativeCemSelectionCli(configuration, () => {
        reportCalls += 1;
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  );
  assert.equal(reportCalls, 0);
  assert.equal(existsSync(join(repository, "outputs")), false);
});

test("retired selection main rejects no arguments before stdout or artifact mutation", () => {
  const outputPath = resolve(
    SOURCE_REPOSITORY_ROOT,
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  );
  const outputBefore = existsSync(outputPath)
    ? readFileSync(outputPath)
    : null;
  assert.throws(
    () => mainAiCooperativeCemSelectionCli([]),
    (error: unknown) =>
      error instanceof Error &&
      error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  );

  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      fileURLToPath(
        new URL("../scripts/run-ai-cooperative-cem-selection.ts", import.meta.url),
      ),
    ],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 1);
  assert.equal(child.stdout, "");
  assert.match(child.stderr, /permanently completed and gate-rejected; artifact d3cfa219/);
  assert.deepEqual(
    existsSync(outputPath) ? readFileSync(outputPath) : null,
    outputBefore,
  );
});

test("two linked worktrees share one durable Git-common selection claim", () => {
  const administrationRoot = temporaryRepository();
  const commonGitDirectory = join(administrationRoot, ".git");
  const firstWorktree = temporaryRepository();
  const secondWorktree = temporaryRepository();

  for (const [worktree, name] of [
    [firstWorktree, "first"],
    [secondWorktree, "second"],
  ] as const) {
    rmSync(join(worktree, ".git"), { recursive: true });
    const gitDirectory = join(commonGitDirectory, "worktrees", name);
    mkdirSync(gitDirectory, { recursive: true });
    writeFileSync(join(gitDirectory, "commondir"), "../..\n", "utf8");
    writeFileSync(
      join(worktree, ".git"),
      `gitdir: ${gitDirectory}\n`,
      "utf8",
    );
  }

  const firstPaths = resolveAiCooperativeCemSelectionSharedClaimPaths(
    firstWorktree,
  );
  const secondPaths = resolveAiCooperativeCemSelectionSharedClaimPaths(
    secondWorktree,
  );
  assert.equal(firstPaths.commonGitDirectory, secondPaths.commonGitDirectory);
  assert.equal(firstPaths.markerPath, secondPaths.markerPath);

  assert.equal(
    claimSharedAiCooperativeCemSelectionAttemptForTest(firstWorktree),
    firstPaths.markerPath,
  );
  assert.equal(existsSync(firstPaths.markerPath), true);
  assert.throws(
    () =>
      claimSharedAiCooperativeCemSelectionAttemptForTest(secondWorktree),
    /shared Git claim already exists/,
  );
  assert.equal(existsSync(join(secondWorktree, "outputs")), false);
});

test("test-only shared claim helper rejects the production and sibling-worktree common directory", () => {
  const productionPaths =
    resolveAiCooperativeCemSelectionSharedClaimPaths(SOURCE_REPOSITORY_ROOT);
  const markerBefore = existsSync(productionPaths.markerPath)
    ? readFileSync(productionPaths.markerPath, "utf8")
    : null;

  assert.throws(
    () =>
      claimSharedAiCooperativeCemSelectionAttemptForTest(
        SOURCE_REPOSITORY_ROOT,
      ),
    /must not use the production or sibling-worktree Git common directory/,
  );
  assert.equal(
    existsSync(productionPaths.markerPath)
      ? readFileSync(productionPaths.markerPath, "utf8")
      : null,
    markerBefore,
  );
});

test("test-only append writer cannot target the registered production artifact", () => {
  const productionOutput = resolve(
    SOURCE_REPOSITORY_ROOT,
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  );
  const outputBefore = existsSync(productionOutput)
    ? readFileSync(productionOutput, "utf8")
    : null;

  assert.throws(
    () =>
      atomicAppendOnlySelectionWriteForTest(
        productionOutput,
        "must-not-publish\n",
      ),
    /must not target production or sibling-worktree state/,
  );
  assert.equal(
    existsSync(productionOutput)
      ? readFileSync(productionOutput, "utf8")
      : null,
    outputBefore,
  );
});

test("selection append-once writer rejects even identical existing content", () => {
  const directory = temporaryRepository();
  const target = join(directory, "selection-checkpoint.json");

  assert.equal(
    atomicAppendOnlySelectionWriteForTest(target, "first\n"),
    "created",
  );
  assert.equal(readFileSync(target, "utf8"), "first\n");
  assert.throws(
    () => atomicAppendOnlySelectionWriteForTest(target, "first\n"),
    /refusing to overwrite/,
  );
  assert.throws(
    () => atomicAppendOnlySelectionWriteForTest(target, "different\n"),
    /refusing to overwrite/,
  );
  assert.equal(readFileSync(target, "utf8"), "first\n");
  assert.deepEqual(readdirSync(directory).sort(), [
    ".git",
    "selection-checkpoint.json",
  ]);
});

test("selection append-once writer keeps publication successful when temp cleanup fails", () => {
  const directory = temporaryRepository();
  const target = join(directory, "artifact.json");
  const reports: string[] = [];
  const disposition = atomicAppendOnlySelectionWriteForTest(
    target,
    "published\n",
    (message) => {
      reports.push(message);
      throw new Error("simulated diagnostic sink failure");
    },
    {
      unlinkPublishedTemporaryFile() {
        throw new Error("simulated Windows scanner lock");
      },
    },
  );

  assert.equal(disposition, "created");
  assert.equal(readFileSync(target, "utf8"), "published\n");
  assert.ok(readdirSync(directory).some((name) => name.endsWith(".tmp")));
  assert.match(reports.join("\n"), /left stale temporary file/);
});

test("selection append-once writer leaves no completed JSON when publication fails", () => {
  const directory = temporaryRepository();
  const target = join(directory, "selection-checkpoint.json");

  assert.throws(
    () =>
      atomicAppendOnlySelectionWriteForTest(
        target,
        "not-published\n",
        () => undefined,
        {
          publishTemporaryFile() {
            throw new Error("simulated hard-link failure");
          },
        },
      ),
    /simulated hard-link failure/,
  );
  assert.equal(existsSync(target), false);
  assert.deepEqual(readdirSync(directory), [".git"]);
});

test("package selection command contains no registered authorization values", () => {
  const packageJson = JSON.parse(
    readFileSync(join(SOURCE_REPOSITORY_ROOT, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  const command = packageJson.scripts?.["benchmark:ai-cooperative-cem-selection"];
  assert.equal(
    command,
    "node --experimental-strip-types scripts/run-ai-cooperative-cem-selection.ts",
  );
  assert.doesNotMatch(command ?? "", /run-registered|sha256|93_100/);
});
