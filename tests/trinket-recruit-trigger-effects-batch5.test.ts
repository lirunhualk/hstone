import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getTrinketDefinition,
  minionHasTribe,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
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

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function gameWithTrinket(cardId: string, seed: number) {
  const state = createGame(seed);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const trinket = trinketForCard(cardId);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  player.gold = 100;
  state.pendingInteraction = null;
  return { state, player, template, trinket };
}

function tavernOfferTiers(player: PlayerState): number[] {
  return [
    ...player.shop.map((card) => card.tier),
    ...(player.spellShop ? [player.spellShop.tier] : []),
    ...player.additionalSpellShop.map((card) => card.tier),
  ];
}

test("greater Colorful Compass grants two matching minions now and each turn", () => {
  let state = createGame(0xe501);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [definitionMinion(template, "BG22_202", "compass-murloc")];
  player.hand = [];

  state = acquireTrinketByCardId(state, "BG30_MagicItem_426t");
  assert.equal(humanPlayer(state).hand.length, 2);
  assert.ok(
    humanPlayer(state).hand.every(
      (card) => card.kind === "minion" && minionHasTribe(card, "murloc"),
    ),
  );

  humanPlayer(state).hand = [];
  state = continueThroughCombat(state);
  assert.equal(humanPlayer(state).hand.length, 2);
  assert.ok(
    humanPlayer(state).hand.every(
      (card) => card.kind === "minion" && minionHasTribe(card, "murloc"),
    ),
  );
});

for (const [cardId, tier, minimumGoldAfterAcquire] of [
  ["BG35_MagicItem_816", "lesser", 100],
  ["BG35_MagicItem_816t", "greater", 104],
] as const) {
  test(`${cardId} grants a distinct additional ${tier} Trinket for free`, () => {
    let state = createGame(cardId.endsWith("t") ? 0xe503 : 0xe502);
    const player = humanPlayer(state);
    player.board = [];
    player.hand = [];

    state = acquireTrinketByCardId(state, cardId);
    const nextPlayer = humanPlayer(state);
    const owned = nextPlayer.trinketIds.map(getTrinketDefinition);
    assert.equal(owned.length, 2);
    assert.equal(new Set(nextPlayer.trinketIds).size, 2);
    assert.ok(owned.every((definition) => definition.tier === tier));
    assert.ok(owned.some((definition) => definition.cardId === cardId));
    assert.ok(
      owned
        .filter((definition) => definition.cardId !== cardId)
        .every((definition) => definition.associatedTribes.length === 0),
      "an empty warband can only roll neutral additional Trinkets",
    );
    assert.ok(nextPlayer.gold >= minimumGoldAfterAcquire);
    assert.deepEqual(
      Object.keys(nextPlayer.trinketCounters).sort(),
      [...nextPlayer.trinketIds].sort(),
    );

    nextPlayer.gold = Math.min(nextPlayer.gold, nextPlayer.maxGold);
    state.pendingInteraction = null;
    const restored = normalizePersistedGameState(
      JSON.parse(JSON.stringify(state)) as unknown,
    ) as GameState | null;
    assert.ok(restored, "same-tier Orb rewards must survive save validation");
    assert.deepEqual(
      humanPlayer(restored).trinketIds,
      nextPlayer.trinketIds,
    );
  });
}

test("Guiding Candle makes exactly the first two Refreshes each turn Tier 6", () => {
  const prepared = gameWithTrinket("BG32_MagicItem_366", 0xe504);
  let state = prepared.state;

  for (let refresh = 0; refresh < 2; refresh += 1) {
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    const tiers = tavernOfferTiers(humanPlayer(state));
    assert.ok(tiers.length > 0);
    assert.ok(tiers.every((tier) => tier === 6));
  }
  assert.equal(
    humanPlayer(state).trinketCounters[prepared.trinket.id],
    2,
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.ok(tavernOfferTiers(humanPlayer(state)).some((tier) => tier < 6));

  state = continueThroughCombat(state);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  const nextTurnTiers = tavernOfferTiers(humanPlayer(state));
  assert.ok(nextTurnTiers.length > 0);
  assert.ok(nextTurnTiers.every((tier) => tier === 6));
  assert.equal(
    humanPlayer(state).trinketCounters[prepared.trinket.id],
    1,
  );
});

test("Accord-o-Tron Portrait magnetizes onto the distinct edge Mechs", () => {
  const { state, player, template } = gameWithTrinket(
    "BG35_MagicItem_742",
    0xe505,
  );
  const left = definitionMinion(template, "BG29_611", "left-mech");
  const middle = definitionMinion(template, "BG22_202", "middle-murloc");
  const right = definitionMinion(template, "BG29_611", "right-mech");
  const before = new Map(
    [left, middle, right].map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  player.board = [left, middle, right];

  const recruit = continueThroughCombat(state);
  const nextPlayer = humanPlayer(recruit);
  for (const instanceId of [left.instanceId, right.instanceId]) {
    const target = nextPlayer.board.find(
      (minion) => minion.instanceId === instanceId,
    );
    const original = before.get(instanceId);
    assert.ok(target && original);
    assert.equal(target.attack, original.attack + 3);
    assert.equal(target.health, original.health + 3);
    assert.deepEqual(
      target.attachments.map((attachment) => attachment.definitionId),
      ["BG26_147"],
    );
  }
  const nextMiddle = nextPlayer.board.find(
    (minion) => minion.instanceId === middle.instanceId,
  );
  const originalMiddle = before.get(middle.instanceId);
  assert.ok(nextMiddle && originalMiddle);
  assert.equal(nextMiddle.attack, originalMiddle.attack);
  assert.equal(nextMiddle.health, originalMiddle.health);
  assert.equal(nextPlayer.gold, 6, "both attached Accord-o-Trons trigger");
});

test("Accord-o-Tron Portrait does not double-attach when one Mech is both edges", () => {
  const { state, player, template } = gameWithTrinket(
    "BG35_MagicItem_742",
    0xe506,
  );
  const onlyMech = definitionMinion(template, "BG29_611", "only-mech");
  player.board = [onlyMech];

  const combat = gameReducer(state, { type: "END_TURN" });
  const target = humanPlayer(combat).board[0];
  assert.ok(target);
  assert.equal(target.attachments.length, 1);
  assert.equal(target.attachments[0]?.definitionId, "BG26_147");
});
