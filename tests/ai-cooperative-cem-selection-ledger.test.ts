import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_BENCHMARK_SEED_LEDGER,
  evaluateAiBenchmarkSeedAccess,
  type AiBenchmarkSeedAccessRequest,
} from "../scripts/ai-seed-ledger.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
} from "../scripts/ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "../scripts/ai-cooperative-cem-selection-registration.ts";
import { AI_COOPERATIVE_CEM_SELECTION_RESULT } from "../scripts/ai-cooperative-cem-selection-result.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
} from "../scripts/ai-cooperative-cem-training-result.ts";

function exactSelectionCapability(): AiBenchmarkSeedAccessRequest {
  return {
    startSeed: 93_100_001,
    seeds: 24,
    reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
    reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
    reservationProtocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    reservationImplementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    reservationConfirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
    reservationTrainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  };
}

test("completed selection seed interval denies its exact historical capability and every near match", () => {
  assert.deepEqual(evaluateAiBenchmarkSeedAccess(exactSelectionCapability()), {
    allowed: false,
    ledgerEntryId:
      "cooperative-cem-power-level-selection-93100001-consumed-v1",
    reason:
      "seed range overlaps consumed ledger entry cooperative-cem-power-level-selection-93100001-consumed-v1",
  });

  const mutations: Array<(request: Record<string, unknown>) => void> = [
    (request) => void delete request.reservationId,
    (request) => void delete request.reservationMode,
    (request) => void delete request.reservationProtocolSha256,
    (request) => void delete request.reservationImplementationSha256,
    (request) => void delete request.reservationConfirmation,
    (request) => void delete request.reservationTrainingResultSha256,
    (request) => void (request.reservationId = "wrong-reservation"),
    (request) => void (request.reservationMode = "training-screen"),
    (request) => void (request.reservationProtocolSha256 = "0".repeat(64)),
    (request) => void (request.reservationImplementationSha256 = "0".repeat(64)),
    (request) => void (request.reservationConfirmation = "wrong-confirmation"),
    (request) => void (request.reservationTrainingResultSha256 = "0".repeat(64)),
    (request) => void (request.seeds = 23),
    (request) => void (request.startSeed = 93_100_002),
  ];
  for (const mutate of mutations) {
    const request = { ...exactSelectionCapability() } as Record<string, unknown>;
    mutate(request);
    assert.equal(
      evaluateAiBenchmarkSeedAccess(
        request as unknown as AiBenchmarkSeedAccessRequest,
      ).allowed,
      false,
    );
  }
});

test("ledger records training and rejected selection consumed while final remains sealed", () => {
  const trainingLedgerEntry = AI_BENCHMARK_SEED_LEDGER.find(
    (entry) => entry.startSeed === 93_010_001,
  );
  assert.ok(trainingLedgerEntry);
  assert.equal(
    trainingLedgerEntry.id,
    AI_COOPERATIVE_CEM_TRAINING_RESULT.trainingSeeds.consumedLedgerEntryId,
  );
  assert.equal(
    trainingLedgerEntry.disposition,
    AI_COOPERATIVE_CEM_TRAINING_RESULT.trainingSeeds.dispositionAfterRun,
  );
  assert.equal(
    "retirementReason" in trainingLedgerEntry
      ? trainingLedgerEntry.retirementReason
      : null,
    AI_COOPERATIVE_CEM_TRAINING_RESULT.trainingSeeds.retirementReason,
  );
  const selectionLedgerEntry = AI_BENCHMARK_SEED_LEDGER.find(
    (entry) => entry.startSeed === 93_100_001,
  );
  assert.ok(selectionLedgerEntry);
  assert.equal(
    selectionLedgerEntry.id,
    AI_COOPERATIVE_CEM_SELECTION_RESULT.selectionSeeds.consumedLedgerEntryId,
  );
  assert.equal(
    selectionLedgerEntry.disposition,
    AI_COOPERATIVE_CEM_SELECTION_RESULT.selectionSeeds.dispositionAfterRun,
  );
  assert.equal(
    "retirementReason" in selectionLedgerEntry
      ? selectionLedgerEntry.retirementReason
      : null,
    AI_COOPERATIVE_CEM_SELECTION_RESULT.selectionSeeds.retirementReason,
  );
  assert.deepEqual(
    AI_BENCHMARK_SEED_LEDGER.filter((entry) => entry.startSeed >= 93_010_001),
    [
      {
        id: "cooperative-cem-power-level-training-93010001-consumed-v1",
        disposition: "consumed",
        startSeed: 93_010_001,
        endSeed: 93_010_008,
        retirementReason:
          "completed-registered-training-artifact-21cd6816bf562c12e0a2b313a58fd77368c074921521acb7f580b53378c0f8b8",
      },
      {
        id: "cooperative-cem-power-level-selection-93100001-consumed-v1",
        disposition: "consumed",
        startSeed: 93_100_001,
        endSeed: 93_100_024,
        retirementReason:
          "completed-registered-selection-gate-rejected-artifact-d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b",
      },
      {
        id: "cooperative-cem-roster-final-93200001-sealed-v1",
        disposition: "sealed",
        startSeed: 93_200_001,
        endSeed: 93_200_096,
      },
    ],
  );
  assert.equal(
    evaluateAiBenchmarkSeedAccess({ startSeed: 93_010_001, seeds: 8 }).allowed,
    false,
  );
  assert.equal(
    evaluateAiBenchmarkSeedAccess({ startSeed: 93_100_001, seeds: 24 }).allowed,
    false,
  );
  assert.equal(
    evaluateAiBenchmarkSeedAccess({ startSeed: 93_200_001, seeds: 96 }).allowed,
    false,
  );
});
