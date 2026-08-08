import {
  createHeadlessGame,
  createHeadlessLobbyGame,
  type GameState,
} from "../lib/game/engine.ts";

export const AI_BENCHMARK_SCENARIOS = Object.freeze([
  "neutral-v1",
  "live-lobby-v1",
] as const);

export type AiBenchmarkScenarioId =
  (typeof AI_BENCHMARK_SCENARIOS)[number];

export const DEFAULT_AI_BENCHMARK_SCENARIOS = Object.freeze([
  "neutral-v1",
] as const satisfies readonly AiBenchmarkScenarioId[]);

export type AiBenchmarkPairAxis = "seat" | "rotation";

export function isAiBenchmarkScenarioId(
  value: unknown,
): value is AiBenchmarkScenarioId {
  return (
    typeof value === "string" &&
    (AI_BENCHMARK_SCENARIOS as readonly string[]).includes(value)
  );
}

export function normalizeAiBenchmarkScenarioIds(
  value: readonly AiBenchmarkScenarioId[] | undefined,
): readonly AiBenchmarkScenarioId[] {
  const requested =
    value === undefined ? DEFAULT_AI_BENCHMARK_SCENARIOS : value;
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new RangeError("scenarioIds must be a non-empty array");
  }

  const seen = new Set<AiBenchmarkScenarioId>();
  for (const scenarioId of requested) {
    if (!isAiBenchmarkScenarioId(scenarioId)) {
      throw new RangeError(`unknown AI benchmark scenario: ${String(scenarioId)}`);
    }
    if (seen.has(scenarioId)) {
      throw new RangeError(`duplicate AI benchmark scenario: ${scenarioId}`);
    }
    seen.add(scenarioId);
  }

  return Object.freeze(
    AI_BENCHMARK_SCENARIOS.filter((scenarioId) => seen.has(scenarioId)),
  );
}

export function createAiBenchmarkPairKey(
  seed: number,
  scenarioId: AiBenchmarkScenarioId,
  axis: AiBenchmarkPairAxis,
  index: number,
): string {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError("benchmark pair seed must be a safe integer");
  }
  if (!isAiBenchmarkScenarioId(scenarioId)) {
    throw new RangeError(`unknown AI benchmark scenario: ${String(scenarioId)}`);
  }
  if (axis !== "seat" && axis !== "rotation") {
    throw new RangeError(`unknown AI benchmark pair axis: ${String(axis)}`);
  }
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError("benchmark pair index must be a non-negative integer");
  }
  return `seed:${seed}|scenario:${scenarioId}|${axis}:${index}`;
}

export function createAiBenchmarkScenarioGame(
  scenarioId: AiBenchmarkScenarioId,
  seed?: number,
  initialHealth?: number,
): GameState {
  switch (scenarioId) {
    case "neutral-v1":
      return createHeadlessGame(seed, initialHealth);
    case "live-lobby-v1":
      return createHeadlessLobbyGame(seed, initialHealth);
    default:
      throw new RangeError(
        `unknown AI benchmark scenario: ${String(scenarioId)}`,
      );
  }
}
