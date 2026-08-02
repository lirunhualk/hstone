import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  trinketsForTier,
  type BattleSummary,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
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

function preparePlayers(state: GameState): [PlayerState, PlayerState] {
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.board = [];
    player.trinketIds = [];
    player.trinketCounters = {};
    player.eliminatedRound = undefined;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
    }
  }
  const human = state.players[0];
  const enemy = state.players[1];
  human.alive = true;
  human.health = 100;
  enemy.alive = true;
  enemy.health = 100;
  return [human, enemy];
}

function equipTrinket(player: PlayerState, cardId: string): string {
  const trinket = [
    ...trinketsForTier("lesser"),
    ...trinketsForTier("greater"),
  ].find((candidate) => candidate.cardId === cardId);
  assert.ok(trinket, `missing Trinket ${cardId}`);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  return trinket.id;
}

function fight(state: GameState): { state: GameState; battle: BattleSummary } {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.ok(combat.lastBattle);
  return { state: combat, battle: combat.lastBattle };
}

function passiveWall(
  instanceId: string,
  attack = 1,
): BoardMinionInstance {
  return minion("BG29_611", instanceId, {
    attack,
    health: 1_000,
    taunt: true,
    divineShield: false,
  });
}

test("Herald Sticker triggers every existing friendly Deathrattle before attacks", () => {
  const state = createGame(0xf501);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG32_MagicItem_306");
  human.board = [
    minion("goldrinn", "herald-goldrinn"),
    minion("rat-pack", "herald-rat-pack"),
  ];
  enemy.board = [passiveWall("herald-wall", 100)];

  const { battle } = fight(state);
  const firstAttack = battle.events.findIndex(
    (event) => event.type === "attack",
  );
  assert.ok(firstAttack > 0);
  const openingEvents = battle.events.slice(0, firstAttack);
  assert.deepEqual(
    openingEvents
      .filter(
        (event) => event.type === "trigger" && event.actorInstanceId === trinketId,
      )
      .map((event) => event.targetInstanceId),
    ["herald-goldrinn", "herald-rat-pack"],
  );
  assert.equal(
    openingEvents.filter(
      (event) =>
        event.type === "buff" && event.actorInstanceId === "herald-goldrinn",
    ).length,
    2,
  );
  const rats = openingEvents.filter(
    (event) => event.type === "summon" && event.actorInstanceId === "herald-rat-pack",
  );
  assert.equal(rats.length, 5, "Goldrinn buffs Rat Pack before its Deathrattle");
  assert.ok(
    rats.every(
      (event) => event.minion?.attack === 9 && event.minion.health === 9,
    ),
  );
});

test("Fang Anklet grows on Recruit and combat Beast summons without changing this combat's aura", () => {
  let state = createGame(0xf502);
  let [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_701");
  human.hand = [
    minion("rat-pack", "fang-rat-pack", {
      attack: 2,
      health: 1,
      taunt: true,
    }),
  ];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = state.players[0];
  enemy = state.players[1];
  assert.equal(human.trinketCounters[trinketId], 1);
  enemy.board = [passiveWall("fang-wall", 100)];

  const { state: combat, battle } = fight(state);
  const openingBuff = battle.events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === trinketId &&
      event.targetInstanceId === "fang-rat-pack",
  );
  assert.ok(openingBuff);
  assert.equal(openingBuff.attackDelta, 2);
  assert.equal(openingBuff.healthDelta, 2);

  const summonedRats = battle.events.filter(
    (event) => event.type === "summon" && event.actorInstanceId === "fang-rat-pack",
  );
  assert.equal(summonedRats.length, 4);
  assert.ok(
    summonedRats.every(
      (event) => event.minion?.attack === 3 && event.minion.health === 3,
    ),
    "all combat summons keep the +2/+2 aura fixed for the current combat",
  );
  assert.deepEqual(
    battle.events
      .filter(
        (event) =>
          event.type === "trigger" && event.actorInstanceId === trinketId,
      )
      .map((event) => event.amount),
    [3, 4, 5, 6],
  );
  assert.equal(combat.players[0].trinketCounters[trinketId], 5);

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(combat)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  assert.equal(restored.players[0].trinketCounters[trinketId], 5);
});

test("Deathtouch Apple restores Reborn only three times per combat and resets next combat", () => {
  let state = createGame(0xf503);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_731");
  human.board = [minion("BG25_001", "apple-undead")];
  enemy.board = [passiveWall("apple-wall")];

  let result = fight(state);
  for (let combatNumber = 1; combatNumber <= 2; combatNumber += 1) {
    assert.equal(
      result.battle.events.filter(
        (event) => event.type === "buff" && event.actorInstanceId === trinketId,
      ).length,
      3,
      `combat ${combatNumber}`,
    );
    assert.equal(
      result.battle.events.filter(
        (event) => event.type === "summon" && event.summonReason === "reborn",
      ).length,
      4,
      `combat ${combatNumber}`,
    );
    if (combatNumber === 1) {
      state = gameReducer(result.state, { type: "CONTINUE" });
      assert.equal(state.phase, "recruit");
      result = fight(state);
    }
  }
});

test("Deathtouch Apple ignores a non-Undead that Reborns", () => {
  const state = createGame(0xf504);
  const [human, enemy] = preparePlayers(state);
  const trinketId = equipTrinket(human, "BG35_MagicItem_731");
  human.board = [
    minion("murloc-tidehunter", "apple-murloc", {
      health: 1,
      reborn: true,
      taunt: true,
    }),
  ];
  enemy.board = [passiveWall("apple-non-undead-wall")];

  const { battle } = fight(state);
  assert.equal(
    battle.events.filter(
      (event) => event.type === "buff" && event.actorInstanceId === trinketId,
    ).length,
    0,
  );
  assert.equal(
    battle.events.filter(
      (event) => event.type === "summon" && event.summonReason === "reborn",
    ).length,
    1,
  );
});
