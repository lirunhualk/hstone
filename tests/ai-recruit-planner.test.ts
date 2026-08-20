import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RECRUIT_PLANNER_VERSION,
  planAiRecruitTurn,
  scoreAiRecruitObservation,
} from "../lib/game/ai-recruit-planner.ts";
import type {
  AiTrainingMinionObservation,
  AiTrainingObservation,
} from "../lib/game/ai-training.ts";
import {
  AiTrainingEnvironment,
  type AiTrainingLegalAction,
} from "../lib/game/ai-training-environment.ts";

const FISH_DEFINITION_ID = "TB_BaconShop_HP_105t";

function fishObservation(
  template: AiTrainingMinionObservation,
  options: {
    golden?: boolean;
    learnedGolden?: boolean;
    learned?: boolean;
  } = {},
): AiTrainingMinionObservation {
  return {
    ...structuredClone(template),
    kind: "minion",
    definitionId: FISH_DEFINITION_ID,
    cardId: options.golden ? "TB_BaconUps_307" : FISH_DEFINITION_ID,
    name: options.golden ? "Golden Fish of N'Zoth" : "Fish of N'Zoth",
    tier: 1,
    tribe: "beast",
    tribes: ["beast"],
    associatedTribes: [],
    attack: 10,
    health: 10,
    golden: options.golden === true,
    learnedDeathrattles:
      options.learned === false
        ? []
        : [
            {
              definitionId: "scallywag",
              golden: options.learnedGolden === true,
            },
          ],
  };
}

function observationWithBoard(
  board: AiTrainingMinionObservation[],
): AiTrainingObservation {
  const observation = structuredClone(
    new AiTrainingEnvironment(0x8b10, 0).observe(),
  ) as AiTrainingObservation;
  observation.own.board = board;
  observation.own.hand = [];
  return observation;
}

function replanOnlyEnvironment(
  observation: AiTrainingObservation,
  actions: readonly Readonly<AiTrainingLegalAction>[],
): AiTrainingEnvironment {
  const environment = {
    observe: () => observation,
    fork: () => environment,
    plannerLegalActions: () => actions,
    plannerTransition: (token: string) => {
      const action = actions.find((candidate) => candidate.token === token);
      assert.ok(action);
      return Object.freeze({ kind: "replanBoundary" as const, action });
    },
  };
  return environment as unknown as AiTrainingEnvironment;
}

function executeRecruitFragments(
  environment: AiTrainingEnvironment,
  options: { beamWidth: number; maxActions: number },
) {
  const plans = [] as ReturnType<typeof planAiRecruitTurn>[];
  for (let invocation = 0; invocation < 50; invocation += 1) {
    const plan = planAiRecruitTurn(environment, options);
    plans.push(plan);
    assert.notEqual(plan.termination, "searchExhausted");
    for (const action of plan.actions) {
      assert.equal(
        environment.step(action.token, { includeLegalActions: false })
          .accepted,
        true,
      );
    }
    if (plan.termination === "endTurn") return plans;
  }
  assert.fail("Recruit planner did not end within 50 fragments");
}

test("Recruit planner replans committed actions and ends without peeking", () => {
  const environment = new AiTrainingEnvironment(0x8b01, 0);
  const before = environment.observe();
  const plan = planAiRecruitTurn(environment, {
    beamWidth: 8,
    maxActions: 4,
  });

  assert.equal(plan.termination, "replanAfterAction");
  assert.equal(plan.complete, false);
  assert.deepEqual(environment.observe(), before);
  assert.equal(plan.observation.public.phase, "recruit");
  assert.ok(plan.scoreDelta > 0);
  assert.equal(plan.actions.at(-1)?.plannerDisposition, "replan");

  const plans = executeRecruitFragments(environment, {
    beamWidth: 8,
    maxActions: 4,
  });
  const actions = plans.flatMap((fragment) => fragment.actions);
  assert.ok(actions.some((action) => action.type === "BUY_MINION"));
  assert.ok(actions.some((action) => action.type === "PLAY_HAND_CARD"));
  assert.equal(actions.at(-1)?.type, "END_TURN");
  assert.equal(environment.observe().public.phase, "combat");

  const serialized = JSON.stringify(plan);
  for (const forbidden of [
    "instanceId",
    "interactionId",
    "playerId",
    "rngState",
    "spellPool",
    "lastRoundBattles",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("planned revision-scoped fragments replay and stale tokens expire", () => {
  const environment = new AiTrainingEnvironment(0x8b02, 2);
  const plan = planAiRecruitTurn(environment, {
    beamWidth: 8,
    maxActions: 4,
  });
  const staleToken = environment.plannerLegalActions()[0]?.token;
  for (const action of plan.actions) {
    const current = environment
      .plannerLegalActions()
      .find((candidate) => candidate.token === action.token);
    assert.deepEqual(current, action);
    const result = environment.step(action.token, {
      includeLegalActions: false,
    });
    assert.equal(result.accepted, true);
    assert.deepEqual(result.legalActions, []);
  }
  assert.equal(plan.termination, "replanAfterAction");
  assert.equal(environment.observe().public.phase, "recruit");
  if (staleToken) {
    assert.equal(environment.step(staleToken).accepted, false);
  }
  const remaining = executeRecruitFragments(environment, {
    beamWidth: 8,
    maxActions: 4,
  });
  assert.equal(remaining.at(-1)?.termination, "endTurn");
  assert.equal(environment.observe().public.phase, "combat");
});

test("planner fragments keep reducer-backed revision tokens", () => {
  const environment = new AiTrainingEnvironment(0x8b05, 0);
  const plan = planAiRecruitTurn(environment, {
    beamWidth: 4,
    maxActions: 4,
  });
  for (const action of plan.actions) {
    assert.match(action.token, /^\d+:planner:\d+$/);
    assert.equal(
      environment.step(action.token, { includeLegalActions: false })
        .accepted,
      true,
    );
  }
});

test("planner and score are deterministic and validate search bounds", () => {
  const first = new AiTrainingEnvironment(0x8b03, 6);
  const second = new AiTrainingEnvironment(0x8b03, 6);
  const firstPlan = planAiRecruitTurn(first, {
    beamWidth: 6,
    maxActions: 3,
  });
  const secondPlan = planAiRecruitTurn(second, {
    beamWidth: 6,
    maxActions: 3,
  });
  assert.deepEqual(firstPlan, secondPlan);
  assert.deepEqual(
    scoreAiRecruitObservation(first.observe()),
    scoreAiRecruitObservation(second.observe()),
  );
  assert.equal(Object.isFrozen(firstPlan), true);
  assert.equal(Object.isFrozen(firstPlan.actions), true);
  assert.equal(Object.isFrozen(firstPlan.breakdown), true);

  assert.throws(
    () => planAiRecruitTurn(first, { beamWidth: 0 }),
    RangeError,
  );
  assert.throws(
    () => planAiRecruitTurn(first, { maxActions: 21 }),
    RangeError,
  );
});

test("planner v4 conservatively values learned Deathrattle trigger-equivalents", () => {
  assert.equal(AI_RECRUIT_PLANNER_VERSION, 4);
  const initial = new AiTrainingEnvironment(0x8b10, 0).observe();
  const template = structuredClone(initial.own.shop[0]) as unknown as
    AiTrainingMinionObservation;
  assert.ok(template);

  const visibleBoardPower = (minion: AiTrainingMinionObservation) =>
    scoreAiRecruitObservation(observationWithBoard([minion])).boardPower;
  const empty = visibleBoardPower(
    fishObservation(template, { learned: false }),
  );
  const learnedOrdinary = visibleBoardPower(fishObservation(template));
  const learnedGoldenSource = visibleBoardPower(
    fishObservation(template, { learnedGolden: true }),
  );
  const emptyGoldenHost = visibleBoardPower(
    fishObservation(template, { golden: true, learned: false }),
  );
  const learnedGoldenHost = visibleBoardPower(
    fishObservation(template, { golden: true }),
  );

  assert.ok(empty < learnedOrdinary);
  assert.ok(learnedOrdinary < learnedGoldenSource);
  assert.ok(learnedGoldenHost > learnedOrdinary);
  const ordinaryHostMarginal = learnedOrdinary - empty;
  const goldenHostMarginal = learnedGoldenHost - emptyGoldenHost;
  const expectedGoldenHostMarginal = ordinaryHostMarginal * 2;
  assert.ok(
    Math.abs(goldenHostMarginal - expectedGoldenHostMarginal) <=
      Number.EPSILON *
        Math.max(1, Math.abs(expectedGoldenHostMarginal)) *
        8,
    "Golden Fish should double the marginal value of its learned Deathrattle",
  );
  assert.equal(
    visibleBoardPower(fishObservation(template, { learnedGolden: true })),
    learnedGoldenSource,
  );
});

test("planner sells the empty Fish before an otherwise equal learned Fish", () => {
  const initial = new AiTrainingEnvironment(0x8b11, 0).observe();
  const template = structuredClone(initial.own.shop[0]) as unknown as
    AiTrainingMinionObservation;
  assert.ok(template);
  const emptyFish = fishObservation(template, { learned: false });
  const learnedFish = fishObservation(template);
  const fillers = Array.from({ length: 5 }, () => ({
    ...structuredClone(template),
    learnedDeathrattles: [],
  }));
  const observation = observationWithBoard([
    learnedFish,
    emptyFish,
    ...fillers,
  ]);
  observation.own.hand = [
    {
      ...structuredClone(template),
      attack: 1_000,
      health: 1_000,
      learnedDeathrattles: [],
    },
  ];
  const sellEmpty: Readonly<AiTrainingLegalAction> = Object.freeze({
    token: "sell-empty-fish",
    type: "SELL_MINION",
    source: { zone: "board" as const, index: 1 },
    target: null,
    boardIndex: null,
    choiceIndex: null,
    cost: null,
    plannerDisposition: "replan",
  });
  const sellLearned: Readonly<AiTrainingLegalAction> = Object.freeze({
    ...sellEmpty,
    token: "sell-learned-fish",
    source: { zone: "board" as const, index: 0 },
  });
  const endTurn: Readonly<AiTrainingLegalAction> = Object.freeze({
    token: "end-turn",
    type: "END_TURN",
    source: null,
    target: null,
    boardIndex: null,
    choiceIndex: null,
    cost: null,
    plannerDisposition: "terminal",
  });

  const plan = planAiRecruitTurn(
    replanOnlyEnvironment(observation, [sellLearned, sellEmpty, endTurn]),
    { beamWidth: 2, maxActions: 1 },
  );

  assert.equal(plan.termination, "replanAfterAction");
  assert.equal(plan.actions[0]?.token, sellEmpty.token);
});

test("planner refuses Combat instead of branching on hidden battle state", () => {
  const environment = new AiTrainingEnvironment(0x8b04, 1);
  const endTurn = environment
    .legalActions()
    .find((action) => action.type === "END_TURN");
  assert.ok(endTurn);
  assert.equal(environment.step(endTurn.token).accepted, true);
  assert.equal(environment.observe().public.phase, "combat");
  assert.throws(
    () => planAiRecruitTurn(environment),
    /requires the Recruit phase/,
  );
});
