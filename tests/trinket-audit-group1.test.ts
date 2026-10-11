import assert from "node:assert/strict";
import test from "node:test";

import { LIVE_MINION_DEFINITIONS, getMinionDefinition } from "../lib/game/content.ts";
import { createTrinketAliasDefinitionId } from "../lib/game/lobby-systems.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

function human(state: GameState): PlayerState {
  const player = state.players.find((candidate) => candidate.id === state.humanPlayerId);
  assert.ok(player);
  return player;
}

function minion(definitionId: string, instanceId: string, overrides: Partial<BoardMinionInstance> = {}): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    kind: "minion", instanceId, definitionId,
    cardId: definition.cardId, name: definition.name, tier: definition.tier,
    tribe: definition.tribe,
    tribes: [...(definition.tribes ?? (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack, health: definition.health, golden: false,
    taunt: definition.taunt === true, divineShield: definition.divineShield === true,
    reborn: definition.reborn === true, stealth: definition.stealth === true,
    poisonous: definition.poisonous === true, venomous: definition.venomous === true,
    windfury: definition.windfury === true, cleave: definition.cleave === true,
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    whereverAttackBonus: 0, whereverHealthBonus: 0, astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0, effectCounters: {}, bloodGemAttack: 0, bloodGemHealth: 0,
    temporaryAttack: 0, temporaryHealth: 0, temporaryTaunt: false,
    temporaryDivineShield: false, temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0, grantsTripleReward: false,
    poolCopies: 0, attachments: [], ...overrides,
  };
}

function equipCopiedGreater(player: PlayerState, cardId: string): string[] {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find((candidate) => candidate.cardId === cardId);
  assert.ok(definition);
  assert.equal(definition.tier, "greater");
  const copyId = createTrinketAliasDefinitionId("souvenirCopy", definition.id);
  player.trinketIds = [definition.id, copyId];
  player.trinketCounters = { [definition.id]: 0, [copyId]: 0 };
  return player.trinketIds;
}

function buyTrinket(state: GameState, cardId: string): GameState {
  const player = human(state);
  const definition = ACTIVE_TRINKET_DEFINITIONS.find((candidate) => candidate.cardId === cardId);
  assert.ok(definition);
  player.gold = 100;
  const interactionId = `audit-purchase-${cardId}`;
  state.pendingInteraction = {
    kind: "trinketChoice", interactionId, playerId: player.id,
    sourceInstanceId: interactionId, trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, { type: "RESOLVE_INTERACTION", interactionId, optionInstanceId: definition.id });
}

function buyCopiedGreater(state: GameState, cardId: string): GameState {
  state = buyTrinket(state, "BG30_MagicItem_888");
  state = buyTrinket(state, cardId);
  const definition = ACTIVE_TRINKET_DEFINITIONS.find((candidate) => candidate.cardId === cardId);
  assert.ok(definition);
  assert.ok(human(state).trinketIds.includes(definition.id));
  assert.ok(human(state).trinketIds.includes(createTrinketAliasDefinitionId("souvenirCopy", definition.id)));
  human(state).gold = 0;
  return state;
}

function recruitState(seed: number): GameState {
  const state = createGame(seed, 999);
  state.lobbySystemsEnabled = false;
  state.activeTribes = ["naga", "demon", "beast", "mech", "murloc"];
  state.pendingInteraction = null;
  const player = human(state);
  player.board = [];
  player.hand = [];
  player.gold = 20;
  return state;
}

function combatState(seed: number): GameState {
  const state = recruitState(seed);
  for (const [index, player] of state.players.entries()) {
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.trinketIds = [];
    player.trinketCounters = {};
    player.gold = 0;
    player.alive = index < 2;
    player.health = index < 2 ? 999 : 0;
  }
  state.players[1].board = [minion("BG29_611", "enemy-wall", { attack: 100, health: 10_000, taunt: true })];
  return state;
}

test("a Souvenir copy of Nazjatar Postcard independently rewards a played Naga", () => {
  const state = recruitState(0xa101);
  const player = human(state);
  equipCopiedGreater(player, "BG30_MagicItem_919");
  const naga = LIVE_MINION_DEFINITIONS.find((definition) =>
    definition.tribes?.includes("naga") && !definition.battlecry &&
    !definition.interactiveBattlecry && !definition.onPlayChoice && !definition.magnetic);
  assert.ok(naga);
  player.hand = [minion(naga.id, "postcard-play")];
  const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(human(next).hand.filter((card) => card.kind === "spellcraft").length, 2);
});

test("a Souvenir copy of Urzul Sticker independently consumes a Tavern minion", () => {
  const state = recruitState(0xa102);
  const player = human(state);
  equipCopiedGreater(player, "BG35_MagicItem_154");
  const demon = LIVE_MINION_DEFINITIONS.find((definition) =>
    definition.tribes?.includes("demon") && !definition.battlecry &&
    !definition.interactiveBattlecry && !definition.onPlayChoice && !definition.magnetic &&
    !definition.afterSelfGainsAttack && !definition.afterFriendlyPlayed);
  assert.ok(demon);
  player.board = [minion(demon.id, "urzul-eater", { attack: 10, health: 10 })];
  player.hand = [minion(demon.id, "urzul-play")];
  player.shop = [minion("BG29_611", "food-1", { attack: 2, health: 3 }), minion("BG29_611", "food-2", { attack: 2, health: 3 })];
  const next = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(human(next).shop.length, 0);
  assert.equal(human(next).board[0].attack, 14);
  assert.equal(human(next).board[0].health, 16);
});

test("a Souvenir copy of Ironforge Anvil independently triples typeless minions", () => {
  const state = combatState(0xa103);
  const player = human(state);
  const ids = equipCopiedGreater(player, "BG30_MagicItem_403");
  player.board = [minion("BG29_611", "anvil-target", { tribe: "neutral", tribes: [], attack: 2, health: 3 })];
  const next = gameReducer(state, { type: "END_TURN" });
  assert.ok(next.lastBattle);
  const buffs = next.lastBattle.events.filter((event) =>
    event.type === "buff" && ids.includes(event.actorInstanceId ?? "") && event.targetInstanceId === "anvil-target");
  assert.equal(buffs.length, 2);
  assert.equal(buffs.at(-1)?.minion?.attack, 18);
  assert.equal(buffs.at(-1)?.minion?.health, 27);
});

test("a Souvenir copy of Slamma Sticker independently doubles combat Beast summons", () => {
  const state = combatState(0xa104);
  const player = human(state);
  const ids = equipCopiedGreater(player, "BG30_MagicItem_540");
  player.board = [minion("rat-pack", "slamma-pack", { attack: 1, health: 1 })];
  const next = gameReducer(state, { type: "END_TURN" });
  assert.ok(next.lastBattle);
  const buffs = next.lastBattle.events.filter((event) => event.type === "buff" && ids.includes(event.actorInstanceId ?? ""));
  assert.equal(buffs.length, 2);
  assert.equal(buffs.at(-1)?.minion?.attack, 4);
});

test("Thorned Pauldrons improves Blood Gems after each Deathrattle until the next combat", () => {
  let state = combatState(0xa105);
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find((definition) => definition.cardId === "BG35_MagicItem_431t");
  assert.ok(trinket);
  const player = human(state);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.board = [minion("rat-pack", "pauldrons-first", { attack: 1, health: 1 }), minion("rat-pack", "pauldrons-second", { attack: 1, health: 1 })];
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(human(state).trinketCounters[trinket.id], 2);
  state = gameReducer(state, { type: "CONTINUE" });
  const owner = human(state);
  const target = owner.board[0];
  assert.ok(target);
  const before = { attack: target.attack, health: target.health };
  owner.hand = [{ kind: "bloodGem", instanceId: "stacked-gem", definitionId: "blood-gem", cardId: "BG20_GEM", name: "鲜血宝石", description: "使一个友方随从获得+1/+1。", spellFamily: "bloodGem" }];
  state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "stacked-gem", targetInstanceId: target.instanceId });
  assert.equal(human(state).board[0].attack, before.attack + 5);
  assert.equal(human(state).board[0].health, before.health + 3);
});

test("Bleeding Heart carries non-Avenge death progress across combats", () => {
  let state = combatState(0xa106);
  state.activeTribes = ["undead", "demon", "beast", "mech", "murloc"];
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find((definition) => definition.cardId === "BG30_MagicItem_713");
  assert.ok(trinket);
  human(state).trinketIds = [trinket.id];
  human(state).trinketCounters = { [trinket.id]: 0 };
  for (let combat = 0; combat < 2; combat += 1) {
    const player = human(state);
    player.board = Array.from({ length: 4 }, (_, index) => minion("dragonspawn-lieutenant", `heart-${combat}-${index}`, { attack: 1, health: 1 }));
    player.gold = 0;
    const enemy = state.players[1];
    enemy.gold = 0;
    enemy.hand = [];
    enemy.shop = [];
    enemy.spellShop = null;
    enemy.additionalSpellShop = [];
    enemy.board = [minion("BG29_611", `heart-wall-${combat}`, { attack: 100, health: 10_000, taunt: true })];
    state = gameReducer(state, { type: "END_TURN" });
    assert.ok(state.lastBattle);
    assert.equal(state.lastBattle.events.filter((event) => event.type === "death" && event.actorPlayerId === player.id).length, 4);
    if (combat === 0) {
      assert.equal(human(state).hand.length, 0);
      state = gameReducer(state, { type: "CONTINUE" });
    }
  }
  assert.equal(human(state).hand.filter((card) => card.kind === "minion").length, 1);
});

test("Murk-Eye Tag executes both edge targeted Battlecries instead of only counting them", () => {
  const state = combatState(0xa107);
  const player = human(state);
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find((definition) => definition.cardId === "BG35_MagicItem_752");
  assert.ok(trinket);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.tavernSpellsCast = 0;
  player.board = [minion("BG35_702", "murk-left", { attack: 5, health: 5 }), minion("BG35_702", "murk-right", { attack: 5, health: 5 })];
  const next = gameReducer(state, { type: "END_TURN" });
  assert.equal(human(next).board.reduce((total, card) => total + card.attack, 0), 14);
  assert.equal(human(next).board.reduce((total, card) => total + card.health, 0), 14);
});

test("Thorned Pauldrons counts each Titus repetition of a combat Deathrattle", () => {
  const state = combatState(0xa108);
  for (const player of state.players) player.heroPowerId = null;
  const player = human(state);
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find((definition) =>
    definition.cardId === "BG35_MagicItem_431t");
  assert.ok(trinket);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.board = [
    minion("rat-pack", "pauldrons-titus-rat", { attack: 0, health: 1, taunt: true }),
    minion("titus-rivendare", "pauldrons-live-titus", { attack: 0, health: 1000 }),
  ];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.equal(human(result).deathrattlesTriggered, 2);
  assert.equal(human(result).trinketCounters[trinket.id], 2);
});

test("Thorned Pauldrons counts printed and added Recruit Deathrattles at their actual trigger boundary", () => {
  const state = recruitState(0xa109);
  const player = human(state);
  player.heroPowerId = null;
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find((definition) =>
    definition.cardId === "BG35_MagicItem_431t");
  assert.ok(trinket);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.board = [minion("titus-rivendare", "pauldrons-recruit-titus")];
  const source = minion("rat-pack", "pauldrons-recruit-source", {
    attack: 0,
    health: 1,
    temporaryCrabDeathrattles: 2,
    destroyAfterPlayThroughRound: state.round,
  });
  player.hand = [source];
  const result = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
    boardIndex: 0,
  });
  assert.equal(human(result).board.some((card) => card.instanceId === source.instanceId), false);
  assert.equal(human(result).deathrattlesTriggered, 6);
  assert.equal(human(result).trinketCounters[trinket.id], 6);
});

test("bought Souvenir copies of Soul Fermenter each restore their own destroyed band exactly once", () => {
  const state = buyCopiedGreater(combatState(41215), "BG35_MagicItem_732");
  human(state).board = Array.from({ length: 7 }, (_, index) =>
    minion("dragonspawn-lieutenant", `sf-${index}`, { name: `original-${index}`, attack: 1, health: 1, taunt: false }));
  const next = gameReducer(state, { type: "END_TURN" });
  assert.ok(next.lastBattle);
  const returnedNames = next.lastBattle.events.filter((event) =>
    event.type === "summon" && event.message.includes("重新召唤了"))
    .map((event) => event.minion?.name).sort();
  assert.deepEqual(returnedNames, Array.from({ length: 6 }, (_, index) => `original-${index}`));
});

test("bought Souvenir Powder Keg copies grant only their own three Pirates an extra Deathrattle", () => {
  const state = buyCopiedGreater(combatState(41216), "BG35_MagicItem_714");
  const player = human(state);
  const ids = [...player.trinketIds];
  player.board = Array.from({ length: 7 }, (_, index) =>
    minion("sky-pirate-token", `keg-${index}`, { name: `pirate-${index}`, attack: 1, health: 1, taunt: false }));
  const next = gameReducer(state, { type: "END_TURN" });
  assert.ok(next.lastBattle);
  const grants = next.lastBattle.events.filter((event) =>
    event.type === "buff" && ids.includes(event.actorInstanceId ?? "") && event.targetInstanceId?.startsWith("keg-"));
  assert.equal(grants.length, 6);
  const summons = next.lastBattle.events.filter((event) =>
    event.type === "summon" && event.message.includes("火药桶召唤了"));
  for (const source of player.board) {
    const expectedCount = grants.filter((event) => event.targetInstanceId === source.instanceId).length;
    const actualCount = summons.filter((event) => event.actorInstanceId === source.instanceId).length;
    assert.equal(actualCount, expectedCount, `${source.instanceId} must use only its actual Powder Keg grants`);
  }
  assert.equal(summons.length, 6);
});
