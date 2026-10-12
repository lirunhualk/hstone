import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { JevClientError, JEV_TRANSPORT_CODES, JEV_VALIDATION_RULES, reserveJevInputTokens, validateJevResponse, type JevClientUsage, type JevRequestReservation, type JevRequestSettlement } from "./ai-jev-client.ts";
import type { JevProviderHealth } from "./ai-jev-health.ts";

export function jevJournalHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export interface AiJevJournalOptions {
  directory?: string;
  identity: unknown;
  resume?: boolean;
  maxRequests: number;
  maxInputTokens: number;
  maxProviderRecoveries?: number;
}

export interface AiJevRecoveryHistory {
  attempt: number;
  healthy: boolean | null;
  status: number | null;
  failure: string | null;
  startedAt: string;
  settledAt: string | null;
}

export interface AiJevRecoverySummary {
  attempts: number;
  successful: number;
  failed: number;
  unsettled: number;
  maxAttempts: number;
  circuitEvents: number;
  history: AiJevRecoveryHistory[];
}

export interface AiJevJournalRequest {
  game: string;
  ordinal: number;
  hash: string;
  reservation: JevRequestReservation;
  settlement?: JevRequestSettlement;
  recovered?: boolean;
}

type JournalEvent =
  | { kind: "reserve"; request: AiJevJournalRequest }
  | { kind: "settle"; game: string; ordinal: number; settlement: JevRequestSettlement; recovered?: boolean }
  | { kind: "circuit"; reason: string; recoverable?: boolean }
  | { kind: "probe-reserve"; attempt: number; circuit: number; startedAt: string }
  | { kind: "probe-settle"; attempt: number; health: JevProviderHealth; settledAt: string }
  | { kind: "game-start"; game: string; generation: number; disabled: boolean };

const RECOVERABLE_TRANSPORT_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT"]);

function recoverableFailure(settlement: JevRequestSettlement): boolean {
  return settlement.kind === "error" && settlement.requestSent && !settlement.budgetExceeded &&
    (settlement.code === "timeout" || (settlement.code === "http" && (settlement.status === 429 || (settlement.status ?? 0) >= 500)) ||
      (settlement.code === "transport" && RECOVERABLE_TRANSPORT_CODES.has(settlement.transportCode ?? "")));
}

function timestamp(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)); }

function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function positiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 48) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  return (Array.isArray(value) || object(value)) && Object.values(value).every((child) => safeJson(child, depth + 1));
}

function validateReservation(value: unknown): asserts value is JevRequestReservation {
  if (!object(value) || typeof value.model !== "string" || !/^jev-\d+\.\d+\.\d+$/.test(value.model) ||
    (!object(value.state) && !Array.isArray(value.state) && typeof value.state !== "string") || !safeJson(value.state) ||
    !object(value.questions) || Object.keys(value.questions).length < 1 || Object.keys(value.questions).length > 128) throw new Error("invalid Jev journal request schema");
  for (const [id, question] of Object.entries(value.questions)) {
    if (!id || !object(question) || !["choice", "score", "noul"].includes(String(question.type)) ||
      !(typeof question.instructions === "string" || Array.isArray(question.instructions) || object(question.instructions)) || !safeJson(question) ||
      Object.keys(question).some((key) => !["type", "instructions", "criteria"].includes(key))) throw new Error("invalid Jev journal question schema");
    if (question.type === "choice" && (!object(question.criteria) || Object.keys(question.criteria).length < 2 || Object.keys(question.criteria).length > 255)) throw new Error("invalid Jev journal Choice criteria");
    if (question.type === "score" && (!Array.isArray(question.criteria) || question.criteria.length < 2 || question.criteria.length > 10)) throw new Error("invalid Jev journal Score criteria");
    if (question.type === "noul" && question.criteria !== undefined && (!object(question.criteria) || Object.keys(question.criteria).some((key) => !["true", "false"].includes(key)))) throw new Error("invalid Jev journal Noul criteria");
  }
  const expected = reserveJevInputTokens(JSON.stringify({ model: value.model, state: value.state, questions: value.questions }), Object.keys(value.questions).length);
  if (!positiveInteger(value.reservedInputTokens) || value.reservedInputTokens !== expected || expected > 32_000) throw new Error("invalid Jev journal reservation amount");
}

function validateSettlement(value: unknown, request: AiJevJournalRequest): asserts value is JevRequestSettlement {
  if (!object(value) || !["success", "error"].includes(String(value.kind)) || typeof value.requestSent !== "boolean" || typeof value.budgetExceeded !== "boolean" ||
    typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs) || value.latencyMs < 0) throw new Error("invalid Jev journal settlement schema");
  const validatedOverrun = value.kind === "error" && value.code === "budget" && value.budgetExceeded === true && value.requestSent === true;
  if (value.knownUsage !== null && (!object(value.knownUsage) || !Number.isSafeInteger(value.knownUsage.input_tokens) || Number(value.knownUsage.input_tokens) < 0 || (!validatedOverrun && Number(value.knownUsage.input_tokens) > request.reservation.reservedInputTokens) || !Number.isSafeInteger(value.knownUsage.output_tokens) || Number(value.knownUsage.output_tokens) < 0)) throw new Error("invalid Jev journal known usage");
  if (!value.requestSent && value.knownUsage !== null) throw new Error("unsent Jev request cannot have charged known usage");
  if (value.transportCode !== undefined && (value.kind !== "error" || value.code !== "transport" || !JEV_TRANSPORT_CODES.includes(value.transportCode as never))) throw new Error("invalid Jev journal transport code");
  if (value.kind === "success") {
    const response = validateJevResponse(value.response, request.reservation.questions, request.reservation.model, value.latencyMs);
    if (!value.requestSent || jevJournalHash(response.usage) !== jevJournalHash(value.knownUsage)) throw new Error("invalid Jev journal successful usage");
  } else {
    if (!["configuration", "request", "budget", "aborted", "timeout", "transport", "http", "response", "stopped", "hook"].includes(String(value.code)) ||
      (value.status !== undefined && (!Number.isInteger(value.status) || Number(value.status) < 100 || Number(value.status) > 599)) ||
      (value.validationRule !== undefined && !JEV_VALIDATION_RULES.includes(value.validationRule as never))) throw new Error("invalid Jev journal provider failure");
    if (value.validationDiagnostic !== undefined && (!object(value.validationDiagnostic) || value.validationRule !== "distribution-sum" || !positiveInteger(value.validationDiagnostic.distributionCount) || value.validationDiagnostic.distributionCount > 255 || typeof value.validationDiagnostic.distributionSum !== "number" || !Number.isFinite(value.validationDiagnostic.distributionSum) || value.validationDiagnostic.distributionSum < 0 || value.validationDiagnostic.distributionSum > value.validationDiagnostic.distributionCount)) throw new Error("invalid Jev journal validation diagnostic");
  }
}

/** Request writes precede network I/O; settlement writes precede engine actions. */
export class AiJevJournal {
  readonly #options: AiJevJournalOptions;
  readonly #requests = new Map<string, AiJevJournalRequest>();
  readonly #games = new Map<string, unknown>();
  readonly #gameStarts = new Map<string, { generation: number; disabled: boolean }>();
  #circuit: string | null = null;
  #consecutiveFailures = 0;
  #recentFailures: JevRequestSettlement[] = [];
  #recoverableCircuit = false;
  #circuitEvents = 0;
  readonly #probes: (AiJevRecoveryHistory & { circuit: number })[] = [];
  #reservedRequests = 0;
  #reservedTokens = 0;
  readonly #requestCounts = new Map<string, number>();
  #owner: string | undefined;
  #closed = false;

  constructor(options: AiJevJournalOptions) {
    this.#options = { ...options };
    if (!positiveInteger(options.maxRequests) || !positiveInteger(options.maxInputTokens)) throw new Error("invalid Jev journal global budget");
    if (!Number.isSafeInteger(options.maxProviderRecoveries ?? 0) || (options.maxProviderRecoveries ?? 0) < 0 || (options.maxProviderRecoveries ?? 0) > 2) throw new Error("invalid Jev recovery attempt cap");
    if (!options.directory) {
      if (options.resume) throw new Error("resume requires a durable Jev journal");
      return;
    }
    mkdirSync(options.directory, { recursive: true });
    this.#acquireOwner();
    try {
    const manifest = resolve(options.directory, "manifest.json");
    const manifestIdentity = { identity: options.identity, maxRequests: options.maxRequests, maxInputTokens: options.maxInputTokens, maxProviderRecoveries: options.maxProviderRecoveries ?? 0 };
    if (options.resume) {
      if (!existsSync(manifest) || readFileSync(manifest, "utf8").trim() !== JSON.stringify(manifestIdentity)) throw new Error("Jev resume source or configuration drift");
      const path = resolve(options.directory, "requests.jsonl");
      if (existsSync(path)) {
        const text = readFileSync(path, "utf8");
        if (text && !text.endsWith("\n")) throw new Error("Jev request journal has a partial durable record; do not resend requests");
        for (const line of text.split("\n").filter(Boolean)) this.#apply(JSON.parse(line) as JournalEvent);
      }
      // A reserved request might have reached the provider even if the process
      // died before recording its answer. Never send that request again.
      for (const request of this.#requests.values()) if (!request.settlement) {
        this.settle(request.game, request.ordinal, { kind: "error", code: "aborted", knownUsage: null, latencyMs: 0, requestSent: true, budgetExceeded: false }, true);
      }
      if (this.#consecutiveFailures >= 3) this.trip("three-consecutive-provider-failures", this.#recentFailures.length === 3 && this.#recentFailures.every(recoverableFailure));
      for (const request of this.#requests.values()) {
        const outcome = request.settlement;
        if (outcome?.kind !== "error") continue;
        if ([401, 403, 451].includes(outcome.status ?? 0)) this.trip(`provider-http-${outcome.status}`);
        if (outcome.validationRule === "model") this.trip("provider-model-mismatch");
        if (outcome.budgetExceeded || outcome.code === "budget") this.trip("budget");
      }
    } else {
      mkdirSync(options.directory, { recursive: true });
      writeFileSync(manifest, JSON.stringify(manifestIdentity) + "\n", { flag: "wx", flush: true });
    }
    } catch (error) { this.close(); throw error; }
  }

  #acquireOwner(): void {
    const directory = resolve(this.#options.directory!, "owners");
    mkdirSync(directory, { recursive: true });
    const owner = randomUUID();
    const ownPath = resolve(directory, `${owner}.json`);
    writeFileSync(ownPath, JSON.stringify({ pid: process.pid, owner }) + "\n", { flag: "wx", flush: true });
    this.#owner = owner;
    try {
      // Unique immutable owner paths avoid a stale-lock unlink deleting a new
      // owner's replacement. Every entrant creates its claim before scanning;
      // concurrent entrants either see an existing live owner or both refuse.
      for (const entry of readdirSync(directory)) {
        if (entry === `${owner}.json`) continue;
        if (!/^[a-f0-9-]+\.json$/.test(entry)) throw new Error("invalid Jev run owner entry");
        const path = resolve(directory, entry);
        let bytes: string;
        try { bytes = readFileSync(path, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
        const current = JSON.parse(bytes) as { pid?: unknown; owner?: unknown };
        if (!positiveInteger(current.pid) || typeof current.owner !== "string") throw new Error("Jev owner lock is invalid; cannot prove its process ended");
        try { process.kill(current.pid, 0); }
        catch (probeError) {
          if ((probeError as NodeJS.ErrnoException).code === "ESRCH") {
            try {
              if (readFileSync(path, "utf8") !== bytes) throw new Error("Jev run owner changed during takeover");
              unlinkSync(path);
            } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
            continue;
          }
          throw new Error("Jev run owner cannot be verified; refuse concurrent resume");
        }
        throw new Error("Jev run already has a live owner; refuse concurrent resume");
      }
    } catch (error) {
      this.close();
      this.#owner = undefined;
      throw error;
    }
  }

  #assertOwner(): void {
    if (this.#closed) throw new Error("Jev journal owner is closed");
    if (!this.#options.directory) return;
    const owner = JSON.parse(readFileSync(resolve(this.#options.directory, "owners", `${this.#owner}.json`), "utf8")) as { pid: number; owner: string };
    if (owner.pid !== process.pid || owner.owner !== this.#owner) throw new Error("Jev journal owner changed");
  }

  close(): void {
    if (this.#closed) return;
    if (this.#owner) {
      this.#assertOwner();
      unlinkSync(resolve(this.#options.directory!, "owners", `${this.#owner}.json`));
    }
    this.#closed = true;
  }

  #key(game: string, ordinal: number): string { return `${game}:${ordinal}`; }

  #append(event: JournalEvent): void {
    this.#assertOwner();
    this.#validateEvent(event);
    if (this.#options.directory) appendFileSync(resolve(this.#options.directory, "requests.jsonl"), JSON.stringify(event) + "\n", { flush: true });
    this.#apply(event);
  }

  #apply(event: JournalEvent): void {
    this.#validateEvent(event);
    if (event.kind === "circuit") { this.#circuit = event.reason; this.#recoverableCircuit = event.recoverable === true; this.#circuitEvents += 1; return; }
    if (event.kind === "game-start") { this.#gameStarts.set(event.game, { generation: event.generation, disabled: event.disabled }); return; }
    if (event.kind === "probe-reserve") {
      this.#probes.push({ attempt: event.attempt, circuit: event.circuit, startedAt: event.startedAt, settledAt: null, healthy: null, status: null, failure: null });
      return;
    }
    if (event.kind === "probe-settle") {
      const probe = this.#probes[event.attempt - 1];
      Object.assign(probe, { ...event.health, settledAt: event.settledAt });
      if (event.health.healthy && this.#circuitEvents === probe.circuit && this.#recoverableCircuit) {
        this.#circuit = null; this.#recoverableCircuit = false; this.#consecutiveFailures = 0; this.#recentFailures = [];
      }
      return;
    }
    if (event.kind === "reserve") {
      const request = event.request;
      const key = this.#key(request.game, request.ordinal);
      if (this.#requests.has(key) || request.hash !== jevJournalHash({ model: request.reservation.model, state: request.reservation.state, questions: request.reservation.questions })) throw new Error("invalid or duplicated Jev request journal reservation");
      this.#requests.set(key, request);
      this.#reservedRequests += 1;
      this.#reservedTokens += request.reservation.reservedInputTokens;
      this.#requestCounts.set(request.game, request.ordinal + 1);
      return;
    }
    const request = this.#requests.get(this.#key(event.game, event.ordinal));
    if (!request || request.settlement) throw new Error("invalid or duplicated Jev request journal settlement");
    request.settlement = event.settlement;
    request.recovered = event.recovered;
    if (event.settlement.requestSent && !event.recovered) {
      this.#consecutiveFailures = event.settlement.kind === "success" ? 0 : this.#consecutiveFailures + 1;
      this.#recentFailures = event.settlement.kind === "success" ? [] : [...this.#recentFailures, event.settlement].slice(-3);
    }
  }

  #validateEvent(value: unknown): asserts value is JournalEvent {
    if (!object(value)) throw new Error("invalid Jev journal event");
    if (value.kind === "game-start") {
      if (typeof value.game !== "string" || value.game.length > 192 || !/^[A-Za-z0-9_-]+$/.test(value.game) || this.#gameStarts.has(value.game) || value.generation !== this.#circuitEvents || value.disabled !== (this.#circuit !== null)) throw new Error("invalid Jev game start generation");
      return;
    }
    if (value.kind === "circuit") {
      if (typeof value.reason !== "string" || !/^(?:budget|three-consecutive-provider-failures|provider-unrecoverable-failure|provider-model-mismatch|provider-http-(?:401|403|451))$/.test(value.reason) ||
        (value.recoverable !== undefined && typeof value.recoverable !== "boolean") ||
        (value.recoverable === true && (value.reason !== "three-consecutive-provider-failures" || this.#recentFailures.length !== 3 || !this.#recentFailures.every(recoverableFailure)))) throw new Error("invalid Jev circuit reason");
      return;
    }
    if (value.kind === "probe-reserve") {
      if (!this.recoveryEligible() || value.attempt !== this.#probes.length + 1 || value.circuit !== this.#circuitEvents || !timestamp(value.startedAt) || this.pendingRequests() !== 0) throw new Error("invalid Jev recovery reservation");
      return;
    }
    if (value.kind === "probe-settle") {
      const probe = typeof value.attempt === "number" ? this.#probes[value.attempt - 1] : undefined;
      const health = value.health;
      if (!probe || probe.settledAt !== null || !timestamp(value.settledAt) || Date.parse(value.settledAt) < Date.parse(probe.startedAt) || !object(health) || typeof health.healthy !== "boolean" ||
        (health.status !== null && (!Number.isInteger(health.status) || Number(health.status) < 100 || Number(health.status) > 599)) ||
        ![null, "timeout", "transport", "http", "shape"].includes(health.failure as never) ||
        (health.healthy ? health.status !== 200 || health.failure !== null : health.failure === null)) throw new Error("invalid Jev recovery settlement");
      return;
    }
    const request = value.kind === "reserve" ? value.request : value;
    if (!object(request) || typeof request.game !== "string" || request.game.length > 192 || !/^[A-Za-z0-9_-]+$/.test(request.game) || !Number.isSafeInteger(request.ordinal) || Number(request.ordinal) < 0 || Number(request.ordinal) >= this.#options.maxRequests) throw new Error("invalid Jev request journal identity");
    if (value.kind === "reserve") {
      if (Object.keys(request).some((key) => !["game", "ordinal", "hash", "reservation"].includes(key)) || request.ordinal !== (this.#requestCounts.get(request.game) ?? 0)) throw new Error("invalid Jev request journal sequence");
      validateReservation(request.reservation);
      if (this.#reservedRequests + 1 > this.#options.maxRequests || this.#reservedTokens + request.reservation.reservedInputTokens > this.#options.maxInputTokens) throw new Error("Jev journal exceeds frozen global budget");
    } else if (value.kind === "settle") {
      const reserved = this.#requests.get(this.#key(request.game, Number(request.ordinal)));
      if (!reserved || reserved.settlement || (value.recovered !== undefined && typeof value.recovered !== "boolean")) throw new Error("invalid Jev journal settlement identity");
      validateSettlement(value.settlement, reserved);
    } else throw new Error("invalid Jev journal event kind");
  }

  circuitReason(): string | null { return this.#circuit; }

  circuitGeneration(): number { return this.#circuitEvents; }

  startGame(game: string): { generation: number; disabled: boolean } {
    const previous = this.#gameStarts.get(game);
    if (previous) return { ...previous };
    this.#append({ kind: "game-start", game, generation: this.#circuitEvents, disabled: this.#circuit !== null });
    return { ...this.#gameStarts.get(game)! };
  }

  pendingRequests(): number { return [...this.#requests.values()].filter((request) => !request.settlement).length; }

  recoveryEligible(): boolean {
    return this.#reservedRequests < this.#options.maxRequests && this.#reservedTokens < this.#options.maxInputTokens && this.#circuit === "three-consecutive-provider-failures" && this.#recoverableCircuit && this.#probes.length < (this.#options.maxProviderRecoveries ?? 0) && !this.#probes.some((probe) => probe.circuit === this.#circuitEvents);
  }

  reserveRecovery(): number {
    const attempt = this.#probes.length + 1;
    this.#append({ kind: "probe-reserve", attempt, circuit: this.#circuitEvents, startedAt: new Date().toISOString() });
    return attempt;
  }

  settleRecovery(attempt: number, health: JevProviderHealth): void {
    this.#append({ kind: "probe-settle", attempt, health: structuredClone(health), settledAt: new Date().toISOString() });
  }

  recoverySummary(): AiJevRecoverySummary {
    return { attempts: this.#probes.length, successful: this.#probes.filter((probe) => probe.healthy === true).length, failed: this.#probes.filter((probe) => probe.healthy === false).length, unsettled: this.#probes.filter((probe) => probe.healthy === null).length, maxAttempts: this.#options.maxProviderRecoveries ?? 0, circuitEvents: this.#circuitEvents, history: this.#probes.map((probe) => ({ attempt: probe.attempt, healthy: probe.healthy, status: probe.status, failure: probe.failure, startedAt: probe.startedAt, settledAt: probe.settledAt })) };
  }

  trip(reason: string, recoverable = false): void {
    if (!this.#circuit || (this.#recoverableCircuit && reason !== "three-consecutive-provider-failures")) this.#append({ kind: "circuit", reason, ...(recoverable ? { recoverable } : {}) });
  }

  recorded(game: string, ordinal: number): AiJevJournalRequest | undefined {
    return this.#requests.get(this.#key(game, ordinal));
  }

  reserve(game: string, ordinal: number, reservation: JevRequestReservation): void {
    validateReservation(reservation);
    if (!/^[A-Za-z0-9_-]+$/.test(game) || !Number.isSafeInteger(ordinal) || ordinal < 0 || !Number.isSafeInteger(reservation.reservedInputTokens) || reservation.reservedInputTokens < 1 || this.recorded(game, ordinal)) throw new Error("invalid Jev reservation identity or amount");
    if (this.#circuit) throw new JevClientError("stopped");
    if (this.#reservedRequests >= this.#options.maxRequests || this.#reservedTokens + reservation.reservedInputTokens > this.#options.maxInputTokens) {
      this.trip("budget");
      throw new JevClientError("budget");
    }
    const detached = JSON.parse(JSON.stringify(reservation)) as JevRequestReservation;
    this.#append({ kind: "reserve", request: { game, ordinal, hash: jevJournalHash({ model: detached.model, state: detached.state, questions: detached.questions }), reservation: detached } });
  }

  settle(game: string, ordinal: number, settlement: JevRequestSettlement, recovered = false): void {
    // A global preflight refusal has no reservation and no possibly paid request.
    if (!this.recorded(game, ordinal)) return;
    this.#append({ kind: "settle", game, ordinal, settlement: JSON.parse(JSON.stringify(settlement)) as JevRequestSettlement, ...(recovered ? { recovered } : {}) });
    if (settlement.kind === "error") {
      if ([401, 403, 451].includes(settlement.status ?? 0)) this.trip(`provider-http-${settlement.status}`);
      else if (settlement.validationRule === "model") this.trip("provider-model-mismatch");
      else if (settlement.code === "budget" || settlement.budgetExceeded) this.trip("budget");
      else if (this.#recoverableCircuit && settlement.requestSent && !recoverableFailure(settlement)) this.trip("provider-unrecoverable-failure");
      else if (this.#consecutiveFailures >= 3) this.trip("three-consecutive-provider-failures", this.#recentFailures.length === 3 && this.#recentFailures.every(recoverableFailure));
    }
  }

  usage(game?: string): JevClientUsage {
    const values = [...this.#requests.values()].filter((request) => game === undefined || request.game === game);
    const sent = values.filter((request) => request.settlement?.requestSent !== false);
    const known = sent.filter((request) => request.settlement?.knownUsage !== null && request.settlement?.knownUsage !== undefined);
    return {
      requests: sent.length,
      reservedInputTokens: values.reduce((sum, request) => sum + request.reservation.reservedInputTokens, 0),
      inputTokens: known.reduce((sum, request) => sum + request.settlement!.knownUsage!.input_tokens, 0),
      outputTokens: known.reduce((sum, request) => sum + request.settlement!.knownUsage!.output_tokens, 0),
      totalLatencyMs: values.reduce((sum, request) => sum + (request.settlement?.latencyMs ?? 0), 0),
      inFlightLatencyMs: 0,
      stopped: this.#circuit !== null,
      knownUsageRequests: known.length,
      unknownUsageRequests: sent.length - known.length,
      failedRequests: sent.filter((request) => request.settlement?.kind === "error").length,
    };
  }

  readGame<Result>(key: string): Result | undefined {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error("invalid Jev game checkpoint key");
    if (this.#games.has(key)) return structuredClone(this.#games.get(key)) as Result;
    if (!this.#options.directory) return undefined;
    const path = resolve(this.#options.directory, "games", `${key}.json`);
    if (!existsSync(path)) return undefined;
    const value = JSON.parse(readFileSync(path, "utf8")) as { hash: string; result: Result };
    if (value.hash !== jevJournalHash(value.result)) throw new Error("Jev game checkpoint integrity mismatch");
    this.#games.set(key, value.result);
    return structuredClone(value.result);
  }

  writeGame<Result>(key: string, result: Result): void {
    this.#assertOwner();
    if (this.readGame(key) !== undefined) throw new Error("Jev completed game checkpoints cannot be overwritten");
    if (this.#options.directory) {
      const directory = resolve(this.#options.directory, "games");
      mkdirSync(directory, { recursive: true });
      const path = resolve(directory, `${key}.json`);
      writeFileSync(`${path}.next`, JSON.stringify({ hash: jevJournalHash(result), result }) + "\n", { flush: true });
      renameSync(`${path}.next`, path);
    }
    this.#games.set(key, structuredClone(result));
  }
}
