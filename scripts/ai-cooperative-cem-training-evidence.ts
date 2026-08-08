import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { canonicalHistoricalJsonV1 as canonicalAiPolicyEvolutionJson } from "./ai-historical-canonical-json-v1.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
  computeAiCooperativeCemTrainingResultSha256,
} from "./ai-cooperative-cem-training-result.ts";

export const AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FORMAT_VERSION =
  1 as const;
export const AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_COMPRESSION =
  "gzip-level-9-mtime-0" as const;
export const AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY =
  "evidence/ai-cooperative-cem/power-level-v1-93010001" as const;
export const AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_BUNDLE_FILENAME =
  "training-evidence-v1.json.gz" as const;
export const AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FILENAME =
  "manifest.json" as const;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ARCHIVED_IMPLEMENTATION_HASH_ALGORITHM =
  "sha256-path-null-normalized-utf8-null-v1" as const;

export interface JsonRecord {
  readonly [key: string]: unknown;
}

export interface AiCooperativeCemImplementationSourceManifest {
  readonly formatVersion: number;
  readonly hashAlgorithm: string;
  readonly gameSources: string;
  readonly lineEndings: string;
  readonly scriptPaths: readonly string[];
  readonly excludedLiteralAnchorPaths: readonly string[];
}

export interface AiCooperativeCemRegisteredRunMarker extends JsonRecord {
  readonly markerHash: string;
}

export interface AiCooperativeCemRegisteredSearchCheckpoint
  extends JsonRecord {
  readonly sequenceIndex: number;
  readonly protocolSha256: string;
  readonly implementationSha256: string;
  readonly checkpointHash: string;
  readonly evaluation: JsonRecord;
  readonly rawBenchmarkResult: JsonRecord;
}

export interface AiCooperativeCemTrainingArtifact extends JsonRecord {
  readonly artifactHash: string;
  readonly evolution: JsonRecord;
  readonly candidateEvaluations: readonly JsonRecord[];
  readonly selectedCandidateId: string;
  readonly selectedGenome: unknown;
}

export interface AiCooperativeCemArchivedSource {
  readonly relativePath: string;
  readonly normalizedUtf8: string;
}

export interface AiCooperativeCemTrainingEvidenceBundle {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_FORMAT_VERSION;
  readonly registrationId: string;
  readonly sourceSnapshot: {
    readonly implementationSha256: string;
    readonly implementationManifest: AiCooperativeCemImplementationSourceManifest;
    readonly sources: readonly AiCooperativeCemArchivedSource[];
    readonly literalAnchors: readonly AiCooperativeCemArchivedSource[];
    readonly protocolSha256: string;
    readonly protocolCanonicalJson: string;
  };
  readonly runMarker: AiCooperativeCemRegisteredRunMarker;
  readonly artifact: AiCooperativeCemTrainingArtifact;
  readonly checkpoints: readonly AiCooperativeCemRegisteredSearchCheckpoint[];
}

export interface AiCooperativeCemTrainingEvidenceCheckpointManifestEntry {
  readonly sequenceIndex: number;
  readonly candidateId: string;
  readonly checkpointHash: string;
  readonly checkpointCanonicalSha256: string;
  readonly evaluationRecordHash: string;
  readonly rawResultSha256: string;
}

export interface AiCooperativeCemTrainingEvidenceManifest {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FORMAT_VERSION;
  readonly registrationId: string;
  readonly bundle: {
    readonly relativePath: string;
    readonly compression: typeof AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_COMPRESSION;
    readonly canonicalJson: "canonical-ai-policy-evolution-json-v1";
    readonly uncompressedBytes: number;
    readonly compressedBytes: number;
    readonly payloadSha256: string;
    readonly blobSha256: string;
  };
  readonly sourceSnapshot: {
    readonly implementationSha256: string;
    readonly protocolSha256: string;
    readonly protocolPayloadSha256: string;
    readonly sourceFileCount: number;
    readonly sourceFiles: readonly {
      readonly relativePath: string;
      readonly normalizedUtf8Sha256: string;
    }[];
    readonly literalAnchorFiles: readonly {
      readonly relativePath: string;
      readonly normalizedUtf8Sha256: string;
    }[];
  };
  readonly runMarkerHash: string;
  readonly artifactHash: string;
  readonly evolutionArtifactHash: string;
  readonly checkpoints: readonly AiCooperativeCemTrainingEvidenceCheckpointManifestEntry[];
  readonly selected: {
    readonly candidateId: string;
    readonly sequenceIndex: number;
    readonly checkpointHash: string;
    readonly checkpointCanonicalSha256: string;
    readonly evaluationRecordHash: string;
    readonly rawResultSha256: string;
  };
}

function isPlainObject(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  return value;
}

function asSha256(value: unknown, label: string): string {
  const result = asString(value, label);
  if (!SHA256_PATTERN.test(result)) {
    throw new TypeError(`${label} must be a lower-case SHA-256 digest`);
  }
  return result;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function comparisonSummary(value: unknown, label: string): Readonly<{
  placementMeanDelta: number;
  placementConfidence95: readonly [number, number];
  topFourMeanDelta: number;
  winMeanDelta: number;
}> {
  const comparison = asRecord(value, label);
  const placement = asRecord(comparison.placement, `${label}.placement`);
  const confidence95 = asRecord(
    placement.confidence95,
    `${label}.placement.confidence95`,
  );
  const topFour = asRecord(comparison.topFour, `${label}.topFour`);
  const win = asRecord(comparison.win, `${label}.win`);
  return {
    placementMeanDelta: asFiniteNumber(
      placement.meanDelta,
      `${label}.placement.meanDelta`,
    ),
    placementConfidence95: [
      asFiniteNumber(
        confidence95.lower,
        `${label}.placement.confidence95.lower`,
      ),
      asFiniteNumber(
        confidence95.upper,
        `${label}.placement.confidence95.upper`,
      ),
    ],
    topFourMeanDelta: asFiniteNumber(
      topFour.meanDelta,
      `${label}.topFour.meanDelta`,
    ),
    winMeanDelta: asFiniteNumber(win.meanDelta, `${label}.win.meanDelta`),
  };
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalSha256(value: unknown): string {
  return sha256(canonicalAiPolicyEvolutionJson(value));
}

function withoutProperty(value: JsonRecord, property: string): JsonRecord {
  const result = { ...value };
  delete result[property];
  return result;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function computeArchivedAiCooperativeCemImplementationSha256(
  sources: readonly AiCooperativeCemArchivedSource[],
): string {
  const hash = createHash("sha256");
  hash.update(ARCHIVED_IMPLEMENTATION_HASH_ALGORITHM).update("\0");
  const seen = new Set<string>();
  for (const source of sources) {
    if (
      typeof source.relativePath !== "string" ||
      typeof source.normalizedUtf8 !== "string" ||
      source.normalizedUtf8.includes("\r")
    ) {
      throw new TypeError("archived source must use a path and normalized UTF-8 text");
    }
    if (seen.has(source.relativePath)) {
      throw new TypeError(`duplicate archived source ${source.relativePath}`);
    }
    seen.add(source.relativePath);
    hash
      .update(source.relativePath)
      .update("\0")
      .update(source.normalizedUtf8, "utf8")
      .update("\0");
  }
  return hash.digest("hex");
}

function readJson(path: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`failed to read ${label} at ${path}`, { cause: error });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TypeError(`${label} is not valid JSON`, { cause: error });
  }
}

function sourceManifestEntries(
  sources: readonly AiCooperativeCemArchivedSource[],
): readonly { readonly relativePath: string; readonly normalizedUtf8Sha256: string }[] {
  return sources.map((source) => ({
    relativePath: source.relativePath,
    normalizedUtf8Sha256: sha256(source.normalizedUtf8),
  }));
}

export function createAiCooperativeCemTrainingEvidenceManifest(
  bundle: AiCooperativeCemTrainingEvidenceBundle,
  canonicalPayload: string,
  compressed: Uint8Array,
): AiCooperativeCemTrainingEvidenceManifest {
  const artifact = bundle.artifact as unknown as JsonRecord;
  const evolution = asRecord(artifact.evolution, "artifact.evolution");
  const selectedCandidateId = asString(
    artifact.selectedCandidateId,
    "artifact.selectedCandidateId",
  );
  const checkpoints = bundle.checkpoints.map((checkpoint) => {
    const checkpointRecord = checkpoint as unknown as JsonRecord;
    const evaluation = asRecord(checkpointRecord.evaluation, "checkpoint.evaluation");
    const benchmark = asRecord(evaluation.benchmark, "evaluation.benchmark");
    return {
      sequenceIndex: asNonNegativeInteger(
        checkpointRecord.sequenceIndex,
        "checkpoint.sequenceIndex",
      ),
      candidateId: asString(evaluation.candidateId, "evaluation.candidateId"),
      checkpointHash: asSha256(checkpointRecord.checkpointHash, "checkpoint.checkpointHash"),
      checkpointCanonicalSha256: canonicalSha256(checkpoint),
      evaluationRecordHash: asSha256(evaluation.recordHash, "evaluation.recordHash"),
      rawResultSha256: asSha256(
        benchmark.rawResultSha256,
        "evaluation.benchmark.rawResultSha256",
      ),
    };
  });
  const selected = checkpoints.find(
    (checkpoint) => checkpoint.candidateId === selectedCandidateId,
  );
  if (selected === undefined) throw new TypeError("selected checkpoint is missing");

  return {
    formatVersion: AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FORMAT_VERSION,
    registrationId: bundle.registrationId,
    bundle: {
      relativePath: AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_BUNDLE_FILENAME,
      compression: AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_COMPRESSION,
      canonicalJson: "canonical-ai-policy-evolution-json-v1",
      uncompressedBytes: Buffer.byteLength(canonicalPayload, "utf8"),
      compressedBytes: compressed.byteLength,
      payloadSha256: sha256(canonicalPayload),
      blobSha256: sha256(compressed),
    },
    sourceSnapshot: {
      implementationSha256: bundle.sourceSnapshot.implementationSha256,
      protocolSha256: bundle.sourceSnapshot.protocolSha256,
      protocolPayloadSha256: sha256(bundle.sourceSnapshot.protocolCanonicalJson),
      sourceFileCount: bundle.sourceSnapshot.sources.length,
      sourceFiles: sourceManifestEntries(bundle.sourceSnapshot.sources),
      literalAnchorFiles: sourceManifestEntries(bundle.sourceSnapshot.literalAnchors),
    },
    runMarkerHash: asSha256(
      (bundle.runMarker as unknown as JsonRecord).markerHash,
      "runMarker.markerHash",
    ),
    artifactHash: asSha256(artifact.artifactHash, "artifact.artifactHash"),
    evolutionArtifactHash: asSha256(
      evolution.artifactHash,
      "artifact.evolution.artifactHash",
    ),
    checkpoints,
    selected,
  };
}

export function computeAiCooperativeCemTrainingEvidenceManifestSha256(
  manifest: AiCooperativeCemTrainingEvidenceManifest,
): string {
  return canonicalSha256(manifest);
}

function assertManifestMatchesBundle(
  manifest: AiCooperativeCemTrainingEvidenceManifest,
  bundle: AiCooperativeCemTrainingEvidenceBundle,
  canonicalPayload: string,
  compressed: Uint8Array,
): void {
  const expected = createAiCooperativeCemTrainingEvidenceManifest(
    bundle,
    canonicalPayload,
    compressed,
  );
  if (
    canonicalAiPolicyEvolutionJson(manifest) !==
    canonicalAiPolicyEvolutionJson(expected)
  ) {
    throw new TypeError("training evidence manifest does not match bundle");
  }
}

export function assertAiCooperativeCemHistoricalTrainingEvidence(
  bundle: AiCooperativeCemTrainingEvidenceBundle,
  manifest: AiCooperativeCemTrainingEvidenceManifest,
  canonicalPayload: string,
  compressed: Uint8Array,
): void {
  if (
    bundle.formatVersion !== AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_FORMAT_VERSION ||
    manifest.formatVersion !==
      AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FORMAT_VERSION ||
    bundle.registrationId !== manifest.registrationId
  ) {
    throw new TypeError("training evidence format or registration mismatch");
  }
  if (canonicalAiPolicyEvolutionJson(bundle) !== canonicalPayload) {
    throw new TypeError("training evidence payload is not canonical JSON");
  }
  if (gunzipSync(compressed).toString("utf8") !== canonicalPayload) {
    throw new TypeError("training evidence compressed blob does not match payload");
  }
  if (compressed.byteLength < 10 || compressed[4] !== 0 || compressed[5] !== 0 || compressed[6] !== 0 || compressed[7] !== 0) {
    throw new TypeError("training evidence gzip header must use mtime 0");
  }
  assertManifestMatchesBundle(manifest, bundle, canonicalPayload, compressed);

  const sourceSnapshot = bundle.sourceSnapshot;
  if (
    sourceSnapshot.implementationSha256 !==
      AI_COOPERATIVE_CEM_TRAINING_RESULT.evidence.implementationSha256 ||
    sourceSnapshot.implementationManifest.hashAlgorithm !==
      ARCHIVED_IMPLEMENTATION_HASH_ALGORITHM ||
    computeArchivedAiCooperativeCemImplementationSha256(sourceSnapshot.sources) !==
      sourceSnapshot.implementationSha256
  ) {
    throw new TypeError("archived implementation source digest mismatch");
  }
  const sourcePaths = sourceSnapshot.sources.map((source) => source.relativePath);
  if (sourcePaths.some((path, index) => index > 0 && compareAscii(sourcePaths[index - 1], path) >= 0)) {
    throw new TypeError("archived implementation sources must be uniquely ASCII-sorted");
  }
  const protocolValue = JSON.parse(sourceSnapshot.protocolCanonicalJson) as unknown;
  if (
    canonicalAiPolicyEvolutionJson(protocolValue) !==
      sourceSnapshot.protocolCanonicalJson ||
    sha256(sourceSnapshot.protocolCanonicalJson) !== sourceSnapshot.protocolSha256
  ) {
    throw new TypeError("archived protocol payload digest mismatch");
  }

  const marker = asRecord(bundle.runMarker, "runMarker");
  const markerHash = asSha256(marker.markerHash, "runMarker.markerHash");
  if (canonicalSha256(withoutProperty(marker, "markerHash")) !== markerHash) {
    throw new TypeError("historical run marker hash mismatch");
  }

  const artifact = asRecord(bundle.artifact, "artifact");
  const artifactHash = asSha256(artifact.artifactHash, "artifact.artifactHash");
  if (canonicalSha256(withoutProperty(artifact, "artifactHash")) !== artifactHash) {
    throw new TypeError("historical artifact hash mismatch");
  }
  if (
    artifact.protocolId !== bundle.registrationId ||
    artifact.protocolSha256 !== sourceSnapshot.protocolSha256 ||
    artifact.implementationSha256 !== sourceSnapshot.implementationSha256 ||
    artifact.registeredRunMarkerHash !== markerHash ||
    artifact.executionKind !== "registered" ||
    artifact.registeredResumeMode !== "none" ||
    artifact.cachedCandidateCount !== 0 ||
    artifact.trainingEvidenceUsable !== true ||
    artifact.selectionScreenEligible !== true
  ) {
    throw new TypeError("historical artifact provenance mismatch");
  }
  const evolution = asRecord(artifact.evolution, "artifact.evolution");
  const evolutionHash = asSha256(
    evolution.artifactHash,
    "artifact.evolution.artifactHash",
  );
  if (canonicalSha256(withoutProperty(evolution, "artifactHash")) !== evolutionHash) {
    throw new TypeError("historical evolution artifact hash mismatch");
  }

  const artifactEvaluations = asArray(
    artifact.candidateEvaluations,
    "artifact.candidateEvaluations",
  );
  if (
    bundle.checkpoints.length !== artifactEvaluations.length ||
    bundle.checkpoints.length !== manifest.checkpoints.length
  ) {
    throw new TypeError("historical checkpoint count mismatch");
  }
  const seenCandidateIds = new Set<string>();
  for (const [index, checkpointValue] of bundle.checkpoints.entries()) {
    const checkpoint = asRecord(checkpointValue, `checkpoints[${index}]`);
    if (checkpoint.sequenceIndex !== index) {
      throw new TypeError(`historical checkpoint sequence is not contiguous at ${index}`);
    }
    if (
      checkpoint.protocolSha256 !== sourceSnapshot.protocolSha256 ||
      checkpoint.implementationSha256 !== sourceSnapshot.implementationSha256
    ) {
      throw new TypeError(`historical checkpoint ${index} provenance mismatch`);
    }
    const checkpointHash = asSha256(
      checkpoint.checkpointHash,
      `checkpoints[${index}].checkpointHash`,
    );
    if (
      canonicalSha256(withoutProperty(checkpoint, "checkpointHash")) !==
      checkpointHash
    ) {
      throw new TypeError(`historical checkpoint ${index} hash mismatch`);
    }
    const evaluation = asRecord(
      checkpoint.evaluation,
      `checkpoints[${index}].evaluation`,
    );
    const recordHash = asSha256(
      evaluation.recordHash,
      `checkpoints[${index}].evaluation.recordHash`,
    );
    if (canonicalSha256(withoutProperty(evaluation, "recordHash")) !== recordHash) {
      throw new TypeError(`historical evaluation ${index} record hash mismatch`);
    }
    const rawResult = asRecord(
      checkpoint.rawBenchmarkResult,
      `checkpoints[${index}].rawBenchmarkResult`,
    );
    const benchmark = asRecord(
      evaluation.benchmark,
      `checkpoints[${index}].evaluation.benchmark`,
    );
    if (canonicalSha256(rawResult) !== benchmark.rawResultSha256) {
      throw new TypeError(`historical checkpoint ${index} raw result hash mismatch`);
    }
    const candidateId = asString(
      evaluation.candidateId,
      `checkpoints[${index}].evaluation.candidateId`,
    );
    if (seenCandidateIds.has(candidateId)) {
      throw new TypeError(`duplicate historical candidate ${candidateId}`);
    }
    seenCandidateIds.add(candidateId);
    if (
      canonicalAiPolicyEvolutionJson(evaluation) !==
      canonicalAiPolicyEvolutionJson(artifactEvaluations[index])
    ) {
      throw new TypeError(`historical checkpoint ${index} is not bound to artifact`);
    }
  }

  const selectedCandidateId = asString(
    artifact.selectedCandidateId,
    "artifact.selectedCandidateId",
  );
  const selectedEvaluation = artifactEvaluations.find(
    (value) =>
      isPlainObject(value) && value.candidateId === selectedCandidateId,
  );
  const finalIncumbent = asRecord(
    evolution.finalIncumbent,
    "artifact.evolution.finalIncumbent",
  );
  if (
    selectedEvaluation === undefined ||
    finalIncumbent.candidateId !== selectedCandidateId ||
    canonicalAiPolicyEvolutionJson(artifact.selectedGenome) !==
      canonicalAiPolicyEvolutionJson(finalIncumbent.genome)
  ) {
    throw new TypeError("historical selected candidate mismatch");
  }
}

/**
 * Binds a self-consistent historical bundle to the immutable registered result.
 * Callers that authorize a later phase must use this stronger assertion.
 */
export function assertAiCooperativeCemHistoricalTrainingEvidenceMatchesPinnedResult(
  bundle: AiCooperativeCemTrainingEvidenceBundle,
  manifest: AiCooperativeCemTrainingEvidenceManifest,
): void {
  const registered = AI_COOPERATIVE_CEM_TRAINING_RESULT;
  if (
    computeAiCooperativeCemTrainingResultSha256() !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 ||
    registered.resultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256
  ) {
    throw new TypeError("pinned cooperative CEM training result drifted");
  }
  if (
    manifest.registrationId !== registered.registrationId ||
    manifest.bundle.payloadSha256 !== registered.archive.bundlePayloadSha256 ||
    manifest.bundle.blobSha256 !== registered.archive.bundleBlobSha256 ||
    computeAiCooperativeCemTrainingEvidenceManifestSha256(manifest) !==
      registered.archive.manifestSha256 ||
    manifest.sourceSnapshot.implementationSha256 !==
      registered.evidence.implementationSha256 ||
    manifest.sourceSnapshot.protocolSha256 !==
      registered.evidence.protocolSha256 ||
    manifest.artifactHash !== registered.evidence.artifactHash ||
    manifest.evolutionArtifactHash !==
      registered.evidence.evolutionArtifactHash ||
    manifest.runMarkerHash !== registered.evidence.registeredRunMarkerHash
  ) {
    throw new TypeError(
      "historical training evidence does not match the pinned result registration",
    );
  }
  if (
    canonicalAiPolicyEvolutionJson(
      manifest.checkpoints.map((checkpoint) => checkpoint.checkpointHash),
    ) !==
    canonicalAiPolicyEvolutionJson(registered.evidence.checkpointHashes)
  ) {
    throw new TypeError(
      "historical checkpoint chain does not match the pinned result registration",
    );
  }
  const expectedSelected = {
    sequenceIndex: registered.selected.checkpointSequenceIndex,
    candidateId: registered.selected.candidateId,
    checkpointHash: registered.selected.checkpointHash,
    checkpointCanonicalSha256:
      registered.selected.checkpointCanonicalSha256,
    evaluationRecordHash: registered.selected.evaluationRecordHash,
    rawResultSha256: registered.selected.rawResultSha256,
  };
  if (
    canonicalAiPolicyEvolutionJson(manifest.selected) !==
    canonicalAiPolicyEvolutionJson(expectedSelected)
  ) {
    throw new TypeError(
      "historical selected checkpoint does not match the pinned result registration",
    );
  }
  const artifact = bundle.artifact as unknown as JsonRecord;
  const selectedEvaluation = asArray(
    artifact.candidateEvaluations,
    "artifact.candidateEvaluations",
  ).find(
    (value) =>
      isPlainObject(value) && value.candidateId === registered.selected.candidateId,
  );
  if (!isPlainObject(selectedEvaluation)) {
    throw new TypeError("pinned selected evaluation is missing from historical artifact");
  }
  const benchmark = asRecord(
    selectedEvaluation.benchmark,
    "selectedEvaluation.benchmark",
  );
  const constraints = asRecord(
    selectedEvaluation.constraints,
    "selectedEvaluation.constraints",
  );
  const overall = asRecord(benchmark.overall, "selectedEvaluation.benchmark.overall");
  const byProfile = asRecord(
    benchmark.byProfile,
    "selectedEvaluation.benchmark.byProfile",
  );
  const focusPowerLevel = asRecord(
    byProfile.powerLevel,
    "selectedEvaluation.benchmark.byProfile.powerLevel",
  );
  const overallSummary = comparisonSummary(
    overall,
    "selectedEvaluation.benchmark.overall",
  );
  const focusPowerLevelSummary = comparisonSummary(
    focusPowerLevel,
    "selectedEvaluation.benchmark.byProfile.powerLevel",
  );
  const progress = asRecord(
    benchmark.progress,
    "selectedEvaluation.benchmark.progress",
  );
  if (
    selectedEvaluation.recordHash !== registered.selected.evaluationRecordHash ||
    benchmark.rawResultSha256 !== registered.selected.rawResultSha256 ||
    benchmark.candidateProfileHash !==
      registered.selected.candidateProfileHash ||
    canonicalAiPolicyEvolutionJson(selectedEvaluation.genome) !==
      canonicalAiPolicyEvolutionJson(registered.selected.genome) ||
    constraints.feasible !== registered.selected.feasible ||
    constraints.score !== registered.selected.score ||
    benchmark.promotionAccepted !==
      registered.selected.benchmarkPromotionAccepted ||
    canonicalAiPolicyEvolutionJson(overallSummary) !==
      canonicalAiPolicyEvolutionJson(registered.selected.overall) ||
    canonicalAiPolicyEvolutionJson(focusPowerLevelSummary) !==
      canonicalAiPolicyEvolutionJson(registered.selected.focusPowerLevel) ||
    artifact.selectedCandidateId !== registered.selected.candidateId ||
    canonicalAiPolicyEvolutionJson(artifact.selectedGenome) !==
      canonicalAiPolicyEvolutionJson(registered.selected.genome)
  ) {
    throw new TypeError(
      "historical selected evidence does not match the pinned result registration",
    );
  }
  if (
    benchmark.policyVersion !== registered.evidence.policyVersion ||
    benchmark.contentVersion !== registered.evidence.contentVersion ||
    benchmark.contentSnapshotSha256 !==
      registered.evidence.contentSnapshotSha256 ||
    benchmark.evaluatorHash !== registered.evidence.evaluatorHash ||
    benchmark.strategyProfileHash !== registered.evidence.strategyProfileHash ||
    progress.completedRuns !== registered.evidence.completedRunsPerCandidate ||
    benchmark.expectedPairs !== registered.evidence.expectedPairsPerCandidate ||
    benchmark.runnerFailureCount !== registered.evidence.runnerFailureCount ||
    benchmark.truncatedRuns !== registered.evidence.truncatedRuns ||
    benchmark.missingPairs !== registered.evidence.missingPairs ||
    benchmark.providerErrorTotal !== registered.evidence.providerErrorTotal ||
    artifact.executionKind !== registered.evidence.executionKind ||
    artifact.registeredResumeMode !== registered.evidence.registeredResumeMode ||
    artifact.cachedCandidateCount !== registered.evidence.cachedCandidateCount ||
    artifact.freshCandidateCount !== registered.evidence.freshCandidateCount ||
    artifact.trainingEvidenceUsable !== registered.evidence.trainingEvidenceUsable ||
    artifact.selectionScreenEligible !==
      registered.evidence.selectionScreenEligible
  ) {
    throw new TypeError(
      "historical benchmark provenance does not match the pinned result registration",
    );
  }
  const protocolPayload = asRecord(
    JSON.parse(bundle.sourceSnapshot.protocolCanonicalJson) as unknown,
    "archivedProtocol",
  );
  const executionAuthorization = asRecord(
    protocolPayload.executionAuthorization,
    "archivedProtocol.executionAuthorization",
  );
  const marker = bundle.runMarker as unknown as JsonRecord;
  if (
    marker.registrationId !== registered.registrationId ||
    marker.trainingReservationId !== registered.reservation.id ||
    marker.trainingReservationMode !== registered.reservation.mode ||
    marker.benchmarkStartSeed !== registered.trainingSeeds.startSeed ||
    marker.benchmarkSeeds !== registered.trainingSeeds.seeds ||
    marker.protocolSha256 !== registered.evidence.protocolSha256 ||
    marker.implementationSha256 !== registered.evidence.implementationSha256 ||
    executionAuthorization.confirmation !== registered.reservation.confirmation
  ) {
    throw new TypeError(
      "historical run authorization does not match the pinned result registration",
    );
  }
}

export function readAiCooperativeCemHistoricalTrainingEvidence(
  evidenceDirectory: string,
): Readonly<{
  bundle: AiCooperativeCemTrainingEvidenceBundle;
  manifest: AiCooperativeCemTrainingEvidenceManifest;
  canonicalPayload: string;
  compressed: Uint8Array;
}> {
  const bundlePath = resolve(
    evidenceDirectory,
    AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_BUNDLE_FILENAME,
  );
  const manifestPath = resolve(
    evidenceDirectory,
    AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FILENAME,
  );
  const compressed = readFileSync(bundlePath);
  const canonicalPayload = gunzipSync(compressed).toString("utf8");
  const bundle = JSON.parse(
    canonicalPayload,
  ) as AiCooperativeCemTrainingEvidenceBundle;
  const manifest = readJson(
    manifestPath,
    "cooperative CEM training evidence manifest",
  ) as AiCooperativeCemTrainingEvidenceManifest;
  assertAiCooperativeCemHistoricalTrainingEvidence(
    bundle,
    manifest,
    canonicalPayload,
    compressed,
  );
  assertAiCooperativeCemHistoricalTrainingEvidenceMatchesPinnedResult(
    bundle,
    manifest,
  );
  return Object.freeze({ bundle, manifest, canonicalPayload, compressed });
}
