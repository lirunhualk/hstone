import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  scoreMinionForAi,
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
  LEGACY_SCHEMA_11_CONTENT_VERSION_V43,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const MAGNETIC_SATELLITE_DEFINITION_ID =
  "live-magnetic-satellite-token";
const MAGNETIC_SATELLITE_ATTACK_COUNTER =
  "magneticSatelliteAttackBonus";
const MAGNETIC_SATELLITE_HEALTH_COUNTER =
  "magneticSatelliteHealthBonus";

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
    stealth: definition.stealth === true,
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
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
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
    name: `金色·${definition.name}`,
    attack: definition.attack * 2,
    health: definition.health * 2,
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

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[] = [],
): PlayerState {
  const enemy = state.players.find((player) => !player.isHuman);
  assert.ok(enemy);
  for (const player of state.players) {
    if (player.isHuman) {
      player.alive = true;
      player.health = 1_000;
      continue;
    }
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.id === enemy.id) {
      player.alive = true;
      player.health = 1_000;
      player.board = enemyBoard;
    } else {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
  return enemy;
}

function advanceTurn(state: GameState): GameState {
  prepareDuel(state);
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function clearGeneratedPools(state: GameState): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
}

test("v44 exposes exact complete rules and Satellite identities for the four-card batch", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v52",
  );

  const peggy = getMinionDefinition("BG25_032");
  assert.deepEqual(
    [peggy.name, peggy.tier, peggy.attack, peggy.health, peggy.tribe],
    ["佩吉·斯特迪伯", 3, 2, 1, "pirate"],
  );
  assert.equal(peggy.goldenCardId, "BG25_032_G");
  assert.deepEqual(peggy.afterCardAddedToHand, {
    kind: "buffRandomOtherPirate",
    attack: 2,
    health: 1,
    goldenMode: "repeat",
  });

  const moonsteel = getMinionDefinition("BG31_171");
  assert.deepEqual(
    [moonsteel.name, moonsteel.tier, moonsteel.attack, moonsteel.health],
    ["月铁毁灭战舰", 6, 8, 8],
  );
  assert.equal(moonsteel.goldenCardId, "BG31_171_G");
  assert.deepEqual(moonsteel.endOfTurn, {
    kind: "gainUpgradingMagneticSatellites",
    definitionId: MAGNETIC_SATELLITE_DEFINITION_ID,
    count: 2,
    attack: 6,
    health: 6,
    goldenMode: "doubleStats",
  });

  const satellite = getMinionDefinition(
    MAGNETIC_SATELLITE_DEFINITION_ID,
  );
  assert.deepEqual(
    [
      satellite.cardId,
      satellite.goldenCardId,
      satellite.attack,
      satellite.health,
      satellite.tribe,
      satellite.collectible,
    ],
    ["BG31_171t", "BG31_171_Gt", 6, 6, "mech", false],
  );
  assert.deepEqual(satellite.magnetic, { targetTribes: ["mech"] });

  const drust = getMinionDefinition("BG32_234");
  assert.deepEqual(
    [drust.name, drust.tier, drust.attack, drust.health, drust.tribe],
    ["卑鄙的德鲁斯特", 6, 5, 4, "pirate"],
  );
  assert.deepEqual(drust.afterCardAddedToHand, {
    kind: "buffWarbandAfterTribeCardAdded",
    tribe: "pirate",
    attack: 2,
    health: 2,
    goldenTargetAttack: 6,
    goldenTargetHealth: 6,
    goldenMode: "doubleStats",
  });

  const conqueror = getMinionDefinition("BG35_153");
  assert.deepEqual(
    [
      conqueror.name,
      conqueror.tier,
      conqueror.attack,
      conqueror.health,
      conqueror.tribe,
    ],
    ["食力征服者", 6, 9, 7, "demon"],
  );
  assert.deepEqual(conqueror.afterMinionConsumed, {
    tavernAttackThisTurn: 1,
    tavernHealthThisTurn: 1,
    goldenMode: "doubleStats",
  });

  for (const definition of [peggy, moonsteel, drust, conqueror]) {
    assert.equal(definition.effectSupport, "complete");
    assert.ok(definition.goldenDescription);
  }
});

test("Peggy observes every successful hand insert, repeats Golden pulses independently, and observes the resulting Triple", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf440 + Number(golden));
    let player = humanPlayer(state);
    const peggy = golden
      ? goldenMinion("BG25_032", `peggy-${golden}`)
      : definitionMinion("BG25_032", `peggy-${golden}`);
    const pirate = definitionMinion(
      "BG26_817",
      `peggy-target-${golden}`,
    );
    const nonPirate = definitionMinion(
      "BG25_001",
      `peggy-non-pirate-${golden}`,
    );
    const before = { attack: pirate.attack, health: pirate.health };
    player.board = [peggy, pirate, nonPirate];
    player.shop = [
      definitionMinion("BG25_001", `peggy-buy-${golden}`, {
        poolCopies: 1,
      }),
    ];
    player.hand = [];
    player.gold = 10;

    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    player = humanPlayer(state);
    const buffed = player.board.find(
      (minion) => minion.instanceId === pirate.instanceId,
    );
    assert.ok(buffed);
    const pulses = golden ? 2 : 1;
    assert.deepEqual(
      [buffed.attack, buffed.health],
      [before.attack + 2 * pulses, before.health + pulses],
    );
    assert.deepEqual(
      player.board
        .filter((minion) => minion.instanceId !== pirate.instanceId)
        .map((minion) => [minion.attack, minion.health]),
      [
        [peggy.attack, peggy.health],
        [nonPirate.attack, nonPirate.health],
      ],
    );
  }

  let tripleState = createGame(0xf442);
  let triplePlayer = humanPlayer(tripleState);
  const peggy = definitionMinion("BG25_032", "triple-peggy");
  const pirate = definitionMinion("BG26_817", "triple-peggy-target");
  const pirateBefore = { attack: pirate.attack, health: pirate.health };
  triplePlayer.board = [peggy, pirate];
  triplePlayer.hand = [
    definitionMinion("BG25_001", "triple-copy-a", { poolCopies: 1 }),
    definitionMinion("BG25_001", "triple-copy-b", { poolCopies: 1 }),
  ];
  triplePlayer.shop = [
    definitionMinion("BG25_001", "triple-copy-c", { poolCopies: 1 }),
  ];
  triplePlayer.gold = 10;

  tripleState = gameReducer(tripleState, {
    type: "BUY_MINION",
    shopIndex: 0,
  });
  triplePlayer = humanPlayer(tripleState);
  const tripleTarget = triplePlayer.board.find(
    (minion) => minion.instanceId === pirate.instanceId,
  );
  assert.ok(tripleTarget);
  assert.deepEqual(
    [tripleTarget.attack, tripleTarget.health],
    [pirateBefore.attack + 4, pirateBefore.health + 2],
    "the third ordinary card and the resulting Golden card are two inserts",
  );
  const goldenCopy = minionsInHand(triplePlayer).find(
    (minion) => minion.definitionId === "BG25_001" && minion.golden,
  );
  assert.ok(goldenCopy);
});

test("Drust buffs the whole warband only for gained Pirate minions and uses Golden-target values", () => {
  for (const sourceGolden of [false, true]) {
    let state = createGame(0xf450 + Number(sourceGolden));
    let player = humanPlayer(state);
    const drust = sourceGolden
      ? goldenMinion("BG32_234", `drust-${sourceGolden}`)
      : definitionMinion("BG32_234", `drust-${sourceGolden}`);
    const ordinary = definitionMinion(
      "BG25_001",
      `drust-ordinary-${sourceGolden}`,
    );
    const golden = goldenMinion(
      "BG35_153",
      `drust-golden-${sourceGolden}`,
    );
    const before = [drust, ordinary, golden].map((minion) => ({
      instanceId: minion.instanceId,
      attack: minion.attack,
      health: minion.health,
      golden: minion.golden,
    }));
    player.board = [drust, ordinary, golden];
    player.shop = [
      definitionMinion("BG26_814", `drust-pirate-${sourceGolden}`, {
        poolCopies: 1,
      }),
    ];
    player.hand = [];
    player.gold = 10;

    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    player = humanPlayer(state);
    const sourceScale = sourceGolden ? 2 : 1;
    for (const snapshot of before) {
      const current = player.board.find(
        (minion) => minion.instanceId === snapshot.instanceId,
      );
      assert.ok(current);
      const amount = (snapshot.golden ? 6 : 2) * sourceScale;
      assert.deepEqual(
        [current.attack, current.health],
        [snapshot.attack + amount, snapshot.health + amount],
      );
    }
  }

  let nonPirateState = createGame(0xf452);
  let nonPiratePlayer = humanPlayer(nonPirateState);
  const drust = definitionMinion("BG32_234", "non-pirate-drust");
  const target = definitionMinion("BG25_001", "non-pirate-target");
  nonPiratePlayer.board = [drust, target];
  nonPiratePlayer.shop = [
    definitionMinion("BG25_001", "non-pirate-buy", { poolCopies: 1 }),
  ];
  nonPiratePlayer.hand = [];
  nonPiratePlayer.gold = 10;
  nonPirateState = gameReducer(nonPirateState, {
    type: "BUY_MINION",
    shopIndex: 0,
  });
  nonPiratePlayer = humanPlayer(nonPirateState);
  assert.deepEqual(
    nonPiratePlayer.board.map((minion) => [minion.attack, minion.health]),
    [
      [drust.attack, drust.health],
      [target.attack, target.health],
    ],
  );
});

test("combat hand gains emit cardGain before Peggy and Drust buff animations", () => {
  const state = createGame(0xf460);
  const player = humanPlayer(state);
  const recruiter = definitionMinion("BG29_862", "combat-recruiter", {
    attack: 1,
    health: 1,
    taunt: true,
  });
  const peggy = definitionMinion("BG25_032", "combat-peggy");
  const drust = definitionMinion("BG32_234", "combat-drust");
  player.board = [recruiter, peggy, drust];
  player.hand = [];
  player.tavernTier = 6;
  state.activeTribes = ["pirate", "mech", "demon", "beast", "dragon"];
  clearGeneratedPools(state);
  state.pool.BG26_814 = 1;
  prepareDuel(state, [
    definitionMinion("BG25_001", "combat-recruiter-enemy", {
      attack: 100,
      health: 100,
      taunt: true,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.ok(combat.lastBattle);
  const relevant = combat.lastBattle.events.filter(
    (event) =>
      (event.type === "cardGain" &&
        event.actorInstanceId === recruiter.instanceId) ||
      (event.type === "buff" &&
        (event.actorInstanceId === peggy.instanceId ||
          event.actorInstanceId === drust.instanceId)),
  );
  assert.equal(
    relevant.length,
    4,
    JSON.stringify(relevant, null, 2),
  );
  assert.deepEqual(
    relevant.map((event) => event.type),
    ["cardGain", "buff", "buff", "buff"],
  );
  const gain = relevant[0];
  assert.equal(gain.type, "cardGain");
  assert.equal(gain.cardGainResult, "added");
  assert.equal(gain.minion?.definitionId, "BG26_814");
  const buffs = relevant.slice(1);
  assert.deepEqual(
    buffs.map((event) =>
      event.type === "buff"
        ? [event.attackDelta, event.healthDelta]
        : null,
    ),
    [
      [2, 1],
      [2, 2],
      [2, 2],
    ],
  );
  assert.ok(
    minionsInHand(humanPlayer(combat)).some(
      (minion) => minion.definitionId === "BG26_814",
    ),
  );
});

test("Conqueror observes each real Picky Eater consume and doubles only its Tavern pulse when Golden", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf470 + Number(golden));
    let player = humanPlayer(state);
    const conqueror = golden
      ? goldenMinion("BG35_153", `conqueror-${golden}`)
      : definitionMinion("BG35_153", `conqueror-${golden}`);
    player.board = [conqueror];
    player.hand = [
      definitionMinion("BG24_009", `picky-eater-${golden}`),
    ];
    player.shop = [
      definitionMinion("BG25_001", `consume-offer-a-${golden}`, {
        attack: 1,
        health: 1,
        poolCopies: 1,
      }),
      definitionMinion("BG25_001", `consume-offer-b-${golden}`, {
        attack: 1,
        health: 1,
        poolCopies: 1,
      }),
    ];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 1,
    });
    player = humanPlayer(state);
    const pulse = golden ? 2 : 1;
    assert.equal(player.shop.length, 1);
    assert.deepEqual(
      [player.shop[0].attack, player.shop[0].health],
      [1 + pulse, 1 + pulse],
    );
    assert.deepEqual(
      [
        player.tavernMinionAttackBonusThisTurn,
        player.tavernMinionHealthBonusThisTurn,
      ],
      [pulse, pulse],
    );
  }
});

test("Corrupted Cupcakes resolves Conqueror pulses sequentially, returns pool copies once, and clears the temporary layer next turn", () => {
  let state = createGame(0xf472);
  let player = humanPlayer(state);
  const conqueror = definitionMinion("BG35_153", "cupcake-conqueror");
  const base = { attack: conqueror.attack, health: conqueror.health };
  player.board = [conqueror];
  player.hand = [
    tavernSpell(
      "tavern-spell-corrupted-cupcakes",
      "conqueror-cupcakes",
    ),
  ];
  player.shop = Array.from({ length: 3 }, (_, index) =>
    definitionMinion("BG25_001", `cupcake-food-${index}`, {
      attack: 1,
      health: 1,
      poolCopies: 1,
    }),
  );
  player.gold = 10;
  const poolBefore = state.pool.BG25_001 ?? 0;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "conqueror-cupcakes",
    targetInstanceId: conqueror.instanceId,
  });
  player = humanPlayer(state);
  const buffedConqueror = player.board.find(
    (minion) => minion.instanceId === conqueror.instanceId,
  );
  assert.ok(buffedConqueror);
  assert.deepEqual(
    [buffedConqueror.attack, buffedConqueror.health],
    [base.attack + 6, base.health + 6],
    "the three foods contribute 1/1, then 2/2, then 3/3",
  );
  assert.equal(player.shop.length, 0);
  assert.equal(state.pool.BG25_001, poolBefore + 3);
  assert.deepEqual(
    [
      player.tavernMinionAttackBonusThisTurn,
      player.tavernMinionHealthBonusThisTurn,
    ],
    [3, 3],
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  assert.equal(
    player.shop.every(
      (minion) =>
        minion.temporaryAttack === 3 && minion.temporaryHealth === 3,
    ),
    true,
  );

  state = advanceTurn(state);
  player = humanPlayer(state);
  assert.deepEqual(
    [
      player.tavernMinionAttackBonusThisTurn,
      player.tavernMinionHealthBonusThisTurn,
    ],
    [0, 0],
  );
  assert.equal(
    player.shop.every(
      (minion) =>
        minion.temporaryAttack === 0 && minion.temporaryHealth === 0,
    ),
    true,
  );
});

test("Moonsteel generates ordinary Satellites at current stats, upgrades after each full trigger, and repeats sequentially with Drakkari", () => {
  for (const golden of [false, true]) {
    const state = createGame(0xf480 + Number(golden));
    const player = humanPlayer(state);
    const moonsteel = golden
      ? goldenMinion("BG31_171", `moonsteel-${golden}`)
      : definitionMinion("BG31_171", `moonsteel-${golden}`);
    player.board = [moonsteel];
    player.hand = [];
    prepareDuel(state);

    const combat = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(combat);
    const satellites = minionsInHand(nextPlayer).filter(
      (minion) => minion.definitionId === MAGNETIC_SATELLITE_DEFINITION_ID,
    );
    const stats = golden ? 12 : 6;
    assert.equal(satellites.length, 2);
    assert.equal(
      satellites.every(
        (satellite) =>
          satellite.cardId === "BG31_171t" &&
          !satellite.golden &&
          satellite.attack === stats &&
          satellite.health === stats,
      ),
      true,
    );
    const currentSource = nextPlayer.board.find(
      (minion) => minion.instanceId === moonsteel.instanceId,
    );
    assert.ok(currentSource);
    assert.equal(
      currentSource.effectCounters?.[
        MAGNETIC_SATELLITE_ATTACK_COUNTER
      ],
      stats,
    );
    assert.equal(
      currentSource.effectCounters?.[
        MAGNETIC_SATELLITE_HEALTH_COUNTER
      ],
      stats,
    );
    assert.match(currentSource.description, new RegExp(`${stats * 2}/${stats * 2}`));
  }

  const repeated = createGame(0xf482);
  const repeatedPlayer = humanPlayer(repeated);
  const moonsteel = definitionMinion("BG31_171", "repeated-moonsteel");
  repeatedPlayer.board = [
    moonsteel,
    definitionMinion("BG26_ICC_901", "ordinary-drakkari"),
  ];
  repeatedPlayer.hand = [];
  prepareDuel(repeated);

  const repeatedCombat = gameReducer(repeated, { type: "END_TURN" });
  assert.deepEqual(
    minionsInHand(humanPlayer(repeatedCombat))
      .filter(
        (minion) =>
          minion.definitionId === MAGNETIC_SATELLITE_DEFINITION_ID,
      )
      .map((minion) => [minion.attack, minion.health]),
    [
      [6, 6],
      [6, 6],
      [12, 12],
      [12, 12],
    ],
  );
  const repeatedSource = humanPlayer(repeatedCombat).board.find(
    (minion) => minion.instanceId === moonsteel.instanceId,
  );
  assert.ok(repeatedSource);
  assert.match(repeatedSource.description, /18\/18/u);
});

test("Moonsteel full-hand burns do not allocate instances but still upgrade the next batch", () => {
  for (const handSize of [9, 10]) {
    const state = createGame(0xf484 + handSize);
    const player = humanPlayer(state);
    const moonsteel = definitionMinion(
      "BG31_171",
      `full-hand-moonsteel-${handSize}`,
    );
    player.board = [moonsteel];
    player.hand = Array.from({ length: handSize }, (_, index) =>
      bloodGem(`full-hand-gem-${handSize}-${index}`),
    );
    clearGeneratedPools(state);
    prepareDuel(state);
    const nextInstanceId = state.nextInstanceId;

    const combat = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(combat);
    const satellites = minionsInHand(nextPlayer).filter(
      (minion) => minion.definitionId === MAGNETIC_SATELLITE_DEFINITION_ID,
    );
    const admitted = 10 - handSize;
    assert.equal(satellites.length, admitted);
    assert.equal(combat.nextInstanceId, nextInstanceId + admitted);
    const source = nextPlayer.board.find(
      (minion) => minion.instanceId === moonsteel.instanceId,
    );
    assert.ok(source);
    assert.equal(
      source.effectCounters?.[
        MAGNETIC_SATELLITE_ATTACK_COUNTER
      ],
      6,
    );
    assert.match(source.description, /12\/12/u);
  }
});

test("Golden Moonsteel still creates ordinary Satellites and deferred Triple resolution preserves all 12/12 buffs", () => {
  const state = createGame(0xf496);
  const player = humanPlayer(state);
  const moonsteel = goldenMinion("BG31_171", "triple-moonsteel");
  player.board = [moonsteel];
  player.hand = [
    definitionMinion(
      MAGNETIC_SATELLITE_DEFINITION_ID,
      "satellite-copy-a",
      { attack: 12, health: 12 },
    ),
    definitionMinion(
      MAGNETIC_SATELLITE_DEFINITION_ID,
      "satellite-copy-b",
      { attack: 12, health: 12 },
    ),
  ];
  prepareDuel(state);

  const combat = gameReducer(state, { type: "END_TURN" });
  const combatSatellites = minionsInHand(humanPlayer(combat)).filter(
    (minion) => minion.definitionId === MAGNETIC_SATELLITE_DEFINITION_ID,
  );
  assert.equal(combatSatellites.length, 4);
  assert.equal(
    combatSatellites.every(
      (satellite) =>
        !satellite.golden &&
        satellite.cardId === "BG31_171t" &&
        satellite.attack === 12 &&
        satellite.health === 12,
    ),
    true,
  );

  const recruit = gameReducer(combat, { type: "CONTINUE" });
  const recruitSatellites = minionsInHand(humanPlayer(recruit)).filter(
    (minion) => minion.definitionId === MAGNETIC_SATELLITE_DEFINITION_ID,
  );
  assert.equal(recruitSatellites.length, 2);
  const goldenSatellite = recruitSatellites.find(
    (satellite) => satellite.golden,
  );
  const ordinarySatellite = recruitSatellites.find(
    (satellite) => !satellite.golden,
  );
  assert.ok(goldenSatellite);
  assert.ok(ordinarySatellite);
  assert.deepEqual(
    [
      goldenSatellite.cardId,
      goldenSatellite.attack,
      goldenSatellite.health,
      goldenSatellite.grantsTripleReward,
    ],
    ["BG31_171_Gt", 30, 30, true],
  );
  assert.deepEqual(
    [ordinarySatellite.cardId, ordinarySatellite.attack, ordinarySatellite.health],
    ["BG31_171t", 12, 12],
  );
});

test("Moonsteel Triple merges accumulated upgrade counters and v43 saves refresh its dynamic text", () => {
  let state = createGame(0xf498);
  let player = humanPlayer(state);
  player.board = [];
  player.hand = [
    definitionMinion("BG31_171", "moonsteel-copy-a", {
      effectCounters: {
        [MAGNETIC_SATELLITE_ATTACK_COUNTER]: 6,
        [MAGNETIC_SATELLITE_HEALTH_COUNTER]: 6,
      },
    }),
    definitionMinion("BG31_171", "moonsteel-copy-b", {
      effectCounters: {
        [MAGNETIC_SATELLITE_ATTACK_COUNTER]: 12,
        [MAGNETIC_SATELLITE_HEALTH_COUNTER]: 12,
      },
    }),
  ];
  player.shop = [
    definitionMinion("BG31_171", "moonsteel-copy-c", {
      poolCopies: 1,
    }),
  ];
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const goldenMoonsteel = minionsInHand(player).find(
    (minion) => minion.definitionId === "BG31_171" && minion.golden,
  );
  assert.ok(goldenMoonsteel);
  assert.equal(
    goldenMoonsteel.effectCounters?.[
      MAGNETIC_SATELLITE_ATTACK_COUNTER
    ],
    18,
  );
  assert.equal(
    goldenMoonsteel.effectCounters?.[
      MAGNETIC_SATELLITE_HEALTH_COUNTER
    ],
    18,
  );
  assert.match(goldenMoonsteel.description, /30\/30/u);

  const legacy = structuredClone(state) as GameState;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V43;
  const legacyMoonsteel = minionsInHand(humanPlayer(legacy)).find(
    (minion) => minion.definitionId === "BG31_171",
  );
  assert.ok(legacyMoonsteel);
  legacyMoonsteel.description = "旧说明";
  const normalized = normalizePersistedGameState(legacy) as GameState | null;
  assert.ok(normalized);
  assert.equal(normalized.contentVersion, CURRENT_ROSTER_VERSION);
  const migratedMoonsteel = minionsInHand(humanPlayer(normalized)).find(
    (minion) => minion.definitionId === "BG31_171",
  );
  assert.ok(migratedMoonsteel);
  assert.match(migratedMoonsteel.description, /30\/30/u);
});

test("AI valuation recognizes hand-gain, consume, and upgraded Satellite engines", () => {
  const state = createGame(0xf49a);
  const player = humanPlayer(state);
  const peggy = definitionMinion("BG25_032", "ai-peggy");
  player.board = [];
  player.hand = [];
  const peggyWithoutPirate = scoreMinionForAi(player, peggy);
  player.board = [definitionMinion("BG26_817", "ai-peggy-target")];
  const peggyWithPirate = scoreMinionForAi(player, peggy);
  assert.ok(peggyWithPirate > peggyWithoutPirate);

  const moonsteel = definitionMinion("BG31_171", "ai-moonsteel");
  player.board = [moonsteel];
  const freshMoonsteel = scoreMinionForAi(player, moonsteel);
  moonsteel.effectCounters = {
    [MAGNETIC_SATELLITE_ATTACK_COUNTER]: 12,
    [MAGNETIC_SATELLITE_HEALTH_COUNTER]: 12,
  };
  const upgradedMoonsteel = scoreMinionForAi(player, moonsteel);
  assert.ok(upgradedMoonsteel > freshMoonsteel);

  const conqueror = definitionMinion("BG35_153", "ai-conqueror");
  player.board = [];
  player.shop = [];
  const emptyTavernScore = scoreMinionForAi(player, conqueror);
  player.board = [
    definitionMinion("BG24_009", "ai-picky-a"),
    definitionMinion("BG24_009", "ai-picky-b"),
  ];
  player.shop = [
    definitionMinion("BG25_001", "ai-food-a"),
    definitionMinion("BG25_001", "ai-food-b"),
    definitionMinion("BG25_001", "ai-food-c"),
  ];
  const consumeEngineScore = scoreMinionForAi(player, conqueror);
  assert.ok(consumeEngineScore > emptyTavernScore);
});
