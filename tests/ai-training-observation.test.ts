import assert from "node:assert/strict";
import test from "node:test";
import {
  createAiTrainingObservation,
  type AiTrainingObservation,
} from "../lib/game/ai-training.ts";
import { createGame, gameReducer } from "../lib/game/engine.ts";
import type {
  BoardMinionInstance,
  GameState,
  PlayerState,
} from "../lib/game/types.ts";

const FORBIDDEN_OBSERVATION_KEYS = new Set([
  "seed",
  "rngState",
  "nextInstanceId",
  "nextInteractionId",
  "pool",
  "spellPool",
  "instanceId",
  "sourceInstanceId",
  "targetInstanceId",
  "interactionId",
  "playerId",
  "opponentId",
  "lastOpponentId",
  "lastBattle",
  "lastRoundBattles",
  "events",
  "initialBoards",
  "finalBoards",
  "poolCopies",
  "poolCopiesByDefinitionId",
  "poolCopiesOnPurchase",
]);

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player;
}

function seatById(state: GameState, playerId: string): number {
  const seat = state.players.findIndex((player) => player.id === playerId);
  assert.notEqual(seat, -1);
  return seat;
}

function fixtureMinion(
  template: BoardMinionInstance,
  instanceId: string,
  name: string,
): BoardMinionInstance {
  return {
    ...structuredClone(template),
    instanceId,
    name,
    poolCopies: 97,
    poolCopiesByDefinitionId: { POOL_DEFINITION_SECRET: 3 },
    poolCopiesOnPurchase: 89,
    attachments: [
      {
        sourceInstanceId: `${instanceId}-attachment-secret`,
        definitionId: template.definitionId,
        cardId: template.cardId,
        name: `${name}_ATTACHMENT_ALLOWED`,
        description: template.description,
        effectSupport: template.effectSupport,
        golden: false,
        poolCopies: 83,
        attackGranted: 2,
        healthGranted: 3,
        attachments: [],
      },
    ],
  };
}

function assertNoForbiddenKeys(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }
  for (const [key, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    assert.equal(
      FORBIDDEN_OBSERVATION_KEYS.has(key),
      false,
      `privacy boundary emitted forbidden key ${key}`,
    );
    assertNoForbiddenKeys(child);
  }
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value as Record<string, unknown>).forEach(assertDeepFrozen);
}

function firstAvailableMinion(state: GameState): BoardMinionInstance {
  for (const player of state.players) {
    const minion = player.board[0] ?? player.shop[0];
    if (minion) return minion;
  }
  throw new Error("fixture requires at least one minion");
}

test("training observation is an immutable JSON privacy boundary", () => {
  let state = gameReducer(createGame(0x7a01), { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  const controlledSeat = state.players.findIndex((player) => player.isHuman);
  assert.notEqual(controlledSeat, -1);
  const controlled = state.players[controlledSeat];
  const template = firstAvailableMinion(state);
  const report = Object.values(state.humanScoutingReports)[0];
  assert.ok(report);

  report.board = [
    fixtureMinion(
      template,
      "SCOUT_INSTANCE_SECRET",
      "LEGAL_HISTORY_ALLOWED",
    ),
  ];
  controlled.board = [
    fixtureMinion(
      template,
      "OWN_BOARD_INSTANCE_SECRET",
      "OWN_BOARD_ALLOWED",
    ),
  ];
  controlled.board[0].venomous = true;
  controlled.board[0].temporaryVenomous = true;
  controlled.hand = [
    fixtureMinion(
      template,
      "OWN_HAND_INSTANCE_SECRET",
      "OWN_HAND_ALLOWED",
    ),
  ];
  controlled.shop = [
    fixtureMinion(
      template,
      "OWN_SHOP_INSTANCE_SECRET",
      "OWN_SHOP_ALLOWED",
    ),
  ];
  controlled.pendingSpellcraft = [
    {
      sourceInstanceId: controlled.board[0].instanceId,
      definitionId: "allowed-spellcraft-definition",
      golden: false,
      round: state.round,
      rewardTier: 5,
    },
  ];
  controlled.pendingCardPlayed = {
    sourceInstanceId: controlled.board[0].instanceId,
    cardKind: "minion",
    tier: controlled.board[0].tier,
    tribe: controlled.board[0].tribe,
    tribes: [...controlled.board[0].tribes],
  };
  const hiddenOpponent = state.players.find(
    (player) =>
      player.id !== controlled.id && player.id !== report.opponentId,
  );
  assert.ok(hiddenOpponent);
  hiddenOpponent.board = [
    fixtureMinion(
      template,
      "OPPONENT_BOARD_INSTANCE_SECRET",
      "OPPONENT_LIVE_BOARD_SECRET",
    ),
  ];
  hiddenOpponent.hand = [
    fixtureMinion(
      template,
      "OPPONENT_HAND_INSTANCE_SECRET",
      "OPPONENT_LIVE_HAND_SECRET",
    ),
  ];
  hiddenOpponent.shop = [
    fixtureMinion(
      template,
      "OPPONENT_SHOP_INSTANCE_SECRET",
      "OPPONENT_LIVE_SHOP_SECRET",
    ),
  ];
  controlled.lastOpponentId = hiddenOpponent.id;
  controlled.heroPowerActiveThisTurn = true;
  controlled.secretIds = ["secret-splitting-image"];
  controlled.systemEventCounters = { savedGold: 5 };
  state.seed = 0x5eed5eed;
  state.rngState = 0x12345678;
  state.pool.POOL_SECRET_CANARY = 123456;
  state.spellPool.SPELL_POOL_SECRET_CANARY = 654321;
  const rawBattle = state.lastRoundBattles[0];
  assert.ok(rawBattle);
  rawBattle.events.push({
    index: rawBattle.events.length,
    type: "battleStart",
    message: "RAW_BATTLE_EVENT_SECRET",
  });
  rawBattle.finalBoards[rawBattle.playerAId] = [
    fixtureMinion(
      template,
      "RAW_FINAL_BOARD_INSTANCE_SECRET",
      "RAW_FINAL_BOARD_SECRET",
    ),
  ];
  state.pendingInteraction = {
    kind: "target",
    interactionId: "INTERACTION_ID_SECRET",
    playerId: controlled.id,
    sourceInstanceId: controlled.board[0].instanceId,
    optionInstanceIds: [
      controlled.board[0].instanceId,
      controlled.shop[0].instanceId,
    ],
    attack: 4,
    health: 5,
    repetitions: 1,
    resolution: { kind: "buff" },
  };

  const stateBefore = JSON.stringify(state);
  const observation = createAiTrainingObservation(state, controlledSeat);
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(observation.schemaVersion, 3);
  assert.equal(observation.controlledSeat, controlledSeat);
  assert.equal(observation.own.board[0]?.name, "OWN_BOARD_ALLOWED");
  assert.equal(observation.own.board[0]?.venomous, true);
  assert.equal(observation.own.board[0]?.temporaryVenomous, true);
  assert.equal(observation.own.hand[0]?.name, "OWN_HAND_ALLOWED");
  assert.equal(observation.own.shop[0]?.name, "OWN_SHOP_ALLOWED");
  assert.equal(observation.own.heroPowerActiveThisTurn, true);
  assert.deepEqual(observation.own.secretIds, ["secret-splitting-image"]);
  assert.deepEqual(observation.own.systemEventCounters, { savedGold: 5 });
  assert.equal(observation.own.pendingSpellcraft[0]?.rewardTier, 5);
  assert.deepEqual(observation.own.pendingInteraction?.source, {
    zone: "board",
    index: 0,
  });
  assert.deepEqual(
    observation.own.pendingInteraction?.optionReferences,
    [
      { zone: "board", index: 0 },
      { zone: "shop", index: 0 },
    ],
  );
  assert.equal(
    observation.scoutingReports[0]?.board[0]?.name,
    "LEGAL_HISTORY_ALLOWED",
  );
  assert.equal(
    observation.own.lastOpponentSeat,
    seatById(state, hiddenOpponent.id),
  );

  assertNoForbiddenKeys(observation);
  assertDeepFrozen(observation);
  const serialized = JSON.stringify(observation);
  assert.deepEqual(JSON.parse(serialized), observation);
  for (const secret of [
    "SCOUT_INSTANCE_SECRET",
    "OWN_BOARD_INSTANCE_SECRET",
    "OWN_HAND_INSTANCE_SECRET",
    "OWN_SHOP_INSTANCE_SECRET",
    "OPPONENT_LIVE_BOARD_SECRET",
    "OPPONENT_LIVE_HAND_SECRET",
    "OPPONENT_LIVE_SHOP_SECRET",
    "POOL_SECRET_CANARY",
    "SPELL_POOL_SECRET_CANARY",
    "RAW_BATTLE_EVENT_SECRET",
    "RAW_FINAL_BOARD_SECRET",
    "INTERACTION_ID_SECRET",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.equal(serialized.includes("LEGAL_HISTORY_ALLOWED"), true);
  assert.equal(serialized.includes("OWN_BOARD_ALLOWED"), true);

  const observedGold = observation.own.gold;
  controlled.gold += 100;
  assert.equal(observation.own.gold, observedGold);
  assert.throws(() => {
    (
      observation.own.board as unknown as Array<
        AiTrainingObservation["own"]["board"][number]
      >
    ).pop();
  }, TypeError);
});

test("discover filter observation preserves pool and Magnetic constraints", () => {
  const state = createGame(0x7a04);
  const controlledSeat = state.players.findIndex((player) => player.isHuman);
  assert.notEqual(controlledSeat, -1);
  const controlled = state.players[controlledSeat];
  const option = structuredClone(firstAvailableMinion(state));
  state.pendingInteraction = {
    kind: "discover",
    interactionId: "discover-filter-observation",
    playerId: controlled.id,
    sourceInstanceId: option.instanceId,
    options: [option],
    filter: {
      exactTier: 7,
      maximumTier: 7,
      tribe: "mech",
      magnetic: true,
      ability: "battlecry",
      requiresMinionType: true,
      usesSharedPool: true,
    },
    remainingDiscoveries: 1,
    destination: { kind: "hand" },
  };

  const observation = createAiTrainingObservation(state, controlledSeat);
  assert.deepEqual(observation.own.pendingInteraction?.filter, {
    exactTier: 7,
    maximumTier: 7,
    tribe: "mech",
    magnetic: true,
    ability: "battlecry",
    requiresMinionType: true,
    usesSharedPool: true,
  });

  state.pendingInteraction.filter = {};
  const defaultObservation = createAiTrainingObservation(state, controlledSeat);
  assert.deepEqual(defaultObservation.own.pendingInteraction?.filter, {
    exactTier: null,
    maximumTier: null,
    tribe: null,
    magnetic: false,
    ability: null,
    requiresMinionType: false,
    usesSharedPool: false,
  });
});

test("AI seat receives only its personally observed previous opponent", () => {
  const state = gameReducer(createGame(0x7a02), { type: "END_TURN" });
  const selectedBattle = state.lastRoundBattles.find(
    (battle) => !playerById(state, battle.playerAId).isHuman,
  );
  assert.ok(selectedBattle);
  const observer = playerById(state, selectedBattle.playerAId);
  const opponent = playerById(state, selectedBattle.playerBId);
  const observerSeat = seatById(state, observer.id);
  const template = firstAvailableMinion(state);
  selectedBattle.initialBoards[opponent.id] = [
    fixtureMinion(
      template,
      "AI_SCOUT_INSTANCE_SECRET",
      "LEGAL_AI_SCOUT_ALLOWED",
    ),
  ];
  opponent.board = [
    fixtureMinion(
      template,
      "AI_OPPONENT_CURRENT_INSTANCE_SECRET",
      "AI_OPPONENT_CURRENT_BOARD_SECRET",
    ),
  ];
  const unrelatedBattle = state.lastRoundBattles.find(
    (battle) => battle !== selectedBattle,
  );
  assert.ok(unrelatedBattle);
  unrelatedBattle.initialBoards[unrelatedBattle.playerAId] = [
    fixtureMinion(
      template,
      "UNRELATED_SCOUT_INSTANCE_SECRET",
      "UNRELATED_SCOUT_SECRET",
    ),
  ];

  const observation = createAiTrainingObservation(state, observerSeat);
  assert.equal(observation.scoutingReports.length, 1);
  assert.equal(
    observation.scoutingReports[0]?.opponentSeat,
    seatById(state, opponent.id),
  );
  assert.equal(
    observation.scoutingReports[0]?.board[0]?.name,
    "LEGAL_AI_SCOUT_ALLOWED",
  );
  const serialized = JSON.stringify(observation);
  assert.equal(serialized.includes("AI_SCOUT_INSTANCE_SECRET"), false);
  assert.equal(serialized.includes("AI_OPPONENT_CURRENT_BOARD_SECRET"), false);
  assert.equal(serialized.includes("UNRELATED_SCOUT_SECRET"), false);
  assertNoForbiddenKeys(observation);
});

test("controlled seat validation rejects invalid indices", () => {
  const state = createGame(0x7a03);
  assert.throws(() => createAiTrainingObservation(state, -1), RangeError);
  assert.throws(
    () => createAiTrainingObservation(state, state.players.length),
    RangeError,
  );
  assert.throws(() => createAiTrainingObservation(state, 1.5), RangeError);
});
