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

const SAFE_BADGE_CARD_ID = "BG35_MagicItem_820";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function safeBadge() {
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === SAFE_BADGE_CARD_ID,
  );
  assert.ok(trinket);
  return trinket;
}

function acquireSafeBadge(state: GameState): GameState {
  const player = humanPlayer(state);
  const trinket = safeBadge();
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "acquire-safe-badge",
    playerId: player.id,
    sourceInstanceId: "safe-badge-offer",
    trinketTier: trinket.tier,
    optionIds: [trinket.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "acquire-safe-badge",
    optionInstanceId: trinket.id,
  });
}

function combatMinion(
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

function prepareLethalCombat(state: GameState): void {
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);
  for (const player of state.players) {
    if (player.id === human.id || player.id === enemy.id) {
      player.alive = true;
      player.eliminatedRound = undefined;
      continue;
    }
    player.alive = false;
    player.health = 0;
  }
  const humanTemplate = human.shop[0];
  const enemyTemplate = enemy.shop[0];
  assert.ok(humanTemplate && enemyTemplate);
  human.health = 4;
  human.armor = 0;
  human.board = [combatMinion(humanTemplate, "safe-badge-small", 0, 1)];
  human.hand = [];
  enemy.health = 100;
  enemy.armor = 0;
  enemy.tavernTier = 6;
  enemy.board = [combatMinion(enemyTemplate, "safe-badge-wall", 50, 50)];
  enemy.hand = [];
}

function damageToHuman(state: GameState): number {
  const battle = state.lastBattle;
  assert.ok(battle);
  return battle.playerAId === state.humanPlayerId
    ? battle.damageToPlayerA
    : battle.damageToPlayerB;
}

test("Safe Badge grants five Gold and prevents exactly one lethal combat hit", () => {
  let state = createGame(0x8201);
  const trinket = safeBadge();
  const goldBefore = 100;
  state = acquireSafeBadge(state);
  let human = humanPlayer(state);
  assert.equal(human.gold, goldBefore - trinket.cost + 5);
  assert.equal(human.trinketCounters[trinket.id], 1);

  prepareLethalCombat(state);
  state = gameReducer(state, { type: "END_TURN" });
  human = humanPlayer(state);
  assert.equal(human.health, 4);
  assert.equal(human.armor, 0);
  assert.equal(human.trinketCounters[trinket.id], 0);
  assert.equal(damageToHuman(state), 0);
  assert.ok(
    state.lastBattle?.events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === trinket.id,
    ),
  );

  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  state = gameReducer(state, { type: "END_TURN" });
  assert.ok(humanPlayer(state).health <= 0);
  assert.ok(damageToHuman(state) > 0);
});

test("Safe Badge is not consumed by nonlethal combat damage", () => {
  let state = acquireSafeBadge(createGame(0x8202));
  const trinket = safeBadge();
  prepareLethalCombat(state);
  humanPlayer(state).health = 20;

  state = gameReducer(state, { type: "END_TURN" });
  assert.ok(humanPlayer(state).health > 0);
  assert.ok(humanPlayer(state).health < 20);
  assert.equal(humanPlayer(state).trinketCounters[trinket.id], 1);
  assert.ok(damageToHuman(state) > 0);
});
