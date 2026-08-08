import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_VIDEO_DECISION_CORPUS_SCHEMA_VERSION,
  buildAiVideoDecisionCorpus,
  semanticRecordForVideoWindow,
  type AiVideoDecisionWindow,
} from "../scripts/ai-video-decision-corpus.ts";
import { validateAiResidualVideoTrainingExample } from "../scripts/ai-residual-video-evidence.ts";
import { getAiVideoCorpusSource } from "../scripts/ai-video-corpus-sources.ts";

function fixture(): AiVideoDecisionWindow {
  return {
    schemaVersion: AI_VIDEO_DECISION_CORPUS_SCHEMA_VERSION,
    windowId: "bv16q3z66euu-288200-upgrade",
    bvid: "BV16q3z66Euu",
    startMs: 288_200,
    decisionMs: 289_100,
    endMs: 290_000,
    reviewedBy: "synthetic-corpus-test",
    chosenPlan: "normalLevel",
    stateStatement:
      "画面显示回合6、等级4、8金币、19生命0护甲、场上6个随从和7张手牌。",
    actionStatement: "画面明确点击酒馆升级，金币归零且酒馆升到等级5。",
    reviewRationale: "升级动作、费用、前后金币和酒馆等级在连续帧中均清晰可见。",
    visible: {
      round: 6,
      tavernTier: 4,
      gold: 8,
      health: 19,
      armor: 0,
      boardSize: 6,
      handSize: 7,
      upgradeCost: 8,
      refreshCurrency: "gold",
      refreshCost: 1,
      currentlyFrozen: false,
    },
    labels: [
      {
        kind: "upgrade",
        choice: "upgradeNow",
        confidence: 0.99,
        legalStatement: "升级按钮显示费用8且玩家拥有8金币，升级与延后均为合法选择。",
        evidenceMode: "direct",
        interpretation: "可见点击和升级结果直接支持立即升级标签。",
      },
      {
        kind: "refresh",
        choice: "stopRefreshing",
        confidence: 0.98,
        legalStatement: "刷新按钮显示费用1且玩家拥有8金币，刷新原本合法。",
        evidenceMode: "inferred",
        inferredBoundary: {
          kind: "resourceBecameInsufficient",
          before: 8,
          after: 0,
          required: 1,
        },
        interpretation: "玩家明确花尽金币升级且商店未重掷，因此该边界标为停止刷新。",
      },
    ],
  };
}

test("decision windows compile into immutable source-bound training examples", () => {
  const corpus = buildAiVideoDecisionCorpus([fixture()]);
  assert.equal(corpus.expertSamples.length, 1);
  assert.equal(corpus.trainingExamples.length, 2);
  assert.equal(Object.isFrozen(corpus), true);
  assert.equal(Object.isFrozen(corpus.trainingExamples), true);
  for (const example of corpus.trainingExamples) {
    assert.equal(validateAiResidualVideoTrainingExample(example).valid, true);
    assert.equal(example.bvid, "BV16q3z66Euu");
    assert.equal(
      example.runtimeCompatibility.reviewedMediaSha256,
      getAiVideoCorpusSource(example.bvid)?.reviewedMediaSha256,
    );
    assert.equal(example.semanticRecord.profileId.known, false);
    assert.equal(example.semanticRecord.legacyChoice.known, false);
  }
  assert.equal(corpus.trainingExamples[0]?.choice, "upgradeNow");
  assert.equal(corpus.trainingExamples[1]?.choice, "stopRefreshing");
});

test("decision corpus rejects evidence-only sources and duplicate windows", () => {
  const valid = fixture();
  assert.throws(
    () =>
      buildAiVideoDecisionCorpus([
        valid,
        { ...valid, bvid: "BV1mvuH6cENp" },
      ]),
    /duplicate video window id/,
  );
  assert.throws(
    () =>
      buildAiVideoDecisionCorpus([
        { ...valid, windowId: "season14-evidence-only", bvid: "BV1mvuH6cENp" },
      ]),
    /evidence-only/,
  );
});

test("inferred negative labels require a strict machine-checkable boundary", () => {
  const valid = fixture();
  const inferredRefresh = valid.labels[1];
  assert.ok(inferredRefresh);

  assert.throws(
    () =>
      buildAiVideoDecisionCorpus([
        {
          ...valid,
          windowId: "missing-inferred-boundary",
          labels: [{ ...inferredRefresh, inferredBoundary: undefined }],
        },
      ]),
    /requires a structured boundary/,
  );
  assert.throws(
    () =>
      buildAiVideoDecisionCorpus([
        {
          ...valid,
          windowId: "non-crossing-resource-boundary",
          labels: [
            {
              ...inferredRefresh,
              inferredBoundary: {
                kind: "resourceBecameInsufficient",
                before: 8,
                after: 7,
                required: 1,
              },
            },
          ],
        },
      ]),
    /must cross from legal to insufficient/,
  );
  assert.throws(
    () =>
      buildAiVideoDecisionCorpus([
        {
          ...valid,
          windowId: "wrong-unfreeze-boundary",
          labels: [
            {
              kind: "freeze",
              choice: "unfreeze",
              confidence: 0.99,
              legalStatement: "冻结按钮为0费且商店未冻结，冻结原本合法。",
              evidenceMode: "inferred",
              inferredBoundary: {
                kind: "resourceBecameInsufficient",
                before: 1,
                after: 0,
                required: 1,
              },
              interpretation: "商店未冻结并明确进入战斗，因此该回合选择不冻结。",
            },
          ],
        },
      ]),
    /requires a recruitToCombat boundary/,
  );
});

test("semantic projection never invents hidden runtime fields", () => {
  const record = semanticRecordForVideoWindow(fixture(), "upgrade");
  assert.equal(record.kind, "upgrade");
  if (record.kind !== "upgrade") {
    assert.fail("expected an upgrade semantic record");
  }
  assert.equal(record.round.known, true);
  assert.equal(record.upgradeCost.known, true);
  assert.equal(record.profileId.known, false);
  assert.equal(record.bestShopScore.known, false);
  assert.equal(record.legacyChoice.known, false);
});
