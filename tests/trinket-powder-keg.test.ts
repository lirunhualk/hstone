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

test("Powder Keg summons a source-Attack Sky Pirate that attacks immediately", () => {
  let state = createGame(0x7141);
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
  const pirate = minion(humanTemplate, "powder-keg-pirate", 4, 1);
  pirate.tribe = "pirate";
  pirate.tribes = ["pirate"];
  human.board = [pirate];
  human.hand = [];
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === "BG35_MagicItem_714",
  );
  assert.ok(trinket);
  human.trinketIds = [trinket.id];
  human.trinketCounters = { [trinket.id]: 0 };
  enemy.board = [minion(enemyTemplate, "powder-keg-enemy", 50, 50)];
  enemy.hand = [];

  state = gameReducer(state, { type: "END_TURN" });

  const summoned = state.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "sky-pirate-token",
  );
  assert.ok(summoned?.minion);
  assert.equal(summoned.minion.attack, 5);
  assert.ok(
    state.lastBattle?.events.some(
      (event) =>
        event.type === "attack" &&
        event.actorInstanceId === summoned.minion?.instanceId &&
        event.message.includes("立即攻击"),
    ),
  );
});
