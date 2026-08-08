import { createHash } from "node:crypto";

import {
  AI_POLICY_EVOLUTION_FORMAT_VERSION,
  CATEGORICAL_CEM_ALGORITHM,
  CATEGORICAL_CEM_ELITE_COUNT,
  CATEGORICAL_CEM_PROBABILITY_DECIMALS,
  DEFAULT_POWER_LEVEL_GENE_SCHEMA,
  canonicalAiPolicyEvolutionJson,
} from "./ai-policy-evolution.ts";
import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_HASH_ALGORITHM,
  AI_COOPERATIVE_CEM_IMPLEMENTATION_PIN_FORMAT_VERSION,
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS,
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST,
  AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256,
} from "./ai-cooperative-cem-implementation-integrity.ts";
import { AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256 } from "./ai-cooperative-cem-protocol-pin.ts";

export { AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256 } from "./ai-cooperative-cem-protocol-pin.ts";

export const AI_COOPERATIVE_CEM_REGISTRATION_ID =
  "cooperative-cem-power-level-v1";
export const AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID =
  "cooperative-cem-power-level-training-93010001-v1";
export const AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE =
  "cooperative-cem-training" as const;
export const AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION =
  "run-registered-cooperative-cem-power-level-v1" as const;

/**
 * This interval was exposed by an infrastructure smoke test before the
 * registered contract was enforced. It is quarantined in the seed ledger and
 * must never be used as training evidence.
 */
export const AI_COOPERATIVE_CEM_QUARANTINED_TRAINING_SEEDS = Object.freeze({
  startSeed: 93_000_001,
  seeds: 8,
  endSeed: 93_000_008,
});
export const AI_COOPERATIVE_CEM_TRAINING_SEEDS = Object.freeze({
  startSeed: 93_010_001,
  seeds: 8,
  endSeed: 93_010_008,
});
export const AI_COOPERATIVE_CEM_SELECTION_SEEDS = Object.freeze({
  startSeed: 93_100_001,
  seeds: 24,
  endSeed: 93_100_024,
});
export const AI_COOPERATIVE_CEM_ROSTER_FINAL_SEEDS = Object.freeze({
  startSeed: 93_200_001,
  seeds: 96,
  endSeed: 93_200_096,
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const AI_COOPERATIVE_CEM_PROTOCOL_PAYLOAD = {
  formatVersion: 1,
  id: AI_COOPERATIVE_CEM_REGISTRATION_ID,
  algorithm: CATEGORICAL_CEM_ALGORITHM,
  implementation: {
    formatVersion: AI_COOPERATIVE_CEM_IMPLEMENTATION_PIN_FORMAT_VERSION,
    sha256: AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256,
    hashAlgorithm: AI_COOPERATIVE_CEM_IMPLEMENTATION_HASH_ALGORITHM,
    gameSources: "recursive-lib-game-ts-json-ascii-path-order",
    scriptPaths: [...AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS],
    excludedLiteralAnchorPaths: [
      ...AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST
        .excludedLiteralAnchorPaths,
    ],
  },
  executionAuthorization: {
    confirmation: AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
    protocolSha256Required: true,
    implementationSha256Required: true,
  },
  focus: {
    playerId: "player-5",
    strategyId: "powerLevel",
  },
  optimizer: {
    seed: 93_000_000,
    populationSize: 8,
    eliteCount: CATEGORICAL_CEM_ELITE_COUNT,
    generations: 4,
    smoothing: 0.5,
    probabilityFloor: 0.02,
    candidateIdPrefix: "cooperative-cem-power-level-v1",
  },
  optimizerSemantics: {
    artifactFormatVersion: AI_POLICY_EVOLUTION_FORMAT_VERSION,
    prng: "mulberry32-v1",
    initialDistribution: "uniform-per-gene",
    sampling: "categorical-weighted-without-replacement",
    retainIncumbentAtCandidateIndexZero: true,
    eliteSelection: "higher-score-is-better",
    exactTie: "retain-incumbent-then-ascii-candidate-id",
    probabilityDecimals: CATEGORICAL_CEM_PROBABILITY_DECIMALS,
    validation: "seed-replayed-sampling-and-derived-candidate-ids",
  },
  genes: DEFAULT_POWER_LEVEL_GENE_SCHEMA.map((definition) => ({
    name: definition.name,
    values: [...definition.values],
  })),
  initialIncumbent: {
    upgradeRoundOffset: -1,
    minimumUpgradeHealth: 14,
    replacementMargin: 3,
    maxRefreshes: 2,
  },
  candidateScope: {
    completePlayerProfilesRequired: true,
    mutablePlayerIds: ["player-5"],
    mutableStrategyIds: ["powerLevel"],
    mutableGenes: [
      "upgradeRoundOffset",
      "minimumUpgradeHealth",
      "replacementMargin",
      "maxRefreshes",
    ],
    nonFocusProfiles: "byte-equivalent-production-snapshots",
    residualPolicyOverrides: "forbidden",
  },
  benchmark: {
    maxRounds: 150,
    initialHealth: 40,
    scenarioIds: ["neutral-v1", "live-lobby-v1"],
    rotations: [0, 1, 2, 3, 4, 5, 6, 7],
    scoredPlayerIds: [
      "player-1",
      "player-2",
      "player-3",
      "player-4",
      "player-5",
      "player-6",
      "player-7",
    ],
  },
  objective: {
    scoreDirection: "higher-is-better",
    feasibility: {
      evidenceUsable: true,
      overallPlacementMeanDeltaMaximum: 0,
      focusTopFourMeanDeltaMinimum: -0.02,
      focusWinMeanDeltaMinimum: -0.03,
      nonFocusPlacementMeanDeltaMaximum: 0.25,
      nonFocusTopFourMeanDeltaMinimum: -0.05,
      nonFocusWinMeanDeltaMinimum: -0.05,
    },
    violationNormalization: {
      aggregation: "sum-positive-margin-excess",
      evidenceUnusableNormalizedPenalty: 1,
      missingMeanDeltaFallback: 0,
      missingMeanDeltaNormalizedPenalty: 0,
      placementScale: 7,
      rateScale: 1,
      violationCount: "one-per-reason",
    },
    scoreEncoding: {
      feasibleBase: 1_000_000,
      infeasibleBase: -1_000_000,
      violationCountPenalty: 100_000,
      normalizedViolationPenalty: 1_000,
      utilityWeights: {
        focusPlacement: -100,
        focusTopFour: 10,
        focusWin: 5,
        overallPlacement: -1,
      },
      exactTie: "retain-incumbent-then-candidate-id",
    },
  },
  phases: {
    training: {
      ...AI_COOPERATIVE_CEM_TRAINING_SEEDS,
      reservationId: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
      reservationMode: AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
    },
    selection: {
      ...AI_COOPERATIVE_CEM_SELECTION_SEEDS,
      disposition: "sealed",
    },
    rosterFinal: {
      ...AI_COOPERATIVE_CEM_ROSTER_FINAL_SEEDS,
      disposition: "sealed",
    },
  },
} as const;

export function canonicalAiCooperativeCemProtocolJson(
  value: unknown = AI_COOPERATIVE_CEM_PROTOCOL_PAYLOAD,
): string {
  return canonicalAiPolicyEvolutionJson(value);
}

export function computeAiCooperativeCemProtocolSha256(
  value: unknown = AI_COOPERATIVE_CEM_PROTOCOL_PAYLOAD,
): string {
  return createHash("sha256")
    .update(canonicalAiCooperativeCemProtocolJson(value))
    .digest("hex");
}

export const AI_COOPERATIVE_CEM_PROTOCOL_SHA256 =
  AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256;

const computedProtocolSha256 = computeAiCooperativeCemProtocolSha256();
if (computedProtocolSha256 !== AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256) {
  throw new Error(
    `cooperative CEM protocol drifted: expected ${AI_COOPERATIVE_CEM_PINNED_PROTOCOL_SHA256}, received ${computedProtocolSha256}`,
  );
}

export const AI_COOPERATIVE_CEM_REGISTRATION = deepFreeze({
  ...AI_COOPERATIVE_CEM_PROTOCOL_PAYLOAD,
  protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
});
