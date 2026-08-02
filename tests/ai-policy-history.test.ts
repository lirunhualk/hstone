import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_STRATEGY_PROFILES,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  computeAiPolicyArtifactHash,
  computeAiStrategyProfileHash,
  createAiPolicyArtifact,
  type AiPolicyArtifact,
  type AiPolicyHoldoutGate,
  type AiPolicyScheduleMetadata,
} from "../scripts/ai-policy-artifact.ts";
import {
  AI_POLICY_HISTORY_SCHEMA_VERSION,
  compatibleAiPolicyOpponentArtifacts,
  computeAiPolicyHistoryPoolHash,
  createAiPolicyHistoryPool,
  loadAiPolicyHistoryPool,
  validateAiPolicyHistoryPool,
  type AiPolicyHistoryPool,
} from "../scripts/ai-policy-history.ts";
import type { AiBenchmarkResult } from "../scripts/benchmark-ai.ts";

interface ArtifactOptions {
  policyVersion: string;
  contentVersion: string;
  evaluatorHash: string;
  startSeed: number;
  accepted: boolean;
}

interface MutableHistoryPool {
  schemaVersion: number;
  poolHash: string;
  championArtifactHash: string | null;
  artifacts: AiPolicyArtifact[];
}

function benchmarkFixture(
  options: ArtifactOptions,
  profiles: readonly AiStrategyProfile[] = AI_STRATEGY_PROFILES,
): AiBenchmarkResult {
  return {
    method: "eight-bot-headless-seat-rotated-v1",
    limitations: ["test fixture"],
    contentVersion: options.contentVersion,
    contentSnapshotSha256: "c".repeat(64),
    contentSnapshotSha256After: "c".repeat(64),
    contentSnapshotStable: true,
    policyVersion: options.policyVersion,
    evaluatorHash: options.evaluatorHash,
    evaluatorHashAfter: options.evaluatorHash,
    evaluatorStable: true,
    strategyProfileHash: computeAiStrategyProfileHash(profiles),
    strategyProfileHashAfter: computeAiStrategyProfileHash(profiles),
    strategyProfilesStable: true,
    seeds: 1,
    startSeed: options.startSeed,
    maxRounds: 100,
    rotationsPerSeed: 8,
    scheduledGames: 8,
    completedGames: 0,
    drawnGames: 0,
    truncatedGames: 8,
    strategies: profiles.map((profile) => ({
      strategyId: profile.id,
      label: profile.label,
      completedGameSamples: 0,
      averagePlacement: null,
      topFourRate: null,
      winRate: null,
      averageRoundThreeBoardSize: null,
      averageUnspentGold: null,
      upgradeRate: null,
      lowHealthUpgradeRate: null,
    })),
  };
}

function holdoutSchedule(startSeed: number): AiPolicyScheduleMetadata {
  return {
    seeds: 24,
    startSeed,
    maxRounds: 100,
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
      meanRateDelta: 0,
      confidence95: { lower: -0.01, upper: 0.02 },
    },
    winRate: {
      pairedGames: 192,
      seedClusters: 24,
      meanRateDelta: 0,
      confidence95: { lower: -0.02, upper: 0.02 },
    },
  };
}

function artifactFixture(options: ArtifactOptions): AiPolicyArtifact {
  return createAiPolicyArtifact({
    benchmark: benchmarkFixture(options),
    profiles: AI_STRATEGY_PROFILES,
    holdoutSchedule: options.accepted
      ? holdoutSchedule(options.startSeed + 1_000)
      : null,
    acceptance: options.accepted
      ? {
          accepted: true,
          reasons: [],
          holdoutGate: completeHoldoutGate(),
        }
      : {
          accepted: false,
          reasons: ["candidate failed the holdout gate"],
          holdoutGate: null,
        },
  });
}

function acceptedArtifact(
  overrides: Partial<ArtifactOptions> = {},
): AiPolicyArtifact {
  return artifactFixture({
    policyVersion: "policy-current",
    contentVersion: "content-current",
    evaluatorHash: "a".repeat(64),
    startSeed: 100,
    accepted: true,
    ...overrides,
  });
}

function rejectedArtifact(
  overrides: Partial<ArtifactOptions> = {},
): AiPolicyArtifact {
  return artifactFixture({
    policyVersion: "policy-rejected",
    contentVersion: "content-current",
    evaluatorHash: "a".repeat(64),
    startSeed: 200,
    accepted: false,
    ...overrides,
  });
}

function mutablePool(pool: AiPolicyHistoryPool): MutableHistoryPool {
  return structuredClone(pool) as unknown as MutableHistoryPool;
}

function rehashPool(pool: MutableHistoryPool): void {
  pool.poolHash = computeAiPolicyHistoryPoolHash(
    pool as unknown as AiPolicyHistoryPool,
  );
}

test("creates, canonically hashes, loads, and deeply freezes a history pool", () => {
  const champion = acceptedArtifact();
  const rejected = rejectedArtifact();
  const pool = createAiPolicyHistoryPool({
    artifacts: [rejected, champion],
    championArtifactHash: champion.artifactHash,
  });
  const reverseOrder = createAiPolicyHistoryPool({
    artifacts: [champion, rejected],
    championArtifactHash: champion.artifactHash,
  });

  assert.equal(pool.schemaVersion, AI_POLICY_HISTORY_SCHEMA_VERSION);
  assert.equal(pool.poolHash, reverseOrder.poolHash);
  assert.equal(computeAiPolicyHistoryPoolHash(pool), pool.poolHash);
  assert.equal(pool.artifacts.length, 2);
  assert.equal(
    pool.artifacts.some((artifact) => !artifact.acceptance.accepted),
    true,
  );
  assert.equal(Object.isFrozen(pool), true);
  assert.equal(Object.isFrozen(pool.artifacts), true);
  assert.equal(Object.isFrozen(pool.artifacts[0]), true);

  const loaded = loadAiPolicyHistoryPool(JSON.stringify(pool));
  assert.deepEqual(loaded, pool);
  assert.deepEqual(validateAiPolicyHistoryPool(loaded), {
    valid: true,
    errors: [],
  });
});

test("rejects pool and nested artifact tampering", () => {
  const champion = acceptedArtifact();
  const pool = createAiPolicyHistoryPool({
    artifacts: [champion],
    championArtifactHash: champion.artifactHash,
  });

  const stalePoolHash = mutablePool(pool);
  stalePoolHash.championArtifactHash = null;
  assert.match(
    validateAiPolicyHistoryPool(stalePoolHash).errors.join("\n"),
    /poolHash does not match canonical payload/,
  );

  const nestedTamper = mutablePool(pool);
  const nestedArtifact = nestedTamper.artifacts[0] as unknown as {
    acceptance: { reasons: string[] };
  };
  nestedArtifact.acceptance.reasons.push("tampered without artifact rehash");
  rehashPool(nestedTamper);
  assert.throws(
    () => loadAiPolicyHistoryPool(nestedTamper),
    /artifacts\[0\].*artifactHash does not match canonical payload/,
  );

  const wrongSchema = mutablePool(pool);
  wrongSchema.schemaVersion = 2;
  rehashPool(wrongSchema);
  assert.throws(
    () => loadAiPolicyHistoryPool(wrongSchema),
    /history schemaVersion must be 1/,
  );
});

test("deduplicates by artifactHash and by policyVersion plus profile hash", () => {
  const champion = acceptedArtifact();
  assert.throws(
    () =>
      createAiPolicyHistoryPool({
        artifacts: [champion, champion],
        championArtifactHash: champion.artifactHash,
      }),
    /duplicate artifactHash/,
  );

  const samePolicyAndProfile = acceptedArtifact({ startSeed: 101 });
  assert.notEqual(samePolicyAndProfile.artifactHash, champion.artifactHash);
  assert.equal(
    samePolicyAndProfile.strategyProfileHash,
    champion.strategyProfileHash,
  );
  assert.throws(
    () =>
      createAiPolicyHistoryPool({
        artifacts: [champion, samePolicyAndProfile],
        championArtifactHash: champion.artifactHash,
      }),
    /duplicate policy\/profile policy-current/,
  );

  const nextPolicy = acceptedArtifact({
    policyVersion: "policy-next",
    startSeed: 102,
  });
  const versionedPool = createAiPolicyHistoryPool({
    artifacts: [champion, nextPolicy],
    championArtifactHash: nextPolicy.artifactHash,
  });
  assert.equal(versionedPool.artifacts.length, 2);
});

test("mixed-version pools filter only compatible accepted opponents", () => {
  const current = acceptedArtifact();
  const legacy = acceptedArtifact({
    policyVersion: "policy-legacy",
    contentVersion: "content-legacy",
    evaluatorHash: "b".repeat(64),
    startSeed: 300,
  });
  const rejected = rejectedArtifact();
  const pool = createAiPolicyHistoryPool({
    artifacts: [legacy, rejected, current],
    championArtifactHash: current.artifactHash,
  });

  const currentOpponents = compatibleAiPolicyOpponentArtifacts(pool, {
    contentVersion: "content-current",
    evaluatorHash: "a".repeat(64),
  });
  assert.deepEqual(
    currentOpponents.map((artifact) => artifact.artifactHash),
    [current.artifactHash],
  );
  assert.equal(Object.isFrozen(currentOpponents), true);

  const legacyOpponents = compatibleAiPolicyOpponentArtifacts(pool, {
    contentVersion: "content-legacy",
    evaluatorHash: "b".repeat(64),
  });
  assert.deepEqual(
    legacyOpponents.map((artifact) => artifact.artifactHash),
    [legacy.artifactHash],
  );

  const excluded = compatibleAiPolicyOpponentArtifacts(pool, {
    contentVersion: "content-current",
    evaluatorHash: "a".repeat(64),
    excludeArtifactHash: current.artifactHash,
  });
  assert.deepEqual(excluded, []);
});

test("rejected evidence is retained but cannot become champion", () => {
  const rejected = rejectedArtifact();
  assert.throws(
    () =>
      createAiPolicyHistoryPool({
        artifacts: [rejected],
        championArtifactHash: rejected.artifactHash,
      }),
    /champion artifact must have accepted evidence/,
  );

  const evidenceOnly = createAiPolicyHistoryPool({
    artifacts: [rejected],
  });
  assert.equal(evidenceOnly.championArtifactHash, null);
  assert.equal(evidenceOnly.artifacts[0].acceptance.accepted, false);

  const forged = structuredClone(rejected) as unknown as {
    artifactHash: string;
    acceptance: { accepted: boolean; reasons: string[]; holdoutGate: null };
  };
  forged.acceptance.accepted = true;
  forged.acceptance.reasons = [];
  forged.artifactHash = computeAiPolicyArtifactHash(
    forged as unknown as AiPolicyArtifact,
  );
  assert.throws(
    () =>
      createAiPolicyHistoryPool({
        artifacts: [forged as unknown as AiPolicyArtifact],
        championArtifactHash: forged.artifactHash,
      }),
    /accepted artifacts require a holdout schedule/,
  );
});
