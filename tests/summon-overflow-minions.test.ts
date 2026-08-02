import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type MagneticAttachment,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";

const FILLER_DEFINITION_IDS = [
  "tabbycat-token",
  "hyena-token",
  "voidwalker-token",
  "damaged-golem-token",
  "rat-token",
  "sky-pirate-token",
] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function minion(
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
  return minion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    attack: definition.attack * 2,
    health: definition.health * 2,
    description: definition.goldenDescription,
    ...overrides,
  });
}

function attachment(
  definitionId: string,
  sourceInstanceId: string,
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
    attackGranted: 0,
    healthGranted: 0,
    attachments: [],
  };
}

function fillers(
  count: number,
  prefix: string,
  health = 20,
): BoardMinionInstance[] {
  return FILLER_DEFINITION_IDS.slice(0, count).map(
    (definitionId, index) =>
      minion(definitionId, `${prefix}-${index}`, {
        attack: 0,
        health,
        taunt: false,
        divineShield: false,
        reborn: false,
      }),
  );
}

function playGraverobberAndDestroy(
  state: GameState,
  targetInstanceId: string,
): GameState {
  const player = humanPlayer(state);
  const handIndex = player.hand.findIndex(
    (card) => card.definitionId === "BG28_303",
  );
  assert.ok(handIndex >= 0);
  let next = gameReducer(state, { type: "PLAY_MINION", handIndex });
  const interaction = next.pendingInteraction;
  assert.equal(interaction?.kind, "target");
  assert.ok(interaction?.kind === "target");
  next = gameReducer(next, {
    type: "RESOLVE_INTERACTION",
    interactionId: interaction.interactionId,
    optionInstanceId: targetInstanceId,
  });
  return next;
}

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): void {
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
}

test("Tomb Raider exposes complete ordinary and Golden summon-overflow metadata", () => {
  const definition = getMinionDefinition("BG30_129");
  assert.equal(definition.name, "古墓捣蛋鬼");
  assert.equal(definition.effectSupport, "complete");
  assert.deepEqual(
    [definition.tier, definition.attack, definition.health, definition.tribe],
    [5, 4, 10, "undead"],
  );
  assert.equal(definition.description.includes("+2/+2"), true);
  assert.equal(definition.goldenCardId, "BG30_129_G");
  assert.equal(definition.goldenDescription?.includes("+4/+4"), true);
  assert.deepEqual(definition.onFriendlySummonOverflow, {
    attack: 2,
    health: 2,
  });
});

test("Recruit multi-summons fill the last slot, then each failed summon buffs the full warband with ordinary or Golden scaling", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xfa00 + caseIndex);
    const player = humanPlayer(state);
    const source = minion("BG30_125", `overflow-recruit-source-${caseIndex}`);
    const watcher = (golden ? goldenMinion : minion)(
      "BG30_129",
      `overflow-recruit-watcher-${caseIndex}`,
    );
    const graverobber = minion(
      "BG28_303",
      `overflow-recruit-graverobber-${caseIndex}`,
    );
    player.board = [source, watcher, ...fillers(4, `overflow-recruit-${caseIndex}`)];
    player.hand = [graverobber];

    const next = playGraverobberAndDestroy(state, source.instanceId);
    const nextPlayer = humanPlayer(next);
    const pulse = golden ? 4 : 2;
    const total = pulse * 2;
    const grownWatcher = nextPlayer.board.find(
      (candidate) => candidate.instanceId === watcher.instanceId,
    );
    const playedGraverobber = nextPlayer.board.find(
      (candidate) => candidate.instanceId === graverobber.instanceId,
    );
    const skeletons = nextPlayer.board.filter(
      (candidate) => candidate.definitionId === "live-skeleton-token",
    );

    assert.equal(nextPlayer.board.length, 7);
    assert.equal(skeletons.length, 1);
    assert.ok(grownWatcher);
    assert.ok(playedGraverobber);
    assert.deepEqual(
      [grownWatcher.attack, grownWatcher.health],
      golden ? [8 + total, 20 + total] : [4 + total, 10 + total],
    );
    assert.deepEqual(
      [playedGraverobber.attack, playedGraverobber.health],
      [4 + total, 4 + total],
    );
    assert.deepEqual(
      [skeletons[0].attack, skeletons[0].health],
      [1 + total, 1 + total],
    );
  }
});

test("multiple ordinary and Golden overflow observers stack once for every failed Recruit summon", () => {
  const state = createGame(0xfa10);
  const player = humanPlayer(state);
  const source = minion("BG30_125", "overflow-stack-source");
  const ordinary = minion("BG30_129", "overflow-stack-ordinary");
  const golden = goldenMinion("BG30_129", "overflow-stack-golden");
  const graverobber = minion("BG28_303", "overflow-stack-graverobber");
  player.board = [source, ordinary, golden, ...fillers(3, "overflow-stack")];
  player.hand = [graverobber];

  const next = playGraverobberAndDestroy(state, source.instanceId);
  const nextPlayer = humanPlayer(next);
  const grownOrdinary = nextPlayer.board.find(
    (candidate) => candidate.instanceId === ordinary.instanceId,
  );
  const grownGolden = nextPlayer.board.find(
    (candidate) => candidate.instanceId === golden.instanceId,
  );
  const skeleton = nextPlayer.board.find(
    (candidate) => candidate.definitionId === "live-skeleton-token",
  );
  assert.ok(grownOrdinary);
  assert.ok(grownGolden);
  assert.ok(skeleton);
  assert.deepEqual(
    [grownOrdinary.attack, grownOrdinary.health],
    [16, 22],
  );
  assert.deepEqual(
    [grownGolden.attack, grownGolden.health],
    [20, 32],
  );
  assert.deepEqual([skeleton.attack, skeleton.health], [13, 13]);
});

test("playing a hand minion onto a full Recruit board is rejected before it can count as summon overflow", () => {
  const state = createGame(0xfa20);
  const player = humanPlayer(state);
  const watcher = minion("BG30_129", "overflow-blocked-watcher");
  const blocked = minion("defender-of-argus", "overflow-blocked-card");
  player.board = [watcher, ...fillers(6, "overflow-blocked")];
  player.hand = [blocked];
  const before = player.board.map((candidate) => [
    candidate.instanceId,
    candidate.attack,
    candidate.health,
  ]);

  const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const nextPlayer = humanPlayer(next);
  assert.deepEqual(
    nextPlayer.board.map((candidate) => [
      candidate.instanceId,
      candidate.attack,
      candidate.health,
    ]),
    before,
  );
  assert.equal(nextPlayer.hand[0]?.instanceId, blocked.instanceId);
  assert.equal(next.pendingInteraction, null);
});

test("a random-summon component with no candidates does not create an extra full-board trigger", () => {
  const state = createGame(0xfa30);
  state.activeTribes = [];
  const player = humanPlayer(state);
  const source = minion("BG30_125", "overflow-no-candidate-source", {
    attachments: [
      attachment("BG25_806", "overflow-no-candidate-component"),
    ],
  });
  const watcher = minion("BG30_129", "overflow-no-candidate-watcher");
  player.board = [source, watcher, ...fillers(4, "overflow-no-candidate")];
  player.hand = [minion("BG28_303", "overflow-no-candidate-graverobber")];

  const wildcardDefinitions = MINION_DEFINITIONS.filter((definition) => {
    const tribes =
      definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe]);
    return tribes.includes("all");
  }).map((definition) => ({
    definition: definition as { collectible?: boolean },
    collectible: definition.collectible,
  }));
  assert.ok(wildcardDefinitions.length > 0);
  let next: GameState;
  try {
    for (const entry of wildcardDefinitions) {
      entry.definition.collectible = false;
    }
    next = playGraverobberAndDestroy(state, source.instanceId);
  } finally {
    for (const entry of wildcardDefinitions) {
      if (entry.collectible === undefined) {
        delete entry.definition.collectible;
      } else {
        entry.definition.collectible = entry.collectible;
      }
    }
  }

  const nextPlayer = humanPlayer(next);
  const grownWatcher = nextPlayer.board.find(
    (candidate) => candidate.instanceId === watcher.instanceId,
  );
  assert.ok(grownWatcher);
  assert.deepEqual(
    [grownWatcher.attack, grownWatcher.health],
    [8, 14],
  );
  assert.equal(
    nextPlayer.board.filter(
      (candidate) => candidate.definitionId === "live-skeleton-token",
    ).length,
    1,
  );
});

test("combat overflow emits replayable events, persists original units, keeps token buffs combat-only, and counts failed Reborn", () => {
  const state = createGame(0xfa40);
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  const source = minion("BG30_125", "overflow-combat-source", {
    attack: 1,
    health: 1,
    reborn: true,
  });
  const watcher = minion("BG30_129", "overflow-combat-watcher");
  const durableFillers = fillers(5, "overflow-combat", 100_000);
  const originalTarget = durableFillers[0];
  player.board = [source, watcher, ...durableFillers];
  prepareDuel(state, [
    minion("defender-of-argus", "overflow-combat-enemy", {
      attack: 100,
      health: 1_000_000,
      taunt: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const triggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === watcher.instanceId &&
      event.message.includes("战队已满"),
  );
  assert.equal(triggers.length, 3);
  assert.ok(triggers.every(isCombatPlaybackEvent));

  const skeletonSummon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.definitionId === "live-skeleton-token",
  );
  assert.ok(skeletonSummon?.targetInstanceId);
  const originalBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === watcher.instanceId &&
      event.targetInstanceId === originalTarget.instanceId,
  );
  const tokenBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === watcher.instanceId &&
      event.targetInstanceId === skeletonSummon.targetInstanceId,
  );
  assert.equal(originalBuffs.length, 3);
  assert.equal(tokenBuffs.length, 3);
  assert.ok(originalBuffs.every(isCombatPlaybackEvent));
  assert.ok(tokenBuffs.every(isCombatPlaybackEvent));
  assert.ok(
    originalBuffs.every(
      (event) => event.retained === true && event.retentionMultiplier === 1,
    ),
  );
  assert.ok(tokenBuffs.every((event) => event.retained === false));
  assert.deepEqual(
    tokenBuffs.map((event) => [event.attackDelta, event.healthDelta]),
    [
      [2, 2],
      [2, 2],
      [2, 2],
    ],
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "summon" &&
        event.summonReason === "reborn" &&
        event.minion?.definitionId === source.definitionId,
    ),
    false,
  );

  const persisted = humanPlayer(combat);
  const persistedWatcher = persisted.board.find(
    (candidate) => candidate.instanceId === watcher.instanceId,
  );
  const persistedTarget = persisted.board.find(
    (candidate) => candidate.instanceId === originalTarget.instanceId,
  );
  const persistedSource = persisted.board.find(
    (candidate) => candidate.instanceId === source.instanceId,
  );
  assert.ok(persistedWatcher);
  assert.ok(persistedTarget);
  assert.ok(persistedSource);
  assert.deepEqual(
    [persistedWatcher.attack, persistedWatcher.health],
    [10, 16],
  );
  assert.deepEqual(
    [persistedTarget.attack, persistedTarget.health],
    [6, 100_006],
  );
  assert.deepEqual(
    [persistedSource.attack, persistedSource.health],
    [1, 1],
  );
  assert.equal(
    persisted.board.some(
      (candidate) => candidate.instanceId === skeletonSummon.targetInstanceId,
    ),
    false,
  );
});

test("ghost overflow animates without writing permanent stats back to the eliminated board", () => {
  const state = createGame(0xfa50);
  state.lobbySystemsEnabled = false;
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
    player.health = 1_000;
    player.board = [
      minion("defender-of-argus", `overflow-ghost-enemy-${index}`, {
        attack: 100,
        health: 1_000_000,
        taunt: false,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const source = minion("BG30_125", "overflow-ghost-source", {
    attack: 1,
    health: 1,
  });
  const watcher = minion("BG30_129", "overflow-ghost-watcher");
  ghost.board = [source, watcher, ...fillers(5, "overflow-ghost", 100_000)];
  const boardBefore = structuredClone(ghost.board);

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const triggers = ghostBattle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === watcher.instanceId &&
      event.message.includes("战队已满"),
  );
  const buffs = ghostBattle.events.filter(
    (event) =>
      event.type === "buff" && event.actorInstanceId === watcher.instanceId,
  );
  assert.equal(triggers.length, 2);
  assert.ok(triggers.every(isCombatPlaybackEvent));
  assert.ok(buffs.length > 0);
  assert.ok(buffs.every(isCombatPlaybackEvent));
  assert.ok(buffs.every((event) => event.retained === false));
  assert.deepEqual(combat.players[3].board, boardBefore);
});
