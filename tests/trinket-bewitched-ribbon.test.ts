import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";

const RIBBON_CARD_ID = "BG35_MagicItem_923";

function minion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack,
    health: definition.health,
    golden: false,
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
    description: definition.description,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function equipRibbon(player: PlayerState): string {
  const ribbon = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === RIBBON_CARD_ID,
  );
  assert.ok(ribbon);
  player.trinketIds = [ribbon.id];
  player.trinketCounters = { [ribbon.id]: 0 };
  return ribbon.id;
}

function prepareCombat(state: GameState): [PlayerState, PlayerState] {
  state.lobbySystemsEnabled = false;
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.board = [];
    player.trinketIds = [];
    player.trinketCounters = {};
    player.eliminatedRound = undefined;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
    }
  }
  const human = state.players[0];
  const enemy = state.players[1];
  human.alive = true;
  human.health = 100;
  enemy.alive = true;
  enemy.health = 100;
  return [human, enemy];
}

function fight(state: GameState): { state: GameState; battle: BattleSummary } {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.ok(combat.lastBattle);
  return { state: combat, battle: combat.lastBattle };
}

test("Bewitched Ribbon permanently gives the Recruit warband +1/+1 after every spell", () => {
  let state = createGame(92301);
  const player = state.players[0];
  equipRibbon(player);
  const target = minion("BG29_611", "ribbon-recruit-target");
  const base = { attack: target.attack, health: target.health };
  player.board = [target];
  player.hand = [
    tavernSpell("tavern-spell-tavern-coin", "ribbon-recruit-coin"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "ribbon-recruit-coin",
  });
  const persisted = state.players[0].board.find(
    (candidate) => candidate.instanceId === target.instanceId,
  );
  assert.deepEqual(
    [persisted?.attack, persisted?.health],
    [base.attack + 1, base.health + 1],
  );
});

test("Bewitched Ribbon writes combat spell buffs back as permanent +2/+2", () => {
  const state = createGame(92302);
  const [human, enemy] = prepareCombat(state);
  const ribbonId = equipRibbon(human);
  const survivor = minion("BG29_611", "ribbon-combat-survivor", {
    attack: 0,
    health: 1_000,
  });
  const base = { attack: survivor.attack, health: survivor.health };
  human.board = [
    minion("BG34_920", "ribbon-tide-raiser", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    survivor,
  ];
  enemy.board = [
    minion("BG29_611", "ribbon-combat-wall", {
      attack: 100,
      health: 10_000,
      taunt: true,
      divineShield: false,
    }),
  ];

  const result = fight(state);
  const persisted = result.state.players[0].board.find(
    (candidate) => candidate.instanceId === survivor.instanceId,
  );
  assert.deepEqual(
    [persisted?.attack, persisted?.health],
    [base.attack + 2, base.health + 2],
  );
  const buff = result.battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === ribbonId &&
      event.targetInstanceId === survivor.instanceId,
  );
  assert.equal(buff?.attackDelta, 2);
  assert.equal(buff?.healthDelta, 2);
  assert.equal(buff?.retained, true);
});

test("a ghost Bewitched Ribbon animates +2/+2 without mutating its former owner", () => {
  const state = createGame(92303);
  state.lobbySystemsEnabled = false;
  for (const player of state.players) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.board = [];
    player.trinketIds = [];
    player.trinketCounters = {};
    player.alive = false;
    player.health = 0;
    player.eliminatedRound = undefined;
  }
  for (const player of state.players.slice(0, 3)) {
    player.alive = true;
    player.health = 100;
    player.board = [
      minion("BG29_611", `ribbon-live-wall-${player.id}`, {
        attack: 100,
        health: 10_000,
        taunt: true,
        divineShield: false,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const ribbonId = equipRibbon(ghost);
  const survivor = minion("BG29_611", "ribbon-ghost-survivor", {
    attack: 0,
    health: 1_000,
  });
  const base = { attack: survivor.attack, health: survivor.health };
  ghost.board = [
    minion("BG34_920", "ribbon-ghost-tide-raiser", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    survivor,
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastRoundBattles.find(
    (candidate) => candidate.isGhost && candidate.playerBId === ghost.id,
  );
  assert.ok(battle);
  const buff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === ribbonId &&
      event.targetInstanceId === survivor.instanceId,
  );
  assert.equal(buff?.attackDelta, 2);
  assert.notEqual(buff?.retained, true);
  const persistent = combat.players[3].board.find(
    (candidate) => candidate.instanceId === survivor.instanceId,
  );
  assert.deepEqual(
    [persistent?.attack, persistent?.health],
    [base.attack, base.health],
  );
});
