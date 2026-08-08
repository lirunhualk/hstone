import { createHash } from "node:crypto";

import {
  getAiStrategyProfile,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
  assertAiCooperativeCemImplementationPinned,
} from "./ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
  AI_COOPERATIVE_CEM_REGISTRATION,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
} from "./ai-cooperative-cem-registration.ts";
import { AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 } from "./ai-cooperative-cem-training-result.ts";
import {
  assertValidAiPolicyEvolutionArtifact,
  canonicalAiPolicyEvolutionJson,
  computeAiPolicyEvolutionArtifactHash,
  createUniformCategoricalDistribution,
  runCategoricalCem,
  validatePolicyGenome,
  type AiPolicyEvolutionArtifact,
  type PolicyGenome,
} from "./ai-policy-evolution.ts";
import {
  AI_POLICY_SUITE_BENCHMARK_VERSION,
  AI_POLICY_SUITE_PLAYER_IDS,
  runAiPolicySuiteBenchmark,
  type AiPolicySuiteBenchmarkProgress,
  type AiPolicySuiteBenchmarkResult,
  type AiPolicySuitePlayerId,
} from "./benchmark-ai-policy-suite.ts";
import type {
  AiRecruitPlannerComparisons,
  MetricComparison,
} from "./benchmark-ai-recruit-planner.ts";

export const AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_TRAINING_METHOD =
  "single-focus-cooperative-categorical-cem-v1" as const;
export const AI_COOPERATIVE_CEM_CHECKPOINT_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_RUN_MARKER_FORMAT_VERSION = 1 as const;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const PROFILE_IDS = Object.freeze([
  "balanced",
  "magnetic",
  "tempo",
  "triple",
  "powerLevel",
  "economy",
  "deathrattle",
] as const satisfies readonly AiStrategyId[]);
const FOCUS_PLAYER_ID = AI_COOPERATIVE_CEM_REGISTRATION.focus
  .playerId as AiPolicySuitePlayerId;
const FOCUS_PROFILE_ID = AI_COOPERATIVE_CEM_REGISTRATION.focus
  .strategyId as AiStrategyId;

export function assertAiCooperativeCemTrainingNotCompleted(): void {
  throw new Error(
    "cooperative CEM training is permanently completed by result " +
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  );
}

export type AiCooperativeCemExecutionKind = "registered" | "injected-test";

export interface AiCooperativeCemRegisteredAuthorization {
  readonly confirmation: typeof AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256;
}

export interface AiCooperativeCemMetricSnapshot {
  readonly pairedSeats: number;
  readonly seedClusters: number;
  readonly meanDelta: number | null;
  readonly confidence95: {
    readonly lower: number;
    readonly upper: number;
  } | null;
}

export interface AiCooperativeCemComparisonSnapshot {
  readonly placement: AiCooperativeCemMetricSnapshot;
  readonly topFour: AiCooperativeCemMetricSnapshot;
  readonly win: AiCooperativeCemMetricSnapshot;
}

export interface AiCooperativeCemBenchmarkEvidence {
  readonly method: AiPolicySuiteBenchmarkResult["method"];
  readonly benchmarkVersion: number;
  readonly rawResultSha256: string;
  readonly policyVersion: string;
  readonly contentVersion: string | null;
  readonly contentSnapshotSha256: string;
  readonly evaluatorHash: string;
  readonly strategyProfileHash: string;
  readonly candidateProfileHash: string;
  readonly config: {
    readonly seeds: number;
    readonly startSeed: number;
    readonly maxRounds: number;
    readonly initialHealth: number;
    readonly scenarioIds: readonly string[];
    readonly rotations: readonly number[];
    readonly scoredPlayerIds: readonly string[];
  };
  readonly progress: {
    readonly processedRuns: number;
    readonly scheduledRuns: number;
    readonly completedRuns: number;
    readonly failedRuns: number;
  };
  readonly expectedPairs: number;
  readonly pairedPairs: number;
  readonly missingPairs: number;
  readonly truncatedRuns: number;
  readonly runnerFailureCount: number;
  readonly providerErrorTotal: number;
  readonly drawRateMeanDelta: number | null;
  readonly evidenceUsable: boolean;
  readonly evidenceReasons: readonly string[];
  readonly promotionAccepted: boolean;
  readonly overall: AiCooperativeCemComparisonSnapshot;
  readonly byProfile: Readonly<
    Record<AiStrategyId, AiCooperativeCemComparisonSnapshot>
  >;
}

export interface AiCooperativeCemConstraintEvaluation {
  readonly feasible: boolean;
  readonly violationCount: number;
  readonly normalizedViolation: number;
  readonly utility: number;
  readonly score: number;
  readonly reasons: readonly string[];
}

export interface AiCooperativeCemCandidateEvaluationPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION;
  readonly protocolSha256: string;
  readonly implementationSha256: string;
  readonly executionKind: AiCooperativeCemExecutionKind;
  readonly candidateId: string;
  readonly generation: number;
  readonly retainedIncumbent: boolean;
  readonly genome: PolicyGenome;
  readonly benchmark: AiCooperativeCemBenchmarkEvidence;
  readonly constraints: AiCooperativeCemConstraintEvaluation;
}

export interface AiCooperativeCemCandidateEvaluation
  extends AiCooperativeCemCandidateEvaluationPayload {
  readonly recordHash: string;
}

export interface AiCooperativeCemTrainingArtifactPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION;
  readonly method: typeof AI_COOPERATIVE_CEM_TRAINING_METHOD;
  readonly protocolId: string;
  readonly protocolSha256: string;
  readonly implementationSha256: string;
  readonly executionKind: AiCooperativeCemExecutionKind;
  readonly evolution: AiPolicyEvolutionArtifact;
  readonly candidateEvaluations: readonly AiCooperativeCemCandidateEvaluation[];
  readonly selectedCandidateId: string;
  readonly selectedGenome: PolicyGenome;
  readonly selectedCandidateFeasible: boolean;
  readonly selectionScreenEligible: boolean;
  readonly registeredResumeMode: "none" | "search-only";
  readonly registeredRunMarkerHash: string | null;
  readonly cachedCandidateCount: number;
  readonly freshCandidateCount: number;
  readonly trainingEvidenceUsable: boolean;
}

export interface AiCooperativeCemTrainingArtifact
  extends AiCooperativeCemTrainingArtifactPayload {
  readonly artifactHash: string;
}

export interface AiCooperativeCemBenchmarkRequest {
  readonly candidateId: string;
  readonly generation: number;
  readonly retainedIncumbent: boolean;
  readonly genome: PolicyGenome;
  readonly profileOverrides: ReadonlyMap<string, AiStrategyProfile>;
  readonly onProgress?: (progress: AiPolicySuiteBenchmarkProgress) => void;
}

export type AiCooperativeCemBenchmarkEvaluator = (
  request: Readonly<AiCooperativeCemBenchmarkRequest>,
) => AiCooperativeCemBenchmarkEvidence;

export interface AiCooperativeCemRegisteredSearchCheckpointPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_CHECKPOINT_FORMAT_VERSION;
  readonly sequenceIndex: number;
  readonly protocolSha256: string;
  readonly implementationSha256: string;
  readonly evaluation: AiCooperativeCemCandidateEvaluation;
  readonly rawBenchmarkResult: AiPolicySuiteBenchmarkResult;
}

export interface AiCooperativeCemRegisteredSearchCheckpoint
  extends AiCooperativeCemRegisteredSearchCheckpointPayload {
  readonly checkpointHash: string;
}

export interface AiCooperativeCemRegisteredRunMarkerPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_RUN_MARKER_FORMAT_VERSION;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256;
  readonly registrationId: typeof AI_COOPERATIVE_CEM_REGISTRATION.id;
  readonly trainingReservationId: typeof AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID;
  readonly trainingReservationMode: typeof AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE;
  readonly benchmarkStartSeed: typeof AI_COOPERATIVE_CEM_REGISTRATION.phases.training.startSeed;
  readonly benchmarkSeeds: typeof AI_COOPERATIVE_CEM_REGISTRATION.phases.training.seeds;
  readonly initialExecutionKind: "registered";
  readonly initialRunMode: "fresh";
  readonly initialRegisteredResumeMode: "none";
}

export interface AiCooperativeCemRegisteredRunMarker
  extends AiCooperativeCemRegisteredRunMarkerPayload {
  readonly markerHash: string;
}

export interface RunAiCooperativeCemTrainingOptions {
  /** Supplying this always labels the artifact injected-test and cannot create evidence. */
  readonly benchmarkEvaluator?: AiCooperativeCemBenchmarkEvaluator;
  /** Required when benchmarkEvaluator is absent; exact values fail closed. */
  readonly registeredAuthorization?: AiCooperativeCemRegisteredAuthorization;
  /** Only accepted together with benchmarkEvaluator. */
  readonly cachedEvaluations?: readonly AiCooperativeCemCandidateEvaluation[];
  /**
   * Registered caches are local search checkpoints, not authenticated game
   * evidence. Callers must opt in and the resulting artifact is ineligible to
   * claim usable training evidence.
   */
  readonly registeredResumeMode?: "search-only";
  /**
   * Registered resume requires the canonical raw result behind every compact
   * record. It remains search-only because local files are integrity evidence,
   * not an authenticated proof that games executed.
   */
  readonly registeredSearchCheckpoints?: readonly AiCooperativeCemRegisteredSearchCheckpoint[];
  /**
   * Required for registered execution. The sink must durably persist the
   * attempt marker before returning; no CEM candidate or game starts first.
   */
  readonly onRegisteredRunStart?: (
    marker: AiCooperativeCemRegisteredRunMarker,
  ) => void;
  readonly onRegisteredSearchCheckpoint?: (
    checkpoint: AiCooperativeCemRegisteredSearchCheckpoint,
  ) => void;
  readonly onBenchmarkProgress?: (
    candidateId: string,
    progress: AiPolicySuiteBenchmarkProgress,
  ) => void;
  readonly onCandidateEvaluation?: (
    evaluation: AiCooperativeCemCandidateEvaluation,
  ) => void;
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(value))
    .digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 1e12) / 1e12;
}

function metricSnapshot(
  comparison: MetricComparison,
): AiCooperativeCemMetricSnapshot {
  return {
    pairedSeats: comparison.pairedSeats,
    seedClusters: comparison.seedClusters,
    meanDelta: comparison.meanDelta,
    confidence95: comparison.confidence95
      ? { ...comparison.confidence95 }
      : null,
  };
}

function comparisonSnapshot(
  comparison: AiRecruitPlannerComparisons,
): AiCooperativeCemComparisonSnapshot {
  return {
    placement: metricSnapshot(comparison.placement),
    topFour: metricSnapshot(comparison.topFour),
    win: metricSnapshot(comparison.win),
  };
}

export function summarizeAiCooperativeCemBenchmarkResult(
  result: AiPolicySuiteBenchmarkResult,
): AiCooperativeCemBenchmarkEvidence {
  const byProfile = {} as Record<
    AiStrategyId,
    AiCooperativeCemComparisonSnapshot
  >;
  for (const profileId of PROFILE_IDS) {
    const comparison = result.comparisonMatrix.byProfile[profileId];
    if (!comparison) {
      throw new Error(`policy suite result is missing profile ${profileId}`);
    }
    byProfile[profileId] = comparisonSnapshot(comparison);
  }
  return deepFreeze({
    method: result.method,
    benchmarkVersion: result.benchmarkVersion,
    rawResultSha256: hashCanonical(result),
    policyVersion: result.policyVersion,
    contentVersion: result.contentVersion,
    contentSnapshotSha256: result.contentSnapshotSha256,
    evaluatorHash: result.evaluatorHash,
    strategyProfileHash: result.strategyProfileHash,
    candidateProfileHash: result.candidateProfileHash,
    config: {
      seeds: result.config.seeds,
      startSeed: result.config.startSeed,
      maxRounds: result.config.maxRounds,
      initialHealth: result.config.initialHealth,
      scenarioIds: [...result.config.scenarioIds],
      rotations: [...result.config.rotations],
      scoredPlayerIds: [...result.config.scoredPlayerIds],
    },
    progress: { ...result.progress },
    expectedPairs: result.expectedPairs,
    pairedPairs: result.pairedPairs,
    missingPairs: result.missingPairs,
    truncatedRuns: result.truncatedRuns,
    runnerFailureCount: result.runnerFailures.length,
    providerErrorTotal: result.providerErrorTotal,
    drawRateMeanDelta: result.drawRateComparison.meanDelta,
    evidenceUsable: result.evidenceUsable,
    evidenceReasons: [...result.evidenceReasons],
    promotionAccepted: result.accepted,
    overall: comparisonSnapshot(result.comparisonMatrix.overall),
    byProfile,
  });
}

export function buildAiCooperativeCemProfileOverrides(
  genome: PolicyGenome,
): ReadonlyMap<string, AiStrategyProfile> {
  validatePolicyGenome(
    genome,
    AI_COOPERATIVE_CEM_REGISTRATION.genes,
    "cooperativeCemGenome",
  );
  const overrides = new Map<string, AiStrategyProfile>();
  for (const playerId of AI_POLICY_SUITE_PLAYER_IDS) {
    const baseline = getAiStrategyProfile(playerId);
    overrides.set(
      playerId,
      Object.freeze(
        playerId === FOCUS_PLAYER_ID
          ? {
              ...baseline,
              upgradeRoundOffset: genome.upgradeRoundOffset,
              minimumUpgradeHealth: genome.minimumUpgradeHealth,
              replacementMargin: genome.replacementMargin,
              maxRefreshes: genome.maxRefreshes,
            }
          : { ...baseline },
      ),
    );
  }
  return overrides;
}

export function computeAiCooperativeCemCandidateProfileHash(
  genome: PolicyGenome,
): string {
  const overrides = buildAiCooperativeCemProfileOverrides(genome);
  const snapshots = AI_POLICY_SUITE_PLAYER_IDS.map((playerId) => ({
    playerId,
    profile: overrides.get(playerId),
  }));
  return createHash("sha256")
    .update(JSON.stringify(snapshots))
    .digest("hex");
}

function requireMean(
  comparison: AiCooperativeCemMetricSnapshot,
  label: string,
  reasons: string[],
): number {
  if (comparison.meanDelta === null || !Number.isFinite(comparison.meanDelta)) {
    reasons.push(`${label} mean delta is missing`);
    return AI_COOPERATIVE_CEM_REGISTRATION.objective.violationNormalization
      .missingMeanDeltaFallback;
  }
  return comparison.meanDelta;
}

function addMaximumViolation(
  value: number,
  maximum: number,
  scale: number,
  label: string,
  reasons: string[],
): number {
  if (value <= maximum) return 0;
  reasons.push(`${label} must be at most ${maximum}`);
  return (value - maximum) / scale;
}

function addMinimumViolation(
  value: number,
  minimum: number,
  scale: number,
  label: string,
  reasons: string[],
): number {
  if (value >= minimum) return 0;
  reasons.push(`${label} must be at least ${minimum}`);
  return (minimum - value) / scale;
}

export function evaluateAiCooperativeCemConstraints(
  evidence: AiCooperativeCemBenchmarkEvidence,
): AiCooperativeCemConstraintEvaluation {
  const reasons: string[] = [];
  let normalizedViolation = 0;
  if (!evidence.evidenceUsable) {
    reasons.push("policy suite evidence is unusable");
    normalizedViolation +=
      AI_COOPERATIVE_CEM_REGISTRATION.objective.violationNormalization
        .evidenceUnusableNormalizedPenalty;
  }
  const registered = AI_COOPERATIVE_CEM_REGISTRATION.objective;
  const overallPlacement = requireMean(
    evidence.overall.placement,
    "overall placement",
    reasons,
  );
  const focus = evidence.byProfile[FOCUS_PROFILE_ID];
  const focusPlacement = requireMean(
    focus.placement,
    `${FOCUS_PROFILE_ID} placement`,
    reasons,
  );
  const focusTopFour = requireMean(
    focus.topFour,
    `${FOCUS_PROFILE_ID} top-four`,
    reasons,
  );
  const focusWin = requireMean(
    focus.win,
    `${FOCUS_PROFILE_ID} win`,
    reasons,
  );
  normalizedViolation += addMaximumViolation(
    overallPlacement,
    registered.feasibility.overallPlacementMeanDeltaMaximum,
    registered.violationNormalization.placementScale,
    "overall placement mean delta",
    reasons,
  );
  normalizedViolation += addMinimumViolation(
    focusTopFour,
    registered.feasibility.focusTopFourMeanDeltaMinimum,
    registered.violationNormalization.rateScale,
    `${FOCUS_PROFILE_ID} top-four mean delta`,
    reasons,
  );
  normalizedViolation += addMinimumViolation(
    focusWin,
    registered.feasibility.focusWinMeanDeltaMinimum,
    registered.violationNormalization.rateScale,
    `${FOCUS_PROFILE_ID} win mean delta`,
    reasons,
  );
  for (const profileId of PROFILE_IDS) {
    if (profileId === FOCUS_PROFILE_ID) continue;
    const profile = evidence.byProfile[profileId];
    const placement = requireMean(
      profile.placement,
      `${profileId} placement`,
      reasons,
    );
    const topFour = requireMean(
      profile.topFour,
      `${profileId} top-four`,
      reasons,
    );
    const win = requireMean(profile.win, `${profileId} win`, reasons);
    normalizedViolation += addMaximumViolation(
      placement,
      registered.feasibility.nonFocusPlacementMeanDeltaMaximum,
      registered.violationNormalization.placementScale,
      `${profileId} placement mean delta`,
      reasons,
    );
    normalizedViolation += addMinimumViolation(
      topFour,
      registered.feasibility.nonFocusTopFourMeanDeltaMinimum,
      registered.violationNormalization.rateScale,
      `${profileId} top-four mean delta`,
      reasons,
    );
    normalizedViolation += addMinimumViolation(
      win,
      registered.feasibility.nonFocusWinMeanDeltaMinimum,
      registered.violationNormalization.rateScale,
      `${profileId} win mean delta`,
      reasons,
    );
  }
  const weights = registered.scoreEncoding.utilityWeights;
  const utility = round(
    focusPlacement * weights.focusPlacement +
      focusTopFour * weights.focusTopFour +
      focusWin * weights.focusWin +
      overallPlacement * weights.overallPlacement,
  );
  const feasible = reasons.length === 0;
  const score = feasible
    ? registered.scoreEncoding.feasibleBase + utility
    : registered.scoreEncoding.infeasibleBase -
      reasons.length * registered.scoreEncoding.violationCountPenalty -
      normalizedViolation *
        registered.scoreEncoding.normalizedViolationPenalty +
      utility;
  return deepFreeze({
    feasible,
    violationCount: reasons.length,
    normalizedViolation: round(normalizedViolation),
    utility,
    score: round(score),
    reasons,
  });
}

function createCandidateEvaluation(
  executionKind: AiCooperativeCemExecutionKind,
  candidateId: string,
  generation: number,
  retainedIncumbent: boolean,
  genome: PolicyGenome,
  benchmark: AiCooperativeCemBenchmarkEvidence,
): AiCooperativeCemCandidateEvaluation {
  const constraints = evaluateAiCooperativeCemConstraints(benchmark);
  const payload: AiCooperativeCemCandidateEvaluationPayload = {
    formatVersion: AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION,
    protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    executionKind,
    candidateId,
    generation,
    retainedIncumbent,
    genome: { ...genome },
    benchmark,
    constraints,
  };
  return deepFreeze({ ...payload, recordHash: hashCanonical(payload) });
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lower-case SHA-256 hash`);
  }
}

function registeredRunMarkerPayload(): AiCooperativeCemRegisteredRunMarkerPayload {
  const training = AI_COOPERATIVE_CEM_REGISTRATION.phases.training;
  return {
    formatVersion: AI_COOPERATIVE_CEM_RUN_MARKER_FORMAT_VERSION,
    protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    registrationId: AI_COOPERATIVE_CEM_REGISTRATION.id,
    trainingReservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
    trainingReservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
    benchmarkStartSeed: training.startSeed,
    benchmarkSeeds: training.seeds,
    initialExecutionKind: "registered",
    initialRunMode: "fresh",
    initialRegisteredResumeMode: "none",
  };
}

export function computeAiCooperativeCemRegisteredRunMarkerHash(
  value:
    | AiCooperativeCemRegisteredRunMarkerPayload
    | AiCooperativeCemRegisteredRunMarker,
): string {
  const { markerHash: _markerHash, ...payload } =
    value as AiCooperativeCemRegisteredRunMarker;
  void _markerHash;
  return hashCanonical(payload);
}

export function assertValidAiCooperativeCemRegisteredRunMarker(
  value: AiCooperativeCemRegisteredRunMarker,
): void {
  assertSha256(value.markerHash, "registeredRunMarker.markerHash");
  const { markerHash: _markerHash, ...payload } = value;
  void _markerHash;
  if (
    canonicalAiPolicyEvolutionJson(payload) !==
    canonicalAiPolicyEvolutionJson(registeredRunMarkerPayload())
  ) {
    throw new TypeError("registered run marker does not match registration");
  }
  if (
    computeAiCooperativeCemRegisteredRunMarkerHash(value) !== value.markerHash
  ) {
    throw new TypeError("registered run marker hash mismatch");
  }
}

export function createAiCooperativeCemRegisteredRunMarker(): AiCooperativeCemRegisteredRunMarker {
  const payload = registeredRunMarkerPayload();
  const marker = deepFreeze({
    ...payload,
    markerHash: computeAiCooperativeCemRegisteredRunMarkerHash(payload),
  });
  assertValidAiCooperativeCemRegisteredRunMarker(marker);
  return marker;
}

function assertNonNegativeSafeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function assertFiniteRange(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new TypeError(`${label} must be finite from ${minimum} to ${maximum}`);
  }
  return value;
}

function assertMetricContract(
  metric: AiCooperativeCemMetricSnapshot,
  label: string,
  maximumAbsoluteMean: number,
  maximumPairedSeats: number,
  evidenceUsable: boolean,
): void {
  const pairedSeats = assertNonNegativeSafeInteger(
    metric.pairedSeats,
    `${label}.pairedSeats`,
  );
  const seedClusters = assertNonNegativeSafeInteger(
    metric.seedClusters,
    `${label}.seedClusters`,
  );
  if (
    pairedSeats > maximumPairedSeats ||
    seedClusters > AI_COOPERATIVE_CEM_REGISTRATION.phases.training.seeds
  ) {
    throw new RangeError(`${label} sample counts exceed the registered screen`);
  }
  if (metric.meanDelta === null) {
    if (metric.confidence95 !== null) {
      throw new TypeError(`${label} cannot have a CI without a mean`);
    }
  } else {
    assertFiniteRange(
      metric.meanDelta,
      -maximumAbsoluteMean,
      maximumAbsoluteMean,
      `${label}.meanDelta`,
    );
    if (metric.confidence95 !== null) {
      const lower = assertFiniteRange(
        metric.confidence95.lower,
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
        `${label}.confidence95.lower`,
      );
      const upper = assertFiniteRange(
        metric.confidence95.upper,
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
        `${label}.confidence95.upper`,
      );
      if (lower > upper) {
        throw new RangeError(`${label} confidence interval is reversed`);
      }
      if (metric.meanDelta < lower || metric.meanDelta > upper) {
        throw new RangeError(`${label} confidence interval excludes its mean`);
      }
    }
  }
  if (
    evidenceUsable &&
    (pairedSeats !== maximumPairedSeats ||
      seedClusters !== AI_COOPERATIVE_CEM_REGISTRATION.phases.training.seeds ||
      metric.meanDelta === null ||
      metric.confidence95 === null)
  ) {
    throw new TypeError(`${label} usable evidence is incomplete`);
  }
}

function assertComparisonContract(
  comparison: AiCooperativeCemComparisonSnapshot,
  label: string,
  maximumPairedSeats: number,
  evidenceUsable: boolean,
): void {
  assertMetricContract(
    comparison.placement,
    `${label}.placement`,
    7,
    maximumPairedSeats,
    evidenceUsable,
  );
  assertMetricContract(
    comparison.topFour,
    `${label}.topFour`,
    1,
    maximumPairedSeats,
    evidenceUsable,
  );
  assertMetricContract(
    comparison.win,
    `${label}.win`,
    1,
    maximumPairedSeats,
    evidenceUsable,
  );
}

function assertBenchmarkContract(
  benchmark: AiCooperativeCemBenchmarkEvidence,
  genome?: PolicyGenome,
): void {
  const registered = AI_COOPERATIVE_CEM_REGISTRATION;
  for (const [value, label] of [
    [benchmark.rawResultSha256, "benchmark.rawResultSha256"],
    [benchmark.contentSnapshotSha256, "benchmark.contentSnapshotSha256"],
    [benchmark.evaluatorHash, "benchmark.evaluatorHash"],
    [benchmark.strategyProfileHash, "benchmark.strategyProfileHash"],
    [benchmark.candidateProfileHash, "benchmark.candidateProfileHash"],
  ] as const) {
    assertSha256(value, label);
  }
  if (
    benchmark.method !== "paired-seven-profile-suite-v1" ||
    benchmark.benchmarkVersion !== AI_POLICY_SUITE_BENCHMARK_VERSION
  ) {
    throw new TypeError("candidate benchmark method or version is invalid");
  }
  if (
    typeof benchmark.policyVersion !== "string" ||
    benchmark.policyVersion.length === 0 ||
    (benchmark.contentVersion !== null &&
      (typeof benchmark.contentVersion !== "string" ||
        benchmark.contentVersion.length === 0))
  ) {
    throw new TypeError("candidate benchmark version provenance is invalid");
  }
  if (
    typeof benchmark.evidenceUsable !== "boolean" ||
    !Array.isArray(benchmark.evidenceReasons) ||
    benchmark.evidenceReasons.some((reason) => typeof reason !== "string") ||
    benchmark.evidenceUsable !== (benchmark.evidenceReasons.length === 0) ||
    typeof benchmark.promotionAccepted !== "boolean" ||
    benchmark.promotionAccepted
  ) {
    throw new TypeError("candidate benchmark evidence flags are invalid");
  }
  if (
    benchmark.config.seeds !== registered.phases.training.seeds ||
    benchmark.config.startSeed !== registered.phases.training.startSeed ||
    benchmark.config.maxRounds !== registered.benchmark.maxRounds ||
    benchmark.config.initialHealth !== registered.benchmark.initialHealth ||
    canonicalAiPolicyEvolutionJson(benchmark.config.scenarioIds) !==
      canonicalAiPolicyEvolutionJson(registered.benchmark.scenarioIds) ||
    canonicalAiPolicyEvolutionJson(benchmark.config.rotations) !==
      canonicalAiPolicyEvolutionJson(registered.benchmark.rotations) ||
    canonicalAiPolicyEvolutionJson(benchmark.config.scoredPlayerIds) !==
      canonicalAiPolicyEvolutionJson(registered.benchmark.scoredPlayerIds)
  ) {
    throw new TypeError("candidate benchmark does not match registered config");
  }
  const scheduledRuns =
    registered.phases.training.seeds *
    registered.benchmark.scenarioIds.length *
    registered.benchmark.rotations.length *
    2;
  const expectedPairs =
    registered.phases.training.seeds *
    registered.benchmark.scenarioIds.length *
    registered.benchmark.rotations.length *
    registered.benchmark.scoredPlayerIds.length;
  const expectedProfilePairs =
    registered.phases.training.seeds *
    registered.benchmark.scenarioIds.length *
    registered.benchmark.rotations.length;
  const processedRuns = assertNonNegativeSafeInteger(
    benchmark.progress.processedRuns,
    "benchmark.progress.processedRuns",
  );
  const reportedScheduledRuns = assertNonNegativeSafeInteger(
    benchmark.progress.scheduledRuns,
    "benchmark.progress.scheduledRuns",
  );
  const completedRuns = assertNonNegativeSafeInteger(
    benchmark.progress.completedRuns,
    "benchmark.progress.completedRuns",
  );
  const failedRuns = assertNonNegativeSafeInteger(
    benchmark.progress.failedRuns,
    "benchmark.progress.failedRuns",
  );
  const reportedExpectedPairs = assertNonNegativeSafeInteger(
    benchmark.expectedPairs,
    "benchmark.expectedPairs",
  );
  const pairedPairs = assertNonNegativeSafeInteger(
    benchmark.pairedPairs,
    "benchmark.pairedPairs",
  );
  const missingPairs = assertNonNegativeSafeInteger(
    benchmark.missingPairs,
    "benchmark.missingPairs",
  );
  const truncatedRuns = assertNonNegativeSafeInteger(
    benchmark.truncatedRuns,
    "benchmark.truncatedRuns",
  );
  const runnerFailureCount = assertNonNegativeSafeInteger(
    benchmark.runnerFailureCount,
    "benchmark.runnerFailureCount",
  );
  const providerErrorTotal = assertNonNegativeSafeInteger(
    benchmark.providerErrorTotal,
    "benchmark.providerErrorTotal",
  );
  if (
    reportedScheduledRuns !== scheduledRuns ||
    processedRuns > scheduledRuns ||
    completedRuns > processedRuns ||
    failedRuns !== runnerFailureCount ||
    reportedExpectedPairs !== expectedPairs ||
    pairedPairs + missingPairs !== expectedPairs ||
    completedRuns + truncatedRuns > processedRuns ||
    runnerFailureCount < processedRuns - completedRuns - truncatedRuns
  ) {
    throw new TypeError("candidate benchmark run or pair accounting is invalid");
  }
  if (benchmark.drawRateMeanDelta !== null) {
    assertFiniteRange(
      benchmark.drawRateMeanDelta,
      -1,
      1,
      "benchmark.drawRateMeanDelta",
    );
  }
  if (
    benchmark.evidenceUsable &&
    (processedRuns !== scheduledRuns ||
      completedRuns !== scheduledRuns ||
      failedRuns !== 0 ||
      pairedPairs !== expectedPairs ||
      missingPairs !== 0 ||
      truncatedRuns !== 0 ||
      runnerFailureCount !== 0 ||
      providerErrorTotal !== 0 ||
      benchmark.drawRateMeanDelta === null)
  ) {
    throw new TypeError("candidate benchmark claims usable incomplete evidence");
  }
  const profileKeys = Object.keys(benchmark.byProfile).sort();
  const expectedProfileKeys = [...PROFILE_IDS].sort();
  if (
    canonicalAiPolicyEvolutionJson(profileKeys) !==
    canonicalAiPolicyEvolutionJson(expectedProfileKeys)
  ) {
    throw new TypeError("candidate benchmark profile set is invalid");
  }
  assertComparisonContract(
    benchmark.overall,
    "benchmark.overall",
    expectedPairs,
    benchmark.evidenceUsable,
  );
  for (const profileId of PROFILE_IDS) {
    const comparison = benchmark.byProfile[profileId];
    if (!comparison) {
      throw new TypeError(`candidate benchmark is missing ${profileId}`);
    }
    assertComparisonContract(
      comparison,
      `benchmark.byProfile.${profileId}`,
      expectedProfilePairs,
      benchmark.evidenceUsable,
    );
  }
  if (
    genome !== undefined &&
    benchmark.candidateProfileHash !==
      computeAiCooperativeCemCandidateProfileHash(genome)
  ) {
    throw new TypeError("candidate benchmark profile hash does not match genome");
  }
}

export function assertValidAiCooperativeCemCandidateEvaluation(
  value: AiCooperativeCemCandidateEvaluation,
): void {
  if (value.formatVersion !== AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION) {
    throw new TypeError("candidate evaluation formatVersion mismatch");
  }
  if (value.protocolSha256 !== AI_COOPERATIVE_CEM_PROTOCOL_SHA256) {
    throw new TypeError("candidate evaluation protocol hash mismatch");
  }
  if (value.implementationSha256 !== AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256) {
    throw new TypeError("candidate evaluation implementation hash mismatch");
  }
  if (value.executionKind !== "registered" && value.executionKind !== "injected-test") {
    throw new TypeError("candidate evaluation executionKind is invalid");
  }
  if (!Number.isSafeInteger(value.generation) || value.generation < 0) {
    throw new TypeError("candidate evaluation generation is invalid");
  }
  validatePolicyGenome(
    value.genome,
    AI_COOPERATIVE_CEM_REGISTRATION.genes,
    "candidateEvaluation.genome",
  );
  assertBenchmarkContract(value.benchmark, value.genome);
  const expectedConstraints = evaluateAiCooperativeCemConstraints(value.benchmark);
  if (
    canonicalAiPolicyEvolutionJson(value.constraints) !==
    canonicalAiPolicyEvolutionJson(expectedConstraints)
  ) {
    throw new TypeError("candidate evaluation constraints do not match benchmark");
  }
  assertSha256(value.recordHash, "candidateEvaluation.recordHash");
  const { recordHash: _recordHash, ...payload } = value;
  if (hashCanonical(payload) !== value.recordHash) {
    throw new TypeError("candidate evaluation recordHash mismatch");
  }
}

export function computeAiCooperativeCemCheckpointHash(
  value:
    | AiCooperativeCemRegisteredSearchCheckpointPayload
    | AiCooperativeCemRegisteredSearchCheckpoint,
): string {
  const { checkpointHash: _checkpointHash, ...payload } =
    value as AiCooperativeCemRegisteredSearchCheckpoint;
  return hashCanonical(payload);
}

function createAiCooperativeCemRegisteredSearchCheckpoint(
  sequenceIndex: number,
  evaluation: AiCooperativeCemCandidateEvaluation,
  rawBenchmarkResult: AiPolicySuiteBenchmarkResult,
): AiCooperativeCemRegisteredSearchCheckpoint {
  const payload: AiCooperativeCemRegisteredSearchCheckpointPayload = {
    formatVersion: AI_COOPERATIVE_CEM_CHECKPOINT_FORMAT_VERSION,
    sequenceIndex,
    protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    evaluation,
    rawBenchmarkResult,
  };
  const checkpoint = deepFreeze({
    ...payload,
    checkpointHash: computeAiCooperativeCemCheckpointHash(payload),
  });
  assertAiCooperativeCemCheckpointMatchesRawResult(checkpoint);
  return checkpoint;
}

export function assertAiCooperativeCemCheckpointMatchesRawResult(
  checkpoint: AiCooperativeCemRegisteredSearchCheckpoint,
): void {
  if (
    checkpoint.formatVersion !== AI_COOPERATIVE_CEM_CHECKPOINT_FORMAT_VERSION ||
    !Number.isSafeInteger(checkpoint.sequenceIndex) ||
    checkpoint.sequenceIndex < 0 ||
    checkpoint.protocolSha256 !== AI_COOPERATIVE_CEM_PROTOCOL_SHA256 ||
    checkpoint.implementationSha256 !==
      AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256
  ) {
    throw new TypeError("registered checkpoint envelope is invalid");
  }
  assertValidAiCooperativeCemCandidateEvaluation(checkpoint.evaluation);
  if (checkpoint.evaluation.executionKind !== "registered") {
    throw new TypeError("registered checkpoint execution kind mismatch");
  }
  const summarized = summarizeAiCooperativeCemBenchmarkResult(
    checkpoint.rawBenchmarkResult,
  );
  if (
    canonicalAiPolicyEvolutionJson(summarized) !==
    canonicalAiPolicyEvolutionJson(checkpoint.evaluation.benchmark)
  ) {
    throw new TypeError("registered checkpoint raw benchmark mismatch");
  }
  assertSha256(checkpoint.checkpointHash, "checkpoint.checkpointHash");
  if (
    computeAiCooperativeCemCheckpointHash(checkpoint) !==
    checkpoint.checkpointHash
  ) {
    throw new TypeError("registered checkpoint hash mismatch");
  }
}

function benchmarkProvenance(
  evaluation: AiCooperativeCemCandidateEvaluation,
): unknown {
  const benchmark = evaluation.benchmark;
  return {
    implementationSha256: evaluation.implementationSha256,
    method: benchmark.method,
    benchmarkVersion: benchmark.benchmarkVersion,
    policyVersion: benchmark.policyVersion,
    contentVersion: benchmark.contentVersion,
    contentSnapshotSha256: benchmark.contentSnapshotSha256,
    evaluatorHash: benchmark.evaluatorHash,
    strategyProfileHash: benchmark.strategyProfileHash,
    config: benchmark.config,
  };
}

function assertMatchingBenchmarkProvenance(
  anchor: AiCooperativeCemCandidateEvaluation,
  candidate: AiCooperativeCemCandidateEvaluation,
): void {
  if (
    canonicalAiPolicyEvolutionJson(benchmarkProvenance(candidate)) !==
    canonicalAiPolicyEvolutionJson(benchmarkProvenance(anchor))
  ) {
    throw new TypeError(
      `candidate ${candidate.candidateId} benchmark provenance drifted`,
    );
  }
}

export function assertAiCooperativeCemRegisteredCheckpointPrefix(
  checkpoints: readonly AiCooperativeCemRegisteredSearchCheckpoint[],
): void {
  const seenCandidateIds = new Set<string>();
  let provenanceAnchor: AiCooperativeCemCandidateEvaluation | null = null;
  for (const [index, checkpoint] of checkpoints.entries()) {
    assertAiCooperativeCemCheckpointMatchesRawResult(checkpoint);
    if (checkpoint.sequenceIndex !== index) {
      throw new TypeError(
        `registered checkpoint sequence must be contiguous at index ${index}`,
      );
    }
    if (seenCandidateIds.has(checkpoint.evaluation.candidateId)) {
      throw new TypeError(
        `duplicate registered checkpoint candidate ${checkpoint.evaluation.candidateId}`,
      );
    }
    seenCandidateIds.add(checkpoint.evaluation.candidateId);
    if (provenanceAnchor === null) {
      provenanceAnchor = checkpoint.evaluation;
    } else {
      assertMatchingBenchmarkProvenance(
        provenanceAnchor,
        checkpoint.evaluation,
      );
    }
  }

  const prefixComplete = Object.freeze({ prefixComplete: true });
  let cursor = 0;
  try {
    const registered = AI_COOPERATIVE_CEM_REGISTRATION;
    runCategoricalCem({
      seed: registered.optimizer.seed,
      generations: registered.optimizer.generations,
      populationSize: registered.optimizer.populationSize,
      smoothing: registered.optimizer.smoothing,
      probabilityFloor: registered.optimizer.probabilityFloor,
      candidateIdPrefix: registered.optimizer.candidateIdPrefix,
      schema: registered.genes,
      initialIncumbent: registered.initialIncumbent,
      initialDistribution: createUniformCategoricalDistribution(registered.genes),
      evaluate(candidate, context) {
        if (cursor === checkpoints.length) throw prefixComplete;
        const evaluation = checkpoints[cursor].evaluation;
        if (
          evaluation.candidateId !== candidate.candidateId ||
          evaluation.generation !== context.generation ||
          evaluation.retainedIncumbent !== context.retainedIncumbent ||
          canonicalAiPolicyEvolutionJson(evaluation.genome) !==
            canonicalAiPolicyEvolutionJson(candidate.genome)
        ) {
          throw new TypeError(
            `registered checkpoint at index ${cursor} does not match deterministic replay`,
          );
        }
        cursor += 1;
        return evaluation.constraints.score;
      },
    });
  } catch (error) {
    if (error !== prefixComplete) throw error;
  }
  if (cursor !== checkpoints.length) {
    throw new TypeError(
      "registered checkpoints extend beyond deterministic CEM replay",
    );
  }
}

export function assertAiCooperativeCemRegisteredResumeCheckpointPrefix(
  registeredResumeMode: "none" | "search-only",
  checkpoints: readonly AiCooperativeCemRegisteredSearchCheckpoint[],
): void {
  if (
    registeredResumeMode !== "none" &&
    registeredResumeMode !== "search-only"
  ) {
    throw new TypeError("registered cooperative CEM resume mode is invalid");
  }
  if (registeredResumeMode === "none" && checkpoints.length !== 0) {
    throw new TypeError(
      "registered cooperative CEM resume mode none requires an empty checkpoint prefix",
    );
  }
  assertAiCooperativeCemRegisteredCheckpointPrefix(checkpoints);
}

function registeredBenchmarkEvaluator(
  request: Readonly<AiCooperativeCemBenchmarkRequest>,
): Readonly<{
  rawBenchmarkResult: AiPolicySuiteBenchmarkResult;
  benchmark: AiCooperativeCemBenchmarkEvidence;
}> {
  const result = runAiPolicySuiteBenchmark({
    candidate: { profileOverrides: request.profileOverrides },
    seeds: AI_COOPERATIVE_CEM_REGISTRATION.phases.training.seeds,
    startSeed: AI_COOPERATIVE_CEM_REGISTRATION.phases.training.startSeed,
    reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
    reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
    reservationProtocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    reservationImplementationSha256:
      AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    reservationConfirmation: AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
    maxRounds: AI_COOPERATIVE_CEM_REGISTRATION.benchmark.maxRounds,
    initialHealth: AI_COOPERATIVE_CEM_REGISTRATION.benchmark.initialHealth,
    scenarioIds: AI_COOPERATIVE_CEM_REGISTRATION.benchmark.scenarioIds,
    onProgress: request.onProgress,
  });
  const summary = summarizeAiCooperativeCemBenchmarkResult(result);
  assertBenchmarkContract(summary, request.genome);
  return Object.freeze({ rawBenchmarkResult: result, benchmark: summary });
}

export function computeAiCooperativeCemTrainingArtifactHash(
  value:
    | AiCooperativeCemTrainingArtifactPayload
    | AiCooperativeCemTrainingArtifact,
): string {
  const { artifactHash: _artifactHash, ...payload } = value as
    AiCooperativeCemTrainingArtifact;
  return hashCanonical(payload);
}

export function assertValidAiCooperativeCemTrainingArtifact(
  value: AiCooperativeCemTrainingArtifact,
): void {
  if (
    value.formatVersion !== AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION ||
    value.method !== AI_COOPERATIVE_CEM_TRAINING_METHOD ||
    value.protocolId !== AI_COOPERATIVE_CEM_REGISTRATION.id ||
    value.protocolSha256 !== AI_COOPERATIVE_CEM_PROTOCOL_SHA256 ||
    value.implementationSha256 !== AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256
  ) {
    throw new TypeError("cooperative CEM artifact registration mismatch");
  }
  if (value.executionKind === "registered") {
    assertSha256(
      value.registeredRunMarkerHash,
      "artifact.registeredRunMarkerHash",
    );
    if (
      value.registeredRunMarkerHash !==
      createAiCooperativeCemRegisteredRunMarker().markerHash
    ) {
      throw new TypeError("cooperative CEM artifact run marker hash mismatch");
    }
  } else if (value.executionKind === "injected-test") {
    if (value.registeredRunMarkerHash !== null) {
      throw new TypeError(
        "injected cooperative CEM artifact cannot claim a registered run marker",
      );
    }
  } else {
    throw new TypeError("cooperative CEM artifact executionKind is invalid");
  }
  assertValidAiPolicyEvolutionArtifact(value.evolution);
  if (
    computeAiPolicyEvolutionArtifactHash(value.evolution) !==
    value.evolution.artifactHash
  ) {
    throw new TypeError("cooperative CEM evolution artifact hash mismatch");
  }
  const registered = AI_COOPERATIVE_CEM_REGISTRATION;
  const expectedInitialDistribution = createUniformCategoricalDistribution(
    registered.genes,
  );
  if (
    value.evolution.config.seed !== registered.optimizer.seed ||
    value.evolution.config.generations !== registered.optimizer.generations ||
    value.evolution.config.populationSize !== registered.optimizer.populationSize ||
    value.evolution.config.eliteCount !== registered.optimizer.eliteCount ||
    value.evolution.config.smoothing !== registered.optimizer.smoothing ||
    value.evolution.config.probabilityFloor !==
      registered.optimizer.probabilityFloor ||
    value.evolution.config.candidateIdPrefix !==
      registered.optimizer.candidateIdPrefix ||
    canonicalAiPolicyEvolutionJson(value.evolution.schema) !==
      canonicalAiPolicyEvolutionJson(registered.genes) ||
    canonicalAiPolicyEvolutionJson(value.evolution.initialIncumbent) !==
      canonicalAiPolicyEvolutionJson(registered.initialIncumbent) ||
    canonicalAiPolicyEvolutionJson(value.evolution.initialDistribution) !==
      canonicalAiPolicyEvolutionJson(expectedInitialDistribution)
  ) {
    throw new TypeError("cooperative CEM evolution does not match registration");
  }
  const sampled = value.evolution.trajectory.flatMap((trace) =>
    trace.sampledGenomes.map((candidate) => ({
      generation: trace.generation,
      ...candidate,
    })),
  );
  if (value.candidateEvaluations.length !== sampled.length) {
    throw new TypeError("cooperative CEM artifact candidate count mismatch");
  }
  const cachedCandidateCount = assertNonNegativeSafeInteger(
    value.cachedCandidateCount,
    "artifact.cachedCandidateCount",
  );
  const freshCandidateCount = assertNonNegativeSafeInteger(
    value.freshCandidateCount,
    "artifact.freshCandidateCount",
  );
  if (
    cachedCandidateCount + freshCandidateCount !==
    value.candidateEvaluations.length
  ) {
    throw new TypeError("cooperative CEM artifact cache accounting mismatch");
  }
  if (
    value.registeredResumeMode !== "none" &&
    value.registeredResumeMode !== "search-only"
  ) {
    throw new TypeError("cooperative CEM registeredResumeMode is invalid");
  }
  if (
    (value.executionKind === "registered" &&
      value.registeredResumeMode === "none" &&
      cachedCandidateCount !== 0) ||
    (value.executionKind === "injected-test" &&
      value.registeredResumeMode !== "none")
  ) {
    throw new TypeError("cooperative CEM artifact resume semantics mismatch");
  }
  let provenanceAnchor: AiCooperativeCemCandidateEvaluation | null = null;
  for (const [index, evaluation] of value.candidateEvaluations.entries()) {
    assertValidAiCooperativeCemCandidateEvaluation(evaluation);
    const expected = sampled[index];
    if (
      evaluation.executionKind !== value.executionKind ||
      evaluation.candidateId !== expected.candidateId ||
      evaluation.generation !== expected.generation ||
      evaluation.retainedIncumbent !== expected.retainedIncumbent ||
      evaluation.constraints.score !== expected.score ||
      canonicalAiPolicyEvolutionJson(evaluation.genome) !==
        canonicalAiPolicyEvolutionJson(expected.genome)
    ) {
      throw new TypeError("cooperative CEM candidate does not match evolution");
    }
    if (provenanceAnchor === null) {
      provenanceAnchor = evaluation;
    } else {
      assertMatchingBenchmarkProvenance(provenanceAnchor, evaluation);
    }
  }
  const selected = value.candidateEvaluations.find(
    (evaluation) => evaluation.candidateId === value.selectedCandidateId,
  );
  if (
    !selected ||
    value.selectedCandidateId !== value.evolution.finalIncumbent.candidateId ||
    canonicalAiPolicyEvolutionJson(value.selectedGenome) !==
      canonicalAiPolicyEvolutionJson(value.evolution.finalIncumbent.genome)
  ) {
    throw new TypeError("cooperative CEM selected candidate mismatch");
  }
  if (
    value.selectedCandidateFeasible !== selected.constraints.feasible ||
    value.selectionScreenEligible !==
      (value.trainingEvidenceUsable && selected.constraints.feasible)
  ) {
    throw new TypeError("cooperative CEM selected feasibility mismatch");
  }
  const expectedEvidenceUsable =
    value.executionKind === "registered" &&
    value.registeredResumeMode === "none" &&
    cachedCandidateCount === 0 &&
    value.candidateEvaluations.every(
      (evaluation) => evaluation.benchmark.evidenceUsable,
    );
  if (value.trainingEvidenceUsable !== expectedEvidenceUsable) {
    throw new TypeError("cooperative CEM trainingEvidenceUsable mismatch");
  }
  assertSha256(value.artifactHash, "artifact.artifactHash");
  if (computeAiCooperativeCemTrainingArtifactHash(value) !== value.artifactHash) {
    throw new TypeError("cooperative CEM artifactHash mismatch");
  }
}

function assertRegisteredAuthorization(
  value: AiCooperativeCemRegisteredAuthorization | undefined,
): void {
  if (
    value === undefined ||
    value.confirmation !== AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION ||
    value.protocolSha256 !== AI_COOPERATIVE_CEM_PROTOCOL_SHA256 ||
    value.implementationSha256 !== AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256
  ) {
    throw new TypeError(
      "registered cooperative CEM training requires the exact confirmation, protocol hash, and implementation hash",
    );
  }
  if (process.env.NODE_TEST_CONTEXT !== undefined) {
    throw new Error(
      "registered cooperative CEM training is disabled inside node --test",
    );
  }
  assertAiCooperativeCemImplementationPinned();
}

export function runAiCooperativeCemTraining(
  options: RunAiCooperativeCemTrainingOptions = {},
): AiCooperativeCemTrainingArtifact {
  const injectedEvaluator = options.benchmarkEvaluator;
  const executionKind: AiCooperativeCemExecutionKind = injectedEvaluator
    ? "injected-test"
    : "registered";
  let registeredResumeMode: "none" | "search-only" = "none";
  let registeredRunMarkerHash: string | null = null;
  let cachedSequence: readonly AiCooperativeCemCandidateEvaluation[];
  let registeredRunStartSink:
    | ((marker: AiCooperativeCemRegisteredRunMarker) => void)
    | null = null;
  let registeredCheckpointSink:
    | ((checkpoint: AiCooperativeCemRegisteredSearchCheckpoint) => void)
    | null = null;

  if (executionKind === "injected-test") {
    if (
      options.registeredAuthorization !== undefined ||
      options.registeredResumeMode !== undefined ||
      options.registeredSearchCheckpoints !== undefined ||
      options.onRegisteredRunStart !== undefined ||
      options.onRegisteredSearchCheckpoint !== undefined
    ) {
      throw new TypeError(
        "injected cooperative CEM cannot receive registered-run capabilities",
      );
    }
    cachedSequence = options.cachedEvaluations ?? [];
  } else {
    assertAiCooperativeCemTrainingNotCompleted();
    if (options.cachedEvaluations !== undefined) {
      throw new TypeError(
        "registered cooperative CEM only accepts raw-bound search checkpoints",
      );
    }
    assertRegisteredAuthorization(options.registeredAuthorization);
    const runStartSink = options.onRegisteredRunStart;
    if (typeof runStartSink !== "function") {
      throw new TypeError(
        "registered cooperative CEM requires a durable run-start marker sink",
      );
    }
    registeredRunStartSink = runStartSink;
    const checkpointSink = options.onRegisteredSearchCheckpoint;
    if (typeof checkpointSink !== "function") {
      throw new TypeError(
        "registered cooperative CEM requires a raw-bound checkpoint sink",
      );
    }
    registeredCheckpointSink = checkpointSink;
    const checkpoints = options.registeredSearchCheckpoints ?? [];
    registeredResumeMode = options.registeredResumeMode ?? "none";
    assertAiCooperativeCemRegisteredResumeCheckpointPrefix(
      registeredResumeMode,
      checkpoints,
    );
    cachedSequence = checkpoints.map((checkpoint) => checkpoint.evaluation);
  }

  const seenCachedIds = new Set<string>();
  let provenanceAnchor: AiCooperativeCemCandidateEvaluation | null = null;
  for (const evaluation of cachedSequence) {
    assertValidAiCooperativeCemCandidateEvaluation(evaluation);
    if (evaluation.executionKind !== executionKind) {
      throw new TypeError("cached evaluation execution kind mismatch");
    }
    if (seenCachedIds.has(evaluation.candidateId)) {
      throw new TypeError(`duplicate cached evaluation ${evaluation.candidateId}`);
    }
    seenCachedIds.add(evaluation.candidateId);
    if (provenanceAnchor === null) {
      provenanceAnchor = evaluation;
    } else {
      assertMatchingBenchmarkProvenance(provenanceAnchor, evaluation);
    }
  }

  if (executionKind === "registered") {
    if (registeredRunStartSink === null) {
      throw new TypeError("registered cooperative CEM run-start sink is missing");
    }
    const marker = createAiCooperativeCemRegisteredRunMarker();
    const sinkResult = registeredRunStartSink(marker);
    if (sinkResult !== undefined) {
      throw new TypeError(
        "registered cooperative CEM run-start sink must complete synchronously",
      );
    }
    assertValidAiCooperativeCemRegisteredRunMarker(marker);
    registeredRunMarkerHash = marker.markerHash;
  }

  const evaluations = new Map<string, AiCooperativeCemCandidateEvaluation>();
  const registered = AI_COOPERATIVE_CEM_REGISTRATION;
  let cachedCursor = 0;
  let freshCandidateCount = 0;
  const evolution = runCategoricalCem({
    seed: registered.optimizer.seed,
    generations: registered.optimizer.generations,
    populationSize: registered.optimizer.populationSize,
    smoothing: registered.optimizer.smoothing,
    probabilityFloor: registered.optimizer.probabilityFloor,
    candidateIdPrefix: registered.optimizer.candidateIdPrefix,
    schema: registered.genes,
    initialIncumbent: registered.initialIncumbent,
    initialDistribution: createUniformCategoricalDistribution(registered.genes),
    evaluate(candidate, context) {
      if (cachedCursor < cachedSequence.length) {
        const cachedEvaluation = cachedSequence[cachedCursor];
        if (
          cachedEvaluation.candidateId !== candidate.candidateId ||
          cachedEvaluation.generation !== context.generation ||
          cachedEvaluation.retainedIncumbent !== context.retainedIncumbent ||
          canonicalAiPolicyEvolutionJson(cachedEvaluation.genome) !==
            canonicalAiPolicyEvolutionJson(candidate.genome)
        ) {
          throw new TypeError(
            `cached evaluation at prefix index ${cachedCursor} does not match replay candidate ${candidate.candidateId}`,
          );
        }
        cachedCursor += 1;
        evaluations.set(candidate.candidateId, cachedEvaluation);
        return cachedEvaluation.constraints.score;
      }

      const profileOverrides = buildAiCooperativeCemProfileOverrides(
        candidate.genome,
      );
      const request: AiCooperativeCemBenchmarkRequest = {
        candidateId: candidate.candidateId,
        generation: context.generation,
        retainedIncumbent: context.retainedIncumbent,
        genome: { ...candidate.genome },
        profileOverrides,
        onProgress: options.onBenchmarkProgress
          ? (progress) =>
              options.onBenchmarkProgress?.(candidate.candidateId, progress)
          : undefined,
      };
      let rawBenchmarkResult: AiPolicySuiteBenchmarkResult | null = null;
      let benchmark: AiCooperativeCemBenchmarkEvidence;
      if (injectedEvaluator) {
        benchmark = injectedEvaluator(request);
      } else {
        const registeredResult = registeredBenchmarkEvaluator(request);
        rawBenchmarkResult = registeredResult.rawBenchmarkResult;
        benchmark = registeredResult.benchmark;
      }
      assertBenchmarkContract(benchmark, candidate.genome);
      const evaluation = createCandidateEvaluation(
        executionKind,
        candidate.candidateId,
        context.generation,
        context.retainedIncumbent,
        candidate.genome,
        benchmark,
      );
      if (provenanceAnchor === null) {
        provenanceAnchor = evaluation;
      } else {
        assertMatchingBenchmarkProvenance(provenanceAnchor, evaluation);
      }
      if (executionKind === "registered") {
        if (rawBenchmarkResult === null || registeredCheckpointSink === null) {
          throw new TypeError(
            "registered benchmark raw result or checkpoint sink is missing",
          );
        }
        const checkpoint = createAiCooperativeCemRegisteredSearchCheckpoint(
          evaluations.size,
          evaluation,
          rawBenchmarkResult,
        );
        registeredCheckpointSink(checkpoint);
      }
      freshCandidateCount += 1;
      evaluations.set(candidate.candidateId, evaluation);
      options.onCandidateEvaluation?.(evaluation);
      return evaluation.constraints.score;
    },
  });
  if (cachedCursor !== cachedSequence.length) {
    throw new TypeError("cached evaluations extend beyond deterministic replay");
  }
  const orderedEvaluations = evolution.trajectory.flatMap((trace) =>
    trace.sampledGenomes.map((candidate) => {
      const evaluation = evaluations.get(candidate.candidateId);
      if (!evaluation) {
        throw new TypeError(`missing evaluation ${candidate.candidateId}`);
      }
      return evaluation;
    }),
  );
  const selected = orderedEvaluations.find(
    (evaluation) =>
      evaluation.candidateId === evolution.finalIncumbent.candidateId,
  );
  if (!selected) {
    throw new TypeError("final CEM incumbent has no candidate evaluation");
  }
  const trainingEvidenceUsable =
    executionKind === "registered" &&
    registeredResumeMode === "none" &&
    cachedSequence.length === 0 &&
    orderedEvaluations.every((evaluation) => evaluation.benchmark.evidenceUsable);
  const payload: AiCooperativeCemTrainingArtifactPayload = {
    formatVersion: AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION,
    method: AI_COOPERATIVE_CEM_TRAINING_METHOD,
    protocolId: registered.id,
    protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    executionKind,
    evolution,
    candidateEvaluations: orderedEvaluations,
    selectedCandidateId: evolution.finalIncumbent.candidateId,
    selectedGenome: { ...evolution.finalIncumbent.genome },
    selectedCandidateFeasible: selected.constraints.feasible,
    selectionScreenEligible:
      trainingEvidenceUsable && selected.constraints.feasible,
    registeredResumeMode,
    registeredRunMarkerHash,
    cachedCandidateCount: cachedSequence.length,
    freshCandidateCount,
    trainingEvidenceUsable,
  };
  const artifact = deepFreeze({
    ...payload,
    artifactHash: computeAiCooperativeCemTrainingArtifactHash(payload),
  });
  assertValidAiCooperativeCemTrainingArtifact(artifact);
  return artifact;
}
