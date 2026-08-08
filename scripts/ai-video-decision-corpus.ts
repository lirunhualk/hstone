import {
  createProfileNeutralAiResidualSemanticRecord,
  type AiResidualSemanticRecord,
} from "../lib/game/ai-residual-features.ts";
import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";
import type {
  AiFreezeMacroChoice,
  AiRefreshMacroChoice,
  AiResidualMacroKind,
  AiUpgradeMacroChoice,
  DeepReadonly,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_EXPERT_SAMPLE_SCHEMA_VERSION,
  createAiExpertDecisionSample,
  type AiExpertDecisionSample,
  type AiExpertMacroPlan,
} from "./ai-expert-samples.ts";
import {
  AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION,
  createAiResidualVideoExample,
  type AiResidualObservedValue,
  type AiResidualRuntimeCompatibility,
  type AiResidualVideoEvidence,
  type AiResidualVideoTrainingExample,
} from "./ai-residual-video-evidence.ts";
import {
  getAiVideoCorpusSource,
  type AiVideoCorpusSource,
} from "./ai-video-corpus-sources.ts";

export const AI_VIDEO_DECISION_CORPUS_SCHEMA_VERSION = 1 as const;

export interface AiVideoDecisionVisibleState {
  readonly round?: number;
  readonly tavernTier?: number;
  readonly health?: number;
  readonly armor?: number;
  readonly gold?: number;
  readonly boardSize?: number;
  readonly handSize?: number;
  readonly upgradeCost?: number;
  readonly refreshCurrency?: "gold" | "health";
  readonly refreshCost?: number;
  readonly currentlyFrozen?: boolean;
}

export type AiVideoInferredBoundary =
  | {
      readonly kind: "resourceBecameInsufficient";
      readonly before: number;
      readonly after: number;
      readonly required: number;
    }
  | {
      readonly kind: "recruitToCombat";
    };

export interface AiVideoDecisionLabel {
  readonly kind: AiResidualMacroKind;
  readonly choice:
    | AiUpgradeMacroChoice
    | AiRefreshMacroChoice
    | AiFreezeMacroChoice;
  readonly confidence: number;
  /** What on-screen control or state made both macro choices legal. */
  readonly legalStatement: string;
  /** Direct means the chosen macro action itself is visibly executed. */
  readonly evidenceMode: "direct" | "inferred";
  /** Machine-checkable boundary required for inferred negative choices. */
  readonly inferredBoundary?: AiVideoInferredBoundary;
  /** For inferred negatives, explains the explicit mutually exclusive boundary. */
  readonly interpretation: string;
}

export interface AiVideoDecisionWindow {
  readonly schemaVersion: typeof AI_VIDEO_DECISION_CORPUS_SCHEMA_VERSION;
  readonly windowId: string;
  readonly bvid: string;
  readonly startMs: number;
  readonly decisionMs: number;
  readonly endMs: number;
  readonly reviewedBy: string;
  readonly chosenPlan: AiExpertMacroPlan;
  readonly stateStatement: string;
  readonly actionStatement: string;
  readonly reviewRationale: string;
  readonly visible: AiVideoDecisionVisibleState;
  readonly labels: readonly AiVideoDecisionLabel[];
}

export interface AiVideoDecisionCorpus {
  readonly expertSamples: readonly DeepReadonly<AiExpertDecisionSample>[];
  readonly trainingExamples: readonly DeepReadonly<AiResidualVideoTrainingExample>[];
}

const COMMON_CANDIDATE_PLANS = Object.freeze([
  "tempo",
  "normalLevel",
  "refresh",
  "endTurn",
] as const satisfies readonly AiExpertMacroPlan[]);

function assertSafeTimestamp(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
}

function choiceMatchesKind(label: AiVideoDecisionLabel): boolean {
  switch (label.kind) {
    case "upgrade":
      return label.choice === "upgradeNow" || label.choice === "deferUpgrade";
    case "refresh":
      return label.choice === "refreshOnce" || label.choice === "stopRefreshing";
    case "freeze":
      return label.choice === "freeze" || label.choice === "unfreeze";
  }
}

function validateInferredNegativeBoundary(
  windowId: string,
  label: AiVideoDecisionLabel,
): void {
  const isInferredNegative =
    label.evidenceMode === "inferred" &&
    (label.choice === "deferUpgrade" ||
      label.choice === "stopRefreshing" ||
      label.choice === "unfreeze");
  if (!isInferredNegative) return;

  const boundary = label.inferredBoundary;
  if (!boundary) {
    throw new TypeError(
      `${windowId} ${label.kind} inferred negative requires a structured boundary`,
    );
  }
  if (label.choice === "unfreeze") {
    if (boundary.kind !== "recruitToCombat") {
      throw new TypeError(
        `${windowId} freeze/unfreeze requires a recruitToCombat boundary`,
      );
    }
    return;
  }
  if (boundary.kind !== "resourceBecameInsufficient") {
    throw new TypeError(
      `${windowId} ${label.kind}/${label.choice} requires a resourceBecameInsufficient boundary`,
    );
  }
  assertSafeTimestamp(boundary.before, `${windowId}.${label.kind}.boundary.before`);
  assertSafeTimestamp(boundary.after, `${windowId}.${label.kind}.boundary.after`);
  assertSafeTimestamp(
    boundary.required,
    `${windowId}.${label.kind}.boundary.required`,
  );
  if (
    boundary.required === 0 ||
    boundary.before < boundary.required ||
    boundary.after >= boundary.required
  ) {
    throw new RangeError(
      `${windowId} ${label.kind}/${label.choice} boundary must cross from legal to insufficient`,
    );
  }
}

function requireCompatibleSource(window: AiVideoDecisionWindow): Readonly<AiVideoCorpusSource> {
  const source = getAiVideoCorpusSource(window.bvid);
  if (!source) throw new TypeError(`unregistered BVID ${window.bvid}`);
  if (
    !source.runtimeCompatible ||
    (source.sourcePatch !== "35.4.2" &&
      source.sourcePatch !== "36.0" &&
      source.sourcePatch !== "36.0.3")
  ) {
    throw new TypeError(`${window.bvid} is evidence-only for the current runtime`);
  }
  return source;
}

function validateWindow(
  window: AiVideoDecisionWindow,
  source: Readonly<AiVideoCorpusSource>,
): void {
  if (window.schemaVersion !== AI_VIDEO_DECISION_CORPUS_SCHEMA_VERSION) {
    throw new TypeError(`${window.windowId} has an unsupported schema version`);
  }
  if (!/^[a-z0-9][a-z0-9._:-]{2,127}$/.test(window.windowId)) {
    throw new TypeError(`invalid video window id ${window.windowId}`);
  }
  assertSafeTimestamp(window.startMs, `${window.windowId}.startMs`);
  assertSafeTimestamp(window.decisionMs, `${window.windowId}.decisionMs`);
  assertSafeTimestamp(window.endMs, `${window.windowId}.endMs`);
  if (
    window.startMs > window.decisionMs ||
    window.decisionMs > window.endMs ||
    window.endMs > source.durationSeconds * 1_000
  ) {
    throw new RangeError(`${window.windowId} has an invalid video interval`);
  }
  if (window.reviewedBy.trim().length < 3) {
    throw new TypeError(`${window.windowId} requires a named reviewer`);
  }
  if (
    window.stateStatement.trim().length < 10 ||
    window.actionStatement.trim().length < 10 ||
    window.reviewRationale.trim().length < 10
  ) {
    throw new TypeError(`${window.windowId} lacks review evidence`);
  }
  if (
    !(COMMON_CANDIDATE_PLANS as readonly AiExpertMacroPlan[]).includes(
      window.chosenPlan,
    )
  ) {
    throw new TypeError(`${window.windowId} has an invalid chosen plan`);
  }
  if (window.labels.length === 0) {
    throw new TypeError(`${window.windowId} requires at least one macro label`);
  }
  const kinds = new Set<AiResidualMacroKind>();
  for (const label of window.labels) {
    if (kinds.has(label.kind)) {
      throw new TypeError(`${window.windowId} duplicates ${label.kind}`);
    }
    kinds.add(label.kind);
    if (!choiceMatchesKind(label)) {
      throw new TypeError(`${window.windowId} has a mismatched ${label.kind} choice`);
    }
    if (!Number.isFinite(label.confidence) || label.confidence < 0.9 || label.confidence > 1) {
      throw new TypeError(`${window.windowId} ${label.kind} confidence must be 0.90 to 1.00`);
    }
    if (
      label.legalStatement.trim().length < 10 ||
      label.interpretation.trim().length < 10
    ) {
      throw new TypeError(`${window.windowId} ${label.kind} lacks cited reasoning`);
    }
    validateInferredNegativeBoundary(window.windowId, label);
  }
}

function visibleObservation(visible: AiVideoDecisionVisibleState): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(visible).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );
}

function observed<Value>(value: Value): AiResidualObservedValue<Value> {
  return Object.freeze({ value, screenFactIds: Object.freeze(["fact-visible-state"]) });
}

function commonEvidenceVisible(visible: AiVideoDecisionVisibleState) {
  return {
    ...(visible.round === undefined ? {} : { round: observed(visible.round) }),
    ...(visible.tavernTier === undefined
      ? {}
      : { tavernTier: observed(visible.tavernTier) }),
    ...(visible.health === undefined ? {} : { health: observed(visible.health) }),
    ...(visible.armor === undefined ? {} : { armor: observed(visible.armor) }),
    ...(visible.gold === undefined ? {} : { gold: observed(visible.gold) }),
    ...(visible.boardSize === undefined
      ? {}
      : { boardSize: observed(visible.boardSize) }),
    ...(visible.handSize === undefined
      ? {}
      : { handSize: observed(visible.handSize) }),
  };
}

function evidenceForLabel(
  sample: DeepReadonly<AiExpertDecisionSample>,
  window: AiVideoDecisionWindow,
  label: AiVideoDecisionLabel,
): AiResidualVideoEvidence {
  const base = {
    schemaVersion: AI_RESIDUAL_VIDEO_EVIDENCE_SCHEMA_VERSION,
    expertSampleHash: sample.canonicalHash,
    choiceEvidenceId:
      label.evidenceMode === "direct"
        ? "fact-visible-action"
        : `inference-${label.kind}`,
    legalChoiceFactIds: [`fact-legal-${label.kind}`],
  } as const;
  const common = commonEvidenceVisible(window.visible);
  switch (label.kind) {
    case "upgrade":
      return {
        ...base,
        kind: "upgrade",
        choice: label.choice as AiUpgradeMacroChoice,
        visible: {
          ...common,
          ...(window.visible.upgradeCost === undefined
            ? {}
            : { upgradeCost: observed(window.visible.upgradeCost) }),
        },
      };
    case "refresh":
      return {
        ...base,
        kind: "refresh",
        choice: label.choice as AiRefreshMacroChoice,
        visible: {
          ...common,
          ...(window.visible.refreshCurrency === undefined
            ? {}
            : { refreshCurrency: observed(window.visible.refreshCurrency) }),
          ...(window.visible.refreshCost === undefined
            ? {}
            : { refreshCost: observed(window.visible.refreshCost) }),
        },
      };
    case "freeze":
      return {
        ...base,
        kind: "freeze",
        choice: label.choice as AiFreezeMacroChoice,
        visible: {
          ...common,
          ...(window.visible.currentlyFrozen === undefined
            ? {}
            : { currentlyFrozen: observed(window.visible.currentlyFrozen) }),
        },
      };
  }
}

function compatibilityFor(
  source: Readonly<AiVideoCorpusSource>,
  reviewedBy: string,
): AiResidualRuntimeCompatibility {
  if (
    source.sourcePatch !== "35.4.2" &&
    source.sourcePatch !== "36.0" &&
    source.sourcePatch !== "36.0.3"
  ) {
    throw new TypeError(`${source.bvid} cannot be used for current training`);
  }
  return {
    compatible: true,
    reviewedBy,
    reviewedMediaSha256: source.reviewedMediaSha256,
    reason: source.compatibilityReason,
    sourcePatch: source.sourcePatch,
    targetContentVersion: CURRENT_ROSTER_VERSION,
  };
}

function buildWindow(window: AiVideoDecisionWindow): {
  readonly sample: DeepReadonly<AiExpertDecisionSample>;
  readonly examples: readonly DeepReadonly<AiResidualVideoTrainingExample>[];
} {
  const source = requireCompatibleSource(window);
  validateWindow(window, source);
  const confidence = Math.min(...window.labels.map((label) => label.confidence));
  const inferredLabels = window.labels.filter(
    (label) => label.evidenceMode === "inferred",
  );
  const sample = createAiExpertDecisionSample({
    schemaVersion: AI_EXPERT_SAMPLE_SCHEMA_VERSION,
    sampleId: `video-${window.windowId}`,
    contentVersion: CURRENT_ROSTER_VERSION,
    patchVersion: source.sourcePatch,
    source: {
      platform: "bilibili",
      bvid: source.bvid,
      timestampMs: window.decisionMs,
    },
    observation: {
      phase: "recruit",
      window: {
        startMs: window.startMs,
        decisionMs: window.decisionMs,
        endMs: window.endMs,
      },
      visible: visibleObservation(window.visible),
    },
    candidatePlans: [...COMMON_CANDIDATE_PLANS],
    chosenPlan: window.chosenPlan,
    screenFacts: [
      {
        id: "fact-visible-state",
        kind: "screenFact",
        statement: window.stateStatement,
        evidenceType: "visibleStat",
      },
      {
        id: "fact-visible-action",
        kind: "screenFact",
        statement: window.actionStatement,
        evidenceType: "visibleAction",
      },
      ...window.labels.map((label) => ({
        id: `fact-legal-${label.kind}`,
        kind: "screenFact" as const,
        statement: label.legalStatement,
        evidenceType: "visibleText" as const,
      })),
    ],
    engineeringInferences:
      inferredLabels.length > 0
        ? inferredLabels.map((label) => ({
            id: `inference-${label.kind}`,
            kind: "engineeringInference" as const,
            statement: label.interpretation,
            basedOnFactIds: [
              "fact-visible-action",
              `fact-legal-${label.kind}`,
            ],
            confidence: label.confidence,
          }))
        : [
            {
              id: "inference-plan",
              kind: "engineeringInference" as const,
              statement: `可见动作直接支持${window.chosenPlan}宏观计划标签。`,
              basedOnFactIds: ["fact-visible-action"],
              confidence,
            },
          ],
    labelConfidence: {
      level: "high",
      score: confidence,
      rationale: window.reviewRationale,
    },
  });
  const runtimeCompatibility = compatibilityFor(source, window.reviewedBy);
  const examples = window.labels.map((label) =>
    createAiResidualVideoExample({
      expertSample: sample as AiExpertDecisionSample,
      evidence: evidenceForLabel(sample, window, label),
      runtimeCompatibility,
    }),
  );
  return Object.freeze({ sample, examples: Object.freeze(examples) });
}

export function buildAiVideoDecisionCorpus(
  windows: readonly AiVideoDecisionWindow[],
): DeepReadonly<AiVideoDecisionCorpus> {
  const windowIds = new Set<string>();
  const sampleHashes = new Set<string>();
  const exampleHashes = new Set<string>();
  const expertSamples: DeepReadonly<AiExpertDecisionSample>[] = [];
  const trainingExamples: DeepReadonly<AiResidualVideoTrainingExample>[] = [];
  for (const window of windows) {
    if (windowIds.has(window.windowId)) {
      throw new TypeError(`duplicate video window id ${window.windowId}`);
    }
    windowIds.add(window.windowId);
    const built = buildWindow(window);
    if (sampleHashes.has(built.sample.canonicalHash)) {
      throw new TypeError(`duplicate expert sample ${window.windowId}`);
    }
    sampleHashes.add(built.sample.canonicalHash);
    expertSamples.push(built.sample);
    for (const example of built.examples) {
      if (exampleHashes.has(example.canonicalHash)) {
        throw new TypeError(`duplicate residual example ${example.exampleId}`);
      }
      exampleHashes.add(example.canonicalHash);
      trainingExamples.push(example);
    }
  }
  return Object.freeze({
    expertSamples: Object.freeze(expertSamples),
    trainingExamples: Object.freeze(trainingExamples),
  });
}

export function semanticRecordForVideoWindow(
  window: AiVideoDecisionWindow,
  kind: AiResidualMacroKind,
): DeepReadonly<AiResidualSemanticRecord> {
  const common = {
    round: window.visible.round,
    tavernTier: window.visible.tavernTier,
    health: window.visible.health,
    armor: window.visible.armor,
    gold: window.visible.gold,
    boardSize: window.visible.boardSize,
    handSize: window.visible.handSize,
  };
  switch (kind) {
    case "upgrade":
      return createProfileNeutralAiResidualSemanticRecord({
        kind,
        common,
        upgradeCost: window.visible.upgradeCost,
      });
    case "refresh":
      return createProfileNeutralAiResidualSemanticRecord({
        kind,
        common,
        refreshCurrency: window.visible.refreshCurrency,
        refreshCost: window.visible.refreshCost,
      });
    case "freeze":
      return createProfileNeutralAiResidualSemanticRecord({
        kind,
        common,
        currentlyFrozen: window.visible.currentlyFrozen,
      });
  }
}
