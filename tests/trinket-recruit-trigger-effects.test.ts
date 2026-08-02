import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
  type Tribe,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function minionDefinitionForTribe(tribe: Tribe) {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return (
      (tribes.includes(tribe) || tribes.includes("all")) &&
      candidate.battlecry === undefined &&
      candidate.interactiveBattlecry === undefined &&
      candidate.onPlayChoice === undefined &&
      candidate.magnetic === undefined &&
      candidate.afterGoldSpent === undefined &&
      candidate.afterSelfGainsAttack === undefined &&
      candidate.afterTavernSpellCast === undefined
    );
  });
  assert.ok(definition, `need a simple ${tribe} fixture`);
  return definition;
}

function definitionHasTribeForTest(
  definition: (typeof LIVE_MINION_DEFINITIONS)[number],
  tribe: Tribe,
): boolean {
  const tribes =
    definition.tribes ??
    (definition.tribe === "neutral" ? [] : [definition.tribe]);
  return tribes.includes(tribe) || tribes.includes("all");
}

function simpleDefinitions(count: number) {
  const definitions = LIVE_MINION_DEFINITIONS.filter(
    (candidate) =>
      candidate.collectible !== false &&
      candidate.battlecry === undefined &&
      candidate.interactiveBattlecry === undefined &&
      candidate.onPlayChoice === undefined &&
      candidate.magnetic === undefined &&
      candidate.afterSold === undefined &&
      candidate.sellDiscover === undefined,
  ).slice(0, count);
  assert.equal(definitions.length, count);
  return definitions;
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    instanceId,
    definitionId: definition.id,
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
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    effectCounters: {},
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
  };
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

function gameWithTrinket(
  cardId: string,
  seed: number,
  requiredTribe?: Tribe,
) {
  let state = createGame(seed);
  while (
    requiredTribe !== undefined &&
    !state.activeTribes.includes(requiredTribe)
  ) {
    seed += 1;
    state = createGame(seed);
  }
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(trinket, `${cardId} must be in the active pool`);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.board = [];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  state.pendingInteraction = null;
  return { state, player, template, trinket };
}

test("Nomi Tags permanently improve current and future Tavern Elementals", () => {
  for (const [cardId, amount] of [
    ["BG30_MagicItem_544", 2],
    ["BG30_MagicItem_544t", 5],
  ] as const) {
    const { state, player, template } = gameWithTrinket(cardId, 101 + amount);
    const elemental = minionDefinitionForTribe("elemental");
    const played = definitionMinion(template, elemental.id, `played-${amount}`);
    const offered = definitionMinion(template, elemental.id, `offer-${amount}`);
    const originalAttack = offered.attack;
    const originalHealth = offered.health;
    player.hand = [played];
    player.shop = [offered];

    const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const nextPlayer = humanPlayer(next);
    assert.equal(nextPlayer.shop[0]?.attack, originalAttack + amount);
    assert.equal(nextPlayer.shop[0]?.health, originalHealth + amount);
    assert.deepEqual(
      nextPlayer.tavernTypeBuffs.find(
        (buff) => buff.tribes.length === 1 && buff.tribes[0] === "elemental",
      ),
      { tribes: ["elemental"], attack: amount, health: amount },
    );
  }
});

test("Comfortable Coffins improve Undead wherever they are after Tavern Spells", () => {
  for (const [cardId, amount] of [
    ["BG30_MagicItem_547", 1],
    ["BG30_MagicItem_547t", 2],
  ] as const) {
    const { state, player, template } = gameWithTrinket(cardId, 201 + amount);
    const undead = minionDefinitionForTribe("undead");
    const boardUndead = definitionMinion(template, undead.id, `board-${amount}`);
    const handUndead = definitionMinion(template, undead.id, `hand-${amount}`);
    const boardAttack = boardUndead.attack;
    const handAttack = handUndead.attack;
    const spell = tavernSpell("tavern-spell-tavern-coin", `coin-${amount}`);
    player.board = [boardUndead];
    player.hand = [handUndead, spell];

    const next = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: spell.instanceId,
    });
    const nextPlayer = humanPlayer(next);
    assert.equal(nextPlayer.undeadArmyAttackBonus, amount);
    assert.equal(nextPlayer.board[0]?.attack, boardAttack + amount);
    const held = nextPlayer.hand.find(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    assert.equal(held?.attack, handAttack + amount);
  }
});

test("Lorewalker Scrolls buff each minion-targeted spell cast", () => {
  for (const [cardId, amount] of [
    ["BG30_MagicItem_422", 4],
    ["BG30_MagicItem_422t", 10],
  ] as const) {
    const { state, player, template } = gameWithTrinket(cardId, 301 + amount);
    const targetDefinition = simpleDefinitions(1)[0];
    const target = definitionMinion(template, targetDefinition.id, `target-${amount}`);
    const originalAttack = target.attack;
    const originalHealth = target.health;
    const gem = bloodGem(`gem-${amount}`);
    player.board = [target];
    player.hand = [gem];

    const next = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: gem.instanceId,
      targetInstanceId: target.instanceId,
    });
    const buffed = humanPlayer(next).board[0];
    assert.equal(buffed?.attack, originalAttack + 1 + amount);
    assert.equal(buffed?.health, originalHealth + 1 + amount);
  }
});

test("Murloc Manuals buff only the leftmost minion remaining in hand", () => {
  for (const [cardId, amount] of [
    ["BG30_MagicItem_914", 3],
    ["BG30_MagicItem_914t", 6],
  ] as const) {
    const { state, player, template } = gameWithTrinket(cardId, 401 + amount);
    const definitions = simpleDefinitions(3);
    const played = definitionMinion(template, definitions[0].id, `played-${amount}`);
    const left = definitionMinion(template, definitions[1].id, `left-${amount}`);
    const right = definitionMinion(template, definitions[2].id, `right-${amount}`);
    const leftStats = { attack: left.attack, health: left.health };
    const rightStats = { attack: right.attack, health: right.health };
    player.hand = [played, left, right];

    const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const [nextLeft, nextRight] = humanPlayer(next).hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    assert.equal(nextLeft?.attack, leftStats.attack + amount);
    assert.equal(nextLeft?.health, leftStats.health + amount);
    assert.equal(nextRight?.attack, rightStats.attack);
    assert.equal(nextRight?.health, rightStats.health);
  }
});

test("Booty Bay Brews trigger once for each Gold-spending transaction", () => {
  for (const [cardId, attack, health] of [
    ["BG30_MagicItem_924", 4, 3],
    ["BG30_MagicItem_924t", 6, 7],
  ] as const) {
    const { state, player, template } = gameWithTrinket(cardId, 501 + attack);
    const pirate = minionDefinitionForTribe("pirate");
    const target = definitionMinion(template, pirate.id, `pirate-${attack}`);
    const originalAttack = target.attack;
    const originalHealth = target.health;
    player.board = [target];
    player.gold = 10;
    player.tavernTier = 1;

    const next = gameReducer(state, { type: "UPGRADE_TAVERN" });
    const buffed = humanPlayer(next).board[0];
    assert.equal(buffed?.attack, originalAttack + attack);
    assert.equal(buffed?.health, originalHealth + health);
  }
});

test("Transcription Machines copy only the next two or four bought minions", () => {
  for (const [cardId, limit] of [
    ["BG35_MagicItem_931", 2],
    ["BG35_MagicItem_931t", 4],
  ] as const) {
    const prepared = gameWithTrinket(cardId, 601 + limit);
    let current = prepared.state;
    humanPlayer(current).gold = 100;
    humanPlayer(current).tavernTier = 6;
    const definitions = simpleDefinitions(limit + 1);

    for (let index = 0; index < definitions.length; index += 1) {
      const player = humanPlayer(current);
      player.shop = [
        definitionMinion(
          prepared.template,
          definitions[index].id,
          `offer-${limit}-${index}`,
        ),
      ];
      current = gameReducer(current, { type: "BUY_MINION", shopIndex: 0 });
    }

    const player = humanPlayer(current);
    for (let index = 0; index < definitions.length; index += 1) {
      assert.equal(
        player.hand.filter(
          (card) =>
            card.kind === "minion" &&
            card.definitionId === definitions[index].id,
        ).length,
        index < limit ? 2 : 1,
      );
    }
    assert.equal(player.trinketCounters[prepared.trinket.id], limit);
  }
});

test("Dragonwing Glider buffs a friendly Dragon after any played card", () => {
  const { state, player, template } = gameWithTrinket(
    "BG30_MagicItem_900",
    701,
  );
  const dragon = minionDefinitionForTribe("dragon");
  const target = definitionMinion(template, dragon.id, "glider-dragon");
  const originalAttack = target.attack;
  const originalHealth = target.health;
  const spell = tavernSpell("tavern-spell-tavern-coin", "glider-spell");
  player.board = [target];
  player.hand = [spell];

  const next = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
  });
  const buffed = humanPlayer(next).board[0];
  assert.equal(buffed?.attack, originalAttack + 4);
  assert.equal(buffed?.health, originalHealth + 4);
});

test("Spell-powered Wrench gains a Tavern Spell after a Magnetic play", () => {
  const { state, player, template } = gameWithTrinket(
    "BG32_MagicItem_170",
    702,
  );
  const magnetic = LIVE_MINION_DEFINITIONS.find(
    (candidate) =>
      candidate.magnetic !== undefined &&
      candidate.battlecry === undefined &&
      candidate.interactiveBattlecry === undefined,
  );
  assert.ok(magnetic?.magnetic);
  const targetDefinition = LIVE_MINION_DEFINITIONS.find((candidate) =>
    magnetic.magnetic?.targetTribes.some((tribe) =>
      definitionHasTribeForTest(candidate, tribe),
    ),
  );
  assert.ok(targetDefinition);
  const source = definitionMinion(template, magnetic.id, "wrench-source");
  const target = definitionMinion(
    template,
    targetDefinition.id,
    "wrench-target",
  );
  player.board = [target];
  player.hand = [source];

  const next = gameReducer(state, {
    type: "MAGNETIZE_MINION",
    cardInstanceId: source.instanceId,
    targetInstanceId: target.instanceId,
  });
  assert.equal(
    humanPlayer(next).hand.filter((card) => card.kind === "tavernSpell").length,
    1,
  );
});

test("Bloodbound Earrings apply their exact Blood Gem thresholds", () => {
  for (const [cardId, threshold, pulses] of [
    ["BG32_MagicItem_808", 4, 1],
    ["BG32_MagicItem_808t", 5, 2],
  ] as const) {
    const { state, player, template, trinket } = gameWithTrinket(
      cardId,
      710 + threshold,
    );
    const definitions = simpleDefinitions(2);
    const primary = definitionMinion(
      template,
      definitions[0].id,
      `earrings-primary-${threshold}`,
    );
    const secondary = definitionMinion(
      template,
      definitions[1].id,
      `earrings-secondary-${threshold}`,
    );
    const primaryStats = { attack: primary.attack, health: primary.health };
    const secondaryStats = { attack: secondary.attack, health: secondary.health };
    player.board = [primary, secondary];
    let current = state;
    for (let cast = 0; cast < threshold; cast += 1) {
      const gem = bloodGem(`earrings-gem-${threshold}-${cast}`);
      humanPlayer(current).hand.push(gem);
      current = gameReducer(current, {
        type: "CAST_BLOOD_GEM",
        cardInstanceId: gem.instanceId,
        targetInstanceId: primary.instanceId,
      });
    }
    const [nextPrimary, nextSecondary] = humanPlayer(current).board;
    assert.equal(nextPrimary?.attack, primaryStats.attack + threshold + pulses);
    assert.equal(nextPrimary?.health, primaryStats.health + threshold + pulses);
    assert.equal(nextSecondary?.attack, secondaryStats.attack + pulses);
    assert.equal(nextSecondary?.health, secondaryStats.health + pulses);
    assert.equal(humanPlayer(current).trinketCounters[trinket.id], 0);
  }
});

test("Bluegill Flippers buff the leftmost board and hand minions", () => {
  const { state, player, template } = gameWithTrinket(
    "BG32_MagicItem_893",
    720,
  );
  const definitions = simpleDefinitions(4);
  const boardLeft = definitionMinion(template, definitions[0].id, "blue-board-left");
  const boardRight = definitionMinion(template, definitions[1].id, "blue-board-right");
  const handLeft = definitionMinion(template, definitions[2].id, "blue-hand-left");
  const handRight = definitionMinion(template, definitions[3].id, "blue-hand-right");
  const before = [boardLeft, boardRight, handLeft, handRight].map((minion) => ({
    attack: minion.attack,
    health: minion.health,
  }));
  const spell = tavernSpell("tavern-spell-tavern-coin", "blue-spell");
  player.board = [boardLeft, boardRight];
  player.hand = [handLeft, handRight, spell];

  const next = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
  });
  const nextPlayer = humanPlayer(next);
  const held = nextPlayer.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.deepEqual(
    nextPlayer.board.map((minion) => [minion.attack, minion.health]),
    [
      [before[0].attack + 3, before[0].health + 3],
      [before[1].attack, before[1].health],
    ],
  );
  assert.deepEqual(
    held.map((minion) => [minion.attack, minion.health]),
    [
      [before[2].attack + 3, before[2].health + 3],
      [before[3].attack, before[3].health],
    ],
  );
});

test("Archaic Scroll gains a real Naga after seven spell casts", () => {
  const { state, player, template, trinket } = gameWithTrinket(
    "BG32_MagicItem_930",
    730,
    "naga",
  );
  const targetDefinition = simpleDefinitions(1)[0];
  const target = definitionMinion(template, targetDefinition.id, "scroll-target");
  player.board = [target];
  let current = state;
  for (let cast = 0; cast < 7; cast += 1) {
    const gem = bloodGem(`scroll-gem-${cast}`);
    humanPlayer(current).hand.push(gem);
    current = gameReducer(current, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: gem.instanceId,
      targetInstanceId: target.instanceId,
    });
  }
  const gained = humanPlayer(current).hand.find(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.ok(gained);
  assert.equal(
    definitionHasTribeForTest(getMinionDefinition(gained.definitionId), "naga"),
    true,
  );
  assert.equal(humanPlayer(current).trinketCounters[trinket.id], 0);
});

test("Recycling Sticker and Water Wheel share the real Elemental-play event", () => {
  const elemental = minionDefinitionForTribe("elemental");

  {
    const { state, player, template } = gameWithTrinket(
      "BG32_MagicItem_888",
      740,
    );
    player.hand = [definitionMinion(template, elemental.id, "recycle-elemental")];
    const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.equal(humanPlayer(next).freeRefreshes, 1);
  }

  {
    const { state, player, template } = gameWithTrinket(
      "BG35_MagicItem_851",
      741,
    );
    const elementalDefinitions = LIVE_MINION_DEFINITIONS.filter(
      (candidate) =>
        definitionHasTribeForTest(candidate, "elemental") &&
        candidate.battlecry === undefined &&
        candidate.interactiveBattlecry === undefined &&
        candidate.onPlayChoice === undefined &&
        candidate.magnetic === undefined,
    ).slice(0, 4);
    assert.equal(elementalDefinitions.length, 4);
    const elementals = elementalDefinitions.map((definition, index) =>
      definitionMinion(template, definition.id, `wheel-elemental-${index}`),
    );
    player.hand = elementals.slice(0, 3);
    let current = state;
    for (const minion of elementals.slice(0, 3)) {
      current = gameReducer(current, {
        type: "PLAY_HAND_CARD",
        cardInstanceId: minion.instanceId,
      });
    }
    assert.equal(
      humanPlayer(current).hand.filter((card) => card.kind === "tavernSpell").length,
      2,
    );
    current.round += 1;
    humanPlayer(current).hand.push(elementals[3]);
    current = gameReducer(current, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: elementals[3].instanceId,
    });
    assert.equal(
      humanPlayer(current).hand.filter((card) => card.kind === "tavernSpell").length,
      3,
    );
  }
});

test("Cursed Crystal stacks temporary Tavern buffs on each refresh", () => {
  const { state, player } = gameWithTrinket("BG35_MagicItem_150", 750);
  player.gold = 10;
  let current = gameReducer(state, { type: "REFRESH_SHOP" });
  let currentPlayer = humanPlayer(current);
  assert.equal(currentPlayer.tavernMinionAttackBonusThisTurn, 3);
  assert.equal(currentPlayer.tavernMinionHealthBonusThisTurn, 3);
  assert.ok(
    currentPlayer.shop.every(
      (minion) => minion.temporaryAttack === 3 && minion.temporaryHealth === 3,
    ),
  );

  current = gameReducer(current, { type: "REFRESH_SHOP" });
  currentPlayer = humanPlayer(current);
  assert.equal(currentPlayer.tavernMinionAttackBonusThisTurn, 6);
  assert.equal(currentPlayer.tavernMinionHealthBonusThisTurn, 6);
  assert.ok(
    currentPlayer.shop.every(
      (minion) => minion.temporaryAttack === 6 && minion.temporaryHealth === 6,
    ),
  );
});

test("Upstart Embers doubles exactly one highest-Health Tavern minion", () => {
  const { state, player } = gameWithTrinket("BG35_MagicItem_862", 760);
  const safe = LIVE_MINION_DEFINITIONS.find(
    (candidate) => {
      const tribes =
        candidate.tribes ??
        (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
      return (
        candidate.collectible !== false &&
      candidate.attack > 0 &&
      candidate.health > 0 &&
        candidate.afterSelfGainsAttack === undefined &&
        (tribes.length === 0 ||
          tribes.includes("all") ||
          tribes.some((tribe) => state.activeTribes.includes(tribe)))
      );
    },
  );
  assert.ok(safe);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool[safe.id] = 20;
  player.tavernTier = 6;
  player.gold = 10;

  const next = gameReducer(state, { type: "REFRESH_SHOP" });
  const offers = humanPlayer(next).shop;
  assert.ok(offers.length > 1);
  assert.equal(
    offers.filter(
      (minion) =>
        minion.attack === safe.attack * 2 && minion.health === safe.health * 2,
    ).length,
    1,
  );
  assert.equal(
    offers.filter(
      (minion) => minion.attack === safe.attack && minion.health === safe.health,
    ).length,
    offers.length - 1,
  );
});

test("Lava Lamp gains a real Elemental after every five sales", () => {
  const { state, player, template, trinket } = gameWithTrinket(
    "BG30_MagicItem_951",
    770,
    "elemental",
  );
  const soldDefinition = LIVE_MINION_DEFINITIONS.find(
    (candidate) =>
      !definitionHasTribeForTest(candidate, "elemental") &&
      candidate.afterSold === undefined &&
      candidate.sellDiscover === undefined,
  );
  assert.ok(soldDefinition);
  player.board = Array.from({ length: 5 }, (_, index) =>
    definitionMinion(template, soldDefinition.id, `lamp-sale-${index}`),
  );
  let current = state;
  for (let sale = 0; sale < 5; sale += 1) {
    current = gameReducer(current, { type: "SELL_MINION", boardIndex: 0 });
  }
  const gained = humanPlayer(current).hand.find(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.ok(gained);
  assert.equal(
    definitionHasTribeForTest(getMinionDefinition(gained.definitionId), "elemental"),
    true,
  );
  assert.equal(humanPlayer(current).trinketCounters[trinket.id], 0);
});

test("Miniature Ship buffs every friendly Pirate after a Tavern Spell", () => {
  const { state, player, template } = gameWithTrinket(
    "BG35_MagicItem_710",
    780,
  );
  const pirate = minionDefinitionForTribe("pirate");
  const target = definitionMinion(template, pirate.id, "ship-pirate");
  const originalAttack = target.attack;
  const originalHealth = target.health;
  const spell = tavernSpell("tavern-spell-tavern-coin", "ship-spell");
  player.board = [target];
  player.hand = [spell];

  const next = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
  });
  const buffed = humanPlayer(next).board[0];
  assert.equal(buffed?.attack, originalAttack + 2);
  assert.equal(buffed?.health, originalHealth + 2);
});
