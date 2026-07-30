import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTavernSpellDefinition,
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
  LEGACY_SCHEMA_11_CONTENT_VERSION_V21,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

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
  const golden = overrides.golden === true;
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden
      ? definition.goldenCardId ?? `${definition.cardId}_G`
      : definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: golden
      ? definition.goldenSellValue ?? definition.sellValue ?? 1
      : definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
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
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
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
  return definitionMinion(definitionId, instanceId, {
    golden: true,
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

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function tavernSpellsInHand(player: PlayerState): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell",
  );
}

function playHandCard(
  state: GameState,
  cardInstanceId: string,
): GameState {
  return gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId,
  });
}

function continueAfterCombat(state: GameState): GameState {
  assert.equal(state.phase, "combat");
  const recruit = gameReducer(state, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function clearMinionPool(state: GameState): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
}

function clearSpellPool(state: GameState): void {
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
}

function prepareDuel(
  state: GameState,
  opponentBoard: BoardMinionInstance[] = [
    definitionMinion("BG35_801", "inert-opponent", {
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
    if (player.isHuman) {
      player.alive = true;
      continue;
    }
    player.hand = [];
    if (player.id === opponent.id) {
      player.alive = true;
      player.board = opponentBoard;
      delete player.eliminatedRound;
    } else {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
  return opponent;
}

function boardMinion(
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance {
  const minion = player.board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion, `${instanceId} must remain on the board`);
  return minion;
}

function assertStats(
  minion: BoardMinionInstance,
  attack: number,
  health: number,
): void {
  assert.deepEqual(
    [minion.attack, minion.health],
    [attack, health],
    `${minion.instanceId} has unexpected stats`,
  );
}

test("Lab Assistant queues three manual Fodder refreshes with Golden and Brann scaling", () => {
  let state = createGame(0xf400);
  let player = humanPlayer(state);
  const ordinary = definitionMinion(
    "BG35_150",
    "ordinary-lab-assistant",
  );
  player.board = [];
  player.hand = [ordinary];

  state = playHandCard(state, ordinary.instanceId);
  assert.deepEqual(
    humanPlayer(state).demonFodderRefreshQueue,
    [1, 1, 1],
  );

  state = createGame(0xf401);
  player = humanPlayer(state);
  const golden = goldenMinion(
    "BG35_150",
    "golden-lab-assistant",
  );
  player.board = [
    definitionMinion("BG_LOE_077", "fodder-brann"),
  ];
  player.hand = [golden];

  state = playHandCard(state, golden.instanceId);
  assert.deepEqual(
    humanPlayer(state).demonFodderRefreshQueue,
    [4, 4, 4],
  );
});

test("automatic turn refreshes preserve Fodder queues, while a manual Refresh consumes one slot", () => {
  let state = createGame(0xf402);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG35_150",
    "manual-only-lab-assistant",
  );
  player.board = [];
  player.hand = [source];
  state = playHandCard(state, source.instanceId);
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  state = continueAfterCombat(state);
  player = humanPlayer(state);
  assert.deepEqual(player.demonFodderRefreshQueue, [1, 1, 1]);

  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.board = [];
  player.freeRefreshes = 1;
  clearMinionPool(state);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.deepEqual(player.demonFodderRefreshQueue, [1, 1]);
  assert.equal(
    player.shop.filter(
      (minion) =>
        minion.definitionId === "live-demon-fodder-token",
    ).length,
    1,
  );
});

test("Fodder waits without a Demon, then feeds a played Demon and refills its slot without owning pool copies", () => {
  let state = createGame(0xf403);
  let player = humanPlayer(state);
  player.board = [];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.demonFodderRefreshQueue = [1];
  player.freeRefreshes = 1;
  clearMinionPool(state);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  const fodder = player.shop.find(
    (minion) =>
      minion.definitionId === "live-demon-fodder-token",
  );
  assert.ok(fodder);
  assert.equal(fodder.poolCopies, 0);
  assert.equal(
    state.pool["live-demon-fodder-token"] ?? 0,
    0,
  );

  state.pool.BG35_801 = 1;
  const demon = definitionMinion(
    "BG35_801",
    "late-friendly-demon",
    {
      tribe: "demon",
      tribes: ["demon"],
      attack: 5,
      health: 7,
    },
  );
  player.hand.push(demon);
  state = playHandCard(state, demon.instanceId);
  player = humanPlayer(state);

  assertStats(boardMinion(player, demon.instanceId), 7, 9);
  assert.equal(
    player.shop.some(
      (minion) =>
        minion.definitionId === "live-demon-fodder-token",
    ),
    false,
  );
  assert.equal(
    player.shop.some(
      (minion) => minion.definitionId === "BG35_801",
    ),
    true,
  );
  assert.equal(state.pool.BG35_801, 0);
  assert.equal(
    state.pool["live-demon-fodder-token"] ?? 0,
    0,
  );
});

test("a Golden 4/4 Fodder left in the Tavern feeds a later Demon for double final stats without adding pool ownership", () => {
  let state = createGame(0xf4031);
  let player = humanPlayer(state);
  const goldenFodder = goldenMinion(
    "live-demon-fodder-token",
    "golden-waiting-demon-fodder",
  );
  const demon = definitionMinion(
    "BG35_801",
    "golden-fodder-friendly-demon",
    {
      tribe: "demon",
      tribes: ["demon"],
      attack: 5,
      health: 7,
    },
  );
  player.board = [];
  player.hand = [demon];
  player.shop = [goldenFodder];
  player.spellShop = null;
  player.additionalSpellShop = [];
  clearMinionPool(state);
  state.pool.BG35_814 = 1;

  state = playHandCard(state, demon.instanceId);
  player = humanPlayer(state);
  assertStats(boardMinion(player, demon.instanceId), 13, 15);
  assert.equal(
    player.shop.some(
      (minion) =>
        minion.instanceId === goldenFodder.instanceId,
    ),
    false,
  );
  assert.equal(
    player.shop.some(
      (minion) => minion.definitionId === "BG35_814",
    ),
    true,
  );
  assert.equal(
    state.pool["live-demon-fodder-token"] ?? 0,
    0,
  );
});

test("Fodder feeds its original stats before one Barrage pulse is applied to every final refill offer", () => {
  let state = createGame(0xf4032);
  state.activeTribes = ["dragon"];
  let player = humanPlayer(state);
  const demon = definitionMinion(
    "BG35_801",
    "barrage-fodder-friendly-demon",
    {
      tribe: "demon",
      tribes: ["demon"],
      attack: 10,
      health: 10,
    },
  );
  player.board = [demon];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.demonFodderRefreshQueue = [1];
  player.freeRefreshes = 1;
  player.tavernBloodGemBarrageAttack = 2;
  player.tavernBloodGemBarrageHealth = 3;
  player.rideTheWindBuffs = [];
  clearMinionPool(state);
  clearSpellPool(state);
  state.pool.BG35_814 = 10;

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assertStats(boardMinion(player, demon.instanceId), 12, 12);
  assert.deepEqual(player.demonFodderRefreshQueue, []);
  assert.equal(player.shop.length, 4);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.definitionId === "BG35_814" &&
        minion.bloodGemAttack === 2 &&
        minion.bloodGemHealth === 3,
    ),
  );
  const base = getMinionDefinition("BG35_814");
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.attack === base.attack + 2 &&
        minion.health === base.health + 3,
    ),
  );
  assert.equal(
    player.shop.some(
      (minion) =>
        minion.definitionId === "live-demon-fodder-token",
    ),
    false,
  );
  assert.equal(state.pool.BG35_814, 6);
});

test("Fodder left on the final page receives one Barrage pulse and participates in Ride the Wind selection exactly once", () => {
  let state = createGame(0xf4033);
  state.activeTribes = ["dragon"];
  // Three one-definition pool draws advance xorshift32 three times. Seed 4
  // makes the next roll select final-page index 3, where Fodder is appended.
  state.rngState = 4;
  let player = humanPlayer(state);
  player.board = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.demonFodderRefreshQueue = [1];
  player.freeRefreshes = 1;
  player.tavernBloodGemBarrageAttack = 2;
  player.tavernBloodGemBarrageHealth = 3;
  player.rideTheWindBuffs = [{ attack: 6, health: 6 }];
  clearMinionPool(state);
  clearSpellPool(state);
  state.pool.BG35_814 = 10;

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.deepEqual(player.demonFodderRefreshQueue, []);
  assert.equal(player.shop.length, 4);
  const fodder = player.shop.find(
    (minion) =>
      minion.definitionId === "live-demon-fodder-token",
  );
  assert.ok(fodder);
  assertStats(fodder, 10, 11);
  assert.deepEqual(
    [fodder.bloodGemAttack, fodder.bloodGemHealth],
    [2, 3],
  );
  assert.equal(fodder.poolCopies, 0);

  const base = getMinionDefinition("BG35_814");
  const ordinaryOffers = player.shop.filter(
    (minion) => minion.definitionId === "BG35_814",
  );
  assert.equal(ordinaryOffers.length, 3);
  assert.ok(
    ordinaryOffers.every(
      (minion) =>
        minion.attack === base.attack + 2 &&
        minion.health === base.health + 3 &&
        minion.bloodGemAttack === 2 &&
        minion.bloodGemHealth === 3,
    ),
  );

  const baseAttackTotal = base.attack * 3 + 2;
  const baseHealthTotal = base.health * 3 + 2;
  assert.deepEqual(
    [
      player.shop.reduce(
        (total, minion) => total + minion.attack,
        0,
      ) - baseAttackTotal,
      player.shop.reduce(
        (total, minion) => total + minion.health,
        0,
      ) - baseHealthTotal,
    ],
    [14, 18],
  );
});

test("Twisted Wrathguard queues Fodder only after another friendly minion is sold", () => {
  let state = createGame(0xf404);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG35_155", "sold-wrathguard"),
  ];
  player.demonFodderRefreshQueue = [];

  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  assert.deepEqual(
    humanPlayer(state).demonFodderRefreshQueue,
    [],
  );

  state = createGame(0xf405);
  player = humanPlayer(state);
  player.board = [
    definitionMinion("BG35_155", "watching-wrathguard"),
    definitionMinion("BG35_801", "sold-wrathguard-friend"),
  ];
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: 1,
  });
  assert.deepEqual(
    humanPlayer(state).demonFodderRefreshQueue,
    [1],
  );

  state = createGame(0xf406);
  player = humanPlayer(state);
  player.board = [
    goldenMinion("BG35_155", "golden-watching-wrathguard"),
    definitionMinion(
      "BG35_801",
      "golden-wrathguard-friend",
    ),
  ];
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: 1,
  });
  assert.deepEqual(
    humanPlayer(state).demonFodderRefreshQueue,
    [2],
  );
});

test("Woodland Desecrator queues its next three Fodder refreshes with Golden and Drakkari scaling", () => {
  let state = createGame(0xf407);
  const player = humanPlayer(state);
  player.board = [
    goldenMinion(
      "BG35_151",
      "golden-woodland-desecrator",
    ),
    definitionMinion("BG26_ICC_901", "desecrator-dakkari"),
  ];
  player.demonFodderRefreshQueue = [];
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(
    humanPlayer(state).demonFodderRefreshQueue,
    [4, 4, 4],
  );
});

test("Fel Flame Executor consumes the highest-Health offer, doubles Golden stats, and returns exact pool ownership", () => {
  for (const [index, scenario] of [
    {
      golden: false,
      dakkari: false,
      expectedAttack: 15,
      expectedHealth: 60,
      expectedPool: [0, 1],
    },
    {
      golden: true,
      dakkari: true,
      expectedAttack: 34,
      expectedHealth: 142,
      expectedPool: [1, 1],
    },
  ].entries()) {
    let state = createGame(0xf410 + index);
    const player = humanPlayer(state);
    const source = scenario.golden
      ? goldenMinion("BG34_500", `executor-${index}`, {
          attack: 10,
          health: 20,
        })
      : definitionMinion("BG34_500", `executor-${index}`, {
          attack: 10,
          health: 20,
        });
    player.board = [
      source,
      ...(scenario.dakkari
        ? [
            definitionMinion(
              "BG26_ICC_901",
              `executor-dakkari-${index}`,
            ),
          ]
        : []),
    ];
    prepareDuel(state);
    const lower = definitionMinion(
      "BG35_801",
      `executor-low-${index}`,
      {
        attack: 7,
        health: 21,
        poolCopies: 1,
      },
    );
    const highest = definitionMinion(
      "BG35_814",
      `executor-high-${index}`,
      {
        attack: 5,
        health: 40,
        poolCopies: 1,
      },
    );
    humanPlayer(state).shop = [lower, highest];
    state.pool.BG35_801 = 0;
    state.pool.BG35_814 = 0;

    state = gameReducer(state, { type: "END_TURN" });
    const nextSource = boardMinion(
      humanPlayer(state),
      source.instanceId,
    );
    assertStats(
      nextSource,
      scenario.expectedAttack,
      scenario.expectedHealth,
    );
    assert.deepEqual(
      [state.pool.BG35_801, state.pool.BG35_814],
      scenario.expectedPool,
    );
  }
});

test("Famished Felbat lets each Demon consume a distinct offer on every Drakkari trigger", () => {
  for (const [index, scenario] of [
    {
      golden: false,
      dakkari: false,
      shopStats: [
        [2, 11],
        [3, 13],
      ] as const,
      expectedAttack: 19,
      expectedHealth: 50,
    },
    {
      golden: true,
      dakkari: true,
      shopStats: [
        [2, 11],
        [3, 13],
        [5, 17],
        [7, 19],
      ] as const,
      expectedAttack: 48,
      expectedHealth: 146,
    },
  ].entries()) {
    let state = createGame(0xf420 + index);
    const player = humanPlayer(state);
    const source = scenario.golden
      ? goldenMinion("BG21_005", `felbat-${index}`, {
          attack: 10,
          health: 20,
        })
      : definitionMinion("BG21_005", `felbat-${index}`, {
          attack: 10,
          health: 20,
        });
    const otherDemon = definitionMinion(
      "BG35_801",
      `felbat-friend-${index}`,
      {
        tribe: "demon",
        tribes: ["demon"],
        attack: 4,
        health: 6,
      },
    );
    player.board = [
      source,
      otherDemon,
      ...(scenario.dakkari
        ? [
            definitionMinion(
              "BG26_ICC_901",
              `felbat-dakkari-${index}`,
            ),
          ]
        : []),
    ];
    prepareDuel(state);
    const shopDefinitionIds = [
      "BG35_801",
      "BG35_814",
      "BG25_001",
      "BG27_004",
    ];
    humanPlayer(state).shop = scenario.shopStats.map(
      ([attack, health], shopIndex) =>
        definitionMinion(
          shopDefinitionIds[shopIndex],
          `felbat-food-${index}-${shopIndex}`,
          {
            attack,
            health,
            poolCopies: 1,
          },
        ),
    );
    for (const definitionId of shopDefinitionIds) {
      state.pool[definitionId] = 0;
    }

    state = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(state);
    const demons = [source.instanceId, otherDemon.instanceId].map(
      (instanceId) => boardMinion(nextPlayer, instanceId),
    );
    assert.equal(
      demons.reduce((sum, minion) => sum + minion.attack, 0),
      scenario.expectedAttack,
    );
    assert.equal(
      demons.reduce((sum, minion) => sum + minion.health, 0),
      scenario.expectedHealth,
    );
    assert.equal(nextPlayer.shop.length, 0);
    assert.ok(
      shopDefinitionIds
        .slice(0, scenario.shopStats.length)
        .every((definitionId) => state.pool[definitionId] === 1),
    );
  }
});

test("Golden Upbeat Duo counts one turn at a time and copies both adjacent original cards once per Drakkari payoff", () => {
  let state = createGame(0xf430);
  let player = humanPlayer(state);
  const left = definitionMinion(
    "BG35_801",
    "duo-left-buffed-golden",
    {
      golden: true,
      attack: 99,
      health: 101,
    },
  );
  const source = goldenMinion("BG26_199", "golden-upbeat-duo", {
    effectCounters: { periodicEndOfTurn: 2 },
  });
  const right = definitionMinion(
    "BG35_814",
    "duo-right-buffed",
    {
      golden: true,
      attack: 77,
      health: 79,
    },
  );
  player.board = [
    left,
    source,
    right,
    definitionMinion("BG26_ICC_901", "duo-dakkari"),
  ];
  player.hand = [];
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 0);
  assert.equal(
    boardMinion(player, source.instanceId).effectCounters
      ?.periodicEndOfTurn,
    1,
  );

  state = continueAfterCombat(state);
  prepareDuel(state);
  const poolBefore = {
    BG35_801: state.pool.BG35_801,
    BG35_814: state.pool.BG35_814,
  };
  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  const copies = minionsInHand(player);
  assert.deepEqual(
    copies
      .map((minion) => minion.definitionId)
      .sort(),
    ["BG35_801", "BG35_801", "BG35_814", "BG35_814"],
  );
  for (const copy of copies) {
    const definition = getMinionDefinition(copy.definitionId);
    assert.equal(copy.golden, false);
    assertStats(copy, definition.attack, definition.health);
    assert.equal(copy.poolCopies, 0);
  }
  assert.deepEqual(
    {
      BG35_801: state.pool.BG35_801,
      BG35_814: state.pool.BG35_814,
    },
    poolBefore,
  );
  assert.equal(
    boardMinion(player, source.instanceId).effectCounters
      ?.periodicEndOfTurn,
    2,
  );
});

test("Upbeat Duo recomputes its left neighbor after each Drakkari payoff when earlier copies triple neighbors off the board", () => {
  let state = createGame(0xf431);
  const player = humanPlayer(state);
  const secondNeighbor = definitionMinion(
    "BG35_801",
    "duo-dynamic-second-neighbor",
    {
      poolCopies: 1,
    },
  );
  const firstNeighbor = definitionMinion(
    "BG35_814",
    "duo-dynamic-first-neighbor",
    {
      poolCopies: 1,
    },
  );
  const source = definitionMinion(
    "BG26_199",
    "duo-dynamic-source",
    {
      effectCounters: { periodicEndOfTurn: 1 },
    },
  );
  player.board = [
    secondNeighbor,
    firstNeighbor,
    source,
    goldenMinion(
      "BG26_ICC_901",
      "duo-dynamic-golden-dakkari",
    ),
  ];
  player.hand = [
    definitionMinion("BG35_814", "duo-dynamic-first-hand", {
      poolCopies: 1,
    }),
    definitionMinion("BG35_801", "duo-dynamic-second-hand", {
      poolCopies: 1,
    }),
  ];
  state.pool.BG35_801 = 0;
  state.pool.BG35_814 = 0;
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(state);
  const dynamicTriples = minionsInHand(nextPlayer).filter(
    (minion) =>
      minion.golden &&
      ["BG35_801", "BG35_814"].includes(
        minion.definitionId,
      ),
  );
  assert.deepEqual(
    dynamicTriples
      .map((minion) => [
        minion.definitionId,
        minion.poolCopies,
      ])
      .sort(([leftId], [rightId]) =>
        String(leftId).localeCompare(String(rightId)),
      ),
    [
      ["BG35_801", 2],
      ["BG35_814", 2],
    ],
  );
  assert.equal(
    nextPlayer.board.some(
      (minion) =>
        minion.definitionId === "BG35_801" ||
        minion.definitionId === "BG35_814",
    ),
    false,
  );
  assert.equal(
    minionsInHand(nextPlayer).some(
      (minion) =>
        !minion.golden &&
        (minion.definitionId === "BG35_801" ||
          minion.definitionId === "BG35_814"),
    ),
    false,
  );
  assert.deepEqual(
    [state.pool.BG35_801, state.pool.BG35_814],
    [0, 0],
  );
});

test("Kel'Thuzad destroys its left Undead, resolves Deathrattle then Reborn, and resummons the exact owned snapshot", () => {
  let state = createGame(0xf440);
  const player = humanPlayer(state);
  const target = definitionMinion(
    "harvest-golem",
    "kelthuzad-left-undead",
    {
      tribe: "undead",
      tribes: ["undead"],
      attack: 9,
      health: 10,
      reborn: true,
      poolCopies: 1,
    },
  );
  const source = definitionMinion(
    "BG28_308",
    "ordinary-kelthuzad",
  );
  const untouchedRight = definitionMinion(
    "BG35_801",
    "kelthuzad-untouched-right",
    {
      tribe: "undead",
      tribes: ["undead"],
    },
  );
  player.board = [target, source, untouchedRight];
  prepareDuel(state, [
    definitionMinion("BG35_801", "kelthuzad-opponent", {
      attack: 0,
      health: 1,
    }),
  ]);
  state.pool["harvest-golem"] = 0;

  state = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(state);
  assert.equal(
    nextPlayer.board.some(
      (minion) => minion.instanceId === target.instanceId,
    ),
    false,
  );
  const exact = nextPlayer.board.find(
    (minion) =>
      minion.definitionId === "harvest-golem" &&
      minion.health === 10,
  );
  const reborn = nextPlayer.board.find(
    (minion) =>
      minion.definitionId === "harvest-golem" &&
      minion.health === 1,
  );
  assert.ok(exact);
  assert.ok(reborn);
  assertStats(exact, 9, 10);
  assert.equal(exact.reborn, true);
  assert.equal(exact.poolCopies, 1);
  assert.equal(reborn.reborn, false);
  assert.equal(reborn.poolCopies, 0);
  assert.ok(
    nextPlayer.board.findIndex(
      (minion) => minion.instanceId === exact.instanceId,
    ) <
      nextPlayer.board.findIndex(
        (minion) => minion.instanceId === reborn.instanceId,
      ),
  );
  assert.equal(
    nextPlayer.board.some(
      (minion) => minion.definitionId === "damaged-golem-token",
    ),
    true,
  );
  assert.equal(
    nextPlayer.board.some(
      (minion) =>
        minion.instanceId === untouchedRight.instanceId,
    ),
    true,
  );
  assert.equal(state.pool["harvest-golem"], 0);
  assert.equal(
    nextPlayer.board
      .filter(
        (minion) => minion.definitionId === "harvest-golem",
      )
      .reduce((sum, minion) => sum + minion.poolCopies, 0),
    1,
  );
});

test("Golden Kel'Thuzad replaces both adjacent Undead with exact new instances", () => {
  let state = createGame(0xf441);
  const player = humanPlayer(state);
  const left = definitionMinion(
    "BG35_801",
    "golden-kelthuzad-left",
    {
      tribe: "undead",
      tribes: ["undead"],
      attack: 13,
      health: 17,
      poolCopies: 1,
    },
  );
  const source = goldenMinion(
    "BG28_308",
    "golden-kelthuzad",
  );
  const right = definitionMinion(
    "BG35_814",
    "golden-kelthuzad-right",
    {
      tribe: "undead",
      tribes: ["undead"],
      attack: 19,
      health: 23,
      poolCopies: 1,
    },
  );
  player.board = [left, source, right];
  prepareDuel(state);
  state.pool.BG35_801 = 0;
  state.pool.BG35_814 = 0;

  state = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(state);
  const copiedLeft = nextPlayer.board.find(
    (minion) =>
      minion.definitionId === left.definitionId &&
      minion.instanceId !== left.instanceId,
  );
  const copiedRight = nextPlayer.board.find(
    (minion) =>
      minion.definitionId === right.definitionId &&
      minion.instanceId !== right.instanceId,
  );
  assert.ok(copiedLeft);
  assert.ok(copiedRight);
  assertStats(copiedLeft, 13, 17);
  assertStats(copiedRight, 19, 23);
  assert.deepEqual(
    [copiedLeft.poolCopies, copiedRight.poolCopies],
    [1, 1],
  );
  assert.deepEqual(
    [state.pool.BG35_801, state.pool.BG35_814],
    [0, 0],
  );
});

test("Golden Kel'Thuzad resolves both sides before tripling owned, zero-pool Reborn, and exact resummoned copies", () => {
  let state = createGame(0xf442);
  const player = humanPlayer(state);
  const existingLeft = definitionMinion(
    "BG35_814",
    "kelthuzad-triple-existing-left",
    {
      tribe: "undead",
      tribes: ["undead"],
      poolCopies: 1,
    },
  );
  const destroyedLeft = definitionMinion(
    "BG35_814",
    "kelthuzad-triple-destroyed-left",
    {
      tribe: "undead",
      tribes: ["undead"],
      reborn: true,
      poolCopies: 1,
    },
  );
  const source = goldenMinion(
    "BG28_308",
    "kelthuzad-triple-source",
  );
  const destroyedRight = definitionMinion(
    "BG35_801",
    "kelthuzad-triple-destroyed-right",
    {
      tribe: "undead",
      tribes: ["undead"],
      reborn: true,
      poolCopies: 1,
    },
  );
  const existingRight = definitionMinion(
    "BG35_801",
    "kelthuzad-triple-existing-right",
    {
      tribe: "undead",
      tribes: ["undead"],
      poolCopies: 1,
    },
  );
  player.board = [
    existingLeft,
    destroyedLeft,
    source,
    destroyedRight,
    existingRight,
  ];
  player.hand = [];
  state.pool.BG35_814 = 0;
  state.pool.BG35_801 = 0;
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(state);
  const goldenTriples = minionsInHand(nextPlayer).filter(
    (minion) =>
      ["BG35_814", "BG35_801"].includes(
        minion.definitionId,
      ) && minion.golden,
  );
  assert.deepEqual(
    goldenTriples
      .map((minion) => [
        minion.definitionId,
        minion.poolCopies,
      ])
      .sort(([leftId], [rightId]) =>
        String(leftId).localeCompare(String(rightId)),
      ),
    [
      ["BG35_801", 2],
      ["BG35_814", 2],
    ],
  );
  assert.deepEqual(
    [state.pool.BG35_801, state.pool.BG35_814],
    [0, 0],
  );
  assert.equal(
    nextPlayer.board.some(
      (minion) =>
        minion.definitionId === "BG35_801" ||
        minion.definitionId === "BG35_814",
    ),
    false,
  );
});

test("Cataclysmic Harbinger remembers only the last completed Tavern Spell and Golden Drakkari copies do not reserve the spell pool", () => {
  let state = createGame(0xf450);
  let player = humanPlayer(state);
  const target = definitionMinion(
    "BG35_801",
    "harbinger-spell-target",
  );
  player.board = [
    target,
    goldenMinion(
      "BG35_123",
      "golden-cataclysmic-harbinger",
    ),
    definitionMinion("BG26_ICC_901", "harbinger-dakkari"),
  ];
  player.hand = [
    tavernSpell(
      "tavern-spell-tavern-dish-banana",
      "harbinger-banana",
    ),
    tavernSpell(
      "tavern-spell-time-management",
      "harbinger-time-management",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "harbinger-banana",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(
    player.lastTavernSpellDefinitionId,
    "tavern-spell-tavern-dish-banana",
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "harbinger-time-management",
  });
  assert.equal(state.pendingInteraction?.kind, "tavernSpellChoice");
  player = humanPlayer(state);
  assert.equal(
    player.lastTavernSpellDefinitionId,
    "tavern-spell-tavern-dish-banana",
  );
  assert.equal(
    player.pendingTavernSpellDefinitionId,
    "tavern-spell-time-management",
  );
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "tavernSpellChoice");
  const unresolved = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "not-a-choice",
  });
  assert.equal(
    humanPlayer(unresolved).lastTavernSpellDefinitionId,
    "tavern-spell-tavern-dish-banana",
  );
  state = gameReducer(unresolved, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "timeManagementNow",
  });
  assert.equal(
    humanPlayer(state).lastTavernSpellDefinitionId,
    "tavern-spell-time-management",
  );
  assert.equal(
    humanPlayer(state).pendingTavernSpellDefinitionId,
    null,
  );

  prepareDuel(state);
  const poolBefore = structuredClone(state.spellPool);
  state = gameReducer(state, { type: "END_TURN" });
  const copies = tavernSpellsInHand(humanPlayer(state)).filter(
    (spell) =>
      spell.definitionId === "tavern-spell-time-management",
  );
  assert.equal(copies.length, 4);
  assert.equal(new Set(copies.map((copy) => copy.instanceId)).size, 4);
  assert.deepEqual(state.spellPool, poolBefore);
});

test("Cousin Itt gets one random parent normally and one of each parent per Golden Drakkari trigger", () => {
  let state = createGame(0xf460);
  state.activeTribes = ["murloc"];
  let player = humanPlayer(state);
  player.tavernTier = 6;
  player.board = [
    definitionMinion("BG35_142", "ordinary-cousin-itt"),
  ];
  player.hand = [];
  state.pool.BG35_140 = 5;
  state.pool.BG35_141 = 5;
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  let parents = minionsInHand(humanPlayer(state)).filter(
    (minion) =>
      minion.definitionId === "BG35_140" ||
      minion.definitionId === "BG35_141",
  );
  assert.equal(parents.length, 1);
  assert.equal(
    (state.pool.BG35_140 ?? 0) + (state.pool.BG35_141 ?? 0),
    9,
  );

  state = createGame(0xf461);
  state.activeTribes = ["murloc"];
  player = humanPlayer(state);
  player.tavernTier = 6;
  player.board = [
    goldenMinion("BG35_142", "golden-cousin-itt"),
    definitionMinion("BG26_ICC_901", "cousin-dakkari"),
  ];
  player.hand = [];
  state.pool.BG35_140 = 5;
  state.pool.BG35_141 = 5;
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  parents = minionsInHand(humanPlayer(state)).filter(
    (minion) =>
      minion.definitionId === "BG35_140" ||
      minion.definitionId === "BG35_141",
  );
  assert.deepEqual(
    parents
      .map((minion) => minion.definitionId)
      .sort(),
    ["BG35_140", "BG35_140", "BG35_141", "BG35_141"],
  );
  assert.deepEqual(
    [state.pool.BG35_140, state.pool.BG35_141],
    [3, 3],
  );
});

test("Shameless Pirate counts every successfully played card, then resets next turn", () => {
  let state = createGame(0xf470);
  let player = humanPlayer(state);
  const target = definitionMinion(
    "BG35_801",
    "shameless-leftmost-pirate",
    {
      tribe: "pirate",
      tribes: ["pirate"],
      attack: 10,
      health: 10,
    },
  );
  const source = definitionMinion(
    "BG35_701",
    "ordinary-shameless-pirate",
  );
  const playedMinion = definitionMinion(
    "BG35_814",
    "shameless-played-minion",
  );
  player.board = [target, source];
  player.hand = [
    playedMinion,
    bloodGem("shameless-blood-gem"),
    tavernSpell(
      "tavern-spell-tavern-dish-banana",
      "shameless-banana",
    ),
  ];

  state = playHandCard(state, playedMinion.instanceId);
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "shameless-blood-gem",
    targetInstanceId: target.instanceId,
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "shameless-banana",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.cardsPlayedThisTurn, 3);
  const firstBefore = {
    attack: boardMinion(player, target.instanceId).attack,
    health: boardMinion(player, target.instanceId).health,
  };
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assertStats(
    boardMinion(player, target.instanceId),
    firstBefore.attack + 8,
    firstBefore.health + 12,
  );

  state = continueAfterCombat(state);
  player = humanPlayer(state);
  assert.equal(player.cardsPlayedThisTurn, 0);
  const secondBefore = {
    attack: boardMinion(player, target.instanceId).attack,
    health: boardMinion(player, target.instanceId).health,
  };
  prepareDuel(state);
  state = gameReducer(state, { type: "END_TURN" });
  assertStats(
    boardMinion(humanPlayer(state), target.instanceId),
    secondBefore.attack + 2,
    secondBefore.health + 3,
  );
});

test("Golden Shameless Pirate repeats its doubled buff for each card on every Drakkari trigger", () => {
  let state = createGame(0xf471);
  const player = humanPlayer(state);
  const target = definitionMinion(
    "BG35_801",
    "golden-shameless-target",
    {
      tribe: "pirate",
      tribes: ["pirate"],
      attack: 10,
      health: 10,
    },
  );
  player.board = [
    target,
    goldenMinion("BG35_701", "golden-shameless-pirate"),
    definitionMinion("BG26_ICC_901", "shameless-dakkari"),
  ];
  player.cardsPlayedThisTurn = 2;
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  assertStats(
    boardMinion(humanPlayer(state), target.instanceId),
    34,
    46,
  );
});

test("Earthsong Shaman uses two naked Gems, four when Golden, scales extra keywords and current Gem values, and repeats with Drakkari", () => {
  const scenarios = [
    {
      golden: false,
      dakkari: false,
      extraKeywords: false,
      gemAttack: 1,
      gemHealth: 1,
      expectedApplications: 2,
    },
    {
      golden: true,
      dakkari: false,
      extraKeywords: false,
      gemAttack: 1,
      gemHealth: 1,
      expectedApplications: 4,
    },
    {
      golden: false,
      dakkari: false,
      extraKeywords: true,
      gemAttack: 3,
      gemHealth: 5,
      expectedApplications: 4,
    },
    {
      golden: false,
      dakkari: true,
      extraKeywords: false,
      gemAttack: 1,
      gemHealth: 1,
      expectedApplications: 4,
    },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xf480 + index);
    const player = humanPlayer(state);
    const source = scenario.golden
      ? goldenMinion(
          "BG35_431",
          `earthsong-shaman-${index}`,
          {
            taunt: scenario.extraKeywords,
            divineShield: scenario.extraKeywords,
          },
        )
      : definitionMinion(
          "BG35_431",
          `earthsong-shaman-${index}`,
          {
            taunt: scenario.extraKeywords,
            divineShield: scenario.extraKeywords,
          },
        );
    const ally = definitionMinion(
      "BG35_801",
      `earthsong-ally-${index}`,
      {
        attack: 10,
        health: 10,
      },
    );
    player.board = [
      source,
      ally,
      ...(scenario.dakkari
        ? [
            definitionMinion(
              "BG26_ICC_901",
              `earthsong-dakkari-${index}`,
            ),
          ]
        : []),
    ];
    player.bloodGemAttack = scenario.gemAttack;
    player.bloodGemHealth = scenario.gemHealth;
    const sourceBefore = {
      attack: source.attack,
      health: source.health,
    };
    prepareDuel(state);

    state = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(state);
    assertStats(
      boardMinion(nextPlayer, source.instanceId),
      sourceBefore.attack +
        scenario.expectedApplications * scenario.gemAttack,
      sourceBefore.health +
        scenario.expectedApplications * scenario.gemHealth,
    );
    assertStats(
      boardMinion(nextPlayer, ally.instanceId),
      10 + scenario.expectedApplications * scenario.gemAttack,
      10 + scenario.expectedApplications * scenario.gemHealth,
    );
  }
});

test("Skeleton Sharpshooter persists both combat and Recruit Avenge improvements into its next end-of-turn buff", () => {
  let state = createGame(0xf490);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG35_334",
    "persistent-skeleton-sharpshooter",
    {
      attack: 0,
      health: 10_000,
    },
  );
  const combatVictim = definitionMinion(
    "BG35_801",
    "skeleton-combat-victim",
    {
      attack: 0,
      health: 1,
      taunt: true,
    },
  );
  player.board = [source, combatVictim];
  prepareDuel(state, [
    definitionMinion("BG35_801", "skeleton-combat-enemy", {
      attack: 100,
      health: 1_000,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assert.equal(
    boardMinion(player, source.instanceId).effectCounters
      ?.dynamicEndOfTurnAttack,
    1,
  );
  assert.equal(
    boardMinion(player, source.instanceId).effectCounters
      ?.dynamicEndOfTurnHealth,
    1,
  );
  assert.ok(
    state.lastBattle?.events.some(
      (event) =>
        event.actorInstanceId === source.instanceId &&
        event.message.includes("复仇永久提升"),
    ),
  );

  state = continueAfterCombat(state);
  player = humanPlayer(state);
  const recruitVictim = definitionMinion(
    "BG35_801",
    "skeleton-recruit-victim",
    {
      destroyAfterPlayThroughRound: state.round,
    },
  );
  player.hand = [recruitVictim];
  state = playHandCard(state, recruitVictim.instanceId);
  player = humanPlayer(state);
  assert.deepEqual(
    boardMinion(player, source.instanceId).effectCounters,
    {
      dynamicEndOfTurnAttack: 2,
      dynamicEndOfTurnHealth: 2,
      dynamicAvengeProgress: 0,
    },
  );

  const buffTarget = definitionMinion(
    "BG35_801",
    "skeleton-next-turn-target",
    {
      attack: 10,
      health: 10,
    },
  );
  player.board.push(buffTarget);
  prepareDuel(state);
  state = gameReducer(state, { type: "END_TURN" });
  assertStats(
    boardMinion(humanPlayer(state), buffTarget.instanceId),
    13,
    13,
  );
});

test("Golden Skeleton Sharpshooter doubles both its printed buff and each permanent Avenge improvement", () => {
  let state = createGame(0xf491);
  let player = humanPlayer(state);
  const source = goldenMinion(
    "BG35_334",
    "golden-skeleton-sharpshooter",
  );
  const recruitVictim = definitionMinion(
    "BG35_801",
    "golden-skeleton-recruit-victim",
    {
      destroyAfterPlayThroughRound: state.round,
    },
  );
  player.board = [source];
  player.hand = [recruitVictim];

  state = playHandCard(state, recruitVictim.instanceId);
  player = humanPlayer(state);
  assert.deepEqual(
    boardMinion(player, source.instanceId).effectCounters,
    {
      dynamicEndOfTurnAttack: 2,
      dynamicEndOfTurnHealth: 2,
      dynamicAvengeProgress: 0,
    },
  );
  const target = definitionMinion(
    "BG35_801",
    "golden-skeleton-target",
    {
      attack: 10,
      health: 10,
    },
  );
  player.board.push(target);
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  assertStats(
    boardMinion(humanPlayer(state), target.instanceId),
    14,
    14,
  );
});

test("tripling Skeleton Sharpshooters sums their permanent improvements and refreshes the Golden dynamic text", () => {
  let state = createGame(0xf492);
  let player = humanPlayer(state);
  const first = definitionMinion(
    "BG35_334",
    "triple-skeleton-first",
    {
      effectCounters: {
        dynamicEndOfTurnAttack: 1,
        dynamicEndOfTurnHealth: 1,
      },
    },
  );
  const second = definitionMinion(
    "BG35_334",
    "triple-skeleton-second",
    {
      effectCounters: {
        dynamicEndOfTurnAttack: 2,
        dynamicEndOfTurnHealth: 3,
      },
    },
  );
  const third = definitionMinion(
    "BG35_334",
    "triple-skeleton-third",
    {
      effectCounters: {
        dynamicEndOfTurnAttack: 4,
        dynamicEndOfTurnHealth: 5,
      },
    },
  );
  player.board = [first, second];
  player.hand = [third];

  state = playHandCard(state, third.instanceId);
  player = humanPlayer(state);
  const golden = minionsInHand(player).find(
    (minion) =>
      minion.definitionId === "BG35_334" && minion.golden,
  );
  assert.ok(golden);
  assert.deepEqual(golden.effectCounters, {
    dynamicEndOfTurnAttack: 7,
    dynamicEndOfTurnHealth: 9,
    dynamicAvengeProgress: 0,
  });
  assert.ok(golden.description.includes("+9/+11"));
});

test("ghost Skeleton Sharpshooter Avenge cannot mutate its eliminated owner", () => {
  const state = createGame(0xf493);
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
      definitionMinion(
        "BG35_801",
        `skeleton-ghost-opponent-${index}`,
        {
          attack: 100,
          health: 1_000,
        },
      ),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const ghostSource = definitionMinion(
    "BG35_334",
    "ghost-skeleton-sharpshooter",
    {
      attack: 0,
      health: 10_000,
      effectCounters: {
        dynamicEndOfTurnAttack: 7,
        dynamicEndOfTurnHealth: 7,
        dynamicAvengeProgress: 0,
      },
    },
  );
  ghost.board = [
    ghostSource,
    definitionMinion("BG35_801", "ghost-skeleton-victim", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  const countersBefore = structuredClone(
    ghostSource.effectCounters,
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(
    boardMinion(nextGhost, ghostSource.instanceId).effectCounters,
    countersBefore,
  );
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.actorInstanceId === ghostSource.instanceId &&
        event.message.includes("复仇永久提升"),
    ),
  );
});

test("v21 saves migrate to v22 defaults without losing existing counters", () => {
  const state = createGame(0xf494);
  const player = humanPlayer(state);
  const source = definitionMinion(
    "BG35_334",
    "saved-skeleton-sharpshooter",
    {
      effectSupport: "partial",
      effectCounters: {
        dynamicEndOfTurnAttack: 4,
        dynamicEndOfTurnHealth: 5,
        dynamicAvengeProgress: 0,
        existingCounter: 9,
      },
    },
  );
  player.board = [source];
  player.nextTavernSpellDiscount = 3;
  player.tavernSpellsCastThisTurn = 6;
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V21;
  for (const legacyPlayer of state.players) {
    const record = legacyPlayer as unknown as Record<string, unknown>;
    delete record.cardsPlayedThisTurn;
    delete record.lastTavernSpellDefinitionId;
    delete record.pendingTavernSpellDefinitionId;
    delete record.demonFodderRefreshQueue;
  }

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  for (const migratedPlayer of migrated.players) {
    assert.equal(migratedPlayer.cardsPlayedThisTurn, 0);
    assert.equal(migratedPlayer.lastTavernSpellDefinitionId, null);
    assert.equal(
      migratedPlayer.pendingTavernSpellDefinitionId,
      null,
    );
    assert.deepEqual(migratedPlayer.demonFodderRefreshQueue, []);
  }
  const migratedHuman = humanPlayer(migrated);
  assert.equal(migratedHuman.nextTavernSpellDiscount, 3);
  assert.equal(migratedHuman.tavernSpellsCastThisTurn, 6);
  assert.equal(
    boardMinion(migratedHuman, source.instanceId).effectSupport,
    "complete",
  );
  assert.deepEqual(
    boardMinion(migratedHuman, source.instanceId).effectCounters,
    source.effectCounters,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)), migrated);
});

test("AI plays Lab Assistant through the shared engine and retains its Fodder queue", () => {
  let state = createGame(0xf495);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG35_801", "fodder-ai-opponent", {
      attack: 0,
      health: 100_000,
    }),
  ];
  const ai = prepareDuel(state, []);
  const source = definitionMinion(
    "BG35_150",
    "ai-lab-assistant",
  );
  ai.hand = [source];
  ai.board = [];
  ai.gold = 0;

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find(
    (player) => player.id === ai.id,
  );
  assert.ok(nextAi);
  assert.equal(
    nextAi.board.some(
      (minion) => minion.instanceId === source.instanceId,
    ),
    true,
  );
  assert.deepEqual(nextAi.demonFodderRefreshQueue, [1, 1, 1]);
});
