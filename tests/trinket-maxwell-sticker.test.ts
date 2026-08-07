import assert from "node:assert/strict";
import test from "node:test";

import {
  BUDDY_MINION_DEFINITIONS,
  getBuddyDefinitionIdForHeroPower,
} from "../lib/game/buddies.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { HERO_DEFINITIONS } from "../lib/game/hero-powers.ts";
import {
  getTrinketDefinition,
  trinketCanBeOfferedWithHeroPower,
  trinketsForTier,
} from "../lib/game/lobby-systems.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const LESSER_MAXWELL_CARD_ID = "BG35_MagicItem_803";
const GREATER_MAXWELL_CARD_ID = "BG35_MagicItem_803t";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function acquireTrinket(
  state: GameState,
  cardId: string,
  heroId: string | null,
  heroPowerId: string | null,
): GameState {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition);
  const player = humanPlayer(state);
  player.heroId = heroId;
  player.heroPowerId = heroPowerId;
  player.hand = [];
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `maxwell-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: `maxwell-${cardId}`,
    optionInstanceId: definition.id,
  });
}

function onlyMinionInHand(state: GameState): BoardMinionInstance {
  const minions = humanPlayer(state).hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.equal(minions.length, 1);
  return minions[0] as BoardMinionInstance;
}

test("the fixed build maps all 15 legal local Hero Powers to unique partial Buddy definitions", () => {
  assert.equal(HERO_DEFINITIONS.length, 120);
  assert.equal(BUDDY_MINION_DEFINITIONS.length, 15);
  assert.equal(
    new Set(BUDDY_MINION_DEFINITIONS.map((definition) => definition.id))
      .size,
    15,
  );
  assert.equal(
    new Set(
      BUDDY_MINION_DEFINITIONS.map(
        (definition) => definition.goldenCardId,
      ),
    ).size,
    15,
  );

  for (const hero of HERO_DEFINITIONS) {
    const buddyDefinitionId = getBuddyDefinitionIdForHeroPower(
      hero.heroPowerId,
    );
    if (buddyDefinitionId === null) continue;
    const definition = getMinionDefinition(buddyDefinitionId);
    assert.equal(definition.collectible, false, hero.id);
    assert.equal(definition.effectSupport, "partial", hero.id);
    assert.ok(definition.goldenCardId, hero.id);
  }
});

test("Maxwell candidate eligibility follows the current Hero Power and excludes missing Buddy links", () => {
  const lesser = getTrinketDefinition(
    "lesser-trinket-bg35-magicitem-803",
  );
  const greater = getTrinketDefinition(
    "greater-trinket-bg35-magicitem-803t",
  );

  for (const hero of HERO_DEFINITIONS) {
    const hasBuddy =
      getBuddyDefinitionIdForHeroPower(hero.heroPowerId) !== null;
    assert.equal(
      trinketCanBeOfferedWithHeroPower(lesser, hero.heroPowerId),
      hasBuddy,
      `${hero.id} Lesser eligibility`,
    );
    assert.equal(
      trinketCanBeOfferedWithHeroPower(greater, hero.heroPowerId),
      hasBuddy,
      `${hero.id} Greater eligibility`,
    );
    assert.equal(
      trinketsForTier("lesser", hero.heroPowerId).some(
        (definition) => definition.cardId === LESSER_MAXWELL_CARD_ID,
      ),
      hasBuddy,
      `${hero.id} Lesser pool`,
    );
    assert.equal(
      trinketsForTier("greater", hero.heroPowerId).some(
        (definition) => definition.cardId === GREATER_MAXWELL_CARD_ID,
      ),
      hasBuddy,
      `${hero.id} Greater pool`,
    );
  }

  assert.equal(trinketCanBeOfferedWithHeroPower(lesser, null), false);
  assert.equal(trinketCanBeOfferedWithHeroPower(greater, null), false);
});

const ACQUISITION_CASES = [
  {
    heroId: "hero-nozdormu",
    heroPowerId: "hero-power-see-the-future",
    cardId: LESSER_MAXWELL_CARD_ID,
    definitionId: "TB_BaconShop_HERO_57_Buddy",
    expectedCardId: "TB_BaconShop_HERO_57_Buddy",
    attack: 6,
    health: 6,
    tribe: "neutral",
    divineShield: false,
    golden: false,
  },
  {
    heroId: "hero-capn-hoggarr",
    heroPowerId: "hero-power-yo-ho-ogre",
    cardId: LESSER_MAXWELL_CARD_ID,
    definitionId: "BG26_HERO_101_Buddy",
    expectedCardId: "BG26_HERO_101_Buddy",
    attack: 4,
    health: 5,
    tribe: "pirate",
    divineShield: true,
    golden: false,
  },
  {
    heroId: "hero-ysera",
    heroPowerId: "hero-power-dream-portal",
    cardId: GREATER_MAXWELL_CARD_ID,
    definitionId: "TB_BaconShop_HERO_53_Buddy",
    expectedCardId: "TB_BaconShop_HERO_53_Buddy_G",
    attack: 12,
    health: 8,
    tribe: "dragon",
    divineShield: false,
    golden: true,
  },
  {
    heroId: "hero-kaelthas-sunstrider",
    heroPowerId: "hero-power-verdant-spheres",
    cardId: GREATER_MAXWELL_CARD_ID,
    definitionId: "TB_BaconShop_HERO_60_Buddy",
    expectedCardId: "TB_BaconShop_HERO_60_Buddy_G",
    attack: 6,
    health: 6,
    tribe: "neutral",
    divineShield: true,
    golden: true,
  },
] as const;

for (const [index, scenario] of ACQUISITION_CASES.entries()) {
  test(`Maxwell grants the correct ${scenario.golden ? "Golden " : ""}Buddy for ${scenario.heroId}`, () => {
    const state = acquireTrinket(
      createGame(0x8030 + index),
      scenario.cardId,
      scenario.heroId,
      scenario.heroPowerId,
    );
    const buddy = onlyMinionInHand(state);
    assert.equal(buddy.definitionId, scenario.definitionId);
    assert.equal(buddy.cardId, scenario.expectedCardId);
    assert.equal(buddy.attack, scenario.attack);
    assert.equal(buddy.health, scenario.health);
    assert.equal(buddy.tribe, scenario.tribe);
    assert.equal(buddy.divineShield, scenario.divineShield);
    assert.equal(buddy.golden, scenario.golden);
    assert.equal(buddy.grantsTripleReward, false);
    assert.equal(buddy.effectSupport, "partial");
    assert.equal(buddy.poolCopies, 0);
  });
}

test("Maxwell follows a replaced current Hero Power instead of stale Hero identity", () => {
  const state = acquireTrinket(
    createGame(0x803e),
    LESSER_MAXWELL_CARD_ID,
    "hero-nozdormu",
    "hero-power-avalanche",
  );
  const buddy = onlyMinionInHand(state);
  assert.equal(buddy.definitionId, "TB_BaconShop_HERO_78_Buddy");
  assert.equal(buddy.cardId, "TB_BaconShop_HERO_78_Buddy");
  assert.deepEqual(buddy.tribes, ["elemental"]);
});

test("a forced no-Hero Maxwell acquisition safely grants nothing and survives save normalization", () => {
  const state = acquireTrinket(
    createGame(0x803f),
    LESSER_MAXWELL_CARD_ID,
    null,
    null,
  );
  assert.equal(humanPlayer(state).hand.length, 0);
  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  assert.equal(humanPlayer(restored).hand.length, 0);
});
