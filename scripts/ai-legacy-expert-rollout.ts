import { createHash } from "node:crypto";

import {
  AI_STRATEGY_PROFILES,
  type AiStrategyId,
} from "../lib/game/ai.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  withAiResidualPolicyOverrides,
  type AiResidualMacroContext,
  type AiResidualMacroKind,
  type AiResidualPolicy,
  type AiResidualPolicyDiagnostics,
  type DeepReadonly,
} from "../lib/game/ai-residual-policy.ts";
import type { PlayerId } from "../lib/game/types.ts";
import {
  runAiBenchmark,
  type AiBenchmarkOptions,
  type AiBenchmarkResult,
  type AiBenchmarkStrategyResult,
} from "./benchmark-ai.ts";

export const AI_LEGACY_EXPERT_ROLLOUT_VERSION = 1 as const;

const AI_LEGACY_EXPERT_SOURCE = "legacy-residual-macro-policy" as const;
const AI_LEGACY_EXPERT_PLAYER_IDS: readonly PlayerId[] = Object.freeze(
  AI_STRATEGY_PROFILES.map((_profile, index) => `player-${index + 1}`),
);

export interface AiLegacyExpertRecorderOptions {
  /** Retain at most this many samples for each profile and macro kind. */
  readonly maxSamplesPerProfileKind?: number;
}

export interface AiLegacyExpertRecorderSnapshot {
  readonly maxSamplesPerProfileKind: number | null;
  readonly observedSamples: number;
  readonly droppedSamples: number;
  readonly observedByKind: Readonly<Record<AiResidualMacroKind, number>>;
  readonly observedByProfile: Readonly<Record<string, number>>;
  readonly samples: readonly DeepReadonly<AiResidualMacroContext>[];
}

export interface AiLegacyExpertRecorder {
  readonly provider: AiResidualPolicy;
  snapshot(): DeepReadonly<AiLegacyExpertRecorderSnapshot>;
  clear(): void;
}

export interface AiLegacyExpertRolloutCounts {
  readonly retainedSamples: number;
  readonly observedSamples: number;
  readonly droppedSamples: number;
  readonly retainedByKind: Readonly<Record<AiResidualMacroKind, number>>;
  readonly observedByKind: Readonly<Record<AiResidualMacroKind, number>>;
  readonly retainedByProfile: Readonly<Record<AiStrategyId, number>>;
  readonly observedByProfile: Readonly<Record<AiStrategyId, number>>;
}

export type AiLegacyExpertEvaluationStrategy = Readonly<
  AiBenchmarkStrategyResult
>;

export interface AiLegacyExpertEvaluationSummary {
  readonly method: AiBenchmarkResult["method"];
  readonly evaluatorHash: string;
  readonly strategyProfileHash: string;
  readonly maxRounds: number;
  readonly scheduledGames: number;
  readonly completedGames: number;
  readonly drawnGames: number;
  readonly truncatedGames: number;
  readonly strategies: readonly AiLegacyExpertEvaluationStrategy[];
}

export interface AiLegacyExpertRolloutBundle {
  readonly schemaVersion: typeof AI_LEGACY_EXPERT_ROLLOUT_VERSION;
  readonly source: typeof AI_LEGACY_EXPERT_SOURCE;
  readonly contextVersion: typeof AI_RESIDUAL_CONTEXT_VERSION;
  readonly contentVersion: string;
  readonly policyVersion: string;
  readonly profileIds: readonly AiStrategyId[];
  readonly evaluatorHash: string;
  readonly strategyProfileHash: string;
  readonly maxSamplesPerProfileKind: number | null;
  readonly counts: AiLegacyExpertRolloutCounts;
  readonly samples: readonly DeepReadonly<AiResidualMacroContext>[];
  readonly bundleSha256: string;
  readonly evaluationSummary: AiLegacyExpertEvaluationSummary;
}

export type AiLegacyExpertBenchmarkOptions = Omit<
  AiBenchmarkOptions,
  "profileOverrides"
> & {
  readonly profileOverrides?: never;
  readonly maxSamplesPerProfileKind?: number;
};

export interface AiLegacyExpertBenchmarkResult {
  /** Privacy-safe rollout data. The benchmark result is intentionally separate. */
  readonly bundle: DeepReadonly<AiLegacyExpertRolloutBundle>;
  readonly benchmark: DeepReadonly<AiBenchmarkResult>;
  readonly diagnostics: AiResidualPolicyDiagnostics;
}

function normalizedMaxSamples(value: number | undefined): number {
  if (value === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      "maxSamplesPerProfileKind must be a non-negative safe integer",
    );
  }
  return value;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== "object") {
    return value as DeepReadonly<T>;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

function canonicalJson(value: unknown, ancestors = new WeakSet<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("canonical rollout JSON requires finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError("canonical rollout JSON requires JSON-only data");
  }
  if (ancestors.has(value)) {
    throw new TypeError("canonical rollout JSON cannot contain cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalJson(item, ancestors)).join(",")}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("canonical rollout JSON requires plain objects");
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(record[key], ancestors)}`,
      )
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function createAiLegacyExpertRecorder(
  options: AiLegacyExpertRecorderOptions = {},
): AiLegacyExpertRecorder {
  const limit = normalizedMaxSamples(options.maxSamplesPerProfileKind);
  let observedSamples = 0;
  let samples: Array<DeepReadonly<AiResidualMacroContext>> = [];
  let retainedByBucket = new Map<string, number>();
  let observedByKind: Record<AiResidualMacroKind, number> = {
    upgrade: 0,
    refresh: 0,
    freeze: 0,
  };
  let observedByProfile = new Map<string, number>();

  const provider: AiResidualPolicy = Object.freeze({
    policyId: "legacy-expert-rollout-recorder",
    policyVersion: `legacy-expert-rollout-v${AI_LEGACY_EXPERT_ROLLOUT_VERSION}`,
    propose(context: DeepReadonly<AiResidualMacroContext>) {
      observedSamples += 1;
      observedByKind[context.kind] += 1;
      observedByProfile.set(
        context.profileId,
        (observedByProfile.get(context.profileId) ?? 0) + 1,
      );
      const bucketKey = JSON.stringify([context.profileId, context.kind]);
      const retainedInBucket = retainedByBucket.get(bucketKey) ?? 0;
      if (retainedInBucket < limit) {
        // The residual resolver validates, clones, and deeply freezes this graph
        // before invoking the provider. Retaining it cannot mutate live state.
        samples.push(context);
        retainedByBucket.set(bucketKey, retainedInBucket + 1);
      }
      return null;
    },
  });

  return Object.freeze({
    provider,
    snapshot(): DeepReadonly<AiLegacyExpertRecorderSnapshot> {
      return deepFreeze({
        maxSamplesPerProfileKind: Number.isFinite(limit) ? limit : null,
        observedSamples,
        droppedSamples: observedSamples - samples.length,
        observedByKind: { ...observedByKind },
        observedByProfile: Object.fromEntries(observedByProfile),
        samples: [...samples],
      });
    },
    clear(): void {
      observedSamples = 0;
      samples = [];
      retainedByBucket = new Map<string, number>();
      observedByKind = { upgrade: 0, refresh: 0, freeze: 0 };
      observedByProfile = new Map<string, number>();
    },
  });
}

function rolloutCounts(
  snapshot: DeepReadonly<AiLegacyExpertRecorderSnapshot>,
  profileIds: readonly AiStrategyId[],
): AiLegacyExpertRolloutCounts {
  const retainedByKind: Record<AiResidualMacroKind, number> = {
    upgrade: 0,
    refresh: 0,
    freeze: 0,
  };
  const retainedByProfile = Object.fromEntries(
    profileIds.map((profileId) => [profileId, 0]),
  ) as Record<AiStrategyId, number>;
  const observedByProfile = Object.fromEntries(
    profileIds.map((profileId) => [profileId, 0]),
  ) as Record<AiStrategyId, number>;
  const allowedProfiles = new Set<string>(profileIds);

  for (const sample of snapshot.samples) {
    if (!allowedProfiles.has(sample.profileId)) {
      throw new Error(`rollout captured unknown profile ${sample.profileId}`);
    }
    retainedByKind[sample.kind] += 1;
    retainedByProfile[sample.profileId as AiStrategyId] += 1;
  }
  for (const [profileId, count] of Object.entries(snapshot.observedByProfile)) {
    if (!allowedProfiles.has(profileId)) {
      throw new Error(`rollout observed unknown profile ${profileId}`);
    }
    observedByProfile[profileId as AiStrategyId] = count;
  }

  return {
    retainedSamples: snapshot.samples.length,
    observedSamples: snapshot.observedSamples,
    droppedSamples: snapshot.droppedSamples,
    retainedByKind,
    observedByKind: { ...snapshot.observedByKind },
    retainedByProfile,
    observedByProfile,
  };
}

function evaluationSummary(
  benchmark: AiBenchmarkResult,
): AiLegacyExpertEvaluationSummary {
  return {
    method: benchmark.method,
    evaluatorHash: benchmark.evaluatorHash,
    strategyProfileHash: benchmark.strategyProfileHash,
    maxRounds: benchmark.maxRounds,
    scheduledGames: benchmark.scheduledGames,
    completedGames: benchmark.completedGames,
    drawnGames: benchmark.drawnGames,
    truncatedGames: benchmark.truncatedGames,
    strategies: benchmark.strategies.map((strategy) => ({ ...strategy })),
  };
}

function assertRecorderDiagnostics(
  diagnostics: AiResidualPolicyDiagnostics,
  snapshot: DeepReadonly<AiLegacyExpertRecorderSnapshot>,
): void {
  if (
    diagnostics.decisions !== snapshot.observedSamples ||
    diagnostics.providerCalls !== snapshot.observedSamples ||
    diagnostics.abstentions !== snapshot.observedSamples ||
    diagnostics.fallbacks !== snapshot.observedSamples ||
    diagnostics.overridesApplied !== 0 ||
    diagnostics.noProvider !== 0 ||
    diagnostics.lowConfidence !== 0 ||
    diagnostics.invalidContexts !== 0 ||
    diagnostics.invalidProposals !== 0 ||
    diagnostics.providerErrors !== 0 ||
    diagnostics.asyncProposals !== 0 ||
    diagnostics.agreements !== 0
  ) {
    throw new Error("legacy expert recorder diagnostics are inconsistent");
  }
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    if (
      diagnostics.byKind[kind].decisions !== snapshot.observedByKind[kind] ||
      diagnostics.byKind[kind].overridesApplied !== 0
    ) {
      throw new Error("legacy expert recorder kind diagnostics disagree");
    }
  }
}

export function recordAiLegacyExpertBenchmark(
  options: AiLegacyExpertBenchmarkOptions = {},
): Readonly<AiLegacyExpertBenchmarkResult> {
  if ("profileOverrides" in options) {
    throw new Error("legacy expert recording does not accept profileOverrides");
  }
  const { maxSamplesPerProfileKind, ...benchmarkOptions } = options;
  const recorder = createAiLegacyExpertRecorder({
    maxSamplesPerProfileKind,
  });
  const overrides = new Map<PlayerId, AiResidualPolicy>(
    AI_LEGACY_EXPERT_PLAYER_IDS.map((playerId) => [
      playerId,
      recorder.provider,
    ]),
  );
  const recorded = withAiResidualPolicyOverrides(overrides, () =>
    runAiBenchmark(benchmarkOptions),
  );
  const snapshot = recorder.snapshot();
  assertRecorderDiagnostics(recorded.diagnostics, snapshot);
  const profileIds = Object.freeze(
    AI_STRATEGY_PROFILES.map((profile) => profile.id),
  );

  for (const sample of snapshot.samples) {
    if (
      sample.contextVersion !== AI_RESIDUAL_CONTEXT_VERSION ||
      sample.contentVersion !== recorded.result.contentVersion ||
      sample.policyVersion !== recorded.result.policyVersion
    ) {
      throw new Error("rollout context metadata disagrees with benchmark");
    }
  }

  const counts = rolloutCounts(snapshot, profileIds);
  const evaluation = evaluationSummary(recorded.result);
  const unsignedBundle = {
    schemaVersion: AI_LEGACY_EXPERT_ROLLOUT_VERSION,
    source: AI_LEGACY_EXPERT_SOURCE,
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    contentVersion: recorded.result.contentVersion,
    policyVersion: recorded.result.policyVersion,
    profileIds,
    evaluatorHash: recorded.result.evaluatorHash,
    strategyProfileHash: recorded.result.strategyProfileHash,
    maxSamplesPerProfileKind: snapshot.maxSamplesPerProfileKind,
    counts,
    samples: snapshot.samples,
    evaluationSummary: evaluation,
  };
  const bundle = deepFreeze({
    ...unsignedBundle,
    bundleSha256: canonicalSha256(unsignedBundle),
  });
  const benchmark = deepFreeze(recorded.result);

  return Object.freeze({
    bundle,
    benchmark,
    diagnostics: recorded.diagnostics,
  });
}
