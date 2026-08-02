import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
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
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
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

test("Monstrous Macaw Portrait grants a Monstrous Macaw", () => {
  let state = createGame(0x8031);
  const player = humanPlayer(state);
  player.hand = [];
  player.gold = 100;
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === "BG32_MagicItem_803",
  );
  assert.ok(trinket);
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "choose-macaw-portrait",
    playerId: player.id,
    sourceInstanceId: "macaw-offer",
    trinketTier: trinket.tier,
    optionIds: [trinket.id],
  };

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "choose-macaw-portrait",
    optionInstanceId: trinket.id,
  });

  assert.equal(humanPlayer(state).hand[0]?.definitionId, "BGS_078");
});

test("portrait Macaws Rally both the leftmost Deathrattle and Battlecry", () => {
  let state = createGame(0x8032);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  const human = humanPlayer(state);
  const enemy = state.players.find((player) => player.id !== human.id);
  assert.ok(enemy);
  enemy.isHuman = true;
  for (const player of state.players) {
    if (player.id === human.id || player.id === enemy.id) {
      player.alive = true;
      player.heroPowerId = null;
      continue;
    }
    player.alive = false;
    player.health = 0;
  }
  human.board = [
    definitionMinion("alleycat", "macaw-battlecry"),
    definitionMinion("spawn-of-nzoth", "macaw-deathrattle"),
    definitionMinion("BGS_078", "portrait-macaw", { attack: 10 }),
  ];
  human.hand = [];
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === "BG32_MagicItem_803",
  );
  assert.ok(trinket);
  human.trinketIds = [trinket.id];
  human.trinketCounters = { [trinket.id]: 0 };
  enemy.board = [
    definitionMinion("dragonspawn-lieutenant", "macaw-enemy", {
      attack: 0,
      health: 100,
      taunt: false,
    }),
  ];
  enemy.hand = [];

  state = gameReducer(state, { type: "END_TURN" });

  const events = state.lastBattle?.events ?? [];
  assert.ok(
    events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === "portrait-macaw" &&
        event.targetInstanceId === "macaw-deathrattle",
    ),
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === "portrait-macaw" &&
        event.targetInstanceId === "macaw-battlecry",
    ),
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === "summon" &&
        event.minion?.definitionId === "tabbycat-token",
    ),
  );
});
