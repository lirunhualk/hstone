import assert from "node:assert/strict";
import test from "node:test";

import {
  getAiStrategyProfile,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import type { AiResidualPolicy } from "../lib/game/ai-residual-policy.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
  AI_COOPERATIVE_CEM_ROSTER_FINAL_SEEDS,
  AI_COOPERATIVE_CEM_SELECTION_SEEDS,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_TRAINING_SEEDS,
} from "../scripts/ai-cooperative-cem-registration.ts";
import { AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256 } from "../scripts/ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_POLICY_SUITE_PLAYER_IDS,
  AI_POLICY_SUITE_ROTATIONS,
  assertAiCooperativeCemHistoricalCandidateScope,
  assertAiCooperativeCemTrainingBenchmarkContract,
  evaluateAiPolicySuitePromotionGate,
  isAiPolicySuiteDrawRateNonInferior,
  runAiPolicySuiteBenchmark,
  type AiPolicySuiteCandidate,
  type AiPolicySuitePlayerId,
} from "../scripts/benchmark-ai-policy-suite.ts";

test("promotion gate rejects no-op evidence and accepts a significant seven-profile improvement", () => {
  const metric = (
    meanDelta: number,
    lower: number,
    upper: number,
  ) => ({
    pairedSeats: 2_688,
    seedClusters: 24,
    meanDelta,
    confidence95: { lower, upper },
  });
  const noOp = {
    placement: metric(0, 0, 0),
    topFour: metric(0, 0, 0),
    win: metric(0, 0, 0),
  };
  const improved = {
    placement: metric(-0.2, -0.3, -0.1),
    topFour: metric(0.03, 0, 0.06),
    win: metric(0.01, -0.01, 0.03),
  };
  const profileIds = [
    "balanced",
    "magnetic",
    "tempo",
    "triple",
    "powerLevel",
    "economy",
    "deathrattle",
  ] as const;
  const byProfile = Object.fromEntries(
    profileIds.map((profileId) => [profileId, improved]),
  );

  const rejected = evaluateAiPolicySuitePromotionGate({
    seeds: 24,
    evidenceUsable: true,
    comparisons: noOp,
    byProfile,
    profileIds,
  });
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.reasons.some((reason) => reason.includes("-0.10")));

  assert.deepEqual(
    evaluateAiPolicySuitePromotionGate({
      seeds: 24,
      evidenceUsable: true,
      comparisons: improved,
      byProfile,
      profileIds,
    }),
    { accepted: true, reasons: [] },
  );
});

function suiteProfileOverrides(
  maxRefreshesDelta = 0,
): Map<string, AiStrategyProfile> {
  return new Map(
    AI_POLICY_SUITE_PLAYER_IDS.map((playerId) => {
      const profile = getAiStrategyProfile(playerId);
      return [
        playerId,
        {
          ...profile,
          maxRefreshes: profile.maxRefreshes + maxRefreshesDelta,
        },
      ] as const;
    }),
  );
}

function abstainingPolicy(playerId: AiPolicySuitePlayerId): AiResidualPolicy {
  return {
    policyId: `suite-abstain-${playerId}`,
    policyVersion: "1",
    propose: () => null,
  };
}

function cooperativeCemProfileOverrides(): Map<string, AiStrategyProfile> {
  const overrides = suiteProfileOverrides();
  const focus = overrides.get("player-5");
  assert.ok(focus);
  overrides.set("player-5", { ...focus, maxRefreshes: 3 });
  return overrides;
}

test("suite preflight requires a complete candidate and unique scenarios", () => {
  let progressCalls = 0;
  assert.throws(
    () =>
      runAiPolicySuiteBenchmark({
        candidate: {},
        onProgress: () => {
          progressCalls += 1;
        },
      }),
    /requires profileOverrides or createResidualPolicy/,
  );

  const partialProfiles = suiteProfileOverrides();
  partialProfiles.delete("player-7");
  assert.throws(
    () =>
      runAiPolicySuiteBenchmark({
        candidate: { profileOverrides: partialProfiles },
      }),
    /exactly player-1 through player-7/,
  );
  assert.throws(
    () =>
      runAiPolicySuiteBenchmark({
        candidate: { profileOverrides: suiteProfileOverrides() },
        scenarioIds: ["neutral-v1", "neutral-v1"],
      }),
    /duplicate AI benchmark scenario/,
  );
  assert.equal(progressCalls, 0);
});

test("policy suite rejects sealed 304 and 305 seeds before candidate creation", () => {
  let providerCreations = 0;
  let progressCalls = 0;
  for (const [startSeed, seeds] of [
    [30_400_001, 64],
    [30_500_001, 96],
  ] as const) {
    assert.throws(
      () =>
        runAiPolicySuiteBenchmark({
          candidate: {
            createResidualPolicy(playerId) {
              providerCreations += 1;
              return abstainingPolicy(playerId);
            },
          },
          startSeed,
          seeds,
          maxRounds: 1,
          scenarioIds: ["neutral-v1"],
          onProgress: () => {
            progressCalls += 1;
          },
        }),
      /seed ledger rejected access.*sealed ledger entry/,
    );
  }
  assert.equal(providerCreations, 0);
  assert.equal(progressCalls, 0);
});

test("completed cooperative CEM training contract is retired before seed access", () => {
  const candidate = { profileOverrides: cooperativeCemProfileOverrides() };
  assert.throws(
    () =>
      assertAiCooperativeCemTrainingBenchmarkContract({
        candidate,
        startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed,
        seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds,
        maxRounds: 150,
        initialHealth: 40,
        scenarioIds: ["neutral-v1", "live-lobby-v1"],
        reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
        reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
        reservationProtocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
        reservationImplementationSha256:
          AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
        reservationConfirmation: AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
      }),
    /cooperative CEM implementation drifted/,
  );
  assert.throws(
    () =>
      assertAiCooperativeCemTrainingBenchmarkContract({
        candidate,
        startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed,
        seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds,
        maxRounds: 1,
        initialHealth: 40,
        scenarioIds: ["neutral-v1", "live-lobby-v1"],
        reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
        reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
        reservationProtocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
        reservationImplementationSha256:
          AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
        reservationConfirmation:
          AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
      }),
    /cooperative CEM implementation drifted/,
  );

  let progressCalls = 0;
  for (const request of [
    {
      startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed,
      seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds,
    },
    {
      startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed,
      seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds - 1,
      reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
      reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
      reservationProtocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    },
    {
      startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed - 1,
      seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds + 2,
      reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
      reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
      reservationProtocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    },
  ] as const) {
    assert.throws(
      () =>
        runAiPolicySuiteBenchmark({
          candidate,
          ...request,
          maxRounds: 1,
          scenarioIds: ["neutral-v1", "neutral-v1"],
          onProgress: () => {
            progressCalls += 1;
          },
        }),
      /seed ledger rejected access/,
    );
  }
  assert.equal(progressCalls, 0);

  assert.throws(
    () =>
      runAiPolicySuiteBenchmark({
        candidate,
        startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed,
        seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds,
        reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
        reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
        reservationProtocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
        reservationImplementationSha256:
          AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
        reservationConfirmation:
          AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
        initialHealth: 1,
        maxRounds: 1,
        scenarioIds: ["neutral-v1"],
        onProgress: () => {
          progressCalls += 1;
        },
      }),
    /seed ledger rejected access.*consumed ledger entry/,
  );
  assert.equal(progressCalls, 0);
});

test("historical cooperative CEM candidate scope rejects every out-of-scope override", () => {
  const nonFocusDrift = cooperativeCemProfileOverrides();
  const nonFocus = nonFocusDrift.get("player-1");
  assert.ok(nonFocus);
  nonFocusDrift.set("player-1", {
    ...nonFocus,
    maxRefreshes: nonFocus.maxRefreshes + 1,
  });
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalCandidateScope({
        profileOverrides: nonFocusDrift,
      }),
    /may only change registered genes on player-5; player-1\.maxRefreshes drifted/,
  );

  const outsideGrid = cooperativeCemProfileOverrides();
  const outsideGridFocus = outsideGrid.get("player-5");
  assert.ok(outsideGridFocus);
  outsideGrid.set("player-5", {
    ...outsideGridFocus,
    maxRefreshes: 999,
  });
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalCandidateScope({
        profileOverrides: outsideGrid,
      }),
    /player-5\.maxRefreshes is outside the registered grid/,
  );

  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalCandidateScope({
        profileOverrides: cooperativeCemProfileOverrides(),
        createResidualPolicy: abstainingPolicy,
      }),
    /does not permit residual policy overrides/,
  );

  const extraProfileOverride = cooperativeCemProfileOverrides();
  const extraProfileFocus = extraProfileOverride.get("player-5");
  assert.ok(extraProfileFocus);
  extraProfileOverride.set(
    "player-5",
    Object.assign({}, extraProfileFocus, { unregisteredOverride: 1 }),
  );
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalCandidateScope({
        profileOverrides: extraProfileOverride,
      }),
    /player-5 profile keys must match production/,
  );
});

test("consumed CEM selection and sealed roster-final seeds fail at their distinct ledger boundaries", () => {
  const candidate = { profileOverrides: suiteProfileOverrides() };
  let progressCalls = 0;
  const runProtectedPhase = (phase: { startSeed: number; seeds: number }) =>
    runAiPolicySuiteBenchmark({
      candidate,
      startSeed: phase.startSeed,
      seeds: phase.seeds,
      maxRounds: 1,
      scenarioIds: ["neutral-v1", "neutral-v1"],
      onProgress: () => {
        progressCalls += 1;
      },
    });

  assert.throws(
    () => runProtectedPhase(AI_COOPERATIVE_CEM_SELECTION_SEEDS),
    /seed ledger rejected access.*consumed ledger entry.*93100001-consumed-v1/,
  );
  assert.throws(
    () => runProtectedPhase(AI_COOPERATIVE_CEM_ROSTER_FINAL_SEEDS),
    /seed ledger rejected access.*sealed ledger entry/,
  );
  assert.equal(progressCalls, 0);
});

test("dual-scenario suite is deterministic, fully scheduled, and clustered only by seed", () => {
  const profileOverrides = suiteProfileOverrides(1);
  const candidate: AiPolicySuiteCandidate = {
    profileOverrides,
  };
  const options = {
    candidate,
    seeds: 1,
    startSeed: 0xc001,
    initialHealth: 1,
  } as const;

  const first = runAiPolicySuiteBenchmark(options);
  const second = runAiPolicySuiteBenchmark(options);
  assert.deepEqual(first, second);

  assert.equal(first.config.maxRounds, 150);
  assert.deepEqual(first.config.scenarioIds, [
    "neutral-v1",
    "live-lobby-v1",
  ]);
  assert.deepEqual(first.config.rotations, AI_POLICY_SUITE_ROTATIONS);
  assert.deepEqual(first.config.scoredPlayerIds, AI_POLICY_SUITE_PLAYER_IDS);
  assert.equal(first.config.controlPlayerId, "player-0");
  assert.equal(first.progress.scheduledRuns, 32);
  assert.equal(first.progress.processedRuns, 32);
  assert.equal(first.clusters.length, 1);
  assert.equal(first.clusters[0]?.episodes.length, 16);
  assert.equal(first.expectedPairs, 112);
  assert.equal(first.pairedPairs, 112);
  assert.equal(first.missingPairs, 0);
  assert.equal(first.truncatedRuns, 0);
  assert.equal(first.runnerFailures.length, 0);
  assert.equal(first.providerErrorTotal, 0);
  assert.equal(first.strategyProfiles.length, 7);
  assert.deepEqual(
    first.strategyProfiles.map((snapshot) => snapshot.playerId),
    AI_POLICY_SUITE_PLAYER_IDS,
  );

  const pairs = first.clusters[0]?.pairs ?? [];
  assert.equal(pairs.length, 112);
  assert.equal(new Set(pairs.map((pair) => pair.pairKey)).size, 112);
  assert.ok(
    pairs.every(
      (pair) =>
        pair.pairKey ===
        `seed:${pair.seed}|scenario:${pair.scenarioId}|rotation:${pair.rotation}|profile:${pair.profileId}`,
    ),
  );

  assert.deepEqual(first.comparisons, first.comparisonMatrix.overall);
  assert.equal(first.comparisonMatrix.overall.placement.seedClusters, 1);
  assert.equal(first.comparisonMatrix.overall.placement.pairedSeats, 112);
  for (const scenarioId of ["neutral-v1", "live-lobby-v1"] as const) {
    const scenario = first.comparisonMatrix.byScenario[scenarioId];
    assert.ok(scenario);
    assert.equal(scenario.placement.seedClusters, 1);
    assert.equal(scenario.placement.pairedSeats, 56);
    for (const snapshot of first.strategyProfiles) {
      const cell =
        first.comparisonMatrix.byScenarioProfile[scenarioId]?.[
          snapshot.profile.id
        ];
      assert.ok(cell);
      assert.equal(cell.placement.seedClusters, 1);
      assert.equal(cell.placement.pairedSeats, 8);
    }
  }
  for (const snapshot of first.strategyProfiles) {
    const profile = first.comparisonMatrix.byProfile[snapshot.profile.id];
    assert.ok(profile);
    assert.equal(profile.placement.seedClusters, 1);
    assert.equal(profile.placement.pairedSeats, 16);
  }
});

test("candidate can deploy profile and fresh residual overrides together", () => {
  const profileOverrides = suiteProfileOverrides(1);
  let providersCreated = 0;
  const result = runAiPolicySuiteBenchmark({
    candidate: {
      profileOverrides,
      createResidualPolicy(playerId) {
        providersCreated += 1;
        assert.equal(
          getAiStrategyProfile(playerId).maxRefreshes,
          profileOverrides.get(playerId)?.maxRefreshes,
          "provider factory runs inside the candidate profile scope",
        );
        return abstainingPolicy(playerId);
      },
    },
    seeds: 1,
    startSeed: 0xc051,
    maxRounds: 1,
    scenarioIds: ["neutral-v1"],
  });

  assert.equal(providersCreated, 56);
  assert.equal(result.config.profileOverridesProvided, true);
  assert.equal(result.config.residualPolicyProvided, true);
  assert.equal(result.progress.scheduledRuns, 16);
  assert.equal(result.progress.processedRuns, 16);
  assert.equal(Object.keys(result.residualPolicyIdentities).length, 7);
  assert.equal(result.runnerFailures.length, 0);
});

test("draw-rate non-inferiority rejects a paired confidence bound above the margin", () => {
  assert.equal(
    isAiPolicySuiteDrawRateNonInferior({
      pairedGames: 16,
      seedClusters: 2,
      meanDelta: 0.125,
      confidence95: { lower: 0.125, upper: 0.125 },
      nonInferiorityMargin: 0.01,
    }),
    false,
  );
  assert.equal(
    isAiPolicySuiteDrawRateNonInferior({
      pairedGames: 192,
      seedClusters: 24,
      meanDelta: -0.01,
      confidence95: { lower: -0.02, upper: 0.005 },
      nonInferiorityMargin: 0.01,
    }),
    true,
  );
  assert.equal(
    isAiPolicySuiteDrawRateNonInferior({
      pairedGames: 16,
      seedClusters: 2,
      meanDelta: 0,
      confidence95: null,
      nonInferiorityMargin: 0.01,
    }),
    true,
  );
});

test("provider errors reject affected pairs and the suite evidence", () => {
  const result = runAiPolicySuiteBenchmark({
    candidate: {
      createResidualPolicy(playerId) {
        return {
          policyId: `suite-error-${playerId}`,
          policyVersion: "1",
          propose() {
            throw new Error("provider failed");
          },
        };
      },
    },
    seeds: 1,
    startSeed: 0xc101,
    maxRounds: 1,
    scenarioIds: ["neutral-v1"],
  });

  assert.ok(result.providerDiagnostics.providerErrors > 0);
  assert.ok(result.providerErrorTotal > 0);
  assert.ok(result.missingPairs > 0);
  assert.equal(result.accepted, false);
  assert.ok(
    result.acceptanceReasons.some((reason) => reason.includes("provider")),
  );
});

test("factory failures and residual identity drift fail closed", () => {
  const factoryFailure = runAiPolicySuiteBenchmark({
    candidate: {
      createResidualPolicy(playerId) {
        if (playerId === "player-3") throw new Error("model unavailable");
        return abstainingPolicy(playerId);
      },
    },
    seeds: 1,
    startSeed: 0xc201,
    maxRounds: 1,
    scenarioIds: ["neutral-v1"],
  });
  assert.equal(factoryFailure.runnerFailures.length, 8);
  assert.equal(factoryFailure.pairedPairs, 0);
  assert.equal(factoryFailure.missingPairs, 56);
  assert.equal(factoryFailure.accepted, false);

  const identityDrift = runAiPolicySuiteBenchmark({
    candidate: {
      createResidualPolicy(playerId, episode) {
        return {
          ...abstainingPolicy(playerId),
          policyVersion: episode.rotation === 0 ? "1" : "2",
        };
      },
    },
    seeds: 1,
    startSeed: 0xc301,
    maxRounds: 1,
    scenarioIds: ["neutral-v1"],
  });
  assert.equal(identityDrift.accepted, false);
  assert.ok(
    identityDrift.runnerFailures.some((failure) =>
      failure.message.includes("identity drifted"),
    ),
  );
  assert.ok(identityDrift.missingPairs > 0);
});
