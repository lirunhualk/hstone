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
};
export type JevClientOptions = {
  apiKey: string;
  model: string;
  budget: JevBudget;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  endpoint?: string;
  allowLoopbackFixture?: boolean;
};
export type JevErrorCode = "configuration" | "request" | "budget" | "aborted" | "timeout" | "transport" | "http" | "response" | "stopped";
export const JEV_VALIDATION_RULES = Object.freeze([
  "body-shape", "model", "answers", "usage", "answer-type", "noul",
  "confidence", "distribution-keys", "distribution-range", "distribution-sum",
  "choice", "choice-argmax", "score", "legend", "json", "body-size", "body-missing",
] as const);
export type JevValidationRule = (typeof JEV_VALIDATION_RULES)[number];
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

  constructor(code: JevErrorCode, status?: number, validationRule?: JevValidationRule, validationDiagnostic?: JevValidationDiagnostic) {
    const rule = code === "response" && JEV_VALIDATION_RULES.includes(validationRule as JevValidationRule) ? validationRule : undefined;
    super(`Jev evaluation failed (${code})${status === undefined ? "" : `: HTTP ${status}`}${rule === undefined ? "" : `: rule ${rule}`}${code === "http" && status === 451 ? "; provider access is restricted. Ask TypeSafe support to confirm regional eligibility or investigate incorrect location classification." : ""}`);
    this.name = "JevClientError";
    this.code = code;
    this.status = status;
    this.validationRule = rule;
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

export function createJevClient(options: JevClientOptions) {
  if (typeof window !== "undefined" || typeof options.apiKey !== "string" || !options.apiKey.trim() || /[\r\n]/.test(options.apiKey) || !/^jev-\d+\.\d+\.\d+$/.test(options.model)) fail("configuration");
  const endpoint = endpointUrl(options);
  const model = options.model;
  const credential = options.apiKey;
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const budget = { ...options.budget };
  const timeoutMs = options.timeoutMs ?? 5000;
  if ([budget.maxRequests, budget.maxInputTokens, budget.maxInputTokensPerRequest, budget.maxTotalLatencyMs].some((item) => !integer(item) || item < 1) || !integer(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000 || budget.maxInputTokensPerRequest > 32_000 || budget.maxInputTokensPerRequest > budget.maxInputTokens || typeof fetchRequest !== "function") fail("configuration");
  const usage: JevClientUsage = { requests: 0, reservedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalLatencyMs: 0, inFlightLatencyMs: 0, stopped: false };

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
      if (leaseMs < 1 || usage.requests >= budget.maxRequests || reservedInputTokens > budget.maxInputTokensPerRequest || usage.reservedInputTokens + reservedInputTokens > budget.maxInputTokens) fail("budget");
      // Reserve synchronously before any await, including concurrent callers.
      usage.requests += 1;
      usage.reservedInputTokens += reservedInputTokens;
      usage.inFlightLatencyMs += leaseMs;
      const controller = new AbortController();
      const started = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abortListener: (() => void) | undefined;
      const interrupted = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new JevClientError("timeout")); }, leaseMs);
        abortListener = () => { controller.abort(); reject(new JevClientError("aborted")); };
        signal?.addEventListener("abort", abortListener, { once: true });
      });
      try {
        const operation = (async () => {
          const response = await fetchRequest(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` }, body, signal: controller.signal, redirect: "error" });
          if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            throw new JevClientError("http", response.status);
          }
          const text = await boundedResponseText(response, controller.signal);
          let value: unknown;
          try { value = JSON.parse(text); } catch { fail("response", "json"); }
          return validateJevResponse(value, requestQuestions, model, performance.now() - started);
        })();
        const result = await Promise.race([operation, interrupted]);
        usage.inputTokens += result.usage.input_tokens;
        usage.outputTokens += result.usage.output_tokens;
        if (result.usage.input_tokens > reservedInputTokens) {
          usage.stopped = true;
          fail("budget");
        }
        return result;
      } catch (error) {
        // A failed/unknown request may still be charged. Fail closed; no retries.
        usage.stopped = true;
        controller.abort();
        if (error instanceof JevClientError) throw error;
        throw new JevClientError(controller.signal.aborted && signal?.aborted ? "aborted" : "transport");
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (abortListener) signal?.removeEventListener("abort", abortListener);
        usage.inFlightLatencyMs -= leaseMs;
        usage.totalLatencyMs += performance.now() - started;
      }
    },
  };
}

export type JevClient = ReturnType<typeof createJevClient>;
