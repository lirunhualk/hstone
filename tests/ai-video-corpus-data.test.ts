import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_VIDEO_CORPUS_DOUBLE_REVIEWER,
  AI_VIDEO_CORPUS_REVIEWER,
  AI_VIDEO_CORPUS_SECOND_REVIEWER,
  AI_VIDEO_DECISION_CORPUS,
  AI_VIDEO_DECISION_WINDOWS,
  AI_VIDEO_EXPERT_SAMPLES,
  AI_VIDEO_TRAINING_EXAMPLES,
} from "../scripts/ai-video-corpus-data.ts";
import { validateAiResidualVideoTrainingExample } from "../scripts/ai-residual-video-evidence.ts";
import { getAiVideoCorpusSource } from "../scripts/ai-video-corpus-sources.ts";

function countsBy<Value extends string>(values: readonly Value[]) {
  return Object.fromEntries(
    [...values]
      .sort()
      .map((value, index, sorted) => [
        value,
        index === 0 || sorted[index - 1] !== value
          ? sorted.lastIndexOf(value) - index + 1
          : 0,
      ])
      .filter(([, count]) => count !== 0),
  );
}

test("reviewed corpus has the expected source, head, and choice distribution", () => {
  assert.equal(AI_VIDEO_DECISION_CORPUS.expertSamples, AI_VIDEO_EXPERT_SAMPLES);
  assert.equal(AI_VIDEO_DECISION_CORPUS.trainingExamples, AI_VIDEO_TRAINING_EXAMPLES);
  assert.equal(AI_VIDEO_DECISION_WINDOWS.length, 60);
  assert.equal(AI_VIDEO_EXPERT_SAMPLES.length, 60);
  assert.equal(AI_VIDEO_TRAINING_EXAMPLES.length, 64);

  assert.deepEqual(
    countsBy(AI_VIDEO_DECISION_WINDOWS.map((window) => window.bvid)),
    {
      BV11BNb6qEgy: 9,
      BV16q3z66Euu: 7,
      BV1FvNR6iEEP: 9,
      BV1GCNT6REBk: 9,
      BV1TPN26RETm: 11,
      BV1w9Ti6tEMq: 9,
      BV1y1VD6DEj7: 6,
    },
  );
  assert.deepEqual(
    countsBy(AI_VIDEO_TRAINING_EXAMPLES.map((example) => example.bvid)),
    {
      BV11BNb6qEgy: 9,
      BV16q3z66Euu: 9,
      BV1FvNR6iEEP: 9,
      BV1GCNT6REBk: 9,
      BV1TPN26RETm: 13,
      BV1w9Ti6tEMq: 9,
      BV1y1VD6DEj7: 6,
    },
  );
  assert.deepEqual(
    countsBy(AI_VIDEO_TRAINING_EXAMPLES.map((example) => example.kind)),
    { freeze: 21, refresh: 21, upgrade: 22 },
  );
  assert.deepEqual(
    countsBy(AI_VIDEO_TRAINING_EXAMPLES.map((example) => example.choice)),
    {
      deferUpgrade: 10,
      freeze: 10,
      refreshOnce: 11,
      stopRefreshing: 10,
      unfreeze: 11,
      upgradeNow: 12,
    },
  );
});

test("every example is bound to its registered reviewed media hash", () => {
  const validReviewers = new Set<string>([
    AI_VIDEO_CORPUS_REVIEWER,
    AI_VIDEO_CORPUS_DOUBLE_REVIEWER,
  ]);
  const samplesByHash = new Map(
    AI_VIDEO_EXPERT_SAMPLES.map((sample) => [sample.canonicalHash, sample]),
  );

  for (const example of AI_VIDEO_TRAINING_EXAMPLES) {
    const source = getAiVideoCorpusSource(example.bvid);
    assert.ok(source, `missing registered source ${example.bvid}`);
    assert.equal(source.runtimeCompatible, true);
    assert.notEqual(source.sourcePatch, "36.2");
    assert.equal(
      example.runtimeCompatibility.reviewedMediaSha256,
      source.reviewedMediaSha256,
    );
    assert.equal(
      example.runtimeCompatibility.sourcePatch,
      source.sourcePatch,
    );
    assert.equal(
      example.runtimeCompatibility.targetContentVersion,
      source.targetContentVersion,
    );
    assert.equal(
      example.runtimeCompatibility.reason,
      source.compatibilityReason,
    );
    assert.equal(example.runtimeCompatibility.compatible, true);
    assert.ok(validReviewers.has(example.runtimeCompatibility.reviewedBy));
    assert.equal(validateAiResidualVideoTrainingExample(example).valid, true);

    const sample = samplesByHash.get(example.expertSampleHash);
    assert.ok(sample, `missing expert sample ${example.expertSampleHash}`);
    assert.equal(sample.source.bvid, example.bvid);
    assert.equal(sample.patchVersion, source.sourcePatch);
    assert.notEqual(sample.patchVersion, "36.2");
  }
});

test("negative labels keep an explicit inferred boundary and serialized data has no local paths", () => {
  const negativeChoices = new Set([
    "deferUpgrade",
    "stopRefreshing",
    "unfreeze",
  ]);
  for (const window of AI_VIDEO_DECISION_WINDOWS) {
    assert.ok(
      window.reviewedBy === AI_VIDEO_CORPUS_REVIEWER ||
        window.reviewedBy === AI_VIDEO_CORPUS_DOUBLE_REVIEWER,
    );
    for (const label of window.labels) {
      assert.ok(label.confidence >= 0.9);
      if (negativeChoices.has(label.choice)) {
        assert.equal(label.evidenceMode, "inferred");
        assert.ok(window.actionStatement.length >= 10);
        assert.ok(label.interpretation.length >= 10);
      }
    }
  }

  const serialized = JSON.stringify({
    reviewer: AI_VIDEO_CORPUS_REVIEWER,
    windows: AI_VIDEO_DECISION_WINDOWS,
    corpus: AI_VIDEO_DECISION_CORPUS,
  });
  assert.doesNotMatch(
    serialized,
    /(?:[A-Za-z]:\\|\\Users\\|\/Users\/|AppData|hstone-ai-video-corpus)/iu,
  );
  assert.doesNotMatch(serialized, /"36\.2"/u);
});

test("independent second review is preserved for every retained partial-pass window", () => {
  const doubleReviewedWindowIds = AI_VIDEO_DECISION_WINDOWS.filter(
    (window) => window.reviewedBy === AI_VIDEO_CORPUS_DOUBLE_REVIEWER,
  ).map((window) => window.windowId);

  assert.equal(
    AI_VIDEO_CORPUS_DOUBLE_REVIEWER,
    `${AI_VIDEO_CORPUS_REVIEWER};${AI_VIDEO_CORPUS_SECOND_REVIEWER}`,
  );
  assert.deepEqual(doubleReviewedWindowIds, [
    "bv16q3z66euu-289100-upgrade",
    "bv16q3z66euu-1019600-refresh",
    "bv1tpn26retm-209200-freeze",
    "bv1tpn26retm-216250-buy-over-upgrade",
    "bv1tpn26retm-329500-upgrade",
    "bv1tpn26retm-603250-refresh",
    "bv1y1vd6dej7-061375-buy-over-refresh",
    "bv1y1vd6dej7-132688-action-over-upgrade",
    "bv1y1vd6dej7-144688-spell-over-refresh",
    "bv1y1vd6dej7-171875-buy-over-refresh",
    "bv1y1vd6dej7-289125-action-over-upgrade",
    "bv1y1vd6dej7-305250-spell-over-upgrade",
  ]);
});
