import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  AI_RECRUIT_PLANNER_VERSION,
  planAiRecruitTurn,
} from "../lib/game/ai-recruit-planner.ts";
import {
  AI_TRAINING_ENVIRONMENT_VERSION,
  AiTrainingEnvironment,
} from "../lib/game/ai-training-environment.ts";
import {
  AI_POLICY_VERSION,
  getAiStrategyProfile,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  advanceHeadlessGame,
  createHeadlessGame,
  type GameState,
} from "../lib/game/engine.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  isValidInitialHealth,
} from "../lib/game/setup.ts";
import { assertAiBenchmarkSeedAccess } from "./ai-seed-ledger.ts";

export const AI_RECRUIT_PLANNER_BENCHMARK_VERSION = 2 as const;
export const AI_RECRUIT_PLANNER_MINIMUM_GATE_SEEDS = 24;
export const AI_RECRUIT_PLANNER_CONTROLLED_SEATS = [
  1, 2, 3, 4, 5, 6, 7,
] as const;
export type AiRecruitPlannerControlledSeat =
  (typeof AI_RECRUIT_PLANNER_CONTROLLED_SEATS)[number];

const DEFAULTS = {
  seeds: 1,
  startSeed: 1,
  maxRounds: 40,
  beamWidth: 2,
  maxActions: 3,
};
const RUNS_PER_SEED = 8;

export interface PlacementBounds {
  best: number;
  worst: number;
  exact: boolean;
}

export interface AiRecruitPlannerSeedMetric {
  seed: number;
  placementDelta: number;
  topFourDelta: number;
  winDelta: number;
}

export interface MetricComparison {
  pairedSeats: number;
  seedClusters: number;
  meanDelta: number | null;
  confidence95: { lower: number; upper: number } | null;
}

export interface AiRecruitPlannerComparisons {
  placement: MetricComparison;
  topFour: MetricComparison;
  win: MetricComparison;
}

export interface AiRecruitPlannerGateEvidence {
  configuredSeeds: number;
  pairedSeats: number;
  missingPairs: number;
  incompletePlans: number;
  rejectedActions: number;
  boundaryViolations: number;
  replanLimitHits: number;
  drawnRuns: number;
  runnerFailures: number;
  comparisons: AiRecruitPlannerComparisons;
}

export interface AiRecruitPlannerBenchmarkProgress {
  processedRuns: number;
  scheduledRuns: number;
  seed: number;
  kind: "baseline" | "candidate";
  controlledSeat: AiRecruitPlannerControlledSeat | null;
  completed: boolean;
  failure: string | null;
}

export interface AiRecruitPlannerBenchmarkOptions {
  seeds?: number;
  startSeed?: number;
  maxRounds?: number;
  beamWidth?: number;
  maxActions?: number;
  initialHealth?: number;
  onProgress?: (progress: AiRecruitPlannerBenchmarkProgress) => void;
}

export interface AiRecruitPlannerProfileSnapshot {
  playerId: string;
  profile: AiStrategyProfile;
}

type Baseline = {
  completed: boolean;
  drawn: boolean;
  finalRound: number | null;
  alivePlayers: number | null;
  contentVersion: string | null;
  seats: ReadonlyArray<{
    seat: AiRecruitPlannerControlledSeat;
    playerId: string;
    placementBounds: PlacementBounds | null;
  }>;
  failure: string | null;
};

type Candidate = {
  controlledSeat: AiRecruitPlannerControlledSeat;
  playerId: string;
  strategyId: AiStrategyId;
  completed: boolean;
  drawn: boolean;
  finalRound: number;
  alivePlayers: number;
  contentVersion: string;
  placementBounds: PlacementBounds | null;
  plannedTurns: number;
  planInvocations: number;
  replanActions: number;
  randomReplans: number;
  incompletePlans: number;
  rejectedActions: number;
  boundaryViolations: number;
  replanLimitHits: number;
  failure: string | null;
};

type Pair = {
  seat: AiRecruitPlannerControlledSeat;
  playerId: string;
  strategyId: AiStrategyId;
  baselinePlacementBounds: PlacementBounds | null;
  candidate: Candidate;
  conservativePlacementDelta: number | null;
  conservativeTopFourDelta: number | null;
  conservativeWinDelta: number | null;
};

type Cluster = {
  seed: number;
  baseline: Baseline;
  pairs: Pair[];
  metric: AiRecruitPlannerSeedMetric | null;
};

function sourceHash(): string {
  const hash = createHash("sha256");
  const directory = new URL("../lib/game/", import.meta.url);
  for (const name of readdirSync(directory).filter((name) => name.endsWith(".ts")).sort()) {
    hash.update(name).update("\0").update(readFileSync(new URL(name, directory))).update("\0");
  }
  return hash
    .update("scripts/benchmark-ai-recruit-planner.ts\0")
    .update(readFileSync(new URL("./benchmark-ai-recruit-planner.ts", import.meta.url)))
    .digest("hex");
}

const EVALUATOR_HASH = sourceHash();

function strategyProfileSnapshots(): AiRecruitPlannerProfileSnapshot[] {
  return AI_RECRUIT_PLANNER_CONTROLLED_SEATS.map((seat) => {
    const playerId = `player-${seat}`;
    return {
      playerId,
      profile: { ...getAiStrategyProfile(playerId) },
    };
  });
}

function profileHash(
  profiles: readonly AiRecruitPlannerProfileSnapshot[],
): string {
  return createHash("sha256")
    .update(JSON.stringify(profiles))
    .digest("hex");
}

function positiveInteger(value: number | undefined, fallback: number, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new RangeError(`${label} must be an integer from 1 to ${maximum}`);
  }
  return result;
}

export function placementBoundsFromPlacement(
  placement: number | null | undefined,
  alivePlayers: number,
): PlacementBounds {
  if (placement !== null && placement !== undefined) {
    if (!Number.isSafeInteger(placement) || placement < 1 || placement > 8) {
      throw new RangeError("placement must be an integer from 1 to 8");
    }
    return { best: placement, worst: placement, exact: true };
  }
  if (!Number.isSafeInteger(alivePlayers) || alivePlayers < 1 || alivePlayers > 8) {
    throw new RangeError("alivePlayers must be an integer from 1 to 8");
  }
  return { best: 1, worst: alivePlayers, exact: false };
}

function rateBounds(bounds: PlacementBounds, metric: "topFour" | "win") {
  if (metric === "topFour") {
    return { lower: bounds.worst <= 4 ? 1 : 0, upper: bounds.best <= 4 ? 1 : 0 };
  }
  return { lower: bounds.worst === 1 ? 1 : 0, upper: bounds.best === 1 ? 1 : 0 };
}

export function conservativePlacementDelta(candidate: PlacementBounds, baseline: PlacementBounds): number {
  return candidate.worst - baseline.best;
}

export function conservativeRateDelta(
  candidate: PlacementBounds,
  baseline: PlacementBounds,
  metric: "topFour" | "win",
): number {
  return rateBounds(candidate, metric).lower - rateBounds(baseline, metric).upper;
}

function tCritical95(degreesOfFreedom: number): number {
  const table = [
    0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
    2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093,
    2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045,
    2.042,
  ];
  return table[Math.min(Math.max(1, degreesOfFreedom), 30)] ?? 2.042;
}

function summarize(values: readonly number[], pairedSeats: number): MetricComparison {
  if (values.length === 0) {
    return { pairedSeats, seedClusters: 0, meanDelta: null, confidence95: null };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) {
    return { pairedSeats, seedClusters: 1, meanDelta: mean, confidence95: null };
  }
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const margin = tCritical95(values.length - 1) * Math.sqrt(variance / values.length);
  const round = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
  return {
    pairedSeats,
    seedClusters: values.length,
    meanDelta: round(mean),
    confidence95: { lower: round(mean - margin), upper: round(mean + margin) },
  };
}

export function summarizeAiRecruitPlannerSeedMetrics(
  metrics: readonly AiRecruitPlannerSeedMetric[],
  pairedSeats = metrics.length * 7,
): AiRecruitPlannerComparisons {
  if (!Number.isSafeInteger(pairedSeats) || pairedSeats < 0) {
    throw new RangeError("pairedSeats must be a non-negative integer");
  }
  const seen = new Set<number>();
  for (const metric of metrics) {
    if (!Number.isSafeInteger(metric.seed) || seen.has(metric.seed)) {
      throw new Error(`invalid or duplicate seed ${metric.seed}`);
    }
    seen.add(metric.seed);
    if (![metric.placementDelta, metric.topFourDelta, metric.winDelta].every(Number.isFinite)) {
      throw new Error(`seed ${metric.seed} contains a non-finite delta`);
    }
  }
  return {
    placement: summarize(metrics.map((metric) => metric.placementDelta), pairedSeats),
    topFour: summarize(metrics.map((metric) => metric.topFourDelta), pairedSeats),
    win: summarize(metrics.map((metric) => metric.winDelta), pairedSeats),
  };
}

export function evaluateAiRecruitPlannerGate(evidence: AiRecruitPlannerGateEvidence) {
  const reasons: string[] = [];
  const requireCondition = (condition: boolean, reason: string) => {
    if (!condition) reasons.push(reason);
  };
  const expectedPairs = evidence.configuredSeeds * 7;
  requireCondition(
    Number.isSafeInteger(evidence.configuredSeeds) &&
      evidence.configuredSeeds > 0,
    "configured seeds must be a positive integer",
  );
  requireCondition(evidence.configuredSeeds >= 24, "requires at least 24 configured seeds");
  requireCondition(evidence.pairedSeats === expectedPairs, `requires all ${expectedPairs} seat pairs`);
  requireCondition(evidence.missingPairs === 0, "requires zero missing pairs");
  requireCondition(evidence.incompletePlans === 0, "requires zero incomplete plans");
  requireCondition(evidence.rejectedActions === 0, "requires zero rejected actions");
  requireCondition(
    evidence.boundaryViolations === 0,
    "requires zero planner-boundary violations",
  );
  requireCondition(
    evidence.replanLimitHits === 0,
    "requires zero replan limit hits",
  );
  requireCondition(evidence.drawnRuns === 0, "requires zero drawn runs");
  requireCondition(evidence.runnerFailures === 0, "requires zero runner failures");
  const { placement, topFour, win } = evidence.comparisons;
  for (const [label, comparison] of Object.entries({
    placement,
    topFour,
    win,
  })) {
    requireCondition(
      comparison.pairedSeats === expectedPairs,
      `${label} comparison requires all ${expectedPairs} seat pairs`,
    );
    requireCondition(
      comparison.seedClusters === evidence.configuredSeeds,
      `${label} comparison requires all configured seed clusters`,
    );
  }
  requireCondition(placement.seedClusters >= 24, "placement requires at least 24 seed clusters");
  requireCondition(placement.meanDelta !== null && placement.meanDelta <= -0.1, "mean placement delta must be at most -0.10");
  requireCondition(placement.confidence95 !== null && placement.confidence95.upper < 0, "placement CI upper bound must be below 0");
  requireCondition(topFour.seedClusters >= 24 && topFour.confidence95 !== null && topFour.confidence95.lower >= -0.02, "top-four CI lower bound must be at least -0.02");
  requireCondition(win.seedClusters >= 24 && win.confidence95 !== null && win.confidence95.lower >= -0.03, "win CI lower bound must be at least -0.03");
  return { accepted: reasons.length === 0, reasons };
}

function baselineSeats(state: GameState): Baseline["seats"] {
  const alivePlayers = state.players.filter((player) => player.alive).length;
  return AI_RECRUIT_PLANNER_CONTROLLED_SEATS.map((seat) => {
    const player = state.players[seat];
    const placementBounds = player && (player.alive || player.placement !== undefined)
      ? placementBoundsFromPlacement(player.placement, alivePlayers)
      : null;
    return { seat, playerId: player?.id ?? `player-${seat}`, placementBounds };
  });
}

function runBaseline(seed: number, maxRounds: number, initialHealth: number): Baseline {
  let state = createHeadlessGame(seed, initialHealth);
  while (state.phase !== "gameOver") {
    if (state.phase === "recruit" && state.round > maxRounds) break;
    state = advanceHeadlessGame(state);
  }
  const alivePlayers = state.players.filter((player) => player.alive).length;
  return {
    completed: state.phase === "gameOver",
    drawn: state.phase === "gameOver" && state.winnerId === null,
    finalRound: state.round,
    alivePlayers,
    contentVersion: state.contentVersion,
    seats: baselineSeats(state),
    failure: null,
  };
}

function runCandidate(
  seed: number,
  controlledSeat: AiRecruitPlannerControlledSeat,
  config: { maxRounds: number; beamWidth: number; maxActions: number; initialHealth: number },
): Candidate {
  const playerId = `player-${controlledSeat}`;
  const profile = getAiStrategyProfile(playerId);
  const environment = new AiTrainingEnvironment(seed, controlledSeat, config.initialHealth);
  let plannedTurns = 0;
  let planInvocations = 0;
  let replanActions = 0;
  let randomReplans = 0;
  let incompletePlans = 0;
  let rejectedActions = 0;
  let boundaryViolations = 0;
  let replanLimitHits = 0;
  let activeRecruitRound = -1;
  let actionsThisRecruit = 0;
  let failure: string | null = null;
  const maximumActionsPerRecruit = Math.max(50, config.maxActions * 16);
  outer: while (true) {
    const observation = environment.observe();
    if (observation.own.placement !== null || observation.public.phase === "gameOver") break;
    if (observation.public.phase === "recruit" && observation.public.round > config.maxRounds) break;
    if (observation.public.phase === "combat") {
      const action = environment.legalActions().find((item) => item.type === "CONTINUE");
      if (!action) { failure = "combat phase exposed no CONTINUE action"; break; }
      if (!environment.step(action.token, { includeLegalActions: false }).accepted) {
        rejectedActions += 1; failure = "CONTINUE action was rejected"; break;
      }
      continue;
    }
    if (observation.public.round !== activeRecruitRound) {
      activeRecruitRound = observation.public.round;
      actionsThisRecruit = 0;
      plannedTurns += 1;
    }
    const plan = planAiRecruitTurn(environment, {
      beamWidth: config.beamWidth,
      maxActions: config.maxActions,
      profile,
    });
    planInvocations += 1;
    if (plan.termination === "searchExhausted") {
      incompletePlans += 1; failure = "planner returned an incomplete turn"; break;
    }
    const lastAction = plan.actions.at(-1);
    const validEndTurn =
      plan.termination === "endTurn" &&
      plan.complete &&
      lastAction?.type === "END_TURN" &&
      lastAction.plannerDisposition === "terminal";
    const validReplan =
      plan.termination === "replanAfterAction" &&
      !plan.complete &&
      lastAction !== undefined &&
      lastAction.type !== "END_TURN" &&
      lastAction.plannerDisposition === "replan";
    if (!validEndTurn && !validReplan) {
      boundaryViolations += 1;
      failure = "planner returned an invalid action boundary";
      break;
    }
    if (
      actionsThisRecruit + plan.actions.length >
      maximumActionsPerRecruit
    ) {
      replanLimitHits += 1;
      failure = "planner exceeded the Recruit action limit";
      break;
    }
    let finalTransition = null as ReturnType<AiTrainingEnvironment["step"]> | null;
    for (const action of plan.actions) {
      const transition = environment.step(action.token, {
        includeLegalActions: false,
      });
      finalTransition = transition;
      actionsThisRecruit += 1;
      if (!transition.accepted) {
        rejectedActions += 1; failure = `${action.type} action was rejected`; break outer;
      }
      if (
        action.plannerDisposition === "deterministic" &&
        transition.randomnessConsumed
      ) {
        boundaryViolations += 1;
        failure = `${action.type} crossed an undeclared random boundary`;
        break outer;
      }
    }
    if (validReplan) {
      replanActions += 1;
      if (finalTransition?.randomnessConsumed) randomReplans += 1;
      if (
        finalTransition?.observation.public.phase !== "recruit" ||
        finalTransition.done
      ) {
        boundaryViolations += 1;
        failure = "replan boundary left the Recruit episode";
        break;
      }
      continue;
    }
    if (finalTransition?.observation.public.phase !== "combat") {
      boundaryViolations += 1;
      failure = "end-turn fragment did not enter Combat";
      break;
    }
  }
  const observation = environment.observe();
  const alivePlayers = observation.public.players.filter((player) => player.alive).length;
  const placementBounds = observation.own.alive || observation.own.placement !== null
    ? placementBoundsFromPlacement(observation.own.placement, alivePlayers)
    : null;
  return {
    controlledSeat, playerId, strategyId: profile.id,
    completed: observation.own.placement !== null || observation.public.phase === "gameOver",
    drawn: observation.public.phase === "gameOver" && observation.public.winnerSeat === null,
    finalRound: observation.public.round, alivePlayers,
    contentVersion: observation.public.contentVersion, placementBounds,
    plannedTurns, planInvocations, replanActions, randomReplans,
    incompletePlans, rejectedActions, boundaryViolations, replanLimitHits,
    failure,
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function runAiRecruitPlannerBenchmark(options: AiRecruitPlannerBenchmarkOptions = {}) {
  const seeds = positiveInteger(options.seeds, DEFAULTS.seeds, "seeds");
  const startSeed = options.startSeed ?? DEFAULTS.startSeed;
  if (!Number.isSafeInteger(startSeed) || !Number.isSafeInteger(startSeed + seeds - 1)) {
    throw new RangeError("scheduled seeds must be safe integers");
  }
  assertAiBenchmarkSeedAccess({ startSeed, seeds });
  const config = {
    seeds, startSeed,
    maxRounds: positiveInteger(options.maxRounds, DEFAULTS.maxRounds, "maxRounds"),
    beamWidth: positiveInteger(options.beamWidth, DEFAULTS.beamWidth, "beamWidth", 64),
    maxActions: positiveInteger(options.maxActions, DEFAULTS.maxActions, "maxActions", 20),
    initialHealth: options.initialHealth ?? DEFAULT_INITIAL_HEALTH,
    controlledSeats: AI_RECRUIT_PLANNER_CONTROLLED_SEATS,
  };
  if (!isValidInitialHealth(config.initialHealth)) {
    throw new RangeError("initialHealth must be an integer from 1 to 999");
  }
  const strategyProfiles = strategyProfileSnapshots();
  const strategyProfileHash = profileHash(strategyProfiles);
  const scheduledRuns = seeds * RUNS_PER_SEED;
  let processedRuns = 0;
  let completedRuns = 0;
  let contentVersion: string | null = null;
  const failures: Array<{ seed: number; run: string; message: string }> = [];
  const clusters: Cluster[] = [];
  const progress = (seed: number, kind: "baseline" | "candidate", seat: AiRecruitPlannerControlledSeat | null, completed: boolean, failure: string | null) => {
    processedRuns += 1;
    if (completed) completedRuns += 1;
    options.onProgress?.({ processedRuns, scheduledRuns, seed, kind, controlledSeat: seat, completed, failure });
  };
  const checkVersion = (version: string | null, seed: number, run: string) => {
    if (!version) return;
    if (contentVersion === null) contentVersion = version;
    else if (version !== contentVersion) failures.push({ seed, run, message: `content version changed to ${version}` });
  };

  for (let offset = 0; offset < seeds; offset += 1) {
    const seed = startSeed + offset;
    let baseline: Baseline;
    try {
      baseline = runBaseline(seed, config.maxRounds, config.initialHealth);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ seed, run: "baseline", message });
      baseline = {
        completed: false, drawn: false, finalRound: null, alivePlayers: null,
        contentVersion: null, failure: message,
        seats: AI_RECRUIT_PLANNER_CONTROLLED_SEATS.map((seat) => ({ seat, playerId: `player-${seat}`, placementBounds: null })),
      };
    }
    checkVersion(baseline.contentVersion, seed, "baseline");
    progress(seed, "baseline", null, baseline.completed, baseline.failure);
    const pairs: Pair[] = [];
    for (const seat of AI_RECRUIT_PLANNER_CONTROLLED_SEATS) {
      let candidate: Candidate;
      try {
        candidate = runCandidate(seed, seat, config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const playerId = `player-${seat}`;
        candidate = {
          controlledSeat: seat, playerId, strategyId: getAiStrategyProfile(playerId).id,
          completed: false, drawn: false, finalRound: 0, alivePlayers: 8,
          contentVersion: "", placementBounds: null, plannedTurns: 0,
          planInvocations: 0, replanActions: 0, randomReplans: 0,
          incompletePlans: 0, rejectedActions: 0,
          boundaryViolations: 0, replanLimitHits: 0, failure: message,
        };
      }
      if (candidate.failure) failures.push({ seed, run: `candidate-seat-${seat}`, message: candidate.failure });
      checkVersion(candidate.contentVersion, seed, `candidate-seat-${seat}`);
      const baselineBounds = baseline.seats.find((item) => item.seat === seat)?.placementBounds ?? null;
      const candidateBounds = candidate.placementBounds;
      const usable = baseline.failure === null && candidate.failure === null && baselineBounds !== null && candidateBounds !== null;
      pairs.push({
        seat, playerId: candidate.playerId, strategyId: candidate.strategyId,
        baselinePlacementBounds: baselineBounds, candidate,
        conservativePlacementDelta: usable ? conservativePlacementDelta(candidateBounds, baselineBounds) : null,
        conservativeTopFourDelta: usable ? conservativeRateDelta(candidateBounds, baselineBounds, "topFour") : null,
        conservativeWinDelta: usable ? conservativeRateDelta(candidateBounds, baselineBounds, "win") : null,
      });
      progress(seed, "candidate", seat, candidate.completed, candidate.failure);
    }
    const completePairs = pairs.filter((pair) => pair.conservativePlacementDelta !== null);
    const metric = completePairs.length === 7 ? {
      seed,
      placementDelta: mean(completePairs.map((pair) => pair.conservativePlacementDelta as number)),
      topFourDelta: mean(completePairs.map((pair) => pair.conservativeTopFourDelta as number)),
      winDelta: mean(completePairs.map((pair) => pair.conservativeWinDelta as number)),
    } : null;
    clusters.push({ seed, baseline, pairs, metric });
  }

  const pairs = clusters.flatMap((cluster) => cluster.pairs);
  const pairedSeats = pairs.filter((pair) => pair.conservativePlacementDelta !== null).length;
  const missingPairs = seeds * 7 - pairedSeats;
  const incompletePlans = pairs.reduce((sum, pair) => sum + pair.candidate.incompletePlans, 0);
  const rejectedActions = pairs.reduce((sum, pair) => sum + pair.candidate.rejectedActions, 0);
  const boundaryViolations = pairs.reduce(
    (sum, pair) => sum + pair.candidate.boundaryViolations,
    0,
  );
  const replanLimitHits = pairs.reduce(
    (sum, pair) => sum + pair.candidate.replanLimitHits,
    0,
  );
  const replanActions = pairs.reduce(
    (sum, pair) => sum + pair.candidate.replanActions,
    0,
  );
  const randomReplans = pairs.reduce(
    (sum, pair) => sum + pair.candidate.randomReplans,
    0,
  );
  const drawnRuns = clusters.reduce((sum, cluster) =>
    sum + (cluster.baseline.drawn ? 1 : 0) +
    cluster.pairs.filter((pair) => pair.candidate.drawn).length, 0);
  const comparisons = summarizeAiRecruitPlannerSeedMetrics(
    clusters.flatMap((cluster) => cluster.metric ? [cluster.metric] : []), pairedSeats,
  );
  const evaluatorHashAfter = sourceHash();
  const evaluatorStable = evaluatorHashAfter === EVALUATOR_HASH;
  if (!evaluatorStable) {
    failures.push({
      seed: startSeed,
      run: "evaluator-drift",
      message: "evaluator source changed during the benchmark",
    });
  }
  const gate = evaluateAiRecruitPlannerGate({
    configuredSeeds: seeds, pairedSeats, missingPairs, incompletePlans,
    rejectedActions, boundaryViolations, replanLimitHits, drawnRuns,
    runnerFailures: failures.length, comparisons,
  });
  return {
    method: "deployment-seat-paired-replacement-v2-replan" as const,
    benchmarkVersion: AI_RECRUIT_PLANNER_BENCHMARK_VERSION,
    environmentVersion: AI_TRAINING_ENVIRONMENT_VERSION,
    plannerVersion: AI_RECRUIT_PLANNER_VERSION,
    contentVersion, policyVersion: AI_POLICY_VERSION,
    evaluatorHash: EVALUATOR_HASH,
    evaluatorHashAfter,
    evaluatorStable,
    strategyProfileHash,
    strategyProfiles,
    config,
    progress: { processedRuns, scheduledRuns, completedRuns, failedRuns: failures.length },
    pairedSeats, missingPairs, incompletePlans, rejectedActions,
    boundaryViolations, replanLimitHits, replanActions, randomReplans,
    drawnRuns,
    runnerFailures: failures, clusters, comparisons,
    accepted: gate.accepted, acceptanceReasons: gate.reasons,
  };
}

function integerArgument(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} requires an integer value`);
  return value;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = runAiRecruitPlannerBenchmark({
    seeds: integerArgument("--seeds"), startSeed: integerArgument("--start-seed"),
    maxRounds: integerArgument("--max-rounds"), beamWidth: integerArgument("--beam-width"),
    maxActions: integerArgument("--max-actions"), initialHealth: integerArgument("--initial-health"),
    onProgress: (item) => {
      if (item.controlledSeat === 7) console.error(`[ai-recruit-benchmark] ${item.processedRuns}/${item.scheduledRuns}`);
    },
  });
  console.log(JSON.stringify(result, null, 2));
}
