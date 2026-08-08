import assert from "node:assert/strict";
import test from "node:test";

import type { AiStrategyProfile } from "../lib/game/ai.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PLAYER_IDS,
  AI_COOPERATIVE_CEM_SELECTION_ROTATIONS,
  assertAiCooperativeCemSelectionBenchmarkContract,
  assertAiCooperativeCemSelectionCandidateScope,
  buildAiCooperativeCemSelectionCandidateProfileOverrides,
  type AiCooperativeCemSelectionBenchmarkContractInput,
} from "../scripts/ai-cooperative-cem-selection-contract.ts";
import { AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256 } from "../scripts/ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "../scripts/ai-cooperative-cem-selection-registration.ts";
import { AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 } from "../scripts/ai-cooperative-cem-training-result.ts";
import type { AiPolicySuiteCandidate } from "../scripts/benchmark-ai-policy-suite.ts";

function validContractInput(): AiCooperativeCemSelectionBenchmarkContractInput {
  const registration = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  return {
    candidate: {
      profileOverrides:
        buildAiCooperativeCemSelectionCandidateProfileOverrides(),
    },
    seeds: registration.benchmark.seeds,
    startSeed: registration.benchmark.startSeed,
    maxRounds: registration.benchmark.maxRounds,
    initialHealth: registration.benchmark.initialHealth,
    scenarioIds: [...registration.benchmark.scenarioIds],
    rotations: [...AI_COOPERATIVE_CEM_SELECTION_ROTATIONS],
    scoredPlayerIds: [...AI_COOPERATIVE_CEM_SELECTION_PLAYER_IDS],
    reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
    reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
    reservationProtocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    reservationImplementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    reservationConfirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
    reservationTrainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    ...registration.expectedProvenance,
  };
}

function mutableProfiles(): Map<string, AiStrategyProfile> {
  return new Map(buildAiCooperativeCemSelectionCandidateProfileOverrides());
}

function replaceProfile(
  profiles: Map<string, AiStrategyProfile>,
  playerId: string,
  mutate: (profile: AiStrategyProfile) => AiStrategyProfile,
): void {
  const profile = profiles.get(playerId);
  assert.ok(profile);
  profiles.set(playerId, mutate(profile));
}

test("selection candidate scope accepts only the exact seven-profile candidate", () => {
  const candidate: AiPolicySuiteCandidate = {
    profileOverrides:
      buildAiCooperativeCemSelectionCandidateProfileOverrides(),
  };
  assert.doesNotThrow(() =>
    assertAiCooperativeCemSelectionCandidateScope(candidate),
  );

  const missing = mutableProfiles();
  missing.delete("player-7");
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides: missing,
      }),
    /exactly player-1 through player-7/,
  );

  const extra = mutableProfiles();
  const player1 = extra.get("player-1");
  assert.ok(player1);
  extra.set("player-8", player1);
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides: extra,
      }),
    /exactly player-1 through player-7/,
  );
});

test("selection candidate scope rejects non-focus drift and profile-key drift", () => {
  const nonFocusDrift = mutableProfiles();
  replaceProfile(nonFocusDrift, "player-1", (profile) => ({
    ...profile,
    maxRefreshes: profile.maxRefreshes + 1,
  }));
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides: nonFocusDrift,
      }),
    /player-1 profile does not match the registered candidate/,
  );

  const extraKey = mutableProfiles();
  replaceProfile(extraKey, "player-2", (profile) =>
    ({ ...profile, unregisteredGene: 1 }) as AiStrategyProfile,
  );
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides: extraKey,
      }),
    /player-2 profile keys must match production/,
  );
});

test("selection candidate scope rejects focus drift and residual policies", () => {
  const focusDrift = mutableProfiles();
  replaceProfile(focusDrift, "player-5", (profile) => ({
    ...profile,
    minimumUpgradeHealth: profile.minimumUpgradeHealth + 1,
  }));
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides: focusDrift,
      }),
    /player-5 profile does not match the registered candidate/,
  );

  let residualFactoryCalls = 0;
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides:
          buildAiCooperativeCemSelectionCandidateProfileOverrides(),
        createResidualPolicy() {
          residualFactoryCalls += 1;
          throw new Error("must never construct a residual policy");
        },
      }),
    /does not permit residual policy overrides/,
  );
  assert.equal(residualFactoryCalls, 0);
});

test("selection contract rejects a wrong training-result capability before candidate use", () => {
  let candidateRead = false;
  const input = validContractInput();
  const guarded = {
    ...input,
    get candidate(): AiPolicySuiteCandidate {
      candidateRead = true;
      throw new Error("candidate must not be inspected");
    },
    reservationTrainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 === "1".repeat(64)
        ? "2".repeat(64)
        : "1".repeat(64),
  };
  assert.throws(
    () => assertAiCooperativeCemSelectionBenchmarkContract(guarded),
    /capability does not match registration/,
  );
  assert.equal(candidateRead, false);
});

test("retired selection contract rejects before live provenance can be reused", () => {
  const cases: ReadonlyArray<
    readonly [
      keyof Pick<
        AiCooperativeCemSelectionBenchmarkContractInput,
        | "contentVersion"
        | "contentSnapshotSha256"
        | "evaluatorHash"
        | "strategyProfileHash"
        | "candidateProfileHash"
      >,
      string,
    ]
  > = [
    ["contentVersion", "wrong-content-version"],
    ["contentSnapshotSha256", "1".repeat(64)],
    ["evaluatorHash", "2".repeat(64)],
    ["strategyProfileHash", "3".repeat(64)],
    ["candidateProfileHash", "4".repeat(64)],
  ];

  for (const [property, value] of cases) {
    const input = { ...validContractInput(), [property]: value };
    assert.throws(
      () => assertAiCooperativeCemSelectionBenchmarkContract(input),
      /selection implementation drifted/,
      property,
    );
  }
});
