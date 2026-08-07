import assert from "node:assert/strict";
import test from "node:test";

import {
  AiTrainingEnvironment,
  type AiTrainingLegalAction,
} from "../lib/game/ai-training-environment.ts";

function actionByType(
  environment: AiTrainingEnvironment,
  type: AiTrainingLegalAction["type"],
): Readonly<AiTrainingLegalAction> {
  const action = environment
    .legalActions()
    .find((candidate) => candidate.type === type);
  assert.ok(action, `expected legal ${type} action`);
  return action;
}

test("training environment exposes deterministic opaque legal actions", () => {
  const first = new AiTrainingEnvironment(0x8a01, 3);
  const second = new AiTrainingEnvironment(0x8a01, 3);

  assert.deepEqual(first.observe(), second.observe());
  assert.deepEqual(first.legalActions(), second.legalActions());
  assert.equal(first.observe().controlledSeat, 3);
  assert.equal(first.observe().own.isHuman, true);

  const actions = first.legalActions();
  assert.ok(actions.length > 0);
  assert.equal(Object.isFrozen(actions), true);
  actions.forEach((action, index) => {
    assert.equal(action.token, `0:${index}`);
    assert.equal(Object.isFrozen(action), true);
    if (action.cost) assert.equal(Object.isFrozen(action.cost), true);
  });
  const serialized = JSON.stringify(actions);
  for (const forbidden of [
    "instanceId",
    "interactionId",
    "playerId",
    "player-",
    "rngState",
    "spellPool",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.throws(() => {
    (actions as AiTrainingLegalAction[]).pop();
  }, TypeError);
});

test("training environments can exercise and observe active Hero Powers", () => {
  const environment = new AiTrainingEnvironment(0x8a11, 0, 40, {
    heroPowerId: "hero-power-tb_baconshop_hp_047",
  });
  const action = actionByType(environment, "ACTIVATE_HERO_POWER");
  assert.deepEqual(action.cost, { currency: "gold", amount: 1 });

  const result = environment.step(action.token);

  assert.equal(result.accepted, true);
  assert.equal(result.environmentVersion, 4);
  assert.equal(result.observation.own.gold, 2);
  assert.equal(result.observation.own.heroPowerActiveThisTurn, true);
  assert.equal(result.observation.own.heroPowerCounters.eliseUses, 1);
  assert.equal(
    result.observation.own.pendingInteraction?.kind,
    "discover",
  );
  assert.equal(
    result.legalActions.some(
      (candidate) => candidate.type === "ACTIVATE_HERO_POWER",
    ),
    false,
  );

  const reset = environment.reset(0x8a11);
  assert.equal(
    reset.own.heroPowerId,
    "hero-power-tb_baconshop_hp_047",
  );
  assert.equal(reset.own.heroPowerActiveThisTurn, false);
});

test("training configuration rejects explicitly unsupported Hero Powers", () => {
  assert.throws(
    () =>
      new AiTrainingEnvironment(0x8a12, 0, 40, {
        heroPowerId: "hero-power-tb_baconshop_hp_043",
      }),
    /Unsupported training Hero Power/u,
  );
});

test("every advertised initial action is accepted by the real reducer", () => {
  const seed = 0x8a02;
  const baseline = new AiTrainingEnvironment(seed, 5);
  const advertised = baseline.legalActions();
  assert.ok(advertised.some((action) => action.type === "BUY_MINION"));
  assert.ok(advertised.some((action) => action.type === "END_TURN"));

  for (const expected of advertised) {
    const environment = new AiTrainingEnvironment(seed, 5);
    assert.deepEqual(
      environment
        .legalActions()
        .find((action) => action.token === expected.token),
      expected,
    );
    const result = environment.step(expected.token);
    assert.equal(result.accepted, true, JSON.stringify(expected));
    assert.deepEqual(result.action, expected);
  }
});

test("invalid tokens are inert and one controlled seat can play full phases", () => {
  const environment = new AiTrainingEnvironment(0x8a03, 4);
  const initial = environment.observe();
  const rejected = environment.step("invalid");
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.randomnessConsumed, false);
  assert.equal(rejected.action, null);
  assert.equal(rejected.done, false);
  assert.deepEqual(rejected.observation, initial);
  assert.deepEqual(rejected.rewardSignals, {
    healthDelta: 0,
    armorDelta: 0,
    goldDelta: 0,
    boardSizeDelta: 0,
    handSizeDelta: 0,
    tavernTierDelta: 0,
    battleResult: null,
    damageDealt: 0,
    damageTaken: 0,
    placement: null,
    terminalPlacementReward: null,
  });

  const buy = actionByType(environment, "BUY_MINION");
  const staleEndTurn = actionByType(environment, "END_TURN");
  const afterBuy = environment.step(buy.token);
  assert.equal(afterBuy.accepted, true);
  assert.equal(afterBuy.observation.own.gold, 0);
  assert.equal(afterBuy.observation.own.hand.length, 1);
  assert.equal(afterBuy.rewardSignals.goldDelta, -3);
  assert.equal(afterBuy.rewardSignals.handSizeDelta, 1);
  const rejectedStaleAction = environment.step(staleEndTurn.token);
  assert.equal(rejectedStaleAction.accepted, false);
  assert.equal(rejectedStaleAction.action, null);

  const endTurn = actionByType(environment, "END_TURN");
  const afterCombat = environment.step(endTurn.token);
  assert.equal(afterCombat.accepted, true);
  assert.equal(afterCombat.observation.public.phase, "combat");
  assert.ok(afterCombat.ownBattle);
  assert.equal(afterCombat.ownBattle.round, 1);
  assert.equal(afterCombat.rewardSignals.battleResult, afterCombat.ownBattle.result);
  assert.deepEqual(
    afterCombat.legalActions.map((action) => action.type),
    afterCombat.done ? [] : ["CONTINUE"],
  );

  if (!afterCombat.done) {
    const afterContinue = environment.step(afterCombat.legalActions[0].token);
    assert.equal(afterContinue.accepted, true);
    assert.equal(afterContinue.observation.public.phase, "recruit");
    assert.equal(afterContinue.observation.public.round, 2);
    assert.equal(afterContinue.ownBattle, null);
  }

  const reset = environment.reset(0x8a03, 4);
  assert.deepEqual(reset, initial);
  assert.throws(() => environment.reset(1, -1), RangeError);
  assert.deepEqual(environment.observe(), initial);
});

test("legal-action probing does not consume RNG or alter the next transition", () => {
  const inspected = new AiTrainingEnvironment(0x8a04, 2);
  const untouched = new AiTrainingEnvironment(0x8a04, 2);
  inspected.legalActions();
  inspected.legalActions();

  const inspectedBuy = actionByType(inspected, "BUY_MINION");
  const untouchedBuy = actionByType(untouched, "BUY_MINION");
  assert.deepEqual(inspectedBuy, untouchedBuy);
  const inspectedResult = inspected.step(inspectedBuy.token);
  const untouchedResult = untouched.step(untouchedBuy.token);
  assert.deepEqual(inspectedResult, untouchedResult);
});

test("steps report stochastic boundaries without exposing RNG state", () => {
  const environment = new AiTrainingEnvironment(0x8a07, 1);
  const refresh = actionByType(environment, "REFRESH_SHOP");
  const result = environment.step(refresh.token);
  assert.equal(result.accepted, true);
  assert.equal(result.randomnessConsumed, true);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("rngState"), false);
});

test("planner transitions structurally hide replan outcomes", () => {
  const environment = new AiTrainingEnvironment(0x8a08, 1);
  const before = environment.observe();
  const refresh = environment
    .plannerLegalActions()
    .find((action) => action.type === "REFRESH_SHOP");
  assert.ok(refresh);
  assert.equal(refresh.plannerDisposition, "replan");
  const boundary = environment.plannerTransition(refresh.token);
  assert.deepEqual(boundary, {
    kind: "replanBoundary",
    action: refresh,
  });
  assert.deepEqual(environment.observe(), before);
  const serialized = JSON.stringify(boundary);
  for (const forbidden of ["observation", "environment", "rngState"]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }

  const toggle = environment
    .plannerLegalActions()
    .find((action) => action.type === "TOGGLE_FREEZE");
  assert.ok(toggle);
  assert.equal(toggle.plannerDisposition, "deterministic");
  const deterministic = environment.plannerTransition(toggle.token);
  assert.equal(deterministic.kind, "deterministic");
  if (deterministic.kind === "deterministic") {
    assert.equal(deterministic.observation.own.frozen, true);
  }
  assert.deepEqual(environment.observe(), before);
});

test("deterministic planner actions never cross actual RNG boundaries", () => {
  for (const seed of [0x8a09, 0x8a0a, 0x8a0b]) {
    const baseline = new AiTrainingEnvironment(seed, seed % 8);
    for (const action of baseline.plannerLegalActions()) {
      const branch = baseline.fork();
      const result = branch.step(action.token, {
        includeLegalActions: false,
      });
      assert.equal(result.accepted, true, JSON.stringify(action));
      if (action.plannerDisposition === "deterministic") {
        assert.equal(
          result.randomnessConsumed,
          false,
          JSON.stringify(action),
        );
      }
    }
  }
});

test("fast planner mask stays identical to the reducer-backed mask", () => {
  const describe = (action: Readonly<AiTrainingLegalAction>) => {
    return {
      type: action.type,
      source: action.source,
      target: action.target,
      boardIndex: action.boardIndex,
      choiceIndex: action.choiceIndex,
      cost: action.cost,
      plannerDisposition: action.plannerDisposition,
    };
  };
  for (const seed of [0x8a0c, 0x8a0d]) {
    const environment = new AiTrainingEnvironment(seed, seed % 8);
    let recruitActions = 0;
    let observedRound = 1;
    for (let transition = 0; transition < 24; transition += 1) {
      const observation = environment.observe();
      if (observation.public.phase === "gameOver") break;
      if (observation.public.round !== observedRound) {
        observedRound = observation.public.round;
        recruitActions = 0;
      }
      const planner = environment.plannerLegalActions();
      const exhaustive = environment.legalActions();
      assert.deepEqual(
        planner.map(describe),
        exhaustive
          .filter((action) => action.type !== "MOVE_MINION")
          .map(describe),
      );
      planner.forEach((action, index) => {
        assert.equal(
          action.token,
          `${transition}:planner:${index}`,
        );
      });
      const priorities =
        observation.public.phase === "combat"
          ? ["CONTINUE"]
          : recruitActions >= 5
            ? ["RESOLVE_INTERACTION", "END_TURN"]
            : [
                "RESOLVE_INTERACTION",
                "PLAY_HAND_CARD",
                "MAGNETIZE_MINION",
                "CAST_BLOOD_GEM",
                "CAST_TAVERN_SPELL",
                "CAST_SPELLCRAFT",
                "BUY_MINION",
                "BUY_TAVERN_SPELL",
                "UPGRADE_TAVERN",
                "END_TURN",
              ];
      const chosen = priorities
        .map((type) => planner.find((action) => action.type === type))
        .find((action) => action !== undefined);
      assert.ok(chosen);
      const result = environment.step(chosen.token, {
        includeLegalActions: false,
      });
      assert.equal(result.accepted, true, JSON.stringify(chosen));
      if (
        observation.public.phase === "recruit" &&
        chosen.type !== "END_TURN"
      ) {
        recruitActions += 1;
      }
      if (result.observation.public.round > 2) break;
    }
    assert.ok(environment.observe().public.round >= 2);
  }
});

test("fork creates an isolated deterministic branch", () => {
  const original = new AiTrainingEnvironment(0x8a06, 6);
  const before = original.observe();
  const fork = original.fork();
  assert.deepEqual(fork.observe(), before);
  assert.deepEqual(fork.legalActions(), original.legalActions());

  const forkBuy = actionByType(fork, "BUY_MINION");
  const forkResult = fork.step(forkBuy.token);
  assert.equal(forkResult.accepted, true);
  assert.deepEqual(original.observe(), before);

  const originalBuy = actionByType(original, "BUY_MINION");
  const originalResult = original.step(originalBuy.token);
  assert.deepEqual(originalResult, forkResult);
});

test("terminal placement reward is emitted only when placement first appears", () => {
  const environment = new AiTrainingEnvironment(0x8a05, 0, 1);
  const endTurn = actionByType(environment, "END_TURN");
  const terminal = environment.step(endTurn.token);
  assert.equal(terminal.done, true);
  assert.ok(terminal.rewardSignals.placement);
  assert.notEqual(terminal.rewardSignals.terminalPlacementReward, null);

  const repeated = environment.step("invalid");
  assert.equal(repeated.accepted, false);
  assert.equal(repeated.done, true);
  assert.equal(repeated.rewardSignals.placement, terminal.rewardSignals.placement);
  assert.equal(repeated.rewardSignals.terminalPlacementReward, null);
});
