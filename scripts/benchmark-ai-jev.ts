import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, truncateSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { AI_POLICY_VERSION, getAiStrategyProfile, withAiStrategyProfileOverrides, type AiStrategyId, type AiStrategyProfile } from "../lib/game/ai.ts";
import { hasAnyAiResidualPolicyOverrides, withAiResidualPolicyOverrides } from "../lib/game/ai-residual-policy.ts";
import { AiTrainingEnvironment } from "../lib/game/ai-training-environment.ts";
import { advanceHeadlessGame, type GameState } from "../lib/game/engine.ts";
import { createAiBenchmarkScenarioGame, type AiBenchmarkScenarioId } from "./ai-benchmark-scenarios.ts";
import { createJevClient, JEV_PINNED_MODEL, JEV_VALIDATION_RULES, JevClientError, validateJevResponse, type JevAnswer, type JevClient, type JevClientOptions, type JevClientUsage, type JevQuestion } from "./ai-jev-client.ts";
import { AiJevJournal, jevJournalHash } from "./ai-jev-journal.ts";
import { JEV_RECRUIT_POLICY_VERSION, JEV_RECRUIT_PRESET, runJevRecruitTurn, type JevDecisionRecord, type JevTurnDiagnostics } from "./ai-jev-policy.ts";
import { assertAiBenchmarkSeedAccess } from "./ai-seed-ledger.ts";
import { summarizeAiRecruitPlannerSeedMetrics, type AiRecruitPlannerComparisons, type AiRecruitPlannerSeedMetric } from "./benchmark-ai-recruit-planner.ts";

export const AI_JEV_BENCHMARK_VERSION = "single-seat-jev-integration-itt-v2";
export const AI_JEV_REQUEST_LIMIT = 2_000;
export const AI_JEV_INPUT_TOKEN_LIMIT = 1_000_000;
// Larger budgets require explicit caller/CLI values; defaults stay conservative.
export const AI_JEV_MAX_EXPLICIT_REQUESTS = 100_000;
export const AI_JEV_MAX_EXPLICIT_INPUT_TOKENS = 1_000_000_000;
export const AI_JEV_MODES = Object.freeze(["all-decisions", "critical-decisions"] as const);
export type AiJevMode = (typeof AI_JEV_MODES)[number];
const REPO = fileURLToPath(new URL("../", import.meta.url));
const PROFILE_IDS = ["balanced", "magnetic", "tempo", "triple", "powerLevel", "economy", "deathrattle"] as const satisfies readonly AiStrategyId[];
const SCENARIOS = Object.freeze(["neutral-v1", "live-lobby-v1"] as const);
const PROVIDER_FALLBACKS = new Set(["budget", "aborted", "timeout", "transport", "http", "response", "stopped", "provider-error"]);
const TECHNICAL_FALLBACKS = new Set(["configuration", "request", "hook", "stale-response", "rejected-action"]);

export interface AiJevBenchmarkOptions {
  mode: "fixture" | "jev";
  preset: "smoke" | "development";
  startSeed: number;
  seeds?: number;
  maxRequests?: number;
  maxInputTokens?: number;
  timeoutMs?: number;
  runId?: string;
  concurrency?: number;
  resume?: boolean;
  /** Never written into reports, prompts or process arguments. */
  credential?: string;
}

export interface AiJevFrozenConfiguration {
  mode: "fixture" | "jev";
  preset: "smoke" | "development";
  startSeed: number;
  seeds: number;
  maxRequests: number;
  maxInputTokens: number;
  timeoutMs: number;
  maxRounds: number;
  maxDecisionsPerTurn: number;
  initialHealth: number;
  runId: string;
  model: typeof JEV_PINNED_MODEL;
  scenarios: readonly AiBenchmarkScenarioId[];
  rotations: readonly number[];
  profiles: readonly AiStrategyId[];
  arms: typeof AI_JEV_MODES;
  concurrency: number;
  adapterVersion?: string;
  adapterPreset?: typeof JEV_RECRUIT_PRESET;
}

export interface AiJevProvenance {
  sourceSha256: string;
  contentSha256: string;
  profilesSha256: string;
  policyVersion: string;
  configurationSha256: string;
}

export interface AiJevGameRequest {
  seed: number;
  scenario: AiBenchmarkScenarioId;
  rotation: number;
  arm: "legacy" | AiJevMode;
  playerId: string | null;
  profile: AiStrategyProfile | null;
  initialState: GameState;
  configuration: AiJevFrozenConfiguration;
}

export interface AiJevGameRun {
  completed: boolean;
  drawn: boolean;
  truncated: boolean;
  failure: string | null;
  initialStateSha256: string;
  finalRound: number;
  decisionTrace: string | null;
  outcomes: Record<string, { placement: number | null; topFour: boolean | null; win: boolean | null }>;
  diagnostics: JevTurnDiagnostics[];
  usage: JevClientUsage;
  providerFailures?: string[];
}

export interface AiJevPair {
  seed: number;
  scenario: AiBenchmarkScenarioId;
  rotation: number;
  physicalSeat: number;
  playerId: string;
  profile: AiStrategyId;
  arm: AiJevMode;
  baseline: AiJevGameRun;
  candidate: AiJevGameRun;
  placementDelta: number | null;
  topFourDelta: number | null;
  winDelta: number | null;
}

export interface AiJevBenchmarkDependencies {
  /** Dependency injection always labels output injected-test, never Jev evidence. */
  runGame?: (request: AiJevGameRequest, client: JevClient) => Promise<AiJevGameRun>;
  claimSeeds?: (configuration: AiJevFrozenConfiguration, provenance: AiJevProvenance) => void;
  persist?: (report: AiJevBenchmarkReport) => void;
  createClient?: (configuration: AiJevFrozenConfiguration, hooks?: Pick<JevClientOptions, "onRequestReserved" | "onRequestSettled">) => JevClient;
  captureProvenance?: (configuration: AiJevFrozenConfiguration) => AiJevProvenance;
  /** Explicit temporary directory for durability tests; live runs use their run directory. */
  journalDirectory?: string;
}

export interface AiJevBenchmarkReport {
  benchmarkVersion: typeof AI_JEV_BENCHMARK_VERSION;
  label: "fixture-infrastructure-only" | "real-jev-development" | "injected-test";
  configuration: AiJevFrozenConfiguration;
  provenance: AiJevProvenance;
  provenanceAfter: AiJevProvenance | null;
  sourceStable: boolean;
  status: "running" | "complete" | "incomplete";
  scheduledGames: number;
  processedGames: number;
  expectedPairs: number;
  pairs: AiJevPair[];
  baselines: AiJevGameRun[];
  failures: string[];
  usage: JevClientUsage;
  diagnostics: ReturnType<typeof summarizeDiagnostics>;
  diagnosticsByArm: Partial<Record<AiJevMode, ReturnType<typeof summarizeDiagnostics>>>;
  comparisons: Partial<Record<AiJevMode, ReturnType<typeof comparisonMatrix>>>;
  evidenceUsable: boolean;
  ittEvidenceUsable: boolean;
  cleanEvidenceUsable: boolean;
  modelExposureUsable: boolean;
  availability: { circuitReason: string | null; providerFailureGames: number; modelExposedGames: number; completedCandidateGames: number; requestSuccessRate: number | null; knownUsageRequests: number; unknownUsageRequests: number; failedRequests: number };
  promotionAccepted: false;
  limitations: string[];
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number, name: string): number {
  const number = value ?? fallback;
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new RangeError(`${name} must be an integer in 1..${maximum}`);
  return number;
}

export function freezeAiJevConfiguration(options: AiJevBenchmarkOptions): AiJevFrozenConfiguration {
  if (!["fixture", "jev"].includes(options.mode) || !["smoke", "development"].includes(options.preset)) throw new RangeError("explicit fixture|jev mode and smoke|development preset required");
  if (!Number.isSafeInteger(options.startSeed) || options.startSeed < 1) throw new RangeError("startSeed must be a positive safe integer");
  const seeds = boundedInteger(options.seeds, 1, 8, "seeds");
  // No setup, policy factory, report callback or credential use before the guard.
  assertAiBenchmarkSeedAccess({ startSeed: options.startSeed, seeds });
  if (options.preset === "smoke" && seeds !== 1) throw new RangeError("smoke uses exactly one seed; use development for clustered comparisons");
  const runId = options.runId ?? `jev-${options.mode}-${options.startSeed}-${Date.now()}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(runId)) throw new RangeError("runId must be 1..96 plain letters, numbers, underscores or hyphens");
  return Object.freeze({
    mode: options.mode, preset: options.preset, startSeed: options.startSeed, seeds, runId,
    maxRequests: boundedInteger(options.maxRequests, AI_JEV_REQUEST_LIMIT, AI_JEV_MAX_EXPLICIT_REQUESTS, "maxRequests"),
    maxInputTokens: boundedInteger(options.maxInputTokens, AI_JEV_INPUT_TOKEN_LIMIT, AI_JEV_MAX_EXPLICIT_INPUT_TOKENS, "maxInputTokens"),
    timeoutMs: boundedInteger(options.timeoutMs, 5_000, 60_000, "timeoutMs"),
    maxRounds: 150, maxDecisionsPerTurn: 50, initialHealth: 40, model: JEV_PINNED_MODEL,
    scenarios: SCENARIOS, rotations: Object.freeze(options.preset === "smoke" ? [0] : [0, 1, 2, 3, 4, 5, 6, 7]),
    profiles: Object.freeze(options.preset === "smoke" ? ["balanced" as const] : [...PROFILE_IDS]), arms: AI_JEV_MODES,
    concurrency: boundedInteger(options.concurrency, 1, 4, "concurrency"),
    adapterVersion: JEV_RECRUIT_POLICY_VERSION,
    adapterPreset: Object.freeze({ ...JEV_RECRUIT_PRESET, dimensions: Object.freeze({ ...JEV_RECRUIT_PRESET.dimensions }) }),
  });
}

function filesUnder(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
  });
}

export function captureAiJevProvenance(configuration: AiJevFrozenConfiguration): AiJevProvenance {
  const source = createHash("sha256");
  const sources = [
    ...filesUnder(resolve(REPO, "lib/game")),
    ...["benchmark-ai-jev.ts", "ai-jev-client.ts", "ai-jev-policy.ts", "ai-jev-journal.ts", "ai-benchmark-scenarios.ts", "ai-seed-ledger.ts", "benchmark-ai-recruit-planner.ts", "run-ai-jev.mjs", "diagnose-ai-jev.ts"].map((name) => resolve(REPO, "scripts", name)),
  ].sort();
  for (const path of sources) source.update(relative(REPO, path).split(sep).join("/")).update("\0").update(readFileSync(path)).update("\0");
  const content = createHash("sha256");
  for (const path of filesUnder(resolve(REPO, "lib/game/generated")).sort()) content.update(relative(REPO, path)).update("\0").update(readFileSync(path));
  return { sourceSha256: source.digest("hex"), contentSha256: content.digest("hex"), profilesSha256: hash(PROFILE_IDS.map((_, index) => getAiStrategyProfile(`player-${index + 1}`))), policyVersion: AI_POLICY_VERSION, configurationSha256: hash(configuration) };
}

/** Claims are append-only and shared across run directories and both modes. */
export function claimAiJevDevelopmentSeeds(configuration: AiJevFrozenConfiguration, provenance: AiJevProvenance, repoRoot = REPO): void {
  assertAiBenchmarkSeedAccess({ startSeed: configuration.startSeed, seeds: configuration.seeds });
  const ledger = resolve(repoRoot, "outputs/ai-jev/development-seed-ledger");
  mkdirSync(ledger, { recursive: true });
  // Check the complete range first; O_EXCL below resolves concurrent claims.
  for (let index = 0; index < configuration.seeds; index += 1) {
    if (existsSync(resolve(ledger, `${configuration.startSeed + index}.json`))) throw new Error("Jev development seed already consumed by a previous attempt");
  }
  for (let index = 0; index < configuration.seeds; index += 1) {
    try {
      writeFileSync(resolve(ledger, `${configuration.startSeed + index}.json`), JSON.stringify({ disposition: "consumed", seed: configuration.startSeed + index, runId: configuration.runId, mode: configuration.mode, provenance, claimedAt: new Date().toISOString(), reason: "claimed-before-any-game-or-model-setup; interruptions-do-not-release" }) + "\n", { flag: "wx" });
    } catch {
      throw new Error("Jev development seed claim failed; any written claims remain consumed");
    }
  }
}

/** Explicitly synthetic answers: exercise transport, masks and reports only. */
export const jevFixtureFetch: typeof fetch = async (_input, init) => {
  const request = JSON.parse(String(init?.body)) as { model: string; questions: Record<string, JevQuestion>; state?: { observation?: { public?: { round?: number }; own?: { hand?: unknown[]; board?: unknown[] } }; candidates?: { id: string; type: string }[] } };
  // Exercise one legal buy and re-observation on the opening turn, then abstain.
  // This deliberately has no claim to be a decision model or strategy.
  const openingBuy = request.state?.observation?.public?.round === 1 && request.state.observation.own?.hand?.length === 0 && request.state.observation.own.board?.length === 0
    ? request.state.candidates?.find((candidate) => candidate.type === "BUY_MINION")?.id : undefined;
  const answers: Record<string, JevAnswer> = {};
  for (const [id, question] of Object.entries(request.questions)) {
    if (question.type === "noul") { answers[id] = { type: "noul", noul: openingBuy && id.startsWith(`${openingBuy}_`) ? 1 : 0 }; continue; }
    const keys = question.type === "choice" ? Object.keys(question.criteria) : question.criteria.map((_, index) => String(index));
    const selected = question.type === "choice" ? openingBuy && keys.includes(openingBuy) ? openingBuy : keys[0] : keys[keys.length - 1];
    const probabilities = Object.fromEntries(keys.map((key) => [key, key === selected ? 1 : 0]));
    if (question.type === "choice") answers[id] = { type: "choice", choice: selected, confidence: 1, probabilities };
    else answers[id] = { type: "score", score: Number(selected), confidence: 1, probabilities, legend: Object.fromEntries(keys.map((key) => { const rubric = question.criteria[Number(key)]; return [key, typeof rubric === "string" ? rubric : JSON.stringify(rubric)]; })) };
  }
  return new Response(JSON.stringify({ model: request.model, answers, usage: { input_tokens: 0, output_tokens: 0 } }), { headers: { "Content-Type": "application/json" } });
};

function rotate(state: GameState, rotation: number): void {
  const ids = state.players.map((player) => player.id);
  state.players.forEach((player, index) => { player.id = ids[(index + rotation) % ids.length]; });
}

interface AiJevGameRuntime {
  client: JevClient;
  hasRecordedNext: () => boolean;
  modelDisabled: () => boolean;
  replayFailure: () => boolean;
  trace: AiJevDecisionTrace;
}

function traceKey(record: JevDecisionRecord): string { return `${record.round}/${record.decisionIndex}/${record.requestHash}`; }

function canonicalTraceJson(value: unknown): string {
  function ordered(current: unknown): unknown {
    if (Array.isArray(current)) return current.map(ordered);
    if (current === null || typeof current !== "object") return current;
    return Object.fromEntries(Object.entries(current).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, ordered(child)]));
  }
  return JSON.stringify(ordered(value));
}

export interface AiJevDecisionTrace {
  records: Map<string, JevDecisionRecord>;
  needsReplay: boolean;
}

/** Validate complete records first; only an incomplete final JSON fragment is discarded. */
export function prepareAiJevDecisionTrace(path: string, model: string, mode: AiJevMode, adapterVersion?: string): AiJevDecisionTrace {
  const records = new Map<string, JevDecisionRecord>();
  if (!existsSync(path)) return { records, needsReplay: false };
  const bytes = readFileSync(path);
  const lastNewline = bytes.lastIndexOf(10);
  const completeBytes = lastNewline + 1;
  const complete = bytes.subarray(0, completeBytes).toString("utf8");
  function accept(value: unknown): void {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid Jev decision trace schema");
    const record = value as JevDecisionRecord;
    const allowed = ["mode", "decisionIndex", "round", "requestHash", "state", "questions", "response", "selectedAction", "status", "providerStatus", "providerValidationRule", "providerValidationDiagnostic", "candidateBenefitEvidence"];
    if (Object.keys(value).some((key) => !allowed.includes(key)) || record.mode !== mode || !Number.isSafeInteger(record.decisionIndex) || record.decisionIndex < 0 || record.decisionIndex >= 50 ||
      !Number.isSafeInteger(record.round) || record.round < 1 || typeof record.requestHash !== "string" || !/^[a-f0-9]{64}$/.test(record.requestHash) ||
      record.state === null || typeof record.state !== "object" || Array.isArray(record.state) || record.questions === null || typeof record.questions !== "object" || Array.isArray(record.questions) || Object.keys(record.questions).length === 0 ||
      typeof record.status !== "string" || !/^[a-z][a-z-]*$/.test(record.status) || record.status === "pending" ||
      (record.providerStatus !== null && (!Number.isInteger(record.providerStatus) || record.providerStatus < 100 || record.providerStatus > 599)) ||
      (record.selectedAction !== null && (typeof record.selectedAction !== "object" || typeof record.selectedAction.type !== "string" || Object.hasOwn(record.selectedAction, "token"))) ||
      (record.providerValidationRule !== undefined && !JEV_VALIDATION_RULES.includes(record.providerValidationRule))) throw new Error("invalid Jev decision trace schema");
    if (adapterVersion && (record.state as { policyVersion?: string }).policyVersion !== adapterVersion) throw new Error("Jev decision trace adapter drift");
    for (const question of Object.values(record.questions)) {
      if (!question || typeof question !== "object" || !["choice", "score", "noul"].includes(question.type) || !(typeof question.instructions === "string" || (question.instructions !== null && typeof question.instructions === "object"))) throw new Error("invalid Jev decision trace questions");
    }
    if (record.requestHash !== hash({ state: record.state, questions: record.questions })) throw new Error("Jev decision trace request hash mismatch");
    if (record.response !== null) {
      if (typeof record.response?.latencyMs !== "number" || !Number.isFinite(record.response.latencyMs) || record.response.latencyMs < 0) throw new Error("invalid Jev decision trace latency");
      try { validateJevResponse(record.response, record.questions, model, record.response.latencyMs); } catch { throw new Error("invalid Jev decision trace response"); }
    }
    if (record.response === undefined || (record.status === "applied" && (!record.response || !record.selectedAction))) throw new Error("invalid Jev decision trace response");
    if (record.providerValidationDiagnostic !== undefined) {
      const diagnostic = record.providerValidationDiagnostic;
      if (record.providerValidationRule !== "distribution-sum" || !diagnostic || !Number.isSafeInteger(diagnostic.distributionCount) || diagnostic.distributionCount < 1 || diagnostic.distributionCount > 255 || !Number.isFinite(diagnostic.distributionSum) || diagnostic.distributionSum < 0 || diagnostic.distributionSum > diagnostic.distributionCount) throw new Error("invalid Jev decision trace diagnostic");
    }
    if (record.candidateBenefitEvidence !== undefined && (record.candidateBenefitEvidence === null || typeof record.candidateBenefitEvidence !== "object" || Array.isArray(record.candidateBenefitEvidence) || Object.values(record.candidateBenefitEvidence).some((score) => typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1 + 1e-12))) throw new Error("invalid Jev decision trace evidence");
    const key = traceKey(record);
    if (records.has(key) && canonicalTraceJson(records.get(key)) !== canonicalTraceJson(record)) throw new Error("Jev decision trace content mismatch");
    records.set(key, record);
  }
  for (const line of complete.split("\n").slice(0, -1)) {
    let record: unknown;
    try { record = JSON.parse(line); } catch { throw new Error("invalid complete Jev decision trace JSON"); }
    accept(record);
  }
  if (bytes.length === completeBytes) return { records, needsReplay: false };
  let tail: unknown;
  try { tail = JSON.parse(bytes.subarray(completeBytes).toString("utf8")); }
  catch {
    truncateSync(path, completeBytes);
    return { records, needsReplay: true };
  }
  // A complete final record without a newline is retained byte-for-byte.
  accept(tail);
  appendFileSync(path, "\n", { flush: true });
  return { records, needsReplay: false };
}

async function runGame(request: AiJevGameRequest, runtime: AiJevGameRuntime): Promise<AiJevGameRun> {
  const initialStateSha256 = hash(request.initialState);
  const client = runtime.client;
  const diagnostics: JevTurnDiagnostics[] = [];
  const providerFailures: string[] = [];
  const decisionTrace = request.arm === "legacy" ? null : `outputs/ai-jev/${request.configuration.runId}/decisions/${request.seed}-${request.scenario}-r${request.rotation}-${request.profile!.id}-${request.arm}.jsonl`;
  if (decisionTrace) {
    const path = resolve(REPO, decisionTrace);
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path)) writeFileSync(path, "", { flag: "wx" });
  }
  const recordedTrace = runtime.trace.records;
  let state = request.initialState;
  let failure: string | null = null;
  try {
    if (request.arm === "legacy") {
      while (state.phase !== "gameOver" && state.round <= request.configuration.maxRounds) state = advanceHeadlessGame(state);
    } else {
      const seat = state.players.findIndex((player) => player.id === request.playerId);
      const environment = AiTrainingEnvironment.fromHeadlessState(state, seat);
      state = environment.snapshotForBenchmark();
      while (state.phase !== "gameOver" && state.round <= request.configuration.maxRounds) {
        if (state.phase === "recruit" && state.players[seat].alive) {
          if (runtime.modelDisabled() && !runtime.hasRecordedNext()) {
            environment.completeLegacyRecruitTurn();
            if (!providerFailures.includes("model-disabled-production-remainder")) providerFailures.push("model-disabled-production-remainder");
          } else {
            const turn = await runJevRecruitTurn(environment, { mode: request.arm, client, model: request.configuration.model, profile: request.profile!, maxDecisionsPerTurn: request.configuration.maxDecisionsPerTurn, onDecision: (record) => {
              const key = traceKey(record);
              const existing = recordedTrace.get(key);
              if (existing && canonicalTraceJson(existing) !== canonicalTraceJson(record)) throw new Error("Jev decision trace replay content mismatch");
              if (!existing) { appendFileSync(resolve(REPO, decisionTrace!), JSON.stringify(record) + "\n", { flush: true }); recordedTrace.set(key, record); }
              if (record.providerStatus === 451) providerFailures.push("provider-access-restricted-http-451");
            } });
            diagnostics.push(turn);
            providerFailures.push(...Object.keys(turn.fallbacks).filter((reason) => PROVIDER_FALLBACKS.has(reason)));
          }
        } else environment.advanceBenchmarkPhase();
        state = environment.snapshotForBenchmark();
        if (runtime.replayFailure() || diagnostics.some((turn) => !turn.completed || turn.rejectedActions || turn.staleResponses || Object.keys(turn.fallbacks).some((reason) => TECHNICAL_FALLBACKS.has(reason)))) { failure = runtime.replayFailure() ? "replay-state-drift" : "simulation-or-policy-integrity-failure"; break; }
      }
    }
  } catch { failure = "game-runner-failure"; }
  const completed = state.phase === "gameOver";
  const outcomes = Object.fromEntries(state.players.map((player) => {
    const placement = player.placement ?? (completed && state.winnerId === player.id ? 1 : null);
    return [player.id, { placement, topFour: placement === null ? null : placement <= 4, win: completed ? state.winnerId === player.id : null }];
  }));
  return { completed, drawn: completed && state.winnerId === null, truncated: !completed && failure === null, failure, initialStateSha256, finalRound: state.round, decisionTrace, outcomes, diagnostics, providerFailures: [...new Set(providerFailures)], usage: client.getUsage() };
}

function successful(pair: AiJevPair): boolean {
  return pair.baseline.completed && pair.candidate.completed && !pair.baseline.failure && !pair.candidate.failure && pair.baseline.initialStateSha256 === pair.candidate.initialStateSha256 && pair.placementDelta !== null && pair.topFourDelta !== null && pair.winDelta !== null;
}

export function summarizeAiJevPairs(pairs: readonly AiJevPair[], expectedPairsPerSeed: number): AiRecruitPlannerComparisons {
  const seeds = [...new Set(pairs.map((pair) => pair.seed))];
  const metrics: AiRecruitPlannerSeedMetric[] = [];
  for (const seed of seeds) {
    const cluster = pairs.filter((pair) => pair.seed === seed);
    if (cluster.length !== expectedPairsPerSeed || !cluster.every(successful)) continue;
    metrics.push({ seed, placementDelta: cluster.reduce((sum, pair) => sum + pair.placementDelta!, 0) / cluster.length, topFourDelta: cluster.reduce((sum, pair) => sum + pair.topFourDelta!, 0) / cluster.length, winDelta: cluster.reduce((sum, pair) => sum + pair.winDelta!, 0) / cluster.length });
  }
  return summarizeAiRecruitPlannerSeedMetrics(metrics, metrics.length * expectedPairsPerSeed);
}

function matchedOutcomes(pairs: readonly AiJevPair[], expectedPairs: number) {
  const matched = pairs.filter(successful);
  const outcomes = (arm: "baseline" | "candidate") => {
    const values = matched.map((pair) => pair[arm].outcomes[pair.playerId]);
    return { meanPlacement: values.length ? values.reduce((sum, value) => sum + value.placement!, 0) / values.length : null, topFourRate: values.length ? values.reduce((sum, value) => sum + Number(value.topFour), 0) / values.length : null, winRate: values.length ? values.reduce((sum, value) => sum + Number(value.win), 0) / values.length : null };
  };
  return { matchedPairs: matched.length, expectedPairs, excludedOrUnscheduledPairs: expectedPairs - matched.length, baseline: outcomes("baseline"), candidate: outcomes("candidate"), population: "successful-complete-pairs-only" as const };
}

function comparisonMatrix(pairs: readonly AiJevPair[], configuration: AiJevFrozenConfiguration) {
  const scenarioRotations = configuration.scenarios.length * configuration.rotations.length;
  return {
    overall: summarizeAiJevPairs(pairs, scenarioRotations * configuration.profiles.length),
    byScenario: Object.fromEntries(configuration.scenarios.map((scenario) => [scenario, summarizeAiJevPairs(pairs.filter((pair) => pair.scenario === scenario), configuration.rotations.length * configuration.profiles.length)])),
    byProfile: Object.fromEntries(configuration.profiles.map((profile) => [profile, summarizeAiJevPairs(pairs.filter((pair) => pair.profile === profile), scenarioRotations)])),
    byScenarioProfile: Object.fromEntries(configuration.scenarios.map((scenario) => [scenario, Object.fromEntries(configuration.profiles.map((profile) => [profile, summarizeAiJevPairs(pairs.filter((pair) => pair.scenario === scenario && pair.profile === profile), configuration.rotations.length)]))])),
    byPhysicalSeat: Object.fromEntries(Array.from({ length: 8 }, (_, seat) => [seat, configuration.preset === "development" ? summarizeAiJevPairs(pairs.filter((pair) => pair.physicalSeat === seat), configuration.scenarios.length * configuration.profiles.length) : null])),
    absolute: {
      overall: matchedOutcomes(pairs, configuration.seeds * scenarioRotations * configuration.profiles.length),
      byScenario: Object.fromEntries(configuration.scenarios.map((scenario) => [scenario, matchedOutcomes(pairs.filter((pair) => pair.scenario === scenario), configuration.seeds * configuration.rotations.length * configuration.profiles.length)])),
      byProfile: Object.fromEntries(configuration.profiles.map((profile) => [profile, matchedOutcomes(pairs.filter((pair) => pair.profile === profile), configuration.seeds * scenarioRotations)])),
      byScenarioProfile: Object.fromEntries(configuration.scenarios.map((scenario) => [scenario, Object.fromEntries(configuration.profiles.map((profile) => [profile, matchedOutcomes(pairs.filter((pair) => pair.scenario === scenario && pair.profile === profile), configuration.seeds * configuration.rotations.length)]))])),
    },
  };
}

function summarizeDiagnostics(pairs: readonly AiJevPair[]) {
  const turns = pairs.flatMap((pair) => pair.candidate.diagnostics);
  const fallbacks: Record<string, number> = {};
  for (const turn of turns) for (const [reason, count] of Object.entries(turn.fallbacks)) fallbacks[reason] = (fallbacks[reason] ?? 0) + count;
  const latencies = turns.flatMap((turn) => turn.latenciesMs).sort((left, right) => left - right);
  const usages = pairs.map((pair) => pair.candidate.usage);
  const successfulResponses = turns.reduce((sum, turn) => sum + turn.successfulResponses, 0);
  const requests = usages.reduce((sum, usage) => sum + usage.requests, 0);
  const unknownPossiblyChargedRequests = usages.reduce((sum, usage, index) => sum + (usage.unknownUsageRequests ?? Math.max(0, usage.requests - pairs[index].candidate.diagnostics.reduce((total, turn) => total + turn.successfulResponses, 0))), 0);
  return { turns: turns.length, decisions: turns.reduce((sum, turn) => sum + turn.decisions, 0), calls: turns.reduce((sum, turn) => sum + turn.calls, 0), requests, reservedInputTokens: usages.reduce((sum, usage) => sum + usage.reservedInputTokens, 0), knownInputTokens: usages.reduce((sum, usage) => sum + usage.inputTokens, 0), knownOutputTokens: usages.reduce((sum, usage) => sum + usage.outputTokens, 0), unknownPossiblyChargedRequests, rejectedActions: turns.reduce((sum, turn) => sum + turn.rejectedActions, 0), staleResponses: turns.reduce((sum, turn) => sum + turn.staleResponses, 0), limitHits: turns.reduce((sum, turn) => sum + turn.limitHits, 0), emergencyChoiceActions: turns.reduce((sum, turn) => sum + turn.emergencyChoiceActions, 0), fallbacks, p95ObservedCallLatencyMs: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null, successfulResponses, appliedActions: turns.reduce((sum, turn) => sum + turn.appliedActions, 0), actionDivergenceFromLegacyMeasured: false as const };
}

export function isAiJevIttEvidenceUsable(report: Pick<AiJevBenchmarkReport, "status" | "label" | "configuration" | "pairs">): boolean {
  if (report.status !== "complete" || report.label !== "real-jev-development" || report.configuration.preset !== "development" || report.configuration.seeds < 2 || !report.pairs.every(successful)) return false;
  const expected = report.configuration.seeds * report.configuration.scenarios.length * report.configuration.rotations.length * report.configuration.profiles.length * AI_JEV_MODES.length;
  return report.pairs.length === expected && new Set(report.pairs.map((pair) => `${pair.seed}/${pair.scenario}/${pair.rotation}/${pair.profile}/${pair.arm}`)).size === expected;
}

export function hasAiJevModelExposure(report: Pick<AiJevBenchmarkReport, "configuration" | "pairs">): boolean {
  const exposed = report.pairs.filter((pair) => pair.candidate.diagnostics.some((turn) => turn.appliedActions > 0));
  const seats = report.configuration.preset === "development" ? Array.from({ length: 8 }, (_, seat) => seat) : [...new Set(report.pairs.map((pair) => pair.physicalSeat))];
  return seats.length > 0 && AI_JEV_MODES.every((arm) => report.configuration.profiles.every((profile) =>
    report.configuration.scenarios.every((scenario) => seats.every((seat) => exposed.some((pair) => pair.arm === arm && pair.profile === profile && pair.scenario === scenario && pair.physicalSeat === seat))),
  ));
}

/** Integration strength includes the real provider-failure fallback policy. */
export function isAiJevEvidenceUsable(report: Pick<AiJevBenchmarkReport, "status" | "label" | "configuration" | "pairs">): boolean {
  return isAiJevIttEvidenceUsable(report) && hasAiJevModelExposure(report);
}

function persistReport(report: AiJevBenchmarkReport): void {
  const path = resolve(REPO, "outputs/ai-jev", report.configuration.runId, "report.json");
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.next`;
  writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n");
  renameSync(temporary, path);
}

export async function runAiJevBenchmark(options: AiJevBenchmarkOptions, dependencies: AiJevBenchmarkDependencies = {}): Promise<AiJevBenchmarkReport> {
  const configuration = freezeAiJevConfiguration(options);
  const injected = Object.keys(dependencies).length > 0;
  if (hasAnyAiResidualPolicyOverrides()) throw new Error("Jev benchmark rejects ambient residual policy overrides");
  withAiResidualPolicyOverrides(new Map(), () => undefined);
  withAiStrategyProfileOverrides(new Map(), () => undefined);
  if (configuration.mode === "jev" && !dependencies.createClient && (!options.credential?.trim() || /[\r\n]/.test(options.credential))) throw new Error("TYPESAFE_API_KEY is missing or invalid; no games or model calls started");
  const capture = dependencies.captureProvenance ?? captureAiJevProvenance;
  const provenance = capture(configuration);
  const directory = dependencies.journalDirectory ?? (injected ? undefined : resolve(REPO, "outputs/ai-jev", configuration.runId, "journal"));
  if (!options.resume) {
    if (directory && existsSync(resolve(directory, "manifest.json"))) throw new Error("Jev run already exists; use its exact frozen configuration with --resume true");
    (dependencies.claimSeeds ?? claimAiJevDevelopmentSeeds)(configuration, provenance);
  } else if (!dependencies.claimSeeds) {
    for (let index = 0; index < configuration.seeds; index += 1) {
      const path = resolve(REPO, "outputs/ai-jev/development-seed-ledger", `${configuration.startSeed + index}.json`);
      const claim = JSON.parse(readFileSync(path, "utf8")) as { runId: string; provenance: AiJevProvenance };
      if (claim.runId !== configuration.runId || hash(claim.provenance) !== hash(provenance)) throw new Error("Jev resume seed claim does not belong to this frozen run");
    }
  }
  const journal = new AiJevJournal({ directory, identity: { version: AI_JEV_BENCHMARK_VERSION, configuration, provenance }, resume: options.resume, maxRequests: configuration.maxRequests, maxInputTokens: configuration.maxInputTokens });
  try {
  const credential = configuration.mode === "fixture" ? "not-a-real-key" : options.credential!;
  const profiles = PROFILE_IDS.map((id, index) => ({ id, playerId: `player-${index + 1}`, profile: Object.freeze({ ...getAiStrategyProfile(`player-${index + 1}`) }) })).filter((profile) => configuration.profiles.includes(profile.id));
  const episodes = configuration.seeds * configuration.scenarios.length * configuration.rotations.length;
  const report: AiJevBenchmarkReport = {
    benchmarkVersion: AI_JEV_BENCHMARK_VERSION, label: injected ? "injected-test" : configuration.mode === "fixture" ? "fixture-infrastructure-only" : "real-jev-development",
    configuration, provenance, provenanceAfter: null, sourceStable: true, status: "running",
    scheduledGames: episodes * (1 + configuration.profiles.length * 2), processedGames: 0,
    expectedPairs: episodes * configuration.profiles.length * 2, pairs: [], baselines: [], failures: [], usage: journal.usage(),
    diagnostics: summarizeDiagnostics([]), diagnosticsByArm: {}, comparisons: {},
    evidenceUsable: false, ittEvidenceUsable: false, cleanEvidenceUsable: false, modelExposureUsable: false, promotionAccepted: false,
    availability: { circuitReason: null, providerFailureGames: 0, modelExposedGames: 0, completedCandidateGames: 0, requestSuccessRate: null, knownUsageRequests: 0, unknownUsageRequests: 0, failedRequests: 0 },
    limitations: [
      "ITT includes the model plus its frozen production fallback on provider failure; clean availability is separate.",
      "Two independent seed clusters give exploratory uncertainty, not a production promotion.",
      "Model benefit evidence is not win probability; zero interventions cannot establish model strength.",
      "Action divergence from the exact legacy policy is not measured.",
      "Unknown possibly paid requests retain their reservations and are never retried.",
      configuration.mode === "fixture" ? "Synthetic fixture answers measure infrastructure only." : "Only known vendor usage is summed.",
      configuration.preset === "smoke" ? "Smoke covers one profile and one rotation." : "Development covers seven profiles, eight seats and two scenarios.",
    ],
  };
  const persist = dependencies.persist ?? persistReport;
  const checkpoint = () => {
    report.diagnostics = summarizeDiagnostics(report.pairs);
    report.diagnosticsByArm = Object.fromEntries(AI_JEV_MODES.map((arm) => [arm, summarizeDiagnostics(report.pairs.filter((pair) => pair.arm === arm))]));
    report.comparisons = Object.fromEntries(AI_JEV_MODES.map((arm) => [arm, comparisonMatrix(report.pairs.filter((pair) => pair.arm === arm), configuration)]));
    const durableUsage = journal.usage();
    report.usage = durableUsage.requests || !injected ? durableUsage : {
      requests: report.diagnostics.requests, reservedInputTokens: report.diagnostics.reservedInputTokens,
      inputTokens: report.diagnostics.knownInputTokens, outputTokens: report.diagnostics.knownOutputTokens,
      totalLatencyMs: report.pairs.reduce((sum, pair) => sum + pair.candidate.usage.totalLatencyMs, 0), inFlightLatencyMs: 0, stopped: journal.circuitReason() !== null,
      knownUsageRequests: report.diagnostics.successfulResponses, unknownUsageRequests: report.diagnostics.unknownPossiblyChargedRequests,
      failedRequests: report.diagnostics.requests - report.diagnostics.successfulResponses,
    };
    report.availability = {
      circuitReason: journal.circuitReason(),
      providerFailureGames: report.pairs.filter((pair) => pair.candidate.providerFailures?.length).length,
      modelExposedGames: report.pairs.filter((pair) => pair.candidate.diagnostics.some((turn) => turn.appliedActions > 0)).length,
      completedCandidateGames: report.pairs.filter((pair) => pair.candidate.completed).length,
      requestSuccessRate: report.usage.requests ? (report.usage.requests - (report.usage.failedRequests ?? 0)) / report.usage.requests : null,
      knownUsageRequests: report.usage.knownUsageRequests ?? 0, unknownUsageRequests: report.usage.unknownUsageRequests ?? 0, failedRequests: report.usage.failedRequests ?? 0,
    };
    persist(report);
  };
  const gameKey = (request: AiJevGameRequest) => `${request.seed}-${request.scenario}-r${request.rotation}-${request.profile?.id ?? "lobby"}-${request.arm}`;
  const execute = async (request: AiJevGameRequest): Promise<AiJevGameRun> => {
    const key = gameKey(request);
    const saved = journal.readGame<AiJevGameRun>(key);
    const tracePath = request.arm === "legacy" ? null : resolve(REPO, "outputs/ai-jev", request.configuration.runId, "decisions", `${request.seed}-${request.scenario}-r${request.rotation}-${request.profile!.id}-${request.arm}.jsonl`);
    const trace = tracePath ? prepareAiJevDecisionTrace(tracePath, configuration.model, request.arm as AiJevMode, configuration.adapterVersion) : { records: new Map<string, JevDecisionRecord>(), needsReplay: false };
    const durableResponses = new Map<string, ReturnType<AiJevJournal["recorded"]>>();
    for (let index = 0; journal.recorded(key, index); index += 1) {
      const recorded = journal.recorded(key, index)!;
      durableResponses.set(recorded.hash, recorded);
    }
    for (const record of trace.records.values()) {
      if (!record.response) continue;
      const recorded = durableResponses.get(jevJournalHash({ model: configuration.model, state: record.state, questions: record.questions }));
      if ((!recorded && (!injected || durableResponses.size > 0)) || (recorded && (recorded.settlement?.kind !== "success" || canonicalTraceJson(recorded.settlement.response) !== canonicalTraceJson(record.response)))) throw new Error("Jev decision trace durable response mismatch");
    }
    if (saved) {
      if (saved.initialStateSha256 !== hash(request.initialState)) throw new Error("Jev completed checkpoint initial-state drift");
      if (!trace.needsReplay) return saved;
    }
    let ordinal = 0;
    let pendingOrdinal = -1;
    let disabled = false;
    let replayDrift = false;
    let hooksUsed = false;
    const hooks: Pick<JevClientOptions, "onRequestReserved" | "onRequestSettled"> = {
      onRequestReserved: (reservation) => { hooksUsed = true; journal.reserve(key, pendingOrdinal, reservation); },
      onRequestSettled: (settlement) => journal.settle(key, pendingOrdinal, settlement),
    };
    const transport = dependencies.createClient?.(configuration, hooks) ?? createJevClient({
      apiKey: credential, model: configuration.model, timeoutMs: configuration.timeoutMs, failurePolicy: "stop", ...hooks,
      fetch: configuration.mode === "fixture" ? jevFixtureFetch : undefined,
      budget: { maxRequests: configuration.maxRequests, maxInputTokens: configuration.maxInputTokens, maxInputTokensPerRequest: Math.min(32_000, configuration.maxInputTokens), maxTotalLatencyMs: configuration.maxRequests * configuration.timeoutMs },
    });
    const client: JevClient = {
      getUsage: () => hooksUsed || journal.recorded(key, 0) ? journal.usage(key) : transport.getUsage(),
      evaluate: async (state, questions, signal) => {
        const current = ordinal++;
        const prior = journal.recorded(key, current);
        if (prior) {
          if (prior.hash !== jevJournalHash({ model: configuration.model, state, questions })) { replayDrift = true; throw new Error("Jev replay request-state drift"); }
          const outcome = prior.settlement!;
          if (outcome.kind === "success") return structuredClone(outcome.response);
          disabled = true;
          throw new JevClientError(outcome.code, outcome.status, outcome.validationRule, outcome.validationDiagnostic);
        }
        if (saved) {
          const audit = [...trace.records.values()].find((record) => record.requestHash === hash({ state, questions }) && record.response === null);
          if (audit) throw new JevClientError(audit.status as "budget" | "stopped" | "response", audit.providerStatus ?? undefined, audit.providerValidationRule, audit.providerValidationDiagnostic);
          if (journal.circuitReason() && saved.providerFailures?.length) throw new JevClientError(journal.circuitReason() === "budget" ? "budget" : "stopped");
          replayDrift = true;
          throw new Error("Jev cached trace repair lacks a durable response; refuse a new request");
        }
        if (disabled || journal.circuitReason()) { disabled = true; throw new JevClientError("stopped"); }
        pendingOrdinal = current;
        try { return await transport.evaluate(state, questions, signal); }
        catch (error) {
          disabled = true;
          if (error instanceof JevClientError) {
            if ([401, 403, 451].includes(error.status ?? 0)) journal.trip(`provider-http-${error.status}`);
            if (error.validationRule === "model") journal.trip("provider-model-mismatch");
            if (error.code === "budget") journal.trip("budget");
          }
          throw error;
        }
      },
    };
    const runtime: AiJevGameRuntime = { client, hasRecordedNext: () => journal.recorded(key, ordinal) !== undefined, modelDisabled: () => disabled || journal.circuitReason() !== null, replayFailure: () => replayDrift, trace };
    let result: AiJevGameRun;
    try { result = await (dependencies.runGame ? dependencies.runGame(request, client) : runGame(request, runtime)); }
    catch { result = { completed: false, drawn: false, truncated: false, failure: "game-runner-failure", initialStateSha256: hash(request.initialState), finalRound: request.initialState.round, decisionTrace: null, outcomes: {}, diagnostics: [], usage: client.getUsage() }; }
    if (saved) {
      const outcome = (game: AiJevGameRun) => ({ completed: game.completed, drawn: game.drawn, failure: game.failure, finalRound: game.finalRound, initialStateSha256: game.initialStateSha256, outcomes: game.outcomes, successfulResponses: game.diagnostics.reduce((sum, turn) => sum + turn.successfulResponses, 0), appliedActions: game.diagnostics.reduce((sum, turn) => sum + turn.appliedActions, 0) });
      if (canonicalTraceJson(outcome(saved)) !== canonicalTraceJson(outcome(result))) throw new Error("Jev cached trace repair outcome drift");
      return saved;
    }
    if (result.completed && !result.failure) journal.writeGame(key, result);
    return result;
  };
  checkpoint();
  const tasks: { request: AiJevGameRequest; baseline: AiJevGameRun }[] = [];
  for (let index = 0; index < configuration.seeds; index += 1) {
    const seed = configuration.startSeed + index;
    for (const scenario of configuration.scenarios) for (const rotation of configuration.rotations) {
      const initialState = createAiBenchmarkScenarioGame(scenario, seed, configuration.initialHealth);
      rotate(initialState, rotation);
      const baseline = await execute({ seed, scenario, rotation, arm: "legacy", playerId: null, profile: null, initialState: structuredClone(initialState), configuration });
      report.baselines.push(baseline); report.processedGames += 1; checkpoint();
      if (!baseline.completed || baseline.failure) { report.failures.push("canonical-baseline-incomplete"); break; }
      for (const { playerId, profile } of profiles) for (const arm of AI_JEV_MODES) tasks.push({ baseline, request: { seed, scenario, rotation, arm, playerId, profile, initialState: structuredClone(initialState), configuration } });
    }
    if (report.failures.length) break;
  }
  let nextTask = 0;
  const worker = async () => {
    while (!report.failures.length && nextTask < tasks.length) {
      const { request, baseline } = tasks[nextTask++];
      if (hash(capture(configuration)) !== hash(provenance)) { report.failures.push("source-content-profile-or-configuration-drift"); break; }
      const candidate = await execute(request);
      const baseOutcome = baseline.outcomes[request.playerId!];
      const outcome = candidate.outcomes[request.playerId!];
      const exact = baseOutcome?.placement != null && outcome?.placement != null;
      const pair: AiJevPair = {
        seed: request.seed, scenario: request.scenario, rotation: request.rotation, arm: request.arm as AiJevMode,
        profile: request.profile!.id, playerId: request.playerId!, physicalSeat: request.initialState.players.findIndex((player) => player.id === request.playerId),
        baseline, candidate, placementDelta: exact ? outcome.placement! - baseOutcome.placement! : null,
        topFourDelta: exact ? Number(outcome.topFour) - Number(baseOutcome.topFour) : null,
        winDelta: baseOutcome?.win != null && outcome?.win != null ? Number(outcome.win) - Number(baseOutcome.win) : null,
      };
      report.pairs.push(pair); report.processedGames += 1;
      if (!successful(pair) || candidate.diagnostics.some((turn) => !turn.completed || turn.rejectedActions || turn.staleResponses || Object.keys(turn.fallbacks).some((reason) => TECHNICAL_FALLBACKS.has(reason)))) report.failures.push("simulation-or-policy-integrity-failure");
      checkpoint();
    }
  };
  const workers = await Promise.allSettled(Array.from({ length: configuration.concurrency }, () => worker().catch(() => {
    report.failures.push("checkpoint-or-journal-integrity-failure");
  })));
  if (workers.some((outcome) => outcome.status === "rejected")) report.failures.push("worker-failure");
  report.provenanceAfter = capture(configuration);
  report.sourceStable = hash(report.provenanceAfter) === hash(provenance);
  if (!report.sourceStable) report.failures.push("source-content-profile-or-configuration-drift");
  report.status = report.processedGames === report.scheduledGames && report.failures.length === 0 ? "complete" : "incomplete";
  report.ittEvidenceUsable = isAiJevIttEvidenceUsable(report);
  report.modelExposureUsable = hasAiJevModelExposure(report);
  report.evidenceUsable = isAiJevEvidenceUsable(report);
  report.cleanEvidenceUsable = report.evidenceUsable && report.pairs.every((pair) => !pair.candidate.providerFailures?.length && pair.candidate.diagnostics.every((turn) => turn.emergencyChoiceActions === 0 && turn.limitHits === 0 && !turn.fallbacks.cycle));
  checkpoint();
  return report;
  } finally { journal.close(); }
}

/** Reads exactly one allowlisted value; never evaluates an env file. */
export function loadAiJevCredential(envFile?: string, environment: NodeJS.ProcessEnv = process.env): string | undefined {
  if (envFile !== undefined) {
    const path = realpathSync(resolve(REPO, envFile));
    const within = relative(REPO, path);
    if (within.startsWith(`..${sep}`) || isAbsolute(within) || within === "..") throw new Error("env-file must be an ignored file inside the repository");
    try { execFileSync("git", ["check-ignore", "--quiet", "--", within], { cwd: REPO, stdio: "ignore" }); } catch { throw new Error("env-file must be Git-ignored"); }
    const content = readFileSync(path, "utf8");
    if (content.length > 64 * 1024) throw new Error("env-file exceeds size limit");
    const lines = content.split(/\r?\n/).filter((line) => /^\s*TYPESAFE_API_KEY\s*=/.test(line));
    if (lines.length !== 1) throw new Error("env-file requires exactly one TYPESAFE_API_KEY assignment");
    return lines[0].replace(/^\s*TYPESAFE_API_KEY\s*=\s*/, "").trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  if (environment.TYPESAFE_API_KEY?.trim()) return environment.TYPESAFE_API_KEY;
  if (process.platform === "win32") {
    // Read persistent credentials inside the child and capture them in memory;
    // neither the value nor a secret-bearing argument reaches CLI output.
    const command = "$configuredValue = [Environment]::GetEnvironmentVariable('TYPESAFE_API_KEY','User'); if (-not $configuredValue) { $configuredValue = [Environment]::GetEnvironmentVariable('TYPESAFE_API_KEY','Machine') }; $configuredValue";
    try { return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 }).trim() || undefined; } catch { return undefined; }
  }
  return undefined;
}

export function parseAiJevArguments(args: readonly string[]): { options: AiJevBenchmarkOptions; envFile?: string } {
  const allowed = new Set(["mode", "preset", "start-seed", "seeds", "max-requests", "max-input-tokens", "timeout-ms", "run-id", "env-file", "concurrency", "resume"]);
  const flags = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index].replace(/^--/, "");
    if (!args[index].startsWith("--") || !allowed.has(key) || flags.has(key) || args[index + 1] === undefined || args[index + 1].startsWith("--")) throw new Error("invalid, duplicate or unknown CLI option");
    flags.set(key, args[index + 1]);
  }
  const number = (name: string) => { const value = flags.get(name); if (value === undefined) return undefined; if (!/^\d+$/.test(value)) throw new Error(`--${name} requires a positive integer`); return Number(value); };
  if (flags.has("resume") && !["true", "false"].includes(flags.get("resume")!)) throw new Error("--resume requires true or false");
  if (flags.get("resume") === "true" && !flags.has("run-id")) throw new Error("--resume requires the original --run-id");
  const options = { mode: flags.get("mode") as AiJevBenchmarkOptions["mode"], preset: flags.get("preset") as AiJevBenchmarkOptions["preset"], startSeed: number("start-seed")!, seeds: number("seeds"), maxRequests: number("max-requests"), maxInputTokens: number("max-input-tokens"), timeoutMs: number("timeout-ms"), runId: flags.get("run-id"), concurrency: number("concurrency"), resume: flags.get("resume") === "true" };
  freezeAiJevConfiguration(options);
  if (options.mode === "fixture" && flags.has("env-file")) throw new Error("fixture does not load credentials");
  return { options, envFile: flags.get("env-file") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).length === 1 && process.argv[2] === "--help") console.log("Explicit: --mode fixture|jev --preset smoke|development --start-seed N [--seeds 1..8] [--max-requests N, default2000, maximum100000] [--max-input-tokens N, default1000000, maximum1000000000] [--timeout-ms <=60000] [--concurrency 1..4, default1] [--run-id ID] [--resume true] [--env-file Git-ignored-file]. Resume requires the same run/source/configuration and never resends uncertain requests. Global budgets remain cumulative. Provider failure falls back to production for complete-game ITT. Fixture results cannot establish Jev strength; no promotion.");
    else {
      const { options, envFile } = parseAiJevArguments(process.argv.slice(2));
      if (options.mode === "jev") options.credential = loadAiJevCredential(envFile);
      const report = await runAiJevBenchmark(options);
      console.log(JSON.stringify({ label: report.label, status: report.status, processedGames: report.processedGames, scheduledGames: report.scheduledGames, evidenceUsable: report.evidenceUsable, promotionAccepted: false, failureCauses: [...new Set(report.pairs.map((pair) => pair.candidate.failure).filter(Boolean))], report: `outputs/ai-jev/${report.configuration.runId}/report.json`, usage: report.usage }));
      if (report.status !== "complete") process.exitCode = 1;
    }
  } catch (error) {
    // All thrown messages here are generated locally; never expose provider text.
    console.error(error instanceof Error ? error.message : "Jev benchmark failed");
    process.exitCode = 1;
  }
}
