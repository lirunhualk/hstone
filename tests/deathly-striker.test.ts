import assert from "node:assert/strict";
import test from "node:test";

import {
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getScheduledPairings,
  type BattleEvent,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const DEATHLY_STRIKER_DEFINITION_ID = "BG31_835";
const LOW_TIER_UNDEAD_DEFINITION_ID = "BG25_001";
const LINKED_UNDEAD_DEFINITION_ID = "BG25_011";
const TITUS_DEFINITION_ID = "BG25_354";
const TOMB_RAIDER_DEFINITION_ID = "BG30_129";

const VICTIM_DEFINITION_IDS = [
  "BG20_100",
  "BG20_301",
  "BG24_009",
  "BG26_135",
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
  const golden = overrides.golden === true;
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden
      ? definition.goldenCardId ?? definition.cardId
      : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: golden
      ? definition.goldenSellValue ?? definition.sellValue ?? 1
      : definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
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
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
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
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
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
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    ...overrides,
  });
}

function victim(index: number, prefix: string): BoardMinionInstance {
  return definitionMinion(
    VICTIM_DEFINITION_IDS[index % VICTIM_DEFINITION_IDS.length],
    `${prefix}-victim-${index}`,
    {
      attack: 0,
      health: 1,
      taunt: true,
      reborn: false,
    },
  );
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

function prepareDuel(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): { human: PlayerState; enemy: PlayerState } {
  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  for (const player of state.players) {
    const alive = player.id === human.id || player.id === enemy.id;
    player.alive = alive;
    player.health = alive ? 1_000 : 0;
    player.armor = 0;
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = alive ? undefined : state.round;
  }
  human.board = humanBoard;
  enemy.board = enemyBoard;
  return { human, enemy };
}

function battleForPlayer(
  state: GameState,
  playerId: string,
): BattleSummary {
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === playerId ||
      candidate.playerBId === playerId,
  );
  assert.ok(battle);
  return battle;
}

function handMinions(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function deathlyStrikerSummons(
  events: readonly BattleEvent[],
  actorInstanceId?: string,
): BattleEvent[] {
  return events.filter(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "deathlyStrikerFromHand" &&
      (actorInstanceId === undefined ||
        event.actorInstanceId === actorInstanceId),
  );
}

function testDefinitionHasTribe(
  definition: (typeof MINION_DEFINITIONS)[number],
  tribe: "undead",
): boolean {
  const tribes =
    definition.tribes ??
    (definition.tribe === "neutral" ? [] : [definition.tribe]);
  return tribes.includes(tribe) || tribes.includes("all");
}

function setOnlyUndeadPoolCandidates(
  state: GameState,
  candidates: Readonly<Record<string, number>>,
): void {
  state.activeTribes = ["undead"];
  for (const definition of MINION_DEFINITIONS) {
    if (testDefinitionHasTribe(definition, "undead")) {
      state.pool[definition.id] = 0;
    }
  }
  for (const [definitionId, copies] of Object.entries(candidates)) {
    state.pool[definitionId] = copies;
  }
}

function sorted(values: readonly string[] | undefined): string[] {
  return [...(values ?? [])].sort();
}

test("Deathly Striker exposes the exact ordinary and Golden card text", () => {
  const definition = getMinionDefinition(DEATHLY_STRIKER_DEFINITION_ID);
  assert.equal(definition.name, "致命打击者");
  assert.deepEqual(
    [
      definition.tier,
      definition.attack,
      definition.health,
      definition.tribe,
      definition.effectSupport,
    ],
    [6, 8, 8, "undead", "complete"],
  );
  assert.deepEqual(definition.printedMechanics, [
    "AVENGE",
    "DEATHRATTLE",
  ]);
  assert.equal(
    definition.description,
    "复仇（4）：随机获取一张亡灵牌。亡语：从你的手牌中召唤它，其登场仅限本场战斗。",
  );
  assert.equal(definition.goldenCardId, "BG31_835_G");
  assert.equal(
    definition.goldenDescription,
    "复仇（4）：随机获取两张亡灵牌。亡语：从你的手牌中召唤它们，其登场仅限本场战斗。",
  );
  assert.deepEqual(definition.avenge, {
    threshold: 4,
    effects: [
      {
        kind: "gainLinkedRandomMinion",
        tribe: "undead",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  });
  assert.deepEqual(definition.deathrattle, [
    { kind: "summonLinkedHandMinions" },
  ]);
});

test("ordinary and Golden Avenge draw tier-legal Undead from the shared pool", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xd510 + caseIndex);
    const source = (golden ? goldenMinion : definitionMinion)(
      DEATHLY_STRIKER_DEFINITION_ID,
      `pool-source-${caseIndex}`,
      { attack: 0, health: 1_000_000, stealth: true },
    );
    const { human } = prepareDuel(
      state,
      [
        source,
        ...Array.from({ length: 4 }, (_, index) =>
          victim(index, `pool-${caseIndex}`),
        ),
      ],
      [enemyWall(`pool-enemy-${caseIndex}`)],
    );
    human.tavernTier = 1;
    setOnlyUndeadPoolCandidates(state, {
      [LOW_TIER_UNDEAD_DEFINITION_ID]: 4,
      [DEATHLY_STRIKER_DEFINITION_ID]: 5,
    });

    const combat = gameReducer(state, { type: "END_TURN" });
    const nextHuman = humanPlayer(combat);
    const gained = handMinions(nextHuman).filter((minion) =>
      minion.deathlyStrikerCreatorIds?.includes(source.instanceId),
    );
    const expectedCount = golden ? 2 : 1;
    assert.equal(gained.length, expectedCount);
    assert.ok(
      gained.every(
        (minion) =>
          minion.definitionId === LOW_TIER_UNDEAD_DEFINITION_ID &&
          minion.tier <= human.tavernTier &&
          minion.poolCopies === 1 &&
          !minion.golden,
      ),
    );
    assert.ok(
      gained.every(
        (minion) =>
          sorted(minion.deathlyStrikerCreatorIds).join("|") ===
          source.instanceId,
      ),
    );
    assert.equal(
      combat.pool[LOW_TIER_UNDEAD_DEFINITION_ID],
      4 - expectedCount,
    );
    assert.equal(combat.pool[DEATHLY_STRIKER_DEFINITION_ID], 5);
    const gainEvents = battleForPlayer(combat, human.id).events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === source.instanceId &&
        event.cardGainResult === "added",
    );
    assert.equal(gainEvents.length, expectedCount);
  }
});

test("Deathly Striker reports full-hand and no-candidate Avenge outcomes without consuming pool copies", () => {
  {
    const state = createGame(0xd520);
    const source = definitionMinion(
      DEATHLY_STRIKER_DEFINITION_ID,
      "full-hand-source",
      { attack: 0, health: 1_000_000, stealth: true },
    );
    const { human } = prepareDuel(
      state,
      [
        source,
        ...Array.from({ length: 4 }, (_, index) =>
          victim(index, "full-hand"),
        ),
      ],
      [enemyWall("full-hand-enemy")],
    );
    human.tavernTier = 1;
    setOnlyUndeadPoolCandidates(state, {
      [LOW_TIER_UNDEAD_DEFINITION_ID]: 4,
    });
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
      "BG28_303",
    ];
    human.hand = fillerIds.map((definitionId, index) =>
      definitionMinion(definitionId, `full-hand-filler-${index}`),
    );

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(humanPlayer(combat).hand.length, 10);
    assert.equal(combat.pool[LOW_TIER_UNDEAD_DEFINITION_ID], 4);
    const results = battleForPlayer(combat, human.id).events
      .filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === source.instanceId,
      )
      .map((event) => event.cardGainResult);
    assert.deepEqual(results, ["handFull"]);
  }

  {
    const state = createGame(0xd521);
    const source = definitionMinion(
      DEATHLY_STRIKER_DEFINITION_ID,
      "no-candidate-source",
      { attack: 0, health: 1_000_000, stealth: true },
    );
    const { human } = prepareDuel(
      state,
      [
        source,
        ...Array.from({ length: 4 }, (_, index) =>
          victim(index, "no-candidate"),
        ),
      ],
      [enemyWall("no-candidate-enemy")],
    );
    human.tavernTier = 6;
    setOnlyUndeadPoolCandidates(state, {});

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(handMinions(humanPlayer(combat)).length, 0);
    const results = battleForPlayer(combat, human.id).events
      .filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === source.instanceId,
      )
      .map((event) => event.cardGainResult);
    assert.deepEqual(results, ["noCandidate"]);
  }
});

test("each Deathly Striker summons only its linked hand cards as combat copies", () => {
  const state = createGame(0xd530);
  const firstSource = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "isolated-source-a",
    { attack: 0, health: 1, taunt: true },
  );
  const secondSource = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "isolated-source-b",
    { attack: 0, health: 1_000_000, stealth: true },
  );
  const firstLinked = definitionMinion(
    LINKED_UNDEAD_DEFINITION_ID,
    "isolated-linked-a",
    {
      attack: 0,
      health: 1,
      deathlyStrikerCreatorIds: [firstSource.instanceId],
      poolCopies: 1,
    },
  );
  const secondLinked = definitionMinion(
    LOW_TIER_UNDEAD_DEFINITION_ID,
    "isolated-linked-b",
    {
      deathlyStrikerCreatorIds: [secondSource.instanceId],
      poolCopies: 1,
    },
  );
  const { human } = prepareDuel(
    state,
    [firstSource, secondSource],
    [enemyWall("isolated-enemy", 100)],
  );
  human.hand = [firstLinked, secondLinked];
  const handBefore = structuredClone(human.hand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextHuman = humanPlayer(combat);
  assert.deepEqual(nextHuman.hand, handBefore);
  const summons = deathlyStrikerSummons(
    battleForPlayer(combat, human.id).events,
  );
  assert.equal(summons.length, 1);
  assert.equal(summons[0].actorInstanceId, firstSource.instanceId);
  assert.equal(
    summons[0].minion?.definitionId,
    firstLinked.definitionId,
  );
  assert.notEqual(
    summons[0].targetInstanceId,
    firstLinked.instanceId,
  );
  assert.equal(summons[0].minion?.poolCopies, 0);
  assert.equal(
    summons.some(
      (event) => event.minion?.definitionId === secondLinked.definitionId,
    ),
    false,
  );
});

test("Titus repeats Deathly Striker's linked-hand Deathrattle without consuming the hand card", () => {
  const state = createGame(0xd540);
  const source = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "titus-source",
    { attack: 0, health: 1, taunt: true },
  );
  const titus = definitionMinion(TITUS_DEFINITION_ID, "titus-observer", {
    attack: 0,
    health: 1_000_000,
    stealth: true,
  });
  const linked = definitionMinion(
    LINKED_UNDEAD_DEFINITION_ID,
    "titus-linked",
    {
      attack: 0,
      health: 1,
      deathlyStrikerCreatorIds: [source.instanceId],
      poolCopies: 1,
    },
  );
  const { human } = prepareDuel(
    state,
    [source, titus],
    [enemyWall("titus-enemy", 100)],
  );
  human.hand = [linked];

  const combat = gameReducer(state, { type: "END_TURN" });
  const summons = deathlyStrikerSummons(
    battleForPlayer(combat, human.id).events,
    source.instanceId,
  );
  assert.equal(summons.length, 2);
  assert.equal(
    new Set(summons.map((event) => event.targetInstanceId)).size,
    2,
  );
  assert.ok(
    summons.every(
      (event) =>
        event.minion?.definitionId === linked.definitionId &&
        event.minion.poolCopies === 0,
    ),
  );
  assert.deepEqual(humanPlayer(combat).hand, [linked]);
});

test("Deathly Striker Triples merge creator and lineage identities", () => {
  let state = createGame(0xd550);
  const human = humanPlayer(state);
  const first = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "lineage-source-a",
    {
      deathlyStrikerLineageIds: ["ancestor-a", "lineage-source-a"],
      deathlyStrikerCreatorIds: ["maker-a", "shared-maker"],
      poolCopies: 1,
    },
  );
  const second = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "lineage-source-b",
    {
      deathlyStrikerLineageIds: ["ancestor-b", "lineage-source-b"],
      deathlyStrikerCreatorIds: ["maker-b"],
      poolCopies: 1,
    },
  );
  const third = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "lineage-source-c",
    {
      deathlyStrikerCreatorIds: ["maker-c", "shared-maker"],
      poolCopies: 1,
    },
  );
  human.gold = 10;
  human.hand = [first, second];
  human.shop = [third];
  human.spellShop = null;
  human.additionalSpellShop = [];

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  const golden = handMinions(humanPlayer(state)).find(
    (minion) =>
      minion.definitionId === DEATHLY_STRIKER_DEFINITION_ID &&
      minion.golden,
  );
  assert.ok(golden);
  assert.deepEqual(sorted(golden.deathlyStrikerCreatorIds), [
    "maker-a",
    "maker-b",
    "maker-c",
    "shared-maker",
  ]);
  assert.deepEqual(sorted(golden.deathlyStrikerLineageIds),
    sorted([
      "ancestor-a",
      "lineage-source-a",
      "ancestor-b",
      "lineage-source-b",
      third.instanceId,
      golden.instanceId,
    ]),
  );

  const linkedToFirst = definitionMinion(
    LINKED_UNDEAD_DEFINITION_ID,
    "lineage-linked-a",
    { deathlyStrikerCreatorIds: [first.instanceId] },
  );
  const linkedToSecond = definitionMinion(
    LINKED_UNDEAD_DEFINITION_ID,
    "lineage-linked-b",
    { deathlyStrikerCreatorIds: [second.instanceId] },
  );
  const duel = prepareDuel(
    state,
    [
      {
        ...golden,
        attack: 0,
        health: 1,
        taunt: true,
      },
    ],
    [enemyWall("lineage-enemy", 100)],
  );
  duel.human.hand = [linkedToFirst, linkedToSecond];
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(
    deathlyStrikerSummons(
      battleForPlayer(combat, duel.human.id).events,
      golden.instanceId,
    ).length,
    2,
  );
});

test("an Avenge-created third copy waits until Recruit before merging creator identities", () => {
  let state = createGame(0xd560);
  const source = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "deferred-source",
    { attack: 0, health: 1_000_000, stealth: true },
  );
  const { human } = prepareDuel(
    state,
    [
      source,
      ...Array.from({ length: 4 }, (_, index) =>
        victim(index, "deferred"),
      ),
    ],
    [enemyWall("deferred-enemy")],
  );
  human.tavernTier = 2;
  human.hand = [
    definitionMinion(
      LINKED_UNDEAD_DEFINITION_ID,
      "deferred-copy-a",
      { deathlyStrikerCreatorIds: ["older-source-a"] },
    ),
    definitionMinion(
      LINKED_UNDEAD_DEFINITION_ID,
      "deferred-copy-b",
      { deathlyStrikerCreatorIds: ["older-source-b"] },
    ),
  ];
  setOnlyUndeadPoolCandidates(state, {
    [LINKED_UNDEAD_DEFINITION_ID]: 1,
  });

  state = gameReducer(state, { type: "END_TURN" });
  let copies = handMinions(humanPlayer(state)).filter(
    (minion) => minion.definitionId === LINKED_UNDEAD_DEFINITION_ID,
  );
  assert.equal(copies.length, 3);
  assert.ok(copies.every((minion) => !minion.golden));
  assert.ok(state.deferredTriplePlayerIds.includes(human.id));

  state = gameReducer(state, { type: "CONTINUE" });
  copies = handMinions(humanPlayer(state)).filter(
    (minion) => minion.definitionId === LINKED_UNDEAD_DEFINITION_ID,
  );
  assert.equal(copies.length, 1);
  assert.equal(copies[0].golden, true);
  assert.deepEqual(sorted(copies[0].deathlyStrikerCreatorIds), [
    "deferred-source",
    "older-source-a",
    "older-source-b",
  ]);
});

test("a blocked linked-hand summon triggers Tomb Raider exactly once", () => {
  const state = createGame(0xd570);
  const source = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "overflow-source",
    { attack: 0, health: 1, taunt: true },
  );
  const watcher = definitionMinion(
    TOMB_RAIDER_DEFINITION_ID,
    "overflow-watcher",
    { attack: 4, health: 100_000 },
  );
  const fillers = Array.from({ length: 5 }, (_, index) =>
    definitionMinion(
      "annihilan-battlemaster",
      `overflow-filler-${index}`,
      { attack: 0, health: 100_000 },
    ),
  );
  const linked = [0, 1].map((index) =>
    definitionMinion(
      LINKED_UNDEAD_DEFINITION_ID,
      `overflow-linked-${index}`,
      {
        attack: 0,
        health: 100_000,
        deathlyStrikerCreatorIds: [source.instanceId],
      },
    ),
  );
  const { human } = prepareDuel(
    state,
    [source, watcher, ...fillers],
    [enemyWall("overflow-enemy", 100)],
  );
  human.hand = linked;

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = battleForPlayer(combat, human.id);
  assert.equal(
    deathlyStrikerSummons(battle.events, source.instanceId).length,
    1,
  );
  const overflowTriggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === watcher.instanceId &&
      event.message.includes("战队已满"),
  );
  assert.equal(overflowTriggers.length, 1);
  const persistentWatcher = humanPlayer(combat).board.find(
    (minion) => minion.instanceId === watcher.instanceId,
  );
  assert.ok(persistentWatcher);
  assert.deepEqual(
    [persistentWatcher.attack, persistentWatcher.health],
    [watcher.attack + 2, watcher.health + 2],
  );
  assert.deepEqual(humanPlayer(combat).hand, linked);
});

test("a ghost Deathly Striker reads ghostHand but never writes the eliminated player's real hand", () => {
  const state = createGame(0xd580);
  state.lobbySystemsEnabled = false;
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.armor = 0;
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
    player.board = [enemyWall(`ghost-opponent-${index}`, 100)];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const source = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "ghost-source",
    { attack: 0, health: 1, taunt: true },
  );
  const linked = definitionMinion(
    LINKED_UNDEAD_DEFINITION_ID,
    "ghost-linked",
    {
      attack: 0,
      health: 1,
      poolCopies: 0,
      deathlyStrikerCreatorIds: [source.instanceId],
    },
  );
  ghost.board = [source];
  ghost.ghostHand = [linked];
  const scheduled = getScheduledPairings(state).find(
    (pairing) => pairing.isGhost,
  );
  assert.equal(scheduled?.playerBId, ghost.id);
  const boardBefore = structuredClone(ghost.board);
  const snapshotBefore = structuredClone(ghost.ghostHand);
  const poolBefore = structuredClone(state.pool);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastRoundBattles.find(
    (candidate) =>
      candidate.isGhost &&
      (candidate.playerAId === ghost.id ||
        candidate.playerBId === ghost.id),
  );
  assert.ok(battle);
  const summons = deathlyStrikerSummons(
    battle.events,
    source.instanceId,
  );
  assert.equal(summons.length, 1);
  assert.equal(summons[0].minion?.definitionId, linked.definitionId);
  assert.notEqual(summons[0].targetInstanceId, linked.instanceId);
  assert.equal(summons[0].minion?.poolCopies, 0);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === source.instanceId,
    ),
    false,
  );
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.deepEqual(nextGhost.hand, []);
  assert.deepEqual(nextGhost.ghostHand, snapshotBefore);
  assert.deepEqual(combat.pool, poolBefore);
});

test("a Reborn Deathly Striker receives a new source identity", () => {
  const state = createGame(0xd590);
  const source = definitionMinion(
    DEATHLY_STRIKER_DEFINITION_ID,
    "reborn-source",
    {
      attack: 0,
      health: 1,
      taunt: true,
      reborn: true,
    },
  );
  const linked = definitionMinion(
    LINKED_UNDEAD_DEFINITION_ID,
    "reborn-linked",
    {
      attack: 0,
      health: 1,
      deathlyStrikerCreatorIds: [source.instanceId],
    },
  );
  const { human } = prepareDuel(
    state,
    [source],
    [enemyWall("reborn-enemy", 100)],
  );
  human.hand = [linked];

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = battleForPlayer(combat, human.id).events;
  const rebornEvent = events.find(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "reborn" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.ok(rebornEvent?.targetInstanceId);
  assert.notEqual(rebornEvent.targetInstanceId, source.instanceId);
  const sourceDeaths = events.filter(
    (event) =>
      event.type === "death" &&
      event.minion?.definitionId === DEATHLY_STRIKER_DEFINITION_ID,
  );
  assert.equal(sourceDeaths.length, 2);
  assert.deepEqual(
    new Set(sourceDeaths.map((event) => event.actorInstanceId)),
    new Set([source.instanceId, rebornEvent.targetInstanceId]),
  );
  const linkedSummons = deathlyStrikerSummons(events);
  assert.equal(linkedSummons.length, 1);
  assert.equal(linkedSummons[0].actorInstanceId, source.instanceId);
  assert.deepEqual(humanPlayer(combat).hand, [linked]);
});

test("Deathly Striker identity metadata is JSON-safe and malformed arrays are rejected", () => {
  const state = createGame(0xd5a0);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion(
      DEATHLY_STRIKER_DEFINITION_ID,
      "save-source",
      { deathlyStrikerLineageIds: ["save-source", "older-source"] },
    ),
  ];
  human.hand = [
    definitionMinion(
      LINKED_UNDEAD_DEFINITION_ID,
      "save-linked",
      { deathlyStrikerCreatorIds: ["save-source", "older-source"] },
    ),
  ];

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(
    humanPlayer(restored).board[0].deathlyStrikerLineageIds,
    ["save-source", "older-source"],
  );
  assert.deepEqual(
    handMinions(humanPlayer(restored))[0].deathlyStrikerCreatorIds,
    ["save-source", "older-source"],
  );

  const malformed = JSON.parse(JSON.stringify(state)) as GameState;
  malformed.players[0].board[0].deathlyStrikerLineageIds = [
    "duplicate",
    "duplicate",
  ];
  assert.equal(normalizePersistedGameState(malformed), null);
});
