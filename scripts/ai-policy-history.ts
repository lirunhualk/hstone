import { createHash } from "node:crypto";

import {
  canonicalAiPolicyArtifactJson,
  validateAiPolicyArtifact,
  type AiPolicyArtifact,
} from "./ai-policy-artifact.ts";

export const AI_POLICY_HISTORY_SCHEMA_VERSION = 1 as const;

export interface AiPolicyHistoryPool {
  schemaVersion: typeof AI_POLICY_HISTORY_SCHEMA_VERSION;
  poolHash: string;
  championArtifactHash: string | null;
  artifacts: readonly AiPolicyArtifact[];
}

export interface CreateAiPolicyHistoryPoolInput {
  artifacts: readonly AiPolicyArtifact[];
  championArtifactHash?: string | null;
}

export interface AiPolicyHistoryValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export interface AiPolicyOpponentExpectations {
  contentVersion: string;
  evaluatorHash: string;
  excludeArtifactHash?: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function computeAiPolicyHistoryPoolHash(
  value: Omit<AiPolicyHistoryPool, "poolHash"> | AiPolicyHistoryPool,
): string {
  if (!isRecord(value)) {
    throw new Error("AI policy history payload must be an object");
  }
  const payload: JsonRecord = { ...value };
  delete payload.poolHash;
  return createHash("sha256")
    .update(canonicalAiPolicyArtifactJson(payload))
    .digest("hex");
}

function cloneJson<T>(value: T): T {
  canonicalAiPolicyArtifactJson(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}

function artifactIdentity(value: unknown): {
  artifactHash: string | null;
  policyProfileKey: string | null;
} {
  if (!isRecord(value)) {
    return { artifactHash: null, policyProfileKey: null };
  }
  const artifactHash = isSha256(value.artifactHash)
    ? value.artifactHash
    : null;
  const policyProfileKey =
    typeof value.policyVersion === "string" &&
    isSha256(value.strategyProfileHash)
      ? JSON.stringify([value.policyVersion, value.strategyProfileHash])
      : null;
  return { artifactHash, policyProfileKey };
}

export function validateAiPolicyHistoryPool(
  value: unknown,
): AiPolicyHistoryValidationResult {
  if (!isRecord(value)) {
    return { valid: false, errors: ["AI policy history pool must be an object"] };
  }

  const errors: string[] = [];
  if (value.schemaVersion !== AI_POLICY_HISTORY_SCHEMA_VERSION) {
    errors.push(
      `history schemaVersion must be ${AI_POLICY_HISTORY_SCHEMA_VERSION}`,
    );
  }
  if (!isSha256(value.poolHash)) {
    errors.push("poolHash must be a lowercase SHA-256 hash");
  }
  if (value.championArtifactHash !== null && !isSha256(value.championArtifactHash)) {
    errors.push("championArtifactHash must be a SHA-256 hash or null");
  }

  const artifacts = Array.isArray(value.artifacts) ? value.artifacts : null;
  const artifactByHash = new Map<string, JsonRecord>();
  const policyProfileKeys = new Set<string>();
  const orderedHashes: string[] = [];
  if (!artifacts) {
    errors.push("artifacts must be an array");
  } else {
    for (const [index, artifact] of artifacts.entries()) {
      const validation = validateAiPolicyArtifact(artifact);
      for (const error of validation.errors) {
        errors.push(`artifacts[${index}]: ${error}`);
      }

      const identity = artifactIdentity(artifact);
      if (identity.artifactHash) {
        if (artifactByHash.has(identity.artifactHash)) {
          errors.push(
            `artifacts contain duplicate artifactHash ${identity.artifactHash}`,
          );
        } else if (isRecord(artifact)) {
          artifactByHash.set(identity.artifactHash, artifact);
        }
        orderedHashes.push(identity.artifactHash);
      }
      if (identity.policyProfileKey) {
        if (policyProfileKeys.has(identity.policyProfileKey)) {
          const [policyVersion, strategyProfileHash] = JSON.parse(
            identity.policyProfileKey,
          ) as [string, string];
          errors.push(
            `artifacts contain duplicate policy/profile ${policyVersion}/${strategyProfileHash}`,
          );
        }
        policyProfileKeys.add(identity.policyProfileKey);
      }
    }

    const sortedHashes = [...orderedHashes].sort();
    if (
      sortedHashes.length === orderedHashes.length &&
      sortedHashes.some((hash, index) => hash !== orderedHashes[index])
    ) {
      errors.push("artifacts are not in canonical artifactHash order");
    }
  }

  if (isSha256(value.championArtifactHash)) {
    const champion = artifactByHash.get(value.championArtifactHash);
    if (!champion) {
      errors.push("championArtifactHash does not reference a pool artifact");
    } else if (
      !isRecord(champion.acceptance) ||
      champion.acceptance.accepted !== true
    ) {
      errors.push("champion artifact must have accepted evidence");
    }
  }

  if (typeof value.poolHash === "string") {
    try {
      const computedHash = computeAiPolicyHistoryPoolHash(
        value as unknown as AiPolicyHistoryPool,
      );
      if (computedHash !== value.poolHash) {
        errors.push("poolHash does not match canonical payload");
      }
    } catch (error) {
      errors.push(
        `history canonicalization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function loadAiPolicyHistoryPool(source: unknown): AiPolicyHistoryPool {
  let parsed = source;
  if (typeof source === "string") {
    try {
      parsed = JSON.parse(source) as unknown;
    } catch (error) {
      throw new Error(
        `invalid AI policy history JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  const validation = validateAiPolicyHistoryPool(parsed);
  if (!validation.valid) {
    throw new Error(
      `invalid AI policy history pool: ${validation.errors.join("; ")}`,
    );
  }
  return deepFreeze(cloneJson(parsed as AiPolicyHistoryPool));
}

export function createAiPolicyHistoryPool(
  input: CreateAiPolicyHistoryPoolInput,
): AiPolicyHistoryPool {
  const artifacts = [...input.artifacts].sort((left, right) =>
    left.artifactHash.localeCompare(right.artifactHash),
  );
  const payload = {
    schemaVersion: AI_POLICY_HISTORY_SCHEMA_VERSION,
    championArtifactHash: input.championArtifactHash ?? null,
    artifacts,
  };
  return loadAiPolicyHistoryPool({
    ...payload,
    poolHash: computeAiPolicyHistoryPoolHash(payload),
  });
}

function validateOpponentExpectations(
  expectations: AiPolicyOpponentExpectations,
): void {
  if (expectations.contentVersion.length === 0) {
    throw new Error("opponent contentVersion must be non-empty");
  }
  if (!isSha256(expectations.evaluatorHash)) {
    throw new Error("opponent evaluatorHash must be a lowercase SHA-256 hash");
  }
  if (
    expectations.excludeArtifactHash !== undefined &&
    !isSha256(expectations.excludeArtifactHash)
  ) {
    throw new Error(
      "excludeArtifactHash must be a lowercase SHA-256 hash when provided",
    );
  }
}

export function compatibleAiPolicyOpponentArtifacts(
  source: unknown,
  expectations: AiPolicyOpponentExpectations,
): readonly AiPolicyArtifact[] {
  validateOpponentExpectations(expectations);
  const pool = loadAiPolicyHistoryPool(source);
  const matches = pool.artifacts.filter((artifact) => {
    if (
      artifact.acceptance.accepted !== true ||
      artifact.artifactHash === expectations.excludeArtifactHash
    ) {
      return false;
    }
    return validateAiPolicyArtifact(artifact, {
      contentVersion: expectations.contentVersion,
      evaluatorHash: expectations.evaluatorHash,
    }).valid;
  });
  return deepFreeze(matches);
}
