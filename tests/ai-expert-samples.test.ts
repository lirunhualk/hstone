import assert from "node:assert/strict";
import test from "node:test";
import type {
  AiTrainingObservation,
} from "../lib/game/ai-training.ts";
import {
  AI_EXPERT_SAMPLE_SCHEMA_VERSION,
  canonicalAiExpertSampleJson,
  computeAiExpertSampleCanonicalHash,
  createAiExpertDecisionSample,
  type AiExpertPublicObservation,
  type AiExpertSampleValidationCode,
  type AiExpertSampleValidationResult,
  type CreateAiExpertDecisionSampleInput,
  validateAiExpertDecisionSample,
  validateAiExpertDecisionSampleBatch,
} from "../scripts/ai-expert-samples.ts";

// These fixtures are validator-only synthetic data, not claims about a video.
function syntheticInput(): CreateAiExpertDecisionSampleInput {
  return {
    schemaVersion: AI_EXPERT_SAMPLE_SCHEMA_VERSION,
    sampleId: "synthetic-validator-sample-001",
    contentVersion: "synthetic-content-v1",
    patchVersion: "36.0.3",
    source: {
      platform: "bilibili",
      bvid: "BV1Ab411c7De",
      timestampMs: 123_000,
    },
    observation: {
      schemaVersion: 1,
      controlledSeat: 0,
      public: {
        phase: "recruit",
        round: 7,
        aliveSeats: [0, 1, 2, 3, 4],
        heroes: [
          { seat: 0, heroId: "synthetic-hero", health: 23, armor: 0 },
        ],
        lastRoundResult: { result: "loss", damageTaken: 8 },
      },
      own: {
        tavernTier: 4,
        gold: 8,
        board: [
          {
            definitionId: "synthetic-visible-minion",
            attack: 8,
            health: 9,
          },
        ],
        hand: [],
        shop: [],
      },
      scoutingReports: [],
    },
    candidatePlans: ["tempo", "normalLevel", "refresh"],
    chosenPlan: "tempo",
    screenFacts: [
      {
        id: "fact-health-tier",
        kind: "screenFact",
        statement: "画面显示玩家为23点生命且酒馆等级为4。",
        evidenceType: "visibleStat",
      },
      {
        id: "fact-action",
        kind: "screenFact",
        statement: "画面中的实际操作是购买当前酒馆随从。",
        evidenceType: "visibleAction",
      },
    ],
    engineeringInferences: [
      {
        id: "inference-label",
        kind: "engineeringInference",
        statement: "生命压力和购买动作共同支持稳场宏观标签。",
        basedOnFactIds: ["fact-health-tier", "fact-action"],
        confidence: 0.88,
      },
    ],
    labelConfidence: {
      level: "high",
      score: 0.9,
      rationale: "关键数值与实际动作在同一时间点清晰可见。",
    },
  };
}

function issueCodes(
  result: AiExpertSampleValidationResult,
): Set<AiExpertSampleValidationCode> {
  return new Set(result.issues.map((issue) => issue.code));
}

function rehash(record: Record<string, unknown>): void {
  record.canonicalHash = computeAiExpertSampleCanonicalHash(record);
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value as Record<string, unknown>).forEach(assertDeepFrozen);
}

test("full AiTrainingObservation shape is accepted by the public observation type", () => {
  type FullObservationIsAccepted =
    AiTrainingObservation extends AiExpertPublicObservation ? true : false;
  const compatible: FullObservationIsAccepted = true;
  assert.equal(compatible, true);
});

test("expert sample creation is canonical, immutable, and batch-valid", () => {
  const input = syntheticInput();
  const sample = createAiExpertDecisionSample(input);
  const validation = validateAiExpertDecisionSample(sample);
  assert.equal(validation.valid, true, JSON.stringify(validation.issues));
  assert.equal(
    computeAiExpertSampleCanonicalHash(sample),
    sample.canonicalHash,
  );
  assert.match(sample.canonicalHash, /^[0-9a-f]{64}$/);
  assert.equal(validateAiExpertDecisionSampleBatch([sample]).valid, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(sample)),
    sample,
  );
  assertDeepFrozen(sample);

  const reversedEntries = Object.fromEntries(
    Object.entries(sample).reverse(),
  );
  assert.equal(
    computeAiExpertSampleCanonicalHash(reversedEntries),
    sample.canonicalHash,
  );
  assert.equal(
    canonicalAiExpertSampleJson({ b: 2, a: 1 }),
    '{"a":1,"b":2}',
  );

  input.candidatePlans.push("endTurn");
  assert.deepEqual(sample.candidatePlans, [
    "tempo",
    "normalLevel",
    "refresh",
  ]);
  assert.throws(() => {
    (sample.candidatePlans as string[]).pop();
  }, TypeError);
});

test("validator rejects invalid video coordinates and macro choices", () => {
  const invalid = structuredClone(
    createAiExpertDecisionSample(syntheticInput()),
  ) as unknown as Record<string, unknown>;
  invalid.sampleId = "Invalid ID";
  invalid.patchVersion = "current";
  const source = invalid.source as Record<string, unknown>;
  source.bvid = "av123";
  source.timestampMs = -1;
  invalid.candidatePlans = [];
  invalid.chosenPlan = "pivot";
  rehash(invalid);

  const codes = issueCodes(validateAiExpertDecisionSample(invalid));
  assert.equal(codes.has("invalid_sample_id"), true);
  assert.equal(codes.has("invalid_patch_version"), true);
  assert.equal(codes.has("invalid_bvid"), true);
  assert.equal(codes.has("invalid_timestamp"), true);
  assert.equal(codes.has("missing_candidates"), true);
  assert.equal(codes.has("choice_not_candidate"), true);
  assert.equal(codes.has("hash_mismatch"), false);
});

test("validator recursively rejects private runtime observation fields", () => {
  const invalid = structuredClone(
    createAiExpertDecisionSample(syntheticInput()),
  ) as unknown as Record<string, unknown>;
  invalid.observation = {
    public: {
      round: 5,
      lastRoundResult: { result: "win" },
    },
    own: {
      safeCard: {
        definitionId: "public-card-definition",
        sourceInstanceId: "runtime-instance-secret",
      },
    },
    nested: {
      seed: 1234,
      pool: { privateCount: 9 },
      spellPool: { privateCount: 4 },
      lastRoundBattles: [{ events: [] }],
    },
  };
  rehash(invalid);

  const validation = validateAiExpertDecisionSample(invalid);
  const forbidden = validation.issues.filter(
    (issue) => issue.code === "forbidden_observation_key",
  );
  assert.equal(validation.valid, false);
  assert.ok(forbidden.length >= 5);
  assert.equal(
    forbidden.some((issue) =>
      issue.path.endsWith("sourceInstanceId"),
    ),
    true,
  );
  assert.equal(
    forbidden.some((issue) => issue.path.endsWith("seed")),
    true,
  );
});

test("facts and engineering inferences cannot be interchanged", () => {
  const invalid = structuredClone(
    createAiExpertDecisionSample(syntheticInput()),
  ) as unknown as Record<string, unknown>;
  invalid.screenFacts = [
    {
      id: "fact-disguised-inference",
      kind: "screenFact",
      statement: "推测这是快速升本策略。",
      evidenceType: "visibleAction",
    },
    {
      id: "fact-wrong-kind",
      kind: "engineeringInference",
      statement: "画面显示玩家点击了升级按钮。",
      evidenceType: "visibleAction",
    },
  ];
  invalid.engineeringInferences = [
    {
      id: "inference-missing-basis",
      kind: "engineeringInference",
      statement: "该行为映射为快速升本。",
      basedOnFactIds: ["fact-not-present"],
      confidence: 0.7,
    },
  ];
  rehash(invalid);

  const codes = issueCodes(validateAiExpertDecisionSample(invalid));
  assert.equal(codes.has("inference_in_fact"), true);
  assert.equal(codes.has("misclassified_fact"), true);
  assert.equal(codes.has("unknown_fact_reference"), true);
});

test("batch validator rejects duplicate sample IDs and canonical hashes", () => {
  const sample = createAiExpertDecisionSample(syntheticInput());
  const duplicate = structuredClone(sample);
  const validation = validateAiExpertDecisionSampleBatch([
    sample,
    duplicate,
  ]);
  const codes = issueCodes(validation);
  assert.equal(validation.valid, false);
  assert.equal(codes.has("duplicate_sample_id"), true);
  assert.equal(codes.has("duplicate_hash"), true);
});

test("payload changes invalidate a previously computed canonical hash", () => {
  const sample = structuredClone(
    createAiExpertDecisionSample(syntheticInput()),
  ) as unknown as Record<string, unknown>;
  sample.chosenPlan = "normalLevel";
  const validation = validateAiExpertDecisionSample(sample);
  assert.equal(issueCodes(validation).has("hash_mismatch"), true);
});
