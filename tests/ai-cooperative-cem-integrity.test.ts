import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS,
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST,
  AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256,
  assertAiCooperativeCemImplementationPinned,
  computeAiCooperativeCemImplementationSha256,
} from "../scripts/ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTRATION,
  computeAiCooperativeCemProtocolSha256,
} from "../scripts/ai-cooperative-cem-registration.ts";
import { assertAiCooperativeCemTrainingNotCompleted } from "../scripts/ai-cooperative-cem.ts";

test("completed cooperative CEM implementation pin is historical and execution is retired", () => {
  assert.deepEqual(AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS, [
    "scripts/ai-benchmark-scenarios.ts",
    "scripts/ai-cooperative-cem-implementation-integrity.ts",
    "scripts/ai-cooperative-cem-registration.ts",
    "scripts/ai-cooperative-cem.ts",
    "scripts/ai-policy-evolution.ts",
    "scripts/ai-seed-ledger.ts",
    "scripts/ai-training-screen-registration.ts",
    "scripts/benchmark-ai-recruit-planner.ts",
    "scripts/benchmark-ai-policy-suite.ts",
    "scripts/run-ai-cooperative-cem.ts",
  ]);
  assert.deepEqual(
    AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST
      .excludedLiteralAnchorPaths,
    [
      "scripts/ai-cooperative-cem-implementation-pin.ts",
      "scripts/ai-cooperative-cem-protocol-pin.ts",
    ],
  );
  assert.match(AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256, /^[0-9a-f]{64}$/);
  assert.notEqual(
    computeAiCooperativeCemImplementationSha256(),
    AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256,
  );
  assert.throws(
    () => assertAiCooperativeCemImplementationPinned(),
    /cooperative CEM implementation drifted/,
  );
});

test("cooperative CEM protocol independently binds the implementation pin", () => {
  assert.match(AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(
    AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256,
  );
  assert.equal(
    computeAiCooperativeCemProtocolSha256(),
    AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256,
  );
  assert.equal(
    AI_COOPERATIVE_CEM_REGISTRATION.implementation.sha256,
    AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256,
  );
});

test("completed cooperative CEM training has an explicit permanent result guard", () => {
  assert.throws(
    () => assertAiCooperativeCemTrainingNotCompleted(),
    /training is permanently completed by result 11dcd989e16b8eef0679b65e4cf0517bdc73e1c937097eb3fc3ffaed74151b7c/,
  );
});
