import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getScheduledPairings,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V26,
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
  const definition = getMinionDefinition(definitionId);
  return definitionMinion(definitionId, instanceId, {
    cardId: definition.goldenCardId ?? definition.cardId,
    name: `金色·${definition.name}`,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
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

function enemyWall(instanceId: string): BoardMinionInstance {
  return definitionMinion("BG29_611", instanceId, {
    attack: 0,
    health: 1_000_000,
    taunt: true,
    reborn: false,
  });
}

function battleMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const battle = state.lastBattle;
  assert.ok(battle);
  const minion = battle.initialBoards[state.humanPlayerId].find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion);
  assert.equal(minion.kind, "minion");
  return minion as BoardMinionInstance;
}

test("the simple Start-of-Combat batch maps exact ordinary and Golden metadata", () => {
  const amber = getMinionDefinition("BG24_500");
  assert.equal(amber.effectSupport, "complete");
  assert.equal(amber.name, "琥珀卫士");
  assert.equal(amber.tier, 3);
  assert.deepEqual([amber.attack, amber.health], [3, 2]);
  assert.deepEqual(amber.tribes, ["dragon"]);
  assert.equal(
    amber.description,
    "嘲讽。战斗开始时：使另一条友方的龙获得+2/+2和圣盾。",
  );
  assert.equal(amber.goldenCardId, "BG24_500_G");
  assert.equal(
    amber.goldenDescription,
    "嘲讽。战斗开始时：使两条其他友方的龙获得+2/+2和圣盾。",
  );
  assert.equal(amber.taunt, true);
  assert.deepEqual(amber.printedMechanics, [
    "START_OF_COMBAT",
    "TAUNT",
    "TRIGGER_VISUAL",
  ]);
  assert.deepEqual(amber.startOfCombat, [
    {
      kind: "buffRandomOtherTribe",
      tribe: "dragon",
      attack: 2,
      health: 2,
      divineShield: true,
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);

  const costume = getMinionDefinition("BG34_142");
  assert.equal(costume.effectSupport, "complete");
  assert.equal(costume.name, "狂热变装鱼人");
  assert.equal(costume.tier, 5);
  assert.deepEqual([costume.attack, costume.health], [4, 5]);
  assert.deepEqual(costume.tribes, ["murloc"]);
  assert.equal(
    costume.description,
    "圣盾。战斗开始时：获得你手牌中攻击力\n最高的随从牌的攻击力。",
  );
  assert.equal(costume.goldenCardId, "BG34_142_G");
  assert.equal(
    costume.goldenDescription,
    "圣盾。战斗开始时：获得你手牌中攻击力最高的随从牌的双倍攻击力。",
  );
  assert.equal(costume.divineShield, true);
  assert.deepEqual(costume.printedMechanics, [
    "DIVINE_SHIELD",
    "START_OF_COMBAT",
    "TRIGGER_VISUAL",
  ]);
  assert.deepEqual(costume.startOfCombat, [
    {
      kind: "gainHighestHandAttack",
      goldenMode: "doubleAmount",
    },
  ]);

  const choral = getMinionDefinition("BG26_354");
  assert.equal(choral.effectSupport, "complete");
  assert.equal(choral.name, "合唱鱼人");
  assert.equal(choral.tier, 6);
  assert.deepEqual([choral.attack, choral.health], [6, 6]);
  assert.deepEqual(choral.tribes, ["murloc"]);
  assert.equal(
    choral.description,
    "战斗开始时：获得你手牌中所有随从牌的属性值。",
  );
  assert.equal(choral.goldenCardId, "BG26_354_G");
  assert.equal(
    choral.goldenDescription,
    "战斗开始时：获得你手牌中所有随从牌的双倍属性值。",
  );
  assert.deepEqual(choral.printedMechanics, [
    "START_OF_COMBAT",
    "TRIGGER_VISUAL",
  ]);
  assert.deepEqual(choral.startOfCombat, [
    {
      kind: "gainAllHandMinionStats",
      goldenMode: "doubleAmount",
    },
  ]);
});

test("Amber Guardian buffs one distinct other Dragon and records a replayable shield event", () => {
  const state = createGame(0x5c001);
  const human = humanPlayer(state);
  const amber = definitionMinion(
    "BG24_500",
    "ordinary-amber",
  );
  const dragonA = definitionMinion(
    "BG34_638t",
    "amber-dragon-a",
    { attack: 10, health: 20, divineShield: false },
  );
  const dragonB = definitionMinion(
    "BG34_636t",
    "amber-dragon-b",
    { attack: 30, health: 40, divineShield: false },
  );
  const nonDragon = definitionMinion(
    "BG29_611",
    "amber-non-dragon",
    { attack: 50, health: 60, divineShield: false },
  );
  human.board = [amber, dragonA, dragonB, nonDragon];
  const permanentBoardBefore = structuredClone(human.board);
  keepOnlyOneOpponent(state, [enemyWall("ordinary-amber-wall")]);
  human.board = [amber, dragonA, dragonB, nonDragon];

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  assert.deepEqual(
    battleMinion(combat, amber.instanceId),
    permanentBoardBefore[0],
  );
  assert.deepEqual(
    battleMinion(combat, dragonA.instanceId),
    permanentBoardBefore[1],
  );
  assert.deepEqual(
    battleMinion(combat, dragonB.instanceId),
    permanentBoardBefore[2],
  );

  const battleStart = battle.events.find(
    (event) => event.type === "battleStart",
  );
  const start = battle.events.find(
    (event) =>
      event.type === "startOfCombat" &&
      event.actorInstanceId === amber.instanceId,
  );
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === amber.instanceId,
  );
  assert.ok(battleStart);
  assert.ok(start);
  assert.equal(buffs.length, 1);
  assert.ok(battleStart.index < start.index);
  assert.ok(start.index < buffs[0].index);
  assert.ok(
    [dragonA.instanceId, dragonB.instanceId].includes(
      buffs[0].targetInstanceId ?? "",
    ),
  );
  assert.notEqual(buffs[0].targetInstanceId, amber.instanceId);
  assert.notEqual(
    buffs[0].targetInstanceId,
    nonDragon.instanceId,
  );
  assert.deepEqual(
    [buffs[0].attackDelta, buffs[0].healthDelta],
    [2, 2],
  );
  assert.equal(buffs[0].minion?.divineShield, true);
  const chosenBefore =
    buffs[0].targetInstanceId === dragonA.instanceId
      ? dragonA
      : dragonB;
  assert.deepEqual(
    [buffs[0].minion?.attack, buffs[0].minion?.health],
    [chosenBefore.attack + 2, chosenBefore.health + 2],
  );
  assert.deepEqual(
    humanPlayer(combat).board,
    permanentBoardBefore,
  );
});

test("later Amber Guardians skip Dragons shielded earlier in the same Start-of-Combat phase", () => {
  const state = createGame(0x5c004);
  const human = humanPlayer(state);
  const firstAmber = definitionMinion(
    "BG24_500",
    "shield-filter-first-amber",
    { divineShield: true },
  );
  const secondAmber = definitionMinion(
    "BG24_500",
    "shield-filter-second-amber",
    { divineShield: true },
  );
  const shieldedDragon = definitionMinion(
    "BG34_638t",
    "already-shielded-ordinary-dragon",
    { attack: 13, health: 17, divineShield: true },
  );
  const unshieldedDragon = definitionMinion(
    "BG34_636t",
    "unshielded-ordinary-dragon",
    { attack: 19, health: 23, divineShield: false },
  );
  human.board = [
    firstAmber,
    secondAmber,
    shieldedDragon,
    unshieldedDragon,
  ];
  keepOnlyOneOpponent(state, [
    enemyWall("shield-filter-ordinary-wall"),
  ]);
  human.board = [
    firstAmber,
    secondAmber,
    shieldedDragon,
    unshieldedDragon,
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const amberIds = new Set([
    firstAmber.instanceId,
    secondAmber.instanceId,
  ]);
  const starts = battle.events.filter(
    (event) =>
      event.type === "startOfCombat" &&
      amberIds.has(event.actorInstanceId ?? ""),
  );
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      amberIds.has(event.actorInstanceId ?? ""),
  );
  assert.equal(starts.length, 2);
  assert.equal(buffs.length, 1);
  assert.equal(buffs[0].targetInstanceId, unshieldedDragon.instanceId);
  assert.deepEqual(
    [
      buffs[0].attackDelta,
      buffs[0].healthDelta,
      buffs[0].minion?.attack,
      buffs[0].minion?.health,
      buffs[0].minion?.divineShield,
    ],
    [2, 2, 21, 25, true],
  );
});

test("Golden Amber Guardian buffs two different Dragons once each without doubling stats", () => {
  const state = createGame(0x5c002);
  const human = humanPlayer(state);
  const amber = goldenMinion(
    "BG24_500",
    "golden-amber",
  );
  const dragons = [
    definitionMinion("BG34_638t", "golden-amber-dragon-a", {
      attack: 10,
      health: 11,
      divineShield: false,
    }),
    definitionMinion("BG34_636t", "golden-amber-dragon-b", {
      attack: 20,
      health: 21,
      divineShield: false,
    }),
    definitionMinion("BG34_637t", "golden-amber-dragon-c", {
      attack: 30,
      health: 31,
      divineShield: false,
    }),
  ];
  human.board = [amber, ...dragons];
  const permanentBoardBefore = structuredClone(human.board);
  keepOnlyOneOpponent(state, [enemyWall("golden-amber-wall")]);
  human.board = [amber, ...dragons];

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === amber.instanceId,
  );
  assert.equal(buffs.length, 2);
  assert.equal(
    new Set(buffs.map((event) => event.targetInstanceId)).size,
    2,
  );
  for (const buff of buffs) {
    assert.ok(
      dragons.some(
        (dragon) =>
          dragon.instanceId === buff.targetInstanceId,
      ),
    );
    assert.deepEqual(
      [buff.attackDelta, buff.healthDelta],
      [2, 2],
    );
    assert.equal(buff.minion?.divineShield, true);
  }
  assert.equal(
    buffs.some(
      (event) => event.targetInstanceId === amber.instanceId,
    ),
    false,
  );
  assert.deepEqual(
    humanPlayer(combat).board,
    permanentBoardBefore,
  );
});

test("Golden Amber Guardian treats ALL as Dragon and only targets Dragons without Divine Shield", () => {
  const state = createGame(0x5c003);
  const human = humanPlayer(state);
  const amber = goldenMinion(
    "BG24_500",
    "single-target-golden-amber",
  );
  const allType = definitionMinion(
    "BG32_111",
    "single-target-all-type",
    {
      attack: 17,
      health: 19,
      divineShield: false,
    },
  );
  const shieldedDragon = definitionMinion(
    "BG34_638t",
    "already-shielded-golden-dragon",
    { attack: 31, health: 37, divineShield: true },
  );
  const nonDragon = definitionMinion(
    "BG29_611",
    "single-target-non-dragon",
    { attack: 23, health: 29, divineShield: false },
  );
  human.board = [amber, allType, shieldedDragon, nonDragon];
  keepOnlyOneOpponent(state, [
    enemyWall("single-target-amber-wall"),
  ]);
  human.board = [amber, allType, shieldedDragon, nonDragon];

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === amber.instanceId,
  );
  assert.equal(buffs.length, 1);
  assert.equal(
    buffs[0].targetInstanceId,
    allType.instanceId,
  );
  assert.deepEqual(
    [
      buffs[0].attackDelta,
      buffs[0].healthDelta,
      buffs[0].minion?.attack,
      buffs[0].minion?.health,
      buffs[0].minion?.divineShield,
    ],
    [2, 2, 19, 21, true],
  );
});

test("Costume Enthusiast and Choral Mrrrglr read current hand stats, ignore spells, and stay combat-only", () => {
  for (const golden of [false, true]) {
    const state = createGame(golden ? 0x5c011 : 0x5c010);
    const human = humanPlayer(state);
    const costume = golden
      ? goldenMinion(
          "BG34_142",
          "golden-costume-reader",
        )
      : definitionMinion(
          "BG34_142",
          "ordinary-costume-reader",
        );
    const choral = golden
      ? goldenMinion(
          "BG26_354",
          "golden-choral-reader",
        )
      : definitionMinion(
          "BG26_354",
          "ordinary-choral-reader",
        );
    const handA = definitionMinion(
      "BG25_001",
      "current-hand-stats-a",
      { attack: 7, health: 11, poolCopies: 2 },
    );
    const handB = definitionMinion(
      "BG29_611",
      "current-hand-stats-b",
      { attack: 13, health: 17, poolCopies: 3 },
    );
    const ignoredSpell = tavernSpell(
      "tavern-spell-slaughter",
      "ignored-start-spell",
    );
    human.board = [costume, choral];
    human.hand = [handA, ignoredSpell, handB];
    const permanentBoardBefore = structuredClone(human.board);
    const handBefore = structuredClone(human.hand);
    keepOnlyOneOpponent(state, [
      enemyWall(`hand-reader-wall-${golden}`),
    ]);
    human.board = [costume, choral];
    human.hand = [handA, ignoredSpell, handB];

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    assert.deepEqual(
      [
        battleMinion(combat, costume.instanceId).attack,
        battleMinion(combat, costume.instanceId).health,
      ],
      [costume.attack, costume.health],
    );
    assert.deepEqual(
      [
        battleMinion(combat, choral.instanceId).attack,
        battleMinion(combat, choral.instanceId).health,
      ],
      [choral.attack, choral.health],
    );

    const costumeStart = battle.events.find(
      (event) =>
        event.type === "startOfCombat" &&
        event.actorInstanceId === costume.instanceId,
    );
    const costumeBuff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === costume.instanceId,
    );
    const choralStart = battle.events.find(
      (event) =>
        event.type === "startOfCombat" &&
        event.actorInstanceId === choral.instanceId,
    );
    const choralBuff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === choral.instanceId,
    );
    assert.ok(costumeStart);
    assert.ok(costumeBuff);
    assert.ok(choralStart);
    assert.ok(choralBuff);
    const multiplier = golden ? 2 : 1;
    assert.deepEqual(
      [costumeBuff.attackDelta, costumeBuff.healthDelta],
      [13 * multiplier, 0],
    );
    assert.deepEqual(
      [
        costumeBuff.minion?.attack,
        costumeBuff.minion?.health,
        costumeBuff.minion?.divineShield,
      ],
      [
        costume.attack + 13 * multiplier,
        costume.health,
        true,
      ],
    );
    assert.deepEqual(
      [choralBuff.attackDelta, choralBuff.healthDelta],
      [20 * multiplier, 28 * multiplier],
    );
    assert.deepEqual(
      [
        choralBuff.minion?.attack,
        choralBuff.minion?.health,
      ],
      [
        choral.attack + 20 * multiplier,
        choral.health + 28 * multiplier,
      ],
    );
    assert.ok(costumeStart.index < costumeBuff.index);
    assert.ok(choralStart.index < choralBuff.index);
    assert.deepEqual(
      humanPlayer(combat).board,
      permanentBoardBefore,
    );
    assert.deepEqual(humanPlayer(combat).hand, handBefore);
  }
});

test("AI Start-of-Combat hand readers reveal totals but never hidden card identities", () => {
  const state = createGame(0x5c020);
  const human = humanPlayer(state);
  human.board = [enemyWall("ai-reader-human-wall")];
  const enemy = keepOnlyOneOpponent(state, []);
  const costume = definitionMinion(
    "BG34_142",
    "ai-costume-reader",
    { attack: 100, health: 100 },
  );
  const choral = definitionMinion(
    "BG26_354",
    "ai-choral-reader",
    { attack: 100, health: 100 },
  );
  const fillers = Array.from({ length: 5 }, (_, index) =>
    definitionMinion(
      "BG29_611",
      `ai-reader-filler-${index}`,
      { attack: 1_000, health: 1_000 },
    ),
  );
  const secretA = definitionMinion(
    "BG25_001",
    "secret-ai-hand-instance-a",
    { name: "绝密手牌甲", attack: 1, health: 2 },
  );
  const secretB = definitionMinion(
    "BG29_611",
    "secret-ai-hand-instance-b",
    { name: "绝密手牌乙", attack: 2, health: 3 },
  );
  enemy.board = [costume, choral, ...fillers];
  enemy.hand = [secretA, secretB];
  const handBefore = structuredClone(enemy.hand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const hiddenReaderEvents = battle.events.filter(
    (event) =>
      event.actorInstanceId === costume.instanceId ||
      event.actorInstanceId === choral.instanceId,
  );
  assert.ok(
    hiddenReaderEvents.some(
      (event) => event.type === "startOfCombat",
    ),
  );
  assert.ok(
    hiddenReaderEvents.some((event) => event.type === "buff"),
  );
  const serializedEvents = JSON.stringify(hiddenReaderEvents);
  for (const secret of [
    secretA.name,
    secretB.name,
    secretA.instanceId,
    secretB.instanceId,
  ]) {
    assert.equal(serializedEvents.includes(secret), false);
  }
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.deepEqual(nextEnemy.hand, handBefore);
});

test("ghost Start-of-Combat readers use their retained snapshot without mutating the eliminated owner", () => {
  const state = createGame(0x5c030);
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
      enemyWall(`ghost-reader-opponent-${index}`),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const costume = definitionMinion(
    "BG34_142",
    "ghost-costume-reader",
    { attack: 0, health: 1_000_000 },
  );
  const choral = definitionMinion(
    "BG26_354",
    "ghost-choral-reader",
    { attack: 0, health: 1_000_000 },
  );
  const secretA = definitionMinion(
    "BG25_001",
    "ghost-secret-hand-a",
    { name: "幽灵隐秘手牌甲", attack: 7, health: 11 },
  );
  const secretB = definitionMinion(
    "BG29_611",
    "ghost-secret-hand-b",
    { name: "幽灵隐秘手牌乙", attack: 13, health: 17 },
  );
  ghost.board = [costume, choral];
  ghost.ghostHand = [secretA, secretB];
  const boardBefore = structuredClone(ghost.board);
  const ghostHandBefore = structuredClone(ghost.ghostHand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.deepEqual(nextGhost.hand, []);
  assert.deepEqual(nextGhost.ghostHand, ghostHandBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const costumeBuff = ghostBattle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === costume.instanceId,
  );
  const choralBuff = ghostBattle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === choral.instanceId,
  );
  assert.ok(costumeBuff);
  assert.ok(choralBuff);
  assert.deepEqual(
    [costumeBuff.attackDelta, costumeBuff.healthDelta],
    [13, 0],
  );
  assert.deepEqual(
    [choralBuff.attackDelta, choralBuff.healthDelta],
    [20, 28],
  );
  const serializedEvents = JSON.stringify(
    ghostBattle.events.filter(
      (event) =>
        event.actorInstanceId === costume.instanceId ||
        event.actorInstanceId === choral.instanceId,
    ),
  );
  assert.equal(
    serializedEvents.includes(secretA.name),
    false,
  );
  assert.equal(
    serializedEvents.includes(secretB.name),
    false,
  );
});

test("real elimination returns hand ownership and retains a read-only ghost hand snapshot", () => {
  const state = createGame(0x5c031);
  state.round = 8;
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
      definitionMinion(
        "BG29_611",
        `real-ghost-opponent-${index}`,
        { attack: 1_000, health: 100_000, taunt: true },
      ),
    ];
  }

  const futureGhost = state.players[3];
  futureGhost.alive = true;
  futureGhost.health = 1;
  const aviator = definitionMinion(
    "BG34_140",
    "real-ghost-expert-aviator",
    { attack: 1, health: 1_500 },
  );
  const costume = definitionMinion(
    "BG34_142",
    "real-ghost-costume-reader",
    { attack: 0, health: 1 },
  );
  const choral = definitionMinion(
    "BG26_354",
    "real-ghost-choral-reader",
    { attack: 0, health: 1 },
  );
  const fillers = Array.from({ length: 3 }, (_, index) =>
    definitionMinion(
      "BG29_611",
      `real-ghost-filler-${index}`,
      { attack: 0, health: 1, taunt: true },
    ),
  );
  const secretA = definitionMinion(
    "BG25_001",
    "real-ghost-secret-a",
    {
      name: "真实淘汰隐秘手牌甲",
      attack: 7,
      health: 11,
      poolCopies: 1,
      playableFromRound: state.round + 1,
    },
  );
  const secretB = definitionMinion(
    "BG29_611",
    "real-ghost-secret-b",
    {
      name: "真实淘汰隐秘手牌乙",
      attack: 13,
      health: 17,
      poolCopies: 1,
      playableFromRound: state.round + 1,
    },
  );
  futureGhost.board = [aviator, costume, choral, ...fillers];
  futureGhost.hand = [secretA, secretB];
  state.pool[secretA.definitionId] = 5;
  state.pool[secretB.definitionId] = 5;

  const eliminated = gameReducer(state, { type: "END_TURN" });
  const eliminatedGhost = eliminated.players[3];
  assert.equal(eliminatedGhost.alive, false);
  assert.equal(eliminatedGhost.eliminatedRound, state.round);
  assert.deepEqual(eliminatedGhost.hand, []);
  assert.deepEqual(
    eliminatedGhost.ghostHand.map((minion) => [
      minion.instanceId,
      minion.attack,
      minion.health,
      minion.poolCopies,
    ]),
    [
      [secretA.instanceId, 7, 11, 0],
      [secretB.instanceId, 13, 17, 0],
    ],
  );
  assert.equal(eliminated.pool[secretA.definitionId], 6);
  assert.equal(eliminated.pool[secretB.definitionId], 6);
  const snapshotBefore = structuredClone(eliminatedGhost.ghostHand);
  const boardBefore = structuredClone(eliminatedGhost.board);

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(eliminated)),
  );
  assert.ok(restored !== null && typeof restored === "object");
  const recruit = gameReducer(restored as GameState, {
    type: "CONTINUE",
  });
  assert.equal(recruit.phase, "recruit");
  const scheduledGhost = getScheduledPairings(recruit).find(
    (pairing) => pairing.isGhost,
  );
  assert.equal(scheduledGhost?.playerBId, futureGhost.id);
  const poolBeforeGhostCombat = structuredClone(recruit.pool);
  const ghostCombat = gameReducer(recruit, { type: "END_TURN" });
  const ghostBattle = ghostCombat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === futureGhost.id ||
        battle.playerBId === futureGhost.id),
  );
  assert.ok(ghostBattle);
  const costumeBuff = ghostBattle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === costume.instanceId,
  );
  const choralBuff = ghostBattle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === choral.instanceId,
  );
  assert.deepEqual(
    [costumeBuff?.attackDelta, costumeBuff?.healthDelta],
    [13, 0],
  );
  assert.deepEqual(
    [choralBuff?.attackDelta, choralBuff?.healthDelta],
    [20, 28],
  );
  const aviatorSummon = ghostBattle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === aviator.instanceId &&
      event.summonReason === "rallyFromHand",
  );
  assert.ok(aviatorSummon);
  assert.equal(
    aviatorSummon.minion?.definitionId,
    secretB.definitionId,
  );
  assert.equal(aviatorSummon.minion?.poolCopies, 0);
  const nextGhost = ghostCombat.players[3];
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.deepEqual(nextGhost.hand, []);
  assert.deepEqual(nextGhost.ghostHand, snapshotBefore);
  assert.deepEqual(ghostCombat.pool, poolBeforeGhostCombat);
  const serializedEvents = JSON.stringify(
    ghostBattle.events.filter(
      (event) =>
        event.actorInstanceId === costume.instanceId ||
        event.actorInstanceId === choral.instanceId,
    ),
  );
  assert.equal(serializedEvents.includes(secretA.name), false);
  assert.equal(serializedEvents.includes(secretB.name), false);
});

test("existing Enhanced Whelp and Humming Bird Start-of-Combat effects keep ordinary and Golden scaling", () => {
  for (const golden of [false, true]) {
    const state = createGame(golden ? 0x5c041 : 0x5c040);
    const human = humanPlayer(state);
    const whelp = golden
      ? goldenMinion(
          "BG21_014",
          "golden-enhanced-whelp",
        )
      : definitionMinion(
          "BG21_014",
          "ordinary-enhanced-whelp",
        );
    const dragon = definitionMinion(
      "BG34_638t",
      `existing-start-dragon-${golden}`,
      { attack: 10, health: 20 },
    );
    const hummingBird = golden
      ? goldenMinion(
          "BG26_805",
          "golden-humming-bird",
        )
      : definitionMinion(
          "BG26_805",
          "ordinary-humming-bird",
        );
    const beast = definitionMinion(
      "BG31_801",
      `existing-start-beast-${golden}`,
      { attack: 30, health: 40 },
    );
    human.board = [whelp, dragon, hummingBird, beast];
    const permanentBoardBefore = structuredClone(human.board);
    keepOnlyOneOpponent(state, [
      enemyWall(`existing-start-wall-${golden}`),
    ]);
    human.board = [whelp, dragon, hummingBird, beast];

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    const multiplier = golden ? 2 : 1;
    const whelpBuffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === whelp.instanceId,
    );
    const birdBuffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === hummingBird.instanceId,
    );
    assert.equal(whelpBuffs.length, 2);
    assert.deepEqual(
      new Set(
        whelpBuffs.map((event) => event.targetInstanceId),
      ),
      new Set([whelp.instanceId, dragon.instanceId]),
    );
    assert.ok(
      whelpBuffs.every(
        (event) =>
          event.attackDelta === 4 * multiplier &&
          event.healthDelta === 4 * multiplier,
      ),
    );
    assert.equal(birdBuffs.length, 2);
    assert.deepEqual(
      new Set(
        birdBuffs.map((event) => event.targetInstanceId),
      ),
      new Set([hummingBird.instanceId, beast.instanceId]),
    );
    assert.ok(
      birdBuffs.every(
        (event) =>
          event.attackDelta === multiplier &&
          event.healthDelta === 0,
      ),
    );
    for (const source of [whelp, hummingBird]) {
      const start = battle.events.find(
        (event) =>
          event.type === "startOfCombat" &&
          event.actorInstanceId === source.instanceId,
      );
      const firstBuff = battle.events.find(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === source.instanceId,
      );
      assert.ok(start);
      assert.ok(firstBuff);
      assert.ok(start.index < firstBuff.index);
    }
    assert.deepEqual(
      humanPlayer(combat).board,
      permanentBoardBefore,
    );
  }
});

test("queued Start-of-Combat spells and Beetles resolve before minion Start-of-Combat effects", () => {
  {
    const state = createGame(0x5c048);
    const human = humanPlayer(state);
    const choral = definitionMinion(
      "BG26_354",
      "ordered-choral",
    );
    human.board = [choral];
    human.hand = [
      definitionMinion("BG25_001", "ordered-hand-minion", {
        attack: 2,
        health: 3,
      }),
    ];
    const enemy = keepOnlyOneOpponent(state, [
      enemyWall("ordered-upper-hand-owner"),
    ]);
    human.board = [choral];
    human.hand = [
      definitionMinion("BG25_001", "ordered-hand-minion", {
        attack: 2,
        health: 3,
      }),
    ];
    enemy.nextCombatSetEnemyHealthToOne = 1;

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    const upperHand = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === choral.instanceId &&
        event.message.includes("优势压制"),
    );
    const choralStart = battle.events.find(
      (event) =>
        event.type === "startOfCombat" &&
        event.actorInstanceId === choral.instanceId,
    );
    const choralBuff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === choral.instanceId,
    );
    assert.ok(upperHand);
    assert.ok(choralStart);
    assert.ok(choralBuff);
    assert.ok(upperHand.index < choralStart.index);
    assert.ok(choralStart.index < choralBuff.index);
    assert.equal(upperHand.minion?.health, 1);
    assert.deepEqual(
      [choralBuff.minion?.attack, choralBuff.minion?.health],
      [8, 4],
    );
  }

  for (const [caseIndex, definitionId] of [
    "BG34_142",
    "BG26_354",
  ].entries()) {
    const state = createGame(0x5c049 + caseIndex);
    const human = humanPlayer(state);
    const source = definitionMinion(
      definitionId,
      `ordered-double-source-${caseIndex}`,
    );
    human.board = [source];
    human.hand = [
      definitionMinion(
        "BG25_001",
        `ordered-double-hand-${caseIndex}`,
        { attack: 2, health: 3 },
      ),
    ];
    human.nextCombatDoubleLeftmostAttack = [
      { attack: 0, health: 0 },
    ];
    keepOnlyOneOpponent(state, [
      enemyWall(`ordered-double-wall-${caseIndex}`),
    ]);
    human.board = [source];
    human.hand = [
      definitionMinion(
        "BG25_001",
        `ordered-double-hand-${caseIndex}`,
        { attack: 2, health: 3 },
      ),
    ];
    human.nextCombatDoubleLeftmostAttack = [
      { attack: 0, health: 0 },
    ];

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    const nozdormu = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === source.instanceId &&
        event.message.includes("诺兹多姆"),
    );
    const sourceBuff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.ok(nozdormu);
    assert.ok(sourceBuff);
    assert.ok(nozdormu.index < sourceBuff.index);
    assert.deepEqual(
      [sourceBuff.minion?.attack, sourceBuff.minion?.health],
      definitionId === "BG34_142" ? [10, 5] : [14, 9],
    );
  }

  {
    const state = createGame(0x5c04b);
    const human = humanPlayer(state);
    const choral = definitionMinion(
      "BG26_354",
      "beetle-order-choral",
    );
    human.board = [choral];
    human.hand = [];
    human.nextCombatBeetles = 1;
    keepOnlyOneOpponent(state, [
      enemyWall("beetle-order-wall"),
    ]);
    human.board = [choral];
    human.nextCombatBeetles = 1;

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    const beetle = battle.events.find(
      (event) =>
        event.type === "summon" &&
        event.summonReason === "beetle",
    );
    const choralStart = battle.events.find(
      (event) =>
        event.type === "startOfCombat" &&
        event.actorInstanceId === choral.instanceId,
    );
    assert.ok(beetle);
    assert.ok(choralStart);
    assert.ok(beetle.index < choralStart.index);
  }
});

test("AI keeps useful hand minions for Choral once its target board size is met", () => {
  const state = createGame(0x5c04c);
  state.round = 1;
  const human = humanPlayer(state);
  human.board = [enemyWall("ai-reserve-human-wall")];
  const enemy = keepOnlyOneOpponent(state, []);
  const choral = definitionMinion(
    "BG26_354",
    "ai-reserve-choral",
    { attack: 0, health: 1_000_000 },
  );
  const handA = definitionMinion(
    "BG25_001",
    "ai-reserve-hand-a",
    { attack: 7, health: 11 },
  );
  const handB = definitionMinion(
    "BG29_611",
    "ai-reserve-hand-b",
    { attack: 13, health: 17 },
  );
  enemy.board = [choral];
  enemy.hand = [handA, handB];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.deepEqual(
    nextEnemy.hand.map((card) => card.instanceId),
    [handA.instanceId, handB.instanceId],
  );
  const battle = combat.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === enemy.id ||
      candidate.playerBId === enemy.id,
  );
  assert.ok(battle);
  const choralBuff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === choral.instanceId,
  );
  assert.deepEqual(
    [choralBuff?.attackDelta, choralBuff?.healthDelta],
    [20, 28],
  );
});

test("v26 saves migrate through v31 with refreshed Golden Start-of-Combat metadata and no combat state", () => {
  const legacy = structuredClone(createGame(0x5c050));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V26;
  for (const legacyPlayer of legacy.players) {
    delete (
      legacyPlayer as unknown as {
        ghostHand?: BoardMinionInstance[];
      }
    ).ghostHand;
  }
  const player = humanPlayer(legacy);
  const amber = goldenMinion(
    "BG24_500",
    "legacy-golden-amber",
    {
      cardId: "BG24_500",
      description:
        "嘲讽。战斗开始时：使另一条友方的龙获得+2/+2和圣盾。",
      effectSupport: "partial",
      attack: 31,
      health: 37,
      effectCounters: { existingCounter: 9 },
    },
  );
  const costume = goldenMinion(
    "BG34_142",
    "legacy-golden-costume",
    {
      cardId: "BG34_142",
      description:
        "圣盾。战斗开始时：获得你手牌中攻击力最高的随从牌的攻击力。",
      effectSupport: "partial",
      attack: 41,
      health: 43,
    },
  );
  const choral = goldenMinion(
    "BG26_354",
    "legacy-golden-choral",
    {
      cardId: "BG26_354",
      description:
        "战斗开始时：获得你手牌中所有随从牌的属性值。",
      effectSupport: "partial",
      attack: 47,
      health: 53,
    },
  );
  player.board = [amber];
  player.hand = [costume];
  player.shop = [choral];

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  );
  assert.ok(migrated !== null && typeof migrated === "object");
  const migratedState = migrated as GameState;
  assert.equal(
    migratedState.contentVersion,
    CURRENT_ROSTER_VERSION,
  );
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v38",
  );
  const nextPlayer = humanPlayer(migratedState);
  assert.deepEqual(nextPlayer.ghostHand, []);
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
    ["complete", "complete", "complete"],
  );
  assert.deepEqual(
    refreshed.map((minion) => [
      minion.instanceId,
      minion.attack,
      minion.health,
    ]),
    [
      ["legacy-golden-amber", 31, 37],
      ["legacy-golden-costume", 41, 43],
      ["legacy-golden-choral", 47, 53],
    ],
  );
  assert.deepEqual(
    refreshed.map((minion) => minion.cardId),
    ["BG24_500_G", "BG34_142_G", "BG26_354_G"],
  );
  assert.deepEqual(
    refreshed.map((minion) => minion.description),
    [
      "嘲讽。战斗开始时：使两条其他友方的龙获得+2/+2和圣盾。",
      "圣盾。战斗开始时：获得你手牌中攻击力最高的随从牌的双倍攻击力。",
      "战斗开始时：获得你手牌中所有随从牌的双倍属性值。",
    ],
  );
  assert.deepEqual(
    refreshed[0].effectCounters,
    { existingCounter: 9 },
  );
  for (const card of refreshed) {
    const record = card as unknown as Record<string, unknown>;
    assert.equal("startOfCombatProgress" in record, false);
    assert.equal("pendingStartOfCombat" in record, false);
  }
});

test("current v31 saves repair a missing ghost snapshot and reject pool ownership inside one", () => {
  const missingSnapshot = structuredClone(createGame(0x5c051));
  for (const player of missingSnapshot.players) {
    delete (
      player as unknown as {
        ghostHand?: BoardMinionInstance[];
      }
    ).ghostHand;
  }
  const repaired = normalizePersistedGameState(
    JSON.parse(JSON.stringify(missingSnapshot)),
  );
  assert.ok(repaired !== null && typeof repaired === "object");
  assert.ok(
    (repaired as GameState).players.every(
      (player) => player.ghostHand.length === 0,
    ),
  );

  const invalidSnapshot = structuredClone(createGame(0x5c052));
  invalidSnapshot.players[1].ghostHand = [
    definitionMinion(
      "BG29_611",
      "invalid-owned-ghost-card",
      { poolCopies: 1 },
    ),
  ];
  assert.equal(
    normalizePersistedGameState(
      JSON.parse(JSON.stringify(invalidSnapshot)),
    ),
    null,
  );
});
