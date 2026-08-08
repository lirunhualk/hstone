import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
} from "./ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
} from "./ai-cooperative-cem-registration.ts";
import {
  assertAiCooperativeCemTrainingNotCompleted,
  assertAiCooperativeCemRegisteredCheckpointPrefix,
  assertValidAiCooperativeCemRegisteredRunMarker,
  assertValidAiCooperativeCemTrainingArtifact,
  runAiCooperativeCemTraining,
  type AiCooperativeCemRegisteredRunMarker,
  type AiCooperativeCemRegisteredSearchCheckpoint,
  type AiCooperativeCemTrainingArtifact,
} from "./ai-cooperative-cem.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT_NAMESPACE = join("outputs", "ai-cooperative-cem");
const CHECKPOINT_FILE_PATTERN = /^candidate-(\d{3})\.json$/;
const RUN_MARKER_FILE_NAME = "run-attempt.json";

export const AI_COOPERATIVE_CEM_CLI_USAGE = [
  "Registered cooperative CEM training requires every explicit capability:",
  "  --run-registered-training run-registered-cooperative-cem-power-level-v1",
  "  --protocol-sha256 <registered protocol SHA-256>",
  "  --implementation-sha256 <registered implementation SHA-256>",
  "  --checkpoint-dir <path under outputs/ai-cooperative-cem>",
  "  --output <new JSON path under outputs/ai-cooperative-cem>",
  "  [--resume-search-only]",
].join("\n");

export interface AiCooperativeCemCliConfiguration {
  readonly confirmation: typeof AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256;
  readonly checkpointDirectory: string;
  readonly outputPath: string;
  readonly resumeSearchOnly: boolean;
}

export interface AiCooperativeCemCliPreflight {
  readonly checkpointDirectory: string;
  readonly outputPath: string;
  readonly registeredRunMarker: AiCooperativeCemRegisteredRunMarker | null;
  readonly checkpoints: readonly AiCooperativeCemRegisteredSearchCheckpoint[];
  readonly staleTemporaryFiles: readonly string[];
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPathInside(parent: string, child: string): boolean {
  const childRelative = relative(parent, child);
  return (
    childRelative.length > 0 &&
    childRelative !== ".." &&
    !childRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(childRelative)
  );
}

function isPathSameOrInside(parent: string, child: string): boolean {
  return parent === child || isPathInside(parent, child);
}

/**
 * Creates one directory segment at a time, after verifying that the previous
 * segment still resolves beneath the trusted parent. Existing symlinks and
 * junctions are rejected before any descendant is created through them.
 */
function ensureDirectoryTreeWithin(
  trustedParent: string,
  targetDirectory: string,
): string {
  const parentPath = resolve(trustedParent);
  const targetPath = resolve(targetDirectory);
  const relativeTarget = relative(parentPath, targetPath);
  if (
    relativeTarget === ".." ||
    relativeTarget.startsWith(`..${sep}`) ||
    isAbsolute(relativeTarget)
  ) {
    throw new RangeError("directory target escapes its trusted parent");
  }

  const parentRealPath = realpathSync.native(parentPath);
  if (relativeTarget.length === 0) return parentRealPath;

  let cursor = parentPath;
  for (const segment of relativeTarget.split(sep)) {
    cursor = join(cursor, segment);
    if (existsSync(cursor)) {
      const entry = lstatSync(cursor);
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        throw new RangeError(
          `directory path contains a reparse point or non-directory: ${cursor}`,
        );
      }
    } else {
      mkdirSync(cursor);
    }
    const cursorRealPath = realpathSync.native(cursor);
    if (!isPathSameOrInside(parentRealPath, cursorRealPath)) {
      throw new RangeError("directory path escapes its trusted parent");
    }
  }
  return realpathSync.native(targetPath);
}

function requireValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new TypeError(`${flag} requires one value`);
  }
  return value;
}

export function parseAiCooperativeCemCliArguments(
  argv: readonly string[],
  workingDirectory = process.cwd(),
): AiCooperativeCemCliConfiguration {
  const values = new Map<string, string>();
  let resumeSearchOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--resume-search-only") {
      if (resumeSearchOnly) {
        throw new TypeError("--resume-search-only may only be supplied once");
      }
      resumeSearchOnly = true;
      continue;
    }
    if (
      flag !== "--run-registered-training" &&
      flag !== "--protocol-sha256" &&
      flag !== "--implementation-sha256" &&
      flag !== "--checkpoint-dir" &&
      flag !== "--output"
    ) {
      throw new TypeError(`unknown cooperative CEM argument ${String(flag)}`);
    }
    if (values.has(flag)) {
      throw new TypeError(`${flag} may only be supplied once`);
    }
    values.set(flag, requireValue(argv, index, flag));
    index += 1;
  }

  const confirmation = values.get("--run-registered-training");
  const protocolSha256 = values.get("--protocol-sha256");
  const implementationSha256 = values.get("--implementation-sha256");
  const checkpointDirectory = values.get("--checkpoint-dir");
  const outputPath = values.get("--output");
  if (
    confirmation === undefined ||
    protocolSha256 === undefined ||
    implementationSha256 === undefined ||
    checkpointDirectory === undefined ||
    outputPath === undefined
  ) {
    throw new TypeError(`incomplete cooperative CEM capability\n${AI_COOPERATIVE_CEM_CLI_USAGE}`);
  }
  if (confirmation !== AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION) {
    throw new TypeError("registered cooperative CEM confirmation mismatch");
  }
  if (protocolSha256 !== AI_COOPERATIVE_CEM_PROTOCOL_SHA256) {
    throw new TypeError("registered cooperative CEM protocol hash mismatch");
  }
  if (implementationSha256 !== AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256) {
    throw new TypeError("registered cooperative CEM implementation hash mismatch");
  }

  return Object.freeze({
    confirmation,
    protocolSha256,
    implementationSha256,
    checkpointDirectory: resolve(workingDirectory, checkpointDirectory),
    outputPath: resolve(workingDirectory, outputPath),
    resumeSearchOnly,
  });
}

function checkpointFileName(sequenceIndex: number): string {
  return `candidate-${String(sequenceIndex).padStart(3, "0")}.json`;
}

function readCheckpointFile(path: string): AiCooperativeCemRegisteredSearchCheckpoint {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new TypeError(
      `cannot parse cooperative CEM checkpoint ${basename(path)}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parsed as AiCooperativeCemRegisteredSearchCheckpoint;
}

function readRegisteredRunMarker(
  path: string,
): AiCooperativeCemRegisteredRunMarker {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new TypeError(
      `cannot parse cooperative CEM run marker: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const marker = parsed as AiCooperativeCemRegisteredRunMarker;
  assertValidAiCooperativeCemRegisteredRunMarker(marker);
  return marker;
}

export function preflightAiCooperativeCemCli(
  configuration: AiCooperativeCemCliConfiguration,
  repositoryRoot = REPOSITORY_ROOT,
): AiCooperativeCemCliPreflight {
  const resolvedRepositoryRoot = resolve(repositoryRoot);
  const allowedRoot = resolve(resolvedRepositoryRoot, OUTPUT_NAMESPACE);
  if (
    !isPathInside(allowedRoot, configuration.checkpointDirectory) ||
    !isPathInside(allowedRoot, configuration.outputPath) ||
    isPathInside(configuration.checkpointDirectory, configuration.outputPath)
  ) {
    throw new RangeError(
      "checkpoint and output paths must be separate descendants of outputs/ai-cooperative-cem",
    );
  }

  const repositoryRealPath = realpathSync.native(resolvedRepositoryRoot);
  const allowedRealPath = ensureDirectoryTreeWithin(
    resolvedRepositoryRoot,
    allowedRoot,
  );
  if (!isPathInside(repositoryRealPath, allowedRealPath)) {
    throw new RangeError("cooperative CEM output namespace escapes the repository");
  }
  const checkpointRelativePath = relative(
    allowedRoot,
    configuration.checkpointDirectory,
  );
  const outputRelativePath = relative(allowedRoot, configuration.outputPath);
  const checkpointRealPath = ensureDirectoryTreeWithin(
    allowedRealPath,
    resolve(allowedRealPath, checkpointRelativePath),
  );
  const outputParentRealPath = ensureDirectoryTreeWithin(
    allowedRealPath,
    dirname(resolve(allowedRealPath, outputRelativePath)),
  );
  const outputRealPath = resolve(
    outputParentRealPath,
    basename(configuration.outputPath),
  );
  if (
    !isPathInside(allowedRealPath, checkpointRealPath) ||
    !isPathInside(allowedRealPath, outputRealPath) ||
    isPathInside(checkpointRealPath, outputRealPath)
  ) {
    throw new RangeError("resolved cooperative CEM paths escape their namespace");
  }
  if (existsSync(outputRealPath)) {
    throw new Error("cooperative CEM output already exists and will not be overwritten");
  }

  const checkpointNames: string[] = [];
  const staleTemporaryFiles: string[] = [];
  let hasRegisteredRunMarker = false;
  for (const entry of readdirSync(checkpointRealPath, { withFileTypes: true })) {
    if (entry.isFile() && CHECKPOINT_FILE_PATTERN.test(entry.name)) {
      checkpointNames.push(entry.name);
    } else if (entry.isFile() && entry.name === RUN_MARKER_FILE_NAME) {
      hasRegisteredRunMarker = true;
    } else if (entry.isFile() && entry.name.endsWith(".tmp")) {
      staleTemporaryFiles.push(entry.name);
    } else {
      throw new TypeError(
        `unexpected checkpoint directory entry ${entry.name}`,
      );
    }
  }
  checkpointNames.sort(compareAscii);
  staleTemporaryFiles.sort(compareAscii);
  const checkpoints: AiCooperativeCemRegisteredSearchCheckpoint[] = [];
  for (let index = 0; index < checkpointNames.length; index += 1) {
    const expectedName = checkpointFileName(index);
    if (checkpointNames[index] !== expectedName) {
      throw new TypeError(
        `checkpoint files must be a contiguous prefix; expected ${expectedName}`,
      );
    }
    checkpoints.push(
      readCheckpointFile(join(checkpointRealPath, checkpointNames[index])),
    );
  }
  assertAiCooperativeCemRegisteredCheckpointPrefix(checkpoints);
  const registeredRunMarker = hasRegisteredRunMarker
    ? readRegisteredRunMarker(join(checkpointRealPath, RUN_MARKER_FILE_NAME))
    : null;
  if (checkpoints.length !== 0 && registeredRunMarker === null) {
    throw new TypeError(
      "registered checkpoints without a run-attempt marker are invalid",
    );
  }
  if (configuration.resumeSearchOnly && registeredRunMarker === null) {
    throw new TypeError(
      "--resume-search-only requires an existing run-attempt marker",
    );
  }
  if (!configuration.resumeSearchOnly && registeredRunMarker !== null) {
    throw new TypeError(
      "an existing run-attempt marker requires the explicit --resume-search-only flag",
    );
  }
  return Object.freeze({
    checkpointDirectory: checkpointRealPath,
    outputPath: outputRealPath,
    registeredRunMarker,
    checkpoints: Object.freeze(checkpoints),
    staleTemporaryFiles: Object.freeze(staleTemporaryFiles),
  });
}

function canonicalJsonLine(value: unknown): string {
  return `${canonicalAiPolicyEvolutionJson(value)}\n`;
}

export interface AiCooperativeCemAtomicWriteHooks {
  /** Optional publication primitive; production uses a same-directory hard link. */
  readonly publishTemporaryFile?: (
    temporaryPath: string,
    targetPath: string,
  ) => void;
  /** Test seam for the post-publication cleanup state; production omits it. */
  readonly unlinkPublishedTemporaryFile?: (temporaryPath: string) => void;
}

export type AiCooperativeCemAtomicWriteDisposition =
  | "created"
  | "identical-existing";

export function atomicAppendOnlyWrite(
  targetPath: string,
  content: string,
  allowIdenticalExisting: boolean,
  report: (message: string) => void = () => undefined,
  hooks: AiCooperativeCemAtomicWriteHooks = {},
): AiCooperativeCemAtomicWriteDisposition {
  if (existsSync(targetPath)) {
    if (allowIdenticalExisting && readFileSync(targetPath, "utf8") === content) {
      return "identical-existing";
    }
    throw new Error(`refusing to overwrite ${targetPath}`);
  }
  const temporaryPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  let published = false;
  try {
    descriptor = openSync(temporaryPath, "wx");
    writeFileSync(descriptor, content, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    (hooks.publishTemporaryFile ?? linkSync)(temporaryPath, targetPath);
    published = true;
    try {
      (hooks.unlinkPublishedTemporaryFile ?? unlinkSync)(temporaryPath);
    } catch (error) {
      report(
        `published ${basename(targetPath)} but left stale temporary file ${basename(temporaryPath)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return "created";
  } catch (error) {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (closeError) {
        report(
          `failed to close temporary file ${basename(temporaryPath)}: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
        );
      }
    }
    if (!published && existsSync(temporaryPath)) {
      try {
        unlinkSync(temporaryPath);
      } catch (cleanupError) {
        report(
          `left stale temporary file ${basename(temporaryPath)}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }
    if (
      allowIdenticalExisting &&
      existsSync(targetPath) &&
      readFileSync(targetPath, "utf8") === content
    ) {
      return "identical-existing";
    }
    throw error;
  }
}

export function runAiCooperativeCemCli(
  configuration: AiCooperativeCemCliConfiguration,
  repositoryRoot = REPOSITORY_ROOT,
  report: (message: string) => void = () => undefined,
): AiCooperativeCemTrainingArtifact {
  assertAiCooperativeCemTrainingNotCompleted();
  const preflight = preflightAiCooperativeCemCli(
    configuration,
    repositoryRoot,
  );
  if (preflight.staleTemporaryFiles.length > 0) {
    report(
      `ignoring ${preflight.staleTemporaryFiles.length} incomplete .tmp checkpoint file(s)`,
    );
  }
  let nextCheckpointIndex = preflight.checkpoints.length;
  const artifact = runAiCooperativeCemTraining({
    registeredAuthorization: {
      confirmation: configuration.confirmation,
      protocolSha256: configuration.protocolSha256,
      implementationSha256: configuration.implementationSha256,
    },
    registeredResumeMode: configuration.resumeSearchOnly
      ? "search-only"
      : undefined,
    registeredSearchCheckpoints: preflight.checkpoints,
    onRegisteredRunStart(marker) {
      const disposition = atomicAppendOnlyWrite(
        join(preflight.checkpointDirectory, RUN_MARKER_FILE_NAME),
        canonicalJsonLine(marker),
        configuration.resumeSearchOnly,
        report,
      );
      if (
        configuration.resumeSearchOnly &&
        disposition !== "identical-existing"
      ) {
        throw new Error(
          "search-only resume lost its existing run-attempt marker",
        );
      }
      report(
        disposition === "created"
          ? "saved registered run-attempt marker before the first game"
          : "verified existing registered run-attempt marker for search-only resume",
      );
    },
    onRegisteredSearchCheckpoint(checkpoint) {
      if (checkpoint.sequenceIndex !== nextCheckpointIndex) {
        throw new TypeError(
          `checkpoint callback expected sequence ${nextCheckpointIndex}, received ${checkpoint.sequenceIndex}`,
        );
      }
      atomicAppendOnlyWrite(
        join(
          preflight.checkpointDirectory,
          checkpointFileName(checkpoint.sequenceIndex),
        ),
        canonicalJsonLine(checkpoint),
        true,
        report,
      );
      nextCheckpointIndex += 1;
      report(
        `saved checkpoint ${checkpoint.sequenceIndex + 1} for ${checkpoint.evaluation.candidateId}`,
      );
    },
  });
  assertValidAiCooperativeCemTrainingArtifact(artifact);
  if (nextCheckpointIndex !== artifact.candidateEvaluations.length) {
    throw new TypeError("final artifact and persisted checkpoint counts differ");
  }
  atomicAppendOnlyWrite(
    preflight.outputPath,
    canonicalJsonLine(artifact),
    false,
    report,
  );
  return artifact;
}

export function mainAiCooperativeCemCli(
  argv: readonly string[] = process.argv.slice(2),
): void {
  if (argv.length === 1 && argv[0] === "--help") {
    process.stdout.write(`${AI_COOPERATIVE_CEM_CLI_USAGE}\n`);
    return;
  }
  const configuration = parseAiCooperativeCemCliArguments(argv);
  const artifact = runAiCooperativeCemCli(
    configuration,
    REPOSITORY_ROOT,
    (message) => process.stderr.write(`${message}\n`),
  );
  process.stdout.write(
    `${canonicalAiPolicyEvolutionJson({
      artifactHash: artifact.artifactHash,
      output: configuration.outputPath,
      selectedCandidateId: artifact.selectedCandidateId,
      selectedCandidateFeasible: artifact.selectedCandidateFeasible,
      selectionScreenEligible: artifact.selectionScreenEligible,
      trainingEvidenceUsable: artifact.trainingEvidenceUsable,
    })}\n`,
  );
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && pathToFileURL(resolve(entry)).href === import.meta.url;
}

if (isDirectExecution()) {
  try {
    mainAiCooperativeCemCli();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
