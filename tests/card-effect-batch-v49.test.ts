import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V48,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V49,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

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

test("v49 exposes complete ordinary and Golden Falling Flying Golem and Ingenious Inventor rules", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v50",
  );

  const golem = getMinionDefinition("BG35_342");
  assert.equal(golem.effectSupport, "complete");
  assert.deepEqual(
    [golem.tier, golem.attack, golem.health, golem.tribe],
    [6, 4, 2, "mech"],
  );
  assert.equal(golem.divineShield, true);
  assert.equal(golem.description.includes("+4/+2"), true);
  assert.equal(golem.goldenCardId, "BG35_342_G");
  assert.equal(golem.goldenDescription?.includes("+8/+4"), true);

  const inventor = getMinionDefinition("BG35_890");
  assert.equal(inventor.effectSupport, "complete");
  assert.deepEqual(
    [inventor.tier, inventor.attack, inventor.health, inventor.tribe],
    [6, 9, 4, "mech"],
  );
  assert.equal(inventor.goldenCardId, "BG35_890_G");
  assert.deepEqual(inventor.deathrattle, [
    {
      kind: "buffFriendlyMechsByMagnetizations",
      attack: 2,
      attackPerMagnetization: 2,
    },
  ]);
  assert.equal(inventor.goldenDescription?.includes("+4攻击力"), true);
});

test("recruit Deathrattle repetitions grow ordinary and Golden Golems in hand, board, and shop", () => {
  let state = createGame(0xf900);
  let player = humanPlayer(state);
  const doomed = minion("BG32_842", "golem-recruit-deathrattle", {
    tribe: "elemental",
    tribes: ["elemental", "undead"],
  });
  const boardGolem = goldenMinion("BG35_342", "golem-recruit-board");
  const handGolem = minion("BG35_342", "golem-recruit-hand");
  const shopGolem = minion("BG35_342", "golem-recruit-shop");
  const graverobber = minion("BG28_303", "golem-recruit-graverobber");
  player.board = [
    doomed,
    minion("BG25_354", "golem-recruit-titus"),
    boardGolem,
  ];
  player.hand = [handGolem, graverobber];
  player.shop = [shopGolem];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 1 });
  const interaction = state.pendingInteraction;
  assert.equal(interaction?.kind, "target");
  assert.ok(interaction?.kind === "target");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: interaction.interactionId,
    optionInstanceId: doomed.instanceId,
  });

  player = humanPlayer(state);
  assert.equal(player.deathrattlesTriggered, 2);
  const grownHand = player.hand.find(
    (card) => card.instanceId === handGolem.instanceId,
  );
  const grownBoard = player.board.find(
    (candidate) => candidate.instanceId === boardGolem.instanceId,
  );
  const grownShop = player.shop.find(
    (candidate) => candidate.instanceId === shopGolem.instanceId,
  );
  assert.ok(grownHand?.kind === "minion");
  assert.ok(grownBoard);
  assert.ok(grownShop);
  assert.deepEqual(
    [
      grownHand.attack,
      grownHand.health,
      grownHand.whereverAttackBonus,
      grownHand.whereverHealthBonus,
    ],
    [12, 6, 8, 4],
  );
  assert.deepEqual(
    [
      grownBoard.attack,
      grownBoard.health,
      grownBoard.whereverAttackBonus,
      grownBoard.whereverHealthBonus,
    ],
    [24, 12, 16, 8],
  );
  assert.deepEqual(
    [
      grownShop.attack,
      grownShop.health,
      grownShop.whereverAttackBonus,
      grownShop.whereverHealthBonus,
    ],
    [12, 6, 8, 4],
  );
});

test("combat Deathrattle repetitions persist Golem growth and emit replayable buff snapshots", () => {
  const state = createGame(0xf901);
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  const doomed = minion("BG32_842", "golem-combat-deathrattle", {
    attack: 0,
    health: 1,
  });
  const golem = minion("BG35_342", "golem-combat-survivor", {
    attack: 0,
    health: 100,
  });
  player.board = [
    doomed,
    golem,
    minion("BG25_354", "golem-combat-titus", {
      attack: 0,
      health: 100,
    }),
  ];
  prepareDuel(state, [
    minion("defender-of-argus", "golem-combat-enemy", {
      attack: 1,
      health: 100_000,
      taunt: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const persistedPlayer = humanPlayer(combat);
  assert.equal(persistedPlayer.deathrattlesTriggered, 2);
  const persistedGolem = persistedPlayer.board.find(
    (candidate) => candidate.instanceId === golem.instanceId,
  );
  assert.ok(persistedGolem);
  assert.deepEqual(
    [
      persistedGolem.attack,
      persistedGolem.health,
      persistedGolem.whereverAttackBonus,
      persistedGolem.whereverHealthBonus,
    ],
    [8, 104, 8, 4],
  );

  const buffs = (combat.lastBattle?.events ?? []).filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === doomed.instanceId &&
      event.targetInstanceId === golem.instanceId,
  );
  assert.equal(buffs.length, 2);
  assert.ok(buffs.every(isCombatPlaybackEvent));
  assert.deepEqual(
    buffs.map((event) => [
      event.attackDelta,
      event.healthDelta,
      event.minion?.attack,
      event.minion?.health,
    ]),
    [
      [4, 2, 4, 102],
      [4, 2, 8, 104],
    ],
  );
});

test("Inventor uses successful Magnetizations for ordinary and Golden Titus pulses, current Mechs, and later summons", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    let state = createGame(0xf910 + caseIndex);
    state.lobbySystemsEnabled = false;
    let player = humanPlayer(state);
    const inventor = (golden ? goldenMinion : minion)(
      "BG35_890",
      `inventor-${caseIndex}`,
      { attack: 1, health: 1 },
    );
    const fragileMech = minion("BG29_611", `inventor-fragile-${caseIndex}`, {
      attack: 1,
      health: 1,
      taunt: true,
    });
    const survivingMech = minion(
      "harvest-golem",
      `inventor-survivor-${caseIndex}`,
      { attack: 0, health: 100_000 },
    );
    const titus = minion("BG25_354", `inventor-titus-${caseIndex}`, {
      attack: 0,
      health: 100_000,
    });
    const nonMech = minion("tabbycat-token", `inventor-non-mech-${caseIndex}`, {
      attack: 0,
      health: 100_000,
      tribe: "dragon",
      tribes: ["dragon"],
    });
    const magneticSources = [
      minion("BG31_859", `inventor-magnetic-a-${caseIndex}`),
      minion("BG31_859", `inventor-magnetic-b-${caseIndex}`),
    ];
    player.board = [inventor, fragileMech, survivingMech, titus, nonMech];
    player.hand = magneticSources;

    for (const source of magneticSources) {
      state = gameReducer(state, {
        type: "MAGNETIZE_MINION",
        cardInstanceId: source.instanceId,
        targetInstanceId: fragileMech.instanceId,
      });
    }
    player = humanPlayer(state);
    assert.equal(player.magnetizationsThisGame, 2);
    prepareDuel(state, [
      minion("defender-of-argus", `inventor-enemy-${caseIndex}`, {
        attack: 100,
        health: 100_000,
        taunt: false,
      }),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(humanPlayer(combat).magnetizationsThisGame, 2);
    const expectedPulse = golden ? 12 : 6;
    const events = combat.lastBattle?.events ?? [];
    const survivingMechBuffs = events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === inventor.instanceId &&
        event.targetInstanceId === survivingMech.instanceId,
    );
    assert.equal(survivingMechBuffs.length, 2);
    assert.ok(survivingMechBuffs.every(isCombatPlaybackEvent));
    assert.deepEqual(
      survivingMechBuffs.map((event) => [
        event.attackDelta,
        event.healthDelta,
      ]),
      [
        [expectedPulse, 0],
        [expectedPulse, 0],
      ],
    );
    assert.equal(
      events.some(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === inventor.instanceId &&
          event.targetInstanceId === nonMech.instanceId,
      ),
      false,
    );

    const laterMicrobots = events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === fragileMech.instanceId &&
        event.minion?.definitionId === "live-microbot-token",
    );
    assert.equal(laterMicrobots.length, 2);
    assert.ok(laterMicrobots.every(isCombatPlaybackEvent));
    assert.deepEqual(
      laterMicrobots.map((event) => event.minion?.attack),
      [1 + expectedPulse * 2, 1 + expectedPulse * 2],
    );
  }
});

test("v48 saves default v49 counters while v49 and v50 preserve valid values", () => {
  const legacy = structuredClone(createGame(0xf920)) as GameState;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V48;
  for (const player of legacy.players) {
    delete (player as Partial<PlayerState>).deathrattlesTriggered;
    delete (player as Partial<PlayerState>).magnetizationsThisGame;
  }
  const migrated = normalizePersistedGameState(legacy) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.ok(
    migrated.players.every(
      (player) =>
        player.deathrattlesTriggered === 0 &&
        player.magnetizationsThisGame === 0,
    ),
  );

  const v49 = structuredClone(createGame(0xf921)) as GameState;
  v49.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V49;
  humanPlayer(v49).deathrattlesTriggered = 3;
  humanPlayer(v49).magnetizationsThisGame = 5;
  humanPlayer(v49).board = [
    minion("BG31_835", "v49-tracked-minion", {
      deathlyStrikerLineageIds: ["lineage-a"],
      deathlyStrikerCreatorIds: ["creator-a"],
      bloodGemAttack: 4,
      bloodGemHealth: 6,
      suppressedBloodGemAttack: 2,
      suppressedBloodGemHealth: 3,
    }),
  ];
  const migratedV49 = normalizePersistedGameState(v49) as GameState | null;
  assert.ok(migratedV49);
  assert.equal(migratedV49.contentVersion, CURRENT_ROSTER_VERSION);
  assert.deepEqual(
    [
      humanPlayer(migratedV49).deathrattlesTriggered,
      humanPlayer(migratedV49).magnetizationsThisGame,
    ],
    [3, 5],
  );
  assert.deepEqual(
    {
      lineage: humanPlayer(migratedV49).board[0]?.deathlyStrikerLineageIds,
      creators: humanPlayer(migratedV49).board[0]?.deathlyStrikerCreatorIds,
      suppressedAttack:
        humanPlayer(migratedV49).board[0]?.suppressedBloodGemAttack,
      suppressedHealth:
        humanPlayer(migratedV49).board[0]?.suppressedBloodGemHealth,
    },
    {
      lineage: ["lineage-a"],
      creators: ["creator-a"],
      suppressedAttack: 2,
      suppressedHealth: 3,
    },
  );

  const current = createGame(0xf922);
  humanPlayer(current).deathrattlesTriggered = 3;
  humanPlayer(current).magnetizationsThisGame = 5;
  const jsonRoundTrip = JSON.parse(JSON.stringify(current)) as GameState;
  const normalized = normalizePersistedGameState(
    jsonRoundTrip,
  ) as GameState | null;
  assert.ok(normalized);
  assert.deepEqual(
    [
      humanPlayer(normalized).deathrattlesTriggered,
      humanPlayer(normalized).magnetizationsThisGame,
    ],
    [3, 5],
  );

  for (const field of [
    "deathrattlesTriggered",
    "magnetizationsThisGame",
  ] as const) {
    for (const malformedValue of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      const malformed = structuredClone(current);
      humanPlayer(malformed)[field] = malformedValue;
      assert.equal(normalizePersistedGameState(malformed), null);
    }
  }
});
