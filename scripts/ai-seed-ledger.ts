import { AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID } from "./ai-training-screen-registration.ts";

export const AI_TRAINING_SCREEN_SEED_RESERVATION_ID =
  AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID;

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
  readonly reservationMode: "training-screen";
}

interface SealedAiSeedLedgerEntry {
  readonly id: "power-level-final-conversion-confirmation-30200001-sealed-v1";
  readonly disposition: "sealed";
  readonly startSeed: 30_200_001;
  readonly endSeed: 30_200_096;
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
  ]);

export interface AiBenchmarkSeedAccessRequest {
  readonly startSeed: number;
  readonly seeds: number;
  readonly reservationId?: string;
  readonly reservationMode?: "training-screen";
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

  const overlapping = AI_BENCHMARK_SEED_LEDGER.filter(
    (entry) =>
      request.startSeed <= entry.endSeed && endSeed >= entry.startSeed,
  );
  if (overlapping.length === 0) {
    if (
      request.reservationId !== undefined ||
      request.reservationMode !== undefined
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
    request.reservationMode !== entry.reservationMode
  ) {
    return decision(
      false,
      entry.id,
      `reserved ledger entry ${entry.id} requires reservation ${entry.reservationId} in ${entry.reservationMode} mode`,
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
