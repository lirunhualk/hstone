import assert from "node:assert/strict";
import test from "node:test";

import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";
import {
  AI_RUNTIME_COMPATIBLE_VIDEO_CORPUS_SOURCES,
  AI_VIDEO_CORPUS_SOURCE_REGISTRY_VERSION,
  AI_VIDEO_CORPUS_SOURCES,
  getAiVideoCorpusSource,
} from "../scripts/ai-video-corpus-sources.ts";

test("video corpus source registry is immutable, unique, and hash-pinned", () => {
  assert.equal(Object.isFrozen(AI_VIDEO_CORPUS_SOURCES), true);
  assert.equal(
    new Set(AI_VIDEO_CORPUS_SOURCES.map((item) => item.bvid)).size,
    AI_VIDEO_CORPUS_SOURCES.length,
  );
  assert.equal(
    new Set(AI_VIDEO_CORPUS_SOURCES.map((item) => item.cid)).size,
    AI_VIDEO_CORPUS_SOURCES.length,
  );
  for (const item of AI_VIDEO_CORPUS_SOURCES) {
    assert.equal(item.registryVersion, AI_VIDEO_CORPUS_SOURCE_REGISTRY_VERSION);
    assert.equal(item.platform, "bilibili");
    assert.equal(
      item.pageUrl,
      `https://www.bilibili.com/video/${item.bvid}/`,
    );
    assert.match(item.bvid, /^BV[1-9A-HJ-NP-Za-km-z]{10}$/);
    assert.match(item.reviewedMediaSha256, /^[0-9a-f]{64}$/);
    assert.equal(item.targetContentVersion, CURRENT_ROSTER_VERSION);
    assert.ok(item.durationSeconds > 0);
    assert.ok(item.compatibilityReason.length >= 20);
    assert.equal(Object.isFrozen(item), true);
    assert.strictEqual(getAiVideoCorpusSource(item.bvid), item);
  }
  assert.equal(getAiVideoCorpusSource("BV1not-present"), null);
});

test("reviewed compatible sources are trainable and Season 14 remains evidence-only", () => {
  assert.equal(AI_RUNTIME_COMPATIBLE_VIDEO_CORPUS_SOURCES.length, 7);
  assert.equal(
    AI_RUNTIME_COMPATIBLE_VIDEO_CORPUS_SOURCES.every(
      (item) =>
        item.runtimeCompatible &&
        (item.sourcePatch === "35.4.2" ||
          item.sourcePatch === "36.0" ||
          item.sourcePatch === "36.0.3"),
    ),
    true,
  );
  assert.deepEqual(
    AI_VIDEO_CORPUS_SOURCES.filter((item) => !item.runtimeCompatible).map(
      (item) => [item.bvid, item.sourcePatch],
    ),
    [["BV1mvuH6cENp", "36.2"]],
  );
});
