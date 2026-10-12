import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { readFile as readFileAsync } from "node:fs/promises";
import test from "node:test";

import { createJevClient, JEV_PINNED_MODEL, reserveJevInputTokens, type JevClientUsage } from "../scripts/ai-jev-client.ts";
import type { JevTurnDiagnostics } from "../scripts/ai-jev-policy.ts";
import {
  claimAiJevDevelopmentSeeds,
  AI_JEV_BENCHMARK_VERSION,
  freezeAiJevConfiguration,
  isAiJevEvidenceUsable,
  isAiJevIttEvidenceUsable,
  jevFixtureFetch,
  parseAiJevArguments,
  prepareAiJevDecisionTrace,
  runAiJevBenchmark,
  summarizeAiJevPairs,
  type AiJevBenchmarkDependencies,
  type AiJevBenchmarkOptions,
  type AiJevGameRequest,
  type AiJevGameRun,
  type AiJevPair,
  type AiJevProvenance,
} from "../scripts/benchmark-ai-jev.ts";
import { AiJevJournal } from "../scripts/ai-jev-journal.ts";

const zeroUsage: JevClientUsage = { requests: 0, reservedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalLatencyMs: 0, inFlightLatencyMs: 0, stopped: false };
const provenance: AiJevProvenance = { sourceSha256: "source", contentSha256: "content", profilesSha256: "profiles", policyVersion: "test-policy", configurationSha256: "config" };
const options: AiJevBenchmarkOptions = { mode: "fixture", preset: "smoke", startSeed: 94_900_001, runId: "fixture-unit-test" };

test("permanent HTTP 451 opens the model circuit but completes every game with production", async () => {
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
  assert.equal(report.status, "complete");
  assert.equal(report.processedGames, 6);
  assert.equal(report.pairs[0].candidate.failure, null);
  assert.ok(report.pairs[0].candidate.providerFailures?.includes("provider-access-restricted-http-451"));
  assert.equal(report.availability.circuitReason, "provider-http-451");
  assert.equal(report.pairs.every((pair) => pair.candidate.completed && Object.values(pair.candidate.outcomes).every((outcome) => outcome.placement !== null)), true);
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
  for (const extra of [["--unknown", "1"], ["--mode", "jev"], ["--max-requests", "100001"], ["--max-input-tokens", "1000000001"], ["--seeds", "2"], ["--env-file", ".env"], ["--concurrency", "5"], ["--resume", "maybe"]]) assert.throws(() => parseAiJevArguments([...basic, ...extra]));
  assert.equal(parseAiJevArguments([...basic, "--max-provider-recoveries", "0"]).options.maxProviderRecoveries, 0);
  assert.equal(parseAiJevArguments([...basic, "--max-provider-recoveries", "2"]).options.maxProviderRecoveries, 2);
  assert.throws(() => parseAiJevArguments([...basic, "--max-provider-recoveries", "3"]), /0\.\.2/);
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
  assert.equal(normal.concurrency, 1);
  assert.equal(normal.maxProviderRecoveries, 0);
  assert.equal(normal.recoveryCooldownMs, 5000);
  assert.match(normal.adapterVersion!, /v4-noul-ranked-benefit/);
  assert.equal(normal.adapterPreset?.maxCandidates, 6);
  assert.equal(freezeAiJevConfiguration({ ...options, concurrency: 4, maxInputTokens: 800_000_000 }).maxInputTokens, 800_000_000);
});

test("one invalid response completes its full game and later games still use new model clients", async () => {
  let networkCalls = 0;
  const report = await runAiJevBenchmark({ ...options, concurrency: 4, runId: `nonfatal-${randomUUID()}`, maxInputTokens: 10_000_000 }, {
    claimSeeds: () => undefined, persist: () => undefined, captureProvenance: () => provenance,
    createClient: (configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async (input, init) => { networkCalls += 1; return networkCalls === 1 ? Response.json({ model: JEV_PINNED_MODEL, answers: {}, usage: { input_tokens: 1, output_tokens: 0 } }) : jevFixtureFetch(input, init); },
    }),
  });
  assert.equal(report.status, "complete");
  assert.equal(report.pairs.length, 4);
  assert.equal(report.pairs.every((pair) => pair.candidate.completed && pair.candidate.failure === null), true);
  assert.equal(report.pairs.filter((pair) => pair.candidate.providerFailures?.includes("response")).length, 1);
  assert.ok(networkCalls > 1, "subsequent games still receive real transport fixtures");
  assert.equal(report.usage.requests, networkCalls);
  assert.equal(report.usage.failedRequests, 1);
  assert.equal(report.usage.knownUsageRequests, networkCalls);
  assert.equal(report.usage.unknownUsageRequests, 0);
  assert.equal(report.availability.circuitReason, null);
  assert.equal(report.pairs.reduce((sum, pair) => sum + pair.candidate.usage.requests, 0), networkCalls, "parallel per-game usage is not a difference of shared snapshots");
});

test("circuit-open local game queue services another provider's timer and I/O before draining", async () => {
  let startedCandidates = 0;
  let finishedCandidates = 0;
  let timerObservedAt = -1;
  let ioObservedAt = -1;
  const question = { valid: { type: "noul" as const, instructions: "Is the visible action valid?" } };
  const report = await runAiJevBenchmark({ ...options, preset: "development", seeds: 2, concurrency: 4 }, dependencies({
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks, timeoutMs: 5000,
      budget: { maxRequests: 10, maxInputTokens: 100_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 50_000 },
      fetch: async (_input, init) => {
        const request = JSON.parse(String(init?.body)) as { state: { role: string } };
        if (request.state.role === "trip-circuit") return Response.json({}, { status: 451 });
        await new Promise<void>((resolveTimer) => setTimeout(() => { timerObservedAt = finishedCandidates; resolveTimer(); }, 5));
        await readFileAsync(new URL("../package.json", import.meta.url));
        ioObservedAt = finishedCandidates;
        return Response.json({ model: JEV_PINNED_MODEL, answers: { valid: { type: "noul", noul: 1 } }, usage: { input_tokens: 10, output_tokens: 1 } });
      },
    }),
    runGame: async (request, client) => {
      const result = successfulRun(request);
      if (request.arm === "legacy") return result;
      const order = ++startedCandidates;
      if (order <= 2) {
        try { await client.evaluate({ role: order === 1 ? "delayed-provider" : "trip-circuit" }, question); }
        catch { result.diagnostics = [diagnostics({ successfulResponses: 0, appliedActions: 0, fallbacks: { http: 1 } })]; result.providerFailures = ["http"]; }
      } else result.diagnostics = [diagnostics({ decisions: 0, calls: 0, successfulResponses: 0, appliedActions: 0 })];
      finishedCandidates += 1;
      return { ...result, usage: client.getUsage() };
    },
  }));
  assert.equal(report.status, "complete");
  assert.equal(report.processedGames, 480);
  assert.equal(report.availability.circuitReason, "provider-http-451");
  assert.equal(report.usage.requests, 2);
  assert.equal(report.usage.failedRequests, 1);
  assert.ok(timerObservedAt >= 0 && timerObservedAt < 446, "timer runs while fallback games remain queued");
  assert.ok(ioObservedAt >= timerObservedAt && ioObservedAt < 446, "filesystem I/O completes before the local queue drains");
  assert.equal(report.pairs[report.pairs.findIndex((pair) => pair.candidate.usage.knownUsageRequests === 1)].candidate.completed, true);
});

test("one shared recovery waits active requests, preserves old-game fallback and allows only new games", async () => {
  let calls = 0;
  let probes = 0;
  let pending = 0;
  let candidates = 0;
  let cooled = 0;
  let oldGameStopped = false;
  let allowOldGame: () => void = () => undefined;
  const recovered = new Promise<void>((resolveRecovery) => { allowOldGame = resolveRecovery; });
  let allStarted: () => void = () => undefined;
  const initialRequestsStarted = new Promise<void>((resolveStarted) => { allStarted = resolveStarted; });
  const question = { valid: { type: "noul" as const, instructions: "Is this action valid?" } };
  const report = await runAiJevBenchmark({ ...options, preset: "development", seeds: 2, concurrency: 4, maxProviderRecoveries: 2, maxInputTokens: 10_000_000, runId: `recovery-${randomUUID()}` }, dependencies({
    waitForRecoveryCooldown: async (milliseconds) => { assert.equal(milliseconds, 5000); cooled += 1; },
    probeHealth: async () => { assert.equal(pending, 0, "all sent POST operations settle before GET"); probes += 1; allowOldGame(); return { healthy: true, status: 200, failure: null }; },
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async (_input, init) => {
        const order = ++calls;
        pending += 1;
        try {
          if (order <= 3) { await initialRequestsStarted; return Response.json({}, { status: 503 }); }
          if (order === 4) { allStarted(); await new Promise((resolveTimer) => setTimeout(resolveTimer, 15)); }
          const wire = JSON.parse(String(init?.body)) as { questions: Record<string, unknown> };
          return Response.json({ model: JEV_PINNED_MODEL, answers: Object.fromEntries(Object.keys(wire.questions).map((id) => [id, { type: "noul", noul: 1 }])), usage: { input_tokens: 10, output_tokens: 1 } });
        } finally { pending -= 1; }
      },
    }),
    runGame: async (request, client) => {
      const result = successfulRun(request);
      if (request.arm === "legacy") return result;
      const order = ++candidates;
      try {
        await client.evaluate({ game: order }, question);
        if (order === 4) {
          await recovered;
          try { await client.evaluate({ game: order, next: true }, question); }
          catch { oldGameStopped = true; result.providerFailures = ["stopped"]; }
        }
      } catch { result.providerFailures = ["http"]; result.diagnostics = [diagnostics({ successfulResponses: 0, appliedActions: 0, fallbacks: { http: 1 } })]; }
      return { ...result, usage: client.getUsage() };
    },
  }));
  assert.equal(report.status, "complete");
  assert.equal(report.processedGames, 480);
  assert.equal(calls, 448, "each game sends at most its original request; no failed POST or old-game retry");
  assert.equal(probes, 1);
  assert.equal(cooled, 1);
  assert.equal(oldGameStopped, true);
  assert.equal(report.availability.circuitReason, null);
  assert.equal(report.availability.recovery?.circuitEvents, 1, "reopening retains circuit history");
  assert.equal(report.availability.recovery?.successful, 1);
  assert.equal(report.usage.failedRequests, 3);
  assert.equal(report.usage.unknownUsageRequests, 3);
  assert.equal(report.pairs.reduce((sum, pair) => sum + pair.candidate.usage.requests, 0), report.usage.requests);
});

test("default recovery stays off and missing settlement fails closed without probe or completed checkpoint", async () => {
  const question = { valid: { type: "noul" as const, instructions: "Is this action valid?" } };
  let probes = 0;
  let calls = 0;
  const runGame: NonNullable<AiJevBenchmarkDependencies["runGame"]> = async (request, client) => {
    const result = successfulRun(request);
    if (request.arm !== "legacy") {
      try { await client.evaluate({ arm: request.arm }, question); }
      catch { result.providerFailures = ["http"]; result.diagnostics = [diagnostics({ successfulResponses: 0, appliedActions: 0, fallbacks: { http: 1 } })]; }
    }
    return { ...result, usage: client.getUsage() };
  };
  const report = await runAiJevBenchmark({ ...options, runId: `no-recovery-${randomUUID()}` }, dependencies({
    probeHealth: async () => { probes += 1; return { healthy: true, status: 200, failure: null }; }, runGame,
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async () => { calls += 1; return Response.json({}, { status: 503 }); },
    }),
  }));
  assert.equal(report.status, "complete");
  assert.equal(calls, 3);
  assert.equal(probes, 0);
  assert.equal(report.availability.recovery?.maxAttempts, 0);
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-missing-settlement-"));
  const broken = await runAiJevBenchmark({ ...options, maxProviderRecoveries: 2, runId: `broken-hook-${randomUUID()}` }, dependencies({ journalDirectory: directory, runGame,
    probeHealth: async () => { probes += 1; return { healthy: true, status: 200, failure: null }; },
    createClient: (configuration, hooks) => ({ getUsage: () => zeroUsage, evaluate: async (state, questions) => {
      const wire = { model: configuration.model, state, questions };
      hooks!.onRequestReserved!({ ...wire, reservedInputTokens: reserveJevInputTokens(JSON.stringify(wire), Object.keys(questions).length) });
      throw new Error("simulated broken transport without settlement");
    } }),
  }));
  assert.equal(broken.status, "incomplete");
  assert.equal(broken.pairs[0].candidate.completed, false);
  assert.ok(broken.failures.includes("provider-settlement-integrity-failure"));
  assert.equal(probes, 0);
  assert.equal(readdirSync(resolve(directory, "games")).length, 2, "only canonical baseline games were checkpointed");
});

test("injected real-mode recovery without an explicit health fixture makes no native GET", async (context) => {
  let nativeRequests = 0;
  context.mock.method(globalThis, "fetch", async () => { nativeRequests += 1; throw new Error("test must stay offline"); });
  const question = { valid: { type: "noul" as const, instructions: "Is this action valid?" } };
  const report = await runAiJevBenchmark({ ...options, mode: "jev", maxProviderRecoveries: 2, runId: `offline-recovery-${randomUUID()}` }, dependencies({
    waitForRecoveryCooldown: async () => undefined,
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async () => Response.json({}, { status: 503 }),
    }),
    runGame: async (request, client) => {
      const result = successfulRun(request);
      if (request.arm !== "legacy") {
        try { await client.evaluate({ arm: request.arm }, question); }
        catch { result.providerFailures = ["http"]; result.diagnostics = [diagnostics({ successfulResponses: 0, appliedActions: 0, fallbacks: { http: 1 } })]; }
      }
      return { ...result, usage: client.getUsage() };
    },
  }));
  assert.equal(report.status, "complete");
  assert.equal(nativeRequests, 0);
  assert.equal(report.availability.recovery?.failed, 1);
  assert.equal(report.availability.recovery?.history[0].failure, "shape");
  assert.equal(report.usage.requests, 3);
});

test("resume after a healthy probe keeps a pre-circuit incomplete game local after replay", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-old-epoch-"));
  const testOptions = { ...options, preset: "development" as const, seeds: 2, maxProviderRecoveries: 2, maxInputTokens: 10_000_000, runId: `old-epoch-${randomUUID()}` };
  const configuration = freezeAiJevConfiguration(testOptions);
  const journal = new AiJevJournal({ directory, identity: { version: AI_JEV_BENCHMARK_VERSION, configuration, provenance }, maxRequests: configuration.maxRequests, maxInputTokens: configuration.maxInputTokens, maxProviderRecoveries: 2 });
  const questions = { valid: { type: "noul" as const, instructions: "Is this action valid?" } };
  const oldKey = `${options.startSeed}-neutral-v1-r0-balanced-all-decisions`;
  const keys = [oldKey, `${options.startSeed}-neutral-v1-r0-balanced-critical-decisions`, `${options.startSeed}-neutral-v1-r0-magnetic-all-decisions`, `${options.startSeed}-neutral-v1-r0-magnetic-critical-decisions`];
  for (const [index, key] of keys.entries()) {
    journal.startGame(key);
    const wire = { model: JEV_PINNED_MODEL, state: { game: key }, questions };
    journal.reserve(key, 0, { ...wire, reservedInputTokens: reserveJevInputTokens(JSON.stringify(wire), 1) });
    journal.settle(key, 0, index === 0 ? { kind: "success", requestSent: true, budgetExceeded: false, latencyMs: 1, knownUsage: { input_tokens: 10, output_tokens: 1 }, response: { model: JEV_PINNED_MODEL, answers: { valid: { type: "noul", noul: 1 } }, usage: { input_tokens: 10, output_tokens: 1 }, latencyMs: 1 } } : { kind: "error", code: "http", status: 503, requestSent: true, budgetExceeded: false, latencyMs: 1, knownUsage: null });
  }
  journal.settleRecovery(journal.reserveRecovery(), { healthy: true, status: 200, failure: null });
  journal.close();
  let calls = 0;
  let stopped = false;
  const report = await runAiJevBenchmark({ ...testOptions, resume: true }, dependencies({ journalDirectory: directory,
    probeHealth: async () => { throw new Error("already settled GET cannot repeat"); },
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async (input, init) => { calls += 1; return jevFixtureFetch(input, init); },
    }),
    runGame: async (request, client) => {
      const result = successfulRun(request);
      if (request.arm !== "legacy") {
        const key = `${request.seed}-${request.scenario}-r${request.rotation}-${request.profile!.id}-${request.arm}`;
        try {
          await client.evaluate({ game: key }, questions);
          if (key === oldKey) {
            try { await client.evaluate({ game: key, next: true }, questions); }
            catch { stopped = true; result.providerFailures = ["stopped"]; }
          }
        } catch { result.providerFailures = ["http"]; result.diagnostics = [diagnostics({ successfulResponses: 0, appliedActions: 0, fallbacks: { http: 1 } })]; }
      }
      return { ...result, usage: client.getUsage() };
    },
  }));
  assert.equal(report.status, "complete");
  assert.equal(stopped, true);
  assert.equal(calls, 444, "four original POSTs and the settled GET are replayed without duplication or reviving the old game");
  assert.equal(report.usage.requests, 448);
  assert.equal(report.availability.recovery?.successful, 1);
});

test("durable resume replays paid responses without API duplication and retains completed checkpoints", async () => {
  const journalDirectory = mkdtempSync(resolve(tmpdir(), "hstone-jev-resume-"));
  let calls = 0;
  let claims = 0;
  let interrupt = true;
  const testOptions = { ...options, maxInputTokens: 10_000_000, runId: `resume-${randomUUID()}` };
  const question = { valid: { type: "noul" as const, instructions: "Does the visible action satisfy the rule?" } };
  const injected = dependencies({ journalDirectory,
    claimSeeds: () => { claims += 1; },
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async (input, init) => { calls += 1; return jevFixtureFetch(input, init); },
    }),
    runGame: async (request, client) => {
      if (request.arm !== "legacy") {
        await client.evaluate({ scenario: request.scenario, arm: request.arm, player: request.playerId }, question);
        if (interrupt) { interrupt = false; throw new Error("simulated process interruption after durable response"); }
      }
      return { ...successfulRun(request), usage: client.getUsage() };
    },
  });
  const first = await runAiJevBenchmark(testOptions, injected);
  assert.equal(first.status, "incomplete");
  assert.equal(calls, 1);
  const baselinePath = resolve(journalDirectory, "games", `${options.startSeed}-neutral-v1-r0-lobby-legacy.json`);
  const baselineBytes = readFileSync(baselinePath, "utf8");
  const resumed = await runAiJevBenchmark({ ...testOptions, resume: true }, injected);
  assert.equal(resumed.status, "complete");
  assert.equal(calls, 4, "the already paid first response is replayed, not requested again");
  assert.equal(claims, 1);
  assert.equal(resumed.usage.requests, 4);
  assert.equal(readFileSync(baselinePath, "utf8"), baselineBytes);
  await assert.rejects(runAiJevBenchmark({ ...testOptions, resume: true, concurrency: 2 }, injected), /drift/);
  await assert.rejects(runAiJevBenchmark({ ...testOptions, resume: true }, { ...injected, captureProvenance: () => ({ ...provenance, sourceSha256: "changed-source" }) }), /drift/);
  assert.equal(calls, 4, "drift is rejected before transport");
});

test("resume never resends a reserved request whose response was lost", async () => {
  const journalDirectory = mkdtempSync(resolve(tmpdir(), "hstone-jev-uncertain-"));
  const testOptions = { ...options, maxInputTokens: 10_000_000, runId: `uncertain-${randomUUID()}` };
  const configuration = freezeAiJevConfiguration(testOptions);
  const question = { valid: { type: "noul" as const, instructions: "Does the visible action satisfy the rule?" } };
  const key = `${options.startSeed}-neutral-v1-r0-balanced-all-decisions`;
  const journal = new AiJevJournal({ directory: journalDirectory, identity: { version: AI_JEV_BENCHMARK_VERSION, configuration, provenance }, maxRequests: configuration.maxRequests, maxInputTokens: configuration.maxInputTokens });
  const pendingRequest = { model: JEV_PINNED_MODEL, state: { scenario: "neutral-v1", arm: "all-decisions", player: "player-1" }, questions: question };
  journal.reserve(key, 0, { ...pendingRequest, reservedInputTokens: reserveJevInputTokens(JSON.stringify(pendingRequest), Object.keys(question).length) });
  journal.close();
  let calls = 0;
  const report = await runAiJevBenchmark({ ...testOptions, resume: true }, dependencies({ journalDirectory,
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 2000, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async (input, init) => { calls += 1; return jevFixtureFetch(input, init); },
    }),
    runGame: async (request, client) => {
      const result = successfulRun(request);
      if (request.arm !== "legacy") {
        try { await client.evaluate({ scenario: request.scenario, arm: request.arm, player: request.playerId }, question); }
        catch { result.diagnostics = [diagnostics({ successfulResponses: 0, appliedActions: 0, fallbacks: { aborted: 1 } })]; result.providerFailures = ["aborted"]; }
      }
      return { ...result, usage: client.getUsage() };
    },
  }));
  assert.equal(report.status, "complete");
  assert.equal(calls, 3, "only the other three candidate games send fresh requests");
  assert.equal(report.usage.requests, 4);
  assert.equal(report.usage.unknownUsageRequests, 1);
  assert.equal(report.pairs[0].candidate.completed, true);
});

test("cached complete game with a partial decision trace tail is repaired from settled responses without new API", async () => {
  const journalDirectory = mkdtempSync(resolve(tmpdir(), "hstone-jev-trace-resume-"));
  const testOptions = { ...options, maxRequests: 1, maxInputTokens: 10_000_000, runId: `trace-resume-${randomUUID()}` };
  let calls = 0;
  const injected: AiJevBenchmarkDependencies = { journalDirectory, claimSeeds: () => undefined, persist: () => undefined, captureProvenance: () => provenance,
    createClient: (_configuration, hooks) => createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL, ...hooks,
      budget: { maxRequests: 1, maxInputTokens: 10_000_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 100_000 },
      fetch: async (input, init) => { calls += 1; const response = await jevFixtureFetch(input, init); const payload = await response.json(); return Response.json({ ...payload, usage: { input_tokens: 10, output_tokens: 1 } }); },
    }),
  };
  const first = await runAiJevBenchmark(testOptions, injected);
  assert.equal(first.status, "complete");
  assert.equal(calls, 1);
  const game = first.pairs.find((pair) => pair.arm === "all-decisions" && pair.scenario === "neutral-v1")!;
  assert.equal(game.candidate.usage.knownUsageRequests, 1);
  const path = resolve(game.candidate.decisionTrace!);
  const lines = readFileSync(path, "utf8").trimEnd().split("\n");
  assert.equal(lines.length, 2);
  const originals = lines.map((line) => JSON.parse(line));
  const checkpointPath = resolve(journalDirectory, "games", `${options.startSeed}-neutral-v1-r0-balanced-all-decisions.json`);
  const checkpointBytes = readFileSync(checkpointPath, "utf8");
  writeFileSync(path, lines[0] + "\n" + lines[1].slice(0, Math.floor(lines[1].length / 2)));
  const resumed = await runAiJevBenchmark({ ...testOptions, resume: true }, injected);
  assert.equal(resumed.status, "complete");
  assert.equal(calls, 1, "repair does not make another transport request");
  const repairedBytes = readFileSync(path, "utf8");
  assert.ok(repairedBytes.startsWith(lines[0] + "\n"), "the complete valid prefix is retained byte-for-byte");
  const repaired = repairedBytes.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(repaired, originals, "replay restores the exact original record provenance and settled response");
  assert.equal(readFileSync(checkpointPath, "utf8"), checkpointBytes, "the completed outcome checkpoint is immutable");
  for (const record of repaired) assert.equal(record.requestHash, createHash("sha256").update(JSON.stringify({ state: record.state, questions: record.questions })).digest("hex"));
  // A complete line with a wrong hash must fail rather than being discarded.
  const invalid = JSON.stringify({ ...repaired[0], requestHash: "0".repeat(64) }) + "\n";
  writeFileSync(path, invalid);
  assert.throws(() => prepareAiJevDecisionTrace(path, JEV_PINNED_MODEL, "all-decisions", first.configuration.adapterVersion), /hash mismatch/);
  assert.equal(readFileSync(path, "utf8"), invalid);
  const rejected = await runAiJevBenchmark({ ...testOptions, resume: true }, injected);
  assert.equal(rejected.status, "incomplete");
  assert.equal(calls, 1);
});

test("a complete trace tail without newline is retained, while invalid complete schema is rejected", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-trace-schema-"));
  const path = resolve(directory, "decisions.jsonl");
  const state = { policyVersion: "trace-test" };
  const questions = { valid: { type: "noul" as const, instructions: "Is this valid?" } };
  const record = { mode: "all-decisions", decisionIndex: 0, round: 1, requestHash: createHash("sha256").update(JSON.stringify({ state, questions })).digest("hex"), state, questions,
    response: { model: JEV_PINNED_MODEL, answers: { valid: { type: "noul", noul: 0.5 } }, usage: { input_tokens: 1, output_tokens: 1 }, latencyMs: 1 }, selectedAction: null, status: "unresolved-benefit-ranking", providerStatus: null };
  const bytes = JSON.stringify(record);
  writeFileSync(path, bytes);
  assert.equal(prepareAiJevDecisionTrace(path, JEV_PINNED_MODEL, "all-decisions", "trace-test").needsReplay, false);
  assert.equal(readFileSync(path, "utf8"), bytes + "\n");
  const invalid = JSON.stringify({ ...record, decisionIndex: -1 }) + "\n";
  writeFileSync(path, invalid);
  assert.throws(() => prepareAiJevDecisionTrace(path, JEV_PINNED_MODEL, "all-decisions"), /schema/);
  assert.equal(readFileSync(path, "utf8"), invalid);
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

test("ITT includes emergency fallback while clean evidence remains separate", async () => {
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
    assert.equal(isAiJevEvidenceUsable({ ...evidence, pairs }), true, `${arm} emergency fallback belongs to deployed integration ITT`);
    assert.equal(isAiJevIttEvidenceUsable({ ...evidence, pairs }), true);
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
  const missingCell = evidence.pairs.map((pair) => pair.profile === "balanced" && pair.physicalSeat === 1 && pair.scenario === "neutral-v1" && pair.arm === "all-decisions" ? {
    ...pair, candidate: { ...pair.candidate, diagnostics: [diagnostics({ appliedActions: 0 })] },
  } : pair);
  assert.equal(isAiJevIttEvidenceUsable({ ...evidence, pairs: missingCell }), true, "complete ITT still measures the frozen integration");
  assert.equal(isAiJevEvidenceUsable({ ...evidence, pairs: missingCell }), false, "an entirely local profile/seat/scenario cell cannot borrow exposure from other cells");
  assert.equal(report.promotionAccepted, false);
});

test("bounded decision and cycle fallbacks are measured in ITT without aborting healthy simulation", async () => {
  const report = await runAiJevBenchmark({ ...options, preset: "development", seeds: 2 }, dependencies({
    runGame: async (request) => ({ ...successfulRun(request), diagnostics: request.arm === "legacy" ? [] : [diagnostics({ limitHits: 1, fallbacks: { "decision-limit": 1, cycle: 1 } })] }),
  }));
  assert.equal(report.status, "complete");
  assert.equal(report.processedGames, 480);
  assert.equal(report.comparisons["all-decisions"]!.overall.placement.seedClusters, 2);
  assert.equal(report.diagnostics.limitHits, 448);
  assert.equal(report.cleanEvidenceUsable, false);
});

test("budget fallback remains in complete ITT and zero model exposure does not establish strength", async () => {
  const saved: string[] = [];
  let calls = 0;
  const report = await runAiJevBenchmark(options, dependencies({
    persist: (snapshot) => { saved.push(snapshot.status); },
    runGame: async (request) => { calls += 1; const result = successfulRun(request); if (request.arm !== "legacy") result.diagnostics = [diagnostics({ fallbacks: { budget: 1 }, calls: 1, successfulResponses: 0, appliedActions: 0 })]; return result; },
  }));
  assert.equal(calls, 6);
  assert.equal(report.status, "complete");
  assert.equal(saved.at(-1), "complete");
  assert.equal(report.evidenceUsable, false);
  assert.equal(report.promotionAccepted, false);
  assert.equal(report.comparisons["all-decisions"]!.overall.placement.seedClusters, 1);
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
