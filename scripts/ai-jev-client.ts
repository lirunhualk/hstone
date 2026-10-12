import { Buffer } from "node:buffer";

// Server/CLI only. Wire schema: https://docs.typesafe.ai/api .
export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const JEV_PINNED_MODEL = "jev-1.13.0";

export type JevJson = null | boolean | number | string | JevJson[] | { [key: string]: JevJson };
export type JevDescription = string | JevJson[] | { [key: string]: JevJson };
export type JevChoiceQuestion = {
  type: "choice";
  instructions: JevDescription;
  criteria: Record<string, JevDescription | null>;
};
export type JevScoreQuestion = {
  type: "score";
  instructions: JevDescription;
  criteria: JevDescription[];
};
export type JevNoulQuestion = {
  type: "noul";
  instructions: JevDescription;
  criteria?: { true?: JevDescription; false?: JevDescription };
};
export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;
export type JevChoiceAnswer = {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};
export type JevScoreAnswer = {
  type: "score";
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
  legend: Record<string, string>;
};
export type JevNoulAnswer = { type: "noul"; noul: number };
export type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer;
export type JevTokenUsage = { input_tokens: number; output_tokens: number };
export type JevChoiceProbabilityRounding = { sum: number; count: number; precision: 2 };
export type JevResponse = {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: JevTokenUsage;
  latencyMs: number;
  /** Raw probabilities are retained; these facts explain bounded wire rounding. */
  choiceProbabilityRounding?: Record<string, JevChoiceProbabilityRounding>;
};
export type JevBudget = {
  maxRequests: number;
  maxInputTokens: number;
  maxInputTokensPerRequest: number;
  maxTotalLatencyMs: number;
};
export type JevClientUsage = {
  requests: number;
  reservedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalLatencyMs: number;
  inFlightLatencyMs: number;
  stopped: boolean;
  knownUsageRequests?: number;
  unknownUsageRequests?: number;
  failedRequests?: number;
};
export type JevRequestReservation = {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
  reservedInputTokens: number;
};
export type JevRequestSettlement = {
  knownUsage: JevTokenUsage | null;
  latencyMs: number;
  requestSent: boolean;
  budgetExceeded: boolean;
} & (
  { kind: "success"; response: JevResponse } |
  { kind: "error"; code: JevErrorCode; status?: number; validationRule?: JevValidationRule; validationDiagnostic?: JevValidationDiagnostic; transportCode?: JevTransportCode }
);
export type JevClientOptions = {
  apiKey: string;
  model: string;
  budget: JevBudget;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  endpoint?: string;
  allowLoopbackFixture?: boolean;
  /** No automatic retry; bounded mode permits subsequent new decisions. */
  failurePolicy?: "stop" | "bounded";
  maxConsecutiveFailures?: number;
  onRequestReserved?: (reservation: JevRequestReservation) => void;
  onRequestSettled?: (settlement: JevRequestSettlement) => void;
};
export type JevErrorCode = "configuration" | "request" | "budget" | "aborted" | "timeout" | "transport" | "http" | "response" | "stopped" | "hook";
export const JEV_VALIDATION_RULES = Object.freeze([
  "body-shape", "model", "answers", "usage", "answer-type", "noul",
  "confidence", "distribution-keys", "distribution-range", "distribution-sum",
  "choice", "choice-argmax", "score", "legend", "json", "body-size", "body-missing",
] as const);
export type JevValidationRule = (typeof JEV_VALIDATION_RULES)[number];
export const JEV_TRANSPORT_CODES = Object.freeze([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "UND_ERR_SOCKET", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
  "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_SSL_WRONG_VERSION_NUMBER",
] as const);
export type JevTransportCode = (typeof JEV_TRANSPORT_CODES)[number];

function safeTransportCode(error: unknown): JevTransportCode | undefined {
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 4 && error !== null && typeof error === "object" && !seen.has(error); depth += 1) {
    seen.add(error);
    try {
      const value = error as { code?: unknown; cause?: unknown };
      if (typeof value.code === "string" && JEV_TRANSPORT_CODES.includes(value.code as JevTransportCode)) return value.code as JevTransportCode;
      error = value.cause;
    } catch { return undefined; }
  }
  return undefined;
}
export type JevValidationDiagnostic = {
  readonly distributionSum: number;
  readonly distributionCount: number;
};

// Never attach vendor bodies, fetch exceptions, request data, URLs, or the key.
export class JevClientError extends Error {
  readonly code: JevErrorCode;
  readonly status?: number;
  readonly validationRule?: JevValidationRule;
  readonly validationDiagnostic?: JevValidationDiagnostic;
  readonly transportCode?: JevTransportCode;

  constructor(code: JevErrorCode, status?: number, validationRule?: JevValidationRule, validationDiagnostic?: JevValidationDiagnostic, transportCode?: JevTransportCode) {
    const rule = code === "response" && JEV_VALIDATION_RULES.includes(validationRule as JevValidationRule) ? validationRule : undefined;
    super(`Jev evaluation failed (${code})${status === undefined ? "" : `: HTTP ${status}`}${rule === undefined ? "" : `: rule ${rule}`}${code === "http" && status === 451 ? "; provider access is restricted. Ask TypeSafe support to confirm regional eligibility or investigate incorrect location classification." : ""}`);
    this.name = "JevClientError";
    this.code = code;
    this.status = status;
    this.validationRule = rule;
    if (code === "transport" && JEV_TRANSPORT_CODES.includes(transportCode as JevTransportCode)) this.transportCode = transportCode;
    // Only aggregate numeric facts from a complete, bounded distribution may
    // accompany a sum error. Never attach option labels, values, or raw bodies.
    if (rule === "distribution-sum" && validationDiagnostic &&
      Number.isInteger(validationDiagnostic.distributionCount) &&
      validationDiagnostic.distributionCount >= 1 && validationDiagnostic.distributionCount <= 255 &&
      Number.isFinite(validationDiagnostic.distributionSum) &&
      validationDiagnostic.distributionSum >= 0 && validationDiagnostic.distributionSum <= validationDiagnostic.distributionCount) {
      this.validationDiagnostic = Object.freeze({ distributionSum: validationDiagnostic.distributionSum, distributionCount: validationDiagnostic.distributionCount });
    }
  }
}

function fail(code: JevErrorCode, validationRule?: JevValidationRule, validationDiagnostic?: JevValidationDiagnostic): never {
  throw new JevClientError(code, undefined, validationRule, validationDiagnostic);
}

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function json(value: unknown, ancestors = new Set<unknown>(), depth = 0): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (depth > 48 || (!Array.isArray(value) && !record(value)) || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Object.values(value).every((item) => json(item, ancestors, depth + 1));
  ancestors.delete(value);
  return valid;
}

function description(value: unknown): boolean {
  return (typeof value === "string" || Array.isArray(value) || record(value)) && json(value);
}

function sameKeys(actual: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(actual);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(actual, key));
}

function questionMap(value: unknown): asserts value is Record<string, JevQuestion> {
  if (!record(value) || Object.keys(value).length < 1 || Object.keys(value).length > 128) fail("request");
  for (const [id, question] of Object.entries(value)) {
    if (!id || !record(question) || !description(question.instructions)) fail("request");
    if (question.type === "choice") {
      if (!record(question.criteria)) fail("request");
      const entries = Object.entries(question.criteria);
      if (entries.length < 2 || entries.length > 255 || entries.some(([key, item]) => !key || (item !== null && !description(item)))) fail("request");
    } else if (question.type === "score") {
      if (!Array.isArray(question.criteria) || question.criteria.length < 2 || question.criteria.length > 10 || !question.criteria.every(description)) fail("request");
    } else if (question.type === "noul") {
      if (question.criteria !== undefined && (!record(question.criteria) || Object.entries(question.criteria).some(([key, item]) => !["true", "false"].includes(key) || !description(item)))) fail("request");
    } else {
      fail("request");
    }
    if (Object.keys(question).some((key) => !["type", "instructions", "criteria"].includes(key))) fail("request");
  }
}

function probability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Official Choice confidence, computed from a validated wire distribution.
 * Normalize its accepted rounding mass without modifying provider metadata.
 */
export function jevChoiceConfidence(probabilities: Readonly<Record<string, number>>): number {
  const values = Object.values(probabilities);
  const mass = values.reduce((sum, value) => sum + value, 0);
  if (values.length < 2 || values.length > 255 || !values.every(probability) || mass <= 0) fail("response", "confidence");
  const uniform = 1 / values.length;
  const top = Math.max(...values) / mass;
  return Math.max(0, Math.min(1, (top - uniform) / (1 - uniform)));
}

function distribution(value: unknown, keys: string[], allowRoundedChoice: boolean): {
  probabilities: Record<string, number>;
  rounding?: JevChoiceProbabilityRounding;
} {
  if (!record(value) || !sameKeys(value, keys)) fail("response", "distribution-keys");
  if (!Object.values(value).every(probability)) fail("response", "distribution-range");
  const result = value as Record<string, number>;
  // Live Choice replies use a 0.01 grid. Permit only its bounded accumulated
  // rounding error, capped at 2%; retain every raw value for later inspection.
  // Score distributions keep the existing stricter tolerance.
  const sum = Object.values(result).reduce((total, item) => total + item, 0);
  const delta = Math.abs(sum - 1);
  let rounding: JevChoiceProbabilityRounding | undefined;
  if (delta > 0.005) {
    const onCentGrid = Object.values(result).every((item) => Math.abs(item * 100 - Math.round(item * 100)) < 1e-8);
    if (!allowRoundedChoice || !onCentGrid || sum <= 0 || delta > Math.min(0.02, keys.length * 0.005) + 1e-8) {
      fail("response", "distribution-sum", { distributionSum: sum, distributionCount: keys.length });
    }
    rounding = { sum, count: keys.length, precision: 2 };
  }
  return { probabilities: Object.fromEntries(Object.entries(result)), ...(rounding ? { rounding } : {}) };
}

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validateJevResponse(value: unknown, questions: Record<string, JevQuestion>, model: string, latencyMs = 0): JevResponse {
  if (!record(value)) fail("response", "body-shape");
  if (value.model !== model) fail("response", "model");
  if (!record(value.answers) || !sameKeys(value.answers, Object.keys(questions))) fail("response", "answers");
  if (!record(value.usage) || !integer(value.usage.input_tokens) || !integer(value.usage.output_tokens)) fail("response", "usage");
  const answers: Record<string, JevAnswer> = Object.create(null);
  const choiceProbabilityRounding: Record<string, JevChoiceProbabilityRounding> = Object.create(null);
  for (const [id, question] of Object.entries(questions)) {
    const answer = value.answers[id];
    if (!record(answer) || answer.type !== question.type) fail("response", "answer-type");
    if (question.type === "noul") {
      if (!probability(answer.noul)) fail("response", "noul");
      answers[id] = { type: "noul", noul: answer.noul };
      continue;
    }
    if (!probability(answer.confidence)) fail("response", "confidence");
    const keys = question.type === "choice" ? Object.keys(question.criteria) : question.criteria.map((_, index) => String(index));
    const { probabilities, rounding } = distribution(answer.probabilities, keys, question.type === "choice");
    if (question.type === "choice") {
      if (typeof answer.choice !== "string" || !Object.hasOwn(probabilities, answer.choice)) fail("response", "choice");
      if (keys.some((key) => probabilities[key] > probabilities[answer.choice as string] + 0.005)) fail("response", "choice-argmax");
      answers[id] = { type: "choice", choice: answer.choice, confidence: answer.confidence, probabilities };
      if (rounding) choiceProbabilityRounding[id] = rounding;
    } else {
      const weighted = keys.reduce((sum, key) => sum + Number(key) * probabilities[key], 0);
      if (typeof answer.score !== "number" || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > keys.length - 1 || Math.abs(answer.score - weighted) > 0.02) fail("response", "score");
      if (!record(answer.legend) || !sameKeys(answer.legend, keys) || !Object.values(answer.legend).every((item) => typeof item === "string")) fail("response", "legend");
      // Structured rubrics are rendered by the service; string rubrics must match.
      if (keys.some((key) => typeof question.criteria[Number(key)] === "string" && answer.legend && (answer.legend as Record<string, unknown>)[key] !== question.criteria[Number(key)])) fail("response", "legend");
      answers[id] = { type: "score", score: answer.score, confidence: answer.confidence, probabilities, legend: Object.fromEntries(Object.entries(answer.legend)) as Record<string, string> };
    }
  }
  return { model, answers, usage: { input_tokens: value.usage.input_tokens, output_tokens: value.usage.output_tokens }, latencyMs,
    ...(Object.keys(choiceProbabilityRounding).length ? { choiceProbabilityRounding } : {}) };
}

function endpointUrl(options: JevClientOptions): string {
  let url: URL;
  try {
    url = new URL(options.endpoint ?? JEV_ENDPOINT);
  } catch {
    fail("configuration");
  }
  if (url.username || url.password || url.search || url.hash) fail("configuration");
  if (url.href === JEV_ENDPOINT) return url.href;
  if (options.allowLoopbackFixture && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol)) return url.href;
  return fail("configuration");
}

// Without a vendor tokenizer, reserve UTF-8 bytes plus generous framing padding.
// Reservations are never refunded. If reported usage exceeds one, stop all new
// calls. Request counts remain a hard ceiling even when usage is unavailable.
export function reserveJevInputTokens(body: string, questionCount: number): number {
  return Buffer.byteLength(body, "utf8") + 4096 + questionCount * 256;
}

async function boundedResponseText(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) fail("response", "body-missing");
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) fail("aborted");
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 512 * 1024) fail("response", "body-size");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    signal.removeEventListener("abort", abort);
    if (signal.aborted || length > 512 * 1024) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function reportedUsage(value: unknown, model: string): JevTokenUsage | null {
  if (!record(value) || value.model !== model || !record(value.usage) ||
    !integer(value.usage.input_tokens) || !integer(value.usage.output_tokens)) return null;
  return { input_tokens: value.usage.input_tokens, output_tokens: value.usage.output_tokens };
}

function recoverableFailure(error: JevClientError): boolean {
  if (error.code === "response") return error.validationRule !== "model";
  if (error.code === "timeout" || error.code === "transport") return true;
  return error.code === "http" && error.status !== undefined &&
    (error.status === 429 || (error.status >= 500 && error.status <= 599));
}

/** Hooks are synchronous durability boundaries, never async background work. */
function invokeHook<T>(hook: ((value: T) => void) | undefined, value: T): void {
  if (!hook) return;
  try {
    const returned: unknown = hook(value);
    if (returned && (typeof returned === "object" || typeof returned === "function") &&
      typeof (returned as { then?: unknown }).then === "function") {
      void Promise.resolve(returned).catch(() => undefined);
      fail("hook");
    }
  } catch (error) {
    if (error instanceof JevClientError && (error.code === "budget" || error.code === "stopped")) {
      throw new JevClientError(error.code);
    }
    fail("hook");
  }
}

export function createJevClient(options: JevClientOptions) {
  if (typeof window !== "undefined" || typeof options.apiKey !== "string" || !options.apiKey.trim() || /[\r\n]/.test(options.apiKey) || !/^jev-\d+\.\d+\.\d+$/.test(options.model)) fail("configuration");
  const endpoint = endpointUrl(options);
  const model = options.model;
  const credential = options.apiKey;
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const budget = { ...options.budget };
  const timeoutMs = options.timeoutMs ?? 5000;
  const failurePolicy = options.failurePolicy ?? "stop";
  const maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
  const onRequestReserved = options.onRequestReserved;
  const onRequestSettled = options.onRequestSettled;
  if ([budget.maxRequests, budget.maxInputTokens, budget.maxInputTokensPerRequest, budget.maxTotalLatencyMs].some((item) => !integer(item) || item < 1) || !integer(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000 || budget.maxInputTokensPerRequest > 32_000 || budget.maxInputTokensPerRequest > budget.maxInputTokens || typeof fetchRequest !== "function" || !["stop", "bounded"].includes(failurePolicy) || !integer(maxConsecutiveFailures) || maxConsecutiveFailures < 1 || (onRequestReserved !== undefined && typeof onRequestReserved !== "function") || (onRequestSettled !== undefined && typeof onRequestSettled !== "function")) fail("configuration");
  const usage: JevClientUsage = { requests: 0, reservedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalLatencyMs: 0, inFlightLatencyMs: 0, stopped: false, knownUsageRequests: 0, unknownUsageRequests: 0, failedRequests: 0 };
  let consecutiveFailures = 0;

  return {
    getUsage(): JevClientUsage { return { ...usage }; },
    async evaluate(state: unknown, questions: Record<string, JevQuestion>, signal?: AbortSignal): Promise<JevResponse> {
      if (usage.stopped) fail("stopped");
      if (signal?.aborted) fail("aborted");
      let body: string;
      try {
        if ((!Array.isArray(state) && !record(state) && typeof state !== "string") || !json(state)) fail("request");
        questionMap(questions);
        body = JSON.stringify({ state, model, questions });
      } catch {
        fail("request");
      }
      // Snapshot the exact transmitted questions against caller mutations.
      const requestQuestions = (JSON.parse(body) as { questions: Record<string, JevQuestion> }).questions;
      questionMap(requestQuestions);
      const reservedInputTokens = reserveJevInputTokens(body, Object.keys(requestQuestions).length);
      if (signal?.aborted) fail("aborted");
      const remainingLatency = budget.maxTotalLatencyMs - usage.totalLatencyMs - usage.inFlightLatencyMs;
      const leaseMs = Math.min(timeoutMs, Math.floor(remainingLatency));
      if (leaseMs < 1 || usage.requests >= budget.maxRequests || reservedInputTokens > budget.maxInputTokensPerRequest || usage.reservedInputTokens + reservedInputTokens > budget.maxInputTokens) {
        usage.stopped = true;
        fail("budget");
      }
      // Reserve synchronously before any await, including concurrent callers.
      usage.requests += 1;
      usage.reservedInputTokens += reservedInputTokens;
      usage.inFlightLatencyMs += leaseMs;
      const controller = new AbortController();
      const started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abortListener: (() => void) | undefined;
      let requestSent = false;
      const observed = { knownUsage: null as JevTokenUsage | null, usageOverrun: false };
      let result: JevResponse | undefined;
      let failure: JevClientError | undefined;
      try {
        // Hook data is detached from both caller objects and validation input.
        const hookPayload = JSON.parse(body) as { state: unknown; questions: Record<string, JevQuestion> };
        invokeHook(onRequestReserved, { model, state: hookPayload.state, questions: hookPayload.questions, reservedInputTokens });
        if (signal?.aborted) fail("aborted");
        const remainingLease = leaseMs - (performance.now() - started);
        if (remainingLease <= 0) fail("timeout");
        const interrupted = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new JevClientError("timeout")); }, remainingLease);
          abortListener = () => { controller.abort(); reject(new JevClientError("aborted")); };
          signal?.addEventListener("abort", abortListener, { once: true });
        });
        const operation = (async () => {
          requestSent = true;
          const response = await fetchRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` }, body, signal: controller.signal, redirect: "error" });
          if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            throw new JevClientError("http", response.status);
          }
          const text = await boundedResponseText(response, controller.signal);
          let value: unknown;
          try { value = JSON.parse(text); } catch { fail("response", "json"); }
          const reported = reportedUsage(value, model);
          if (reported && reported.input_tokens > reservedInputTokens) {
            observed.usageOverrun = true;
            // Invalid answers retain their original rejection; only a fully
            // valid response can report an observed overrun as known usage.
            const validated = validateJevResponse(value, requestQuestions, model);
            observed.knownUsage = validated.usage;
            fail("budget");
          }
          observed.knownUsage = reported;
          return validateJevResponse(value, requestQuestions, model, performance.now() - started);
        })();
        result = await Promise.race([operation, interrupted]);
      } catch (error) {
        failure = error instanceof JevClientError ? error : new JevClientError(signal?.aborted ? "aborted" : "transport", undefined, undefined, undefined, safeTransportCode(error));
        controller.abort();
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (abortListener) signal?.removeEventListener("abort", abortListener);
        usage.inFlightLatencyMs -= leaseMs;
        usage.totalLatencyMs += performance.now() - started;
      }
      if (requestSent) {
        if (observed.knownUsage) {
          usage.inputTokens += observed.knownUsage.input_tokens;
          usage.outputTokens += observed.knownUsage.output_tokens;
          usage.knownUsageRequests = (usage.knownUsageRequests ?? 0) + 1;
        } else usage.unknownUsageRequests = (usage.unknownUsageRequests ?? 0) + 1;
      }
      if (failure) {
        usage.failedRequests = (usage.failedRequests ?? 0) + 1;
        consecutiveFailures += 1;
        if (observed.usageOverrun || failurePolicy === "stop" || !recoverableFailure(failure) || consecutiveFailures >= maxConsecutiveFailures) usage.stopped = true;
      } else consecutiveFailures = 0;
      const common = { knownUsage: observed.knownUsage, requestSent, budgetExceeded: observed.usageOverrun, latencyMs: performance.now() - started };
      const settlement: JevRequestSettlement = failure
        ? { kind: "error", ...common, code: failure.code, status: failure.status, validationRule: failure.validationRule, validationDiagnostic: failure.validationDiagnostic, transportCode: failure.transportCode }
        : { kind: "success", ...common, response: result! };
      try { invokeHook(onRequestSettled, JSON.parse(JSON.stringify(settlement)) as JevRequestSettlement); }
      catch {
        usage.stopped = true;
        if (!failure) usage.failedRequests = (usage.failedRequests ?? 0) + 1;
        fail("hook");
      }
      if (failure) throw failure;
      return result!;
    },
  };
}

export type JevClient = ReturnType<typeof createJevClient>;
