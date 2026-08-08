import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

import {
  AI_POLICY_VERSION,
  getAiStrategyProfile,
  withAiStrategyProfileOverrides,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  hasAnyAiResidualPolicyOverrides,
  withAiResidualPolicyOverrides,
  type AiResidualMacroKind,
  type AiResidualPolicy,
  type AiResidualPolicyDiagnostics,
} from "../lib/game/ai-residual-policy.ts";
import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";
import {
  advanceHeadlessGame,
  type GameState,
} from "../lib/game/engine.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  isValidInitialHealth,
} from "../lib/game/setup.ts";
import {
  AI_BENCHMARK_SCENARIOS,
  createAiBenchmarkPairKey,
  createAiBenchmarkScenarioGame,
  normalizeAiBenchmarkScenarioIds,
  type AiBenchmarkScenarioId,
} from "./ai-benchmark-scenarios.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
  AI_COOPERATIVE_CEM_REGISTRATION,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
} from "./ai-cooperative-cem-registration.ts";
import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
  assertAiCooperativeCemImplementationPinned,
} from "./ai-cooperative-cem-implementation-integrity.ts";
import { assertAiCooperativeCemSelectionBenchmarkContract } from "./ai-cooperative-cem-selection-contract.ts";
import { AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE } from "./ai-cooperative-cem-selection-registration.ts";
import {
  consumeAiCooperativeCemSelectionBenchmarkToken,
  type AiCooperativeCemSelectionBenchmarkToken,
} from "./ai-cooperative-cem-selection.ts";
import {
  assertAiBenchmarkSeedAccess,
  type AiBenchmarkSeedReservationMode,
} from "./ai-seed-ledger.ts";
import {
  placementBoundsFromPlacement,
  summarizeAiRecruitPlannerSeedMetrics,
  type AiRecruitPlannerComparisons,
  type AiRecruitPlannerSeedMetric,
  type PlacementBounds,
} from "./benchmark-ai-recruit-planner.ts";

export const AI_POLICY_SUITE_BENCHMARK_VERSION = 1 as const;
export const AI_POLICY_SUITE_ROTATIONS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7,
] as const);
export const AI_POLICY_SUITE_PLAYER_IDS = Object.freeze([
  "player-1",
  "player-2",
  "player-3",
  "player-4",
  "player-5",
  "player-6",
  "player-7",
] as const);

export type AiPolicySuitePlayerId =
  (typeof AI_POLICY_SUITE_PLAYER_IDS)[number];

const CONTROL_PLAYER_ID = "player-0";
const DEFAULTS = {
  seeds: 1,
  startSeed: 1,
  maxRounds: 150,
};
export const AI_POLICY_SUITE_DRAW_RATE_NON_INFERIORITY_MARGIN = 0.01 as const;
export const AI_POLICY_SUITE_MINIMUM_PROMOTION_SEEDS = 24 as const;
export const AI_POLICY_SUITE_MINIMUM_PLACEMENT_IMPROVEMENT = 0.1 as const;
export const AI_POLICY_SUITE_TOP_FOUR_NON_INFERIORITY_MARGIN = 0.02 as const;
export const AI_POLICY_SUITE_WIN_NON_INFERIORITY_MARGIN = 0.03 as const;
export const AI_POLICY_SUITE_PROFILE_PLACEMENT_NON_INFERIORITY_MARGIN =
  0.25 as const;
export const AI_POLICY_SUITE_PROFILE_RATE_NON_INFERIORITY_MARGIN = 0.05 as const;
const GAME_DIRECTORY = new URL("../lib/game/", import.meta.url);

export interface AiPolicySuiteEpisodeContext {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
}

export interface AiPolicySuiteCandidate {
  /** When present, must contain exactly player-1 through player-7. */
  readonly profileOverrides?: ReadonlyMap<string, AiStrategyProfile>;
  /** Called once per scored player for every candidate episode. */
  readonly createResidualPolicy?: (
    playerId: AiPolicySuitePlayerId,
    episode: Readonly<AiPolicySuiteEpisodeContext>,
  ) => AiResidualPolicy;
}

export interface AiPolicySuiteBenchmarkOptions {
  readonly candidate: AiPolicySuiteCandidate;
  readonly seeds?: number;
  readonly startSeed?: number;
  readonly reservationId?: string;
  readonly reservationMode?: AiBenchmarkSeedReservationMode;
  readonly reservationProtocolSha256?: string;
  readonly reservationImplementationSha256?: string;
  readonly reservationConfirmation?: string;
  readonly reservationTrainingResultSha256?: string;
  readonly selectionAttemptToken?: AiCooperativeCemSelectionBenchmarkToken;
  readonly maxRounds?: number;
  readonly initialHealth?: number;
  /** Defaults to neutral-v1 plus live-lobby-v1. */
  readonly scenarioIds?: readonly AiBenchmarkScenarioId[];
  readonly onProgress?: (progress: AiPolicySuiteBenchmarkProgress) => void;
}

export interface AiPolicySuiteBenchmarkProgress {
  readonly processedRuns: number;
  readonly scheduledRuns: number;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly arm: "baseline" | "candidate";
  readonly completed: boolean;
  readonly failure: string | null;
}

export interface AiPolicySuiteProfileSnapshot {
  readonly playerId: AiPolicySuitePlayerId;
  readonly profile: AiStrategyProfile;
}

export interface AiPolicySuiteProfileOutcome {
  readonly playerId: AiPolicySuitePlayerId;
  readonly profileId: AiStrategyId;
  readonly placementBounds: PlacementBounds | null;
  readonly topFour: boolean | null;
  /** Never inferred from placement; a draw records false for every profile. */
  readonly win: boolean | null;
}

export interface AiPolicySuiteGameRun {
  readonly completed: boolean;
  readonly drawn: boolean;
  readonly truncated: boolean;
  readonly finalRound: number | null;
  readonly alivePlayers: number | null;
  readonly winnerPlayerId: string | null;
  readonly contentVersion: string | null;
  readonly profiles: Partial<
    Record<AiStrategyId, AiPolicySuiteProfileOutcome>
  >;
  readonly providerDiagnostics: AiResidualPolicyDiagnostics | null;
  readonly failure: string | null;
}

export interface AiPolicySuitePair {
  readonly pairKey: string;
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly playerId: AiPolicySuitePlayerId;
  readonly profileId: AiStrategyId;
  readonly baselinePlacementBounds: PlacementBounds | null;
  readonly candidatePlacementBounds: PlacementBounds | null;
  readonly placementDelta: number | null;
  readonly topFourDelta: number | null;
  readonly winDelta: number | null;
}

export interface AiPolicySuiteEpisode {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId;
  readonly rotation: number;
  readonly baseline: AiPolicySuiteGameRun;
  readonly candidate: AiPolicySuiteGameRun;
  readonly pairs: AiPolicySuitePair[];
}

export interface AiPolicySuiteSeedCluster {
  readonly seed: number;
  readonly episodes: AiPolicySuiteEpisode[];
  readonly pairs: AiPolicySuitePair[];
  readonly metric: AiRecruitPlannerSeedMetric | null;
}

export interface AiPolicySuiteComparisonMatrix {
  readonly overall: AiRecruitPlannerComparisons;
  readonly byScenario: Partial<
    Record<AiBenchmarkScenarioId, AiRecruitPlannerComparisons>
  >;
  readonly byProfile: Partial<
    Record<AiStrategyId, AiRecruitPlannerComparisons>
  >;
  readonly byScenarioProfile: Partial<
    Record<
      AiBenchmarkScenarioId,
      Partial<Record<AiStrategyId, AiRecruitPlannerComparisons>>
    >
  >;
}

export interface AiPolicySuiteDrawRateComparison {
  /** Number of baseline/candidate game pairs represented by complete clusters. */
  readonly pairedGames: number;
  /** One observation per seed after equally averaging scenario and rotation. */
  readonly seedClusters: number;
  /** Candidate draw rate minus baseline draw rate. */
  readonly meanDelta: number | null;
  readonly confidence95: { readonly lower: number; readonly upper: number } | null;
  readonly nonInferiorityMargin: typeof AI_POLICY_SUITE_DRAW_RATE_NON_INFERIORITY_MARGIN;
}

export interface AiPolicySuiteRunnerFailure {
  readonly seed: number;
  readonly scenarioId: AiBenchmarkScenarioId | null;
  readonly rotation: number | null;
  readonly arm: "baseline" | "candidate" | "provenance";
  readonly message: string;
}

export interface AiPolicySuiteBenchmarkResult {
  readonly method: "paired-seven-profile-suite-v1";
  readonly benchmarkVersion: typeof AI_POLICY_SUITE_BENCHMARK_VERSION;
  readonly policyVersion: string;
  readonly policyVersionAfter: string;
  readonly policyVersionStable: boolean;
  readonly contentVersion: string | null;
  readonly contentSnapshotSha256: string;
  readonly contentSnapshotSha256After: string;
  readonly contentSnapshotStable: boolean;
  readonly evaluatorHash: string;
  readonly evaluatorHashAfter: string;
  readonly evaluatorStable: boolean;
  readonly strategyProfileHash: string;
  readonly strategyProfileHashAfter: string;
  readonly strategyProfilesStable: boolean;
  readonly candidateProfileHash: string;
  readonly candidateProfileHashAfter: string | null;
  readonly candidateProfilesStable: boolean;
  readonly strategyProfiles: readonly AiPolicySuiteProfileSnapshot[];
  readonly candidateProfiles: readonly AiPolicySuiteProfileSnapshot[];
  readonly residualPolicyIdentities: Partial<
    Record<AiPolicySuitePlayerId, { policyId: string; policyVersion: string }>
  >;
  readonly config: {
    readonly seeds: number;
    readonly startSeed: number;
    readonly maxRounds: number;
    readonly initialHealth: number;
    readonly scenarioIds: readonly AiBenchmarkScenarioId[];
    readonly rotations: typeof AI_POLICY_SUITE_ROTATIONS;
    readonly scoredPlayerIds: typeof AI_POLICY_SUITE_PLAYER_IDS;
    readonly controlPlayerId: typeof CONTROL_PLAYER_ID;
    readonly profileOverridesProvided: boolean;
    readonly residualPolicyProvided: boolean;
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
  readonly baselineDrawnGames: number;
  readonly candidateDrawnGames: number;
  readonly baselineDrawRate: number;
  readonly candidateDrawRate: number;
  readonly drawRateComparison: AiPolicySuiteDrawRateComparison;
  readonly truncatedRuns: number;
  readonly runnerFailures: readonly AiPolicySuiteRunnerFailure[];
  readonly providerDiagnostics: AiResidualPolicyDiagnostics;
  readonly providerErrorTotal: number;
  readonly clusters: readonly AiPolicySuiteSeedCluster[];
  /** Compatibility-style alias for comparisonMatrix.overall. */
  readonly comparisons: AiRecruitPlannerComparisons;
  readonly comparisonMatrix: AiPolicySuiteComparisonMatrix;
  /** True when execution/provenance evidence is complete, independent of quality. */
  readonly evidenceUsable: boolean;
  readonly evidenceReasons: readonly string[];
  readonly promotionGate: AiPolicySuitePromotionGateResult;
  /** Compatibility alias for promotionGate.accepted. */
  readonly accepted: boolean;
  readonly acceptanceReasons: readonly string[];
}

export interface AiPolicySuitePromotionGateResult {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

interface EvaluatorSourceFile {
  readonly relativePath: string;
  readonly url: URL;
}

interface ResidualPolicyIdentity {
  readonly policyId: string;
  readonly policyVersion: string;
}

interface MutableResidualPolicyDiagnostics {
  decisions: number;
  providerCalls: number;
  overridesApplied: number;
  fallbacks: number;
  noProvider: number;
  abstentions: number;
  lowConfidence: number;
  invalidContexts: number;
  invalidProposals: number;
  providerErrors: number;
  asyncProposals: number;
  agreements: number;
  byKind: Record<
    AiResidualMacroKind,
    { decisions: number; overridesApplied: number }
  >;
}

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
  const directory = new URL("generated/", GAME_DIRECTORY);
  const names = readdirSync(directory)
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
  return new URL(names[0], directory);
}

function fileSha256(url: URL): string {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

function computeEvaluatorHash(): string {
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
    "ai-cooperative-cem-selection-attempt.ts",
    "ai-cooperative-cem-selection.ts",
    "ai-cooperative-cem-implementation-integrity.ts",
    "ai-cooperative-cem-implementation-pin.ts",
    "ai-cooperative-cem-protocol-pin.ts",
    "ai-cooperative-cem-registration.ts",
    "ai-policy-evolution.ts",
    "ai-seed-ledger.ts",
    "ai-training-screen-registration.ts",
    "benchmark-ai-recruit-planner.ts",
    "benchmark-ai-policy-suite.ts",
  ]) {
    hash
      .update(`scripts/${relativePath}`)
      .update("\0")
      .update(readFileSync(new URL(`./${relativePath}`, import.meta.url)))
      .update("\0");
  }
  return hash.digest("hex");
}

export const AI_POLICY_SUITE_CONTENT_SNAPSHOT_SHA256 = fileSha256(
  pinnedContentSnapshotUrl(),
);
export const AI_POLICY_SUITE_EVALUATOR_HASH = computeEvaluatorHash();
const CONTENT_SNAPSHOT_SHA256 = AI_POLICY_SUITE_CONTENT_SNAPSHOT_SHA256;
const EVALUATOR_HASH = AI_POLICY_SUITE_EVALUATOR_HASH;

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

function assertNoAmbientOverrides(): void {
  if (hasAnyAiResidualPolicyOverrides()) {
    throw new Error(
      "policy suite benchmark cannot run inside a residual override scope",
    );
  }
  withAiResidualPolicyOverrides(new Map(), () => undefined);
  withAiStrategyProfileOverrides(new Map(), () => undefined);
}

function defaultProfileSnapshots(): AiPolicySuiteProfileSnapshot[] {
  return AI_POLICY_SUITE_PLAYER_IDS.map((playerId) => ({
    playerId,
    profile: Object.freeze({ ...getAiStrategyProfile(playerId) }),
  }));
}

export function computeAiPolicySuiteProfileSnapshotHash(
  snapshots: readonly AiPolicySuiteProfileSnapshot[],
): string {
  return createHash("sha256")
    .update(JSON.stringify(snapshots))
    .digest("hex");
}

function snapshotProfileOverrides(
  value: ReadonlyMap<string, AiStrategyProfile> | undefined,
): Map<AiPolicySuitePlayerId, AiStrategyProfile> | null {
  if (value === undefined) return null;
  if (!(value instanceof Map)) {
    throw new TypeError("candidate profileOverrides must be a Map");
  }
  if (value.size !== AI_POLICY_SUITE_PLAYER_IDS.length) {
    throw new RangeError(
      "candidate profileOverrides must contain exactly player-1 through player-7",
    );
  }
  const snapshot = new Map<AiPolicySuitePlayerId, AiStrategyProfile>();
  for (const playerId of AI_POLICY_SUITE_PLAYER_IDS) {
    const profile = value.get(playerId);
    if (profile === undefined) {
      throw new RangeError(`candidate profileOverrides is missing ${playerId}`);
    }
    const expected = getAiStrategyProfile(playerId);
    if (profile.id !== expected.id) {
      throw new RangeError(
        `${playerId} requires strategy ${expected.id}, received ${String(profile.id)}`,
      );
    }
    snapshot.set(playerId, Object.freeze({ ...profile }));
  }
  return snapshot;
}

function effectiveCandidateProfiles(
  defaults: readonly AiPolicySuiteProfileSnapshot[],
  overrides: ReadonlyMap<AiPolicySuitePlayerId, AiStrategyProfile> | null,
): AiPolicySuiteProfileSnapshot[] {
  return defaults.map(({ playerId, profile }) => ({
    playerId,
    profile: overrides?.get(playerId) ?? profile,
  }));
}

export function computeAiPolicySuiteDefaultProfileHash(): string {
  return computeAiPolicySuiteProfileSnapshotHash(defaultProfileSnapshots());
}

export function computeAiPolicySuiteCandidateProfileHash(
  overrides: ReadonlyMap<string, AiStrategyProfile>,
): string {
  const snapshot = snapshotProfileOverrides(overrides);
  if (snapshot === null) {
    throw new TypeError("candidate profile overrides are required");
  }
  return computeAiPolicySuiteProfileSnapshotHash(
    effectiveCandidateProfiles(defaultProfileSnapshots(), snapshot),
  );
}

export interface AiCooperativeCemTrainingBenchmarkContractInput {
  readonly candidate: AiPolicySuiteCandidate;
  readonly seeds: number;
  readonly startSeed: number;
  readonly maxRounds: number;
  readonly initialHealth: number;
  readonly scenarioIds: readonly AiBenchmarkScenarioId[];
  readonly reservationId: string | undefined;
  readonly reservationMode: AiBenchmarkSeedReservationMode | undefined;
  readonly reservationProtocolSha256: string | undefined;
  readonly reservationImplementationSha256: string | undefined;
  readonly reservationConfirmation: string | undefined;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function assertOnlyRegisteredFocusGenesDiffer(
  overrides: ReadonlyMap<AiPolicySuitePlayerId, AiStrategyProfile>,
): void {
  const focusPlayerId = AI_COOPERATIVE_CEM_REGISTRATION.focus
    .playerId as AiPolicySuitePlayerId;
  const geneValues = new Map<string, ReadonlySet<number>>(
    AI_COOPERATIVE_CEM_REGISTRATION.genes.map((gene) => [
      gene.name,
      new Set<number>(gene.values),
    ]),
  );
  const geneNames: ReadonlySet<string> = new Set(geneValues.keys());

  for (const playerId of AI_POLICY_SUITE_PLAYER_IDS) {
    const baseline = getAiStrategyProfile(playerId);
    const candidate = overrides.get(playerId);
    if (!candidate) {
      throw new RangeError(`cooperative CEM candidate is missing ${playerId}`);
    }
    const baselineKeys = Object.keys(baseline).sort();
    const candidateKeys = Object.keys(candidate).sort();
    if (!arraysEqual(baselineKeys, candidateKeys)) {
      throw new TypeError(
        `cooperative CEM ${playerId} profile keys must match production`,
      );
    }
    for (const key of baselineKeys) {
      const baselineValue = baseline[key as keyof AiStrategyProfile];
      const candidateValue = candidate[key as keyof AiStrategyProfile];
      if (playerId === focusPlayerId && geneNames.has(key)) {
        const allowed = geneValues.get(key);
        if (typeof candidateValue !== "number" || !allowed?.has(candidateValue)) {
          throw new RangeError(
            `cooperative CEM ${playerId}.${key} is outside the registered grid`,
          );
        }
      } else if (!Object.is(candidateValue, baselineValue)) {
        throw new RangeError(
          `cooperative CEM may only change registered genes on ${focusPlayerId}; ${playerId}.${key} drifted`,
        );
      }
    }
  }
}

/**
 * Preserves the completed training protocol's candidate-scope validation for
 * historical tests and evidence review without granting seed access.
 */
export function assertAiCooperativeCemHistoricalCandidateScope(
  candidate: AiPolicySuiteCandidate,
): void {
  if (candidate.createResidualPolicy !== undefined) {
    throw new TypeError(
      "cooperative CEM training does not permit residual policy overrides",
    );
  }
  const overrides = snapshotProfileOverrides(candidate.profileOverrides);
  if (overrides === null) {
    throw new TypeError(
      "cooperative CEM training requires complete profile overrides",
    );
  }
  assertOnlyRegisteredFocusGenesDiffer(overrides);
}

/**
 * Fail-closed contract for the only capability allowed to execute the fresh
 * cooperative-CEM training interval. This is exported so tests can validate a
 * legitimate request without running or observing any reserved game seed.
 */
export function assertAiCooperativeCemTrainingBenchmarkContract(
  input: AiCooperativeCemTrainingBenchmarkContractInput,
): void {
  if (
    input.reservationId !== AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID ||
    input.reservationMode !== AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE ||
    input.reservationProtocolSha256 !== AI_COOPERATIVE_CEM_PROTOCOL_SHA256 ||
    input.reservationImplementationSha256 !==
      AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256 ||
    input.reservationConfirmation !==
      AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION
  ) {
    throw new Error("cooperative CEM training capability does not match registration");
  }
  assertAiCooperativeCemImplementationPinned();
  const registered = AI_COOPERATIVE_CEM_REGISTRATION;
  const productionFocus = getAiStrategyProfile(registered.focus.playerId);
  if (productionFocus.id !== registered.focus.strategyId) {
    throw new Error(
      "cooperative CEM focus strategy does not match production player profile",
    );
  }
  for (const gene of registered.genes) {
    if (
      productionFocus[gene.name as keyof AiStrategyProfile] !==
      registered.initialIncumbent[
        gene.name as keyof typeof registered.initialIncumbent
      ]
    ) {
      throw new Error(
        `cooperative CEM initial incumbent drifted at ${gene.name}`,
      );
    }
  }
  if (
    !arraysEqual(registered.candidateScope.mutablePlayerIds, [
      registered.focus.playerId,
    ]) ||
    !arraysEqual(registered.candidateScope.mutableStrategyIds, [productionFocus.id]) ||
    !arraysEqual(
      registered.candidateScope.mutableGenes,
      registered.genes.map((gene) => gene.name),
    )
  ) {
    throw new Error("cooperative CEM candidate scope registration is inconsistent");
  }
  if (
    input.startSeed !== registered.phases.training.startSeed ||
    input.seeds !== registered.phases.training.seeds ||
    input.maxRounds !== registered.benchmark.maxRounds ||
    input.initialHealth !== registered.benchmark.initialHealth ||
    !arraysEqual(input.scenarioIds, registered.benchmark.scenarioIds) ||
    !arraysEqual(AI_POLICY_SUITE_ROTATIONS, registered.benchmark.rotations) ||
    !arraysEqual(
      AI_POLICY_SUITE_PLAYER_IDS,
      registered.benchmark.scoredPlayerIds,
    )
  ) {
    throw new Error(
      "cooperative CEM training benchmark configuration does not match registration",
    );
  }
  assertAiCooperativeCemHistoricalCandidateScope(input.candidate);
}

function rotateHeadlessSeats(state: GameState, rotation: number): void {
  if (
    state.players.length !== AI_POLICY_SUITE_ROTATIONS.length ||
    !AI_POLICY_SUITE_ROTATIONS.includes(
      rotation as (typeof AI_POLICY_SUITE_ROTATIONS)[number],
    )
  ) {
    throw new Error(`invalid policy suite seat rotation ${rotation}`);
  }
  const playerIds = state.players.map((player) => player.id);
  for (let index = 0; index < state.players.length; index += 1) {
    state.players[index].id =
      playerIds[(index + rotation) % playerIds.length];
  }
  if (!state.players.some((player) => player.id === CONTROL_PLAYER_ID)) {
    throw new Error("policy suite control player is missing after rotation");
  }
  state.humanPlayerId = CONTROL_PLAYER_ID;
}

function alivePlayerCount(state: GameState): number {
  return state.players.filter((player) => player.alive).length;
}

function profileOutcome(
  state: GameState,
  playerId: AiPolicySuitePlayerId,
  profileId: AiStrategyId,
): AiPolicySuiteProfileOutcome {
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
  profiles: readonly AiPolicySuiteProfileSnapshot[],
  providerDiagnostics: AiResidualPolicyDiagnostics | null,
): AiPolicySuiteGameRun {
  const completed = state.phase === "gameOver";
  const outcomes: Partial<
    Record<AiStrategyId, AiPolicySuiteProfileOutcome>
  > = {};
  for (const { playerId, profile } of profiles) {
    outcomes[profile.id] = profileOutcome(state, playerId, profile.id);
  }
  return {
    completed,
    drawn: completed && state.winnerId === null,
    truncated: !completed,
    finalRound: state.round,
    alivePlayers: alivePlayerCount(state),
    winnerPlayerId: completed ? state.winnerId : null,
    contentVersion: state.contentVersion,
    profiles: outcomes,
    providerDiagnostics,
    failure: null,
  };
}

function failedGameRun(message: string): AiPolicySuiteGameRun {
  return {
    completed: false,
    drawn: false,
    truncated: false,
    finalRound: null,
    alivePlayers: null,
    winnerPlayerId: null,
    contentVersion: null,
    profiles: {},
    providerDiagnostics: null,
    failure: message,
  };
}

function emptyDiagnostics(): MutableResidualPolicyDiagnostics {
  return {
    decisions: 0,
    providerCalls: 0,
    overridesApplied: 0,
    fallbacks: 0,
    noProvider: 0,
    abstentions: 0,
    lowConfidence: 0,
    invalidContexts: 0,
    invalidProposals: 0,
    providerErrors: 0,
    asyncProposals: 0,
    agreements: 0,
    byKind: {
      upgrade: { decisions: 0, overridesApplied: 0 },
      refresh: { decisions: 0, overridesApplied: 0 },
      freeze: { decisions: 0, overridesApplied: 0 },
    },
  };
}

const DIAGNOSTIC_COUNTERS = [
  "decisions",
  "providerCalls",
  "overridesApplied",
  "fallbacks",
  "noProvider",
  "abstentions",
  "lowConfidence",
  "invalidContexts",
  "invalidProposals",
  "providerErrors",
  "asyncProposals",
  "agreements",
] as const satisfies ReadonlyArray<keyof AiResidualPolicyDiagnostics>;

function aggregateDiagnostics(
  runs: readonly AiPolicySuiteGameRun[],
): AiResidualPolicyDiagnostics {
  const total = emptyDiagnostics();
  for (const run of runs) {
    const diagnostics = run.providerDiagnostics;
    if (!diagnostics) continue;
    for (const counter of DIAGNOSTIC_COUNTERS) {
      total[counter] += diagnostics[counter] as number;
    }
    for (const kind of [
      "upgrade",
      "refresh",
      "freeze",
    ] as const satisfies readonly AiResidualMacroKind[]) {
      total.byKind[kind].decisions += diagnostics.byKind[kind].decisions;
      total.byKind[kind].overridesApplied +=
        diagnostics.byKind[kind].overridesApplied;
    }
  }
  return total;
}

function providerErrorCount(
  diagnostics: AiResidualPolicyDiagnostics | null,
): number {
  if (!diagnostics) return 0;
  return (
    diagnostics.providerErrors +
    diagnostics.invalidContexts +
    diagnostics.invalidProposals +
    diagnostics.asyncProposals +
    diagnostics.noProvider
  );
}

function validatePolicy(policy: unknown): asserts policy is AiResidualPolicy {
  if (
    policy === null ||
    typeof policy !== "object" ||
    typeof (policy as Partial<AiResidualPolicy>).policyId !== "string" ||
    (policy as Partial<AiResidualPolicy>).policyId?.length === 0 ||
    typeof (policy as Partial<AiResidualPolicy>).policyVersion !== "string" ||
    (policy as Partial<AiResidualPolicy>).policyVersion?.length === 0 ||
    typeof (policy as Partial<AiResidualPolicy>).propose !== "function"
  ) {
    throw new TypeError("candidate residual factory returned an invalid policy");
  }
}

function createEpisodePolicies(
  factory: NonNullable<AiPolicySuiteCandidate["createResidualPolicy"]>,
  episode: Readonly<AiPolicySuiteEpisodeContext>,
  seenPolicies: WeakSet<object>,
  identities: Map<AiPolicySuitePlayerId, ResidualPolicyIdentity>,
): Map<AiPolicySuitePlayerId, AiResidualPolicy> {
  const policies = new Map<AiPolicySuitePlayerId, AiResidualPolicy>();
  for (const playerId of AI_POLICY_SUITE_PLAYER_IDS) {
    const policy = factory(playerId, episode);
    validatePolicy(policy);
    if (seenPolicies.has(policy)) {
      throw new Error(
        "candidate residual factory must return a fresh episode-local provider",
      );
    }
    seenPolicies.add(policy);
    const expected = identities.get(playerId);
    if (
      expected &&
      (expected.policyId !== policy.policyId ||
        expected.policyVersion !== policy.policyVersion)
    ) {
      throw new Error(`candidate residual identity drifted for ${playerId}`);
    }
    if (!expected) {
      identities.set(playerId, {
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
      });
    }
    policies.set(playerId, policy);
  }
  return policies;
}

function assertPolicyIdentities(
  policies: ReadonlyMap<AiPolicySuitePlayerId, AiResidualPolicy>,
  identities: ReadonlyMap<AiPolicySuitePlayerId, ResidualPolicyIdentity>,
): void {
  for (const [playerId, policy] of policies) {
    const expected = identities.get(playerId);
    if (
      !expected ||
      expected.policyId !== policy.policyId ||
      expected.policyVersion !== policy.policyVersion
    ) {
      throw new Error(
        `candidate residual identity changed during the episode for ${playerId}`,
      );
    }
  }
}

function suitePairKey(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  rotation: number,
  profileId: AiStrategyId,
): string {
  return `${createAiBenchmarkPairKey(
    seed,
    scenarioId,
    "rotation",
    rotation,
  )}|profile:${profileId}`;
}

function exactPlacement(bounds: PlacementBounds | null): number | null {
  return bounds?.exact === true ? bounds.best : null;
}

function buildPair(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  rotation: number,
  profile: AiPolicySuiteProfileSnapshot,
  baseline: AiPolicySuiteGameRun,
  candidate: AiPolicySuiteGameRun,
  pairKeyUnique: boolean,
): AiPolicySuitePair {
  const baselineOutcome = baseline.profiles[profile.profile.id] ?? null;
  const candidateOutcome = candidate.profiles[profile.profile.id] ?? null;
  const baselinePlacement = exactPlacement(
    baselineOutcome?.placementBounds ?? null,
  );
  const candidatePlacement = exactPlacement(
    candidateOutcome?.placementBounds ?? null,
  );
  const usable =
    pairKeyUnique &&
    baseline.failure === null &&
    candidate.failure === null &&
    baseline.completed &&
    candidate.completed &&
    !baseline.truncated &&
    !candidate.truncated &&
    providerErrorCount(candidate.providerDiagnostics) === 0 &&
    baselinePlacement !== null &&
    candidatePlacement !== null &&
    baselineOutcome?.topFour !== null &&
    baselineOutcome?.topFour !== undefined &&
    candidateOutcome?.topFour !== null &&
    candidateOutcome?.topFour !== undefined &&
    baselineOutcome.win !== null &&
    candidateOutcome.win !== null;
  return {
    pairKey: suitePairKey(seed, scenarioId, rotation, profile.profile.id),
    seed,
    scenarioId,
    rotation,
    playerId: profile.playerId,
    profileId: profile.profile.id,
    baselinePlacementBounds: baselineOutcome?.placementBounds ?? null,
    candidatePlacementBounds: candidateOutcome?.placementBounds ?? null,
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

function isCompletePair(pair: AiPolicySuitePair): boolean {
  return [pair.placementDelta, pair.topFourDelta, pair.winDelta].every(
    (value) => value !== null && Number.isFinite(value),
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isCompleteDrawEpisode(episode: AiPolicySuiteEpisode): boolean {
  return (
    episode.baseline.completed &&
    episode.candidate.completed &&
    !episode.baseline.truncated &&
    !episode.candidate.truncated &&
    episode.baseline.failure === null &&
    episode.candidate.failure === null
  );
}

function buildDrawRateComparison(
  clusters: readonly AiPolicySuiteSeedCluster[],
  expectedEpisodesPerSeed: number,
): AiPolicySuiteDrawRateComparison {
  const metrics: AiRecruitPlannerSeedMetric[] = [];
  let pairedGames = 0;
  for (const cluster of clusters) {
    const completeEpisodes = cluster.episodes.filter(isCompleteDrawEpisode);
    pairedGames += completeEpisodes.length;
    const episodeKeys = cluster.episodes.map(
      (episode) => `${episode.scenarioId}|${episode.rotation}`,
    );
    if (
      cluster.episodes.length !== expectedEpisodesPerSeed ||
      new Set(episodeKeys).size !== expectedEpisodesPerSeed ||
      completeEpisodes.length !== expectedEpisodesPerSeed
    ) {
      continue;
    }
    const delta = mean(
      cluster.episodes.map(
        (episode) =>
          Number(episode.candidate.drawn) - Number(episode.baseline.drawn),
      ),
    );
    metrics.push({
      seed: cluster.seed,
      placementDelta: delta,
      topFourDelta: delta,
      winDelta: delta,
    });
  }
  const metric = summarizeAiRecruitPlannerSeedMetrics(
    metrics,
    pairedGames,
  ).placement;
  return {
    pairedGames: metric.pairedSeats,
    seedClusters: metric.seedClusters,
    meanDelta: metric.meanDelta,
    confidence95: metric.confidence95,
    nonInferiorityMargin:
      AI_POLICY_SUITE_DRAW_RATE_NON_INFERIORITY_MARGIN,
  };
}

export function isAiPolicySuiteDrawRateNonInferior(
  comparison: AiPolicySuiteDrawRateComparison,
): boolean {
  return (
    comparison.confidence95 === null ||
    comparison.confidence95.upper <= comparison.nonInferiorityMargin
  );
}

function seedMetricFromPairs(
  seed: number,
  pairs: readonly AiPolicySuitePair[],
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
  clusters: readonly AiPolicySuiteSeedCluster[],
  selectPairs: (
    cluster: AiPolicySuiteSeedCluster,
  ) => readonly AiPolicySuitePair[],
  expectedPairsPerSeed: number,
): AiRecruitPlannerComparisons {
  const metrics: AiRecruitPlannerSeedMetric[] = [];
  let pairedPairs = 0;
  for (const cluster of clusters) {
    const pairs = selectPairs(cluster);
    pairedPairs += pairs.filter(isCompletePair).length;
    const metric = seedMetricFromPairs(
      cluster.seed,
      pairs,
      expectedPairsPerSeed,
    );
    if (metric) metrics.push(metric);
  }
  return summarizeAiRecruitPlannerSeedMetrics(metrics, pairedPairs);
}

function buildComparisonMatrix(
  clusters: readonly AiPolicySuiteSeedCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[],
  profileIds: readonly AiStrategyId[],
): AiPolicySuiteComparisonMatrix {
  const rotations = AI_POLICY_SUITE_ROTATIONS.length;
  const overall = summarizeStratum(
    clusters,
    (cluster) => cluster.pairs,
    scenarioIds.length * rotations * profileIds.length,
  );
  const byScenario: AiPolicySuiteComparisonMatrix["byScenario"] = {};
  const byProfile: AiPolicySuiteComparisonMatrix["byProfile"] = {};
  const byScenarioProfile: AiPolicySuiteComparisonMatrix["byScenarioProfile"] =
    {};

  for (const scenarioId of scenarioIds) {
    byScenario[scenarioId] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.scenarioId === scenarioId),
      rotations * profileIds.length,
    );
    const cells: Partial<
      Record<AiStrategyId, AiRecruitPlannerComparisons>
    > = {};
    for (const profileId of profileIds) {
      cells[profileId] = summarizeStratum(
        clusters,
        (cluster) =>
          cluster.pairs.filter(
            (pair) =>
              pair.scenarioId === scenarioId &&
              pair.profileId === profileId,
          ),
        rotations,
      );
    }
    byScenarioProfile[scenarioId] = cells;
  }

  for (const profileId of profileIds) {
    byProfile[profileId] = summarizeStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.profileId === profileId),
      scenarioIds.length * rotations,
    );
  }

  return { overall, byScenario, byProfile, byScenarioProfile };
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

function appendReason(
  reasons: string[],
  condition: boolean,
  reason: string,
): void {
  if (!condition && !reasons.includes(reason)) reasons.push(reason);
}

export function evaluateAiPolicySuitePromotionGate(input: {
  readonly seeds: number;
  readonly evidenceUsable: boolean;
  readonly comparisons: AiRecruitPlannerComparisons;
  readonly byProfile: Partial<
    Record<AiStrategyId, AiRecruitPlannerComparisons>
  >;
  readonly profileIds: readonly AiStrategyId[];
}): AiPolicySuitePromotionGateResult {
  const reasons: string[] = [];
  appendReason(
    reasons,
    input.evidenceUsable,
    "requires complete and provenance-stable benchmark evidence",
  );
  appendReason(
    reasons,
    Number.isSafeInteger(input.seeds) &&
      input.seeds >= AI_POLICY_SUITE_MINIMUM_PROMOTION_SEEDS,
    `requires at least ${AI_POLICY_SUITE_MINIMUM_PROMOTION_SEEDS} seed clusters`,
  );

  const { placement, topFour, win } = input.comparisons;
  appendReason(
    reasons,
    placement.meanDelta !== null &&
      placement.meanDelta <= -AI_POLICY_SUITE_MINIMUM_PLACEMENT_IMPROVEMENT,
    `mean placement delta must be at most -${AI_POLICY_SUITE_MINIMUM_PLACEMENT_IMPROVEMENT.toFixed(2)}`,
  );
  appendReason(
    reasons,
    placement.confidence95 !== null && placement.confidence95.upper < 0,
    "placement CI upper bound must be below 0",
  );
  appendReason(
    reasons,
    topFour.confidence95 !== null &&
      topFour.confidence95.lower >=
        -AI_POLICY_SUITE_TOP_FOUR_NON_INFERIORITY_MARGIN,
    `top-four CI lower bound must be at least -${AI_POLICY_SUITE_TOP_FOUR_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );
  appendReason(
    reasons,
    win.confidence95 !== null &&
      win.confidence95.lower >= -AI_POLICY_SUITE_WIN_NON_INFERIORITY_MARGIN,
    `win CI lower bound must be at least -${AI_POLICY_SUITE_WIN_NON_INFERIORITY_MARGIN.toFixed(2)}`,
  );

  for (const profileId of input.profileIds) {
    const comparison = input.byProfile[profileId];
    appendReason(
      reasons,
      comparison?.placement.confidence95 !== null &&
        comparison?.placement.confidence95 !== undefined &&
        comparison.placement.confidence95.upper <=
          AI_POLICY_SUITE_PROFILE_PLACEMENT_NON_INFERIORITY_MARGIN,
      `${profileId} placement CI upper bound must be at most ${AI_POLICY_SUITE_PROFILE_PLACEMENT_NON_INFERIORITY_MARGIN.toFixed(2)}`,
    );
    appendReason(
      reasons,
      comparison?.topFour.confidence95 !== null &&
        comparison?.topFour.confidence95 !== undefined &&
        comparison.topFour.confidence95.lower >=
          -AI_POLICY_SUITE_PROFILE_RATE_NON_INFERIORITY_MARGIN,
      `${profileId} top-four CI lower bound must be at least -${AI_POLICY_SUITE_PROFILE_RATE_NON_INFERIORITY_MARGIN.toFixed(2)}`,
    );
    appendReason(
      reasons,
      comparison?.win.confidence95 !== null &&
        comparison?.win.confidence95 !== undefined &&
        comparison.win.confidence95.lower >=
          -AI_POLICY_SUITE_PROFILE_RATE_NON_INFERIORITY_MARGIN,
      `${profileId} win CI lower bound must be at least -${AI_POLICY_SUITE_PROFILE_RATE_NON_INFERIORITY_MARGIN.toFixed(2)}`,
    );
  }

  return Object.freeze({
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export function runAiPolicySuiteBenchmark(
  options: AiPolicySuiteBenchmarkOptions,
): AiPolicySuiteBenchmarkResult {
  assertNoAmbientOverrides();
  if (
    options.candidate === null ||
    typeof options.candidate !== "object" ||
    Array.isArray(options.candidate)
  ) {
    throw new TypeError("candidate must be an object");
  }
  const profileOverridesProvided =
    options.candidate.profileOverrides !== undefined;
  const residualPolicyProvided =
    options.candidate.createResidualPolicy !== undefined;
  if (!profileOverridesProvided && !residualPolicyProvided) {
    throw new TypeError(
      "candidate requires profileOverrides or createResidualPolicy",
    );
  }
  if (
    residualPolicyProvided &&
    typeof options.candidate.createResidualPolicy !== "function"
  ) {
    throw new TypeError("candidate createResidualPolicy must be a function");
  }

  const seeds = positiveInteger(options.seeds, DEFAULTS.seeds, "seeds");
  const startSeed = options.startSeed ?? DEFAULTS.startSeed;
  if (
    !Number.isSafeInteger(startSeed) ||
    !Number.isSafeInteger(startSeed + seeds - 1)
  ) {
    throw new RangeError("scheduled seeds must be safe integers");
  }
  const selectionReservationRequested =
    options.reservationMode ===
    AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE;
  if (
    options.selectionAttemptToken !== undefined &&
    !selectionReservationRequested
  ) {
    throw new TypeError(
      "a cooperative CEM selection attempt token may only authorize its selection reservation",
    );
  }
  assertAiBenchmarkSeedAccess({
    startSeed,
    seeds,
    reservationId: options.reservationId,
    reservationMode: options.reservationMode,
    reservationProtocolSha256: options.reservationProtocolSha256,
    reservationImplementationSha256:
      options.reservationImplementationSha256,
    reservationConfirmation: options.reservationConfirmation,
    reservationTrainingResultSha256:
      options.reservationTrainingResultSha256,
  });
  if (selectionReservationRequested) {
    consumeAiCooperativeCemSelectionBenchmarkToken(
      options.selectionAttemptToken,
    );
  }
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

  const strategyProfiles = defaultProfileSnapshots();
  const strategyProfileHash =
    computeAiPolicySuiteProfileSnapshotHash(strategyProfiles);
  const profileIds = strategyProfiles.map((snapshot) => snapshot.profile.id);
  if (new Set(profileIds).size !== AI_POLICY_SUITE_PLAYER_IDS.length) {
    throw new Error("policy suite requires seven unique scored profiles");
  }
  const profileOverrides = snapshotProfileOverrides(
    options.candidate.profileOverrides,
  );
  const candidateProfiles = effectiveCandidateProfiles(
    strategyProfiles,
    profileOverrides,
  );
  const candidateProfileHash =
    computeAiPolicySuiteProfileSnapshotHash(candidateProfiles);
  const policyVersion = AI_POLICY_VERSION;
  if (
    options.reservationMode === AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE
  ) {
    assertAiCooperativeCemTrainingBenchmarkContract({
      candidate: options.candidate,
      seeds,
      startSeed,
      maxRounds,
      initialHealth,
      scenarioIds,
      reservationId: options.reservationId,
      reservationMode: options.reservationMode,
      reservationProtocolSha256: options.reservationProtocolSha256,
      reservationImplementationSha256:
        options.reservationImplementationSha256,
      reservationConfirmation: options.reservationConfirmation,
    });
    if (process.env.NODE_TEST_CONTEXT !== undefined) {
      throw new Error(
        "registered cooperative CEM benchmarks are disabled inside node --test",
      );
    }
  } else if (
    options.reservationMode ===
    AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE
  ) {
    assertAiCooperativeCemSelectionBenchmarkContract({
      candidate: options.candidate,
      seeds,
      startSeed,
      maxRounds,
      initialHealth,
      scenarioIds,
      rotations: AI_POLICY_SUITE_ROTATIONS,
      scoredPlayerIds: AI_POLICY_SUITE_PLAYER_IDS,
      reservationId: options.reservationId,
      reservationMode: options.reservationMode,
      reservationProtocolSha256: options.reservationProtocolSha256,
      reservationImplementationSha256:
        options.reservationImplementationSha256,
      reservationConfirmation: options.reservationConfirmation,
      reservationTrainingResultSha256:
        options.reservationTrainingResultSha256,
      policyVersion,
      contentVersion: CURRENT_ROSTER_VERSION,
      contentSnapshotSha256: CONTENT_SNAPSHOT_SHA256,
      evaluatorHash: EVALUATOR_HASH,
      strategyProfileHash,
      candidateProfileHash,
    });
    if (process.env.NODE_TEST_CONTEXT !== undefined) {
      throw new Error(
        "registered cooperative CEM selection is disabled inside node --test",
      );
    }
  }

  const scheduledRuns =
    seeds * scenarioIds.length * AI_POLICY_SUITE_ROTATIONS.length * 2;
  const expectedPairs =
    seeds *
    scenarioIds.length *
    AI_POLICY_SUITE_ROTATIONS.length *
    profileIds.length;
  const runnerFailures: AiPolicySuiteRunnerFailure[] = [];
  const clusters: AiPolicySuiteSeedCluster[] = [];
  const pairKeys = new Set<string>();
  const seenPolicies = new WeakSet<object>();
  const residualIdentities = new Map<
    AiPolicySuitePlayerId,
    ResidualPolicyIdentity
  >();
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
    rotation: number,
  ): GameState => {
    let state = createAiBenchmarkScenarioGame(
      scenarioId,
      seed,
      initialHealth,
    );
    checkContentVersion(state);
    rotateHeadlessSeats(state, rotation);
    while (state.phase !== "gameOver") {
      if (state.phase === "recruit" && state.round > maxRounds) break;
      state = advanceHeadlessGame(state);
      checkContentVersion(state);
    }
    return state;
  };

  const reportProgress = (
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    rotation: number,
    arm: "baseline" | "candidate",
    run: AiPolicySuiteGameRun,
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
      completed: run.completed,
      failure: run.failure,
    });
  };

  const runCandidate = (
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    rotation: number,
  ): AiPolicySuiteGameRun => {
    const execute = (): AiPolicySuiteGameRun => {
      const factory = options.candidate.createResidualPolicy;
      if (!factory) {
        const state = runGame(seed, scenarioId, rotation);
        return gameRunResult(
          state,
          candidateProfiles,
          emptyDiagnostics(),
        );
      }
      const episode = Object.freeze({ seed, scenarioId, rotation });
      const policies = createEpisodePolicies(
        factory,
        episode,
        seenPolicies,
        residualIdentities,
      );
      const scoped = withAiResidualPolicyOverrides(policies, () =>
        runGame(seed, scenarioId, rotation),
      );
      assertPolicyIdentities(policies, residualIdentities);
      return gameRunResult(
        scoped.result,
        candidateProfiles,
        scoped.diagnostics,
      );
    };
    return profileOverrides
      ? withAiStrategyProfileOverrides(profileOverrides, execute)
      : execute();
  };

  for (let seedOffset = 0; seedOffset < seeds; seedOffset += 1) {
    const seed = startSeed + seedOffset;
    const episodes: AiPolicySuiteEpisode[] = [];
    const clusterPairs: AiPolicySuitePair[] = [];
    for (const scenarioId of scenarioIds) {
      for (const rotation of AI_POLICY_SUITE_ROTATIONS) {
        let baseline: AiPolicySuiteGameRun;
        try {
          baseline = gameRunResult(
            runGame(seed, scenarioId, rotation),
            strategyProfiles,
            null,
          );
        } catch (error) {
          const message = errorMessage(error);
          runnerFailures.push({
            seed,
            scenarioId,
            rotation,
            arm: "baseline",
            message,
          });
          baseline = failedGameRun(message);
        }
        reportProgress(seed, scenarioId, rotation, "baseline", baseline);

        let candidate: AiPolicySuiteGameRun;
        try {
          candidate = runCandidate(seed, scenarioId, rotation);
        } catch (error) {
          const message = errorMessage(error);
          runnerFailures.push({
            seed,
            scenarioId,
            rotation,
            arm: "candidate",
            message,
          });
          candidate = failedGameRun(message);
        }
        reportProgress(seed, scenarioId, rotation, "candidate", candidate);

        const episodePairs: AiPolicySuitePair[] = [];
        for (const profile of strategyProfiles) {
          const pairKey = suitePairKey(
            seed,
            scenarioId,
            rotation,
            profile.profile.id,
          );
          const unique = !pairKeys.has(pairKey);
          if (unique) {
            pairKeys.add(pairKey);
          } else {
            runnerFailures.push({
              seed,
              scenarioId,
              rotation,
              arm: "provenance",
              message: `duplicate policy suite pair key ${pairKey}`,
            });
          }
          episodePairs.push(
            buildPair(
              seed,
              scenarioId,
              rotation,
              profile,
              baseline,
              candidate,
              unique,
            ),
          );
        }
        clusterPairs.push(...episodePairs);
        episodes.push({
          seed,
          scenarioId,
          rotation,
          baseline,
          candidate,
          pairs: episodePairs,
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
          AI_POLICY_SUITE_ROTATIONS.length *
          profileIds.length,
      ),
    });
  }

  const allEpisodes = clusters.flatMap((cluster) => cluster.episodes);
  const baselineRuns = allEpisodes.map((episode) => episode.baseline);
  const candidateRuns = allEpisodes.map((episode) => episode.candidate);
  const allRuns = [...baselineRuns, ...candidateRuns];
  const allPairs = clusters.flatMap((cluster) => cluster.pairs);
  const pairedPairs = allPairs.filter(isCompletePair).length;
  const missingPairs = expectedPairs - pairedPairs;
  const expectedGamesPerArm = scheduledRuns / 2;
  const baselineDrawnGames = baselineRuns.filter((run) => run.drawn).length;
  const candidateDrawnGames = candidateRuns.filter((run) => run.drawn).length;
  const baselineDrawRate = baselineDrawnGames / expectedGamesPerArm;
  const candidateDrawRate = candidateDrawnGames / expectedGamesPerArm;
  const drawRateComparison = buildDrawRateComparison(
    clusters,
    scenarioIds.length * AI_POLICY_SUITE_ROTATIONS.length,
  );
  const truncatedRuns = allRuns.filter((run) => run.truncated).length;
  const providerDiagnostics = aggregateDiagnostics(candidateRuns);
  const providerErrorTotal = providerErrorCount(providerDiagnostics);
  const comparisonMatrix = buildComparisonMatrix(
    clusters,
    scenarioIds,
    profileIds,
  );
  const comparisons = comparisonMatrix.overall;

  const evaluatorHashAfter = computeEvaluatorHash();
  const evaluatorStable = evaluatorHashAfter === EVALUATOR_HASH;
  const contentSnapshotSha256After = fileSha256(pinnedContentSnapshotUrl());
  const contentSnapshotStable =
    contentSnapshotSha256After === CONTENT_SNAPSHOT_SHA256;
  const policyVersionAfter = AI_POLICY_VERSION;
  const policyVersionStable = policyVersionAfter === policyVersion;
  const strategyProfilesAfter = defaultProfileSnapshots();
  const strategyProfileHashAfter =
    computeAiPolicySuiteProfileSnapshotHash(strategyProfilesAfter);
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  let candidateProfileHashAfter: string | null = null;
  try {
    candidateProfileHashAfter = computeAiPolicySuiteProfileSnapshotHash(
      effectiveCandidateProfiles(
        strategyProfilesAfter,
        snapshotProfileOverrides(options.candidate.profileOverrides),
      ),
    );
  } catch (error) {
    runnerFailures.push({
      seed: startSeed,
      scenarioId: null,
      rotation: null,
      arm: "provenance",
      message: `candidate profile drift: ${errorMessage(error)}`,
    });
  }
  const candidateProfilesStable =
    candidateProfileHashAfter === candidateProfileHash;

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
    "requires every seed/scenario/rotation/profile pair",
  );
  appendReason(
    evidenceReasons,
    truncatedRuns === 0,
    "requires zero truncated runs",
  );
  appendReason(
    evidenceReasons,
    drawRateComparison.pairedGames === expectedGamesPerArm &&
      drawRateComparison.seedClusters === seeds,
    "draw-rate comparison requires every game pair and seed cluster",
  );
  appendReason(
    evidenceReasons,
    isAiPolicySuiteDrawRateNonInferior(drawRateComparison),
    `candidate draw-rate CI upper bound must be at most ${AI_POLICY_SUITE_DRAW_RATE_NON_INFERIORITY_MARGIN}`,
  );
  appendReason(
    evidenceReasons,
    providerErrorTotal === 0,
    "requires zero residual provider errors",
  );
  appendReason(
    evidenceReasons,
    evaluatorStable,
    "requires stable evaluator source",
  );
  appendReason(
    evidenceReasons,
    contentSnapshotStable,
    "requires a stable content snapshot",
  );
  appendReason(
    evidenceReasons,
    policyVersionStable,
    "requires a stable AI policy version",
  );
  appendReason(
    evidenceReasons,
    strategyProfilesStable,
    "requires stable baseline strategy profiles",
  );
  appendReason(
    evidenceReasons,
    candidateProfilesStable,
    "requires stable candidate strategy profiles",
  );
  appendReason(
    evidenceReasons,
    comparisonIsComplete(comparisons, seeds, expectedPairs),
    "overall comparison requires every seed cluster and pair",
  );

  for (const scenarioId of scenarioIds) {
    appendReason(
      evidenceReasons,
      comparisonIsComplete(
        comparisonMatrix.byScenario[scenarioId],
        seeds,
        seeds * AI_POLICY_SUITE_ROTATIONS.length * profileIds.length,
      ),
      `${scenarioId} comparison requires every seed cluster and pair`,
    );
    for (const profileId of profileIds) {
      appendReason(
        evidenceReasons,
        comparisonIsComplete(
          comparisonMatrix.byScenarioProfile[scenarioId]?.[profileId],
          seeds,
          seeds * AI_POLICY_SUITE_ROTATIONS.length,
        ),
        `${scenarioId}/${profileId} comparison requires every seed cluster and pair`,
      );
    }
  }
  for (const profileId of profileIds) {
    appendReason(
      evidenceReasons,
      comparisonIsComplete(
        comparisonMatrix.byProfile[profileId],
        seeds,
        seeds * scenarioIds.length * AI_POLICY_SUITE_ROTATIONS.length,
      ),
      `${profileId} comparison requires every seed cluster and pair`,
    );
  }

  const evidenceUsable = evidenceReasons.length === 0;
  const promotionGate = evaluateAiPolicySuitePromotionGate({
    seeds,
    evidenceUsable,
    comparisons,
    byProfile: comparisonMatrix.byProfile,
    profileIds,
  });
  const acceptanceReasons = Object.freeze([
    ...evidenceReasons,
    ...promotionGate.reasons.filter(
      (reason) => !evidenceReasons.includes(reason),
    ),
  ]);

  return {
    method: "paired-seven-profile-suite-v1",
    benchmarkVersion: AI_POLICY_SUITE_BENCHMARK_VERSION,
    policyVersion,
    policyVersionAfter,
    policyVersionStable,
    contentVersion: expectedContentVersion,
    contentSnapshotSha256: CONTENT_SNAPSHOT_SHA256,
    contentSnapshotSha256After,
    contentSnapshotStable,
    evaluatorHash: EVALUATOR_HASH,
    evaluatorHashAfter,
    evaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    candidateProfileHash,
    candidateProfileHashAfter,
    candidateProfilesStable,
    strategyProfiles,
    candidateProfiles,
    residualPolicyIdentities: Object.fromEntries(residualIdentities),
    config: {
      seeds,
      startSeed,
      maxRounds,
      initialHealth,
      scenarioIds,
      rotations: AI_POLICY_SUITE_ROTATIONS,
      scoredPlayerIds: AI_POLICY_SUITE_PLAYER_IDS,
      controlPlayerId: CONTROL_PLAYER_ID,
      profileOverridesProvided,
      residualPolicyProvided,
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
    baselineDrawnGames,
    candidateDrawnGames,
    baselineDrawRate,
    candidateDrawRate,
    drawRateComparison,
    truncatedRuns,
    runnerFailures,
    providerDiagnostics,
    providerErrorTotal,
    clusters,
    comparisons,
    comparisonMatrix,
    evidenceUsable,
    evidenceReasons: Object.freeze(evidenceReasons),
    promotionGate,
    accepted: promotionGate.accepted,
    acceptanceReasons,
  };
}
