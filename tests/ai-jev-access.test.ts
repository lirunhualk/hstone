import assert from "node:assert/strict";
import test from "node:test";
import { diagnoseJevAccess } from "../scripts/diagnose-ai-jev.ts";
import { JEV_PINNED_MODEL } from "../scripts/ai-jev-client.ts";

test("access diagnosis records official aliases, not credentials, and defaults to no inference", async () => {
  let inferenceCalls = 0;
  const report = await diagnoseJevAccess(false, { credential: () => "not-a-real-key", networkSource: "windows",
    fetch: async () => Response.json({ models: [{ name: "jev-latest", description: "not-a-real-key" }, { name: "jev-preview" }] }),
    evaluate: async () => { inferenceCalls += 1; throw new Error("must not evaluate"); },
  });
  assert.deepEqual(report.modelList.aliases, ["jev-latest", "jev-preview"]);
  assert.equal(report.modelList.status, 200);
  assert.equal(report.networkSource, "windows");
  assert.equal(inferenceCalls, 0);
  assert.equal(JSON.stringify(report).includes("not-a-real-key"), false);
});

test("region refusal stops before inference and records only known metadata", async () => {
  const report = await diagnoseJevAccess(true, { credential: () => "not-a-real-key",
    fetch: async () => Response.json({ title: "Typesafe is not available in your region.", privateDetail: "not-a-real-key" }, { status: 451 }),
    evaluate: async () => { throw new Error("must not run after access refusal"); },
  });
  assert.equal(report.modelList.regionRestricted, true);
  assert.equal(report.modelList.failure, "http-451");
  assert.equal(report.inference.attempted, false);
  assert.equal(JSON.stringify(report).includes("not-a-real-key"), false);
});

test("successful optional query retains pinned model and known usage only", async () => {
  const report = await diagnoseJevAccess(true, { credential: () => "not-a-real-key",
    fetch: async () => Response.json({ models: [{ name: "jev-latest" }] }),
    evaluate: async () => ({ model: JEV_PINNED_MODEL, answers: {}, latencyMs: 10, usage: { input_tokens: 20, output_tokens: 10 } }),
  });
  assert.equal(report.inference.successful, true);
  assert.equal(report.inference.model, JEV_PINNED_MODEL);
  assert.equal(report.inference.knownInputTokens, 20);
});

test("missing credentials and malformed models do not invoke the paid query", async () => {
  const missing = await diagnoseJevAccess(true, { credential: () => undefined,
    fetch: async () => { throw new Error("must not call without a credential"); },
  });
  assert.equal(missing.modelList.failure, "credential-unavailable");
  const malformed = await diagnoseJevAccess(true, { credential: () => "not-a-real-key",
    fetch: async () => Response.json({ models: [{ name: "unexpected model data" }] }),
  });
  assert.equal(malformed.modelList.failure, "model-list-transport-or-schema");
  assert.equal(malformed.inference.attempted, false);
});

test("model-list diagnosis stops reading and cancels as soon as streamed bytes exceed the bound", async () => {
  let producedBytes = 0;
  let canceled = false;
  let inferenceCalls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (producedBytes >= 128 * 1024) { controller.close(); return; }
      producedBytes += 1024;
      controller.enqueue(new Uint8Array(1024));
    },
    cancel() { canceled = true; },
  });
  const report = await diagnoseJevAccess(true, { credential: () => "not-a-real-key",
    fetch: async () => new Response(body),
    evaluate: async () => { inferenceCalls += 1; throw new Error("must not run after oversized listing"); },
  });
  assert.equal(report.modelList.failure, "model-list-transport-or-schema");
  assert.equal(report.inference.attempted, false);
  assert.equal(inferenceCalls, 0);
  assert.equal(canceled, true);
  assert.ok(producedBytes <= 64_000 + 2 * 1024, "at most the crossing chunk plus one stream prefetch is produced");
  assert.ok(producedBytes < 128 * 1024, "the rest of the remote response is never drained");
});

test("model-list byte bound counts UTF-8 stream bytes and accepts an exact-bound valid payload", async () => {
  const content = JSON.stringify({ models: [{ name: "jev-latest" }], ignored: "界".repeat(10_000) });
  const payload = content + " ".repeat(64_000 - Buffer.byteLength(content, "utf8"));
  assert.equal(Buffer.byteLength(payload, "utf8"), 64_000);
  const report = await diagnoseJevAccess(false, { credential: () => "not-a-real-key", fetch: async () => new Response(payload) });
  assert.equal(report.modelList.failure, null);
  assert.deepEqual(report.modelList.aliases, ["jev-latest"]);
  const oversized = await diagnoseJevAccess(false, { credential: () => "not-a-real-key", fetch: async () => new Response(payload + " ") });
  assert.equal(oversized.modelList.failure, "model-list-transport-or-schema");
});
