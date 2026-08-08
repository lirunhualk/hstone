import assert from "node:assert/strict";
import test from "node:test";

import { canonicalHistoricalJsonV1 } from "../scripts/ai-historical-canonical-json-v1.ts";

test("historical canonical JSON v1 sorts object keys while preserving array order", () => {
  assert.equal(
    canonicalHistoricalJsonV1({
      z: [3, { beta: true, alpha: "x" }],
      a: null,
      n: -1.25,
    }),
    "{\"a\":null,\"n\":-1.25,\"z\":[3,{\"alpha\":\"x\",\"beta\":true}]}",
  );
  assert.equal(
    canonicalHistoricalJsonV1(Object.assign(Object.create(null), { b: 2, a: 1 })),
    "{\"a\":1,\"b\":2}",
  );
});

test("historical canonical JSON v1 rejects non-JSON values, non-finite numbers, and cycles", () => {
  for (const value of [
    undefined,
    Symbol("non-json"),
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    assert.throws(() => canonicalHistoricalJsonV1(value), TypeError);
  }
  assert.throws(() => canonicalHistoricalJsonV1(new Date(0)), /plain object/);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalHistoricalJsonV1(cyclic), /must not contain cycles/);
});
