import assert from "node:assert/strict";
import test from "node:test";
import { probeJevProviderHealth } from "../scripts/ai-jev-health.ts";

test("health probe performs exactly one authenticated read-only request and returns no vendor data", async () => {
  let calls = 0;
  const health = await probeJevProviderHealth("not-a-real-key", async (url, init) => {
    calls++;
    assert.equal(url, "https://api.typesafe.ai/v1/models");
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer not-a-real-key");
    return Response.json({ models: [{ name: "jev-latest" }, { name: "jev-preview" }], extra: "vendor-detail-marker" });
  });
  assert.equal(calls, 1);
  assert.deepEqual(health, { healthy: true, status: 200, failure: null });
  assert.doesNotMatch(JSON.stringify(health), /key|detail-marker/);
});

test("health probe rejects access restrictions, empty or malformed lists and redirects without recovery", async () => {
  for (const [response, failure] of [
    [Response.json({ models: [{ name: "jev-latest" }] }, { status: 451 }), "http"],
    [Response.json({ models: [] }), "shape"],
    [Response.json({ models: [{ name: "vendor-detail-marker" }] }), "shape"],
    [new Response("not json"), "shape"],
    [new Response(null, { status: 302 }), "http"],
  ] as const) {
    let calls = 0;
    const health = await probeJevProviderHealth("not-a-real-key", async () => { calls++; return response; });
    assert.equal(calls, 1);
    assert.equal(health.healthy, false);
    assert.equal(health.failure, failure);
  }
});

test("health probe cancels oversized bodies and strips transport exception details", async () => {
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(64_001)); },
    cancel() { canceled = true; },
  });
  const oversized = await probeJevProviderHealth("not-a-real-key", async () => new Response(stream));
  assert.deepEqual(oversized, { healthy: false, status: 200, failure: "shape" });
  assert.equal(canceled, true);
  const failed = await probeJevProviderHealth("not-a-real-key", async () => { throw new Error("vendor-detail-marker"); });
  assert.deepEqual(failed, { healthy: false, status: null, failure: "transport" });
  assert.doesNotMatch(JSON.stringify(failed), /detail-marker/);
});

test("health timeout covers a stalled fetch and a stalled response body", async () => {
  let fetchSignal: AbortSignal | undefined;
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { canceled = true; } });
  const results = await Promise.all([
    probeJevProviderHealth("not-a-real-key", async (_url, init) => {
      fetchSignal = init?.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    }),
    probeJevProviderHealth("not-a-real-key", async () => new Response(body)),
  ]);
  assert.deepEqual(results, [
    { healthy: false, status: null, failure: "timeout" },
    { healthy: false, status: 200, failure: "timeout" },
  ]);
  assert.equal(fetchSignal?.aborted, true);
  assert.equal(canceled, true);
});
