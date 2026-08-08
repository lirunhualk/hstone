import { createHash } from "node:crypto";

import {
  AI_POLICY_VERSION,
  AI_STRATEGY_PROFILES,
} from "../lib/game/ai.ts";
import {
  AI_RESIDUAL_FEATURE_SCHEMA,
  AI_RESIDUAL_FEATURE_SCHEMA_HASH,
  AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
  createFullAiResidualSemanticRecord,
  encodeAiResidualSemanticRecord,
  type AiResidualSemanticRecord,
} from "../lib/game/ai-residual-features.ts";
import {
  AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD,
  AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION,
  AI_RESIDUAL_LOGISTIC_SCORER_VERSION,
  AI_RESIDUAL_STRATEGY_PROFILE_HASH,
  computeAiResidualLogisticRuntimePayloadHash,
  validateAiResidualLogisticRuntimeArtifact,
  type AiResidualLogisticHeadArtifact,
  type AiResidualLogisticRuntimeArtifact,
} from "../lib/game/ai-logistic-residual-policy.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  type AiFreezeMacroChoice,
  type AiRefreshMacroChoice,
  type AiResidualMacroContext,
  type AiResidualMacroKind,
  type AiUpgradeMacroChoice,
  type DeepReadonly,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_LEGACY_EXPERT_ROLLOUT_VERSION,
  type AiLegacyExpertRolloutBundle,
} from "./ai-legacy-expert-rollout.ts";
import {
  assertValidAiPolicyArtifact,
  canonicalAiPolicyArtifactJson,
  computeAiStrategyProfileHash,
  type AiPolicyArtifact,
} from "./ai-policy-artifact.ts";
import {
  AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT,
  assertValidAiResidualVideoTrainingExample,
  type AiResidualVideoTrainingExample,
} from "./ai-residual-video-evidence.ts";
import { getAiVideoCorpusSource } from "./ai-video-corpus-sources.ts";

export const AI_RESIDUAL_LOGISTIC_TRAINING_VERSION = 2 as const;
export const AI_RESIDUAL_LEGACY_SAMPLE_WEIGHT = 1 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_FOLDS = 3 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_LABEL_EXAMPLES = 10 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_LABEL_BVIDS = 3 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES = 1 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_RECALL = 0.6 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_BALANCED_ACCURACY_LIFT = 0.05 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_COVERAGE = 0.5 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_COVERED_ACCURACY = 0.75 as const;
export const AI_RESIDUAL_LOGISTIC_MIN_PAIRED_ACCURACY_LIFT = 0.01 as const;
export const AI_RESIDUAL_LOGISTIC_SPLIT_VERSION = 1 as const;

export {
  AI_RESIDUAL_FEATURE_SCHEMA_HASH,
  AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD,
  AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION,
  AI_RESIDUAL_LOGISTIC_SCORER_VERSION,
};
export type {
  AiResidualLogisticHeadArtifact,
  AiResidualLogisticRuntimeArtifact,
} from "../lib/game/ai-logistic-residual-policy.ts";

export interface AiResidualLegacyTrainingExample {
  readonly schemaVersion: 1;
  readonly source: "legacy";
  readonly exampleId: string;
  readonly canonicalHash: string;
  readonly bundleSha256: string;
  readonly sampleIndex: number;
  readonly contentVersion: string;
  readonly policyVersion: string;
  readonly kind: AiResidualMacroKind;
  readonly choice:
    | AiUpgradeMacroChoice
    | AiRefreshMacroChoice
    | AiFreezeMacroChoice;
  readonly weight: typeof AI_RESIDUAL_LEGACY_SAMPLE_WEIGHT;
  readonly semanticRecord: DeepReadonly<AiResidualSemanticRecord>;
}

export type AiResidualTrainingExample =
  | AiResidualVideoTrainingExample
  | AiResidualLegacyTrainingExample;

export interface AiResidualDatasetSplitAssignment {
  readonly bvid: string;
  readonly reviewedMediaSha256: string;
  readonly foldIndex: number;
}

export interface AiResidualDatasetFold {
  readonly foldIndex: number;
  readonly foldHash: string;
  readonly training: readonly DeepReadonly<AiResidualTrainingExample>[];
  readonly holdout: readonly DeepReadonly<AiResidualVideoTrainingExample>[];
  readonly trainingBvids: readonly string[];
  readonly holdoutBvids: readonly string[];
  readonly trainingMediaSha256s: readonly string[];
  readonly holdoutMediaSha256s: readonly string[];
}

export interface AiResidualDatasetSplit {
  readonly datasetHash: string;
  readonly splitHash: string;
  readonly splitVersion: typeof AI_RESIDUAL_LOGISTIC_SPLIT_VERSION;
  readonly splitAssignmentsHash: string;
  readonly splitAssignments: readonly AiResidualDatasetSplitAssignment[];
  readonly foldCount: typeof AI_RESIDUAL_LOGISTIC_MIN_FOLDS;
  readonly examples: readonly DeepReadonly<AiResidualTrainingExample>[];
  readonly folds: readonly DeepReadonly<AiResidualDatasetFold>[];
}

export interface AiResidualLogisticTrainingConfig {
  readonly epochs: number;
  readonly learningRate: number;
  readonly learningRateDecay: number;
  readonly l2: number;
}

export interface AiResidualLogisticHeadMetrics {
  readonly examples: number;
  readonly totalWeight: number;
  readonly logLoss: number | null;
  readonly accuracy: number | null;
  readonly truePositive: number;
  readonly trueNegative: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly covered: number;
  readonly coverage: number | null;
  readonly coveredAccuracy: number | null;
  readonly positiveRecall: number | null;
  readonly negativeRecall: number | null;
  readonly balancedAccuracy: number | null;
  readonly majorityBaselineBalancedAccuracy: number | null;
  readonly highConfidenceCoverage: number | null;
  readonly highConfidenceAccuracy: number | null;
  readonly baselineExamples: number;
  readonly baselineCorrect: number;
  readonly policyWithFallbackCorrect: number;
  readonly baselineAccuracy: number | null;
  readonly policyWithFallbackAccuracy: number | null;
  readonly pairedAccuracyLift: number | null;
}

export interface AiResidualLogisticEvaluation {
  readonly upgrade: AiResidualLogisticHeadMetrics;
  readonly refresh: AiResidualLogisticHeadMetrics;
  readonly freeze: AiResidualLogisticHeadMetrics;
}

export interface AiResidualLogisticFoldEvaluation {
  readonly foldIndex: number;
  readonly holdoutBvidHash: string;
  readonly holdoutMediaSha256Hash: string;
  readonly labelBvidCounts: Readonly<
    Record<
      AiResidualMacroKind,
      Readonly<{ positive: number; negative: number }>
    >
  >;
  readonly metrics: AiResidualLogisticEvaluation;
}

export interface AiResidualLogisticPromotionHeadGate {
  readonly positiveRecall: number;
  readonly negativeRecall: number;
  readonly balancedAccuracy: number;
  readonly majorityBaselineBalancedAccuracy: number;
  readonly balancedAccuracyLift: number;
  readonly coverage: number;
  readonly coveredAccuracy: number | null;
  readonly qualityPassed: boolean;
  readonly baselineExamples: number;
  readonly pairedBaselineComplete: boolean;
  readonly baselineAccuracy: number | null;
  readonly policyWithFallbackAccuracy: number | null;
  readonly pairedAccuracyLift: number | null;
  readonly passed: boolean;
}

export interface AiResidualLogisticPromotionGate {
  readonly minimumRecall: typeof AI_RESIDUAL_LOGISTIC_MIN_RECALL;
  readonly minimumBalancedAccuracyLift: typeof AI_RESIDUAL_LOGISTIC_MIN_BALANCED_ACCURACY_LIFT;
  readonly minimumCoverage: typeof AI_RESIDUAL_LOGISTIC_MIN_COVERAGE;
  readonly minimumCoveredAccuracy: typeof AI_RESIDUAL_LOGISTIC_MIN_COVERED_ACCURACY;
  readonly minimumPairedAccuracyLift: typeof AI_RESIDUAL_LOGISTIC_MIN_PAIRED_ACCURACY_LIFT;
  readonly foldCount: number;
  readonly passed: boolean;
  readonly heads: Readonly<
    Record<AiResidualMacroKind, AiResidualLogisticPromotionHeadGate>
  >;
}

export interface AiResidualLogisticModelArtifact
  extends AiResidualLogisticRuntimeArtifact {
  readonly artifactHash: string;
  readonly trainingVersion: typeof AI_RESIDUAL_LOGISTIC_TRAINING_VERSION;
  readonly basePolicyArtifactHash: string | null;
  readonly videoContentVersions: readonly string[];
  readonly videoEvidenceSetHash: string;
  readonly datasetHash: string;
  readonly splitHash: string;
  readonly splitVersion: typeof AI_RESIDUAL_LOGISTIC_SPLIT_VERSION;
  readonly splitAssignmentsHash: string;
  readonly splitAssignments: readonly AiResidualDatasetSplitAssignment[];
  readonly foldCount: typeof AI_RESIDUAL_LOGISTIC_MIN_FOLDS;
  readonly sourceWeights: {
    readonly video: typeof AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT;
  };
  readonly trainingConfig: AiResidualLogisticTrainingConfig;
  readonly trainingMetrics: AiResidualLogisticEvaluation;
  readonly holdoutMetrics: AiResidualLogisticEvaluation;
  readonly foldMetrics: readonly AiResidualLogisticFoldEvaluation[];
  readonly promotionGate: AiResidualLogisticPromotionGate;
}

export interface AiResidualLogisticTrainingResult {
  readonly artifact: DeepReadonly<AiResidualLogisticModelArtifact>;
  readonly split: DeepReadonly<AiResidualDatasetSplit>;
}

export interface AiResidualLogisticArtifactValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const DEFAULT_TRAINING_CONFIG: AiResidualLogisticTrainingConfig = Object.freeze({
  epochs: 1_500,
  learningRate: 0.2,
  learningRateDecay: 0.002,
  l2: 0.01,
});
const FIXED_FOLD_COUNT = AI_RESIDUAL_LOGISTIC_MIN_FOLDS;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const MODEL_VERSION_PATTERN = /^[a-z0-9][a-z0-9._:+-]{0,127}$/;

function canonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiPolicyArtifactJson(value))
    .digest("hex");
}

const computedFeatureSchemaHash = canonicalHash(AI_RESIDUAL_FEATURE_SCHEMA);
if (computedFeatureSchemaHash !== AI_RESIDUAL_FEATURE_SCHEMA_HASH) {
  throw new Error(
    `AI residual feature schema hash drift: ${computedFeatureSchemaHash}`,
  );
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

function cloneJson<Value>(value: Value): Value {
  canonicalAiPolicyArtifactJson(value);
  return JSON.parse(JSON.stringify(value)) as Value;
}

function rounded(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError("model values must be finite");
  const result = Number(value.toFixed(12));
  return Object.is(result, -0) ? 0 : result;
}

function positiveChoice(kind: AiResidualMacroKind): string {
  switch (kind) {
    case "upgrade": return "upgradeNow";
    case "refresh": return "refreshOnce";
    case "freeze": return "freeze";
  }
}

function negativeChoice(kind: AiResidualMacroKind): string {
  switch (kind) {
    case "upgrade": return "deferUpgrade";
    case "refresh": return "stopRefreshing";
    case "freeze": return "unfreeze";
  }
}

function choiceMatchesKind(
  kind: AiResidualMacroKind,
  choice: string,
): boolean {
  return choice === positiveChoice(kind) || choice === negativeChoice(kind);
}

function legacyBundleUnsigned(bundle: AiLegacyExpertRolloutBundle): unknown {
  const payload = cloneJson(bundle) as unknown as Record<string, unknown>;
  delete payload.bundleSha256;
  return payload;
}

export function createAiResidualLegacyExample(input: {
  readonly context: AiResidualMacroContext;
  readonly bundleSha256: string;
  readonly sampleIndex: number;
}): DeepReadonly<AiResidualLegacyTrainingExample> {
  if (!SHA256_PATTERN.test(input.bundleSha256)) {
    throw new TypeError("bundleSha256 must be a SHA-256 hash");
  }
  if (!Number.isSafeInteger(input.sampleIndex) || input.sampleIndex < 0) {
    throw new TypeError("sampleIndex must be a non-negative safe integer");
  }
  const semanticRecord = createFullAiResidualSemanticRecord(input.context);
  const unsigned = {
    schemaVersion: 1 as const,
    source: "legacy" as const,
    exampleId: `legacy:${input.bundleSha256}:${input.sampleIndex}`,
    bundleSha256: input.bundleSha256,
    sampleIndex: input.sampleIndex,
    contentVersion: input.context.contentVersion,
    policyVersion: input.context.policyVersion,
    kind: input.context.kind,
    choice: input.context.legacyChoice,
    weight: AI_RESIDUAL_LEGACY_SAMPLE_WEIGHT,
    semanticRecord,
  };
  return deepFreeze({
    ...unsigned,
    canonicalHash: canonicalHash(unsigned),
  });
}

export function createAiResidualLegacyExamples(
  bundle: AiLegacyExpertRolloutBundle,
): readonly DeepReadonly<AiResidualLegacyTrainingExample>[] {
  if (
    bundle.schemaVersion !== AI_LEGACY_EXPERT_ROLLOUT_VERSION ||
    bundle.contextVersion !== AI_RESIDUAL_CONTEXT_VERSION ||
    !SHA256_PATTERN.test(bundle.bundleSha256) ||
    canonicalHash(legacyBundleUnsigned(bundle)) !== bundle.bundleSha256
  ) {
    throw new TypeError("invalid legacy expert rollout bundle");
  }
  return Object.freeze(
    bundle.samples.map((context, sampleIndex) =>
      createAiResidualLegacyExample({
        context,
        bundleSha256: bundle.bundleSha256,
        sampleIndex,
      }),
    ),
  );
}

function validateExample(example: AiResidualTrainingExample): void {
  const runtimeSource = (example as { readonly source?: unknown }).source;
  if (runtimeSource === "video") {
    assertValidAiResidualVideoTrainingExample(example);
    const registeredSource = getAiVideoCorpusSource(example.bvid);
    if (
      registeredSource === null ||
      !registeredSource.runtimeCompatible ||
      registeredSource.reviewedMediaSha256 !==
        example.runtimeCompatibility.reviewedMediaSha256 ||
      registeredSource.sourcePatch !== example.patchVersion ||
      registeredSource.sourcePatch !== example.runtimeCompatibility.sourcePatch ||
      registeredSource.targetContentVersion !== example.contentVersion ||
      registeredSource.targetContentVersion !==
        example.runtimeCompatibility.targetContentVersion
    ) {
      throw new TypeError(
        `video example does not match the BVID/media registry: ${example.exampleId}`,
      );
    }
    return;
  }
  if (runtimeSource !== "legacy") {
    throw new TypeError("invalid training example source");
  }
  if (
    typeof example.exampleId !== "string" ||
    example.exampleId.length === 0 ||
    typeof example.canonicalHash !== "string" ||
    !SHA256_PATTERN.test(example.canonicalHash)
  ) {
    throw new TypeError(`invalid example hash: ${example.exampleId}`);
  }
  const unsigned = cloneJson(example) as unknown as Record<string, unknown>;
  delete unsigned.canonicalHash;
  if (canonicalHash(unsigned) !== example.canonicalHash) {
    throw new TypeError(`example hash mismatch: ${example.exampleId}`);
  }
  if (
    example.semanticRecord.schemaVersion !== AI_RESIDUAL_FEATURE_SCHEMA_VERSION ||
    example.semanticRecord.contextVersion !== AI_RESIDUAL_CONTEXT_VERSION ||
    example.semanticRecord.kind !== example.kind ||
    !choiceMatchesKind(example.kind, example.choice)
  ) {
    throw new TypeError(`example kind/choice mismatch: ${example.exampleId}`);
  }
  encodeAiResidualSemanticRecord(example.semanticRecord);
  const runtimeWeight = (example as { readonly weight: number }).weight;
  if (
    (example.source === "video" && runtimeWeight !== AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT) ||
    (example.source === "legacy" && runtimeWeight !== AI_RESIDUAL_LEGACY_SAMPLE_WEIGHT)
  ) {
    throw new TypeError(`invalid source weight: ${example.exampleId}`);
  }
  if (example.source === "legacy") {
    if (
      !SHA256_PATTERN.test(example.bundleSha256) ||
      !Number.isSafeInteger(example.sampleIndex) ||
      example.sampleIndex < 0 ||
      typeof example.contentVersion !== "string" ||
      example.contentVersion.length === 0 ||
      typeof example.policyVersion !== "string" ||
      example.policyVersion.length === 0
    ) {
      throw new TypeError(`invalid legacy provenance: ${example.exampleId}`);
    }
  }
}

function sortedExamples(
  examples: readonly AiResidualTrainingExample[],
): AiResidualTrainingExample[] {
  const result = [...examples];
  result.forEach(validateExample);
  if (result.some((example) => example.source === "legacy")) {
    throw new TypeError(
      "legacy self-label examples are not allowed in the expert classifier",
    );
  }
  result.sort((left, right) =>
    left.canonicalHash.localeCompare(right.canonicalHash) ||
    left.exampleId.localeCompare(right.exampleId),
  );
  const ids = new Set<string>();
  const hashes = new Set<string>();
  for (const example of result) {
    if (ids.has(example.exampleId)) {
      throw new TypeError(`duplicate example id: ${example.exampleId}`);
    }
    if (hashes.has(example.canonicalHash)) {
      throw new TypeError(`duplicate example hash: ${example.canonicalHash}`);
    }
    ids.add(example.exampleId);
    hashes.add(example.canonicalHash);
  }
  return result;
}

function assertFoldCoverage(
  training: readonly AiResidualTrainingExample[],
  holdout: readonly AiResidualVideoTrainingExample[],
  foldIndex: number,
): void {
  const trainingBvids = new Set(
    training
      .filter(
        (example): example is AiResidualVideoTrainingExample =>
          example.source === "video",
      )
      .map((example) => example.bvid),
  );
  if (holdout.some((example) => trainingBvids.has(example.bvid))) {
    throw new TypeError(`fold ${foldIndex} has BVID leakage`);
  }
  const trainingMediaSha256s = new Set(
    training
      .filter(
        (example): example is AiResidualVideoTrainingExample =>
          example.source === "video",
      )
      .map((example) => example.runtimeCompatibility.reviewedMediaSha256),
  );
  if (
    holdout.some((example) =>
      trainingMediaSha256s.has(
        example.runtimeCompatibility.reviewedMediaSha256,
      ),
    )
  ) {
    throw new TypeError(`fold ${foldIndex} has reviewed media leakage`);
  }
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    const headTraining = training.filter((example) => example.kind === kind);
    for (const choice of [positiveChoice(kind), negativeChoice(kind)]) {
      const trainingVideo = headTraining.filter(
        (example) => example.source === "video" && example.choice === choice,
      );
      if (trainingVideo.length === 0) {
        throw new TypeError(
          `fold ${foldIndex} ${kind}/${choice} training requires video examples`,
        );
      }
      const holdoutLabel = holdout.filter(
        (example) => example.kind === kind && example.choice === choice,
      );
      if (holdoutLabel.length < AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES) {
        throw new TypeError(
          `fold ${foldIndex} ${kind}/${choice} requires at least ` +
          `${AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES} holdout example`,
        );
      }
    }
  }
}

function assertVideoCorpusCoverage(
  videoExamples: readonly AiResidualVideoTrainingExample[],
): void {
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    for (const choice of [positiveChoice(kind), negativeChoice(kind)]) {
      const labelExamples = videoExamples.filter(
        (example) => example.kind === kind && example.choice === choice,
      );
      if (labelExamples.length < AI_RESIDUAL_LOGISTIC_MIN_LABEL_EXAMPLES) {
        throw new TypeError(
          `video corpus ${kind}/${choice} requires at least ` +
          `${AI_RESIDUAL_LOGISTIC_MIN_LABEL_EXAMPLES} examples`,
        );
      }
      const labelBvids = new Set(labelExamples.map((example) => example.bvid));
      if (labelBvids.size < AI_RESIDUAL_LOGISTIC_MIN_LABEL_BVIDS) {
        throw new TypeError(
          `video corpus ${kind}/${choice} requires at least ` +
          `${AI_RESIDUAL_LOGISTIC_MIN_LABEL_BVIDS} distinct BVIDs`,
        );
      }
    }
  }
}

export function splitAiResidualTrainingExamples(
  examples: readonly AiResidualTrainingExample[],
): DeepReadonly<AiResidualDatasetSplit> {
  const examplesSnapshot = strictTrainingDataSnapshot(examples, "examples");
  if (!Array.isArray(examplesSnapshot)) {
    throw new TypeError("examples must be an ordinary data array");
  }
  examples = examplesSnapshot as AiResidualTrainingExample[];
  const foldCount = FIXED_FOLD_COUNT;
  const sorted = sortedExamples(examples);
  const videoGroups = new Map<string, AiResidualVideoTrainingExample[]>();
  const bvidToMediaSha256 = new Map<string, string>();
  const mediaSha256ToBvid = new Map<string, string>();
  for (const example of sorted) {
    if (example.source !== "video") continue;
    const mediaSha256 = example.runtimeCompatibility.reviewedMediaSha256;
    const priorMediaSha256 = bvidToMediaSha256.get(example.bvid);
    const priorBvid = mediaSha256ToBvid.get(mediaSha256);
    if (
      (priorMediaSha256 !== undefined && priorMediaSha256 !== mediaSha256) ||
      (priorBvid !== undefined && priorBvid !== example.bvid)
    ) {
      throw new TypeError("training corpus requires a one-to-one BVID/media SHA-256 mapping");
    }
    bvidToMediaSha256.set(example.bvid, mediaSha256);
    mediaSha256ToBvid.set(mediaSha256, example.bvid);
    const group = videoGroups.get(mediaSha256) ?? [];
    group.push(example);
    videoGroups.set(mediaSha256, group);
  }
  const videoExamples = [...videoGroups.values()].flat();
  assertVideoCorpusCoverage(videoExamples);
  if (videoGroups.size < foldCount) {
    throw new TypeError(
      `video cross-validation requires at least ${foldCount} reviewed media groups`,
    );
  }
  const rankedMediaSha256s = [...videoGroups.keys()].sort((left, right) => {
    const leftHash = canonicalHash([AI_RESIDUAL_LOGISTIC_SPLIT_VERSION, left]);
    const rightHash = canonicalHash([AI_RESIDUAL_LOGISTIC_SPLIT_VERSION, right]);
    return leftHash.localeCompare(rightHash) || left.localeCompare(right);
  });
  const splitAssignments = deepFreeze(
    rankedMediaSha256s.map((reviewedMediaSha256, index) => ({
      bvid: mediaSha256ToBvid.get(reviewedMediaSha256) as string,
      reviewedMediaSha256,
      foldIndex: index % foldCount,
    })),
  );
  const splitAssignmentsHash = canonicalHash(splitAssignments);
  const datasetHash = canonicalHash(
    sorted.map((example) => [example.exampleId, example.canonicalHash]),
  );
  const folds = Array.from({ length: foldCount }, (_unused, foldIndex) => {
    const foldAssignments = splitAssignments.filter(
      (assignment) => assignment.foldIndex === foldIndex,
    );
    const holdoutMediaSha256Set = new Set(
      foldAssignments.map((assignment) => assignment.reviewedMediaSha256),
    );
    const training = sorted.filter(
      (example) =>
        example.source === "video" &&
        !holdoutMediaSha256Set.has(
          example.runtimeCompatibility.reviewedMediaSha256,
        ),
    );
    const holdout = sorted.filter(
      (example): example is AiResidualVideoTrainingExample =>
        example.source === "video" &&
        holdoutMediaSha256Set.has(
          example.runtimeCompatibility.reviewedMediaSha256,
        ),
    );
    assertFoldCoverage(training, holdout, foldIndex);
    const trainingAssignments = splitAssignments.filter(
      (assignment) => assignment.foldIndex !== foldIndex,
    );
    const trainingBvids = trainingAssignments.map((item) => item.bvid).sort();
    const holdoutBvids = foldAssignments.map((item) => item.bvid).sort();
    const trainingMediaSha256s = trainingAssignments
      .map((item) => item.reviewedMediaSha256)
      .sort();
    const holdoutMediaSha256s = foldAssignments
      .map((item) => item.reviewedMediaSha256)
      .sort();
    return deepFreeze({
      foldIndex,
      foldHash: canonicalHash({
        datasetHash,
        splitVersion: AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
        splitAssignmentsHash,
        foldCount,
        foldIndex,
        training: training.map((example) => example.canonicalHash),
        holdout: holdout.map((example) => example.canonicalHash),
      }),
      training,
      holdout,
      trainingBvids,
      holdoutBvids,
      trainingMediaSha256s,
      holdoutMediaSha256s,
    });
  });
  const splitHash = canonicalHash({
    datasetHash,
    splitVersion: AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
    splitAssignmentsHash,
    foldCount,
  });
  return deepFreeze({
    datasetHash,
    splitHash,
    splitVersion: AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
    splitAssignmentsHash,
    splitAssignments,
    foldCount,
    examples: sorted,
    folds,
  });
}

interface NumericTrainingExample {
  readonly features: readonly number[];
  readonly label: 0 | 1;
  readonly weight: number;
}

interface MutableHead {
  intercept: number;
  coefficients: number[];
}

function stableSigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-value);
    return 1 / (1 + exp);
  }
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

function dot(coefficients: readonly number[], features: readonly number[]): number {
  let result = 0;
  for (let index = 0; index < coefficients.length; index += 1) {
    result += (coefficients[index] as number) * (features[index] as number);
  }
  return result;
}

function normalizedTrainingConfig(
  value: Partial<AiResidualLogisticTrainingConfig> | undefined,
): AiResidualLogisticTrainingConfig {
  const config = { ...DEFAULT_TRAINING_CONFIG, ...value };
  if (!Number.isSafeInteger(config.epochs) || config.epochs < 1 || config.epochs > 100_000) {
    throw new RangeError("epochs must be an integer from 1 to 100000");
  }
  for (const key of ["learningRate", "learningRateDecay", "l2"] as const) {
    if (!Number.isFinite(config[key]) || config[key] < 0) {
      throw new RangeError(`${key} must be a non-negative finite number`);
    }
  }
  if (config.learningRate === 0) throw new RangeError("learningRate must be positive");
  if (config.l2 === 0) throw new RangeError("l2 must be positive");
  return Object.freeze(config);
}

function numericExamples(
  examples: readonly AiResidualTrainingExample[],
  kind: AiResidualMacroKind,
): NumericTrainingExample[] {
  return examples
    .filter((example) => example.kind === kind)
    .map((example) => {
      const encoded = encodeAiResidualSemanticRecord(example.semanticRecord);
      return {
        features: encoded.values,
        label: example.choice === positiveChoice(kind) ? 1 : 0,
        weight: example.weight,
      };
    });
}

function trainHead(
  examples: readonly NumericTrainingExample[],
  featureCount: number,
  config: AiResidualLogisticTrainingConfig,
): MutableHead {
  const model: MutableHead = {
    intercept: 0,
    coefficients: Array(featureCount).fill(0) as number[],
  };
  const totalWeight = examples.reduce((sum, example) => sum + example.weight, 0);
  for (let epoch = 0; epoch < config.epochs; epoch += 1) {
    let interceptGradient = 0;
    const gradients = Array(featureCount).fill(0) as number[];
    for (const example of examples) {
      const probability = stableSigmoid(
        model.intercept + dot(model.coefficients, example.features),
      );
      const error = ((probability - example.label) * example.weight) / totalWeight;
      interceptGradient += error;
      for (let index = 0; index < featureCount; index += 1) {
        gradients[index] =
          (gradients[index] as number) + error * (example.features[index] as number);
      }
    }
    const learningRate =
      config.learningRate / (1 + config.learningRateDecay * epoch);
    model.intercept -= learningRate * interceptGradient;
    for (let index = 0; index < featureCount; index += 1) {
      const coefficient = model.coefficients[index] as number;
      model.coefficients[index] =
        coefficient - learningRate * ((gradients[index] as number) + config.l2 * coefficient);
    }
  }
  return {
    intercept: rounded(model.intercept),
    coefficients: model.coefficients.map(rounded),
  };
}

function featureNames(kind: AiResidualMacroKind): readonly string[] {
  return AI_RESIDUAL_FEATURE_SCHEMA.heads[kind].featureNames;
}

function predictHead(
  head: Pick<AiResidualLogisticHeadArtifact, "intercept" | "coefficients">,
  features: readonly number[],
): number {
  return stableSigmoid(head.intercept + dot(head.coefficients, features));
}

function classificationMetrics(
  truePositive: number,
  trueNegative: number,
  falsePositive: number,
  falseNegative: number,
): Pick<
  AiResidualLogisticHeadMetrics,
  | "positiveRecall"
  | "negativeRecall"
  | "balancedAccuracy"
  | "majorityBaselineBalancedAccuracy"
> {
  const positiveCount = truePositive + falseNegative;
  const negativeCount = trueNegative + falsePositive;
  const positiveRecall =
    positiveCount === 0 ? null : rounded(truePositive / positiveCount);
  const negativeRecall =
    negativeCount === 0 ? null : rounded(trueNegative / negativeCount);
  return {
    positiveRecall,
    negativeRecall,
    balancedAccuracy:
      positiveRecall === null || negativeRecall === null
        ? null
        : rounded((positiveRecall + negativeRecall) / 2),
    majorityBaselineBalancedAccuracy:
      positiveCount === 0 || negativeCount === 0 ? null : 0.5,
  };
}

function metricsFor(
  examples: readonly AiResidualTrainingExample[],
  kind: AiResidualMacroKind,
  head: AiResidualLogisticHeadArtifact,
): AiResidualLogisticHeadMetrics {
  const selected = examples.filter((example) => example.kind === kind);
  if (selected.length === 0) {
    return {
      examples: 0,
      totalWeight: 0,
      logLoss: null,
      accuracy: null,
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
      covered: 0,
      coverage: null,
      coveredAccuracy: null,
      positiveRecall: null,
      negativeRecall: null,
      balancedAccuracy: null,
      majorityBaselineBalancedAccuracy: null,
      highConfidenceCoverage: null,
      highConfidenceAccuracy: null,
      baselineExamples: 0,
      baselineCorrect: 0,
      policyWithFallbackCorrect: 0,
      baselineAccuracy: null,
      policyWithFallbackAccuracy: null,
      pairedAccuracyLift: null,
    };
  }
  let totalWeight = 0;
  let weightedLoss = 0;
  let weightedCorrect = 0;
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let covered = 0;
  let coveredCorrect = 0;
  let baselineExamples = 0;
  let baselineCorrect = 0;
  let policyWithFallbackCorrect = 0;
  for (const example of selected) {
    const features = encodeAiResidualSemanticRecord(example.semanticRecord).values;
    const probability = predictHead(head, features);
    const label = example.choice === positiveChoice(kind) ? 1 : 0;
    const predicted = probability >= 0.5 ? 1 : 0;
    const confidence = Math.max(probability, 1 - probability);
    totalWeight += example.weight;
    weightedLoss +=
      -example.weight *
      (label * Math.log(Math.max(probability, Number.EPSILON)) +
        (1 - label) * Math.log(Math.max(1 - probability, Number.EPSILON)));
    if (predicted === label) weightedCorrect += example.weight;
    if (label === 1 && predicted === 1) truePositive += 1;
    else if (label === 0 && predicted === 0) trueNegative += 1;
    else if (label === 0) falsePositive += 1;
    else falseNegative += 1;
    if (confidence >= AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD) {
      covered += 1;
      if (predicted === label) coveredCorrect += 1;
    }
    if (example.source === "video" && example.baselineChoice !== null) {
      baselineExamples += 1;
      const baselineLabel =
        example.baselineChoice === positiveChoice(kind) ? 1 : 0;
      if (baselineLabel === label) baselineCorrect += 1;
      const deployedLabel =
        confidence >= AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD
          ? predicted
          : baselineLabel;
      if (deployedLabel === label) policyWithFallbackCorrect += 1;
    }
  }
  const baselineAccuracy =
    baselineExamples === 0
      ? null
      : rounded(baselineCorrect / baselineExamples);
  const policyWithFallbackAccuracy =
    baselineExamples === 0
      ? null
      : rounded(policyWithFallbackCorrect / baselineExamples);
  return {
    examples: selected.length,
    totalWeight,
    logLoss: rounded(weightedLoss / totalWeight),
    accuracy: rounded(weightedCorrect / totalWeight),
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    covered,
    coverage: rounded(covered / selected.length),
    coveredAccuracy: covered === 0 ? null : rounded(coveredCorrect / covered),
    ...classificationMetrics(
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
    ),
    highConfidenceCoverage: rounded(covered / selected.length),
    highConfidenceAccuracy:
      covered === 0 ? null : rounded(coveredCorrect / covered),
    baselineExamples,
    baselineCorrect,
    policyWithFallbackCorrect,
    baselineAccuracy,
    policyWithFallbackAccuracy,
    pairedAccuracyLift:
      baselineAccuracy === null || policyWithFallbackAccuracy === null
        ? null
        : rounded(policyWithFallbackAccuracy - baselineAccuracy),
  };
}

function evaluate(
  examples: readonly AiResidualTrainingExample[],
  heads: AiResidualLogisticModelArtifact["heads"],
): AiResidualLogisticEvaluation {
  return {
    upgrade: metricsFor(examples, "upgrade", heads.upgrade),
    refresh: metricsFor(examples, "refresh", heads.refresh),
    freeze: metricsFor(examples, "freeze", heads.freeze),
  };
}

function aggregateHeadMetrics(
  metrics: readonly AiResidualLogisticHeadMetrics[],
): AiResidualLogisticHeadMetrics {
  const examples = metrics.reduce((sum, item) => sum + item.examples, 0);
  const totalWeight = metrics.reduce((sum, item) => sum + item.totalWeight, 0);
  const truePositive = metrics.reduce((sum, item) => sum + item.truePositive, 0);
  const trueNegative = metrics.reduce((sum, item) => sum + item.trueNegative, 0);
  const falsePositive = metrics.reduce((sum, item) => sum + item.falsePositive, 0);
  const falseNegative = metrics.reduce((sum, item) => sum + item.falseNegative, 0);
  const covered = metrics.reduce((sum, item) => sum + item.covered, 0);
  const baselineExamples = metrics.reduce(
    (sum, item) => sum + item.baselineExamples,
    0,
  );
  const baselineCorrect = metrics.reduce(
    (sum, item) => sum + item.baselineCorrect,
    0,
  );
  const policyWithFallbackCorrect = metrics.reduce(
    (sum, item) => sum + item.policyWithFallbackCorrect,
    0,
  );
  const coveredCorrect = metrics.reduce(
    (sum, item) =>
      sum + Math.round((item.coveredAccuracy ?? 0) * item.covered),
    0,
  );
  if (examples === 0 || totalWeight === 0) {
    return metricsFor([], "upgrade", {
      kind: "upgrade",
      positiveChoice: "upgradeNow",
      negativeChoice: "deferUpgrade",
      featureNames: [],
      intercept: 0,
      coefficients: [],
      trainingExamples: 0,
      holdoutExamples: 0,
    });
  }
  const weightedLoss = metrics.reduce(
    (sum, item) => sum + (item.logLoss ?? 0) * item.totalWeight,
    0,
  );
  const weightedAccuracy = metrics.reduce(
    (sum, item) => sum + (item.accuracy ?? 0) * item.totalWeight,
    0,
  );
  const coverage = rounded(covered / examples);
  const coveredAccuracy =
    covered === 0 ? null : rounded(coveredCorrect / covered);
  const baselineAccuracy =
    baselineExamples === 0
      ? null
      : rounded(baselineCorrect / baselineExamples);
  const policyWithFallbackAccuracy =
    baselineExamples === 0
      ? null
      : rounded(policyWithFallbackCorrect / baselineExamples);
  return {
    examples,
    totalWeight,
    logLoss: rounded(weightedLoss / totalWeight),
    accuracy: rounded(weightedAccuracy / totalWeight),
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    covered,
    coverage,
    coveredAccuracy,
    ...classificationMetrics(
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
    ),
    highConfidenceCoverage: coverage,
    highConfidenceAccuracy: coveredAccuracy,
    baselineExamples,
    baselineCorrect,
    policyWithFallbackCorrect,
    baselineAccuracy,
    policyWithFallbackAccuracy,
    pairedAccuracyLift:
      baselineAccuracy === null || policyWithFallbackAccuracy === null
        ? null
        : rounded(policyWithFallbackAccuracy - baselineAccuracy),
  };
}

function aggregateEvaluation(
  folds: readonly AiResidualLogisticEvaluation[],
): AiResidualLogisticEvaluation {
  return {
    upgrade: aggregateHeadMetrics(folds.map((fold) => fold.upgrade)),
    refresh: aggregateHeadMetrics(folds.map((fold) => fold.refresh)),
    freeze: aggregateHeadMetrics(folds.map((fold) => fold.freeze)),
  };
}

function promotionHeadGate(
  metrics: AiResidualLogisticHeadMetrics,
  path: string,
): AiResidualLogisticPromotionHeadGate {
  const {
    positiveRecall,
    negativeRecall,
    balancedAccuracy,
    majorityBaselineBalancedAccuracy,
    coverage,
    coveredAccuracy,
    baselineAccuracy,
    policyWithFallbackAccuracy,
    pairedAccuracyLift,
  } = metrics;
  if (
    positiveRecall === null ||
    negativeRecall === null ||
    balancedAccuracy === null ||
    majorityBaselineBalancedAccuracy === null ||
    coverage === null
  ) {
    throw new TypeError(`${path} promotion metrics are incomplete`);
  }
  const balancedAccuracyLift = rounded(
    balancedAccuracy - majorityBaselineBalancedAccuracy,
  );
  const qualityPassed =
    positiveRecall >= AI_RESIDUAL_LOGISTIC_MIN_RECALL &&
    negativeRecall >= AI_RESIDUAL_LOGISTIC_MIN_RECALL &&
    balancedAccuracyLift >=
      AI_RESIDUAL_LOGISTIC_MIN_BALANCED_ACCURACY_LIFT &&
    coverage >= AI_RESIDUAL_LOGISTIC_MIN_COVERAGE &&
    coveredAccuracy !== null &&
    coveredAccuracy >= AI_RESIDUAL_LOGISTIC_MIN_COVERED_ACCURACY;
  const pairedBaselineComplete =
    metrics.baselineExamples === metrics.examples &&
    baselineAccuracy !== null &&
    policyWithFallbackAccuracy !== null &&
    pairedAccuracyLift !== null;
  const passed =
    qualityPassed &&
    pairedBaselineComplete &&
    pairedAccuracyLift !== null &&
    pairedAccuracyLift >= AI_RESIDUAL_LOGISTIC_MIN_PAIRED_ACCURACY_LIFT;
  return {
    positiveRecall,
    negativeRecall,
    balancedAccuracy,
    majorityBaselineBalancedAccuracy,
    balancedAccuracyLift,
    coverage,
    coveredAccuracy,
    qualityPassed,
    baselineExamples: metrics.baselineExamples,
    pairedBaselineComplete,
    baselineAccuracy,
    policyWithFallbackAccuracy,
    pairedAccuracyLift,
    passed,
  };
}

function createPromotionGate(
  aggregate: AiResidualLogisticEvaluation,
  foldCount: number,
): AiResidualLogisticPromotionGate {
  const heads = {
    upgrade: promotionHeadGate(aggregate.upgrade, "aggregate upgrade"),
    refresh: promotionHeadGate(aggregate.refresh, "aggregate refresh"),
    freeze: promotionHeadGate(aggregate.freeze, "aggregate freeze"),
  };
  return {
    minimumRecall: AI_RESIDUAL_LOGISTIC_MIN_RECALL,
    minimumBalancedAccuracyLift:
      AI_RESIDUAL_LOGISTIC_MIN_BALANCED_ACCURACY_LIFT,
    minimumCoverage: AI_RESIDUAL_LOGISTIC_MIN_COVERAGE,
    minimumCoveredAccuracy: AI_RESIDUAL_LOGISTIC_MIN_COVERED_ACCURACY,
    minimumPairedAccuracyLift:
      AI_RESIDUAL_LOGISTIC_MIN_PAIRED_ACCURACY_LIFT,
    foldCount,
    passed: Object.values(heads).every((head) => head.passed),
    heads,
  };
}

function runtimeVersions(examples: readonly AiResidualTrainingExample[]): {
  contentVersion: string;
  policyVersion: string;
} {
  const video = examples.filter(
    (example): example is AiResidualVideoTrainingExample =>
      example.source === "video",
  );
  const contentVersions = new Set(video.map((example) => example.contentVersion));
  if (contentVersions.size !== 1) {
    throw new TypeError("video examples must share one runtime content version");
  }
  return {
    contentVersion: [...contentVersions][0] as string,
    policyVersion: AI_POLICY_VERSION,
  };
}

function buildHead(
  kind: AiResidualMacroKind,
  training: readonly AiResidualTrainingExample[],
  holdout: readonly AiResidualTrainingExample[],
  config: AiResidualLogisticTrainingConfig,
): AiResidualLogisticHeadArtifact {
  const names = featureNames(kind);
  const trained = trainHead(
    numericExamples(training, kind),
    names.length,
    config,
  );
  return {
    kind,
    positiveChoice: positiveChoice(kind),
    negativeChoice: negativeChoice(kind),
    featureNames: names,
    intercept: trained.intercept,
    coefficients: Object.freeze(trained.coefficients),
    trainingExamples: training.filter((example) => example.kind === kind).length,
    holdoutExamples: holdout.filter((example) => example.kind === kind).length,
  };
}

export function computeAiResidualLogisticArtifactHash(
  value:
    | AiResidualLogisticModelArtifact
    | Omit<AiResidualLogisticModelArtifact, "artifactHash">,
): string {
  const payload = cloneJson(value) as Record<string, unknown>;
  delete payload.artifactHash;
  return canonicalHash(payload);
}

export function trainAiResidualLogisticModel(input: {
  readonly examples: readonly AiResidualTrainingExample[];
  readonly modelId: string;
  readonly modelVersion: string;
  readonly trainingConfig?: Partial<AiResidualLogisticTrainingConfig>;
  readonly basePolicyArtifact?: AiPolicyArtifact;
}): DeepReadonly<AiResidualLogisticTrainingResult> {
  const inputSnapshot = strictTrainingDataSnapshot(input, "trainingInput");
  if (!isRecord(inputSnapshot)) {
    throw new TypeError("trainingInput must be a plain data object");
  }
  input = inputSnapshot as unknown as typeof input;
  if (!MODEL_ID_PATTERN.test(input.modelId)) throw new TypeError("invalid modelId");
  if (!MODEL_VERSION_PATTERN.test(input.modelVersion)) throw new TypeError("invalid modelVersion");
  const split = splitAiResidualTrainingExamples(input.examples);
  const config = normalizedTrainingConfig(input.trainingConfig);
  const finalExamples = split.examples;
  const videoExamples = finalExamples.filter(
    (example): example is AiResidualVideoTrainingExample =>
      example.source === "video",
  );
  const versions = runtimeVersions(finalExamples);
  const strategyProfileHash = computeAiStrategyProfileHash(AI_STRATEGY_PROFILES);
  if (strategyProfileHash !== AI_RESIDUAL_STRATEGY_PROFILE_HASH) {
    throw new Error("browser and offline strategy profile hashes disagree");
  }
  let basePolicyArtifactHash: string | null = null;
  if (input.basePolicyArtifact !== undefined) {
    assertValidAiPolicyArtifact(input.basePolicyArtifact);
    if (
      input.basePolicyArtifact.contentVersion !== versions.contentVersion ||
      input.basePolicyArtifact.policyVersion !== versions.policyVersion ||
      input.basePolicyArtifact.strategyProfileHash !== strategyProfileHash
    ) {
      throw new TypeError("base policy artifact is incompatible with training examples");
    }
    basePolicyArtifactHash = input.basePolicyArtifact.artifactHash;
  }
  const foldMetrics = deepFreeze(
    split.folds.map((fold) => {
      const foldHeads = deepFreeze({
        upgrade: buildHead("upgrade", fold.training, fold.holdout, config),
        refresh: buildHead("refresh", fold.training, fold.holdout, config),
        freeze: buildHead("freeze", fold.training, fold.holdout, config),
      });
      return {
        foldIndex: fold.foldIndex,
        holdoutBvidHash: canonicalHash(fold.holdoutBvids),
        holdoutMediaSha256Hash: canonicalHash(fold.holdoutMediaSha256s),
        labelBvidCounts: Object.fromEntries(
          (["upgrade", "refresh", "freeze"] as const).map((kind) => [
            kind,
            {
              positive: new Set(
                fold.holdout
                  .filter(
                    (example) =>
                      example.kind === kind &&
                      example.choice === positiveChoice(kind),
                  )
                  .map((example) => example.bvid),
              ).size,
              negative: new Set(
                fold.holdout
                  .filter(
                    (example) =>
                      example.kind === kind &&
                      example.choice === negativeChoice(kind),
                  )
                  .map((example) => example.bvid),
              ).size,
            },
          ]),
        ),
        metrics: evaluate(fold.holdout, foldHeads),
      };
    }),
  ) as readonly DeepReadonly<AiResidualLogisticFoldEvaluation>[];
  const holdoutMetrics = aggregateEvaluation(
    foldMetrics.map((fold) => fold.metrics),
  );
  const promotionGate = deepFreeze(
    createPromotionGate(holdoutMetrics, foldMetrics.length),
  );
  const heads = deepFreeze({
    upgrade: buildHead("upgrade", finalExamples, videoExamples, config),
    refresh: buildHead("refresh", finalExamples, videoExamples, config),
    freeze: buildHead("freeze", finalExamples, videoExamples, config),
  });
  const trainingMetrics = evaluate(finalExamples, heads);
  const runtimePayloadUnsigned = {
    schemaVersion: AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION,
    scorerVersion: AI_RESIDUAL_LOGISTIC_SCORER_VERSION,
    modelId: input.modelId,
    modelVersion: input.modelVersion,
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    featureSchemaVersion: AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
    featureSchemaHash: AI_RESIDUAL_FEATURE_SCHEMA_HASH,
    runtimeContentVersion: versions.contentVersion,
    runtimePolicyVersion: versions.policyVersion,
    strategyProfileHash,
    confidenceThreshold: AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD,
    heads,
  };
  const unsigned = {
    ...runtimePayloadUnsigned,
    runtimePayloadHash: computeAiResidualLogisticRuntimePayloadHash(
      runtimePayloadUnsigned,
    ),
    trainingVersion: AI_RESIDUAL_LOGISTIC_TRAINING_VERSION,
    basePolicyArtifactHash,
    videoContentVersions: Object.freeze(
      [...new Set(videoExamples.map((example) => example.contentVersion))].sort(),
    ),
    videoEvidenceSetHash: canonicalHash(
      videoExamples.map((example) => [
        example.bvid,
        example.expertSampleHash,
        example.evidenceHash,
        example.compatibilityHash,
      ]),
    ),
    datasetHash: split.datasetHash,
    splitHash: split.splitHash,
    splitVersion: split.splitVersion,
    splitAssignmentsHash: split.splitAssignmentsHash,
    splitAssignments: split.splitAssignments,
    foldCount: split.foldCount,
    sourceWeights: Object.freeze({
      video: AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT,
    }),
    trainingConfig: config,
    trainingMetrics,
    holdoutMetrics,
    foldMetrics,
    promotionGate,
  };
  const artifact = deepFreeze({
    ...unsigned,
    artifactHash: computeAiResidualLogisticArtifactHash(unsigned),
  }) as DeepReadonly<AiResidualLogisticModelArtifact>;
  return deepFreeze({ artifact, split });
}

function strictTrainingDataSnapshot(
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
      throw new TypeError(`${path} must contain finite numbers`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError(`${path} must contain only JSON data`);
  }
  if (ancestors.has(value)) throw new TypeError(`${path} must not contain cycles`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new TypeError(`${path} must use the ordinary array prototype`);
      }
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
      const length = lengthDescriptor?.value;
      const ownKeys = Reflect.ownKeys(value);
      if (
        !Number.isSafeInteger(length) ||
        (length as number) < 0 ||
        ownKeys.length !== (length as number) + 1 ||
        ownKeys[(length as number)] !== "length"
      ) {
        throw new TypeError(`${path} has symbol, sparse, or extra properties`);
      }
      const snapshot: unknown[] = [];
      for (let index = 0; index < (length as number); index += 1) {
        const key = String(index);
        if (ownKeys[index] !== key) {
          throw new TypeError(`${path} has symbol, sparse, or extra properties`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor?.enumerable !== true || !("value" in descriptor)) {
          throw new TypeError(`${path}[${index}] must be an enumerable data property`);
        }
        snapshot.push(
          strictTrainingDataSnapshot(
            descriptor.value,
            `${path}[${index}]`,
            ancestors,
          ),
        );
      }
      return snapshot;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${path} must use a plain object prototype`);
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new TypeError(`${path} must not contain symbol properties`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.enumerable !== true || !("value" in descriptor)) {
        throw new TypeError(`${path}.${key} must be an enumerable data property`);
      }
      Object.defineProperty(snapshot, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: strictTrainingDataSnapshot(
          descriptor.value,
          `${path}.${key}`,
          ancestors,
        ),
      });
    }
    return snapshot;
  } finally {
    ancestors.delete(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && "value" in descriptor;
  });
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value).sort();
  return JSON.stringify(keys) === JSON.stringify([...expected].sort());
}

const METRIC_KEYS = [
  "examples",
  "totalWeight",
  "logLoss",
  "accuracy",
  "truePositive",
  "trueNegative",
  "falsePositive",
  "falseNegative",
  "covered",
  "coverage",
  "coveredAccuracy",
  "positiveRecall",
  "negativeRecall",
  "balancedAccuracy",
  "majorityBaselineBalancedAccuracy",
  "highConfidenceCoverage",
  "highConfidenceAccuracy",
  "baselineExamples",
  "baselineCorrect",
  "policyWithFallbackCorrect",
  "baselineAccuracy",
  "policyWithFallbackAccuracy",
  "pairedAccuracyLift",
] as const;

function isFiniteInRange(
  value: unknown,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function validateMetrics(
  value: unknown,
  path: string,
  errors: string[],
): AiResidualLogisticHeadMetrics | null {
  if (!isRecord(value) || !exactKeys(value, METRIC_KEYS)) {
    errors.push(`${path} has missing or unknown fields`);
    return null;
  }
  const integerKeys = [
    "examples",
    "truePositive",
    "trueNegative",
    "falsePositive",
    "falseNegative",
    "covered",
    "baselineExamples",
    "baselineCorrect",
    "policyWithFallbackCorrect",
  ] as const;
  for (const key of integerKeys) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < 0) {
      errors.push(`${path}.${key} is invalid`);
    }
  }
  if (!isFiniteInRange(value.totalWeight, 0)) {
    errors.push(`${path}.totalWeight is invalid`);
  }
  if (
    value.logLoss !== null &&
    !isFiniteInRange(value.logLoss, 0)
  ) {
    errors.push(`${path}.logLoss is invalid`);
  }
  for (const key of [
    "accuracy",
    "coverage",
    "coveredAccuracy",
    "positiveRecall",
    "negativeRecall",
    "balancedAccuracy",
    "majorityBaselineBalancedAccuracy",
    "highConfidenceCoverage",
    "highConfidenceAccuracy",
    "baselineAccuracy",
    "policyWithFallbackAccuracy",
  ] as const) {
    if (value[key] !== null && !isFiniteInRange(value[key], 0, 1)) {
      errors.push(`${path}.${key} is invalid`);
    }
  }
  if (
    value.pairedAccuracyLift !== null &&
    !isFiniteInRange(value.pairedAccuracyLift, -1, 1)
  ) {
    errors.push(`${path}.pairedAccuracyLift is invalid`);
  }
  if (
    !Number.isSafeInteger(value.examples) ||
    !Number.isSafeInteger(value.truePositive) ||
    !Number.isSafeInteger(value.trueNegative) ||
    !Number.isSafeInteger(value.falsePositive) ||
    !Number.isSafeInteger(value.falseNegative) ||
    !Number.isSafeInteger(value.covered) ||
    !Number.isSafeInteger(value.baselineExamples) ||
    !Number.isSafeInteger(value.baselineCorrect) ||
    !Number.isSafeInteger(value.policyWithFallbackCorrect)
  ) {
    return null;
  }
  const examples = value.examples as number;
  const covered = value.covered as number;
  const baselineExamples = value.baselineExamples as number;
  const baselineCorrect = value.baselineCorrect as number;
  const policyWithFallbackCorrect = value.policyWithFallbackCorrect as number;
  const confusionTotal =
    (value.truePositive as number) +
    (value.trueNegative as number) +
    (value.falsePositive as number) +
    (value.falseNegative as number);
  if (confusionTotal !== examples) {
    errors.push(`${path} confusion matrix does not match examples`);
  }
  if (covered > examples) errors.push(`${path}.covered exceeds examples`);
  if (
    baselineExamples > examples ||
    baselineCorrect > baselineExamples ||
    policyWithFallbackCorrect > baselineExamples
  ) {
    errors.push(`${path} paired baseline counts are inconsistent`);
  }
  if (examples === 0) {
    if (
      value.totalWeight !== 0 ||
      value.logLoss !== null ||
      value.accuracy !== null ||
      value.coverage !== null ||
      value.coveredAccuracy !== null ||
      value.positiveRecall !== null ||
      value.negativeRecall !== null ||
      value.balancedAccuracy !== null ||
      value.majorityBaselineBalancedAccuracy !== null ||
      value.highConfidenceCoverage !== null ||
      value.highConfidenceAccuracy !== null ||
      baselineExamples !== 0 ||
      baselineCorrect !== 0 ||
      policyWithFallbackCorrect !== 0 ||
      value.baselineAccuracy !== null ||
      value.policyWithFallbackAccuracy !== null ||
      value.pairedAccuracyLift !== null
    ) {
      errors.push(`${path} empty metrics are inconsistent`);
    }
  } else {
    if (
      !isFiniteInRange(value.totalWeight, Number.EPSILON) ||
      !isFiniteInRange(value.logLoss, 0) ||
      !isFiniteInRange(value.accuracy, 0, 1) ||
      !isFiniteInRange(value.coverage, 0, 1) ||
      !isFiniteInRange(value.positiveRecall, 0, 1) ||
      !isFiniteInRange(value.negativeRecall, 0, 1) ||
      !isFiniteInRange(value.balancedAccuracy, 0, 1) ||
      !isFiniteInRange(value.majorityBaselineBalancedAccuracy, 0, 1) ||
      !isFiniteInRange(value.highConfidenceCoverage, 0, 1) ||
      (covered === 0
        ? value.coveredAccuracy !== null || value.highConfidenceAccuracy !== null
        : !isFiniteInRange(value.coveredAccuracy, 0, 1) ||
          !isFiniteInRange(value.highConfidenceAccuracy, 0, 1)) ||
      (baselineExamples === 0
        ? value.baselineAccuracy !== null ||
          value.policyWithFallbackAccuracy !== null ||
          value.pairedAccuracyLift !== null
        : !isFiniteInRange(value.baselineAccuracy, 0, 1) ||
          !isFiniteInRange(value.policyWithFallbackAccuracy, 0, 1) ||
          !isFiniteInRange(value.pairedAccuracyLift, -1, 1))
    ) {
      errors.push(`${path} non-empty metrics are inconsistent`);
    }
    const expectedClassification = classificationMetrics(
      value.truePositive as number,
      value.trueNegative as number,
      value.falsePositive as number,
      value.falseNegative as number,
    );
    if (
      value.positiveRecall !== expectedClassification.positiveRecall ||
      value.negativeRecall !== expectedClassification.negativeRecall ||
      value.balancedAccuracy !== expectedClassification.balancedAccuracy ||
      value.majorityBaselineBalancedAccuracy !==
        expectedClassification.majorityBaselineBalancedAccuracy ||
      value.coverage !== rounded(covered / examples) ||
      value.highConfidenceCoverage !== value.coverage ||
      value.highConfidenceAccuracy !== value.coveredAccuracy ||
      (baselineExamples > 0 &&
        (value.baselineAccuracy !==
          rounded(baselineCorrect / baselineExamples) ||
          value.policyWithFallbackAccuracy !==
            rounded(policyWithFallbackCorrect / baselineExamples) ||
          value.pairedAccuracyLift !==
            rounded(
              (value.policyWithFallbackAccuracy as number) -
                (value.baselineAccuracy as number),
            )))
    ) {
      errors.push(`${path} derived metrics do not match confusion data`);
    }
  }
  return value as unknown as AiResidualLogisticHeadMetrics;
}

function validateEvaluation(
  value: unknown,
  path: string,
  errors: string[],
): Partial<Record<AiResidualMacroKind, AiResidualLogisticHeadMetrics>> {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["upgrade", "refresh", "freeze"])
  ) {
    errors.push(`${path} must contain exactly three heads`);
    return {};
  }
  const result: Partial<
    Record<AiResidualMacroKind, AiResidualLogisticHeadMetrics>
  > = {};
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    const metrics = validateMetrics(value[kind], `${path}.${kind}`, errors);
    if (metrics !== null) result[kind] = metrics;
  }
  return result;
}

function validateFoldEvaluations(
  value: unknown,
  foldCount: number,
  errors: string[],
): AiResidualLogisticFoldEvaluation[] {
  if (!Array.isArray(value) || value.length !== foldCount) {
    errors.push("foldMetrics length does not match foldCount");
    return [];
  }
  const result: AiResidualLogisticFoldEvaluation[] = [];
  value.forEach((item, expectedIndex) => {
    const path = `foldMetrics[${expectedIndex}]`;
    if (
      !isRecord(item) ||
      !exactKeys(item, [
        "foldIndex",
        "holdoutBvidHash",
        "holdoutMediaSha256Hash",
        "labelBvidCounts",
        "metrics",
      ])
    ) {
      errors.push(`${path} has missing or unknown fields`);
      return;
    }
    if (item.foldIndex !== expectedIndex) {
      errors.push(`${path}.foldIndex is invalid`);
    }
    if (
      typeof item.holdoutBvidHash !== "string" ||
      !SHA256_PATTERN.test(item.holdoutBvidHash)
    ) {
      errors.push(`${path}.holdoutBvidHash is invalid`);
    }
    if (
      typeof item.holdoutMediaSha256Hash !== "string" ||
      !SHA256_PATTERN.test(item.holdoutMediaSha256Hash)
    ) {
      errors.push(`${path}.holdoutMediaSha256Hash is invalid`);
    }
    const metrics = validateEvaluation(item.metrics, `${path}.metrics`, errors);
    const counts = item.labelBvidCounts;
    let validLabelBvidCounts = true;
    if (
      !isRecord(counts) ||
      !exactKeys(counts, ["upgrade", "refresh", "freeze"])
    ) {
      errors.push(`${path}.labelBvidCounts is invalid`);
      validLabelBvidCounts = false;
    } else {
      for (const kind of ["upgrade", "refresh", "freeze"] as const) {
        const kindCounts = counts[kind];
        if (
          !isRecord(kindCounts) ||
          !exactKeys(kindCounts, ["positive", "negative"]) ||
          !Number.isSafeInteger(kindCounts.positive) ||
          (kindCounts.positive as number) <
            AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES ||
          !Number.isSafeInteger(kindCounts.negative) ||
          (kindCounts.negative as number) <
            AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES
        ) {
          errors.push(`${path}.labelBvidCounts.${kind} is invalid`);
          validLabelBvidCounts = false;
        }
        const headMetrics = metrics[kind];
        if (headMetrics !== undefined) {
          const positiveExamples =
            headMetrics.truePositive + headMetrics.falseNegative;
          const negativeExamples =
            headMetrics.trueNegative + headMetrics.falsePositive;
          if (
            positiveExamples < AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES ||
            negativeExamples < AI_RESIDUAL_LOGISTIC_MIN_FOLD_LABEL_EXAMPLES
          ) {
            errors.push(`${path}.metrics.${kind} lacks per-label examples`);
          }
          if (
            isRecord(kindCounts) &&
            Number.isSafeInteger(kindCounts.positive) &&
            Number.isSafeInteger(kindCounts.negative) &&
            ((kindCounts.positive as number) > positiveExamples ||
              (kindCounts.negative as number) > negativeExamples)
          ) {
            errors.push(`${path}.labelBvidCounts.${kind} exceeds label examples`);
          }
          const expectedAccuracy = rounded(
            (headMetrics.truePositive + headMetrics.trueNegative) /
              headMetrics.examples,
          );
          if (
            headMetrics.totalWeight !==
              headMetrics.examples * AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT ||
            headMetrics.accuracy !== expectedAccuracy
          ) {
            errors.push(`${path}.metrics.${kind} is not a video-only evaluation`);
          }
        }
      }
    }
    if (
      item.foldIndex === expectedIndex &&
      typeof item.holdoutBvidHash === "string" &&
      typeof item.holdoutMediaSha256Hash === "string" &&
      isRecord(counts) &&
      validLabelBvidCounts &&
      metrics.upgrade !== undefined &&
      metrics.refresh !== undefined &&
      metrics.freeze !== undefined
    ) {
      result.push(item as unknown as AiResidualLogisticFoldEvaluation);
    }
  });
  if (
    result.length === foldCount &&
    new Set(result.map((fold) => fold.holdoutBvidHash)).size !== foldCount
  ) {
    errors.push("foldMetrics holdoutBvidHash values must be unique");
  }
  return result;
}

function validateSplitAssignments(
  value: unknown,
  errors: string[],
): AiResidualDatasetSplitAssignment[] {
  if (!Array.isArray(value) || value.length < FIXED_FOLD_COUNT) {
    errors.push("splitAssignments must contain at least three media groups");
    return [];
  }
  const result: AiResidualDatasetSplitAssignment[] = [];
  const bvids = new Set<string>();
  const mediaSha256s = new Set<string>();
  value.forEach((item, index) => {
    const path = `splitAssignments[${index}]`;
    if (
      !isRecord(item) ||
      !exactKeys(item, ["bvid", "reviewedMediaSha256", "foldIndex"])
    ) {
      errors.push(`${path} has missing or unknown fields`);
      return;
    }
    if (
      typeof item.bvid !== "string" ||
      typeof item.reviewedMediaSha256 !== "string" ||
      !SHA256_PATTERN.test(item.reviewedMediaSha256) ||
      !Number.isSafeInteger(item.foldIndex) ||
      (item.foldIndex as number) < 0 ||
      (item.foldIndex as number) >= FIXED_FOLD_COUNT
    ) {
      errors.push(`${path} is invalid`);
      return;
    }
    const source = getAiVideoCorpusSource(item.bvid);
    if (
      source === null ||
      !source.runtimeCompatible ||
      source.reviewedMediaSha256 !== item.reviewedMediaSha256
    ) {
      errors.push(`${path} does not match the BVID/media registry`);
    }
    if (bvids.has(item.bvid) || mediaSha256s.has(item.reviewedMediaSha256)) {
      errors.push("splitAssignments must map BVID and media SHA-256 one-to-one");
    }
    bvids.add(item.bvid);
    mediaSha256s.add(item.reviewedMediaSha256);
    result.push(item as unknown as AiResidualDatasetSplitAssignment);
  });
  if (result.length === value.length) {
    const expected = [...result]
      .sort((left, right) => {
        const leftHash = canonicalHash([
          AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
          left.reviewedMediaSha256,
        ]);
        const rightHash = canonicalHash([
          AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
          right.reviewedMediaSha256,
        ]);
        return (
          leftHash.localeCompare(rightHash) ||
          left.reviewedMediaSha256.localeCompare(right.reviewedMediaSha256)
        );
      })
      .map((item, index) => ({
        bvid: item.bvid,
        reviewedMediaSha256: item.reviewedMediaSha256,
        foldIndex: index % FIXED_FOLD_COUNT,
      }));
    if (
      canonicalAiPolicyArtifactJson(value) !==
      canonicalAiPolicyArtifactJson(expected)
    ) {
      errors.push("splitAssignments do not match the fixed split algorithm");
    }
  }
  return result;
}

export function validateAiResidualLogisticModelArtifact(
  value: unknown,
): AiResidualLogisticArtifactValidationResult {
  const errors: string[] = [];
  try {
    value = strictTrainingDataSnapshot(value, "artifact");
  } catch (error) {
    return {
      valid: false,
      errors: Object.freeze([
        error instanceof Error ? error.message : String(error),
      ]),
    };
  }
  if (!isRecord(value)) {
    return { valid: false, errors: Object.freeze(["artifact must be a plain object"]) };
  }
  const topKeys = [
    "schemaVersion", "scorerVersion", "artifactHash", "modelId", "modelVersion", "trainingVersion",
    "contextVersion", "featureSchemaVersion", "featureSchemaHash",
    "runtimeContentVersion", "runtimePolicyVersion", "strategyProfileHash",
    "runtimePayloadHash",
    "basePolicyArtifactHash", "videoContentVersions", "videoEvidenceSetHash",
    "datasetHash", "splitHash", "splitVersion", "splitAssignmentsHash",
    "splitAssignments", "foldCount",
    "sourceWeights", "confidenceThreshold", "trainingConfig", "heads",
    "trainingMetrics", "holdoutMetrics", "foldMetrics", "promotionGate",
  ];
  if (!exactKeys(value, topKeys)) errors.push("artifact has missing or unknown fields");
  const runtimeValidation = validateAiResidualLogisticRuntimeArtifact(value);
  errors.push(...runtimeValidation.errors);
  if (value.trainingVersion !== AI_RESIDUAL_LOGISTIC_TRAINING_VERSION) errors.push("trainingVersion mismatch");
  for (const key of [
    "artifactHash",
    "strategyProfileHash",
    "videoEvidenceSetHash",
    "datasetHash",
    "splitHash",
    "splitAssignmentsHash",
  ] as const) {
    if (typeof value[key] !== "string" || !SHA256_PATTERN.test(value[key] as string)) {
      errors.push(`${key} is invalid`);
    }
  }
  if (value.strategyProfileHash !== computeAiStrategyProfileHash(AI_STRATEGY_PROFILES)) {
    errors.push("strategyProfileHash mismatch");
  }
  if (
    value.basePolicyArtifactHash !== null &&
    (typeof value.basePolicyArtifactHash !== "string" ||
      !SHA256_PATTERN.test(value.basePolicyArtifactHash))
  ) {
    errors.push("basePolicyArtifactHash is invalid");
  }
  if (
    !Array.isArray(value.videoContentVersions) ||
    value.videoContentVersions.length === 0 ||
    value.videoContentVersions.some(
      (item) =>
        typeof item !== "string" || item.length === 0 || item.length > 128,
    ) ||
    new Set(value.videoContentVersions).size !== value.videoContentVersions.length ||
    JSON.stringify(value.videoContentVersions) !==
      JSON.stringify([...value.videoContentVersions].sort()) ||
    value.videoContentVersions.length !== 1 ||
    value.videoContentVersions[0] !== value.runtimeContentVersion
  ) {
    errors.push("videoContentVersions is invalid");
  }
  const foldCount =
    value.foldCount === FIXED_FOLD_COUNT ? FIXED_FOLD_COUNT : 0;
  if (foldCount === 0) errors.push("foldCount must match the fixed split");
  if (value.splitVersion !== AI_RESIDUAL_LOGISTIC_SPLIT_VERSION) {
    errors.push("splitVersion mismatch");
  }
  const splitAssignments = validateSplitAssignments(
    value.splitAssignments,
    errors,
  );
  if (
    typeof value.splitAssignmentsHash === "string" &&
    canonicalHash(splitAssignments) !== value.splitAssignmentsHash
  ) {
    errors.push("splitAssignmentsHash does not match splitAssignments");
  }
  if (
    typeof value.datasetHash === "string" &&
    typeof value.splitAssignmentsHash === "string" &&
    canonicalHash({
      datasetHash: value.datasetHash,
      splitVersion: AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
      splitAssignmentsHash: value.splitAssignmentsHash,
      foldCount: FIXED_FOLD_COUNT,
    }) !== value.splitHash
  ) {
    errors.push("splitHash does not match the fixed split payload");
  }
  if (
    !isRecord(value.sourceWeights) ||
    !exactKeys(value.sourceWeights, ["video"]) ||
    value.sourceWeights.video !== AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT
  ) {
    errors.push("sourceWeights mismatch");
  }
  if (
    !isRecord(value.trainingConfig) ||
    !exactKeys(value.trainingConfig, [
      "epochs",
      "learningRate",
      "learningRateDecay",
      "l2",
    ]) ||
    !Number.isSafeInteger(value.trainingConfig.epochs) ||
    (value.trainingConfig.epochs as number) < 1 ||
    (value.trainingConfig.epochs as number) > 100_000 ||
    !isFiniteInRange(value.trainingConfig.learningRate, Number.EPSILON) ||
    !isFiniteInRange(value.trainingConfig.learningRateDecay, 0) ||
    !isFiniteInRange(value.trainingConfig.l2, Number.EPSILON)
  ) {
    errors.push("trainingConfig is invalid");
  }
  const trainingMetrics = validateEvaluation(
    value.trainingMetrics,
    "trainingMetrics",
    errors,
  );
  const holdoutMetrics = validateEvaluation(
    value.holdoutMetrics,
    "holdoutMetrics",
    errors,
  );
  const foldMetrics = validateFoldEvaluations(
    value.foldMetrics,
    foldCount,
    errors,
  );
  if (
    splitAssignments.length > 0 &&
    foldMetrics.length === FIXED_FOLD_COUNT
  ) {
    for (const fold of foldMetrics) {
      const foldAssignments = splitAssignments.filter(
        (assignment) => assignment.foldIndex === fold.foldIndex,
      );
      const expectedBvidHash = canonicalHash(
        foldAssignments.map((assignment) => assignment.bvid).sort(),
      );
      const expectedMediaSha256Hash = canonicalHash(
        foldAssignments
          .map((assignment) => assignment.reviewedMediaSha256)
          .sort(),
      );
      if (fold.holdoutBvidHash !== expectedBvidHash) {
        errors.push(`foldMetrics[${fold.foldIndex}].holdoutBvidHash mismatch`);
      }
      if (fold.holdoutMediaSha256Hash !== expectedMediaSha256Hash) {
        errors.push(
          `foldMetrics[${fold.foldIndex}].holdoutMediaSha256Hash mismatch`,
        );
      }
    }
  }
  if (
    trainingMetrics.upgrade !== undefined &&
    trainingMetrics.refresh !== undefined &&
    trainingMetrics.freeze !== undefined &&
    holdoutMetrics.upgrade !== undefined &&
    holdoutMetrics.refresh !== undefined &&
    holdoutMetrics.freeze !== undefined &&
    foldMetrics.length === foldCount
  ) {
    try {
      const expectedHoldoutMetrics = aggregateEvaluation(
        foldMetrics.map((fold) => fold.metrics),
      );
      for (const kind of ["upgrade", "refresh", "freeze"] as const) {
        const headMetrics = expectedHoldoutMetrics[kind];
        const positiveExamples =
          headMetrics.truePositive + headMetrics.falseNegative;
        const negativeExamples =
          headMetrics.trueNegative + headMetrics.falsePositive;
        if (
          positiveExamples < AI_RESIDUAL_LOGISTIC_MIN_LABEL_EXAMPLES ||
          negativeExamples < AI_RESIDUAL_LOGISTIC_MIN_LABEL_EXAMPLES
        ) {
          errors.push(`holdoutMetrics.${kind} lacks corpus-level label examples`);
        }
        const positiveBvids = foldMetrics.reduce(
          (sum, fold) => sum + fold.labelBvidCounts[kind].positive,
          0,
        );
        const negativeBvids = foldMetrics.reduce(
          (sum, fold) => sum + fold.labelBvidCounts[kind].negative,
          0,
        );
        if (
          positiveBvids < AI_RESIDUAL_LOGISTIC_MIN_LABEL_BVIDS ||
          negativeBvids < AI_RESIDUAL_LOGISTIC_MIN_LABEL_BVIDS
        ) {
          errors.push(`foldMetrics ${kind} lacks corpus-level label BVIDs`);
        }
      }
      if (
        canonicalAiPolicyArtifactJson(value.holdoutMetrics) !==
        canonicalAiPolicyArtifactJson(expectedHoldoutMetrics)
      ) {
        errors.push("holdoutMetrics do not match aggregated fold metrics");
      }
      const expectedPromotionGate = createPromotionGate(
        expectedHoldoutMetrics,
        foldMetrics.length,
      );
      if (
        canonicalAiPolicyArtifactJson(value.promotionGate) !==
        canonicalAiPolicyArtifactJson(expectedPromotionGate)
      ) {
        errors.push("promotionGate does not match recomputed cross-validation metrics");
      }
    } catch (error) {
      errors.push(
        `promotion gate failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (isRecord(value.heads)) {
    for (const kind of ["upgrade", "refresh", "freeze"] as const) {
      const head = value.heads[kind];
      if (!isRecord(head)) continue;
      if (
        trainingMetrics[kind] !== undefined &&
        head.trainingExamples !== trainingMetrics[kind]?.examples
      ) {
        errors.push(`${kind} training example count mismatch`);
      }
      if (
        holdoutMetrics[kind] !== undefined &&
        head.holdoutExamples !== holdoutMetrics[kind]?.examples
      ) {
        errors.push(`${kind} holdout example count mismatch`);
      }
    }
  }
  try {
    if (
      typeof value.artifactHash === "string" &&
      computeAiResidualLogisticArtifactHash(
        value as unknown as AiResidualLogisticModelArtifact,
      ) !== value.artifactHash
    ) {
      errors.push("artifactHash does not match canonical payload");
    }
  } catch (error) {
    errors.push(`artifact canonicalization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { valid: errors.length === 0, errors: Object.freeze(errors) };
}

export function assertValidAiResidualLogisticModelArtifact(
  value: unknown,
): asserts value is AiResidualLogisticModelArtifact {
  const validation = validateAiResidualLogisticModelArtifact(value);
  if (!validation.valid) throw new TypeError(validation.errors.join("; "));
}

export function canonicalAiResidualLogisticModelJson(
  value: AiResidualLogisticModelArtifact,
): string {
  assertValidAiResidualLogisticModelArtifact(value);
  return canonicalAiPolicyArtifactJson(value);
}

export function loadAiResidualLogisticModelArtifact(
  json: string,
): DeepReadonly<AiResidualLogisticModelArtifact> {
  const value = JSON.parse(json) as unknown;
  assertValidAiResidualLogisticModelArtifact(value);
  return deepFreeze(value);
}
