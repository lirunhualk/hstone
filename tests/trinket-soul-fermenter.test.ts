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

test("Soul Fermenter destroys the leftmost three and resummons them after the last friendly dies", () => {
  let state = createGame(0x7321);
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
  human.board = [
    minion(humanTemplate, "fermenter-left-1", 1, 1),
    minion(humanTemplate, "fermenter-left-2", 2, 2),
    minion(humanTemplate, "fermenter-left-3", 3, 3),
    minion(humanTemplate, "fermenter-last", 0, 1),
  ];
  human.hand = [];
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === "BG35_MagicItem_732",
  );
  assert.ok(trinket);
  human.trinketIds = [trinket.id];
  human.trinketCounters = { [trinket.id]: 0 };
  enemy.board = [minion(enemyTemplate, "fermenter-enemy", 100, 100)];
  enemy.hand = [];

  state = gameReducer(state, { type: "END_TURN" });

  const events = state.lastBattle?.events ?? [];
  const precombatDeaths = events.filter(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId?.startsWith("fermenter-left-"),
  );
  assert.equal(precombatDeaths.length, 3);
  const returns = events.filter(
    (event) =>
      event.type === "summon" &&
      event.message.includes("重新召唤"),
  );
  assert.equal(returns.length, 3);
  assert.ok(
    events.findIndex(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === "fermenter-last",
    ) < events.indexOf(returns[0]),
  );
  assert.deepEqual(
    returns.map((event) => event.minion?.attack),
    [1, 2, 3],
  );
});
