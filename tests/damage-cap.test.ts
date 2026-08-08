import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getScheduledOpponent,
  getSoloCombatDamageCap,
  type BattleEvent,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

interface DamageScenario {
  battle: BattleSummary;
  combat: GameState;
  damageEvent: BattleEvent;
  human: PlayerState;
}

function humanPlayer(state: GameState): PlayerState {
  const human = state.players.find(
    (player) => player.id === state.humanPlayerId,
  );
  assert.ok(human, "the human player must exist");
  return human;
}

function damageFixture(
  round: number,
  alivePlayerCount = 8,
  armor = 0,
  health = 100,
  hasIceBlock = false,
): DamageScenario {
  const state = createGame(
    0xdc00 + round + alivePlayerCount + armor + health,
    health,
  );
  const human = humanPlayer(state);
  const template = human.shop[0];
  assert.ok(template, "the initial shop must provide a minion template");

  state.round = round;
  state.lobbySystemsEnabled = false;
  state.systemEventId = null;
  state.pendingInteraction = null;
  for (const [index, player] of state.players.entries()) {
    // Keep this combat-only fixture deterministic by skipping all AI Recruit turns.
    player.isHuman = true;
    player.alive = index < alivePlayerCount;
    player.health = player.alive ? health : 0;
    player.armor = 0;
    player.tavernTier = 6;
    player.gold = 0;
    player.heroId = null;
    player.heroPowerId = null;
    player.secretIds = [];
    player.trinketIds = [];
    player.hand = [];
    player.shop = [];
    player.board = [];
    player.frozen = false;
    player.pendingSpellcraft = [];
    player.pendingSystemSpellIds = [];
  }
  human.armor = armor;
  human.secretIds = hasIceBlock
    ? ["hero-secret-tb_bacon_secrets_12"]
    : [];

  const scheduled = getScheduledOpponent(state, human.id);
  assert.ok(scheduled, "the human player must have a scheduled opponent");
  assert.equal(scheduled.isGhost, false);
  const opponent = state.players.find(
    (player) => player.id === scheduled.opponentId,
  );
  assert.ok(opponent, "the scheduled opponent must exist");
  opponent.board = Array.from({ length: 7 }, (_, index) => ({
    ...template,
    instanceId: `damage-cap-wall-${index}`,
    attack: 100,
    health: 100,
    tier: 6,
    golden: false,
    taunt: false,
    divineShield: false,
    reborn: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    cleave: false,
    poolCopies: 0,
  })) as BoardMinionInstance[];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const battle = combat.lastBattle;
  assert.ok(battle, "the human combat summary must exist");
  const damageEvent = battle.events.find(
    (event) =>
      event.type === "heroDamage" && event.targetPlayerId === human.id,
  );
  assert.ok(damageEvent, "the losing human must receive hero damage");

  return {
    battle,
    combat,
    damageEvent,
    human: humanPlayer(combat),
  };
}

test("solo combat damage cap follows the official 5/10/15 and Top 4 schedule", () => {
  assert.equal(getSoloCombatDamageCap(1, 8), 5);
  assert.equal(getSoloCombatDamageCap(3, 5), 5);
  assert.equal(getSoloCombatDamageCap(4, 8), 10);
  assert.equal(getSoloCombatDamageCap(7, 5), 10);
  assert.equal(getSoloCombatDamageCap(8, 8), 15);
  assert.equal(getSoloCombatDamageCap(20, 5), 15);
  assert.equal(getSoloCombatDamageCap(1, 4), null);
  assert.equal(getSoloCombatDamageCap(20, 1), null);
});

for (const { round, cap } of [
  { round: 1, cap: 5 },
  { round: 4, cap: 10 },
  { round: 8, cap: 15 },
] as const) {
  test(`round ${round} caps a 48-damage loss at ${cap}`, () => {
    const { battle, damageEvent, human } = damageFixture(round);

    assert.equal(battle.alivePlayersAtCombatStart, 8);
    assert.equal(battle.damageCap, cap);
    assert.equal(damageEvent.uncappedAmount, 48);
    assert.equal(damageEvent.damageCap, cap);
    assert.equal(damageEvent.damagePreventedByCap, 48 - cap);
    assert.equal(damageEvent.amount, cap);
    assert.equal(damageEvent.healthDamage, cap);
    assert.equal(human.health, 100 - cap);
    assert.match(damageEvent.message, new RegExp(`伤害上限 ${cap}`));
  });
}

test("the cap is applied before Armor absorbs post-combat damage", () => {
  const { damageEvent, human } = damageFixture(1, 8, 3);

  assert.equal(damageEvent.uncappedAmount, 48);
  assert.equal(damageEvent.amount, 5);
  assert.equal(damageEvent.armorAbsorbed, 3);
  assert.equal(damageEvent.healthDamage, 2);
  assert.equal(human.armor, 0);
  assert.equal(human.health, 98);
});

test("entering Top 4 removes the cap and preserves full combat damage", () => {
  const { battle, damageEvent, human } = damageFixture(8, 4);

  assert.equal(battle.alivePlayersAtCombatStart, 4);
  assert.equal(battle.damageCap, null);
  assert.equal(damageEvent.uncappedAmount, undefined);
  assert.equal(damageEvent.damageCap, undefined);
  assert.equal(damageEvent.damagePreventedByCap, undefined);
  assert.equal(damageEvent.amount, 48);
  assert.equal(human.health, 52);
});

test("every pairing locks the same alive-player snapshot before eliminations", () => {
  const state = createGame(0xdc66, 100);
  state.round = 2;
  state.lobbySystemsEnabled = false;
  for (const [index, player] of state.players.entries()) {
    player.isHuman = true;
    player.alive = index < 6;
    player.health = player.alive ? 100 : 0;
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.board = [];
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.lastRoundBattles.length, 3);
  assert.ok(
    combat.lastRoundBattles.every(
      (battle) =>
        battle.alivePlayersAtCombatStart === 6 && battle.damageCap === 5,
    ),
  );
});

test("a non-lethal capped hit does not consume Ice Block", () => {
  const { battle, damageEvent, human } = damageFixture(1, 8, 0, 6, true);

  assert.equal(damageEvent.uncappedAmount, 48);
  assert.equal(damageEvent.amount, 5);
  assert.equal(human.health, 1);
  assert.deepEqual(human.secretIds, ["hero-secret-tb_bacon_secrets_12"]);
  assert.equal(
    battle.events.some(
      (event) => event.type === "trigger" && /寒冰屏障/u.test(event.message),
    ),
    false,
  );
});

test("late draw fatigue uses the announced cap and structured playback fields", () => {
  const state = createGame(0xdc80, 100);
  state.round = 80;
  state.lobbySystemsEnabled = false;
  state.systemEventId = null;
  state.pendingInteraction = null;
  for (const player of state.players) {
    player.isHuman = true;
    player.alive = true;
    player.health = 100;
    player.armor = 0;
    player.gold = 0;
    player.heroId = null;
    player.heroPowerId = null;
    player.secretIds = [];
    player.trinketIds = [];
    player.hand = [];
    player.shop = [];
    player.board = [];
    player.frozen = false;
    player.pendingSpellcraft = [];
    player.pendingSystemSpellIds = [];
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle, "the human combat summary must exist");
  const human = humanPlayer(combat);
  const damageEvent = battle.events.find(
    (event) =>
      event.type === "heroDamage" && event.targetPlayerId === human.id,
  );
  assert.ok(damageEvent, "late draw fatigue must emit hero damage");

  assert.equal(battle.damageCap, 15);
  assert.equal(damageEvent.uncappedAmount, 20);
  assert.equal(damageEvent.damageCap, 15);
  assert.equal(damageEvent.damagePreventedByCap, 5);
  assert.equal(damageEvent.amount, 15);
  assert.equal(damageEvent.healthDamage, 15);
  assert.equal(human.health, 85);
});
