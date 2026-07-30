import assert from "node:assert/strict";
import test from "node:test";

import {
  TAVERN_SPELL_DEFINITIONS,
  createGame,
  gameReducer,
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
  LEGACY_SCHEMA_11_CONTENT_VERSION,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V16,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V17,
  migrateLegacyGameState,
  migrateSchema11GameState,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function clearSharedPool(state: GameState): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
}

function tavernCoins(player: PlayerState): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell" &&
      card.definitionId === "tavern-spell-tavern-coin",
  );
}

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

const EARLY_COMPLETE_CARD_IDS = [
  "BG26_135",
  "BG33_140",
  "BG31_815",
  "BG23_002",
  "BGS_115",
  "BG22_202",
  "BG25_011",
  "BG25_013",
] as const;

test("the early-game economy batch is explicitly marked complete", () => {
  for (const definitionId of EARLY_COMPLETE_CARD_IDS) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
      `${definitionId} must not advertise full support before its whole text works`,
    );
  }
});

test("v15 saves refresh newly completed early minions without losing the run", () => {
  const state = createGame(0xe0ff);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG26_135", "saved-busker", {
      effectSupport: "partial",
    }),
  ];
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION;
  for (const savedPlayer of state.players) {
    const legacyPlayer = savedPlayer as unknown as Record<
      string,
      unknown
    >;
    delete legacyPlayer.astralAutomatonsSummoned;
    delete legacyPlayer.eternalKnightsDied;
  }

  const migrated = migrateSchema11GameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(
    humanPlayer(migrated).board[0]?.effectSupport,
    "complete",
  );
  assert.equal(migrated.round, state.round);
  assert.equal(migrated.rngState, state.rngState);
  assert.ok(
    migrated.players.every(
      (savedPlayer) =>
        savedPlayer.astralAutomatonsSummoned === 0 &&
        savedPlayer.eternalKnightsDied === 0,
    ),
  );
  assert.equal(
    (migrateLegacyGameState(JSON.parse(JSON.stringify(state))) as GameState)
      .contentVersion,
    migrated.contentVersion,
  );
  const restoredFromCurrentKey = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(restoredFromCurrentKey);
  assert.equal(
    restoredFromCurrentKey.contentVersion,
    migrated.contentVersion,
  );
  assert.equal(
    humanPlayer(restoredFromCurrentKey).board[0]?.effectSupport,
    "complete",
  );

  const current = createGame(0xe0fe);
  assert.equal(normalizePersistedGameState(current), current);
});

test("v16 saves gain an empty pending Spellcraft queue during v18 migration", () => {
  const state = createGame(0xe0fd);
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V16;
  for (const player of state.players) {
    delete (player as Partial<PlayerState>).pendingSpellcraft;
    const legacyPlayer = player as unknown as Record<string, unknown>;
    delete legacyPlayer.astralAutomatonsSummoned;
    delete legacyPlayer.eternalKnightsDied;
  }

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.ok(
    migrated.players.every(
      (player) =>
        Array.isArray(player.pendingSpellcraft) &&
        player.pendingSpellcraft.length === 0 &&
        player.astralAutomatonsSummoned === 0 &&
        player.eternalKnightsDied === 0,
    ),
  );
});

test("v17 saves preserve pending Spellcraft while gaining v18 persistent history", () => {
  const state = createGame(0xe0fc);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const automatonDefinition = getMinionDefinition("BG_TTN_401");
  player.hand = [
    definitionMinion(template, "BG_TTN_401", "saved-automaton", {
      cardId: automatonDefinition.cardId,
      description: automatonDefinition.description,
      attack: automatonDefinition.attack * 2,
      health: automatonDefinition.health * 2,
      golden: true,
      effectSupport: "partial",
    }),
  ];
  player.pendingSpellcraft = [
    {
      sourceInstanceId: "saved-guitarist",
      definitionId: "spellcraft-sick-riffs",
      golden: false,
      round: state.round,
    },
  ];
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V17;
  for (const savedPlayer of state.players) {
    const legacyPlayer = savedPlayer as unknown as Record<
      string,
      unknown
    >;
    delete legacyPlayer.astralAutomatonsSummoned;
    delete legacyPlayer.eternalKnightsDied;
  }

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.deepEqual(
    humanPlayer(migrated).pendingSpellcraft,
    player.pendingSpellcraft,
  );
  assert.ok(
    migrated.players.every(
      (savedPlayer) =>
        savedPlayer.astralAutomatonsSummoned === 0 &&
        savedPlayer.eternalKnightsDied === 0,
    ),
  );
  const migratedAutomaton = minionsInHand(humanPlayer(migrated))[0];
  assert.ok(migratedAutomaton);
  assert.equal(migratedAutomaton.effectSupport, "complete");
  assert.equal(migratedAutomaton.cardId, "BG_TTN_401_G");
  assert.equal(
    migratedAutomaton.description,
    automatonDefinition.goldenDescription,
  );
  assert.equal(migratedAutomaton.whereverAttackBonus, 0);
  assert.equal(migratedAutomaton.whereverHealthBonus, 0);
  assert.equal(migratedAutomaton.astralAutomatonSummoned, false);
  assert.equal(migratedAutomaton.ancientSoulFriendlyDeaths, 0);
});

test("current saves repair an empty Tavern Spell pool without discarding the run", () => {
  const state = createGame(0xe0fb);
  state.round = 9;
  const existingOffers = state.players.flatMap((player) => [
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((spell) => spell.instanceId),
  ]);
  state.spellPool = {};

  const normalized = normalizePersistedGameState(state);
  assert.equal(normalized, state);
  assert.equal(state.round, 9);
  assert.deepEqual(
    Object.keys(state.spellPool).sort(),
    TAVERN_SPELL_DEFINITIONS.map((definition) => definition.id).sort(),
  );
  assert.ok(
    Object.values(state.spellPool).every(
      (copies) =>
        Number.isInteger(copies) &&
        copies >= 0,
    ),
  );
  assert.ok(
    Object.values(state.spellPool).some((copies) => copies > 0),
  );
  assert.deepEqual(
    state.players.flatMap((player) => [
      ...(player.spellShop ? [player.spellShop.instanceId] : []),
      ...player.additionalSpellShop.map((spell) => spell.instanceId),
    ]),
    existingOffers,
  );
});

test("Southsea Busker grants next-turn Gold with Golden and Brann scaling", () => {
  const scenarios = [
    { golden: false, brann: false, expected: 1 },
    { golden: true, brann: false, expected: 2 },
    { golden: false, brann: true, expected: 2 },
    { golden: true, brann: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xe100 + index);
    const player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    player.board = scenario.brann
      ? [definitionMinion(template, "BG_LOE_077", `brann-${index}`)]
      : [];
    player.hand = [
      definitionMinion(
        template,
        "BG26_135",
        `busker-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG26_135").attack * 2,
              health: getMinionDefinition("BG26_135").health * 2,
            }
          : {},
      ),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `busker-${index}`,
    });
    assert.equal(
      humanPlayer(state).pendingNextTurnGold,
      scenario.expected,
    );
  }

  let state = createGame(0xe104);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [];
  player.hand = [
    definitionMinion(template, "BG26_135", "busker-next-turn"),
  ];
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "busker-next-turn",
  });
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(player.gold, 5);
  assert.equal(player.pendingNextTurnGold, 0);
});

test("Shell Collector generates real Tavern Coin cards with Golden and Brann scaling", () => {
  const scenarios = [
    { golden: false, brann: false, expected: 1 },
    { golden: true, brann: false, expected: 2 },
    { golden: false, brann: true, expected: 2 },
    { golden: true, brann: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xe110 + index);
    const player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    player.board = scenario.brann
      ? [definitionMinion(template, "BG_LOE_077", `coin-brann-${index}`)]
      : [];
    player.hand = [
      definitionMinion(
        template,
        "BG23_002",
        `shell-collector-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG23_002").attack * 2,
              health: getMinionDefinition("BG23_002").health * 2,
            }
          : {},
      ),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `shell-collector-${index}`,
    });
    const coins = tavernCoins(humanPlayer(state));
    assert.equal(coins.length, scenario.expected);
    assert.ok(
      coins.every(
        (coin) =>
          coin.cardId === "BG28_810" &&
          coin.cost === 1 &&
          coin.spellFamily === "tavern",
      ),
    );
  }

  let state = createGame(0xe114);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.gold = 0;
  player.board = [];
  player.hand = [
    definitionMinion(template, "BG23_002", "castable-shell-collector"),
  ];
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "castable-shell-collector",
  });
  player = humanPlayer(state);
  const [coin] = tavernCoins(player);
  assert.ok(coin);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: coin.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.gold, 1);
  assert.equal(player.tavernSpellsCastThisTurn, 1);
  assert.equal(tavernCoins(player).length, 0);
});

test("Dune Dweller buffs current and future Tavern Elementals for the game", () => {
  const scenarios = [
    { golden: false, brann: false, expected: 1 },
    { golden: true, brann: false, expected: 2 },
    { golden: false, brann: true, expected: 2 },
    { golden: true, brann: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xe120 + index);
    const player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const elemental = definitionMinion(
      template,
      "BGS_119",
      `shop-elemental-${index}`,
    );
    const neutral = definitionMinion(
      template,
      "BG35_801",
      `shop-neutral-${index}`,
    );
    player.shop = [elemental, neutral];
    player.board = scenario.brann
      ? [definitionMinion(template, "BG_LOE_077", `dune-brann-${index}`)]
      : [];
    player.hand = [
      definitionMinion(
        template,
        "BG31_815",
        `dune-dweller-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG31_815").attack * 2,
              health: getMinionDefinition("BG31_815").health * 2,
            }
          : {},
      ),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `dune-dweller-${index}`,
    });
    const nextPlayer = humanPlayer(state);
    const nextElemental = nextPlayer.shop.find(
      (minion) => minion.instanceId === `shop-elemental-${index}`,
    );
    const nextNeutral = nextPlayer.shop.find(
      (minion) => minion.instanceId === `shop-neutral-${index}`,
    );
    assert.ok(nextElemental);
    assert.ok(nextNeutral);
    assert.deepEqual(nextPlayer.tavernTypeBuffs, [
      {
        tribes: ["elemental"],
        attack: scenario.expected,
        health: scenario.expected,
      },
    ]);
    assert.deepEqual(
      [nextElemental.attack, nextElemental.health],
      [
        getMinionDefinition("BGS_119").attack + scenario.expected,
        getMinionDefinition("BGS_119").health + scenario.expected,
      ],
    );
    assert.deepEqual(
      [nextNeutral.attack, nextNeutral.health],
      [
        getMinionDefinition("BG35_801").attack,
        getMinionDefinition("BG35_801").health,
      ],
    );
  }
});

test("Nerubian Deathswarmer buffs owned and future Undead wherever they are", () => {
  const scenarios = [
    { golden: false, brann: false, expected: 1 },
    { golden: true, brann: false, expected: 2 },
    { golden: false, brann: true, expected: 2 },
    { golden: true, brann: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xe130 + index);
    let player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const ownedUndead = definitionMinion(
      template,
      "BG25_001",
      `owned-undead-${index}`,
    );
    player.board = [
      ownedUndead,
      ...(scenario.brann
        ? [definitionMinion(template, "BG_LOE_077", `undead-brann-${index}`)]
        : []),
    ];
    player.hand = [
      definitionMinion(
        template,
        "BG25_011",
        `deathswarmer-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG25_011").attack * 2,
              health: getMinionDefinition("BG25_011").health * 2,
            }
          : {},
      ),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `deathswarmer-${index}`,
    });
    player = humanPlayer(state);
    assert.equal(player.undeadArmyAttackBonus, scenario.expected);
    assert.equal(
      player.board.find(
        (minion) => minion.instanceId === `owned-undead-${index}`,
      )?.attack,
      getMinionDefinition("BG25_001").attack + scenario.expected,
    );
    assert.equal(
      player.board.find(
        (minion) => minion.instanceId === `deathswarmer-${index}`,
      )?.attack,
      getMinionDefinition("BG25_011").attack *
        (scenario.golden ? 2 : 1) +
        scenario.expected,
    );

    player.gold = 3;
    player.shop = [
      definitionMinion(
        template,
        "BG25_001",
        `future-undead-${index}`,
        { poolCopies: 1 },
      ),
    ];
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    player = humanPlayer(state);
    assert.equal(
      minionsInHand(player).find(
        (card) => card.instanceId === `future-undead-${index}`,
      )?.attack,
      getMinionDefinition("BG25_001").attack + scenario.expected,
    );
  }
});

test("River Skipping Fish and Tad draw the correct random shared-pool minions on sell", () => {
  const scenarios = [
    {
      sourceId: "BG33_140",
      targetId: "BG35_801",
      tavernTier: 1 as const,
    },
    {
      sourceId: "BG22_202",
      targetId: "BG33_140",
      tavernTier: 2 as const,
    },
  ] as const;

  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    for (const golden of [false, true]) {
      let state = createGame(
        0xe140 + scenarioIndex * 10 + Number(golden),
      );
      const player = humanPlayer(state);
      const template = player.shop[0];
      assert.ok(template);
      if (
        scenario.sourceId === "BG22_202" &&
        !state.activeTribes.includes("murloc")
      ) {
        state.activeTribes = [
          ...state.activeTribes
            .filter((tribe) => tribe !== "murloc")
            .slice(0, 4),
          "murloc",
        ];
      }
      clearSharedPool(state);
      state.pool[scenario.targetId] = golden ? 2 : 1;
      player.tavernTier = scenario.tavernTier;
      player.hand = [];
      player.board = [
        definitionMinion(
          template,
          scenario.sourceId,
          `sell-draw-${scenarioIndex}-${golden}`,
          golden
            ? {
                golden: true,
                attack:
                  getMinionDefinition(scenario.sourceId).attack * 2,
                health:
                  getMinionDefinition(scenario.sourceId).health * 2,
              }
            : {},
        ),
      ];

      state = gameReducer(state, {
        type: "SELL_MINION",
        boardIndex: 0,
      });
      const gained = minionsInHand(humanPlayer(state)).filter(
        (card) => card.definitionId === scenario.targetId,
      );
      assert.equal(gained.length, golden ? 2 : 1);
      assert.ok(gained.every((minion) => minion.poolCopies === 1));
      assert.equal(state.pool[scenario.targetId], 0);
    }
  }
});

test("Sellemental grants normal Water Droplets and those tokens can triple", () => {
  let state = createGame(0xe150);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.hand = [];
  player.board = Array.from({ length: 3 }, (_, index) =>
    definitionMinion(template, "BGS_115", `sellemental-${index}`),
  );

  for (let count = 0; count < 3; count += 1) {
    state = gameReducer(state, {
      type: "SELL_MINION",
      boardIndex: 0,
    });
  }
  player = humanPlayer(state);
  const goldenDroplets = minionsInHand(player).filter(
    (card) => card.definitionId === "live-water-droplet-token",
  );
  assert.equal(goldenDroplets.length, 1);
  assert.equal(goldenDroplets[0].cardId, "BGS_115t");
  assert.equal(goldenDroplets[0].golden, true);
  assert.deepEqual(
    [goldenDroplets[0].attack, goldenDroplets[0].health],
    [6, 6],
  );
  assert.equal(goldenDroplets[0].poolCopies, 0);
  assert.equal(goldenDroplets[0].grantsTripleReward, true);

  state = createGame(0xe151);
  player = humanPlayer(state);
  const goldenTemplate = player.shop[0];
  assert.ok(goldenTemplate);
  player.hand = [];
  player.board = [
    definitionMinion(
      goldenTemplate,
      "BGS_115",
      "golden-sellemental",
      {
        golden: true,
        attack: getMinionDefinition("BGS_115").attack * 2,
        health: getMinionDefinition("BGS_115").health * 2,
      },
    ),
  ];
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  const normalDroplets = minionsInHand(humanPlayer(state)).filter(
    (card) => card.definitionId === "live-water-droplet-token",
  );
  assert.equal(normalDroplets.length, 2);
  assert.ok(
    normalDroplets.every(
      (minion) =>
        !minion.golden &&
        minion.attack === 3 &&
        minion.health === 3,
    ),
  );
});

test("sell-generated cards respect a full hand without leaking shared-pool copies", () => {
  for (const sourceId of ["BG33_140", "BGS_115"] as const) {
    let state = createGame(sourceId === "BG33_140" ? 0xe158 : 0xe159);
    const player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    clearSharedPool(state);
    state.pool.BG35_801 = 1;
    player.hand = Array.from({ length: 10 }, (_, index) =>
      definitionMinion(
        template,
        "BG35_801",
        `full-hand-${sourceId}-${index}`,
      ),
    );
    player.board = [
      definitionMinion(template, sourceId, `full-hand-source-${sourceId}`),
    ];

    state = gameReducer(state, {
      type: "SELL_MINION",
      boardIndex: 0,
    });
    assert.equal(humanPlayer(state).hand.length, 10);
    assert.equal(
      minionsInHand(humanPlayer(state)).some(
        (minion) =>
          minion.definitionId === "live-water-droplet-token",
      ),
      false,
    );
    assert.equal(state.pool.BG35_801, 1);
  }
});

test("Rot Hide Gnoll gains only combat Attack after each friendly death", () => {
  let state = createGame(0xe160);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);

  for (const combatPlayer of state.players) {
    combatPlayer.gold = 0;
    combatPlayer.hand = [];
    combatPlayer.shop = [];
    combatPlayer.spellShop = null;
    combatPlayer.additionalSpellShop = [];
    combatPlayer.spellOnlyRefreshActive = false;
    combatPlayer.frozen = false;
    combatPlayer.board = [
      definitionMinion(
        template,
        "BG35_801",
        `enemy-${combatPlayer.id}`,
        { attack: 10, health: 10 },
      ),
    ];
  }
  player.board = [
    definitionMinion(template, "BG35_801", "friendly-fodder", {
      attack: 1,
      health: 1,
    }),
    definitionMinion(template, "BG25_013", "rot-hide"),
  ];

  state = gameReducer(state, { type: "END_TURN" });
  assert.ok(state.lastBattle);
  const buffEvent = state.lastBattle.events.find(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === "rot-hide" &&
      event.attackDelta === 1,
  );
  assert.ok(buffEvent, "Rot Hide Gnoll should show a combat buff event");
  assert.ok(buffEvent.minion);
  assert.equal(
    buffEvent.minion.attack,
    getMinionDefinition("BG25_013").attack + 1,
  );
  assert.match(buffEvent.message, /腐皮豺狼人.*\+1攻击力/u);
  assert.equal(
    humanPlayer(state).board.find(
      (minion) => minion.instanceId === "rot-hide",
    )?.attack,
    getMinionDefinition("BG25_013").attack,
    "the combat-only Attack must not persist into the recruit board",
  );
});
