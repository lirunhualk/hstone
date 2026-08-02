import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  AI_STRATEGY_PROFILES,
  advanceHeadlessGame,
  aiTargetBoardSize,
  createGame,
  createHeadlessGame,
  gameReducer,
  gameTransition,
  getAiStrategyProfile,
  getTavernSpellDefinition,
  getUpgradeCost,
  planAiBoardOrder,
  scoreMinionForAi,
  shouldAiUpgrade,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import {
  AI_BASE_TIER_UP_ROUND,
  AI_POLICY_VERSION,
  aiRefreshLimit,
  withAiStrategyProfileOverrides,
} from "../lib/game/ai.ts";
import {
  hasAnyAiResidualPolicyOverrides,
  withAiResidualPolicyOverrides,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_REGISTERED_TRAINING_BATCH_ARM_ORDER,
  computeAiBenchmarkContentSnapshotSha256,
  computeAiBenchmarkEvaluatorHash,
  runAiBenchmark,
  runRegisteredAiPolicyTrainingScreen,
  type AiRegisteredPolicyTrainingScreenResult,
  type AiRegisteredTrainingVariantSummary,
} from "../scripts/benchmark-ai.ts";
import {
  AI_BENCHMARK_SEED_LEDGER,
  AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
  evaluateAiBenchmarkSeedAccess,
} from "../scripts/ai-seed-ledger.ts";
import {
  AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS,
  AI_POLICY_CONFIRMATION_REGISTRATION,
  AI_POLICY_CONFIRMATION_REGISTRATION_ID,
  AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
  AI_POLICY_TRAINING_SCREEN_CANDIDATES,
  AI_POLICY_TRAINING_SCREEN_REGISTRATION,
  AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
  compareConservativePlacementBounds,
  compareConservativeRateBounds,
  comparePairedPlacements,
  computeAiPolicyTrainingScreenProtocolHash,
  evaluateAiPolicyConfirmationGate,
  evaluateAiPolicyTrainingCandidateQualification,
  parseAiPolicyTrainingScreenCliArguments,
  runAiPolicyConfirmation,
  runAiPolicySearch,
  runAiPolicyTrainingScreen,
  selectAiPolicyTrainingCandidate,
  studentTCritical95,
  type AiPolicyConfirmationOptions,
  type AiPolicySearchOptions,
  type AiPolicyTrainingScreenEvidence,
  type AiPolicyTrainingScreenOptions,
} from "../scripts/search-ai-policy.ts";

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player, `expected ${playerId} to exist`);
  return player;
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack,
    health: definition.health,
    golden: false,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    poolCopies: 0,
    ...overrides,
  };
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function isolateAiLobby(state: GameState, activeAiId: string): void {
  for (const player of state.players) {
    if (!player.isHuman && player.id !== activeAiId) {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.hand = [];
      player.shop = [];
      player.spellShop = null;
      player.additionalSpellShop = [];
    }
  }
  const human = playerById(state, state.humanPlayerId);
  human.alive = true;
  human.health = 40;
  human.armor = 0;
  human.gold = 0;
  human.board = [];
  human.hand = [];
  human.shop = [];
  human.spellShop = null;
  human.additionalSpellShop = [];
}

test("seven AI players receive stable, distinct strategy profiles", () => {
  const strategyIds = Array.from({ length: 7 }, (_, index) =>
    getAiStrategyProfile(`player-${index + 1}`).id,
  );

  assert.equal(AI_STRATEGY_PROFILES.length, 7);
  assert.equal(new Set(strategyIds).size, 7);
  assert.deepEqual(
    createGame(11).players
      .filter((player) => !player.isHuman)
      .map((player) => getAiStrategyProfile(player.id).id),
    createGame(98_765).players
      .filter((player) => !player.isHuman)
      .map((player) => getAiStrategyProfile(player.id).id),
  );
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => aiTargetBoardSize(index + 1)),
    [1, 1, 3, 4, 5, 6, 7],
  );
  assert.equal(
    getAiStrategyProfile("player-7").upgradeRoundOffset,
    1,
    "deathrattle keeps its published slow curve until a holdout gate accepts a replacement",
  );
  assert.equal(
    AI_STRATEGY_PROFILES.every(
      (profile) =>
        profile.safeTierSixUpgradeAcceleration === 0 &&
        profile.tierSixRefreshBonus === 0,
    ),
    true,
    "new experimental switches remain inert in every live profile",
  );
});

test("benchmark profile overrides are scoped, validated, and restored", () => {
  const original = getAiStrategyProfile("player-7");
  const override = { ...original, upgradeRoundOffset: 2 };
  const overrides = new Map([["player-7", override]]);
  assert.equal(Object.isFrozen(AI_STRATEGY_PROFILES), true);
  assert.equal(AI_STRATEGY_PROFILES.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(original), true);
  assert.equal(Object.isFrozen(AI_BASE_TIER_UP_ROUND), true);
  assert.throws(
    () =>
      Object.defineProperty(AI_BASE_TIER_UP_ROUND, "2", { value: 99 }),
    TypeError,
  );
  assert.equal(AI_BASE_TIER_UP_ROUND[2], 2);

  const observedOffset = withAiStrategyProfileOverrides(overrides, () => {
    override.upgradeRoundOffset = 3;
    const activeOverride = getAiStrategyProfile("player-7");
    assert.equal(activeOverride.upgradeRoundOffset, 2);
    assert.equal(Object.isFrozen(activeOverride), true);
    assert.throws(() => {
      activeOverride.upgradeRoundOffset = 3;
    }, TypeError);
    assert.throws(
      () => withAiStrategyProfileOverrides(new Map(), () => undefined),
      /cannot be nested/,
    );
    return getAiStrategyProfile("player-7").upgradeRoundOffset;
  });

  assert.equal(observedOffset, 2);
  assert.equal(
    getAiStrategyProfile("player-7").upgradeRoundOffset,
    original.upgradeRoundOffset,
  );
  assert.throws(
    () =>
      withAiStrategyProfileOverrides(
        new Map([["player-7", getAiStrategyProfile("player-1")]]),
        () => undefined,
      ),
    /requires strategy deathrattle/,
  );
  assert.throws(
    () =>
      withAiStrategyProfileOverrides(
        new Map([["unknown-seat", original]]),
        () => undefined,
      ),
    /unknown seat/,
  );
  assert.throws(
    () => withAiStrategyProfileOverrides(overrides, async () => undefined),
    /must be synchronous/,
  );
  assert.throws(
    () =>
      withAiStrategyProfileOverrides(overrides, () => {
        throw new Error("candidate failed");
      }),
    /candidate failed/,
  );
  assert.equal(
    getAiStrategyProfile("player-7").upgradeRoundOffset,
    original.upgradeRoundOffset,
  );
});

test("headless self-play recruits all eight bots without mutating its input", () => {
  const initial = createHeadlessGame(31_415);
  const snapshot = JSON.stringify(initial);

  const afterRecruit = advanceHeadlessGame(initial);

  assert.equal(JSON.stringify(initial), snapshot);
  assert.equal(afterRecruit.phase, "combat");
  assert.equal(afterRecruit.pendingInteraction, null);
  assert.equal(afterRecruit.lastBattle, null);
  assert.deepEqual(afterRecruit.humanScoutingReports, {});
  assert.equal(
    afterRecruit.players.every((player) => !player.isHuman),
    true,
  );
  assert.equal(
    afterRecruit.players.every((player) => player.board.length > 0),
    true,
    "player-0 must recruit through the same AI path as the seven profiles",
  );
});

test("game transitions report legality without mutating state for rejected actions", () => {
  const state = createGame(9_001);
  const snapshot = JSON.stringify(state);

  const rejectedBuy = gameTransition(state, {
    type: "BUY_MINION",
    shopIndex: -1,
  });
  assert.equal(rejectedBuy.accepted, false);
  assert.equal(rejectedBuy.state, state);
  assert.deepEqual(rejectedBuy.trace.recruitBloodGemPulses, []);
  assert.equal(JSON.stringify(state), snapshot);

  const rejectedContinue = gameTransition(state, { type: "CONTINUE" });
  assert.equal(rejectedContinue.accepted, false);
  assert.equal(rejectedContinue.state, state);
  assert.equal(JSON.stringify(state), snapshot);

  const acceptedFreeze = gameTransition(state, { type: "TOGGLE_FREEZE" });
  assert.equal(acceptedFreeze.accepted, true);
  assert.notEqual(acceptedFreeze.state, state);
  assert.equal(
    playerById(acceptedFreeze.state, state.humanPlayerId).frozen,
    true,
  );
  assert.equal(JSON.stringify(state), snapshot);
});

test("headless self-play continues after its replay anchor is eliminated", () => {
  const state = createHeadlessGame(27_182);
  state.phase = "combat";
  const anchor = playerById(state, state.humanPlayerId);
  anchor.alive = false;
  anchor.health = 0;
  anchor.eliminatedRound = state.round;
  anchor.placement = 8;

  const next = advanceHeadlessGame(state);

  assert.equal(next.phase, "recruit");
  assert.equal(next.round, state.round + 1);
  assert.equal(playerById(next, state.humanPlayerId).alive, false);

  const liveState = createGame(27_182);
  liveState.phase = "combat";
  const human = playerById(liveState, liveState.humanPlayerId);
  human.alive = false;
  human.health = 0;
  const liveNext = gameReducer(liveState, { type: "CONTINUE" });
  assert.equal(liveNext.phase, "gameOver");
});

test("a headless game completes deterministically with valid elimination order", () => {
  const finish = (seed: number): GameState => {
    let state = createHeadlessGame(seed);
    while (state.phase !== "gameOver") {
      assert.ok(state.round <= 40, "headless game exceeded 40 rounds");
      state = advanceHeadlessGame(state);
    }
    return state;
  };

  const first = finish(12_345);
  const second = finish(12_345);
  assert.equal(JSON.stringify(first), JSON.stringify(second));

  const survivors = first.players.filter((player) => player.alive);
  assert.equal(survivors.length, 1);
  assert.equal(first.winnerId, survivors[0].id);
  assert.equal(survivors[0].placement, 1);

  const eliminated = first.players.filter((player) => !player.alive);
  for (const player of eliminated) {
    assert.ok(Number.isInteger(player.eliminatedRound));
    assert.ok(
      player.placement !== undefined &&
        player.placement >= 2 &&
        player.placement <= 8,
    );
  }
  for (const earlier of eliminated) {
    for (const later of eliminated) {
      if ((earlier.eliminatedRound ?? 0) < (later.eliminatedRound ?? 0)) {
        assert.ok((earlier.placement ?? 0) >= (later.placement ?? 0));
      }
    }
  }
});

test("benchmark provenance recursively hashes TypeScript and pinned JSON", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "hstone-ai-provenance-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const generatedDirectory = join(directory, "generated");
  const nestedDirectory = join(directory, "nested");
  mkdirSync(generatedDirectory, { recursive: true });
  mkdirSync(nestedDirectory, { recursive: true });
  const contentPath = join(generatedDirectory, "battlegrounds-test.json");
  const auxiliaryContentPath = join(
    generatedDirectory,
    "battlegrounds-trinkets-test.json",
  );
  const nestedSourcePath = join(nestedDirectory, "policy.ts");
  const ignoredPath = join(nestedDirectory, "README.md");
  writeFileSync(contentPath, '{"version":1}\n');
  writeFileSync(auxiliaryContentPath, '{"version":1}\n');
  writeFileSync(nestedSourcePath, "export const value = 1;\n");
  writeFileSync(ignoredPath, "first\n");
  const gameDirectory = pathToFileURL(`${directory}${sep}`);

  const firstEvaluator = computeAiBenchmarkEvaluatorHash(gameDirectory);
  const firstContent =
    computeAiBenchmarkContentSnapshotSha256(gameDirectory);
  writeFileSync(nestedSourcePath, "export const value = 2;\n");
  const sourceChanged = computeAiBenchmarkEvaluatorHash(gameDirectory);
  assert.notEqual(sourceChanged, firstEvaluator);
  assert.equal(
    computeAiBenchmarkContentSnapshotSha256(gameDirectory),
    firstContent,
  );

  writeFileSync(contentPath, '{"version":2}\n');
  const contentChanged = computeAiBenchmarkContentSnapshotSha256(gameDirectory);
  const contentEvaluator = computeAiBenchmarkEvaluatorHash(gameDirectory);
  assert.notEqual(contentChanged, firstContent);
  assert.notEqual(contentEvaluator, sourceChanged);

  writeFileSync(auxiliaryContentPath, '{"version":2}\n');
  assert.equal(
    computeAiBenchmarkContentSnapshotSha256(gameDirectory),
    contentChanged,
  );
  assert.notEqual(
    computeAiBenchmarkEvaluatorHash(gameDirectory),
    contentEvaluator,
  );

  writeFileSync(ignoredPath, "second\n");
  const auxiliaryEvaluator = computeAiBenchmarkEvaluatorHash(gameDirectory);
  writeFileSync(ignoredPath, "third\n");
  assert.equal(computeAiBenchmarkEvaluatorHash(gameDirectory), auxiliaryEvaluator);
});

test("immutable seed ledger protects consumed and sealed intervals", () => {
  assert.equal(Object.isFrozen(AI_BENCHMARK_SEED_LEDGER), true);
  assert.equal(AI_BENCHMARK_SEED_LEDGER.every(Object.isFrozen), true);
  assert.equal(
    new Set(AI_BENCHMARK_SEED_LEDGER.map((entry) => entry.id)).size,
    AI_BENCHMARK_SEED_LEDGER.length,
  );
  for (const entry of AI_BENCHMARK_SEED_LEDGER) {
    assert.equal(Number.isSafeInteger(entry.startSeed), true);
    assert.equal(Number.isSafeInteger(entry.endSeed), true);
    assert.ok(entry.startSeed <= entry.endSeed);
  }
  const entriesByStart = [...AI_BENCHMARK_SEED_LEDGER].sort(
    (left, right) => left.startSeed - right.startSeed,
  );
  for (let index = 1; index < entriesByStart.length; index += 1) {
    assert.ok(
      entriesByStart[index - 1]!.endSeed < entriesByStart[index]!.startSeed,
      `${entriesByStart[index - 1]!.id} must not overlap ${entriesByStart[index]!.id}`,
    );
  }
  assert.deepEqual(
    AI_BENCHMARK_SEED_LEDGER.map((entry) => [
      entry.disposition,
      entry.startSeed,
      entry.endSeed,
    ]),
    [
      ["consumed", 51_001, 51_096],
      ["consumed", 30_100_001, 30_100_064],
      ["sealed", 30_200_001, 30_200_096],
      ["consumed", 30_300_001, 30_300_064],
    ],
  );
  assert.deepEqual(
    AI_BENCHMARK_SEED_LEDGER.find(
      (entry) => entry.startSeed === 30_100_001,
    ),
    {
      id: "power-level-offset0-final-conversion-screen-30100001-aborted-unobserved-v1",
      disposition: "consumed",
      startSeed: 30_100_001,
      endSeed: 30_100_064,
      retirementReason:
        "external-interruption-no-output-unobserved-not-evidence",
    },
  );
  assert.deepEqual(
    AI_BENCHMARK_SEED_LEDGER.find(
      (entry) => entry.startSeed === 30_300_001,
    ),
    {
      id: "power-level-offset0-final-conversion-screen-30300001-claimed-consumed-v1",
      disposition: "consumed",
      startSeed: 30_300_001,
      endSeed: 30_300_064,
      retirementReason: "task-scheduler-one-shot-claim-created-formal-screen",
    },
  );
  assert.deepEqual(
    evaluateAiBenchmarkSeedAccess({
      startSeed: 30_300_001,
      seeds: 64,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
      reservationMode: "training-screen",
    }),
    {
      allowed: false,
      ledgerEntryId:
        "power-level-offset0-final-conversion-screen-30300001-claimed-consumed-v1",
      reason:
        "seed range overlaps consumed ledger entry power-level-offset0-final-conversion-screen-30300001-claimed-consumed-v1",
    },
  );
  assert.throws(
    () =>
      runRegisteredAiPolicyTrainingScreen(
        computeAiPolicyTrainingScreenProtocolHash(),
      ),
    /seed ledger rejected access.*30300001-claimed-consumed/,
    "the exact authoritative capability must fail before games after its one-shot claim",
  );

  const oldTrainingReservationId =
    "power-level-offset0-final-conversion-screen-30100001-v1";
  for (const request of [
    { startSeed: 30_100_001, seeds: 64 },
    { startSeed: 30_100_002, seeds: 1 },
    { startSeed: 30_100_000, seeds: 66 },
    { startSeed: 30_100_060, seeds: 10 },
    {
      startSeed: 30_100_001,
      seeds: 64,
      reservationId: oldTrainingReservationId,
      reservationMode: "training-screen",
    },
  ]) {
    assert.equal(
      evaluateAiBenchmarkSeedAccess(
        request as Parameters<typeof evaluateAiBenchmarkSeedAccess>[0],
      ).allowed,
      false,
    );
  }

  for (const request of [
    { startSeed: 30_200_001, seeds: 96 },
    { startSeed: 30_200_002, seeds: 1 },
    { startSeed: 30_200_090, seeds: 10 },
    {
      startSeed: 30_200_001,
      seeds: 96,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
      reservationMode: "training-screen",
    },
  ]) {
    assert.equal(
      evaluateAiBenchmarkSeedAccess(
        request as Parameters<typeof evaluateAiBenchmarkSeedAccess>[0],
      ).allowed,
      false,
    );
  }

  for (const request of [
    { startSeed: 30_300_001, seeds: 64 },
    {
      startSeed: 30_300_001,
      seeds: 1,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
      reservationMode: "training-screen",
    },
    {
      startSeed: 30_300_000,
      seeds: 66,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
      reservationMode: "training-screen",
    },
    {
      startSeed: 30_299_999,
      seeds: 3,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
      reservationMode: "training-screen",
    },
    {
      startSeed: 30_300_001,
      seeds: 64,
      reservationId: oldTrainingReservationId,
      reservationMode: "training-screen",
    },
    {
      startSeed: 30_300_001,
      seeds: 64,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
    },
    {
      startSeed: 30_300_001,
      seeds: 64,
      reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
      reservationMode: "confirmation",
    },
  ]) {
    assert.equal(
      evaluateAiBenchmarkSeedAccess(
        request as Parameters<typeof evaluateAiBenchmarkSeedAccess>[0],
      ).allowed,
      false,
    );
  }
  assert.equal(
    evaluateAiBenchmarkSeedAccess({ startSeed: 51_001, seeds: 96 })
      .allowed,
    false,
  );
  assert.equal(
    evaluateAiBenchmarkSeedAccess({ startSeed: 31_200_001, seeds: 1 })
      .allowed,
    true,
  );
});

test("generic benchmark rejects protected seeds before the first game", () => {
  let progressCalls = 0;
  for (const [startSeed, seeds, expected] of [
    [51_001, 96, /seed ledger rejected access.*consumed ledger entry/],
    [30_100_001, 64, /seed ledger rejected access.*aborted-unobserved/],
    [30_200_001, 96, /seed ledger rejected access.*sealed ledger entry/],
    [30_300_001, 1, /seed ledger rejected access.*consumed ledger entry/],
  ] as const) {
    assert.throws(
      () =>
        runAiBenchmark({
          seeds,
          startSeed,
          maxRounds: 1,
          onProgress: () => {
            progressCalls += 1;
          },
        }),
      expected,
    );
  }
  assert.equal(progressCalls, 0);

  const forgedOptions = {
    seeds: 64,
    startSeed: 30_300_001,
    maxRounds: 1,
    reservationId: AI_TRAINING_SCREEN_SEED_RESERVATION_ID,
    reservationMode: "training-screen",
    onProgress: () => {
      progressCalls += 1;
    },
  } as Parameters<typeof runAiBenchmark>[0] & {
    reservationId: string;
    reservationMode: string;
  };
  assert.throws(
    () => runAiBenchmark(forgedOptions),
    /seed ledger rejected access.*consumed ledger entry/,
  );
  assert.equal(progressCalls, 0);
});

test("eight-bot benchmark rotates every seat and is deterministic", () => {
  const options = {
    seeds: 1,
    startSeed: 42,
    maxRounds: 1,
    includeGames: true,
  };
  const progress: Array<[number, number, number, number]> = [];
  const first = runAiBenchmark({
    ...options,
    onProgress: (event) => {
      progress.push([
        event.processedGames,
        event.scheduledGames,
        event.seed,
        event.rotation,
      ]);
    },
  });
  const second = runAiBenchmark(options);

  assert.deepEqual(first, second);
  assert.deepEqual(progress[0], [1, 8, 42, 0]);
  assert.deepEqual(progress.at(-1), [8, 8, 42, 7]);
  assert.equal(first.method, "eight-bot-headless-seat-rotated-v1");
  assert.equal(first.policyVersion, AI_POLICY_VERSION);
  assert.equal(first.rotationsPerSeed, 8);
  assert.equal(first.scheduledGames, 8);
  assert.equal(first.completedGames, 0);
  assert.equal(first.truncatedGames, 8);
  assert.equal(first.games?.length, 8);
  assert.deepEqual(
    first.games?.map((game) => [
      game.seed,
      game.rotation,
      game.completed,
      game.strategyPlacements,
    ]),
    Array.from({ length: 8 }, (_value, rotation) => [
      42,
      rotation,
      false,
      {},
    ]),
  );
  for (const game of first.games ?? []) {
    const bounds = Object.values(game.strategyPlacementBounds);
    assert.equal(bounds.length, 7);
    assert.equal(
      bounds.every(
        (entry) =>
          entry?.best === 1 &&
          entry.worst === 8 &&
          entry.exact === false,
      ),
      true,
    );
  }
  assert.equal(first.strategies.length, 7);
  assert.ok(first.contentVersion.length > 0);
  assert.match(first.contentSnapshotSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    first.contentSnapshotSha256After,
    first.contentSnapshotSha256,
  );
  assert.equal(first.contentSnapshotStable, true);
  assert.match(first.evaluatorHash, /^[0-9a-f]{64}$/);
  assert.equal(first.evaluatorHashAfter, first.evaluatorHash);
  assert.equal(first.evaluatorStable, true);
  assert.match(first.strategyProfileHash, /^[0-9a-f]{64}$/);
  assert.equal(first.strategyProfileHashAfter, first.strategyProfileHash);
  assert.equal(first.strategyProfilesStable, true);
  for (const strategy of first.strategies) {
    assert.equal(strategy.completedGameSamples, 0);
    assert.equal(strategy.averagePlacement, null);
    assert.equal(strategy.winRate, null);
  }

  const normalCurveCandidate = {
    ...getAiStrategyProfile("player-7"),
    upgradeRoundOffset: 0,
  };
  const candidate = runAiBenchmark({
    ...options,
    profileOverrides: new Map([["player-7", normalCurveCandidate]]),
  });
  assert.notEqual(
    candidate.strategyProfileHash,
    first.strategyProfileHash,
  );
  assert.equal(getAiStrategyProfile("player-7").upgradeRoundOffset, 1);
});

test("benchmark profiles cannot be mutated during progress", () => {
  const liveProfile = getAiStrategyProfile("player-7");
  const originalRefreshes = liveProfile.maxRefreshes;
  let mutationAttempted = false;
  assert.equal(Object.isFrozen(liveProfile), true);

  assert.throws(
    () =>
      runAiBenchmark({
        seeds: 1,
        startSeed: 43,
        maxRounds: 1,
        profileOverrides: new Map([
          ["player-7", { ...liveProfile }],
        ]),
        onProgress: () => {
          if (mutationAttempted) return;
          mutationAttempted = true;
          getAiStrategyProfile("player-7").maxRefreshes += 1;
        },
      }),
    TypeError,
  );
  assert.equal(mutationAttempted, true);
  assert.equal(
    getAiStrategyProfile("player-7").maxRefreshes,
    originalRefreshes,
  );
});

test("policy search and confirmation reject active residual providers", () => {
  let providerCalls = 0;
  const scoped = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-5",
        {
          policyId: "forbidden-benchmark-provider",
          policyVersion: "1",
          propose: () => {
            providerCalls += 1;
            return null;
          },
        },
      ],
    ]),
    () => {
      assert.equal(hasAnyAiResidualPolicyOverrides(), true);
      assert.throws(
        () =>
          runAiPolicySearch({
            strategyId: "powerLevel",
            parameter: "upgradeRoundOffset",
            values: [0],
            trainSeeds: 1,
            holdoutSeeds: 1,
            maxRounds: 1,
          }),
        /forbids residual policy overrides/,
      );
      assert.throws(
        () =>
          runAiPolicyConfirmation({
            strategyId: "powerLevel",
            parameter: "upgradeRoundOffset",
            candidateValue: 0,
            seeds: 1,
            startSeed: 60_011,
            maxRounds: 1,
          }),
        /forbids residual policy overrides/,
      );
      assert.throws(
        () =>
          runAiPolicyTrainingScreen({
            seeds: 1,
            startSeed: 60_021,
            maxRounds: 1,
          }),
        /forbids residual policy overrides/,
      );
      return "rejected-before-games";
    },
  );

  assert.equal(scoped.result, "rejected-before-games");
  assert.equal(providerCalls, 0);
  assert.equal(scoped.diagnostics.providerCalls, 0);
  assert.equal(hasAnyAiResidualPolicyOverrides(), false);
});

test("generic search and diagnostic screen fail fast on future reserved seeds", () => {
  let searchProgressCalls = 0;
  assert.throws(
    () =>
      runAiPolicySearch({
        strategyId: "deathrattle",
        parameter: "upgradeRoundOffset",
        values: [0],
        trainSeeds: 1,
        trainStartSeed: 30_200_001,
        holdoutSeeds: 1,
        holdoutStartSeed: 31_200_101,
        maxRounds: 1,
        onProgress: () => {
          searchProgressCalls += 1;
        },
      }),
    /seed ledger rejected access/,
  );
  assert.equal(searchProgressCalls, 0);

  let screenProgressCalls = 0;
  assert.throws(
    () =>
      runAiPolicyTrainingScreen({
        seeds: 96,
        startSeed: 30_200_001,
        maxRounds: 1,
        onProgress: () => {
          screenProgressCalls += 1;
        },
      }),
    /seed ledger rejected access.*sealed ledger entry/,
  );
  assert.equal(screenProgressCalls, 0);
});

test("policy search uses paired games and refuses evidence-free updates", () => {
  const paired = comparePairedPlacements(
    [
      {
        seed: 1,
        rotation: 0,
        completed: true,
        finalRound: 12,
        alivePlayers: 1,
        winnerPlayerId: "player-1",
        strategyPlacements: { deathrattle: 6 },
        strategyPlacementBounds: {
          deathrattle: { best: 6, worst: 6, exact: true },
        },
      },
      {
        seed: 2,
        rotation: 0,
        completed: true,
        finalRound: 13,
        alivePlayers: 1,
        winnerPlayerId: "player-2",
        strategyPlacements: { deathrattle: 5 },
        strategyPlacementBounds: {
          deathrattle: { best: 5, worst: 5, exact: true },
        },
      },
    ],
    [
      {
        seed: 1,
        rotation: 0,
        completed: true,
        finalRound: 12,
        alivePlayers: 1,
        winnerPlayerId: "player-7",
        strategyPlacements: { deathrattle: 4 },
        strategyPlacementBounds: {
          deathrattle: { best: 4, worst: 4, exact: true },
        },
      },
      {
        seed: 2,
        rotation: 0,
        completed: true,
        finalRound: 13,
        alivePlayers: 1,
        winnerPlayerId: "player-7",
        strategyPlacements: { deathrattle: 4 },
        strategyPlacementBounds: {
          deathrattle: { best: 4, worst: 4, exact: true },
        },
      },
    ],
    "deathrattle",
  );
  assert.equal(paired.pairedGames, 2);
  assert.equal(paired.seedClusters, 2);
  assert.equal(paired.meanPlacementDelta, -1.5);
  assert.ok(paired.confidence95);

  const exactFromTruncatedGame = comparePairedPlacements(
    [
      {
        seed: 3,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 2,
        winnerPlayerId: null,
        strategyPlacements: { deathrattle: 7 },
        strategyPlacementBounds: {
          deathrattle: { best: 7, worst: 7, exact: true },
        },
      },
    ],
    [
      {
        seed: 3,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 2,
        winnerPlayerId: null,
        strategyPlacements: { deathrattle: 6 },
        strategyPlacementBounds: {
          deathrattle: { best: 6, worst: 6, exact: true },
        },
      },
    ],
    "deathrattle",
  );
  assert.equal(exactFromTruncatedGame.pairedGames, 1);
  assert.equal(exactFromTruncatedGame.meanPlacementDelta, -1);

  const conservativeBounds = compareConservativePlacementBounds(
    [
      {
        seed: 4,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 4,
        winnerPlayerId: null,
        strategyPlacements: {},
        strategyPlacementBounds: {
          deathrattle: { best: 1, worst: 4, exact: false },
        },
      },
    ],
    [
      {
        seed: 4,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 3,
        winnerPlayerId: null,
        strategyPlacements: {},
        strategyPlacementBounds: {
          deathrattle: { best: 1, worst: 3, exact: false },
        },
      },
    ],
    "deathrattle",
  );
  assert.equal(conservativeBounds.pairedGames, 1);
  assert.equal(conservativeBounds.meanPlacementDelta, 2);
  const conservativeTopFour = compareConservativeRateBounds(
    [
      {
        seed: 4,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 4,
        winnerPlayerId: null,
        strategyPlacements: {},
        strategyPlacementBounds: {
          deathrattle: { best: 1, worst: 4, exact: false },
        },
      },
    ],
    [
      {
        seed: 4,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 3,
        winnerPlayerId: null,
        strategyPlacements: {},
        strategyPlacementBounds: {
          deathrattle: { best: 1, worst: 3, exact: false },
        },
      },
    ],
    "deathrattle",
    "topFour",
  );
  assert.equal(conservativeTopFour.meanRateDelta, 0);
  const conservativeWin = compareConservativeRateBounds(
    [
      {
        seed: 4,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 4,
        winnerPlayerId: null,
        strategyPlacements: {},
        strategyPlacementBounds: {
          deathrattle: { best: 1, worst: 4, exact: false },
        },
      },
    ],
    [
      {
        seed: 4,
        rotation: 0,
        completed: false,
        finalRound: 20,
        alivePlayers: 3,
        winnerPlayerId: null,
        strategyPlacements: {},
        strategyPlacementBounds: {
          deathrattle: { best: 1, worst: 3, exact: false },
        },
      },
    ],
    "deathrattle",
    "win",
  );
  assert.equal(conservativeWin.meanRateDelta, -1);

  let searchInputMutated = false;
  const searchOptions: AiPolicySearchOptions = {
    strategyId: "deathrattle",
    parameter: "upgradeRoundOffset",
    values: [0, 1],
    trainSeeds: 1,
    holdoutSeeds: 1,
    maxRounds: 1,
  };
  searchOptions.onProgress = () => {
    if (searchInputMutated) return;
    searchInputMutated = true;
    searchOptions.strategyId = "powerLevel";
    searchOptions.parameter = "maxRefreshes";
    searchOptions.values = [2];
    searchOptions.incumbentValue = -1;
    searchOptions.trainSeeds = 8;
    searchOptions.holdoutSeeds = 24;
    searchOptions.onProgress = undefined;
  };
  const search = runAiPolicySearch(searchOptions);
  assert.equal(searchInputMutated, true);
  assert.equal(search.strategyId, "deathrattle");
  assert.equal(search.parameter, "upgradeRoundOffset");
  assert.equal(search.recommendedValue, 1);
  assert.equal(search.accepted, false);
  assert.match(search.evaluatorHash, /^[0-9a-f]{64}$/);
  assert.match(search.searchEvaluatorHash, /^[0-9a-f]{64}$/);
  assert.equal(
    search.searchEvaluatorHashAfter,
    search.searchEvaluatorHash,
  );
  assert.equal(search.searchEvaluatorStable, true);
  assert.match(search.contentSnapshotSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    search.contentSnapshotSha256After,
    search.contentSnapshotSha256,
  );
  assert.equal(search.contentSnapshotStable, true);
  assert.match(search.strategyProfileHash, /^[0-9a-f]{64}$/);
  assert.equal(
    search.strategyProfileHashAfter,
    search.strategyProfileHash,
  );
  assert.equal(search.strategyProfilesStable, true);
  assert.deepEqual(search.config, {
    trainSeeds: 1,
    trainStartSeed: 7_001,
    holdoutSeeds: 1,
    holdoutStartSeed: 9_001,
    maxRounds: 1,
    rotationsPerSeed: 8,
    trainingScheduledGames: 8,
    holdoutScheduledGames: 8,
    minimumPlacementImprovement: 0.1,
    topFourNoninferiorityGuard: 0.02,
    winRateNoninferiorityGuard: 0.03,
  });
  const searchIncumbent = search.training.variants.find(
    (variant) => variant.value === 1,
  );
  assert.equal(
    searchIncumbent?.conservativeComparisonToIncumbent.meanPlacementDelta,
    0,
  );
  assert.equal(
    searchIncumbent?.conservativeComparisonToIncumbent.pairedGames,
    8,
  );
  assert.ok(
    search.acceptanceReasons.includes(
      "training did not select a different value",
    ),
  );
  assert.throws(
    () =>
      runAiPolicySearch({
        strategyId: "deathrattle",
        parameter: "upgradeRoundOffset",
        values: [0],
        trainSeeds: 1,
        holdoutSeeds: 1,
        maxRounds: 1,
        minimumPlacementImprovement: 0.09,
      }),
    /at least 0\.10/,
  );
  assert.throws(
    () =>
      runAiPolicySearch({
        strategyId: "deathrattle",
        parameter: "upgradeRoundOffset",
        values: [0, 2],
        incumbentValue: 0,
        trainSeeds: 1,
        holdoutSeeds: 1,
        maxRounds: 1,
      }),
    /search incumbent 0 must equal live value 1/,
  );
  assert.equal(getAiStrategyProfile("player-7").upgradeRoundOffset, 1);
});

test("fixed-candidate confirmation gate accepts only complete strict evidence", () => {
  assert.equal(Object.isFrozen(AI_POLICY_CONFIRMATION_REGISTRATION), true);
  assert.equal(
    AI_POLICY_CONFIRMATION_REGISTRATION.id,
    AI_POLICY_CONFIRMATION_REGISTRATION_ID,
  );
  assert.deepEqual(AI_POLICY_CONFIRMATION_REGISTRATION, {
    id: AI_POLICY_CONFIRMATION_REGISTRATION_ID,
    strategyId: "powerLevel",
    parameter: "upgradeRoundOffset",
    liveValue: -1,
    incumbentValue: -1,
    candidateValue: 0,
    seeds: 96,
    startSeed: 51_001,
    maxRounds: 100,
    rotationsPerSeed: 8,
    scheduledGames: 768,
    minimumPlacementImprovement: 0.1,
    topFourNoninferiorityGuard: 0.02,
    winRateNoninferiorityGuard: 0.03,
  });
  assert.equal(studentTCritical95(95), 1.985252);
  assert.ok(studentTCritical95(95) > 1.96);
  assert.equal(
    studentTCritical95(96),
    studentTCritical95(95),
    "an unlisted df uses the next-lower tabulated df conservatively",
  );
  const seedClusters = AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS;
  const pairedGames = seedClusters * 8;
  const evidence = {
    registrationId: AI_POLICY_CONFIRMATION_REGISTRATION_ID,
    strategyId: "powerLevel" as const,
    parameter: "upgradeRoundOffset" as const,
    liveValue: -1,
    incumbentValue: -1,
    candidateValue: 0,
    configuredSeeds: seedClusters,
    startSeed: 51_001,
    maxRounds: 100,
    rotationsPerSeed: 8,
    scheduledGames: pairedGames,
    minimumPlacementImprovement: 0.1,
    topFourNoninferiorityGuard: 0.02,
    winRateNoninferiorityGuard: 0.03,
    incumbentDrawnGames: 0,
    candidateDrawnGames: 0,
    incumbentTruncatedGames: 0,
    candidateTruncatedGames: 0,
    placement: {
      pairedGames,
      seedClusters,
      meanPlacementDelta: -0.2,
      confidence95: { lower: -0.3, upper: -0.1 },
    },
    topFour: {
      pairedGames,
      seedClusters,
      meanRateDelta: 0,
      confidence95: { lower: -0.02, upper: 0.02 },
    },
    win: {
      pairedGames,
      seedClusters,
      meanRateDelta: 0,
      confidence95: { lower: -0.03, upper: 0.01 },
    },
    provenanceStable: true,
  };

  assert.deepEqual(evaluateAiPolicyConfirmationGate(evidence), {
    accepted: true,
    reasons: [],
  });

  const rejected = evaluateAiPolicyConfirmationGate({
    ...evidence,
    scheduledGames: pairedGames - 1,
    provenanceStable: false,
    candidateTruncatedGames: 1,
    placement: {
      ...evidence.placement,
      meanPlacementDelta: -0.05,
      confidence95: { lower: -0.1, upper: 0 },
    },
  });
  assert.equal(rejected.accepted, false);
  assert.ok(
    rejected.reasons.some((reason) => reason.includes("schedule exactly")),
  );
  assert.ok(
    rejected.reasons.some((reason) => reason.includes("provenance")),
  );
  assert.ok(
    rejected.reasons.some((reason) => reason.includes("truncated")),
  );
  assert.ok(
    rejected.reasons.some((reason) => reason.includes("at most -0.10")),
  );
  assert.ok(
    rejected.reasons.some((reason) => reason.includes("below 0")),
  );

  const extendedSeedSet = evaluateAiPolicyConfirmationGate({
    ...evidence,
    configuredSeeds: seedClusters + 1,
    scheduledGames: pairedGames + 8,
    placement: {
      ...evidence.placement,
      pairedGames: pairedGames + 8,
      seedClusters: seedClusters + 1,
    },
    topFour: {
      ...evidence.topFour,
      pairedGames: pairedGames + 8,
      seedClusters: seedClusters + 1,
    },
    win: {
      ...evidence.win,
      pairedGames: pairedGames + 8,
      seedClusters: seedClusters + 1,
    },
  });
  assert.equal(extendedSeedSet.accepted, false);
  assert.ok(
    extendedSeedSet.reasons.some((reason) =>
      reason.includes("exactly 96 seed clusters"),
    ),
  );

  const topFourBoundaryRegression = evaluateAiPolicyConfirmationGate({
    ...evidence,
    topFour: {
      ...evidence.topFour,
      confidence95: { lower: -0.02004, upper: 0.01 },
    },
  });
  assert.equal(topFourBoundaryRegression.accepted, false);
  assert.ok(
    topFourBoundaryRegression.reasons.some((reason) =>
      reason.includes("top-four CI lower bound"),
    ),
  );

  const winBoundaryRegression = evaluateAiPolicyConfirmationGate({
    ...evidence,
    win: {
      ...evidence.win,
      confidence95: { lower: -0.03004, upper: 0.01 },
    },
  });
  assert.equal(winBoundaryRegression.accepted, false);
  assert.ok(
    winBoundaryRegression.reasons.some((reason) =>
      reason.includes("win CI lower bound"),
    ),
  );
});

test("fixed-candidate confirmation validates live incumbent and candidate", () => {
  const base = {
    strategyId: "deathrattle" as const,
    parameter: "upgradeRoundOffset" as const,
    seeds: 1,
    startSeed: 61_001,
    maxRounds: 1,
  };
  assert.throws(
    () => runAiPolicyConfirmation({ ...base, candidateValue: 1 }),
    /candidate must differ/,
  );
  assert.throws(
    () =>
      runAiPolicyConfirmation({
        ...base,
        incumbentValue: 0,
        candidateValue: 2,
      }),
    /incumbent 0 must equal live value 1/,
  );
  assert.throws(
    () => runAiPolicyConfirmation({ ...base, candidateValue: 0.5 }),
    /candidate must be an integer/,
  );
});

test("one-seed fixed-candidate confirmation runs both arms but is rejected", () => {
  const progress: Array<[string, number, number]> = [];
  let mutatedOriginalOptions = false;
  const options: AiPolicyConfirmationOptions = {
    strategyId: "deathrattle",
    parameter: "upgradeRoundOffset",
    candidateValue: 0,
    seeds: 1,
    startSeed: 61_011,
    maxRounds: 1,
  };
  options.onProgress = ({ arm, processedGames, scheduledGames }) => {
    if (!mutatedOriginalOptions) {
      mutatedOriginalOptions = true;
      options.strategyId = "powerLevel";
      options.parameter = "maxRefreshes";
      options.candidateValue = 2;
      options.seeds = AI_POLICY_CONFIRMATION_REGISTRATION.seeds;
      options.startSeed = AI_POLICY_CONFIRMATION_REGISTRATION.startSeed;
      options.maxRounds = AI_POLICY_CONFIRMATION_REGISTRATION.maxRounds;
      options.minimumPlacementImprovement = 0.2;
      options.onProgress = undefined;
    }
    progress.push([arm, processedGames, scheduledGames]);
  };
  const confirmation = runAiPolicyConfirmation(options);

  assert.equal(confirmation.method, "fixed-candidate-confirmation-v1");
  assert.equal(confirmation.liveValue, 1);
  assert.equal(confirmation.incumbentValue, 1);
  assert.equal(confirmation.candidateValue, 0);
  assert.equal(confirmation.incumbent.value, 1);
  assert.equal(confirmation.candidate.value, 0);
  assert.equal(confirmation.incumbent.scheduledGames, 8);
  assert.equal(confirmation.candidate.scheduledGames, 8);
  assert.equal(confirmation.config.scheduledGames, 8);
  assert.equal(
    confirmation.config.minimumSeedClusters,
    AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS,
  );
  assert.equal(confirmation.config.topFourNoninferiorityGuard, 0.02);
  assert.equal(confirmation.config.winRateNoninferiorityGuard, 0.03);
  assert.equal(confirmation.strategyProfileBindingsStable, true);
  assert.equal(confirmation.registrationMatched, false);
  assert.equal(confirmation.accepted, false);
  assert.equal(mutatedOriginalOptions, true);
  assert.ok(
    confirmation.acceptanceReasons.some((reason) =>
      reason.includes(
        `exactly ${AI_POLICY_CONFIRMATION_MINIMUM_SEED_CLUSTERS}`,
      ),
    ),
  );
  assert.deepEqual(progress[0], ["incumbent", 1, 8]);
  assert.deepEqual(progress.at(-1), ["candidate", 8, 8]);
  assert.equal(progress.length, 16);
  assert.equal(getAiStrategyProfile("player-7").upgradeRoundOffset, 1);
});

test("training screen registration freezes exactly three isolated profiles", () => {
  assert.equal(
    AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
    "power-level-offset0-final-conversion-screen-30300001-v1",
  );
  assert.equal(Object.isFrozen(AI_POLICY_TRAINING_SCREEN_REGISTRATION), true);
  assert.equal(
    Object.isFrozen(AI_POLICY_TRAINING_SCREEN_REGISTRATION.candidateIds),
    true,
  );
  assert.equal(Object.isFrozen(AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE), true);
  assert.equal(Object.isFrozen(AI_POLICY_TRAINING_SCREEN_CANDIDATES), true);
  assert.equal(Object.isFrozen(AI_REGISTERED_TRAINING_BATCH_ARM_ORDER), true);
  assert.equal(
    AI_REGISTERED_TRAINING_BATCH_ARM_ORDER.every(Object.isFrozen),
    true,
  );
  assert.equal(
    AI_POLICY_TRAINING_SCREEN_CANDIDATES.every(
      (candidate) =>
        Object.isFrozen(candidate) && Object.isFrozen(candidate.profile),
    ),
    true,
  );
  assert.deepEqual(AI_POLICY_TRAINING_SCREEN_REGISTRATION, {
    id: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
    strategyId: "powerLevel",
    playerId: "player-5",
    seeds: 64,
    startSeed: 30_300_001,
    maxRounds: 100,
    rotationsPerSeed: 8,
    scheduledGames: 512,
    baselineStrategyProfileHash:
      "c9488d3eaf97e25a5026354f9a07f7579e4733158ff13122d411487e17366051",
    minimumPlacementImprovement: 0.1,
    topFourNoninferiorityGuard: 0.01,
    winRateNoninferiorityGuard: 0.02,
    candidateIds: [
      "offset0-scouted-shield-break-v1",
      "offset0-safe-tier6-v1",
      "offset0-tier6-refresh-v1",
    ],
  });
  assert.deepEqual(
    getAiStrategyProfile("player-5"),
    AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
  );
  assert.deepEqual(AI_REGISTERED_TRAINING_BATCH_ARM_ORDER, [
    { arm: "baseline", candidateId: null },
    {
      arm: "candidate",
      candidateId: "offset0-scouted-shield-break-v1",
    },
    { arm: "candidate", candidateId: "offset0-safe-tier6-v1" },
    { arm: "candidate", candidateId: "offset0-tier6-refresh-v1" },
  ]);

  const baseline = AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE as unknown as
    Record<string, unknown>;
  assert.deepEqual(
    AI_POLICY_TRAINING_SCREEN_CANDIDATES.map((candidate) => {
      const profile = candidate.profile as unknown as Record<string, unknown>;
      return {
        candidateId: candidate.id,
        changedKeys: Object.keys(baseline)
          .filter((key) => profile[key] !== baseline[key])
          .sort(),
      };
    }),
    [
      {
        candidateId: "offset0-scouted-shield-break-v1",
        changedKeys: ["scoutingWeight", "upgradeRoundOffset"],
      },
      {
        candidateId: "offset0-safe-tier6-v1",
        changedKeys: [
          "safeTierSixUpgradeAcceleration",
          "upgradeRoundOffset",
        ],
      },
      {
        candidateId: "offset0-tier6-refresh-v1",
        changedKeys: ["tierSixRefreshBonus", "upgradeRoundOffset"],
      },
    ],
  );
});

test("authoritative training result schema exposes aggregate audit only", () => {
  const resultSchema = Object.freeze({
    registrationId: true,
    requestedExpectedProtocolHash: true,
    protocolHash: true,
    protocolHashAfter: true,
    protocolStable: true,
    contentVersion: true,
    contentSnapshotSha256: true,
    contentSnapshotSha256After: true,
    contentSnapshotStable: true,
    policyVersion: true,
    evaluatorHash: true,
    evaluatorHashAfter: true,
    evaluatorStable: true,
    strategyProfileHash: true,
    strategyProfileHashAfter: true,
    strategyProfilesStable: true,
    candidateProfileBindingsStable: true,
    baseline: true,
    candidateProfileHashes: true,
    candidates: true,
    selected: true,
  } satisfies Record<keyof AiRegisteredPolicyTrainingScreenResult, true>);
  const summarySchema = Object.freeze({
    value: true,
    contentSnapshotSha256: true,
    contentSnapshotSha256After: true,
    contentSnapshotStable: true,
    evaluatorHash: true,
    evaluatorHashAfter: true,
    evaluatorStable: true,
    strategyProfileHash: true,
    strategyProfileHashAfter: true,
    strategyProfilesStable: true,
    scheduledGames: true,
    completedGames: true,
    drawnGames: true,
    truncatedGames: true,
    averagePlacement: true,
    topFourRate: true,
    winRate: true,
    comparisonToIncumbent: true,
    conservativeComparisonToIncumbent: true,
    conservativeTopFourComparisonToIncumbent: true,
    conservativeWinRateComparisonToIncumbent: true,
    trainingScore: true,
  } satisfies Record<keyof AiRegisteredTrainingVariantSummary, true>);
  const candidateSchema = Object.freeze({
    candidateId: true,
    profile: true,
    expectedStrategyProfileHash: true,
    profileBindingStable: true,
    summary: true,
    qualified: true,
    qualificationReasons: true,
  } satisfies Record<
    keyof AiRegisteredPolicyTrainingScreenResult["candidates"][number],
    true
  >);
  const candidateHashSchema = Object.freeze({
    candidateId: true,
    strategyProfileHash: true,
  } satisfies Record<
    keyof AiRegisteredPolicyTrainingScreenResult["candidateProfileHashes"][number],
    true
  >);

  for (const schema of [
    resultSchema,
    summarySchema,
    candidateSchema,
    candidateHashSchema,
  ]) {
    assert.equal("games" in schema, false);
    assert.equal("raw" in schema, false);
    assert.equal("rawGames" in schema, false);
    assert.equal("rawResults" in schema, false);
  }
});

test("registered training screen preflight rejects drift before its first game", () => {
  const expectedProtocolHash =
    computeAiPolicyTrainingScreenProtocolHash();
  const retired301ProtocolHash =
    "85fd1ae26ddbeb26c6f5498c757012a3d53977ba56903b5fa80ad3fedc055209";
  let progressCalls = 0;
  assert.throws(
    () =>
      runAiPolicyTrainingScreen({
        seeds: 64,
        startSeed: 30_100_001,
        maxRounds: 100,
        onProgress: () => {
          progressCalls += 1;
        },
      }),
    /seed ledger rejected access.*aborted-unobserved/,
  );
  assert.equal(progressCalls, 0);
  assert.throws(
    () =>
      runAiPolicyTrainingScreen({
        seeds: 64,
        startSeed: 30_300_001,
        maxRounds: 1,
        onProgress: () => {
          progressCalls += 1;
        },
      }),
    /preflight failed before games.*maxRounds/,
  );
  assert.equal(progressCalls, 0);
  assert.throws(
    () =>
      runAiPolicyTrainingScreen({
        seeds: 64,
        startSeed: 30_300_001,
        maxRounds: 100,
      }),
    /preflight failed before games.*expectedProtocolHash/,
  );
  assert.throws(
    () =>
      runAiPolicyTrainingScreen({
        seeds: 64,
        startSeed: 30_300_001,
        maxRounds: 100,
        expectedProtocolHash: retired301ProtocolHash,
      }),
    /preflight failed before games.*does not match/,
  );
  assert.throws(
    () =>
      runAiPolicyTrainingScreen({
        seeds: 64,
        startSeed: 30_300_001,
        maxRounds: 100,
        expectedProtocolHash,
        onProgress: () => {
          progressCalls += 1;
        },
      }),
    /preflight failed before games.*do not accept external progress callbacks/,
  );
  assert.equal(progressCalls, 0);

  const nonTargetDrift = {
    ...getAiStrategyProfile("player-6"),
    maxRefreshes: getAiStrategyProfile("player-6").maxRefreshes + 1,
  };
  withAiStrategyProfileOverrides(
    new Map([["player-6", nonTargetDrift]]),
    () => {
      assert.throws(
        () =>
          runAiPolicyTrainingScreen({
            seeds: 64,
            startSeed: 30_300_001,
            maxRounds: 100,
            expectedProtocolHash,
          }),
        /preflight failed before games.*strategy profile hash/,
      );
    },
  );
  assert.equal(progressCalls, 0);

  const targetDrift = {
    ...getAiStrategyProfile("player-5"),
    scoutingWeight: 0.46,
  };
  withAiStrategyProfileOverrides(
    new Map([["player-5", targetDrift]]),
    () => {
      assert.throws(
        () =>
          runAiPolicyTrainingScreen({
            seeds: 64,
            startSeed: 30_300_001,
            maxRounds: 100,
            expectedProtocolHash,
          }),
        /preflight failed before games.*baseline profile bytes/,
      );
    },
  );
  assert.equal(progressCalls, 0);
});

test("protected training CLI parser accepts only the hash handshake", () => {
  const hash = computeAiPolicyTrainingScreenProtocolHash();
  const parsed = parseAiPolicyTrainingScreenCliArguments([
    "--training-screen",
    "--expected-protocol-hash",
    hash,
  ]);
  assert.deepEqual(parsed, { expectedProtocolHash: hash });
  assert.equal(Object.isFrozen(parsed), true);
  for (const invalid of [
    [],
    ["--training-screen"],
    ["--training-screen", "--training-screen", "--expected-protocol-hash", hash],
    ["--training-screen", "--expected-protocol-hash"],
    ["--training-screen", "--expected-protocol-hash", hash, "extra"],
    ["--training-screen", `--expected-protocol-hash=${hash}`],
    ["--training-screen=true", "--expected-protocol-hash", hash],
    ["--training-screen", "--expected-protocol-hash", hash, "--seeds", "64"],
    [
      "--training-screen",
      "--expected-protocol-hash",
      hash,
      "--expected-protocol-hash",
      hash,
    ],
    ["--training-screen", "--expected-protocol-hash", hash.toUpperCase()],
  ]) {
    assert.throws(() => parseAiPolicyTrainingScreenCliArguments(invalid));
  }
});

test("training screen qualification and selection use raw registered evidence", () => {
  type CandidateEvidence =
    AiPolicyTrainingScreenEvidence["candidates"][number];
  type CandidateId = CandidateEvidence["candidateId"];
  const candidate = (
    candidateId: CandidateId,
    placementUpper = -0.05,
    winLower = 0.02,
    topFourLower = -0.01,
  ): CandidateEvidence => ({
    candidateId,
    scheduledGames: 512,
    drawnGames: 0,
    truncatedGames: 0,
    placement: {
      pairedGames: 512,
      seedClusters: 64,
      meanPlacementDelta: -0.1,
      confidence95: { lower: -0.2, upper: placementUpper },
    },
    topFour: {
      pairedGames: 512,
      seedClusters: 64,
      meanRateDelta: 0.03,
      confidence95: { lower: topFourLower, upper: 0.08 },
    },
    win: {
      pairedGames: 512,
      seedClusters: 64,
      meanRateDelta: 0.04,
      confidence95: { lower: winLower, upper: 0.08 },
    },
    provenanceStable: true,
  });
  const evidence = (
    candidates: readonly CandidateEvidence[],
  ): AiPolicyTrainingScreenEvidence => ({
    registrationId: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
    seeds: 64,
    startSeed: 30_300_001,
    maxRounds: 100,
    rotationsPerSeed: 8,
    scheduledGames: 512,
    minimumPlacementImprovement: 0.1,
    topFourNoninferiorityGuard: 0.01,
    winRateNoninferiorityGuard: 0.02,
    baselineScheduledGames: 512,
    baselineDrawnGames: 0,
    baselineTruncatedGames: 0,
    provenanceStable: true,
    candidates,
  });
  const ids = AI_POLICY_TRAINING_SCREEN_REGISTRATION.candidateIds;
  const allAtBoundary = evidence(ids.map((id) => candidate(id)));
  assert.deepEqual(
    evaluateAiPolicyTrainingCandidateQualification(
      allAtBoundary.candidates[0]!,
      allAtBoundary,
    ),
    { qualified: true, reasons: [] },
  );

  assert.equal(
    selectAiPolicyTrainingCandidate(
      evidence([
        candidate(ids[0], -0.03, 0.08, 0.08),
        candidate(ids[1], -0.08, 0.02, -0.01),
        candidate(ids[2], -0.05, 0.08, 0.08),
      ]),
    ),
    ids[1],
    "placement CI upper bound ranks first",
  );
  assert.equal(
    selectAiPolicyTrainingCandidate(
      evidence([
        candidate(ids[0], -0.05, 0.03, 0.08),
        candidate(ids[1], -0.05, 0.04, -0.01),
        candidate(ids[2], -0.05, 0.02, 0.08),
      ]),
    ),
    ids[1],
    "win CI lower bound breaks a placement tie",
  );
  assert.equal(
    selectAiPolicyTrainingCandidate(
      evidence([
        candidate(ids[0], -0.05, 0.02, 0),
        candidate(ids[1], -0.05, 0.02, 0.01),
        candidate(ids[2], -0.05, 0.02, 0.005),
      ]),
    ),
    ids[1],
    "top-four CI lower bound breaks the next tie",
  );
  assert.equal(
    selectAiPolicyTrainingCandidate(
      evidence([...ids].reverse().map((id) => candidate(id))),
    ),
    [...ids].sort()[0],
    "candidate id provides an order-independent lexical final tie-break",
  );

  const rejectedCandidate = {
    ...candidate(ids[0]),
    truncatedGames: 1,
    win: {
      ...candidate(ids[0]).win,
      confidence95: { lower: -0.020_001, upper: 0.08 },
    },
  };
  const rejectedEvidence = evidence([
    rejectedCandidate,
    candidate(ids[1]),
    candidate(ids[2]),
  ]);
  const rejected = evaluateAiPolicyTrainingCandidateQualification(
    rejectedCandidate,
    rejectedEvidence,
  );
  assert.equal(rejected.qualified, false);
  assert.ok(rejected.reasons.some((reason) => reason.includes("truncated")));
  assert.ok(
    rejected.reasons.some((reason) => reason.includes("win CI lower bound")),
  );
  assert.equal(
    selectAiPolicyTrainingCandidate({ ...allAtBoundary, seeds: 65 }),
    null,
  );
  assert.equal(
    selectAiPolicyTrainingCandidate({
      ...allAtBoundary,
      candidates: allAtBoundary.candidates.slice(0, 2),
    }),
    null,
  );
});

test("diagnostic training screen snapshots inputs and audits all four arms", () => {
  const progress: Array<[string, string | null, number, number]> = [];
  let mutatedOriginalOptions = false;
  const options: AiPolicyTrainingScreenOptions = {
    seeds: 1,
    startSeed: 31_100_001,
    maxRounds: 1,
  };
  options.onProgress = ({
    arm,
    candidateId,
    processedGames,
    scheduledGames,
  }) => {
    if (!mutatedOriginalOptions) {
      mutatedOriginalOptions = true;
      options.seeds = AI_POLICY_TRAINING_SCREEN_REGISTRATION.seeds;
      options.startSeed = AI_POLICY_TRAINING_SCREEN_REGISTRATION.startSeed;
      options.maxRounds = AI_POLICY_TRAINING_SCREEN_REGISTRATION.maxRounds;
      options.onProgress = undefined;
    }
    progress.push([arm, candidateId, processedGames, scheduledGames]);
  };

  const result = runAiPolicyTrainingScreen(options);

  assert.equal(result.method, "fixed-candidate-training-screen-v1");
  assert.equal(result.registrationMatched, false);
  assert.equal(result.requestedExpectedProtocolHash, null);
  assert.equal(result.selected, null);
  assert.equal(result.config.seeds, 1);
  assert.equal(result.config.startSeed, 31_100_001);
  assert.equal(result.config.maxRounds, 1);
  assert.equal(result.config.scheduledGames, 8);
  assert.equal(result.baseline.scheduledGames, 8);
  assert.equal(result.candidates.length, 3);
  assert.equal(result.candidateProfileBindingsStable, true);
  assert.equal(result.protocolStable, true);
  assert.equal(result.searchEvaluatorStable, true);
  assert.equal(result.contentSnapshotStable, true);
  assert.equal(result.strategyProfilesStable, true);
  assert.equal(mutatedOriginalOptions, true);
  assert.match(result.protocolHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    result.candidates.map((candidateResult) => candidateResult.profile),
    AI_POLICY_TRAINING_SCREEN_CANDIDATES.map((candidate) => candidate.profile),
  );
  assert.equal(
    result.candidateProfileHashes.every(({ strategyProfileHash }) =>
      /^[a-f0-9]{64}$/.test(strategyProfileHash),
    ),
    true,
  );
  for (const summary of [
    result.baseline,
    ...result.candidates.map((candidateResult) => candidateResult.summary),
  ]) {
    assert.equal(summary.scheduledGames, 8);
    assert.equal(
      summary.completedGames + summary.drawnGames + summary.truncatedGames,
      8,
    );
    assert.equal("averagePlacement" in summary, true);
    assert.equal("topFourRate" in summary, true);
    assert.equal("winRate" in summary, true);
    assert.equal("meanPlacementDelta" in summary.comparisonToIncumbent, true);
    assert.equal("confidence95" in summary.comparisonToIncumbent, true);
  }
  assert.equal(
    result.candidates.every(
      (candidateResult) =>
        candidateResult.profileBindingStable &&
        !candidateResult.qualified &&
        candidateResult.qualificationReasons.some((reason) =>
          reason.includes("fixed registration"),
        ),
    ),
    true,
  );
  assert.deepEqual(progress[0], ["baseline", null, 1, 8]);
  assert.deepEqual(progress.at(-1), [
    "candidate",
    "offset0-tier6-refresh-v1",
    8,
    8,
  ]);
  assert.equal(progress.length, 32);
});

test("upgrade decisions react to health, board pressure, and strategy", () => {
  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-1"),
      round: 6,
      tavernTier: 3,
      health: 35,
      armor: 5,
      gold: 7,
      upgradeCost: 6,
      boardSize: 6,
      bestShopScore: 8,
      weakestBoardScore: 10,
    }),
    true,
    "a healthy stable board should take its normal upgrade",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-3"),
      round: 7,
      tavernTier: 3,
      health: 12,
      armor: 0,
      gold: 8,
      upgradeCost: 8,
      boardSize: 3,
      bestShopScore: 16,
      weakestBoardScore: 4,
    }),
    false,
    "the tempo profile should fill a weak board instead of spending all gold",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-5"),
      round: 5,
      tavernTier: 3,
      health: 30,
      armor: 0,
      gold: 8,
      upgradeCost: 8,
      boardSize: 5,
      bestShopScore: 5,
      weakestBoardScore: 12,
    }),
    true,
    "the power-level profile should advance early when it is safe",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-1"),
      round: 6,
      tavernTier: 3,
      health: 12,
      armor: 0,
      gold: 8,
      upgradeCost: 8,
      boardSize: 6,
      bestShopScore: 5,
      weakestBoardScore: 12,
      bestAffordableSpellScore: 10,
    }),
    false,
    "a low-health AI should spend on a strong affordable spell instead",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-1"),
      round: 6,
      tavernTier: 3,
      health: 14,
      armor: 0,
      gold: 7,
      upgradeCost: 7,
      boardSize: 6,
      bestShopScore: 5,
      weakestBoardScore: 6,
    }),
    false,
    "a pressured AI with a weak link should preserve roll-and-buy Gold",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-1"),
      round: 6,
      tavernTier: 3,
      health: 14,
      armor: 0,
      gold: 7,
      upgradeCost: 7,
      boardSize: 6,
      bestShopScore: 5,
      weakestBoardScore: 18,
    }),
    true,
    "low Health alone should not stop a genuinely strong board from leveling",
  );

});

test("fixed tier-six experiments are inert by default and obey every boundary", () => {
  const offsetZero = {
    ...getAiStrategyProfile("player-5"),
    upgradeRoundOffset: 0,
  };
  const safeTierSix = {
    ...offsetZero,
    safeTierSixUpgradeAcceleration: 1,
  };
  const safeContext = {
    round: 10,
    tavernTier: 5 as const,
    health: 24,
    armor: 0,
    gold: 10,
    upgradeCost: 7,
    boardSize: 7,
    bestShopScore: 16.49,
    weakestBoardScore: 14,
    bestAffordableSpellScore: 7.99,
  };

  assert.equal(
    shouldAiUpgrade({ profile: offsetZero, ...safeContext }),
    false,
    "the default-zero switch preserves the offset-zero tier-six schedule",
  );
  assert.equal(
    shouldAiUpgrade({ profile: safeTierSix, ...safeContext }),
    true,
    "the candidate advances tier six by exactly one round in its safe window",
  );
  for (const unsafeContext of [
    { ...safeContext, health: 23 },
    { ...safeContext, boardSize: 6 },
    { ...safeContext, gold: 9 },
    { ...safeContext, weakestBoardScore: 13.99 },
    { ...safeContext, bestShopScore: 16.5 },
    { ...safeContext, bestAffordableSpellScore: 8 },
  ]) {
    assert.equal(
      shouldAiUpgrade({ profile: safeTierSix, ...unsafeContext }),
      false,
    );
  }
  assert.equal(
    shouldAiUpgrade({
      profile: offsetZero,
      ...safeContext,
      round: 11,
    }),
    true,
    "the experiment does not delay the ordinary offset-zero schedule",
  );

  const tierSixRefresh = {
    ...offsetZero,
    tierSixRefreshBonus: 1,
  };
  assert.equal(aiRefreshLimit(offsetZero, 6, 7, 14), 2);
  assert.equal(aiRefreshLimit(tierSixRefresh, 6, 7, 14), 3);
  assert.equal(aiRefreshLimit(tierSixRefresh, 5, 7, 14), 2);
  assert.equal(aiRefreshLimit(tierSixRefresh, 6, 6, 14), 2);
  assert.equal(aiRefreshLimit(offsetZero, 6, 7, 13), 3);
  assert.equal(
    aiRefreshLimit(tierSixRefresh, 6, 7, 13),
    3,
    "low-health refresh behavior remains unchanged below the candidate floor",
  );
});

test("tribe identity is a soft preference and raw strength can override it", () => {
  const state = createGame(2_024);
  const player = playerById(state, "player-2");
  const template = player.shop[0];
  assert.ok(template);

  player.board = [
    definitionMinion(template, "BG_TTN_401", "mech-host-a"),
    definitionMinion(template, "BG_TTN_401", "mech-host-b"),
  ];

  const preferred = definitionMinion(
    template,
    "BG34_523",
    "preferred-mech",
    {
      attack: 8,
      health: 8,
      tribe: "mech",
      tribes: ["mech"],
      taunt: false,
      divineShield: false,
      reborn: false,
      poisonous: false,
      venomous: false,
      windfury: false,
      cleave: false,
    },
  );
  const offTheme = {
    ...preferred,
    instanceId: "off-theme-beast",
    tribe: "beast" as const,
    tribes: ["beast" as const],
  };
  assert.ok(
    scoreMinionForAi(player, preferred) >
      scoreMinionForAi(player, offTheme),
  );

  const overwhelmingOffTheme = {
    ...offTheme,
    instanceId: "overwhelming-beast",
    attack: 30,
    health: 30,
  };
  assert.ok(
    scoreMinionForAi(player, overwhelmingOffTheme) >
      scoreMinionForAi(player, preferred),
    "a large immediate upgrade must beat the preferred tribe",
  );
});

test("the triple profile values a pair and values its third copy even more", () => {
  const state = createGame(4_004);
  const player = playerById(state, "player-4");
  const template = player.shop[0];
  assert.ok(template);
  const candidate = definitionMinion(
    template,
    "BG28_300",
    "third-copy-candidate",
  );

  player.board = [];
  const noCopyScore = scoreMinionForAi(player, candidate);
  player.board = [
    definitionMinion(template, "BG28_300", "owned-copy-a"),
  ];
  const pairScore = scoreMinionForAi(player, candidate);
  player.board.push(
    definitionMinion(template, "BG28_300", "owned-copy-b"),
  );
  const tripleScore = scoreMinionForAi(player, candidate);

  assert.ok(pairScore > noCopyScore);
  assert.ok(tripleScore > pairScore);
});

test("AI copy-progress scoring excludes the owned minion being evaluated", () => {
  const state = createGame(4_008);
  const player = playerById(state, "player-4");
  const template = player.shop[0];
  assert.ok(template);
  const plainCopy = (instanceId: string) =>
    definitionMinion(
      template,
      "dragonspawn-lieutenant",
      instanceId,
      {
        attack: 5,
        health: 5,
        tribe: "neutral",
        tribes: [],
        taunt: false,
      },
    );
  const profile = {
    ...getAiStrategyProfile(player.id),
    statWeight: 1,
    synergyWeight: 0,
    preferredTribe: null,
    preferredTribeBonus: 0,
    pairBonus: 7,
    tripleBonus: 20,
    battlecryBonus: 0,
    deathrattleBonus: 0,
    economyBonus: 0,
    magneticBonus: 0,
    highTierBonus: 0,
  };

  withAiStrategyProfileOverrides(new Map([[player.id, profile]]), () => {
    const ownedA = plainCopy("owned-copy-progress-a");
    const ownedB = plainCopy("owned-copy-progress-b");
    const shopCandidate = plainCopy("shop-copy-progress-candidate");

    player.board = [];
    const externalNoCopyScore = scoreMinionForAi(player, shopCandidate);
    player.board = [ownedA];
    assert.equal(
      scoreMinionForAi(player, ownedA),
      externalNoCopyScore,
      "an owned singleton is not already a pair with itself",
    );
    assert.equal(
      scoreMinionForAi(player, shopCandidate) - externalNoCopyScore,
      profile.pairBonus,
      "a shop candidate still completes a real pair",
    );

    player.board.push(ownedB);
    assert.equal(
      scoreMinionForAi(player, ownedA) - externalNoCopyScore,
      profile.pairBonus,
      "each member of a real owned pair retains pair value",
    );
    assert.equal(
      scoreMinionForAi(player, shopCandidate) - externalNoCopyScore,
      profile.tripleBonus,
      "a shop candidate still receives third-copy value",
    );

    player.board = [];
    player.hand = [ownedA];
    assert.equal(
      scoreMinionForAi(player, ownedA),
      externalNoCopyScore,
      "the same self-exclusion applies to a hand singleton",
    );
    player.board = [ownedB];
    assert.equal(
      scoreMinionForAi(player, ownedA) - externalNoCopyScore,
      profile.pairBonus,
      "copy progress spans board and hand without counting the subject twice",
    );
    assert.equal(
      scoreMinionForAi(player, ownedB) - externalNoCopyScore,
      profile.pairBonus,
    );

    const ordinaryGolden = {
      ...shopCandidate,
      instanceId: "ordinary-golden-copy-progress",
      golden: true,
    };
    player.board = [ownedA, ownedB];
    player.hand = [];
    assert.equal(
      scoreMinionForAi(player, ordinaryGolden),
      externalNoCopyScore,
      "an ordinary Golden candidate cannot triple again",
    );
    assert.equal(
      scoreMinionForAi(player, shopCandidate, "magneticAttachment"),
      externalNoCopyScore,
      "a card that will be fused cannot receive pair or triple value",
    );

    const surpriseA = definitionMinion(
      template,
      "BG26_175",
      "owned-surprise-a",
      { attack: 0, health: 0 },
    );
    const surpriseB = {
      ...surpriseA,
      instanceId: "owned-surprise-b",
    };
    const surpriseC = {
      ...surpriseA,
      instanceId: "owned-surprise-c",
      golden: true,
    };
    player.board = [surpriseA];
    const surpriseSingletonScore = scoreMinionForAi(player, surpriseA);
    player.board.push(surpriseB);
    assert.equal(
      scoreMinionForAi(player, surpriseA) - surpriseSingletonScore,
      profile.pairBonus,
    );
    player.board.push(surpriseC);
    assert.equal(
      scoreMinionForAi(player, surpriseA) - surpriseSingletonScore,
      profile.tripleBonus,
      "Golden Surprise remains one physical wildcard for retriples",
    );
  });
});

test("AI values Elemental of Surprise wildcard triples and Golden retriples", () => {
  const state = createGame(4_005);
  const player = playerById(state, "player-4");
  const template = player.shop[0];
  assert.ok(template);
  const surprise = definitionMinion(
    template,
    "BG26_175",
    "surprise-candidate",
  );

  const profile = {
    ...getAiStrategyProfile(player.id),
    statWeight: 0,
    synergyWeight: 0,
    preferredTribe: null,
    preferredTribeBonus: 0,
    pairBonus: 5,
    tripleBonus: 20,
    highTierBonus: 0,
  };

  withAiStrategyProfileOverrides(new Map([[player.id, profile]]), () => {
    player.board = [
      definitionMinion(template, "BGS_126", "elemental-copy-a"),
    ];
    const elementalPairScore = scoreMinionForAi(player, surprise);
    player.board.push(
      definitionMinion(template, "BGS_126", "elemental-copy-b"),
    );
    const elementalTripleScore = scoreMinionForAi(player, surprise);
    assert.equal(elementalTripleScore - elementalPairScore, 15);

    player.board = [
      definitionMinion(template, "BG26_175", "surprise-copy-a"),
    ];
    const surprisePairScore = scoreMinionForAi(player, surprise);
    player.board.push(
      definitionMinion(template, "BG26_175", "golden-surprise-copy", {
        golden: true,
      }),
    );
    const surpriseRetripleScore = scoreMinionForAi(player, surprise);
    assert.equal(surpriseRetripleScore - surprisePairScore, 15);
  });
});

test("AI buys a Surprise triple from a full board without selling first", () => {
  const state = createGame(4_006);
  state.round = 8;
  isolateAiLobby(state, "player-4");
  const player = playerById(state, "player-4");
  const template = player.shop[0];
  assert.ok(template);
  player.alive = true;
  player.health = 30;
  player.tavernTier = 6;
  player.gold = 3;
  player.hand = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.board = [
    definitionMinion(template, "BGS_126", "full-pair-a"),
    definitionMinion(template, "BGS_126", "full-pair-b"),
    ...Array.from({ length: 5 }, (_, index) =>
      definitionMinion(
        template,
        "BG34_523",
        `full-board-keeper-${index}`,
        { attack: 100, health: 100, golden: true },
      ),
    ),
  ];
  player.shop = [
    definitionMinion(template, "BG26_175", "full-board-surprise", {
      attack: 0,
      health: 1,
    }),
  ];
  const keeperIds = player.board
    .filter((minion) => minion.instanceId.startsWith("full-board-keeper-"))
    .map((minion) => minion.instanceId)
    .sort();

  const after = gameReducer(state, { type: "END_TURN" });
  const recruited = playerById(after, "player-4");
  assert.deepEqual(
    recruited.board
      .filter((minion) => minion.instanceId.startsWith("full-board-keeper-"))
      .map((minion) => minion.instanceId)
      .sort(),
    keeperIds,
  );
  assert.ok(
    recruited.board.some(
      (minion) => minion.definitionId === "BGS_126" && minion.golden,
    ),
  );
  assert.ok(recruited.board.length >= 6);
});

test("AI buys the exact shop offer certified before a full-board replacement", () => {
  const state = createGame(4_007);
  state.round = 8;
  isolateAiLobby(state, "player-1");
  const player = playerById(state, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.alive = true;
  player.health = 30;
  player.tavernTier = 6;
  player.gold = 3;
  player.hand = [];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const plainMinion = (
    instanceId: string,
    attack: number,
    health: number,
    tribe: "mech" | "neutral",
  ) =>
    definitionMinion(
      template,
      "dragonspawn-lieutenant",
      instanceId,
      {
        attack,
        health,
        tribe,
        tribes: tribe === "neutral" ? [] : [tribe],
        taunt: false,
        divineShield: false,
        reborn: false,
        poisonous: false,
        venomous: false,
        windfury: false,
        cleave: false,
      },
    );

  const weakMech = definitionMinion(
    template,
    "BG20_301",
    "replacement-weak-mech",
    {
      attack: 4,
      health: 5,
      tribe: "mech",
      tribes: ["mech"],
      taunt: false,
      divineShield: false,
      reborn: false,
      poisonous: false,
      venomous: false,
      windfury: false,
      cleave: false,
      poolCopies: 1,
    },
  );
  const certifiedOffer = {
    ...plainMinion("certified-mech-offer", 5, 5, "mech"),
    poolCopies: 1,
  };
  const uncertifiedOffer = {
    ...plainMinion("uncertified-neutral-offer", 6, 5, "neutral"),
    poolCopies: 1,
  };
  player.board = [
    weakMech,
    ...Array.from({ length: 6 }, (_, index) => ({
        ...plainMinion(
          `replacement-keeper-${index}`,
          100,
          100,
          "neutral",
        ),
        // Golden ordinary minions do not combine with the non-Golden offer;
        // the fixture is about replacement certification, not triple rules.
        golden: true,
      }),
    ),
  ];
  player.shop = [certifiedOffer, uncertifiedOffer];
  player.hand = Array.from({ length: 9 }, (_, index) => ({
    ...plainMinion(
      `locked-replacement-hand-${index}`,
      1,
      1,
      "neutral",
    ),
    golden: true,
    playableFromRound: state.round + 1,
  }));
  const weakPoolBefore = state.pool[weakMech.definitionId] ?? 0;

  const profile = {
    ...getAiStrategyProfile(player.id),
    minimumUpgradeHealth: 0,
    statWeight: 1,
    synergyWeight: 2,
    preferredTribe: null,
    preferredTribeBonus: 0,
    pairBonus: 0,
    tripleBonus: 0,
    battlecryBonus: 0,
    deathrattleBonus: 0,
    economyBonus: 0,
    magneticBonus: 0,
    highTierBonus: 0,
    replacementMargin: 0.5,
    maxRefreshes: 0,
  };

  const after = withAiStrategyProfileOverrides(
    new Map([[player.id, profile]]),
    () => {
      const weakScore = scoreMinionForAi(player, weakMech);
      const certifiedScore = scoreMinionForAi(player, certifiedOffer);
      const uncertifiedScore = scoreMinionForAi(player, uncertifiedOffer);
      assert.ok(certifiedScore > uncertifiedScore);
      assert.ok(certifiedScore >= weakScore + profile.replacementMargin);
      assert.ok(uncertifiedScore < weakScore + profile.replacementMargin);

      const afterSellingWeak = {
        ...player,
        board: player.board.filter(
          (minion) => minion.instanceId !== weakMech.instanceId,
        ),
      };
      assert.ok(
        scoreMinionForAi(afterSellingWeak, certifiedOffer) <
          scoreMinionForAi(afterSellingWeak, uncertifiedOffer),
        "selling the weak Mech must flip the shop ranking",
      );
      return gameReducer(state, { type: "END_TURN" });
    },
  );

  const recruited = playerById(after, player.id);
  assert.equal(
    recruited.board.some(
      (minion) => minion.instanceId === weakMech.instanceId,
    ),
    false,
  );
  assert.ok(
    recruited.board.some(
      (minion) => minion.instanceId === certifiedOffer.instanceId,
    ),
  );
  assert.equal(
    [...recruited.board, ...recruited.hand].some(
      (card) => card.instanceId === uncertifiedOffer.instanceId,
    ),
    false,
  );
  assert.equal(recruited.board.length, 7);
  assert.equal(
    after.pool[weakMech.definitionId],
    weakPoolBefore + 1,
    "the sold minion returns its owned pool copy",
  );
  assert.equal(
    recruited.board.find(
      (minion) => minion.instanceId === certifiedOffer.instanceId,
    )?.poolCopies,
    1,
  );
  assert.equal(
    recruited.shop.find(
      (minion) => minion.instanceId === uncertifiedOffer.instanceId,
    )?.poolCopies,
    1,
  );
  assert.equal(recruited.hand.length, 9);
  assert.equal(
    recruited.hand.some((card) => card.kind === "bloodGem"),
    false,
    "buying first prevents the sell trigger from filling the last hand slot",
  );
  assert.equal(recruited.gold, 1);
});

test("candidate A alone enables the observed shielded-taunt breaker order", () => {
  const state = createGame(7_005);
  const player = playerById(state, "player-5");
  const opponent = playerById(state, state.humanPlayerId);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG20_301", "small-shield-breaker", {
      attack: 2,
      health: 8,
      taunt: false,
      divineShield: false,
      cleave: false,
    }),
    definitionMinion(template, "BG20_301", "large-attacker", {
      attack: 12,
      health: 12,
      taunt: false,
      divineShield: false,
      cleave: false,
    }),
  ];
  opponent.board = [
    definitionMinion(template, "BG20_301", "observed-shielded-taunt", {
      attack: 6,
      health: 6,
      taunt: true,
      divineShield: true,
      cleave: false,
    }),
  ];
  const originalOrder = player.board.map((minion) => minion.instanceId);

  assert.equal(getAiStrategyProfile("player-5").scoutingWeight, 0.45);
  assert.deepEqual(planAiBoardOrder(player, opponent), [
    "large-attacker",
    "small-shield-breaker",
  ]);
  const candidateA = AI_POLICY_TRAINING_SCREEN_CANDIDATES.find(
    (candidate) => candidate.id === "offset0-scouted-shield-break-v1",
  );
  assert.ok(candidateA);
  const candidateOrder = withAiStrategyProfileOverrides(
    new Map([["player-5", { ...candidateA.profile }]]),
    () => planAiBoardOrder(player, opponent),
  );
  assert.deepEqual(candidateOrder, [
    "small-shield-breaker",
    "large-attacker",
  ]);
  assert.deepEqual(
    player.board.map((minion) => minion.instanceId),
    originalOrder,
  );
  assert.equal(getAiStrategyProfile("player-5").scoutingWeight, 0.45);
  assert.deepEqual(planAiBoardOrder(player, opponent), [
    "large-attacker",
    "small-shield-breaker",
  ]);
});

test("opponent-aware positioning protects engines from cleave without mutation", () => {
  const state = createGame(7_007);
  const player = playerById(state, "player-7");
  const opponent = playerById(state, state.humanPlayerId);
  const template = player.shop[0];
  assert.ok(template);

  player.board = [
    definitionMinion(template, "titus-rivendare", "support-engine"),
    definitionMinion(template, "BG20_301", "large-taunt", {
      attack: 12,
      health: 12,
      taunt: true,
    }),
    definitionMinion(template, "BG28_300", "deathrattle"),
    definitionMinion(template, "BG20_301", "large-attacker", {
      attack: 10,
      health: 10,
    }),
    definitionMinion(template, "BG20_301", "cleave-buffer", {
      attack: 1,
      health: 1,
    }),
  ];
  opponent.board = [
    definitionMinion(template, "cave-hydra", "enemy-cleave", {
      cleave: true,
    }),
  ];
  const originalOrder = player.board.map((minion) => minion.instanceId);

  const plannedOrder = planAiBoardOrder(player, opponent);

  assert.deepEqual(
    player.board.map((minion) => minion.instanceId),
    originalOrder,
    "the planner must not mutate the recruit state",
  );
  const tauntIndex = plannedOrder.indexOf("large-taunt");
  assert.equal(plannedOrder[tauntIndex - 1], "cleave-buffer");
  assert.ok(
    plannedOrder.indexOf("deathrattle") <
      plannedOrder.indexOf("support-engine"),
  );
  assert.notEqual(plannedOrder[tauntIndex - 1], "support-engine");
});

test("the recruit engine executes safe leveling and low-health tempo plans", () => {
  const levelingState = createGame(5_005);
  levelingState.round = 5;
  isolateAiLobby(levelingState, "player-5");
  const leveler = playerById(levelingState, "player-5");
  const levelTemplate = leveler.shop[0];
  assert.ok(levelTemplate);
  leveler.alive = true;
  leveler.health = 30;
  leveler.armor = 0;
  leveler.tavernTier = 3;
  leveler.upgradeDiscount = 0;
  leveler.board = Array.from({ length: 5 }, (_, index) =>
    definitionMinion(
      levelTemplate,
      "BG_TTN_401",
      `stable-board-${index}`,
      { attack: 20, health: 20 },
    ),
  );
  leveler.shop = [
    definitionMinion(levelTemplate, "BG28_300", "weak-shop", {
      attack: 1,
      health: 1,
    }),
  ];
  leveler.hand = [];
  leveler.spellShop = null;
  leveler.additionalSpellShop = [];
  leveler.gold = getUpgradeCost(levelingState, leveler.id);

  const afterLeveling = gameReducer(levelingState, { type: "END_TURN" });
  assert.equal(playerById(afterLeveling, "player-5").tavernTier, 4);

  const tempoState = createGame(3_003);
  tempoState.round = 7;
  isolateAiLobby(tempoState, "player-3");
  const tempoPlayer = playerById(tempoState, "player-3");
  const tempoTemplate = tempoPlayer.shop[0];
  assert.ok(tempoTemplate);
  tempoPlayer.alive = true;
  tempoPlayer.health = 12;
  tempoPlayer.armor = 0;
  tempoPlayer.tavernTier = 3;
  tempoPlayer.upgradeDiscount = 0;
  tempoPlayer.board = [
    definitionMinion(tempoTemplate, "BG20_301", "weak-board-a", {
      attack: 1,
      health: 1,
    }),
    definitionMinion(tempoTemplate, "BG20_301", "weak-board-b", {
      attack: 1,
      health: 1,
    }),
  ];
  tempoPlayer.shop = [
    definitionMinion(tempoTemplate, "BG28_300", "tempo-shop", {
      attack: 20,
      health: 20,
    }),
  ];
  tempoPlayer.hand = [];
  tempoPlayer.spellShop = null;
  tempoPlayer.additionalSpellShop = [];
  tempoPlayer.gold = getUpgradeCost(tempoState, tempoPlayer.id);

  const afterTempo = gameReducer(tempoState, { type: "END_TURN" });
  const recruitedTempoPlayer = playerById(afterTempo, "player-3");
  assert.equal(recruitedTempoPlayer.tavernTier, 3);
  assert.ok(recruitedTempoPlayer.board.length >= 3);
});

test("round-one AI never spends its only three Gold and enters combat empty", () => {
  for (let seed = 1; seed <= 32; seed += 1) {
    const afterRecruit = gameReducer(createGame(seed), {
      type: "END_TURN",
    });
    for (const player of afterRecruit.players) {
      if (player.isHuman) {
        continue;
      }
      const battle = afterRecruit.lastRoundBattles.find(
        (candidate) =>
          candidate.playerAId === player.id ||
          candidate.playerBId === player.id,
      );
      const enteredThroughHandStartOfCombat =
        battle?.events.some(
          (event) =>
            event.type === "summon" &&
            event.actorPlayerId === player.id &&
            event.summonReason === "inHandStartOfCombat",
        ) ?? false;
      assert.ok(
        player.board.length >= 1 || enteredThroughHandStartOfCombat,
        `${player.id} entered round-one combat empty for seed ${seed}`,
      );
    }
  }
});

test("health-priced spells respect the post-purchase safety floor", () => {
  const runAtHealth = (health: number): PlayerState => {
    const state = createGame(8_008 + health);
    state.round = 3;
    isolateAiLobby(state, "player-1");
    const player = playerById(state, "player-1");
    const template = player.shop[0];
    assert.ok(template);
    player.alive = true;
    player.health = health;
    player.armor = 0;
    player.gold = 0;
    player.tavernTier = 2;
    player.board = [
      definitionMinion(template, "BG20_301", `health-board-${health}`, {
        attack: 5,
        health: 5,
      }),
    ];
    player.hand = [];
    player.shop = [];
    player.spellShop = tavernSpell(
      "tavern-spell-hasty-excavation",
      `hasty-${health}`,
    );
    player.additionalSpellShop = [];
    return playerById(
      gameReducer(state, { type: "END_TURN" }),
      player.id,
    );
  };

  assert.equal(runAtHealth(9).health, 9);
  assert.equal(runAtHealth(11).health, 8);
});

test("a full hand never makes AI sell before a purchase that cannot fit", () => {
  const state = createGame(9_009);
  state.round = 7;
  isolateAiLobby(state, "player-1");
  const player = playerById(state, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.alive = true;
  player.health = 30;
  player.gold = 3;
  player.tavernTier = 4;
  player.board = Array.from({ length: 7 }, (_, index) =>
    definitionMinion(template, "BG20_301", `full-board-${index}`, {
      attack: 2 + index,
      health: 3 + index,
    }),
  );
  const originalBoardIds = new Set(
    player.board.map((minion) => minion.instanceId),
  );
  player.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(template, "BG28_300", `locked-hand-${index}`, {
      attack: 1,
      health: 1,
      playableFromRound: state.round + 1,
    }),
  );
  player.shop = [
    definitionMinion(template, "BG_TTN_401", "unbuyable-upgrade", {
      attack: 50,
      health: 50,
    }),
  ];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const afterRecruit = playerById(
    gameReducer(state, { type: "END_TURN" }),
    player.id,
  );

  assert.equal(afterRecruit.board.length, 7);
  assert.ok(
    afterRecruit.board.every((minion) =>
      originalBoardIds.has(minion.instanceId),
    ),
  );
  assert.equal(afterRecruit.frozen, true);
});

test("AI positioning scouts only its own previous matchup snapshot", () => {
  const state = createGame(10_010);
  isolateAiLobby(state, "player-7");
  const player = playerById(state, "player-7");
  const human = playerById(state, state.humanPlayerId);
  const template = player.shop[0];
  assert.ok(template);
  player.gold = 0;
  player.board = [
    definitionMinion(template, "BG20_301", "first-ai-board", {
      attack: 1,
      health: 10,
    }),
  ];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  human.board = [
    definitionMinion(template, "cave-hydra", "observed-cleave", {
      attack: 1,
      health: 10,
      cleave: true,
    }),
  ];

  const priorCombat = gameReducer(state, { type: "END_TURN" });
  const nextRecruit = gameReducer(priorCombat, { type: "CONTINUE" });
  assert.ok(nextRecruit.lastRoundBattles.length > 0);
  const nextPlayer = playerById(nextRecruit, "player-7");
  const nextHuman = playerById(nextRecruit, nextRecruit.humanPlayerId);
  nextPlayer.gold = 0;
  nextPlayer.hand = [];
  nextPlayer.shop = [];
  nextPlayer.spellShop = null;
  nextPlayer.additionalSpellShop = [];
  nextPlayer.board = [
    definitionMinion(template, "titus-rivendare", "scouted-support"),
    definitionMinion(template, "BG20_301", "scouted-taunt", {
      attack: 12,
      health: 12,
      taunt: true,
    }),
    definitionMinion(template, "BG28_300", "scouted-deathrattle"),
    definitionMinion(template, "BG20_301", "scouted-attacker", {
      attack: 10,
      health: 10,
    }),
    definitionMinion(template, "BG20_301", "scouted-buffer", {
      attack: 1,
      health: 1,
    }),
  ];
  nextHuman.board = [
    definitionMinion(template, "BG20_301", "current-hidden-board", {
      attack: 0,
      health: 100,
      cleave: false,
    }),
  ];

  const nextCombat = gameReducer(nextRecruit, { type: "END_TURN" });
  const matchup = nextCombat.lastRoundBattles.find(
    (battle) =>
      battle.playerAId === nextPlayer.id ||
      battle.playerBId === nextPlayer.id,
  );
  assert.ok(matchup);
  const plannedOrder = matchup.initialBoards[nextPlayer.id].map(
    (minion) => minion.instanceId,
  );
  const tauntIndex = plannedOrder.indexOf("scouted-taunt");
  assert.equal(plannedOrder[tauntIndex - 1], "scouted-buffer");
});
