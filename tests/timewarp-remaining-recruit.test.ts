import assert from "node:assert/strict";
import test from "node:test";

import { MINION_DEFINITIONS, getMinionDefinition } from "../lib/game/content.ts";
import { createGame, gameReducer, getTavernSpellDefinition } from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import { getSpellcraftDefinition } from "../lib/game/spellcraft.ts";
import type {
  BloodGemSpellInstance,
  BoardMinionInstance,
  GameState,
  PlayerState,
  SpellcraftSpellInstance,
  TavernSpellInstance,
  Tribe,
} from "../lib/game/types.ts";

const ALL_TRIBES: Tribe[] = [
  "beast", "demon", "dragon", "elemental", "mech",
  "murloc", "naga", "pirate", "quilboar", "undead",
];

function human(state: GameState): PlayerState {
  const player = state.players.find((candidate) => candidate.id === state.humanPlayerId);
  assert.ok(player);
  return player;
}

function setup(seed = 0x3401): GameState {
  const state = createGame(seed);
  state.activeTribes = [...ALL_TRIBES];
  for (const player of state.players) {
    player.health = 1_000;
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.freeRefreshes = 0;
    player.heroRefreshAvailable = false;
    player.frozen = false;
  }
  human(state).gold = 100;
  return state;
}

function minion(
  definitionId: string,
  instanceId: string,
  golden = false,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const d = getMinionDefinition(definitionId);
  return {
    kind: "minion", instanceId, definitionId,
    cardId: golden ? d.goldenCardId ?? `${d.cardId}_G` : d.cardId,
    name: golden ? `金色·${d.name}` : d.name,
    tier: d.tier, tribe: d.tribe,
    tribes: [...(d.tribes ?? (d.tribe === "neutral" ? [] : [d.tribe]))],
    associatedTribes: [...(d.associatedTribes ?? [])],
    effectSupport: d.effectSupport ?? "complete", sellValue: d.sellValue ?? 1,
    attack: d.attack * (golden ? 2 : 1), health: d.health * (golden ? 2 : 1),
    golden, taunt: !!d.taunt, divineShield: !!d.divineShield, reborn: !!d.reborn,
    stealth: !!d.stealth, poisonous: !!d.poisonous, venomous: !!d.venomous,
    windfury: !!d.windfury, cleave: !!d.cleave,
    alwaysAttacksLowestAttack: !!d.alwaysAttacksLowestAttack,
    description: golden ? d.goldenDescription ?? d.description : d.description,
    whereverAttackBonus: 0, whereverHealthBonus: 0,
    astralAutomatonSummoned: false, ancientSoulFriendlyDeaths: 0,
    effectCounters: {}, bloodGemAttack: 0, bloodGemHealth: 0,
    temporaryAttack: 0, temporaryHealth: 0, temporaryTaunt: false,
    temporaryDivineShield: false, temporaryVenomous: false,
    temporaryCrabDeathrattles: 0, temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0, goldenCrabDeathrattles: 0,
    grantsTripleReward: false, poolCopies: 0, attachments: [],
    ...overrides,
  };
}

function spell(definitionId: string, instanceId: string): TavernSpellInstance {
  const d = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell", instanceId, definitionId, cardId: d.cardId,
    name: d.name, tier: d.tier, cost: d.cost, description: d.description,
    spellFamily: "tavern", target: d.target,
  };
}

function spellcraft(definitionId: string, instanceId: string): SpellcraftSpellInstance {
  const d = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft", instanceId, definitionId, cardId: d.cardId,
    name: d.name, description: d.description,
    spellFamily: d.spellFamily ?? "spellcraft", target: d.target,
  };
}

function gem(instanceId: string): BloodGemSpellInstance {
  return {
    kind: "bloodGem", instanceId, definitionId: "blood-gem", cardId: "BG20_GEM",
    name: "鲜血宝石", description: "使一个友方随从获得+1/+1。", spellFamily: "bloodGem",
  };
}

function current(player: PlayerState, instanceId: string): BoardMinionInstance {
  const card = [...player.board, ...player.hand, ...player.shop].find(
    (candidate): candidate is BoardMinionInstance =>
      candidate.kind === "minion" && candidate.instanceId === instanceId,
  );
  assert.ok(card, `${instanceId} must still exist`);
  return card;
}

function stats(player: PlayerState, original: BoardMinionInstance, attack: number, health: number): void {
  const actual = current(player, original.instanceId);
  assert.deepEqual([actual.attack, actual.health], [original.attack + attack, original.health + health], original.instanceId);
}

function saved(state: GameState): GameState {
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state)));
  assert.ok(restored);
  return restored as GameState;
}

function nextTurn(state: GameState): GameState {
  const enemy = state.players.find((player) => !player.isHuman);
  assert.ok(enemy);
  for (const player of state.players) {
    if (player.isHuman) continue;
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.alive = player.id === enemy.id;
    player.health = player.alive ? 1_000 : 0;
  }
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function poolOnly(state: GameState, ids: readonly string[]): void {
  for (const id of Object.keys(state.pool)) state.pool[id] = 0;
  for (const id of ids) state.pool[id] = 64;
}

function fillers(count: number): BoardMinionInstance[] {
  return MINION_DEFINITIONS.filter((d) => d.collectible !== false)
    .slice(0, count).map((d, index) => minion(d.id, `filler-${index}`));
}

for (const golden of [false, true]) {
  const scale = golden ? 2 : 1;
  const version = golden ? "golden" : "normal";

  test(`Timewarped Prophet discounts exactly ${2 * scale} spell purchases, including a free purchase (${version})`, () => {
    let state = setup();
    human(state).board = [minion("BG34_Giant_008", "prophet", golden)];
    const quota = 2 * scale;
    for (let index = 0; index <= quota; index += 1) {
      const definitionId = index === 0 ? "tavern-spell-pointy-arrow" : "tavern-spell-temperature-shift";
      const offer = spell(definitionId, `prophet-offer-${index}`);
      human(state).spellShop = offer;
      const before = human(state).gold;
      state = gameReducer(state, { type: "BUY_TAVERN_SPELL", spellInstanceId: offer.instanceId });
      assert.equal(human(state).gold, before - Math.max(0, offer.cost - (index < quota ? 2 : 0)));
      assert.ok(human(state).hand.some((card) => card.instanceId === offer.instanceId));
      if (index === 0) state = saved(state);
    }
    state = nextTurn(state);
    human(state).gold = 10;
    const fresh = spell("tavern-spell-temperature-shift", "prophet-next-turn");
    human(state).spellShop = fresh;
    state = gameReducer(state, { type: "BUY_TAVERN_SPELL", spellInstanceId: fresh.instanceId });
    assert.equal(human(state).gold, 8, "the purchase quota resets next turn");
  });

  test(`Timewarped Prophet does not spend its quota on an unsuccessful purchase (${version})`, () => {
    let state = setup();
    const player = human(state);
    player.board = [minion("BG34_Giant_008", "full-prophet", golden)];
    player.hand = fillers(10);
    player.spellShop = spell("tavern-spell-temperature-shift", "full-prophet-spell");
    assert.deepEqual(gameReducer(state, { type: "BUY_TAVERN_SPELL" }), state);
    player.hand = [];
    for (let index = 0; index < 2 * scale; index += 1) {
      human(state).spellShop = spell("tavern-spell-temperature-shift", `retry-prophet-${index}`);
      const before = human(state).gold;
      state = gameReducer(state, { type: "BUY_TAVERN_SPELL" });
      assert.equal(human(state).gold, before - 2);
    }
  });

  test(`Timewarped Elise makes the highest ${scale} distinct Tavern minions golden after five refreshes (${version})`, () => {
    let state = setup(0xe115);
    human(state).tavernTier = 6;
    human(state).board = [minion("BG34_Giant_038", "elise", golden)];
    const ids = ["BGS_115", "BG25_354", "BG32_846"];
    poolOnly(state, ids);
    human(state).freeRefreshes = 1;
    for (let index = 0; index < 4; index += 1) {
      state = gameReducer(state, { type: "REFRESH_SHOP" });
      assert.ok(human(state).shop.every((card) => !card.golden));
    }
    state = saved(state);
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    const player = human(state);
    const upgraded = player.shop.filter((card) => card.golden);
    assert.equal(upgraded.length, scale);
    assert.equal(new Set(upgraded.map((card) => card.instanceId)).size, scale);
    const expectedTiers = player.shop.map((card) => card.tier).sort((a, b) => b - a).slice(0, scale);
    assert.deepEqual(upgraded.map((card) => card.tier).sort((a, b) => b - a), expectedTiers);
    for (const card of upgraded) {
      const d = getMinionDefinition(card.definitionId);
      assert.deepEqual([card.attack, card.health], [d.attack * 2, d.health * 2]);
      assert.equal(card.poolCopies, 1, "pointing a shop card golden does not manufacture two pool copies");
    }
    for (const id of ids) {
      assert.equal(state.pool[id] + player.shop.filter((card) => card.definitionId === id).reduce((sum, card) => sum + card.poolCopies, 0), 64);
    }
  });

  test(`Timewarped Whelp Smuggler grants Health to the friendly Attack recipient of any tribe (${version})`, () => {
    let state = setup();
    const player = human(state);
    const source = minion("BG34_Giant_064", "whelp-smuggler", golden);
    const elemental = minion("BGS_115", "whelp-elemental");
    const shopTarget = minion("BG25_001", "whelp-shop-target");
    player.board = [source, elemental];
    player.shop = [shopTarget];
    player.hand = [
      spell("tavern-spell-pointy-arrow", "whelp-arrow"),
      spell("tavern-spell-pointy-arrow", "whelp-self-arrow"),
      spell("tavern-spell-pointy-arrow", "whelp-shop-arrow"),
    ];
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "whelp-arrow", targetInstanceId: elemental.instanceId });
    stats(human(state), elemental, 4, 3 * scale);
    stats(human(state), source, 0, 0);
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "whelp-self-arrow", targetInstanceId: source.instanceId });
    stats(human(state), source, 4, 3 * scale);
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "whelp-shop-arrow", targetInstanceId: shopTarget.instanceId });
    stats(human(state), shopTarget, 4, 0);
  });

  test(`Timewarped Beach Commander generates real Spellcraft and counts present Naga at cast time (${version})`, () => {
    let state = setup();
    const player = human(state);
    const commander = minion("BG34_Giant_210", "beach-commander", golden);
    const allType = minion("BG32_111", "beach-all-type");
    const dualNaga = minion("BG34_Giant_008", "beach-dual-naga");
    const target = minion("BGS_115", "beach-target");
    player.board = [allType, dualNaga, target];
    player.hand = [commander];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const generated = human(state).hand.find((card) => card.kind === "spellcraft");
    assert.ok(generated?.kind === "spellcraft");
    assert.equal(generated.cardId, golden ? "BG34_Giant_210_Gt" : "BG34_Giant_210t");
    state = gameReducer(state, { type: "SELL_MINION", boardIndex: 1 });
    state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: generated.instanceId, targetInstanceId: target.instanceId });
    const delta = 4 * scale;
    stats(human(state), target, delta, delta);
    const buffed = current(human(state), target.instanceId);
    assert.deepEqual([buffed.temporaryAttack, buffed.temporaryHealth], [delta, delta]);
    state = nextTurn(saved(state));
    stats(human(state), target, 0, 0);
  });

  test(`Timewarped Ray grants real buddies for the current Hero Power at the start of each turn (${version})`, () => {
    let state = setup();
    human(state).heroPowerId = "hero-power-all-patched-up";
    human(state).board = [minion("BG34_Giant_602", "ray", golden)];
    state = nextTurn(state);
    const first = human(state).hand;
    assert.equal(first.length, scale);
    assert.ok(first.every((card) => card.kind === "minion" && card.definitionId === "TB_BaconShop_HERO_34_Buddy" && !card.golden && card.poolCopies === 0));
    human(state).hand = [];
    human(state).heroPowerId = "hero-power-see-the-future";
    state = nextTurn(saved(state));
    assert.equal(human(state).hand.length, scale);
    assert.ok(human(state).hand.every((card) => card.kind === "minion" && card.definitionId === "TB_BaconShop_HERO_57_Buddy"));
  });

  test(`Timewarped Lasso Cowboy actually casts ${scale} Blood Gem Barrages only for Gems on itself (${version})`, () => {
    let state = setup();
    const player = human(state);
    const cowboy = minion("BG34_Giant_105", "cowboy", golden);
    const other = minion("BGS_115", "cowboy-other");
    player.board = [cowboy, other];
    player.bloodGemAttack = 2;
    player.bloodGemHealth = 3;
    player.tavernSpellAttackBonus = 5;
    player.tavernSpellHealthBonus = 7;
    player.hand = [gem("cowboy-self-gem"), gem("cowboy-other-gem")];
    poolOnly(state, ["BG20_100"]);
    state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "cowboy-other-gem", targetInstanceId: other.instanceId });
    assert.equal(human(state).tavernBloodGemBarrageCount, 0);
    state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "cowboy-self-gem", targetInstanceId: cowboy.instanceId });
    const nextPlayer = human(state);
    stats(nextPlayer, cowboy, 2, 3);
    assert.deepEqual([nextPlayer.tavernBloodGemBarrageCount, nextPlayer.tavernBloodGemBarrageAttack, nextPlayer.tavernBloodGemBarrageHealth], [scale, 5 * scale, 7 * scale]);
    assert.equal(nextPlayer.playerSpellsCast, 2, "automatic Barrages do not impersonate hand-cast player spells");
    state = gameReducer(saved(state), { type: "REFRESH_SHOP" });
    const d = getMinionDefinition("BG20_100");
    assert.ok(human(state).shop.length > 0);
    for (const card of human(state).shop) {
      assert.deepEqual([card.attack, card.health], [d.attack + 7 * scale, d.health + 10 * scale]);
    }
  });

  for (const mode of ["play", "magnetize"] as const) {
    test(`Timewarped Decoder buffs board Mechs exactly once for a hand Mech ${mode} (${version})`, () => {
      const state = setup();
      const player = human(state);
      const decoder = minion("BG34_Giant_120", "decoder", golden);
      const host = minion("BG29_611", "decoder-host");
      const allType = minion("BG32_111", "decoder-all");
      const outsider = minion("BGS_115", "decoder-elemental");
      const played = minion("BG26_146", "decoder-lullabot");
      const handMech = minion("BG29_611", "decoder-hand-mech");
      player.board = [decoder, host, allType, outsider];
      player.hand = [played, handMech];
      const next = gameReducer(state, mode === "play"
        ? { type: "PLAY_MINION", handIndex: 0 }
        : { type: "MAGNETIZE_MINION", cardInstanceId: played.instanceId, targetInstanceId: host.instanceId });
      const p = human(next);
      const delta = 3 * scale;
      stats(p, decoder, delta, delta);
      stats(p, allType, delta, delta);
      stats(p, host, delta + (mode === "magnetize" ? played.attack : 0), delta + (mode === "magnetize" ? played.health : 0));
      stats(p, outsider, 0, 0);
      stats(p, handMech, 0, 0);
      if (mode === "play") stats(p, played, delta, delta);
      else assert.equal(current(p, host.instanceId).attachments.length, 1);
    });
  }

  test(`Timewarped Devourer gains each consumed minion's actual stats independently of the consumer multiplier (${version})`, () => {
    let state = setup();
    const player = human(state);
    const observer = minion("BG34_Giant_311", "devourer", golden);
    const fodder = minion("BGS_115", "devourer-fodder", false, { attack: 13, health: 17, poolCopies: 1 });
    const consumer = minion("BG24_009", "devourer-consumer", true);
    player.board = [observer];
    player.shop = [fodder];
    player.hand = [consumer];
    const poolBefore = state.pool[fodder.definitionId];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    stats(human(state), observer, 13 * scale, 17 * scale);
    stats(human(state), consumer, 26, 34);
    assert.equal(human(state).shop.length, 0);
    assert.equal(state.pool[fodder.definitionId], poolBefore + 1);
    const second = minion("BG25_001", "devourer-second", false, { attack: 5, health: 9 });
    human(state).shop = [second];
    human(state).hand = [minion("BG24_009", "devourer-second-consumer")];
    state = gameReducer(saved(state), { type: "PLAY_MINION", handIndex: 0 });
    stats(human(state), observer, 18 * scale, 26 * scale);
  });

  test(`Timewarped Wanderer forwards exact gain vectors to the two leftmost hand minions, skipping spells (${version})`, () => {
    let state = setup();
    const player = human(state);
    const source = minion("BG34_Giant_317", "wanderer", golden);
    const first = minion("BGS_115", "wanderer-first");
    const second = minion("BG25_001", "wanderer-second");
    const outside = minion("BG33_140", "wanderer-third");
    player.board = [source];
    player.hand = [
      spell("tavern-spell-tavern-coin", "wanderer-skip-coin"), first,
      spell("tavern-spell-pointy-arrow", "wanderer-arrow"), second, outside,
      spell("tavern-spell-fortify", "wanderer-fortify"),
    ];
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "wanderer-arrow", targetInstanceId: source.instanceId });
    stats(human(state), source, 4, 0);
    for (const target of [first, second]) stats(human(state), target, 4 * scale, 0);
    stats(human(state), outside, 0, 0);
    state = gameReducer(saved(state), { type: "CAST_TAVERN_SPELL", cardInstanceId: "wanderer-fortify", targetInstanceId: source.instanceId });
    stats(human(state), source, 4, 3);
    for (const target of [first, second]) stats(human(state), target, 4 * scale, 3 * scale);
    stats(human(state), outside, 0, 0);
  });

  test(`Timewarped Painter initially buffs only its two neighbors at end of turn (${version})`, () => {
    const state = setup();
    const player = human(state);
    const far = minion("BG25_001", "painter-far");
    const left = minion("BGS_115", "painter-left");
    const source = minion("BG34_Giant_319", "painter", golden);
    const right = minion("BG33_140", "painter-right");
    player.board = [far, left, source, right];
    const next = human(gameReducer(state, { type: "END_TURN" }));
    for (const target of [left, right]) stats(next, target, 3 * scale, 2 * scale);
    stats(next, far, 0, 0);
    stats(next, source, 0, 0);
  });

  test(`Timewarped Amalgam permanently buffs Tavern types of the played minion, including dual types (${version})`, () => {
    let state = setup();
    const player = human(state);
    const source = minion("BG34_Giant_336", "amalgam", golden);
    const elemental = minion("BGS_115", "amalgam-elemental");
    const demon = minion("BG24_009", "amalgam-demon");
    const naga = minion("BG34_Giant_210", "amalgam-naga");
    const allType = minion("BG32_111", "amalgam-all-type");
    const outsider = minion("BG25_001", "amalgam-undead");
    player.board = [source];
    player.shop = [elemental, demon, naga, allType, outsider];
    player.hand = [minion("BG34_Giant_008", "amalgam-played-dual")];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const delta = 4 * scale;
    stats(human(state), demon, delta, delta);
    stats(human(state), naga, delta, delta);
    stats(human(state), allType, delta, delta);
    stats(human(state), elemental, 0, 0);
    stats(human(state), outsider, 0, 0);
    stats(human(state), source, 0, 0);
    state = saved(state);
    poolOnly(state, ["BG24_009"]);
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    const d = getMinionDefinition("BG24_009");
    const future = human(state).shop.filter((card) => card.definitionId === d.id);
    assert.ok(future.length > 0);
    for (const card of future) assert.deepEqual([card.attack, card.health], [d.attack + delta, d.health + delta]);
  });

  test(`Timewarped Charge Kong magnetizes a separate 4/4 Satellite onto every Mech after two Tavern spells (${version})`, () => {
    let state = setup();
    const player = human(state);
    const kong = minion("BG34_Giant_610", "kong", golden);
    const mech = minion("BG29_611", "kong-mech");
    const allType = minion("BG32_111", "kong-all-type");
    const outside = minion("BGS_115", "kong-elemental");
    player.board = [kong, mech, allType, outside];
    player.hand = [
      spell("tavern-spell-tavern-coin", "kong-first"),
      spellcraft("spellcraft-meditation", "kong-non-tavern"),
      spell("tavern-spell-tavern-coin", "kong-second"),
    ];
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "kong-first" });
    state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: "kong-non-tavern" });
    assert.ok(human(state).board.every((card) => card.attachments.length === 0));
    state = gameReducer(saved(state), { type: "CAST_TAVERN_SPELL", cardInstanceId: "kong-second" });
    const p = human(state);
    for (const original of [kong, mech, allType]) {
      stats(p, original, 4 * scale, 4 * scale);
      const attachments = current(p, original.instanceId).attachments;
      assert.equal(attachments.length, scale);
      for (const attachment of attachments) {
        assert.equal(attachment.definitionId, "timewarp-magnetic-satellite-token");
        assert.equal(attachment.golden, false);
        assert.deepEqual([attachment.attackGranted, attachment.healthGranted], [4, 4]);
      }
    }
    stats(p, outside, 0, 0);
    assert.equal(p.magnetizationsThisGame, 3 * scale);
  });

  test(`Timewarped Lava Lurker permanently copies hand Spellcraft cast on any minion for the first two casts (${version})`, () => {
    let state = setup();
    const player = human(state);
    const source = minion("BG34_Giant_678", "lava-lurker", golden);
    const target = minion("BGS_115", "lurker-other-target");
    player.board = [source, target];
    player.hand = [
      spellcraft("spellcraft-anglers-lure", "lurker-first"),
      spellcraft("spellcraft-anglers-lure", "lurker-second"),
      spellcraft("spellcraft-anglers-lure", "lurker-third"),
      spellcraft("generated-slimy-shield", "lurker-generated"),
    ];
    state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: "lurker-generated", targetInstanceId: target.instanceId });
    stats(human(state), source, 0, 0);
    for (const instanceId of ["lurker-first", "lurker-second", "lurker-third"]) {
      state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: instanceId, targetInstanceId: target.instanceId });
      if (instanceId === "lurker-first") state = saved(state);
    }
    stats(human(state), source, 4 * scale, 12 * scale);
    assert.equal(current(human(state), source.instanceId).temporaryAttack, 0);
    assert.equal(current(human(state), source.instanceId).temporaryHealth, 0);
    assert.equal(current(human(state), source.instanceId).taunt, true);
    stats(human(state), target, 7, 19);
    state = nextTurn(state);
    stats(human(state), source, 4 * scale, 12 * scale);
    stats(human(state), target, 1, 1);
    human(state).hand = [spellcraft("spellcraft-anglers-lure", "lurker-next-turn")];
    state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: "lurker-next-turn", targetInstanceId: target.instanceId });
    stats(human(state), source, 6 * scale, 18 * scale);
  });

  test(`Timewarped Swirling adds its passive bonus to real Elemental stat grants (${version})`, () => {
    const state = setup();
    const player = human(state);
    const source = minion("BG34_Giant_686", "swirling", golden);
    const target = minion("tabbycat-token", "swirling-target", false, { attack: 10, health: 10 });
    player.board = [source, target, minion("BG31_818", "swirling-baller")];
    const next = human(gameReducer(state, { type: "SELL_MINION", boardIndex: 2 }));
    stats(next, target, 3 * scale, 1 + 3 * scale);
    stats(next, source, 3 * scale, 1 + 3 * scale);
    assert.equal(next.ballerHealthBonus, 2, "the passive bonus does not alter the Baller growth ledger");
  });

  test(`Timewarped Troll gains the purchased Elemental's current stats without changing that card (${version})`, () => {
    let state = setup();
    const player = human(state);
    const troll = minion("BG34_Giant_777", "troll", golden);
    const bought = minion("BGS_115", "troll-purchased", false, { attack: 13, health: 17, poolCopies: 1 });
    player.board = [troll];
    player.shop = [bought];
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    stats(human(state), troll, 13 * scale, 17 * scale);
    stats(human(state), bought, 0, 0);
    human(state).shop = [minion("BG25_001", "troll-non-elemental", false, { attack: 30, health: 40 })];
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    stats(human(state), troll, 13 * scale, 17 * scale);
    human(state).shop = [minion("BG32_111", "troll-all-type", false, { attack: 5, health: 9 })];
    state = gameReducer(saved(state), { type: "BUY_MINION", shopIndex: 0 });
    stats(human(state), troll, 18 * scale, 26 * scale);
  });

  test(`Timewarped Jungle King grants its printed bonus to a recruited Beast and excludes other tribes (${version})`, () => {
    let state = setup();
    const player = human(state);
    const source = minion("BG34_PreMadeChamp_004", "jungle-king", golden);
    const beast = minion("tabbycat-token", "jungle-beast");
    const elemental = minion("BGS_115", "jungle-elemental");
    player.board = [source];
    player.hand = [beast, elemental];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    stats(human(state), beast, 4 * scale, 3 * scale);
    stats(human(state), source, 0, 0);
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    stats(human(state), elemental, 0, 0);
  });

  test(`Timewarped Centurion copies the exact first three Tavern spells and resets next turn (${version})`, () => {
    let state = setup();
    const player = human(state);
    const centurion = minion("BG34_PreMadeChamp_200", "centurion", golden);
    player.board = [centurion];
    const originals = [
      spell("tavern-spell-pointy-arrow", "centurion-arrow"),
      spell("tavern-spell-fortify", "centurion-fortify"),
      spell("tavern-spell-tavern-coin", "centurion-coin"),
      spell("tavern-spell-pointy-arrow", "centurion-fourth"),
    ];
    player.hand = [...originals];
    for (const [index, cast] of originals.entries()) {
      const beforeIds = new Set(human(state).hand.map((card) => card.instanceId));
      state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: cast.instanceId,
        ...(cast.target === "none" ? {} : { targetInstanceId: centurion.instanceId }) });
      const copies = human(state).hand.filter((card) => !beforeIds.has(card.instanceId));
      assert.equal(copies.length, index < 3 ? scale : 0);
      for (const copy of copies) {
        assert.equal(copy.kind, "tavernSpell");
        assert.equal(copy.definitionId, cast.definitionId);
        assert.equal(copy.cardId, cast.cardId);
        assert.notEqual(copy.instanceId, cast.instanceId);
      }
      if (index === 1) state = saved(state);
    }
    state = nextTurn(state);
    human(state).hand = [spell("tavern-spell-tavern-coin", "centurion-new-turn")];
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "centurion-new-turn" });
    assert.equal(human(state).hand.length, scale);
  });

  test(`Timewarped Kil'jaeden adds two real Demon offers and upgrades their bonus next turn (${version})`, () => {
    let state = setup(0x3131);
    const source = minion("BG34_Giant_313", "kiljaeden", golden);
    human(state).board = [source];
    poolOnly(state, ["BGS_115", "BG24_009"]);
    for (let turn = 0; turn < 2; turn += 1) {
      if (turn === 1) state = nextTurn(saved(state));
      human(state).gold = 100;
      state = gameReducer(state, { type: "REFRESH_SHOP" });
      const offers = human(state).shop;
      assert.equal(offers.length, 5, "Tier 1 has three regular offers plus two extra Demons");
      const bonus = 7 * scale * (turn + 1);
      const extras = offers.filter((card) => {
        const d = getMinionDefinition(card.definitionId);
        return card.attack === d.attack + bonus && card.health === d.health + bonus;
      });
      assert.equal(extras.length, 2);
      assert.equal(new Set(extras.map((card) => card.instanceId)).size, 2);
      assert.ok(extras.every((card) => card.tribes.includes("demon") || card.tribes.includes("all")));
      assert.ok(extras.every((card) => !card.golden && !getMinionDefinition(card.definitionId).shopFodder));
      for (const id of ["BGS_115", "BG24_009"]) {
        const reserved = state.players.flatMap((seat) => [
          ...seat.shop, ...seat.board,
          ...seat.hand.filter((card): card is BoardMinionInstance => card.kind === "minion"),
        ]).filter((card) => card.definitionId === id)
          .reduce((sum, card) => sum + card.poolCopies, 0);
        assert.equal(state.pool[id] + reserved, 64, "all players' current offers and owned copies belong in the shared-pool total");
      }
      stats(human(state), source, 0, 0);
    }
  });

  test(`Timewarped Painter grows only after Tier 3 or lower cards and preserves the improvement (${version})`, () => {
    for (const action of ["lowMinion", "lowSpell", "highMinion", "highSpell", "tierlessGem"] as const) {
      let state = setup();
      const player = human(state);
      const far = minion("BG25_001", `painter-growth-far-${action}`);
      const left = minion("BGS_115", `painter-growth-left-${action}`);
      const source = minion("BG34_Giant_319", `painter-growth-${action}`, golden);
      const right = minion("BG33_140", `painter-growth-right-${action}`);
      player.board = [far, left, source, right];
      if (action === "lowMinion" || action === "highMinion") {
        player.hand = [minion(action === "lowMinion" ? "tabbycat-token" : "BG25_354", `painter-play-${action}`)];
        state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
      } else if (action === "tierlessGem") {
        player.hand = [gem("painter-tierless-gem")];
        state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "painter-tierless-gem", targetInstanceId: far.instanceId });
      } else {
        const cast = spell(action === "lowSpell" ? "tavern-spell-pointy-arrow" : "tavern-spell-temperature-shift", `painter-cast-${action}`);
        player.hand = [cast];
        state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: cast.instanceId,
          ...(cast.target === "none" ? {} : { targetInstanceId: far.instanceId }) });
      }
      state = gameReducer(saved(state), { type: "END_TURN" });
      const first = current(human(state), left.instanceId);
      const attackGain = first.attack - left.attack;
      const healthGain = first.health - left.health;
      if (action === "lowMinion" || action === "lowSpell") {
        assert.deepEqual([attackGain, healthGain], [6 * scale, 4 * scale], `${action} adds a complete +3/+2 improvement`);
      } else {
        assert.deepEqual([attackGain, healthGain], [3 * scale, 2 * scale], `${action} must not improve the effect`);
      }
      stats(human(state), right, attackGain, healthGain);
      state = gameReducer(state, { type: "CONTINUE" });
      state = gameReducer(state, { type: "END_TURN" });
      stats(human(state), left, attackGain * 2, healthGain * 2);
      stats(human(state), right, attackGain * 2, healthGain * 2);
    }
  });

  test(`Timewarped Jungle King improves after each hand spell family (${version})`, () => {
    for (const family of ["tavern", "spellcraft", "bloodGem", "generated"] as const) {
      let state = setup();
      const player = human(state);
      const source = minion("BG34_PreMadeChamp_004", `jungle-growth-${family}`, golden);
      const beast = minion("tabbycat-token", `jungle-growth-beast-${family}`);
      player.board = [source];
      if (family === "bloodGem") {
        player.hand = [gem("jungle-growth-gem"), beast];
        state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "jungle-growth-gem", targetInstanceId: source.instanceId });
      } else if (family === "tavern") {
        player.hand = [spell("tavern-spell-tavern-coin", "jungle-growth-coin"), beast];
        state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "jungle-growth-coin" });
      } else {
        player.hand = [spellcraft(family === "generated" ? "generated-slimy-shield" : "spellcraft-anglers-lure", "jungle-growth-spellcraft"), beast];
        state = gameReducer(state, { type: "CAST_SPELLCRAFT", cardInstanceId: "jungle-growth-spellcraft", targetInstanceId: source.instanceId });
      }
      state = gameReducer(saved(state), { type: "PLAY_HAND_CARD", cardInstanceId: beast.instanceId });
      stats(human(state), beast, 8 * scale, 6 * scale);
    }
  });

  test(`Timewarped Charge Kong's generated Magnetizations trigger Decoder once per Satellite (${version})`, () => {
    let state = setup();
    const player = human(state);
    const kong = minion("BG34_Giant_610", "kong-decoder-kong", golden);
    const decoder = minion("BG34_Giant_120", "kong-decoder-decoder");
    const host = minion("BG29_611", "kong-decoder-host");
    player.board = [kong, decoder, host];
    player.hand = [spell("tavern-spell-tavern-coin", "kong-decoder-first"), spell("tavern-spell-tavern-coin", "kong-decoder-second")];
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "kong-decoder-first" });
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "kong-decoder-second" });
    for (const target of [kong, decoder, host]) {
      stats(human(state), target, 13 * scale, 13 * scale);
      assert.equal(current(human(state), target.instanceId).attachments.length, scale);
    }
    assert.equal(human(state).cardsPlayedThisTurn, 2, "generated Satellites are not played hand cards");
  });

  test(`Timewarped Centurion spends its cast quota even when exact automatic spell copies overflow hand (${version})`, () => {
    let state = setup();
    const player = human(state);
    const cowboy = minion("BG34_Giant_105", "centurion-overflow-cowboy", true);
    player.board = [minion("BG34_PreMadeChamp_200", "centurion-overflow", golden), cowboy];
    player.hand = [...fillers(9), gem("centurion-overflow-gem-1")];
    state = gameReducer(state, { type: "CAST_BLOOD_GEM", cardInstanceId: "centurion-overflow-gem-1", targetInstanceId: cowboy.instanceId });
    assert.equal(human(state).hand.length, 10);
    human(state).hand[0] = gem("centurion-overflow-gem-2");
    state = gameReducer(saved(state), { type: "CAST_BLOOD_GEM", cardInstanceId: "centurion-overflow-gem-2", targetInstanceId: cowboy.instanceId });
    assert.equal(human(state).hand.length, 10);
    human(state).hand[0] = spell("tavern-spell-tavern-coin", "centurion-overflow-final");
    state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "centurion-overflow-final" });
    assert.equal(human(state).hand.length, 9, "three uses were consumed even when an automatic cast could not admit a copy");
    assert.ok(human(state).hand.filter((card) => card.kind === "tavernSpell").every((card) => card.definitionId === "tavern-spell-blood-gem-barrage"));
  });

  test(`Timewarped Pashmar's random Spellcraft is not capped by the owner's Tavern Tier (${version})`, () => {
    const sourceTiers: number[] = [];
    for (let seed = 0; seed < 8; seed += 1) {
      const state = setup(0x2110 + seed);
      const enemy = state.players.find((seat) => !seat.isHuman);
      assert.ok(enemy);
      for (const seat of state.players) {
        if (seat.isHuman) continue;
        seat.alive = seat.id === enemy.id;
        seat.health = seat.alive ? 1_000 : 0;
      }
      enemy.board = [minion("tabbycat-token", "pashmar-enemy", false, { attack: 1, health: 1_000_000 })];
      human(state).tavernTier = 1;
      human(state).board = [
        minion("BG34_Giant_211", "pashmar-uncapped", golden, { attack: 0, health: 1_000_000 }),
        ...["tabbycat-token", "hyena-token", "rat-token"].map((id, index) =>
          minion(id, `pashmar-victim-${index}`, false, { attack: 0, health: 1, taunt: true })),
      ];
      const ended = gameReducer(state, { type: "END_TURN" });
      const cards = human(ended).hand.filter((card) => card.kind === "spellcraft");
      assert.equal(cards.length, scale);
      for (const card of cards) sourceTiers.push(getSpellcraftDefinition(card.definitionId).sourceTier);
    }
    assert.ok(sourceTiers.some((tier) => tier > 1), "a Tier 1 owner can receive higher-tier Spellcraft rewards");
  });
}
