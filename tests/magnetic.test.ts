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

function keepOnlyMechDiscoverPool(
  state: GameState,
  definitionIds: readonly string[],
): void {
  state.activeTribes = [
    "beast",
    "mech",
    "demon",
    "murloc",
    "dragon",
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of definitionIds) {
    state.pool[definitionId] = 1;
  }
}

function keepOnlySpecifiedPool(
  state: GameState,
  copiesByDefinitionId: Readonly<Record<string, number>>,
): void {
  state.activeTribes = [
    "beast",
    "mech",
    "demon",
    "murloc",
    "dragon",
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const [definitionId, copies] of Object.entries(
    copiesByDefinitionId,
  )) {
    state.pool[definitionId] = copies;
  }
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

test("Clunker Junker targets an existing Mech, discovers any Mech, and Magnetizes it directly", () => {
  let state = createGame(4013);
  let human = humanPlayer(state);
  human.tavernTier = 4;
  const target = definitionMinion("BG29_611", "clunker-host");
  const watcher = definitionMinion("BG34_175", "clunker-watcher");
  const nonMech = definitionMinion("BG25_001", "clunker-non-mech");
  const source = definitionMinion("BG29_503", "clunker-source");
  human.board = [target, watcher, nonMech];
  human.hand = [source];
  keepOnlyMechDiscoverPool(state, [
    "BG29_503",
    "BG_BOT_911",
    "BG32_172",
  ]);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  human = humanPlayer(state);
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "magnetizeTarget");
  assert.deepEqual(pending.optionInstanceIds, [
    target.instanceId,
    watcher.instanceId,
  ]);
  assert.equal(
    pending.optionInstanceIds.includes(source.instanceId),
    false,
  );
  assert.strictEqual(
    gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: source.instanceId,
    }),
    state,
  );

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.deepEqual(pending.destination, {
    kind: "magnetize",
    targetInstanceId: target.instanceId,
  });
  assert.equal(pending.filter.tribe, "mech");
  assert.equal(pending.filter.maximumTier, human.tavernTier);
  assert.equal(pending.remainingDiscoveries, 1);
  assert.deepEqual(
    pending.options
      .map((option) => option.definitionId)
      .sort(),
    ["BG29_503", "BG32_172", "BG_BOT_911"].sort(),
  );
  assert.equal(getMinionDefinition("BG29_503").magnetic, undefined);
  const discoveredClunker = pending.options.find(
    (option) => option.definitionId === "BG29_503",
  );
  assert.ok(discoveredClunker);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: discoveredClunker.instanceId,
  });
  human = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(human.hand.length, 0);
  const fusedHost = human.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(fusedHost);
  assert.equal(
    fusedHost.attack,
    target.attack + discoveredClunker.attack + 5,
  );
  assert.equal(
    fusedHost.health,
    target.health + discoveredClunker.health + 5,
  );
  assert.equal(fusedHost.attachments.length, 1);
  assert.equal(
    fusedHost.attachments[0].definitionId,
    discoveredClunker.definitionId,
  );
  assert.equal(fusedHost.attachments[0].poolCopies, 0);
  assert.equal(
    human.board.find(
      (minion) => minion.instanceId === watcher.instanceId,
    )?.attack,
    watcher.attack + 5,
  );
  assert.equal(
    human.board.find(
      (minion) => minion.instanceId === source.instanceId,
    )?.health,
    source.health + 5,
  );
  for (const definitionId of [
    "BG29_503",
    "BG_BOT_911",
    "BG32_172",
  ]) {
    assert.equal(state.pool[definitionId], 1);
  }

  const selectedPoolAfterAttachment =
    state.pool[discoveredClunker.definitionId];
  const targetIndex = human.board.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: targetIndex,
  });
  assert.equal(
    state.pool[discoveredClunker.definitionId],
    selectedPoolAfterAttachment,
  );
});

test("Golden Clunker Junker with Brann chains four discoveries onto one host even with a full hand", () => {
  let state = createGame(4014);
  let human = humanPlayer(state);
  human.tavernTier = 6;
  const target = definitionMinion("BG29_611", "golden-clunker-host");
  const brann = definitionMinion("BG_LOE_077", "golden-clunker-brann");
  const source = definitionMinion("BG29_503", "golden-clunker-source", {
    golden: true,
    name: "金色·废铁残械",
    attack: 6,
    health: 8,
    grantsTripleReward: true,
  });
  const fillers = Array.from({ length: 9 }, (_, index) =>
    definitionMinion("BG25_001", `golden-clunker-filler-${index}`, {
      golden: true,
    }),
  );
  human.board = [target, brann];
  human.hand = [...fillers, source];
  keepOnlyMechDiscoverPool(state, [
    "BG29_503",
    "BG_BOT_911",
    "BG32_172",
  ]);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  human = humanPlayer(state);
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "magnetizeTarget");
  assert.equal(pending.remainingDiscoveries, 4);
  assert.equal(human.hand.length, 10);
  assert.equal(
    human.hand.some((card) => card.kind === "tripleReward"),
    true,
  );

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });
  for (let remaining = 4; remaining > 0; remaining -= 1) {
    pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover");
    assert.equal(pending.remainingDiscoveries, remaining);
    assert.deepEqual(pending.destination, {
      kind: "magnetize",
      targetInstanceId: target.instanceId,
    });
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: pending.options[0].instanceId,
    });
  }

  human = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(human.hand.length, 10);
  assert.equal(
    human.board.find(
      (minion) => minion.instanceId === target.instanceId,
    )?.attachments.length,
    4,
  );
});

test("Clunker Junker does nothing without a different friendly Mech", () => {
  const state = createGame(4015);
  const human = humanPlayer(state);
  const source = definitionMinion("BG29_503", "lonely-clunker");
  human.board = [
    definitionMinion("BG25_001", "lonely-clunker-undead"),
  ];
  human.hand = [source];

  const next = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  assert.equal(next.pendingInteraction, null);
  assert.equal(
    humanPlayer(next).board.some(
      (minion) => minion.instanceId === source.instanceId,
    ),
    true,
  );
});

test("Clunker Junker releases discover options if its saved target disappears", () => {
  let state = createGame(4017);
  let human = humanPlayer(state);
  human.tavernTier = 4;
  const target = definitionMinion("BG29_611", "stale-clunker-host");
  const source = definitionMinion("BG29_503", "stale-clunker-source");
  human.board = [target];
  human.hand = [source];
  const discoverIds = ["BG29_503", "BG_BOT_911", "BG32_172"];
  keepOnlyMechDiscoverPool(state, discoverIds);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "magnetizeTarget");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");

  human = humanPlayer(state);
  human.board = human.board.filter(
    (minion) => minion.instanceId !== target.instanceId,
  );
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });

  assert.equal(state.pendingInteraction, null);
  for (const definitionId of discoverIds) {
    assert.equal(state.pool[definitionId], 1);
  }
});

test("AI deterministically chooses the strongest Clunker Junker host and discovered Mech", () => {
  const first = createGame(4016);
  keepOnlyMechDiscoverPool(first, [
    "BG26_146",
    "BG_BOT_911",
    "BG35_890",
  ]);
  for (const player of first.players) {
    player.gold = 0;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.frozen = false;
  }
  const ai = first.players[1];
  ai.tavernTier = 6;
  ai.board = [
    definitionMinion("BG29_611", "ai-clunker-strong-host", {
      attack: 40,
      health: 40,
    }),
    definitionMinion("BG29_611", "ai-clunker-weak-host", {
      attack: 1,
      health: 1,
    }),
  ];
  ai.hand = [
    definitionMinion("BG29_503", "ai-clunker-source"),
  ];
  const replay = JSON.parse(JSON.stringify(first)) as GameState;

  const firstResult = gameReducer(first, { type: "END_TURN" });
  const replayResult = gameReducer(replay, { type: "END_TURN" });
  assert.deepEqual(replayResult, firstResult);
  const resolvedAi = firstResult.players[1];
  const strongHost = resolvedAi.board.find(
    (minion) => minion.instanceId === "ai-clunker-strong-host",
  );
  const weakHost = resolvedAi.board.find(
    (minion) => minion.instanceId === "ai-clunker-weak-host",
  );
  assert.equal(strongHost?.attachments.length, 1);
  assert.equal(
    strongHost?.attachments[0].definitionId,
    "BG35_890",
  );
  assert.equal(weakHost?.attachments.length, 0);
  assert.equal(firstResult.pendingInteraction, null);
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

test("Scrap Scraper gains a pooled Magnetic Mech in combat and keeps it after Continue", () => {
  let state = createGame(4020);
  let human = humanPlayer(state);
  human.tavernTier = 1;
  const scraper = definitionMinion("BG26_148", "scrap-scraper", {
    attack: 1,
    health: 1,
    taunt: true,
  });
  human.board = [scraper];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "scrap-scraper-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  state = gameReducer(state, { type: "END_TURN" });
  human = humanPlayer(state);
  assert.equal(state.phase, "combat");
  assert.equal(state.pool.BG26_146, 0);
  assert.equal(human.hand.length, 1);
  const gained = human.hand[0];
  assert.equal(gained.kind, "minion");
  assert.equal(
    gained.kind === "minion" ? gained.definitionId : undefined,
    "BG26_146",
  );
  assert.equal(
    gained.kind === "minion" ? gained.poolCopies : undefined,
    1,
  );

  const events =
    state.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === human.id,
    ) ?? [];
  assert.equal(events.length, 1);
  assert.equal(events[0].cardGainResult, "added");
  assert.equal(events[0].amount, 1);
  assert.equal(events[0].targetInstanceId, gained.instanceId);
  assert.equal(events[0].minion?.definitionId, "BG26_146");
  assert.match(events[0].message, /获得了「催眠机器人」/u);
  assert.deepEqual(
    JSON.parse(JSON.stringify(events)),
    events,
  );

  state = gameReducer(state, { type: "CONTINUE" });
  human = humanPlayer(state);
  assert.equal(state.phase, "recruit");
  assert.equal(
    human.hand.some(
      (card) => card.instanceId === gained.instanceId,
    ),
    true,
  );
});

test("Golden Scrap Scraper with Golden Titus resolves six independent gains", () => {
  const state = createGame(4021);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  human.board = [
    definitionMinion("BG26_148", "golden-scrap-scraper", {
      golden: true,
      name: "金色·报废废铁回收机",
      attack: 1,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG25_354", "golden-scrap-titus", {
      golden: true,
      name: "金色·提图斯·瑞文戴尔",
      attack: 2,
      health: 14,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "golden-scrap-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 6 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === human.id,
    ) ?? [];
  assert.equal(events.length, 6);
  assert.equal(
    events.every(
      (event) =>
        event.cardGainResult === "added" &&
        event.minion?.definitionId === "BG26_146",
    ),
    true,
  );
  assert.equal(next.pool.BG26_146, 0);
  assert.equal(nextHuman.hand.length, 2);
  assert.equal(
    nextHuman.hand.every(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === "BG26_146" &&
        card.golden,
    ),
    true,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(next.lastBattle?.events)),
    next.lastBattle?.events,
  );
});

test("Scrap Scraper respects Tavern tier and Magnetic filters for every Titus repetition", () => {
  const state = createGame(4022);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  human.board = [
    definitionMinion("BG26_148", "filtered-scrap-scraper", {
      attack: 1,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG25_354", "filtered-scrap-titus"),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "filtered-scrap-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, {
    BG26_146: 1,
    BG_BOT_911: 4,
    BG29_611: 4,
  });

  const next = gameReducer(state, { type: "END_TURN" });
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === human.id,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["added", "noCandidate"],
  );
  assert.equal(events[0].minion?.definitionId, "BG26_146");
  assert.equal(events[1].amount, 0);
  assert.equal(next.pool.BG26_146, 0);
  assert.equal(next.pool.BG_BOT_911, 4);
  assert.equal(next.pool.BG29_611, 4);
});

test("Scrap Scraper does not touch the pool when the hand is already full", () => {
  const state = createGame(4023);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  human.board = [
    definitionMinion("BG26_148", "full-hand-scrap-scraper", {
      attack: 1,
      health: 1,
      taunt: true,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "full-hand-scrap-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  human.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion("BG25_001", `full-hand-scrap-${index}`, {
      golden: true,
    }),
  );
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === human.id,
    ) ?? [];
  assert.equal(nextHuman.hand.length, 10);
  assert.equal(next.nextInstanceId, state.nextInstanceId);
  assert.equal(next.pool.BG26_146, 1);
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["handFull"],
  );
  assert.equal(events[0].amount, 0);
  assert.equal(events[0].minion, undefined);
});

test("Scrap Scraper resolves triples between Titus gain attempts to free hand space", () => {
  const state = createGame(4024);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  human.board = [
    definitionMinion("BG26_148", "triple-space-scrap-scraper", {
      attack: 1,
      health: 1,
      taunt: true,
    }),
    definitionMinion("BG25_354", "triple-space-scrap-titus"),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "triple-space-scrap-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  human.hand = [
    definitionMinion("BG26_146", "triple-space-magnetic-1", {
      poolCopies: 1,
    }),
    definitionMinion("BG26_146", "triple-space-magnetic-2", {
      poolCopies: 1,
    }),
    ...Array.from({ length: 7 }, (_, index) =>
      definitionMinion("BG25_001", `triple-space-filler-${index}`, {
        golden: true,
      }),
    ),
  ];
  keepOnlySpecifiedPool(state, { BG26_146: 2 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === human.id,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["added", "added"],
  );
  assert.equal(next.pool.BG26_146, 0);
  assert.equal(nextHuman.hand.length, 9);
  const magnetics = nextHuman.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG26_146",
  );
  assert.equal(magnetics.length, 2);
  assert.equal(
    magnetics.filter((minion) => minion.golden).length,
    1,
  );
  assert.equal(
    magnetics.filter((minion) => !minion.golden).length,
    1,
  );
});

test("AI Scrap Scraper gains from the same pool without revealing its card in combat events", () => {
  const state = createGame(4025);
  const human = humanPlayer(state);
  const ai = keepOnlyOneOpponent(state);
  human.board = [
    definitionMinion("BG25_001", "ai-scrap-human-enemy", {
      attack: 100,
      health: 100,
    }),
  ];
  ai.tavernTier = 1;
  ai.board = [
    definitionMinion("BG26_148", "ai-scrap-scraper", {
      attack: 1,
      health: 1,
      taunt: true,
    }),
  ];
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextAi = next.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(nextAi.hand.length, 1);
  assert.equal(nextAi.hand[0].kind, "minion");
  assert.equal(
    nextAi.hand[0].kind === "minion"
      ? nextAi.hand[0].definitionId
      : undefined,
    "BG26_146",
  );
  assert.equal(next.pool.BG26_146, 0);
  const event = next.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorPlayerId === ai.id,
  );
  assert.ok(event);
  assert.equal(event.cardGainResult, "added");
  assert.equal(event.minion, undefined);
  assert.equal(event.targetInstanceId, undefined);
  assert.match(event.message, /获得了一张磁力机械/u);
});

test("an eliminated player releases Scrap Scraper combat gains back to the shared pool", () => {
  const state = createGame(4027);
  const human = humanPlayer(state);
  human.health = 1;
  human.tavernTier = 1;
  human.board = [
    definitionMinion("BG26_148", "eliminated-scrap-scraper", {
      attack: 0,
      health: 1,
      taunt: true,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "eliminated-scrap-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const event = next.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorPlayerId === human.id,
  );
  assert.ok(event);
  assert.equal(event.cardGainResult, "added");
  assert.equal(nextHuman.alive, false);
  assert.deepEqual(nextHuman.hand, []);
  assert.equal(next.pool.BG26_146, 1);
});

test("an eliminated ghost Scrap Scraper cannot gain permanent cards", () => {
  const state = createGame(4026);
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.frozen = false;
    player.eliminatedRound = undefined;
  }
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 40;
    player.board = [
      definitionMinion("BG25_001", `ghost-scrap-living-${index}`, {
        attack: 100,
        health: 100,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.board = [
    definitionMinion("BG26_148", "ghost-scrap-scraper", {
      attack: 1,
      health: 1,
      taunt: true,
    }),
  ];
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = next.lastRoundBattles.find(
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
  assert.equal(next.pool.BG26_146, 1);
  assert.equal(next.players[3].hand.length, 0);
});

test("Mobile Projection Rally gains before combat damage and persists after Continue", () => {
  let state = createGame(4030);
  let human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "mobile-projection-order",
    { taunt: true },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "mobile-projection-order-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "mobile-projection-order-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  state = gameReducer(state, { type: "END_TURN" });
  human = humanPlayer(state);
  const battle = state.lastBattle;
  assert.ok(battle);
  const attack = battle.events.find(
    (event) =>
      event.type === "attack" &&
      event.actorInstanceId === projection.instanceId,
  );
  const gain = battle.events.find(
    (event) =>
      event.type === "cardGain" &&
      event.actorInstanceId === projection.instanceId,
  );
  const shieldBreak = battle.events.find(
    (event) =>
      event.type === "shieldBroken" &&
      event.targetInstanceId === projection.instanceId,
  );
  assert.ok(attack);
  assert.ok(gain);
  assert.ok(shieldBreak);
  assert.ok(attack.index < gain.index);
  assert.ok(gain.index < shieldBreak.index);
  assert.equal(gain.cardGainResult, "added");
  assert.equal(gain.minion?.definitionId, "BG26_146");
  assert.equal(human.hand.length, 1);
  assert.equal(human.hand[0].instanceId, gain.targetInstanceId);
  assert.equal(state.pool.BG26_146, 0);

  const gainedInstanceId = human.hand[0].instanceId;
  state = gameReducer(state, { type: "CONTINUE" });
  human = humanPlayer(state);
  assert.equal(state.phase, "recruit");
  assert.equal(
    human.hand.some((card) => card.instanceId === gainedInstanceId),
    true,
  );
});

test("Golden Mobile Projection resolves two independent Rally gains per attack", () => {
  const state = createGame(4031);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "golden-mobile-projection",
    {
      golden: true,
      name: "金色·移动投影仪",
      attack: 8,
      health: 12,
      taunt: true,
    },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "golden-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "golden-mobile-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 2 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === projection.instanceId,
    ) ?? [];
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["added", "added"],
  );
  assert.equal(
    events.every((event) => event.minion?.definitionId === "BG26_146"),
    true,
  );
  assert.equal(nextHuman.hand.length, 2);
  assert.equal(next.pool.BG26_146, 0);
});

test("Windfury Mobile Projection Rallies once for each strike", () => {
  const state = createGame(4032);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "windfury-mobile-projection",
    {
      windfury: true,
      taunt: true,
    },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "windfury-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "windfury-mobile-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 2 });

  const next = gameReducer(state, { type: "END_TURN" });
  const relevantEvents =
    next.lastBattle?.events.filter(
      (event) =>
        event.actorInstanceId === projection.instanceId &&
        (event.type === "attack" || event.type === "cardGain"),
    ) ?? [];
  assert.deepEqual(
    relevantEvents.map((event) => event.type),
    ["attack", "cardGain", "attack", "cardGain"],
  );
  assert.equal(
    relevantEvents.filter(
      (event) =>
        event.type === "cardGain" &&
        event.cardGainResult === "added",
    ).length,
    2,
  );
  assert.equal(humanPlayer(next).hand.length, 2);
  assert.equal(next.pool.BG26_146, 0);
});

test("Mobile Projection does not draw or allocate when its owner's hand is full", () => {
  const state = createGame(4033);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "full-hand-mobile-projection",
    { taunt: true },
  );
  human.board = [
    projection,
    definitionMinion("BG26_146", "full-hand-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG26_146", "full-hand-mobile-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  human.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion("BG25_001", `full-hand-mobile-projection-${index}`, {
      golden: true,
    }),
  );
  keepOnlySpecifiedPool(state, { BG26_146: 1 });
  const nextInstanceIdBefore = state.nextInstanceId;

  const next = gameReducer(state, { type: "END_TURN" });
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === projection.instanceId,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["handFull"],
  );
  assert.equal(humanPlayer(next).hand.length, 10);
  assert.equal(next.pool.BG26_146, 1);
  assert.equal(next.nextInstanceId, nextInstanceIdBefore);
});

test("Golden Mobile Projection uses its only open hand slot before reporting full", () => {
  const state = createGame(4034);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "one-slot-mobile-projection",
    {
      golden: true,
      name: "金色·移动投影仪",
      attack: 8,
      health: 12,
      taunt: true,
    },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "one-slot-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "one-slot-mobile-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  human.hand = Array.from({ length: 9 }, (_, index) =>
    definitionMinion("BG25_001", `one-slot-mobile-projection-${index}`, {
      golden: true,
    }),
  );
  keepOnlySpecifiedPool(state, { BG26_146: 2 });

  const next = gameReducer(state, { type: "END_TURN" });
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === projection.instanceId,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["added", "handFull"],
  );
  assert.equal(humanPlayer(next).hand.length, 10);
  assert.equal(next.pool.BG26_146, 1);
});

test("Mobile Projection filters non-Magnetic and higher-Tier pool copies before reporting no candidate", () => {
  const state = createGame(4035);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "filtered-mobile-projection",
    { taunt: true },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "filtered-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "filtered-mobile-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, {
    BG29_611: 4,
    BG_BOT_911: 4,
  });

  const next = gameReducer(state, { type: "END_TURN" });
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === projection.instanceId,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["noCandidate"],
  );
  assert.equal(events[0].amount, 0);
  assert.equal(events[0].minion, undefined);
  assert.equal(humanPlayer(next).hand.length, 0);
  assert.equal(next.pool.BG29_611, 4);
  assert.equal(next.pool.BG_BOT_911, 4);
});

test("Mobile Projection resolves a triple between Golden Rally gain attempts", () => {
  const state = createGame(4036);
  const human = humanPlayer(state);
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "triple-space-mobile-projection",
    {
      golden: true,
      name: "金色·移动投影仪",
      attack: 8,
      health: 12,
      taunt: true,
    },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "triple-space-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "triple-space-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  human.hand = [
    definitionMinion("BG26_146", "triple-space-projection-magnetic-1", {
      poolCopies: 1,
    }),
    definitionMinion("BG26_146", "triple-space-projection-magnetic-2", {
      poolCopies: 1,
    }),
    ...Array.from({ length: 7 }, (_, index) =>
      definitionMinion("BG25_001", `triple-space-projection-${index}`, {
        golden: true,
      }),
    ),
  ];
  keepOnlySpecifiedPool(state, { BG26_146: 2 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const events =
    next.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === projection.instanceId,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["added", "added"],
  );
  assert.equal(next.pool.BG26_146, 0);
  assert.equal(nextHuman.hand.length, 9);
  const magnetics = nextHuman.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG26_146",
  );
  assert.equal(magnetics.length, 2);
  assert.equal(
    magnetics.filter((minion) => minion.golden).length,
    1,
  );
  assert.equal(
    magnetics.filter((minion) => !minion.golden).length,
    1,
  );
});

test("AI Mobile Projection uses the shared pool without revealing its gained card", () => {
  const state = createGame(4037);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG25_001", "ai-mobile-projection-human", {
      attack: 100,
      health: 100,
    }),
  ];
  const ai = keepOnlyOneOpponent(state);
  ai.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "ai-mobile-projection",
    { taunt: true },
  );
  ai.board = [
    projection,
    definitionMinion("BG25_001", "ai-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextAi = next.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(nextAi.hand.length, 1);
  assert.equal(nextAi.hand[0].kind, "minion");
  assert.equal(
    nextAi.hand[0].kind === "minion"
      ? nextAi.hand[0].definitionId
      : undefined,
    "BG26_146",
  );
  assert.equal(next.pool.BG26_146, 0);
  const event = next.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorInstanceId === projection.instanceId,
  );
  assert.ok(event);
  assert.equal(event.cardGainResult, "added");
  assert.equal(event.minion, undefined);
  assert.equal(event.targetInstanceId, undefined);
  assert.match(event.message, /获得了一张磁力机械/u);
});

test("an eliminated ghost Mobile Projection cannot gain permanent cards", () => {
  const state = createGame(4038);
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.frozen = false;
    player.eliminatedRound = undefined;
  }
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 40;
    player.board = [
      definitionMinion("BG25_001", `mobile-projection-living-${index}`, {
        attack: 100,
        health: 100,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const projection = definitionMinion(
    "BG31_175",
    "ghost-mobile-projection",
    { taunt: true },
  );
  ghost.board = [
    projection,
    definitionMinion("BG25_001", "ghost-mobile-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = next.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === projection.instanceId,
    ),
    false,
  );
  assert.equal(next.pool.BG26_146, 1);
  assert.equal(next.players[3].hand.length, 0);
});

test("an eliminated player releases Mobile Projection Rally gains back to the shared pool", () => {
  const state = createGame(4039);
  const human = humanPlayer(state);
  human.health = 1;
  human.tavernTier = 1;
  const projection = definitionMinion(
    "BG31_175",
    "eliminated-mobile-projection",
    { taunt: true },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "eliminated-projection-filler", {
      attack: 0,
      health: 1,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "eliminated-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, { BG26_146: 1 });

  const next = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(next);
  const event = next.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorInstanceId === projection.instanceId,
  );
  assert.ok(event);
  assert.equal(event.cardGainResult, "added");
  assert.equal(nextHuman.alive, false);
  assert.deepEqual(nextHuman.hand, []);
  assert.equal(next.pool.BG26_146, 1);
});

test("Mobile Projection Rally remains deterministic for identical seeded states", () => {
  const state = createGame(4040);
  const human = humanPlayer(state);
  human.tavernTier = 3;
  const projection = definitionMinion(
    "BG31_175",
    "deterministic-mobile-projection",
    {
      windfury: true,
      taunt: true,
    },
  );
  human.board = [
    projection,
    definitionMinion("BG25_001", "deterministic-projection-filler", {
      attack: 0,
      health: 100,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG25_001", "deterministic-projection-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);
  keepOnlySpecifiedPool(state, {
    BG26_146: 3,
    BG_BOT_911: 3,
  });

  const first = gameReducer(state, { type: "END_TURN" });
  const second = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(first, second);
  assert.deepEqual(
    JSON.parse(JSON.stringify(first.lastBattle?.events)),
    first.lastBattle?.events,
  );
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
  assert.equal(restored.version, 5);
  assert.equal(
    humanPlayer(restored).board[0].attachments[0].definitionId,
    source.definitionId,
  );
});
