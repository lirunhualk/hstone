import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  trinketsForTier,
  type BattleSummary,
  type BloodGemSpellInstance,
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
  ].find((candidate) => candidate.cardId === cardId);
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
    attack: 1,
    health: 1_000,
    taunt: true,
    divineShield: false,
    ...overrides,
  });
}

function bloodGem(instanceId: string): BloodGemSpellInstance {
  return {
    kind: "bloodGem",
    instanceId,
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  };
}

test("Mama Bear Sticker buffs recruited and combat-summoned Beasts by +5/+5", () => {
  let state = createGame(801);
  let [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_871");
  human.hand = [minion("rat-pack", "recruit-beast")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = state.players[0];
  assert.equal(human.board[0].attack, 7);
  assert.equal(human.board[0].health, 7);

  human.board = [
    minion("rat-pack", "combat-rat-pack", {
      attack: 2,
      health: 1,
      taunt: true,
    }),
  ];
  enemy = state.players[1];
  enemy.board = [passiveWall("mama-wall", { attack: 100 })];
  const { battle } = fight(state);
  const summonBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === trinketId &&
      event.targetInstanceId !== "combat-rat-pack",
  );
  assert.ok(summonBuffs.length >= 1);
  assert.ok(
    summonBuffs.every(
      (event) => (event.minion?.attack ?? 0) >= 6 && (event.minion?.health ?? 0) >= 6,
    ),
  );
});

test("Rivendare Portrait grants Titus and doubles every friendly Titus Health", () => {
  let acquisition = createGame(802);
  preparePlayers(acquisition);
  acquisition = acquireTrinket(acquisition, "BG30_MagicItem_310");
  assert.ok(
    acquisition.players[0].hand.some(
      (card) => card.kind === "minion" && card.definitionId === "titus-rivendare",
    ),
  );

  const state = createGame(803);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG30_MagicItem_310");
  human.board = [
    minion("titus-rivendare", "titus-one", { health: 9 }),
    minion("titus-rivendare", "titus-two", { health: 13 }),
  ];
  enemy.board = [passiveWall("titus-wall", { attack: 100 })];
  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.deepEqual(
    buffs.map((event) => [event.targetInstanceId, event.minion?.health]).sort(),
    [
      ["titus-one", 18],
      ["titus-two", 26],
    ],
  );
});

test("Wicked Tome permanently improves Tavern Spell buffs on Avenge (4)", () => {
  const state = createGame(804);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG32_MagicItem_270t");
  const beforeAttack = human.tavernSpellAttackBonus;
  const beforeHealth = human.tavernSpellHealthBonus;
  human.board = Array.from({ length: 4 }, (_, index) =>
    minion("murloc-tidehunter", `tome-sacrifice-${index}`, {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
    }),
  );
  enemy.board = [passiveWall("tome-wall")];
  const { state: combat, battle } = fight(state);
  assert.equal(combat.players[0].tavernSpellAttackBonus, beforeAttack + 1);
  assert.equal(combat.players[0].tavernSpellHealthBonus, beforeHealth + 1);
  assert.ok(
    battle.events.some(
      (event) => event.type === "avenge" && event.actorInstanceId === trinketId,
    ),
  );
});

test("Protective Ring grants Divine Shield to exactly four distinct Pirates", () => {
  const state = createGame(805);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_711");
  human.board = Array.from({ length: 5 }, (_, index) =>
    minion("scallywag", `ring-pirate-${index}`, { divineShield: false }),
  );
  enemy.board = [passiveWall("ring-wall", { attack: 100 })];
  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.equal(buffs.length, 4);
  assert.equal(new Set(buffs.map((event) => event.targetInstanceId)).size, 4);
  assert.ok(buffs.every((event) => event.minion?.divineShield === true));
});

test("Dramaloc Sticker gives Murlocs the highest Attack among hand minions", () => {
  const state = createGame(806);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_754");
  human.board = [
    minion("murloc-tidehunter", "dramaloc-murloc-a", { attack: 2 }),
    minion("murloc-tidehunter", "dramaloc-murloc-b", { attack: 5 }),
    minion("junkbot", "dramaloc-non-murloc", { attack: 4 }),
  ];
  human.hand = [
    minion("junkbot", "hand-low", { attack: 6 }),
    minion("junkbot", "hand-high", { attack: 17 }),
  ];
  enemy.board = [passiveWall("dramaloc-wall", { attack: 100 })];
  const { battle } = fight(state);
  const buffs = battle.events.filter(
    (event) => event.type === "buff" && event.actorInstanceId === trinketId,
  );
  assert.deepEqual(
    buffs.map((event) => [event.targetInstanceId, event.attackDelta]).sort(),
    [
      ["dramaloc-murloc-a", 17],
      ["dramaloc-murloc-b", 17],
    ],
  );
});

test("Wildfeather Duster gets one tier-capped Beast after six Beast summons", () => {
  let state = createGame(807);
  let [human] = preparePlayers(state);
  equipTrinket(human, "BG35_MagicItem_700");
  human.tavernTier = 6;
  const beastIds = [
    "rat-pack",
    "cave-hydra",
    "savannah-highmane",
    "goldrinn",
    "ghastcoiler",
    "maexxna",
  ];
  for (const [index, definitionId] of beastIds.entries()) {
    human = state.players[0];
    human.hand = [minion(definitionId, `duster-beast-${index}`)];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  }
  human = state.players[0];
  assert.equal(human.hand.length, 1);
  const reward = human.hand[0];
  assert.equal(reward.kind, "minion");
  assert.ok(
    reward.kind === "minion" &&
      (reward.tribes.includes("beast") || reward.tribes.includes("all")),
  );
  assert.ok(reward.kind === "minion" && reward.tier <= human.tavernTier);
});

test("Blood Amulet permanently plays a Blood Gem on three minions per Deathrattle", () => {
  const state = createGame(808);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_432");
  const survivors = ["amulet-a", "amulet-b", "amulet-c"];
  human.board = [
    minion("goldrinn", "amulet-deathrattle", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    ...survivors.map((instanceId) =>
      minion("junkbot", instanceId, { attack: 0, health: 100 }),
    ),
  ];
  const before = new Map(
    human.board.map((candidate) => [
      candidate.instanceId,
      { attack: candidate.attack, health: candidate.health },
    ]),
  );
  enemy.board = [passiveWall("amulet-wall")];
  const { state: combat, battle } = fight(state);
  for (const instanceId of survivors) {
    const target = combat.players[0].board.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    assert.ok(target);
    assert.equal(target.attack, (before.get(instanceId)?.attack ?? 0) + 1);
    assert.equal(target.health, (before.get(instanceId)?.health ?? 0) + 1);
    assert.equal(target.bloodGemAttack, 1);
    assert.equal(target.bloodGemHealth, 1);
  }
  assert.equal(
    battle.events.filter(
      (event) => event.type === "buff" && event.actorInstanceId === trinketId,
    ).length,
    3,
  );
});

test("Copper Coil grows its exact lesser and greater Magnetize bonuses", () => {
  const cases = [
    { cardId: "BG35_MagicItem_300", expectedAttack: 8, expectedHealth: 12 },
    { cardId: "BG35_MagicItem_300t", expectedAttack: 14, expectedHealth: 15 },
  ] as const;
  for (const [index, scenario] of cases.entries()) {
    let state = createGame(809 + index);
    let [human] = preparePlayers(state);
    equipTrinket(human, scenario.cardId);
    human.board = [minion("junkbot", `coil-host-${index}`)];
    human.hand = [
      minion("BG26_146", `coil-source-${index}-a`),
      minion("BG26_146", `coil-source-${index}-b`),
    ];
    for (const suffix of ["a", "b"] as const) {
      state = gameReducer(state, {
        type: "MAGNETIZE_MINION",
        cardInstanceId: `coil-source-${index}-${suffix}`,
        targetInstanceId: `coil-host-${index}`,
      });
    }
    human = state.players[0];
    assert.equal(human.board[0].attack, scenario.expectedAttack);
    assert.equal(human.board[0].health, scenario.expectedHealth);
  }
});

test("Scrapsmith Portrait grants Scrapsmith and permanently Gems it after a Taunt dies", () => {
  let acquisition = createGame(811);
  preparePlayers(acquisition);
  acquisition = acquireTrinket(acquisition, "BG35_MagicItem_430");
  assert.ok(
    acquisition.players[0].hand.some(
      (card) => card.kind === "minion" && card.definitionId === "BG24_707",
    ),
  );

  const state = createGame(812);
  const [human, enemy] = preparePlayers(state);
  equipTrinket(human, "BG35_MagicItem_430");
  const scrapsmith = minion("BG24_707", "portrait-scrapsmith", {
    attack: 0,
    health: 100,
  });
  human.board = [
    minion("murloc-tidehunter", "portrait-taunt", {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 1,
      taunt: true,
    }),
    scrapsmith,
  ];
  enemy.board = [passiveWall("portrait-wall")];
  const { state: combat } = fight(state);
  const persistent = combat.players[0].board.find(
    (candidate) => candidate.instanceId === scrapsmith.instanceId,
  );
  assert.ok(persistent);
  assert.equal(persistent.attack, scrapsmith.attack + 1);
  assert.equal(persistent.health, scrapsmith.health + 1);
  assert.equal(persistent.bloodGemAttack, 1);
  assert.equal(persistent.bloodGemHealth, 1);
});

test("Trusty Crowbar buffs the leftmost minion when a Pirate enters hand", () => {
  let state = createGame(813);
  let [human] = preparePlayers(state);
  equipTrinket(human, "BG35_MagicItem_713");
  human.gold = 3;
  human.board = [
    minion("junkbot", "crowbar-left", { attack: 3, health: 4 }),
    minion("junkbot", "crowbar-right", { attack: 7, health: 8 }),
  ];
  human.shop = [minion("scallywag", "crowbar-pirate", { poolCopies: 1 })];
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  human = state.players[0];
  assert.equal(human.board[0].attack, 15);
  assert.equal(human.board[0].health, 16);
  assert.equal(human.board[1].attack, 7);
  assert.equal(human.board[1].health, 8);
});

test("Bloodbound Ring plays one extra Blood Gem on every Divine Shield minion", () => {
  let state = createGame(814);
  let [human] = preparePlayers(state);
  equipTrinket(human, "BG35_MagicItem_435");
  human.board = [
    minion("junkbot", "ring-shield-a", {
      attack: 2,
      health: 3,
      divineShield: true,
    }),
    minion("junkbot", "ring-target", {
      attack: 4,
      health: 5,
      divineShield: false,
    }),
    minion("junkbot", "ring-shield-b", {
      attack: 6,
      health: 7,
      divineShield: true,
    }),
  ];
  human.hand = [bloodGem("ring-hand-gem")];
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "ring-hand-gem",
    targetInstanceId: "ring-target",
  });
  human = state.players[0];
  assert.deepEqual(
    human.board.map((candidate) => [candidate.attack, candidate.health]),
    [
      [3, 4],
      [5, 6],
      [7, 8],
    ],
  );
});
