import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getMinionPurchaseCost,
  getTavernRefreshQuote,
  getTavernSpellPurchaseQuote,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
  type Tribe,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { getTavernSpellDefinition } from "../lib/game/tavern-spells.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function trinketForCard(cardId: string) {
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(trinket, `${cardId} must be active`);
  return trinket;
}

function installTrinket(state: GameState, cardId: string): void {
  const player = humanPlayer(state);
  const trinket = trinketForCard(cardId);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const player = humanPlayer(state);
  const trinket = trinketForCard(cardId);
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `acquire-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `source-${cardId}`,
    trinketTier: trinket.tier,
    optionIds: [trinket.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: trinket.id,
  });
}

function definitionMinion(
  state: GameState,
  definitionId: string,
  instanceId: string,
): BoardMinionInstance {
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
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
    effectCounters: {},
    poolCopies: 0,
    attachments: [],
  };
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function activeTribeDefinition(
  state: GameState,
  tribe: Tribe,
  predicate: (definition: (typeof LIVE_MINION_DEFINITIONS)[number]) => boolean =
    () => true,
) {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return (
      candidate.collectible !== false &&
      candidate.tier <= 6 &&
      (state.pool[candidate.id] ?? 0) > 0 &&
      (tribes.includes("all") || tribes.includes(tribe)) &&
      predicate(candidate)
    );
  });
  assert.ok(definition, `an active ${tribe} definition must exist`);
  return definition;
}

function anyTribeDefinition(
  tribe: Tribe,
  predicate: (definition: (typeof LIVE_MINION_DEFINITIONS)[number]) => boolean =
    () => true,
) {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return (
      candidate.collectible !== false &&
      (tribes.includes("all") || tribes.includes(tribe)) &&
      predicate(candidate)
    );
  });
  assert.ok(definition, `a ${tribe} definition must exist`);
  return definition;
}

function gameWithActiveTribe(tribe: Tribe, firstSeed: number): GameState {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const seed = (firstSeed + attempt * 0x9e37_79b9) >>> 0;
    const state = createGame(seed);
    if (state.activeTribes.includes(tribe)) {
      return state;
    }
  }
  throw new Error(`could not seed an active ${tribe} lobby`);
}

test("batch4 acquisition Trinkets install exact Tavern, economy, and one-shot rewards", () => {
  let fanState = createGame(9401);
  const fanBefore = new Map(
    humanPlayer(fanState).shop.map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  fanState = acquireTrinket(fanState, "BG30_MagicItem_841");
  const fanPlayer = humanPlayer(fanState);
  assert.equal(
    fanPlayer.shop.length +
      (fanPlayer.spellShop ? 1 : 0) +
      fanPlayer.additionalSpellShop.length,
    7,
  );
  for (const [instanceId, stats] of fanBefore) {
    const minion = fanPlayer.shop.find(
      (candidate) => candidate.instanceId === instanceId,
    );
    assert.ok(minion);
    assert.equal(minion.attack, stats.attack + 3);
    assert.equal(minion.health, stats.health + 3);
  }

  let walletState = createGame(9402);
  const wallet = trinketForCard("BG30_MagicItem_998");
  walletState = acquireTrinket(walletState, wallet.cardId);
  assert.equal(humanPlayer(walletState).gold, 102 - wallet.cost);

  let thresholdState = createGame(9403);
  humanPlayer(thresholdState).hand = [];
  thresholdState = acquireTrinket(
    thresholdState,
    "BG32_MagicItem_350",
  );
  const thresholdReward = humanPlayer(thresholdState).hand[0];
  assert.ok(thresholdReward?.kind === "minion");
  assert.equal(thresholdReward.tier, 5);
  assert.equal(thresholdReward.golden, true);

  for (const [cardId, expectedBonus] of [
    ["BG30_MagicItem_541", 2],
    ["BG30_MagicItem_879t", 2],
  ] as const) {
    let state = createGame(cardId.length * 211);
    state = acquireTrinket(state, cardId);
    assert.equal(humanPlayer(state).tavernMinionAttackBonus, expectedBonus);
    assert.equal(humanPlayer(state).tavernMinionHealthBonus, expectedBonus);
  }

  let goldenPurchaseState = createGame(9404);
  goldenPurchaseState = acquireTrinket(
    goldenPurchaseState,
    "BG32_MagicItem_901",
  );
  assert.equal(humanPlayer(goldenPurchaseState).freeRefreshes, 5);
  assert.equal(
    humanPlayer(goldenPurchaseState).trinketCounters[
      trinketForCard("BG32_MagicItem_901").id
    ],
    1,
  );
});

test("batch4 refresh Trinkets add higher-Tier, typed, and Magnetic offers and remove low Tiers", () => {
  let ticketState = createGame(9410);
  installTrinket(ticketState, "BG30_MagicItem_423");
  const ticketPlayer = humanPlayer(ticketState);
  ticketPlayer.tavernTier = 2;
  ticketPlayer.gold = 20;
  ticketState = gameReducer(ticketState, { type: "REFRESH_SHOP" });
  assert.ok(humanPlayer(ticketState).shop.some((minion) => minion.tier === 3));
  assert.equal(humanPlayer(ticketState).shop.length, 5);

  let typedState = createGame(9411);
  const typedPlayer = humanPlayer(typedState);
  const typedTribe = typedState.activeTribes[0];
  assert.ok(typedTribe);
  const typedDefinition = activeTribeDefinition(typedState, typedTribe);
  typedPlayer.board = [
    definitionMinion(typedState, typedDefinition.id, "typed-warband"),
  ];
  typedPlayer.tavernTier = 6;
  typedPlayer.gold = 20;
  installTrinket(typedState, "BG30_MagicItem_973");
  typedState = gameReducer(typedState, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(typedState).shop.length, 8);

  let magneticState = gameWithActiveTribe("mech", 9412);
  const magneticPlayer = humanPlayer(magneticState);
  magneticPlayer.tavernTier = 6;
  magneticPlayer.gold = 20;
  installTrinket(magneticState, "BG35_MagicItem_743");
  magneticState = gameReducer(magneticState, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(magneticState).shop.length, 7);
  assert.ok(
    humanPlayer(magneticState).shop.some(
      (minion) => getMinionDefinition(minion.definitionId).magnetic,
    ),
  );

  let walletState = createGame(9413);
  const walletPlayer = humanPlayer(walletState);
  walletPlayer.tavernTier = 4;
  walletPlayer.gold = 20;
  installTrinket(walletState, "BG30_MagicItem_998");
  walletState = gameReducer(walletState, { type: "REFRESH_SHOP" });
  assert.ok(humanPlayer(walletState).shop.length > 0);
  assert.ok(
    humanPlayer(walletState).shop.every((minion) => minion.tier >= 3),
  );
});

test("batch4 growing Tavern Trinkets advance on damage, spells, and manual Refreshes", () => {
  let pendantState = createGame(9420);
  pendantState = acquireTrinket(pendantState, "BG30_MagicItem_541");
  const pendantPlayer = humanPlayer(pendantState);
  pendantPlayer.board = [
    definitionMinion(pendantState, "BG26_524", "malchezaar-a"),
    definitionMinion(pendantState, "BG26_524", "malchezaar-b"),
  ];
  pendantPlayer.health = 50;
  const pendantBonus = pendantPlayer.tavernMinionAttackBonus;
  for (let refresh = 0; refresh < 3; refresh += 1) {
    pendantState = gameReducer(pendantState, { type: "REFRESH_SHOP" });
  }
  assert.equal(
    humanPlayer(pendantState).tavernMinionAttackBonus,
    pendantBonus + 1,
  );

  let wheelState = createGame(9421);
  wheelState = acquireTrinket(wheelState, "BG30_MagicItem_879t");
  humanPlayer(wheelState).gold = 20;
  const wheelBonus = humanPlayer(wheelState).tavernMinionAttackBonus;
  for (let refresh = 0; refresh < 4; refresh += 1) {
    wheelState = gameReducer(wheelState, { type: "REFRESH_SHOP" });
  }
  assert.equal(
    humanPlayer(wheelState).tavernMinionAttackBonus,
    wheelBonus + 1,
  );

  let panpipesState = createGame(9422);
  installTrinket(panpipesState, "BG32_MagicItem_922");
  const panpipesPlayer = humanPlayer(panpipesState);
  const target = definitionMinion(
    panpipesState,
    panpipesPlayer.shop[0]!.definitionId,
    "panpipes-target",
  );
  panpipesPlayer.board = [target];
  const spell = tavernSpell(
    "tavern-spell-tavern-coin",
    "panpipes-spell",
  );
  panpipesPlayer.hand = [spell];
  panpipesState = gameReducer(panpipesState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
  });
  panpipesState = gameReducer(panpipesState, { type: "END_TURN" });
  assert.equal(humanPlayer(panpipesState).board[0]?.attack, target.attack + 4);
  assert.equal(humanPlayer(panpipesState).board[0]?.health, target.health + 4);
});

test("batch4 purchase Trinkets discount, forge two Pirates, and Golden the next matching minion", () => {
  let pirateState = createGame(9430);
  installTrinket(pirateState, "BG30_MagicItem_439");
  const piratePlayer = humanPlayer(pirateState);
  const pirateDefinition = anyTribeDefinition("pirate");
  piratePlayer.hand = [
    definitionMinion(pirateState, pirateDefinition.id, "pirate-hand"),
  ];
  piratePlayer.shop = [
    definitionMinion(pirateState, pirateDefinition.id, "pirate-shop"),
  ];
  piratePlayer.gold = 3;
  pirateState = gameReducer(pirateState, {
    type: "BUY_MINION",
    shopIndex: 0,
  });
  assert.ok(
    humanPlayer(pirateState).hand.some(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === pirateDefinition.id &&
        card.golden,
    ),
  );

  let magneticState = createGame(9431);
  installTrinket(magneticState, "BG35_MagicItem_743");
  const magneticPlayer = humanPlayer(magneticState);
  const magneticDefinition = anyTribeDefinition(
    "mech",
    (definition) => definition.magnetic !== undefined,
  );
  magneticPlayer.shop = [
    definitionMinion(
      magneticState,
      magneticDefinition.id,
      "magnetic-offer",
    ),
  ];
  magneticPlayer.hand = [];
  magneticPlayer.gold = 2;
  assert.equal(getMinionPurchaseCost(magneticState, magneticPlayer.id, 0), 2);
  magneticState = gameReducer(magneticState, {
    type: "BUY_MINION",
    shopIndex: 0,
  });
  assert.equal(humanPlayer(magneticState).gold, 0);
  assert.equal(humanPlayer(magneticState).hand.length, 1);

  let goldenState = createGame(9432);
  goldenState = acquireTrinket(goldenState, "BG32_MagicItem_901");
  const goldenPlayer = humanPlayer(goldenState);
  const matchingTribe = goldenState.activeTribes[0];
  assert.ok(matchingTribe);
  const beastDefinition = activeTribeDefinition(
    goldenState,
    matchingTribe,
  );
  goldenPlayer.board = [
    definitionMinion(goldenState, beastDefinition.id, "beast-warband"),
  ];
  goldenPlayer.shop = [
    definitionMinion(goldenState, beastDefinition.id, "beast-offer"),
  ];
  goldenPlayer.hand = [];
  goldenPlayer.gold = 3;
  goldenState = gameReducer(goldenState, {
    type: "BUY_MINION",
    shopIndex: 0,
  });
  const goldenBought = humanPlayer(goldenState).hand[0];
  assert.ok(goldenBought?.kind === "minion");
  assert.equal(goldenBought.golden, true);
  assert.equal(
    humanPlayer(goldenState).trinketCounters[
      trinketForCard("BG32_MagicItem_901").id
    ],
    0,
  );

  const spellState = createGame(9433);
  installTrinket(spellState, "BG35_MagicItem_921");
  const spellPlayer = humanPlayer(spellState);
  const statSpell = tavernSpell(
    "tavern-spell-might-of-stormwind",
    "discounted-stat-spell",
  );
  spellPlayer.spellShop = statSpell;
  spellPlayer.additionalSpellShop = [];
  spellPlayer.hand = [];
  spellPlayer.gold = 0;
  assert.deepEqual(
    getTavernSpellPurchaseQuote(spellState, spellPlayer.id),
    { currency: "gold", cost: 0, affordable: true },
  );
});

test("BG35_MagicItem_930 queues one free Warband-copy Refresh", () => {
  let state = createGame(9440);
  const player = humanPlayer(state);
  const source = definitionMinion(
    state,
    player.shop[0]!.definitionId,
    "copy-refresh-source",
  );
  player.board = [source];
  state = acquireTrinket(state, "BG35_MagicItem_930");
  const acquired = humanPlayer(state);
  const goldBefore = acquired.gold;
  assert.equal(getTavernRefreshQuote(state, acquired.id)?.cost, 0);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const refreshed = humanPlayer(state);
  assert.equal(refreshed.gold, goldBefore);
  assert.equal(refreshed.lastHelpfulRefreshKind, "warbandCopies");
  assert.ok(
    refreshed.shop.some(
      (minion) => minion.definitionId === source.definitionId,
    ),
  );
  assert.equal(
    refreshed.trinketCounters[trinketForCard("BG35_MagicItem_930").id],
    0,
  );
});
