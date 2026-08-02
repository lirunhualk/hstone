import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BattleEvent,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const STITCHED_SALVAGER_DEFINITION_ID = "BG31_999";
const TITUS_DEFINITION_ID = "BG25_354";
const LEFT_VICTIM_DEFINITION_ID = "BG20_301";
const RIGHT_VICTIM_DEFINITION_ID = "BG20_100";

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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
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

function enemyWall(instanceId: string): BoardMinionInstance {
  return definitionMinion(LEFT_VICTIM_DEFINITION_ID, instanceId, {
    attack: 100,
    health: 1_000_000,
    taunt: true,
    reborn: false,
  });
}

function durableFiller(instanceId: string): BoardMinionInstance {
  return definitionMinion(LEFT_VICTIM_DEFINITION_ID, instanceId, {
    attack: 0,
    health: 1_000_000,
    stealth: true,
    reborn: false,
  });
}

function prepareDuel(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): { human: PlayerState; enemy: PlayerState } {
  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  for (const player of state.players) {
    const alive = player.id === human.id || player.id === enemy.id;
    player.alive = alive;
    player.health = alive ? 1_000 : 0;
    player.armor = 0;
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = alive ? undefined : state.round;
  }
  human.board = humanBoard;
  enemy.board = enemyBoard;
  return { human, enemy };
}

function battleForPlayer(
  state: GameState,
  playerId: string,
): BattleSummary {
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === playerId || candidate.playerBId === playerId,
  );
  assert.ok(battle);
  return battle;
}

function stitchedSummons(
  events: readonly BattleEvent[],
  actorInstanceId?: string,
): BattleEvent[] {
  return events.filter(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "stitchedSalvagerCopy" &&
      (actorInstanceId === undefined ||
        event.actorInstanceId === actorInstanceId),
  );
}

test("Stitched Salvager exposes exact ordinary and Golden rules", () => {
  const definition = getMinionDefinition(STITCHED_SALVAGER_DEFINITION_ID);
  assert.deepEqual(
    [
      definition.name,
      definition.tier,
      definition.attack,
      definition.health,
      definition.tribe,
      definition.effectSupport,
    ],
    ["缝合回收者", 7, 16, 4, "undead", "complete"],
  );
  assert.deepEqual(definition.printedMechanics, [
    "DEATHRATTLE",
    "START_OF_COMBAT",
    "TRIGGER_VISUAL",
  ]);
  assert.equal(
    definition.description,
    "战斗开始时：消灭本随从左边的随从。亡语：召唤被消灭随从的完全相同的复制。（缝合回收者除外。）",
  );
  assert.equal(definition.goldenCardId, "BG31_999_G");
  assert.equal(
    definition.goldenDescription,
    "战斗开始时：消灭相邻的随从。亡语：召唤被消灭随从的完全相同的复制。（缝合回收者除外。）",
  );
  assert.deepEqual(definition.startOfCombat, [
    {
      kind: "destroyNeighborsForStitchedSalvager",
      goldenMode: "adjacent",
    },
  ]);
  assert.deepEqual(definition.deathrattle, [
    { kind: "summonStitchedSalvagerCopies" },
  ]);
});

test("ordinary Stitched Salvager stores an exact combat copy and never mutates the Recruit board", () => {
  const state = createGame(0xd600);
  const victim = goldenMinion(
    LEFT_VICTIM_DEFINITION_ID,
    "exact-victim",
    {
      attack: 37,
      health: 41,
      taunt: true,
      divineShield: true,
      reborn: false,
      windfury: true,
      description: "精确复制测试文本",
      effectCounters: { exactCounter: 3 },
      grantsTripleReward: true,
      poolCopies: 3,
      poolCopiesByDefinitionId: {
        [LEFT_VICTIM_DEFINITION_ID]: 3,
      },
      attachments: [
        {
          sourceInstanceId: "exact-attachment",
          definitionId: RIGHT_VICTIM_DEFINITION_ID,
          cardId: RIGHT_VICTIM_DEFINITION_ID,
          name: "精确磁力组件",
          description: "组件文本",
          effectSupport: "complete",
          golden: false,
          poolCopies: 1,
          attackGranted: 5,
          healthGranted: 7,
          attachments: [],
        },
      ],
    },
  );
  const source = definitionMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "exact-source",
    { attack: 0, health: 1, taunt: true },
  );
  const { human } = prepareDuel(
    state,
    [victim, source],
    [enemyWall("exact-enemy")],
  );
  const recruitBoardBefore = structuredClone(human.board);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = battleForPlayer(combat, human.id);
  const summons = stitchedSummons(battle.events, source.instanceId);
  assert.equal(summons.length, 1);
  const copy = summons[0].minion;
  assert.ok(copy);
  assert.notEqual(copy.instanceId, victim.instanceId);
  assert.deepEqual(
    {
      definitionId: copy.definitionId,
      cardId: copy.cardId,
      name: copy.name,
      attack: copy.attack,
      health: copy.health,
      golden: copy.golden,
      taunt: copy.taunt,
      divineShield: copy.divineShield,
      reborn: copy.reborn,
      windfury: copy.windfury,
      description: copy.description,
      effectCounters: copy.effectCounters,
    },
    {
      definitionId: victim.definitionId,
      cardId: victim.cardId,
      name: victim.name,
      attack: victim.attack,
      health: victim.health,
      golden: victim.golden,
      taunt: victim.taunt,
      divineShield: victim.divineShield,
      reborn: victim.reborn,
      windfury: victim.windfury,
      description: victim.description,
      effectCounters: victim.effectCounters,
    },
  );
  assert.equal(copy.poolCopies, 0);
  assert.equal(copy.poolCopiesByDefinitionId, undefined);
  assert.equal(copy.grantsTripleReward, false);
  assert.deepEqual(copy.attachments, [
    {
      ...victim.attachments[0],
      poolCopies: 0,
      attachments: [],
    },
  ]);

  const destroyEvent = battle.events.find(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === victim.instanceId,
  );
  const victimDeath = battle.events.find(
    (event) =>
      event.type === "death" && event.actorInstanceId === victim.instanceId,
  );
  const sourceDeath = battle.events.find(
    (event) =>
      event.type === "death" && event.actorInstanceId === source.instanceId,
  );
  assert.ok(destroyEvent);
  assert.ok(victimDeath);
  assert.ok(sourceDeath);
  assert.ok(destroyEvent.index < victimDeath.index);
  assert.ok(victimDeath.index < sourceDeath.index);
  assert.ok(sourceDeath.index < summons[0].index);
  assert.deepEqual(humanPlayer(combat).board, recruitBoardBefore);
});

test("an exact Stitched Salvager copy does not apply an existing combat aura twice", () => {
  const state = createGame(0xd605);
  const auraSource = definitionMinion(
    "murloc-warleader",
    "aura-source",
    { attack: 0, health: 1_000_000, stealth: true },
  );
  const victim = definitionMinion(
    "murloc-tidehunter",
    "aura-victim",
    { attack: 10, health: 20 },
  );
  const source = definitionMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "aura-salvager",
    { attack: 0, health: 1, taunt: true },
  );
  const { human } = prepareDuel(
    state,
    [auraSource, victim, source],
    [enemyWall("aura-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const summons = stitchedSummons(
    battleForPlayer(combat, human.id).events,
    source.instanceId,
  );
  assert.equal(summons.length, 1);
  assert.equal(summons[0].minion?.attack, 12);
  assert.equal(summons[0].minion?.health, 20);
});

test("Golden Stitched Salvager destroys both adjacent minions and summons both exact copies", () => {
  const state = createGame(0xd601);
  const left = definitionMinion(
    LEFT_VICTIM_DEFINITION_ID,
    "golden-left",
    { attack: 11, health: 13 },
  );
  const source = goldenMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "golden-source",
    { attack: 0, health: 1, taunt: true },
  );
  const right = definitionMinion(
    RIGHT_VICTIM_DEFINITION_ID,
    "golden-right",
    { attack: 17, health: 19 },
  );
  const { human } = prepareDuel(
    state,
    [left, source, right],
    [enemyWall("golden-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = battleForPlayer(combat, human.id);
  const destroyedTargets = battle.events
    .filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === source.instanceId &&
        (event.targetInstanceId === left.instanceId ||
          event.targetInstanceId === right.instanceId),
    )
    .map((event) => event.targetInstanceId);
  assert.deepEqual(destroyedTargets, [left.instanceId, right.instanceId]);
  const summons = stitchedSummons(battle.events, source.instanceId);
  assert.equal(summons.length, 2);
  assert.deepEqual(
    summons.map((event) => [
      event.minion?.definitionId,
      event.minion?.attack,
      event.minion?.health,
    ]),
    [
      [left.definitionId, left.attack, left.health],
      [right.definitionId, right.attack, right.health],
    ],
  );
});

test("Stitched Salvager excludes adjacent Stitched Salvagers", () => {
  const state = createGame(0xd602);
  const victim = definitionMinion(
    LEFT_VICTIM_DEFINITION_ID,
    "excluded-left-victim",
    { attack: 0, health: 1 },
  );
  const source = goldenMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "excluded-golden-source",
    { attack: 0, health: 1, taunt: true },
  );
  const excluded = definitionMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "excluded-right-salvager",
    { attack: 0, health: 1, taunt: true },
  );
  const { human } = prepareDuel(
    state,
    [victim, source, excluded],
    [enemyWall("excluded-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = battleForPlayer(combat, human.id);
  const sourceDestroyEvents = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId &&
      event.message.includes("保存了它的完全相同复制"),
  );
  assert.deepEqual(
    sourceDestroyEvents.map((event) => event.targetInstanceId),
    [victim.instanceId],
  );
  assert.equal(
    sourceDestroyEvents.some(
      (event) => event.targetInstanceId === excluded.instanceId,
    ),
    false,
  );
  const summons = stitchedSummons(battle.events, source.instanceId);
  assert.equal(summons.length, 1);
  assert.equal(summons[0].minion?.definitionId, victim.definitionId);
});

test("Titus repeats the complete Golden Deathrattle and a full board rejects only the fourth exact copy", () => {
  const state = createGame(0xd603);
  const left = definitionMinion(
    LEFT_VICTIM_DEFINITION_ID,
    "full-left",
    { attack: 11, health: 13 },
  );
  const source = goldenMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "full-source",
    { attack: 0, health: 1, taunt: true },
  );
  const right = definitionMinion(
    RIGHT_VICTIM_DEFINITION_ID,
    "full-right",
    { attack: 17, health: 19 },
  );
  const titus = definitionMinion(TITUS_DEFINITION_ID, "full-titus", {
    attack: 0,
    health: 1_000_000,
    stealth: true,
  });
  const { human } = prepareDuel(
    state,
    [
      left,
      source,
      right,
      titus,
      durableFiller("full-filler-1"),
      durableFiller("full-filler-2"),
      durableFiller("full-filler-3"),
    ],
    [enemyWall("full-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const summons = stitchedSummons(
    battleForPlayer(combat, human.id).events,
    source.instanceId,
  );
  assert.equal(summons.length, 3);
  assert.equal(
    summons.filter(
      (event) => event.minion?.definitionId === left.definitionId,
    ).length,
    2,
  );
  assert.equal(
    summons.filter(
      (event) => event.minion?.definitionId === right.definitionId,
    ).length,
    1,
  );
  assert.equal(
    new Set(summons.map((event) => event.targetInstanceId)).size,
    3,
  );
});

test("multiple Stitched Salvagers keep their stored exact copies isolated", () => {
  const state = createGame(0xd604);
  const firstVictim = definitionMinion(
    LEFT_VICTIM_DEFINITION_ID,
    "isolated-first-victim",
    { attack: 3, health: 5 },
  );
  const firstSource = definitionMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "isolated-first-source",
    { attack: 0, health: 1, taunt: true },
  );
  const secondVictim = definitionMinion(
    RIGHT_VICTIM_DEFINITION_ID,
    "isolated-second-victim",
    { attack: 7, health: 11 },
  );
  const secondSource = definitionMinion(
    STITCHED_SALVAGER_DEFINITION_ID,
    "isolated-second-source",
    { attack: 0, health: 1, taunt: true },
  );
  const { human } = prepareDuel(
    state,
    [firstVictim, firstSource, secondVictim, secondSource],
    [enemyWall("isolated-enemy")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = battleForPlayer(combat, human.id).events;
  const firstSummons = stitchedSummons(events, firstSource.instanceId);
  const secondSummons = stitchedSummons(events, secondSource.instanceId);
  assert.equal(firstSummons.length, 1);
  assert.equal(secondSummons.length, 1);
  assert.deepEqual(
    [
      firstSummons[0].minion?.definitionId,
      firstSummons[0].minion?.attack,
      secondSummons[0].minion?.definitionId,
      secondSummons[0].minion?.attack,
    ],
    [
      firstVictim.definitionId,
      firstVictim.attack,
      secondVictim.definitionId,
      secondVictim.attack,
    ],
  );
});
