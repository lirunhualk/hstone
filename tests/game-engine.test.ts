import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getUpgradeCost,
  type BattleEvent,
  type BoardMinionInstance,
  type GameAction,
  type GameState,
  type PlayerState,
  type TripleRewardSpellInstance,
} from "../lib/game/engine.ts";
import {
  CLASSIC_ROSTER_VERSION,
  LEGACY_RULE_DEFINITIONS,
  LIVE_MINION_DEFINITIONS,
  MINION_DEFINITIONS,
  TOKEN_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { projectCombatBoard } from "../lib/game/playback.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function applyActions(
  state: GameState,
  actions: readonly GameAction[],
): GameState {
  return actions.reduce(gameReducer, state);
}

function fixtureMinion(
  template: BoardMinionInstance,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return {
    ...template,
    instanceId,
    divineShield: false,
    taunt: false,
    golden: false,
    poolCopies: 0,
    ...overrides,
  };
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
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
    poolCopies: 0,
    ...overrides,
  };
}

function prepareLockedCombat(state: GameState): void {
  for (const player of state.players) {
    player.tavernTier = 6;
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.frozen = false;
  }
}

function createGameWithTribe(
  tribe: GameState["activeTribes"][number],
  startingSeed: number,
): GameState {
  for (let seed = startingSeed; seed < startingSeed + 10_000; seed += 1) {
    const state = createGame(seed);
    if (state.activeTribes.includes(tribe)) {
      return state;
    }
  }
  throw new Error(`Could not create a lobby containing ${tribe}`);
}

function replaceHumanShopWithCopies(
  state: GameState,
  definitionId: string,
  count: number,
): void {
  const human = humanPlayer(state);
  const template = human.shop[0];
  assert.ok(template);
  for (const offer of human.shop) {
    state.pool[offer.definitionId] += offer.poolCopies;
  }
  assert.ok(state.pool[definitionId] >= count);
  state.pool[definitionId] -= count;
  human.shop = Array.from({ length: count }, (_, index) =>
    definitionMinion(
      template,
      definitionId,
      `controlled-offer-${definitionId}-${index}`,
      { poolCopies: 1 },
    ),
  );
}

function totalPoolCopies(
  state: GameState,
  definitionId: string,
): number {
  let total = state.pool[definitionId] ?? 0;
  for (const player of state.players) {
    for (const card of [...player.board, ...player.hand, ...player.shop]) {
      if (
        card.kind === "minion" &&
        card.definitionId === definitionId
      ) {
        total += card.poolCopies;
      }
    }
  }
  if (state.pendingInteraction?.kind === "discover") {
    for (const option of state.pendingInteraction.options) {
      if (option.definitionId === definitionId) {
        total += option.poolCopies;
      }
    }
  }
  return total;
}

function tripleRewardFixture(
  instanceId: string,
  tier: TripleRewardSpellInstance["tier"] = 2,
): TripleRewardSpellInstance {
  return {
    kind: "tripleReward",
    instanceId,
    definitionId: "triple-reward",
    cardId: "TB_BaconShop_Triples_01",
    name: "三连奖励",
    tier,
    tribe: "neutral",
    tribes: [],
    associatedTribes: [],
    effectSupport: "complete",
    sellValue: 0,
    attack: 0,
    health: 0,
    golden: false,
    taunt: false,
    divineShield: false,
    reborn: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    cleave: false,
    alwaysAttacksLowestAttack: false,
    description: "发现一个比你当前酒馆等级高一级的随从。",
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
  };
}

test("createGame builds one human and seven deterministic AI opponents", () => {
  const first = createGame(0x1234abcd);
  const replay = createGame(0x1234abcd);

  assert.deepEqual(replay, first);
  assert.equal(first.phase, "recruit");
  assert.equal(first.round, 1);
  assert.equal(first.contentVersion, CLASSIC_ROSTER_VERSION);
  assert.equal(first.players.length, 8);
  assert.equal(first.players.filter((player) => player.isHuman).length, 1);
  assert.equal(first.players.filter((player) => !player.isHuman).length, 7);
  assert.equal(first.humanPlayerId, "player-0");
  assert.equal(first.activeTribes.length, 5);
  assert.equal(new Set(first.activeTribes).size, 5);
  assert.ok(
    first.activeTribes.every(
      (tribe) => tribe !== "neutral" && tribe !== "all",
    ),
  );

  for (const player of first.players) {
    assert.equal(player.health, 40);
    assert.equal(player.gold, 3);
    assert.equal(player.tavernTier, 1);
    assert.equal(player.shop.length, 3);
    assert.equal(player.hand.length, 0);
    assert.equal(player.board.length, 0);
    assert.equal(player.alive, true);
  }

  const offeredIds = first.players.flatMap((player) =>
    player.shop.map((minion) => minion.instanceId),
  );
  assert.equal(new Set(offeredIds).size, offeredIds.length);
  const liveIds = new Set(
    LIVE_MINION_DEFINITIONS.map((definition) => definition.id),
  );
  for (const offered of first.players.flatMap((player) => player.shop)) {
    assert.ok(liveIds.has(offered.definitionId));
    assert.ok(
      offered.tribes.includes("all") ||
        (offered.tribes.length === 0 &&
          offered.associatedTribes.length === 0) ||
        [...offered.tribes, ...offered.associatedTribes].some((tribe) =>
          first.activeTribes.includes(tribe),
        ),
      `${offered.name} must belong to an enabled lobby type`,
    );
  }
  assert.notDeepEqual(createGame(0x1234abce), first);
});

test("the shared pool uses live copy counts and excludes inactive types", () => {
  const state = createGame(0x600d);
  const reservedByDefinition = new Map<string, number>();
  for (const minion of state.players.flatMap((player) => player.shop)) {
    reservedByDefinition.set(
      minion.definitionId,
      (reservedByDefinition.get(minion.definitionId) ?? 0) + 1,
    );
  }
  const expectedCopies = [0, 15, 15, 13, 11, 9, 7];

  for (const definition of LIVE_MINION_DEFINITIONS) {
    const printed = definition.tribes ?? [];
    const associated = definition.associatedTribes ?? [];
    const enabled =
      printed.includes("all") ||
      (printed.length === 0 && associated.length === 0) ||
      [...printed, ...associated].some((tribe) =>
        state.activeTribes.includes(tribe),
      );
    const available =
      (state.pool[definition.id] ?? 0) +
      (reservedByDefinition.get(definition.id) ?? 0);
    assert.equal(
      available,
      enabled ? expectedCopies[definition.tier] : 0,
      `${definition.name} has the wrong shared-pool copy count`,
    );
  }
});

test("current Tavern economy constants cover every Tier", () => {
  const shopSizes = [0, 3, 4, 4, 5, 5, 6] as const;
  const upgradeCosts = [0, 5, 7, 8, 11, 12, 0] as const;

  for (let tier = 1; tier <= 6; tier += 1) {
    let state = createGame(0x6100 + tier);
    const human = humanPlayer(state);
    human.tavernTier = tier as PlayerState["tavernTier"];
    human.gold = 1;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    assert.equal(
      humanPlayer(state).shop.length,
      shopSizes[tier],
      `Tier ${tier} has the wrong minion-offer count`,
    );

    const costState = createGame(0x6200 + tier);
    const costPlayer = humanPlayer(costState);
    costPlayer.tavernTier = tier as PlayerState["tavernTier"];
    costPlayer.upgradeDiscount = 0;
    assert.equal(
      getUpgradeCost(costState, costPlayer.id),
      upgradeCosts[tier],
      `Tier ${tier} has the wrong base upgrade cost`,
    );
    if (tier < 6) {
      costPlayer.upgradeDiscount = 2;
      assert.equal(
        getUpgradeCost(costState, costPlayer.id),
        Math.max(0, upgradeCosts[tier] - 2),
      );
    }
  }
});

test("classic rule fixtures remain available but never enter the live pool", () => {
  assert.equal(LEGACY_RULE_DEFINITIONS.length, 36);
  assert.ok(
    LEGACY_RULE_DEFINITIONS.every(
      (definition) => definition.collectible === false,
    ),
  );
  assert.equal(
    new Set(LEGACY_RULE_DEFINITIONS.map((definition) => definition.id)).size,
    36,
  );
  assert.equal(
    new Set(
      LEGACY_RULE_DEFINITIONS.map((definition) => definition.cardId),
    ).size,
    36,
  );
  for (let tier = 1; tier <= 6; tier += 1) {
    assert.equal(
      LEGACY_RULE_DEFINITIONS.filter(
        (definition) => definition.tier === tier,
      ).length,
      6,
    );
  }
  assert.deepEqual(
    LEGACY_RULE_DEFINITIONS.slice(0, 6).map(
      (definition) => definition.name,
    ),
    [
      "雄斑虎",
      "鱼人猎潮者",
      "龙人军官",
      "粗俗的矮劣魔",
      "愤怒编织者",
      "海盗无赖",
    ],
  );
  assert.ok(
    LEGACY_RULE_DEFINITIONS.every((definition) =>
      /^[A-Za-z0-9_]+$/u.test(definition.cardId),
    ),
  );
  assert.deepEqual(
    TOKEN_DEFINITIONS.map(({ id, cardId }) => [id, cardId]),
    [
      ["tabbycat-token", "BG_CFM_315t"],
      ["murloc-scout-token", "EX1_506a"],
      ["sky-pirate-token", "BGS_061t"],
      ["damaged-golem-token", "BG_EX1_556t"],
      ["rat-token", "BG_CFM_316t"],
      ["guard-bot-token", "BOT_218t"],
      ["robosaur-token", "BOT_537t"],
      ["hyena-token", "BG_EX1_534t"],
      ["voidwalker-token", "BG_CS2_065"],
    ],
  );
  assert.equal(
    new Set(MINION_DEFINITIONS.map((definition) => definition.id)).size,
    MINION_DEFINITIONS.length,
  );
  assert.equal(createGame(1).version, 6);
});

test("Wrath Weaver, Brann, and Mama Bear use their signature recruit triggers", () => {
  let state = createGame(0x811);
  let human = humanPlayer(state);
  const template = human.shop[0];
  human.board = [
    definitionMinion(template, "BGS_004", "wrath-fixture"),
  ];
  human.hand = [
    definitionMinion(template, "vulgar-homunculus", "demon-fixture"),
  ];
  human.health = 40;

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const wrath = human.board.find(
    (minion) => minion.instanceId === "wrath-fixture",
  );
  assert.equal(human.health, 37, "Homunculus deals 2 and Weaver deals 1");
  assert.equal(wrath?.attack, 3);
  assert.equal(wrath?.health, 5);

  state = createGame(0x8111);
  human = humanPlayer(state);
  human.board = [
    definitionMinion(template, "BGS_004", "golden-wrath-fixture", {
      attack: 2,
      health: 6,
      golden: true,
    }),
  ];
  human.hand = [
    definitionMinion(template, "BGS_004", "played-demon-fixture"),
  ];
  human.health = 40;
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const goldenWrath = humanPlayer(state).board.find(
    (minion) => minion.instanceId === "golden-wrath-fixture",
  );
  assert.equal(humanPlayer(state).health, 38);
  assert.equal(goldenWrath?.attack, 6);
  assert.equal(goldenWrath?.health, 10);

  state = createGame(0x812);
  human = humanPlayer(state);
  human.board = [
    definitionMinion(template, "BG_LOE_077", "brann-fixture"),
    definitionMinion(template, "vulgar-homunculus", "brann-demon-fixture"),
  ];
  human.hand = [
    definitionMinion(template, "nathrezim-overseer", "overseer-fixture"),
  ];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const brannBuffedDemon = humanPlayer(state).board.find(
    (minion) => minion.instanceId === "brann-demon-fixture",
  );
  assert.equal(brannBuffedDemon?.attack, 6);
  assert.equal(brannBuffedDemon?.health, 8);

  state = createGame(0x813);
  human = humanPlayer(state);
  human.board = [
    definitionMinion(template, "mama-bear", "mama-fixture"),
  ];
  human.hand = [definitionMinion(template, "alleycat", "alleycat-fixture")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const beasts = humanPlayer(state).board.filter(
    (minion) => minion.tribe === "beast" && minion.definitionId !== "mama-bear",
  );
  assert.equal(beasts.length, 2);
  assert.ok(beasts.every((minion) => minion.attack >= 7 && minion.health >= 7));
});

test("a golden Alleycat summons one golden Tabbycat instead of two normal tokens", () => {
  let state = createGame(0x814);
  const human = humanPlayer(state);
  const template = human.shop[0];
  human.board = [];
  human.hand = [
    definitionMinion(template, "alleycat", "golden-alleycat", {
      golden: true,
      name: "金色·雄斑虎",
      attack: 2,
      health: 2,
    }),
  ];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const tabbies = humanPlayer(state).board.filter(
    (minion) => minion.definitionId === "tabbycat-token",
  );
  assert.equal(tabbies.length, 1);
  assert.equal(tabbies[0].golden, true);
  assert.equal(tabbies[0].attack, 2);
  assert.equal(tabbies[0].health, 2);
  assert.ok(
    tabbies[0].description.startsWith(
      "金色随从：基础属性已翻倍；可倍增的效果会按金色规则结算。",
    ),
  );
});

test("combat playback replaces a Reborn entity before applying its later buff snapshot", () => {
  const state = createGame(0x8141);
  const template = humanPlayer(state).shop[0];
  const original = definitionMinion(
    template,
    "bronze-warden",
    "playback-reborn-original",
    { divineShield: false },
  );
  const reborn = {
    ...original,
    instanceId: "playback-reborn-new",
    health: 1,
    reborn: false,
  };
  const buffed = {
    ...reborn,
    attack: reborn.attack + 2,
    health: reborn.health + 2,
  };
  const playerId = state.humanPlayerId;
  const events: BattleEvent[] = [
    {
      index: 0,
      type: "death",
      actorPlayerId: playerId,
      actorInstanceId: original.instanceId,
      message: "青铜守卫被消灭。",
    },
    {
      index: 1,
      type: "summon",
      actorPlayerId: playerId,
      actorInstanceId: original.instanceId,
      targetPlayerId: playerId,
      targetInstanceId: reborn.instanceId,
      boardIndex: 0,
      minion: reborn,
      summonReason: "reborn",
      message: "青铜守卫复生了。",
    },
    {
      index: 2,
      type: "buff",
      actorPlayerId: playerId,
      actorInstanceId: "sleepy-supporter",
      targetPlayerId: playerId,
      targetInstanceId: reborn.instanceId,
      attackDelta: 2,
      healthDelta: 2,
      minion: buffed,
      message: "贪睡的援护巨龙使青铜守卫获得+2/+2。",
    },
  ];

  const [projected] = projectCombatBoard(
    [original],
    playerId,
    events,
  );
  assert.equal(projected.instanceId, reborn.instanceId);
  assert.equal(projected.attack, buffed.attack);
  assert.equal(projected.health, buffed.health);
  assert.equal(
    projectCombatBoard([original], "another-player", events)[0]
      .instanceId,
    original.instanceId,
  );
});

test("combat playback inserts a normal summon before projecting a buff onto it", () => {
  const state = createGame(0x8142);
  const template = humanPlayer(state).shop[0];
  const supporter = definitionMinion(
    template,
    "BG33_241",
    "playback-summon-supporter",
  );
  const dyingNeighbor = fixtureMinion(
    template,
    "playback-summon-dying-neighbor",
  );
  const fallbackNeighbor = fixtureMinion(
    template,
    "playback-summon-fallback-neighbor",
  );
  const summoned = {
    ...dyingNeighbor,
    instanceId: "playback-summoned-neighbor",
    attack: 2,
    health: 2,
  };
  const buffed = {
    ...summoned,
    attack: 4,
    health: 4,
  };
  const playerId = state.humanPlayerId;
  const events: BattleEvent[] = [
    {
      index: 0,
      type: "death",
      actorPlayerId: playerId,
      actorInstanceId: dyingNeighbor.instanceId,
      message: "右邻被消灭。",
    },
    {
      index: 1,
      type: "summon",
      actorPlayerId: playerId,
      actorInstanceId: dyingNeighbor.instanceId,
      targetPlayerId: playerId,
      targetInstanceId: summoned.instanceId,
      boardIndex: 1,
      minion: summoned,
      message: "召唤了新的右邻。",
    },
    {
      index: 2,
      type: "buff",
      actorPlayerId: playerId,
      actorInstanceId: supporter.instanceId,
      targetPlayerId: playerId,
      targetInstanceId: summoned.instanceId,
      attackDelta: 2,
      healthDelta: 2,
      minion: buffed,
      message: "新的右邻获得+2/+2。",
    },
  ];

  const projected = projectCombatBoard(
    [supporter, dyingNeighbor, fallbackNeighbor],
    playerId,
    events,
  );
  assert.deepEqual(
    projected.map((minion) => minion.instanceId),
    [
      supporter.instanceId,
      summoned.instanceId,
      fallbackNeighbor.instanceId,
    ],
  );
  assert.equal(projected[1].attack, 4);
  assert.equal(projected[1].health, 4);
});

test("Zapp attacks the lowest-attack minion twice before combat passes", () => {
  const state = createGame(0x815);
  const template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);

  for (const player of state.players) {
    if (player.isHuman) {
      player.board = [
        definitionMinion(template, "zapp-slywick", "zapp-fixture"),
        definitionMinion(template, "spawn-of-nzoth", "zapp-filler-1", {
          attack: 0,
          health: 100,
        }),
        definitionMinion(template, "spawn-of-nzoth", "zapp-filler-2", {
          attack: 0,
          health: 100,
        }),
      ];
    } else {
      player.board = [
        definitionMinion(template, "spawn-of-nzoth", `low-${player.id}`, {
          name: "低攻随从",
          attack: 1,
          health: 100,
        }),
        definitionMinion(template, "voidlord", `taunt-${player.id}`, {
          name: "高攻嘲讽随从",
          attack: 9,
          health: 100,
          taunt: true,
        }),
      ];
    }
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.ok(combat.lastBattle);
  const firstAttacks = combat.lastBattle.events
    .filter((event) => event.type === "attack")
    .slice(0, 2);
  assert.equal(firstAttacks.length, 2);
  assert.ok(
    firstAttacks.every(
      (event) =>
        event.actorInstanceId === "zapp-fixture" &&
        event.message.includes("低攻随从"),
    ),
  );
  assert.ok(firstAttacks[1].message.includes("风怒"));
});

test("Venomous is consumed after the first minion it damages", () => {
  const state = createGame(0x8150);
  const template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);

  for (const player of state.players) {
    if (player.isHuman) {
      player.board = [
        definitionMinion(template, "BGS_131", "venomous-attacker", {
          attack: 1,
          health: 100,
          windfury: true,
          venomous: true,
        }),
        fixtureMinion(template, "venomous-friendly-filler-1", {
          attack: 0,
          health: 1,
        }),
        fixtureMinion(template, "venomous-friendly-filler-2", {
          attack: 0,
          health: 1,
        }),
      ];
    } else {
      player.board = [
        fixtureMinion(template, `venomous-taunt-${player.id}`, {
          name: "烈毒首个目标",
          attack: 0,
          health: 50,
          taunt: true,
        }),
        fixtureMinion(template, `venomous-survivor-${player.id}`, {
          name: "烈毒后续目标",
          attack: 100,
          health: 50,
        }),
      ];
    }
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const opponentId =
    battle.playerAId === state.humanPlayerId
      ? battle.playerBId
      : battle.playerAId;
  assert.equal(battle.finalBoards[opponentId].length, 1);
  assert.equal(battle.finalBoards[opponentId][0].name, "烈毒后续目标");
  assert.equal(battle.finalBoards[opponentId][0].health, 49);
});

test("Bronze Warden reborns and Titus repeats Kaboom Bot's deathrattle", () => {
  let state = createGame(0x816);
  let template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);
  for (const player of state.players) {
    if (player.isHuman) {
      player.board = [
        definitionMinion(template, "bronze-warden", "bronze-fixture", {
          taunt: true,
        }),
        definitionMinion(template, "spawn-of-nzoth", "bronze-filler-1", {
          attack: 0,
          health: 100,
        }),
        definitionMinion(template, "spawn-of-nzoth", "bronze-filler-2", {
          attack: 0,
          health: 100,
        }),
      ];
    } else {
      player.board = [
        definitionMinion(template, "voidlord", `crusher-${player.id}`, {
          name: "复生测试对手",
          attack: 10,
          health: 100,
          taunt: true,
        }),
      ];
    }
  }
  let combat = gameReducer(state, { type: "END_TURN" });
  assert.ok(
    combat.lastBattle?.events.some((event) =>
      event.message.includes("青铜守卫复生了"),
    ),
  );

  state = createGame(0x817);
  template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);
  for (const player of state.players) {
    if (player.isHuman) {
      player.board = [
        definitionMinion(template, "kaboom-bot", "kaboom-fixture"),
        definitionMinion(template, "titus-rivendare", "titus-fixture"),
        definitionMinion(template, "spawn-of-nzoth", "kaboom-filler", {
          attack: 0,
          health: 100,
        }),
      ];
    } else {
      player.board = [
        definitionMinion(template, "voidlord", `bomb-target-${player.id}`, {
          name: "炸弹测试目标",
          attack: 2,
          health: 8,
          taunt: true,
          divineShield: true,
        }),
      ];
    }
  }
  combat = gameReducer(state, { type: "END_TURN" });
  assert.ok(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "death" && event.message.includes("炸弹测试目标"),
    ),
  );
});

test("buy, play, and sell update economy and ownership without mutating input", () => {
  const initial = createGame(101);
  const initialSnapshot = jsonClone(initial);
  const offered = humanPlayer(initial).shop[0];
  const poolBeforeSell = initial.pool[offered.definitionId];

  let state = gameReducer(initial, { type: "BUY_MINION", shopIndex: 0 });
  assert.deepEqual(initial, initialSnapshot, "the reducer must be immutable");
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).shop.length, 2);
  assert.equal(humanPlayer(state).hand.length, 1);
  assert.equal(humanPlayer(state).hand[0].instanceId, offered.instanceId);

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(humanPlayer(state).hand.length, 0);
  assert.ok(humanPlayer(state).board.length >= 1);
  assert.equal(
    humanPlayer(state).board.filter(
      (minion) => minion.instanceId === offered.instanceId,
    ).length,
    1,
  );

  const offeredBoardIndex = humanPlayer(state).board.findIndex(
    (minion) => minion.instanceId === offered.instanceId,
  );
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: offeredBoardIndex,
  });
  assert.equal(humanPlayer(state).gold, 1);
  assert.equal(
    humanPlayer(state).board.some(
      (minion) => minion.instanceId === offered.instanceId,
    ),
    false,
  );
  assert.equal(state.pool[offered.definitionId], poolBeforeSell + 1);
});

test("current live Battlecries and special sell prices resolve", () => {
  let state = createGame(0x9101);
  let human = humanPlayer(state);
  const template = human.shop[0];
  human.board = [
    definitionMinion(template, "BG34_630", "dragon-buff-target"),
  ];
  human.hand = [
    definitionMinion(template, "BG34_636t", "green-chromadrake"),
  ];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const buffedDragon = human.board.find(
    (minion) => minion.instanceId === "dragon-buff-target",
  );
  const chromadrake = human.board.find(
    (minion) => minion.instanceId === "green-chromadrake",
  );
  assert.equal(buffedDragon?.attack, 2);
  assert.equal(buffedDragon?.health, 4);
  assert.equal(chromadrake?.attack, 3);
  assert.equal(chromadrake?.health, 5);

  human.board = [
    definitionMinion(template, "BGS_049", "gambler-fixture"),
  ];
  human.gold = 0;
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.equal(humanPlayer(state).gold, 3);

  human = humanPlayer(state);
  human.gold = 9;
  human.board = [];
  human.hand = [];
  human.shop = Array.from({ length: 3 }, (_, index) =>
    definitionMinion(
      template,
      "BGS_049",
      `golden-gambler-copy-${index}`,
      { poolCopies: 1 },
    ),
  );
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  const goldenGambler = humanPlayer(state).hand[0];
  assert.ok(goldenGambler?.kind === "minion");
  assert.equal(goldenGambler.golden, true);
  assert.equal(goldenGambler.sellValue, 6);

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.equal(humanPlayer(state).gold, 6);
});

test("current live end-of-turn and start-of-combat effects resolve", () => {
  const state = createGame(0x9102);
  const template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);

  for (const player of state.players) {
    if (player.isHuman) {
      player.board = [
        definitionMinion(template, "BG34_630", "left-dragon"),
        definitionMinion(template, "BG32_235", "surfin-sylvan"),
        definitionMinion(template, "BG21_014", "enhanced-whelp"),
      ];
    } else {
      player.board = [
        fixtureMinion(template, `start-effect-target-${player.id}`, {
          attack: 0,
          health: 100,
        }),
      ];
    }
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  const permanentBoard = humanPlayer(combat).board;
  assert.equal(permanentBoard[0].attack, 2);
  assert.equal(permanentBoard[0].health, 1);
  assert.equal(permanentBoard[2].attack, 2);
  assert.equal(permanentBoard[2].health, 1);

  const battle = combat.lastBattle;
  assert.ok(battle);
  const initialHumanBoard = battle.initialBoards[state.humanPlayerId];
  const dragonAfterStart = initialHumanBoard.find(
    (minion) => minion.instanceId === "left-dragon",
  );
  const whelpAfterStart = initialHumanBoard.find(
    (minion) => minion.instanceId === "enhanced-whelp",
  );
  assert.equal(dragonAfterStart?.attack, 6);
  assert.equal(dragonAfterStart?.health, 5);
  assert.equal(whelpAfterStart?.attack, 6);
  assert.equal(whelpAfterStart?.health, 5);
});

test("current live Deathrattles summon real tokens", () => {
  const state = createGame(0x9103);
  const template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);

  for (const player of state.players) {
    player.board = player.isHuman
      ? [
          definitionMinion(template, "BG28_300", "bonehead-fixture", {
            taunt: true,
          }),
        ]
      : [
          fixtureMinion(template, `bonehead-killer-${player.id}`, {
            attack: 100,
            health: 100,
          }),
        ];
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  const skeletonSummons =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-skeleton-token",
    ) ?? [];
  assert.equal(skeletonSummons.length, 2);
  assert.ok(
    skeletonSummons.every(
      (event) =>
        event.minion?.name === "骷髅" &&
        event.minion.attack === 1 &&
        event.minion.health === 1,
    ),
  );
});

test("Golden live summon Deathrattles follow their printed token rules", () => {
  const doubledCountState = createGame(0x9104);
  const doubledTemplate = humanPlayer(doubledCountState).shop[0];
  prepareLockedCombat(doubledCountState);
  for (const player of doubledCountState.players) {
    player.board = player.isHuman
      ? [
          definitionMinion(
            doubledTemplate,
            "BG28_300",
            "golden-bonehead",
            {
              attack: 2,
              health: 1,
              golden: true,
              taunt: true,
            },
          ),
        ]
      : [
          fixtureMinion(
            doubledTemplate,
            `golden-token-killer-${player.id}`,
            { attack: 100, health: 100 },
          ),
        ];
  }

  const doubledCountCombat = gameReducer(doubledCountState, {
    type: "END_TURN",
  });
  const skeletonSummons =
    doubledCountCombat.lastBattle?.events.filter(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-skeleton-token",
    ) ?? [];
  assert.equal(skeletonSummons.length, 4);
  assert.ok(
    skeletonSummons.every(
      (event) =>
        event.minion?.golden === false &&
        event.minion.attack === 1 &&
        event.minion.health === 1,
    ),
  );

  const goldenTokenState = createGame(0x9105);
  const goldenTemplate = humanPlayer(goldenTokenState).shop[0];
  prepareLockedCombat(goldenTokenState);
  for (const player of goldenTokenState.players) {
    player.board = player.isHuman
      ? [
          definitionMinion(
            goldenTemplate,
            "BG29_611",
            "golden-cord-puller",
            {
              attack: 2,
              health: 1,
              golden: true,
              divineShield: false,
              taunt: true,
            },
          ),
        ]
      : [
          fixtureMinion(
            goldenTemplate,
            `golden-cord-puller-killer-${player.id}`,
            { attack: 100, health: 100 },
          ),
        ];
  }

  const goldenTokenCombat = gameReducer(goldenTokenState, {
    type: "END_TURN",
  });
  const microbotSummons =
    goldenTokenCombat.lastBattle?.events.filter(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-microbot-token",
    ) ?? [];
  assert.equal(microbotSummons.length, 1);
  assert.equal(microbotSummons[0]?.minion?.golden, true);
  assert.equal(microbotSummons[0]?.minion?.attack, 2);
  assert.equal(microbotSummons[0]?.minion?.health, 2);

  const immediateAttackState = createGame(0x91051);
  const immediateTemplate = humanPlayer(immediateAttackState).shop[0];
  prepareLockedCombat(immediateAttackState);
  for (const player of immediateAttackState.players) {
    player.board = player.isHuman
      ? [
          definitionMinion(
            immediateTemplate,
            "BG34_630",
            "golden-twilight-whelp",
            {
              attack: 2,
              health: 1,
              golden: true,
              taunt: true,
            },
          ),
          ...Array.from({ length: 6 }, (_, index) =>
            fixtureMinion(
              immediateTemplate,
              `twilight-board-filler-${index}`,
              { attack: 0, health: 100 },
            ),
          ),
        ]
      : [
          fixtureMinion(
            immediateTemplate,
            `twilight-whelp-killer-${player.id}`,
            { attack: 100, health: 100 },
          ),
        ];
  }

  const immediateAttackCombat = gameReducer(immediateAttackState, {
    type: "END_TURN",
  });
  const whelpSummons =
    immediateAttackCombat.lastBattle?.events.filter(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-twilight-whelp-token",
    ) ?? [];
  assert.equal(
    whelpSummons.length,
    2,
    "the first dead attacker must free its board slot for the second summon",
  );
});

test("Golden repeated damage keeps separate hits for Divine Shield", () => {
  const state = createGame(0x9106);
  const template = humanPlayer(state).shop[0];
  prepareLockedCombat(state);
  for (const player of state.players) {
    player.board = player.isHuman
      ? [
          definitionMinion(
            template,
            "BG_DAL_775",
            "golden-tunnel-blaster",
            {
              attack: 6,
              health: 1,
              golden: true,
              taunt: true,
            },
          ),
        ]
      : [
          definitionMinion(
            template,
            "tabbycat-token",
            `blaster-killer-${player.id}`,
            {
              attack: 100,
              health: 100,
            },
          ),
          definitionMinion(
            template,
            "tabbycat-token",
            `blaster-shield-${player.id}`,
            {
              attack: 0,
              health: 20,
              divineShield: true,
            },
          ),
        ];
  }

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const opponentId =
    battle.playerAId === state.humanPlayerId
      ? battle.playerBId
      : battle.playerAId;
  const shieldTarget = battle.finalBoards[opponentId].find((minion) =>
    minion.instanceId.startsWith("blaster-shield-"),
  );
  assert.ok(shieldTarget);
  assert.equal(shieldTarget.divineShield, false);
  assert.equal(shieldTarget.health, 17);
});

test("refresh replaces offers, while freeze preserves them through manual combat", () => {
  let state = createGame(202);
  humanPlayer(state).gold = 5;
  const originalOfferIds = humanPlayer(state).shop.map(
    (minion) => minion.instanceId,
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const refreshed = humanPlayer(state);
  assert.equal(refreshed.gold, 4);
  assert.equal(refreshed.shop.length, 3);
  assert.equal(refreshed.frozen, false);
  assert.ok(
    refreshed.shop.every(
      (minion) => !originalOfferIds.includes(minion.instanceId),
    ),
  );

  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  const frozenOfferIds = humanPlayer(state).shop.map(
    (minion) => minion.instanceId,
  );
  assert.equal(humanPlayer(state).frozen, true);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  assert.equal(state.round, 1);

  const ignoredDuringCombat = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.strictEqual(
    ignoredDuringCombat,
    state,
    "recruit actions must be blocked until combat is continued",
  );

  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  assert.equal(state.round, 2);
  assert.equal(humanPlayer(state).gold, 4);
  assert.equal(humanPlayer(state).frozen, false);
  assert.deepEqual(
    humanPlayer(state).shop.map((minion) => minion.instanceId),
    frozenOfferIds,
  );
});

test("tavern upgrades enforce cost and expand the next Recruit shop", () => {
  let state = createGame(303);
  assert.equal(getUpgradeCost(state, state.humanPlayerId), 5);

  humanPlayer(state).gold = 4;
  const insufficientSnapshot = jsonClone(state);
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.deepEqual(state, insufficientSnapshot);

  humanPlayer(state).gold = 5;
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.equal(humanPlayer(state).tavernTier, 2);
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).shop.length, 3);
  assert.equal(getUpgradeCost(state, state.humanPlayerId), 7);

  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(humanPlayer(state).shop.length, 4);
});

test("three normal copies combine atomically into one buff-preserving golden", () => {
  let state = createGame(404);
  const human = humanPlayer(state);
  const template = human.shop[0];
  const bonusAttack = [1, 2, 0];
  const bonusHealth = [0, 1, 3];

  human.gold = 9;
  human.board = [];
  human.hand = [];
  human.shop = bonusAttack.map((attackBonus, index) => ({
    ...template,
    instanceId: `triple-fixture-${index}`,
    attack: template.attack + attackBonus,
    health: template.health + bonusHealth[index],
    poolCopies: 1,
  }));
  state.nextInstanceId = 10_000;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });

  const golden = humanPlayer(state).hand[0];
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).shop.length, 0);
  assert.equal(humanPlayer(state).hand.length, 1);
  assert.ok(golden?.kind === "minion");
  assert.equal(golden.definitionId, template.definitionId);
  assert.equal(golden.golden, true);
  assert.equal(golden.poolCopies, 3);
  assert.equal(
    golden.attack,
    template.attack * 2 + bonusAttack.reduce((sum, value) => sum + value, 0),
  );
  assert.equal(
    golden.health,
    template.health * 2 + bonusHealth.reduce((sum, value) => sum + value, 0),
  );

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  const poolBeforeSellingGolden = state.pool[golden.definitionId];
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.equal(state.pool[golden.definitionId], poolBeforeSellingGolden + 3);
});

test("a played triple grants the real reward spell and reserves a deterministic discover", () => {
  let state = createGame(0xa101);
  const definitionId = humanPlayer(state).shop[0].definitionId;
  replaceHumanShopWithCopies(state, definitionId, 3);
  humanPlayer(state).gold = 9;
  const conservedBefore = Object.fromEntries(
    LIVE_MINION_DEFINITIONS.map((definition) => [
      definition.id,
      totalPoolCopies(state, definition.id),
    ]),
  );

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  const golden = humanPlayer(state).hand[0];
  assert.equal(golden?.kind, "minion");
  assert.equal(golden?.golden, true);
  assert.equal(golden?.grantsTripleReward, true);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: golden.instanceId,
  });
  const reward = humanPlayer(state).hand.find(
    (card) => card.kind === "tripleReward",
  );
  assert.ok(reward);
  assert.equal(reward.cardId, "TB_BaconShop_Triples_01");
  assert.equal(reward.tier, 2);
  assert.equal(humanPlayer(state).board[0].grantsTripleReward, false);

  // A Triple Reward carries the tier it was created for. Upgrading before
  // casting it must not silently change the already visible reward.
  humanPlayer(state).tavernTier = 2;
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: reward.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.equal(pending?.kind, "discover");
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.exactTier, 2);
  assert.equal(pending.options.length, 3);
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    3,
  );
  assert.ok(pending.options.every((option) => option.tier === 2));

  for (const definition of LIVE_MINION_DEFINITIONS) {
    assert.equal(
      totalPoolCopies(state, definition.id),
      conservedBefore[definition.id],
      `${definition.id} must remain conserved while options are reserved`,
    );
  }

  const frozenSnapshot = JSON.stringify(state);
  const stale = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "interaction-stale",
    optionInstanceId: pending.options[0].instanceId,
  });
  assert.strictEqual(stale, state);
  assert.equal(JSON.stringify(stale), frozenSnapshot);
  const invalidOption = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "minion-not-an-option",
  });
  assert.strictEqual(invalidOption, state);
  assert.equal(JSON.stringify(invalidOption), frozenSnapshot);

  const restored = JSON.parse(JSON.stringify(state)) as GameState;
  const resolution = {
    type: "RESOLVE_INTERACTION" as const,
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  };
  const resolved = gameReducer(state, resolution);
  const restoredResolved = gameReducer(restored, resolution);
  assert.deepEqual(restoredResolved, resolved);
  assert.equal(resolved.pendingInteraction, null);
  assert.ok(
    humanPlayer(resolved).hand.some(
      (card) =>
        card.kind === "minion" &&
        card.instanceId === resolution.optionInstanceId,
    ),
  );
  for (const definition of LIVE_MINION_DEFINITIONS) {
    assert.equal(
      totalPoolCopies(resolved, definition.id),
      conservedBefore[definition.id],
      `${definition.id} must remain conserved after choosing`,
    );
  }
});

test("Triple Reward discovers exactly Tier 6 when the Tavern is already Tier 6", () => {
  let state = createGame(0xa102);
  const human = humanPlayer(state);
  human.tavernTier = 6;
  human.hand = [tripleRewardFixture("tier-six-reward", 6)];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "tier-six-reward",
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.exactTier, 6);
  assert.equal(pending.options.length, 3);
  assert.ok(pending.options.every((option) => option.tier === 6));
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    3,
  );
});

test("Wandering Sailor uses one stable target and stacks Golden and Brann repetitions", () => {
  let ordinaryState = createGame(0xa103);
  const ordinary = humanPlayer(ordinaryState);
  const ordinaryTemplate = ordinary.shop[0];
  ordinary.board = [
    fixtureMinion(ordinaryTemplate, "ordinary-sailor-target", {
      attack: 1,
      health: 1,
    }),
  ];
  ordinary.hand = [
    definitionMinion(ordinaryTemplate, "BG35_702", "ordinary-sailor"),
  ];
  ordinaryState = gameReducer(ordinaryState, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "ordinary-sailor",
  });
  assert.deepEqual(ordinaryState.pendingInteraction, {
    kind: "target",
    interactionId: "interaction-1",
    playerId: ordinaryState.humanPlayerId,
    sourceInstanceId: "ordinary-sailor",
    optionInstanceIds: ["ordinary-sailor-target"],
    attack: 2,
    health: 2,
    repetitions: 1,
  });

  ordinaryState = gameReducer(ordinaryState, {
    type: "RESOLVE_INTERACTION",
    interactionId: "interaction-1",
    optionInstanceId: "ordinary-sailor-target",
  });
  assert.equal(humanPlayer(ordinaryState).board[0].attack, 3);
  assert.equal(humanPlayer(ordinaryState).board[0].health, 3);

  let stackedState = createGame(0xa104);
  const stacked = humanPlayer(stackedState);
  const stackedTemplate = stacked.shop[0];
  stacked.tavernSpellsCastThisTurn = 1;
  stacked.board = [
    fixtureMinion(stackedTemplate, "stacked-sailor-target", {
      attack: 1,
      health: 1,
    }),
    definitionMinion(stackedTemplate, "BG_LOE_077", "stacked-brann"),
  ];
  stacked.hand = [
    definitionMinion(stackedTemplate, "BG35_702", "golden-sailor", {
      golden: true,
    }),
  ];
  stackedState = gameReducer(stackedState, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "golden-sailor",
  });
  const pending = stackedState.pendingInteraction;
  assert.ok(pending?.kind === "target");
  assert.equal(pending.attack, 4);
  assert.equal(pending.health, 4);
  assert.equal(pending.repetitions, 4);

  const blocked = gameReducer(stackedState, { type: "END_TURN" });
  assert.strictEqual(blocked, stackedState);
  const invalid = gameReducer(stackedState, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "golden-sailor",
  });
  assert.strictEqual(invalid, stackedState);

  stackedState = gameReducer(stackedState, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "stacked-sailor-target",
  });
  const buffed = humanPlayer(stackedState).board.find(
    (minion) => minion.instanceId === "stacked-sailor-target",
  );
  assert.equal(buffed?.attack, 17);
  assert.equal(buffed?.health, 17);
});

test("Predatory Tiger Shark chains discoveries and stops cleanly at the hand limit", () => {
  let state = createGameWithTribe("beast", 0xa105);
  const human = humanPlayer(state);
  const template = human.shop[0];
  human.tavernTier = 6;
  human.board = [
    definitionMinion(template, "BG_LOE_077", "shark-brann"),
  ];
  const fillerDefinitions = LIVE_MINION_DEFINITIONS.filter(
    (definition) =>
      definition.id !== "BG34_523" &&
      !(definition.tribes ?? []).includes("beast") &&
      !(definition.tribes ?? []).includes("all"),
  ).slice(0, 8);
  assert.equal(fillerDefinitions.length, 8);
  human.hand = [
    ...fillerDefinitions.map((definition, index) =>
      definitionMinion(
        template,
        definition.id,
        `shark-hand-filler-${index}`,
      ),
    ),
    definitionMinion(template, "BG34_523", "golden-tiger-shark", {
      golden: true,
    }),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "golden-tiger-shark",
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.tribe, "beast");
  assert.equal(pending.filter.maximumTier, 6);
  assert.equal(pending.remainingDiscoveries, 4);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  assert.equal(humanPlayer(state).hand.length, 9);
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.remainingDiscoveries, 3);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(state.pendingInteraction, null);
});

test("AI deterministically casts Triple Reward and chooses the highest-scoring option", () => {
  const first = createGame(0xa106);
  first.activeTribes = [
    "beast",
    "mech",
    "demon",
    "murloc",
    "dragon",
  ];
  for (const definition of LIVE_MINION_DEFINITIONS) {
    if (definition.tier === 2) {
      first.pool[definition.id] = 0;
    }
  }
  for (const definitionId of ["BG21_015", "BG24_715", "BG27_002"]) {
    first.pool[definitionId] = 1;
  }
  for (const player of first.players) {
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
  }
  const rewardedAi = first.players[1];
  rewardedAi.tavernTier = 1;
  rewardedAi.hand = [tripleRewardFixture("ai-triple-reward")];
  const replay = jsonClone(first);

  const firstCombat = gameReducer(first, { type: "END_TURN" });
  const replayCombat = gameReducer(replay, { type: "END_TURN" });
  assert.deepEqual(replayCombat, firstCombat);
  assert.equal(firstCombat.pendingInteraction, null);
  const resolvedAi = firstCombat.players[1];
  assert.equal(
    resolvedAi.hand.some((card) => card.kind === "tripleReward"),
    false,
  );
  assert.equal(resolvedAi.board[0]?.definitionId, "BG21_015");
});

test("END_TURN runs seven AI turns and one complete deterministic combat round", () => {
  let state = createGame(505);
  state = applyActions(state, [
    { type: "BUY_MINION", shopIndex: 0 },
    { type: "PLAY_MINION", handIndex: 0 },
  ]);
  humanPlayer(state).tavernSpellsCastThisTurn = 3;
  const permanentHumanBoard = jsonClone(humanPlayer(state).board);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.equal(combat.round, 1);
  assert.equal(combat.lastRoundBattles.length, 4);
  assert.ok(combat.lastBattle);
  assert.deepEqual(humanPlayer(combat).board, permanentHumanBoard);

  const participants = combat.lastRoundBattles
    .flatMap((battle) => [battle.playerAId, battle.playerBId])
    .sort();
  assert.deepEqual(
    participants,
    combat.players.map((player) => player.id).sort(),
  );

  for (const battle of combat.lastRoundBattles) {
    assert.equal(battle.isGhost, false);
    assert.equal(battle.events[0]?.type, "battleStart");
    assert.equal(battle.events.at(-1)?.type, "battleEnd");
    assert.deepEqual(
      battle.events.map((event) => event.index),
      battle.events.map((_, index) => index),
    );
    assert.ok(battle.damageToPlayerA >= 0);
    assert.ok(battle.damageToPlayerB >= 0);
    assert.ok(battle.finalBoards[battle.playerAId].length <= 7);
    assert.ok(battle.finalBoards[battle.playerBId].length <= 7);

    const playerA = combat.players.find(
      (player) => player.id === battle.playerAId,
    );
    const playerB = combat.players.find(
      (player) => player.id === battle.playerBId,
    );
    assert.equal(playerA?.health, battle.playerAHealthAfter);
    assert.equal(playerB?.health, battle.playerBHealthAfter);
  }

  const nextRecruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(nextRecruit.phase, "recruit");
  assert.equal(nextRecruit.round, 2);
  assert.equal(nextRecruit.lastBattle, null);
  assert.equal(nextRecruit.lastRoundBattles.length, 0);
  assert.equal(humanPlayer(nextRecruit).tavernSpellsCastThisTurn, 0);
});

test("the same seed and manual action sequence reproduce AI and battle state", () => {
  const actions: readonly GameAction[] = [
    { type: "BUY_MINION", shopIndex: 1 },
    { type: "PLAY_MINION", handIndex: 0 },
    { type: "TOGGLE_FREEZE" },
    { type: "END_TURN" },
    { type: "CONTINUE" },
    { type: "REFRESH_SHOP" },
    { type: "END_TURN" },
  ];

  const first = applyActions(createGame(606), actions);
  const replay = applyActions(createGame(606), actions);

  assert.deepEqual(replay, first);
  assert.equal(JSON.stringify(replay), JSON.stringify(first));
  assert.equal(first.phase, "combat");
  assert.equal(first.round, 2);
});

test("combat damage eliminates players and CONTINUE ends a dead human's game", () => {
  const state = createGame(707);
  const template = humanPlayer(state).shop[0];

  state.players.forEach((player, index) => {
    const power = 100 + index * 10;
    player.health = 1;
    player.tavernTier = 6;
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.board = [
      fixtureMinion(template, `elimination-fixture-${index}`, {
        name: `决胜单位 ${index}`,
        attack: power,
        health: power,
        tier: 1,
      }),
    ];
  });

  const combat = gameReducer(state, { type: "END_TURN" });
  const alive = combat.players.filter((player) => player.alive);
  const eliminated = combat.players.filter((player) => !player.alive);

  assert.equal(combat.lastRoundBattles.length, 4);
  assert.equal(alive.length, 4);
  assert.equal(eliminated.length, 4);
  assert.equal(humanPlayer(combat).alive, false);
  assert.ok(
    eliminated.every(
      (player) => player.health <= 0 && player.eliminatedRound === 1,
    ),
  );
  assert.ok(eliminated.every((player) => player.placement === 5));
  assert.ok(combat.players.every((player) => player.board.length <= 7));

  const gameOver = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(gameOver.phase, "gameOver");
  assert.equal(gameOver.round, 1);
});
