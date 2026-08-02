import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import {
  getMinionDefinition,
} from "../lib/game/content.ts";
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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
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

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): void {
  state.lobbySystemsEnabled = false;
  const enemy = state.players.find((player) => !player.isHuman);
  assert.ok(enemy);
  for (const player of state.players) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.isHuman) {
      player.alive = true;
      player.health = 1_000;
    } else if (player.id === enemy.id) {
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

function runKodoCombat(golden: boolean): {
  state: GameState;
  kodo: BoardMinionInstance;
} {
  const state = createGame(golden ? 0xc0d02 : 0xc0d01);
  const player = humanPlayer(state);
  const kodo = (golden ? goldenMinion : minion)(
    "BG34_322",
    golden ? "golden-stalwart-kodo" : "stalwart-kodo",
    { attack: 21, health: 50, taunt: false },
  );
  const summoner = minion(
    "BG30_125",
    golden ? "golden-kodo-summoner" : "kodo-summoner",
    {
      attack: 0,
      health: 1,
      golden: true,
      taunt: true,
      reborn: false,
    },
  );
  player.board = [kodo, summoner];

  const cleaver = minion(
    "defender-of-argus",
    golden ? "golden-kodo-cleaver" : "kodo-cleaver",
    { attack: 10, health: 1_000, taunt: false, cleave: true },
  );
  prepareDuel(state, [
    cleaver,
    minion("defender-of-argus", "kodo-enemy-2", {
      attack: 0,
      health: 1_000,
      taunt: false,
    }),
    minion("defender-of-argus", "kodo-enemy-3", {
      attack: 0,
      health: 1_000,
      taunt: false,
    }),
  ]);
  return {
    state: gameReducer(state, { type: "END_TURN" }),
    kodo,
  };
}

test("Stalwart Kodo exposes exact ordinary and Golden summon rules", () => {
  const definition = getMinionDefinition("BG34_322");
  assert.equal(definition.name, "坚韧的科多兽");
  assert.equal(definition.effectSupport, "complete");
  assert.equal(definition.goldenCardId, "BG34_322_G");
  assert.equal(
    definition.description,
    "在战斗中，在你召唤一个随从后，使其获得本随从的最大属性值。（每场战斗限3次。）",
  );
  assert.equal(
    definition.goldenDescription,
    "在战斗中，在你召唤一个随从后，使其获得两倍本随从的最大属性值。（每场战斗限3次。）",
  );
  assert.deepEqual(definition.afterFriendlySummoned, {
    tribe: "all",
    combatOnly: true,
    giveSourceMaximumStats: true,
    maximumTriggersPerCombat: 3,
    goldenMode: "doubleStats",
  });
});

for (const golden of [false, true]) {
  test(`${golden ? "Golden" : "ordinary"} Stalwart Kodo grants maximum stats to only the first three combat summons`, () => {
    const { state, kodo } = runKodoCombat(golden);
    const battle = state.lastBattle;
    assert.ok(battle);
    const summons = battle.events.filter(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "live-skeleton-token",
    );
    const buffs = battle.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === kodo.instanceId &&
        event.minion?.definitionId === "live-skeleton-token",
    );
    assert.equal(summons.length, 6);
    assert.equal(buffs.length, 3);
    assert.ok(buffs.every(isCombatPlaybackEvent));
    assert.deepEqual(
      buffs.map((event) => [event.attackDelta, event.healthDelta]),
      Array.from({ length: 3 }, () => [
        golden ? 42 : 21,
        golden ? 100 : 50,
      ]),
    );
    assert.ok(
      buffs.every(
        (event) =>
          event.actorMinion?.health === 40 && event.retained === false,
      ),
      "the Kodo was damaged to 40 current Health but still granted its 50 maximum Health",
    );
    assert.ok(
      buffs.every(
        (event) =>
          summons.some(
            (summon) =>
              summon.targetInstanceId === event.targetInstanceId,
          ),
      ),
    );
  });
}
