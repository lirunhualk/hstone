import assert from "node:assert/strict";
import test from "node:test";

import {
  TAVERN_SPELL_DEFINITIONS,
  createGame,
  gameReducer,
  getTavernSpellPurchaseQuote,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V18,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V37,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const COMPLETED_TIER_ONE_IDS = [
  "BG24_009",
  "BG26_529",
  "BG27_004",
  "BG31_330",
  "BG32_236",
  "BG32_330",
  "BG35_801",
  "BG35_814",
] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const effectCounters: Record<string, number> =
    definitionId === "BG26_529"
      ? { periodicEndOfTurn: 3 }
      : definitionId === "BG35_801"
        ? { cardPurchases: 0 }
        : {};
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
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters,
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
  const definition = TAVERN_SPELL_DEFINITIONS.find(
    (candidate) => candidate.id === definitionId,
  );
  assert.ok(definition);
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

function keepOneIdleOpponent(
  state: GameState,
  board: BoardMinionInstance[] = [],
): void {
  for (let index = 1; index < state.players.length; index += 1) {
    const player = state.players[index];
    player.alive = index === 1;
    player.health = index === 1 ? 100 : 0;
    player.armor = 0;
    player.gold = 0;
    player.board = index === 1 ? board : [];
    player.hand = [];
    player.pendingSpellcraft = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.frozen = false;
  }
}

test("all eight previously partial Tier 1 minions now expose complete rules", () => {
  for (const definitionId of COMPLETED_TIER_ONE_IDS) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
      definitionId,
    );
    assert.match(
      getMinionDefinition(definitionId).goldenCardId ?? "",
      /_G$/u,
    );
  }

  assert.equal(
    getMinionDefinition("BG27_004").spellcraft?.definitionId,
    "spellcraft-crab-rider",
  );
  assert.equal(
    getMinionDefinition("BG32_330").inHandStartOfCombat?.kind,
    "summonSelfCopy",
  );
  assert.equal(
    getMinionDefinition("BG35_801").afterCardPurchased?.purchases,
    4,
  );
});

test("Picky Eater consumes real Tavern stats, returns the offer, and scales with Golden Brann", () => {
  let state = createGame(0x7101);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const food = definitionMinion(
    template,
    "BG26_135",
    "food-regular",
    { attack: 5, health: 7, poolCopies: 1 },
  );
  player.shop = [food];
  state.pool[food.definitionId] = 5;
  player.hand = [
    definitionMinion(template, "BG24_009", "picky-regular"),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "picky-regular",
  });
  player = humanPlayer(state);
  assert.equal(player.board[0]?.attack, 6);
  assert.equal(player.board[0]?.health, 8);
  assert.equal(player.shop.length, 0);
  assert.equal(state.pool[food.definitionId], 6);

  state = createGame(0x7102);
  player = humanPlayer(state);
  const goldenTemplate = player.shop[0];
  assert.ok(goldenTemplate);
  player.board = [
    definitionMinion(goldenTemplate, "BG_LOE_077", "brann"),
  ];
  player.shop = [
    definitionMinion(goldenTemplate, "BG26_135", "food-a", {
      attack: 2,
      health: 3,
    }),
    definitionMinion(goldenTemplate, "BG23_002", "food-b", {
      attack: 4,
      health: 5,
    }),
  ];
  player.hand = [
    definitionMinion(goldenTemplate, "BG24_009", "picky-golden", {
      golden: true,
      cardId: "BG24_009_G",
      attack: 2,
      health: 2,
    }),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "picky-golden",
  });
  player = humanPlayer(state);
  const picky = player.board.find(
    (minion) => minion.instanceId === "picky-golden",
  );
  assert.ok(picky);
  assert.equal(picky.attack, 14);
  assert.equal(picky.health, 18);
  assert.equal(player.shop.length, 0);
});

test("Upbeat Frontdrake counts three end turns and Golden gains two Dragons", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 0x7111 : 0x7110);
    let player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    state.activeTribes = [
      "beast",
      "mech",
      "murloc",
      "dragon",
      "pirate",
    ];
    for (const definitionId of Object.keys(state.pool)) {
      state.pool[definitionId] = 0;
    }
    state.pool.BG26_529 = 100;
    player.board = [
      definitionMinion(template, "BG26_529", "frontdrake", {
        golden,
        cardId: golden ? "BG26_529_G" : "BG26_529",
        attack: golden ? 2 : 1,
        health: golden ? 2 : 1,
      }),
    ];
    player.hand = [];
    keepOneIdleOpponent(state);

    for (let turn = 1; turn <= 3; turn += 1) {
      keepOneIdleOpponent(state);
      state = gameReducer(state, { type: "END_TURN" });
      if (turn === 1) {
        assert.match(
          humanPlayer(state).board[0]?.description ?? "",
          /还剩2回合/u,
        );
      } else if (turn === 2) {
        assert.match(
          humanPlayer(state).board[0]?.description ?? "",
          /就是这回合/u,
        );
      }
      state = gameReducer(state, { type: "CONTINUE" });
    }

    player = humanPlayer(state);
    const dragons = player.hand.filter(
      (card) =>
        card.kind === "minion" && card.definitionId === "BG26_529",
    );
    assert.equal(dragons.length, golden ? 2 : 1);
    assert.match(player.board[0]?.description ?? "", /还剩3回合/u);
  }
});

test("Marine Matriarch grants regular and real Golden Crab Rider Spellcraft", () => {
  let state = createGame(0x7120);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG26_135",
    "crab-target",
    { attack: 0, health: 1 },
  );
  const matriarch = definitionMinion(
    template,
    "BG27_004",
    "golden-matriarch",
    {
      golden: true,
      cardId: "BG27_004_G",
      attack: 2,
      health: 2,
    },
  );
  player.board = [target];
  player.hand = [matriarch];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: matriarch.instanceId,
  });
  player = humanPlayer(state);
  const spell = player.hand.find(
    (card) =>
      card.kind === "spellcraft" &&
      card.definitionId === "spellcraft-crab-rider",
  );
  assert.ok(spell);
  assert.equal(spell.kind, "spellcraft");
  assert.equal(spell.cardId, "BG27_004_Gt");
  assert.equal(spell.effectMultiplier, 2);

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spell.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const enchanted = player.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(enchanted);
  assert.equal(enchanted.temporaryCrabDeathrattles, 0);
  assert.equal(enchanted.temporaryGoldenCrabDeathrattles, 1);

  const enemy = definitionMinion(
    template,
    "BG26_135",
    "crab-enemy",
    { attack: 30, health: 30 },
  );
  keepOneIdleOpponent(state, [enemy]);
  state = gameReducer(state, { type: "END_TURN" });
  const summonedGoldenCrab = state.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "live-crab-token",
  )?.minion;
  assert.ok(summonedGoldenCrab);
  assert.equal(summonedGoldenCrab.cardId, "BG27_004_Gt2");
  assert.equal(summonedGoldenCrab.attack, 6);
  assert.equal(summonedGoldenCrab.health, 4);
});

test("Doomsayer discounts exactly the next Gold-cost Tavern Spell and the UI quote", () => {
  let state = createGame(0x7130);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const sprout = tavernSpell(
    "tavern-spell-new-sprout",
    "discounted-sprout",
  );
  player.gold = 5;
  player.spellShop = sprout;
  player.additionalSpellShop = [];
  player.hand = [
    definitionMinion(template, "BG31_330", "doomsayer"),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "doomsayer",
  });
  player = humanPlayer(state);
  assert.equal(player.nextTavernSpellDiscount, 1);
  assert.deepEqual(
    getTavernSpellPurchaseQuote(state, player.id, sprout.instanceId),
    { currency: "gold", cost: 2, affordable: true },
  );

  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: sprout.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.gold, 3);
  assert.equal(player.nextTavernSpellDiscount, 0);

  const excavation = tavernSpell(
    "tavern-spell-hasty-excavation",
    "health-spell",
  );
  player.nextTavernSpellDiscount = 1;
  player.spellShop = excavation;
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: excavation.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.health, 37);
  assert.equal(player.nextTavernSpellDiscount, 1);

  state = createGame(0x7131);
  player = humanPlayer(state);
  const goldenTemplate = player.shop[0];
  assert.ok(goldenTemplate);
  player.board = [
    definitionMinion(goldenTemplate, "BG_LOE_077", "discount-brann"),
  ];
  player.hand = [
    definitionMinion(goldenTemplate, "BG31_330", "golden-doomsayer", {
      golden: true,
      cardId: "BG31_330_G",
      attack: 4,
      health: 2,
    }),
  ];
  player.spellShop = tavernSpell(
    "tavern-spell-new-sprout",
    "free-sprout",
  );
  player.gold = 0;
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "golden-doomsayer",
  });
  player = humanPlayer(state);
  assert.equal(player.nextTavernSpellDiscount, 4);
  assert.equal(
    getTavernSpellPurchaseQuote(
      state,
      player.id,
      "free-sprout",
    )?.cost,
    0,
  );
});

test("Goldgrubber Champion becomes Golden once without fabricating pool copies or rewards", () => {
  let state = createGame(0x7140);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG_LOE_077", "gold-brann"),
  ];
  player.hand = [
    definitionMinion(template, "BG32_236", "champion", {
      poolCopies: 1,
    }),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "champion",
  });
  player = humanPlayer(state);
  const champion = player.board.find(
    (minion) => minion.instanceId === "champion",
  );
  assert.ok(champion);
  assert.equal(champion.golden, true);
  assert.equal(champion.cardId, "BG32_236_G");
  assert.equal(champion.attack, 2);
  assert.equal(champion.health, 2);
  assert.equal(champion.divineShield, true);
  assert.equal(champion.poolCopies, 1);
  assert.equal(champion.grantsTripleReward, false);
  assert.equal(
    player.hand.some((card) => card.kind === "tripleReward"),
    false,
  );
});

test("Hot-headed Scout summons its in-hand copy for combat without consuming it", () => {
  let state = createGame(0x7150);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [];
  player.hand = [
    definitionMinion(template, "BG32_330", "scout-in-hand", {
      golden: true,
      cardId: "BG32_330_G",
      attack: 8,
      health: 9,
    }),
  ];
  keepOneIdleOpponent(state);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(
    state.lastBattle?.initialBoards[state.humanPlayerId]?.some(
      (minion) => minion.instanceId === "scout-in-hand",
    ),
    false,
  );
  const scoutSummon = state.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === "scout-in-hand" &&
      event.summonReason === "inHandStartOfCombat",
  );
  assert.ok(scoutSummon);
  assert.notEqual(scoutSummon.targetInstanceId, "scout-in-hand");
  assert.equal(scoutSummon.minion?.attack, 16);
  assert.equal(scoutSummon.minion?.health, 18);
  player = humanPlayer(state);
  const retainedScout = player.hand.find(
    (card) =>
      card.kind === "minion" &&
      card.instanceId === "scout-in-hand",
  );
  assert.ok(retainedScout);
  assert.equal(retainedScout.kind, "minion");
  assert.equal(retainedScout.attack, 8);
  assert.equal(retainedScout.health, 9);
});

test("AI keeps Hot-headed Scout in hand and exposes its combat summon event", () => {
  let state = createGame(0x7151);
  const human = humanPlayer(state);
  const template = human.shop[0];
  assert.ok(template);
  keepOneIdleOpponent(state);
  const ai = state.players[1];
  ai.hand = [
    definitionMinion(template, "BG32_330", "ai-scout-in-hand", {
      attack: 5,
      health: 6,
    }),
  ];

  state = gameReducer(state, { type: "END_TURN" });
  const persistedAi = state.players.find(
    (player) => player.id === ai.id,
  );
  assert.ok(persistedAi);
  assert.equal(
    persistedAi.hand.some(
      (card) =>
        card.kind === "minion" &&
        card.instanceId === "ai-scout-in-hand",
    ),
    true,
  );
  const scoutSummon = state.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorPlayerId === ai.id &&
      event.actorInstanceId === "ai-scout-in-hand" &&
      event.summonReason === "inHandStartOfCombat",
  );
  assert.ok(scoutSummon);
  assert.notEqual(scoutSummon.targetInstanceId, "ai-scout-in-hand");
  assert.equal(scoutSummon.minion?.attack, 5);
  assert.equal(scoutSummon.minion?.health, 6);
});

test("Hungry Trog counts Minion and Tavern Spell purchases once, including Golden scaling", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 0x7161 : 0x7160);
    let player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const trog = definitionMinion(
      template,
      "BG35_801",
      "hungry-trog",
      {
        golden,
        cardId: golden ? "BG35_801_G" : "BG35_801",
        attack: golden ? 4 : 2,
        health: golden ? 6 : 3,
      },
    );
    player.board = [trog];
    player.hand = [];
    player.gold = 13;
    player.spellShop = tavernSpell(
      "tavern-spell-tavern-coin",
      "trog-spell",
    );
    player.shop = [0, 1, 2, 3].map((index) =>
      definitionMinion(
        template,
        "BG26_135",
        `trog-food-${index}`,
      ),
    );

    state = gameReducer(state, {
      type: "BUY_TAVERN_SPELL",
      spellInstanceId: "trog-spell",
    });
    for (let index = 0; index < 3; index += 1) {
      state = gameReducer(state, {
        type: "BUY_MINION",
        shopIndex: 0,
      });
    }
    player = humanPlayer(state);
    const completed = player.board[0];
    assert.equal(completed.attack, golden ? 12 : 6);
    assert.equal(completed.health, golden ? 14 : 7);
    assert.equal(completed.effectCounters?.cardPurchases, -1);
    assert.match(completed.description, /已完成/u);

    const attackAfterCompletion = completed.attack;
    state = gameReducer(state, {
      type: "BUY_MINION",
      shopIndex: 0,
    });
    assert.equal(humanPlayer(state).board[0]?.attack, attackAfterCompletion);
  }
});

test("Crimson Survivor gains Divine Shield immediately when a Blood Gem reaches 6 Attack", () => {
  let state = createGame(0x7170);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const survivor = definitionMinion(
    template,
    "BG35_814",
    "survivor",
    { attack: 5, divineShield: false },
  );
  player.board = [survivor];
  player.hand = [bloodGem("survivor-gem")];

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "survivor-gem",
    targetInstanceId: "survivor",
  });
  player = humanPlayer(state);
  assert.equal(player.board[0]?.attack, 6);
  assert.equal(player.board[0]?.divineShield, true);
  assert.match(player.board[0]?.description ?? "", /已完成/u);
});

test("Crimson Survivor also completes from a combat-only Attack buff", () => {
  let state = createGame(0x7171);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(
      template,
      "BG35_814",
      "combat-survivor",
      { attack: 5, divineShield: false },
    ),
  ];
  player.nextCombatAttackBonus = 1;
  keepOneIdleOpponent(state, [
    definitionMinion(template, "BG26_135", "combat-target", {
      attack: 1,
      health: 30,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  const combatSurvivor = state.lastBattle?.initialBoards[
    state.humanPlayerId
  ]?.find((minion) => minion.instanceId === "combat-survivor");
  assert.ok(combatSurvivor);
  assert.equal(combatSurvivor.attack, 5);
  assert.equal(combatSurvivor.divineShield, false);
  const combatOnlyBuff = state.lastBattle?.events.find(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === "combat-survivor" &&
      event.message.includes("转瞬活力"),
  );
  assert.ok(combatOnlyBuff?.minion);
  assert.equal(combatOnlyBuff.minion.attack, 6);
  assert.equal(combatOnlyBuff.minion.divineShield, true);
  const combatEvents = state.lastBattle?.events ?? [];
  const shieldBreaks = combatEvents.filter(
    (event) =>
      event.type === "shieldBroken" &&
      event.targetInstanceId === "combat-survivor",
  );
  assert.equal(shieldBreaks.length, 1);
  assert.ok(
    combatEvents.some(
      (event) =>
        event.type === "damage" &&
        event.targetInstanceId === "combat-survivor" &&
        event.index > shieldBreaks[0].index,
    ),
  );
  assert.equal(
    combatEvents.filter(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === "combat-survivor" &&
        event.message.includes("达到6点攻击力"),
    ).length,
    0,
  );
});

test("Crimson Survivor does not regain Divine Shield after it breaks in combat", () => {
  let state = createGame(0x7172);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG35_814", "single-shield-survivor", {
      attack: 6,
      health: 10,
      divineShield: false,
    }),
  ];
  keepOneIdleOpponent(state, [
    definitionMinion(template, "BG26_135", "single-shield-target", {
      attack: 1,
      health: 30,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  const events = state.lastBattle?.events ?? [];
  const shieldBreaks = events.filter(
    (event) =>
      event.type === "shieldBroken" &&
      event.targetInstanceId === "single-shield-survivor",
  );
  assert.equal(shieldBreaks.length, 1);
  assert.ok(
    events.some(
      (event) =>
        event.type === "damage" &&
        event.targetInstanceId === "single-shield-survivor" &&
        event.index > shieldBreaks[0].index,
    ),
  );
  assert.equal(
    events.filter(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === "single-shield-survivor" &&
        event.message.includes("达到6点攻击力"),
    ).length,
    0,
  );
});

test("v37 saves preserve Crimson Survivor's consumed Divine Shield", () => {
  const state = createGame(0x7173);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG35_814", "saved-consumed-survivor", {
      attack: 6,
      divineShield: false,
      effectCounters: { conditionalKeywordTriggered: 1 },
    }),
  ];
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V37;

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(restored);
  const restoredSurvivor = humanPlayer(restored).board[0];
  assert.equal(restoredSurvivor?.divineShield, false);
  assert.equal(
    restoredSurvivor?.effectCounters
      ?.conditionalKeywordTriggered,
    1,
  );
});

test("v18 saves migrate Tier 1 counters and discounts without losing persistent history", () => {
  const state = createGame(0x7180);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.astralAutomatonsSummoned = 7;
  player.eternalKnightsDied = 5;
  player.pendingSpellcraft = [];
  player.board = [
    definitionMinion(template, "BG35_801", "saved-trog", {
      effectSupport: "partial",
    }),
    definitionMinion(template, "BG35_814", "saved-survivor", {
      attack: 6,
      divineShield: false,
      effectSupport: "partial",
    }),
  ];
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V18;
  for (const savedPlayer of state.players) {
    delete (
      savedPlayer as Partial<PlayerState>
    ).nextTavernSpellDiscount;
    for (const minion of [
      ...savedPlayer.board,
      ...savedPlayer.shop,
      ...savedPlayer.hand.filter(
        (card): card is BoardMinionInstance =>
          card.kind === "minion",
      ),
    ]) {
      delete minion.effectCounters;
      delete minion.temporaryGoldenCrabDeathrattles;
    }
  }

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  const migratedPlayer = humanPlayer(migrated);
  assert.equal(migratedPlayer.astralAutomatonsSummoned, 7);
  assert.equal(migratedPlayer.eternalKnightsDied, 5);
  assert.equal(migratedPlayer.nextTavernSpellDiscount, 0);
  assert.equal(migratedPlayer.board[0]?.effectSupport, "complete");
  assert.deepEqual(migratedPlayer.board[0]?.effectCounters, {});
  assert.equal(
    migratedPlayer.board[0]?.temporaryGoldenCrabDeathrattles,
    0,
  );
  assert.equal(migratedPlayer.board[1]?.effectSupport, "complete");
  assert.equal(migratedPlayer.board[1]?.divineShield, true);
  assert.equal(
    migratedPlayer.board[1]?.effectCounters
      ?.conditionalKeywordTriggered,
    1,
  );
});
