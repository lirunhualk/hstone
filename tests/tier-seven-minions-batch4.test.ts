import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
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
  return definitionMinion(definitionId, instanceId, {
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    description: definition.goldenDescription,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
}

function resetCombatPlayer(player: PlayerState): void {
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

function isolateCombat(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): void {
  state.lobbySystemsEnabled = false;
  for (const [index, player] of state.players.entries()) {
    resetCombatPlayer(player);
    if (index > 1) {
      player.alive = false;
      player.health = 0;
    }
  }
  const human = humanPlayer(state);
  const enemy = state.players[1];
  human.alive = true;
  human.health = 1_000;
  human.board = humanBoard;
  enemy.alive = true;
  enemy.health = 1_000;
  enemy.isHuman = true;
  enemy.board = enemyBoard;
}

function wall(instanceId: string): BoardMinionInstance {
  return definitionMinion("defender-of-argus", instanceId, {
    attack: 1_000,
    health: 1_000,
    taunt: true,
    reborn: false,
  });
}

function tribeMinion(
  instanceId: string,
  tribes: BoardMinionInstance["tribes"],
): BoardMinionInstance {
  return definitionMinion("tabbycat-token", instanceId, {
    attack: 0,
    health: 100,
    tribe: tribes[0] ?? "neutral",
    tribes,
  });
}

test("Last One Standing and Obsidian Ravager expose exact complete Tier 7 rules", () => {
  const lastOneStanding = getMinionDefinition("BG34_320");
  assert.equal(lastOneStanding.effectSupport, "complete");
  assert.deepEqual(
    [
      lastOneStanding.tier,
      lastOneStanding.attack,
      lastOneStanding.health,
      lastOneStanding.tribe,
    ],
    [7, 12, 12, "all"],
  );
  assert.equal(
    lastOneStanding.description,
    "进击：使每个类型的各一个友方随从永久获得+12/+12。",
  );
  assert.equal(lastOneStanding.goldenCardId, "BG34_320_G");
  assert.equal(
    lastOneStanding.goldenDescription,
    "进击：使每个类型的各一个友方随从永久获得+12/+12，触发两次。",
  );
  assert.deepEqual(lastOneStanding.rally, [
    {
      kind: "buffOneFriendlyPerTribe",
      attack: 12,
      health: 12,
      permanent: true,
      goldenMode: "repeat",
    },
  ]);

  const obsidianRavager = getMinionDefinition("BG27_017");
  assert.equal(obsidianRavager.effectSupport, "complete");
  assert.deepEqual(
    [
      obsidianRavager.tier,
      obsidianRavager.attack,
      obsidianRavager.health,
      obsidianRavager.tribe,
    ],
    [7, 7, 7, "dragon"],
  );
  assert.equal(
    obsidianRavager.description,
    "进击：对目标及一个相邻的随从造成等同于本随从攻击力的伤害。",
  );
  assert.equal(obsidianRavager.goldenCardId, "BG27_017_G");
  assert.equal(
    obsidianRavager.goldenDescription,
    "进击：对目标及相邻的随从造成等同于本随从攻击力的伤害。",
  );
  assert.deepEqual(obsidianRavager.rally, [
    {
      kind: "damageTargetAndAdjacent",
      goldenMode: "bothAdjacent",
    },
  ]);
});

test("Last One Standing uses a maximum one-per-type matching and persists each physical minion only once", () => {
  let state = createGame(0x7400);
  const source = definitionMinion("BG34_320", "last-one-source");
  const beast = tribeMinion("last-one-beast", ["beast"]);
  const mech = tribeMinion("last-one-mech", ["mech"]);
  const dual = tribeMinion("last-one-dual", ["beast", "mech"]);
  const board = [source, beast, mech, dual];
  const initialStats = new Map(
    board.map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  isolateCombat(state, board, [wall("last-one-wall")]);

  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastBattle;
  assert.ok(battle);
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.equal(buffs.length, 3);
  assert.ok(buffs.every(isCombatPlaybackEvent));
  assert.ok(
    buffs.every(
      (event) =>
        event.attackDelta === 12 &&
        event.healthDelta === 12 &&
        event.retained === true &&
        event.retentionMultiplier === 1,
    ),
  );
  const selectedIds = new Set(
    buffs.map((event) => event.targetInstanceId),
  );
  assert.equal(selectedIds.size, 3);
  assert.ok(selectedIds.has(source.instanceId));
  assert.equal(
    [beast, mech, dual].filter((minion) =>
      selectedIds.has(minion.instanceId),
    ).length,
    2,
  );

  const persistent = humanPlayer(state);
  for (const original of board) {
    const next = persistent.board.find(
      (minion) => minion.instanceId === original.instanceId,
    );
    assert.ok(next);
    const before = initialStats.get(original.instanceId);
    assert.ok(before);
    const expectedGain = selectedIds.has(original.instanceId) ? 12 : 0;
    assert.equal(next.attack, before.attack + expectedGain);
    assert.equal(next.health, before.health + expectedGain);
  }
});

test("Golden Last One Standing repeats independent +12/+12 permanent pulses", () => {
  let state = createGame(0x7401);
  const source = goldenMinion("BG34_320", "golden-last-one-source");
  const beast = tribeMinion("golden-last-one-beast", ["beast"]);
  const mech = tribeMinion("golden-last-one-mech", ["mech"]);
  const board = [source, beast, mech];
  const initialStats = new Map(
    board.map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  isolateCombat(state, board, [wall("golden-last-one-wall")]);

  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastBattle;
  assert.ok(battle);
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.equal(buffs.length, 6);
  assert.ok(buffs.every(isCombatPlaybackEvent));
  assert.ok(
    buffs.every(
      (event) =>
        event.attackDelta === 12 &&
        event.healthDelta === 12 &&
        event.retained === true &&
        event.retentionMultiplier === 1,
    ),
  );
  for (const minion of board) {
    assert.equal(
      buffs.filter(
        (event) => event.targetInstanceId === minion.instanceId,
      ).length,
      2,
    );
    const next = humanPlayer(state).board.find(
      (candidate) => candidate.instanceId === minion.instanceId,
    );
    assert.ok(next);
    const before = initialStats.get(minion.instanceId);
    assert.ok(before);
    assert.equal(next.attack, before.attack + 24);
    assert.equal(next.health, before.health + 24);
  }
});

test("Last One Standing animates on a ghost board without permanent writeback", () => {
  const state = createGame(0x7402);
  state.lobbySystemsEnabled = false;
  for (const player of state.players) {
    resetCombatPlayer(player);
    player.alive = false;
    player.health = 0;
  }
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 1_000;
    player.board = [wall(`last-one-ghost-wall-${index}`)];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  const source = definitionMinion("BG34_320", "last-one-ghost-source");
  ghost.board = [
    source,
    tribeMinion("last-one-ghost-beast", ["beast"]),
    tribeMinion("last-one-ghost-mech", ["mech"]),
  ];
  const boardBefore = structuredClone(ghost.board);

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  const buffs = ghostBattle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === source.instanceId,
  );
  assert.equal(buffs.length, 3);
  assert.ok(buffs.every(isCombatPlaybackEvent));
  assert.ok(buffs.every((event) => event.retained === false));
  assert.deepEqual(combat.players[3].board, boardBefore);
});

test("Obsidian Ravager damages the target and exactly the printed adjacent minions", () => {
  const scenarios = [
    { golden: false, expectedDamage: 7, expectedAdjacent: 1 },
    { golden: true, expectedDamage: 14, expectedAdjacent: 2 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x7410 + index);
    const source = scenario.golden
      ? goldenMinion("BG27_017", `obsidian-source-${index}`)
      : definitionMinion("BG27_017", `obsidian-source-${index}`);
    const fillers = Array.from({ length: 3 }, (_, fillerIndex) =>
      definitionMinion(
        "defender-of-argus",
        `obsidian-filler-${index}-${fillerIndex}`,
        { attack: 0, health: 100, taunt: false },
      ),
    );
    const left = definitionMinion(
      "defender-of-argus",
      `obsidian-left-${index}`,
      { attack: 0, health: 100, taunt: false },
    );
    const primary = definitionMinion(
      "defender-of-argus",
      `obsidian-primary-${index}`,
      { attack: 1_000, health: 100, taunt: true },
    );
    const right = definitionMinion(
      "defender-of-argus",
      `obsidian-right-${index}`,
      { attack: 0, health: 100, taunt: false },
    );
    isolateCombat(state, [source, ...fillers], [left, primary, right]);

    state = gameReducer(state, { type: "END_TURN" });
    const battle = state.lastBattle;
    assert.ok(battle);
    const damageEvents = battle.events.filter(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.equal(damageEvents.length, 2 + scenario.expectedAdjacent);
    assert.ok(damageEvents.every(isCombatPlaybackEvent));
    assert.ok(
      damageEvents.every(
        (event) => event.amount === scenario.expectedDamage,
      ),
    );
    assert.equal(
      damageEvents.filter(
        (event) => event.targetInstanceId === primary.instanceId,
      ).length,
      2,
    );
    assert.equal(
      damageEvents.filter(
        (event) =>
          event.targetInstanceId === left.instanceId ||
          event.targetInstanceId === right.instanceId,
      ).length,
      scenario.expectedAdjacent,
    );
    assert.equal(
      new Set(
        damageEvents
          .filter(
            (event) =>
              event.targetInstanceId === left.instanceId ||
              event.targetInstanceId === right.instanceId,
          )
          .map((event) => event.targetInstanceId),
      ).size,
      scenario.expectedAdjacent,
    );

    const rallyTriggers = battle.events.filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === source.instanceId &&
        event.message.includes("进击将对"),
    );
    assert.equal(rallyTriggers.length, 1 + scenario.expectedAdjacent);
    assert.ok(rallyTriggers.every(isCombatPlaybackEvent));
    assert.equal(
      battle.events.some(
        (event) =>
          event.type === "buff" &&
          event.actorInstanceId === source.instanceId,
      ),
      false,
    );
  }
});

test("lethal Obsidian Ravager Rally damage resolves deaths before the ordinary strike", () => {
  const scenarios = [
    { golden: false, damage: 7, expectedAdjacentDeaths: 1 },
    { golden: true, damage: 14, expectedAdjacentDeaths: 2 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x7420 + index);
    const source = scenario.golden
      ? goldenMinion("BG27_017", `lethal-obsidian-source-${index}`)
      : definitionMinion(
          "BG27_017",
          `lethal-obsidian-source-${index}`,
        );
    const fillers = Array.from({ length: 3 }, (_, fillerIndex) =>
      definitionMinion(
        "defender-of-argus",
        `lethal-obsidian-filler-${index}-${fillerIndex}`,
        { attack: 0, health: 100, taunt: false },
      ),
    );
    const adjacent = ["left", "right"].map((side) =>
      definitionMinion(
        "defender-of-argus",
        `lethal-obsidian-${side}-${index}`,
        {
          attack: 1_000,
          health: scenario.damage,
          taunt: false,
        },
      ),
    );
    const primary = definitionMinion(
      "defender-of-argus",
      `lethal-obsidian-primary-${index}`,
      {
        attack: 1_000,
        health: scenario.damage,
        taunt: true,
      },
    );
    isolateCombat(
      state,
      [source, ...fillers],
      [adjacent[0], primary, adjacent[1]],
    );

    state = gameReducer(state, { type: "END_TURN" });
    const battle = state.lastBattle;
    assert.ok(battle);
    const sourceDamage = battle.events.filter(
      (event) =>
        event.type === "damage" &&
        event.actorInstanceId === source.instanceId,
    );
    assert.equal(
      sourceDamage.filter(
        (event) => event.targetInstanceId === primary.instanceId,
      ).length,
      1,
    );
    const primaryDeath = battle.events.find(
      (event) =>
        event.type === "death" &&
        event.actorInstanceId === primary.instanceId,
    );
    assert.ok(primaryDeath);
    assert.ok(isCombatPlaybackEvent(primaryDeath));
    const rallyTriggers = battle.events.filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === source.instanceId &&
        event.message.includes("进击将对") &&
        event.index < primaryDeath.index,
    );
    const adjacentRallyTargetIds = new Set(
      rallyTriggers
        .map((event) => event.targetInstanceId)
        .filter(
          (instanceId): instanceId is string =>
            instanceId !== undefined && instanceId !== primary.instanceId,
        ),
    );
    assert.equal(
      adjacentRallyTargetIds.size,
      scenario.expectedAdjacentDeaths,
    );
    const rallyDeaths = battle.events.filter(
      (event) =>
        event.type === "death" &&
        (event.actorInstanceId === primary.instanceId ||
          adjacentRallyTargetIds.has(event.actorInstanceId ?? "")),
    );
    assert.equal(rallyDeaths.length, 1 + scenario.expectedAdjacentDeaths);
    assert.ok(rallyDeaths.every(isCombatPlaybackEvent));
    const firstRallyDeathIndex = Math.min(
      ...rallyDeaths.map((event) => event.index),
    );
    const firstPulseDamage = sourceDamage.filter(
      (event) => event.index < firstRallyDeathIndex,
    );
    assert.equal(
      firstPulseDamage.length,
      1 + scenario.expectedAdjacentDeaths,
    );
    assert.deepEqual(
      new Set(firstPulseDamage.map((event) => event.targetInstanceId)),
      new Set([primary.instanceId, ...adjacentRallyTargetIds]),
    );
  }
});
