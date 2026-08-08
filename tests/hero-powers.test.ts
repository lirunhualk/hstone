import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_POWER_DEFINITIONS,
  UNSUPPORTED_HERO_POWER_EFFECTS,
  getHeroPowerDefinition,
  heroPowerCanBeManuallyActivated,
  heroPowerIsPlayable,
  heroesAvailableForTribes,
  identityEligibleHeroPowers,
} from "../lib/game/hero-powers.ts";
import {
  advanceHeadlessGame,
  createHeadlessGame,
  createGame,
  gameReducer,
  getHeroPowerActivationQuote,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  TIER_SEVEN_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { MinionTier, Tribe } from "../lib/game/types.ts";

const ALL_TRIBES: Tribe[] = [
  "beast",
  "demon",
  "dragon",
  "elemental",
  "mech",
  "murloc",
  "naga",
  "pirate",
  "quilboar",
  "undead",
];

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function pendingHeroPowerDiscover(
  state: GameState,
  heroPowerId: string,
) {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.sourceDefinitionId, heroPowerId);
  assert.equal(pending.completionSource, undefined);
  return pending;
}

const GALAKROND_HERO_POWER_ID =
  "hero-power-tb_baconshop_hp_011" as const;
const GEORGE_HERO_POWER_ID =
  "hero-power-tb_baconshop_hp_010" as const;

function minionFromDefinition(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  poolCopies = 1,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    instanceId,
    definitionId: definition.id,
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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    effectCounters: {},
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
    poolCopies,
    poolCopiesByDefinitionId: undefined,
    poolCopiesOnPurchase: undefined,
    attachments: [],
  };
}

function exactTierDefinitions(tier: MinionTier) {
  return (tier === 7
    ? TIER_SEVEN_MINION_DEFINITIONS
    : LIVE_MINION_DEFINITIONS
  )
    .filter((definition) => definition.tier === tier)
    .slice(0, 3);
}

function prepareGalakrondState(seed = 0x6a1a): GameState {
  const state = createGame(seed);
  const player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  state.pendingInteraction = null;
  player.heroId = "hero-tb-02";
  player.heroPowerId = GALAKROND_HERO_POWER_ID;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.tavernTier = 1;
  player.gold = 10;
  player.hand = [];
  player.board = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  const template = player.shop[0];
  assert.ok(template);
  const targetDefinition = exactTierDefinitions(1)[0];
  assert.ok(targetDefinition);
  player.shop = [
    minionFromDefinition(
      template,
      targetDefinition.id,
      "galakrond-target",
    ),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  return state;
}

function prepareGeorgeState(seed = 0x9e0a): GameState {
  const state = createGame(seed);
  const player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  state.pendingInteraction = null;
  player.heroId = "hero-tb-15";
  player.heroPowerId = GEORGE_HERO_POWER_ID;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.gold = 10;
  player.goldSpentThisTurn = 0;
  player.hand = [];
  player.board = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  return state;
}

function seedExactTierPool(state: GameState, tier: MinionTier) {
  const definitions = exactTierDefinitions(tier);
  assert.equal(definitions.length, 3);
  for (const definition of definitions) {
    state.pool[definition.id] = 1;
  }
  return definitions;
}

test("hero offers and Identity exclude explicitly unsupported powers", () => {
  const offeredHeroes = heroesAvailableForTribes(ALL_TRIBES);
  assert.equal(offeredHeroes.length, 30);
  assert.ok(
    offeredHeroes.every((hero) => heroPowerIsPlayable(hero.heroPowerId)),
  );
  assert.equal(UNSUPPORTED_HERO_POWER_EFFECTS.size, 84);
  assert.equal(
    HERO_POWER_DEFINITIONS.filter((power) =>
      UNSUPPORTED_HERO_POWER_EFFECTS.has(power.effect),
    ).length,
    90,
  );
  assert.equal(
    offeredHeroes.filter(
      (hero) =>
        getHeroPowerDefinition(hero.heroPowerId).activation === "active",
    ).length,
    5,
  );

  const identityIneligibleEffects = new Set([
    "bonusStartingHealth",
    "startWithAmalgam",
    "growingTavernBuff",
    "chooseTrinketAtTurn5",
    "chooseGreaterTrinketAtTurn8",
    "discoverHeroPowerAtTurn4",
  ]);
  assert.equal(identityEligibleHeroPowers(null, ALL_TRIBES).length, 27);
  assert.ok(
    identityEligibleHeroPowers(null, ALL_TRIBES).every(
      (power) =>
        heroPowerIsPlayable(power.id) &&
        !identityIneligibleEffects.has(power.effect),
    ),
  );
});

test("Identity excludes Hero Powers whose minion types are unavailable", () => {
  const activeTribes: Tribe[] = [
    "demon",
    "mech",
    "murloc",
    "naga",
    "quilboar",
  ];
  const eligiblePowerIds = new Set(
    identityEligibleHeroPowers(null, activeTribes).map((power) => power.id),
  );

  assert.equal(eligiblePowerIds.has("hero-power-sprout-it-out"), false);
  assert.equal(eligiblePowerIds.has("hero-power-dream-portal"), false);
  assert.equal(eligiblePowerIds.has("hero-power-avalanche"), false);
  assert.equal(eligiblePowerIds.has("hero-power-yo-ho-ogre"), false);

  assert.ok(
    identityEligibleHeroPowers(null, [...activeTribes, "dragon"]).some(
      (power) => power.id === "hero-power-dream-portal",
    ),
  );
  assert.ok(
    identityEligibleHeroPowers(null, [...activeTribes, "undead"]).some(
      (power) => power.id === "hero-power-sprout-it-out",
    ),
  );
});

test("triggered Blackthorn and Gallywix powers are passive", () => {
  for (const effect of [
    "getBloodGemsPerTurn",
    "goldAfterSellNextTurn",
  ] as const) {
    const power = HERO_POWER_DEFINITIONS.find(
      (candidate) => candidate.effect === effect,
    );
    assert.ok(power);
    assert.equal(power.activation, "passive");
    assert.equal(heroPowerCanBeManuallyActivated(power.id), false);
  }
});

test("George is playable and Boon of Light targets the Tavern or friendly warband", () => {
  const hero = heroesAvailableForTribes(ALL_TRIBES).find(
    (candidate) => candidate.id === "hero-tb-15",
  );
  assert.ok(hero);
  assert.equal(hero.heroPowerId, GEORGE_HERO_POWER_ID);
  assert.equal(heroPowerIsPlayable(GEORGE_HERO_POWER_ID), true);
  assert.equal(heroPowerCanBeManuallyActivated(GEORGE_HERO_POWER_ID), true);

  const state = prepareGeorgeState();
  const player = humanPlayer(state);
  const boardTarget = player.shop.shift();
  assert.ok(boardTarget);
  boardTarget.instanceId = "george-friendly-target";
  player.board = [boardTarget];
  const shopTarget = player.shop[0];
  assert.ok(shopTarget);

  assert.deepEqual(getHeroPowerActivationQuote(state, player.id), {
    cost: 1,
    affordable: true,
    usable: true,
    targetKind: "shopOrBoard",
  });
  assert.equal(
    getHeroPowerActivationQuote(
      state,
      player.id,
      boardTarget.instanceId,
    )?.usable,
    true,
  );
  assert.equal(
    getHeroPowerActivationQuote(
      state,
      player.id,
      shopTarget.instanceId,
    )?.usable,
    true,
  );
});

test("Boon of Light grants a permanent shield and charges exactly once", () => {
  let state = prepareGeorgeState(0x9e0b);
  let player = humanPlayer(state);
  const target = player.shop.shift();
  assert.ok(target);
  target.instanceId = "george-permanent-target";
  player.board = [target];
  const otherTarget = player.shop[0];
  assert.ok(otherTarget);
  const beforeGold = player.gold;

  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.gold, beforeGold - 1);
  assert.equal(player.goldSpentThisTurn, 1);
  assert.equal(player.heroPowerActiveThisTurn, true);
  assert.equal(player.board[0].divineShield, true);
  assert.equal(player.board[0].temporaryDivineShield, false);

  const afterFirstUse = structuredClone(state);
  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: otherTarget.instanceId,
  });
  assert.deepEqual(state, afterFirstUse);

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(restored);
  const restoredPlayer = humanPlayer(restored);
  assert.equal(restoredPlayer.heroPowerActiveThisTurn, true);
  assert.equal(restoredPlayer.board[0].divineShield, true);
  assert.equal(restoredPlayer.board[0].temporaryDivineShield, false);
});

test("Boon of Light makes a temporary shield permanent", () => {
  let state = prepareGeorgeState(0x9e0c);
  let player = humanPlayer(state);
  const target = player.shop.shift();
  assert.ok(target);
  target.instanceId = "george-temporary-shield";
  target.divineShield = true;
  target.temporaryDivineShield = true;
  player.board = [target];

  assert.equal(
    getHeroPowerActivationQuote(state, player.id, target.instanceId)?.usable,
    true,
  );
  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.board[0].divineShield, true);
  assert.equal(player.board[0].temporaryDivineShield, false);
});

test("Boon of Light rejects stale and enemy targets atomically", () => {
  for (const invalidTarget of ["stale", "enemy"] as const) {
    const state = prepareGeorgeState(
      invalidTarget === "stale" ? 0x9e0d : 0x9e0e,
    );
    const player = humanPlayer(state);
    const friendly = player.shop.shift();
    assert.ok(friendly);
    friendly.instanceId = `george-${invalidTarget}-friendly`;
    player.board = [friendly];
    const enemy = state.players.find((candidate) => candidate.id !== player.id);
    assert.ok(enemy?.shop[0]);
    const targetInstanceId =
      invalidTarget === "enemy"
        ? enemy.shop[0].instanceId
        : "george-stale-target";
    const before = structuredClone(state);

    const rejected = gameReducer(state, {
      type: "ACTIVATE_HERO_POWER",
      targetInstanceId,
    });
    assert.deepEqual(rejected, before);
  }
});

test("a Tavern minion keeps George's shield after purchase and play", () => {
  let state = prepareGeorgeState(0x9e0f);
  let player = humanPlayer(state);
  player.board = [];
  const target = player.shop[0];
  assert.ok(target);
  target.instanceId = "george-shop-target";

  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.shop[0].divineShield, true);
  assert.equal(player.shop[0].temporaryDivineShield, false);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const handIndex = player.hand.findIndex(
    (card) => card.kind === "minion" && card.instanceId === target.instanceId,
  );
  assert.ok(handIndex >= 0);
  const bought = player.hand[handIndex];
  assert.equal(bought.kind, "minion");
  assert.equal(bought.divineShield, true);

  state = gameReducer(state, { type: "PLAY_MINION", handIndex });
  player = humanPlayer(state);
  const played = player.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(played);
  assert.equal(played.divineShield, true);
  assert.equal(played.temporaryDivineShield, false);
});

test("George AI protects Venomous utility and only shields a shop minion it can buy", () => {
  {
    let state = createHeadlessGame(0x9e10);
    state.activeTribes = [...ALL_TRIBES];
    state.pendingInteraction = null;
    const player = state.players[0];
    player.heroId = "hero-tb-15";
    player.heroPowerId = GEORGE_HERO_POWER_ID;
    player.heroPowerCounters = {};
    player.heroPowerActiveThisTurn = false;
    player.gold = 1;
    player.hand = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    const template = player.shop[0];
    assert.ok(template);
    const big = { ...template, instanceId: "george-ai-big", attack: 18 };
    const venomous = {
      ...template,
      instanceId: "george-ai-venomous",
      attack: 1,
      health: 1,
      venomous: true,
    };
    player.board = [big, venomous];
    player.shop = [];
    for (let index = 1; index < state.players.length; index += 1) {
      const opponent = state.players[index];
      opponent.shop = [];
      opponent.spellShop = null;
      opponent.additionalSpellShop = [];
      opponent.gold = 0;
      if (index > 1) opponent.alive = false;
    }

    state = advanceHeadlessGame(state);
    const advanced = state.players[0];
    assert.equal(
      advanced.board.find((minion) => minion.instanceId === big.instanceId)
        ?.divineShield,
      false,
    );
    assert.equal(
      advanced.board.find(
        (minion) => minion.instanceId === venomous.instanceId,
      )?.divineShield,
      true,
    );
    assert.equal(advanced.heroPowerActiveThisTurn, true);
  }

  {
    let state = createHeadlessGame(0x9e11);
    state.activeTribes = [...ALL_TRIBES];
    state.pendingInteraction = null;
    const player = state.players[0];
    player.heroId = "hero-tb-15";
    player.heroPowerId = GEORGE_HERO_POWER_ID;
    player.heroPowerCounters = {};
    player.heroPowerActiveThisTurn = false;
    player.tavernTier = 6;
    player.gold = 4;
    player.hand = [];
    player.board = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    const target = player.shop[0];
    assert.ok(target);
    target.instanceId = "george-ai-shop-buy";
    player.shop = [target];
    for (let index = 1; index < state.players.length; index += 1) {
      const opponent = state.players[index];
      opponent.shop = [];
      opponent.spellShop = null;
      opponent.additionalSpellShop = [];
      opponent.gold = 0;
      if (index > 1) opponent.alive = false;
    }

    state = advanceHeadlessGame(state);
    const advanced = state.players[0];
    const owned = [...advanced.board, ...advanced.hand]
      .filter((card): card is BoardMinionInstance => card.kind === "minion")
      .find((minion) => minion.instanceId === target.instanceId);
    assert.ok(owned);
    assert.equal(owned.divineShield, true);
    assert.equal(advanced.heroPowerActiveThisTurn, true);
  }
});

test("Galakrond discovers the exact next tier and replaces the original shop slot", () => {
  let state = prepareGalakrondState();
  let player = humanPlayer(state);
  const target = player.shop[0];
  const targetDefinitionId = target.definitionId;
  const tierTwoDefinitions = seedExactTierPool(state, 2);
  player.tavernMinionAttackBonus = 2;
  player.tavernMinionHealthBonus = 3;
  const beforeHandSize = player.hand.length;

  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const discover = pendingHeroPowerDiscover(
    state,
    GALAKROND_HERO_POWER_ID,
  );
  assert.deepEqual(discover.filter, { exactTier: 2 });
  assert.deepEqual(discover.destination, {
    kind: "replaceShop",
    targetInstanceId: target.instanceId,
  });
  assert.equal(discover.options.length, 3);
  assert.ok(discover.options.every((option) => option.tier === 2));
  assert.equal(player.shop[0].instanceId, target.instanceId);
  assert.equal(player.gold, 9);
  assert.equal(player.heroPowerActiveThisTurn, true);
  assert.ok(
    tierTwoDefinitions.every(
      (definition) => state.pool[definition.id] === 0,
    ),
  );

  const selected = { ...discover.options[1] };
  const unselectedDefinitionIds = discover.options
    .filter((option) => option.instanceId !== selected.instanceId)
    .map((option) => option.definitionId);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: discover.interactionId,
    optionInstanceId: selected.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(player.shop.length, 1);
  assert.equal(player.shop[0].instanceId, selected.instanceId);
  assert.equal(player.shop[0].definitionId, selected.definitionId);
  assert.equal(player.shop[0].attack, selected.attack + 2);
  assert.equal(player.shop[0].health, selected.health + 3);
  assert.equal(state.pool[targetDefinitionId], 1);
  assert.equal(state.pool[selected.definitionId], 0);
  assert.ok(
    unselectedDefinitionIds.every(
      (definitionId) => state.pool[definitionId] === 1,
    ),
  );
  assert.equal(player.hand.length, beforeHandSize);
});

test("Galakrond can keep climbing a frozen offer above the Tavern tier", () => {
  let state = prepareGalakrondState(0x6a1b);
  let player = humanPlayer(state);
  seedExactTierPool(state, 2);
  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: player.shop[0].instanceId,
  });
  let discover = pendingHeroPowerDiscover(
    state,
    GALAKROND_HERO_POWER_ID,
  );
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: discover.interactionId,
    optionInstanceId: discover.options[0].instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 1);
  assert.equal(player.shop[0].tier, 2);
  player.heroPowerActiveThisTurn = false;
  player.gold = 10;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  seedExactTierPool(state, 3);

  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: player.shop[0].instanceId,
  });
  discover = pendingHeroPowerDiscover(state, GALAKROND_HERO_POWER_ID);
  assert.deepEqual(discover.filter, { exactTier: 3 });
  assert.ok(discover.options.every((option) => option.tier === 3));
  assert.equal(humanPlayer(state).tavernTier, 1);
});

test("Galakrond rejects terminal or empty-pool targets transactionally", () => {
  {
    const state = prepareGalakrondState(0x6a1c);
    const player = humanPlayer(state);
    const snapshot = structuredClone(state);
    const rejected = gameReducer(state, {
      type: "ACTIVATE_HERO_POWER",
      targetInstanceId: player.shop[0].instanceId,
    });
    assert.deepEqual(rejected, snapshot);
  }

  {
    const state = prepareGalakrondState(0x6a1d);
    const player = humanPlayer(state);
    const tierSix = exactTierDefinitions(6)[0];
    assert.ok(tierSix);
    player.shop[0] = minionFromDefinition(
      player.shop[0],
      tierSix.id,
      "galakrond-tier-six",
    );
    const snapshot = structuredClone(state);
    const rejected = gameReducer(state, {
      type: "ACTIVATE_HERO_POWER",
      targetInstanceId: player.shop[0].instanceId,
    });
    assert.deepEqual(rejected, snapshot);
  }

  {
    const state = prepareGalakrondState(0x6a1e);
    seedExactTierPool(state, 2);
    const snapshot = structuredClone(state);
    const rejected = gameReducer(state, {
      type: "ACTIVATE_HERO_POWER",
      targetInstanceId: "stale-shop-target",
    });
    assert.deepEqual(rejected, snapshot);
  }
});

test("Galakrond can Discover shared-pool Tier 7 in Norgannon lobbies", () => {
  let state = prepareGalakrondState(0x6a1f);
  let player = humanPlayer(state);
  state.lobbySystemsEnabled = true;
  state.systemEventId = "system-event-norgannon";
  const tierSix = exactTierDefinitions(6)[0];
  assert.ok(tierSix);
  player.shop[0] = minionFromDefinition(
    player.shop[0],
    tierSix.id,
    "galakrond-tier-six-norgannon",
  );
  const tierSevenDefinitions = seedExactTierPool(state, 7);

  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: player.shop[0].instanceId,
  });
  player = humanPlayer(state);
  const discover = pendingHeroPowerDiscover(
    state,
    GALAKROND_HERO_POWER_ID,
  );
  assert.deepEqual(discover.filter, {
    exactTier: 7,
    usesSharedPool: true,
  });
  assert.equal(discover.options.length, 3);
  assert.ok(discover.options.every((option) => option.tier === 7));
  assert.ok(
    tierSevenDefinitions.every(
      (definition) => state.pool[definition.id] === 0,
    ),
  );
});

test("Galakrond Discover triggers Sinstone Sticker without moving the chosen card to hand", () => {
  let state = prepareGalakrondState(0x6a20);
  let player = humanPlayer(state);
  player.trinketIds = ["greater-trinket-bg30-magicitem-801"];
  seedExactTierPool(state, 2);
  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: player.shop[0].instanceId,
  });
  const discover = pendingHeroPowerDiscover(
    state,
    GALAKROND_HERO_POWER_ID,
  );
  const selected = discover.options[0];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: discover.interactionId,
    optionInstanceId: selected.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.shop[0].instanceId, selected.instanceId);
  assert.equal(
    player.hand.filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === selected.definitionId,
    ).length,
    1,
  );
});

test("Galakrond AI resolves the Discover immediately and freezes an unfinished chain", () => {
  let state = createHeadlessGame(0x6a21);
  state.activeTribes = [...ALL_TRIBES];
  state.pendingInteraction = null;
  const player = state.players[0];
  player.heroId = "hero-tb-02";
  player.heroPowerId = GALAKROND_HERO_POWER_ID;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.gold = 10;
  player.tavernTier = 1;
  player.hand = [];
  player.board = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  const template = player.shop[0];
  assert.ok(template);
  const tierOne = exactTierDefinitions(1)[0];
  assert.ok(tierOne);
  player.shop = [
    minionFromDefinition(
      template,
      tierOne.id,
      "galakrond-ai-target",
    ),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  seedExactTierPool(state, 2);
  for (let index = 1; index < state.players.length; index += 1) {
    const opponent = state.players[index];
    opponent.shop = [];
    opponent.spellShop = null;
    opponent.additionalSpellShop = [];
    opponent.gold = 0;
    if (index > 1) opponent.alive = false;
  }

  state = advanceHeadlessGame(state);
  const advanced = state.players[0];
  assert.equal(state.pendingInteraction, null);
  assert.equal(advanced.shop.length, 1);
  assert.equal(advanced.shop[0].tier, 2);
  assert.equal(advanced.frozen, true);
  assert.equal(advanced.heroPowerActiveThisTurn, true);
});

test("Galakrond AI continues the highest-tier chain and sacrifices the weaker tie", () => {
  let state = createHeadlessGame(0x6a24);
  state.activeTribes = [...ALL_TRIBES];
  state.pendingInteraction = null;
  const player = state.players[0];
  player.heroId = "hero-tb-02";
  player.heroPowerId = GALAKROND_HERO_POWER_ID;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.gold = 1;
  player.tavernTier = 1;
  player.hand = [];
  player.board = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  const template = player.shop[0];
  assert.ok(template);
  const tierOne = exactTierDefinitions(1)[0];
  const tierThreeDefinitions = exactTierDefinitions(3);
  assert.ok(tierOne);
  assert.equal(tierThreeDefinitions.length, 3);
  const weakTierThree = minionFromDefinition(
    template,
    tierThreeDefinitions[0].id,
    "galakrond-ai-weak-tier-three",
  );
  const strongTierThree = minionFromDefinition(
    template,
    tierThreeDefinitions[1].id,
    "galakrond-ai-strong-tier-three",
  );
  strongTierThree.attack += 100;
  strongTierThree.health += 100;
  player.shop = [
    minionFromDefinition(
      template,
      tierOne.id,
      "galakrond-ai-lower-tier",
    ),
    weakTierThree,
    strongTierThree,
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  seedExactTierPool(state, 2);
  seedExactTierPool(state, 4);
  for (let index = 1; index < state.players.length; index += 1) {
    const opponent = state.players[index];
    opponent.shop = [];
    opponent.spellShop = null;
    opponent.additionalSpellShop = [];
    opponent.gold = 0;
    if (index > 1) opponent.alive = false;
  }

  state = advanceHeadlessGame(state);
  const advanced = state.players[0];
  assert.equal(state.pendingInteraction, null);
  assert.equal(
    advanced.shop.some(
      (minion) => minion.instanceId === weakTierThree.instanceId,
    ),
    false,
  );
  assert.equal(
    advanced.shop.some(
      (minion) => minion.instanceId === strongTierThree.instanceId,
    ),
    true,
  );
  assert.ok(advanced.shop.some((minion) => minion.tier === 4));
  assert.ok(advanced.shop.some((minion) => minion.tier === 1));
  assert.equal(advanced.frozen, true);
});

test("Galakrond AI can buy a chain immediately after it reaches the normal Tier 6 cap", () => {
  let state = createHeadlessGame(0x6a23);
  state.activeTribes = [...ALL_TRIBES];
  state.pendingInteraction = null;
  const player = state.players[0];
  player.heroId = "hero-tb-02";
  player.heroPowerId = GALAKROND_HERO_POWER_ID;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.gold = 10;
  player.tavernTier = 5;
  player.hand = [];
  player.board = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  const template = player.shop[0];
  assert.ok(template);
  const tierFive = exactTierDefinitions(5)[0];
  assert.ok(tierFive);
  player.shop = [
    minionFromDefinition(
      template,
      tierFive.id,
      "galakrond-ai-terminal-target",
    ),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  seedExactTierPool(state, 6);
  for (let index = 1; index < state.players.length; index += 1) {
    const opponent = state.players[index];
    opponent.shop = [];
    opponent.spellShop = null;
    opponent.additionalSpellShop = [];
    opponent.gold = 0;
    if (index > 1) opponent.alive = false;
  }

  state = advanceHeadlessGame(state);
  const advanced = state.players[0];
  assert.equal(state.pendingInteraction, null);
  assert.ok(advanced.board.some((minion) => minion.tier === 6));
  assert.equal(advanced.shop.some((minion) => minion.tier === 6), false);
  assert.equal(advanced.heroPowerActiveThisTurn, true);
});

test("Elise's discover records the activating Hero Power as its source", () => {
  const heroPowerId = "hero-power-tb_baconshop_hp_047";
  let state = createGame(0xe115e);
  let player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  player.heroPowerId = heroPowerId;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.tavernTier = 3;
  player.gold = 10;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }

  const currentTierMinions = LIVE_MINION_DEFINITIONS.filter(
    (definition) => definition.tier === player.tavernTier,
  ).slice(0, 3);
  assert.equal(currentTierMinions.length, 3);
  for (const definition of currentTierMinions) {
    state.pool[definition.id] = 1;
  }

  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  player = humanPlayer(state);
  const discover = pendingHeroPowerDiscover(state, heroPowerId);
  assert.deepEqual(discover.filter, { exactTier: player.tavernTier });
  assert.equal(discover.options.length, 3);
  assert.equal(player.heroPowerCounters.eliseUses, 1);
  assert.equal(player.gold, 9);
});

test("Millificent discovers only printed Magnetic Mechs", () => {
  const heroPowerId = "hero-power-tb_baconshop_hp_015";
  let state = createGame(0xbad5eed);
  let player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  player.heroPowerId = heroPowerId;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.tavernTier = 4;
  player.gold = 10;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }

  const magneticMechs = LIVE_MINION_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= player.tavernTier &&
      definition.magnetic !== undefined &&
      (definition.tribes ?? [definition.tribe]).includes("mech"),
  ).slice(0, 3);
  const ordinaryMech = LIVE_MINION_DEFINITIONS.find(
    (definition) =>
      definition.tier <= player.tavernTier &&
      definition.magnetic === undefined &&
      (definition.tribes ?? [definition.tribe]).includes("mech"),
  );
  assert.equal(magneticMechs.length, 3);
  assert.ok(ordinaryMech);
  for (const definition of [...magneticMechs, ordinaryMech]) {
    state.pool[definition.id] = 1;
  }

  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  player = humanPlayer(state);
  const discover = pendingHeroPowerDiscover(state, heroPowerId);
  assert.equal(discover.filter.magnetic, true);
  assert.equal(discover.options.length, 3);
  assert.ok(
    discover.options.every(
      (option) =>
        getMinionDefinition(option.definitionId).magnetic !== undefined,
    ),
  );
  assert.ok(
    discover.options.every(
      (option) => option.definitionId !== ordinaryMech.id,
    ),
  );
  assert.equal(player.gold, 9);
});

test("Alexstrasza's discover records the activating Hero Power as its source", () => {
  const heroPowerId = "hero-power-tb_baconshop_hp_064";
  let state = createGame(0xa1e45);
  let player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  player.heroPowerId = heroPowerId;
  player.heroPowerCounters = {};
  player.heroPowerActiveThisTurn = false;
  player.tavernTier = 4;
  player.gold = 10;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }

  const dragons = LIVE_MINION_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= player.tavernTier &&
      (definition.tribes ?? [definition.tribe]).includes("dragon"),
  ).slice(0, 3);
  assert.equal(dragons.length, 3);
  for (const definition of dragons) {
    state.pool[definition.id] = 1;
  }

  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  player = humanPlayer(state);
  const discover = pendingHeroPowerDiscover(state, heroPowerId);
  assert.equal(discover.filter.maximumTier, player.tavernTier);
  assert.equal(discover.filter.tribe, "dragon");
  assert.equal(discover.options.length, 3);
  assert.equal(player.gold, 9);
});
