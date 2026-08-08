import { createHash } from "node:crypto";

import {
  createProfileNeutralAiResidualSemanticRecord,
  type AiResidualSemanticRecord,
} from "../lib/game/ai-residual-features.ts";
import { AI_POLICY_VERSION } from "../lib/game/ai.ts";
import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";
import type {
  AiFreezeMacroChoice,
  AiRefreshMacroChoice,
  AiResidualMacroKind,
  AiUpgradeMacroChoice,
  DeepReadonly,
} from "../lib/game/ai-residual-policy.ts";
import {
  assertValidAiExpertDecisionSample,
  canonicalAiExpertSampleJson,
  type AiExpertDecisionSample,
} from "./ai-expert-samples.ts";

export const AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION = 1 as const;
export const AI_RESIDUAL_VIDEO_EXAMPLE_SCHEMA_VERSION = 2 as const;
export const AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT = 8 as const;
export const AI_RESIDUAL_VIDEO_MIN_CONFIDENCE = 0.9 as const;

export interface AiResidualRuntimeCompatibility {
  readonly compatible: true;
  readonly reviewedBy: string;
  /** SHA-256 of the exact media bytes used for the frame review. */
  readonly reviewedMediaSha256: string;
  readonly reason: string;
  readonly sourcePatch: "35.4.2" | "36.0" | "36.0.3";
  readonly targetContentVersion: typeof CURRENT_ROSTER_VERSION;
}

export interface AiResidualObservedValue<Value> {
  readonly value: Value;
  readonly screenFactIds: readonly string[];
}

export interface AiResidualVideoVisibleCommon {
  readonly round?: AiResidualObservedValue<number>;
  readonly tavernTier?: AiResidualObservedValue<number>;
  readonly health?: AiResidualObservedValue<number>;
  readonly armor?: AiResidualObservedValue<number>;
  readonly gold?: AiResidualObservedValue<number>;
  readonly boardSize?: AiResidualObservedValue<number>;
  readonly handSize?: AiResidualObservedValue<number>;
}

export interface AiResidualVideoUpgradeVisible
  extends AiResidualVideoVisibleCommon {
  readonly upgradeCost?: AiResidualObservedValue<number>;
}

export interface AiResidualVideoRefreshVisible
  extends AiResidualVideoVisibleCommon {
  readonly refreshCurrency?: AiResidualObservedValue<"gold" | "health">;
  readonly refreshCost?: AiResidualObservedValue<number>;
}

export interface AiResidualVideoFreezeVisible
  extends AiResidualVideoVisibleCommon {
  readonly currentlyFrozen?: AiResidualObservedValue<boolean>;
}

interface AiResidualVideoEvidenceBase<
  Kind extends AiResidualMacroKind,
  Choice extends string,
  Visible extends AiResidualVideoVisibleCommon,
> {
  readonly schemaVersion: typeof AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION;
  readonly expertSampleHash: string;
  readonly kind: Kind;
  readonly choice: Choice;
  readonly choiceEvidenceId: string;
  readonly legalChoiceFactIds: readonly string[];
  readonly visible: Visible;
}

export type AiResidualVideoEvidence =
  | AiResidualVideoEvidenceBase<
      "upgrade",
      AiUpgradeMacroChoice,
      AiResidualVideoUpgradeVisible
    >
  | AiResidualVideoEvidenceBase<
      "refresh",
      AiRefreshMacroChoice,
      AiResidualVideoRefreshVisible
    >
  | AiResidualVideoEvidenceBase<
      "freeze",
      AiFreezeMacroChoice,
      AiResidualVideoFreezeVisible
    >;

interface AiResidualVideoExampleBase<
  Kind extends AiResidualMacroKind,
  Choice extends string,
> {
  readonly schemaVersion: typeof AI_RESIDUAL_VIDEO_EXAMPLE_SCHEMA_VERSION;
  readonly source: "video";
  readonly exampleId: string;
  readonly canonicalHash: string;
  readonly expertSampleHash: string;
  readonly evidenceHash: string;
  readonly compatibilityHash: string;
  readonly expertSample: DeepReadonly<AiExpertDecisionSample>;
  readonly evidence: DeepReadonly<AiResidualVideoEvidence>;
  readonly runtimeCompatibility: DeepReadonly<AiResidualRuntimeCompatibility>;
  readonly bvid: string;
  readonly timestampMs: number;
  readonly contentVersion: string;
  readonly patchVersion: string;
  readonly kind: Kind;
  readonly choice: Choice;
  /**
   * Decision produced by replaying the pinned runtime baseline for this exact
   * state. Null means no comparable replay exists and promotion must fail
   * closed; it must never be inferred from the expert label.
   */
  readonly baselineChoice: Choice | null;
  readonly baselinePolicyVersion: typeof AI_POLICY_VERSION | null;
  /** Hash of the independently retained same-state replay evidence. */
  readonly baselineReplayHash: string | null;
  readonly weight: typeof AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT;
  readonly semanticRecord: DeepReadonly<AiResidualSemanticRecord>;
}

export type AiResidualVideoTrainingExample =
  | AiResidualVideoExampleBase<"upgrade", AiUpgradeMacroChoice>
  | AiResidualVideoExampleBase<"refresh", AiRefreshMacroChoice>
  | AiResidualVideoExampleBase<"freeze", AiFreezeMacroChoice>;

export interface AiResidualVideoEvidenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface AiResidualVideoTrainingExampleValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

type JsonRecord = Record<string, unknown>;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMON_VISIBLE_KEYS = [
  "round",
  "tavernTier",
  "health",
  "armor",
  "gold",
  "boardSize",
  "handSize",
] as const;
const EVIDENCE_KEYS = [
  "schemaVersion",
  "expertSampleHash",
  "kind",
  "choice",
  "choiceEvidenceId",
  "legalChoiceFactIds",
  "visible",
] as const;
const OBSERVED_VALUE_KEYS = ["value", "screenFactIds"] as const;

const VIDEO_EXAMPLE_KEYS = [
  "schemaVersion",
  "source",
  "exampleId",
  "canonicalHash",
  "expertSampleHash",
  "evidenceHash",
  "compatibilityHash",
  "expertSample",
  "evidence",
  "runtimeCompatibility",
  "bvid",
  "timestampMs",
  "contentVersion",
  "patchVersion",
  "kind",
  "choice",
  "baselineChoice",
  "baselinePolicyVersion",
  "baselineReplayHash",
  "weight",
  "semanticRecord",
] as const;

class StrictVideoDataError extends Error {}

function strictDataSnapshot(
  value: unknown,
  path = "$",
  ancestors = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new StrictVideoDataError(`${path} must contain finite numbers`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new StrictVideoDataError(`${path} must contain only JSON data`);
  }
  if (ancestors.has(value)) {
    throw new StrictVideoDataError(`${path} must not contain cycles`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new StrictVideoDataError(`${path} must use the ordinary array prototype`);
      }
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      if (!Number.isSafeInteger(length) || (length as number) < 0) {
        throw new StrictVideoDataError(`${path}.length is invalid`);
      }
      const ownKeys = Reflect.ownKeys(value);
      if (
        ownKeys.length !== (length as number) + 1 ||
        ownKeys.some(
          (key) =>
            typeof key !== "string" ||
            (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key)),
        )
      ) {
        throw new StrictVideoDataError(`${path} has symbol, sparse, or extra properties`);
      }
      const snapshot: unknown[] = [];
      for (let index = 0; index < (length as number); index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor?.enumerable !== true || !("value" in descriptor)) {
          throw new StrictVideoDataError(`${path}[${index}] must be an own data property`);
        }
        snapshot.push(
          strictDataSnapshot(descriptor.value, `${path}[${index}]`, ancestors),
        );
      }
      return snapshot;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new StrictVideoDataError(`${path} must use the ordinary object prototype`);
    }
    const snapshot: JsonRecord = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new StrictVideoDataError(`${path} must not contain symbol properties`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) {
        throw new StrictVideoDataError(`${path}.${key} must be an own enumerable data property`);
      }
      snapshot[key] = strictDataSnapshot(
        descriptor.value,
        `${path}.${key}`,
        ancestors,
      );
    }
    return snapshot;
  } finally {
    ancestors.delete(value);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(
  value: JsonRecord,
  allowed: readonly string[],
  path: string,
  errors: string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function requireExactKeys(
  value: JsonRecord,
  expected: readonly string[],
  path: string,
  errors: string[],
): void {
  unexpectedKeys(value, expected, path, errors);
  for (const key of expected) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`${path}.${key} is required`);
    }
  }
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY,
): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum
  );
}

function choiceIsValid(kind: unknown, choice: unknown): boolean {
  switch (kind) {
    case "upgrade":
      return choice === "upgradeNow" || choice === "deferUpgrade";
    case "refresh":
      return choice === "refreshOnce" || choice === "stopRefreshing";
    case "freeze":
      return choice === "freeze" || choice === "unfreeze";
    default:
      return false;
  }
}

function validateStringArray(
  value: unknown,
  path: string,
  errors: string[],
  validIds: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array`);
    return [];
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      errors.push(`${path}[${index}] must be a non-empty string`);
      return;
    }
    if (seen.has(item)) errors.push(`${path}[${index}] is duplicated`);
    if (!validIds.has(item)) errors.push(`${path}[${index}] is not a screen fact`);
    seen.add(item);
    ids.push(item);
  });
  return ids;
}

function validateObservedValue(
  value: unknown,
  path: string,
  errors: string[],
  screenFactIds: ReadonlySet<string>,
  valueIsValid: (item: unknown) => boolean,
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an observed value object`);
    return;
  }
  requireExactKeys(value, OBSERVED_VALUE_KEYS, path, errors);
  if (!valueIsValid(value.value)) errors.push(`${path}.value is invalid`);
  validateStringArray(
    value.screenFactIds,
    `${path}.screenFactIds`,
    errors,
    screenFactIds,
  );
}

function validateVisible(
  visible: unknown,
  kind: unknown,
  errors: string[],
  screenFactIds: ReadonlySet<string>,
): void {
  if (!isRecord(visible)) {
    errors.push("evidence.visible must be a plain object");
    return;
  }
  const kindKeys =
    kind === "upgrade"
      ? ["upgradeCost"]
      : kind === "refresh"
        ? ["refreshCurrency", "refreshCost"]
        : kind === "freeze"
          ? ["currentlyFrozen"]
          : [];
  unexpectedKeys(
    visible,
    [...COMMON_VISIBLE_KEYS, ...kindKeys],
    "evidence.visible",
    errors,
  );
  const integerFields: ReadonlyArray<
    readonly [string, number, number]
  > = [
    ["round", 0, Number.POSITIVE_INFINITY],
    ["tavernTier", 1, 7],
    ["health", 0, Number.POSITIVE_INFINITY],
    ["armor", 0, Number.POSITIVE_INFINITY],
    ["gold", 0, Number.POSITIVE_INFINITY],
    ["boardSize", 0, 7],
    ["handSize", 0, 10],
    ["upgradeCost", 0, Number.POSITIVE_INFINITY],
    ["refreshCost", 0, Number.POSITIVE_INFINITY],
  ];
  for (const [key, minimum, maximum] of integerFields) {
    if (visible[key] === undefined) continue;
    validateObservedValue(
      visible[key],
      `evidence.visible.${key}`,
      errors,
      screenFactIds,
      (item) => isIntegerInRange(item, minimum, maximum),
    );
  }
  if (visible.refreshCurrency !== undefined) {
    validateObservedValue(
      visible.refreshCurrency,
      "evidence.visible.refreshCurrency",
      errors,
      screenFactIds,
      (item) => item === "gold" || item === "health",
    );
  }
  if (visible.currentlyFrozen !== undefined) {
    validateObservedValue(
      visible.currentlyFrozen,
      "evidence.visible.currentlyFrozen",
      errors,
      screenFactIds,
      (item) => typeof item === "boolean",
    );
  }
}

export function validateAiResidualVideoEvidence(
  expertSampleInput: AiExpertDecisionSample,
  evidenceInput: unknown,
): AiResidualVideoEvidenceValidationResult {
  const errors: string[] = [];
  let expertSample: AiExpertDecisionSample;
  let evidence: unknown;
  try {
    expertSample = strictDataSnapshot(
      expertSampleInput,
      "expertSample",
    ) as AiExpertDecisionSample;
    evidence = strictDataSnapshot(evidenceInput, "evidence");
  } catch (error) {
    return {
      valid: false,
      errors: Object.freeze([
        error instanceof Error ? error.message : String(error),
      ]),
    };
  }
  try {
    assertValidAiExpertDecisionSample(expertSample);
  } catch (error) {
    errors.push(
      `expertSample is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { valid: false, errors: Object.freeze(errors) };
  }
  if (
    expertSample.labelConfidence.level !== "high" ||
    expertSample.labelConfidence.score < AI_RESIDUAL_VIDEO_MIN_CONFIDENCE
  ) {
    errors.push("expertSample label confidence must be high and at least 0.90");
  }
  if (!isRecord(evidence)) {
    return {
      valid: false,
      errors: Object.freeze(["evidence must be a plain object"]),
    };
  }
  requireExactKeys(evidence, EVIDENCE_KEYS, "evidence", errors);
  if (evidence.schemaVersion !== AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION) {
    errors.push("evidence.schemaVersion is unsupported");
  }
  if (
    typeof evidence.expertSampleHash !== "string" ||
    !SHA256_PATTERN.test(evidence.expertSampleHash) ||
    evidence.expertSampleHash !== expertSample.canonicalHash
  ) {
    errors.push("evidence.expertSampleHash does not match the expert sample");
  }
  if (
    evidence.kind !== "upgrade" &&
    evidence.kind !== "refresh" &&
    evidence.kind !== "freeze"
  ) {
    errors.push("evidence.kind is invalid");
  }
  if (!choiceIsValid(evidence.kind, evidence.choice)) {
    errors.push("evidence.choice is invalid for its kind");
  }
  const factsById = new Map(expertSample.screenFacts.map((fact) => [fact.id, fact]));
  const screenFactIds = new Set(factsById.keys());
  const legalIds = validateStringArray(
    evidence.legalChoiceFactIds,
    "evidence.legalChoiceFactIds",
    errors,
    screenFactIds,
  );
  if (typeof evidence.choiceEvidenceId !== "string") {
    errors.push("evidence.choiceEvidenceId must be a string");
  } else {
    const fact = factsById.get(evidence.choiceEvidenceId);
    const inference = expertSample.engineeringInferences.find(
      (item) => item.id === evidence.choiceEvidenceId,
    );
    if (fact !== undefined) {
      if (fact.evidenceType !== "visibleAction") {
        errors.push("choice screen fact must be visibleAction evidence");
      }
    } else if (inference !== undefined) {
      if (!legalIds.every((id) => inference.basedOnFactIds.includes(id))) {
        errors.push("choice inference must reference every legal-choice fact");
      }
      if (inference.confidence < AI_RESIDUAL_VIDEO_MIN_CONFIDENCE) {
        errors.push("choice inference confidence must be at least 0.90");
      }
    } else {
      errors.push("evidence.choiceEvidenceId does not reference sample evidence");
    }
  }
  validateVisible(evidence.visible, evidence.kind, errors, screenFactIds);
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

export function assertValidAiResidualVideoEvidence(
  expertSample: AiExpertDecisionSample,
  evidence: unknown,
): asserts evidence is AiResidualVideoEvidence {
  const validation = validateAiResidualVideoEvidence(expertSample, evidence);
  if (!validation.valid) {
    throw new TypeError(validation.errors.join("; "));
  }
}

function validatedCompatibilitySnapshot(
  expertSample: AiExpertDecisionSample,
  value: unknown,
): DeepReadonly<AiResidualRuntimeCompatibility> {
  const snapshot = strictDataSnapshot(
    value,
    "runtimeCompatibility",
  );
  if (!isRecord(snapshot)) {
    throw new TypeError("runtimeCompatibility must be a plain data object");
  }
  const errors: string[] = [];
  requireExactKeys(
    snapshot,
    [
      "compatible",
      "reviewedBy",
      "reviewedMediaSha256",
      "reason",
      "sourcePatch",
      "targetContentVersion",
    ],
    "runtimeCompatibility",
    errors,
  );
  if (snapshot.compatible !== true) {
    errors.push("runtimeCompatibility.compatible must be true for training");
  }
  if (
    typeof snapshot.reviewedBy !== "string" ||
    snapshot.reviewedBy.length < 3 ||
    snapshot.reviewedBy.length > 128
  ) {
    errors.push("runtimeCompatibility.reviewedBy is invalid");
  }
  if (
    typeof snapshot.reviewedMediaSha256 !== "string" ||
    !SHA256_PATTERN.test(snapshot.reviewedMediaSha256)
  ) {
    errors.push("runtimeCompatibility.reviewedMediaSha256 is invalid");
  }
  if (
    typeof snapshot.reason !== "string" ||
    snapshot.reason.length < 10 ||
    snapshot.reason.length > 1_000
  ) {
    errors.push("runtimeCompatibility.reason is invalid");
  }
  if (
    (snapshot.sourcePatch !== "35.4.2" &&
      snapshot.sourcePatch !== "36.0" &&
      snapshot.sourcePatch !== "36.0.3") ||
    snapshot.sourcePatch !== expertSample.patchVersion
  ) {
    errors.push("runtimeCompatibility.sourcePatch is unsupported or does not match expertSample.patchVersion");
  }
  if (
    snapshot.targetContentVersion !== CURRENT_ROSTER_VERSION ||
    expertSample.contentVersion !== CURRENT_ROSTER_VERSION ||
    snapshot.targetContentVersion !== expertSample.contentVersion
  ) {
    errors.push("runtimeCompatibility target must match the current reviewed runtime content");
  }
  if (errors.length > 0) throw new TypeError(errors.join("; "));
  return deepFreeze(snapshot) as DeepReadonly<AiResidualRuntimeCompatibility>;
}

function observedValue<Value>(
  observed: AiResidualObservedValue<Value> | undefined,
): Value | undefined {
  return observed?.value;
}

function commonProjection(visible: AiResidualVideoVisibleCommon) {
  return {
    round: observedValue(visible.round),
    tavernTier: observedValue(visible.tavernTier),
    health: observedValue(visible.health),
    armor: observedValue(visible.armor),
    gold: observedValue(visible.gold),
    boardSize: observedValue(visible.boardSize),
    handSize: observedValue(visible.handSize),
  };
}

function semanticRecordFromEvidence(
  evidence: AiResidualVideoEvidence,
): DeepReadonly<AiResidualSemanticRecord> {
  switch (evidence.kind) {
    case "upgrade":
      return createProfileNeutralAiResidualSemanticRecord({
        kind: "upgrade",
        common: commonProjection(evidence.visible),
        upgradeCost: observedValue(evidence.visible.upgradeCost),
      });
    case "refresh":
      return createProfileNeutralAiResidualSemanticRecord({
        kind: "refresh",
        common: commonProjection(evidence.visible),
        refreshCurrency: observedValue(evidence.visible.refreshCurrency),
        refreshCost: observedValue(evidence.visible.refreshCost),
      });
    case "freeze":
      return createProfileNeutralAiResidualSemanticRecord({
        kind: "freeze",
        common: commonProjection(evidence.visible),
        currentlyFrozen: observedValue(evidence.visible.currentlyFrozen),
      });
  }
}

function canonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiExpertSampleJson(value))
    .digest("hex");
}

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (value === null || typeof value !== "object") {
    return value as DeepReadonly<Value>;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<Value>;
}

export function createAiResidualVideoExample(input: {
  readonly expertSample: AiExpertDecisionSample;
  readonly evidence: AiResidualVideoEvidence;
  readonly runtimeCompatibility: AiResidualRuntimeCompatibility;
  readonly baselineChoice?:
    | AiUpgradeMacroChoice
    | AiRefreshMacroChoice
    | AiFreezeMacroChoice;
  readonly baselinePolicyVersion?: typeof AI_POLICY_VERSION;
  readonly baselineReplayHash?: string;
}): DeepReadonly<AiResidualVideoTrainingExample> {
  const inputSnapshot = strictDataSnapshot(
    input,
    "videoExampleInput",
  ) as typeof input;
  input = inputSnapshot;
  const expertSample = strictDataSnapshot(
    input.expertSample,
    "expertSample",
  ) as AiExpertDecisionSample;
  const evidence = strictDataSnapshot(
    input.evidence,
    "evidence",
  ) as AiResidualVideoEvidence;
  assertValidAiResidualVideoEvidence(expertSample, evidence);
  const runtimeCompatibility = validatedCompatibilitySnapshot(
    expertSample,
    input.runtimeCompatibility,
  );
  const hasBaselineChoice = input.baselineChoice !== undefined;
  const hasBaselinePolicyVersion = input.baselinePolicyVersion !== undefined;
  const hasBaselineReplayHash = input.baselineReplayHash !== undefined;
  if (
    hasBaselineChoice !== hasBaselinePolicyVersion ||
    hasBaselineChoice !== hasBaselineReplayHash
  ) {
    throw new TypeError(
      "baselineChoice, baselinePolicyVersion, and baselineReplayHash must be supplied together",
    );
  }
  if (
    hasBaselineChoice &&
    (input.baselinePolicyVersion !== AI_POLICY_VERSION ||
      typeof input.baselineReplayHash !== "string" ||
      !SHA256_PATTERN.test(input.baselineReplayHash) ||
      input.baselineReplayHash === expertSample.canonicalHash ||
      input.baselineReplayHash === canonicalHash(evidence) ||
      (evidence.kind === "upgrade"
        ? input.baselineChoice !== "upgradeNow" &&
          input.baselineChoice !== "deferUpgrade"
        : evidence.kind === "refresh"
          ? input.baselineChoice !== "refreshOnce" &&
            input.baselineChoice !== "stopRefreshing"
          : input.baselineChoice !== "freeze" &&
            input.baselineChoice !== "unfreeze"))
  ) {
    throw new TypeError("baseline comparison is incompatible with the video example");
  }
  const semanticRecord = semanticRecordFromEvidence(evidence);
  const unsigned = {
    schemaVersion: AI_RESIDUAL_VIDEO_EXAMPLE_SCHEMA_VERSION,
    source: "video" as const,
    exampleId: `video:${expertSample.sampleId}:${evidence.kind}`,
    expertSampleHash: expertSample.canonicalHash,
    evidenceHash: canonicalHash(evidence),
    compatibilityHash: canonicalHash(runtimeCompatibility),
    expertSample: deepFreeze(expertSample),
    evidence: deepFreeze(evidence),
    runtimeCompatibility,
    bvid: expertSample.source.bvid,
    timestampMs: expertSample.source.timestampMs,
    contentVersion: expertSample.contentVersion,
    patchVersion: expertSample.patchVersion,
    kind: evidence.kind,
    choice: evidence.choice,
    baselineChoice: input.baselineChoice ?? null,
    baselinePolicyVersion: input.baselinePolicyVersion ?? null,
    baselineReplayHash: input.baselineReplayHash ?? null,
    weight: AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT,
    semanticRecord,
  };
  return deepFreeze({
    ...unsigned,
    canonicalHash: canonicalHash(unsigned),
  }) as DeepReadonly<AiResidualVideoTrainingExample>;
}

export function validateAiResidualVideoTrainingExample(
  value: unknown,
): AiResidualVideoTrainingExampleValidationResult {
  const errors: string[] = [];
  let snapshot: JsonRecord;
  try {
    const strictSnapshot = strictDataSnapshot(value, "videoExample");
    if (!isRecord(strictSnapshot)) {
      throw new TypeError("videoExample must be a plain data object");
    }
    snapshot = strictSnapshot;
  } catch (error) {
    return {
      valid: false,
      errors: Object.freeze([
        error instanceof Error ? error.message : String(error),
      ]),
    };
  }
  requireExactKeys(snapshot, VIDEO_EXAMPLE_KEYS, "videoExample", errors);
  if (snapshot.schemaVersion !== AI_RESIDUAL_VIDEO_EXAMPLE_SCHEMA_VERSION) {
    errors.push("videoExample.schemaVersion is unsupported");
  }
  if (snapshot.source !== "video") errors.push("videoExample.source must be video");
  if (snapshot.weight !== AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT) {
    errors.push("videoExample.weight must be 8");
  }
  if (
    typeof snapshot.canonicalHash !== "string" ||
    !SHA256_PATTERN.test(snapshot.canonicalHash)
  ) {
    errors.push("videoExample.canonicalHash is invalid");
  }
  if (
    typeof snapshot.evidenceHash !== "string" ||
    !SHA256_PATTERN.test(snapshot.evidenceHash)
  ) {
    errors.push("videoExample.evidenceHash is invalid");
  }
  if (
    typeof snapshot.compatibilityHash !== "string" ||
    !SHA256_PATTERN.test(snapshot.compatibilityHash)
  ) {
    errors.push("videoExample.compatibilityHash is invalid");
  }

  const expertSample = snapshot.expertSample as AiExpertDecisionSample;
  const evidence = snapshot.evidence as AiResidualVideoEvidence;
  const evidenceValidation = validateAiResidualVideoEvidence(
    expertSample,
    evidence,
  );
  errors.push(...evidenceValidation.errors);
  try {
    validatedCompatibilitySnapshot(
      expertSample,
      snapshot.runtimeCompatibility,
    );
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  try {
    if (canonicalHash(evidence) !== snapshot.evidenceHash) {
      errors.push("videoExample.evidenceHash does not match evidence");
    }
    if (canonicalHash(snapshot.runtimeCompatibility) !== snapshot.compatibilityHash) {
      errors.push("videoExample.compatibilityHash does not match compatibility review");
    }
    if (
      canonicalAiExpertSampleJson(
        semanticRecordFromEvidence(evidence),
      ) !== canonicalAiExpertSampleJson(snapshot.semanticRecord)
    ) {
      errors.push("videoExample.semanticRecord is not the strict visible evidence projection");
    }
    const unsigned = { ...snapshot };
    delete unsigned.canonicalHash;
    if (canonicalHash(unsigned) !== snapshot.canonicalHash) {
      errors.push("videoExample.canonicalHash does not match payload");
    }
  } catch (error) {
    errors.push(
      `videoExample canonical validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (
    !isRecord(snapshot.expertSample) ||
    !isRecord(snapshot.evidence) ||
    !isRecord(snapshot.runtimeCompatibility)
  ) {
    errors.push("videoExample replay inputs are invalid");
  } else {
    if (snapshot.expertSampleHash !== expertSample.canonicalHash) {
      errors.push("videoExample.expertSampleHash mismatch");
    }
    if (snapshot.expertSampleHash !== evidence.expertSampleHash) {
      errors.push("videoExample evidence is not bound to expert sample");
    }
    if (
      typeof snapshot.baselineReplayHash === "string" &&
      (snapshot.baselineReplayHash === snapshot.expertSampleHash ||
        snapshot.baselineReplayHash === snapshot.evidenceHash ||
        snapshot.baselineReplayHash === snapshot.compatibilityHash)
    ) {
      errors.push("videoExample baseline replay must be independent evidence");
    }
    if (
      snapshot.exampleId !==
      `video:${expertSample.sampleId}:${evidence.kind}`
    ) {
      errors.push("videoExample.exampleId mismatch");
    }
    if (
      snapshot.bvid !== expertSample.source.bvid ||
      snapshot.timestampMs !== expertSample.source.timestampMs ||
      snapshot.contentVersion !== expertSample.contentVersion ||
      snapshot.patchVersion !== expertSample.patchVersion ||
      snapshot.kind !== evidence.kind ||
      snapshot.choice !== evidence.choice ||
      ((snapshot.baselineChoice === null ||
        snapshot.baselinePolicyVersion === null ||
        snapshot.baselineReplayHash === null)
        ? snapshot.baselineChoice !== null ||
          snapshot.baselinePolicyVersion !== null ||
          snapshot.baselineReplayHash !== null
        : snapshot.baselinePolicyVersion !== AI_POLICY_VERSION ||
          typeof snapshot.baselineReplayHash !== "string" ||
          !SHA256_PATTERN.test(snapshot.baselineReplayHash) ||
          (snapshot.kind === "upgrade"
            ? snapshot.baselineChoice !== "upgradeNow" &&
              snapshot.baselineChoice !== "deferUpgrade"
            : snapshot.kind === "refresh"
              ? snapshot.baselineChoice !== "refreshOnce" &&
                snapshot.baselineChoice !== "stopRefreshing"
              : snapshot.baselineChoice !== "freeze" &&
                snapshot.baselineChoice !== "unfreeze"))
    ) {
      errors.push("videoExample replay metadata mismatch");
    }
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

export function assertValidAiResidualVideoTrainingExample(
  value: unknown,
): asserts value is AiResidualVideoTrainingExample {
  const validation = validateAiResidualVideoTrainingExample(value);
  if (!validation.valid) throw new TypeError(validation.errors.join("; "));
}
