import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION,
  evaluateAiCooperativeCemSelectionGate,
} from "../scripts/ai-cooperative-cem-selection-gate.ts";
import type { AiPolicySuiteBenchmarkResult } from "../scripts/benchmark-ai-policy-suite.ts";

interface TestMetric {
  pairedSeats: number;
  seedClusters: number;
  meanDelta: number | null;
  confidence95: { lower: number; upper: number } | null;
}

interface TestComparison {
  placement: TestMetric;
  topFour: TestMetric;
  win: TestMetric;
}

interface TestGateFixture {
  accepted: boolean;
  evidenceUsable: boolean;
  evidenceReasons: string[];
  config: { seeds: number; startSeed: number };
  progress: {
    scheduledRuns: number;
    processedRuns: number;
    completedRuns: number;
    failedRuns: number;
  };
  expectedPairs: number;
  pairedPairs: number;
  missingPairs: number;
  truncatedRuns: number;
  runnerFailures: unknown[];
  providerErrorTotal: number;
  clusters: Array<{
    seed: number;
    episodes: unknown[];
    pairs: unknown[];
  }>;
  drawRateComparison: {
    pairedGames: number;
    seedClusters: number;
    meanDelta: number | null;
    confidence95: { lower: number; upper: number } | null;
  };
  comparisonMatrix: {
    overall: TestComparison;
    byProfile: Record<string, TestComparison>;
  };
}

function metric(
  pairedSeats: number,
  meanDelta: number,
  lower: number,
  upper: number,
): TestMetric {
  return {
    pairedSeats,
    seedClusters: 24,
    meanDelta,
    confidence95: { lower, upper },
  };
}

function nonFocusComparison(): TestComparison {
  return {
    placement: metric(384, 0, -0.25, 0.25),
    topFour: metric(384, 0, -0.05, 0.05),
    win: metric(384, 0, -0.05, 0.05),
  };
}

function validFixture(): TestGateFixture {
  const byProfile: Record<string, TestComparison> = Object.fromEntries(
    ["balanced", "magnetic", "tempo", "triple", "economy", "deathrattle"].map(
      (profileId) => [profileId, nonFocusComparison()],
    ),
  );
  byProfile.powerLevel = {
    placement: metric(384, -0.1, -0.2, -Number.EPSILON),
    topFour: metric(384, 0, -0.02, 0.02),
    win: metric(384, 0, -0.03, 0.03),
  };
  return {
    // A valid selection result deliberately does not depend on this generic gate.
    accepted: false,
    evidenceUsable: true,
    evidenceReasons: [],
    config: { seeds: 24, startSeed: 93_100_001 },
    progress: {
      scheduledRuns: 768,
      processedRuns: 768,
      completedRuns: 768,
      failedRuns: 0,
    },
    expectedPairs: 2_688,
    pairedPairs: 2_688,
    missingPairs: 0,
    truncatedRuns: 0,
    runnerFailures: [],
    providerErrorTotal: 0,
    clusters: Array.from({ length: 24 }, (_, index) => ({
      seed: 93_100_001 + index,
      episodes: Array.from({ length: 16 }, () => ({})),
      pairs: Array.from({ length: 112 }, () => ({})),
    })),
    drawRateComparison: {
      pairedGames: 384,
      seedClusters: 24,
      meanDelta: 0,
      confidence95: { lower: -0.01, upper: 0.01 },
    },
    comparisonMatrix: {
      overall: {
        placement: metric(2_688, 0, -0.1, 0.1),
        topFour: metric(2_688, 0, -0.02, 0.02),
        win: metric(2_688, 0, -0.03, 0.03),
      },
      byProfile,
    },
  };
}

function evaluate(fixture: TestGateFixture) {
  return evaluateAiCooperativeCemSelectionGate(
    fixture as unknown as AiPolicySuiteBenchmarkResult,
  );
}

function expectRejected(
  mutate: (fixture: TestGateFixture) => void,
  expectedReason: string,
): void {
  const fixture = structuredClone(validFixture());
  mutate(fixture);
  const result = evaluate(fixture);
  assert.equal(result.accepted, false);
  assert.ok(
    result.reasons.includes(expectedReason),
    `missing reason ${JSON.stringify(expectedReason)} in ${JSON.stringify(result.reasons)}`,
  );
}

function confidence95(metricValue: TestMetric): { lower: number; upper: number } {
  assert.ok(metricValue.confidence95);
  return metricValue.confidence95;
}

test("selection gate registration and accepted result are deeply frozen", () => {
  const registration = AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION;
  assert.equal(Object.isFrozen(registration), true);
  assert.equal(Object.isFrozen(registration.accounting), true);
  assert.equal(Object.isFrozen(registration.thresholds), true);
  assert.equal(Object.isFrozen(registration.thresholds.focus), true);
  assert.equal(Object.isFrozen(registration.profileIds), true);

  const result = evaluate(validFixture());
  assert.deepEqual(result, { accepted: true, reasons: [] });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.reasons), true);
});

test("selection gate accepts every inclusive threshold at equality", () => {
  const fixture = validFixture();
  assert.equal(fixture.accepted, false, "generic suite acceptance is irrelevant");
  assert.deepEqual(evaluate(fixture), { accepted: true, reasons: [] });
});

test("selection gate rejects every focus, overall, and draw-rate micro-overrun", () => {
  const epsilon = 1e-12;
  const cases: readonly [
    (fixture: TestGateFixture) => void,
    string,
  ][] = [
    [
      (fixture) => {
        const interval = fixture.drawRateComparison.confidence95;
        assert.ok(interval);
        interval.upper = 0.01 + epsilon;
      },
      "selection draw-rate confidence interval upper bound must be at most 0.01",
    ],
    [
      (fixture) => {
        fixture.comparisonMatrix.byProfile.powerLevel.placement.meanDelta =
          -0.1 + epsilon;
      },
      "powerLevel placement mean delta must be at most -0.1",
    ],
    [
      (fixture) => {
        confidence95(
          fixture.comparisonMatrix.byProfile.powerLevel.placement,
        ).upper = 0;
      },
      "powerLevel placement confidence interval upper bound must be below 0",
    ],
    [
      (fixture) => {
        confidence95(
          fixture.comparisonMatrix.byProfile.powerLevel.topFour,
        ).lower = -0.02 - epsilon;
      },
      "powerLevel top-four confidence interval lower bound must be at least -0.02",
    ],
    [
      (fixture) => {
        confidence95(
          fixture.comparisonMatrix.byProfile.powerLevel.win,
        ).lower = -0.03 - epsilon;
      },
      "powerLevel win confidence interval lower bound must be at least -0.03",
    ],
    [
      (fixture) => {
        fixture.comparisonMatrix.overall.placement.meanDelta = epsilon;
      },
      "overall placement mean delta must be at most 0",
    ],
    [
      (fixture) => {
        confidence95(fixture.comparisonMatrix.overall.placement).upper =
          0.1 + epsilon;
      },
      "overall placement confidence interval upper bound must be at most 0.1",
    ],
    [
      (fixture) => {
        confidence95(fixture.comparisonMatrix.overall.topFour).lower =
          -0.02 - epsilon;
      },
      "overall top-four confidence interval lower bound must be at least -0.02",
    ],
    [
      (fixture) => {
        confidence95(fixture.comparisonMatrix.overall.win).lower =
          -0.03 - epsilon;
      },
      "overall win confidence interval lower bound must be at least -0.03",
    ],
  ];

  for (const [mutate, reason] of cases) expectRejected(mutate, reason);
});

test("selection gate applies all three non-focus guards to every other profile", () => {
  const epsilon = 1e-12;
  for (const profileId of [
    "balanced",
    "magnetic",
    "tempo",
    "triple",
    "economy",
    "deathrattle",
  ]) {
    expectRejected(
      (fixture) => {
        confidence95(
          fixture.comparisonMatrix.byProfile[profileId].placement,
        ).upper = 0.25 + epsilon;
      },
      `${profileId} placement confidence interval upper bound must be at most 0.25`,
    );
    expectRejected(
      (fixture) => {
        confidence95(
          fixture.comparisonMatrix.byProfile[profileId].topFour,
        ).lower = -0.05 - epsilon;
      },
      `${profileId} top-four confidence interval lower bound must be at least -0.05`,
    );
    expectRejected(
      (fixture) => {
        confidence95(
          fixture.comparisonMatrix.byProfile[profileId].win,
        ).lower = -0.05 - epsilon;
      },
      `${profileId} win confidence interval lower bound must be at least -0.05`,
    );
  }
});

test("selection gate rejects missing confidence intervals", () => {
  expectRejected(
    (fixture) => {
      fixture.drawRateComparison.confidence95 = null;
    },
    "selection draw-rate confidence interval upper bound must be at most 0.01",
  );
  expectRejected(
    (fixture) => {
      fixture.comparisonMatrix.overall.topFour.confidence95 = null;
    },
    "overall top-four confidence interval lower bound must be at least -0.02",
  );
  expectRejected(
    (fixture) => {
      fixture.comparisonMatrix.byProfile.powerLevel.placement.confidence95 = null;
    },
    "powerLevel placement confidence interval upper bound must be below 0",
  );
  expectRejected(
    (fixture) => {
      fixture.comparisonMatrix.byProfile.tempo.win.confidence95 = null;
    },
    "tempo win confidence interval lower bound must be at least -0.05",
  );
});

test("selection gate rejects non-finite metrics and inverted confidence intervals", () => {
  expectRejected(
    (fixture) => {
      fixture.comparisonMatrix.byProfile.tempo.placement.meanDelta = Number.NaN;
    },
    "tempo placement mean delta must be finite",
  );
  expectRejected(
    (fixture) => {
      const interval = confidence95(
        fixture.comparisonMatrix.byProfile.tempo.placement,
      );
      interval.lower = 0.1;
      interval.upper = -0.1;
    },
    "tempo placement confidence interval must satisfy lower <= mean <= upper",
  );
  expectRejected(
    (fixture) => {
      fixture.drawRateComparison.meanDelta = Number.NaN;
    },
    "selection draw-rate mean delta must be finite",
  );
  expectRejected(
    (fixture) => {
      const interval = fixture.drawRateComparison.confidence95;
      assert.ok(interval);
      interval.lower = 0.01;
      interval.upper = 0;
    },
    "selection draw-rate confidence interval must satisfy lower <= mean <= upper",
  );
});

test("selection gate rejects every required accounting gap", () => {
  const cases: readonly [
    (fixture: TestGateFixture) => void,
    string,
  ][] = [
    [(fixture) => void (fixture.config.seeds = 23), "selection configured seeds must equal 24"],
    [
      (fixture) => void (fixture.config.startSeed = Number.NaN),
      "selection start seed must be a safe integer",
    ],
    [
      (fixture) => void (fixture.progress.scheduledRuns = 767),
      "selection scheduled runs must equal 768",
    ],
    [
      (fixture) => void (fixture.progress.processedRuns = 767),
      "selection processed runs must equal 768",
    ],
    [
      (fixture) => void (fixture.progress.completedRuns = 767),
      "selection completed runs must equal 768",
    ],
    [
      (fixture) => void (fixture.progress.failedRuns = 1),
      "selection failed runs must equal 0",
    ],
    [
      (fixture) => void (fixture.expectedPairs = 2_687),
      "selection expected pairs must equal 2688",
    ],
    [
      (fixture) => void (fixture.pairedPairs = 2_687),
      "selection paired pairs must equal 2688",
    ],
    [
      (fixture) => void (fixture.missingPairs = 1),
      "selection missing pairs must equal 0",
    ],
    [
      (fixture) => void (fixture.truncatedRuns = 1),
      "selection truncated runs must equal 0",
    ],
    [
      (fixture) => void fixture.runnerFailures.push({ message: "failure" }),
      "selection runner failures must equal 0",
    ],
    [
      (fixture) => void (fixture.providerErrorTotal = 1),
      "selection provider errors must equal 0",
    ],
    [
      (fixture) => void fixture.clusters.pop(),
      "selection clusters must equal 24",
    ],
    [
      (fixture) => void (fixture.clusters[7].seed += 1),
      "selection cluster 7 seed must equal startSeed + 7",
    ],
    [
      (fixture) => void fixture.clusters[4].episodes.pop(),
      "selection cluster 4 episodes must equal 16",
    ],
    [
      (fixture) => void fixture.clusters[9].pairs.pop(),
      "selection cluster 9 pairs must equal 112",
    ],
    [
      (fixture) => void (fixture.drawRateComparison.seedClusters = 23),
      "selection draw-rate seed clusters must equal 24",
    ],
    [
      (fixture) => void (fixture.drawRateComparison.pairedGames = 383),
      "selection draw-rate paired games must equal 384",
    ],
    [
      (fixture) =>
        void (fixture.comparisonMatrix.overall.placement.seedClusters = 23),
      "overall placement seed clusters must equal 24",
    ],
    [
      (fixture) =>
        void (fixture.comparisonMatrix.overall.placement.pairedSeats = 2_687),
      "overall placement paired seats must equal 2688",
    ],
    [
      (fixture) =>
        void (fixture.comparisonMatrix.byProfile.tempo.win.pairedSeats = 383),
      "tempo win paired seats must equal 384",
    ],
  ];

  for (const [mutate, reason] of cases) expectRejected(mutate, reason);
});

test("selection evidence and not the generic suite accepted flag controls the gate", () => {
  const genericRejected = validFixture();
  genericRejected.accepted = false;
  assert.equal(evaluate(genericRejected).accepted, true);

  const unusable = validFixture();
  unusable.accepted = true;
  unusable.evidenceUsable = false;
  unusable.evidenceReasons = ["simulated provenance drift"];
  const unusableResult = evaluate(unusable);
  assert.equal(unusableResult.accepted, false);
  assert.deepEqual(unusableResult.reasons.slice(0, 2), [
    "selection requires usable benchmark evidence",
    "selection benchmark evidence reasons must be empty",
  ]);

  const genericForgery = validFixture();
  genericForgery.accepted = true;
  genericForgery.comparisonMatrix.byProfile.powerLevel.placement.meanDelta =
    -0.1 + 1e-12;
  assert.equal(evaluate(genericForgery).accepted, false);

  const truthyNonBooleanEvidence = validFixture();
  (
    truthyNonBooleanEvidence as unknown as { evidenceUsable: unknown }
  ).evidenceUsable = "yes";
  assert.equal(evaluate(truthyNonBooleanEvidence).accepted, false);
});
