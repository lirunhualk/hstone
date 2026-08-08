import assert from "node:assert/strict";
import test from "node:test";

import {
  createDiscoverChoicePresentation,
  discoverChoicePresentationDuration,
  findDiscoverTripleReward,
  transitionDiscoverChoicePresentation,
  type DiscoverChoicePresentationState,
} from "../lib/game/discover-choice-presentation.ts";

const OPTION_IDS = ["offer-a", "offer-b", "offer-c"] as const;

function handRewardFixture(): DiscoverChoicePresentationState {
  const presentation = createDiscoverChoicePresentation({
    accepted: true,
    interactionId: "discover-17",
    optionIds: OPTION_IDS,
    selectedOptionId: "offer-b",
    rewardKind: "hand",
    rewardInstanceId: "hand-reward-17",
  });
  assert.ok(presentation);
  return presentation;
}

function advance(
  presentation: DiscoverChoicePresentationState,
): DiscoverChoicePresentationState | null {
  return transitionDiscoverChoicePresentation(presentation, {
    type: "advance",
    expectedInteractionId: presentation.interactionId,
    expectedStage: presentation.stage,
    expectedRevision: presentation.revision,
  });
}

test("accepted one-to-four option choices create a detached immutable snapshot", () => {
  const optionIds = ["offer-a", "offer-b", "offer-c", "offer-d"];
  const presentation = createDiscoverChoicePresentation({
    accepted: true,
    interactionId: "discover-1",
    optionIds,
    selectedOptionId: "offer-c",
    rewardKind: "hand",
    rewardInstanceId: "reward-1",
  });

  assert.deepEqual(presentation, {
    interactionId: "discover-1",
    optionIds,
    selectedOptionId: "offer-c",
    rewardKind: "hand",
    rewardInstanceId: "reward-1",
    stage: "selectedFocus",
    revision: 0,
  });
  assert.ok(presentation);
  assert.equal(Object.isFrozen(presentation), true);
  assert.equal(Object.isFrozen(presentation.optionIds), true);
  optionIds[0] = "mutated-source";
  assert.equal(presentation.optionIds[0], "offer-a");
  assert.throws(() => {
    (presentation.optionIds as string[])[0] = "mutated-snapshot";
  }, TypeError);

  const twoOptions = createDiscoverChoicePresentation({
    accepted: true,
    interactionId: "discover-2",
    optionIds: ["left", "right"],
    selectedOptionId: "left",
  });
  assert.ok(twoOptions);
  assert.equal(twoOptions.rewardKind, null);
  assert.equal(twoOptions.rewardInstanceId, null);

  const singleOption = createDiscoverChoicePresentation({
    accepted: true,
    interactionId: "discover-single",
    optionIds: ["last-pool-copy"],
    selectedOptionId: "last-pool-copy",
    rewardKind: "hand",
    rewardInstanceId: "last-pool-copy",
  });
  assert.ok(singleOption);
  assert.deepEqual(singleOption.optionIds, ["last-pool-copy"]);
  assert.equal(singleOption.selectedOptionId, "last-pool-copy");
});

test("a Discover-triggered triple identifies the real golden hand reward", () => {
  const consumedMatch = findDiscoverTripleReward(
    [
      {
        kind: "triple",
        golden: {
          instanceId: "golden-from-discover",
          definitionId: "minion-a",
          name: "金色随从甲",
        },
        knownConsumedInstanceIds: ["owned-a", "selected-copy"],
      },
    ],
    "selected-copy",
    "different-definition-is-still-safe",
  );
  assert.deepEqual(consumedMatch, {
    instanceId: "golden-from-discover",
    definitionId: "minion-a",
    name: "金色随从甲",
  });

  const definitionFallback = findDiscoverTripleReward(
    [
      {
        kind: "triple",
        golden: {
          instanceId: "golden-effect-copy",
          definitionId: "minion-b",
          name: "金色随从乙",
        },
        knownConsumedInstanceIds: ["owned-b-1", "owned-b-2"],
      },
    ],
    "effect-created-selected-copy",
    "minion-b",
  );
  assert.equal(definitionFallback?.instanceId, "golden-effect-copy");

  const exactMatchWins = findDiscoverTripleReward(
    [
      {
        kind: "triple",
        golden: {
          instanceId: "earlier-definition-fallback",
          definitionId: "minion-b",
          name: "较早的同名三连",
        },
        knownConsumedInstanceIds: ["other-copy"],
      },
      {
        kind: "triple",
        golden: {
          instanceId: "later-exact-consumed-match",
          definitionId: "wildcard-triple",
          name: "实际消耗所选牌的三连",
        },
        knownConsumedInstanceIds: ["selected-copy"],
      },
    ],
    "selected-copy",
    "minion-b",
  );
  assert.equal(exactMatchWins?.instanceId, "later-exact-consumed-match");

  assert.equal(
    findDiscoverTripleReward(
      [
        {
          kind: "triple",
          golden: {
            instanceId: "unrelated-golden",
            definitionId: "minion-c",
            name: "无关金色随从",
          },
          knownConsumedInstanceIds: ["other-copy"],
        },
      ],
      "selected-copy",
      "minion-b",
    ),
    null,
  );
});

test("creation rejects unaccepted and malformed interaction snapshots", () => {
  const create = (
    overrides: Partial<Parameters<typeof createDiscoverChoicePresentation>[0]> = {},
  ) =>
    createDiscoverChoicePresentation({
      accepted: true,
      interactionId: "discover-invalid",
      optionIds: OPTION_IDS,
      selectedOptionId: "offer-a",
      ...overrides,
    });

  assert.equal(create({ accepted: false }), null);
  assert.equal(create({ interactionId: "" }), null);
  assert.equal(create({ interactionId: " padded " }), null);
  assert.equal(create({ optionIds: [] }), null);
  assert.equal(
    create({ optionIds: ["a", "b", "c", "d", "e"], selectedOptionId: "a" }),
    null,
  );
  assert.equal(create({ optionIds: ["a", "a"], selectedOptionId: "a" }), null);
  assert.equal(create({ optionIds: ["a", ""], selectedOptionId: "a" }), null);
  assert.equal(create({ selectedOptionId: "not-offered" }), null);
  assert.equal(
    create({ rewardKind: "hand", rewardInstanceId: undefined }),
    null,
  );
  assert.equal(create({ rewardKind: "hand", rewardInstanceId: " " }), null);
  assert.equal(create({ rewardInstanceId: "orphan-reward" }), null);
  assert.equal(
    create({
      rewardKind: "invalid" as never,
      rewardInstanceId: "reward",
    }),
    null,
  );
});

test("a hand reward follows the complete focus, tavern, and arrival chain", () => {
  const selectedFocus = handRewardFixture();
  const returnToTavern = advance(selectedFocus);
  assert.ok(returnToTavern);
  assert.equal(returnToTavern.stage, "returnToTavern");
  assert.equal(returnToTavern.revision, 1);
  assert.equal(Object.isFrozen(returnToTavern), true);
  assert.equal(Object.isFrozen(returnToTavern.optionIds), true);

  const rewardArrival = advance(returnToTavern);
  assert.ok(rewardArrival);
  assert.equal(rewardArrival.stage, "rewardArrival");
  assert.equal(rewardArrival.revision, 2);
  assert.equal(rewardArrival.rewardInstanceId, "hand-reward-17");
  assert.equal(advance(rewardArrival), null);
});

test("immediate and no-reward choices skip the hand-arrival stage", () => {
  for (const input of [
    {
      interactionId: "discover-immediate",
      rewardKind: "immediate" as const,
      rewardInstanceId: "attached-reward",
    },
    {
      interactionId: "discover-none",
      rewardKind: undefined,
      rewardInstanceId: undefined,
    },
  ]) {
    const selectedFocus = createDiscoverChoicePresentation({
      accepted: true,
      interactionId: input.interactionId,
      optionIds: OPTION_IDS,
      selectedOptionId: "offer-c",
      rewardKind: input.rewardKind,
      rewardInstanceId: input.rewardInstanceId,
    });
    assert.ok(selectedFocus);
    const returnToTavern = advance(selectedFocus);
    assert.ok(returnToTavern);
    assert.equal(returnToTavern.stage, "returnToTavern");
    assert.equal(advance(returnToTavern), null);
  }
});

test("interaction, stage, and revision guards make stale timers harmless", () => {
  const selectedFocus = handRewardFixture();
  assert.equal(
    transitionDiscoverChoicePresentation(selectedFocus, {
      type: "advance",
      expectedInteractionId: "older-discover",
      expectedStage: "selectedFocus",
      expectedRevision: 0,
    }),
    selectedFocus,
  );
  assert.equal(
    transitionDiscoverChoicePresentation(selectedFocus, {
      type: "advance",
      expectedInteractionId: selectedFocus.interactionId,
      expectedStage: "returnToTavern",
      expectedRevision: 0,
    }),
    selectedFocus,
  );
  assert.equal(
    transitionDiscoverChoicePresentation(selectedFocus, {
      type: "advance",
      expectedInteractionId: selectedFocus.interactionId,
      expectedStage: "selectedFocus",
      expectedRevision: 1,
    }),
    selectedFocus,
  );

  const returnToTavern = advance(selectedFocus);
  assert.ok(returnToTavern);
  assert.equal(
    transitionDiscoverChoicePresentation(returnToTavern, {
      type: "advance",
      expectedInteractionId: selectedFocus.interactionId,
      expectedStage: selectedFocus.stage,
      expectedRevision: selectedFocus.revision,
    }),
    returnToTavern,
  );
  assert.equal(
    transitionDiscoverChoicePresentation(null, {
      type: "advance",
      expectedInteractionId: selectedFocus.interactionId,
      expectedStage: selectedFocus.stage,
      expectedRevision: selectedFocus.revision,
    }),
    null,
  );
});

test("skip completes only the matching presentation immediately", () => {
  const presentation = handRewardFixture();
  assert.equal(
    transitionDiscoverChoicePresentation(presentation, {
      type: "skip",
      expectedInteractionId: "older-discover",
    }),
    presentation,
  );
  assert.equal(
    transitionDiscoverChoicePresentation(presentation, {
      type: "skip",
      expectedInteractionId: presentation.interactionId,
    }),
    null,
  );
  assert.equal(
    transitionDiscoverChoicePresentation(null, {
      type: "skip",
      expectedInteractionId: presentation.interactionId,
    }),
    null,
  );
});

test("normal and reduced-motion durations are exact for every stage", () => {
  assert.equal(discoverChoicePresentationDuration("selectedFocus"), 520);
  assert.equal(discoverChoicePresentationDuration("returnToTavern"), 420);
  assert.equal(discoverChoicePresentationDuration("rewardArrival"), 620);
  assert.equal(
    discoverChoicePresentationDuration("selectedFocus", true),
    80,
  );
  assert.equal(
    discoverChoicePresentationDuration("returnToTavern", true),
    80,
  );
  assert.equal(
    discoverChoicePresentationDuration("rewardArrival", true),
    80,
  );
});
