import assert from "node:assert/strict";
import test from "node:test";

import {
  LIVE_MINION_DEFINITIONS,
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  planAiBoardOrder,
  scoreMinionForAi,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
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

function inertMinion(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("annihilan-battlemaster", instanceId, {
    attack: 0,
    health: 1_000,
    taunt: false,
    divineShield: false,
    reborn: false,
    ...overrides,
  });
}

function noEffectAiBaseline(
  source: BoardMinionInstance,
  instanceId: string,
): BoardMinionInstance {
  return definitionMinion("live-half-shell-token", instanceId, {
    attack: source.attack,
    health: source.health,
    tier: source.tier,
    tribe: source.tribe,
    tribes: [...source.tribes],
    taunt: source.taunt,
    divineShield: source.divineShield,
    reborn: source.reborn,
    stealth: source.stealth,
    poisonous: source.poisonous,
    venomous: source.venomous,
    windfury: source.windfury,
    cleave: source.cleave,
  });
}

function enemyWall(instanceId: string): BoardMinionInstance {
  return inertMinion(instanceId, {
    attack: 100,
    health: 100_000,
    taunt: true,
  });
}

function runCombat(
  seed: number,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
  configure?: (state: GameState, human: PlayerState) => void,
): { state: GameState; battle: BattleSummary } {
  const state = createGame(seed);
  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);

  for (const player of state.players) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.health = 1_000;
    player.armor = 0;
    player.alive = player.id === human.id || player.id === enemy.id;
    player.eliminatedRound = player.alive ? undefined : state.round;
  }
  human.board = humanBoard;
  enemy.board = enemyBoard;
  configure?.(state, human);

  const next = gameReducer(state, { type: "END_TURN" });
  const battle = next.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === next.humanPlayerId ||
      candidate.playerBId === next.humanPlayerId,
  );
  assert.ok(battle);
  return { state: next, battle };
}

test("maps exact build 247416 metadata for the four Deathrattle and summon minions", () => {
  const cases = [
    {
      id: "BG34_920",
      name: "赶潮纳迦",
      tier: 2,
      tribe: "naga",
      attack: 2,
      health: 1,
      mechanics: ["DEATHRATTLE", "TAUNT"],
      description: "嘲讽。亡语：对一个相邻的随从施放变换之潮。",
      goldenCardId: "BG34_920_G",
      goldenDescription: "嘲讽。亡语：对相邻的随从施放变换之潮。",
    },
    {
      id: "BG25_806",
      name: "狡猾的迅猛龙",
      tier: 3,
      tribe: "beast",
      attack: 1,
      health: 3,
      mechanics: ["DEATHRATTLE"],
      description: "亡语：随机召唤一只野兽，其属性值变为6/6。",
      goldenCardId: "BG25_806_G",
      goldenDescription: "亡语：随机召唤一只野兽，其属性值变为12/12。",
    },
    {
      id: "BG29_808",
      name: "尖角救星",
      tier: 5,
      tribe: "beast",
      attack: 8,
      health: 2,
      mechanics: ["DEATHRATTLE", "REBORN", "TAUNT"],
      description:
        "嘲讽。复生\n亡语：使你的随从获得+1生命值并对其造成1点伤害。",
      goldenCardId: "BG29_808_G",
      goldenDescription:
        "嘲讽。复生\n亡语：使你的随从获得+1生命值并对其造成1点伤害，触发两次。",
    },
    {
      id: "BG35_604",
      name: "下水道老鼠头目",
      tier: 5,
      tribe: "beast",
      attack: 4,
      health: 6,
      mechanics: ["DEATHRATTLE"],
      description:
        "亡语：召唤两只下水道老鼠。下水道老鼠能召唤2/3并具有嘲讽的乌龟。",
      goldenCardId: "BG35_604_G",
      goldenDescription:
        "亡语：召唤两只金色下水道老鼠。金色下水道老鼠能召唤4/6并具有嘲讽的乌龟。",
    },
  ] as const;

  for (const expected of cases) {
    const definition = getMinionDefinition(expected.id);
    assert.deepEqual(
      {
        cardId: definition.cardId,
        name: definition.name,
        tier: definition.tier,
        tribe: definition.tribe,
        tribes: definition.tribes,
        attack: definition.attack,
        health: definition.health,
        effectSupport: definition.effectSupport,
        printedMechanics: definition.printedMechanics,
        description: definition.description,
        goldenCardId: definition.goldenCardId,
        goldenDescription: definition.goldenDescription,
      },
      {
        cardId: expected.id,
        name: expected.name,
        tier: expected.tier,
        tribe: expected.tribe,
        tribes: [expected.tribe],
        attack: expected.attack,
        health: expected.health,
        effectSupport: "complete",
        printedMechanics: expected.mechanics,
        description: expected.description,
        goldenCardId: expected.goldenCardId,
        goldenDescription: expected.goldenDescription,
      },
    );
  }
});

test("maps Sewer Rat and Half-Shell to their exact ordinary and Golden token art and rules", () => {
  const rat = MINION_DEFINITIONS.find(
    (definition) => definition.cardId === "BG19_010",
  );
  const turtle = MINION_DEFINITIONS.find(
    (definition) => definition.cardId === "BG19_010t",
  );
  assert.ok(rat);
  assert.ok(turtle);
  assert.deepEqual(
    {
      name: rat.name,
      tier: rat.tier,
      tribe: rat.tribe,
      tribes: rat.tribes,
      attack: rat.attack,
      health: rat.health,
      collectible: rat.collectible,
      effectSupport: rat.effectSupport,
      description: rat.description,
      goldenCardId: rat.goldenCardId,
      goldenDescription: rat.goldenDescription,
    },
    {
      name: "下水道老鼠",
      tier: 2,
      tribe: "beast",
      tribes: ["beast"],
      attack: 3,
      health: 2,
      collectible: false,
      effectSupport: "complete",
      description: "亡语：召唤一只2/3并具有嘲讽的龟。",
      goldenCardId: "BG19_010_G",
      goldenDescription: "亡语：召唤一只4/6并具有嘲讽的龟。",
    },
  );
  assert.deepEqual(
    {
      name: turtle.name,
      tier: turtle.tier,
      tribe: turtle.tribe,
      tribes: turtle.tribes,
      attack: turtle.attack,
      health: turtle.health,
      taunt: turtle.taunt,
      collectible: turtle.collectible,
      effectSupport: turtle.effectSupport,
      description: turtle.description,
      goldenCardId: turtle.goldenCardId,
      goldenDescription: turtle.goldenDescription,
    },
    {
      name: "半甲龟",
      tier: 1,
      tribe: "beast",
      tribes: ["beast"],
      attack: 2,
      health: 3,
      taunt: true,
      collectible: false,
      effectSupport: "complete",
      description: "嘲讽",
      goldenCardId: "BG19_010_Gt",
      goldenDescription: "嘲讽",
    },
  );
});

function tideBoard(
  prefix: string,
  options: { golden?: boolean; onlyLeft?: boolean; titus?: boolean } = {},
): {
  board: BoardMinionInstance[];
  source: BoardMinionInstance;
  left: BoardMinionInstance;
  right?: BoardMinionInstance;
  outsider: BoardMinionInstance;
} {
  const outsider = inertMinion(`${prefix}-outsider`);
  const left = definitionMinion("BG23_009", `${prefix}-left-naga`, {
    attack: 0,
    health: 1_000,
    taunt: false,
  });
  const source = definitionMinion("BG34_920", `${prefix}-raiser`, {
    golden: options.golden === true,
    attack: 0,
    health: 1,
    taunt: true,
  });
  const right = options.onlyLeft
    ? undefined
    : inertMinion(`${prefix}-right-neutral`);
  const titus = options.titus
    ? definitionMinion("titus-rivendare", `${prefix}-titus`, {
        attack: 0,
        health: 1_000,
      })
    : undefined;
  return {
    board: [outsider, left, source, ...(right ? [right] : []), ...(titus ? [titus] : [])],
    source,
    left,
    right,
    outsider,
  };
}

function enemyFirstBoard(count: number, prefix: string): BoardMinionInstance[] {
  return [
    enemyWall(`${prefix}-wall`),
    ...Array.from({ length: Math.max(0, count - 1) }, (_, index) =>
      inertMinion(`${prefix}-filler-${index}`),
    ),
  ];
}

test("ordinary Tide Raiser randomly casts Shifting Tide on exactly one living adjacent minion", () => {
  const selected = new Set<string>();
  for (let run = 0; run < 48; run += 1) {
    const scenario = tideBoard("ordinary-tide");
    const right = scenario.right;
    assert.ok(right);
    const { battle } = runCombat(
      0xd34000 + run,
      scenario.board,
      enemyFirstBoard(scenario.board.length + 1, `ordinary-tide-${run}`),
    );
    const casts = battle.events.filter(
      (event) =>
        event.type === "tavernSpellCast" &&
        event.actorInstanceId === scenario.source.instanceId &&
        event.cardName === "变换之潮",
    );
    assert.equal(casts.length, 1);
    const buffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === scenario.source.instanceId &&
        event.attackDelta === 1 &&
        event.healthDelta === 1,
    );
    const targets = new Set(buffs.map((event) => event.targetInstanceId));
    assert.equal(targets.size, 1);
    const [targetId] = [...targets];
    assert.ok(
      targetId === scenario.left.instanceId ||
        targetId === right.instanceId,
    );
    assert.notEqual(targetId, scenario.outsider.instanceId);
    assert.equal(
      buffs.length,
      targetId === scenario.left.instanceId ? 4 : 2,
    );
    selected.add(targetId);
  }
  assert.deepEqual(
    [...selected].sort(),
    ["ordinary-tide-left-naga", "ordinary-tide-right-neutral"],
  );
});

test("Golden Tide Raiser casts once on each existing adjacent minion without redirecting a missing side", () => {
  {
    const scenario = tideBoard("golden-two-sided", { golden: true });
    const right = scenario.right;
    assert.ok(right);
    const { battle } = runCombat(
      0xd34100,
      scenario.board,
      enemyFirstBoard(scenario.board.length + 1, "golden-two-sided"),
    );
    const casts = battle.events.filter(
      (event) =>
        event.type === "tavernSpellCast" &&
        event.actorInstanceId === scenario.source.instanceId &&
        event.cardName === "变换之潮",
    );
    assert.equal(casts.length, 2);
    const buffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === scenario.source.instanceId,
    );
    assert.equal(
      buffs.filter(
        (event) => event.targetInstanceId === scenario.left.instanceId,
      ).length,
      4,
    );
    assert.equal(
      buffs.filter(
        (event) => event.targetInstanceId === right.instanceId,
      ).length,
      2,
    );
    assert.equal(
      buffs.some(
        (event) => event.targetInstanceId === scenario.outsider.instanceId,
      ),
      false,
    );
  }

  {
    const scenario = tideBoard("golden-one-sided", {
      golden: true,
      onlyLeft: true,
    });
    const { battle } = runCombat(
      0xd34101,
      scenario.board,
      enemyFirstBoard(scenario.board.length + 1, "golden-one-sided"),
    );
    const casts = battle.events.filter(
      (event) =>
        event.type === "tavernSpellCast" &&
        event.actorInstanceId === scenario.source.instanceId &&
        event.cardName === "变换之潮",
    );
    assert.equal(casts.length, 1);
    assert.equal(
      battle.events.filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === scenario.source.instanceId &&
          event.targetInstanceId === scenario.left.instanceId,
      ).length,
      4,
    );
  }
});

test("Titus repeats each complete Tide Raiser Deathrattle rather than multiplying one buff", () => {
  for (const golden of [false, true]) {
    const scenario = tideBoard(`titus-tide-${golden}`, {
      golden,
      titus: true,
    });
    const right = scenario.right;
    assert.ok(right);
    const { battle } = runCombat(
      0xd34200 + Number(golden),
      scenario.board,
      enemyFirstBoard(scenario.board.length + 1, `titus-tide-${golden}`),
    );
    const casts = battle.events.filter(
      (event) =>
        event.type === "tavernSpellCast" &&
        event.actorInstanceId === scenario.source.instanceId &&
        event.cardName === "变换之潮",
    );
    assert.equal(casts.length, golden ? 4 : 2);
    const buffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === scenario.source.instanceId,
    );
    assert.equal(
      buffs.some(
        (event) => event.targetInstanceId === scenario.outsider.instanceId,
      ),
      false,
    );
    if (golden) {
      assert.equal(
        buffs.filter(
          (event) => event.targetInstanceId === scenario.left.instanceId,
        ).length,
        8,
      );
      assert.equal(
        buffs.filter(
          (event) => event.targetInstanceId === right.instanceId,
        ).length,
        4,
      );
    }
  }
});

test("Tide Raiser does not slide its adjacent spell to a farther minion when its original neighbor dies in the same wave", () => {
  const outsider = inertMinion("same-wave-tide-outsider", {
    attack: 0,
    health: 1_000,
  });
  const doomedNeighbor = inertMinion("same-wave-tide-neighbor", {
    attack: 0,
    health: 1,
  });
  const source = definitionMinion("BG34_920", "same-wave-tide-source", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  const cleaver = inertMinion("same-wave-tide-cleaver", {
    attack: 100,
    health: 100_000,
    cleave: true,
  });
  const { battle } = runCombat(
    0xd34300,
    [outsider, doomedNeighbor, source],
    [
      cleaver,
      inertMinion("same-wave-tide-enemy-filler-1"),
      inertMinion("same-wave-tide-enemy-filler-2"),
      inertMinion("same-wave-tide-enemy-filler-3"),
    ],
  );

  const simultaneousDamage = battle.events.filter(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === cleaver.instanceId &&
      (event.targetInstanceId === doomedNeighbor.instanceId ||
        event.targetInstanceId === source.instanceId),
  );
  assert.deepEqual(
    new Set(simultaneousDamage.map((event) => event.targetInstanceId)),
    new Set([doomedNeighbor.instanceId, source.instanceId]),
  );
  const firstDeathIndex = Math.min(
    ...battle.events
      .filter(
        (event) =>
          event.type === "death" &&
          (event.actorInstanceId === doomedNeighbor.instanceId ||
            event.actorInstanceId === source.instanceId),
      )
      .map((event) => event.index),
  );
  assert.ok(
    simultaneousDamage.every((event) => event.index < firstDeathIndex),
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "tavernSpellCast" &&
        event.actorInstanceId === source.instanceId,
    ),
    false,
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === source.instanceId &&
        event.targetInstanceId === outsider.instanceId,
    ),
    false,
  );
});

function raptorCombat(
  seed: number,
  golden: boolean,
): { state: GameState; battle: BattleSummary; source: BoardMinionInstance } {
  const source = definitionMinion("BG25_806", `raptor-${seed}`, {
    golden,
    attack: 0,
    health: 1,
    taunt: true,
  });
  const result = runCombat(
    seed,
    [source],
    [enemyWall(`raptor-wall-${seed}`), inertMinion(`raptor-filler-${seed}`)],
    (state, human) => {
      state.activeTribes = ["beast"];
      human.tavernTier = 1;
    },
  );
  return { ...result, source };
}

test("Sly Raptor summons one ordinary current-pool Beast at exactly 6/6 or 12/12 without consuming the shared pool", () => {
  const liveBeasts = new Map(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.tribes?.includes("beast") === true,
    ).map((definition) => [definition.cardId, definition]),
  );
  for (const golden of [false, true]) {
    let poolBefore: Record<string, number> = {};
    const source = definitionMinion(
      "BG25_806",
      `raptor-stats-${golden}`,
      {
        golden,
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    const { state, battle } = runCombat(
      0xd25000 + Number(golden),
      [source],
      [enemyWall(`raptor-stats-wall-${golden}`), inertMinion(`raptor-stats-filler-${golden}`)],
      (game, human) => {
        game.activeTribes = ["beast"];
        human.tavernTier = 1;
        poolBefore = { ...game.pool };
      },
    );
    const summons = battle.events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.equal(summons.length, 1);
    const summoned = summons[0]?.minion;
    assert.ok(summoned);
    assert.ok(liveBeasts.has(summoned.cardId));
    assert.equal(summoned.golden, false);
    assert.deepEqual(
      [summoned.attack, summoned.health],
      golden ? [12, 12] : [6, 6],
    );
    assert.deepEqual(state.pool, poolBefore);
  }
});

test("Sly Raptor's unrestricted Beast candidates include itself and minions above the owner's Tavern Tier", () => {
  const liveBeastCardIds = new Set(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.tribes?.includes("beast") === true,
    ).map((definition) => definition.cardId),
  );
  let sawSelf = false;
  let sawHigherTier = false;
  for (let run = 0; run < 128 && (!sawSelf || !sawHigherTier); run += 1) {
    const { battle, source } = raptorCombat(0xd25100 + run, false);
    const summon = battle.events.find(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.ok(summon?.minion);
    assert.ok(liveBeastCardIds.has(summon.minion.cardId));
    sawSelf ||= summon.minion.cardId === "BG25_806";
    sawHigherTier ||= summon.minion.tier > 1;
  }
  assert.equal(sawSelf, true);
  assert.equal(sawHigherTier, true);
});

test("Titus repeats Sly Raptor's complete Deathrattle and summons two generated Beasts", () => {
  const source = definitionMinion("BG25_806", "titus-raptor-source", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  const titus = definitionMinion("titus-rivendare", "titus-raptor", {
    attack: 0,
    health: 1_000,
  });
  const { battle } = runCombat(
    0xd25200,
    [source, titus],
    enemyFirstBoard(3, "titus-raptor"),
    (state) => {
      state.activeTribes = ["beast"];
    },
  );
  const summons = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.equal(summons.length, 2);
  assert.ok(
    summons.every(
      (event) =>
        event.minion?.golden === false &&
        event.minion.attack === 6 &&
        event.minion.health === 6,
    ),
  );
});

test("Spiked Savior resolves Health then damage as independent pulses before Reborn", () => {
  for (const golden of [false, true]) {
    for (const titusPresent of [false, true]) {
      const prefix = `savior-${golden}-${titusPresent}`;
      const fragile = definitionMinion("BG31_803", `${prefix}-fragile`, {
        attack: 0,
        health: 1,
        taunt: false,
      });
      const source = definitionMinion("BG29_808", `${prefix}-source`, {
        golden,
        attack: 0,
        health: 1,
        taunt: true,
      });
      const trigore = definitionMinion("BG29_807", `${prefix}-trigore`, {
        attack: 0,
        health: 100,
        taunt: false,
      });
      const titus = titusPresent
        ? definitionMinion("titus-rivendare", `${prefix}-titus`, {
            attack: 0,
            health: 1_000,
          })
        : undefined;
      const board = [fragile, source, trigore, ...(titus ? [titus] : [])];
      const { battle } = runCombat(
        0xd29000 + Number(golden) * 8 + Number(titusPresent),
        board,
        enemyFirstBoard(board.length + 1, prefix),
      );
      const pulses = (golden ? 2 : 1) * (titusPresent ? 2 : 1);
      for (const target of [fragile, trigore]) {
        const sequence = battle.events.filter(
          (event) =>
            event.actorInstanceId === source.instanceId &&
            event.targetInstanceId === target.instanceId &&
            (event.type === "buff" || event.type === "damage"),
        );
        assert.deepEqual(
          sequence.map((event) => event.type),
          Array.from({ length: pulses }, () => ["buff", "damage"]).flat(),
        );
        assert.ok(
          sequence
            .filter((event) => event.type === "buff")
            .every(
              (event) =>
                event.attackDelta === 0 && event.healthDelta === 1,
            ),
        );
      }
      const fragileDamage = battle.events.filter(
        (event) =>
          event.type === "damage" &&
          event.actorInstanceId === source.instanceId &&
          event.targetInstanceId === fragile.instanceId,
      );
      assert.equal(fragileDamage.length, pulses);
      assert.ok(fragileDamage.every((event) => event.minion?.health === 1));
      assert.equal(
        battle.events.some(
          (event) =>
            (event.type === "buff" || event.type === "damage") &&
            event.targetInstanceId === source.instanceId &&
            event.actorInstanceId === source.instanceId,
        ),
        false,
      );
      const reborn = battle.events.find(
        (event) =>
          event.type === "summon" &&
          event.actorInstanceId === source.instanceId &&
          event.summonReason === "reborn",
      );
      assert.ok(reborn);
      assert.ok(fragileDamage.every((event) => event.index < reborn.index));
      assert.equal(
        battle.events.some(
          (event) =>
            event.type === "death" &&
            event.actorInstanceId === fragile.instanceId &&
            event.index < reborn.index,
        ),
        false,
      );
    }
  }
});

test("Spiked Savior's effect damage breaks Divine Shield without inheriting Poisonous or Venomous", () => {
  const shielded = inertMinion("savior-shielded", {
    attack: 0,
    health: 50,
    divineShield: true,
  });
  const durable = inertMinion("savior-poison-check", {
    attack: 0,
    health: 1_000,
  });
  const source = definitionMinion("BG29_808", "savior-poison-source", {
    attack: 0,
    health: 1,
    taunt: true,
    poisonous: true,
    venomous: true,
  });
  const { battle } = runCombat(
    0xd29100,
    [shielded, source, durable],
    enemyFirstBoard(4, "savior-poison"),
  );

  const shieldBreak = battle.events.find(
    (event) =>
      event.type === "shieldBroken" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === shielded.instanceId,
  );
  assert.ok(shieldBreak?.minion);
  assert.equal(shieldBreak.minion.divineShield, false);
  assert.equal(shieldBreak.minion.health, 51);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === source.instanceId &&
        event.targetInstanceId === shielded.instanceId,
    ),
    false,
  );

  const durableDamage = battle.events.find(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === durable.instanceId,
  );
  assert.ok(durableDamage?.minion);
  assert.equal(durableDamage.amount, 1);
  assert.equal(durableDamage.minion.health, 1_000);
  assert.equal(durableDamage.actorMinion?.poisonous, true);
  assert.equal(durableDamage.actorMinion?.venomous, true);
});

test("Sewer Lord summons two ordinary or Golden Sewer Rats and each Rat summons its matching Half-Shell", () => {
  for (const golden of [false, true]) {
    const source = definitionMinion(
      "BG35_604",
      `sewer-lord-${golden}`,
      {
        golden,
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    const { battle } = runCombat(
      0xd35000 + Number(golden),
      [source],
      [enemyWall(`sewer-wall-${golden}`), inertMinion(`sewer-filler-${golden}`)],
      (state) => {
        state.activeTribes = ["beast"];
      },
    );
    const rats = battle.events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId &&
        event.minion?.cardId === (golden ? "BG19_010_G" : "BG19_010"),
    );
    assert.equal(rats.length, 2);
    assert.ok(rats.every((event) => event.minion?.golden === golden));
    assert.ok(
      rats.every(
        (event) =>
          event.minion?.attack === (golden ? 6 : 3) &&
          event.minion.health === (golden ? 4 : 2),
      ),
    );
    const ratInstanceIds = new Set(
      rats.map((event) => event.targetInstanceId),
    );
    const turtles = battle.events.filter(
      (event) =>
        event.type === "summon" &&
        ratInstanceIds.has(event.actorInstanceId) &&
        event.minion?.cardId ===
          (golden ? "BG19_010_Gt" : "BG19_010t"),
    );
    assert.equal(turtles.length, 2);
    assert.ok(
      turtles.every(
        (event) =>
          event.minion?.golden === golden &&
          event.minion.taunt === true &&
          event.minion.attack === (golden ? 4 : 2) &&
          event.minion.health === (golden ? 6 : 3),
      ),
    );
  }
});

test("Titus repeats Sewer Lord's complete Deathrattle and summons four Sewer Rats when space permits", () => {
  const source = definitionMinion("BG35_604", "titus-sewer-source", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  const titus = definitionMinion("titus-rivendare", "titus-sewer", {
    attack: 0,
    health: 1_000,
  });
  const { battle } = runCombat(
    0xd35010,
    [source, titus],
    enemyFirstBoard(3, "titus-sewer"),
    (state) => {
      state.activeTribes = ["beast"];
    },
  );
  const rats = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === source.instanceId &&
      event.minion?.cardId === "BG19_010",
  );
  assert.equal(rats.length, 4);
  assert.ok(
    rats.every(
      (event) =>
        event.minion?.golden === false &&
        event.minion.attack === 3 &&
        event.minion.health === 2,
    ),
  );
});

test("Sewer Lord loses the second Rat when only one board slot is open", () => {
  for (const golden of [false, true]) {
    const source = definitionMinion(
      "BG35_604",
      `full-sewer-lord-${golden}`,
      {
        golden,
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    const fullBoard = [
      source,
      ...Array.from({ length: 6 }, (_, index) =>
        inertMinion(`full-sewer-${golden}-${index}`),
      ),
    ];
    const { battle } = runCombat(
      0xd35100 + Number(golden),
      fullBoard,
      [enemyWall(`full-sewer-wall-${golden}`)],
      (state) => {
        state.activeTribes = ["beast"];
      },
    );
    const directRats = battle.events.filter(
      (event) =>
        event.type === "summon" &&
        event.actorInstanceId === source.instanceId &&
        (event.minion?.cardId === "BG19_010" ||
          event.minion?.cardId === "BG19_010_G"),
    );
    assert.equal(directRats.length, 1);
  }
});

test("Recruit-phase destruction resolves the four new Deathrattles without consuming generated minions from the pool", () => {
  {
    let state = createGame(0xd35200);
    let player = humanPlayer(state);
    const left = definitionMinion("BG23_009", "recruit-tide-left", {
      attack: 1,
      health: 20,
    });
    const right = inertMinion("recruit-tide-right", {
      attack: 1,
      health: 20,
    });
    const source = definitionMinion("BG34_920", "recruit-tide-source", {
      destroyAfterPlayThroughRound: state.round,
    });
    player.board = [left, right];
    player.hand = [source];
    player.tavernSpellsCast = 0;

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
      boardIndex: 1,
    });
    player = humanPlayer(state);
    assert.equal(
      player.board.some(
        (minion) => minion.instanceId === source.instanceId,
      ),
      false,
    );
    assert.equal(player.tavernSpellsCast, 1);
    const nextLeft = player.board.find(
      (minion) => minion.instanceId === left.instanceId,
    );
    const nextRight = player.board.find(
      (minion) => minion.instanceId === right.instanceId,
    );
    assert.ok(nextLeft);
    assert.ok(nextRight);
    assert.ok(
      (nextLeft.attack === 5 && nextRight.attack === 1) ||
        (nextLeft.attack === 1 && nextRight.attack === 3),
    );
  }

  {
    let state = createGame(0xd35201);
    state.activeTribes = ["beast"];
    let player = humanPlayer(state);
    const source = definitionMinion("BG25_806", "recruit-raptor", {
      destroyAfterPlayThroughRound: state.round,
    });
    player.board = [];
    player.hand = [source];
    const poolBefore = { ...state.pool };

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(player.board.length, 1);
    assert.deepEqual(
      [player.board[0].attack, player.board[0].health],
      [6, 6],
    );
    assert.equal(player.board[0].golden, false);
    assert.deepEqual(state.pool, poolBefore);
  }

  {
    let state = createGame(0xd35202);
    let player = humanPlayer(state);
    const ally = inertMinion("recruit-savior-ally", {
      attack: 1,
      health: 5,
    });
    const source = definitionMinion("BG29_808", "recruit-savior", {
      destroyAfterPlayThroughRound: state.round,
    });
    player.board = [ally];
    player.hand = [source];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
      boardIndex: 1,
    });
    player = humanPlayer(state);
    const nextAlly = player.board.find(
      (minion) => minion.instanceId === ally.instanceId,
    );
    assert.ok(nextAlly);
    assert.equal(nextAlly.health, 5);
    const reborn = player.board.find(
      (minion) =>
        minion.definitionId === "BG29_808" &&
        minion.instanceId !== source.instanceId,
    );
    assert.ok(reborn);
    assert.equal(reborn.health, 1);
    assert.equal(reborn.reborn, false);
  }

  {
    let state = createGame(0xd35203);
    let player = humanPlayer(state);
    const source = definitionMinion("BG35_604", "recruit-sewer-lord", {
      destroyAfterPlayThroughRound: state.round,
    });
    player.board = [];
    player.hand = [source];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(player.board.length, 2);
    assert.ok(
      player.board.every(
        (minion) => minion.definitionId === "live-sewer-rat-token",
      ),
    );
  }
});

test("Recruit-phase Savior damage breaks Divine Shield and only real damage wakes Trigore", () => {
  let state = createGame(0xd35210);
  let player = humanPlayer(state);
  const shieldedBeast = definitionMinion(
    "live-half-shell-token",
    "recruit-savior-shielded-beast",
    { divineShield: true, taunt: false },
  );
  const damagedBeast = definitionMinion(
    "live-half-shell-token",
    "recruit-savior-damaged-beast",
    { taunt: false },
  );
  const trigore = definitionMinion("BG29_807", "recruit-savior-trigore");
  const trigoreHealthBefore = trigore.health;
  const source = definitionMinion("BG29_808", "recruit-savior-observer-source", {
    destroyAfterPlayThroughRound: state.round,
  });
  player.board = [shieldedBeast, damagedBeast, trigore];
  player.hand = [source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
    boardIndex: 3,
  });
  player = humanPlayer(state);
  const nextShielded = player.board.find(
    (minion) => minion.instanceId === shieldedBeast.instanceId,
  );
  const nextDamaged = player.board.find(
    (minion) => minion.instanceId === damagedBeast.instanceId,
  );
  const nextTrigore = player.board.find(
    (minion) => minion.instanceId === trigore.instanceId,
  );
  assert.ok(nextShielded);
  assert.ok(nextDamaged);
  assert.ok(nextTrigore);
  assert.equal(nextShielded.divineShield, false);
  assert.equal(nextShielded.health, shieldedBeast.health + 1);
  assert.equal(nextDamaged.health, damagedBeast.health);
  assert.equal(nextTrigore.health, trigoreHealthBefore + 2);
});

test("AI values the four Deathrattles and places Tide Raiser between two Naga", () => {
  const state = createGame(0xd35220);
  const player = state.players[1];
  const tideRaiser = definitionMinion("BG34_920", "ai-tide-raiser");
  const raptor = definitionMinion("BG25_806", "ai-sly-raptor");
  const savior = definitionMinion("BG29_808", "ai-spiked-savior");
  const sewerLord = definitionMinion("BG35_604", "ai-sewer-lord");
  const firstNaga = definitionMinion("BG23_009", "ai-tide-naga-a", {
    attack: 20,
    health: 20,
    taunt: false,
  });
  const secondNaga = definitionMinion("BG26_502", "ai-tide-naga-b", {
    attack: 10,
    health: 10,
  });
  const neutral = noEffectAiBaseline(
    definitionMinion("live-half-shell-token", "ai-tide-neutral-source", {
      attack: 100,
      health: 100,
      tribe: "neutral",
      tribes: [],
      taunt: false,
    }),
    "ai-tide-neutral",
  );

  player.board = [firstNaga];
  for (const candidate of [tideRaiser, raptor, sewerLord]) {
    assert.ok(
      scoreMinionForAi(player, candidate) >
        scoreMinionForAi(
          player,
          noEffectAiBaseline(candidate, `baseline-${candidate.instanceId}`),
        ),
      `${candidate.name} should be worth more than the same body without its Deathrattle`,
    );
  }

  const saviorWithoutEngine =
    scoreMinionForAi(player, savior) -
    scoreMinionForAi(
      player,
      noEffectAiBaseline(savior, "baseline-savior-without-engine"),
    );
  player.board = [
    definitionMinion("BG29_807", "ai-savior-trigore"),
    definitionMinion("BG25_806", "ai-savior-beast"),
  ];
  const saviorWithEngine =
    scoreMinionForAi(player, savior) -
    scoreMinionForAi(
      player,
      noEffectAiBaseline(savior, "baseline-savior-with-engine"),
    );
  assert.ok(saviorWithEngine > saviorWithoutEngine);

  player.board = [tideRaiser, firstNaga, neutral, secondNaga];
  const order = planAiBoardOrder(player);
  const tideIndex = order.indexOf(tideRaiser.instanceId);
  assert.ok(tideIndex > 0 && tideIndex < order.length - 1);
  assert.deepEqual(
    new Set([order[tideIndex - 1], order[tideIndex + 1]]),
    new Set([firstNaga.instanceId, secondNaga.instanceId]),
  );
});

test("Tide Raiser positioning does not split Persistent Poet's Dragon chain", () => {
  const state = createGame(0xd35221);
  const player = state.players[1];
  const tideRaiser = definitionMinion("BG34_920", "ai-poet-tide");
  const poet = definitionMinion("BG29_813", "ai-poet-with-tide");
  const firstDragon = definitionMinion("BG34_636t", "ai-poet-tide-dragon-a", {
    attack: 30,
    health: 30,
  });
  const secondDragon = definitionMinion("BG34_638t", "ai-poet-tide-dragon-b", {
    attack: 20,
    health: 20,
  });
  const neutral = noEffectAiBaseline(
    definitionMinion("live-half-shell-token", "ai-poet-neutral-source", {
      attack: 40,
      health: 40,
      tribe: "neutral",
      tribes: [],
      taunt: false,
    }),
    "ai-poet-neutral",
  );
  player.board = [tideRaiser, poet, firstDragon, neutral, secondDragon];

  const order = planAiBoardOrder(player);
  const poetIndex = order.indexOf(poet.instanceId);
  assert.ok(poetIndex > 0 && poetIndex < order.length - 1);
  assert.deepEqual(
    new Set([order[poetIndex - 1], order[poetIndex + 1]]),
    new Set([firstDragon.instanceId, secondDragon.instanceId]),
  );
});

test("Tide Raiser positioning preserves the cleave buffer before the first Taunt", () => {
  const state = createGame(0xd35222);
  const player = state.players[1];
  const opponent = state.players[2];
  const tideRaiser = definitionMinion("BG34_920", "ai-cleave-tide");
  const firstNaga = definitionMinion("BG23_009", "ai-cleave-naga-a", {
    attack: 40,
    health: 40,
    taunt: false,
  });
  const secondNaga = definitionMinion("BG26_502", "ai-cleave-naga-b", {
    attack: 30,
    health: 30,
  });
  const buffer = noEffectAiBaseline(
    definitionMinion("live-half-shell-token", "ai-cleave-buffer-source", {
      attack: 1,
      health: 1,
      tribe: "neutral",
      tribes: [],
      taunt: false,
    }),
    "ai-cleave-buffer",
  );
  const largeTaunt = noEffectAiBaseline(
    definitionMinion("live-half-shell-token", "ai-cleave-taunt-source", {
      attack: 50,
      health: 50,
      tribe: "neutral",
      tribes: [],
      taunt: true,
    }),
    "ai-cleave-taunt",
  );
  player.board = [tideRaiser, firstNaga, buffer, largeTaunt, secondNaga];
  opponent.board = [
    noEffectAiBaseline(
      definitionMinion("live-half-shell-token", "ai-cleaver-source", {
        attack: 50,
        health: 50,
        cleave: true,
        taunt: false,
      }),
      "ai-cleaver",
    ),
  ];

  const order = planAiBoardOrder(player, opponent);
  const firstTauntIndex = order.findIndex((instanceId) =>
    [tideRaiser.instanceId, largeTaunt.instanceId].includes(instanceId),
  );
  assert.ok(firstTauntIndex > 0);
  assert.equal(order[firstTauntIndex - 1], buffer.instanceId);
  assert.equal(order[firstTauntIndex], largeTaunt.instanceId);
});

test("a ghost Rakanishu does not strengthen Tide Raiser's automatic combat Tavern Spell", () => {
  const state = createGame(0xd35300);
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
    player.board = [enemyWall(`ghost-tide-opponent-${index}`)];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.heroId = "hero-rakanishu";
  ghost.heroPowerId = "hero-power-light-the-tavern";
  ghost.heroPowerCounters = {
    rakanishuTurns: 12,
    rakanishuBonus: 7,
  };
  const left = definitionMinion("BG23_009", "ghost-tide-left", {
    attack: 0,
    health: 100,
    taunt: false,
  });
  const source = definitionMinion("BG34_920", "ghost-tide-source", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  const right = inertMinion("ghost-tide-right", {
    attack: 0,
    health: 100,
  });
  ghost.board = [left, source, right];
  ghost.tavernSpellsCast = 9;
  const boardBefore = structuredClone(ghost.board);

  const next = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(next.players[3].board, boardBefore);
  assert.equal(next.players[3].tavernSpellsCast, 9);
  const battle = next.lastRoundBattles.find(
    (candidate) =>
      candidate.isGhost &&
      (candidate.playerAId === ghost.id || candidate.playerBId === ghost.id),
  );
  assert.ok(battle);
  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "tavernSpellCast" &&
        event.actorInstanceId === source.instanceId &&
      event.cardName === "变换之潮",
    ),
  );
  const tideBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId &&
      (event.targetInstanceId === left.instanceId ||
        event.targetInstanceId === right.instanceId),
  );
  assert.ok(tideBuffs.length === 2 || tideBuffs.length === 4);
  assert.ok(
    tideBuffs.every(
      (event) => event.attackDelta === 1 && event.healthDelta === 1,
    ),
    "the eliminated Hero's +7/+7 Rakanishu bonus must not affect ghost casts",
  );
});
