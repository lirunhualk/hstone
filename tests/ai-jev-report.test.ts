import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import type { AiJevBenchmarkReport, AiJevGameRun, AiJevPair } from "../scripts/benchmark-ai-jev.ts";
import type { JevTurnDiagnostics } from "../scripts/ai-jev-policy.ts";
import { AiJevReportError, renderAiJevCsv, renderAiJevHtml, renderAiJevMarkdown, summarizeAiJevReport, writeAiJevReportArtifacts } from "../scripts/report-ai-jev.ts";

const PROFILES = ["balanced", "magnetic", "tempo", "triple", "powerLevel", "economy", "deathrattle"] as const;
function turn(overrides: Partial<JevTurnDiagnostics> = {}): JevTurnDiagnostics {
  return { decisions: 2, calls: 2, successfulResponses: 2, appliedActions: 1, emergencyChoiceActions: 0, rejectedActions: 0, staleResponses: 0, limitHits: 0, completed: true, fallbacks: {}, latenciesMs: [10, 20], inputTokens: 40, outputTokens: 2, ...overrides };
}
function run(hash: string, isCandidate = false): AiJevGameRun {
  const placements = [1, 5, 3, 4, 2, 6, 7, 8];
  return { completed: true, drawn: false, truncated: false, failure: null, initialStateSha256: hash, finalRound: 12, decisionTrace: "private/local/path/prompts.jsonl",
    outcomes: Object.fromEntries(placements.map((placement, index) => [`player-${index}`, { placement, topFour: placement <= 4, win: placement === 1 }])), diagnostics: isCandidate ? [turn()] : [],
    usage: { requests: 0, reservedInputTokens: 0, inputTokens: 0, outputTokens: 0, totalLatencyMs: 0, inFlightLatencyMs: 0, stopped: false } };
}

function fixture(full = false): AiJevBenchmarkReport {
  const config = { mode: "jev", preset: "development", startSeed: 94_910_001, seeds: 2, maxRequests: 1000, maxInputTokens: 1_000_000,
    timeoutMs: 5000, maxRounds: 150, maxDecisionsPerTurn: 50, initialHealth: 40, runId: "report-test", model: "jev-1.13.0", concurrency: 1,
    scenarios: full ? ["neutral-v1", "live-lobby-v1"] : ["neutral-v1"], rotations: full ? [0, 1, 2, 3, 4, 5, 6, 7] : [0], profiles: full ? [...PROFILES] : ["balanced"], arms: ["all-decisions", "critical-decisions"] } as AiJevBenchmarkReport["configuration"];
  const baselines: AiJevGameRun[] = [], pairs: AiJevPair[] = [];
  for (let offset = 0; offset < config.seeds; offset += 1) for (const scenario of config.scenarios) for (const rotation of config.rotations) {
    const seed = config.startSeed + offset, hash = createHash("sha256").update([seed, scenario, rotation].join("|")).digest("hex");
    const baseline = run(hash);
    baselines.push(baseline);
    for (const profile of config.profiles) for (const arm of config.arms) {
      const index = PROFILES.indexOf(profile), playerId = `player-${index + 1}`, candidate = run(hash, true);
      if (!full) candidate.outcomes[playerId] = { placement: offset === 0 ? 3 : 7, topFour: offset === 0, win: false };
      pairs.push({ seed, scenario, rotation, profile, arm, playerId, physicalSeat: (index + 1 - rotation + 8) % 8, baseline: structuredClone(baseline), candidate,
        placementDelta: 999, topFourDelta: 999, winDelta: 999 });
    }
  }
  const provenance = { sourceSha256: "a".repeat(64), contentSha256: "b".repeat(64), profilesSha256: "c".repeat(64), configurationSha256: "d".repeat(64), policyVersion: "baseline-v4" };
  // Runtime checks read raw pairs; cached summaries below are intentionally absent.
  return { benchmarkVersion: "single-seat-jev-integration-itt-v2", label: "real-jev-development", configuration: config, provenance, provenanceAfter: { ...provenance }, sourceStable: true, status: "complete",
    scheduledGames: baselines.length + pairs.length, processedGames: baselines.length + pairs.length, expectedPairs: pairs.length, pairs, baselines, failures: [],
    usage: { requests: 10, reservedInputTokens: 50_000, inputTokens: 1_000_000, outputTokens: 400, totalLatencyMs: 100, inFlightLatencyMs: 0, stopped: false, knownUsageRequests: 10, unknownUsageRequests: 0, failedRequests: 0 },
    availability: { circuitReason: null, providerFailureGames: 0, modelExposedGames: pairs.length, completedCandidateGames: pairs.length, requestSuccessRate: 1, knownUsageRequests: 10, unknownUsageRequests: 0, failedRequests: 0 },
    comparisons: {}, diagnostics: {}, diagnosticsByArm: {}, evidenceUsable: true, ittEvidenceUsable: true, cleanEvidenceUsable: true, modelExposureUsable: true, promotionAccepted: false, limitations: [] } as unknown as AiJevBenchmarkReport;
}

test("report independently recomputes outcome direction and Student t intervals over seed clusters", () => {
  const summary = summarizeAiJevReport(fixture());
  const overall = summary.sections.find((section) => section.arm === "all-decisions" && section.scenario === "all")!.overall;
  assert.deepEqual(overall.baseline, { meanPlacement: 5, topFourRate: 0, winRate: 0 });
  assert.deepEqual(overall.candidate, { meanPlacement: 5, topFourRate: 0.5, winRate: 0 });
  assert.equal(overall.delta.placement.meanDelta, 0, "stored delta=999 is never used");
  assert.deepEqual(overall.delta.placement.confidence95, { lower: -25.412, upper: 25.412 });
  assert.equal(overall.delta.placement.seedClusters, 2);
  assert.equal(overall.delta.topFour.meanDelta, 0.5, "candidate-minus-baseline, not the opposite direction");
  assert.equal(summary.usage.knownCostUsd, 0.042);
  assert.equal(summary.promotionAccepted, false);
  assert.match(summary.uncertainty, /2 个独立 seed/);
});

test("a 480-game matrix reports seven profiles, eight seats, two scenarios and two clusters", () => {
  const summary = summarizeAiJevReport(fixture(true));
  assert.equal(summary.completedGames, 480);
  assert.equal(summary.matchedPairs, 448);
  assert.equal(summary.sections.length, 6);
  const section = summary.sections[0];
  assert.equal(section.overall.pairs, 224);
  assert.equal(section.profiles.length, 7);
  assert.equal(section.seats.length, 8);
  assert.equal(section.scenarios.length, 2);
  assert.equal(section.overall.delta.placement.seedClusters, 2, "448 related pairs are not 448 independent observations");
  assert.deepEqual(section.overall.delta.placement.confidence95, { lower: 0, upper: 0 });
  assert.ok(section.seats.every((row) => row.pairs === 28));
});

test("complete ITT retains failure fallbacks but keeps pure evidence and actual exposure separate", () => {
  const report = fixture();
  report.pairs[0].candidate.providerFailures = ["timeout"];
  report.pairs[0].candidate.diagnostics = [turn({ successfulResponses: 0, appliedActions: 0, fallbacks: { timeout: 1, "provider-circuit": 3 }, emergencyChoiceActions: 1 })];
  report.usage.unknownUsageRequests = 1;
  report.usage.failedRequests = 1;
  report.availability.unknownUsageRequests = 1;
  report.availability.failedRequests = 1;
  report.availability.circuitReason = "consecutive-provider-failures";
  const summary = summarizeAiJevReport(report);
  const coverage = summary.sections[0].overall.coverage;
  assert.equal(summary.ittEvidenceUsable, true);
  assert.equal(summary.cleanEvidenceUsable, false);
  assert.equal(coverage.modelExposedGames, 1);
  assert.equal(coverage.gameCoverage, 0.5);
  assert.equal(coverage.timeoutFallbacks, 1);
  assert.equal(coverage.circuitFallbacks, 3);
  assert.equal(coverage.emergencyChoiceActions, 1);
  assert.equal(summary.availability.unknownPossiblyChargedRequests, 1);
  assert.equal(summary.availability.globalCircuitOpened, true);
  for (const pair of report.pairs) pair.candidate.diagnostics = [turn({ appliedActions: 0 })];
  assert.equal(summarizeAiJevReport(report).modelExposureUsable, false, "complete local-only fallback does not claim model strength");
});

test("cell-level exposure cannot borrow model actions from another profile, seat or scenario", () => {
  const report = fixture(true);
  for (const pair of report.pairs) if (pair.arm === "all-decisions" && pair.profile === "balanced" && pair.physicalSeat === 0 && pair.scenario === "live-lobby-v1") pair.candidate.diagnostics = [turn({ appliedActions: 0 })];
  const summary = summarizeAiJevReport(report);
  assert.equal(summary.modelExposureUsable, false);
  assert.equal(summary.cleanEvidenceUsable, false);
  const cell = summary.sections.find((section) => section.arm === "all-decisions" && section.scenario === "all")!.exposureCells.find((value) => value.profile === "balanced" && value.seat === 0 && value.scenario === "live-lobby-v1")!;
  assert.equal(cell.candidateGames, 2);
  assert.equal(cell.modelExposedGames, 0);
  assert.ok(cell.bySeed.every((seed) => seed.candidateGames === 1 && seed.modelExposedGames === 0));
  assert.match(renderAiJevMarkdown(summary), /零模型暴露/);
  const one = report.pairs.find((pair) => pair.arm === "all-decisions" && pair.profile === "balanced" && pair.physicalSeat === 0 && pair.scenario === "live-lobby-v1")!;
  one.candidate.diagnostics = [turn()];
  assert.equal(summarizeAiJevReport(report).modelExposureUsable, true, "one exposed seed suffices for its cell; the other seed remains explicit");
});

test("final report rejects incomplete games, missing pairs, duplicate keys and source drift", () => {
  const mutations: Array<(report: AiJevBenchmarkReport) => void> = [
    (report) => { report.status = "running"; },
    (report) => { report.pairs[0].candidate.completed = false; },
    (report) => { report.pairs.pop(); },
    (report) => { report.pairs[1] = structuredClone(report.pairs[0]); },
    (report) => { report.pairs[0].physicalSeat = 7; },
    (report) => { report.pairs[0].candidate.initialStateSha256 = "wrong"; },
    (report) => { report.sourceStable = false; },
    (report) => { report.provenanceAfter!.sourceSha256 = "e".repeat(64); },
    (report) => { report.processedGames -= 1; },
    (report) => { report.pairs[0].candidate.outcomes[report.pairs[0].playerId].topFour = false; },
  ];
  for (const mutate of mutations) {
    const report = fixture(); mutate(report);
    assert.throws(() => summarizeAiJevReport(report), AiJevReportError);
  }
  const synthetic = fixture(); synthetic.label = "fixture-infrastructure-only";
  assert.throws(() => summarizeAiJevReport(synthetic), (error) => error instanceof AiJevReportError && error.code === "not-real");
});

test("settled drawn games retain exact placements and never manufacture wins", () => {
  const report = fixture();
  report.pairs[0].candidate.drawn = true;
  assert.equal(summarizeAiJevReport(report).matchedPairs, 4);
  report.pairs[0].candidate.outcomes[report.pairs[0].playerId].win = true;
  assert.throws(() => summarizeAiJevReport(report), AiJevReportError);
});

test("artifacts contain comparisons and defined coverage but omit raw prompts, credentials and local paths", () => {
  const report = fixture();
  Object.assign(report, { arbitrary: { apiKey: "not-a-real-key", board: "private-board", proxy: "http://private.proxy.local", prompt: "private-prompt" } });
  report.pairs[0].candidate.providerFailures = ["private-provider-error not-a-real-key"];
  const summary = summarizeAiJevReport(report);
  const html = renderAiJevHtml(summary), markdown = renderAiJevMarkdown(summary), csv = renderAiJevCsv(report), json = JSON.stringify(summary);
  for (const output of [html, markdown, csv, json]) for (const secret of ["not-a-real-key", "private-board", "private-prompt", "private.proxy.local", "private/local/path"]) assert.equal(output.includes(secret), false);
  assert.match(html, /id="arm-filter"/);
  assert.match(html, /id="scenario-filter"/);
  assert.match(html, /promotionAccepted=false/);
  assert.match(markdown, /动作分歧/);
  assert.match(markdown, /未知使用量/);
  assert.match(csv.split("\n")[1], /,5,3,-2,0,1,1,/);
});

test("HTML escapes visible text and embedded JSON closing-script injection", () => {
  const summary = summarizeAiJevReport(fixture());
  summary.runId = '<img src=x onerror="alert(1)">&';
  summary.sections[0].overall.label = "</script><script>alert(1)</script>";
  const html = renderAiJevHtml(summary);
  assert.equal(html.includes('<img src=x onerror="alert(1)">'), false);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;/);
  assert.equal(html.includes("</script><script>alert(1)</script>"), false);
  assert.match(html, /\\u003c\/script\\u003e/);
});

test("standalone HTML filter script executes both arm and scenario changes with no external resources", () => {
  const html = renderAiJevHtml(summarizeAiJevReport(fixture(true)));
  const data = html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)?.[1];
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(data && script);
  const changes: Record<string, () => void> = {};
  const element = (id: string, value = "") => ({ value, innerHTML: "", textContent: "", addEventListener(_event: string, callback: () => void) { const prior = changes[id]; changes[id] = () => { prior?.(); callback(); }; } });
  const elements = { "report-data": { textContent: data }, "arm-filter": element("arm", "all-decisions"), "scenario-filter": element("scenario", "all"), coverage: element("coverage"), tables: element("tables"), cells: element("cells") };
  runInNewContext(script, { document: { getElementById: (id: string) => elements[id as keyof typeof elements] } });
  assert.match(elements.coverage.textContent, /224\/224/);
  assert.match(elements.tables.innerHTML, /总体 \/ 224/);
  elements["arm-filter"].value = "critical-decisions";
  changes.arm();
  elements["scenario-filter"].value = "live-lobby-v1";
  changes.scenario();
  assert.match(elements.coverage.textContent, /112\/112/);
  assert.match(elements.tables.innerHTML, /总体 \/ 112/);
  assert.match(elements.cells.innerHTML, /策略 × 席位 × 场景/);
  assert.match(elements.cells.innerHTML, /94910001: 1\/1/);
  assert.equal(html.includes('<script src='), false);
});

test("CLI companion writer emits four standalone files and refuses an existing output set", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "hstone-jev-report-"));
  const input = resolve(directory, "report.json"), output = resolve(directory, "final");
  writeFileSync(input, JSON.stringify(fixture()));
  const result = writeAiJevReportArtifacts(input, output);
  assert.deepEqual(readdirSync(output).sort(), ["paired-results.csv", "summary.html", "summary.json", "summary.md"]);
  assert.equal(JSON.parse(readFileSync(resolve(output, "summary.json"), "utf8")).matchedPairs, 4);
  assert.equal(result.summary.promotionAccepted, false);
  assert.throws(() => writeAiJevReportArtifacts(input, output), (error) => error instanceof AiJevReportError && error.code === "output-exists");
});
