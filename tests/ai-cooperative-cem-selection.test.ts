import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { getAiStrategyProfile } from "../lib/game/ai.ts";
import type { AiResidualPolicyDiagnostics } from "../lib/game/ai-residual-policy.ts";
import * as selectionAttemptApi from "../scripts/ai-cooperative-cem-selection-attempt.ts";
import {
  assertAiCooperativeCemSelectionCandidateScope,
  buildAiCooperativeCemSelectionCandidateProfileOverrides,
} from "../scripts/ai-cooperative-cem-selection-contract.ts";
import { evaluateAiCooperativeCemSelectionGate } from "../scripts/ai-cooperative-cem-selection-gate.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
} from "../scripts/ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "../scripts/ai-cooperative-cem-selection-registration.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_CHECKPOINT_FORMAT_VERSION,
  AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  assertAiCooperativeCemSelectionArtifactMatchesCheckpoint,
  assertValidAiCooperativeCemSelectionArtifact,
  assertValidAiCooperativeCemSelectionCheckpoint,
  computeAiCooperativeCemSelectionArtifactHash,
  computeAiCooperativeCemSelectionCheckpointHash,
  consumeAiCooperativeCemSelectionBenchmarkToken,
  createAiCooperativeCemSelectionMarker,
  createAiCooperativeCemSelectionTokenRegistryForTest,
  runAiCooperativeCemSelection,
  type AiCooperativeCemSelectionArtifact,
  type AiCooperativeCemSelectionArtifactPayload,
  type AiCooperativeCemSelectionAuthorization,
  type AiCooperativeCemSelectionCheckpoint,
  type AiCooperativeCemSelectionCheckpointPayload,
  type AiCooperativeCemSelectionRequest,
} from "../scripts/ai-cooperative-cem-selection.ts";
import * as selectionApi from "../scripts/ai-cooperative-cem-selection.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
} from "../scripts/ai-cooperative-cem-training-result.ts";
import {
  canonicalAiPolicyEvolutionJson,
} from "../scripts/ai-policy-evolution.ts";
import { summarizeAiCooperativeCemBenchmarkResult } from "../scripts/ai-cooperative-cem.ts";
import { runAiBenchmark } from "../scripts/benchmark-ai.ts";
import {
  AI_POLICY_SUITE_BENCHMARK_VERSION,
  AI_POLICY_SUITE_PLAYER_IDS,
  AI_POLICY_SUITE_ROTATIONS,
  runAiPolicySuiteBenchmark,
  type AiPolicySuiteBenchmarkResult,
  type AiPolicySuiteEpisode,
  type AiPolicySuitePair,
} from "../scripts/benchmark-ai-policy-suite.ts";

type Comparison = AiPolicySuiteBenchmarkResult["comparisonMatrix"]["overall"];
type Metric = Comparison["placement"];

const ZERO_DIAGNOSTICS = {
  decisions: 0,
  providerCalls: 0,
  overridesApplied: 0,
  fallbacks: 0,
  noProvider: 0,
  abstentions: 0,
  lowConfidence: 0,
  invalidContexts: 0,
  invalidProposals: 0,
  providerErrors: 0,
  asyncProposals: 0,
  agreements: 0,
  byKind: {
    upgrade: { decisions: 0, overridesApplied: 0 },
    refresh: { decisions: 0, overridesApplied: 0 },
    freeze: { decisions: 0, overridesApplied: 0 },
  },
} as const satisfies AiResidualPolicyDiagnostics;

function metric(
  pairedSeats: number,
  meanDelta: number,
  lower: number,
  upper: number,
): Metric {
  return {
    pairedSeats,
    seedClusters: 24,
    meanDelta,
    confidence95: { lower, upper },
  };
}

function nonFocusComparison(): Comparison {
  return {
    placement: metric(384, 0, -0.25, 0.25),
    topFour: metric(384, 0, -0.05, 0.05),
    win: metric(384, 0, -0.05, 0.05),
  };
}

function createPair(
  seed: number,
  scenarioId: "neutral-v1" | "live-lobby-v1",
  rotation: number,
  playerId: (typeof AI_POLICY_SUITE_PLAYER_IDS)[number],
  profileId: ReturnType<typeof getAiStrategyProfile>["id"],
): AiPolicySuitePair {
  return {
    pairKey: `${seed}:${scenarioId}:${rotation}:${playerId}`,
    seed,
    scenarioId,
    rotation,
    playerId,
    profileId,
    baselinePlacementBounds: { best: 4, worst: 4, exact: true },
    candidatePlacementBounds: { best: 4, worst: 4, exact: true },
    placementDelta: 0,
    topFourDelta: 0,
    winDelta: 0,
  };
}

function createEpisode(
  request: Readonly<AiCooperativeCemSelectionRequest>,
  seed: number,
  scenarioId: "neutral-v1" | "live-lobby-v1",
  rotation: number,
): AiPolicySuiteEpisode {
  const pairs = AI_POLICY_SUITE_PLAYER_IDS.map((playerId) => {
    const profile = request.profileOverrides.get(playerId);
    assert.ok(profile);
    return createPair(seed, scenarioId, rotation, playerId, profile.id);
  });
  const run = {
    completed: true,
    drawn: false,
    truncated: false,
    finalRound: 12,
    alivePlayers: 1,
    winnerPlayerId: "player-0",
    contentVersion:
      AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.expectedProvenance
        .contentVersion,
    profiles: {},
    providerDiagnostics: ZERO_DIAGNOSTICS,
    failure: null,
  } as const;
  return {
    seed,
    scenarioId,
    rotation,
    baseline: run,
    candidate: run,
    pairs,
  };
}

function createValidRawBenchmarkResult(
  request: Readonly<AiCooperativeCemSelectionRequest>,
): AiPolicySuiteBenchmarkResult {
  const registration = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  const provenance = registration.expectedProvenance;
  const byProfile = {
    balanced: nonFocusComparison(),
    magnetic: nonFocusComparison(),
    tempo: nonFocusComparison(),
    triple: nonFocusComparison(),
    powerLevel: {
      placement: metric(384, -0.1, -0.2, -Number.EPSILON),
      topFour: metric(384, 0, -0.02, 0.02),
      win: metric(384, 0, -0.03, 0.03),
    },
    economy: nonFocusComparison(),
    deathrattle: nonFocusComparison(),
  } satisfies AiPolicySuiteBenchmarkResult["comparisonMatrix"]["byProfile"];
  const overall: Comparison = {
    placement: metric(2_688, 0, -0.1, 0.1),
    topFour: metric(2_688, 0, -0.02, 0.02),
    win: metric(2_688, 0, -0.03, 0.03),
  };
  const clusters = Array.from({ length: request.seeds }, (_, index) => {
    const seed = request.startSeed + index;
    const episodes = request.scenarioIds.flatMap((scenarioId) =>
      AI_POLICY_SUITE_ROTATIONS.map((rotation) =>
        createEpisode(request, seed, scenarioId, rotation),
      ),
    );
    return {
      seed,
      episodes,
      pairs: episodes.flatMap((episode) => episode.pairs),
      metric: {
        seed,
        placementDelta: 0,
        topFourDelta: 0,
        winDelta: 0,
      },
    };
  });

  return {
    method: "paired-seven-profile-suite-v1",
    benchmarkVersion: AI_POLICY_SUITE_BENCHMARK_VERSION,
    policyVersion: provenance.policyVersion,
    policyVersionAfter: provenance.policyVersion,
    policyVersionStable: true,
    contentVersion: provenance.contentVersion,
    contentSnapshotSha256: provenance.contentSnapshotSha256,
    contentSnapshotSha256After: provenance.contentSnapshotSha256,
    contentSnapshotStable: true,
    evaluatorHash: provenance.evaluatorHash,
    evaluatorHashAfter: provenance.evaluatorHash,
    evaluatorStable: true,
    strategyProfileHash: provenance.strategyProfileHash,
    strategyProfileHashAfter: provenance.strategyProfileHash,
    strategyProfilesStable: true,
    candidateProfileHash: provenance.candidateProfileHash,
    candidateProfileHashAfter: provenance.candidateProfileHash,
    candidateProfilesStable: true,
    strategyProfiles: AI_POLICY_SUITE_PLAYER_IDS.map((playerId) => ({
      playerId,
      profile: getAiStrategyProfile(playerId),
    })),
    candidateProfiles: AI_POLICY_SUITE_PLAYER_IDS.map((playerId) => {
      const profile = request.profileOverrides.get(playerId);
      assert.ok(profile);
      return { playerId, profile };
    }),
    residualPolicyIdentities: {},
    config: {
      seeds: request.seeds,
      startSeed: request.startSeed,
      maxRounds: request.maxRounds,
      initialHealth: request.initialHealth,
      scenarioIds: request.scenarioIds,
      rotations: AI_POLICY_SUITE_ROTATIONS,
      scoredPlayerIds: AI_POLICY_SUITE_PLAYER_IDS,
      controlPlayerId: "player-0",
      profileOverridesProvided: true,
      residualPolicyProvided: false,
    },
    progress: {
      processedRuns: 768,
      scheduledRuns: 768,
      completedRuns: 768,
      failedRuns: 0,
    },
    expectedPairs: 2_688,
    pairedPairs: 2_688,
    missingPairs: 0,
    baselineDrawnGames: 0,
    candidateDrawnGames: 0,
    baselineDrawRate: 0,
    candidateDrawRate: 0,
    drawRateComparison: {
      pairedGames: 384,
      seedClusters: 24,
      meanDelta: 0,
      confidence95: { lower: -0.01, upper: 0.01 },
      nonInferiorityMargin: 0.01,
    },
    truncatedRuns: 0,
    runnerFailures: [],
    providerDiagnostics: ZERO_DIAGNOSTICS,
    providerErrorTotal: 0,
    clusters,
    comparisons: overall,
    comparisonMatrix: {
      overall,
      byScenario: {},
      byProfile,
      byScenarioProfile: {},
    },
    evidenceUsable: true,
    evidenceReasons: [],
    promotionGate: { accepted: true, reasons: [] },
    accepted: true,
    acceptanceReasons: [],
  };
}

function canonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(value))
    .digest("hex");
}

function createInjectedCheckpoint(
  rawBenchmarkResult: AiPolicySuiteBenchmarkResult,
): AiCooperativeCemSelectionCheckpoint {
  const payload: AiCooperativeCemSelectionCheckpointPayload = {
    formatVersion: AI_COOPERATIVE_CEM_SELECTION_CHECKPOINT_FORMAT_VERSION,
    executionKind: "injected-test",
    protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    implementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    trainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    markerHash: null,
    candidateId: AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateId,
    genome: AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome,
    candidateProfileHash:
      AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateProfileHash,
    rawResultSha256: canonicalHash(rawBenchmarkResult),
    benchmark: summarizeAiCooperativeCemBenchmarkResult(rawBenchmarkResult),
    gate: evaluateAiCooperativeCemSelectionGate(rawBenchmarkResult),
    rawBenchmarkResult,
  };
  return {
    ...payload,
    checkpointHash:
      computeAiCooperativeCemSelectionCheckpointHash(payload),
  };
}

function runInjectedFixture(): {
  artifact: AiCooperativeCemSelectionArtifact;
  checkpoint: AiCooperativeCemSelectionCheckpoint;
  raw: AiPolicySuiteBenchmarkResult;
} {
  let raw: AiPolicySuiteBenchmarkResult | undefined;
  let evaluatorCalls = 0;
  const artifact = runAiCooperativeCemSelection({
    benchmarkEvaluator(request) {
      evaluatorCalls += 1;
      assertAiCooperativeCemSelectionCandidateScope({
        profileOverrides: request.profileOverrides,
      });
      assert.deepEqual(
        {
          candidateId: request.candidateId,
          startSeed: request.startSeed,
          seeds: request.seeds,
          maxRounds: request.maxRounds,
          initialHealth: request.initialHealth,
          scenarioIds: request.scenarioIds,
        },
        {
          candidateId:
            AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateId,
          startSeed:
            AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.benchmark.startSeed,
          seeds: AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.benchmark.seeds,
          maxRounds:
            AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.benchmark.maxRounds,
          initialHealth:
            AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.benchmark.initialHealth,
          scenarioIds: ["neutral-v1", "live-lobby-v1"],
        },
      );
      raw = createValidRawBenchmarkResult(request);
      return raw;
    },
  });
  assert.equal(evaluatorCalls, 1);
  assert.ok(raw);
  return { artifact, checkpoint: createInjectedCheckpoint(raw), raw };
}

test("completed registered selection rejects no authorization before claiming or execution", () => {
  assert.throws(
    () => runAiCooperativeCemSelection(),
    (error: unknown) =>
      error instanceof Error &&
      error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  );
});

test("completed registered selection rejects before legacy persistence callbacks", () => {
  let callbackCalls = 0;
  assert.throws(
    () =>
      runAiCooperativeCemSelection({
        onRegisteredRunStart() {
          callbackCalls += 1;
          return "created";
        },
        onRegisteredCheckpoint() {
          callbackCalls += 1;
          return "created";
        },
      } as unknown as Parameters<typeof runAiCooperativeCemSelection>[0]),
    (error: unknown) =>
      error instanceof Error &&
      error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  );
  assert.equal(callbackCalls, 0);
});

test("production claim and registered persistence are absent from the public module surface", () => {
  const publicApis = {
    ...selectionAttemptApi,
    ...selectionApi,
  } as Record<string, unknown>;
  for (const forbiddenName of [
    "atomicAppendOnlySelectionWrite",
    "claimAiCooperativeCemSelectionAttempt",
    "claimRegisteredSelectionAttempt",
    "persistAiCooperativeCemSelectionCheckpoint",
    "persistAiCooperativeCemSelectionArtifact",
    "persistRegisteredSelectionCheckpoint",
    "persistRegisteredSelectionArtifact",
  ]) {
    assert.equal(publicApis[forbiddenName], undefined);
  }
  assert.throws(
    () => consumeAiCooperativeCemSelectionBenchmarkToken(Object.freeze({})),
    /requires a token issued by its fixed claim/,
  );
});

test("completed registered selection rejects partial and full historical authorization before progress", () => {
  const partialAuthorizations: readonly unknown[] = [
    {},
    { confirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION },
    {
      confirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
      protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    },
    {
      confirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
      protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
      implementationSha256:
        AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    },
  ];
  for (const partial of partialAuthorizations) {
    assert.throws(
      () =>
        runAiCooperativeCemSelection({
          authorization:
            partial as AiCooperativeCemSelectionAuthorization,
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
    );
  }

  let progressCalls = 0;
  assert.throws(
    () =>
      runAiCooperativeCemSelection({
        authorization: {
          confirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
          protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
          implementationSha256:
            AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
          trainingResultSha256:
            AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
        },
        onProgress() {
          progressCalls += 1;
        },
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE,
  );
  assert.equal(progressCalls, 0);
});

test("generic policy-suite selection capability is rejected by the consumed ledger", () => {
  const registration = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  assert.throws(
    () =>
      runAiPolicySuiteBenchmark({
        candidate: {
          profileOverrides:
            buildAiCooperativeCemSelectionCandidateProfileOverrides(),
        },
        startSeed: registration.benchmark.startSeed,
        seeds: registration.benchmark.seeds,
        maxRounds: registration.benchmark.maxRounds,
        initialHealth: registration.benchmark.initialHealth,
        scenarioIds: registration.benchmark.scenarioIds,
        reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
        reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
        reservationProtocolSha256:
          AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
        reservationImplementationSha256:
          AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
        reservationConfirmation:
          AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
        reservationTrainingResultSha256:
          AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
      }),
    /overlaps consumed ledger entry cooperative-cem-power-level-selection-93100001-consumed-v1/,
  );
});

test("public generic AI benchmark cannot reuse the consumed selection reservation", () => {
  let progressCalls = 0;
  assert.throws(
    () =>
      runAiBenchmark({
        startSeed: 93_100_001,
        seeds: 24,
        reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
        reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
        reservationProtocolSha256:
          AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
        reservationImplementationSha256:
          AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
        reservationConfirmation:
          AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
        reservationTrainingResultSha256:
          AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
        onProgress() {
          progressCalls += 1;
        },
      } as unknown as Parameters<typeof runAiBenchmark>[0]),
    /overlaps consumed ledger entry cooperative-cem-power-level-selection-93100001-consumed-v1/,
  );
  assert.equal(progressCalls, 0);
});

test("selection benchmark tokens are registry-private and consumed exactly once", () => {
  const registry = createAiCooperativeCemSelectionTokenRegistryForTest();
  const token = registry.issue();
  assert.doesNotThrow(() => registry.consume(token));
  assert.throws(
    () => registry.consume(token),
    /token has already been consumed/,
  );
  assert.throws(
    () => consumeAiCooperativeCemSelectionBenchmarkToken(token),
    /requires a token issued by its fixed claim/,
  );
});

test("injected selection rejects registered capabilities before evaluator use", () => {
  let evaluatorCalls = 0;
  assert.throws(
    () =>
      runAiCooperativeCemSelection({
        authorization: {
          confirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
        } as AiCooperativeCemSelectionAuthorization,
        benchmarkEvaluator() {
          evaluatorCalls += 1;
          throw new Error("injected evaluator must not run");
        },
      }),
    /injected cooperative CEM selection cannot receive registered capabilities/,
  );
  assert.equal(evaluatorCalls, 0);
});

test("an injected strict raw result creates an artifact but is never eligible", () => {
  const { artifact, checkpoint } = runInjectedFixture();
  assert.equal(artifact.executionKind, "injected-test");
  assert.equal(artifact.markerHash, null);
  assert.equal(artifact.benchmark.evidenceUsable, true);
  assert.equal(artifact.benchmark.promotionAccepted, true);
  assert.deepEqual(artifact.gate, { accepted: true, reasons: [] });
  assert.equal(artifact.rosterFinalScreenEligible, false);
  assertValidAiCooperativeCemSelectionCheckpoint(checkpoint);
  assert.equal(checkpoint.checkpointHash, artifact.checkpointHash);
  assert.doesNotThrow(() =>
    assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
      artifact,
      checkpoint,
    ),
  );
});

test("raw, checkpoint, and artifact tampering cannot cross the paired closure", () => {
  const { artifact, checkpoint, raw } = runInjectedFixture();

  const rawTampered = structuredClone(checkpoint);
  Object.assign(rawTampered.rawBenchmarkResult, {
    policyVersion: "tampered-policy-version",
  });
  assert.throws(
    () => assertValidAiCooperativeCemSelectionCheckpoint(rawTampered),
    /raw benchmark provenance mismatch|checkpoint evidence mismatch/,
  );

  const otherRaw = structuredClone(raw);
  Object.assign(otherRaw, { baselineDrawnGames: 1 });
  const otherCheckpoint = createInjectedCheckpoint(otherRaw);
  assertValidAiCooperativeCemSelectionCheckpoint(otherCheckpoint);
  assert.notEqual(otherCheckpoint.checkpointHash, checkpoint.checkpointHash);
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
        artifact,
        otherCheckpoint,
      ),
    /does not match its raw checkpoint/,
  );

  const { artifactHash: ignoredArtifactHash, ...artifactPayload } = artifact;
  void ignoredArtifactHash;
  const mismatchedArtifactPayload: AiCooperativeCemSelectionArtifactPayload = {
    ...artifactPayload,
    checkpointHash: "f".repeat(64),
  };
  const mismatchedArtifact: AiCooperativeCemSelectionArtifact = {
    ...mismatchedArtifactPayload,
    artifactHash:
      computeAiCooperativeCemSelectionArtifactHash(
        mismatchedArtifactPayload,
      ),
  };
  assertValidAiCooperativeCemSelectionArtifact(mismatchedArtifact);
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
        mismatchedArtifact,
        checkpoint,
      ),
    /does not match its raw checkpoint/,
  );
});

test("artifactMatchesCheckpoint rejects execution-kind forgery", () => {
  const { artifact, checkpoint } = runInjectedFixture();
  const marker = createAiCooperativeCemSelectionMarker();

  const { checkpointHash: ignoredCheckpointHash, ...checkpointPayload } =
    checkpoint;
  void ignoredCheckpointHash;
  const forgedCheckpointPayload: AiCooperativeCemSelectionCheckpointPayload = {
    ...checkpointPayload,
    executionKind: "registered",
    markerHash: marker.markerHash,
  };
  const forgedCheckpoint: AiCooperativeCemSelectionCheckpoint = {
    ...forgedCheckpointPayload,
    checkpointHash:
      computeAiCooperativeCemSelectionCheckpointHash(
        forgedCheckpointPayload,
      ),
  };
  assertValidAiCooperativeCemSelectionCheckpoint(forgedCheckpoint);
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
        artifact,
        forgedCheckpoint,
      ),
    /does not match its raw checkpoint/,
  );

  const { artifactHash: ignoredArtifactHash, ...artifactPayload } = artifact;
  void ignoredArtifactHash;
  const forgedArtifactPayload: AiCooperativeCemSelectionArtifactPayload = {
    ...artifactPayload,
    executionKind: "registered",
    markerHash: marker.markerHash,
    rosterFinalScreenEligible: true,
  };
  const forgedArtifact: AiCooperativeCemSelectionArtifact = {
    ...forgedArtifactPayload,
    artifactHash:
      computeAiCooperativeCemSelectionArtifactHash(forgedArtifactPayload),
  };
  assertValidAiCooperativeCemSelectionArtifact(forgedArtifact);
  assert.throws(
    () =>
      assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
        forgedArtifact,
        checkpoint,
      ),
    /does not match its raw checkpoint/,
  );
});
