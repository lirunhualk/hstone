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

const FLYING_GOLEM_PORTRAIT_CARD_ID = "BG35_MagicItem_740";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function portrait() {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === FLYING_GOLEM_PORTRAIT_CARD_ID,
  );
  assert.ok(definition);
  return definition;
}

function combatMinion(
  template: BoardMinionInstance,
  instanceId: string,
  attack: number,
  health: number,
  taunt = false,
): BoardMinionInstance {
  return {
    ...template,
    instanceId,
    attack,
    health,
    taunt,
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

test("Falling Flying Golem Portrait grants its related minion on acquire", () => {
  let state = createGame(0x7401);
  const player = humanPlayer(state);
  const trinket = portrait();
  player.gold = 100;
  player.hand = [];
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "choose-flying-golem-portrait",
    playerId: player.id,
    sourceInstanceId: "flying-golem-offer",
    trinketTier: trinket.tier,
    optionIds: [trinket.id],
  };

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "choose-flying-golem-portrait",
    optionInstanceId: trinket.id,
  });

  assert.equal(humanPlayer(state).hand.length, 1);
  assert.equal(humanPlayer(state).hand[0]?.kind, "minion");
  assert.equal(humanPlayer(state).hand[0]?.definitionId, "BG35_342");
});

test("its combat Deathrattle permanently gives surviving friendly minions +2/+2", () => {
  let state = createGame(0x7402);
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
  const fragile = combatMinion(humanTemplate, "flying-golem-fragile", 0, 1, true);
  const survivor = combatMinion(humanTemplate, "flying-golem-survivor", 0, 52);
  human.board = [fragile, survivor];
  human.hand = [];
  human.trinketIds = [portrait().id];
  human.trinketCounters = { [portrait().id]: 0 };
  enemy.board = [combatMinion(enemyTemplate, "flying-golem-enemy", 50, 50)];
  enemy.hand = [];

  state = gameReducer(state, { type: "END_TURN" });

  const persistentSurvivor = humanPlayer(state).board.find(
    (minion) => minion.instanceId === survivor.instanceId,
  );
  assert.ok(persistentSurvivor);
  assert.equal(persistentSurvivor.attack, survivor.attack + 2);
  assert.equal(persistentSurvivor.health, survivor.health + 2);
  assert.ok(
    state.lastBattle?.events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === fragile.instanceId &&
        event.message.includes("永久获得+2/+2"),
    ),
  );
});
