import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  getSpellcraftDefinition,
  getTavernSpellPurchaseQuote,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
} from "../lib/game/engine.ts";
import {
  CORRUPTED_TOME_CARD_ID,
  DARKMOON_PRIZE_DEFINITIONS,
  TICKATUS_TAG_CARD_ID,
  TRIPLE_PRIZE_DEFINITION_ID,
} from "../lib/game/darkmoon-prizes.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trinketForCard(cardId: string) {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be an active Trinket`);
  return definition;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const definition = trinketForCard(cardId);
  const player = humanPlayer(state);
  player.gold = 100;
  player.maxGold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `choose-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: definition.id,
  });
}

function addGeneratedSpell(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  const card: SpellcraftSpellInstance = {
    kind: "spellcraft",
    instanceId: `test-darkmoon-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: "generated",
    target: definition.target,
    effectMultiplier: 1,
  };
  state.nextInstanceId += 1;
  player.hand.push(card);
  return card;
}

function prizeDefinitionId(cardId: string): string {
  const definition = DARKMOON_PRIZE_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be a Tier 3 Darkmoon Prize`);
  return definition.id;
}

function moveFirstShopMinionToBoard(
  state: GameState,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const player = humanPlayer(state);
  const minion = player.shop.shift();
  assert.ok(minion);
  Object.assign(minion, overrides);
  player.board.push(minion);
  return minion;
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("the fixed build has the exact eight Tier 3 Darkmoon Prizes", () => {
  assert.deepEqual(
    DARKMOON_PRIZE_DEFINITIONS.map((definition) => definition.cardId),
    [
      "BGS_Treasures_011",
      "BGS_Treasures_015",
      "BGS_Treasures_019",
      "BGS_Treasures_020",
      "BGS_Treasures_034",
      "BGS_Treasures_037",
      "BGS_Treasures_039",
      "BGS_Treasures_104",
    ],
  );
  assert.ok(
    DARKMOON_PRIZE_DEFINITIONS.every(
      (definition) =>
        definition.spellFamily === "generated" &&
        definition.randomlyGeneratable === false,
    ),
  );
});

test("Tickatus Tag discovers three unique saveable Prize options", () => {
  let state = acquireTrinket(createGame(0x7071), TICKATUS_TAG_CARD_ID);
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  assert.equal(pending.options.length, 3);
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    3,
  );
  assert.ok(
    pending.options.every((option) =>
      DARKMOON_PRIZE_DEFINITIONS.some(
        (definition) => definition.id === option.definitionId,
      ),
    ),
  );

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(restored.pendingInteraction, pending);

  const selected = pending.options[0];
  assert.ok(selected);
  state = gameReducer(restored, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  const player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.ok(
    player.hand.some((card) => card.instanceId === selected.instanceId),
  );
  assert.equal(player.tavernSpellsCast, 0);
  assert.equal(player.playerSpellsCast, 0);
});

test("Tickatus Tag repeats at the start of every third turn", () => {
  let state = acquireTrinket(createGame(0x7072, 999), TICKATUS_TAG_CARD_ID);
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0]!.instanceId,
  });

  state = continueThroughCombat(state);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  assert.equal(pending.options.length, 3);
  assert.equal(
    humanPlayer(state).trinketCounters[
      trinketForCard(TICKATUS_TAG_CARD_ID).id
    ],
    0,
  );
});

test("Corrupted Tome grants and replaces Triple Rewards with Triple Prizes", () => {
  let state = acquireTrinket(createGame(0x8121), CORRUPTED_TOME_CARD_ID);
  let player = humanPlayer(state);
  assert.equal(
    player.hand.filter(
      (card) => card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
    ).length,
    1,
  );

  const minion = player.shop.shift();
  assert.ok(minion);
  minion.grantsTripleReward = true;
  player.hand.push(minion);
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: minion.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(
    player.hand.filter(
      (card) => card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
    ).length,
    2,
  );
  assert.equal(
    player.hand.some((card) => card.kind === "tripleReward"),
    false,
  );
});

test("Triple Prize discovers a Prize without counting as a Tavern Spell", () => {
  let state = acquireTrinket(createGame(0x8122), CORRUPTED_TOME_CARD_ID);
  let player = humanPlayer(state);
  const triplePrize = player.hand.find(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft" &&
      card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
  );
  assert.ok(triplePrize);
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: triplePrize.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  const selected = pending.options[0];
  assert.ok(selected);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.tavernSpellsCast, 0);
  assert.equal(player.tavernSpellsCastThisTurn, 0);
  assert.equal(player.playerSpellsCast, 1);
  assert.ok(
    player.hand.some((card) => card.instanceId === selected.instanceId),
  );
});

test("Holy Light and Repeat Customer use their exact friendly targets", () => {
  let state = createGame(0x8123);
  let player = humanPlayer(state);
  const holyTarget = moveFirstShopMinionToBoard(state);
  const holyAttack = holyTarget.attack;
  const holy = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_015"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: holy.instanceId,
    targetInstanceId: holyTarget.instanceId,
  });
  player = humanPlayer(state);
  const blessed = player.board.find(
    (minion) => minion.instanceId === holyTarget.instanceId,
  );
  assert.ok(blessed);
  assert.equal(blessed.attack, holyAttack + 10);
  assert.equal(blessed.divineShield, true);

  const repeatTarget = moveFirstShopMinionToBoard(state);
  const attackBefore = repeatTarget.attack;
  const healthBefore = repeatTarget.health;
  const repeat = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_034"),
  );
  blessed.golden = true;
  assert.ok(
    getLegalSpellcraftTargetIds(state, player.id, repeat).includes(
      repeatTarget.instanceId,
    ),
  );
  assert.equal(
    getLegalSpellcraftTargetIds(state, player.id, repeat).includes(
      blessed.instanceId,
    ),
    false,
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: repeat.instanceId,
    targetInstanceId: repeatTarget.instanceId,
  });
  const returned = humanPlayer(state).hand.find(
    (card) => card.instanceId === repeatTarget.instanceId,
  );
  assert.ok(returned?.kind === "minion");
  assert.equal(returned.attack, attackBefore + 6);
  assert.equal(returned.health, healthBefore + 6);
});

test("Bananas, All That Glitters, and Mindflayer Goggles resolve exactly", () => {
  let state = createGame(0x8124);
  let player = humanPlayer(state);
  const bananas = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_019"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: bananas.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.ok(
    player.hand.every(
      (card) =>
        card.kind === "tavernSpell" && card.cardId === "BG28_897",
    ),
  );

  player.hand = [];
  const glitter = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_037"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: glitter.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.shop.filter((minion) => minion.golden).length, 1);

  const stolenIds = new Set([
    ...player.shop.map((card) => card.instanceId),
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((card) => card.instanceId),
  ]);
  const goggles = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_039"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: goggles.instanceId,
  });
  player = humanPlayer(state);
  assert.ok(
    [...stolenIds].every((instanceId) =>
      player.hand.some((card) => card.instanceId === instanceId),
    ),
  );
  assert.ok(
    player.shop.every((card) => !stolenIds.has(card.instanceId)),
  );
});

test("Top Shelf, Training Session, and Reserve Prices use deferred and same-turn state", () => {
  let state = createGame(0x8125, 999);
  let player = humanPlayer(state);
  player.tavernTier = 2;
  const topShelf = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_020"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: topShelf.instanceId,
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.exactTier, 3);
  assert.ok(pending.options.every((option) => option.tier === 3));
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0]!.instanceId,
  });
  assert.equal(humanPlayer(state).playerSpellsCast, 1);

  player = humanPlayer(state);
  const oldHeroPower = player.heroPowerId;
  const training = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_011"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: training.instanceId,
  });
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "heroPowerChoice");
  assert.equal(pending.completionSource, "generatedSpellCast");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.optionIds[0]!,
  });
  player = humanPlayer(state);
  assert.notEqual(player.heroPowerId, oldHeroPower);
  assert.equal(player.playerSpellsCast, 2);

  const spellOffer = player.spellShop;
  assert.ok(spellOffer);
  const costBefore = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spellOffer.instanceId,
  )?.cost;
  assert.equal(typeof costBefore, "number");
  const reservePrices = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_104"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: reservePrices.instanceId,
  });
  player = humanPlayer(state);
  const costAfter = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spellOffer.instanceId,
  )?.cost;
  assert.equal(costAfter, Math.max(0, (costBefore ?? 0) - 1));
  assert.equal(player.darkmoonReservePricesDiscount, 1);

  state = continueThroughCombat(state);
  assert.equal(humanPlayer(state).darkmoonReservePricesDiscount, 0);
});

test("AI chooses and casts generated Darkmoon Prizes without pausing", () => {
  let state = createGame(0x8126, 999);
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  ai.hand = [];
  addGeneratedSpell(state, ai, TRIPLE_PRIZE_DEFINITION_ID);
  const castsBefore = ai.playerSpellsCast;

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(state.pendingInteraction, null);
  assert.ok(nextAi.playerSpellsCast >= castsBefore + 2);
  assert.equal(
    nextAi.hand.some(
      (card) => card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
    ),
    false,
  );
});

test("current saves repair missing Darkmoon counters and reject unsafe values", () => {
  const legacyShape = jsonClone(createGame(0x8127)) as GameState;
  for (const player of legacyShape.players) {
    delete player.darkmoonReservePricesDiscount;
    delete player.pendingTickatusTagPrizes;
  }
  const repaired = normalizePersistedGameState(legacyShape) as GameState | null;
  assert.ok(repaired);
  assert.ok(
    repaired.players.every(
      (player) =>
        player.darkmoonReservePricesDiscount === 0 &&
        player.pendingTickatusTagPrizes === 0,
    ),
  );

  const unsafe = jsonClone(repaired);
  unsafe.players[0]!.darkmoonReservePricesDiscount = -1;
  assert.equal(normalizePersistedGameState(unsafe), null);
});
