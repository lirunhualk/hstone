import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getMinionPurchaseQuote,
  getTavernSpellPurchaseQuote,
  getTrinketProgressText,
  TAVERN_SPELL_DEFINITIONS,
  type BoardMinionInstance,
  type GameAction,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { deriveRecruitPresentation } from "../lib/game/recruit-presentation.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

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

function installTrinket(player: PlayerState, cardId: string): string {
  const trinket = trinketForCard(cardId);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  return trinket.id;
}

function minion(
  state: GameState,
  definitionId: string,
  instanceId: string,
): BoardMinionInstance {
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  const definition = getMinionDefinition(definitionId);
  return {
    ...structuredClone(template),
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

function demonDefinitionId(): string {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return tribes.includes("demon") || tribes.includes("all");
  });
  assert.ok(definition);
  return definition.id;
}

function ordinaryDefinitionId(): string {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return !tribes.includes("demon") && !tribes.includes("all");
  });
  assert.ok(definition);
  return definition.id;
}

function ordinaryTavernSpellDefinition() {
  const definition = TAVERN_SPELL_DEFINITIONS.find(
    (candidate) =>
      candidate.cost >= 2 && candidate.purchaseCurrency === undefined,
  );
  assert.ok(definition);
  return definition;
}

function tavernSpell(instanceId: string): TavernSpellInstance {
  const definition = ordinaryTavernSpellDefinition();
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

function keepOnlyTwoPlayers(state: GameState): void {
  for (let index = 0; index < state.players.length; index += 1) {
    const player = state.players[index];
    player.alive = index < 2;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }
}

test("Pilgrimp Sticker prices one Demon in Health, cannot kill, and resets next turn", () => {
  let state = createGame(0x8211);
  let player = humanPlayer(state);
  const trinketId = installTrinket(player, "BG32_MagicItem_821");
  player.shop = [
    minion(state, demonDefinitionId(), "pilgrimp-first"),
    minion(state, demonDefinitionId(), "pilgrimp-second"),
    minion(state, ordinaryDefinitionId(), "pilgrimp-ordinary"),
  ];
  player.hand = [];
  player.gold = 0;
  player.health = 3;

  assert.deepEqual(getMinionPurchaseQuote(state, player.id, 0), {
    currency: "health",
    cost: 3,
    affordable: false,
  });
  const failed = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  assert.equal(humanPlayer(failed).trinketCounters[trinketId], 0);
  assert.equal(humanPlayer(failed).shop.length, 3);

  player.health = 4;
  const before = state;
  const action: GameAction = { type: "BUY_MINION", shopIndex: 0 };
  state = gameReducer(state, action);
  player = humanPlayer(state);
  assert.equal(player.health, 1);
  assert.equal(player.gold, 0);
  assert.equal(player.trinketCounters[trinketId], 1);
  assert.equal(getMinionPurchaseQuote(state, player.id, 0)?.currency, "gold");
  assert.equal(getMinionPurchaseQuote(state, player.id, 1)?.currency, "gold");
  assert.match(
    getTrinketProgressText(player, trinketId) ?? "",
    /已使用/,
  );

  const presentation = deriveRecruitPresentation(before, state, action);
  assert.ok(
    presentation.some(
      (event) =>
        event.kind === "currency" &&
        event.currency === "health" &&
        event.delta === -3,
    ),
  );
  assert.ok(
    presentation.some(
      (event) =>
        event.kind === "cardMove" &&
        event.purchaseCurrency === "health" &&
        event.purchaseCost === 3,
    ),
  );

  keepOnlyTwoPlayers(state);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(player.trinketCounters[trinketId], 0);
  assert.match(
    getTrinketProgressText(player, trinketId) ?? "",
    /还可用生命购买1张恶魔牌/,
  );
});

test("Bazaar Sticker uses the discounted Tavern Spell quote and a failed full-hand buy consumes nothing", () => {
  let state = createGame(0x8221);
  let player = humanPlayer(state);
  const trinketId = installTrinket(player, "BG32_MagicItem_822");
  const spell = tavernSpell("bazaar-first");
  player.spellShop = spell;
  player.additionalSpellShop = [];
  player.gold = 0;
  player.health = 20;
  player.nextTavernSpellDiscount = 1;
  player.hand = Array.from({ length: 10 }, (_, index) =>
    minion(state, ordinaryDefinitionId(), `bazaar-hand-${index}`),
  );

  assert.deepEqual(getTavernSpellPurchaseQuote(state, player.id), {
    currency: "health",
    cost: spell.cost - 1,
    affordable: false,
  });
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: spell.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.trinketCounters[trinketId], 0);
  assert.equal(player.spellShop?.instanceId, spell.instanceId);

  player.hand = [];
  const healthBefore = player.health;
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: spell.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.health, healthBefore - (spell.cost - 1));
  assert.equal(player.gold, 0);
  assert.equal(player.nextTavernSpellDiscount, 0);
  assert.equal(player.trinketCounters[trinketId], 1);

  player.spellShop = tavernSpell("bazaar-second");
  assert.equal(
    getTavernSpellPurchaseQuote(state, player.id)?.currency,
    "gold",
  );
});

test("Eye of Sargeras counts successful Minion and Tavern Spell purchases, persists, and prices only each fourth card in Health", () => {
  let state = createGame(0x7011);
  let player = humanPlayer(state);
  const trinketId = installTrinket(player, "BG30_MagicItem_701");
  player.hand = [];
  player.gold = 9;
  player.health = 20;
  const eyeMinions = Array.from({ length: 3 }, (_, index) =>
    minion(
      state,
      ordinaryDefinitionId(),
      `eye-minion-${index + 1}`,
    ),
  );

  for (let purchase = 1; purchase <= 3; purchase += 1) {
    player.shop = [eyeMinions[purchase - 1]];
    assert.equal(
      getMinionPurchaseQuote(state, player.id, 0)?.currency,
      "gold",
    );
    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    player = humanPlayer(state);
    assert.equal(player.trinketCounters[trinketId], purchase);
  }

  const fourth = tavernSpell("eye-fourth");
  player.spellShop = fourth;
  player.additionalSpellShop = [];
  player.health = fourth.cost;
  assert.deepEqual(getTavernSpellPurchaseQuote(state, player.id), {
    currency: "health",
    cost: fourth.cost,
    affordable: false,
  });
  const failed = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: fourth.instanceId,
  });
  assert.equal(humanPlayer(failed).trinketCounters[trinketId], 3);
  assert.equal(humanPlayer(failed).spellShop?.instanceId, fourth.instanceId);
  assert.match(
    getTrinketProgressText(humanPlayer(failed), trinketId) ?? "",
    /下一张购买的牌/,
  );

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(failed)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  assert.equal(humanPlayer(restored).trinketCounters[trinketId], 3);
  assert.equal(
    getTavernSpellPurchaseQuote(
      restored,
      restored.humanPlayerId,
    )?.currency,
    "health",
  );

  humanPlayer(restored).health = fourth.cost + 1;
  state = gameReducer(restored, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: fourth.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.health, 1);
  assert.equal(player.trinketCounters[trinketId], 0);
  player.spellShop = tavernSpell("eye-fifth");
  assert.equal(
    getTavernSpellPurchaseQuote(state, player.id)?.currency,
    "gold",
  );
});

test("Demonic Tapestry marks one highest-Tier offer after four successful Refreshes and preserves the quote through save", () => {
  let state = createGame(0x1521);
  let player = humanPlayer(state);
  const trinketId = installTrinket(player, "BG35_MagicItem_152");
  player.gold = 0;
  player.freeRefreshes = 0;

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.trinketCounters[trinketId], 0);

  player.freeRefreshes = 4;
  for (let refresh = 1; refresh <= 4; refresh += 1) {
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);
    assert.equal(
      player.trinketCounters[trinketId],
      refresh === 4 ? 0 : refresh,
    );
  }

  const healthPricedIndices = player.shop
    .map((_, index) => index)
    .filter(
      (index) =>
        getMinionPurchaseQuote(state, player.id, index)?.currency ===
        "health",
    );
  assert.equal(healthPricedIndices.length, 1);
  const healthPricedIndex = healthPricedIndices[0];
  const highestTier = Math.max(...player.shop.map((offer) => offer.tier));
  assert.equal(player.shop[healthPricedIndex]?.tier, highestTier);
  assert.match(
    getTrinketProgressText(player, trinketId) ?? "",
    /已有1张最高等级随从/,
  );

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  const restoredPlayer = humanPlayer(restored);
  assert.equal(
    getMinionPurchaseQuote(
      restored,
      restoredPlayer.id,
      healthPricedIndex,
    )?.currency,
    "health",
  );

  const cost = getMinionPurchaseQuote(
    restored,
    restoredPlayer.id,
    healthPricedIndex,
  )?.cost;
  assert.equal(cost, 3);
  restoredPlayer.health = cost;
  const failed = gameReducer(restored, {
    type: "BUY_MINION",
    shopIndex: healthPricedIndex,
  });
  assert.equal(humanPlayer(failed).shop.length, restoredPlayer.shop.length);
  assert.equal(
    getMinionPurchaseQuote(
      failed,
      failed.humanPlayerId,
      healthPricedIndex,
    )?.currency,
    "health",
  );

  humanPlayer(failed).health = cost + 1;
  state = gameReducer(failed, {
    type: "BUY_MINION",
    shopIndex: healthPricedIndex,
  });
  assert.equal(humanPlayer(state).health, 1);
  assert.equal(humanPlayer(state).trinketCounters[trinketId], 0);
});

test("AI buys a due Eye of Sargeras offer with Health only above its safety floor", () => {
  const runAtHealth = (health: number): PlayerState => {
    const state = createGame(0x701a + health);
    const offer = minion(
      state,
      ordinaryDefinitionId(),
      `ai-eye-${health}`,
    );
    keepOnlyTwoPlayers(state);
    const ai = state.players[1];
    const trinketId = installTrinket(ai, "BG30_MagicItem_701");
    ai.trinketCounters[trinketId] = 3;
    ai.health = health;
    ai.gold = 0;
    ai.shop = [offer];
    ai.shop[0].attack = 100;
    ai.shop[0].health = 100;
    return gameReducer(state, { type: "END_TURN" }).players[1];
  };

  const unsafe = runAtHealth(9);
  assert.equal(unsafe.trinketCounters[trinketForCard("BG30_MagicItem_701").id], 3);
  assert.ok(!unsafe.board.some((offer) => offer.instanceId === "ai-eye-9"));

  const safe = runAtHealth(20);
  assert.equal(safe.health, 17);
  assert.equal(safe.trinketCounters[trinketForCard("BG30_MagicItem_701").id], 0);
  assert.ok(safe.board.some((offer) => offer.instanceId === "ai-eye-20"));
});
