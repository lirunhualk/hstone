import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BattleSummary,
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

function definitionMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden
      ? definition.goldenCardId ?? definition.cardId
      : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    stealth: definition.stealth === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function isolateCombat(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.pendingSpellcraft = [];
    player.pendingSystemSpellIds = [];
    player.heroRefreshAvailable = false;
    player.freeRefreshes = 0;
    player.helpfulRefreshes = 0;
    player.lastHelpfulRefreshKind = null;
    player.nextCombatBeetles = 0;
    player.nextCombatAttackBonus = 0;
    player.nextCombatHealthBonus = 0;
    player.nextCombatSetEnemyHealthToOne = 0;
    player.nextCombatDoubleLeftmostAttack = [];
    player.board = [];
    if (index > 1) {
      player.alive = false;
      player.health = 0;
    } else {
      player.alive = true;
    }
  }
  const human = humanPlayer(state);
  const enemy = state.players[1]!;
  human.board = humanBoard;
  enemy.board = enemyBoard;
  human.lastOpponentId = enemy.id;
  enemy.lastOpponentId = human.id;
  return enemy;
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  return gameReducer(combat, { type: "CONTINUE" });
}

test("Akazamzarak hero power opens a Secret choice instead of a minion Discover", () => {
  let state = createGame(0xaa01);
  const player = humanPlayer(state);
  player.heroId = "hero-tb-21";
  player.heroPowerId = "hero-power-tb_baconshop_hp_020";
  player.gold = 0;

  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  assert.ok(state.pendingInteraction);
  assert.equal(state.pendingInteraction.kind, "secretChoice");
  assert.equal(state.pendingInteraction.optionIds.length, 3);
  assert.equal(humanPlayer(state).hand.length, 0);

  const pending = state.pendingInteraction;
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.optionIds[0]!,
  });
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).secretIds.length, 1);
  assert.equal(humanPlayer(state).hand.length, 0);
});

test("selected Competitive Spirit enters play and buffs the board next Recruit turn", () => {
  let state = createGame(0xaa02);
  const player = humanPlayer(state);
  player.heroId = "hero-tb-21";
  player.heroPowerId = "hero-power-tb_baconshop_hp_020";
  player.board = [definitionMinion("alleycat", "competitive-target")];
  player.secretIds = ["hero-secret-tb_bacon_secrets_13"];

  isolateCombat(
    state,
    humanPlayer(state).board,
    [],
  );
  state = continueThroughCombat(state);

  const refreshed = humanPlayer(state);
  assert.equal(refreshed.secretIds.length, 0);
  assert.equal(refreshed.board[0]?.attack, 2);
  assert.equal(refreshed.board[0]?.health, 2);
});

test("Ice Block secret prevents lethal combat damage once", () => {
  const state = createGame(0xaa03);
  const player = humanPlayer(state);
  player.heroId = "hero-tb-21";
  player.heroPowerId = "hero-power-tb_baconshop_hp_020";
  player.health = 2;
  player.secretIds = ["hero-secret-tb_bacon_secrets_12"];

  isolateCombat(state, [], [definitionMinion("BG29_611", "enemy-wall", {
    attack: 8,
    health: 8,
    taunt: true,
  })]);
  const afterCombat = gameReducer(state, { type: "END_TURN" });
  const refreshed = humanPlayer(afterCombat);
  assert.equal(refreshed.alive, true);
  assert.equal(refreshed.health, 2);
  assert.deepEqual(refreshed.secretIds, []);
});

test("Snake Trap summons three snakes when a friendly minion is attacked", () => {
  const state = createGame(0xaa04);
  const player = humanPlayer(state);
  player.heroId = "hero-tb-21";
  player.heroPowerId = "hero-power-tb_baconshop_hp_020";
  player.secretIds = ["hero-secret-tb_bacon_secrets_02"];

  isolateCombat(
    state,
    [definitionMinion("alleycat", "defender", { taunt: true })],
    [
      definitionMinion("BG29_611", "attacker", {
        attack: 4,
        health: 4,
      }),
      definitionMinion("alleycat", "attacker-helper"),
    ],
  );
  const afterCombat = gameReducer(state, { type: "END_TURN" });
  const battle = afterCombat.lastBattle as BattleSummary | null;
  assert.ok(battle);
  const snakeSummons = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "BG_EX1_554t",
  );
  assert.equal(snakeSummons.length, 3);
  assert.deepEqual(humanPlayer(afterCombat).secretIds, []);
});
