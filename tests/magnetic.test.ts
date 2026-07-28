import assert from "node:assert/strict";
import test from "node:test";

import {
  canMagnetize,
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

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
  };
}

function keepOnlyOneOpponent(
  state: GameState,
  enemyBoard: BoardMinionInstance[] = [],
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
    }
  }
  const enemy = state.players[1];
  enemy.alive = true;
  enemy.health = 40;
  enemy.board = enemyBoard;
  return enemy;
}

function magneticAction(
  source: BoardMinionInstance,
  target: BoardMinionInstance,
) {
  return {
    type: "MAGNETIZE_MINION" as const,
    cardInstanceId: source.instanceId,
    targetInstanceId: target.instanceId,
  };
}

test("validates standard, dual-type, special, and all-type Magnetic targets", () => {
  const lullabot = definitionMinion("BG26_146", "lullabot");
  const technicalElement = definitionMinion("BG31_859", "technical");
  const prostheticHand = definitionMinion("BG_DEEP_015", "hand");
  const mech = definitionMinion("BG29_611", "mech");
  const elemental = definitionMinion("BGS_119", "elemental");
  const undead = definitionMinion("BG25_001", "undead");
  const allType = definitionMinion("BG32_111", "all");

  assert.equal(canMagnetize(lullabot, mech), true);
  assert.equal(canMagnetize(lullabot, elemental), false);
  assert.equal(canMagnetize(lullabot, allType), true);
  assert.equal(canMagnetize(technicalElement, mech), true);
  assert.equal(canMagnetize(technicalElement, elemental), true);
  assert.equal(canMagnetize(technicalElement, undead), false);
  assert.equal(canMagnetize(prostheticHand, mech), true);
  assert.equal(canMagnetize(prostheticHand, undead), true);
  assert.equal(canMagnetize(prostheticHand, elemental), false);
});

test("Magnetizes on a full board while invalid targets leave state unchanged", () => {
  const state = createGame(4001);
  const human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "full-board-mech");
  const source = definitionMinion("BG26_146", "full-board-source", {
    poolCopies: 1,
  });
  human.board = [
    target,
    ...Array.from({ length: 6 }, (_, index) =>
      definitionMinion("BG25_001", `full-board-undead-${index}`, {
        golden: true,
      }),
    ),
  ];
  human.hand = [source];
  const poolBefore = state.pool[source.definitionId];

  const invalid = gameReducer(
    state,
    magneticAction(source, human.board[1]),
  );
  assert.deepEqual(invalid, state);

  const next = gameReducer(state, magneticAction(source, target));
  const nextHuman = humanPlayer(next);
  assert.equal(nextHuman.board.length, 7);
  assert.equal(nextHuman.hand.length, 0);
  assert.equal(nextHuman.board[0].attack, target.attack + source.attack);
  assert.equal(nextHuman.board[0].health, target.health + source.health);
  assert.equal(nextHuman.board[0].attachments.length, 1);
  assert.equal(
    next.pool[source.definitionId],
    poolBefore + source.poolCopies,
  );
});

test("transfers current stats and keywords without changing the host identity", () => {
  const state = createGame(4002);
  const human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "keyword-host", {
    attack: 7,
    health: 8,
  });
  const annoyOModule = definitionMinion("BG_BOT_911", "keyword-source", {
    attack: 5,
    health: 7,
  });
  human.board = [target];
  human.hand = [annoyOModule];

  const next = gameReducer(state, magneticAction(annoyOModule, target));
  const host = humanPlayer(next).board[0];
  assert.equal(host.definitionId, target.definitionId);
  assert.equal(host.cardId, target.cardId);
  assert.equal(host.attack, 12);
  assert.equal(host.health, 15);
  assert.equal(host.divineShield, true);
  assert.equal(host.taunt, true);
  assert.equal(host.attachments[0].attackGranted, 5);
  assert.equal(host.attachments[0].healthGranted, 7);
  assert.equal(host.attachments[0].description, annoyOModule.description);
  assert.equal(host.attachments[0].effectSupport, "complete");
});

test("keeps nested attachment contributions additive and visible", () => {
  let state = createGame(4011);
  let human = humanPlayer(state);
  const nestedHost = definitionMinion("BG_BOT_911", "nested-source");
  const nestedChild = definitionMinion("BG26_146", "nested-child");
  human.board = [nestedHost];
  human.hand = [nestedChild];

  state = gameReducer(
    state,
    magneticAction(nestedChild, nestedHost),
  );
  human = humanPlayer(state);
  const sourceWithAttachment = human.board[0];
  const sourceAttack = sourceWithAttachment.attack;
  const sourceHealth = sourceWithAttachment.health;
  const finalHost = definitionMinion("BG29_611", "nested-final-host");
  human.board = [finalHost];
  human.hand = [sourceWithAttachment];

  state = gameReducer(
    state,
    magneticAction(sourceWithAttachment, finalHost),
  );
  const rootAttachment = humanPlayer(state).board[0].attachments[0];
  assert.equal(rootAttachment.attachments.length, 1);
  assert.equal(
    rootAttachment.attackGranted +
      rootAttachment.attachments[0].attackGranted,
    sourceAttack,
  );
  assert.equal(
    rootAttachment.healthGranted +
      rootAttachment.attachments[0].healthGranted,
    sourceHealth,
  );
});

test("propagates partial rules support and attachment card text to the host", () => {
  const state = createGame(4012);
  const human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "partial-host");
  const source = definitionMinion("BG35_341", "partial-source");
  assert.equal(source.effectSupport, "partial");
  human.board = [target];
  human.hand = [source];

  const next = gameReducer(state, magneticAction(source, target));
  const host = humanPlayer(next).board[0];
  assert.equal(host.effectSupport, "partial");
  assert.equal(host.attachments[0].effectSupport, "partial");
  assert.equal(host.attachments[0].description, source.description);
});

test("returns Magnetic pool copies immediately and never returns them twice", () => {
  const state = createGame(4003);
  const human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "pool-host", {
    poolCopies: 1,
  });
  const source = definitionMinion("BG26_146", "pool-source", {
    poolCopies: 1,
  });
  human.board = [target];
  human.hand = [source];
  const sourcePoolBefore = state.pool[source.definitionId];
  const targetPoolBefore = state.pool[target.definitionId];
  const goldBefore = human.gold;

  const attached = gameReducer(state, magneticAction(source, target));
  const attachedHost = humanPlayer(attached).board[0];
  assert.equal(attached.pool[source.definitionId], sourcePoolBefore + 1);
  assert.equal(attachedHost.attachments[0].poolCopies, 0);

  const sold = gameReducer(attached, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  assert.equal(sold.pool[source.definitionId], sourcePoolBefore + 1);
  assert.equal(sold.pool[target.definitionId], targetPoolBefore + 1);
  assert.equal(humanPlayer(sold).gold, goldBefore + target.sellValue);
});

test("runs attached end/start-of-turn effects with component Golden scaling", () => {
  let state = createGame(4004);
  let human = humanPlayer(state);
  const host = definitionMinion("BG29_611", "timing-host");
  const lullabot = definitionMinion("BG26_146", "timing-lullabot");
  const accord = definitionMinion("BG26_147", "timing-accord", {
    golden: true,
    name: "金色·手风琴机器人",
    attack: 6,
    health: 6,
    poolCopies: 3,
  });
  human.board = [host];
  human.hand = [lullabot, accord];
  state = gameReducer(state, magneticAction(lullabot, host));
  human = humanPlayer(state);
  state = gameReducer(
    state,
    magneticAction(accord, human.board[0]),
  );
  human = humanPlayer(state);
  const healthBeforeEnd = human.board[0].health;
  keepOnlyOneOpponent(state);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(humanPlayer(state).board[0].health, healthBeforeEnd + 1);
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(humanPlayer(state).gold, 6);
});

test("triggers Scrap Lancer once per Magnetization and respects Golden scaling", () => {
  const state = createGame(4005);
  const human = humanPlayer(state);
  const watcher = definitionMinion("BG34_175", "golden-lancer", {
    golden: true,
    name: "金色·废铁枪骑士",
    attack: 16,
    health: 14,
  });
  const target = definitionMinion("BG29_611", "lancer-host");
  const other = definitionMinion("BG25_001", "lancer-other");
  const source = definitionMinion("BG26_146", "lancer-source");
  human.board = [watcher, target, other];
  human.hand = [source];

  const next = gameReducer(state, magneticAction(source, target));
  const [nextWatcher, nextTarget, nextOther] = humanPlayer(next).board;
  assert.equal(nextWatcher.attack, watcher.attack + 10);
  assert.equal(nextOther.health, other.health + 10);
  assert.equal(nextTarget.attack, target.attack + source.attack + 10);
  assert.equal(nextTarget.health, target.health + source.health + 10);
});

test("preserves attached enchantments when three hosts form a Golden minion", () => {
  let state = createGame(4006);
  let human = humanPlayer(state);
  const first = definitionMinion("BG29_611", "triple-host-1", {
    poolCopies: 1,
  });
  const second = definitionMinion("BG29_611", "triple-host-2", {
    poolCopies: 1,
  });
  const third = definitionMinion("BG29_611", "triple-host-3", {
    poolCopies: 1,
  });
  const source = definitionMinion("BG26_146", "triple-source", {
    poolCopies: 1,
  });
  human.board = [first, second];
  human.hand = [source, third];

  state = gameReducer(state, magneticAction(source, first));
  human = humanPlayer(state);
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: third.instanceId,
  });
  human = humanPlayer(state);
  const golden = human.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === first.definitionId &&
      card.golden,
  );
  assert.ok(golden);
  const definition = getMinionDefinition(first.definitionId);
  assert.equal(human.board.length, 0);
  assert.equal(golden.poolCopies, 3);
  assert.equal(golden.attachments.length, 1);
  assert.equal(golden.attachments[0].definitionId, source.definitionId);
  assert.equal(golden.attack, definition.attack * 2 + source.attack);
  assert.equal(golden.health, definition.health * 2 + source.health);
});

test("a Golden Magnetic minion still grants exactly one Triple Reward", () => {
  const state = createGame(4007);
  const human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "reward-host");
  const source = definitionMinion("BG26_146", "reward-source", {
    golden: true,
    name: "金色·催眠机器人",
    attack: 4,
    health: 4,
    grantsTripleReward: true,
    poolCopies: 3,
  });
  human.board = [target];
  human.hand = [source];

  const next = gameReducer(state, magneticAction(source, target));
  const rewards = humanPlayer(next).hand.filter(
    (card) => card.kind === "tripleReward",
  );
  assert.equal(rewards.length, 1);
});

test("runs an attached Golden Auto Assembler Deathrattle in combat", () => {
  let state = createGame(4008);
  let human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "deathrattle-host", {
    attack: 0,
    health: 1,
  });
  const source = definitionMinion("BG32_172", "deathrattle-source", {
    golden: true,
    name: "金色·自动装配机",
    attack: 4,
    health: 4,
    poolCopies: 3,
  });
  human.board = [target];
  human.hand = [source];
  state = gameReducer(state, magneticAction(source, target));
  human = humanPlayer(state);
  const enemy = keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "deathrattle-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  assert.ok(enemy);

  state = gameReducer(state, { type: "END_TURN" });
  const summon = state.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "BG_TTN_401",
  );
  assert.ok(summon);
  assert.equal(summon.minion?.golden, true);
  assert.deepEqual(summon.minion?.attachments, []);
});

test("seven AIs can Magnetize on a full board with the same deterministic rules", () => {
  const state = createGame(4009);
  const human = humanPlayer(state);
  human.board = [];
  human.hand = [];
  human.shop = [];
  const ai = keepOnlyOneOpponent(state);
  const target = definitionMinion("BG29_611", "ai-magnetic-host");
  ai.board = [
    target,
    ...Array.from({ length: 6 }, (_, index) =>
      definitionMinion("BG25_001", `ai-full-board-${index}`, {
        golden: true,
      }),
    ),
  ];
  ai.hand = [
    definitionMinion("BG26_146", "ai-magnetic-source", {
      poolCopies: 1,
    }),
  ];

  const next = gameReducer(state, { type: "END_TURN" });
  const nextAi = next.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(nextAi.board.length, 7);
  assert.equal(nextAi.hand.length, 0);
  assert.equal(
    nextAi.board.some((minion) =>
      minion.attachments.some(
        (attachment) => attachment.definitionId === "BG26_146",
      ),
    ),
    true,
  );
});

test("Magnetic attachment trees survive a JSON save round-trip", () => {
  const state = createGame(4010);
  const human = humanPlayer(state);
  const target = definitionMinion("BG29_611", "save-host");
  const source = definitionMinion("BG26_146", "save-source");
  human.board = [target];
  human.hand = [source];

  const next = gameReducer(state, magneticAction(source, target));
  const restored = JSON.parse(JSON.stringify(next)) as GameState;
  assert.deepEqual(restored, next);
  assert.equal(restored.version, 4);
  assert.equal(
    humanPlayer(restored).board[0].attachments[0].definitionId,
    source.definitionId,
  );
});
