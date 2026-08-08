import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { getAiStrategyProfile } from "../lib/game/ai.ts";
import type { GameState } from "../lib/game/types.ts";
import type { AiBenchmarkScenarioId } from "../scripts/ai-benchmark-scenarios.ts";
import {
  AI_CAPITAL_SALE_DEFAULT_PAIRS_PER_SEED,
  AI_CAPITAL_SALE_DEFAULT_RUNS_PER_SEED,
  AI_CAPITAL_SALE_PLAYER_IDS,
  createAiCapitalSaleModeMap,
  evaluateAiCapitalSaleGate,
  normalizeAiCapitalSaleDiagnostics,
  parseAiCapitalSaleCliArguments,
  runAiCapitalSaleBenchmarkWithRunner,
  sumAiCapitalSaleDiagnostics,
  type AiCapitalSaleCandidateMode,
  type AiCapitalSaleComparisonMatrix,
  type AiCapitalSaleEpisodeRunner,
  type AiCapitalSaleGateInput,
  type AiCapitalSalePlayerDiagnostics,
} from "../scripts/benchmark-ai-capital-sale.ts";
import type { AiRecruitPlannerComparisons } from "../scripts/benchmark-ai-recruit-planner.ts";

const PLAYER_IDS = Object.freeze(
  Array.from({ length: 8 }, (_, index) => `player-${index}`),
);
const SCENARIO_IDS = Object.freeze([
  "neutral-v1",
  "live-lobby-v1",
] as const satisfies readonly AiBenchmarkScenarioId[]);
const PROFILE_IDS = Object.freeze(
  AI_CAPITAL_SALE_PLAYER_IDS.map(
    (playerId) => getAiStrategyProfile(playerId).id,
  ),
);

function playerDiagnostics(
  overrides: Partial<AiCapitalSalePlayerDiagnostics> = {},
): AiCapitalSalePlayerDiagnostics {
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
    ...overrides,
  };
}

function passingFocalDiagnostics(
  overrides: Partial<AiCapitalSalePlayerDiagnostics> = {},
): AiCapitalSalePlayerDiagnostics {
  return playerDiagnostics({
    eligible: 1,
    dryRunAccepted: 1,
    salesCommitted: 1,
    purchasesCommitted: 1,
    decisionDivergences: 1,
    ...overrides,
  });
}

function syntheticScenarioGame(
  scenarioId: AiBenchmarkScenarioId,
  seed = 90_050_001,
  initialHealth = 40,
): GameState {
  return {
    version: 11,
    contentVersion: "capital-sale-test-v1",
    initialHealth,
    seed,
    rngState: seed,
    phase: "recruit",
    round: 1,
    humanPlayerId: "player-0",
    winnerId: null,
    scenarioId,
    players: PLAYER_IDS.map((id) => ({
      id,
      isHuman: false,
      alive: true,
      placement: undefined,
    })),
  } as unknown as GameState;
}

function jsonSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function playerNumber(playerId: string): number {
  return Number(playerId.slice("player-".length));
}

function createSyntheticRunner(
  requests: Parameters<AiCapitalSaleEpisodeRunner>[0][] = [],
  candidateMode: AiCapitalSaleCandidateMode = "sell-one-v5",
): AiCapitalSaleEpisodeRunner {
  return (request) => {
    requests.push(request);
    assert.equal(jsonSha256(request.state), request.initialStateSha256);
    assert.equal(request.state.rngState, request.initialRngState);
    assert.equal(request.modes["player-0"], "legacy-v4");

    const treated = Object.entries(request.modes)
      .filter(([, mode]) => mode === candidateMode)
      .map(([playerId]) => playerId);
    if (request.arm === "baseline") {
      assert.equal(request.focalPlayerId, null);
      assert.equal(request.physicalSeat, null);
      assert.deepEqual(treated, []);
    } else {
      assert.notEqual(request.focalPlayerId, null);
      assert.deepEqual(treated, [request.focalPlayerId]);
      assert.equal(
        request.state.players[request.physicalSeat as number]?.id,
        request.focalPlayerId,
      );
    }

    const diagnostics = Object.fromEntries(
      request.state.players.map((player) => [
        player.id,
        request.arm === "candidate"
          ? playerDiagnostics({ eligible: 100 })
          : playerDiagnostics({ eligible: player.id === "player-0" ? 0 : 1 }),
      ]),
    );
    if (request.focalPlayerId !== null) {
      diagnostics[request.focalPlayerId] = playerDiagnostics({
        eligible: 1,
        dryRunAccepted: 1,
        salesCommitted: 1,
        purchasesCommitted: 1,
        decisionDivergences: 1,
      });
    }

    const state = request.state;
    const placements = new Map(
      state.players.map((player) => [player.id, playerNumber(player.id) + 1]),
    );
    if (request.focalPlayerId !== null) {
      const focalPlacement = placements.get(request.focalPlayerId) as number;
      const displacedPlayerId = `player-${focalPlacement - 2}`;
      placements.set(request.focalPlayerId, focalPlacement - 1);
      placements.set(displacedPlayerId, focalPlacement);
    }
    for (const player of state.players) {
      player.alive = false;
      player.placement = placements.get(player.id);
    }
    state.phase = "gameOver";
    state.round = 2;
    state.winnerId =
      state.players.find((player) => player.placement === 1)?.id ?? null;
    return { state, diagnostics: { byPlayer: diagnostics } };
  };
}

function passingComparisons(
  configuredSeeds = 24,
  pairsPerSeed = 112,
): AiRecruitPlannerComparisons {
  const pairedSeats = configuredSeeds * pairsPerSeed;
  return {
    placement: {
      pairedSeats,
      seedClusters: configuredSeeds,
      meanDelta: -0.2,
      confidence95: { lower: -0.3, upper: -0.1 },
    },
    topFour: {
      pairedSeats,
      seedClusters: configuredSeeds,
      meanDelta: 0,
      confidence95: { lower: -0.01, upper: 0.01 },
    },
    win: {
      pairedSeats,
      seedClusters: configuredSeeds,
      meanDelta: 0,
      confidence95: { lower: -0.01, upper: 0.01 },
    },
  };
}

function passingComparisonMatrix(
  configuredSeeds = 24,
): AiCapitalSaleComparisonMatrix {
  const byProfile: AiCapitalSaleComparisonMatrix["byProfile"] = {};
  const byScenario: AiCapitalSaleComparisonMatrix["byScenario"] = {};
  const byPhysicalSeat: AiCapitalSaleComparisonMatrix["byPhysicalSeat"] = {};
  for (const profileId of PROFILE_IDS) {
    byProfile[profileId] = passingComparisons(configuredSeeds, 16);
  }
  for (const scenarioId of SCENARIO_IDS) {
    byScenario[scenarioId] = passingComparisons(configuredSeeds, 56);
  }
  for (let physicalSeat = 0; physicalSeat < 8; physicalSeat += 1) {
    byPhysicalSeat[physicalSeat] = passingComparisons(configuredSeeds, 14);
  }
  return {
    overall: passingComparisons(configuredSeeds),
    byProfile,
    byScenario,
    byPhysicalSeat,
  };
}

function passingFocalDiagnosticsByProfile(): NonNullable<
  AiCapitalSaleGateInput["focalDiagnosticsByProfile"]
> {
  return Object.fromEntries(
    PROFILE_IDS.map((profileId) => [profileId, passingFocalDiagnostics()]),
  );
}

function passingGateInput(configuredSeeds = 24): AiCapitalSaleGateInput {
  const focalDiagnosticsByProfile = passingFocalDiagnosticsByProfile();
  return {
    configuredSeeds,
    configuredScenarioIds: SCENARIO_IDS,
    profileIds: PROFILE_IDS,
    technicalReasons: [],
    comparisonMatrix: passingComparisonMatrix(configuredSeeds),
    focalDiagnostics: sumAiCapitalSaleDiagnostics(
      Object.values(focalDiagnosticsByProfile),
    ),
    focalDiagnosticsByProfile,
    injectedRunner: false,
  };
}

test("capital-sale mode maps isolate exactly one focal player", () => {
  const baseline = createAiCapitalSaleModeMap(PLAYER_IDS, null);
  assert.deepEqual(new Set(Object.values(baseline)), new Set(["legacy-v4"]));

  for (const focalPlayerId of AI_CAPITAL_SALE_PLAYER_IDS) {
    const modes = createAiCapitalSaleModeMap(PLAYER_IDS, focalPlayerId);
    assert.equal(modes["player-0"], "legacy-v4");
    assert.deepEqual(
      Object.entries(modes)
        .filter(([, mode]) => mode === "sell-one-v5")
        .map(([playerId]) => playerId),
      [focalPlayerId],
    );

    const v6Modes = createAiCapitalSaleModeMap(
      PLAYER_IDS,
      focalPlayerId,
      "sell-one-v6-settled-warband",
    );
    assert.equal(v6Modes["player-0"], "legacy-v4");
    assert.deepEqual(
      Object.entries(v6Modes)
        .filter(([, mode]) => mode === "sell-one-v6-settled-warband")
        .map(([playerId]) => playerId),
      [focalPlayerId],
    );
  }

  assert.throws(
    () => createAiCapitalSaleModeMap(PLAYER_IDS.slice(1), null),
    /canonical player-0 through player-7/,
  );
});

test("injected evaluator creates all rotated focal pairs without nonfocal diagnostic inflation", () => {
  const requests: Parameters<AiCapitalSaleEpisodeRunner>[0][] = [];
  const options = {
    seeds: 1,
    startSeed: 90_050_001,
    maxRounds: 3,
  } as const;
  const dependencies = {
    createScenarioGame: syntheticScenarioGame,
    runEpisode: createSyntheticRunner(requests),
  } as const;
  const first = runAiCapitalSaleBenchmarkWithRunner(options, dependencies);
  const second = runAiCapitalSaleBenchmarkWithRunner(options, {
    createScenarioGame: syntheticScenarioGame,
    runEpisode: createSyntheticRunner(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.benchmarkVersion, 2);
  assert.equal(first.config.candidateEngineMode, "sell-one-v5");
  assert.equal(first.config.candidateMode, "single-focal-sell-one-v5");
  assert.equal(first.progress.scheduledRuns, AI_CAPITAL_SALE_DEFAULT_RUNS_PER_SEED);
  assert.equal(first.progress.processedRuns, AI_CAPITAL_SALE_DEFAULT_RUNS_PER_SEED);
  assert.equal(first.progress.completedRuns, AI_CAPITAL_SALE_DEFAULT_RUNS_PER_SEED);
  assert.equal(first.expectedPairs, AI_CAPITAL_SALE_DEFAULT_PAIRS_PER_SEED);
  assert.equal(first.pairedPairs, AI_CAPITAL_SALE_DEFAULT_PAIRS_PER_SEED);
  assert.equal(first.missingPairs, 0);
  assert.equal(first.clusters.length, 1);
  assert.equal(first.clusters[0]?.episodes.length, 16);
  assert.equal(first.clusters[0]?.pairs.length, 112);
  assert.equal(new Set(first.clusters[0]?.pairs.map((pair) => pair.pairKey)).size, 112);
  assert.ok(first.clusters[0]?.pairs.every((pair) => pair.initialStateMatched));
  assert.ok(first.clusters[0]?.pairs.every((pair) => pair.placementDelta === -1));
  assert.deepEqual(first.runnerFailures, []);
  assert.equal(first.technicalEvidenceUsable, true);
  assert.equal(first.screenEvidenceUsable, true);
  assert.equal(first.accepted, false);
  assert.ok(first.acceptanceReasons.includes("injected-runner evidence is test-only"));

  assert.equal(first.diagnostics.baselineScoredPlayers.eligible, 112);
  assert.equal(first.diagnostics.candidateFocalPlayers.eligible, 112);
  assert.equal(first.diagnostics.candidateFocalPlayers.decisionDivergences, 112);
  assert.equal(first.diagnostics.candidateFocalPlayers.postSaleAborts, 0);
  assert.equal(first.diagnostics.candidateFocalPlayers.fundingAborts, 0);
  assert.equal(first.diagnostics.candidateFocalPlayers.scoreAborts, 0);
  assert.equal(
    first.diagnostics.candidateFocalPlayers.settledWarbandScoreAborts,
    0,
  );
  assert.equal(first.diagnostics.candidateFocalPlayers.interactionAborts, 0);
  assert.equal(first.diagnostics.candidateFocalPlayers.executionFailureAborts, 0);
  assert.equal(first.focalSalesCommitted, 112);
  assert.equal(first.focalPurchasesCommitted, 112);
  assert.equal(first.focalDecisionDivergences, 112);
  assert.equal(first.focalExecutionFailureAborts, 0);
  assert.equal(first.diagnostics.candidateFocalByScenario["neutral-v1"]?.eligible, 56);
  assert.equal(first.diagnostics.candidateFocalByScenario["live-lobby-v1"]?.eligible, 56);
  for (const focalPlayerId of AI_CAPITAL_SALE_PLAYER_IDS) {
    const profileId = getAiStrategyProfile(focalPlayerId).id;
    assert.equal(first.diagnostics.candidateFocalByProfile[profileId]?.eligible, 16);
  }
  for (let physicalSeat = 0; physicalSeat < 8; physicalSeat += 1) {
    assert.equal(
      first.diagnostics.candidateFocalByPhysicalSeat[physicalSeat]?.eligible,
      14,
    );
    assert.equal(
      first.comparisonMatrix.byPhysicalSeat[physicalSeat]?.placement.pairedSeats,
      14,
    );
  }
  assert.equal(requests.length, 128);
});

test("injected evaluator records the explicit v6 candidate mode but never accepts it", () => {
  const requests: Parameters<AiCapitalSaleEpisodeRunner>[0][] = [];
  const result = runAiCapitalSaleBenchmarkWithRunner(
    {
      seeds: 1,
      startSeed: 90_050_001,
      maxRounds: 3,
      scenarioIds: ["neutral-v1"],
      candidateMode: "sell-one-v6-settled-warband",
    },
    {
      createScenarioGame: syntheticScenarioGame,
      runEpisode: createSyntheticRunner(
        requests,
        "sell-one-v6-settled-warband",
      ),
    },
  );

  assert.equal(
    result.config.candidateMode,
    "single-focal-sell-one-v6-settled-warband",
  );
  assert.equal(
    result.config.candidateEngineMode,
    "sell-one-v6-settled-warband",
  );
  assert.equal(result.screenEvidenceUsable, true);
  assert.equal(result.accepted, false);
  assert.ok(result.acceptanceReasons.includes("injected-runner evidence is test-only"));
  assert.equal(requests.length, 64);
});

test("capital-sale gate requires an exact focal ledger and 24 seed clusters", () => {
  const passing = evaluateAiCapitalSaleGate(passingGateInput());
  assert.equal(passing.screenEvidenceUsable, true);
  assert.equal(passing.accepted, true);
  assert.deepEqual(passing.reasons, []);

  const screenOnly = evaluateAiCapitalSaleGate({
    ...passingGateInput(8),
  });
  assert.equal(screenOnly.screenEvidenceUsable, true);
  assert.equal(screenOnly.accepted, false);
  assert.ok(screenOnly.reasons.includes("requires at least 24 seed clusters"));

  const injected = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    injectedRunner: true,
  });
  assert.equal(injected.screenEvidenceUsable, true);
  assert.equal(injected.accepted, false);
  assert.ok(injected.reasons.includes("injected-runner evidence is test-only"));

  const unexposed = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: playerDiagnostics(),
  });
  assert.equal(unexposed.screenEvidenceUsable, false);
  assert.equal(unexposed.accepted, false);

  const postSaleAbort = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: passingFocalDiagnostics({ postSaleAborts: 1 }),
  });
  assert.equal(postSaleAbort.screenEvidenceUsable, false);
  assert.equal(postSaleAbort.accepted, false);

  const impossibleEligibleLedger = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: passingFocalDiagnostics({ eligible: 2 }),
  });
  assert.equal(impossibleEligibleLedger.screenEvidenceUsable, false);
  assert.ok(
    impossibleEligibleLedger.reasons.includes(
      "requires every focal eligible decision to close into one terminal diagnostic",
    ),
  );

  const impossibleAcceptedLedger = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: passingFocalDiagnostics({
      eligible: 2,
      dryRunAccepted: 2,
    }),
  });
  assert.equal(impossibleAcceptedLedger.screenEvidenceUsable, false);
  assert.ok(
    impossibleAcceptedLedger.reasons.includes(
      "requires focal dry-run accepts, sales, purchases, and decision divergences to match",
    ),
  );

  const executionFailure = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: passingFocalDiagnostics({
      eligible: 2,
      executionFailureAborts: 1,
    }),
  });
  assert.equal(executionFailure.screenEvidenceUsable, false);
  assert.ok(
    executionFailure.reasons.includes(
      "requires zero focal execution-failure aborts",
    ),
  );

  const preEligibilityHandCapacityAbort = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: sumAiCapitalSaleDiagnostics([
      passingFocalDiagnostics({ handCapacityAborts: 99 }),
      ...PROFILE_IDS.slice(1).map(() => passingFocalDiagnostics()),
    ]),
    focalDiagnosticsByProfile: Object.fromEntries(
      PROFILE_IDS.map((profileId, index) => [
        profileId,
        passingFocalDiagnostics({
          handCapacityAborts: index === 0 ? 99 : 0,
        }),
      ]),
    ),
  });
  assert.equal(preEligibilityHandCapacityAbort.accepted, true);
});

test("every profile must diverge and close its own diagnostic ledger", () => {
  const unexposedProfileId = PROFILE_IDS[0];
  assert.ok(unexposedProfileId);
  const unexposedByProfile = passingFocalDiagnosticsByProfile();
  unexposedByProfile[unexposedProfileId] = playerDiagnostics();
  const unexposed = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: sumAiCapitalSaleDiagnostics(
      Object.values(unexposedByProfile),
    ),
    focalDiagnosticsByProfile: unexposedByProfile,
  });
  assert.equal(unexposed.screenEvidenceUsable, false);
  assert.ok(
    unexposed.reasons.includes(
      `${unexposedProfileId} requires at least one focal capital-sale decision divergence`,
    ),
  );

  const firstProfileId = PROFILE_IDS[0];
  const secondProfileId = PROFILE_IDS[1];
  assert.ok(firstProfileId);
  assert.ok(secondProfileId);
  const locallyOpenByProfile = passingFocalDiagnosticsByProfile();
  locallyOpenByProfile[firstProfileId] = passingFocalDiagnostics({
    eligible: 2,
  });
  locallyOpenByProfile[secondProfileId] = passingFocalDiagnostics({
    eligible: 0,
  });
  const locallyOpen = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnostics: sumAiCapitalSaleDiagnostics(
      Object.values(locallyOpenByProfile),
    ),
    focalDiagnosticsByProfile: locallyOpenByProfile,
  });
  assert.equal(locallyOpen.screenEvidenceUsable, false);
  assert.ok(
    locallyOpen.reasons.includes(
      `${firstProfileId} requires every focal eligible decision to close into one terminal diagnostic`,
    ),
  );
  assert.ok(
    locallyOpen.reasons.includes(
      `${secondProfileId} requires every focal eligible decision to close into one terminal diagnostic`,
    ),
  );

  const nonPartitioningByProfile = passingFocalDiagnosticsByProfile();
  const nonPartitioning = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    focalDiagnosticsByProfile: nonPartitioningByProfile,
    focalDiagnostics: passingFocalDiagnostics(),
  });
  assert.equal(nonPartitioning.screenEvidenceUsable, false);
  assert.ok(
    nonPartitioning.reasons.includes(
      "requires by-profile focal diagnostics to partition aggregate diagnostics",
    ),
  );
});

test("every profile and scenario is gated while physical seat remains report-only", () => {
  const physicalSeatOnlyRegression = passingComparisonMatrix();
  physicalSeatOnlyRegression.byPhysicalSeat[0] = {
    placement: {
      pairedSeats: 0,
      seedClusters: 0,
      meanDelta: 10,
      confidence95: { lower: 9, upper: 11 },
    },
    topFour: {
      pairedSeats: 0,
      seedClusters: 0,
      meanDelta: -1,
      confidence95: { lower: -1, upper: -1 },
    },
    win: {
      pairedSeats: 0,
      seedClusters: 0,
      meanDelta: -1,
      confidence95: { lower: -1, upper: -1 },
    },
  };
  const physicalSeatIgnored = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    comparisonMatrix: physicalSeatOnlyRegression,
  });
  assert.equal(physicalSeatIgnored.accepted, true);

  const profileId = PROFILE_IDS[0];
  assert.ok(profileId);
  const missingProfile = passingComparisonMatrix();
  delete missingProfile.byProfile[profileId];
  const missingProfileGate = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    comparisonMatrix: missingProfile,
  });
  assert.equal(missingProfileGate.accepted, false);
  assert.ok(
    missingProfileGate.reasons.includes(
      `${profileId} comparison requires every seed cluster and pair`,
    ),
  );

  const degradedProfile = passingComparisonMatrix();
  const profileComparison = degradedProfile.byProfile[profileId];
  assert.ok(profileComparison);
  degradedProfile.byProfile[profileId] = {
    ...profileComparison,
    placement: {
      ...profileComparison.placement,
      confidence95: { lower: 0.24, upper: 0.26 },
    },
  };
  const degradedProfileGate = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    comparisonMatrix: degradedProfile,
  });
  assert.equal(degradedProfileGate.accepted, false);
  assert.ok(
    degradedProfileGate.reasons.includes(
      `${profileId} placement CI upper bound must be at most 0.25`,
    ),
  );

  const positiveMeanProfile = passingComparisonMatrix();
  const positiveMeanComparison = positiveMeanProfile.byProfile[profileId];
  assert.ok(positiveMeanComparison);
  positiveMeanProfile.byProfile[profileId] = {
    ...positiveMeanComparison,
    placement: {
      ...positiveMeanComparison.placement,
      meanDelta: 0.01,
      confidence95: { lower: -0.1, upper: 0.2 },
    },
  };
  const positiveMeanProfileGate = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    comparisonMatrix: positiveMeanProfile,
  });
  assert.equal(positiveMeanProfileGate.accepted, false);
  assert.ok(
    positiveMeanProfileGate.reasons.includes(
      `${profileId} mean placement delta must be at most 0`,
    ),
  );

  const scenarioId: AiBenchmarkScenarioId = "neutral-v1";
  const missingScenario = passingComparisonMatrix();
  delete missingScenario.byScenario[scenarioId];
  const missingScenarioGate = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    comparisonMatrix: missingScenario,
  });
  assert.equal(missingScenarioGate.accepted, false);
  assert.ok(
    missingScenarioGate.reasons.includes(
      `${scenarioId} comparison requires every seed cluster and pair`,
    ),
  );

  const degradedScenario = passingComparisonMatrix();
  const scenarioComparison = degradedScenario.byScenario[scenarioId];
  assert.ok(scenarioComparison);
  degradedScenario.byScenario[scenarioId] = {
    ...scenarioComparison,
    topFour: {
      ...scenarioComparison.topFour,
      confidence95: { lower: -0.06, upper: 0 },
    },
  };
  const degradedScenarioGate = evaluateAiCapitalSaleGate({
    ...passingGateInput(),
    comparisonMatrix: degradedScenario,
  });
  assert.equal(degradedScenarioGate.accepted, false);
  assert.ok(
    degradedScenarioGate.reasons.includes(
      `${scenarioId} top-four CI lower bound must be at least -0.05`,
    ),
  );
});

test("all extended diagnostic counters require non-negative integers", () => {
  const diagnostics = Object.fromEntries(
    PLAYER_IDS.map((playerId) => [playerId, playerDiagnostics()]),
  );
  diagnostics["player-3"] = playerDiagnostics({ fundingAborts: -1 });
  assert.throws(
    () => normalizeAiCapitalSaleDiagnostics({ byPlayer: diagnostics }, PLAYER_IDS),
    /fundingAborts.*non-negative integer/,
  );

  diagnostics["player-3"] = playerDiagnostics({ executionFailureAborts: 0.5 });
  assert.throws(
    () => normalizeAiCapitalSaleDiagnostics({ byPlayer: diagnostics }, PLAYER_IDS),
    /executionFailureAborts.*non-negative integer/,
  );

  diagnostics["player-3"] = playerDiagnostics({
    settledWarbandScoreAborts: -1,
  });
  assert.throws(
    () => normalizeAiCapitalSaleDiagnostics({ byPlayer: diagnostics }, PLAYER_IDS),
    /settledWarbandScoreAborts.*non-negative integer/,
  );
});

test("consumed and sealed ranges fail before scenario, runner, or progress", () => {
  for (const [startSeed, seeds] of [
    [30_400_001, 1],
    [30_500_001, 1],
    [92_300_001, 8],
    [92_310_001, 24],
  ] as const) {
    let scenarioCalls = 0;
    let runnerCalls = 0;
    let progressCalls = 0;
    assert.throws(
      () =>
        runAiCapitalSaleBenchmarkWithRunner(
          {
            seeds,
            startSeed,
            maxRounds: 1,
            onProgress: () => {
              progressCalls += 1;
            },
          },
          {
            createScenarioGame: (scenarioId, seed, initialHealth) => {
              scenarioCalls += 1;
              return syntheticScenarioGame(scenarioId, seed, initialHealth);
            },
            runEpisode: (request) => {
              runnerCalls += 1;
              return createSyntheticRunner()(request);
            },
          },
        ),
      /AI benchmark seed ledger rejected access/,
    );
    assert.equal(scenarioCalls, 0);
    assert.equal(runnerCalls, 0);
    assert.equal(progressCalls, 0);
  }
});

test("capital-sale CLI requires explicit conservative integer flags", () => {
  assert.deepEqual(
    parseAiCapitalSaleCliArguments([
      "--seeds",
      "8",
      "--start-seed",
      "90050001",
      "--max-rounds",
      "150",
      "--candidate-mode",
      "sell-one-v6-settled-warband",
    ]),
    {
      seeds: 8,
      startSeed: 90_050_001,
      maxRounds: 150,
      candidateMode: "sell-one-v6-settled-warband",
    },
  );
  assert.deepEqual(parseAiCapitalSaleCliArguments([]), {});
  assert.throws(
    () => parseAiCapitalSaleCliArguments(["--seeds=8"]),
    /rejects --flag=value syntax/,
  );
  assert.throws(
    () => parseAiCapitalSaleCliArguments(["--seeds", "8", "--seeds", "9"]),
    /duplicate/,
  );
  assert.throws(
    () => parseAiCapitalSaleCliArguments(["--max-rounds", "0.5"]),
    /safe integer/,
  );
  assert.throws(
    () =>
      parseAiCapitalSaleCliArguments([
        "--candidate-mode",
        "sell-two-v7",
      ]),
    /candidateMode must be one of sell-one-v5, sell-one-v6-settled-warband/,
  );
});
