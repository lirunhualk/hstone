import assert from "node:assert/strict";
import test from "node:test";
import { createGame } from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import { refreshTimewarpDescription } from "../lib/game/timewarp.ts";
import { createAiTrainingObservation } from "../lib/game/ai-training.ts";
import type { GameState } from "../lib/game/types.ts";

test("v52 saves preserve counted inherited Deathrattles on ordinary minions", () => {
  const state = createGame(342031);
  const player = state.players[0];
  const target = structuredClone(player.shop[0]);
  target.instanceId = "inherited-frog-target";
  target.poolCopies = 0;
  target.learnedDeathrattles = [{ sourceInstanceId: "frog", definitionId: "BG34_Giant_031", golden: true, count: 3 }];
  player.board = [target];
  const saved = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState;
  assert.ok(saved);
  assert.deepEqual(saved.players[0].board[0].learnedDeathrattles, target.learnedDeathrattles);
  assert.equal(saved.players[0].board[0].attack, target.attack);
  assert.equal(saved.players[0].board[0].instanceId, target.instanceId);
  assert.equal(saved.players[0].board[0].poolCopies, 0);
});

test("inherited Deathrattle saves reject invalid counts and non-Deathrattle definitions", () => {
  const state = createGame(342032);
  const player = state.players[0];
  const target = structuredClone(player.shop[0]);
  target.instanceId = "inherited-invalid";
  target.poolCopies = 0;
  target.learnedDeathrattles = [
    { sourceInstanceId: "valid", definitionId: "BG34_Giant_031", golden: false },
    { sourceInstanceId: "negative", definitionId: "BG34_Giant_031", golden: false, count: -1 },
    { sourceInstanceId: "fraction", definitionId: "BG34_Giant_031", golden: false, count: 1.5 },
    { sourceInstanceId: "unsafe", definitionId: "BG34_Giant_031", golden: false, count: Number.MAX_SAFE_INTEGER + 1 },
    { sourceInstanceId: "not-deathrattle", definitionId: "BG34_Giant_603", golden: false, count: 2 },
    { sourceInstanceId: "fabricated-unrelated-deathrattle", definitionId: "scallywag", golden: false, count: 2 },
  ];
  player.board = [target];
  const saved = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState;
  assert.ok(saved);
  assert.deepEqual(saved.players[0].board[0].learnedDeathrattles, target.learnedDeathrattles.slice(0, 1));
});

test("Timewarp growth and turn quotas refresh from persisted counters without compounding text", () => {
  for (const [id, expected] of [
    ["BG34_Giant_319", "+18/+12"], ["BG34_PreMadeChamp_004", "+24/+18"],
    ["BG34_Giant_088", "+30/+30"], ["BG34_Giant_313", "+42/+42"],
  ] as const) {
    const definition = getMinionDefinition(id);
    const card = { definitionId: id, golden: true, description: definition.goldenDescription ?? definition.description,
      effectCounters: { timewarpGrowth: 2 } };
    assert.equal(refreshTimewarpDescription(card, 8), true);
    assert.ok(card.description.includes(expected), card.description);
    const first = card.description;
    refreshTimewarpDescription(card, 8);
    assert.equal(card.description, first);
  }
  const definition = getMinionDefinition("BG34_Giant_332");
  const card = { definitionId: definition.id, golden: true, description: definition.goldenDescription ?? definition.description,
    effectCounters: { timewarpSummons: 801 } };
  refreshTimewarpDescription(card, 8);
  assert.ok(card.description.includes("还剩1个"));
  refreshTimewarpDescription(card, 9);
  assert.ok(card.description.includes("还剩2个"));
});

test("legacy saves default permanent Beast bonuses and reject malformed new counters", () => {
  const legacy = createGame(342033);
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(legacy))) as GameState;
  assert.ok(restored);
  assert.equal(Reflect.get(restored.players[0], "beastArmyAttackBonus"), 0);
  assert.equal(Reflect.get(restored.players[0], "beastArmyHealthBonus"), 0);
  Object.assign(legacy.players[0], { beastArmyAttackBonus: 8, beastArmyHealthBonus: 12 });
  const upgraded = normalizePersistedGameState(JSON.parse(JSON.stringify(legacy))) as GameState;
  assert.equal(Reflect.get(upgraded.players[0], "beastArmyAttackBonus"), 8);
  assert.equal(Reflect.get(upgraded.players[0], "beastArmyHealthBonus"), 12);
  for (const invalid of [-1, 1.5, "4", null]) {
    const corrupt = JSON.parse(JSON.stringify(legacy));
    corrupt.players[0].beastArmyAttackBonus = invalid;
    assert.equal(normalizePersistedGameState(corrupt), null);
  }
});

test("AI observations expose owned permanent Beast bonuses and inherited counts without hidden opponents", () => {
  const state = createGame(342034);
  const controlledSeat = state.players.findIndex((player) => player.isHuman);
  const player = state.players[controlledSeat];
  Object.assign(player, { beastArmyAttackBonus: 8, beastArmyHealthBonus: 12 });
  const target = structuredClone(player.shop[0]);
  target.learnedDeathrattles = [{ sourceInstanceId: "private-frog-runtime-id", definitionId: "BG34_Giant_031", golden: true, count: 7 }];
  player.board = [target];
  const opponent = state.players.find((candidate) => candidate.id !== player.id);
  assert.ok(opponent);
  Object.assign(opponent, { beastArmyAttackBonus: 999, beastArmyHealthBonus: 998 });
  const observation = createAiTrainingObservation(state, controlledSeat);
  assert.equal(observation.schemaVersion, 5);
  assert.equal(Reflect.get(observation.own, "beastArmyAttackBonus"), 8);
  assert.equal(Reflect.get(observation.own, "beastArmyHealthBonus"), 12);
  assert.equal(Reflect.get(observation.own.board[0].learnedDeathrattles[0], "count"), 7);
  const serialized = JSON.stringify(observation);
  assert.equal(serialized.includes("private-frog-runtime-id"), false);
  assert.equal(serialized.includes('"beastArmyAttackBonus":999'), false);
  assert.equal(serialized.includes('"beastArmyHealthBonus":998'), false);
});

test("save repair normalizes malformed Timewarp counters before rendering and resolution", () => {
  const keys = ["timewarpGrowth", "timewarpDiscountUses", "timewarpRefreshes", "timewarpTavernSpells",
    "timewarpSummons", "timewarpSpellCopies", "timewarpPermanentCopies"];
  for (const invalid of [-1, 1.5, "4", null, Number.MAX_SAFE_INTEGER + 1]) {
    const state = createGame(342035);
    const target = structuredClone(state.players[0].shop[0]);
    target.definitionId = "BG34_Giant_319";
    target.effectCounters = Object.fromEntries(keys.map((key) => [key, invalid])) as Record<string, number>;
    state.players[0].board = [target];
    const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState;
    assert.ok(restored);
    assert.deepEqual(restored.players[0].board[0].effectCounters, Object.fromEntries(keys.map((key) => [key, 0])));
    assert.ok(restored.players[0].board[0].description.includes("+3/+2"));
  }
});
