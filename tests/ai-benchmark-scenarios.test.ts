import assert from "node:assert/strict";
import test from "node:test";

import {
  createHeadlessGame,
  createHeadlessLobbyGame,
} from "../lib/game/engine.ts";
import {
  AI_BENCHMARK_SCENARIOS,
  createAiBenchmarkPairKey,
  createAiBenchmarkScenarioGame,
  normalizeAiBenchmarkScenarioIds,
  type AiBenchmarkPairAxis,
  type AiBenchmarkScenarioId,
} from "../scripts/ai-benchmark-scenarios.ts";

test("benchmark scenarios map to deterministic neutral and live-lobby games", () => {
  const seed = 0xb101;
  const initialHealth = 37;

  assert.deepEqual(AI_BENCHMARK_SCENARIOS, [
    "neutral-v1",
    "live-lobby-v1",
  ]);

  const neutral = createAiBenchmarkScenarioGame(
    "neutral-v1",
    seed,
    initialHealth,
  );
  assert.deepEqual(neutral, createHeadlessGame(seed, initialHealth));
  assert.deepEqual(
    createAiBenchmarkScenarioGame("neutral-v1", seed, initialHealth),
    neutral,
  );

  const liveLobby = createAiBenchmarkScenarioGame(
    "live-lobby-v1",
    seed,
    initialHealth,
  );
  assert.deepEqual(liveLobby, createHeadlessLobbyGame(seed, initialHealth));
  assert.deepEqual(
    createAiBenchmarkScenarioGame("live-lobby-v1", seed, initialHealth),
    liveLobby,
  );
  assert.notDeepEqual(liveLobby, neutral);
});

test("scenario normalization defaults to neutral and rejects incomplete identities", () => {
  assert.deepEqual(normalizeAiBenchmarkScenarioIds(undefined), [
    "neutral-v1",
  ]);

  const normalized = normalizeAiBenchmarkScenarioIds([
    "live-lobby-v1",
    "neutral-v1",
  ]);
  assert.deepEqual(normalized, AI_BENCHMARK_SCENARIOS);
  assert.equal(Object.isFrozen(normalized), true);

  assert.throws(
    () => normalizeAiBenchmarkScenarioIds([]),
    /non-empty array/,
  );
  assert.throws(
    () =>
      normalizeAiBenchmarkScenarioIds(
        null as unknown as readonly AiBenchmarkScenarioId[],
      ),
    /non-empty array/,
  );
  assert.throws(
    () =>
      normalizeAiBenchmarkScenarioIds([
        "neutral-v1",
        "neutral-v1",
      ]),
    /duplicate AI benchmark scenario/,
  );
  assert.throws(
    () =>
      normalizeAiBenchmarkScenarioIds([
        "unknown-v1" as AiBenchmarkScenarioId,
      ]),
    /unknown AI benchmark scenario/,
  );
});

test("pair keys bind seed, scenario, and seat or rotation", () => {
  const seatKey = createAiBenchmarkPairKey(
    0xb201,
    "neutral-v1",
    "seat",
    1,
  );
  const liveSeatKey = createAiBenchmarkPairKey(
    0xb201,
    "live-lobby-v1",
    "seat",
    1,
  );
  const rotationKey = createAiBenchmarkPairKey(
    0xb201,
    "neutral-v1",
    "rotation",
    1,
  );

  assert.equal(seatKey, "seed:45569|scenario:neutral-v1|seat:1");
  assert.equal(new Set([seatKey, liveSeatKey, rotationKey]).size, 3);
  assert.throws(
    () =>
      createAiBenchmarkPairKey(
        0xb201,
        "neutral-v1",
        "round" as AiBenchmarkPairAxis,
        1,
      ),
    /pair axis/,
  );
});
