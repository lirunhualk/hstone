import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { combatTriggerLabel } from "../lib/game/combat-presentation.ts";
import {
  createGame,
  gameReducer,
  scoreMinionForAi,
  type BattleEvent,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { projectCombatBoard } from "../lib/game/playback.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V31,
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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    ...overrides,
  };
}

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId ?? definition.cardId,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    ...overrides,
  });
}

function enemyWall(
  instanceId: string,
  attack = 100,
): BoardMinionInstance {
  return definitionMinion("BG35_801", instanceId, {
    attack,
    health: 1_000_000,
    taunt: true,
  });
}

function isolateCombat(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = undefined;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
    }
  }
  const human = humanPlayer(state);
  human.alive = true;
  human.health = 100;
  human.armor = 0;
  human.board = humanBoard;
  const enemy = state.players[1];
  enemy.alive = true;
  enemy.health = 100;
  enemy.armor = 0;
  enemy.board = enemyBoard;
  return enemy;
}

test("the three fixed-build Beetle growers expose exact normal and Golden rules", () => {
  const rover = getMinionDefinition("BG31_801");
  assert.equal(rover.name, "森林游虫");
  assert.equal(rover.effectSupport, "complete");
  assert.equal(rover.goldenCardId, "BG31_801_G");
  assert.equal(
    rover.goldenDescription,
    "战吼：在本局对战中，你的甲虫拥有+4/+2。\n亡语：召唤两只2/2的甲虫。",
  );
  assert.deepEqual(rover.battlecry, [
    { kind: "improveBeetles", attack: 2, health: 1 },
  ]);
  assert.deepEqual(rover.deathrattle, [
    {
      kind: "summon",
      definitionId: "live-beetle-token",
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);

  const skitterer = getMinionDefinition("BG31_809");
  assert.equal(skitterer.name, "绿松石飞掠虫");
  assert.equal(skitterer.effectSupport, "complete");
  assert.equal(skitterer.goldenCardId, "BG31_809_G");
  assert.equal(
    skitterer.goldenDescription,
    "亡语：在本局对战中，你的甲虫拥有+10/+10。召唤两只2/2的甲虫。",
  );
  assert.deepEqual(skitterer.deathrattle, [
    { kind: "improveBeetles", attack: 5, health: 5 },
    {
      kind: "summon",
      definitionId: "live-beetle-token",
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);

  const silkflitter = getMinionDefinition("BG32_204");
  assert.equal(silkflitter.name, "丝柔烁光蛾");
  assert.equal(silkflitter.effectSupport, "complete");
  assert.equal(silkflitter.goldenCardId, "BG32_204_G");
  assert.equal(
    silkflitter.goldenDescription,
    "每当本随从受到伤害，在本局对战中，你的甲虫拥有+4/+4。亡语：召唤两只2/2的甲虫。",
  );
  assert.deepEqual(silkflitter.afterSelfDamaged, [
    { kind: "improveBeetles", attack: 2, health: 2 },
  ]);
  assert.deepEqual(silkflitter.deathrattle, [
    {
      kind: "summon",
      definitionId: "live-beetle-token",
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);
});

test("Forest Rover permanently improves current and future Beetles, including Brann and Golden scaling", () => {
  {
    let state = createGame(0xb3201);
    const player = humanPlayer(state);
    const beetle = definitionMinion(
      "live-beetle-token",
      "recruit-existing-beetle",
    );
    player.board = [beetle];
    player.hand = [
      definitionMinion("BG31_801", "normal-forest-rover"),
    ];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
    });
    const next = humanPlayer(state);
    assert.deepEqual(
      [next.beetleAttackBonus, next.beetleHealthBonus],
      [2, 1],
    );
    const improved = next.board.find(
      (minion) => minion.instanceId === beetle.instanceId,
    );
    assert.ok(improved);
    assert.deepEqual([improved.attack, improved.health], [4, 3]);
  }

  {
    let state = createGame(0xb3202);
    const player = humanPlayer(state);
    player.board = [
      definitionMinion("BG_LOE_077", "normal-brann"),
    ];
    player.hand = [
      goldenMinion("BG31_801", "golden-forest-rover"),
    ];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
    });
    assert.deepEqual(
      [
        humanPlayer(state).beetleAttackBonus,
        humanPlayer(state).beetleHealthBonus,
      ],
      [8, 4],
    );
  }
});

test("Recruit-phase Beetle Deathrattles summon with the current global growth", () => {
  for (const {
    seed,
    definitionId,
    instanceId,
    expectedBonus,
    expectedStats,
  } of [
    {
      seed: 0xb32f1,
      definitionId: "BG31_801",
      instanceId: "stir-forest-rover",
      expectedBonus: [2, 1],
      expectedStats: [4, 3],
    },
    {
      seed: 0xb32f2,
      definitionId: "BG31_809",
      instanceId: "stir-turquoise-skitterer",
      expectedBonus: [5, 5],
      expectedStats: [7, 7],
    },
  ] as const) {
    let state = createGame(seed);
    let player = humanPlayer(state);
    player.board = [];
    player.hand = [
      definitionMinion(definitionId, instanceId, {
        destroyAfterPlayThroughRound: state.round,
      }),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: instanceId,
    });
    player = humanPlayer(state);
    assert.deepEqual(
      [player.beetleAttackBonus, player.beetleHealthBonus],
      expectedBonus,
    );
    assert.equal(player.board.length, 1);
    assert.equal(
      player.board[0].definitionId,
      "live-beetle-token",
    );
    assert.deepEqual(
      [player.board[0].attack, player.board[0].health],
      expectedStats,
    );
  }
});

test("fresh original Beetle copies read the global ledger and triples merge it only once", () => {
  {
    const state = createGame(0xb32f3);
    isolateCombat(
      state,
      [
        definitionMinion("live-beetle-token", "grown-beetle", {
          attack: 7,
          health: 7,
        }),
        definitionMinion("BG26_199", "beetle-copy-duo", {
          attack: 0,
          health: 1_000_000,
          effectCounters: { periodicEndOfTurn: 1 },
        }),
      ],
      [enemyWall("beetle-copy-wall", 0)],
    );
    const player = humanPlayer(state);
    player.beetleAttackBonus = 5;
    player.beetleHealthBonus = 5;

    const combat = gameReducer(state, { type: "END_TURN" });
    const copy = humanPlayer(combat).hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.definitionId === "live-beetle-token",
    );
    assert.ok(copy);
    assert.deepEqual([copy.attack, copy.health], [7, 7]);
  }

  {
    let state = createGame(0xb32f4);
    const player = humanPlayer(state);
    player.beetleAttackBonus = 2;
    player.beetleHealthBonus = 1;
    player.board = [
      definitionMinion("live-beetle-token", "triple-beetle-1", {
        attack: 4,
        health: 3,
      }),
      definitionMinion("live-beetle-token", "triple-beetle-2", {
        attack: 4,
        health: 3,
      }),
    ];
    player.hand = [
      definitionMinion("live-beetle-token", "triple-beetle-3", {
        attack: 4,
        health: 3,
      }),
    ];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
    });
    const golden = humanPlayer(state).hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.definitionId === "live-beetle-token" &&
        card.golden,
    );
    assert.ok(golden);
    assert.deepEqual([golden.attack, golden.health], [6, 5]);
  }
});

test("Turquoise Skitterer improves existing Beetles before summoning the upgraded token", () => {
  const state = createGame(0xb3203);
  const source = definitionMinion(
    "BG31_809",
    "turquoise-source",
    { attack: 1, health: 1 },
  );
  const existing = definitionMinion(
    "live-beetle-token",
    "turquoise-existing-beetle",
  );
  isolateCombat(state, [source, existing], [
    enemyWall("turquoise-enemy"),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const trigger = battle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId,
  );
  const buff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === existing.instanceId,
  );
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.ok(trigger);
  assert.ok(buff);
  assert.ok(summon);
  assert.deepEqual([trigger.attackDelta, trigger.healthDelta], [5, 5]);
  assert.equal(combatTriggerLabel(trigger), "本局永久 +5/+5");
  const sourceDuringTrigger = projectCombatBoard(
    battle.initialBoards[state.humanPlayerId].filter(
      (minion): minion is BoardMinionInstance =>
        minion.kind === "minion",
    ),
    state.humanPlayerId,
    battle.events.slice(0, trigger.index + 1),
  ).find((minion) => minion.instanceId === source.instanceId);
  assert.ok(sourceDuringTrigger);
  assert.equal(sourceDuringTrigger.health, 0);
  assert.deepEqual([buff.minion?.attack, buff.minion?.health], [7, 7]);
  assert.deepEqual(
    [summon.minion?.attack, summon.minion?.health],
    [7, 7],
  );
  assert.ok(trigger.index < buff.index);
  assert.ok(buff.index < summon.index);
  assert.deepEqual(
    [
      humanPlayer(combat).beetleAttackBonus,
      humanPlayer(combat).beetleHealthBonus,
    ],
    [5, 5],
  );
});

test("combat growth writes back to dead board Beetles and held Beetles without reapplying next Recruit", () => {
  const state = createGame(0xb32f5);
  const existing = definitionMinion(
    "live-beetle-token",
    "dead-before-beetle-growth",
  );
  const source = definitionMinion(
    "BG32_204",
    "later-damaged-silkflitter",
    { attack: 1, health: 1 },
  );
  isolateCombat(state, [existing, source], [
    enemyWall("persistent-beetle-wall", 100),
  ]);
  const held = definitionMinion(
    "live-beetle-token",
    "held-during-beetle-growth",
  );
  humanPlayer(state).hand = [held];

  const combat = gameReducer(state, { type: "END_TURN" });
  const player = humanPlayer(combat);
  assert.deepEqual(
    [player.beetleAttackBonus, player.beetleHealthBonus],
    [2, 2],
  );
  const persisted = player.board.find(
    (minion) => minion.instanceId === existing.instanceId,
  );
  const persistedHeld = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.instanceId === held.instanceId,
  );
  assert.ok(persisted);
  assert.ok(persistedHeld);
  assert.deepEqual([persisted.attack, persisted.health], [4, 4]);
  assert.deepEqual(
    [persistedHeld.attack, persistedHeld.health],
    [4, 4],
  );

  const recruit = gameReducer(combat, { type: "CONTINUE" });
  const unchanged = humanPlayer(recruit).board.find(
    (minion) => minion.instanceId === existing.instanceId,
  );
  assert.ok(unchanged);
  assert.deepEqual([unchanged.attack, unchanged.health], [4, 4]);
});

test("playback restores every dead Beetle-growth source in a simultaneous death batch", () => {
  const state = createGame(0xb32f7);
  const sources = [
    definitionMinion("BG31_809", "batch-dead-skitterer-1", {
      attack: 1,
      health: 1,
    }),
    definitionMinion("BG31_809", "batch-dead-skitterer-2", {
      attack: 1,
      health: 1,
    }),
  ];
  isolateCombat(
    state,
    sources,
    [
      definitionMinion("BG_DAL_775", "batch-death-blaster", {
        attack: 0,
        health: 1,
        taunt: true,
      }),
    ],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const openingBoard = battle.initialBoards[
    state.humanPlayerId
  ].filter(
    (minion): minion is BoardMinionInstance =>
      minion.kind === "minion",
  );
  for (const source of sources) {
    const trigger: BattleEvent | undefined = battle.events.find(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.ok(trigger);
    const projectedSource: BoardMinionInstance | undefined =
      projectCombatBoard(
        openingBoard,
        state.humanPlayerId,
        battle.events.slice(0, trigger.index + 1),
      ).find(
        (minion) => minion.instanceId === source.instanceId,
      );
    assert.ok(projectedSource);
    assert.equal(projectedSource.health, 0);
  }
});

test("Titus repeats the complete Turquoise Skitterer growth-then-summon package", () => {
  const state = createGame(0xb3204);
  const source = definitionMinion(
    "BG31_809",
    "titus-turquoise-source",
    { attack: 1, health: 1 },
  );
  isolateCombat(
    state,
    [
      source,
      definitionMinion("BG25_354", "normal-titus", {
        attack: 0,
        health: 1_000_000,
      }),
    ],
    [enemyWall("titus-turquoise-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const triggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId,
  );
  const summons = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.equal(triggers.length, 2);
  assert.equal(summons.length, 2);
  const sourceDuringSecondTrigger = projectCombatBoard(
    battle.initialBoards[state.humanPlayerId].filter(
      (minion): minion is BoardMinionInstance =>
        minion.kind === "minion",
    ),
    state.humanPlayerId,
    battle.events.slice(0, triggers[1].index + 1),
  ).find((minion) => minion.instanceId === source.instanceId);
  assert.ok(sourceDuringSecondTrigger);
  assert.equal(sourceDuringSecondTrigger.health, 0);
  assert.deepEqual(
    summons.map((event) => [
      event.minion?.attack,
      event.minion?.health,
    ]),
    [
      [7, 7],
      [12, 12],
    ],
  );
  assert.deepEqual(
    [
      humanPlayer(combat).beetleAttackBonus,
      humanPlayer(combat).beetleHealthBonus,
    ],
    [10, 10],
  );
});

test("Golden Silkflitter grows Beetles on real damage and then summons two upgraded Beetles", () => {
  const state = createGame(0xb3205);
  const source = goldenMinion(
    "BG32_204",
    "golden-silkflitter",
    { attack: 1, health: 1 },
  );
  const existing = definitionMinion(
    "live-beetle-token",
    "silkflitter-existing-beetle",
  );
  isolateCombat(state, [source, existing], [
    enemyWall("silkflitter-enemy"),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const triggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId,
  );
  const summons = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.equal(triggers.length, 1);
  assert.deepEqual(
    [triggers[0].attackDelta, triggers[0].healthDelta],
    [4, 4],
  );
  assert.equal(summons.length, 2);
  assert.ok(
    summons.every(
      (event) =>
        event.minion?.attack === 6 &&
        event.minion.health === 6,
    ),
  );
  const existingBuff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === existing.instanceId &&
      event.actorInstanceId === source.instanceId,
  );
  assert.deepEqual(
    [existingBuff?.minion?.attack, existingBuff?.minion?.health],
    [6, 6],
  );
  assert.deepEqual(
    [
      humanPlayer(combat).beetleAttackBonus,
      humanPlayer(combat).beetleHealthBonus,
    ],
    [4, 4],
  );
});

test("simultaneous area damage resolves before Silkflitter can grow a hit Beetle", () => {
  const state = createGame(0xb32f6);
  const blaster = definitionMinion(
    "BG_DAL_775",
    "beetle-batch-blaster",
    { attack: 0, health: 1, taunt: true },
  );
  const silkflitter = definitionMinion(
    "BG32_204",
    "beetle-batch-silkflitter",
  );
  const beetle = definitionMinion(
    "live-beetle-token",
    "beetle-batch-target",
  );
  isolateCombat(
    state,
    [blaster, silkflitter, beetle],
    [
      enemyWall("beetle-batch-wall-1", 100),
      enemyWall("beetle-batch-wall-2", 100),
      enemyWall("beetle-batch-wall-3", 100),
      enemyWall("beetle-batch-wall-4", 100),
    ],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const beetleDamage = battle.events.find(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === blaster.instanceId &&
      event.targetInstanceId === beetle.instanceId &&
      event.amount === 3,
  );
  const silkTrigger = battle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === silkflitter.instanceId,
  );
  assert.ok(beetleDamage);
  assert.ok(silkTrigger);
  assert.equal(beetleDamage.minion?.health, 0);
  assert.ok(beetleDamage.index < silkTrigger.index);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === silkflitter.instanceId &&
        event.targetInstanceId === beetle.instanceId,
    ),
    false,
  );
});

test("Divine Shield prevents Silkflitter's blocked hit from improving Beetles", () => {
  const state = createGame(0xb3206);
  const source = definitionMinion(
    "BG32_204",
    "shielded-silkflitter",
    {
      attack: 1,
      health: 1,
      taunt: true,
      divineShield: true,
    },
  );
  isolateCombat(
    state,
    [source],
    [enemyWall("shielded-silkflitter-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const shieldBroken = battle.events.find(
    (event) =>
      event.type === "shieldBroken" &&
      event.targetInstanceId === source.instanceId,
  );
  const triggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId,
  );
  const firstRealDamage = battle.events.find(
    (event) =>
      event.type === "damage" &&
      event.targetInstanceId === source.instanceId,
  );
  assert.ok(shieldBroken);
  assert.ok(firstRealDamage);
  assert.equal(triggers.length, 1);
  assert.ok(shieldBroken.index < firstRealDamage.index);
  assert.ok(firstRealDamage.index < triggers[0].index);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === source.instanceId &&
        event.index > shieldBroken.index &&
        event.index < firstRealDamage.index,
    ),
    false,
  );
  assert.deepEqual(
    [
      humanPlayer(combat).beetleAttackBonus,
      humanPlayer(combat).beetleHealthBonus,
    ],
    [2, 2],
  );
});

test("Buzzer and Beetle Blessing summons both read the shared permanent Beetle stats", () => {
  {
    const state = createGame(0xb3207);
    const player = humanPlayer(state);
    player.beetleAttackBonus = 3;
    player.beetleHealthBonus = 4;
    const source = definitionMinion(
      "BG31_803",
      "buffed-buzzer",
      { attack: 1, health: 1 },
    );
    isolateCombat(state, [source], [
      enemyWall("buffed-buzzer-enemy"),
    ]);
    player.beetleAttackBonus = 3;
    player.beetleHealthBonus = 4;

    const combat = gameReducer(state, { type: "END_TURN" });
    const summon = combat.lastBattle?.events.find(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId &&
        event.minion?.definitionId === "live-beetle-token",
    );
    assert.ok(summon);
    assert.deepEqual(
      [summon.minion?.attack, summon.minion?.health],
      [5, 6],
    );
  }

  {
    const state = createGame(0xb3208);
    const player = humanPlayer(state);
    isolateCombat(
      state,
      [enemyWall("beetle-blessing-friendly", 1)],
      [enemyWall("beetle-blessing-enemy", 1)],
    );
    player.nextCombatBeetles = 1;
    player.beetleAttackBonus = 3;
    player.beetleHealthBonus = 4;

    const combat = gameReducer(state, { type: "END_TURN" });
    const summon = combat.lastBattle?.events.find(
      (event) =>
        event.type === "summon" &&
        event.summonReason === "beetle",
    );
    assert.ok(summon);
    assert.equal(summon.minion?.taunt, true);
    assert.deepEqual(
      [summon.minion?.attack, summon.minion?.health],
      [5, 6],
    );
    assert.equal(humanPlayer(combat).nextCombatBeetles, 0);
  }
});

test("ghost Beetle growth is visible in combat but never writes to the eliminated player", () => {
  const state = createGame(0xb3209);
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
      enemyWall(`ghost-beetle-opponent-${index}`),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.beetleAttackBonus = 7;
  ghost.beetleHealthBonus = 9;
  const source = definitionMinion(
    "BG31_809",
    "ghost-turquoise",
    { attack: 1, health: 1, taunt: true },
  );
  ghost.board = [source];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(
    [nextGhost.beetleAttackBonus, nextGhost.beetleHealthBonus],
    [7, 9],
  );
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const trigger = ghostBattle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId,
  );
  const summon = ghostBattle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.ok(trigger);
  assert.equal(trigger.permanentEffectImprovement, false);
  assert.deepEqual(
    [summon?.minion?.attack, summon?.minion?.health],
    [14, 16],
  );
});

test("ghost hand Beetles use combat-only growth when Expert Aviator copies them", () => {
  const state = createGame(0xb32f8);
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
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
      enemyWall(`ghost-aviator-opponent-${index}`, 1),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.beetleAttackBonus = 7;
  ghost.beetleHealthBonus = 9;
  const silkflitter = definitionMinion(
    "BG32_204",
    "ghost-aviator-silkflitter",
    { attack: 1, health: 100 },
  );
  const aviator = definitionMinion(
    "BG34_140",
    "ghost-beetle-aviator",
    { attack: 1, health: 100 },
  );
  ghost.board = [silkflitter, aviator];
  const heldBeetle = definitionMinion(
    "live-beetle-token",
    "ghost-held-beetle",
    { attack: 9, health: 11 },
  );
  ghost.ghostHand = [heldBeetle];

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const rallySummon = ghostBattle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === aviator.instanceId &&
      event.summonReason === "rallyFromHand" &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.ok(rallySummon);
  const growthCount = ghostBattle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === silkflitter.instanceId &&
      event.index < rallySummon.index,
  ).length;
  assert.ok(growthCount >= 1);
  assert.deepEqual(
    [rallySummon.minion?.attack, rallySummon.minion?.health],
    [9 + growthCount * 2, 11 + growthCount * 2],
  );
  const nextGhost = combat.players[3];
  assert.deepEqual(
    [nextGhost.beetleAttackBonus, nextGhost.beetleHealthBonus],
    [7, 9],
  );
  assert.deepEqual(
    [
      nextGhost.ghostHand[0].attack,
      nextGhost.ghostHand[0].health,
    ],
    [9, 11],
  );
});

test("AI values Beetle producers and growers more when their engine is active", () => {
  const state = createGame(0xb3210);
  const player = state.players[1];
  player.board = [];
  player.nextCombatBeetles = 0;
  player.beetleAttackBonus = 0;
  player.beetleHealthBonus = 0;
  const buzzer = definitionMinion("BG31_803", "ai-buzzer");
  const rover = definitionMinion("BG31_801", "ai-rover");

  const plainBuzzerScore = scoreMinionForAi(player, buzzer);
  player.beetleAttackBonus = 8;
  player.beetleHealthBonus = 8;
  const grownBuzzerScore = scoreMinionForAi(player, buzzer);
  assert.ok(grownBuzzerScore > plainBuzzerScore);

  player.beetleAttackBonus = 0;
  player.beetleHealthBonus = 0;
  const idleRoverScore = scoreMinionForAi(player, rover);
  player.nextCombatBeetles = 3;
  const activeRoverScore = scoreMinionForAi(player, rover);
  assert.ok(activeRoverScore > idleRoverScore);

  player.board = [
    definitionMinion("BG_LOE_077", "ai-normal-brann"),
  ];
  const normalBrannScore = scoreMinionForAi(
    player,
    definitionMinion("BG31_801", "ai-brann-rover-normal"),
  );
  player.board = [
    goldenMinion("BG_LOE_077", "ai-golden-brann"),
  ];
  const goldenBrannScore = scoreMinionForAi(
    player,
    definitionMinion("BG31_801", "ai-brann-rover-golden"),
  );
  assert.ok(goldenBrannScore > normalBrannScore);

  player.board = [
    definitionMinion("BG25_354", "ai-normal-titus"),
  ];
  const normalTitusScore = scoreMinionForAi(
    player,
    definitionMinion("BG31_809", "ai-titus-skitterer-normal"),
  );
  player.board = [
    goldenMinion("BG25_354", "ai-golden-titus"),
  ];
  const goldenTitusScore = scoreMinionForAi(
    player,
    definitionMinion("BG31_809", "ai-titus-skitterer-golden"),
  );
  player.board = [
    definitionMinion("BG25_354", "ai-double-titus-1"),
    definitionMinion("BG25_354", "ai-double-titus-2"),
  ];
  const doubleTitusScore = scoreMinionForAi(
    player,
    definitionMinion("BG31_809", "ai-titus-skitterer-double"),
  );
  assert.ok(goldenTitusScore > normalTitusScore);
  assert.equal(doubleTitusScore, goldenTitusScore);
});

test("v31 saves migrate to v32 with safe Beetle defaults and v32 JSON keeps growth", () => {
  const legacy = structuredClone(createGame(0xb3211));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V31;
  for (const player of legacy.players) {
    delete (player as Partial<PlayerState>).beetleAttackBonus;
    delete (player as Partial<PlayerState>).beetleHealthBonus;
  }
  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  );
  assert.ok(migrated !== null && typeof migrated === "object");
  const migratedState = migrated as GameState;
  assert.equal(migratedState.contentVersion, CURRENT_ROSTER_VERSION);
  assert.ok(
    migratedState.players.every(
      (player) =>
        player.beetleAttackBonus === 0 &&
        player.beetleHealthBonus === 0,
    ),
  );

  const current = createGame(0xb3212);
  humanPlayer(current).beetleAttackBonus = 17;
  humanPlayer(current).beetleHealthBonus = 19;
  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(current)),
  );
  assert.ok(restored !== null && typeof restored === "object");
  assert.deepEqual(
    [
      humanPlayer(restored as GameState).beetleAttackBonus,
      humanPlayer(restored as GameState).beetleHealthBonus,
    ],
    [17, 19],
  );
});
