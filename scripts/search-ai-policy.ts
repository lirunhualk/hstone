import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  AI_STRATEGY_PROFILES,
  getAiStrategyProfile,
  withAiStrategyProfileOverrides,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import { hasAnyAiResidualPolicyOverrides } from "../lib/game/ai-residual-policy.ts";
import {
  computeAiBenchmarkContentSnapshotSha256,
  computeAiBenchmarkEvaluatorHash,
  computeAiBenchmarkStrategyProfileHash,
  computeRegisteredAiPolicyTrainingScreenProtocolHash,
  runAiBenchmark,
  runRegisteredAiPolicyTrainingScreen,
  type AiBenchmarkGameResult,
  type AiBenchmarkProgress,
  type AiBenchmarkResult,
  type AiBenchmarkStrategyResult,
} from "./benchmark-ai.ts";
import {
  assertAiBenchmarkSeedAccess,
} from "./ai-seed-ledger.ts";
import {
  AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
  AI_POLICY_TRAINING_SCREEN_CANDIDATES,
  AI_POLICY_TRAINING_SCREEN_REGISTRATION,
  AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
  type AiPolicyTrainingCandidateId,
} from "./ai-training-screen-registration.ts";
export {
  AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
  AI_POLICY_TRAINING_SCREEN_CANDIDATES,
  AI_POLICY_TRAINING_SCREEN_REGISTRATION,
  AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
  type AiPolicyTrainingCandidateId,
} from "./ai-training-screen-registration.ts";

export type TunableAiProfileKey =
  | "upgradeRoundOffset"
  | "minimumUpgradeHealth"
  | "statWeight"
  | "synergyWeight"
  | "preferredTribeBonus"
  | "pairBonus"
  | "tripleBonus"
  | "battlecryBonus"
  | "deathrattleBonus"
  | "economyBonus"
  | "magneticBonus"
  | "highTierBonus"
  | "spellValueMultiplier"
  | "replacementMargin"
  | "maxRefreshes"
  | "freezeScoreBonus"
  | "scoutingWeight"
  | "healthSpendFloor";

const TUNABLE_KEYS = new Set<TunableAiProfileKey>([
  "upgradeRoundOffset",
  "minimumUpgradeHealth",
  "statWeight",
  "synergyWeight",
  "preferredTribeBonus",
  "pairBonus",
  "tripleBonus",
  "battlecryBonus",
  "deathrattleBonus",
  "economyBonus",
  "magneticBonus",
  "highTierBonus",
  "spellValueMultiplier",
  "replacementMargin",
  "maxRefreshes",
  "freezeScoreBonus",
  "scoutingWeight",
  "healthSpendFloor",
]);

const INTEGER_KEYS = new Set<TunableAiProfileKey>([
  "upgradeRoundOffset",
  "minimumUpgradeHealth",
  "maxRefreshes",
  "healthSpendFloor",
]);

const DEFAULT_TRAIN_SEEDS = 8;
const DEFAULT_HOLDOUT_SEEDS = 24;
const MINIMUM_HOLDOUT_SEED_CLUSTERS = 24;
const TOP_FOUR_NONINFERIORITY_GUARD = 0.02;
const WIN_RATE_NONINFERIORITY_GUARD = 0.03;
export const AI_POLICY_CONFIRMATION_REGISTRATION_ID =
  "power-level-upgrade-round-offset-minus-1-to-0-51001-v1";
export const AI_POLICY_CONFIRMATION_REGISTRATION = Object.freeze({
  id: AI_POLICY_CONFIRMATION_REGISTRATION_ID,
  strategyId: "powerLevel" as const,
  parameter: "upgradeRoundOffset" as const,
  liveValue: -1,
  incumbentValue: -1,
  candidateValue: 0,
  seeds: 96,
  startSeed: 51_001,
  maxRounds: 100,
  rotationsPerSeed: 8,
  scheduledGames: 768,
  minimumPlacementImprovement: 0.1,
  topFourNoninferiorityGuard: TOP_FOUR_NONINFERIORITY_GUARD,
  winRateNoninferiorityGuard: WIN_RATE_NONINFERIORITY_GUARD,
});
export const AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS =
  AI_POLICY_CONFIRMATION_REGISTRATION.seeds;

const TRAINING_SCREEN_BASELINE_PROFILE_BYTES = JSON.stringify(
  AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
);
const TRAINING_SCREEN_BASELINE_STRATEGY_PROFILE_HASH =
  AI_POLICY_TRAINING_SCREEN_REGISTRATION.baselineStrategyProfileHash;

export function computeAiPolicySearchEvaluatorHash(): string {
  return createHash("sha256")
    .update("scripts/benchmark-ai.ts evaluator\0")
    .update(computeAiBenchmarkEvaluatorHash())
    .update("\0scripts/search-ai-policy.ts\0")
    .update(readFileSync(new URL("./search-ai-policy.ts", import.meta.url)))
    .digest("hex");
}

const SEARCH_EVALUATOR_HASH = computeAiPolicySearchEvaluatorHash();
const SEARCH_CONTENT_SNAPSHOT_SHA256 =
  computeAiBenchmarkContentSnapshotSha256();

export function computeAiPolicyTrainingScreenProtocolHash(): string {
  return computeRegisteredAiPolicyTrainingScreenProtocolHash();
}

const TRAINING_SCREEN_PROTOCOL_HASH =
  computeAiPolicyTrainingScreenProtocolHash();

function assertNoAiResidualPolicyOverrides(boundary: string): void {
  if (hasAnyAiResidualPolicyOverrides()) {
    throw new Error(
      `AI policy evaluation forbids residual policy overrides at ${boundary}`,
    );
  }
}

export interface AiPolicySearchOptions {
  strategyId: AiStrategyId;
  parameter: TunableAiProfileKey;
  values: readonly number[];
  incumbentValue?: number;
  trainSeeds?: number;
  trainStartSeed?: number;
  holdoutSeeds?: number;
  holdoutStartSeed?: number;
  maxRounds?: number;
  minimumPlacementImprovement?: number;
  onProgress?: (progress: AiPolicySearchProgress) => void;
}

export interface AiPolicySearchProgress extends AiBenchmarkProgress {
  stage: "training" | "holdout";
  value: number;
}

export interface AiPolicyConfirmationOptions {
  strategyId: AiStrategyId;
  parameter: TunableAiProfileKey;
  incumbentValue?: number;
  candidateValue: number;
  seeds?: number;
  startSeed?: number;
  maxRounds?: number;
  minimumPlacementImprovement?: number;
  onProgress?: (progress: AiPolicyConfirmationProgress) => void;
}

export interface AiPolicyConfirmationProgress extends AiBenchmarkProgress {
  arm: "incumbent" | "candidate";
  value: number;
}

export interface PairedPlacementComparison {
  pairedGames: number;
  seedClusters: number;
  meanPlacementDelta: number | null;
  confidence95: { lower: number; upper: number } | null;
}

export interface PairedRateComparison {
  pairedGames: number;
  seedClusters: number;
  meanRateDelta: number | null;
  confidence95: { lower: number; upper: number } | null;
}

export type ConservativeRateMetric = "topFour" | "win";

export interface AiPolicyVariantSummary {
  value: number;
  contentSnapshotSha256: string;
  contentSnapshotSha256After: string;
  contentSnapshotStable: boolean;
  evaluatorHash: string;
  evaluatorHashAfter: string;
  evaluatorStable: boolean;
  strategyProfileHash: string;
  strategyProfileHashAfter: string;
  strategyProfilesStable: boolean;
  scheduledGames: number;
  completedGames: number;
  drawnGames: number;
  truncatedGames: number;
  averagePlacement: number | null;
  topFourRate: number | null;
  winRate: number | null;
  comparisonToIncumbent: PairedPlacementComparison;
  conservativeComparisonToIncumbent: PairedPlacementComparison;
  conservativeTopFourComparisonToIncumbent: PairedRateComparison;
  conservativeWinRateComparisonToIncumbent: PairedRateComparison;
  trainingScore: number | null;
}

export interface AiPolicySearchResult {
  contentVersion: string;
  contentSnapshotSha256: string;
  contentSnapshotSha256After: string;
  contentSnapshotStable: boolean;
  policyVersion: string;
  evaluatorHash: string;
  searchEvaluatorHash: string;
  searchEvaluatorHashAfter: string;
  searchEvaluatorStable: boolean;
  strategyProfileHash: string;
  strategyProfileHashAfter: string;
  strategyProfilesStable: boolean;
  strategyId: AiStrategyId;
  playerId: string;
  parameter: TunableAiProfileKey;
  liveValue: number;
  incumbentValue: number;
  recommendedValue: number;
  accepted: boolean;
  acceptanceReasons: readonly string[];
  config: {
    trainSeeds: number;
    trainStartSeed: number;
    holdoutSeeds: number;
    holdoutStartSeed: number;
    maxRounds: number;
    rotationsPerSeed: number;
    trainingScheduledGames: number;
    holdoutScheduledGames: number;
    minimumPlacementImprovement: number;
    topFourNoninferiorityGuard: number;
    winRateNoninferiorityGuard: number;
  };
  training: {
    seeds: number;
    startSeed: number;
    variants: AiPolicyVariantSummary[];
  };
  holdout: {
    seeds: number;
    startSeed: number;
    incumbent: AiPolicyVariantSummary;
    candidate: AiPolicyVariantSummary;
  };
  note: string;
}

export interface AiPolicyConfirmationGateEvidence {
  registrationId: string;
  strategyId: AiStrategyId;
  parameter: TunableAiProfileKey;
  liveValue: number;
  incumbentValue: number;
  candidateValue: number;
  configuredSeeds: number;
  startSeed: number;
  maxRounds: number;
  rotationsPerSeed: number;
  scheduledGames: number;
  minimumPlacementImprovement: number;
  topFourNoninferiorityGuard: number;
  winRateNoninferiorityGuard: number;
  incumbentDrawnGames: number;
  candidateDrawnGames: number;
  incumbentTruncatedGames: number;
  candidateTruncatedGames: number;
  placement: PairedPlacementComparison;
  topFour: PairedRateComparison;
  win: PairedRateComparison;
  provenanceStable: boolean;
}

export interface AiPolicyConfirmationResult {
  method: "fixed-candidate-confirmation-v1";
  registrationId: typeof AI_POLICY_CONFIRMATION_REGISTRATION_ID;
  registrationMatched: boolean;
  contentVersion: string;
  contentSnapshotSha256: string;
  contentSnapshotSha256After: string;
  contentSnapshotStable: boolean;
  policyVersion: string;
  evaluatorHash: string;
  evaluatorHashAfter: string;
  evaluatorStable: boolean;
  searchEvaluatorHash: string;
  searchEvaluatorHashAfter: string;
  searchEvaluatorStable: boolean;
  strategyProfileHash: string;
  strategyProfileHashAfter: string;
  strategyProfilesStable: boolean;
  strategyProfileBindingsStable: boolean;
  strategyId: AiStrategyId;
  playerId: string;
  parameter: TunableAiProfileKey;
  liveValue: number;
  incumbentValue: number;
  candidateValue: number;
  config: {
    seeds: number;
    startSeed: number;
    maxRounds: number;
    rotationsPerSeed: number;
    scheduledGames: number;
    minimumPlacementImprovement: number;
    minimumSeedClusters: number;
    topFourNoninferiorityGuard: number;
    winRateNoninferiorityGuard: number;
  };
  incumbent: AiPolicyVariantSummary;
  candidate: AiPolicyVariantSummary;
  accepted: boolean;
  acceptanceReasons: readonly string[];
  note: string;
}

export interface AiPolicyTrainingScreenOptions {
  seeds?: number;
  startSeed?: number;
  maxRounds?: number;
  expectedProtocolHash?: string;
  onProgress?: (progress: AiPolicyTrainingScreenProgress) => void;
}

export interface AiPolicyTrainingScreenProgress {
  arm: "baseline" | "candidate";
  candidateId: AiPolicyTrainingCandidateId | null;
  processedGames: number;
  scheduledGames: number;
}

export interface AiPolicyTrainingCandidateEvidence {
  candidateId: AiPolicyTrainingCandidateId;
  scheduledGames: number;
  drawnGames: number;
  truncatedGames: number;
  placement: PairedPlacementComparison;
  topFour: PairedRateComparison;
  win: PairedRateComparison;
  provenanceStable: boolean;
}

export interface AiPolicyTrainingScreenEvidence {
  registrationId: string;
  seeds: number;
  startSeed: number;
  maxRounds: number;
  rotationsPerSeed: number;
  scheduledGames: number;
  minimumPlacementImprovement: number;
  topFourNoninferiorityGuard: number;
  winRateNoninferiorityGuard: number;
  baselineScheduledGames: number;
  baselineDrawnGames: number;
  baselineTruncatedGames: number;
  provenanceStable: boolean;
  candidates: readonly AiPolicyTrainingCandidateEvidence[];
}

export interface AiPolicyTrainingScreenResult {
  method: "fixed-candidate-training-screen-v1";
  registrationId: typeof AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID;
  protocolHash: string;
  protocolHashAfter: string;
  protocolStable: boolean;
  requestedExpectedProtocolHash: string | null;
  registrationMatched: boolean;
  contentVersion: string;
  contentSnapshotSha256: string;
  contentSnapshotSha256After: string;
  contentSnapshotStable: boolean;
  policyVersion: string;
  evaluatorHash: string;
  evaluatorHashAfter: string;
  evaluatorStable: boolean;
  searchEvaluatorHash: string;
  searchEvaluatorHashAfter: string;
  searchEvaluatorStable: boolean;
  strategyProfileHash: string;
  strategyProfileHashAfter: string;
  strategyProfilesStable: boolean;
  candidateProfileBindingsStable: boolean;
  strategyId: "powerLevel";
  playerId: "player-5";
  config: {
    seeds: number;
    startSeed: number;
    maxRounds: number;
    rotationsPerSeed: number;
    scheduledGames: number;
    minimumPlacementImprovement: number;
    topFourNoninferiorityGuard: number;
    winRateNoninferiorityGuard: number;
  };
  candidateProfileHashes: readonly {
    candidateId: AiPolicyTrainingCandidateId;
    strategyProfileHash: string;
  }[];
  baseline: AiPolicyVariantSummary;
  candidates: readonly {
    candidateId: AiPolicyTrainingCandidateId;
    profile: Readonly<AiStrategyProfile>;
    expectedStrategyProfileHash: string;
    profileBindingStable: boolean;
    summary: AiPolicyVariantSummary;
    qualified: boolean;
    qualificationReasons: readonly string[];
  }[];
  selected: AiPolicyTrainingCandidateId | null;
  note: string;
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return resolved;
}

function safeInteger(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return resolved;
}

function validateCandidateValue(
  parameter: TunableAiProfileKey,
  value: number,
): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${parameter} candidate must be finite`);
  }
  if (INTEGER_KEYS.has(parameter) && !Number.isInteger(value)) {
    throw new Error(`${parameter} candidate must be an integer`);
  }
  if (parameter === "upgradeRoundOffset" && (value < -2 || value > 3)) {
    throw new Error("upgradeRoundOffset candidate must be between -2 and 3");
  }
  if (
    (parameter === "minimumUpgradeHealth" ||
      parameter === "healthSpendFloor") &&
    (value < 1 || value > 40)
  ) {
    throw new Error(`${parameter} candidate must be between 1 and 40`);
  }
  if (parameter === "maxRefreshes" && (value < 0 || value > 10)) {
    throw new Error("maxRefreshes candidate must be between 0 and 10");
  }
  if (parameter === "freezeScoreBonus" && (value < -10 || value > 10)) {
    throw new Error("freezeScoreBonus candidate must be between -10 and 10");
  }
  if (
    parameter !== "upgradeRoundOffset" &&
    parameter !== "minimumUpgradeHealth" &&
    parameter !== "healthSpendFloor" &&
    parameter !== "maxRefreshes" &&
    parameter !== "freezeScoreBonus" &&
    (value < 0 || value > 20)
  ) {
    throw new Error(`${parameter} candidate must be between 0 and 20`);
  }
}

function strategyPlayerId(strategyId: AiStrategyId): string {
  const index = AI_STRATEGY_PROFILES.findIndex(
    (profile) => profile.id === strategyId,
  );
  if (index < 0) {
    throw new Error(`unknown AI strategy ${strategyId}`);
  }
  return `player-${index + 1}`;
}

function targetResult(
  result: AiBenchmarkResult,
  strategyId: AiStrategyId,
): AiBenchmarkStrategyResult {
  const strategy = result.strategies.find(
    (candidate) => candidate.strategyId === strategyId,
  );
  if (!strategy) {
    throw new Error(`benchmark result is missing strategy ${strategyId}`);
  }
  return strategy;
}

function gameKey(game: AiBenchmarkGameResult): string {
  return `${game.seed}:${game.rotation}`;
}

function uniqueGamesByKey(
  games: readonly AiBenchmarkGameResult[],
  label: string,
): Map<string, AiBenchmarkGameResult> {
  const result = new Map<string, AiBenchmarkGameResult>();
  for (const game of games) {
    const key = gameKey(game);
    if (result.has(key)) {
      throw new Error(`${label} contains duplicate scheduled game ${key}`);
    }
    result.set(key, game);
  }
  return result;
}

function placementBounds(
  game: AiBenchmarkGameResult,
  strategyId: AiStrategyId,
): { best: number; worst: number; exact: boolean } | undefined {
  const bounds = game.strategyPlacementBounds[strategyId];
  if (bounds) {
    return bounds;
  }
  const placement = game.strategyPlacements[strategyId];
  return placement === undefined
    ? undefined
    : { best: placement, worst: placement, exact: true };
}

function placementRateBounds(
  bounds: { best: number; worst: number },
  metric: ConservativeRateMetric,
): { lower: number; upper: number } {
  if (metric === "topFour") {
    return {
      lower: bounds.worst <= 4 ? 1 : 0,
      upper: bounds.best <= 4 ? 1 : 0,
    };
  }
  if (metric === "win") {
    return {
      lower: bounds.worst === 1 ? 1 : 0,
      upper: bounds.best === 1 ? 1 : 0,
    };
  }
  throw new Error(`unsupported conservative rate metric ${metric}`);
}

export function studentTCritical95(degreesOfFreedom: number): number {
  const table = [
    0,
    12.706,
    4.303,
    3.182,
    2.776,
    2.571,
    2.447,
    2.365,
    2.306,
    2.262,
    2.228,
    2.201,
    2.179,
    2.16,
    2.145,
    2.131,
    2.12,
    2.11,
    2.101,
    2.093,
    2.086,
    2.08,
    2.074,
    2.069,
    2.064,
    2.06,
    2.056,
    2.052,
    2.048,
    2.045,
  ];
  if (!Number.isSafeInteger(degreesOfFreedom) || degreesOfFreedom < 1) {
    throw new Error("degreesOfFreedom must be a positive integer");
  }
  if (degreesOfFreedom < table.length) {
    return table[degreesOfFreedom];
  }

  // Student-t decreases monotonically toward the normal critical value. For
  // unlisted degrees of freedom, use the closest lower tabulated df so the
  // interval is never narrower than the exact interval. In particular, the
  // pre-registered 96-cluster confirmation uses df=95 => 1.985252 (the
  // exact value rounded upward at six decimals).
  const largeSampleTable = [
    [30, 2.042273],
    [40, 2.021076],
    [50, 2.00856],
    [60, 2.000298],
    [70, 1.994438],
    [80, 1.990064],
    [90, 1.986675],
    [95, 1.985252],
    [100, 1.983972],
    [120, 1.979931],
    [150, 1.975906],
    [200, 1.971897],
    [300, 1.967904],
    [500, 1.96472],
    [1_000, 1.96234],
  ] as const;
  let conservativeCritical: number = largeSampleTable[0][1];
  for (const [df, critical] of largeSampleTable) {
    if (df > degreesOfFreedom) break;
    conservativeCritical = critical;
  }
  return conservativeCritical;
}

export function comparePairedPlacements(
  incumbentGames: readonly AiBenchmarkGameResult[],
  candidateGames: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
): PairedPlacementComparison {
  const incumbents = uniqueGamesByKey(incumbentGames, "incumbent games");
  uniqueGamesByKey(candidateGames, "candidate games");
  const deltasBySeed = new Map<number, number[]>();
  let pairedGames = 0;
  for (const candidate of candidateGames) {
    const incumbent = incumbents.get(gameKey(candidate));
    const incumbentPlacement = incumbent?.strategyPlacements[strategyId];
    const candidatePlacement = candidate.strategyPlacements[strategyId];
    if (incumbentPlacement === undefined || candidatePlacement === undefined) {
      continue;
    }
    const seedDeltas = deltasBySeed.get(candidate.seed) ?? [];
    seedDeltas.push(candidatePlacement - incumbentPlacement);
    deltasBySeed.set(candidate.seed, seedDeltas);
    pairedGames += 1;
  }

  return summarizeSeedDeltas(deltasBySeed, pairedGames);
}

function summarizeSeedDeltas(
  deltasBySeed: ReadonlyMap<number, readonly number[]>,
  pairedGames: number,
): PairedPlacementComparison {
  const clusterMeans = [...deltasBySeed.values()].map(
    (deltas) => deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
  );
  if (clusterMeans.length === 0) {
    return {
      pairedGames,
      seedClusters: 0,
      meanPlacementDelta: null,
      confidence95: null,
    };
  }
  const mean =
    clusterMeans.reduce((sum, value) => sum + value, 0) /
    clusterMeans.length;
  if (clusterMeans.length === 1) {
    return {
      pairedGames,
      seedClusters: 1,
      meanPlacementDelta: mean,
      confidence95: null,
    };
  }
  const squaredDeviation = clusterMeans.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  );
  const sampleVariance = squaredDeviation / (clusterMeans.length - 1);
  const standardError = Math.sqrt(sampleVariance / clusterMeans.length);
  const margin =
    studentTCritical95(clusterMeans.length - 1) * standardError;
  return {
    pairedGames,
    seedClusters: clusterMeans.length,
    meanPlacementDelta: mean,
    confidence95: {
      lower: mean - margin,
      upper: mean + margin,
    },
  };
}

function summarizeRateDeltas(
  deltasBySeed: ReadonlyMap<number, readonly number[]>,
  pairedGames: number,
): PairedRateComparison {
  const summary = summarizeSeedDeltas(deltasBySeed, pairedGames);
  return {
    pairedGames: summary.pairedGames,
    seedClusters: summary.seedClusters,
    meanRateDelta: summary.meanPlacementDelta,
    confidence95: summary.confidence95,
  };
}

function compareIdenticalPlacementBounds(
  games: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
): PairedPlacementComparison {
  uniqueGamesByKey(games, "identical benchmark games");
  const deltasBySeed = new Map<number, number[]>();
  let pairedGames = 0;
  for (const game of games) {
    if (!placementBounds(game, strategyId)) {
      continue;
    }
    const seedDeltas = deltasBySeed.get(game.seed) ?? [];
    seedDeltas.push(0);
    deltasBySeed.set(game.seed, seedDeltas);
    pairedGames += 1;
  }
  return summarizeSeedDeltas(deltasBySeed, pairedGames);
}

function rateComparisonFromPlacement(
  comparison: PairedPlacementComparison,
): PairedRateComparison {
  return {
    pairedGames: comparison.pairedGames,
    seedClusters: comparison.seedClusters,
    meanRateDelta: comparison.meanPlacementDelta,
    confidence95: comparison.confidence95,
  };
}

/**
 * Compare every matched game's worst case for the candidate against the best
 * case for the incumbent. Negative placement delta is better. This preserves
 * valid information from truncated games without inventing a finishing rank.
 */
export function compareConservativePlacementBounds(
  incumbentGames: readonly AiBenchmarkGameResult[],
  candidateGames: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
): PairedPlacementComparison {
  const incumbents = uniqueGamesByKey(incumbentGames, "incumbent games");
  uniqueGamesByKey(candidateGames, "candidate games");
  const deltasBySeed = new Map<number, number[]>();
  let pairedGames = 0;
  for (const candidate of candidateGames) {
    const incumbent = incumbents.get(gameKey(candidate));
    const incumbentBounds = incumbent
      ? placementBounds(incumbent, strategyId)
      : undefined;
    const candidateBounds = placementBounds(candidate, strategyId);
    if (!incumbentBounds || !candidateBounds) {
      continue;
    }
    const seedDeltas = deltasBySeed.get(candidate.seed) ?? [];
    seedDeltas.push(candidateBounds.worst - incumbentBounds.best);
    deltasBySeed.set(candidate.seed, seedDeltas);
    pairedGames += 1;
  }
  return summarizeSeedDeltas(deltasBySeed, pairedGames);
}

/**
 * Bound a binary placement metric without filling in a truncated rank. The
 * reported delta is candidate minus incumbent, so positive is better. Each
 * game uses the candidate's lower bound and the incumbent's upper bound.
 */
export function compareConservativeRateBounds(
  incumbentGames: readonly AiBenchmarkGameResult[],
  candidateGames: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
  metric: ConservativeRateMetric,
): PairedRateComparison {
  const incumbents = uniqueGamesByKey(incumbentGames, "incumbent games");
  uniqueGamesByKey(candidateGames, "candidate games");
  const deltasBySeed = new Map<number, number[]>();
  let pairedGames = 0;
  for (const candidate of candidateGames) {
    const incumbent = incumbents.get(gameKey(candidate));
    const incumbentPlacementBounds = incumbent
      ? placementBounds(incumbent, strategyId)
      : undefined;
    const candidatePlacementBounds = placementBounds(candidate, strategyId);
    if (!incumbentPlacementBounds || !candidatePlacementBounds) {
      continue;
    }
    const incumbentRate = placementRateBounds(
      incumbentPlacementBounds,
      metric,
    );
    const candidateRate = placementRateBounds(
      candidatePlacementBounds,
      metric,
    );
    const seedDeltas = deltasBySeed.get(candidate.seed) ?? [];
    seedDeltas.push(candidateRate.lower - incumbentRate.upper);
    deltasBySeed.set(candidate.seed, seedDeltas);
    pairedGames += 1;
  }
  return summarizeRateDeltas(deltasBySeed, pairedGames);
}

function runVariant(
  profile: AiStrategyProfile,
  playerId: string,
  parameter: TunableAiProfileKey,
  value: number,
  seeds: number,
  startSeed: number,
  maxRounds: number,
  stage: AiPolicySearchProgress["stage"],
  onProgress: AiPolicySearchOptions["onProgress"],
): AiBenchmarkResult {
  assertNoAiResidualPolicyOverrides(`${stage} value=${value} start`);
  const candidate = { ...profile, [parameter]: value };
  const result = runAiBenchmark({
    seeds,
    startSeed,
    maxRounds,
    includeGames: true,
    profileOverrides: new Map([[playerId, candidate]]),
    onProgress: onProgress
      ? (progress) => onProgress({ ...progress, stage, value })
      : undefined,
  });
  assertNoAiResidualPolicyOverrides(`${stage} value=${value} end`);
  return result;
}

function assertComparableBenchmarks(
  incumbent: AiBenchmarkResult,
  candidate: AiBenchmarkResult,
): void {
  for (const [label, result] of [
    ["incumbent", incumbent],
    ["candidate", candidate],
  ] as const) {
    if (
      !result.evaluatorStable ||
      !result.contentSnapshotStable ||
      !result.strategyProfilesStable
    ) {
      throw new Error(`${label} benchmark provenance was not stable`);
    }
  }
  const fields = [
    "contentVersion",
    "contentSnapshotSha256",
    "policyVersion",
    "evaluatorHash",
    "seeds",
    "startSeed",
    "maxRounds",
    "rotationsPerSeed",
    "scheduledGames",
  ] as const;
  for (const field of fields) {
    if (incumbent[field] !== candidate[field]) {
      throw new Error(`benchmark arms differ on ${field}`);
    }
  }
}

function summarizeVariant(
  value: number,
  result: AiBenchmarkResult,
  incumbent: AiBenchmarkResult,
  strategyId: AiStrategyId,
): AiPolicyVariantSummary {
  assertComparableBenchmarks(incumbent, result);
  const target = targetResult(result, strategyId);
  const comparison = comparePairedPlacements(
    incumbent.games ?? [],
    result.games ?? [],
    strategyId,
  );
  const identicalBoundsComparison =
    result === incumbent
      ? compareIdenticalPlacementBounds(result.games ?? [], strategyId)
      : null;
  const conservativeComparison =
    identicalBoundsComparison ??
    compareConservativePlacementBounds(
      incumbent.games ?? [],
      result.games ?? [],
      strategyId,
    );
  const conservativeTopFourComparison = identicalBoundsComparison
    ? rateComparisonFromPlacement(identicalBoundsComparison)
    : compareConservativeRateBounds(
        incumbent.games ?? [],
        result.games ?? [],
        strategyId,
        "topFour",
      );
  const conservativeWinRateComparison = identicalBoundsComparison
    ? rateComparisonFromPlacement(identicalBoundsComparison)
    : compareConservativeRateBounds(
        incumbent.games ?? [],
        result.games ?? [],
        strategyId,
        "win",
      );
  return {
    value,
    contentSnapshotSha256: result.contentSnapshotSha256,
    contentSnapshotSha256After: result.contentSnapshotSha256After,
    contentSnapshotStable: result.contentSnapshotStable,
    evaluatorHash: result.evaluatorHash,
    evaluatorHashAfter: result.evaluatorHashAfter,
    evaluatorStable: result.evaluatorStable,
    strategyProfileHash: result.strategyProfileHash,
    strategyProfileHashAfter: result.strategyProfileHashAfter,
    strategyProfilesStable: result.strategyProfilesStable,
    scheduledGames: result.scheduledGames,
    completedGames: result.completedGames,
    drawnGames: result.drawnGames,
    truncatedGames: result.truncatedGames,
    averagePlacement: target.averagePlacement,
    topFourRate: target.topFourRate,
    winRate: target.winRate,
    comparisonToIncumbent: comparison,
    conservativeComparisonToIncumbent: conservativeComparison,
    conservativeTopFourComparisonToIncumbent:
      conservativeTopFourComparison,
    conservativeWinRateComparisonToIncumbent:
      conservativeWinRateComparison,
    trainingScore:
      conservativeComparison.meanPlacementDelta === null ||
      conservativeComparison.pairedGames !== result.scheduledGames ||
      result.drawnGames > 0 ||
      incumbent.drawnGames > 0
        ? null
        : conservativeComparison.meanPlacementDelta,
  };
}

function variantSortScore(variant: AiPolicyVariantSummary): number {
  return variant.trainingScore ?? Number.POSITIVE_INFINITY;
}

function confirmationRegistrationMismatchReasons(
  evidence: AiPolicyConfirmationGateEvidence,
): string[] {
  const registration = AI_POLICY_CONFIRMATION_REGISTRATION;
  const reasons: string[] = [];
  const requireMatch = (condition: boolean, reason: string) => {
    if (!condition) reasons.push(reason);
  };
  requireMatch(
    evidence.registrationId === registration.id,
    `confirmation registration id must be ${registration.id}`,
  );
  requireMatch(
    evidence.strategyId === registration.strategyId,
    `confirmation strategy must be ${registration.strategyId}`,
  );
  requireMatch(
    evidence.parameter === registration.parameter,
    `confirmation parameter must be ${registration.parameter}`,
  );
  requireMatch(
    evidence.liveValue === registration.liveValue,
    `confirmation live value must be ${registration.liveValue}`,
  );
  requireMatch(
    evidence.incumbentValue === registration.incumbentValue,
    `confirmation incumbent must be ${registration.incumbentValue}`,
  );
  requireMatch(
    evidence.candidateValue === registration.candidateValue,
    `confirmation candidate must be ${registration.candidateValue}`,
  );
  requireMatch(
    evidence.configuredSeeds === registration.seeds,
    `confirmation requires exactly ${registration.seeds} seed clusters`,
  );
  requireMatch(
    evidence.startSeed === registration.startSeed,
    `confirmation start seed must be ${registration.startSeed}`,
  );
  requireMatch(
    evidence.maxRounds === registration.maxRounds,
    `confirmation max rounds must be ${registration.maxRounds}`,
  );
  requireMatch(
    evidence.rotationsPerSeed === registration.rotationsPerSeed,
    `confirmation rotations per seed must be ${registration.rotationsPerSeed}`,
  );
  requireMatch(
    evidence.scheduledGames === registration.scheduledGames,
    `confirmation must schedule exactly ${registration.scheduledGames} games per arm`,
  );
  requireMatch(
    evidence.minimumPlacementImprovement ===
      registration.minimumPlacementImprovement,
    `minimum placement improvement must equal ${registration.minimumPlacementImprovement.toFixed(2)}`,
  );
  requireMatch(
    evidence.topFourNoninferiorityGuard ===
      registration.topFourNoninferiorityGuard,
    `top-four noninferiority guard must equal ${registration.topFourNoninferiorityGuard.toFixed(2)}`,
  );
  requireMatch(
    evidence.winRateNoninferiorityGuard ===
      registration.winRateNoninferiorityGuard,
    `win-rate noninferiority guard must equal ${registration.winRateNoninferiorityGuard.toFixed(2)}`,
  );
  return reasons;
}

export function evaluateAiPolicyConfirmationGate(
  evidence: AiPolicyConfirmationGateEvidence,
): { accepted: boolean; reasons: string[] } {
  const reasons = confirmationRegistrationMismatchReasons(evidence);
  const requireCondition = (condition: boolean, reason: string) => {
    if (!condition) reasons.push(reason);
  };
  const expectedPairs = AI_POLICY_CONFIRMATION_REGISTRATION.scheduledGames;
  requireCondition(
    evidence.incumbentDrawnGames === 0 &&
      evidence.candidateDrawnGames === 0,
    "confirmation requires zero drawn games",
  );
  requireCondition(
    evidence.incumbentTruncatedGames === 0 &&
      evidence.candidateTruncatedGames === 0,
    "confirmation requires zero truncated games",
  );
  requireCondition(
    evidence.provenanceStable,
    "confirmation requires stable evaluator, content, and profile provenance",
  );

  for (const [label, comparison] of [
    ["placement", evidence.placement],
    ["top-four", evidence.topFour],
    ["win", evidence.win],
  ] as const) {
    requireCondition(
      comparison.pairedGames === expectedPairs,
      `${label} comparison requires all ${expectedPairs} pairs`,
    );
    requireCondition(
      comparison.seedClusters === AI_POLICY_CONFIRMATION_REGISTRATION.seeds,
      `${label} comparison requires exactly ${AI_POLICY_CONFIRMATION_REGISTRATION.seeds} seed clusters`,
    );
  }
  requireCondition(
    evidence.placement.meanPlacementDelta !== null &&
      evidence.placement.meanPlacementDelta <=
        -AI_POLICY_CONFIRMATION_REGISTRATION.minimumPlacementImprovement,
    `mean placement delta must be at most -${AI_POLICY_CONFIRMATION_REGISTRATION.minimumPlacementImprovement.toFixed(2)}`,
  );
  requireCondition(
    evidence.placement.confidence95 !== null &&
      evidence.placement.confidence95.upper < 0,
    "placement CI upper bound must be below 0",
  );
  requireCondition(
    evidence.topFour.confidence95 !== null &&
      evidence.topFour.confidence95.lower >=
        -TOP_FOUR_NONINFERIORITY_GUARD,
    "top-four CI lower bound must be at least -0.02",
  );
  requireCondition(
    evidence.win.confidence95 !== null &&
      evidence.win.confidence95.lower >= -WIN_RATE_NONINFERIORITY_GUARD,
    "win CI lower bound must be at least -0.03",
  );
  return { accepted: reasons.length === 0, reasons };
}

function trainingScreenRegistrationMatches(
  evidence: AiPolicyTrainingScreenEvidence,
): boolean {
  const registration = AI_POLICY_TRAINING_SCREEN_REGISTRATION;
  const candidateIds = evidence.candidates.map(
    (candidate) => candidate.candidateId,
  );
  return (
    evidence.registrationId === registration.id &&
    evidence.seeds === registration.seeds &&
    evidence.startSeed === registration.startSeed &&
    evidence.maxRounds === registration.maxRounds &&
    evidence.rotationsPerSeed === registration.rotationsPerSeed &&
    evidence.scheduledGames === registration.scheduledGames &&
    evidence.minimumPlacementImprovement ===
      registration.minimumPlacementImprovement &&
    evidence.topFourNoninferiorityGuard ===
      registration.topFourNoninferiorityGuard &&
    evidence.winRateNoninferiorityGuard ===
      registration.winRateNoninferiorityGuard &&
    candidateIds.length === registration.candidateIds.length &&
    new Set(candidateIds).size === registration.candidateIds.length &&
    registration.candidateIds.every((candidateId) =>
      candidateIds.includes(candidateId),
    )
  );
}

export function evaluateAiPolicyTrainingCandidateQualification(
  candidate: AiPolicyTrainingCandidateEvidence,
  evidence: AiPolicyTrainingScreenEvidence,
): { qualified: boolean; reasons: string[] } {
  const registration = AI_POLICY_TRAINING_SCREEN_REGISTRATION;
  const reasons: string[] = [];
  const requireCondition = (condition: boolean, reason: string) => {
    if (!condition) reasons.push(reason);
  };
  requireCondition(
    trainingScreenRegistrationMatches(evidence),
    "training screen configuration does not match the fixed registration",
  );
  requireCondition(
    evidence.provenanceStable && candidate.provenanceStable,
    "training screen provenance or candidate profile binding is unstable",
  );
  requireCondition(
    evidence.baselineScheduledGames === registration.scheduledGames,
    `baseline must schedule exactly ${registration.scheduledGames} games`,
  );
  requireCondition(
    evidence.baselineDrawnGames === 0,
    "baseline must contain zero drawn games",
  );
  requireCondition(
    evidence.baselineTruncatedGames === 0,
    "baseline must contain zero truncated games",
  );
  requireCondition(
    candidate.scheduledGames === registration.scheduledGames,
    `candidate must schedule exactly ${registration.scheduledGames} games`,
  );
  requireCondition(
    candidate.drawnGames === 0,
    "candidate must contain zero drawn games",
  );
  requireCondition(
    candidate.truncatedGames === 0,
    "candidate must contain zero truncated games",
  );
  for (const [label, comparison] of [
    ["placement", candidate.placement],
    ["top-four", candidate.topFour],
    ["win", candidate.win],
  ] as const) {
    requireCondition(
      comparison.pairedGames === registration.scheduledGames,
      `${label} comparison requires all ${registration.scheduledGames} pairs`,
    );
    requireCondition(
      comparison.seedClusters === registration.seeds,
      `${label} comparison requires exactly ${registration.seeds} seed clusters`,
    );
    requireCondition(
      comparison.confidence95 !== null,
      `${label} comparison requires a 95% interval`,
    );
  }
  requireCondition(
    candidate.placement.meanPlacementDelta !== null &&
      candidate.placement.meanPlacementDelta <=
        -registration.minimumPlacementImprovement,
    `mean placement delta must be at most -${registration.minimumPlacementImprovement.toFixed(2)}`,
  );
  requireCondition(
    candidate.placement.confidence95 !== null &&
      candidate.placement.confidence95.upper < 0,
    "placement CI upper bound must be below 0",
  );
  requireCondition(
    candidate.topFour.meanRateDelta !== null &&
      candidate.topFour.confidence95 !== null &&
      candidate.topFour.confidence95.lower >=
        -registration.topFourNoninferiorityGuard,
    `top-four CI lower bound must be at least -${registration.topFourNoninferiorityGuard.toFixed(2)}`,
  );
  requireCondition(
    candidate.win.meanRateDelta !== null &&
      candidate.win.confidence95 !== null &&
      candidate.win.confidence95.lower >=
        -registration.winRateNoninferiorityGuard,
    `win CI lower bound must be at least -${registration.winRateNoninferiorityGuard.toFixed(2)}`,
  );
  return { qualified: reasons.length === 0, reasons };
}

export function selectAiPolicyTrainingCandidate(
  evidence: AiPolicyTrainingScreenEvidence,
): AiPolicyTrainingCandidateId | null {
  if (!trainingScreenRegistrationMatches(evidence)) {
    return null;
  }
  const eligible = evidence.candidates.filter(
    (candidate) =>
      evaluateAiPolicyTrainingCandidateQualification(candidate, evidence)
        .qualified,
  );
  eligible.sort((left, right) => {
    const placementUpperDifference =
      (left.placement.confidence95?.upper ?? Number.POSITIVE_INFINITY) -
      (right.placement.confidence95?.upper ?? Number.POSITIVE_INFINITY);
    if (placementUpperDifference !== 0) {
      return placementUpperDifference;
    }
    const winLowerDifference =
      (right.win.confidence95?.lower ?? Number.NEGATIVE_INFINITY) -
      (left.win.confidence95?.lower ?? Number.NEGATIVE_INFINITY);
    if (winLowerDifference !== 0) {
      return winLowerDifference;
    }
    const topFourLowerDifference =
      (right.topFour.confidence95?.lower ?? Number.NEGATIVE_INFINITY) -
      (left.topFour.confidence95?.lower ?? Number.NEGATIVE_INFINITY);
    if (topFourLowerDifference !== 0) {
      return topFourLowerDifference;
    }
    return left.candidateId < right.candidateId
      ? -1
      : left.candidateId > right.candidateId
        ? 1
        : 0;
  });
  return eligible[0]?.candidateId ?? null;
}

export function runAiPolicySearch(
  options: AiPolicySearchOptions,
): AiPolicySearchResult {
  assertNoAiResidualPolicyOverrides("search start");
  const input = Object.freeze({
    strategyId: options.strategyId,
    parameter: options.parameter,
    values: Object.freeze([...options.values]),
    incumbentValue: options.incumbentValue,
    trainSeeds: options.trainSeeds,
    trainStartSeed: options.trainStartSeed,
    holdoutSeeds: options.holdoutSeeds,
    holdoutStartSeed: options.holdoutStartSeed,
    maxRounds: options.maxRounds,
    minimumPlacementImprovement: options.minimumPlacementImprovement,
    onProgress: options.onProgress,
  });
  const searchEvaluatorHashBefore = computeAiPolicySearchEvaluatorHash();
  const contentSnapshotSha256Before =
    computeAiBenchmarkContentSnapshotSha256();
  const strategyProfileHash = computeAiBenchmarkStrategyProfileHash();
  if (!TUNABLE_KEYS.has(input.parameter)) {
    throw new Error(`unsupported AI profile parameter ${input.parameter}`);
  }
  const trainSeeds = positiveInteger(
    input.trainSeeds,
    DEFAULT_TRAIN_SEEDS,
    "trainSeeds",
  );
  const holdoutSeeds = positiveInteger(
    input.holdoutSeeds,
    DEFAULT_HOLDOUT_SEEDS,
    "holdoutSeeds",
  );
  const trainStartSeed = safeInteger(
    input.trainStartSeed,
    7_001,
    "trainStartSeed",
  );
  const holdoutStartSeed = safeInteger(
    input.holdoutStartSeed,
    9_001,
    "holdoutStartSeed",
  );
  if (
    trainStartSeed < holdoutStartSeed + holdoutSeeds &&
    holdoutStartSeed < trainStartSeed + trainSeeds
  ) {
    throw new Error("training and holdout seed ranges must not overlap");
  }
  const maxRounds = positiveInteger(input.maxRounds, 100, "maxRounds");
  const minimumPlacementImprovement =
    input.minimumPlacementImprovement ?? 0.1;
  if (
    !Number.isFinite(minimumPlacementImprovement) ||
    minimumPlacementImprovement < 0.1
  ) {
    throw new Error(
      "minimumPlacementImprovement must be finite and at least 0.10",
    );
  }

  const playerId = strategyPlayerId(input.strategyId);
  const profile = getAiStrategyProfile(playerId);
  const liveValue = profile[input.parameter];
  const incumbentValue = input.incumbentValue ?? liveValue;
  const values = [...new Set([incumbentValue, ...input.values])];
  for (const value of values) {
    validateCandidateValue(input.parameter, value);
  }
  if (incumbentValue !== liveValue) {
    throw new Error(
      `search incumbent ${incumbentValue} must equal live value ${liveValue}`,
    );
  }

  const trainingResults = new Map<number, AiBenchmarkResult>();
  for (const value of values) {
    trainingResults.set(
      value,
      runVariant(
        profile,
        playerId,
        input.parameter,
        value,
        trainSeeds,
        trainStartSeed,
        maxRounds,
        "training",
        input.onProgress,
      ),
    );
  }
  const trainingIncumbent = trainingResults.get(incumbentValue);
  if (!trainingIncumbent) {
    throw new Error("training incumbent result is missing");
  }
  const trainingVariants = values.map((value) => {
    const result = trainingResults.get(value);
    if (!result) {
      throw new Error(`training result is missing for ${value}`);
    }
    return summarizeVariant(
      value,
      result,
      trainingIncumbent,
      input.strategyId,
    );
  });
  const recommended = [...trainingVariants].sort(
    (left, right) =>
      variantSortScore(left) - variantSortScore(right) ||
      Number(left.value !== incumbentValue) -
        Number(right.value !== incumbentValue) ||
      left.value - right.value,
  )[0];

  const holdoutIncumbentResult = runVariant(
    profile,
    playerId,
    input.parameter,
    incumbentValue,
    holdoutSeeds,
    holdoutStartSeed,
    maxRounds,
    "holdout",
    input.onProgress,
  );
  const holdoutCandidateResult =
    recommended.value === incumbentValue
      ? holdoutIncumbentResult
      : runVariant(
          profile,
          playerId,
          input.parameter,
          recommended.value,
          holdoutSeeds,
          holdoutStartSeed,
          maxRounds,
          "holdout",
          input.onProgress,
        );
  const holdoutIncumbent = summarizeVariant(
    incumbentValue,
    holdoutIncumbentResult,
    holdoutIncumbentResult,
    input.strategyId,
  );
  const holdoutCandidate = summarizeVariant(
    recommended.value,
    holdoutCandidateResult,
    holdoutIncumbentResult,
    input.strategyId,
  );

  const scheduledTrainingGames = trainSeeds * 8;
  const scheduledHoldoutGames = holdoutSeeds * 8;
  const reasons: string[] = [];
  if (recommended.value === incumbentValue) {
    reasons.push("training did not select a different value");
  }
  if (
    (recommended.conservativeComparisonToIncumbent.meanPlacementDelta ?? 0) >
    -minimumPlacementImprovement
  ) {
    reasons.push("training placement improvement is below the threshold");
  }
  if (
    recommended.conservativeComparisonToIncumbent.pairedGames !==
      scheduledTrainingGames ||
    recommended.drawnGames > 0
  ) {
    reasons.push("training placement bounds are incomplete or drawn");
  }
  if (holdoutIncumbent.drawnGames > 0 || holdoutCandidate.drawnGames > 0) {
    reasons.push("holdout contains drawn games");
  }
  if (
    holdoutCandidate.conservativeComparisonToIncumbent.pairedGames !==
      scheduledHoldoutGames ||
    holdoutCandidate.conservativeTopFourComparisonToIncumbent.pairedGames !==
      scheduledHoldoutGames ||
    holdoutCandidate.conservativeWinRateComparisonToIncumbent.pairedGames !==
      scheduledHoldoutGames
  ) {
    reasons.push("holdout schedule keys or conservative bounds are incomplete");
  }
  if (
    holdoutCandidate.conservativeComparisonToIncumbent.seedClusters <
    MINIMUM_HOLDOUT_SEED_CLUSTERS
  ) {
    reasons.push(
      `holdout needs at least ${MINIMUM_HOLDOUT_SEED_CLUSTERS} independent seed clusters`,
    );
  }
  if (
    (holdoutCandidate.conservativeComparisonToIncumbent.meanPlacementDelta ??
      0) >
    -minimumPlacementImprovement
  ) {
    reasons.push(
      "holdout worst-case placement improvement is below the threshold",
    );
  }
  if (
    (holdoutCandidate.conservativeComparisonToIncumbent.confidence95?.upper ??
      0) >= 0
  ) {
    reasons.push(
      "holdout worst-case 95% seed-cluster interval still includes no gain",
    );
  }
  if (
    (holdoutCandidate.conservativeTopFourComparisonToIncumbent.confidence95
      ?.lower ?? Number.NEGATIVE_INFINITY) <
    -TOP_FOUR_NONINFERIORITY_GUARD
  ) {
    reasons.push(
      "holdout worst-case top-four interval regressed beyond the guardrail",
    );
  }
  if (
    (holdoutCandidate.conservativeWinRateComparisonToIncumbent.confidence95
      ?.lower ?? Number.NEGATIVE_INFINITY) <
    -WIN_RATE_NONINFERIORITY_GUARD
  ) {
    reasons.push(
      "holdout worst-case win-rate interval regressed beyond the guardrail",
    );
  }

  const searchEvaluatorHashAfter = computeAiPolicySearchEvaluatorHash();
  const searchEvaluatorStable =
    searchEvaluatorHashBefore === SEARCH_EVALUATOR_HASH &&
    searchEvaluatorHashAfter === SEARCH_EVALUATOR_HASH;
  if (!searchEvaluatorStable) {
    reasons.push("search evaluator source changed during the search");
  }
  const contentSnapshotSha256After =
    computeAiBenchmarkContentSnapshotSha256();
  const contentSnapshotStable =
    contentSnapshotSha256Before === SEARCH_CONTENT_SNAPSHOT_SHA256 &&
    contentSnapshotSha256After === SEARCH_CONTENT_SNAPSHOT_SHA256;
  if (!contentSnapshotStable) {
    reasons.push("pinned Battlegrounds content changed during the search");
  }
  const strategyProfileHashAfter = computeAiBenchmarkStrategyProfileHash();
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  if (!strategyProfilesStable) {
    reasons.push("live AI strategy profiles changed during the search");
  }

  return {
    contentVersion: holdoutIncumbentResult.contentVersion,
    contentSnapshotSha256: SEARCH_CONTENT_SNAPSHOT_SHA256,
    contentSnapshotSha256After,
    contentSnapshotStable,
    policyVersion: holdoutIncumbentResult.policyVersion,
    evaluatorHash: holdoutIncumbentResult.evaluatorHash,
    searchEvaluatorHash: SEARCH_EVALUATOR_HASH,
    searchEvaluatorHashAfter,
    searchEvaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    strategyId: input.strategyId,
    playerId,
    parameter: input.parameter,
    liveValue,
    incumbentValue,
    recommendedValue: recommended.value,
    accepted: reasons.length === 0,
    acceptanceReasons: reasons,
    config: {
      trainSeeds,
      trainStartSeed,
      holdoutSeeds,
      holdoutStartSeed,
      maxRounds,
      rotationsPerSeed: holdoutIncumbentResult.rotationsPerSeed,
      trainingScheduledGames: scheduledTrainingGames,
      holdoutScheduledGames: scheduledHoldoutGames,
      minimumPlacementImprovement,
      topFourNoninferiorityGuard: TOP_FOUR_NONINFERIORITY_GUARD,
      winRateNoninferiorityGuard: WIN_RATE_NONINFERIORITY_GUARD,
    },
    training: {
      seeds: trainSeeds,
      startSeed: trainStartSeed,
      variants: trainingVariants,
    },
    holdout: {
      seeds: holdoutSeeds,
      startSeed: holdoutStartSeed,
      incumbent: holdoutIncumbent,
      candidate: holdoutCandidate,
    },
    note:
      "Search is read-only and never edits the live profile. Placement uses candidate-worst minus incumbent-best (negative is better); rate guards use candidate-lower minus incumbent-upper (positive is better).",
  };
}

export function runAiPolicyConfirmation(
  options: AiPolicyConfirmationOptions,
): AiPolicyConfirmationResult {
  assertNoAiResidualPolicyOverrides("confirmation start");
  const input = Object.freeze({
    strategyId: options.strategyId,
    parameter: options.parameter,
    incumbentValue: options.incumbentValue,
    candidateValue: options.candidateValue,
    seeds: options.seeds,
    startSeed: options.startSeed,
    maxRounds: options.maxRounds,
    minimumPlacementImprovement: options.minimumPlacementImprovement,
    onProgress: options.onProgress,
  });
  if (!TUNABLE_KEYS.has(input.parameter)) {
    throw new Error(`unsupported AI profile parameter ${input.parameter}`);
  }
  const seeds = positiveInteger(
    input.seeds,
    AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS,
    "seeds",
  );
  const startSeed = safeInteger(
    input.startSeed,
    AI_POLICY_CONFIRMATION_REGISTRATION.startSeed,
    "startSeed",
  );
  if (!Number.isSafeInteger(startSeed + seeds - 1)) {
    throw new Error("confirmation seed range must contain safe integers");
  }
  const maxRounds = positiveInteger(
    input.maxRounds,
    AI_POLICY_CONFIRMATION_REGISTRATION.maxRounds,
    "maxRounds",
  );
  const minimumPlacementImprovement =
    input.minimumPlacementImprovement ??
    AI_POLICY_CONFIRMATION_REGISTRATION.minimumPlacementImprovement;
  if (
    !Number.isFinite(minimumPlacementImprovement) ||
    minimumPlacementImprovement < 0.1
  ) {
    throw new Error(
      "minimumPlacementImprovement must be finite and at least 0.10",
    );
  }

  const playerId = strategyPlayerId(input.strategyId);
  const profile = getAiStrategyProfile(playerId);
  const liveValue = profile[input.parameter];
  const incumbentValue = input.incumbentValue ?? liveValue;
  validateCandidateValue(input.parameter, incumbentValue);
  validateCandidateValue(input.parameter, input.candidateValue);
  if (incumbentValue !== liveValue) {
    throw new Error(
      `confirmation incumbent ${incumbentValue} must equal live value ${liveValue}`,
    );
  }
  if (input.candidateValue === incumbentValue) {
    throw new Error("confirmation candidate must differ from the incumbent");
  }

  const searchEvaluatorHashBefore = computeAiPolicySearchEvaluatorHash();
  const contentSnapshotSha256Before =
    computeAiBenchmarkContentSnapshotSha256();
  const strategyProfileHash = computeAiBenchmarkStrategyProfileHash();
  const expectedCandidateStrategyProfileHash =
    withAiStrategyProfileOverrides(
      new Map([
        [
          playerId,
          { ...profile, [input.parameter]: input.candidateValue },
        ],
      ]),
      computeAiBenchmarkStrategyProfileHash,
    );
  const runArm = (
    arm: AiPolicyConfirmationProgress["arm"],
    value: number,
  ): AiBenchmarkResult =>
    runVariant(
      profile,
      playerId,
      input.parameter,
      value,
      seeds,
      startSeed,
      maxRounds,
      "holdout",
      input.onProgress
        ? ({
            processedGames,
            scheduledGames,
            seed,
            rotation,
            completed,
          }) =>
            input.onProgress?.({
              processedGames,
              scheduledGames,
              seed,
              rotation,
              completed,
              arm,
              value,
            })
        : undefined,
    );

  const incumbentResult = runArm("incumbent", incumbentValue);
  const candidateResult = runArm("candidate", input.candidateValue);
  const incumbent = summarizeVariant(
    incumbentValue,
    incumbentResult,
    incumbentResult,
    input.strategyId,
  );
  const candidate = summarizeVariant(
    input.candidateValue,
    candidateResult,
    incumbentResult,
    input.strategyId,
  );

  const searchEvaluatorHashAfter = computeAiPolicySearchEvaluatorHash();
  const searchEvaluatorStable =
    searchEvaluatorHashBefore === SEARCH_EVALUATOR_HASH &&
    searchEvaluatorHashAfter === SEARCH_EVALUATOR_HASH;
  const contentSnapshotSha256After =
    computeAiBenchmarkContentSnapshotSha256();
  const contentSnapshotStable =
    contentSnapshotSha256Before === SEARCH_CONTENT_SNAPSHOT_SHA256 &&
    contentSnapshotSha256After === SEARCH_CONTENT_SNAPSHOT_SHA256;
  const strategyProfileHashAfter = computeAiBenchmarkStrategyProfileHash();
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  const strategyProfileBindingsStable =
    incumbentResult.strategyProfileHash === strategyProfileHash &&
    incumbentResult.strategyProfileHashAfter === strategyProfileHash &&
    candidateResult.strategyProfileHash ===
      expectedCandidateStrategyProfileHash &&
    candidateResult.strategyProfileHashAfter ===
      expectedCandidateStrategyProfileHash;
  const evaluatorHashAfter = candidateResult.evaluatorHashAfter;
  const evaluatorStable =
    incumbentResult.evaluatorStable &&
    candidateResult.evaluatorStable &&
    incumbentResult.evaluatorHash === candidateResult.evaluatorHash &&
    incumbentResult.evaluatorHashAfter === candidateResult.evaluatorHashAfter;
  const provenanceStable =
    searchEvaluatorStable &&
    contentSnapshotStable &&
    strategyProfilesStable &&
    evaluatorStable &&
    incumbentResult.contentSnapshotStable &&
    candidateResult.contentSnapshotStable &&
    incumbentResult.strategyProfilesStable &&
    candidateResult.strategyProfilesStable &&
    strategyProfileBindingsStable;
  const scheduledGames = incumbentResult.scheduledGames;
  const gateEvidence: AiPolicyConfirmationGateEvidence = {
    registrationId: AI_POLICY_CONFIRMATION_REGISTRATION_ID,
    strategyId: input.strategyId,
    parameter: input.parameter,
    liveValue,
    incumbentValue,
    candidateValue: input.candidateValue,
    configuredSeeds: seeds,
    startSeed,
    maxRounds,
    rotationsPerSeed: incumbentResult.rotationsPerSeed,
    scheduledGames,
    minimumPlacementImprovement,
    topFourNoninferiorityGuard: TOP_FOUR_NONINFERIORITY_GUARD,
    winRateNoninferiorityGuard: WIN_RATE_NONINFERIORITY_GUARD,
    incumbentDrawnGames: incumbent.drawnGames,
    candidateDrawnGames: candidate.drawnGames,
    incumbentTruncatedGames: incumbent.truncatedGames,
    candidateTruncatedGames: candidate.truncatedGames,
    placement: candidate.conservativeComparisonToIncumbent,
    topFour: candidate.conservativeTopFourComparisonToIncumbent,
    win: candidate.conservativeWinRateComparisonToIncumbent,
    provenanceStable,
  };
  const registrationMatched =
    confirmationRegistrationMismatchReasons(gateEvidence).length === 0;
  const gate = evaluateAiPolicyConfirmationGate(gateEvidence);

  return {
    method: "fixed-candidate-confirmation-v1",
    registrationId: AI_POLICY_CONFIRMATION_REGISTRATION_ID,
    registrationMatched,
    contentVersion: incumbentResult.contentVersion,
    contentSnapshotSha256: SEARCH_CONTENT_SNAPSHOT_SHA256,
    contentSnapshotSha256After,
    contentSnapshotStable,
    policyVersion: incumbentResult.policyVersion,
    evaluatorHash: incumbentResult.evaluatorHash,
    evaluatorHashAfter,
    evaluatorStable,
    searchEvaluatorHash: SEARCH_EVALUATOR_HASH,
    searchEvaluatorHashAfter,
    searchEvaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    strategyProfileBindingsStable,
    strategyId: input.strategyId,
    playerId,
    parameter: input.parameter,
    liveValue,
    incumbentValue,
    candidateValue: input.candidateValue,
    config: {
      seeds,
      startSeed,
      maxRounds,
      rotationsPerSeed: incumbentResult.rotationsPerSeed,
      scheduledGames,
      minimumPlacementImprovement,
      minimumSeedClusters:
        AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS,
      topFourNoninferiorityGuard: TOP_FOUR_NONINFERIORITY_GUARD,
      winRateNoninferiorityGuard: WIN_RATE_NONINFERIORITY_GUARD,
    },
    incumbent,
    candidate,
    accepted: gate.accepted,
    acceptanceReasons: gate.reasons,
    note:
      "Confirmation is read-only and evaluates exactly the live incumbent and the specified fixed candidate without training or selection. Only the immutable registered configuration can be accepted; other configurations are diagnostic-only. Placement uses candidate-worst minus incumbent-best (negative is better); rate guards use candidate-lower minus incumbent-upper (positive is better).",
  };
}

export function runAiPolicyTrainingScreen(
  options: AiPolicyTrainingScreenOptions = {},
): AiPolicyTrainingScreenResult {
  assertNoAiResidualPolicyOverrides("training screen start");
  const input = Object.freeze({
    seeds: options.seeds,
    startSeed: options.startSeed,
    maxRounds: options.maxRounds,
    expectedProtocolHash: options.expectedProtocolHash,
    onProgress: options.onProgress,
  });
  const registration = AI_POLICY_TRAINING_SCREEN_REGISTRATION;
  const seeds = positiveInteger(input.seeds, registration.seeds, "seeds");
  const startSeed = safeInteger(
    input.startSeed,
    registration.startSeed,
    "startSeed",
  );
  if (!Number.isSafeInteger(startSeed + seeds - 1)) {
    throw new Error("training screen seed range must contain safe integers");
  }
  const maxRounds = positiveInteger(
    input.maxRounds,
    registration.maxRounds,
    "maxRounds",
  );

  const registeredSeedRangeRequested =
    seeds === registration.seeds &&
    startSeed === registration.startSeed;
  if (
    registeredSeedRangeRequested &&
    maxRounds !== registration.maxRounds
  ) {
    throw new Error(
      "registered training screen preflight failed before games: maxRounds does not match the immutable registration",
    );
  }
  if (registeredSeedRangeRequested) {
    if (input.onProgress !== undefined) {
      throw new Error(
        "registered training screen preflight failed before games: authoritative runs do not accept external progress callbacks",
      );
    }
    if (
      input.expectedProtocolHash === undefined ||
      !/^[a-f0-9]{64}$/.test(input.expectedProtocolHash)
    ) {
      throw new Error(
        "registered training screen preflight failed before games: expectedProtocolHash must be one lowercase 64-hex digest",
      );
    }
    if (input.expectedProtocolHash !== TRAINING_SCREEN_PROTOCOL_HASH) {
      throw new Error(
        "registered training screen preflight failed before games: expectedProtocolHash does not match the runtime protocol hash",
      );
    }
  } else {
    assertAiBenchmarkSeedAccess({ startSeed, seeds });
  }

  const protocolHashBefore = computeAiPolicyTrainingScreenProtocolHash();
  const searchEvaluatorHashBefore = computeAiPolicySearchEvaluatorHash();
  const contentSnapshotSha256Before =
    computeAiBenchmarkContentSnapshotSha256();
  const strategyProfileHash = computeAiBenchmarkStrategyProfileHash();
  const liveProfile = getAiStrategyProfile(registration.playerId);
  const liveProfileMatchesRegistration =
    JSON.stringify(liveProfile) === TRAINING_SCREEN_BASELINE_PROFILE_BYTES;
  const liveStrategyProfileHashMatchesRegistration =
    strategyProfileHash ===
    TRAINING_SCREEN_BASELINE_STRATEGY_PROFILE_HASH;
  if (registeredSeedRangeRequested) {
    const preflightFailures: string[] = [];
    if (!liveProfileMatchesRegistration) {
      preflightFailures.push("live baseline profile bytes do not match");
    }
    if (!liveStrategyProfileHashMatchesRegistration) {
      preflightFailures.push("live strategy profile hash does not match");
    }
    if (protocolHashBefore !== TRAINING_SCREEN_PROTOCOL_HASH) {
      preflightFailures.push("training protocol hash does not match");
    }
    if (preflightFailures.length > 0) {
      throw new Error(
        `registered training screen preflight failed before games: ${preflightFailures.join(
          "; ",
        )}`,
      );
    }
    const authoritative = runRegisteredAiPolicyTrainingScreen(
      input.expectedProtocolHash!,
    );
    const searchEvaluatorHashAfter = computeAiPolicySearchEvaluatorHash();
    if (
      searchEvaluatorHashBefore !== SEARCH_EVALUATOR_HASH ||
      searchEvaluatorHashAfter !== SEARCH_EVALUATOR_HASH
    ) {
      throw new Error(
        "registered training screen search wrapper changed during the authoritative run",
      );
    }
    return {
      method: "fixed-candidate-training-screen-v1",
      registrationId: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
      protocolHash: authoritative.protocolHash,
      protocolHashAfter: authoritative.protocolHashAfter,
      protocolStable: authoritative.protocolStable,
      requestedExpectedProtocolHash:
        authoritative.requestedExpectedProtocolHash,
      registrationMatched:
        authoritative.protocolStable &&
        authoritative.contentSnapshotStable &&
        authoritative.evaluatorStable &&
        authoritative.strategyProfilesStable &&
        authoritative.candidateProfileBindingsStable,
      contentVersion: authoritative.contentVersion,
      contentSnapshotSha256: authoritative.contentSnapshotSha256,
      contentSnapshotSha256After:
        authoritative.contentSnapshotSha256After,
      contentSnapshotStable: authoritative.contentSnapshotStable,
      policyVersion: authoritative.policyVersion,
      evaluatorHash: authoritative.evaluatorHash,
      evaluatorHashAfter: authoritative.evaluatorHashAfter,
      evaluatorStable: authoritative.evaluatorStable,
      searchEvaluatorHash: SEARCH_EVALUATOR_HASH,
      searchEvaluatorHashAfter,
      searchEvaluatorStable: true,
      strategyProfileHash: authoritative.strategyProfileHash,
      strategyProfileHashAfter: authoritative.strategyProfileHashAfter,
      strategyProfilesStable: authoritative.strategyProfilesStable,
      candidateProfileBindingsStable:
        authoritative.candidateProfileBindingsStable,
      strategyId: registration.strategyId,
      playerId: registration.playerId,
      config: {
        seeds: registration.seeds,
        startSeed: registration.startSeed,
        maxRounds: registration.maxRounds,
        rotationsPerSeed: registration.rotationsPerSeed,
        scheduledGames: registration.scheduledGames,
        minimumPlacementImprovement:
          registration.minimumPlacementImprovement,
        topFourNoninferiorityGuard:
          registration.topFourNoninferiorityGuard,
        winRateNoninferiorityGuard:
          registration.winRateNoninferiorityGuard,
      },
      candidateProfileHashes: authoritative.candidateProfileHashes,
      baseline: authoritative.baseline,
      candidates: authoritative.candidates,
      selected: authoritative.selected,
      note:
        "The authoritative exact screen has no external callbacks or raw-game return path. Its single protected entry runs baseline, A, B, and C, then computes the fixed paired statistics, qualification gates, and deterministic selection before returning this complete audit.",
    };
  }
  const expectedCandidateProfileHashes = new Map(
    AI_POLICY_TRAINING_SCREEN_CANDIDATES.map((candidate) => [
      candidate.id,
      withAiStrategyProfileOverrides(
        new Map([[registration.playerId, candidate.profile]]),
        computeAiBenchmarkStrategyProfileHash,
      ),
    ]),
  );

  const runArm = (
    arm: AiPolicyTrainingScreenProgress["arm"],
    candidateId: AiPolicyTrainingCandidateId | null,
    profile?: Readonly<AiStrategyProfile>,
  ): AiBenchmarkResult => {
    assertNoAiResidualPolicyOverrides(
      `training screen ${candidateId ?? "baseline"} start`,
    );
    const result = runAiBenchmark({
      seeds,
      startSeed,
      maxRounds,
      includeGames: true,
      profileOverrides: profile
        ? new Map([[registration.playerId, profile]])
        : undefined,
      onProgress: input.onProgress
        ? ({ processedGames, scheduledGames }) =>
            input.onProgress?.({
              arm,
              candidateId,
              processedGames,
              scheduledGames,
            })
        : undefined,
    });
    assertNoAiResidualPolicyOverrides(
      `training screen ${candidateId ?? "baseline"} end`,
    );
    return result;
  };

  const candidateResults = new Map<
    AiPolicyTrainingCandidateId,
    AiBenchmarkResult
  >();
  const baselineResult = runArm("baseline", null);
  for (const candidate of AI_POLICY_TRAINING_SCREEN_CANDIDATES) {
    candidateResults.set(
      candidate.id,
      runArm("candidate", candidate.id, candidate.profile),
    );
  }

  const baselineSummary = summarizeVariant(
    AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE.upgradeRoundOffset,
    baselineResult,
    baselineResult,
    registration.strategyId,
  );
  const candidateSummaries = AI_POLICY_TRAINING_SCREEN_CANDIDATES.map(
    (candidate) => {
      const result = candidateResults.get(candidate.id);
      if (!result) {
        throw new Error(`training result is missing for ${candidate.id}`);
      }
      return {
        candidate,
        result,
        summary: summarizeVariant(
          candidate.profile.upgradeRoundOffset,
          result,
          baselineResult,
          registration.strategyId,
        ),
      };
    },
  );

  const searchEvaluatorHashAfter = computeAiPolicySearchEvaluatorHash();
  const searchEvaluatorStable =
    searchEvaluatorHashBefore === SEARCH_EVALUATOR_HASH &&
    searchEvaluatorHashAfter === SEARCH_EVALUATOR_HASH;
  const contentSnapshotSha256After =
    computeAiBenchmarkContentSnapshotSha256();
  const contentSnapshotStable =
    contentSnapshotSha256Before === SEARCH_CONTENT_SNAPSHOT_SHA256 &&
    contentSnapshotSha256After === SEARCH_CONTENT_SNAPSHOT_SHA256;
  const strategyProfileHashAfter = computeAiBenchmarkStrategyProfileHash();
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  const protocolHashAfter = computeAiPolicyTrainingScreenProtocolHash();
  const protocolStable =
    protocolHashBefore === TRAINING_SCREEN_PROTOCOL_HASH &&
    protocolHashAfter === TRAINING_SCREEN_PROTOCOL_HASH;
  const candidateProfileBindingsStable = candidateSummaries.every(
    ({ candidate, result }) => {
      const expectedHash = expectedCandidateProfileHashes.get(candidate.id);
      return (
        expectedHash !== undefined &&
        result.strategyProfileHash === expectedHash &&
        result.strategyProfileHashAfter === expectedHash &&
        result.strategyProfilesStable
      );
    },
  );
  const evaluatorHashAfter =
    candidateSummaries.at(-1)?.result.evaluatorHashAfter ??
    baselineResult.evaluatorHashAfter;
  const evaluatorStable =
    baselineResult.evaluatorStable &&
    candidateSummaries.every(
      ({ result }) =>
        result.evaluatorStable &&
        result.evaluatorHash === baselineResult.evaluatorHash &&
        result.evaluatorHashAfter === baselineResult.evaluatorHashAfter,
    );
  const armProvenanceStable =
    baselineResult.contentSnapshotStable &&
    baselineResult.strategyProfilesStable &&
    candidateSummaries.every(
      ({ result }) =>
        result.contentSnapshotStable && result.strategyProfilesStable,
    );
  const scheduledGames = baselineResult.scheduledGames;
  const exactConfiguration =
    seeds === registration.seeds &&
    startSeed === registration.startSeed &&
    maxRounds === registration.maxRounds &&
    baselineResult.rotationsPerSeed === registration.rotationsPerSeed &&
    scheduledGames === registration.scheduledGames;
  const registrationMatched =
    exactConfiguration &&
    input.expectedProtocolHash === TRAINING_SCREEN_PROTOCOL_HASH &&
    liveProfileMatchesRegistration &&
    liveStrategyProfileHashMatchesRegistration &&
    protocolStable;
  const provenanceStable =
    registrationMatched &&
    searchEvaluatorStable &&
    contentSnapshotStable &&
    strategyProfilesStable &&
    evaluatorStable &&
    armProvenanceStable &&
    candidateProfileBindingsStable &&
    baselineResult.strategyProfileHash === strategyProfileHash &&
    baselineResult.strategyProfileHashAfter === strategyProfileHash;
  const evidence: AiPolicyTrainingScreenEvidence = {
    registrationId: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
    seeds,
    startSeed,
    maxRounds,
    rotationsPerSeed: baselineResult.rotationsPerSeed,
    scheduledGames,
    minimumPlacementImprovement:
      registration.minimumPlacementImprovement,
    topFourNoninferiorityGuard:
      registration.topFourNoninferiorityGuard,
    winRateNoninferiorityGuard:
      registration.winRateNoninferiorityGuard,
    baselineScheduledGames: baselineSummary.scheduledGames,
    baselineDrawnGames: baselineSummary.drawnGames,
    baselineTruncatedGames: baselineSummary.truncatedGames,
    provenanceStable,
    candidates: candidateSummaries.map(({ candidate, summary }) => ({
      candidateId: candidate.id,
      scheduledGames: summary.scheduledGames,
      drawnGames: summary.drawnGames,
      truncatedGames: summary.truncatedGames,
      placement: summary.conservativeComparisonToIncumbent,
      topFour: summary.conservativeTopFourComparisonToIncumbent,
      win: summary.conservativeWinRateComparisonToIncumbent,
      provenanceStable,
    })),
  };
  const selected = selectAiPolicyTrainingCandidate(evidence);
  const auditedCandidates = candidateSummaries.map(
    ({ candidate, result, summary }, index) => {
      const candidateEvidence = evidence.candidates[index];
      if (!candidateEvidence) {
        throw new Error(`training evidence is missing for ${candidate.id}`);
      }
      const qualification =
        evaluateAiPolicyTrainingCandidateQualification(
          candidateEvidence,
          evidence,
        );
      const expectedStrategyProfileHash =
        expectedCandidateProfileHashes.get(candidate.id) ?? "";
      return {
        candidateId: candidate.id,
        profile: candidate.profile,
        expectedStrategyProfileHash,
        profileBindingStable:
          expectedStrategyProfileHash.length > 0 &&
          result.strategyProfileHash === expectedStrategyProfileHash &&
          result.strategyProfileHashAfter === expectedStrategyProfileHash &&
          result.strategyProfilesStable,
        summary,
        qualified: qualification.qualified,
        qualificationReasons: qualification.reasons,
      };
    },
  );

  return {
    method: "fixed-candidate-training-screen-v1",
    registrationId: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
    protocolHash: TRAINING_SCREEN_PROTOCOL_HASH,
    protocolHashAfter,
    protocolStable,
    requestedExpectedProtocolHash:
      input.expectedProtocolHash ?? null,
    registrationMatched,
    contentVersion: baselineResult.contentVersion,
    contentSnapshotSha256: SEARCH_CONTENT_SNAPSHOT_SHA256,
    contentSnapshotSha256After,
    contentSnapshotStable,
    policyVersion: baselineResult.policyVersion,
    evaluatorHash: baselineResult.evaluatorHash,
    evaluatorHashAfter,
    evaluatorStable,
    searchEvaluatorHash: SEARCH_EVALUATOR_HASH,
    searchEvaluatorHashAfter,
    searchEvaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    candidateProfileBindingsStable,
    strategyId: registration.strategyId,
    playerId: registration.playerId,
    config: {
      seeds,
      startSeed,
      maxRounds,
      rotationsPerSeed: baselineResult.rotationsPerSeed,
      scheduledGames,
      minimumPlacementImprovement:
        registration.minimumPlacementImprovement,
      topFourNoninferiorityGuard:
        registration.topFourNoninferiorityGuard,
      winRateNoninferiorityGuard:
        registration.winRateNoninferiorityGuard,
    },
    candidateProfileHashes: AI_POLICY_TRAINING_SCREEN_CANDIDATES.map(
      (candidate) => ({
        candidateId: candidate.id,
        strategyProfileHash:
          expectedCandidateProfileHashes.get(candidate.id) ?? "",
      }),
    ),
    baseline: baselineSummary,
    candidates: auditedCandidates,
    selected,
    note:
      "The fixed screen runs the live baseline once and all three immutable candidates without early stopping. The authoritative exact run accepts no external callbacks and emits one complete result only after every arm finishes; non-reserved diagnostic progress exposes counts only. The result includes metrics, raw paired intervals, qualification reasons, profile hashes, and the deterministic selection.",
  };
}

export interface AiPolicyTrainingScreenCliRequest {
  readonly expectedProtocolHash: string;
}

export function parseAiPolicyTrainingScreenCliArguments(
  args: readonly string[],
): Readonly<AiPolicyTrainingScreenCliRequest> {
  let trainingScreenCount = 0;
  let expectedHashCount = 0;
  let expectedProtocolHash: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.includes("=")) {
      throw new Error(
        "--training-screen rejects --flag=value syntax",
      );
    }
    if (argument === "--training-screen") {
      trainingScreenCount += 1;
      continue;
    }
    if (argument === "--expected-protocol-hash") {
      expectedHashCount += 1;
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(
          "--expected-protocol-hash requires one lowercase 64-hex value",
        );
      }
      expectedProtocolHash = value;
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(
        `unknown flag ${argument} for --training-screen`,
      );
    }
    throw new Error(
      `unexpected positional argument ${argument} for --training-screen`,
    );
  }
  if (trainingScreenCount !== 1) {
    throw new Error(
      "protected CLI requires exactly one --training-screen flag",
    );
  }
  if (expectedHashCount !== 1) {
    throw new Error(
      "protected CLI requires exactly one --expected-protocol-hash flag",
    );
  }
  if (
    expectedProtocolHash === undefined ||
    !/^[a-f0-9]{64}$/.test(expectedProtocolHash)
  ) {
    throw new Error(
      "--expected-protocol-hash requires one lowercase 64-hex value",
    );
  }
  return Object.freeze({ expectedProtocolHash });
}

function stringArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerArgument(name: string): number | undefined {
  const value = stringArgument(name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} requires an integer value`);
  }
  return parsed;
}

function numberArgument(name: string): number | undefined {
  const value = stringArgument(name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} requires a numeric value`);
  }
  return parsed;
}

function parseStrategyId(value: string): AiStrategyId {
  const profile = AI_STRATEGY_PROFILES.find(
    (candidate) => candidate.id === value,
  );
  if (!profile) {
    throw new Error(`unknown strategy ${value}`);
  }
  return profile.id;
}

function parseTunableKey(value: string): TunableAiProfileKey {
  if (!TUNABLE_KEYS.has(value as TunableAiProfileKey)) {
    throw new Error(`unsupported AI profile parameter ${value}`);
  }
  return value as TunableAiProfileKey;
}

function parseValues(value: string): number[] {
  const values = value.split(",").map(Number);
  if (values.length === 0 || values.some((candidate) => !Number.isFinite(candidate))) {
    throw new Error("--values requires comma-separated numbers");
  }
  return values;
}

function requireRegisteredCliValue(
  name: string,
  requested: string | number | undefined,
  registered: string | number,
): void {
  if (requested !== undefined && requested !== registered) {
    throw new Error(
      `${name}=${requested} conflicts with registered value ${registered}`,
    );
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  const cliArgs = process.argv.slice(2);
  const trainingScreenMode = cliArgs.some(
    (argument) =>
      argument === "--training-screen" ||
      argument.startsWith("--training-screen="),
  );
  const confirmationMode = process.argv.includes("--confirm");
  if (trainingScreenMode) {
    const request = parseAiPolicyTrainingScreenCliArguments(cliArgs);
    const screen = runAiPolicyTrainingScreen({
      expectedProtocolHash: request.expectedProtocolHash,
    });
    console.log(JSON.stringify(screen, null, 2));
  } else {
    const strategyId = parseStrategyId(
      stringArgument("--strategy") ??
        (confirmationMode
          ? AI_POLICY_CONFIRMATION_REGISTRATION.strategyId
          : "deathrattle"),
    );
    const parameter = parseTunableKey(
      stringArgument("--parameter") ??
        AI_POLICY_CONFIRMATION_REGISTRATION.parameter,
    );
    const result = confirmationMode
      ? (() => {
        const registration = AI_POLICY_CONFIRMATION_REGISTRATION;
        const requestedCandidate = numberArgument("--candidate-value");
        const requestedIncumbent = numberArgument("--incumbent-value");
        const requestedSeeds = integerArgument("--seeds");
        const requestedStartSeed = integerArgument("--start-seed");
        const requestedMaxRounds = integerArgument("--max-rounds");
        const requestedMinimum = numberArgument(
          "--minimum-placement-improvement",
        );
        for (const [name, requested, registered] of [
          ["--strategy", strategyId, registration.strategyId],
          ["--parameter", parameter, registration.parameter],
          ["--candidate-value", requestedCandidate, registration.candidateValue],
          ["--incumbent-value", requestedIncumbent, registration.incumbentValue],
          ["--seeds", requestedSeeds, registration.seeds],
          ["--start-seed", requestedStartSeed, registration.startSeed],
          ["--max-rounds", requestedMaxRounds, registration.maxRounds],
          [
            "--minimum-placement-improvement",
            requestedMinimum,
            registration.minimumPlacementImprovement,
          ],
        ] as const) {
          requireRegisteredCliValue(name, requested, registered);
        }
        return runAiPolicyConfirmation({
          strategyId: registration.strategyId,
          parameter: registration.parameter,
          candidateValue: registration.candidateValue,
          incumbentValue: registration.incumbentValue,
          seeds: registration.seeds,
          startSeed: registration.startSeed,
          maxRounds: registration.maxRounds,
          minimumPlacementImprovement:
            registration.minimumPlacementImprovement,
          onProgress: (progress) => {
            if (progress.rotation === 7) {
              console.error(
                `[ai-policy-confirmation] ${progress.arm} value=${progress.value} ${progress.processedGames}/${progress.scheduledGames} games`,
              );
            }
          },
        });
        })()
      : runAiPolicySearch({
        strategyId,
        parameter,
        values: parseValues(stringArgument("--values") ?? "0,1"),
        incumbentValue: numberArgument("--incumbent-value"),
        trainSeeds: integerArgument("--train-seeds"),
        trainStartSeed: integerArgument("--train-start-seed"),
        holdoutSeeds: integerArgument("--holdout-seeds"),
        holdoutStartSeed: integerArgument("--holdout-start-seed"),
        maxRounds: integerArgument("--max-rounds"),
        minimumPlacementImprovement: numberArgument(
          "--minimum-placement-improvement",
        ),
        onProgress: (progress) => {
          if (progress.rotation === 7) {
            console.error(
              `[ai-policy-search] ${progress.stage} value=${progress.value} ${progress.processedGames}/${progress.scheduledGames} games`,
            );
          }
        },
        });
    console.log(JSON.stringify(result, null, 2));
  }
}
