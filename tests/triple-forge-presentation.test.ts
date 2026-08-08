import assert from "node:assert/strict";
import test from "node:test";

import {
  createTripleForgePresentation,
  transitionTripleForgePresentation,
  tripleForgePresentationDuration,
  tripleForgeStageAnnouncement,
  type TripleForgePresentationAction,
  type TripleForgePresentationState,
} from "../lib/game/triple-forge-presentation.ts";

function forgeFixture(): TripleForgePresentationState {
  const presentation = createTripleForgePresentation({
    token: 17,
    goldenInstanceId: "golden-minion-17",
  });
  assert.ok(presentation);
  return presentation;
}

function advance(
  presentation: TripleForgePresentationState,
): TripleForgePresentationState | null {
  return transitionTripleForgePresentation(presentation, {
    type: "advance",
    expectedToken: presentation.token,
    expectedGoldenInstanceId: presentation.goldenInstanceId,
    expectedStage: presentation.stage,
    expectedRevision: presentation.revision,
  });
}

test("creation validates identity and returns an immutable snapshot", () => {
  const presentation = forgeFixture();
  assert.deepEqual(presentation, {
    token: 17,
    goldenInstanceId: "golden-minion-17",
    stage: "acquireHandoff",
    revision: 0,
  });
  assert.equal(Object.isFrozen(presentation), true);
  assert.throws(() => {
    (presentation as { stage: string }).stage = "forgeImpact";
  }, TypeError);

  const create = (
    token: number,
    goldenInstanceId: string,
  ) => createTripleForgePresentation({ token, goldenInstanceId });
  assert.equal(create(0, "golden"), null);
  assert.equal(create(-1, "golden"), null);
  assert.equal(create(1.5, "golden"), null);
  assert.equal(create(Number.NaN, "golden"), null);
  assert.equal(create(Number.POSITIVE_INFINITY, "golden"), null);
  assert.equal(create(1, ""), null);
  assert.equal(create(1, " "), null);
  assert.equal(create(1, " padded "), null);
  assert.equal(createTripleForgePresentation(null as never), null);
});

test("advance follows the complete forge chain without mutating prior stages", () => {
  const acquireHandoff = forgeFixture();
  const forgeImpact = advance(acquireHandoff);
  assert.ok(forgeImpact);
  assert.equal(forgeImpact.stage, "forgeImpact");
  assert.equal(forgeImpact.revision, 1);
  assert.equal(Object.isFrozen(forgeImpact), true);
  assert.equal(acquireHandoff.stage, "acquireHandoff");
  assert.equal(acquireHandoff.revision, 0);

  const goldenReveal = advance(forgeImpact);
  assert.ok(goldenReveal);
  assert.equal(goldenReveal.stage, "goldenReveal");
  assert.equal(goldenReveal.revision, 2);
  assert.equal(goldenReveal.goldenInstanceId, "golden-minion-17");

  const handArrival = advance(goldenReveal);
  assert.ok(handArrival);
  assert.equal(handArrival.stage, "handArrival");
  assert.equal(handArrival.revision, 3);
  assert.equal(advance(handArrival), null);
});

test("stale and malformed transitions return the exact current object", () => {
  const presentation = forgeFixture();
  const transition = (
    overrides: Partial<Extract<TripleForgePresentationAction, { type: "advance" }>>,
  ) =>
    transitionTripleForgePresentation(presentation, {
      type: "advance",
      expectedToken: presentation.token,
      expectedGoldenInstanceId: presentation.goldenInstanceId,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
      ...overrides,
    });

  assert.equal(transition({ expectedToken: 16 }), presentation);
  assert.equal(
    transition({ expectedGoldenInstanceId: "older-golden" }),
    presentation,
  );
  assert.equal(transition({ expectedStage: "forgeImpact" }), presentation);
  assert.equal(transition({ expectedRevision: 1 }), presentation);
  assert.equal(transition({ expectedToken: 0 }), presentation);
  assert.equal(transition({ expectedGoldenInstanceId: "" }), presentation);
  assert.equal(
    transition({ expectedStage: "invalid" as never }),
    presentation,
  );
  assert.equal(transition({ expectedRevision: -1 }), presentation);
  assert.equal(
    transitionTripleForgePresentation(
      presentation,
      { type: "malformed" } as never,
    ),
    presentation,
  );
  assert.equal(
    transitionTripleForgePresentation(null, {
      type: "advance",
      expectedToken: presentation.token,
      expectedGoldenInstanceId: presentation.goldenInstanceId,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    null,
  );

  const malformedState = {
    ...presentation,
    revision: -1,
  } as TripleForgePresentationState;
  assert.equal(
    transitionTripleForgePresentation(malformedState, {
      type: "skip",
      expectedToken: malformedState.token,
      expectedGoldenInstanceId: malformedState.goldenInstanceId,
    }),
    malformedState,
  );
});

test("skip completes only a matching forge, including hand arrival", () => {
  const presentation = forgeFixture();
  assert.equal(
    transitionTripleForgePresentation(presentation, {
      type: "skip",
      expectedToken: 16,
      expectedGoldenInstanceId: presentation.goldenInstanceId,
    }),
    presentation,
  );
  assert.equal(
    transitionTripleForgePresentation(presentation, {
      type: "skip",
      expectedToken: presentation.token,
      expectedGoldenInstanceId: "older-golden",
    }),
    presentation,
  );
  assert.equal(
    transitionTripleForgePresentation(presentation, {
      type: "skip",
      expectedToken: 0,
      expectedGoldenInstanceId: presentation.goldenInstanceId,
    }),
    presentation,
  );
  assert.equal(
    transitionTripleForgePresentation(presentation, {
      type: "skip",
      expectedToken: presentation.token,
      expectedGoldenInstanceId: presentation.goldenInstanceId,
    }),
    null,
  );

  const forgeImpact = advance(presentation);
  assert.ok(forgeImpact);
  const goldenReveal = advance(forgeImpact);
  assert.ok(goldenReveal);
  const handArrival = advance(goldenReveal);
  assert.ok(handArrival);
  assert.equal(
    transitionTripleForgePresentation(handArrival, {
      type: "skip",
      expectedToken: handArrival.token,
      expectedGoldenInstanceId: handArrival.goldenInstanceId,
    }),
    null,
  );
});

test("normal and reduced-motion durations match the observed video stages", () => {
  assert.equal(tripleForgePresentationDuration("acquireHandoff"), 100);
  assert.equal(tripleForgePresentationDuration("forgeImpact"), 230);
  assert.equal(tripleForgePresentationDuration("goldenReveal"), 170);
  assert.equal(tripleForgePresentationDuration("handArrival"), 90);
  assert.equal(tripleForgePresentationDuration("acquireHandoff", true), 20);
  assert.equal(tripleForgePresentationDuration("forgeImpact", true), 40);
  assert.equal(tripleForgePresentationDuration("goldenReveal", true), 40);
  assert.equal(tripleForgePresentationDuration("handArrival", true), 20);
});

test("every stage exposes an accessible announcement", () => {
  assert.equal(
    tripleForgeStageAnnouncement("acquireHandoff"),
    "第三张随从已获得，开始三连。",
  );
  assert.equal(tripleForgeStageAnnouncement("forgeImpact"), "三连锻造中。");
  assert.equal(
    tripleForgeStageAnnouncement("goldenReveal"),
    "金色随从已揭示。",
  );
  assert.equal(
    tripleForgeStageAnnouncement("handArrival"),
    "金色随从已进入手牌。",
  );
});
