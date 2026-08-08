import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  AI_POLICY_VERSION,
  getAiStrategyProfile,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  advanceHeadlessGameWithAiRecruitSafetyModes,
  type AiRecruitSafetyDiagnostics,
  type AiRecruitSafetyMode,
  type AiRecruitSafetyPlayerDiagnostics,
  type GameState,
} from "../lib/game/engine.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  isValidInitialHealth,
} from "../lib/game/setup.ts";
import type { PlayerId } from "../lib/game/types.ts";
import {
  AI_BENCHMARK_SCENARIOS,
  createAiBenchmarkPairKey,
  createAiBenchmarkScenarioGame,
  normalizeAiBenchmarkScenarioIds,
  type AiBenchmarkScenarioId,
} from "./ai-benchmark-scenarios.ts";
import { assertAiBenchmarkSeedAccess } from "./ai-seed-ledger.ts";
import {
  conservativePlacementDelta,
  conservativeRateDelta,
  evaluateAiRecruitPlannerGate,
  placementBoundsFromPlacement,
  summarizeAiRecruitPlannerSeedMetrics,
  type AiRecruitPlannerComparisons,
  type AiRecruitPlannerSeedMetric,
  type PlacementBounds,
} from "./benchmark-ai-recruit-planner.ts";

export const AI_RECRUIT_SAFETY_BENCHMARK_VERSION = 1 as const;
export const AI_RECRUIT_SAFETY_DEFAULT_START_SEED = 90_040_001 as const;
export const AI_RECRUIT_SAFETY_PLAYER_IDS = Object.freeze([
  "player-1",
  "player-2",
  "player-3",
  "player-4",
  "player-5",
  "player-6",
  "player-7",
] as const);

export type AiRecruitSafetyPlayerId =
  (typeof AI_RECRUIT_SAFETY_PLAYER_IDS)[number];

const DEFAULTS = {
  seeds: 1,
  startSeed: AI_RECRUIT_SAFETY_DEFAULT_START_SEED,
  maxRounds: 150,
};
const RUNS_PER_SCENARIO = 1 + AI_RECRUIT_SAFETY_PLAYER_IDS.length;

export interface AiRecruitSafetyBenchmarkOptions {
  readonly seeds?: number;
  readonly startSeed?: number;
  readonly maxRounds?: number;
  readonly initialHealth?: number;
  /** Defaults to both neutral-v1 and live-lobby-v1. */
  readonly scenarioIds?: readonly AiBenchmarkScenarioId[];
  readonly onProgress?: (progress: AiRecruitSafetyBenchmarkProgress) => void;
}

export interface AiRecruitSafetyBenchmarkProgress {
  readonly processedRuns: number;
  readonly scheduledRuns: number;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly arm: "baseline" | "candidate";
  readonly controlledPlayerId: AiRecruitSafetyPlayerId | null;
  readonly completed: boolean;
  readonly failure: string | null;
}

export interface AiRecruitSafetyProfileSnapshot {
  readonly playerId: AiRecruitSafetyPlayerId;
  readonly profile: AiStrategyProfile;
}

export interface AiRecruitSafetyPlayerOutcome {
  readonly playerId: AiRecruitSafetyPlayerId;
  readonly profileId: AiStrategyId;
  readonly placementBounds: PlacementBounds | null;
  readonly topFour: boolean | null;
  readonly win: boolean | null;
}

export interface AiRecruitSafetyGameRun {
  readonly completed: boolean;
  readonly drawn: boolean;
  readonly truncated: boolean;
  readonly finalRound: number | null;
  readonly alivePlayers: number | null;
  readonly winnerPlayerId: string | null;
  readonly contentVersion: string | null;
  readonly outcomes: Readonly<
    Record<AiRecruitSafetyPlayerId, AiRecruitSafetyPlayerOutcome>
  >;
  readonly safetyDiagnostics: AiRecruitSafetyDiagnostics;
  readonly failure: string | null;
}

export interface AiRecruitSafetyCandidateRun {
  readonly controlledPlayerId: AiRecruitSafetyPlayerId;
  readonly run: AiRecruitSafetyGameRun;
}

export interface AiRecruitSafetyPair {
  readonly pairKey: string;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly playerId: AiRecruitSafetyPlayerId;
  readonly profileId: AiStrategyId;
  readonly baselinePlacementBounds: PlacementBounds | null;
  readonly candidatePlacementBounds: PlacementBounds | null;
  readonly placementDelta: number | null;
  readonly topFourDelta: number | null;
  readonly winDelta: number | null;
}

export interface AiRecruitSafetyEpisode {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly baseline: AiRecruitSafetyGameRun;
  readonly candidates: readonly AiRecruitSafetyCandidateRun[];
  readonly pairs: readonly AiRecruitSafetyPair[];
}

export interface AiRecruitSafetySeedCluster {
  readonly seed: number;
  readonly episodes: readonly AiRecruitSafetyEpisode[];
  readonly pairs: readonly AiRecruitSafetyPair[];
  readonly metric: AiRecruitPlannerSeedMetric | null;
}

export interface AiRecruitSafetyComparisonMatrix {
  /** One independent observation per seed; pairedSeats counts seed/profile strata. */
  readonly overall: AiRecruitPlannerComparisons;
  readonly byScenario: Partial<
    Record<AiBenchmarkScenarioId, AiRecruitPlannerComparisons>
  >;
  readonly byProfile: Partial<
    Record<AiStrategyId, AiRecruitPlannerComparisons>
  >;
}

export interface AiRecruitSafetyDiagnosticSummary {
  readonly baselineAllPlayers: AiRecruitSafetyPlayerDiagnostics;
  readonly candidateAllPlayers: AiRecruitSafetyPlayerDiagnostics;
  readonly candidateFocalPlayers: AiRecruitSafetyPlayerDiagnostics;
  readonly candidateFocalByScenario: Partial<
    Record<AiBenchmarkScenarioId, AiRecruitSafetyPlayerDiagnostics>
  >;
  readonly candidateFocalByProfile: Partial<
    Record<AiStrategyId, AiRecruitSafetyPlayerDiagnostics>
  >;
}

export interface AiRecruitSafetyRunnerFailure {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId | null;
  readonly arm: "baseline" | "candidate" | "provenance";
  readonly controlledPlayerId: AiRecruitSafetyPlayerId | null;
  readonly message: string;
}

export interface AiRecruitSafetyScreeningGate {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

export function evaluateAiRecruitSafetyScreeningGate(input: {
  readonly evidenceReasons: readonly string[];
  readonly plannerGate: {
    readonly accepted: boolean;
    readonly reasons: readonly string[];
  };
  readonly focalDecisionDivergences: number;
}): AiRecruitSafetyScreeningGate {
  if (
    !Number.isSafeInteger(input.focalDecisionDivergences) ||
    input.focalDecisionDivergences < 0
  ) {
    throw new RangeError(
      "focalDecisionDivergences must be a non-negative integer",
    );
  }
  const treatmentExposed = input.focalDecisionDivergences > 0;
  const treatmentReason =
    "requires at least one focal recruit-safety decision divergence";
  const reasons = Object.freeze([
    ...input.evidenceReasons,
    ...(treatmentExposed || input.evidenceReasons.includes(treatmentReason)
      ? []
      : [treatmentReason]),
    ...input.plannerGate.reasons.filter(
      (reason) =>
        !input.evidenceReasons.includes(reason) && reason !== treatmentReason,
    ),
  ]);
  return Object.freeze({
    accepted:
      input.evidenceReasons.length === 0 &&
      treatmentExposed &&
      input.plannerGate.accepted,
    reasons,
  });
}

const DIAGNOSTIC_COUNTERS = [
  "minionDamageOpportunities",
  "minionBlocks",
  "heroPowerDamageOpportunities",
  "heroPowerBlocks",
  "decisionDivergences",
  "rewinderExemptions",
  "floorCrossings",
  "lethalRisks",
] as const satisfies ReadonlyArray<keyof AiRecruitSafetyPlayerDiagnostics>;

function emptyPlayerDiagnostics(): AiRecruitSafetyPlayerDiagnostics {
  return {
    minionDamageOpportunities: 0,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 0,
    heroPowerBlocks: 0,
    decisionDivergences: 0,
    rewinderExemptions: 0,
    floorCrossings: 0,
    lethalRisks: 0,
  };
}

export function sumAiRecruitSafetyPlayerDiagnostics(
  values: Iterable<Readonly<AiRecruitSafetyPlayerDiagnostics>>,
): AiRecruitSafetyPlayerDiagnostics {
  const total = emptyPlayerDiagnostics();
  for (const value of values) {
    for (const counter of DIAGNOSTIC_COUNTERS) {
      const amount = value[counter];
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new RangeError(`${counter} must be a non-negative integer`);
      }
      total[counter] += amount;
    }
  }
  return total;
}

function emptyDiagnostics(
  playerIds: readonly PlayerId[],
): AiRecruitSafetyDiagnostics {
  const byPlayer: Record<PlayerId, AiRecruitSafetyPlayerDiagnostics> = {};
  for (const playerId of playerIds) {
    byPlayer[playerId] = emptyPlayerDiagnostics();
  }
  return { byPlayer };
}

function mergeDiagnostics(
  target: AiRecruitSafetyDiagnostics,
  source: Readonly<AiRecruitSafetyDiagnostics>,
): void {
  for (const [playerId, value] of Object.entries(source.byPlayer)) {
    const current = target.byPlayer[playerId] ?? emptyPlayerDiagnostics();
    target.byPlayer[playerId] = sumAiRecruitSafetyPlayerDiagnostics([
      current,
      value,
    ]);
  }
}

/**
 * Build the exact per-player mode map required by the headless engine API.
 * A null focal player is the all-legacy baseline; otherwise exactly that
 * physical player receives safe-v4.
 */
export function createAiRecruitSafetyModeMap(
  playerIds: readonly PlayerId[],
  safePlayerId: AiRecruitSafetyPlayerId | null,
): Readonly<Record<PlayerId, AiRecruitSafetyMode>> {
  const uniquePlayerIds = new Set(playerIds);
  if (playerIds.length === 0 || uniquePlayerIds.size !== playerIds.length) {
    throw new RangeError("playerIds must be a non-empty unique list");
  }
  if (safePlayerId !== null && !uniquePlayerIds.has(safePlayerId)) {
    throw new RangeError(`safe player ${safePlayerId} is not in the game`);
  }
  const modes: Record<PlayerId, AiRecruitSafetyMode> = {};
  for (const playerId of playerIds) {
    modes[playerId] = playerId === safePlayerId ? "safe-v4" : "legacy-v3";
  }
  return Object.freeze(modes);
}

function positiveInteger(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return result;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function evaluatorHash(): string {
  const hash = createHash("sha256");
  for (const relativePath of [
    "../lib/game/ai.ts",
    "../lib/game/engine.ts",
    "./ai-benchmark-scenarios.ts",
    "./ai-seed-ledger.ts",
    "./benchmark-ai-recruit-planner.ts",
    "./benchmark-ai-recruit-safety.ts",
  ]) {
    hash
      .update(relativePath)
      .update("\0")
      .update(readFileSync(new URL(relativePath, import.meta.url)))
      .update("\0");
  }
  return hash.digest("hex");
}

const EVALUATOR_HASH = evaluatorHash();

function profileSnapshots(): AiRecruitSafetyProfileSnapshot[] {
  return AI_RECRUIT_SAFETY_PLAYER_IDS.map((playerId) => ({
    playerId,
    profile: Object.freeze({ ...getAiStrategyProfile(playerId) }),
  }));
}

function profileHash(
  profiles: readonly AiRecruitSafetyProfileSnapshot[],
): string {
  return createHash("sha256").update(JSON.stringify(profiles)).digest("hex");
}

function alivePlayerCount(state: GameState): number {
  return state.players.filter((player) => player.alive).length;
}

function playerOutcome(
  state: GameState,
  playerId: AiRecruitSafetyPlayerId,
): AiRecruitSafetyPlayerOutcome {
  const profileId = getAiStrategyProfile(playerId).id;
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return {
      playerId,
      profileId,
      placementBounds: null,
      topFour: null,
      win: null,
    };
  }
  const completed = state.phase === "gameOver";
  const placement =
    player.placement ??
    (completed && state.winnerId === player.id ? 1 : undefined);
  const placementBounds =
    player.alive || placement !== undefined
      ? placementBoundsFromPlacement(placement, alivePlayerCount(state))
      : null;
  const exactPlacement =
    placementBounds?.exact === true ? placementBounds.best : null;
  return {
    playerId,
    profileId,
    placementBounds,
    topFour: exactPlacement === null ? null : exactPlacement <= 4,
    win: completed ? state.winnerId === player.id : null,
  };
}

function gameRunResult(
  state: GameState,
  diagnostics: AiRecruitSafetyDiagnostics,
): AiRecruitSafetyGameRun {
  const outcomes = {} as Record<
    AiRecruitSafetyPlayerId,
    AiRecruitSafetyPlayerOutcome
  >;
  for (const playerId of AI_RECRUIT_SAFETY_PLAYER_IDS) {
    outcomes[playerId] = playerOutcome(state, playerId);
  }
  const completed = state.phase === "gameOver";
  return {
    completed,
    drawn: completed && state.winnerId === null,
    truncated: !completed,
    finalRound: state.round,
    alivePlayers: alivePlayerCount(state),
    winnerPlayerId: completed ? state.winnerId : null,
    contentVersion: state.contentVersion,
    outcomes,
    safetyDiagnostics: diagnostics,
    failure: null,
  };
}

function failedGameRun(message: string): AiRecruitSafetyGameRun {
  const outcomes = {} as Record<
    AiRecruitSafetyPlayerId,
    AiRecruitSafetyPlayerOutcome
  >;
  for (const playerId of AI_RECRUIT_SAFETY_PLAYER_IDS) {
    outcomes[playerId] = {
      playerId,
      profileId: getAiStrategyProfile(playerId).id,
      placementBounds: null,
      topFour: null,
      win: null,
    };
  }
  return {
    completed: false,
    drawn: false,
    truncated: false,
    finalRound: null,
    alivePlayers: null,
    winnerPlayerId: null,
    contentVersion: null,
    outcomes,
    safetyDiagnostics: emptyDiagnostics([
      "player-0",
      ...AI_RECRUIT_SAFETY_PLAYER_IDS,
    ]),
    failure: message,
  };
}

function pairKey(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  playerId: AiRecruitSafetyPlayerId,
): string {
  const seat = Number(playerId.slice("player-".length));
  return `${createAiBenchmarkPairKey(
    seed,
    scenarioId,
    "seat",
    seat,
  )}|profile:${getAiStrategyProfile(playerId).id}`;
}

function buildPair(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  playerId: AiRecruitSafetyPlayerId,
  baseline: AiRecruitSafetyGameRun,
  candidate: AiRecruitSafetyGameRun,
): AiRecruitSafetyPair {
  const baselineOutcome = baseline.outcomes[playerId];
  const candidateOutcome = candidate.outcomes[playerId];
  const baselineBounds = baselineOutcome.placementBounds;
  const candidateBounds = candidateOutcome.placementBounds;
  const usable =
    baseline.failure === null &&
    candidate.failure === null &&
    baseline.completed &&
    candidate.completed &&
    baselineBounds?.exact === true &&
    candidateBounds?.exact === true;
  return {
    pairKey: pairKey(seed, scenarioId, playerId),
    seed,
    scenarioId,
    playerId,
    profileId: baselineOutcome.profileId,
    baselinePlacementBounds: baselineBounds,
    candidatePlacementBounds: candidateBounds,
    placementDelta: usable
      ? conservativePlacementDelta(candidateBounds, baselineBounds)
      : null,
    topFourDelta: usable
      ? conservativeRateDelta(candidateBounds, baselineBounds, "topFour")
      : null,
    winDelta: usable
      ? conservativeRateDelta(candidateBounds, baselineBounds, "win")
      : null,
  };
}

function isCompletePair(pair: AiRecruitSafetyPair): boolean {
  return [pair.placementDelta, pair.topFourDelta, pair.winDelta].every(
    (value) => value !== null && Number.isFinite(value),
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function seedMetricFromPairs(
  seed: number,
  pairs: readonly AiRecruitSafetyPair[],
  expectedPairs: number,
): AiRecruitPlannerSeedMetric | null {
  if (
    pairs.length !== expectedPairs ||
    new Set(pairs.map((pair) => pair.pairKey)).size !== expectedPairs ||
    !pairs.every(isCompletePair)
  ) {
    return null;
  }
  return {
    seed,
    placementDelta: mean(
      pairs.map((pair) => pair.placementDelta as number),
    ),
    topFourDelta: mean(
      pairs.map((pair) => pair.topFourDelta as number),
    ),
    winDelta: mean(pairs.map((pair) => pair.winDelta as number)),
  };
}

function summarizeStratum(
  clusters: readonly AiRecruitSafetySeedCluster[],
  selectPairs: (
    cluster: AiRecruitSafetySeedCluster,
  ) => readonly AiRecruitSafetyPair[],
  expectedPairsPerSeed: number,
  reportedPairedSeats?: number,
): AiRecruitPlannerComparisons {
  const metrics: AiRecruitPlannerSeedMetric[] = [];
  let completePairs = 0;
  for (const cluster of clusters) {
    const pairs = selectPairs(cluster);
    completePairs += pairs.filter(isCompletePair).length;
    const metric = seedMetricFromPairs(
      cluster.seed,
      pairs,
      expectedPairsPerSeed,
    );
    if (metric) metrics.push(metric);
  }
  return summarizeAiRecruitPlannerSeedMetrics(
    metrics,
    reportedPairedSeats ?? completePairs,
  );
}

function logicalPairedSeatCount(
  clusters: readonly AiRecruitSafetySeedCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[],
): number {
  let count = 0;
  for (const cluster of clusters) {
    for (const playerId of AI_RECRUIT_SAFETY_PLAYER_IDS) {
      const pairs = cluster.pairs.filter(
        (pair) => pair.playerId === playerId,
      );
      if (
        pairs.length === scenarioIds.length &&
        new Set(pairs.map((pair) => pair.scenarioId)).size ===
          scenarioIds.length &&
        pairs.every(isCompletePair)
      ) {
        count += 1;
      }
    }
  }
  return count;
}

function comparisonMatrix(
  clusters: readonly AiRecruitSafetySeedCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[],
  profiles: readonly AiRecruitSafetyProfileSnapshot[],
  logicalPairedSeats: number,
): AiRecruitSafetyComparisonMatrix {
  const overall = summarizeStratum(
    clusters,
    (cluster) => cluster.pairs,
    scenarioIds.length * AI_RECRUIT_SAFETY_PLAYER_IDS.length,
    logicalPairedSeats,
  );
  const byScenario: AiRecruitSafetyComparisonMatrix["byScenario"] = {};
  const byProfile: AiRecruitSafetyComparisonMatrix["byProfile"] = {};
  for (const scenarioId of scenarioIds) {
    byScenario[scenarioId] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.scenarioId === scenarioId),
      AI_RECRUIT_SAFETY_PLAYER_IDS.length,
    );
  }
  for (const { profile } of profiles) {
    byProfile[profile.id] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.profileId === profile.id),
      scenarioIds.length,
    );
  }
  return { overall, byScenario, byProfile };
}

export function summarizeAiRecruitSafetyClusters(
  clusters: readonly AiRecruitSafetySeedCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[] = AI_BENCHMARK_SCENARIOS,
): {
  readonly logicalPairedSeats: number;
  readonly comparisonMatrix: AiRecruitSafetyComparisonMatrix;
} {
  const normalizedScenarioIds = normalizeAiBenchmarkScenarioIds(scenarioIds);
  const logicalPairedSeats = logicalPairedSeatCount(
    clusters,
    normalizedScenarioIds,
  );
  return {
    logicalPairedSeats,
    comparisonMatrix: comparisonMatrix(
      clusters,
      normalizedScenarioIds,
      profileSnapshots(),
      logicalPairedSeats,
    ),
  };
}

function appendReason(
  reasons: string[],
  condition: boolean,
  reason: string,
): void {
  if (!condition && !reasons.includes(reason)) reasons.push(reason);
}

function diagnosticSummary(
  episodes: readonly AiRecruitSafetyEpisode[],
): AiRecruitSafetyDiagnosticSummary {
  const baselineValues: AiRecruitSafetyPlayerDiagnostics[] = [];
  const candidateValues: AiRecruitSafetyPlayerDiagnostics[] = [];
  const focalValues: AiRecruitSafetyPlayerDiagnostics[] = [];
  const byScenario: AiRecruitSafetyDiagnosticSummary["candidateFocalByScenario"] =
    {};
  const byProfile: AiRecruitSafetyDiagnosticSummary["candidateFocalByProfile"] =
    {};

  for (const episode of episodes) {
    baselineValues.push(
      ...Object.values(episode.baseline.safetyDiagnostics.byPlayer),
    );
    for (const candidate of episode.candidates) {
      candidateValues.push(
        ...Object.values(candidate.run.safetyDiagnostics.byPlayer),
      );
      const focal =
        candidate.run.safetyDiagnostics.byPlayer[candidate.controlledPlayerId];
      if (!focal) continue;
      focalValues.push(focal);
      byScenario[episode.scenarioId] =
        sumAiRecruitSafetyPlayerDiagnostics([
          byScenario[episode.scenarioId] ?? emptyPlayerDiagnostics(),
          focal,
        ]);
      const profileId = getAiStrategyProfile(candidate.controlledPlayerId).id;
      byProfile[profileId] = sumAiRecruitSafetyPlayerDiagnostics([
        byProfile[profileId] ?? emptyPlayerDiagnostics(),
        focal,
      ]);
    }
  }
  return {
    baselineAllPlayers:
      sumAiRecruitSafetyPlayerDiagnostics(baselineValues),
    candidateAllPlayers:
      sumAiRecruitSafetyPlayerDiagnostics(candidateValues),
    candidateFocalPlayers:
      sumAiRecruitSafetyPlayerDiagnostics(focalValues),
    candidateFocalByScenario: byScenario,
    candidateFocalByProfile: byProfile,
  };
}

export function runAiRecruitSafetyBenchmark(
  options: AiRecruitSafetyBenchmarkOptions = {},
) {
  const seeds = positiveInteger(options.seeds, DEFAULTS.seeds, "seeds");
  const startSeed = options.startSeed ?? DEFAULTS.startSeed;
  if (
    !Number.isSafeInteger(startSeed) ||
    !Number.isSafeInteger(startSeed + seeds - 1)
  ) {
    throw new RangeError("scheduled seeds must be safe integers");
  }
  // This is intentionally the first operation that can touch benchmark state.
  // Sealed/consumed formal ranges therefore fail before progress is emitted.
  assertAiBenchmarkSeedAccess({ startSeed, seeds });

  const scenarioIds = normalizeAiBenchmarkScenarioIds(
    options.scenarioIds === undefined
      ? AI_BENCHMARK_SCENARIOS
      : options.scenarioIds,
  );
  const maxRounds = positiveInteger(
    options.maxRounds,
    DEFAULTS.maxRounds,
    "maxRounds",
  );
  const initialHealth = options.initialHealth ?? DEFAULT_INITIAL_HEALTH;
  if (!isValidInitialHealth(initialHealth)) {
    throw new RangeError("initialHealth must be an integer from 1 to 999");
  }

  const profiles = profileSnapshots();
  const strategyProfileHash = profileHash(profiles);
  const profileIds = profiles.map(({ profile }) => profile.id);
  if (new Set(profileIds).size !== profiles.length) {
    throw new Error("recruit-safety benchmark requires seven unique profiles");
  }
  const policyVersion = AI_POLICY_VERSION;
  const scheduledRuns = seeds * scenarioIds.length * RUNS_PER_SCENARIO;
  const expectedPairs =
    seeds * scenarioIds.length * AI_RECRUIT_SAFETY_PLAYER_IDS.length;
  const expectedLogicalPairedSeats =
    seeds * AI_RECRUIT_SAFETY_PLAYER_IDS.length;
  const clusters: AiRecruitSafetySeedCluster[] = [];
  const runnerFailures: AiRecruitSafetyRunnerFailure[] = [];
  let expectedContentVersion: string | null = null;
  let processedRuns = 0;
  let completedRuns = 0;

  const checkContentVersion = (state: GameState): void => {
    if (expectedContentVersion === null) {
      expectedContentVersion = state.contentVersion;
    } else if (state.contentVersion !== expectedContentVersion) {
      throw new Error(
        `contentVersion drifted from ${expectedContentVersion} to ${state.contentVersion}`,
      );
    }
  };

  const runGame = (
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    controlledPlayerId: AiRecruitSafetyPlayerId | null,
  ): AiRecruitSafetyGameRun => {
    let state = createAiBenchmarkScenarioGame(
      scenarioId,
      seed,
      initialHealth,
    );
    checkContentVersion(state);
    const diagnostics = emptyDiagnostics(
      state.players.map((player) => player.id),
    );
    while (state.phase !== "gameOver") {
      if (state.phase === "recruit" && state.round > maxRounds) break;
      const modes = createAiRecruitSafetyModeMap(
        state.players.map((player) => player.id),
        controlledPlayerId,
      );
      const advanced = advanceHeadlessGameWithAiRecruitSafetyModes(
        state,
        modes,
      );
      state = advanced.state;
      mergeDiagnostics(diagnostics, advanced.diagnostics);
      checkContentVersion(state);
    }
    return gameRunResult(state, diagnostics);
  };

  const reportProgress = (
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    arm: "baseline" | "candidate",
    controlledPlayerId: AiRecruitSafetyPlayerId | null,
    run: AiRecruitSafetyGameRun,
  ): void => {
    processedRuns += 1;
    if (run.completed) completedRuns += 1;
    options.onProgress?.({
      processedRuns,
      scheduledRuns,
      seed,
      scenarioId,
      arm,
      controlledPlayerId,
      completed: run.completed,
      failure: run.failure,
    });
  };

  for (let seedOffset = 0; seedOffset < seeds; seedOffset += 1) {
    const seed = startSeed + seedOffset;
    const episodes: AiRecruitSafetyEpisode[] = [];
    const clusterPairs: AiRecruitSafetyPair[] = [];
    for (const scenarioId of scenarioIds) {
      let baseline: AiRecruitSafetyGameRun;
      try {
        baseline = runGame(seed, scenarioId, null);
      } catch (error) {
        const message = errorMessage(error);
        runnerFailures.push({
          seed,
          scenarioId,
          arm: "baseline",
          controlledPlayerId: null,
          message,
        });
        baseline = failedGameRun(message);
      }
      reportProgress(seed, scenarioId, "baseline", null, baseline);

      const candidates: AiRecruitSafetyCandidateRun[] = [];
      const pairs: AiRecruitSafetyPair[] = [];
      for (const playerId of AI_RECRUIT_SAFETY_PLAYER_IDS) {
        let candidate: AiRecruitSafetyGameRun;
        try {
          candidate = runGame(seed, scenarioId, playerId);
        } catch (error) {
          const message = errorMessage(error);
          runnerFailures.push({
            seed,
            scenarioId,
            arm: "candidate",
            controlledPlayerId: playerId,
            message,
          });
          candidate = failedGameRun(message);
        }
        candidates.push({ controlledPlayerId: playerId, run: candidate });
        pairs.push(buildPair(seed, scenarioId, playerId, baseline, candidate));
        reportProgress(
          seed,
          scenarioId,
          "candidate",
          playerId,
          candidate,
        );
      }
      clusterPairs.push(...pairs);
      episodes.push({ seed, scenarioId, baseline, candidates, pairs });
    }
    clusters.push({
      seed,
      episodes,
      pairs: clusterPairs,
      metric: seedMetricFromPairs(
        seed,
        clusterPairs,
        scenarioIds.length * AI_RECRUIT_SAFETY_PLAYER_IDS.length,
      ),
    });
  }

  const allEpisodes = clusters.flatMap((cluster) => cluster.episodes);
  const allRuns = allEpisodes.flatMap((episode) => [
    episode.baseline,
    ...episode.candidates.map((candidate) => candidate.run),
  ]);
  const allPairs = clusters.flatMap((cluster) => cluster.pairs);
  const pairedPairs = allPairs.filter(isCompletePair).length;
  const missingPairs = expectedPairs - pairedPairs;
  const summarizedClusters = summarizeAiRecruitSafetyClusters(
    clusters,
    scenarioIds,
  );
  const logicalPairedSeats = summarizedClusters.logicalPairedSeats;
  const missingLogicalPairedSeats =
    expectedLogicalPairedSeats - logicalPairedSeats;
  const drawnRuns = allRuns.filter((run) => run.drawn).length;
  const truncatedRuns = allRuns.filter((run) => run.truncated).length;
  const comparisons = summarizedClusters.comparisonMatrix;
  const safetyDiagnostics = diagnosticSummary(allEpisodes);
  const focalDecisionDivergences =
    safetyDiagnostics.candidateFocalPlayers.decisionDivergences;
  const treatmentExposed = focalDecisionDivergences > 0;

  const evaluatorHashAfter = evaluatorHash();
  const evaluatorStable = evaluatorHashAfter === EVALUATOR_HASH;
  const policyVersionAfter = AI_POLICY_VERSION;
  const policyVersionStable = policyVersionAfter === policyVersion;
  const strategyProfileHashAfter = profileHash(profileSnapshots());
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  if (!evaluatorStable) {
    runnerFailures.push({
      seed: startSeed,
      scenarioId: null,
      arm: "provenance",
      controlledPlayerId: null,
      message: "evaluator source changed during the benchmark",
    });
  }
  if (!policyVersionStable || !strategyProfilesStable) {
    runnerFailures.push({
      seed: startSeed,
      scenarioId: null,
      arm: "provenance",
      controlledPlayerId: null,
      message: "AI policy or strategy profiles changed during the benchmark",
    });
  }

  const evidenceReasons: string[] = [];
  appendReason(
    evidenceReasons,
    processedRuns === scheduledRuns,
    "requires every scheduled baseline and candidate run",
  );
  appendReason(
    evidenceReasons,
    runnerFailures.length === 0,
    "requires zero runner or provenance failures",
  );
  appendReason(
    evidenceReasons,
    pairedPairs === expectedPairs && missingPairs === 0,
    "requires every seed/scenario/physical-player pair",
  );
  appendReason(
    evidenceReasons,
    logicalPairedSeats === expectedLogicalPairedSeats &&
      missingLogicalPairedSeats === 0,
    "requires both scenarios for every seed/profile stratum",
  );
  appendReason(
    evidenceReasons,
    truncatedRuns === 0,
    "requires zero truncated runs",
  );
  appendReason(
    evidenceReasons,
    evaluatorStable,
    "requires stable evaluator source",
  );
  appendReason(
    evidenceReasons,
    policyVersionStable && strategyProfilesStable,
    "requires stable AI policy and strategy profiles",
  );

  const plannerGate = evaluateAiRecruitPlannerGate({
    configuredSeeds: seeds,
    pairedSeats: logicalPairedSeats,
    missingPairs: missingLogicalPairedSeats,
    incompletePlans: 0,
    rejectedActions: 0,
    boundaryViolations: 0,
    replanLimitHits: 0,
    drawnRuns,
    runnerFailures: runnerFailures.length,
    comparisons: comparisons.overall,
  });
  const screeningGate = evaluateAiRecruitSafetyScreeningGate({
    evidenceReasons,
    plannerGate,
    focalDecisionDivergences,
  });

  return {
    method: "development-single-seat-recruit-safety-counterfactual-v1" as const,
    evidenceStage: "development-only" as const,
    benchmarkVersion: AI_RECRUIT_SAFETY_BENCHMARK_VERSION,
    policyVersion,
    policyVersionAfter,
    policyVersionStable,
    contentVersion: expectedContentVersion,
    evaluatorHash: EVALUATOR_HASH,
    evaluatorHashAfter,
    evaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    strategyProfiles: profiles,
    config: {
      seeds,
      startSeed,
      maxRounds,
      initialHealth,
      scenarioIds,
      scoredPlayerIds: AI_RECRUIT_SAFETY_PLAYER_IDS,
      baselineMode: "all-legacy-v3" as const,
      candidateMode: "single-physical-player-safe-v4" as const,
    },
    progress: {
      processedRuns,
      scheduledRuns,
      completedRuns,
      failedRuns: runnerFailures.length,
    },
    expectedPairs,
    pairedPairs,
    missingPairs,
    expectedLogicalPairedSeats,
    logicalPairedSeats,
    missingLogicalPairedSeats,
    drawnRuns,
    truncatedRuns,
    runnerFailures,
    clusters,
    comparisons: comparisons.overall,
    comparisonMatrix: comparisons,
    safetyDiagnostics,
    focalDecisionDivergences,
    treatmentExposed,
    evidenceUsable: evidenceReasons.length === 0,
    evidenceReasons: Object.freeze(evidenceReasons),
    plannerGate,
    screeningGate,
    accepted: screeningGate.accepted,
    acceptanceReasons: screeningGate.reasons,
  };
}

function integerArgument(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} requires an integer value`);
  }
  return value;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runAiRecruitSafetyBenchmark({
    seeds: integerArgument("--seeds"),
    startSeed: integerArgument("--start-seed"),
    maxRounds: integerArgument("--max-rounds"),
    initialHealth: integerArgument("--initial-health"),
    onProgress: (item) => {
      if (
        item.arm === "candidate" &&
        item.controlledPlayerId === "player-7"
      ) {
        console.error(
          `[ai-recruit-safety] ${item.processedRuns}/${item.scheduledRuns}`,
        );
      }
    },
  });
  console.log(JSON.stringify(result, null, 2));
}
