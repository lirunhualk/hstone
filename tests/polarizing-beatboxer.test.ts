import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type MagneticAttachment,
  type PlayerState,
} from "../lib/game/engine.ts";

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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
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
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    description: definition.goldenDescription,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
}

function attachment(
  definitionId: string,
  sourceInstanceId: string,
  overrides: Partial<MagneticAttachment> = {},
): MagneticAttachment {
  const definition = getMinionDefinition(definitionId);
  return {
    sourceInstanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    effectSupport: definition.effectSupport ?? "complete",
    golden: false,
    poolCopies: 0,
    attackGranted: definition.attack,
    healthGranted: definition.health,
    attachments: [],
    ...overrides,
  };
}

function magnetize(
  state: GameState,
  sourceInstanceId: string,
  targetInstanceId: string,
): GameState {
  return gameReducer(state, {
    type: "MAGNETIZE_MINION",
    cardInstanceId: sourceInstanceId,
    targetInstanceId,
  });
}

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): void {
  state.lobbySystemsEnabled = false;
  const enemy = state.players.find((player) => !player.isHuman);
  assert.ok(enemy);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.lastOpponentId = undefined;
    if (player.isHuman) {
      player.alive = true;
      player.health = 1_000;
      player.armor = 0;
      continue;
    }
    player.hand = [];
    player.ghostHand = [];
    if (player.id === enemy.id) {
      player.alive = true;
      player.health = 1_000;
      player.armor = 0;
      player.board = enemyBoard;
      continue;
    }
    player.alive = false;
    player.health = 0;
    player.board = [];
    player.eliminatedRound = 0;
  }
}

function restrictPool(
  state: GameState,
  copies: Readonly<Record<string, number>>,
): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const [definitionId, count] of Object.entries(copies)) {
    state.pool[definitionId] = count;
  }
}

function attachmentTreeHasNoPoolCopies(
  value: MagneticAttachment,
): boolean {
  return (
    value.poolCopies === 0 &&
    value.attachments.every(attachmentTreeHasNoPoolCopies)
  );
}

test("Polarizing Beatboxer exposes the exact ordinary and Golden Tier 7 rules", () => {
  const definition = getMinionDefinition("BG26_149");
  assert.deepEqual(
    [
      definition.tier,
      definition.tribe,
      definition.attack,
      definition.health,
      definition.effectSupport,
    ],
    [7, "mech", 5, 10, "complete"],
  );
  assert.equal(
    definition.description,
    "每当你对一个不同的随从磁力吸附时，还会对本随从磁力吸附。",
  );
  assert.equal(definition.goldenCardId, "BG26_149_G");
  assert.equal(
    definition.goldenDescription,
    "每当你对一个不同的随从磁力吸附时，还会对本随从磁力吸附两次。",
  );
  assert.deepEqual(definition.copyOtherMagnetization, {
    copies: 1,
    goldenMode: "doubleCopies",
  });
});

test("multiple Beatboxers copy one complete enchanted attachment tree without duplicating pool ownership", () => {
  const state = createGame(0x7410);
  const player = humanPlayer(state);
  const target = definitionMinion("BG29_611", "beatboxer-host");
  const first = definitionMinion("BG26_149", "beatboxer-first");
  const second = definitionMinion("BG26_149", "beatboxer-second");
  const nestedChild = attachment("BG29_503", "beatboxer-nested-child", {
    poolCopies: 1,
    attackGranted: 3,
    healthGranted: 4,
  });
  const nestedParent = attachment("BG26_147", "beatboxer-nested-parent", {
    poolCopies: 2,
    attackGranted: 5,
    healthGranted: 6,
    attachments: [nestedChild],
  });
  const source = definitionMinion("BG26_146", "beatboxer-magnetic", {
    attack: 19,
    health: 23,
    poolCopies: 1,
    attachments: [nestedParent],
    bloodGemAttack: 2,
    bloodGemHealth: 3,
    temporaryAttack: 2,
    temporaryHealth: 3,
    taunt: true,
    divineShield: true,
    reborn: true,
    windfury: true,
  });
  const targetBefore = [target.attack, target.health] as const;
  const firstBefore = [first.attack, first.health] as const;
  const secondBefore = [second.attack, second.health] as const;
  const sourcePoolBefore = state.pool[source.definitionId] ?? 0;
  const parentPoolBefore = state.pool[nestedParent.definitionId] ?? 0;
  const childPoolBefore = state.pool[nestedChild.definitionId] ?? 0;
  player.board = [target, first, second];
  player.hand = [source];
  const replay = JSON.parse(JSON.stringify(state)) as GameState;

  const next = magnetize(state, source.instanceId, target.instanceId);
  const replayNext = magnetize(
    replay,
    source.instanceId,
    target.instanceId,
  );
  assert.deepEqual(replayNext, next);
  const resolved = humanPlayer(next);
  const resolvedTarget = resolved.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  const resolvedFirst = resolved.board.find(
    (minion) => minion.instanceId === first.instanceId,
  );
  const resolvedSecond = resolved.board.find(
    (minion) => minion.instanceId === second.instanceId,
  );
  assert.ok(resolvedTarget);
  assert.ok(resolvedFirst);
  assert.ok(resolvedSecond);
  assert.deepEqual(
    [resolvedTarget.attack, resolvedTarget.health],
    [targetBefore[0] + source.attack, targetBefore[1] + source.health],
  );
  assert.deepEqual(
    [resolvedFirst.attack, resolvedFirst.health],
    [firstBefore[0] + source.attack, firstBefore[1] + source.health],
  );
  assert.deepEqual(
    [resolvedSecond.attack, resolvedSecond.health],
    [secondBefore[0] + source.attack, secondBefore[1] + source.health],
  );
  assert.equal(resolvedTarget.attachments.length, 1);
  assert.equal(resolvedFirst.attachments.length, 1);
  assert.equal(resolvedSecond.attachments.length, 1);
  assert.deepEqual(
    resolvedFirst.attachments[0],
    resolvedTarget.attachments[0],
  );
  assert.deepEqual(
    resolvedSecond.attachments[0],
    resolvedTarget.attachments[0],
  );
  assert.notStrictEqual(
    resolvedFirst.attachments[0],
    resolvedTarget.attachments[0],
  );
  assert.notStrictEqual(
    resolvedFirst.attachments[0].attachments[0],
    resolvedTarget.attachments[0].attachments[0],
  );
  assert.ok(
    [resolvedTarget, resolvedFirst, resolvedSecond].every((minion) =>
      minion.attachments.every(attachmentTreeHasNoPoolCopies),
    ),
  );
  assert.ok(
    [resolvedTarget, resolvedFirst, resolvedSecond].every(
      (minion) =>
        minion.taunt &&
        minion.divineShield &&
        minion.reborn &&
        minion.windfury &&
        minion.bloodGemAttack === 2 &&
        minion.bloodGemHealth === 3 &&
        minion.temporaryAttack === 2 &&
        minion.temporaryHealth === 3,
    ),
  );
  assert.equal(resolved.magnetizationsThisGame, 1);
  assert.equal(next.pool[source.definitionId], sourcePoolBefore + 1);
  assert.equal(next.pool[nestedParent.definitionId], parentPoolBefore + 2);
  assert.equal(next.pool[nestedChild.definitionId], childPoolBefore + 1);
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
});

test("a targeted Beatboxer does not copy itself while another Golden Beatboxer copies twice", () => {
  const state = createGame(0x7411);
  const player = humanPlayer(state);
  const target = definitionMinion("BG26_149", "beatboxer-direct-target");
  const golden = goldenMinion("BG26_149", "beatboxer-golden-watcher");
  const source = definitionMinion("BG26_146", "beatboxer-golden-source");
  const targetBefore = [target.attack, target.health] as const;
  const goldenBefore = [golden.attack, golden.health] as const;
  player.board = [target, golden];
  player.hand = [source];

  const next = magnetize(state, source.instanceId, target.instanceId);
  const resolved = humanPlayer(next);
  const resolvedTarget = resolved.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  const resolvedGolden = resolved.board.find(
    (minion) => minion.instanceId === golden.instanceId,
  );
  assert.ok(resolvedTarget);
  assert.ok(resolvedGolden);
  assert.equal(resolvedTarget.attachments.length, 1);
  assert.equal(resolvedGolden.attachments.length, 2);
  assert.deepEqual(
    [resolvedTarget.attack, resolvedTarget.health],
    [targetBefore[0] + source.attack, targetBefore[1] + source.health],
  );
  assert.deepEqual(
    [resolvedGolden.attack, resolvedGolden.health],
    [
      goldenBefore[0] + source.attack * 2,
      goldenBefore[1] + source.health * 2,
    ],
  );
  assert.equal(resolved.magnetizationsThisGame, 1);
});

test("three ordinary Beatboxers form a real Golden that copies later Magnetizations twice", () => {
  let state = createGame(0x7412);
  let player = humanPlayer(state);
  const target = definitionMinion("BG29_611", "beatboxer-triple-target");
  const first = definitionMinion("BG26_149", "beatboxer-triple-1");
  const second = definitionMinion("BG26_149", "beatboxer-triple-2");
  const third = definitionMinion("BG26_149", "beatboxer-triple-3");
  const source = definitionMinion("BG26_146", "beatboxer-triple-source");
  player.board = [target, first, second];
  player.hand = [third, source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: third.instanceId,
  });
  player = humanPlayer(state);
  const golden = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG26_149" &&
      card.golden,
  );
  assert.ok(golden);
  assert.equal(golden.grantsTripleReward, true);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: golden.instanceId,
  });
  player = humanPlayer(state);
  const playedGolden = player.board.find(
    (minion) => minion.definitionId === "BG26_149" && minion.golden,
  );
  assert.ok(playedGolden);
  const before = [playedGolden.attack, playedGolden.health] as const;
  state = magnetize(state, source.instanceId, target.instanceId);
  const resolvedGolden = humanPlayer(state).board.find(
    (minion) => minion.instanceId === playedGolden.instanceId,
  );
  assert.ok(resolvedGolden);
  assert.equal(resolvedGolden.cardId, "BG26_149_G");
  assert.equal(resolvedGolden.attachments.length, 2);
  assert.deepEqual(
    [resolvedGolden.attack, resolvedGolden.health],
    [before[0] + source.attack * 2, before[1] + source.health * 2],
  );
});

test("combat Magnetization animates a Beatboxer copy without changing its persistent Recruit snapshot", () => {
  const state = createGame(0xfb83);
  const player = humanPlayer(state);
  player.tavernTier = 6;
  const target = definitionMinion("BG29_611", "beatboxer-combat-target", {
    attack: 0,
    health: 100_000,
  });
  const beatboxer = definitionMinion("BG26_149", "beatboxer-combat-watcher", {
    attack: 0,
    health: 100_000,
  });
  const clunker = definitionMinion("BG29_503", "beatboxer-combat-clunker", {
    attack: 0,
    health: 100_000,
  });
  const rylak = definitionMinion("BG26_801", "beatboxer-combat-rylak", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  player.board = [target, beatboxer, clunker, rylak];
  prepareDuel(state, [
    definitionMinion("defender-of-argus", "beatboxer-combat-wall", {
      attack: 100,
      health: 1_000,
      taunt: true,
      divineShield: false,
    }),
  ]);
  restrictPool(state, { BG26_146: 1 });

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const copies = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === beatboxer.instanceId &&
      event.targetInstanceId === beatboxer.instanceId,
  );
  assert.equal(copies.length, 1);
  assert.ok(copies.every(isCombatPlaybackEvent));
  assert.equal(copies[0].minion?.attachments.length, 1);
  const persistentBeatboxer = humanPlayer(combat).board.find(
    (minion) => minion.instanceId === beatboxer.instanceId,
  );
  const persistentTarget = humanPlayer(combat).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(persistentBeatboxer);
  assert.ok(persistentTarget);
  assert.deepEqual(
    [
      persistentBeatboxer.attack,
      persistentBeatboxer.health,
      persistentBeatboxer.attachments.length,
    ],
    [beatboxer.attack, beatboxer.health, 0],
  );
  assert.deepEqual(
    [
      persistentTarget.attack,
      persistentTarget.health,
      persistentTarget.attachments.length,
    ],
    [target.attack, target.health, 0],
  );
  assert.equal(combat.pool.BG26_146, 1);
  const replay = JSON.parse(JSON.stringify(combat)) as GameState;
  const replayBeatboxer = humanPlayer(replay).board.find(
    (minion) => minion.instanceId === beatboxer.instanceId,
  );
  assert.ok(replayBeatboxer);
  assert.deepEqual(
    [replayBeatboxer.attack, replayBeatboxer.health, replayBeatboxer.attachments.length],
    [beatboxer.attack, beatboxer.health, 0],
  );
  const replayCopies = replay.lastBattle?.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === beatboxer.instanceId &&
      event.targetInstanceId === beatboxer.instanceId,
  );
  assert.equal(replayCopies?.length, 1);
  assert.ok(replayCopies?.every(isCombatPlaybackEvent));
});
