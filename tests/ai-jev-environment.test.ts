import assert from "node:assert/strict";
import test from "node:test";

import { getAiStrategyProfile } from "../lib/game/ai.ts";
import {
  AiTrainingEnvironment,
  type AiTrainingLegalAction,
} from "../lib/game/ai-training-environment.ts";
import {
  advanceHeadlessGame,
  createHeadlessGame,
  createHeadlessLobbyGame,
  type BoardMinionInstance,
  type GameState,
} from "../lib/game/engine.ts";

function actionByType(
  environment: AiTrainingEnvironment,
  type: AiTrainingLegalAction["type"],
): Readonly<AiTrainingLegalAction> {
  const action = environment.legalActions().find((candidate) => candidate.type === type);
  assert.ok(action, `expected ${type}`);
  return action;
}

function quietScenario(seed: number): GameState {
  const state = createHeadlessGame(seed);
  for (const player of state.players) {
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.heroPowerId = null;
  }
  return state;
}

function minion(
  template: BoardMinionInstance,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return {
    ...structuredClone(template),
    instanceId,
    poolCopies: 0,
    attachments: [],
    effectCounters: {},
    ...overrides,
  };
}

test("staged production remainder matches the canonical engine for every controlled seat", () => {
  for (const seed of [80_001, 80_019]) {
    const state = createHeadlessLobbyGame(seed);
    const initial = structuredClone(state);
    const expected = advanceHeadlessGame(state);
    for (let seat = 0; seat < state.players.length; seat += 1) {
      const environment = AiTrainingEnvironment.fromHeadlessState(state, seat);
      const result = environment.completeLegacyRecruitTurn();
      assert.equal(result.accepted, true);
      assert.deepEqual(environment.snapshotForBenchmark(), expected, `seed ${seed}, seat ${seat}`);
      assert.deepEqual(state, initial, "caller scenario remains unmodified");
      assert.throws(() => environment.completeLegacyRecruitTurn(), /no staged controlled recruit/);
    }
  }
});

test("multiple rounds including scheduled Trinket offers preserve exact production outcomes", () => {
  let canonical = createHeadlessLobbyGame(80_022, 999);
  const environment = AiTrainingEnvironment.fromHeadlessState(canonical, 4);
  for (let round = 1; round <= 9; round += 1) {
    canonical = advanceHeadlessGame(canonical);
    environment.completeLegacyRecruitTurn();
    assert.deepEqual(environment.snapshotForBenchmark(), canonical, `combat round ${round}`);
    canonical = advanceHeadlessGame(canonical);
    environment.advanceBenchmarkPhase();
    assert.equal(environment.observe().public.round, canonical.round);
    assert.equal(environment.observe().own.heroPowerId, canonical.players[4].heroPowerId);
  }
});

test("candidate purchase survives without a second controlled recruit and stale tokens are rejected", () => {
  const source = createHeadlessGame(80_031);
  const environment = AiTrainingEnvironment.fromHeadlessState(source, 2);
  const buy = actionByType(environment, "BUY_MINION");
  const result = environment.step(buy.token);
  assert.equal(result.accepted, true);
  const purchased = result.observation.own.hand[0];
  assert.ok(purchased);
  assert.equal(environment.step(buy.token).accepted, false);
  const finish = environment.step(actionByType(environment, "END_TURN").token);
  assert.equal(finish.accepted, true);
  const player = environment.snapshotForBenchmark().players[2];
  assert.equal(player.board.length, 0, "production must not play the candidate's held purchase");
  assert.equal(player.hand[0].definitionId, purchased.definitionId);
  assert.equal(player.gold, 0);
  assert.ok(finish.ownBattle);
});

test("candidate positioning is preserved and end-of-turn effects run exactly once", () => {
  const original = createHeadlessGame(80_041);
  const template = original.players[1].shop[0];
  const state = quietScenario(80_041);
  const player = state.players[1];
  player.board = [
    minion(template, "jev-position-a", { attack: 40, health: 40 }),
    minion(template, "jev-position-duo", {
      definitionId: "BG26_199",
      effectCounters: { periodicEndOfTurn: 1 },
      attack: 10,
      health: 10,
    }),
  ];
  const environment = AiTrainingEnvironment.fromHeadlessState(state, 1);
  const move = environment.legalActions().find(
    (action) => action.type === "MOVE_MINION" && action.source?.index === 1 && action.target?.index === 0,
  );
  assert.ok(move);
  assert.equal(environment.step(move.token).accepted, true);
  environment.step(actionByType(environment, "END_TURN").token);
  const finished = environment.snapshotForBenchmark();
  assert.equal(finished.players[1].board[0].instanceId, "jev-position-duo");
  assert.equal(finished.players[1].board[0].effectCounters?.periodicEndOfTurn, 2);
  const battle = finished.lastRoundBattles.find(
    (entry) => entry.playerAId === player.id || entry.playerBId === player.id,
  );
  assert.ok(battle);
  assert.equal(battle.initialBoards[player.id][0].instanceId, "jev-position-duo");
});

test("model observation and legal tokens omit private RNG, pool and rival recruit state", () => {
  const state = createHeadlessLobbyGame(80_051);
  state.players[0].board = [minion(state.players[0].shop[0], "jev-hidden-rival", {
    name: "PRIVATE_RIVAL_BOARD_SENTINEL",
    attack: 777,
    health: 777,
  })];
  const environment = AiTrainingEnvironment.fromHeadlessState(state, 5);
  const serialized = JSON.stringify({ observation: environment.observe(), actions: environment.legalActions() });
  for (const forbidden of ["rngState", '"seed"', '"pool"', "spellPool", "instanceId", "interactionId", "humanPlayerId"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(serialized.includes("PRIVATE_RIVAL_BOARD_SENTINEL"), false);
  assert.equal(environment.observe().own.isHuman, false);
  const snapshot = environment.snapshotForBenchmark();
  snapshot.players[5].gold = 999;
  assert.notEqual(environment.observe().own.gold, 999, "local snapshots are independent clones");
  const branch = environment.fork();
  branch.completeLegacyRecruitTurn();
  assert.equal(environment.observe().public.phase, "recruit");
});

test("candidate random actions consume the committed outcome once and probing stays inert", () => {
  const state = createHeadlessGame(80_052);
  state.players[2].gold = 4;
  const environment = AiTrainingEnvironment.fromHeadlessState(state, 2);
  const before = environment.snapshotForBenchmark();
  const refresh = actionByType(environment, "REFRESH_SHOP");
  environment.legalActions();
  environment.safeRecruitLegalActions();
  assert.equal(environment.snapshotForBenchmark().rngState, before.rngState);
  const result = environment.step(refresh.token);
  assert.equal(result.accepted, true);
  assert.equal(result.randomnessConsumed, true);
  const committed = environment.snapshotForBenchmark();
  assert.notEqual(committed.rngState, before.rngState);
  assert.equal(environment.step(refresh.token).accepted, false);
  assert.deepEqual(environment.snapshotForBenchmark(), committed);
  environment.completeLegacyRecruitTurn();
  assert.equal(environment.snapshotForBenchmark().phase, "combat");
});

test("pending candidate choices must resolve before the exact production remainder", () => {
  const state = quietScenario(80_053);
  state.players[2].heroPowerId = "hero-power-tb_baconshop_hp_047";
  state.players[2].heroPowerCounters = { eliseUses: 0 };
  state.players[2].gold = 2;
  const environment = AiTrainingEnvironment.fromHeadlessState(state, 2);
  assert.equal(environment.step(actionByType(environment, "ACTIVATE_HERO_POWER").token).accepted, true);
  assert.equal(environment.observe().own.pendingInteraction?.kind, "discover");
  assert.throws(() => environment.completeLegacyRecruitTurn(), /resolve the pending candidate choice/);
  assert.equal(environment.step(actionByType(environment, "RESOLVE_INTERACTION").token).accepted, true);
  assert.equal(environment.observe().own.pendingInteraction, null);
  assert.equal(environment.completeLegacyRecruitTurn().accepted, true);
  assert.equal(environment.snapshotForBenchmark().phase, "combat");
});

test("controlled elimination never ends the all-bot lobby early", () => {
  const state = createHeadlessLobbyGame(80_061);
  state.players[3].alive = false;
  state.players[3].health = 0;
  state.players[3].placement = 8;
  const environment = AiTrainingEnvironment.fromHeadlessState(state, 3);
  assert.equal(environment.legalActions().length, 0);
  let canonical = state;
  let phases = 0;
  while (canonical.phase !== "gameOver" && phases < 100) {
    canonical = advanceHeadlessGame(canonical);
    environment.advanceBenchmarkPhase();
    assert.deepEqual(environment.snapshotForBenchmark(), canonical);
    phases += 1;
  }
  assert.equal(canonical.phase, "gameOver");
  assert.equal(environment.observe().public.phase, "gameOver");
  assert.equal(environment.snapshotForBenchmark().players[3].placement, 8);
});

test("external minion and Hero Power actions reuse the production recruit-health guard", () => {
  const template = createHeadlessGame(80_071).players[1].shop[0];
  const state = quietScenario(80_071);
  const player = state.players[1];
  player.health = getAiStrategyProfile(player.id).healthSpendFloor + 1;
  player.hand = [minion(template, "jev-unsafe-damage", {
    definitionId: "vulgar-homunculus",
    tribe: "demon",
    tribes: ["demon"],
  })];
  player.heroPowerId = "hero-power-tb_baconshop_hp_049";
  player.shop = [minion(template, "jev-stealable")];
  player.gold = 2;
  const environment = AiTrainingEnvironment.fromHeadlessState(state, 1);
  assert.equal(environment.legalActions().some((action) => action.type === "PLAY_HAND_CARD"), false);
  assert.equal(environment.legalActions().some((action) => action.type === "ACTIVATE_HERO_POWER"), false);

  const healthy = structuredClone(state);
  healthy.players[1].health = 40;
  assert.equal(AiTrainingEnvironment.fromHeadlessState(healthy, 1).legalActions().some(
    (action) => action.type === "ACTIVATE_HERO_POWER",
  ), true);

  player.board = [minion(template, "jev-rewinder", {
    definitionId: "BG26_174",
    tribe: "demon",
    tribes: ["demon"],
  })];
  const withRewinder = AiTrainingEnvironment.fromHeadlessState(state, 1);
  assert.equal(withRewinder.legalActions().some((action) => action.type === "PLAY_HAND_CARD"), true);
});
