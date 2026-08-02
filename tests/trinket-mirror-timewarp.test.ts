import assert from "node:assert/strict";
import test from "node:test";

import {
  MINION_DEFINITIONS,
  TIMEWARP_COST_TWO_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getLegalTavernSpellTargetIds,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { MinionTier } from "../lib/game/types.ts";

const MIRROR_BOX_CARD_ID = "BG35_MagicItem_817";
const MIRROR_LENS_CARD_ID = "BG35_MagicItem_817t";
const MIRROR_LENS_DEFINITION_ID = "system-spell-mirror-lens";
const LESSER_OLD_CANDLESTICK_CARD_ID = "BG35_MagicItem_823";
const GREATER_OLD_CANDLESTICK_CARD_ID = "BG35_MagicItem_823t";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function activeTrinket(cardId: string) {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be active`);
  return definition;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const definition = activeTrinket(cardId);
  const player = humanPlayer(state);
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `acquire-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: `acquire-${cardId}`,
    optionInstanceId: definition.id,
  });
}

function ordinaryDefinitionAtTier(tier: MinionTier) {
  const definition = MINION_DEFINITIONS.find(
    (candidate) =>
      candidate.tier === tier && candidate.collectible !== false,
  );
  assert.ok(definition, `an ordinary Tier ${tier} minion must exist`);
  return definition;
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
    description: definition.description,
    effectCounters: {},
    poolCopies: 0,
    attachments: [],
  };
}

function mirrorLens(player: PlayerState): TavernSpellInstance {
  const lens = player.hand.find(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell" && card.cardId === MIRROR_LENS_CARD_ID,
  );
  assert.ok(lens);
  return lens;
}

function fillerMinions(
  state: GameState,
  prefix: string,
  count: number,
): BoardMinionInstance[] {
  const definitions = MINION_DEFINITIONS.filter(
    (definition) => definition.collectible !== false,
  ).slice(0, count);
  assert.equal(definitions.length, count);
  return definitions.map((definition, index) =>
    minion(state, definition.id, `${prefix}-${index}`),
  );
}

function fillHand(state: GameState, prefix: string): void {
  humanPlayer(state).hand = fillerMinions(state, prefix, 10);
}

function keepOnlyTwoPlayers(state: GameState): void {
  for (let index = 0; index < state.players.length; index += 1) {
    const player = state.players[index];
    player.alive = index < 2;
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("Mirror Box grants the exact Mirror Lens and copies an original Tier 3-or-lower minion", () => {
  let state = createGame(0x8171);
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, MIRROR_BOX_CARD_ID);
  let player = humanPlayer(state);
  const spell = mirrorLens(player);
  assert.deepEqual(getTavernSpellDefinition(spell.definitionId), {
    id: MIRROR_LENS_DEFINITION_ID,
    cardId: MIRROR_LENS_CARD_ID,
    name: "复映透镜",
    tier: 1,
    cost: 0,
    description: "选择一个等级3或以下的随从，获取一张该随从的原始版复制。",
    effectSupport: "complete",
    effect: "mirrorLens",
    target: "anyMinion",
  });

  const tierThreeDefinition = ordinaryDefinitionAtTier(3);
  const tierFourDefinition = ordinaryDefinitionAtTier(4);
  const enhancedGolden = minion(
    state,
    tierThreeDefinition.id,
    "mirror-enhanced-golden",
  );
  enhancedGolden.golden = true;
  enhancedGolden.attack += 100;
  enhancedGolden.health += 100;
  const shopTarget = minion(
    state,
    ordinaryDefinitionAtTier(2).id,
    "mirror-shop-target",
  );
  const illegalTierFour = minion(
    state,
    tierFourDefinition.id,
    "mirror-tier-four",
  );
  player.board = [enhancedGolden, illegalTierFour];
  player.shop = [shopTarget];

  assert.deepEqual(
    new Set(getLegalTavernSpellTargetIds(state, player.id, spell)),
    new Set([enhancedGolden.instanceId, shopTarget.instanceId]),
  );
  const invalidState = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
    targetInstanceId: illegalTierFour.instanceId,
  });
  assert.deepEqual(invalidState, state);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
    targetInstanceId: enhancedGolden.instanceId,
  });
  player = humanPlayer(state);
  const copy = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === tierThreeDefinition.id,
  );
  assert.ok(copy);
  assert.equal(copy.golden, false);
  assert.equal(copy.cardId, tierThreeDefinition.cardId);
  assert.deepEqual(
    [copy.attack, copy.health],
    [tierThreeDefinition.attack, tierThreeDefinition.health],
  );
  assert.equal(copy.poolCopies, 0);
  assert.equal(player.hand.some((card) => card.instanceId === spell.instanceId), false);
});

test("Mirror Lens safely casts from a full hand and never overflows it", () => {
  let state = createGame(0x8172);
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, MIRROR_BOX_CARD_ID);
  let player = humanPlayer(state);
  const spell = mirrorLens(player);
  const targetDefinition = ordinaryDefinitionAtTier(3);
  const target = minion(state, targetDefinition.id, "mirror-full-target");
  player.board = [target];
  player.hand.push(
    ...fillerMinions(state, "mirror-full", 9),
  );
  assert.equal(player.hand.length, 10);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(
    player.hand.filter(
      (card) =>
        card.kind === "minion" && card.definitionId === targetDefinition.id,
    ).length,
    1,
  );
});

test("Mirror Box repeats every two turn starts and preserves its counter through saves", () => {
  let state = createGame(0x8173);
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, MIRROR_BOX_CARD_ID);
  humanPlayer(state).hand = [];
  state.lobbySystemsEnabled = false;

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  keepOnlyTwoPlayers(restored);

  state = continueThroughCombat(restored);
  assert.equal(
    humanPlayer(state).hand.some((card) => card.cardId === MIRROR_LENS_CARD_ID),
    false,
  );
  const trinket = activeTrinket(MIRROR_BOX_CARD_ID);
  assert.equal(humanPlayer(state).trinketCounters[trinket.id], 1);

  state = continueThroughCombat(state);
  assert.equal(mirrorLens(humanPlayer(state)).cardId, MIRROR_LENS_CARD_ID);
  assert.equal(humanPlayer(state).trinketCounters[trinket.id], 0);
});

for (const [index, scenario] of [
  {
    cardId: LESSER_OLD_CANDLESTICK_CARD_ID,
    pool: "lesser" as const,
    tier: 3 as const,
    expectedCount: 25,
  },
  {
    cardId: GREATER_OLD_CANDLESTICK_CARD_ID,
    pool: "greater" as const,
    tier: 5 as const,
    expectedCount: 41,
  },
].entries()) {
  test(`${scenario.cardId} offers an official three-card Discover from its ${scenario.expectedCount}-card pool`, () => {
    let state = createGame(0x8230 + index);
    humanPlayer(state).hand = [];
    state = acquireTrinket(state, scenario.cardId);
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover");
    assert.equal(pending.options.length, 3);
    assert.equal(
      new Set(pending.options.map((option) => option.definitionId)).size,
      3,
    );
    const eligibleIds = new Set(
      TIMEWARP_COST_TWO_MINION_DEFINITIONS[scenario.pool].map(
        (definition) => definition.id,
      ),
    );
    assert.equal(eligibleIds.size, scenario.expectedCount);
    assert.ok(
      pending.options.every(
        (option) =>
          eligibleIds.has(option.definitionId) &&
          option.tier === scenario.tier &&
          option.poolCopies === 0,
      ),
    );

    const restored = normalizePersistedGameState(
      JSON.parse(JSON.stringify(state)) as unknown,
    ) as GameState | null;
    assert.ok(restored);
    const restoredPending = restored.pendingInteraction;
    assert.ok(restoredPending?.kind === "discover");
    assert.deepEqual(
      restoredPending.options.map((option) => option.definitionId),
      pending.options.map((option) => option.definitionId),
    );

    const selected = restoredPending.options[0];
    state = gameReducer(restored, {
      type: "RESOLVE_INTERACTION",
      interactionId: restoredPending.interactionId,
      optionInstanceId: selected.instanceId,
    });
    assert.equal(state.pendingInteraction, null);
    const gained = humanPlayer(state).hand.find(
      (card) => card.kind === "minion" && card.instanceId === selected.instanceId,
    );
    assert.ok(gained);
    assert.equal(gained.definitionId, selected.definitionId);
  });
}

test("Old Candlestick burns a selected card safely at a full human hand", () => {
  let state = createGame(0x823f);
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, LESSER_OLD_CANDLESTICK_CARD_ID);
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  fillHand(state, "candlestick-full");
  const beforeIds = humanPlayer(state).hand.map((card) => card.instanceId);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.deepEqual(
    humanPlayer(state).hand.map((card) => card.instanceId),
    beforeIds,
  );
});

test("AI resolves Old Candlestick synchronously and does not overflow a full hand", () => {
  let receiving = createGame(0x823b);
  const receivingAi = humanPlayer(receiving);
  receivingAi.isHuman = false;
  receivingAi.hand = [];
  receiving = acquireTrinket(receiving, LESSER_OLD_CANDLESTICK_CARD_ID);
  assert.equal(receiving.pendingInteraction, null);
  const received = humanPlayer(receiving).hand;
  assert.equal(received.length, 1);
  assert.equal(received[0]?.kind, "minion");
  assert.ok(
    TIMEWARP_COST_TWO_MINION_DEFINITIONS.lesser.some(
      (definition) => definition.id === received[0]?.definitionId,
    ),
  );

  let state = createGame(0x823a);
  const ai = humanPlayer(state);
  ai.isHuman = false;
  fillHand(state, "candlestick-ai-full");
  const beforeIds = ai.hand.map((card) => card.instanceId);

  state = acquireTrinket(state, GREATER_OLD_CANDLESTICK_CARD_ID);
  assert.equal(state.pendingInteraction, null);
  const current = humanPlayer(state);
  assert.equal(current.hand.length, 10);
  assert.deepEqual(
    current.hand.map((card) => card.instanceId),
    beforeIds,
  );
});

test("Timewarp runtime definitions preserve printed entities and basic keywords", () => {
  const state = createGame(0x823c);
  assert.equal(TIMEWARP_COST_TWO_MINION_DEFINITIONS.lesser.length, 25);
  assert.equal(TIMEWARP_COST_TWO_MINION_DEFINITIONS.greater.length, 41);
  const shield = getMinionDefinition("BG34_Giant_068");
  assert.deepEqual(
    [shield.tier, shield.attack, shield.health, shield.divineShield],
    [3, 5, 10, true],
  );
  const windfury = getMinionDefinition("BG34_Giant_102");
  assert.deepEqual(
    [windfury.tier, windfury.attack, windfury.health, windfury.windfury],
    [5, 7, 14, true],
  );
  for (const definition of [
    ...TIMEWARP_COST_TWO_MINION_DEFINITIONS.lesser,
    ...TIMEWARP_COST_TWO_MINION_DEFINITIONS.greater,
  ]) {
    assert.equal(definition.collectible, false);
    assert.equal(definition.effectSupport, "partial");
    assert.equal(state.pool[definition.id], 0);
  }
});
