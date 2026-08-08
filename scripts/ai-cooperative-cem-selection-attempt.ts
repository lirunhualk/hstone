import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
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

import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_SEEDS,
} from "./ai-cooperative-cem-selection-registration.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
} from "./ai-cooperative-cem-training-result.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";

const OUTPUT_NAMESPACE = join("outputs", "ai-cooperative-cem-selection");
const RUN_MARKER_FILE_NAME = "run-attempt.json";
const CHECKPOINT_FILE_NAME = "selection-checkpoint.json";
const SHARED_CLAIM_NAMESPACE = "codex-ai-seed-claims";
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const AI_COOPERATIVE_CEM_SELECTION_MARKER_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY =
  join(
    OUTPUT_NAMESPACE,
    AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
    "checkpoints",
  );
export const AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH = join(
  OUTPUT_NAMESPACE,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  "selection-artifact.json",
);

export interface AiCooperativeCemSelectionMarkerPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_SELECTION_MARKER_FORMAT_VERSION;
  readonly registrationId: typeof AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256;
  readonly trainingResultSha256: typeof AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256;
  readonly trainingArtifactHash: string;
  readonly trainingRunMarkerHash: string;
  readonly selectedCandidateId: string;
  readonly selectedGenome: typeof AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome;
  readonly selectedCandidateProfileHash: string;
  readonly selectedEvaluationRecordHash: string;
  readonly selectedRawResultSha256: string;
  readonly reservationId: typeof AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID;
  readonly reservationMode: typeof AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE;
  readonly benchmarkStartSeed: number;
  readonly benchmarkSeeds: number;
  readonly initialExecutionKind: "registered";
  readonly initialRunMode: "fresh";
}

export interface AiCooperativeCemSelectionMarker
  extends AiCooperativeCemSelectionMarkerPayload {
  readonly markerHash: string;
}

export interface AiCooperativeCemSelectionAttemptPaths {
  readonly checkpointDirectory: string;
  readonly markerPath: string;
  readonly checkpointPath: string;
  readonly outputPath: string;
}

export interface AiCooperativeCemSelectionSharedClaimPaths {
  readonly commonGitDirectory: string;
  readonly claimDirectory: string;
  readonly markerPath: string;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function withoutHash<T extends object>(value: T, property: string): object {
  const result = { ...value } as Record<string, unknown>;
  delete result[property];
  return result;
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(value))
    .digest("hex");
}

function markerPayload(): AiCooperativeCemSelectionMarkerPayload {
  const training = AI_COOPERATIVE_CEM_TRAINING_RESULT;
  return {
    formatVersion: AI_COOPERATIVE_CEM_SELECTION_MARKER_FORMAT_VERSION,
    registrationId: AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
    protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    implementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    trainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    trainingArtifactHash: training.evidence.artifactHash,
    trainingRunMarkerHash: training.evidence.registeredRunMarkerHash,
    selectedCandidateId: training.selected.candidateId,
    selectedGenome: training.selected.genome,
    selectedCandidateProfileHash: training.selected.candidateProfileHash,
    selectedEvaluationRecordHash: training.selected.evaluationRecordHash,
    selectedRawResultSha256: training.selected.rawResultSha256,
    reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
    reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
    benchmarkStartSeed: AI_COOPERATIVE_CEM_SELECTION_SEEDS.startSeed,
    benchmarkSeeds: AI_COOPERATIVE_CEM_SELECTION_SEEDS.seeds,
    initialExecutionKind: "registered",
    initialRunMode: "fresh",
  };
}

export function computeAiCooperativeCemSelectionMarkerHash(
  value: AiCooperativeCemSelectionMarkerPayload | AiCooperativeCemSelectionMarker,
): string {
  return hashCanonical(withoutHash(value, "markerHash"));
}

export function createAiCooperativeCemSelectionMarker(): AiCooperativeCemSelectionMarker {
  const payload = markerPayload();
  const marker = deepFreeze({
    ...payload,
    markerHash: computeAiCooperativeCemSelectionMarkerHash(payload),
  });
  assertValidAiCooperativeCemSelectionMarker(marker);
  return marker;
}

export function assertValidAiCooperativeCemSelectionMarker(
  value: AiCooperativeCemSelectionMarker,
): void {
  if (
    typeof value.markerHash !== "string" ||
    !SHA256_PATTERN.test(value.markerHash) ||
    canonicalAiPolicyEvolutionJson(withoutHash(value, "markerHash")) !==
      canonicalAiPolicyEvolutionJson(markerPayload()) ||
    computeAiCooperativeCemSelectionMarkerHash(value) !== value.markerHash
  ) {
    throw new TypeError("cooperative CEM selection marker mismatch");
  }
}

function isPathInside(parent: string, child: string): boolean {
  const childRelative = relative(parent, child);
  return (
    childRelative.length > 0 &&
    childRelative !== ".." &&
    !childRelative.startsWith(`..${sep}`) &&
    !isAbsolute(childRelative)
  );
}

function isPathSameOrInside(parent: string, child: string): boolean {
  return parent === child || isPathInside(parent, child);
}

function pathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

export function ensureAiCooperativeCemSelectionDirectoryTreeWithin(
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
    if (pathEntryExists(cursor)) {
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

function requireOrdinaryFile(path: string, label: string): void {
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new TypeError(`${label} must be an ordinary file`);
  }
}

function requireOrdinaryDirectory(path: string, label: string): string {
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new TypeError(`${label} must be an ordinary directory`);
  }
  return realpathSync.native(path);
}

function singlePathFile(path: string, label: string): string {
  requireOrdinaryFile(path, label);
  const value = readFileSync(path, "utf8").trim();
  if (value.length === 0 || /[\r\n]/.test(value)) {
    throw new TypeError(`${label} must contain one non-empty path`);
  }
  return value;
}

export function resolveAiCooperativeCemSelectionSharedClaimPaths(
  repositoryRoot: string,
): AiCooperativeCemSelectionSharedClaimPaths {
  const resolvedRepositoryRoot = realpathSync.native(resolve(repositoryRoot));
  const dotGitPath = join(resolvedRepositoryRoot, ".git");
  const dotGitEntry = lstatSync(dotGitPath);
  let commonGitDirectory: string;
  if (dotGitEntry.isSymbolicLink()) {
    throw new TypeError("repository .git entry must not be a reparse point");
  }
  if (dotGitEntry.isDirectory()) {
    commonGitDirectory = realpathSync.native(dotGitPath);
  } else if (dotGitEntry.isFile()) {
    const dotGitValue = readFileSync(dotGitPath, "utf8").trim();
    const match = /^gitdir:\s*(\S(?:.*\S)?)$/.exec(dotGitValue);
    if (match === null || /[\r\n]/.test(dotGitValue)) {
      throw new TypeError("linked worktree .git file is malformed");
    }
    const gitDirectory = requireOrdinaryDirectory(
      resolve(resolvedRepositoryRoot, match[1]),
      "linked worktree gitdir",
    );
    const commonDirectoryValue = singlePathFile(
      join(gitDirectory, "commondir"),
      "linked worktree commondir",
    );
    commonGitDirectory = requireOrdinaryDirectory(
      resolve(gitDirectory, commonDirectoryValue),
      "Git common directory",
    );
    const gitDirectoryRelative = relative(
      commonGitDirectory,
      gitDirectory,
    );
    if (
      !isPathInside(commonGitDirectory, gitDirectory) ||
      gitDirectoryRelative.split(sep)[0] !== "worktrees"
    ) {
      throw new RangeError(
        "linked worktree gitdir must be inside the common Git worktrees directory",
      );
    }
  } else {
    throw new TypeError("repository .git entry must be a file or directory");
  }

  const claimDirectory = resolve(
    commonGitDirectory,
    SHARED_CLAIM_NAMESPACE,
    AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  );
  const markerPath = resolve(claimDirectory, RUN_MARKER_FILE_NAME);
  if (
    !isPathInside(commonGitDirectory, claimDirectory) ||
    !isPathInside(commonGitDirectory, markerPath)
  ) {
    throw new RangeError("selection shared claim escapes the Git common directory");
  }
  for (const directory of [
    resolve(commonGitDirectory, SHARED_CLAIM_NAMESPACE),
    claimDirectory,
  ]) {
    if (!pathEntryExists(directory)) break;
    const entry = lstatSync(directory);
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new TypeError(
        "selection shared claim path contains a reparse point or non-directory",
      );
    }
    const realDirectory = realpathSync.native(directory);
    if (!isPathInside(commonGitDirectory, realDirectory)) {
      throw new RangeError(
        "selection shared claim path escapes the Git common directory",
      );
    }
  }
  return Object.freeze({
    commonGitDirectory,
    claimDirectory,
    markerPath,
  });
}

export function assertAiCooperativeCemSelectionSharedClaimAvailable(
  repositoryRoot: string,
): AiCooperativeCemSelectionSharedClaimPaths {
  const paths = resolveAiCooperativeCemSelectionSharedClaimPaths(repositoryRoot);
  if (pathEntryExists(paths.markerPath)) {
    throw new Error(
      "cooperative CEM selection shared Git claim already exists and forbids another 93_100 attempt",
    );
  }
  return paths;
}

export function prepareFreshAiCooperativeCemSelectionAttemptPaths(
  repositoryRoot: string,
): AiCooperativeCemSelectionAttemptPaths {
  const resolvedRepositoryRoot = resolve(repositoryRoot);
  const repositoryRealPath = realpathSync.native(resolvedRepositoryRoot);
  const allowedRoot = resolve(resolvedRepositoryRoot, OUTPUT_NAMESPACE);
  const allowedRealPath = ensureAiCooperativeCemSelectionDirectoryTreeWithin(
    resolvedRepositoryRoot,
    allowedRoot,
  );
  if (!isPathInside(repositoryRealPath, allowedRealPath)) {
    throw new RangeError(
      "cooperative CEM selection output namespace escapes the repository",
    );
  }

  const checkpointDirectory =
    ensureAiCooperativeCemSelectionDirectoryTreeWithin(
      allowedRealPath,
      resolve(
        resolvedRepositoryRoot,
        AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
      ),
    );
  const configuredOutputPath = resolve(
    resolvedRepositoryRoot,
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  );
  const outputParent = ensureAiCooperativeCemSelectionDirectoryTreeWithin(
    allowedRealPath,
    dirname(configuredOutputPath),
  );
  const outputPath = resolve(outputParent, basename(configuredOutputPath));
  if (
    !isPathInside(allowedRealPath, checkpointDirectory) ||
    !isPathInside(allowedRealPath, outputPath) ||
    isPathSameOrInside(checkpointDirectory, outputPath) ||
    isPathSameOrInside(outputPath, checkpointDirectory)
  ) {
    throw new RangeError(
      "resolved cooperative CEM selection paths escape their namespace",
    );
  }

  const markerPath = join(checkpointDirectory, RUN_MARKER_FILE_NAME);
  const checkpointPath = join(checkpointDirectory, CHECKPOINT_FILE_NAME);
  if (pathEntryExists(outputPath)) {
    throw new Error(
      "cooperative CEM selection output already exists and will not be overwritten",
    );
  }
  const entries = readdirSync(checkpointDirectory, { withFileTypes: true });
  if (entries.length > 0) {
    throw new Error(
      `fresh cooperative CEM selection checkpoint directory must be empty; found ${entries
        .map((entry) => entry.name)
        .sort()
        .join(", ")}`,
    );
  }
  if (pathEntryExists(markerPath) || pathEntryExists(checkpointPath)) {
    throw new Error(
      "fresh cooperative CEM selection marker or checkpoint already exists",
    );
  }
  return Object.freeze({
    checkpointDirectory,
    markerPath,
    checkpointPath,
    outputPath,
  });
}
