import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getScheduledPairings,
  type BattleEvent,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { projectCombatBoard } from "../lib/game/playback.ts";

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

function keepOnlyOneOpponent(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.shop = [];
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
  enemy.health = 40;
  enemy.board = enemyBoard;
  return enemy;
}

function keepOnlyPoolDefinition(
  state: GameState,
  definitionId: string,
  copies: number,
): void {
  for (const id of Object.keys(state.pool)) {
    state.pool[id] = id === definitionId ? copies : 0;
  }
}

function enableMurlocLobby(state: GameState): void {
  state.activeTribes = [
    "murloc",
    "beast",
    "mech",
    "dragon",
    "undead",
  ];
}

function bloodGem(instanceId: string): BloodGemSpellInstance {
  return {
    kind: "bloodGem",
    instanceId,
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得鲜血宝石的当前属性值。",
    spellFamily: "bloodGem",
  };
}

test("Expert Aviator summons a temporary copy of the highest-Attack hand minion before combat damage", () => {
  const state = createGame(5101);
  const human = humanPlayer(state);
  const aviator = definitionMinion(
    "BG34_140",
    "expert-aviator",
  );
  const filler = definitionMinion(
    "BG25_001",
    "aviator-filler",
    { attack: 0, health: 100 },
  );
  const lowerAttack = definitionMinion(
    "BG25_010",
    "lower-attack-hand",
    { attack: 12, health: 30, poolCopies: 1 },
  );
  const highestAttack = definitionMinion(
    "BG29_611",
    "highest-attack-hand",
    { attack: 37, health: 200, poolCopies: 3 },
  );
  human.board = [aviator, filler];
  human.hand = [lowerAttack, highestAttack];
  const poolBefore = state.pool[highestAttack.definitionId];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "aviator-enemy", {
      attack: 100,
      health: 100,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = [lowerAttack, highestAttack];

  const next = gameReducer(state, { type: "END_TURN" });
  const battle = next.lastBattle;
  assert.ok(battle);
  const attack = battle.events.find(
    (event) =>
      event.type === "attack" &&
      event.actorInstanceId === aviator.instanceId,
  );
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === aviator.instanceId &&
      event.summonReason === "rallyFromHand",
  );
  const death = battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === aviator.instanceId,
  );
  assert.ok(attack);
  assert.ok(summon);
  assert.ok(death);
  assert.ok(attack.index < summon.index);
  assert.ok(summon.index < death.index);
  assert.equal(summon.boardIndex, 1);
  assert.equal(summon.minion?.definitionId, highestAttack.definitionId);
  assert.equal(summon.minion?.attack, highestAttack.attack);
  assert.equal(summon.minion?.health, highestAttack.health);
  assert.equal(summon.minion?.poolCopies, 0);
  assert.notEqual(summon.targetInstanceId, highestAttack.instanceId);
  assert.match(summon.message, /仅限本场战斗/u);

  const permanentHand = humanPlayer(next).hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.deepEqual(
    permanentHand.map((card) => card.instanceId),
    [lowerAttack.instanceId, highestAttack.instanceId],
  );
  assert.equal(permanentHand[1].poolCopies, 3);
  assert.equal(next.pool[highestAttack.definitionId], poolBefore);
});

test("Golden Expert Aviator summons the two distinct highest-Attack hand minions in order", () => {
  const state = createGame(5102);
  const human = humanPlayer(state);
  const aviator = definitionMinion(
    "BG34_140",
    "golden-expert-aviator",
    { golden: true, attack: 6, health: 8 },
  );
  human.board = [
    aviator,
    definitionMinion("BG25_001", "golden-aviator-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  const highest = definitionMinion(
    "BG29_611",
    "golden-aviator-highest",
    { attack: 30, health: 200 },
  );
  const second = definitionMinion(
    "BG25_010",
    "golden-aviator-second",
    { attack: 20, health: 200 },
  );
  const third = definitionMinion(
    "BG21_014",
    "golden-aviator-third",
    { attack: 10, health: 200 },
  );
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "golden-aviator-enemy", {
      attack: 100,
      health: 100,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = [third, second, highest];

  const next = gameReducer(state, { type: "END_TURN" });
  const summons =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === aviator.instanceId &&
        event.summonReason === "rallyFromHand",
    ) ?? [];
  assert.equal(summons.length, 2);
  assert.deepEqual(
    summons.map((event) => event.minion?.definitionId),
    [highest.definitionId, second.definitionId],
  );
  assert.deepEqual(
    summons.map((event) => event.boardIndex),
    [1, 2],
  );
  assert.equal(
    new Set(summons.map((event) => event.targetInstanceId)).size,
    2,
  );
  assert.deepEqual(
    humanPlayer(next).hand.map((card) => card.instanceId),
    [third.instanceId, second.instanceId, highest.instanceId],
  );
});

test("Expert Aviator does not reserve a future slot when its board is full at Rally time", () => {
  const state = createGame(5103);
  const human = humanPlayer(state);
  const aviator = definitionMinion(
    "BG34_140",
    "full-board-aviator",
  );
  human.board = [
    aviator,
    ...Array.from({ length: 6 }, (_, index) =>
      definitionMinion(
        "BG25_001",
        `full-board-aviator-filler-${index}`,
        { attack: 0, health: 100 },
      ),
    ),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "full-board-aviator-enemy", {
      attack: 100,
      health: 100,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = [
    definitionMinion("BG29_611", "full-board-aviator-hand", {
      attack: 50,
      health: 50,
    }),
  ];

  const next = gameReducer(state, { type: "END_TURN" });
  assert.equal(
    next.lastBattle?.events.some(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === aviator.instanceId &&
        event.summonReason === "rallyFromHand",
    ),
    false,
  );
});

test("Windfury Expert Aviator can summon fresh copies of the same hand minion on both strikes", () => {
  const state = createGame(5104);
  const human = humanPlayer(state);
  const aviator = definitionMinion(
    "BG34_140",
    "windfury-expert-aviator",
    { windfury: true, health: 1000 },
  );
  human.board = [
    aviator,
    definitionMinion("BG25_001", "windfury-aviator-filler", {
      attack: 0,
      health: 1000,
    }),
  ];
  const held = definitionMinion(
    "BG29_611",
    "windfury-aviator-held",
    { attack: 25, health: 1000 },
  );
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "windfury-aviator-enemy", {
      attack: 0,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = [held];

  const next = gameReducer(state, { type: "END_TURN" });
  const relevant =
    next.lastBattle?.events.filter(
      (event) =>
        event.actorInstanceId === aviator.instanceId &&
        (event.type === "attack" ||
          (event.type === "summon" &&
            event.summonReason === "rallyFromHand")),
    ) ?? [];
  assert.deepEqual(
    relevant.slice(0, 4).map((event) => event.type),
    ["attack", "summon", "attack", "summon"],
  );
  const firstTwoSummons = relevant
    .filter((event) => event.type === "summon")
    .slice(0, 2);
  assert.equal(firstTwoSummons.length, 2);
  assert.deepEqual(
    firstTwoSummons.map((event) => event.minion?.definitionId),
    [held.definitionId, held.definitionId],
  );
  assert.notEqual(
    firstTwoSummons[0].targetInstanceId,
    firstTwoSummons[1].targetInstanceId,
  );
  assert.equal(humanPlayer(next).hand[0].instanceId, held.instanceId);
});

test("AI Expert Aviator uses the same temporary hand-copy rules", () => {
  const state = createGame(5108);
  const aviator = definitionMinion(
    "BG34_140",
    "ai-expert-aviator",
    { health: 100 },
  );
  const enemy = keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "ai-aviator-sacrifice", {
      attack: 50,
      health: 1,
      taunt: false,
      reborn: false,
    }),
    aviator,
    definitionMinion("BG25_001", "ai-aviator-taunt", {
      attack: 0,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
    ...Array.from({ length: 4 }, (_, index) =>
      definitionMinion(
        "BG25_001",
        `ai-aviator-filler-${index}`,
        { attack: 0, health: 1000, reborn: false },
      ),
    ),
  ]);
  const held = definitionMinion(
    "BG25_010",
    "ai-aviator-held",
    { attack: 40, health: 100 },
  );
  enemy.hand = [held];
  humanPlayer(state).board = [
    definitionMinion("BG25_001", "ai-aviator-human-target", {
      attack: 100,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
  ];

  const next = gameReducer(state, { type: "END_TURN" });
  const summon = next.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorPlayerId === enemy.id &&
      event.actorInstanceId === aviator.instanceId &&
      event.summonReason === "rallyFromHand",
  );
  assert.ok(summon);
  assert.equal(summon.minion?.definitionId, held.definitionId);
  assert.notEqual(summon.targetInstanceId, held.instanceId);
  assert.equal(
    next.players.find((player) => player.id === enemy.id)?.hand[0]
      .instanceId,
    held.instanceId,
  );
});

test("Sin'dorei Straight Shot removes Reborn and Taunt before damage and prevents the target from Reborning", () => {
  const state = createGame(5105);
  const human = humanPlayer(state);
  const straightShot = definitionMinion(
    "BG25_016",
    "sindorei-straight-shot",
  );
  human.board = [
    straightShot,
    definitionMinion("BG25_001", "straight-shot-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  const target = definitionMinion(
    "BG25_010",
    "straight-shot-target",
    {
      attack: 100,
      health: 6,
      taunt: true,
      reborn: true,
    },
  );
  const enemy = keepOnlyOneOpponent(state, [target]);

  const next = gameReducer(state, { type: "END_TURN" });
  const battle = next.lastBattle;
  assert.ok(battle);
  const firstAttack = battle.events.find(
    (event) =>
      event.type === "attack" &&
      event.actorInstanceId === straightShot.instanceId,
  );
  const removal = battle.events.find(
    (event) =>
      event.type === "keywordRemoved" &&
      event.actorInstanceId === straightShot.instanceId,
  );
  assert.ok(firstAttack);
  assert.ok(removal);
  assert.ok(firstAttack.index < removal.index);
  assert.deepEqual(removal.removedKeywords, ["reborn", "taunt"]);
  assert.equal(removal.targetInstanceId, target.instanceId);
  assert.equal(removal.minion?.reborn, false);
  assert.equal(removal.minion?.taunt, false);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "summon" &&
        event.summonReason === "reborn" &&
        event.actorInstanceId === target.instanceId,
    ),
    false,
  );
  const permanentTarget = next.players
    .find((player) => player.id === enemy.id)
    ?.board.find((minion) => minion.instanceId === target.instanceId);
  assert.ok(permanentTarget);
  assert.equal(permanentTarget.reborn, true);
  assert.equal(permanentTarget.taunt, true);
  assert.deepEqual(JSON.parse(JSON.stringify(removal)), removal);
});

test("Windfury Straight Shot re-evaluates Taunt and strips a different current target on its second strike", () => {
  const state = createGame(5106);
  const human = humanPlayer(state);
  const straightShot = definitionMinion(
    "BG25_016",
    "windfury-straight-shot",
    { health: 1000 },
  );
  human.board = [
    straightShot,
    definitionMinion("BG25_001", "straight-shot-filler-a", {
      attack: 0,
      health: 100,
    }),
    definitionMinion("BG25_001", "straight-shot-filler-b", {
      attack: 0,
      health: 100,
    }),
  ];
  const firstTarget = definitionMinion(
    "BG25_010",
    "straight-shot-taunt-a",
    { attack: 0, health: 100, taunt: true, reborn: false },
  );
  const secondTarget = definitionMinion(
    "BG25_010",
    "straight-shot-taunt-b",
    { attack: 0, health: 100, taunt: true, reborn: false },
  );
  keepOnlyOneOpponent(state, [firstTarget, secondTarget]);

  const next = gameReducer(state, { type: "END_TURN" });
  const relevant =
    next.lastBattle?.events.filter(
      (event) =>
        event.actorInstanceId === straightShot.instanceId &&
        (event.type === "attack" ||
          event.type === "keywordRemoved"),
    ) ?? [];
  assert.deepEqual(
    relevant.slice(0, 4).map((event) => event.type),
    [
      "attack",
      "keywordRemoved",
      "attack",
      "keywordRemoved",
    ],
  );
  const removals = relevant
    .filter((event) => event.type === "keywordRemoved")
    .slice(0, 2);
  assert.deepEqual(
    removals.map((event) => event.removedKeywords),
    [["taunt"], ["taunt"]],
  );
  assert.equal(
    new Set(removals.map((event) => event.targetInstanceId)).size,
    2,
  );
});

test("combat playback applies a structured keyword-removal snapshot", () => {
  const state = createGame(5107);
  const playerId = state.humanPlayerId;
  const target = definitionMinion(
    "BG25_010",
    "playback-keyword-target",
    { taunt: true, reborn: true },
  );
  const stripped = {
    ...target,
    taunt: false,
    reborn: false,
  };
  const event: BattleEvent = {
    index: 0,
    type: "keywordRemoved",
    actorPlayerId: playerId,
    actorInstanceId: "playback-straight-shot",
    targetPlayerId: playerId,
    targetInstanceId: target.instanceId,
    removedKeywords: ["reborn", "taunt"],
    minion: stripped,
    message: "辛多雷直射手移除了目标的复生和嘲讽。",
  };

  const [projected] = projectCombatBoard(
    [target],
    playerId,
    [event],
  );
  assert.equal(projected.instanceId, target.instanceId);
  assert.equal(projected.reborn, false);
  assert.equal(projected.taunt, false);
  assert.deepEqual(
    projectCombatBoard([target], "another-player", [event])[0],
    target,
  );
});

test("Dustbone Destroyer permanently improves current, held, and future Undead with normal and Golden values", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(5200 + caseIndex);
    const human = humanPlayer(state);
    const destroyer = definitionMinion(
      "BG33_323",
      `dustbone-${caseIndex}`,
      {
        golden,
        attack: 10,
        health: 50,
      },
    );
    const boardUndead = definitionMinion(
      "BG25_008",
      `dustbone-board-undead-${caseIndex}`,
      { attack: 1000, health: 1000 },
    );
    human.board = [destroyer, boardUndead];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG29_611", `dustbone-enemy-${caseIndex}`, {
        attack: 100,
        health: 500,
        taunt: true,
        reborn: false,
      }),
    ]);
    const heldUndead = definitionMinion(
      "BG25_010",
      `dustbone-held-undead-${caseIndex}`,
      { poolCopies: 1 },
    );
    human.hand = [heldUndead];
    const poolBefore = JSON.parse(
      JSON.stringify(state.pool),
    ) as GameState["pool"];

    const combat = gameReducer(state, { type: "END_TURN" });
    const owner = humanPlayer(combat);
    const expected = golden ? 4 : 2;
    assert.equal(owner.undeadArmyAttackBonus, expected);
    assert.equal(owner.undeadArmyHealthBonus, 0);
    assert.equal(
      owner.board.find(
        (minion) => minion.instanceId === destroyer.instanceId,
      )?.attack,
      destroyer.attack + expected,
    );
    assert.equal(
      owner.board.find(
        (minion) => minion.instanceId === boardUndead.instanceId,
      )?.attack,
      boardUndead.attack + expected,
    );
    assert.equal(
      owner.hand.find(
        (card): card is BoardMinionInstance =>
          card.kind === "minion" &&
          card.instanceId === heldUndead.instanceId,
      )?.attack,
      heldUndead.attack + expected,
    );
    assert.deepEqual(combat.pool, poolBefore);

    const rallyBuffs =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === destroyer.instanceId &&
          event.attackDelta === expected,
      ) ?? [];
    assert.deepEqual(
      new Set(
        rallyBuffs.map((event) => event.targetInstanceId),
      ),
      new Set([destroyer.instanceId, boardUndead.instanceId]),
    );

    if (!golden) {
      const recruit = gameReducer(combat, { type: "CONTINUE" });
      const recruitHuman = humanPlayer(recruit);
      const futureUndead = definitionMinion(
        "BG25_001",
        "dustbone-future-undead",
        { poolCopies: 1 },
      );
      recruitHuman.shop = [futureUndead];
      recruitHuman.gold = 10;
      const bought = gameReducer(recruit, {
        type: "BUY_MINION",
        shopIndex: 0,
      });
      assert.equal(
        humanPlayer(bought).hand.find(
          (card): card is BoardMinionInstance =>
            card.kind === "minion" &&
            card.instanceId === futureUndead.instanceId,
        )?.attack,
        futureUndead.attack + expected,
      );
    }
  }
});

test("Valiant Counterattacker gains the target's Attack before damage, with the Golden version doubling only that gain", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(5210 + caseIndex);
    const human = humanPlayer(state);
    const counterattacker = definitionMinion(
      "BG34_604",
      `counterattacker-${caseIndex}`,
      {
        golden,
        attack: 2,
        health: 5,
      },
    );
    human.board = [
      counterattacker,
      definitionMinion("BG29_611", `counter-filler-${caseIndex}`, {
        attack: 1000,
        health: 1000,
      }),
    ];
    const target = definitionMinion(
      "BG29_611",
      `counter-target-${caseIndex}`,
      {
        attack: 7,
        health: 500,
        taunt: true,
        divineShield: false,
        reborn: false,
      },
    );
    keepOnlyOneOpponent(state, [target]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const expectedGain = golden ? 14 : 7;
    const buff = combat.lastBattle?.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === counterattacker.instanceId &&
        event.targetInstanceId === counterattacker.instanceId,
    );
    const damage = combat.lastBattle?.events.find(
      (event) =>
        event.type === "damage" &&
        event.actorPlayerId === human.id &&
        event.targetInstanceId === target.instanceId,
    );
    assert.equal(buff?.attackDelta, expectedGain);
    assert.equal(buff?.minion?.attack, 2 + expectedGain);
    assert.equal(damage?.amount, 2 + expectedGain);
    assert.equal(
      humanPlayer(combat).board.find(
        (minion) =>
          minion.instanceId === counterattacker.instanceId,
      )?.attack,
      2,
    );
  }
});

test("Stealth prevents targeting until Valiant Counterattacker attacks, then playback removes it", () => {
  const state = createGame(5220);
  const human = humanPlayer(state);
  const counterattacker = definitionMinion(
    "BG34_604",
    "stealth-counterattacker",
    { attack: 1, health: 100 },
  );
  const visibleFiller = definitionMinion(
    "BG29_611",
    "stealth-visible-filler",
    { attack: 0, health: 1 },
  );
  human.board = [counterattacker, visibleFiller];
  const enemy = keepOnlyOneOpponent(state, [
    definitionMinion("BG29_611", "stealth-enemy-a", {
      attack: 10,
      health: 1000,
      reborn: false,
    }),
    definitionMinion("BG29_611", "stealth-enemy-b", {
      attack: 1,
      health: 1000,
      reborn: false,
    }),
    definitionMinion("BG29_611", "stealth-enemy-c", {
      attack: 1,
      health: 1000,
      reborn: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const firstEnemyAttack = battle.events.find(
    (event) =>
      event.type === "attack" &&
      event.actorPlayerId === enemy.id,
  );
  assert.equal(
    firstEnemyAttack?.targetInstanceId,
    visibleFiller.instanceId,
  );
  const stealthRemoval = battle.events.find(
    (event) =>
      event.type === "keywordRemoved" &&
      event.actorInstanceId === counterattacker.instanceId &&
      event.removedKeywords?.includes("stealth"),
  );
  assert.ok(stealthRemoval);
  assert.equal(stealthRemoval.targetPlayerId, human.id);
  assert.equal(
    stealthRemoval.targetInstanceId,
    counterattacker.instanceId,
  );
  assert.equal(stealthRemoval.minion?.stealth, false);
  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "attack" &&
        event.actorPlayerId === enemy.id &&
        event.targetInstanceId === counterattacker.instanceId &&
        event.index > stealthRemoval.index,
    ),
  );

  const projected = projectCombatBoard(
    battle.initialBoards[human.id].filter(
      (minion): minion is BoardMinionInstance =>
        minion.kind === "minion",
    ),
    human.id,
    battle.events.slice(0, stealthRemoval.index + 1),
  );
  assert.equal(
    projected.find(
      (minion) =>
        minion.instanceId === counterattacker.instanceId,
    )?.stealth,
    false,
  );
});

test("a combat with only Stealthed targets terminates as a tie", () => {
  const state = createGame(5221);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG34_604", "double-stealth-human", {
      attack: 1,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG34_604", "double-stealth-enemy", {
      attack: 1,
      health: 100,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.lastBattle?.winnerId, null);
  assert.equal(
    combat.lastBattle?.events.some(
      (event) => event.type === "attack",
    ),
    false,
  );
  assert.equal(
    combat.lastBattle?.events.at(-1)?.type,
    "battleEnd",
  );
});

test("Seabed Recruiter casts Chef's Choice once normally and twice while Golden", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(5230 + caseIndex);
    enableMurlocLobby(state);
    const human = humanPlayer(state);
    human.tavernTier = 6;
    const recruiter = definitionMinion(
      "BG34_925",
      `seabed-recruiter-${caseIndex}`,
      { golden, attack: 1, health: 5 },
    );
    const rightMurloc = definitionMinion(
      "BG32_330",
      `seabed-right-${caseIndex}`,
      { attack: 1000, health: 1000 },
    );
    human.board = [recruiter, rightMurloc];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG29_611", `seabed-enemy-${caseIndex}`, {
        attack: 10,
        health: 1000,
        taunt: true,
        reborn: false,
      }),
    ]);
    human.hand = [];
    const candidateId = "BG33_140";
    const expected = golden ? 2 : 1;
    keepOnlyPoolDefinition(state, candidateId, expected);

    const combat = gameReducer(state, { type: "END_TURN" });
    const gains =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === recruiter.instanceId &&
          event.cardGainResult === "added",
      ) ?? [];
    assert.equal(gains.length, expected);
    assert.equal(
      humanPlayer(combat).hand.filter(
        (card) =>
          card.kind === "minion" &&
          card.definitionId === candidateId,
      ).length,
      expected,
    );
    assert.equal(combat.pool[candidateId], 0);
  }
});

test("Golden Windfury Seabed Recruiter re-evaluates each cast and triggers combat Tavern-Spell responders", () => {
  const state = createGame(5232);
  enableMurlocLobby(state);
  const human = humanPlayer(state);
  human.tavernTier = 6;
  const recruiter = definitionMinion(
    "BG34_925",
    "windfury-golden-seabed",
    {
      golden: true,
      windfury: true,
      attack: 1,
      health: 100,
    },
  );
  const rightMurloc = definitionMinion(
    "BG32_330",
    "windfury-seabed-right",
    { attack: 1000, health: 1000 },
  );
  const hooktail = definitionMinion(
    "BG27_005",
    "windfury-seabed-hooktail",
    { attack: 0, health: 1000 },
  );
  human.board = [recruiter, rightMurloc, hooktail];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG29_611", "windfury-seabed-enemy", {
      attack: 60,
      health: 5000,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = [];
  const candidateId = "BG33_140";
  keepOnlyPoolDefinition(state, candidateId, 4);

  const combat = gameReducer(state, { type: "END_TURN" });
  const gains =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === recruiter.instanceId &&
        event.cardGainResult === "added",
    ) ?? [];
  assert.equal(gains.length, 4);
  const responsePulses =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === hooktail.instanceId &&
        event.targetInstanceId === recruiter.instanceId,
    ) ?? [];
  assert.equal(responsePulses.length, 4);
  const gainedMurlocs = humanPlayer(combat).hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === candidateId,
  );
  assert.equal(gainedMurlocs.length, 2);
  assert.equal(
    gainedMurlocs.filter((minion) => minion.golden).length,
    1,
  );
  assert.equal(
    gainedMurlocs.filter((minion) => !minion.golden).length,
    1,
  );
});

test("Seabed Recruiter preserves the pool with a full hand but still counts as casting Chef's Choice", () => {
  const state = createGame(5233);
  enableMurlocLobby(state);
  const human = humanPlayer(state);
  human.tavernTier = 6;
  const recruiter = definitionMinion(
    "BG34_925",
    "full-hand-seabed",
    { attack: 1, health: 5 },
  );
  const hooktail = definitionMinion(
    "BG27_005",
    "full-hand-seabed-hooktail",
    { attack: 0, health: 1000 },
  );
  human.board = [
    recruiter,
    definitionMinion("BG32_330", "full-hand-seabed-right", {
      attack: 1000,
      health: 1000,
    }),
    hooktail,
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG29_611", "full-hand-seabed-enemy", {
      attack: 10,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(
      "BG29_611",
      `full-hand-seabed-card-${index}`,
    ),
  );
  const candidateId = "BG33_140";
  keepOnlyPoolDefinition(state, candidateId, 1);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(humanPlayer(combat).hand.length, 10);
  assert.equal(combat.pool[candidateId], 1);
  assert.ok(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === recruiter.instanceId &&
        event.cardGainResult === "handFull",
    ),
  );
  assert.ok(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === hooktail.instanceId &&
        event.targetInstanceId === recruiter.instanceId,
    ),
  );
});

test("Seabed Recruiter grants a consolation Coin when Chef's Choice has no candidate", () => {
  const state = createGame(5234);
  enableMurlocLobby(state);
  const human = humanPlayer(state);
  human.tavernTier = 6;
  const recruiter = definitionMinion(
    "BG34_925",
    "empty-pool-seabed",
    { attack: 1, health: 5 },
  );
  human.board = [
    recruiter,
    definitionMinion("BG32_330", "empty-pool-seabed-right", {
      attack: 1000,
      health: 1000,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG29_611", "empty-pool-seabed-enemy", {
      attack: 10,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
  ]);
  human.hand = [];
  keepOnlyPoolDefinition(state, "BG33_140", 0);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(humanPlayer(combat).hand.length, 1);
  assert.equal(humanPlayer(combat).hand[0]?.kind, "consolationCoin");
  assert.ok(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === recruiter.instanceId &&
        event.cardGainResult === "noCandidate",
    ),
  );
});

test("Seabed Recruiter's Chef's Choice resolves an immediate shared-pool triple", () => {
  const state = createGame(5235);
  enableMurlocLobby(state);
  const human = humanPlayer(state);
  human.tavernTier = 6;
  const recruiter = definitionMinion(
    "BG34_925",
    "triple-seabed",
    { attack: 1, health: 5 },
  );
  human.board = [
    recruiter,
    definitionMinion("BG32_330", "triple-seabed-right", {
      attack: 1000,
      health: 1000,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG29_611", "triple-seabed-enemy", {
      attack: 10,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
  ]);
  const candidateId = "BG33_140";
  human.hand = [
    definitionMinion(candidateId, "triple-seabed-held-a", {
      poolCopies: 1,
    }),
    definitionMinion(candidateId, "triple-seabed-held-b", {
      poolCopies: 1,
    }),
  ];
  keepOnlyPoolDefinition(state, candidateId, 1);

  const combat = gameReducer(state, { type: "END_TURN" });
  const matching = humanPlayer(combat).hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === candidateId,
  );
  assert.equal(matching.length, 1);
  assert.equal(matching[0].golden, true);
  assert.equal(matching[0].poolCopies, 3);
  assert.equal(combat.pool[candidateId], 0);
});

test("AI Seabed Recruiter gains the card without leaking its hidden identity into combat events", () => {
  const state = createGame(5236);
  enableMurlocLobby(state);
  const recruiter = definitionMinion(
    "BG34_925",
    "ai-seabed",
    { attack: 1, health: 5 },
  );
  const enemy = keepOnlyOneOpponent(state, [
    recruiter,
    definitionMinion("BG32_330", "ai-seabed-right", {
      attack: 0,
      health: 1000,
    }),
  ]);
  humanPlayer(state).board = [
    definitionMinion("BG29_611", "ai-seabed-human-target", {
      attack: 10,
      health: 1000,
      taunt: true,
      reborn: false,
    }),
  ];
  enemy.tavernTier = 6;
  enemy.hand = [];
  const candidateId = "BG33_140";
  keepOnlyPoolDefinition(state, candidateId, 1);

  const combat = gameReducer(state, { type: "END_TURN" });
  const aiOwner = combat.players.find((player) => player.id === enemy.id);
  assert.equal(
    aiOwner?.hand.filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === candidateId,
    ).length,
    1,
  );
  const gain = combat.lastBattle?.events.find(
    (event) =>
      event.type === "cardGain" &&
      event.actorInstanceId === recruiter.instanceId &&
      event.cardGainResult === "added",
  );
  assert.ok(gain);
  assert.equal(gain.cardName, undefined);
  assert.equal(gain.targetInstanceId, undefined);
  assert.equal(gain.minion, undefined);
  assert.equal(gain.message.includes("江河弹跳鱼"), false);
});

test("Bile Spitter Murloc grants Venomous to one or two distinct other Murlocs only for combat", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(5240 + caseIndex);
    const human = humanPlayer(state);
    const spitter = definitionMinion(
      "BG33_318",
      `bile-spitter-${caseIndex}`,
      { golden, attack: 1, health: 100 },
    );
    const candidates = Array.from({ length: 3 }, (_, index) =>
      definitionMinion(
        "BG32_330",
        `bile-candidate-${caseIndex}-${index}`,
        { attack: 0, health: 1000, venomous: false },
      ),
    );
    human.board = [spitter, ...candidates];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG24_009", `bile-enemy-${caseIndex}`, {
        attack: 0,
        health: 1000,
        taunt: true,
        divineShield: false,
        reborn: false,
      }),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const grants =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === spitter.instanceId &&
          event.minion?.venomous === true,
      ) ?? [];
    const expected = golden ? 2 : 1;
    assert.equal(grants.length, expected);
    assert.equal(
      new Set(
        grants.map((event) => event.targetInstanceId),
      ).size,
      expected,
    );
    assert.ok(
      grants.every(
        (event) =>
          event.targetInstanceId !== spitter.instanceId,
      ),
    );
    assert.ok(
      candidates.every(
        (candidate) =>
          humanPlayer(combat).board.find(
            (minion) =>
              minion.instanceId === candidate.instanceId,
          )?.venomous === false,
      ),
    );
  }
});

test("Blood Gem Refiner permanently improves Gems with normal, Golden, and Windfury Rally counts", () => {
  const cases = [
    {
      golden: false,
      windfury: false,
      enemyAttack: 200,
      expectedAttack: 2,
      expectedHealth: 3,
    },
    {
      golden: true,
      windfury: false,
      enemyAttack: 200,
      expectedAttack: 3,
      expectedHealth: 5,
    },
    {
      golden: false,
      windfury: true,
      enemyAttack: 60,
      expectedAttack: 3,
      expectedHealth: 5,
    },
  ] as const;

  for (const [caseIndex, scenario] of cases.entries()) {
    const state = createGame(5250 + caseIndex);
    const human = humanPlayer(state);
    const refiner = definitionMinion(
      "BG33_885",
      `blood-refiner-${caseIndex}`,
      {
        golden: scenario.golden,
        windfury: scenario.windfury,
        attack: 1,
        health: 100,
      },
    );
    const recipient = definitionMinion(
      "BG29_611",
      `blood-refiner-recipient-${caseIndex}`,
      { attack: 1, health: 1 },
    );
    human.board = [refiner, recipient];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG29_611", `blood-refiner-enemy-${caseIndex}`, {
        attack: scenario.enemyAttack,
        health: 5000,
        taunt: true,
        reborn: false,
      }),
    ]);
    const gem = bloodGem(`blood-refiner-gem-${caseIndex}`);
    human.hand = [gem];

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      humanPlayer(combat).bloodGemAttack,
      scenario.expectedAttack,
    );
    assert.equal(
      humanPlayer(combat).bloodGemHealth,
      scenario.expectedHealth,
    );

    const recruit = gameReducer(combat, { type: "CONTINUE" });
    const cast = gameReducer(recruit, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: gem.instanceId,
      targetInstanceId: recipient.instanceId,
    });
    const buffed = humanPlayer(cast).board.find(
      (minion) => minion.instanceId === recipient.instanceId,
    );
    assert.equal(
      buffed?.attack,
      recipient.attack + scenario.expectedAttack,
    );
    assert.equal(
      buffed?.health,
      recipient.health + scenario.expectedHealth,
    );
  }
});

test("Dead Sea Ravager selects at most four distinct allies per pulse and Golden repeats the pulse despite Brann, Titus, and Drakkari", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(5260 + caseIndex);
    const human = humanPlayer(state);
    const ravager = definitionMinion(
      "BG34_765",
      `dead-sea-ravager-${caseIndex}`,
      {
        golden,
        attack: 7,
        health: 5,
      },
    );
    const candidates = [
      definitionMinion(
        "BG_LOE_077",
        `dead-sea-brann-${caseIndex}`,
        { attack: 0, health: 1000 },
      ),
      definitionMinion(
        "BG25_354",
        `dead-sea-titus-${caseIndex}`,
        { attack: 0, health: 1000 },
      ),
      definitionMinion(
        "BG26_ICC_901",
        `dead-sea-drakkari-${caseIndex}`,
        { attack: 0, health: 1000 },
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        definitionMinion(
          "BG29_611",
          `dead-sea-filler-${caseIndex}-${index}`,
          { attack: 0, health: 1000 },
        ),
      ),
    ];
    human.board = [ravager, ...candidates];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG29_611", `dead-sea-enemy-${caseIndex}`, {
        attack: 10,
        health: 1000,
        taunt: true,
        reborn: false,
      }),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const buffs =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === ravager.instanceId &&
          event.targetInstanceId !== ravager.instanceId,
      ) ?? [];
    const repetitions = golden ? 2 : 1;
    assert.equal(buffs.length, 4 * repetitions);
    assert.ok(
      buffs.every((event) => event.attackDelta === 7),
    );
    const counts = new Map<string, number>();
    for (const event of buffs) {
      assert.ok(event.targetInstanceId);
      counts.set(
        event.targetInstanceId,
        (counts.get(event.targetInstanceId) ?? 0) + 1,
      );
    }
    assert.ok(
      [...counts.values()].every(
        (count) => count <= repetitions,
      ),
    );
    assert.ok(
      candidates.every(
        (candidate) =>
          humanPlayer(combat).board.find(
            (minion) =>
              minion.instanceId === candidate.instanceId,
          )?.attack === 0,
      ),
    );
  }
});

test("ghost Rally effects animate in combat without mutating the eliminated owner's hand, pool, or persistent bonuses", () => {
  const state = createGame(5270);
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
      definitionMinion("BG29_611", `ghost-rally-live-${index}`, {
        attack: 0,
        health: 10000,
        reborn: false,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 1;
  const dustbone = definitionMinion(
    "BG33_323",
    "ghost-rally-dustbone",
    { attack: 10, health: 1000 },
  );
  const refiner = definitionMinion(
    "BG33_885",
    "ghost-rally-refiner",
    { attack: 10, health: 1000 },
  );
  const recruiter = definitionMinion(
    "BG34_925",
    "ghost-rally-recruiter",
    { attack: 10, health: 1000 },
  );
  const rightMurloc = definitionMinion(
    "BG32_330",
    "ghost-rally-right",
    { attack: 10, health: 1000 },
  );
  ghost.board = [dustbone, refiner, recruiter, rightMurloc];
  ghost.hand = [
    definitionMinion("BG25_008", "ghost-rally-hand", {
      poolCopies: 1,
    }),
  ];
  ghost.undeadArmyAttackBonus = 3;
  ghost.undeadArmyHealthBonus = 2;
  ghost.bloodGemAttack = 5;
  ghost.bloodGemHealth = 7;
  const ghostBefore = JSON.parse(
    JSON.stringify(ghost),
  ) as PlayerState;
  keepOnlyPoolDefinition(state, "BG33_140", 3);
  const poolBefore = JSON.parse(
    JSON.stringify(state.pool),
  ) as GameState["pool"];
  const pairing = getScheduledPairings(state).find(
    (candidate) => candidate.isGhost,
  );
  assert.equal(pairing?.playerBId, ghost.id);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players.find(
    (player) => player.id === ghost.id,
  );
  assert.ok(nextGhost);
  assert.deepEqual(nextGhost.board, ghostBefore.board);
  assert.deepEqual(nextGhost.hand, ghostBefore.hand);
  assert.equal(
    nextGhost.undeadArmyAttackBonus,
    ghostBefore.undeadArmyAttackBonus,
  );
  assert.equal(
    nextGhost.undeadArmyHealthBonus,
    ghostBefore.undeadArmyHealthBonus,
  );
  assert.equal(nextGhost.bloodGemAttack, ghostBefore.bloodGemAttack);
  assert.equal(nextGhost.bloodGemHealth, ghostBefore.bloodGemHealth);
  assert.deepEqual(combat.pool, poolBefore);

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
        event.type === "buff" &&
        event.actorInstanceId === dustbone.instanceId,
    ),
  );
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === recruiter.instanceId,
    ),
    false,
  );
});
