import { createHash } from "node:crypto";

import type {
  AiStrategyId,
  AiStrategyProfile,
} from "../lib/game/ai.ts";
import type { AiBenchmarkResult } from "./benchmark-ai.ts";

export const AI_POLICY_ARTIFACT_SCHEMA_VERSION = 1 as const;
export const AI_POLICY_ARTIFACT_MINIMUM_HOLDOUT_SEED_CLUSTERS = 24;

export const AI_POLICY_ARTIFACT_STRATEGY_IDS = [
  "balanced",
  "magnetic",
  "tempo",
  "triple",
  "powerLevel",
  "economy",
  "deathrattle",
] as const satisfies readonly AiStrategyId[];

const PROFILE_NUMBER_KEYS = [
  "upgradeRoundOffset",
  "safeTierSixUpgradeAcceleration",
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
  "tierSixRefreshBonus",
  "freezeScoreBonus",
  "scoutingWeight",
  "healthSpendFloor",
] as const satisfies readonly (keyof AiStrategyProfile)[];

export interface AiPolicyScheduleMetadata {
  seeds: number;
  startSeed: number;
  maxRounds: number;
  rotationsPerSeed: number;
  scheduledGames: number;
  completedGames: number;
  drawnGames: number;
  truncatedGames: number;
}

export interface AiPolicyPlacementGateEvidence {
  pairedGames: number;
  seedClusters: number;
  meanPlacementDelta: number | null;
  confidence95: { lower: number; upper: number } | null;
}

export interface AiPolicyRateGateEvidence {
  pairedGames: number;
  seedClusters: number;
  meanRateDelta: number | null;
  confidence95: { lower: number; upper: number } | null;
}

export interface AiPolicyHoldoutGate {
  minimumPlacementImprovement: number;
  minimumSeedClusters: number;
  topFourNoninferiorityGuard: number;
  winRateNoninferiorityGuard: number;
  placement: AiPolicyPlacementGateEvidence | null;
  topFour: AiPolicyRateGateEvidence | null;
  winRate: AiPolicyRateGateEvidence | null;
}

export interface AiPolicyAcceptanceConclusion {
  accepted: boolean;
  reasons: readonly string[];
  holdoutGate: AiPolicyHoldoutGate | null;
}

export interface AiPolicyArtifact {
  schemaVersion: typeof AI_POLICY_ARTIFACT_SCHEMA_VERSION;
  artifactHash: string;
  contentVersion: string;
  policyVersion: string;
  evaluatorHash: string;
  strategyProfileHash: string;
  profiles: readonly AiStrategyProfile[];
  benchmark: AiBenchmarkResult;
  schedules: {
    training: AiPolicyScheduleMetadata;
    holdout: AiPolicyScheduleMetadata | null;
  };
  acceptance: AiPolicyAcceptanceConclusion;
}

export interface CreateAiPolicyArtifactInput {
  benchmark: AiBenchmarkResult;
  profiles: readonly AiStrategyProfile[];
  holdoutSchedule?: AiPolicyScheduleMetadata | null;
  acceptance: AiPolicyAcceptanceConclusion;
}

export interface AiPolicyArtifactExpectations {
  contentVersion?: string;
  policyVersion?: string;
  evaluatorHash?: string;
  strategyProfileHash?: string;
}

export interface AiPolicyArtifactValidationResult {
  valid: boolean;
  errors: readonly string[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFiniteNumber(
  record: JsonRecord,
  key: keyof AiStrategyProfile,
  label: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label}.${key} must be a finite number`);
  }
  return value;
}

function normalizeProfile(value: unknown, label: string): AiStrategyProfile {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  if (typeof value.id !== "string") {
    throw new Error(`${label}.id must be a string`);
  }
  if (typeof value.label !== "string" || value.label.length === 0) {
    throw new Error(`${label}.label must be a non-empty string`);
  }
  if (
    typeof value.description !== "string" ||
    value.description.length === 0
  ) {
    throw new Error(`${label}.description must be a non-empty string`);
  }
  if (value.preferredTribe !== null && typeof value.preferredTribe !== "string") {
    throw new Error(`${label}.preferredTribe must be a string or null`);
  }
  for (const key of PROFILE_NUMBER_KEYS) {
    requireFiniteNumber(value, key, label);
  }

  return {
    id: value.id as AiStrategyId,
    label: value.label,
    description: value.description,
    preferredTribe:
      value.preferredTribe as AiStrategyProfile["preferredTribe"],
    upgradeRoundOffset: requireFiniteNumber(
      value,
      "upgradeRoundOffset",
      label,
    ),
    safeTierSixUpgradeAcceleration: requireFiniteNumber(
      value,
      "safeTierSixUpgradeAcceleration",
      label,
    ),
    minimumUpgradeHealth: requireFiniteNumber(
      value,
      "minimumUpgradeHealth",
      label,
    ),
    statWeight: requireFiniteNumber(value, "statWeight", label),
    synergyWeight: requireFiniteNumber(value, "synergyWeight", label),
    preferredTribeBonus: requireFiniteNumber(
      value,
      "preferredTribeBonus",
      label,
    ),
    pairBonus: requireFiniteNumber(value, "pairBonus", label),
    tripleBonus: requireFiniteNumber(value, "tripleBonus", label),
    battlecryBonus: requireFiniteNumber(value, "battlecryBonus", label),
    deathrattleBonus: requireFiniteNumber(value, "deathrattleBonus", label),
    economyBonus: requireFiniteNumber(value, "economyBonus", label),
    magneticBonus: requireFiniteNumber(value, "magneticBonus", label),
    highTierBonus: requireFiniteNumber(value, "highTierBonus", label),
    spellValueMultiplier: requireFiniteNumber(
      value,
      "spellValueMultiplier",
      label,
    ),
    replacementMargin: requireFiniteNumber(
      value,
      "replacementMargin",
      label,
    ),
    maxRefreshes: requireFiniteNumber(value, "maxRefreshes", label),
    tierSixRefreshBonus: requireFiniteNumber(
      value,
      "tierSixRefreshBonus",
      label,
    ),
    freezeScoreBonus: requireFiniteNumber(value, "freezeScoreBonus", label),
    scoutingWeight: requireFiniteNumber(value, "scoutingWeight", label),
    healthSpendFloor: requireFiniteNumber(value, "healthSpendFloor", label),
  };
}

function normalizeCompleteProfiles(value: unknown): AiStrategyProfile[] {
  if (!Array.isArray(value)) {
    throw new Error("profiles must be an array");
  }
  const byId = new Map<AiStrategyId, AiStrategyProfile>();
  for (const [index, candidate] of value.entries()) {
    const profile = normalizeProfile(candidate, `profiles[${index}]`);
    if (!AI_POLICY_ARTIFACT_STRATEGY_IDS.includes(profile.id)) {
      throw new Error(`profiles contain unknown strategy ${profile.id}`);
    }
    if (byId.has(profile.id)) {
      throw new Error(`profiles contain duplicate strategy ${profile.id}`);
    }
    byId.set(profile.id, profile);
  }
  for (const strategyId of AI_POLICY_ARTIFACT_STRATEGY_IDS) {
    if (!byId.has(strategyId)) {
      throw new Error(`profiles are missing strategy ${strategyId}`);
    }
  }
  if (byId.size !== AI_POLICY_ARTIFACT_STRATEGY_IDS.length) {
    throw new Error(
      `profiles must contain exactly ${AI_POLICY_ARTIFACT_STRATEGY_IDS.length} strategies`,
    );
  }
  return AI_POLICY_ARTIFACT_STRATEGY_IDS.map((strategyId) => {
    const profile = byId.get(strategyId);
    if (!profile) {
      throw new Error(`profiles are missing strategy ${strategyId}`);
    }
    return profile;
  });
}

export function computeAiStrategyProfileHash(
  profiles: readonly AiStrategyProfile[],
): string {
  const normalized = normalizeCompleteProfiles(profiles);
  const seatProfiles = Array.from({ length: 8 }, (_value, index) => ({
    playerId: `player-${index}`,
    profile: normalized[index === 0 ? 0 : index - 1],
  }));
  return createHash("sha256")
    .update(JSON.stringify(seatProfiles))
    .digest("hex");
}

export function scheduleFromAiBenchmark(
  benchmark: AiBenchmarkResult,
): AiPolicyScheduleMetadata {
  return {
    seeds: benchmark.seeds,
    startSeed: benchmark.startSeed,
    maxRounds: benchmark.maxRounds,
    rotationsPerSeed: benchmark.rotationsPerSeed,
    scheduledGames: benchmark.scheduledGames,
    completedGames: benchmark.completedGames,
    drawnGames: benchmark.drawnGames,
    truncatedGames: benchmark.truncatedGames,
  };
}

function canonicalJsonValue(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} contains a non-finite number`);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new Error(`${path} is not JSON serializable`);
  }
  if (ancestors.has(value)) {
    throw new Error(`${path} contains a cycle`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value
        .map((item, index) =>
          canonicalJsonValue(item, `${path}[${index}]`, ancestors),
        )
        .join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-plain object`);
    }
    const record = value as JsonRecord;
    const entries = Object.keys(record)
      .sort()
      .map((key) => {
        if (record[key] === undefined) {
          throw new Error(`${path}.${key} is undefined`);
        }
        return `${JSON.stringify(key)}:${canonicalJsonValue(
          record[key],
          `${path}.${key}`,
          ancestors,
        )}`;
      });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalAiPolicyArtifactJson(value: unknown): string {
  return canonicalJsonValue(value, "artifact", new WeakSet<object>());
}

export function computeAiPolicyArtifactHash(
  value: Omit<AiPolicyArtifact, "artifactHash"> | AiPolicyArtifact,
): string {
  if (!isRecord(value)) {
    throw new Error("artifact payload must be an object");
  }
  const payload: JsonRecord = { ...value };
  delete payload.artifactHash;
  return createHash("sha256")
    .update(canonicalAiPolicyArtifactJson(payload))
    .digest("hex");
}

function cloneJson<T>(value: T): T {
  canonicalAiPolicyArtifactJson(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function scheduleErrors(
  value: unknown,
  label: string,
): { schedule: AiPolicyScheduleMetadata | null; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { schedule: null, errors: [`${label} must be an object`] };
  }
  const positiveKeys = ["seeds", "maxRounds", "rotationsPerSeed"] as const;
  const nonNegativeKeys = [
    "scheduledGames",
    "completedGames",
    "drawnGames",
    "truncatedGames",
  ] as const;
  for (const key of positiveKeys) {
    if (!Number.isSafeInteger(value[key]) || Number(value[key]) <= 0) {
      errors.push(`${label}.${key} must be a positive safe integer`);
    }
  }
  if (!Number.isSafeInteger(value.startSeed)) {
    errors.push(`${label}.startSeed must be a safe integer`);
  }
  for (const key of nonNegativeKeys) {
    if (!isNonNegativeInteger(value[key])) {
      errors.push(`${label}.${key} must be a non-negative safe integer`);
    }
  }
  if (errors.length > 0) {
    return { schedule: null, errors };
  }
  const schedule = value as unknown as AiPolicyScheduleMetadata;
  if (schedule.scheduledGames !== schedule.seeds * schedule.rotationsPerSeed) {
    errors.push(`${label}.scheduledGames does not match seeds x rotations`);
  }
  if (
    schedule.completedGames + schedule.truncatedGames !==
    schedule.scheduledGames
  ) {
    errors.push(`${label} completed and truncated games do not cover schedule`);
  }
  if (schedule.drawnGames > schedule.completedGames) {
    errors.push(`${label}.drawnGames exceeds completedGames`);
  }
  if (!Number.isSafeInteger(schedule.startSeed + schedule.seeds)) {
    errors.push(`${label} seed range exceeds safe integers`);
  }
  return { schedule, errors };
}

function benchmarkStrategyErrors(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["benchmark.strategies must be an array"];
  }
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const [index, strategy] of value.entries()) {
    if (!isRecord(strategy) || typeof strategy.strategyId !== "string") {
      errors.push(`benchmark.strategies[${index}] has no strategyId`);
      continue;
    }
    if (seen.has(strategy.strategyId)) {
      errors.push(
        `benchmark.strategies contain duplicate strategy ${strategy.strategyId}`,
      );
    }
    seen.add(strategy.strategyId);
  }
  for (const strategyId of AI_POLICY_ARTIFACT_STRATEGY_IDS) {
    if (!seen.has(strategyId)) {
      errors.push(`benchmark.strategies are missing strategy ${strategyId}`);
    }
  }
  for (const strategyId of seen) {
    if (
      !AI_POLICY_ARTIFACT_STRATEGY_IDS.includes(strategyId as AiStrategyId)
    ) {
      errors.push(`benchmark.strategies contain unknown strategy ${strategyId}`);
    }
  }
  return errors;
}

function comparisonErrors(
  comparison: unknown,
  label: string,
  scheduledGames: number,
  holdoutSeeds: number,
  deltaKey: "meanPlacementDelta" | "meanRateDelta",
): string[] {
  const errors: string[] = [];
  if (!isRecord(comparison)) {
    return [`${label} evidence is missing`];
  }
  if (comparison.pairedGames !== scheduledGames) {
    errors.push(`${label}.pairedGames does not cover the holdout schedule`);
  }
  if (comparison.seedClusters !== holdoutSeeds) {
    errors.push(`${label}.seedClusters does not match holdout seeds`);
  }
  if (typeof comparison[deltaKey] !== "number") {
    errors.push(`${label}.${deltaKey} is missing`);
  }
  if (
    !isRecord(comparison.confidence95) ||
    typeof comparison.confidence95.lower !== "number" ||
    typeof comparison.confidence95.upper !== "number" ||
    !Number.isFinite(comparison.confidence95.lower) ||
    !Number.isFinite(comparison.confidence95.upper) ||
    comparison.confidence95.lower > comparison.confidence95.upper
  ) {
    errors.push(`${label}.confidence95 is incomplete`);
  }
  return errors;
}

function acceptedHoldoutGateErrors(
  gateValue: unknown,
  holdout: AiPolicyScheduleMetadata | null,
): string[] {
  if (!holdout) {
    return ["accepted artifacts require a holdout schedule"];
  }
  if (!isRecord(gateValue)) {
    return ["accepted artifacts require a complete holdout gate"];
  }
  const errors = [
    ...comparisonErrors(
      gateValue.placement,
      "holdout placement",
      holdout.scheduledGames,
      holdout.seeds,
      "meanPlacementDelta",
    ),
    ...comparisonErrors(
      gateValue.topFour,
      "holdout top-four",
      holdout.scheduledGames,
      holdout.seeds,
      "meanRateDelta",
    ),
    ...comparisonErrors(
      gateValue.winRate,
      "holdout win-rate",
      holdout.scheduledGames,
      holdout.seeds,
      "meanRateDelta",
    ),
  ];
  const nonNegativeThresholds = [
    "minimumPlacementImprovement",
    "topFourNoninferiorityGuard",
    "winRateNoninferiorityGuard",
  ] as const;
  for (const key of nonNegativeThresholds) {
    if (
      typeof gateValue[key] !== "number" ||
      !Number.isFinite(gateValue[key]) ||
      gateValue[key] < 0
    ) {
      errors.push(`holdoutGate.${key} must be non-negative`);
    }
  }
  if (
    !Number.isSafeInteger(gateValue.minimumSeedClusters) ||
    Number(gateValue.minimumSeedClusters) <
      AI_POLICY_ARTIFACT_MINIMUM_HOLDOUT_SEED_CLUSTERS
  ) {
    errors.push(
      `holdoutGate.minimumSeedClusters must be at least ${AI_POLICY_ARTIFACT_MINIMUM_HOLDOUT_SEED_CLUSTERS}`,
    );
  }
  if (holdout.drawnGames > 0) {
    errors.push("accepted holdout schedule contains drawn games");
  }
  if (errors.length > 0) {
    return errors;
  }

  const gate = gateValue as unknown as AiPolicyHoldoutGate;
  const placement = gate.placement;
  const topFour = gate.topFour;
  const winRate = gate.winRate;
  if (!placement || !topFour || !winRate) {
    return ["accepted artifacts require complete holdout comparisons"];
  }
  if (placement.seedClusters < gate.minimumSeedClusters) {
    errors.push("holdout placement has too few independent seed clusters");
  }
  if (
    placement.meanPlacementDelta === null ||
    placement.meanPlacementDelta > -gate.minimumPlacementImprovement
  ) {
    errors.push("holdout placement improvement is below the threshold");
  }
  if (
    placement.confidence95 === null ||
    placement.confidence95.upper >= 0
  ) {
    errors.push("holdout placement confidence interval includes no gain");
  }
  if (
    topFour.confidence95 === null ||
    topFour.confidence95.lower < -gate.topFourNoninferiorityGuard
  ) {
    errors.push("holdout top-four guardrail failed");
  }
  if (
    winRate.confidence95 === null ||
    winRate.confidence95.lower < -gate.winRateNoninferiorityGuard
  ) {
    errors.push("holdout win-rate guardrail failed");
  }
  return errors;
}

function schedulesEqual(
  left: AiPolicyScheduleMetadata,
  right: AiPolicyScheduleMetadata,
): boolean {
  return (
    left.seeds === right.seeds &&
    left.startSeed === right.startSeed &&
    left.maxRounds === right.maxRounds &&
    left.rotationsPerSeed === right.rotationsPerSeed &&
    left.scheduledGames === right.scheduledGames &&
    left.completedGames === right.completedGames &&
    left.drawnGames === right.drawnGames &&
    left.truncatedGames === right.truncatedGames
  );
}

export function validateAiPolicyArtifact(
  value: unknown,
  expectations: AiPolicyArtifactExpectations = {},
): AiPolicyArtifactValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ["artifact must be an object"] };
  }
  if (value.schemaVersion !== AI_POLICY_ARTIFACT_SCHEMA_VERSION) {
    errors.push(
      `schemaVersion must be ${AI_POLICY_ARTIFACT_SCHEMA_VERSION}`,
    );
  }
  for (const key of ["contentVersion", "policyVersion"] as const) {
    if (typeof value[key] !== "string" || value[key].length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }
  for (const key of [
    "artifactHash",
    "evaluatorHash",
    "strategyProfileHash",
  ] as const) {
    if (typeof value[key] !== "string" || !/^[0-9a-f]{64}$/.test(value[key])) {
      errors.push(`${key} must be a lowercase SHA-256 hash`);
    }
  }

  let normalizedProfiles: AiStrategyProfile[] | null = null;
  try {
    normalizedProfiles = normalizeCompleteProfiles(value.profiles);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const benchmark = isRecord(value.benchmark) ? value.benchmark : null;
  if (!benchmark) {
    errors.push("benchmark must be an object");
  } else {
    errors.push(...benchmarkStrategyErrors(benchmark.strategies));
    for (const key of [
      "contentVersion",
      "policyVersion",
      "evaluatorHash",
      "strategyProfileHash",
    ] as const) {
      if (value[key] !== benchmark[key]) {
        errors.push(`${key} does not match benchmark`);
      }
    }
  }

  if (normalizedProfiles) {
    const computedProfileHash = computeAiStrategyProfileHash(normalizedProfiles);
    if (value.strategyProfileHash !== computedProfileHash) {
      errors.push("strategyProfileHash does not match frozen profiles");
    }
  }

  const schedules = isRecord(value.schedules) ? value.schedules : null;
  let trainingSchedule: AiPolicyScheduleMetadata | null = null;
  let holdoutSchedule: AiPolicyScheduleMetadata | null = null;
  if (!schedules) {
    errors.push("schedules must be an object");
  } else {
    const trainingResult = scheduleErrors(
      schedules.training,
      "schedules.training",
    );
    trainingSchedule = trainingResult.schedule;
    errors.push(...trainingResult.errors);
    if (benchmark && trainingResult.schedule) {
      const benchmarkSchedule = scheduleFromAiBenchmark(
        benchmark as unknown as AiBenchmarkResult,
      );
      if (!schedulesEqual(trainingResult.schedule, benchmarkSchedule)) {
        errors.push("training schedule does not match benchmark");
      }
    }
    if (schedules.holdout !== null) {
      const holdoutResult = scheduleErrors(
        schedules.holdout,
        "schedules.holdout",
      );
      holdoutSchedule = holdoutResult.schedule;
      errors.push(...holdoutResult.errors);
    }
    if (trainingSchedule && holdoutSchedule) {
      if (
        trainingSchedule.startSeed <
          holdoutSchedule.startSeed + holdoutSchedule.seeds &&
        holdoutSchedule.startSeed <
          trainingSchedule.startSeed + trainingSchedule.seeds
      ) {
        errors.push("training and holdout seed ranges overlap");
      }
      if (
        trainingSchedule.maxRounds !== holdoutSchedule.maxRounds ||
        trainingSchedule.rotationsPerSeed !== holdoutSchedule.rotationsPerSeed
      ) {
        errors.push(
          "training and holdout schedules use different evaluator bounds",
        );
      }
    }
  }

  const acceptance = isRecord(value.acceptance) ? value.acceptance : null;
  if (!acceptance) {
    errors.push("acceptance must be an object");
  } else {
    if (typeof acceptance.accepted !== "boolean") {
      errors.push("acceptance.accepted must be a boolean");
    }
    if (
      !Array.isArray(acceptance.reasons) ||
      acceptance.reasons.some(
        (reason) => typeof reason !== "string" || reason.length === 0,
      )
    ) {
      errors.push("acceptance.reasons must contain non-empty strings");
    }
    if (acceptance.accepted === true) {
      if (Array.isArray(acceptance.reasons) && acceptance.reasons.length > 0) {
        errors.push("accepted artifacts cannot contain rejection reasons");
      }
      errors.push(
        ...acceptedHoldoutGateErrors(
          acceptance.holdoutGate,
          holdoutSchedule,
        ),
      );
    }
  }

  for (const [key, expected] of Object.entries(expectations)) {
    if (expected !== undefined && value[key] !== expected) {
      errors.push(`${key} does not match expected version or hash`);
    }
  }

  if (typeof value.artifactHash === "string") {
    try {
      const computedArtifactHash = computeAiPolicyArtifactHash(
        value as unknown as AiPolicyArtifact,
      );
      if (computedArtifactHash !== value.artifactHash) {
        errors.push("artifactHash does not match canonical payload");
      }
    } catch (error) {
      errors.push(
        `artifact canonicalization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidAiPolicyArtifact(
  value: unknown,
  expectations: AiPolicyArtifactExpectations = {},
): asserts value is AiPolicyArtifact {
  const validation = validateAiPolicyArtifact(value, expectations);
  if (!validation.valid) {
    throw new Error(
      `invalid AI policy artifact: ${validation.errors.join("; ")}`,
    );
  }
}

export function createAiPolicyArtifact(
  input: CreateAiPolicyArtifactInput,
): AiPolicyArtifact {
  const profiles = normalizeCompleteProfiles(input.profiles);
  const benchmark = cloneJson(input.benchmark);
  const payload = cloneJson({
    schemaVersion: AI_POLICY_ARTIFACT_SCHEMA_VERSION,
    contentVersion: benchmark.contentVersion,
    policyVersion: benchmark.policyVersion,
    evaluatorHash: benchmark.evaluatorHash,
    strategyProfileHash: benchmark.strategyProfileHash,
    profiles,
    benchmark,
    schedules: {
      training: scheduleFromAiBenchmark(benchmark),
      holdout: input.holdoutSchedule ?? null,
    },
    acceptance: input.acceptance,
  });
  const artifact = {
    ...payload,
    artifactHash: computeAiPolicyArtifactHash(payload),
  } as AiPolicyArtifact;
  assertValidAiPolicyArtifact(artifact);
  return deepFreeze(artifact);
}
