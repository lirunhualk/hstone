import assert from "node:assert/strict";
import test from "node:test";

import { getAiStrategyProfile } from "../lib/game/ai.ts";
import {
  AI_BENCHMARK_SCENARIOS,
  type AiBenchmarkScenarioId,
} from "../scripts/ai-benchmark-scenarios.ts";
import {
  AI_RECRUIT_SAFETY_DEFAULT_START_SEED,
  AI_RECRUIT_SAFETY_PLAYER_IDS,
  createAiRecruitSafetyModeMap,
  evaluateAiRecruitSafetyScreeningGate,
  runAiRecruitSafetyBenchmark,
  sumAiRecruitSafetyPlayerDiagnostics,
  summarizeAiRecruitSafetyClusters,
  type AiRecruitSafetyPair,
  type AiRecruitSafetyPlayerId,
  type AiRecruitSafetySeedCluster,
} from "../scripts/benchmark-ai-recruit-safety.ts";

const ALL_PLAYER_IDS = Object.freeze([
  "player-0",
  ...AI_RECRUIT_SAFETY_PLAYER_IDS,
]);

test("recruit-safety benchmark rejects protected seeds before progress", () => {
  let progressCalls = 0;
  for (const startSeed of [
    51_001,
    30_100_001,
    30_200_001,
    30_300_001,
    30_400_001,
    30_500_001,
  ]) {
    assert.throws(
      () =>
        runAiRecruitSafetyBenchmark({
          seeds: 1,
          startSeed,
          maxRounds: 1,
          onProgress: () => {
            progressCalls += 1;
          },
        }),
      /AI benchmark seed ledger rejected access/,
    );
  }
  assert.equal(progressCalls, 0);
  assert.equal(AI_RECRUIT_SAFETY_DEFAULT_START_SEED, 90_040_001);
});

test("mode maps isolate safe-v4 to one physical player", () => {
  const baseline = createAiRecruitSafetyModeMap(ALL_PLAYER_IDS, null);
  assert.deepEqual(
    Object.values(baseline),
    ALL_PLAYER_IDS.map(() => "legacy-v3"),
  );

  const candidate = createAiRecruitSafetyModeMap(
    ALL_PLAYER_IDS,
    "player-4",
  );
  assert.equal(candidate["player-4"], "safe-v4");
  assert.equal(
    Object.values(candidate).filter((mode) => mode === "safe-v4").length,
    1,
  );
  for (const playerId of ALL_PLAYER_IDS.filter(
    (candidateId) => candidateId !== "player-4",
  )) {
    assert.equal(candidate[playerId], "legacy-v3");
  }

  assert.throws(
    () => createAiRecruitSafetyModeMap(["player-0", "player-0"], null),
    /unique list/,
  );
  assert.throws(
    () =>
      createAiRecruitSafetyModeMap(
        ALL_PLAYER_IDS.filter((playerId) => playerId !== "player-7"),
        "player-7",
      ),
    /safe player/,
  );
});

test("diagnostic aggregation is additive and rejects invalid counters", () => {
  const total = sumAiRecruitSafetyPlayerDiagnostics([
    {
      minionDamageOpportunities: 2,
      minionBlocks: 1,
      heroPowerDamageOpportunities: 3,
      heroPowerBlocks: 1,
      decisionDivergences: 1,
      rewinderExemptions: 1,
      floorCrossings: 2,
      lethalRisks: 1,
    },
    {
      minionDamageOpportunities: 4,
      minionBlocks: 2,
      heroPowerDamageOpportunities: 1,
      heroPowerBlocks: 0,
      decisionDivergences: 2,
      rewinderExemptions: 3,
      floorCrossings: 5,
      lethalRisks: 2,
    },
  ]);
  assert.deepEqual(total, {
    minionDamageOpportunities: 6,
    minionBlocks: 3,
    heroPowerDamageOpportunities: 4,
    heroPowerBlocks: 1,
    decisionDivergences: 3,
    rewinderExemptions: 4,
    floorCrossings: 7,
    lethalRisks: 3,
  });
  assert.throws(
    () =>
      sumAiRecruitSafetyPlayerDiagnostics([
        { ...total, minionBlocks: -1 },
      ]),
    /non-negative integer/,
  );
});

test("screening gate fails closed without focal treatment exposure", () => {
  const noExposure = evaluateAiRecruitSafetyScreeningGate({
    evidenceReasons: [],
    plannerGate: { accepted: true, reasons: [] },
    focalDecisionDivergences: 0,
  });
  assert.deepEqual(noExposure, {
    accepted: false,
    reasons: [
      "requires at least one focal recruit-safety decision divergence",
    ],
  });
  assert.deepEqual(
    evaluateAiRecruitSafetyScreeningGate({
      evidenceReasons: [],
      plannerGate: { accepted: true, reasons: [] },
      focalDecisionDivergences: 1,
    }),
    { accepted: true, reasons: [] },
  );
  assert.throws(
    () =>
      evaluateAiRecruitSafetyScreeningGate({
        evidenceReasons: [],
        plannerGate: { accepted: true, reasons: [] },
        focalDecisionDivergences: -1,
      }),
    /non-negative integer/,
  );
});

function syntheticPair(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  playerId: AiRecruitSafetyPlayerId,
): AiRecruitSafetyPair {
  const profileId = getAiStrategyProfile(playerId).id;
  return {
    pairKey: `${seed}|${scenarioId}|${playerId}|${profileId}`,
    seed,
    scenarioId,
    playerId,
    profileId,
    baselinePlacementBounds: { best: 4, worst: 4, exact: true },
    candidatePlacementBounds: { best: 3, worst: 3, exact: true },
    placementDelta: -1,
    topFourDelta: 0,
    winDelta: 0,
  };
}

test("comparison matrix treats seeds as clusters across both scenarios", () => {
  const clusters: AiRecruitSafetySeedCluster[] = [1, 2].map((seed) => {
    const pairs = AI_BENCHMARK_SCENARIOS.flatMap((scenarioId) =>
      AI_RECRUIT_SAFETY_PLAYER_IDS.map((playerId) =>
        syntheticPair(seed, scenarioId, playerId),
      ),
    );
    return {
      seed,
      episodes: [],
      pairs,
      metric: {
        seed,
        placementDelta: -1,
        topFourDelta: 0,
        winDelta: 0,
      },
    };
  });
  const summarized = summarizeAiRecruitSafetyClusters(clusters);

  assert.equal(summarized.logicalPairedSeats, 2 * 7);
  assert.equal(
    summarized.comparisonMatrix.overall.placement.pairedSeats,
    2 * 7,
  );
  assert.equal(
    summarized.comparisonMatrix.overall.placement.seedClusters,
    2,
  );
  assert.equal(
    summarized.comparisonMatrix.overall.placement.meanDelta,
    -1,
  );
  for (const scenarioId of AI_BENCHMARK_SCENARIOS) {
    assert.equal(
      summarized.comparisonMatrix.byScenario[scenarioId]?.placement
        .pairedSeats,
      2 * 7,
    );
  }
  for (const playerId of AI_RECRUIT_SAFETY_PLAYER_IDS) {
    const profileId = getAiStrategyProfile(playerId).id;
    assert.equal(
      summarized.comparisonMatrix.byProfile[profileId]?.placement.pairedSeats,
      2 * AI_BENCHMARK_SCENARIOS.length,
    );
  }
});

test("one short seed schedules all-legacy plus seven focal candidates in both scenarios deterministically", () => {
  const progress: Array<{
    scenarioId: string;
    arm: string;
    controlledPlayerId: string | null;
  }> = [];
  const options = {
    seeds: 1,
    startSeed: AI_RECRUIT_SAFETY_DEFAULT_START_SEED,
    maxRounds: 1,
    initialHealth: 40,
  } as const;
  const first = runAiRecruitSafetyBenchmark({
    ...options,
    onProgress: (item) =>
      progress.push({
        scenarioId: item.scenarioId,
        arm: item.arm,
        controlledPlayerId: item.controlledPlayerId,
      }),
  });
  const second = runAiRecruitSafetyBenchmark(options);

  assert.deepEqual(first, second);
  assert.equal(first.config.startSeed, 90_040_001);
  assert.deepEqual(first.config.scenarioIds, AI_BENCHMARK_SCENARIOS);
  assert.equal(first.progress.scheduledRuns, 2 * 8);
  assert.equal(first.progress.processedRuns, 2 * 8);
  assert.equal(first.progress.failedRuns, 0);
  assert.deepEqual(first.runnerFailures, []);
  assert.equal(first.clusters.length, 1);
  assert.equal(first.clusters[0]?.episodes.length, 2);
  assert.equal(first.expectedPairs, 2 * 7);
  assert.equal(first.pairedPairs, 0);
  assert.equal(first.truncatedRuns, 2 * 8);
  assert.equal(first.evidenceUsable, false);
  assert.equal(first.focalDecisionDivergences, 0);
  assert.equal(first.treatmentExposed, false);
  assert.equal(first.accepted, false);
  assert.ok(
    first.acceptanceReasons.some((reason) => reason.includes("24")),
  );
  assert.ok(
    first.acceptanceReasons.includes(
      "requires at least one focal recruit-safety decision divergence",
    ),
  );

  assert.deepEqual(
    progress,
    AI_BENCHMARK_SCENARIOS.flatMap((scenarioId) => [
      {
        scenarioId,
        arm: "baseline",
        controlledPlayerId: null,
      },
      ...AI_RECRUIT_SAFETY_PLAYER_IDS.map((controlledPlayerId) => ({
        scenarioId,
        arm: "candidate",
        controlledPlayerId,
      })),
    ]),
  );

  assert.equal(first.safetyDiagnostics.baselineAllPlayers.minionBlocks, 0);
  assert.equal(
    first.safetyDiagnostics.baselineAllPlayers.heroPowerBlocks,
    0,
  );
  assert.equal(
    Object.keys(first.safetyDiagnostics.candidateFocalByScenario).length,
    2,
  );
  assert.equal(
    Object.keys(first.safetyDiagnostics.candidateFocalByProfile).length,
    7,
  );
  const focal = first.safetyDiagnostics.candidateFocalPlayers;
  assert.ok(
    focal.minionBlocks + focal.heroPowerBlocks <= focal.floorCrossings,
  );
});
