import assert from "node:assert/strict";
import test from "node:test";
import { getMinionDefinition } from "../lib/game/content.ts";
import { createGame, gameReducer, getScheduledPairings, getTavernSpellDefinition } from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { BattleSummary, BoardMinionInstance, GameState, PlayerState, TavernSpellInstance } from "../lib/game/types.ts";

function minion(id: string, instanceId: string, overrides: Partial<BoardMinionInstance> = {}): BoardMinionInstance {
  const d = getMinionDefinition(id);
  const golden = overrides.golden === true;
  return {
    kind: "minion", instanceId, definitionId: id,
    cardId: golden ? d.goldenCardId ?? d.cardId : d.cardId, name: d.name,
    tier: d.tier, tribe: d.tribe, tribes: [...(d.tribes ?? (d.tribe === "neutral" ? [] : [d.tribe]))],
    associatedTribes: [...(d.associatedTribes ?? [])], effectSupport: d.effectSupport ?? "complete",
    sellValue: d.sellValue ?? 1, attack: d.attack * (golden ? 2 : 1), health: d.health * (golden ? 2 : 1), golden,
    taunt: !!d.taunt, divineShield: !!d.divineShield, reborn: !!d.reborn, stealth: !!d.stealth,
    poisonous: !!d.poisonous, venomous: !!d.venomous, windfury: !!d.windfury, cleave: !!d.cleave,
    alwaysAttacksLowestAttack: !!d.alwaysAttacksLowestAttack,
    description: golden ? d.goldenDescription ?? d.description : d.description,
    grantsTripleReward: false, poolCopies: 0, attachments: [], effectCounters: {},
    bloodGemAttack: 0, bloodGemHealth: 0, temporaryAttack: 0, temporaryHealth: 0,
    temporaryTaunt: false, temporaryDivineShield: false, temporaryCrabDeathrattles: 0,
    ...overrides,
  };
}

function inert(instanceId: string, overrides: Partial<BoardMinionInstance> = {}): BoardMinionInstance {
  return minion("annihilan-battlemaster", instanceId, { attack: 0, health: 1_000_000, taunt: false, divineShield: false, reborn: false, ...overrides });
}

function setup(seed = 0x9900): GameState {
  const state = createGame(seed);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  state.activeTribes = ["beast", "undead", "mech", "dragon", "naga"];
  for (const [index, p] of state.players.entries()) {
    p.alive = index < 2; p.health = index < 2 ? 10_000 : 0; p.armor = 0;
    p.gold = 0; p.hand = []; p.ghostHand = []; p.board = []; p.shop = [];
    p.spellShop = null; p.additionalSpellShop = []; p.frozen = false; p.eliminatedRound = undefined;
  }
  state.players[1].board = [inert("enemy", { attack: 1_000, taunt: true })];
  return state;
}

function human(state: GameState): PlayerState { return state.players[0]; }
function battle(state: GameState): BattleSummary { assert.ok(state.lastBattle); return state.lastBattle; }
function owned(state: GameState, id: string): BoardMinionInstance {
  const found = human(state).board.find((m) => m.instanceId === id);
  assert.ok(found, id); return found;
}
function roundTrip(state: GameState): GameState {
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state)));
  assert.ok(restored); return restored as GameState;
}
function destroyInRecruit(state: GameState, target: string): GameState {
  const player = human(state);
  const index = player.board.findIndex((m) => m.instanceId === target);
  const [card] = player.board.splice(index, 1); assert.ok(card);
  // Restore a pending death-prediction enchantment, then use the public play
  // action to exercise the shared death path without a destroy spell's filters.
  card.destroyAfterPlayThroughRound = state.round;
  player.hand.unshift(card);
  return gameReducer(state, { type: "PLAY_MINION", handIndex: 0, boardIndex: index });
}
function coin(instanceId: string, definitionId = "tavern-spell-tavern-coin"): TavernSpellInstance {
  const d = getTavernSpellDefinition(definitionId);
  return { kind: "tavernSpell", definitionId: d.id, instanceId, cardId: d.cardId, name: d.name, tier: d.tier, cost: d.cost, description: d.description, spellFamily: "tavern", target: d.target };
}

for (const golden of [false, true]) {
  const label = golden ? "golden" : "normal";
  const scale = golden ? 2 : 1;

  test(`Timewarp Belcher permanently buffs only the live board after a successful Reborn (${label})`, () => {
    const state = setup();
    const source = minion("BG34_Giant_024", "belcher", { golden, attack: 0, health: 1_000_000 });
    const victim = inert("reborn", { health: 1, taunt: true, reborn: true });
    const target = inert("target");
    human(state).board = [source, victim, target];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.ok(battle(next).events.some((e) => e.type === "summon" && e.summonReason === "reborn"));
    for (const before of [source, target]) assert.deepEqual([owned(next, before.instanceId).attack, owned(next, before.instanceId).health], [before.attack + 2 * scale, before.health + 2 * scale]);
    assert.deepEqual([owned(next, "reborn").attack, owned(next, "reborn").health], [victim.attack, victim.health]);
    assert.equal(owned(roundTrip(next), "target").attack, 2 * scale);
  });

  test(`Timewarp Arm buffs the attacked defender before retaliation, including lethal hits (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_027", "arm", { golden, attack: 0, health: 1_000_000 }), inert("defender", { health: 1, taunt: true })];
    state.players[1].board = [inert("attacker", { attack: 4, health: 8 })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(owned(next, "defender").attack, 8 * scale);
    assert.ok(battle(next).events.some((e) => e.type === "death" && e.actorInstanceId === "attacker"), "the pre-hit Attack gain contributes to retaliation");
  });

  test(`Timewarp Bodyguard grants permanent Shield to different other friendlies (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_068", "bodyguard", { golden, attack: 1, health: 1, taunt: true }), inert("shield-a"), inert("shield-b")];
    const next = gameReducer(state, { type: "END_TURN" });
    const targets = [owned(next, "shield-a"), owned(next, "shield-b")];
    assert.equal(targets.filter((m) => m.divineShield).length, scale);
    assert.ok(targets.every((m) => !m.temporaryDivineShield));
    const events = battle(next).events.filter((e) => e.type === "buff" && e.actorInstanceId === "bodyguard");
    assert.equal(new Set(events.map((e) => e.targetInstanceId)).size, scale);
    assert.ok(events.every((e) => e.targetInstanceId !== "bodyguard"));
  });

  test(`Timewarp Piper counts real damage at most three times and resets next combat (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_069", "piper", { golden, attack: 1, health: 10_000 })];
    state.players[1].board = [inert("enemy", { attack: 1 })];
    let next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).bloodGemAttack, 1 + 3 * scale);
    next = gameReducer(roundTrip(next), { type: "CONTINUE" });
    next.players[1].gold = 0; next.players[1].hand = []; next.players[1].shop = [];
    next = gameReducer(next, { type: "END_TURN" });
    assert.equal(human(next).bloodGemAttack, 1 + 6 * scale);
  });

  test(`Timewarp Piper excludes shield absorption and includes lethal damage (${label})`, () => {
    for (const shield of [false, true]) {
      const state = setup();
      human(state).board = [minion("BG34_Giant_069", "piper", { golden, attack: 1, health: 1, divineShield: shield })];
      state.players[1].board = [inert("enemy", { attack: 1_000, health: shield ? 1 : 1_000_000 })];
      const next = gameReducer(state, { type: "END_TURN" });
      assert.equal(human(next).bloodGemAttack, 1 + (shield ? 0 : scale));
    }
  });

  test(`Timewarp Pagle grants one reward packet per combat even with Windfury kills (${label})`, () => {
    const state = setup(); human(state).tavernTier = 4;
    human(state).board = [minion("BG34_Giant_208", "pagle", { golden, attack: 10, health: 100, windfury: true })];
    state.players[1].board = [inert("kill-a", { health: 1 }), inert("kill-b", { health: 1 })];
    const next = gameReducer(state, { type: "END_TURN" });
    const rewards = human(next).hand.filter((c) => c.kind === "tripleReward");
    assert.equal(rewards.length, scale); assert.ok(rewards.every((c) => c.tier === 5));
  });

  test(`Timewarp Pashmar grants both spell families after exactly three deaths (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_211", "pashmar", { golden, attack: 0, health: 1_000_000 }), ...["tabbycat-token", "hyena-token", "rat-token"].map((id, i) => minion(id, `victim-${i}`, { attack: 0, health: 1, taunt: true }))];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).hand.filter((c) => c.kind === "spellcraft").length, scale);
    assert.equal(human(next).hand.filter((c) => c.kind === "tavernSpell").length, scale);
  });

  test(`Timewarp Embalmer shares its turn budget across Recruit, save, and combat summons (${label})`, () => {
    let state = setup();
    human(state).board = [minion("BG34_Giant_332", "embalmer", { golden, attack: 0, health: 1_000_000 })];
    human(state).hand = [minion("harvest-golem", "golem", { attack: 0, health: 1, taunt: true })];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.equal(owned(state, "golem").reborn, true);
    state = gameReducer(roundTrip(state), { type: "END_TURN" });
    const summon = battle(state).events.find((e) => e.type === "summon" && e.minion?.definitionId === "damaged-golem-token");
    assert.ok(summon?.minion); assert.equal(summon.minion.reborn, golden);
    assert.equal(owned(state, "golem").reborn, true, "combat tokens cannot overwrite the original body");
  });

  test(`Timewarp Festergut summons and gets the same zero-pool Creation (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_590", "festergut", { golden, attack: 0, health: 1 })];
    const pool = structuredClone(state.pool);
    const next = gameReducer(state, { type: "END_TURN" });
    const summons = battle(next).events.filter((e) => e.type === "summon" && e.actorInstanceId === "festergut");
    const cards = human(next).hand.filter((c) => c.kind === "minion");
    assert.equal(summons.length, scale); assert.equal(cards.length, scale);
    assert.deepEqual(summons.map((e) => e.minion?.definitionId), cards.map((c) => c.definitionId));
    assert.ok(cards.every((c) => c.poolCopies === 0)); assert.deepEqual(next.pool, pool);
  });

  test(`Timewarp Chameleon copies its immediate left neighbor only for combat (${label})`, () => {
    const state = setup();
    const left = minion("harvest-golem", "left", { attack: 13, health: 17, divineShield: true });
    const source = minion("BG34_Giant_042", "chameleon", { golden });
    human(state).board = [inert("leftmost"), left, source];
    state.players[1].board = [inert("enemy")];
    const next = gameReducer(state, { type: "END_TURN" });
    const firstStrike = battle(next).events.find((e) => e.type === "attack" && e.actorInstanceId === "chameleon");
    assert.ok(firstStrike?.actorMinion);
    assert.equal(firstStrike.actorMinion.definitionId, left.definitionId);
    assert.equal(firstStrike.actorMinion.golden, golden);
    assert.equal(firstStrike.actorMinion.attack, 13 + (golden ? getMinionDefinition(left.definitionId).attack : 0));
    assert.equal(owned(next, "chameleon").definitionId, source.definitionId);
  });

  test(`Timewarp Charlga uses separate permanent Gems on every other tribe each attack (${label})`, () => {
    const state = setup();
    const source = minion("BG34_Giant_102", "charlga", { golden, attack: 1, health: 10_000, taunt: true });
    const targets = [minion("tabbycat-token", "beast", { attack: 0, health: 1_000_000 }), minion("voidwalker-token", "demon", { attack: 0, health: 1_000_000, taunt: false })];
    human(state).board = [source, ...targets];
    const next = gameReducer(state, { type: "END_TURN" });
    const attacks = battle(next).events.filter((e) => e.type === "attack" && e.actorInstanceId === source.instanceId).length;
    assert.ok(attacks >= 2, "printed Windfury produces repeated Rally");
    for (const target of targets) assert.deepEqual([owned(next, target.instanceId).attack, owned(next, target.instanceId).health], [target.attack + attacks * 2 * scale, target.health + attacks * 2 * scale]);
    assert.equal(owned(next, "charlga").attack, source.attack);
  });

  test(`Timewarp Goldrinn permanently buffs board and hand Beasts (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_362", "goldrinn", { golden, attack: 0, health: 1, taunt: true }), minion("tabbycat-token", "beast", { attack: 0, health: 1_000_000 }), inert("outsider")];
    human(state).hand = [minion("hyena-token", "hand-beast")];
    const before = structuredClone(human(state));
    const next = roundTrip(gameReducer(state, { type: "END_TURN" }));
    assert.equal(owned(next, "beast").attack, 4 * scale);
    assert.equal(owned(next, "outsider").attack, 0);
    const card = human(next).hand[0]; assert.ok(card.kind === "minion");
    assert.equal(card.attack, (before.hand[0] as BoardMinionInstance).attack + 4 * scale);
  });

  test(`Timewarp Hawkstrider triggers all Deathrattles without killing their sources (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_370", "hawk", { golden, attack: 0, health: 1_000_000 }), minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_034", "hag", { attack: 0, health: 1_000_000 })];
    state.players[1].board = [inert("enemy")];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).bloodGemHealth, 1 + 2 * scale);
    assert.equal(human(next).tavernSpellAttackBonus, 2 * scale);
    assert.equal(battle(next).events.filter((e) => e.type === "death").length, 0);
  });

  test(`Timewarp Deios repeats Battlecries and Rally ${golden ? 3 : 2} times (${label})`, () => {
    let state = setup();
    human(state).board = [minion("BG34_Giant_376", "deios", { golden, attack: 0, health: 1_000_000 })];
    human(state).hand = [minion("murloc-tidehunter", "tidehunter")];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.equal([...human(state).board, ...human(state).hand.filter((c): c is BoardMinionInstance => c.kind === "minion")]
      .filter((m) => m.definitionId === "murloc-scout-token").reduce((sum, m) => sum + (m.golden ? 3 : 1), 0), golden ? 3 : 2);
    human(state).board = [owned(state, "deios"), minion("BG33_885", "rally", { attack: 1, health: 1, taunt: true })];
    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(state).bloodGemAttack, 1 + (golden ? 3 : 2));
  });

  test(`Timewarp Sneed copies the leftmost two Deathrattles, preserving duplicate golden copies (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_599", "excluded", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_034", "hag", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_599", "sneed", { golden, attack: 0, health: 1, taunt: true }), minion("BG34_Giant_304", "third", { attack: 0, health: 1_000_000, taunt: false })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).bloodGemHealth, 1 + 2 * scale);
    assert.equal(human(next).tavernSpellAttackBonus, 2 * scale);
    assert.equal(human(next).hand.length, 0, "the third Deathrattle is not copied");
    assert.equal(owned(next, "sneed").learnedDeathrattles?.length ?? 0, 0);
  });

  test(`Timewarp Ghoulacabra observes each Titus-repeated Deathrattle and permanently grows the live board (${label})`, () => {
    const state = setup();
    const source = minion("BG34_Giant_609", "ghoul", { golden, attack: 0, health: 1_000_000 });
    human(state).board = [source, minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1, taunt: true }), minion("BG25_354", "titus", { attack: 0, health: 1_000_000 })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).deathrattlesTriggered, 2);
    assert.deepEqual([owned(next, "ghoul").attack, owned(next, "ghoul").health], [source.attack + 6 * scale, source.health + 4 * scale]);
  });

  test(`Timewarp Caretaker upgrades all Undead once per individual overflow (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_618", "caretaker", { golden, attack: 0, health: 1, taunt: true }), ...Array.from({ length: 6 }, (_, i) => inert(`filler-${i}`))];
    human(state).hand = [minion("live-skeleton-token", "hand-undead")];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).undeadArmyAttackBonus, golden ? 9 : 4);
    assert.equal(human(next).undeadArmyHealthBonus, 0);
    const summons = battle(next).events.filter((e) => e.type === "summon" && e.actorInstanceId === "caretaker");
    assert.equal(summons.length, 1); assert.equal(summons[0].minion?.definitionId, "live-skeleton-token");
    const card = human(next).hand[0]; assert.ok(card.kind === "minion"); assert.equal(card.attack, golden ? 10 : 5);
  });

  test(`Timewarp Moose summons and gets the same actual opponent snapshot (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_619", "moose", { golden, attack: 0, health: 1 })];
    const donor = minion("rat-token", "actual-opponent", { attack: 77, health: 91, divineShield: true, windfury: true, bloodGemAttack: 2, bloodGemHealth: 3, poolCopies: 1 });
    state.players[1].board = [donor];
    const next = gameReducer(state, { type: "END_TURN" });
    const summons = battle(next).events.filter((e) => e.type === "summon" && e.actorInstanceId === "moose");
    const cards = human(next).hand.filter((c) => c.kind === "minion");
    assert.equal(summons.length, scale); assert.equal(cards.length, scale);
    for (const card of [...cards, ...summons.map((e) => e.minion!)]) assert.deepEqual([card.definitionId, card.attack, card.health, card.divineShield, card.windfury, card.poolCopies], [donor.definitionId, 77, 91, true, true, 0]);
  });

  test(`Timewarp Grease Bot observes any friendly Shield loss and permanently buffs all friendlies (${label})`, () => {
    const state = setup();
    const source = minion("BG34_Giant_656", "grease", { golden, attack: 1, health: 1_000_000 });
    const target = inert("shielded", { attack: 1, divineShield: true });
    human(state).board = [source, target];
    const next = gameReducer(state, { type: "END_TURN" });
    const losses = battle(next).events.filter((e) => e.type === "shieldBroken" && e.targetPlayerId === human(state).id).length;
    assert.equal(losses, 2);
    for (const card of [source, target]) assert.deepEqual([owned(next, card.instanceId).attack, owned(next, card.instanceId).health], [card.attack + losses * 3 * scale, card.health + losses * 3 * scale]);
  });

  test(`Timewarp Nest Swarmer grows Beetles before summoning normal tokens on all three triggers (${label})`, () => {
    let state = setup();
    human(state).hand = [minion("BG34_Giant_687", "swarmer", { golden, attack: 1, health: 1, taunt: true })];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.equal(human(state).beetleAttackBonus, 2 * scale);
    const recruitTokens = human(state).board.filter((m) => m.definitionId === "live-beetle-token");
    assert.equal(recruitTokens.length, scale); assert.ok(recruitTokens.every((m) => !m.golden && m.attack === 2 + 2 * scale));
    state = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(state).beetleAttackBonus, 6 * scale, "Battlecry, Rally, and Deathrattle each improve once");
    const summons = battle(state).events.filter((e) => e.type === "summon" && e.actorInstanceId === "swarmer");
    assert.equal(summons.length, 2 * scale); assert.ok(summons.every((e) => e.minion?.golden === false));
  });

  test(`Timewarp Leapfrog propagates multiple copies of the same inherited Deathrattle (${label})`, () => {
    const state = setup();
    const frog = minion("BG34_Giant_031", "frog", { golden, attack: 0, health: 1, reborn: false, taunt: false });
    const receiver = minion("tabbycat-token", "receiver", { attack: 0, health: 1_000_000, taunt: false });
    human(state).board = [minion("BGS_078", "macaw", { attack: 1, health: 1, taunt: true }), frog, receiver];
    const next = gameReducer(state, { type: "END_TURN" });
    const frogBuffs = battle(next).events.filter((e) => e.type === "buff" && e.actorInstanceId === "frog" && e.targetInstanceId === "receiver");
    assert.ok(frogBuffs.length >= 2, "active Macaw trigger and later actual death both propagate");
    assert.ok(frogBuffs.every((e) => e.attackDelta === scale && e.healthDelta === scale));
    const learned = battle(next).finalBoards[human(state).id].find((m) => m.instanceId === "receiver")?.learnedDeathrattles ?? [];
    assert.ok(learned.reduce((sum, d) => sum + (d.count ?? 1), 0) >= 2);
    assert.equal(owned(next, "receiver").learnedDeathrattles?.length ?? 0, 0, "combat inheritance expires");
  });
}

test("new permanent Timewarp combat effects do not mutate eliminated ghost owners", () => {
  const state = setup();
  for (const [i, p] of state.players.entries()) { p.alive = i < 3; p.health = i < 3 ? 10_000 : 0; p.board = i < 3 ? [inert(`wall-${i}`, { attack: 1_000 })] : []; }
  const ghost = state.players[3]; ghost.eliminatedRound = 0;
  ghost.board = [minion("BG34_Giant_609", "ghost-ghoul", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_618", "ghost-caretaker", { attack: 0, health: 1, taunt: true }), minion("BG34_Giant_656", "ghost-grease", { attack: 0, health: 1_000_000 })];
  assert.equal(getScheduledPairings(state).find((p) => p.isGhost)?.playerBId, ghost.id);
  const before = structuredClone(ghost); const pool = structuredClone(state.pool);
  const next = gameReducer(state, { type: "END_TURN" });
  const after = next.players.find((p) => p.id === ghost.id)!;
  assert.deepEqual(after.board, before.board); assert.deepEqual(after.hand, before.hand);
  assert.equal(after.undeadArmyAttackBonus, before.undeadArmyAttackBonus); assert.deepEqual(next.pool, pool);
});

test("Timewarp generated rewards respect a full hand independently from combat summons", () => {
  for (const id of ["BG34_Giant_590", "BG34_Giant_619"]) {
    const state = setup(); human(state).board = [minion(id, "source", { attack: 0, health: 1 })];
    human(state).hand = Array.from({ length: 10 }, (_, i) => coin(`full-${i}`));
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).hand.length, 10);
    assert.equal(battle(next).events.filter((e) => e.type === "summon" && e.actorInstanceId === "source").length, 1);
  }
});

for (const golden of [false, true]) {
  const scale = golden ? 2 : 1;
  const label = golden ? "golden" : "normal";
  test(`Timewarp Promo Drake upgrades the full printed vector each end turn and retains no combat stats (${label})`, () => {
    let state = setup();
    const source = minion("BG34_Giant_088", "promo", { golden, attack: 0, health: 1_000_000 });
    human(state).board = [source, inert("non-dragon")]; state.players[1].board = [inert("enemy")];
    state = gameReducer(state, { type: "END_TURN" });
    const first = battle(state).events.find((e) => e.type === "buff" && e.actorInstanceId === "promo" && e.targetInstanceId === "non-dragon");
    assert.deepEqual([first?.attackDelta, first?.healthDelta], [10 * scale, 10 * scale]);
    assert.equal(owned(state, "non-dragon").attack, 0);
    state = gameReducer(roundTrip(state), { type: "CONTINUE" });
    state.players[1].gold = 0; state.players[1].hand = []; state.players[1].shop = [];
    state = gameReducer(state, { type: "END_TURN" });
    const second = battle(state).events.find((e) => e.type === "buff" && e.actorInstanceId === "promo" && e.targetInstanceId === "non-dragon");
    assert.deepEqual([second?.attackDelta, second?.healthDelta], [15 * scale, 15 * scale]);
  });

  test(`Timewarp Belcher ignores a Reborn blocked by a full board (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_024", "belcher", { golden, attack: 0, health: 1_000_000 }), minion("harvest-golem", "blocked", { attack: 0, health: 1, taunt: true, reborn: true }), ...Array.from({ length: 5 }, (_, i) => inert(`full-${i}`))];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(battle(next).events.filter((e) => e.type === "summon" && e.summonReason === "reborn").length, 0);
    assert.equal(owned(next, "belcher").attack, 0);
  });

  test(`Timewarp Deios adds Deathrattle repetitions to Titus without multiplying his aura (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_376", "deios", { golden, attack: 0, health: 1_000_000 }), minion("BG25_354", "titus", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1, taunt: true })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).bloodGemHealth, 1 + 2 * (golden ? 4 : 3));
  });

  test(`Timewarp Ghoulacabra observes actively triggered Deathrattles and ignores deaths without one (${label})`, () => {
    for (const active of [false, true]) {
      const state = setup();
      human(state).board = [minion("BG34_Giant_609", "ghoul", { golden, attack: 0, health: 1_000_000 }), active ? minion("BGS_078", "macaw", { attack: 1, health: 1, taunt: true }) : inert("no-deathrattle", { health: 1, taunt: true })];
      if (active) human(state).board.push(minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1_000_000 }));
      const next = gameReducer(state, { type: "END_TURN" });
      assert.equal(owned(next, "ghoul").attack, active ? 3 * scale : 0);
    }
  });

  test(`Timewarp linked generation still gets cards when an active trigger finds a full board (${label})`, () => {
    for (const id of ["BG34_Giant_590", "BG34_Giant_619"]) {
      const state = setup();
      human(state).board = [minion("BGS_078", "macaw", { attack: 1, health: 1, taunt: true }), minion(id, "full-source", { golden, attack: 0, health: 1_000_000 }), ...Array.from({ length: 5 }, (_, i) => inert(`full-${i}`))];
      const next = gameReducer(state, { type: "END_TURN" });
      assert.equal(human(next).hand.filter((c) => c.kind === "minion").length, scale);
      assert.equal(battle(next).events.filter((e) => e.type === "summon" && e.actorInstanceId === "full-source").length, 0);
    }
  });

  test(`Timewarp Sneed includes granted Deathrattles among the two leftmost abilities (${label})`, () => {
    const state = setup();
    human(state).board = [inert("granted", { crabDeathrattles: 1 }), minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_034", "third", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_599", "sneed", { golden, attack: 1, health: 1, taunt: true })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).bloodGemHealth, 1 + 2 * scale);
    assert.equal(human(next).tavernSpellAttackBonus, 0);
    assert.equal(battle(next).events.filter((e) => e.type === "summon" && e.actorInstanceId === "sneed" && e.minion?.definitionId === "live-crab-token").length, scale);
  });

  test(`Timewarp Goldrinn affects future acquired Beasts after a save (${label})`, () => {
    let state = setup();
    human(state).board = [minion("BG34_Giant_362", "goldrinn", { golden, attack: 0, health: 1, taunt: true })];
    state = gameReducer(state, { type: "END_TURN" });
    state = gameReducer(roundTrip(state), { type: "CONTINUE" });
    state.activeTribes = ["beast"];
    for (const id of Object.keys(state.pool)) state.pool[id] = id === "BG31_801" ? 10 : 0;
    human(state).gold = 100; human(state).tavernTier = 6;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    const index = human(state).shop.findIndex((c) => c.definitionId === "BG31_801"); assert.ok(index >= 0);
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: index });
    const card = human(state).hand.find((c) => c.definitionId === "BG31_801"); assert.ok(card?.kind === "minion");
    const d = getMinionDefinition(card.definitionId);
    assert.deepEqual([card.attack, card.health], [d.attack + 4 * scale, d.health + 4 * scale]);
  });

  test(`Timewarp combat casts advance Centurion, Kong, and Jungle King through shared events (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_926", "caster", { attack: 1, health: 1, taunt: true }), minion("BG34_PreMadeChamp_200", "centurion", { golden, attack: 0, health: 1_000_000 }), minion("BG34_Giant_610", "kong", { golden, attack: 0, health: 1_000_000 }), minion("BG34_PreMadeChamp_004", "lion", { golden, attack: 0, health: 1_000_000 }), minion("BG29_611", "mech", { attack: 0, health: 1_000_000, taunt: false })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(human(next).hand.filter((c) => c.kind === "tavernSpell" && c.definitionId === "tavern-spell-queens-command").length, 2 * scale);
    assert.equal(owned(next, "lion").effectCounters?.timewarpGrowth, 2);
    const attachments = battle(next).events.filter((e) => e.type === "buff" && e.actorInstanceId === "kong" && e.targetInstanceId === "mech");
    assert.equal(attachments.length, scale);
    assert.ok(attachments.every((e) => e.minion?.attachments.some((a) => a.cardId === "BG34_Giant_610t")));
  });

  test(`Timewarp Cowboy casts real persistent Barrages from combat Gems (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_102", "charlga", { attack: 1, health: 1, taunt: true, windfury: false }), minion("BG34_Giant_105", "cowboy", { golden, attack: 0, health: 1_000_000 })];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.equal(battle(next).events.filter((e) => e.type === "tavernSpellCast" && e.actorInstanceId === "cowboy" && e.cardName === getTavernSpellDefinition("tavern-spell-blood-gem-barrage").name).length, 2 * scale);
    assert.equal(human(next).tavernBloodGemBarrageCount, 2 * scale);
  });

  test(`Timewarp combat stat gains relay exact packets and Smuggler Health to the correct hand cards (${label})`, () => {
    const state = setup();
    human(state).board = [minion("BG34_Giant_656", "grease", { attack: 1, health: 1_000_000 }), minion("BG34_Giant_064", "smuggler", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_317", "wanderer", { golden, attack: 0, health: 1_000_000 })];
    human(state).hand = [coin("first-spell"), inert("hand-a"), inert("hand-b"), inert("hand-c")];
    const next = gameReducer(state, { type: "END_TURN" });
    const packets = battle(next).events.filter((e) => e.type === "buff" && e.targetInstanceId === "wanderer");
    assert.ok(packets.some((e) => e.actorInstanceId === "grease" && e.attackDelta === 3));
    assert.ok(packets.some((e) => e.actorInstanceId === "smuggler" && e.healthDelta === 3));
    const attack = packets.reduce((sum, e) => sum + (e.attackDelta ?? 0), 0) * scale;
    const health = packets.reduce((sum, e) => sum + (e.healthDelta ?? 0), 0) * scale;
    for (const id of ["hand-a", "hand-b"]) {
      const card = human(next).hand.find((c) => c.instanceId === id); assert.ok(card?.kind === "minion");
      assert.deepEqual([card.attack, card.health], [attack, 1_000_000 + health]);
    }
    const third = human(next).hand.find((c) => c.instanceId === "hand-c"); assert.ok(third?.kind === "minion");
    assert.deepEqual([third.attack, third.health], [0, 1_000_000]);
  });

  test(`Timewarp permanent and inherited Deathrattles also work when destroyed in Recruit (${label})`, () => {
    for (const id of ["BG34_Giant_031", "BG34_Giant_362", "BG34_Giant_618"]) {
      const state = setup();
      const source = minion(id, "source", { golden, reborn: false });
      const target = minion("tabbycat-token", "beast");
      human(state).board = [source, target];
      if (id === "BG34_Giant_618") human(state).board.push(...["hyena-token", "voidwalker-token", "damaged-golem-token", "rat-token", "sky-pirate-token"]
        .map((definitionId, i) => minion(definitionId, `fill-${i}`, { attack: 0, health: 1_000_000, taunt: false })));
      const next = destroyInRecruit(state, source.instanceId);
      if (id === "BG34_Giant_031") {
        assert.equal(owned(next, "beast").attack, target.attack + scale);
        assert.equal(owned(roundTrip(next), "beast").learnedDeathrattles?.[0]?.definitionId, id);
      } else if (id === "BG34_Giant_362") {
        assert.equal(owned(next, "beast").attack, target.attack + 4 * scale);
        assert.equal(human(next).beastArmyAttackBonus, 4 * scale);
      } else assert.equal(human(next).undeadArmyAttackBonus, golden ? 9 : 4);
    }
  });

  test(`Timewarp Belcher and Ghoulacabra observe successful Recruit Reborn and Deathrattles (${label})`, () => {
    for (const reborn of [false, true]) {
      const state = setup();
      human(state).board = [minion(reborn ? "BG34_Giant_024" : "BG34_Giant_609", "watcher", { golden, attack: 0, health: 100 }), reborn ? inert("victim", { health: 1, reborn: true }) : minion("BG34_Giant_306", "victim")];
      const next = destroyInRecruit(state, "victim");
      assert.equal(owned(next, "watcher").attack, (reborn ? 2 : 3) * scale);
    }
  });

  test(`Timewarp Goldrinn global growth fires Smuggler without persisting the army twice (${label})`, () => {
    const state = setup();
    const target = minion("tabbycat-token", "beast", { attack: 0, health: 1_000_000 });
    human(state).board = [minion("BG34_Giant_362", "goldrinn", { golden, attack: 0, health: 1, taunt: true }), minion("BG34_Giant_064", "smuggler", { attack: 0, health: 1_000_000 }), target];
    const next = gameReducer(state, { type: "END_TURN" });
    assert.ok(battle(next).events.some((e) => e.type === "buff" && e.actorInstanceId === "smuggler" && e.targetInstanceId === "beast" && e.healthDelta === 3));
    assert.equal(owned(next, "beast").attack, 4 * scale);
    assert.equal(owned(next, "beast").health, target.health + 4 * scale);
    assert.equal(human(next).beastArmyAttackBonus, 4 * scale);
  });
}
