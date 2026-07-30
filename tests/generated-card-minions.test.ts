import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

interface FixedSpellCard {
  definitionId: string;
  spellDefinitionId: string;
  trigger: "battlecry" | "deathrattle" | "endOfTurn";
}

const FIXED_SPELL_CARDS = [
  {
    definitionId: "BG34_683",
    spellDefinitionId: "tavern-spell-blood-gem-barrage",
    trigger: "battlecry",
  },
  {
    definitionId: "BG34_682",
    spellDefinitionId: "tavern-spell-blood-gem-barrage",
    trigger: "deathrattle",
  },
  {
    definitionId: "BG34_684",
    spellDefinitionId: "tavern-spell-gem-confiscation",
    trigger: "endOfTurn",
  },
  {
    definitionId: "BG35_143",
    spellDefinitionId: "tavern-spell-deepwater-clan",
    trigger: "battlecry",
  },
  {
    definitionId: "BG35_143",
    spellDefinitionId: "tavern-spell-deepwater-clan",
    trigger: "deathrattle",
  },
  {
    definitionId: "BG35_881",
    spellDefinitionId: "tavern-spell-arcane-absorption",
    trigger: "battlecry",
  },
  {
    definitionId: "BG35_881",
    spellDefinitionId: "tavern-spell-arcane-absorption",
    trigger: "deathrattle",
  },
  {
    definitionId: "BG32_111",
    spellDefinitionId: "tavern-spell-misplaced-tea-set",
    trigger: "battlecry",
  },
  {
    definitionId: "BG32_111",
    spellDefinitionId: "tavern-spell-misplaced-tea-set",
    trigger: "deathrattle",
  },
  {
    definitionId: "BG35_882",
    spellDefinitionId: "tavern-spell-blazing-inferno",
    trigger: "battlecry",
  },
  {
    definitionId: "BG32_891",
    spellDefinitionId: "tavern-spell-staff-of-enrichment",
    trigger: "deathrattle",
  },
  {
    definitionId: "BG33_809",
    spellDefinitionId: "tavern-spell-sanctify",
    trigger: "deathrattle",
  },
  {
    definitionId: "BG34_694",
    spellDefinitionId: "tavern-spell-stir-the-graveyard",
    trigger: "deathrattle",
  },
] as const satisfies readonly FixedSpellCard[];

const COMPLETED_CARD_IDS = [
  "BG25_009",
  "BG32_111",
  "BG32_891",
  "BG33_809",
  "BG34_682",
  "BG34_683",
  "BG34_684",
  "BG34_694",
  "BG35_143",
  "BG35_881",
  "BG35_882",
  "BGS_116",
  "BGS_123",
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

function generatedSpells(
  player: PlayerState,
  definitionId: string,
): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell" &&
      card.definitionId === definitionId,
  );
}

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

test("the generated-card batch is marked complete with exact Golden art", () => {
  for (const definitionId of COMPLETED_CARD_IDS) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
      definitionId,
    );
  }

  assert.deepEqual(
    [
      getMinionDefinition("BGS_116").goldenCardId,
      getMinionDefinition("BGS_123").goldenCardId,
      getMinionDefinition("BG25_009").goldenDescription,
    ],
    [
      "TB_BaconUps_167",
      "TB_BaconUps_162",
      "复生。亡语：召唤一个金色的永恒骑士。",
    ],
  );
});

test("every mapped Battlecry generates the printed Tavern Spell without touching its pool", () => {
  const battlecries = FIXED_SPELL_CARDS.filter(
    (card) => card.trigger === "battlecry",
  );
  for (const [index, card] of battlecries.entries()) {
    let state = createGame(0xc100 + index);
    const player = humanPlayer(state);
    player.board = [];
    player.hand = [
      definitionMinion(
        card.definitionId,
        `battlecry-source-${card.definitionId}`,
      ),
    ];
    const poolBefore = state.spellPool[card.spellDefinitionId];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });

    const spells = generatedSpells(
      humanPlayer(state),
      card.spellDefinitionId,
    );
    assert.equal(spells.length, 1, card.definitionId);
    assert.equal(
      spells[0].cardId,
      getTavernSpellDefinition(card.spellDefinitionId).cardId,
      card.definitionId,
    );
    assert.equal(
      state.spellPool[card.spellDefinitionId],
      poolBefore,
      `${card.definitionId} creates a card rather than drawing from the shared spell pool`,
    );
  }
});

test("Golden Deepwater Chieftain with Brann generates four spells and stops at the hand limit", () => {
  for (const [index, fillerCount] of [0, 9].entries()) {
    let state = createGame(0xc120 + index);
    const player = humanPlayer(state);
    player.board = [
      definitionMinion("BG_LOE_077", `brann-${index}`),
    ];
    player.hand = [
      definitionMinion("BG35_143", `golden-chieftain-${index}`, {
        golden: true,
        cardId: "BG35_143_G",
      }),
      ...Array.from({ length: fillerCount }, (_, fillerIndex) =>
        definitionMinion(
          "BG25_001",
          `battlecry-filler-${index}-${fillerIndex}`,
        ),
      ),
    ];
    const poolBefore =
      state.spellPool["tavern-spell-deepwater-clan"];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });

    assert.equal(
      generatedSpells(
        humanPlayer(state),
        "tavern-spell-deepwater-clan",
      ).length,
      fillerCount === 0 ? 4 : 1,
    );
    assert.equal(
      state.spellPool["tavern-spell-deepwater-clan"],
      poolBefore,
    );
    assert.ok(humanPlayer(state).hand.length <= 10);
  }
});

test("every mapped Deathrattle generates its printed Tavern Spell in combat", () => {
  const deathrattles = FIXED_SPELL_CARDS.filter(
    (card) => card.trigger === "deathrattle",
  );
  for (const [index, card] of deathrattles.entries()) {
    let state = createGame(0xc140 + index);
    const player = humanPlayer(state);
    const source = definitionMinion(
      card.definitionId,
      `deathrattle-source-${card.definitionId}`,
      {
        attack: 0,
        health: 1,
        taunt: true,
        divineShield: false,
        reborn: false,
      },
    );
    player.board = [source];
    player.hand = [];
    keepOnlyOneOpponent(
      state,
      Array.from({ length: 2 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `deathrattle-enemy-${index}-${enemyIndex}`,
          { attack: 100, health: 100 },
        ),
      ),
    );
    const poolBefore = state.spellPool[card.spellDefinitionId];

    state = gameReducer(state, { type: "END_TURN" });

    assert.equal(
      generatedSpells(
        humanPlayer(state),
        card.spellDefinitionId,
      ).length,
      1,
      card.definitionId,
    );
    assert.equal(
      state.spellPool[card.spellDefinitionId],
      poolBefore,
      card.definitionId,
    );
    const gainEvents =
      state.lastBattle?.events.filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === source.instanceId,
      ) ?? [];
    assert.equal(gainEvents.length, 1, card.definitionId);
    assert.equal(gainEvents[0].cardGainResult, "added");
  }
});

test("Golden Deathrattles, Titus, and a nearly full hand resolve one attempt at a time", () => {
  let state = createGame(0xc160);
  const player = humanPlayer(state);
  const source = definitionMinion(
    "BG35_143",
    "golden-deathrattle-source",
    {
      golden: true,
      cardId: "BG35_143_G",
      attack: 0,
      health: 1,
      taunt: true,
      reborn: false,
    },
  );
  player.board = [
    source,
    definitionMinion("BG25_354", "titus-for-spells", {
      attack: 0,
      health: 1_000,
    }),
  ];
  player.hand = Array.from({ length: 8 }, (_, index) =>
    definitionMinion("BG25_001", `deathrattle-filler-${index}`),
  );
  keepOnlyOneOpponent(
    state,
    Array.from({ length: 3 }, (_, index) =>
      definitionMinion("BG35_801", `titus-spell-enemy-${index}`, {
        attack: 100,
        health: 100,
      }),
    ),
  );
  const poolBefore =
    state.spellPool["tavern-spell-deepwater-clan"];

  state = gameReducer(state, { type: "END_TURN" });

  assert.equal(
    generatedSpells(
      humanPlayer(state),
      "tavern-spell-deepwater-clan",
    ).length,
    2,
  );
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(
    state.spellPool["tavern-spell-deepwater-clan"],
    poolBefore,
  );
  const results =
    state.lastBattle?.events
      .filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === source.instanceId,
      )
      .map((event) => event.cardGainResult) ?? [];
  assert.deepEqual(results, ["added", "added", "handFull", "handFull"]);
});

test("AI Deathrattle rewards persist without leaking its hidden card identity", () => {
  let state = createGame(0xc170);
  const player = humanPlayer(state);
  player.board = [
    definitionMinion("BG35_801", "ai-reward-opponent", {
      attack: 100,
      health: 100,
    }),
  ];
  player.hand = [];
  const source = definitionMinion(
    "BG34_682",
    "ai-deathrattle-source",
    {
      attack: 0,
      health: 1,
      taunt: true,
      reborn: false,
    },
  );
  const opponent = keepOnlyOneOpponent(state, [source]);
  opponent.hand = [];

  state = gameReducer(state, { type: "END_TURN" });

  const nextOpponent = state.players.find(
    (candidate) => candidate.id === opponent.id,
  );
  assert.ok(nextOpponent);
  assert.equal(
    generatedSpells(
      nextOpponent,
      "tavern-spell-blood-gem-barrage",
    ).length,
    1,
  );
  const event = state.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorInstanceId === source.instanceId,
  );
  assert.ok(event);
  assert.equal(event.cardName, undefined);
  assert.equal(event.targetInstanceId, undefined);
  assert.equal(event.minion, undefined);
});

test("an eliminated ghost cannot gain Tavern Spells from a Deathrattle", () => {
  const state = createGame(0xc180);
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
        `ghost-spell-opponent-${index}`,
        { attack: 100, health: 100 },
      ),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.board = [
    definitionMinion("BG34_682", "ghost-spell-source", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  ghost.hand = [
    definitionMinion("BG25_001", "ghost-hand-sentinel"),
  ];
  const handBefore = JSON.parse(
    JSON.stringify(ghost.hand),
  ) as PlayerState["hand"];

  const combat = gameReducer(state, { type: "END_TURN" });

  assert.deepEqual(combat.players[3].hand, handBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === ghost.id,
    ),
    false,
  );
});

test("Trench Fighter generates Gem Confiscation at end of turn with Golden and hand-limit rules", () => {
  for (const [index, scenario] of [
    { golden: false, fillerCount: 0, expected: 1 },
    { golden: true, fillerCount: 0, expected: 2 },
    { golden: true, fillerCount: 9, expected: 1 },
    { golden: false, fillerCount: 10, expected: 0 },
  ].entries()) {
    let state = createGame(0xc190 + index);
    const player = humanPlayer(state);
    player.board = [
      definitionMinion("BG34_684", `trench-fighter-${index}`, {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG34_684_G" : "BG34_684",
        attack: 100,
        health: 100,
      }),
    ];
    player.hand = Array.from(
      { length: scenario.fillerCount },
      (_, fillerIndex) =>
        definitionMinion(
          "BG25_001",
          `trench-filler-${index}-${fillerIndex}`,
        ),
    );
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `trench-enemy-${index}`, {
        attack: 0,
        health: 100,
      }),
    ]);
    const poolBefore =
      state.spellPool["tavern-spell-gem-confiscation"];

    state = gameReducer(state, { type: "END_TURN" });

    assert.equal(
      generatedSpells(
        humanPlayer(state),
        "tavern-spell-gem-confiscation",
      ).length,
      scenario.expected,
    );
    assert.equal(
      state.spellPool["tavern-spell-gem-confiscation"],
      poolBefore,
    );
    assert.ok(humanPlayer(state).hand.length <= 10);
  }
});

test("Refreshing Anomaly grants real free Refreshes with Golden and Brann scaling", () => {
  let state = createGame(0xc1a0);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG_LOE_077", "refresh-brann"),
  ];
  player.hand = [
    definitionMinion("BGS_116", "golden-refreshing-anomaly", {
      golden: true,
      cardId: "TB_BaconUps_167",
    }),
  ];
  player.gold = 10;

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 8);

  for (let count = 0; count < 8; count += 1) {
    state = gameReducer(state, { type: "REFRESH_SHOP" });
  }
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 0);
  assert.equal(player.gold, 10);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).gold, 9);
});

test("Tavern Tempest draws matching Elementals from the shared pool and can chain four distinct gains", () => {
  let state = createGame(0xc1b0);
  let player = humanPlayer(state);
  player.tavernTier = 6;
  player.board = [];
  player.hand = [
    definitionMinion("BGS_123", "ordinary-tavern-tempest"),
  ];
  state.activeTribes = [
    "elemental",
    "beast",
    "mech",
    "demon",
    "dragon",
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BGS_115 = 1;

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  player = humanPlayer(state);
  assert.deepEqual(
    minionsInHand(player).map((minion) => minion.definitionId),
    ["BGS_115"],
  );
  assert.equal(state.pool.BGS_115, 0);

  state = createGame(0xc1b1);
  player = humanPlayer(state);
  player.tavernTier = 6;
  player.board = [
    definitionMinion("BG_LOE_077", "tempest-brann"),
  ];
  player.hand = [
    definitionMinion("BGS_123", "golden-tavern-tempest", {
      golden: true,
      cardId: "TB_BaconUps_162",
    }),
  ];
  state.activeTribes = [
    "elemental",
    "beast",
    "mech",
    "demon",
    "dragon",
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  const elementals = [
    "BGS_115",
    "BG31_815",
    "BG31_816",
    "BG31_818",
  ];
  for (const definitionId of elementals) {
    state.pool[definitionId] = 1;
  }

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  player = humanPlayer(state);
  assert.deepEqual(
    minionsInHand(player)
      .map((minion) => minion.definitionId)
      .sort(),
    [...elementals].sort(),
  );
  assert.ok(elementals.every((definitionId) => state.pool[definitionId] === 0));
});

test("Golden Eternal Summoner creates one Golden Eternal Knight per Deathrattle repetition", () => {
  for (const [index, scenario] of [
    { golden: false, titus: false, expected: 1 },
    { golden: true, titus: false, expected: 1 },
    { golden: true, titus: true, expected: 2 },
  ].entries()) {
    let state = createGame(0xc1c0 + index);
    const player = humanPlayer(state);
    const source = definitionMinion(
      "BG25_009",
      `eternal-summoner-${index}`,
      {
        golden: scenario.golden,
        cardId: scenario.golden ? "BG25_009_G" : "BG25_009",
        attack: 0,
        health: 1,
        taunt: true,
        reborn: false,
      },
    );
    player.board = [
      source,
      ...(scenario.titus
        ? [
            definitionMinion(
              "BG25_354",
              `eternal-titus-${index}`,
              { attack: 0, health: 1_000 },
            ),
          ]
        : []),
    ];
    player.hand = [];
    keepOnlyOneOpponent(
      state,
      Array.from({ length: scenario.titus ? 3 : 2 }, (_, enemyIndex) =>
        definitionMinion(
          "BG35_801",
          `eternal-enemy-${index}-${enemyIndex}`,
          { attack: 100, health: 100 },
        ),
      ),
    );
    const poolBefore = state.pool.BG25_008;

    state = gameReducer(state, { type: "END_TURN" });

    const summons =
      state.lastBattle?.events.filter(
        (event) =>
          event.type === "summon" &&
          event.actorInstanceId === source.instanceId &&
          event.minion?.definitionId === "BG25_008",
      ) ?? [];
    assert.equal(summons.length, scenario.expected);
    assert.ok(
      summons.every(
        (event) =>
          event.minion?.golden === scenario.golden,
      ),
    );
    assert.equal(
      state.pool.BG25_008,
      poolBefore,
      "combat summons never reserve collectible pool copies",
    );
  }
});
