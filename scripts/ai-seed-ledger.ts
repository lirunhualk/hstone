import { AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID } from "./ai-training-screen-registration.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID,
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE,
} from "./ai-cooperative-cem-registration.ts";
import { AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256 } from "./ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "./ai-cooperative-cem-selection-registration.ts";
import { AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 } from "./ai-cooperative-cem-training-result.ts";

export const AI_TRAINING_SCREEN_SEED_RESERVATION_ID =
  AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID;
export const AI_COOPERATIVE_CEM_SEED_RESERVATION_ID =
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID;
export const AI_COOPERATIVE_CEM_SEED_RESERVATION_MODE =
  AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE;
export const AI_COOPERATIVE_CEM_SEED_RESERVATION_PROTOCOL_SHA256 =
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256;
export const AI_COOPERATIVE_CEM_SEED_RESERVATION_IMPLEMENTATION_SHA256 =
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256;
export const AI_COOPERATIVE_CEM_SEED_RESERVATION_CONFIRMATION =
  AI_COOPERATIVE_CEM_REGISTERED_RUN_CONFIRMATION;
export const AI_COOPERATIVE_CEM_SELECTION_SEED_RESERVATION_ID =
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID;
export const AI_COOPERATIVE_CEM_SELECTION_SEED_RESERVATION_MODE =
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE;
export const AI_COOPERATIVE_CEM_SELECTION_SEED_RESERVATION_PROTOCOL_SHA256 =
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256;
export const AI_COOPERATIVE_CEM_SELECTION_SEED_RESERVATION_IMPLEMENTATION_SHA256 =
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256;
export const AI_COOPERATIVE_CEM_SELECTION_SEED_RESERVATION_CONFIRMATION =
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION;
export const AI_COOPERATIVE_CEM_SELECTION_SEED_RESERVATION_TRAINING_RESULT_SHA256 =
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256;

export type AiBenchmarkSeedReservationMode =
  | "training-screen"
  | typeof AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE
  | typeof AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE;

interface ConsumedAiSeedLedgerEntry {
  readonly id: string;
  readonly disposition: "consumed";
  readonly startSeed: number;
  readonly endSeed: number;
  readonly retirementReason: string;
}

interface ReservedAiSeedLedgerEntry {
  readonly id: string;
  readonly disposition: "reserved";
  readonly startSeed: number;
  readonly endSeed: number;
  readonly reservationId: string;
  readonly reservationMode: AiBenchmarkSeedReservationMode;
  readonly reservationProtocolSha256: string;
  readonly reservationImplementationSha256: string;
  readonly reservationConfirmation: string;
  readonly reservationTrainingResultSha256?: string;
}

interface SealedAiSeedLedgerEntry {
  readonly id:
    | "power-level-final-conversion-confirmation-30200001-sealed-v1"
    | "power-level-next-training-cycle-30400001-sealed-v1"
    | "ai-policy-next-confirmation-cycle-30500001-sealed-v1"
    | "capital-sale-settled-warband-v6-confirmation-92310001-sealed-v1"
    | "cooperative-cem-roster-final-93200001-sealed-v1";
  readonly disposition: "sealed";
  readonly startSeed: number;
  readonly endSeed: number;
}

export type AiSeedLedgerEntry =
  | ConsumedAiSeedLedgerEntry
  | ReservedAiSeedLedgerEntry
  | SealedAiSeedLedgerEntry;

export const AI_BENCHMARK_SEED_LEDGER: readonly AiSeedLedgerEntry[] =
  Object.freeze([
    Object.freeze({
      id: "power-level-offset0-confirmation-51001-consumed-v1",
      disposition: "consumed",
      startSeed: 51_001,
      endSeed: 51_096,
      retirementReason: "completed-confirmation-consumed",
    }),
    Object.freeze({
      id: "power-level-offset0-final-conversion-screen-30100001-aborted-unobserved-v1",
      disposition: "consumed",
      startSeed: 30_100_001,
      endSeed: 30_100_064,
      retirementReason:
        "external-interruption-no-output-unobserved-not-evidence",
    }),
    Object.freeze({
      id: "power-level-final-conversion-confirmation-30200001-sealed-v1",
      disposition: "sealed",
      startSeed: 30_200_001,
      endSeed: 30_200_096,
    }),
    Object.freeze({
      id: "power-level-offset0-final-conversion-screen-30300001-claimed-consumed-v1",
      disposition: "consumed",
      startSeed: 30_300_001,
      endSeed: 30_300_064,
      retirementReason: "task-scheduler-one-shot-claim-created-formal-screen",
    }),
    Object.freeze({
      id: "power-level-next-training-cycle-30400001-sealed-v1",
      disposition: "sealed",
      startSeed: 30_400_001,
      endSeed: 30_400_064,
    }),
    Object.freeze({
      id: "ai-policy-next-confirmation-cycle-30500001-sealed-v1",
      disposition: "sealed",
      startSeed: 30_500_001,
      endSeed: 30_500_096,
    }),
    Object.freeze({
      id: "capital-sale-settled-warband-v6-development-screen-92300001-consumed-v1",
      disposition: "consumed",
      startSeed: 92_300_001,
      endSeed: 92_300_008,
      retirementReason: "completed-development-screen-rejected",
    }),
    Object.freeze({
      id: "capital-sale-settled-warband-v6-confirmation-92310001-sealed-v1",
      disposition: "sealed",
      startSeed: 92_310_001,
      endSeed: 92_310_024,
    }),
    Object.freeze({
      id: "cooperative-cem-power-level-training-93000001-quarantined-v1",
      disposition: "consumed",
      startSeed: 93_000_001,
      endSeed: 93_000_008,
      retirementReason:
        "infrastructure-smoke-path-exposed-before-protocol-contract",
    }),
    Object.freeze({
      id: "cooperative-cem-power-level-training-93010001-consumed-v1",
      disposition: "consumed",
      startSeed: 93_010_001,
      endSeed: 93_010_008,
      retirementReason:
        "completed-registered-training-artifact-21cd6816bf562c12e0a2b313a58fd77368c074921521acb7f580b53378c0f8b8",
    }),
    Object.freeze({
      id: "cooperative-cem-power-level-selection-93100001-consumed-v1",
      disposition: "consumed",
      startSeed: 93_100_001,
      endSeed: 93_100_024,
      retirementReason:
        "completed-registered-selection-gate-rejected-artifact-d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b",
    }),
    Object.freeze({
      id: "cooperative-cem-roster-final-93200001-sealed-v1",
      disposition: "sealed",
      startSeed: 93_200_001,
      endSeed: 93_200_096,
    }),
  ]);

export interface AiBenchmarkSeedAccessRequest {
  readonly startSeed: number;
  readonly seeds: number;
  readonly reservationId?: string;
  readonly reservationMode?: AiBenchmarkSeedReservationMode;
  readonly reservationProtocolSha256?: string;
  readonly reservationImplementationSha256?: string;
  readonly reservationConfirmation?: string;
  readonly reservationTrainingResultSha256?: string;
}

export interface AiBenchmarkSeedAccessDecision {
  readonly allowed: boolean;
  readonly ledgerEntryId: string | null;
  readonly reason: string | null;
}

function decision(
  allowed: boolean,
  ledgerEntryId: string | null,
  reason: string | null,
): Readonly<AiBenchmarkSeedAccessDecision> {
  return Object.freeze({ allowed, ledgerEntryId, reason });
}

/**
 * Pure seed-access decision used by every benchmark caller. A reservation is
 * deliberately capability-like: both its id and mode must match, and it only
 * grants the complete registered interval. Consumed intervals are never
 * reusable.
 */
export function evaluateAiBenchmarkSeedAccess(
  request: AiBenchmarkSeedAccessRequest,
): Readonly<AiBenchmarkSeedAccessDecision> {
  if (!Number.isSafeInteger(request.startSeed)) {
    return decision(false, null, "startSeed must be a safe integer");
  }
  if (!Number.isSafeInteger(request.seeds) || request.seeds <= 0) {
    return decision(false, null, "seeds must be a positive safe integer");
  }
  const endSeed = request.startSeed + request.seeds - 1;
  if (!Number.isSafeInteger(endSeed)) {
    return decision(false, null, "seed range must contain safe integers");
  }
  if (
    (request.reservationId === undefined) !==
    (request.reservationMode === undefined)
  ) {
    return decision(
      false,
      null,
      "reservationId and reservationMode must be supplied together",
    );
  }
  const cooperativeReservationRequested =
    request.reservationMode === AI_COOPERATIVE_CEM_TRAINING_RESERVATION_MODE ||
    request.reservationId === AI_COOPERATIVE_CEM_TRAINING_RESERVATION_ID ||
    request.reservationProtocolSha256 !== undefined ||
    request.reservationImplementationSha256 !== undefined ||
    request.reservationConfirmation !== undefined ||
    request.reservationTrainingResultSha256 !== undefined;
  if (
    cooperativeReservationRequested &&
    (request.reservationId === undefined ||
      request.reservationMode === undefined ||
      request.reservationProtocolSha256 === undefined ||
      request.reservationImplementationSha256 === undefined ||
      request.reservationConfirmation === undefined)
  ) {
    return decision(
      false,
      null,
      "cooperative CEM reservation id, mode, protocol, implementation, and confirmation must be supplied together",
    );
  }
  const cooperativeSelectionRequested =
    request.reservationMode === AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE ||
    request.reservationId === AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID ||
    request.reservationTrainingResultSha256 !== undefined;
  if (
    cooperativeSelectionRequested &&
    request.reservationTrainingResultSha256 === undefined
  ) {
    return decision(
      false,
      null,
      "cooperative CEM selection requires the pinned training result SHA-256",
    );
  }

  const overlapping = AI_BENCHMARK_SEED_LEDGER.filter(
    (entry) =>
      request.startSeed <= entry.endSeed && endSeed >= entry.startSeed,
  );
  if (overlapping.length === 0) {
    if (
      request.reservationId !== undefined ||
      request.reservationMode !== undefined ||
      request.reservationProtocolSha256 !== undefined ||
      request.reservationImplementationSha256 !== undefined ||
      request.reservationConfirmation !== undefined ||
      request.reservationTrainingResultSha256 !== undefined
    ) {
      return decision(
        false,
        null,
        "a seed reservation may only be used for its registered interval",
      );
    }
    return decision(true, null, null);
  }
  if (overlapping.length !== 1) {
    return decision(
      false,
      null,
      "seed range overlaps multiple protected ledger entries",
    );
  }

  const entry = overlapping[0];
  if (entry.disposition === "consumed") {
    return decision(
      false,
      entry.id,
      `seed range overlaps consumed ledger entry ${entry.id}`,
    );
  }
  if (entry.disposition === "sealed") {
    return decision(
      false,
      entry.id,
      `seed range overlaps sealed ledger entry ${entry.id}; no execution capability exists yet`,
    );
  }
  const exactRange =
    request.startSeed === entry.startSeed && endSeed === entry.endSeed;
  if (!exactRange) {
    return decision(
      false,
      entry.id,
      `reserved ledger entry ${entry.id} requires its exact full seed range`,
    );
  }
  if (
    request.reservationId !== entry.reservationId ||
    request.reservationMode !== entry.reservationMode ||
    request.reservationProtocolSha256 !== entry.reservationProtocolSha256 ||
    request.reservationImplementationSha256 !==
      entry.reservationImplementationSha256 ||
    request.reservationConfirmation !== entry.reservationConfirmation
    || request.reservationTrainingResultSha256 !==
      entry.reservationTrainingResultSha256
  ) {
    return decision(
      false,
      entry.id,
      `reserved ledger entry ${entry.id} requires the exact registered CEM capability`,
    );
  }
  return decision(true, entry.id, null);
}

export function assertAiBenchmarkSeedAccess(
  request: AiBenchmarkSeedAccessRequest,
): void {
  const result = evaluateAiBenchmarkSeedAccess(Object.freeze({ ...request }));
  if (!result.allowed) {
    throw new Error(`AI benchmark seed ledger rejected access: ${result.reason}`);
  }
}
