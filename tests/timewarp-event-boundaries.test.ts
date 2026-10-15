import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import { createGame, gameReducer, getScheduledPairings, getTavernSpellDefinition } from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { BattleSummary, BoardMinionInstance, GameState, MinionInstance, PlayerState, TavernSpellInstance } from "../lib/game/types.ts";

function minion(definitionId: string, instanceId: string, overrides: Partial<BoardMinionInstance> = {}): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    kind: "minion", instanceId, definitionId,
    cardId: golden ? definition.goldenCardId ?? definition.cardId : definition.cardId,
    name: definition.name, tier: definition.tier, tribe: definition.tribe,
    tribes: [...(definition.tribes ?? (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])], effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1), health: definition.health * (golden ? 2 : 1), golden,
    taunt: !!definition.taunt, divineShield: !!definition.divineShield, reborn: !!definition.reborn,
    stealth: !!definition.stealth, poisonous: !!definition.poisonous, venomous: !!definition.venomous,
    windfury: !!definition.windfury, cleave: !!definition.cleave, alwaysAttacksLowestAttack: !!definition.alwaysAttacksLowestAttack,
    description: golden ? definition.goldenDescription ?? definition.description : definition.description,
    grantsTripleReward: false, poolCopies: 0, attachments: [], effectCounters: {},
    bloodGemAttack: 0, bloodGemHealth: 0, temporaryAttack: 0, temporaryHealth: 0,
    temporaryTaunt: false, temporaryDivineShield: false, temporaryCrabDeathrattles: 0,
    ...overrides,
  };
}

function wall(instanceId: string, overrides: Partial<BoardMinionInstance> = {}): BoardMinionInstance {
  return minion("annihilan-battlemaster", instanceId, { attack: 0, health: 1_000_000, ...overrides });
}

function setup(seed = 0x34e0): GameState {
  const state = createGame(seed);
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  state.activeTribes = ["beast", "undead", "mech", "dragon", "naga"];
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 2; player.health = index < 2 ? 10_000 : 0; player.armor = 0;
    player.gold = 0; player.hand = []; player.ghostHand = []; player.board = []; player.shop = [];
    player.spellShop = null; player.additionalSpellShop = []; player.frozen = false;
    player.heroPowerId = null; player.eliminatedRound = undefined;
  }
  state.players[1].board = [wall("enemy", { attack: 1_000 })];
  return state;
}

function human(state: GameState): PlayerState { return state.players[0]; }
function battle(state: GameState): BattleSummary { assert.ok(state.lastBattle); return state.lastBattle; }
function owned(state: GameState, instanceId: string): BoardMinionInstance {
  const found = human(state).board.find((card) => card.instanceId === instanceId);
  assert.ok(found, instanceId); return found;
}
function restored(state: GameState): GameState {
  const next = normalizePersistedGameState(JSON.parse(JSON.stringify(state)));
  assert.ok(next); return next as GameState;
}
function coin(instanceId: string): TavernSpellInstance {
  const definition = getTavernSpellDefinition("tavern-spell-tavern-coin");
  return { kind: "tavernSpell", definitionId: definition.id, instanceId, cardId: definition.cardId,
    name: definition.name, tier: definition.tier, cost: definition.cost, description: definition.description,
    spellFamily: "tavern", target: definition.target };
}
function creationSnapshot(card: MinionInstance) {
  return {
    definitionId: card.definitionId, cardId: card.cardId, attack: card.attack, health: card.health,
    golden: card.golden, taunt: card.taunt, reborn: card.reborn, divineShield: card.divineShield,
    windfury: card.windfury, poolCopies: card.poolCopies,
    components: card.attachments.map((part) => [part.definitionId, part.golden, part.attackGranted, part.healthGranted]),
  };
}

for (const full of [false, true]) {
  test(`Timewarp Jelly counts a granted Reborn only when its summon succeeds (${full ? "full board" : "one spare slot"})`, () => {
    let state = setup();
    const jelly = minion("BG34_Giant_024", "jelly", { attack: 0, health: 1_000_000 });
    human(state).board = [minion("BG34_Giant_332", "embalmer", { attack: 0, health: 1_000_000 }), jelly];
    human(state).hand = [minion("harvest-golem", "golem", { attack: 0, health: 1, taunt: true })];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    assert.equal(owned(state, "golem").reborn, true, "Embalmer grants the real summon its Reborn");
    human(state).board.push(...Array.from({ length: full ? 4 : 3 }, (_, index) => wall(`filler-${index}`)));
    state = gameReducer(restored(state), { type: "END_TURN" });
    const reborns = battle(state).events.filter((event) => event.type === "summon" && event.summonReason === "reborn");
    assert.equal(reborns.length, full ? 0 : 1, "the Golem Deathrattle uses its free slot before Reborn");
    assert.deepEqual([owned(state, "jelly").attack, owned(state, "jelly").health], [full ? 0 : 2, jelly.health + (full ? 0 : 2)]);
  });
}

for (const golden of [false, true]) {
  test(`Timewarp Goldrinn carries its Beast bonus through hand, purchase, generation and reload (${golden ? "golden" : "normal"})`, () => {
    let state = setup();
    const amount = golden ? 8 : 4;
    const beast = minion("tabbycat-token", "owned-beast", { attack: 0, health: 1_000_000 });
    const unowned = minion("cave-hydra", "shop-beast");
    human(state).board = [minion("BG34_Giant_362", "goldrinn", { golden, attack: 0, health: 1, taunt: true }), beast];
    human(state).hand = [minion("alleycat", "hand-beast"), minion("harvest-golem", "hand-mech")];
    human(state).shop = [unowned]; human(state).frozen = true;
    state = gameReducer(state, { type: "END_TURN" });
    assert.deepEqual([owned(state, "owned-beast").attack, owned(state, "owned-beast").health], [amount, beast.health + amount]);
    assert.deepEqual(human(state).hand.map((card) => card.kind === "minion" ? [card.attack, card.health] : null), [[1 + amount, 1 + amount], [2, 3]]);
    assert.deepEqual(human(state).shop[0], unowned, "unowned shop minions do not receive the persistent bonus");
    state = gameReducer(restored(state), { type: "CONTINUE" });
    human(state).gold = 10;
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    const purchased = human(state).hand.find((card) => card.instanceId === "shop-beast");
    assert.ok(purchased?.kind === "minion");
    assert.deepEqual([purchased.attack, purchased.health], [unowned.attack + amount, unowned.health + amount]);
    state = gameReducer(state, { type: "PLAY_HAND_CARD", cardInstanceId: "hand-beast" });
    const generated = human(state).board.find((card) => card.definitionId === "tabbycat-token" && card.instanceId !== "owned-beast");
    assert.ok(generated);
    assert.deepEqual([generated.attack, generated.health, generated.poolCopies], [1 + amount, 1 + amount, 0]);
  });
}

test("active golden Hawkstrider and Titus produce four observed Deathrattles without killing their source", () => {
  const state = setup();
  state.players[1].board = [wall("enemy")];
  human(state).board = [
    minion("BG34_Giant_370", "hawk", { golden: true, attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_609", "observer", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1_000_000 }),
    minion("BG25_354", "titus", { attack: 0, health: 1_000_000 }),
  ];
  const next = gameReducer(state, { type: "END_TURN" });
  assert.equal(human(next).deathrattlesTriggered, 4);
  assert.equal(human(next).bloodGemHealth, 9);
  assert.equal(battle(next).events.filter((event) => event.type === "death").length, 0);
  for (const card of human(state).board) assert.deepEqual([owned(restored(next), card.instanceId).attack, owned(next, card.instanceId).health], [12, card.health + 8]);
});

for (const golden of [false, true]) {
  test(`Sneed preserves two same-source Frog stacks when copying them (${golden ? "golden" : "normal"})`, () => {
    const state = setup();
    human(state).board = [
      minion("tabbycat-token", "receiver", { attack: 0, health: 1_000_000 }),
      minion("BG34_Giant_370", "hawk", { attack: 0, health: 1_000_000 }),
      minion("BG25_354", "titus", { attack: 0, health: 1_000_000 }),
      minion("BG34_Giant_031", "frog", { attack: 0, health: 1 }),
      minion("BG34_Giant_599", "sneed", { golden, attack: 0, health: 1, taunt: true }),
    ];
    state.players[1].board = [minion("cave-hydra", "enemy", { attack: 1_000, health: 1_000_000 })];
    const next = gameReducer(state, { type: "END_TURN" });
    const expectedCopies = golden ? 8 : 4;
    const copied = battle(next).events.filter((event) => event.type === "buff" && event.actorInstanceId === "sneed" && event.attackDelta === 1);
    assert.equal(copied.length, expectedCopies, "two learned copies, golden multiplier, and Titus all remain multiplicative");
    const sameSourceStacks = battle(next).finalBoards[human(next).id].flatMap((card) => card.learnedDeathrattles ?? [])
      .filter((source) => source.sourceInstanceId === "frog").reduce((sum, source) => sum + (source.count ?? 1), 0);
    assert.equal(sameSourceStacks, 4 + expectedCopies, "aggregate every actual Beast target; the Frog's Reborn is a different source");
    assert.ok(human(next).board.every((card) => (card.learnedDeathrattles?.length ?? 0) === 0), "inherited combat Deathrattles expire");
  });
}

test("golden Sneed ignores an earlier golden Sneed's already copied Deathrattles", () => {
  const state = setup();
  human(state).board = [
    minion("BG34_Giant_599", "other-sneed", { golden: true, attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_306", "jazzer", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_034", "hag", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_599", "sneed", { golden: true, attack: 0, health: 1, taunt: true }),
  ];
  const next = gameReducer(state, { type: "END_TURN" });
  assert.equal(human(next).bloodGemHealth, 5, "copy Jazzer twice, rather than copying the other Sneed's two Jazzer stacks twice");
  assert.equal(human(next).tavernSpellAttackBonus, 4, "Hag remains the second distinct leftmost Deathrattle");
});

test("golden Festergut still gets both creations when an active Deathrattle has no board space", () => {
  const state = setup(); state.players[1].board = [wall("enemy")];
  human(state).board = [minion("BG34_Giant_370", "hawk", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_590", "festergut", { golden: true, attack: 0, health: 1_000_000 }),
    ...Array.from({ length: 5 }, (_, index) => wall(`filler-${index}`))];
  const pool = structuredClone(state.pool);
  const next = gameReducer(state, { type: "END_TURN" });
  assert.equal(battle(next).events.filter((event) => event.type === "summon" && event.actorInstanceId === "festergut").length, 0);
  assert.equal(human(next).hand.length, 2);
  assert.ok(human(next).hand.every((card) => card.kind === "minion" && card.attachments.length === 2 && card.poolCopies === 0));
  assert.deepEqual(next.pool, pool);
});

test("Festergut gives and summons one identical creation snapshot with separate generated ownership", () => {
  const state = setup(); state.players[1].board = [wall("enemy")];
  human(state).board = [minion("BG34_Giant_370", "hawk", { attack: 0, health: 1_000_000 }), minion("BG34_Giant_590", "festergut", { attack: 0, health: 1_000_000 })];
  const pool = structuredClone(state.pool);
  const next = gameReducer(state, { type: "END_TURN" });
  const summons = battle(next).events.filter((event) => event.type === "summon" && event.actorInstanceId === "festergut");
  assert.equal(summons.length, 1);
  const card = human(next).hand[0]; assert.ok(card?.kind === "minion");
  const summoned = summons[0].minion; assert.ok(summoned);
  assert.deepEqual(creationSnapshot(summoned), creationSnapshot(card));
  assert.notEqual(summoned.instanceId, card.instanceId);
  assert.equal(card.poolCopies, 0); assert.deepEqual(next.pool, pool);
});

test("Forager's full hand burns its reward while still summoning the exact opponent clone without pool copies", () => {
  const state = setup();
  human(state).board = [minion("BG34_Giant_619", "forager", { attack: 0, health: 1, taunt: true })];
  human(state).hand = Array.from({ length: 10 }, (_, index) => coin(`full-${index}`));
  const donor = minion("cave-hydra", "actual-opponent", { attack: 77, health: 91, poolCopies: 1 });
  state.players[1].board = [donor];
  const pool = structuredClone(state.pool);
  const next = gameReducer(state, { type: "END_TURN" });
  const summons = battle(next).events.filter((event) => event.type === "summon" && event.actorInstanceId === "forager");
  assert.equal(summons.length, 1); const clone = summons[0].minion; assert.ok(clone);
  assert.deepEqual([clone.definitionId, clone.attack, clone.health, clone.cleave, clone.poolCopies], [donor.definitionId, 77, 91, true, 0]);
  assert.equal(human(next).hand.length, 10);
  assert.equal(battle(next).events.find((event) => event.type === "cardGain" && event.actorInstanceId === "forager")?.cardGainResult, "handFull");
  assert.deepEqual(next.pool, pool);
});

test("ghost Timewarp active Deathrattles and damage observers cannot write any player's ledgers or hand", () => {
  const state = setup();
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 3; player.health = index < 3 ? 10_000 : 0;
    player.board = index < 3 ? [wall(`living-${index}`, { attack: 1_000 })] : [];
  }
  const ghost = state.players[3]; ghost.eliminatedRound = 0;
  ghost.board = [
    minion("BG34_Giant_370", "ghost-hawk", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_590", "ghost-festergut", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_619", "ghost-forager", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_362", "ghost-goldrinn", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_609", "ghost-observer", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_069", "ghost-piper", { attack: 0, health: 1_000_000 }),
    minion("BG34_Giant_332", "ghost-embalmer", { attack: 0, health: 1_000_000 }),
  ];
  assert.equal(getScheduledPairings(state).find((pair) => pair.isGhost)?.playerBId, ghost.id);
  const ledgers = (player: PlayerState) => ({ hand: player.hand, deathrattles: player.deathrattlesTriggered,
    gems: [player.bloodGemAttack, player.bloodGemHealth], beasts: [player.beastArmyAttackBonus, player.beastArmyHealthBonus],
    undead: [player.undeadArmyAttackBonus, player.undeadArmyHealthBonus],
    counters: player.board.map((card) => [card.instanceId, card.effectCounters]) });
  const before = structuredClone(state.players.map(ledgers));
  const ghostBoard = structuredClone(ghost.board); const pool = structuredClone(state.pool);
  const next = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = next.lastRoundBattles.find((summary) => summary.isGhost && summary.playerBId === ghost.id);
  assert.ok(ghostBattle?.events.some((event) => event.type === "buff" && event.actorInstanceId === "ghost-observer"), "the ghost's active Deathrattles really triggered its observer");
  assert.deepEqual(next.players.map(ledgers), before);
  assert.deepEqual(next.players[3].board, ghostBoard);
  assert.deepEqual(next.pool, pool);
});
