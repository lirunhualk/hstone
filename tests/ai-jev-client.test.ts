import assert from "node:assert/strict";
import test from "node:test";

import {
  createJevClient,
  JevClientError,
  JEV_ENDPOINT,
  JEV_PINNED_MODEL,
  jevChoiceConfidence,
  reserveJevInputTokens,
  validateJevResponse,
  type JevClientOptions,
  type JevQuestion,
  type JevValidationRule,
  type JevRequestSettlement,
} from "../scripts/ai-jev-client.ts";

const questions: Record<string, JevQuestion> = {
  action: { type: "choice", instructions: "Choose the strongest legal action", criteria: { buy: "Buy", finish: "Finish" } },
  tempo: { type: "score", instructions: "Immediate improvement", criteria: ["None", "Moderate", "Large"] },
  safe: { type: "noul", instructions: "Preserves the core", criteria: { true: "Preserves", false: "Destroys" } },
};

function responseValue() {
  return {
    model: JEV_PINNED_MODEL,
    answers: {
      action: { type: "choice", choice: "buy", confidence: 0.8, probabilities: { buy: 0.9, finish: 0.1 } },
      tempo: { type: "score", score: 1.5, confidence: 0.5, probabilities: { "0": 0, "1": 0.5, "2": 0.5 }, legend: { "0": "None", "1": "Moderate", "2": "Large" } },
      safe: { type: "noul", noul: 0.95 },
    },
    usage: { input_tokens: 400, output_tokens: 80 },
  };
}

function options(overrides: Partial<JevClientOptions> = {}): JevClientOptions {
  return {
    apiKey: "not-a-real-key",
    model: JEV_PINNED_MODEL,
    budget: { maxRequests: 3, maxInputTokens: 32_000, maxInputTokensPerRequest: 16_000, maxTotalLatencyMs: 10_000 },
    timeoutMs: 500,
    fetch: async () => Response.json(responseValue()),
    ...overrides,
  };
}

test("transport failures preserve only enumerated nested network codes and unknown charged usage", async () => {
  const settlements: JevRequestSettlement[] = [];
  const native = new TypeError("vendor-detail-marker", { cause: Object.assign(new Error("private-detail-marker"), { code: "ECONNRESET", address: "private-detail-marker" }) });
  const client = createJevClient(options({ fetch: async () => { throw native; }, onRequestSettled: (value) => settlements.push(value) }));
  await assert.rejects(client.evaluate({ gold: 3 }, questions), (error: unknown) => {
    assert.ok(error instanceof JevClientError);
    assert.equal(error.code, "transport");
    assert.equal(error.transportCode, "ECONNRESET");
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(error.message + JSON.stringify(error), /detail-marker/);
    return true;
  });
  assert.equal(settlements.length, 1);
  assert.equal(settlements[0].kind, "error");
  if (settlements[0].kind === "error") assert.equal(settlements[0].transportCode, "ECONNRESET");
  assert.equal(settlements[0].knownUsage, null);
  assert.equal(settlements[0].requestSent, true);
  assert.equal(client.getUsage().unknownUsageRequests, 1);
  assert.doesNotMatch(JSON.stringify(settlements), /detail-marker/);
});

test("transport diagnostics drop unknown codes and tolerate cyclic or throwing causes", async () => {
  const cycle: { cause?: unknown; code: string } = { code: "private-detail-marker" };
  cycle.cause = cycle;
  const throwing = Object.defineProperty({}, "code", { get() { throw new Error("private-detail-marker"); } });
  for (const cause of [cycle, throwing]) {
    const settlements: JevRequestSettlement[] = [];
    const client = createJevClient(options({ fetch: async () => { throw new TypeError("vendor-detail-marker", { cause }); }, onRequestSettled: (value) => settlements.push(value) }));
    await assert.rejects(client.evaluate({ gold: 3 }, questions), (error: unknown) => {
      assert.ok(error instanceof JevClientError);
      assert.equal(error.code, "transport");
      assert.equal(error.transportCode, undefined);
      assert.doesNotMatch(error.message + JSON.stringify(error), /detail-marker/);
      return true;
    });
    assert.equal(settlements.length, 1);
    if (settlements[0].kind === "error") assert.equal(settlements[0].transportCode, undefined);
  }
});

test("transport diagnostics keep certificate failures distinct and reject arbitrary constructor metadata", async () => {
  const client = createJevClient(options({ fetch: async () => { throw new TypeError("vendor-detail-marker", { cause: { code: "ERR_TLS_CERT_ALTNAME_INVALID" } }); } }));
  await assert.rejects(client.evaluate({}, questions), (error: unknown) => {
    assert.ok(error instanceof JevClientError);
    assert.equal(error.transportCode, "ERR_TLS_CERT_ALTNAME_INVALID");
    return true;
  });
  assert.equal(new JevClientError("transport", undefined, undefined, undefined, "private-detail-marker" as never).transportCode, undefined);
  assert.equal(new JevClientError("response", undefined, undefined, undefined, "ECONNRESET").transportCode, undefined);
});

test("Jev sends vendor wire schema with pinned model and exposes validated metadata", async () => {
  let calls = 0;
  const client = createJevClient(options({ fetch: async (url, init) => {
    calls += 1;
    assert.equal(url, JEV_ENDPOINT);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer not-a-real-key");
    assert.deepEqual(JSON.parse(init?.body as string), { state: { gold: 3 }, model: JEV_PINNED_MODEL, questions });
    return Response.json(responseValue());
  } }));
  const result = await client.evaluate({ gold: 3 }, questions);
  assert.equal(result.model, JEV_PINNED_MODEL);
  assert.deepEqual(result.answers.action, responseValue().answers.action);
  assert.deepEqual(result.answers.tempo, responseValue().answers.tempo);
  assert.deepEqual(result.answers.safe, responseValue().answers.safe);
  assert.ok(result.latencyMs >= 0);
  assert.equal(calls, 1);
  assert.equal(client.getUsage().inputTokens, 400);
  assert.equal(client.getUsage().outputTokens, 80);
  assert.equal(client.getUsage().stopped, false);
  const copy = client.getUsage();
  copy.requests = 99;
  assert.equal(client.getUsage().requests, 1);
});

test("Jev accepts structured instructions and null choice rubrics", async () => {
  const client = createJevClient(options({ fetch: async () => Response.json({ model: JEV_PINNED_MODEL, answers: { action: responseValue().answers.action }, usage: { input_tokens: 200, output_tokens: 20 } }) }));
  const result = await client.evaluate(["state", { gold: 3 }], {
    action: { type: "choice", instructions: { question: "Choose", constraints: ["legal"] }, criteria: { buy: null, finish: { description: "Finish", examples: ["zero gold"] } } },
  });
  assert.equal(result.answers.action.type, "choice");
});

test("Jev rejects unpinned models, unsafe destinations and invalid budgets before fetch", () => {
  const credentialedDestination = new URL(JEV_ENDPOINT);
  credentialedDestination.username = "user";
  credentialedDestination.password = "placeholder";
  for (const overrides of [
    { model: "jev-latest" },
    { model: "jev-preview" },
    { apiKey: "" },
    { apiKey: "secret\r\nheader" },
    { endpoint: "http://api.typesafe.ai/v1/systemone" },
    { endpoint: "https://api.typesafe.ai.attacker.example/v1/systemone" },
    { endpoint: "https://api.typesafe.ai/v1/systemone?secret=x" },
    { endpoint: credentialedDestination.href },
    { endpoint: "http://127.0.0.1:8000/v1/systemone" },
    { budget: {} as JevClientOptions["budget"] },
    { timeoutMs: 0 },
    { timeoutMs: 60_001 },
  ]) assert.throws(() => createJevClient(options(overrides)), (error) => error instanceof JevClientError && error.code === "configuration");
  assert.doesNotThrow(() => createJevClient(options({ endpoint: "http://127.0.0.1:8000/v1/systemone", allowLoopbackFixture: true })));
});

test("Jev validates JSON and question shapes before using request budget", async () => {
  let calls = 0;
  const client = createJevClient(options({ fetch: async () => { calls += 1; return Response.json(responseValue()); } }));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  for (const invalid of [cycle, { missing: undefined }, { bad: NaN }, null, 1, new Date()]) {
    await assert.rejects(client.evaluate(invalid, questions), (error) => error instanceof JevClientError && error.code === "request");
  }
  for (const invalid of [
    {},
    { action: { type: "score", instructions: "score", criteria: ["single"] } },
    { action: { type: "choice", instructions: "choice", criteria: { one: "one" } } },
    { action: { type: "noul", instructions: "bool", criteria: { maybe: "maybe" } } },
  ]) await assert.rejects(client.evaluate("state", invalid as Record<string, JevQuestion>), (error) => error instanceof JevClientError && error.code === "request");
  assert.equal(calls, 0);
  assert.equal(client.getUsage().requests, 0);
});

test("Jev rejects schema mismatches and inconsistent probabilities", async () => {
  const mutations: Array<(value: ReturnType<typeof responseValue>) => void> = [
    (value) => { value.model = "jev-9.9.9"; },
    (value) => { value.answers.action.type = "noul"; },
    (value) => { value.answers.action.choice = "illegal"; },
    (value) => { value.answers.action.choice = "finish"; },
    (value) => { value.answers.action.confidence = 1.01; },
    (value) => { value.answers.action.probabilities.buy = 0.2; },
    (value) => { value.answers.tempo.score = 2; },
    (value) => { value.answers.tempo.legend["0"] = "Wrong scale"; },
    (value) => { value.answers.safe.noul = -0.1; },
    (value) => { value.usage.input_tokens = -1; },
  ];
  for (const mutate of mutations) {
    const value = responseValue();
    mutate(value);
    const client = createJevClient(options({ fetch: async () => Response.json(value) }));
    await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && error.code === "response");
    assert.equal(client.getUsage().stopped, true);
  }
  const missing = responseValue();
  const otherAnswers = { action: missing.answers.action, tempo: missing.answers.tempo };
  const client = createJevClient(options({ fetch: async () => Response.json({ ...missing, answers: otherAnswers }) }));
  await assert.rejects(client.evaluate("state", questions), /\(response\)/);
});

test("Jev validation failures identify exact constant rules without raw provider fields", () => {
  const cases: Array<{ rule: JevValidationRule; mutate: (value: ReturnType<typeof responseValue>) => void }> = [
    { rule: "model", mutate: (value) => { value.model = "untrusted-provider-fragment"; } },
    { rule: "answers", mutate: (value) => { Object.assign(value.answers, { "untrusted-provider-fragment": {} }); } },
    { rule: "usage", mutate: (value) => { value.usage.input_tokens = -1; } },
    { rule: "answer-type", mutate: (value) => { value.answers.action.type = "untrusted-provider-fragment"; } },
    { rule: "confidence", mutate: (value) => { value.answers.action.confidence = 1.01; } },
    { rule: "distribution-keys", mutate: (value) => { Object.assign(value.answers.action.probabilities, { "untrusted-provider-fragment": 0 }); } },
    { rule: "distribution-range", mutate: (value) => { value.answers.action.probabilities.buy = NaN; } },
    { rule: "choice", mutate: (value) => { value.answers.action.choice = "untrusted-provider-fragment"; } },
    { rule: "choice-argmax", mutate: (value) => { value.answers.action.choice = "finish"; } },
    { rule: "score", mutate: (value) => { value.answers.tempo.score = 2; } },
    { rule: "legend", mutate: (value) => { value.answers.tempo.legend["0"] = "untrusted-provider-fragment"; } },
    { rule: "noul", mutate: (value) => { value.answers.safe.noul = -0.1; } },
  ];
  for (const { rule, mutate } of cases) {
    const value = responseValue();
    mutate(value);
    assert.throws(() => validateJevResponse(value, questions, JEV_PINNED_MODEL), (error) => {
      assert.ok(error instanceof JevClientError);
      assert.equal(error.code, "response");
      assert.equal(error.validationRule, rule);
      assert.equal(error.validationDiagnostic, undefined);
      assert.match(error.message, /Jev evaluation failed \(response\): rule/);
      assert.equal(JSON.stringify(error).includes("untrusted-provider-fragment"), false);
      assert.equal(error.message.includes("untrusted-provider-fragment"), false);
      return true;
    });
  }
});

function choiceVectorFixture(values: number[]) {
  const probabilities = Object.fromEntries(values.map((value, index) => [`a${index}`, value]));
  const criteria = Object.fromEntries(values.map((_value, index) => [`a${index}`, `Option ${index}`]));
  const vectorQuestions: Record<string, JevQuestion> = { action: { type: "choice", instructions: "Choose", criteria } };
  const value = { model: JEV_PINNED_MODEL, answers: { action: { type: "choice", choice: "a0", confidence: 0.8, probabilities } }, usage: { input_tokens: 100, output_tokens: 20 } };
  return { value, vectorQuestions };
}

test("Jev Choice confidence is derived from validated probabilities rather than provider confidence", () => {
  for (const [probabilities, expected] of [
    [{ a0: 0.5, a1: 0.5 }, 0],
    [{ a0: 1, a1: 0 }, 1],
    [{ a0: 0.9, a1: 0.1 }, 0.8],
    [{ a0: 0.6, a1: 0.3, a2: 0.1 }, 0.4],
    [{ a0: 0.34, a1: 0.33, a2: 0.33 }, 0.01],
  ] as const) {
    assert.ok(Math.abs(jevChoiceConfidence(probabilities) - expected) < 1e-12);
  }
  const { value, vectorQuestions } = choiceVectorFixture([0.34, 0.33, 0.33]);
  value.answers.action.confidence = 1;
  const before = structuredClone(value);
  const response = validateJevResponse(value, vectorQuestions, JEV_PINNED_MODEL);
  const answer = response.answers.action;
  assert.equal(answer.type, "choice");
  if (answer.type !== "choice") throw new Error("expected Choice");
  assert.ok(Math.abs(jevChoiceConfidence(answer.probabilities) - 0.01) < 1e-12);
  assert.equal(answer.confidence, 1, "provider metadata remains available for audit");
  assert.deepEqual(value, before);
});

test("Jev Choice confidence normalizes accepted rounding mass without changing the raw vector", () => {
  for (const values of [[0.63, ...Array<number>(12).fill(0.03)], [0.65, ...Array<number>(12).fill(0.03)], [0.99, 0]]) {
    const { value, vectorQuestions } = choiceVectorFixture(values);
    const response = validateJevResponse(value, vectorQuestions, JEV_PINNED_MODEL);
    const answer = response.answers.action;
    assert.equal(answer.type, "choice");
    if (answer.type !== "choice") throw new Error("expected Choice");
    const before = { ...answer.probabilities };
    const mass = values.reduce((sum, item) => sum + item, 0);
    const expected = (values[0] / mass - 1 / values.length) / (1 - 1 / values.length);
    assert.ok(Math.abs(jevChoiceConfidence(answer.probabilities) - expected) < 1e-12);
    assert.deepEqual(answer.probabilities, before);
  }
  const invalidVectors: Array<Record<string, number>> = [{}, { a0: 1 }, { a0: 0, a1: 0 }, { a0: NaN, a1: 1 }, { a0: -0.1, a1: 1 }];
  for (const invalid of invalidVectors) {
    assert.throws(() => jevChoiceConfidence(invalid), (error) => error instanceof JevClientError && error.validationRule === "confidence");
  }
});

test("Jev accepts evidenced 13-option hundredth rounding and preserves raw probabilities and metadata", async () => {
  for (const values of [[0.63, ...Array<number>(12).fill(0.03)], [0.65, ...Array<number>(12).fill(0.03)]]) {
    const { value, vectorQuestions } = choiceVectorFixture(values);
    const before = structuredClone(value);
    const client = createJevClient(options({ fetch: async () => Response.json(value) }));
    const result = await client.evaluate("state", vectorQuestions);
    const answer = result.answers.action;
    assert.equal(answer.type, "choice");
    if (answer.type !== "choice") throw new Error("expected Choice");
    assert.deepEqual(answer.probabilities, before.answers.action.probabilities);
    assert.equal(answer.probabilities.a0, values[0]);
    assert.equal(answer.probabilities.a1, 0.03);
    assert.equal(result.choiceProbabilityRounding?.action.count, 13);
    assert.equal(result.choiceProbabilityRounding?.action.precision, 2);
    assert.ok(Math.abs((result.choiceProbabilityRounding?.action.sum ?? 0) - values.reduce((sum, item) => sum + item, 0)) < 1e-12);
    assert.deepEqual(validateJevResponse(result, vectorQuestions, JEV_PINNED_MODEL, result.latencyMs), result, "double validation recomputes rounding facts from raw values");
    assert.deepEqual(value, before, "wire response remains unchanged");
    assert.equal(client.getUsage().stopped, false);
  }
});

test("Jev rejects non-grid drift, excessive rounding, zero sums and breaches of the two-option bound", () => {
  for (const values of [
    [0.632, ...Array<number>(12).fill(0.03)],
    [0.61, ...Array<number>(12).fill(0.03)],
    [0.67, ...Array<number>(12).fill(0.03)],
    Array<number>(13).fill(0),
    [0.98, 0],
    [1, 0.02],
  ]) {
    const { value, vectorQuestions } = choiceVectorFixture(values);
    assert.throws(() => validateJevResponse(value, vectorQuestions, JEV_PINNED_MODEL), (error) => error instanceof JevClientError && error.validationRule === "distribution-sum");
  }
  const boundary = choiceVectorFixture([0.99, 0]);
  assert.equal(validateJevResponse(boundary.value, boundary.vectorQuestions, JEV_PINNED_MODEL).choiceProbabilityRounding?.action.count, 2);
  const exact = choiceVectorFixture([0.9, 0.1]);
  assert.equal(validateJevResponse(exact.value, exact.vectorQuestions, JEV_PINNED_MODEL).choiceProbabilityRounding, undefined);
});

test("Jev rounding accommodation retains exact keys, range, argmax, confidence and model checks", () => {
  const cases: Array<{ rule: JevValidationRule; mutate: (value: ReturnType<typeof choiceVectorFixture>["value"]) => void }> = [
    { rule: "distribution-keys", mutate: (value) => { delete value.answers.action.probabilities.a12; } },
    { rule: "distribution-range", mutate: (value) => { value.answers.action.probabilities.a0 = 1.01; } },
    { rule: "choice-argmax", mutate: (value) => { value.answers.action.choice = "a1"; } },
    { rule: "confidence", mutate: (value) => { value.answers.action.confidence = 1.01; } },
    { rule: "model", mutate: (value) => { value.model = "jev-9.9.9"; } },
  ];
  for (const { rule, mutate } of cases) {
    const { value, vectorQuestions } = choiceVectorFixture([0.63, ...Array<number>(12).fill(0.03)]);
    mutate(value);
    assert.throws(() => validateJevResponse(value, vectorQuestions, JEV_PINNED_MODEL), (error) => error instanceof JevClientError && error.validationRule === rule);
  }
});

test("Jev Score distributions and Noul endpoints keep their original strict validation", () => {
  const score = responseValue();
  score.answers.tempo.probabilities = { "0": 0, "1": 0.49, "2": 0.5 };
  score.answers.tempo.score = 1.49;
  assert.throws(() => validateJevResponse(score, questions, JEV_PINNED_MODEL), (error) => error instanceof JevClientError && error.validationRule === "distribution-sum");
  const noul = responseValue();
  noul.answers.safe.noul = 1.01;
  assert.throws(() => validateJevResponse(noul, questions, JEV_PINNED_MODEL), (error) => error instanceof JevClientError && error.validationRule === "noul");
});

test("Jev reports only sum and count after validating the complete finite probability vector", async () => {
  const value = responseValue();
  value.answers.action.probabilities.buy = 0.2;
  const client = createJevClient(options({ fetch: async () => Response.json(value) }));
  await assert.rejects(client.evaluate("state", questions), (error) => {
    assert.ok(error instanceof JevClientError);
    assert.equal(error.validationRule, "distribution-sum");
    assert.deepEqual(Object.keys(error.validationDiagnostic ?? {}).sort(), ["distributionCount", "distributionSum"]);
    assert.equal(error.validationDiagnostic?.distributionCount, 2);
    assert.ok(Math.abs((error.validationDiagnostic?.distributionSum ?? -1) - 0.3) < 1e-12);
    assert.equal(Object.isFrozen(error.validationDiagnostic), true);
    return true;
  });
  assert.equal(client.getUsage().stopped, true);
  await assert.rejects(client.evaluate("state", questions), /\(stopped\)/);
  for (const bad of [NaN, Infinity, -0.1, 1.01]) {
    const invalid = responseValue();
    invalid.answers.action.probabilities.buy = bad;
    assert.throws(() => validateJevResponse(invalid, questions, JEV_PINNED_MODEL), (error) => error instanceof JevClientError && error.validationRule === "distribution-range" && error.validationDiagnostic === undefined);
  }
});

test("Jev never attaches arbitrary rule strings or unvalidated numeric diagnostics", () => {
  const forged = new JevClientError("response", undefined, "untrusted-provider-fragment" as JevValidationRule, { distributionSum: 0.2, distributionCount: 2 });
  assert.equal(forged.validationRule, undefined);
  assert.equal(forged.validationDiagnostic, undefined);
  assert.equal(forged.message.includes("untrusted-provider-fragment"), false);
  const wrongRule = new JevClientError("response", undefined, "choice-argmax", { distributionSum: 0.2, distributionCount: 2 });
  assert.equal(wrongRule.validationDiagnostic, undefined);
  for (const diagnostic of [
    { distributionSum: NaN, distributionCount: 2 },
    { distributionSum: Infinity, distributionCount: 2 },
    { distributionSum: -1, distributionCount: 2 },
    { distributionSum: 3, distributionCount: 2 },
    { distributionSum: 0.2, distributionCount: 1000 },
    { distributionSum: 0.2, distributionCount: 1.5 },
  ]) assert.equal(new JevClientError("response", undefined, "distribution-sum", diagnostic).validationDiagnostic, undefined);
});

test("Jev distinguishes invalid JSON, absent bodies, oversized bodies and top-level shapes", async () => {
  for (const [rule, response] of [
    ["json", new Response("untrusted-provider-fragment")],
    ["body-missing", new Response(null)],
    ["body-size", new Response("x".repeat(512 * 1024 + 1))],
    ["body-shape", Response.json([])],
  ] as const) {
    const client = createJevClient(options({ fetch: async () => response }));
    await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && error.code === "response" && error.validationRule === rule && error.validationDiagnostic === undefined && !error.message.includes("untrusted-provider-fragment"));
  }
});

test("Jev enforces input and request budgets atomically, including concurrency", async () => {
  let calls = 0;
  const client = createJevClient(options({ budget: { maxRequests: 1, maxInputTokens: 16_000, maxInputTokensPerRequest: 16_000, maxTotalLatencyMs: 10_000 }, fetch: async () => { calls += 1; return Response.json(responseValue()); } }));
  const first = client.evaluate("state", questions);
  await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && error.code === "budget");
  await first;
  assert.equal(calls, 1);
  assert.equal(client.getUsage().stopped, true, "a rejected budget lease permanently closes the client");
  const small = createJevClient(options({ budget: { maxRequests: 3, maxInputTokens: 16_000, maxInputTokensPerRequest: 5000, maxTotalLatencyMs: 10_000 } }));
  await assert.rejects(small.evaluate("x".repeat(10_000), questions), /\(budget\)/);
  assert.equal(small.getUsage().requests, 0);
  const body = JSON.stringify({ state: "state", model: JEV_PINNED_MODEL, questions });
  const reservation = reserveJevInputTokens(body, 3);
  const total = createJevClient(options({ budget: { maxRequests: 3, maxInputTokens: reservation, maxInputTokensPerRequest: reservation, maxTotalLatencyMs: 10_000 } }));
  await total.evaluate("state", questions);
  await assert.rejects(total.evaluate("state", questions), /\(budget\)/);
  assert.equal(total.getUsage().reservedInputTokens, reservation);
});

test("Jev never retries unknown-usage failures and never exposes vendor/key text", async () => {
  for (const status of [401, 429, 529]) {
    let calls = 0;
    const client = createJevClient(options({ fetch: async () => { calls += 1; return new Response("not-a-real-key secret provider data", { status }); } }));
    await assert.rejects(client.evaluate("state", questions), (error) => {
      assert.ok(error instanceof JevClientError);
      assert.equal(error.status, status);
      assert.equal(error.message.includes("not-a-real-key"), false);
      assert.equal(error.message.includes("provider data"), false);
      return true;
    });
    await assert.rejects(client.evaluate("state", questions), /\(stopped\)/);
    assert.equal(calls, 1);
  }
  const transport = createJevClient(options({ fetch: async () => { throw new Error("not-a-real-key"); } }));
  await assert.rejects(transport.evaluate("state", questions), (error) => error instanceof JevClientError && error.code === "transport" && !error.message.includes("not-a-real-key"));
});

test("Jev timeout covers both fetch and stalled body, and cancels the body", async () => {
  const stalledFetch = createJevClient(options({ timeoutMs: 20, fetch: () => new Promise<Response>(() => undefined) }));
  await assert.rejects(stalledFetch.evaluate("state", questions), /\(timeout\)/);
  assert.equal(stalledFetch.getUsage().stopped, true);
  let canceled = false;
  const stalledBody = createJevClient(options({ timeoutMs: 20, fetch: async () => new Response(new ReadableStream<Uint8Array>({ cancel: () => { canceled = true; } })) }));
  await assert.rejects(stalledBody.evaluate("state", questions), /\(timeout\)/);
  assert.equal(canceled, true);
  assert.equal(stalledBody.getUsage().inFlightLatencyMs, 0);
});

test("HTTP 451 gives a provider-access remedy without leaking its body or retrying", async () => {
  let calls = 0;
  const client = createJevClient(options({ fetch: async () => {
    calls += 1;
    return Response.json({ title: "Typesafe is not available in your region.", detail: "not-a-real-key" }, { status: 451 });
  } }));
  await assert.rejects(client.evaluate("state", questions), (error) => {
    assert.ok(error instanceof JevClientError);
    assert.equal(error.code, "http");
    assert.equal(error.status, 451);
    assert.match(error.message, /TypeSafe support/);
    assert.equal(error.message.includes("not-a-real-key"), false);
    return true;
  });
  await assert.rejects(client.evaluate("state", questions), /\(stopped\)/);
  assert.equal(calls, 1);
  assert.equal(client.getUsage().stopped, true);
});

test("Jev caller abort and latency leases bound external use", async () => {
  const canceled = new AbortController();
  canceled.abort();
  const client = createJevClient(options());
  await assert.rejects(client.evaluate("state", questions, canceled.signal), /\(aborted\)/);
  assert.equal(client.getUsage().requests, 0);
  const active = new AbortController();
  const pending = createJevClient(options({ fetch: () => new Promise<Response>(() => undefined) }));
  const operation = pending.evaluate("state", questions, active.signal);
  active.abort();
  await assert.rejects(operation, /\(aborted\)/);
  assert.equal(pending.getUsage().stopped, true);
  const lease = createJevClient(options({ budget: { maxRequests: 3, maxInputTokens: 16_000, maxInputTokensPerRequest: 16_000, maxTotalLatencyMs: 20 }, fetch: () => new Promise<Response>(() => undefined) }));
  const first = lease.evaluate("state", questions);
  await assert.rejects(lease.evaluate("state", questions), /\(budget\)/);
  await assert.rejects(first, /\(timeout\)/);
});

test("Jev rejects malformed or oversized bodies and unexpectedly high input usage", async () => {
  for (const body of ["not json", "x".repeat(512 * 1024 + 1)]) {
    const client = createJevClient(options({ fetch: async () => new Response(body) }));
    await assert.rejects(client.evaluate("state", questions), /\(response\)/);
    assert.equal(client.getUsage().stopped, true);
  }
  const value = responseValue();
  value.usage.input_tokens = 20_000;
  const client = createJevClient(options({ fetch: async () => Response.json(value) }));
  await assert.rejects(client.evaluate("state", questions), /\(budget\)/);
  assert.equal(client.getUsage().inputTokens, 20_000);
  assert.equal(client.getUsage().stopped, true);
});

test("Jev validation binds answers to transmitted criteria after caller mutation", async () => {
  const mutable = structuredClone(questions);
  let resolveFetch: ((value: Response) => void) | undefined;
  const client = createJevClient(options({ fetch: () => new Promise<Response>((resolve) => { resolveFetch = resolve; }) }));
  const operation = client.evaluate("state", mutable);
  mutable.action = { type: "choice", instructions: "Mutated", criteria: { illegal: "Illegal", other: "Other" } };
  assert.ok(resolveFetch);
  resolveFetch(Response.json(responseValue()));
  assert.equal((await operation).answers.action.type, "choice");
});

function boundedOptions(overrides: Partial<JevClientOptions> = {}): JevClientOptions {
  return options({ failurePolicy: "bounded", budget: { maxRequests: 10, maxInputTokens: 160_000, maxInputTokensPerRequest: 16_000, maxTotalLatencyMs: 10_000 }, ...overrides });
}

test("bounded failures retain strict response rejection, known usage and reservations, without retry", async () => {
  const settlements: JevRequestSettlement[] = [];
  let calls = 0;
  const client = createJevClient(boundedOptions({ onRequestSettled: (value) => settlements.push(value), fetch: async () => {
    calls += 1;
    const value = responseValue();
    if (calls === 1) value.answers.action.choice = "finish";
    return Response.json(value);
  } }));
  await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && error.validationRule === "choice-argmax");
  assert.equal(calls, 1, "a failed evaluation never retries itself");
  const first = client.getUsage();
  assert.equal(first.stopped, false);
  assert.equal(first.inputTokens, 400);
  assert.equal(first.outputTokens, 80);
  assert.equal(first.knownUsageRequests, 1);
  assert.equal(first.unknownUsageRequests, 0);
  assert.equal(first.failedRequests, 1);
  assert.deepEqual(settlements[0].knownUsage, { input_tokens: 400, output_tokens: 80 });
  assert.equal(settlements[0].kind, "error");
  await client.evaluate("new-state", questions);
  assert.equal(calls, 2);
  assert.equal(client.getUsage().inputTokens, 800);
  assert.ok(client.getUsage().reservedInputTokens > first.reservedInputTokens, "failed reservations are never returned");
});

test("bounded failure circuit closes at three consecutive failures and success resets its count", async () => {
  let calls = 0;
  const client = createJevClient(boundedOptions({ fetch: async () => { calls += 1; return new Response("invalid-json"); } }));
  for (let index = 0; index < 3; index += 1) {
    await assert.rejects(client.evaluate("state", questions), /\(response\)/);
    assert.equal(client.getUsage().stopped, index === 2);
  }
  await assert.rejects(client.evaluate("state", questions), /\(stopped\)/);
  assert.equal(calls, 3);
  assert.equal(client.getUsage().unknownUsageRequests, 3);
  assert.equal(client.getUsage().failedRequests, 3);
  let resets = 0;
  const reset = createJevClient(boundedOptions({ fetch: async () => ++resets === 2 ? Response.json(responseValue()) : new Response("invalid-json") }));
  await assert.rejects(reset.evaluate("state", questions), /\(response\)/);
  await reset.evaluate("state", questions);
  await assert.rejects(reset.evaluate("state", questions), /\(response\)/);
  await assert.rejects(reset.evaluate("state", questions), /\(response\)/);
  assert.equal(reset.getUsage().stopped, false, "two failures after a success do not trip the three-failure circuit");
});

test("bounded mode permits new requests after timeout, transport, HTTP 429 and 5xx failures", async () => {
  for (const kind of ["timeout", "transport", 429, 500, 529, 599] as const) {
    let calls = 0;
    const client = createJevClient(boundedOptions({ timeoutMs: 15, fetch: async () => {
      calls += 1;
      if (calls > 1) return Response.json(responseValue());
      if (kind === "timeout") return new Promise<Response>(() => undefined);
      if (kind === "transport") throw new Error("not-a-real-key transport details");
      return new Response("private-provider-body", { status: kind });
    } }));
    await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError &&
      error.code === (typeof kind === "number" ? "http" : kind) && !error.message.includes("private-provider-body") && !error.message.includes("not-a-real-key"));
    assert.equal(calls, 1);
    assert.equal(client.getUsage().stopped, false);
    assert.equal(client.getUsage().unknownUsageRequests, 1);
    await client.evaluate("state", questions);
    assert.equal(calls, 2);
    assert.equal(client.getUsage().knownUsageRequests, 1);
  }
});

test("bounded mode always closes for terminal HTTP, pinned-model mismatch and usage overruns", async () => {
  for (const status of [400, 401, 403, 404, 408, 422, 451]) {
    let calls = 0;
    const client = createJevClient(boundedOptions({ fetch: async () => { calls += 1; return new Response("private", { status }); } }));
    await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && error.status === status);
    await assert.rejects(client.evaluate("state", questions), /\(stopped\)/);
    assert.equal(calls, 1);
  }
  const mismatch = responseValue();
  mismatch.model = "jev-9.9.9";
  const wrongModel = createJevClient(boundedOptions({ fetch: async () => Response.json(mismatch) }));
  await assert.rejects(wrongModel.evaluate("state", questions), (error) => error instanceof JevClientError && error.validationRule === "model");
  assert.equal(wrongModel.getUsage().stopped, true);
  assert.equal(wrongModel.getUsage().knownUsageRequests, 0);
  const excessive = responseValue();
  excessive.usage.input_tokens = 20_000;
  const overrun = createJevClient(boundedOptions({ fetch: async () => Response.json(excessive) }));
  await assert.rejects(overrun.evaluate("state", questions), /\(budget\)/);
  assert.equal(overrun.getUsage().stopped, true);
  assert.equal(overrun.getUsage().inputTokens, 20_000, "fully valid overrun is still reported as observed usage");
  excessive.answers.action.choice = "finish";
  const settlements: JevRequestSettlement[] = [];
  const invalidOverrun = createJevClient(boundedOptions({ fetch: async () => Response.json(excessive), onRequestSettled: (value) => settlements.push(value) }));
  await assert.rejects(invalidOverrun.evaluate("state", questions), (error) => error instanceof JevClientError && error.validationRule === "choice-argmax");
  assert.equal(invalidOverrun.getUsage().stopped, true);
  assert.equal(invalidOverrun.getUsage().unknownUsageRequests, 1);
  assert.equal(invalidOverrun.getUsage().inputTokens, 0);
  assert.equal(settlements[0].budgetExceeded, true, "the global harness also receives the terminal budget signal");
});

test("schema-error usage is known only for a pinned model and safe nonnegative integer tokens", async () => {
  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const value = responseValue();
    value.answers.action.choice = "finish";
    value.usage.output_tokens = invalid;
    const client = createJevClient(boundedOptions({ fetch: async () => Response.json(value) }));
    await assert.rejects(client.evaluate("state", questions), /\(response\)/);
    assert.equal(client.getUsage().knownUsageRequests, 0);
    assert.equal(client.getUsage().unknownUsageRequests, 1);
    assert.equal(client.getUsage().inputTokens, 0);
  }
});

test("synchronous request hooks precede network and settlement, exclude secrets, and cannot mutate the wire contract", async () => {
  const order: string[] = [];
  const client = createJevClient(options({ onRequestReserved(reservation) {
    order.push("reserved");
    assert.deepEqual(Object.keys(reservation).sort(), ["model", "questions", "reservedInputTokens", "state"]);
    assert.equal(JSON.stringify(reservation).includes("not-a-real-key"), false);
    reservation.questions.action = { type: "choice", instructions: "Changed", criteria: { illegal: "Illegal", other: "Other" } };
    (reservation.state as { gold: number }).gold = 0;
  }, fetch: async (_url, init) => {
    order.push("fetch");
    assert.deepEqual(JSON.parse(init?.body as string), { state: { gold: 3 }, model: JEV_PINNED_MODEL, questions });
    return Response.json(responseValue());
  }, onRequestSettled(settlement) {
    order.push("settled");
    assert.equal(settlement.kind, "success");
    assert.equal(settlement.requestSent, true);
    assert.deepEqual(settlement.knownUsage, { input_tokens: 400, output_tokens: 80 });
    assert.equal(JSON.stringify(settlement).includes("not-a-real-key"), false);
    if (settlement.kind === "success" && settlement.response.answers.action.type === "choice") settlement.response.answers.action.choice = "illegal";
  } }));
  const response = await client.evaluate({ gold: 3 }, questions);
  assert.deepEqual(order, ["reserved", "fetch", "settled"]);
  assert.equal(response.answers.action.type, "choice");
  if (response.answers.action.type === "choice") assert.equal(response.answers.action.choice, "buy");
});

test("failed reservation hooks prevent fetch, stop safely, consume reservation and settle without unknown paid usage", async () => {
  for (const hook of [() => { throw new Error("not-a-real-key private-hook-message"); }, () => { throw new JevClientError("budget"); }, async () => { throw new Error("private-async-hook-message"); }]) {
    let calls = 0;
    const settlements: JevRequestSettlement[] = [];
    const client = createJevClient(boundedOptions({ onRequestReserved: hook, onRequestSettled: (value) => settlements.push(value), fetch: async () => { calls += 1; return Response.json(responseValue()); } }));
    await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && ["hook", "budget"].includes(error.code) && !error.message.includes("private") && !error.message.includes("not-a-real-key"));
    assert.equal(calls, 0);
    assert.equal(client.getUsage().stopped, true);
    assert.equal(client.getUsage().requests, 1);
    assert.ok(client.getUsage().reservedInputTokens > 0);
    assert.equal(client.getUsage().unknownUsageRequests, 0);
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].requestSent, false);
    assert.equal(settlements[0].knownUsage, null);
    assert.equal(JSON.stringify(settlements).includes("private"), false);
  }
});

test("failed settlement hook closes after recording known provider usage and emits a safe hook error once", async () => {
  let settled = 0;
  const client = createJevClient(boundedOptions({ onRequestSettled() { settled += 1; throw new Error("not-a-real-key private-settlement-message"); } }));
  await assert.rejects(client.evaluate("state", questions), (error) => error instanceof JevClientError && error.code === "hook" && !error.message.includes("private"));
  assert.equal(settled, 1);
  assert.equal(client.getUsage().stopped, true);
  assert.equal(client.getUsage().knownUsageRequests, 1);
  assert.equal(client.getUsage().inputTokens, 400);
  assert.equal(client.getUsage().failedRequests, 1);
  await assert.rejects(client.evaluate("state", questions), /\(stopped\)/);
});
