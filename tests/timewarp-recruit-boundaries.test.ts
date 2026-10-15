import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import { createGame, gameReducer, getTavernSpellDefinition } from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { BoardMinionInstance, GameState, PlayerState, TavernSpellInstance, Tribe } from "../lib/game/types.ts";

const ALL_TRIBES: Tribe[] = [
  "beast", "demon", "dragon", "elemental", "mech",
  "murloc", "naga", "pirate", "quilboar", "undead",
];

function human(state: GameState): PlayerState {
  const player = state.players.find((candidate) => candidate.id === state.humanPlayerId);
  assert.ok(player);
  return player;
}

function setup(): GameState {
  const state = createGame(0x34b0);
  state.activeTribes = [...ALL_TRIBES];
  const player = human(state);
  player.board = [];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.gold = 100;
  player.heroPowerId = null;
  return state;
}

function minion(definitionId: string, instanceId: string, golden = false): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    kind: "minion", instanceId, definitionId,
    cardId: golden ? definition.goldenCardId ?? `${definition.cardId}_G` : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier, tribe: definition.tribe,
    tribes: [...(definition.tribes ?? (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete", sellValue: definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1), health: definition.health * (golden ? 2 : 1),
    golden, taunt: !!definition.taunt, divineShield: !!definition.divineShield,
    reborn: !!definition.reborn, stealth: !!definition.stealth,
    poisonous: !!definition.poisonous, venomous: !!definition.venomous,
    windfury: !!definition.windfury, cleave: !!definition.cleave,
    alwaysAttacksLowestAttack: !!definition.alwaysAttacksLowestAttack,
    description: golden ? definition.goldenDescription ?? definition.description : definition.description,
    whereverAttackBonus: 0, whereverHealthBonus: 0,
    astralAutomatonSummoned: false, ancientSoulFriendlyDeaths: 0,
    effectCounters: {}, bloodGemAttack: 0, bloodGemHealth: 0,
    temporaryAttack: 0, temporaryHealth: 0, temporaryTaunt: false,
    temporaryDivineShield: false, temporaryVenomous: false,
    temporaryCrabDeathrattles: 0, temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0, goldenCrabDeathrattles: 0,
    grantsTripleReward: false, poolCopies: 0, attachments: [],
  };
}

function restored(state: GameState): GameState {
  const normalized = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState | null;
  assert.ok(normalized, "the pending recruit state must survive JSON reload");
  return normalized;
}

function onBoard(state: GameState, instanceId: string): BoardMinionInstance {
  const card = human(state).board.find((candidate) => candidate.instanceId === instanceId);
  assert.ok(card);
  return card;
}

for (const golden of [false, true]) {
  const version = golden ? "Golden" : "normal";

  test(`Timewarped Interpreter counts a Mech play and its generated Magnetic Discover separately (${version})`, () => {
    let state = setup();
    const player = human(state);
    const interpreter = minion("BG34_Giant_120", "interpreter", golden);
    player.board = [interpreter, minion("BG29_611", "host")];
    player.hand = [minion("BG29_503", "generating-mech")];
    for (const definitionId of Object.keys(state.pool)) state.pool[definitionId] = 0;
    state.pool.BG29_611 = 3;

    state = gameReducer(state, { type: "PLAY_HAND_CARD", cardInstanceId: "generating-mech" });
    assert.equal(state.pendingInteraction?.kind, "magnetizeTarget");
    state = restored(state);
    let pending = state.pendingInteraction;
    assert.ok(pending?.kind === "magnetizeTarget");
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION", interactionId: pending.interactionId, optionInstanceId: "host",
    });
    state = restored(state);
    pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover");
    assert.equal(pending.destination.kind, "magnetize");
    assert.equal(pending.options[0]?.definitionId, "BG29_611");
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION", interactionId: pending.interactionId,
      optionInstanceId: pending.options[0]!.instanceId,
    });

    const amount = 3 * (golden ? 2 : 1) * 2;
    assert.equal(onBoard(state, "interpreter").attack, interpreter.attack + amount);
    assert.equal(onBoard(state, "interpreter").health, interpreter.health + amount);
    assert.equal(human(state).magnetizationsThisGame, 1);
    assert.equal(human(state).cardsPlayedThisTurn, 1);
    assert.equal(onBoard(state, "host").attachments?.length, 1);
  });

  test(`Timewarped Embalmer excludes its own play and retains the ${golden ? 2 : 1}-summon quota through reload (${version})`, () => {
    let state = setup();
    const player = human(state);
    const following = [
      minion("BGS_004", "following-one"),
      minion("BG29_611", "following-two"),
      minion("BG26_146", "following-three"),
    ];
    assert.ok(following.every((card) => !card.reborn));
    player.hand = [minion("BG34_Giant_332", "embalmer", golden), ...following];

    state = gameReducer(state, { type: "PLAY_HAND_CARD", cardInstanceId: "embalmer" });
    assert.equal(onBoard(state, "embalmer").reborn, false, "a newly played observer cannot consume its own summon quota");
    assert.equal(onBoard(state, "embalmer").effectCounters?.timewarpSummons ?? 0, 0);
    state = restored(state);

    const limit = golden ? 2 : 1;
    for (let index = 0; index < following.length; index += 1) {
      const card = following[index]!;
      state = gameReducer(state, { type: "PLAY_HAND_CARD", cardInstanceId: card.instanceId });
      assert.equal(onBoard(state, card.instanceId).reborn, index < limit, `summon ${index + 1}`);
      state = restored(state);
      assert.equal(onBoard(state, card.instanceId).reborn, index < limit, `saved summon ${index + 1}`);
    }
    assert.equal(onBoard(state, "embalmer").effectCounters?.timewarpSummons, state.round * 100 + limit);
  });

  test(`Timewarped Electron Magnetizes the dedicated 4/4 Satellite identity after two real Tavern casts (${version})`, () => {
    let state = setup();
    const player = human(state);
    player.board = [minion("BG34_Giant_610", "electron", golden), minion("BG29_611", "satellite-host")];
    player.hand = ["first-cast", "second-cast"].map((instanceId): TavernSpellInstance => {
      const definition = getTavernSpellDefinition("tavern-spell-tavern-coin");
      return {
        kind: "tavernSpell", instanceId, definitionId: definition.id,
        cardId: definition.cardId, name: definition.name, tier: definition.tier,
        cost: definition.cost, description: definition.description,
        spellFamily: "tavern", target: definition.target,
      };
    });

    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "first-cast" });
    assert.ok(human(state).board.every((card) => card.attachments.length === 0));
    state = restored(state);
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "second-cast" });

    for (const target of human(state).board) {
      assert.equal(target.attachments.length, golden ? 2 : 1);
      for (const attachment of target.attachments) {
        assert.equal(attachment.definitionId, "timewarp-magnetic-satellite-token");
        assert.equal(attachment.cardId, "BG34_Giant_610t");
        assert.equal(attachment.golden, false, "Golden Electron creates two normal 4/4 Satellites");
        assert.equal(attachment.attackGranted, 4);
        assert.equal(attachment.healthGranted, 4);
        assert.equal(attachment.poolCopies, 0);
      }
    }
  });
}
