import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { canonicalHistoricalJsonV1 } from "./ai-historical-canonical-json-v1.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_RESULT,
  computeAiCooperativeCemSelectionResultSha256,
} from "./ai-cooperative-cem-selection-result.ts";

export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_RELATIVE_DIRECTORY =
  "evidence/ai-cooperative-cem-selection/power-level-selection-v1-93100001" as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME =
  "selection-evidence-v1.json.gz" as const;
export const AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FILENAME =
  "manifest.json" as const;

const EXPECTED_IMPLEMENTATION_SHA256 =
  "17bfbb298f9ffc2a5b5f217cb8ec188b6bbb0e725386bba87303f705f9646383";
const EXPECTED_PROTOCOL_SHA256 =
  "5b787b14590f9438f6774732dd02b7464d381b7f752442b12e5c09ca2281f1f3";
const EXPECTED_RESULT_REGISTRATION_ID =
  "cooperative-cem-power-level-selection-result-93100001-v1";
const EXPECTED_REGISTRATION_ID =
  "cooperative-cem-power-level-selection-v1";
const EXPECTED_METHOD = "single-candidate-independent-selection-v1";
const EXPECTED_RESERVATION_ID =
  "cooperative-cem-power-level-selection-93100001-v1";
const EXPECTED_RESERVATION_MODE = "cooperative-cem-selection";
const EXPECTED_CONFIRMATION =
  "run-registered-cooperative-cem-power-level-selection-v1";
const EXPECTED_CONSUMED_LEDGER_ENTRY_ID =
  "cooperative-cem-power-level-selection-93100001-consumed-v1";
const EXPECTED_RETIREMENT_REASON =
  "completed-registered-selection-gate-rejected-artifact-d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b";
const EXPECTED_UPSTREAM_EVALUATOR_HASH =
  "a297f431dadf32e6626c876ccd3390fd8830e7fb9cc1f2bfe8a5084863eec7aa";
const IMPLEMENTATION_HASH_ALGORITHM =
  "sha256-path-null-normalized-utf8-null-v1";
const EXPECTED_GATE = {
  accepted: false,
  reasons: [
    "powerLevel placement mean delta must be at most -0.1",
    "powerLevel placement confidence interval upper bound must be below 0",
    "powerLevel top-four confidence interval lower bound must be at least -0.02",
  ],
};
const EXPECTED_LITERAL_ANCHORS = new Map<string, string>([
  [
    "scripts/ai-cooperative-cem-selection-implementation-pin.ts",
    `export const AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256 =\n  "${EXPECTED_IMPLEMENTATION_SHA256}" as const;\n`,
  ],
  [
    "scripts/ai-cooperative-cem-selection-protocol-pin.ts",
    `export const AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256 =\n  "${EXPECTED_PROTOCOL_SHA256}" as const;\n`,
  ],
]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface JsonRecord {
  readonly [key: string]: unknown;
}

export interface AiCooperativeCemSelectionEvidenceBundle extends JsonRecord {
  readonly formatVersion: number;
  readonly sourceSnapshot: JsonRecord;
  readonly runEvidence: JsonRecord;
}

export interface AiCooperativeCemSelectionEvidenceManifest extends JsonRecord {
  readonly formatVersion: number;
  readonly bundle: JsonRecord;
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

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function asNonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalSha256(value: unknown): string {
  return sha256(canonicalHistoricalJsonV1(value));
}

function withoutProperty(value: JsonRecord, property: string): JsonRecord {
  const result = { ...value };
  delete result[property];
  return result;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertCanonicalEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (
    canonicalHistoricalJsonV1(actual) !== canonicalHistoricalJsonV1(expected)
  ) {
    throw new TypeError(`${label} mismatch`);
  }
}

function sourceEntry(value: unknown, label: string): Readonly<{
  relativePath: string;
  normalizedUtf8: string;
}> {
  const source = asRecord(value, label);
  const relativePath = asString(source.relativePath, `${label}.relativePath`);
  const normalizedUtf8 = asString(
    source.normalizedUtf8,
    `${label}.normalizedUtf8`,
  );
  if (relativePath.includes("\\") || normalizedUtf8.includes("\r")) {
    throw new TypeError(`${label} must use portable paths and normalized text`);
  }
  return { relativePath, normalizedUtf8 };
}

function sourceManifestEntries(values: readonly unknown[]) {
  return values.map((value, index) => {
    const source = sourceEntry(value, `sources[${index}]`);
    return {
      relativePath: source.relativePath,
      normalizedUtf8Bytes: Buffer.byteLength(source.normalizedUtf8, "utf8"),
      normalizedUtf8Sha256: sha256(source.normalizedUtf8),
    };
  });
}

function computeArchivedImplementationSha256(values: readonly unknown[]): string {
  const hash = createHash("sha256");
  hash.update(IMPLEMENTATION_HASH_ALGORITHM).update("\0");
  let previousPath: string | null = null;
  for (const [index, value] of values.entries()) {
    const source = sourceEntry(value, `sources[${index}]`);
    if (
      previousPath !== null &&
      compareAscii(previousPath, source.relativePath) >= 0
    ) {
      throw new TypeError("implementation sources must be uniquely ASCII-sorted");
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

function canonicalFileManifestEntry(value: unknown) {
  const canonicalPayload = canonicalHistoricalJsonV1(value);
  const fileBytes = Buffer.from(`${canonicalPayload}\n`, "utf8");
  return {
    fileBytes: fileBytes.byteLength,
    fileSha256: sha256(fileBytes),
    canonicalPayloadBytes: Buffer.byteLength(canonicalPayload, "utf8"),
    canonicalPayloadSha256: sha256(canonicalPayload),
  };
}

function benchmarkSummaryFromRaw(rawValue: unknown, rawResultSha256: string) {
  const raw = asRecord(rawValue, "rawBenchmarkResult");
  const config = asRecord(raw.config, "rawBenchmarkResult.config");
  const matrix = asRecord(
    raw.comparisonMatrix,
    "rawBenchmarkResult.comparisonMatrix",
  );
  const draw = asRecord(
    raw.drawRateComparison,
    "rawBenchmarkResult.drawRateComparison",
  );
  const runnerFailures = asArray(
    raw.runnerFailures,
    "rawBenchmarkResult.runnerFailures",
  );
  return {
    benchmarkVersion: raw.benchmarkVersion,
    byProfile: matrix.byProfile,
    candidateProfileHash: raw.candidateProfileHash,
    config: {
      initialHealth: config.initialHealth,
      maxRounds: config.maxRounds,
      rotations: config.rotations,
      scenarioIds: config.scenarioIds,
      scoredPlayerIds: config.scoredPlayerIds,
      seeds: config.seeds,
      startSeed: config.startSeed,
    },
    contentSnapshotSha256: raw.contentSnapshotSha256,
    contentVersion: raw.contentVersion,
    drawRateMeanDelta: draw.meanDelta,
    evaluatorHash: raw.evaluatorHash,
    evidenceReasons: raw.evidenceReasons,
    evidenceUsable: raw.evidenceUsable,
    expectedPairs: raw.expectedPairs,
    method: raw.method,
    missingPairs: raw.missingPairs,
    overall: raw.comparisons,
    pairedPairs: raw.pairedPairs,
    policyVersion: raw.policyVersion,
    progress: raw.progress,
    promotionAccepted: raw.accepted,
    providerErrorTotal: raw.providerErrorTotal,
    rawResultSha256,
    runnerFailureCount: runnerFailures.length,
    strategyProfileHash: raw.strategyProfileHash,
    truncatedRuns: raw.truncatedRuns,
  };
}

function assertRawBenchmarkClosure(
  rawValue: unknown,
  protocolValue: JsonRecord,
  registeredSummary: unknown,
  rawResultSha256: string,
): void {
  const raw = asRecord(rawValue, "rawBenchmarkResult");
  const protocolBenchmark = asRecord(protocolValue.benchmark, "protocol.benchmark");
  const expectedProvenance = asRecord(
    protocolValue.expectedProvenance,
    "protocol.expectedProvenance",
  );
  const promotionGate = asRecord(
    protocolValue.promotionGate,
    "protocol.promotionGate",
  );
  const accounting = asRecord(
    promotionGate.accounting,
    "protocol.promotionGate.accounting",
  );
  const config = asRecord(raw.config, "rawBenchmarkResult.config");
  const progress = asRecord(raw.progress, "rawBenchmarkResult.progress");
  const clusters = asArray(raw.clusters, "rawBenchmarkResult.clusters");
  const runnerFailures = asArray(
    raw.runnerFailures,
    "rawBenchmarkResult.runnerFailures",
  );
  const providerDiagnostics = asRecord(
    raw.providerDiagnostics,
    "rawBenchmarkResult.providerDiagnostics",
  );
  if (
    raw.method !== "paired-seven-profile-suite-v1" ||
    raw.benchmarkVersion !== 1 ||
    config.controlPlayerId !== "player-0" ||
    config.profileOverridesProvided !== true ||
    config.residualPolicyProvided !== false ||
    config.initialHealth !== protocolBenchmark.initialHealth ||
    config.maxRounds !== protocolBenchmark.maxRounds ||
    config.seeds !== protocolBenchmark.seeds ||
    config.startSeed !== protocolBenchmark.startSeed
  ) {
    throw new TypeError("historical raw benchmark configuration mismatch");
  }
  for (const property of ["rotations", "scenarioIds", "scoredPlayerIds"] as const) {
    assertCanonicalEqual(
      config[property],
      protocolBenchmark[property],
      `raw benchmark ${property}`,
    );
  }
  if (
    raw.policyVersion !== expectedProvenance.policyVersion ||
    raw.policyVersionAfter !== expectedProvenance.policyVersion ||
    raw.policyVersionStable !== true ||
    raw.contentVersion !== expectedProvenance.contentVersion ||
    raw.contentSnapshotSha256 !== expectedProvenance.contentSnapshotSha256 ||
    raw.contentSnapshotSha256After !== expectedProvenance.contentSnapshotSha256 ||
    raw.contentSnapshotStable !== true ||
    raw.evaluatorHash !== expectedProvenance.evaluatorHash ||
    raw.evaluatorHashAfter !== expectedProvenance.evaluatorHash ||
    raw.evaluatorStable !== true ||
    raw.strategyProfileHash !== expectedProvenance.strategyProfileHash ||
    raw.strategyProfileHashAfter !== expectedProvenance.strategyProfileHash ||
    raw.strategyProfilesStable !== true ||
    raw.candidateProfileHash !== expectedProvenance.candidateProfileHash ||
    raw.candidateProfileHashAfter !== expectedProvenance.candidateProfileHash ||
    raw.candidateProfilesStable !== true
  ) {
    throw new TypeError("historical raw benchmark provenance mismatch");
  }
  if (
    progress.scheduledRuns !== accounting.scheduledRuns ||
    progress.processedRuns !== accounting.scheduledRuns ||
    progress.completedRuns !== accounting.completedRuns ||
    progress.failedRuns !== accounting.failedRuns ||
    raw.expectedPairs !== accounting.expectedPairs ||
    raw.pairedPairs !== accounting.pairedPairs ||
    raw.missingPairs !== accounting.missingPairs ||
    raw.truncatedRuns !== accounting.truncatedRuns ||
    runnerFailures.length !== accounting.runnerFailures ||
    raw.providerErrorTotal !== accounting.providerErrors ||
    providerDiagnostics.providerCalls !== 0 ||
    providerDiagnostics.providerErrors !== 0 ||
    clusters.length !== accounting.seedClusters
  ) {
    throw new TypeError("historical raw benchmark accounting mismatch");
  }
  const startSeed = asNonNegativeInteger(config.startSeed, "config.startSeed");
  for (const [index, clusterValue] of clusters.entries()) {
    const cluster = asRecord(clusterValue, `clusters[${index}]`);
    if (
      cluster.seed !== startSeed + index ||
      asArray(cluster.episodes, `clusters[${index}].episodes`).length !==
        accounting.episodesPerCluster ||
      asArray(cluster.pairs, `clusters[${index}].pairs`).length !==
        accounting.pairsPerCluster
    ) {
      throw new TypeError(`historical raw benchmark cluster ${index} mismatch`);
    }
  }
  const evidenceReasons = asArray(
    raw.evidenceReasons,
    "rawBenchmarkResult.evidenceReasons",
  );
  if (
    raw.evidenceUsable !== true ||
    evidenceReasons.length !== 0 ||
    evidenceReasons.some((reason) => typeof reason !== "string")
  ) {
    throw new TypeError("historical raw benchmark evidence is not usable");
  }
  if (
    typeof raw.accepted !== "boolean" ||
    asArray(raw.acceptanceReasons, "rawBenchmarkResult.acceptanceReasons").some(
      (reason) => typeof reason !== "string",
    )
  ) {
    throw new TypeError("historical generic promotion result is malformed");
  }
  assertCanonicalEqual(
    raw.promotionGate,
    { accepted: raw.accepted, reasons: raw.acceptanceReasons },
    "historical generic promotion gate",
  );
  assertCanonicalEqual(
    registeredSummary,
    benchmarkSummaryFromRaw(raw, rawResultSha256),
    "historical benchmark summary",
  );
}

function validatedMetric(
  value: unknown,
  label: string,
  expectedPairs: number,
): JsonRecord {
  const metric = asRecord(value, label);
  const confidence = asRecord(metric.confidence95, `${label}.confidence95`);
  const mean = asFiniteNumber(metric.meanDelta, `${label}.meanDelta`);
  const lower = asFiniteNumber(confidence.lower, `${label}.confidence95.lower`);
  const upper = asFiniteNumber(confidence.upper, `${label}.confidence95.upper`);
  if (
    metric.seedClusters !== 24 ||
    metric.pairedSeats !== expectedPairs ||
    lower > mean ||
    mean > upper
  ) {
    throw new TypeError(`${label} sample or confidence closure mismatch`);
  }
  return metric;
}

function validatedComparison(
  value: unknown,
  label: string,
  expectedPairs: number,
): Readonly<{
  placement: JsonRecord;
  topFour: JsonRecord;
  win: JsonRecord;
}> {
  const comparison = asRecord(value, label);
  return {
    placement: validatedMetric(
      comparison.placement,
      `${label}.placement`,
      expectedPairs,
    ),
    topFour: validatedMetric(
      comparison.topFour,
      `${label}.topFour`,
      expectedPairs,
    ),
    win: validatedMetric(comparison.win, `${label}.win`, expectedPairs),
  };
}

function confidenceLower(metric: JsonRecord, label: string): number {
  return asFiniteNumber(
    asRecord(metric.confidence95, `${label}.confidence95`).lower,
    `${label}.confidence95.lower`,
  );
}

function confidenceUpper(metric: JsonRecord, label: string): number {
  return asFiniteNumber(
    asRecord(metric.confidence95, `${label}.confidence95`).upper,
    `${label}.confidence95.upper`,
  );
}

function assertSelectionGateClosure(
  rawValue: unknown,
  gateValue: unknown,
  protocolValue: JsonRecord,
): void {
  const raw = asRecord(rawValue, "rawBenchmarkResult");
  const matrix = asRecord(raw.comparisonMatrix, "rawBenchmarkResult.comparisonMatrix");
  const byProfile = asRecord(matrix.byProfile, "comparisonMatrix.byProfile");
  const promotionGate = asRecord(protocolValue.promotionGate, "protocol.promotionGate");
  const accounting = asRecord(
    promotionGate.accounting,
    "promotionGate.accounting",
  );
  const thresholds = asRecord(promotionGate.thresholds, "promotionGate.thresholds");
  const overallThresholds = asRecord(
    thresholds.overall,
    "promotionGate.thresholds.overall",
  );
  const focusThresholds = asRecord(
    thresholds.focus,
    "promotionGate.thresholds.focus",
  );
  const nonFocusThresholds = asRecord(
    thresholds.nonFocus,
    "promotionGate.thresholds.nonFocus",
  );
  const expectedProfileIds = asArray(
    promotionGate.profileIds,
    "promotionGate.profileIds",
  ).map((value, index) => asString(value, `profileIds[${index}]`));
  const actualProfileIds = Object.keys(byProfile).sort(compareAscii);
  if (
    canonicalHistoricalJsonV1(actualProfileIds) !==
    canonicalHistoricalJsonV1([...expectedProfileIds].sort(compareAscii))
  ) {
    throw new TypeError("selection gate profile set mismatch");
  }

  const draw = asRecord(raw.drawRateComparison, "rawBenchmarkResult.drawRateComparison");
  const drawConfidence = asRecord(
    draw.confidence95,
    "rawBenchmarkResult.drawRateComparison.confidence95",
  );
  const drawMean = asFiniteNumber(draw.meanDelta, "drawRateComparison.meanDelta");
  const drawLower = asFiniteNumber(
    drawConfidence.lower,
    "drawRateComparison.confidence95.lower",
  );
  const drawUpper = asFiniteNumber(
    drawConfidence.upper,
    "drawRateComparison.confidence95.upper",
  );
  if (
    draw.seedClusters !== accounting.seedClusters ||
    draw.pairedGames !== accounting.drawPairedGames ||
    drawLower > drawMean ||
    drawMean > drawUpper
  ) {
    throw new TypeError("selection gate draw-rate sample closure mismatch");
  }

  const overall = validatedComparison(
    matrix.overall,
    "overall",
    asNonNegativeInteger(accounting.expectedPairs, "accounting.expectedPairs"),
  );
  assertCanonicalEqual(raw.comparisons, matrix.overall, "raw overall comparison");
  const comparisons = new Map<string, ReturnType<typeof validatedComparison>>();
  for (const profileId of expectedProfileIds) {
    comparisons.set(
      profileId,
      validatedComparison(
        byProfile[profileId],
        profileId,
        asNonNegativeInteger(
          accounting.perProfilePairs,
          "accounting.perProfilePairs",
        ),
      ),
    );
  }

  const reasons: string[] = [];
  if (
    drawUpper >
    asFiniteNumber(
      thresholds.drawRateConfidence95UpperMaximum,
      "draw-rate upper maximum",
    )
  ) {
    reasons.push(
      `selection draw-rate confidence interval upper bound must be at most ${thresholds.drawRateConfidence95UpperMaximum}`,
    );
  }
  if (
    asFiniteNumber(overall.placement.meanDelta, "overall placement mean") >
    asFiniteNumber(
      overallThresholds.placementMeanDeltaMaximum,
      "overall placement mean maximum",
    )
  ) {
    reasons.push(
      `overall placement mean delta must be at most ${overallThresholds.placementMeanDeltaMaximum}`,
    );
  }
  if (
    confidenceUpper(overall.placement, "overall placement") >
    asFiniteNumber(
      overallThresholds.placementConfidence95UpperMaximum,
      "overall placement upper maximum",
    )
  ) {
    reasons.push(
      `overall placement confidence interval upper bound must be at most ${overallThresholds.placementConfidence95UpperMaximum}`,
    );
  }
  if (
    confidenceLower(overall.topFour, "overall topFour") <
    asFiniteNumber(
      overallThresholds.topFourConfidence95LowerMinimum,
      "overall topFour lower minimum",
    )
  ) {
    reasons.push(
      `overall top-four confidence interval lower bound must be at least ${overallThresholds.topFourConfidence95LowerMinimum}`,
    );
  }
  if (
    confidenceLower(overall.win, "overall win") <
    asFiniteNumber(
      overallThresholds.winConfidence95LowerMinimum,
      "overall win lower minimum",
    )
  ) {
    reasons.push(
      `overall win confidence interval lower bound must be at least ${overallThresholds.winConfidence95LowerMinimum}`,
    );
  }

  const focusProfileId = asString(
    promotionGate.focusProfileId,
    "promotionGate.focusProfileId",
  );
  const focus = comparisons.get(focusProfileId);
  if (focus === undefined) throw new TypeError("selection focus profile is missing");
  if (
    asFiniteNumber(focus.placement.meanDelta, `${focusProfileId} placement mean`) >
    asFiniteNumber(
      focusThresholds.placementMeanDeltaMaximum,
      "focus placement mean maximum",
    )
  ) {
    reasons.push(
      `${focusProfileId} placement mean delta must be at most ${focusThresholds.placementMeanDeltaMaximum}`,
    );
  }
  if (
    confidenceUpper(focus.placement, `${focusProfileId} placement`) >=
    asFiniteNumber(
      focusThresholds.placementConfidence95UpperExclusiveMaximum,
      "focus placement upper maximum",
    )
  ) {
    reasons.push(
      `${focusProfileId} placement confidence interval upper bound must be below ${focusThresholds.placementConfidence95UpperExclusiveMaximum}`,
    );
  }
  if (
    confidenceLower(focus.topFour, `${focusProfileId} topFour`) <
    asFiniteNumber(
      focusThresholds.topFourConfidence95LowerMinimum,
      "focus topFour lower minimum",
    )
  ) {
    reasons.push(
      `${focusProfileId} top-four confidence interval lower bound must be at least ${focusThresholds.topFourConfidence95LowerMinimum}`,
    );
  }
  if (
    confidenceLower(focus.win, `${focusProfileId} win`) <
    asFiniteNumber(
      focusThresholds.winConfidence95LowerMinimum,
      "focus win lower minimum",
    )
  ) {
    reasons.push(
      `${focusProfileId} win confidence interval lower bound must be at least ${focusThresholds.winConfidence95LowerMinimum}`,
    );
  }

  for (const [index, value] of asArray(
    promotionGate.nonFocusProfileIds,
    "promotionGate.nonFocusProfileIds",
  ).entries()) {
    const profileId = asString(value, `nonFocusProfileIds[${index}]`);
    const comparison = comparisons.get(profileId);
    if (comparison === undefined) {
      throw new TypeError(`selection non-focus profile ${profileId} is missing`);
    }
    if (
      confidenceUpper(comparison.placement, `${profileId} placement`) >
      asFiniteNumber(
        nonFocusThresholds.placementConfidence95UpperMaximum,
        "non-focus placement upper maximum",
      )
    ) {
      reasons.push(
        `${profileId} placement confidence interval upper bound must be at most ${nonFocusThresholds.placementConfidence95UpperMaximum}`,
      );
    }
    if (
      confidenceLower(comparison.topFour, `${profileId} topFour`) <
      asFiniteNumber(
        nonFocusThresholds.topFourConfidence95LowerMinimum,
        "non-focus topFour lower minimum",
      )
    ) {
      reasons.push(
        `${profileId} top-four confidence interval lower bound must be at least ${nonFocusThresholds.topFourConfidence95LowerMinimum}`,
      );
    }
    if (
      confidenceLower(comparison.win, `${profileId} win`) <
      asFiniteNumber(
        nonFocusThresholds.winConfidence95LowerMinimum,
        "non-focus win lower minimum",
      )
    ) {
      reasons.push(
        `${profileId} win confidence interval lower bound must be at least ${nonFocusThresholds.winConfidence95LowerMinimum}`,
      );
    }
  }
  const expected = { accepted: reasons.length === 0, reasons };
  assertCanonicalEqual(gateValue, expected, "historical selection gate");
  assertCanonicalEqual(gateValue, EXPECTED_GATE, "registered rejected gate");
}

function assertLiteralAnchors(values: readonly unknown[]): void {
  if (values.length !== EXPECTED_LITERAL_ANCHORS.size) {
    throw new TypeError("historical selection evidence must have two literal anchors");
  }
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    const source = sourceEntry(value, `literalAnchors[${index}]`);
    const expected = EXPECTED_LITERAL_ANCHORS.get(source.relativePath);
    if (expected === undefined || expected !== source.normalizedUtf8) {
      throw new TypeError(`historical literal anchor ${source.relativePath} mismatch`);
    }
    if (seen.has(source.relativePath)) {
      throw new TypeError(`duplicate historical literal anchor ${source.relativePath}`);
    }
    seen.add(source.relativePath);
  }
}

function createExpectedManifest(
  bundle: JsonRecord,
  canonicalPayload: string,
  compressed: Uint8Array,
) {
  const snapshot = asRecord(bundle.sourceSnapshot, "bundle.sourceSnapshot");
  const implementationManifest = asRecord(
    snapshot.implementationManifest,
    "sourceSnapshot.implementationManifest",
  );
  const sources = asArray(snapshot.sources, "sourceSnapshot.sources");
  const literalAnchors = asArray(
    snapshot.literalAnchors,
    "sourceSnapshot.literalAnchors",
  );
  const runEvidence = asRecord(bundle.runEvidence, "bundle.runEvidence");
  const sharedMarkerEntry = asRecord(
    runEvidence.sharedMarker,
    "runEvidence.sharedMarker",
  );
  const localMarkerEntry = asRecord(
    runEvidence.localMarker,
    "runEvidence.localMarker",
  );
  const checkpointEntry = asRecord(
    runEvidence.checkpoint,
    "runEvidence.checkpoint",
  );
  const artifactEntry = asRecord(runEvidence.artifact, "runEvidence.artifact");
  const sharedMarker = asRecord(
    sharedMarkerEntry.value,
    "runEvidence.sharedMarker.value",
  );
  const localMarker = asRecord(
    localMarkerEntry.value,
    "runEvidence.localMarker.value",
  );
  const checkpoint = asRecord(checkpointEntry.value, "runEvidence.checkpoint.value");
  const artifact = asRecord(artifactEntry.value, "runEvidence.artifact.value");
  const rawCanonicalJson = canonicalHistoricalJsonV1(checkpoint.rawBenchmarkResult);
  const artifactBenchmark = asRecord(artifact.benchmark, "artifact.benchmark");
  return {
    formatVersion: 1,
    archiveId: bundle.archiveId,
    registrationId: bundle.registrationId,
    reservationId: bundle.reservationId,
    bundle: {
      relativePath: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME,
      compression: "gzip-level-9-mtime-0",
      canonicalJson: "canonical-ai-policy-evolution-json-v1",
      uncompressedBytes: Buffer.byteLength(canonicalPayload, "utf8"),
      compressedBytes: compressed.byteLength,
      payloadSha256: sha256(canonicalPayload),
      blobSha256: sha256(compressed),
    },
    pins: {
      implementationSha256: snapshot.implementationSha256,
      protocolSha256: snapshot.protocolSha256,
      evaluatorSha256: snapshot.evaluatorSha256,
      trainingResultSha256: snapshot.trainingResultSha256,
    },
    protocol: {
      canonicalPayloadBytes: Buffer.byteLength(
        asString(snapshot.protocolCanonicalJson, "protocolCanonicalJson"),
        "utf8",
      ),
      canonicalPayloadSha256: sha256(
        asString(snapshot.protocolCanonicalJson, "protocolCanonicalJson"),
      ),
    },
    markers: {
      shared: {
        scope: "git-common",
        relativePath: sharedMarkerEntry.relativePath,
        ...canonicalFileManifestEntry(sharedMarker),
        markerHash: sharedMarker.markerHash,
      },
      local: {
        scope: "worktree",
        relativePath: localMarkerEntry.relativePath,
        ...canonicalFileManifestEntry(localMarker),
        markerHash: localMarker.markerHash,
      },
      byteIdentical:
        canonicalHistoricalJsonV1(sharedMarker) ===
        canonicalHistoricalJsonV1(localMarker),
      canonicalIdentical:
        canonicalHistoricalJsonV1(sharedMarker) ===
        canonicalHistoricalJsonV1(localMarker),
    },
    checkpoint: {
      relativePath: checkpointEntry.relativePath,
      ...canonicalFileManifestEntry(checkpoint),
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
      relativePath: artifactEntry.relativePath,
      ...canonicalFileManifestEntry(artifact),
      artifactHash: artifact.artifactHash,
      checkpointHash: artifact.checkpointHash,
      markerHash: artifact.markerHash,
      rawResultSha256: artifact.rawResultSha256,
    },
    outcome: {
      executionKind: artifact.executionKind,
      evidenceUsable: artifactBenchmark.evidenceUsable,
      gateAccepted: asRecord(artifact.gate, "artifact.gate").accepted,
      gateCanonicalSha256: canonicalSha256(artifact.gate),
      rosterFinalScreenEligible: artifact.rosterFinalScreenEligible,
    },
    sourceSnapshot: {
      implementationManifestSha256: canonicalSha256(implementationManifest),
      sourceFileCount: sources.length,
      sourceFiles: sourceManifestEntries(sources),
      literalAnchorFileCount: literalAnchors.length,
      literalAnchorFiles: sourceManifestEntries(literalAnchors),
    },
  };
}

export function assertAiCooperativeCemHistoricalSelectionEvidence(
  bundleValue: unknown,
  manifestValue: unknown,
  canonicalPayload: string,
  compressed: Uint8Array,
): void {
  const bundle = asRecord(bundleValue, "selection evidence bundle");
  const manifest = asRecord(manifestValue, "selection evidence manifest");
  if (canonicalHistoricalJsonV1(bundle) !== canonicalPayload) {
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
    compressed[7] !== 0 ||
    !Buffer.from(compressed).equals(
      gzipSync(Buffer.from(canonicalPayload, "utf8"), { level: 9 }),
    )
  ) {
    throw new TypeError("selection evidence gzip is not deterministic level-9 mtime-0");
  }
  if (
    bundle.formatVersion !== 1 ||
    bundle.archiveId !==
      "cooperative-cem-power-level-selection-evidence-93100001-v1" ||
    bundle.registrationId !== EXPECTED_REGISTRATION_ID ||
    bundle.reservationId !== EXPECTED_RESERVATION_ID
  ) {
    throw new TypeError("selection evidence envelope mismatch");
  }

  const snapshot = asRecord(bundle.sourceSnapshot, "bundle.sourceSnapshot");
  const implementationManifest = asRecord(
    snapshot.implementationManifest,
    "sourceSnapshot.implementationManifest",
  );
  const sources = asArray(snapshot.sources, "sourceSnapshot.sources");
  const literalAnchors = asArray(
    snapshot.literalAnchors,
    "sourceSnapshot.literalAnchors",
  );
  if (
    snapshot.implementationSha256 !== EXPECTED_IMPLEMENTATION_SHA256 ||
    implementationManifest.formatVersion !== 1 ||
    implementationManifest.hashAlgorithm !== IMPLEMENTATION_HASH_ALGORITHM ||
    implementationManifest.gameSources !==
      "recursive-lib-game-ts-json-ascii-path-order" ||
    implementationManifest.lineEndings !== "normalize-crlf-and-cr-to-lf" ||
    computeArchivedImplementationSha256(sources) !==
      EXPECTED_IMPLEMENTATION_SHA256
  ) {
    throw new TypeError("historical selection implementation snapshot mismatch");
  }
  const scriptPaths = asArray(
    implementationManifest.scriptPaths,
    "implementationManifest.scriptPaths",
  ).map((value, index) => asString(value, `scriptPaths[${index}]`));
  if (scriptPaths.length !== 17) {
    throw new TypeError("historical selection implementation must include 17 scripts");
  }
  const sourcePaths = sources.map(
    (value, index) => sourceEntry(value, `sources[${index}]`).relativePath,
  );
  if (
    scriptPaths.some((path) => !sourcePaths.includes(path)) ||
    sourcePaths.some(
      (path) =>
        !scriptPaths.includes(path) &&
        !/^lib\/game\/.+\.(?:json|ts)$/.test(path),
    )
  ) {
    throw new TypeError("historical selection source manifest closure mismatch");
  }
  assertLiteralAnchors(literalAnchors);
  assertCanonicalEqual(
    implementationManifest.excludedLiteralAnchorPaths,
    literalAnchors.map(
      (value, index) =>
        sourceEntry(value, `literalAnchors[${index}]`).relativePath,
    ),
    "historical literal anchor paths",
  );

  const protocolCanonicalJson = asString(
    snapshot.protocolCanonicalJson,
    "sourceSnapshot.protocolCanonicalJson",
  );
  let protocolValue: unknown;
  try {
    protocolValue = JSON.parse(protocolCanonicalJson) as unknown;
  } catch (error) {
    throw new TypeError("historical selection protocol is not JSON", {
      cause: error,
    });
  }
  const protocol = asRecord(protocolValue, "historical selection protocol");
  if (
    canonicalHistoricalJsonV1(protocol) !== protocolCanonicalJson ||
    sha256(protocolCanonicalJson) !== EXPECTED_PROTOCOL_SHA256 ||
    snapshot.protocolSha256 !== EXPECTED_PROTOCOL_SHA256 ||
    protocol.id !== bundle.registrationId ||
    protocol.method !== EXPECTED_METHOD
  ) {
    throw new TypeError("historical selection protocol snapshot mismatch");
  }
  const protocolImplementation = asRecord(
    protocol.implementation,
    "protocol.implementation",
  );
  if (
    protocolImplementation.sha256 !== EXPECTED_IMPLEMENTATION_SHA256 ||
    protocolImplementation.hashAlgorithm !== IMPLEMENTATION_HASH_ALGORITHM
  ) {
    throw new TypeError("historical protocol implementation pin mismatch");
  }
  assertCanonicalEqual(
    protocolImplementation.scriptPaths,
    implementationManifest.scriptPaths,
    "protocol implementation script paths",
  );
  assertCanonicalEqual(
    protocolImplementation.excludedLiteralAnchorPaths,
    implementationManifest.excludedLiteralAnchorPaths,
    "protocol literal anchor paths",
  );
  const expectedProvenance = asRecord(
    protocol.expectedProvenance,
    "protocol.expectedProvenance",
  );
  const qualification = asRecord(
    protocol.trainingQualification,
    "protocol.trainingQualification",
  );
  if (
    snapshot.evaluatorSha256 !== expectedProvenance.evaluatorHash ||
    snapshot.trainingResultSha256 !== qualification.resultSha256
  ) {
    throw new TypeError("historical selection evaluator or training pin mismatch");
  }

  const runEvidence = asRecord(bundle.runEvidence, "bundle.runEvidence");
  const sharedMarkerEntry = asRecord(
    runEvidence.sharedMarker,
    "runEvidence.sharedMarker",
  );
  const localMarkerEntry = asRecord(
    runEvidence.localMarker,
    "runEvidence.localMarker",
  );
  const sharedMarker = asRecord(
    sharedMarkerEntry.value,
    "runEvidence.sharedMarker.value",
  );
  const localMarker = asRecord(
    localMarkerEntry.value,
    "runEvidence.localMarker.value",
  );
  if (
    sharedMarkerEntry.scope !== "git-common" ||
    localMarkerEntry.scope !== "worktree" ||
    canonicalHistoricalJsonV1(sharedMarker) !==
      canonicalHistoricalJsonV1(localMarker)
  ) {
    throw new TypeError("historical shared and local markers differ");
  }
  const markerHash = asSha256(sharedMarker.markerHash, "marker.markerHash");
  if (canonicalSha256(withoutProperty(sharedMarker, "markerHash")) !== markerHash) {
    throw new TypeError("historical selection marker hash mismatch");
  }
  const phases = asRecord(protocol.phases, "protocol.phases");
  const selectionPhase = asRecord(phases.selection, "protocol.phases.selection");
  const candidateScope = asRecord(protocol.candidateScope, "protocol.candidateScope");
  if (
    sharedMarker.registrationId !== bundle.registrationId ||
    sharedMarker.protocolSha256 !== EXPECTED_PROTOCOL_SHA256 ||
    sharedMarker.implementationSha256 !== EXPECTED_IMPLEMENTATION_SHA256 ||
    sharedMarker.trainingResultSha256 !== qualification.resultSha256 ||
    sharedMarker.trainingArtifactHash !== qualification.artifactHash ||
    sharedMarker.trainingRunMarkerHash !== qualification.runMarkerHash ||
    sharedMarker.selectedCandidateId !== qualification.selectedCandidateId ||
    sharedMarker.selectedCandidateProfileHash !==
      qualification.selectedCandidateProfileHash ||
    sharedMarker.selectedEvaluationRecordHash !==
      qualification.selectedEvaluationRecordHash ||
    sharedMarker.selectedRawResultSha256 !==
      qualification.selectedRawResultSha256 ||
    sharedMarker.reservationId !== selectionPhase.reservationId ||
    sharedMarker.reservationMode !== selectionPhase.reservationMode ||
    sharedMarker.benchmarkStartSeed !== selectionPhase.startSeed ||
    sharedMarker.benchmarkSeeds !== selectionPhase.seeds ||
    sharedMarker.initialExecutionKind !== "registered" ||
    sharedMarker.initialRunMode !== "fresh"
  ) {
    throw new TypeError("historical selection marker provenance mismatch");
  }
  assertCanonicalEqual(
    sharedMarker.selectedGenome,
    qualification.selectedGenome,
    "historical marker genome",
  );
  assertCanonicalEqual(
    sharedMarker.selectedGenome,
    candidateScope.selectedGenome,
    "historical candidate scope genome",
  );

  const checkpointEntry = asRecord(
    runEvidence.checkpoint,
    "runEvidence.checkpoint",
  );
  const artifactEntry = asRecord(runEvidence.artifact, "runEvidence.artifact");
  const checkpoint = asRecord(checkpointEntry.value, "selection checkpoint");
  const artifact = asRecord(artifactEntry.value, "selection artifact");
  const checkpointHash = asSha256(
    checkpoint.checkpointHash,
    "checkpoint.checkpointHash",
  );
  const rawResultSha256 = asSha256(
    checkpoint.rawResultSha256,
    "checkpoint.rawResultSha256",
  );
  if (
    canonicalSha256(withoutProperty(checkpoint, "checkpointHash")) !==
      checkpointHash ||
    canonicalSha256(checkpoint.rawBenchmarkResult) !== rawResultSha256
  ) {
    throw new TypeError("historical selection checkpoint hash mismatch");
  }
  if (
    checkpoint.formatVersion !== 1 ||
    checkpoint.executionKind !== "registered" ||
    checkpoint.protocolSha256 !== EXPECTED_PROTOCOL_SHA256 ||
    checkpoint.implementationSha256 !== EXPECTED_IMPLEMENTATION_SHA256 ||
    checkpoint.trainingResultSha256 !== qualification.resultSha256 ||
    checkpoint.markerHash !== markerHash ||
    checkpoint.candidateId !== qualification.selectedCandidateId ||
    checkpoint.candidateProfileHash !==
      qualification.selectedCandidateProfileHash
  ) {
    throw new TypeError("historical selection checkpoint provenance mismatch");
  }
  assertCanonicalEqual(
    checkpoint.genome,
    qualification.selectedGenome,
    "historical checkpoint genome",
  );
  assertRawBenchmarkClosure(
    checkpoint.rawBenchmarkResult,
    protocol,
    checkpoint.benchmark,
    rawResultSha256,
  );
  assertSelectionGateClosure(
    checkpoint.rawBenchmarkResult,
    checkpoint.gate,
    protocol,
  );

  const artifactHash = asSha256(artifact.artifactHash, "artifact.artifactHash");
  if (
    canonicalSha256(withoutProperty(artifact, "artifactHash")) !== artifactHash ||
    artifact.formatVersion !== 1 ||
    artifact.method !== EXPECTED_METHOD ||
    artifact.registrationId !== bundle.registrationId ||
    artifact.executionKind !== "registered" ||
    artifact.protocolSha256 !== EXPECTED_PROTOCOL_SHA256 ||
    artifact.implementationSha256 !== EXPECTED_IMPLEMENTATION_SHA256 ||
    artifact.trainingResultSha256 !== qualification.resultSha256 ||
    artifact.markerHash !== markerHash ||
    artifact.checkpointHash !== checkpointHash ||
    artifact.rawResultSha256 !== rawResultSha256 ||
    artifact.candidateId !== checkpoint.candidateId ||
    artifact.candidateProfileHash !== checkpoint.candidateProfileHash ||
    artifact.rosterFinalScreenEligible !== false
  ) {
    throw new TypeError("historical selection artifact provenance mismatch");
  }
  for (const property of ["genome", "benchmark", "gate"] as const) {
    assertCanonicalEqual(
      artifact[property],
      checkpoint[property],
      `historical artifact ${property}`,
    );
  }
  assertSelectionGateClosure(
    checkpoint.rawBenchmarkResult,
    artifact.gate,
    protocol,
  );
  const artifactBenchmark = asRecord(artifact.benchmark, "artifact.benchmark");
  const artifactGate = asRecord(artifact.gate, "artifact.gate");
  if (
    artifactBenchmark.evidenceUsable !== true ||
    asArray(artifactBenchmark.evidenceReasons, "artifact evidenceReasons").length !==
      0 ||
    artifactGate.accepted !== false
  ) {
    throw new TypeError("historical selection artifact eligibility mismatch");
  }

  assertCanonicalEqual(
    manifest,
    createExpectedManifest(bundle, canonicalPayload, compressed),
    "historical selection manifest",
  );
}

function observedRegisteredBenchmark(rawValue: unknown, summaryValue: unknown) {
  const raw = asRecord(rawValue, "rawBenchmarkResult");
  const summary = asRecord(summaryValue, "selection benchmark summary");
  const config = asRecord(raw.config, "rawBenchmarkResult.config");
  const clusters = asArray(raw.clusters, "rawBenchmarkResult.clusters");
  const runnerFailures = asArray(raw.runnerFailures, "rawBenchmarkResult.runnerFailures");
  return {
    method: raw.method,
    benchmarkVersion: raw.benchmarkVersion,
    config: raw.config,
    provenance: {
      policyVersion: raw.policyVersion,
      policyVersionAfter: raw.policyVersionAfter,
      policyVersionStable: raw.policyVersionStable,
      contentVersion: raw.contentVersion,
      contentSnapshotSha256: raw.contentSnapshotSha256,
      contentSnapshotSha256After: raw.contentSnapshotSha256After,
      contentSnapshotStable: raw.contentSnapshotStable,
      evaluatorHash: raw.evaluatorHash,
      evaluatorHashAfter: raw.evaluatorHashAfter,
      evaluatorStable: raw.evaluatorStable,
      strategyProfileHash: raw.strategyProfileHash,
      strategyProfileHashAfter: raw.strategyProfileHashAfter,
      strategyProfilesStable: raw.strategyProfilesStable,
      strategyProfilesCanonicalSha256: canonicalSha256(raw.strategyProfiles),
      candidateProfileHash: raw.candidateProfileHash,
      candidateProfileHashAfter: raw.candidateProfileHashAfter,
      candidateProfilesStable: raw.candidateProfilesStable,
      candidateProfilesCanonicalSha256: canonicalSha256(raw.candidateProfiles),
    },
    accounting: {
      clusterCount: clusters.length,
      clusterStartSeed: clusters.length === 0 ? null : asRecord(clusters[0], "first cluster").seed,
      clusterEndSeed:
        clusters.length === 0
          ? null
          : asRecord(clusters[clusters.length - 1], "last cluster").seed,
      clusterSeedsContiguous: clusters.every(
        (value, index) =>
          asRecord(value, `clusters[${index}]`).seed ===
          asNonNegativeInteger(config.startSeed, "config.startSeed") + index,
      ),
      progress: raw.progress,
      expectedPairs: raw.expectedPairs,
      pairedPairs: raw.pairedPairs,
      missingPairs: raw.missingPairs,
      runnerFailureCount: runnerFailures.length,
      truncatedRuns: raw.truncatedRuns,
      providerErrorTotal: raw.providerErrorTotal,
      providerDiagnosticsCanonicalSha256: canonicalSha256(raw.providerDiagnostics),
      comparisonMatrixCanonicalSha256: canonicalSha256(raw.comparisonMatrix),
      clustersCanonicalSha256: canonicalSha256(raw.clusters),
      evidenceUsable: raw.evidenceUsable,
      evidenceReasons: raw.evidenceReasons,
    },
    draw: {
      baselineDrawRate: raw.baselineDrawRate,
      baselineDrawnGames: raw.baselineDrawnGames,
      candidateDrawRate: raw.candidateDrawRate,
      candidateDrawnGames: raw.candidateDrawnGames,
      comparison: raw.drawRateComparison,
    },
    genericPromotionGate: {
      accepted: raw.accepted,
      reasons: raw.acceptanceReasons,
    },
    overall: summary.overall,
    byProfile: summary.byProfile,
  };
}

export function assertAiCooperativeCemHistoricalSelectionEvidenceMatchesPinnedResult(
  bundleValue: unknown,
  manifestValue: unknown,
): void {
  const registered = AI_COOPERATIVE_CEM_SELECTION_RESULT;
  if (
    computeAiCooperativeCemSelectionResultSha256() !==
      AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256 ||
    registered.resultSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256
  ) {
    throw new TypeError("pinned cooperative CEM selection result drifted");
  }
  // The historical reader deliberately does not import the live training
  // result. Its exact result SHA transitively binds this frozen evaluator
  // literal, while the selection result pin prevents either from drifting.
  if (
    registered.resultRegistrationId !== EXPECTED_RESULT_REGISTRATION_ID ||
    registered.registrationId !== EXPECTED_REGISTRATION_ID ||
    registered.method !== EXPECTED_METHOD ||
    registered.reservation.id !== EXPECTED_RESERVATION_ID ||
    registered.reservation.mode !== EXPECTED_RESERVATION_MODE ||
    registered.reservation.confirmation !== EXPECTED_CONFIRMATION ||
    registered.selectionSeeds.consumedLedgerEntryId !==
      EXPECTED_CONSUMED_LEDGER_ENTRY_ID ||
    registered.selectionSeeds.retirementReason !==
      EXPECTED_RETIREMENT_REASON ||
    registered.upstreamTraining.evaluatorHash !==
      EXPECTED_UPSTREAM_EVALUATOR_HASH
  ) {
    throw new TypeError("pinned historical selection literals mismatch");
  }
  const bundle = asRecord(bundleValue, "selection evidence bundle");
  const manifest = asRecord(manifestValue, "selection evidence manifest");
  const manifestBundle = asRecord(manifest.bundle, "manifest.bundle");
  const manifestPins = asRecord(manifest.pins, "manifest.pins");
  const manifestSource = asRecord(
    manifest.sourceSnapshot,
    "manifest.sourceSnapshot",
  );
  const markers = asRecord(manifest.markers, "manifest.markers");
  const sharedMarkerManifest = asRecord(markers.shared, "manifest.markers.shared");
  const checkpointManifest = asRecord(manifest.checkpoint, "manifest.checkpoint");
  const rawManifest = asRecord(
    checkpointManifest.rawBenchmarkResult,
    "manifest.checkpoint.rawBenchmarkResult",
  );
  const artifactManifest = asRecord(manifest.artifact, "manifest.artifact");
  const outcome = asRecord(manifest.outcome, "manifest.outcome");
  const expectedArchive = {
    directory: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_RELATIVE_DIRECTORY,
    bundleFilename: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME,
    manifestFilename: AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FILENAME,
    compression: manifestBundle.compression,
    canonicalJson: manifestBundle.canonicalJson,
    uncompressedBytes: manifestBundle.uncompressedBytes,
    compressedBytes: manifestBundle.compressedBytes,
    bundlePayloadSha256: manifestBundle.payloadSha256,
    bundleBlobSha256: manifestBundle.blobSha256,
    manifestFileBytes: Buffer.byteLength(
      canonicalHistoricalJsonV1(manifest),
      "utf8",
    ),
    manifestFileSha256: canonicalSha256(manifest),
    archivedImplementationSourceFiles: manifestSource.sourceFileCount,
    archivedLiteralAnchorFiles: manifestSource.literalAnchorFileCount,
  };
  assertCanonicalEqual(registered.archive, expectedArchive, "pinned selection archive");
  const expectedEvidence = {
    protocolSha256: manifestPins.protocolSha256,
    implementationSha256: manifestPins.implementationSha256,
    evaluatorHash: manifestPins.evaluatorSha256,
    registeredRunMarkerHash: sharedMarkerManifest.markerHash,
    markerCanonicalSha256: sharedMarkerManifest.canonicalPayloadSha256,
    markerFileBytes: sharedMarkerManifest.fileBytes,
    markerFileSha256: sharedMarkerManifest.fileSha256,
    checkpointHash: checkpointManifest.checkpointHash,
    checkpointCanonicalSha256: checkpointManifest.canonicalPayloadSha256,
    checkpointFileBytes: checkpointManifest.fileBytes,
    checkpointFileSha256: checkpointManifest.fileSha256,
    rawResultCanonicalBytes: rawManifest.canonicalPayloadBytes,
    rawResultSha256: rawManifest.registeredRawResultSha256,
    artifactHash: artifactManifest.artifactHash,
    artifactCanonicalSha256: artifactManifest.canonicalPayloadSha256,
    artifactFileBytes: artifactManifest.fileBytes,
    artifactFileSha256: artifactManifest.fileSha256,
    gateCanonicalSha256: outcome.gateCanonicalSha256,
    executionKind: outcome.executionKind,
  };
  assertCanonicalEqual(
    registered.evidence,
    expectedEvidence,
    "pinned selection evidence",
  );

  const snapshot = asRecord(bundle.sourceSnapshot, "bundle.sourceSnapshot");
  const protocol = asRecord(
    JSON.parse(asString(snapshot.protocolCanonicalJson, "protocolCanonicalJson")) as unknown,
    "selection protocol",
  );
  const qualification = asRecord(
    protocol.trainingQualification,
    "protocol.trainingQualification",
  );
  const executionAuthorization = asRecord(
    protocol.executionAuthorization,
    "protocol.executionAuthorization",
  );
  if (
    protocol.id !== registered.registrationId ||
    protocol.method !== registered.method ||
    bundle.registrationId !== registered.registrationId ||
    bundle.reservationId !== registered.reservation.id ||
    executionAuthorization.confirmation !== registered.reservation.confirmation
  ) {
    throw new TypeError("pinned selection registration or authorization mismatch");
  }
  const expectedUpstreamSubset = {
    resultRegistrationId: qualification.resultRegistrationId,
    resultSha256: qualification.resultSha256,
    protocolSha256: qualification.oldProtocolSha256,
    implementationSha256: qualification.oldImplementationSha256,
    artifactHash: qualification.artifactHash,
    runMarkerHash: qualification.runMarkerHash,
    selectedEvaluationRecordHash: qualification.selectedEvaluationRecordHash,
    selectedRawResultSha256: qualification.selectedRawResultSha256,
    bundlePayloadSha256: qualification.bundlePayloadSha256,
    bundleBlobSha256: qualification.bundleBlobSha256,
    manifestSha256: qualification.bundleManifestSha256,
  };
  const registeredUpstream = registered.upstreamTraining;
  assertCanonicalEqual(
    {
      resultRegistrationId: registeredUpstream.resultRegistrationId,
      resultSha256: registeredUpstream.resultSha256,
      protocolSha256: registeredUpstream.protocolSha256,
      implementationSha256: registeredUpstream.implementationSha256,
      artifactHash: registeredUpstream.artifactHash,
      runMarkerHash: registeredUpstream.runMarkerHash,
      selectedEvaluationRecordHash:
        registeredUpstream.selectedEvaluationRecordHash,
      selectedRawResultSha256: registeredUpstream.selectedRawResultSha256,
      bundlePayloadSha256: registeredUpstream.bundlePayloadSha256,
      bundleBlobSha256: registeredUpstream.bundleBlobSha256,
      manifestSha256: registeredUpstream.manifestSha256,
    },
    expectedUpstreamSubset,
    "pinned upstream training evidence",
  );

  const runEvidence = asRecord(bundle.runEvidence, "bundle.runEvidence");
  const marker = asRecord(
    asRecord(runEvidence.sharedMarker, "runEvidence.sharedMarker").value,
    "selection marker",
  );
  const checkpoint = asRecord(
    asRecord(runEvidence.checkpoint, "runEvidence.checkpoint").value,
    "selection checkpoint",
  );
  const artifact = asRecord(
    asRecord(runEvidence.artifact, "runEvidence.artifact").value,
    "selection artifact",
  );
  const expectedCandidate = {
    id: artifact.candidateId,
    genome: artifact.genome,
    candidateProfileHash: artifact.candidateProfileHash,
  };
  assertCanonicalEqual(
    registered.candidate,
    expectedCandidate,
    "pinned selection candidate",
  );
  assertCanonicalEqual(
    registered.benchmark,
    observedRegisteredBenchmark(checkpoint.rawBenchmarkResult, artifact.benchmark),
    "pinned selection benchmark",
  );
  assertCanonicalEqual(registered.gate, artifact.gate, "pinned selection gate");
  if (
    registered.status !== "completed-gate-rejected" ||
    registered.rosterFinalScreenEligible !== false ||
    artifact.rosterFinalScreenEligible !== false ||
    outcome.gateAccepted !== false ||
    outcome.evidenceUsable !== true
  ) {
    throw new TypeError("pinned selection outcome mismatch");
  }

  const phases = asRecord(protocol.phases, "protocol.phases");
  const selectionPhase = asRecord(phases.selection, "protocol.phases.selection");
  const rosterFinalPhase = asRecord(phases.rosterFinal, "protocol.phases.rosterFinal");
  if (
    selectionPhase.reservationId !== registered.reservation.id ||
    selectionPhase.reservationMode !== registered.reservation.mode ||
    marker.registrationId !== registered.registrationId ||
    marker.reservationId !== registered.reservation.id ||
    marker.reservationMode !== registered.reservation.mode ||
    registered.selectionSeeds.startSeed !== selectionPhase.startSeed ||
    registered.selectionSeeds.seeds !== selectionPhase.seeds ||
    registered.selectionSeeds.endSeed !== selectionPhase.endSeed ||
    registered.selectionSeeds.dispositionAfterRun !== "consumed" ||
    registered.selectionSeeds.ledgerRegistrationStatus !== "consumed"
  ) {
    throw new TypeError("pinned consumed selection seed range mismatch");
  }
  assertCanonicalEqual(
    registered.nextPhases.rosterFinal,
    rosterFinalPhase,
    "pinned sealed roster-final range",
  );
  const production = asRecord(protocol.production, "protocol.production");
  if (
    registered.production.policyVersion !== production.currentPolicyVersion ||
    registered.production.promoted !== false ||
    registered.production.unchanged !== true
  ) {
    throw new TypeError("pinned unchanged production state mismatch");
  }
}

function readJson(path: string, label: string): unknown {
  const bytes = readFileSync(path);
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new TypeError(`${label} must contain valid UTF-8`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new TypeError(`${label} is not valid JSON`, { cause: error });
  }
  if (canonicalHistoricalJsonV1(value) !== text) {
    throw new TypeError(`${label} must be exact canonical JSON bytes`);
  }
  return value;
}

export function readAiCooperativeCemHistoricalSelectionEvidence(
  evidenceDirectory: string,
): Readonly<{
  bundle: AiCooperativeCemSelectionEvidenceBundle;
  manifest: AiCooperativeCemSelectionEvidenceManifest;
  canonicalPayload: string;
  compressed: Uint8Array;
}> {
  const bundlePath = resolve(
    evidenceDirectory,
    AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_BUNDLE_FILENAME,
  );
  const manifestPath = resolve(
    evidenceDirectory,
    AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_MANIFEST_FILENAME,
  );
  const compressed = readFileSync(bundlePath);
  const canonicalPayload = gunzipSync(compressed).toString("utf8");
  const bundle = JSON.parse(
    canonicalPayload,
  ) as AiCooperativeCemSelectionEvidenceBundle;
  const manifest = readJson(
    manifestPath,
    "cooperative CEM selection evidence manifest",
  ) as AiCooperativeCemSelectionEvidenceManifest;
  assertAiCooperativeCemHistoricalSelectionEvidence(
    bundle,
    manifest,
    canonicalPayload,
    compressed,
  );
  assertAiCooperativeCemHistoricalSelectionEvidenceMatchesPinnedResult(
    bundle,
    manifest,
  );
  return Object.freeze({ bundle, manifest, canonicalPayload, compressed });
}
