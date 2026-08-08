import assert from "node:assert/strict";
import test from "node:test";

import {
  combatEntryStageDuration,
  createCombatEntryPresentation,
  transitionCombatEntryPresentation,
  type CombatEntryPresentationState,
  type CombatEntryStage,
} from "../lib/game/combat-entry-presentation.ts";

function presentationFixture(
  battleKey = '[4,"human","ai-1",false]',
): CombatEntryPresentationState {
  const presentation = createCombatEntryPresentation(battleKey);
  assert.ok(presentation);
  return presentation;
}

test("combat entry requires a non-empty battle key", () => {
  assert.equal(createCombatEntryPresentation(""), null);
  assert.equal(createCombatEntryPresentation("   "), null);
  assert.deepEqual(createCombatEntryPresentation("battle-4"), {
    battleKey: "battle-4",
    stage: "versusReveal",
    revision: 0,
  });
});

test("combat entry advances through every presentation stage in order", () => {
  const expectedStages: readonly CombatEntryStage[] = [
    "versusReveal",
    "warbandReveal",
    "battleReady",
    "complete",
  ];
  let presentation = presentationFixture();
  assert.equal(presentation.stage, expectedStages[0]);

  for (const expectedStage of expectedStages.slice(1)) {
    const previous = presentation;
    const transitioned = transitionCombatEntryPresentation(previous, {
      type: "advance",
      expectedBattleKey: previous.battleKey,
      expectedStage: previous.stage,
      expectedRevision: previous.revision,
    });
    assert.ok(transitioned);
    presentation = transitioned;
    assert.equal(presentation.stage, expectedStage);
    assert.equal(presentation.revision, previous.revision + 1);
  }

  const complete = presentation;
  assert.equal(
    transitionCombatEntryPresentation(complete, {
      type: "advance",
      expectedBattleKey: complete.battleKey,
      expectedStage: complete.stage,
      expectedRevision: complete.revision,
    }),
    complete,
  );
});

test("battle key, stage, and revision make stale advances harmless", () => {
  const presentation = presentationFixture();
  assert.equal(
    transitionCombatEntryPresentation(presentation, {
      type: "advance",
      expectedBattleKey: "older-battle",
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    presentation,
  );
  assert.equal(
    transitionCombatEntryPresentation(presentation, {
      type: "advance",
      expectedBattleKey: presentation.battleKey,
      expectedStage: "warbandReveal",
      expectedRevision: presentation.revision,
    }),
    presentation,
  );
  assert.equal(
    transitionCombatEntryPresentation(presentation, {
      type: "advance",
      expectedBattleKey: presentation.battleKey,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision + 1,
    }),
    presentation,
  );
  assert.equal(
    transitionCombatEntryPresentation(null, {
      type: "advance",
      expectedBattleKey: presentation.battleKey,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    null,
  );
});

test("skip is battle-key guarded and idempotently completes the entry", () => {
  const presentation = presentationFixture();
  assert.equal(
    transitionCombatEntryPresentation(presentation, {
      type: "skip",
      expectedBattleKey: "older-battle",
    }),
    presentation,
  );

  const skipped = transitionCombatEntryPresentation(presentation, {
    type: "skip",
    expectedBattleKey: presentation.battleKey,
  });
  assert.ok(skipped);
  assert.equal(skipped.stage, "complete");
  assert.equal(skipped.revision, presentation.revision + 1);
  assert.equal(
    transitionCombatEntryPresentation(skipped, {
      type: "skip",
      expectedBattleKey: skipped.battleKey,
    }),
    skipped,
  );
  assert.equal(
    transitionCombatEntryPresentation(null, {
      type: "skip",
      expectedBattleKey: presentation.battleKey,
    }),
    null,
  );
});

test("reduced-motion timings preserve every stage without a long wait", () => {
  const activeStages: readonly CombatEntryStage[] = [
    "versusReveal",
    "warbandReveal",
    "battleReady",
  ];
  assert.deepEqual(
    activeStages.map((stage) => combatEntryStageDuration(stage)),
    [1_300, 1_700, 500],
  );
  assert.deepEqual(
    activeStages.map((stage) => combatEntryStageDuration(stage, true)),
    [80, 120, 80],
  );

  const normalTotal = activeStages.reduce(
    (total, stage) => total + combatEntryStageDuration(stage),
    0,
  );
  const reducedTotal = activeStages.reduce(
    (total, stage) => total + combatEntryStageDuration(stage, true),
    0,
  );
  assert.equal(normalTotal, 3_500);
  assert.equal(reducedTotal, 280);
  assert.equal(combatEntryStageDuration("complete"), 0);
  assert.equal(combatEntryStageDuration("complete", true), 0);
});
