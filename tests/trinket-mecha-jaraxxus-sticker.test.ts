import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const MECHA_JARAXXUS_STICKER_CARD_ID = "BG30_MagicItem_942";
const MECHA_JARAXXUS_DEFINITION_IDS = new Set([
  "BG25_807t",
  "BG25_807t2",
  "BG25_807t3",
  "BG25_807t4",
]);

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function acquireSticker(state: GameState): GameState {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === MECHA_JARAXXUS_STICKER_CARD_ID,
  );
  assert.ok(definition);
  const player = humanPlayer(state);
  player.gold = 100;
  player.hand = [];
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "choose-mecha-jaraxxus-sticker",
    playerId: player.id,
    sourceInstanceId: "mecha-jaraxxus-sticker-offer",
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "choose-mecha-jaraxxus-sticker",
    optionInstanceId: definition.id,
  });
}

function mechaJaraxxusCards(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      MECHA_JARAXXUS_DEFINITION_IDS.has(card.definitionId),
  );
}

function assertMechaJaraxxusCards(cards: BoardMinionInstance[]): void {
  assert.equal(cards.length, 2);
  for (const card of cards) {
    const definition = getMinionDefinition(card.definitionId);
    assert.deepEqual(definition.tribes, ["mech", "demon"]);
    assert.deepEqual(definition.magnetic?.targetTribes, ["mech", "demon"]);
    assert.equal(definition.collectible, false);
  }
}

test("Mecha-Jaraxxus Sticker grants two random Magnetic Mecha-Demons immediately", () => {
  const state = acquireSticker(createGame(0x9421));
  assertMechaJaraxxusCards(mechaJaraxxusCards(humanPlayer(state)));
});

test("Mecha-Jaraxxus Sticker grants two more cards at every turn start", () => {
  let state = acquireSticker(createGame(0x9422));
  state.lobbySystemsEnabled = false;
  humanPlayer(state).hand = [];

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");

  assertMechaJaraxxusCards(mechaJaraxxusCards(humanPlayer(state)));
});
