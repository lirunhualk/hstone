import assert from "node:assert/strict";
import test from "node:test";

import {
  createHeroPowerPresentation,
  heroPowerPresentationAnnouncement,
  heroPowerPresentationDuration,
  transitionHeroPowerPresentation,
  type CreateHeroPowerPresentationInput,
  type HeroPowerPresentationAction,
  type HeroPowerPresentationState,
} from "../lib/game/hero-power-presentation.ts";

function fixture(): HeroPowerPresentationState {
  const presentation = createHeroPowerPresentation({
    accepted: true,
    token: 9,
    heroPowerId: "hero-power-tb_baconshop_hp_047",
    heroName: "伊莉斯·逐星",
    powerName: "人才地图",
    cost: 2,
  });
  assert.ok(presentation);
  return presentation;
}

function advance(
  presentation: HeroPowerPresentationState,
): HeroPowerPresentationState | null {
  return transitionHeroPowerPresentation(presentation, {
    type: "advance",
    expectedToken: presentation.token,
    expectedHeroPowerId: presentation.heroPowerId,
    expectedStage: presentation.stage,
    expectedRevision: presentation.revision,
  });
}

test("accepted activations create an immutable client snapshot", () => {
  const presentation = fixture();
  assert.deepEqual(presentation, {
    token: 9,
    heroPowerId: "hero-power-tb_baconshop_hp_047",
    heroName: "伊莉斯·逐星",
    powerName: "人才地图",
    cost: 2,
    stage: "sourcePulse",
    revision: 0,
  });
  assert.equal(Object.isFrozen(presentation), true);
  assert.throws(() => {
    (presentation as { stage: string }).stage = "resourceCommit";
  }, TypeError);
});

test("creation rejects unaccepted and malformed activation snapshots", () => {
  const create = (
    overrides: Partial<CreateHeroPowerPresentationInput> = {},
  ) =>
    createHeroPowerPresentation({
      accepted: true,
      token: 10,
      heroPowerId: "hero-power-tb_baconshop_hp_015",
      heroName: "米尔菲丝·法力风暴",
      powerName: "机械改造",
      cost: 1,
      ...overrides,
    });

  assert.equal(create({ accepted: false }), null);
  assert.equal(create({ token: 0 }), null);
  assert.equal(create({ token: 1.5 }), null);
  assert.equal(create({ heroPowerId: "" }), null);
  assert.equal(create({ heroPowerId: " padded " }), null);
  assert.equal(create({ heroName: "" }), null);
  assert.equal(create({ powerName: "" }), null);
  assert.equal(create({ cost: -1 }), null);
  assert.equal(create({ cost: 1.5 }), null);
  assert.equal(create({ cost: Number.NaN }), null);
  assert.equal(createHeroPowerPresentation(null as never), null);
});

test("zero-cost activations remain valid", () => {
  const presentation = createHeroPowerPresentation({
    accepted: true,
    token: 11,
    heroPowerId: "free-power",
    heroName: "测试英雄",
    powerName: "免费技能",
    cost: 0,
  });
  assert.ok(presentation);
  assert.equal(presentation.cost, 0);
});

test("advance follows source, resource, and effect stages immutably", () => {
  const sourcePulse = fixture();
  const resourceCommit = advance(sourcePulse);
  assert.ok(resourceCommit);
  assert.equal(resourceCommit.stage, "resourceCommit");
  assert.equal(resourceCommit.revision, 1);
  assert.equal(sourcePulse.stage, "sourcePulse");

  const effectResolve = advance(resourceCommit);
  assert.ok(effectResolve);
  assert.equal(effectResolve.stage, "effectResolve");
  assert.equal(effectResolve.revision, 2);
  assert.equal(advance(effectResolve), null);
});

test("stale and malformed advances preserve the exact current object", () => {
  const presentation = fixture();
  const transition = (
    overrides: Partial<
      Extract<HeroPowerPresentationAction, { type: "advance" }>
    >,
  ) =>
    transitionHeroPowerPresentation(presentation, {
      type: "advance",
      expectedToken: presentation.token,
      expectedHeroPowerId: presentation.heroPowerId,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
      ...overrides,
    });

  assert.equal(transition({ expectedToken: 8 }), presentation);
  assert.equal(
    transition({ expectedHeroPowerId: "older-power" }),
    presentation,
  );
  assert.equal(
    transition({ expectedStage: "resourceCommit" }),
    presentation,
  );
  assert.equal(transition({ expectedRevision: 1 }), presentation);
  assert.equal(transition({ expectedToken: 0 }), presentation);
  assert.equal(transition({ expectedHeroPowerId: "" }), presentation);
  assert.equal(
    transition({ expectedStage: "invalid" as never }),
    presentation,
  );
  assert.equal(transition({ expectedRevision: -1 }), presentation);
  assert.equal(
    transitionHeroPowerPresentation(
      presentation,
      { type: "malformed" } as never,
    ),
    presentation,
  );
  assert.equal(
    transitionHeroPowerPresentation(null, {
      type: "advance",
      expectedToken: presentation.token,
      expectedHeroPowerId: presentation.heroPowerId,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    null,
  );
});

test("skip completes only the matching token and Hero Power", () => {
  const presentation = fixture();
  assert.equal(
    transitionHeroPowerPresentation(presentation, {
      type: "skip",
      expectedToken: 8,
      expectedHeroPowerId: presentation.heroPowerId,
    }),
    presentation,
  );
  assert.equal(
    transitionHeroPowerPresentation(presentation, {
      type: "skip",
      expectedToken: presentation.token,
      expectedHeroPowerId: "older-power",
    }),
    presentation,
  );
  assert.equal(
    transitionHeroPowerPresentation(presentation, {
      type: "skip",
      expectedToken: presentation.token,
      expectedHeroPowerId: presentation.heroPowerId,
    }),
    null,
  );
});

test("normal and reduced-motion durations are exact and bounded", () => {
  assert.equal(heroPowerPresentationDuration("sourcePulse"), 240);
  assert.equal(heroPowerPresentationDuration("resourceCommit"), 260);
  assert.equal(heroPowerPresentationDuration("effectResolve"), 180);
  assert.equal(heroPowerPresentationDuration("sourcePulse", true), 30);
  assert.equal(heroPowerPresentationDuration("resourceCommit", true), 40);
  assert.equal(heroPowerPresentationDuration("effectResolve", true), 30);
  assert.equal(240 + 260 + 180, 680);
  assert.equal(30 + 40 + 30, 100);
});

test("every stage exposes a concise Chinese announcement", () => {
  const sourcePulse = fixture();
  assert.equal(
    heroPowerPresentationAnnouncement(sourcePulse),
    "伊莉斯·逐星发动英雄技能“人才地图”。",
  );
  const resourceCommit = advance(sourcePulse);
  assert.ok(resourceCommit);
  assert.equal(
    heroPowerPresentationAnnouncement(resourceCommit),
    "消耗2枚金币，英雄技能状态已更新。",
  );
  const effectResolve = advance(resourceCommit);
  assert.ok(effectResolve);
  assert.equal(
    heroPowerPresentationAnnouncement(effectResolve),
    "英雄技能“人才地图”的效果已结算。",
  );

  const free = createHeroPowerPresentation({
    accepted: true,
    token: 12,
    heroPowerId: "free-power",
    heroName: "测试英雄",
    powerName: "免费技能",
    cost: 0,
  });
  assert.ok(free);
  const freeCommit = advance(free);
  assert.ok(freeCommit);
  assert.equal(
    heroPowerPresentationAnnouncement(freeCommit),
    "英雄技能状态已更新。",
  );
  assert.equal(
    heroPowerPresentationAnnouncement({ ...free, revision: -1 }),
    "",
  );
});
