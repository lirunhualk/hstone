import {
  AI_RESIDUAL_FEATURE_SCHEMA,
  AI_RESIDUAL_FEATURE_SCHEMA_HASH,
  AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
  tryEncodeAiResidualMacroContext,
} from "./ai-residual-features.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  AI_RESIDUAL_OVERRIDE_THRESHOLD,
  snapshotAiResidualMacroContext,
  type AiFreezeMacroChoice,
  type AiRefreshMacroChoice,
  type AiResidualMacroContext,
  type AiResidualMacroKind,
  type AiResidualPolicy,
  type AiResidualPolicyProposal,
  type AiUpgradeMacroChoice,
  type DeepReadonly,
} from "./ai-residual-policy.ts";
import { AI_STRATEGY_PROFILES } from "./ai.ts";

/** Browser-safe runtime contract for deterministic residual logistic models. */
export const AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION = 1 as const;
export const AI_RESIDUAL_LOGISTIC_SCORER_VERSION = 2 as const;
export const AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD =
  AI_RESIDUAL_OVERRIDE_THRESHOLD;

export type AiResidualLogisticChoice =
  | AiUpgradeMacroChoice
  | AiRefreshMacroChoice
  | AiFreezeMacroChoice;

export interface AiResidualLogisticHeadArtifact {
  readonly kind: AiResidualMacroKind;
  readonly positiveChoice: string;
  readonly negativeChoice: string;
  readonly featureNames: readonly string[];
  readonly intercept: number;
  readonly coefficients: readonly number[];
  readonly trainingExamples: number;
  readonly holdoutExamples: number;
}

/**
 * Minimum artifact surface needed by live scoring. Offline artifacts may carry
 * additional training provenance, but production never reads it.
 */
export interface AiResidualLogisticRuntimeArtifact {
  readonly schemaVersion: typeof AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION;
  readonly scorerVersion: typeof AI_RESIDUAL_LOGISTIC_SCORER_VERSION;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly contextVersion: typeof AI_RESIDUAL_CONTEXT_VERSION;
  readonly featureSchemaVersion: typeof AI_RESIDUAL_FEATURE_SCHEMA_VERSION;
  readonly featureSchemaHash: typeof AI_RESIDUAL_FEATURE_SCHEMA_HASH;
  readonly runtimeContentVersion: string;
  readonly runtimePolicyVersion: string;
  readonly strategyProfileHash: string;
  readonly runtimePayloadHash: string;
  readonly confidenceThreshold: typeof AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD;
  readonly heads: Readonly<{
    upgrade: AiResidualLogisticHeadArtifact;
    refresh: AiResidualLogisticHeadArtifact;
    freeze: AiResidualLogisticHeadArtifact;
  }>;
}

export interface AiResidualLogisticPrediction {
  readonly kind: AiResidualMacroKind;
  readonly choice: AiResidualLogisticChoice;
  readonly positiveProbability: number;
  readonly confidence: number;
}

export interface AiResidualLogisticRuntimeValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface AiResidualLogisticPolicyTrust {
  /** Deployment-controlled hashes of artifacts that passed offline promotion. */
  readonly trustedRuntimePayloadHashes: readonly string[];
}

const SHA256_ROUND_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

/** Pure synchronous SHA-256 for browser runtime integrity checks. */
export function computeAiResidualBrowserSha256(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLength = bytes.length * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15] as number;
      const previous2 = words[index - 2] as number;
      const sigma0 =
        rotateRight(previous15, 7) ^
        rotateRight(previous15, 18) ^
        (previous15 >>> 3);
      const sigma1 =
        rotateRight(previous2, 17) ^
        rotateRight(previous2, 19) ^
        (previous2 >>> 10);
      words[index] = (
        (words[index - 16] as number) +
        sigma0 +
        (words[index - 7] as number) +
        sigma1
      ) >>> 0;
    }
    let a = state[0] as number;
    let b = state[1] as number;
    let c = state[2] as number;
    let d = state[3] as number;
    let e = state[4] as number;
    let f = state[5] as number;
    let g = state[6] as number;
    let h = state[7] as number;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = (
        h +
        sum1 +
        choose +
        (SHA256_ROUND_CONSTANTS[index] as number) +
        (words[index] as number)
      ) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    state[0] = ((state[0] as number) + a) >>> 0;
    state[1] = ((state[1] as number) + b) >>> 0;
    state[2] = ((state[2] as number) + c) >>> 0;
    state[3] = ((state[3] as number) + d) >>> 0;
    state[4] = ((state[4] as number) + e) >>> 0;
    state[5] = ((state[5] as number) + f) >>> 0;
    state[6] = ((state[6] as number) + g) >>> 0;
    state[7] = ((state[7] as number) + h) >>> 0;
  }
  return [...state]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}

function canonicalRuntimeJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("runtime payload numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalRuntimeJson).join(",")}]`;
  }
  if (typeof value !== "object" || value === null) {
    throw new TypeError("runtime payload must contain JSON data");
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalRuntimeJson(record[key])}`,
    )
    .join(",")}}`;
}

const runtimeSeatProfiles = Array.from({ length: 8 }, (_value, index) => ({
  playerId: `player-${index}`,
  profile: AI_STRATEGY_PROFILES[index === 0 ? 0 : index - 1],
}));

export const AI_RESIDUAL_STRATEGY_PROFILE_HASH =
  computeAiResidualBrowserSha256(JSON.stringify(runtimeSeatProfiles));

export type AiResidualLogisticRuntimePayloadInput = Omit<
  AiResidualLogisticRuntimeArtifact,
  "runtimePayloadHash"
>;

function runtimePayload(
  artifact: AiResidualLogisticRuntimePayloadInput,
): unknown {
  const headPayload = (kind: AiResidualMacroKind) => {
    const head = artifact.heads[kind];
    return {
      kind: head.kind,
      positiveChoice: head.positiveChoice,
      negativeChoice: head.negativeChoice,
      featureNames: [...head.featureNames],
      intercept: head.intercept,
      coefficients: [...head.coefficients],
      trainingExamples: head.trainingExamples,
      holdoutExamples: head.holdoutExamples,
    };
  };
  return {
    schemaVersion: artifact.schemaVersion,
    scorerVersion: artifact.scorerVersion,
    modelId: artifact.modelId,
    modelVersion: artifact.modelVersion,
    contextVersion: artifact.contextVersion,
    featureSchemaVersion: artifact.featureSchemaVersion,
    featureSchemaHash: artifact.featureSchemaHash,
    runtimeContentVersion: artifact.runtimeContentVersion,
    runtimePolicyVersion: artifact.runtimePolicyVersion,
    strategyProfileHash: artifact.strategyProfileHash,
    confidenceThreshold: artifact.confidenceThreshold,
    heads: {
      upgrade: headPayload("upgrade"),
      refresh: headPayload("refresh"),
      freeze: headPayload("freeze"),
    },
  };
}

export function computeAiResidualLogisticRuntimePayloadHash(
  artifact: AiResidualLogisticRuntimePayloadInput,
): string {
  return computeAiResidualBrowserSha256(
    canonicalRuntimeJson(runtimePayload(artifact)),
  );
}

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const MODEL_VERSION_PATTERN = /^[a-z0-9][a-z0-9._:+-]{0,127}$/;
const HEAD_KEYS = Object.freeze([
  "kind",
  "positiveChoice",
  "negativeChoice",
  "featureNames",
  "intercept",
  "coefficients",
  "trainingExamples",
  "holdoutExamples",
] as const);
const MISSING_DATA_PROPERTY = Symbol("missing-data-property");

function expectedPositiveChoice(kind: AiResidualMacroKind): string {
  switch (kind) {
    case "upgrade": return "upgradeNow";
    case "refresh": return "refreshOnce";
    case "freeze": return "freeze";
  }
}

function expectedNegativeChoice(kind: AiResidualMacroKind): string {
  switch (kind) {
    case "upgrade": return "deferUpgrade";
    case "refresh": return "stopRefreshing";
    case "freeze": return "unfreeze";
  }
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && "value" in descriptor;
  });
}

function dataProperty(
  value: Record<string, unknown>,
  key: string,
): unknown | typeof MISSING_DATA_PROPERTY {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable === true && "value" in descriptor
    ? descriptor.value
    : MISSING_DATA_PROPERTY;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === expected.length &&
    actual.every((key) => expected.includes(key))
  );
}

function snapshotArray<Value>(
  value: unknown,
  accepts: (item: unknown) => item is Value,
): readonly Value[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return null;
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    return null;
  }
  const length = lengthDescriptor.value as number;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1 || ownKeys[length] !== "length") return null;
  const snapshot: Value[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (ownKeys[index] !== key) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor?.enumerable !== true ||
      !("value" in descriptor) ||
      !accepts(descriptor.value)
    ) {
      return null;
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
}

function snapshotStringArray(value: unknown): readonly string[] | null {
  return snapshotArray(value, (item): item is string => typeof item === "string");
}

function snapshotFiniteArray(value: unknown): readonly number[] | null {
  return snapshotArray(
    value,
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
}

function sameStrings(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  );
}

function snapshotHead(
  value: unknown,
  kind: AiResidualMacroKind,
  errors: string[],
): DeepReadonly<AiResidualLogisticHeadArtifact> | null {
  if (!isPlainDataRecord(value) || !hasExactKeys(value, HEAD_KEYS)) {
    errors.push(`${kind} head has missing or unknown fields`);
    return null;
  }
  const headKind = dataProperty(value, "kind");
  const positiveChoice = dataProperty(value, "positiveChoice");
  const negativeChoice = dataProperty(value, "negativeChoice");
  if (
    headKind !== kind ||
    positiveChoice !== expectedPositiveChoice(kind) ||
    negativeChoice !== expectedNegativeChoice(kind)
  ) {
    errors.push(`${kind} choice mapping mismatch`);
  }

  const names = snapshotStringArray(dataProperty(value, "featureNames"));
  const expectedNames = AI_RESIDUAL_FEATURE_SCHEMA.heads[kind].featureNames;
  if (names === null || !sameStrings(names, expectedNames)) {
    errors.push(`${kind} feature names mismatch`);
  }
  const coefficients = snapshotFiniteArray(dataProperty(value, "coefficients"));
  if (coefficients === null || coefficients.length !== expectedNames.length) {
    errors.push(`${kind} coefficients are invalid`);
  }
  const intercept = dataProperty(value, "intercept");
  if (typeof intercept !== "number" || !Number.isFinite(intercept)) {
    errors.push(`${kind} intercept is invalid`);
  }
  const trainingExamples = dataProperty(value, "trainingExamples");
  const holdoutExamples = dataProperty(value, "holdoutExamples");
  if (!Number.isSafeInteger(trainingExamples) || (trainingExamples as number) < 0) {
    errors.push(`${kind} trainingExamples is invalid`);
  }
  if (!Number.isSafeInteger(holdoutExamples) || (holdoutExamples as number) < 0) {
    errors.push(`${kind} holdoutExamples is invalid`);
  }

  if (
    headKind !== kind ||
    typeof positiveChoice !== "string" ||
    typeof negativeChoice !== "string" ||
    names === null ||
    !sameStrings(names, expectedNames) ||
    coefficients === null ||
    coefficients.length !== expectedNames.length ||
    typeof intercept !== "number" ||
    !Number.isFinite(intercept) ||
    !Number.isSafeInteger(trainingExamples) ||
    (trainingExamples as number) < 0 ||
    !Number.isSafeInteger(holdoutExamples) ||
    (holdoutExamples as number) < 0
  ) {
    return null;
  }
  return Object.freeze({
    kind,
    positiveChoice,
    negativeChoice,
    featureNames: names,
    intercept,
    coefficients,
    trainingExamples: trainingExamples as number,
    holdoutExamples: holdoutExamples as number,
  });
}

function snapshotRuntimeArtifact(value: unknown): {
  readonly snapshot: DeepReadonly<AiResidualLogisticRuntimeArtifact> | null;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  try {
    if (!isPlainDataRecord(value)) {
      return {
        snapshot: null,
        errors: Object.freeze(["artifact must be a plain data object"]),
      };
    }
    const schemaVersion = dataProperty(value, "schemaVersion");
    const scorerVersion = dataProperty(value, "scorerVersion");
    const modelId = dataProperty(value, "modelId");
    const modelVersion = dataProperty(value, "modelVersion");
    const contextVersion = dataProperty(value, "contextVersion");
    const featureSchemaVersion = dataProperty(value, "featureSchemaVersion");
    const featureSchemaHash = dataProperty(value, "featureSchemaHash");
    const runtimeContentVersion = dataProperty(value, "runtimeContentVersion");
    const runtimePolicyVersion = dataProperty(value, "runtimePolicyVersion");
    const strategyProfileHash = dataProperty(value, "strategyProfileHash");
    const runtimePayloadHash = dataProperty(value, "runtimePayloadHash");
    const confidenceThreshold = dataProperty(value, "confidenceThreshold");

    if (schemaVersion !== AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION) {
      errors.push("schemaVersion mismatch");
    }
    if (scorerVersion !== AI_RESIDUAL_LOGISTIC_SCORER_VERSION) {
      errors.push("scorerVersion mismatch");
    }
    if (!MODEL_ID_PATTERN.test(typeof modelId === "string" ? modelId : "")) {
      errors.push("invalid modelId");
    }
    if (!MODEL_VERSION_PATTERN.test(typeof modelVersion === "string" ? modelVersion : "")) {
      errors.push("invalid modelVersion");
    }
    if (contextVersion !== AI_RESIDUAL_CONTEXT_VERSION) {
      errors.push("contextVersion mismatch");
    }
    if (featureSchemaVersion !== AI_RESIDUAL_FEATURE_SCHEMA_VERSION) {
      errors.push("featureSchemaVersion mismatch");
    }
    if (featureSchemaHash !== AI_RESIDUAL_FEATURE_SCHEMA_HASH) {
      errors.push("featureSchemaHash mismatch");
    }
    if (
      typeof runtimeContentVersion !== "string" ||
      runtimeContentVersion.length === 0 ||
      runtimeContentVersion.length > 128
    ) {
      errors.push("runtimeContentVersion is invalid");
    }
    if (
      typeof runtimePolicyVersion !== "string" ||
      runtimePolicyVersion.length === 0 ||
      runtimePolicyVersion.length > 128
    ) {
      errors.push("runtimePolicyVersion is invalid");
    }
    if (strategyProfileHash !== AI_RESIDUAL_STRATEGY_PROFILE_HASH) {
      errors.push("strategyProfileHash mismatch");
    }
    if (
      typeof runtimePayloadHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(runtimePayloadHash)
    ) {
      errors.push("runtimePayloadHash is invalid");
    }
    if (confidenceThreshold !== AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD) {
      errors.push("confidenceThreshold mismatch");
    }

    const headsValue = dataProperty(value, "heads");
    let upgrade: DeepReadonly<AiResidualLogisticHeadArtifact> | null = null;
    let refresh: DeepReadonly<AiResidualLogisticHeadArtifact> | null = null;
    let freeze: DeepReadonly<AiResidualLogisticHeadArtifact> | null = null;
    if (
      !isPlainDataRecord(headsValue) ||
      !hasExactKeys(headsValue, ["upgrade", "refresh", "freeze"])
    ) {
      errors.push("heads must contain exactly upgrade, refresh, and freeze");
    } else {
      upgrade = snapshotHead(dataProperty(headsValue, "upgrade"), "upgrade", errors);
      refresh = snapshotHead(dataProperty(headsValue, "refresh"), "refresh", errors);
      freeze = snapshotHead(dataProperty(headsValue, "freeze"), "freeze", errors);
    }

    if (
      errors.length !== 0 ||
      typeof modelId !== "string" ||
      typeof modelVersion !== "string" ||
      typeof runtimeContentVersion !== "string" ||
      typeof runtimePolicyVersion !== "string" ||
      typeof strategyProfileHash !== "string" ||
      typeof runtimePayloadHash !== "string" ||
      upgrade === null ||
      refresh === null ||
      freeze === null
    ) {
      return { snapshot: null, errors: Object.freeze(errors) };
    }
    const snapshot = Object.freeze({
      schemaVersion: AI_RESIDUAL_LOGISTIC_MODEL_SCHEMA_VERSION,
      scorerVersion: AI_RESIDUAL_LOGISTIC_SCORER_VERSION,
      modelId,
      modelVersion,
      contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
      featureSchemaVersion: AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
      featureSchemaHash: AI_RESIDUAL_FEATURE_SCHEMA_HASH,
      runtimeContentVersion,
      runtimePolicyVersion,
      strategyProfileHash,
      runtimePayloadHash,
      confidenceThreshold: AI_RESIDUAL_LOGISTIC_CONFIDENCE_THRESHOLD,
      heads: Object.freeze({ upgrade, refresh, freeze }),
    });
    if (
      computeAiResidualLogisticRuntimePayloadHash(snapshot) !==
      runtimePayloadHash
    ) {
      return {
        snapshot: null,
        errors: Object.freeze(["runtimePayloadHash does not match runtime payload"]),
      };
    }
    return { snapshot, errors: Object.freeze([]) };
  } catch (error) {
    return {
      snapshot: null,
      errors: Object.freeze([
        `artifact inspection failed: ${error instanceof Error ? error.message : String(error)}`,
      ]),
    };
  }
}

export function validateAiResidualLogisticRuntimeArtifact(
  value: unknown,
): AiResidualLogisticRuntimeValidationResult {
  const result = snapshotRuntimeArtifact(value);
  return Object.freeze({
    valid: result.snapshot !== null,
    errors: result.errors,
  });
}

function stableSigmoid(value: number): number {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exponential = Math.exp(value);
  return exponential / (1 + exponential);
}

function predictValidatedRuntimeArtifact(
  artifact: DeepReadonly<AiResidualLogisticRuntimeArtifact>,
  context: AiResidualMacroContext,
): AiResidualLogisticPrediction | null {
  try {
    const contextSnapshot = snapshotAiResidualMacroContext(context);
    if (contextSnapshot === null) return null;
    if (
      contextSnapshot.contentVersion !== artifact.runtimeContentVersion ||
      contextSnapshot.policyVersion !== artifact.runtimePolicyVersion
    ) {
      return null;
    }
    const encoded = tryEncodeAiResidualMacroContext(contextSnapshot);
    if (encoded === null) return null;
    const head = artifact.heads[encoded.kind];
    if (!sameStrings(encoded.names, head.featureNames)) return null;
    if (encoded.values.length !== head.coefficients.length) return null;
    let logit = head.intercept;
    for (let index = 0; index < encoded.values.length; index += 1) {
      logit +=
        (encoded.values[index] as number) *
        (head.coefficients[index] as number);
    }
    if (!Number.isFinite(logit)) return null;
    const positiveProbability = stableSigmoid(logit);
    if (!Number.isFinite(positiveProbability)) return null;
    const choice =
      positiveProbability >= 0.5
        ? head.positiveChoice
        : head.negativeChoice;
    return Object.freeze({
      kind: encoded.kind,
      choice: choice as AiResidualLogisticChoice,
      positiveProbability,
      confidence: Math.max(positiveProbability, 1 - positiveProbability),
    });
  } catch {
    return null;
  }
}

/** Scores an artifact without any Node.js, filesystem, or script dependency. */
export function predictAiResidualLogisticModel(
  artifact: AiResidualLogisticRuntimeArtifact,
  context: AiResidualMacroContext,
): AiResidualLogisticPrediction | null {
  const result = snapshotRuntimeArtifact(artifact);
  if (result.snapshot === null) return null;
  return predictValidatedRuntimeArtifact(result.snapshot, context);
}

/**
 * Creates an immutable fail-closed provider. The engine remains responsible
 * for installing it for selected players; this module never changes live state.
 */
export function createAiResidualLogisticPolicy(
  artifact: AiResidualLogisticRuntimeArtifact,
  trust: AiResidualLogisticPolicyTrust,
): AiResidualPolicy {
  const result = snapshotRuntimeArtifact(artifact);
  if (result.snapshot === null) {
    throw new TypeError(result.errors.join("; "));
  }
  const snapshot = result.snapshot;
  const trustedHashes = snapshotStringArray(
    isPlainDataRecord(trust) &&
      hasExactKeys(trust, ["trustedRuntimePayloadHashes"])
      ? dataProperty(trust, "trustedRuntimePayloadHashes")
      : null,
  );
  if (
    trustedHashes === null ||
    trustedHashes.length === 0 ||
    new Set(trustedHashes).size !== trustedHashes.length ||
    !trustedHashes.every((hash) => /^[0-9a-f]{64}$/.test(hash)) ||
    !trustedHashes.includes(snapshot.runtimePayloadHash)
  ) {
    throw new TypeError(
      "runtimePayloadHash is not in the deployment trust allowlist",
    );
  }
  return Object.freeze({
    policyId: snapshot.modelId,
    policyVersion: snapshot.modelVersion,
    propose(
      context: DeepReadonly<AiResidualMacroContext>,
    ): AiResidualPolicyProposal | null {
      const contextSnapshot = snapshotAiResidualMacroContext(
        context as AiResidualMacroContext,
      );
      if (contextSnapshot === null) return null;
      const prediction = predictValidatedRuntimeArtifact(
        snapshot,
        contextSnapshot,
      );
      if (
        prediction === null ||
        prediction.confidence < snapshot.confidenceThreshold ||
        contextSnapshot.legalChoices.length !== 2 ||
        !contextSnapshot.legalChoices.some(
          (choice) => choice === prediction.choice,
        )
      ) {
        return null;
      }
      return Object.freeze({
        kind: prediction.kind,
        choice: prediction.choice,
        confidence: prediction.confidence,
        reasonCode:
          `logistic-v${AI_RESIDUAL_LOGISTIC_SCORER_VERSION}:` +
          `${prediction.kind}:${prediction.choice}`,
      }) as AiResidualPolicyProposal;
    },
  });
}
