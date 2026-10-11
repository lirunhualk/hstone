import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createJevClient, JEV_PINNED_MODEL, JevClientError, type JevResponse } from "./ai-jev-client.ts";
import { loadAiJevCredential } from "./benchmark-ai-jev.ts";

const REPO = fileURLToPath(new URL("../", import.meta.url));
const MODEL_ENDPOINT = "https://api.typesafe.ai/v1/models";
const REGION_MESSAGE = "Typesafe is not available in your region.";
const MODEL_LIST_MAX_BYTES = 64_000;

async function boundedModelListText(response: Response, signal: AbortSignal): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("model-list-body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let completed = false;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Error("model-list-timeout");
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MODEL_LIST_MAX_BYTES) throw new Error("model-list-size");
      chunks.push(value);
    }
    if (signal.aborted) throw new Error("model-list-timeout");
    completed = true;
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    signal.removeEventListener("abort", abort);
    if (!completed) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export interface JevAccessDiagnosis {
  observedAt: string;
  networkSource: "windows" | "environment" | "direct";
  modelList: { status: number | null; aliases: string[]; regionRestricted: boolean; failure: string | null };
  inference: { attempted: boolean; successful: boolean; model: string | null; failure: string | null;
    providerStatus: number | null; knownInputTokens: number; knownOutputTokens: number; reservedInputTokens: number; requests: number };
  credentialsRecorded: false;
}

export interface JevAccessDiagnosisDependencies {
  fetch?: typeof fetch;
  credential?: () => string | undefined;
  evaluate?: () => Promise<JevResponse>;
  networkSource?: JevAccessDiagnosis["networkSource"];
}

/** Read-only listing by default. --inference permits exactly one tiny query. */
export async function diagnoseJevAccess(inference = false, dependencies: JevAccessDiagnosisDependencies = {}): Promise<JevAccessDiagnosis> {
  const source = dependencies.networkSource ?? process.env.JEV_NETWORK_SOURCE;
  const result: JevAccessDiagnosis = {
    observedAt: new Date().toISOString(),
    networkSource: source === "windows" || source === "environment" ? source : "direct",
    modelList: { status: null, aliases: [], regionRestricted: false, failure: null },
    inference: { attempted: false, successful: false, model: null, failure: null, providerStatus: null,
      knownInputTokens: 0, knownOutputTokens: 0, reservedInputTokens: 0, requests: 0 },
    credentialsRecorded: false,
  };
  const credential = (dependencies.credential ?? loadAiJevCredential)();
  if (!credential) { result.modelList.failure = "credential-unavailable"; return result; }
  try {
    const signal = AbortSignal.timeout(5000);
    const response = await (dependencies.fetch ?? fetch)(MODEL_ENDPOINT, {
      headers: { Authorization: `Bearer ${credential}` }, redirect: "error", signal,
    });
    result.modelList.status = response.status;
    const text = await boundedModelListText(response, signal);
    const payload: unknown = JSON.parse(text);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new Error("model-list-shape");
    const record = payload as Record<string, unknown>;
    result.modelList.regionRestricted = response.status === 451 && record.title === REGION_MESSAGE;
    if (!response.ok) { result.modelList.failure = `http-${response.status}`; return result; }
    if (!Array.isArray(record.models)) throw new Error("model-list-shape");
    for (const entry of record.models) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("model-list-shape");
      const name = (entry as Record<string, unknown>).name;
      if (typeof name !== "string" || !/^jev(?:[-_.][A-Za-z0-9]+)*$/.test(name)) throw new Error("model-list-name");
      result.modelList.aliases.push(name);
    }
  } catch {
    result.modelList.failure = "model-list-transport-or-schema";
    return result;
  }
  if (!inference) return result;
  result.inference.attempted = true;
  const client = createJevClient({ apiKey: (credential), model: JEV_PINNED_MODEL,
    budget: { maxRequests: 1, maxInputTokens: 32_000, maxInputTokensPerRequest: 32_000, maxTotalLatencyMs: 5000 },
  });
  try {
    const response = await (dependencies.evaluate ?? (() => client.evaluate(
      { gold: 0, rule: "Buying a minion costs 3 gold. Finishing the turn costs 0 gold." },
      { action: { type: "choice", instructions: "Which action can be paid for with the available gold?",
        criteria: { buy: "Buy a minion for 3 gold", finish: "Finish the turn for 0 gold" } } },
    )))();
    result.inference.successful = true;
    result.inference.model = response.model;
    result.inference.knownInputTokens = response.usage.input_tokens;
    result.inference.knownOutputTokens = response.usage.output_tokens;
  } catch (error) {
    result.inference.failure = error instanceof JevClientError ? error.code : "inference-failure";
    result.inference.providerStatus = error instanceof JevClientError ? error.status ?? null : null;
  }
  const usage = client.getUsage();
  result.inference.reservedInputTokens = usage.reservedInputTokens;
  result.inference.requests = usage.requests;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length > 1 || (arguments_.length === 1 && !["--inference", "--help"].includes(arguments_[0]))) {
    console.error("Only --inference or --help is accepted; never pass a credential as an argument.");
    process.exitCode = 1;
  } else if (arguments_[0] === "--help") {
    console.log("Read-only Jev model-list diagnosis. --inference additionally makes at most one small, budgeted model request. Result: outputs/ai-jev/access-diagnosis-current.json. Use npm run diagnose:ai-jev to honor configured proxies.");
  } else {
    const result = await diagnoseJevAccess(arguments_[0] === "--inference");
    const path = resolve(REPO, "outputs/ai-jev/access-diagnosis-current.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result));
    if (result.modelList.failure || result.inference.failure) process.exitCode = 1;
  }
}
