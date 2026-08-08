import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

import {
  type AiResidualMacroKind,
  type AiResidualPolicy,
  type AiResidualPolicyDiagnostics,
  type DeepReadonly,
  withAiResidualPolicyOverrides,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_POLICY_VERSION,
  getAiStrategyProfile,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  advanceHeadlessGame,
  type GameState,
} from "../lib/game/engine.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  isValidInitialHealth,
} from "../lib/game/setup.ts";
import {
  AI_RECRUIT_PLANNER_CONTROLLED_SEATS,
  AI_RECRUIT_PLANNER_MINIMUM_GATE_SEEDS,
  conservativePlacementDelta,
  conservativeRateDelta,
  evaluateAiRecruitPlannerGate,
  placementBoundsFromPlacement,
  summarizeAiRecruitPlannerSeedMetrics,
  type AiRecruitPlannerComparisons,
  type AiRecruitPlannerControlledSeat,
  type AiRecruitPlannerSeedMetric,
  type PlacementBounds,
} from "./benchmark-ai-recruit-planner.ts";
import { assertAiBenchmarkSeedAccess } from "./ai-seed-ledger.ts";
import {
  createAiBenchmarkPairKey,
  createAiBenchmarkScenarioGame,
  normalizeAiBenchmarkScenarioIds,
  type AiBenchmarkScenarioId,
} from "./ai-benchmark-scenarios.ts";

export const AI_RESIDUAL_POLICY_BENCHMARK_VERSION = 1 as const;
export const AI_RESIDUAL_POLICY_ARTIFACT_SCHEMA_VERSION = 1 as const;
export const AI_RESIDUAL_POLICY_MINIMUM_GATE_SEEDS =
  AI_RECRUIT_PLANNER_MINIMUM_GATE_SEEDS;
export const AI_RESIDUAL_POLICY_CONTROLLED_SEATS = Object.freeze([
  ...AI_RECRUIT_PLANNER_CONTROLLED_SEATS,
]) as unknown as typeof AI_RECRUIT_PLANNER_CONTROLLED_SEATS;

const DEFAULTS = {
  seeds: 1,
  startSeed: 1,
  maxRounds: 40,
};
const RUNS_PER_SCENARIO_SEED = 8;

export type AiResidualPolicyArtifactJson =
  | null
  | boolean
  | number
  | string
  | readonly AiResidualPolicyArtifactJson[]
  | { readonly [key: string]: AiResidualPolicyArtifactJson };

export interface AiResidualPolicyArtifactSource {
  readonly logicalPath: string;
  readonly url: URL;
}

export interface AiResidualPolicyArtifactManifest {
  readonly sources: readonly AiResidualPolicyArtifactSource[];
  readonly parameters: AiResidualPolicyArtifactJson;
}

export interface AiResidualPolicyBenchmarkOptions {
  /** Creates one fresh, episode-local provider for every candidate run. */
  createPolicy: (
    parameters: DeepReadonly<AiResidualPolicyArtifactJson>,
  ) => AiResidualPolicy;
  /** Sources and parameters from which the evaluator computes policy identity. */
  policyArtifact: AiResidualPolicyArtifactManifest;
  seeds?: number;
  startSeed?: number;
  maxRounds?: number;
  initialHealth?: number;
  /** Defaults to the legacy neutral-v1 evaluator when omitted. */
  scenarioIds?: readonly AiBenchmarkScenarioId[];
  onProgress?: (progress: AiResidualPolicyBenchmarkProgress) => void;
}

export interface AiResidualPolicyBenchmarkProgress {
  processedRuns: number;
  scheduledRuns: number;
  seed: number;
  scenarioId: AiBenchmarkScenarioId;
  kind: "baseline" | "candidate";
  controlledSeat: AiRecruitPlannerControlledSeat | null;
  completed: boolean;
  failure: string | null;
}

export interface AiResidualPolicyProfileSnapshot {
  playerId: string;
  profile: AiStrategyProfile;
}

export interface AiResidualPolicyBenchmarkBaseline {
  scenarioId: AiBenchmarkScenarioId;
  completed: boolean;
  drawn: boolean;
  truncated: boolean;
  finalRound: number | null;
  alivePlayers: number | null;
  contentVersion: string | null;
  seats: ReadonlyArray<{
    seat: AiRecruitPlannerControlledSeat;
    playerId: string;
    placementBounds: PlacementBounds | null;
    /** Actual winner result. Drawn games are false, incomplete runs are null. */
    won: boolean | null;
  }>;
  failure: string | null;
}

export interface AiResidualPolicyBenchmarkCandidate {
  scenarioId: AiBenchmarkScenarioId;
  controlledSeat: AiRecruitPlannerControlledSeat;
  playerId: string;
  strategyId: AiStrategyId;
  completed: boolean;
  drawn: boolean;
  truncated: boolean;
  finalRound: number | null;
  alivePlayers: number | null;
  contentVersion: string | null;
  placementBounds: PlacementBounds | null;
  /** Actual winner result. Drawn games are false, incomplete runs are null. */
  won: boolean | null;
  providerDiagnostics: AiResidualPolicyDiagnostics | null;
  failure: string | null;
}

export interface AiResidualPolicyBenchmarkPair {
  pairKey: string;
  seed: number;
  scenarioId: AiBenchmarkScenarioId;
  seat: AiRecruitPlannerControlledSeat;
  playerId: string;
  strategyId: AiStrategyId;
  baselinePlacementBounds: PlacementBounds | null;
  candidate: AiResidualPolicyBenchmarkCandidate;
  conservativePlacementDelta: number | null;
  conservativeTopFourDelta: number | null;
  conservativeWinDelta: number | null;
}

export interface AiResidualPolicyBenchmarkScenarioCluster {
  scenarioId: AiBenchmarkScenarioId;
  baseline: AiResidualPolicyBenchmarkBaseline;
  pairs: AiResidualPolicyBenchmarkPair[];
  metric: AiRecruitPlannerSeedMetric | null;
}

export interface AiResidualPolicyBenchmarkCluster {
  seed: number;
  /** Compatibility alias for the first configured scenario's baseline. */
  baseline: AiResidualPolicyBenchmarkBaseline;
  /** All scenario-seat pairs for this seed. */
  pairs: AiResidualPolicyBenchmarkPair[];
  /** Equal-weight mean across every configured scenario and profile. */
  metric: AiRecruitPlannerSeedMetric | null;
  scenarios: AiResidualPolicyBenchmarkScenarioCluster[];
}

export interface AiResidualPolicyComparisonMatrix {
  overall: AiRecruitPlannerComparisons;
  byScenario: Partial<
    Record<AiBenchmarkScenarioId, AiRecruitPlannerComparisons>
  >;
  byProfile: Partial<Record<AiStrategyId, AiRecruitPlannerComparisons>>;
  byScenarioProfile: Partial<
    Record<
      AiBenchmarkScenarioId,
      Partial<Record<AiStrategyId, AiRecruitPlannerComparisons>>
    >
  >;
}

export interface AiResidualPolicyCoverage {
  overrides: number;
  providerCalls: number;
  rate: number | null;
}

export interface AiResidualPolicyAbstentionSummary {
  abstentions: number;
  providerCalls: number;
  rate: number | null;
}

export interface AiResidualPolicyErrorSummary {
  providerErrors: number;
  invalidContexts: number;
  invalidProposals: number;
  asyncProposals: number;
  noProvider: number;
  total: number;
}

export interface AiResidualPolicyBenchmarkResult {
  method: "deployment-seat-paired-residual-v1";
  benchmarkVersion: typeof AI_RESIDUAL_POLICY_BENCHMARK_VERSION;
  contentVersion: string | null;
  policyVersion: string;
  residualPolicy: {
    policyId: string | null;
    policyVersion: string | null;
    codeSha256: string;
    parametersSha256: string;
    policyArtifactSha256: string | null;
    sourceStable: boolean;
    parametersStable: boolean;
    artifactStable: boolean;
  };
  contentSnapshotSha256: string;
  evaluatorHash: string;
  evaluatorHashAfter: string;
  evaluatorStable: boolean;
  strategyProfileHash: string;
  strategyProfileHashAfter: string;
  strategyProfilesStable: boolean;
  strategyProfiles: AiResidualPolicyProfileSnapshot[];
  config: {
    seeds: number;
    startSeed: number;
    maxRounds: number;
    initialHealth: number;
    scenarioIds: readonly AiBenchmarkScenarioId[];
    controlledSeats: typeof AI_RESIDUAL_POLICY_CONTROLLED_SEATS;
  };
  progress: {
    processedRuns: number;
    scheduledRuns: number;
    completedRuns: number;
    failedRuns: number;
  };
  pairedSeats: number;
  missingPairs: number;
  drawnRuns: number;
  truncatedRuns: number;
  runnerFailures: Array<{ seed: number; run: string; message: string }>;
  providerDiagnostics: AiResidualPolicyDiagnostics;
  overrideCoverage: AiResidualPolicyCoverage;
  abstention: AiResidualPolicyAbstentionSummary;
  providerErrors: AiResidualPolicyErrorSummary;
  clusters: AiResidualPolicyBenchmarkCluster[];
  /** Legacy alias for comparisonMatrix.overall. */
  comparisons: AiRecruitPlannerComparisons;
  comparisonMatrix: AiResidualPolicyComparisonMatrix;
  accepted: boolean;
  acceptanceReasons: string[];
}

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
    const url = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directory);
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
      `expected exactly one pinned Battlegrounds content snapshot, found ${names.length}`,
    );
  }
  return new URL(names[0], directory);
}

function fileSha256(url: URL): string {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

interface ValidatedPolicyArtifactSource {
  logicalPath: string;
  urlHref: string;
}

function validateLogicalPath(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new TypeError("policy source logicalPath must be a non-empty string");
  }
  const segments = value.split("/");
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    segments.some((segment) =>
      segment === "" || segment === "." || segment === ".."
    )
  ) {
    throw new TypeError(
      `policy source logicalPath must be a normalized relative POSIX path: ${value}`,
    );
  }
}

function validatedArtifactSources(
  value: unknown,
): ValidatedPolicyArtifactSource[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("policyArtifact.sources must be a non-empty array");
  }
  const logicalPaths = new Set<string>();
  const sources = value.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new TypeError("each policy source must be an object");
    }
    const source = item as Partial<AiResidualPolicyArtifactSource>;
    validateLogicalPath(source.logicalPath);
    if (logicalPaths.has(source.logicalPath)) {
      throw new TypeError(
        `policy source logicalPath must be unique: ${source.logicalPath}`,
      );
    }
    logicalPaths.add(source.logicalPath);
    if (
      !(source.url instanceof URL) ||
      source.url.protocol !== "file:" ||
      source.url.search !== "" ||
      source.url.hash !== ""
    ) {
      throw new TypeError("policy source url must be a plain file: URL");
    }
    return {
      logicalPath: source.logicalPath,
      urlHref: source.url.href,
    };
  });
  return sources.sort((left, right) =>
    compareNames(left.logicalPath, right.logicalPath),
  );
}

function cloneAndFreezeArtifactJson(
  value: unknown,
  ancestors = new WeakSet<object>(),
): DeepReadonly<AiResidualPolicyArtifactJson> {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("policy parameters require finite numbers");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError("policy parameters must contain JSON-only data");
  }
  if (ancestors.has(value)) {
    throw new TypeError("policy parameters cannot contain cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const allowedKeys = new Set<string>(["length"]);
      const clone: AiResidualPolicyArtifactJson[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index);
        allowedKeys.add(key);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (
          descriptor === undefined ||
          descriptor.enumerable !== true ||
          !("value" in descriptor)
        ) {
          throw new TypeError("policy parameters cannot contain sparse arrays");
        }
        clone.push(
          cloneAndFreezeArtifactJson(descriptor.value, ancestors) as
            AiResidualPolicyArtifactJson,
        );
      }
      if (
        Reflect.ownKeys(value).some(
          (key) => typeof key !== "string" || !allowedKeys.has(key),
        )
      ) {
        throw new TypeError(
          "policy parameter arrays cannot contain extra properties",
        );
      }
      return Object.freeze(clone);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("policy parameters require plain objects");
    }
    const clone: Record<string, AiResidualPolicyArtifactJson> = {};
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) {
      throw new TypeError("policy parameters cannot contain symbol keys");
    }
    for (const key of (keys as string[]).sort(compareNames)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        throw new TypeError(
          "policy parameters require enumerable data properties",
        );
      }
      clone[key] = cloneAndFreezeArtifactJson(
        descriptor.value,
        ancestors,
      ) as AiResidualPolicyArtifactJson;
    }
    return Object.freeze(clone);
  } finally {
    ancestors.delete(value);
  }
}

function canonicalArtifactJson(value: AiResidualPolicyArtifactJson): string {
  if (value === null) return "null";
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalArtifactJson).join(",")}]`;
  }
  const record = value as Readonly<
    Record<string, AiResidualPolicyArtifactJson>
  >;
  return `{${Object.keys(record)
    .sort(compareNames)
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalArtifactJson(record[key])}`,
    )
    .join(",")}}`;
}

function artifactParametersSha256(
  parameters: DeepReadonly<AiResidualPolicyArtifactJson>,
): string {
  return createHash("sha256")
    .update("hstone-ai-residual-policy-parameters-v1\0")
    .update(canonicalArtifactJson(parameters as AiResidualPolicyArtifactJson))
    .digest("hex");
}

function artifactCodeSha256(
  sources: readonly ValidatedPolicyArtifactSource[],
): string {
  const hash = createHash("sha256").update(
    "hstone-ai-residual-policy-code-v1\0",
  );
  for (const source of sources) {
    const pathBytes = Buffer.from(source.logicalPath, "utf8");
    let sourceBytes: Buffer;
    try {
      sourceBytes = readFileSync(new URL(source.urlHref));
    } catch {
      throw new Error(`unable to read policy source ${source.logicalPath}`);
    }
    hash
      .update(`${pathBytes.byteLength}:`)
      .update(pathBytes)
      .update(`${sourceBytes.byteLength}:`)
      .update(sourceBytes);
  }
  return hash.digest("hex");
}

function policyArtifactSha256(
  identity: ResidualPolicyIdentity,
  codeSha256: string,
  parametersSha256: string,
): string {
  const identityJson: AiResidualPolicyArtifactJson = {
    schemaVersion: AI_RESIDUAL_POLICY_ARTIFACT_SCHEMA_VERSION,
    policyId: identity.policyId,
    policyVersion: identity.policyVersion,
    codeSha256,
    parametersSha256,
  };
  return createHash("sha256")
    .update("hstone-ai-residual-policy-artifact-v1\0")
    .update(canonicalArtifactJson(identityJson))
    .digest("hex");
}

function sourceHash(): string {
  const hash = createHash("sha256");
  for (const source of evaluatorSourceFiles(GAME_DIRECTORY)) {
    hash
      .update(`lib/game/${source.relativePath}`)
      .update("\0")
      .update(readFileSync(source.url))
      .update("\0");
  }
  return hash
    .update("scripts/ai-benchmark-scenarios.ts\0")
    .update(
      readFileSync(new URL("./ai-benchmark-scenarios.ts", import.meta.url)),
    )
    .update("\0scripts/benchmark-ai-recruit-planner.ts\0")
    .update(
      readFileSync(new URL("./benchmark-ai-recruit-planner.ts", import.meta.url)),
    )
    .update("\0scripts/benchmark-ai-residual-policy.ts\0")
    .update(
      readFileSync(new URL("./benchmark-ai-residual-policy.ts", import.meta.url)),
    )
    .digest("hex");
}

const CONTENT_SNAPSHOT_SHA256 = fileSha256(pinnedContentSnapshotUrl());
const EVALUATOR_HASH = sourceHash();

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

function validatePolicy(policy: unknown): asserts policy is AiResidualPolicy {
  if (policy === null || typeof policy !== "object") {
    throw new TypeError("policy must be a valid synchronous residual provider");
  }
  const candidate = policy as Partial<AiResidualPolicy>;
  if (
    typeof candidate.policyId !== "string" ||
    candidate.policyId.length === 0 ||
    typeof candidate.policyVersion !== "string" ||
    candidate.policyVersion.length === 0 ||
    typeof candidate.propose !== "function"
  ) {
    throw new TypeError("policy must be a valid synchronous residual provider");
  }
}

interface ResidualPolicyIdentity {
  policyId: string;
  policyVersion: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createFreshPolicy(
  createPolicy: unknown,
  parameters: DeepReadonly<AiResidualPolicyArtifactJson>,
  seenPolicies: WeakSet<object>,
  expectedIdentity?: ResidualPolicyIdentity,
): AiResidualPolicy {
  if (typeof createPolicy !== "function") {
    throw new TypeError("createPolicy must be a synchronous factory function");
  }
  let policy: unknown;
  try {
    policy = (
      createPolicy as (
        parameters: DeepReadonly<AiResidualPolicyArtifactJson>,
      ) => unknown
    )(parameters);
  } catch (error) {
    throw new Error(`residual policy factory failed: ${errorMessage(error)}`);
  }
  validatePolicy(policy);
  if (seenPolicies.has(policy)) {
    throw new Error("createPolicy must return a fresh provider instance");
  }
  seenPolicies.add(policy);
  if (
    expectedIdentity !== undefined &&
    (policy.policyId !== expectedIdentity.policyId ||
      policy.policyVersion !== expectedIdentity.policyVersion)
  ) {
    throw new Error(
      "residual policy identity differs from the metadata instance",
    );
  }
  return policy;
}

function assertPolicyIdentity(
  policy: AiResidualPolicy,
  expectedIdentity: ResidualPolicyIdentity,
): void {
  if (
    policy.policyId !== expectedIdentity.policyId ||
    policy.policyVersion !== expectedIdentity.policyVersion
  ) {
    throw new Error("residual provider identity changed during the episode");
  }
}

function strategyProfileSnapshots(): AiResidualPolicyProfileSnapshot[] {
  return AI_RESIDUAL_POLICY_CONTROLLED_SEATS.map((seat) => {
    const playerId = `player-${seat}`;
    return {
      playerId,
      profile: { ...getAiStrategyProfile(playerId) },
    };
  });
}

function profileHash(
  profiles: readonly AiResidualPolicyProfileSnapshot[],
): string {
  return createHash("sha256").update(JSON.stringify(profiles)).digest("hex");
}

function runHeadlessGame(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  maxRounds: number,
  initialHealth: number,
): GameState {
  let state = createAiBenchmarkScenarioGame(
    scenarioId,
    seed,
    initialHealth,
  );
  while (state.phase !== "gameOver") {
    if (state.phase === "recruit" && state.round > maxRounds) break;
    state = advanceHeadlessGame(state);
  }
  return state;
}

function alivePlayerCount(state: GameState): number {
  return state.players.filter((player) => player.alive).length;
}

function placementBoundsForSeat(
  state: GameState,
  seat: AiRecruitPlannerControlledSeat,
): PlacementBounds | null {
  const player = state.players[seat];
  if (!player || player.id !== `player-${seat}`) return null;
  const inferredPlacement =
    player.placement ??
    (state.phase === "gameOver" && state.winnerId === player.id ? 1 : undefined);
  if (!player.alive && inferredPlacement === undefined) return null;
  return placementBoundsFromPlacement(
    inferredPlacement,
    alivePlayerCount(state),
  );
}

function baselineSeats(
  state: GameState,
): AiResidualPolicyBenchmarkBaseline["seats"] {
  const completed = state.phase === "gameOver";
  return AI_RESIDUAL_POLICY_CONTROLLED_SEATS.map((seat) => ({
    seat,
    playerId: state.players[seat]?.id ?? `player-${seat}`,
    placementBounds: placementBoundsForSeat(state, seat),
    won: completed ? state.winnerId === `player-${seat}` : null,
  }));
}

function runBaseline(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  maxRounds: number,
  initialHealth: number,
): AiResidualPolicyBenchmarkBaseline {
  const state = runHeadlessGame(
    seed,
    scenarioId,
    maxRounds,
    initialHealth,
  );
  const completed = state.phase === "gameOver";
  return {
    scenarioId,
    completed,
    drawn: completed && state.winnerId === null,
    truncated: !completed,
    finalRound: state.round,
    alivePlayers: alivePlayerCount(state),
    contentVersion: state.contentVersion,
    seats: baselineSeats(state),
    failure: null,
  };
}

function runCandidate(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  controlledSeat: AiRecruitPlannerControlledSeat,
  policy: AiResidualPolicy,
  expectedIdentity: ResidualPolicyIdentity,
  config: { maxRounds: number; initialHealth: number },
): AiResidualPolicyBenchmarkCandidate {
  const playerId = `player-${controlledSeat}`;
  const profile = getAiStrategyProfile(playerId);
  const scopedRun = withAiResidualPolicyOverrides(
    new Map([[playerId, policy]]),
    () =>
      runHeadlessGame(
        seed,
        scenarioId,
        config.maxRounds,
        config.initialHealth,
      ),
  );
  assertPolicyIdentity(policy, expectedIdentity);
  const state = scopedRun.result;
  const completed = state.phase === "gameOver";
  return {
    scenarioId,
    controlledSeat,
    playerId,
    strategyId: profile.id,
    completed,
    drawn: completed && state.winnerId === null,
    truncated: !completed,
    finalRound: state.round,
    alivePlayers: alivePlayerCount(state),
    contentVersion: state.contentVersion,
    placementBounds: placementBoundsForSeat(state, controlledSeat),
    won: completed ? state.winnerId === playerId : null,
    providerDiagnostics: scopedRun.diagnostics,
    failure: null,
  };
}

function failedBaseline(
  scenarioId: AiBenchmarkScenarioId,
  message: string,
): AiResidualPolicyBenchmarkBaseline {
  return {
    scenarioId,
    completed: false,
    drawn: false,
    truncated: false,
    finalRound: null,
    alivePlayers: null,
    contentVersion: null,
    seats: AI_RESIDUAL_POLICY_CONTROLLED_SEATS.map((seat) => ({
      seat,
      playerId: `player-${seat}`,
      placementBounds: null,
      won: null,
    })),
    failure: message,
  };
}

function failedCandidate(
  scenarioId: AiBenchmarkScenarioId,
  seat: AiRecruitPlannerControlledSeat,
  message: string,
): AiResidualPolicyBenchmarkCandidate {
  const playerId = `player-${seat}`;
  return {
    scenarioId,
    controlledSeat: seat,
    playerId,
    strategyId: getAiStrategyProfile(playerId).id,
    completed: false,
    drawn: false,
    truncated: false,
    finalRound: null,
    alivePlayers: null,
    contentVersion: null,
    placementBounds: null,
    won: null,
    providerDiagnostics: null,
    failure: message,
  };
}

export function actualWinnerDelta(
  candidateWon: boolean | null,
  baselineWon: boolean | null,
): number | null {
  if (candidateWon === null || baselineWon === null) return null;
  return Number(candidateWon) - Number(baselineWon);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isCompletePair(
  pair: AiResidualPolicyBenchmarkPair,
): boolean {
  return (
    pair.conservativePlacementDelta !== null &&
    pair.conservativeTopFourDelta !== null &&
    pair.conservativeWinDelta !== null
  );
}

function seedMetricFromPairs(
  seed: number,
  pairs: readonly AiResidualPolicyBenchmarkPair[],
  expectedPairCount: number,
): AiRecruitPlannerSeedMetric | null {
  if (
    pairs.length !== expectedPairCount ||
    new Set(pairs.map((pair) => pair.pairKey)).size !== expectedPairCount ||
    !pairs.every(isCompletePair)
  ) {
    return null;
  }
  return {
    seed,
    placementDelta: mean(
      pairs.map((pair) => pair.conservativePlacementDelta as number),
    ),
    topFourDelta: mean(
      pairs.map((pair) => pair.conservativeTopFourDelta as number),
    ),
    winDelta: mean(
      pairs.map((pair) => pair.conservativeWinDelta as number),
    ),
  };
}

function summarizePairStratum(
  clusters: readonly AiResidualPolicyBenchmarkCluster[],
  selectPairs: (
    cluster: AiResidualPolicyBenchmarkCluster,
  ) => readonly AiResidualPolicyBenchmarkPair[],
  expectedPairsPerSeed: number,
): AiRecruitPlannerComparisons {
  const metrics: AiRecruitPlannerSeedMetric[] = [];
  let pairedSeats = 0;
  for (const cluster of clusters) {
    const pairs = selectPairs(cluster);
    pairedSeats += pairs.filter(isCompletePair).length;
    const metric = seedMetricFromPairs(
      cluster.seed,
      pairs,
      expectedPairsPerSeed,
    );
    if (metric) metrics.push(metric);
  }
  return summarizeAiRecruitPlannerSeedMetrics(metrics, pairedSeats);
}

function buildComparisonMatrix(
  clusters: readonly AiResidualPolicyBenchmarkCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[],
  profileIds: readonly AiStrategyId[],
): AiResidualPolicyComparisonMatrix {
  const overall = summarizePairStratum(
    clusters,
    (cluster) => cluster.pairs,
    scenarioIds.length * profileIds.length,
  );
  const byScenario: AiResidualPolicyComparisonMatrix["byScenario"] = {};
  const byProfile: AiResidualPolicyComparisonMatrix["byProfile"] = {};
  const byScenarioProfile: AiResidualPolicyComparisonMatrix["byScenarioProfile"] =
    {};

  for (const scenarioId of scenarioIds) {
    byScenario[scenarioId] = summarizePairStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.scenarioId === scenarioId),
      profileIds.length,
    );
    const scenarioProfiles: Partial<
      Record<AiStrategyId, AiRecruitPlannerComparisons>
    > = {};
    for (const profileId of profileIds) {
      scenarioProfiles[profileId] = summarizePairStratum(
        clusters,
        (cluster) =>
          cluster.pairs.filter(
            (pair) =>
              pair.scenarioId === scenarioId &&
              pair.strategyId === profileId,
          ),
        1,
      );
    }
    byScenarioProfile[scenarioId] = scenarioProfiles;
  }

  for (const profileId of profileIds) {
    byProfile[profileId] = summarizePairStratum(
      clusters,
      (cluster) =>
        cluster.pairs.filter((pair) => pair.strategyId === profileId),
      scenarioIds.length,
    );
  }

  return { overall, byScenario, byProfile, byScenarioProfile };
}

function completeSeedProfilePairs(
  clusters: readonly AiResidualPolicyBenchmarkCluster[],
  scenarioIds: readonly AiBenchmarkScenarioId[],
  profileIds: readonly AiStrategyId[],
): number {
  let completePairs = 0;
  for (const cluster of clusters) {
    for (const profileId of profileIds) {
      const profilePairs = cluster.pairs.filter(
        (pair) => pair.strategyId === profileId,
      );
      if (
        seedMetricFromPairs(
          cluster.seed,
          profilePairs,
          scenarioIds.length,
        ) !== null
      ) {
        completePairs += 1;
      }
    }
  }
  return completePairs;
}

function withPairedSeats(
  comparisons: AiRecruitPlannerComparisons,
  pairedSeats: number,
): AiRecruitPlannerComparisons {
  return {
    placement: { ...comparisons.placement, pairedSeats },
    topFour: { ...comparisons.topFour, pairedSeats },
    win: { ...comparisons.win, pairedSeats },
  };
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
  candidates: readonly AiResidualPolicyBenchmarkCandidate[],
): AiResidualPolicyDiagnostics {
  const total = emptyDiagnostics();
  for (const candidate of candidates) {
    const diagnostics = candidate.providerDiagnostics;
    if (!diagnostics) continue;
    for (const counter of DIAGNOSTIC_COUNTERS) {
      total[counter] += diagnostics[counter] as number;
    }
    for (const kind of ["upgrade", "refresh", "freeze"] as const satisfies readonly AiResidualMacroKind[]) {
      total.byKind[kind].decisions += diagnostics.byKind[kind].decisions;
      total.byKind[kind].overridesApplied +=
        diagnostics.byKind[kind].overridesApplied;
    }
  }
  return total;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function appendReason(reasons: string[], condition: boolean, reason: string) {
  if (!condition && !reasons.includes(reason)) reasons.push(reason);
}

export function runAiResidualPolicyBenchmark(
  options: AiResidualPolicyBenchmarkOptions,
): AiResidualPolicyBenchmarkResult {
  if (
    options.policyArtifact === null ||
    typeof options.policyArtifact !== "object" ||
    Array.isArray(options.policyArtifact)
  ) {
    throw new TypeError("policyArtifact must be an object manifest");
  }
  const artifactSources = validatedArtifactSources(
    options.policyArtifact.sources,
  );
  const originalParameters = options.policyArtifact.parameters;
  const parametersSnapshot = cloneAndFreezeArtifactJson(originalParameters);
  const codeSha256 = artifactCodeSha256(artifactSources);
  const parametersSha256 = artifactParametersSha256(parametersSnapshot);
  const seeds = positiveInteger(options.seeds, DEFAULTS.seeds, "seeds");
  const startSeed = options.startSeed ?? DEFAULTS.startSeed;
  if (
    !Number.isSafeInteger(startSeed) ||
    !Number.isSafeInteger(startSeed + seeds - 1)
  ) {
    throw new RangeError("scheduled seeds must be safe integers");
  }
  assertAiBenchmarkSeedAccess({ startSeed, seeds });
  const scenarioIds = normalizeAiBenchmarkScenarioIds(options.scenarioIds);
  const config = {
    seeds,
    startSeed,
    maxRounds: positiveInteger(
      options.maxRounds,
      DEFAULTS.maxRounds,
      "maxRounds",
    ),
    initialHealth: options.initialHealth ?? DEFAULT_INITIAL_HEALTH,
    scenarioIds,
    controlledSeats: AI_RESIDUAL_POLICY_CONTROLLED_SEATS,
  };
  if (!isValidInitialHealth(config.initialHealth)) {
    throw new RangeError("initialHealth must be an integer from 1 to 999");
  }

  const runnerFailures: Array<{
    seed: number;
    run: string;
    message: string;
  }> = [];
  const seenPolicies = new WeakSet<object>();
  let policyIdentity: ResidualPolicyIdentity | null = null;
  try {
    const metadataPolicy = createFreshPolicy(
      options.createPolicy,
      parametersSnapshot,
      seenPolicies,
    );
    policyIdentity = {
      policyId: metadataPolicy.policyId,
      policyVersion: metadataPolicy.policyVersion,
    };
  } catch (error) {
    runnerFailures.push({
      seed: startSeed,
      run: "provider-metadata",
      message: errorMessage(error),
    });
  }
  const initialPolicyArtifactSha256 =
    policyIdentity === null
      ? null
      : policyArtifactSha256(
          policyIdentity,
          codeSha256,
          parametersSha256,
        );
  const strategyProfiles = strategyProfileSnapshots();
  const profileIds = strategyProfiles.map((snapshot) => snapshot.profile.id);
  if (new Set(profileIds).size !== AI_RESIDUAL_POLICY_CONTROLLED_SEATS.length) {
    throw new Error("residual benchmark requires one unique profile per seat");
  }
  const strategyProfileHash = profileHash(strategyProfiles);
  const scheduledRuns =
    seeds * scenarioIds.length * RUNS_PER_SCENARIO_SEED;
  let processedRuns = 0;
  let completedRuns = 0;
  let contentVersion: string | null = null;
  const clusters: AiResidualPolicyBenchmarkCluster[] = [];
  const pairKeys = new Set<string>();

  const progress = (
    seed: number,
    scenarioId: AiBenchmarkScenarioId,
    kind: "baseline" | "candidate",
    controlledSeat: AiRecruitPlannerControlledSeat | null,
    completed: boolean,
    failure: string | null,
  ) => {
    processedRuns += 1;
    if (completed) completedRuns += 1;
    options.onProgress?.({
      processedRuns,
      scheduledRuns,
      seed,
      scenarioId,
      kind,
      controlledSeat,
      completed,
      failure,
    });
  };
  const checkContentVersion = (
    version: string | null,
    seed: number,
    run: string,
  ) => {
    if (!version) return;
    if (contentVersion === null) {
      contentVersion = version;
    } else if (version !== contentVersion) {
      runnerFailures.push({
        seed,
        run,
        message: `content version changed to ${version}`,
      });
    }
  };

  for (let offset = 0; offset < seeds; offset += 1) {
    const seed = startSeed + offset;
    const scenarioClusters: AiResidualPolicyBenchmarkScenarioCluster[] = [];
    for (const scenarioId of scenarioIds) {
      const baselineRun = `baseline-${scenarioId}`;
      let baseline: AiResidualPolicyBenchmarkBaseline;
      try {
        baseline = runBaseline(
          seed,
          scenarioId,
          config.maxRounds,
          config.initialHealth,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runnerFailures.push({ seed, run: baselineRun, message });
        baseline = failedBaseline(scenarioId, message);
      }
      checkContentVersion(baseline.contentVersion, seed, baselineRun);
      progress(
        seed,
        scenarioId,
        "baseline",
        null,
        baseline.completed,
        baseline.failure,
      );

      const pairs: AiResidualPolicyBenchmarkPair[] = [];
      for (const seat of AI_RESIDUAL_POLICY_CONTROLLED_SEATS) {
        const candidateRun = `candidate-${scenarioId}-seat-${seat}`;
        let candidate: AiResidualPolicyBenchmarkCandidate;
        try {
          if (policyIdentity === null) {
            throw new Error(
              "residual policy metadata instance is unavailable",
            );
          }
          const policy = createFreshPolicy(
            options.createPolicy,
            parametersSnapshot,
            seenPolicies,
            policyIdentity,
          );
          candidate = runCandidate(
            seed,
            scenarioId,
            seat,
            policy,
            policyIdentity,
            config,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          runnerFailures.push({ seed, run: candidateRun, message });
          candidate = failedCandidate(scenarioId, seat, message);
        }
        checkContentVersion(candidate.contentVersion, seed, candidateRun);
        const baselineBounds =
          baseline.seats.find((item) => item.seat === seat)?.placementBounds ??
          null;
        const baselineWon =
          baseline.seats.find((item) => item.seat === seat)?.won ?? null;
        const candidateBounds = candidate.placementBounds;
        const pairKey = createAiBenchmarkPairKey(
          seed,
          scenarioId,
          "seat",
          seat,
        );
        const uniquePairKey = !pairKeys.has(pairKey);
        if (uniquePairKey) {
          pairKeys.add(pairKey);
        } else {
          runnerFailures.push({
            seed,
            run: candidateRun,
            message: `duplicate benchmark pair key ${pairKey}`,
          });
        }
        const usable =
          uniquePairKey &&
          baseline.failure === null &&
          candidate.failure === null &&
          baselineBounds !== null &&
          candidateBounds !== null;
        pairs.push({
          pairKey,
          seed,
          scenarioId,
          seat,
          playerId: candidate.playerId,
          strategyId: candidate.strategyId,
          baselinePlacementBounds: baselineBounds,
          candidate,
          conservativePlacementDelta: usable
            ? conservativePlacementDelta(candidateBounds, baselineBounds)
            : null,
          conservativeTopFourDelta: usable
            ? conservativeRateDelta(candidateBounds, baselineBounds, "topFour")
            : null,
          conservativeWinDelta: usable
            ? candidate.completed && baseline.completed
              ? actualWinnerDelta(candidate.won, baselineWon)
              : conservativeRateDelta(candidateBounds, baselineBounds, "win")
            : null,
        });
        progress(
          seed,
          scenarioId,
          "candidate",
          seat,
          candidate.completed,
          candidate.failure,
        );
      }

      scenarioClusters.push({
        scenarioId,
        baseline,
        pairs,
        metric: seedMetricFromPairs(
          seed,
          pairs,
          AI_RESIDUAL_POLICY_CONTROLLED_SEATS.length,
        ),
      });
    }

    const pairs = scenarioClusters.flatMap(
      (scenarioCluster) => scenarioCluster.pairs,
    );
    const baseline = scenarioClusters[0]?.baseline;
    if (!baseline) {
      throw new Error("residual benchmark requires at least one scenario");
    }
    clusters.push({
      seed,
      baseline,
      pairs,
      metric: seedMetricFromPairs(
        seed,
        pairs,
        scenarioIds.length * AI_RESIDUAL_POLICY_CONTROLLED_SEATS.length,
      ),
      scenarios: scenarioClusters,
    });
  }

  const pairs = clusters.flatMap((cluster) => cluster.pairs);
  const candidates = pairs.map((pair) => pair.candidate);
  const pairedSeats = pairs.filter(isCompletePair).length;
  const missingPairs =
    seeds * scenarioIds.length * AI_RESIDUAL_POLICY_CONTROLLED_SEATS.length -
    pairedSeats;
  const drawnRuns = clusters.reduce(
    (sum, cluster) =>
      sum +
      cluster.scenarios.reduce(
        (scenarioSum, scenarioCluster) =>
          scenarioSum +
          (scenarioCluster.baseline.drawn ? 1 : 0) +
          scenarioCluster.pairs.filter((pair) => pair.candidate.drawn).length,
        0,
      ),
    0,
  );
  const truncatedRuns = clusters.reduce(
    (sum, cluster) =>
      sum +
      cluster.scenarios.reduce(
        (scenarioSum, scenarioCluster) =>
          scenarioSum +
          (scenarioCluster.baseline.truncated ? 1 : 0) +
          scenarioCluster.pairs.filter((pair) => pair.candidate.truncated)
            .length,
        0,
      ),
    0,
  );
  const comparisonMatrix = buildComparisonMatrix(
    clusters,
    scenarioIds,
    profileIds,
  );
  const comparisons = comparisonMatrix.overall;
  const providerDiagnostics = aggregateDiagnostics(candidates);
  const providerErrors = {
    providerErrors: providerDiagnostics.providerErrors,
    invalidContexts: providerDiagnostics.invalidContexts,
    invalidProposals: providerDiagnostics.invalidProposals,
    asyncProposals: providerDiagnostics.asyncProposals,
    noProvider: providerDiagnostics.noProvider,
    total:
      providerDiagnostics.providerErrors +
      providerDiagnostics.invalidContexts +
      providerDiagnostics.invalidProposals +
      providerDiagnostics.asyncProposals +
      providerDiagnostics.noProvider,
  };
  const overrideCoverage = {
    overrides: providerDiagnostics.overridesApplied,
    providerCalls: providerDiagnostics.providerCalls,
    rate: ratio(
      providerDiagnostics.overridesApplied,
      providerDiagnostics.providerCalls,
    ),
  };
  const abstention = {
    abstentions: providerDiagnostics.abstentions,
    providerCalls: providerDiagnostics.providerCalls,
    rate: ratio(
      providerDiagnostics.abstentions,
      providerDiagnostics.providerCalls,
    ),
  };

  const evaluatorHashAfter = sourceHash();
  const evaluatorStable = evaluatorHashAfter === EVALUATOR_HASH;
  if (!evaluatorStable) {
    runnerFailures.push({
      seed: startSeed,
      run: "evaluator-drift",
      message: "evaluator source changed during the benchmark",
    });
  }
  const strategyProfileHashAfter = profileHash(strategyProfileSnapshots());
  const strategyProfilesStable =
    strategyProfileHashAfter === strategyProfileHash;
  if (!strategyProfilesStable) {
    runnerFailures.push({
      seed: startSeed,
      run: "strategy-profile-drift",
      message: "AI strategy profiles changed during the benchmark",
    });
  }
  let codeSha256After: string | null = null;
  try {
    codeSha256After = artifactCodeSha256(artifactSources);
  } catch (error) {
    runnerFailures.push({
      seed: startSeed,
      run: "policy-source-drift",
      message: errorMessage(error),
    });
  }
  const sourceStable = codeSha256After === codeSha256;
  if (codeSha256After !== null && !sourceStable) {
    runnerFailures.push({
      seed: startSeed,
      run: "policy-source-drift",
      message: "residual policy source bytes changed during the benchmark",
    });
  }

  let parametersSha256After: string | null = null;
  try {
    parametersSha256After = artifactParametersSha256(
      cloneAndFreezeArtifactJson(options.policyArtifact.parameters),
    );
  } catch (error) {
    runnerFailures.push({
      seed: startSeed,
      run: "policy-parameters-drift",
      message: `residual policy parameters changed or became invalid: ${errorMessage(error)}`,
    });
  }
  const parametersStable = parametersSha256After === parametersSha256;
  if (parametersSha256After !== null && !parametersStable) {
    runnerFailures.push({
      seed: startSeed,
      run: "policy-parameters-drift",
      message: "residual policy parameters changed during the benchmark",
    });
  }

  const policyArtifactSha256After =
    policyIdentity === null ||
    codeSha256After === null ||
    parametersSha256After === null
      ? null
      : policyArtifactSha256(
          policyIdentity,
          codeSha256After,
          parametersSha256After,
        );
  const artifactStable =
    sourceStable &&
    parametersStable &&
    initialPolicyArtifactSha256 !== null &&
    policyArtifactSha256After === initialPolicyArtifactSha256;
  const gatePairedSeats = completeSeedProfilePairs(
    clusters,
    scenarioIds,
    profileIds,
  );
  const gateMissingPairs = seeds * profileIds.length - gatePairedSeats;
  const gate = evaluateAiRecruitPlannerGate({
    configuredSeeds: seeds,
    pairedSeats: gatePairedSeats,
    missingPairs: gateMissingPairs,
    incompletePlans: 0,
    rejectedActions: 0,
    boundaryViolations: 0,
    replanLimitHits: 0,
    drawnRuns,
    runnerFailures: runnerFailures.length,
    comparisons: withPairedSeats(comparisons, gatePairedSeats),
  });
  const acceptanceReasons = [...gate.reasons];
  appendReason(
    acceptanceReasons,
    providerDiagnostics.overridesApplied > 0,
    "requires at least one residual override",
  );
  appendReason(
    acceptanceReasons,
    providerDiagnostics.providerErrors === 0,
    "requires zero residual provider errors",
  );
  appendReason(
    acceptanceReasons,
    providerDiagnostics.invalidContexts === 0,
    "requires zero invalid residual contexts",
  );
  appendReason(
    acceptanceReasons,
    providerDiagnostics.invalidProposals === 0,
    "requires zero invalid residual proposals",
  );
  appendReason(
    acceptanceReasons,
    providerDiagnostics.asyncProposals === 0,
    "requires zero async residual proposals",
  );
  appendReason(
    acceptanceReasons,
    providerDiagnostics.noProvider === 0,
    "requires zero residual no-provider fallbacks",
  );
  appendReason(
    acceptanceReasons,
    evaluatorStable,
    "requires stable evaluator source",
  );
  appendReason(
    acceptanceReasons,
    strategyProfilesStable,
    "requires stable AI strategy profiles",
  );
  appendReason(
    acceptanceReasons,
    sourceStable,
    "requires stable residual policy sources",
  );
  appendReason(
    acceptanceReasons,
    parametersStable,
    "requires stable residual policy parameters",
  );
  appendReason(
    acceptanceReasons,
    artifactStable,
    "requires a stable residual policy artifact",
  );
  appendReason(
    acceptanceReasons,
    missingPairs === 0,
    "requires zero missing residual seat pairs",
  );

  const residualPolicy = {
    policyId: policyIdentity?.policyId ?? null,
    policyVersion: policyIdentity?.policyVersion ?? null,
    codeSha256,
    parametersSha256,
    policyArtifactSha256: initialPolicyArtifactSha256,
    sourceStable,
    parametersStable,
    artifactStable,
  };

  return {
    method: "deployment-seat-paired-residual-v1",
    benchmarkVersion: AI_RESIDUAL_POLICY_BENCHMARK_VERSION,
    contentVersion,
    policyVersion: AI_POLICY_VERSION,
    residualPolicy,
    contentSnapshotSha256: CONTENT_SNAPSHOT_SHA256,
    evaluatorHash: EVALUATOR_HASH,
    evaluatorHashAfter,
    evaluatorStable,
    strategyProfileHash,
    strategyProfileHashAfter,
    strategyProfilesStable,
    strategyProfiles,
    config,
    progress: {
      processedRuns,
      scheduledRuns,
      completedRuns,
      failedRuns: runnerFailures.length,
    },
    pairedSeats,
    missingPairs,
    drawnRuns,
    truncatedRuns,
    runnerFailures,
    providerDiagnostics,
    overrideCoverage,
    abstention,
    providerErrors,
    clusters,
    comparisons,
    comparisonMatrix,
    accepted: acceptanceReasons.length === 0,
    acceptanceReasons,
  };
}
