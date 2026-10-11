import assert from "node:assert/strict";
import test from "node:test";

import { AI_STRATEGY_PROFILES } from "../lib/game/ai.ts";
import { AiTrainingEnvironment } from "../lib/game/ai-training-environment.ts";
import { JEV_PINNED_MODEL, JevClientError, type JevQuestion, type JevResponse } from "../scripts/ai-jev-client.ts";
import { createJevDecisionRequest, isJevCriticalCheckpoint, runJevRecruitTurn, selectJevCandidates,
  type JevRecruitEnvironment, type JevDecisionRecord } from "../scripts/ai-jev-policy.ts";

const profile = AI_STRATEGY_PROFILES[0];

function response(questions: Record<string, JevQuestion>, choice: string, confidence = 1): JevResponse {
  return { model: JEV_PINNED_MODEL, answers: Object.fromEntries(Object.entries(questions).map(([id, question]) => {
    assert.equal(question.type, "choice");
    if (question.type !== "choice") throw new Error("fixture only supports Choice");
    const count = Object.keys(question.criteria).length;
    const maximum = confidence * (1 - 1 / count) + 1 / count;
    return [id, { type: "choice" as const, choice, confidence,
      probabilities: Object.fromEntries(Object.keys(question.criteria).map((key) => [key,
        key === choice ? maximum : (1 - maximum) / (count - 1)])) }];
  })), usage: { input_tokens: 100, output_tokens: 40 }, latencyMs: 2 };
}

/** Lightweight runner fixture. Exact production parity is tested separately. */
function fixture(seed = 96_100_001) {
  const engine = new AiTrainingEnvironment(seed);
  let legacyCalls = 0;
  const environment: JevRecruitEnvironment = {
    observe: () => engine.observe(),
    safeRecruitLegalActions: () => engine.legalActions(),
    plannerLegalActions: () => engine.plannerLegalActions(),
    plannerTransition: (token) => engine.plannerTransition(token),
    step: (token, options) => engine.step(token, options),
    completeLegacyRecruitTurn: () => {
      legacyCalls += 1;
      const end = engine.legalActions().find((action) => action.type === "END_TURN");
      assert.ok(end);
      return engine.step(end.token, { includeLegalActions: false });
    },
  };
  return { engine, environment, legacyCalls: () => legacyCalls };
}

test("Jev input has visible cards/effects and token-free legal actions, not private state", () => {
  const { engine, environment } = fixture();
  const before = engine.observe();
  const actions = selectJevCandidates(environment, profile, { refreshes: 0, freezes: 0, moves: 0 });
  const request = createJevDecisionRequest(environment, actions, profile);
  assert.deepEqual(engine.observe(), before, "local counterfactuals must not execute real actions");
  const serialized = JSON.stringify(request);
  for (const forbidden of ["rngState", "seed", "instanceId", "humanPlayerId", "minionPool", "spellPool", "player-", '"token"']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.match(serialized, /description/);
  assert.equal(request.state.candidates.length, actions.length);
  assert.equal(Object.keys(request.questions).length, 4);
  assert.ok(actions.some((action) => action.type === "END_TURN"));
  assert.ok(request.state.candidates.some((action) => action.deterministicDelta !== null));
});

test("all-decisions applies a legal buy, reobserves new hand, then ends the turn", async () => {
  const { environment, legacyCalls } = fixture();
  const records: JevDecisionRecord[] = [];
  let calls = 0;
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
    onDecision: (record) => records.push(record), client: { evaluate: async (state, questions) => {
      const visible = state as { observation: { own: { hand: unknown[] } }; candidates: { id: string; type: string }[] };
      const type = calls++ === 0 ? "BUY_MINION" : "END_TURN";
      if (calls === 2) assert.equal(visible.observation.own.hand.length, 1);
      const action = visible.candidates.find((candidate) => candidate.type === type);
      assert.ok(action);
      return response(questions, action.id);
    } },
  });
  assert.equal(result.appliedActions, 2);
  assert.equal(result.successfulResponses, 2);
  assert.equal(result.completed, true);
  assert.equal(legacyCalls(), 0);
  assert.equal(records.every((record) => record.status === "applied"), true);
  assert.equal(JSON.stringify(records).includes('"token"'), false);
});

test("critical mode hands an ordinary opening directly to the existing policy", async () => {
  const { environment, legacyCalls } = fixture();
  assert.equal(isJevCriticalCheckpoint(environment.observe(), environment.safeRecruitLegalActions()), false);
  const result = await runJevRecruitTurn(environment, { mode: "critical-decisions", model: JEV_PINNED_MODEL, profile,
    client: { evaluate: async () => { throw new Error("must not call for ordinary opening"); } },
  });
  assert.equal(result.calls, 0);
  assert.equal(result.fallbacks["non-critical"], 1);
  assert.equal(result.completed, true);
  assert.equal(legacyCalls(), 1);
});

test("low confidence and abstention finish locally without interpreting confidence as win rate", async () => {
  for (const confidence of [0.4, 1]) {
    const { environment, legacyCalls } = fixture();
    const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
      client: { evaluate: async (_state, questions) => response(questions, "legacy", confidence) },
    });
    assert.equal(result.appliedActions, 0);
    assert.equal(result.completed, true);
    assert.equal(legacyCalls(), 1);
    assert.equal(result.fallbacks[confidence < 0.65 ? "low-confidence" : "model-abstained"], 1);
  }
});

test("inflated provider confidence cannot override a diffuse Choice distribution", async () => {
  const { environment, legacyCalls } = fixture();
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
    client: { evaluate: async (state, questions) => {
      const buy = (state as { candidates: { id: string; type: string }[] }).candidates.find((item) => item.type === "BUY_MINION");
      assert.ok(buy);
      const answer = response(questions, buy.id, 0.4);
      for (const item of Object.values(answer.answers)) {
        assert.equal(item.type, "choice");
        if (item.type === "choice") item.confidence = 1;
      }
      return answer;
    } },
  });
  assert.equal(result.appliedActions, 0);
  assert.equal(result.fallbacks["low-confidence"], 1);
  assert.equal(result.completed, true);
  assert.equal(legacyCalls(), 1);
});

test("a reply for an older action mask is never applied", async () => {
  const { engine, environment, legacyCalls } = fixture();
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
    client: { evaluate: async (state, questions) => {
      const old = (state as { candidates: { id: string; type: string }[] }).candidates.find((item) => item.type === "BUY_MINION");
      assert.ok(old);
      const refresh = engine.legalActions().find((item) => item.type === "REFRESH_SHOP");
      assert.ok(refresh);
      assert.equal(engine.step(refresh.token).accepted, true);
      return response(questions, old.id);
    } },
  });
  assert.equal(result.staleResponses, 1);
  assert.equal(result.appliedActions, 0);
  assert.equal(legacyCalls(), 1);
});

test("malformed results, timeout and exhausted budgets safely finish locally", async () => {
  for (const code of ["timeout", "budget", "response"] as const) {
    const { environment, legacyCalls } = fixture();
    const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
      client: { evaluate: async (_state, questions) => {
        if (code === "response") return response(questions, "unknown-action");
        throw new JevClientError(code);
      } },
    });
    assert.equal(result.fallbacks[code], 1);
    assert.equal(result.appliedActions, 0);
    assert.equal(legacyCalls(), 1);
  }
});

test("turn decision budget and refresh guards prevent unbounded calls", async () => {
  const { environment, legacyCalls } = fixture();
  const limited = selectJevCandidates(environment, profile, { refreshes: 100, freezes: 1, moves: 2 });
  assert.equal(limited.some((action) => ["REFRESH_SHOP", "TOGGLE_FREEZE", "MOVE_MINION"].includes(action.type)), false);
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile, maxDecisionsPerTurn: 1,
    client: { evaluate: async (state, questions) => {
      const buy = (state as { candidates: { id: string; type: string }[] }).candidates.find((action) => action.type === "BUY_MINION");
      assert.ok(buy);
      return response(questions, buy.id);
    } },
  });
  assert.equal(result.calls, 1);
  assert.equal(result.limitHits, 1);
  assert.equal(result.fallbacks["decision-limit"], 1);
  assert.equal(legacyCalls(), 1);
});

test("cancellation before a query makes no request and completes the paused recruit safely", async () => {
  const { environment, legacyCalls } = fixture();
  const controller = new AbortController();
  controller.abort();
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile, signal: controller.signal,
    client: { evaluate: async () => { throw new Error("no request expected"); } },
  });
  assert.equal(result.calls, 0);
  assert.equal(result.fallbacks.aborted, 1);
  assert.equal(legacyCalls(), 1);
});

test("oversized visible descriptions abstain before fetch without truncating card effects", async () => {
  const { environment, legacyCalls } = fixture();
  const originalObserve = environment.observe;
  environment.observe = () => {
    const observation = originalObserve();
    return { ...observation, own: { ...observation.own,
      shop: observation.own.shop.map((card, index) => index === 0 ? { ...card, description: "完整效果".repeat(12_000) } : card),
    } };
  };
  let requests = 0;
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
    onDecision: (record) => {
      const visible = record.state as { observation: { own: { shop: { description: string }[] } } };
      assert.equal(visible.observation.own.shop[0].description.length, 48_000);
      assert.equal(record.status, "input-limit");
    },
    client: { evaluate: async () => { requests += 1; throw new Error("oversized request must not be sent"); } },
  });
  assert.equal(requests, 0);
  assert.equal(result.calls, 0);
  assert.equal(result.fallbacks["input-limit"], 1);
  assert.equal(result.completed, true);
  assert.equal(legacyCalls(), 1);
});

test("HTTP access refusal records status only and makes no retry", async () => {
  const { environment } = fixture();
  const records: JevDecisionRecord[] = [];
  const result = await runJevRecruitTurn(environment, { mode: "all-decisions", model: JEV_PINNED_MODEL, profile,
    onDecision: (record) => records.push(record),
    client: { evaluate: async () => { throw new JevClientError("http", 451); } },
  });
  assert.equal(result.calls, 1);
  assert.equal(result.appliedActions, 0);
  assert.equal(result.completed, true);
  assert.equal(records[0].providerStatus, 451);
  assert.equal(records[0].status, "http");
});
