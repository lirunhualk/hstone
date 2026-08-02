import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";

const CHROMATIC_WHELP_IDS = new Set([
  "BG34_634t",
  "BG34_635t",
  "BG34_636t",
  "BG34_637t",
  "BG34_638t",
]);

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

function gameWithTrinkets(cardIds: readonly string[], seed: number) {
  const state = createGame(seed);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const trinkets = cardIds.map(trinketForCard);
  player.trinketIds = trinkets.map((trinket) => trinket.id);
  player.trinketCounters = Object.fromEntries(
    trinkets.map((trinket) => [trinket.id, 0]),
  );
  player.board = [];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  state.pendingInteraction = null;
  return { state, player, template, trinkets };
}

function acquireTrinketByCardId(state: GameState, cardId: string): GameState {
  const trinket = trinketForCard(cardId);
  const player = humanPlayer(state);
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
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    kind: "minion",
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
    poolCopies: 0,
    attachments: [],
  };
}

function simpleDefinition() {
  const definition = LIVE_MINION_DEFINITIONS.find(
    (candidate) =>
      candidate.collectible !== false &&
      candidate.battlecry === undefined &&
      candidate.interactiveBattlecry === undefined &&
      candidate.onPlayChoice === undefined &&
      candidate.magnetic === undefined &&
      candidate.afterSpellCast === undefined &&
      candidate.afterTavernSpellCast === undefined &&
      candidate.afterSelfGainsAttack === undefined,
  );
  assert.ok(definition);
  return definition;
}

function bloodGem(instanceId: string): BloodGemSpellInstance {
  return {
    kind: "bloodGem",
    instanceId,
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
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

test("third-batch portraits and generated-card Trinkets grant exact acquisition rewards", () => {
  for (const [cardId, expectedDefinitionId, expectedKind] of [
    ["BG30_MagicItem_920", "tavern-spell-slimy-seafood", "tavernSpell"],
    ["BG30_MagicItem_943", "BG30_121", "minion"],
    ["BG30_MagicItem_944", "BG28_551", "minion"],
  ] as const) {
    let state = createGame(cardId.length * 101);
    humanPlayer(state).hand = [];
    state = acquireTrinketByCardId(state, cardId);
    assert.equal(humanPlayer(state).hand.length, 1);
    assert.equal(humanPlayer(state).hand[0]?.kind, expectedKind);
    assert.equal(
      humanPlayer(state).hand[0]?.definitionId,
      expectedDefinitionId,
    );
  }

  let heartState = createGame(8101);
  heartState = acquireTrinketByCardId(
    heartState,
    "BG32_MagicItem_801t",
  );
  assert.equal(humanPlayer(heartState).tavernSpellAttackBonus, 1);
  assert.equal(humanPlayer(heartState).tavernSpellHealthBonus, 1);

  let tearState = createGame(8102);
  humanPlayer(tearState).hand = [];
  tearState = acquireTrinketByCardId(
    tearState,
    "BG35_MagicItem_840t",
  );
  const whelps = humanPlayer(tearState).hand.filter(
    (card) =>
      card.kind === "minion" && CHROMATIC_WHELP_IDS.has(card.definitionId),
  );
  assert.equal(whelps.length, 2);
});

test("Replica Cathedral repeats the first spell, including chained Discover resolution", () => {
  const prepared = gameWithTrinkets(
    ["BG30_MagicItem_434"],
    8201,
  );
  let state = prepared.state;
  const player = prepared.player;
  const first = tavernSpell("tavern-spell-new-sprout", "cathedral-sprout");
  player.hand = [first];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: first.instanceId,
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.remainingDiscoveries, 2);

  for (let discovery = 0; discovery < 2; discovery += 1) {
    pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover");
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: pending.options[0].instanceId,
    });
  }
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).tavernSpellsCastThisTurn, 2);

  const second = tavernSpell("tavern-spell-tavern-coin", "cathedral-coin");
  humanPlayer(state).hand.push(second);
  const goldBefore = humanPlayer(state).gold;
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: second.instanceId,
  });
  assert.equal(humanPlayer(state).gold, goldBefore + 1);
});

test("Replica Cathedral repeats Blood Gems and a Spellcraft choice exactly once", () => {
  {
    const prepared = gameWithTrinkets(["BG30_MagicItem_434"], 8202);
    let state = prepared.state;
    const target = definitionMinion(
      prepared.template,
      simpleDefinition().id,
      "cathedral-gem-target",
    );
    const before = { attack: target.attack, health: target.health };
    prepared.player.board = [target];

    for (let cast = 0; cast < 2; cast += 1) {
      const gem = bloodGem(`cathedral-gem-${cast}`);
      humanPlayer(state).hand.push(gem);
      state = gameReducer(state, {
        type: "CAST_BLOOD_GEM",
        cardInstanceId: gem.instanceId,
        targetInstanceId: target.instanceId,
      });
    }
    assert.equal(humanPlayer(state).board[0]?.attack, before.attack + 3);
    assert.equal(humanPlayer(state).board[0]?.health, before.health + 3);
  }

  {
    const prepared = gameWithTrinkets(["BG30_MagicItem_434"], 8203);
    let state = prepared.state;
    const target = definitionMinion(
      prepared.template,
      simpleDefinition().id,
      "cathedral-eruption-target",
    );
    const beforeAttack = target.attack;
    const eruption = spellcraft(
      "spellcraft-escape-eruption",
      "cathedral-eruption",
    );
    prepared.player.board = [target];
    prepared.player.hand = [eruption];

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: eruption.instanceId,
    });
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "spellcraftChoice");
    assert.equal(pending.effectMultiplier, 2);
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: "escapeEruptionAttack",
    });
    assert.equal(humanPlayer(state).board[0]?.attack, beforeAttack + 8);
  }
});

test("Sinstone Sticker copies only the first two Discover picks each round", () => {
  let { state } = gameWithTrinkets(["BG30_MagicItem_801"], 8301);

  for (let discovery = 0; discovery < 3; discovery += 1) {
    const player = humanPlayer(state);
    player.hand = [
      tavernSpell(
        "tavern-spell-new-sprout",
        `sinstone-sprout-${discovery}`,
      ),
    ];
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `sinstone-sprout-${discovery}`,
    });
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover");
    const pickedDefinitionId = pending.options[0].definitionId;
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: pending.options[0].instanceId,
    });
    assert.equal(
      humanPlayer(state).hand.filter(
        (card) =>
          card.kind === "minion" &&
          card.definitionId === pickedDefinitionId,
      ).length,
      discovery < 2 ? 2 : 1,
    );
  }
});

test("Spitescale Sushi Roll repeats the first two Spellcraft cards per round", () => {
  const prepared = gameWithTrinkets(
    ["BG30_MagicItem_920"],
    8401,
  );
  let state = prepared.state;
  const { player, template } = prepared;
  const target = definitionMinion(
    template,
    simpleDefinition().id,
    "sushi-target",
  );
  const before = { attack: target.attack, health: target.health };
  player.board = [target];

  for (let cast = 0; cast < 3; cast += 1) {
    const card = spellcraft(
      "spellcraft-anglers-lure",
      `sushi-lure-${cast}`,
    );
    humanPlayer(state).hand.push(card);
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: card.instanceId,
      targetInstanceId: target.instanceId,
    });
  }
  let buffed = humanPlayer(state).board[0];
  assert.equal(buffed?.attack, before.attack + 10);
  assert.equal(buffed?.health, before.health + 30);

  state.round += 1;
  const nextRound = spellcraft(
    "spellcraft-anglers-lure",
    "sushi-next-round",
  );
  humanPlayer(state).hand.push(nextRound);
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: nextRound.instanceId,
    targetInstanceId: target.instanceId,
  });
  buffed = humanPlayer(state).board[0];
  assert.equal(buffed?.attack, before.attack + 14);
  assert.equal(buffed?.health, before.health + 42);
});

test("Surveyor Portrait augments only Blood Gems played from hand", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG30_MagicItem_943"],
    8501,
  );
  const target = definitionMinion(
    template,
    simpleDefinition().id,
    "surveyor-target",
  );
  const before = { attack: target.attack, health: target.health };
  const gem = bloodGem("surveyor-gem");
  player.board = [target];
  player.hand = [gem];

  const next = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: gem.instanceId,
    targetInstanceId: target.instanceId,
  });
  assert.equal(humanPlayer(next).board[0]?.attack, before.attack + 7);
  assert.equal(humanPlayer(next).board[0]?.health, before.health + 7);
});

test("Redeemer Portrait increases every Nalaa pulse by an extra +4/+4", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG30_MagicItem_944"],
    8601,
  );
  const nalaa = definitionMinion(template, "BG28_551", "portrait-nalaa");
  const dragonDefinition = LIVE_MINION_DEFINITIONS.find((definition) => {
    const tribes =
      definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe]);
    return tribes.includes("dragon") && definition.id !== "BG28_551";
  });
  assert.ok(dragonDefinition);
  const dragon = definitionMinion(
    template,
    dragonDefinition.id,
    "portrait-dragon",
  );
  const before = { attack: dragon.attack, health: dragon.health };
  const coin = tavernSpell("tavern-spell-tavern-coin", "portrait-coin");
  player.board = [nalaa, dragon];
  player.hand = [coin];

  const next = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: coin.instanceId,
  });
  assert.equal(humanPlayer(next).board[1]?.attack, before.attack + 8);
  assert.equal(humanPlayer(next).board[1]?.health, before.health + 7);
});

test("Fancy Spellbook tracks Gold across transactions and casts Shiny Ring", () => {
  const prepared = gameWithTrinkets(
    ["BG30_MagicItem_999"],
    8701,
  );
  let state = prepared.state;
  const { player, template, trinkets } = prepared;
  const target = definitionMinion(
    template,
    simpleDefinition().id,
    "spellbook-target",
  );
  const before = { attack: target.attack, health: target.health };
  player.board = [target];
  player.gold = 50;

  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  assert.equal(humanPlayer(state).trinketCounters[trinkets[0].id], 5);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).trinketCounters[trinkets[0].id], 6);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.trinketCounters[trinkets[0].id], 0);
  assert.equal(nextPlayer.board[0]?.attack, before.attack + 1);
  assert.equal(nextPlayer.board[0]?.health, before.health + 1);
  assert.equal(nextPlayer.tavernSpellsCastThisTurn, 1);
});

test("War Drum adds two Battlecry triggers only once per round", () => {
  const prepared = gameWithTrinkets(
    ["BG32_MagicItem_416"],
    8801,
  );
  let state = prepared.state;
  const { player, template } = prepared;
  const makeGeomancer = (instanceId: string) =>
    definitionMinion(template, "BG20_100", instanceId);

  player.hand = [makeGeomancer("war-drum-first")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(
    humanPlayer(state).hand.filter((card) => card.kind === "bloodGem").length,
    6,
  );

  humanPlayer(state).hand = [makeGeomancer("war-drum-second")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(
    humanPlayer(state).hand.filter((card) => card.kind === "bloodGem").length,
    2,
  );

  state.round += 1;
  humanPlayer(state).hand = [makeGeomancer("war-drum-next-round")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  assert.equal(
    humanPlayer(state).hand.filter((card) => card.kind === "bloodGem").length,
    6,
  );
});

test("Heart of the Forest improves after six Tavern Spell cards from hand", () => {
  let state = createGame(8901);
  state = acquireTrinketByCardId(state, "BG32_MagicItem_801t");
  humanPlayer(state).hand = [];

  for (let cast = 0; cast < 6; cast += 1) {
    const coin = tavernSpell(
      "tavern-spell-tavern-coin",
      `heart-coin-${cast}`,
    );
    humanPlayer(state).hand.push(coin);
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: coin.instanceId,
    });
  }
  assert.equal(humanPlayer(state).tavernSpellAttackBonus, 2);
  assert.equal(humanPlayer(state).tavernSpellHealthBonus, 2);
});

test("Bubble Crown upgrades Tavern Spell buffs once after twelve spells", () => {
  const prepared = gameWithTrinkets(
    ["BG35_MagicItem_920"],
    9001,
  );
  let state = prepared.state;
  const { player, template, trinkets } = prepared;
  const target = definitionMinion(
    template,
    simpleDefinition().id,
    "bubble-target",
  );
  player.board = [target];

  for (let cast = 0; cast < 12; cast += 1) {
    const gem = bloodGem(`bubble-gem-${cast}`);
    humanPlayer(state).hand.push(gem);
    state = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: gem.instanceId,
      targetInstanceId: target.instanceId,
    });
  }
  const beforeRing = humanPlayer(state).board[0];
  assert.ok(beforeRing);
  const statsBeforeRing = {
    attack: beforeRing.attack,
    health: beforeRing.health,
  };
  assert.equal(humanPlayer(state).tavernSpellAttackBonus, 4);
  assert.equal(humanPlayer(state).tavernSpellHealthBonus, 4);
  assert.equal(humanPlayer(state).trinketCounters[trinkets[0].id], 12);

  const ring = tavernSpell("tavern-spell-shiny-ring", "bubble-ring");
  humanPlayer(state).hand.push(ring);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: ring.instanceId,
  });
  assert.equal(
    humanPlayer(state).board[0]?.attack,
    statsBeforeRing.attack + 5,
  );
  assert.equal(
    humanPlayer(state).board[0]?.health,
    statsBeforeRing.health + 5,
  );
});

test("Coral Spear casts Might of Stormwind after each Spellcraft cast", () => {
  const { state, player, template } = gameWithTrinkets(
    ["BG35_MagicItem_925"],
    9101,
  );
  const target = definitionMinion(
    template,
    simpleDefinition().id,
    "coral-target",
  );
  const before = { attack: target.attack, health: target.health };
  const riffs = spellcraft("spellcraft-sick-riffs", "coral-riffs");
  player.board = [target];
  player.hand = [riffs];

  const next = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: riffs.instanceId,
    targetInstanceId: target.instanceId,
  });
  assert.equal(humanPlayer(next).board[0]?.attack, before.attack + 2);
  assert.equal(humanPlayer(next).board[0]?.health, before.health + 3);
  assert.equal(humanPlayer(next).tavernSpellsCastThisTurn, 1);
});

test("Chromatic Tear repeats its two-Whelp reward after seven Battlecry plays", () => {
  const prepared = gameWithTrinkets(
    ["BG35_MagicItem_840t"],
    9201,
  );
  let state = prepared.state;
  const { template, trinkets } = prepared;

  for (let played = 0; played < 7; played += 1) {
    const minion = definitionMinion(
      template,
      "BG20_100",
      `tear-battlecry-${played}`,
    );
    humanPlayer(state).hand = [minion];
    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    if (played < 6) {
      humanPlayer(state).board = [];
    }
  }

  assert.equal(
    humanPlayer(state).hand.filter(
      (card) =>
        card.kind === "minion" &&
        CHROMATIC_WHELP_IDS.has(card.definitionId),
    ).length,
    2,
  );
  assert.equal(humanPlayer(state).trinketCounters[trinkets[0].id], 0);
});
