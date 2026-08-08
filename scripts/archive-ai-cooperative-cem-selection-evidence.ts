import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
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
import { gunzipSync, gzipSync } from "node:zlib";

import {
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  ensureAiCooperativeCemSelectionDirectoryTreeWithin,
  resolveAiCooperativeCemSelectionSharedClaimPaths,
  type AiCooperativeCemSelectionMarker,
} from "./ai-cooperative-cem-selection-attempt.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_HASH_ALGORITHM,
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SOURCE_MANIFEST,
  assertAiCooperativeCemSelectionImplementationPinned,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_EXPECTED_EVALUATOR_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  canonicalAiCooperativeCemSelectionProtocolJson,
  computeAiCooperativeCemSelectionProtocolSha256,
} from "./ai-cooperative-cem-selection-registration.ts";
import {
  assertAiCooperativeCemSelectionArtifactMatchesCheckpoint,
  assertValidAiCooperativeCemSelectionArtifact,
  assertValidAiCooperativeCemSelectionCheckpoint,
  assertValidAiCooperativeCemSelectionMarker,
  type AiCooperativeCemSelectionArtifact,
  type AiCooperativeCemSelectionCheckpoint,
} from "./ai-cooperative-cem-selection.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
  computeAiCooperativeCemTrainingResultSha256,
} from "./ai-cooperative-cem-training-result.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";
import { AI_POLICY_SUITE_EVALUATOR_HASH } from "./benchmark-ai-policy-suite.ts";

export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FORMAT_VERSION =
  1 as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_RELATIVE_DIRECTORY =
  "evidence/ai-cooperative-cem-selection/power-level-selection-v1-93100001" as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME =
  "selection-evidence-v1.json.gz" as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FILENAME =
  "manifest.json" as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_COMPRESSION =
  "gzip-level-9-mtime-0" as const;
export const AI_COOPERATIVE_CEM_SELECTION_HASH_ALGORITHM = "sha256" as const;

const LOCAL_MARKER_FILENAME = "run-attempt.json";
const CHECKPOINT_FILENAME = "selection-checkpoint.json";
const CANONICAL_JSON_FORMAT = "canonical-ai-policy-evolution-json-v1";
const EXPECTED_REJECTED_GATE = Object.freeze({
  accepted: false,
  reasons: Object.freeze([
    "powerLevel placement mean delta must be at most -0.1",
    "powerLevel placement confidence interval upper bound must be below 0",
    "powerLevel top-four confidence interval lower bound must be at least -0.02",
  ]),
});

interface CanonicalJsonFile<T> {
  readonly path: string;
  readonly bytes: Buffer;
  readonly value: T;
  readonly canonicalPayload: string;
}

interface ArchivedSource {
  readonly relativePath: string;
  readonly normalizedUtf8: string;
}

interface SourceManifestEntry {
  readonly relativePath: string;
  readonly normalizedUtf8Bytes: number;
  readonly normalizedUtf8Sha256: string;
}

interface CurrentSelectionEvidence {
  readonly sharedMarker: CanonicalJsonFile<AiCooperativeCemSelectionMarker>;
  readonly localMarker: CanonicalJsonFile<AiCooperativeCemSelectionMarker>;
  readonly checkpoint: CanonicalJsonFile<AiCooperativeCemSelectionCheckpoint>;
  readonly artifact: CanonicalJsonFile<AiCooperativeCemSelectionArtifact>;
  readonly sharedMarkerRelativePath: string;
  readonly localMarkerRelativePath: string;
  readonly checkpointRelativePath: string;
  readonly artifactRelativePath: string;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Uint8Array): string {
  return createHash(AI_COOPERATIVE_CEM_SELECTION_HASH_ALGORITHM)
    .update(value)
    .digest("hex");
}

function canonicalSha256(value: unknown): string {
  return sha256(canonicalAiPolicyEvolutionJson(value));
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

function isPathSameOrInside(parent: string, child: string): boolean {
  const childRelative = relative(parent, child);
  return (
    childRelative.length === 0 ||
    (childRelative !== ".." &&
      !childRelative.startsWith(`..${sep}`) &&
      !isAbsolute(childRelative))
  );
}

function portableRelativePath(parent: string, child: string, label: string): string {
  const result = relative(parent, child);
  if (
    result.length === 0 ||
    result === ".." ||
    result.startsWith(`..${sep}`) ||
    isAbsolute(result)
  ) {
    throw new RangeError(`${label} must be nested beneath its trusted parent`);
  }
  return result.replace(/\\/g, "/");
}

function requireOrdinaryFileWithin(
  path: string,
  trustedParent: string,
  label: string,
): void {
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new TypeError(`${label} must be an ordinary file`);
  }
  const parentRealPath = realpathSync.native(trustedParent);
  const fileRealPath = realpathSync.native(path);
  if (!isPathSameOrInside(parentRealPath, fileRealPath)) {
    throw new RangeError(`${label} escapes its trusted parent`);
  }
}

function readCanonicalJsonFile<T>(
  path: string,
  trustedParent: string,
  label: string,
): CanonicalJsonFile<T> {
  requireOrdinaryFileWithin(path, trustedParent, label);
  const bytes = readFileSync(path);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new TypeError(`${label} must contain valid UTF-8`);
  }
  let value: T;
  try {
    value = JSON.parse(text) as T;
  } catch (error) {
    throw new TypeError(`${label} is not valid JSON`, { cause: error });
  }
  const canonicalPayload = canonicalAiPolicyEvolutionJson(value);
  if (text !== `${canonicalPayload}\n`) {
    throw new TypeError(`${label} must be one exact canonical JSON line`);
  }
  return Object.freeze({ path, bytes, value, canonicalPayload });
}

function normalizedSource(path: string, repositoryRoot: string): string {
  requireOrdinaryFileWithin(path, repositoryRoot, "selection implementation source");
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

function collectGameSourcePaths(directory: string): string[] {
  const result: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => compareAscii(left.name, right.name),
  );
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new TypeError(
        `selection implementation source tree contains a reparse point: ${absolutePath}`,
      );
    }
    if (entry.isDirectory()) {
      result.push(...collectGameSourcePaths(absolutePath));
    } else if (entry.isFile() && /\.(?:json|ts)$/.test(entry.name)) {
      result.push(absolutePath);
    }
  }
  return result;
}

function archiveSource(repositoryRoot: string, absolutePath: string): ArchivedSource {
  return Object.freeze({
    relativePath: portableRelativePath(
      repositoryRoot,
      absolutePath,
      "selection implementation source",
    ),
    normalizedUtf8: normalizedSource(absolutePath, repositoryRoot),
  });
}

function implementationSourceSnapshot(repositoryRoot: string): ArchivedSource[] {
  const sourcePaths = [
    ...collectGameSourcePaths(resolve(repositoryRoot, "lib/game")),
    ...AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SOURCE_MANIFEST.scriptPaths.map(
      (path) => resolve(repositoryRoot, path),
    ),
  ];
  const sources = sourcePaths
    .map((path) => archiveSource(repositoryRoot, path))
    .sort((left, right) => compareAscii(left.relativePath, right.relativePath));
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.relativePath)) {
      throw new TypeError(`duplicate implementation source ${source.relativePath}`);
    }
    seen.add(source.relativePath);
  }
  return sources;
}

function literalAnchorSnapshot(repositoryRoot: string): ArchivedSource[] {
  const anchors =
    AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SOURCE_MANIFEST.excludedLiteralAnchorPaths
      .map((path) => archiveSource(repositoryRoot, resolve(repositoryRoot, path)))
      .sort((left, right) => compareAscii(left.relativePath, right.relativePath));
  if (anchors.length !== 2) {
    throw new TypeError("selection evidence requires exactly two literal anchors");
  }
  return anchors;
}

function computeArchivedImplementationSha256(
  sources: readonly ArchivedSource[],
): string {
  const hash = createHash(AI_COOPERATIVE_CEM_SELECTION_HASH_ALGORITHM);
  hash
    .update(AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_HASH_ALGORITHM)
    .update("\0");
  let previousPath: string | null = null;
  for (const source of sources) {
    if (
      previousPath !== null &&
      compareAscii(previousPath, source.relativePath) >= 0
    ) {
      throw new TypeError(
        "archived selection implementation sources must be uniquely ASCII-sorted",
      );
    }
    if (source.normalizedUtf8.includes("\r")) {
      throw new TypeError("archived selection implementation source is not normalized");
    }
    hash
      .update(source.relativePath)
      .update("\0")
      .update(source.normalizedUtf8, "utf8")
      .update("\0");
    previousPath = source.relativePath;
  }
  return hash.digest("hex");
}

function sourceManifestEntries(
  sources: readonly ArchivedSource[],
): readonly SourceManifestEntry[] {
  return sources.map((source) => ({
    relativePath: source.relativePath,
    normalizedUtf8Bytes: Buffer.byteLength(source.normalizedUtf8, "utf8"),
    normalizedUtf8Sha256: sha256(source.normalizedUtf8),
  }));
}

function readAndValidateCurrentSelectionEvidence(
  repositoryRoot: string,
): CurrentSelectionEvidence {
  const sharedPaths = resolveAiCooperativeCemSelectionSharedClaimPaths(
    repositoryRoot,
  );
  const checkpointDirectory = resolve(
    repositoryRoot,
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
  );
  const localMarkerPath = resolve(checkpointDirectory, LOCAL_MARKER_FILENAME);
  const checkpointPath = resolve(checkpointDirectory, CHECKPOINT_FILENAME);
  const artifactPath = resolve(
    repositoryRoot,
    AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  );
  const sharedMarker = readCanonicalJsonFile<AiCooperativeCemSelectionMarker>(
    sharedPaths.markerPath,
    sharedPaths.commonGitDirectory,
    "Git-common cooperative CEM selection marker",
  );
  const localMarker = readCanonicalJsonFile<AiCooperativeCemSelectionMarker>(
    localMarkerPath,
    repositoryRoot,
    "local cooperative CEM selection marker",
  );
  const checkpoint = readCanonicalJsonFile<AiCooperativeCemSelectionCheckpoint>(
    checkpointPath,
    repositoryRoot,
    "cooperative CEM selection checkpoint",
  );
  const artifact = readCanonicalJsonFile<AiCooperativeCemSelectionArtifact>(
    artifactPath,
    repositoryRoot,
    "cooperative CEM selection artifact",
  );

  assertValidAiCooperativeCemSelectionMarker(sharedMarker.value);
  assertValidAiCooperativeCemSelectionMarker(localMarker.value);
  assertValidAiCooperativeCemSelectionCheckpoint(checkpoint.value);
  assertValidAiCooperativeCemSelectionArtifact(artifact.value);
  assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
    artifact.value,
    checkpoint.value,
  );
  if (
    !sharedMarker.bytes.equals(localMarker.bytes) ||
    sharedMarker.canonicalPayload !== localMarker.canonicalPayload
  ) {
    throw new TypeError(
      "Git-common and local selection markers must be byte- and canonical-identical",
    );
  }
  if (
    checkpoint.value.executionKind !== "registered" ||
    artifact.value.executionKind !== "registered" ||
    checkpoint.value.markerHash !== sharedMarker.value.markerHash ||
    artifact.value.markerHash !== sharedMarker.value.markerHash
  ) {
    throw new TypeError("selection evidence is not bound to its registered marker");
  }
  const rawCanonicalJson = canonicalAiPolicyEvolutionJson(
    checkpoint.value.rawBenchmarkResult,
  );
  if (sha256(rawCanonicalJson) !== checkpoint.value.rawResultSha256) {
    throw new TypeError("selection raw benchmark digest mismatch");
  }
  if (
    checkpoint.value.gate.accepted !== false ||
    artifact.value.gate.accepted !== false ||
    artifact.value.rosterFinalScreenEligible !== false ||
    checkpoint.value.benchmark.evidenceUsable !== true ||
    artifact.value.benchmark.evidenceUsable !== true ||
    canonicalAiPolicyEvolutionJson(checkpoint.value.benchmark.evidenceReasons) !==
      "[]" ||
    canonicalAiPolicyEvolutionJson(artifact.value.benchmark.evidenceReasons) !==
      "[]" ||
    canonicalAiPolicyEvolutionJson(checkpoint.value.gate) !==
      canonicalAiPolicyEvolutionJson(EXPECTED_REJECTED_GATE) ||
    canonicalAiPolicyEvolutionJson(artifact.value.gate) !==
      canonicalAiPolicyEvolutionJson(EXPECTED_REJECTED_GATE)
  ) {
    throw new TypeError(
      "the completed registered selection result must remain usable, exactly gate-rejected, and roster-final-ineligible",
    );
  }

  return Object.freeze({
    sharedMarker,
    localMarker,
    checkpoint,
    artifact,
    sharedMarkerRelativePath: portableRelativePath(
      sharedPaths.commonGitDirectory,
      sharedPaths.markerPath,
      "Git-common selection marker",
    ),
    localMarkerRelativePath: portableRelativePath(
      repositoryRoot,
      localMarkerPath,
      "local selection marker",
    ),
    checkpointRelativePath: portableRelativePath(
      repositoryRoot,
      checkpointPath,
      "selection checkpoint",
    ),
    artifactRelativePath: portableRelativePath(
      repositoryRoot,
      artifactPath,
      "selection artifact",
    ),
  });
}

export function createAiCooperativeCemSelectionEvidenceBundle(
  repositoryRoot: string,
) {
  const resolvedRepositoryRoot = realpathSync.native(resolve(repositoryRoot));
  const implementationSha256 =
    assertAiCooperativeCemSelectionImplementationPinned();
  const protocolCanonicalJson =
    canonicalAiCooperativeCemSelectionProtocolJson();
  const protocolSha256 = computeAiCooperativeCemSelectionProtocolSha256();
  const trainingResultSha256 = computeAiCooperativeCemTrainingResultSha256();
  if (
    protocolSha256 !== AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256 ||
    sha256(protocolCanonicalJson) !== protocolSha256
  ) {
    throw new TypeError("selection protocol pin or canonical payload drifted");
  }
  if (
    trainingResultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 ||
    AI_COOPERATIVE_CEM_TRAINING_RESULT.resultSha256 !== trainingResultSha256
  ) {
    throw new TypeError("selection training-result pin drifted");
  }
  if (
    AI_POLICY_SUITE_EVALUATOR_HASH !==
      AI_COOPERATIVE_CEM_SELECTION_EXPECTED_EVALUATOR_SHA256 ||
    AI_POLICY_SUITE_EVALUATOR_HASH !==
      AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.expectedProvenance.evaluatorHash
  ) {
    throw new TypeError("selection evaluator pin drifted");
  }
  const protocolValue = JSON.parse(protocolCanonicalJson) as unknown;
  if (canonicalAiPolicyEvolutionJson(protocolValue) !== protocolCanonicalJson) {
    throw new TypeError("selection protocol payload is not canonical JSON");
  }

  const sources = implementationSourceSnapshot(resolvedRepositoryRoot);
  if (computeArchivedImplementationSha256(sources) !== implementationSha256) {
    throw new TypeError("archived selection implementation digest mismatch");
  }
  const literalAnchors = literalAnchorSnapshot(resolvedRepositoryRoot);
  const evidence = readAndValidateCurrentSelectionEvidence(
    resolvedRepositoryRoot,
  );

  return Object.freeze({
    formatVersion: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_FORMAT_VERSION,
    archiveId: "cooperative-cem-power-level-selection-evidence-93100001-v1",
    registrationId: AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
    reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
    sourceSnapshot: {
      implementationSha256,
      implementationManifest:
        AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SOURCE_MANIFEST,
      sources,
      literalAnchors,
      protocolSha256,
      protocolCanonicalJson,
      evaluatorSha256: AI_POLICY_SUITE_EVALUATOR_HASH,
      trainingResultSha256,
    },
    runEvidence: {
      sharedMarker: {
        scope: "git-common",
        relativePath: evidence.sharedMarkerRelativePath,
        value: evidence.sharedMarker.value,
      },
      localMarker: {
        scope: "worktree",
        relativePath: evidence.localMarkerRelativePath,
        value: evidence.localMarker.value,
      },
      checkpoint: {
        relativePath: evidence.checkpointRelativePath,
        value: evidence.checkpoint.value,
      },
      artifact: {
        relativePath: evidence.artifactRelativePath,
        value: evidence.artifact.value,
      },
    },
  });
}

function canonicalFileManifestEntry<T>(file: CanonicalJsonFile<T>) {
  return {
    fileBytes: file.bytes.byteLength,
    fileSha256: sha256(file.bytes),
    canonicalPayloadBytes: Buffer.byteLength(file.canonicalPayload, "utf8"),
    canonicalPayloadSha256: sha256(file.canonicalPayload),
  };
}

function createAiCooperativeCemSelectionEvidenceManifest(
  bundle: ReturnType<typeof createAiCooperativeCemSelectionEvidenceBundle>,
  evidence: CurrentSelectionEvidence,
  canonicalPayload: string,
  compressed: Uint8Array,
) {
  if (
    bundle.runEvidence.sharedMarker.relativePath !==
      evidence.sharedMarkerRelativePath ||
    bundle.runEvidence.localMarker.relativePath !==
      evidence.localMarkerRelativePath ||
    bundle.runEvidence.checkpoint.relativePath !==
      evidence.checkpointRelativePath ||
    bundle.runEvidence.artifact.relativePath !== evidence.artifactRelativePath ||
    canonicalAiPolicyEvolutionJson(bundle.runEvidence.sharedMarker.value) !==
      evidence.sharedMarker.canonicalPayload ||
    canonicalAiPolicyEvolutionJson(bundle.runEvidence.localMarker.value) !==
      evidence.localMarker.canonicalPayload ||
    canonicalAiPolicyEvolutionJson(bundle.runEvidence.checkpoint.value) !==
      evidence.checkpoint.canonicalPayload ||
    canonicalAiPolicyEvolutionJson(bundle.runEvidence.artifact.value) !==
      evidence.artifact.canonicalPayload
  ) {
    throw new TypeError(
      "selection evidence changed while the immutable archive was being assembled",
    );
  }
  const checkpoint = evidence.checkpoint.value;
  const artifact = evidence.artifact.value;
  const rawCanonicalJson = canonicalAiPolicyEvolutionJson(
    checkpoint.rawBenchmarkResult,
  );
  const sourceSnapshot = bundle.sourceSnapshot;
  return Object.freeze({
    formatVersion:
      AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FORMAT_VERSION,
    archiveId: bundle.archiveId,
    registrationId: bundle.registrationId,
    reservationId: bundle.reservationId,
    bundle: {
      relativePath: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME,
      compression: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_COMPRESSION,
      canonicalJson: CANONICAL_JSON_FORMAT,
      uncompressedBytes: Buffer.byteLength(canonicalPayload, "utf8"),
      compressedBytes: compressed.byteLength,
      payloadSha256: sha256(canonicalPayload),
      blobSha256: sha256(compressed),
    },
    pins: {
      implementationSha256: sourceSnapshot.implementationSha256,
      protocolSha256: sourceSnapshot.protocolSha256,
      evaluatorSha256: sourceSnapshot.evaluatorSha256,
      trainingResultSha256: sourceSnapshot.trainingResultSha256,
    },
    protocol: {
      canonicalPayloadBytes: Buffer.byteLength(
        sourceSnapshot.protocolCanonicalJson,
        "utf8",
      ),
      canonicalPayloadSha256: sha256(
        sourceSnapshot.protocolCanonicalJson,
      ),
    },
    markers: {
      shared: {
        scope: "git-common",
        relativePath: evidence.sharedMarkerRelativePath,
        ...canonicalFileManifestEntry(evidence.sharedMarker),
        markerHash: evidence.sharedMarker.value.markerHash,
      },
      local: {
        scope: "worktree",
        relativePath: evidence.localMarkerRelativePath,
        ...canonicalFileManifestEntry(evidence.localMarker),
        markerHash: evidence.localMarker.value.markerHash,
      },
      byteIdentical: evidence.sharedMarker.bytes.equals(
        evidence.localMarker.bytes,
      ),
      canonicalIdentical:
        evidence.sharedMarker.canonicalPayload ===
        evidence.localMarker.canonicalPayload,
    },
    checkpoint: {
      relativePath: evidence.checkpointRelativePath,
      ...canonicalFileManifestEntry(evidence.checkpoint),
      checkpointHash: checkpoint.checkpointHash,
      markerHash: checkpoint.markerHash,
      rawBenchmarkResult: {
        includedInBundle: true,
        canonicalPayloadBytes: Buffer.byteLength(rawCanonicalJson, "utf8"),
        canonicalPayloadSha256: sha256(rawCanonicalJson),
        registeredRawResultSha256: checkpoint.rawResultSha256,
      },
    },
    artifact: {
      relativePath: evidence.artifactRelativePath,
      ...canonicalFileManifestEntry(evidence.artifact),
      artifactHash: artifact.artifactHash,
      checkpointHash: artifact.checkpointHash,
      markerHash: artifact.markerHash,
      rawResultSha256: artifact.rawResultSha256,
    },
    outcome: {
      executionKind: artifact.executionKind,
      evidenceUsable: artifact.benchmark.evidenceUsable,
      gateAccepted: artifact.gate.accepted,
      gateCanonicalSha256: canonicalSha256(artifact.gate),
      rosterFinalScreenEligible: artifact.rosterFinalScreenEligible,
    },
    sourceSnapshot: {
      implementationManifestSha256: canonicalSha256(
        sourceSnapshot.implementationManifest,
      ),
      sourceFileCount: sourceSnapshot.sources.length,
      sourceFiles: sourceManifestEntries(sourceSnapshot.sources),
      literalAnchorFileCount: sourceSnapshot.literalAnchors.length,
      literalAnchorFiles: sourceManifestEntries(
        sourceSnapshot.literalAnchors,
      ),
    },
  });
}

function assertDeterministicArchive(
  bundle: ReturnType<typeof createAiCooperativeCemSelectionEvidenceBundle>,
  manifest: ReturnType<typeof createAiCooperativeCemSelectionEvidenceManifest>,
  canonicalPayload: string,
  compressed: Uint8Array,
): void {
  if (canonicalAiPolicyEvolutionJson(bundle) !== canonicalPayload) {
    throw new TypeError("selection evidence payload is not canonical JSON");
  }
  if (gunzipSync(compressed).toString("utf8") !== canonicalPayload) {
    throw new TypeError("selection evidence gzip does not contain its payload");
  }
  if (
    compressed.byteLength < 10 ||
    compressed[4] !== 0 ||
    compressed[5] !== 0 ||
    compressed[6] !== 0 ||
    compressed[7] !== 0
  ) {
    throw new TypeError("selection evidence gzip header must use mtime 0");
  }
  const repeatedCompression = gzipSync(Buffer.from(canonicalPayload, "utf8"), {
    level: 9,
  });
  if (!Buffer.from(compressed).equals(repeatedCompression)) {
    throw new TypeError("selection evidence gzip bytes are not deterministic");
  }
  if (
    manifest.bundle.payloadSha256 !== sha256(canonicalPayload) ||
    manifest.bundle.blobSha256 !== sha256(compressed) ||
    manifest.bundle.uncompressedBytes !==
      Buffer.byteLength(canonicalPayload, "utf8") ||
    manifest.bundle.compressedBytes !== compressed.byteLength ||
    manifest.markers.byteIdentical !== true ||
    manifest.markers.canonicalIdentical !== true ||
    manifest.checkpoint.rawBenchmarkResult.canonicalPayloadSha256 !==
      manifest.checkpoint.rawBenchmarkResult.registeredRawResultSha256 ||
    manifest.outcome.gateAccepted !== false ||
    manifest.outcome.rosterFinalScreenEligible !== false
  ) {
    throw new TypeError("selection evidence manifest closure mismatch");
  }
}

function requireExistingFileMatches(path: string, expected: Uint8Array): boolean {
  if (!pathEntryExists(path)) return false;
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new TypeError(`selection evidence target must be an ordinary file: ${path}`);
  }
  const current = readFileSync(path);
  if (!current.equals(Buffer.from(expected))) {
    throw new Error(`refusing to overwrite conflicting selection evidence ${path}`);
  }
  return true;
}

function reportCleanup(message: string): void {
  try {
    process.stderr.write(`${message}\n`);
  } catch {
    // A published immutable file remains successful even if diagnostics fail.
  }
}

function atomicAppendOnlyWrite(
  targetPath: string,
  content: Uint8Array,
): "created" | "existing" {
  if (requireExistingFileMatches(targetPath, content)) return "existing";
  const temporaryPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  let targetPublishedOrMatched = false;
  try {
    descriptor = openSync(temporaryPath, "wx");
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    try {
      linkSync(temporaryPath, targetPath);
      targetPublishedOrMatched = true;
      return "created";
    } catch (error) {
      if (requireExistingFileMatches(targetPath, content)) {
        targetPublishedOrMatched = true;
        return "existing";
      }
      throw error;
    }
  } finally {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (error) {
        reportCleanup(
          `failed to close selection evidence temporary file ${basename(temporaryPath)}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (pathEntryExists(temporaryPath)) {
      try {
        unlinkSync(temporaryPath);
      } catch (error) {
        const message = `failed to remove selection evidence temporary file ${basename(temporaryPath)}: ${error instanceof Error ? error.message : String(error)}`;
        if (targetPublishedOrMatched) reportCleanup(message);
        else throw new Error(message, { cause: error });
      }
    }
  }
}

export function archiveAiCooperativeCemSelectionEvidence(
  repositoryRoot: string,
) {
  const resolvedRepositoryRoot = realpathSync.native(resolve(repositoryRoot));
  const bundle = createAiCooperativeCemSelectionEvidenceBundle(
    resolvedRepositoryRoot,
  );
  const evidence = readAndValidateCurrentSelectionEvidence(
    resolvedRepositoryRoot,
  );
  const canonicalPayload = canonicalAiPolicyEvolutionJson(bundle);
  const compressed = gzipSync(Buffer.from(canonicalPayload, "utf8"), {
    level: 9,
  });
  const manifest = createAiCooperativeCemSelectionEvidenceManifest(
    bundle,
    evidence,
    canonicalPayload,
    compressed,
  );
  assertDeterministicArchive(bundle, manifest, canonicalPayload, compressed);
  const manifestBytes = Buffer.from(
    canonicalAiPolicyEvolutionJson(manifest),
    "utf8",
  );

  const evidenceDirectory = resolve(
    resolvedRepositoryRoot,
    AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_RELATIVE_DIRECTORY,
  );
  portableRelativePath(
    resolvedRepositoryRoot,
    evidenceDirectory,
    "selection evidence directory",
  );
  const bundlePath = resolve(
    evidenceDirectory,
    AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME,
  );
  const manifestPath = resolve(
    evidenceDirectory,
    AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FILENAME,
  );

  // Check both destinations for conflicts before creating any archive path.
  const bundleAlreadyExists = requireExistingFileMatches(bundlePath, compressed);
  const manifestAlreadyExists = requireExistingFileMatches(
    manifestPath,
    manifestBytes,
  );
  ensureAiCooperativeCemSelectionDirectoryTreeWithin(
    resolvedRepositoryRoot,
    evidenceDirectory,
  );
  const bundleDisposition = bundleAlreadyExists
    ? "existing"
    : atomicAppendOnlyWrite(bundlePath, compressed);
  const manifestDisposition = manifestAlreadyExists
    ? "existing"
    : atomicAppendOnlyWrite(manifestPath, manifestBytes);
  if (
    !readFileSync(bundlePath).equals(Buffer.from(compressed)) ||
    !readFileSync(manifestPath).equals(manifestBytes)
  ) {
    throw new Error("published selection evidence failed exact byte verification");
  }
  return Object.freeze({
    bundleDisposition,
    manifestDisposition,
    evidenceDirectory,
    bundlePath,
    manifestPath,
    manifest,
    manifestSha256: sha256(manifestBytes),
    manifestBytes: manifestBytes.byteLength,
  });
}

export function mainAiCooperativeCemSelectionEvidenceArchive(): void {
  const repositoryRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
  const result = archiveAiCooperativeCemSelectionEvidence(repositoryRoot);
  process.stdout.write(
    `${canonicalAiPolicyEvolutionJson({
      bundleDisposition: result.bundleDisposition,
      bundlePayloadSha256: result.manifest.bundle.payloadSha256,
      bundleBlobSha256: result.manifest.bundle.blobSha256,
      compressedBytes: result.manifest.bundle.compressedBytes,
      evidenceDirectory: result.evidenceDirectory,
      manifestDisposition: result.manifestDisposition,
      manifestBytes: result.manifestBytes,
      manifestSha256: result.manifestSha256,
      uncompressedBytes: result.manifest.bundle.uncompressedBytes,
    })}\n`,
  );
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    pathToFileURL(resolve(entry)).href === import.meta.url
  );
}

if (isDirectExecution()) {
  try {
    mainAiCooperativeCemSelectionEvidenceArchive();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
