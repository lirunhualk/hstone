import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  scoreMinionForAi,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
  type TripleRewardSpellInstance,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V44,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const FELBOAR_PROGRESS_COUNTER = "playerSpellProgress";
const TIDE_PROGRESS_COUNTER = "tavernSpellAuraCardsPlayedThisTurn";
const TIDE_ATTACK_COUNTER = "tavernSpellAuraAttackBonusThisTurn";
const TIDE_HEALTH_COUNTER = "tavernSpellAuraHealthBonusThisTurn";
const DARKCREST_TIER_COUNTER = "evolvingSpellcraftRewardTier";

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

function spellcraft(
  definitionId: string,
  instanceId: string,
  rewardTier?: 1 | 2 | 3 | 4 | 5 | 6,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    description:
      rewardTier === undefined
        ? definition.description
        : definition.description.replace(/等级\d+/gu, `等级${rewardTier}`),
    spellFamily: definition.spellFamily ?? "spellcraft",
    target: definition.target,
    effectMultiplier: 1,
    ...(rewardTier === undefined ? {} : { rewardTier }),
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

function tripleReward(
  instanceId: string,
  tier: TripleRewardSpellInstance["tier"] = 2,
): TripleRewardSpellInstance {
  return {
    ...definitionMinion("BG25_001", instanceId, { tier }),
    kind: "tripleReward",
    tier,
    definitionId: "triple-reward",
    cardId: "TB_BaconShop_Triples_01",
    name: "三连奖励",
    description: "发现一个比你当前酒馆等级高一级的随从。",
    attack: 0,
    health: 0,
    sellValue: 0,
  };
}

function boardMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const minion = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion);
  return minion;
}

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function spellcraftInHand(player: PlayerState): SpellcraftSpellInstance[] {
  return player.hand.filter(
    (card): card is SpellcraftSpellInstance => card.kind === "spellcraft",
  );
}

function prepareDuel(state: GameState): PlayerState {
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
      player.board = [];
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

function clearMinionPool(state: GameState): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
}

function ensureNagaLobby(state: GameState): void {
  state.activeTribes = ["naga", "dragon", "demon", "mech", "murloc"];
}

test("v45 exposes exact complete rules for Felboar, Tide Oracle, Groundbreaker, and Darkcrest", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v50",
  );

  const felboar = getMinionDefinition("BG28_633");
  assert.deepEqual(
    [felboar.name, felboar.tier, felboar.attack, felboar.health],
    ["邪能野猪人", 5, 2, 6],
  );
  assert.deepEqual(felboar.tribes, ["demon", "quilboar"]);
  assert.deepEqual(felboar.afterPlayerSpellCast, {
    kind: "consumeRandomShopMinion",
    spellsRequired: 3,
    goldenMode: "doubleStats",
  });

  const tide = getMinionDefinition("BG35_895");
  assert.deepEqual(
    [tide.name, tide.tier, tide.attack, tide.health, tide.tribe],
    ["招潮者先知", 5, 5, 6, "murloc"],
  );
  assert.deepEqual(tide.tavernSpellBuffAura, { attack: 1, health: 1 });
  assert.deepEqual(tide.afterCardPlayed, {
    filter: { tribe: "murloc" },
    includeSource: true,
    effects: [
      {
        kind: "improveTavernSpellAuraThisTurn",
        cardsRequired: 2,
        attack: 1,
        health: 1,
      },
    ],
  });

  const groundbreaker = getMinionDefinition("BG31_035");
  assert.deepEqual(
    [
      groundbreaker.name,
      groundbreaker.tier,
      groundbreaker.attack,
      groundbreaker.health,
      groundbreaker.tribe,
    ],
    ["碎地者", 6, 5, 4, "naga"],
  );
  assert.deepEqual(groundbreaker.afterCardPlayed, {
    filter: { tribe: "naga" },
    includeSource: true,
    effects: [
      {
        kind: "buffSelfByPlayerSpellHistory",
        attack: 1,
        health: 1,
        spellsPerUpgrade: 4,
      },
    ],
  });

  const darkcrest = getMinionDefinition("BG31_920");
  assert.deepEqual(
    [darkcrest.name, darkcrest.tier, darkcrest.attack, darkcrest.health],
    ["暗潮战略专家", 5, 4, 5],
  );
  assert.deepEqual(darkcrest.spellcraft, {
    definitionId: "spellcraft-evolving-strategy",
    evolvingRewardTier: { initialTier: 1, maximumTier: 6 },
  });
  assert.equal(
    getSpellcraftDefinition("spellcraft-evolving-strategy").goldenCardId,
    "BG31_920_Gt",
  );

  for (const definition of [felboar, tide, groundbreaker, darkcrest]) {
    assert.equal(definition.effectSupport, "complete");
    assert.ok(definition.goldenCardId);
    assert.ok(definition.goldenDescription);
  }
});

test("Felboar counts player spell pulses, consumes after resolution, returns the pool copy, and Golden doubles one meal", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf500 + Number(golden));
    let player = humanPlayer(state);
    const felboar = golden
      ? goldenMinion("BG28_633", `felboar-${golden}`)
      : definitionMinion("BG28_633", `felboar-${golden}`);
    const initial = { attack: felboar.attack, health: felboar.health };
    player.board = [felboar];
    player.hand = Array.from({ length: 3 }, (_, index) =>
      tavernSpell(
        "tavern-spell-tavern-coin",
        `felboar-coin-${golden}-${index}`,
      ),
    );
    player.shop = [
      definitionMinion("BG25_001", `felboar-food-${golden}`, {
        attack: 7,
        health: 9,
        poolCopies: 1,
      }),
    ];
    const poolBefore = state.pool.BG25_001 ?? 0;

    for (let cast = 0; cast < 3; cast += 1) {
      state = gameReducer(state, {
        type: "CAST_TAVERN_SPELL",
        cardInstanceId: `felboar-coin-${golden}-${cast}`,
      });
      player = humanPlayer(state);
      assert.equal(player.playerSpellsCast, cast + 1);
      assert.equal(
        boardMinion(state, felboar.instanceId).effectCounters?.[
          FELBOAR_PROGRESS_COUNTER
        ],
        (cast + 1) % 3,
      );
    }

    const current = boardMinion(state, felboar.instanceId);
    const scale = golden ? 2 : 1;
    assert.deepEqual(
      [current.attack, current.health],
      [initial.attack + 7 * scale, initial.health + 9 * scale],
    );
    assert.equal(player.shop.length, 0);
    assert.equal(state.pool.BG25_001, poolBefore + 1);
    assert.match(current.description, /还剩3个/u);
  }
});

test("Felboar progress persists across turns, an empty Tavern consumes the threshold, and minion-cast spells do not count", () => {
  let state = createGame(0xf503);
  let player = humanPlayer(state);
  const felboar = definitionMinion("BG28_633", "persistent-felboar");
  player.board = [felboar];
  player.hand = [
    tavernSpell("tavern-spell-tavern-coin", "persistent-coin-a"),
    tavernSpell("tavern-spell-tavern-coin", "persistent-coin-b"),
  ];
  player.shop = [];
  for (const cardInstanceId of ["persistent-coin-a", "persistent-coin-b"]) {
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId,
    });
  }
  assert.equal(
    boardMinion(state, felboar.instanceId).effectCounters?.[
      FELBOAR_PROGRESS_COUNTER
    ],
    2,
  );
  assert.match(boardMinion(state, felboar.instanceId).description, /还剩1个/u);

  state = advanceTurn(state);
  player = humanPlayer(state);
  assert.equal(
    boardMinion(state, felboar.instanceId).effectCounters?.[
      FELBOAR_PROGRESS_COUNTER
    ],
    2,
  );
  player.hand = [
    tavernSpell("tavern-spell-tavern-coin", "empty-threshold-coin"),
  ];
  player.shop = [];
  const before = boardMinion(state, felboar.instanceId);
  const statsBefore = [before.attack, before.health];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "empty-threshold-coin",
  });
  assert.deepEqual(
    [
      boardMinion(state, felboar.instanceId).attack,
      boardMinion(state, felboar.instanceId).health,
    ],
    statsBefore,
  );
  assert.equal(
    boardMinion(state, felboar.instanceId).effectCounters?.[
      FELBOAR_PROGRESS_COUNTER
    ],
    0,
  );

  player = humanPlayer(state);
  player.hand = [definitionMinion("BG34_926", "queen-spell-caster")];
  player.shop = [
    definitionMinion("BG25_001", "ignored-triggered-food", {
      attack: 20,
      health: 20,
      poolCopies: 1,
    }),
  ];
  const historyBefore = player.playerSpellsCast;
  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 1,
  });
  assert.equal(humanPlayer(state).playerSpellsCast, historyBefore);
  assert.equal(
    boardMinion(state, felboar.instanceId).effectCounters?.[
      FELBOAR_PROGRESS_COUNTER
    ],
    0,
  );
  assert.equal(humanPlayer(state).shop.length, 1);
});

test("Felboar waits for a Triple Reward discovery to resolve before consuming the Tavern", () => {
  let state = createGame(0xf504);
  let player = humanPlayer(state);
  const felboar = definitionMinion("BG28_633", "discover-felboar", {
    effectCounters: { [FELBOAR_PROGRESS_COUNTER]: 2 },
  });
  player.board = [felboar];
  player.playerSpellsCast = 2;
  player.hand = [tripleReward("discover-triple-reward")];
  player.shop = [
    definitionMinion("BG25_001", "post-discover-food", {
      attack: 6,
      health: 8,
      poolCopies: 1,
    }),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "discover-triple-reward",
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.completionSource, "tripleRewardCast");
  assert.equal(humanPlayer(state).shop.length, 1);
  assert.equal(humanPlayer(state).playerSpellsCast, 2);
  assert.equal(
    boardMinion(state, felboar.instanceId).effectCounters?.[
      FELBOAR_PROGRESS_COUNTER
    ],
    2,
  );

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(player.playerSpellsCast, 3);
  assert.equal(player.shop.length, 0);
  const current = boardMinion(state, felboar.instanceId);
  assert.deepEqual(
    [current.attack, current.health],
    [felboar.attack + 6, felboar.health + 8],
  );
});

test("Tide Oracle counts itself, upgrades every two Murlocs, buffs Tavern Spells additively, and resets next turn", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf510 + Number(golden));
    let player = humanPlayer(state);
    const tide = golden
      ? goldenMinion("BG35_895", `tide-${golden}`)
      : definitionMinion("BG35_895", `tide-${golden}`);
    const secondMurloc = definitionMinion(
      "BG32_330",
      `second-murloc-${golden}`,
    );
    player.board = [];
    player.hand = [tide, secondMurloc];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 0,
    });
    let currentTide = boardMinion(state, tide.instanceId);
    assert.equal(
      currentTide.effectCounters?.[TIDE_PROGRESS_COUNTER],
      1,
    );
    assert.match(currentTide.description, /还剩1张/u);

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 1,
    });
    currentTide = boardMinion(state, tide.instanceId);
    const temporaryAura = 1;
    assert.equal(
      currentTide.effectCounters?.[TIDE_PROGRESS_COUNTER],
      0,
    );
    assert.equal(
      currentTide.effectCounters?.[TIDE_ATTACK_COUNTER],
      temporaryAura,
    );
    assert.equal(
      currentTide.effectCounters?.[TIDE_HEALTH_COUNTER],
      temporaryAura,
    );
    const fullAura =
      (golden ? 2 : 1) + temporaryAura * (golden ? 2 : 1);
    assert.match(currentTide.description, new RegExp(`\\+${fullAura}/\\+${fullAura}`));

    player = humanPlayer(state);
    const target = player.board.find(
      (minion) => minion.instanceId === secondMurloc.instanceId,
    );
    assert.ok(target);
    const before = { attack: target.attack, health: target.health };
    player.hand = [
      tavernSpell(
        "tavern-spell-tavern-dish-banana",
        `tide-banana-${golden}`,
      ),
    ];
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `tide-banana-${golden}`,
      targetInstanceId: target.instanceId,
    });
    const buffedTarget = boardMinion(state, target.instanceId);
    assert.deepEqual(
      [buffedTarget.attack, buffedTarget.health],
      [before.attack + 2 + fullAura, before.health + 2 + fullAura],
    );

    state = advanceTurn(state);
    currentTide = boardMinion(state, tide.instanceId);
    assert.deepEqual(
      [
        currentTide.effectCounters?.[TIDE_PROGRESS_COUNTER],
        currentTide.effectCounters?.[TIDE_ATTACK_COUNTER],
        currentTide.effectCounters?.[TIDE_HEALTH_COUNTER],
      ],
      [0, 0, 0],
    );
    assert.match(
      currentTide.description,
      new RegExp(`\\+${golden ? 2 : 1}/\\+${golden ? 2 : 1}`),
    );
    assert.match(currentTide.description, /还剩2张/u);
  }
});

test("Tide Oracle Triple keeps the best progress and converts ordinary temporary aura gains to Golden scale", () => {
  let state = createGame(0xf512);
  let player = humanPlayer(state);
  player.board = [];
  player.hand = [
    definitionMinion("BG35_895", "tide-triple-a", {
      effectCounters: {
        [TIDE_PROGRESS_COUNTER]: 1,
        [TIDE_ATTACK_COUNTER]: 1,
        [TIDE_HEALTH_COUNTER]: 1,
      },
    }),
    definitionMinion("BG35_895", "tide-triple-b", {
      effectCounters: {
        [TIDE_PROGRESS_COUNTER]: 0,
        [TIDE_ATTACK_COUNTER]: 0,
        [TIDE_HEALTH_COUNTER]: 0,
      },
    }),
  ];
  player.shop = [
    definitionMinion("BG35_895", "tide-triple-c", { poolCopies: 1 }),
  ];
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const golden = minionsInHand(player).find(
    (minion) => minion.definitionId === "BG35_895" && minion.golden,
  );
  assert.ok(golden);
  assert.deepEqual(
    [
      golden.effectCounters?.[TIDE_PROGRESS_COUNTER],
      golden.effectCounters?.[TIDE_ATTACK_COUNTER],
      golden.effectCounters?.[TIDE_HEALTH_COUNTER],
    ],
    [1, 1, 1],
  );
  assert.match(golden.description, /\+4\/\+4/u);
  assert.match(golden.description, /还剩1张/u);
});

test("Goldenizer rescales Tide Oracle's completed improvements and still counts as a player spell", () => {
  let state = createGame(0xf513);
  let player = humanPlayer(state);
  const tide = definitionMinion("BG35_895", "goldenized-tide", {
    effectCounters: {
      [TIDE_PROGRESS_COUNTER]: 0,
      [TIDE_ATTACK_COUNTER]: 1,
      [TIDE_HEALTH_COUNTER]: 1,
    },
  });
  player.board = [tide];
  player.hand = [
    tavernSpell("system-spell-goldenizer", "tide-goldenizer"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "tide-goldenizer",
    targetInstanceId: tide.instanceId,
  });
  player = humanPlayer(state);
  const current = boardMinion(state, tide.instanceId);
  assert.equal(current.golden, true);
  assert.equal(current.effectCounters?.[TIDE_ATTACK_COUNTER], 1);
  assert.equal(current.effectCounters?.[TIDE_HEALTH_COUNTER], 1);
  assert.match(current.description, /\+4\/\+4/u);
  assert.equal(player.playerSpellsCast, 1);
  assert.equal(player.tavernSpellsCast, 0);
});

test("Groundbreaker uses all prior player spell history, counts itself as a Naga, and scales Golden stats", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf520 + Number(golden));
    let player = humanPlayer(state);
    player.playerSpellsCast = 8;
    const groundbreaker = golden
      ? goldenMinion("BG31_035", `groundbreaker-${golden}`)
      : definitionMinion("BG31_035", `groundbreaker-${golden}`);
    const base = {
      attack: groundbreaker.attack,
      health: groundbreaker.health,
    };
    player.board = [];
    player.hand = [groundbreaker];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 0,
    });
    const scale = golden ? 2 : 1;
    let current = boardMinion(state, groundbreaker.instanceId);
    assert.deepEqual(
      [current.attack, current.health],
      [base.attack + 3 * scale, base.health + 3 * scale],
    );
    assert.match(
      current.description,
      new RegExp(`\\+${3 * scale}/\\+${3 * scale}`),
    );

    player = humanPlayer(state);
    player.hand = [definitionMinion("BG27_004", `played-naga-${golden}`)];
    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 1,
    });
    current = boardMinion(state, groundbreaker.instanceId);
    assert.deepEqual(
      [current.attack, current.health],
      [base.attack + 6 * scale, base.health + 6 * scale],
    );
  }
});

test("Tavern Spells, Blood Gems, and Spellcraft all advance Groundbreaker's global spell history", () => {
  let state = createGame(0xf522);
  let player = humanPlayer(state);
  const groundbreaker = definitionMinion("BG31_035", "history-groundbreaker");
  const target = definitionMinion("BG25_001", "history-target");
  player.board = [groundbreaker, target];
  player.hand = [
    tavernSpell("tavern-spell-tavern-coin", "history-coin-a"),
    bloodGem("history-gem"),
    spellcraft("spellcraft-deep-blue-blues", "history-spellcraft"),
    tavernSpell("tavern-spell-tavern-coin", "history-coin-b"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "history-coin-a",
  });
  assert.equal(humanPlayer(state).playerSpellsCast, 1);
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "history-gem",
    targetInstanceId: target.instanceId,
  });
  assert.equal(humanPlayer(state).playerSpellsCast, 2);
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "history-spellcraft",
    targetInstanceId: target.instanceId,
  });
  assert.equal(humanPlayer(state).playerSpellsCast, 3);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "history-coin-b",
  });
  assert.equal(humanPlayer(state).playerSpellsCast, 4);
  assert.match(
    boardMinion(state, groundbreaker.instanceId).description,
    /\+2\/\+2/u,
  );

  player = humanPlayer(state);
  player.hand = [definitionMinion("BG27_004", "history-naga")];
  const before = boardMinion(state, groundbreaker.instanceId);
  const beforeStats = [before.attack, before.health];
  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 2,
  });
  const current = boardMinion(state, groundbreaker.instanceId);
  assert.deepEqual(
    [current.attack, current.health],
    [beforeStats[0] + 2, beforeStats[1] + 2],
  );
});

test("Darkcrest snapshots its evolving tier, Drakkari advances it twice, and exact-tier Naga draws ignore Tavern Tier", () => {
  let state = createGame(0xf530);
  ensureNagaLobby(state);
  let player = humanPlayer(state);
  const darkcrest = definitionMinion("BG31_920", "evolving-darkcrest");
  player.board = [definitionMinion("BG26_ICC_901", "evolving-drakkari")];
  player.hand = [darkcrest];

  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 0,
  });
  let generated = spellcraftInHand(humanPlayer(state));
  assert.equal(generated.length, 1);
  assert.deepEqual(
    [generated[0].cardId, generated[0].effectMultiplier, generated[0].rewardTier],
    ["BG31_920t", 1, 1],
  );
  assert.match(generated[0].description, /等级1/u);

  state = advanceTurn(state);
  player = humanPlayer(state);
  const currentSource = boardMinion(state, darkcrest.instanceId);
  assert.equal(currentSource.effectCounters?.[DARKCREST_TIER_COUNTER], 3);
  assert.match(currentSource.description, /等级3/u);
  generated = spellcraftInHand(player);
  assert.equal(generated.length, 1);
  assert.equal(generated[0].rewardTier, 3);
  assert.match(generated[0].description, /等级3/u);

  clearMinionPool(state);
  state.pool.BG27_004 = 1;
  state.pool.BG26_502 = 1;
  const spellInstanceId = generated[0].instanceId;
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spellInstanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 1);
  assert.equal(
    minionsInHand(player).some(
      (minion) => minion.definitionId === "BG26_502" && minion.tier === 3,
    ),
    true,
  );
  assert.equal(
    minionsInHand(player).some((minion) => minion.definitionId === "BG27_004"),
    false,
  );
  assert.equal(state.pool.BG26_502, 0);
  assert.equal(state.pool.BG27_004, 1);
  assert.equal(player.playerSpellsCast, 1);
});

test("Golden Darkcrest draws two sequential exact-tier Naga and returns the overflow copy to the shared pool", () => {
  let state = createGame(0xf532);
  ensureNagaLobby(state);
  let player = humanPlayer(state);
  const darkcrest = goldenMinion("BG31_920", "golden-darkcrest");
  player.board = [];
  player.hand = [darkcrest];
  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 0,
  });
  const generated = spellcraftInHand(humanPlayer(state));
  assert.equal(generated.length, 1);
  assert.deepEqual(
    [generated[0].cardId, generated[0].effectMultiplier, generated[0].rewardTier],
    ["BG31_920_Gt", 2, 1],
  );

  player = humanPlayer(state);
  player.hand.push(
    ...Array.from({ length: 9 }, (_, index) =>
      bloodGem(`darkcrest-full-hand-${index}`),
    ),
  );
  assert.equal(player.hand.length, 10);
  clearMinionPool(state);
  state.pool.BG27_004 = 2;
  const spellInstanceId = generated[0].instanceId;
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spellInstanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(
    minionsInHand(player).filter(
      (minion) => minion.definitionId === "BG27_004",
    ).length,
    1,
  );
  assert.equal(state.pool.BG27_004, 1);
  assert.equal(player.playerSpellsCast, 1);
});

test("Darkcrest Triple keeps the highest tier, and current saves preserve v45 history while v44 defaults it safely", () => {
  let state = createGame(0xf534);
  let player = humanPlayer(state);
  player.board = [];
  player.hand = [
    definitionMinion("BG31_920", "darkcrest-triple-a", {
      effectCounters: { [DARKCREST_TIER_COUNTER]: 2 },
    }),
    definitionMinion("BG31_920", "darkcrest-triple-b", {
      effectCounters: { [DARKCREST_TIER_COUNTER]: 5 },
    }),
  ];
  player.shop = [
    definitionMinion("BG31_920", "darkcrest-triple-c", {
      effectCounters: { [DARKCREST_TIER_COUNTER]: 4 },
      poolCopies: 1,
    }),
  ];
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const golden = minionsInHand(player).find(
    (minion) => minion.definitionId === "BG31_920" && minion.golden,
  );
  assert.ok(golden);
  assert.equal(golden.effectCounters?.[DARKCREST_TIER_COUNTER], 5);
  assert.match(golden.description, /等级5/u);

  player.playerSpellsCast = 9;
  player.pendingSpellcraft = [
    {
      sourceInstanceId: golden.instanceId,
      definitionId: "spellcraft-evolving-strategy",
      golden: true,
      round: state.round,
      rewardTier: 5,
    },
  ];
  const current = normalizePersistedGameState(
    structuredClone(state),
  ) as GameState | null;
  assert.ok(current);
  assert.equal(humanPlayer(current).playerSpellsCast, 9);
  assert.equal(humanPlayer(current).pendingSpellcraft[0]?.rewardTier, 5);

  const legacy = structuredClone(state) as GameState;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V44;
  delete (humanPlayer(legacy) as Partial<PlayerState>).playerSpellsCast;
  const migrated = normalizePersistedGameState(legacy) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(humanPlayer(migrated).playerSpellsCast, 0);
  assert.equal(humanPlayer(migrated).pendingSpellcraft[0]?.rewardTier, 5);
});

test("save normalization removes out-of-range Darkcrest reward tiers so they safely fall back to tier 1", () => {
  const state = createGame(0xf535);
  const player = humanPlayer(state);
  const corruptSpell = spellcraft(
    "spellcraft-evolving-strategy",
    "corrupt-evolving-spell",
    3,
  );
  (corruptSpell as { rewardTier?: number }).rewardTier = 99;
  player.hand = [corruptSpell];
  player.pendingSpellcraft = [
    {
      sourceInstanceId: "missing-darkcrest",
      definitionId: "spellcraft-evolving-strategy",
      golden: false,
      round: state.round,
      rewardTier: 3,
    },
  ];
  (
    player.pendingSpellcraft[0] as unknown as { rewardTier?: number }
  ).rewardTier = 0;

  const normalized = normalizePersistedGameState(
    structuredClone(state),
  ) as GameState | null;
  assert.ok(normalized);
  const nextPlayer = humanPlayer(normalized);
  const normalizedSpell = nextPlayer.hand.find(
    (card): card is SpellcraftSpellInstance => card.kind === "spellcraft",
  );
  assert.ok(normalizedSpell);
  assert.equal(normalizedSpell.rewardTier, undefined);
  assert.equal(nextPlayer.pendingSpellcraft[0]?.rewardTier, undefined);
});

test("save normalization repairs malformed v45 minion progress counters at their rule boundaries", () => {
  const state = createGame(0xf5351);
  const player = humanPlayer(state);
  const felboar = definitionMinion("BG28_633", "corrupt-felboar");
  const tide = definitionMinion("BG35_895", "corrupt-tide");
  const darkcrest = definitionMinion("BG31_920", "corrupt-darkcrest");
  (felboar.effectCounters as unknown as Record<string, unknown>)[
    FELBOAR_PROGRESS_COUNTER
  ] = 3;
  (tide.effectCounters as unknown as Record<string, unknown>)[
    TIDE_PROGRESS_COUNTER
  ] = "oops";
  (tide.effectCounters as unknown as Record<string, unknown>)[
    TIDE_ATTACK_COUNTER
  ] = -1;
  (darkcrest.effectCounters as unknown as Record<string, unknown>)[
    DARKCREST_TIER_COUNTER
  ] = Number.NaN;
  player.board = [felboar, tide, darkcrest];

  const normalized = normalizePersistedGameState(
    structuredClone(state),
  ) as GameState | null;
  assert.ok(normalized);
  assert.equal(
    boardMinion(normalized, felboar.instanceId).effectCounters?.[
      FELBOAR_PROGRESS_COUNTER
    ],
    0,
  );
  assert.deepEqual(
    [
      boardMinion(normalized, tide.instanceId).effectCounters?.[
        TIDE_PROGRESS_COUNTER
      ],
      boardMinion(normalized, tide.instanceId).effectCounters?.[
        TIDE_ATTACK_COUNTER
      ],
      boardMinion(normalized, tide.instanceId).effectCounters?.[
        TIDE_HEALTH_COUNTER
      ],
    ],
    [0, 0, 0],
  );
  assert.equal(
    boardMinion(normalized, darkcrest.instanceId).effectCounters?.[
      DARKCREST_TIER_COUNTER
    ],
    1,
  );
});

test("AI valuation recognizes imminent Felboar meals and upgraded Tide, Groundbreaker, and Darkcrest engines", () => {
  const state = createGame(0xf536);
  const player = humanPlayer(state);

  const felboar = definitionMinion("BG28_633", "ai-felboar", {
    effectCounters: { [FELBOAR_PROGRESS_COUNTER]: 2 },
  });
  player.board = [];
  player.hand = [];
  player.shop = [];
  const emptyFelboar = scoreMinionForAi(player, felboar);
  player.hand = [tavernSpell("tavern-spell-tavern-coin", "ai-coin")];
  player.shop = [
    definitionMinion("BG25_001", "ai-felboar-food", {
      attack: 10,
      health: 10,
    }),
  ];
  assert.ok(scoreMinionForAi(player, felboar) > emptyFelboar);

  const tide = definitionMinion("BG35_895", "ai-tide");
  player.hand = [
    tavernSpell("tavern-spell-tavern-dish-banana", "ai-banana"),
  ];
  player.board = [tide];
  const freshTide = scoreMinionForAi(player, tide);
  tide.effectCounters = {
    [TIDE_ATTACK_COUNTER]: 3,
    [TIDE_HEALTH_COUNTER]: 3,
  };
  assert.ok(scoreMinionForAi(player, tide) > freshTide);

  const groundbreaker = definitionMinion("BG31_035", "ai-groundbreaker");
  player.board = [groundbreaker];
  player.playerSpellsCast = 0;
  const freshGroundbreaker = scoreMinionForAi(player, groundbreaker);
  player.playerSpellsCast = 12;
  assert.ok(scoreMinionForAi(player, groundbreaker) > freshGroundbreaker);

  const darkcrest = definitionMinion("BG31_920", "ai-darkcrest", {
    effectCounters: { [DARKCREST_TIER_COUNTER]: 1 },
  });
  player.board = [darkcrest];
  const freshDarkcrest = scoreMinionForAi(player, darkcrest);
  darkcrest.effectCounters = { [DARKCREST_TIER_COUNTER]: 6 };
  assert.ok(scoreMinionForAi(player, darkcrest) > freshDarkcrest);
});
