import assert from "node:assert/strict";
import test from "node:test";
import { TIMEWARP_COST_TWO_MINION_DEFINITIONS, getMinionDefinition } from "../lib/game/content.ts";
import { createGame, createLobbyGame, gameReducer, getTavernSpellDefinition } from "../lib/game/engine.ts";
import { TRINKET_DEFINITIONS, trinketCanBeOfferedWithHeroPower, trinketsForTier } from "../lib/game/lobby-systems.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import { getSpellcraftDefinition } from "../lib/game/spellcraft.ts";
import { TIMEWARP_RULE_OVERRIDES } from "../lib/game/timewarp.ts";
import type { BoardMinionInstance, GameState, PlayerState, SpellcraftSpellInstance, TavernSpellInstance } from "../lib/game/types.ts";

function human(state: GameState): PlayerState {
  const player = state.players.find((candidate) => candidate.id === state.humanPlayerId);
  assert.ok(player);
  return player;
}

function minion(id: string, instanceId: string, golden = false): BoardMinionInstance {
  const d = getMinionDefinition(id);
  return {
    kind: "minion", instanceId, definitionId: id,
    cardId: golden ? d.goldenCardId ?? d.cardId : d.cardId,
    name: d.name, tier: d.tier, tribe: d.tribe,
    tribes: [...(d.tribes ?? (d.tribe === "neutral" ? [] : [d.tribe]))],
    associatedTribes: [...(d.associatedTribes ?? [])],
    effectSupport: d.effectSupport ?? "complete", sellValue: d.sellValue ?? 1,
    attack: d.attack * (golden ? 2 : 1), health: d.health * (golden ? 2 : 1),
    golden, taunt: !!d.taunt, divineShield: !!d.divineShield, reborn: !!d.reborn,
    stealth: !!d.stealth, poisonous: !!d.poisonous, venomous: !!d.venomous,
    windfury: !!d.windfury, cleave: !!d.cleave, alwaysAttacksLowestAttack: !!d.alwaysAttacksLowestAttack,
    description: golden ? d.goldenDescription ?? d.description : d.description,
    grantsTripleReward: false, poolCopies: 0, attachments: [], effectCounters: {},
    bloodGemAttack: 0, bloodGemHealth: 0, temporaryAttack: 0, temporaryHealth: 0,
    temporaryTaunt: false, temporaryDivineShield: false, temporaryCrabDeathrattles: 0,
  };
}

function setup(seed = 0x3400): GameState {
  const state = createGame(seed);
  for (const player of state.players) {
    player.gold = 0;
    player.health = 1_000;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }
  human(state).gold = 100;
  return state;
}

function spell(id: string, instanceId: string): TavernSpellInstance {
  const d = getTavernSpellDefinition(id);
  return { kind: "tavernSpell", instanceId, definitionId: id, cardId: d.cardId,
    name: d.name, tier: d.tier, cost: d.cost, description: d.description,
    spellFamily: "tavern", target: d.target };
}

function spellcraft(id: string, instanceId: string): SpellcraftSpellInstance {
  const d = getSpellcraftDefinition(id);
  return { kind: "spellcraft", instanceId, definitionId: id, cardId: d.cardId,
    name: d.name, description: d.description, spellFamily: d.spellFamily ?? "spellcraft", target: d.target };
}

function acquireCandlestick(state: GameState, pool: "lesser" | "greater"): GameState {
  const id = pool === "lesser" ? "BG35_MagicItem_823" : "BG35_MagicItem_823t";
  const d = TRINKET_DEFINITIONS.find((d) => d.cardId === id);
  assert.ok(d);
  state.pendingInteraction = { kind: "trinketChoice", interactionId: "candlestick",
    playerId: state.humanPlayerId, sourceInstanceId: "candlestick-offer",
    trinketTier: d.tier, optionIds: [d.id] };
  return gameReducer(state, { type: "RESOLVE_INTERACTION", interactionId: "candlestick", optionInstanceId: d.id });
}

test("the complete Timewarp source registry survives while unsupported payloads are gated", () => {
  assert.equal(TIMEWARP_COST_TWO_MINION_DEFINITIONS.lesser.length, 25);
  assert.equal(TIMEWARP_COST_TWO_MINION_DEFINITIONS.greater.length, 41);
  const all = Object.values(TIMEWARP_COST_TWO_MINION_DEFINITIONS).flat();
  assert.equal(all.filter((d) => d.effectSupport === "complete").length, 28);
  assert.equal(all.filter((d) => d.effectSupport === "partial").length, 38);
  assert.equal(getMinionDefinition("BG34_Giant_031").effectSupport, "partial");
  assert.equal(getMinionDefinition("BG34_Giant_314").effectSupport, "complete");
  assert.ok(all.every((d) => d.collectible === false && d.goldenCardId === `${d.id}_G`));
  const frog = TRINKET_DEFINITIONS.find((d) => d.cardId === "BG35_MagicItem_870");
  assert.ok(frog);
  assert.equal(trinketCanBeOfferedWithHeroPower(frog, null), false);
  assert.ok(trinketsForTier("lesser").every((d) => d.id !== frog.id));
});

test("both Candlesticks generate only executable, active-type choices and do not reserve normal pool copies", () => {
  for (const pool of ["lesser", "greater"] as const) {
    for (let seed = 0; seed < 24; seed += 1) {
      const state = setup(0x3400 + seed);
      state.activeTribes = ["naga"];
      const poolBefore = { ...state.pool };
      const offered = acquireCandlestick(state, pool);
      const pending = offered.pendingInteraction;
      assert.ok(pending?.kind === "discover");
      assert.ok(pending.options.length > 0 && pending.options.length <= 3);
      assert.equal(new Set(pending.options.map((d) => d.definitionId)).size, pending.options.length);
      assert.ok(pending.options.every((d) => d.effectSupport === "complete" && d.poolCopies === 0));
      assert.ok(pending.options.every((d) => d.tribes.length === 0 || d.tribes.includes("naga") || d.tribes.includes("all")));
      assert.deepEqual(offered.pool, poolBefore);
      const selected = pending.options[0];
      const resolved = gameReducer(offered, { type: "RESOLVE_INTERACTION",
        interactionId: pending.interactionId, optionInstanceId: selected.instanceId });
      assert.equal(human(resolved).hand[0]?.definitionId, selected.definitionId);
      assert.equal(resolved.pendingInteraction, null);
      const saved = normalizePersistedGameState(JSON.parse(JSON.stringify(resolved))) as GameState;
      assert.ok(saved);
      assert.equal(human(saved).hand[0]?.definitionId, selected.definitionId);
    }
  }
});

test("Gyrocopter's random Mech domain includes the fixed all-type Nightmare Tea Drinker", () => {
  const effect = TIMEWARP_RULE_OVERRIDES.BG34_Giant_302.avenge?.effects[0];
  assert.ok(effect?.kind === "gainRandomGeneratedMinion");
  assert.ok(effect.definitionIds.includes("BG32_111"));
});

test("existing Timewarp instances update support metadata while retaining their owned state", () => {
  const state = setup();
  const source = minion("BG34_Giant_603", "saved-lamplighter", true);
  source.attack = 67;
  source.health = 89;
  source.effectSupport = "partial";
  const secretary = minion("BG34_Giant_323", "saved-secretary");
  secretary.effectCounters = { spellcraftCastProgress: 1 };
  human(state).board = [source, secretary];
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState;
  assert.ok(restored);
  assert.equal(human(restored).board[0].effectSupport, "complete");
  assert.deepEqual([human(restored).board[0].instanceId, human(restored).board[0].attack, human(restored).board[0].health],
    [source.instanceId, 67, 89]);
  assert.match(human(restored).board[1].description, /还剩1个/);
});

test("a preexisting Frog portrait offer remains recoverable even though new offers exclude it", () => {
  let state = createLobbyGame(333);
  const hero = state.pendingInteraction;
  assert.ok(hero?.kind === "heroChoice");
  state = gameReducer(state, { type: "RESOLVE_INTERACTION", interactionId: hero.interactionId, optionInstanceId: hero.optionIds[0] });
  state.round = 6;
  state.activeTribes = ["beast", "dragon", "mech", "naga", "pirate"];
  human(state).board = [minion("BG34_Giant_582", "beast")];
  const optionIds = ["lesser-trinket-bg35-magicitem-870", "lesser-trinket-bg30-magicitem-420",
    "lesser-trinket-bg30-magicitem-423", "lesser-trinket-bg30-magicitem-425"];
  state.pendingInteraction = { kind: "trinketChoice", interactionId: "old-choice",
    playerId: state.humanPlayerId, sourceInstanceId: "trinket-choice", trinketTier: "lesser", optionIds };
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState;
  assert.ok(restored);
  assert.ok(restored.pendingInteraction?.kind === "trinketChoice");
  assert.deepEqual(restored.pendingInteraction.optionIds, optionIds);
});

for (const golden of [false, true]) {
  const scale = golden ? 2 : 1;
  test(`Low Flier independently compares Attack then Health (${golden ? "golden" : "normal"})`, () => {
    const state = setup();
    const source = minion("BG34_Giant_065", "low-flier", golden);
    source.attack = 20; source.health = 30;
    const lower = minion("BGS_115", "both-lower"); lower.attack = 1; lower.health = 2;
    const attackOnly = minion("BG25_001", "attack-lower"); attackOnly.attack = 19; attackOnly.health = 30;
    const healthOnly = minion("BG_LOE_077", "health-lower"); healthOnly.attack = 20; healthOnly.health = 29;
    human(state).board = [source, lower, attackOnly, healthOnly];
    const board = human(gameReducer(state, { type: "END_TURN" })).board;
    assert.deepEqual(board.map((d) => [d.attack, d.health]),
      [[20, 30], [1 + 2 * scale, 2 + 2 * scale], [19 + 2 * scale, 30], [20, 29 + 2 * scale]]);
  });

  test(`Bouncer rewards only a Tier 2 sale and cannot reward its own departure (${golden ? "golden" : "normal"})`, () => {
    for (const soldId of ["BG25_001", "BG21_015"] as const) {
      const state = setup();
      state.activeTribes = ["murloc", "elemental", "quilboar", "mech", "undead"];
      human(state).board = [minion("BG34_Giant_072", "bouncer", golden), minion(soldId, "sold")];
      const sold = gameReducer(state, { type: "SELL_MINION", boardIndex: 1 });
      const cards = human(sold).hand;
      assert.equal(cards.length, getMinionDefinition(soldId).tier === 2 ? scale : 0);
      assert.ok(cards.every((d) => d.kind === "minion" && d.tier === 1));
      human(sold).hand = [];
      const departed = gameReducer(sold, { type: "SELL_MINION", boardIndex: 0 });
      assert.equal(human(departed).hand.length, 0);
    }
  });

  test(`Nalaa buffs one distinct minion per type on a Blood Gem cast (${golden ? "golden" : "normal"})`, () => {
    const state = setup();
    const board = [minion("BG34_Giant_205", "nalaa", golden), minion("BGS_049", "pirate"),
      minion("BG34_Giant_065", "dragon-one"), minion("BG34_Giant_065", "dragon-two"), minion("BG_LOE_077", "typeless"),
      minion("BG34_Giant_304", "naga")];
    human(state).board = board;
    human(state).hand = [{ kind: "bloodGem", instanceId: "gem", definitionId: "blood-gem",
      cardId: "BG20_GEM", name: "鲜血宝石", description: "", spellFamily: "bloodGem" }];
    const cast = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "gem", targetInstanceId: "typeless" });
    const after = human(cast).board;
    const gains = after.map((d, i) => d.attack - board[i].attack);
    assert.equal(gains[0], 0);
    assert.equal(gains[1], 4 * scale);
    assert.deepEqual(gains.slice(2, 4).sort((a, b) => a - b), [0, 4 * scale]);
    assert.equal(gains[4], 1);
    assert.equal(gains[5], 4 * scale);
  });

  test(`Secretary counts two actual Spellcraft casts across a save (${golden ? "golden" : "normal"})`, () => {
    let state = setup();
    human(state).board = [minion("BG34_Giant_323", "secretary", golden), minion("BG_LOE_077", "target")];
    human(state).hand = [spellcraft("spellcraft-anglers-lure", "first"), spellcraft("spellcraft-anglers-lure", "second")];
    state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: "first", targetInstanceId: "target" });
    assert.equal(human(state).hand.filter((d) => d.kind === "tavernSpell").length, 0);
    assert.match(human(state).board[0].description, /还剩1个/);
    state = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState;
    assert.ok(state);
    state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: "second", targetInstanceId: "target" });
    assert.equal(human(state).hand.length, scale);
    assert.ok(human(state).hand.every((d) => d.kind === "tavernSpell"));
    assert.match(human(state).board[0].description, /还剩2个/);
  });

  test(`Secretary ignores generated cards that share the Spellcraft casting UI (${golden ? "golden" : "normal"})`, () => {
    let state = setup();
    human(state).board = [minion("BG34_Giant_323", "secretary", golden), minion("BG_LOE_077", "target")];
    human(state).hand = [spellcraft("generated-slimy-shield", "first"), spellcraft("generated-slimy-shield", "second")];
    for (const cardInstanceId of ["first", "second"]) {
      state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId, targetInstanceId: "target" });
    }
    assert.equal(human(state).hand.length, 0);
    assert.equal(human(state).board[0].effectCounters?.spellcraftCastProgress ?? 0, 0);
  });

  test(`Theotar observes typeless minions and ignores spell cards (${golden ? "golden" : "normal"})`, () => {
    const state = setup();
    const board = [minion("BG34_Giant_335", "theotar", golden), minion("BGS_049", "pirate"),
      minion("BG34_Giant_065", "dragon")];
    human(state).board = board;
    human(state).hand = [minion("BG_LOE_077", "typeless-played")];
    let after = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.deepEqual(human(after).board.slice(0, 3).map((d, i) => d.attack - board[i].attack),
      [6 * scale, 6 * scale, 6 * scale]);
    const beforeSpell = structuredClone(human(after).board);
    human(after).hand = [spell("tavern-spell-tavern-coin", "coin")];
    after = gameReducer(after, { type: "CAST_TAVERN_SPELL", cardInstanceId: "coin" });
    assert.deepEqual(human(after).board.map((d) => [d.attack, d.health]), beforeSpell.map((d) => [d.attack, d.health]));
  });

  test(`Choral Mrrrglr grants hand stats to adjacent Murlocs in separate pulses (${golden ? "golden" : "normal"})`, () => {
    const state = setup();
    for (const [i, player] of state.players.entries()) player.alive = i < 2;
    const left = minion("BG34_Giant_072", "left"); left.attack = 0; left.health = 10_000;
    const source = minion("BG34_Giant_321", "choral", golden); source.attack = 0; source.health = 10_000;
    const right = minion("BGS_115", "non-murloc"); right.attack = 0; right.health = 10_000;
    human(state).board = [left, source, right];
    const held = minion("BGS_115", "held"); held.attack = 7; held.health = 11;
    human(state).hand = [held, spell("tavern-spell-tavern-coin", "coin")];
    state.players[1].board = [minion("BG_LOE_077", "enemy")];
    const ended = gameReducer(state, { type: "END_TURN" });
    const battle = ended.lastRoundBattles.find((d) => d.playerAId === state.humanPlayerId || d.playerBId === state.humanPlayerId);
    assert.ok(battle);
    const buffs = battle.events.filter((e) => e.type === "buff" && e.actorInstanceId === "choral");
    assert.equal(buffs.length, scale);
    assert.ok(buffs.every((e) => e.targetInstanceId === "left" && e.attackDelta === 7 && e.healthDelta === 11));
    assert.equal(human(ended).board[0].attack, 0);
    assert.deepEqual(human(ended).hand, human(state).hand);
  });

  test(`Bandit grants Coins for each Deathrattle including Reborn (${golden ? "golden" : "normal"})`, () => {
    const state = setup();
    for (const [i, player] of state.players.entries()) player.alive = i < 2;
    human(state).board = [minion("BG34_Giant_204", "bandit", golden)];
    const enemy = minion("BG_LOE_077", "enemy"); enemy.attack = 100_000; enemy.health = 100_000;
    state.players[1].board = [enemy];
    const ended = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(ended).hand.length, 2 * scale);
    assert.ok(human(ended).hand.every((d) => d.kind === "tavernSpell" && d.definitionId === "tavern-spell-tavern-coin"));
  });
}
