import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getUpgradeCost,
  minionHasTribe,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
  isBountyTavernSpellDefinitionId,
} from "../lib/game/content.ts";
import { getTavernSpellDefinition } from "../lib/game/tavern-spells.ts";
import type { TavernSpellInstance, Tribe } from "../lib/game/types.ts";

const MRRGLTON_IDS = new Set(["BG35_140", "BG35_141"]);

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function trinketForCard(cardId: string) {
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(trinket, `${cardId} must be active`);
  return trinket;
}

function gameWithTrinkets(cardIds: readonly string[], seed: number) {
  const state = createGame(seed);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const trinkets = cardIds.map(trinketForCard);
  player.trinketIds = trinkets.map((trinket) => trinket.id);
  player.trinketCounters = Object.fromEntries(
    trinkets.map((trinket) => [trinket.id, 0]),
  );
  player.board = [];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  state.pendingInteraction = null;
  return { state, player, template, trinkets };
}

function acquireTrinketByCardId(state: GameState, cardId: string): GameState {
  const trinket = trinketForCard(cardId);
  const player = humanPlayer(state);
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `acquire-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `source-${cardId}`,
    trinketTier: trinket.tier,
    optionIds: [trinket.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: trinket.id,
  });
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    kind: "minion",
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
    stealth: definition.stealth === true,
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

function simpleTribeDefinition(tribe: Tribe) {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return (
      tribes.includes(tribe) &&
      candidate.collectible !== false &&
      candidate.battlecry === undefined &&
      candidate.interactiveBattlecry === undefined &&
      candidate.onPlayChoice === undefined &&
      candidate.magnetic === undefined &&
      candidate.spellcraft === undefined &&
      candidate.afterFriendlyPlayed === undefined &&
      candidate.afterSelfGainsAttack === undefined &&
      candidate.afterGoldSpent === undefined
    );
  });
  assert.ok(definition, `a simple ${tribe} minion must exist`);
  return definition;
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

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function bountyCount(player: PlayerState): number {
  return player.hand.filter(
    (card) =>
      card.kind === "tavernSpell" &&
      isBountyTavernSpellDefinitionId(card.definitionId),
  ).length;
}

test("fourth-batch generated-card Trinkets grant their exact acquisition rewards", () => {
  for (const [cardId, expectedDefinitionIds] of [
    ["BG30_MagicItem_868", ["BG26_174", "BGS_004"]],
    ["BG32_MagicItem_830", ["BG25_041"]],
    ["BG35_MagicItem_151", ["BG35_151"]],
    ["BG35_MagicItem_151t", ["BG35_151"]],
    ["BG31_MagicItem_903", ["tavern-spell-knockoff-wisdomball"]],
    ["BG32_MagicItem_283", ["BG28_741"]],
    ["BG35_MagicItem_861", ["tavern-spell-temperature-shift"]],
  ] as const) {
    let state = createGame(cardId.length * 211);
    humanPlayer(state).hand = [];
    state = acquireTrinketByCardId(state, cardId);
    assert.deepEqual(
      humanPlayer(state).hand.map((card) => card.definitionId).sort(),
      [...expectedDefinitionIds].sort(),
      cardId,
    );
  }
});

test("Rewinder Portrait makes each Soul Rewinder gain matching Attack", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG30_MagicItem_868"],
    0xd401,
  );
  const rewinder = definitionMinion(template, "BG26_174", "rewinder");
  const wrathWeaver = definitionMinion(template, "BGS_004", "weaver");
  const demon = definitionMinion(template, "BG25_041", "played-demon");
  const statsBefore = { attack: rewinder.attack, health: rewinder.health };
  const healthBefore = player.health;
  player.board = [rewinder, wrathWeaver];
  player.hand = [demon];

  const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const nextRewinder = humanPlayer(next).board.find(
    (minion) => minion.instanceId === rewinder.instanceId,
  );
  assert.ok(nextRewinder);
  assert.equal(nextRewinder.attack, statsBefore.attack + 1);
  assert.equal(nextRewinder.health, statsBefore.health + 1);
  assert.equal(humanPlayer(next).health, healthBefore);
});

test("Fellemental Portrait adds an extra +2/+2 to every Fellemental pulse", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG32_MagicItem_830"],
    0xd402,
  );
  const shopTarget = definitionMinion(
    template,
    simpleTribeDefinition("murloc").id,
    "fellemental-shop-target",
  );
  const fellemental = definitionMinion(
    template,
    "BG25_041",
    "portrait-fellemental",
  );
  const before = { attack: shopTarget.attack, health: shopTarget.health };
  player.shop = [shopTarget];
  player.hand = [fellemental];

  const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(humanPlayer(next).tavernMinionAttackBonus, 4);
  assert.equal(humanPlayer(next).tavernMinionHealthBonus, 3);
  assert.equal(humanPlayer(next).shop[0]?.attack, before.attack + 4);
  assert.equal(humanPlayer(next).shop[0]?.health, before.health + 3);
});

test("both Defiler Portrait tiers apply their pinned Demon Fodder bonuses", () => {
  for (const [cardId, portraitBonus] of [
    ["BG35_MagicItem_151", 4],
    ["BG35_MagicItem_151t", 15],
  ] as const) {
    const { state, player, template } = gameWithTrinkets(
      [cardId],
      0xd410 + portraitBonus,
    );
    const defiler = definitionMinion(
      template,
      "BG35_151",
      `defiler-${portraitBonus}`,
    );
    const before = { attack: defiler.attack, health: defiler.health };
    player.board = [defiler];

    const recruit = gameReducer(continueThroughCombat(state), {
      type: "REFRESH_SHOP",
    });
    const nextDefiler = humanPlayer(recruit).board.find(
      (minion) => minion.instanceId === defiler.instanceId,
    );
    assert.ok(nextDefiler);
    assert.equal(nextDefiler.attack, before.attack + 2 + portraitBonus);
    assert.equal(nextDefiler.health, before.health + 2 + portraitBonus);
  }
});

test("Errgl Sticker grants one Mrrglton now and at every turn start", () => {
  let state = createGame(0xd403);
  humanPlayer(state).hand = [];
  state = acquireTrinketByCardId(state, "BG35_MagicItem_309");
  assert.equal(
    humanPlayer(state).hand.filter(
      (card) => card.kind === "minion" && MRRGLTON_IDS.has(card.definitionId),
    ).length,
    1,
  );

  state = continueThroughCombat(state);
  assert.equal(
    humanPlayer(state).hand.filter(
      (card) => card.kind === "minion" && MRRGLTON_IDS.has(card.definitionId),
    ).length,
    2,
  );
});

test("Bronzebeard Portrait grants both cards and types every owned Brann", () => {
  let state = createGame(0xd404);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const existingBrann = definitionMinion(
    template,
    "BG_LOE_077",
    "existing-brann",
  );
  player.board = [existingBrann];
  player.hand = [];

  state = acquireTrinketByCardId(state, "BG30_MagicItem_418");
  player = humanPlayer(state);
  const ownedBranns = [
    ...player.board,
    ...player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
  ].filter((minion) => minion.definitionId === "BG_LOE_077");
  assert.equal(ownedBranns.length, 2);
  assert.ok(
    ownedBranns.every(
      (brann) => minionHasTribe(brann, "murloc") && minionHasTribe(brann, "dragon"),
    ),
  );
  assert.equal(
    player.hand.filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId !== "BG_LOE_077" &&
        (getMinionDefinition(card.definitionId).battlecry !== undefined ||
          getMinionDefinition(card.definitionId).interactiveBattlecry !==
            undefined ||
          getMinionDefinition(card.definitionId).printedMechanics?.includes(
            "BATTLECRY",
          ) === true),
    ).length,
    1,
  );
});

test("Colorful Compass repeats a random minion of the warband's majority type", () => {
  let state = createGame(0xd405);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG22_202", "compass-murloc"),
  ];
  player.hand = [];

  state = acquireTrinketByCardId(state, "BG30_MagicItem_426");
  assert.equal(humanPlayer(state).hand.length, 1);
  assert.ok(
    humanPlayer(state).hand.every(
      (card) => card.kind === "minion" && minionHasTribe(card, "murloc"),
    ),
  );

  state = continueThroughCombat(state);
  assert.equal(humanPlayer(state).hand.length, 2);
  assert.ok(
    humanPlayer(state).hand.every(
      (card) => card.kind === "minion" && minionHasTribe(card, "murloc"),
    ),
  );
});

test("Wisdomball Supply repeats Knockoff Wisdomball at turn start", () => {
  let state = createGame(0xd406);
  humanPlayer(state).hand = [];
  state = acquireTrinketByCardId(state, "BG31_MagicItem_903");
  state = continueThroughCombat(state);
  assert.equal(
    humanPlayer(state).hand.filter(
      (card) => card.definitionId === "tavern-spell-knockoff-wisdomball",
    ).length,
    2,
  );
});

test("Czarina Portrait makes Charging Czarinas grant equal Health", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG32_MagicItem_283"],
    0xd407,
  );
  const czarina = definitionMinion(template, "BG28_741", "czarina");
  const shielded = definitionMinion(
    template,
    simpleTribeDefinition("dragon").id,
    "shielded-target",
  );
  shielded.divineShield = true;
  const before = { attack: shielded.attack, health: shielded.health };
  player.board = [czarina, shielded];
  player.hand = [tavernSpell("tavern-spell-tavern-coin", "czarina-coin")];

  const next = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "czarina-coin",
  });
  assert.equal(humanPlayer(next).board[1]?.attack, before.attack + 4);
  assert.equal(humanPlayer(next).board[1]?.health, before.health + 4);
});

test("Privateer Portrait grants two Bounties now and at every turn start", () => {
  let state = createGame(0xd408);
  state.activeTribes = [...new Set([...state.activeTribes, "pirate" as const])];
  humanPlayer(state).hand = [];
  state = acquireTrinketByCardId(state, "BG35_MagicItem_712");
  assert.equal(
    humanPlayer(state).hand.filter(
      (card) => card.kind === "minion" && card.definitionId === "BG33_825",
    ).length,
    1,
  );
  assert.equal(bountyCount(humanPlayer(state)), 2);

  state = continueThroughCombat(state);
  assert.equal(bountyCount(humanPlayer(state)), 4);
});

test("Baller Portrait repeats Temperature Shift after each ten Elementals", () => {
  const prepared = gameWithTrinkets(["BG35_MagicItem_861"], 0xd409);
  let state = prepared.state;
  const elementalDefinition = simpleTribeDefinition("elemental");

  for (let played = 0; played < 10; played += 1) {
    const player = humanPlayer(state);
    player.board = [];
    player.hand = [
      definitionMinion(
        prepared.template,
        elementalDefinition.id,
        `baller-elemental-${played}`,
      ),
    ];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  }

  assert.equal(
    humanPlayer(state).hand.filter(
      (card) => card.definitionId === "tavern-spell-temperature-shift",
    ).length,
    1,
  );
});

test("Nazjatar Postcard creates one random Spellcraft card after a Naga", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG30_MagicItem_919"],
    0xd40a,
  );
  player.hand = [
    definitionMinion(
      template,
      simpleTribeDefinition("naga").id,
      "postcard-naga",
    ),
  ];

  const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(
    humanPlayer(next).hand.filter((card) => card.kind === "spellcraft").length,
    1,
  );
});

test("Aggem Sticker uses seven Blood Gems on one minion of each type", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG32_MagicItem_284"],
    0xd40b,
  );
  const murloc = definitionMinion(template, "BG32_330", "aggem-murloc");
  const dragon = definitionMinion(template, "BG34_630", "aggem-dragon");
  const before = new Map(
    [murloc, dragon].map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  player.board = [murloc, dragon];

  const combat = gameReducer(state, { type: "END_TURN" });
  for (const minion of humanPlayer(combat).board) {
    const previous = before.get(minion.instanceId);
    assert.ok(previous);
    assert.equal(minion.attack, previous.attack + 7);
    assert.equal(minion.health, previous.health + 7);
  }
});

test("Drakkari Portrait makes end-of-turn effects trigger one extra time", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG32_MagicItem_367"],
    0xd40c,
  );
  const defiler = definitionMinion(template, "BG35_151", "drakkari-defiler");
  const before = { attack: defiler.attack, health: defiler.health };
  player.board = [defiler];

  const recruit = gameReducer(continueThroughCombat(state), {
    type: "REFRESH_SHOP",
  });
  const nextDefiler = humanPlayer(recruit).board.find(
    (minion) => minion.instanceId === defiler.instanceId,
  );
  assert.ok(nextDefiler);
  assert.equal(nextDefiler.attack, before.attack + 4);
  assert.equal(nextDefiler.health, before.health + 4);
});

test("Shark Cannon tracks Gold across transactions and improves each pulse", () => {
  const prepared = gameWithTrinkets(["BG32_MagicItem_232"], 0xd40d);
  let state = prepared.state;
  const pirate = definitionMinion(
    prepared.template,
    simpleTribeDefinition("pirate").id,
    "shark-cannon-pirate",
  );
  const before = { attack: pirate.attack, health: pirate.health };
  prepared.player.board = [pirate];
  prepared.player.gold = 100;

  for (let threshold = 1; threshold <= 2; threshold += 1) {
    const upgradeCost = getUpgradeCost(state, humanPlayer(state).id);
    state = gameReducer(state, { type: "UPGRADE_TAVERN" });
    for (let spent = upgradeCost; spent < 10; spent += 1) {
      state = gameReducer(state, { type: "REFRESH_SHOP" });
    }
    const target = humanPlayer(state).board[0];
    assert.ok(target);
    const totalBuff = threshold === 1 ? 1 : 3;
    assert.equal(target.attack, before.attack + totalBuff);
    assert.equal(target.health, before.health + totalBuff);
  }
});
