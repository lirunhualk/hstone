import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

function playerById(
  state: GameState,
  playerId: string,
): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === playerId,
  );
  assert.ok(player, `player ${playerId} must exist`);
  return player;
}

function humanPlayer(state: GameState): PlayerState {
  return playerById(state, state.humanPlayerId);
}

function minionTemplate(state: GameState): BoardMinionInstance {
  for (const player of state.players) {
    const shopTemplate = player.shop[0];
    if (shopTemplate) {
      return shopTemplate;
    }
  }
  for (const player of state.players) {
    const boardTemplate = player.board[0];
    if (boardTemplate) {
      return boardTemplate;
    }
    const handTemplate = player.hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion",
    );
    if (handTemplate) {
      return handTemplate;
    }
  }
  throw new Error("a minion template must exist");
}

function definitionMinion(
  state: GameState,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const template = minionTemplate(state);
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    ...template,
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden
      ? `${definition.cardId}_G`
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
    sellValue:
      golden
        ? definition.goldenSellValue ??
          definition.sellValue ??
          1
        : definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
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

function handMinions(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion",
  );
}

function minionWithInstanceId(
  minions: readonly BoardMinionInstance[],
  instanceId: string,
): BoardMinionInstance {
  const minion = minions.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion, `${instanceId} must exist`);
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

function clearMinionPool(state: GameState): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
}

function prepareDuel(
  state: GameState,
  opponentBoard: BoardMinionInstance[],
): PlayerState {
  const human = humanPlayer(state);
  const opponent = state.players.find(
    (player) => player.id !== human.id,
  );
  assert.ok(opponent);
  human.alive = true;
  human.health = 100;
  for (const player of state.players) {
    if (player.id === human.id) {
      continue;
    }
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 100;
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

function continueAfterCombat(state: GameState): GameState {
  assert.equal(state.phase, "combat");
  const recruit = gameReducer(state, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
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

function addDoomedRecruitMinion(
  state: GameState,
  playerId: string,
  instanceId: string,
): GameState {
  const player = playerById(state, playerId);
  player.hand.push(
    definitionMinion(
      state,
      "BG35_801",
      instanceId,
      {
        destroyAfterPlayThroughRound: state.round,
      },
    ),
  );
  return playHandMinion(state, instanceId);
}

const COMPLETE_PERSISTENT_CARD_IDS = [
  "BG_TTN_401",
  "BG25_008",
  "BG34_231",
] as const;

test("the persistent Tier 2 batch is explicitly marked complete", () => {
  for (const definitionId of COMPLETE_PERSISTENT_CARD_IDS) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
      `${definitionId} must stay partial until every printed behavior works`,
    );
  }
});

test("Ancestral Automaton handles its first and later summons, Golden scaling, every zone, and future copies", () => {
  let state = createGame(0xa100);
  state.activeTribes = ["mech"];
  let player = humanPlayer(state);
  const first = definitionMinion(
    state,
    "BG_TTN_401",
    "automaton-first",
  );
  player.board = [];
  player.hand = [first];
  player.shop = [];

  state = playHandMinion(state, first.instanceId);
  player = humanPlayer(state);
  assertStats(
    minionWithInstanceId(player.board, first.instanceId),
    3,
    4,
  );

  const goldenSecond = definitionMinion(
    state,
    "BG_TTN_401",
    "automaton-golden-second",
    { golden: true },
  );
  const handObserver = definitionMinion(
    state,
    "BG_TTN_401",
    "automaton-hand-observer",
  );
  const frozenShopObserver = definitionMinion(
    state,
    "BG_TTN_401",
    "automaton-frozen-shop-observer",
  );
  player.hand = [goldenSecond, handObserver];
  player.shop = [frozenShopObserver];
  player.frozen = true;

  state = playHandMinion(state, goldenSecond.instanceId);
  player = humanPlayer(state);
  assertStats(
    minionWithInstanceId(player.board, first.instanceId),
    6,
    6,
  );
  assertStats(
    minionWithInstanceId(player.board, goldenSecond.instanceId),
    12,
    12,
  );
  assertStats(
    minionWithInstanceId(
      handMinions(player),
      handObserver.instanceId,
    ),
    9,
    8,
  );
  assertStats(
    minionWithInstanceId(
      player.shop,
      frozenShopObserver.instanceId,
    ),
    9,
    8,
  );

  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  player = humanPlayer(state);
  player.tavernTier = 2;
  player.gold = 10;
  player.freeRefreshes = 1;
  clearMinionPool(state);
  state.pool.BG_TTN_401 = 18;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  assert.ok(
    player.shop.every(
      (minion) => minion.definitionId === "BG_TTN_401",
    ),
  );
  for (const futureCopy of player.shop) {
    assertStats(futureCopy, 9, 8);
  }
});

test("a failed full-board Automaton play is not a summon", () => {
  let state = createGame(0xa101);
  let player = humanPlayer(state);
  const automaton = definitionMinion(
    state,
    "BG_TTN_401",
    "full-board-automaton",
  );
  player.board = Array.from({ length: 7 }, (_, index) =>
    definitionMinion(
      state,
      "BG35_801",
      `full-board-filler-${index}`,
    ),
  );
  player.hand = [automaton];
  player.shop = [];

  state = playHandMinion(state, automaton.instanceId);
  player = humanPlayer(state);
  assert.equal(player.board.length, 7);
  assertStats(
    minionWithInstanceId(
      handMinions(player),
      automaton.instanceId,
    ),
    3,
    4,
  );

  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  state = playHandMinion(state, automaton.instanceId);
  player = humanPlayer(state);
  assertStats(
    minionWithInstanceId(player.board, automaton.instanceId),
    3,
    4,
  );
});

test("Auto-Assembler and Titus count each successful combat summon", () => {
  const state = createGame(0xa102);
  const player = humanPlayer(state);
  const assembler = definitionMinion(
    state,
    "BG32_172",
    "automaton-assembler",
    {
      attack: 0,
      health: 1,
      taunt: true,
    },
  );
  const titus = definitionMinion(
    state,
    "BG25_354",
    "automaton-titus",
    {
      attack: 0,
      health: 1_000,
    },
  );
  const handObserver = definitionMinion(
    state,
    "BG_TTN_401",
    "assembler-hand-observer",
  );
  player.board = [assembler, titus];
  player.hand = [handObserver];
  player.shop = [];
  prepareDuel(state, [
    definitionMinion(
      state,
      "BG35_801",
      "assembler-enemy-a",
      { attack: 100, health: 1_000 },
    ),
    definitionMinion(
      state,
      "BG35_801",
      "assembler-enemy-b",
      { attack: 0, health: 1_000 },
    ),
    definitionMinion(
      state,
      "BG35_801",
      "assembler-enemy-c",
      { attack: 0, health: 1_000 },
    ),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const summons =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === assembler.instanceId &&
        event.minion?.definitionId === "BG_TTN_401",
    ) ?? [];
  assert.equal(summons.length, 2);
  assertStats(
    minionWithInstanceId(
      handMinions(humanPlayer(combat)),
      handObserver.instanceId,
    ),
    9,
    8,
  );
});

test("tripling Automatons does not add their derived aura stats more than once", () => {
  let state = createGame(0xa103);
  let player = humanPlayer(state);
  player.board = [];
  player.hand = [
    definitionMinion(
      state,
      "BG_TTN_401",
      "triple-automaton-a",
    ),
  ];
  player.shop = [];

  state = playHandMinion(state, "triple-automaton-a");
  player = humanPlayer(state);
  player.hand.push(
    definitionMinion(
      state,
      "BG_TTN_401",
      "triple-automaton-b",
    ),
  );
  state = playHandMinion(state, "triple-automaton-b");
  player = humanPlayer(state);
  player.hand.push(
    definitionMinion(
      state,
      "BG_TTN_401",
      "triple-automaton-c",
    ),
  );
  state = playHandMinion(state, "triple-automaton-c");
  player = humanPlayer(state);

  const golden = handMinions(player).find(
    (minion) =>
      minion.definitionId === "BG_TTN_401" &&
      minion.golden,
  );
  assert.ok(golden);
  assertStats(golden, 24, 20);
  assert.equal(golden.grantsTripleReward, true);

  state = playHandMinion(state, golden.instanceId);
  player = humanPlayer(state);
  const playedGolden = player.board.find(
    (minion) =>
      minion.definitionId === "BG_TTN_401" &&
      minion.golden,
  );
  assert.ok(playedGolden);
  assertStats(playedGolden, 24, 20);
  assert.equal(
    player.hand.filter(
      (card) => card.kind === "tripleReward",
    ).length,
    1,
  );
});

test("AI plays and scales Automatons but holds an unfinished Old Soul", () => {
  const state = createGame(0xa104);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion(
      state,
      "BG35_801",
      "persistent-ai-opponent",
      { attack: 100, health: 1_000 },
    ),
  ];
  human.shop = [];
  const ai = prepareDuel(state, []);
  ai.hand = [
    definitionMinion(
      state,
      "BG_TTN_401",
      "persistent-ai-automaton-a",
    ),
    definitionMinion(
      state,
      "BG_TTN_401",
      "persistent-ai-automaton-b",
    ),
    definitionMinion(
      state,
      "BG34_231",
      "persistent-ai-old-soul",
    ),
    definitionMinion(
      state,
      "BG35_801",
      "persistent-ai-playable-filler",
    ),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextAi = playerById(combat, ai.id);
  const aiAutomatons = nextAi.board.filter(
    (minion) => minion.definitionId === "BG_TTN_401",
  );
  assert.equal(aiAutomatons.length, 2);
  for (const automaton of aiAutomatons) {
    assertStats(automaton, 6, 6);
  }
  assert.ok(
    nextAi.board.some(
      (minion) =>
        minion.instanceId === "persistent-ai-playable-filler",
    ),
  );
  const heldSoul = handMinions(nextAi).find(
    (minion) =>
      minion.instanceId === "persistent-ai-old-soul",
  );
  assert.ok(heldSoul);
  assert.equal(heldSoul.golden, false);
});

test("one Eternal Knight death buffs regular and Golden copies once even with Golden Titus", () => {
  const state = createGame(0xa110);
  const player = humanPlayer(state);
  const source = definitionMinion(
    state,
    "BG25_008",
    "eternal-source",
    { taunt: true },
  );
  const goldenTitus = definitionMinion(
    state,
    "BG25_354",
    "eternal-golden-titus",
    {
      golden: true,
      attack: 0,
      health: 1_000,
    },
  );
  const regularWitness = definitionMinion(
    state,
    "BG25_008",
    "eternal-regular-witness",
  );
  const goldenWitness = definitionMinion(
    state,
    "BG25_008",
    "eternal-golden-witness",
    { golden: true },
  );
  player.board = [source, goldenTitus];
  player.hand = [regularWitness, goldenWitness];
  player.shop = [];
  prepareDuel(state, [
    definitionMinion(
      state,
      "BG35_801",
      "eternal-enemy-a",
      { attack: 100, health: 1_000 },
    ),
    definitionMinion(
      state,
      "BG35_801",
      "eternal-enemy-b",
      { attack: 0, health: 1_000 },
    ),
    definitionMinion(
      state,
      "BG35_801",
      "eternal-enemy-c",
      { attack: 0, health: 1_000 },
    ),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextHand = handMinions(humanPlayer(combat));
  assertStats(
    minionWithInstanceId(
      nextHand,
      regularWitness.instanceId,
    ),
    8,
    4,
  );
  assertStats(
    minionWithInstanceId(
      nextHand,
      goldenWitness.instanceId,
    ),
    16,
    8,
  );
  assert.equal(
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === source.instanceId,
    ).length,
    1,
  );
});

test("same-wave and Reborn Eternal Knight deaths each count as actual deaths", () => {
  {
    const state = createGame(0xa111);
    const player = humanPlayer(state);
    const regular = definitionMinion(
      state,
      "BG25_008",
      "wave-eternal-regular",
      {
        health: 1,
        taunt: true,
      },
    );
    const golden = definitionMinion(
      state,
      "BG25_008",
      "wave-eternal-golden",
      {
        golden: true,
        health: 1,
      },
    );
    const witness = definitionMinion(
      state,
      "BG25_008",
      "wave-eternal-witness",
    );
    player.board = [regular, golden];
    player.hand = [witness];
    player.shop = [];
    prepareDuel(state, [
      definitionMinion(
        state,
        "BG35_801",
        "wave-cleaver",
        {
          attack: 100,
          health: 1_000,
          cleave: true,
        },
      ),
      definitionMinion(
        state,
        "BG35_801",
        "wave-enemy-b",
        { attack: 0, health: 1_000 },
      ),
      definitionMinion(
        state,
        "BG35_801",
        "wave-enemy-c",
        { attack: 0, health: 1_000 },
      ),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    assertStats(
      minionWithInstanceId(
        handMinions(humanPlayer(combat)),
        witness.instanceId,
      ),
      12,
      6,
    );
    const waveDeaths =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "death" &&
          [regular.instanceId, golden.instanceId].includes(
            event.actorInstanceId ?? "",
          ),
      ) ?? [];
    assert.equal(waveDeaths.length, 2);
  }

  {
    const state = createGame(0xa112);
    const player = humanPlayer(state);
    const rebornSource = definitionMinion(
      state,
      "BG25_008",
      "reborn-eternal-source",
      {
        health: 1,
        taunt: true,
        reborn: true,
      },
    );
    const witness = definitionMinion(
      state,
      "BG25_008",
      "reborn-eternal-witness",
    );
    player.board = [rebornSource];
    player.hand = [witness];
    player.shop = [];
    prepareDuel(state, [
      definitionMinion(
        state,
        "BG35_801",
        "reborn-eternal-enemy-a",
        { attack: 100, health: 1_000 },
      ),
      definitionMinion(
        state,
        "BG35_801",
        "reborn-eternal-enemy-b",
        { attack: 100, health: 1_000 },
      ),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    assertStats(
      minionWithInstanceId(
        handMinions(humanPlayer(combat)),
        witness.instanceId,
      ),
      12,
      6,
    );
    const eternalDeaths =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "death" &&
          event.message.includes(
            getMinionDefinition("BG25_008").name,
          ),
      ) ?? [];
    assert.equal(eternalDeaths.length, 2);
  }
});

test("Eternal Knight updates hand and frozen Tavern copies, triples without aura duplication, and buffs future copies", () => {
  let state = createGame(0xa113);
  state.activeTribes = ["undead"];
  let player = humanPlayer(state);
  const boardCopy = definitionMinion(
    state,
    "BG25_008",
    "zone-eternal-board",
    { taunt: true },
  );
  const handCopy = definitionMinion(
    state,
    "BG25_008",
    "zone-eternal-hand",
  );
  const shopCopy = definitionMinion(
    state,
    "BG25_008",
    "zone-eternal-shop",
  );
  player.board = [boardCopy];
  player.hand = [handCopy];
  player.shop = [shopCopy];
  player.frozen = true;
  prepareDuel(state, [
    definitionMinion(
      state,
      "BG35_801",
      "zone-eternal-enemy",
      { attack: 100, health: 1_000 },
    ),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assertStats(
    minionWithInstanceId(
      handMinions(player),
      handCopy.instanceId,
    ),
    8,
    4,
  );
  assertStats(
    minionWithInstanceId(player.shop, shopCopy.instanceId),
    8,
    4,
  );

  state = continueAfterCombat(state);
  player = humanPlayer(state);
  const shopIndex = player.shop.findIndex(
    (minion) => minion.instanceId === shopCopy.instanceId,
  );
  assert.ok(shopIndex >= 0);
  state = gameReducer(state, {
    type: "BUY_MINION",
    shopIndex,
  });
  player = humanPlayer(state);
  const golden = handMinions(player).find(
    (minion) =>
      minion.definitionId === "BG25_008" &&
      minion.golden,
  );
  assert.ok(golden);
  assertStats(golden, 16, 8);
  assert.equal(golden.grantsTripleReward, true);

  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.tavernTier = 2;
  player.gold = 10;
  player.freeRefreshes = 1;
  clearMinionPool(state);
  state.pool.BG25_008 = 15;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  assert.ok(
    player.shop.every(
      (minion) => minion.definitionId === "BG25_008",
    ),
  );
  for (const futureCopy of player.shop) {
    assertStats(futureCopy, 8, 4);
  }
});

test("Old Soul counts Recruit deaths only while in hand, turns Golden in place, and grants no Triple Reward", () => {
  let state = createGame(0xa120);
  let player = humanPlayer(state);
  const boardSoul = definitionMinion(
    state,
    "BG34_231",
    "old-soul-on-board",
  );
  const handSoul = definitionMinion(
    state,
    "BG34_231",
    "old-soul-in-hand",
  );
  player.board = [boardSoul];
  player.hand = [handSoul];
  player.shop = [];

  for (let death = 1; death <= 15; death += 1) {
    state = addDoomedRecruitMinion(
      state,
      state.humanPlayerId,
      `old-soul-recruit-death-${death}`,
    );
    player = humanPlayer(state);
    const currentSoul = minionWithInstanceId(
      handMinions(player),
      handSoul.instanceId,
    );
    if (death < 15) {
      assert.equal(currentSoul.golden, false);
    }
  }

  player = humanPlayer(state);
  const goldenSoul = minionWithInstanceId(
    handMinions(player),
    handSoul.instanceId,
  );
  assert.equal(goldenSoul.golden, true);
  assert.equal(goldenSoul.cardId, "BG34_231_G");
  assert.equal(goldenSoul.grantsTripleReward, false);
  assertStats(goldenSoul, 6, 8);
  const unchangedBoardSoul = minionWithInstanceId(
    player.board,
    boardSoul.instanceId,
  );
  assert.equal(unchangedBoardSoul.golden, false);
  assert.equal(unchangedBoardSoul.cardId, "BG34_231");

  state = playHandMinion(state, goldenSoul.instanceId);
  player = humanPlayer(state);
  assert.ok(
    player.board.some(
      (minion) =>
        minion.instanceId === goldenSoul.instanceId &&
        minion.golden &&
        minion.cardId === "BG34_231_G",
    ),
  );
  assert.equal(
    player.hand.filter(
      (card) => card.kind === "tripleReward",
    ).length,
    0,
  );
});

test("ghost summons and deaths cannot mutate Automaton, Eternal Knight, or Old Soul persistence", () => {
  let state = createGame(0xa121);
  const originalHumanId = state.humanPlayerId;
  const ghost = state.players.find(
    (player) => player.id !== originalHumanId,
  );
  assert.ok(ghost);
  ghost.hand = [
    definitionMinion(
      state,
      "BG_TTN_401",
      "ghost-automaton-observer",
    ),
    definitionMinion(
      state,
      "BG25_008",
      "ghost-eternal-observer",
    ),
    definitionMinion(
      state,
      "BG34_231",
      "ghost-old-soul-observer",
    ),
  ];
  state.humanPlayerId = ghost.id;
  for (let death = 1; death <= 14; death += 1) {
    state = addDoomedRecruitMinion(
      state,
      ghost.id,
      `ghost-old-soul-setup-death-${death}`,
    );
  }
  state.humanPlayerId = originalHumanId;

  const preparedGhost = playerById(state, ghost.id);
  const autoAssembler = definitionMinion(
    state,
    "BG32_172",
    "ghost-auto-assembler",
    {
      attack: 0,
      health: 1,
      taunt: true,
    },
  );
  const eternal = definitionMinion(
    state,
    "BG25_008",
    "ghost-eternal-source",
    {
      attack: 0,
      health: 1,
      taunt: true,
    },
  );
  preparedGhost.board = [autoAssembler, eternal];
  preparedGhost.alive = false;
  preparedGhost.health = 0;
  preparedGhost.eliminatedRound = 0;
  const handBefore = JSON.parse(
    JSON.stringify(preparedGhost.hand),
  ) as PlayerState["hand"];

  const alivePlayers = state.players
    .filter((player) => player.id !== preparedGhost.id)
    .slice(0, 3);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (alivePlayers.some((alive) => alive.id === player.id)) {
      player.alive = true;
      player.health = 100;
      delete player.eliminatedRound;
      player.hand = [];
      player.board = [
        definitionMinion(
          state,
          "BG35_801",
          `ghost-live-cleaver-${player.id}`,
          {
            attack: 100,
            health: 1_000,
            cleave: true,
          },
        ),
        ...Array.from({ length: 6 }, (_, index) =>
          definitionMinion(
            state,
            "BG35_801",
            `ghost-live-filler-${player.id}-${index}`,
            {
              attack: 0,
              health: 1_000,
            },
          ),
        ),
      ];
    } else if (player.id !== preparedGhost.id) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
      player.eliminatedRound = undefined;
    }
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === preparedGhost.id ||
        battle.playerBId === preparedGhost.id),
  );
  assert.ok(ghostBattle);
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === autoAssembler.instanceId &&
        event.minion?.definitionId === "BG_TTN_401",
    ),
  );
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === eternal.instanceId,
    ),
  );
  const nextGhost = playerById(combat, preparedGhost.id);
  assert.deepEqual(nextGhost.hand, handBefore);
  const oldSoul = handMinions(nextGhost).find(
    (minion) =>
      minion.instanceId === "ghost-old-soul-observer",
  );
  assert.ok(oldSoul);
  assert.equal(oldSoul.golden, false);
});
