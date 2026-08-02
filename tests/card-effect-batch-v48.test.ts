import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { getTavernSpellDefinition } from "../lib/game/tavern-spells.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V47,
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

test("v48 exposes complete ordinary and Golden Sandstorm and Radiant rules", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v50",
  );

  const sandstorm = getMinionDefinition("BG32_841");
  assert.equal(sandstorm.effectSupport, "complete");
  assert.equal(sandstorm.goldenCardId, "BG32_841_G");
  assert.deepEqual(sandstorm.battlecry, [
    { kind: "improveElementalStatGrants", attack: 1, health: 0 },
  ]);
  assert.equal(sandstorm.goldenDescription?.includes("+2攻击力"), true);

  const radiant = getMinionDefinition("BG32_842");
  assert.equal(radiant.effectSupport, "complete");
  assert.equal(radiant.goldenCardId, "BG32_842_G");
  assert.deepEqual(radiant.deathrattle, [
    { kind: "improveElementalStatGrants", attack: 0, health: 2 },
  ]);
  assert.equal(radiant.goldenDescription?.includes("+4生命值"), true);
});

test("Sandstorm Battlecry immediately improves each later Elemental stat packet with correct Golden scaling", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    let state = createGame(0xf800 + caseIndex);
    let player = humanPlayer(state);
    const surge = minion("BG32_846", `sandstorm-surge-${caseIndex}`);
    const sandstorm = golden
      ? goldenMinion("BG32_841", `sandstorm-golden-${caseIndex}`)
      : minion("BG32_841", `sandstorm-ordinary-${caseIndex}`);
    player.board = [surge];
    player.hand = [sandstorm];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    player = humanPlayer(state);
    assert.equal(
      player.elementalGrantAttackBonus,
      golden ? 2 : 1,
    );
    assert.equal(player.elementalGrantHealthBonus, 0);
    assert.deepEqual(
      player.board.map((candidate) => [candidate.attack, candidate.health]),
      golden
        ? [
            [12, 9],
            [14, 10],
          ]
        : [
            [11, 9],
            [9, 7],
          ],
    );
  }
});

test("Elemental bonus is appended once after Golden Snow Baller scaling", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    let state = createGame(0xf810 + caseIndex);
    let player = humanPlayer(state);
    player.elementalGrantAttackBonus = 1;
    const target = minion("tabbycat-token", `baller-target-${caseIndex}`, {
      attack: 10,
      health: 10,
    });
    const baller = golden
      ? minion("BG31_818", `baller-golden-${caseIndex}`, {
          golden: true,
          cardId: "BG31_818_G",
          name: "金色·冰雪投球手",
          attack: 6,
          health: 8,
        })
      : minion("BG31_818", `baller-ordinary-${caseIndex}`);
    player.board = [target, baller];

    state = gameReducer(state, {
      type: "SELL_MINION",
      boardIndex: 1,
    });
    player = humanPlayer(state);
    assert.deepEqual(
      [player.board[0].attack, player.board[0].health],
      golden ? [11, 12] : [11, 11],
    );
    assert.deepEqual(
      [player.ballerAttackBonus, player.ballerHealthBonus],
      golden ? [1, 3] : [1, 2],
    );
  }
});

test("Radiant recruit destruction improves later Elemental Health grants once per actual Deathrattle repetition", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    let state = createGame(0xf820 + caseIndex);
    let player = humanPlayer(state);
    const radiant = (golden ? goldenMinion : minion)(
      "BG32_842",
      `radiant-recruit-${caseIndex}`,
      { tribe: "elemental", tribes: ["elemental", "undead"] },
    );
    player.board = [radiant, minion("BG25_354", `radiant-titus-${caseIndex}`)];
    player.hand = [minion("BG28_303", `radiant-tomb-raider-${caseIndex}`)];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const interaction = state.pendingInteraction;
    assert.equal(interaction?.kind, "target");
    assert.ok(interaction?.kind === "target");
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: interaction.interactionId,
      optionInstanceId: radiant.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(
      player.elementalGrantHealthBonus,
      golden ? 8 : 4,
    );
    assert.equal(player.elementalGrantAttackBonus, 0);
  }
});

test("Radiant Deathrattle permanently improves the live combat owner and emits one structured pulse per repetition", () => {
  const state = createGame(0xf830);
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  const radiant = minion("BG32_842", "radiant-combat", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  player.board = [radiant, minion("BG25_354", "radiant-combat-titus", {
    attack: 0,
    health: 100,
  })];
  prepareDuel(state, [
    minion("defender-of-argus", "radiant-combat-enemy", {
      attack: 1,
      health: 100_000,
      taunt: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(humanPlayer(combat).elementalGrantHealthBonus, 4);
  const improvements = (combat.lastBattle?.events ?? []).filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === radiant.instanceId &&
      event.healthDelta === 2 &&
      event.permanentEffectImprovement === true,
  );
  assert.equal(improvements.length, 2);
});

test("non-Elemental Tavern Spell stat grants do not consume Elemental bonuses", () => {
  let state = createGame(0xf840);
  let player = humanPlayer(state);
  player.elementalGrantAttackBonus = 7;
  player.elementalGrantHealthBonus = 9;
  const target = minion("BG32_841", "pointy-arrow-elemental", {
    attack: 10,
    health: 10,
  });
  player.board = [target];
  player.hand = [
    tavernSpell("tavern-spell-pointy-arrow", "pointy-arrow-spell"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "pointy-arrow-spell",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [14, 10],
  );
});

test("an Elemental-triggered Tavern Spell carries one Elemental bonus packet without changing hand-cast spells", () => {
  let state = createGame(0xf845);
  let player = humanPlayer(state);
  player.elementalGrantAttackBonus = 1;
  player.gold = 20;
  player.freeRefreshes = 0;
  player.board = [minion("BG34_858", "windfall-elemental")];

  for (let refresh = 0; refresh < 7; refresh += 1) {
    state = gameReducer(state, { type: "REFRESH_SHOP" });
  }
  player = humanPlayer(state);
  assert.deepEqual(player.rideTheWindBuffs, [
    { attack: 7, health: 6 },
  ]);
});

test("Felfire Executor consumes with the Elemental bonus after Golden scaling", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0xf846 + caseIndex);
    state.lobbySystemsEnabled = false;
    const player = humanPlayer(state);
    player.elementalGrantAttackBonus = 1;
    const executor = (golden ? goldenMinion : minion)(
      "BG34_500",
      `felfire-executor-${caseIndex}`,
      { health: 1_000 },
    );
    player.board = [executor];
    player.shop = [
      minion("tabbycat-token", `felfire-fodder-${caseIndex}`, {
        attack: 5,
        health: 7,
      }),
    ];
    prepareDuel(state, [
      minion("defender-of-argus", `felfire-enemy-${caseIndex}`, {
        attack: 0,
        health: 100_000,
      }),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const persisted = humanPlayer(combat).board.find(
      (candidate) => candidate.instanceId === executor.instanceId,
    );
    assert.ok(persisted);
    assert.deepEqual(
      [persisted.attack, persisted.health],
      golden ? [19, 1_014] : [10, 1_007],
    );
  }
});

test("an Elemental Magnetic source gives its host one additional stat packet", () => {
  let state = createGame(0xf848);
  let player = humanPlayer(state);
  player.elementalGrantAttackBonus = 1;
  player.elementalGrantHealthBonus = 2;
  const host = minion("BG32_841", "elemental-magnetic-host");
  const magnetic = minion("BG31_859", "elemental-magnetic-source");
  player.board = [host];
  player.hand = [magnetic];

  state = gameReducer(state, {
    type: "MAGNETIZE_MINION",
    cardInstanceId: magnetic.instanceId,
    targetInstanceId: host.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [10, 11],
  );
  assert.equal(player.board[0].attachments.length, 1);
  assert.deepEqual(
    [
      player.board[0].attachments[0].attackGranted,
      player.board[0].attachments[0].healthGranted,
    ],
    [6, 8],
  );
});

test("v47 saves repair missing Elemental bonuses while v48 preserves valid values and rejects malformed ones", () => {
  const legacy = structuredClone(createGame(0xf850)) as GameState;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V47;
  for (const player of legacy.players) {
    delete (player as Partial<PlayerState>).elementalGrantAttackBonus;
    delete (player as Partial<PlayerState>).elementalGrantHealthBonus;
  }
  const migrated = normalizePersistedGameState(legacy) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.ok(
    migrated.players.every(
      (player) =>
        player.elementalGrantAttackBonus === 0 &&
        player.elementalGrantHealthBonus === 0,
    ),
  );

  const current = createGame(0xf851);
  humanPlayer(current).elementalGrantAttackBonus = 3;
  humanPlayer(current).elementalGrantHealthBonus = 5;
  const normalized = normalizePersistedGameState(
    structuredClone(current),
  ) as GameState | null;
  assert.ok(normalized);
  assert.deepEqual(
    [
      humanPlayer(normalized).elementalGrantAttackBonus,
      humanPlayer(normalized).elementalGrantHealthBonus,
    ],
    [3, 5],
  );

  for (const malformedValue of [-1, 1.5, Number.NaN]) {
    const malformed = structuredClone(current);
    humanPlayer(malformed).elementalGrantAttackBonus = malformedValue;
    assert.equal(normalizePersistedGameState(malformed), null);
  }
});
