import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_STRATEGY_PROFILES,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  AI_ROBUST_MULTI_PROFILE_CEM_SCHEMA,
  AI_ROBUST_MULTI_PROFILE_IDS,
  AI_ROBUST_MULTI_PROFILE_RECOMMENDED_TRAINING_SEEDS,
  AI_ROBUST_MULTI_PROFILE_RECOMMENDED_VALIDATION_SEEDS,
  AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT,
  aiRobustMultiProfileNormalizedStepDistanceSquared,
  applyAiRobustMultiProfileGenome,
  assertValidAiRobustMultiProfileGenome,
  createAiRobustMultiProfileValidationPlan,
  evaluateAiRobustMultiProfileTrainingObjective,
  evaluateAiRobustMultiProfileValidationGate,
  isAiRobustMultiProfileZeroGenome,
  type AiRobustMultiProfileComparisonSummary,
  type AiRobustMultiProfileGenome,
  type AiRobustMultiProfileIntervention,
  type AiRobustMultiProfileSeedRange,
  type AiRobustMultiProfileSuiteSummary,
  type AiRobustMultiProfileValidationPlan,
} from "../scripts/ai-robust-multi-profile-cem.ts";

const CANDIDATE_GENOME = Object.freeze({
  upgradeRoundOffsetDelta: 1,
  minimumUpgradeHealthDelta: 0,
  replacementMarginDelta: 0,
  maxRefreshesDelta: 0,
} as const satisfies AiRobustMultiProfileGenome);

const TRAINING_RANGE = AI_ROBUST_MULTI_PROFILE_RECOMMENDED_TRAINING_SEEDS;
const VALIDATION_RANGE = AI_ROBUST_MULTI_PROFILE_RECOMMENDED_VALIDATION_SEEDS;

function sha256(character: string): string {
  return character.repeat(64);
}

function metric(
  seedClusters: number,
  pairedSeats: number,
  meanDelta: number,
  lower = meanDelta,
  upper = meanDelta,
) {
  return {
    pairedSeats,
    seedClusters,
    meanDelta,
    confidence95: { lower, upper },
  };
}

function comparison(input: {
  readonly seeds: number;
  readonly pairedSeats?: number;
  readonly placementMean?: number;
  readonly placementLower?: number;
  readonly placementUpper?: number;
  readonly topFourMean?: number;
  readonly topFourLower?: number;
  readonly topFourUpper?: number;
  readonly winMean?: number;
  readonly winLower?: number;
  readonly winUpper?: number;
}): AiRobustMultiProfileComparisonSummary {
  const placementMean = input.placementMean ?? 0;
  const topFourMean = input.topFourMean ?? 0;
  const winMean = input.winMean ?? 0;
  const pairedSeats = input.pairedSeats ?? input.seeds * 16;
  return {
    placement: metric(
      input.seeds,
      pairedSeats,
      placementMean,
      input.placementLower ?? placementMean,
      input.placementUpper ?? placementMean,
    ),
    topFour: metric(
      input.seeds,
      pairedSeats,
      topFourMean,
      input.topFourLower ?? topFourMean,
      input.topFourUpper ?? topFourMean,
    ),
    win: metric(
      input.seeds,
      pairedSeats,
      winMean,
      input.winLower ?? winMean,
      input.winUpper ?? winMean,
    ),
  };
}

function seedRange(
  range: Readonly<{ startSeed: number; seeds: number; endSeed: number }>,
): AiRobustMultiProfileSeedRange {
  return {
    startSeed: range.startSeed,
    seeds: range.seeds,
    endSeed: range.endSeed,
  };
}

function jointIntervention(): AiRobustMultiProfileIntervention {
  return {
    interventionId: "joint",
    kind: "joint",
    focusProfileId: null,
    changedProfileIds: [...AI_ROBUST_MULTI_PROFILE_IDS],
  };
}

function singleIntervention(
  profileId: (typeof AI_ROBUST_MULTI_PROFILE_IDS)[number],
): AiRobustMultiProfileIntervention {
  return {
    interventionId: `single:${profileId}`,
    kind: "single-profile",
    focusProfileId: profileId,
    changedProfileIds: [profileId],
  };
}

function suiteSummary(input: {
  readonly candidateId?: string;
  readonly genome?: AiRobustMultiProfileGenome;
  readonly range?: AiRobustMultiProfileSeedRange;
  readonly intervention?: AiRobustMultiProfileIntervention;
  readonly overall?: AiRobustMultiProfileComparisonSummary;
  readonly profileComparison?: AiRobustMultiProfileComparisonSummary;
  readonly evidence?: Partial<AiRobustMultiProfileSuiteSummary["evidence"]>;
  readonly provenance?: Partial<
    AiRobustMultiProfileSuiteSummary["provenance"]
  >;
} = {}): AiRobustMultiProfileSuiteSummary {
  const range = input.range ?? seedRange(TRAINING_RANGE);
  const genome = input.genome ?? CANDIDATE_GENOME;
  const intervention = input.intervention ?? jointIntervention();
  const defaultComparison =
    input.profileComparison ??
    comparison({
      seeds: range.seeds,
      placementMean: -0.1,
      placementLower: -0.12,
      placementUpper: -0.1,
      topFourLower: -0.03,
      topFourUpper: 0.03,
      winLower: -0.04,
      winUpper: 0.04,
    });
  const byProfile = Object.fromEntries(
    AI_ROBUST_MULTI_PROFILE_IDS.map((profileId) => [
      profileId,
      structuredClone(defaultComparison),
    ]),
  ) as AiRobustMultiProfileSuiteSummary["byProfile"];
  const scheduledRuns = range.seeds * 32;
  const expectedPairs = range.seeds * 112;
  const candidateArmRuns = range.seeds * 16;
  const profileOverrideApplications = Object.fromEntries(
    AI_ROBUST_MULTI_PROFILE_IDS.map((profileId) => [
      profileId,
      !isAiRobustMultiProfileZeroGenome(genome) &&
      intervention.changedProfileIds.includes(profileId)
        ? candidateArmRuns
        : 0,
    ]),
  ) as AiRobustMultiProfileSuiteSummary["evidence"]["profileOverrideApplications"];
  const treatmentDecisionDivergencesByProfile = Object.fromEntries(
    AI_ROBUST_MULTI_PROFILE_IDS.map((profileId) => [
      profileId,
      !isAiRobustMultiProfileZeroGenome(genome) &&
      intervention.changedProfileIds.includes(profileId)
        ? 1
        : 0,
    ]),
  ) as AiRobustMultiProfileSuiteSummary["evidence"]["treatmentDecisionDivergencesByProfile"];
  return {
    candidateId: input.candidateId ?? "candidate-v2",
    genome,
    seedRange: range,
    intervention,
    provenance: {
      policyVersion: "test-policy",
      contentVersion: "test-content",
      contentSnapshotSha256: sha256("a"),
      evaluatorSha256: sha256("b"),
      strategyProfileSha256: sha256("c"),
      baselineRunsSha256: sha256("d"),
      candidateProfileSha256: sha256("e"),
      rawResultSha256: sha256("f"),
      ...input.provenance,
    },
    evidence: {
      evidenceUsable: true,
      evidenceReasons: [],
      scheduledRuns,
      processedRuns: scheduledRuns,
      completedRuns: scheduledRuns,
      failedRuns: 0,
      expectedPairs,
      pairedPairs: expectedPairs,
      missingPairs: 0,
      truncatedRuns: 0,
      runnerFailureCount: 0,
      providerErrorTotal: 0,
      baselineDrawnGames: 0,
      candidateDrawnGames: 0,
      profileOverrideApplications,
      treatmentDecisionDivergencesByProfile,
      policyVersionStable: true,
      contentVersionStable: true,
      contentSnapshotStable: true,
      evaluatorStable: true,
      strategyProfilesStable: true,
      candidateProfilesStable: true,
      ...input.evidence,
    },
    overall:
      input.overall ??
      comparison({
        seeds: range.seeds,
        pairedSeats: expectedPairs,
        placementMean: -0.2,
        placementLower: -0.22,
        placementUpper: -0.2,
        topFourLower: -0.03,
        topFourUpper: 0.03,
        winLower: -0.04,
        winUpper: 0.04,
      }),
    byProfile,
  };
}

function zeroTrainingSummary(
  range: AiRobustMultiProfileSeedRange = seedRange(TRAINING_RANGE),
): AiRobustMultiProfileSuiteSummary {
  const zeroProfileComparison = comparison({ seeds: range.seeds });
  const zeroOverallComparison = comparison({
    seeds: range.seeds,
    pairedSeats: range.seeds * 112,
  });
  return suiteSummary({
    candidateId: "zero-incumbent",
    genome: AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT,
    range,
    overall: zeroOverallComparison,
    profileComparison: zeroProfileComparison,
    provenance: {
      candidateProfileSha256: sha256("c"),
      rawResultSha256: sha256("0"),
    },
  });
}

function validationPlan(): AiRobustMultiProfileValidationPlan {
  return createAiRobustMultiProfileValidationPlan({
    candidate: {
      candidateId: "candidate-v2",
      genome: CANDIDATE_GENOME,
    },
    trainingSeedRange: {
      startSeed: TRAINING_RANGE.startSeed,
      seeds: TRAINING_RANGE.seeds,
    },
    validationSeedRange: {
      startSeed: VALIDATION_RANGE.startSeed,
      seeds: VALIDATION_RANGE.seeds,
    },
  });
}

function validationComparison(): AiRobustMultiProfileComparisonSummary {
  return comparison({
    seeds: VALIDATION_RANGE.seeds,
    placementMean: 0,
    placementLower: -0.1,
    placementUpper: 0.1,
    topFourLower: -0.03,
    topFourUpper: 0.03,
    winLower: -0.04,
    winUpper: 0.04,
  });
}

function validationSummaries(): AiRobustMultiProfileSuiteSummary[] {
  const range = seedRange(VALIDATION_RANGE);
  const profileComparison = validationComparison();
  const overall = comparison({
    seeds: range.seeds,
    pairedSeats: range.seeds * 112,
    placementMean: -0.05,
    placementLower: -0.1,
    placementUpper: -0.000_001,
    topFourLower: -0.03,
    topFourUpper: 0.03,
    winLower: -0.04,
    winUpper: 0.04,
  });
  return [
    suiteSummary({ range, overall, profileComparison }),
    ...AI_ROBUST_MULTI_PROFILE_IDS.map((profileId, index) =>
      suiteSummary({
        range,
        intervention: singleIntervention(profileId),
        overall,
        profileComparison,
        provenance: {
          rawResultSha256: sha256(((index + 2) % 10).toString()),
        },
      }),
    ),
  ];
}

test("schema has four shared deltas and retains the exact zero incumbent", () => {
  assert.deepEqual(
    AI_ROBUST_MULTI_PROFILE_CEM_SCHEMA.map((definition) => ({
      name: definition.name,
      values: [...definition.values],
    })),
    [
      { name: "upgradeRoundOffsetDelta", values: [-1, 0, 1] },
      { name: "minimumUpgradeHealthDelta", values: [-2, 0, 2] },
      { name: "replacementMarginDelta", values: [-0.5, 0, 0.5] },
      { name: "maxRefreshesDelta", values: [-1, 0, 1] },
    ],
  );
  assert.doesNotThrow(() =>
    assertValidAiRobustMultiProfileGenome(
      AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT,
    ),
  );
  assert.equal(
    aiRobustMultiProfileNormalizedStepDistanceSquared(
      AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT,
    ),
    0,
  );

  const result = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: zeroTrainingSummary(),
    zeroIncumbent: zeroTrainingSummary(),
  });
  assert.equal(result.beatsZeroIncumbent, false);
  assert.equal(result.validationEligible, false);
  assert.match(result.reasons.join("; "), /strictly below zero-incumbent/);

  const forgedZero = zeroTrainingSummary();
  Object.assign(forgedZero.overall.placement, {
    meanDelta: 0.01,
    confidence95: { lower: 0, upper: 0.02 },
  });
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileTrainingObjective({
        candidate: suiteSummary(),
        zeroIncumbent: forgedZero,
      }),
    /must be exact zero-incumbent evidence/,
  );
});

test("shared genome changes only four fields on all seven profiles", () => {
  const genome = {
    upgradeRoundOffsetDelta: 1,
    minimumUpgradeHealthDelta: 2,
    replacementMarginDelta: 0.5,
    maxRefreshesDelta: 1,
  } as const satisfies AiRobustMultiProfileGenome;
  const candidates = applyAiRobustMultiProfileGenome(genome);
  assert.equal(candidates.length, 7);
  assert.deepEqual(
    candidates.map((profile) => profile.id),
    AI_ROBUST_MULTI_PROFILE_IDS,
  );
  const changedKeys = new Set<keyof AiStrategyProfile>([
    "upgradeRoundOffset",
    "minimumUpgradeHealth",
    "replacementMargin",
    "maxRefreshes",
  ]);
  for (let index = 0; index < candidates.length; index += 1) {
    const baseline = AI_STRATEGY_PROFILES[index];
    const candidate = candidates[index];
    assert.equal(candidate.upgradeRoundOffset, baseline.upgradeRoundOffset + 1);
    assert.equal(candidate.minimumUpgradeHealth, baseline.minimumUpgradeHealth + 2);
    assert.equal(candidate.replacementMargin, baseline.replacementMargin + 0.5);
    assert.equal(candidate.maxRefreshes, baseline.maxRefreshes + 1);
    for (const key of Object.keys(baseline) as (keyof AiStrategyProfile)[]) {
      if (!changedKeys.has(key)) assert.deepEqual(candidate[key], baseline[key]);
    }
    assert.equal(Object.isFrozen(candidate), true);
  }
  assert.equal(Object.isFrozen(candidates), true);
});

test("profile application rejects invalid deltas, NaN, missing profiles, and boundary overflow", () => {
  assert.throws(
    () =>
      assertValidAiRobustMultiProfileGenome({
        ...CANDIDATE_GENOME,
        replacementMarginDelta: 0.25,
      }),
    /must be one of/,
  );
  assert.throws(
    () =>
      assertValidAiRobustMultiProfileGenome({
        ...CANDIDATE_GENOME,
        maxRefreshesDelta: Number.NaN,
      }),
    /must be finite/,
  );
  assert.throws(
    () =>
      applyAiRobustMultiProfileGenome(
        CANDIDATE_GENOME,
        AI_STRATEGY_PROFILES.slice(0, 6),
      ),
    /exactly seven/,
  );

  const boundaryProfiles = AI_STRATEGY_PROFILES.map((profile) =>
    profile.id === "balanced"
      ? ({ ...profile, maxRefreshes: 8 } satisfies AiStrategyProfile)
      : profile,
  );
  assert.throws(
    () =>
      applyAiRobustMultiProfileGenome(
        {
          ...AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT,
          maxRefreshesDelta: 1,
        },
        boundaryProfiles,
      ),
    /maxRefreshes must be within/,
  );
});

test("training objective uses the exact risk formula and inclusive rate constraints", () => {
  const result = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: suiteSummary(),
    zeroIncumbent: zeroTrainingSummary(),
  });
  const expectedRisk = 0.5 * -0.2 + 0.5 * -0.1 + 0.01 * 1;
  assert.equal(result.risk, expectedRisk);
  assert.equal(result.zeroIncumbentRisk, 0);
  assert.equal(result.worstProfilePlacementUpper, -0.1);
  assert.equal(result.normalizedStepDistanceSquared, 1);
  assert.equal(result.constraintsPassed, true);
  assert.equal(result.beatsZeroIncumbent, true);
  assert.equal(result.belowZero, true);
  assert.equal(result.validationEligible, true);
  assert.deepEqual(result.reasons, []);
});

test("training eligibility is strict at equal and zero risk boundaries", () => {
  const range = seedRange(TRAINING_RANGE);
  const zeroRiskProfileComparison = comparison({
    seeds: range.seeds,
    placementMean: -0.01,
    placementLower: -0.02,
    placementUpper: -0.01,
    topFourLower: -0.03,
    topFourUpper: 0.03,
    winLower: -0.04,
    winUpper: 0.04,
  });
  const zeroRiskOverallComparison = {
    ...structuredClone(zeroRiskProfileComparison),
    placement: {
      ...structuredClone(zeroRiskProfileComparison.placement),
      pairedSeats: range.seeds * 112,
    },
    topFour: {
      ...structuredClone(zeroRiskProfileComparison.topFour),
      pairedSeats: range.seeds * 112,
    },
    win: {
      ...structuredClone(zeroRiskProfileComparison.win),
      pairedSeats: range.seeds * 112,
    },
  };
  const result = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: suiteSummary({
      overall: zeroRiskOverallComparison,
      profileComparison: zeroRiskProfileComparison,
    }),
    zeroIncumbent: zeroTrainingSummary(),
  });
  assert.equal(result.risk, 0);
  assert.equal(result.beatsZeroIncumbent, false);
  assert.equal(result.belowZero, false);
  assert.equal(result.validationEligible, false);
});

test("training objective fails closed on rate regression, NaN, and a missing profile", () => {
  const rateRegression = suiteSummary();
  Object.assign(rateRegression.byProfile.powerLevel.topFour.confidence95, {
    lower: -0.030_001,
  });
  Object.assign(rateRegression.byProfile.powerLevel.topFour, {
    meanDelta: -0.01,
  });
  const constrained = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: rateRegression,
    zeroIncumbent: zeroTrainingSummary(),
  });
  assert.equal(constrained.constraintsPassed, false);
  assert.equal(constrained.validationEligible, false);
  assert.match(constrained.reasons.join("; "), /powerLevel top-four/);

  const nanSummary = suiteSummary();
  Object.assign(nanSummary.overall.placement, { meanDelta: Number.NaN });
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileTrainingObjective({
        candidate: nanSummary,
        zeroIncumbent: zeroTrainingSummary(),
      }),
    /must be finite/,
  );

  const missingProfile = suiteSummary() as unknown as {
    byProfile: Record<string, unknown>;
  };
  delete missingProfile.byProfile.deathrattle;
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileTrainingObjective({
        candidate: missingProfile as unknown as AiRobustMultiProfileSuiteSummary,
        zeroIncumbent: zeroTrainingSummary(),
      }),
    /byProfile must contain exactly/,
  );
});

test("training objective enforces exact suite accounting and minimum seed power", () => {
  const wrongAccounting = suiteSummary();
  Object.assign(wrongAccounting.evidence, {
    scheduledRuns: wrongAccounting.evidence.scheduledRuns - 1,
    processedRuns: wrongAccounting.evidence.processedRuns - 1,
    completedRuns: wrongAccounting.evidence.completedRuns - 1,
    expectedPairs: wrongAccounting.evidence.expectedPairs - 1,
    pairedPairs: wrongAccounting.evidence.pairedPairs - 1,
  });
  Object.assign(wrongAccounting.overall.placement, {
    pairedSeats: wrongAccounting.overall.placement.pairedSeats - 1,
  });
  Object.assign(wrongAccounting.byProfile.tempo.win, {
    pairedSeats: wrongAccounting.byProfile.tempo.win.pairedSeats - 1,
  });
  const accountingResult = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: wrongAccounting,
    zeroIncumbent: zeroTrainingSummary(),
  });
  assert.equal(accountingResult.validationEligible, false);
  assert.match(accountingResult.reasons.join("; "), /scheduledRuns must equal 512/);
  assert.match(accountingResult.reasons.join("; "), /expectedPairs must equal 1792/);
  assert.match(accountingResult.reasons.join("; "), /overall placement pairedSeats/);
  assert.match(accountingResult.reasons.join("; "), /tempo win pairedSeats/);

  const tinyRange = { startSeed: 94_200_001, seeds: 1, endSeed: 94_200_001 };
  const tinyResult = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: suiteSummary({ range: tinyRange }),
    zeroIncumbent: zeroTrainingSummary(tinyRange),
  });
  assert.equal(tinyResult.validationEligible, false);
  assert.match(tinyResult.reasons.join("; "), /training requires at least 16 seeds/);
});

test("training candidate requires material override and decision divergence in every profile", () => {
  const noExposure = suiteSummary();
  Object.assign(noExposure.evidence.profileOverrideApplications, {
    balanced: 0,
  });
  Object.assign(noExposure.evidence.treatmentDecisionDivergencesByProfile, {
    balanced: 0,
  });
  const result = evaluateAiRobustMultiProfileTrainingObjective({
    candidate: noExposure,
    zeroIncumbent: zeroTrainingSummary(),
  });
  assert.equal(result.validationEligible, false);
  assert.match(
    result.reasons.join("; "),
    /balanced profile override applications must equal 256/,
  );
  assert.match(
    result.reasons.join("; "),
    /balanced requires at least one treatment decision divergence/,
  );

  const exposedZero = zeroTrainingSummary();
  Object.assign(exposedZero.evidence.profileOverrideApplications, {
    balanced: 1,
  });
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileTrainingObjective({
        candidate: suiteSummary(),
        zeroIncumbent: exposedZero,
      }),
    /zeroIncumbent balanced treatment exposure must equal 0/,
  );
});

test("validation plan has one frozen candidate, one joint, and seven isolated interventions", () => {
  const plan = validationPlan();
  assert.equal(
    plan.selectionPolicy,
    "single-frozen-candidate-no-validation-ranking",
  );
  assert.equal(plan.interventions.length, 8);
  assert.deepEqual(plan.interventions[0], jointIntervention());
  assert.deepEqual(
    plan.interventions.slice(1).map((intervention) => ({
      id: intervention.interventionId,
      changed: [...intervention.changedProfileIds],
    })),
    AI_ROBUST_MULTI_PROFILE_IDS.map((profileId) => ({
      id: `single:${profileId}`,
      changed: [profileId],
    })),
  );
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(Object.isFrozen(plan.candidate), true);
  assert.equal(Object.isFrozen(plan.candidate.genome), true);
});

test("validation plan rejects overlap, 93_100, 93_200, zero, and candidate collections", () => {
  const base = {
    candidate: { candidateId: "candidate-v2", genome: CANDIDATE_GENOME },
    trainingSeedRange: { startSeed: 94_000_001, seeds: 16 },
    validationSeedRange: { startSeed: 94_100_001, seeds: 24 },
  };
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        validationSeedRange: { startSeed: 94_000_010, seeds: 24 },
      }),
    /must be disjoint/,
  );
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        trainingSeedRange: { startSeed: 93_100_001, seeds: 16 },
      }),
    /completed-cooperative-cem-selection-93_100/,
  );
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        validationSeedRange: { startSeed: 93_200_001, seeds: 96 },
      }),
    /sealed-cooperative-cem-roster-final-93_200/,
  );
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        candidate: {
          candidateId: "zero",
          genome: AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT,
        },
      }),
    /must differ from zero incumbent/,
  );
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        candidates: [base.candidate],
      } as unknown as Parameters<
        typeof createAiRobustMultiProfileValidationPlan
      >[0]),
    /must contain exactly/,
  );

  const forgedPlan = structuredClone(validationPlan()) as unknown as {
    validationSeedRange: {
      startSeed: number;
      seeds: number;
      endSeed: number;
    };
  };
  forgedPlan.validationSeedRange.endSeed += 1;
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileValidationGate({
        plan: forgedPlan as unknown as AiRobustMultiProfileValidationPlan,
        summaries: validationSummaries(),
      }),
    /endSeed does not match/,
  );
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        trainingSeedRange: { startSeed: 94_000_001, seeds: 15 },
      }),
    /requires at least 16 seeds/,
  );
  assert.throws(
    () =>
      createAiRobustMultiProfileValidationPlan({
        ...base,
        validationSeedRange: { startSeed: 94_100_001, seeds: 23 },
      }),
    /requires at least 24 seeds/,
  );
});

test("validation gate accepts all inclusive non-inferiority equalities", () => {
  const result = evaluateAiRobustMultiProfileValidationGate({
    plan: validationPlan(),
    summaries: validationSummaries(),
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.reasons, []);
});

test("validation gate keeps the overall confidence upper bound strict", () => {
  const summaries = validationSummaries();
  Object.assign(summaries[0].overall.placement.confidence95, { upper: 0 });
  const result = evaluateAiRobustMultiProfileValidationGate({
    plan: validationPlan(),
    summaries,
  });
  assert.equal(result.accepted, false);
  assert.match(result.reasons.join("; "), /overall placement confidence upper/);
});

test("validation gate rejects profile harm and incomplete evidence", () => {
  const summaries = validationSummaries();
  Object.assign(
    summaries[0].byProfile.powerLevel.placement.confidence95,
    { upper: 0.100_001 },
  );
  Object.assign(summaries[1].evidence, {
    failedRuns: 1,
    completedRuns: summaries[1].evidence.completedRuns - 1,
  });
  const result = evaluateAiRobustMultiProfileValidationGate({
    plan: validationPlan(),
    summaries,
  });
  assert.equal(result.accepted, false);
  assert.match(result.reasons.join("; "), /joint powerLevel placement confidence/);
  assert.match(result.reasons.join("; "), /single:balanced has failed runs/);
});

test("validation gate rejects zero exposure and exposure attributed to the wrong profile", () => {
  const summaries = validationSummaries();
  Object.assign(
    summaries[1].evidence.treatmentDecisionDivergencesByProfile,
    { balanced: 0, magnetic: 1 },
  );
  Object.assign(summaries[1].evidence.profileOverrideApplications, {
    magnetic: 1,
  });
  const result = evaluateAiRobustMultiProfileValidationGate({
    plan: validationPlan(),
    summaries,
  });
  assert.equal(result.accepted, false);
  assert.match(
    result.reasons.join("; "),
    /single:balanced balanced requires at least one treatment decision divergence/,
  );
  assert.match(
    result.reasons.join("; "),
    /single:balanced magnetic profile override applications must equal 0/,
  );
  assert.match(
    result.reasons.join("; "),
    /single:balanced magnetic treatment decision divergences must equal 0/,
  );
});

test("validation gate rejects missing profiles and joint changes disguised as single-profile", () => {
  const missingProfile = validationSummaries();
  delete (missingProfile[0].byProfile as Record<string, unknown>).deathrattle;
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileValidationGate({
        plan: validationPlan(),
        summaries: missingProfile,
      }),
    /byProfile must contain exactly/,
  );

  const confused = validationSummaries();
  confused[1] = {
    ...confused[1],
    intervention: {
      ...confused[1].intervention,
      changedProfileIds: ["balanced", "magnetic"],
    } as unknown as AiRobustMultiProfileIntervention,
  };
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileValidationGate({
        plan: validationPlan(),
        summaries: confused,
      }),
    /not an isolated single-profile intervention/,
  );
});

test("validation summaries cannot introduce another candidate or baseline", () => {
  const otherCandidate = validationSummaries();
  otherCandidate[1] = { ...otherCandidate[1], candidateId: "candidate-v3" };
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileValidationGate({
        plan: validationPlan(),
        summaries: otherCandidate,
      }),
    /one frozen candidate/,
  );

  const otherBaseline = validationSummaries();
  otherBaseline[1] = {
    ...otherBaseline[1],
    provenance: {
      ...otherBaseline[1].provenance,
      baselineRunsSha256: sha256("9"),
    },
  };
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileValidationGate({
        plan: validationPlan(),
        summaries: otherBaseline,
      }),
    /baselineRunsSha256 does not match/,
  );

  const otherCandidateProfile = validationSummaries();
  otherCandidateProfile[1] = {
    ...otherCandidateProfile[1],
    provenance: {
      ...otherCandidateProfile[1].provenance,
      candidateProfileSha256: sha256("8"),
    },
  };
  assert.throws(
    () =>
      evaluateAiRobustMultiProfileValidationGate({
        plan: validationPlan(),
        summaries: otherCandidateProfile,
      }),
    /candidateProfileSha256 does not match/,
  );
});
