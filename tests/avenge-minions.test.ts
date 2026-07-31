import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V25,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const CHROMAWING_DEFINITION_IDS = [
  "BG34_634t",
  "BG34_635t",
  "BG34_636t",
  "BG34_637t",
  "BG34_638t",
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
    stealth: definition.stealth === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
    bloodGemAttack: overrides.bloodGemAttack ?? 0,
    bloodGemHealth: overrides.bloodGemHealth ?? 0,
    temporaryAttack: overrides.temporaryAttack ?? 0,
    temporaryHealth: overrides.temporaryHealth ?? 0,
    temporaryTaunt: overrides.temporaryTaunt ?? false,
    temporaryDivineShield:
      overrides.temporaryDivineShield ?? false,
    temporaryCrabDeathrattles:
      overrides.temporaryCrabDeathrattles ?? 0,
  };
}

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return definitionMinion(definitionId, instanceId, {
    cardId: definition.goldenCardId ?? definition.cardId,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
}

const VICTIM_DEFINITION_IDS = [
  "BG20_100",
  "BG20_301",
  "BG24_009",
  "BG26_135",
  "BG26_529",
  "BG31_330",
] as const;

function victim(instanceId: string): BoardMinionInstance {
  const trailingNumber = Number(instanceId.match(/(\d+)$/)?.[1] ?? 0);
  const definitionId =
    VICTIM_DEFINITION_IDS[
      trailingNumber % VICTIM_DEFINITION_IDS.length
    ];
  return definitionMinion(definitionId, instanceId, {
    attack: 0,
    health: 1,
    taunt: true,
    reborn: false,
  });
}

function enemyWall(
  instanceId: string,
  attack = 1,
): BoardMinionInstance {
  return definitionMinion("BG29_611", instanceId, {
    attack,
    health: 1_000_000,
    taunt: true,
    reborn: false,
  });
}

function keepOnlyOneOpponent(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = undefined;
    }
  }
  const enemy = state.players[1];
  enemy.alive = true;
  enemy.health = 100;
  enemy.board = enemyBoard;
  return enemy;
}

function chromawingsInHand(
  player: PlayerState,
): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      CHROMAWING_DEFINITION_IDS.includes(
        card.definitionId as (typeof CHROMAWING_DEFINITION_IDS)[number],
      ),
  );
}

function tavernSpellsInHand(
  player: PlayerState,
  definitionId: string,
): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell" &&
      card.definitionId === definitionId,
  );
}

function boardIdentityAndStats(
  board: readonly BoardMinionInstance[],
): Array<{
  instanceId: string;
  definitionId: string;
  cardId: string;
  attack: number;
  health: number;
  golden: boolean;
}> {
  return board.map((minion) => ({
    instanceId: minion.instanceId,
    definitionId: minion.definitionId,
    cardId: minion.cardId,
    attack: minion.attack,
    health: minion.health,
    golden: minion.golden,
  }));
}

test("the first complete Avenge batch maps exact ordinary and Golden rules", () => {
  const researcher = getMinionDefinition("BG34_632");
  assert.equal(researcher.effectSupport, "complete");
  assert.equal(
    researcher.description,
    "复仇（3）：随机获取一张多彩幼龙。",
  );
  assert.equal(researcher.goldenCardId, "BG34_632_G");
  assert.equal(
    researcher.goldenDescription,
    "复仇（3）：随机获取2张多彩幼龙。",
  );
  assert.deepEqual(researcher.avenge, {
    threshold: 3,
    effects: [
      {
        kind: "gainRandomGeneratedMinion",
        definitionIds: CHROMAWING_DEFINITION_IDS,
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  });

  const butcher = getMinionDefinition("BG32_324");
  assert.equal(butcher.effectSupport, "complete");
  assert.equal(
    butcher.description,
    "复仇（3）：获取一张宰割。",
  );
  assert.equal(butcher.goldenCardId, "BG32_324_G");
  assert.equal(
    butcher.goldenDescription,
    "复仇（3）：获取2张宰割。",
  );
  assert.deepEqual(butcher.avenge, {
    threshold: 3,
    effects: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-slaughter",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  });

  const magnate = getMinionDefinition("BG34_403");
  assert.equal(magnate.effectSupport, "complete");
  assert.equal(
    magnate.description,
    "复仇（5）：召唤一个永恒骑士并使其立即发起攻击。",
  );
  assert.equal(magnate.goldenCardId, "BG34_403_G");
  assert.equal(
    magnate.goldenDescription,
    "复仇（5）：召唤一个金色永恒骑士并使其立即发起攻击。",
  );
  assert.deepEqual(magnate.avenge, {
    threshold: 5,
    effects: [
      {
        kind: "summon",
        definitionId: "BG25_008",
        count: 1,
        immediateAttack: true,
        goldenMode: "goldenToken",
      },
    ],
  });

  const composer = getMinionDefinition("BG26_157");
  assert.equal(composer.effectSupport, "complete");
  assert.equal(
    composer.description,
    "复仇（2）：本随从对你的所有野猪人各使用2张鲜血宝石。",
  );
  assert.equal(composer.goldenCardId, "BG26_157_G");
  assert.equal(
    composer.goldenDescription,
    "复仇（2）：本随从对你的所有野猪人各使用4张鲜血宝石。",
  );
  assert.deepEqual(composer.avenge, {
    threshold: 2,
    effects: [
      {
        kind: "applyBloodGemsToTribe",
        tribe: "quilboar",
        count: 2,
      },
    ],
  });

  for (const definition of [
    researcher,
    butcher,
    magnate,
    composer,
  ]) {
    assert.deepEqual(definition.printedMechanics, ["AVENGE"]);
  }
});

test("Incubation Researcher counts independent Avenge cycles and generates ordinary Chromawings without touching the pool", () => {
  const scenarios = [
    { golden: false, deathCount: 3, expectedTriggers: 1, expectedCards: 1 },
    { golden: true, deathCount: 3, expectedTriggers: 1, expectedCards: 2 },
    { golden: false, deathCount: 6, expectedTriggers: 2, expectedCards: 2 },
  ] as const;

  for (const [caseIndex, scenario] of scenarios.entries()) {
    const state = createGame(0xa700 + caseIndex);
    const human = humanPlayer(state);
    const researcher = scenario.golden
      ? goldenMinion(
          "BG34_632",
          `researcher-${caseIndex}`,
          { attack: 0, health: 1_000_000 },
        )
      : definitionMinion(
          "BG34_632",
          `researcher-${caseIndex}`,
          { attack: 0, health: 1_000_000 },
        );
    human.board = [
      researcher,
      ...Array.from({ length: scenario.deathCount }, (_, index) =>
        victim(`researcher-victim-${caseIndex}-${index}`),
      ),
    ];
    const poolBefore = Object.fromEntries(
      CHROMAWING_DEFINITION_IDS.map((definitionId) => [
        definitionId,
        state.pool[definitionId],
      ]),
    );
    const permanentBoard = structuredClone(human.board);
    keepOnlyOneOpponent(state, [
      enemyWall(`researcher-enemy-${caseIndex}`),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const nextHuman = humanPlayer(combat);
    const gained = chromawingsInHand(nextHuman);
    assert.equal(gained.length, scenario.expectedCards);
    assert.ok(
      gained.every(
        (minion) => !minion.golden && minion.poolCopies === 0,
      ),
    );
    assert.deepEqual(
      Object.fromEntries(
        CHROMAWING_DEFINITION_IDS.map((definitionId) => [
          definitionId,
          combat.pool[definitionId],
        ]),
      ),
      poolBefore,
    );
    assert.deepEqual(
      boardIdentityAndStats(nextHuman.board),
      boardIdentityAndStats(permanentBoard),
    );

    const events = combat.lastBattle?.events ?? [];
    const avengeEvents = events.filter(
      (event) =>
        event.type === "avenge" &&
        event.actorInstanceId === researcher.instanceId,
    );
    const gainEvents = events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === researcher.instanceId &&
        event.cardGainResult === "added",
    );
    assert.equal(avengeEvents.length, scenario.expectedTriggers);
    assert.equal(gainEvents.length, scenario.expectedCards);
    assert.ok(avengeEvents[0].index < gainEvents[0].index);
  }
});

test("Golden Incubation Researcher resolves one open hand slot before reporting the second gain as full", () => {
  const state = createGame(0xa710);
  const human = humanPlayer(state);
  const researcher = goldenMinion(
    "BG34_632",
    "full-hand-researcher",
    { attack: 0, health: 1_000_000 },
  );
  human.board = [
    researcher,
    victim("full-hand-researcher-victim-1"),
    victim("full-hand-researcher-victim-2"),
    victim("full-hand-researcher-victim-3"),
  ];
  const fillerIds = [
    "BG25_001",
    "BG25_008",
    "BG25_009",
    "BG25_010",
    "BG25_011",
    "BG25_013",
    "BG25_016",
    "BG25_022",
    "BG25_041",
  ];
  human.hand = fillerIds.map((definitionId, index) =>
    definitionMinion(
      definitionId,
      `full-hand-filler-${index}`,
    ),
  );
  keepOnlyOneOpponent(state, [
    enemyWall("full-hand-researcher-enemy"),
  ]);
  human.hand = fillerIds.map((definitionId, index) =>
    definitionMinion(
      definitionId,
      `full-hand-filler-${index}`,
    ),
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(combat);
  assert.equal(nextHuman.hand.length, 10);
  assert.equal(chromawingsInHand(nextHuman).length, 1);
  const gainEvents =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === researcher.instanceId,
    ) ?? [];
  assert.deepEqual(
    gainEvents.map((event) => event.cardGainResult),
    ["added", "handFull"],
  );
});

test("ordinary Avenge progress resets between combats", () => {
  let state = createGame(0xa711);
  let human = humanPlayer(state);
  const researcher = definitionMinion(
    "BG34_632",
    "reset-researcher",
    { attack: 0, health: 1_000_000 },
  );
  human.board = [
    researcher,
    victim("reset-first-victim-1"),
    victim("reset-first-victim-2"),
  ];
  keepOnlyOneOpponent(state, [
    enemyWall("reset-first-enemy"),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(chromawingsInHand(humanPlayer(state)).length, 0);

  state = gameReducer(state, { type: "CONTINUE" });
  human = humanPlayer(state);
  human.board = [
    researcher,
    victim("reset-second-victim"),
  ];
  const enemy = state.players[1];
  enemy.gold = 0;
  enemy.hand = [];
  enemy.shop = [];
  enemy.spellShop = null;
  enemy.additionalSpellShop = [];
  enemy.board = [enemyWall("reset-second-enemy")];

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(chromawingsInHand(humanPlayer(state)).length, 0);
  assert.equal(
    state.lastBattle?.events.some(
      (event) =>
        event.type === "avenge" &&
        event.actorInstanceId === researcher.instanceId,
    ),
    false,
  );
});

test("an Avenge source that dies in the same cleave wave cannot trigger", () => {
  const state = createGame(0xa712);
  const human = humanPlayer(state);
  const researcher = definitionMinion(
    "BG34_632",
    "doomed-researcher",
    { attack: 0, health: 1, taunt: true },
  );
  human.board = [
    definitionMinion("BG35_801", "doomed-left", {
      attack: 0,
      health: 1,
      taunt: false,
    }),
    researcher,
    definitionMinion("BG35_801", "doomed-right", {
      attack: 0,
      health: 1,
      taunt: false,
    }),
  ];
  keepOnlyOneOpponent(state, [
    enemyWall("doomed-researcher-enemy", 10),
  ]).board[0].cleave = true;

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(chromawingsInHand(humanPlayer(combat)).length, 0);
  assert.equal(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "avenge" &&
        event.actorInstanceId === researcher.instanceId,
    ),
    false,
  );
});

test("a Reborn minion's original and second deaths each advance Avenge", () => {
  const state = createGame(0xa713);
  const human = humanPlayer(state);
  const researcher = definitionMinion(
    "BG34_632",
    "reborn-researcher",
    {
      attack: 0,
      health: 1_000_000,
      stealth: true,
    },
  );
  const rebornVictim = definitionMinion(
    "BG25_008",
    "reborn-avenge-victim",
    {
      attack: 0,
      health: 1,
      taunt: true,
      reborn: true,
    },
  );
  human.board = [
    researcher,
    rebornVictim,
    victim("reborn-avenge-other-victim"),
  ];
  keepOnlyOneOpponent(state, [
    enemyWall("reborn-avenge-enemy"),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(chromawingsInHand(humanPlayer(combat)).length, 1);
  const deaths =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "death" &&
        event.actorPlayerId === human.id,
    ) ?? [];
  assert.equal(
    deaths.filter(
      (event) =>
        event.minion?.definitionId === rebornVictim.definitionId,
    ).length,
    2,
  );
});

test("Drustfallen Butcher gains real Slaughter spells without casting or reserving them", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xa720 + caseIndex);
    const human = humanPlayer(state);
    const butcher = golden
      ? goldenMinion(
          "BG32_324",
          `butcher-${caseIndex}`,
          { attack: 0, health: 1_000_000 },
        )
      : definitionMinion(
          "BG32_324",
          `butcher-${caseIndex}`,
          { attack: 0, health: 1_000_000 },
        );
    human.board = [
      butcher,
      victim(`butcher-victim-${caseIndex}-1`),
      victim(`butcher-victim-${caseIndex}-2`),
      victim(`butcher-victim-${caseIndex}-3`),
    ];
    human.tavernSpellsCastThisTurn = 4;
    const poolBefore =
      state.spellPool["tavern-spell-slaughter"];
    keepOnlyOneOpponent(state, [
      enemyWall(`butcher-enemy-${caseIndex}`),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const nextHuman = humanPlayer(combat);
    const spells = tavernSpellsInHand(
      nextHuman,
      "tavern-spell-slaughter",
    );
    assert.equal(spells.length, golden ? 2 : 1);
    assert.ok(
      spells.every(
        (spell) =>
          spell.cardId === "BG28_604" &&
          spell.cost === 2 &&
          spell.target === "friendly",
      ),
    );
    assert.equal(
      combat.spellPool["tavern-spell-slaughter"],
      poolBefore,
    );
    assert.equal(nextHuman.tavernSpellsCastThisTurn, 4);
    assert.equal(
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "tavernSpellCast" &&
          event.actorInstanceId === butcher.instanceId,
      ).length,
      0,
    );
  }
});

test("Eternal Magnate summons exactly one ordinary or Golden Eternal Knight and makes it attack immediately", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xa730 + caseIndex);
    const human = humanPlayer(state);
    human.eternalKnightsDied = 2;
    const magnate = golden
      ? goldenMinion(
          "BG34_403",
          `magnate-${caseIndex}`,
          { attack: 0, health: 1_000_000 },
        )
      : definitionMinion(
          "BG34_403",
          `magnate-${caseIndex}`,
          { attack: 0, health: 1_000_000 },
        );
    human.board = [
      magnate,
      ...Array.from({ length: 5 }, (_, index) =>
        victim(`magnate-victim-${caseIndex}-${index}`),
      ),
    ];
    const permanentBoard = structuredClone(human.board);
    const poolBefore = state.pool.BG25_008;
    keepOnlyOneOpponent(state, [
      enemyWall(`magnate-enemy-${caseIndex}`, 100),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const events = combat.lastBattle?.events ?? [];
    const avenge = events.find(
      (event) =>
        event.type === "avenge" &&
        event.actorInstanceId === magnate.instanceId,
    );
    const summons = events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === magnate.instanceId &&
        event.minion?.definitionId === "BG25_008",
    );
    assert.ok(avenge);
    assert.equal(summons.length, 1);
    const summon = summons[0];
    assert.ok(summon.minion);
    assert.equal(summon.minion.golden, golden);
    assert.equal(
      summon.minion.cardId,
      golden ? "BG25_008_G" : "BG25_008",
    );
    assert.deepEqual(
      [summon.minion.attack, summon.minion.health],
      golden ? [24, 12] : [12, 6],
    );
    const immediateAttack = events.find(
      (event) =>
        event.type === "attack" &&
        event.actorInstanceId === summon.targetInstanceId,
    );
    assert.ok(immediateAttack);
    assert.ok(avenge.index < summon.index);
    assert.ok(summon.index < immediateAttack.index);
    assert.equal(combat.pool.BG25_008, poolBefore);
    assert.equal(humanPlayer(combat).eternalKnightsDied, 3);
    assert.deepEqual(
      boardIdentityAndStats(humanPlayer(combat).board),
      boardIdentityAndStats(permanentBoard),
    );
  }
});

test("Bristlemane Scrapsmith applies every current Blood Gem separately to every Quilboar only for combat", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xa740 + caseIndex);
    const human = humanPlayer(state);
    human.bloodGemAttack = 2;
    human.bloodGemHealth = 3;
    const composer = golden
      ? goldenMinion(
          "BG26_157",
          `composer-${caseIndex}`,
          { attack: 0, health: 10_000 },
        )
      : definitionMinion(
          "BG26_157",
          `composer-${caseIndex}`,
          { attack: 0, health: 10_000 },
        );
    const quilboar = definitionMinion(
      "BG23_018",
      `composer-quilboar-${caseIndex}`,
      { attack: 10, health: 10_000 },
    );
    const amalgam = definitionMinion(
      "BG29_611",
      `composer-amalgam-${caseIndex}`,
      {
        tribe: "all",
        tribes: ["all"],
        attack: 10,
        health: 10_000,
      },
    );
    const outsider = definitionMinion(
      "BG35_801",
      `composer-outsider-${caseIndex}`,
      { attack: 10, health: 10_000 },
    );
    human.board = [
      composer,
      quilboar,
      amalgam,
      outsider,
      victim(`composer-victim-${caseIndex}-1`),
      victim(`composer-victim-${caseIndex}-2`),
    ];
    const permanentBoard = structuredClone(human.board);
    keepOnlyOneOpponent(state, [
      enemyWall(`composer-enemy-${caseIndex}`),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const applications = golden ? 4 : 2;
    const buffEvents =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === composer.instanceId &&
          event.message.includes("鲜血宝石"),
      ) ?? [];
    assert.equal(buffEvents.length, applications * 3);
    for (const target of [composer, quilboar, amalgam]) {
      const targetEvents = buffEvents.filter(
        (event) =>
          event.targetInstanceId === target.instanceId,
      );
      assert.equal(targetEvents.length, applications);
      assert.ok(
        targetEvents.every(
          (event) =>
            event.attackDelta === 2 &&
            event.healthDelta === 3,
        ),
      );
      const finalSnapshot =
        targetEvents[targetEvents.length - 1].minion;
      assert.ok(finalSnapshot);
      assert.equal(
        finalSnapshot.bloodGemAttack,
        applications * 2,
      );
      assert.equal(
        finalSnapshot.bloodGemHealth,
        applications * 3,
      );
    }
    assert.equal(
      buffEvents.some(
        (event) =>
          event.targetInstanceId === outsider.instanceId,
      ),
      false,
    );
    assert.deepEqual(
      boardIdentityAndStats(humanPlayer(combat).board),
      boardIdentityAndStats(permanentBoard),
    );
  }
});

test("AI Avenge rewards persist without exposing hidden card identity", () => {
  const state = createGame(0xa750);
  const human = humanPlayer(state);
  const enemy = keepOnlyOneOpponent(state, []);
  const researcher = definitionMinion(
    "BG34_632",
    "ai-researcher",
    { attack: 0, health: 1_000_000 },
  );
  enemy.board = [
    researcher,
    victim("ai-researcher-victim-1"),
    victim("ai-researcher-victim-2"),
    victim("ai-researcher-victim-3"),
  ];
  human.board = [enemyWall("ai-researcher-human-wall")];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.equal(chromawingsInHand(nextEnemy).length, 1);
  const gain = combat.lastBattle?.events.find(
    (event) =>
      event.type === "cardGain" &&
      event.actorPlayerId === enemy.id &&
      event.actorInstanceId === researcher.instanceId &&
      event.cardGainResult === "added",
  );
  assert.ok(gain);
  assert.equal(gain.cardName, undefined);
  assert.equal(gain.minion, undefined);
  assert.equal(gain.targetInstanceId, undefined);
});

test("ghost hand rewards are isolated while combat-only Avenge effects still animate", () => {
  const state = createGame(0xa760);
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
      enemyWall(`ghost-reward-opponent-${index}`),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const researcher = goldenMinion(
    "BG34_632",
    "ghost-researcher",
    { attack: 0, health: 1_000_000 },
  );
  const butcher = goldenMinion(
    "BG32_324",
    "ghost-butcher",
    { attack: 0, health: 1_000_000 },
  );
  ghost.board = [
    researcher,
    butcher,
    victim("ghost-reward-victim-1"),
    victim("ghost-reward-victim-2"),
    victim("ghost-reward-victim-3"),
  ];
  const handBefore = structuredClone(ghost.hand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.hand, handBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  for (const source of [researcher, butcher]) {
    assert.ok(
      ghostBattle.events.some(
        (event) =>
          event.type === "avenge" &&
          event.actorInstanceId === source.instanceId,
      ),
    );
  }
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === ghost.id,
    ),
    false,
  );
});

test("ghost Eternal Magnate and Bristlemane Scrapsmith resolve visible combat effects without permanent writes", () => {
  const state = createGame(0xa761);
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
      enemyWall(`ghost-effect-opponent-${index}`, 100),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.eternalKnightsDied = 2;
  ghost.bloodGemAttack = 2;
  ghost.bloodGemHealth = 3;
  const magnate = definitionMinion(
    "BG34_403",
    "ghost-magnate",
    { attack: 0, health: 1_000_000 },
  );
  const composer = definitionMinion(
    "BG26_157",
    "ghost-composer",
    { attack: 0, health: 1_000_000 },
  );
  ghost.board = [
    magnate,
    composer,
    victim("ghost-effect-victim-1"),
    victim("ghost-effect-victim-2"),
    victim("ghost-effect-victim-3"),
    victim("ghost-effect-victim-4"),
    victim("ghost-effect-victim-5"),
  ];
  const boardBefore = structuredClone(ghost.board);
  const deathsBefore = ghost.eternalKnightsDied;

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.equal(nextGhost.eternalKnightsDied, deathsBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const summonedKnight = ghostBattle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === magnate.instanceId &&
      event.minion?.definitionId === "BG25_008",
  );
  assert.ok(summonedKnight);
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "attack" &&
        event.actorInstanceId === summonedKnight.targetInstanceId,
    ),
  );
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === composer.instanceId &&
        event.message.includes("鲜血宝石"),
    ),
  );
});

test("v25 saves migrate to v26 with complete Avenge metadata and no persisted combat progress", () => {
  const legacy = structuredClone(createGame(0xa770));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V25;
  const player = humanPlayer(legacy);
  const researcher = goldenMinion(
    "BG34_632",
    "legacy-golden-researcher",
    {
      cardId: "BG34_632",
      description:
        "复仇（3）：随机获取一张多彩幼龙。",
      effectSupport: "partial",
      attack: 31,
      health: 37,
      effectCounters: { existingCounter: 9 },
    },
  );
  const butcher = definitionMinion(
    "BG32_324",
    "legacy-butcher",
    { effectSupport: "partial", attack: 41, health: 43 },
  );
  const magnate = goldenMinion(
    "BG34_403",
    "legacy-golden-magnate",
    {
      cardId: "BG34_403",
      description:
        "复仇（5）：召唤一个永恒骑士并使其立即发起攻击。",
      effectSupport: "partial",
      attack: 47,
      health: 53,
    },
  );
  const composer = definitionMinion(
    "BG26_157",
    "legacy-composer",
    { effectSupport: "partial", attack: 59, health: 61 },
  );
  player.board = [researcher, butcher];
  player.hand = [magnate];
  player.shop = [composer];
  player.bloodGemAttack = 5;
  player.bloodGemHealth = 7;

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  );
  assert.ok(migrated !== null && typeof migrated === "object");
  const migratedState = migrated as GameState;
  assert.equal(
    migratedState.contentVersion,
    CURRENT_ROSTER_VERSION,
  );
  const nextPlayer = humanPlayer(migratedState);
  const refreshed = [
    ...nextPlayer.board,
    ...nextPlayer.hand.filter(
      (card): card is BoardMinionInstance =>
        card.kind === "minion",
    ),
    ...nextPlayer.shop,
  ];
  assert.deepEqual(
    refreshed.map((minion) => minion.effectSupport),
    ["complete", "complete", "complete", "complete"],
  );
  assert.deepEqual(
    refreshed.map((minion) => [
      minion.instanceId,
      minion.attack,
      minion.health,
    ]),
    [
      ["legacy-golden-researcher", 31, 37],
      ["legacy-butcher", 41, 43],
      ["legacy-golden-magnate", 47, 53],
      ["legacy-composer", 59, 61],
    ],
  );
  assert.equal(
    refreshed[0].cardId,
    "BG34_632_G",
  );
  assert.equal(
    refreshed[0].description,
    "复仇（3）：随机获取2张多彩幼龙。",
  );
  assert.deepEqual(
    refreshed[0].effectCounters,
    { existingCounter: 9 },
  );
  assert.equal(
    refreshed[2].cardId,
    "BG34_403_G",
  );
  assert.equal(
    refreshed[2].description,
    "复仇（5）：召唤一个金色永恒骑士并使其立即发起攻击。",
  );
  assert.deepEqual(
    [nextPlayer.bloodGemAttack, nextPlayer.bloodGemHealth],
    [5, 7],
  );
  assert.equal(
    "avengeProgress" in (nextPlayer as unknown as Record<string, unknown>),
    false,
  );
});
