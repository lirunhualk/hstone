import { createHash } from "node:crypto";

import type { AiTrainingObservation } from "../lib/game/ai-training.ts";

export const AI_EXPERT_SAMPLE_SCHEMA_VERSION = 1 as const;

export const AI_EXPERT_MACRO_PLANS = [
  "tempo",
  "normalLevel",
  "fastLevel",
  "economy",
  "triple",
  "pivot",
  "refresh",
  "endTurn",
] as const;

export type AiExpertMacroPlan = (typeof AI_EXPERT_MACRO_PLANS)[number];
export type AiExpertConfidenceLevel = "low" | "medium" | "high";
export type AiExpertScreenEvidenceType =
  | "visibleText"
  | "visibleCard"
  | "visibleStat"
  | "visibleAction"
  | "visibleOutcome";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | JsonObject;

export interface JsonObject {
  [key: string]: JsonValue;
}

/** Full training observations and smaller hand-authored public projections fit. */
export type AiExpertPublicObservation = AiTrainingObservation | JsonObject;

export interface AiExpertVideoSource {
  platform: "bilibili";
  bvid: string;
  /** Exact frame time from the start of the video. */
  timestampMs: number;
}

export interface AiExpertScreenFact {
  id: string;
  kind: "screenFact";
  statement: string;
  evidenceType: AiExpertScreenEvidenceType;
}

export interface AiExpertEngineeringInference {
  id: string;
  kind: "engineeringInference";
  statement: string;
  basedOnFactIds: string[];
  confidence: number;
}

export interface AiExpertLabelConfidence {
  level: AiExpertConfidenceLevel;
  score: number;
  rationale: string;
}

export interface AiExpertDecisionSample {
  schemaVersion: typeof AI_EXPERT_SAMPLE_SCHEMA_VERSION;
  sampleId: string;
  canonicalHash: string;
  contentVersion: string;
  patchVersion: string;
  source: AiExpertVideoSource;
  observation: AiExpertPublicObservation;
  candidatePlans: AiExpertMacroPlan[];
  chosenPlan: AiExpertMacroPlan;
  screenFacts: AiExpertScreenFact[];
  engineeringInferences: AiExpertEngineeringInference[];
  labelConfidence: AiExpertLabelConfidence;
}

export type CreateAiExpertDecisionSampleInput = Omit<
  AiExpertDecisionSample,
  "canonicalHash"
>;

export type AiExpertSampleValidationCode =
  | "invalid_sample"
  | "unknown_field"
  | "invalid_schema_version"
  | "invalid_sample_id"
  | "invalid_content_version"
  | "invalid_patch_version"
  | "invalid_source"
  | "invalid_bvid"
  | "invalid_timestamp"
  | "invalid_observation_json"
  | "forbidden_observation_key"
  | "missing_candidates"
  | "invalid_plan"
  | "duplicate_candidate"
  | "choice_not_candidate"
  | "missing_facts"
  | "invalid_fact"
  | "duplicate_evidence_id"
  | "misclassified_fact"
  | "inference_in_fact"
  | "missing_inferences"
  | "invalid_inference"
  | "misclassified_inference"
  | "unknown_fact_reference"
  | "invalid_confidence"
  | "invalid_hash"
  | "hash_mismatch"
  | "invalid_batch"
  | "duplicate_sample_id"
  | "duplicate_hash";

export interface AiExpertSampleValidationIssue {
  code: AiExpertSampleValidationCode;
  path: string;
  message: string;
}

export interface AiExpertSampleValidationResult {
  valid: boolean;
  issues: readonly AiExpertSampleValidationIssue[];
}

type JsonRecord = Record<string, unknown>;

const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const PATCH_VERSION_PATTERN = /^\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/;
const BVID_PATTERN = /^BV[1-9A-HJ-NP-Za-km-z]{10}$/;
const EVIDENCE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const INFERENCE_AS_FACT_PATTERN =
  /(?:推测|推断|猜测|大概是|可能是|似乎是|应该是|likely|probably|presumably|perhaps|maybe|we infer|i infer|assum(?:e|ed|ing|ption))/iu;

const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion",
  "sampleId",
  "canonicalHash",
  "contentVersion",
  "patchVersion",
  "source",
  "observation",
  "candidatePlans",
  "chosenPlan",
  "screenFacts",
  "engineeringInferences",
  "labelConfidence",
]);
const SOURCE_FIELDS = new Set(["platform", "bvid", "timestampMs"]);
const FACT_FIELDS = new Set(["id", "kind", "statement", "evidenceType"]);
const INFERENCE_FIELDS = new Set([
  "id",
  "kind",
  "statement",
  "basedOnFactIds",
  "confidence",
]);
const LABEL_CONFIDENCE_FIELDS = new Set([
  "level",
  "score",
  "rationale",
]);
const PUBLIC_OBSERVATION_FORBIDDEN_KEYS = new Set([
  "seed",
  "rngstate",
  "pool",
  "spellpool",
  "poolcopies",
  "poolcopiesbydefinitionid",
  "poolcopiesonpurchase",
  "lastbattle",
  "lastroundbattles",
  "battlesummary",
  "battleevents",
  "initialboards",
  "finalboards",
  "events",
  "humanplayerid",
  "playeraid",
  "playerbid",
  "winnerid",
  "optioninstanceids",
]);

function isPlainRecord(value: unknown): value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(
  issues: AiExpertSampleValidationIssue[],
  code: AiExpertSampleValidationCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function validateOnlyFields(
  record: JsonRecord,
  allowed: ReadonlySet<string>,
  path: string,
  issues: AiExpertSampleValidationIssue[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      addIssue(
        issues,
        "unknown_field",
        `${path}.${key}`,
        `unknown field ${key}`,
      );
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUnitInterval(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

function isMacroPlan(value: unknown): value is AiExpertMacroPlan {
  return (
    typeof value === "string" &&
    AI_EXPERT_MACRO_PLANS.includes(value as AiExpertMacroPlan)
  );
}

function isForbiddenObservationKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    PUBLIC_OBSERVATION_FORBIDDEN_KEYS.has(normalized) ||
    normalized.includes("seed") ||
    normalized.endsWith("instanceid") ||
    normalized.endsWith("instanceids") ||
    normalized.endsWith("interactionid") ||
    normalized.endsWith("interactionids") ||
    normalized.endsWith("playerid") ||
    normalized.endsWith("playerids") ||
    normalized.endsWith("opponentid") ||
    normalized.endsWith("opponentids")
  );
}

function validateObservationJson(
  value: unknown,
  path: string,
  issues: AiExpertSampleValidationIssue[],
  ancestors: WeakSet<object>,
): void {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      addIssue(
        issues,
        "invalid_observation_json",
        path,
        "observation contains a non-finite number",
      );
    }
    return;
  }
  if (typeof value !== "object") {
    addIssue(
      issues,
      "invalid_observation_json",
      path,
      "observation is not JSON serializable",
    );
    return;
  }
  if (ancestors.has(value)) {
    addIssue(
      issues,
      "invalid_observation_json",
      path,
      "observation contains a cycle",
    );
    return;
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        validateObservationJson(
          item,
          `${path}[${index}]`,
          issues,
          ancestors,
        ),
      );
      return;
    }
    if (!isPlainRecord(value)) {
      addIssue(
        issues,
        "invalid_observation_json",
        path,
        "observation contains a non-plain object",
      );
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (isForbiddenObservationKey(key)) {
        addIssue(
          issues,
          "forbidden_observation_key",
          `${path}.${key}`,
          `observation leaks forbidden key ${key}`,
        );
      }
      validateObservationJson(child, `${path}.${key}`, issues, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function canonicalJsonValue(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} contains a non-finite number`);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new Error(`${path} is not JSON serializable`);
  }
  if (ancestors.has(value)) {
    throw new Error(`${path} contains a cycle`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value
        .map((item, index) =>
          canonicalJsonValue(item, `${path}[${index}]`, ancestors),
        )
        .join(",")}]`;
    }
    if (!isPlainRecord(value)) {
      throw new Error(`${path} contains a non-plain object`);
    }
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        if (value[key] === undefined) {
          throw new Error(`${path}.${key} is undefined`);
        }
        return `${JSON.stringify(key)}:${canonicalJsonValue(
          value[key],
          `${path}.${key}`,
          ancestors,
        )}`;
      });
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalAiExpertSampleJson(value: unknown): string {
  return canonicalJsonValue(value, "sample", new WeakSet<object>());
}

export function computeAiExpertSampleCanonicalHash(value: unknown): string {
  if (!isPlainRecord(value)) {
    throw new Error("expert sample must be a plain object");
  }
  const payload: JsonRecord = { ...value };
  delete payload.canonicalHash;
  return createHash("sha256")
    .update(canonicalAiExpertSampleJson(payload))
    .digest("hex");
}

function validateSource(
  value: unknown,
  path: string,
  issues: AiExpertSampleValidationIssue[],
): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, "invalid_source", path, "source must be an object");
    return;
  }
  validateOnlyFields(value, SOURCE_FIELDS, path, issues);
  if (value.platform !== "bilibili") {
    addIssue(
      issues,
      "invalid_source",
      `${path}.platform`,
      "source.platform must be bilibili",
    );
  }
  if (typeof value.bvid !== "string" || !BVID_PATTERN.test(value.bvid)) {
    addIssue(
      issues,
      "invalid_bvid",
      `${path}.bvid`,
      "bvid must be a syntactically valid BV identifier",
    );
  }
  if (
    !Number.isSafeInteger(value.timestampMs) ||
    Number(value.timestampMs) < 0
  ) {
    addIssue(
      issues,
      "invalid_timestamp",
      `${path}.timestampMs`,
      "timestampMs must be a non-negative safe integer",
    );
  }
}

function validateCandidatePlans(
  value: unknown,
  issues: AiExpertSampleValidationIssue[],
): Set<AiExpertMacroPlan> {
  const candidates = new Set<AiExpertMacroPlan>();
  if (!Array.isArray(value) || value.length < 2) {
    addIssue(
      issues,
      "missing_candidates",
      "$.candidatePlans",
      "candidatePlans must contain at least two macro plans",
    );
  }
  if (!Array.isArray(value)) return candidates;
  value.forEach((candidate, index) => {
    if (!isMacroPlan(candidate)) {
      addIssue(
        issues,
        "invalid_plan",
        `$.candidatePlans[${index}]`,
        "candidate is not a supported macro plan",
      );
      return;
    }
    if (candidates.has(candidate)) {
      addIssue(
        issues,
        "duplicate_candidate",
        `$.candidatePlans[${index}]`,
        `candidate plan ${candidate} is duplicated`,
      );
    }
    candidates.add(candidate);
  });
  return candidates;
}

function validateScreenFacts(
  value: unknown,
  issues: AiExpertSampleValidationIssue[],
): Set<string> {
  const factIds = new Set<string>();
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(
      issues,
      "missing_facts",
      "$.screenFacts",
      "screenFacts must contain at least one directly visible fact",
    );
  }
  if (!Array.isArray(value)) return factIds;
  value.forEach((fact, index) => {
    const path = `$.screenFacts[${index}]`;
    if (!isPlainRecord(fact)) {
      addIssue(issues, "invalid_fact", path, "screen fact must be an object");
      return;
    }
    validateOnlyFields(fact, FACT_FIELDS, path, issues);
    if (fact.kind !== "screenFact") {
      addIssue(
        issues,
        "misclassified_fact",
        `${path}.kind`,
        "engineering inference cannot be stored as a screen fact",
      );
    }
    if (typeof fact.id !== "string" || !EVIDENCE_ID_PATTERN.test(fact.id)) {
      addIssue(
        issues,
        "invalid_fact",
        `${path}.id`,
        "fact id must use lower-case label syntax",
      );
    } else if (factIds.has(fact.id)) {
      addIssue(
        issues,
        "duplicate_evidence_id",
        `${path}.id`,
        `duplicate evidence id ${fact.id}`,
      );
    } else {
      factIds.add(fact.id);
    }
    if (!isNonEmptyString(fact.statement)) {
      addIssue(
        issues,
        "invalid_fact",
        `${path}.statement`,
        "fact statement must be non-empty",
      );
    } else if (INFERENCE_AS_FACT_PATTERN.test(fact.statement)) {
      addIssue(
        issues,
        "inference_in_fact",
        `${path}.statement`,
        "fact statement contains inference language",
      );
    }
    if (
      typeof fact.evidenceType !== "string" ||
      ![
        "visibleText",
        "visibleCard",
        "visibleStat",
        "visibleAction",
        "visibleOutcome",
      ].includes(fact.evidenceType)
    ) {
      addIssue(
        issues,
        "invalid_fact",
        `${path}.evidenceType`,
        "fact evidenceType is invalid",
      );
    }
  });
  return factIds;
}

function validateEngineeringInferences(
  value: unknown,
  factIds: ReadonlySet<string>,
  issues: AiExpertSampleValidationIssue[],
): void {
  const inferenceIds = new Set<string>();
  if (!Array.isArray(value) || value.length === 0) {
    addIssue(
      issues,
      "missing_inferences",
      "$.engineeringInferences",
      "engineeringInferences must explain the macro-plan label",
    );
  }
  if (!Array.isArray(value)) return;
  value.forEach((inference, index) => {
    const path = `$.engineeringInferences[${index}]`;
    if (!isPlainRecord(inference)) {
      addIssue(
        issues,
        "invalid_inference",
        path,
        "engineering inference must be an object",
      );
      return;
    }
    validateOnlyFields(inference, INFERENCE_FIELDS, path, issues);
    if (inference.kind !== "engineeringInference") {
      addIssue(
        issues,
        "misclassified_inference",
        `${path}.kind`,
        "screen fact cannot be stored as an engineering inference",
      );
    }
    if (
      typeof inference.id !== "string" ||
      !EVIDENCE_ID_PATTERN.test(inference.id)
    ) {
      addIssue(
        issues,
        "invalid_inference",
        `${path}.id`,
        "inference id must use lower-case label syntax",
      );
    } else if (factIds.has(inference.id) || inferenceIds.has(inference.id)) {
      addIssue(
        issues,
        "duplicate_evidence_id",
        `${path}.id`,
        `duplicate evidence id ${inference.id}`,
      );
    } else {
      inferenceIds.add(inference.id);
    }
    if (!isNonEmptyString(inference.statement)) {
      addIssue(
        issues,
        "invalid_inference",
        `${path}.statement`,
        "inference statement must be non-empty",
      );
    }
    if (
      !Array.isArray(inference.basedOnFactIds) ||
      inference.basedOnFactIds.length === 0
    ) {
      addIssue(
        issues,
        "invalid_inference",
        `${path}.basedOnFactIds`,
        "inference must reference at least one screen fact",
      );
    } else {
      const seenReferences = new Set<string>();
      inference.basedOnFactIds.forEach((factId, factIndex) => {
        if (typeof factId !== "string" || !factIds.has(factId)) {
          addIssue(
            issues,
            "unknown_fact_reference",
            `${path}.basedOnFactIds[${factIndex}]`,
            `inference references unknown screen fact ${String(factId)}`,
          );
        } else if (seenReferences.has(factId)) {
          addIssue(
            issues,
            "invalid_inference",
            `${path}.basedOnFactIds[${factIndex}]`,
            `inference repeats screen fact ${factId}`,
          );
        }
        if (typeof factId === "string") seenReferences.add(factId);
      });
    }
    if (!isUnitInterval(inference.confidence)) {
      addIssue(
        issues,
        "invalid_confidence",
        `${path}.confidence`,
        "inference confidence must be between 0 and 1",
      );
    }
  });
}

function validateLabelConfidence(
  value: unknown,
  issues: AiExpertSampleValidationIssue[],
): void {
  if (!isPlainRecord(value)) {
    addIssue(
      issues,
      "invalid_confidence",
      "$.labelConfidence",
      "labelConfidence must be an object",
    );
    return;
  }
  validateOnlyFields(
    value,
    LABEL_CONFIDENCE_FIELDS,
    "$.labelConfidence",
    issues,
  );
  if (!(["low", "medium", "high"] as const).includes(
    value.level as AiExpertConfidenceLevel,
  )) {
    addIssue(
      issues,
      "invalid_confidence",
      "$.labelConfidence.level",
      "label confidence level must be low, medium, or high",
    );
  }
  if (!isUnitInterval(value.score)) {
    addIssue(
      issues,
      "invalid_confidence",
      "$.labelConfidence.score",
      "label confidence score must be between 0 and 1",
    );
  }
  if (!isNonEmptyString(value.rationale)) {
    addIssue(
      issues,
      "invalid_confidence",
      "$.labelConfidence.rationale",
      "label confidence rationale must be non-empty",
    );
  }
}

export function validateAiExpertDecisionSample(
  value: unknown,
): AiExpertSampleValidationResult {
  const issues: AiExpertSampleValidationIssue[] = [];
  if (!isPlainRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid_sample",
          path: "$",
          message: "expert sample must be a plain object",
        },
      ],
    };
  }
  validateOnlyFields(value, TOP_LEVEL_FIELDS, "$", issues);
  if (value.schemaVersion !== AI_EXPERT_SAMPLE_SCHEMA_VERSION) {
    addIssue(
      issues,
      "invalid_schema_version",
      "$.schemaVersion",
      `schemaVersion must be ${AI_EXPERT_SAMPLE_SCHEMA_VERSION}`,
    );
  }
  if (
    typeof value.sampleId !== "string" ||
    !SAMPLE_ID_PATTERN.test(value.sampleId)
  ) {
    addIssue(
      issues,
      "invalid_sample_id",
      "$.sampleId",
      "sampleId must be a stable lower-case identifier",
    );
  }
  if (!isNonEmptyString(value.contentVersion)) {
    addIssue(
      issues,
      "invalid_content_version",
      "$.contentVersion",
      "contentVersion must be non-empty",
    );
  }
  if (
    typeof value.patchVersion !== "string" ||
    !PATCH_VERSION_PATTERN.test(value.patchVersion)
  ) {
    addIssue(
      issues,
      "invalid_patch_version",
      "$.patchVersion",
      "patchVersion must use dotted numeric patch syntax",
    );
  }
  validateSource(value.source, "$.source", issues);
  if (!isPlainRecord(value.observation)) {
    addIssue(
      issues,
      "invalid_observation_json",
      "$.observation",
      "observation must be a public JSON object",
    );
  } else {
    validateObservationJson(
      value.observation,
      "$.observation",
      issues,
      new WeakSet<object>(),
    );
  }
  const candidatePlans = validateCandidatePlans(value.candidatePlans, issues);
  if (!isMacroPlan(value.chosenPlan)) {
    addIssue(
      issues,
      "invalid_plan",
      "$.chosenPlan",
      "chosenPlan is not a supported macro plan",
    );
  } else if (!candidatePlans.has(value.chosenPlan)) {
    addIssue(
      issues,
      "choice_not_candidate",
      "$.chosenPlan",
      "chosenPlan must be present in candidatePlans",
    );
  }
  const factIds = validateScreenFacts(value.screenFacts, issues);
  validateEngineeringInferences(
    value.engineeringInferences,
    factIds,
    issues,
  );
  validateLabelConfidence(value.labelConfidence, issues);
  if (
    typeof value.canonicalHash !== "string" ||
    !SHA256_PATTERN.test(value.canonicalHash)
  ) {
    addIssue(
      issues,
      "invalid_hash",
      "$.canonicalHash",
      "canonicalHash must be a lower-case SHA-256 hash",
    );
  } else {
    try {
      const computed = computeAiExpertSampleCanonicalHash(value);
      if (computed !== value.canonicalHash) {
        addIssue(
          issues,
          "hash_mismatch",
          "$.canonicalHash",
          "canonicalHash does not match the canonical payload",
        );
      }
    } catch (error) {
      addIssue(
        issues,
        "invalid_hash",
        "$.canonicalHash",
        `canonical hash cannot be computed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return { valid: issues.length === 0, issues };
}

export function validateAiExpertDecisionSampleBatch(
  value: unknown,
): AiExpertSampleValidationResult {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      issues: [
        {
          code: "invalid_batch",
          path: "$",
          message: "expert sample batch must be an array",
        },
      ],
    };
  }
  const issues: AiExpertSampleValidationIssue[] = [];
  const sampleIds = new Map<string, number>();
  const hashes = new Map<string, number>();
  value.forEach((sample, index) => {
    const validation = validateAiExpertDecisionSample(sample);
    validation.issues.forEach((issue) =>
      issues.push({
        ...issue,
        path: `$[${index}]${issue.path.slice(1)}`,
      }),
    );
    if (!isPlainRecord(sample)) return;
    if (typeof sample.sampleId === "string") {
      const previous = sampleIds.get(sample.sampleId);
      if (previous !== undefined) {
        addIssue(
          issues,
          "duplicate_sample_id",
          `$[${index}].sampleId`,
          `sampleId duplicates batch item ${previous}`,
        );
      } else {
        sampleIds.set(sample.sampleId, index);
      }
    }
    if (typeof sample.canonicalHash === "string") {
      const previous = hashes.get(sample.canonicalHash);
      if (previous !== undefined) {
        addIssue(
          issues,
          "duplicate_hash",
          `$[${index}].canonicalHash`,
          `canonicalHash duplicates batch item ${previous}`,
        );
      } else {
        hashes.set(sample.canonicalHash, index);
      }
    }
  });
  return { valid: issues.length === 0, issues };
}

export function assertValidAiExpertDecisionSample(
  value: unknown,
): asserts value is AiExpertDecisionSample {
  const validation = validateAiExpertDecisionSample(value);
  if (!validation.valid) {
    throw new Error(
      `invalid AI expert sample: ${validation.issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join("; ")}`,
    );
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

export function createAiExpertDecisionSample(
  input: CreateAiExpertDecisionSampleInput,
): Readonly<AiExpertDecisionSample> {
  canonicalAiExpertSampleJson(input);
  const payload = JSON.parse(
    JSON.stringify(input),
  ) as CreateAiExpertDecisionSampleInput;
  const sample: AiExpertDecisionSample = {
    ...payload,
    canonicalHash: computeAiExpertSampleCanonicalHash(payload),
  };
  assertValidAiExpertDecisionSample(sample);
  return deepFreeze(sample);
}
