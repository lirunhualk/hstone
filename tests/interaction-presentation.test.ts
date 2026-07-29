import assert from "node:assert/strict";
import test from "node:test";
import { interactionRequiresModalBackdrop } from "../lib/game/interaction-presentation.ts";
import type { PendingInteraction } from "../lib/game/types.ts";

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
