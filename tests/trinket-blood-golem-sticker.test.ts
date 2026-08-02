import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const BLOOD_GOLEM_STICKER_CARD_ID = "BG30_MagicItem_442";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function minion(
  template: BoardMinionInstance,
  instanceId: string,
  attack: number,
  health: number,
): BoardMinionInstance {
  return {
    ...template,
    instanceId,
    attack,
    health,
    taunt: false,
    divineShield: false,
    reborn: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    cleave: false,
    temporaryAttack: 0,
    temporaryHealth: 0,
  };
}

test("Blood Golem Sticker summons stats equal to a dead Quilboar's Blood Gem bonuses", () => {
  let state = createGame(0x4421);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);
  for (const player of state.players) {
    if (player.id === human.id || player.id === enemy.id) {
      player.alive = true;
      continue;
    }
    player.alive = false;
    player.health = 0;
  }
  const humanTemplate = human.shop[0];
  const enemyTemplate = enemy.shop[0];
  assert.ok(humanTemplate && enemyTemplate);
  const quilboar = minion(humanTemplate, "blood-golem-quilboar", 0, 1);
  quilboar.tribe = "quilboar";
  quilboar.tribes = ["quilboar"];
  quilboar.bloodGemAttack = 4;
  quilboar.bloodGemHealth = 7;
  human.board = [quilboar];
  human.hand = [];
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === BLOOD_GOLEM_STICKER_CARD_ID,
  );
  assert.ok(trinket);
  human.trinketIds = [trinket.id];
  human.trinketCounters = { [trinket.id]: 0 };
  enemy.board = [minion(enemyTemplate, "blood-golem-enemy", 50, 50)];
  enemy.hand = [];

  state = gameReducer(state, { type: "END_TURN" });

  const summoned = state.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "BG30_MagicItem_442t",
  );
  assert.ok(summoned?.minion);
  assert.equal(summoned.minion.attack, 4);
  assert.equal(summoned.minion.health, 7);
  assert.deepEqual(summoned.minion.tribes, []);
});
