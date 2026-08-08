import { createHash } from "node:crypto";

export const AI_POLICY_EVOLUTION_FORMAT_VERSION = 1 as const;
export const CATEGORICAL_CEM_ALGORITHM = "categorical-cem" as const;
export const CATEGORICAL_CEM_ELITE_COUNT = 2 as const;
export const CATEGORICAL_CEM_PROBABILITY_DECIMALS = 12;

const MAX_CATEGORICAL_SEARCH_SPACE = 100_000;
const DISTRIBUTION_TOLERANCE = 1e-9;
const GENE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const CANDIDATE_ID_PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface CategoricalGeneDefinition {
  name: string;
  values: readonly number[];
}

export const DEFAULT_POWER_LEVEL_GENE_SCHEMA = [
  { name: "upgradeRoundOffset", values: [-1, 0, 1] },
  { name: "minimumUpgradeHealth", values: [10, 12, 14, 16, 18] },
  { name: "replacementMargin", values: [2, 2.5, 3, 3.5, 4] },
  { name: "maxRefreshes", values: [1, 2, 3, 4, 5] },
] as const satisfies readonly CategoricalGeneDefinition[];

export type PolicyGenome = Readonly<Record<string, number>>;
export type CategoricalDistribution = Readonly<
  Record<string, readonly number[]>
>;

export interface EvolutionCandidate {
  candidateId: string;
  genome: PolicyGenome;
}

export interface EvolutionEvaluationContext {
  generation: number;
  retainedIncumbent: boolean;
}

export interface SampledGenome {
  candidateId: string;
  genome: PolicyGenome;
  score: number;
  retainedIncumbent: boolean;
}

export interface CategoricalCemGenerationTrace {
  generation: number;
  parentDistribution: CategoricalDistribution;
  sampledGenomes: readonly SampledGenome[];
  eliteCandidateIds: readonly [string, string];
  incumbentCandidateId: string;
  nextDistribution: CategoricalDistribution;
}

export interface AiPolicyEvolutionConfig {
  seed: number;
  generations: number;
  populationSize: number;
  eliteCount: typeof CATEGORICAL_CEM_ELITE_COUNT;
  smoothing: number;
  probabilityFloor: number;
  candidateIdPrefix: string;
}

export interface AiPolicyEvolutionArtifactPayload {
  formatVersion: typeof AI_POLICY_EVOLUTION_FORMAT_VERSION;
  algorithm: typeof CATEGORICAL_CEM_ALGORITHM;
  schema: readonly CategoricalGeneDefinition[];
  config: AiPolicyEvolutionConfig;
  initialIncumbent: PolicyGenome;
  initialDistribution: CategoricalDistribution;
  trajectory: readonly CategoricalCemGenerationTrace[];
  finalIncumbent: {
    candidateId: string;
    genome: PolicyGenome;
    score: number;
  };
}

export interface AiPolicyEvolutionArtifact
  extends AiPolicyEvolutionArtifactPayload {
  artifactHash: string;
}

export interface RunCategoricalCemOptions {
  seed: number;
  generations: number;
  populationSize: number;
  initialIncumbent: PolicyGenome;
  evaluate: (
    candidate: EvolutionCandidate,
    context: EvolutionEvaluationContext,
  ) => number;
  schema?: readonly CategoricalGeneDefinition[];
  initialDistribution?: CategoricalDistribution;
  smoothing?: number;
  probabilityFloor?: number;
  candidateIdPrefix?: string;
}

interface RandomSource {
  next(): number;
}

interface WeightedGenome {
  genome: PolicyGenome;
  weight: number;
}

function assertPlainObject(
  value: unknown,
  path: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must be a plain object`);
  }
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  expectedKeys: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new TypeError(
      `${path} must contain exactly these keys: ${expected.join(", ")}`,
    );
  }
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number`);
  }
}

function assertIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
  path: string,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(
      `${path} must be an integer in [${minimum}, ${maximum}]`,
    );
  }
}

export function validateCategoricalGeneSchema(
  schema: readonly CategoricalGeneDefinition[],
): void {
  if (!Array.isArray(schema) || schema.length === 0) {
    throw new TypeError("schema must be a non-empty array");
  }
  const names = new Set<string>();
  let combinations = 1;
  for (const [geneIndex, definition] of schema.entries()) {
    assertPlainObject(definition, `schema[${geneIndex}]`);
    assertExactKeys(
      definition,
      ["name", "values"],
      `schema[${geneIndex}]`,
    );
    if (
      typeof definition.name !== "string" ||
      !GENE_NAME_PATTERN.test(definition.name)
    ) {
      throw new TypeError(
        `schema[${geneIndex}].name must match ${GENE_NAME_PATTERN}`,
      );
    }
    if (names.has(definition.name)) {
      throw new TypeError(`schema contains duplicate gene ${definition.name}`);
    }
    names.add(definition.name);
    if (!Array.isArray(definition.values) || definition.values.length === 0) {
      throw new TypeError(
        `schema[${geneIndex}].values must be a non-empty array`,
      );
    }
    const values = new Set<number>();
    for (const [valueIndex, value] of definition.values.entries()) {
      assertFiniteNumber(value, `schema[${geneIndex}].values[${valueIndex}]`);
      if (Object.is(value, -0)) {
        throw new TypeError(
          `schema[${geneIndex}].values[${valueIndex}] must not be negative zero`,
        );
      }
      if (values.has(value)) {
        throw new TypeError(
          `schema[${geneIndex}].values contains duplicate value ${value}`,
        );
      }
      values.add(value);
    }
    combinations *= definition.values.length;
    if (
      !Number.isSafeInteger(combinations) ||
      combinations > MAX_CATEGORICAL_SEARCH_SPACE
    ) {
      throw new RangeError(
        `schema search space must not exceed ${MAX_CATEGORICAL_SEARCH_SPACE}`,
      );
    }
  }
}

export function categoricalSearchSpaceSize(
  schema: readonly CategoricalGeneDefinition[],
): number {
  validateCategoricalGeneSchema(schema);
  return schema.reduce(
    (product, definition) => product * definition.values.length,
    1,
  );
}

export function validatePolicyGenome(
  genome: unknown,
  schema: readonly CategoricalGeneDefinition[],
  path = "genome",
): asserts genome is PolicyGenome {
  validateCategoricalGeneSchema(schema);
  assertPlainObject(genome, path);
  assertExactKeys(
    genome,
    schema.map((definition) => definition.name),
    path,
  );
  for (const definition of schema) {
    const value = genome[definition.name];
    assertFiniteNumber(value, `${path}.${definition.name}`);
    if (!definition.values.includes(value)) {
      throw new RangeError(
        `${path}.${definition.name} must be one of ${definition.values.join(", ")}`,
      );
    }
  }
}

function cloneSchema(
  schema: readonly CategoricalGeneDefinition[],
): readonly CategoricalGeneDefinition[] {
  return schema.map((definition) => ({
    name: definition.name,
    values: [...definition.values],
  }));
}

function cloneGenome(genome: PolicyGenome): PolicyGenome {
  return { ...genome };
}

function cloneDistribution(
  distribution: CategoricalDistribution,
  schema: readonly CategoricalGeneDefinition[],
): CategoricalDistribution {
  return Object.fromEntries(
    schema.map((definition) => [
      definition.name,
      [...distribution[definition.name]],
    ]),
  );
}

function roundProbability(value: number): number {
  const scale = 10 ** CATEGORICAL_CEM_PROBABILITY_DECIMALS;
  return Math.round(value * scale) / scale;
}

function stabilizeProbabilities(probabilities: readonly number[]): number[] {
  const rounded = probabilities.map(roundProbability);
  const correction = 1 - rounded.reduce((sum, value) => sum + value, 0);
  let correctionIndex = 0;
  for (let index = 1; index < rounded.length; index += 1) {
    if (rounded[index] > rounded[correctionIndex]) {
      correctionIndex = index;
    }
  }
  rounded[correctionIndex] += correction;
  return rounded;
}

function applyProbabilityFloor(
  probabilities: readonly number[],
  probabilityFloor: number,
): number[] {
  if (probabilities.length === 1) {
    return [1];
  }
  const result = Array<number>(probabilities.length).fill(0);
  const free = new Set(probabilities.map((_, index) => index));
  let remainingMass = 1;

  while (free.size > 0) {
    const rawMass = [...free].reduce(
      (sum, index) => sum + probabilities[index],
      0,
    );
    const scale = rawMass > 0 ? remainingMass / rawMass : 0;
    const belowFloor = [...free].filter(
      (index) => rawMass === 0 || probabilities[index] * scale < probabilityFloor,
    );
    if (belowFloor.length === 0) {
      for (const index of free) {
        result[index] = probabilities[index] * scale;
      }
      break;
    }
    for (const index of belowFloor) {
      result[index] = probabilityFloor;
      remainingMass -= probabilityFloor;
      free.delete(index);
    }
  }

  return stabilizeProbabilities(result);
}

export function createUniformCategoricalDistribution(
  schema: readonly CategoricalGeneDefinition[],
): CategoricalDistribution {
  validateCategoricalGeneSchema(schema);
  return Object.fromEntries(
    schema.map((definition) => [
      definition.name,
      stabilizeProbabilities(
        definition.values.map(() => 1 / definition.values.length),
      ),
    ]),
  );
}

export function validateCategoricalDistribution(
  distribution: unknown,
  schema: readonly CategoricalGeneDefinition[],
  probabilityFloor = 0,
  path = "distribution",
): asserts distribution is CategoricalDistribution {
  validateCategoricalGeneSchema(schema);
  assertFiniteNumber(probabilityFloor, "probabilityFloor");
  if (probabilityFloor < 0 || probabilityFloor >= 1) {
    throw new RangeError("probabilityFloor must be in [0, 1)");
  }
  assertPlainObject(distribution, path);
  assertExactKeys(
    distribution,
    schema.map((definition) => definition.name),
    path,
  );
  for (const definition of schema) {
    if (
      definition.values.length > 1 &&
      probabilityFloor * definition.values.length >= 1
    ) {
      throw new RangeError(
        `probabilityFloor must be less than 1/${definition.values.length} for ${definition.name}`,
      );
    }
    const probabilities = distribution[definition.name];
    if (
      !Array.isArray(probabilities) ||
      probabilities.length !== definition.values.length
    ) {
      throw new TypeError(
        `${path}.${definition.name} must contain ${definition.values.length} probabilities`,
      );
    }
    let sum = 0;
    for (const [index, probability] of probabilities.entries()) {
      assertFiniteNumber(
        probability,
        `${path}.${definition.name}[${index}]`,
      );
      if (
        probability < probabilityFloor - DISTRIBUTION_TOLERANCE ||
        probability > 1
      ) {
        throw new RangeError(
          `${path}.${definition.name}[${index}] must be in [${probabilityFloor}, 1]`,
        );
      }
      sum += probability;
    }
    if (Math.abs(sum - 1) > DISTRIBUTION_TOLERANCE) {
      throw new RangeError(
        `${path}.${definition.name} probabilities must sum to 1 (received ${sum})`,
      );
    }
  }
}

function assertEvolutionParameters(
  options: RunCategoricalCemOptions,
  schema: readonly CategoricalGeneDefinition[],
): AiPolicyEvolutionConfig {
  assertIntegerInRange(options.seed, 0, 0xffff_ffff, "seed");
  assertIntegerInRange(options.generations, 1, 10_000, "generations");
  const searchSpaceSize = categoricalSearchSpaceSize(schema);
  assertIntegerInRange(
    options.populationSize,
    CATEGORICAL_CEM_ELITE_COUNT + 1,
    searchSpaceSize,
    "populationSize",
  );
  const smoothing = options.smoothing ?? 0.5;
  assertFiniteNumber(smoothing, "smoothing");
  if (smoothing <= 0 || smoothing > 1) {
    throw new RangeError("smoothing must be in (0, 1]");
  }
  const probabilityFloor = options.probabilityFloor ?? 0.02;
  assertFiniteNumber(probabilityFloor, "probabilityFloor");
  if (probabilityFloor < 0 || probabilityFloor >= 1) {
    throw new RangeError("probabilityFloor must be in [0, 1)");
  }
  for (const definition of schema) {
    if (
      definition.values.length > 1 &&
      probabilityFloor * definition.values.length >= 1
    ) {
      throw new RangeError(
        `probabilityFloor must be less than 1/${definition.values.length} for ${definition.name}`,
      );
    }
  }
  const candidateIdPrefix = options.candidateIdPrefix ?? "cem";
  if (!CANDIDATE_ID_PREFIX_PATTERN.test(candidateIdPrefix)) {
    throw new TypeError(
      `candidateIdPrefix must match ${CANDIDATE_ID_PREFIX_PATTERN}`,
    );
  }
  if (typeof options.evaluate !== "function") {
    throw new TypeError("evaluate must be a function");
  }
  return {
    seed: options.seed,
    generations: options.generations,
    populationSize: options.populationSize,
    eliteCount: CATEGORICAL_CEM_ELITE_COUNT,
    smoothing,
    probabilityFloor,
    candidateIdPrefix,
  };
}

function createMulberry32(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

function enumerateGenomes(
  schema: readonly CategoricalGeneDefinition[],
): PolicyGenome[] {
  const result: PolicyGenome[] = [];
  const current: Record<string, number> = {};

  function visit(geneIndex: number): void {
    if (geneIndex === schema.length) {
      result.push({ ...current });
      return;
    }
    const definition = schema[geneIndex];
    for (const value of definition.values) {
      current[definition.name] = value;
      visit(geneIndex + 1);
    }
  }

  visit(0);
  return result;
}

function genomeKey(
  genome: PolicyGenome,
  schema: readonly CategoricalGeneDefinition[],
): string {
  return schema
    .map((definition) => JSON.stringify(genome[definition.name]))
    .join("|");
}

function genomeWeight(
  genome: PolicyGenome,
  schema: readonly CategoricalGeneDefinition[],
  distribution: CategoricalDistribution,
): number {
  let weight = 1;
  for (const definition of schema) {
    const valueIndex = definition.values.indexOf(genome[definition.name]);
    weight *= distribution[definition.name][valueIndex];
  }
  return weight;
}

function sampleWithoutReplacement(
  schema: readonly CategoricalGeneDefinition[],
  distribution: CategoricalDistribution,
  incumbent: PolicyGenome,
  sampleCount: number,
  random: RandomSource,
): PolicyGenome[] {
  const incumbentKey = genomeKey(incumbent, schema);
  const remaining: WeightedGenome[] = enumerateGenomes(schema)
    .filter((genome) => genomeKey(genome, schema) !== incumbentKey)
    .map((genome) => ({
      genome,
      weight: genomeWeight(genome, schema, distribution),
    }));
  const sampled: PolicyGenome[] = [];

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const totalWeight = remaining.reduce(
      (sum, candidate) => sum + candidate.weight,
      0,
    );
    let selectedIndex: number;
    if (totalWeight <= 0) {
      selectedIndex = Math.floor(random.next() * remaining.length);
    } else {
      let threshold = random.next() * totalWeight;
      selectedIndex = remaining.length - 1;
      for (let index = 0; index < remaining.length; index += 1) {
        threshold -= remaining[index].weight;
        if (threshold < 0) {
          selectedIndex = index;
          break;
        }
      }
    }
    const [selected] = remaining.splice(selectedIndex, 1);
    sampled.push(selected.genome);
  }
  return sampled;
}

function compareEvaluatedCandidates(
  left: SampledGenome,
  right: SampledGenome,
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  if (left.retainedIncumbent !== right.retainedIncumbent) {
    return left.retainedIncumbent ? -1 : 1;
  }
  return left.candidateId < right.candidateId
    ? -1
    : left.candidateId > right.candidateId
      ? 1
      : 0;
}

export function updateCategoricalDistribution(
  schema: readonly CategoricalGeneDefinition[],
  parentDistribution: CategoricalDistribution,
  eliteGenomes: readonly PolicyGenome[],
  smoothing: number,
  probabilityFloor: number,
): CategoricalDistribution {
  validateCategoricalGeneSchema(schema);
  validateCategoricalDistribution(
    parentDistribution,
    schema,
    0,
    "parentDistribution",
  );
  if (eliteGenomes.length !== CATEGORICAL_CEM_ELITE_COUNT) {
    throw new RangeError(
      `eliteGenomes must contain exactly ${CATEGORICAL_CEM_ELITE_COUNT} genomes`,
    );
  }
  eliteGenomes.forEach((genome, index) =>
    validatePolicyGenome(genome, schema, `eliteGenomes[${index}]`),
  );
  assertFiniteNumber(smoothing, "smoothing");
  if (smoothing <= 0 || smoothing > 1) {
    throw new RangeError("smoothing must be in (0, 1]");
  }
  assertFiniteNumber(probabilityFloor, "probabilityFloor");
  if (probabilityFloor < 0 || probabilityFloor >= 1) {
    throw new RangeError("probabilityFloor must be in [0, 1)");
  }

  const next: Record<string, readonly number[]> = {};
  for (const definition of schema) {
    if (
      definition.values.length > 1 &&
      probabilityFloor * definition.values.length >= 1
    ) {
      throw new RangeError(
        `probabilityFloor must be less than 1/${definition.values.length} for ${definition.name}`,
      );
    }
    const frequencies = definition.values.map(
      (value) =>
        eliteGenomes.filter((genome) => genome[definition.name] === value)
          .length / eliteGenomes.length,
    );
    const smoothed = parentDistribution[definition.name].map(
      (probability, index) =>
        (1 - smoothing) * probability + smoothing * frequencies[index],
    );
    next[definition.name] = applyProbabilityFloor(
      smoothed,
      probabilityFloor,
    );
  }
  validateCategoricalDistribution(next, schema, probabilityFloor, "nextDistribution");
  return next;
}

function candidateId(
  prefix: string,
  generation: number,
  candidateIndex: number,
  genome: PolicyGenome,
): string {
  const genomeHash = createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(genome))
    .digest("hex")
    .slice(0, 12);
  return `${prefix}-g${generation.toString().padStart(4, "0")}-c${candidateIndex
    .toString()
    .padStart(4, "0")}-${genomeHash}`;
}

function canonicalJsonValue(
  value: unknown,
  path: string,
  ancestors: WeakSet<object>,
): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must contain only finite numbers`);
    }
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`${path} must contain JSON-only data`);
  }
  if (ancestors.has(value)) {
    throw new TypeError(`${path} must not contain cycles`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value
        .map((item, index) =>
          canonicalJsonValue(item, `${path}[${index}]`, ancestors),
        )
        .join(",")}]`;
    }
    assertPlainObject(value, path);
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJsonValue(
            value[key],
            `${path}.${key}`,
            ancestors,
          )}`,
      )
      .join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalAiPolicyEvolutionJson(value: unknown): string {
  return canonicalJsonValue(value, "artifact", new WeakSet<object>());
}

export function computeAiPolicyEvolutionArtifactHash(
  artifact: AiPolicyEvolutionArtifactPayload | AiPolicyEvolutionArtifact,
): string {
  assertPlainObject(artifact, "artifact");
  const payload: Record<string, unknown> = { ...artifact };
  delete payload.artifactHash;
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(payload))
    .digest("hex");
}

function assertCandidateId(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !CANDIDATE_ID_PATTERN.test(value)) {
    throw new TypeError(`${path} must match ${CANDIDATE_ID_PATTERN}`);
  }
}

function assertEvolutionConfig(
  value: unknown,
  schema: readonly CategoricalGeneDefinition[],
): asserts value is AiPolicyEvolutionConfig {
  assertPlainObject(value, "artifact.config");
  assertExactKeys(
    value,
    [
      "seed",
      "generations",
      "populationSize",
      "eliteCount",
      "smoothing",
      "probabilityFloor",
      "candidateIdPrefix",
    ],
    "artifact.config",
  );
  assertIntegerInRange(value.seed, 0, 0xffff_ffff, "artifact.config.seed");
  assertIntegerInRange(
    value.generations,
    1,
    10_000,
    "artifact.config.generations",
  );
  assertIntegerInRange(
    value.populationSize,
    CATEGORICAL_CEM_ELITE_COUNT + 1,
    categoricalSearchSpaceSize(schema),
    "artifact.config.populationSize",
  );
  if (value.eliteCount !== CATEGORICAL_CEM_ELITE_COUNT) {
    throw new RangeError(
      `artifact.config.eliteCount must equal ${CATEGORICAL_CEM_ELITE_COUNT}`,
    );
  }
  assertFiniteNumber(value.smoothing, "artifact.config.smoothing");
  if (value.smoothing <= 0 || value.smoothing > 1) {
    throw new RangeError("artifact.config.smoothing must be in (0, 1]");
  }
  assertFiniteNumber(
    value.probabilityFloor,
    "artifact.config.probabilityFloor",
  );
  if (value.probabilityFloor < 0 || value.probabilityFloor >= 1) {
    throw new RangeError(
      "artifact.config.probabilityFloor must be in [0, 1)",
    );
  }
  if (
    typeof value.candidateIdPrefix !== "string" ||
    !CANDIDATE_ID_PREFIX_PATTERN.test(value.candidateIdPrefix)
  ) {
    throw new TypeError(
      `artifact.config.candidateIdPrefix must match ${CANDIDATE_ID_PREFIX_PATTERN}`,
    );
  }
}

function distributionsEqual(
  left: CategoricalDistribution,
  right: CategoricalDistribution,
): boolean {
  return canonicalAiPolicyEvolutionJson(left) === canonicalAiPolicyEvolutionJson(right);
}

export function assertValidAiPolicyEvolutionArtifact(
  value: unknown,
): asserts value is AiPolicyEvolutionArtifact {
  assertPlainObject(value, "artifact");
  assertExactKeys(
    value,
    [
      "formatVersion",
      "algorithm",
      "schema",
      "config",
      "initialIncumbent",
      "initialDistribution",
      "trajectory",
      "finalIncumbent",
      "artifactHash",
    ],
    "artifact",
  );
  if (value.formatVersion !== AI_POLICY_EVOLUTION_FORMAT_VERSION) {
    throw new RangeError(
      `artifact.formatVersion must equal ${AI_POLICY_EVOLUTION_FORMAT_VERSION}`,
    );
  }
  if (value.algorithm !== CATEGORICAL_CEM_ALGORITHM) {
    throw new TypeError(
      `artifact.algorithm must equal ${CATEGORICAL_CEM_ALGORITHM}`,
    );
  }
  if (!Array.isArray(value.schema)) {
    throw new TypeError("artifact.schema must be an array");
  }
  validateCategoricalGeneSchema(value.schema);
  assertEvolutionConfig(value.config, value.schema);
  validatePolicyGenome(
    value.initialIncumbent,
    value.schema,
    "artifact.initialIncumbent",
  );
  validateCategoricalDistribution(
    value.initialDistribution,
    value.schema,
    0,
    "artifact.initialDistribution",
  );
  if (
    !Array.isArray(value.trajectory) ||
    value.trajectory.length !== value.config.generations
  ) {
    throw new RangeError(
      "artifact.trajectory length must equal artifact.config.generations",
    );
  }

  const allCandidateIds = new Set<string>();
  let expectedIncumbent = value.initialIncumbent;
  let previousDistribution: CategoricalDistribution = value.initialDistribution;
  let finalWinner: SampledGenome | null = null;
  const replayRandom = createMulberry32(value.config.seed);

  for (const [generation, traceValue] of value.trajectory.entries()) {
    assertPlainObject(traceValue, `artifact.trajectory[${generation}]`);
    assertExactKeys(
      traceValue,
      [
        "generation",
        "parentDistribution",
        "sampledGenomes",
        "eliteCandidateIds",
        "incumbentCandidateId",
        "nextDistribution",
      ],
      `artifact.trajectory[${generation}]`,
    );
    if (traceValue.generation !== generation) {
      throw new RangeError(
        `artifact.trajectory[${generation}].generation must equal ${generation}`,
      );
    }
    validateCategoricalDistribution(
      traceValue.parentDistribution,
      value.schema,
      0,
      `artifact.trajectory[${generation}].parentDistribution`,
    );
    if (!distributionsEqual(traceValue.parentDistribution, previousDistribution)) {
      throw new TypeError(
        `artifact.trajectory[${generation}].parentDistribution must equal the previous nextDistribution`,
      );
    }
    if (
      !Array.isArray(traceValue.sampledGenomes) ||
      traceValue.sampledGenomes.length !== value.config.populationSize
    ) {
      throw new RangeError(
        `artifact.trajectory[${generation}].sampledGenomes length must equal populationSize`,
      );
    }
    const generationGenomeKeys = new Set<string>();
    const evaluated: SampledGenome[] = [];
    let retainedCount = 0;
    const expectedGenerationGenomes = [
      cloneGenome(expectedIncumbent),
      ...sampleWithoutReplacement(
        value.schema,
        traceValue.parentDistribution,
        expectedIncumbent,
        value.config.populationSize - 1,
        replayRandom,
      ),
    ];
    for (const [candidateIndex, sampledValue] of traceValue.sampledGenomes.entries()) {
      const path = `artifact.trajectory[${generation}].sampledGenomes[${candidateIndex}]`;
      assertPlainObject(sampledValue, path);
      assertExactKeys(
        sampledValue,
        ["candidateId", "genome", "score", "retainedIncumbent"],
        path,
      );
      assertCandidateId(sampledValue.candidateId, `${path}.candidateId`);
      if (allCandidateIds.has(sampledValue.candidateId)) {
        throw new TypeError(
          `${path}.candidateId duplicates another candidate id`,
        );
      }
      allCandidateIds.add(sampledValue.candidateId);
      validatePolicyGenome(sampledValue.genome, value.schema, `${path}.genome`);
      const expectedGenome = expectedGenerationGenomes[candidateIndex];
      if (
        genomeKey(sampledValue.genome, value.schema) !==
        genomeKey(expectedGenome, value.schema)
      ) {
        throw new TypeError(
          `${path}.genome does not match deterministic seed replay`,
        );
      }
      const expectedCandidateId = candidateId(
        value.config.candidateIdPrefix,
        generation,
        candidateIndex,
        expectedGenome,
      );
      if (sampledValue.candidateId !== expectedCandidateId) {
        throw new TypeError(
          `${path}.candidateId does not match its deterministic candidate`,
        );
      }
      const key = genomeKey(sampledValue.genome, value.schema);
      if (generationGenomeKeys.has(key)) {
        throw new TypeError(`${path}.genome duplicates another generation genome`);
      }
      generationGenomeKeys.add(key);
      assertFiniteNumber(sampledValue.score, `${path}.score`);
      if (typeof sampledValue.retainedIncumbent !== "boolean") {
        throw new TypeError(`${path}.retainedIncumbent must be boolean`);
      }
      if (sampledValue.retainedIncumbent !== (candidateIndex === 0)) {
        throw new TypeError(
          `${path}.retainedIncumbent must be true only at candidate index 0`,
        );
      }
      if (sampledValue.retainedIncumbent) {
        retainedCount += 1;
        if (
          genomeKey(sampledValue.genome, value.schema) !==
          genomeKey(expectedIncumbent, value.schema)
        ) {
          throw new TypeError(`${path}.genome must retain the incumbent genome`);
        }
      }
      evaluated.push(sampledValue as unknown as SampledGenome);
    }
    if (retainedCount !== 1) {
      throw new RangeError(
        `artifact.trajectory[${generation}] must retain exactly one incumbent`,
      );
    }
    if (
      !Array.isArray(traceValue.eliteCandidateIds) ||
      traceValue.eliteCandidateIds.length !== CATEGORICAL_CEM_ELITE_COUNT
    ) {
      throw new RangeError(
        `artifact.trajectory[${generation}].eliteCandidateIds must contain two ids`,
      );
    }
    const ranked = [...evaluated].sort(compareEvaluatedCandidates);
    const expectedEliteIds = ranked
      .slice(0, CATEGORICAL_CEM_ELITE_COUNT)
      .map((candidate) => candidate.candidateId);
    if (
      traceValue.eliteCandidateIds.some(
        (candidateId, index) => candidateId !== expectedEliteIds[index],
      )
    ) {
      throw new TypeError(
        `artifact.trajectory[${generation}].eliteCandidateIds must identify the two highest-scoring candidates`,
      );
    }
    if (traceValue.incumbentCandidateId !== expectedEliteIds[0]) {
      throw new TypeError(
        `artifact.trajectory[${generation}].incumbentCandidateId must identify the highest-scoring candidate`,
      );
    }
    validateCategoricalDistribution(
      traceValue.nextDistribution,
      value.schema,
      value.config.probabilityFloor,
      `artifact.trajectory[${generation}].nextDistribution`,
    );
    const expectedNext = updateCategoricalDistribution(
      value.schema,
      traceValue.parentDistribution,
      ranked
        .slice(0, CATEGORICAL_CEM_ELITE_COUNT)
        .map((candidate) => candidate.genome),
      value.config.smoothing,
      value.config.probabilityFloor,
    );
    if (!distributionsEqual(traceValue.nextDistribution, expectedNext)) {
      throw new TypeError(
        `artifact.trajectory[${generation}].nextDistribution does not match its elites`,
      );
    }
    finalWinner = ranked[0];
    expectedIncumbent = ranked[0].genome;
    previousDistribution = traceValue.nextDistribution;
  }

  assertPlainObject(value.finalIncumbent, "artifact.finalIncumbent");
  assertExactKeys(
    value.finalIncumbent,
    ["candidateId", "genome", "score"],
    "artifact.finalIncumbent",
  );
  assertCandidateId(
    value.finalIncumbent.candidateId,
    "artifact.finalIncumbent.candidateId",
  );
  validatePolicyGenome(
    value.finalIncumbent.genome,
    value.schema,
    "artifact.finalIncumbent.genome",
  );
  assertFiniteNumber(value.finalIncumbent.score, "artifact.finalIncumbent.score");
  if (
    finalWinner === null ||
    value.finalIncumbent.candidateId !== finalWinner.candidateId ||
    value.finalIncumbent.score !== finalWinner.score ||
    genomeKey(value.finalIncumbent.genome, value.schema) !==
      genomeKey(finalWinner.genome, value.schema)
  ) {
    throw new TypeError(
      "artifact.finalIncumbent must match the final generation incumbent",
    );
  }
  if (
    typeof value.artifactHash !== "string" ||
    !SHA256_PATTERN.test(value.artifactHash)
  ) {
    throw new TypeError("artifact.artifactHash must be a lower-case SHA-256 hash");
  }
  if (
    computeAiPolicyEvolutionArtifactHash(
      value as unknown as AiPolicyEvolutionArtifact,
    ) !== value.artifactHash
  ) {
    throw new TypeError("artifact.artifactHash does not match canonical payload");
  }
}

export function runCategoricalCem(
  options: RunCategoricalCemOptions,
): AiPolicyEvolutionArtifact {
  const schema = cloneSchema(options.schema ?? DEFAULT_POWER_LEVEL_GENE_SCHEMA);
  validateCategoricalGeneSchema(schema);
  const config = assertEvolutionParameters(options, schema);
  validatePolicyGenome(options.initialIncumbent, schema, "initialIncumbent");

  let distribution = options.initialDistribution
    ? cloneDistribution(options.initialDistribution, schema)
    : createUniformCategoricalDistribution(schema);
  validateCategoricalDistribution(
    distribution,
    schema,
    0,
    "initialDistribution",
  );
  let incumbent = cloneGenome(options.initialIncumbent);
  const random = createMulberry32(config.seed);
  const trajectory: CategoricalCemGenerationTrace[] = [];
  const generatedCandidateIds = new Set<string>();
  let finalWinner: SampledGenome | null = null;

  for (let generation = 0; generation < config.generations; generation += 1) {
    const genomes = [
      cloneGenome(incumbent),
      ...sampleWithoutReplacement(
        schema,
        distribution,
        incumbent,
        config.populationSize - 1,
        random,
      ),
    ];
    const sampledGenomes = genomes.map((genome, candidateIndex) => {
      const id = candidateId(
        config.candidateIdPrefix,
        generation,
        candidateIndex,
        genome,
      );
      if (generatedCandidateIds.has(id)) {
        throw new TypeError(`generated duplicate candidate id ${id}`);
      }
      generatedCandidateIds.add(id);
      const retainedIncumbent = candidateIndex === 0;
      const score = options.evaluate(
        { candidateId: id, genome: cloneGenome(genome) },
        { generation, retainedIncumbent },
      );
      assertFiniteNumber(score, `evaluation score for ${id}`);
      return {
        candidateId: id,
        genome: cloneGenome(genome),
        score,
        retainedIncumbent,
      } satisfies SampledGenome;
    });
    const ranked = [...sampledGenomes].sort(compareEvaluatedCandidates);
    const elites = ranked.slice(0, CATEGORICAL_CEM_ELITE_COUNT);
    const nextDistribution = updateCategoricalDistribution(
      schema,
      distribution,
      elites.map((candidate) => candidate.genome),
      config.smoothing,
      config.probabilityFloor,
    );
    trajectory.push({
      generation,
      parentDistribution: cloneDistribution(distribution, schema),
      sampledGenomes,
      eliteCandidateIds: [elites[0].candidateId, elites[1].candidateId],
      incumbentCandidateId: elites[0].candidateId,
      nextDistribution: cloneDistribution(nextDistribution, schema),
    });
    incumbent = cloneGenome(elites[0].genome);
    finalWinner = elites[0];
    distribution = nextDistribution;
  }

  if (finalWinner === null) {
    throw new TypeError("categorical CEM produced no generation");
  }
  const payload: AiPolicyEvolutionArtifactPayload = {
    formatVersion: AI_POLICY_EVOLUTION_FORMAT_VERSION,
    algorithm: CATEGORICAL_CEM_ALGORITHM,
    schema,
    config,
    initialIncumbent: cloneGenome(options.initialIncumbent),
    initialDistribution: cloneDistribution(
      trajectory[0].parentDistribution,
      schema,
    ),
    trajectory,
    finalIncumbent: {
      candidateId: finalWinner.candidateId,
      genome: cloneGenome(finalWinner.genome),
      score: finalWinner.score,
    },
  };
  const artifact: AiPolicyEvolutionArtifact = {
    ...payload,
    artifactHash: computeAiPolicyEvolutionArtifactHash(payload),
  };
  assertValidAiPolicyEvolutionArtifact(artifact);
  return artifact;
}
