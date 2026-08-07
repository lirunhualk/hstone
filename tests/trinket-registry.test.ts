import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  TRINKET_DEFINITIONS,
  trinketsForTier,
} from "../lib/game/lobby-systems.ts";
import {
  HERO_DEFINITIONS,
  heroPowerCanBeManuallyActivated,
} from "../lib/game/hero-powers.ts";
import { getBuddyDefinitionIdForHeroPower } from "../lib/game/buddies.ts";

const LOCAL_TRIBES = new Set([
  "beast",
  "mech",
  "demon",
  "murloc",
  "dragon",
  "pirate",
  "elemental",
  "naga",
  "quilboar",
  "undead",
  "all",
  "neutral",
]);

const REMOVED_CARD_IDS = new Set([
  "BG30_MagicItem_414",
  "BG30_MagicItem_414t",
  "BG30_MagicItem_986",
  "BG32_MagicItem_700",
]);

test("registers the complete active Solo Trinket pool", () => {
  assert.equal(ACTIVE_TRINKET_DEFINITIONS.length, 204);
  assert.equal(
    ACTIVE_TRINKET_DEFINITIONS.filter(
      (definition) => definition.tier === "lesser",
    ).length,
    98,
  );
  assert.equal(
    ACTIVE_TRINKET_DEFINITIONS.filter(
      (definition) => definition.tier === "greater",
    ).length,
    106,
  );
  assert.ok(ACTIVE_TRINKET_DEFINITIONS.every((definition) => definition.inPool));
});

test("keeps exactly four removed definitions for old-save lookup", () => {
  assert.equal(TRINKET_DEFINITIONS.length, 208);
  const removed = TRINKET_DEFINITIONS.filter((definition) => !definition.inPool);
  assert.equal(removed.length, 4);
  assert.deepEqual(
    new Set(removed.map((definition) => definition.cardId)),
    REMOVED_CARD_IDS,
  );
});

test("keeps definition ids and CardIDs unique across active and legacy data", () => {
  for (const field of ["id", "cardId"] as const) {
    const values = TRINKET_DEFINITIONS.map((definition) => definition[field]);
    assert.equal(
      new Set(values).size,
      values.length,
      `${field} must be unique`,
    );
  }
});

test("tier pools contain only active definitions and never legacy removals", () => {
  const lesser = trinketsForTier("lesser");
  const greater = trinketsForTier("greater");

  assert.equal(lesser.length, 98);
  assert.equal(greater.length, 106);
  for (const definition of [...lesser, ...greater]) {
    assert.equal(definition.inPool, true);
    assert.equal(REMOVED_CARD_IDS.has(definition.cardId), false);
  }
  assert.ok(lesser.every((definition) => definition.tier === "lesser"));
  assert.ok(greater.every((definition) => definition.tier === "greater"));
});

test("Hero-specific Lesser filters exclude Sous Chef and unavailable Buddies", () => {
  assert.equal(HERO_DEFINITIONS.length, 120);

  for (const hero of HERO_DEFINITIONS) {
    const candidates = trinketsForTier("lesser", hero.heroPowerId);
    const hasBuddy = getBuddyDefinitionIdForHeroPower(hero.heroPowerId) !== null;
    // Sous Chef label is offered to heroes with activatable powers
    const hasActivatablePower = heroPowerCanBeManuallyActivated(hero.heroPowerId);
    assert.equal(
      candidates.some(
        (definition) => definition.cardId === "BG35_MagicItem_801",
      ),
      hasActivatablePower,
      hero.id,
    );
    // Maxwell sticker only offered to heroes with buddies
    assert.equal(
      candidates.some(
        (definition) => definition.cardId === "BG35_MagicItem_803",
      ),
      hasBuddy,
      hero.id,
    );
  }
});

test("maps every source association to a local Tribe value", () => {
  for (const definition of TRINKET_DEFINITIONS) {
    for (const tribe of definition.associatedTribes) {
      assert.equal(
        LOCAL_TRIBES.has(tribe),
        true,
        `${definition.cardId} has unknown local Tribe ${tribe}`,
      );
    }
  }
  assert.equal(
    ACTIVE_TRINKET_DEFINITIONS.filter(
      (definition) =>
        definition.tier === "lesser" &&
        definition.associatedTribes.length > 0,
    ).length,
    62,
  );
  assert.equal(
    ACTIVE_TRINKET_DEFINITIONS.filter(
      (definition) =>
        definition.tier === "greater" &&
        definition.associatedTribes.length > 0,
    ).length,
    82,
  );
});

test("preserves the four active save-compatible local ids", () => {
  const expectedIds = {
    BG30_MagicItem_435: "lesser-trinket-goldenizer-supply",
    BG30_MagicItem_705: "lesser-trinket-oilcan",
    BG30_MagicItem_847: "lesser-trinket-goblin-wallet",
    BG30_MagicItem_996: "greater-trinket-bobs-tip-jar",
  } as const;

  for (const [cardId, expectedId] of Object.entries(expectedIds)) {
    const definition = ACTIVE_TRINKET_DEFINITIONS.find(
      (candidate) => candidate.cardId === cardId,
    );
    assert.ok(definition, `${cardId} must remain in the active pool`);
    assert.equal(definition.id, expectedId);
  }
});
