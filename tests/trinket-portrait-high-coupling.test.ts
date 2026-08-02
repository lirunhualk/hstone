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
import type { TrinketDefinition } from "../lib/game/lobby-systems.ts";

const RYLAK_PORTRAIT_CARD_ID = "BG35_MagicItem_834";
const TIDE_RAISER_PORTRAIT_CARD_ID = "BG35_MagicItem_922";

function trinketForCard(cardId: string): TrinketDefinition {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be in the active Trinket pool`);
  return definition;
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
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function resolveTrinket(
  state: GameState,
  definition: TrinketDefinition,
): GameState {
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `choose-${definition.cardId}`,
    playerId: player.id,
    sourceInstanceId: `source-${definition.cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: definition.id,
  });
}

function prepareCombat(state: GameState): [PlayerState, PlayerState] {
  state.lobbySystemsEnabled = false;
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

test("Rylak and Tide Raiser Portraits grant their printed minions on acquisition", () => {
  let state = resolveTrinket(
    createGame(0xf101, 999),
    trinketForCard(RYLAK_PORTRAIT_CARD_ID),
  );
  assert.equal(
    humanPlayer(state).hand.some(
      (card) => card.kind === "minion" && card.definitionId === "BG26_801",
    ),
    true,
  );

  state = resolveTrinket(
    createGame(0xf102, 999),
    trinketForCard(TIDE_RAISER_PORTRAIT_CARD_ID),
  );
  assert.equal(
    humanPlayer(state).hand.some(
      (card) => card.kind === "minion" && card.definitionId === "BG34_920",
    ),
    true,
  );
});

test("Tide Raiser Portrait copies at most three combat Tavern Spells into the persistent hand", () => {
  const state = createGame(0xf103, 999);
  const [human, enemy] = prepareCombat(state);
  const portrait = trinketForCard(TIDE_RAISER_PORTRAIT_CARD_ID);
  human.trinketIds = [portrait.id];
  human.trinketCounters = { [portrait.id]: 0 };
  human.board = [
    ...Array.from({ length: 4 }, (_, index) =>
      minion("BG34_920", `portrait-tide-${index}`, {
        attack: 0,
        health: 1,
        taunt: true,
      }),
    ),
    minion("BG29_611", "portrait-tide-survivor", {
      attack: 0,
      health: 1_000,
    }),
  ];
  enemy.board = [
    minion("BG29_611", "portrait-tide-wall", {
      attack: 100,
      health: 10_000,
      taunt: true,
      divineShield: false,
    }),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.ok(combat.lastBattle);
  const copiedSpells = humanPlayer(combat).hand.filter(
    (card) =>
      card.kind === "tavernSpell" &&
      card.definitionId === "tavern-spell-shifting-tide",
  );
  assert.equal(copiedSpells.length, 3);
  const copyEvents = combat.lastBattle.events.filter(
    (event) =>
      event.type === "cardGain" &&
      event.actorInstanceId === portrait.id,
  );
  assert.equal(copyEvents.length, 3);
  assert.ok(copyEvents.every((event) => event.cardGainResult === "added"));
  assert.ok((humanPlayer(combat).tavernSpellsCast ?? 0) >= 4);
});

test("Rylak Portrait triggers Rylak Deathrattles at combat start through Titus and Brann", () => {
  const state = createGame(0xf104, 999);
  const [human, enemy] = prepareCombat(state);
  const portrait = trinketForCard(RYLAK_PORTRAIT_CARD_ID);
  human.trinketIds = [portrait.id];
  human.trinketCounters = { [portrait.id]: 0 };
  const recipient = minion("wrath-weaver", "rylak-buff-recipient");
  human.board = [
    minion("titus-rivendare", "rylak-titus"),
    minion("BG_LOE_077", "rylak-brann"),
    recipient,
    minion("BG26_801", "rylak-source"),
    minion("nathrezim-overseer", "rylak-battlecry"),
  ];
  enemy.board = [
    minion("BG29_611", "rylak-enemy-wall", {
      attack: 100,
      health: 10_000,
      taunt: true,
      divineShield: false,
    }),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.ok(combat.lastBattle);
  const firstAttackIndex =
    combat.lastBattle.events.find(
      (event) => event.type === "attack",
    )?.index ?? Number.POSITIVE_INFINITY;
  const precombatBuffs = combat.lastBattle.events.filter(
    (event) =>
      event.index < firstAttackIndex &&
      event.type === "buff" &&
      event.actorInstanceId === "rylak-battlecry" &&
      event.targetInstanceId === recipient.instanceId,
  );
  assert.equal(precombatBuffs.length, 4);
  assert.deepEqual(
    [
      precombatBuffs.at(-1)?.minion?.attack,
      precombatBuffs.at(-1)?.minion?.health,
    ],
    [recipient.attack + 8, recipient.health + 8],
  );
  assert.ok(
    combat.lastBattle.events.some(
      (event) =>
        event.type === "startOfCombat" &&
        event.actorInstanceId === portrait.id,
    ),
  );
});
