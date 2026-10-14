import assert from "node:assert/strict";
import test from "node:test";

import { MINION_DEFINITIONS, getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import { TIMEWARP_STAT_GRANTING_TAVERN_SPELL_EFFECTS } from "../lib/game/timewarp.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function recruitState(seed = 0x6030): GameState {
  const state = createGame(seed);
  for (const player of state.players) {
    player.health = 1_000;
    player.gold = 0;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.heroRefreshAvailable = false;
    player.freeRefreshes = 0;
  }
  humanPlayer(state).gold = 100;
  return state;
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function handFillers(count: number): BoardMinionInstance[] {
  const definitions = MINION_DEFINITIONS.filter(
    (definition) => definition.collectible !== false,
  ).slice(0, count);
  assert.equal(definitions.length, count);
  return definitions.map((definition, index) =>
    minion(definition.id, `filler-${index}`),
  );
}

function currentMinion(
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance {
  const found = [...player.board, ...player.hand, ...player.shop].find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.instanceId === instanceId,
  );
  assert.ok(found, `${instanceId} must remain present`);
  return found;
}

function assertStats(
  player: PlayerState,
  original: BoardMinionInstance,
  attackDelta: number,
  healthDelta: number,
): void {
  const actual = currentMinion(player, original.instanceId);
  assert.deepEqual(
    [actual.attack, actual.health],
    [original.attack + attackDelta, original.health + healthDelta],
    original.instanceId,
  );
}

function roundTrip(state: GameState): GameState {
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state)));
  assert.ok(restored);
  return restored as GameState;
}

function minion(
  definitionId: string,
  instanceId: string,
  golden = false,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  if (golden) {
    assert.ok(definition.goldenCardId);
    assert.ok(definition.goldenDescription);
  }
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden ? definition.goldenCardId! : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
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
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: golden ? definition.goldenDescription! : definition.description,
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
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

for (const golden of [false, true]) {
  test(`Timewarped Lamplighter grants ${golden ? 4 : 2} Tavern Spells at end of turn (${golden ? "golden" : "normal"})`, () => {
    const state = createGame(0x6030);
    const player = humanPlayer(state);
    player.hand = [];
    player.board = [minion("BG34_Giant_603", "lamplighter", golden)];

    const ended = gameReducer(state, { type: "END_TURN" });
    assert.equal(ended.phase, "combat");
    const cards = humanPlayer(ended).hand;
    assert.equal(cards.length, golden ? 4 : 2);
    assert.ok(cards.every((card) => card.kind === "tavernSpell"));
  });

  test(`Lamplighter only grants reviewed stat spells across deterministic seeds (${golden ? "golden" : "normal"})`, () => {
    for (let seed = 0x6031; seed < 0x6051; seed += 1) {
      const state = recruitState(seed);
      humanPlayer(state).board = [
        minion("BG34_Giant_603", "stat-lamplighter", golden),
      ];
      const cards = humanPlayer(gameReducer(state, { type: "END_TURN" })).hand;
      assert.equal(cards.length, golden ? 4 : 2, `seed ${seed}`);
      for (const card of cards) {
        assert.equal(card.kind, "tavernSpell");
        assert.ok(card.kind === "tavernSpell");
        const definition = getTavernSpellDefinition(card.definitionId);
        assert.ok(
          TIMEWARP_STAT_GRANTING_TAVERN_SPELL_EFFECTS.has(definition.effect),
          `Lamplighter must not grant ${definition.id}`,
        );
        assert.notEqual(definition.effect, "gainOneGold");
        assert.notEqual(definition.effect, "discoverTierOne");
        assert.notEqual(definition.effect, "searchThePast");
      }
    }
  });

  test(`Drakkari repeats Lamplighter card grants and a JSON round trip retains them (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x603d);
    humanPlayer(state).board = [
      minion("BG34_Giant_603", "drakkari-lamplighter", golden),
      minion("BG26_ICC_901", "lamplighter-drakkari"),
    ];

    const ended = gameReducer(state, { type: "END_TURN" });
    const cards = humanPlayer(ended).hand;
    assert.equal(cards.length, golden ? 8 : 4);
    assert.equal(new Set(cards.map((card) => card.instanceId)).size, cards.length);
    assert.deepEqual(humanPlayer(roundTrip(ended)).hand, cards);
  });

  test(`Lamplighter respects hand capacity and Peggy only observes cards that enter hand (${golden ? "golden" : "normal"})`, () => {
    for (const initialHandSize of [9, 10]) {
      const state = recruitState(0x6060 + initialHandSize);
      const player = humanPlayer(state);
      const peggy = minion("BG34_Giant_327", "cap-peggy", golden);
      const pirate = minion("BGS_049", "cap-pirate");
      player.board = [
        minion("BG34_Giant_603", "cap-lamplighter", golden),
        peggy,
        pirate,
      ];
      player.hand = handFillers(initialHandSize);
      const fillerIds = player.hand.map((card) => card.instanceId);

      const ended = gameReducer(state, { type: "END_TURN" });
      const nextPlayer = humanPlayer(ended);
      const admitted = 10 - initialHandSize;
      assert.equal(nextPlayer.hand.length, 10);
      assert.deepEqual(
        nextPlayer.hand.slice(0, initialHandSize).map((card) => card.instanceId),
        fillerIds,
      );
      assert.equal(
        nextPlayer.hand.filter((card) => card.kind === "tavernSpell").length,
        admitted,
      );
      const delta = admitted * (golden ? 2 : 1);
      assertStats(nextPlayer, peggy, delta, delta);
      assertStats(nextPlayer, pirate, delta, delta);
    }
  });

  test(`Timewarped Sellemental generates ordinary Sellementals (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x6700);
    humanPlayer(state).board = [
      minion("BG34_Giant_067", "timewarp-sellemental", golden),
    ];
    const poolBefore = state.pool.BGS_115;
    const ended = gameReducer(state, { type: "END_TURN" });
    const hand = humanPlayer(ended).hand;
    assert.equal(hand.length, golden ? 2 : 1);
    for (const card of hand) {
      assert.equal(card.kind, "minion");
      assert.ok(card.kind === "minion");
      assert.equal(card.definitionId, "BGS_115");
      assert.equal(card.cardId, "BGS_115");
      assert.equal(card.golden, false);
    }
    assert.equal(ended.pool.BGS_115, poolBefore);
  });

  test(`Timewarped Silivaz repeats for every friendly Golden minion (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x2100);
    const player = humanPlayer(state);
    const left = minion("live-skeleton-token", "silivaz-left");
    const source = minion("BG34_Giant_021", "silivaz", golden);
    const right = minion("BGS_115", "silivaz-right");
    const outside = minion("BG34_Giant_603", "silivaz-golden-outside", true);
    player.board = [left, source, right, outside];
    const friendlyGoldenCount = golden ? 2 : 1;
    const delta = (golden ? 16 : 8) * (1 + friendlyGoldenCount);

    const nextPlayer = humanPlayer(gameReducer(state, { type: "END_TURN" }));
    assertStats(nextPlayer, left, delta, delta);
    assertStats(nextPlayer, right, delta, delta);
    assertStats(nextPlayer, source, 0, 0);
    assertStats(nextPlayer, outside, 0, 0);
  });

  test(`Timewarped Nomi buffs all current and future Tavern minions (${golden ? "golden" : "normal"})`, () => {
    let state = recruitState(0x3200);
    const player = humanPlayer(state);
    const source = minion("BG34_Giant_032", "nomi", golden);
    const shopUndead = minion("BG25_001", "nomi-shop-undead");
    const shopElemental = minion("BGS_115", "nomi-shop-elemental");
    player.board = [source];
    player.shop = [shopUndead, shopElemental];
    player.hand = [minion("BGS_119", "nomi-played-elemental")];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const attack = golden ? 8 : 4;
    const health = golden ? 6 : 3;
    let nextPlayer = humanPlayer(state);
    assertStats(nextPlayer, shopUndead, attack, health);
    assertStats(nextPlayer, shopElemental, attack, health);
    assertStats(nextPlayer, source, 0, 0);
    assert.equal(nextPlayer.tavernMinionAttackBonus, attack);
    assert.equal(nextPlayer.tavernMinionHealthBonus, health);

    state = roundTrip(state);
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    nextPlayer = humanPlayer(state);
    assert.ok(nextPlayer.shop.length > 0);
    for (const card of nextPlayer.shop) {
      const definition = getMinionDefinition(card.definitionId);
      assert.deepEqual(
        [card.attack, card.health],
        [definition.attack + attack, definition.health + health],
      );
    }
  });

  test(`Timewarped Ghoul improves Tavern Spell stat grants after a Recruit death (${golden ? "golden" : "normal"})`, () => {
    let state = recruitState(0x3400);
    const player = humanPlayer(state);
    const source = minion("BG34_Giant_034", "ghoul", golden);
    const target = minion("BGS_115", "ghoul-arrow-target");
    player.board = [source, target];
    player.hand = [
      tavernSpell("tavern-spell-slaughter", "ghoul-slaughter"),
      tavernSpell("tavern-spell-pointy-arrow", "ghoul-arrow"),
    ];

    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: "ghoul-slaughter",
      targetInstanceId: source.instanceId,
    });
    let nextPlayer = humanPlayer(state);
    assert.equal(nextPlayer.board.some((card) => card.instanceId === source.instanceId), false);
    const bonus = golden ? 4 : 2;
    assert.equal(nextPlayer.tavernSpellAttackBonus, bonus);
    assert.equal(nextPlayer.tavernSpellHealthBonus, bonus);

    state = roundTrip(state);
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: "ghoul-arrow",
      targetInstanceId: target.instanceId,
    });
    nextPlayer = humanPlayer(state);
    assertStats(nextPlayer, target, 4 + bonus, bonus);
  });

  test(`Timewarped Dirge buffs every owned board and hand minion including itself (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x3100);
    const player = humanPlayer(state);
    const source = minion("BG34_Giant_310", "dirge", golden);
    const boardTarget = minion("BGS_115", "dirge-board-elemental");
    const handTarget = minion("BG25_001", "dirge-hand-undead");
    const shopTarget = minion("BGS_119", "dirge-unpurchased-shop-elemental");
    const spell = tavernSpell("tavern-spell-tavern-coin", "dirge-spell");
    player.board = [source, boardTarget];
    player.hand = [spell, handTarget];
    player.shop = [shopTarget];

    const nextPlayer = humanPlayer(gameReducer(state, { type: "END_TURN" }));
    const attack = golden ? 4 : 2;
    const health = golden ? 2 : 1;
    for (const card of [source, boardTarget, handTarget]) {
      assertStats(nextPlayer, card, attack, health);
    }
    assertStats(nextPlayer, shopTarget, 0, 0);
    assert.deepEqual(nextPlayer.hand.find((card) => card.instanceId === spell.instanceId), spell);
  });

  test(`Timewarped Carbonic Elemental grants exact Temperature Shift cards (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x3201);
    humanPlayer(state).board = [
      minion("BG34_PreMadeChamp_032", "carbonic", golden),
    ];
    const poolBefore = state.spellPool["tavern-spell-temperature-shift"];
    const ended = gameReducer(state, { type: "END_TURN" });
    const cards = humanPlayer(ended).hand;
    assert.equal(cards.length, golden ? 2 : 1);
    for (const card of cards) {
      assert.equal(card.kind, "tavernSpell");
      assert.equal(card.definitionId, "tavern-spell-temperature-shift");
      assert.equal(card.cardId, "BG31_819");
    }
    assert.equal(ended.spellPool["tavern-spell-temperature-shift"], poolBefore);
  });

  test(`Timewarped Bream Counter grows all owned minions after a Murloc play (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x4900);
    const player = humanPlayer(state);
    const source = minion("BG34_PreMadeChamp_049", "bream", golden);
    const boardTarget = minion("BGS_115", "bream-board-elemental");
    const handTarget = minion("BG25_001", "bream-hand-undead");
    const played = minion("BG33_140", "bream-played-murloc");
    const shopTarget = minion("BGS_119", "bream-unpurchased-shop-elemental");
    const spell = tavernSpell("tavern-spell-tavern-coin", "bream-spell");
    player.board = [source, boardTarget];
    player.hand = [played, spell, handTarget];
    player.shop = [shopTarget];

    const nextPlayer = humanPlayer(gameReducer(state, { type: "PLAY_MINION", handIndex: 0 }));
    const delta = golden ? 4 : 2;
    for (const card of [source, boardTarget, handTarget, played]) {
      assertStats(nextPlayer, card, delta, delta);
    }
    assertStats(nextPlayer, shopTarget, 0, 0);
    assert.deepEqual(nextPlayer.hand.find((card) => card.instanceId === spell.instanceId), spell);
  });

  test(`Timewarped Imp Infiltrator only advances on paid Gold and persists through saves (${golden ? "golden" : "normal"})`, () => {
    let state = recruitState(0x1300);
    humanPlayer(state).board = [
      minion("BG34_PreMadeChamp_013", "imp-infiltrator", golden),
    ];
    humanPlayer(state).freeRefreshes = 1;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    assert.equal(humanPlayer(state).goldSpentThisTurn, 0);
    for (let spent = 0; spent < 7; spent += 1) {
      state = gameReducer(state, { type: "REFRESH_SHOP" });
    }
    assert.equal(humanPlayer(state).tavernMinionAttackBonus, 0);
    assert.equal(humanPlayer(state).tavernMinionHealthBonus, 0);
    state = roundTrip(state);
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    const delta = golden ? 6 : 3;
    let nextPlayer = humanPlayer(state);
    assert.equal(nextPlayer.tavernMinionAttackBonus, delta);
    assert.equal(nextPlayer.tavernMinionHealthBonus, delta);
    for (const card of nextPlayer.shop) {
      const definition = getMinionDefinition(card.definitionId);
      assert.deepEqual([card.attack, card.health], [definition.attack + delta, definition.health + delta]);
    }
    for (let spent = 0; spent < 8; spent += 1) {
      state = gameReducer(state, { type: "REFRESH_SHOP" });
    }
    nextPlayer = humanPlayer(state);
    assert.equal(nextPlayer.tavernMinionAttackBonus, delta * 2);
    assert.equal(nextPlayer.tavernMinionHealthBonus, delta * 2);
  });

  test(`Timewarped Peggy buffs all board Pirates including herself for a purchased card (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x3270);
    const player = humanPlayer(state);
    const source = minion("BG34_Giant_327", "peggy", golden);
    const pirate = minion("BGS_049", "peggy-pirate");
    const outsider = minion("BGS_115", "peggy-elemental");
    const bought = minion("BG25_001", "peggy-purchased-undead");
    player.board = [source, pirate, outsider];
    player.shop = [bought];

    const nextPlayer = humanPlayer(gameReducer(state, { type: "BUY_MINION", shopIndex: 0 }));
    const delta = golden ? 2 : 1;
    assertStats(nextPlayer, source, delta, delta);
    assertStats(nextPlayer, pirate, delta, delta);
    assertStats(nextPlayer, outsider, 0, 0);
    assertStats(nextPlayer, bought, 0, 0);
  });

  test(`Timewarped Looter checks the Tier of played minions and spells (${golden ? "golden" : "normal"})`, () => {
    for (const playedKind of ["lowMinion", "highMinion", "highSpell"] as const) {
      const state = recruitState(0x6500);
      const player = humanPlayer(state);
      const source = minion("BG34_PreMadeChamp_065", `looter-${playedKind}`, golden);
      const pirate = minion("BGS_049", "looter-pirate");
      const outsider = minion("BG25_001", "looter-undead");
      const played = playedKind === "highSpell"
        ? tavernSpell("tavern-spell-temperature-shift", "looter-played")
        : minion(playedKind === "lowMinion" ? "BGS_115" : "BG25_354", "looter-played");
      player.board = [source, pirate, outsider];
      player.hand = [played];

      const nextPlayer = humanPlayer(gameReducer(state, {
        type: playedKind === "highSpell" ? "CAST_TAVERN_SPELL" : "PLAY_HAND_CARD",
        cardInstanceId: played.instanceId,
      }));
      const multiplier = playedKind === "lowMinion" ? 0 : golden ? 2 : 1;
      assertStats(nextPlayer, source, 3 * multiplier, 2 * multiplier);
      assertStats(nextPlayer, pirate, 3 * multiplier, 2 * multiplier);
      assertStats(nextPlayer, outsider, 0, 0);
    }
  });

  test(`Timewarped Anubarak permanently grows present and future Undead (${golden ? "golden" : "normal"})`, () => {
    let state = recruitState(0x8300);
    const player = humanPlayer(state);
    const source = minion("BG34_PreMadeChamp_083", "anubarak", golden);
    const boardUndead = minion("live-skeleton-token", "anubarak-board-undead");
    const outsider = minion("BGS_115", "anubarak-elemental");
    const played = minion("BG25_001", "anubarak-played-undead");
    const handUndead = minion("BG28_300", "anubarak-hand-undead");
    player.board = [source, boardUndead, outsider];
    player.hand = [played, handUndead];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    let nextPlayer = humanPlayer(state);
    const delta = golden ? 6 : 3;
    assert.equal(nextPlayer.undeadArmyAttackBonus, delta);
    assert.equal(nextPlayer.undeadArmyHealthBonus, 0);
    for (const card of [source, boardUndead, played, handUndead]) {
      assertStats(nextPlayer, card, delta, 0);
    }
    assertStats(nextPlayer, outsider, 0, 0);

    state = roundTrip(state);
    state.activeTribes = ["undead"];
    for (const definitionId of Object.keys(state.pool)) {
      state.pool[definitionId] = 0;
    }
    state.pool.BG25_001 = 10;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    nextPlayer = humanPlayer(state);
    assert.ok(nextPlayer.shop.length > 0);
    const futureUndead = nextPlayer.shop[0];
    const definition = getMinionDefinition(futureUndead.definitionId);
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    nextPlayer = humanPlayer(state);
    const acquired = currentMinion(nextPlayer, futureUndead.instanceId);
    assert.equal(acquired.attack, definition.attack + delta);
    assert.equal(acquired.health, definition.health);
  });

  test(`AI Lamplighter uses the same end-turn card grants as the human (${golden ? "golden" : "normal"})`, () => {
    const state = recruitState(0x603a);
    const player = humanPlayer(state);
    const ai = state.players.find((candidate) => !candidate.isHuman);
    assert.ok(ai);
    player.board = [minion("BG34_Giant_603", "human-lamplighter", golden)];
    ai.board = [minion("BG34_Giant_603", "ai-lamplighter", golden)];

    const ended = gameReducer(state, { type: "END_TURN" });
    const recruitedAi = ended.players.find((candidate) => candidate.id === ai.id);
    assert.ok(recruitedAi);
    for (const seat of [humanPlayer(ended), recruitedAi]) {
      assert.equal(seat.hand.length, golden ? 4 : 2);
      assert.ok(seat.hand.every((card) => card.kind === "tavernSpell"));
    }
  });
}
