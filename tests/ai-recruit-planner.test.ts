import assert from "node:assert/strict";
import test from "node:test";

import {
  planAiRecruitTurn,
  scoreAiRecruitObservation,
} from "../lib/game/ai-recruit-planner.ts";
import { AiTrainingEnvironment } from "../lib/game/ai-training-environment.ts";

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
