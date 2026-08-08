import {
  getAiStrategyProfile,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import { AI_BENCHMARK_SCENARIOS, type AiBenchmarkScenarioId } from "./ai-benchmark-scenarios.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
  assertAiCooperativeCemSelectionImplementationPinned,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "./ai-cooperative-cem-selection-registration.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  computeAiCooperativeCemTrainingResultSha256,
} from "./ai-cooperative-cem-training-result.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";
import type {
  AiPolicySuiteCandidate,
  AiPolicySuitePlayerId,
} from "./benchmark-ai-policy-suite.ts";

export const AI_COOPERATIVE_CEM_SELECTION_PLAYER_IDS = Object.freeze([
  "player-1",
  "player-2",
  "player-3",
  "player-4",
  "player-5",
  "player-6",
  "player-7",
] as const);
export const AI_COOPERATIVE_CEM_SELECTION_ROTATIONS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7,
] as const);

export interface AiCooperativeCemSelectionBenchmarkContractInput {
  readonly candidate: AiPolicySuiteCandidate;
  readonly seeds: number;
  readonly startSeed: number;
  readonly maxRounds: number;
  readonly initialHealth: number;
  readonly scenarioIds: readonly AiBenchmarkScenarioId[];
  readonly rotations: readonly number[];
  readonly scoredPlayerIds: readonly AiPolicySuitePlayerId[];
  readonly reservationId: string | undefined;
  readonly reservationMode: string | undefined;
  readonly reservationProtocolSha256: string | undefined;
  readonly reservationImplementationSha256: string | undefined;
  readonly reservationConfirmation: string | undefined;
  readonly reservationTrainingResultSha256: string | undefined;
  readonly policyVersion: string;
  readonly contentVersion: string;
  readonly contentSnapshotSha256: string;
  readonly evaluatorHash: string;
  readonly strategyProfileHash: string;
  readonly candidateProfileHash: string;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function profileKeys(profile: AiStrategyProfile): string[] {
  return Object.keys(profile).sort();
}

export function buildAiCooperativeCemSelectionCandidateProfileOverrides(): ReadonlyMap<
  AiPolicySuitePlayerId,
  AiStrategyProfile
> {
  const registration = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  const selectedGenome = registration.candidateScope.selectedGenome;
  const profiles = new Map<AiPolicySuitePlayerId, AiStrategyProfile>();
  for (const playerId of AI_COOPERATIVE_CEM_SELECTION_PLAYER_IDS) {
    const production = getAiStrategyProfile(playerId);
    const profile =
      playerId === registration.focus.playerId
        ? {
            ...production,
            upgradeRoundOffset: selectedGenome.upgradeRoundOffset,
            minimumUpgradeHealth: selectedGenome.minimumUpgradeHealth,
            replacementMargin: selectedGenome.replacementMargin,
            maxRefreshes: selectedGenome.maxRefreshes,
          }
        : { ...production };
    profiles.set(playerId, Object.freeze(profile));
  }
  return profiles;
}

export function assertAiCooperativeCemSelectionCandidateScope(
  candidate: AiPolicySuiteCandidate,
): void {
  if (candidate.createResidualPolicy !== undefined) {
    throw new TypeError(
      "cooperative CEM selection does not permit residual policy overrides",
    );
  }
  if (!(candidate.profileOverrides instanceof Map)) {
    throw new TypeError(
      "cooperative CEM selection requires complete profile overrides",
    );
  }
  const expected = buildAiCooperativeCemSelectionCandidateProfileOverrides();
  if (candidate.profileOverrides.size !== expected.size) {
    throw new RangeError(
      "cooperative CEM selection requires exactly player-1 through player-7",
    );
  }
  for (const playerId of AI_COOPERATIVE_CEM_SELECTION_PLAYER_IDS) {
    const actualProfile = candidate.profileOverrides.get(playerId);
    const expectedProfile = expected.get(playerId);
    if (actualProfile === undefined || expectedProfile === undefined) {
      throw new RangeError(`cooperative CEM selection is missing ${playerId}`);
    }
    if (!arraysEqual(profileKeys(actualProfile), profileKeys(expectedProfile))) {
      throw new TypeError(
        `cooperative CEM selection ${playerId} profile keys must match production`,
      );
    }
    if (
      canonicalAiPolicyEvolutionJson(actualProfile) !==
      canonicalAiPolicyEvolutionJson(expectedProfile)
    ) {
      throw new RangeError(
        `cooperative CEM selection ${playerId} profile does not match the registered candidate`,
      );
    }
  }
}

export function assertAiCooperativeCemSelectionBenchmarkContract(
  input: AiCooperativeCemSelectionBenchmarkContractInput,
): void {
  const registered = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  if (
    input.reservationId !== AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID ||
    input.reservationMode !== AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE ||
    input.reservationProtocolSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256 ||
    input.reservationImplementationSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256 ||
    input.reservationConfirmation !==
      AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION ||
    input.reservationTrainingResultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256
  ) {
    throw new Error(
      "cooperative CEM selection capability does not match registration",
    );
  }
  assertAiCooperativeCemSelectionImplementationPinned();
  if (
    computeAiCooperativeCemTrainingResultSha256() !==
    AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256
  ) {
    throw new Error("cooperative CEM training result registration drifted");
  }
  if (
    input.startSeed !== registered.benchmark.startSeed ||
    input.seeds !== registered.benchmark.seeds ||
    input.maxRounds !== registered.benchmark.maxRounds ||
    input.initialHealth !== registered.benchmark.initialHealth ||
    !arraysEqual(input.scenarioIds, registered.benchmark.scenarioIds) ||
    !arraysEqual(input.rotations, AI_COOPERATIVE_CEM_SELECTION_ROTATIONS) ||
    !arraysEqual(input.scoredPlayerIds, AI_COOPERATIVE_CEM_SELECTION_PLAYER_IDS)
  ) {
    throw new Error(
      "cooperative CEM selection benchmark configuration does not match registration",
    );
  }
  if (!arraysEqual(input.scenarioIds, AI_BENCHMARK_SCENARIOS)) {
    throw new Error("cooperative CEM selection scenario registration drifted");
  }
  const expectedProvenance = registered.expectedProvenance;
  if (
    input.policyVersion !== expectedProvenance.policyVersion ||
    input.contentVersion !== expectedProvenance.contentVersion ||
    input.contentSnapshotSha256 !== expectedProvenance.contentSnapshotSha256 ||
    input.evaluatorHash !== expectedProvenance.evaluatorHash ||
    input.strategyProfileHash !== expectedProvenance.strategyProfileHash ||
    input.candidateProfileHash !== expectedProvenance.candidateProfileHash
  ) {
    throw new Error("cooperative CEM selection provenance does not match registration");
  }
  assertAiCooperativeCemSelectionCandidateScope(input.candidate);
}
