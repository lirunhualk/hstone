import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  scoreMinionForAi,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const BRIGHTSCALE_WARLORD_ID = "BG32_430";
const BRIGHTSCALE_SOLDIER_ID =
  "live-brightsnout-soldier-token";
const THREE_LIL_QUILBOAR_ID = "BG26_867";

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
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
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
    golden: true,
    cardId: definition.goldenCardId ?? definition.cardId,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    ...overrides,
  });
}

function combatWall(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("BG_LOE_077", instanceId, {
    tribe: "neutral",
    tribes: [],
    attack: 1_000,
    health: 1_000,
    taunt: true,
    reborn: false,
    ...overrides,
  });
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

function permanentBoardSnapshot(
  board: readonly BoardMinionInstance[],
): Array<{
  instanceId: string;
  definitionId: string;
  cardId: string;
  attack: number;
  health: number;
  bloodGemAttack: number;
  bloodGemHealth: number;
}> {
  return board.map((minion) => ({
    instanceId: minion.instanceId,
    definitionId: minion.definitionId,
    cardId: minion.cardId,
    attack: minion.attack,
    health: minion.health,
    bloodGemAttack: minion.bloodGemAttack,
    bloodGemHealth: minion.bloodGemHealth,
  }));
}

test("the fixed build maps both Blood Gem Deathrattles and the real Brightscale Soldier art exactly", () => {
  const warlord = getMinionDefinition(BRIGHTSCALE_WARLORD_ID);
  assert.deepEqual(
    {
      name: warlord.name,
      tier: warlord.tier,
      tribes: warlord.tribes,
      attack: warlord.attack,
      health: warlord.health,
      description: warlord.description,
      effectSupport: warlord.effectSupport,
      goldenCardId: warlord.goldenCardId,
      goldenDescription: warlord.goldenDescription,
      deathrattle: warlord.deathrattle,
    },
    {
      name: "亮喉督军",
      tier: 2,
      tribes: ["quilboar"],
      attack: 2,
      health: 2,
      description:
        "亡语：召唤两个1/1并具有嘲讽的野猪人。本随从对其使用一张鲜血宝石。",
      effectSupport: "complete",
      goldenCardId: "BG32_430_G",
      goldenDescription:
        "亡语：召唤两个2/2并具有嘲讽的野猪人。本随从对其使用2张鲜血宝石。",
      deathrattle: [
        {
          kind: "summon",
          definitionId: BRIGHTSCALE_SOLDIER_ID,
          count: 2,
          bloodGemsPerSummon: 1,
          goldenBloodGemsPerSummon: 2,
          goldenMode: "goldenToken",
        },
      ],
    },
  );

  const soldier = getMinionDefinition(BRIGHTSCALE_SOLDIER_ID);
  assert.deepEqual(
    {
      cardId: soldier.cardId,
      goldenCardId: soldier.goldenCardId,
      name: soldier.name,
      tier: soldier.tier,
      tribes: soldier.tribes,
      attack: soldier.attack,
      health: soldier.health,
      taunt: soldier.taunt,
      description: soldier.description,
      goldenDescription: soldier.goldenDescription,
      collectible: soldier.collectible,
    },
    {
      cardId: "BG32_430t",
      goldenCardId: "BG32_430t_G",
      name: "亮喉士兵",
      tier: 1,
      tribes: ["quilboar"],
      attack: 1,
      health: 1,
      taunt: true,
      description: "嘲讽",
      goldenDescription: "嘲讽",
      collectible: false,
    },
  );
  const goldenSoldier = goldenMinion(
    BRIGHTSCALE_SOLDIER_ID,
    "metadata-golden-soldier",
  );
  assert.deepEqual(
    [
      goldenSoldier.cardId,
      goldenSoldier.attack,
      goldenSoldier.health,
      goldenSoldier.taunt,
    ],
    ["BG32_430t_G", 2, 2, true],
  );

  const threeLilQuilboar = getMinionDefinition(
    THREE_LIL_QUILBOAR_ID,
  );
  assert.deepEqual(
    {
      name: threeLilQuilboar.name,
      tier: threeLilQuilboar.tier,
      tribes: threeLilQuilboar.tribes,
      attack: threeLilQuilboar.attack,
      health: threeLilQuilboar.health,
      description: threeLilQuilboar.description,
      effectSupport: threeLilQuilboar.effectSupport,
      goldenCardId: threeLilQuilboar.goldenCardId,
      goldenDescription: threeLilQuilboar.goldenDescription,
      deathrattle: threeLilQuilboar.deathrattle,
    },
    {
      name: "三只小野猪",
      tier: 5,
      tribes: ["quilboar"],
      attack: 3,
      health: 3,
      description:
        "亡语：本随从对你的所有野猪人各使用3张鲜血宝石。",
      effectSupport: "complete",
      goldenCardId: "BG26_867_G",
      goldenDescription:
        "亡语：本随从对你的所有野猪人各使用6张鲜血宝石。",
      deathrattle: [
        {
          kind: "applyBloodGemsToTribe",
          tribe: "quilboar",
          count: 3,
        },
      ],
    },
  );
});

test("Brightscale Warlord summons every token before applying current Blood Gems one pulse at a time", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xd410 + caseIndex);
    const human = humanPlayer(state);
    human.bloodGemAttack = 2;
    human.bloodGemHealth = 3;
    const source = golden
      ? goldenMinion(
          BRIGHTSCALE_WARLORD_ID,
          `brightscale-order-${caseIndex}`,
          { attack: 1, health: 1, taunt: true },
        )
      : definitionMinion(
          BRIGHTSCALE_WARLORD_ID,
          `brightscale-order-${caseIndex}`,
          { attack: 1, health: 1, taunt: true },
        );
    human.board = [source];
    const permanentBefore = permanentBoardSnapshot(human.board);
    keepOnlyOneOpponent(state, [
      combatWall(`brightscale-order-wall-${caseIndex}`),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const events = combat.lastBattle?.events ?? [];
    const summons = events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId &&
        event.minion?.definitionId === BRIGHTSCALE_SOLDIER_ID,
    );
    const tokenIds = new Set(
      summons.map((event) => event.targetInstanceId),
    );
    const buffs = events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === source.instanceId &&
        tokenIds.has(event.targetInstanceId) &&
        event.message.includes("鲜血宝石"),
    );
    const gemsPerToken = golden ? 2 : 1;

    assert.equal(summons.length, 2);
    assert.equal(buffs.length, 2 * gemsPerToken);
    assert.ok(
      Math.max(...summons.map((event) => event.index)) <
        Math.min(...buffs.map((event) => event.index)),
      "both successful summons must animate before the first Blood Gem buff",
    );
    assert.ok(
      summons.every(
        (event) =>
          event.minion?.cardId ===
            (golden ? "BG32_430t_G" : "BG32_430t") &&
          event.minion.golden === golden &&
          event.minion.attack === (golden ? 2 : 1) &&
          event.minion.health === (golden ? 2 : 1) &&
          event.minion.taunt,
      ),
    );
    for (const tokenId of tokenIds) {
      const tokenBuffs = buffs.filter(
        (event) => event.targetInstanceId === tokenId,
      );
      assert.equal(tokenBuffs.length, gemsPerToken);
      assert.ok(
        tokenBuffs.every(
          (event) =>
            event.attackDelta === 2 && event.healthDelta === 3,
        ),
      );
      const finalToken = tokenBuffs[tokenBuffs.length - 1].minion;
      assert.ok(finalToken);
      assert.deepEqual(
        [
          finalToken.attack,
          finalToken.health,
          finalToken.bloodGemAttack,
          finalToken.bloodGemHealth,
        ],
        golden ? [6, 8, 4, 6] : [3, 4, 2, 3],
      );
    }
    assert.deepEqual(
      permanentBoardSnapshot(humanPlayer(combat).board),
      permanentBefore,
    );
    assert.equal(
      humanPlayer(combat).board.some(
        (minion) => minion.definitionId === BRIGHTSCALE_SOLDIER_ID,
      ),
      false,
    );
  }
});

test("Titus repeats the complete ordinary and Golden Brightscale Warlord package", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xd420 + caseIndex);
    const human = humanPlayer(state);
    human.bloodGemAttack = 2;
    human.bloodGemHealth = 3;
    const source = golden
      ? goldenMinion(
          BRIGHTSCALE_WARLORD_ID,
          `brightscale-titus-${caseIndex}`,
          { attack: 1, health: 1, taunt: true },
        )
      : definitionMinion(
          BRIGHTSCALE_WARLORD_ID,
          `brightscale-titus-${caseIndex}`,
          { attack: 1, health: 1, taunt: true },
        );
    const titus = definitionMinion(
      "BG25_354",
      `brightscale-titus-support-${caseIndex}`,
      { attack: 0, health: 100 },
    );
    human.board = [source, titus];
    keepOnlyOneOpponent(state, [
      combatWall(`brightscale-titus-wall-${caseIndex}`),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const events = combat.lastBattle?.events ?? [];
    const summons = events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId &&
        event.minion?.definitionId === BRIGHTSCALE_SOLDIER_ID,
    );
    const tokenIds = new Set(
      summons.map((event) => event.targetInstanceId),
    );
    const buffs = events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === source.instanceId &&
        tokenIds.has(event.targetInstanceId) &&
        event.message.includes("鲜血宝石"),
    );

    assert.equal(summons.length, 4);
    assert.equal(buffs.length, golden ? 8 : 4);
    assert.equal(new Set(tokenIds).size, 4);
    assert.ok(
      summons.every(
        (event) => event.minion?.golden === golden,
      ),
    );
  }
});

test("a full warband lets Brightscale Warlord Gem only the one token that Titus actually summons", () => {
  const state = createGame(0xd430);
  const human = humanPlayer(state);
  human.bloodGemAttack = 2;
  human.bloodGemHealth = 3;
  const source = definitionMinion(
    BRIGHTSCALE_WARLORD_ID,
    "brightscale-full-source",
    { attack: 1, health: 1, taunt: true },
  );
  const titus = definitionMinion(
    "BG25_354",
    "brightscale-full-titus",
    { attack: 0, health: 100 },
  );
  const fillers = Array.from({ length: 5 }, (_, index) =>
    definitionMinion(
      "BG_LOE_077",
      `brightscale-full-filler-${index}`,
      {
        tribe: "neutral",
        tribes: [],
        attack: 0,
        health: 100,
      },
    ),
  );
  human.board = [source, titus, ...fillers];
  keepOnlyOneOpponent(state, [combatWall("brightscale-full-wall")]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = combat.lastBattle?.events ?? [];
  const summons = events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.definitionId === BRIGHTSCALE_SOLDIER_ID,
  );
  const buffs = events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === summons[0]?.targetInstanceId &&
      event.message.includes("鲜血宝石"),
  );

  assert.equal(summons.length, 1);
  assert.equal(buffs.length, 1);
  assert.deepEqual(
    [
      buffs[0]?.minion?.attack,
      buffs[0]?.minion?.health,
      buffs[0]?.minion?.bloodGemAttack,
      buffs[0]?.minion?.bloodGemHealth,
    ],
    [3, 4, 2, 3],
  );
});

test("Three Lil Quilboar applies ordinary, Golden, and Titus Blood Gems separately at their current value", () => {
  const cases = [
    { golden: false, titus: false, applications: 3 },
    { golden: true, titus: false, applications: 6 },
    { golden: false, titus: true, applications: 6 },
    { golden: true, titus: true, applications: 12 },
  ] as const;

  for (const [caseIndex, scenario] of cases.entries()) {
    const state = createGame(0xd440 + caseIndex);
    const human = humanPlayer(state);
    human.bloodGemAttack = 2;
    human.bloodGemHealth = 3;
    const source = scenario.golden
      ? goldenMinion(
          THREE_LIL_QUILBOAR_ID,
          `three-lil-source-${caseIndex}`,
          { attack: 1, health: 1, taunt: true },
        )
      : definitionMinion(
          THREE_LIL_QUILBOAR_ID,
          `three-lil-source-${caseIndex}`,
          { attack: 1, health: 1, taunt: true },
        );
    const target = definitionMinion(
      "BG23_018",
      `three-lil-target-${caseIndex}`,
      { attack: 10, health: 100, reborn: false },
    );
    const titus = scenario.titus
      ? definitionMinion(
          "BG25_354",
          `three-lil-titus-${caseIndex}`,
          { attack: 0, health: 100 },
        )
      : null;
    human.board = [source, target, ...(titus ? [titus] : [])];
    const permanentBefore = permanentBoardSnapshot(human.board);
    keepOnlyOneOpponent(state, [
      combatWall(`three-lil-wall-${caseIndex}`),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const allGemBuffs =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === source.instanceId &&
          event.message.includes("鲜血宝石"),
      ) ?? [];
    const buffs = allGemBuffs.filter(
      (event) => event.targetInstanceId === target.instanceId,
    );

    assert.equal(buffs.length, scenario.applications);
    assert.ok(
      buffs.every(
        (event) =>
          event.attackDelta === 2 && event.healthDelta === 3,
      ),
    );
    const finalTarget = buffs[buffs.length - 1]?.minion;
    assert.ok(finalTarget);
    assert.deepEqual(
      [
        finalTarget.attack,
        finalTarget.health,
        finalTarget.bloodGemAttack,
        finalTarget.bloodGemHealth,
      ],
      [
        target.attack + scenario.applications * 2,
        target.health + scenario.applications * 3,
        scenario.applications * 2,
        scenario.applications * 3,
      ],
    );
    assert.equal(
      allGemBuffs.some(
        (event) => event.targetInstanceId === source.instanceId,
      ),
      false,
      "a minion removed by its real death cannot target itself",
    );
    assert.deepEqual(
      permanentBoardSnapshot(humanPlayer(combat).board),
      permanentBefore,
    );
  }
});

test("each Three Lil Quilboar Gem cast on Roogug redirects as its own current-value pulse", () => {
  const state = createGame(0xd450);
  const human = humanPlayer(state);
  human.bloodGemAttack = 2;
  human.bloodGemHealth = 3;
  const source = definitionMinion(
    THREE_LIL_QUILBOAR_ID,
    "three-lil-roogug-source",
    { attack: 1, health: 1, taunt: true },
  );
  const roogug = definitionMinion(
    "BG28_583",
    "three-lil-roogug",
    { attack: 0, health: 100 },
  );
  const redirectedTarget = definitionMinion(
    "BG_LOE_077",
    "three-lil-roogug-target",
    {
      tribe: "neutral",
      tribes: [],
      attack: 0,
      health: 100,
    },
  );
  human.board = [source, roogug, redirectedTarget];
  const permanentBefore = permanentBoardSnapshot(human.board);
  keepOnlyOneOpponent(state, [combatWall("three-lil-roogug-wall")]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = combat.lastBattle?.events ?? [];
  const direct = events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === roogug.instanceId &&
      event.message.includes("鲜血宝石"),
  );
  const redirected = events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === roogug.instanceId &&
      event.targetInstanceId === redirectedTarget.instanceId &&
      event.message.includes("鲜血宝石"),
  );

  assert.equal(direct.length, 3);
  assert.equal(redirected.length, 3);
  assert.ok(
    [...direct, ...redirected].every(
      (event) => event.attackDelta === 2 && event.healthDelta === 3,
    ),
  );
  assert.deepEqual(
    [
      direct[2]?.minion?.bloodGemAttack,
      direct[2]?.minion?.bloodGemHealth,
      redirected[2]?.minion?.bloodGemAttack,
      redirected[2]?.minion?.bloodGemHealth,
    ],
    [6, 9, 6, 9],
  );
  assert.deepEqual(
    permanentBoardSnapshot(humanPlayer(combat).board),
    permanentBefore,
  );
});

test("an actively triggered Three Lil Quilboar Deathrattle includes its still-living source", () => {
  const state = createGame(0xd460);
  const human = humanPlayer(state);
  human.bloodGemAttack = 2;
  human.bloodGemHealth = 3;
  const source = definitionMinion(
    THREE_LIL_QUILBOAR_ID,
    "three-lil-active-source",
    { attack: 0, health: 100, taunt: true },
  );
  const macaw = definitionMinion(
    "BGS_078",
    "three-lil-active-macaw",
    { attack: 1, health: 1 },
  );
  human.board = [source, macaw];
  const permanentBefore = permanentBoardSnapshot(human.board);
  keepOnlyOneOpponent(state, [combatWall("three-lil-active-wall")]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = combat.lastBattle?.events ?? [];
  const rallyTrigger = events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === macaw.instanceId &&
      event.targetInstanceId === source.instanceId &&
      event.message.includes("亡语"),
  );
  const selfBuffs = events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === source.instanceId &&
      event.message.includes("鲜血宝石"),
  );

  assert.ok(rallyTrigger);
  assert.equal(selfBuffs.length, 3);
  assert.ok(rallyTrigger.index < selfBuffs[0].index);
  assert.deepEqual(
    [
      selfBuffs[2]?.minion?.attack,
      selfBuffs[2]?.minion?.health,
      selfBuffs[2]?.minion?.bloodGemAttack,
      selfBuffs[2]?.minion?.bloodGemHealth,
    ],
    [6, 109, 6, 9],
  );
  assert.deepEqual(
    permanentBoardSnapshot(humanPlayer(combat).board),
    permanentBefore,
  );
});

test("ghost Brightscale Warlord and Three Lil Quilboar animate without mutating the eliminated snapshot", () => {
  const state = createGame(0xd470);
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
    player.board = [combatWall(`ghost-gem-opponent-${index}`)];
  }

  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.bloodGemAttack = 2;
  ghost.bloodGemHealth = 3;
  const warlord = definitionMinion(
    BRIGHTSCALE_WARLORD_ID,
    "ghost-brightscale",
    { attack: 0, health: 1, taunt: true },
  );
  const threeLilQuilboar = definitionMinion(
    THREE_LIL_QUILBOAR_ID,
    "ghost-three-lil",
    { attack: 0, health: 1, taunt: true },
  );
  const target = definitionMinion(
    "BG23_018",
    "ghost-three-lil-target",
    { attack: 0, health: 100 },
  );
  ghost.board = [warlord, threeLilQuilboar, target];
  const boardBefore = structuredClone(ghost.board);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === warlord.instanceId &&
        event.minion?.definitionId === BRIGHTSCALE_SOLDIER_ID,
    ),
  );
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === warlord.instanceId &&
        event.message.includes("鲜血宝石"),
    ),
  );
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === threeLilQuilboar.instanceId &&
        event.message.includes("鲜血宝石"),
    ),
  );
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.deepEqual(
    [nextGhost.bloodGemAttack, nextGhost.bloodGemHealth],
    [2, 3],
  );
});

test("AI valuation understands current Blood Gem values, Quilboar targets, Titus, and Brightscale board space", () => {
  const state = createGame(0xd480);
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  const warlord = definitionMinion(
    BRIGHTSCALE_WARLORD_ID,
    "ai-brightscale-candidate",
  );
  const goldenWarlord = goldenMinion(
    BRIGHTSCALE_WARLORD_ID,
    "ai-golden-brightscale-candidate",
  );
  const threeLilQuilboar = definitionMinion(
    THREE_LIL_QUILBOAR_ID,
    "ai-three-lil-candidate",
  );
  const goldenThreeLilQuilboar = goldenMinion(
    THREE_LIL_QUILBOAR_ID,
    "ai-golden-three-lil-candidate",
  );

  ai.board = [];
  ai.bloodGemAttack = 1;
  ai.bloodGemHealth = 1;
  const lowGemWarlord = scoreMinionForAi(ai, warlord);
  ai.bloodGemAttack = 4;
  ai.bloodGemHealth = 5;
  const openWarlord = scoreMinionForAi(ai, warlord);
  assert.ok(openWarlord > lowGemWarlord);
  assert.ok(scoreMinionForAi(ai, goldenWarlord) > openWarlord);

  ai.board = Array.from({ length: 6 }, (_, index) =>
    definitionMinion(
      "BG_LOE_077",
      `ai-brightscale-crowded-${index}`,
      { tribe: "neutral", tribes: [] },
    ),
  );
  const crowdedWarlord = scoreMinionForAi(ai, warlord);
  assert.ok(openWarlord > crowdedWarlord);

  const quilboars = [
    definitionMinion("BG23_018", "ai-three-lil-target-1"),
    definitionMinion("BG25_039", "ai-three-lil-target-2"),
  ];
  ai.board = quilboars;
  ai.bloodGemAttack = 1;
  ai.bloodGemHealth = 1;
  const lowGemThreeLil = scoreMinionForAi(ai, threeLilQuilboar);
  ai.bloodGemAttack = 4;
  ai.bloodGemHealth = 5;
  const highGemThreeLil = scoreMinionForAi(ai, threeLilQuilboar);
  assert.ok(highGemThreeLil > lowGemThreeLil);
  assert.ok(
    scoreMinionForAi(ai, goldenThreeLilQuilboar) > highGemThreeLil,
  );

  ai.board = [];
  const noTargetThreeLil = scoreMinionForAi(ai, threeLilQuilboar);
  assert.ok(highGemThreeLil > noTargetThreeLil);

  ai.board = [
    ...quilboars,
    definitionMinion("BG25_354", "ai-three-lil-titus"),
  ];
  const titusThreeLil = scoreMinionForAi(ai, threeLilQuilboar);
  assert.ok(titusThreeLil > highGemThreeLil);
});
