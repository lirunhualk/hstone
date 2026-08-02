import assert from "node:assert/strict";
import test from "node:test";

import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  TRINKET_SPELLCRAFT_DEFINITIONS,
  createGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  getMinionPurchaseQuote,
  minionHasTribe,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type Tribe,
} from "../lib/game/engine.ts";

const JAILER_STICKER_LESSER = "BG35_MagicItem_306";
const JAILER_STICKER_GREATER = "BG35_MagicItem_733";
const OPHIDIAN_STAFF = "BG35_MagicItem_872";
const CHILLMERE_MOSAIC = "BG35_MagicItem_755";
const DOUBLE_STITCH_NEEDLE = "BG35_MagicItem_838";

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
  assert.ok(trinket, `${cardId} must be an active Trinket`);
  return trinket;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const definition = trinketForCard(cardId);
  const player = humanPlayer(state);
  player.gold = 100;
  player.maxGold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `choose-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  const next = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: `choose-${cardId}`,
    optionInstanceId: definition.id,
  });
  assert.ok(humanPlayer(next).trinketIds.includes(definition.id));
  return next;
}

function tribesOfDefinition(
  definition: (typeof LIVE_MINION_DEFINITIONS)[number],
): Tribe[] {
  return [
    ...(definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe])),
  ];
}

function definitionWithTribe(tribe: Tribe) {
  const definition = LIVE_MINION_DEFINITIONS.find(
    (candidate) =>
      candidate.tier <= 6 &&
      tribesOfDefinition(candidate).includes(tribe) &&
      !tribesOfDefinition(candidate).includes("all") &&
      candidate.deathrattle === undefined &&
      candidate.reborn !== true,
  );
  assert.ok(definition, `a simple ${tribe} minion must exist`);
  return definition;
}

function definitionWithoutTribe(tribe: Tribe) {
  const definition = LIVE_MINION_DEFINITIONS.find(
    (candidate) =>
      candidate.tier <= 6 &&
      !tribesOfDefinition(candidate).includes(tribe) &&
      !tribesOfDefinition(candidate).includes("all") &&
      candidate.deathrattle === undefined &&
      candidate.reborn !== true,
  );
  assert.ok(definition, `a simple non-${tribe} minion must exist`);
  return definition;
}

function minion(
  state: GameState,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  const definition = getMinionDefinition(definitionId);
  return {
    ...structuredClone(template),
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
    effectCounters: {},
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function trinketSpellcraft(
  player: PlayerState,
  cardId: string,
): SpellcraftSpellInstance {
  const spell = player.hand.find(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft" && card.cardId === cardId,
  );
  assert.ok(spell, `${cardId} must be in hand`);
  return spell;
}

function keepOnlyPoolDefinition(
  state: GameState,
  definitionId: string,
  copies = 10,
): void {
  for (const candidateId of Object.keys(state.pool)) {
    state.pool[candidateId] = candidateId === definitionId ? copies : 0;
  }
}

test("the Trinket Spellcraft tokens use the fixed build 247416 identities", () => {
  assert.deepEqual(
    TRINKET_SPELLCRAFT_DEFINITIONS.map((definition) => [
      definition.cardId,
      definition.name,
      definition.target,
    ]),
    [
      ["BG35_MagicItem_306t", "典狱长标签", "friendly"],
      ["BG35_MagicItem_733t", "典狱长标签", "friendly"],
      ["BG35_MagicItem_872t", "蛇首之杖", "friendly"],
      ["BG35_MagicItem_755t", "切米尔拼贴画", "none"],
      ["BG35_MagicItem_838t", "双线缝合", "friendly"],
      ["BG30_MagicItem_416t", "古神信物", "friendly"],
    ],
  );
  assert.ok(
    TRINKET_SPELLCRAFT_DEFINITIONS.every(
      (definition) => definition.randomlyGeneratable === false,
    ),
  );
});

for (const [cardId, tokenCardId, rewardCount] of [
  [JAILER_STICKER_LESSER, "BG35_MagicItem_306t", 1],
  [JAILER_STICKER_GREATER, "BG35_MagicItem_733t", 2],
] as const) {
  test(`${tokenCardId} destroys only an Undead and gets ${rewardCount} pooled Undead`, () => {
    let state = createGame(0x3060 + rewardCount);
    state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
    const undeadDefinition = definitionWithTribe("undead");
    const nonUndeadDefinition = definitionWithoutTribe("undead");
    let player = humanPlayer(state);
    player.tavernTier = 6;
    player.hand = [];
    player.board = [
      minion(state, undeadDefinition.id, "jailer-undead"),
      minion(state, nonUndeadDefinition.id, "jailer-illegal"),
    ];
    keepOnlyPoolDefinition(state, undeadDefinition.id);

    state = acquireTrinket(state, cardId);
    player = humanPlayer(state);
    const spell = trinketSpellcraft(player, tokenCardId);
    assert.deepEqual(
      getLegalSpellcraftTargetIds(state, player.id, spell),
      ["jailer-undead"],
    );

    const rejected = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: spell.instanceId,
      targetInstanceId: "jailer-illegal",
    });
    assert.equal(rejected, state);

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: spell.instanceId,
      targetInstanceId: "jailer-undead",
    });
    player = humanPlayer(state);
    assert.equal(
      player.board.some((candidate) => candidate.instanceId === "jailer-undead"),
      false,
    );
    const rewards = player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    assert.equal(rewards.length, rewardCount);
    assert.ok(rewards.every((reward) => minionHasTribe(reward, "undead")));
    assert.equal(state.pool[undeadDefinition.id], 10 - rewardCount);
  });
}

test("Ophidian Staff strictly targets a Beast and permanently grants +2/+2 and Reborn", () => {
  let state = createGame(0x8720);
  const beastDefinition = definitionWithTribe("beast");
  const nonBeastDefinition = definitionWithoutTribe("beast");
  let player = humanPlayer(state);
  player.hand = [];
  player.board = [
    minion(state, beastDefinition.id, "staff-beast", {
      attack: 5,
      health: 7,
      reborn: false,
    }),
    minion(state, nonBeastDefinition.id, "staff-illegal"),
  ];

  state = acquireTrinket(state, OPHIDIAN_STAFF);
  player = humanPlayer(state);
  const spell = trinketSpellcraft(player, "BG35_MagicItem_872t");
  assert.deepEqual(
    getLegalSpellcraftTargetIds(state, player.id, spell),
    ["staff-beast"],
  );
  assert.equal(
    gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: spell.instanceId,
      targetInstanceId: "staff-illegal",
    }),
    state,
  );

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spell.instanceId,
    targetInstanceId: "staff-beast",
  });
  const beast = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === "staff-beast",
  );
  assert.ok(beast);
  assert.equal(beast.attack, 7);
  assert.equal(beast.health, 9);
  assert.equal(beast.reborn, true);
  assert.equal(beast.temporaryAttack, 0);
  assert.equal(beast.temporaryHealth, 0);
});

test("Chillmere Mosaic refreshes a Battlecry-only Tavern whose offers cost 1", () => {
  let state = createGame(0x7550);
  let player = humanPlayer(state);
  player.hand = [];
  player.tavernTier = 6;

  state = acquireTrinket(state, CHILLMERE_MOSAIC);
  player = humanPlayer(state);
  const spell = trinketSpellcraft(player, "BG35_MagicItem_755t");
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spell.instanceId,
  });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  for (const [index, offered] of player.shop.entries()) {
    const definition = getMinionDefinition(offered.definitionId);
    assert.ok(
      definition.battlecry !== undefined ||
        definition.interactiveBattlecry !== undefined ||
        definition.printedMechanics?.includes("BATTLECRY") === true,
      `${definition.cardId} must be a Battlecry minion`,
    );
    assert.equal(getMinionPurchaseQuote(state, player.id, index)?.cost, 1);
  }

  const offered = player.shop[0];
  assert.ok(offered);
  const goldBefore = player.gold;
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBefore - 1);
  const bought = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.instanceId === offered.instanceId,
  );
  assert.ok(bought);
  assert.equal(bought.effectCounters?.chillmereMosaicCost, undefined);
});

test("Double Stitch doubles a friendly minion, moves it to hand, and locks it for one round", () => {
  let state = createGame(0x8380);
  state.round = 9;
  const definition = definitionWithoutTribe("beast");
  let player = humanPlayer(state);
  player.hand = [];
  player.board = [
    minion(state, definition.id, "double-stitch-target", {
      attack: 5,
      health: 7,
    }),
  ];

  state = acquireTrinket(state, DOUBLE_STITCH_NEEDLE);
  player = humanPlayer(state);
  const spell = trinketSpellcraft(player, "BG35_MagicItem_838t");
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spell.instanceId,
    targetInstanceId: "double-stitch-target",
  });
  player = humanPlayer(state);
  assert.equal(player.board.length, 0);
  const moved = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.instanceId === "double-stitch-target",
  );
  assert.ok(moved);
  assert.equal(moved.attack, 10);
  assert.equal(moved.health, 14);
  assert.equal(moved.playableFromRound, 10);

  assert.equal(
    gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: moved.instanceId,
    }),
    state,
  );
  state.round = 10;
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: moved.instanceId,
  });
  assert.equal(humanPlayer(state).board[0]?.instanceId, moved.instanceId);
});

test("a full hand delays Trinket Spellcraft, turn end expires it, and next turn grants a new copy", () => {
  let state = createGame(0x8721);
  state.lobbySystemsEnabled = false;
  const fillerDefinition = definitionWithoutTribe("beast");
  let player = humanPlayer(state);
  player.hand = Array.from({ length: 10 }, (_, index) =>
    minion(state, fillerDefinition.id, `full-hand-${index}`),
  );

  state = acquireTrinket(state, OPHIDIAN_STAFF);
  player = humanPlayer(state);
  assert.equal(
    player.hand.some((card) => card.kind === "spellcraft"),
    false,
  );
  assert.equal(player.pendingSpellcraft.length, 1);
  assert.equal(
    player.pendingSpellcraft[0]?.sourceTrinketDefinitionId,
    trinketForCard(OPHIDIAN_STAFF).id,
  );

  player.hand.pop();
  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  player = humanPlayer(state);
  trinketSpellcraft(player, "BG35_MagicItem_872t");
  assert.equal(player.pendingSpellcraft.length, 0);

  for (const [index, candidate] of state.players.entries()) {
    candidate.alive = index < 2;
    if (candidate.id !== state.humanPlayerId) {
      candidate.gold = 0;
      candidate.hand = [];
      candidate.board = [];
      candidate.shop = [];
      candidate.spellShop = null;
      candidate.additionalSpellShop = [];
    }
  }
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  assert.equal(
    humanPlayer(state).hand.some((card) => card.kind === "spellcraft"),
    false,
  );
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  trinketSpellcraft(humanPlayer(state), "BG35_MagicItem_872t");
});

test("AI Jailer Sticker sacrifices its weakest legal Undead", () => {
  let state = createGame(0x306a);
  state.lobbySystemsEnabled = false;
  state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
  const undeadDefinition = definitionWithTribe("undead");
  keepOnlyPoolDefinition(state, undeadDefinition.id);
  state = acquireTrinket(state, JAILER_STICKER_LESSER);

  const human = humanPlayer(state);
  const ai = state.players.find((candidate) => candidate.id !== human.id);
  assert.ok(ai);
  ai.trinketIds = [...human.trinketIds];
  ai.trinketCounters = { ...human.trinketCounters };
  ai.hand = [...human.hand];
  ai.board = [
    minion(state, undeadDefinition.id, "ai-weak-undead", {
      attack: 1,
      health: 1,
    }),
    minion(state, undeadDefinition.id, "ai-strong-undead", {
      attack: 50,
      health: 50,
    }),
  ];
  ai.gold = 0;
  ai.shop = [];
  ai.spellShop = null;
  ai.additionalSpellShop = [];
  human.trinketIds = [];
  human.trinketCounters = {};
  human.hand = [];
  human.board = [];
  for (const candidate of state.players) {
    candidate.alive = candidate.id === human.id || candidate.id === ai.id;
  }

  state = gameReducer(state, { type: "END_TURN" });
  const persistentAi = state.players.find(
    (candidate) => candidate.id === ai.id,
  );
  assert.ok(persistentAi);
  assert.equal(
    persistentAi.board.some(
      (candidate) => candidate.instanceId === "ai-weak-undead",
    ),
    false,
  );
  assert.equal(
    persistentAi.board.some(
      (candidate) => candidate.instanceId === "ai-strong-undead",
    ),
    true,
  );
});
