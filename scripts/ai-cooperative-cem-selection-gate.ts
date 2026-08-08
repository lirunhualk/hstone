import type { AiPolicySuiteBenchmarkResult } from "./benchmark-ai-policy-suite.ts";

const PROFILE_IDS = [
  "balanced",
  "magnetic",
  "tempo",
  "triple",
  "powerLevel",
  "economy",
  "deathrattle",
] as const;

const NON_FOCUS_PROFILE_IDS = [
  "balanced",
  "magnetic",
  "tempo",
  "triple",
  "economy",
  "deathrattle",
] as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION = deepFreeze({
  formatVersion: 1,
  id: "cooperative-cem-power-level-selection-gate-v1",
  focusProfileId: "powerLevel",
  profileIds: [...PROFILE_IDS],
  nonFocusProfileIds: [...NON_FOCUS_PROFILE_IDS],
  accounting: {
    seedClusters: 24,
    episodesPerCluster: 16,
    pairsPerCluster: 112,
    scheduledRuns: 768,
    completedRuns: 768,
    failedRuns: 0,
    expectedPairs: 2_688,
    pairedPairs: 2_688,
    missingPairs: 0,
    perProfilePairs: 384,
    drawPairedGames: 384,
    truncatedRuns: 0,
    runnerFailures: 0,
    providerErrors: 0,
  },
  thresholds: {
    drawRateConfidence95UpperMaximum: 0.01,
    focus: {
      placementMeanDeltaMaximum: -0.1,
      placementConfidence95UpperExclusiveMaximum: 0,
      topFourConfidence95LowerMinimum: -0.02,
      winConfidence95LowerMinimum: -0.03,
    },
    overall: {
      placementMeanDeltaMaximum: 0,
      placementConfidence95UpperMaximum: 0.1,
      topFourConfidence95LowerMinimum: -0.02,
      winConfidence95LowerMinimum: -0.03,
    },
    nonFocus: {
      placementConfidence95UpperMaximum: 0.25,
      topFourConfidence95LowerMinimum: -0.05,
      winConfidence95LowerMinimum: -0.05,
    },
  },
} as const);

export interface AiCooperativeCemSelectionGateResult {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

type Comparison =
  AiPolicySuiteBenchmarkResult["comparisonMatrix"]["overall"];
type Metric = Comparison["placement"];

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function addReason(
  reasons: string[],
  condition: boolean,
  reason: string,
): void {
  if (!condition) reasons.push(reason);
}

function assertMetricSamples(
  metric: Metric,
  label: string,
  expectedPairs: number,
  reasons: string[],
): void {
  const accounting = AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION.accounting;
  addReason(
    reasons,
    metric.seedClusters === accounting.seedClusters,
    `${label} seed clusters must equal ${accounting.seedClusters}`,
  );
  addReason(
    reasons,
    metric.pairedSeats === expectedPairs,
    `${label} paired seats must equal ${expectedPairs}`,
  );
  addReason(
    reasons,
    finiteNumber(metric.meanDelta),
    `${label} mean delta must be finite`,
  );
  const lower = metric.confidence95?.lower;
  const upper = metric.confidence95?.upper;
  addReason(
    reasons,
    finiteNumber(lower) && finiteNumber(upper),
    `${label} confidence interval bounds must be finite`,
  );
  addReason(
    reasons,
    finiteNumber(lower) &&
      finiteNumber(metric.meanDelta) &&
      finiteNumber(upper) &&
      lower <= metric.meanDelta &&
      metric.meanDelta <= upper,
    `${label} confidence interval must satisfy lower <= mean <= upper`,
  );
}

function assertComparisonSamples(
  comparison: Comparison | undefined,
  label: string,
  expectedPairs: number,
  reasons: string[],
): void {
  if (comparison === undefined) {
    reasons.push(`${label} comparison is required`);
    return;
  }
  assertMetricSamples(
    comparison.placement,
    `${label} placement`,
    expectedPairs,
    reasons,
  );
  assertMetricSamples(
    comparison.topFour,
    `${label} top-four`,
    expectedPairs,
    reasons,
  );
  assertMetricSamples(
    comparison.win,
    `${label} win`,
    expectedPairs,
    reasons,
  );
}

function assertMeanMaximum(
  metric: Metric | undefined,
  maximum: number,
  label: string,
  reasons: string[],
): void {
  addReason(
    reasons,
    metric !== undefined &&
      finiteNumber(metric.meanDelta) &&
      metric.meanDelta <= maximum,
    `${label} mean delta must be at most ${maximum}`,
  );
}

function assertConfidenceUpper(
  metric: Metric | undefined,
  maximum: number,
  exclusive: boolean,
  label: string,
  reasons: string[],
): void {
  const upper = metric?.confidence95?.upper;
  addReason(
    reasons,
    finiteNumber(upper) && (exclusive ? upper < maximum : upper <= maximum),
    `${label} confidence interval upper bound must be ${
      exclusive ? "below" : "at most"
    } ${maximum}`,
  );
}

function assertConfidenceLower(
  metric: Metric | undefined,
  minimum: number,
  label: string,
  reasons: string[],
): void {
  const lower = metric?.confidence95?.lower;
  addReason(
    reasons,
    finiteNumber(lower) && lower >= minimum,
    `${label} confidence interval lower bound must be at least ${minimum}`,
  );
}

/**
 * Pure quality gate for the independently registered 24-seed selection screen.
 * The policy-suite generic `accepted` flag is deliberately not consulted.
 */
export function evaluateAiCooperativeCemSelectionGate(
  result: AiPolicySuiteBenchmarkResult,
): AiCooperativeCemSelectionGateResult {
  const registration = AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION;
  const { accounting, thresholds } = registration;
  const reasons: string[] = [];

  addReason(
    reasons,
    result.evidenceUsable === true,
    "selection requires usable benchmark evidence",
  );
  addReason(
    reasons,
    result.evidenceReasons.length === 0,
    "selection benchmark evidence reasons must be empty",
  );
  addReason(
    reasons,
    result.config.seeds === accounting.seedClusters,
    `selection configured seeds must equal ${accounting.seedClusters}`,
  );
  addReason(
    reasons,
    Number.isSafeInteger(result.config.startSeed),
    "selection start seed must be a safe integer",
  );
  addReason(
    reasons,
    result.progress.scheduledRuns === accounting.scheduledRuns,
    `selection scheduled runs must equal ${accounting.scheduledRuns}`,
  );
  addReason(
    reasons,
    result.progress.processedRuns === accounting.scheduledRuns,
    `selection processed runs must equal ${accounting.scheduledRuns}`,
  );
  addReason(
    reasons,
    result.progress.completedRuns === accounting.completedRuns,
    `selection completed runs must equal ${accounting.completedRuns}`,
  );
  addReason(
    reasons,
    result.progress.failedRuns === accounting.failedRuns,
    "selection failed runs must equal 0",
  );
  addReason(
    reasons,
    result.expectedPairs === accounting.expectedPairs,
    `selection expected pairs must equal ${accounting.expectedPairs}`,
  );
  addReason(
    reasons,
    result.pairedPairs === accounting.pairedPairs,
    `selection paired pairs must equal ${accounting.pairedPairs}`,
  );
  addReason(
    reasons,
    result.missingPairs === accounting.missingPairs,
    "selection missing pairs must equal 0",
  );
  addReason(
    reasons,
    result.truncatedRuns === accounting.truncatedRuns,
    "selection truncated runs must equal 0",
  );
  addReason(
    reasons,
    result.runnerFailures.length === accounting.runnerFailures,
    "selection runner failures must equal 0",
  );
  addReason(
    reasons,
    result.providerErrorTotal === accounting.providerErrors,
    "selection provider errors must equal 0",
  );
  addReason(
    reasons,
    result.clusters.length === accounting.seedClusters,
    `selection clusters must equal ${accounting.seedClusters}`,
  );
  for (const [index, cluster] of result.clusters.entries()) {
    addReason(
      reasons,
      cluster.seed === result.config.startSeed + index,
      `selection cluster ${index} seed must equal startSeed + ${index}`,
    );
    addReason(
      reasons,
      cluster.episodes.length === accounting.episodesPerCluster,
      `selection cluster ${index} episodes must equal ${accounting.episodesPerCluster}`,
    );
    addReason(
      reasons,
      cluster.pairs.length === accounting.pairsPerCluster,
      `selection cluster ${index} pairs must equal ${accounting.pairsPerCluster}`,
    );
  }
  addReason(
    reasons,
    result.drawRateComparison.seedClusters === accounting.seedClusters,
    `selection draw-rate seed clusters must equal ${accounting.seedClusters}`,
  );
  addReason(
    reasons,
    result.drawRateComparison.pairedGames === accounting.drawPairedGames,
    `selection draw-rate paired games must equal ${accounting.drawPairedGames}`,
  );
  addReason(
    reasons,
    finiteNumber(result.drawRateComparison.meanDelta),
    "selection draw-rate mean delta must be finite",
  );
  const drawLower = result.drawRateComparison.confidence95?.lower;
  const drawUpper = result.drawRateComparison.confidence95?.upper;
  addReason(
    reasons,
    finiteNumber(drawLower) && finiteNumber(drawUpper),
    "selection draw-rate confidence interval bounds must be finite",
  );
  addReason(
    reasons,
    finiteNumber(drawLower) &&
      finiteNumber(result.drawRateComparison.meanDelta) &&
      finiteNumber(drawUpper) &&
      drawLower <= result.drawRateComparison.meanDelta &&
      result.drawRateComparison.meanDelta <= drawUpper,
    "selection draw-rate confidence interval must satisfy lower <= mean <= upper",
  );
  addReason(
    reasons,
    finiteNumber(drawUpper) &&
      drawUpper <= thresholds.drawRateConfidence95UpperMaximum,
    `selection draw-rate confidence interval upper bound must be at most ${thresholds.drawRateConfidence95UpperMaximum}`,
  );

  const byProfile = result.comparisonMatrix.byProfile;
  const profileKeys = Object.keys(byProfile).sort();
  const expectedProfileKeys = [...registration.profileIds].sort();
  addReason(
    reasons,
    profileKeys.length === expectedProfileKeys.length &&
      profileKeys.every((profileId, index) => profileId === expectedProfileKeys[index]),
    "selection profile set must contain exactly the registered seven profiles",
  );

  const overall = result.comparisonMatrix.overall;
  assertComparisonSamples(
    overall,
    "overall",
    accounting.expectedPairs,
    reasons,
  );
  for (const profileId of registration.profileIds) {
    assertComparisonSamples(
      byProfile[profileId],
      profileId,
      accounting.perProfilePairs,
      reasons,
    );
  }

  assertMeanMaximum(
    overall.placement,
    thresholds.overall.placementMeanDeltaMaximum,
    "overall placement",
    reasons,
  );
  assertConfidenceUpper(
    overall.placement,
    thresholds.overall.placementConfidence95UpperMaximum,
    false,
    "overall placement",
    reasons,
  );
  assertConfidenceLower(
    overall.topFour,
    thresholds.overall.topFourConfidence95LowerMinimum,
    "overall top-four",
    reasons,
  );
  assertConfidenceLower(
    overall.win,
    thresholds.overall.winConfidence95LowerMinimum,
    "overall win",
    reasons,
  );

  const focus = byProfile[registration.focusProfileId];
  assertMeanMaximum(
    focus?.placement,
    thresholds.focus.placementMeanDeltaMaximum,
    `${registration.focusProfileId} placement`,
    reasons,
  );
  assertConfidenceUpper(
    focus?.placement,
    thresholds.focus.placementConfidence95UpperExclusiveMaximum,
    true,
    `${registration.focusProfileId} placement`,
    reasons,
  );
  assertConfidenceLower(
    focus?.topFour,
    thresholds.focus.topFourConfidence95LowerMinimum,
    `${registration.focusProfileId} top-four`,
    reasons,
  );
  assertConfidenceLower(
    focus?.win,
    thresholds.focus.winConfidence95LowerMinimum,
    `${registration.focusProfileId} win`,
    reasons,
  );

  for (const profileId of registration.nonFocusProfileIds) {
    const comparison = byProfile[profileId];
    assertConfidenceUpper(
      comparison?.placement,
      thresholds.nonFocus.placementConfidence95UpperMaximum,
      false,
      `${profileId} placement`,
      reasons,
    );
    assertConfidenceLower(
      comparison?.topFour,
      thresholds.nonFocus.topFourConfidence95LowerMinimum,
      `${profileId} top-four`,
      reasons,
    );
    assertConfidenceLower(
      comparison?.win,
      thresholds.nonFocus.winConfidence95LowerMinimum,
      `${profileId} win`,
      reasons,
    );
  }

  return deepFreeze({ accepted: reasons.length === 0, reasons });
}
