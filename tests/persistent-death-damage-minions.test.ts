import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
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

function enemyWall(
  instanceId: string,
  attack = 100,
  health = 1,
): BoardMinionInstance {
  return definitionMinion("BG25_001", instanceId, {
    attack,
    health,
    taunt: true,
    reborn: false,
  });
}

function isolateCombat(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): PlayerState {
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
    player.lastOpponentId = undefined;
    player.eliminatedRound = undefined;
  }

  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);
  human.alive = true;
  human.health = 1_000;
  human.board = humanBoard;
  enemy.alive = true;
  enemy.health = 1_000;
  enemy.board = enemyBoard;
  return enemy;
}

function humanBattle(state: GameState): BattleSummary {
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === state.humanPlayerId ||
      candidate.playerBId === state.humanPlayerId,
  );
  assert.ok(battle);
  return battle;
}

function setOnlyMinionPoolDefinition(
  state: GameState,
  definitionId: string,
): void {
  for (const candidateId of Object.keys(state.pool)) {
    state.pool[candidateId] = 0;
  }
  state.pool[definitionId] = 50;
  if (!state.activeTribes.includes("undead")) {
    state.activeTribes = [...state.activeTribes, "undead"];
  }
}

function printedShopStatDeltas(player: PlayerState): {
  attack: number;
  health: number;
} {
  return player.shop.reduce(
    (total, minion) => {
      const definition = getMinionDefinition(minion.definitionId);
      total.attack += minion.attack - definition.attack;
      total.health += minion.health - definition.health;
      return total;
    },
    { attack: 0, health: 0 },
  );
}

test("maps exact fixed-build metadata for Water Whelp, Hardy Orca, and Plagued Cadaver", () => {
  const waterWhelp = getMinionDefinition("BG34_856");
  assert.equal(waterWhelp.effectSupport, "complete");
  assert.equal(
    waterWhelp.description,
    "亡语：在本局对战中，在酒馆刷新后，使酒馆中一个随机随从获得+3/+3。",
  );
  assert.equal(waterWhelp.goldenCardId, "BG34_856_G");
  assert.equal(
    waterWhelp.goldenDescription,
    "亡语：在本局对战中，在酒馆刷新后，使酒馆中一个随机随从获得+3/+3，触发两次。",
  );
  assert.deepEqual(waterWhelp.deathrattle, [
    {
      kind: "installTavernRefreshBuff",
      attack: 3,
      health: 3,
      goldenMode: "repeat",
    },
  ]);

  const hardyOrca = getMinionDefinition("BG34_312");
  assert.equal(hardyOrca.effectSupport, "complete");
  assert.equal(hardyOrca.taunt, true);
  assert.equal(
    hardyOrca.description,
    "嘲讽。每当本随从受到伤害，使你的其他随从获得+1/+1。",
  );
  assert.equal(hardyOrca.goldenCardId, "BG34_312_G");
  assert.equal(
    hardyOrca.goldenDescription,
    "嘲讽。每当本随从受到伤害，使你的其他随从获得+2/+2。",
  );
  assert.deepEqual(hardyOrca.afterSelfDamaged, [
    {
      kind: "buff",
      target: "otherFriendly",
      attack: 1,
      health: 1,
    },
  ]);

  const plaguedCadaver = getMinionDefinition("BG34_690");
  assert.equal(plaguedCadaver.effectSupport, "complete");
  assert.equal(
    plaguedCadaver.description,
    "亡语：在本局对战中，你的亡灵拥有+2攻击力，无论它们在哪。（如果本随从在战斗之外死亡，改为+4！）",
  );
  assert.equal(plaguedCadaver.goldenCardId, "BG34_690_G");
  assert.equal(
    plaguedCadaver.goldenDescription,
    "亡语：在本局对战中，你的亡灵拥有+4攻击力，无论它们在哪。（如果本随从在战斗之外死亡，改为+8！）",
  );
  assert.deepEqual(plaguedCadaver.deathrattle, [
    {
      kind: "improveUndeadArmy",
      attack: 2,
      health: 0,
      outOfCombatMultiplier: 2,
    },
  ]);
});

test("Water Whelp installs independent normal, Golden, and Titus refresh pulses without touching the current page", () => {
  const scenarios = [
    { golden: false, titus: false, pulses: 1 },
    { golden: true, titus: false, pulses: 2 },
    { golden: false, titus: true, pulses: 2 },
    { golden: true, titus: true, pulses: 4 },
  ] as const;

  for (const scenario of scenarios) {
    let state = createGame(
      0x348560 + Number(scenario.golden) * 10 + Number(scenario.titus),
    );
    const source = scenario.golden
      ? goldenMinion("BG34_856", `water-whelp-${scenario.pulses}`, {
          health: 1,
          taunt: true,
        })
      : definitionMinion("BG34_856", `water-whelp-${scenario.pulses}`, {
          health: 1,
          taunt: true,
        });
    const board = [source];
    if (scenario.titus) {
      board.push(
        definitionMinion("BG25_354", `water-titus-${scenario.pulses}`, {
          attack: 0,
          health: 20,
        }),
      );
    }
    isolateCombat(state, board, [
      enemyWall(`water-enemy-${scenario.pulses}`),
    ]);
    let human = humanPlayer(state);
    const currentOffer = definitionMinion(
      "BG25_001",
      `water-current-offer-${scenario.pulses}`,
    );
    human.shop = [currentOffer];
    const currentPageBefore = structuredClone(human.shop);

    state = gameReducer(state, { type: "END_TURN" });
    human = humanPlayer(state);
    assert.deepEqual(human.shop, currentPageBefore);
    assert.deepEqual(
      human.rideTheWindBuffs,
      Array.from({ length: scenario.pulses }, () => ({
        attack: 3,
        health: 3,
      })),
    );

    setOnlyMinionPoolDefinition(state, "BG25_001");
    state = gameReducer(state, { type: "CONTINUE" });
    human = humanPlayer(state);
    assert.ok(human.shop.length > 0);
    assert.deepEqual(printedShopStatDeltas(human), {
      attack: scenario.pulses * 3,
      health: scenario.pulses * 3,
    });

    state = gameReducer(state, { type: "REFRESH_SHOP" });
    human = humanPlayer(state);
    assert.ok(human.shop.length > 0);
    assert.deepEqual(printedShopStatDeltas(human), {
      attack: scenario.pulses * 3,
      health: scenario.pulses * 3,
    });
  }
});

test("Hardy Orca does not trigger when Divine Shield absorbs the damage", () => {
  const state = createGame(0x343120);
  const orca = definitionMinion("BG34_312", "shielded-orca", {
    attack: 1,
    divineShield: true,
  });
  const ally = definitionMinion("BG25_001", "shielded-orca-ally", {
    attack: 4,
    health: 4,
  });
  isolateCombat(state, [orca, ally], [enemyWall("shield-breaker", 1, 1)]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = humanBattle(combat);
  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "shieldBroken" &&
        event.targetInstanceId === orca.instanceId,
    ),
  );
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === orca.instanceId,
    ),
    false,
  );
});

test("Hardy Orca resolves lethal same-wave damage before death and records Golden playback deltas", () => {
  for (const golden of [false, true]) {
    const state = createGame(0x343121 + Number(golden));
    const bomber = definitionMinion("BG_DAL_775", `orca-bomber-${golden}`, {
      attack: 1,
      health: 1,
      taunt: false,
    });
    const orca = golden
      ? goldenMinion("BG34_312", `lethal-orca-${golden}`, {
          attack: 0,
          health: 3,
        })
      : definitionMinion("BG34_312", `lethal-orca-${golden}`, {
          attack: 0,
          health: 3,
        });
    const ally = definitionMinion("BG25_001", `same-wave-ally-${golden}`, {
      attack: 5,
      health: 3,
    });
    isolateCombat(state, [bomber, orca, ally], [
      enemyWall(`orca-wall-${golden}`, 100, 3),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = humanBattle(combat);
    const orcaDamage = battle.events.find(
      (event) =>
        event.type === "damage" &&
        event.targetInstanceId === orca.instanceId &&
        event.minion?.health === 0,
    );
    const allyDamage = battle.events.find(
      (event) =>
        event.type === "damage" &&
        event.targetInstanceId === ally.instanceId &&
        event.minion?.health === 0,
    );
    const allyBuff = battle.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === orca.instanceId &&
        event.targetInstanceId === ally.instanceId,
    );
    const orcaDeath = battle.events.find(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === orca.instanceId,
    );
    assert.ok(orcaDamage);
    assert.ok(allyDamage);
    assert.ok(allyBuff);
    assert.ok(orcaDeath);
    const amount = golden ? 2 : 1;
    assert.deepEqual(
      [allyBuff.attackDelta, allyBuff.healthDelta],
      [amount, amount],
    );
    assert.deepEqual(
      [allyBuff.minion?.attack, allyBuff.minion?.health],
      [ally.attack + amount, amount],
    );
    assert.ok(orcaDamage.index < allyBuff.index);
    assert.ok(allyDamage.index < allyBuff.index);
    assert.ok(allyBuff.index < orcaDeath.index);
  }
});

test("Plagued Cadaver grows normal and Golden Undead across combat zones with Titus repetitions", () => {
  const scenarios = [
    { golden: false, titus: false, expected: 2 },
    { golden: true, titus: false, expected: 4 },
    { golden: false, titus: true, expected: 4 },
    { golden: true, titus: true, expected: 8 },
  ] as const;

  for (const scenario of scenarios) {
    let state = createGame(
      0x346900 + Number(scenario.golden) * 10 + Number(scenario.titus),
    );
    const source = scenario.golden
      ? goldenMinion("BG34_690", `cadaver-${scenario.expected}`, {
          health: 1,
          taunt: true,
        })
      : definitionMinion("BG34_690", `cadaver-${scenario.expected}`, {
          health: 1,
          taunt: true,
        });
    const boardUndead = definitionMinion(
      "BG25_001",
      `cadaver-board-undead-${scenario.expected}`,
      { attack: 2, health: 20 },
    );
    const allType = definitionMinion(
      "BG29_611",
      `cadaver-all-${scenario.expected}`,
      {
        tribe: "all",
        tribes: ["all"],
        attack: 3,
        health: 20,
      },
    );
    const nonUndead = definitionMinion(
      "BG29_611",
      `cadaver-control-${scenario.expected}`,
      { attack: 4, health: 20 },
    );
    const board = [source, boardUndead, allType, nonUndead];
    if (scenario.titus) {
      board.push(
        definitionMinion("BG25_354", `cadaver-titus-${scenario.expected}`, {
          attack: 0,
          health: 20,
        }),
      );
    }
    isolateCombat(state, board, [
      enemyWall(`cadaver-wall-${scenario.expected}`),
    ]);
    let human = humanPlayer(state);
    const handUndead = definitionMinion(
      "BG25_001",
      `cadaver-hand-${scenario.expected}`,
      { attack: 5, health: 5 },
    );
    human.hand = [handUndead];

    state = gameReducer(state, { type: "END_TURN" });
    human = humanPlayer(state);
    assert.equal(human.undeadArmyAttackBonus, scenario.expected);
    assert.equal(human.undeadArmyHealthBonus, 0);
    assert.equal(
      human.board.find((minion) => minion.instanceId === source.instanceId)
        ?.attack,
      source.attack + scenario.expected,
    );
    assert.equal(
      human.board.find(
        (minion) => minion.instanceId === boardUndead.instanceId,
      )?.attack,
      boardUndead.attack + scenario.expected,
    );
    assert.equal(
      human.board.find((minion) => minion.instanceId === allType.instanceId)
        ?.attack,
      allType.attack + scenario.expected,
    );
    assert.equal(
      human.board.find((minion) => minion.instanceId === nonUndead.instanceId)
        ?.attack,
      nonUndead.attack,
    );
    const persistedHandUndead = human.hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.instanceId === handUndead.instanceId,
    );
    assert.equal(
      persistedHandUndead?.attack,
      handUndead.attack + scenario.expected,
    );

    if (!scenario.golden && !scenario.titus) {
      state = gameReducer(state, { type: "CONTINUE" });
      human = humanPlayer(state);
      const futureUndead = definitionMinion(
        "BG25_013",
        "cadaver-future-undead",
      );
      human.shop = [futureUndead];
      human.gold = 10;
      state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
      const bought = humanPlayer(state).hand.find(
        (card): card is BoardMinionInstance =>
          card.kind === "minion" &&
          card.instanceId === futureUndead.instanceId,
      );
      assert.equal(
        bought?.attack,
        getMinionDefinition("BG25_013").attack + scenario.expected,
      );
    }
  }
});

test("Stir the Graveyard expiry uses Plagued Cadaver's out-of-combat multiplier", () => {
  const scenarios = [
    { golden: false, titus: false, expected: 4 },
    { golden: true, titus: false, expected: 8 },
    { golden: false, titus: true, expected: 8 },
  ] as const;

  for (const scenario of scenarios) {
    let state = createGame(
      0x346940 + Number(scenario.golden) * 10 + Number(scenario.titus),
    );
    let human = humanPlayer(state);
    const target = definitionMinion(
      "BG25_001",
      `expiry-target-${scenario.expected}`,
      { attack: 3, health: 10 },
    );
    human.board = [target];
    if (scenario.titus) {
      human.board.push(
        definitionMinion("BG25_354", "expiry-titus", {
          attack: 0,
          health: 20,
        }),
      );
    }
    const source = scenario.golden
      ? goldenMinion("BG34_690", `expiry-source-${scenario.expected}`, {
          destroyAfterPlayThroughRound: state.round,
        })
      : definitionMinion("BG34_690", `expiry-source-${scenario.expected}`, {
          destroyAfterPlayThroughRound: state.round,
        });
    human.hand = [source];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    human = humanPlayer(state);
    assert.equal(
      human.board.some((minion) => minion.instanceId === source.instanceId),
      false,
    );
    assert.equal(human.undeadArmyAttackBonus, scenario.expected);
    assert.equal(
      human.board.find((minion) => minion.instanceId === target.instanceId)
        ?.attack,
      target.attack + scenario.expected,
    );
  }
});

test("a ghost Plagued Cadaver buffs only its combat copy and never writes back", () => {
  const state = createGame(0x346980);
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
    player.board = [enemyWall(`ghost-cadaver-opponent-${index}`)];
  }

  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.undeadArmyAttackBonus = 7;
  const source = definitionMinion("BG34_690", "ghost-cadaver", {
    health: 1,
    taunt: true,
  });
  const combatUndead = definitionMinion(
    "BG25_001",
    "ghost-cadaver-combat-undead",
    { attack: 5, health: 20 },
  );
  const handUndead = definitionMinion(
    "BG25_001",
    "ghost-cadaver-hand-undead",
    { attack: 6, health: 6 },
  );
  ghost.board = [source, combatUndead];
  ghost.hand = [handUndead];
  const boardBefore = structuredClone(ghost.board);
  const handBefore = structuredClone(ghost.hand);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.equal(nextGhost.undeadArmyAttackBonus, 7);
  assert.deepEqual(nextGhost.board, boardBefore);
  assert.deepEqual(nextGhost.hand, handBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const combatOnlyBuff = ghostBattle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === combatUndead.instanceId,
  );
  assert.ok(combatOnlyBuff);
  assert.deepEqual(
    [combatOnlyBuff.attackDelta, combatOnlyBuff.healthDelta],
    [2, 0],
  );
});
