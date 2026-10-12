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
