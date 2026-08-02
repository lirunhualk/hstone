import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import {
  type AiResidualPolicy,
  type AiResidualPolicyProposal,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_RESIDUAL_POLICY_CONTROLLED_SEATS,
  runAiResidualPolicyBenchmark,
  type AiResidualPolicyArtifactJson,
  type AiResidualPolicyArtifactManifest,
} from "../scripts/benchmark-ai-residual-policy.ts";

function testPolicyArtifact(
  parameters: AiResidualPolicyArtifactJson = { mode: "test" },
): AiResidualPolicyArtifactManifest {
  return {
    sources: [
      {
        logicalPath: "tests/ai-residual-policy-benchmark.test.ts",
        url: new URL(import.meta.url),
      },
    ],
    parameters,
  };
}

function createAlwaysAbstainPolicy(): AiResidualPolicy {
  return {
    policyId: "test-always-abstain",
    policyVersion: "1",
    propose: () => null,
  };
}

test("residual benchmark rejects protected seeds before policy creation or progress", () => {
  let policyCreations = 0;
  let progressCalls = 0;
  for (const startSeed of [
    51_001,
    30_100_001,
    30_200_001,
    30_300_001,
  ]) {
    assert.throws(
      () =>
        runAiResidualPolicyBenchmark({
          createPolicy: () => {
            policyCreations += 1;
            return createAlwaysAbstainPolicy();
          },
          policyArtifact: testPolicyArtifact({ mode: "protected-seed" }),
          seeds: 1,
          startSeed,
          maxRounds: 1,
          onProgress: () => {
            progressCalls += 1;
          },
        }),
      /AI benchmark seed ledger rejected access/,
    );
  }
  assert.equal(policyCreations, 0);
  assert.equal(progressCalls, 0);
});

function reverseTwoChoice(
  context: Parameters<AiResidualPolicy["propose"]>[0],
): AiResidualPolicyProposal | null {
  if (context.legalChoices.length !== 2) return null;
  switch (context.kind) {
    case "upgrade": {
      const choice = context.legalChoices.find(
        (item) => item !== context.legacyChoice,
      );
      return choice
        ? {
            kind: "upgrade",
            choice,
            confidence: 1,
            reasonCode: "test-reverse-two-choice",
          }
        : null;
    }
    case "refresh": {
      const choice = context.legalChoices.find(
        (item) => item !== context.legacyChoice,
      );
      return choice
        ? {
            kind: "refresh",
            choice,
            confidence: 1,
            reasonCode: "test-reverse-two-choice",
          }
        : null;
    }
    case "freeze": {
      const choice = context.legalChoices.find(
        (item) => item !== context.legacyChoice,
      );
      return choice
        ? {
            kind: "freeze",
            choice,
            confidence: 1,
            reasonCode: "test-reverse-two-choice",
          }
        : null;
    }
  }
}

function createReverseTwoChoicePolicy(): AiResidualPolicy {
  return {
    policyId: "test-reverse-two-choice",
    policyVersion: "1",
    propose: reverseTwoChoice,
  };
}

test("always-abstain provider completes seven fixed-seat pairs but cannot pass the gate", () => {
  const result = runAiResidualPolicyBenchmark({
    createPolicy: createAlwaysAbstainPolicy,
    policyArtifact: testPolicyArtifact({ mode: "abstain" }),
    seeds: 1,
    startSeed: 0xa101,
    maxRounds: 1,
    initialHealth: 40,
  });

  assert.equal(result.progress.scheduledRuns, 8);
  assert.equal(result.progress.processedRuns, 8);
  assert.equal(result.clusters.length, 1);
  assert.equal(result.pairedSeats, 7);
  assert.equal(result.missingPairs, 0);
  assert.equal(result.truncatedRuns, 8);
  assert.equal(result.drawnRuns, 0);
  assert.deepEqual(
    result.clusters[0]?.pairs.map((pair) => pair.seat),
    AI_RESIDUAL_POLICY_CONTROLLED_SEATS,
  );
  assert.ok(
    result.clusters[0]?.pairs.every(
      (pair) => pair.candidate.playerId !== "player-0",
    ),
  );
  assert.ok(result.providerDiagnostics.providerCalls > 0);
  assert.equal(
    result.providerDiagnostics.abstentions,
    result.providerDiagnostics.providerCalls,
  );
  assert.equal(result.providerDiagnostics.overridesApplied, 0);
  assert.equal(result.providerDiagnostics.noProvider, 0);
  assert.equal(result.providerErrors.total, 0);
  assert.equal(result.accepted, false);
  assert.ok(
    result.acceptanceReasons.some((reason) => reason.includes("24")),
  );
  assert.ok(
    result.acceptanceReasons.some((reason) => reason.includes("override")),
  );
});

test("high-confidence legal inversion produces deterministic overrides but remains diagnostic with one seed", () => {
  const options = {
    createPolicy: createReverseTwoChoicePolicy,
    policyArtifact: testPolicyArtifact({ mode: "reverse" }),
    seeds: 1,
    startSeed: 0xa201,
    maxRounds: 1,
    initialHealth: 40,
  } as const;
  const first = runAiResidualPolicyBenchmark(options);
  const second = runAiResidualPolicyBenchmark(options);

  assert.deepEqual(first, second);
  assert.equal(first.pairedSeats, 7);
  assert.equal(first.missingPairs, 0);
  assert.ok(first.providerDiagnostics.providerCalls > 0);
  assert.ok(first.providerDiagnostics.overridesApplied > 0);
  assert.ok((first.overrideCoverage.rate ?? 0) > 0);
  assert.equal(first.providerErrors.total, 0);
  assert.equal(first.evaluatorStable, true);
  assert.match(first.evaluatorHash, /^[0-9a-f]{64}$/);
  assert.equal(first.evaluatorHashAfter, first.evaluatorHash);
  assert.match(first.contentSnapshotSha256, /^[0-9a-f]{64}$/);
  assert.match(first.residualPolicy.codeSha256, /^[0-9a-f]{64}$/);
  assert.match(first.residualPolicy.parametersSha256, /^[0-9a-f]{64}$/);
  assert.match(
    first.residualPolicy.policyArtifactSha256 ?? "",
    /^[0-9a-f]{64}$/,
  );
  assert.equal(first.residualPolicy.sourceStable, true);
  assert.equal(first.residualPolicy.parametersStable, true);
  assert.equal(first.residualPolicy.artifactStable, true);
  assert.equal(first.strategyProfilesStable, true);
  assert.equal(
    first.strategyProfileHashAfter,
    first.strategyProfileHash,
  );
  assert.equal(first.accepted, false);
  assert.ok(
    first.acceptanceReasons.some((reason) => reason.includes("24")),
  );
});

test("creates fresh stateful providers for every candidate episode", () => {
  let createdProviders = 0;
  const result = runAiResidualPolicyBenchmark({
    createPolicy: (parameters) => {
      createdProviders += 1;
      assert.equal(Object.isFrozen(parameters), true);
      assert.equal(
        Object.isFrozen(
          (parameters as { nested: readonly number[] }).nested,
        ),
        true,
      );
      let overridden = false;
      return {
        policyId: "test-episode-state",
        policyVersion: "1",
        propose(context) {
          if (overridden) return null;
          const proposal = reverseTwoChoice(context);
          if (proposal !== null) overridden = true;
          return proposal;
        },
      };
    },
    policyArtifact: testPolicyArtifact({ nested: [1, 2, 3] }),
    seeds: 1,
    startSeed: 0xa301,
    maxRounds: 1,
    initialHealth: 40,
  });

  assert.equal(createdProviders, 8, "one metadata plus seven episode instances");
  assert.ok(
    result.clusters[0]?.pairs.every(
      (pair) => pair.candidate.providerDiagnostics?.overridesApplied === 1,
    ),
  );
  assert.equal(result.providerDiagnostics.overridesApplied, 7);
  assert.equal(result.runnerFailures.length, 0);
});

test("rejects a provider instance shared across candidate episodes", () => {
  const shared = createAlwaysAbstainPolicy();
  const result = runAiResidualPolicyBenchmark({
    createPolicy: () => shared,
    policyArtifact: testPolicyArtifact({ mode: "shared" }),
    seeds: 1,
    startSeed: 0xa401,
    maxRounds: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.pairedSeats, 0);
  assert.equal(result.missingPairs, 7);
  assert.equal(result.runnerFailures.length, 7);
  assert.ok(
    result.runnerFailures.every((failure) =>
      failure.message.includes("fresh provider instance"),
    ),
  );
});

test("turns factory and metadata identity failures into rejected runner evidence", () => {
  let identityFactoryCalls = 0;
  const identityMismatch = runAiResidualPolicyBenchmark({
    createPolicy: () => {
      identityFactoryCalls += 1;
      return {
        policyId: "test-identity",
        policyVersion: identityFactoryCalls === 1 ? "1" : "2",
        propose: () => null,
      };
    },
    policyArtifact: testPolicyArtifact({ mode: "identity-mismatch" }),
    seeds: 1,
    startSeed: 0xa501,
    maxRounds: 1,
  });
  assert.equal(identityMismatch.accepted, false);
  assert.equal(identityMismatch.runnerFailures.length, 7);
  assert.ok(
    identityMismatch.runnerFailures.every((failure) =>
      failure.message.includes("metadata instance"),
    ),
  );

  const factoryFailure = runAiResidualPolicyBenchmark({
    createPolicy: () => {
      throw new Error("model load failed");
    },
    policyArtifact: testPolicyArtifact({ mode: "factory-failure" }),
    seeds: 1,
    startSeed: 0xa601,
    maxRounds: 1,
  });
  assert.equal(factoryFailure.accepted, false);
  assert.equal(factoryFailure.residualPolicy.policyId, null);
  assert.ok(
    factoryFailure.runnerFailures.some(
      (failure) =>
        failure.run === "provider-metadata" &&
        failure.message.includes("model load failed"),
    ),
  );
});

test("artifact hashes are canonical and bind source bytes and parameters", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "hstone-residual-artifact-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const firstPath = join(directory, "first.ts");
  const secondPath = join(directory, "second.json");
  writeFileSync(firstPath, "export const value = 1;\n");
  writeFileSync(secondPath, '{"weight":2}\n');

  const firstSource = {
    logicalPath: "policy/first.ts",
    url: pathToFileURL(firstPath),
  };
  const secondSource = {
    logicalPath: "policy/second.json",
    url: pathToFileURL(secondPath),
  };
  const run = (
    sources: AiResidualPolicyArtifactManifest["sources"],
    parameters: AiResidualPolicyArtifactJson,
  ) =>
    runAiResidualPolicyBenchmark({
      createPolicy: createAlwaysAbstainPolicy,
      policyArtifact: { sources, parameters },
      seeds: 1,
      startSeed: 0xa701,
      maxRounds: 1,
    });

  const first = run(
    [firstSource, secondSource],
    { alpha: 1, nested: { enabled: true } },
  );
  const reordered = run(
    [secondSource, firstSource],
    { nested: { enabled: true }, alpha: 1 },
  );
  assert.equal(
    reordered.residualPolicy.codeSha256,
    first.residualPolicy.codeSha256,
  );
  assert.equal(
    reordered.residualPolicy.parametersSha256,
    first.residualPolicy.parametersSha256,
  );
  assert.equal(
    reordered.residualPolicy.policyArtifactSha256,
    first.residualPolicy.policyArtifactSha256,
  );

  writeFileSync(firstPath, "export const value = 2;\n");
  const changedSource = run(
    [firstSource, secondSource],
    { alpha: 1, nested: { enabled: true } },
  );
  assert.notEqual(
    changedSource.residualPolicy.codeSha256,
    first.residualPolicy.codeSha256,
  );
  assert.notEqual(
    changedSource.residualPolicy.policyArtifactSha256,
    first.residualPolicy.policyArtifactSha256,
  );

  const changedParameters = run(
    [firstSource, secondSource],
    { alpha: 2, nested: { enabled: true } },
  );
  assert.notEqual(
    changedParameters.residualPolicy.parametersSha256,
    changedSource.residualPolicy.parametersSha256,
  );
  assert.notEqual(
    changedParameters.residualPolicy.policyArtifactSha256,
    changedSource.residualPolicy.policyArtifactSha256,
  );
});

test("strictly rejects invalid artifact JSON, paths, and URLs", () => {
  const fileUrl = new URL(import.meta.url);
  const invoke = (policyArtifact: unknown) =>
    runAiResidualPolicyBenchmark({
      createPolicy: createAlwaysAbstainPolicy,
      policyArtifact: policyArtifact as AiResidualPolicyArtifactManifest,
      seeds: 1,
      maxRounds: 1,
    });

  for (const logicalPath of [
    "../policy.ts",
    "/policy.ts",
    "policy\\main.ts",
    "policy//main.ts",
    "./policy.ts",
  ]) {
    assert.throws(
      () =>
        invoke({
          sources: [{ logicalPath, url: fileUrl }],
          parameters: {},
        }),
      /logicalPath/,
    );
  }
  assert.throws(
    () =>
      invoke({
        sources: [
          { logicalPath: "policy.ts", url: fileUrl },
          { logicalPath: "policy.ts", url: fileUrl },
        ],
        parameters: {},
      }),
    /unique/,
  );
  assert.throws(
    () =>
      invoke({
        sources: [
          { logicalPath: "policy.ts", url: new URL("https://example.com/policy.ts") },
        ],
        parameters: {},
      }),
    /file:/,
  );

  const sparse = new Array(2);
  sparse[0] = 1;
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const parameters of [
    undefined,
    Number.POSITIVE_INFINITY,
    new Date(0),
    sparse,
    cyclic,
  ]) {
    assert.throws(() =>
      invoke({
        sources: [{ logicalPath: "policy.ts", url: fileUrl }],
        parameters,
      }),
    );
  }
});

test("rejects policy source drift during benchmark progress", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "hstone-residual-drift-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sourcePath = join(directory, "policy.ts");
  writeFileSync(sourcePath, "export const version = 1;\n");
  let changed = false;

  const result = runAiResidualPolicyBenchmark({
    createPolicy: createAlwaysAbstainPolicy,
    policyArtifact: {
      sources: [
        {
          logicalPath: "policy/main.ts",
          url: pathToFileURL(sourcePath),
        },
      ],
      parameters: { threshold: 0.9 },
    },
    seeds: 1,
    startSeed: 0xa801,
    maxRounds: 1,
    onProgress: () => {
      if (!changed) {
        changed = true;
        writeFileSync(sourcePath, "export const version = 2;\n");
      }
    },
  });

  assert.equal(result.accepted, false);
  assert.equal(result.residualPolicy.sourceStable, false);
  assert.equal(result.residualPolicy.parametersStable, true);
  assert.equal(result.residualPolicy.artifactStable, false);
  assert.ok(
    result.runnerFailures.some(
      (failure) => failure.run === "policy-source-drift",
    ),
  );
  assert.equal(
    JSON.stringify(result).includes(pathToFileURL(sourcePath).href),
    false,
  );
});

test("rejects original parameter drift while factories retain the frozen snapshot", () => {
  const parameters = { threshold: 0.9, nested: [1, 2] };
  let changed = false;
  const result = runAiResidualPolicyBenchmark({
    createPolicy: (snapshot) => {
      assert.equal(Object.isFrozen(snapshot), true);
      assert.equal(
        (snapshot as { threshold: number }).threshold,
        0.9,
      );
      return createAlwaysAbstainPolicy();
    },
    policyArtifact: testPolicyArtifact(parameters),
    seeds: 1,
    startSeed: 0xa901,
    maxRounds: 1,
    onProgress: () => {
      if (!changed) {
        changed = true;
        parameters.threshold = 0.8;
      }
    },
  });

  assert.equal(result.accepted, false);
  assert.equal(result.residualPolicy.sourceStable, true);
  assert.equal(result.residualPolicy.parametersStable, false);
  assert.equal(result.residualPolicy.artifactStable, false);
  assert.ok(
    result.runnerFailures.some(
      (failure) => failure.run === "policy-parameters-drift",
    ),
  );
});
