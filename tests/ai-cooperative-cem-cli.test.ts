import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { afterEach } from "node:test";

import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
} from "../scripts/ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
} from "../scripts/ai-cooperative-cem-registration.ts";
import { createAiCooperativeCemRegisteredRunMarker } from "../scripts/ai-cooperative-cem.ts";
import {
  atomicAppendOnlyWrite,
  parseAiCooperativeCemCliArguments,
  preflightAiCooperativeCemCli,
  runAiCooperativeCemCli,
} from "../scripts/run-ai-cooperative-cem.ts";

const temporaryRepositories: string[] = [];

function temporaryRepository(): string {
  const path = mkdtempSync(join(tmpdir(), "hstone-cem-cli-"));
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
    "--run-registered-training",
    AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
    "--protocol-sha256",
    AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    "--implementation-sha256",
    AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    "--checkpoint-dir",
    "outputs/ai-cooperative-cem/test-run/checkpoints",
    "--output",
    "outputs/ai-cooperative-cem/test-run/artifact.json",
  ];
}

function writeRegisteredRunMarker(checkpointDirectory: string): void {
  writeFileSync(
    join(checkpointDirectory, "run-attempt.json"),
    `${JSON.stringify(createAiCooperativeCemRegisteredRunMarker())}\n`,
    "utf8",
  );
}

test("cooperative CEM CLI has no implicit or partial registered capability", () => {
  const repository = temporaryRepository();
  assert.throws(
    () => parseAiCooperativeCemCliArguments([], repository),
    /incomplete cooperative CEM capability/,
  );
  assert.throws(
    () =>
      parseAiCooperativeCemCliArguments(
        [...validArguments(), "--unexpected"],
        repository,
      ),
    /unknown cooperative CEM argument/,
  );
  assert.throws(
    () =>
      parseAiCooperativeCemCliArguments(
        [...validArguments(), "--output", "duplicate.json"],
        repository,
      ),
    /--output may only be supplied once/,
  );
  const wrongConfirmation = validArguments();
  wrongConfirmation[1] = "run-something-else";
  assert.throws(
    () => parseAiCooperativeCemCliArguments(wrongConfirmation, repository),
    /confirmation mismatch/,
  );
  const wrongImplementation = validArguments();
  wrongImplementation[5] = "f".repeat(64);
  assert.throws(
    () => parseAiCooperativeCemCliArguments(wrongImplementation, repository),
    /implementation hash mismatch/,
  );
});

test("completed cooperative CEM CLI stops before preflight creates directories", () => {
  const repository = temporaryRepository();
  const configuration = parseAiCooperativeCemCliArguments(
    validArguments(),
    repository,
  );
  let reportCalls = 0;

  assert.throws(
    () =>
      runAiCooperativeCemCli(configuration, repository, () => {
        reportCalls += 1;
      }),
    /training is permanently completed by result/,
  );
  assert.equal(reportCalls, 0);
  assert.equal(existsSync(join(repository, "outputs")), false);
});

test("cooperative CEM CLI preflight is append-only and resume is explicit", () => {
  const repository = temporaryRepository();
  const configuration = parseAiCooperativeCemCliArguments(
    validArguments(),
    repository,
  );
  const fresh = preflightAiCooperativeCemCli(configuration, repository);
  assert.equal(fresh.checkpoints.length, 0);
  assert.equal(fresh.registeredRunMarker, null);
  assert.equal(fresh.staleTemporaryFiles.length, 0);

  assert.throws(
    () =>
      preflightAiCooperativeCemCli(
        { ...configuration, resumeSearchOnly: true },
        repository,
      ),
    /requires an existing run-attempt marker/,
  );

  writeRegisteredRunMarker(fresh.checkpointDirectory);
  assert.throws(
    () => preflightAiCooperativeCemCli(configuration, repository),
    /existing run-attempt marker requires.*--resume-search-only/,
  );
  const resumed = preflightAiCooperativeCemCli(
    { ...configuration, resumeSearchOnly: true },
    repository,
  );
  assert.equal(resumed.checkpoints.length, 0);
  assert.equal(
    resumed.registeredRunMarker?.markerHash,
    createAiCooperativeCemRegisteredRunMarker().markerHash,
  );

  writeFileSync(configuration.outputPath, "occupied\n", "utf8");
  assert.throws(
    () => preflightAiCooperativeCemCli(configuration, repository),
    /output already exists/,
  );
});

test("cooperative CEM CLI rejects a malformed run marker before any resume", () => {
  const repository = temporaryRepository();
  const configuration = parseAiCooperativeCemCliArguments(
    [...validArguments(), "--resume-search-only"],
    repository,
  );
  mkdirSync(configuration.checkpointDirectory, { recursive: true });
  writeFileSync(
    join(configuration.checkpointDirectory, "run-attempt.json"),
    "{}\n",
    "utf8",
  );

  assert.throws(
    () => preflightAiCooperativeCemCli(configuration, repository),
    /registeredRunMarker\.markerHash/,
  );
});

test("cooperative CEM CLI rejects checkpoint gaps before parsing evidence", () => {
  const repository = temporaryRepository();
  const configuration = parseAiCooperativeCemCliArguments(
    [...validArguments(), "--resume-search-only"],
    repository,
  );
  mkdirSync(configuration.checkpointDirectory, { recursive: true });
  writeFileSync(
    join(configuration.checkpointDirectory, "candidate-001.json"),
    "{}\n",
    "utf8",
  );
  assert.throws(
    () => preflightAiCooperativeCemCli(configuration, repository),
    /contiguous prefix; expected candidate-000.json/,
  );
});

test("cooperative CEM CLI rejects a junction before creating descendants through it", () => {
  const repository = temporaryRepository();
  const outside = temporaryRepository();
  const outputs = join(repository, "outputs");
  mkdirSync(outputs);
  symlinkSync(
    outside,
    join(outputs, "ai-cooperative-cem"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const configuration = parseAiCooperativeCemCliArguments(
    validArguments(),
    repository,
  );

  assert.throws(
    () => preflightAiCooperativeCemCli(configuration, repository),
    /reparse point or non-directory/,
  );
  assert.equal(existsSync(join(outside, "test-run")), false);
});

test("atomic append-only writer is idempotent but never overwrites conflicts", () => {
  const directory = temporaryRepository();
  const target = join(directory, "candidate-000.json");

  assert.equal(atomicAppendOnlyWrite(target, "first\n", true), "created");
  assert.equal(readFileSync(target, "utf8"), "first\n");
  assert.equal(
    atomicAppendOnlyWrite(target, "first\n", true),
    "identical-existing",
  );
  assert.throws(
    () => atomicAppendOnlyWrite(target, "different\n", true),
    /refusing to overwrite/,
  );
  assert.equal(readFileSync(target, "utf8"), "first\n");
  assert.deepEqual(readdirSync(directory), ["candidate-000.json"]);
});

test("atomic append-only writer keeps a published target successful when temp cleanup fails", () => {
  const directory = temporaryRepository();
  const target = join(directory, "artifact.json");
  const reports: string[] = [];
  const disposition = atomicAppendOnlyWrite(
    target,
    "published\n",
    false,
    (message) => reports.push(message),
    {
      unlinkPublishedTemporaryFile() {
        throw new Error("simulated Windows scanner lock");
      },
    },
  );

  assert.equal(disposition, "created");
  assert.equal(readFileSync(target, "utf8"), "published\n");
  assert.ok(
    readdirSync(directory).some((name) => name.endsWith(".tmp")),
  );
  assert.match(reports.join("\n"), /left stale temporary file/);
});

test("atomic append-only writer leaves no completed JSON when publication fails", () => {
  const directory = temporaryRepository();
  const target = join(directory, "candidate-000.json");

  assert.throws(
    () =>
      atomicAppendOnlyWrite(
        target,
        "not-published\n",
        false,
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
  assert.deepEqual(readdirSync(directory), []);
});
