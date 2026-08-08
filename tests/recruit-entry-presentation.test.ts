import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameTransition,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  createRecruitEntryPresentation,
  recruitEntryAnnouncement,
  recruitEntryStageDuration,
  transitionRecruitEntryPresentation,
  type RecruitEntryPresentationState,
  type RecruitEntryStage,
} from "../lib/game/recruit-entry-presentation.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function syntheticCombatToRecruit(seed: number): {
  before: GameState;
  after: GameState;
} {
  const before = createGame(seed);
  before.phase = "combat";
  const after = structuredClone(before);
  after.phase = "recruit";
  after.round = before.round + 1;
  return { before, after };
}

function presentationFixture(seed = 0x7e01): RecruitEntryPresentationState {
  const { before, after } = syntheticCombatToRecruit(seed);
  const presentation = createRecruitEntryPresentation({
    before,
    after,
    accepted: true,
    token: 17,
  });
  assert.ok(presentation);
  return presentation;
}

test("only an accepted combat-to-next-recruit transition creates an entry", () => {
  const { before, after } = syntheticCombatToRecruit(0x7e01);
  const previousHuman = humanPlayer(before);
  const human = humanPlayer(after);
  previousHuman.gold = 2;
  human.gold = 4;
  human.tavernTier = 2;

  const presentation = createRecruitEntryPresentation({
    before,
    after,
    accepted: true,
    token: 23,
  });
  assert.ok(presentation);
  assert.equal(
    presentation.transitionKey,
    `${after.humanPlayerId}:${after.round}:23`,
  );
  assert.equal(presentation.stage, "curtain");
  assert.equal(presentation.revision, 0);
  assert.equal(presentation.round, after.round);
  assert.equal(presentation.tavernTier, 2);
  assert.equal(presentation.previousGold, 2);
  assert.equal(presentation.previousMaxGold, 3);
  assert.equal(presentation.gold, 4);
  assert.equal(presentation.maxGold, 4);

  assert.equal(
    createRecruitEntryPresentation({
      before,
      after,
      accepted: false,
      token: 24,
    }),
    null,
  );

  const wrongBefore = structuredClone(before);
  wrongBefore.phase = "recruit";
  assert.equal(
    createRecruitEntryPresentation({
      before: wrongBefore,
      after,
      accepted: true,
      token: 25,
    }),
    null,
  );

  const gameOver = structuredClone(after);
  gameOver.phase = "gameOver";
  assert.equal(
    createRecruitEntryPresentation({
      before,
      after: gameOver,
      accepted: true,
      token: 26,
    }),
    null,
  );

  const sameRound = structuredClone(after);
  sameRound.round = before.round;
  assert.equal(
    createRecruitEntryPresentation({
      before,
      after: sameRound,
      accepted: true,
      token: 27,
    }),
    null,
  );
});

test("Gold slot totals follow the turn allowance while accommodating extra Gold", () => {
  const { before, after } = syntheticCombatToRecruit(0x7e02);
  const previousHuman = humanPlayer(before);
  const human = humanPlayer(after);
  previousHuman.gold = 7;
  previousHuman.maxGold = 10;
  human.gold = 12;
  human.maxGold = 15;

  const presentation = createRecruitEntryPresentation({
    before,
    after,
    accepted: true,
    token: 1,
  });
  assert.ok(presentation);
  assert.equal(presentation.previousMaxGold, 7);
  assert.equal(presentation.maxGold, 12);
});

test("fresh and retained offers include minions and every Tavern Spell slot", () => {
  const { before, after } = syntheticCombatToRecruit(0x7e03);
  const previousHuman = humanPlayer(before);
  const human = humanPlayer(after);
  assert.ok(previousHuman.shop.length >= 3);
  assert.ok(previousHuman.spellShop);

  const retainedMinion = structuredClone(previousHuman.shop[0]);
  const freshMinion = {
    ...structuredClone(previousHuman.shop[1]),
    instanceId: "fresh-minion-offer",
  };
  const retainedSpell = structuredClone(previousHuman.spellShop);
  const freshSpell = {
    ...structuredClone(previousHuman.spellShop),
    instanceId: "fresh-spell-offer",
  };
  const survivingReward = {
    ...structuredClone(previousHuman.shop[2]),
    instanceId: "surviving-reward",
  };

  human.shop = [retainedMinion, freshMinion];
  human.spellShop = retainedSpell;
  human.additionalSpellShop = [freshSpell];
  human.hand = [survivingReward];

  const presentation = createRecruitEntryPresentation({
    before,
    after,
    accepted: true,
    token: 2,
    rewardHandInstanceIds: [
      "surviving-reward",
      "consumed-by-triple",
      "surviving-reward",
    ],
  });
  assert.ok(presentation);
  assert.deepEqual(presentation.freshOfferInstanceIds, [
    "fresh-minion-offer",
    "fresh-spell-offer",
  ]);
  assert.deepEqual(presentation.retainedOfferInstanceIds, [
    retainedMinion.instanceId,
    retainedSpell.instanceId,
  ]);
  assert.deepEqual(presentation.rewardHandInstanceIds, ["surviving-reward"]);
});

test("the stage machine advances in order and ignores advances after completion", () => {
  const expectedStages: readonly RecruitEntryStage[] = [
    "curtain",
    "roundBanner",
    "shopReveal",
    "goldRefill",
    "complete",
  ];
  let presentation = presentationFixture(0x7e04);
  assert.equal(presentation.stage, expectedStages[0]);

  for (const expectedStage of expectedStages.slice(1)) {
    const previous = presentation;
    const transitioned = transitionRecruitEntryPresentation(previous, {
      type: "advance",
      expectedKey: previous.transitionKey,
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
    transitionRecruitEntryPresentation(complete, {
      type: "advance",
      expectedKey: complete.transitionKey,
      expectedStage: complete.stage,
      expectedRevision: complete.revision,
    }),
    complete,
  );
});

test("transition key, stage, and revision make stale timers harmless", () => {
  const presentation = presentationFixture(0x7e05);
  assert.equal(
    transitionRecruitEntryPresentation(presentation, {
      type: "advance",
      expectedKey: "an-older-transition",
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    presentation,
  );
  assert.equal(
    transitionRecruitEntryPresentation(presentation, {
      type: "advance",
      expectedKey: presentation.transitionKey,
      expectedStage: "roundBanner",
      expectedRevision: presentation.revision,
    }),
    presentation,
  );
  assert.equal(
    transitionRecruitEntryPresentation(presentation, {
      type: "advance",
      expectedKey: presentation.transitionKey,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision + 1,
    }),
    presentation,
  );
  assert.equal(
    transitionRecruitEntryPresentation(null, {
      type: "advance",
      expectedKey: presentation.transitionKey,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    }),
    null,
  );
});

test("skip and cancel are guarded and idempotent", () => {
  const presentation = presentationFixture(0x7e06);
  assert.equal(
    transitionRecruitEntryPresentation(presentation, {
      type: "skip",
      expectedKey: "an-older-transition",
    }),
    presentation,
  );

  const skipped = transitionRecruitEntryPresentation(presentation, {
    type: "skip",
    expectedKey: presentation.transitionKey,
  });
  assert.ok(skipped);
  assert.equal(skipped.stage, "complete");
  assert.equal(skipped.revision, presentation.revision + 1);
  assert.equal(
    transitionRecruitEntryPresentation(skipped, { type: "skip" }),
    skipped,
  );
  assert.equal(
    transitionRecruitEntryPresentation(skipped, { type: "cancel" }),
    null,
  );
  assert.equal(
    transitionRecruitEntryPresentation(null, { type: "cancel" }),
    null,
  );
});

test("reduced-motion timings preserve every stage without a long wait", () => {
  const activeStages: readonly RecruitEntryStage[] = [
    "curtain",
    "roundBanner",
    "shopReveal",
    "goldRefill",
  ];
  const normalTotal = activeStages.reduce(
    (total, stage) => total + recruitEntryStageDuration(stage),
    0,
  );
  const reducedTotal = activeStages.reduce(
    (total, stage) => total + recruitEntryStageDuration(stage, true),
    0,
  );

  assert.ok(normalTotal >= 3_000);
  assert.ok(reducedTotal > 0 && reducedTotal <= 350);
  for (const stage of activeStages) {
    assert.ok(recruitEntryStageDuration(stage, true) > 0);
    assert.ok(
      recruitEntryStageDuration(stage, true) <
        recruitEntryStageDuration(stage),
    );
  }
  assert.equal(recruitEntryStageDuration("complete"), 0);
  assert.equal(recruitEntryStageDuration("complete", true), 0);
});

test("announcements describe the current Recruit-entry stage", () => {
  let presentation = presentationFixture(0x7e07);
  assert.match(recruitEntryAnnouncement(presentation), /战斗结束/);
  const expectedAnnouncements = [
    /招募阶段/,
    /酒馆报价/,
    /金币已补充/,
    /招募阶段开始/,
  ];
  for (const expectedAnnouncement of expectedAnnouncements) {
    const transitioned = transitionRecruitEntryPresentation(presentation, {
      type: "advance",
      expectedKey: presentation.transitionKey,
      expectedStage: presentation.stage,
      expectedRevision: presentation.revision,
    });
    assert.ok(transitioned);
    presentation = transitioned;
    assert.match(recruitEntryAnnouncement(presentation), expectedAnnouncement);
  }
});

test("the state machine accepts the engine's real CONTINUE boundary", () => {
  const recruit = createGame(0x7e08);
  const combat = gameTransition(recruit, { type: "END_TURN" });
  assert.equal(combat.accepted, true);
  assert.equal(combat.state.phase, "combat");

  const nextRecruit = gameTransition(combat.state, { type: "CONTINUE" });
  assert.equal(nextRecruit.accepted, true);
  assert.equal(nextRecruit.state.phase, "recruit");

  const presentation = createRecruitEntryPresentation({
    before: combat.state,
    after: nextRecruit.state,
    accepted: nextRecruit.accepted,
    token: 99,
  });
  assert.ok(presentation);
  assert.equal(presentation.round, combat.state.round + 1);
  assert.equal(presentation.gold, humanPlayer(nextRecruit.state).gold);
});
