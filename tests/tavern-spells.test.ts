import assert from "node:assert/strict";
import test from "node:test";

import {
  TAVERN_SPELL_DEFINITIONS,
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
  type TavernTier,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_5_CONTENT_VERSION,
  LEGACY_SCHEMA_6_CONTENT_VERSION,
  migrateSchema5GameState,
  migrateSchema6GameState,
} from "../lib/game/save.ts";

const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
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

function replaceSpellOffer(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  instanceId = `controlled-${definitionId}`,
): TavernSpellInstance {
  if (player.spellShop) {
    state.spellPool[player.spellShop.definitionId] =
      (state.spellPool[player.spellShop.definitionId] ?? 0) + 1;
  }
  assert.ok(
    (state.spellPool[definitionId] ?? 0) > 0,
    `${definitionId} must have an available pool copy`,
  );
  state.spellPool[definitionId] -= 1;
  const spell = tavernSpell(definitionId, instanceId);
  player.spellShop = spell;
  return spell;
}

function totalSpellCopies(state: GameState, definitionId: string): number {
  return (
    (state.spellPool[definitionId] ?? 0) +
    state.players.filter(
      (player) => player.spellShop?.definitionId === definitionId,
    ).length
  );
}

function firstXorshiftRandom(seed: number): number {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x1_0000_0000;
}

function seedForRoll(roll: number, total: number): number {
  for (let seed = 1; seed < 1_000_000; seed += 1) {
    if (Math.floor(firstXorshiftRandom(seed) * total) === roll) {
      return seed;
    }
  }
  throw new Error(`Could not find deterministic seed for roll ${roll}/${total}`);
}

function controlledWeightedSpellDraw(rngState: number): GameState {
  const state = createGame(0x7100);
  const player = humanPlayer(state);
  player.gold = 1;
  player.shop = [];
  player.spellShop = null;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
  state.spellPool["tavern-spell-new-sprout"] = 1;
  state.spellPool["tavern-spell-enchanted-lasso"] = 3;
  state.rngState = rngState;
  return gameReducer(state, { type: "REFRESH_SHOP" });
}

function legacyState(
  version: 5 | 6,
  seed: number,
): Record<string, unknown> {
  const current = createGame(seed);
  current.players.forEach((player, index) => {
    player.tavernTier = ((index % 6) + 1) as TavernTier;
  });
  humanPlayer(current).gold = 7;
  const legacy = jsonClone(current) as unknown as Record<string, unknown>;
  legacy.version = version;
  legacy.contentVersion =
    version === 5
      ? LEGACY_SCHEMA_5_CONTENT_VERSION
      : LEGACY_SCHEMA_6_CONTENT_VERSION;
  delete legacy.spellPool;
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  for (const player of players) {
    assert.ok(player !== null && typeof player === "object");
    const record = player as Record<string, unknown>;
    delete record.spellShop;
    delete record.maxGold;
    delete record.pendingNextTurnGold;
    delete record.freeRefreshes;
    delete record.tavernMinionAttackBonus;
    delete record.tavernMinionHealthBonus;
    delete record.nextCombatAttackBonus;
    delete record.nextCombatHealthBonus;
    delete record.backToBackBonus;
    if (version === 5) {
      delete record.bloodGemAttack;
      delete record.bloodGemHealth;
    }
  }
  return legacy;
}

function assertMigratedSchema7(value: unknown): asserts value is GameState {
  assert.ok(value !== null && typeof value === "object");
  const migrated = value as GameState;
  assert.equal(migrated.version, 7);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(humanPlayer(migrated).gold, 7);
  assert.equal(
    new Set(
      migrated.players.map((player) => player.spellShop?.instanceId),
    ).size,
    migrated.players.length,
  );
  for (const player of migrated.players) {
    assert.ok(player.spellShop);
    assert.ok(player.spellShop.tier <= player.tavernTier);
    assert.equal(player.maxGold, 10);
    assert.equal(player.pendingNextTurnGold, 0);
    assert.equal(player.freeRefreshes, 0);
    assert.equal(player.tavernMinionAttackBonus, 0);
    assert.equal(player.tavernMinionHealthBonus, 0);
    assert.equal(player.nextCombatAttackBonus, 0);
    assert.equal(player.nextCombatHealthBonus, 0);
    assert.equal(player.backToBackBonus, 0);
  }
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(migrated, definition.id),
      SPELL_POOL_COPIES_BY_TIER[definition.tier],
      `${definition.name} must conserve its shared pool during migration`,
    );
  }
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)), migrated);
}

test("every player gets an independent, tier-legal Tavern Spell offer", () => {
  const state = createGame(0x7110);
  const offers = state.players.map((player) => {
    assert.ok(player.spellShop);
    assert.equal(player.spellShop.spellFamily, "tavern");
    assert.ok(player.spellShop.tier <= player.tavernTier);
    return player.spellShop.instanceId;
  });
  assert.equal(new Set(offers).size, state.players.length);

  for (let tier = 1; tier <= 6; tier += 1) {
    const tierState = createGame(0x7120 + tier);
    const player = humanPlayer(tierState);
    player.tavernTier = tier as TavernTier;
    player.gold = 20;
    const refreshed = gameReducer(tierState, { type: "REFRESH_SHOP" });
    const offer = humanPlayer(refreshed).spellShop;
    assert.ok(offer);
    assert.ok(offer.tier <= tier);
  }
});

test("the shared Tavern Spell pool is tier-weighted and reserves shop offers", () => {
  const state = createGame(0x7130);
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(state, definition.id),
      SPELL_POOL_COPIES_BY_TIER[definition.tier],
    );
  }

  const lowRoll = controlledWeightedSpellDraw(seedForRoll(0, 4));
  assert.equal(
    humanPlayer(lowRoll).spellShop?.definitionId,
    "tavern-spell-new-sprout",
  );
  for (const roll of [1, 2, 3]) {
    const weighted = controlledWeightedSpellDraw(seedForRoll(roll, 4));
    assert.equal(
      humanPlayer(weighted).spellShop?.definitionId,
      "tavern-spell-enchanted-lasso",
      `weighted copy ${roll} should select the three-copy spell`,
    );
  }
});

test("buying a Tavern Spell returns its pool copy immediately", () => {
  const state = createGame(0x7140);
  const player = humanPlayer(state);
  player.gold = 5;
  player.hand = [];
  const offer = replaceSpellOffer(
    state,
    player,
    "tavern-spell-tavern-dish-banana",
  );
  const beforePool = state.spellPool[offer.definitionId];

  const bought = gameReducer(state, { type: "BUY_TAVERN_SPELL" });
  const nextPlayer = humanPlayer(bought);
  assert.equal(nextPlayer.gold, 4);
  assert.equal(nextPlayer.spellShop, null);
  assert.equal(nextPlayer.hand.length, 1);
  assert.equal(nextPlayer.hand[0].instanceId, offer.instanceId);
  assert.equal(
    bought.spellPool[offer.definitionId],
    beforePool + 1,
  );
});

test("Tavern Spell purchases are atomic when gold or hand space is missing", () => {
  const underfunded = createGame(0x7150);
  const poorPlayer = humanPlayer(underfunded);
  poorPlayer.gold = 2;
  replaceSpellOffer(
    underfunded,
    poorPlayer,
    "tavern-spell-strike-oil",
  );
  assert.deepEqual(
    gameReducer(underfunded, { type: "BUY_TAVERN_SPELL" }),
    underfunded,
  );

  const fullHand = createGame(0x7151);
  const fullPlayer = humanPlayer(fullHand);
  const template = fullPlayer.shop[0];
  assert.ok(template);
  fullPlayer.gold = 10;
  fullPlayer.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(
      template,
      template.definitionId,
      `full-hand-${index}`,
    ),
  );
  replaceSpellOffer(
    fullHand,
    fullPlayer,
    "tavern-spell-tavern-dish-banana",
  );
  assert.deepEqual(
    gameReducer(fullHand, { type: "BUY_TAVERN_SPELL" }),
    fullHand,
  );
});

test("refresh replaces the spell slot while Freeze preserves it for one turn", () => {
  const refreshState = createGame(0x7160);
  const refreshPlayer = humanPlayer(refreshState);
  refreshPlayer.gold = 10;
  refreshPlayer.frozen = true;
  const oldOfferId = refreshPlayer.spellShop?.instanceId;
  assert.ok(oldOfferId);
  const refreshed = gameReducer(refreshState, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(refreshed).gold, 9);
  assert.equal(humanPlayer(refreshed).frozen, false);
  assert.notEqual(
    humanPlayer(refreshed).spellShop?.instanceId,
    oldOfferId,
  );

  let frozen = createGame(0x7161);
  const frozenOfferId = humanPlayer(frozen).spellShop?.instanceId;
  const frozenMinionIds = humanPlayer(frozen).shop.map(
    (minion) => minion.instanceId,
  );
  assert.ok(frozenOfferId);
  frozen = gameReducer(frozen, { type: "TOGGLE_FREEZE" });
  frozen = gameReducer(frozen, { type: "END_TURN" });
  frozen = gameReducer(frozen, { type: "CONTINUE" });
  assert.equal(humanPlayer(frozen).frozen, false);
  assert.equal(
    humanPlayer(frozen).spellShop?.instanceId,
    frozenOfferId,
  );
  assert.deepEqual(
    humanPlayer(frozen).shop.map((minion) => minion.instanceId),
    frozenMinionIds,
  );
});

test("targeted and targetless Tavern Spells cast through distinct legal paths", () => {
  let state = createGame(0x7170);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "spell-target", {
      attack: 3,
      health: 4,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "fortify"),
    tavernSpell("tavern-spell-tavern-coin", "coin"),
  ];
  player.gold = 2;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "fortify",
    targetInstanceId: "spell-target",
  });
  player = humanPlayer(state);
  assert.equal(player.board[0].health, 7);
  assert.equal(player.board[0].taunt, true);
  assert.equal(player.tavernSpellsCastThisTurn, 1);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "coin",
  });
  player = humanPlayer(state);
  assert.equal(player.gold, 3);
  assert.equal(player.hand.length, 0);
  assert.equal(player.tavernSpellsCastThisTurn, 2);
});

test("spells that say any minion can target Tavern offers", () => {
  let state = createGame(0x7171);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [];
  player.shop = [
    definitionMinion(template, template.definitionId, "shop-buff-target", {
      attack: 2,
      health: 3,
      taunt: false,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "shop-fortify"),
    tavernSpell("tavern-spell-defenders-rites", "friendly-only-rites"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "shop-fortify",
    targetInstanceId: "shop-buff-target",
  });
  player = humanPlayer(state);
  assert.equal(player.shop[0].health, 6);
  assert.equal(player.shop[0].taunt, true);
  assert.equal(player.hand.length, 1);

  const beforeFriendlyOnlyCast = state;
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "friendly-only-rites",
    targetInstanceId: "shop-buff-target",
  });
  assert.deepEqual(state, beforeFriendlyOnlyCast);
});

test("Natural Blessing buffs matching types across the board and Tavern", () => {
  let state = createGame(0x7172);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "board-beast", {
      attack: 1,
      health: 1,
      tribe: "beast",
      tribes: ["beast"],
    }),
    definitionMinion(template, template.definitionId, "board-neutral", {
      attack: 2,
      health: 2,
      tribe: "neutral",
      tribes: [],
    }),
    definitionMinion(template, template.definitionId, "board-all", {
      attack: 3,
      health: 3,
      tribe: "all",
      tribes: ["all"],
    }),
  ];
  player.shop = [
    definitionMinion(template, template.definitionId, "shop-beast", {
      attack: 4,
      health: 4,
      tribe: "beast",
      tribes: ["beast"],
    }),
    definitionMinion(template, template.definitionId, "shop-murloc", {
      attack: 5,
      health: 5,
      tribe: "murloc",
      tribes: ["murloc"],
    }),
    definitionMinion(template, template.definitionId, "shop-neutral", {
      attack: 6,
      health: 6,
      tribe: "neutral",
      tribes: [],
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-natural-blessing", "bless-beast"),
    tavernSpell("tavern-spell-natural-blessing", "bless-all"),
    tavernSpell("tavern-spell-natural-blessing", "bless-neutral"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "bless-beast",
    targetInstanceId: "shop-beast",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [4, 4],
      [2, 2],
      [6, 6],
    ],
  );
  assert.deepEqual(
    player.shop.map((minion) => [minion.attack, minion.health]),
    [
      [7, 7],
      [5, 5],
      [6, 6],
    ],
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "bless-all",
    targetInstanceId: "board-all",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [7, 7],
      [2, 2],
      [9, 9],
    ],
  );
  assert.deepEqual(
    player.shop.map((minion) => [minion.attack, minion.health]),
    [
      [10, 10],
      [8, 8],
      [6, 6],
    ],
  );

  const beforeNeutralBlessing = jsonClone(player);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "bless-neutral",
    targetInstanceId: "shop-neutral",
  });
  player = humanPlayer(state);
  assert.deepEqual(player.board, beforeNeutralBlessing.board);
  assert.deepEqual(player.shop, beforeNeutralBlessing.shop);
});

test("illegal Tavern Spell targets never consume the card or increment casts", () => {
  const state = createGame(0x7180);
  const player = humanPlayer(state);
  const opponent = state.players.find(
    (candidate) => candidate.id !== state.humanPlayerId,
  );
  const template = player.shop[0];
  assert.ok(template);
  assert.ok(opponent);
  player.board = [
    definitionMinion(template, template.definitionId, "friendly-target"),
  ];
  opponent.board = [
    definitionMinion(template, template.definitionId, "enemy-target"),
  ];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "invalid-fortify"),
    tavernSpell("tavern-spell-tavern-coin", "invalid-coin"),
  ];
  player.tavernSpellsCastThisTurn = 4;

  for (const action of [
    {
      type: "CAST_TAVERN_SPELL" as const,
      cardInstanceId: "invalid-fortify",
    },
    {
      type: "CAST_TAVERN_SPELL" as const,
      cardInstanceId: "invalid-fortify",
      targetInstanceId: "enemy-target",
    },
    {
      type: "CAST_TAVERN_SPELL" as const,
      cardInstanceId: "invalid-coin",
      targetInstanceId: "friendly-target",
    },
  ]) {
    assert.deepEqual(gameReducer(state, action), state);
  }
});

test("Blood Gems remain separate from Tavern Spell cast counters", () => {
  const state = createGame(0x7190);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "gem-target", {
      attack: 5,
      health: 6,
    }),
  ];
  const gem: BloodGemSpellInstance = {
    kind: "bloodGem",
    instanceId: "standalone-blood-gem",
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  };
  player.hand = [gem];
  player.tavernSpellsCastThisTurn = 3;

  const cast = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: gem.instanceId,
    targetInstanceId: "gem-target",
  });
  const castPlayer = humanPlayer(cast);
  assert.equal(castPlayer.board[0].attack, 6);
  assert.equal(castPlayer.board[0].health, 7);
  assert.equal(castPlayer.tavernSpellsCastThisTurn, 3);
});

test("core stat and Tavern-buffing spells apply their live values", () => {
  let state = createGame(0x71a0);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "buff-one", {
      attack: 2,
      health: 3,
    }),
    definitionMinion(template, template.definitionId, "buff-two", {
      attack: 4,
      health: 5,
    }),
  ];
  player.shop = [
    definitionMinion(template, template.definitionId, "shop-one", {
      attack: 1,
      health: 1,
    }),
    definitionMinion(template, template.definitionId, "shop-two", {
      attack: 3,
      health: 2,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-tavern-dish-banana", "banana"),
    tavernSpell("tavern-spell-them-apples", "apples"),
    tavernSpell("tavern-spell-shiny-ring", "ring"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "banana",
    targetInstanceId: "buff-one",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "apples",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "ring",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [5, 6],
      [5, 6],
    ],
  );
  assert.deepEqual(
    player.shop.map((minion) => [minion.attack, minion.health]),
    [
      [2, 3],
      [4, 4],
    ],
  );
  assert.equal(player.tavernSpellsCastThisTurn, 3);
});

test("core economy spells track free refreshes, max Gold, and next-turn Gold", () => {
  let state = createGame(0x71b0);
  let player = humanPlayer(state);
  player.gold = 4;
  player.hand = [
    tavernSpell("tavern-spell-leaf-through-the-pages", "pages"),
    tavernSpell("tavern-spell-strike-oil", "oil"),
    tavernSpell("tavern-spell-careful-investment", "investment"),
  ];

  for (const cardInstanceId of ["pages", "oil", "investment"]) {
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId,
    });
  }
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 2);
  assert.equal(player.maxGold, 11);
  assert.equal(player.pendingNextTurnGold, 2);
  assert.equal(player.gold, 4);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 1);
  assert.equal(player.gold, 4);

  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(player.gold, 6);
  assert.equal(player.pendingNextTurnGold, 0);
});

test("Trainee and Lasso add real pool/shop minions to hand deterministically", () => {
  let traineeState = createGame(0x71c0);
  let traineePlayer = humanPlayer(traineeState);
  const traineeTemplate = traineePlayer.shop[0];
  assert.ok(traineeTemplate);
  const traineeDefinitionId = traineeTemplate.definitionId;
  for (const definitionId of Object.keys(traineeState.pool)) {
    traineeState.pool[definitionId] = 0;
  }
  traineeState.pool[traineeDefinitionId] = 1;
  traineePlayer.hand = [
    tavernSpell("tavern-spell-recruit-a-trainee", "trainee-spell"),
  ];

  traineeState = gameReducer(traineeState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "trainee-spell",
  });
  traineePlayer = humanPlayer(traineeState);
  assert.equal(traineePlayer.hand.length, 1);
  assert.equal(traineePlayer.hand[0].kind, "minion");
  assert.equal(
    traineePlayer.hand[0].definitionId,
    traineeDefinitionId,
  );
  assert.equal(traineeState.pool[traineeDefinitionId], 0);

  let lassoState = createGame(0x71c1);
  let lassoPlayer = humanPlayer(lassoState);
  const lassoTemplate = lassoPlayer.shop[0];
  assert.ok(lassoTemplate);
  const stolen = definitionMinion(
    lassoTemplate,
    lassoTemplate.definitionId,
    "only-lasso-target",
  );
  lassoPlayer.shop = [stolen];
  lassoPlayer.hand = [
    tavernSpell("tavern-spell-enchanted-lasso", "lasso-spell"),
  ];

  lassoState = gameReducer(lassoState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "lasso-spell",
  });
  lassoPlayer = humanPlayer(lassoState);
  assert.equal(lassoPlayer.shop.length, 0);
  assert.deepEqual(
    lassoPlayer.hand.map((card) => card.instanceId),
    ["only-lasso-target"],
  );
});

test("AI buys and casts useful Tavern Spells through the normal recruit path", () => {
  const state = createGame(0x71d0);
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  for (const player of state.players) {
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.frozen = false;
  }
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  ai.gold = 1;
  ai.board = [
    definitionMinion(template, template.definitionId, "ai-spell-target", {
      attack: 5,
      health: 7,
    }),
  ];
  ai.spellShop = tavernSpell(
    "tavern-spell-tavern-dish-banana",
    "ai-banana-offer",
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const recruitedAi = combat.players.find(
    (player) => player.id === ai.id,
  );
  assert.ok(recruitedAi);
  assert.equal(recruitedAi.gold, 0);
  assert.equal(recruitedAi.spellShop, null);
  assert.equal(recruitedAi.hand.length, 0);
  assert.equal(recruitedAi.board[0].attack, 7);
  assert.equal(recruitedAi.board[0].health, 9);
  assert.equal(recruitedAi.tavernSpellsCastThisTurn, 1);
});

test("schema 6 saves migrate to schema 7 and survive a JSON round-trip", () => {
  const migrated = migrateSchema6GameState(legacyState(6, 0x71e0));
  assertMigratedSchema7(migrated);
  assert.equal(humanPlayer(migrated).bloodGemAttack, 1);
  assert.equal(humanPlayer(migrated).bloodGemHealth, 1);
});

test("schema 6 migration does not reserve Tavern Spells for eliminated players", () => {
  const legacy = legacyState(6, 0x71e2);
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  const eliminated = players[players.length - 1];
  assert.ok(eliminated !== null && typeof eliminated === "object");
  (eliminated as Record<string, unknown>).alive = false;
  (eliminated as Record<string, unknown>).health = 0;

  const migrated = migrateSchema6GameState(legacy);
  assert.ok(migrated !== null && typeof migrated === "object");
  const state = migrated as GameState;
  assert.equal(state.players.at(-1)?.spellShop, null);
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(state, definition.id),
      SPELL_POOL_COPIES_BY_TIER[definition.tier],
      `${definition.name} must not be locked by an eliminated player`,
    );
  }
});

test("schema 5 saves migrate through schema 6 to schema 7", () => {
  const migrated = migrateSchema5GameState(legacyState(5, 0x71e1));
  assertMigratedSchema7(migrated);
  assert.equal(humanPlayer(migrated).bloodGemAttack, 1);
  assert.equal(humanPlayer(migrated).bloodGemHealth, 1);
  assert.equal(migrateSchema5GameState({ version: 5 }), null);
  assert.equal(migrateSchema6GameState({ version: 6 }), null);
});
