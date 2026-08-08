import { createHash } from "node:crypto";

import { AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION } from "./ai-cooperative-cem-selection-gate.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_HASH_ALGORITHM,
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_PIN_FORMAT_VERSION,
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SCRIPT_PATHS,
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SOURCE_MANIFEST,
  AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import { AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256 } from "./ai-cooperative-cem-selection-protocol-pin.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
} from "./ai-cooperative-cem-training-result.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";

export { AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256 } from "./ai-cooperative-cem-selection-protocol-pin.ts";

export const AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID =
  "cooperative-cem-power-level-selection-v1" as const;
export const AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID =
  "cooperative-cem-power-level-selection-93100001-v1" as const;
export const AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE =
  "cooperative-cem-selection" as const;
export const AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION =
  "run-registered-cooperative-cem-power-level-selection-v1" as const;
export const AI_COOPERATIVE_CEM_SELECTION_SEEDS = Object.freeze({
  startSeed: 93_100_001,
  seeds: 24,
  endSeed: 93_100_024,
});
export const AI_COOPERATIVE_CEM_SELECTION_EXPECTED_EVALUATOR_SHA256 =
  "4b3c11d3c3c109451f3d142e9263a92ec48ecfd56f07714fd545a1f8c8ff9468" as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const selected = AI_COOPERATIVE_CEM_TRAINING_RESULT.selected;
const evidence = AI_COOPERATIVE_CEM_TRAINING_RESULT.evidence;
const archive = AI_COOPERATIVE_CEM_TRAINING_RESULT.archive;

const AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_PAYLOAD = {
  formatVersion: 1,
  id: AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
  method: "single-candidate-independent-selection-v1",
  implementation: {
    formatVersion:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_PIN_FORMAT_VERSION,
    sha256: AI_COOPERATIVE_CEM_SELECTION_PINNED_IMPLEMENTATION_SHA256,
    hashAlgorithm: AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_HASH_ALGORITHM,
    gameSources: "recursive-lib-game-ts-json-ascii-path-order",
    scriptPaths: [...AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SCRIPT_PATHS],
    excludedLiteralAnchorPaths: [
      ...AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SOURCE_MANIFEST
        .excludedLiteralAnchorPaths,
    ],
  },
  executionAuthorization: {
    confirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
    protocolSha256Required: true,
    implementationSha256Required: true,
    trainingResultSha256Required: true,
    execution: "one-shot-fresh-no-resume",
  },
  trainingQualification: {
    resultRegistrationId:
      AI_COOPERATIVE_CEM_TRAINING_RESULT.resultRegistrationId,
    resultSha256: AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    bundlePayloadSha256: archive.bundlePayloadSha256,
    bundleBlobSha256: archive.bundleBlobSha256,
    bundleManifestSha256: archive.manifestSha256,
    oldRegistrationId: AI_COOPERATIVE_CEM_TRAINING_RESULT.registrationId,
    oldProtocolSha256: evidence.protocolSha256,
    oldImplementationSha256: evidence.implementationSha256,
    artifactHash: evidence.artifactHash,
    runMarkerHash: evidence.registeredRunMarkerHash,
    evolutionArtifactHash: evidence.evolutionArtifactHash,
    selectedCandidateId: selected.candidateId,
    selectedCheckpointSequenceIndex: selected.checkpointSequenceIndex,
    selectedCheckpointHash: selected.checkpointHash,
    selectedEvaluationRecordHash: selected.evaluationRecordHash,
    selectedRawResultSha256: selected.rawResultSha256,
    selectedCandidateProfileHash: selected.candidateProfileHash,
    selectedGenome: { ...selected.genome },
    selectedFeasible: selected.feasible,
    selectionScreenEligible: evidence.selectionScreenEligible,
  },
  focus: {
    playerId: "player-5",
    strategyId: "powerLevel",
  },
  candidateScope: {
    candidateCount: 1,
    externalCandidateOverrides: "forbidden",
    residualPolicyOverrides: "forbidden",
    mutablePlayerIds: ["player-5"],
    mutableStrategyIds: ["powerLevel"],
    mutableGenes: [
      "upgradeRoundOffset",
      "minimumUpgradeHealth",
      "replacementMargin",
      "maxRefreshes",
    ],
    selectedGenome: { ...selected.genome },
    nonFocusProfiles: "byte-equivalent-production-snapshots",
  },
  benchmark: {
    ...AI_COOPERATIVE_CEM_SELECTION_SEEDS,
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
    expectedRuns: 768,
    expectedPairs: 2_688,
    expectedSeedClusters: 24,
  },
  expectedProvenance: {
    policyVersion: evidence.policyVersion,
    contentVersion: evidence.contentVersion,
    contentSnapshotSha256: evidence.contentSnapshotSha256,
    evaluatorHash: AI_COOPERATIVE_CEM_SELECTION_EXPECTED_EVALUATOR_SHA256,
    strategyProfileHash: evidence.strategyProfileHash,
    candidateProfileHash: selected.candidateProfileHash,
  },
  promotionGate: AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION,
  phases: {
    selection: {
      ...AI_COOPERATIVE_CEM_SELECTION_SEEDS,
      reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
      reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
    },
    rosterFinal: {
      startSeed: 93_200_001,
      seeds: 96,
      endSeed: 93_200_096,
      disposition: "sealed",
    },
  },
  production: {
    currentPolicyVersion: AI_COOPERATIVE_CEM_TRAINING_RESULT.production.policyVersion,
    directPromotion: "forbidden",
  },
} as const;

export function canonicalAiCooperativeCemSelectionProtocolJson(
  value: unknown = AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_PAYLOAD,
): string {
  return canonicalAiPolicyEvolutionJson(value);
}

export function computeAiCooperativeCemSelectionProtocolSha256(
  value: unknown = AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_PAYLOAD,
): string {
  return createHash("sha256")
    .update(canonicalAiCooperativeCemSelectionProtocolJson(value))
    .digest("hex");
}

export const AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256 =
  AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256;

const computedProtocolSha256 =
  computeAiCooperativeCemSelectionProtocolSha256();
if (
  computedProtocolSha256 !==
  AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256
) {
  throw new Error(
    `cooperative CEM selection protocol drifted: expected ${AI_COOPERATIVE_CEM_SELECTION_PINNED_PROTOCOL_SHA256}, received ${computedProtocolSha256}`,
  );
}

export const AI_COOPERATIVE_CEM_SELECTION_REGISTRATION = deepFreeze({
  ...AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_PAYLOAD,
  protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
});
