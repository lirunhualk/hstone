import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition, MINION_DEFINITIONS } from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  getTrinketDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";

function minion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    kind: "minion", instanceId, definitionId,
    cardId: definition.cardId, name: definition.name,
    tier: definition.tier, tribe: definition.tribe,
    tribes: [...(definition.tribes ?? (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack, health: definition.health,
    golden: false, taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true, stealth: definition.stealth === true,
    poisonous: definition.poisonous === true, venomous: definition.venomous === true,
    windfury: definition.windfury === true, cleave: definition.cleave === true,
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    bloodGemAttack: 0, bloodGemHealth: 0,
    whereverAttackBonus: 0, whereverHealthBonus: 0,
    effectCounters: {}, temporaryAttack: 0, temporaryHealth: 0,
    temporaryTaunt: false, temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0, temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false, poolCopies: 0, attachments: [],
    ...overrides,
  };
}

function spell(definitionId: string, instanceId: string): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell", instanceId, definitionId,
    cardId: definition.cardId, name: definition.name,
    tier: definition.tier, cost: definition.cost, description: definition.description,
    spellFamily: "tavern", target: definition.target,
  };
}

function acquire(state: GameState, cardId: string): GameState {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find((candidate) => candidate.cardId === cardId);
  assert.ok(definition);
  const player = state.players[0];
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice", interactionId: `audit-${cardId}`, playerId: player.id,
    sourceInstanceId: `source-${cardId}`, trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION", interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: definition.id,
  });
}

function copiedGreater(cardId: string, seed: number): GameState {
  let state = createGame(seed, 999);
  state = acquire(state, "BG30_MagicItem_888");
  state = acquire(state, cardId);
  assert.equal(state.players[0].trinketIds.filter((id) => getTrinketDefinition(id).cardId === cardId).length, 2);
  return state;
}

function prepareCombat(state: GameState): [PlayerState, PlayerState] {
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  for (const [index, player] of state.players.entries()) {
    player.board = [];
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.gold = 0;
    player.heroPowerId = null;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
    }
  }
  return [state.players[0], state.players[1]];
}

test("audit: Souvenir copies of Bewitched Ribbon each trigger on a Recruit spell", () => {
  let state = copiedGreater("BG35_MagicItem_923", 0xa20201);
  const player = state.players[0];
  const target = minion("BG29_611", "audit-ribbon-recruit");
  const before = [target.attack, target.health];
  player.board = [target];
  player.hand = [spell("tavern-spell-tavern-coin", "audit-ribbon-coin")];
  state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "audit-ribbon-coin" });
  assert.deepEqual([state.players[0].board[0].attack, state.players[0].board[0].health], before.map((stat) => stat + 2));
});

test("audit: Souvenir copies of Bewitched Ribbon each permanently trigger in combat", () => {
  const state = copiedGreater("BG35_MagicItem_923", 0xa20202);
  const [human, enemy] = prepareCombat(state);
  const survivor = minion("BG29_611", "audit-ribbon-survivor", { attack: 0, health: 1000 });
  human.board = [minion("BG34_920", "audit-ribbon-caster", { attack: 0, health: 1, taunt: true }), survivor];
  enemy.board = [minion("BG29_611", "audit-ribbon-wall", { attack: 100, health: 10000, taunt: true })];
  const result = gameReducer(state, { type: "END_TURN" });
  const persisted = result.players[0].board.find((card) => card.instanceId === survivor.instanceId);
  assert.ok(persisted);
  assert.deepEqual([persisted.attack, persisted.health], [4, 1004]);
});

test("audit: both Souvenir copies of All-Purpose Kibble improve independently", () => {
  const state = copiedGreater("BG32_MagicItem_200", 0xa20203);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("rat-pack", "audit-kibble-beast", { attack: 1, health: 100, taunt: false })];
  enemy.board = [minion("murloc-tidehunter", "audit-kibble-wall", { attack: 0, health: 1 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const buffs = result.lastBattle.events.filter((event) => event.type === "buff" && human.trinketIds.includes(event.actorInstanceId ?? ""));
  assert.equal(buffs.length, 2);
  assert.deepEqual(buffs.map((event) => event.attackDelta), [2, 2]);
  assert.deepEqual(result.players[0].trinketIds.map((id) => result.players[0].trinketCounters[id]), [2, 2]);
});

test("audit: both Souvenir Fang Anklets grow when a Beast is summoned in Recruit", () => {
  let state = copiedGreater("BG35_MagicItem_701", 0xa20204);
  state.players[0].hand = [minion("rat-pack", "audit-fang-beast")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.deepEqual(state.players[0].trinketIds.map((id) => state.players[0].trinketCounters[id]), [1, 1]);
});

test("audit: both Souvenir Herald Stickers trigger friendly Deathrattles before combat", () => {
  const state = copiedGreater("BG32_MagicItem_306", 0xa20205);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("goldrinn", "audit-herald-goldrinn")];
  enemy.board = [minion("BG29_611", "audit-herald-wall", { attack: 0, health: 1 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const firstAttack = result.lastBattle.events.findIndex((event) => event.type === "attack");
  const triggers = result.lastBattle.events.slice(0, firstAttack).filter((event) => event.type === "trigger" && human.trinketIds.includes(event.actorInstanceId ?? "") && event.targetInstanceId === "audit-herald-goldrinn");
  assert.equal(triggers.length, 2);
});

test("audit: Ancient Wishbone doubles Blackthorn's active reward while consuming one use", () => {
  let state = acquire(createGame(0xa20206), "BG30_MagicItem_804");
  const player = state.players[0];
  player.heroPowerId = "hero-power-bg20_hero_103p";
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.hand = [];
  player.gold = 10;
  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  assert.equal(state.players[0].hand.length, 4);
  assert.equal(state.players[0].gold, 9);
  assert.equal(state.players[0].heroPowerCounters.blackthornPlays, 1);
  assert.equal(state.players[0].heroPowerActiveThisTurn, false);
});

test("audit: Souvenir copies of Ghastly Sticker add two extra end-of-turn triggers", () => {
  const state = copiedGreater("BG32_MagicItem_367", 0xa20207);
  const [human, enemy] = prepareCombat(state);
  const before = [human.tavernSpellAttackBonus, human.tavernSpellHealthBonus];
  human.board = [minion("BG32_821", "audit-ghastly-spell-buff")];
  enemy.board = [minion("murloc-tidehunter", "audit-ghastly-wall", { attack: 0, health: 1 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual([result.players[0].tavernSpellAttackBonus, result.players[0].tavernSpellHealthBonus], before.map((stat) => stat + 3));
});

test("audit: both Surveyor Portraits augment a Blood Gem from hand", () => {
  let state = copiedGreater("BG30_MagicItem_943", 0xa20208);
  const player = state.players[0];
  player.heroPowerId = null;
  const target = minion("murloc-tidehunter", "audit-surveyor-target");
  const before = [target.attack, target.health];
  player.board = [target];
  player.hand = [{
    kind: "bloodGem", instanceId: "audit-surveyor-gem", definitionId: "blood-gem",
    cardId: "BG20_GEM", name: "鲜血宝石", description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  }];
  state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "audit-surveyor-gem", targetInstanceId: target.instanceId });
  assert.deepEqual([state.players[0].board[0].attack, state.players[0].board[0].health], before.map((stat) => stat + 13));
});

for (const golden of [false, true]) {
  test(`audit: Behemoth Portrait's ${golden ? "golden" : "normal"} reward gains sold Elemental stats`, () => {
    let state = acquire(createGame(golden ? 0xa20210 : 0xa20209), "BG32_MagicItem_998");
    const player = state.players[0];
    player.heroPowerId = null;
    const behemoth = player.hand.find((card) => card.kind === "minion" && card.definitionId === "BG31_360");
    assert.ok(behemoth?.kind === "minion");
    behemoth.golden = golden;
    const before = [behemoth.attack, behemoth.health];
    player.board = [behemoth, minion("BGS_115", "audit-sold-elemental", { attack: 8, health: 11 })];
    player.hand = [];
    state = gameReducer(state, { type: "SELL_MINION", boardIndex: 1 });
    assert.deepEqual([state.players[0].board[0].attack, state.players[0].board[0].health], [before[0] + 8 * (golden ? 2 : 1), before[1] + 11 * (golden ? 2 : 1)]);
  });
}

test("audit: a copied Nether Pendant adds its ongoing Tavern stats", () => {
  const beforeAcquire = createGame(0xa20211);
  const before = beforeAcquire.players[0].shop.map((card) => [card.attack, card.health]);
  let state = acquire(beforeAcquire, "BG30_MagicItem_888");
  state = acquire(state, "BG30_MagicItem_541");
  assert.deepEqual(state.players[0].shop.map((card) => [card.attack, card.health]), before.map((stats) => stats.map((stat) => stat + 4)));
});

test("audit: both copied Blood Amulets permanently Gem a sole surviving minion", () => {
  const state = copiedGreater("BG35_MagicItem_432", 0xa20212);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("goldrinn", "audit-amulet-victim", { attack: 0, health: 1, taunt: true }), minion("murloc-tidehunter", "audit-amulet-survivor", { attack: 0, health: 1000 })];
  enemy.board = [minion("murloc-tidehunter", "audit-amulet-wall", { attack: 100, health: 10000 })];
  const result = gameReducer(state, { type: "END_TURN" });
  const persisted = result.players[0].board.find((card) => card.instanceId === "audit-amulet-survivor");
  assert.ok(persisted);
  assert.deepEqual([persisted.attack, persisted.health], [2, 1002]);
});

test("audit: both Flying Golem Portraits grant their permanent warband Deathrattle", () => {
  const state = copiedGreater("BG35_MagicItem_740", 0xa20213);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("murloc-tidehunter", "audit-golem-victim", { attack: 0, health: 1, taunt: true }), minion("murloc-tidehunter", "audit-golem-survivor", { attack: 0, health: 1000 })];
  enemy.board = [minion("murloc-tidehunter", "audit-golem-wall", { attack: 100, health: 10000 })];
  const result = gameReducer(state, { type: "END_TURN" });
  const persisted = result.players[0].board.find((card) => card.instanceId === "audit-golem-survivor");
  assert.ok(persisted);
  assert.deepEqual([persisted.attack, persisted.health], [4, 1004]);
  assert.equal(result.players[0].deathrattlesTriggered, 4,
    "both original minions each trigger the two granted Deathrattles");
});

test("audit: both Electrode Attractors add a Magnetic offer on Refresh", () => {
  let state = copiedGreater("BG35_MagicItem_743", 0xa20214);
  const player = state.players[0];
  state.activeTribes = ["mech", "beast", "demon", "pirate", "elemental"];
  for (const definition of MINION_DEFINITIONS) {
    if (definition.collectible !== false) state.pool[definition.id] = 20;
  }
  player.tavernTier = 3;
  player.gold = 100;
  player.heroPowerId = null;
  const baseline = structuredClone(state);
  baseline.players[0].trinketIds = [];
  baseline.players[0].trinketCounters = {};
  const normal = gameReducer(baseline, { type: "REFRESH_SHOP" });
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(state.players[0].shop.length, normal.players[0].shop.length + 2);
});

test("audit: both Jar o' Gems trigger after two friendly attacks", () => {
  const state = copiedGreater("BG30_MagicItem_546", 0xa20215);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("murloc-tidehunter", "audit-jar-attacker", { attack: 4, health: 100, windfury: true }), minion("murloc-tidehunter", "audit-jar-quilboar", { attack: 0, health: 100, tribe: "quilboar", tribes: ["quilboar"] })];
  enemy.board = [minion("murloc-tidehunter", "audit-jar-wall", { attack: 0, health: 7 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const triggers = result.lastBattle.events.filter((event) => event.type === "trigger" && human.trinketIds.includes(event.actorInstanceId ?? ""));
  assert.deepEqual(new Set(triggers.map((event) => event.actorInstanceId)), new Set(human.trinketIds));
});

test("audit: both Deathtouch Apples contribute their three Reborn restorations", () => {
  const state = copiedGreater("BG35_MagicItem_731", 0xa20216);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("BG25_001", "audit-apple-undead")];
  enemy.board = [minion("murloc-tidehunter", "audit-apple-wall", { attack: 100, health: 10000 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  assert.equal(result.lastBattle.events.filter((event) => event.type === "summon" && event.summonReason === "reborn" && event.targetPlayerId === human.id).length, 7);
});

function castCoins(state: GameState, count: number): GameState {
  for (let index = 0; index < count; index += 1) {
    const instanceId = `audit-threshold-coin-${index}`;
    state.players[0].hand = [spell("tavern-spell-tavern-coin", instanceId)];
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: instanceId });
  }
  return state;
}

function singleCombatSpell(state: GameState): GameState {
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("BG34_920", "audit-threshold-caster", { attack: 0, health: 1, taunt: true }), minion("murloc-tidehunter", "audit-threshold-survivor", { attack: 0, health: 1000 })];
  enemy.board = [minion("murloc-tidehunter", "audit-threshold-wall", { attack: 100, health: 10000 })];
  return gameReducer(state, { type: "END_TURN" });
}

test("audit: Bloodbound Earrings count a combat spell after four Recruit spells", () => {
  let state = acquire(createGame(0xa20217, 999), "BG32_MagicItem_808t");
  state = castCoins(state, 4);
  const trinketId = state.players[0].trinketIds[0];
  assert.equal(state.players[0].trinketCounters[trinketId], 4);
  state = singleCombatSpell(state);
  assert.equal(state.players[0].trinketCounters[trinketId], 0);
  assert.ok(state.lastBattle?.events.some((event) => event.type === "buff" && event.actorInstanceId === trinketId && event.targetInstanceId === "audit-threshold-survivor"));
});

test("audit: Bubble Crown unlocks when its twelfth spell is cast in combat", () => {
  let state = acquire(createGame(0xa20218, 999), "BG35_MagicItem_920");
  state = castCoins(state, 11);
  const trinketId = state.players[0].trinketIds[0];
  assert.equal(state.players[0].trinketCounters[trinketId], 11);
  const before = [state.players[0].tavernSpellAttackBonus, state.players[0].tavernSpellHealthBonus];
  state = singleCombatSpell(state);
  assert.equal(state.players[0].trinketCounters[trinketId], 12);
  assert.deepEqual([state.players[0].tavernSpellAttackBonus, state.players[0].tavernSpellHealthBonus], before.map((stat) => stat + 4));
});

test("audit: copied Soul Fermenters return their own destroyed batches exactly once", () => {
  const state = copiedGreater("BG35_MagicItem_732", 0xa20219);
  const [human, enemy] = prepareCombat(state);
  human.board = Array.from({ length: 7 }, (_, index) => minion(
    "murloc-tidehunter",
    `audit-fermenter-original-${index}`,
    { attack: index + 1, health: 1 },
  ));
  enemy.board = [minion("murloc-tidehunter", "audit-fermenter-wall", {
    attack: 100,
    health: 10000,
  })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const returns = result.lastBattle.events.filter(
    (event) => event.type === "summon" && event.message.includes("重新召唤"),
  );
  assert.deepEqual(returns.map((event) => event.actorInstanceId),
    human.board.slice(0, 6).map((card) => card.instanceId));
  assert.deepEqual(returns.map((event) => event.minion?.attack), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(returns.map((event) => event.minion?.instanceId)).size, 6);
  assert.equal(result.lastBattle.events.filter((event) =>
    event.type === "trigger" && human.trinketIds.includes(event.actorInstanceId ?? "") &&
    event.message.includes("重新召唤")).length, 2);
});

test("audit: each copied Powder Keg summons only for Pirates it selected", () => {
  const state = copiedGreater("BG35_MagicItem_714", 0xa20220);
  const [human, enemy] = prepareCombat(state);
  human.board = Array.from({ length: 7 }, (_, index) => minion(
    "murloc-tidehunter",
    `audit-keg-pirate-${index}`,
    { attack: 0, health: 1, tribe: "pirate", tribes: ["pirate"] },
  ));
  enemy.board = [minion("murloc-tidehunter", "audit-keg-wall", {
    attack: 100,
    health: 10000,
  })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const events = result.lastBattle.events;
  const grants = events.filter((event) =>
    event.type === "buff" && human.trinketIds.includes(event.actorInstanceId ?? ""));
  const summons = events.filter((event) =>
    event.type === "summon" && event.minion?.definitionId === "sky-pirate-token");
  assert.equal(grants.length, 6);
  assert.equal(summons.length, 6);
  const counts = human.board.map((card) => {
    const granted = grants.filter((event) => event.targetInstanceId === card.instanceId).length;
    const summoned = summons.filter((event) => event.actorInstanceId === card.instanceId).length;
    assert.equal(summoned, granted, card.instanceId);
    return granted;
  });
  assert.ok(counts.includes(1), "exercise a Pirate selected by only one copy");
  assert.ok(counts.includes(2), "exercise a Pirate selected by both copies");
  assert.equal(result.players[0].deathrattlesTriggered, grants.length);
});

test("audit: each Powder Keg Deathrattle notifies before and after even when its summon is blocked", () => {
  for (const fullBoard of [false, true]) {
    const state = copiedGreater("BG35_MagicItem_714", fullBoard ? 0xa20224 : 0xa20220);
    const [human, enemy] = prepareCombat(state);
    // Include a downstream observer to isolate the notification contract;
    // acquiring the three Trinkets together is not an offer-generation test.
    const amulet = ACTIVE_TRINKET_DEFINITIONS.find((definition) =>
      definition.cardId === "BG35_MagicItem_432");
    assert.ok(amulet);
    human.trinketIds.push(amulet.id);
    human.trinketCounters[amulet.id] = 0;
    if (fullBoard) {
      human.board = [
        minion("BGS_078", "audit-keg-macaw", { attack: 1, health: 1 }),
        minion("rat-pack", "audit-keg-double-source", {
          attack: 0, health: 1, tribe: "pirate", tribes: ["pirate"],
        }),
        ...Array.from({ length: 5 }, (_, index) => minion(
          "murloc-tidehunter", `audit-keg-inert-${index}`, { attack: 0, health: 1 },
        )),
      ];
    } else {
      human.board = Array.from({ length: 7 }, (_, index) => minion(
        "murloc-tidehunter", `audit-keg-observer-${index}`,
        { attack: 0, health: 1, tribe: "pirate", tribes: ["pirate"] },
      ));
    }
    enemy.board = [minion("murloc-tidehunter", "audit-keg-observer-wall", {
      attack: 100,
      health: 10000,
    })];
    const result = gameReducer(state, { type: "END_TURN" });
    assert.ok(result.lastBattle);
    const events = result.lastBattle.events;
    const amuletTriggers = events.filter((event) =>
      event.type === "trigger" && event.actorInstanceId === amulet.id);
    // The full-board case repeats one printed Rat Pack Deathrattle plus two
    // granted Keg Deathrattles at Rally, and then once again on real death.
    const expectedTriggers = 6;
    assert.equal(result.players[0].deathrattlesTriggered, expectedTriggers);
    assert.equal(amuletTriggers.length, expectedTriggers);
    if (fullBoard) {
      const firstDeathIndex = events.findIndex((event) => event.type === "death");
      const beforeDeath = events.slice(0, firstDeathIndex);
      assert.equal(beforeDeath.filter((event) =>
        event.type === "trigger" && event.actorInstanceId === amulet.id).length, 3);
      assert.equal(beforeDeath.some((event) =>
        event.type === "summon" && event.minion?.definitionId === "sky-pirate-token"), false);
    }
  }
});

function archaicScrollCombat(peggyAlive: boolean, handFull = false): GameState {
  const state = acquire(createGame(0xa20221, 999), "BG32_MagicItem_930");
  const [human, enemy] = prepareCombat(state);
  state.activeTribes = ["naga", "pirate", "beast", "mech", "murloc"];
  for (const definition of MINION_DEFINITIONS) state.pool[definition.id] = 0;
  state.pool.BG30_117 = 1;
  human.tavernTier = 6;
  const trinketId = human.trinketIds[0];
  assert.ok(trinketId);
  human.trinketCounters[trinketId] = 6;
  const peggy = minion("BG25_032", "audit-scroll-peggy", {
    attack: 0,
    health: peggyAlive ? 1000 : 1,
    taunt: !peggyAlive,
  });
  const caster = minion("BG34_920", "audit-scroll-caster", {
    attack: 0,
    health: 1,
    taunt: peggyAlive,
  });
  const pirate = minion("murloc-tidehunter", "audit-scroll-pirate", {
    attack: 0,
    health: 1000,
    tribe: "pirate",
    tribes: ["pirate"],
  });
  human.board = peggyAlive ? [caster, peggy, pirate] : [peggy, caster, pirate];
  if (handFull) {
    human.hand = Array.from({ length: 10 }, (_, index) =>
      spell("tavern-spell-tavern-coin", `audit-scroll-held-${index}`));
  }
  enemy.board = [minion("murloc-tidehunter", "audit-scroll-wall", {
    attack: 100,
    health: 10000,
  })];
  return state;
}

test("audit: Archaic Scroll combat hand gains cannot trigger an already dead Peggy", () => {
  const state = archaicScrollCombat(false);
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const events = result.lastBattle.events;
  const gainIndex = events.findIndex((event) =>
    event.type === "cardGain" && event.actorInstanceId === state.players[0].trinketIds[0]);
  const peggyDeathIndex = events.findIndex((event) =>
    event.type === "death" && event.actorInstanceId === "audit-scroll-peggy");
  assert.ok(peggyDeathIndex >= 0 && gainIndex > peggyDeathIndex);
  assert.equal(events[gainIndex].cardGainResult, "added");
  assert.equal(events[gainIndex].minion?.definitionId, "BG30_117");
  assert.equal(events.some((event) =>
    event.type === "buff" && event.actorInstanceId === "audit-scroll-peggy"), false);
  const pirate = result.players[0].board.find((card) => card.instanceId === "audit-scroll-pirate");
  assert.ok(pirate);
  assert.deepEqual([pirate.attack, pirate.health], [0, 1000]);
  assert.equal(result.players[0].hand.length, 1);
  assert.equal(result.pool.BG30_117, 0);
});

test("audit: Archaic Scroll emits its combat hand gain before a living Peggy buffs", () => {
  const state = archaicScrollCombat(true);
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const events = result.lastBattle.events;
  const gainIndex = events.findIndex((event) =>
    event.type === "cardGain" && event.actorInstanceId === state.players[0].trinketIds[0]);
  const peggyBuffIndex = events.findIndex((event) =>
    event.type === "buff" && event.actorInstanceId === "audit-scroll-peggy");
  assert.ok(gainIndex >= 0 && peggyBuffIndex > gainIndex);
  const buff = events[peggyBuffIndex];
  assert.equal(buff.targetInstanceId, "audit-scroll-pirate");
  assert.deepEqual([buff.attackDelta, buff.healthDelta], [2, 1]);
  const pirate = result.players[0].board.find((card) => card.instanceId === "audit-scroll-pirate");
  assert.ok(pirate);
  assert.deepEqual([pirate.attack, pirate.health], [0, 1000], "combat gain does not persist");
});

test("audit: a full hand blocks Archaic Scroll without consuming the pool or triggering Peggy", () => {
  const state = archaicScrollCombat(true, true);
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const gain = result.lastBattle.events.find((event) =>
    event.type === "cardGain" && event.actorInstanceId === state.players[0].trinketIds[0]);
  assert.ok(gain);
  assert.equal(gain.cardGainResult, "handFull");
  assert.equal(gain.amount, 0);
  assert.equal(result.players[0].hand.length, 10);
  assert.equal(result.pool.BG30_117, 1);
  assert.equal(result.lastBattle.events.some((event) =>
    event.type === "buff" && event.actorInstanceId === "audit-scroll-peggy"), false);
});

test("audit: both Thorned Roses independently apply permanent stats and damage after three deaths", () => {
  const state = copiedGreater("BG30_MagicItem_864", 0xa20219);
  const [human, enemy] = prepareCombat(state);
  human.board = [
    ...Array.from({ length: 3 }, (_, index) => minion("murloc-tidehunter", `audit-rose-victim-${index}`, { attack: 0, health: 1, taunt: true })),
    minion("murloc-tidehunter", "audit-rose-survivor", { attack: 0, health: 1000 }),
  ];
  enemy.board = [minion("murloc-tidehunter", "audit-rose-wall", { attack: 100, health: 10000 })];
  const result = gameReducer(state, { type: "END_TURN" });
  const persisted = result.players[0].board.find((card) => card.instanceId === "audit-rose-survivor");
  assert.ok(persisted);
  assert.deepEqual([persisted.attack, persisted.health], [8, 1010]);
  assert.ok(result.lastBattle);
  const damageSources = result.lastBattle.events.filter((event) => event.type === "damage" && human.trinketIds.includes(event.actorInstanceId ?? "") && event.targetInstanceId === "audit-rose-survivor");
  assert.deepEqual(new Set(damageSources.map((event) => event.actorInstanceId)), new Set(human.trinketIds));
  assert.ok(damageSources.every((event) => event.amount === 1));
});

test("audit: copied Reinforced Shields supply separate five-use budgets", () => {
  const state = copiedGreater("BG30_MagicItem_886", 0xa20220);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("rat-pack", "audit-shield-rat-pack", { attack: 7, health: 1 })];
  enemy.board = [minion("murloc-tidehunter", "audit-shield-wall", { attack: 100, health: 10000 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const shieldBuffs = result.lastBattle.events.filter((event) => event.type === "buff" && human.trinketIds.includes(event.actorInstanceId ?? ""));
  assert.equal(shieldBuffs.length, 7);
  assert.deepEqual(human.trinketIds.map((id) => shieldBuffs.filter((event) => event.actorInstanceId === id).length), [5, 2]);
  assert.ok(shieldBuffs.every((event) => event.minion?.divineShield));
});

test("audit: copied Faerie Dragon Scales supply separate three-use budgets", () => {
  const state = copiedGreater("BG32_MagicItem_363", 0xa20221);
  const [human, enemy] = prepareCombat(state);
  human.board = [minion("murloc-tidehunter", "audit-scale-dragon", { tribe: "dragon", tribes: ["dragon"], attack: 1, health: 100, windfury: true })];
  enemy.board = [minion("murloc-tidehunter", "audit-scale-wall", { attack: 1, health: 50 })];
  const result = gameReducer(state, { type: "END_TURN" });
  assert.ok(result.lastBattle);
  const shieldBuffs = result.lastBattle.events.filter((event) => event.type === "buff" && human.trinketIds.includes(event.actorInstanceId ?? ""));
  assert.equal(shieldBuffs.length, 6);
  assert.deepEqual(human.trinketIds.map((id) => shieldBuffs.filter((event) => event.actorInstanceId === id).length), [3, 3]);
  assert.ok(shieldBuffs.every((event) => event.minion?.divineShield));
});

test("audit: Ancient Wishbone repeats Elise's Discover without charging or increasing uses twice", () => {
  let state = acquire(createGame(0xa20222), "BG30_MagicItem_804");
  const player = state.players[0];
  state.lobbySystemsEnabled = false;
  player.heroPowerId = "hero-power-tb_baconshop_hp_047";
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.tavernTier = 3;
  player.gold = 10;
  player.hand = [];
  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  for (let choice = 0; choice < 2; choice += 1) {
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover", `Discover ${choice + 1} must be pending`);
    assert.equal(pending.sourceDefinitionId, player.heroPowerId);
    assert.ok(pending.options.every((option) => option.tier === 3));
    state = gameReducer(state, { type: "RESOLVE_INTERACTION", interactionId: pending.interactionId, optionInstanceId: pending.options[0].instanceId });
  }
  assert.equal(state.pendingInteraction, null);
  assert.equal(state.players[0].hand.length, 2);
  assert.equal(state.players[0].gold, 9);
  assert.equal(state.players[0].heroPowerCounters.eliseUses, 1);
});
