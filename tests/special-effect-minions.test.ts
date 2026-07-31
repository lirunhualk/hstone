import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  getTavernSpellPurchaseQuote,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

const COMPLETED_SPECIAL_EFFECT_CARD_IDS = [
  "BG23_004",
  "BG25_041",
  "BG26_160",
  "BG26_360",
  "BG26_502",
  "BG33_894",
  "BG34_634t",
  "BG34_635t",
  "BG34_638t",
  "BG35_340",
] as const;

const GOLDEN_METADATA = [
  [
    "BG23_004",
    "BG23_004_G",
    "塑造法术：直到下个回合，使一个随从获得+4/+12和嘲讽。",
  ],
  [
    "BG25_041",
    "BG25_041_G",
    "战吼：使酒馆中的随从在本局对战中获得+2/+1，触发两次。",
  ],
  [
    "BG26_160",
    "BG26_160_G",
    "亡语：在本局对战中，你的鲜血宝石会额外获得+2攻击力。",
  ],
  [
    "BG26_360",
    "BG26_360_G",
    "亡语：随机使你手牌中的一张随从牌获得+14/+14。",
  ],
  [
    "BG26_502",
    "BG26_502_G",
    "塑造法术：直到下个回合，使一个随从获得+4/+4。提升你此后的深沉蓝调效果。",
  ],
  [
    "BG33_894",
    "BG33_894_G",
    "战吼，亡语：随机获取两张等级1的酒馆法术牌。",
  ],
  [
    "BG34_634t",
    "BG34_634_Gt",
    "战吼：随机获取两张消耗2枚铸币的酒馆法术牌。",
  ],
  [
    "BG34_635t",
    "BG34_635_Gt",
    "战吼：在本局对战中，你的酒馆法术使随从额外获得+2生命值。",
  ],
  [
    "BG34_638t",
    "BG34_638_Gt",
    "战吼：在本局对战中，你的酒馆法术使随从额外获得+2攻击力。",
  ],
  [
    "BG35_340",
    "BG35_340_G",
    "嘲讽。亡语：你购买的下一张酒馆法术牌消耗的铸币减少（2）枚。",
  ],
] as const;

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

function spellcraft(
  definitionId: string,
  instanceId: string,
  effectMultiplier = 1,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  const golden = effectMultiplier > 1;
  return {
    kind: "spellcraft",
    instanceId,
    definitionId: definition.id,
    cardId:
      golden && definition.goldenCardId
        ? definition.goldenCardId
        : definition.cardId,
    name: definition.name,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    spellFamily: "spellcraft",
    target: definition.target,
    effectMultiplier,
  };
}

function tavernSpellsInHand(player: PlayerState): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance => card.kind === "tavernSpell",
  );
}

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function cloneSpellPool(state: GameState): GameState["spellPool"] {
  return JSON.parse(JSON.stringify(state.spellPool)) as GameState["spellPool"];
}

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[],
): PlayerState {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.health = 100;
    if (player.id === opponent.id) {
      player.alive = true;
      player.hand = [];
      player.board = opponentBoard;
    } else if (!player.isHuman) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
  return opponent;
}

function playHandMinion(state: GameState, cardInstanceId: string): GameState {
  return gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId,
  });
}

function continueAfterCombat(state: GameState): GameState {
  assert.equal(state.phase, "combat");
  const next = gameReducer(state, { type: "CONTINUE" });
  assert.equal(next.phase, "recruit");
  return next;
}

test("the special-effect batch uses exact normal and Golden card metadata", () => {
  for (const definitionId of COMPLETED_SPECIAL_EFFECT_CARD_IDS) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
      definitionId,
    );
  }
  for (const [definitionId, goldenCardId, goldenDescription] of GOLDEN_METADATA) {
    const definition = getMinionDefinition(definitionId);
    assert.equal(definition.goldenCardId, goldenCardId, definitionId);
    assert.equal(
      definition.goldenDescription,
      goldenDescription,
      definitionId,
    );
  }

  assert.deepEqual(
    [
      getSpellcraftDefinition("spellcraft-anglers-lure").goldenCardId,
      getSpellcraftDefinition("spellcraft-anglers-lure").goldenDescription,
      getSpellcraftDefinition("spellcraft-deep-blue-blues").goldenCardId,
      getSpellcraftDefinition("spellcraft-deep-blue-blues").goldenDescription,
    ],
    [
      "BG23_004_Gt",
      "直到下个回合，使一个随从获得+4/+12和嘲讽。",
      "BG26_502_Gt",
      "直到下个回合，使一个随从获得+4/+4。提升你此后的深沉蓝调效果。",
    ],
  );
});

test("Deep-Sea Angler grants ordinary and Golden temporary stats and Taunt", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xd100 + index);
    let player = humanPlayer(state);
    const target = definitionMinion(
      "BG35_801",
      `angler-target-${golden}`,
      { attack: 5, health: 7, taunt: false },
    );
    const source = definitionMinion(
      "BG23_004",
      `angler-source-${golden}`,
      golden
        ? {
            golden: true,
            cardId: "BG23_004_G",
            attack: 4,
            health: 6,
          }
        : {},
    );
    player.board = [target];
    player.hand = [source];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `angler-enemy-${golden}`, {
        attack: 0,
        health: 100_000,
      }),
    ]);

    state = playHandMinion(state, source.instanceId);
    player = humanPlayer(state);
    const lure = player.hand.find(
      (card): card is SpellcraftSpellInstance =>
        card.kind === "spellcraft" &&
        card.definitionId === "spellcraft-anglers-lure",
    );
    assert.ok(lure);
    assert.equal(lure.effectMultiplier ?? 1, golden ? 2 : 1);
    assert.equal(
      lure.cardId,
      golden ? "BG23_004_Gt" : "BG23_004t",
    );

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: lure.instanceId,
      targetInstanceId: target.instanceId,
    });
    const buffed = humanPlayer(state).board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(buffed);
    const multiplier = golden ? 2 : 1;
    assert.deepEqual(
      [
        buffed.attack,
        buffed.health,
        buffed.temporaryAttack,
        buffed.temporaryHealth,
        buffed.taunt,
        buffed.temporaryTaunt,
      ],
      [
        5 + 2 * multiplier,
        7 + 6 * multiplier,
        2 * multiplier,
        6 * multiplier,
        true,
        true,
      ],
    );

    state = gameReducer(state, { type: "END_TURN" });
    state = continueAfterCombat(state);
    const cleared = humanPlayer(state).board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(cleared);
    assert.deepEqual(
      [
        cleared.attack,
        cleared.health,
        cleared.temporaryAttack,
        cleared.temporaryHealth,
        cleared.taunt,
        cleared.temporaryTaunt,
      ],
      [5, 7, 0, 0, false, false],
    );
  }
});

test("Deep Blue applies the current Golden multiplier but grows future casts by one", () => {
  let state = createGame(0xd110);
  let player = humanPlayer(state);
  const target = definitionMinion("BG35_801", "deep-blue-target", {
    attack: 5,
    health: 7,
  });
  player.board = [target];
  player.hand = [
    definitionMinion("BG26_502", "ordinary-deep-blue-source"),
    definitionMinion("BG26_502", "golden-deep-blue-source", {
      golden: true,
      cardId: "BG26_502_G",
      attack: 4,
      health: 4,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "deep-blue-enemy", {
      attack: 0,
      health: 100_000,
    }),
  ]);

  state = playHandMinion(state, "ordinary-deep-blue-source");
  state = playHandMinion(state, "golden-deep-blue-source");
  player = humanPlayer(state);
  const blues = player.hand.filter(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft" &&
      card.definitionId === "spellcraft-deep-blue-blues",
  );
  assert.equal(blues.length, 2);
  const ordinary = blues.find((card) => (card.effectMultiplier ?? 1) === 1);
  const golden = blues.find((card) => card.effectMultiplier === 2);
  assert.ok(ordinary);
  assert.ok(golden);

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: ordinary.instanceId,
    targetInstanceId: target.instanceId,
  });
  assert.equal(humanPlayer(state).deepBlueBonus, 1);
  let buffed = humanPlayer(state).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual([buffed.attack, buffed.health], [7, 9]);

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: golden.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  buffed = player.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual(
    [
      buffed.attack,
      buffed.health,
      buffed.temporaryAttack,
      buffed.temporaryHealth,
      player.deepBlueBonus,
    ],
    [13, 15, 8, 8, 2],
    "the Golden cast uses (2 + current bonus) x2 but advances future Blues only once",
  );

  state = gameReducer(state, { type: "END_TURN" });
  state = continueAfterCombat(state);
  const cleared = humanPlayer(state).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(cleared);
  assert.deepEqual([cleared.attack, cleared.health], [5, 7]);
  assert.equal(humanPlayer(state).deepBlueBonus, 2);
});

test("Treasure-Seeker Murloc buffs only hand minions with Golden and Titus scaling", () => {
  const scenarios = [
    { golden: false, titusGolden: null, expected: 7, events: 1 },
    { golden: true, titusGolden: null, expected: 14, events: 1 },
    { golden: false, titusGolden: false, expected: 14, events: 2 },
    { golden: true, titusGolden: true, expected: 42, events: 3 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xd120 + index);
    const player = humanPlayer(state);
    const source = definitionMinion(
      "BG26_360",
      `treasure-seeker-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG26_360_G" : "BG26_360",
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    player.board = [
      source,
      ...(scenario.titusGolden === null
        ? []
        : [
            definitionMinion("BG25_354", `treasure-titus-${index}`, {
              golden: scenario.titusGolden,
              attack: 0,
              health: 1_000,
            }),
          ]),
    ];
    const target = definitionMinion(
      "BG35_801",
      `treasure-hand-target-${index}`,
      { attack: 5, health: 7 },
    );
    const nonMinionCards: PlayerState["hand"] = [
      tavernSpell(
        "tavern-spell-new-sprout",
        `treasure-tavern-spell-${index}`,
      ),
      spellcraft(
        "spellcraft-anglers-lure",
        `treasure-spellcraft-${index}`,
      ),
    ];
    const tavernSpellBeforeCombat = structuredClone(nonMinionCards[0]);
    player.hand = [target, ...nonMinionCards];
    keepOnlyOneOpponent(
      state,
      Array.from({ length: 3 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `treasure-enemy-${index}-${enemyIndex}`,
          { attack: 100, health: 100 },
        ),
      ),
    );

    state = gameReducer(state, { type: "END_TURN" });
    const nextTarget = minionsInHand(humanPlayer(state))[0];
    assert.deepEqual(
      [nextTarget.attack, nextTarget.health],
      [5 + scenario.expected, 7 + scenario.expected],
    );
    assert.deepEqual(
      humanPlayer(state).hand.find(
        (card) => card.instanceId === `treasure-tavern-spell-${index}`,
      ),
      tavernSpellBeforeCombat,
    );
    assert.equal(
      humanPlayer(state).hand.some(
        (card) => card.instanceId === `treasure-spellcraft-${index}`,
      ),
      false,
      "unused Spellcraft cards still expire normally at end of turn",
    );
    const events =
      state.lastBattle?.events.filter(
        (event) =>
          event.type === "handBuff" &&
          event.actorInstanceId === source.instanceId,
      ) ?? [];
    assert.equal(events.length, scenario.events);
  }
});

test("Prickly Piper permanently improves Blood Gem Attack with Golden and Titus scaling", () => {
  const scenarios = [
    { golden: false, titusGolden: null, expected: 2 },
    { golden: true, titusGolden: null, expected: 3 },
    { golden: false, titusGolden: false, expected: 3 },
    { golden: true, titusGolden: true, expected: 7 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xd130 + index);
    const player = humanPlayer(state);
    const source = definitionMinion(
      "BG26_160",
      `prickly-piper-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG26_160_G" : "BG26_160",
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    player.board = [
      source,
      ...(scenario.titusGolden === null
        ? []
        : [
            definitionMinion("BG25_354", `piper-titus-${index}`, {
              golden: scenario.titusGolden,
              attack: 0,
              health: 1_000,
            }),
          ]),
    ];
    player.hand = [];
    player.bloodGemAttack = 1;
    keepOnlyOneOpponent(
      state,
      Array.from({ length: 3 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `piper-enemy-${index}-${enemyIndex}`,
          { attack: 100, health: 100 },
        ),
      ),
    );

    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(humanPlayer(state).bloodGemAttack, scenario.expected);
  }
});

test("Felemental buffs the current and every future Tavern page with Golden and Brann scaling", () => {
  const scenarios = [
    { golden: false, brann: false, multiplier: 1 },
    { golden: true, brann: false, multiplier: 2 },
    { golden: false, brann: true, multiplier: 2 },
    { golden: true, brann: true, multiplier: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xd140 + index);
    let player = humanPlayer(state);
    player.tavernTier = 3;
    player.gold = 10;
    player.board = scenario.brann
      ? [definitionMinion("BG_LOE_077", `felemental-brann-${index}`)]
      : [];
    const shopBase = getMinionDefinition("BG35_801");
    player.shop = [
      definitionMinion("BG35_801", `felemental-shop-${index}`, {
        poolCopies: 0,
      }),
    ];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.hand = [
      definitionMinion("BG25_041", `felemental-source-${index}`, {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG25_041_G" : "BG25_041",
      }),
    ];

    state = playHandMinion(state, `felemental-source-${index}`);
    player = humanPlayer(state);
    const attackBonus = 2 * scenario.multiplier;
    const healthBonus = scenario.multiplier;
    assert.deepEqual(
      [
        player.tavernMinionAttackBonus,
        player.tavernMinionHealthBonus,
        player.shop[0].attack,
        player.shop[0].health,
      ],
      [
        attackBonus,
        healthBonus,
        shopBase.attack + attackBonus,
        shopBase.health + healthBonus,
      ],
    );

    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    for (const definitionId of Object.keys(state.pool)) {
      state.pool[definitionId] = 0;
    }
    state.pool.BG35_801 = 20;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);
    assert.ok(player.shop.length > 0);
    assert.ok(
      player.shop.every(
        (minion) =>
          minion.definitionId === "BG35_801" &&
          minion.attack === shopBase.attack + attackBonus &&
          minion.health === shopBase.health + healthBonus,
      ),
    );
  }
});

test("Red and Black Chromawings scale their permanent Tavern Spell bonuses", () => {
  for (const [cardIndex, card] of [
    { definitionId: "BG34_638t", attack: 1, health: 0 },
    { definitionId: "BG34_635t", attack: 0, health: 1 },
  ].entries()) {
    for (const [scenarioIndex, scenario] of [
      { golden: false, brann: false, multiplier: 1 },
      { golden: true, brann: false, multiplier: 2 },
      { golden: false, brann: true, multiplier: 2 },
      { golden: true, brann: true, multiplier: 4 },
    ].entries()) {
      let state = createGame(0xd150 + cardIndex * 10 + scenarioIndex);
      const player = humanPlayer(state);
      player.board = scenario.brann
        ? [
            definitionMinion(
              "BG_LOE_077",
              `chromawing-brann-${cardIndex}-${scenarioIndex}`,
            ),
          ]
        : [];
      const sourceId = `chromawing-source-${cardIndex}-${scenarioIndex}`;
      player.hand = [
        definitionMinion(card.definitionId, sourceId, {
          golden: scenario.golden,
          cardId: scenario.golden
            ? getMinionDefinition(card.definitionId).goldenCardId
            : card.definitionId,
        }),
      ];

      state = playHandMinion(state, sourceId);
      assert.deepEqual(
        [
          humanPlayer(state).tavernSpellAttackBonus,
          humanPlayer(state).tavernSpellHealthBonus,
        ],
        [
          card.attack * scenario.multiplier,
          card.health * scenario.multiplier,
        ],
      );
    }
  }
});

test("Chromawing bonuses affect direct stat spells and delayed Blood Gem Barrage refills", () => {
  let state = createGame(0xd160);
  let player = humanPlayer(state);
  const target = definitionMinion("BG35_801", "chromawing-spell-target", {
    attack: 5,
    health: 7,
  });
  player.board = [target];
  player.hand = [
    definitionMinion("BG34_638t", "red-chromawing"),
    definitionMinion("BG34_635t", "black-chromawing"),
  ];

  state = playHandMinion(state, "red-chromawing");
  state = playHandMinion(state, "black-chromawing");
  player = humanPlayer(state);
  assert.deepEqual(
    [player.tavernSpellAttackBonus, player.tavernSpellHealthBonus],
    [1, 1],
  );

  player.hand.push(
    tavernSpell(
      "tavern-spell-tavern-dish-banana",
      "chromawing-banana",
    ),
  );
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "chromawing-banana",
    targetInstanceId: target.instanceId,
  });
  let buffed = humanPlayer(state).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual([buffed.attack, buffed.health], [8, 10]);

  player = humanPlayer(state);
  player.bloodGemAttack = 2;
  player.bloodGemHealth = 3;
  player.shop = [
    definitionMinion("BG20_100", "pre-barrage-shop", {
      attack: 1,
      health: 1,
      poolCopies: 0,
    }),
  ];
  player.hand.push(
    tavernSpell(
      "tavern-spell-blood-gem-barrage",
      "chromawing-barrage",
    ),
  );
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "chromawing-barrage",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [
      player.shop[0].attack,
      player.shop[0].health,
      player.tavernBloodGemBarrageCount,
      player.tavernBloodGemBarrageAttack,
      player.tavernBloodGemBarrageHealth,
    ],
    [1, 1, 1, 1, 1],
  );

  state.activeTribes = [
    "quilboar",
    "beast",
    "mech",
    "elemental",
    "murloc",
  ];
  player.tavernTier = 2;
  player.gold = 10;
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG20_100 = 20;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  const base = getMinionDefinition("BG20_100");
  assert.ok(player.shop.length > 0);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.attack === base.attack + 3 &&
        minion.health === base.health + 4 &&
        minion.bloodGemAttack === 3 &&
        minion.bloodGemHealth === 4,
    ),
  );

  buffed = player.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual([buffed.attack, buffed.health], [8, 10]);
});

test("Blue Chromawing generates only cost-2 Tavern Spells without reserving their pool", () => {
  const scenarios = [
    { golden: false, brann: false, fillers: 0, expected: 1 },
    { golden: true, brann: false, fillers: 0, expected: 2 },
    { golden: false, brann: true, fillers: 0, expected: 2 },
    { golden: true, brann: true, fillers: 0, expected: 4 },
    { golden: true, brann: true, fillers: 9, expected: 1 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xd170 + index);
    const player = humanPlayer(state);
    player.board = scenario.brann
      ? [definitionMinion("BG_LOE_077", `blue-brann-${index}`)]
      : [];
    const source = definitionMinion(
      "BG34_634t",
      `blue-chromawing-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG34_634_Gt" : "BG34_634t",
      },
    );
    player.hand = [
      source,
      ...Array.from({ length: scenario.fillers }, (_, fillerIndex) =>
        definitionMinion(
          "BG35_801",
          `blue-filler-${index}-${fillerIndex}`,
        ),
      ),
    ];
    const spellPoolBefore = cloneSpellPool(state);

    state = playHandMinion(state, source.instanceId);
    const spells = tavernSpellsInHand(humanPlayer(state));
    assert.equal(spells.length, scenario.expected);
    assert.ok(spells.every((spell) => spell.cost === 2));
    assert.deepEqual(state.spellPool, spellPoolBefore);
    assert.ok(humanPlayer(state).hand.length <= 10);
  }
});

test("Coldlight Diver generates exact Tier-1 spells from Battlecry and Deathrattle", () => {
  for (const [index, scenario] of [
    { golden: false, brann: false, expected: 1 },
    { golden: true, brann: false, expected: 2 },
    { golden: false, brann: true, expected: 2 },
    { golden: true, brann: true, expected: 4 },
  ].entries()) {
    let state = createGame(0xd180 + index);
    const player = humanPlayer(state);
    player.board = scenario.brann
      ? [definitionMinion("BG_LOE_077", `diver-brann-${index}`)]
      : [];
    const source = definitionMinion(
      "BG33_894",
      `battlecry-diver-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG33_894_G" : "BG33_894",
      },
    );
    player.hand = [source];
    const poolBefore = cloneSpellPool(state);

    state = playHandMinion(state, source.instanceId);
    const spells = tavernSpellsInHand(humanPlayer(state));
    assert.equal(spells.length, scenario.expected);
    assert.ok(spells.every((spell) => spell.tier === 1));
    assert.deepEqual(state.spellPool, poolBefore);
  }

  for (const [index, scenario] of [
    { golden: false, titusGolden: null, expected: 1 },
    { golden: true, titusGolden: null, expected: 2 },
    { golden: false, titusGolden: false, expected: 2 },
    { golden: true, titusGolden: true, expected: 6 },
  ].entries()) {
    let state = createGame(0xd190 + index);
    const player = humanPlayer(state);
    const source = definitionMinion(
      "BG33_894",
      `deathrattle-diver-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG33_894_G" : "BG33_894",
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    player.board = [
      source,
      ...(scenario.titusGolden === null
        ? []
        : [
            definitionMinion("BG25_354", `diver-titus-${index}`, {
              golden: scenario.titusGolden,
              attack: 0,
              health: 1_000,
            }),
          ]),
    ];
    player.hand = [];
    keepOnlyOneOpponent(
      state,
      Array.from({ length: 3 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `diver-enemy-${index}-${enemyIndex}`,
          { attack: 100, health: 100 },
        ),
      ),
    );
    const poolBefore = cloneSpellPool(state);

    state = gameReducer(state, { type: "END_TURN" });
    const spells = tavernSpellsInHand(humanPlayer(state));
    assert.equal(spells.length, scenario.expected);
    assert.ok(spells.every((spell) => spell.tier === 1));
    assert.deepEqual(state.spellPool, poolBefore);
    const events =
      state.lastBattle?.events.filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === source.instanceId,
      ) ?? [];
    assert.equal(events.length, scenario.expected);
  }
});

test("AI hand buffs and generated spells stay private", () => {
  let state = createGame(0xd1a0);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG35_801", "private-human-attacker", {
      attack: 100,
      health: 100,
    }),
  ];
  const treasure = definitionMinion(
    "BG26_360",
    "private-ai-treasure",
    { attack: 0, health: 100, taunt: true },
  );
  const diver = definitionMinion(
    "BG33_894",
    "private-ai-diver",
    { attack: 0, health: 100, taunt: true },
  );
  const ai = keepOnlyOneOpponent(state, [
    treasure,
    diver,
    ...Array.from({ length: 5 }, (_, index) =>
      definitionMinion("BG35_801", `private-ai-filler-${index}`, {
        attack: 0,
        health: 1_000,
      }),
    ),
  ]);
  const handTargets = [
    definitionMinion("BG25_001", "private-ai-hand-a"),
    definitionMinion("BG35_801", "private-ai-hand-b"),
  ];
  ai.hand = handTargets;
  const handStatsBeforeCombat = new Map(
    handTargets.map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  const minionDeltas = minionsInHand(nextAi)
    .map((minion) => {
      const original = handStatsBeforeCombat.get(minion.instanceId);
      return [
        minion.attack - (original?.attack ?? minion.attack),
        minion.health - (original?.health ?? minion.health),
      ];
    })
    .sort((left, right) => left[0] - right[0]);
  assert.deepEqual(minionDeltas, [
    [0, 0],
    [7, 7],
  ]);
  assert.equal(tavernSpellsInHand(nextAi).length, 1);
  assert.equal(tavernSpellsInHand(nextAi)[0].tier, 1);

  const privateEvents =
    state.lastBattle?.events.filter(
      (event) =>
        (event.type === "handBuff" &&
          event.actorInstanceId === treasure.instanceId) ||
        (event.type === "cardGain" &&
          event.actorInstanceId === diver.instanceId),
    ) ?? [];
  assert.equal(privateEvents.length, 2);
  for (const event of privateEvents) {
    assert.equal(event.targetInstanceId, undefined);
    assert.equal(event.cardName, undefined);
    assert.equal(event.minion, undefined);
    const publicEvent = JSON.stringify(event);
    for (const secret of [
      "private-ai-hand-a",
      "private-ai-hand-b",
      getMinionDefinition("BG25_001").name,
      getMinionDefinition("BG35_801").name,
    ]) {
      assert.equal(publicEvent.includes(secret), false);
    }
  }
});

test("Alerting Robot scales with Golden and Titus and survives into Recruit", () => {
  const scenarios = [
    { golden: false, titusGolden: null, expected: 1 },
    { golden: true, titusGolden: null, expected: 2 },
    { golden: false, titusGolden: false, expected: 2 },
    { golden: true, titusGolden: true, expected: 6 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xd1b0 + index);
    const player = humanPlayer(state);
    const source = definitionMinion(
      "BG35_340",
      `alerting-robot-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG35_340_G" : "BG35_340",
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    player.board = [
      source,
      ...(scenario.titusGolden === null
        ? []
        : [
            definitionMinion("BG25_354", `robot-titus-${index}`, {
              golden: scenario.titusGolden,
              attack: 0,
              health: 1_000,
            }),
          ]),
    ];
    player.hand = [];
    player.nextTavernSpellDiscount = 0;
    keepOnlyOneOpponent(
      state,
      Array.from({ length: 3 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `robot-enemy-${index}-${enemyIndex}`,
          { attack: 100, health: 100 },
        ),
      ),
    );

    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      humanPlayer(state).nextTavernSpellDiscount,
      scenario.expected,
    );
    if (index === 0) {
      state = continueAfterCombat(state);
      assert.equal(humanPlayer(state).nextTavernSpellDiscount, 1);
    }
  }
});

test("Alerting Robot discounts the next Gold spell but not a Health spell", () => {
  let state = createGame(0xd1c0);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG35_340", "purchasing-alerting-robot", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  player.hand = [];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "purchasing-robot-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  state = continueAfterCombat(state);
  player = humanPlayer(state);
  player.health = 40;
  player.gold = 10;
  player.hand = [];
  player.spellShop = tavernSpell(
    "tavern-spell-hasty-excavation",
    "health-cost-spell",
  );
  player.additionalSpellShop = [
    tavernSpell("tavern-spell-new-sprout", "gold-cost-spell"),
  ];

  assert.deepEqual(
    getTavernSpellPurchaseQuote(
      state,
      player.id,
      "health-cost-spell",
    ),
    { currency: "health", cost: 3, affordable: true },
  );
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "health-cost-spell",
  });
  player = humanPlayer(state);
  assert.equal(player.health, 37);
  assert.equal(player.nextTavernSpellDiscount, 1);
  assert.deepEqual(
    getTavernSpellPurchaseQuote(
      state,
      player.id,
      "gold-cost-spell",
    ),
    { currency: "gold", cost: 2, affordable: true },
  );

  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "gold-cost-spell",
  });
  player = humanPlayer(state);
  assert.equal(player.gold, 8);
  assert.equal(player.nextTavernSpellDiscount, 0);
});

test("ghost special effects cannot mutate their former owner's hidden state", () => {
  const state = createGame(0xd1d0);
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.gold = 0;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = undefined;
  }
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 100;
    player.board = [
      definitionMinion("BG35_801", `ghost-opponent-${index}`, {
        attack: 100,
        health: 100,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const ghostSources = [
    definitionMinion("BG26_360", "ghost-treasure", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG26_160", "ghost-piper", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG33_894", "ghost-diver", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG35_340", "ghost-robot", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  ghost.board = ghostSources;
  ghost.hand = [
    definitionMinion("BG25_001", "ghost-hand-sentinel", {
      attack: 5,
      health: 7,
    }),
  ];
  ghost.bloodGemAttack = 5;
  ghost.nextTavernSpellDiscount = 7;
  const handBefore = JSON.parse(
    JSON.stringify(ghost.hand),
  ) as PlayerState["hand"];
  const spellPoolBefore = cloneSpellPool(state);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.hand, handBefore);
  assert.equal(nextGhost.bloodGemAttack, 5);
  assert.equal(nextGhost.nextTavernSpellDiscount, 7);
  assert.deepEqual(combat.spellPool, spellPoolBefore);

  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const ghostSourceIds = new Set(
    ghostSources.map((source) => source.instanceId),
  );
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        ghostSourceIds.has(event.actorInstanceId ?? "") &&
        (event.type === "handBuff" || event.type === "cardGain"),
    ),
    false,
  );
});
