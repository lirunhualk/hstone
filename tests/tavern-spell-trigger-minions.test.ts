import assert from "node:assert/strict";
import test from "node:test";

import {
  TAVERN_SPELL_DEFINITIONS,
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  tavernSpellIsAvailable,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V20,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const COMPLETED_CARD_METADATA = [
  [
    "BG26_ICC_901",
    "你的回合结束效果会触发两次。",
    "BG26_ICC_901_G",
    "你的回合结束效果会触发三次。",
  ],
  [
    "BG31_178",
    "在你的回合结束时，随机获取一张酒馆法术牌。",
    "BG31_178_G",
    "在你的回合结束时，随机获取2张酒馆法术牌。",
  ],
  [
    "BG28_595",
    "在你的回合结束时，随机获取2张\n酒馆法术牌。",
    "BG28_595_G",
    "在你的回合结束时，随机获取4张酒馆法术牌。",
  ],
  [
    "BG32_821",
    "在你的回合结束时，你的酒馆法术在本局对战中使随从额外获得+1/+1。",
    "BG32_821_G",
    "在你的回合结束时，你的酒馆法术在本局对战中使随从额外获得+2/+2。",
  ],
  [
    "BG33_820",
    "嘲讽。在你的回合结束时，随机获取一张悬赏令。",
    "BG33_820_G",
    "嘲讽。在你的回合结束时，随机获取2张悬赏令。",
  ],
  [
    "BG33_821",
    "战吼，亡语：随机获取一张悬赏令。",
    "BG33_821_G",
    "战吼，亡语：随机获取2张悬赏令。",
  ],
  [
    "BG33_822",
    "进击：随机获取一张悬赏令。",
    "BG33_822_G",
    "进击：随机获取2张悬赏令。",
  ],
  [
    "BG30_117",
    "塑造法术：\n抉择：使你的随从获得+4攻击力；或者+4生命值。",
    "BG30_117_G",
    "塑造法术：\n抉择：使你的随从获得+8攻击力；或者+8生命值。",
  ],
  [
    "BG33_319",
    "塑造法术：随机获取一张能使随从获得属性值的酒馆法术牌。",
    "BG33_319_G",
    "塑造法术：随机获取2张能使随从获得属性值的酒馆法术牌。",
  ],
  [
    "BG32_835",
    "塑造法术：在本局对战中，你的酒馆法术使随从额外获得+1/+1。",
    "BG32_835_G",
    "塑造法术：在本局对战中，你的酒馆法术使随从额外获得+2/+2。",
  ],
  [
    "BG32_880",
    "亡语：在本局对战中，你酒馆法术使随从额外获得+1攻击力。",
    "BG32_880_G",
    "亡语：在本局对战中，你酒馆法术使随从额外获得+2攻击力。",
  ],
  [
    "BG28_551",
    "每当你施放一个酒馆法术，使每个类型的各一个友方随从获得+4/+3。",
    "BG28_551_G",
    "每当你施放一个酒馆法术，使每个类型的各一个友方随从获得+8/+6。",
  ],
  [
    "BG28_741",
    "圣盾。每当你施放一个酒馆法术时，使你具有圣盾的随从获得+4攻击力。",
    "BG28_741_G",
    "圣盾。每当你施放一个酒馆法术时，使你具有圣盾的随从获得+8攻击力。",
  ],
  [
    "BG34_692",
    "在你施放一个酒馆法术后，你的亡灵在本局对战中拥有+2攻击力（无论它们\n在哪）。",
    "BG34_692_G",
    "在你施放一个酒馆法术后，你的亡灵在本局对战中拥有+4攻击力（无论它们在哪）。",
  ],
] as const;

const SPELLCRAFT_GOLDEN_METADATA = [
  [
    "spellcraft-escape-eruption",
    "BG30_117t",
    "抉择：使你的随从获得+4攻击力；或者+4生命值。",
    "BG30_117_Gt",
    "抉择：使你的随从获得+8攻击力；或者+8生命值。",
  ],
  [
    "spellcraft-rime-or-reason",
    "BG33_319t",
    "随机获取一张能使随从获得属性值的酒馆法术牌。",
    "BG33_319_Gt",
    "随机获取2张能使随从获得属性值的酒馆法术牌。",
  ],
  [
    "spellcraft-meditation",
    "BG32_835t",
    "在本局对战中，你的酒馆法术使随从额外获得+1/+1。",
    "BG32_835_Gt",
    "在本局对战中，你的酒馆法术使随从额外获得+2/+2。",
  ],
] as const;

const BOUNTY_DEFINITION_IDS = new Set([
  "tavern-spell-friendly-bounty",
  "tavern-spell-healthy-bounty",
  "tavern-spell-hostile-bounty",
  "tavern-spell-selfish-bounty",
  "tavern-spell-wealthy-bounty",
]);

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

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  assert.ok(definition.goldenCardId);
  assert.ok(definition.goldenDescription);
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId,
    description: definition.goldenDescription,
    ...overrides,
  });
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

function tavernSpellsInHand(player: PlayerState): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance => card.kind === "tavernSpell",
  );
}

function cloneSpellPool(state: GameState): GameState["spellPool"] {
  return structuredClone(state.spellPool);
}

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[] = [
    definitionMinion("BG35_801", "idle-opponent", {
      attack: 0,
      health: 100_000,
    }),
  ],
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

function continueAfterCombat(state: GameState): GameState {
  assert.equal(state.phase, "combat");
  const next = gameReducer(state, { type: "CONTINUE" });
  assert.equal(next.phase, "recruit");
  return next;
}

function playHandMinion(
  state: GameState,
  cardInstanceId: string,
): GameState {
  return gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId,
  });
}

function handFillers(count: number, prefix: string): BoardMinionInstance[] {
  return Array.from({ length: count }, (_, index) =>
    definitionMinion("BG35_801", `${prefix}-${index}`),
  );
}

test("the Tavern-spell trigger batch has exact ordinary and Golden metadata", () => {
  for (const [
    definitionId,
    description,
    goldenCardId,
    goldenDescription,
  ] of COMPLETED_CARD_METADATA) {
    const definition = getMinionDefinition(definitionId);
    assert.equal(definition.cardId, definitionId, definitionId);
    assert.equal(definition.description, description, definitionId);
    assert.equal(definition.goldenCardId, goldenCardId, definitionId);
    assert.equal(
      definition.goldenDescription,
      goldenDescription,
      definitionId,
    );
    assert.equal(definition.effectSupport, "complete", definitionId);
  }

  for (const [
    definitionId,
    cardId,
    description,
    goldenCardId,
    goldenDescription,
  ] of SPELLCRAFT_GOLDEN_METADATA) {
    const definition = getSpellcraftDefinition(definitionId);
    assert.deepEqual(
      [
        definition.cardId,
        definition.description,
        definition.goldenCardId,
        definition.goldenDescription,
      ],
      [cardId, description, goldenCardId, goldenDescription],
      definitionId,
    );
  }
});

test("Drakkari uses the strongest single aura instead of stacking copies", () => {
  const scenarios = [
    { dakkari: [] as const, expected: 1 },
    { dakkari: [false] as const, expected: 2 },
    { dakkari: [true] as const, expected: 3 },
    { dakkari: [false, false] as const, expected: 2 },
    { dakkari: [false, true] as const, expected: 3 },
  ];

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xe100 + index);
    const player = humanPlayer(state);
    player.board = [
      definitionMinion("BG32_821", `felboar-${index}`),
      ...scenario.dakkari.map((golden, dakkariIndex) =>
        golden
          ? goldenMinion(
              "BG26_ICC_901",
              `golden-dakkari-${index}-${dakkariIndex}`,
            )
          : definitionMinion(
              "BG26_ICC_901",
              `dakkari-${index}-${dakkariIndex}`,
            ),
      ),
    ];
    keepOnlyOneOpponent(state);

    state = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(state);
    assert.deepEqual(
      [
        nextPlayer.tavernSpellAttackBonus,
        nextPlayer.tavernSpellHealthBonus,
      ],
      [scenario.expected, scenario.expected],
    );
  }
});

test("Drakkari preserves source order for existing end-of-turn effect kinds", () => {
  let state = createGame(0xe110);
  const player = humanPlayer(state);
  const beast = definitionMinion("BG35_801", "lightfang-beast", {
    tribe: "beast",
    tribes: ["beast"],
    attack: 5,
    health: 7,
  });
  const dragon = definitionMinion("BG35_801", "lightfang-dragon", {
    tribe: "dragon",
    tribes: ["dragon"],
    attack: 11,
    health: 13,
  });
  player.board = [
    definitionMinion("BG35_433", "ordered-blood-gem"),
    definitionMinion("BG34_684", "ordered-fixed-spell"),
    definitionMinion("lightfang-enforcer", "ordered-one-per-tribe"),
    beast,
    dragon,
    definitionMinion("BG26_ICC_901", "ordered-dakkari"),
  ];
  player.hand = [];
  keepOnlyOneOpponent(state);

  state = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(state);
  assert.deepEqual(
    nextPlayer.hand.map((card) => card.kind),
    ["bloodGem", "bloodGem", "tavernSpell", "tavernSpell"],
  );
  assert.ok(
    tavernSpellsInHand(nextPlayer).every(
      (card) => card.definitionId === "tavern-spell-gem-confiscation",
    ),
  );
  assert.deepEqual(
    nextPlayer.board
      .filter((minion) =>
        [beast.instanceId, dragon.instanceId].includes(minion.instanceId),
      )
      .map((minion) => [minion.attack, minion.health]),
    [
      [13, 15],
      [19, 21],
    ],
  );
});

test("Drakkari does not accelerate periodic counters and repeats only the due reward", () => {
  for (const [index, dakkariGolden] of [false, true].entries()) {
    let state = createGame(0xe120 + index);
    state.activeTribes = ["dragon"];
    for (const definitionId of Object.keys(state.pool)) {
      state.pool[definitionId] = 0;
    }
    state.pool.BG34_630 = 20;
    const player = humanPlayer(state);
    player.tavernTier = 6;
    player.hand = [];
    player.board = [
      definitionMinion("BG26_529", `periodic-dragon-${index}`, {
        effectCounters: { periodicEndOfTurn: 2 },
      }),
      dakkariGolden
        ? goldenMinion("BG26_ICC_901", `periodic-dakkari-${index}`)
        : definitionMinion(
            "BG26_ICC_901",
            `periodic-dakkari-${index}`,
          ),
    ];
    keepOnlyOneOpponent(state);
    const copiesBefore = state.pool.BG34_630 ?? 0;

    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(state.pool.BG34_630, copiesBefore);
    assert.equal(
      humanPlayer(state).board.find(
        (minion) => minion.instanceId === `periodic-dragon-${index}`,
      )?.effectCounters?.periodicEndOfTurn,
      1,
    );

    state = continueAfterCombat(state);
    keepOnlyOneOpponent(state);
    const copiesBeforeDueReward = state.pool.BG34_630 ?? 0;
    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      copiesBeforeDueReward - (state.pool.BG34_630 ?? 0),
      dakkariGolden ? 3 : 2,
    );
    assert.equal(
      humanPlayer(state).board.find(
        (minion) => minion.instanceId === `periodic-dragon-${index}`,
      )?.effectCounters?.periodicEndOfTurn,
      3,
    );
  }
});

test("random end-of-turn Tavern Spells ignore Tavern Tier, respect lobby tribes, and never reserve the pool", () => {
  for (const [index, scenario] of [
    {
      sourceId: "BG31_178",
      sourceGolden: true,
      dakkariGolden: false,
      fillerCount: 0,
      expectedGenerated: 4,
    },
    {
      sourceId: "BG28_595",
      sourceGolden: true,
      dakkariGolden: true,
      fillerCount: 2,
      expectedGenerated: 8,
    },
  ].entries()) {
    let state = createGame(0xe130 + index);
    state.activeTribes = ["naga"];
    const player = humanPlayer(state);
    player.tavernTier = 1;
    player.hand = handFillers(scenario.fillerCount, `random-spell-filler-${index}`);
    player.board = [
      scenario.sourceGolden
        ? goldenMinion(scenario.sourceId, `random-spell-source-${index}`)
        : definitionMinion(
            scenario.sourceId,
            `random-spell-source-${index}`,
          ),
      scenario.dakkariGolden
        ? goldenMinion("BG26_ICC_901", `random-spell-dakkari-${index}`)
        : definitionMinion(
            "BG26_ICC_901",
            `random-spell-dakkari-${index}`,
          ),
    ];
    keepOnlyOneOpponent(state);
    const poolBefore = cloneSpellPool(state);

    state = gameReducer(state, { type: "END_TURN" });
    const spells = tavernSpellsInHand(humanPlayer(state));
    assert.equal(spells.length, scenario.expectedGenerated);
    assert.ok(
      spells.some((spell) => spell.tier > player.tavernTier),
      "generation must not be capped by the owner's Tavern Tier",
    );
    assert.ok(
      spells.every((spell) =>
        tavernSpellIsAvailable(
          getTavernSpellDefinition(spell.definitionId),
          state.activeTribes,
        ),
      ),
    );
    assert.deepEqual(state.spellPool, poolBefore);
    assert.ok(humanPlayer(state).hand.length <= 10);
  }
});

test("Lost City Looter generates only the five Bounties with Golden and Drakkari scaling", () => {
  let state = createGame(0xe140);
  state.activeTribes = ["pirate"];
  const player = humanPlayer(state);
  player.hand = [];
  player.board = [
    goldenMinion("BG33_820", "golden-lost-city-looter"),
    definitionMinion("BG26_ICC_901", "bounty-dakkari"),
  ];
  keepOnlyOneOpponent(state);
  const poolBefore = cloneSpellPool(state);

  state = gameReducer(state, { type: "END_TURN" });
  const bounties = tavernSpellsInHand(humanPlayer(state));
  assert.equal(bounties.length, 4);
  assert.ok(
    bounties.every((spell) => BOUNTY_DEFINITION_IDS.has(spell.definitionId)),
  );
  assert.equal(
    new Set(
      TAVERN_SPELL_DEFINITIONS.filter((spell) =>
        BOUNTY_DEFINITION_IDS.has(spell.id),
      ).map((spell) => spell.id),
    ).size,
    5,
  );
  assert.deepEqual(state.spellPool, poolBefore);
});

test("the three Naga generate ordinary and real Golden Spellcraft cards", () => {
  const sources = [
    ["BG30_117", "spellcraft-escape-eruption"],
    ["BG33_319", "spellcraft-rime-or-reason"],
    ["BG32_835", "spellcraft-meditation"],
  ] as const;

  for (const [sourceId, spellcraftId] of sources) {
    for (const golden of [false, true]) {
      let state = createGame(
        0xe150 +
          sources.findIndex(([candidate]) => candidate === sourceId) * 2 +
          Number(golden),
      );
      const player = humanPlayer(state);
      const source = golden
        ? goldenMinion(sourceId, `${sourceId}-golden-source`)
        : definitionMinion(sourceId, `${sourceId}-ordinary-source`);
      player.board = [];
      player.hand = [source];

      state = playHandMinion(state, source.instanceId);
      const generated = humanPlayer(state).hand.find(
        (card): card is SpellcraftSpellInstance =>
          card.kind === "spellcraft" &&
          card.definitionId === spellcraftId,
      );
      assert.ok(generated);
      const definition = getSpellcraftDefinition(spellcraftId);
      assert.deepEqual(
        [
          generated.cardId,
          generated.description,
          generated.effectMultiplier,
        ],
        golden
          ? [
              definition.goldenCardId,
              definition.goldenDescription,
              2,
            ]
          : [definition.cardId, definition.description, 1],
      );
    }
  }
});

test("Escape Eruption handles human choice and deterministic AI choice", () => {
  let state = createGame(0xe160);
  const player = humanPlayer(state);
  const first = definitionMinion("BG35_801", "eruption-human-first", {
    attack: 3,
    health: 5,
  });
  const second = definitionMinion("BG35_801", "eruption-human-second", {
    attack: 7,
    health: 11,
  });
  player.board = [first, second];
  player.hand = [
    spellcraft("spellcraft-escape-eruption", "golden-eruption", 2),
  ];

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "golden-eruption",
  });
  assert.equal(state.pendingInteraction?.kind, "spellcraftChoice");
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "spellcraftChoice");
  const unresolved = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "invalid-eruption-choice",
  });
  assert.deepEqual(
    humanPlayer(unresolved).board.map((minion) => [
      minion.attack,
      minion.health,
    ]),
    [
      [3, 5],
      [7, 11],
    ],
  );
  state = gameReducer(unresolved, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "escapeEruptionAttack",
  });
  assert.deepEqual(
    humanPlayer(state).board.map((minion) => [
      minion.attack,
      minion.health,
    ]),
    [
      [11, 5],
      [15, 11],
    ],
  );

  state = createGame(0xe161);
  const ai = keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "eruption-ai-first", {
      attack: 1,
      health: 10,
    }),
    definitionMinion("BG35_801", "eruption-ai-second", {
      attack: 2,
      health: 20,
    }),
  ]);
  ai.hand = [
    spellcraft("spellcraft-escape-eruption", "ai-eruption"),
  ];
  humanPlayer(state).board = [
    definitionMinion("BG35_801", "eruption-ai-opponent", {
      attack: 0,
      health: 100_000,
    }),
  ];

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find((candidate) => candidate.id === ai.id);
  assert.ok(nextAi);
  assert.deepEqual(
    nextAi.board
      .map((minion) => [minion.attack, minion.health])
      .sort((left, right) => left[0] - right[0]),
    [
      [5, 10],
      [6, 20],
    ],
  );
});

test("Meditation scales permanently while Rime or Reason generates one or two cards up to the hand limit", () => {
  let state = createGame(0xe170);
  state.activeTribes = ["naga"];
  let player = humanPlayer(state);
  player.hand = [
    spellcraft("spellcraft-meditation", "ordinary-meditation"),
    spellcraft("spellcraft-meditation", "golden-meditation", 2),
    spellcraft("spellcraft-rime-or-reason", "ordinary-rime"),
    spellcraft("spellcraft-rime-or-reason", "golden-rime", 2),
  ];
  const poolBefore = cloneSpellPool(state);

  for (const cardInstanceId of [
    "ordinary-meditation",
    "golden-meditation",
    "ordinary-rime",
    "golden-rime",
  ]) {
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId,
    });
  }
  player = humanPlayer(state);
  assert.deepEqual(
    [player.tavernSpellAttackBonus, player.tavernSpellHealthBonus],
    [3, 3],
  );
  assert.equal(tavernSpellsInHand(player).length, 3);
  assert.deepEqual(state.spellPool, poolBefore);

  state = createGame(0xe171);
  state.activeTribes = ["naga"];
  player = humanPlayer(state);
  player.hand = [
    ...handFillers(9, "rime-limit-filler"),
    spellcraft("spellcraft-rime-or-reason", "limited-golden-rime", 2),
  ];
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "limited-golden-rime",
  });
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(tavernSpellsInHand(humanPlayer(state)).length, 1);
});

test("Shipwrecked Pirate scales its Battlecry and Deathrattle with Brann, Titus, Golden, and hand limits", () => {
  let state = createGame(0xe180);
  state.activeTribes = ["pirate"];
  let player = humanPlayer(state);
  const source = goldenMinion("BG33_821", "golden-shipwrecked-pirate", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  player.board = [
    definitionMinion("BG_LOE_077", "golden-bounty-brann", {
      golden: true,
      attack: 0,
      health: 1_000,
    }),
    definitionMinion("BG25_354", "golden-bounty-titus", {
      golden: true,
      attack: 0,
      health: 1_000,
    }),
  ];
  player.hand = [source];
  const poolBefore = cloneSpellPool(state);

  state = playHandMinion(state, source.instanceId);
  player = humanPlayer(state);
  assert.equal(tavernSpellsInHand(player).length, 6);
  assert.ok(
    tavernSpellsInHand(player).every((spell) =>
      BOUNTY_DEFINITION_IDS.has(spell.definitionId),
    ),
  );

  keepOnlyOneOpponent(
    state,
    Array.from({ length: 4 }, (_, index) =>
      definitionMinion("BG35_801", `shipwrecked-enemy-${index}`, {
        attack: 100,
        health: 100,
      }),
    ),
  );
  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(tavernSpellsInHand(player).length, 10);
  const deathrattleEvents =
    state.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === source.instanceId,
    ) ?? [];
  assert.equal(deathrattleEvents.length, 6);
  assert.deepEqual(
    deathrattleEvents.map((event) => event.cardGainResult),
    ["added", "added", "added", "added", "handFull", "handFull"],
  );
  assert.deepEqual(state.spellPool, poolBefore);
});

test("Top Robber grants one Bounty per Windfury strike and reports a full hand", () => {
  let state = createGame(0xe190);
  state.activeTribes = ["pirate"];
  const player = humanPlayer(state);
  const robber = goldenMinion("BG33_822", "golden-top-robber", {
    attack: 1,
    health: 100,
    windfury: true,
  });
  player.board = [
    robber,
    definitionMinion("BG35_801", "robber-inert-friend", {
      attack: 0,
      health: 100,
    }),
  ];
  player.hand = handFillers(8, "robber-limit-filler");
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "robber-two-hit-target", {
      attack: 0,
      health: 2,
      taunt: true,
    }),
  ]);
  const poolBefore = cloneSpellPool(state);

  state = gameReducer(state, { type: "END_TURN" });
  const gainEvents =
    state.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === robber.instanceId,
    ) ?? [];
  assert.equal(
    state.lastBattle?.events.filter(
      (event) =>
        event.type === "attack" &&
        event.actorInstanceId === robber.instanceId,
    ).length,
    2,
  );
  assert.deepEqual(
    gainEvents.map((event) => event.cardGainResult),
    ["added", "added", "handFull", "handFull"],
  );
  assert.equal(tavernSpellsInHand(humanPlayer(state)).length, 2);
  assert.ok(
    tavernSpellsInHand(humanPlayer(state)).every((spell) =>
      BOUNTY_DEFINITION_IDS.has(spell.definitionId),
    ),
  );
  assert.deepEqual(state.spellPool, poolBefore);
});

test("AI Bounty rewards persist without exposing the generated card identity", () => {
  let state = createGame(0xe1a0);
  state.activeTribes = ["pirate"];
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG35_801", "private-bounty-opponent", {
      attack: 100,
      health: 100,
    }),
  ];
  const source = definitionMinion(
    "BG33_821",
    "private-ai-shipwrecked-pirate",
    {
      attack: 0,
      health: 100,
      taunt: true,
    },
  );
  const ai = keepOnlyOneOpponent(state, [
    source,
    ...Array.from({ length: 6 }, (_, index) =>
      definitionMinion("BG35_801", `private-bounty-filler-${index}`, {
        attack: 0,
        health: 1_000,
      }),
    ),
  ]);
  ai.hand = [];

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find((candidate) => candidate.id === ai.id);
  assert.ok(nextAi);
  const rewards = tavernSpellsInHand(nextAi);
  assert.equal(rewards.length, 1);
  assert.ok(BOUNTY_DEFINITION_IDS.has(rewards[0].definitionId));
  const event = state.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorInstanceId === source.instanceId,
  );
  assert.ok(event);
  assert.equal(event.cardName, undefined);
  assert.equal(event.targetInstanceId, undefined);
  assert.equal(event.minion, undefined);
  assert.equal(
    [...BOUNTY_DEFINITION_IDS].some((definitionId) =>
      JSON.stringify(event).includes(
        getTavernSpellDefinition(definitionId).name,
      ),
    ),
    false,
  );
});

test("Friendly Geist Deathrattle scales in combat and Recruit", () => {
  for (const [index, scenario] of [
    { golden: false, titusGolden: null, expected: 1 },
    { golden: true, titusGolden: true, expected: 6 },
  ].entries()) {
    let state = createGame(0xe1b0 + index);
    const player = humanPlayer(state);
    const source = scenario.golden
      ? goldenMinion("BG32_880", `combat-geist-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        })
      : definitionMinion("BG32_880", `combat-geist-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        });
    player.board = [
      source,
      ...(scenario.titusGolden === null
        ? []
        : [
            definitionMinion("BG25_354", `combat-geist-titus-${index}`, {
              golden: true,
              attack: 0,
              health: 1_000,
            }),
          ]),
    ];
    keepOnlyOneOpponent(
      state,
      Array.from({ length: player.board.length + 1 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `combat-geist-enemy-${index}-${enemyIndex}`,
          {
            attack: 100,
            health: 100,
          },
        ),
      ),
    );

    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      humanPlayer(state).tavernSpellAttackBonus,
      scenario.expected,
    );
    assert.equal(humanPlayer(state).tavernSpellHealthBonus, 0);
  }

  let state = createGame(0xe1b5);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG25_354", "recruit-geist-titus", {
      attack: 0,
      health: 100,
    }),
  ];
  const recruitGeist = goldenMinion("BG32_880", "recruit-golden-geist", {
    destroyAfterPlayThroughRound: state.round,
  });
  player.hand = [recruitGeist];
  state = playHandMinion(state, recruitGeist.instanceId);
  player = humanPlayer(state);
  assert.equal(
    player.board.some(
      (minion) => minion.instanceId === recruitGeist.instanceId,
    ),
    false,
  );
  assert.equal(player.tavernSpellAttackBonus, 4);
  assert.equal(player.tavernSpellHealthBonus, 0);
});

test("ghost Bounty and Tavern Spell Deathrattles cannot mutate their former owner", () => {
  const state = createGame(0xe1c0);
  state.activeTribes = ["pirate", "undead"];
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
      definitionMinion("BG35_801", `ghost-trigger-opponent-${index}`, {
        attack: 100,
        health: 100,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const ghostSources = [
    definitionMinion("BG33_821", "ghost-shipwrecked-pirate", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG32_880", "ghost-friendly-geist", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  ghost.board = ghostSources;
  ghost.hand = [
    definitionMinion("BG25_001", "ghost-trigger-hand-sentinel"),
  ];
  ghost.tavernSpellAttackBonus = 7;
  const handBefore = structuredClone(ghost.hand);
  const poolBefore = cloneSpellPool(state);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.hand, handBefore);
  assert.equal(nextGhost.tavernSpellAttackBonus, 7);
  assert.deepEqual(combat.spellPool, poolBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const sourceIds = new Set(
    ghostSources.map((source) => source.instanceId),
  );
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        sourceIds.has(event.actorInstanceId ?? ""),
    ),
    false,
  );
});

test("Nalaa assigns distinct dual-type and All minions at most once per Tavern Spell", () => {
  let state = createGame(0xe1d0);
  const player = humanPlayer(state);
  const nalaa = goldenMinion("BG28_551", "golden-nalaa");
  const targets = [
    definitionMinion("BG35_801", "nalaa-beast", {
      tribe: "beast",
      tribes: ["beast"],
      attack: 1,
      health: 2,
    }),
    definitionMinion("BG35_801", "nalaa-dual", {
      tribe: "beast",
      tribes: ["beast", "demon"],
      attack: 3,
      health: 4,
    }),
    definitionMinion("BG35_801", "nalaa-all", {
      tribe: "all",
      tribes: ["all"],
      attack: 5,
      health: 6,
    }),
    definitionMinion("BG35_801", "nalaa-murloc", {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 7,
      health: 8,
    }),
  ];
  const before = new Map(
    targets.map((minion) => [
      minion.instanceId,
      [minion.attack, minion.health] as const,
    ]),
  );
  player.board = [nalaa, ...targets];
  player.hand = [
    tavernSpell("tavern-spell-tavern-coin", "nalaa-tavern-coin"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "nalaa-tavern-coin",
  });
  const nextPlayer = humanPlayer(state);
  for (const target of targets) {
    const original = before.get(target.instanceId);
    assert.ok(original);
    const nextTarget = nextPlayer.board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(nextTarget);
    assert.deepEqual(
      [
        nextTarget.attack - original[0],
        nextTarget.health - original[1],
      ],
      [8, 6],
      target.instanceId,
    );
  }
  const nextNalaa = nextPlayer.board.find(
    (minion) => minion.instanceId === nalaa.instanceId,
  );
  assert.ok(nextNalaa);
  assert.deepEqual(
    [nextNalaa.attack, nextNalaa.health],
    [nalaa.attack, nalaa.health],
  );
});

test("one-per-tribe matching uses seeded tie-breaking without double-buffing an instance", () => {
  const selectedSides = new Set<string>();
  for (let index = 0; index < 16; index += 1) {
    let state = createGame(0xe1d8 + index);
    const player = humanPlayer(state);
    const left = definitionMinion("BG35_801", `seeded-left-${index}`, {
      tribe: "beast",
      tribes: ["beast"],
      attack: 1,
      health: 1,
    });
    const right = definitionMinion("BG35_801", `seeded-right-${index}`, {
      tribe: "beast",
      tribes: ["beast"],
      attack: 1,
      health: 1,
    });
    player.board = [
      definitionMinion("BG28_551", `seeded-nalaa-${index}`),
      left,
      right,
    ];
    player.hand = [
      tavernSpell(
        "tavern-spell-tavern-coin",
        `seeded-one-per-tribe-coin-${index}`,
      ),
    ];

    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `seeded-one-per-tribe-coin-${index}`,
    });
    const buffed = humanPlayer(state).board.filter(
      (minion) =>
        minion.instanceId === left.instanceId ||
        minion.instanceId === right.instanceId,
    ).filter((minion) => minion.attack === 5 && minion.health === 4);
    assert.equal(buffed.length, 1);
    selectedSides.add(
      buffed[0].instanceId.includes("left") ? "left" : "right",
    );
  }
  assert.deepEqual([...selectedSides].sort(), ["left", "right"]);
});

test("Charged Empress checks the current Divine Shield set on every completed cast", () => {
  let state = createGame(0xe1e0);
  let player = humanPlayer(state);
  const empress = goldenMinion("BG28_741", "golden-charged-empress");
  const shielded = definitionMinion("BG35_801", "empress-shielded", {
    attack: 2,
    health: 3,
    divineShield: true,
  });
  const unshielded = definitionMinion("BG35_801", "empress-unshielded", {
    attack: 5,
    health: 7,
    divineShield: false,
  });
  player.board = [empress, shielded, unshielded];
  player.hand = [
    tavernSpell("tavern-spell-tavern-coin", "empress-first-coin"),
    tavernSpell("tavern-spell-tavern-coin", "empress-second-coin"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "empress-first-coin",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => minion.attack),
    [empress.attack + 8, shielded.attack + 8, unshielded.attack],
  );

  const nextEmpress = player.board.find(
    (minion) => minion.instanceId === empress.instanceId,
  );
  const nextUnshielded = player.board.find(
    (minion) => minion.instanceId === unshielded.instanceId,
  );
  assert.ok(nextEmpress);
  assert.ok(nextUnshielded);
  nextEmpress.divineShield = false;
  nextUnshielded.divineShield = true;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "empress-second-coin",
  });
  assert.deepEqual(
    humanPlayer(state).board.map((minion) => minion.attack),
    [
      empress.attack + 8,
      shielded.attack + 16,
      unshielded.attack + 8,
    ],
  );
});

test("Forsaken Weaver buffs current hand minions and future acquired Undead", () => {
  let state = createGame(0xe1f0);
  state.activeTribes = ["undead"];
  let player = humanPlayer(state);
  const weaver = goldenMinion("BG34_692", "golden-forsaken-weaver");
  const boardUndead = definitionMinion("BG25_001", "weaver-board-undead");
  const handUndead = definitionMinion("BG25_009", "weaver-hand-undead");
  const boardAttackBefore = boardUndead.attack;
  const handAttackBefore = handUndead.attack;
  player.board = [weaver, boardUndead];
  player.hand = [
    handUndead,
    tavernSpell("tavern-spell-tavern-coin", "weaver-coin"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "weaver-coin",
  });
  player = humanPlayer(state);
  assert.equal(player.undeadArmyAttackBonus, 4);
  assert.equal(player.undeadArmyHealthBonus, 0);
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === boardUndead.instanceId,
    )?.attack,
    boardAttackBefore + 4,
  );
  assert.equal(
    player.hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.instanceId === handUndead.instanceId,
    )?.attack,
    handAttackBefore + 4,
  );

  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG25_001 = 20;
  player.tavernTier = 1;
  player.gold = 10;
  player.freeRefreshes = 1;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  const shopIndex = player.shop.findIndex(
    (minion) => minion.definitionId === "BG25_001",
  );
  assert.ok(shopIndex >= 0);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex });
  player = humanPlayer(state);
  const futureUndead = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG25_001" &&
      card.instanceId !== boardUndead.instanceId,
  );
  assert.ok(futureUndead);
  assert.equal(
    futureUndead.attack,
    getMinionDefinition("BG25_001").attack + 4,
  );
});

test("after-cast triggers wait for a successful Tavern Spell and the final chained Discover", () => {
  let state = createGame(0xe200);
  state.activeTribes = ["beast"];
  let player = humanPlayer(state);
  player.tavernTier = 1;
  const captain = definitionMinion("BG27_005", "after-cast-captain");
  const firstBeast = definitionMinion("BG35_801", "after-cast-beast-a", {
    tribe: "beast",
    tribes: ["beast"],
    attack: 5,
    health: 7,
  });
  const secondBeast = definitionMinion("BG35_801", "after-cast-beast-b", {
    tribe: "beast",
    tribes: ["beast"],
    attack: 3,
    health: 9,
  });
  const captainAttackBefore = captain.attack;
  player.board = [captain, firstBeast, secondBeast];
  player.hand = [
    tavernSpell("tavern-spell-tavern-dish-banana", "invalid-banana"),
    bloodGem("non-tavern-blood-gem"),
    spellcraft("spellcraft-glowing-crown", "non-tavern-spellcraft"),
    tavernSpell("tavern-spell-tavern-dish-banana", "valid-banana"),
    tavernSpell("tavern-spell-time-management", "pending-choice-spell"),
    tavernSpell("tavern-spell-planar-telescope", "pending-discover-spell"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "invalid-banana",
    targetInstanceId: "missing-target",
  });
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 0);
  assert.equal(humanPlayer(state).board[0].attack, captainAttackBefore);

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "non-tavern-blood-gem",
    targetInstanceId: firstBeast.instanceId,
  });
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "non-tavern-spellcraft",
    targetInstanceId: firstBeast.instanceId,
  });
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 0);
  assert.equal(humanPlayer(state).board[0].attack, captainAttackBefore);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "valid-banana",
    targetInstanceId: firstBeast.instanceId,
  });
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 1);
  assert.equal(humanPlayer(state).board[0].attack, captainAttackBefore + 1);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "pending-choice-spell",
  });
  assert.equal(state.pendingInteraction?.kind, "tavernSpellChoice");
  const choice = state.pendingInteraction;
  assert.ok(choice?.kind === "tavernSpellChoice");
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 1);
  const invalidChoice = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: choice.interactionId,
    optionInstanceId: "invalid-choice",
  });
  assert.equal(humanPlayer(invalidChoice).tavernSpellsCastThisTurn, 1);
  state = gameReducer(invalidChoice, {
    type: "RESOLVE_INTERACTION",
    interactionId: choice.interactionId,
    optionInstanceId: "timeManagementNow",
  });
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 2);
  assert.equal(humanPlayer(state).board[0].attack, captainAttackBefore + 4);

  player = humanPlayer(state);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG27_004 = 20;
  state.pool.BG31_803 = 20;
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "pending-discover-spell",
  });
  assert.equal(state.pendingInteraction?.kind, "discover");
  const firstDiscover = state.pendingInteraction;
  assert.ok(firstDiscover?.kind === "discover");
  firstDiscover.remainingDiscoveries = 2;
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 2);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: firstDiscover.interactionId,
    optionInstanceId: firstDiscover.options[0].instanceId,
  });
  const secondDiscover = state.pendingInteraction;
  assert.ok(secondDiscover?.kind === "discover");
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 2);
  assert.equal(humanPlayer(state).board[0].attack, captainAttackBefore + 4);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: secondDiscover.interactionId,
    optionInstanceId: secondDiscover.options[0].instanceId,
  });
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 3);
  assert.equal(humanPlayer(state).board[0].attack, captainAttackBefore + 5);
});

test("schema 11 v20 saves preserve pending trigger state through JSON migration", () => {
  let state = createGame(0xe210);
  state.activeTribes = ["beast"];
  state.round = 8;
  state.rngState = 0x1234abcd;
  let player = humanPlayer(state);
  player.tavernTier = 1;
  player.tavernSpellAttackBonus = 5;
  player.tavernSpellHealthBonus = 6;
  player.undeadArmyAttackBonus = 7;
  player.deepBlueBonus = 3;
  player.astralAutomatonsSummoned = 4;
  player.nextTavernSpellDiscount = 2;
  const savedNalaa = definitionMinion("BG28_551", "saved-v20-nalaa", {
    effectSupport: "partial",
    effectCounters: { savedCounter: 9 },
    temporaryGoldenCrabDeathrattles: 2,
  });
  player.board = [
    savedNalaa,
    definitionMinion("BG27_004", "saved-v20-beast", {
      tribe: "beast",
      tribes: ["beast"],
    }),
  ];
  player.pendingSpellcraft = [
    {
      sourceInstanceId: savedNalaa.instanceId,
      definitionId: "spellcraft-rime-or-reason",
      golden: true,
      round: state.round,
    },
  ];
  player.hand = [
    tavernSpell("tavern-spell-planar-telescope", "saved-v20-telescope"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG27_004 = 20;
  state.pool.BG31_803 = 20;
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "saved-v20-telescope",
  });
  assert.equal(state.pendingInteraction?.kind, "discover");
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.completionSource, "tavernSpellCast");
  for (const option of pending.options) {
    option.effectSupport = "partial";
  }
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V20;
  const savedRngState = state.rngState;

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(migrated.round, 8);
  assert.equal(migrated.rngState, savedRngState);
  player = humanPlayer(migrated);
  assert.deepEqual(
    [
      player.tavernSpellAttackBonus,
      player.tavernSpellHealthBonus,
      player.undeadArmyAttackBonus,
      player.deepBlueBonus,
      player.astralAutomatonsSummoned,
      player.nextTavernSpellDiscount,
    ],
    [5, 6, 7, 3, 4, 2],
  );
  assert.deepEqual(
    player.pendingSpellcraft,
    humanPlayer(state).pendingSpellcraft,
  );
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === savedNalaa.instanceId,
    )?.effectSupport,
    "complete",
  );
  assert.deepEqual(
    player.board.find(
      (minion) => minion.instanceId === savedNalaa.instanceId,
    )?.effectCounters,
    { savedCounter: 9 },
  );
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === savedNalaa.instanceId,
    )?.temporaryGoldenCrabDeathrattles,
    2,
  );
  assert.equal(migrated.pendingInteraction?.kind, "discover");
  if (migrated.pendingInteraction?.kind === "discover") {
    assert.equal(
      migrated.pendingInteraction.completionSource,
      "tavernSpellCast",
    );
    assert.ok(
      migrated.pendingInteraction.options.every(
        (option) =>
          option.effectSupport ===
          (getMinionDefinition(option.definitionId).effectSupport ??
            "complete"),
      ),
    );
  }
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)), migrated);

  const wrongVersion = JSON.parse(JSON.stringify(state)) as GameState;
  wrongVersion.contentVersion =
    "battlegrounds-36.0.3-247416-wrong-version";
  assert.equal(normalizePersistedGameState(wrongVersion), null);
});
