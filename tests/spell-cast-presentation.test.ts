import assert from "node:assert/strict";
import test from "node:test";

import {
  createSpellCastPresentation,
  spellCastPresentationAnnouncement,
  spellCastPresentationDuration,
  transitionSpellCastPresentation,
  type CreateSpellCastPresentationInput,
  type SpellCastPresentationAction,
  type SpellCastPresentationState,
} from "../lib/game/spell-cast-presentation.ts";

function targetedFixture(): SpellCastPresentationState {
  const presentation = createSpellCastPresentation({
    accepted: true,
    token: 17,
    cardInstanceId: "spell-card-17",
    cardKind: "tavernSpell",
    cardName: "甲虫恩泽",
    targetInstanceId: "target-minion-17",
    targetName: "躁动欺诈者",
  });
  assert.ok(presentation);
  return presentation;
}

function advance(
  presentation: SpellCastPresentationState,
): SpellCastPresentationState | null {
  return transitionSpellCastPresentation(presentation, {
    type: "advance",
    expectedToken: presentation.token,
    expectedCardInstanceId: presentation.cardInstanceId,
    expectedStage: presentation.stage,
    expectedRevision: presentation.revision,
  });
}

test("accepted targeted casts create an immutable client snapshot", () => {
  const presentation = targetedFixture();
  assert.deepEqual(presentation, {
    token: 17,
    cardInstanceId: "spell-card-17",
    cardKind: "tavernSpell",
    cardName: "甲虫恩泽",
    targetInstanceId: "target-minion-17",
    targetName: "躁动欺诈者",
    stage: "cardLift",
    revision: 0,
  });
  assert.equal(Object.isFrozen(presentation), true);
  assert.throws(() => {
    (presentation as { stage: string }).stage = "spellRelease";
  }, TypeError);
});

test("accepted no-target casts normalize their target fields to null", () => {
  const presentation = createSpellCastPresentation({
    accepted: true,
    token: 18,
    cardInstanceId: "spellcraft-card-18",
    cardKind: "spellcraft",
    cardName: "深沉蓝调",
  });
  assert.ok(presentation);
  assert.equal(presentation.targetInstanceId, null);
  assert.equal(presentation.targetName, null);
  assert.equal(presentation.cardKind, "spellcraft");

  const explicitNullTarget = createSpellCastPresentation({
    accepted: true,
    token: 19,
    cardInstanceId: "global-spell-19",
    cardKind: "tavernSpell",
    cardName: "顶尖好酒",
    targetInstanceId: null,
    targetName: null,
  });
  assert.ok(explicitNullTarget);
  assert.equal(explicitNullTarget.targetInstanceId, null);
  assert.equal(explicitNullTarget.targetName, null);
});

test("creation rejects unaccepted and malformed cast snapshots", () => {
  const create = (
    overrides: Partial<CreateSpellCastPresentationInput> = {},
  ) =>
    createSpellCastPresentation({
      accepted: true,
      token: 20,
      cardInstanceId: "spell-card-20",
      cardKind: "tavernSpell",
      cardName: "时间管理",
      ...overrides,
    });

  assert.equal(create({ accepted: false }), null);
  assert.equal(create({ accepted: undefined as never }), null);
  assert.equal(create({ token: 0 }), null);
  assert.equal(create({ token: -1 }), null);
  assert.equal(create({ token: 1.5 }), null);
  assert.equal(create({ token: Number.NaN }), null);
  assert.equal(create({ token: Number.POSITIVE_INFINITY }), null);
  assert.equal(create({ cardInstanceId: "" }), null);
  assert.equal(create({ cardInstanceId: " padded " }), null);
  assert.equal(create({ cardKind: "bloodGem" as never }), null);
  assert.equal(create({ cardName: "" }), null);
  assert.equal(create({ cardName: " padded " }), null);
  assert.equal(create({ targetInstanceId: "target-only" }), null);
  assert.equal(create({ targetName: "只有名称" }), null);
  assert.equal(create({ targetInstanceId: null }), null);
  assert.equal(create({ targetName: null }), null);
  assert.equal(
    create({ targetInstanceId: "target", targetName: null }),
    null,
  );
  assert.equal(
    create({ targetInstanceId: " target ", targetName: "目标" }),
    null,
  );
  assert.equal(
    create({ targetInstanceId: "target", targetName: " 目标 " }),
    null,
  );
  assert.equal(createSpellCastPresentation(null as never), null);
});

test("advance follows the complete cast chain without mutating prior stages", () => {
  const cardLift = targetedFixture();
  const spellRelease = advance(cardLift);
  assert.ok(spellRelease);
  assert.equal(spellRelease.stage, "spellRelease");
  assert.equal(spellRelease.revision, 1);
  assert.equal(Object.isFrozen(spellRelease), true);
  assert.equal(cardLift.stage, "cardLift");
  assert.equal(cardLift.revision, 0);

  const effectResolve = advance(spellRelease);
  assert.ok(effectResolve);
  assert.equal(effectResolve.stage, "effectResolve");
  assert.equal(effectResolve.revision, 2);
  assert.equal(effectResolve.targetInstanceId, "target-minion-17");
  assert.equal(advance(effectResolve), null);
});

test("stale and malformed advances return the exact current object", () => {
  const presentation = targetedFixture();
  const transition = (
    overrides: Partial<
      Extract<SpellCastPresentationAction, { type: "advance" }>
    >,
  ) =>
    transitionSpellCastPresentation(presentation, {
      type: "advance",
      expectedToken: presentation.token,
      expectedCardInstanceId: presentation.cardInstanceId,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
      ...overrides,
    });

  assert.equal(transition({ expectedToken: 16 }), presentation);
  assert.equal(
    transition({ expectedCardInstanceId: "older-spell" }),
    presentation,
  );
  assert.equal(transition({ expectedStage: "spellRelease" }), presentation);
  assert.equal(transition({ expectedRevision: 1 }), presentation);
  assert.equal(transition({ expectedToken: 0 }), presentation);
  assert.equal(transition({ expectedCardInstanceId: "" }), presentation);
  assert.equal(
    transition({ expectedStage: "invalid" as never }),
    presentation,
  );
  assert.equal(transition({ expectedRevision: -1 }), presentation);
  assert.equal(
    transitionSpellCastPresentation(
      presentation,
      { type: "malformed" } as never,
    ),
    presentation,
  );
  assert.equal(
    transitionSpellCastPresentation(null, {
      type: "advance",
      expectedToken: presentation.token,
      expectedCardInstanceId: presentation.cardInstanceId,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    null,
  );

  const malformedState = {
    ...presentation,
    targetName: null,
  } as SpellCastPresentationState;
  assert.equal(
    transitionSpellCastPresentation(malformedState, {
      type: "skip",
      expectedToken: malformedState.token,
      expectedCardInstanceId: malformedState.cardInstanceId,
    }),
    malformedState,
  );

  const missingTargetFields = {
    token: presentation.token,
    cardInstanceId: presentation.cardInstanceId,
    cardKind: presentation.cardKind,
    cardName: presentation.cardName,
    stage: presentation.stage,
    revision: presentation.revision,
  } as SpellCastPresentationState;
  assert.equal(
    transitionSpellCastPresentation(missingTargetFields, {
      type: "skip",
      expectedToken: missingTargetFields.token,
      expectedCardInstanceId: missingTargetFields.cardInstanceId,
    }),
    missingTargetFields,
  );
});

test("skip completes only the matching token and card", () => {
  const presentation = targetedFixture();
  assert.equal(
    transitionSpellCastPresentation(presentation, {
      type: "skip",
      expectedToken: 16,
      expectedCardInstanceId: presentation.cardInstanceId,
    }),
    presentation,
  );
  assert.equal(
    transitionSpellCastPresentation(presentation, {
      type: "skip",
      expectedToken: presentation.token,
      expectedCardInstanceId: "older-spell",
    }),
    presentation,
  );
  assert.equal(
    transitionSpellCastPresentation(presentation, {
      type: "skip",
      expectedToken: presentation.token,
      expectedCardInstanceId: presentation.cardInstanceId,
    }),
    null,
  );

  const spellRelease = advance(presentation);
  assert.ok(spellRelease);
  const effectResolve = advance(spellRelease);
  assert.ok(effectResolve);
  assert.equal(
    transitionSpellCastPresentation(effectResolve, {
      type: "skip",
      expectedToken: effectResolve.token,
      expectedCardInstanceId: effectResolve.cardInstanceId,
    }),
    null,
  );
});

test("normal and reduced-motion durations are exact and bounded", () => {
  assert.equal(spellCastPresentationDuration("cardLift"), 200);
  assert.equal(spellCastPresentationDuration("spellRelease"), 260);
  assert.equal(spellCastPresentationDuration("effectResolve"), 220);
  assert.equal(spellCastPresentationDuration("cardLift", true), 30);
  assert.equal(spellCastPresentationDuration("spellRelease", true), 40);
  assert.equal(spellCastPresentationDuration("effectResolve", true), 30);

  const normalTotal = 200 + 260 + 220;
  const reducedTotal = 30 + 40 + 30;
  assert.equal(normalTotal, 680);
  assert.equal(reducedTotal, 100);
  assert.ok(normalTotal >= 650 && normalTotal <= 720);
  assert.ok(reducedTotal <= 120);
});

test("every stage exposes targeted and no-target Chinese announcements", () => {
  const cardLift = targetedFixture();
  assert.equal(
    spellCastPresentationAnnouncement(cardLift),
    "举起酒馆法术“甲虫恩泽”。",
  );
  const spellRelease = advance(cardLift);
  assert.ok(spellRelease);
  assert.equal(
    spellCastPresentationAnnouncement(spellRelease),
    "向躁动欺诈者施放“甲虫恩泽”。",
  );
  const effectResolve = advance(spellRelease);
  assert.ok(effectResolve);
  assert.equal(
    spellCastPresentationAnnouncement(effectResolve),
    "“甲虫恩泽”已作用于躁动欺诈者。",
  );

  const noTarget = createSpellCastPresentation({
    accepted: true,
    token: 21,
    cardInstanceId: "spellcraft-card-21",
    cardKind: "spellcraft",
    cardName: "冥想",
  });
  assert.ok(noTarget);
  assert.equal(
    spellCastPresentationAnnouncement(noTarget),
    "举起塑造法术“冥想”。",
  );
  const noTargetRelease = advance(noTarget);
  assert.ok(noTargetRelease);
  assert.equal(
    spellCastPresentationAnnouncement(noTargetRelease),
    "施放塑造法术“冥想”。",
  );
  const noTargetResolve = advance(noTargetRelease);
  assert.ok(noTargetResolve);
  assert.equal(
    spellCastPresentationAnnouncement(noTargetResolve),
    "“冥想”的效果已结算。",
  );
  assert.equal(
    spellCastPresentationAnnouncement({
      ...noTarget,
      revision: -1,
    }),
    "",
  );
});
