import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_POLICY_VERSION,
  AI_STRATEGY_PROFILES,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  AI_POLICY_ARTIFACT_SCHEMA_VERSION,
  canonicalAiPolicyArtifactJson,
  computeAiPolicyArtifactHash,
  computeAiStrategyProfileHash,
  createAiPolicyArtifact,
  validateAiPolicyArtifact,
  type AiPolicyAcceptanceConclusion,
  type AiPolicyArtifact,
  type AiPolicyHoldoutGate,
  type AiPolicyScheduleMetadata,
} from "../scripts/ai-policy-artifact.ts";
import {
  runAiBenchmark,
  type AiBenchmarkResult,
} from "../scripts/benchmark-ai.ts";

const CURRENT_BENCHMARK = runAiBenchmark({
  seeds: 1,
  startSeed: 71_000,
  maxRounds: 1,
});

interface MutableArtifact {
  schemaVersion: number;
  artifactHash: string;
  contentVersion: string;
  policyVersion: string;
  evaluatorHash: string;
  strategyProfileHash: string;
  profiles: AiStrategyProfile[];
  benchmark: AiBenchmarkResult;
  schedules: {
    training: AiPolicyScheduleMetadata;
    holdout: AiPolicyScheduleMetadata | null;
  };
  acceptance: {
    accepted: boolean;
    reasons: string[];
    holdoutGate: AiPolicyHoldoutGate | null;
  };
}

function benchmarkFixture(): AiBenchmarkResult {
  return structuredClone(CURRENT_BENCHMARK);
}

function rejectedConclusion(): AiPolicyAcceptanceConclusion {
  return {
    accepted: false,
    reasons: ["candidate did not pass the holdout gate"],
    holdoutGate: null,
  };
}

function completeHoldoutSchedule(): AiPolicyScheduleMetadata {
  return {
    seeds: 24,
    startSeed: 72_000,
    maxRounds: 1,
    rotationsPerSeed: 8,
    scheduledGames: 192,
    completedGames: 0,
    drawnGames: 0,
    truncatedGames: 192,
  };
}

function completeHoldoutGate(): AiPolicyHoldoutGate {
  return {
    minimumPlacementImprovement: 0.1,
    minimumSeedClusters: 24,
    topFourNoninferiorityGuard: 0.02,
    winRateNoninferiorityGuard: 0.03,
    placement: {
      pairedGames: 192,
      seedClusters: 24,
      meanPlacementDelta: -0.2,
      confidence95: { lower: -0.3, upper: -0.1 },
    },
    topFour: {
      pairedGames: 192,
      seedClusters: 24,
      meanRateDelta: 0.01,
      confidence95: { lower: -0.01, upper: 0.03 },
    },
    winRate: {
      pairedGames: 192,
      seedClusters: 24,
      meanRateDelta: 0,
      confidence95: { lower: -0.02, upper: 0.02 },
    },
  };
}

function createRejectedArtifact(): AiPolicyArtifact {
  return createAiPolicyArtifact({
    benchmark: benchmarkFixture(),
    profiles: AI_STRATEGY_PROFILES,
    acceptance: rejectedConclusion(),
  });
}

function createAcceptedArtifact(): AiPolicyArtifact {
  return createAiPolicyArtifact({
    benchmark: benchmarkFixture(),
    profiles: AI_STRATEGY_PROFILES,
    holdoutSchedule: completeHoldoutSchedule(),
    acceptance: {
      accepted: true,
      reasons: [],
      holdoutGate: completeHoldoutGate(),
    },
  });
}

function mutableArtifact(artifact: AiPolicyArtifact): MutableArtifact {
  return structuredClone(artifact) as unknown as MutableArtifact;
}

function rehash(artifact: MutableArtifact): void {
  artifact.artifactHash = computeAiPolicyArtifactHash(
    artifact as unknown as AiPolicyArtifact,
  );
}

test("freezes a versioned JSON artifact from the current benchmark and seven profiles", () => {
  const benchmark = benchmarkFixture();
  assert.equal(
    computeAiStrategyProfileHash(AI_STRATEGY_PROFILES),
    benchmark.strategyProfileHash,
  );

  const artifact = createAiPolicyArtifact({
    benchmark,
    profiles: AI_STRATEGY_PROFILES,
    acceptance: rejectedConclusion(),
  });

  assert.equal(artifact.schemaVersion, AI_POLICY_ARTIFACT_SCHEMA_VERSION);
  assert.equal(artifact.contentVersion, benchmark.contentVersion);
  assert.equal(artifact.policyVersion, AI_POLICY_VERSION);
  assert.equal(artifact.evaluatorHash, benchmark.evaluatorHash);
  assert.equal(artifact.strategyProfileHash, benchmark.strategyProfileHash);
  assert.equal(artifact.profiles.length, 7);
  assert.deepEqual(
    artifact.profiles.map((profile) => profile.id),
    AI_STRATEGY_PROFILES.map((profile) => profile.id),
  );
  assert.deepEqual(artifact.schedules.training, {
    seeds: benchmark.seeds,
    startSeed: benchmark.startSeed,
    maxRounds: benchmark.maxRounds,
    rotationsPerSeed: benchmark.rotationsPerSeed,
    scheduledGames: benchmark.scheduledGames,
    completedGames: benchmark.completedGames,
    drawnGames: benchmark.drawnGames,
    truncatedGames: benchmark.truncatedGames,
  });
  assert.equal(artifact.schedules.holdout, null);
  assert.equal(
    computeAiPolicyArtifactHash(artifact),
    artifact.artifactHash,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(artifact)), artifact);
  assert.equal(Object.isFrozen(artifact), true);
  assert.equal(Object.isFrozen(artifact.profiles[0]), true);
  assert.deepEqual(validateAiPolicyArtifact(artifact), {
    valid: true,
    errors: [],
  });
});

test("canonical hashing is independent of object key insertion order", () => {
  assert.equal(
    canonicalAiPolicyArtifactJson({ z: [3, { b: 2, a: 1 }], a: true }),
    canonicalAiPolicyArtifactJson({ a: true, z: [3, { a: 1, b: 2 }] }),
  );
  const artifact = createRejectedArtifact();
  const parsed = JSON.parse(JSON.stringify(artifact)) as unknown as AiPolicyArtifact;
  assert.equal(
    computeAiPolicyArtifactHash(parsed),
    artifact.artifactHash,
  );
});

test("validator rejects missing and duplicate frozen strategy profiles", () => {
  const missing = mutableArtifact(createRejectedArtifact());
  missing.profiles.pop();
  rehash(missing);
  assert.match(
    validateAiPolicyArtifact(missing).errors.join("\n"),
    /missing strategy deathrattle/,
  );

  const duplicate = mutableArtifact(createRejectedArtifact());
  duplicate.profiles[6] = structuredClone(duplicate.profiles[0]);
  rehash(duplicate);
  assert.match(
    validateAiPolicyArtifact(duplicate).errors.join("\n"),
    /duplicate strategy balanced/,
  );
});

test("validator also rejects missing and duplicate benchmark strategy rows", () => {
  const missing = mutableArtifact(createRejectedArtifact());
  missing.benchmark.strategies.pop();
  rehash(missing);
  assert.match(
    validateAiPolicyArtifact(missing).errors.join("\n"),
    /benchmark\.strategies are missing strategy deathrattle/,
  );

  const duplicate = mutableArtifact(createRejectedArtifact());
  duplicate.benchmark.strategies[6] = structuredClone(
    duplicate.benchmark.strategies[0],
  );
  rehash(duplicate);
  assert.match(
    validateAiPolicyArtifact(duplicate).errors.join("\n"),
    /benchmark\.strategies contain duplicate strategy balanced/,
  );
});

test("validator rejects canonical hash, profile hash, and version mismatches", () => {
  const staleHash = mutableArtifact(createRejectedArtifact());
  staleHash.acceptance.reasons.push("tampered after hashing");
  assert.match(
    validateAiPolicyArtifact(staleHash).errors.join("\n"),
    /artifactHash does not match canonical payload/,
  );

  const profileHash = mutableArtifact(createRejectedArtifact());
  profileHash.strategyProfileHash = "b".repeat(64);
  profileHash.benchmark.strategyProfileHash = profileHash.strategyProfileHash;
  rehash(profileHash);
  assert.match(
    validateAiPolicyArtifact(profileHash).errors.join("\n"),
    /strategyProfileHash does not match frozen profiles/,
  );

  const version = mutableArtifact(createRejectedArtifact());
  version.contentVersion = `${version.contentVersion}-stale`;
  rehash(version);
  assert.match(
    validateAiPolicyArtifact(version).errors.join("\n"),
    /contentVersion does not match benchmark/,
  );

  const expectedMismatch = validateAiPolicyArtifact(createRejectedArtifact(), {
    policyVersion: "different-policy-version",
    evaluatorHash: "c".repeat(64),
  });
  assert.equal(expectedMismatch.valid, false);
  assert.match(
    expectedMismatch.errors.join("\n"),
    /policyVersion does not match expected version or hash/,
  );
  assert.match(
    expectedMismatch.errors.join("\n"),
    /evaluatorHash does not match expected version or hash/,
  );
});

test("accepted artifacts require a complete non-overlapping holdout gate", () => {
  assert.throws(
    () =>
      createAiPolicyArtifact({
        benchmark: benchmarkFixture(),
        profiles: AI_STRATEGY_PROFILES,
        acceptance: {
          accepted: true,
          reasons: [],
          holdoutGate: null,
        },
      }),
    /accepted artifacts require a holdout schedule/,
  );

  const accepted = createAcceptedArtifact();
  assert.deepEqual(validateAiPolicyArtifact(accepted), {
    valid: true,
    errors: [],
  });

  const overlapping = mutableArtifact(accepted);
  assert.ok(overlapping.schedules.holdout);
  overlapping.schedules.holdout.startSeed =
    overlapping.schedules.training.startSeed;
  rehash(overlapping);
  assert.match(
    validateAiPolicyArtifact(overlapping).errors.join("\n"),
    /training and holdout seed ranges overlap/,
  );

  const incomplete = mutableArtifact(accepted);
  assert.ok(incomplete.acceptance.holdoutGate?.placement);
  incomplete.acceptance.holdoutGate.placement.pairedGames -= 1;
  rehash(incomplete);
  assert.match(
    validateAiPolicyArtifact(incomplete).errors.join("\n"),
    /holdout placement\.pairedGames does not cover the holdout schedule/,
  );

  const weakEvidence = mutableArtifact(accepted);
  assert.ok(weakEvidence.acceptance.holdoutGate?.placement);
  weakEvidence.acceptance.holdoutGate.placement.seedClusters = 23;
  rehash(weakEvidence);
  assert.match(
    validateAiPolicyArtifact(weakEvidence).errors.join("\n"),
    /holdout placement\.seedClusters does not match holdout seeds/,
  );
});
