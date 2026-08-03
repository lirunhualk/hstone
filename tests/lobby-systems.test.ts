import assert from "node:assert/strict";
import test from "node:test";

import {
  GREATER_TRINKET_ROUND,
  HERO_DEFINITIONS,
  LESSER_TRINKET_ROUND,
  SYSTEM_EVENT_DEFINITIONS,
  createGame,
  createLobbyGame,
  gameReducer,
  getHeroDefinition,
  getMinionPurchaseCost,
  getRefreshCost,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  getTavernSpellPurchaseQuote,
  getTrinketDefinition,
  getUpgradeCost,
  heroesAvailableForTribes,
  minionHasTribe,
  type GameState,
  type BoardMinionInstance,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
  type TrinketTier,
  type Tribe,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function lobbyGameForEvent(
  eventId: string,
  initialHealth = 999,
): GameState {
  for (let seed = 1; seed <= 256; seed += 1) {
    const state = createLobbyGame(seed, initialHealth);
    if (state.systemEventId === eventId) {
      return state;
    }
  }
  throw new Error(`Unable to find deterministic seed for ${eventId}`);
}

function lobbyGameOfferingHero(
  heroId: string,
  initialHealth = 999,
): GameState {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = createLobbyGame(seed, initialHealth);
    state.systemEventId = null;
    for (const player of state.players) {
      player.tavernTier = 1;
      player.gold = Math.min(player.maxGold, state.round + 2);
      player.systemEventCounters = {};
    }
    const pending = state.pendingInteraction;
    if (
      pending?.kind === "heroChoice" &&
      pending.optionIds.includes(heroId)
    ) {
      return state;
    }
  }
  throw new Error(`Unable to find deterministic seed offering ${heroId}`);
}

function chooseHero(state: GameState, requestedHeroId?: string): GameState {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "heroChoice");
  const heroId = requestedHeroId ?? pending.optionIds[0];
  assert.ok(heroId, "the lobby must offer at least one hero");
  assert.ok(pending.optionIds.includes(heroId));
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: heroId,
  });
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function assertTrinketOffer(
  state: GameState,
  tier: TrinketTier,
): Extract<
  NonNullable<GameState["pendingInteraction"]>,
  { kind: "trinketChoice" }
> {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "trinketChoice");
  assert.equal(pending.trinketTier, tier);
  assert.equal(pending.optionIds.length, 4);
  assert.equal(new Set(pending.optionIds).size, 4);
  assert.ok(
    pending.optionIds.every(
      (definitionId) => getTrinketDefinition(definitionId).tier === tier,
    ),
  );
  return pending;
}

function resolveTrinketOfferWithoutFollowup(
  state: GameState,
  offer: Extract<
    NonNullable<GameState["pendingInteraction"]>,
    { kind: "trinketChoice" }
  >,
  beforeRound?: number,
): { state: GameState; selectedId: string } {
  for (const selectedId of offer.optionIds) {
    const resolved = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: offer.interactionId,
      optionInstanceId: selectedId,
    });
    let probe = resolved;
    let hasEarlyFollowup = probe.pendingInteraction !== null;
    while (
      !hasEarlyFollowup &&
      beforeRound !== undefined &&
      probe.round < beforeRound
    ) {
      const combat = gameReducer(probe, { type: "END_TURN" });
      hasEarlyFollowup = combat.phase !== "combat";
      if (hasEarlyFollowup) {
        break;
      }
      probe = gameReducer(combat, { type: "CONTINUE" });
      hasEarlyFollowup =
        probe.round < beforeRound && probe.pendingInteraction !== null;
    }
    if (!hasEarlyFollowup) {
      return { state: resolved, selectedId };
    }
  }
  throw new Error(
    "The deterministic offer needs one Trinket without an early follow-up interaction",
  );
}

function findSystemSpell(
  player: PlayerState,
  definitionId: string,
): TavernSpellInstance {
  const spell = player.hand.find(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell" && card.definitionId === definitionId,
  );
  assert.ok(spell, `${definitionId} must be in hand`);
  return spell;
}

function assertSystemSpellDidNotCountAsTavernSpell(
  before: PlayerState,
  after: PlayerState,
): void {
  assert.equal(
    after.tavernSpellsCastThisTurn,
    before.tavernSpellsCastThisTurn,
  );
  assert.equal(after.tavernSpellsCast, before.tavernSpellsCast);
  assert.equal(
    after.lastTavernSpellDefinitionId,
    before.lastTavernSpellDefinitionId,
  );
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    instanceId,
    definitionId,
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
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    poolCopies: 0,
    ...overrides,
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

function safeLiveMinionIds(
  count: number,
  tribe?: Tribe,
): string[] {
  const ids = LIVE_MINION_DEFINITIONS.filter((definition) => {
    const tribes =
      definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe]);
    return (
      (tribe === undefined ||
        tribes.includes(tribe) ||
        tribes.includes("all")) &&
      definition.battlecry === undefined &&
      definition.interactiveBattlecry === undefined &&
      definition.onPlayChoice === undefined &&
      definition.magnetic === undefined
    );
  })
    .slice(0, count)
    .map((definition) => definition.id);
  assert.equal(ids.length, count, `need ${count} safe live minions`);
  return ids;
}

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[],
): PlayerState {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 999;
      player.hand = [];
      player.board = opponentBoard;
    } else if (!player.isHuman) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
    }
  }
  return opponent;
}

function spellcraft(
  definitionId: string,
  instanceId: string,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: "spellcraft",
    target: definition.target,
  };
}

test("createGame remains legacy-neutral", () => {
  const state = createGame(101);

  assert.equal(state.lobbySystemsEnabled, false);
  assert.equal(state.systemEventId, null);
  assert.equal(state.pendingInteraction, null);
  assert.ok(
    state.players.every(
      (player) =>
        player.heroId === null &&
        player.heroPowerId === null &&
        player.trinketIds.length === 0 &&
        player.pendingSystemSpellIds.length === 0,
    ),
  );
  assert.equal("system-spell-goldenizer" in state.spellPool, false);
  assert.equal("system-spell-golden-arrow" in state.spellPool, false);
});

test("the 16-Hero pool deals a stable four-Hero offer and seven unique AI Heroes", () => {
  assert.equal(HERO_DEFINITIONS.length, 16);
  const first = createLobbyGame(24680);
  const second = createLobbyGame(24680);
  const firstChoice = first.pendingInteraction;
  const secondChoice = second.pendingInteraction;

  assert.equal(first.lobbySystemsEnabled, true);
  assert.ok(firstChoice?.kind === "heroChoice");
  assert.ok(secondChoice?.kind === "heroChoice");
  assert.equal(firstChoice.optionIds.length, 4);
  assert.equal(new Set(firstChoice.optionIds).size, 4);
  assert.ok(
    firstChoice.optionIds.every((heroId) =>
      HERO_DEFINITIONS.some((definition) => definition.id === heroId),
    ),
  );
  assert.ok(
    SYSTEM_EVENT_DEFINITIONS.some(
      (definition) => definition.id === first.systemEventId,
    ),
  );
  assert.equal(second.systemEventId, first.systemEventId);
  assert.deepEqual(secondChoice.optionIds, firstChoice.optionIds);

  const firstAiHeroIds = first.players
    .filter((player) => !player.isHuman)
    .map((player) => player.heroId);
  const secondAiHeroIds = second.players
    .filter((player) => !player.isHuman)
    .map((player) => player.heroId);
  assert.ok(firstAiHeroIds.every((heroId) => heroId !== null));
  assert.deepEqual(secondAiHeroIds, firstAiHeroIds);
  assert.equal(firstAiHeroIds.length, 7);
  assert.equal(new Set(firstAiHeroIds).size, 7);
  assert.equal(
    new Set([...firstChoice.optionIds, ...firstAiHeroIds]).size,
    11,
  );

  const offerOrders = new Set<string>();
  for (let seed = 1; seed <= 16; seed += 1) {
    const pending = createLobbyGame(seed).pendingInteraction;
    assert.ok(pending?.kind === "heroChoice");
    offerOrders.add(pending.optionIds.join(","));
  }
  assert.ok(offerOrders.size > 1, "different seeds should vary the offer order");
});

test("tribe-bound Heroes are filtered from both offers and AI assignments", () => {
  const mechOnly = heroesAvailableForTribes(["mech"]);
  const mechOnlyIds = new Set(mechOnly.map((hero) => hero.id));
  assert.equal(mechOnlyIds.has("hero-greybough"), false);
  assert.equal(mechOnlyIds.has("hero-ysera"), false);
  assert.equal(mechOnlyIds.has("hero-chenvaala"), false);
  assert.equal(mechOnlyIds.has("hero-capn-hoggarr"), false);

  const beastOnlyIds = new Set(
    heroesAvailableForTribes(["beast"]).map((hero) => hero.id),
  );
  assert.equal(beastOnlyIds.has("hero-greybough"), true);
  assert.equal(beastOnlyIds.has("hero-ysera"), false);

  for (let seed = 1; seed <= 32; seed += 1) {
    const state = createLobbyGame(seed);
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "heroChoice");
    const dealtHeroIds = [
      ...pending.optionIds,
      ...state.players
        .filter((player) => !player.isHuman)
        .map((player) => player.heroId),
    ];
    for (const heroId of dealtHeroIds) {
      assert.ok(heroId);
      const hero = getHeroDefinition(heroId);
      assert.ok(
        !hero.associatedTribes?.length ||
          hero.associatedTribes.some((tribe) =>
            state.activeTribes.includes(tribe),
          ),
        `${hero.id} must match an active tribe`,
      );
    }
  }
});

test("resolving the hero offer binds the selected hero and hero power", () => {
  const offered = createLobbyGame(31415);
  const pending = offered.pendingInteraction;
  assert.ok(pending?.kind === "heroChoice");
  const selectedHeroId = pending.optionIds[2];
  assert.ok(selectedHeroId);
  const selectedHero = getHeroDefinition(selectedHeroId);

  const state = chooseHero(offered, selectedHeroId);
  const player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(player.heroId, selectedHero.id);
  assert.equal(player.heroPowerId, selectedHero.heroPowerId);
});

test("Nozdormu grants one non-stacking free Refresh from the first turn", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-nozdormu"),
    "hero-nozdormu",
  );
  let player = humanPlayer(state);
  assert.equal(player.heroRefreshAvailable, true);
  assert.equal(getRefreshCost(state, player.id), 0);

  const goldBefore = player.gold;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBefore);
  assert.equal(player.heroRefreshAvailable, false);
  assert.equal(getRefreshCost(state, player.id), 1);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(state.round, 2);
  assert.equal(player.heroRefreshAvailable, true);
  assert.equal(player.freeRefreshes, 0);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(state.round, 3);
  assert.equal(player.heroRefreshAvailable, true);
  assert.equal(player.freeRefreshes, 0);

  state.pendingInteraction = {
    kind: "heroPowerChoice",
    interactionId: "replace-nozdormu-power",
    playerId: player.id,
    sourceInstanceId: "test-unmasked-identity",
    definitionId: "tavern-spell-unmasked-identity",
    optionIds: ["hero-power-experienced-bartender"],
  };
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "replace-nozdormu-power",
    optionInstanceId: "hero-power-experienced-bartender",
  });
  player = humanPlayer(state);
  assert.equal(player.heroRefreshAvailable, false);
  assert.equal(getRefreshCost(state, player.id), 1);
});

test("Patchwerk adds 30 starting Health exactly once", () => {
  const offered = lobbyGameOfferingHero("hero-patchwerk");
  const pending = offered.pendingInteraction;
  assert.ok(pending?.kind === "heroChoice");
  const resolveAction = {
    type: "RESOLVE_INTERACTION" as const,
    interactionId: pending.interactionId,
    optionInstanceId: "hero-patchwerk",
  };

  let state = gameReducer(offered, resolveAction);
  assert.equal(humanPlayer(state).health, 1029);

  state = gameReducer(state, resolveAction);
  assert.equal(humanPlayer(state).health, 1029);
});

test("Gallywix banks one next-turn Gold for each sold minion", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-trade-prince-gallywix"),
    "hero-trade-prince-gallywix",
  );
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "scallywag", "gallywix-sale"),
  ];
  player.gold = 0;
  player.pendingNextTurnGold = 0;

  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 1);
  assert.equal(player.pendingNextTurnGold, 1);
  assert.equal(player.heroPowerCounters.smartSavingsGold, 1);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.gold, 5);
  assert.equal(player.pendingNextTurnGold, 0);
  assert.equal(player.heroPowerCounters.smartSavingsGold, 0);
});

test("Millhouse pays two for minions and Refresh but one more to upgrade", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-millhouse-manastorm"),
    "hero-millhouse-manastorm",
  );
  let player = humanPlayer(state);
  player.gold = 10;
  player.hand = [];
  assert.ok(player.shop[0]);
  assert.equal(getMinionPurchaseCost(state, player.id), 2);
  assert.equal(getRefreshCost(state, player.id), 2);
  assert.equal(getUpgradeCost(state, player.id), 6);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 8);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).gold, 6);
});

test("Sindragosa has a smaller Tavern, two-Gold minions, and freezes at end of turn", () => {
  const offered = lobbyGameOfferingHero("hero-sindragosa");
  const initialPlayer = humanPlayer(offered);
  assert.equal(initialPlayer.shop.length, 3);
  const releasedMinion = initialPlayer.shop.at(-1);
  assert.ok(releasedMinion);
  const poolCopiesBefore = offered.pool[releasedMinion.definitionId] ?? 0;

  let state = chooseHero(offered, "hero-sindragosa");
  let player = humanPlayer(state);
  assert.equal(player.shop.length, 2);
  assert.equal(
    player.shop.some(
      (minion) => minion.instanceId === releasedMinion.instanceId,
    ),
    false,
  );
  assert.equal(
    state.pool[releasedMinion.definitionId],
    poolCopiesBefore + releasedMinion.poolCopies,
  );
  player.gold = 10;
  player.hand = [];

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 2);
  assert.equal(getMinionPurchaseCost(state, player.id), 2);
  assert.ok(player.shop[0]);
  const goldBeforePurchase = player.gold;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBeforePurchase - 2);
  assert.equal(player.frozen, false);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  assert.equal(humanPlayer(state).frozen, true);
});

test("Ysera adds a Dragon on hero selection and after every Refresh", () => {
  const offered = lobbyGameOfferingHero("hero-ysera");
  const initialShopSize = humanPlayer(offered).shop.length;
  let state = chooseHero(offered, "hero-ysera");
  let player = humanPlayer(state);
  assert.equal(player.shop.length, initialShopSize + 1);
  assert.ok(player.shop.some((minion) => minionHasTribe(minion, "dragon")));

  player.gold = 10;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 4);
  assert.ok(player.shop.some((minion) => minionHasTribe(minion, "dragon")));
});

test("Chenvaala discounts the Tavern after every three Elementals played", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-chenvaala"),
    "hero-chenvaala",
  );
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const elementalIds = safeLiveMinionIds(3, "elemental");
  player.board = [];
  player.hand = elementalIds.map((definitionId, index) =>
    definitionMinion(
      template,
      definitionId,
      `chenvaala-elemental-${index}`,
    ),
  );
  assert.equal(getUpgradeCost(state, player.id), 5);

  for (let index = 0; index < 3; index += 1) {
    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `chenvaala-elemental-${index}`,
    });
  }
  player = humanPlayer(state);
  assert.equal(player.upgradeDiscount, 3);
  assert.equal(player.heroPowerCounters.chenvaalaElementals, 0);
  assert.equal(getUpgradeCost(state, player.id), 2);
});

test("Hoggarr refunds one Gold after buying a Pirate", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-capn-hoggarr"),
    "hero-capn-hoggarr",
  );
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.shop = [
    definitionMinion(template, "scallywag", "hoggarr-pirate"),
  ];
  player.hand = [];
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 8);
  assert.equal(player.hand[0]?.instanceId, "hoggarr-pirate");
});

test("Kael'thas grants a Tavern Coin after buying three minions", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-kaelthas-sunstrider"),
    "hero-kaelthas-sunstrider",
  );
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const minionIds = safeLiveMinionIds(3);
  player.shop = minionIds.map((definitionId, index) =>
    definitionMinion(template, definitionId, `kaelthas-buy-${index}`),
  );
  player.hand = [];
  player.gold = 20;

  for (let purchase = 0; purchase < 3; purchase += 1) {
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  }
  player = humanPlayer(state);
  assert.equal(player.heroPowerCounters.kaelthasMinions, 0);
  assert.equal(
    player.hand.filter(
      (card) =>
        card.kind === "tavernSpell" &&
        card.definitionId === "tavern-spell-tavern-coin",
    ).length,
    1,
  );
});

test("Tae'thelan makes every fourth purchased Tavern Spell free", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-taethelan-bloodwatcher"),
    "hero-taethelan-bloodwatcher",
  );
  let player = humanPlayer(state);
  player.hand = [];
  player.gold = 10;
  player.freeTavernSpellPurchases = 0;
  player.nextTavernSpellDiscount = 0;

  const quotedCosts: number[] = [];
  for (let purchase = 1; purchase <= 4; purchase += 1) {
    player = humanPlayer(state);
    const spell = tavernSpell(
      "tavern-spell-tavern-dish-banana",
      `taethelan-spell-${purchase}`,
    );
    player.spellShop = spell;
    player.additionalSpellShop = [];
    const quote = getTavernSpellPurchaseQuote(
      state,
      player.id,
      spell.instanceId,
    );
    assert.ok(quote);
    quotedCosts.push(quote.cost);
    state = gameReducer(state, {
      type: "BUY_TAVERN_SPELL",
      spellInstanceId: spell.instanceId,
    });
  }
  player = humanPlayer(state);
  assert.deepEqual(quotedCosts, [1, 1, 1, 0]);
  assert.equal(player.gold, 7);
  assert.equal(player.heroPowerCounters.taethelanSpells, 0);
});

test("Rakanishu improves on turn four and adds its bonus to Tavern Spell buffs", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-rakanishu"),
    "hero-rakanishu",
  );
  assert.equal(humanPlayer(state).heroPowerCounters.rakanishuBonus, 1);

  while (state.round < 4) {
    state = continueThroughCombat(state);
  }
  let player = humanPlayer(state);
  assert.equal(player.heroPowerCounters.rakanishuBonus, 2);
  assert.equal(player.heroPowerCounters.rakanishuTurns, 8);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "scallywag", "rakanishu-target", {
      attack: 5,
      health: 7,
    }),
  ];
  player.hand = [
    tavernSpell(
      "tavern-spell-tavern-dish-banana",
      "rakanishu-banana",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "rakanishu-banana",
    targetInstanceId: "rakanishu-target",
  });
  player = humanPlayer(state);
  const target = player.board.find(
    (minion) => minion.instanceId === "rakanishu-target",
  );
  assert.ok(target);
  assert.equal(target.attack, 9);
  assert.equal(target.health, 11);
});

test("Deathwing permanently completes a four-Attack Crimson Survivor while buffing both boards", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-deathwing"),
    "hero-deathwing",
  );
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG35_814", "deathwing-survivor", {
      attack: 4,
      health: 100,
      divineShield: false,
      effectCounters: {},
    }),
  ];
  const opponent = keepOnlyOneOpponent(state, [
    definitionMinion(template, "harvest-golem", "deathwing-enemy", {
      attack: 3,
      health: 100,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  player = humanPlayer(state);
  const persistentOpponent = state.players.find(
    (candidate) => candidate.id === opponent.id,
  );
  assert.ok(persistentOpponent);
  assert.equal(player.board[0]?.attack, 6);
  assert.equal(player.board[0]?.divineShield, true);
  assert.match(player.board[0]?.description ?? "", /已完成/u);
  assert.equal(persistentOpponent.board[0]?.attack, 5);
  const survivorBuff = state.lastRoundBattles
    .flatMap((battle) => battle.events)
    .find(
      (event) =>
        event.type === "buff" &&
        event.actorPlayerId === player.id &&
        event.targetInstanceId === "deathwing-survivor" &&
        event.attackDelta === 2,
    );
  assert.ok(survivorBuff?.minion);
  assert.equal(survivorBuff.minion.attack, 6);
  assert.equal(survivorBuff.minion.divineShield, true);
  assert.equal(survivorBuff.retained, true);
  const retainedBuffs = state.lastRoundBattles
    .flatMap((battle) => battle.events)
    .filter(
      (event) =>
        event.type === "buff" &&
        event.actorPlayerId === player.id &&
        event.attackDelta === 2 &&
        event.retained === true,
    );
  assert.equal(retainedBuffs.length, 2);
});

test("Al'Akir temporarily grants its leftmost minion Windfury, Divine Shield, and Taunt", () => {
  let state = chooseHero(
    lobbyGameOfferingHero("hero-alakir"),
    "hero-alakir",
  );
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "scallywag", "alakir-left", {
      attack: 1,
      health: 100,
      windfury: false,
      divineShield: false,
      taunt: false,
    }),
    definitionMinion(template, "harvest-golem", "alakir-right", {
      attack: 1,
      health: 100,
      windfury: false,
      divineShield: false,
      taunt: false,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion(template, "harvest-golem", "alakir-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  const keywordEvent = state.lastRoundBattles
    .flatMap((battle) => battle.events)
    .find(
      (event) =>
        event.type === "buff" &&
        event.actorPlayerId === player.id &&
        event.targetInstanceId === "alakir-left" &&
        event.minion?.windfury === true &&
        event.minion.divineShield === true &&
        event.minion.taunt === true,
    );
  assert.ok(keywordEvent);
  player = humanPlayer(state);
  assert.equal(player.board[0]?.windfury, false);
  assert.equal(player.board[0]?.divineShield, false);
  assert.equal(player.board[0]?.taunt, false);
  assert.equal(player.board[1]?.windfury, false);
  assert.equal(player.board[1]?.divineShield, false);
  assert.equal(player.board[1]?.taunt, false);
});

test("Money Match starts everyone at 10 Gold", () => {
  const state = lobbyGameForEvent("system-event-money-match");

  assert.equal(state.systemEventId, "system-event-money-match");
  assert.ok(state.players.every((player) => player.gold === 10));
});

test("Perfected Alchemy Goldenizer makes a friendly minion Golden without counting as a Tavern Spell", () => {
  let state = chooseHero(
    lobbyGameForEvent("system-event-perfected-alchemy"),
  );
  let player = humanPlayer(state);
  const spellPoolBefore = structuredClone(state.spellPool);
  const goldenizer = findSystemSpell(player, "system-spell-goldenizer");
  const shopIndex = player.shop.findIndex((minion) => {
    const definition = getMinionDefinition(minion.definitionId);
    return (
      definition.interactiveBattlecry === undefined &&
      definition.onPlayChoice === undefined &&
      !definition.battlecry?.some((effect) => effect.kind === "makeSelfGolden")
    );
  });
  assert.notEqual(shopIndex, -1, "the deterministic shop needs a safe target");
  const targetInstanceId = player.shop[shopIndex].instanceId;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex });
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: targetInstanceId,
  });
  player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  const targetBefore = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  assert.ok(targetBefore);
  assert.equal(targetBefore.golden, false);
  const countersBefore = structuredClone(player);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: goldenizer.instanceId,
    targetInstanceId,
  });
  player = humanPlayer(state);
  assert.equal(
    player.board.find((minion) => minion.instanceId === targetInstanceId)
      ?.golden,
    true,
  );
  assertSystemSpellDidNotCountAsTavernSpell(countersBefore, player);
  assert.deepEqual(state.spellPool, spellPoolBefore);
  assert.equal("system-spell-goldenizer" in state.spellPool, false);
});

test("Golden Arrow arrives every third turn and gilds a shop minion without touching Tavern Spell accounting", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-golden-arrow"));
  state = continueThroughCombat(state);
  assert.equal(state.round, 2);
  assert.equal(
    humanPlayer(state).hand.some(
      (card) =>
        card.kind === "tavernSpell" &&
        card.definitionId === "system-spell-golden-arrow",
    ),
    false,
  );

  state = continueThroughCombat(state);
  assert.equal(state.round, 3);
  let player = humanPlayer(state);
  const goldenArrow = findSystemSpell(player, "system-spell-golden-arrow");
  const targetInstanceId = player.shop[0]?.instanceId;
  assert.ok(targetInstanceId, "round 3 shop must contain a target");
  const spellPoolBefore = structuredClone(state.spellPool);
  const countersBefore = structuredClone(player);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: goldenArrow.instanceId,
    targetInstanceId,
  });
  player = humanPlayer(state);
  assert.equal(
    player.shop.find((minion) => minion.instanceId === targetInstanceId)
      ?.golden,
    true,
  );
  assertSystemSpellDidNotCountAsTavernSpell(countersBefore, player);
  assert.deepEqual(state.spellPool, spellPoolBefore);
  assert.equal("system-spell-golden-arrow" in state.spellPool, false);
});

test("turns 6 and 9 pause Recruit for Lesser and Greater Trinket choices", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-money-match"));

  while (state.round < LESSER_TRINKET_ROUND) {
    state = continueThroughCombat(state);
  }
  assert.equal(state.round, 6);
  const lesserOffer = assertTrinketOffer(state, "lesser");
  assert.equal(lesserOffer.optionIds.length, 4);
  assert.equal(new Set(lesserOffer.optionIds).size, 4);
  const lesserResolution = resolveTrinketOfferWithoutFollowup(
    state,
    lesserOffer,
    GREATER_TRINKET_ROUND,
  );
  state = lesserResolution.state;
  const lesserId = lesserResolution.selectedId;
  assert.equal(state.pendingInteraction, null);
  assert.ok(humanPlayer(state).trinketIds.includes(lesserId));

  while (state.round < GREATER_TRINKET_ROUND) {
    state = continueThroughCombat(state);
  }
  assert.equal(state.round, 9);
  const greaterOffer = assertTrinketOffer(state, "greater");
  assert.equal(greaterOffer.optionIds.length, 4);
  assert.equal(new Set(greaterOffer.optionIds).size, 4);
  const greaterResolution = resolveTrinketOfferWithoutFollowup(
    state,
    greaterOffer,
  );
  state = greaterResolution.state;
  const greaterId = greaterResolution.selectedId;
  assert.equal(state.pendingInteraction, null);
  assert.deepEqual(humanPlayer(state).trinketIds, [lesserId, greaterId]);
});

test("Calming Candle also makes a Health-priced Tavern Spell free", () => {
  let state = createGame(8080);
  let player = humanPlayer(state);
  const definition = getTavernSpellDefinition(
    "tavern-spell-hasty-excavation",
  );
  player.freeTavernSpellPurchases = 3;
  player.spellShop = {
    kind: "tavernSpell",
    instanceId: "health-priced-spell",
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };

  const quote = getTavernSpellPurchaseQuote(
    state,
    player.id,
    player.spellShop.instanceId,
  );
  assert.deepEqual(quote, {
    currency: "health",
    cost: 0,
    affordable: true,
  });

  const healthBefore = player.health;
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: player.spellShop.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.health, healthBefore);
  assert.equal(player.freeTavernSpellPurchases, 2);
  assert.equal(player.spellShop, null);
  assert.ok(
    player.hand.some(
      (card) =>
        card.kind === "tavernSpell" && card.definitionId === definition.id,
    ),
  );
});

test("Calming Candle consumes a pending Gold Tavern Spell discount", () => {
  let state = createGame(8081);
  let player = humanPlayer(state);
  const definition = getTavernSpellDefinition(
    "tavern-spell-azerite-empowerment",
  );
  player.gold = 0;
  player.freeTavernSpellPurchases = 1;
  player.nextTavernSpellDiscount = 2;
  player.spellShop = {
    kind: "tavernSpell",
    instanceId: "free-discounted-gold-spell",
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };

  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: player.spellShop.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.freeTavernSpellPurchases, 0);
  assert.equal(player.nextTavernSpellDiscount, 0);
  assert.equal(player.gold, 0);
});

test("queued system spells wait until a Discover interaction is complete", () => {
  let state = createGame(8082);
  state.activeTribes = ["beast", "mech", "demon", "murloc", "dragon"];
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.tavernTier = 6;
  const fillerDefinitions = LIVE_MINION_DEFINITIONS.filter(
    (definition) =>
      definition.id !== "BG34_523" &&
      !(definition.tribes ?? []).includes("beast") &&
      !(definition.tribes ?? []).includes("all"),
  ).slice(0, 9);
  assert.equal(fillerDefinitions.length, 9);
  player.hand = [
    ...fillerDefinitions.map((definition, index) =>
      definitionMinion(
        template,
        definition.id,
        `system-queue-filler-${index}`,
      ),
    ),
    definitionMinion(template, "BG34_523", "queued-system-shark"),
  ];
  player.pendingSystemSpellIds = ["system-spell-goldenizer"];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "queued-system-shark",
  });
  player = humanPlayer(state);
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(player.hand.length, 9);
  assert.deepEqual(player.pendingSystemSpellIds, [
    "system-spell-goldenizer",
  ]);
  assert.equal(
    player.hand.some(
      (card) => card.definitionId === "system-spell-goldenizer",
    ),
    false,
  );

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).hand.length, 10);
});

test("Goldenizer Supply fills space freed by expiring Spellcraft", () => {
  let state = createGame(8083, 999);
  let player = humanPlayer(state);
  player.hand = Array.from({ length: 10 }, (_, index) =>
    spellcraft("spellcraft-sick-riffs", `expiring-spellcraft-${index}`),
  );
  player.trinketIds = ["lesser-trinket-goldenizer-supply"];
  player.trinketCounters = { "lesser-trinket-goldenizer-supply": 2 };

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  assert.equal(state.phase, "combat");
  assert.deepEqual(player.pendingSystemSpellIds, []);
  assert.equal(player.hand.length, 1);
  assert.equal(player.hand[0]?.definitionId, "system-spell-goldenizer");
});

test("Sandglass starts everyone at Tavern Tier 2", () => {
  const state = lobbyGameForEvent("system-event-sandglass");
  assert.equal(state.systemEventId, "system-event-sandglass");
  assert.ok(state.players.every((player) => player.tavernTier === 2));
});

test("Aman'Thul starts everyone at Tavern Tier 3 with 9 gold", () => {
  const state = lobbyGameForEvent("system-event-amanthul");
  assert.equal(state.systemEventId, "system-event-amanthul");
  assert.ok(state.players.every((player) => player.tavernTier === 3));
  assert.ok(state.players.every((player) => player.gold === 9));
});

test("Full House tavern always has 7 cards", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-full-house"));
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  let player = humanPlayer(state);
  assert.ok(player.shop.length >= 5);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 6);
});

test("Titan Grip first minion purchase each turn is free", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-titan-grip"));
  let player = humanPlayer(state);
  player.gold = 10;
  const goldBefore = player.gold;
  assert.ok(player.shop[0]);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBefore);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBefore - 3);
});

test("Titan Grip resets the free purchase each turn", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-titan-grip"));
  let player = humanPlayer(state);
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 10);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 10);
});

test("Buy One Get One grants a copy of the first minion each turn", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-buy-one-get-one"));
  let player = humanPlayer(state);
  player.gold = 20;
  player.hand = [];
  player.board = [];
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  const shopMinionId = player.shop[0]?.definitionId;
  assert.ok(shopMinionId);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const matchingCards = player.hand.filter(
    (card) =>
      card.kind !== "spellcraft" && card.definitionId === shopMinionId,
  );
  assert.equal(matchingCards.length, 2, "bought card plus free copy");
  assert.equal(player.systemEventCounters.copyGrantedRound, 1);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.systemEventCounters.copyGrantedRound, 1, "not reset by second purchase");
});

test("Gold Carryover saves unspent gold for the next turn with bonus at 5", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-gold-carryover"));
  let player = humanPlayer(state);
  player.gold = 7;

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.gold, 4);
  assert.equal(player.systemEventCounters.savedGold, 7);

  player.gold = 3;
  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.gold, 5 + 7 + 1); // base(5) + saved(7) + bonus(1)
});

test("Gold Carryover bonus only triggers when saved >= 5", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-gold-carryover"));
  let player = humanPlayer(state);
  player.gold = 3;

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.systemEventCounters.savedGold, 3);

  player.gold = 2;
  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.gold, 5 + 3); // base(5) + saved(3), no bonus since 3 < 5
});

test("Refund Trick minions cost 1, sell gives 0, upgrade costs -2", () => {
  let state = chooseHero(lobbyGameForEvent("system-event-refund-trick"));
  let player = humanPlayer(state);
  assert.equal(player.gold, 1);

  assert.equal(getMinionPurchaseCost(state, player.id), 1);
  const shopMinion = player.shop[0];
  assert.ok(shopMinion);
  const goldBeforeBuy = player.gold;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBeforeBuy - 1);
  const cardInHand = player.hand.find(
    (card) =>
      card.kind !== "spellcraft" &&
      card.definitionId === shopMinion.definitionId,
  );
  assert.ok(cardInHand);
  const goldBeforeSell = player.gold;

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: cardInHand.instanceId ?? "",
  });
  player = humanPlayer(state);
  const boardMinion = player.board.at(-1);
  assert.ok(boardMinion);

  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: player.board.length - 1,
  });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBeforeSell);

  assert.equal(getUpgradeCost(state, player.id), 3); // 5 - 2 = 3
  player.gold = 10;

  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  player = humanPlayer(state);
  assert.equal(player.gold, 7);
  assert.equal(player.tavernTier, 2);
});

test("Mimiron's Clockwork Arena blocks manual upgrades and auto-upgrades every 2 turns", () => {
  let state = chooseHero(
    lobbyGameForEvent("system-event-mimiron-clockwork"),
  );
  let player = humanPlayer(state);
  assert.equal(player.tavernTier, 1);
  assert.equal(player.systemEventCounters.mimironTurns, 1);

  player.gold = 10;
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.equal(humanPlayer(state).tavernTier, 1);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 1);
  assert.equal(player.systemEventCounters.mimironTurns, 2);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 2);
  assert.equal(player.systemEventCounters.mimironTurns, 1);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 2);
  assert.equal(player.systemEventCounters.mimironTurns, 2);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.tavernTier, 3);
  assert.equal(player.systemEventCounters.mimironTurns, 1);
});
