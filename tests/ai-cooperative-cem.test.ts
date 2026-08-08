import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  getAiStrategyProfile,
  type AiStrategyId,
} from "../lib/game/ai.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTRATION,
  AI_COOPERATIVE_CEM_TRAINING_SEEDS,
} from "../scripts/ai-cooperative-cem-registration.ts";
import { AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256 } from "../scripts/ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_CHECKPOINT_FORMAT_VERSION,
  AI_COOPERATIVE_CEM_RUN_MARKER_FORMAT_VERSION,
  AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION,
  assertAiCooperativeCemCheckpointMatchesRawResult,
  assertAiCooperativeCemRegisteredResumeCheckpointPrefix,
  assertValidAiCooperativeCemRegisteredRunMarker,
  assertValidAiCooperativeCemTrainingArtifact,
  buildAiCooperativeCemProfileOverrides,
  computeAiCooperativeCemCandidateProfileHash,
  computeAiCooperativeCemCheckpointHash,
  computeAiCooperativeCemRegisteredRunMarkerHash,
  computeAiCooperativeCemTrainingArtifactHash,
  createAiCooperativeCemRegisteredRunMarker,
  evaluateAiCooperativeCemConstraints,
  runAiCooperativeCemTraining,
  summarizeAiCooperativeCemBenchmarkResult,
  type AiCooperativeCemBenchmarkEvidence,
  type AiCooperativeCemBenchmarkRequest,
  type AiCooperativeCemCandidateEvaluation,
  type AiCooperativeCemComparisonSnapshot,
  type AiCooperativeCemRegisteredSearchCheckpoint,
} from "../scripts/ai-cooperative-cem.ts";
import { canonicalAiPolicyEvolutionJson } from "../scripts/ai-policy-evolution.ts";
import {
  AI_POLICY_SUITE_PLAYER_IDS,
  type AiPolicySuiteBenchmarkResult,
} from "../scripts/benchmark-ai-policy-suite.ts";

const PROFILE_IDS = [
  "balanced",
  "magnetic",
  "tempo",
  "triple",
  "powerLevel",
  "economy",
  "deathrattle",
] as const satisfies readonly AiStrategyId[];

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(value))
    .digest("hex");
}

function comparison(
  placement: number,
  topFour = 0,
  win = 0,
  pairedSeats = 128,
): AiCooperativeCemComparisonSnapshot {
  const metric = (meanDelta: number) => ({
    pairedSeats,
    seedClusters: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds,
    meanDelta,
    confidence95: { lower: meanDelta - 0.01, upper: meanDelta + 0.01 },
  });
  return {
    placement: metric(placement),
    topFour: metric(topFour),
    win: metric(win),
  };
}

function benchmarkEvidence(
  request: AiCooperativeCemBenchmarkRequest,
  overrides: Partial<AiCooperativeCemBenchmarkEvidence> = {},
): AiCooperativeCemBenchmarkEvidence {
  const genome = request.genome;
  const distance =
    Math.abs(genome.upgradeRoundOffset - 1) * 4 +
    Math.abs(genome.minimumUpgradeHealth - 16) / 2 +
    Math.abs(genome.replacementMargin - 3.5) * 2 +
    Math.abs(genome.maxRefreshes - 4);
  const byProfile = Object.fromEntries(
    PROFILE_IDS.map((profileId) => [
      profileId,
      comparison(profileId === "powerLevel" ? -0.5 + distance * 0.05 : 0),
    ]),
  ) as Record<AiStrategyId, AiCooperativeCemComparisonSnapshot>;
  const scheduledRuns =
    AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds * 2 * 8 * 2;
  const expectedPairs =
    AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds * 2 * 8 * 7;
  const base: AiCooperativeCemBenchmarkEvidence = {
    method: "paired-seven-profile-suite-v1",
    benchmarkVersion: 1,
    rawResultSha256: sha256({ candidateId: request.candidateId, genome }),
    policyVersion: "test-policy",
    contentVersion: "test-content",
    contentSnapshotSha256: sha256("content"),
    evaluatorHash: sha256("evaluator"),
    strategyProfileHash: sha256("baseline-profiles"),
    candidateProfileHash: computeAiCooperativeCemCandidateProfileHash(genome),
    config: {
      seeds: AI_COOPERATIVE_CEM_TRAINING_SEEDS.seeds,
      startSeed: AI_COOPERATIVE_CEM_TRAINING_SEEDS.startSeed,
      maxRounds: AI_COOPERATIVE_CEM_REGISTRATION.benchmark.maxRounds,
      initialHealth: AI_COOPERATIVE_CEM_REGISTRATION.benchmark.initialHealth,
      scenarioIds: [...AI_COOPERATIVE_CEM_REGISTRATION.benchmark.scenarioIds],
      rotations: [...AI_COOPERATIVE_CEM_REGISTRATION.benchmark.rotations],
      scoredPlayerIds: [
        ...AI_COOPERATIVE_CEM_REGISTRATION.benchmark.scoredPlayerIds,
      ],
    },
    progress: {
      processedRuns: scheduledRuns,
      scheduledRuns,
      completedRuns: scheduledRuns,
      failedRuns: 0,
    },
    expectedPairs,
    pairedPairs: expectedPairs,
    missingPairs: 0,
    truncatedRuns: 0,
    runnerFailureCount: 0,
    providerErrorTotal: 0,
    drawRateMeanDelta: 0,
    evidenceUsable: true,
    evidenceReasons: [],
    promotionAccepted: false,
    overall: comparison(-0.01, 0, 0, expectedPairs),
    byProfile,
  };
  return { ...base, ...overrides };
}

function registeredCheckpointFixture(): AiCooperativeCemRegisteredSearchCheckpoint {
  const genome = AI_COOPERATIVE_CEM_REGISTRATION.initialIncumbent;
  const request: AiCooperativeCemBenchmarkRequest = {
    candidateId: "registered-checkpoint-fixture",
    generation: 0,
    retainedIncumbent: false,
    genome,
    profileOverrides: buildAiCooperativeCemProfileOverrides(genome),
  };
  const compact = benchmarkEvidence(request);
  const rawBenchmarkResult = {
    method: compact.method,
    benchmarkVersion: compact.benchmarkVersion,
    policyVersion: compact.policyVersion,
    contentVersion: compact.contentVersion,
    contentSnapshotSha256: compact.contentSnapshotSha256,
    evaluatorHash: compact.evaluatorHash,
    strategyProfileHash: compact.strategyProfileHash,
    candidateProfileHash: compact.candidateProfileHash,
    config: compact.config,
    progress: compact.progress,
    expectedPairs: compact.expectedPairs,
    pairedPairs: compact.pairedPairs,
    missingPairs: compact.missingPairs,
    truncatedRuns: compact.truncatedRuns,
    runnerFailures: [],
    providerErrorTotal: compact.providerErrorTotal,
    drawRateComparison: { meanDelta: compact.drawRateMeanDelta },
    evidenceUsable: compact.evidenceUsable,
    evidenceReasons: compact.evidenceReasons,
    accepted: compact.promotionAccepted,
    comparisonMatrix: {
      overall: compact.overall,
      byProfile: compact.byProfile,
    },
  } as unknown as AiPolicySuiteBenchmarkResult;
  const benchmark = summarizeAiCooperativeCemBenchmarkResult(
    rawBenchmarkResult,
  );
  const evaluationPayload = {
    formatVersion: AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION,
    protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    executionKind: "registered" as const,
    candidateId: request.candidateId,
    generation: request.generation,
    retainedIncumbent: request.retainedIncumbent,
    genome,
    benchmark,
    constraints: evaluateAiCooperativeCemConstraints(benchmark),
  };
  const evaluation: AiCooperativeCemCandidateEvaluation = {
    ...evaluationPayload,
    recordHash: sha256(evaluationPayload),
  };
  const checkpointPayload = {
    formatVersion: AI_COOPERATIVE_CEM_CHECKPOINT_FORMAT_VERSION,
    sequenceIndex: 0,
    protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
    implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
    evaluation,
    rawBenchmarkResult,
  };
  return {
    ...checkpointPayload,
    checkpointHash: computeAiCooperativeCemCheckpointHash(checkpointPayload),
  };
}

test("registered CEM is permanently completed before authorization or execution callbacks", () => {
  let markerCalls = 0;
  let checkpointCalls = 0;
  let progressCalls = 0;
  let evaluationCalls = 0;

  assert.throws(
    () =>
      runAiCooperativeCemTraining({
        registeredAuthorization: {
          confirmation: AI_COOPERATIVE_CEM_REGISTRATION.executionAuthorization
            .confirmation,
          protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
          implementationSha256: AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256,
        },
        onRegisteredRunStart() {
          markerCalls += 1;
        },
        onRegisteredSearchCheckpoint() {
          checkpointCalls += 1;
        },
        onBenchmarkProgress() {
          progressCalls += 1;
        },
        onCandidateEvaluation() {
          evaluationCalls += 1;
        },
      }),
    /training is permanently completed by result/,
  );
  assert.equal(markerCalls, 0);
  assert.equal(checkpointCalls, 0);
  assert.equal(progressCalls, 0);
  assert.equal(evaluationCalls, 0);

  assert.throws(
    () => runAiCooperativeCemTraining(),
    /training is permanently completed by result/,
  );
});

test("registered run marker is deterministic, canonical, and deeply frozen", () => {
  const first = createAiCooperativeCemRegisteredRunMarker();
  const second = createAiCooperativeCemRegisteredRunMarker();

  assert.deepEqual(first, second);
  assert.equal(first.formatVersion, AI_COOPERATIVE_CEM_RUN_MARKER_FORMAT_VERSION);
  assert.equal(first.protocolSha256, AI_COOPERATIVE_CEM_REGISTRATION.protocolSha256);
  assert.equal(
    first.implementationSha256,
    AI_COOPERATIVE_CEM_REGISTRATION.implementation.sha256,
  );
  assert.equal(first.registrationId, AI_COOPERATIVE_CEM_REGISTRATION.id);
  assert.equal(
    first.trainingReservationId,
    AI_COOPERATIVE_CEM_REGISTRATION.phases.training.reservationId,
  );
  assert.equal(
    first.trainingReservationMode,
    AI_COOPERATIVE_CEM_REGISTRATION.phases.training.reservationMode,
  );
  assert.equal(
    first.benchmarkStartSeed,
    AI_COOPERATIVE_CEM_REGISTRATION.phases.training.startSeed,
  );
  assert.equal(
    first.benchmarkSeeds,
    AI_COOPERATIVE_CEM_REGISTRATION.phases.training.seeds,
  );
  assert.equal(first.initialExecutionKind, "registered");
  assert.equal(first.initialRunMode, "fresh");
  assert.equal(first.initialRegisteredResumeMode, "none");
  assert.equal(
    first.markerHash,
    computeAiCooperativeCemRegisteredRunMarkerHash(first),
  );
  assert.equal(Object.isFrozen(first), true);
  assert.doesNotThrow(() =>
    assertValidAiCooperativeCemRegisteredRunMarker(first),
  );

  const tampered = { ...first, markerHash: "0".repeat(64) };
  assert.throws(
    () => assertValidAiCooperativeCemRegisteredRunMarker(tampered),
    /registered run marker hash mismatch/,
  );
});

test("search-only resume accepts an empty checkpoint prefix while fresh mode does not accept checkpoints", () => {
  assert.doesNotThrow(() =>
    assertAiCooperativeCemRegisteredResumeCheckpointPrefix("search-only", []),
  );
  assert.doesNotThrow(() =>
    assertAiCooperativeCemRegisteredResumeCheckpointPrefix("none", []),
  );

  const invalidCheckpoint = Object.freeze(
    {},
  ) as AiCooperativeCemRegisteredSearchCheckpoint;
  assert.throws(
    () =>
      assertAiCooperativeCemRegisteredResumeCheckpointPrefix("none", [
        invalidCheckpoint,
      ]),
    /requires an empty checkpoint prefix/,
  );
});

test("registered checkpoint rejects envelope hash and raw-result tampering", () => {
  const checkpoint = registeredCheckpointFixture();
  assert.doesNotThrow(() =>
    assertAiCooperativeCemCheckpointMatchesRawResult(checkpoint),
  );

  assert.throws(
    () =>
      assertAiCooperativeCemCheckpointMatchesRawResult({
        ...checkpoint,
        checkpointHash: "0".repeat(64),
      }),
    /registered checkpoint hash mismatch/,
  );

  const rawMismatchPayload = {
    ...checkpoint,
    rawBenchmarkResult: {
      ...checkpoint.rawBenchmarkResult,
      policyVersion: "tampered-policy-version",
    },
  };
  const rawMismatch = {
    ...rawMismatchPayload,
    checkpointHash: computeAiCooperativeCemCheckpointHash(rawMismatchPayload),
  };
  assert.throws(
    () => assertAiCooperativeCemCheckpointMatchesRawResult(rawMismatch),
    /registered checkpoint raw benchmark mismatch/,
  );
});

test("injected CEM rejects the registered run-start capability before evaluation", () => {
  let evaluatorCalls = 0;
  assert.throws(
    () =>
      runAiCooperativeCemTraining({
        benchmarkEvaluator(request) {
          evaluatorCalls += 1;
          return benchmarkEvidence(request);
        },
        onRegisteredRunStart() {},
      }),
    /cannot receive registered-run capabilities/,
  );
  assert.equal(evaluatorCalls, 0);
});

test("profile builder copies all seven profiles and mutates only player-5 genes", () => {
  const genome = {
    upgradeRoundOffset: 1,
    minimumUpgradeHealth: 16,
    replacementMargin: 3.5,
    maxRefreshes: 4,
  };
  const overrides = buildAiCooperativeCemProfileOverrides(genome);
  assert.equal(overrides.size, 7);
  for (const playerId of AI_POLICY_SUITE_PLAYER_IDS) {
    const baseline = getAiStrategyProfile(playerId);
    const candidate = overrides.get(playerId);
    assert.ok(candidate);
    assert.notEqual(candidate, baseline);
    if (playerId === "player-5") {
      assert.deepEqual(
        {
          upgradeRoundOffset: candidate.upgradeRoundOffset,
          minimumUpgradeHealth: candidate.minimumUpgradeHealth,
          replacementMargin: candidate.replacementMargin,
          maxRefreshes: candidate.maxRefreshes,
        },
        genome,
      );
      const restored = { ...candidate, ...AI_COOPERATIVE_CEM_REGISTRATION.initialIncumbent };
      assert.deepEqual(restored, baseline);
    } else {
      assert.deepEqual(candidate, baseline);
    }
  }
});

test("constraint score makes safe focus improvement feasible and penalizes roster harm", () => {
  const request = {
    candidateId: "test-candidate",
    generation: 0,
    retainedIncumbent: false,
    genome: AI_COOPERATIVE_CEM_REGISTRATION.initialIncumbent,
    profileOverrides: buildAiCooperativeCemProfileOverrides(
      AI_COOPERATIVE_CEM_REGISTRATION.initialIncumbent,
    ),
  };
  const safe = benchmarkEvidence(request);
  const safeEvaluation = evaluateAiCooperativeCemConstraints(safe);
  assert.equal(safeEvaluation.feasible, true);
  assert.ok(safeEvaluation.score > 0);

  const unsafe: AiCooperativeCemBenchmarkEvidence = {
    ...safe,
    byProfile: {
      ...safe.byProfile,
      tempo: {
        ...safe.byProfile.tempo,
        placement: {
          ...safe.byProfile.tempo.placement,
          meanDelta: 0.3,
        },
      },
    },
  };
  const unsafeEvaluation = evaluateAiCooperativeCemConstraints(unsafe);
  assert.equal(unsafeEvaluation.feasible, false);
  assert.ok(unsafeEvaluation.score < 0);
  assert.ok(unsafeEvaluation.reasons.some((reason) => reason.includes("tempo")));
});

test("injected CEM is deterministic, auditable, resumable, and never production evidence", () => {
  const observed: AiCooperativeCemBenchmarkRequest[] = [];
  const completed: unknown[] = [];
  const evaluator = (request: AiCooperativeCemBenchmarkRequest) => {
    observed.push(request);
    for (const playerId of AI_POLICY_SUITE_PLAYER_IDS) {
      const candidate = request.profileOverrides.get(playerId);
      assert.ok(candidate);
      if (playerId !== "player-5") {
        assert.deepEqual(candidate, getAiStrategyProfile(playerId));
      }
    }
    return benchmarkEvidence(request);
  };
  const first = runAiCooperativeCemTraining({
    benchmarkEvaluator: evaluator,
    onCandidateEvaluation: (evaluation) => completed.push(evaluation),
  });
  const second = runAiCooperativeCemTraining({ benchmarkEvaluator: evaluator });

  assert.deepEqual(first, second);
  assert.equal(first.formatVersion, AI_COOPERATIVE_CEM_TRAINING_FORMAT_VERSION);
  assert.equal(first.executionKind, "injected-test");
  assert.equal(first.trainingEvidenceUsable, false);
  assert.equal(first.registeredResumeMode, "none");
  assert.equal(first.registeredRunMarkerHash, null);
  assert.equal(first.cachedCandidateCount, 0);
  assert.equal(first.freshCandidateCount, 8 * 4);
  assert.equal(
    first.selectionScreenEligible,
    first.trainingEvidenceUsable && first.selectedCandidateFeasible,
  );
  assert.equal(first.candidateEvaluations.length, 8 * 4);
  assert.equal(completed.length, 8 * 4);
  assert.equal(observed.length, 8 * 4 * 2);
  assertValidAiCooperativeCemTrainingArtifact(first);

  const falselyMarkedPayload = {
    ...structuredClone(first),
    registeredRunMarkerHash:
      createAiCooperativeCemRegisteredRunMarker().markerHash,
  };
  const falselyMarked = {
    ...falselyMarkedPayload,
    artifactHash:
      computeAiCooperativeCemTrainingArtifactHash(falselyMarkedPayload),
  };
  assert.throws(
    () => assertValidAiCooperativeCemTrainingArtifact(falselyMarked),
    /cannot claim a registered run marker/,
  );

  let resumedCalls = 0;
  const resumed = runAiCooperativeCemTraining({
    benchmarkEvaluator: () => {
      resumedCalls += 1;
      throw new Error("cache miss");
    },
    cachedEvaluations: first.candidateEvaluations,
  });
  assert.equal(resumedCalls, 0);
  assert.deepEqual(resumed.evolution, first.evolution);
  assert.deepEqual(resumed.candidateEvaluations, first.candidateEvaluations);
  assert.equal(resumed.cachedCandidateCount, 8 * 4);
  assert.equal(resumed.freshCandidateCount, 0);
  assert.equal(resumed.trainingEvidenceUsable, false);

  let outOfOrderCalls = 0;
  assert.throws(
    () =>
      runAiCooperativeCemTraining({
        benchmarkEvaluator: () => {
          outOfOrderCalls += 1;
          throw new Error("must fail before evaluator");
        },
        cachedEvaluations: [
          first.candidateEvaluations[1],
          first.candidateEvaluations[0],
        ],
      }),
    /prefix index 0 does not match replay candidate/,
  );
  assert.equal(outOfOrderCalls, 0);

  const tampered = structuredClone(first);
  Object.defineProperty(tampered, "artifactHash", {
    value: "0".repeat(64),
    configurable: true,
    enumerable: true,
    writable: true,
  });
  assert.throws(
    () => assertValidAiCooperativeCemTrainingArtifact(tampered),
    /artifactHash mismatch/,
  );
});
