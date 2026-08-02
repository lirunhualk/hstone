import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  trinketsForTier,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

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

function preparePlayers(state: GameState): [PlayerState, PlayerState] {
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

function equipTrinket(player: PlayerState, cardId: string): string {
  const trinket = [
    ...trinketsForTier("lesser"),
    ...trinketsForTier("greater"),
  ].find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(trinket, `missing Trinket ${cardId}`);
  player.trinketIds = [trinket.id];
  player.trinketCounters[trinket.id] = 0;
  return trinket.id;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const player = state.players[0];
  const trinket = [
    ...trinketsForTier("lesser"),
    ...trinketsForTier("greater"),
  ].find((candidate) => candidate.cardId === cardId);
  assert.ok(trinket, `missing Trinket ${cardId}`);
  const options = [
    trinket,
    ...trinketsForTier(trinket.tier).filter(
      (candidate) => candidate.id !== trinket.id,
    ),
  ].slice(0, 4);
  player.gold = 20;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `test-${trinket.id}`,
    playerId: player.id,
    sourceInstanceId: `test-source-${trinket.id}`,
    trinketTier: trinket.tier,
    optionIds: options.map((candidate) => candidate.id),
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: trinket.id,
  });
}

function fight(state: GameState): { state: GameState; battle: BattleSummary } {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.ok(combat.lastBattle);
  return { state: combat, battle: combat.lastBattle };
}

function passiveWall(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return minion("BG29_611", instanceId, {
    attack: 0,
    health: 1_000,
    taunt: true,
    divineShield: false,
    ...overrides,
  });
}

function sacrificialMinions(
  count: number,
  prefix: string,
): BoardMinionInstance[] {
  return Array.from({ length: count }, (_, index) =>
    minion("murloc-tidehunter", `${prefix}-${index}`, {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
      divineShield: false,
    }),
  );
}

function scallywagDeathChain(prefix: string): BoardMinionInstance[] {
  return Array.from({ length: 7 }, (_, index) =>
    minion("scallywag", `${prefix}-${index}`, {
      attack: 3,
      health: 1,
      taunt: true,
      divineShield: false,
    }),
  );
}

test("Ironforge Anvil triples only truly typeless minions at start of combat", () => {
  const state = createGame(401);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_403");
  human.board = [
    minion("murloc-tidehunter", "typeless", {
      tribe: "neutral",
      tribes: [],
      attack: 2,
      health: 3,
    }),
    minion("murloc-tidehunter", "dual-typed", {
      tribe: "murloc",
      tribes: ["murloc", "dragon"],
      attack: 2,
      health: 3,
    }),
  ];
  enemy.board = [passiveWall("anvil-wall", { attack: 100 })];

  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(buffs.length, 1);
  assert.equal(buffs[0].targetInstanceId, "typeless");
  assert.equal(buffs[0].minion?.attack, 6);
  assert.equal(buffs[0].minion?.health, 9);
});

test("Bronze Timepiece grants half Attack rounded up as Health", () => {
  const state = createGame(402);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_995");
  human.board = [
    minion("murloc-tidehunter", "odd-attack", {
      tribe: "neutral",
      tribes: [],
      attack: 5,
      health: 2,
    }),
    minion("murloc-warleader", "even-attack", {
      tribe: "neutral",
      tribes: [],
      attack: 4,
      health: 3,
    }),
  ];
  enemy.board = [passiveWall("timepiece-wall", { attack: 100 })];

  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.deepEqual(
    buffs.map((event) => [event.targetInstanceId, event.healthDelta]),
    [
      ["odd-attack", 3],
      ["even-attack", 2],
    ],
  );
});

test("All-Purpose Kibble recognizes dual-type Beasts and grows across combats", () => {
  let state = createGame(403);
  let [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG32_MagicItem_200");
  human.board = [
    minion("murloc-tidehunter", "dual-beast", {
      tribe: "beast",
      tribes: ["beast", "dragon"],
      attack: 1,
      health: 10,
    }),
    passiveWall("kibble-dummy", { taunt: false }),
  ];
  enemy.board = [
    minion("murloc-tidehunter", "kibble-target-1", {
      attack: 0,
      health: 3,
      divineShield: false,
    }),
  ];

  let result = fight(state);
  state = result.state;
  human = state.players[0];
  assert.equal(human.trinketCounters[trinketId], 2);
  assert.equal(
    result.battle.events.find(
      (event) =>
        event.type === "buff" && event.actorInstanceId === trinketId,
    )?.attackDelta,
    2,
  );

  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  [human, enemy] = [state.players[0], state.players[1]];
  human.gold = 0;
  enemy.gold = 0;
  human.shop = [];
  enemy.shop = [];
  human.board = [
    minion("murloc-tidehunter", "dual-beast-next", {
      tribe: "beast",
      tribes: ["beast", "dragon"],
      attack: 1,
      health: 10,
    }),
    passiveWall("kibble-dummy-next", { taunt: false }),
  ];
  enemy.board = [
    minion("murloc-tidehunter", "kibble-target-2", {
      attack: 0,
      health: 5,
      divineShield: false,
    }),
  ];

  result = fight(state);
  assert.equal(result.state.players[0].trinketCounters[trinketId], 4);
  assert.equal(
    result.battle.events.find(
      (event) =>
        event.type === "buff" && event.actorInstanceId === trinketId,
    )?.attackDelta,
    4,
  );
});

test("a ghost Kibble grows only its combat-local copy", () => {
  const state = createGame(404);
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
    player.board = [passiveWall(`live-wall-${player.id}`, { health: 7 })];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const trinketId = equipTrinket(ghost, "BG32_MagicItem_200");
  ghost.trinketCounters[trinketId] = 4;
  ghost.board = [
    minion("murloc-tidehunter", "ghost-dual-beast", {
      tribe: "beast",
      tribes: ["beast", "dragon"],
      attack: 1,
      health: 10,
    }),
    passiveWall("ghost-dummy", { taunt: false }),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) => battle.isGhost && battle.playerBId === ghost.id,
  );
  assert.ok(ghostBattle);
  const kibbleBuff = ghostBattle.events.find(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(kibbleBuff?.attackDelta, 6);
  assert.notEqual(kibbleBuff?.permanentEffectImprovement, true);
  assert.equal(combat.players[3].trinketCounters[trinketId], 4);
});

test("Faerie Dragon Scale grants at most three new shields per combat", () => {
  const state = createGame(405);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG32_MagicItem_363");
  human.board = [
    minion("murloc-tidehunter", "scale-dragon", {
      tribe: "dragon",
      tribes: ["dragon", "beast"],
      attack: 1,
      health: 100,
      windfury: true,
    }),
    passiveWall("scale-dummy", { taunt: false }),
  ];
  enemy.board = [passiveWall("scale-target", { attack: 1, health: 20 })];

  const { battle } = fight(state);
  const shieldBuffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(shieldBuffs.length, 3);
  assert.ok(shieldBuffs.every((event) => event.minion?.divineShield));
});

test("Jar o' Gems triggers every second attack and buffs dual-type Quilboar", () => {
  const state = createGame(406);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_546");
  human.bloodGemAttack = 2;
  human.bloodGemHealth = 3;
  human.board = [
    minion("murloc-tidehunter", "jar-attacker", {
      tribe: "neutral",
      tribes: [],
      attack: 4,
      health: 20,
      windfury: true,
    }),
    minion("murloc-warleader", "jar-quilboar", {
      tribe: "quilboar",
      tribes: ["quilboar"],
      attack: 0,
      health: 4,
    }),
    minion("murloc-warleader", "jar-dual-quilboar", {
      tribe: "quilboar",
      tribes: ["quilboar", "dragon"],
      attack: 0,
      health: 5,
    }),
  ];
  enemy.board = [passiveWall("jar-target", { health: 7 })];

  const { battle } = fight(state);
  const trigger = battle.events.filter(
    (event) => event.type === "trigger" && event.actorInstanceId === trinketId,
  );
  const gemBuffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(trigger.length, 1);
  assert.deepEqual(
    gemBuffs.map((event) => event.targetInstanceId).sort(),
    ["jar-dual-quilboar", "jar-quilboar"],
  );
  assert.ok(
    gemBuffs.every(
      (event) => event.attackDelta === 2 && event.healthDelta === 3,
    ),
  );
});

test("Slamma Sticker doubles the Attack of Beasts summoned in combat", () => {
  const state = createGame(407);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_540");
  human.board = [
    minion("rat-pack", "slamma-rat-pack", { attack: 3, health: 1 }),
  ];
  enemy.board = [
    passiveWall("slamma-killer", { attack: 100 }),
    passiveWall("slamma-backup"),
  ];

  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(buffs.length, 3);
  assert.ok(
    buffs.every(
      (event) => event.attackDelta === 1 && event.minion?.attack === 2,
    ),
  );
});

test("Reinforced Shield consumes charges only for five newly granted shields", () => {
  const state = createGame(408);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_886");
  human.board = [
    minion("rat-pack", "shield-rat-pack", { attack: 7, health: 1 }),
  ];
  enemy.board = [
    passiveWall("shield-killer", { attack: 100 }),
    passiveWall("shield-backup"),
  ];

  const { battle } = fight(state);
  const shieldBuffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(shieldBuffs.length, 5);
  assert.ok(shieldBuffs.every((event) => event.minion?.divineShield));
});

test("Bassgill Portrait shields a Murloc summoned from hand by Rally", () => {
  const state = createGame(409);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG32_MagicItem_301");
  human.board = [
    minion("BG34_140", "bassgill-rally", { attack: 3, health: 20 }),
    passiveWall("bassgill-dummy", { taunt: false }),
  ];
  human.hand = [
    minion("murloc-tidehunter", "bassgill-hand-murloc", {
      attack: 10,
      health: 10,
    }),
  ];
  enemy.board = [passiveWall("bassgill-target", { health: 3 })];

  const { battle } = fight(state);
  const rallySummon = battle.events.find(
    (event) =>
      event.type === "summon" && event.summonReason === "rallyFromHand",
  );
  assert.ok(rallySummon?.targetInstanceId);
  const shield = battle.events.find(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(shield?.targetInstanceId, rallySummon.targetInstanceId);
  assert.equal(shield?.minion?.divineShield, true);
});

test("Eternal Portrait grants its Knight on acquire and Taunt plus Reborn in combat", () => {
  let state = createGame(410);
  preparePlayers(state);
  state = acquireTrinket(state, "BG30_MagicItem_301");
  const human = state.players[0];
  const enemy = state.players[1];
  const trinketId = human.trinketIds[0];
  const knight = human.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG25_008",
  );
  assert.ok(knight);
  human.hand = [];
  human.board = [knight];
  enemy.board = [passiveWall("eternal-portrait-wall", { attack: 100 })];

  const { battle } = fight(state);
  const buff = battle.events.find(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(buff?.targetInstanceId, knight.instanceId);
  assert.equal(buff?.minion?.taunt, true);
  assert.equal(buff?.minion?.reborn, true);
});

test("Automaton Portrait waits on a full board and summons into the first opening", () => {
  const state = createGame(411);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_303");
  human.board = [
    minion("murloc-tidehunter", "automaton-opening", {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
    }),
    ...Array.from({ length: 6 }, (_, index) =>
      minion("murloc-tidehunter", `automaton-filler-${index}`, {
        tribe: "neutral",
        tribes: [],
        attack: 0,
        health: 100,
        taunt: false,
      }),
    ),
  ];
  enemy.board = [passiveWall("automaton-killer", { attack: 100 })];

  const { battle } = fight(state);
  const trigger = battle.events.find(
    (event) => event.type === "trigger" && event.actorInstanceId === trinketId,
  );
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "BG_TTN_401",
  );
  assert.ok(trigger);
  assert.ok(summon);
  assert.ok(
    (summon.index ?? 0) >
      battle.events.find(
        (event) =>
          event.type === "death" &&
          event.actorInstanceId === "automaton-opening",
      )!.index,
  );
});

test("Hoggy Bank grants exactly two persistent Blood Gems per enchanted Quilboar Deathrattle", () => {
  const state = createGame(412);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_411");
  human.board = [
    minion("murloc-tidehunter", "hoggy-quilboar", {
      tribe: "quilboar",
      tribes: ["quilboar", "naga"],
      attack: 0,
      health: 1,
      taunt: true,
    }),
    passiveWall("hoggy-dummy", { taunt: false }),
  ];
  enemy.board = [passiveWall("hoggy-killer", { attack: 100 })];

  const result = fight(state);
  const gems = result.state.players[0].hand.filter(
    (card) => card.kind === "bloodGem",
  );
  assert.equal(gems.length, 2);
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "cardGain" && event.actorInstanceId === trinketId,
    ).length,
    2,
  );
});

test("Staff of the Scourge grants Reborn after exactly five friendly deaths", () => {
  const state = createGame(413);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_437");
  const victims = Array.from({ length: 5 }, (_, index) =>
    minion("murloc-tidehunter", `staff-victim-${index}`, {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
    }),
  );
  human.board = [
    ...victims,
    minion("BG25_008", "staff-undead", {
      attack: 0,
      health: 100,
      taunt: false,
      reborn: false,
    }),
  ];
  enemy.board = [passiveWall("staff-killer", { attack: 100 })];

  const { battle } = fight(state);
  const avenge = battle.events.filter(
    (event) => event.type === "avenge" && event.actorInstanceId === trinketId,
  );
  const buff = battle.events.find(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(avenge.length, 1);
  assert.equal(buff?.targetInstanceId, "staff-undead");
  assert.equal(buff?.minion?.reborn, true);
});

test("Deathly Phylactery opens a Deathrattle Discover on acquire", () => {
  let state = createGame(414);
  preparePlayers(state);
  state = acquireTrinket(state, "BG30_MagicItem_700");
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.ability, "deathrattle");
  assert.equal(pending.options.length, 3);
  assert.ok(state.players[0].trinketIds.includes(pending.sourceInstanceId));
});

test("Deathly Phylactery repeats only the first friendly Deathrattle each combat", () => {
  const state = createGame(415);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_700");
  human.board = [
    minion("rat-pack", "phylactery-rat-pack", {
      attack: 2,
      health: 1,
      taunt: true,
    }),
  ];
  enemy.board = [
    passiveWall("phylactery-killer", { attack: 100 }),
    passiveWall("phylactery-backup"),
  ];

  const { battle } = fight(state);
  assert.equal(
    battle.events.filter(
      (event) =>
        event.type === "trigger" && event.actorInstanceId === trinketId,
    ).length,
    1,
  );
  assert.equal(
    battle.events.filter(
      (event) =>
        event.type === "summon" && event.minion?.definitionId === "rat-token",
    ).length,
    4,
  );
});

test("Holy Mallet shields only the physical leftmost and rightmost minions", () => {
  const state = createGame(416);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_902");
  human.board = [
    minion("murloc-tidehunter", "mallet-left", { divineShield: false }),
    minion("murloc-tidehunter", "mallet-middle", { divineShield: false }),
    minion("murloc-tidehunter", "mallet-right", { divineShield: false }),
  ];
  enemy.board = [passiveWall("mallet-wall", { attack: 100 })];

  const { battle } = fight(state);
  assert.deepEqual(
    battle.events
      .filter(
        (event) => event.type === "buff" && event.actorInstanceId === trinketId,
      )
      .map((event) => event.targetInstanceId)
      .sort(),
    ["mallet-left", "mallet-right"],
  );
});

test("Rusty Trident grants a random supported Spellcraft card on Naga death", () => {
  const state = createGame(417);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_917");
  human.tavernTier = 6;
  human.board = [
    minion("murloc-tidehunter", "trident-naga", {
      tribe: "naga",
      tribes: ["naga", "quilboar"],
      attack: 0,
      health: 1,
      taunt: true,
    }),
    passiveWall("trident-dummy", { taunt: false }),
  ];
  enemy.board = [passiveWall("trident-killer", { attack: 100 })];

  const result = fight(state);
  assert.equal(
    result.state.players[0].hand.filter((card) => card.kind === "spellcraft")
      .length,
    1,
  );
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "cardGain" && event.actorInstanceId === trinketId,
    ).length,
    1,
  );
});

test("Baleful Incense targets the leftmost and rightmost Undead, even if one already has Reborn", () => {
  const state = createGame(418);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG32_MagicItem_360");
  human.board = [
    minion("BG25_008", "incense-left", { reborn: true }),
    minion("BG25_008", "incense-middle", { reborn: false }),
    minion("murloc-tidehunter", "incense-neutral", {
      tribe: "neutral",
      tribes: [],
    }),
    minion("BG25_008", "incense-right", { reborn: false }),
  ];
  enemy.board = [passiveWall("incense-wall", { attack: 100 })];

  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.deepEqual(
    buffs.map((event) => event.targetInstanceId).sort(),
    ["incense-left", "incense-right"],
  );
  assert.ok(buffs.every((event) => event.minion?.reborn));
});

test("both Quilligraphy Sets use their exact repeating Avenge thresholds", () => {
  const cases = [
    {
      seed: 419,
      cardId: "BG30_MagicItem_410",
      expectedTriggers: 2,
      attackGrowth: 0,
      healthGrowth: 2,
    },
    {
      seed: 420,
      cardId: "BG30_MagicItem_410t2",
      expectedTriggers: 1,
      attackGrowth: 1,
      healthGrowth: 1,
    },
  ] as const;

  for (const scenario of cases) {
    const state = createGame(scenario.seed);
    const [human, enemy] = preparePlayers(state);
    const trinketId = equipTrinket(human, scenario.cardId);
    const attackBefore = human.bloodGemAttack;
    const healthBefore = human.bloodGemHealth;
    human.board = sacrificialMinions(7, `quill-${scenario.seed}`);
    enemy.board = [
      passiveWall(`quill-wall-${scenario.seed}`, {
        attack: 100,
        health: 10_000,
      }),
    ];

    const result = fight(state);
    assert.equal(
      result.battle.events.filter(
        (event) =>
          event.type === "avenge" &&
          event.actorInstanceId === trinketId,
      ).length,
      scenario.expectedTriggers,
    );
    assert.equal(
      result.state.players[0].bloodGemAttack,
      attackBefore + scenario.attackGrowth,
    );
    assert.equal(
      result.state.players[0].bloodGemHealth,
      healthBefore + scenario.healthGrowth,
    );
  }
});

test("Fridge Magnet generates a Magnetic minion within the owner's Tavern Tier", () => {
  const state = createGame(421);
  state.activeTribes = ["mech"];
  const [human, enemy] = preparePlayers(state);
  human.tavernTier = 3;
  const trinketId = equipTrinket(human, "BG30_MagicItem_545");
  human.board = sacrificialMinions(3, "fridge-victim");
  enemy.board = [passiveWall("fridge-wall", { attack: 100 })];
  const poolBefore = { ...state.pool };

  const result = fight(state);
  const gained = result.state.players[0].hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.equal(gained.length, 1);
  const definition = getMinionDefinition(gained[0].definitionId);
  assert.ok(definition.magnetic);
  assert.ok(definition.tier <= human.tavernTier);
  assert.equal(
    result.state.pool[gained[0].definitionId],
    poolBefore[gained[0].definitionId],
  );
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "cardGain" && event.actorInstanceId === trinketId,
    ).length,
    1,
  );
});

test("Bleeding Heart and Stormcoil Sticker generate the exact typed, tier-capped rewards", () => {
  const cases = [
    {
      seed: 422,
      cardId: "BG30_MagicItem_713",
      tribe: "undead" as const,
    },
    {
      seed: 423,
      cardId: "BG35_MagicItem_302",
      tribe: "mech" as const,
    },
  ];

  for (const scenario of cases) {
    const state = createGame(scenario.seed);
    state.activeTribes = [scenario.tribe];
    const [human, enemy] = preparePlayers(state);
    human.tavernTier = 3;
    const trinketId = equipTrinket(human, scenario.cardId);
    human.board = scallywagDeathChain(`typed-reward-${scenario.seed}`);
    enemy.board = [
      passiveWall(`typed-reward-wall-${scenario.seed}`, {
        attack: 100,
        health: 10_000,
      }),
    ];

    const result = fight(state);
    const gained = result.state.players[0].hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    assert.equal(gained.length, 1);
    assert.ok(
      gained[0].tribes.includes(scenario.tribe) ||
        gained[0].tribes.includes("all"),
    );
    assert.ok(gained[0].tier <= human.tavernTier);
    assert.equal(
      result.battle.events.filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === trinketId,
      ).length,
      1,
    );
  }
});

test("eight-death generators reset after each trigger even when every reward is burned", () => {
  const state = createGame(431);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_302");
  human.hand = Array.from({ length: 10 }, (_, index) =>
    minion("murloc-tidehunter", `stormcoil-hand-${index}`),
  );
  human.board = Array.from({ length: 7 }, (_, index) =>
    minion("BG35_604", `stormcoil-chain-${index}`, {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  );
  enemy.board = [
    passiveWall("stormcoil-chain-wall", {
      attack: 100,
      health: 10_000,
    }),
  ];

  const result = fight(state);
  const friendlyDeaths = result.battle.events.filter(
    (event) =>
      event.type === "death" && event.actorPlayerId === human.id,
  ).length;
  const expectedTriggers = Math.floor(friendlyDeaths / 8);
  assert.ok(expectedTriggers >= 2);
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "trigger" && event.actorInstanceId === trinketId,
    ).length,
    expectedTriggers,
  );
  const gains = result.battle.events.filter(
    (event) =>
      event.type === "cardGain" && event.actorInstanceId === trinketId,
  );
  assert.equal(gains.length, expectedTriggers);
  assert.ok(
    gains.every((event) => event.cardGainResult === "handFull"),
  );
});

test("Gilnean Thorned Rose writes +4/+5 permanently, then deals combat-only damage", () => {
  const state = createGame(424);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_864");
  human.board = [
    ...sacrificialMinions(3, "rose-victim"),
    passiveWall("rose-survivor", {
      attack: 0,
      health: 1_000,
      taunt: false,
    }),
  ];
  enemy.board = [
    passiveWall("rose-wall", { attack: 100, health: 10_000 }),
  ];

  const result = fight(state);
  const persistent = result.state.players[0].board.find(
    (candidate) => candidate.instanceId === "rose-survivor",
  );
  assert.equal(persistent?.attack, 4);
  assert.equal(persistent?.health, 1_005);
  assert.ok(
    result.battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === trinketId &&
        event.targetInstanceId === "rose-survivor" &&
        event.attackDelta === 4 &&
        event.healthDelta === 5 &&
        event.retained,
    ),
  );
  assert.ok(
    result.battle.events.some(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === trinketId &&
        event.targetInstanceId === "rose-survivor" &&
        event.amount === 1,
    ),
  );
});

test("Lucky Tabby resets and triggers twice through an exact 14-death chain", () => {
  const state = createGame(425);
  state.activeTribes = ["beast"];
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_931");
  human.board = scallywagDeathChain("tabby-chain");
  enemy.board = [
    passiveWall("tabby-wall", { attack: 100, health: 10_000 }),
  ];

  const result = fight(state);
  const gained = result.state.players[0].hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.equal(gained.length, 2);
  assert.ok(
    gained.every(
      (card) =>
        card.tribes.includes("beast") || card.tribes.includes("all"),
    ),
  );
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "trigger" && event.actorInstanceId === trinketId,
    ).length,
    2,
  );
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "cardGain" && event.actorInstanceId === trinketId,
    ).length,
    2,
  );
});

test("Eye of Dalaran excludes typed deaths, generates a spell, then reports full-hand overflow", () => {
  const state = createGame(426);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_981");
  human.hand = Array.from({ length: 9 }, (_, index) =>
    minion("murloc-tidehunter", `eye-hand-${index}`),
  );
  human.board = [
    minion("murloc-tidehunter", "eye-typed", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    minion("murloc-tidehunter", "eye-typeless-a", {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
    }),
    minion("murloc-tidehunter", "eye-typeless-b", {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  enemy.board = [passiveWall("eye-wall", { attack: 100 })];

  const result = fight(state);
  assert.equal(result.state.players[0].hand.length, 10);
  assert.equal(
    result.state.players[0].hand.filter(
      (card) => card.kind === "tavernSpell",
    ).length,
    1,
  );
  const gains = result.battle.events.filter(
    (event) =>
      event.type === "cardGain" && event.actorInstanceId === trinketId,
  );
  assert.equal(gains.length, 2);
  assert.ok(gains.every((event) => event.cardKind === "tavernSpell"));
  assert.deepEqual(
    gains.map((event) => event.cardGainResult).sort(),
    ["added", "handFull"],
  );
});

test("both Beetle Bands use exact thresholds and summon 2/2 Taunt Beetles", () => {
  const cases = [
    {
      seed: 427,
      cardId: "BG32_MagicItem_860",
      deaths: 5,
      summons: 1,
    },
    {
      seed: 428,
      cardId: "BG32_MagicItem_860t",
      deaths: 7,
      summons: 2,
    },
  ] as const;

  for (const scenario of cases) {
    const state = createGame(scenario.seed);
    const [human, enemy] = preparePlayers(state);
    const trinketId = equipTrinket(human, scenario.cardId);
    human.board = sacrificialMinions(
      scenario.deaths,
      `band-${scenario.seed}`,
    );
    enemy.board = [
      passiveWall(`band-wall-${scenario.seed}`, {
        attack: 100,
        health: 10_000,
      }),
    ];

    const result = fight(state);
    assert.equal(
      result.battle.events.filter(
        (event) =>
          event.type === "avenge" &&
          event.actorInstanceId === trinketId,
      ).length,
      1,
    );
    const summons = result.battle.events.filter(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-beetle-token",
    );
    assert.equal(summons.length, scenario.summons);
    assert.ok(
      summons.every(
        (event) =>
          event.minion?.attack === 2 &&
          event.minion.health === 2 &&
          event.minion.taunt,
      ),
    );
  }
});

test("deathrattle multipliers never multiply Trinket death counters", () => {
  const state = createGame(429);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_410");
  const bloodGemHealthBefore = human.bloodGemHealth;
  human.board = [
    minion("kaboom-bot", "counter-kaboom", {
      health: 1,
      taunt: true,
    }),
    minion("titus-rivendare", "counter-titus", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  enemy.board = [
    passiveWall("counter-wall", { attack: 100, health: 10_000 }),
  ];

  const result = fight(state);
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "avenge" && event.actorInstanceId === trinketId,
    ).length,
    0,
  );
  assert.equal(
    result.state.players[0].bloodGemHealth,
    bloodGemHealthBefore,
  );
  const deathIndex = result.battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === "counter-kaboom",
  )?.index;
  assert.notEqual(deathIndex, undefined);
  assert.equal(
    result.battle.events.filter(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === "counter-kaboom" &&
        event.index > (deathIndex ?? Number.MAX_SAFE_INTEGER),
    ).length,
    2,
  );
});

test("a ghost Quilligraphy Set can trigger visually but never writes permanent Blood Gem growth", () => {
  const state = createGame(430);
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
      passiveWall(`quill-live-${player.id}`, {
        attack: 100,
        health: 10_000,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const trinketId = equipTrinket(ghost, "BG30_MagicItem_410");
  const bloodGemHealthBefore = ghost.bloodGemHealth;
  ghost.board = sacrificialMinions(7, "quill-ghost");

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) => battle.isGhost && battle.playerBId === ghost.id,
  );
  assert.ok(ghostBattle);
  assert.equal(
    ghostBattle.events.filter(
      (event) =>
        event.type === "avenge" && event.actorInstanceId === trinketId,
    ).length,
    2,
  );
  assert.equal(combat.players[3].bloodGemHealth, bloodGemHealthBefore);
  assert.equal(
    ghostBattle.events.filter(
      (event) =>
        event.type === "buff" && event.actorInstanceId === trinketId,
    ).length,
    0,
  );
});
