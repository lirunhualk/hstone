import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTavernRefreshQuote,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type Tribe,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

const ALL_LOBBY_TRIBES: Tribe[] = [
  "beast",
  "mech",
  "demon",
  "murloc",
  "dragon",
  "pirate",
  "elemental",
  "naga",
  "quilboar",
  "undead",
];

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function initialEffectCounters(
  definitionId: string,
): Record<string, number> {
  if (definitionId === "BG24_715") {
    return { patientScoutDiscoverTier: 1 };
  }
  if (definitionId === "BG26_524") {
    return { healthRefreshesUsedThisTurn: 0 };
  }
  return {};
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
    name: golden ? `金色·${definition.name}` : definition.name,
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
    effectCounters: initialEffectCounters(definitionId),
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
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
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    ...overrides,
  });
}

function goldenFillers(count: number, prefix: string): BoardMinionInstance[] {
  return Array.from({ length: count }, (_, index) =>
    goldenMinion("BG25_001", `${prefix}-${index}`),
  );
}

function restrictMinionPool(
  state: GameState,
  copies: Readonly<Record<string, number>>,
): void {
  state.activeTribes = [...ALL_LOBBY_TRIBES];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const [definitionId, count] of Object.entries(copies)) {
    state.pool[definitionId] = count;
  }
}

function keepOnlyOneEmptyOpponent(state: GameState): void {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    if (player.isHuman) {
      continue;
    }
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.hand = [];
    player.board = [];
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 999;
    } else {
      player.alive = false;
      player.health = 0;
      player.eliminatedRound = 0;
    }
  }
}

function continueRecruitRound(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function pendingDiscover(state: GameState) {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  return pending;
}

function chooseDiscover(
  state: GameState,
  definitionId?: string,
): GameState {
  const pending = pendingDiscover(state);
  const option = definitionId
    ? pending.options.find(
        (candidate) => candidate.definitionId === definitionId,
      )
    : pending.options[0];
  assert.ok(option, `discover must offer ${definitionId ?? "an option"}`);
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: option.instanceId,
  });
}

test("the six Recruit cards expose exact ordinary and Golden metadata", () => {
  const expected = [
    {
      id: "BG24_715",
      name: "耐心的侦查员",
      tier: 2,
      attack: 1,
      health: 1,
      tribes: [] as Tribe[],
      associatedTribes: [] as Tribe[],
      ordinaryText: "发现一个等级1的随从",
      goldenText: "发现两个等级1的随从",
    },
    {
      id: "BG26_174",
      name: "灵魂回溯者",
      tier: 2,
      attack: 4,
      health: 1,
      tribes: ["demon"] as Tribe[],
      associatedTribes: [] as Tribe[],
      ordinaryText: "回溯该伤害并使本随从获得+1生命值",
      goldenText: "回溯该伤害并使本随从获得+2生命值",
    },
    {
      id: "BG26_524",
      name: "舞蹈王子玛克扎尔",
      tier: 3,
      attack: 2,
      health: 1,
      tribes: ["demon"] as Tribe[],
      associatedTribes: [] as Tribe[],
      ordinaryText: "有两次刷新会消耗生命值",
      goldenText: "有四次刷新会消耗生命值",
    },
    {
      id: "BG26_525",
      name: "奇瑰打击乐手",
      tier: 4,
      attack: 4,
      health: 4,
      tribes: ["demon"] as Tribe[],
      associatedTribes: [] as Tribe[],
      ordinaryText: "发现一张恶魔牌",
      goldenText: "发现两张恶魔牌",
    },
    {
      id: "BG27_084",
      name: "机变甲虫",
      tier: 3,
      attack: 3,
      health: 1,
      tribes: ["beast"] as Tribe[],
      associatedTribes: [] as Tribe[],
      ordinaryText: "获得+1/+1和复生",
      goldenText: "获得+2/+2和复生",
    },
    {
      id: "BG28_303",
      name: "变装盗墓贼",
      tier: 3,
      attack: 4,
      health: 4,
      tribes: [] as Tribe[],
      associatedTribes: ["undead"] as Tribe[],
      ordinaryText: "获取一张它的原始版复制",
      goldenText: "获取两张它的原始版复制",
    },
  ] as const;

  for (const card of expected) {
    const definition = getMinionDefinition(card.id);
    assert.equal(definition.cardId, card.id);
    assert.equal(definition.goldenCardId, `${card.id}_G`);
    assert.equal(definition.name, card.name);
    assert.equal(definition.tier, card.tier);
    assert.equal(definition.attack, card.attack);
    assert.equal(definition.health, card.health);
    assert.deepEqual(definition.tribes, card.tribes);
    assert.deepEqual(definition.associatedTribes, card.associatedTribes);
    assert.equal(definition.effectSupport, "complete");
    assert.ok(
      definition.description.replace(/\s+/gu, "").includes(card.ordinaryText),
    );
    assert.ok(definition.goldenDescription?.includes(card.goldenText));
  }

  assert.deepEqual(getMinionDefinition("BG24_715").sellDiscover, {
    initialTier: 1,
    maximumTier: 6,
    discoveries: 1,
    goldenMode: "doubleCount",
  });
  assert.deepEqual(getMinionDefinition("BG26_174").afterHeroDamaged, {
    health: 1,
  });
  assert.deepEqual(getMinionDefinition("BG26_524").healthRefreshesPerTurn, {
    count: 2,
    healthCost: 1,
    goldenMode: "doubleCount",
  });
  assert.deepEqual(getMinionDefinition("BG26_525").interactiveBattlecry, {
    kind: "discoverMinion",
    tribe: "demon",
    damageHeroByDiscoveredTier: true,
    allowHandOverflow: true,
    goldenMode: "repeat",
  });
  assert.deepEqual(getMinionDefinition("BG27_084").onPlayChoice, {
    kind: "beastKeywordBuff",
    rebornAttack: 1,
    rebornHealth: 1,
    windfuryAttack: 4,
    windfuryHealth: 0,
    goldenMode: "doubleValues",
  });
  assert.deepEqual(getMinionDefinition("BG28_303").interactiveBattlecry, {
    kind: "destroyFriendlyAndCopy",
    targetTribe: "undead",
    copies: 1,
    goldenMode: "doubleCopies",
  });
});

test("Patient Scout advances only while on the board, caps at Tier 6, and sells that exact-tier Discover", () => {
  let state = createGame(0xc410);
  let player = humanPlayer(state);
  const boardScout = definitionMinion("BG24_715", "scout-board");
  const handScout = definitionMinion("BG24_715", "scout-hand");
  player.health = 999;
  player.board = [boardScout];
  player.hand = [handScout];
  keepOnlyOneEmptyOpponent(state);

  for (let turn = 0; turn < 7; turn += 1) {
    const combat = gameReducer(state, { type: "END_TURN" });
    const combatPlayer = humanPlayer(combat);
    assert.equal(
      combatPlayer.board[0]?.effectCounters?.patientScoutDiscoverTier,
      Math.min(6, turn + 2),
    );
    const retainedHandScout = combatPlayer.hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" && card.instanceId === handScout.instanceId,
    );
    assert.ok(retainedHandScout, `hand Scout must survive turn ${turn + 1}`);
    assert.equal(
      retainedHandScout.effectCounters?.patientScoutDiscoverTier,
      1,
    );
    state = gameReducer(combat, { type: "CONTINUE" });
  }

  player = humanPlayer(state);
  assert.match(player.board[0]?.description ?? "", /等级6/u);
  restrictMinionPool(state, { BG25_009: 1 });
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  const pending = pendingDiscover(state);
  assert.deepEqual(pending.filter, { exactTier: 6 });
  assert.equal(pending.remainingDiscoveries, 1);
  assert.equal(pending.sourceDefinitionId, "BG24_715");
  assert.deepEqual(
    pending.options.map((option) => option.definitionId),
    ["BG25_009"],
  );

  state = chooseDiscover(state, "BG25_009");
  player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(
    player.hand.some(
      (card) =>
        card.kind === "minion" && card.definitionId === "BG25_009",
    ),
    true,
  );
});

test("Golden Patient Scout performs two chained Discovers at its current tier", () => {
  let state = createGame(0xc411);
  const player = humanPlayer(state);
  player.board = [
    goldenMinion("BG24_715", "golden-scout", {
      effectCounters: { patientScoutDiscoverTier: 4 },
    }),
  ];
  player.hand = [];
  restrictMinionPool(state, { BG24_018: 2 });

  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  let pending = pendingDiscover(state);
  assert.equal(pending.filter.exactTier, 4);
  assert.equal(pending.remainingDiscoveries, 2);
  state = chooseDiscover(state, "BG24_018");
  pending = pendingDiscover(state);
  assert.equal(pending.remainingDiscoveries, 1);
  state = chooseDiscover(state, "BG24_018");

  const nextPlayer = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(
    nextPlayer.hand.filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === "BG24_018",
    ).length,
    2,
  );
  assert.equal(state.pool.BG24_018, 0);
});

test("Patient Scout still offers a full-hand Discover, then burns and returns the selected copy", () => {
  let state = createGame(0xc412);
  const player = humanPlayer(state);
  player.board = [
    definitionMinion("BG24_715", "full-hand-scout", {
      effectCounters: { patientScoutDiscoverTier: 2 },
    }),
  ];
  player.hand = goldenFillers(10, "scout-full-hand");
  restrictMinionPool(state, { BG26_174: 1 });

  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  const pending = pendingDiscover(state);
  assert.equal(pending.destination.kind, "hand");
  assert.equal(
    pending.destination.kind === "hand"
      ? pending.destination.allowOverflow
      : false,
    true,
  );
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(state.pool.BG26_174, 0);

  state = chooseDiscover(state, "BG26_174");
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(
    humanPlayer(state).hand.some(
      (card) => card.kind === "minion" && card.definitionId === "BG26_174",
    ),
    false,
  );
  assert.equal(state.pool.BG26_174, 1);
});

test("a Patient Scout triple inherits the highest accumulated Discover tier", () => {
  let state = createGame(0xc413);
  const player = humanPlayer(state);
  player.gold = 3;
  player.hand = [];
  player.board = [
    definitionMinion("BG24_715", "triple-scout-two", {
      effectCounters: { patientScoutDiscoverTier: 2 },
      poolCopies: 1,
    }),
    definitionMinion("BG24_715", "triple-scout-five", {
      effectCounters: { patientScoutDiscoverTier: 5 },
      poolCopies: 1,
    }),
  ];
  player.shop = [
    definitionMinion("BG24_715", "triple-scout-four", {
      effectCounters: { patientScoutDiscoverTier: 4 },
      poolCopies: 1,
    }),
  ];

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  const golden = humanPlayer(state).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG24_715" &&
      card.golden,
  );
  assert.ok(golden);
  assert.equal(golden.effectCounters?.patientScoutDiscoverTier, 5);
  assert.match(golden.description, /等级5/u);
  assert.equal(golden.poolCopies, 3);
  assert.equal(golden.grantsTripleReward, true);
  assert.equal(
    humanPlayer(state).board.some(
      (minion) => minion.definitionId === "BG24_715",
    ),
    false,
  );
});

test("all ordinary and Golden Soul Rewinders grow while one Malchezaar damage event is rewound only once", () => {
  let state = createGame(0xc420);
  const player = humanPlayer(state);
  const ordinary = definitionMinion("BG26_174", "rewinder-ordinary");
  const golden = goldenMinion("BG26_174", "rewinder-golden");
  const malchezaar = definitionMinion("BG26_524", "rewinder-malchezaar");
  player.board = [ordinary, golden, malchezaar];
  player.gold = 0;
  player.health = 20;
  player.armor = 2;
  player.freeRefreshes = 0;

  const quote = getTavernRefreshQuote(state, player.id);
  assert.deepEqual(quote, {
    currency: "health",
    cost: 1,
    affordable: true,
    remainingHealthRefreshes: 2,
  });
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.health, 20);
  assert.equal(nextPlayer.armor, 2);
  assert.equal(
    nextPlayer.board.find(
      (minion) => minion.instanceId === ordinary.instanceId,
    )?.health,
    ordinary.health + 1,
  );
  assert.equal(
    nextPlayer.board.find(
      (minion) => minion.instanceId === golden.instanceId,
    )?.health,
    golden.health + 2,
  );
  assert.equal(
    nextPlayer.board.find(
      (minion) => minion.instanceId === malchezaar.instanceId,
    )?.effectCounters?.healthRefreshesUsedThisTurn,
    1,
  );
});

test("Malchezaar consumes a free refresh before Health while still spending one of its two charges", () => {
  let state = createGame(0xc421);
  const player = humanPlayer(state);
  const malchezaar = definitionMinion("BG26_524", "free-malchezaar");
  player.board = [malchezaar];
  player.gold = 7;
  player.health = 10;
  player.freeRefreshes = 1;

  assert.deepEqual(getTavernRefreshQuote(state, player.id), {
    currency: "health",
    cost: 0,
    affordable: true,
    remainingHealthRefreshes: 2,
  });
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.freeRefreshes, 0);
  assert.equal(nextPlayer.health, 10);
  assert.equal(nextPlayer.gold, 7);
  assert.equal(
    nextPlayer.board[0]?.effectCounters?.healthRefreshesUsedThisTurn,
    1,
  );
  assert.match(nextPlayer.board[0]?.description ?? "", /还剩1次/u);
  assert.deepEqual(getTavernRefreshQuote(state, nextPlayer.id), {
    currency: "health",
    cost: 1,
    affordable: true,
    remainingHealthRefreshes: 1,
  });
});

test("ordinary and Golden Malchezaars stack to six Health refreshes, cannot be lethal, and reset next turn", () => {
  let state = createGame(0xc422);
  let player = humanPlayer(state);
  const ordinary = definitionMinion("BG26_524", "stack-malchezaar-normal");
  const golden = goldenMinion("BG26_524", "stack-malchezaar-golden");
  player.board = [ordinary, golden];
  player.gold = 0;
  player.health = 7;

  for (let refresh = 0; refresh < 6; refresh += 1) {
    const quote = getTavernRefreshQuote(state, player.id);
    assert.equal(quote?.currency, "health");
    assert.equal(quote?.cost, 1);
    assert.equal(quote?.affordable, true);
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);
  }
  assert.equal(player.health, 1);
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === ordinary.instanceId,
    )?.effectCounters?.healthRefreshesUsedThisTurn,
    2,
  );
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === golden.instanceId,
    )?.effectCounters?.healthRefreshesUsedThisTurn,
    4,
  );
  assert.deepEqual(getTavernRefreshQuote(state, player.id), {
    currency: "gold",
    cost: 1,
    affordable: false,
    remainingHealthRefreshes: 0,
  });
  const shopBeforeFailedRefresh = player.shop.map(
    (minion) => minion.instanceId,
  );
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.health, 1);
  assert.deepEqual(
    player.shop.map((minion) => minion.instanceId),
    shopBeforeFailedRefresh,
  );

  player.health = 20;
  keepOnlyOneEmptyOpponent(state);
  state = continueRecruitRound(state);
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map(
      (minion) => minion.effectCounters?.healthRefreshesUsedThisTurn,
    ),
    [0, 0],
  );

  let lethalState = createGame(0xc423);
  const lethalPlayer = humanPlayer(lethalState);
  lethalPlayer.board = [
    definitionMinion("BG26_524", "nonlethal-malchezaar"),
  ];
  lethalPlayer.gold = 0;
  lethalPlayer.health = 1;
  const lethalShop = lethalPlayer.shop.map((minion) => minion.instanceId);
  assert.deepEqual(getTavernRefreshQuote(lethalState, lethalPlayer.id), {
    currency: "health",
    cost: 1,
    affordable: false,
    remainingHealthRefreshes: 2,
  });
  lethalState = gameReducer(lethalState, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(lethalState).health, 1);
  assert.equal(
    humanPlayer(lethalState).board[0]?.effectCounters
      ?.healthRefreshesUsedThisTurn,
    0,
  );
  assert.deepEqual(
    humanPlayer(lethalState).shop.map((minion) => minion.instanceId),
    lethalShop,
  );
});

test("Adaptable Beetle uses an ordinary or Golden two-stage choice and targets only another Beast", () => {
  const scenarios = [
    {
      golden: false,
      optionId: "BG27_084t",
      keyword: "reborn" as const,
      attack: 1,
      health: 1,
    },
    {
      golden: false,
      optionId: "BG27_084t2",
      keyword: "windfury" as const,
      attack: 4,
      health: 0,
    },
    {
      golden: true,
      optionId: "BG27_084_Gt",
      keyword: "reborn" as const,
      attack: 2,
      health: 2,
    },
    {
      golden: true,
      optionId: "BG27_084_Gt2",
      keyword: "windfury" as const,
      attack: 8,
      health: 0,
    },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xc430 + index);
    const player = humanPlayer(state);
    const beast = definitionMinion("cave-hydra", `beetle-beast-${index}`, {
      attack: 10,
      health: 10,
      reborn: true,
      windfury: true,
    });
    const outsider = definitionMinion(
      "BG29_841",
      `beetle-outsider-${index}`,
    );
    const source = scenario.golden
      ? goldenMinion("BG27_084", `beetle-source-${index}`)
      : definitionMinion("BG27_084", `beetle-source-${index}`);
    player.board = [beast, outsider];
    player.hand = [source];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    let pending = state.pendingInteraction;
    assert.ok(pending?.kind === "minionChoice");
    assert.deepEqual(
      pending.optionIds,
      scenario.golden
        ? ["BG27_084_Gt", "BG27_084_Gt2"]
        : ["BG27_084t", "BG27_084t2"],
    );
    assert.equal(humanPlayer(state).cardsPlayedThisTurn, 0);

    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: scenario.optionId,
    });
    pending = state.pendingInteraction;
    assert.ok(pending?.kind === "target");
    assert.deepEqual(pending.optionInstanceIds, [beast.instanceId]);
    assert.equal(pending.attack, scenario.attack);
    assert.equal(pending.health, scenario.health);
    assert.deepEqual(pending.grantKeywords, [scenario.keyword]);
    const invalid = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: outsider.instanceId,
    });
    assert.strictEqual(invalid, state);

    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: beast.instanceId,
    });
    const nextBeast = humanPlayer(state).board.find(
      (minion) => minion.instanceId === beast.instanceId,
    );
    assert.ok(nextBeast);
    assert.equal(nextBeast.attack, 10 + scenario.attack);
    assert.equal(nextBeast.health, 10 + scenario.health);
    assert.equal(nextBeast.reborn, true);
    assert.equal(nextBeast.windfury, true);
    assert.equal(state.pendingInteraction, null);
    assert.equal(humanPlayer(state).cardsPlayedThisTurn, 1);
  }
});

test("Adaptable Beetle without another Beast still chooses a branch, then safely fizzles the target step", () => {
  let state = createGame(0xc434);
  const player = humanPlayer(state);
  const outsider = definitionMinion("BG29_841", "beetle-no-target-outsider");
  const source = definitionMinion("BG27_084", "beetle-no-target-source");
  player.board = [outsider];
  player.hand = [source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "minionChoice");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "BG27_084t",
  });
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).cardsPlayedThisTurn, 1);
  assert.equal(
    humanPlayer(state).board.some(
      (minion) => minion.instanceId === source.instanceId,
    ),
    true,
  );
  assert.deepEqual(
    humanPlayer(state).board.find(
      (minion) => minion.instanceId === outsider.instanceId,
    ),
    outsider,
  );
});

test("Graverobber destroys an Undead, resolves its Deathrattle, and gains one unbuffed zero-pool original", () => {
  let state = createGame(0xc440);
  const player = humanPlayer(state);
  const target = definitionMinion("BG28_300", "graverobber-doomed", {
    attack: 11,
    health: 13,
    reborn: true,
    poolCopies: 1,
  });
  const source = definitionMinion("BG28_303", "graverobber-normal");
  player.board = [target];
  player.hand = [source];
  state.activeTribes = [...ALL_LOBBY_TRIBES];
  state.pool.BG28_300 = 4;

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "target");
  assert.deepEqual(pending.optionInstanceIds, [target.instanceId]);
  assert.deepEqual(pending.resolution, {
    kind: "destroyFriendlyAndCopy",
    copies: 1,
  });
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });

  const nextPlayer = humanPlayer(state);
  assert.equal(
    nextPlayer.board.some(
      (minion) => minion.instanceId === target.instanceId,
    ),
    false,
  );
  assert.equal(
    nextPlayer.board.filter(
      (minion) => minion.definitionId === "live-skeleton-token",
    ).length,
    2,
  );
  const copy = nextPlayer.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG28_300",
  );
  assert.ok(copy);
  const definition = getMinionDefinition("BG28_300");
  assert.equal(copy.golden, false);
  assert.equal(copy.cardId, definition.cardId);
  assert.equal(copy.attack, definition.attack);
  assert.equal(copy.health, definition.health);
  assert.equal(copy.reborn, definition.reborn === true);
  assert.equal(copy.poolCopies, 0);
  assert.equal(state.pool.BG28_300, 5);
  assert.equal(state.pendingInteraction, null);
});

test("Golden Graverobber gives exactly two plain originals even with Brann", () => {
  let state = createGame(0xc441);
  const player = humanPlayer(state);
  const target = definitionMinion("BG28_300", "golden-graverobber-doomed", {
    attack: 20,
    health: 21,
    divineShield: true,
    poolCopies: 1,
  });
  const brann = definitionMinion("BG_LOE_077", "graverobber-brann");
  const source = goldenMinion("BG28_303", "graverobber-golden");
  player.board = [target, brann];
  player.hand = [source];
  state.activeTribes = [...ALL_LOBBY_TRIBES];
  state.pool.BG28_300 = 4;

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "target");
  assert.deepEqual(pending.resolution, {
    kind: "destroyFriendlyAndCopy",
    copies: 2,
  });
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });

  const copies = humanPlayer(state).hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG28_300",
  );
  assert.equal(copies.length, 2);
  assert.ok(copies.every((copy) => !copy.golden));
  assert.ok(copies.every((copy) => copy.poolCopies === 0));
  assert.ok(
    copies.every(
      (copy) =>
        copy.attack === getMinionDefinition("BG28_300").attack &&
        copy.health === getMinionDefinition("BG28_300").health &&
        !copy.divineShield,
    ),
  );
  assert.equal(state.pool.BG28_300, 5);
});

test("Percussionist reserves shared-pool Demons and deals the selected Tier after the card enters hand", () => {
  let state = createGame(0xc450);
  const player = humanPlayer(state);
  player.tavernTier = 4;
  player.health = 20;
  const source = definitionMinion("BG26_525", "percussionist-normal");
  player.hand = [source];
  restrictMinionPool(state, {
    BG26_174: 1,
    BG26_524: 1,
    BG26_525: 1,
  });

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const pending = pendingDiscover(state);
  assert.deepEqual(pending.filter, {
    maximumTier: 4,
    tribe: "demon",
  });
  assert.equal(pending.remainingDiscoveries, 1);
  assert.deepEqual(pending.destination, {
    kind: "hand",
    allowOverflow: true,
  });
  assert.deepEqual(pending.selectionEffect, {
    kind: "damageHeroBySelectedTier",
  });
  assert.equal(pending.sourceDefinitionId, "BG26_525");
  assert.deepEqual(
    new Set(pending.options.map((option) => option.definitionId)),
    new Set(["BG26_174", "BG26_524", "BG26_525"]),
  );
  assert.deepEqual(
    [state.pool.BG26_174, state.pool.BG26_524, state.pool.BG26_525],
    [0, 0, 0],
  );

  state = chooseDiscover(state, "BG26_524");
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.health, 17);
  const selected = nextPlayer.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG26_524",
  );
  assert.ok(selected);
  assert.equal(selected.poolCopies, 1);
  assert.deepEqual(
    [state.pool.BG26_174, state.pool.BG26_524, state.pool.BG26_525],
    [1, 0, 1],
  );
  assert.equal(state.pendingInteraction, null);
  assert.equal(nextPlayer.cardsPlayedThisTurn, 1);
});

test("Golden and Brann Percussionists multiply chained Discovers and damage each selection", () => {
  const scenarios = [
    { golden: true, brann: false, expectedDiscoveries: 2 },
    { golden: false, brann: true, expectedDiscoveries: 2 },
    { golden: true, brann: true, expectedDiscoveries: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xc451 + index);
    const player = humanPlayer(state);
    player.tavernTier = 4;
    player.health = 40;
    player.board = scenario.brann
      ? [definitionMinion("BG_LOE_077", `percussionist-brann-${index}`)]
      : [];
    const source = scenario.golden
      ? goldenMinion("BG26_525", `percussionist-chain-${index}`)
      : definitionMinion("BG26_525", `percussionist-chain-${index}`);
    player.hand = [source];
    restrictMinionPool(state, {
      BG26_524: scenario.expectedDiscoveries,
    });

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    for (
      let selection = 0;
      selection < scenario.expectedDiscoveries;
      selection += 1
    ) {
      const pending = pendingDiscover(state);
      assert.equal(
        pending.remainingDiscoveries,
        scenario.expectedDiscoveries - selection,
      );
      assert.deepEqual(
        pending.options.map((option) => option.definitionId),
        ["BG26_524"],
      );
      const healthBefore = humanPlayer(state).health;
      state = chooseDiscover(state, "BG26_524");
      assert.equal(humanPlayer(state).health, healthBefore - 3);
    }

    const nextPlayer = humanPlayer(state);
    assert.equal(state.pendingInteraction, null);
    assert.equal(
      nextPlayer.hand
        .filter(
          (card): card is BoardMinionInstance =>
            card.kind === "minion" && card.definitionId === "BG26_524",
        )
        .reduce((total, minion) => total + minion.poolCopies, 0),
      scenario.expectedDiscoveries,
    );
    assert.equal(
      nextPlayer.health,
      40 - scenario.expectedDiscoveries * 3,
    );
    assert.equal(nextPlayer.cardsPlayedThisTurn, 1);
  }
});

test("Golden Percussionist resolves both full-hand choices, burns both cards, and still takes damage", () => {
  let state = createGame(0xc454);
  const player = humanPlayer(state);
  player.tavernTier = 4;
  player.health = 20;
  const source = goldenMinion("BG26_525", "full-hand-percussionist", {
    grantsTripleReward: true,
  });
  player.hand = [
    ...goldenFillers(9, "percussionist-full-hand"),
    source,
  ];
  restrictMinionPool(state, { BG26_524: 2 });

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(
    humanPlayer(state).hand.some((card) => card.kind === "tripleReward"),
    true,
  );
  assert.equal(pendingDiscover(state).remainingDiscoveries, 2);

  state = chooseDiscover(state, "BG26_524");
  assert.equal(humanPlayer(state).health, 17);
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(pendingDiscover(state).remainingDiscoveries, 1);
  state = chooseDiscover(state, "BG26_524");

  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.health, 14);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(
    nextPlayer.hand.some(
      (card) => card.kind === "minion" && card.definitionId === "BG26_524",
    ),
    false,
  );
  assert.equal(state.pool.BG26_524, 2);
  assert.equal(state.pendingInteraction, null);
  assert.equal(nextPlayer.cardsPlayedThisTurn, 1);
});

test("Percussionist completes a discovered Soul Rewinder triple before damage, so the removed board copies cannot rewind it", () => {
  let state = createGame(0xc455);
  const player = humanPlayer(state);
  player.tavernTier = 2;
  player.health = 20;
  player.board = [
    definitionMinion("BG26_174", "triple-rewinder-one", {
      poolCopies: 1,
    }),
    definitionMinion("BG26_174", "triple-rewinder-two", {
      poolCopies: 1,
    }),
  ];
  const source = definitionMinion("BG26_525", "triple-percussionist");
  player.hand = [source];
  restrictMinionPool(state, { BG26_174: 1 });

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  assert.deepEqual(
    pendingDiscover(state).options.map((option) => option.definitionId),
    ["BG26_174"],
  );
  state = chooseDiscover(state, "BG26_174");

  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.health, 18);
  assert.equal(
    nextPlayer.board.some(
      (minion) => minion.definitionId === "BG26_174",
    ),
    false,
  );
  const goldenRewinder = nextPlayer.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG26_174" &&
      card.golden,
  );
  assert.ok(goldenRewinder);
  assert.equal(goldenRewinder.health, 2);
  assert.equal(goldenRewinder.poolCopies, 3);
  assert.equal(goldenRewinder.grantsTripleReward, true);
  assert.equal(state.pool.BG26_174, 0);
  assert.equal(state.pendingInteraction, null);
});
