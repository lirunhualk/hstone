import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { AiJevJournal } from "../scripts/ai-jev-journal.ts";
import { createJevClient, JEV_PINNED_MODEL, JevClientError, reserveJevInputTokens, type JevRequestReservation, type JevRequestSettlement } from "../scripts/ai-jev-client.ts";

const questions = { valid: { type: "noul" as const, instructions: "Is the visible action valid?" } };
const request = { model: JEV_PINNED_MODEL, state: { gold: 3 }, questions };
const reservation: JevRequestReservation = { ...request, reservedInputTokens: reserveJevInputTokens(JSON.stringify(request), Object.keys(questions).length) };
const identity = { source: "frozen-source", configuration: "frozen-config" };
const success: JevRequestSettlement = {
  kind: "success", requestSent: true, latencyMs: 3, budgetExceeded: false, knownUsage: { input_tokens: 10, output_tokens: 2 },
  response: { model: JEV_PINNED_MODEL, answers: { valid: { type: "noul", noul: 1 } }, usage: { input_tokens: 10, output_tokens: 2 }, latencyMs: 3 },
};
const failure: JevRequestSettlement = { kind: "error", code: "response", validationRule: "answers", requestSent: true, latencyMs: 5, knownUsage: null, budgetExceeded: false };

const temporary: JevRequestSettlement = { ...failure, code: "timeout", validationRule: undefined };
const healthy = { healthy: true, status: 200, failure: null } as const;
function threeFailures(journal: AiJevJournal, game: string, outcome: JevRequestSettlement = temporary): void {
  for (let ordinal = 0; ordinal < 3; ordinal += 1) { journal.reserve(game, ordinal, reservation); journal.settle(game, ordinal, outcome); }
}

test("only three classified sent transient failures permit bounded recovery", () => {
  for (const outcome of [temporary, { ...temporary, code: "http", status: 429 }, { ...temporary, code: "http", status: 503 }, { ...temporary, code: "transport", transportCode: "ECONNRESET" }] as JevRequestSettlement[]) {
    const journal = new AiJevJournal({ identity, maxRequests: 20, maxInputTokens: 100_000, maxProviderRecoveries: 2 });
    threeFailures(journal, "first", outcome);
    assert.equal(journal.recoveryEligible(), true);
    const first = journal.reserveRecovery();
    assert.equal(journal.recoveryEligible(), false, "reserved GET cannot be duplicated");
    journal.settleRecovery(first, healthy);
    assert.equal(journal.circuitReason(), null);
    threeFailures(journal, "second", outcome);
    journal.settleRecovery(journal.reserveRecovery(), healthy);
    threeFailures(journal, "third", outcome);
    assert.equal(journal.recoveryEligible(), false, "two attempts are a cumulative cap");
    assert.deepEqual({ ...journal.recoverySummary(), history: [] }, { attempts: 2, successful: 2, failed: 0, unsettled: 0, maxAttempts: 2, circuitEvents: 3, history: [] });
    assert.equal(journal.usage().unknownUsageRequests, 9, "reopening refunds no unknown usage");
  }
  for (const outcome of [failure, { ...temporary, code: "transport" }, { ...temporary, code: "transport", transportCode: "CERT_HAS_EXPIRED" }, { ...temporary, code: "http", status: 400 }] as JevRequestSettlement[]) {
    const journal = new AiJevJournal({ identity, maxRequests: 20, maxInputTokens: 100_000, maxProviderRecoveries: 2 });
    threeFailures(journal, "blocked", outcome);
    assert.equal(journal.recoveryEligible(), false);
    assert.throws(() => journal.reserveRecovery(), /recovery reservation/);
  }
});

test("recovery debit, failed or unsettled GET and allowance survive durable resume", () => {
  for (const settled of [false, true]) {
    const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-recovery-"));
    const options = { directory, identity, maxRequests: 20, maxInputTokens: 100_000, maxProviderRecoveries: 2 };
    const journal = new AiJevJournal(options);
    threeFailures(journal, "first");
    const attempt = journal.reserveRecovery();
    if (settled) journal.settleRecovery(attempt, { healthy: false, status: 503, failure: "http" });
    const usage = journal.usage();
    const summary = journal.recoverySummary();
    journal.close();
    const resumed = new AiJevJournal({ ...options, resume: true });
    assert.deepEqual(resumed.recoverySummary(), summary);
    assert.deepEqual(resumed.usage(), usage);
    assert.equal(resumed.recoveryEligible(), false, "failed or uncertain GET is not retried in the same outage");
    assert.throws(() => resumed.reserveRecovery(), /recovery reservation/);
    resumed.close();
    assert.throws(() => new AiJevJournal({ ...options, resume: true, maxProviderRecoveries: 1 }), /drift/);
  }
});

test("successful recovery persists and later hard failure or outstanding request prevents reopening", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-reopened-"));
  const options = { directory, identity, maxRequests: 20, maxInputTokens: 100_000, maxProviderRecoveries: 2 };
  const journal = new AiJevJournal(options);
  assert.deepEqual(journal.startGame("old-game"), { generation: 0, disabled: false });
  journal.reserve("in-flight", 0, reservation);
  threeFailures(journal, "first");
  assert.throws(() => journal.reserveRecovery(), /recovery reservation/, "settlement must precede GET");
  journal.settle("in-flight", 0, success);
  journal.settleRecovery(journal.reserveRecovery(), healthy);
  journal.close();
  const resumed = new AiJevJournal({ ...options, resume: true });
  assert.equal(resumed.circuitReason(), null);
  assert.equal(resumed.recoverySummary().successful, 1);
  assert.deepEqual(resumed.startGame("old-game"), { generation: 0, disabled: false }, "old incomplete game retains its pre-circuit epoch");
  assert.deepEqual(resumed.startGame("new-game"), { generation: 1, disabled: false });
  resumed.reserve("late", 0, reservation);
  threeFailures(resumed, "second");
  resumed.settle("late", 0, { ...temporary, code: "transport", transportCode: "CERT_HAS_EXPIRED" });
  assert.equal(resumed.circuitReason(), "provider-unrecoverable-failure");
  assert.equal(resumed.recoveryEligible(), false);
  resumed.close();
});

test("journal rejects unknown or misplaced transport diagnostics", () => {
  for (const outcome of [{ ...temporary, transportCode: "ECONNRESET" }, { ...temporary, code: "transport", transportCode: "secret-bearing-text" }, { ...success, transportCode: "ECONNRESET" }]) {
    const journal = new AiJevJournal({ identity, maxRequests: 10, maxInputTokens: 100_000 });
    journal.reserve("game", 0, reservation);
    assert.throws(() => journal.settle("game", 0, outcome as JevRequestSettlement), /transport code/);
  }
});

test("global reservation enforces request and token caps before any concurrent transport starts", async () => {
  for (const tokenLimited of [false, true]) {
    const journal = new AiJevJournal({ identity, maxRequests: tokenLimited ? 10 : 2, maxInputTokens: tokenLimited ? 10_000 : 100_000 });
    let networkCalls = 0;
    const clients = Array.from({ length: 4 }, (_, index) => createJevClient({
      apiKey: "not-a-real-key", model: JEV_PINNED_MODEL,
      budget: { maxRequests: 10, maxInputTokens: 100_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 10_000 },
      onRequestReserved: (request) => journal.reserve(`game-${index}`, 0, request),
      onRequestSettled: (outcome) => journal.settle(`game-${index}`, 0, outcome),
      fetch: async () => { networkCalls += 1; await Promise.resolve(); return Response.json(success.response); },
    }));
    await Promise.allSettled(clients.map((client) => client.evaluate(reservation.state, questions)));
    assert.equal(networkCalls, 2);
    assert.equal(journal.usage().requests, 2);
    assert.ok(journal.usage().reservedInputTokens <= (tokenLimited ? 10_000 : 100_000));
    assert.equal(journal.circuitReason(), "budget");
    assert.equal(journal.usage().unknownUsageRequests, 0);
  }
});

test("per-game usage is independent under interleaved reservations and settlements", () => {
  const journal = new AiJevJournal({ identity, maxRequests: 10, maxInputTokens: 100_000 });
  journal.reserve("first", 0, reservation);
  journal.reserve("second", 0, reservation);
  journal.settle("second", 0, failure);
  journal.settle("first", 0, success);
  assert.equal(journal.usage("first").requests, 1);
  assert.equal(journal.usage("first").inputTokens, 10);
  assert.equal(journal.usage("first").unknownUsageRequests, 0);
  assert.equal(journal.usage("second").inputTokens, 0);
  assert.equal(journal.usage("second").unknownUsageRequests, 1);
  assert.equal(journal.usage().reservedInputTokens, 2 * reservation.reservedInputTokens);
});

test("three consecutive sent failures open a global circuit and success resets the streak", () => {
  const journal = new AiJevJournal({ identity, maxRequests: 10, maxInputTokens: 100_000 });
  for (let index = 0; index < 6; index += 1) {
    journal.reserve("game", index, reservation);
    journal.settle("game", index, index === 2 ? success : failure);
    assert.equal(journal.circuitReason(), index === 5 ? "three-consecutive-provider-failures" : null);
  }
  assert.throws(() => journal.reserve("next", 0, reservation), (error) => error instanceof JevClientError && error.code === "stopped");
});

test("permanent provider refusal and model mismatch open global circuits immediately", () => {
  for (const outcome of [{ ...failure, status: 451 }, { ...failure, validationRule: "model" as const }, { ...failure, budgetExceeded: true }]) {
    const journal = new AiJevJournal({ identity, maxRequests: 10, maxInputTokens: 100_000 });
    journal.reserve("game", 0, reservation);
    journal.settle("game", 0, outcome);
    assert.notEqual(journal.circuitReason(), null);
  }
});

test("resume retains charged reservations, recovers uncertain requests and rejects drift", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-journal-"));
  const options = { identity, directory, maxRequests: 10, maxInputTokens: 100_000 };
  const original = new AiJevJournal(options);
  original.reserve("game", 0, reservation);
  original.settle("game", 0, success);
  original.reserve("game", 1, reservation);
  original.close();
  const resumed = new AiJevJournal({ ...options, resume: true });
  assert.deepEqual(resumed.recorded("game", 0)?.settlement, success);
  assert.equal(resumed.recorded("game", 1)?.settlement?.kind, "error");
  assert.equal(resumed.recorded("game", 1)?.recovered, true);
  assert.equal(resumed.usage().requests, 2);
  assert.equal(resumed.usage().reservedInputTokens, 2 * reservation.reservedInputTokens);
  assert.equal(resumed.usage().unknownUsageRequests, 1);
  resumed.close();
  const secondResume = new AiJevJournal({ ...options, resume: true });
  assert.deepEqual(secondResume.usage(), resumed.usage(), "recovery never charges a second request");
  secondResume.close();
  assert.throws(() => new AiJevJournal({ ...options, identity: { ...identity, source: "changed" }, resume: true }), /drift/);
  assert.throws(() => new AiJevJournal({ ...options, maxRequests: 20, resume: true }), /drift/, "resume cannot silently expand its frozen budget");
});

test("completed game checkpoints survive resume unchanged and cannot be overwritten", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-games-"));
  const options = { identity, directory, maxRequests: 10, maxInputTokens: 100_000 };
  const journal = new AiJevJournal(options);
  const result = { completed: true, placement: 3, initialStateSha256: "initial" };
  journal.writeGame("game", result);
  const bytes = readFileSync(resolve(directory, "games/game.json"), "utf8");
  journal.close();
  const resumed = new AiJevJournal({ ...options, resume: true });
  assert.deepEqual(resumed.readGame("game"), result);
  assert.throws(() => resumed.writeGame("game", { completed: false }), /overwritten/);
  assert.equal(readFileSync(resolve(directory, "games/game.json"), "utf8"), bytes);
  resumed.close();
});

test("validated client usage overrun is durably known and permanently trips global budget", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-overrun-"));
  const options = { directory, identity, maxRequests: 10, maxInputTokens: 100_000 };
  const journal = new AiJevJournal(options);
  let reserved = 0;
  let networkCalls = 0;
  const client = createJevClient({ apiKey: "not-a-real-key", model: JEV_PINNED_MODEL,
    budget: { maxRequests: 10, maxInputTokens: 100_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 10_000 },
    onRequestReserved: (request) => { reserved = request.reservedInputTokens; journal.reserve("overrun", 0, request); },
    onRequestSettled: (settlement) => journal.settle("overrun", 0, settlement),
    fetch: async () => { networkCalls += 1; return Response.json({ ...success.response, usage: { input_tokens: reserved + 1, output_tokens: 2 } }); },
  });
  await assert.rejects(client.evaluate(reservation.state, questions), (error) => error instanceof JevClientError && error.code === "budget");
  assert.equal(networkCalls, 1);
  assert.equal(journal.circuitReason(), "budget");
  assert.equal(journal.usage().knownUsageRequests, 1);
  assert.equal(journal.usage().unknownUsageRequests, 0);
  assert.equal(journal.usage().inputTokens, reserved + 1);
  assert.equal(journal.recorded("overrun", 0)?.settlement?.kind, "error");
  journal.close();
  const resumed = new AiJevJournal({ ...options, resume: true });
  assert.equal(resumed.usage().inputTokens, reserved + 1);
  assert.equal(resumed.circuitReason(), "budget");
  assert.throws(() => resumed.reserve("next", 0, reservation), (error) => error instanceof JevClientError && error.code === "stopped");
  resumed.close();
});

test("resume rejects corrupted reservation amounts and non-sequential ordinals before transport", () => {
  for (const mutation of ["negative", "under-reserved", "ordinal", "nonfinite"] as const) {
    const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-corrupt-"));
    const options = { directory, identity, maxRequests: 10, maxInputTokens: 100_000 };
    const journal = new AiJevJournal(options);
    journal.reserve("game", 0, reservation);
    journal.close();
    const path = resolve(directory, "requests.jsonl");
    const event = JSON.parse(readFileSync(path, "utf8")) as { request: { ordinal: number; reservation: JevRequestReservation } };
    if (mutation === "ordinal") event.request.ordinal = 1;
    else event.request.reservation.reservedInputTokens = mutation === "negative" ? -1 : mutation === "under-reserved" ? 1 : Infinity;
    writeFileSync(path, JSON.stringify(event) + "\n");
    assert.throws(() => new AiJevJournal({ ...options, resume: true }), /journal|sequence/);
  }
});

test("a live owner blocks a second resume even when its claim looks old; dead owners can be taken over", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-owner-"));
  const options = { directory, identity, maxRequests: 10, maxInputTokens: 100_000 };
  const first = new AiJevJournal(options);
  assert.throws(() => new AiJevJournal({ ...options, resume: true }), /live owner/);
  const moduleUrl = new URL("../scripts/ai-jev-journal.ts", import.meta.url).href;
  const competing = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e",
    `import { AiJevJournal } from ${JSON.stringify(moduleUrl)}; try { new AiJevJournal(${JSON.stringify({ ...options, resume: true })}); process.exitCode = 2; } catch (error) { if (!error.message.includes('live owner')) throw error; process.stdout.write('blocked'); }`,
  ], { encoding: "utf8", windowsHide: true });
  assert.equal(competing.status, 0, "a separate resume process cannot become a second owner");
  assert.equal(competing.stdout, "blocked");
  const child = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8", windowsHide: true });
  assert.equal(child.status, 0);
  const terminatedPid = Number(child.stdout);
  assert.ok(Number.isSafeInteger(terminatedPid) && terminatedPid > 0);
  first.close();
  const ownerDirectory = resolve(directory, "owners");
  writeFileSync(resolve(ownerDirectory, "00000000-dead.json"), JSON.stringify({ pid: terminatedPid, owner: "00000000-dead" }) + "\n");
  const resumed = new AiJevJournal({ ...options, resume: true });
  assert.equal(readdirSync(ownerDirectory).length, 1, "only the new live owner remains");
  assert.throws(() => first.reserve("late", 0, reservation), /closed/);
  resumed.close();
});
