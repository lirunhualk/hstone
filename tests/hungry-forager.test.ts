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
  type BattleEvent,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V27,
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
        (definition.tribe === "neutral"
          ? []
          : [definition.tribe])),
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

function filler(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("BG34_636t", instanceId, {
    attack: 0,
    health: 1_000_000,
    taunt: false,
    divineShield: false,
    reborn: false,
    ...overrides,
  });
}

function enemyWall(
  instanceId: string,
  attack = 100,
): BoardMinionInstance {
  return filler(instanceId, {
    attack,
    health: 1_000_000,
    taunt: true,
  });
}

function isolateTwoPlayerBattle(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (index === 0) {
      player.alive = true;
      player.health = 100;
      continue;
    }
    player.hand = [];
    player.ghostHand = [];
    if (index === 1) {
      player.alive = true;
      player.health = 100;
      player.board = enemyBoard;
      player.eliminatedRound = undefined;
      continue;
    }
    player.alive = false;
    player.health = 0;
    player.board = [];
    player.eliminatedRound = 0;
  }
  return state.players[1];
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

function foragerSummons(
  events: readonly BattleEvent[],
  sourceInstanceId: string,
): BattleEvent[] {
  return events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === sourceInstanceId &&
      event.summonReason === "startOfCombatFromHand",
  );
}

test("Hungry Forager maps the exact ordinary and Golden metadata", () => {
  const definition = getMinionDefinition("BG27_556");

  assert.equal(definition.effectSupport, "complete");
  assert.equal(definition.name, "凶饿的觅食者");
  assert.equal(definition.tier, 4);
  assert.deepEqual(
    [definition.attack, definition.health],
    [5, 6],
  );
  assert.deepEqual(definition.tribes, ["murloc"]);
  assert.equal(
    definition.description,
    "战斗开始时：当你有空位时，召唤你手牌中攻击力最高的鱼人，其登场仅限本场战斗。",
  );
  assert.equal(definition.goldenCardId, "BG27_556_G");
  assert.equal(
    definition.goldenDescription,
    "战斗开始时：当你有空位时，召唤你手牌中攻击力最高的两个鱼人，其登场仅限本场战斗。",
  );
  assert.deepEqual(definition.printedMechanics, [
    "TRIGGER_VISUAL",
  ]);
  assert.deepEqual(definition.startOfCombat, [
    {
      kind: "summonHighestAttackHandTribeWhenSpace",
      tribe: "murloc",
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);
});

test("ordinary Hungry Forager summons the highest-Attack Murloc or All minion and ignores other cards", () => {
  const state = createGame(0x5d001);
  const human = humanPlayer(state);
  const forager = definitionMinion(
    "BG27_556",
    "ordinary-forager",
    { health: 1_000_000 },
  );
  const murloc = definitionMinion(
    "BG34_636t",
    "ordinary-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 23,
      health: 29,
      poolCopies: 1,
    },
  );
  const allMinion = definitionMinion(
    "BG34_638t",
    "ordinary-all-minion",
    {
      tribe: "all",
      tribes: ["all"],
      attack: 31,
      health: 37,
      poolCopies: 2,
      attachments: [
        {
          sourceInstanceId: "ordinary-attachment",
          definitionId: "BG35_890",
          cardId: "BG35_890",
          name: "测试磁力组件",
          description: "测试组件",
          effectSupport: "complete",
          golden: false,
          poolCopies: 1,
          attackGranted: 3,
          healthGranted: 5,
          attachments: [
            {
              sourceInstanceId: "ordinary-nested-attachment",
              definitionId: "BG26_146",
              cardId: "BG26_146",
              name: "测试嵌套组件",
              description: "测试嵌套组件",
              effectSupport: "complete",
              golden: false,
              poolCopies: 1,
              attackGranted: 1,
              healthGranted: 1,
              attachments: [],
            },
          ],
        },
      ],
    },
  );
  const nonMurloc = definitionMinion(
    "BG34_636t",
    "ordinary-non-murloc",
    {
      tribe: "dragon",
      tribes: ["dragon"],
      attack: 99,
      health: 101,
    },
  );
  const spell = tavernSpell(
    "tavern-spell-pointy-arrow",
    "ordinary-spell",
  );
  human.board = [
    filler("ordinary-left-filler"),
    forager,
    filler("ordinary-right-filler"),
  ];
  human.hand = [murloc, nonMurloc, spell, allMinion];
  human.tavernTypeBuffs = [
    { tribes: ["murloc"], attack: 7, health: 11 },
  ];
  isolateTwoPlayerBattle(state, [
    enemyWall("ordinary-forager-wall", 0),
  ]);
  const handBefore = structuredClone(human.hand);
  const poolBefore = structuredClone(state.pool);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const start = battle.events.find(
    (event) =>
      event.type === "startOfCombat" &&
      event.actorInstanceId === forager.instanceId,
  );
  const summons = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.ok(start);
  assert.equal(summons.length, 1);
  assert.ok(start.index < summons[0].index);
  assert.equal(summons[0].boardIndex, 2);
  assert.equal(
    summons[0].minion?.instanceId === allMinion.instanceId,
    false,
  );
  assert.equal(
    summons[0].minion?.definitionId,
    allMinion.definitionId,
  );
  assert.deepEqual(
    [summons[0].minion?.attack, summons[0].minion?.health],
    [31, 37],
  );
  assert.equal(summons[0].minion?.poolCopies, 0);
  assert.equal(summons[0].minion?.grantsTripleReward, false);
  assert.equal(summons[0].minion?.attachments[0]?.poolCopies, 0);
  assert.equal(
    summons[0].minion?.attachments[0]?.attachments[0]
      ?.poolCopies,
    0,
  );
  assert.deepEqual(humanPlayer(combat).hand, handBefore);
  assert.deepEqual(combat.pool, poolBefore);
});

test("Golden Hungry Forager summons two different highest-Attack physical Murlocs in order", () => {
  const state = createGame(0x5d002);
  const human = humanPlayer(state);
  const forager = goldenMinion(
    "BG27_556",
    "golden-forager",
    { health: 1_000_000 },
  );
  const highest = definitionMinion(
    "BG34_638t",
    "golden-highest-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 41,
      health: 43,
      poolCopies: 1,
    },
  );
  const second = definitionMinion(
    "BG34_636t",
    "golden-second-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 31,
      health: 37,
      poolCopies: 1,
    },
  );
  const third = definitionMinion(
    "BG34_637t",
    "golden-third-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 19,
      health: 23,
      poolCopies: 1,
    },
  );
  const unrelated = definitionMinion(
    "BG34_636t",
    "golden-unrelated-dragon",
    { attack: 100, health: 100 },
  );
  human.board = [forager];
  human.hand = [third, unrelated, second, highest];
  isolateTwoPlayerBattle(state, [
    enemyWall("golden-forager-wall", 0),
  ]);
  const handBefore = structuredClone(human.hand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const summons = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.equal(summons.length, 2);
  assert.deepEqual(
    summons.map((event) => event.minion?.definitionId),
    [highest.definitionId, second.definitionId],
  );
  assert.deepEqual(
    summons.map((event) => [
      event.minion?.attack,
      event.minion?.health,
    ]),
    [
      [41, 43],
      [31, 37],
    ],
  );
  assert.equal(
    summons[0].minion?.instanceId ===
      summons[1].minion?.instanceId,
    false,
  );
  assert.equal(
    [
      highest.instanceId,
      second.instanceId,
      third.instanceId,
    ].includes(summons[0].minion?.instanceId ?? ""),
    false,
  );
  assert.equal(
    [
      highest.instanceId,
      second.instanceId,
      third.instanceId,
    ].includes(summons[1].minion?.instanceId ?? ""),
    false,
  );
  assert.ok(summons[0].index < summons[1].index);
  assert.deepEqual(
    summons.map((event) => event.boardIndex),
    [1, 2],
  );
  assert.deepEqual(humanPlayer(combat).hand, handBefore);
});

test("a full-board Golden Hungry Forager spends its two summons across separate later slots", () => {
  const state = createGame(0x5d003);
  const human = humanPlayer(state);
  const firstDisposable = filler(
    "split-golden-disposable-a",
    { attack: 1, health: 1 },
  );
  const secondDisposable = filler(
    "split-golden-disposable-b",
    { attack: 1, health: 1 },
  );
  const forager = goldenMinion(
    "BG27_556",
    "split-golden-forager",
    { attack: 0, health: 1_000_000 },
  );
  const tauntTank = filler("split-golden-taunt-tank", {
    taunt: true,
  });
  const highest = definitionMinion(
    "BG34_638t",
    "split-golden-highest",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 31,
      health: 37,
    },
  );
  const second = definitionMinion(
    "BG34_636t",
    "split-golden-second",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 23,
      health: 29,
    },
  );
  human.board = [
    firstDisposable,
    secondDisposable,
    forager,
    filler("split-golden-filler-a"),
    filler("split-golden-filler-b"),
    filler("split-golden-filler-c"),
    tauntTank,
  ];
  human.hand = [second, highest];
  isolateTwoPlayerBattle(state, [
    enemyWall("split-golden-wall"),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const firstDeath = battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === firstDisposable.instanceId,
  );
  const secondDeath = battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === secondDisposable.instanceId,
  );
  const summons = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.ok(firstDeath);
  assert.ok(secondDeath);
  assert.equal(summons.length, 2);
  assert.deepEqual(
    summons.map((event) => event.minion?.definitionId),
    [highest.definitionId, second.definitionId],
  );
  assert.ok(firstDeath.index < summons[0].index);
  assert.ok(summons[0].index < secondDeath.index);
  assert.ok(secondDeath.index < summons[1].index);
  assert.deepEqual(
    summons.map((event) => event.boardIndex),
    [6, 6],
  );
  assert.notEqual(
    summons[0].minion?.instanceId,
    summons[1].minion?.instanceId,
  );
});

test("a full board delays Hungry Forager until a slot opens and the queue survives its source", () => {
  const state = createGame(0x5d004);
  const human = humanPlayer(state);
  const forager = definitionMinion(
    "BG27_556",
    "delayed-dead-forager",
    { attack: 5, health: 6 },
  );
  const handMurloc = definitionMinion(
    "BG34_638t",
    "delayed-hand-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 29,
      health: 31,
      poolCopies: 1,
    },
  );
  human.board = [
    forager,
    ...Array.from({ length: 6 }, (_, index) =>
      filler(`delayed-filler-${index}`),
    ),
  ];
  human.hand = [handMurloc];
  isolateTwoPlayerBattle(state, [
    enemyWall("delayed-forager-wall"),
  ]);
  const permanentBoardBefore = structuredClone(human.board);
  const handBefore = structuredClone(human.hand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const start = battle.events.find(
    (event) =>
      event.type === "startOfCombat" &&
      event.actorInstanceId === forager.instanceId,
  );
  const attack = battle.events.find(
    (event) =>
      event.type === "attack" &&
      event.actorInstanceId === forager.instanceId,
  );
  const death = battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === forager.instanceId,
  );
  const [summon] = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.ok(start);
  assert.ok(attack);
  assert.ok(death);
  assert.ok(summon);
  assert.ok(start.index < attack.index);
  assert.ok(attack.index < death.index);
  assert.ok(death.index < summon.index);
  assert.equal(summon.boardIndex, 6);
  assert.equal(
    summon.minion?.definitionId,
    handMurloc.definitionId,
  );
  assert.deepEqual(
    battle.initialBoards[state.humanPlayerId],
    permanentBoardBefore,
  );
  assert.deepEqual(humanPlayer(combat).board, permanentBoardBefore);
  assert.deepEqual(humanPlayer(combat).hand, handBefore);
});

test("a nested immediate attack cannot let Forager outrun later Deathrattles in the same wave", () => {
  const state = createGame(0x5d00c);
  const human = humanPlayer(state);
  const scallywag = definitionMinion(
    "scallywag",
    "reentrant-scallywag",
    { attack: 0, health: 1, taunt: true },
  );
  const harvestGolem = definitionMinion(
    "harvest-golem",
    "reentrant-harvest-golem",
    { attack: 0, health: 1 },
  );
  const forager = definitionMinion(
    "BG27_556",
    "reentrant-forager",
    { attack: 0, health: 1_000_000 },
  );
  human.board = [
    scallywag,
    harvestGolem,
    forager,
    ...Array.from({ length: 4 }, (_, index) =>
      filler(`reentrant-filler-${index}`),
    ),
  ];
  human.hand = [
    definitionMinion(
      "BG34_638t",
      "reentrant-hand-murloc",
      {
        tribe: "murloc",
        tribes: ["murloc"],
        attack: 29,
        health: 31,
      },
    ),
  ];
  isolateTwoPlayerBattle(state, [
    filler("reentrant-cleave-attacker", {
      attack: 100,
      cleave: true,
    }),
    enemyWall("reentrant-immediate-attack-wall", 0),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const scallywagSummon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === scallywag.instanceId,
  );
  const immediateAttack = battle.events.find(
    (event) =>
      event.type === "attack" &&
      event.actorInstanceId ===
        scallywagSummon?.targetInstanceId,
  );
  const harvestSummon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === harvestGolem.instanceId,
  );
  const [foragerSummon] = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.ok(scallywagSummon);
  assert.ok(immediateAttack);
  assert.ok(harvestSummon);
  assert.ok(foragerSummon);
  assert.ok(scallywagSummon.index < immediateAttack.index);
  assert.ok(immediateAttack.index < harvestSummon.index);
  assert.ok(harvestSummon.index < foragerSummon.index);
});

test("the delayed queue reads the current hand only when space opens", () => {
  const state = createGame(0x5d005);
  const human = humanPlayer(state);
  const deathrattle = definitionMinion(
    "BG26_360",
    "dynamic-hand-deathrattle",
    { attack: 4, health: 3 },
  );
  const forager = definitionMinion(
    "BG27_556",
    "dynamic-hand-forager",
    { health: 1_000_000 },
  );
  const handMurloc = definitionMinion(
    "BG34_638t",
    "dynamic-hand-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 10,
      health: 11,
      poolCopies: 1,
    },
  );
  human.board = [
    deathrattle,
    forager,
    ...Array.from({ length: 5 }, (_, index) =>
      filler(`dynamic-hand-filler-${index}`),
    ),
  ];
  human.hand = [handMurloc];
  isolateTwoPlayerBattle(state, [
    enemyWall("dynamic-hand-wall"),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const death = battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === deathrattle.instanceId,
  );
  const handBuff = battle.events.find(
    (event) =>
      event.type === "handBuff" &&
      event.actorInstanceId === deathrattle.instanceId,
  );
  const [summon] = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.ok(death);
  assert.ok(handBuff);
  assert.ok(summon);
  assert.ok(death.index < handBuff.index);
  assert.ok(handBuff.index < summon.index);
  assert.deepEqual(
    [summon.minion?.attack, summon.minion?.health],
    [17, 18],
  );
  const nextHandCard = humanPlayer(combat).hand[0];
  assert.ok(nextHandCard?.kind === "minion");
  assert.deepEqual(
    [nextHandCard.attack, nextHandCard.health],
    [17, 18],
  );
  assert.equal(nextHandCard.instanceId, handMurloc.instanceId);
  assert.equal(summon.minion?.poolCopies, 0);
});

test("an empty opening hand can gain a Murloc during combat and satisfy the pending queue later", () => {
  const state = createGame(0x5d006);
  state.activeTribes = [
    "murloc",
    "beast",
    "mech",
    "dragon",
    "undead",
  ];
  const human = humanPlayer(state);
  human.tavernTier = 6;
  const recruiter = definitionMinion(
    "BG34_925",
    "dynamic-gain-recruiter",
    { attack: 3, health: 5 },
  );
  const rightMurloc = definitionMinion(
    "BG32_330",
    "dynamic-gain-right-murloc",
    { attack: 0, health: 1_000_000 },
  );
  const forager = definitionMinion(
    "BG27_556",
    "dynamic-gain-forager",
    { attack: 0, health: 1_000_000 },
  );
  human.board = [
    recruiter,
    rightMurloc,
    forager,
  ];
  human.hand = [];
  isolateTwoPlayerBattle(state, [
    enemyWall("dynamic-gain-wall", 0),
  ]);
  keepOnlyPoolDefinition(state, "BG33_140", 1);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const gain = battle.events.find(
    (event) =>
      event.type === "cardGain" &&
      event.actorInstanceId === recruiter.instanceId &&
      event.cardGainResult === "added",
  );
  const damage = battle.events.find(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === recruiter.instanceId &&
      event.targetInstanceId === "dynamic-gain-wall",
  );
  const [summon] = foragerSummons(
    battle.events,
    forager.instanceId,
  );

  assert.ok(gain);
  assert.ok(damage);
  assert.ok(summon);
  assert.ok(gain.index < summon.index);
  assert.ok(summon.index < damage.index);
  assert.equal(summon.boardIndex, 3);
  assert.equal(gain.minion?.definitionId, "BG33_140");
  assert.equal(summon.minion?.definitionId, "BG33_140");
  assert.notEqual(
    summon.minion?.instanceId,
    gain.minion?.instanceId,
  );
  assert.equal(summon.minion?.poolCopies, 0);
  const heldCandidate = humanPlayer(combat).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG33_140",
  );
  assert.ok(heldCandidate);
  assert.equal(heldCandidate.poolCopies, 1);
  assert.equal(combat.pool.BG33_140, 0);
});

test("AI reserves the useful Murloc instead of a higher-Attack non-Murloc", () => {
  const state = createGame(0x5d007);
  state.round = 1;
  const human = humanPlayer(state);
  const enemy = isolateTwoPlayerBattle(state, []);
  human.board = [enemyWall("ai-forager-human-wall", 0)];
  const forager = definitionMinion(
    "BG27_556",
    "ai-forager",
    { health: 1_000_000 },
  );
  const reservedMurloc = definitionMinion(
    "BG34_638t",
    "ai-reserved-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 8,
      health: 9,
    },
  );
  const higherNonMurloc = definitionMinion(
    "BG34_636t",
    "ai-played-non-murloc",
    { attack: 80, health: 81 },
  );
  enemy.board = [forager];
  enemy.hand = [reservedMurloc, higherNonMurloc];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.deepEqual(
    nextEnemy.hand.map((card) => card.instanceId),
    [reservedMurloc.instanceId],
  );
  assert.ok(
    nextEnemy.board.some(
      (minion) =>
        minion.instanceId === higherNonMurloc.instanceId,
    ),
  );
  const battle = combat.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === enemy.id ||
      candidate.playerBId === enemy.id,
  );
  assert.ok(battle);
  const [summon] = foragerSummons(
    battle.events,
    forager.instanceId,
  );
  assert.ok(summon);
  assert.equal(
    summon.minion?.definitionId,
    reservedMurloc.definitionId,
  );
  assert.deepEqual(
    [summon.minion?.attack, summon.minion?.health],
    [8, 9],
  );
});

test("AI prefers one Murloc that satisfies both Forager and a generic hand reader", () => {
  const state = createGame(0x5d008);
  state.round = 3;
  const human = humanPlayer(state);
  const enemy = isolateTwoPlayerBattle(state, []);
  human.board = [enemyWall("ai-overlap-human-wall", 0)];
  const forager = definitionMinion(
    "BG27_556",
    "ai-overlap-forager",
    { health: 1_000_000 },
  );
  const costume = definitionMinion(
    "BG34_142",
    "ai-overlap-costume",
    { attack: 0, health: 1_000_000 },
  );
  const sharedTarget = definitionMinion(
    "BG34_638t",
    "ai-overlap-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 8,
      health: 9,
    },
  );
  const higherNonMurloc = definitionMinion(
    "BG34_636t",
    "ai-overlap-non-murloc",
    { attack: 80, health: 81 },
  );
  enemy.board = [forager, costume];
  enemy.hand = [sharedTarget, higherNonMurloc];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players.find(
    (player) => player.id === enemy.id,
  );
  assert.ok(nextEnemy);
  assert.deepEqual(
    nextEnemy.hand.map((card) => card.instanceId),
    [sharedTarget.instanceId],
  );
  assert.ok(
    nextEnemy.board.some(
      (minion) =>
        minion.instanceId === higherNonMurloc.instanceId,
    ),
  );
  const battle = combat.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === enemy.id ||
      candidate.playerBId === enemy.id,
  );
  assert.ok(battle);
  assert.equal(
    foragerSummons(battle.events, forager.instanceId)[0]?.minion
      ?.definitionId,
    sharedTarget.definitionId,
  );
  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === costume.instanceId &&
        event.targetInstanceId === costume.instanceId &&
        event.attackDelta === sharedTarget.attack,
    ),
  );
});

test("a ghost Hungry Forager reads its zero-ownership snapshot without mutating the eliminated player or pool", () => {
  const state = createGame(0x5c030);
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
  for (const [index, player] of state.players
    .slice(0, 3)
    .entries()) {
    player.alive = true;
    player.health = 100;
    player.board = [
      enemyWall(`ghost-forager-opponent-${index}`, 0),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const forager = definitionMinion(
    "BG27_556",
    "ghost-forager",
    { health: 1_000_000 },
  );
  const ghostMurloc = definitionMinion(
    "BG34_638t",
    "ghost-forager-hand-murloc",
    {
      tribe: "murloc",
      tribes: ["murloc"],
      attack: 47,
      health: 53,
      poolCopies: 0,
    },
  );
  ghost.board = [forager];
  ghost.ghostHand = [ghostMurloc];
  const scheduledGhost = getScheduledPairings(state).find(
    (pairing) => pairing.isGhost,
  );
  assert.equal(scheduledGhost?.playerBId, ghost.id);
  const boardBefore = structuredClone(ghost.board);
  const snapshotBefore = structuredClone(ghost.ghostHand);
  const poolBefore = structuredClone(state.pool);

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const [summon] = foragerSummons(
    ghostBattle.events,
    forager.instanceId,
  );
  assert.ok(summon);
  assert.equal(
    summon.minion?.definitionId,
    ghostMurloc.definitionId,
  );
  assert.notEqual(
    summon.minion?.instanceId,
    ghostMurloc.instanceId,
  );
  assert.deepEqual(
    [summon.minion?.attack, summon.minion?.health],
    [47, 53],
  );
  assert.equal(summon.minion?.poolCopies, 0);
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.deepEqual(nextGhost.hand, []);
  assert.deepEqual(nextGhost.ghostHand, snapshotBefore);
  assert.deepEqual(combat.pool, poolBefore);
});

test("v27 saves migrate through v31 with refreshed Golden Forager metadata and no persisted combat queue", () => {
  const legacy = structuredClone(createGame(0x5d008));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V27;
  const player = humanPlayer(legacy);
  const staleForager = goldenMinion(
    "BG27_556",
    "legacy-golden-forager",
    {
      cardId: "BG27_556",
      description:
        "战斗开始时：当你有空位时，召唤你手牌中攻击力最高的鱼人，其登场仅限本场战斗。",
      effectSupport: "partial",
      attack: 61,
      health: 67,
      effectCounters: { existingCounter: 11 },
    },
  );
  player.board = [staleForager];

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  );
  assert.ok(migrated !== null && typeof migrated === "object");
  const migratedState = migrated as GameState;
  const migratedForager =
    humanPlayer(migratedState).board[0];

  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v35",
  );
  assert.equal(
    migratedState.contentVersion,
    CURRENT_ROSTER_VERSION,
  );
  assert.equal(migratedForager.instanceId, staleForager.instanceId);
  assert.equal(migratedForager.effectSupport, "complete");
  assert.equal(migratedForager.cardId, "BG27_556_G");
  assert.equal(
    migratedForager.description,
    "战斗开始时：当你有空位时，召唤你手牌中攻击力最高的两个鱼人，其登场仅限本场战斗。",
  );
  assert.deepEqual(
    [migratedForager.attack, migratedForager.health],
    [61, 67],
  );
  assert.deepEqual(migratedForager.effectCounters, {
    existingCounter: 11,
  });
  assert.equal(
    "pendingStartOfCombatHandSummons" in
      (migratedState as unknown as Record<string, unknown>),
    false,
  );
  assert.equal(
    "pendingStartOfCombatHandSummons" in
      (migratedForager as unknown as Record<string, unknown>),
    false,
  );
  assert.deepEqual(
    normalizePersistedGameState(
      JSON.parse(JSON.stringify(migratedState)),
    ),
    migratedState,
  );
});
