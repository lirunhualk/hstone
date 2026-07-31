import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  scoreMinionForAi,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V37,
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
    tribe: "neutral",
    tribes: [],
    taunt: false,
    divineShield: false,
    reborn: false,
    ...overrides,
  });
}

function demon(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return inertMinion(instanceId, {
    tribe: "demon",
    tribes: ["demon"],
    ...overrides,
  });
}

function wall(
  instanceId: string,
  attack: number,
  health: number,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return inertMinion(instanceId, {
    attack,
    health,
    taunt: true,
    ...overrides,
  });
}

function bomber(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("BG_DAL_775", instanceId, {
    attack: 0,
    health: 1,
    taunt: true,
    tribe: "demon",
    tribes: ["demon"],
    ...overrides,
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

function handMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const card = humanPlayer(state).hand.find(
    (candidate): candidate is BoardMinionInstance =>
      candidate.kind === "minion" && candidate.instanceId === instanceId,
  );
  assert.ok(card);
  return card;
}

test("maps exact fixed-build normal and Golden metadata for the three v38 minions", () => {
  const cases = [
    {
      id: "BG33_155",
      name: "虔诚的萨特唤魔者",
      tier: 4,
      tribe: "demon",
      attack: 2,
      health: 2,
      goldenCardId: "BG33_155_G",
      description: "在另一个友方恶魔造成伤害后，永久获得+1/+2。",
      goldenDescription:
        "在另一个友方恶魔造成伤害后，永久获得+2/+4。",
      rule: {
        tribe: "demon",
        otherSourceOnly: true,
        target: "self",
        attack: 1,
        health: 2,
        permanent: true,
      },
    },
    {
      id: "BG33_154",
      name: "废墟领主",
      tier: 6,
      tribe: "demon",
      attack: 5,
      health: 6,
      goldenCardId: "BG33_154_G",
      description:
        "在一个友方恶魔造成伤害后，使其之外的友方随从获得+2/+1。",
      goldenDescription:
        "在一个友方恶魔造成伤害后，使其之外的友方随从获得+4/+2。",
      rule: {
        tribe: "demon",
        target: "allFriendlyExceptSource",
        attack: 2,
        health: 1,
      },
    },
    {
      id: "BG35_602",
      name: "深潜巨兽",
      tier: 5,
      tribe: "beast",
      attack: 3,
      health: 8,
      goldenCardId: "BG35_602_G",
      description:
        "每当你召唤野兽时，使其获得+2攻击力并永久提升此效果。",
      goldenDescription:
        "每当你召唤野兽时，使其获得+4攻击力并永久提升此效果。",
      rule: {
        tribe: "beast",
        attack: 2,
        permanentAttackGrowth: 1,
      },
    },
  ] as const;

  for (const expected of cases) {
    const definition = getMinionDefinition(expected.id);
    assert.deepEqual(
      {
        name: definition.name,
        tier: definition.tier,
        tribe: definition.tribe,
        tribes: definition.tribes,
        attack: definition.attack,
        health: definition.health,
        effectSupport: definition.effectSupport,
        printedMechanics: definition.printedMechanics,
        legendary: definition.legendary,
        goldenCardId: definition.goldenCardId,
        description: definition.description,
        goldenDescription: definition.goldenDescription,
        rule:
          definition.afterFriendlyDealsDamage ??
          definition.afterFriendlySummoned,
      },
      {
        name: expected.name,
        tier: expected.tier,
        tribe: expected.tribe,
        tribes: [expected.tribe],
        attack: expected.attack,
        health: expected.health,
        effectSupport: "complete",
        printedMechanics: ["TRIGGER_VISUAL"],
        legendary: false,
        goldenCardId: expected.goldenCardId,
        description: expected.description,
        goldenDescription: expected.goldenDescription,
        rule: expected.rule,
      },
    );

    const golden = goldenMinion(
      expected.id,
      `metadata-golden-${expected.id}`,
    );
    assert.deepEqual(
      [
        golden.cardId,
        golden.attack,
        golden.health,
        golden.description,
        golden.effectSupport,
      ],
      [
        expected.goldenCardId,
        expected.attack * 2,
        expected.health * 2,
        expected.goldenDescription,
        "complete",
      ],
    );
  }
});

test("Divine Shield prevents Satyr and Ruin Lord from observing zero real damage", () => {
  const source = demon("shield-demon-source", {
    attack: 1,
    health: 1,
  });
  const satyr = definitionMinion("BG33_155", "shield-satyr", {
    attack: 0,
    health: 100,
  });
  const ruin = definitionMinion("BG33_154", "shield-ruin", {
    attack: 0,
    health: 100,
  });
  const enemy = wall("shield-enemy", 100, 100, {
    divineShield: true,
  });
  const { state, battle } = runCombat(
    0x381001,
    [source, satyr, ruin],
    [enemy],
  );

  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "shieldBroken" &&
        event.targetInstanceId === enemy.instanceId,
    ),
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        (event.actorInstanceId === satyr.instanceId ||
          event.actorInstanceId === ruin.instanceId),
    ),
    false,
  );
  assert.deepEqual(
    [
      permanentMinion(state, satyr.instanceId).attack,
      permanentMinion(state, satyr.instanceId).health,
    ],
    [satyr.attack, satyr.health],
  );
});

test("real Demon damage applies exact ordinary and Golden Satyr and Ruin Lord vectors", () => {
  for (const golden of [false, true]) {
    const source = demon(`real-damage-source-${golden}`, {
      attack: 1,
      health: 100,
    });
    const satyr = golden
      ? goldenMinion("BG33_155", `real-damage-satyr-${golden}`, {
          attack: 0,
          health: 100,
        })
      : definitionMinion("BG33_155", `real-damage-satyr-${golden}`, {
          attack: 0,
          health: 100,
        });
    const ruin = golden
      ? goldenMinion("BG33_154", `real-damage-ruin-${golden}`, {
          attack: 0,
          health: 100,
        })
      : definitionMinion("BG33_154", `real-damage-ruin-${golden}`, {
          attack: 0,
          health: 100,
        });
    const { state, battle } = runCombat(
      0x381010 + Number(golden),
      [source, satyr, ruin],
      [wall(`real-damage-wall-${golden}`, 0, 1)],
    );
    const satyrVector = golden ? [2, 4] : [1, 2];
    const ruinVector = golden ? [4, 2] : [2, 1];
    const sourceDamage = battle.events.filter(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.equal(sourceDamage.length, 1);

    const satyrBuff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === satyr.instanceId &&
        event.targetInstanceId === satyr.instanceId,
    );
    assert.ok(satyrBuff);
    assert.deepEqual(
      [satyrBuff.attackDelta, satyrBuff.healthDelta],
      satyrVector,
    );
    assert.equal(satyrBuff.retained, true);

    const ruinBuffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === ruin.instanceId,
    );
    assert.deepEqual(
      ruinBuffs.map((event) => event.targetInstanceId),
      [satyr.instanceId, ruin.instanceId],
    );
    assert.ok(
      ruinBuffs.every(
        (event) =>
          event.attackDelta === ruinVector[0] &&
          event.healthDelta === ruinVector[1],
      ),
    );
    assert.equal(
      ruinBuffs.some(
        (event) => event.targetInstanceId === source.instanceId,
      ),
      false,
    );

    const persistedSatyr = permanentMinion(state, satyr.instanceId);
    assert.deepEqual(
      [persistedSatyr.attack, persistedSatyr.health],
      [satyr.attack + satyrVector[0], satyr.health + satyrVector[1]],
    );
    assert.deepEqual(
      [
        permanentMinion(state, source.instanceId).attack,
        permanentMinion(state, source.instanceId).health,
        permanentMinion(state, ruin.instanceId).attack,
        permanentMinion(state, ruin.instanceId).health,
      ],
      [source.attack, source.health, ruin.attack, ruin.health],
    );
  }
});

test("Satyr excludes damage it deals itself while Ruin Lord observes its own damage", () => {
  {
    const satyr = definitionMinion("BG33_155", "self-source-satyr", {
      attack: 1,
      health: 100,
    });
    const { state, battle } = runCombat(
      0x381020,
      [satyr, inertMinion("self-source-satyr-filler")],
      [wall("self-source-satyr-wall", 0, 1)],
    );
    assert.equal(
      battle.events.some(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === satyr.instanceId,
      ),
      false,
    );
    assert.deepEqual(
      [
        permanentMinion(state, satyr.instanceId).attack,
        permanentMinion(state, satyr.instanceId).health,
      ],
      [satyr.attack, satyr.health],
    );
  }

  {
    const ruin = definitionMinion("BG33_154", "self-source-ruin", {
      attack: 1,
      health: 100,
    });
    const ally = inertMinion("self-source-ruin-ally");
    const { state, battle } = runCombat(
      0x381021,
      [ruin, ally],
      [wall("self-source-ruin-wall", 0, 1)],
    );
    const buffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === ruin.instanceId,
    );
    assert.deepEqual(
      buffs.map((event) => [
        event.targetInstanceId,
        event.attackDelta,
        event.healthDelta,
      ]),
      [[ally.instanceId, 2, 1]],
    );
    assert.deepEqual(
      [
        permanentMinion(state, ally.instanceId).attack,
        permanentMinion(state, ally.instanceId).health,
      ],
      [ally.attack, ally.health],
    );
  }
});

test("a Demon killed by Poisonous retaliation still triggers observers but cannot be revived", () => {
  const source = demon("poisoned-demon-source", {
    attack: 1,
    health: 1,
  });
  const satyr = definitionMinion("BG33_155", "poisoned-source-satyr", {
    attack: 0,
    health: 100,
  });
  const ruin = definitionMinion("BG33_154", "poisoned-source-ruin", {
    attack: 0,
    health: 100,
  });
  const poisonedWall = wall("poisonous-retaliator", 1, 1, {
    poisonous: true,
  });
  const { state, battle } = runCombat(
    0x381030,
    [source, satyr, ruin],
    [poisonedWall],
  );

  const observerBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      (event.actorInstanceId === satyr.instanceId ||
        event.actorInstanceId === ruin.instanceId),
  );
  assert.ok(observerBuffs.length >= 3);
  const sourceDeath = battle.events.find(
    (event) =>
      event.type === "death" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.ok(sourceDeath);
  assert.ok(observerBuffs.every((event) => event.index < sourceDeath.index));
  assert.equal(
    observerBuffs.some(
      (event) => event.targetInstanceId === source.instanceId,
    ),
    false,
  );
  assert.deepEqual(
    [
      permanentMinion(state, satyr.instanceId).attack,
      permanentMinion(state, satyr.instanceId).health,
    ],
    [satyr.attack + 1, satyr.health + 2],
  );
});

test("Cleave deals its whole wave before three Satyr and Ruin Lord observations resolve", () => {
  const source = demon("cleave-demon-source", {
    attack: 1,
    health: 100,
    cleave: true,
  });
  const satyr = definitionMinion("BG33_155", "cleave-satyr", {
    attack: 0,
    health: 100,
  });
  const ruin = definitionMinion("BG33_154", "cleave-ruin", {
    attack: 0,
    health: 100,
  });
  const ally = inertMinion("cleave-ally");
  const left = wall("cleave-left", 0, 1, { taunt: false });
  const center = wall("cleave-center", 0, 1);
  const right = wall("cleave-right", 0, 1, { taunt: false });
  const { state, battle } = runCombat(
    0x381040,
    [source, satyr, ruin, ally],
    [left, center, right],
    (state) => {
      const opponent = state.players.find(
        (player) => player.id !== state.humanPlayerId && player.alive,
      );
      assert.ok(opponent);
      opponent.isHuman = true;
    },
  );

  const damages = battle.events.filter(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.deepEqual(
    damages.map((event) => event.targetInstanceId),
    [center.instanceId, left.instanceId, right.instanceId],
  );
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      (event.actorInstanceId === satyr.instanceId ||
        event.actorInstanceId === ruin.instanceId),
  );
  assert.equal(
    buffs.filter(
      (event) => event.actorInstanceId === satyr.instanceId,
    ).length,
    3,
  );
  assert.ok(
    Math.max(...damages.map((event) => event.index)) <
      Math.min(...buffs.map((event) => event.index)),
  );
  assert.deepEqual(
    [
      permanentMinion(state, satyr.instanceId).attack,
      permanentMinion(state, satyr.instanceId).health,
    ],
    [satyr.attack + 3, satyr.health + 6],
  );
  assert.equal(
    buffs.some(
      (event) => event.targetInstanceId === source.instanceId,
    ),
    false,
  );
  assert.equal(
    buffs.filter(
      (event) =>
        event.actorInstanceId === ruin.instanceId &&
        event.targetInstanceId === ally.instanceId,
    ).length,
    3,
  );
});

test("AOE Demon damage is observed once per actually damaged minion after the whole wave", () => {
  const source = bomber("aoe-demon-source");
  const satyr = definitionMinion("BG33_155", "aoe-satyr", {
    attack: 0,
    health: 100,
  });
  const ruin = definitionMinion("BG33_154", "aoe-ruin", {
    attack: 0,
    health: 100,
  });
  const enemy = wall("aoe-wall", 100, 3);
  const { state, battle } = runCombat(
    0x381050,
    [source, satyr, ruin],
    [enemy],
  );

  const aoeDamage = battle.events.filter(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.deepEqual(
    new Set(aoeDamage.map((event) => event.targetInstanceId)),
    new Set([satyr.instanceId, ruin.instanceId, enemy.instanceId]),
  );
  const observerBuffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      (event.actorInstanceId === satyr.instanceId ||
        event.actorInstanceId === ruin.instanceId),
  );
  assert.ok(
    Math.max(...aoeDamage.map((event) => event.index)) <
      Math.min(...observerBuffs.map((event) => event.index)),
  );
  assert.equal(
    observerBuffs.filter(
      (event) => event.actorInstanceId === satyr.instanceId,
    ).length,
    3,
  );
  assert.deepEqual(
    [
      permanentMinion(state, satyr.instanceId).attack,
      permanentMinion(state, satyr.instanceId).health,
    ],
    [satyr.attack + 3, satyr.health + 6],
  );
});

test("Tarecgosa and Poet retain Ruin Lord buffs while ordinary allies do not", () => {
  const source = demon("retention-demon-source", {
    attack: 1,
    health: 100,
  });
  const tarecgosa = definitionMinion("BG21_015", "retention-tarecgosa");
  const ordinary = inertMinion("retention-ordinary");
  const poet = definitionMinion("BG29_813", "retention-poet", {
    attack: 0,
    health: 100,
  });
  const dragon = definitionMinion("BG34_636t", "retention-dragon", {
    attack: 0,
    health: 100,
  });
  const ruin = definitionMinion("BG33_154", "retention-ruin", {
    attack: 0,
    health: 100,
  });
  const { state, battle } = runCombat(
    0x381060,
    [source, tarecgosa, ordinary, poet, dragon, ruin],
    [wall("retention-wall", 0, 1)],
  );

  for (const retained of [tarecgosa, dragon]) {
    const persistent = permanentMinion(state, retained.instanceId);
    assert.deepEqual(
      [persistent.attack, persistent.health],
      [retained.attack + 2, retained.health + 1],
    );
    assert.ok(
      battle.events.some(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === ruin.instanceId &&
          event.targetInstanceId === retained.instanceId &&
          event.retained === true,
      ),
    );
  }
  for (const temporary of [ordinary, poet, ruin]) {
    const persistent = permanentMinion(state, temporary.instanceId);
    assert.deepEqual(
      [persistent.attack, persistent.health],
      [temporary.attack, temporary.health],
    );
  }
  assert.deepEqual(
    [
      permanentMinion(state, source.instanceId).attack,
      permanentMinion(state, source.instanceId).health,
    ],
    [source.attack, source.health],
  );
});

test("Golden Poet retains only Ruin Lord's temporary vector and never doubles Satyr's explicit permanent gain", () => {
  const source = demon("explicit-permanent-source", {
    attack: 1,
    health: 100,
  });
  const satyr = definitionMinion("BG33_155", "explicit-permanent-satyr", {
    attack: 0,
    health: 100,
    tribes: ["demon", "dragon"],
  });
  const poet = goldenMinion("BG29_813", "explicit-permanent-poet", {
    attack: 0,
    health: 100,
  });
  const ruin = definitionMinion("BG33_154", "explicit-permanent-ruin", {
    attack: 0,
    health: 100,
  });
  const { state } = runCombat(
    0x381061,
    [source, satyr, poet, ruin],
    [wall("explicit-permanent-wall", 0, 1)],
  );
  const persisted = permanentMinion(state, satyr.instanceId);

  // +1/+2 is the Satyr's explicit permanent gain. Golden Poet separately
  // retains twice the Ruin Lord's temporary +2/+1.
  assert.deepEqual(
    [persisted.attack, persisted.health],
    [satyr.attack + 1 + 4, satyr.health + 2 + 2],
  );
});

test("Deepsea Recruit summons use +2,+3 then +4,+6 and refresh the next dynamic value", () => {
  for (const golden of [false, true]) {
    let state = createGame(0x382000 + Number(golden));
    let human = humanPlayer(state);
    const deepsea = golden
      ? goldenMinion("BG35_602", `recruit-deepsea-${golden}`)
      : definitionMinion("BG35_602", `recruit-deepsea-${golden}`);
    const alleycat = definitionMinion(
      "alleycat",
      `recruit-alleycat-${golden}`,
    );
    human.board = [deepsea];
    human.hand = [alleycat];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    human = humanPlayer(state);
    const played = human.board.find(
      (minion) => minion.instanceId === alleycat.instanceId,
    );
    const token = human.board.find(
      (minion) => minion.definitionId === "tabbycat-token",
    );
    assert.ok(played);
    assert.ok(token);
    const first = golden ? 4 : 2;
    const second = golden ? 6 : 3;
    assert.deepEqual(
      [played.attack, token.attack],
      [alleycat.attack + first, 1 + second],
    );
    const persistedSource = human.board.find(
      (minion) => minion.instanceId === deepsea.instanceId,
    );
    assert.ok(persistedSource);
    assert.deepEqual(persistedSource.effectCounters, {
      summonAttackGrowth: golden ? 4 : 2,
    });
    assert.match(
      persistedSource.description,
      new RegExp(`\\+${golden ? 8 : 4}攻击力`),
    );
  }
});

test("a failed full-board Battlecry summon does not grow Deepsea a second time", () => {
  let state = createGame(0x382010);
  let human = humanPlayer(state);
  const deepsea = definitionMinion("BG35_602", "full-board-deepsea");
  const alleycat = definitionMinion("alleycat", "full-board-alleycat");
  human.board = [
    deepsea,
    ...Array.from({ length: 5 }, (_, index) =>
      goldenMinion(
        "annihilan-battlemaster",
        `full-board-filler-${index}`,
        { attack: 0, health: 100 },
      ),
    ),
  ];
  human.hand = [alleycat];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  assert.equal(human.board.length, 7);
  assert.equal(
    human.board.some(
      (minion) => minion.definitionId === "tabbycat-token",
    ),
    false,
  );
  const source = human.board.find(
    (minion) => minion.instanceId === deepsea.instanceId,
  );
  assert.ok(source);
  assert.deepEqual(source.effectCounters, { summonAttackGrowth: 1 });
  assert.match(source.description, /\+3攻击力/u);
});

test("multiple Deepseas buff in board order and keep independent Recruit growth", () => {
  let state = createGame(0x382020);
  let human = humanPlayer(state);
  const ordinary = definitionMinion("BG35_602", "ordered-deepsea-normal");
  const golden = goldenMinion("BG35_602", "ordered-deepsea-golden");
  const playedBeast = definitionMinion("BG31_803", "ordered-played-beast");
  human.board = [ordinary, golden];
  human.hand = [playedBeast];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const played = human.board.find(
    (minion) => minion.instanceId === playedBeast.instanceId,
  );
  assert.ok(played);
  assert.equal(played.attack, playedBeast.attack + 2 + 4);
  const ordinaryAfter = human.board.find(
    (minion) => minion.instanceId === ordinary.instanceId,
  );
  const goldenAfter = human.board.find(
    (minion) => minion.instanceId === golden.instanceId,
  );
  assert.ok(ordinaryAfter);
  assert.ok(goldenAfter);
  assert.deepEqual(ordinaryAfter.effectCounters, {
    summonAttackGrowth: 1,
  });
  assert.deepEqual(goldenAfter.effectCounters, {
    summonAttackGrowth: 2,
  });
  assert.match(ordinaryAfter.description, /\+3攻击力/u);
  assert.match(goldenAfter.description, /\+6攻击力/u);
});

test("combat Beast summons animate their raw snapshot, receive Deepsea growth, and improve the original source", () => {
  for (const golden of [false, true]) {
    const summoner = definitionMinion(
      "BG31_803",
      `combat-deepsea-summoner-${golden}`,
    );
    const deepsea = golden
      ? goldenMinion("BG35_602", `combat-deepsea-${golden}`, {
          attack: 0,
          health: 100,
        })
      : definitionMinion("BG35_602", `combat-deepsea-${golden}`, {
          attack: 0,
          health: 100,
        });
    const { state, battle } = runCombat(
      0x382030 + Number(golden),
      [summoner, deepsea],
      [wall(`combat-deepsea-wall-${golden}`, 100, 100)],
    );
    const summon = battle.events.find(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-beetle-token",
    );
    assert.ok(summon?.targetInstanceId);
    assert.equal(summon.minion?.attack, 2);
    const buff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === deepsea.instanceId &&
        event.targetInstanceId === summon.targetInstanceId,
    );
    assert.ok(buff);
    assert.ok(summon.index < buff.index);
    assert.deepEqual(
      [buff.attackDelta, buff.healthDelta, buff.minion?.attack],
      [golden ? 4 : 2, 0, golden ? 6 : 4],
    );
    const trigger = battle.events.find(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === deepsea.instanceId &&
        event.index > buff.index,
    );
    assert.ok(trigger);
    assert.equal(trigger.amount, golden ? 6 : 3);
    assert.equal(trigger.permanentEffectImprovement, true);

    const persisted = permanentMinion(state, deepsea.instanceId);
    assert.deepEqual(persisted.effectCounters, {
      summonAttackGrowth: golden ? 2 : 1,
    });
    assert.match(
      persisted.description,
      new RegExp(`\\+${golden ? 6 : 3}攻击力`),
    );
  }
});

test("multiple combat Deepseas resolve in board order with separate normal and Golden counters", () => {
  const summoner = definitionMinion("BG31_803", "combat-order-summoner");
  const ordinary = definitionMinion("BG35_602", "combat-order-normal", {
    attack: 0,
    health: 100,
  });
  const golden = goldenMinion("BG35_602", "combat-order-golden", {
    attack: 0,
    health: 100,
  });
  const { state, battle } = runCombat(
    0x382040,
    [summoner, ordinary, golden],
    [wall("combat-order-wall", 100, 100)],
  );
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.ok(summon?.targetInstanceId);
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
      event.minion?.attack,
    ]),
    [
      [ordinary.instanceId, 2, 4],
      [golden.instanceId, 4, 8],
    ],
  );
  assert.deepEqual(
    permanentMinion(state, ordinary.instanceId).effectCounters,
    { summonAttackGrowth: 1 },
  );
  assert.deepEqual(
    permanentMinion(state, golden.instanceId).effectCounters,
    { summonAttackGrowth: 2 },
  );
});

test("tripling Deepseas merges all prior growth and Golden continues from the summed value", () => {
  let state = createGame(0x382050);
  let human = humanPlayer(state);
  human.board = [];
  human.hand = [
    definitionMinion("BG35_602", "triple-deepsea-a", {
      effectCounters: { summonAttackGrowth: 1 },
    }),
    definitionMinion("BG35_602", "triple-deepsea-b", {
      effectCounters: { summonAttackGrowth: 2 },
    }),
    definitionMinion("BG35_602", "triple-deepsea-c", {
      effectCounters: { summonAttackGrowth: 3 },
    }),
  ];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const golden = human.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG35_602" &&
      card.golden,
  );
  assert.ok(golden);
  assert.deepEqual(golden.effectCounters, { summonAttackGrowth: 6 });
  assert.match(golden.description, /\+10攻击力/u);

  const summoned = definitionMinion("BG31_803", "triple-deepsea-beast");
  human.board = [golden];
  human.hand = [summoned];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const summonedAfter = human.board.find(
    (minion) => minion.instanceId === summoned.instanceId,
  );
  const goldenAfter = human.board.find(
    (minion) => minion.instanceId === golden.instanceId,
  );
  assert.ok(summonedAfter);
  assert.ok(goldenAfter);
  assert.equal(summonedAfter.attack, summoned.attack + 10);
  assert.deepEqual(goldenAfter.effectCounters, {
    summonAttackGrowth: 8,
  });
  assert.match(goldenAfter.description, /\+12攻击力/u);
});

test("a Rally-created temporary Deepsea improves only its combat copy", () => {
  const aviator = definitionMinion("BG34_140", "temporary-deepsea-aviator", {
    attack: 1,
    health: 1,
  });
  const summoner = definitionMinion(
    "BG31_803",
    "temporary-deepsea-summoner",
  );
  const heldDeepsea = definitionMinion(
    "BG35_602",
    "temporary-held-deepsea",
  );
  const { state, battle } = runCombat(
    0x382060,
    [aviator, summoner],
    [wall("temporary-deepsea-wall", 100, 100)],
    (_state, human) => {
      human.hand = [heldDeepsea];
    },
  );
  const temporarySummon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === aviator.instanceId &&
      event.summonReason === "rallyFromHand" &&
      event.minion?.definitionId === "BG35_602",
  );
  assert.ok(temporarySummon?.targetInstanceId);
  const beetleSummon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.ok(beetleSummon?.targetInstanceId);
  const combatOnlyTrigger = battle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === temporarySummon.targetInstanceId &&
      event.index > beetleSummon.index,
  );
  assert.ok(combatOnlyTrigger);
  assert.equal(combatOnlyTrigger.amount, 3);
  assert.equal(combatOnlyTrigger.permanentEffectImprovement, false);

  const original = handMinion(state, heldDeepsea.instanceId);
  assert.deepEqual(original.effectCounters, {});
  assert.equal(
    original.description,
    getMinionDefinition("BG35_602").description,
  );
});

test("ghost Satyr, Ruin Lord, and Deepsea animate without mutating the eliminated owner", () => {
  const state = createGame(0x382070);
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
    player.board = [wall(`v38-ghost-opponent-${index}`, 100, 100)];
  }

  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const ghostBomber = bomber("ghost-demon-bomber");
  const ghostSatyr = definitionMinion("BG33_155", "ghost-satyr", {
    attack: 0,
    health: 100,
  });
  const ghostRuin = definitionMinion("BG33_154", "ghost-ruin", {
    attack: 0,
    health: 100,
  });
  const ghostSummoner = definitionMinion("BG31_803", "ghost-summoner");
  const ghostDeepsea = definitionMinion("BG35_602", "ghost-deepsea", {
    attack: 0,
    health: 100,
  });
  ghost.board = [
    ghostBomber,
    ghostSatyr,
    ghostRuin,
    ghostSummoner,
    ghostDeepsea,
  ];
  const boardBefore = structuredClone(ghost.board);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(combat.players[3].board, boardBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.ok(
    ghostBattle.events.some(
      (event) =>
        event.type === "buff" &&
        (event.actorInstanceId === ghostSatyr.instanceId ||
          event.actorInstanceId === ghostRuin.instanceId),
    ),
  );
  const deepseaTrigger = ghostBattle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === ghostDeepsea.instanceId,
  );
  assert.ok(deepseaTrigger);
  assert.equal(deepseaTrigger.amount, 3);
  assert.equal(deepseaTrigger.permanentEffectImprovement, false);
});

test("AI values Demon damage observers and Deepsea when their tribes can trigger", () => {
  const state = createGame(0x382080);
  const base = state.players[1];
  const demonPlayer = structuredClone(base);
  const neutralPlayer = structuredClone(base);
  demonPlayer.board = [demon("ai-demon-source", { attack: 5, health: 5 })];
  neutralPlayer.board = [
    inertMinion("ai-neutral-source", { attack: 5, health: 5 }),
  ];

  for (const id of ["BG33_155", "BG33_154"] as const) {
    const candidate = definitionMinion(id, `ai-${id}`);
    assert.ok(
      scoreMinionForAi(demonPlayer, candidate) >
        scoreMinionForAi(neutralPlayer, candidate),
      `${id} should value a real Demon damage source`,
    );
  }

  const summonPlayer = structuredClone(base);
  const noSummonPlayer = structuredClone(base);
  const summoner = goldenMinion("BG31_803", "ai-beast-summoner");
  summonPlayer.board = [summoner];
  noSummonPlayer.board = [
    inertMinion("ai-no-summon-beast", {
      tribe: "beast",
      tribes: ["beast"],
      attack: summoner.attack,
      health: summoner.health,
      taunt: summoner.taunt,
    }),
  ];
  const deepsea = definitionMinion("BG35_602", "ai-deepsea");
  assert.ok(
    scoreMinionForAi(summonPlayer, deepsea) >
      scoreMinionForAi(noSummonPlayer, deepsea),
  );
});

test("v37 saves preserve Deepsea growth while refreshing v38 Golden metadata and dynamic text", () => {
  const legacy = structuredClone(createGame(0x382090));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V37;
  const stale = goldenMinion("BG35_602", "legacy-golden-deepsea", {
    cardId: "BG35_602",
    effectSupport: "partial",
    description: "旧版动态说明",
    attack: 61,
    health: 67,
    effectCounters: {
      summonAttackGrowth: 6,
      existingCounter: 11,
    },
  });
  humanPlayer(legacy).board = [stale];

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  );
  assert.ok(migrated);
  const migratedState = migrated as GameState;
  const deepsea = permanentMinion(migratedState, stale.instanceId);
  assert.equal(CURRENT_ROSTER_VERSION, "battlegrounds-36.0.3-247416-v38");
  assert.equal(migratedState.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(deepsea.cardId, "BG35_602_G");
  assert.equal(deepsea.effectSupport, "complete");
  assert.deepEqual([deepsea.attack, deepsea.health], [61, 67]);
  assert.deepEqual(deepsea.effectCounters, {
    summonAttackGrowth: 6,
    existingCounter: 11,
  });
  assert.equal(
    deepsea.description,
    "每当你召唤野兽时，使其获得+10攻击力并永久提升此效果。",
  );
  assert.deepEqual(
    normalizePersistedGameState(
      JSON.parse(JSON.stringify(migratedState)),
    ),
    migratedState,
  );
});
