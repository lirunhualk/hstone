import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { createJevClient, JEV_PINNED_MODEL, type JevClientUsage } from "../scripts/ai-jev-client.ts";
import type { JevTurnDiagnostics } from "../scripts/ai-jev-policy.ts";
import {
  claimAiJevDevelopmentSeeds,
  freezeAiJevConfiguration,
  isAiJevEvidenceUsable,
  jevFixtureFetch,
  parseAiJevArguments,
  runAiJevBenchmark,
  summarizeAiJevPairs,
  type AiJevBenchmarkDependencies,
  type AiJevBenchmarkOptions,
  type AiJevGameRequest,
  type AiJevGameRun,
  type AiJevPair,
  type AiJevProvenance,
} from "../scripts/benchmark-ai-jev.ts";

const zeroUsage: JevClientUsage = { requests: 0, reservedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalLatencyMs: 0, inFlightLatencyMs: 0, stopped: false };
const provenance: AiJevProvenance = { sourceSha256: "source", contentSha256: "content", profilesSha256: "profiles", policyVersion: "test-policy", configurationSha256: "config" };
const options: AiJevBenchmarkOptions = { mode: "fixture", preset: "smoke", startSeed: 94_900_001, runId: "fixture-unit-test" };

test("actual one-seat runner preserves HTTP 451 as the report failure and stops later games", async () => {
  let requests = 0;
  const report = await runAiJevBenchmark({ ...options, runId: `access-restricted-${randomUUID()}` }, {
    claimSeeds: () => undefined,
    persist: () => undefined,
    captureProvenance: () => provenance,
    createClient: () => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL,
      budget: { maxRequests: 2, maxInputTokens: 100_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 10_000 },
      fetch: async () => { requests += 1; return Response.json({ title: "Typesafe is not available in your region." }, { status: 451 }); },
    }),
  });
  assert.equal(report.status, "incomplete");
  assert.equal(report.processedGames, 2);
  assert.equal(report.pairs[0].candidate.failure, "provider-access-restricted-http-451");
  assert.equal(report.evidenceUsable, false);
  assert.equal(report.promotionAccepted, false);
  assert.equal(requests, 1);
});

function diagnostics(overrides: Partial<JevTurnDiagnostics> = {}): JevTurnDiagnostics {
  return { decisions: 1, calls: 1, successfulResponses: 1, appliedActions: 1, emergencyChoiceActions: 0, rejectedActions: 0, staleResponses: 0, limitHits: 0, completed: true, fallbacks: {}, latenciesMs: [12], inputTokens: 0, outputTokens: 0, ...overrides };
}

function successfulRun(request: AiJevGameRequest): AiJevGameRun {
  return {
    completed: true, drawn: false, truncated: false, failure: null,
    initialStateSha256: createHash("sha256").update(JSON.stringify(request.initialState)).digest("hex"),
    finalRound: 20, decisionTrace: null,
    outcomes: Object.fromEntries(request.initialState.players.map((player, index) => [player.id, { placement: index + 1, topFour: index < 4, win: index === 0 }])),
    diagnostics: request.arm === "legacy" ? [] : [diagnostics()], usage: { ...zeroUsage },
  };
}

function dependencies(overrides: AiJevBenchmarkDependencies = {}): AiJevBenchmarkDependencies {
  return { claimSeeds: () => undefined, captureProvenance: () => ({ ...provenance }), persist: () => undefined, runGame: async (request) => successfulRun(request), ...overrides };
}

test("Jev CLI requires explicit mode/preset/fresh range and rejects unknown, duplicate or over-budget flags", () => {
  const basic = ["--mode", "fixture", "--preset", "smoke", "--start-seed", "94900001"];
  assert.equal(parseAiJevArguments(basic).options.mode, "fixture");
  for (const extra of [["--unknown", "1"], ["--mode", "jev"], ["--max-requests", "100001"], ["--max-input-tokens", "100000001"], ["--seeds", "2"], ["--env-file", ".env"]]) assert.throws(() => parseAiJevArguments([...basic, ...extra]));
  assert.throws(() => parseAiJevArguments([]), /explicit/);
  assert.throws(() => parseAiJevArguments([...basic, "--seeds", "1.5"]), /positive integer/);
  assert.throws(() => freezeAiJevConfiguration({ ...options, runId: "../escaped" }));
});

test("default budgets never expand implicitly and larger run contracts require explicit values", () => {
  const normal = freezeAiJevConfiguration({ ...options, preset: "development", seeds: 2 });
  assert.equal(normal.maxRequests, 2_000);
  assert.equal(normal.maxInputTokens, 1_000_000);
  const explicit = freezeAiJevConfiguration({ ...options, preset: "development", seeds: 2, maxRequests: 10_000, maxInputTokens: 50_000_000 });
  assert.equal(explicit.maxRequests, 10_000);
  assert.equal(explicit.maxInputTokens, 50_000_000);
});

test("sealed/consumed seed access is rejected before any claim, factory, game or persistence hook", async () => {
  for (const startSeed of [30_400_001, 30_500_001, 93_200_001, 93_100_001]) {
    let effects = 0;
    await assert.rejects(runAiJevBenchmark({ ...options, startSeed }, dependencies({ claimSeeds: () => { effects += 1; }, createClient: () => { effects += 1; throw new Error("must not run"); }, runGame: async () => { effects += 1; throw new Error("must not run"); }, persist: () => { effects += 1; } })), /seed ledger rejected/);
    assert.equal(effects, 0);
  }
});

test("real mode without credentials rejects before games or seed consumption", async () => {
  let claimed = false;
  await assert.rejects(runAiJevBenchmark({ ...options, mode: "jev" }, dependencies({ claimSeeds: () => { claimed = true; } })), /TYPESAFE_API_KEY/);
  assert.equal(claimed, false);
});

test("local development seed claims are permanent across modes and run directories", () => {
  const root = mkdtempSync(resolve(tmpdir(), "hstone-jev-ledger-"));
  const first = freezeAiJevConfiguration({ ...options, preset: "development", seeds: 2 });
  claimAiJevDevelopmentSeeds(first, provenance, root);
  assert.equal(readdirSync(resolve(root, "outputs/ai-jev/development-seed-ledger")).length, 2);
  const repeated = freezeAiJevConfiguration({ ...options, mode: "jev", runId: "other-run" });
  assert.throws(() => claimAiJevDevelopmentSeeds(repeated, provenance, root), /already consumed/);
  // The failed attempt did not release either seed.
  assert.throws(() => claimAiJevDevelopmentSeeds(first, provenance, root), /already consumed/);
});

test("smoke pairs both intervention arms against one canonical baseline per scenario", async () => {
  const calls: string[] = [];
  let claimed = false;
  let factoryCreated = false;
  const report = await runAiJevBenchmark(options, dependencies({
    claimSeeds: () => { claimed = true; },
    createClient: () => { assert.equal(claimed, true); factoryCreated = true; return createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, fetch: jevFixtureFetch, budget: { maxRequests: 2_000, maxInputTokens: 1_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 1_000_000 } }); },
    runGame: async (request) => { assert.equal(factoryCreated, true); calls.push(`${request.scenario}:${request.arm}`); return successfulRun(request); },
  }));
  assert.equal(report.label, "injected-test");
  assert.equal(report.status, "complete");
  assert.equal(report.processedGames, 6);
  assert.equal(report.baselines.length, 2);
  assert.equal(report.pairs.length, 4);
  assert.equal(calls.filter((call) => call.endsWith(":legacy")).length, 2);
  assert.equal(report.comparisons["all-decisions"]!.overall.placement.seedClusters, 1);
  assert.equal(report.comparisons["all-decisions"]!.overall.placement.confidence95, null);
  assert.equal(report.diagnosticsByArm["critical-decisions"]!.appliedActions, 2);
  assert.equal(report.comparisons["all-decisions"]!.absolute.overall.matchedPairs, 2);
  assert.equal(report.comparisons["all-decisions"]!.absolute.overall.excludedOrUnscheduledPairs, 0);
  assert.deepEqual(report.comparisons["all-decisions"]!.absolute.overall.baseline, { meanPlacement: 2, topFourRate: 1, winRate: 0 });
  assert.deepEqual(report.comparisons["all-decisions"]!.absolute.overall.candidate, { meanPlacement: 2, topFourRate: 1, winRate: 0 });
  assert.equal(report.evidenceUsable, false);
  assert.equal(report.promotionAccepted, false);
});

test("development rotates all seven profiles across every physical seat, with baseline reused", async () => {
  const report = await runAiJevBenchmark({ ...options, preset: "development", seeds: 2 }, dependencies());
  assert.equal(report.status, "complete");
  assert.equal(report.processedGames, 480);
  assert.equal(report.baselines.length, 32);
  assert.equal(report.pairs.length, 448);
  assert.equal(report.comparisons["all-decisions"]!.overall.placement.seedClusters, 2);
  assert.deepEqual(report.comparisons["all-decisions"]!.overall.placement.confidence95, { lower: 0, upper: 0 });
  for (const profile of report.configuration.profiles) assert.deepEqual([...new Set(report.pairs.filter((pair) => pair.profile === profile).map((pair) => pair.physicalSeat))].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(report.evidenceUsable, false);
  assert.equal(report.promotionAccepted, false);
});

test("evidence admission rejects a completed comparison with any emergency first-choice action", async () => {
  const report = await runAiJevBenchmark({ ...options, preset: "development", seeds: 2 }, dependencies());
  // Exercise the pure admission gate without publishing injected fixtures as evidence.
  const evidence = { ...report, label: "real-jev-development" as const };
  assert.equal(isAiJevEvidenceUsable(report), false, "injected runs remain ineligible");
  assert.equal(isAiJevEvidenceUsable(evidence), true, "complete exposed arms pass before contamination");
  for (const arm of ["all-decisions", "critical-decisions"] as const) {
    let contaminated = false;
    const pairs = evidence.pairs.map((pair) => {
      if (pair.arm !== arm || contaminated) return pair;
      contaminated = true;
      return { ...pair, candidate: { ...pair.candidate, diagnostics: pair.candidate.diagnostics.map((turn, index) => index === 0 ? { ...turn, emergencyChoiceActions: 1 } : turn) } };
    });
    assert.equal(isAiJevEvidenceUsable({ ...evidence, pairs }), false, `${arm} emergency selection invalidates evidence`);
  }
  assert.equal(report.promotionAccepted, false);
});

test("each intervention arm must execute model actions independently of the other arm", async () => {
  const report = await runAiJevBenchmark({ ...options, preset: "development", seeds: 2 }, dependencies());
  const evidence = { ...report, label: "real-jev-development" as const };
  for (const arm of ["all-decisions", "critical-decisions"] as const) {
    const pairs = evidence.pairs.map((pair) => pair.arm !== arm ? pair : {
      ...pair,
      candidate: { ...pair.candidate, diagnostics: pair.candidate.diagnostics.map((turn) => ({ ...turn, appliedActions: 0, fallbacks: { "low-confidence": 1 } })) },
    });
    assert.equal(isAiJevEvidenceUsable({ ...evidence, pairs }), false, `${arm} cannot borrow exposure from the other arm`);
    assert.equal(isAiJevEvidenceUsable({ ...evidence, pairs: pairs.filter((pair) => pair.arm !== arm) }), false, "missing arms are ineligible");
  }
  assert.equal(isAiJevEvidenceUsable(evidence), true);
  assert.equal(report.promotionAccepted, false);
});

test("budget failures and partial outcomes persist incomplete evidence and stop later model/game work", async () => {
  const saved: string[] = [];
  let calls = 0;
  const report = await runAiJevBenchmark(options, dependencies({
    persist: (snapshot) => { saved.push(snapshot.status); },
    runGame: async (request) => { calls += 1; const result = successfulRun(request); if (request.arm !== "legacy") result.diagnostics = [diagnostics({ fallbacks: { budget: 1 }, calls: 1, successfulResponses: 0, appliedActions: 0 })]; return result; },
  }));
  assert.equal(calls, 2);
  assert.equal(report.status, "incomplete");
  assert.equal(saved.at(-1), "incomplete");
  assert.equal(report.evidenceUsable, false);
  assert.equal(report.promotionAccepted, false);
  assert.equal(report.comparisons["all-decisions"]!.overall.placement.seedClusters, 0);
});

test("runner failure, initial-state drift and source drift fail closed", async () => {
  const thrown = await runAiJevBenchmark(options, dependencies({ runGame: async () => { throw new Error("provider body must not be copied"); } }));
  assert.equal(thrown.status, "incomplete");
  assert.equal(thrown.baselines[0].failure, "game-runner-failure");
  assert.equal(JSON.stringify(thrown).includes("provider body"), false);
  const initialDrift = await runAiJevBenchmark(options, dependencies({ runGame: async (request) => ({ ...successfulRun(request), initialStateSha256: request.arm === "legacy" ? "legacy" : "different" }) }));
  assert.equal(initialDrift.status, "incomplete");
  let hashes = 0;
  const sourceDrift = await runAiJevBenchmark(options, dependencies({ captureProvenance: () => ({ ...provenance, sourceSha256: hashes++ === 0 ? "before" : "after" }) }));
  assert.equal(sourceDrift.sourceStable, false);
  assert.equal(sourceDrift.status, "incomplete");
});

test("seed-cluster uncertainty averages correlated profiles/rotations within seed and excludes partial clusters", () => {
  const run: AiJevGameRun = { completed: true, drawn: false, truncated: false, failure: null, initialStateSha256: "same", finalRound: 20, decisionTrace: null, outcomes: {}, diagnostics: [], usage: zeroUsage };
  const pair = (seed: number, delta: number): AiJevPair => ({ seed, scenario: "neutral-v1", rotation: 0, physicalSeat: 1, playerId: "player-1", profile: "balanced", arm: "all-decisions", baseline: run, candidate: run, placementDelta: delta, topFourDelta: 0, winDelta: 0 });
  const metric = summarizeAiJevPairs([pair(1, -1), pair(1, -1), pair(2, 1), pair(2, 1), pair(3, -7)], 2).placement;
  assert.equal(metric.seedClusters, 2);
  assert.equal(metric.pairedSeats, 4);
  assert.equal(metric.meanDelta, 0);
  assert.deepEqual(metric.confidence95, { lower: -12.706, upper: 12.706 });
});

test("synthetic fixture exercises documented choice and score schema without live fetch", async () => {
  const client = createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, fetch: jevFixtureFetch, budget: { maxRequests: 2, maxInputTokens: 32_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 1000 } });
  const response = await client.evaluate({ fixture: true }, {
    choose: { type: "choice", instructions: "fixture", criteria: { a: "first", b: "second" } },
    score: { type: "score", instructions: "fixture", criteria: ["poor", { quality: "good" }] },
  });
  assert.equal(response.answers.choose.type, "choice");
  assert.equal(response.answers.score.type, "score");
  assert.equal(response.usage.input_tokens, 0);
  assert.equal(client.getUsage().requests, 1);
  assert.ok(client.getUsage().reservedInputTokens > 0);
});
