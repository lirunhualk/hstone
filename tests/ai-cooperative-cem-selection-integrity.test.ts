import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SCRIPT_PATHS,
  AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256,
  computeAiCooperativeCemSelectionImplementationSha256,
} from "../scripts/ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION,
  computeAiCooperativeCemSelectionProtocolSha256,
} from "../scripts/ai-cooperative-cem-selection-registration.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  computeAiCooperativeCemTrainingResultSha256,
} from "../scripts/ai-cooperative-cem-training-result.ts";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

test("retired selection preserves historical pins without refreezing the live implementation", () => {
  assert.match(
    AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256,
    SHA256_PATTERN,
  );
  assert.match(
    AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256,
    SHA256_PATTERN,
  );
  assert.notEqual(
    computeAiCooperativeCemSelectionImplementationSha256(),
    AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256,
  );
  assert.equal(
    computeAiCooperativeCemSelectionProtocolSha256(),
    AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256,
  );
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256,
  );
  assert.equal(
    computeAiCooperativeCemTrainingResultSha256(),
    AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  );
});

test("selection implementation manifest covers every execution boundary but excludes literal anchors", () => {
  for (const path of [
    "scripts/ai-cooperative-cem-selection-attempt.ts",
    "scripts/ai-cooperative-cem-selection-contract.ts",
    "scripts/ai-cooperative-cem-selection-gate.ts",
    "scripts/ai-cooperative-cem-selection-registration.ts",
    "scripts/ai-cooperative-cem-selection.ts",
    "scripts/ai-cooperative-cem-training-evidence.ts",
    "scripts/ai-seed-ledger.ts",
    "scripts/benchmark-ai-policy-suite.ts",
    "scripts/run-ai-cooperative-cem-selection.ts",
  ] as const) {
    assert.ok(
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SCRIPT_PATHS.includes(path),
    );
  }
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SCRIPT_PATHS.some((path) =>
      path.endsWith("-pin.ts"),
    ),
    false,
  );
  assert.deepEqual(
    AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.implementation
      .excludedLiteralAnchorPaths,
    [
      "scripts/ai-cooperative-cem-selection-implementation-pin.ts",
      "scripts/ai-cooperative-cem-selection-protocol-pin.ts",
    ],
  );
});

test("selection literal anchor files contain only their single frozen digest export", () => {
  for (const [relativePath, exportName, digest] of [
    [
      "../scripts/ai-cooperative-cem-selection-implementation-pin.ts",
      "AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256",
      AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256,
    ],
    [
      "../scripts/ai-cooperative-cem-selection-protocol-pin.ts",
      "AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256",
      AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256,
    ],
  ] as const) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8")
      .replace(/\r\n?/g, "\n")
      .trim();
    assert.equal(
      source,
      "export const " + exportName + " =\n  \"" + digest + "\" as const;",
    );
  }
});

test("historical selection registration is deeply frozen and keeps roster-final sealed", () => {
  const registration = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  assert.equal(Object.isFrozen(registration), true);
  assert.equal(Object.isFrozen(registration.trainingQualification), true);
  assert.equal(Object.isFrozen(registration.candidateScope.selectedGenome), true);
  assert.equal(Object.isFrozen(registration.promotionGate.thresholds), true);
  assert.equal(
    registration.trainingQualification.resultSha256,
    AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  );
  assert.equal(registration.trainingQualification.selectionScreenEligible, true);
  assert.equal(registration.phases.selection.startSeed, 93_100_001);
  assert.equal(registration.phases.selection.seeds, 24);
  assert.equal(registration.phases.rosterFinal.disposition, "sealed");
});

test("selection and policy-suite modules cold-import safely in both ESM cycle orders", () => {
  const selectionUrl = new URL(
    "../scripts/ai-cooperative-cem-selection.ts",
    import.meta.url,
  ).href;
  const benchmarkUrl = new URL(
    "../scripts/benchmark-ai-policy-suite.ts",
    import.meta.url,
  ).href;
  for (const order of [
    [selectionUrl, benchmarkUrl],
    [benchmarkUrl, selectionUrl],
  ] as const) {
    const source = `${order
      .map((url) => `await import(${JSON.stringify(url)});`)
      .join("\n")}\nprocess.stdout.write("import-ok\\n");`;
    const child = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "--eval", source],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_TEST_CONTEXT: "selection-import-order-test",
        },
      },
    );
    assert.equal(
      child.status,
      0,
      `cold import failed for ${order.join(" -> ")}: ${child.stderr}`,
    );
    assert.equal(child.stdout, "import-ok\n");
  }
});
