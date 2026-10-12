import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { summarizeAiRecruitPlannerSeedMetrics, type AiRecruitPlannerComparisons } from "./benchmark-ai-recruit-planner.ts";
import type { AiJevBenchmarkReport, AiJevGameRun, AiJevPair } from "./benchmark-ai-jev.ts";

const PROFILES = ["balanced", "magnetic", "tempo", "triple", "powerLevel", "economy", "deathrattle"];
const ARMS = ["all-decisions", "critical-decisions"];
const SCENARIOS = ["neutral-v1", "live-lobby-v1"];
const PRICE_SOURCE = "https://typesafe.ai/blog/introducing-system-one-models-and-jev";
const HASH_FIELDS = ["sourceSha256", "contentSha256", "profilesSha256", "configurationSha256"] as const;
const TITLES: Record<string, string> = { "all-decisions": "逐次决策", "critical-decisions": "关键决策", "neutral-v1": "中立大厅", "live-lobby-v1": "实际大厅", balanced: "均衡", magnetic: "磁力", tempo: "节奏", triple: "三连", powerLevel: "快速升本", economy: "经济", deathrattle: "亡语" };

export class AiJevReportError extends Error {
  readonly code: "shape" | "not-real" | "incomplete" | "source-drift" | "pair-matrix" | "outcome" | "output-exists";
  constructor(code: AiJevReportError["code"]) {
    super(`Jev report rejected (${code})`);
    this.name = "AiJevReportError";
    this.code = code;
  }
}
function reject(code: AiJevReportError["code"]): never { throw new AiJevReportError(code); }
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function count(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) reject("shape"); return value as number; }
function mean(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function uniqueList(value: unknown, allowed: readonly (number | string)[]): void {
  if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length || value.some((item) => !allowed.includes(item))) reject("shape");
}
function completed(run: AiJevGameRun): boolean { return object(run) && run.completed === true && run.truncated === false && run.failure === null; }
function outcome(run: AiJevGameRun, playerId: string) {
  const value = run.outcomes?.[playerId];
  if (!value || !Number.isInteger(value.placement) || value.placement! < 1 || value.placement! > 8 ||
    typeof value.topFour !== "boolean" || typeof value.win !== "boolean" || value.topFour !== (value.placement! <= 4) || value.win !== (!run.drawn && value.placement === 1)) reject("outcome");
  return { placement: value.placement!, topFour: value.topFour, win: value.win };
}

export interface JevReportPair {
  seed: number; scenario: string; arm: string; profile: string; seat: number;
  baseline: { placement: number; topFour: boolean; win: boolean };
  candidate: { placement: number; topFour: boolean; win: boolean };
  successfulResponses: number; modelAppliedActions: number; timeoutFallbacks: number; emergencyChoiceActions: number;
}
export interface JevReportCoverage {
  candidateGames: number; modelExposedGames: number; gameCoverage: number | null;
  decisions: number; calls: number; successfulResponses: number; modelAppliedActions: number;
  decisionApplicationRate: number | null; emergencyChoiceActions: number;
  timeoutFallbacks: number; circuitFallbacks: number; providerFailureGames: number;
  inputLimitFallbacks: number; unresolvedRankingFallbacks: number; modelDisabledGames: number;
  rejectedActions: number; staleResponses: number; limitHits: number; latencyP95Ms: number | null;
}
export interface JevReportComparison {
  label: string; pairs: number;
  baseline: { meanPlacement: number | null; topFourRate: number | null; winRate: number | null };
  candidate: { meanPlacement: number | null; topFourRate: number | null; winRate: number | null };
  delta: AiRecruitPlannerComparisons;
  coverage: JevReportCoverage;
}
export interface JevReportSection {
  arm: string; scenario: string; overall: JevReportComparison;
  profiles: JevReportComparison[]; seats: JevReportComparison[]; scenarios: JevReportComparison[];
  exposureCells: JevReportExposureCell[];
}
export interface JevReportExposureCell {
  arm: string; scenario: string; profile: string; seat: number; label: string;
  candidateGames: number; modelExposedGames: number; exposedSeedClusters: number;
  modelAppliedActions: number; successfulResponses: number;
  bySeed: { seed: number; candidateGames: number; modelExposedGames: number; modelAppliedActions: number }[];
}
export interface AiJevFinalSummary {
  reportVersion: "ai-jev-final-report-v1"; label: "完整真实整局对照"; runId: string;
  model: string; seeds: number; scenarios: string[]; profiles: string[]; rotations: number[]; arms: string[];
  adapterVersion: string;
  scheduledGames: number; completedGames: number; expectedPairs: number; matchedPairs: number;
  sourceStable: true; sourceSha256: string;
  interpretation: string; direction: string; uncertainty: string;
  findings: string[];
  promotionAccepted: false; modelExposureUsable: boolean; cleanEvidenceUsable: boolean; ittEvidenceUsable: boolean;
  availability: { globalCircuitOpened: boolean; knownUsageRequests: number | null; unknownPossiblyChargedRequests: number | null; failedRequests: number | null };
  usage: { requests: number; reservedInputTokens: number; knownInputTokens: number; knownOutputTokens: number; knownCostUsd: number; pricePerMillionInputUsd: 0.042; outputPriceUsd: 0; priceSnapshot: "2026-10-12"; priceSource: string; costLimitation: string };
  sections: JevReportSection[];
}

function pairKey(pair: Pick<AiJevPair, "seed" | "scenario" | "rotation" | "profile" | "arm">): string {
  return [pair.seed, pair.scenario, pair.rotation, pair.profile, pair.arm].join("|");
}

/** Recompute admission from the raw runs and configured matrix, never cached comparisons. */
function checkedReport(value: unknown): AiJevBenchmarkReport {
  if (!object(value) || !object(value.configuration) || !Array.isArray(value.pairs) || !Array.isArray(value.baselines) || !Array.isArray(value.failures)) reject("shape");
  const report = value as unknown as AiJevBenchmarkReport;
  const config = report.configuration;
  if (report.label !== "real-jev-development" || config.mode !== "jev" || config.preset !== "development") reject("not-real");
  if (!Number.isSafeInteger(config.startSeed) || config.startSeed < 1 || !Number.isSafeInteger(config.seeds) || config.seeds < 1 || config.seeds > 8 || !Number.isSafeInteger(config.startSeed + config.seeds - 1) ||
    typeof config.runId !== "string" || typeof config.model !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(config.runId) || !/^jev-\d+\.\d+\.\d+$/.test(config.model)) reject("shape");
  uniqueList(config.scenarios, SCENARIOS); uniqueList(config.profiles, PROFILES); uniqueList(config.arms, ARMS); uniqueList(config.rotations, [0, 1, 2, 3, 4, 5, 6, 7]);
  if (report.sourceStable !== true || !object(report.provenance) || !object(report.provenanceAfter) ||
    HASH_FIELDS.some((field) => !/^[a-f0-9]{64}$/.test(report.provenance[field]) || report.provenance[field] !== report.provenanceAfter![field]) || report.provenance.policyVersion !== report.provenanceAfter.policyVersion) reject("source-drift");
  const episodes = config.seeds * config.scenarios.length * config.rotations.length;
  const expectedPairs = episodes * config.profiles.length * config.arms.length;
  const games = episodes + expectedPairs;
  if (report.status !== "complete" || report.scheduledGames !== games || report.processedGames !== games || report.expectedPairs !== expectedPairs || report.baselines.length !== episodes || report.pairs.length !== expectedPairs || report.failures.length !== 0 || !report.baselines.every(completed)) reject("incomplete");
  const canonical = new Map(report.baselines.map((baseline) => [baseline.initialStateSha256, baseline]));
  if (canonical.size !== episodes) reject("pair-matrix");
  const seen = new Set<string>();
  const episodeHashes = new Map<string, string>();
  for (const pair of report.pairs) {
    const key = pairKey(pair);
    const profileIndex = PROFILES.indexOf(pair.profile);
    if (seen.has(key) || !Number.isInteger(pair.seed) || pair.seed < config.startSeed || pair.seed >= config.startSeed + config.seeds || !config.scenarios.includes(pair.scenario) || !config.rotations.includes(pair.rotation) || !config.profiles.includes(pair.profile) || !config.arms.includes(pair.arm) ||
      pair.playerId !== `player-${profileIndex + 1}` || pair.physicalSeat !== (profileIndex + 1 - pair.rotation + 8) % 8) reject("pair-matrix");
    seen.add(key);
    if (!completed(pair.baseline) || !completed(pair.candidate) || pair.baseline.initialStateSha256 !== pair.candidate.initialStateSha256 || pair.placementDelta === null || pair.topFourDelta === null || pair.winDelta === null) reject("incomplete");
    const baseline = canonical.get(pair.baseline.initialStateSha256);
    if (!baseline || JSON.stringify(baseline.outcomes) !== JSON.stringify(pair.baseline.outcomes)) reject("pair-matrix");
    const episode = [pair.seed, pair.scenario, pair.rotation].join("|");
    if (episodeHashes.has(episode) && episodeHashes.get(episode) !== pair.baseline.initialStateSha256) reject("pair-matrix");
    episodeHashes.set(episode, pair.baseline.initialStateSha256);
    outcome(pair.baseline, pair.playerId); outcome(pair.candidate, pair.playerId);
  }
  if (new Set(episodeHashes.values()).size !== episodes) reject("pair-matrix");
  for (let offset = 0; offset < config.seeds; offset += 1) for (const scenario of config.scenarios) for (const rotation of config.rotations) for (const profile of config.profiles) for (const arm of config.arms) {
    if (!seen.has(pairKey({ seed: config.startSeed + offset, scenario, rotation, profile, arm }))) reject("pair-matrix");
  }
  return report;
}

function coverage(pairs: readonly AiJevPair[]): JevReportCoverage {
  const turns = pairs.flatMap((pair) => pair.candidate.diagnostics);
  const total = (field: "decisions" | "calls" | "successfulResponses" | "appliedActions" | "emergencyChoiceActions" | "rejectedActions" | "staleResponses" | "limitHits") => turns.reduce((sum, turn) => sum + count(turn[field]), 0);
  const fallback = (predicate: (reason: string) => boolean) => turns.reduce((sum, turn) => sum + Object.entries(turn.fallbacks).reduce((value, [reason, number]) => value + (predicate(reason) ? count(number) : 0), 0), 0);
  const modelExposedGames = pairs.filter((pair) => pair.candidate.diagnostics.some((turn) => turn.appliedActions > 0)).length;
  const latencies = turns.flatMap((turn) => turn.latenciesMs).sort((left, right) => left - right);
  if (latencies.some((number) => !Number.isFinite(number) || number < 0)) reject("shape");
  const decisions = total("decisions"), applied = total("appliedActions");
  return { candidateGames: pairs.length, modelExposedGames, gameCoverage: pairs.length ? modelExposedGames / pairs.length : null,
    decisions, calls: total("calls"), successfulResponses: total("successfulResponses"), modelAppliedActions: applied,
    decisionApplicationRate: decisions ? applied / decisions : null, emergencyChoiceActions: total("emergencyChoiceActions"),
    timeoutFallbacks: fallback((reason) => reason === "timeout"), circuitFallbacks: fallback((reason) => /circuit|provider-disabled|provider-unavailable/.test(reason) || ["stopped", "budget"].includes(reason)),
    inputLimitFallbacks: fallback((reason) => reason === "input-limit"), unresolvedRankingFallbacks: fallback((reason) => reason === "unresolved-benefit-ranking"),
    modelDisabledGames: pairs.filter((pair) => pair.candidate.providerFailures?.includes("model-disabled-production-remainder")).length,
    providerFailureGames: pairs.filter((pair) => (pair.candidate.providerFailures?.length ?? 0) > 0 || pair.candidate.diagnostics.some((turn) => Object.keys(turn.fallbacks).some((reason) => ["timeout", "transport", "http", "response", "provider-error", "stopped", "budget"].includes(reason)))).length,
    rejectedActions: total("rejectedActions"), staleResponses: total("staleResponses"), limitHits: total("limitHits"), latencyP95Ms: latencies.length ? latencies[Math.ceil(latencies.length * 0.95) - 1] : null };
}

function comparison(label: string, pairs: readonly AiJevPair[]): JevReportComparison {
  const values = pairs.map((pair) => ({ seed: pair.seed, baseline: outcome(pair.baseline, pair.playerId), candidate: outcome(pair.candidate, pair.playerId) }));
  const absolute = (arm: "baseline" | "candidate") => ({ meanPlacement: mean(values.map((value) => value[arm].placement)), topFourRate: mean(values.map((value) => Number(value[arm].topFour))), winRate: mean(values.map((value) => Number(value[arm].win))) });
  const clusters = [...new Set(values.map((value) => value.seed))].sort((left, right) => left - right).map((seed) => {
    const group = values.filter((value) => value.seed === seed);
    return { seed, placementDelta: mean(group.map((value) => value.candidate.placement - value.baseline.placement))!, topFourDelta: mean(group.map((value) => Number(value.candidate.topFour) - Number(value.baseline.topFour)))!, winDelta: mean(group.map((value) => Number(value.candidate.win) - Number(value.baseline.win)))! };
  });
  return { label, pairs: pairs.length, baseline: absolute("baseline"), candidate: absolute("candidate"), delta: summarizeAiRecruitPlannerSeedMetrics(clusters, pairs.length), coverage: coverage(pairs) };
}

export function summarizeAiJevReport(value: unknown): AiJevFinalSummary {
  const report = checkedReport(value), config = report.configuration;
  const exposureCells = config.arms.flatMap((arm) => config.scenarios.flatMap((scenario) => config.profiles.flatMap((profile) =>
    Array.from({ length: 8 }, (_, seat): JevReportExposureCell => {
      const pairs = report.pairs.filter((pair) => pair.arm === arm && pair.scenario === scenario && pair.profile === profile && pair.physicalSeat === seat);
      const exposed = pairs.filter((pair) => pair.candidate.diagnostics.some((turn) => turn.appliedActions > 0));
      const c = coverage(pairs);
      return { arm, scenario, profile, seat, label: `${TITLES[profile]} / 席位 ${seat + 1} / ${TITLES[scenario]}`, candidateGames: pairs.length,
        modelExposedGames: exposed.length, exposedSeedClusters: new Set(exposed.map((pair) => pair.seed)).size, modelAppliedActions: c.modelAppliedActions, successfulResponses: c.successfulResponses,
        bySeed: Array.from({ length: config.seeds }, (_, offset) => {
          const seed = config.startSeed + offset, group = pairs.filter((pair) => pair.seed === seed);
          return { seed, candidateGames: group.length, modelExposedGames: exposed.filter((pair) => pair.seed === seed).length, modelAppliedActions: coverage(group).modelAppliedActions };
        }) };
    }))));
  const sections: JevReportSection[] = [];
  for (const arm of config.arms) for (const scenario of ["all", ...config.scenarios]) {
    const pairs = report.pairs.filter((pair) => pair.arm === arm && (scenario === "all" || pair.scenario === scenario));
    sections.push({ arm, scenario, overall: comparison("总体", pairs),
      profiles: config.profiles.map((profile) => comparison(TITLES[profile], pairs.filter((pair) => pair.profile === profile))),
      seats: Array.from({ length: 8 }, (_, seat) => comparison(`席位 ${seat + 1}`, pairs.filter((pair) => pair.physicalSeat === seat))),
      scenarios: config.scenarios.map((name) => comparison(TITLES[name], pairs.filter((pair) => pair.scenario === name))),
      exposureCells: exposureCells.filter((cell) => cell.arm === arm && (scenario === "all" || cell.scenario === scenario)) });
  }
  const overall = coverage(report.pairs);
  const knownCount = (usageValue: unknown, availabilityValue: unknown): number | null => {
    if (usageValue === undefined && availabilityValue === undefined) return null;
    if (usageValue !== undefined && availabilityValue !== undefined && count(usageValue) !== count(availabilityValue)) reject("shape");
    return count(usageValue ?? availabilityValue);
  };
  const knownUsageRequests = knownCount(report.usage.knownUsageRequests, report.availability?.knownUsageRequests);
  const unknownUsageRequests = knownCount(report.usage.unknownUsageRequests, report.availability?.unknownUsageRequests);
  const failedRequests = knownCount(report.usage.failedRequests, report.availability?.failedRequests);
  const modelExposureUsable = exposureCells.every((cell) => cell.candidateGames > 0 && cell.modelExposedGames > 0);
  const ittEvidenceUsable = config.seeds >= 2;
  const cleanEvidenceUsable = ittEvidenceUsable && modelExposureUsable && failedRequests === 0 && unknownUsageRequests === 0 && report.availability?.circuitReason == null && overall.providerFailureGames === 0 && overall.emergencyChoiceActions === 0 && overall.rejectedActions === 0 && overall.staleResponses === 0 && overall.limitHits === 0 && report.pairs.every((pair) => pair.candidate.diagnostics.every((turn) => turn.completed && !(turn.fallbacks.cycle > 0)));
  const input = count(report.usage.inputTokens);
  const adapterVersion = (config as unknown as Record<string, unknown>).adapterVersion;
  if (adapterVersion !== undefined && (typeof adapterVersion !== "string" || !/^[A-Za-z0-9._-]{1,96}$/.test(adapterVersion))) reject("shape");
  return { reportVersion: "ai-jev-final-report-v1", label: "完整真实整局对照", runId: config.runId, model: config.model, seeds: config.seeds,
    adapterVersion: typeof adapterVersion === "string" ? adapterVersion : "未记录",
    scenarios: [...config.scenarios], profiles: [...config.profiles], rotations: [...config.rotations], arms: [...config.arms], scheduledGames: report.scheduledGames,
    completedGames: report.processedGames, expectedPairs: report.expectedPairs, matchedPairs: report.pairs.length, sourceStable: true, sourceSha256: report.provenance.sourceSha256,
    interpretation: "ITT 比较的是实际接入策略：真实 Jev 决策加上预先规定的故障与低证据回退。发生回退的完整对局仍纳入；结果不能拆解为模型本身的纯净因果贡献。",
    direction: "差值均为候选减基线：平均名次差为负表示更好；前四率和吃鸡率差为正表示更好，率差以百分点展示。",
    findings: config.arms.map((arm) => {
      const row = sections.find((section) => section.arm === arm && section.scenario === "all")!.overall;
      if (row.coverage.modelAppliedActions === 0) return `${TITLES[arm]}：没有实际模型动作，不能评价 Jev 棋力提升。`;
      const delta = row.delta.placement.meanDelta!, bounds = row.delta.placement.confidence95;
      const observed = delta < 0 ? "改善" : delta > 0 ? "退化" : "持平";
      const inference = bounds === null ? "独立 seed 不足，无法提供区间" : bounds.lower <= 0 && bounds.upper >= 0 ? "95% 区间包含 0，尚未证明稳定提升" : bounds.upper < 0 ? "95% 区间低于 0，但仍需独立确认" : "95% 区间高于 0，当前样本显示退化";
      return `${TITLES[arm]}接入策略：样本平均名次${observed}（差 ${format(delta)}），${inference}。`;
    }),
    uncertainty: `仅有 ${config.seeds} 个独立 seed cluster。先在每个 seed 内平均相关席位、策略和场景的配对差值，再用 Student t 计算 95% 区间；不是把所有配对当作独立样本。少量 cluster 的区间通常很宽，不能据开发样本宣称稳定提升。`,
    promotionAccepted: false, modelExposureUsable, cleanEvidenceUsable, ittEvidenceUsable,
    availability: { globalCircuitOpened: report.availability?.circuitReason != null, knownUsageRequests, unknownPossiblyChargedRequests: unknownUsageRequests, failedRequests },
    usage: { requests: count(report.usage.requests), reservedInputTokens: count(report.usage.reservedInputTokens), knownInputTokens: input, knownOutputTokens: count(report.usage.outputTokens),
      knownCostUsd: input * 0.042 / 1_000_000, pricePerMillionInputUsd: 0.042, outputPriceUsd: 0, priceSnapshot: "2026-10-12", priceSource: PRICE_SOURCE,
      costLimitation: "仅按供应商返回的已知输入 token 估算，输出 token 免费；未知使用量、可能已收费的失败请求不含在此费用内。保守预留单位不是账单 token，估算不是完整账单。" }, sections };
}

function format(number: number | null, digits = 2): string { return number === null ? "—" : number.toFixed(digits); }
function percent(number: number | null): string { return number === null ? "—" : `${(number * 100).toFixed(2)}%`; }
function interval(metric: AiRecruitPlannerComparisons["placement"], multiplier = 1): string { return metric.confidence95 ? `[${format(metric.confidence95.lower * multiplier)}, ${format(metric.confidence95.upper * multiplier)}]` : "不足两个 seed，不计算"; }
export function escapeJevReportHtml(value: unknown): string { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
function markdownTable(rows: JevReportComparison[]): string {
  return ["| 分组 / 配对数 | 基线名次 | 候选名次 | 名次差 / 95% CI | 基线前四 | 候选前四 | 前四差 pp / CI | 基线吃鸡 | 候选吃鸡 | 吃鸡差 pp / CI |",
    "|---|---:|---:|---|---:|---:|---|---:|---:|---|",
    ...rows.map((row) => `| ${row.label} / ${row.pairs} | ${format(row.baseline.meanPlacement)} | ${format(row.candidate.meanPlacement)} | ${format(row.delta.placement.meanDelta)} / ${interval(row.delta.placement)} | ${percent(row.baseline.topFourRate)} | ${percent(row.candidate.topFourRate)} | ${format(row.delta.topFour.meanDelta === null ? null : row.delta.topFour.meanDelta * 100)} / ${interval(row.delta.topFour, 100)} | ${percent(row.baseline.winRate)} | ${percent(row.candidate.winRate)} | ${format(row.delta.win.meanDelta === null ? null : row.delta.win.meanDelta * 100)} / ${interval(row.delta.win, 100)} |`)].join("\n");
}

export function renderAiJevMarkdown(summary: AiJevFinalSummary): string {
  const lines = [`# Jev 接入前后整局对照：${summary.runId}`, "", `${summary.label}：${summary.completedGames}/${summary.scheduledGames} 局，${summary.matchedPairs}/${summary.expectedPairs} 个配对，固定模型 ${summary.model}，接入策略 ${summary.adapterVersion}。`, "", summary.interpretation, "", summary.direction, "", summary.uncertainty,
    "", ...summary.findings, "", `正式 AI 推广：**未获批准（promotionAccepted=false）**。模型暴露门槛：${summary.modelExposureUsable ? "通过" : "未通过"}；纯净门槛：${summary.cleanEvidenceUsable ? "通过" : "未通过"}。这些门槛与正式推广验收不同。`, "",
    "模型执行动作数不等于相对正式策略的动作分歧；本实验没有测量逐动作反事实分歧。游戏覆盖率指至少执行一次模型选择动作的候选对局占比；决策执行率分母是记录的模型决策机会，不是整局全部招募动作。", ""];
  for (const arm of summary.arms) {
    const section = summary.sections.find((item) => item.arm === arm && item.scenario === "all")!;
    const c = section.overall.coverage;
    lines.push(`## ${TITLES[arm]}`, "", markdownTable([section.overall]), "", `覆盖：${c.modelExposedGames}/${c.candidateGames} 局（${percent(c.gameCoverage)}）；成功回答 ${c.successfulResponses}；模型执行动作 ${c.modelAppliedActions}；决策执行率 ${percent(c.decisionApplicationRate)}；timeout 回退 ${c.timeoutFallbacks}；circuit 回退 ${c.circuitFallbacks}；应急动作 ${c.emergencyChoiceActions}；失败影响对局 ${c.providerFailureGames}；输入超限回退 ${c.inputLimitFallbacks}；无区分排序回退 ${c.unresolvedRankingFallbacks}；关闭模型续跑对局 ${c.modelDisabledGames}；成功响应 p95 ${format(c.latencyP95Ms)}ms。`, "", "### 七种策略", "", markdownTable(section.profiles), "", "### 八个物理席位", "", markdownTable(section.seats), "", "### 场景", "", markdownTable(section.scenarios), "", "### 策略 × 席位 × 场景的模型暴露", "", "模型暴露门槛要求每个单元有真实执行动作；零暴露和未安排单元明确保留。", "", "| 单元 | 对局 | 模型暴露对局 | 暴露 seed 数 | 模型动作 | 成功回答 | 状态 |", "|---|---:|---:|---:|---:|---:|---|",
      ...section.exposureCells.map((cell) => `| ${cell.label} | ${cell.candidateGames} | ${cell.modelExposedGames} | ${cell.exposedSeedClusters} | ${cell.modelAppliedActions} | ${cell.successfulResponses} | ${cell.candidateGames === 0 ? "未安排" : cell.modelExposedGames === 0 ? "零模型暴露" : "有模型暴露"}；${cell.bySeed.map((seed) => `${seed.seed}: ${seed.modelExposedGames}/${seed.candidateGames}`).join("；")} |`), "");
  }
  lines.push("## 费用与可用性", "", `请求/预留：${summary.usage.requests} / ${summary.usage.reservedInputTokens}；已知输入/输出 token：${summary.usage.knownInputTokens} / ${summary.usage.knownOutputTokens}；已知使用量请求 ${summary.availability.knownUsageRequests ?? "未提供"}；未知可能收费请求 ${summary.availability.unknownPossiblyChargedRequests ?? "未提供"}；失败请求 ${summary.availability.failedRequests ?? "未提供"}；全局熔断：${summary.availability.globalCircuitOpened ? "是" : "否"}。`, "", `已知费用估算：$${summary.usage.knownCostUsd.toFixed(6)}，价格为输入 $0.042 / 百万 token、输出免费；[官方价格来源](${summary.usage.priceSource})，快照日期 ${summary.usage.priceSnapshot}。`, "", summary.usage.costLimitation, "");
  return lines.join("\n");
}

export function renderAiJevHtml(summary: AiJevFinalSummary): string {
  const escaped = escapeJevReportHtml;
  const data = JSON.stringify(summary.sections).replace(/[<>&\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jev 整局对照</title>
<style>body{margin:0;background:#f4f7fc;color:#17263c;font:15px/1.65 system-ui,sans-serif}main{max-width:1300px;margin:auto;padding:32px 24px}h1{line-height:1.25;font-size:30px}h2{margin:30px 0 12px}.card{background:white;border:1px solid #dbe4f0;border-radius:14px;padding:22px;margin:16px 0}.note{color:#4b5b73}.filters{display:flex;gap:20px;flex-wrap:wrap}select{font:inherit;padding:7px;border:1px solid #abbdd4;border-radius:6px}.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:1040px;font-size:13px}caption{text-align:left;font-weight:650;padding:12px 0}th,td{padding:9px;border-bottom:1px solid #e6edf5;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}th{background:#edf3fb}strong{color:#164583}a{color:#245dba}</style>
<main><h1>Jev 接入前后整局对照</h1><p class="note">${escaped(summary.runId)} · ${escaped(summary.model)} · ${escaped(summary.adapterVersion)} · ${summary.completedGames}/${summary.scheduledGames} 局 · ${summary.matchedPairs}/${summary.expectedPairs} 配对</p>
<div class="card"><strong>${escaped(summary.label)}</strong><p>${escaped(summary.interpretation)}</p><p>${escaped(summary.direction)}</p>${summary.findings.map((finding) => `<p><strong>${escaped(finding)}</strong></p>`).join("")}<p class="note">${escaped(summary.uncertainty)}</p><p>推广未获批准（promotionAccepted=false）。模型暴露门槛：${summary.modelExposureUsable ? "通过" : "未通过"}；纯净门槛：${summary.cleanEvidenceUsable ? "通过" : "未通过"}。</p></div>
<div class="card filters"><label>策略模式 <select id="arm-filter">${summary.arms.map((arm) => `<option value="${escaped(arm)}">${escaped(TITLES[arm])}</option>`).join("")}</select></label><label>场景 <select id="scenario-filter"><option value="all">全部场景</option>${summary.scenarios.map((scenario) => `<option value="${escaped(scenario)}">${escaped(TITLES[scenario])}</option>`).join("")}</select></label></div>
<div id="coverage" class="card" aria-live="polite"></div><div id="tables"></div><div id="cells"></div>
<div class="card"><h2>统计边界</h2><p>模型执行动作数不能冒充与正式策略的动作分歧；逐动作反事实分歧没有测量。游戏覆盖率的分子是至少一次模型动作的候选对局数，分母是全部候选对局数；决策执行率以记录的模型决策机会为分母。各行先独立按 seed 聚类；少于两个 cluster 不提供区间。</p><h2>费用与可用性</h2><p>已知输入 ${summary.usage.knownInputTokens} / 输出 ${summary.usage.knownOutputTokens} token；预留 ${summary.usage.reservedInputTokens}；请求 ${summary.usage.requests}。已知使用量请求 ${summary.availability.knownUsageRequests ?? "未提供"}，未知可能收费请求 ${summary.availability.unknownPossiblyChargedRequests ?? "未提供"}，失败请求 ${summary.availability.failedRequests ?? "未提供"}；全局熔断 ${summary.availability.globalCircuitOpened ? "已触发" : "未触发"}。</p><p>已知费用估算 $${summary.usage.knownCostUsd.toFixed(6)}；输入 $0.042 / 百万 token，输出免费。<a href="${PRICE_SOURCE}">官方价格来源</a>（${summary.usage.priceSnapshot}快照）。</p><p class="note">${escaped(summary.usage.costLimitation)}</p></div></main>
<script type="application/json" id="report-data">${data}</script><script>
(()=>{const data=JSON.parse(document.getElementById('report-data').textContent);const arm=document.getElementById('arm-filter'),scenario=document.getElementById('scenario-filter');const e=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const n=v=>v===null?'—':Number(v).toFixed(2),p=v=>v===null?'—':n(v*100)+'%',ci=(v,m)=>v.confidence95?'['+n(v.confidence95.lower*m)+', '+n(v.confidence95.upper*m)+']':'不足两个 seed';const table=(title,rows)=>'<section class="card scroll"><table><caption>'+e(title)+'</caption><thead><tr>'+['分组/配对数','基线名次','候选名次','名次差 / 95% CI','基线前四','候选前四','前四差 pp / CI','基线吃鸡','候选吃鸡','吃鸡差 pp / CI'].map(t=>'<th scope="col">'+e(t)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+[r.label+' / '+r.pairs,n(r.baseline.meanPlacement),n(r.candidate.meanPlacement),n(r.delta.placement.meanDelta)+' / '+ci(r.delta.placement,1),p(r.baseline.topFourRate),p(r.candidate.topFourRate),n(r.delta.topFour.meanDelta===null?null:r.delta.topFour.meanDelta*100)+' / '+ci(r.delta.topFour,100),p(r.baseline.winRate),p(r.candidate.winRate),n(r.delta.win.meanDelta===null?null:r.delta.win.meanDelta*100)+' / '+ci(r.delta.win,100)].map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';function render(){const s=data.find(v=>v.arm===arm.value&&v.scenario===scenario.value),c=s.overall.coverage;document.getElementById('coverage').textContent='模型游戏覆盖 '+c.modelExposedGames+'/'+c.candidateGames+'（'+p(c.gameCoverage)+'）；成功回答 '+c.successfulResponses+'；模型执行动作 '+c.modelAppliedActions+'；决策执行率 '+p(c.decisionApplicationRate)+'；timeout 回退 '+c.timeoutFallbacks+'；circuit 回退 '+c.circuitFallbacks+'；应急动作 '+c.emergencyChoiceActions+'；失败影响对局 '+c.providerFailureGames+'；输入超限回退 '+c.inputLimitFallbacks+'；无区分排序回退 '+c.unresolvedRankingFallbacks+'；关闭模型续跑对局 '+c.modelDisabledGames+'；成功响应 p95 '+n(c.latencyP95Ms)+'ms。';document.getElementById('tables').innerHTML=table('总体比较',[s.overall])+table('七种策略',s.profiles)+table('八个物理席位',s.seats)+table('场景',s.scenarios);}arm.addEventListener('change',render);scenario.addEventListener('change',render);render();})();
(()=>{const data=JSON.parse(document.getElementById('report-data').textContent),arm=document.getElementById('arm-filter'),scenario=document.getElementById('scenario-filter');const e=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function renderCells(){const s=data.find(v=>v.arm===arm.value&&v.scenario===scenario.value);document.getElementById('cells').innerHTML='<section class="card scroll"><table><caption>策略 × 席位 × 场景：实际模型暴露（每个单元至少一次才通过暴露门槛）</caption><thead><tr>'+['单元','模型暴露/对局','暴露 seed 数','模型动作','成功回答','逐 seed 暴露/对局','状态'].map(v=>'<th scope="col">'+e(v)+'</th>').join('')+'</tr></thead><tbody>'+s.exposureCells.map(c=>'<tr>'+[c.label,c.modelExposedGames+'/'+c.candidateGames,c.exposedSeedClusters,c.modelAppliedActions,c.successfulResponses,c.bySeed.map(v=>v.seed+': '+v.modelExposedGames+'/'+v.candidateGames).join('；'),c.candidateGames===0?'未安排':c.modelExposedGames===0?'零模型暴露':'有模型暴露'].map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></section>';}arm.addEventListener('change',renderCells);scenario.addEventListener('change',renderCells);renderCells();})();
</script></html>`;
}

export function renderAiJevCsv(value: unknown): string {
  const report = checkedReport(value);
  const header = ["seed", "scenario", "arm", "profile", "physicalSeat", "baselinePlacement", "candidatePlacement", "placementDelta", "baselineTopFour", "candidateTopFour", "topFourDelta", "baselineWin", "candidateWin", "winDelta", "successfulResponses", "modelAppliedActions", "timeoutFallbacks", "emergencyChoiceActions"];
  const rows = report.pairs.map((pair) => {
    const b = outcome(pair.baseline, pair.playerId), c = outcome(pair.candidate, pair.playerId), d = coverage([pair]);
    return [pair.seed, pair.scenario, pair.arm, pair.profile, pair.physicalSeat, b.placement, c.placement, c.placement - b.placement, Number(b.topFour), Number(c.topFour), Number(c.topFour) - Number(b.topFour), Number(b.win), Number(c.win), Number(c.win) - Number(b.win), d.successfulResponses, d.modelAppliedActions, d.timeoutFallbacks, d.emergencyChoiceActions];
  });
  return [header, ...rows].map((row) => row.map((value) => typeof value === "number" ? String(value) : `"${value.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
}

export function writeAiJevReportArtifacts(inputPath: string, outputDirectory: string): { summary: AiJevFinalSummary; files: string[] } {
  if (statSync(inputPath).size > 128 * 1024 * 1024) reject("shape");
  const raw: unknown = JSON.parse(readFileSync(inputPath, "utf8"));
  const summary = summarizeAiJevReport(raw);
  const artifacts = { "summary.html": renderAiJevHtml(summary), "summary.md": renderAiJevMarkdown(summary), "summary.json": JSON.stringify(summary, null, 2) + "\n", "paired-results.csv": renderAiJevCsv(raw) };
  if (Object.keys(artifacts).some((name) => existsSync(resolve(outputDirectory, name)))) reject("output-exists");
  mkdirSync(outputDirectory, { recursive: true });
  for (const [name, contents] of Object.entries(artifacts)) writeFileSync(resolve(outputDirectory, name), contents, { flag: "wx" });
  return { summary, files: Object.keys(artifacts) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === "--help") console.log("Generate a complete real Jev comparison: --input report.json --out NEW-output-directory. Incomplete, drifted and synthetic runs are rejected; no API calls.");
    else {
      if (args.length !== 4 || args[0] !== "--input" || args[2] !== "--out") reject("shape");
      const result = writeAiJevReportArtifacts(resolve(args[1]), resolve(args[3]));
      console.log(JSON.stringify({ label: result.summary.label, completedGames: result.summary.completedGames, matchedPairs: result.summary.matchedPairs, promotionAccepted: false, files: result.files }));
    }
  } catch (error) { console.error(error instanceof AiJevReportError ? error.message : "Jev report could not be read or written."); process.exitCode = 1; }
}
