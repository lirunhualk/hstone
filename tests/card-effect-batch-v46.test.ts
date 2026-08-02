import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
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
  LEGACY_SCHEMA_11_CONTENT_VERSION_V45,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const MAGICFIN_PURCHASE_COUNTER =
  "tavernSpellPurchasesObservedThisTurn";

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
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: definition.spellFamily ?? "spellcraft",
    target: definition.target,
    effectMultiplier: 1,
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

function buyOfferedTavernSpell(
  state: GameState,
  definitionId: string,
  instanceId: string,
): GameState {
  const player = humanPlayer(state);
  player.spellShop = tavernSpell(definitionId, instanceId);
  player.additionalSpellShop = [];
  return gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: instanceId,
  });
}

test("v46 exposes exact complete rules for Arena Performer, Magicfin Mycologist, Wrathscale Rogue, and the Apprentice", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v50",
  );

  const arena = getMinionDefinition("BG28_550");
  assert.deepEqual(
    [arena.name, arena.tier, arena.attack, arena.health, arena.tribe],
    ["竞技表演者", 5, 3, 4, "neutral"],
  );
  assert.deepEqual(arena.interactiveBattlecry, {
    kind: "discoverTavernSpell",
    goldenMode: "repeat",
  });

  const mycologist = getMinionDefinition("BG33_891");
  assert.deepEqual(
    [
      mycologist.name,
      mycologist.tier,
      mycologist.attack,
      mycologist.health,
      mycologist.tribe,
    ],
    ["魔鳍真菌学家", 6, 4, 8, "murloc"],
  );
  assert.deepEqual(mycologist.afterTavernSpellPurchased, {
    timesPerTurn: 1,
    tokenDefinitionId: "BG33_890t",
    goldenMode: "doubleLimit",
  });

  const wrathscale = getMinionDefinition("BG33_920");
  assert.deepEqual(
    [
      wrathscale.name,
      wrathscale.tier,
      wrathscale.attack,
      wrathscale.health,
      wrathscale.tribe,
    ],
    ["怒鳞潜行者", 6, 3, 6, "naga"],
  );
  assert.deepEqual(wrathscale.afterFriendlyGainsHealth, {
    tribe: "naga",
    otherOnly: true,
    attackPerHealth: 1,
    goldenMode: "doubleStats",
  });

  const apprentice = getMinionDefinition("BG33_890t");
  assert.deepEqual(
    [
      apprentice.name,
      apprentice.tier,
      apprentice.attack,
      apprentice.health,
      apprentice.tribe,
      apprentice.collectible,
      apprentice.canTriple,
    ],
    ["魔鳍学徒", 1, 1, 1, "murloc", false, false],
  );
  assert.equal(apprentice.battlecryCastsTaughtTavernSpell, true);

  for (const definition of [arena, mycologist, wrathscale, apprentice]) {
    assert.equal(definition.effectSupport, "complete");
  }
  for (const definition of [arena, mycologist, wrathscale]) {
    assert.ok(definition.goldenCardId);
    assert.ok(definition.goldenDescription);
  }
});

test("Arena Performer discovers from every Tavern Spell tier without consuming the shared spell pool", () => {
  let state = createGame(1);
  const player = humanPlayer(state);
  player.tavernTier = 1;
  player.board = [];
  player.hand = [definitionMinion("BG28_550", "arena-performer")];
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
  const poolBefore = structuredClone(state.spellPool);

  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 0,
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "tavernSpellDiscover");
  assert.equal(pending.maximumTier, 6);
  assert.equal(pending.remainingDiscoveries, 1);
  assert.equal(pending.sourceDefinitionId, "BG28_550");
  assert.equal(
    pending.options.some((option) => option.tier === 6),
    true,
  );
  assert.deepEqual(state.spellPool, poolBefore);

  const selected = pending.options[0];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  pending = state.pendingInteraction;
  assert.equal(pending, null);
  assert.equal(
    humanPlayer(state).hand.some(
      (card) =>
        card.kind === "tavernSpell" &&
        card.definitionId === selected.definitionId,
    ),
    true,
  );
  assert.deepEqual(state.spellPool, poolBefore);
});

test("AI Arena Performer resolves its Tavern Spell discovery synchronously and deterministically", () => {
  const run = (): GameState => {
    let state = createGame(0xf602);
    const player = humanPlayer(state);
    player.isHuman = false;
    player.board = [];
    player.hand = [definitionMinion("BG28_550", "ai-arena-performer")];
    for (const definitionId of Object.keys(state.spellPool)) {
      state.spellPool[definitionId] = 0;
    }
    const poolBefore = structuredClone(state.spellPool);
    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 0,
    });
    assert.equal(state.pendingInteraction, null);
    assert.equal(
      humanPlayer(state).board[0]?.instanceId,
      "ai-arena-performer",
    );
    assert.deepEqual(
      humanPlayer(state).hand.map((card) => [card.kind, card.definitionId]),
      [["tavernSpell", "tavern-spell-selfish-bounty"]],
    );
    assert.deepEqual(state.spellPool, poolBefore);
    return state;
  };

  assert.deepEqual(run(), run());
});

test("Golden Arena Performer with Brann resolves four sequential discoveries and burns overflow choices", () => {
  let state = createGame(0xf601);
  const player = humanPlayer(state);
  player.board = [definitionMinion("BG_LOE_077", "arena-brann")];
  player.hand = [
    goldenMinion("BG28_550", "golden-arena"),
    ...Array.from({ length: 9 }, (_, index) =>
      bloodGem(`arena-full-hand-${index}`),
    ),
  ];
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
  const poolBefore = structuredClone(state.spellPool);

  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 1,
  });
  let resolved = 0;
  while (state.pendingInteraction?.kind === "tavernSpellDiscover") {
    const pending = state.pendingInteraction;
    assert.equal(pending.remainingDiscoveries, 4 - resolved);
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: pending.options[0].instanceId,
    });
    resolved += 1;
  }

  assert.equal(resolved, 4);
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(
    humanPlayer(state).hand.filter((card) => card.kind === "tavernSpell")
      .length,
    1,
  );
  assert.deepEqual(state.spellPool, poolBefore);
});

test("Magicfin Mycologist and its Golden copy independently teach bought Tavern Spells within their per-turn limits", () => {
  let state = createGame(0xf610);
  let player = humanPlayer(state);
  const normal = definitionMinion("BG33_891", "normal-mycologist");
  const golden = goldenMinion("BG33_891", "golden-mycologist");
  player.board = [normal, golden];
  player.hand = [];
  player.gold = 100;

  state = buyOfferedTavernSpell(
    state,
    "tavern-spell-tavern-coin",
    "mycologist-spell-a",
  );
  state = buyOfferedTavernSpell(
    state,
    "tavern-spell-fortify",
    "mycologist-spell-b",
  );
  state = buyOfferedTavernSpell(
    state,
    "tavern-spell-tavern-dish-banana",
    "mycologist-spell-c",
  );
  player = humanPlayer(state);

  const apprentices = minionsInHand(player).filter(
    (minion) => minion.definitionId === "BG33_890t",
  );
  assert.equal(apprentices.length, 3);
  assert.deepEqual(
    apprentices.map((minion) => minion.taughtTavernSpellDefinitionId),
    [
      "tavern-spell-tavern-coin",
      "tavern-spell-tavern-coin",
      "tavern-spell-fortify",
    ],
  );
  assert.equal(apprentices.every((minion) => !minion.golden), true);
  assert.equal(
    player.hand.some((card) => card.kind === "tripleReward"),
    false,
  );
  assert.equal(
    boardMinion(state, normal.instanceId).effectCounters?.[
      MAGICFIN_PURCHASE_COUNTER
    ],
    1,
  );
  assert.equal(
    boardMinion(state, golden.instanceId).effectCounters?.[
      MAGICFIN_PURCHASE_COUNTER
    ],
    2,
  );
  assert.match(boardMinion(state, normal.instanceId).description, /还剩0次/u);
  assert.match(boardMinion(state, golden.instanceId).description, /还剩0次/u);

  prepareDuel(state);
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  player = humanPlayer(state);
  assert.deepEqual(
    [
      boardMinion(state, normal.instanceId).effectCounters?.[
        MAGICFIN_PURCHASE_COUNTER
      ],
      boardMinion(state, golden.instanceId).effectCounters?.[
        MAGICFIN_PURCHASE_COUNTER
      ],
    ],
    [0, 0],
  );
  assert.match(boardMinion(state, normal.instanceId).description, /还剩1次/u);
  assert.match(boardMinion(state, golden.instanceId).description, /还剩2次/u);
  player.gold = 100;
  const apprenticesBeforeNextTurnPurchase = minionsInHand(player).filter(
    (minion) => minion.definitionId === "BG33_890t",
  ).length;
  state = buyOfferedTavernSpell(
    state,
    "tavern-spell-careful-investment",
    "mycologist-spell-next-turn",
  );
  player = humanPlayer(state);
  const nextTurnApprentices = minionsInHand(player).filter(
    (minion) => minion.definitionId === "BG33_890t",
  );
  assert.equal(
    nextTurnApprentices.length - apprenticesBeforeNextTurnPurchase,
    2,
  );
  assert.deepEqual(
    nextTurnApprentices
      .slice(-2)
      .map((minion) => minion.taughtTavernSpellDefinitionId),
    ["tavern-spell-careful-investment", "tavern-spell-careful-investment"],
  );
  assert.equal(
    boardMinion(state, normal.instanceId).effectCounters?.[
      MAGICFIN_PURCHASE_COUNTER
    ],
    1,
  );
  assert.equal(
    boardMinion(state, golden.instanceId).effectCounters?.[
      MAGICFIN_PURCHASE_COUNTER
    ],
    1,
  );
  assert.match(boardMinion(state, normal.instanceId).description, /还剩0次/u);
  assert.match(boardMinion(state, golden.instanceId).description, /还剩1次/u);
});

test("Magicfin Mycologist consumes its trigger when a bought Tavern Spell fills the hand", () => {
  let state = createGame(0xf611);
  const player = humanPlayer(state);
  const mycologist = definitionMinion(
    "BG33_891",
    "full-hand-mycologist",
  );
  player.board = [mycologist];
  player.hand = Array.from({ length: 9 }, (_, index) =>
    bloodGem(`mycologist-full-hand-${index}`),
  );
  player.gold = 100;

  state = buyOfferedTavernSpell(
    state,
    "tavern-spell-tavern-coin",
    "mycologist-full-hand-spell",
  );
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(
    minionsInHand(nextPlayer).some(
      (minion) => minion.definitionId === "BG33_890t",
    ),
    false,
  );
  assert.equal(
    boardMinion(state, mycologist.instanceId).effectCounters?.[
      MAGICFIN_PURCHASE_COUNTER
    ],
    1,
  );
  assert.match(
    boardMinion(state, mycologist.instanceId).description,
    /还剩0次/u,
  );
});

test("Magicfin Apprentice casts its taught targeted Tavern Spell automatically for every Brann pulse", () => {
  let state = createGame(0xf620);
  let player = humanPlayer(state);
  const target = definitionMinion("BG31_920", "apprentice-target");
  const brann = definitionMinion("BG_LOE_077", "apprentice-brann");
  const apprentice = definitionMinion("BG33_890t", "taught-apprentice", {
    taughtTavernSpellDefinitionId: "tavern-spell-fortify",
  });
  player.board = [target, brann];
  player.shop = [];
  player.hand = [apprentice];
  const healthBefore = player.board.reduce(
    (total, minion) => total + minion.health,
    0,
  );
  const historyBefore = {
    turn: player.tavernSpellsCastThisTurn,
    game: player.tavernSpellsCast,
    player: player.playerSpellsCast,
  };

  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 2,
  });
  player = humanPlayer(state);
  const healthAfter = player.board.reduce(
    (total, minion) => total + minion.health,
    0,
  );
  assert.equal(state.pendingInteraction, null);
  assert.equal(player.isHuman, true);
  assert.equal(healthAfter - healthBefore - apprentice.health, 6);
  assert.equal(player.tavernSpellsCastThisTurn, historyBefore.turn + 2);
  assert.equal(player.tavernSpellsCast, historyBefore.game + 2);
  assert.equal(player.playerSpellsCast, historyBefore.player);
  assert.equal(
    player.lastTavernSpellDefinitionId,
    "tavern-spell-fortify",
  );
  assert.equal(player.board.filter((minion) => minion.taunt).length >= 1, true);
});

test("Magicfin Apprentice safely fizzles a taught Tavern Spell with no legal target", () => {
  let state = createGame(0xf621);
  const player = humanPlayer(state);
  player.board = [];
  player.shop = [];
  player.hand = [
    definitionMinion("BG33_890t", "targetless-apprentice", {
      taughtTavernSpellDefinitionId: "tavern-spell-slaughter",
    }),
  ];
  const spellHistoryBefore = [
    player.tavernSpellsCastThisTurn,
    player.tavernSpellsCast,
    player.playerSpellsCast,
    player.lastTavernSpellDefinitionId,
  ];
  const rngBefore = state.rngState;

  state = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 0,
  });
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.hand.length, 0);
  assert.equal(nextPlayer.board[0]?.instanceId, "targetless-apprentice");
  assert.equal(state.pendingInteraction, null);
  assert.deepEqual(
    [
      nextPlayer.tavernSpellsCastThisTurn,
      nextPlayer.tavernSpellsCast,
      nextPlayer.playerSpellsCast,
      nextPlayer.lastTavernSpellDefinitionId,
    ],
    spellHistoryBefore,
  );
  assert.equal(state.rngState, rngBefore);
});

test("Wrathscale Rogue grants the Health-gaining Naga Attack for Tavern Spells, Spellcraft, and Blood Gems", () => {
  let state = createGame(0xf630);
  let player = humanPlayer(state);
  const normal = definitionMinion("BG33_920", "normal-wrathscale");
  const golden = goldenMinion("BG33_920", "golden-wrathscale");
  const target = definitionMinion("BG31_035", "wrathscale-target");
  player.board = [normal, golden, target];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "wrathscale-fortify"),
    spellcraft("spellcraft-anglers-lure", "wrathscale-lure"),
    bloodGem("wrathscale-gem"),
  ];

  let before = boardMinion(state, target.instanceId);
  let statsBefore = [before.attack, before.health];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "wrathscale-fortify",
    targetInstanceId: target.instanceId,
  });
  let current = boardMinion(state, target.instanceId);
  assert.deepEqual(
    [current.attack - statsBefore[0], current.health - statsBefore[1]],
    [9, 3],
  );

  before = current;
  statsBefore = [before.attack, before.health];
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "wrathscale-lure",
    targetInstanceId: target.instanceId,
  });
  current = boardMinion(state, target.instanceId);
  assert.deepEqual(
    [current.attack - statsBefore[0], current.health - statsBefore[1]],
    [20, 6],
  );

  before = current;
  statsBefore = [before.attack, before.health];
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "wrathscale-gem",
    targetInstanceId: target.instanceId,
  });
  current = boardMinion(state, target.instanceId);
  assert.deepEqual(
    [current.attack - statsBefore[0], current.health - statsBefore[1]],
    [4, 1],
  );

  player = humanPlayer(state);
  player.hand = [
    tavernSpell("tavern-spell-fortify", "wrathscale-self-fortify"),
  ];
  const selfBefore = boardMinion(state, normal.instanceId);
  const selfStats = [selfBefore.attack, selfBefore.health];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "wrathscale-self-fortify",
    targetInstanceId: normal.instanceId,
  });
  const selfAfter = boardMinion(state, normal.instanceId);
  assert.deepEqual(
    [selfAfter.attack - selfStats[0], selfAfter.health - selfStats[1]],
    [6, 3],
  );
});

test("Wrathscale Rogue observes Gem Confiscation transfers, Magnetic fusion, and Perfect Vision's actual Health gain", () => {
  {
    let state = createGame(0xf631);
    const player = humanPlayer(state);
    const left = definitionMinion("BG25_001", "confiscation-left", {
      attack: 12,
      health: 13,
      bloodGemAttack: 2,
      bloodGemHealth: 3,
    });
    const target = definitionMinion("BG27_004", "confiscation-target");
    const right = definitionMinion("BG25_001", "confiscation-right", {
      attack: 14,
      health: 15,
      bloodGemAttack: 4,
      bloodGemHealth: 5,
    });
    const wrath = definitionMinion("BG33_920", "confiscation-wrath");
    player.board = [left, target, right, wrath];
    player.hand = [
      tavernSpell(
        "tavern-spell-gem-confiscation",
        "wrathscale-confiscation",
      ),
    ];
    const before = [target.attack, target.health];

    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: "wrathscale-confiscation",
      targetInstanceId: target.instanceId,
    });
    const current = boardMinion(state, target.instanceId);
    assert.deepEqual(
      [current.attack - before[0], current.health - before[1]],
      [18, 10],
    );
    assert.deepEqual(
      [
        boardMinion(state, left.instanceId).bloodGemAttack,
        boardMinion(state, left.instanceId).bloodGemHealth,
        boardMinion(state, right.instanceId).bloodGemAttack,
        boardMinion(state, right.instanceId).bloodGemHealth,
      ],
      [0, 0, 0, 0],
    );
  }

  {
    let state = createGame(0xf632);
    const player = humanPlayer(state);
    const wrath = definitionMinion("BG33_920", "magnetic-wrath");
    const host = definitionMinion("BG32_111", "magnetic-all-host", {
      attack: 10,
      health: 10,
    });
    const source = definitionMinion("BG26_146", "magnetic-source", {
      attack: 5,
      health: 7,
    });
    player.board = [wrath, host];
    player.hand = [source];

    state = gameReducer(state, {
      type: "MAGNETIZE_MINION",
      cardInstanceId: source.instanceId,
      targetInstanceId: host.instanceId,
    });
    const current = boardMinion(state, host.instanceId);
    assert.deepEqual([current.attack, current.health], [22, 17]);
    assert.equal(current.attachments.length, 1);
    assert.equal(current.attachments[0]?.definitionId, source.definitionId);
  }

  for (const [index, health, expected] of [
    [0, 5, [35, 20]],
    [1, 25, [20, 20]],
  ] as const) {
    let state = createGame(0xf633 + index);
    const player = humanPlayer(state);
    const wrath = definitionMinion(
      "BG33_920",
      `perfect-vision-wrath-${index}`,
    );
    const target = definitionMinion(
      "BG27_004",
      `perfect-vision-target-${index}`,
      { attack: 2, health },
    );
    player.board = [wrath, target];
    player.hand = [
      tavernSpell(
        "tavern-spell-perfect-vision",
        `perfect-vision-spell-${index}`,
      ),
    ];
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `perfect-vision-spell-${index}`,
      targetInstanceId: target.instanceId,
    });
    const current = boardMinion(state, target.instanceId);
    assert.deepEqual([current.attack, current.health], expected);
  }
});

test("Wrathscale Rogue observes summon buffs and the AI Adaptable Beetle path", () => {
  {
    let state = createGame(0xf636);
    const player = humanPlayer(state);
    const wrath = definitionMinion("BG33_920", "summon-wrath");
    const mama = definitionMinion("mama-bear", "summon-mama");
    const target = definitionMinion("BG27_004", "summoned-naga-beast");
    player.board = [wrath, mama];
    player.hand = [target];
    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 2,
    });
    const current = boardMinion(state, target.instanceId);
    assert.deepEqual([current.attack, current.health], [13, 7]);
  }

  {
    let state = createGame(0xf637);
    const player = humanPlayer(state);
    player.isHuman = false;
    const wrath = definitionMinion("BG33_920", "ai-beetle-wrath");
    const target = definitionMinion("BG27_004", "ai-beetle-target", {
      windfury: true,
      reborn: false,
    });
    const beetle = definitionMinion("BG27_084", "ai-adaptable-beetle");
    player.board = [wrath, target];
    player.hand = [beetle];
    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 2,
    });
    const current = boardMinion(state, target.instanceId);
    assert.deepEqual([current.attack, current.health], [3, 2]);
    assert.equal(current.reborn, true);
    assert.equal(state.pendingInteraction, null);
  }
});

test("Wrathscale Rogue reacts after an ALL minion gains Health in combat without retaining temporary stats", () => {
  for (const golden of [false, true]) {
    const state = createGame(0xf640 + Number(golden));
    const player = humanPlayer(state);
    const wrath = golden
      ? goldenMinion("BG33_920", `combat-wrath-${golden}`)
      : definitionMinion("BG33_920", `combat-wrath-${golden}`);
    const amber = definitionMinion("BG24_500", `combat-amber-${golden}`);
    const allType = definitionMinion(
      "BG32_111",
      `combat-all-target-${golden}`,
      { attack: 17, health: 19, divineShield: false },
    );
    player.board = [wrath, amber, allType];
    prepareDuel(state, [
      definitionMinion("BG29_611", `combat-wall-${golden}`, {
        attack: 0,
        health: 1_000_000,
        taunt: true,
        divineShield: false,
        reborn: false,
      }),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(combat.phase, "combat");
    const battle = combat.lastBattle;
    assert.ok(battle);
    const relevant = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === allType.instanceId &&
        (event.actorInstanceId === amber.instanceId ||
          event.actorInstanceId === wrath.instanceId),
    );
    const wrathAttack = golden ? 4 : 2;
    assert.deepEqual(
      relevant.map((event) => [
        event.actorInstanceId,
        event.attackDelta,
        event.healthDelta,
        event.minion?.attack,
        event.minion?.health,
      ]),
      [
        [amber.instanceId, 2, 2, 19, 21],
        [wrath.instanceId, wrathAttack, 0, 19 + wrathAttack, 21],
      ],
    );
    assert.ok(relevant[0].index < relevant[1].index);
    assert.equal(relevant[1].retained, false);
    assert.equal(
      relevant[1].message,
      `${golden ? "金色·" : ""}怒鳞潜行者看到梦魇茶客获得2点生命值，使其获得+${wrathAttack}攻击力。`,
    );

    const combatTarget = battle.finalBoards[player.id].find(
      (minion) => minion.instanceId === allType.instanceId,
    );
    assert.ok(combatTarget);
    assert.deepEqual(
      [combatTarget.attack, combatTarget.health],
      [19 + wrathAttack, 21],
    );
    const permanentTarget = humanPlayer(combat).board.find(
      (minion) => minion.instanceId === allType.instanceId,
    );
    assert.ok(permanentTarget);
    assert.deepEqual(
      [
        permanentTarget.attack,
        permanentTarget.health,
        permanentTarget.divineShield,
      ],
      [17, 19, false],
    );
  }
});

test("a combat summon shows the summon, source Health buff, and Wrathscale buff in causal order", () => {
  const state = createGame(0xf644);
  const player = humanPlayer(state);
  const wrath = definitionMinion("BG33_920", "summon-order-wrath", {
    attack: 0,
    health: 1_000,
  });
  const mama = definitionMinion("mama-bear", "summon-order-mama", {
    attack: 0,
    health: 1_000,
  });
  const rebornAll = definitionMinion("BG32_111", "summon-order-all", {
    attack: 0,
    health: 1,
    taunt: true,
    reborn: true,
  });
  player.board = [wrath, mama, rebornAll];
  prepareDuel(state, [
    definitionMinion("BG29_611", "summon-order-wall", {
      attack: 10,
      health: 100_000,
      divineShield: false,
      reborn: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "reborn" &&
      event.minion?.definitionId === "BG32_111",
  );
  assert.ok(summon?.targetInstanceId);
  const sequence = battle.events.filter(
    (event) =>
      event.targetInstanceId === summon.targetInstanceId &&
      (event.type === "summon" ||
        (event.type === "buff" &&
          (event.actorInstanceId === mama.instanceId ||
            event.actorInstanceId === wrath.instanceId))),
  );
  assert.deepEqual(
    sequence.map((event) => [
      event.type,
      event.actorInstanceId,
      event.attackDelta ?? 0,
      event.healthDelta ?? 0,
      event.minion?.attack,
      event.minion?.health,
    ]),
    [
      ["summon", rebornAll.instanceId, 0, 0, 3, 1],
      ["buff", mama.instanceId, 6, 6, 9, 7],
      ["buff", wrath.instanceId, 6, 0, 15, 7],
    ],
  );
  assert.equal(sequence[1].index + 1, sequence[2].index);
  assert.equal(sequence[2].retained, false);
});

test("a dead Wrathscale does not react to a later Health gain in the same damage wave", () => {
  const state = createGame(0xf646);
  const player = humanPlayer(state);
  const wrath = definitionMinion("BG33_920", "dead-watcher-wrath", {
    attack: 0,
    health: 1,
  });
  const centralBeast = definitionMinion(
    "tabbycat-token",
    "dead-watcher-central-beast",
    { attack: 0, health: 1_000, taunt: true },
  );
  const observer = definitionMinion("BG29_806", "dead-watcher-observer", {
    attack: 0,
    health: 1_000,
    tribe: "neutral",
    tribes: [],
  });
  const target = definitionMinion("BG32_111", "dead-watcher-target", {
    attack: 3,
    health: 1_000,
  });
  player.board = [wrath, centralBeast, observer, target];
  const enemyBoard = [
    definitionMinion("foe-reaper-4000", "dead-watcher-cleave", {
      attack: 2,
      health: 100_000,
      taunt: true,
      cleave: true,
    }),
    ...Array.from({ length: 4 }, (_, index) =>
      definitionMinion(
        "defender-of-argus",
        `dead-watcher-filler-${index}`,
        { attack: 0, health: 1, taunt: false },
      ),
    ),
  ];
  prepareDuel(state, enemyBoard);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const sourceBuff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === observer.instanceId &&
      event.targetInstanceId === target.instanceId &&
      event.attackDelta === 3 &&
      event.healthDelta === 2,
  );
  assert.ok(sourceBuff);
  const wrathDeath = battle.events.find(
    (event) =>
      event.type === "death" && event.actorInstanceId === wrath.instanceId,
  );
  assert.ok(wrathDeath);
  assert.equal(sourceBuff.retained, true);
  assert.equal(sourceBuff.index + 1, wrathDeath.index);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === wrath.instanceId &&
        event.targetInstanceId === target.instanceId,
    ),
    false,
  );
  const retainedSourceBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === observer.instanceId &&
      event.targetInstanceId === target.instanceId &&
      event.attackDelta === 3 &&
      event.healthDelta === 2 &&
      event.retained === true,
  );
  const permanentTarget = humanPlayer(combat).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(permanentTarget);
  assert.deepEqual(
    [permanentTarget.attack, permanentTarget.health],
    [3 + retainedSourceBuffs.length * 3, 1_000 + retainedSourceBuffs.length * 2],
  );
});

test("Wrathscale Rogue reacts to an explicitly permanent combat Health gain and Poet retains the resulting Attack", () => {
  const state = createGame(0xf645);
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  const ribbon = ACTIVE_TRINKET_DEFINITIONS.find(
    (definition) => definition.cardId === "BG35_MagicItem_923",
  );
  assert.ok(ribbon);
  player.trinketIds = [ribbon.id];
  player.trinketCounters = { [ribbon.id]: 0 };
  const wrath = definitionMinion("BG33_920", "permanent-wrath", {
    attack: 0,
  });
  const tideRaiser = definitionMinion(
    "BG34_920",
    "permanent-tide-raiser",
    { attack: 0, health: 1, taunt: true },
  );
  const poet = definitionMinion("BG29_813", "permanent-poet", { attack: 0 });
  const target = definitionMinion("BG32_111", "permanent-all-target", {
    attack: 0,
    health: 1_000,
  });
  player.board = [wrath, tideRaiser, poet, target];
  prepareDuel(state, [
    definitionMinion("BG29_611", "permanent-combat-wall", {
      attack: 100,
      health: 100_000,
      taunt: true,
      divineShield: false,
      reborn: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.ok(combat.lastBattle);
  const relevant = combat.lastBattle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === target.instanceId &&
      (event.actorInstanceId === ribbon.id ||
        event.actorInstanceId === wrath.instanceId),
  );
  assert.deepEqual(
    relevant.map((event) => [
      event.actorInstanceId,
      event.attackDelta,
      event.healthDelta,
      event.retained,
    ]),
    [
      [ribbon.id, 2, 2, true],
      [wrath.instanceId, 2, 0, true],
    ],
  );
  assert.ok(relevant[0].index < relevant[1].index);
  const persistentTarget = humanPlayer(combat).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(persistentTarget);
  assert.deepEqual(
    [persistentTarget.attack, persistentTarget.health],
    [4, 1_002],
  );
});

test("v46 save normalization preserves v45 spell history and repairs Magicfin counters and taught spells", () => {
  const legacy = createGame(0xf650);
  const legacyPlayer = humanPlayer(legacy);
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V45;
  legacyPlayer.playerSpellsCast = 7;
  legacyPlayer.tavernSpellsCast = 11;
  legacyPlayer.tavernSpellsCastThisTurn = 3;
  legacyPlayer.lastTavernSpellDefinitionId =
    "tavern-spell-tavern-coin";
  const migrated = normalizePersistedGameState(
    structuredClone(legacy),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.deepEqual(
    [
      humanPlayer(migrated).playerSpellsCast,
      humanPlayer(migrated).tavernSpellsCast,
      humanPlayer(migrated).tavernSpellsCastThisTurn,
      humanPlayer(migrated).lastTavernSpellDefinitionId,
    ],
    [7, 11, 3, "tavern-spell-tavern-coin"],
  );

  const state = createGame(0xf651);
  const player = humanPlayer(state);
  const normal = definitionMinion("BG33_891", "save-normal-mycologist", {
    effectCounters: { [MAGICFIN_PURCHASE_COUNTER]: -3 },
  });
  const golden = goldenMinion("BG33_891", "save-golden-mycologist", {
    effectCounters: { [MAGICFIN_PURCHASE_COUNTER]: 99 },
  });
  const valid = definitionMinion("BG33_890t", "save-valid-apprentice", {
    taughtTavernSpellDefinitionId: "tavern-spell-fortify",
    description: "stale valid description",
  });
  const invalid = definitionMinion("BG33_890t", "save-invalid-apprentice", {
    taughtTavernSpellDefinitionId: "missing-tavern-spell",
    description: "stale invalid description",
  });
  const unrelated = definitionMinion("BG25_001", "save-unrelated", {
    taughtTavernSpellDefinitionId: "tavern-spell-fortify",
  });
  player.board = [normal, golden, valid];
  player.hand = [invalid];
  player.shop = [unrelated];

  const normalized = normalizePersistedGameState(
    structuredClone(state),
  ) as GameState | null;
  assert.ok(normalized);
  const normalizedPlayer = humanPlayer(normalized);
  assert.deepEqual(
    normalizedPlayer.board
      .filter((minion) => minion.definitionId === "BG33_891")
      .map(
        (minion) =>
          minion.effectCounters?.[MAGICFIN_PURCHASE_COUNTER],
      ),
    [0, 0],
  );
  const normalizedValid = normalizedPlayer.board.find(
    (minion) => minion.instanceId === valid.instanceId,
  );
  assert.ok(normalizedValid);
  assert.equal(
    normalizedValid.taughtTavernSpellDefinitionId,
    "tavern-spell-fortify",
  );
  assert.match(normalizedValid.description, /强固/u);
  const normalizedInvalid = minionsInHand(normalizedPlayer).find(
    (minion) => minion.instanceId === invalid.instanceId,
  );
  assert.ok(normalizedInvalid);
  assert.equal(normalizedInvalid.taughtTavernSpellDefinitionId, undefined);
  assert.equal(
    normalizedInvalid.description,
    getMinionDefinition("BG33_890t").description,
  );
  assert.equal(
    normalizedPlayer.shop[0]?.taughtTavernSpellDefinitionId,
    undefined,
  );
});
