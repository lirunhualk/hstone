import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BattleEvent,
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
