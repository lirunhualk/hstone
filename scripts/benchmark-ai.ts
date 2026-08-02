import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  advanceHeadlessGame,
  createHeadlessGame,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  AI_POLICY_VERSION,
  AI_STRATEGY_PROFILES,
  getAiStrategyProfile,
  withAiStrategyProfileOverrides,
  type AiStrategyProfile,
  type AiStrategyId,
} from "../lib/game/ai.ts";
import { hasAnyAiResidualPolicyOverrides } from "../lib/game/ai-residual-policy.ts";
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

const DEFAULT_SEEDS = 10;
const DEFAULT_MAX_ROUNDS = 40;
const SEAT_ROTATIONS = 8;
const CONTROL_PLAYER_ID = "player-0";
const STRATEGY_PLAYER_IDS = AI_STRATEGY_PROFILES.map(
  (_profile, index) => `player-${index + 1}`,
);

interface EvaluatorSourceFile {
  relativePath: string;
  url: URL;
}

const GAME_DIRECTORY = new URL("../lib/game/", import.meta.url);

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function evaluatorSourceFiles(
  directory: URL,
  prefix = "",
): EvaluatorSourceFile[] {
  const files: EvaluatorSourceFile[] = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => compareNames(left.name, right.name),
  );
  for (const entry of entries) {
    const relativePath = `${prefix}${entry.name}`;
    const url = new URL(
      entry.isDirectory() ? `${entry.name}/` : entry.name,
      directory,
    );
    if (entry.isDirectory()) {
      files.push(...evaluatorSourceFiles(url, `${relativePath}/`));
    } else if (entry.isFile() && /\.(?:json|ts)$/.test(entry.name)) {
      files.push({ relativePath, url });
    }
  }
  return files;
}

function pinnedContentSnapshotUrl(directory: URL): URL {
  const generatedDirectory = new URL("generated/", directory);
  const names = readdirSync(generatedDirectory)
    .filter(
      (name) =>
        name.startsWith("battlegrounds-") &&
        !name.startsWith("battlegrounds-trinkets-") &&
        name.endsWith(".json"),
    )
    .sort(compareNames);
  if (names.length !== 1) {
    throw new Error(
      `expected exactly one pinned Battlegrounds content snapshot, found ${names.length}`,
    );
  }
  return new URL(names[0], generatedDirectory);
}

export function computeAiBenchmarkContentSnapshotSha256(
  gameDirectory = GAME_DIRECTORY,
): string {
  return createHash("sha256")
    .update(readFileSync(pinnedContentSnapshotUrl(gameDirectory)))
    .digest("hex");
}

export function computeAiBenchmarkEvaluatorHash(
  gameDirectory = GAME_DIRECTORY,
): string {
  const hash = createHash("sha256");
  for (const source of evaluatorSourceFiles(gameDirectory)) {
    hash
      .update(`lib/game/${source.relativePath}`)
      .update("\0")
      .update(readFileSync(source.url))
      .update("\0");
  }
  hash.update("scripts/ai-training-screen-registration.ts\0");
  hash.update(
    readFileSync(
      new URL("./ai-training-screen-registration.ts", import.meta.url),
    ),
  );
  hash.update("\0");
  hash.update("scripts/ai-seed-ledger.ts\0");
  hash.update(readFileSync(new URL("./ai-seed-ledger.ts", import.meta.url)));
  hash.update("\0");
  hash.update("scripts/benchmark-ai.ts\0");
  hash.update(readFileSync(new URL("./benchmark-ai.ts", import.meta.url)));
  return hash.digest("hex");
}

export function computeAiBenchmarkStrategyProfileHash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        Array.from({ length: SEAT_ROTATIONS }, (_value, index) => {
          const playerId = `player-${index}`;
          return { playerId, profile: getAiStrategyProfile(playerId) };
        }),
      ),
    )
    .digest("hex");
}

const CONTENT_SNAPSHOT_SHA256 = computeAiBenchmarkContentSnapshotSha256();
const EVALUATOR_SOURCE_HASH = computeAiBenchmarkEvaluatorHash();

export interface AiBenchmarkOptions {
  seeds?: number;
  startSeed?: number;
  maxRounds?: number;
  includeGames?: boolean;
  profileOverrides?: ReadonlyMap<string, AiStrategyProfile>;
  onProgress?: (progress: AiBenchmarkProgress) => void;
}

interface AiBenchmarkInternalOptions extends AiBenchmarkOptions {
  readonly reservationId?: string;
  readonly reservationMode?: "training-screen";
}

export interface AiBenchmarkProgress {
  processedGames: number;
  scheduledGames: number;
  seed: number;
  rotation: number;
  completed: boolean;
}

export const AI_REGISTERED_TRAINING_BATCH_ARM_ORDER = Object.freeze([
  Object.freeze({ arm: "baseline", candidateId: null }),
  ...AI_POLICY_TRAINING_SCREEN_CANDIDATES.map((candidate) =>
    Object.freeze({ arm: "candidate" as const, candidateId: candidate.id }),
  ),
] as const);

export interface AiBenchmarkGameResult {
  seed: number;
  rotation: number;
  completed: boolean;
  finalRound: number;
  alivePlayers: number;
  winnerPlayerId: string | null;
  strategyPlacements: Partial<Record<AiStrategyId, number>>;
  strategyPlacementBounds: Partial<
    Record<
      AiStrategyId,
      { best: number; worst: number; exact: boolean }
    >
  >;
}

export interface AiBenchmarkStrategyResult {
  strategyId: AiStrategyId;
  label: string;
  completedGameSamples: number;
  averagePlacement: number | null;
  topFourRate: number | null;
  winRate: number | null;
  averageRoundThreeBoardSize: number | null;
  averageUnspentGold: number | null;
  upgradeRate: number | null;
  lowHealthUpgradeRate: number | null;
}

export interface AiBenchmarkResult {
  method: "eight-bot-headless-seat-rotated-v1";
  limitations: readonly string[];
  contentVersion: string;
  contentSnapshotSha256: string;
  contentSnapshotSha256After: string;
  contentSnapshotStable: boolean;
  policyVersion: string;
  evaluatorHash: string;
  evaluatorHashAfter: string;
  evaluatorStable: boolean;
  strategyProfileHash: string;
  strategyProfileHashAfter: string;
  strategyProfilesStable: boolean;
  seeds: number;
  startSeed: number;
  maxRounds: number;
  rotationsPerSeed: number;
  scheduledGames: number;
  completedGames: number;
  drawnGames: number;
  truncatedGames: number;
  strategies: AiBenchmarkStrategyResult[];
  games?: AiBenchmarkGameResult[];
}

export interface AiRegisteredPairedPlacementComparison {
  readonly pairedGames: number;
  readonly seedClusters: number;
  readonly meanPlacementDelta: number | null;
  readonly confidence95: {
    readonly lower: number;
    readonly upper: number;
  } | null;
}

export interface AiRegisteredPairedRateComparison {
  readonly pairedGames: number;
  readonly seedClusters: number;
  readonly meanRateDelta: number | null;
  readonly confidence95: {
    readonly lower: number;
    readonly upper: number;
  } | null;
}

export interface AiRegisteredTrainingVariantSummary {
  readonly value: number;
  readonly contentSnapshotSha256: string;
  readonly contentSnapshotSha256After: string;
  readonly contentSnapshotStable: boolean;
  readonly evaluatorHash: string;
  readonly evaluatorHashAfter: string;
  readonly evaluatorStable: boolean;
  readonly strategyProfileHash: string;
  readonly strategyProfileHashAfter: string;
  readonly strategyProfilesStable: boolean;
  readonly scheduledGames: number;
  readonly completedGames: number;
  readonly drawnGames: number;
  readonly truncatedGames: number;
  readonly averagePlacement: number | null;
  readonly topFourRate: number | null;
  readonly winRate: number | null;
  readonly comparisonToIncumbent: AiRegisteredPairedPlacementComparison;
  readonly conservativeComparisonToIncumbent: AiRegisteredPairedPlacementComparison;
  readonly conservativeTopFourComparisonToIncumbent: AiRegisteredPairedRateComparison;
  readonly conservativeWinRateComparisonToIncumbent: AiRegisteredPairedRateComparison;
  readonly trainingScore: number | null;
}

export interface AiRegisteredPolicyTrainingScreenResult {
  readonly registrationId: typeof AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID;
  readonly requestedExpectedProtocolHash: string;
  readonly protocolHash: string;
  readonly protocolHashAfter: string;
  readonly protocolStable: boolean;
  readonly contentVersion: string;
  readonly contentSnapshotSha256: string;
  readonly contentSnapshotSha256After: string;
  readonly contentSnapshotStable: boolean;
  readonly policyVersion: string;
  readonly evaluatorHash: string;
  readonly evaluatorHashAfter: string;
  readonly evaluatorStable: boolean;
  readonly strategyProfileHash: string;
  readonly strategyProfileHashAfter: string;
  readonly strategyProfilesStable: boolean;
  readonly candidateProfileBindingsStable: boolean;
  readonly baseline: AiRegisteredTrainingVariantSummary;
  readonly candidateProfileHashes: readonly {
    readonly candidateId: AiPolicyTrainingCandidateId;
    readonly strategyProfileHash: string;
  }[];
  readonly candidates: readonly {
    readonly candidateId: AiPolicyTrainingCandidateId;
    readonly profile: Readonly<AiStrategyProfile>;
    readonly expectedStrategyProfileHash: string;
    readonly profileBindingStable: boolean;
    readonly summary: AiRegisteredTrainingVariantSummary;
    readonly qualified: boolean;
    readonly qualificationReasons: readonly string[];
  }[];
  readonly selected: AiPolicyTrainingCandidateId | null;
}

interface MutableStrategyStats {
  placementTotal: number;
  completedGames: number;
  topFourFinishes: number;
  wins: number;
  roundThreeBoardTotal: number;
  roundThreeSamples: number;
  unspentGoldTotal: number;
  recruitSamples: number;
  lowHealthRecruitSamples: number;
  lowHealthUpgrades: number;
  upgrades: number;
}

interface RecruitSnapshot {
  tavernTier: number;
  effectiveHealth: number;
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

function strategyPlayers(state: GameState): PlayerState[] {
  return STRATEGY_PLAYER_IDS.map((playerId) => {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new Error(`benchmark strategy player ${playerId} is missing`);
    }
    return player;
  });
}

/**
 * Rotate policy-bearing IDs across the eight already-dealt physical seats.
 * This pairs every policy with every initial shop/RNG seat for each base seed.
 * The extra player-0 balanced policy is a sparring control and is not scored.
 */
function rotateHeadlessSeats(state: GameState, rotation: number): void {
  const playerIds = state.players.map((player) => player.id);
  for (let index = 0; index < state.players.length; index += 1) {
    state.players[index].id =
      playerIds[(index + rotation) % playerIds.length];
  }
  if (!state.players.some((player) => player.id === CONTROL_PLAYER_ID)) {
    throw new Error("benchmark control player is missing after seat rotation");
  }
  state.humanPlayerId = CONTROL_PLAYER_ID;
}

function roundTo(value: number, digits = 4): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function ratioOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? roundTo(numerator / denominator) : null;
}

function collectRecruitDiagnostics(
  state: GameState,
  recruitRound: number,
  beforeRecruit: ReadonlyMap<string, RecruitSnapshot>,
  stats: ReadonlyMap<AiStrategyId, MutableStrategyStats>,
): void {
  for (const player of strategyPlayers(state)) {
    const profile = getAiStrategyProfile(player.id);
    const profileStats = stats.get(profile.id);
    const before = beforeRecruit.get(player.id);
    if (!profileStats || !before) {
      continue;
    }

    profileStats.unspentGoldTotal += player.gold;
    profileStats.recruitSamples += 1;
    if (recruitRound === 3) {
      profileStats.roundThreeBoardTotal += player.board.length;
      profileStats.roundThreeSamples += 1;
    }
    const upgraded = player.tavernTier > before.tavernTier;
    if (upgraded) {
      profileStats.upgrades += 1;
    }
    if (before.effectiveHealth < profile.minimumUpgradeHealth) {
      profileStats.lowHealthRecruitSamples += 1;
      if (upgraded) {
        profileStats.lowHealthUpgrades += 1;
      }
    }
  }
}

function collectCompletedPlacements(
  state: GameState,
  stats: ReadonlyMap<AiStrategyId, MutableStrategyStats>,
): void {
  for (const player of strategyPlayers(state)) {
    if (
      player.placement === undefined ||
      !Number.isInteger(player.placement) ||
      player.placement < 1 ||
      player.placement > state.players.length
    ) {
      throw new Error(
        `completed game has invalid placement for ${player.id}`,
      );
    }
    const profileStats = stats.get(getAiStrategyProfile(player.id).id);
    if (!profileStats) {
      throw new Error(`benchmark stats are missing for ${player.id}`);
    }
    profileStats.placementTotal += player.placement;
    profileStats.completedGames += 1;
    if (player.placement <= 4) {
      profileStats.topFourFinishes += 1;
    }
    if (state.winnerId === player.id) {
      profileStats.wins += 1;
    }
  }
}

function gameResult(
  state: GameState,
  seed: number,
  rotation: number,
): AiBenchmarkGameResult {
  const completed = state.phase === "gameOver";
  const strategyPlacements: Partial<Record<AiStrategyId, number>> = {};
  const strategyPlacementBounds: AiBenchmarkGameResult["strategyPlacementBounds"] =
    {};
  const alivePlayers = state.players.filter((player) => player.alive).length;
  for (const player of strategyPlayers(state)) {
    const strategyId = getAiStrategyProfile(player.id).id;
    if (player.placement !== undefined) {
      strategyPlacements[strategyId] = player.placement;
      strategyPlacementBounds[strategyId] = {
        best: player.placement,
        worst: player.placement,
        exact: true,
      };
    } else if (player.alive && alivePlayers > 0) {
      strategyPlacementBounds[strategyId] = {
        best: 1,
        worst: alivePlayers,
        exact: false,
      };
    }
  }
  return {
    seed,
    rotation,
    completed,
    finalRound: state.round,
    alivePlayers,
    winnerPlayerId: completed ? state.winnerId : null,
    strategyPlacements,
    strategyPlacementBounds,
  };
}

function assertGameContentVersion(
  state: GameState,
  expectedContentVersion: string,
  seed: number,
  rotation: number,
): void {
  if (state.contentVersion !== expectedContentVersion) {
    throw new Error(
      `benchmark game ${seed}/${rotation} changed contentVersion from ${expectedContentVersion} to ${state.contentVersion}`,
    );
  }
}

function runAiBenchmarkInternal(
  options: AiBenchmarkInternalOptions = {},
): AiBenchmarkResult {
  const seeds = positiveInteger(options.seeds, DEFAULT_SEEDS, "seeds");
  const maxRounds = positiveInteger(
    options.maxRounds,
    DEFAULT_MAX_ROUNDS,
    "maxRounds",
  );
  const startSeed = options.startSeed ?? 1;
  if (!Number.isSafeInteger(startSeed)) {
    throw new Error("startSeed must be a safe integer");
  }
  assertAiBenchmarkSeedAccess({
    startSeed,
    seeds,
    reservationId: options.reservationId,
    reservationMode: options.reservationMode,
  });
  const evaluatorHashBefore = computeAiBenchmarkEvaluatorHash();
  if (evaluatorHashBefore !== EVALUATOR_SOURCE_HASH) {
    throw new Error("AI benchmark evaluator source changed after module load");
  }
  const contentSnapshotSha256Before =
    computeAiBenchmarkContentSnapshotSha256();
  if (contentSnapshotSha256Before !== CONTENT_SNAPSHOT_SHA256) {
    throw new Error("pinned Battlegrounds content changed after module load");
  }
  const contentVersion = createHeadlessGame(startSeed).contentVersion;
  const strategyProfileHash = computeAiBenchmarkStrategyProfileHash();

  const stats = new Map<AiStrategyId, MutableStrategyStats>(
    AI_STRATEGY_PROFILES.map((profile) => [
      profile.id,
      {
        placementTotal: 0,
        completedGames: 0,
        topFourFinishes: 0,
        wins: 0,
        roundThreeBoardTotal: 0,
        roundThreeSamples: 0,
        unspentGoldTotal: 0,
        recruitSamples: 0,
        lowHealthRecruitSamples: 0,
        lowHealthUpgrades: 0,
        upgrades: 0,
      },
    ]),
  );

  let completedGames = 0;
  let drawnGames = 0;
  const games: AiBenchmarkGameResult[] = [];
  const scheduledGames = seeds * SEAT_ROTATIONS;
  for (let seedOffset = 0; seedOffset < seeds; seedOffset += 1) {
    const seed = startSeed + seedOffset;
    for (let rotation = 0; rotation < SEAT_ROTATIONS; rotation += 1) {
      let state = createHeadlessGame(seed);
      assertGameContentVersion(state, contentVersion, seed, rotation);
      rotateHeadlessSeats(state, rotation);

      while (state.phase !== "gameOver") {
        if (state.phase === "recruit") {
          if (state.round > maxRounds) {
            break;
          }
          const beforeRecruit = new Map<string, RecruitSnapshot>(
            strategyPlayers(state)
              .filter((player) => player.alive)
              .map((player) => [
                player.id,
                {
                  tavernTier: player.tavernTier,
                  effectiveHealth: player.health + player.armor,
                },
              ]),
          );
          const recruitRound = state.round;
          state = advanceHeadlessGame(state);
          assertGameContentVersion(state, contentVersion, seed, rotation);
          collectRecruitDiagnostics(
            state,
            recruitRound,
            beforeRecruit,
            stats,
          );
        } else {
          state = advanceHeadlessGame(state);
          assertGameContentVersion(state, contentVersion, seed, rotation);
        }
      }

      const currentGame = gameResult(state, seed, rotation);
      games.push(currentGame);
      options.onProgress?.({
        processedGames: games.length,
        scheduledGames,
        seed,
        rotation,
        completed: currentGame.completed,
      });
      if (state.phase !== "gameOver") {
        continue;
      }
      completedGames += 1;
      if (state.winnerId === null) {
        drawnGames += 1;
      }
      collectCompletedPlacements(state, stats);
    }
  }

  const evaluatorHashAfter = computeAiBenchmarkEvaluatorHash();
  const evaluatorStable =
    evaluatorHashBefore === EVALUATOR_SOURCE_HASH &&
    evaluatorHashAfter === EVALUATOR_SOURCE_HASH;
  if (!evaluatorStable) {
    throw new Error("AI benchmark evaluator source changed during the run");
  }
  const contentSnapshotSha256After =
    computeAiBenchmarkContentSnapshotSha256();
  const contentSnapshotStable =
    contentSnapshotSha256Before === CONTENT_SNAPSHOT_SHA256 &&
    contentSnapshotSha256After === CONTENT_SNAPSHOT_SHA256;
  if (!contentSnapshotStable) {
    throw new Error("pinned Battlegrounds content changed during the run");
  }
  const strategyProfileHashAfter = computeAiBenchmarkStrategyProfileHash();
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  if (!strategyProfilesStable) {
    throw new Error("AI strategy profiles changed during the benchmark");
  }

  const result: AiBenchmarkResult = {
    method: "eight-bot-headless-seat-rotated-v1",
    limitations: [
      "Neutral createGame content is used; heroes, trinkets, and lobby events are not yet auto-selected.",
      "player-0 is an unscored balanced sparring control; player-1 through player-7 are the seven scored policies.",
      "Aggregate placement metrics use completed games only; per-game records preserve exact eliminated placements and conservative bounds for surviving players in truncated games.",
      "Self-play compares policies inside this simulator and is not an estimate of live-ladder performance.",
    ],
    contentVersion,
    contentSnapshotSha256: CONTENT_SNAPSHOT_SHA256,
    contentSnapshotSha256After,
    contentSnapshotStable,
    policyVersion: AI_POLICY_VERSION,
    evaluatorHash: EVALUATOR_SOURCE_HASH,
    evaluatorHashAfter,
    evaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    seeds,
    startSeed,
    maxRounds,
    rotationsPerSeed: SEAT_ROTATIONS,
    scheduledGames,
    completedGames,
    drawnGames,
    truncatedGames: scheduledGames - completedGames,
    strategies: AI_STRATEGY_PROFILES.map((profile) => {
      const profileStats = stats.get(profile.id);
      if (!profileStats) {
        throw new Error(`benchmark collected no stats for ${profile.id}`);
      }
      return {
        strategyId: profile.id,
        label: profile.label,
        completedGameSamples: profileStats.completedGames,
        averagePlacement: ratioOrNull(
          profileStats.placementTotal,
          profileStats.completedGames,
        ),
        topFourRate: ratioOrNull(
          profileStats.topFourFinishes,
          profileStats.completedGames,
        ),
        winRate: ratioOrNull(
          profileStats.wins,
          profileStats.completedGames,
        ),
        averageRoundThreeBoardSize: ratioOrNull(
          profileStats.roundThreeBoardTotal,
          profileStats.roundThreeSamples,
        ),
        averageUnspentGold: ratioOrNull(
          profileStats.unspentGoldTotal,
          profileStats.recruitSamples,
        ),
        upgradeRate: ratioOrNull(
          profileStats.upgrades,
          profileStats.recruitSamples,
        ),
        lowHealthUpgradeRate: ratioOrNull(
          profileStats.lowHealthUpgrades,
          profileStats.lowHealthRecruitSamples,
        ),
      };
    }),
  };
  if (options.includeGames) {
    result.games = games;
  }
  return result;
}

function runAiBenchmarkWithInternalOptions(
  options: AiBenchmarkInternalOptions,
): AiBenchmarkResult {
  if (options.profileOverrides && options.profileOverrides.size > 0) {
    const { profileOverrides, ...internalOptions } = options;
    return withAiStrategyProfileOverrides(profileOverrides, () =>
      runAiBenchmarkInternal(internalOptions),
    );
  }
  return runAiBenchmarkInternal(options);
}

export function runAiBenchmark(
  options: AiBenchmarkOptions = {},
): AiBenchmarkResult {
  const genericOptions: AiBenchmarkOptions = Object.freeze({
    seeds: options.seeds,
    startSeed: options.startSeed,
    maxRounds: options.maxRounds,
    includeGames: options.includeGames,
    profileOverrides: options.profileOverrides,
    onProgress: options.onProgress,
  });
  return runAiBenchmarkWithInternalOptions(genericOptions);
}

function registeredStudentTCritical95(degreesOfFreedom: number): number {
  const smallSample = [
    0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306,
    2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
    2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06,
    2.056, 2.052, 2.048, 2.045,
  ];
  if (!Number.isSafeInteger(degreesOfFreedom) || degreesOfFreedom < 1) {
    throw new Error("degreesOfFreedom must be a positive integer");
  }
  if (degreesOfFreedom < smallSample.length) {
    return smallSample[degreesOfFreedom];
  }
  const largeSample = [
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
  let critical: number = largeSample[0][1];
  for (const [df, value] of largeSample) {
    if (df > degreesOfFreedom) break;
    critical = value;
  }
  return critical;
}

function registeredGameKey(game: AiBenchmarkGameResult): string {
  return `${game.seed}:${game.rotation}`;
}

function registeredUniqueGames(
  games: readonly AiBenchmarkGameResult[],
  label: string,
): Map<string, AiBenchmarkGameResult> {
  const unique = new Map<string, AiBenchmarkGameResult>();
  for (const game of games) {
    const key = registeredGameKey(game);
    if (unique.has(key)) {
      throw new Error(`${label} contains duplicate scheduled game ${key}`);
    }
    unique.set(key, game);
  }
  return unique;
}

function registeredPlacementBounds(
  game: AiBenchmarkGameResult,
  strategyId: AiStrategyId,
): { best: number; worst: number } | undefined {
  const bounds = game.strategyPlacementBounds[strategyId];
  if (bounds) return bounds;
  const placement = game.strategyPlacements[strategyId];
  return placement === undefined
    ? undefined
    : { best: placement, worst: placement };
}

function registeredSummarizeDeltas(
  deltasBySeed: ReadonlyMap<number, readonly number[]>,
  pairedGames: number,
): AiRegisteredPairedPlacementComparison {
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
  const variance =
    clusterMeans.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (clusterMeans.length - 1);
  const margin =
    registeredStudentTCritical95(clusterMeans.length - 1) *
    Math.sqrt(variance / clusterMeans.length);
  return {
    pairedGames,
    seedClusters: clusterMeans.length,
    meanPlacementDelta: mean,
    confidence95: { lower: mean - margin, upper: mean + margin },
  };
}

function registeredPairedPlacement(
  incumbentGames: readonly AiBenchmarkGameResult[],
  candidateGames: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
): AiRegisteredPairedPlacementComparison {
  const incumbents = registeredUniqueGames(incumbentGames, "incumbent games");
  registeredUniqueGames(candidateGames, "candidate games");
  const deltas = new Map<number, number[]>();
  let pairedGames = 0;
  for (const candidate of candidateGames) {
    const incumbent = incumbents.get(registeredGameKey(candidate));
    const incumbentPlacement = incumbent?.strategyPlacements[strategyId];
    const candidatePlacement = candidate.strategyPlacements[strategyId];
    if (incumbentPlacement === undefined || candidatePlacement === undefined) {
      continue;
    }
    const seedDeltas = deltas.get(candidate.seed) ?? [];
    seedDeltas.push(candidatePlacement - incumbentPlacement);
    deltas.set(candidate.seed, seedDeltas);
    pairedGames += 1;
  }
  return registeredSummarizeDeltas(deltas, pairedGames);
}

function registeredIdenticalBounds(
  games: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
): AiRegisteredPairedPlacementComparison {
  registeredUniqueGames(games, "identical benchmark games");
  const deltas = new Map<number, number[]>();
  let pairedGames = 0;
  for (const game of games) {
    if (!registeredPlacementBounds(game, strategyId)) continue;
    const seedDeltas = deltas.get(game.seed) ?? [];
    seedDeltas.push(0);
    deltas.set(game.seed, seedDeltas);
    pairedGames += 1;
  }
  return registeredSummarizeDeltas(deltas, pairedGames);
}

function registeredConservativePlacement(
  incumbentGames: readonly AiBenchmarkGameResult[],
  candidateGames: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
): AiRegisteredPairedPlacementComparison {
  const incumbents = registeredUniqueGames(incumbentGames, "incumbent games");
  registeredUniqueGames(candidateGames, "candidate games");
  const deltas = new Map<number, number[]>();
  let pairedGames = 0;
  for (const candidate of candidateGames) {
    const incumbent = incumbents.get(registeredGameKey(candidate));
    const incumbentBounds = incumbent
      ? registeredPlacementBounds(incumbent, strategyId)
      : undefined;
    const candidateBounds = registeredPlacementBounds(candidate, strategyId);
    if (!incumbentBounds || !candidateBounds) continue;
    const seedDeltas = deltas.get(candidate.seed) ?? [];
    seedDeltas.push(candidateBounds.worst - incumbentBounds.best);
    deltas.set(candidate.seed, seedDeltas);
    pairedGames += 1;
  }
  return registeredSummarizeDeltas(deltas, pairedGames);
}

function registeredRateFromPlacement(
  comparison: AiRegisteredPairedPlacementComparison,
): AiRegisteredPairedRateComparison {
  return {
    pairedGames: comparison.pairedGames,
    seedClusters: comparison.seedClusters,
    meanRateDelta: comparison.meanPlacementDelta,
    confidence95: comparison.confidence95,
  };
}

function registeredConservativeRate(
  incumbentGames: readonly AiBenchmarkGameResult[],
  candidateGames: readonly AiBenchmarkGameResult[],
  strategyId: AiStrategyId,
  metric: "topFour" | "win",
): AiRegisteredPairedRateComparison {
  const incumbents = registeredUniqueGames(incumbentGames, "incumbent games");
  registeredUniqueGames(candidateGames, "candidate games");
  const deltas = new Map<number, number[]>();
  let pairedGames = 0;
  const rateBounds = (bounds: { best: number; worst: number }) =>
    metric === "topFour"
      ? {
          lower: bounds.worst <= 4 ? 1 : 0,
          upper: bounds.best <= 4 ? 1 : 0,
        }
      : {
          lower: bounds.worst === 1 ? 1 : 0,
          upper: bounds.best === 1 ? 1 : 0,
        };
  for (const candidate of candidateGames) {
    const incumbent = incumbents.get(registeredGameKey(candidate));
    const incumbentBounds = incumbent
      ? registeredPlacementBounds(incumbent, strategyId)
      : undefined;
    const candidateBounds = registeredPlacementBounds(candidate, strategyId);
    if (!incumbentBounds || !candidateBounds) continue;
    const incumbentRate = rateBounds(incumbentBounds);
    const candidateRate = rateBounds(candidateBounds);
    const seedDeltas = deltas.get(candidate.seed) ?? [];
    seedDeltas.push(candidateRate.lower - incumbentRate.upper);
    deltas.set(candidate.seed, seedDeltas);
    pairedGames += 1;
  }
  const summary = registeredSummarizeDeltas(deltas, pairedGames);
  return registeredRateFromPlacement(summary);
}

function registeredTargetResult(
  result: AiBenchmarkResult,
): AiBenchmarkStrategyResult {
  const target = result.strategies.find(
    (strategy) =>
      strategy.strategyId ===
      AI_POLICY_TRAINING_SCREEN_REGISTRATION.strategyId,
  );
  if (!target) {
    throw new Error("registered training result is missing powerLevel");
  }
  return target;
}

function registeredSummarizeVariant(
  value: number,
  result: AiBenchmarkResult,
  baseline: AiBenchmarkResult,
): AiRegisteredTrainingVariantSummary {
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
    if (result[field] !== baseline[field]) {
      throw new Error(`registered training arms differ on ${field}`);
    }
  }
  const target = registeredTargetResult(result);
  const raw = registeredPairedPlacement(
    baseline.games ?? [],
    result.games ?? [],
    AI_POLICY_TRAINING_SCREEN_REGISTRATION.strategyId,
  );
  const identical = result === baseline
    ? registeredIdenticalBounds(
        result.games ?? [],
        AI_POLICY_TRAINING_SCREEN_REGISTRATION.strategyId,
      )
    : null;
  const conservative =
    identical ??
    registeredConservativePlacement(
      baseline.games ?? [],
      result.games ?? [],
      AI_POLICY_TRAINING_SCREEN_REGISTRATION.strategyId,
    );
  const topFour =
    identical === null
      ? registeredConservativeRate(
          baseline.games ?? [],
          result.games ?? [],
          AI_POLICY_TRAINING_SCREEN_REGISTRATION.strategyId,
          "topFour",
        )
      : registeredRateFromPlacement(identical);
  const win =
    identical === null
      ? registeredConservativeRate(
          baseline.games ?? [],
          result.games ?? [],
          AI_POLICY_TRAINING_SCREEN_REGISTRATION.strategyId,
          "win",
        )
      : registeredRateFromPlacement(identical);
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
    comparisonToIncumbent: raw,
    conservativeComparisonToIncumbent: conservative,
    conservativeTopFourComparisonToIncumbent: topFour,
    conservativeWinRateComparisonToIncumbent: win,
    trainingScore:
      conservative.meanPlacementDelta === null ||
      conservative.pairedGames !== result.scheduledGames ||
      result.drawnGames > 0 ||
      baseline.drawnGames > 0
        ? null
        : conservative.meanPlacementDelta,
  };
}

function registeredQualification(
  summary: AiRegisteredTrainingVariantSummary,
  baseline: AiRegisteredTrainingVariantSummary,
  provenanceStable: boolean,
): { qualified: boolean; reasons: readonly string[] } {
  const registration = AI_POLICY_TRAINING_SCREEN_REGISTRATION;
  const reasons: string[] = [];
  const requireCondition = (condition: boolean, reason: string) => {
    if (!condition) reasons.push(reason);
  };
  requireCondition(provenanceStable, "training screen provenance is unstable");
  requireCondition(
    baseline.scheduledGames === registration.scheduledGames,
    `baseline must schedule exactly ${registration.scheduledGames} games`,
  );
  requireCondition(
    baseline.drawnGames === 0,
    "baseline must contain zero drawn games",
  );
  requireCondition(
    baseline.truncatedGames === 0,
    "baseline must contain zero truncated games",
  );
  requireCondition(
    summary.scheduledGames === registration.scheduledGames,
    `candidate must schedule exactly ${registration.scheduledGames} games`,
  );
  requireCondition(summary.drawnGames === 0, "candidate must contain zero drawn games");
  requireCondition(
    summary.truncatedGames === 0,
    "candidate must contain zero truncated games",
  );
  for (const [label, comparison] of [
    ["placement", summary.conservativeComparisonToIncumbent],
    ["top-four", summary.conservativeTopFourComparisonToIncumbent],
    ["win", summary.conservativeWinRateComparisonToIncumbent],
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
    summary.conservativeComparisonToIncumbent.meanPlacementDelta !== null &&
      summary.conservativeComparisonToIncumbent.meanPlacementDelta <=
        -registration.minimumPlacementImprovement,
    `mean placement delta must be at most -${registration.minimumPlacementImprovement.toFixed(2)}`,
  );
  requireCondition(
    summary.conservativeComparisonToIncumbent.confidence95 !== null &&
      summary.conservativeComparisonToIncumbent.confidence95.upper < 0,
    "placement CI upper bound must be below 0",
  );
  requireCondition(
    summary.conservativeTopFourComparisonToIncumbent.meanRateDelta !== null &&
      summary.conservativeTopFourComparisonToIncumbent.confidence95 !== null &&
      summary.conservativeTopFourComparisonToIncumbent.confidence95.lower >=
        -registration.topFourNoninferiorityGuard,
    `top-four CI lower bound must be at least -${registration.topFourNoninferiorityGuard.toFixed(2)}`,
  );
  requireCondition(
    summary.conservativeWinRateComparisonToIncumbent.meanRateDelta !== null &&
      summary.conservativeWinRateComparisonToIncumbent.confidence95 !== null &&
      summary.conservativeWinRateComparisonToIncumbent.confidence95.lower >=
        -registration.winRateNoninferiorityGuard,
    `win CI lower bound must be at least -${registration.winRateNoninferiorityGuard.toFixed(2)}`,
  );
  return { qualified: reasons.length === 0, reasons: Object.freeze(reasons) };
}

export function computeRegisteredAiPolicyTrainingScreenProtocolHash(): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        registration: AI_POLICY_TRAINING_SCREEN_REGISTRATION,
        baselineProfile: AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
        candidates: AI_POLICY_TRAINING_SCREEN_CANDIDATES,
        evaluatorHash: computeAiBenchmarkEvaluatorHash(),
      }),
    )
    .digest("hex");
}

const REGISTERED_TRAINING_SCREEN_PROTOCOL_HASH =
  computeRegisteredAiPolicyTrainingScreenProtocolHash();

function assertRegisteredTrainingBatchPreflight(): void {
  const registration = AI_POLICY_TRAINING_SCREEN_REGISTRATION;
  if (
    registration.id !== AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID ||
    registration.seeds !== 64 ||
    registration.startSeed !== 30_300_001 ||
    registration.maxRounds !== 100 ||
    registration.rotationsPerSeed !== SEAT_ROTATIONS ||
    registration.scheduledGames !== 512 ||
    registration.candidateIds.length !== 3 ||
    AI_POLICY_TRAINING_SCREEN_CANDIDATES.length !== 3 ||
    registration.candidateIds.some(
      (candidateId, index) =>
        AI_POLICY_TRAINING_SCREEN_CANDIDATES[index]?.id !== candidateId,
    )
  ) {
    throw new Error(
      "registered AI training batch registry is not the immutable four-arm configuration",
    );
  }
  if (
    JSON.stringify(getAiStrategyProfile(registration.playerId)) !==
    JSON.stringify(AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE)
  ) {
    throw new Error(
      "registered AI training batch live baseline profile bytes do not match",
    );
  }
  if (
    computeAiBenchmarkStrategyProfileHash() !==
    registration.baselineStrategyProfileHash
  ) {
    throw new Error(
      "registered AI training batch live strategy profile hash does not match",
    );
  }
  assertAiBenchmarkSeedAccess({
    startSeed: registration.startSeed,
    seeds: registration.seeds,
    reservationId: registration.id,
    reservationMode: "training-screen",
  });
}

/**
 * The sole executable capability for the reserved 30300001 interval. It has
 * no range, profile, arm, callback, or stopping controls. Raw games stay
 * private; one call returns only the final fixed-protocol audit and selection
 * after baseline, A, B, and C have all finished.
 */
export function runRegisteredAiPolicyTrainingScreen(
  expectedProtocolHash: string,
): Readonly<AiRegisteredPolicyTrainingScreenResult> {
  if (!/^[a-f0-9]{64}$/.test(expectedProtocolHash)) {
    throw new Error(
      "registered AI training screen expectedProtocolHash must be one lowercase 64-hex digest",
    );
  }
  if (expectedProtocolHash !== REGISTERED_TRAINING_SCREEN_PROTOCOL_HASH) {
    throw new Error(
      "registered AI training screen expectedProtocolHash does not match the runtime protocol hash",
    );
  }
  const protocolHashBefore =
    computeRegisteredAiPolicyTrainingScreenProtocolHash();
  if (protocolHashBefore !== REGISTERED_TRAINING_SCREEN_PROTOCOL_HASH) {
    throw new Error(
      "registered AI training screen protocol changed after module load",
    );
  }
  if (hasAnyAiResidualPolicyOverrides()) {
    throw new Error(
      "registered AI training screen forbids residual policy overrides",
    );
  }
  assertRegisteredTrainingBatchPreflight();
  const registration = AI_POLICY_TRAINING_SCREEN_REGISTRATION;
  const baselineStrategyProfileHash =
    computeAiBenchmarkStrategyProfileHash();
  const expectedCandidateProfileHashes = new Map(
    AI_POLICY_TRAINING_SCREEN_CANDIDATES.map((candidate) => [
      candidate.id,
      withAiStrategyProfileOverrides(
        new Map([[registration.playerId, candidate.profile]]),
        computeAiBenchmarkStrategyProfileHash,
      ),
    ]),
  );
  const armOptions = (): AiBenchmarkInternalOptions => ({
    seeds: registration.seeds,
    startSeed: registration.startSeed,
    maxRounds: registration.maxRounds,
    includeGames: true,
    reservationId: registration.id,
    reservationMode: "training-screen",
  });

  const baseline = runAiBenchmarkWithInternalOptions(
    armOptions(),
  );
  const candidateResults = AI_POLICY_TRAINING_SCREEN_CANDIDATES.map(
    (candidate) => ({
      candidate,
      result: runAiBenchmarkWithInternalOptions({
        ...armOptions(),
        profileOverrides: new Map([
          [registration.playerId, candidate.profile],
        ]),
      }),
    }),
  );

  const protocolHashAfter =
    computeRegisteredAiPolicyTrainingScreenProtocolHash();
  const protocolStable =
    protocolHashBefore === REGISTERED_TRAINING_SCREEN_PROTOCOL_HASH &&
    protocolHashAfter === REGISTERED_TRAINING_SCREEN_PROTOCOL_HASH;
  const evaluatorHashAfter = computeAiBenchmarkEvaluatorHash();
  const evaluatorStable =
    evaluatorHashAfter === EVALUATOR_SOURCE_HASH &&
    baseline.evaluatorStable &&
    candidateResults.every(
      ({ result }) =>
        result.evaluatorStable &&
        result.evaluatorHash === baseline.evaluatorHash &&
        result.evaluatorHashAfter === baseline.evaluatorHashAfter,
    );
  const contentSnapshotSha256After =
    computeAiBenchmarkContentSnapshotSha256();
  const contentSnapshotStable =
    contentSnapshotSha256After === CONTENT_SNAPSHOT_SHA256 &&
    baseline.contentSnapshotStable &&
    candidateResults.every(({ result }) => result.contentSnapshotStable);
  const strategyProfileHashAfter = computeAiBenchmarkStrategyProfileHash();
  const strategyProfilesStable =
    baselineStrategyProfileHash === registration.baselineStrategyProfileHash &&
    strategyProfileHashAfter === baselineStrategyProfileHash &&
    baseline.strategyProfilesStable &&
    baseline.strategyProfileHash === baselineStrategyProfileHash &&
    baseline.strategyProfileHashAfter === baselineStrategyProfileHash;
  const candidateProfileBindingsStable = candidateResults.every(
    ({ candidate, result }) => {
      const expected = expectedCandidateProfileHashes.get(candidate.id);
      return (
        expected !== undefined &&
        result.strategyProfilesStable &&
        result.strategyProfileHash === expected &&
        result.strategyProfileHashAfter === expected
      );
    },
  );
  const provenanceStable =
    protocolStable &&
    evaluatorStable &&
    contentSnapshotStable &&
    strategyProfilesStable &&
    candidateProfileBindingsStable;
  const baselineSummary = registeredSummarizeVariant(
    AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE.upgradeRoundOffset,
    baseline,
    baseline,
  );
  const auditedCandidates = candidateResults.map(({ candidate, result }) => {
    const summary = registeredSummarizeVariant(
      candidate.profile.upgradeRoundOffset,
      result,
      baseline,
    );
    const expectedStrategyProfileHash =
      expectedCandidateProfileHashes.get(candidate.id) ?? "";
    const profileBindingStable =
      expectedStrategyProfileHash.length > 0 &&
      result.strategyProfilesStable &&
      result.strategyProfileHash === expectedStrategyProfileHash &&
      result.strategyProfileHashAfter === expectedStrategyProfileHash;
    const qualification = registeredQualification(
      summary,
      baselineSummary,
      provenanceStable && profileBindingStable,
    );
    return Object.freeze({
      candidateId: candidate.id,
      profile: candidate.profile,
      expectedStrategyProfileHash,
      profileBindingStable,
      summary,
      qualified: qualification.qualified,
      qualificationReasons: qualification.reasons,
    });
  });
  const eligible = auditedCandidates
    .filter((candidate) => candidate.qualified)
    .sort((left, right) => {
      const placementDifference =
        (left.summary.conservativeComparisonToIncumbent.confidence95?.upper ??
          Number.POSITIVE_INFINITY) -
        (right.summary.conservativeComparisonToIncumbent.confidence95?.upper ??
          Number.POSITIVE_INFINITY);
      if (placementDifference !== 0) return placementDifference;
      const winDifference =
        (right.summary.conservativeWinRateComparisonToIncumbent.confidence95
          ?.lower ?? Number.NEGATIVE_INFINITY) -
        (left.summary.conservativeWinRateComparisonToIncumbent.confidence95
          ?.lower ?? Number.NEGATIVE_INFINITY);
      if (winDifference !== 0) return winDifference;
      const topFourDifference =
        (right.summary.conservativeTopFourComparisonToIncumbent.confidence95
          ?.lower ?? Number.NEGATIVE_INFINITY) -
        (left.summary.conservativeTopFourComparisonToIncumbent.confidence95
          ?.lower ?? Number.NEGATIVE_INFINITY);
      if (topFourDifference !== 0) return topFourDifference;
      return left.candidateId < right.candidateId
        ? -1
        : left.candidateId > right.candidateId
          ? 1
          : 0;
    });
  return Object.freeze({
    registrationId: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
    requestedExpectedProtocolHash: expectedProtocolHash,
    protocolHash: REGISTERED_TRAINING_SCREEN_PROTOCOL_HASH,
    protocolHashAfter,
    protocolStable,
    contentVersion: baseline.contentVersion,
    contentSnapshotSha256: CONTENT_SNAPSHOT_SHA256,
    contentSnapshotSha256After,
    contentSnapshotStable,
    policyVersion: baseline.policyVersion,
    evaluatorHash: EVALUATOR_SOURCE_HASH,
    evaluatorHashAfter,
    evaluatorStable,
    strategyProfileHash: baselineStrategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    candidateProfileBindingsStable,
    baseline: baselineSummary,
    candidateProfileHashes: Object.freeze(
      AI_POLICY_TRAINING_SCREEN_CANDIDATES.map((candidate) =>
        Object.freeze({
          candidateId: candidate.id,
          strategyProfileHash:
            expectedCandidateProfileHashes.get(candidate.id) ?? "",
        }),
      ),
    ),
    candidates: Object.freeze(auditedCandidates),
    selected: eligible[0]?.candidateId ?? null,
  });
}

function integerArgument(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} requires an integer value`);
  }
  return value;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  const result = runAiBenchmark({
    seeds: integerArgument("--seeds"),
    startSeed: integerArgument("--start-seed"),
    maxRounds: integerArgument("--max-rounds"),
    onProgress: (progress) => {
      if (progress.rotation === SEAT_ROTATIONS - 1) {
        console.error(
          `[ai-benchmark] ${progress.processedGames}/${progress.scheduledGames} games`,
        );
      }
    },
  });
  console.log(JSON.stringify(result, null, 2));
}
