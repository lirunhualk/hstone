import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RECRUIT_PLANNER_CONTROLLED_SEATS,
  conservativePlacementDelta,
  conservativeRateDelta,
  evaluateAiRecruitPlannerGate,
  placementBoundsFromPlacement,
  runAiRecruitPlannerBenchmark,
  summarizeAiRecruitPlannerSeedMetrics,
  type AiRecruitPlannerComparisons,
} from "../scripts/benchmark-ai-recruit-planner.ts";

test("recruit planner benchmark rejects protected seeds before progress", () => {
  let progressCalls = 0;
  for (const startSeed of [
    51_001,
    30_100_001,
    30_200_001,
    30_300_001,
  ]) {
    assert.throws(
      () =>
        runAiRecruitPlannerBenchmark({
          seeds: 1,
          startSeed,
          maxRounds: 1,
          beamWidth: 1,
          maxActions: 1,
          onProgress: () => {
            progressCalls += 1;
          },
        }),
      /AI benchmark seed ledger rejected access/,
    );
  }
  assert.equal(progressCalls, 0);
});

test("placement helpers preserve exact and truncated bounds conservatively", () => {
  const exact = placementBoundsFromPlacement(6, 3);
  const truncated = placementBoundsFromPlacement(null, 5);
  assert.deepEqual(exact, { best: 6, worst: 6, exact: true });
  assert.deepEqual(truncated, { best: 1, worst: 5, exact: false });
  assert.equal(conservativePlacementDelta(truncated, exact), -1);
  assert.equal(conservativeRateDelta(truncated, exact, "topFour"), 0);
  assert.equal(conservativeRateDelta(truncated, exact, "win"), 0);
});

test("one maxRounds=1 seed schedules one baseline and all seven deployment seats deterministically", () => {
  const progress: Array<{ kind: string; controlledSeat: number | null }> = [];
  const options = {
    seeds: 1,
    startSeed: 0x9101,
    maxRounds: 1,
    beamWidth: 1,
    maxActions: 1,
    initialHealth: 40,
  } as const;
  const first = runAiRecruitPlannerBenchmark({
    ...options,
    onProgress: (item) => progress.push({
      kind: item.kind,
      controlledSeat: item.controlledSeat,
    }),
  });
  const second = runAiRecruitPlannerBenchmark(options);

  assert.deepEqual(first, second);
  assert.equal(first.progress.scheduledRuns, 8);
  assert.equal(first.progress.processedRuns, 8);
  assert.deepEqual(progress, [
    { kind: "baseline", controlledSeat: null },
    ...AI_RECRUIT_PLANNER_CONTROLLED_SEATS.map((controlledSeat) => ({
      kind: "candidate",
      controlledSeat,
    })),
  ]);
  assert.equal(first.clusters.length, 1);
  assert.equal(first.clusters[0]?.pairs.length, 7);
  assert.deepEqual(first.runnerFailures, []);
  assert.equal(first.evaluatorStable, true);
  assert.equal(first.strategyProfiles.length, 7);
  assert.ok(first.replanActions > 0);
  assert.equal(first.boundaryViolations, 0);
  assert.equal(first.replanLimitHits, 0);
  for (const pair of first.clusters[0]?.pairs ?? []) {
    assert.deepEqual(pair.baselinePlacementBounds, {
      best: 1,
      worst: 8,
      exact: false,
    });
    assert.deepEqual(pair.candidate.placementBounds, {
      best: 1,
      worst: 8,
      exact: false,
    });
  }
});

function cleanEvidence(configuredSeeds: number, comparisons: AiRecruitPlannerComparisons) {
  return {
    configuredSeeds,
    pairedSeats: configuredSeeds * 7,
    missingPairs: 0,
    incompletePlans: 0,
    rejectedActions: 0,
    boundaryViolations: 0,
    replanLimitHits: 0,
    drawnRuns: 0,
    runnerFailures: 0,
    comparisons,
  };
}

test("gate rejects statistically insufficient evidence", () => {
  const comparisons = summarizeAiRecruitPlannerSeedMetrics([
    { seed: 1, placementDelta: -1, topFourDelta: 0, winDelta: 0 },
  ]);
  const gate = evaluateAiRecruitPlannerGate(cleanEvidence(1, comparisons));
  assert.equal(gate.accepted, false);
  assert.ok(gate.reasons.some((reason) => reason.includes("24")));
});

test("gate rejects comparison metadata that omits configured clusters", () => {
  const metrics = Array.from({ length: 24 }, (_value, index) => ({
    seed: index + 1,
    placementDelta: -1 / 7,
    topFourDelta: 0,
    winDelta: 0,
  }));
  const comparisons = summarizeAiRecruitPlannerSeedMetrics(metrics);
  const gate = evaluateAiRecruitPlannerGate({
    ...cleanEvidence(25, comparisons),
    pairedSeats: 25 * 7,
  });
  assert.equal(gate.accepted, false);
  assert.ok(
    gate.reasons.some((reason) => reason.includes("configured seed clusters")),
  );
});

test("pure clustered fixture passes the strict statistical gate and runner failures veto it", () => {
  const metrics = Array.from({ length: 24 }, (_value, index) => ({
    seed: index + 1,
    placementDelta: -1 / 7,
    topFourDelta: 0,
    winDelta: 0,
  }));
  const comparisons = summarizeAiRecruitPlannerSeedMetrics(metrics);
  assert.equal(comparisons.placement.seedClusters, 24);
  assert.ok((comparisons.placement.confidence95?.upper ?? 1) < 0);

  const evidence = cleanEvidence(24, comparisons);
  assert.deepEqual(evaluateAiRecruitPlannerGate(evidence), {
    accepted: true,
    reasons: [],
  });
  const failed = evaluateAiRecruitPlannerGate({
    ...evidence,
    runnerFailures: 1,
  });
  assert.equal(failed.accepted, false);
  assert.ok(failed.reasons.some((reason) => reason.includes("runner failures")));
});
