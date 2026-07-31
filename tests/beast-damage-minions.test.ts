import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
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

function inertMinion(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("annihilan-battlemaster", instanceId, {
    attack: 0,
    health: 100,
    taunt: false,
    divineShield: false,
    reborn: false,
    ...overrides,
  });
}

function beast(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("BG31_803", instanceId, {
    attack: 0,
    health: 50,
    taunt: false,
    ...overrides,
  });
}

function bomber(instanceId: string): BoardMinionInstance {
  return definitionMinion("BG_DAL_775", instanceId, {
    attack: 0,
    health: 1,
    taunt: true,
  });
}

function wall(
  instanceId: string,
  attack: number,
  health: number,
): BoardMinionInstance {
  return inertMinion(instanceId, {
    attack,
    health,
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

function permanentMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const minion = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion);
  return minion;
}

test("maps exact fixed-build metadata for the four Beast damage minions", () => {
  const cases = [
    {
      id: "BG26_802",
      name: "香蕉猛猿",
      tier: 4,
      attack: 3,
      health: 6,
      goldenCardId: "BG26_802_G",
      description: "在战斗中，在你召唤一只野兽后，使其攻击力翻倍。",
      goldenDescription:
        "在战斗中，在你召唤一只野兽后，使其攻击力变为三倍。",
    },
    {
      id: "BG35_601",
      name: "双足飞龙前锋",
      tier: 4,
      attack: 2,
      health: 8,
      goldenCardId: "BG35_601_G",
      description:
        "每当本随从受到伤害，获得一次免费的刷新。（每回合限3次。）",
      goldenDescription:
        "每当本随从受到伤害，获得两次免费的刷新。（每回合限3次。）",
    },
    {
      id: "BG29_807",
      name: "鞭笞者特里高雷",
      tier: 4,
      attack: 9,
      health: 3,
      goldenCardId: "BG29_807_G",
      description: "每当另一只友方野兽受到伤害时，永久获得+2生命值。",
      goldenDescription:
        "每当另一只友方野兽受到伤害时，永久获得+4生命值。",
    },
    {
      id: "BG29_806",
      name: "炫彩灼天者",
      tier: 5,
      attack: 3,
      health: 8,
      goldenCardId: "BG29_806_G",
      description:
        "每当一只友方野兽受到伤害时，使该受伤野兽之外的一只友方野兽永久获得+3/+2。",
      goldenDescription:
        "每当一只友方野兽受到伤害时，使该受伤野兽之外的一只友方野兽永久获得+6/+4。",
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
        goldenCardId: definition.goldenCardId,
        description: definition.description,
        goldenDescription: definition.goldenDescription,
      },
      {
        cardId: expected.id,
        name: expected.name,
        tier: expected.tier,
        tribe: "beast",
        tribes: ["beast"],
        attack: expected.attack,
        health: expected.health,
        effectSupport: "complete",
        printedMechanics: ["TRIGGER_VISUAL"],
        goldenCardId: expected.goldenCardId,
        description: expected.description,
        goldenDescription: expected.goldenDescription,
      },
    );

    const golden = goldenMinion(expected.id, `${expected.id}-golden`);
    assert.deepEqual(
      [golden.cardId, golden.attack, golden.health, golden.description],
      [
        expected.goldenCardId,
        expected.attack * 2,
        expected.health * 2,
        expected.goldenDescription,
      ],
    );
  }
});

test("Banana Slamma never doubles a Beast summoned during Recruit", () => {
  let state = createGame(0xb26001);
  let human = humanPlayer(state);
  const slamma = definitionMinion("BG26_802", "recruit-slamma");
  const alleycat = definitionMinion("alleycat", "recruit-alleycat");
  human.board = [slamma];
  human.hand = [alleycat];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const tabbycat = human.board.find(
    (minion) => minion.definitionId === "tabbycat-token",
  );
  assert.ok(tabbycat);
  assert.equal(tabbycat.attack, 1);
});

test("normal and Golden Banana Slammas independently multiply a post-summon Beast snapshot in source order", () => {
  const summoner = beast("slamma-summoner", {
    health: 1,
    taunt: true,
  });
  const ordinary = definitionMinion("BG26_802", "ordinary-slamma", {
    attack: 0,
    health: 100,
  });
  const golden = goldenMinion("BG26_802", "golden-slamma", {
    attack: 0,
    health: 100,
  });
  const { state, battle } = runCombat(
    0xb26002,
    [summoner, ordinary, golden],
    [wall("slamma-wall", 100, 1_000)],
  );

  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.ok(summon?.targetInstanceId);
  assert.equal(summon.minion?.attack, 2);

  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === summon.targetInstanceId &&
      (event.actorInstanceId === ordinary.instanceId ||
        event.actorInstanceId === golden.instanceId),
  );
  assert.deepEqual(
    buffs.map((event) => [
      event.actorInstanceId,
      event.attackDelta,
      event.healthDelta,
      event.minion?.attack,
    ]),
    [
      [ordinary.instanceId, 2, 0, 4],
      [golden.instanceId, 8, 0, 12],
    ],
  );
  assert.ok(buffs.every((event) => summon.index < event.index));
  assert.equal(
    humanPlayer(state).board.some(
      (minion) => minion.instanceId === summon.targetInstanceId,
    ),
    false,
  );
});

test("Bipedal Wingman ignores damage absorbed by Divine Shield", () => {
  const wingman = definitionMinion("BG35_601", "shielded-wingman", {
    attack: 0,
    health: 50,
    divineShield: true,
  });
  const { state, battle } = runCombat(
    0xb35001,
    [bomber("shield-wingman-bomber"), wingman],
    [wall("shield-wingman-wall", 100, 2)],
  );

  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "shieldBroken" &&
        event.targetInstanceId === wingman.instanceId,
    ),
  );
  assert.equal(humanPlayer(state).freeRefreshes, 0);
});

test("Bipedal Wingman counts at most three real damage events and Golden grants two Refreshes per event", () => {
  for (const golden of [false, true]) {
    const wingman = golden
      ? goldenMinion("BG35_601", `capped-wingman-${golden}`, {
          attack: 0,
          health: 100,
        })
      : definitionMinion("BG35_601", `capped-wingman-${golden}`, {
          attack: 0,
          health: 100,
        });
    const bombers = Array.from({ length: 4 }, (_, index) =>
      bomber(`wingman-bomber-${golden}-${index}`),
    );
    const { state, battle } = runCombat(
      0xb35010 + Number(golden),
      [...bombers, wingman],
      [wall(`wingman-cap-wall-${golden}`, 100, 10)],
    );

    assert.equal(
      battle.events.filter(
        (event) =>
          event.type === "damage" &&
          event.targetInstanceId === wingman.instanceId,
      ).length,
      4,
    );
    assert.equal(humanPlayer(state).freeRefreshes, golden ? 6 : 3);
  }
});

test("Trigore excludes its own damage and permanently gains once for each other damaged Beast", () => {
  {
    const trigore = definitionMinion("BG29_807", "self-only-trigore", {
      attack: 0,
      health: 50,
    });
    const { state } = runCombat(
      0xb29001,
      [bomber("self-only-trigore-bomber"), trigore],
      [wall("self-only-trigore-wall", 100, 2)],
    );
    assert.equal(
      permanentMinion(state, trigore.instanceId).health,
      trigore.health,
    );
  }

  for (const golden of [false, true]) {
    const trigore = golden
      ? goldenMinion("BG29_807", `persistent-trigore-${golden}`, {
          attack: 0,
          health: 50,
        })
      : definitionMinion("BG29_807", `persistent-trigore-${golden}`, {
          attack: 0,
          health: 50,
        });
    const damagedBeast = beast(`trigore-damaged-beast-${golden}`);
    const { state } = runCombat(
      0xb29010 + Number(golden),
      [bomber(`persistent-trigore-bomber-${golden}`), trigore, damagedBeast],
      [wall(`persistent-trigore-wall-${golden}`, 100, 2)],
    );
    assert.equal(
      permanentMinion(state, trigore.instanceId).health,
      trigore.health + (golden ? 4 : 2),
    );
    assert.equal(
      permanentMinion(state, damagedBeast.instanceId).health,
      damagedBeast.health,
    );
  }
});

test("same-wave AOE preserves lethal negative Health so only a large enough Trigore gain rescues it", () => {
  for (const golden of [false, true]) {
    const trigore = golden
      ? goldenMinion("BG29_807", `lethal-trigore-${golden}`, {
          attack: 0,
          health: 1,
        })
      : definitionMinion("BG29_807", `lethal-trigore-${golden}`, {
          attack: 0,
          health: 1,
        });
    const damagedBeast = beast(`lethal-trigore-beast-${golden}`);
    const { state, battle } = runCombat(
      0xb29020 + Number(golden),
      [bomber(`lethal-trigore-bomber-${golden}`), trigore, damagedBeast],
      [wall(`lethal-trigore-wall-${golden}`, 100, 2)],
    );
    const died = battle.events.some(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === trigore.instanceId,
    );
    assert.equal(died, !golden);
    assert.equal(
      permanentMinion(state, trigore.instanceId).health,
      trigore.health + (golden ? 4 : 2),
    );
  }
});

test("Poisonous and Venomous lethal damage cannot be undone by a same-wave permanent Trigore Health gain", () => {
  for (const lethalKeyword of ["poisonous", "venomous"] as const) {
    const trigore = definitionMinion(
      "BG29_807",
      `${lethalKeyword}-trigore`,
      {
        attack: 0,
        health: 1,
        taunt: true,
      },
    );
    const damagedBeast = beast(`${lethalKeyword}-damaged-beast`, {
      attack: 0,
      health: 50,
    });
    const lethalAttacker = inertMinion(
      `${lethalKeyword}-cleave-attacker`,
      {
        attack: 1,
        health: 100,
        cleave: true,
        poisonous: lethalKeyword === "poisonous",
        venomous: lethalKeyword === "venomous",
      },
    );
    const { state, battle } = runCombat(
      lethalKeyword === "poisonous" ? 0xb29030 : 0xb29031,
      [damagedBeast, trigore],
      [
        lethalAttacker,
        inertMinion(`${lethalKeyword}-enemy-one`),
        inertMinion(`${lethalKeyword}-enemy-two`),
      ],
    );

    assert.ok(
      battle.events.some(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === trigore.instanceId &&
          event.targetInstanceId === trigore.instanceId &&
          event.healthDelta === 2,
      ),
    );
    assert.ok(
      battle.events.some(
        (event) =>
          event.type === "death" &&
          event.actorInstanceId === trigore.instanceId,
      ),
    );
    assert.equal(
      permanentMinion(state, trigore.instanceId).health,
      trigore.health + 2,
    );
  }
});

test("Skyblazer does nothing when the damaged Beast is its only possible target", () => {
  const skyblazer = definitionMinion("BG29_806", "solo-skyblazer", {
    attack: 1,
    health: 50,
  });
  const { state, battle } = runCombat(
    0xb29801,
    [skyblazer],
    [wall("solo-skyblazer-wall", 1, 1)],
  );

  assert.deepEqual(
    [
      permanentMinion(state, skyblazer.instanceId).attack,
      permanentMinion(state, skyblazer.instanceId).health,
    ],
    [skyblazer.attack, skyblazer.health],
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === skyblazer.instanceId,
    ),
    false,
  );
});

function runDeterministicSkyblazer(
  seed: number,
  golden: boolean,
): { winnerId: string; state: GameState } {
  const damaged = beast(`skyblazer-damaged-${golden}`, {
    attack: 1,
    taunt: true,
  });
  const skyblazer = golden
    ? goldenMinion("BG29_806", `random-skyblazer-${golden}`, {
        attack: 0,
        health: 50,
      })
    : definitionMinion("BG29_806", `random-skyblazer-${golden}`, {
        attack: 0,
        health: 50,
      });
  const candidate = beast(`skyblazer-candidate-${golden}`);
  const { state } = runCombat(
    seed,
    [damaged, skyblazer, candidate],
    [wall(`skyblazer-random-wall-${golden}`, 1, 1)],
  );
  const attackGain = golden ? 6 : 3;
  const healthGain = golden ? 4 : 2;
  const persistedDamaged = permanentMinion(state, damaged.instanceId);
  assert.deepEqual(
    [persistedDamaged.attack, persistedDamaged.health],
    [damaged.attack, damaged.health],
  );

  const eligible = [skyblazer, candidate];
  const winners = eligible.filter((original) => {
    const persisted = permanentMinion(state, original.instanceId);
    return (
      persisted.attack === original.attack + attackGain &&
      persisted.health === original.health + healthGain
    );
  });
  assert.equal(winners.length, 1);
  const loser = eligible.find(
    (original) => original.instanceId !== winners[0].instanceId,
  );
  assert.ok(loser);
  assert.deepEqual(
    [
      permanentMinion(state, loser.instanceId).attack,
      permanentMinion(state, loser.instanceId).health,
    ],
    [loser.attack, loser.health],
  );
  return { winnerId: winners[0].instanceId, state };
}

test("Skyblazer excludes the wounded Beast, chooses deterministically, and writes normal and Golden buffs back", () => {
  for (const golden of [false, true]) {
    const first = runDeterministicSkyblazer(
      0xb29810 + Number(golden),
      golden,
    );
    const second = runDeterministicSkyblazer(
      0xb29810 + Number(golden),
      golden,
    );
    assert.equal(first.winnerId, second.winnerId);
  }
});

test("a Skyblazer buff on an in-combat hand copy never changes the original hand card", () => {
  const skyblazer = definitionMinion("BG29_806", "token-skyblazer", {
    attack: 3,
    health: 50,
  });
  const handBeast = definitionMinion(
    "BG32_330",
    "skyblazer-hand-beast",
    {
      tribe: "beast",
      tribes: ["beast"],
      attack: 0,
      health: 50,
    },
  );
  const { state, battle } = runCombat(
    0xb29820,
    [skyblazer],
    [wall("token-skyblazer-wall", 1, 1)],
    (_state, human) => {
      human.hand = [handBeast];
    },
  );

  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "inHandStartOfCombat",
  );
  assert.ok(summon?.targetInstanceId);
  const tokenBuff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === skyblazer.instanceId &&
      event.targetInstanceId === summon.targetInstanceId,
  );
  assert.ok(tokenBuff);
  assert.deepEqual(
    [tokenBuff.attackDelta, tokenBuff.healthDelta],
    [3, 2],
  );
  assert.notEqual(tokenBuff.permanentEffectImprovement, true);

  const original = humanPlayer(state).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.instanceId === handBeast.instanceId,
  );
  assert.ok(original);
  assert.deepEqual(
    [original.attack, original.health],
    [handBeast.attack, handBeast.health],
  );
});

test("ghost damage observers animate their combat copies without any permanent writeback", () => {
  const state = createGame(0xb29830);
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
    player.board = [wall(`beast-ghost-opponent-${index}`, 100, 2)];
  }

  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.freeRefreshes = 5;
  const wingman = definitionMinion("BG35_601", "ghost-wingman", {
    attack: 0,
    health: 50,
  });
  const trigore = definitionMinion("BG29_807", "ghost-trigore", {
    attack: 0,
    health: 50,
  });
  const skyblazer = definitionMinion("BG29_806", "ghost-skyblazer", {
    attack: 0,
    health: 50,
  });
  const target = beast("ghost-damaged-beast");
  ghost.board = [
    bomber("ghost-beast-bomber"),
    wingman,
    trigore,
    skyblazer,
    target,
  ];
  const boardBefore = structuredClone(ghost.board);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.equal(nextGhost.freeRefreshes, 5);
  assert.deepEqual(nextGhost.board, boardBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "damage" &&
        event.targetInstanceId === wingman.instanceId,
    ),
  );
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "buff" &&
        (event.actorInstanceId === trigore.instanceId ||
          event.actorInstanceId === skyblazer.instanceId),
    ),
  );
});

test("AI values Banana Slamma above a same-stat Beast when combat summons can use its multiplier", () => {
  const state = createGame(0xb29a01);
  const player = state.players[1];
  player.board = [beast("ai-beast-summoner")];
  const candidate = definitionMinion("BG26_802", "ai-banana-slamma");
  const sameStatBeast = definitionMinion(
    "live-beetle-token",
    "ai-same-stat-beast",
    {
      tier: candidate.tier,
      attack: candidate.attack,
      health: candidate.health,
    },
  );

  assert.ok(
    scoreMinionForAi(player, candidate) >
      scoreMinionForAi(player, sameStatBeast),
  );
});
