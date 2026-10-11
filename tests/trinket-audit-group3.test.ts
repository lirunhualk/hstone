import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getHeroPowerActivationQuote,
  heroPowerHasAvailableUse,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function trinketForCard(cardId: string) {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition);
  return definition;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const player = humanPlayer(state);
  const definition = trinketForCard(cardId);
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `audit-acquire-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `audit-offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: definition.id,
  });
}

function sousChefWithBlackthorn(): GameState {
  const state = createGame(0xa3c801);
  const player = humanPlayer(state);
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === "BG35_MagicItem_801",
  );
  assert.ok(trinket);
  state.pendingInteraction = null;
  player.heroPowerId = "hero-power-bg20_hero_103p";
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.gold = 10;
  player.goldSpentThisTurn = 0;
  player.hand = [];
  player.board = [];
  return state;
}

test("Sous Chef Sticker refunds one Gold after each successful hero-power use", () => {
  let state = sousChefWithBlackthorn();
  for (let use = 0; use < 3; use += 1) {
    const before = humanPlayer(state).gold;
    state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
    assert.equal(humanPlayer(state).hand.length, (use + 1) * 2);
    assert.equal(humanPlayer(state).gold, before);
  }
});

test("Sous Chef Sticker adds one activation to a hero with two native uses", () => {
  let state = sousChefWithBlackthorn();
  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  let player = humanPlayer(state);
  assert.equal(heroPowerHasAvailableUse(state, player.id), true);
  assert.equal(getHeroPowerActivationQuote(state, player.id)?.usable, true);
  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 6);
  assert.equal(heroPowerHasAvailableUse(state, player.id), false);
  assert.equal(getHeroPowerActivationQuote(state, player.id)?.usable, false);
  const rejected = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  assert.deepEqual(rejected, state);
});

test("Sous Chef Sticker extra-use progress survives a JSON save round trip", () => {
  let state = sousChefWithBlackthorn();
  humanPlayer(state).heroId = "hero-bg20-103";
  assert.ok(normalizePersistedGameState(JSON.parse(JSON.stringify(state))));
  for (let use = 0; use < 3; use += 1) {
    state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  }
  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(restored);
  assert.equal(
    getHeroPowerActivationQuote(restored, restored.humanPlayerId)?.usable,
    false,
  );
});

for (const [cardId, choiceKind] of [
  ["BG30_MagicItem_420", "tavernSpellDiscover"],
  ["BG30_MagicItem_707", "darkmoonPrizeDiscover"],
] as const) {
  test(`Sinstone Sticker copies a ${choiceKind} pick`, () => {
    let state = createGame(0xa38010 + cardId.length);
    const player = humanPlayer(state);
    const sinstone = trinketForCard("BG30_MagicItem_801");
    player.trinketIds = [sinstone.id];
    player.trinketCounters = { [sinstone.id]: 0 };
    player.hand = [];
    state.pendingInteraction = null;
    state = acquireTrinket(state, cardId);
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === choiceKind);
    const selected = pending.options[0];
    assert.ok(selected);
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: selected.instanceId,
    });
    const copies = humanPlayer(state).hand.filter(
      (card) => card.definitionId === selected.definitionId,
    );
    assert.equal(copies.length, 2);
    assert.equal(new Set(copies.map((card) => card.instanceId)).size, 2);
  });
}

test("Sinstone Sticker copies the discovered Golden card with its hand lock", () => {
  let state = createGame(0xa38011);
  const player = humanPlayer(state);
  const sinstone = trinketForCard("BG30_MagicItem_801");
  // Souvenir Stand can occupy the Lesser slot with a Greater Trinket alias.
  const sinstoneId = `souvenir-copy:${sinstone.id}`;
  player.trinketIds = [sinstoneId];
  player.trinketCounters = { [sinstoneId]: 0 };
  player.hand = [];
  state.pendingInteraction = null;
  state = acquireTrinket(state, "BG35_MagicItem_821t");
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  const selected = pending.options[0];
  assert.ok(selected);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  const copies = humanPlayer(state).hand.filter(
    (card) => card.kind === "minion" && card.definitionId === selected.definitionId,
  );
  assert.equal(copies.length, 2);
  assert.ok(copies.every((card) => card.kind === "minion" && card.golden));
  assert.ok(copies.every(
    (card) => card.kind === "minion" && card.playableFromRound === state.round + 2,
  ));
});

test("Beatboxer Portrait grants the printed complete minion without a shared-pool reservation", () => {
  let state = createGame(0xa3741);
  const player = humanPlayer(state);
  player.heroPowerId = null;
  player.hand = [];
  state.pendingInteraction = null;
  const beforePool = structuredClone(state.pool);
  state = acquireTrinket(state, "BG35_MagicItem_741");
  const minion = humanPlayer(state).hand.find(
    (card) => card.kind === "minion" && card.definitionId === "BG26_149",
  );
  assert.ok(minion?.kind === "minion");
  const definition = getMinionDefinition("BG26_149");
  assert.equal(minion.attack, definition.attack);
  assert.equal(minion.health, definition.health);
  assert.equal(minion.golden, false);
  assert.equal(definition.effectSupport, "complete");
  assert.equal(minion.poolCopies, 0);
  assert.deepEqual(state.pool, beforePool);
});

test("Groundbreaker Portrait grants its minion and shares its Naga-play stats with the left neighbor", () => {
  let state = createGame(0xa3924);
  const player = humanPlayer(state);
  player.heroPowerId = null;
  player.hand = [];
  player.board = [];
  state.pendingInteraction = null;
  state = acquireTrinket(state, "BG35_MagicItem_924");
  const acquiredPlayer = humanPlayer(state);
  const groundbreaker = acquiredPlayer.hand.find(
    (card) => card.kind === "minion" && card.definitionId === "BG31_035",
  );
  assert.ok(groundbreaker?.kind === "minion");
  const left = structuredClone(acquiredPlayer.shop[0]);
  assert.ok(left);
  left.instanceId = "portrait-left-neighbor";
  left.attack = 10;
  left.health = 10;
  acquiredPlayer.board = [left];
  acquiredPlayer.playerSpellsCast = 8;
  const before = { attack: groundbreaker.attack, health: groundbreaker.health };
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0, boardIndex: 1 });
  const after = humanPlayer(state);
  const played = after.board.find((card) => card.instanceId === groundbreaker.instanceId);
  const neighbor = after.board.find((card) => card.instanceId === left.instanceId);
  assert.ok(played);
  assert.ok(neighbor);
  assert.ok(played.attack > before.attack);
  assert.equal(neighbor.attack - 10, played.attack - before.attack);
  assert.equal(neighbor.health - 10, played.health - before.health);
});
