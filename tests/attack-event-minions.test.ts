import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  planAiBoardOrder,
  scoreMinionForAi,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V29,
  normalizePersistedGameState,
} from "../lib/game/save.ts";
import type { BattleEvent, BattleSummary } from "../lib/game/types.ts";

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

function inertMinion(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("annihilan-battlemaster", instanceId, {
    attack: 0,
    health: 40,
    taunt: false,
    divineShield: false,
    reborn: false,
    ...overrides,
  });
}

function wall(
  instanceId: string,
  health: number,
  attack = 0,
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
): { state: GameState; battle: BattleSummary; humanId: string; enemyId: string } {
  const state = createGame(seed);
  const human = humanPlayer(state);
  const enemy = state.players.find(
    (player) => player.id !== human.id,
  );
  assert.ok(enemy);

  for (const player of state.players) {
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.board = [];
    player.health = 100;
    player.armor = 0;
    player.alive = player.id === human.id || player.id === enemy.id;
    player.eliminatedRound = player.alive ? undefined : state.round;
  }
  human.board = humanBoard;
  enemy.board = enemyBoard;
  configure?.(state, human);

  const next = gameReducer(state, { type: "END_TURN" });
  assert.ok(next.lastBattle);
  return {
    state: next,
    battle: next.lastBattle,
    humanId: human.id,
    enemyId: enemy.id,
  };
}

function strikeWindow(
  battle: BattleSummary,
  actorInstanceId: string,
): BattleEvent[] {
  const start = battle.events.findIndex(
    (event) =>
      event.type === "attack" &&
      event.actorInstanceId === actorInstanceId,
  );
  assert.ok(start >= 0);
  const nextAttack = battle.events.findIndex(
    (event, index) => index > start && event.type === "attack",
  );
  return battle.events.slice(
    start,
    nextAttack >= 0 ? nextAttack : battle.events.length,
  );
}

test("the five attack-event minions map the exact fixed-build normal and Golden rules", () => {
  const rallier = getMinionDefinition("BG29_816");
  assert.deepEqual(
    [
      rallier.effectSupport,
      rallier.goldenCardId,
      rallier.afterFriendlyAttacks,
    ],
    [
      "complete",
      "BG29_816_G",
      [
        {
          kind: "buffAttacker",
          tribe: "dragon",
          otherOnly: true,
          attack: 3,
          health: 1,
          goldenMode: "doubleStats",
        },
      ],
    ],
  );

  const wildfire = getMinionDefinition("BGS_126");
  assert.deepEqual(
    [
      wildfire.effectSupport,
      wildfire.goldenCardId,
      wildfire.afterAttackKills,
    ],
    [
      "complete",
      "TB_BaconUps_166",
      {
        kind: "excessDamageToAdjacent",
        goldenMode: "bothAdjacent",
      },
    ],
  );

  const macaw = getMinionDefinition("BGS_078");
  assert.deepEqual(
    [macaw.effectSupport, macaw.goldenCardId, macaw.rally],
    [
      "complete",
      "TB_BaconUps_135",
      [
        {
          kind: "triggerLeftmostDeathrattle",
          goldenMode: "repeat",
        },
      ],
    ],
  );

  const charmwing = getMinionDefinition("BG33_240");
  assert.deepEqual(
    [
      charmwing.effectSupport,
      charmwing.goldenCardId,
      charmwing.rally,
    ],
    [
      "complete",
      "BG33_240_G",
      [
        {
          kind: "grantSourceMaxHealth",
          target: "otherFriendlyTribe",
          tribe: "dragon",
          count: 2,
          goldenMode: "repeat",
        },
      ],
    ],
  );

  const ringWarden = getMinionDefinition("BG34_921");
  assert.deepEqual(
    [
      ringWarden.effectSupport,
      ringWarden.goldenCardId,
      ringWarden.afterFriendlyAttacks,
    ],
    [
      "complete",
      "BG34_921_G",
      [
        {
          kind: "castTavernSpell",
          definitionId: "tavern-spell-shiny-ring",
          goldenMode: "repeat",
        },
      ],
    ],
  );
});

test("Roaring Ralliers stack before damage on every Windfury strike", () => {
  const dragon = definitionMinion("BG34_636t", "rallier-dragon", {
    attack: 1,
    health: 10,
    windfury: true,
  });
  const ordinary = definitionMinion("BG29_816", "rallier-normal");
  const golden = goldenMinion("BG29_816", "rallier-golden");
  const { battle } = runCombat(
    0x8301,
    [dragon, ordinary, golden],
    [wall("rallier-wall", 29)],
  );

  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === dragon.instanceId &&
      (event.actorInstanceId === ordinary.instanceId ||
        event.actorInstanceId === golden.instanceId),
  );
  assert.deepEqual(
    buffs.map((event) => [event.attackDelta, event.healthDelta]),
    [
      [3, 1],
      [6, 2],
      [3, 1],
      [6, 2],
    ],
  );
  for (const buff of buffs) {
    const buffIndex = battle.events.indexOf(buff);
    const trigger = battle.events[buffIndex - 1];
    assert.equal(trigger?.type, "trigger");
    assert.equal(trigger.actorInstanceId, buff.actorInstanceId);
    assert.equal(trigger.targetInstanceId, dragon.instanceId);
  }
  assert.deepEqual(
    battle.events
      .filter(
        (event) =>
          event.type === "damage" &&
          event.actorInstanceId === dragon.instanceId,
      )
      .map((event) => event.amount),
    [10, 19],
  );
});

test("Roaring Rallier excludes itself and Tarecgosa permanently retains its combat gain", () => {
  const tarecgosa = definitionMinion(
    "BG21_015",
    "rallier-tarecgosa",
  );
  const rallier = definitionMinion("BG29_816", "rallier-watcher");
  const { state, battle } = runCombat(
    0x8302,
    [tarecgosa, rallier],
    [wall("rallier-retention-wall", 7)],
  );
  const buff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === rallier.instanceId &&
      event.targetInstanceId === tarecgosa.instanceId,
  );
  assert.ok(buff);
  assert.equal(buff.retained, true);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === rallier.instanceId &&
        event.targetInstanceId === rallier.instanceId,
    ),
    false,
  );
  const permanent = humanPlayer(state).board.find(
    (minion) => minion.instanceId === tarecgosa.instanceId,
  );
  assert.ok(permanent);
  assert.deepEqual(
    [permanent.attack, permanent.health],
    [tarecgosa.attack + 3, tarecgosa.health + 1],
  );
});

test("an immediately attacking Dragon triggers Roaring Rallier and Ring Warden before damage", () => {
  const twilightHatchling = definitionMinion(
    "BG34_630",
    "immediate-twilight-hatchling",
    { attack: 0, health: 1, taunt: true },
  );
  const rallier = definitionMinion(
    "BG29_816",
    "immediate-rallier",
  );
  const warden = definitionMinion(
    "BG34_921",
    "immediate-ring-warden",
  );
  const { battle } = runCombat(
    0x8303,
    [twilightHatchling, rallier, warden],
    [
      inertMinion("immediate-enemy-attacker", {
        attack: 10,
        health: 30,
      }),
      inertMinion("immediate-enemy-filler-a"),
      inertMinion("immediate-enemy-filler-b"),
      inertMinion("immediate-enemy-filler-c"),
    ],
  );
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === twilightHatchling.instanceId,
  );
  assert.ok(summon?.targetInstanceId);
  const window = strikeWindow(battle, summon.targetInstanceId);
  assert.match(window[0].message, /立即攻击/);

  const rallierTriggerIndex = window.findIndex(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === rallier.instanceId &&
      event.targetInstanceId === summon.targetInstanceId,
  );
  const rallierBuffIndex = window.findIndex(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === rallier.instanceId &&
      event.targetInstanceId === summon.targetInstanceId,
  );
  const ringCastIndex = window.findIndex(
    (event) =>
      event.type === "tavernSpellCast" &&
      event.actorInstanceId === warden.instanceId,
  );
  const attackDamageIndex = window.findIndex(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === summon.targetInstanceId,
  );
  assert.ok(rallierTriggerIndex >= 0);
  assert.ok(rallierBuffIndex > rallierTriggerIndex);
  assert.ok(ringCastIndex >= 0);
  assert.ok(attackDamageIndex > rallierBuffIndex);
  assert.ok(attackDamageIndex > ringCastIndex);
});

test("Wildfire Elemental splashes only numerical excess and never transfers Poisonous", () => {
  const wildfire = definitionMinion("BGS_126", "wildfire-normal", {
    attack: 10,
    poisonous: true,
  });
  const left = wall("wildfire-left", 10);
  left.taunt = false;
  const primary = wall("wildfire-primary", 4, 100);
  const right = wall("wildfire-right", 10);
  right.taunt = false;
  const { battle } = runCombat(
    0x8303,
    [
      left,
      primary,
      right,
    ],
    [
      wildfire,
      inertMinion("wildfire-filler-a"),
      inertMinion("wildfire-filler-b"),
      inertMinion("wildfire-filler-c"),
    ],
  );

  const triggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === wildfire.instanceId,
  );
  assert.equal(triggers.length, 1);
  assert.match(triggers[0].message, /6点过量伤害/);
  const splash = battle.events.find(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === wildfire.instanceId &&
      event.targetInstanceId === triggers[0].targetInstanceId,
  );
  assert.ok(splash);
  assert.equal(splash.amount, 6);
  assert.equal(splash.minion?.health, 4);
});

test("Golden Wildfire Elemental damages both living adjacent minions", () => {
  const wildfire = goldenMinion("BGS_126", "wildfire-golden");
  const left = wall("wildfire-golden-left", 10);
  left.taunt = false;
  const primary = wall("wildfire-golden-primary", 4, 100);
  const right = wall("wildfire-golden-right", 10);
  right.taunt = false;
  const { battle } = runCombat(
    0x8304,
    [
      left,
      primary,
      right,
    ],
    [
      wildfire,
      inertMinion("wildfire-golden-filler-a"),
      inertMinion("wildfire-golden-filler-b"),
      inertMinion("wildfire-golden-filler-c"),
    ],
  );

  const targets = battle.events
    .filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === wildfire.instanceId,
    )
    .map((event) => event.targetInstanceId)
    .sort();
  assert.deepEqual(
    targets,
    [left.instanceId, right.instanceId].sort(),
  );
});

test("Wildfire Elemental does not trigger on exact lethal, Divine Shield, or Venomous-only lethal", () => {
  const cases = [
    {
      name: "exact",
      attacker: definitionMinion("BGS_126", "wildfire-exact", {
        attack: 10,
      }),
      primary: wall("wildfire-exact-primary", 10, 100),
    },
    {
      name: "shield",
      attacker: definitionMinion("BGS_126", "wildfire-shield", {
        attack: 10,
      }),
      primary: wall("wildfire-shield-primary", 10, 100),
    },
    {
      name: "venomous",
      attacker: definitionMinion("BGS_126", "wildfire-venomous", {
        attack: 5,
        venomous: true,
      }),
      primary: wall("wildfire-venomous-primary", 8, 100),
    },
  ] as const;
  cases[1].primary.divineShield = true;

  for (const [index, combatCase] of cases.entries()) {
    const left = inertMinion(`${combatCase.name}-left`);
    const right = inertMinion(`${combatCase.name}-right`);
    const { battle } = runCombat(
      0x8310 + index,
      [
        combatCase.attacker,
        inertMinion(`${combatCase.name}-filler-a`),
        inertMinion(`${combatCase.name}-filler-b`),
        inertMinion(`${combatCase.name}-filler-c`),
      ],
      [left, combatCase.primary, right],
    );
    assert.equal(
      battle.events.some(
        (event) =>
          event.type === "trigger" &&
          event.actorInstanceId === combatCase.attacker.instanceId,
      ),
      false,
      combatCase.name,
    );
  }
});

test("Monstrous Macaw triggers the leftmost Deathrattle without killing its source", () => {
  const macaw = definitionMinion("BGS_078", "macaw-normal");
  const harvest = definitionMinion(
    "harvest-golem",
    "macaw-harvest",
  );
  const kaboom = definitionMinion("kaboom-bot", "macaw-kaboom");
  const { battle, humanId } = runCombat(
    0x8320,
    [macaw, harvest, kaboom],
    [wall("macaw-wall", 5)],
  );

  const trigger = battle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === macaw.instanceId,
  );
  assert.ok(trigger);
  assert.equal(trigger.targetInstanceId, harvest.instanceId);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === harvest.instanceId,
    ),
    false,
  );
  const summon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === harvest.instanceId,
  );
  assert.ok(summon);
  assert.equal(summon.minion?.definitionId, "damaged-golem-token");
  assert.deepEqual(
    battle.finalBoards[humanId].map((minion) => minion.instanceId),
    [
      macaw.instanceId,
      harvest.instanceId,
      summon.targetInstanceId,
      kaboom.instanceId,
    ],
  );
});

test("Golden Monstrous Macaw repeats a Titus-amplified Deathrattle four times", () => {
  const macaw = goldenMinion("BGS_078", "macaw-golden");
  const harvest = definitionMinion(
    "harvest-golem",
    "macaw-golden-harvest",
  );
  const titus = definitionMinion(
    "titus-rivendare",
    "macaw-titus",
  );
  const { battle, humanId } = runCombat(
    0x8321,
    [macaw, harvest, titus],
    [wall("macaw-golden-wall", 10)],
  );
  const summons = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorInstanceId === harvest.instanceId,
  );
  assert.equal(summons.length, 4);
  assert.equal(battle.finalBoards[humanId].length, 7);
  assert.equal(
    battle.events.filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === macaw.instanceId,
    ).length,
    2,
  );
});

test("Macaw resolves deaths caused by the virtual Deathrattle before attack damage", () => {
  const macaw = definitionMinion("BGS_078", "macaw-bomb");
  const kaboom = definitionMinion("kaboom-bot", "macaw-bomb-source");
  const enemy = wall("macaw-bomb-wall", 4, 100);
  const { battle } = runCombat(
    0x8322,
    [macaw, kaboom],
    [enemy],
  );
  const sourceDamage = battle.events.filter(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === kaboom.instanceId &&
      event.targetInstanceId === enemy.instanceId,
  );
  assert.equal(sourceDamage.length, 1);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === macaw.instanceId,
    ),
    false,
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === enemy.instanceId,
    ),
    false,
  );
});

test("Charmwing uses its undamaged maximum Health and excludes every Charmwing", () => {
  const charmwing = definitionMinion("BG33_240", "charmwing-source", {
    taunt: true,
  });
  const dragonA = definitionMinion(
    "BG34_636t",
    "charmwing-dragon-a",
  );
  const dragonB = definitionMinion(
    "BG34_638t",
    "charmwing-dragon-b",
  );
  const otherCharmwing = definitionMinion(
    "BG33_240",
    "charmwing-other",
  );
  const enemies = Array.from({ length: 5 }, (_, index) =>
    inertMinion(`charmwing-enemy-${index}`, {
      attack: 4,
      health: 100,
      taunt: true,
    }),
  );
  const { battle } = runCombat(
    0x8330,
    [charmwing, dragonA, dragonB, otherCharmwing],
    enemies,
  );
  const window = strikeWindow(battle, charmwing.instanceId);
  const buffs = window.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === charmwing.instanceId,
  );
  assert.deepEqual(
    new Set(buffs.map((event) => event.targetInstanceId)),
    new Set([dragonA.instanceId, dragonB.instanceId]),
  );
  assert.deepEqual(
    buffs.map((event) => event.healthDelta),
    [10, 10],
  );
  const priorDamage = battle.events.find(
    (event) =>
      event.type === "damage" &&
      event.targetInstanceId === charmwing.instanceId,
  );
  assert.equal(priorDamage?.minion?.health, 6);
});

test("Golden Charmwing selects distinct Dragons within each of its two complete pulses", () => {
  const charmwing = goldenMinion(
    "BG33_240",
    "charmwing-golden",
  );
  const dragons = [
    definitionMinion("BG34_636t", "charmwing-golden-a"),
    definitionMinion("BG34_637t", "charmwing-golden-b"),
    definitionMinion("BG34_638t", "charmwing-golden-c"),
  ];
  const { battle } = runCombat(
    0x8331,
    [charmwing, ...dragons],
    [
      inertMinion("charmwing-golden-left"),
      wall("charmwing-golden-wall", 6),
      inertMinion("charmwing-golden-right"),
    ],
  );
  const buffs = strikeWindow(battle, charmwing.instanceId).filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === charmwing.instanceId,
  );
  assert.equal(buffs.length, 4);
  for (const repetition of [1, 2]) {
    const pulse = buffs.filter((event) =>
      event.message.includes(`第${repetition}次`),
    );
    assert.equal(pulse.length, 2);
    assert.equal(
      new Set(pulse.map((event) => event.targetInstanceId)).size,
      2,
    );
    assert.deepEqual(
      pulse.map((event) => event.healthDelta),
      [20, 20],
    );
  }
});

test("a Reborn Charmwing keeps its printed maximum Health for Rally", () => {
  const charmwing = definitionMinion(
    "BG33_240",
    "charmwing-reborn",
    {
      reborn: true,
      taunt: true,
    },
  );
  const dragonA = definitionMinion(
    "BG34_636t",
    "charmwing-reborn-a",
  );
  const dragonB = definitionMinion(
    "BG34_638t",
    "charmwing-reborn-b",
  );
  const enemies = Array.from({ length: 4 }, (_, index) =>
    inertMinion(`charmwing-reborn-enemy-${index}`, {
      attack: 100,
      health: 100,
      taunt: true,
    }),
  );
  const { battle } = runCombat(
    0x8332,
    [charmwing, dragonA, dragonB],
    enemies,
  );
  const reborn = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "reborn" &&
      event.minion?.definitionId === charmwing.definitionId,
  );
  assert.ok(reborn?.targetInstanceId);
  const buffs = strikeWindow(
    battle,
    reborn.targetInstanceId,
  ).filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === reborn.targetInstanceId,
  );
  assert.deepEqual(
    buffs.map((event) => event.healthDelta),
    [10, 10],
  );
});

test("Ring Warden casts Shiny Ring before its own attack damage", () => {
  const warden = definitionMinion("BG34_921", "ring-warden");
  const filler = inertMinion("ring-filler");
  const { battle } = runCombat(
    0x8340,
    [warden, filler],
    [wall("ring-wall", 6)],
  );
  const window = strikeWindow(battle, warden.instanceId);
  const castIndex = window.findIndex(
    (event) => event.type === "tavernSpellCast",
  );
  const damageIndex = window.findIndex(
    (event) =>
      event.type === "damage" &&
      event.actorInstanceId === warden.instanceId,
  );
  assert.ok(castIndex > 0 && damageIndex > castIndex);
  assert.equal(window[damageIndex].amount, 6);
  assert.deepEqual(
    window
      .filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === warden.instanceId,
      )
      .map((event) => [
        event.targetInstanceId,
        event.attackDelta,
        event.healthDelta,
      ]),
    [
      [warden.instanceId, 1, 1],
      [filler.instanceId, 1, 1],
    ],
  );
});

test("Golden Ring Warden applies Tavern Spell bonuses twice and persists Fire-forged responses", () => {
  const warden = goldenMinion(
    "BG34_921",
    "ring-warden-golden",
  );
  const evoker = definitionMinion(
    "BG32_822",
    "ring-fire-forged",
  );
  const { state, battle } = runCombat(
    0x8341,
    [warden, evoker],
    [wall("ring-golden-wall", 18)],
    (_state, human) => {
      human.tavernSpellAttackBonus = 2;
      human.tavernSpellHealthBonus = 3;
    },
  );
  const window = strikeWindow(battle, warden.instanceId);
  assert.equal(
    window.filter((event) => event.type === "tavernSpellCast").length,
    2,
  );
  assert.deepEqual(
    window
      .filter(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === warden.instanceId &&
          event.targetInstanceId === warden.instanceId,
      )
      .map((event) => [event.attackDelta, event.healthDelta]),
    [
      [3, 4],
      [3, 4],
    ],
  );
  assert.equal(
    window.find(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === warden.instanceId,
    )?.amount,
    18,
  );
  const permanentEvoker = humanPlayer(state).board.find(
    (minion) => minion.instanceId === evoker.instanceId,
  );
  assert.ok(permanentEvoker);
  assert.deepEqual(permanentEvoker.effectCounters, {
    startOfCombatAttackBonus: 4,
    startOfCombatHealthBonus: 2,
  });
  assert.match(permanentEvoker.description, /\+6\/\+3/);
});

test("Ring Warden resolves before an attacking Charmwing reads maximum Health", () => {
  const charmwing = definitionMinion(
    "BG33_240",
    "ring-charmwing",
  );
  const warden = definitionMinion("BG34_921", "ring-watcher");
  const target = definitionMinion("BG34_636t", "ring-dragon");
  const filler = inertMinion("ring-neutral");
  const { battle } = runCombat(
    0x8342,
    [charmwing, warden, target, filler],
    [wall("ring-order-wall", 4)],
  );
  const window = strikeWindow(battle, charmwing.instanceId);
  const castIndex = window.findIndex(
    (event) => event.type === "tavernSpellCast",
  );
  const charmBuffs = window.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === charmwing.instanceId,
  );
  assert.equal(charmBuffs.length, 2);
  assert.ok(
    charmBuffs.every(
      (event) =>
        event.healthDelta === 11 &&
        window.indexOf(event) > castIndex,
    ),
  );
});

test("AI leads with Macaw and places its highest-value Deathrattle immediately after it", () => {
  const state = createGame(0x8350);
  const player = state.players[1];
  const macaw = definitionMinion("BGS_078", "ai-macaw");
  const smallDeathrattle = definitionMinion(
    "harvest-golem",
    "ai-harvest",
  );
  const largeDeathrattle = definitionMinion(
    "savannah-highmane",
    "ai-highmane",
  );
  const vanilla = inertMinion("ai-vanilla", {
    attack: macaw.attack,
    health: macaw.health,
  });
  player.board = [
    vanilla,
    smallDeathrattle,
    macaw,
    largeDeathrattle,
  ];
  const order = planAiBoardOrder(player);
  assert.deepEqual(order.slice(0, 2), [
    macaw.instanceId,
    largeDeathrattle.instanceId,
  ]);
  assert.ok(
    scoreMinionForAi(player, macaw) >
      scoreMinionForAi(player, vanilla),
  );
});

test("v29 saves migrate through v31 while preserving current fields and excluding combat-only ledgers", () => {
  const legacy = createGame(0x8360);
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V29;
  const human = humanPlayer(legacy);
  const warden = goldenMinion(
    "BG34_921",
    "saved-ring-warden",
    {
      effectSupport: "partial",
      attack: 47,
      health: 53,
      effectCounters: { existingCounter: 9 },
    },
  );
  human.board = [warden];
  human.nextTavernSpellDiscount = 3;

  const serialized = JSON.parse(JSON.stringify(legacy)) as unknown;
  assert.equal(
    Object.hasOwn(
      serialized as Record<string, unknown>,
      "maximumHealths",
    ),
    false,
  );
  const migrated = normalizePersistedGameState(serialized) as
    | GameState
    | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v37",
  );
  const saved = humanPlayer(migrated).board[0];
  assert.equal(saved.effectSupport, "complete");
  assert.equal(saved.cardId, "BG34_921_G");
  assert.deepEqual([saved.attack, saved.health], [47, 53]);
  assert.deepEqual(saved.effectCounters, { existingCounter: 9 });
  assert.equal(humanPlayer(migrated).nextTavernSpellDiscount, 3);
  assert.equal(
    Object.hasOwn(
      migrated as unknown as Record<string, unknown>,
      "maximumHealths",
    ),
    false,
  );
});
