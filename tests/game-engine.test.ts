import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getUpgradeCost,
  type GameAction,
  type GameState,
  type MinionInstance,
  type PlayerState,
} from "../lib/game/engine.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyActions(
  state: GameState,
  actions: readonly GameAction[],
): GameState {
  return actions.reduce(gameReducer, state);
}

function fixtureMinion(
  template: MinionInstance,
  instanceId: string,
  overrides: Partial<MinionInstance> = {},
): MinionInstance {
  return {
    ...template,
    instanceId,
    divineShield: false,
    taunt: false,
    golden: false,
    poolCopies: 0,
    ...overrides,
  };
}

test("createGame builds one human and seven deterministic AI opponents", () => {
  const first = createGame(0x1234abcd);
  const replay = createGame(0x1234abcd);

  assert.deepEqual(replay, first);
  assert.equal(first.phase, "recruit");
  assert.equal(first.round, 1);
  assert.equal(first.players.length, 8);
  assert.equal(first.players.filter((player) => player.isHuman).length, 1);
  assert.equal(first.players.filter((player) => !player.isHuman).length, 7);
  assert.equal(first.humanPlayerId, "player-0");

  for (const player of first.players) {
    assert.equal(player.health, 40);
    assert.equal(player.gold, 3);
    assert.equal(player.tavernTier, 1);
    assert.equal(player.shop.length, 3);
    assert.equal(player.hand.length, 0);
    assert.equal(player.board.length, 0);
    assert.equal(player.alive, true);
  }

  const offeredIds = first.players.flatMap((player) =>
    player.shop.map((minion) => minion.instanceId),
  );
  assert.equal(new Set(offeredIds).size, offeredIds.length);
  assert.notDeepEqual(createGame(0x1234abce), first);
});

test("buy, play, and sell update economy and ownership without mutating input", () => {
  const initial = createGame(101);
  const initialSnapshot = jsonClone(initial);
  const offered = humanPlayer(initial).shop[0];
  const poolBeforeSell = initial.pool[offered.definitionId];

  let state = gameReducer(initial, { type: "BUY_MINION", shopIndex: 0 });
  assert.deepEqual(initial, initialSnapshot, "the reducer must be immutable");
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).shop.length, 2);
  assert.equal(humanPlayer(state).hand.length, 1);
  assert.equal(humanPlayer(state).hand[0].instanceId, offered.instanceId);

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(humanPlayer(state).hand.length, 0);
  assert.equal(humanPlayer(state).board.length, 1);
  assert.equal(humanPlayer(state).board[0].instanceId, offered.instanceId);

  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.equal(humanPlayer(state).gold, 1);
  assert.equal(humanPlayer(state).board.length, 0);
  assert.equal(state.pool[offered.definitionId], poolBeforeSell + 1);
});

test("refresh replaces offers, while freeze preserves them through manual combat", () => {
  let state = createGame(202);
  humanPlayer(state).gold = 5;
  const originalOfferIds = humanPlayer(state).shop.map(
    (minion) => minion.instanceId,
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const refreshed = humanPlayer(state);
  assert.equal(refreshed.gold, 4);
  assert.equal(refreshed.shop.length, 3);
  assert.equal(refreshed.frozen, false);
  assert.ok(
    refreshed.shop.every(
      (minion) => !originalOfferIds.includes(minion.instanceId),
    ),
  );

  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  const frozenOfferIds = humanPlayer(state).shop.map(
    (minion) => minion.instanceId,
  );
  assert.equal(humanPlayer(state).frozen, true);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  assert.equal(state.round, 1);

  const ignoredDuringCombat = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.strictEqual(
    ignoredDuringCombat,
    state,
    "recruit actions must be blocked until combat is continued",
  );

  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  assert.equal(state.round, 2);
  assert.equal(humanPlayer(state).gold, 4);
  assert.equal(humanPlayer(state).frozen, false);
  assert.deepEqual(
    humanPlayer(state).shop.map((minion) => minion.instanceId),
    frozenOfferIds,
  );
});

test("tavern upgrades enforce cost and expand the shop", () => {
  let state = createGame(303);
  assert.equal(getUpgradeCost(state, state.humanPlayerId), 5);

  humanPlayer(state).gold = 4;
  const insufficientSnapshot = jsonClone(state);
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.deepEqual(state, insufficientSnapshot);

  humanPlayer(state).gold = 5;
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.equal(humanPlayer(state).tavernTier, 2);
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).shop.length, 4);
  assert.equal(getUpgradeCost(state, state.humanPlayerId), 7);
});

test("three normal copies combine atomically into one buff-preserving golden", () => {
  let state = createGame(404);
  const human = humanPlayer(state);
  const template = human.shop[0];
  const bonusAttack = [1, 2, 0];
  const bonusHealth = [0, 1, 3];

  human.gold = 9;
  human.board = [];
  human.hand = [];
  human.shop = bonusAttack.map((attackBonus, index) => ({
    ...template,
    instanceId: `triple-fixture-${index}`,
    attack: template.attack + attackBonus,
    health: template.health + bonusHealth[index],
    poolCopies: 1,
  }));
  state.nextInstanceId = 10_000;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });

  const golden = humanPlayer(state).hand[0];
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).shop.length, 0);
  assert.equal(humanPlayer(state).hand.length, 1);
  assert.equal(golden.definitionId, template.definitionId);
  assert.equal(golden.golden, true);
  assert.equal(golden.poolCopies, 3);
  assert.equal(
    golden.attack,
    template.attack * 2 + bonusAttack.reduce((sum, value) => sum + value, 0),
  );
  assert.equal(
    golden.health,
    template.health * 2 + bonusHealth.reduce((sum, value) => sum + value, 0),
  );

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const poolBeforeSellingGolden = state.pool[golden.definitionId];
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.equal(state.pool[golden.definitionId], poolBeforeSellingGolden + 3);
});

test("END_TURN runs seven AI turns and one complete deterministic combat round", () => {
  let state = createGame(505);
  state = applyActions(state, [
    { type: "BUY_MINION", shopIndex: 0 },
    { type: "PLAY_MINION", handIndex: 0 },
  ]);
  const permanentHumanBoard = jsonClone(humanPlayer(state).board);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.equal(combat.round, 1);
  assert.equal(combat.lastRoundBattles.length, 4);
  assert.ok(combat.lastBattle);
  assert.deepEqual(humanPlayer(combat).board, permanentHumanBoard);

  const participants = combat.lastRoundBattles
    .flatMap((battle) => [battle.playerAId, battle.playerBId])
    .sort();
  assert.deepEqual(
    participants,
    combat.players.map((player) => player.id).sort(),
  );

  for (const battle of combat.lastRoundBattles) {
    assert.equal(battle.isGhost, false);
    assert.equal(battle.events[0]?.type, "battleStart");
    assert.equal(battle.events.at(-1)?.type, "battleEnd");
    assert.deepEqual(
      battle.events.map((event) => event.index),
      battle.events.map((_, index) => index),
    );
    assert.ok(battle.damageToPlayerA >= 0);
    assert.ok(battle.damageToPlayerB >= 0);
    assert.ok(battle.finalBoards[battle.playerAId].length <= 7);
    assert.ok(battle.finalBoards[battle.playerBId].length <= 7);

    const playerA = combat.players.find(
      (player) => player.id === battle.playerAId,
    );
    const playerB = combat.players.find(
      (player) => player.id === battle.playerBId,
    );
    assert.equal(playerA?.health, battle.playerAHealthAfter);
    assert.equal(playerB?.health, battle.playerBHealthAfter);
  }

  const nextRecruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(nextRecruit.phase, "recruit");
  assert.equal(nextRecruit.round, 2);
  assert.equal(nextRecruit.lastBattle, null);
  assert.equal(nextRecruit.lastRoundBattles.length, 0);
});

test("the same seed and manual action sequence reproduce AI and battle state", () => {
  const actions: readonly GameAction[] = [
    { type: "BUY_MINION", shopIndex: 1 },
    { type: "PLAY_MINION", handIndex: 0 },
    { type: "TOGGLE_FREEZE" },
    { type: "END_TURN" },
    { type: "CONTINUE" },
    { type: "REFRESH_SHOP" },
    { type: "END_TURN" },
  ];

  const first = applyActions(createGame(606), actions);
  const replay = applyActions(createGame(606), actions);

  assert.deepEqual(replay, first);
  assert.equal(JSON.stringify(replay), JSON.stringify(first));
  assert.equal(first.phase, "combat");
  assert.equal(first.round, 2);
});

test("combat damage eliminates players and CONTINUE ends a dead human's game", () => {
  const state = createGame(707);
  const template = humanPlayer(state).shop[0];

  state.players.forEach((player, index) => {
    const power = 100 + index * 10;
    player.health = 1;
    player.tavernTier = 6;
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.board = [
      fixtureMinion(template, `elimination-fixture-${index}`, {
        name: `决胜单位 ${index}`,
        attack: power,
        health: power,
        tier: 1,
      }),
    ];
  });

  const combat = gameReducer(state, { type: "END_TURN" });
  const alive = combat.players.filter((player) => player.alive);
  const eliminated = combat.players.filter((player) => !player.alive);

  assert.equal(combat.lastRoundBattles.length, 4);
  assert.equal(alive.length, 4);
  assert.equal(eliminated.length, 4);
  assert.equal(humanPlayer(combat).alive, false);
  assert.ok(
    eliminated.every(
      (player) => player.health <= 0 && player.eliminatedRound === 1,
    ),
  );
  assert.ok(eliminated.every((player) => player.placement === 5));
  assert.ok(combat.players.every((player) => player.board.length <= 7));

  const gameOver = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(gameOver.phase, "gameOver");
  assert.equal(gameOver.round, 1);
});
