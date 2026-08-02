import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { interactionRequiresModalBackdrop } from "../lib/game/interaction-presentation.ts";
import type { PendingInteraction } from "../lib/game/types.ts";

const GAME_CLIENT_SOURCE = readFileSync(
  new URL("../app/GameClient.tsx", import.meta.url),
  "utf8",
).replace(/\s+/gu, " ");
const CARD_ART_SYNC_SOURCE = readFileSync(
  new URL("../scripts/sync-card-art.mjs", import.meta.url),
  "utf8",
);

function interaction(kind: PendingInteraction["kind"]): PendingInteraction {
  return {
    kind,
    interactionId: 1,
    playerId: "player-0",
    sourceInstanceId: "source",
  } as unknown as PendingInteraction;
}

test("only full-screen choices make the recruit board inert", () => {
  assert.equal(interactionRequiresModalBackdrop(null), false);
  assert.equal(
    interactionRequiresModalBackdrop(interaction("target")),
    false,
  );
  assert.equal(
    interactionRequiresModalBackdrop(interaction("magnetizeTarget")),
    false,
  );
  for (const kind of [
    "discover",
    "tavernSpellChoice",
    "spellcraftChoice",
    "heroPowerChoice",
  ] as const) {
    assert.equal(
      interactionRequiresModalBackdrop(interaction(kind)),
      true,
      kind,
    );
  }
});

test("Budding Botanist validates normal and Golden choice token CardIDs", () => {
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'const botanistNormalOptions = Array.isArray(value.optionIds) && value.optionIds.length === 2 && value.optionIds[0] === "BG32_237t" && value.optionIds[1] === "BG32_237t2" && value.effectMultiplier === 1;',
    ),
  );
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'const botanistGoldenOptions = Array.isArray(value.optionIds) && value.optionIds.length === 2 && value.optionIds[0] === "BG32_237_Gt" && value.optionIds[1] === "BG32_237_Gt2" && value.effectMultiplier === 2;',
    ),
  );
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      "cardId: minionChoiceInteraction.optionIds[0]",
    ),
  );
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      "cardId: minionChoiceInteraction.optionIds[1]",
    ),
  );
});

test("Budding Botanist exposes distinct attack and health choice controls", () => {
  assert.ok(GAME_CLIENT_SOURCE.includes('"budding-botanist-dialog"'));
  assert.ok(GAME_CLIENT_SOURCE.includes('"budding-botanist-attack"'));
  assert.ok(GAME_CLIENT_SOURCE.includes('"budding-botanist-health"'));
});

test("generated targeted spells use ordinary spell labels instead of Spellcraft labels", () => {
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'card.spellFamily === "generated" ? "拖到友方随从上施放" : "拖到友方随从上塑造"',
    ),
  );
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'card.spellFamily === "generated" ? "法术" : "塑造法术"',
    ),
  );
});

test("generated spell details stay in hand while only Spellcraft expires", () => {
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'selectedSpellcraft.spellFamily === "spellcraft" ? " · 回合结束时未使用会消失" : " · 可以保留在手牌中"',
    ),
  );
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'selectedSpellcraft.spellFamily === "spellcraft" ? ( <span>回合结束消失</span> ) : ( <span>不会在回合结束时消失</span> )',
    ),
  );
});

test("spell target presentation follows the selected spell source family", () => {
  assert.ok(
    GAME_CLIENT_SOURCE.includes(
      'const activeSpellTargetKind = spellcraftSourceForTargets !== null ? spellcraftSourceForTargets.spellFamily : tavernSpellSourceForTargets !== null ? "tavernSpell" : undefined;',
    ),
  );
});

test("card art sync includes generated spells and every Botanist choice", () => {
  assert.ok(
    CARD_ART_SYNC_SOURCE.includes(
      "GENERATED_TARGETED_SPELL_DEFINITIONS",
    ),
  );
  for (const cardId of [
    "BG32_237t",
    "BG32_237t2",
    "BG32_237_Gt",
    "BG32_237_Gt2",
  ]) {
    assert.ok(CARD_ART_SYNC_SOURCE.includes(`\"${cardId}\"`), cardId);
  }
});
