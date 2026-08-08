import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  AI_POLICY_VERSION,
  getAiStrategyProfile,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  advanceHeadlessGameWithAiCapitalSaleModes,
  type AiCapitalSaleMode,
  type GameState,
} from "../lib/game/engine.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  isValidInitialHealth,
} from "../lib/game/setup.ts";
import type { PlayerId } from "../lib/game/types.ts";
import {
  AI_BENCHMARK_SCENARIOS,
  createAiBenchmarkScenarioGame,
  normalizeAiBenchmarkScenarioIds,
  type AiBenchmarkScenarioId,
} from "./ai-benchmark-scenarios.ts";
import { assertAiBenchmarkSeedAccess } from "./ai-seed-ledger.ts";
import {
  placementBoundsFromPlacement,
  summarizeAiRecruitPlannerSeedMetrics,
  type AiRecruitPlannerComparisons,
  type AiRecruitPlannerSeedMetric,
  type PlacementBounds,
} from "./benchmark-ai-recruit-planner.ts";

export const AI_CAPITAL_SALE_BENCHMARK_VERSION = 2 as const;
export const AI_CAPITAL_SALE_MINIMUM_ACCEPTANCE_SEEDS = 24 as const;
export const AI_CAPITAL_SALE_DEFAULT_START_SEED = 90_050_001 as const;
export const AI_CAPITAL_SALE_ROTATIONS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7,
] as const);
export const AI_CAPITAL_SALE_PLAYER_IDS = Object.freeze([
  "player-1",
  "player-2",
  "player-3",
  "player-4",
  "player-5",
  "player-6",
  "player-7",
] as const);

export type AiCapitalSalePlayerId =
  (typeof AI_CAPITAL_SALE_PLAYER_IDS)[number];

export const AI_CAPITAL_SALE_CANDIDATE_MODES = Object.freeze([
  "sell-one-v5",
  "sell-one-v6-settled-warband",
] as const satisfies readonly AiCapitalSaleMode[]);

export type AiCapitalSaleCandidateMode =
  (typeof AI_CAPITAL_SALE_CANDIDATE_MODES)[number];

const CONTROL_PLAYER_ID = "player-0";
const ALL_PLAYER_IDS = Object.freeze([
  CONTROL_PLAYER_ID,
  ...AI_CAPITAL_SALE_PLAYER_IDS,
] as const);
const DEFAULTS = Object.freeze({
  seeds: 2,
  startSeed: AI_CAPITAL_SALE_DEFAULT_START_SEED,
  maxRounds: 150,
  candidateMode: "sell-one-v5" as const satisfies AiCapitalSaleCandidateMode,
});
const RUNS_PER_SEED =
  AI_BENCHMARK_SCENARIOS.length *
  AI_CAPITAL_SALE_ROTATIONS.length *
  (1 + AI_CAPITAL_SALE_PLAYER_IDS.length);
const PAIRS_PER_SEED =
  AI_BENCHMARK_SCENARIOS.length *
  AI_CAPITAL_SALE_ROTATIONS.length *
  AI_CAPITAL_SALE_PLAYER_IDS.length;
const MINIMUM_PLACEMENT_IMPROVEMENT = 0.1;
const TOP_FOUR_NON_INFERIORITY_MARGIN = 0.02;
const WIN_NON_INFERIORITY_MARGIN = 0.03;
const STRATUM_PLACEMENT_NON_INFERIORITY_MARGIN = 0.25;
const STRATUM_RATE_NON_INFERIORITY_MARGIN = 0.05;

export interface AiCapitalSalePlayerDiagnostics {
  eligible: number;
  dryRunAccepted: number;
  salesCommitted: number;
  purchasesCommitted: number;
  decisionDivergences: number;
  postSaleAborts: number;
  handCapacityAborts: number;
  offerMutationAborts: number;
  fundingAborts: number;
  scoreAborts: number;
  settledWarbandScoreAborts: number;
  interactionAborts: number;
  executionFailureAborts: number;
}

export type AiCapitalSaleDiagnostics = Readonly<
  Record<PlayerId, Readonly<AiCapitalSalePlayerDiagnostics>>
>;

export interface AiCapitalSaleBenchmarkOptions {
  readonly seeds?: number;
  readonly startSeed?: number;
  readonly maxRounds?: number;
  readonly initialHealth?: number;
  /** Defaults to sell-one-v5 so prior v5 evidence remains reproducible. */
  readonly candidateMode?: AiCapitalSaleCandidateMode;
  /** Defaults to neutral-v1 and live-lobby-v1. */
  readonly scenarioIds?: readonly AiBenchmarkScenarioId[];
  readonly onProgress?: (progress: AiCapitalSaleBenchmarkProgress) => void;
}

export interface AiCapitalSaleBenchmarkProgress {
  readonly processedRuns: number;
  readonly scheduledRuns: number;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly arm: "baseline" | "candidate";
  readonly focalPlayerId: AiCapitalSalePlayerId | null;
  readonly physicalSeat: number | null;
  readonly completed: boolean;
  readonly failure: string | null;
}

export interface AiCapitalSaleProfileSnapshot {
  readonly playerId: AiCapitalSalePlayerId;
  readonly profile: Readonly<AiStrategyProfile>;
}

export interface AiCapitalSalePlayerOutcome {
  readonly playerId: AiCapitalSalePlayerId;
  readonly profileId: AiStrategyId;
  readonly placementBounds: PlacementBounds | null;
  readonly topFour: boolean | null;
  readonly win: boolean | null;
}

export interface AiCapitalSaleGameRun {
  readonly completed: boolean;
  readonly drawn: boolean;
  readonly truncated: boolean;
  readonly finalRound: number | null;
  readonly alivePlayers: number | null;
  readonly winnerPlayerId: string | null;
  readonly contentVersion: string | null;
  readonly initialStateSha256: string;
  readonly initialRngState: number;
  readonly outcomes: Readonly<
    Record<AiCapitalSalePlayerId, AiCapitalSalePlayerOutcome>
  >;
  readonly diagnostics: AiCapitalSaleDiagnostics;
  readonly failure: string | null;
}

export interface AiCapitalSaleCandidateRun {
  readonly focalPlayerId: AiCapitalSalePlayerId;
  readonly physicalSeat: number;
  readonly run: AiCapitalSaleGameRun;
}

export interface AiCapitalSalePair {
  readonly pairKey: string;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly physicalSeat: number;
  readonly playerId: AiCapitalSalePlayerId;
  readonly profileId: AiStrategyId;
  readonly initialStateMatched: boolean;
  readonly baselinePlacementBounds: PlacementBounds | null;
  readonly candidatePlacementBounds: PlacementBounds | null;
  readonly placementDelta: number | null;
  readonly topFourDelta: number | null;
  readonly winDelta: number | null;
}

export interface AiCapitalSaleEpisode {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly initialStateSha256: string;
  readonly initialRngState: number;
  readonly physicalSeatByPlayer: Readonly<Record<PlayerId, number>>;
  readonly baseline: AiCapitalSaleGameRun;
  readonly candidates: readonly AiCapitalSaleCandidateRun[];
  readonly pairs: readonly AiCapitalSalePair[];
}

export interface AiCapitalSaleSeedCluster {
  readonly seed: number;
  readonly episodes: readonly AiCapitalSaleEpisode[];
  readonly pairs: readonly AiCapitalSalePair[];
  readonly metric: AiRecruitPlannerSeedMetric | null;
}

export interface AiCapitalSaleComparisonMatrix {
  /** Confidence intervals use one independent observation per seed. */
  readonly overall: AiRecruitPlannerComparisons;
  readonly byScenario: Partial<
    Record<AiBenchmarkScenarioId, AiRecruitPlannerComparisons>
  >;
  readonly byProfile: Partial<
    Record<AiStrategyId, AiRecruitPlannerComparisons>
  >;
  readonly byPhysicalSeat: Partial<Record<number, AiRecruitPlannerComparisons>>;
}

export interface AiCapitalSaleDiagnosticSummary {
  /** Each scored player is counted once in each baseline episode. */
  readonly baselineScoredPlayers: AiCapitalSalePlayerDiagnostics;
  /** Only the treated player from each candidate run is accumulated. */
  readonly candidateFocalPlayers: AiCapitalSalePlayerDiagnostics;
  readonly candidateFocalByScenario: Partial<
    Record<AiBenchmarkScenarioId, AiCapitalSalePlayerDiagnostics>
  >;
  readonly candidateFocalByProfile: Partial<
    Record<AiStrategyId, AiCapitalSalePlayerDiagnostics>
  >;
  readonly candidateFocalByPhysicalSeat: Partial<
    Record<number, AiCapitalSalePlayerDiagnostics>
  >;
}

export interface AiCapitalSaleRunnerFailure {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId | null;
  readonly rotation: number | null;
  readonly arm: "baseline" | "candidate" | "provenance";
  readonly focalPlayerId: AiCapitalSalePlayerId | null;
  readonly message: string;
}

export interface AiCapitalSaleGateInput {
  readonly configuredSeeds: number;
  readonly configuredScenarioIds: readonly AiBenchmarkScenarioId[];
  readonly profileIds: readonly AiStrategyId[];
  readonly technicalReasons: readonly string[];
  readonly comparisonMatrix: AiCapitalSaleComparisonMatrix;
  readonly focalDiagnostics: Readonly<AiCapitalSalePlayerDiagnostics>;
  readonly focalDiagnosticsByProfile: Partial<
    Record<AiStrategyId, Readonly<AiCapitalSalePlayerDiagnostics>>
  >;
  readonly injectedRunner: boolean;
}

export interface AiCapitalSaleGateResult {
  readonly screenEvidenceUsable: boolean;
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

export interface AiCapitalSaleEpisodeRunnerRequest {
  readonly state: GameState;
  readonly modes: Readonly<Record<PlayerId, AiCapitalSaleMode>>;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly arm: "baseline" | "candidate";
  readonly focalPlayerId: AiCapitalSalePlayerId | null;
  readonly physicalSeat: number | null;
  readonly maxRounds: number;
  readonly initialStateSha256: string;
  readonly initialRngState: number;
}

export interface AiCapitalSaleEpisodeRunnerResult {
  readonly state: GameState;
  /** The engine may expose the player map directly or under byPlayer. */
  readonly diagnostics: unknown;
}

export type AiCapitalSaleEpisodeRunner = (
  request: AiCapitalSaleEpisodeRunnerRequest,
) => AiCapitalSaleEpisodeRunnerResult;

interface AiCapitalSaleBenchmarkDependencies {
  readonly createScenarioGame: typeof createAiBenchmarkScenarioGame;
  readonly runEpisode: AiCapitalSaleEpisodeRunner;
  readonly computeCoreHash: () => string;
  readonly computeContentSnapshotSha256: () => string;
}

interface EvaluatorSourceFile {
  readonly relativePath: string;
  readonly url: URL;
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

function pinnedContentSnapshotUrl(): URL {
  const generatedDirectory = new URL("generated/", GAME_DIRECTORY);
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
      `expected exactly one pinned Battlegrounds snapshot, found ${names.length}`,
    );
  }
  return new URL(names[0], generatedDirectory);
}

export function computeAiCapitalSaleContentSnapshotSha256(): string {
  return createHash("sha256")
    .update(readFileSync(pinnedContentSnapshotUrl()))
    .digest("hex");
}

export function computeAiCapitalSaleCoreHash(): string {
  const hash = createHash("sha256");
  for (const source of evaluatorSourceFiles(GAME_DIRECTORY)) {
    hash
      .update(`lib/game/${source.relativePath}`)
      .update("\0")
      .update(readFileSync(source.url))
      .update("\0");
  }
  for (const relativePath of [
    "ai-benchmark-scenarios.ts",
    "ai-seed-ledger.ts",
    "benchmark-ai-recruit-planner.ts",
    "benchmark-ai-capital-sale.ts",
  ]) {
    hash
      .update(`scripts/${relativePath}`)
      .update("\0")
      .update(readFileSync(new URL(`./${relativePath}`, import.meta.url)))
      .update("\0");
  }
  return hash.digest("hex");
}

const CORE_HASH_AT_MODULE_LOAD = computeAiCapitalSaleCoreHash();
const CONTENT_SNAPSHOT_SHA256_AT_MODULE_LOAD =
  computeAiCapitalSaleContentSnapshotSha256();

const DIAGNOSTIC_COUNTERS = Object.freeze([
  "eligible",
  "dryRunAccepted",
  "salesCommitted",
  "purchasesCommitted",
  "decisionDivergences",
  "postSaleAborts",
  "handCapacityAborts",
  "offerMutationAborts",
  "fundingAborts",
  "scoreAborts",
  "settledWarbandScoreAborts",
  "interactionAborts",
  "executionFailureAborts",
] as const satisfies ReadonlyArray<keyof AiCapitalSalePlayerDiagnostics>);

function emptyPlayerDiagnostics(): AiCapitalSalePlayerDiagnostics {
  return {
    eligible: 0,
    dryRunAccepted: 0,
    salesCommitted: 0,
    purchasesCommitted: 0,
    decisionDivergences: 0,
    postSaleAborts: 0,
    handCapacityAborts: 0,
    offerMutationAborts: 0,
    fundingAborts: 0,
    scoreAborts: 0,
    settledWarbandScoreAborts: 0,
    interactionAborts: 0,
    executionFailureAborts: 0,
  };
}

function emptyDiagnostics(
  playerIds: readonly PlayerId[] = ALL_PLAYER_IDS,
): Record<PlayerId, AiCapitalSalePlayerDiagnostics> {
  return Object.fromEntries(
    playerIds.map((playerId) => [playerId, emptyPlayerDiagnostics()]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePlayerDiagnostics(
  value: unknown,
  playerId: PlayerId,
): AiCapitalSalePlayerDiagnostics {
  if (!isRecord(value)) {
    throw new TypeError(`capital-sale diagnostics for ${playerId} must be an object`);
  }
  const validated = emptyPlayerDiagnostics();
  for (const counter of DIAGNOSTIC_COUNTERS) {
    const amount = value[counter];
    if (!Number.isSafeInteger(amount) || (amount as number) < 0) {
      throw new RangeError(
        `capital-sale ${counter} for ${playerId} must be a non-negative integer`,
      );
    }
    validated[counter] = amount as number;
  }
  return validated;
}

export function normalizeAiCapitalSaleDiagnostics(
  value: unknown,
  playerIds: readonly PlayerId[] = ALL_PLAYER_IDS,
): Record<PlayerId, AiCapitalSalePlayerDiagnostics> {
  if (!isRecord(value)) {
    throw new TypeError("capital-sale diagnostics must be a player map");
  }
  const candidate = isRecord(value.byPlayer) ? value.byPlayer : value;
  const result = emptyDiagnostics(playerIds);
  for (const playerId of playerIds) {
    if (!(playerId in candidate)) {
      throw new Error(`capital-sale diagnostics are missing ${playerId}`);
    }
    result[playerId] = validatePlayerDiagnostics(
      candidate[playerId],
      playerId,
    );
  }
  return result;
}

export function sumAiCapitalSaleDiagnostics(
  values: Iterable<Readonly<AiCapitalSalePlayerDiagnostics>>,
): AiCapitalSalePlayerDiagnostics {
  const total = emptyPlayerDiagnostics();
  for (const value of values) {
    const validated = validatePlayerDiagnostics(value, "aggregate");
    for (const counter of DIAGNOSTIC_COUNTERS) {
      total[counter] += validated[counter];
    }
  }
  return total;
}

function mergeDiagnostics(
  target: Record<PlayerId, AiCapitalSalePlayerDiagnostics>,
  source: Readonly<Record<PlayerId, AiCapitalSalePlayerDiagnostics>>,
): void {
  for (const [playerId, diagnostics] of Object.entries(source)) {
    target[playerId] = sumAiCapitalSaleDiagnostics([
      target[playerId] ?? emptyPlayerDiagnostics(),
      diagnostics,
    ]);
  }
}

export function createAiCapitalSaleModeMap(
  playerIds: readonly PlayerId[],
  focalPlayerId: AiCapitalSalePlayerId | null,
  candidateMode: AiCapitalSaleCandidateMode = DEFAULTS.candidateMode,
): Readonly<Record<PlayerId, AiCapitalSaleMode>> {
  const uniquePlayerIds = new Set(playerIds);
  if (
    playerIds.length !== ALL_PLAYER_IDS.length ||
    uniquePlayerIds.size !== playerIds.length ||
    ALL_PLAYER_IDS.some((playerId) => !uniquePlayerIds.has(playerId))
  ) {
    throw new RangeError(
      "capital-sale mode map requires canonical player-0 through player-7",
    );
  }
  if (focalPlayerId !== null && !uniquePlayerIds.has(focalPlayerId)) {
    throw new RangeError(`capital-sale focal player ${focalPlayerId} is missing`);
  }
  const modes: Record<PlayerId, AiCapitalSaleMode> = {};
  for (const playerId of playerIds) {
    modes[playerId] =
      playerId === focalPlayerId ? candidateMode : "legacy-v4";
  }
  return Object.freeze(modes);
}

/**
 * Rotate policy-bearing IDs across already-created physical player objects.
 * This intentionally matches the policy-suite benchmark's safe semantics.
 */
export function rotateAiCapitalSaleHeadlessSeats(
  state: GameState,
  rotation: number,
): void {
  if (
    state.players.length !== AI_CAPITAL_SALE_ROTATIONS.length ||
    !AI_CAPITAL_SALE_ROTATIONS.includes(
      rotation as (typeof AI_CAPITAL_SALE_ROTATIONS)[number],
    )
  ) {
    throw new Error(`invalid capital-sale seat rotation ${rotation}`);
  }
  const playerIds = state.players.map((player) => player.id);
  if (
    new Set(playerIds).size !== ALL_PLAYER_IDS.length ||
    ALL_PLAYER_IDS.some((playerId) => !playerIds.includes(playerId))
  ) {
    throw new Error("capital-sale rotation requires canonical player IDs");
  }
  for (let index = 0; index < state.players.length; index += 1) {
    state.players[index].id =
      playerIds[(index + rotation) % playerIds.length];
  }
  if (!state.players.some((player) => player.id === CONTROL_PLAYER_ID)) {
    throw new Error("capital-sale control player is missing after rotation");
  }
  state.humanPlayerId = CONTROL_PLAYER_ID;
}

function defaultEpisodeRunner(
  request: AiCapitalSaleEpisodeRunnerRequest,
): AiCapitalSaleEpisodeRunnerResult {
  let state = request.state;
  const diagnostics = emptyDiagnostics(
    state.players.map((player) => player.id),
  );
  while (state.phase !== "gameOver") {
    if (state.phase === "recruit" && state.round > request.maxRounds) {
      break;
    }
    const advanced = advanceHeadlessGameWithAiCapitalSaleModes(
      state,
      request.modes,
    );
    state = advanced.state;
    mergeDiagnostics(
      diagnostics,
      normalizeAiCapitalSaleDiagnostics(
        advanced.diagnostics,
        state.players.map((player) => player.id),
      ),
    );
  }
  return { state, diagnostics };
}

const DEFAULT_DEPENDENCIES: AiCapitalSaleBenchmarkDependencies = Object.freeze({
  createScenarioGame: createAiBenchmarkScenarioGame,
  runEpisode: defaultEpisodeRunner,
  computeCoreHash: computeAiCapitalSaleCoreHash,
  computeContentSnapshotSha256: computeAiCapitalSaleContentSnapshotSha256,
});

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

export function normalizeAiCapitalSaleCandidateMode(
  value: string | undefined,
): AiCapitalSaleCandidateMode {
  const candidateMode = value ?? DEFAULTS.candidateMode;
  if (
    !AI_CAPITAL_SALE_CANDIDATE_MODES.includes(
      candidateMode as AiCapitalSaleCandidateMode,
    )
  ) {
    throw new RangeError(
      `candidateMode must be one of ${AI_CAPITAL_SALE_CANDIDATE_MODES.join(", ")}`,
    );
  }
  return candidateMode as AiCapitalSaleCandidateMode;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function profileSnapshots(): AiCapitalSaleProfileSnapshot[] {
  return AI_CAPITAL_SALE_PLAYER_IDS.map((playerId) => ({
    playerId,
    profile: Object.freeze({ ...getAiStrategyProfile(playerId) }),
  }));
}

function profileHash(
  profiles: readonly AiCapitalSaleProfileSnapshot[],
): string {
  return createHash("sha256")
    .update(JSON.stringify(profiles))
    .digest("hex");
}

function jsonSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function physicalSeatByPlayer(state: GameState): Record<PlayerId, number> {
  const result: Record<PlayerId, number> = {};
  for (let index = 0; index < state.players.length; index += 1) {
    const playerId = state.players[index]?.id;
    if (!playerId || result[playerId] !== undefined) {
      throw new Error("capital-sale physical-seat map has invalid player IDs");
    }
    result[playerId] = index;
  }
  for (const playerId of ALL_PLAYER_IDS) {
    if (result[playerId] === undefined) {
      throw new Error(`capital-sale physical-seat map is missing ${playerId}`);
    }
  }
  return result;
}

function cloneCanonicalState(
  canonical: GameState,
  expectedSha256: string,
  expectedRngState: number,
): GameState {
  const cloned = structuredClone(canonical);
  if (jsonSha256(cloned) !== expectedSha256) {
    throw new Error("capital-sale canonical state clone changed JSON bytes");
  }
  if (cloned.rngState !== expectedRngState) {
    throw new Error("capital-sale canonical state clone changed rngState");
  }
  return cloned;
}

function alivePlayerCount(state: GameState): number {
  return state.players.filter((player) => player.alive).length;
}

function playerOutcome(
  state: GameState,
  playerId: AiCapitalSalePlayerId,
): AiCapitalSalePlayerOutcome {
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
  diagnostics: AiCapitalSaleDiagnostics,
  initialStateSha256: string,
  initialRngState: number,
): AiCapitalSaleGameRun {
  const outcomes = {} as Record<
    AiCapitalSalePlayerId,
    AiCapitalSalePlayerOutcome
  >;
  for (const playerId of AI_CAPITAL_SALE_PLAYER_IDS) {
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
    initialStateSha256,
    initialRngState,
    outcomes,
    diagnostics,
    failure: null,
  };
}

function failedGameRun(
  message: string,
  initialStateSha256: string,
  initialRngState: number,
): AiCapitalSaleGameRun {
  const outcomes = {} as Record<
    AiCapitalSalePlayerId,
    AiCapitalSalePlayerOutcome
  >;
  for (const playerId of AI_CAPITAL_SALE_PLAYER_IDS) {
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
    initialStateSha256,
    initialRngState,
    outcomes,
    diagnostics: emptyDiagnostics(),
    failure: message,
  };
}

function pairKey(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  rotation: number,
  physicalSeat: number,
  profileId: AiStrategyId,
): string {
  return [
    `seed:${seed}`,
    `scenario:${scenarioId}`,
    `rotation:${rotation}`,
    `physical-seat:${physicalSeat}`,
    `profile:${profileId}`,
  ].join("|");
}

function exactPlacement(bounds: PlacementBounds | null): number | null {
  return bounds?.exact === true ? bounds.best : null;
}

function buildPair(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  rotation: number,
  physicalSeat: number,
  profile: AiCapitalSaleProfileSnapshot,
  baseline: AiCapitalSaleGameRun,
  candidate: AiCapitalSaleGameRun,
  uniquePairKey: boolean,
): AiCapitalSalePair {
  const baselineOutcome = baseline.outcomes[profile.playerId];
  const candidateOutcome = candidate.outcomes[profile.playerId];
  const baselinePlacement = exactPlacement(baselineOutcome.placementBounds);
  const candidatePlacement = exactPlacement(candidateOutcome.placementBounds);
  const initialStateMatched =
    baseline.initialStateSha256 === candidate.initialStateSha256 &&
    baseline.initialRngState === candidate.initialRngState;
  const usable =
    uniquePairKey &&
    initialStateMatched &&
    baseline.failure === null &&
    candidate.failure === null &&
    baseline.completed &&
    candidate.completed &&
    !baseline.drawn &&
    !candidate.drawn &&
    !baseline.truncated &&
    !candidate.truncated &&
    baselinePlacement !== null &&
    candidatePlacement !== null &&
    baselineOutcome.topFour !== null &&
    candidateOutcome.topFour !== null &&
    baselineOutcome.win !== null &&
    candidateOutcome.win !== null;
  return {
    pairKey: pairKey(
      seed,
      scenarioId,
      rotation,
      physicalSeat,
      profile.profile.id,
    ),
    seed,
    scenarioId,
    rotation,
    physicalSeat,
    playerId: profile.playerId,
    profileId: profile.profile.id,
    initialStateMatched,
    baselinePlacementBounds: baselineOutcome.placementBounds,
    candidatePlacementBounds: candidateOutcome.placementBounds,
    placementDelta: usable
      ? (candidatePlacement as number) - (baselinePlacement as number)
      : null,
    topFourDelta: usable
      ? Number(candidateOutcome.topFour) - Number(baselineOutcome.topFour)
      : null,
    winDelta: usable
      ? Number(candidateOutcome.win) - Number(baselineOutcome.win)
      : null,
  };
}

function isCompletePair(pair: AiCapitalSalePair): boolean {
  return [pair.placementDelta, pair.topFourDelta, pair.winDelta].every(
    (value) => value !== null && Number.isFinite(value),
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function seedMetricFromPairs(
  seed: number,
  pairs: readonly AiCapitalSalePair[],
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
  clusters: readonly AiCapitalSaleSeedCluster[],
  selectPairs: (
    cluster: AiCapitalSaleSeedCluster,
  ) => readonly AiCapitalSalePair[],
  expectedPairsPerSeed: number,
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
  return summarizeAiRecruitPlannerSeedMetrics(metrics, completePairs);
}

function buildComparisonMatrix(
  clusters: readonly AiCapitalSaleSeedCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[],
  profiles: readonly AiCapitalSaleProfileSnapshot[],
): AiCapitalSaleComparisonMatrix {
  const overall = summarizeStratum(
    clusters,
    (cluster) => cluster.pairs,
    scenarioIds.length *
      AI_CAPITAL_SALE_ROTATIONS.length *
      AI_CAPITAL_SALE_PLAYER_IDS.length,
  );
  const byScenario: AiCapitalSaleComparisonMatrix["byScenario"] = {};
  const byProfile: AiCapitalSaleComparisonMatrix["byProfile"] = {};
  const byPhysicalSeat: AiCapitalSaleComparisonMatrix["byPhysicalSeat"] = {};
  for (const scenarioId of scenarioIds) {
    byScenario[scenarioId] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.scenarioId === scenarioId),
      AI_CAPITAL_SALE_ROTATIONS.length *
        AI_CAPITAL_SALE_PLAYER_IDS.length,
    );
  }
  for (const { profile } of profiles) {
    byProfile[profile.id] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.profileId === profile.id),
      scenarioIds.length * AI_CAPITAL_SALE_ROTATIONS.length,
    );
  }
  for (const physicalSeat of AI_CAPITAL_SALE_ROTATIONS) {
    byPhysicalSeat[physicalSeat] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.physicalSeat === physicalSeat),
      scenarioIds.length * AI_CAPITAL_SALE_PLAYER_IDS.length,
    );
  }
  return { overall, byScenario, byProfile, byPhysicalSeat };
}

function diagnosticSummary(
  episodes: readonly AiCapitalSaleEpisode[],
): AiCapitalSaleDiagnosticSummary {
  const baselineValues: AiCapitalSalePlayerDiagnostics[] = [];
  const focalValues: AiCapitalSalePlayerDiagnostics[] = [];
  const byScenario: AiCapitalSaleDiagnosticSummary["candidateFocalByScenario"] =
    {};
  const byProfile: AiCapitalSaleDiagnosticSummary["candidateFocalByProfile"] =
    {};
  const byPhysicalSeat: AiCapitalSaleDiagnosticSummary["candidateFocalByPhysicalSeat"] =
    {};
  for (const episode of episodes) {
    for (const playerId of AI_CAPITAL_SALE_PLAYER_IDS) {
      baselineValues.push(episode.baseline.diagnostics[playerId]);
    }
    for (const candidate of episode.candidates) {
      const focal = candidate.run.diagnostics[candidate.focalPlayerId];
      focalValues.push(focal);
      byScenario[episode.scenarioId] = sumAiCapitalSaleDiagnostics([
        byScenario[episode.scenarioId] ?? emptyPlayerDiagnostics(),
        focal,
      ]);
      const profileId = getAiStrategyProfile(candidate.focalPlayerId).id;
      byProfile[profileId] = sumAiCapitalSaleDiagnostics([
        byProfile[profileId] ?? emptyPlayerDiagnostics(),
        focal,
      ]);
      byPhysicalSeat[candidate.physicalSeat] = sumAiCapitalSaleDiagnostics([
        byPhysicalSeat[candidate.physicalSeat] ?? emptyPlayerDiagnostics(),
        focal,
      ]);
    }
  }
  return {
    baselineScoredPlayers: sumAiCapitalSaleDiagnostics(baselineValues),
    candidateFocalPlayers: sumAiCapitalSaleDiagnostics(focalValues),
    candidateFocalByScenario: byScenario,
    candidateFocalByProfile: byProfile,
    candidateFocalByPhysicalSeat: byPhysicalSeat,
  };
}

function appendReason(
  reasons: string[],
  condition: boolean,
  reason: string,
): void {
  if (!condition && !reasons.includes(reason)) reasons.push(reason);
}

function comparisonIsComplete(
  comparison: AiRecruitPlannerComparisons | undefined,
  seeds: number,
  expectedPairs: number,
): boolean {
  return (
    comparison !== undefined &&
    [comparison.placement, comparison.topFour, comparison.win].every(
      (metric) =>
        metric.seedClusters === seeds && metric.pairedSeats === expectedPairs,
    )
  );
}

function appendStratumGateReasons(
  reasons: string[],
  label: string,
  comparison: AiRecruitPlannerComparisons | undefined,
  configuredSeeds: number,
  expectedPairs: number,
): void {
  appendReason(
    reasons,
    comparisonIsComplete(comparison, configuredSeeds, expectedPairs),
    `${label} comparison requires every seed cluster and pair`,
  );
  appendReason(
    reasons,
    comparison?.placement.confidence95 !== null &&
      comparison?.placement.confidence95 !== undefined &&
      comparison.placement.confidence95.upper <=
        STRATUM_PLACEMENT_NON_INFERIORITY_MARGIN,
    `${label} placement CI upper bound must be at most ${STRATUM_PLACEMENT_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );
  appendReason(
    reasons,
    comparison?.topFour.confidence95 !== null &&
      comparison?.topFour.confidence95 !== undefined &&
      comparison.topFour.confidence95.lower >=
        -STRATUM_RATE_NON_INFERIORITY_MARGIN,
    `${label} top-four CI lower bound must be at least -${STRATUM_RATE_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );
  appendReason(
    reasons,
    comparison?.win.confidence95 !== null &&
      comparison?.win.confidence95 !== undefined &&
      comparison.win.confidence95.lower >=
        -STRATUM_RATE_NON_INFERIORITY_MARGIN,
    `${label} win CI lower bound must be at least -${STRATUM_RATE_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );
}

function eligibleDiagnosticAccountingCloses(
  diagnostics: Readonly<AiCapitalSalePlayerDiagnostics>,
): boolean {
  // handCapacityAborts occurs before eligibility and is intentionally absent.
  return (
    diagnostics.eligible ===
    diagnostics.dryRunAccepted +
      diagnostics.offerMutationAborts +
      diagnostics.fundingAborts +
      diagnostics.scoreAborts +
      diagnostics.settledWarbandScoreAborts +
      diagnostics.interactionAborts +
      diagnostics.executionFailureAborts
  );
}

function acceptedDiagnosticAccountingCloses(
  diagnostics: Readonly<AiCapitalSalePlayerDiagnostics>,
): boolean {
  return (
    diagnostics.dryRunAccepted === diagnostics.salesCommitted &&
    diagnostics.salesCommitted === diagnostics.purchasesCommitted &&
    diagnostics.purchasesCommitted === diagnostics.decisionDivergences
  );
}

function sameDiagnostics(
  left: Readonly<AiCapitalSalePlayerDiagnostics>,
  right: Readonly<AiCapitalSalePlayerDiagnostics>,
): boolean {
  return DIAGNOSTIC_COUNTERS.every(
    (counter) => left[counter] === right[counter],
  );
}

export function evaluateAiCapitalSaleGate(
  input: AiCapitalSaleGateInput,
): AiCapitalSaleGateResult {
  const reasons = [...input.technicalReasons];
  const treatmentExposed = input.focalDiagnostics.decisionDivergences > 0;
  const noPostSaleAborts = input.focalDiagnostics.postSaleAborts === 0;
  const eligibleAccountingCloses = eligibleDiagnosticAccountingCloses(
    input.focalDiagnostics,
  );
  const acceptedTreatmentAccountingCloses =
    acceptedDiagnosticAccountingCloses(input.focalDiagnostics);
  const noExecutionFailureAborts =
    input.focalDiagnostics.executionFailureAborts === 0;
  appendReason(
    reasons,
    treatmentExposed,
    "requires at least one focal capital-sale decision divergence",
  );
  appendReason(
    reasons,
    noPostSaleAborts,
    "requires zero focal post-sale aborts",
  );
  appendReason(
    reasons,
    eligibleAccountingCloses,
    "requires every focal eligible decision to close into one terminal diagnostic",
  );
  appendReason(
    reasons,
    acceptedTreatmentAccountingCloses,
    "requires focal dry-run accepts, sales, purchases, and decision divergences to match",
  );
  appendReason(
    reasons,
    noExecutionFailureAborts,
    "requires zero focal execution-failure aborts",
  );

  const profileIds = [...new Set(input.profileIds)];
  const allSevenUniqueProfiles =
    input.profileIds.length === AI_CAPITAL_SALE_PLAYER_IDS.length &&
    profileIds.length === AI_CAPITAL_SALE_PLAYER_IDS.length;
  const profileDiagnostics: AiCapitalSalePlayerDiagnostics[] = [];
  let profileDiagnosticsUsable = allSevenUniqueProfiles;
  for (const profileId of profileIds) {
    const diagnostics = input.focalDiagnosticsByProfile[profileId];
    if (!diagnostics) {
      appendReason(
        reasons,
        false,
        `${profileId} focal diagnostics are required`,
      );
      profileDiagnosticsUsable = false;
      continue;
    }
    profileDiagnostics.push(diagnostics);
    const profileTreatmentExposed = diagnostics.decisionDivergences > 0;
    const profileNoPostSaleAborts = diagnostics.postSaleAborts === 0;
    const profileEligibleAccountingCloses =
      eligibleDiagnosticAccountingCloses(diagnostics);
    const profileAcceptedAccountingCloses =
      acceptedDiagnosticAccountingCloses(diagnostics);
    const profileNoExecutionFailureAborts =
      diagnostics.executionFailureAborts === 0;
    appendReason(
      reasons,
      profileTreatmentExposed,
      `${profileId} requires at least one focal capital-sale decision divergence`,
    );
    appendReason(
      reasons,
      profileNoPostSaleAborts,
      `${profileId} requires zero focal post-sale aborts`,
    );
    appendReason(
      reasons,
      profileEligibleAccountingCloses,
      `${profileId} requires every focal eligible decision to close into one terminal diagnostic`,
    );
    appendReason(
      reasons,
      profileAcceptedAccountingCloses,
      `${profileId} requires focal dry-run accepts, sales, purchases, and decision divergences to match`,
    );
    appendReason(
      reasons,
      profileNoExecutionFailureAborts,
      `${profileId} requires zero focal execution-failure aborts`,
    );
    profileDiagnosticsUsable =
      profileDiagnosticsUsable &&
      profileTreatmentExposed &&
      profileNoPostSaleAborts &&
      profileEligibleAccountingCloses &&
      profileAcceptedAccountingCloses &&
      profileNoExecutionFailureAborts;
  }
  const profileDiagnosticsPartitionAggregate =
    profileDiagnostics.length === profileIds.length &&
    sameDiagnostics(
      sumAiCapitalSaleDiagnostics(profileDiagnostics),
      input.focalDiagnostics,
    );
  appendReason(
    reasons,
    profileDiagnosticsPartitionAggregate,
    "requires by-profile focal diagnostics to partition aggregate diagnostics",
  );
  profileDiagnosticsUsable =
    profileDiagnosticsUsable && profileDiagnosticsPartitionAggregate;

  const screenEvidenceUsable =
    input.technicalReasons.length === 0 &&
    treatmentExposed &&
    noPostSaleAborts &&
    eligibleAccountingCloses &&
    acceptedTreatmentAccountingCloses &&
    noExecutionFailureAborts &&
    profileDiagnosticsUsable;
  appendReason(
    reasons,
    !input.injectedRunner,
    "injected-runner evidence is test-only",
  );
  appendReason(
    reasons,
    Number.isSafeInteger(input.configuredSeeds) &&
      input.configuredSeeds >= AI_CAPITAL_SALE_MINIMUM_ACCEPTANCE_SEEDS,
    `requires at least ${AI_CAPITAL_SALE_MINIMUM_ACCEPTANCE_SEEDS} seed clusters`,
  );
  const { placement, topFour, win } = input.comparisonMatrix.overall;
  appendReason(
    reasons,
    placement.meanDelta !== null &&
      placement.meanDelta <= -MINIMUM_PLACEMENT_IMPROVEMENT,
    `mean placement delta must be at most -${MINIMUM_PLACEMENT_IMPROVEMENT.toFixed(2)}`,
  );
  appendReason(
    reasons,
    placement.confidence95 !== null && placement.confidence95.upper < 0,
    "placement CI upper bound must be below 0",
  );
  appendReason(
    reasons,
    topFour.confidence95 !== null &&
      topFour.confidence95.lower >= -TOP_FOUR_NON_INFERIORITY_MARGIN,
    `top-four CI lower bound must be at least -${TOP_FOUR_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );
  appendReason(
    reasons,
    win.confidence95 !== null &&
      win.confidence95.lower >= -WIN_NON_INFERIORITY_MARGIN,
    `win CI lower bound must be at least -${WIN_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );

  appendReason(
    reasons,
    allSevenUniqueProfiles,
    "requires all seven unique strategy profiles",
  );
  for (const profileId of profileIds) {
    const comparison = input.comparisonMatrix.byProfile[profileId];
    appendStratumGateReasons(
      reasons,
      profileId,
      comparison,
      input.configuredSeeds,
      input.configuredSeeds *
        input.configuredScenarioIds.length *
        AI_CAPITAL_SALE_ROTATIONS.length,
    );
    appendReason(
      reasons,
      comparison?.placement.meanDelta !== null &&
        comparison?.placement.meanDelta !== undefined &&
        comparison.placement.meanDelta <= 0,
      `${profileId} mean placement delta must be at most 0`,
    );
  }
  for (const scenarioId of [...new Set(input.configuredScenarioIds)]) {
    appendStratumGateReasons(
      reasons,
      scenarioId,
      input.comparisonMatrix.byScenario[scenarioId],
      input.configuredSeeds,
      input.configuredSeeds *
        AI_CAPITAL_SALE_ROTATIONS.length *
        profileIds.length,
    );
  }
  // Physical seat is reported but deliberately not gated: complete rotations
  // make it a nuisance factor, and its low-power strata must not veto evidence.
  return Object.freeze({
    screenEvidenceUsable,
    accepted: screenEvidenceUsable && reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

function runAiCapitalSaleBenchmarkInternal(
  options: AiCapitalSaleBenchmarkOptions,
  dependencies: AiCapitalSaleBenchmarkDependencies,
  injectedRunner: boolean,
) {
  const candidateMode = normalizeAiCapitalSaleCandidateMode(
    options.candidateMode,
  );
  const seeds = positiveInteger(options.seeds, DEFAULTS.seeds, "seeds");
  const startSeed = options.startSeed ?? DEFAULTS.startSeed;
  if (
    !Number.isSafeInteger(startSeed) ||
    !Number.isSafeInteger(startSeed + seeds - 1)
  ) {
    throw new RangeError("scheduled seeds must be safe integers");
  }
  // This must precede scenario creation, runner invocation, and progress.
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

  const coreHashBefore = dependencies.computeCoreHash();
  if (!injectedRunner && coreHashBefore !== CORE_HASH_AT_MODULE_LOAD) {
    throw new Error("capital-sale evaluator source changed after module load");
  }
  const contentSnapshotSha256Before =
    dependencies.computeContentSnapshotSha256();
  if (
    !injectedRunner &&
    contentSnapshotSha256Before !== CONTENT_SNAPSHOT_SHA256_AT_MODULE_LOAD
  ) {
    throw new Error("capital-sale content snapshot changed after module load");
  }
  const policyVersion = AI_POLICY_VERSION;
  const profiles = profileSnapshots();
  const strategyProfileHash = profileHash(profiles);
  if (
    new Set(profiles.map(({ profile }) => profile.id)).size !==
    AI_CAPITAL_SALE_PLAYER_IDS.length
  ) {
    throw new Error("capital-sale benchmark requires seven unique profiles");
  }

  const scheduledRuns =
    seeds *
    scenarioIds.length *
    AI_CAPITAL_SALE_ROTATIONS.length *
    (1 + AI_CAPITAL_SALE_PLAYER_IDS.length);
  const expectedPairs =
    seeds *
    scenarioIds.length *
    AI_CAPITAL_SALE_ROTATIONS.length *
    AI_CAPITAL_SALE_PLAYER_IDS.length;
  const runnerFailures: AiCapitalSaleRunnerFailure[] = [];
  const clusters: AiCapitalSaleSeedCluster[] = [];
  const pairKeys = new Set<string>();
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

  const reportProgress = (
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    rotation: number,
    arm: "baseline" | "candidate",
    focalPlayerId: AiCapitalSalePlayerId | null,
    physicalSeat: number | null,
    run: AiCapitalSaleGameRun,
  ): void => {
    processedRuns += 1;
    if (run.completed) completedRuns += 1;
    options.onProgress?.({
      processedRuns,
      scheduledRuns,
      seed,
      scenarioId,
      rotation,
      arm,
      focalPlayerId,
      physicalSeat,
      completed: run.completed,
      failure: run.failure,
    });
  };

  const execute = (
    canonical: GameState,
    initialStateSha256: string,
    initialRngState: number,
    seatMap: Readonly<Record<PlayerId, number>>,
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    rotation: number,
    focalPlayerId: AiCapitalSalePlayerId | null,
  ): AiCapitalSaleGameRun => {
    const state = cloneCanonicalState(
      canonical,
      initialStateSha256,
      initialRngState,
    );
    const modes = createAiCapitalSaleModeMap(
      state.players.map((player) => player.id),
      focalPlayerId,
      candidateMode,
    );
    const physicalSeat =
      focalPlayerId === null ? null : seatMap[focalPlayerId];
    const result = dependencies.runEpisode({
      state,
      modes,
      seed,
      scenarioId,
      rotation,
      arm: focalPlayerId === null ? "baseline" : "candidate",
      focalPlayerId,
      physicalSeat,
      maxRounds,
      initialStateSha256,
      initialRngState,
    });
    const diagnostics = normalizeAiCapitalSaleDiagnostics(
      result.diagnostics,
      result.state.players.map((player) => player.id),
    );
    checkContentVersion(result.state);
    return gameRunResult(
      result.state,
      diagnostics,
      initialStateSha256,
      initialRngState,
    );
  };

  for (let seedOffset = 0; seedOffset < seeds; seedOffset += 1) {
    const seed = startSeed + seedOffset;
    const episodes: AiCapitalSaleEpisode[] = [];
    const clusterPairs: AiCapitalSalePair[] = [];
    for (const scenarioId of scenarioIds) {
      for (const rotation of AI_CAPITAL_SALE_ROTATIONS) {
        let canonical: GameState;
        try {
          canonical = dependencies.createScenarioGame(
            scenarioId,
            seed,
            initialHealth,
          );
          checkContentVersion(canonical);
          rotateAiCapitalSaleHeadlessSeats(canonical, rotation);
        } catch (error) {
          const message = errorMessage(error);
          runnerFailures.push({
            seed,
            scenarioId,
            rotation,
            arm: "baseline",
            focalPlayerId: null,
            message: `canonical setup failed: ${message}`,
          });
          // No trustworthy common initial state exists, so the whole run is
          // represented by failures rather than fabricating candidate pairs.
          const failed = failedGameRun(message, "", 0);
          reportProgress(
            seed,
            scenarioId,
            rotation,
            "baseline",
            null,
            null,
            failed,
          );
          for (const focalPlayerId of AI_CAPITAL_SALE_PLAYER_IDS) {
            runnerFailures.push({
              seed,
              scenarioId,
              rotation,
              arm: "candidate",
              focalPlayerId,
              message: `canonical setup failed: ${message}`,
            });
            reportProgress(
              seed,
              scenarioId,
              rotation,
              "candidate",
              focalPlayerId,
              null,
              failed,
            );
          }
          continue;
        }
        const initialStateSha256 = jsonSha256(canonical);
        const initialRngState = canonical.rngState;
        const seatMap = physicalSeatByPlayer(canonical);

        let baseline: AiCapitalSaleGameRun;
        try {
          baseline = execute(
            canonical,
            initialStateSha256,
            initialRngState,
            seatMap,
            seed,
            scenarioId,
            rotation,
            null,
          );
        } catch (error) {
          const message = errorMessage(error);
          runnerFailures.push({
            seed,
            scenarioId,
            rotation,
            arm: "baseline",
            focalPlayerId: null,
            message,
          });
          baseline = failedGameRun(
            message,
            initialStateSha256,
            initialRngState,
          );
        }
        reportProgress(
          seed,
          scenarioId,
          rotation,
          "baseline",
          null,
          null,
          baseline,
        );

        const candidates: AiCapitalSaleCandidateRun[] = [];
        const pairs: AiCapitalSalePair[] = [];
        for (const profile of profiles) {
          const focalPlayerId = profile.playerId;
          const physicalSeat = seatMap[focalPlayerId];
          let candidate: AiCapitalSaleGameRun;
          try {
            candidate = execute(
              canonical,
              initialStateSha256,
              initialRngState,
              seatMap,
              seed,
              scenarioId,
              rotation,
              focalPlayerId,
            );
          } catch (error) {
            const message = errorMessage(error);
            runnerFailures.push({
              seed,
              scenarioId,
              rotation,
              arm: "candidate",
              focalPlayerId,
              message,
            });
            candidate = failedGameRun(
              message,
              initialStateSha256,
              initialRngState,
            );
          }
          candidates.push({ focalPlayerId, physicalSeat, run: candidate });
          const key = pairKey(
            seed,
            scenarioId,
            rotation,
            physicalSeat,
            profile.profile.id,
          );
          const uniquePairKey = !pairKeys.has(key);
          if (uniquePairKey) {
            pairKeys.add(key);
          } else {
            runnerFailures.push({
              seed,
              scenarioId,
              rotation,
              arm: "provenance",
              focalPlayerId,
              message: `duplicate capital-sale pair key ${key}`,
            });
          }
          pairs.push(
            buildPair(
              seed,
              scenarioId,
              rotation,
              physicalSeat,
              profile,
              baseline,
              candidate,
              uniquePairKey,
            ),
          );
          reportProgress(
            seed,
            scenarioId,
            rotation,
            "candidate",
            focalPlayerId,
            physicalSeat,
            candidate,
          );
        }
        clusterPairs.push(...pairs);
        episodes.push({
          seed,
          scenarioId,
          rotation,
          initialStateSha256,
          initialRngState,
          physicalSeatByPlayer: seatMap,
          baseline,
          candidates,
          pairs,
        });
      }
    }
    clusters.push({
      seed,
      episodes,
      pairs: clusterPairs,
      metric: seedMetricFromPairs(
        seed,
        clusterPairs,
        scenarioIds.length *
          AI_CAPITAL_SALE_ROTATIONS.length *
          AI_CAPITAL_SALE_PLAYER_IDS.length,
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
  const initialStateMismatches = allPairs.filter(
    (pair) => !pair.initialStateMatched,
  ).length;
  const drawnRuns = allRuns.filter((run) => run.drawn).length;
  const truncatedRuns = allRuns.filter((run) => run.truncated).length;
  const comparisons = buildComparisonMatrix(clusters, scenarioIds, profiles);
  const diagnostics = diagnosticSummary(allEpisodes);

  const coreHashAfter = dependencies.computeCoreHash();
  const coreStable = coreHashAfter === coreHashBefore;
  const contentSnapshotSha256After =
    dependencies.computeContentSnapshotSha256();
  const contentSnapshotStable =
    contentSnapshotSha256After === contentSnapshotSha256Before;
  const policyVersionAfter = AI_POLICY_VERSION;
  const policyVersionStable = policyVersionAfter === policyVersion;
  const strategyProfileHashAfter = profileHash(profileSnapshots());
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  if (!coreStable) {
    runnerFailures.push({
      seed: startSeed,
      scenarioId: null,
      rotation: null,
      arm: "provenance",
      focalPlayerId: null,
      message: "capital-sale evaluator source changed during the benchmark",
    });
  }
  if (!contentSnapshotStable) {
    runnerFailures.push({
      seed: startSeed,
      scenarioId: null,
      rotation: null,
      arm: "provenance",
      focalPlayerId: null,
      message: "capital-sale content snapshot changed during the benchmark",
    });
  }
  if (!policyVersionStable || !strategyProfilesStable) {
    runnerFailures.push({
      seed: startSeed,
      scenarioId: null,
      rotation: null,
      arm: "provenance",
      focalPlayerId: null,
      message: "AI policy version or strategy profiles changed during the benchmark",
    });
  }

  const technicalReasons: string[] = [];
  appendReason(
    technicalReasons,
    processedRuns === scheduledRuns,
    "requires every scheduled baseline and focal candidate run",
  );
  appendReason(
    technicalReasons,
    runnerFailures.length === 0,
    "requires zero runner or provenance failures",
  );
  appendReason(
    technicalReasons,
    pairedPairs === expectedPairs && missingPairs === 0,
    "requires every seed/scenario/rotation/profile/physical-seat pair",
  );
  appendReason(
    technicalReasons,
    initialStateMismatches === 0,
    "requires identical initial JSON hashes and rngState for every pair",
  );
  appendReason(
    technicalReasons,
    drawnRuns === 0,
    "requires zero drawn runs",
  );
  appendReason(
    technicalReasons,
    truncatedRuns === 0,
    "requires zero truncated runs",
  );
  appendReason(
    technicalReasons,
    coreStable,
    "requires stable capital-sale evaluator source",
  );
  appendReason(
    technicalReasons,
    contentSnapshotStable,
    "requires a stable pinned content snapshot",
  );
  appendReason(
    technicalReasons,
    policyVersionStable && strategyProfilesStable,
    "requires stable AI policy and strategy profiles",
  );

  const gate = evaluateAiCapitalSaleGate({
    configuredSeeds: seeds,
    configuredScenarioIds: scenarioIds,
    profileIds: profiles.map(({ profile }) => profile.id),
    technicalReasons,
    comparisonMatrix: comparisons,
    focalDiagnostics: diagnostics.candidateFocalPlayers,
    focalDiagnosticsByProfile: diagnostics.candidateFocalByProfile,
    injectedRunner,
  });

  return {
    method: "development-single-focal-capital-sale-seat-rotated-v2" as const,
    evidenceStage: injectedRunner
      ? ("test-injected" as const)
      : ("development-only" as const),
    commonRandomStreamGuarantee:
      "Each pair starts from an identical canonical JSON state and rngState; no equality is claimed after the first decision divergence." as const,
    benchmarkVersion: AI_CAPITAL_SALE_BENCHMARK_VERSION,
    policyVersion,
    policyVersionAfter,
    policyVersionStable,
    contentVersion: expectedContentVersion,
    contentSnapshotSha256: contentSnapshotSha256Before,
    contentSnapshotSha256After,
    contentSnapshotStable,
    coreHash: coreHashBefore,
    coreHashAfter,
    coreStable,
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
      rotations: AI_CAPITAL_SALE_ROTATIONS,
      focalPlayerIds: AI_CAPITAL_SALE_PLAYER_IDS,
      baselineMode: "all-legacy-v4" as const,
      candidateMode: `single-focal-${candidateMode}` as const,
      candidateEngineMode: candidateMode,
      runsPerSeed:
        scenarioIds.length *
        AI_CAPITAL_SALE_ROTATIONS.length *
        (1 + AI_CAPITAL_SALE_PLAYER_IDS.length),
      pairsPerSeed:
        scenarioIds.length *
        AI_CAPITAL_SALE_ROTATIONS.length *
        AI_CAPITAL_SALE_PLAYER_IDS.length,
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
    initialStateMismatches,
    drawnRuns,
    truncatedRuns,
    runnerFailures,
    clusters,
    comparisons: comparisons.overall,
    comparisonMatrix: comparisons,
    diagnostics,
    focalSalesCommitted: diagnostics.candidateFocalPlayers.salesCommitted,
    focalPurchasesCommitted:
      diagnostics.candidateFocalPlayers.purchasesCommitted,
    focalDecisionDivergences:
      diagnostics.candidateFocalPlayers.decisionDivergences,
    focalPostSaleAborts:
      diagnostics.candidateFocalPlayers.postSaleAborts,
    focalFundingAborts: diagnostics.candidateFocalPlayers.fundingAborts,
    focalScoreAborts: diagnostics.candidateFocalPlayers.scoreAborts,
    focalSettledWarbandScoreAborts:
      diagnostics.candidateFocalPlayers.settledWarbandScoreAborts,
    focalInteractionAborts:
      diagnostics.candidateFocalPlayers.interactionAborts,
    focalExecutionFailureAborts:
      diagnostics.candidateFocalPlayers.executionFailureAborts,
    technicalEvidenceUsable: technicalReasons.length === 0,
    technicalReasons: Object.freeze(technicalReasons),
    screenEvidenceUsable: gate.screenEvidenceUsable,
    accepted: gate.accepted,
    acceptanceReasons: gate.reasons,
  };
}

export function runAiCapitalSaleBenchmark(
  options: AiCapitalSaleBenchmarkOptions = {},
) {
  return runAiCapitalSaleBenchmarkInternal(
    options,
    DEFAULT_DEPENDENCIES,
    false,
  );
}

/** Test-only seam. Its result is permanently marked injected and cannot pass. */
export function runAiCapitalSaleBenchmarkWithRunner(
  options: AiCapitalSaleBenchmarkOptions,
  dependencies: {
    readonly createScenarioGame: typeof createAiBenchmarkScenarioGame;
    readonly runEpisode: AiCapitalSaleEpisodeRunner;
    readonly computeCoreHash?: () => string;
    readonly computeContentSnapshotSha256?: () => string;
  },
) {
  return runAiCapitalSaleBenchmarkInternal(
    options,
    {
      createScenarioGame: dependencies.createScenarioGame,
      runEpisode: dependencies.runEpisode,
      computeCoreHash:
        dependencies.computeCoreHash ?? (() => "test-core-hash"),
      computeContentSnapshotSha256:
        dependencies.computeContentSnapshotSha256 ??
        (() => "test-content-snapshot-hash"),
    },
    true,
  );
}

function parseIntegerFlag(
  arguments_: readonly string[],
  index: number,
  flag: string,
): number {
  const raw = arguments_[index + 1];
  if (raw === undefined || raw.startsWith("--")) {
    throw new Error(`${flag} requires one integer value`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${flag} requires one safe integer value`);
  }
  return value;
}

export function parseAiCapitalSaleCliArguments(
  arguments_: readonly string[],
): AiCapitalSaleBenchmarkOptions {
  const options: {
    seeds?: number;
    startSeed?: number;
    maxRounds?: number;
    candidateMode?: AiCapitalSaleCandidateMode;
  } = {};
  const seen = new Set<string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];
    if (flag.includes("=")) {
      throw new Error(`capital-sale benchmark rejects --flag=value syntax: ${flag}`);
    }
    if (
      ![
        "--seeds",
        "--start-seed",
        "--max-rounds",
        "--candidate-mode",
      ].includes(flag)
    ) {
      throw new Error(`unknown capital-sale benchmark argument ${flag}`);
    }
    if (seen.has(flag)) {
      throw new Error(`duplicate capital-sale benchmark argument ${flag}`);
    }
    seen.add(flag);
    if (flag === "--candidate-mode") {
      const value = arguments_[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} requires one candidate mode value`);
      }
      options.candidateMode = normalizeAiCapitalSaleCandidateMode(value);
      index += 1;
      continue;
    }
    const value = parseIntegerFlag(arguments_, index, flag);
    index += 1;
    if (flag === "--seeds") options.seeds = value;
    if (flag === "--start-seed") options.startSeed = value;
    if (flag === "--max-rounds") options.maxRounds = value;
  }
  return Object.freeze(options);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const options = parseAiCapitalSaleCliArguments(process.argv.slice(2));
  const result = runAiCapitalSaleBenchmark({
    ...options,
    onProgress: (item) => {
      if (
        item.arm === "candidate" &&
        item.focalPlayerId === "player-7"
      ) {
        console.error(
          `[ai-capital-sale] ${item.processedRuns}/${item.scheduledRuns}`,
        );
      }
    },
  });
  console.log(JSON.stringify(result, null, 2));
}

// Exported for tests and audit tooling; defaults follow both full scenarios.
export const AI_CAPITAL_SALE_DEFAULT_RUNS_PER_SEED = RUNS_PER_SEED;
export const AI_CAPITAL_SALE_DEFAULT_PAIRS_PER_SEED = PAIRS_PER_SEED;
