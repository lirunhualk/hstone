import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getScheduledPairings,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const GRIFTER = "BG31_826";
const RECRUITER = "BG29_862";
const PIRATE_REWARD = "BG26_814";

function minion(
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
    tribes: [...(definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
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
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
    description: golden && definition.goldenDescription
      ? definition.goldenDescription
      : definition.description,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    effectCounters: {},
    ...overrides,
  };
}

function playerById(state: GameState, id: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === id);
  assert.ok(player);
  return player;
}

function enemyWall(instanceId: string): BoardMinionInstance {
  return minion("defender-of-argus", instanceId, {
    attack: 100,
    health: 1_000,
    taunt: true,
  });
}

function combatState(seed: number): GameState {
  const state = createGame(seed);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  state.activeTribes = ["pirate", "mech", "demon", "beast", "dragon"];
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 2;
    player.health = player.alive ? 1_000 : 0;
    player.armor = 0;
    player.gold = 0;
    player.maxGold = 10;
    player.tavernTier = 6;
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
  state.players[1].board = [enemyWall("grifter-enemy")];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool[PIRATE_REWARD] = 2;
  return state;
}

test("normal and Golden Grifters retain combat acquisition progress and maximum Gold", () => {
  for (const golden of [false, true]) {
    const state = combatState(0x8260 + Number(golden));
    const player = playerById(state, state.humanPlayerId);
    const grifter = minion(GRIFTER, "combat-grifter", {
      golden,
      effectCounters: { pirateCardsAcquired: 3 },
    });
    const recruiter = minion(RECRUITER, "combat-pirate-recruiter", {
      golden: true,
      attack: 1,
      health: 1,
      taunt: true,
    });
    player.board = [recruiter, grifter];

    const combat = gameReducer(state, { type: "END_TURN" });
    const saved = playerById(combat, player.id);
    const savedGrifter = saved.board.find(
      (candidate) => candidate.instanceId === grifter.instanceId,
    );
    assert.ok(savedGrifter);
    assert.equal(saved.maxGold, golden ? 12 : 11);
    assert.equal(saved.gold, 0, "raising the cap does not award spendable Gold");
    assert.equal(savedGrifter.effectCounters?.pirateCardsAcquired, 1);
    assert.match(savedGrifter.description, /还剩3张/);
    assert.equal(saved.hand.filter((card) =>
      card.kind === "minion" && card.definitionId === PIRATE_REWARD).length, 2);
    assert.equal(combat.pool[PIRATE_REWARD], 0);

    const events = combat.lastBattle?.events;
    assert.ok(events);
    const gains = events.filter((event) => event.type === "cardGain" &&
      event.actorInstanceId === recruiter.instanceId && event.cardGainResult === "added");
    const triggers = events.filter((event) => event.type === "trigger" &&
      event.actorInstanceId === grifter.instanceId);
    assert.equal(gains.length, 2);
    assert.equal(triggers.length, 2);
    assert.ok(gains[0].index < triggers[0].index);
    assert.ok(gains[1].index < triggers[1].index);
    assert.match(triggers[0].message, new RegExp(`上限提高${golden ? 2 : 1}枚`));
  }
});

test("a dead Grifter or a Grifter in hand does not observe a later combat Pirate gain", () => {
  for (const placement of ["dead", "hand"] as const) {
    const state = combatState(0x8263);
    const player = playerById(state, state.humanPlayerId);
    const grifter = minion(GRIFTER, `inactive-grifter-${placement}`, {
      attack: 1,
      health: 1,
      taunt: true,
      effectCounters: { pirateCardsAcquired: 3 },
    });
    const recruiter = minion(RECRUITER, `inactive-recruiter-${placement}`, {
      attack: 1,
      health: 1,
    });
    player.board = placement === "dead" ? [grifter, recruiter] : [recruiter];
    player.hand = placement === "hand" ? [grifter] : [];
    state.pool[PIRATE_REWARD] = 1;

    const combat = gameReducer(state, { type: "END_TURN" });
    const saved = playerById(combat, player.id);
    assert.equal(saved.maxGold, 10);
    const savedGrifter = [...saved.board, ...saved.hand].find(
      (card) => card.instanceId === grifter.instanceId,
    );
    assert.ok(savedGrifter?.kind === "minion");
    assert.equal(savedGrifter.effectCounters?.pirateCardsAcquired, 3);
    assert.ok(saved.hand.some((card) =>
      card.kind === "minion" && card.definitionId === PIRATE_REWARD));
    assert.equal(combat.lastBattle?.events.some((event) =>
      event.type === "trigger" && event.actorInstanceId === grifter.instanceId), false);
  }
});

test("a full hand prevents combat Pirate gains from advancing Grifter", () => {
  const state = combatState(0x8264);
  const player = playerById(state, state.humanPlayerId);
  player.board = [
    minion(RECRUITER, "full-hand-recruiter", { attack: 1, health: 1, taunt: true }),
    minion(GRIFTER, "full-hand-grifter", { effectCounters: { pirateCardsAcquired: 3 } }),
  ];
  player.hand = Array.from({ length: 10 }, (_, index) => ({
    kind: "bloodGem" as const,
    instanceId: `full-hand-gem-${index}`,
    definitionId: "blood-gem" as const,
    cardId: "BG20_GEM" as const,
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem" as const,
  }));

  const combat = gameReducer(state, { type: "END_TURN" });
  const saved = playerById(combat, player.id);
  assert.equal(saved.maxGold, 10);
  assert.equal(saved.hand.length, 10);
  assert.equal(saved.board[1].effectCounters?.pirateCardsAcquired, 3);
  assert.ok(combat.lastBattle?.events.some((event) =>
    event.type === "cardGain" && event.cardGainResult === "handFull"));
});

test("ghost combat cannot increase an eliminated Grifter owner's cap or progress", () => {
  const state = combatState(0x8265);
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 1_000;
    player.board = [enemyWall(`grifter-ghost-wall-${index}`)];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.board = [
    minion(RECRUITER, "ghost-grifter-recruiter", { attack: 1, health: 1, taunt: true }),
    minion(GRIFTER, "ghost-grifter", { effectCounters: { pirateCardsAcquired: 3 } }),
  ];
  const before = structuredClone(ghost);
  const poolBefore = structuredClone(state.pool);
  const pairing = getScheduledPairings(state).find((candidate) => candidate.isGhost);
  assert.equal(pairing?.playerBId, ghost.id);

  const combat = gameReducer(state, { type: "END_TURN" });
  const saved = playerById(combat, ghost.id);
  assert.equal(saved.maxGold, before.maxGold);
  assert.deepEqual(saved.board, before.board);
  assert.deepEqual(saved.hand, before.hand);
  assert.deepEqual(combat.pool, poolBefore);
  const battle = combat.lastRoundBattles.find((candidate) =>
    candidate.isGhost && candidate.playerBId === ghost.id);
  assert.ok(battle);
  assert.ok(battle.events.some((event) => event.type === "death" &&
    event.actorInstanceId === "ghost-grifter-recruiter"));
  assert.equal(battle.events.some((event) => event.type === "cardGain" &&
    event.actorPlayerId === ghost.id), false);
});
