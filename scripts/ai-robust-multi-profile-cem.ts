import {
  AI_STRATEGY_PROFILES,
  type AiStrategyId,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";

/**
 * Pure protocol primitives for a risk-averse, shared-delta roster search.
 *
 * This module deliberately has no benchmark runner, filesystem access, seed
 * capability, or production mutation. It can only validate plans and score
 * summaries produced elsewhere. A future registered runner must separately
 * provide the one-shot claim/capability boundary; this pure module does not
 * pretend to make an observed seed range one-shot.
 */

export const AI_ROBUST_MULTI_PROFILE_IDS = Object.freeze([
  "balanced",
  "magnetic",
  "tempo",
  "triple",
  "powerLevel",
  "economy",
  "deathrattle",
] as const satisfies readonly AiStrategyId[]);

export type AiRobustMultiProfileId =
  (typeof AI_ROBUST_MULTI_PROFILE_IDS)[number];

export const AI_ROBUST_MULTI_PROFILE_CEM_SCHEMA = Object.freeze([
  Object.freeze({
    name: "upgradeRoundOffsetDelta",
    values: Object.freeze([-1, 0, 1] as const),
  }),
  Object.freeze({
    name: "minimumUpgradeHealthDelta",
    values: Object.freeze([-2, 0, 2] as const),
  }),
  Object.freeze({
    name: "replacementMarginDelta",
    values: Object.freeze([-0.5, 0, 0.5] as const),
  }),
  Object.freeze({
    name: "maxRefreshesDelta",
    values: Object.freeze([-1, 0, 1] as const),
  }),
] as const);

export interface AiRobustMultiProfileGenome {
  readonly upgradeRoundOffsetDelta: -1 | 0 | 1;
  readonly minimumUpgradeHealthDelta: -2 | 0 | 2;
  readonly replacementMarginDelta: -0.5 | 0 | 0.5;
  readonly maxRefreshesDelta: -1 | 0 | 1;
}

export const AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT = Object.freeze({
  upgradeRoundOffsetDelta: 0,
  minimumUpgradeHealthDelta: 0,
  replacementMarginDelta: 0,
  maxRefreshesDelta: 0,
} as const satisfies AiRobustMultiProfileGenome);

export const AI_ROBUST_MULTI_PROFILE_TRAINING_TOP_FOUR_LCB_MINIMUM =
  -0.03 as const;
export const AI_ROBUST_MULTI_PROFILE_TRAINING_WIN_LCB_MINIMUM = -0.04 as const;
export const AI_ROBUST_MULTI_PROFILE_PARAMETER_RISK_PENALTY = 0.01 as const;

export const AI_ROBUST_MULTI_PROFILE_VALIDATION_OVERALL_PLACEMENT_MEAN_MAXIMUM =
  -0.05 as const;
export const AI_ROBUST_MULTI_PROFILE_VALIDATION_PROFILE_PLACEMENT_MEAN_MAXIMUM =
  0 as const;
export const AI_ROBUST_MULTI_PROFILE_VALIDATION_PROFILE_PLACEMENT_UCB_MAXIMUM =
  0.1 as const;
export const AI_ROBUST_MULTI_PROFILE_VALIDATION_TOP_FOUR_LCB_MINIMUM =
  -0.03 as const;
export const AI_ROBUST_MULTI_PROFILE_VALIDATION_WIN_LCB_MINIMUM = -0.04 as const;

export const AI_ROBUST_MULTI_PROFILE_MINIMUM_TRAINING_SEEDS = 16 as const;
export const AI_ROBUST_MULTI_PROFILE_MINIMUM_VALIDATION_SEEDS = 24 as const;

export const AI_ROBUST_MULTI_PROFILE_SCENARIO_COUNT = 2 as const;
export const AI_ROBUST_MULTI_PROFILE_ROTATION_COUNT = 8 as const;
export const AI_ROBUST_MULTI_PROFILE_ARM_COUNT = 2 as const;

export const AI_ROBUST_MULTI_PROFILE_RECOMMENDED_TRAINING_SEEDS =
  Object.freeze({ startSeed: 93_300_001, seeds: 16, endSeed: 93_300_016 });
export const AI_ROBUST_MULTI_PROFILE_RECOMMENDED_VALIDATION_SEEDS =
  Object.freeze({ startSeed: 93_310_001, seeds: 24, endSeed: 93_310_024 });

export const AI_ROBUST_MULTI_PROFILE_FORBIDDEN_SEED_RANGES = Object.freeze([
  Object.freeze({
    id: "completed-cooperative-cem-selection-93_100",
    startSeed: 93_100_001,
    endSeed: 93_100_024,
  }),
  Object.freeze({
    id: "sealed-cooperative-cem-roster-final-93_200",
    startSeed: 93_200_001,
    endSeed: 93_200_096,
  }),
] as const);

const GENOME_KEYS = Object.freeze(
  AI_ROBUST_MULTI_PROFILE_CEM_SCHEMA.map((definition) => definition.name),
);
const PROFILE_ID_SET = new Set<string>(AI_ROBUST_MULTI_PROFILE_IDS);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const PROFILE_FIELD_BOUNDS = Object.freeze({
  upgradeRoundOffset: Object.freeze({ minimum: -2, maximum: 2 }),
  minimumUpgradeHealth: Object.freeze({ minimum: 1, maximum: 40 }),
  replacementMargin: Object.freeze({ minimum: 0, maximum: 10 }),
  maxRefreshes: Object.freeze({ minimum: 0, maximum: 8 }),
});

export interface AiRobustMultiProfileSeedRange {
  readonly startSeed: number;
  readonly seeds: number;
  readonly endSeed: number;
}

export interface AiRobustMultiProfileConfidence95 {
  readonly lower: number;
  readonly upper: number;
}

export interface AiRobustMultiProfileMetricSummary {
  readonly pairedSeats: number;
  readonly seedClusters: number;
  readonly meanDelta: number;
  readonly confidence95: AiRobustMultiProfileConfidence95;
}

export interface AiRobustMultiProfileComparisonSummary {
  readonly placement: AiRobustMultiProfileMetricSummary;
  readonly topFour: AiRobustMultiProfileMetricSummary;
  readonly win: AiRobustMultiProfileMetricSummary;
}

export interface AiRobustMultiProfileSuiteProvenance {
  readonly policyVersion: string;
  readonly contentVersion: string;
  readonly contentSnapshotSha256: string;
  readonly evaluatorSha256: string;
  readonly strategyProfileSha256: string;
  readonly baselineRunsSha256: string;
  /**
   * Identity of the full seven-profile snapshot produced by the shared
   * genome, not the effective one-profile intervention snapshot. A future
   * adapter must derive and bind it; all eight validation summaries must
   * carry the same value for the one frozen candidate.
   */
  readonly candidateProfileSha256: string;
  readonly rawResultSha256: string;
}

export interface AiRobustMultiProfileSuiteEvidence {
  readonly evidenceUsable: boolean;
  readonly evidenceReasons: readonly string[];
  readonly scheduledRuns: number;
  readonly processedRuns: number;
  readonly completedRuns: number;
  readonly failedRuns: number;
  readonly expectedPairs: number;
  readonly pairedPairs: number;
  readonly missingPairs: number;
  readonly truncatedRuns: number;
  readonly runnerFailureCount: number;
  readonly providerErrorTotal: number;
  readonly baselineDrawnGames: number;
  readonly candidateDrawnGames: number;
  /**
   * Candidate-arm profile-episodes whose effective value differs from the
   * baseline in at least one of the four registered fields. Installing an
   * identical profile snapshot is deliberately counted as zero.
   */
  readonly profileOverrideApplications: Readonly<
    Record<AiRobustMultiProfileId, number>
  >;
  /**
   * Actual instrumented decision boundaries where the materially overridden
   * profile chose differently from the baseline decision at the same visible
   * boundary. These are treatment exposures, not provider calls.
   */
  readonly treatmentDecisionDivergencesByProfile: Readonly<
    Record<AiRobustMultiProfileId, number>
  >;
  readonly policyVersionStable: boolean;
  readonly contentVersionStable: boolean;
  readonly contentSnapshotStable: boolean;
  readonly evaluatorStable: boolean;
  readonly strategyProfilesStable: boolean;
  readonly candidateProfilesStable: boolean;
}

export interface AiRobustMultiProfileJointIntervention {
  readonly interventionId: "joint";
  readonly kind: "joint";
  readonly focusProfileId: null;
  readonly changedProfileIds: readonly AiRobustMultiProfileId[];
}

export interface AiRobustMultiProfileSingleIntervention {
  readonly interventionId: `single:${AiRobustMultiProfileId}`;
  readonly kind: "single-profile";
  readonly focusProfileId: AiRobustMultiProfileId;
  readonly changedProfileIds: readonly [AiRobustMultiProfileId];
}

export type AiRobustMultiProfileIntervention =
  | AiRobustMultiProfileJointIntervention
  | AiRobustMultiProfileSingleIntervention;

export interface AiRobustMultiProfileSuiteSummary {
  readonly candidateId: string;
  readonly genome: AiRobustMultiProfileGenome;
  readonly seedRange: AiRobustMultiProfileSeedRange;
  readonly intervention: AiRobustMultiProfileIntervention;
  readonly provenance: AiRobustMultiProfileSuiteProvenance;
  readonly evidence: AiRobustMultiProfileSuiteEvidence;
  readonly overall: AiRobustMultiProfileComparisonSummary;
  readonly byProfile: Readonly<
    Record<AiRobustMultiProfileId, AiRobustMultiProfileComparisonSummary>
  >;
}

export interface AiRobustMultiProfileTrainingObjective {
  readonly risk: number;
  readonly zeroIncumbentRisk: number;
  readonly worstProfileId: AiRobustMultiProfileId;
  readonly worstProfilePlacementUpper: number;
  readonly normalizedStepDistanceSquared: number;
  readonly constraintsPassed: boolean;
  readonly beatsZeroIncumbent: boolean;
  readonly belowZero: boolean;
  readonly validationEligible: boolean;
  readonly reasons: readonly string[];
}

export interface AiRobustMultiProfileValidationPlanInput {
  readonly candidate: Readonly<{
    readonly candidateId: string;
    readonly genome: AiRobustMultiProfileGenome;
  }>;
  readonly trainingSeedRange: Readonly<{
    readonly startSeed: number;
    readonly seeds: number;
  }>;
  readonly validationSeedRange: Readonly<{
    readonly startSeed: number;
    readonly seeds: number;
  }>;
}

export interface AiRobustMultiProfileValidationPlan {
  readonly candidate: Readonly<{
    readonly candidateId: string;
    readonly genome: AiRobustMultiProfileGenome;
  }>;
  readonly trainingSeedRange: AiRobustMultiProfileSeedRange;
  readonly validationSeedRange: AiRobustMultiProfileSeedRange;
  readonly selectionPolicy: "single-frozen-candidate-no-validation-ranking";
  readonly interventions: readonly [
    AiRobustMultiProfileJointIntervention,
    ...AiRobustMultiProfileSingleIntervention[],
  ];
}

export interface AiRobustMultiProfileValidationGateResult {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new TypeError(`${path} must be a plain object`);
  }
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length ||
    actual.some((key, index) => key !== sortedExpected[index])
  ) {
    throw new TypeError(
      `${path} must contain exactly ${sortedExpected.join(", ")}`,
    );
  }
}

function assertFinite(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be finite`);
  }
}

function assertNonNegativeInteger(
  value: unknown,
  path: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer`);
  }
}

function assertPositiveInteger(
  value: unknown,
  path: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${path} must be a positive safe integer`);
  }
}

function sameNumbers(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]))
  );
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function assertValidAiRobustMultiProfileGenome(
  value: unknown,
  path = "genome",
): asserts value is AiRobustMultiProfileGenome {
  assertPlainObject(value, path);
  assertExactKeys(value, GENOME_KEYS, path);
  for (const definition of AI_ROBUST_MULTI_PROFILE_CEM_SCHEMA) {
    const candidate = value[definition.name];
    assertFinite(candidate, `${path}.${definition.name}`);
    if (!(definition.values as readonly number[]).includes(candidate)) {
      throw new RangeError(
        `${path}.${definition.name} must be one of ${definition.values.join(", ")}`,
      );
    }
  }
}

export function isAiRobustMultiProfileZeroGenome(
  genome: AiRobustMultiProfileGenome,
): boolean {
  assertValidAiRobustMultiProfileGenome(genome);
  return GENOME_KEYS.every(
    (key) => genome[key] === AI_ROBUST_MULTI_PROFILE_ZERO_INCUMBENT[key],
  );
}

function assertProfileResultBoundary(
  field: keyof typeof PROFILE_FIELD_BOUNDS,
  value: number,
  profileId: string,
): void {
  const bounds = PROFILE_FIELD_BOUNDS[field];
  if (
    !Number.isFinite(value) ||
    value < bounds.minimum ||
    value > bounds.maximum
  ) {
    throw new RangeError(
      `${profileId}.${field} must be within [${bounds.minimum}, ${bounds.maximum}]`,
    );
  }
  if (
    field !== "replacementMargin" &&
    !Number.isSafeInteger(value)
  ) {
    throw new TypeError(`${profileId}.${field} must be an integer`);
  }
}

function normalizedProfiles(
  profiles: readonly AiStrategyProfile[],
): readonly AiStrategyProfile[] {
  if (!Array.isArray(profiles) || profiles.length !== 7) {
    throw new TypeError("profiles must contain exactly seven profiles");
  }
  const byId = new Map<string, AiStrategyProfile>();
  for (const profile of profiles) {
    const candidate: unknown = profile;
    if (!isPlainObject(candidate)) {
      throw new TypeError("profiles contain an unsupported profile");
    }
    const profileId = candidate.id;
    if (typeof profileId !== "string" || !PROFILE_ID_SET.has(profileId)) {
      throw new TypeError("profiles contain an unsupported profile");
    }
    if (byId.has(profileId)) {
      throw new TypeError(`profiles contain duplicate ${profileId}`);
    }
    byId.set(profileId, profile);
  }
  return AI_ROBUST_MULTI_PROFILE_IDS.map((profileId) => {
    const profile = byId.get(profileId);
    if (!profile) throw new TypeError(`profiles are missing ${profileId}`);
    return profile;
  });
}

/** Applies one small shared delta to all seven baseline profiles. */
export function applyAiRobustMultiProfileGenome(
  genome: AiRobustMultiProfileGenome,
  profiles: readonly AiStrategyProfile[] = AI_STRATEGY_PROFILES,
): readonly Readonly<AiStrategyProfile>[] {
  assertValidAiRobustMultiProfileGenome(genome);
  return Object.freeze(
    normalizedProfiles(profiles).map((profile) => {
      const candidate = {
        ...profile,
        upgradeRoundOffset:
          profile.upgradeRoundOffset + genome.upgradeRoundOffsetDelta,
        minimumUpgradeHealth:
          profile.minimumUpgradeHealth + genome.minimumUpgradeHealthDelta,
        replacementMargin:
          profile.replacementMargin + genome.replacementMarginDelta,
        maxRefreshes: profile.maxRefreshes + genome.maxRefreshesDelta,
      } satisfies AiStrategyProfile;
      assertProfileResultBoundary(
        "upgradeRoundOffset",
        candidate.upgradeRoundOffset,
        profile.id,
      );
      assertProfileResultBoundary(
        "minimumUpgradeHealth",
        candidate.minimumUpgradeHealth,
        profile.id,
      );
      assertProfileResultBoundary(
        "replacementMargin",
        candidate.replacementMargin,
        profile.id,
      );
      assertProfileResultBoundary(
        "maxRefreshes",
        candidate.maxRefreshes,
        profile.id,
      );
      return Object.freeze(candidate);
    }),
  );
}

export function aiRobustMultiProfileNormalizedStepDistanceSquared(
  genome: AiRobustMultiProfileGenome,
): number {
  assertValidAiRobustMultiProfileGenome(genome);
  return (
    genome.upgradeRoundOffsetDelta ** 2 +
    (genome.minimumUpgradeHealthDelta / 2) ** 2 +
    (genome.replacementMarginDelta / 0.5) ** 2 +
    genome.maxRefreshesDelta ** 2
  );
}

function snapshotSeedRange(
  value: Readonly<{ readonly startSeed: number; readonly seeds: number }>,
  path: string,
): AiRobustMultiProfileSeedRange {
  assertPlainObject(value, path);
  assertExactKeys(value, ["startSeed", "seeds"], path);
  assertPositiveInteger(value.startSeed, `${path}.startSeed`);
  assertPositiveInteger(value.seeds, `${path}.seeds`);
  const endSeed = value.startSeed + value.seeds - 1;
  if (!Number.isSafeInteger(endSeed)) {
    throw new RangeError(`${path} endSeed must be a safe integer`);
  }
  return Object.freeze({
    startSeed: value.startSeed,
    seeds: value.seeds,
    endSeed,
  });
}

function assertSnapshotSeedRange(
  value: unknown,
  path: string,
): asserts value is AiRobustMultiProfileSeedRange {
  assertPlainObject(value, path);
  assertExactKeys(value, ["startSeed", "seeds", "endSeed"], path);
  assertPositiveInteger(value.startSeed, `${path}.startSeed`);
  assertPositiveInteger(value.seeds, `${path}.seeds`);
  assertPositiveInteger(value.endSeed, `${path}.endSeed`);
  if (value.endSeed !== value.startSeed + value.seeds - 1) {
    throw new RangeError(`${path}.endSeed does not match its interval`);
  }
}

function rangesOverlap(
  left: Readonly<{ startSeed: number; endSeed: number }>,
  right: Readonly<{ startSeed: number; endSeed: number }>,
): boolean {
  return left.startSeed <= right.endSeed && right.startSeed <= left.endSeed;
}

function assertUnprotectedSeedRange(
  range: AiRobustMultiProfileSeedRange,
  path: string,
): void {
  for (const forbidden of AI_ROBUST_MULTI_PROFILE_FORBIDDEN_SEED_RANGES) {
    if (rangesOverlap(range, forbidden)) {
      throw new RangeError(`${path} overlaps forbidden range ${forbidden.id}`);
    }
  }
}

function assertCandidateId(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !CANDIDATE_ID_PATTERN.test(value)) {
    throw new TypeError(`${path} is invalid`);
  }
}

function assertSha256(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new TypeError(`${path} must be a lowercase SHA-256`);
  }
}

function assertProvenance(
  value: unknown,
  path: string,
): asserts value is AiRobustMultiProfileSuiteProvenance {
  assertPlainObject(value, path);
  assertExactKeys(
    value,
    [
      "policyVersion",
      "contentVersion",
      "contentSnapshotSha256",
      "evaluatorSha256",
      "strategyProfileSha256",
      "baselineRunsSha256",
      "candidateProfileSha256",
      "rawResultSha256",
    ],
    path,
  );
  if (typeof value.policyVersion !== "string" || value.policyVersion.length === 0) {
    throw new TypeError(`${path}.policyVersion must be non-empty`);
  }
  if (typeof value.contentVersion !== "string" || value.contentVersion.length === 0) {
    throw new TypeError(`${path}.contentVersion must be non-empty`);
  }
  for (const key of [
    "contentSnapshotSha256",
    "evaluatorSha256",
    "strategyProfileSha256",
    "baselineRunsSha256",
    "candidateProfileSha256",
    "rawResultSha256",
  ] as const) {
    assertSha256(value[key], `${path}.${key}`);
  }
}

function assertExactProfileCountRecord(
  value: unknown,
  path: string,
): asserts value is Readonly<Record<AiRobustMultiProfileId, number>> {
  assertPlainObject(value, path);
  assertExactKeys(value, AI_ROBUST_MULTI_PROFILE_IDS, path);
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS) {
    assertNonNegativeInteger(value[profileId], `${path}.${profileId}`);
  }
}

function assertEvidence(
  value: unknown,
  path: string,
): asserts value is AiRobustMultiProfileSuiteEvidence {
  assertPlainObject(value, path);
  assertExactKeys(
    value,
    [
      "evidenceUsable",
      "evidenceReasons",
      "scheduledRuns",
      "processedRuns",
      "completedRuns",
      "failedRuns",
      "expectedPairs",
      "pairedPairs",
      "missingPairs",
      "truncatedRuns",
      "runnerFailureCount",
      "providerErrorTotal",
      "baselineDrawnGames",
      "candidateDrawnGames",
      "profileOverrideApplications",
      "treatmentDecisionDivergencesByProfile",
      "policyVersionStable",
      "contentVersionStable",
      "contentSnapshotStable",
      "evaluatorStable",
      "strategyProfilesStable",
      "candidateProfilesStable",
    ],
    path,
  );
  for (const key of [
    "evidenceUsable",
    "policyVersionStable",
    "contentVersionStable",
    "contentSnapshotStable",
    "evaluatorStable",
    "strategyProfilesStable",
    "candidateProfilesStable",
  ] as const) {
    if (typeof value[key] !== "boolean") {
      throw new TypeError(`${path}.${key} must be boolean`);
    }
  }
  if (
    !Array.isArray(value.evidenceReasons) ||
    !value.evidenceReasons.every((reason) => typeof reason === "string")
  ) {
    throw new TypeError(`${path}.evidenceReasons must contain strings`);
  }
  for (const key of [
    "scheduledRuns",
    "processedRuns",
    "completedRuns",
    "failedRuns",
    "expectedPairs",
    "pairedPairs",
    "missingPairs",
    "truncatedRuns",
    "runnerFailureCount",
    "providerErrorTotal",
    "baselineDrawnGames",
    "candidateDrawnGames",
  ] as const) {
    assertNonNegativeInteger(value[key], `${path}.${key}`);
  }
  assertExactProfileCountRecord(
    value.profileOverrideApplications,
    `${path}.profileOverrideApplications`,
  );
  assertExactProfileCountRecord(
    value.treatmentDecisionDivergencesByProfile,
    `${path}.treatmentDecisionDivergencesByProfile`,
  );
}

function assertConfidence95(
  value: unknown,
  meanDelta: number,
  minimum: number,
  maximum: number,
  path: string,
): asserts value is AiRobustMultiProfileConfidence95 {
  assertPlainObject(value, path);
  assertExactKeys(value, ["lower", "upper"], path);
  assertFinite(value.lower, `${path}.lower`);
  assertFinite(value.upper, `${path}.upper`);
  if (value.lower < minimum || value.upper > maximum) {
    throw new RangeError(`${path} lies outside [${minimum}, ${maximum}]`);
  }
  if (value.lower > meanDelta || meanDelta > value.upper) {
    throw new RangeError(`${path} must contain its mean`);
  }
}

function assertMetric(
  value: unknown,
  seedRange: AiRobustMultiProfileSeedRange,
  kind: "placement" | "rate",
  path: string,
): asserts value is AiRobustMultiProfileMetricSummary {
  assertPlainObject(value, path);
  assertExactKeys(
    value,
    ["pairedSeats", "seedClusters", "meanDelta", "confidence95"],
    path,
  );
  assertPositiveInteger(value.pairedSeats, `${path}.pairedSeats`);
  assertPositiveInteger(value.seedClusters, `${path}.seedClusters`);
  if (value.seedClusters !== seedRange.seeds) {
    throw new RangeError(`${path}.seedClusters must match the seed range`);
  }
  assertFinite(value.meanDelta, `${path}.meanDelta`);
  const minimum = kind === "placement" ? -7 : -1;
  const maximum = kind === "placement" ? 7 : 1;
  if (value.meanDelta < minimum || value.meanDelta > maximum) {
    throw new RangeError(`${path}.meanDelta lies outside [${minimum}, ${maximum}]`);
  }
  assertConfidence95(
    value.confidence95,
    value.meanDelta,
    minimum,
    maximum,
    `${path}.confidence95`,
  );
}

function assertComparison(
  value: unknown,
  seedRange: AiRobustMultiProfileSeedRange,
  path: string,
): asserts value is AiRobustMultiProfileComparisonSummary {
  assertPlainObject(value, path);
  assertExactKeys(value, ["placement", "topFour", "win"], path);
  assertMetric(value.placement, seedRange, "placement", `${path}.placement`);
  assertMetric(value.topFour, seedRange, "rate", `${path}.topFour`);
  assertMetric(value.win, seedRange, "rate", `${path}.win`);
}

function assertProfileIdArray(
  value: unknown,
  path: string,
): asserts value is readonly AiRobustMultiProfileId[] {
  if (
    !Array.isArray(value) ||
    !value.every((profileId) =>
      typeof profileId === "string" && PROFILE_ID_SET.has(profileId),
    )
  ) {
    throw new TypeError(`${path} contains an unsupported profile`);
  }
  if (new Set(value).size !== value.length) {
    throw new TypeError(`${path} contains duplicate profiles`);
  }
}

function assertIntervention(
  value: unknown,
  path: string,
): asserts value is AiRobustMultiProfileIntervention {
  assertPlainObject(value, path);
  assertExactKeys(
    value,
    ["interventionId", "kind", "focusProfileId", "changedProfileIds"],
    path,
  );
  assertProfileIdArray(value.changedProfileIds, `${path}.changedProfileIds`);
  if (value.kind === "joint") {
    if (
      value.interventionId !== "joint" ||
      value.focusProfileId !== null ||
      !sameStrings(value.changedProfileIds, AI_ROBUST_MULTI_PROFILE_IDS)
    ) {
      throw new TypeError(`${path} is not the exact joint intervention`);
    }
    return;
  }
  if (value.kind !== "single-profile") {
    throw new TypeError(`${path}.kind is invalid`);
  }
  if (
    typeof value.focusProfileId !== "string" ||
    !PROFILE_ID_SET.has(value.focusProfileId) ||
    value.interventionId !== `single:${value.focusProfileId}` ||
    value.changedProfileIds.length !== 1 ||
    value.changedProfileIds[0] !== value.focusProfileId
  ) {
    throw new TypeError(`${path} is not an isolated single-profile intervention`);
  }
}

function assertSuiteSummary(
  value: unknown,
  path: string,
): asserts value is AiRobustMultiProfileSuiteSummary {
  assertPlainObject(value, path);
  assertExactKeys(
    value,
    [
      "candidateId",
      "genome",
      "seedRange",
      "intervention",
      "provenance",
      "evidence",
      "overall",
      "byProfile",
    ],
    path,
  );
  assertCandidateId(value.candidateId, `${path}.candidateId`);
  assertValidAiRobustMultiProfileGenome(value.genome, `${path}.genome`);
  assertSnapshotSeedRange(value.seedRange, `${path}.seedRange`);
  assertIntervention(value.intervention, `${path}.intervention`);
  assertProvenance(value.provenance, `${path}.provenance`);
  assertEvidence(value.evidence, `${path}.evidence`);
  assertComparison(value.overall, value.seedRange, `${path}.overall`);
  assertPlainObject(value.byProfile, `${path}.byProfile`);
  assertExactKeys(value.byProfile, AI_ROBUST_MULTI_PROFILE_IDS, `${path}.byProfile`);
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS) {
    assertComparison(
      value.byProfile[profileId],
      value.seedRange,
      `${path}.byProfile.${profileId}`,
    );
  }
}

function evidenceCompletenessReasons(
  summary: AiRobustMultiProfileSuiteSummary,
  label: string,
): string[] {
  const { evidence } = summary;
  const reasons: string[] = [];
  const candidateArmRuns =
    summary.seedRange.seeds *
    AI_ROBUST_MULTI_PROFILE_SCENARIO_COUNT *
    AI_ROBUST_MULTI_PROFILE_ROTATION_COUNT;
  const scheduledRuns = candidateArmRuns * AI_ROBUST_MULTI_PROFILE_ARM_COUNT;
  const expectedPairs = candidateArmRuns * AI_ROBUST_MULTI_PROFILE_IDS.length;
  if (!evidence.evidenceUsable) reasons.push(`${label} evidence is not usable`);
  if (evidence.evidenceReasons.length !== 0) {
    reasons.push(`${label} evidenceReasons must be empty`);
  }
  if (evidence.scheduledRuns !== scheduledRuns) {
    reasons.push(`${label} scheduledRuns must equal ${scheduledRuns}`);
  }
  if (evidence.processedRuns !== scheduledRuns) {
    reasons.push(`${label} processedRuns must equal ${scheduledRuns}`);
  }
  if (evidence.completedRuns !== scheduledRuns) {
    reasons.push(`${label} completedRuns must equal ${scheduledRuns}`);
  }
  if (evidence.failedRuns !== 0) reasons.push(`${label} has failed runs`);
  if (evidence.expectedPairs !== expectedPairs) {
    reasons.push(`${label} expectedPairs must equal ${expectedPairs}`);
  }
  if (evidence.pairedPairs !== expectedPairs) {
    reasons.push(`${label} pairedPairs must equal ${expectedPairs}`);
  }
  if (evidence.missingPairs !== 0) reasons.push(`${label} has missing pairs`);
  if (evidence.truncatedRuns !== 0) reasons.push(`${label} has truncated runs`);
  if (evidence.runnerFailureCount !== 0) {
    reasons.push(`${label} has runner failures`);
  }
  if (evidence.providerErrorTotal !== 0) {
    reasons.push(`${label} has residual provider activity or errors`);
  }
  if (evidence.baselineDrawnGames !== 0 || evidence.candidateDrawnGames !== 0) {
    reasons.push(`${label} has drawn games`);
  }
  for (const kind of ["placement", "topFour", "win"] as const) {
    if (summary.overall[kind].pairedSeats !== expectedPairs) {
      reasons.push(
        `${label} overall ${kind} pairedSeats must equal ${expectedPairs}`,
      );
    }
  }
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS) {
    for (const kind of ["placement", "topFour", "win"] as const) {
      if (summary.byProfile[profileId][kind].pairedSeats !== candidateArmRuns) {
        reasons.push(
          `${label} ${profileId} ${kind} pairedSeats must equal ${candidateArmRuns}`,
        );
      }
    }
  }
  for (const [key, stable] of [
    ["policyVersion", evidence.policyVersionStable],
    ["contentVersion", evidence.contentVersionStable],
    ["contentSnapshot", evidence.contentSnapshotStable],
    ["evaluator", evidence.evaluatorStable],
    ["strategyProfiles", evidence.strategyProfilesStable],
    ["candidateProfiles", evidence.candidateProfilesStable],
  ] as const) {
    if (!stable) reasons.push(`${label} ${key} drifted`);
  }
  return reasons;
}

function appendTreatmentExposureReasons(
  summary: AiRobustMultiProfileSuiteSummary,
  label: string,
  reasons: string[],
): void {
  const candidateArmRuns =
    summary.seedRange.seeds *
    AI_ROBUST_MULTI_PROFILE_SCENARIO_COUNT *
    AI_ROBUST_MULTI_PROFILE_ROTATION_COUNT;
  const zeroGenome = isAiRobustMultiProfileZeroGenome(summary.genome);
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS) {
    const changed = summary.intervention.changedProfileIds.includes(profileId);
    const expectedApplications = !zeroGenome && changed ? candidateArmRuns : 0;
    const applications =
      summary.evidence.profileOverrideApplications[profileId];
    const divergences =
      summary.evidence.treatmentDecisionDivergencesByProfile[profileId];
    if (applications !== expectedApplications) {
      reasons.push(
        `${label} ${profileId} profile override applications must equal ${expectedApplications}`,
      );
    }
    if (!zeroGenome && changed) {
      if (divergences <= 0) {
        reasons.push(
          `${label} ${profileId} requires at least one treatment decision divergence`,
        );
      }
    } else if (divergences !== 0) {
      reasons.push(
        `${label} ${profileId} treatment decision divergences must equal 0`,
      );
    }
  }
}

function assertSameBaselineProvenance(
  left: AiRobustMultiProfileSuiteSummary,
  right: AiRobustMultiProfileSuiteSummary,
  label: string,
): void {
  for (const key of [
    "policyVersion",
    "contentVersion",
    "contentSnapshotSha256",
    "evaluatorSha256",
    "strategyProfileSha256",
    "baselineRunsSha256",
  ] as const) {
    if (left.provenance[key] !== right.provenance[key]) {
      throw new TypeError(`${label} ${key} does not match`);
    }
  }
}

function assertSameCandidateProfileBinding(
  left: AiRobustMultiProfileSuiteSummary,
  right: AiRobustMultiProfileSuiteSummary,
  label: string,
): void {
  if (
    left.provenance.candidateProfileSha256 !==
    right.provenance.candidateProfileSha256
  ) {
    throw new TypeError(`${label} candidateProfileSha256 does not match`);
  }
}

function assertSameSeedRange(
  left: AiRobustMultiProfileSeedRange,
  right: AiRobustMultiProfileSeedRange,
  label: string,
): void {
  if (
    left.startSeed !== right.startSeed ||
    left.seeds !== right.seeds ||
    left.endSeed !== right.endSeed
  ) {
    throw new TypeError(`${label} seed range does not match`);
  }
}

function assertSameGenome(
  left: AiRobustMultiProfileGenome,
  right: AiRobustMultiProfileGenome,
  label: string,
): void {
  if (!GENOME_KEYS.every((key) => left[key] === right[key])) {
    throw new TypeError(`${label} genome does not match`);
  }
}

function requireJointSummary(
  summary: AiRobustMultiProfileSuiteSummary,
  path: string,
): void {
  if (summary.intervention.kind !== "joint") {
    throw new TypeError(`${path} must be the exact joint intervention`);
  }
}

function riskComponents(summary: AiRobustMultiProfileSuiteSummary): {
  readonly risk: number;
  readonly worstProfileId: AiRobustMultiProfileId;
  readonly worstProfilePlacementUpper: number;
  readonly normalizedStepDistanceSquared: number;
} {
  let worstProfileId: AiRobustMultiProfileId =
    AI_ROBUST_MULTI_PROFILE_IDS[0];
  let worstProfilePlacementUpper =
    summary.byProfile[worstProfileId].placement.confidence95.upper;
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS.slice(1)) {
    const upper = summary.byProfile[profileId].placement.confidence95.upper;
    if (upper > worstProfilePlacementUpper) {
      worstProfileId = profileId;
      worstProfilePlacementUpper = upper;
    }
  }
  const normalizedStepDistanceSquared =
    aiRobustMultiProfileNormalizedStepDistanceSquared(summary.genome);
  return Object.freeze({
    risk:
      0.5 * summary.overall.placement.confidence95.upper +
      0.5 * worstProfilePlacementUpper +
      AI_ROBUST_MULTI_PROFILE_PARAMETER_RISK_PENALTY *
        normalizedStepDistanceSquared,
    worstProfileId,
    worstProfilePlacementUpper,
    normalizedStepDistanceSquared,
  });
}

function appendRateConstraintReasons(
  summary: AiRobustMultiProfileSuiteSummary,
  reasons: string[],
): void {
  const comparisons: readonly (readonly [
    string,
    AiRobustMultiProfileComparisonSummary,
  ])[] = [
    ["overall", summary.overall],
    ...AI_ROBUST_MULTI_PROFILE_IDS.map(
      (profileId) => [
        profileId,
        summary.byProfile[profileId],
      ] as const,
    ),
  ];
  for (const [label, comparison] of comparisons) {
    if (
      comparison.topFour.confidence95.lower <
      AI_ROBUST_MULTI_PROFILE_TRAINING_TOP_FOUR_LCB_MINIMUM
    ) {
      reasons.push(
        `${label} top-four confidence lower bound must be at least ${AI_ROBUST_MULTI_PROFILE_TRAINING_TOP_FOUR_LCB_MINIMUM}`,
      );
    }
    if (
      comparison.win.confidence95.lower <
      AI_ROBUST_MULTI_PROFILE_TRAINING_WIN_LCB_MINIMUM
    ) {
      reasons.push(
        `${label} win confidence lower bound must be at least ${AI_ROBUST_MULTI_PROFILE_TRAINING_WIN_LCB_MINIMUM}`,
      );
    }
  }
}

function assertExactZeroComparison(
  comparison: AiRobustMultiProfileComparisonSummary,
  path: string,
): void {
  for (const kind of ["placement", "topFour", "win"] as const) {
    const metric = comparison[kind];
    if (
      metric.meanDelta !== 0 ||
      metric.confidence95.lower !== 0 ||
      metric.confidence95.upper !== 0
    ) {
      throw new TypeError(`${path}.${kind} must be exact zero-incumbent evidence`);
    }
  }
}

function assertExactZeroIncumbentSummary(
  summary: AiRobustMultiProfileSuiteSummary,
): void {
  if (!isAiRobustMultiProfileZeroGenome(summary.genome)) {
    throw new TypeError("zeroIncumbent must carry the exact zero genome");
  }
  if (
    summary.provenance.candidateProfileSha256 !==
    summary.provenance.strategyProfileSha256
  ) {
    throw new TypeError(
      "zeroIncumbent candidate profile must equal the baseline profile",
    );
  }
  assertExactZeroComparison(summary.overall, "zeroIncumbent.overall");
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS) {
    assertExactZeroComparison(
      summary.byProfile[profileId],
      `zeroIncumbent.byProfile.${profileId}`,
    );
    if (
      summary.evidence.profileOverrideApplications[profileId] !== 0 ||
      summary.evidence.treatmentDecisionDivergencesByProfile[profileId] !== 0
    ) {
      throw new TypeError(
        `zeroIncumbent ${profileId} treatment exposure must equal 0`,
      );
    }
  }
}

/**
 * Evaluates one training-selected candidate against the retained zero genome.
 * Validation eligibility is strict: equality never replaces the incumbent.
 */
export function evaluateAiRobustMultiProfileTrainingObjective(input: {
  readonly candidate: AiRobustMultiProfileSuiteSummary;
  readonly zeroIncumbent: AiRobustMultiProfileSuiteSummary;
}): AiRobustMultiProfileTrainingObjective {
  assertPlainObject(input, "trainingObjectiveInput");
  assertExactKeys(input, ["candidate", "zeroIncumbent"], "trainingObjectiveInput");
  assertSuiteSummary(input.candidate, "candidate");
  assertSuiteSummary(input.zeroIncumbent, "zeroIncumbent");
  requireJointSummary(input.candidate, "candidate");
  requireJointSummary(input.zeroIncumbent, "zeroIncumbent");
  assertExactZeroIncumbentSummary(input.zeroIncumbent);
  assertSameSeedRange(
    input.candidate.seedRange,
    input.zeroIncumbent.seedRange,
    "candidate and zeroIncumbent",
  );
  assertSameBaselineProvenance(
    input.candidate,
    input.zeroIncumbent,
    "candidate and zeroIncumbent",
  );

  const candidateRisk = riskComponents(input.candidate);
  const zeroRisk = riskComponents(input.zeroIncumbent);
  const reasons = [
    ...evidenceCompletenessReasons(input.candidate, "candidate"),
    ...evidenceCompletenessReasons(input.zeroIncumbent, "zeroIncumbent"),
  ];
  if (
    input.candidate.seedRange.seeds <
    AI_ROBUST_MULTI_PROFILE_MINIMUM_TRAINING_SEEDS
  ) {
    reasons.push(
      `training requires at least ${AI_ROBUST_MULTI_PROFILE_MINIMUM_TRAINING_SEEDS} seeds`,
    );
  }
  appendTreatmentExposureReasons(input.candidate, "candidate", reasons);
  appendRateConstraintReasons(input.candidate, reasons);
  const constraintsPassed = reasons.length === 0;
  const beatsZeroIncumbent = candidateRisk.risk < zeroRisk.risk;
  const belowZero = candidateRisk.risk < 0;
  if (!beatsZeroIncumbent) {
    reasons.push("candidate risk must be strictly below zero-incumbent risk");
  }
  if (!belowZero) reasons.push("candidate risk must be strictly below 0");
  if (isAiRobustMultiProfileZeroGenome(input.candidate.genome)) {
    reasons.push("validation candidate must differ from the zero incumbent");
  }

  return Object.freeze({
    risk: candidateRisk.risk,
    zeroIncumbentRisk: zeroRisk.risk,
    worstProfileId: candidateRisk.worstProfileId,
    worstProfilePlacementUpper: candidateRisk.worstProfilePlacementUpper,
    normalizedStepDistanceSquared:
      candidateRisk.normalizedStepDistanceSquared,
    constraintsPassed,
    beatsZeroIncumbent,
    belowZero,
    validationEligible:
      constraintsPassed &&
      beatsZeroIncumbent &&
      belowZero &&
      !isAiRobustMultiProfileZeroGenome(input.candidate.genome),
    reasons: Object.freeze(reasons),
  });
}

function jointIntervention(): AiRobustMultiProfileJointIntervention {
  return Object.freeze({
    interventionId: "joint",
    kind: "joint",
    focusProfileId: null,
    changedProfileIds: AI_ROBUST_MULTI_PROFILE_IDS,
  });
}

function singleIntervention(
  profileId: AiRobustMultiProfileId,
): AiRobustMultiProfileSingleIntervention {
  return Object.freeze({
    interventionId: `single:${profileId}`,
    kind: "single-profile",
    focusProfileId: profileId,
    changedProfileIds: Object.freeze([profileId] as const),
  });
}

/** Creates one immutable validation plan for exactly one frozen candidate. */
export function createAiRobustMultiProfileValidationPlan(
  input: AiRobustMultiProfileValidationPlanInput,
): AiRobustMultiProfileValidationPlan {
  assertPlainObject(input, "validationPlanInput");
  assertExactKeys(
    input,
    ["candidate", "trainingSeedRange", "validationSeedRange"],
    "validationPlanInput",
  );
  assertPlainObject(input.candidate, "validationPlanInput.candidate");
  assertExactKeys(
    input.candidate,
    ["candidateId", "genome"],
    "validationPlanInput.candidate",
  );
  assertCandidateId(
    input.candidate.candidateId,
    "validationPlanInput.candidate.candidateId",
  );
  assertValidAiRobustMultiProfileGenome(
    input.candidate.genome,
    "validationPlanInput.candidate.genome",
  );
  if (isAiRobustMultiProfileZeroGenome(input.candidate.genome)) {
    throw new TypeError("validation candidate must differ from zero incumbent");
  }
  const trainingSeedRange = snapshotSeedRange(
    input.trainingSeedRange,
    "validationPlanInput.trainingSeedRange",
  );
  const validationSeedRange = snapshotSeedRange(
    input.validationSeedRange,
    "validationPlanInput.validationSeedRange",
  );
  if (trainingSeedRange.seeds < AI_ROBUST_MULTI_PROFILE_MINIMUM_TRAINING_SEEDS) {
    throw new RangeError(
      `trainingSeedRange requires at least ${AI_ROBUST_MULTI_PROFILE_MINIMUM_TRAINING_SEEDS} seeds`,
    );
  }
  if (
    validationSeedRange.seeds <
    AI_ROBUST_MULTI_PROFILE_MINIMUM_VALIDATION_SEEDS
  ) {
    throw new RangeError(
      `validationSeedRange requires at least ${AI_ROBUST_MULTI_PROFILE_MINIMUM_VALIDATION_SEEDS} seeds`,
    );
  }
  assertUnprotectedSeedRange(trainingSeedRange, "trainingSeedRange");
  assertUnprotectedSeedRange(validationSeedRange, "validationSeedRange");
  if (rangesOverlap(trainingSeedRange, validationSeedRange)) {
    throw new RangeError("training and validation seed ranges must be disjoint");
  }
  const interventions = Object.freeze([
    jointIntervention(),
    ...AI_ROBUST_MULTI_PROFILE_IDS.map(singleIntervention),
  ]) as AiRobustMultiProfileValidationPlan["interventions"];
  return Object.freeze({
    candidate: Object.freeze({
      candidateId: input.candidate.candidateId,
      genome: Object.freeze({ ...input.candidate.genome }),
    }),
    trainingSeedRange,
    validationSeedRange,
    selectionPolicy: "single-frozen-candidate-no-validation-ranking",
    interventions,
  });
}

function assertPlanMatchesProtocol(
  plan: AiRobustMultiProfileValidationPlan,
): void {
  assertPlainObject(plan, "validationPlan");
  assertExactKeys(
    plan,
    [
      "candidate",
      "trainingSeedRange",
      "validationSeedRange",
      "selectionPolicy",
      "interventions",
    ],
    "validationPlan",
  );
  assertSnapshotSeedRange(
    plan.trainingSeedRange,
    "validationPlan.trainingSeedRange",
  );
  assertSnapshotSeedRange(
    plan.validationSeedRange,
    "validationPlan.validationSeedRange",
  );
  const expected = createAiRobustMultiProfileValidationPlan({
    candidate: plan.candidate,
    trainingSeedRange: {
      startSeed: plan.trainingSeedRange.startSeed,
      seeds: plan.trainingSeedRange.seeds,
    },
    validationSeedRange: {
      startSeed: plan.validationSeedRange.startSeed,
      seeds: plan.validationSeedRange.seeds,
    },
  });
  if (plan.selectionPolicy !== expected.selectionPolicy) {
    throw new TypeError("validationPlan selectionPolicy is invalid");
  }
  if (!Array.isArray(plan.interventions) || plan.interventions.length !== 8) {
    throw new TypeError("validationPlan must contain exactly eight interventions");
  }
  for (let index = 0; index < expected.interventions.length; index += 1) {
    const actual = plan.interventions[index];
    const expectedIntervention = expected.interventions[index];
    assertIntervention(actual, `validationPlan.interventions[${index}]`);
    if (
      actual.interventionId !== expectedIntervention.interventionId ||
      actual.kind !== expectedIntervention.kind ||
      actual.focusProfileId !== expectedIntervention.focusProfileId ||
      !sameStrings(
        actual.changedProfileIds,
        expectedIntervention.changedProfileIds,
      )
    ) {
      throw new TypeError("validationPlan interventions do not match protocol");
    }
  }
}

function appendProfileValidationReasons(
  comparison: AiRobustMultiProfileComparisonSummary,
  label: string,
  reasons: string[],
): void {
  if (
    comparison.placement.meanDelta >
    AI_ROBUST_MULTI_PROFILE_VALIDATION_PROFILE_PLACEMENT_MEAN_MAXIMUM
  ) {
    reasons.push(
      `${label} placement mean must be at most ${AI_ROBUST_MULTI_PROFILE_VALIDATION_PROFILE_PLACEMENT_MEAN_MAXIMUM}`,
    );
  }
  if (
    comparison.placement.confidence95.upper >
    AI_ROBUST_MULTI_PROFILE_VALIDATION_PROFILE_PLACEMENT_UCB_MAXIMUM
  ) {
    reasons.push(
      `${label} placement confidence upper bound must be at most ${AI_ROBUST_MULTI_PROFILE_VALIDATION_PROFILE_PLACEMENT_UCB_MAXIMUM}`,
    );
  }
  if (
    comparison.topFour.confidence95.lower <
    AI_ROBUST_MULTI_PROFILE_VALIDATION_TOP_FOUR_LCB_MINIMUM
  ) {
    reasons.push(
      `${label} top-four confidence lower bound must be at least ${AI_ROBUST_MULTI_PROFILE_VALIDATION_TOP_FOUR_LCB_MINIMUM}`,
    );
  }
  if (
    comparison.win.confidence95.lower <
    AI_ROBUST_MULTI_PROFILE_VALIDATION_WIN_LCB_MINIMUM
  ) {
    reasons.push(
      `${label} win confidence lower bound must be at least ${AI_ROBUST_MULTI_PROFILE_VALIDATION_WIN_LCB_MINIMUM}`,
    );
  }
}

/**
 * Gates one joint roster run plus seven isolated profile interventions.
 * The API contains no candidate collection and therefore cannot rank on the
 * validation range.
 */
export function evaluateAiRobustMultiProfileValidationGate(input: {
  readonly plan: AiRobustMultiProfileValidationPlan;
  readonly summaries: readonly AiRobustMultiProfileSuiteSummary[];
}): AiRobustMultiProfileValidationGateResult {
  assertPlainObject(input, "validationGateInput");
  assertExactKeys(input, ["plan", "summaries"], "validationGateInput");
  assertPlanMatchesProtocol(input.plan);
  if (!Array.isArray(input.summaries) || input.summaries.length !== 8) {
    throw new TypeError(
      "validation summaries must contain exactly one joint and seven single-profile interventions",
    );
  }

  const byIntervention = new Map<string, AiRobustMultiProfileSuiteSummary>();
  for (const [index, summary] of input.summaries.entries()) {
    assertSuiteSummary(summary, `summaries[${index}]`);
    if (byIntervention.has(summary.intervention.interventionId)) {
      throw new TypeError(
        `validation summaries contain duplicate ${summary.intervention.interventionId}`,
      );
    }
    byIntervention.set(summary.intervention.interventionId, summary);
  }

  const ordered: AiRobustMultiProfileSuiteSummary[] = [];
  for (const expected of input.plan.interventions) {
    const summary = byIntervention.get(expected.interventionId);
    if (!summary) {
      throw new TypeError(
        `validation summaries are missing ${expected.interventionId}`,
      );
    }
    if (
      summary.intervention.kind !== expected.kind ||
      summary.intervention.focusProfileId !== expected.focusProfileId ||
      !sameStrings(
        summary.intervention.changedProfileIds,
        expected.changedProfileIds,
      )
    ) {
      throw new TypeError(
        `${expected.interventionId} does not isolate its registered profile set`,
      );
    }
    if (summary.candidateId !== input.plan.candidate.candidateId) {
      throw new TypeError(
        "validation summaries must evaluate the one frozen candidate",
      );
    }
    assertSameGenome(
      summary.genome,
      input.plan.candidate.genome,
      expected.interventionId,
    );
    assertSameSeedRange(
      summary.seedRange,
      input.plan.validationSeedRange,
      expected.interventionId,
    );
    ordered.push(summary);
  }

  const joint = ordered[0];
  const reasons = evidenceCompletenessReasons(joint, "joint");
  appendTreatmentExposureReasons(joint, "joint", reasons);
  for (let index = 1; index < ordered.length; index += 1) {
    const summary = ordered[index];
    assertSameBaselineProvenance(joint, summary, summary.intervention.interventionId);
    assertSameCandidateProfileBinding(
      joint,
      summary,
      summary.intervention.interventionId,
    );
    reasons.push(
      ...evidenceCompletenessReasons(
        summary,
        summary.intervention.interventionId,
      ),
    );
    appendTreatmentExposureReasons(
      summary,
      summary.intervention.interventionId,
      reasons,
    );
  }

  if (
    joint.overall.placement.meanDelta >
    AI_ROBUST_MULTI_PROFILE_VALIDATION_OVERALL_PLACEMENT_MEAN_MAXIMUM
  ) {
    reasons.push(
      `joint overall placement mean must be at most ${AI_ROBUST_MULTI_PROFILE_VALIDATION_OVERALL_PLACEMENT_MEAN_MAXIMUM}`,
    );
  }
  if (joint.overall.placement.confidence95.upper >= 0) {
    reasons.push("joint overall placement confidence upper bound must be below 0");
  }
  appendProfileValidationReasons(joint.overall, "joint overall", reasons);
  for (const profileId of AI_ROBUST_MULTI_PROFILE_IDS) {
    appendProfileValidationReasons(
      joint.byProfile[profileId],
      `joint ${profileId}`,
      reasons,
    );
  }
  for (let index = 1; index < ordered.length; index += 1) {
    const summary = ordered[index];
    if (summary.intervention.kind !== "single-profile") {
      throw new TypeError("non-joint validation summary must be single-profile");
    }
    appendProfileValidationReasons(
      summary.byProfile[summary.intervention.focusProfileId],
      summary.intervention.interventionId,
      reasons,
    );
  }

  return Object.freeze({
    accepted: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

/** Convenience guard for callers that need an explicit eligibility boundary. */
export function assertAiRobustMultiProfileValidationEligible(
  objective: AiRobustMultiProfileTrainingObjective,
): void {
  if (!objective.validationEligible) {
    throw new Error(
      `candidate is not validation eligible: ${objective.reasons.join("; ")}`,
    );
  }
}

/** Exposed for tests and protocol adapters; order is canonical. */
export function aiRobustMultiProfileInterventionPlan(): readonly AiRobustMultiProfileIntervention[] {
  return Object.freeze([
    jointIntervention(),
    ...AI_ROBUST_MULTI_PROFILE_IDS.map(singleIntervention),
  ]);
}

/** Exact schema membership helper without running an optimizer. */
export function aiRobustMultiProfileGenomeValues(
  genome: AiRobustMultiProfileGenome,
): readonly number[] {
  assertValidAiRobustMultiProfileGenome(genome);
  return Object.freeze(GENOME_KEYS.map((key) => genome[key]));
}

/** Exact equality helper used to bind summaries to the sole frozen candidate. */
export function sameAiRobustMultiProfileGenome(
  left: AiRobustMultiProfileGenome,
  right: AiRobustMultiProfileGenome,
): boolean {
  assertValidAiRobustMultiProfileGenome(left, "leftGenome");
  assertValidAiRobustMultiProfileGenome(right, "rightGenome");
  return sameNumbers(
    aiRobustMultiProfileGenomeValues(left),
    aiRobustMultiProfileGenomeValues(right),
  );
}
