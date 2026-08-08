import assert from "node:assert/strict";
import test from "node:test";

import {
  createTrinketChoicePresentation,
  transitionTrinketChoicePresentation,
  trinketChoicePresentationDuration,
  type TrinketChoicePresentationState,
} from "../lib/game/trinket-choice-presentation.ts";

const OPTION_IDS = ["trinket-a", "trinket-b", "trinket-c", "trinket-d"];

function revealFixture(): TrinketChoicePresentationState {
  const presentation = createTrinketChoicePresentation({
    interactionId: "trinket-choice-17",
    optionIds: OPTION_IDS,
  });
  assert.ok(presentation);
  return presentation;
}

function advance(
  presentation: TrinketChoicePresentationState,
): TrinketChoicePresentationState | null {
  return transitionTrinketChoicePresentation(presentation, {
    type: "advance",
    expectedInteractionId: presentation.interactionId,
    expectedStage: presentation.stage,
    expectedRevision: presentation.revision,
  });
}

function choose(
  presentation: TrinketChoicePresentationState,
  optionId = "trinket-b",
): TrinketChoicePresentationState {
  const choosing =
    presentation.stage === "choosing" ? presentation : advance(presentation);
  assert.ok(choosing);
  const selected = transitionTrinketChoicePresentation(choosing, {
    type: "select",
    expectedInteractionId: choosing.interactionId,
    optionId,
  });
  assert.ok(selected);
  return selected;
}

test("regular and Mystery Cube offers create detached immutable reveal snapshots", () => {
  const optionIds = [...OPTION_IDS];
  const regular = createTrinketChoicePresentation({
    interactionId: "regular-choice",
    optionIds,
  });
  assert.deepEqual(regular, {
    interactionId: "regular-choice",
    optionIds: OPTION_IDS,
    selectedOptionId: null,
    hidden: false,
    paidCost: null,
    goldBefore: null,
    goldAfter: null,
    stage: "reveal",
    revision: 0,
  });
  assert.ok(regular);
  assert.equal(Object.isFrozen(regular), true);
  assert.equal(Object.isFrozen(regular.optionIds), true);
  optionIds[0] = "mutated-source";
  assert.equal(regular.optionIds[0], "trinket-a");

  const mysteryCube = createTrinketChoicePresentation({
    interactionId: "mystery-cube-choice",
    optionIds: ["replacement-a", "replacement-b"],
  });
  assert.ok(mysteryCube);
  assert.deepEqual(mysteryCube.optionIds, ["replacement-a", "replacement-b"]);
});

test("creation rejects malformed candidate snapshots", () => {
  const create = (interactionId: string, optionIds: readonly string[]) =>
    createTrinketChoicePresentation({ interactionId, optionIds });

  assert.equal(create("", OPTION_IDS), null);
  assert.equal(create(" padded ", OPTION_IDS), null);
  assert.equal(create("choice", []), null);
  assert.equal(create("choice", OPTION_IDS.slice(0, 1)), null);
  assert.equal(create("choice", OPTION_IDS.slice(0, 3)), null);
  assert.equal(create("choice", [...OPTION_IDS, "trinket-e"]), null);
  assert.equal(
    create("choice", ["trinket-a", "trinket-a", "trinket-c", "trinket-d"]),
    null,
  );
  assert.equal(
    create("choice", ["trinket-a", "", "trinket-c", "trinket-d"]),
    null,
  );
});

test("selection and hide/show preserve the authoritative offer until confirmation", () => {
  const choosing = advance(revealFixture());
  assert.ok(choosing);
  assert.equal(choosing.stage, "choosing");

  const selected = choose(choosing);
  assert.equal(selected.selectedOptionId, "trinket-b");
  assert.equal(selected.stage, "choosing");
  assert.deepEqual(selected.optionIds, OPTION_IDS);

  const hidden = transitionTrinketChoicePresentation(selected, {
    type: "toggleVisibility",
    expectedInteractionId: selected.interactionId,
  });
  assert.ok(hidden);
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.selectedOptionId, "trinket-b");
  assert.deepEqual(hidden.optionIds, OPTION_IDS);

  const shown = transitionTrinketChoicePresentation(hidden, {
    type: "toggleVisibility",
    expectedInteractionId: hidden.interactionId,
  });
  assert.ok(shown);
  assert.equal(shown.hidden, false);
  assert.equal(shown.selectedOptionId, "trinket-b");
  assert.deepEqual(shown.optionIds, OPTION_IDS);
});

test("only an accepted confirmation of the current selection starts the handoff", () => {
  const selected = choose(revealFixture());
  const confirm = (
    overrides: Partial<
      Extract<
        Parameters<typeof transitionTrinketChoicePresentation>[1],
        { type: "confirm" }
      >
    > = {},
  ) =>
    transitionTrinketChoicePresentation(selected, {
      type: "confirm",
      expectedInteractionId: selected.interactionId,
      selectedOptionId: "trinket-b",
      accepted: true,
      paidCost: 3,
      goldBefore: 8,
      goldAfter: 5,
      ...overrides,
    });

  assert.equal(confirm({ accepted: false }), selected);
  assert.equal(confirm({ selectedOptionId: "trinket-c" }), selected);
  assert.equal(confirm({ selectedOptionId: "not-offered" }), selected);
  assert.equal(confirm({ paidCost: -1 }), selected);
  assert.equal(confirm({ paidCost: 9 }), selected);
  assert.equal(confirm({ goldAfter: -1 }), selected);

  const confirmed = confirm();
  assert.ok(confirmed);
  assert.equal(confirmed.stage, "confirmFocus");
  assert.equal(confirmed.selectedOptionId, "trinket-b");
  assert.equal(confirmed.paidCost, 3);
  assert.equal(confirmed.goldBefore, 8);
  assert.equal(confirmed.goldAfter, 5);
  assert.equal(confirmed.hidden, false);
});

test("accepted choices run focus then effect handoff and complete", () => {
  const selected = choose(revealFixture());
  const confirmed = transitionTrinketChoicePresentation(selected, {
    type: "confirm",
    expectedInteractionId: selected.interactionId,
    selectedOptionId: "trinket-b",
    accepted: true,
    paidCost: 0,
    goldBefore: 4,
    goldAfter: 4,
  });
  assert.ok(confirmed);
  assert.equal(confirmed.stage, "confirmFocus");

  const handoff = advance(confirmed);
  assert.ok(handoff);
  assert.equal(handoff.stage, "effectHandoff");
  assert.equal(handoff.selectedOptionId, "trinket-b");
  assert.equal(advance(handoff), null);
});

test("interaction, stage, and revision guards make stale events harmless", () => {
  const reveal = revealFixture();
  assert.equal(
    transitionTrinketChoicePresentation(reveal, {
      type: "advance",
      expectedInteractionId: "older-choice",
      expectedStage: "reveal",
      expectedRevision: 0,
    }),
    reveal,
  );
  assert.equal(
    transitionTrinketChoicePresentation(reveal, {
      type: "advance",
      expectedInteractionId: reveal.interactionId,
      expectedStage: "confirmFocus",
      expectedRevision: 0,
    }),
    reveal,
  );
  assert.equal(
    transitionTrinketChoicePresentation(reveal, {
      type: "advance",
      expectedInteractionId: reveal.interactionId,
      expectedStage: "reveal",
      expectedRevision: 1,
    }),
    reveal,
  );

  const choosing = advance(reveal);
  assert.ok(choosing);
  assert.equal(advance(choosing), choosing);
  assert.equal(
    transitionTrinketChoicePresentation(choosing, {
      type: "select",
      expectedInteractionId: "older-choice",
      optionId: "trinket-a",
    }),
    choosing,
  );
});

test("skip bypasses reveal or an accepted animation without resolving a choice", () => {
  const reveal = revealFixture();
  const choosing = transitionTrinketChoicePresentation(reveal, {
    type: "skip",
    expectedInteractionId: reveal.interactionId,
  });
  assert.ok(choosing);
  assert.equal(choosing.stage, "choosing");
  assert.equal(choosing.selectedOptionId, null);
  assert.equal(
    transitionTrinketChoicePresentation(choosing, {
      type: "skip",
      expectedInteractionId: choosing.interactionId,
    }),
    choosing,
  );

  const selected = choose(choosing);
  const confirmed = transitionTrinketChoicePresentation(selected, {
    type: "confirm",
    expectedInteractionId: selected.interactionId,
    selectedOptionId: "trinket-b",
    accepted: true,
    paidCost: 2,
    goldBefore: 7,
    goldAfter: 5,
  });
  assert.ok(confirmed);
  assert.equal(
    transitionTrinketChoicePresentation(confirmed, {
      type: "skip",
      expectedInteractionId: "older-choice",
    }),
    confirmed,
  );
  assert.equal(
    transitionTrinketChoicePresentation(confirmed, {
      type: "skip",
      expectedInteractionId: confirmed.interactionId,
    }),
    null,
  );
});

test("normal and reduced-motion durations are exact and choosing has no timer", () => {
  assert.equal(trinketChoicePresentationDuration("reveal"), 720);
  assert.equal(trinketChoicePresentationDuration("choosing"), null);
  assert.equal(trinketChoicePresentationDuration("confirmFocus"), 650);
  assert.equal(trinketChoicePresentationDuration("effectHandoff"), 420);
  assert.equal(trinketChoicePresentationDuration("reveal", true), 80);
  assert.equal(trinketChoicePresentationDuration("choosing", true), null);
  assert.equal(trinketChoicePresentationDuration("confirmFocus", true), 80);
  assert.equal(trinketChoicePresentationDuration("effectHandoff", true), 80);
});
