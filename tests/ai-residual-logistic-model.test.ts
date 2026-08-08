import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  AI_POLICY_VERSION,
  type AiStrategyId,
} from "../lib/game/ai.ts";
import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";
import {
  AI_RESIDUAL_FEATURE_SCHEMA_HASH,
  AI_RESIDUAL_FEATURE_PROFILE_IDS,
  createFullAiResidualSemanticRecord,
  createProfileNeutralAiResidualSemanticRecord,
  encodeAiResidualMacroContext,
  encodeAiResidualSemanticRecord,
} from "../lib/game/ai-residual-features.ts";
import {
  createAiResidualLogisticPolicy,
  computeAiResidualBrowserSha256,
  computeAiResidualLogisticRuntimePayloadHash,
  predictAiResidualLogisticModel,
  validateAiResidualLogisticRuntimeArtifact,
} from "../lib/game/ai-logistic-residual-policy.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  type AiFreezeMacroChoice,
  type AiFreezeMacroContext,
  type AiRefreshMacroChoice,
  type AiRefreshMacroContext,
  type AiResidualMacroContext,
  type AiResidualMacroKind,
  type AiUpgradeMacroChoice,
  type AiUpgradeMacroContext,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_EXPERT_SAMPLE_SCHEMA_VERSION,
  canonicalAiExpertSampleJson,
  createAiExpertDecisionSample,
  type CreateAiExpertDecisionSampleInput,
} from "../scripts/ai-expert-samples.ts";
import {
  AI_RESIDUAL_LEGACY_SAMPLE_WEIGHT,
  AI_RESIDUAL_LOGISTIC_SPLIT_VERSION,
  canonicalAiResidualLogisticModelJson,
  computeAiResidualLogisticArtifactHash,
  createAiResidualLegacyExample,
  loadAiResidualLogisticModelArtifact,
  splitAiResidualTrainingExamples,
  trainAiResidualLogisticModel,
  validateAiResidualLogisticModelArtifact,
  type AiResidualLogisticModelArtifact,
  type AiResidualTrainingExample,
} from "../scripts/ai-residual-logistic-model.ts";
import {
  AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION,
  AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT,
  createAiResidualVideoExample,
  validateAiResidualVideoEvidence,
  validateAiResidualVideoTrainingExample,
  type AiResidualObservedValue,
  type AiResidualRuntimeCompatibility,
  type AiResidualVideoEvidence,
  type AiResidualVideoTrainingExample,
} from "../scripts/ai-residual-video-evidence.ts";
import {
  AI_RUNTIME_COMPATIBLE_VIDEO_CORPUS_SOURCES,
  getAiVideoCorpusSource,
} from "../scripts/ai-video-corpus-sources.ts";

const LEGACY_BUNDLE_HASH = "a".repeat(64);
// Synthetic replay fixtures only: production hashes must point at retained
// same-state baseline replay evidence and must never be derived from labels.
const SYNTHETIC_BASELINE_REPLAY_HASH = "c".repeat(64);
const COMPATIBLE_SOURCES = AI_RUNTIME_COMPATIBLE_VIDEO_CORPUS_SOURCES;
const BVIDS = Object.freeze(COMPATIBLE_SOURCES.map((source) => source.bvid));

function compatibleSource(bvid: string) {
  const source = getAiVideoCorpusSource(bvid);
  if (
    source === null ||
    !source.runtimeCompatible ||
    (source.sourcePatch !== "35.4.2" &&
      source.sourcePatch !== "36.0" &&
      source.sourcePatch !== "36.0.3")
  ) {
    throw new TypeError(`missing compatible source ${bvid}`);
  }
  return {
    ...source,
    runtimeCompatible: true as const,
    sourcePatch: source.sourcePatch,
  };
}

function upgradeContext(
  profileId: AiStrategyId,
  choice: AiUpgradeMacroChoice,
  positive: boolean,
): AiUpgradeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "upgrade",
    contentVersion: CURRENT_ROSTER_VERSION,
    policyVersion: AI_POLICY_VERSION,
    profileId,
    round: positive ? 7 : 5,
    tavernTier: 3,
    health: positive ? 34 : 13,
    armor: 2,
    gold: positive ? 10 : 5,
    boardSize: positive ? 7 : 4,
    handSize: 1,
    legacyChoice: choice,
    legalChoices: ["upgradeNow", "deferUpgrade"],
    checkpoint: "opening",
    actionsTaken: 0,
    refreshesTaken: 0,
    upgradeCost: positive ? 4 : 5,
    targetBoardSize: 6,
    bestShopScore: positive ? 8 : 18,
    weakestBoardScore: 10,
    bestAffordableSpellScore: null,
  };
}

function refreshContext(
  profileId: AiStrategyId,
  choice: AiRefreshMacroChoice,
  positive: boolean,
): AiRefreshMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "refresh",
    contentVersion: CURRENT_ROSTER_VERSION,
    policyVersion: AI_POLICY_VERSION,
    profileId,
    round: positive ? 9 : 5,
    tavernTier: 4,
    health: positive ? 30 : 12,
    armor: 1,
    gold: positive ? 7 : 1,
    boardSize: positive ? 7 : 4,
    handSize: 1,
    legacyChoice: choice,
    legalChoices: ["refreshOnce", "stopRefreshing"],
    refreshCurrency: "gold",
    refreshCost: 1,
    affordable: true,
    healthSpendSafe: true,
    freeRefreshSource: null,
    remainingHealthRefreshes: 0,
    rewindsRecruitDamage: false,
    refreshesThisTurn: positive ? 1 : 3,
    refreshLimit: 5,
    actionsTaken: 3,
    actionLimit: 50,
    minionPurchaseCost: 3,
    canBuyAfterRefresh: positive,
    canSpeculativelyRefresh: positive,
    goldAfterRefresh: positive ? 6 : 0,
    effectiveHealthAfterRefresh: positive ? 31 : 13,
    healthSpendFloor: 8,
    targetBoardSize: 7,
  };
}

function freezeContext(
  profileId: AiStrategyId,
  choice: AiFreezeMacroChoice,
  positive: boolean,
): AiFreezeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "freeze",
    contentVersion: CURRENT_ROSTER_VERSION,
    policyVersion: AI_POLICY_VERSION,
    profileId,
    round: positive ? 9 : 5,
    tavernTier: 4,
    health: positive ? 25 : 12,
    armor: 0,
    gold: positive ? 0 : 4,
    boardSize: 7,
    handSize: 2,
    legacyChoice: choice,
    legalChoices: ["freeze", "unfreeze"],
    currentlyFrozen: !positive,
    bestMinionScore: positive ? 22 : 4,
    bestSpellScore: positive ? 14 : 2,
    bestTripleProgress: positive ? 2 : 0,
    remainingMinionPurchaseCost: 3,
    handFull: false,
    freezePairCount: positive ? 2 : 1,
    minionScoreThreshold: 12,
    spellScoreThreshold: 8,
    freezeMinionReason: positive,
    freezeSpellReason: positive,
    unspentGold: positive ? 0 : 4,
  };
}

function contextFor(
  kind: AiResidualMacroKind,
  profileId: AiStrategyId,
  positive: boolean,
): AiResidualMacroContext {
  switch (kind) {
    case "upgrade":
      return upgradeContext(
        profileId,
        positive ? "upgradeNow" : "deferUpgrade",
        positive,
      );
    case "refresh":
      return refreshContext(
        profileId,
        positive ? "refreshOnce" : "stopRefreshing",
        positive,
      );
    case "freeze":
      return freezeContext(
        profileId,
        positive ? "freeze" : "unfreeze",
        positive,
      );
  }
}

function expertInput(
  sampleId: string,
  source: ReturnType<typeof compatibleSource>,
): CreateAiExpertDecisionSampleInput {
  return {
    schemaVersion: AI_EXPERT_SAMPLE_SCHEMA_VERSION,
    sampleId,
    contentVersion: CURRENT_ROSTER_VERSION,
    patchVersion: source.sourcePatch,
    source: {
      platform: "bilibili",
      bvid: source.bvid,
      timestampMs: 123_000,
    },
    observation: { publicVisibleFrame: true },
    candidatePlans: ["tempo", "normalLevel", "refresh"],
    chosenPlan: "tempo",
    screenFacts: [
      {
        id: "fact-visible",
        kind: "screenFact",
        statement: "画面显示本次标注使用的公共数值。",
        evidenceType: "visibleStat",
      },
      {
        id: "fact-legal",
        kind: "screenFact",
        statement: "画面显示两个宏观选择在当时均可执行。",
        evidenceType: "visibleText",
      },
      {
        id: "fact-action",
        kind: "screenFact",
        statement: "画面显示玩家随后作出的实际选择。",
        evidenceType: "visibleAction",
      },
    ],
    engineeringInferences: [
      {
        id: "inference-choice",
        kind: "engineeringInference",
        statement: "合法状态与随后动作共同支持残差标签。",
        basedOnFactIds: ["fact-legal", "fact-action"],
        confidence: 0.95,
      },
    ],
    labelConfidence: {
      level: "high",
      score: 0.95,
      rationale: "公共数值、合法状态和实际动作均清晰可见。",
    },
  };
}

function observed<Value>(value: Value): AiResidualObservedValue<Value> {
  return { value, screenFactIds: ["fact-visible"] };
}

function videoEvidence(
  expertSampleHash: string,
  kind: AiResidualMacroKind,
  positive: boolean,
): AiResidualVideoEvidence {
  const common = {
    round: observed(positive ? 9 : 4),
    tavernTier: observed(positive ? 4 : 2),
    health: observed(positive ? 30 : 10),
    armor: observed(0),
    gold: observed(positive ? 9 : 1),
    boardSize: observed(positive ? 7 : 3),
    handSize: observed(1),
  };
  const base = {
    schemaVersion: AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION,
    expertSampleHash,
    choiceEvidenceId: "fact-action",
    legalChoiceFactIds: ["fact-legal"],
  } as const;
  switch (kind) {
    case "upgrade":
      return {
        ...base,
        kind,
        choice: positive ? "upgradeNow" : "deferUpgrade",
        visible: { ...common, upgradeCost: observed(positive ? 4 : 5) },
      };
    case "refresh":
      return {
        ...base,
        kind,
        choice: positive ? "refreshOnce" : "stopRefreshing",
        visible: {
          ...common,
          refreshCurrency: observed("gold" as const),
          refreshCost: observed(1),
        },
      };
    case "freeze":
      return {
        ...base,
        kind,
        choice: positive ? "freeze" : "unfreeze",
        visible: { ...common, currentlyFrozen: observed(!positive) },
      };
  }
}

function videoExample(
  bvid: string,
  groupIndex: number,
  kind: AiResidualMacroKind,
  positive: boolean,
  sampleInGroup = 0,
  includeBaseline = true,
) {
  const source = compatibleSource(bvid);
  const sample = createAiExpertDecisionSample(
    expertInput(
      `synthetic-video-${groupIndex}-${sampleInGroup}-${kind}-${positive ? "positive" : "negative"}`,
      source,
    ),
  );
  const baselineChoice =
    kind === "upgrade"
      ? positive ? "deferUpgrade" : "upgradeNow"
      : kind === "refresh"
        ? positive ? "stopRefreshing" : "refreshOnce"
        : positive ? "unfreeze" : "freeze";
  return createAiResidualVideoExample({
    expertSample: sample,
    evidence: videoEvidence(sample.canonicalHash, kind, positive),
    runtimeCompatibility: compatibleReview(bvid),
    ...(includeBaseline
      ? {
          baselineChoice,
          baselinePolicyVersion: AI_POLICY_VERSION,
          baselineReplayHash: SYNTHETIC_BASELINE_REPLAY_HASH,
        }
      : {}),
  });
}

function compatibleReview(bvid: string): AiResidualRuntimeCompatibility {
  const source = compatibleSource(bvid);
  return {
    compatible: true,
    reviewedBy: "synthetic-test-reviewer",
    reviewedMediaSha256: source.reviewedMediaSha256,
    reason: source.compatibilityReason,
    sourcePatch: source.sourcePatch,
    targetContentVersion: source.targetContentVersion,
  };
}

function trainingExamples(
  bvids: readonly string[] = BVIDS,
  samplesPerBvid = 2,
  includeBaseline = true,
): readonly AiResidualTrainingExample[] {
  const examples: AiResidualTrainingExample[] = [];
  bvids.forEach((bvid, groupIndex) => {
    for (let sampleInGroup = 0; sampleInGroup < samplesPerBvid; sampleInGroup += 1) {
      for (const kind of ["upgrade", "refresh", "freeze"] as const) {
        examples.push(
          videoExample(
            bvid,
            groupIndex,
            kind,
            false,
            sampleInGroup,
            includeBaseline,
          ),
        );
        examples.push(
          videoExample(
            bvid,
            groupIndex,
            kind,
            true,
            sampleInGroup,
            includeBaseline,
          ),
        );
      }
    }
  });
  return examples;
}

function featureValue(
  encoded: ReturnType<typeof encodeAiResidualSemanticRecord>,
  name: string,
): number {
  const index = encoded.names.indexOf(name);
  assert.notEqual(index, -1, `missing feature ${name}`);
  return encoded.values[index] as number;
}

type Mutable<Value> =
  Value extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
      : Value;

function mutableArtifact(
  artifact: AiResidualLogisticModelArtifact,
): Mutable<AiResidualLogisticModelArtifact> {
  return structuredClone(artifact) as Mutable<AiResidualLogisticModelArtifact>;
}

function rehash(artifact: Mutable<AiResidualLogisticModelArtifact>): void {
  artifact.runtimePayloadHash = computeAiResidualLogisticRuntimePayloadHash(
    artifact,
  );
  artifact.artifactHash = computeAiResidualLogisticArtifactHash(artifact);
}

function rehashVideoExample(
  example: Mutable<AiResidualVideoTrainingExample>,
): void {
  const unsigned = structuredClone(example) as Record<string, unknown>;
  delete unsigned.canonicalHash;
  example.canonicalHash = testCanonicalHash(unsigned);
}

function testCanonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiExpertSampleJson(value))
    .digest("hex");
}

test("video evidence rejects hidden engine fields and requires cited facts", () => {
  const sample = createAiExpertDecisionSample(
    expertInput("synthetic-evidence-001", compatibleSource(BVIDS[0])),
  );
  const valid = videoEvidence(sample.canonicalHash, "upgrade", true);
  assert.deepEqual(validateAiResidualVideoEvidence(sample, valid), {
    valid: true,
    errors: [],
  });

  const hidden = structuredClone(valid) as unknown as Record<string, unknown>;
  hidden.profileId = "balanced";
  (hidden.visible as Record<string, unknown>).bestShopScore = observed(99);
  const hiddenValidation = validateAiResidualVideoEvidence(sample, hidden);
  assert.equal(hiddenValidation.valid, false);
  assert.match(hiddenValidation.errors.join("\n"), /profileId is not allowed/);
  assert.match(hiddenValidation.errors.join("\n"), /bestShopScore is not allowed/);

  const uncited = structuredClone(valid) as unknown as Record<string, unknown>;
  ((uncited.visible as Record<string, unknown>).gold as Record<string, unknown>)
    .screenFactIds = ["missing-fact"];
  assert.match(
    validateAiResidualVideoEvidence(sample, uncited).errors.join("\n"),
    /is not a screen fact/,
  );

  assert.match(
    validateAiResidualVideoEvidence(
      sample,
      Object.create(valid) as AiResidualVideoEvidence,
    ).errors.join("\n"),
    /ordinary object prototype/,
  );
  const accessor = structuredClone(valid) as unknown as Record<string, unknown>;
  Object.defineProperty(accessor, "choice", {
    enumerable: true,
    get: () => "upgradeNow",
  });
  assert.match(
    validateAiResidualVideoEvidence(sample, accessor).errors.join("\n"),
    /own enumerable data property/,
  );
  const symbolEvidence = structuredClone(valid) as object;
  Object.defineProperty(symbolEvidence, Symbol("hidden"), {
    enumerable: true,
    value: "forged",
  });
  assert.match(
    validateAiResidualVideoEvidence(sample, symbolEvidence).errors.join("\n"),
    /symbol properties/,
  );
  const arrayExtra = structuredClone(valid) as unknown as Record<string, unknown>;
  Object.defineProperty(
    (arrayExtra.legalChoiceFactIds as string[]),
    "extra",
    { enumerable: true, value: "forged" },
  );
  assert.match(
    validateAiResidualVideoEvidence(sample, arrayExtra).errors.join("\n"),
    /extra properties/,
  );

  const lowLabelInput = expertInput(
    "synthetic-low-label",
    compatibleSource(BVIDS[1]),
  );
  lowLabelInput.labelConfidence.score = 0.89;
  const lowLabel = createAiExpertDecisionSample(lowLabelInput);
  assert.match(
    validateAiResidualVideoEvidence(
      lowLabel,
      videoEvidence(lowLabel.canonicalHash, "upgrade", true),
    ).errors.join("\n"),
    /label confidence must be high and at least 0.90/,
  );
  const lowInferenceInput = expertInput(
    "synthetic-low-inference",
    compatibleSource(BVIDS[2]),
  );
  lowInferenceInput.engineeringInferences[0]!.confidence = 0.89;
  const lowInference = createAiExpertDecisionSample(lowInferenceInput);
  const inferredChoice = videoEvidence(
    lowInference.canonicalHash,
    "upgrade",
    true,
  );
  Object.assign(inferredChoice, { choiceEvidenceId: "inference-choice" });
  assert.match(
    validateAiResidualVideoEvidence(lowInference, inferredChoice).errors.join("\n"),
    /inference confidence must be at least 0.90/,
  );

  const example = videoExample(BVIDS[3], 3, "upgrade", true);
  assert.equal(validateAiResidualVideoTrainingExample(example).valid, true);
  assert.equal(
    example.runtimeCompatibility.reviewedMediaSha256,
    compatibleSource(BVIDS[3]).reviewedMediaSha256,
  );
  assert.throws(
    () =>
      createAiResidualVideoExample({
        expertSample: sample,
        evidence: valid,
        runtimeCompatibility: {
          ...compatibleReview(BVIDS[0]),
          reviewedMediaSha256: "not-a-media-hash",
        },
      }),
    /reviewedMediaSha256 is invalid/,
  );
  const semanticMutations = [
    ["profileId", { known: true, value: "balanced" }],
    ["legacyChoice", { known: true, value: "upgradeNow" }],
    ["bestShopScore", { known: true, value: 99 }],
  ] as const;
  for (const [key, forgedValue] of semanticMutations) {
    const forged = structuredClone(
      example,
    ) as Mutable<AiResidualVideoTrainingExample>;
    Object.assign(
      forged.semanticRecord as unknown as Record<string, unknown>,
      { [key]: forgedValue },
    );
    rehashVideoExample(forged);
    assert.match(
      validateAiResidualVideoTrainingExample(forged).errors.join("\n"),
      /strict visible evidence projection/,
    );
  }

  const accessorExample = structuredClone(
    example,
  ) as Mutable<AiResidualVideoTrainingExample>;
  Object.defineProperty(
    (accessorExample.semanticRecord as unknown as Record<string, unknown>)
      .profileId as object,
    "known",
    { enumerable: true, get: () => false },
  );
  assert.match(
    validateAiResidualVideoTrainingExample(accessorExample).errors.join("\n"),
    /own enumerable data property/,
  );

  const season14Input = expertInput(
    "synthetic-season-14",
    compatibleSource(BVIDS[4]),
  );
  season14Input.patchVersion = "36.2";
  const season14 = createAiExpertDecisionSample(season14Input);
  assert.throws(
    () =>
      createAiResidualVideoExample({
        expertSample: season14,
        evidence: videoEvidence(season14.canonicalHash, "upgrade", true),
        runtimeCompatibility: {
          ...compatibleReview(BVIDS[4]),
          sourcePatch: "36.2",
        } as unknown as AiResidualRuntimeCompatibility,
      }),
    /sourcePatch is unsupported/,
  );
});

test("runtime encoding uses only visible fields while full diagnostics stay distinct", () => {
  const missing = encodeAiResidualSemanticRecord(
    createProfileNeutralAiResidualSemanticRecord({
      kind: "upgrade",
      common: {},
    }),
  );
  const zero = encodeAiResidualSemanticRecord(
    createProfileNeutralAiResidualSemanticRecord({
      kind: "upgrade",
      common: { gold: 0 },
      upgradeCost: 0,
    }),
  );
  assert.equal(featureValue(missing, "gold_known"), 0);
  assert.equal(featureValue(missing, "gold_value"), 0);
  assert.equal(featureValue(zero, "gold_known"), 1);
  assert.equal(featureValue(zero, "gold_value"), 0);
  assert.equal(featureValue(zero, "profile_known"), 0);
  assert.equal(featureValue(zero, "legacy_choice_known"), 0);
  for (const profileId of AI_RESIDUAL_FEATURE_PROFILE_IDS) {
    assert.equal(featureValue(zero, `profile_${profileId}`), 0);
  }

  const runtime = encodeAiResidualMacroContext(
    upgradeContext("balanced", "deferUpgrade", false),
  );
  const runtimeNull = encodeAiResidualMacroContext({
    ...upgradeContext("balanced", "deferUpgrade", false),
    bestShopScore: null,
  });
  assert.deepEqual(runtime.names, zero.names);
  assert.equal(featureValue(runtime, "profile_known"), 0);
  assert.equal(featureValue(runtime, "profile_balanced"), 0);
  assert.equal(featureValue(runtime, "legacy_choice_known"), 0);
  assert.equal(featureValue(runtime, "best_shop_score_known"), 0);
  assert.equal(featureValue(runtimeNull, "best_shop_score_known"), 0);

  const full = encodeAiResidualSemanticRecord(
    createFullAiResidualSemanticRecord(
      upgradeContext("balanced", "deferUpgrade", false),
    ),
  );
  const fullNull = encodeAiResidualSemanticRecord(
    createFullAiResidualSemanticRecord({
      ...upgradeContext("balanced", "deferUpgrade", false),
      bestShopScore: null,
    }),
  );
  assert.equal(featureValue(full, "profile_known"), 1);
  assert.equal(featureValue(full, "profile_balanced"), 1);
  assert.equal(featureValue(full, "legacy_choice_known"), 1);
  assert.equal(featureValue(fullNull, "best_shop_score_known"), 1);
  assert.equal(featureValue(fullNull, "best_shop_score_present"), 0);
  assert.equal(featureValue(zero, "best_shop_score_known"), 0);
});

test("fixed media SHA split is deterministic, persisted, and leak-free", () => {
  const examples = trainingExamples();
  const videoExamples = examples.filter(
    (example): example is AiResidualVideoTrainingExample =>
      example.source === "video",
  );
  const positiveChoices = {
    upgrade: "upgradeNow",
    refresh: "refreshOnce",
    freeze: "freeze",
  } as const;
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    for (const positive of [false, true]) {
      const choice = positive
        ? positiveChoices[kind]
        : kind === "upgrade"
          ? "deferUpgrade"
          : kind === "refresh"
            ? "stopRefreshing"
            : "unfreeze";
      const labelExamples = videoExamples.filter(
        (example) => example.kind === kind && example.choice === choice,
      );
      assert.equal(labelExamples.length, BVIDS.length * 2);
      assert.equal(
        new Set(labelExamples.map((example) => example.bvid)).size,
        BVIDS.length,
      );
    }
  }
  const first = splitAiResidualTrainingExamples(examples);
  const second = splitAiResidualTrainingExamples([...examples].reverse());
  assert.equal(first.datasetHash, second.datasetHash);
  assert.equal(first.splitHash, second.splitHash);
  assert.equal(first.splitVersion, AI_RESIDUAL_LOGISTIC_SPLIT_VERSION);
  assert.match(first.splitAssignmentsHash, /^[0-9a-f]{64}$/);
  assert.deepEqual(first.splitAssignments, second.splitAssignments);
  assert.equal(first.foldCount, 3);
  assert.deepEqual(first.folds, second.folds);
  const heldOutBvids = new Set<string>();
  const heldOutMediaSha256s = new Set<string>();
  assert.equal(first.splitAssignments.length, COMPATIBLE_SOURCES.length);
  for (const assignment of first.splitAssignments) {
    const source = compatibleSource(assignment.bvid);
    assert.equal(assignment.reviewedMediaSha256, source.reviewedMediaSha256);
    assert.ok(assignment.foldIndex >= 0 && assignment.foldIndex < 3);
  }
  for (const fold of first.folds) {
    assert.equal(
      fold.trainingBvids.some((bvid) => fold.holdoutBvids.includes(bvid)),
      false,
    );
    assert.equal(
      fold.holdout.every(
        (example) =>
          example.source === "video" &&
          example.weight === AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT,
      ),
      true,
    );
    assert.equal(
      fold.training.every(
        (example) =>
          example.source === "video" &&
          example.weight === AI_RESIDUAL_VIDEO_SAMPLE_WEIGHT,
      ),
      true,
    );
    assert.equal(
      fold.trainingMediaSha256s.some((sha256) =>
        fold.holdoutMediaSha256s.includes(sha256),
      ),
      false,
    );
    for (const bvid of fold.holdoutBvids) {
      assert.equal(heldOutBvids.has(bvid), false);
      heldOutBvids.add(bvid);
    }
    for (const sha256 of fold.holdoutMediaSha256s) {
      assert.equal(heldOutMediaSha256s.has(sha256), false);
      heldOutMediaSha256s.add(sha256);
    }
    for (const kind of ["upgrade", "refresh", "freeze"] as const) {
      const positive = fold.holdout.filter(
        (example) =>
          example.kind === kind &&
          ["upgradeNow", "refreshOnce", "freeze"].includes(example.choice),
      );
      assert.equal(positive.length, fold.holdoutBvids.length * 2);
      assert.ok(positive.length >= 1);
      assert.equal(
        fold.holdout.filter((example) => example.kind === kind).length,
        fold.holdoutBvids.length * 4,
      );
    }
  }
  assert.equal(heldOutBvids.size, BVIDS.length);
  assert.equal(heldOutMediaSha256s.size, BVIDS.length);

  const tampered = structuredClone(examples[0] as AiResidualTrainingExample);
  Object.assign(tampered, {
    choice:
      tampered.kind === "upgrade"
        ? tampered.choice === "upgradeNow" ? "deferUpgrade" : "upgradeNow"
        : tampered.kind === "refresh"
          ? tampered.choice === "refreshOnce" ? "stopRefreshing" : "refreshOnce"
          : tampered.choice === "freeze" ? "unfreeze" : "freeze",
  });
  assert.throws(
    () => splitAiResidualTrainingExamples([tampered, ...examples.slice(1)]),
    /canonicalHash does not match|replay metadata mismatch/,
  );

  const videoIndex = examples.findIndex(
    (example) => example.source === "video" && example.kind === "upgrade",
  );
  assert.notEqual(videoIndex, -1);
  const forgedVideo = structuredClone(
    examples[videoIndex] as AiResidualVideoTrainingExample,
  ) as Mutable<AiResidualVideoTrainingExample>;
  Object.assign(
    forgedVideo.semanticRecord as unknown as Record<string, unknown>,
    { profileId: { known: true, value: "balanced" } },
  );
  rehashVideoExample(forgedVideo);
  const forgedCorpus = [...examples];
  forgedCorpus[videoIndex] = forgedVideo;
  assert.throws(
    () => splitAiResidualTrainingExamples(forgedCorpus),
    /strict visible evidence projection/,
  );

  assert.throws(
    () => splitAiResidualTrainingExamples(trainingExamples(BVIDS, 1)),
    /video corpus upgrade\/(?:upgradeNow|deferUpgrade) requires at least 10 examples/,
  );
  assert.throws(
    () => splitAiResidualTrainingExamples(trainingExamples(BVIDS.slice(0, 2), 5)),
    /requires at least 3 distinct BVIDs/,
  );

  const unevenExamples = trainingExamples(BVIDS, 4);
  const baseline = splitAiResidualTrainingExamples(unevenExamples);
  const firstFoldBvids = new Set(baseline.folds[0]?.holdoutBvids ?? []);
  const missingFoldLabel = unevenExamples.filter(
    (example) =>
      !(
        example.source === "video" &&
        firstFoldBvids.has(example.bvid) &&
        example.kind === "upgrade" &&
        example.choice === "upgradeNow"
      ),
  );
  assert.throws(
    () => splitAiResidualTrainingExamples(missingFoldLabel),
    /fold 0 upgrade\/upgradeNow requires at least 1 holdout example/,
  );
});

test("expert classifier rejects legacy self-labels and registry mismatches", () => {
  const examples = trainingExamples();
  const legacy = createAiResidualLegacyExample({
    context: upgradeContext("balanced", "upgradeNow", true),
    bundleSha256: LEGACY_BUNDLE_HASH,
    sampleIndex: 0,
  });
  assert.equal(legacy.weight, AI_RESIDUAL_LEGACY_SAMPLE_WEIGHT);
  assert.throws(
    () => splitAiResidualTrainingExamples([legacy, ...examples]),
    /legacy self-label examples are not allowed in the expert classifier/,
  );

  const forged = structuredClone(
    examples[0] as AiResidualVideoTrainingExample,
  ) as Mutable<AiResidualVideoTrainingExample>;
  forged.runtimeCompatibility.reviewedMediaSha256 = compatibleSource(
    BVIDS[1],
  ).reviewedMediaSha256;
  forged.compatibilityHash = testCanonicalHash(forged.runtimeCompatibility);
  rehashVideoExample(forged);
  const forgedCorpus = [forged, ...examples.slice(1)];
  assert.throws(
    () => splitAiResidualTrainingExamples(forgedCorpus),
    /does not match the BVID\/media registry/,
  );
});

test("missing paired baseline remains valid data but fails promotion closed", () => {
  const trained = trainAiResidualLogisticModel({
    examples: trainingExamples(BVIDS, 2, false),
    modelId: "synthetic-missing-baseline",
    modelVersion: "v1",
    trainingConfig: {
      epochs: 900,
      learningRate: 0.25,
      learningRateDecay: 0.002,
      l2: 0.002,
    },
  });
  assert.equal(trained.artifact.promotionGate.passed, false);
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    const gate = trained.artifact.promotionGate.heads[kind];
    assert.equal(gate.qualityPassed, true);
    assert.equal(gate.pairedBaselineComplete, false);
    assert.equal(gate.baselineExamples, 0);
    assert.equal(gate.pairedAccuracyLift, null);
    assert.equal(gate.passed, false);
  }
});

test("three deterministic L2 heads converge and ignore input ordering", () => {
  const examples = trainingExamples();
  const options = {
    modelId: "synthetic-residual-logistic",
    modelVersion: "v1",
    trainingConfig: {
      epochs: 900,
      learningRate: 0.25,
      learningRateDecay: 0.002,
      l2: 0.002,
    },
  } as const;
  const first = trainAiResidualLogisticModel({ examples, ...options });
  const second = trainAiResidualLogisticModel({
    examples: [...examples].reverse(),
    ...options,
  });
  assert.equal(first.artifact.artifactHash, second.artifact.artifactHash);
  assert.deepEqual(first.artifact.heads, second.artifact.heads);
  assert.match(AI_RESIDUAL_FEATURE_SCHEMA_HASH, /^[0-9a-f]{64}$/);
  assert.equal(first.artifact.foldCount, 3);
  assert.equal(first.artifact.foldMetrics.length, 3);
  assert.equal(first.artifact.promotionGate.passed, true);
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    const training = first.artifact.trainingMetrics[kind];
    const holdout = first.artifact.holdoutMetrics[kind];
    assert.ok((training.logLoss ?? 1) < 0.35, `${kind} training did not converge`);
    assert.ok((training.accuracy ?? 0) > 0.9, `${kind} training accuracy`);
    assert.ok((holdout.accuracy ?? 0) > 0.75, `${kind} holdout accuracy`);
    assert.equal(
      first.artifact.heads[kind].coefficients.every(Number.isFinite),
      true,
    );
    assert.ok((holdout.positiveRecall ?? 0) >= 0.6);
    assert.ok((holdout.negativeRecall ?? 0) >= 0.6);
    assert.ok(
      (holdout.balancedAccuracy ?? 0) >=
        (holdout.majorityBaselineBalancedAccuracy ?? 1) + 0.05,
    );
    const gate = first.artifact.promotionGate.heads[kind];
    assert.equal(gate.qualityPassed, true);
    assert.ok(gate.coverage >= first.artifact.promotionGate.minimumCoverage);
    assert.ok(
      (gate.coveredAccuracy ?? 0) >=
        first.artifact.promotionGate.minimumCoveredAccuracy,
    );
    assert.equal(gate.pairedBaselineComplete, true);
    assert.ok(
      (gate.pairedAccuracyLift ?? Number.NEGATIVE_INFINITY) >=
        first.artifact.promotionGate.minimumPairedAccuracyLift,
    );
  }
  assert.throws(
    () =>
      trainAiResidualLogisticModel({
        examples,
        ...options,
        trainingConfig: { ...options.trainingConfig, l2: 0 },
      }),
    /l2 must be positive/,
  );
});

test("artifact serialization is canonical, frozen, and tamper-evident", () => {
  const trained = trainAiResidualLogisticModel({
    examples: trainingExamples(),
    modelId: "synthetic-roundtrip-model",
    modelVersion: "v1",
    trainingConfig: { epochs: 1_500, learningRate: 0.2, l2: 0.005 },
  });
  const json = canonicalAiResidualLogisticModelJson(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  const loaded = loadAiResidualLogisticModelArtifact(json);
  assert.equal(
    canonicalAiResidualLogisticModelJson(
      loaded as AiResidualLogisticModelArtifact,
    ),
    json,
  );
  assert.equal(Object.isFrozen(loaded), true);
  assert.equal(Object.isFrozen(loaded.heads.upgrade.coefficients), true);

  const tampered = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  (tampered.heads.upgrade.coefficients as number[])[0] += 1;
  assert.match(
    validateAiResidualLogisticModelArtifact(tampered).errors.join("\n"),
    /artifactHash does not match/,
  );

  const forgedGate = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  forgedGate.promotionGate.heads.upgrade.balancedAccuracy = 0.123;
  forgedGate.artifactHash = computeAiResidualLogisticArtifactHash(forgedGate);
  assert.match(
    validateAiResidualLogisticModelArtifact(forgedGate).errors.join("\n"),
    /promotionGate does not match recomputed/,
  );

  const forgedAggregate = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  forgedAggregate.holdoutMetrics.upgrade.balancedAccuracy = 0.123;
  forgedAggregate.artifactHash =
    computeAiResidualLogisticArtifactHash(forgedAggregate);
  assert.match(
    validateAiResidualLogisticModelArtifact(forgedAggregate).errors.join("\n"),
    /derived metrics|aggregated fold metrics/,
  );

  const forgedFold = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  const forgedFoldHead = forgedFold.foldMetrics[0]!.metrics.upgrade;
  assert.ok(forgedFoldHead.truePositive > 0);
  forgedFoldHead.truePositive -= 1;
  forgedFoldHead.falseNegative += 1;
  forgedFoldHead.accuracy = Number(
    (
      (forgedFoldHead.truePositive + forgedFoldHead.trueNegative) /
      forgedFoldHead.examples
    ).toFixed(12),
  );
  forgedFoldHead.positiveRecall = Number(
    (
      forgedFoldHead.truePositive /
      (forgedFoldHead.truePositive + forgedFoldHead.falseNegative)
    ).toFixed(12),
  );
  forgedFoldHead.negativeRecall = Number(
    (
      forgedFoldHead.trueNegative /
      (forgedFoldHead.trueNegative + forgedFoldHead.falsePositive)
    ).toFixed(12),
  );
  forgedFoldHead.balancedAccuracy = Number(
    (
      (forgedFoldHead.positiveRecall + forgedFoldHead.negativeRecall) /
      2
    ).toFixed(12),
  );
  forgedFold.artifactHash = computeAiResidualLogisticArtifactHash(forgedFold);
  assert.match(
    validateAiResidualLogisticModelArtifact(forgedFold).errors.join("\n"),
    /holdoutMetrics do not match aggregated fold metrics/,
  );

  const forgedBvidCounts = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  const firstFoldUpgrade = forgedBvidCounts.foldMetrics[0]!.metrics.upgrade;
  forgedBvidCounts.foldMetrics[0]!.labelBvidCounts.upgrade.positive =
    firstFoldUpgrade.truePositive + firstFoldUpgrade.falseNegative + 1;
  forgedBvidCounts.artifactHash =
    computeAiResidualLogisticArtifactHash(forgedBvidCounts);
  assert.match(
    validateAiResidualLogisticModelArtifact(forgedBvidCounts).errors.join("\n"),
    /labelBvidCounts\.upgrade exceeds label examples/,
  );
});

test("browser-safe provider accepts high confidence and abstains fail-closed", () => {
  assert.equal(
    computeAiResidualBrowserSha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const trained = trainAiResidualLogisticModel({
    examples: trainingExamples(),
    modelId: "synthetic-provider-model",
    modelVersion: "v1",
    trainingConfig: { epochs: 1_500, learningRate: 0.2, l2: 0.005 },
  });
  const low = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    low.heads[kind].intercept = 0;
    (low.heads[kind].coefficients as number[]).fill(0);
  }
  rehash(low);
  const lowPolicy = createAiResidualLogisticPolicy(low, {
    trustedRuntimePayloadHashes: [low.runtimePayloadHash],
  });
  assert.equal(lowPolicy.propose(upgradeContext("balanced", "deferUpgrade", false)), null);

  const high = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    high.heads[kind].intercept = 10;
    (high.heads[kind].coefficients as number[]).fill(0);
  }
  rehash(high);
  assert.throws(
    () =>
      createAiResidualLogisticPolicy(high, {
        trustedRuntimePayloadHashes: [trained.artifact.runtimePayloadHash],
      }),
    /runtimePayloadHash is not in the deployment trust allowlist/,
  );
  const highPolicy = createAiResidualLogisticPolicy(high, {
    trustedRuntimePayloadHashes: [high.runtimePayloadHash],
  });
  const context = upgradeContext("balanced", "deferUpgrade", false);
  assert.equal(highPolicy.propose(context)?.choice, "upgradeNow");
  assert.equal(
    highPolicy.propose({
      ...context,
      legalChoices: ["deferUpgrade"],
    }),
    null,
  );
  assert.equal(
    highPolicy.propose({ ...context, policyVersion: "drifted-policy" }),
    null,
  );

  const staleRuntimeHash = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  staleRuntimeHash.heads.upgrade.coefficients[0] += 0.5;
  staleRuntimeHash.artifactHash =
    computeAiResidualLogisticArtifactHash(staleRuntimeHash);
  assert.match(
    validateAiResidualLogisticRuntimeArtifact(staleRuntimeHash).errors.join("\n"),
    /runtimePayloadHash does not match/,
  );
  assert.equal(
    predictAiResidualLogisticModel(staleRuntimeHash, context),
    null,
  );
  assert.throws(
    () =>
      createAiResidualLogisticPolicy(staleRuntimeHash, {
        trustedRuntimePayloadHashes: [trained.artifact.runtimePayloadHash],
      }),
    /runtimePayloadHash does not match/,
  );

  const forgedRuntimeHash = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  forgedRuntimeHash.runtimePayloadHash = "0".repeat(64);
  forgedRuntimeHash.artifactHash =
    computeAiResidualLogisticArtifactHash(forgedRuntimeHash);
  assert.equal(
    validateAiResidualLogisticRuntimeArtifact(forgedRuntimeHash).valid,
    false,
  );

  const invalidDimension = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  invalidDimension.heads.upgrade.coefficients.pop();
  assert.match(
    validateAiResidualLogisticRuntimeArtifact(invalidDimension).errors.join("\n"),
    /coefficients are invalid/,
  );
  assert.equal(predictAiResidualLogisticModel(invalidDimension, context), null);
  assert.throws(
    () =>
      createAiResidualLogisticPolicy(invalidDimension, {
        trustedRuntimePayloadHashes: [trained.artifact.runtimePayloadHash],
      }),
    /coefficients are invalid/,
  );

  const nonFinite = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  nonFinite.heads.upgrade.coefficients[0] = Number.NaN;
  nonFinite.heads.refresh.intercept = Number.POSITIVE_INFINITY;
  assert.equal(validateAiResidualLogisticRuntimeArtifact(nonFinite).valid, false);
  assert.equal(predictAiResidualLogisticModel(nonFinite, context), null);

  const customArrayPrototype = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.setPrototypeOf(
    customArrayPrototype.heads.upgrade.coefficients,
    Object.create(Array.prototype),
  );
  assert.equal(
    validateAiResidualLogisticRuntimeArtifact(customArrayPrototype).valid,
    false,
  );

  let hiddenArrayGetterReads = 0;
  const hiddenArrayGetter = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.defineProperty(hiddenArrayGetter.heads.upgrade.coefficients, "hidden", {
    enumerable: false,
    get: () => {
      hiddenArrayGetterReads += 1;
      return 1;
    },
  });
  assert.equal(
    validateAiResidualLogisticRuntimeArtifact(hiddenArrayGetter).valid,
    false,
  );
  assert.equal(hiddenArrayGetterReads, 0);

  const symbolArray = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.defineProperty(symbolArray.heads.upgrade.coefficients, Symbol("hidden"), {
    enumerable: true,
    value: 1,
  });
  assert.equal(validateAiResidualLogisticRuntimeArtifact(symbolArray).valid, false);

  const customObjectPrototype = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.setPrototypeOf(
    customObjectPrototype.heads,
    Object.create(Object.prototype),
  );
  assert.equal(
    validateAiResidualLogisticRuntimeArtifact(customObjectPrototype).valid,
    false,
  );

  let hiddenObjectGetterReads = 0;
  const hiddenObjectGetter = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.defineProperty(hiddenObjectGetter, "hidden", {
    enumerable: false,
    get: () => {
      hiddenObjectGetterReads += 1;
      return "forged";
    },
  });
  assert.equal(
    validateAiResidualLogisticRuntimeArtifact(hiddenObjectGetter).valid,
    false,
  );
  assert.equal(hiddenObjectGetterReads, 0);

  const symbolObject = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.defineProperty(symbolObject, Symbol("hidden"), {
    enumerable: true,
    value: "forged",
  });
  assert.equal(validateAiResidualLogisticRuntimeArtifact(symbolObject).valid, false);

  let legalChoiceGetterReads = 0;
  const getterContext = structuredClone(context) as Mutable<AiUpgradeMacroContext>;
  Object.defineProperty(getterContext.legalChoices, "0", {
    configurable: true,
    enumerable: true,
    get: () => {
      legalChoiceGetterReads += 1;
      return "upgradeNow";
    },
  });
  assert.equal(
    predictAiResidualLogisticModel(trained.artifact, getterContext),
    null,
  );
  assert.equal(legalChoiceGetterReads, 0);

  let contextGetterReads = 0;
  const getterObjectContext = structuredClone(
    context,
  ) as Mutable<AiUpgradeMacroContext>;
  Object.defineProperty(getterObjectContext, "contentVersion", {
    configurable: true,
    enumerable: true,
    get: () => {
      contextGetterReads += 1;
      return CURRENT_ROSTER_VERSION;
    },
  });
  assert.equal(
    predictAiResidualLogisticModel(trained.artifact, getterObjectContext),
    null,
  );
  assert.equal(highPolicy.propose(getterObjectContext), null);
  assert.equal(contextGetterReads, 0);

  const scorerDrift = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.assign(scorerDrift, { scorerVersion: 999 });
  assert.match(
    validateAiResidualLogisticRuntimeArtifact(scorerDrift).errors.join("\n"),
    /scorerVersion mismatch/,
  );
  assert.equal(predictAiResidualLogisticModel(scorerDrift, context), null);

  const featureDrift = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  Object.assign(featureDrift, { featureSchemaHash: "0".repeat(64) });
  assert.match(
    validateAiResidualLogisticRuntimeArtifact(featureDrift).errors.join("\n"),
    /featureSchemaHash mismatch/,
  );
  assert.equal(predictAiResidualLogisticModel(featureDrift, context), null);

  const finiteButOverflowing = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  finiteButOverflowing.heads.upgrade.intercept = Number.MAX_VALUE;
  finiteButOverflowing.heads.upgrade.coefficients.fill(0);
  finiteButOverflowing.heads.upgrade.coefficients[0] = Number.MAX_VALUE;
  rehash(finiteButOverflowing);
  assert.equal(
    validateAiResidualLogisticRuntimeArtifact(finiteButOverflowing).valid,
    true,
  );
  assert.equal(
    predictAiResidualLogisticModel(finiteButOverflowing, context),
    null,
  );
});

test("runtime masks all seven profile and legacy-policy conditional slots", () => {
  const trained = trainAiResidualLogisticModel({
    examples: trainingExamples(),
    modelId: "synthetic-profile-model",
    modelVersion: "v1",
    trainingConfig: { epochs: 1_500, learningRate: 0.2, l2: 0.005 },
  });
  const conditioned = mutableArtifact(
    trained.artifact as AiResidualLogisticModelArtifact,
  );
  conditioned.heads.upgrade.intercept = 0;
  (conditioned.heads.upgrade.coefficients as number[]).fill(0);
  AI_RESIDUAL_FEATURE_PROFILE_IDS.forEach((profileId, index) => {
    const featureIndex = conditioned.heads.upgrade.featureNames.indexOf(
      `profile_${profileId}`,
    );
    assert.notEqual(featureIndex, -1);
    (conditioned.heads.upgrade.coefficients as number[])[featureIndex] = index - 3;
  });
  rehash(conditioned);
  const probabilities = AI_RESIDUAL_FEATURE_PROFILE_IDS.map((profileId) =>
    predictAiResidualLogisticModel(
      conditioned,
      upgradeContext(profileId, "deferUpgrade", false),
    )?.positiveProbability,
  );
  assert.equal(probabilities.every((value) => value !== undefined), true);
  for (let index = 1; index < probabilities.length; index += 1) {
    assert.equal(probabilities[index], probabilities[0]);
  }

  const upgradeNow = predictAiResidualLogisticModel(
    conditioned,
    upgradeContext("balanced", "upgradeNow", false),
  );
  const deferUpgrade = predictAiResidualLogisticModel(
    conditioned,
    upgradeContext("balanced", "deferUpgrade", false),
  );
  assert.equal(upgradeNow?.positiveProbability, deferUpgrade?.positiveProbability);

  const neutral = encodeAiResidualSemanticRecord(
    createProfileNeutralAiResidualSemanticRecord({
      kind: "upgrade",
      common: { gold: 5 },
      upgradeCost: 5,
    }),
  );
  assert.equal(featureValue(neutral, "profile_known"), 0);
  for (const profileId of AI_RESIDUAL_FEATURE_PROFILE_IDS) {
    assert.equal(featureValue(neutral, `profile_${profileId}`), 0);
  }
});

test("full diagnostics preserve every kind while runtime masks engine-only fields", () => {
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    const context = contextFor(kind, "tempo", true);
    const snapshot = createFullAiResidualSemanticRecord(context);
    const encoded = encodeAiResidualSemanticRecord(snapshot);
    const runtime = encodeAiResidualMacroContext(context);
    assert.equal(snapshot.kind, kind);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(encoded.values.length, encoded.names.length);
    assert.equal(encoded.values.every(Number.isFinite), true);
    assert.equal(featureValue(runtime, "profile_known"), 0);
    assert.equal(featureValue(runtime, "legacy_choice_known"), 0);
    const engineOnlyKnownFeature =
      kind === "upgrade"
        ? "best_shop_score_known"
        : kind === "refresh"
          ? "affordable_known"
          : "best_minion_score_known";
    assert.equal(featureValue(runtime, engineOnlyKnownFeature), 0);
  }
});
