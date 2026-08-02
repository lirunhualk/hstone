import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  getTrinketDefinition,
  getUpgradeCost,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
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
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    poolCopies: 0,
    ...overrides,
  };
}

function acquireTrinket(state: GameState, trinketId: string): GameState {
  const definition = getTrinketDefinition(trinketId);
  const player = humanPlayer(state);
  player.gold = Math.max(player.gold, definition.cost);
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `test-${trinketId}`,
    playerId: player.id,
    sourceInstanceId: `test-source-${trinketId}`,
    trinketTier: definition.tier,
    optionIds: [trinketId],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: trinketId,
  });
}

function bloodGems(player: PlayerState): BloodGemSpellInstance[] {
  return player.hand.filter(
    (card): card is BloodGemSpellInstance => card.kind === "bloodGem",
  );
}

function tavernSpells(player: PlayerState): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance => card.kind === "tavernSpell",
  );
}

function spellcraftSpells(player: PlayerState): SpellcraftSpellInstance[] {
  return player.hand.filter(
    (card): card is SpellcraftSpellInstance => card.kind === "spellcraft",
  );
}

function tavernSpellOffer(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function handMinions(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

for (const scenario of [
  {
    label: "Lesser",
    trinketId: "lesser-trinket-bg30-magicitem-988",
    gemCount: 3,
    attackBonus: 2,
    healthBonus: 1,
  },
  {
    label: "Greater",
    trinketId: "greater-trinket-bg30-magicitem-988t",
    gemCount: 5,
    attackBonus: 3,
    healthBonus: 3,
  },
] as const) {
  test(`${scenario.label} Hoggy Bank Tag grants and improves Blood Gems`, () => {
    let state = createGame(0xc100 + scenario.gemCount);
    let player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const target = definitionMinion(
      template,
      "BG25_001",
      `gem-target-${scenario.gemCount}`,
    );
    player.board = [target];
    player.hand = [];
    const bloodGemAttackBefore = player.bloodGemAttack;
    const bloodGemHealthBefore = player.bloodGemHealth;

    state = acquireTrinket(state, scenario.trinketId);
    player = humanPlayer(state);
    assert.equal(
      player.bloodGemAttack,
      bloodGemAttackBefore + scenario.attackBonus,
    );
    assert.equal(
      player.bloodGemHealth,
      bloodGemHealthBefore + scenario.healthBonus,
    );
    assert.equal(bloodGems(player).length, scenario.gemCount);

    const gem = bloodGems(player)[0];
    assert.ok(gem);
    const attackBefore = player.board[0].attack;
    const healthBefore = player.board[0].health;
    state = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: gem.instanceId,
      targetInstanceId: target.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(
      player.board[0].attack,
      attackBefore + bloodGemAttackBefore + scenario.attackBonus,
    );
    assert.equal(
      player.board[0].health,
      healthBefore + bloodGemHealthBefore + scenario.healthBonus,
    );
  });
}

test("Artisan's Urn buffs current and future Undead wherever they are", () => {
  let state = createGame(0xc110);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const boardUndead = definitionMinion(
    template,
    "BG25_001",
    "urn-board-undead",
  );
  const handUndead = definitionMinion(
    template,
    "BG25_008",
    "urn-hand-undead",
  );
  const elemental = definitionMinion(
    template,
    "BGS_115",
    "urn-elemental",
  );
  player.board = [boardUndead, elemental];
  player.hand = [handUndead];
  const boardUndeadAttack = boardUndead.attack;
  const handUndeadAttack = handUndead.attack;
  const elementalAttack = elemental.attack;

  state = acquireTrinket(
    state,
    "greater-trinket-bg30-magicitem-989t",
  );
  player = humanPlayer(state);
  assert.equal(player.undeadArmyAttackBonus, 15);
  assert.equal(player.board[0].attack, boardUndeadAttack + 15);
  assert.equal(player.board[1].attack, elementalAttack);
  const handTarget = player.hand.find(
    (card) => card.instanceId === "urn-hand-undead",
  );
  assert.ok(handTarget?.kind === "minion");
  assert.equal(handTarget.attack, handUndeadAttack + 15);
});

test("Mystery Tombstone grows owned and future Undead at end of turn", () => {
  let state = createGame(0xc120, 999);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const boardUndead = definitionMinion(
    template,
    "BG25_001",
    "tombstone-board-undead",
  );
  const handUndead = definitionMinion(
    template,
    "BG25_008",
    "tombstone-hand-undead",
  );
  player.board = [boardUndead];
  player.hand = [handUndead];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-276",
  );
  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assert.equal(player.undeadArmyAttackBonus, 2);
  assert.equal(player.board[0].attack, boardUndead.attack + 2);
  const handTarget = player.hand.find(
    (card) => card.instanceId === "tombstone-hand-undead",
  );
  assert.ok(handTarget?.kind === "minion");
  assert.equal(handTarget.attack, handUndead.attack + 2);
});

test("Worn Treasure Map grants ten Gold after exactly two turn starts", () => {
  let state = createGame(0xc130, 999);
  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-428",
  );

  state = continueThroughCombat(state);
  let player = humanPlayer(state);
  assert.equal(
    player.trinketCounters["lesser-trinket-bg32-magicitem-428"],
    1,
  );
  assert.equal(player.gold, 4);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(
    player.trinketCounters["lesser-trinket-bg32-magicitem-428"],
    2,
  );
  assert.equal(player.gold, 15);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.gold, 6);
});

test("Sacrificial Altar removes rather than sells the warband and returns pool copies", () => {
  let state = createGame(0xc140);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.gold = 10;
  player.hand = [];
  player.board = [
    definitionMinion(template, "BGS_115", "altar-sellemental", {
      poolCopies: 1,
    }),
    definitionMinion(template, "BG25_001", "altar-undead", {
      poolCopies: 1,
    }),
  ];
  const sellementalPoolBefore = state.pool.BGS_115 ?? 0;
  const undeadPoolBefore = state.pool.BG25_001 ?? 0;

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-844",
  );
  player = humanPlayer(state);
  assert.equal(player.board.length, 0);
  assert.equal(player.hand.length, 0, "remove must not trigger Sell effects");
  assert.equal(player.gold, 15);
  assert.equal(state.pool.BGS_115, sellementalPoolBefore + 1);
  assert.equal(state.pool.BG25_001, undeadPoolBefore + 1);
});

test("Explorer's Telescope generates three eligible Tier 4 minions", () => {
  let state = createGame(0xc150);
  humanPlayer(state).hand = [];
  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-858",
  );
  const minions = humanPlayer(state).hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.equal(minions.length, 3);
  assert.ok(minions.every((minion) => minion.tier === 4));
  assert.ok(minions.every((minion) => minion.poolCopies === 0));
});

test("Magician's Top Hat generates two minions from each of Tiers 1, 2, and 3", () => {
  let state = createGame(0xc160);
  humanPlayer(state).hand = [];
  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-815",
  );
  const minions = humanPlayer(state).hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.deepEqual(
    minions.map((minion) => minion.tier).sort((left, right) => left - right),
    [1, 1, 2, 2, 3, 3],
  );
  assert.ok(minions.every((minion) => minion.poolCopies === 0));
});

test("Butcher's Sickle grants Slaughter immediately and at every turn start", () => {
  let state = createGame(0xc170, 999);
  state.activeTribes = ["undead"];
  humanPlayer(state).hand = [];

  state = acquireTrinket(
    state,
    "greater-trinket-bg30-magicitem-406",
  );
  assert.deepEqual(
    tavernSpells(humanPlayer(state)).map((spell) => spell.definitionId),
    ["tavern-spell-slaughter"],
  );

  state = continueThroughCombat(state);
  assert.deepEqual(
    tavernSpells(humanPlayer(state)).map((spell) => spell.definitionId),
    ["tavern-spell-slaughter", "tavern-spell-slaughter"],
  );
});

test("Rocking Music Box draws one Battlecry minion from the shared pool now and each turn", () => {
  let state = createGame(0xc180, 999);
  state.activeTribes = ["quilboar"];
  state.pool.BG20_100 = 10;
  const player = humanPlayer(state);
  player.hand = [];
  player.tavernTier = 1;

  state = acquireTrinket(
    state,
    "lesser-trinket-bg30-magicitem-430",
  );
  let gained = handMinions(humanPlayer(state));
  assert.equal(gained.length, 1);
  assert.equal(gained[0].poolCopies, 1);
  let definition = getMinionDefinition(gained[0].definitionId);
  assert.ok(
    definition.battlecry !== undefined ||
      definition.interactiveBattlecry !== undefined ||
      definition.printedMechanics?.includes("BATTLECRY") === true,
  );

  state = continueThroughCombat(state);
  gained = handMinions(humanPlayer(state));
  assert.equal(gained.length, 2);
  assert.ok(gained.every((minion) => minion.poolCopies === 1));
  definition = getMinionDefinition(gained[1].definitionId);
  assert.ok(
    definition.battlecry !== undefined ||
      definition.interactiveBattlecry !== undefined ||
      definition.printedMechanics?.includes("BATTLECRY") === true,
  );
});

test("Sellemental Portrait generates a Sellemental now and at every turn start", () => {
  let state = createGame(0xc190, 999);
  state.activeTribes = ["elemental"];
  const poolBefore = state.pool.BGS_115 ?? 0;
  humanPlayer(state).hand = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-831",
  );
  state = continueThroughCombat(state);

  const gained = handMinions(humanPlayer(state));
  assert.deepEqual(
    gained.map((minion) => minion.definitionId),
    ["BGS_115", "BGS_115"],
  );
  assert.ok(gained.every((minion) => minion.poolCopies === 0));
  assert.equal(state.pool.BGS_115 ?? 0, poolBefore);
});

test("Golden Locket gilds one non-Golden Tier 4-or-lower friendly minion now and each turn", () => {
  let state = createGame(0xc1a0, 999);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const firstEligible = definitionMinion(
    template,
    "BGS_115",
    "locket-first",
    { attack: 10, health: 12 },
  );
  const ineligible = definitionMinion(
    template,
    "BG28_551",
    "locket-tier-five",
  );
  player.board = [firstEligible, ineligible];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-951",
  );
  player = humanPlayer(state);
  assert.equal(player.board[0].golden, true);
  assert.equal(player.board[0].attack, 13);
  assert.equal(player.board[0].health, 15);
  assert.equal(player.board[0].grantsTripleReward, false);
  assert.equal(player.board[1].golden, false);

  player.board.push(
    definitionMinion(
      template,
      "BG25_001",
      "locket-second",
    ),
  );
  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.board[0].golden, true);
  assert.equal(player.board[1].golden, false);
  assert.equal(player.board[2].golden, true);
});

test("Scrap Scrapper Sticker draws a Magnetic Mech from the shared pool now and each turn", () => {
  let state = createGame(0xc1b0, 999);
  state.activeTribes = ["mech"];
  state.pool.BG26_146 = 10;
  const poolBefore = state.pool.BG26_146;
  const player = humanPlayer(state);
  player.hand = [];
  player.tavernTier = 1;

  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-301",
  );
  assert.equal(state.pool.BG26_146, poolBefore - 1);
  state = continueThroughCombat(state);

  const gained = handMinions(humanPlayer(state));
  assert.deepEqual(
    gained.map((minion) => minion.definitionId),
    ["BG26_146", "BG26_146"],
  );
  assert.ok(gained.every((minion) => minion.poolCopies === 1));
});

test("Conch Portrait grants Clone Horn now and once every two turn starts", () => {
  let state = createGame(0xc1c0, 999);
  state.activeTribes = ["murloc"];
  humanPlayer(state).hand = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-305",
  );
  assert.deepEqual(
    tavernSpells(humanPlayer(state)).map((spell) => spell.definitionId),
    ["tavern-spell-clone-horn"],
  );

  state = continueThroughCombat(state);
  assert.equal(tavernSpells(humanPlayer(state)).length, 1);
  assert.equal(
    humanPlayer(state).trinketCounters[
      "lesser-trinket-bg35-magicitem-305"
    ],
    1,
  );

  state = continueThroughCombat(state);
  assert.deepEqual(
    tavernSpells(humanPlayer(state)).map((spell) => spell.definitionId),
    ["tavern-spell-clone-horn", "tavern-spell-clone-horn"],
  );
  assert.equal(
    humanPlayer(state).trinketCounters[
      "lesser-trinket-bg35-magicitem-305"
    ],
    0,
  );
});

test("Chromatic Tear generates a random Chromatic Whelp now and each turn", () => {
  let state = createGame(0xc1d0, 999);
  state.activeTribes = ["dragon"];
  humanPlayer(state).hand = [];
  const chromaticWhelps = new Set([
    "BG34_634t",
    "BG34_635t",
    "BG34_636t",
    "BG34_637t",
    "BG34_638t",
  ]);

  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-840",
  );
  state = continueThroughCombat(state);

  const gained = handMinions(humanPlayer(state));
  assert.equal(gained.length, 2);
  assert.ok(
    gained.every((minion) =>
      chromaticWhelps.has(minion.definitionId),
    ),
  );
  assert.ok(gained.every((minion) => minion.poolCopies === 0));
});

test("Sunken Anchor generates two random Bounties now and each turn", () => {
  let state = createGame(0xc1e0, 999);
  state.activeTribes = ["pirate"];
  humanPlayer(state).hand = [];
  const bountyIds = new Set([
    "tavern-spell-friendly-bounty",
    "tavern-spell-healthy-bounty",
    "tavern-spell-hostile-bounty",
    "tavern-spell-selfish-bounty",
    "tavern-spell-wealthy-bounty",
  ]);

  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-890",
  );
  assert.equal(tavernSpells(humanPlayer(state)).length, 2);
  assert.ok(
    tavernSpells(humanPlayer(state)).every((spell) =>
      bountyIds.has(spell.definitionId),
    ),
  );

  state = continueThroughCombat(state);
  assert.equal(tavernSpells(humanPlayer(state)).length, 4);
  assert.ok(
    tavernSpells(humanPlayer(state)).every((spell) =>
      bountyIds.has(spell.definitionId),
    ),
  );
});

test("Azeroth Globe grants two Gold and opens a Tier 6 Discover every two turn starts", () => {
  let state = createGame(0xc1f0, 999);
  humanPlayer(state).hand = [];
  state = acquireTrinket(
    state,
    "lesser-trinket-bg30-magicitem-425",
  );

  state = continueThroughCombat(state);
  assert.equal(
    humanPlayer(state).trinketCounters[
      "lesser-trinket-bg30-magicitem-425"
    ],
    1,
  );
  assert.equal(state.pendingInteraction, null);

  state = continueThroughCombat(state);
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.ok(pending.options.length > 0);
  assert.ok(pending.options.every((option) => option.tier === 6));
  assert.equal(humanPlayer(state).gold, 7);
  assert.equal(
    humanPlayer(state).trinketCounters[
      "lesser-trinket-bg30-magicitem-425"
    ],
    0,
  );

  const selected = pending.options[0];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  const gained = handMinions(humanPlayer(state));
  assert.equal(gained.length, 1);
  assert.equal(gained[0].tier, 6);
  assert.equal(gained[0].poolCopies, 1);
});

test("Replica Pendant makes an unenchanted non-Golden plain copy now and each turn", () => {
  let state = createGame(0xc200, 999);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const source = definitionMinion(
    template,
    "BGS_115",
    "replica-source",
    {
      attack: 99,
      health: 88,
      golden: true,
      taunt: true,
      divineShield: true,
      bloodGemAttack: 40,
      bloodGemHealth: 30,
      poolCopies: 0,
    },
  );
  player.board = [source];
  player.hand = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg30-magicitem-706",
  );
  state = continueThroughCombat(state);
  player = humanPlayer(state);
  const copies = handMinions(player);
  const base = getMinionDefinition("BGS_115");
  assert.equal(copies.length, 2);
  assert.ok(copies.every((copy) => copy.definitionId === base.id));
  assert.ok(copies.every((copy) => copy.golden === false));
  assert.ok(copies.every((copy) => copy.attack === base.attack));
  assert.ok(copies.every((copy) => copy.health === base.health));
  assert.ok(copies.every((copy) => copy.poolCopies === 0));
});

test("Rendle Tag steals the highest-Tier Tavern card and repeats with end-of-turn multipliers", () => {
  let state = createGame(0xc210, 999);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.hand = [];
  player.shop = [
    definitionMinion(template, "BGS_115", "rendle-low", {
      poolCopies: 1,
    }),
  ];
  const spellDefinitionId = "tavern-spell-clone-horn";
  state.spellPool[spellDefinitionId] = 4;
  player.spellShop = tavernSpellOffer(
    spellDefinitionId,
    "rendle-high-spell",
  );
  state.spellPool[spellDefinitionId] -= 1;
  player.additionalSpellShop = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-817",
  );
  player = humanPlayer(state);
  assert.equal(player.hand[0]?.instanceId, "rendle-high-spell");
  assert.equal(state.spellPool[spellDefinitionId], 4);
  assert.equal(player.shop[0]?.instanceId, "rendle-low");

  const dakkari = definitionMinion(
    template,
    "BG26_ICC_901",
    "rendle-dakkari",
  );
  const tierFour = definitionMinion(
    template,
    "defender-of-argus",
    "rendle-tier-four",
    { poolCopies: 1 },
  );
  const tierOne = definitionMinion(
    template,
    "BGS_115",
    "rendle-tier-one",
    { poolCopies: 1 },
  );
  player.board = [dakkari];
  player.shop = [tierOne, tierFour];
  player.spellShop = null;
  player.additionalSpellShop = [];

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 0);
  assert.ok(
    player.hand.some((card) => card.instanceId === "rendle-tier-four"),
  );
  assert.ok(
    player.hand.some((card) => card.instanceId === "rendle-tier-one"),
  );
});

test("Rendle Tag leaves the Tavern unchanged when the hand is full", () => {
  let state = createGame(0xc220);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(
      template,
      "BGS_115",
      `rendle-full-hand-${index}`,
    ),
  );
  player.shop = [
    definitionMinion(template, "defender-of-argus", "rendle-stays"),
  ];
  player.spellShop = null;
  player.additionalSpellShop = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-817",
  );
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(player.shop[0]?.instanceId, "rendle-stays");
});

test("Statue of Azshara generates three eligible Spellcraft spells now and each turn", () => {
  let state = createGame(0xc230, 999);
  const player = humanPlayer(state);
  player.tavernTier = 3;
  player.hand = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-931",
  );
  let spells = spellcraftSpells(humanPlayer(state));
  assert.equal(spells.length, 3);
  assert.ok(
    spells.every((spell) => {
      const definition = getSpellcraftDefinition(spell.definitionId);
      return (
        definition.sourceTier <= 3 &&
        definition.randomlyGeneratable !== false
      );
    }),
  );
  const originalIds = new Set(spells.map((spell) => spell.instanceId));

  state = continueThroughCombat(state);
  spells = spellcraftSpells(humanPlayer(state));
  assert.equal(spells.length, 3, "old Spellcraft expires before the next three");
  assert.ok(spells.every((spell) => !originalIds.has(spell.instanceId)));
});

test("Jewelry Box Blood Gems persist through saves and grant their rolled Quilboar keyword", () => {
  let state = createGame(0xc240, 999);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG20_100",
    "jewelry-box-target",
  );
  player.board = [target];
  player.hand = [];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-434",
  );
  let gems = bloodGems(humanPlayer(state));
  assert.equal(gems.length, 1);
  const gem = gems[0];
  assert.ok(
    gem.bonusKeyword === "tauntForQuilboar" ||
      gem.bonusKeyword === "divineShieldForQuilboar" ||
      gem.bonusKeyword === "rebornForQuilboar",
  );
  state = JSON.parse(JSON.stringify(state)) as GameState;
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: gem.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const buffed = player.board[0];
  if (gem.bonusKeyword === "tauntForQuilboar") {
    assert.equal(buffed.taunt, true);
  } else if (gem.bonusKeyword === "divineShieldForQuilboar") {
    assert.equal(buffed.divineShield, true);
  } else {
    assert.equal(buffed.reborn, true);
  }

  state = continueThroughCombat(state);
  gems = bloodGems(humanPlayer(state));
  assert.equal(gems.length, 1);
});

for (const scenario of [
  {
    label: "Lesser Bag of Whistles",
    trinketId: "lesser-trinket-bg35-magicitem-850",
    initialPulses: 1,
    startCasts: 1,
  },
  {
    label: "Greater Bag of Whistles",
    trinketId: "greater-trinket-bg35-magicitem-850t",
    initialPulses: 4,
    startCasts: 2,
  },
] as const) {
  test(`${scenario.label} keeps Ride the Wind pulses independent from spell-cast counts`, () => {
    let state = createGame(0xc250 + scenario.initialPulses, 999);
    humanPlayer(state).hand = [];

    state = acquireTrinket(state, scenario.trinketId);
    let player = humanPlayer(state);
    assert.deepEqual(
      player.rideTheWindBuffs,
      Array.from({ length: scenario.initialPulses }, () => ({
        attack: 6,
        health: 6,
      })),
    );
    assert.equal(player.tavernSpellsCast, 1);
    assert.equal(player.tavernSpellsCastThisTurn, 1);

    state = continueThroughCombat(state);
    player = humanPlayer(state);
    assert.equal(
      player.rideTheWindBuffs.length,
      scenario.initialPulses + scenario.startCasts,
    );
    assert.ok(
      player.rideTheWindBuffs.every(
        (buff) => buff.attack === 6 && buff.health === 6,
      ),
    );
    assert.equal(player.tavernSpellsCast, 1 + scenario.startCasts);
    assert.equal(player.tavernSpellsCastThisTurn, scenario.startCasts);
  });
}

test("Mutation Shrine replaces the whole warband with exact Tier 4 shared-pool minions", () => {
  let state = createGame(0xc260);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG24_018 = 1;
  state.pool.BG_DAL_775 = 1;
  state.pool.BGS_115 = 0;
  state.pool.BG20_100 = 0;
  player.hand = [];
  player.board = [
    definitionMinion(template, "BGS_115", "mutation-first", {
      attack: 99,
      health: 99,
      bloodGemAttack: 50,
      bloodGemHealth: 50,
      taunt: true,
      poolCopies: 1,
    }),
    definitionMinion(template, "BG20_100", "mutation-second", {
      attack: 77,
      health: 66,
      divineShield: true,
      poolCopies: 1,
    }),
  ];

  state = acquireTrinket(
    state,
    "lesser-trinket-bg32-magicitem-400",
  );
  player = humanPlayer(state);
  assert.deepEqual(
    new Set(player.board.map((minion) => minion.definitionId)),
    new Set(["BG24_018", "BG_DAL_775"]),
  );
  assert.deepEqual(
    player.board.map((minion) => minion.instanceId),
    ["mutation-first", "mutation-second"],
  );
  for (const minion of player.board) {
    const definition = getMinionDefinition(minion.definitionId);
    assert.equal(minion.tier, 4);
    assert.equal(minion.attack, definition.attack);
    assert.equal(minion.health, definition.health);
    assert.equal(minion.golden, false);
    assert.equal(minion.poolCopies, 1);
    assert.equal(minion.bloodGemAttack, 0);
    assert.equal(minion.bloodGemHealth, 0);
  }
  assert.equal(state.pool.BGS_115, 1);
  assert.equal(state.pool.BG20_100, 1);
  assert.equal(state.pool.BG24_018, 0);
  assert.equal(state.pool.BG_DAL_775, 0);
});

test("Fully Loaded Wallet pays exactly twelve Gold on the first upgrade to Tier 6", () => {
  let state = createGame(0xc270);
  state = acquireTrinket(
    state,
    "lesser-trinket-bg35-magicitem-814",
  );
  let player = humanPlayer(state);
  player.tavernTier = 5;
  player.upgradeDiscount = 0;
  player.gold = getUpgradeCost(state, player.id);

  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 6);
  assert.equal(player.gold, 12);

  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.equal(humanPlayer(state).gold, 12);
});
