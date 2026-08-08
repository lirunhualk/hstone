import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  openSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

import {
  getAiStrategyProfile,
  type AiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  assertAiCooperativeCemSelectionSharedClaimAvailable,
  createAiCooperativeCemSelectionMarker,
  ensureAiCooperativeCemSelectionDirectoryTreeWithin,
  prepareFreshAiCooperativeCemSelectionAttemptPaths,
  resolveAiCooperativeCemSelectionSharedClaimPaths,
  type AiCooperativeCemSelectionAttemptPaths,
  type AiCooperativeCemSelectionMarker,
  type AiCooperativeCemSelectionSharedClaimPaths,
} from "./ai-cooperative-cem-selection-attempt.ts";
export {
  AI_COOPERATIVE_CEM_SELECTION_MARKER_FORMAT_VERSION,
  assertValidAiCooperativeCemSelectionMarker,
  computeAiCooperativeCemSelectionMarkerHash,
  createAiCooperativeCemSelectionMarker,
  type AiCooperativeCemSelectionMarker,
  type AiCooperativeCemSelectionMarkerPayload,
} from "./ai-cooperative-cem-selection-attempt.ts";
import {
  buildAiCooperativeCemSelectionCandidateProfileOverrides,
} from "./ai-cooperative-cem-selection-contract.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION,
  evaluateAiCooperativeCemSelectionGate,
  type AiCooperativeCemSelectionGateResult,
} from "./ai-cooperative-cem-selection-gate.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
  assertAiCooperativeCemSelectionImplementationPinned,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION,
  AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
  AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
  AI_COOPERATIVE_CEM_SELECTION_SEEDS,
} from "./ai-cooperative-cem-selection-registration.ts";
import {
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
  readAiCooperativeCemHistoricalTrainingEvidence,
} from "./ai-cooperative-cem-training-evidence.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
} from "./ai-cooperative-cem-training-result.ts";
import {
  summarizeAiCooperativeCemBenchmarkResult,
  type AiCooperativeCemBenchmarkEvidence,
} from "./ai-cooperative-cem.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";
import {
  AI_POLICY_SUITE_BENCHMARK_VERSION,
  computeAiPolicySuiteCandidateProfileHash,
  computeAiPolicySuiteDefaultProfileHash,
  runAiPolicySuiteBenchmark,
  type AiPolicySuiteBenchmarkProgress,
  type AiPolicySuiteBenchmarkResult,
  type AiPolicySuitePlayerId,
} from "./benchmark-ai-policy-suite.ts";

export const AI_COOPERATIVE_CEM_SELECTION_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_SELECTION_CHECKPOINT_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_SELECTION_METHOD =
  "single-candidate-independent-selection-v1" as const;
export const AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE =
  "cooperative CEM selection is permanently completed and gate-rejected; artifact d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b is historical and cannot be rerun" as const;

export function assertAiCooperativeCemSelectionNotCompleted(): never {
  throw new Error(AI_COOPERATIVE_CEM_SELECTION_COMPLETED_MESSAGE);
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT_NAMESPACE = join("outputs", "ai-cooperative-cem-selection");
const SHARED_RUN_MARKER_FILE_NAME = "run-attempt.json";

const BENCHMARK_TOKEN_BRAND: unique symbol = Symbol(
  "ai-cooperative-cem-selection-benchmark-token",
);

export interface AiCooperativeCemSelectionBenchmarkToken {
  readonly [BENCHMARK_TOKEN_BRAND]: true;
}

interface TokenRegistry {
  issue(): AiCooperativeCemSelectionBenchmarkToken;
  consume(token: unknown): void;
  isConsumed(token: unknown): boolean;
}

interface RegisteredSelectionAttempt {
  readonly marker: AiCooperativeCemSelectionMarker;
  readonly benchmarkToken: AiCooperativeCemSelectionBenchmarkToken;
  readonly paths: AiCooperativeCemSelectionAttemptPaths;
  checkpointHash: string | null;
  artifactPersisted: boolean;
}

export interface AiCooperativeCemSelectionAtomicWriteTestHooks {
  readonly publishTemporaryFile?: (
    temporaryPath: string,
    targetPath: string,
  ) => void;
  readonly unlinkPublishedTemporaryFile?: (temporaryPath: string) => void;
}

function createTokenRegistry(label: string): TokenRegistry {
  const issued = new WeakSet<object>();
  const consumed = new WeakSet<object>();
  return {
    issue() {
      const token = Object.freeze({
        [BENCHMARK_TOKEN_BRAND]: true,
      }) as AiCooperativeCemSelectionBenchmarkToken;
      issued.add(token);
      return token;
    },
    consume(token) {
      if (
        token === null ||
        typeof token !== "object" ||
        !issued.has(token)
      ) {
        throw new TypeError(`${label} requires a token issued by its fixed claim`);
      }
      if (consumed.has(token)) {
        throw new TypeError(`${label} token has already been consumed`);
      }
      consumed.add(token);
    },
    isConsumed(token) {
      return (
        token !== null &&
        typeof token === "object" &&
        issued.has(token) &&
        consumed.has(token)
      );
    },
  };
}

const productionTokenRegistry = createTokenRegistry(
  "registered cooperative CEM selection benchmark",
);

export function consumeAiCooperativeCemSelectionBenchmarkToken(
  token: unknown,
): void {
  productionTokenRegistry.consume(token);
}

export function createAiCooperativeCemSelectionTokenRegistryForTest(): Readonly<{
  issue(): AiCooperativeCemSelectionBenchmarkToken;
  consume(token: unknown): void;
}> {
  if (process.env.NODE_TEST_CONTEXT === undefined) {
    throw new Error(
      "cooperative CEM selection test token registry requires node --test",
    );
  }
  const registry = createTokenRegistry(
    "cooperative CEM selection test token registry",
  );
  return Object.freeze({
    issue: () => registry.issue(),
    consume: (token: unknown) => registry.consume(token),
  });
}

export interface AiCooperativeCemSelectionAuthorization {
  readonly confirmation: typeof AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256;
  readonly trainingResultSha256: typeof AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256;
}

export interface AiCooperativeCemSelectionRequest {
  readonly candidateId: string;
  readonly profileOverrides: ReadonlyMap<AiPolicySuitePlayerId, AiStrategyProfile>;
  readonly startSeed: number;
  readonly seeds: number;
  readonly maxRounds: number;
  readonly initialHealth: number;
  readonly scenarioIds: readonly ["neutral-v1", "live-lobby-v1"];
  readonly onProgress?: (progress: AiPolicySuiteBenchmarkProgress) => void;
}

export interface AiCooperativeCemSelectionCheckpointPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_SELECTION_CHECKPOINT_FORMAT_VERSION;
  readonly executionKind: "registered" | "injected-test";
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256;
  readonly trainingResultSha256: typeof AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256;
  readonly markerHash: string | null;
  readonly candidateId: string;
  readonly genome: typeof AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome;
  readonly candidateProfileHash: string;
  readonly rawResultSha256: string;
  readonly benchmark: AiCooperativeCemBenchmarkEvidence;
  readonly gate: AiCooperativeCemSelectionGateResult;
  readonly rawBenchmarkResult: AiPolicySuiteBenchmarkResult;
}

export interface AiCooperativeCemSelectionCheckpoint
  extends AiCooperativeCemSelectionCheckpointPayload {
  readonly checkpointHash: string;
}

export interface AiCooperativeCemSelectionArtifactPayload {
  readonly formatVersion: typeof AI_COOPERATIVE_CEM_SELECTION_FORMAT_VERSION;
  readonly method: typeof AI_COOPERATIVE_CEM_SELECTION_METHOD;
  readonly registrationId: typeof AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256;
  readonly trainingResultSha256: typeof AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256;
  readonly executionKind: "registered" | "injected-test";
  readonly markerHash: string | null;
  readonly checkpointHash: string;
  readonly rawResultSha256: string;
  readonly candidateId: string;
  readonly genome: typeof AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome;
  readonly candidateProfileHash: string;
  readonly benchmark: AiCooperativeCemBenchmarkEvidence;
  readonly gate: AiCooperativeCemSelectionGateResult;
  readonly rosterFinalScreenEligible: boolean;
}

export interface AiCooperativeCemSelectionArtifact
  extends AiCooperativeCemSelectionArtifactPayload {
  readonly artifactHash: string;
}

export interface AiCooperativeCemSelectionRunOptions {
  readonly authorization?: AiCooperativeCemSelectionAuthorization;
  readonly benchmarkEvaluator?: (
    request: Readonly<AiCooperativeCemSelectionRequest>,
  ) => AiPolicySuiteBenchmarkResult;
  readonly onProgress?: (progress: AiPolicySuiteBenchmarkProgress) => void;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(value))
    .digest("hex");
}

function snapshotCanonical<T>(value: T): T {
  return JSON.parse(canonicalAiPolicyEvolutionJson(value)) as T;
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lower-case SHA-256 digest`);
  }
}

function withoutHash<T extends object>(value: T, property: string): object {
  const result = { ...value } as Record<string, unknown>;
  delete result[property];
  return result;
}

function assertStaticRawBenchmarkContract(
  result: AiPolicySuiteBenchmarkResult,
): void {
  const registered = AI_COOPERATIVE_CEM_SELECTION_REGISTRATION;
  const expectedConfig = {
    controlPlayerId: "player-0",
    initialHealth: registered.benchmark.initialHealth,
    maxRounds: registered.benchmark.maxRounds,
    profileOverridesProvided: true,
    residualPolicyProvided: false,
    rotations: [...registered.benchmark.rotations],
    scenarioIds: [...registered.benchmark.scenarioIds],
    scoredPlayerIds: [...registered.benchmark.scoredPlayerIds],
    seeds: registered.benchmark.seeds,
    startSeed: registered.benchmark.startSeed,
  };
  if (
    result.method !== "paired-seven-profile-suite-v1" ||
    result.benchmarkVersion !== AI_POLICY_SUITE_BENCHMARK_VERSION ||
    canonicalAiPolicyEvolutionJson(result.config) !==
      canonicalAiPolicyEvolutionJson(expectedConfig)
  ) {
    throw new TypeError("selection raw benchmark configuration mismatch");
  }
  const provenance = registered.expectedProvenance;
  const expectedCandidateProfiles =
    buildAiCooperativeCemSelectionCandidateProfileOverrides();
  const expectedStrategyProfileSnapshots =
    registered.benchmark.scoredPlayerIds.map((playerId) => ({
      playerId,
      profile: getAiStrategyProfile(playerId),
    }));
  const expectedCandidateProfileSnapshots =
    registered.benchmark.scoredPlayerIds.map((playerId) => {
      const profile = expectedCandidateProfiles.get(playerId);
      if (profile === undefined) {
        throw new TypeError(
          `selection candidate profile snapshot is missing ${playerId}`,
        );
      }
      return { playerId, profile };
    });
  if (
    result.policyVersion !== provenance.policyVersion ||
    result.policyVersionAfter !== provenance.policyVersion ||
    !result.policyVersionStable ||
    result.contentVersion !== provenance.contentVersion ||
    result.contentSnapshotSha256 !== provenance.contentSnapshotSha256 ||
    result.contentSnapshotSha256After !== provenance.contentSnapshotSha256 ||
    !result.contentSnapshotStable ||
    result.evaluatorHash !== provenance.evaluatorHash ||
    result.evaluatorHashAfter !== provenance.evaluatorHash ||
    !result.evaluatorStable ||
    result.strategyProfileHash !== provenance.strategyProfileHash ||
    result.strategyProfileHashAfter !== provenance.strategyProfileHash ||
    !result.strategyProfilesStable ||
    result.candidateProfileHash !== provenance.candidateProfileHash ||
    result.candidateProfileHashAfter !== provenance.candidateProfileHash ||
    !result.candidateProfilesStable ||
    computeAiPolicySuiteDefaultProfileHash() !== result.strategyProfileHash ||
    computeAiPolicySuiteCandidateProfileHash(expectedCandidateProfiles) !==
      result.candidateProfileHash ||
    canonicalAiPolicyEvolutionJson(result.strategyProfiles) !==
      canonicalAiPolicyEvolutionJson(expectedStrategyProfileSnapshots) ||
    canonicalAiPolicyEvolutionJson(result.candidateProfiles) !==
      canonicalAiPolicyEvolutionJson(expectedCandidateProfileSnapshots)
  ) {
    throw new TypeError("selection raw benchmark provenance mismatch");
  }
  if (
    result.clusters.length !== registered.benchmark.expectedSeedClusters ||
    result.clusters.some(
      (cluster, index) =>
        cluster.seed !== registered.benchmark.startSeed + index ||
        cluster.episodes.length !==
          registered.benchmark.scenarioIds.length *
            registered.benchmark.rotations.length ||
        cluster.pairs.length !==
          registered.benchmark.scenarioIds.length *
            registered.benchmark.rotations.length *
            registered.benchmark.scoredPlayerIds.length,
    )
  ) {
    throw new TypeError("selection raw benchmark seed cluster closure mismatch");
  }
  if (
    result.providerDiagnostics.providerCalls !== 0 ||
    result.providerDiagnostics.providerErrors !== 0
  ) {
    throw new TypeError("selection raw benchmark residual provider activity is forbidden");
  }
}

export function assertValidAiCooperativeCemSelectionRawBenchmarkResult(
  result: AiPolicySuiteBenchmarkResult,
): void {
  assertStaticRawBenchmarkContract(result);
  if (
    typeof result.evidenceUsable !== "boolean" ||
    !Array.isArray(result.evidenceReasons) ||
    result.evidenceReasons.some((reason) => typeof reason !== "string") ||
    result.evidenceUsable !== (result.evidenceReasons.length === 0)
  ) {
    throw new TypeError("selection raw benchmark evidence flags are invalid");
  }
  const gate = evaluateAiCooperativeCemSelectionGate(result);
  if (
    result.progress.scheduledRuns !==
      AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION.accounting.scheduledRuns ||
    result.expectedPairs !==
      AI_COOPERATIVE_CEM_SELECTION_GATE_REGISTRATION.accounting.expectedPairs
  ) {
    throw new TypeError("selection raw benchmark accounting mismatch");
  }
  if (!result.evidenceUsable && gate.accepted) {
    throw new TypeError("selection gate cannot accept unusable evidence");
  }
}

export function computeAiCooperativeCemSelectionCheckpointHash(
  value:
    | AiCooperativeCemSelectionCheckpointPayload
    | AiCooperativeCemSelectionCheckpoint,
): string {
  return hashCanonical(withoutHash(value, "checkpointHash"));
}

export function assertValidAiCooperativeCemSelectionCheckpoint(
  value: AiCooperativeCemSelectionCheckpoint,
): void {
  assertSha256(value.checkpointHash, "selectionCheckpoint.checkpointHash");
  assertSha256(value.rawResultSha256, "selectionCheckpoint.rawResultSha256");
  if (
    (value.executionKind !== "registered" &&
      value.executionKind !== "injected-test") ||
    value.formatVersion !==
      AI_COOPERATIVE_CEM_SELECTION_CHECKPOINT_FORMAT_VERSION ||
    value.protocolSha256 !== AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256 ||
    value.implementationSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256 ||
    value.trainingResultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 ||
    value.candidateId !== AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateId ||
    value.candidateProfileHash !==
      AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateProfileHash ||
    canonicalAiPolicyEvolutionJson(value.genome) !==
      canonicalAiPolicyEvolutionJson(
        AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome,
      )
  ) {
    throw new TypeError("cooperative CEM selection checkpoint registration mismatch");
  }
  if (
    (value.executionKind === "registered" &&
      value.markerHash !== createAiCooperativeCemSelectionMarker().markerHash) ||
    (value.executionKind === "injected-test" && value.markerHash !== null)
  ) {
    throw new TypeError("cooperative CEM selection checkpoint execution mismatch");
  }
  assertValidAiCooperativeCemSelectionRawBenchmarkResult(value.rawBenchmarkResult);
  if (
    hashCanonical(value.rawBenchmarkResult) !== value.rawResultSha256 ||
    canonicalAiPolicyEvolutionJson(
      summarizeAiCooperativeCemBenchmarkResult(value.rawBenchmarkResult),
    ) !== canonicalAiPolicyEvolutionJson(value.benchmark) ||
    canonicalAiPolicyEvolutionJson(
      evaluateAiCooperativeCemSelectionGate(value.rawBenchmarkResult),
    ) !== canonicalAiPolicyEvolutionJson(value.gate) ||
    computeAiCooperativeCemSelectionCheckpointHash(value) !== value.checkpointHash
  ) {
    throw new TypeError("cooperative CEM selection checkpoint evidence mismatch");
  }
}

export function computeAiCooperativeCemSelectionArtifactHash(
  value: AiCooperativeCemSelectionArtifactPayload | AiCooperativeCemSelectionArtifact,
): string {
  return hashCanonical(withoutHash(value, "artifactHash"));
}

export function assertValidAiCooperativeCemSelectionArtifact(
  value: AiCooperativeCemSelectionArtifact,
): void {
  assertSha256(value.artifactHash, "selectionArtifact.artifactHash");
  assertSha256(value.checkpointHash, "selectionArtifact.checkpointHash");
  assertSha256(value.rawResultSha256, "selectionArtifact.rawResultSha256");
  if (
    (value.executionKind !== "registered" &&
      value.executionKind !== "injected-test") ||
    value.formatVersion !== AI_COOPERATIVE_CEM_SELECTION_FORMAT_VERSION ||
    value.method !== AI_COOPERATIVE_CEM_SELECTION_METHOD ||
    value.registrationId !== AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID ||
    value.protocolSha256 !== AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256 ||
    value.implementationSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256 ||
    value.trainingResultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 ||
    value.candidateId !== AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateId ||
    value.candidateProfileHash !==
      AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateProfileHash ||
    canonicalAiPolicyEvolutionJson(value.genome) !==
      canonicalAiPolicyEvolutionJson(
        AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome,
      )
  ) {
    throw new TypeError("cooperative CEM selection artifact registration mismatch");
  }
  if (
    (value.executionKind === "registered" &&
      value.markerHash !== createAiCooperativeCemSelectionMarker().markerHash) ||
    (value.executionKind === "injected-test" && value.markerHash !== null)
  ) {
    throw new TypeError("cooperative CEM selection artifact execution mismatch");
  }
  const expectedEligible =
    value.executionKind === "registered" &&
    value.benchmark.evidenceUsable &&
    value.gate.accepted;
  if (
    value.rosterFinalScreenEligible !== expectedEligible ||
    computeAiCooperativeCemSelectionArtifactHash(value) !== value.artifactHash
  ) {
    throw new TypeError("cooperative CEM selection artifact closure mismatch");
  }
}

export function assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(
  artifact: AiCooperativeCemSelectionArtifact,
  checkpoint: AiCooperativeCemSelectionCheckpoint,
): void {
  assertValidAiCooperativeCemSelectionCheckpoint(checkpoint);
  assertValidAiCooperativeCemSelectionArtifact(artifact);
  if (
    artifact.executionKind !== checkpoint.executionKind ||
    artifact.markerHash !== checkpoint.markerHash ||
    artifact.checkpointHash !== checkpoint.checkpointHash ||
    artifact.rawResultSha256 !== checkpoint.rawResultSha256 ||
    artifact.candidateId !== checkpoint.candidateId ||
    artifact.candidateProfileHash !== checkpoint.candidateProfileHash ||
    canonicalAiPolicyEvolutionJson(artifact.genome) !==
      canonicalAiPolicyEvolutionJson(checkpoint.genome) ||
    canonicalAiPolicyEvolutionJson(artifact.benchmark) !==
      canonicalAiPolicyEvolutionJson(checkpoint.benchmark) ||
    canonicalAiPolicyEvolutionJson(artifact.gate) !==
      canonicalAiPolicyEvolutionJson(checkpoint.gate)
  ) {
    throw new TypeError(
      "cooperative CEM selection artifact does not match its raw checkpoint",
    );
  }
}

function assertRegisteredAuthorization(
  authorization: AiCooperativeCemSelectionAuthorization | undefined,
): asserts authorization is AiCooperativeCemSelectionAuthorization {
  if (
    authorization?.confirmation !==
      AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION ||
    authorization.protocolSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256 ||
    authorization.implementationSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256 ||
    authorization.trainingResultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256
  ) {
    throw new TypeError(
      "registered cooperative CEM selection requires the exact four-part authorization",
    );
  }
}

function canonicalJsonLine(value: unknown): string {
  return `${canonicalAiPolicyEvolutionJson(value)}\n`;
}

function registeredPathEntryExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

function isPathInside(parent: string, child: string): boolean {
  const childRelative = relative(parent, child);
  return (
    childRelative.length > 0 &&
    childRelative !== ".." &&
    !childRelative.startsWith(`..${sep}`) &&
    !isAbsolute(childRelative)
  );
}

function isPathSameOrInside(parent: string, child: string): boolean {
  return parent === child || isPathInside(parent, child);
}

function requireOrdinaryDirectory(path: string, label: string): string {
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new TypeError(`${label} must be an ordinary directory`);
  }
  return realpathSync.native(path);
}

function reportAtomicWriteCleanup(
  report: (message: string) => void,
  message: string,
): void {
  try {
    report(message);
  } catch {
    // Publication state must never depend on a diagnostic sink.
  }
}

function atomicAppendOnlyRegisteredSelectionWrite(
  targetPath: string,
  content: string,
  report: (message: string) => void = () => undefined,
  hooks: AiCooperativeCemSelectionAtomicWriteTestHooks = {},
): "created" {
  if (registeredPathEntryExists(targetPath)) {
    throw new Error(`refusing to overwrite ${targetPath}`);
  }
  const temporaryPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor: number | null = null;
  let published = false;
  try {
    descriptor = openSync(temporaryPath, "wx");
    writeFileSync(descriptor, content, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    (hooks.publishTemporaryFile ?? linkSync)(temporaryPath, targetPath);
    published = true;
    try {
      (hooks.unlinkPublishedTemporaryFile ?? unlinkSync)(temporaryPath);
    } catch (error) {
      reportAtomicWriteCleanup(
        report,
        `published ${basename(targetPath)} but left stale temporary file ${basename(temporaryPath)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return "created";
  } catch (error) {
    if (descriptor !== null) {
      try {
        closeSync(descriptor);
      } catch (closeError) {
        reportAtomicWriteCleanup(
          report,
          `failed to close temporary file ${basename(temporaryPath)}: ${closeError instanceof Error ? closeError.message : String(closeError)}`,
        );
      }
    }
    if (!published && registeredPathEntryExists(temporaryPath)) {
      try {
        unlinkSync(temporaryPath);
      } catch (cleanupError) {
        reportAtomicWriteCleanup(
          report,
          `left stale temporary file ${basename(temporaryPath)}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
        );
      }
    }
    throw error;
  }
}

function publishRegisteredSharedClaim(
  sharedPaths: AiCooperativeCemSelectionSharedClaimPaths,
  markerContent: string,
): string {
  const claimDirectory =
    ensureAiCooperativeCemSelectionDirectoryTreeWithin(
      sharedPaths.commonGitDirectory,
      sharedPaths.claimDirectory,
    );
  const markerPath = join(claimDirectory, SHARED_RUN_MARKER_FILE_NAME);
  atomicAppendOnlyRegisteredSelectionWrite(markerPath, markerContent);
  return markerPath;
}

export function atomicAppendOnlySelectionWriteForTest(
  targetPath: string,
  content: string,
  report: (message: string) => void = () => undefined,
  hooks: AiCooperativeCemSelectionAtomicWriteTestHooks = {},
): "created" {
  if (process.env.NODE_TEST_CONTEXT === undefined) {
    throw new Error(
      "test-only cooperative CEM selection writer requires node --test",
    );
  }
  const temporaryRoot = realpathSync.native(resolve(tmpdir()));
  const resolvedTargetPath = resolve(targetPath);
  const productionSharedPaths =
    resolveAiCooperativeCemSelectionSharedClaimPaths(REPOSITORY_ROOT);
  const productionOutputNamespace = resolve(
    REPOSITORY_ROOT,
    OUTPUT_NAMESPACE,
  );
  if (
    isPathSameOrInside(productionOutputNamespace, resolvedTargetPath) ||
    isPathSameOrInside(
      productionSharedPaths.commonGitDirectory,
      resolvedTargetPath,
    )
  ) {
    throw new RangeError(
      "test-only cooperative CEM selection writer must not target production or sibling-worktree state",
    );
  }
  const targetParent = requireOrdinaryDirectory(
    dirname(resolvedTargetPath),
    "test-only cooperative CEM selection target parent",
  );
  if (!isPathInside(temporaryRoot, targetParent)) {
    throw new RangeError(
      "test-only cooperative CEM selection writer target must remain beneath the temporary root",
    );
  }
  const safeTargetPath = join(targetParent, basename(resolvedTargetPath));
  if (
    isPathSameOrInside(
      productionSharedPaths.commonGitDirectory,
      safeTargetPath,
    )
  ) {
    throw new RangeError(
      "test-only cooperative CEM selection writer must not target the production or sibling-worktree Git common directory",
    );
  }
  return atomicAppendOnlyRegisteredSelectionWrite(
    safeTargetPath,
    content,
    report,
    hooks,
  );
}

export function claimSharedAiCooperativeCemSelectionAttemptForTest(
  repositoryRoot: string,
  markerContent = "test-only-selection-claim\n",
): string {
  if (process.env.NODE_TEST_CONTEXT === undefined) {
    throw new Error(
      "test-only cooperative CEM selection claim requires node --test",
    );
  }
  const testRepositoryRoot = realpathSync.native(resolve(repositoryRoot));
  const testPaths = resolveAiCooperativeCemSelectionSharedClaimPaths(
    testRepositoryRoot,
  );
  const productionPaths =
    resolveAiCooperativeCemSelectionSharedClaimPaths(REPOSITORY_ROOT);
  if (testPaths.commonGitDirectory === productionPaths.commonGitDirectory) {
    throw new RangeError(
      "test-only cooperative CEM selection claim must not use the production or sibling-worktree Git common directory",
    );
  }
  const temporaryRoot = realpathSync.native(resolve(tmpdir()));
  if (!isPathInside(temporaryRoot, testRepositoryRoot)) {
    throw new RangeError(
      "test-only cooperative CEM selection claim requires a disposable temporary repository",
    );
  }
  if (!isPathInside(temporaryRoot, testPaths.commonGitDirectory)) {
    throw new RangeError(
      "test-only cooperative CEM selection Git common directory must remain beneath the temporary root",
    );
  }
  assertAiCooperativeCemSelectionSharedClaimAvailable(testRepositoryRoot);
  return publishRegisteredSharedClaim(testPaths, markerContent);
}

function claimRegisteredSelectionAttempt(
  authorization: AiCooperativeCemSelectionAuthorization,
): RegisteredSelectionAttempt {
  assertRegisteredAuthorization(authorization);
  if (process.env.NODE_TEST_CONTEXT !== undefined) {
    throw new Error(
      "registered cooperative CEM selection claim is disabled inside node --test",
    );
  }
  assertAiCooperativeCemSelectionImplementationPinned();
  readAiCooperativeCemHistoricalTrainingEvidence(
    resolve(
      REPOSITORY_ROOT,
      AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
    ),
  );

  // This read-only global check must precede every local output mkdir. The
  // append-only publication below repeats the protection atomically.
  const sharedPaths = assertAiCooperativeCemSelectionSharedClaimAvailable(
    REPOSITORY_ROOT,
  );
  const paths = prepareFreshAiCooperativeCemSelectionAttemptPaths(
    REPOSITORY_ROOT,
  );
  const marker = createAiCooperativeCemSelectionMarker();
  const markerContent = canonicalJsonLine(marker);
  publishRegisteredSharedClaim(sharedPaths, markerContent);
  atomicAppendOnlyRegisteredSelectionWrite(paths.markerPath, markerContent);

  return {
    marker,
    benchmarkToken: productionTokenRegistry.issue(),
    paths,
    checkpointHash: null,
    artifactPersisted: false,
  };
}

function assertCompletedRegisteredSelectionAttempt(
  attempt: RegisteredSelectionAttempt,
): void {
  if (!productionTokenRegistry.isConsumed(attempt.benchmarkToken)) {
    throw new TypeError(
      "cooperative CEM selection persistence requires its completed registered benchmark",
    );
  }
}

function persistRegisteredSelectionCheckpoint(
  attempt: RegisteredSelectionAttempt,
  checkpoint: AiCooperativeCemSelectionCheckpoint,
): "created" {
  assertCompletedRegisteredSelectionAttempt(attempt);
  assertValidAiCooperativeCemSelectionCheckpoint(checkpoint);
  if (
    checkpoint.executionKind !== "registered" ||
    checkpoint.markerHash !== attempt.marker.markerHash
  ) {
    throw new TypeError(
      "cooperative CEM selection checkpoint does not belong to its fixed registered attempt",
    );
  }
  if (attempt.checkpointHash !== null) {
    throw new Error("cooperative CEM selection checkpoint was already persisted");
  }
  const disposition = atomicAppendOnlyRegisteredSelectionWrite(
    attempt.paths.checkpointPath,
    canonicalJsonLine(checkpoint),
  );
  attempt.checkpointHash = checkpoint.checkpointHash;
  return disposition;
}

function persistRegisteredSelectionArtifact(
  attempt: RegisteredSelectionAttempt,
  checkpoint: AiCooperativeCemSelectionCheckpoint,
  artifact: AiCooperativeCemSelectionArtifact,
): "created" {
  assertCompletedRegisteredSelectionAttempt(attempt);
  assertValidAiCooperativeCemSelectionCheckpoint(checkpoint);
  assertValidAiCooperativeCemSelectionArtifact(artifact);
  assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(artifact, checkpoint);
  if (
    checkpoint.executionKind !== "registered" ||
    artifact.executionKind !== "registered" ||
    checkpoint.markerHash !== attempt.marker.markerHash ||
    artifact.markerHash !== attempt.marker.markerHash ||
    attempt.checkpointHash !== checkpoint.checkpointHash
  ) {
    throw new TypeError(
      "cooperative CEM selection artifact does not belong to its persisted registered checkpoint",
    );
  }
  if (attempt.artifactPersisted) {
    throw new Error("cooperative CEM selection artifact was already persisted");
  }
  const disposition = atomicAppendOnlyRegisteredSelectionWrite(
    attempt.paths.outputPath,
    canonicalJsonLine(artifact),
  );
  attempt.artifactPersisted = true;
  return disposition;
}

function registeredBenchmarkEvaluator(
  request: Readonly<AiCooperativeCemSelectionRequest>,
  benchmarkToken: AiCooperativeCemSelectionBenchmarkToken,
): AiPolicySuiteBenchmarkResult {
  return runAiPolicySuiteBenchmark({
    candidate: { profileOverrides: request.profileOverrides },
    startSeed: request.startSeed,
    seeds: request.seeds,
    maxRounds: request.maxRounds,
    initialHealth: request.initialHealth,
    scenarioIds: request.scenarioIds,
    reservationId: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_ID,
    reservationMode: AI_COOPERATIVE_CEM_SELECTION_RESERVATION_MODE,
    reservationProtocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    reservationImplementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    reservationConfirmation: AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
    reservationTrainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    selectionAttemptToken: benchmarkToken,
    onProgress: request.onProgress,
  });
}

export function runAiCooperativeCemSelection(
  options: AiCooperativeCemSelectionRunOptions = {},
): AiCooperativeCemSelectionArtifact {
  const registered = options.benchmarkEvaluator === undefined;
  if (registered) {
    assertAiCooperativeCemSelectionNotCompleted();
  }
  const legacyOptions = options as AiCooperativeCemSelectionRunOptions &
    Record<string, unknown>;
  if (
    "onRegisteredRunStart" in legacyOptions ||
    "onRegisteredCheckpoint" in legacyOptions
  ) {
    throw new TypeError(
      "registered cooperative CEM selection no longer accepts external persistence sinks",
    );
  }
  let evaluator = options.benchmarkEvaluator;
  let markerHash: string | null = null;
  let registeredAttempt: RegisteredSelectionAttempt | null = null;

  if (registered) {
    assertRegisteredAuthorization(options.authorization);
    if (process.env.NODE_TEST_CONTEXT !== undefined) {
      throw new Error(
        "registered cooperative CEM selection is disabled inside node --test",
      );
    }
    registeredAttempt = claimRegisteredSelectionAttempt(
      options.authorization,
    );
    markerHash = registeredAttempt.marker.markerHash;
    const benchmarkToken = registeredAttempt.benchmarkToken;
    evaluator = (request) =>
      registeredBenchmarkEvaluator(request, benchmarkToken);
  } else if (options.authorization !== undefined) {
    throw new TypeError(
      "injected cooperative CEM selection cannot receive registered capabilities",
    );
  }
  if (evaluator === undefined) {
    throw new TypeError("cooperative CEM selection evaluator is missing");
  }

  const request = deepFreeze({
    candidateId: AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateId,
    profileOverrides: buildAiCooperativeCemSelectionCandidateProfileOverrides(),
    startSeed: AI_COOPERATIVE_CEM_SELECTION_SEEDS.startSeed,
    seeds: AI_COOPERATIVE_CEM_SELECTION_SEEDS.seeds,
    maxRounds: AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.benchmark.maxRounds,
    initialHealth:
      AI_COOPERATIVE_CEM_SELECTION_REGISTRATION.benchmark.initialHealth,
    scenarioIds: ["neutral-v1", "live-lobby-v1"] as const,
    onProgress: options.onProgress,
  });
  const rawBenchmarkResult = deepFreeze(snapshotCanonical(evaluator(request)));
  assertValidAiCooperativeCemSelectionRawBenchmarkResult(rawBenchmarkResult);
  const benchmark = summarizeAiCooperativeCemBenchmarkResult(rawBenchmarkResult);
  const gate = evaluateAiCooperativeCemSelectionGate(rawBenchmarkResult);
  const checkpointPayload: AiCooperativeCemSelectionCheckpointPayload = {
    formatVersion: AI_COOPERATIVE_CEM_SELECTION_CHECKPOINT_FORMAT_VERSION,
    executionKind: registered ? "registered" : "injected-test",
    protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    implementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    trainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    markerHash,
    candidateId: request.candidateId,
    genome: AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome,
    candidateProfileHash:
      AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.candidateProfileHash,
    rawResultSha256: hashCanonical(rawBenchmarkResult),
    benchmark,
    gate,
    rawBenchmarkResult,
  };
  const checkpoint = deepFreeze({
    ...checkpointPayload,
    checkpointHash:
      computeAiCooperativeCemSelectionCheckpointHash(checkpointPayload),
  });
  assertValidAiCooperativeCemSelectionCheckpoint(checkpoint);
  if (
    registered &&
    (registeredAttempt === null ||
      persistRegisteredSelectionCheckpoint(
        registeredAttempt,
        checkpoint,
      ) !== "created")
  ) {
    throw new TypeError("selection checkpoint must be persisted exactly once");
  }

  const artifactPayload: AiCooperativeCemSelectionArtifactPayload = {
    formatVersion: AI_COOPERATIVE_CEM_SELECTION_FORMAT_VERSION,
    method: AI_COOPERATIVE_CEM_SELECTION_METHOD,
    registrationId: AI_COOPERATIVE_CEM_SELECTION_REGISTRATION_ID,
    protocolSha256: AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
    implementationSha256:
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
    trainingResultSha256:
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
    executionKind: registered ? "registered" : "injected-test",
    markerHash,
    checkpointHash: checkpoint.checkpointHash,
    rawResultSha256: checkpoint.rawResultSha256,
    candidateId: request.candidateId,
    genome: AI_COOPERATIVE_CEM_TRAINING_RESULT.selected.genome,
    candidateProfileHash: checkpoint.candidateProfileHash,
    benchmark,
    gate,
    rosterFinalScreenEligible:
      registered && benchmark.evidenceUsable && gate.accepted,
  };
  const artifact = deepFreeze({
    ...artifactPayload,
    artifactHash: computeAiCooperativeCemSelectionArtifactHash(artifactPayload),
  });
  assertValidAiCooperativeCemSelectionArtifact(artifact);
  assertAiCooperativeCemSelectionArtifactMatchesCheckpoint(artifact, checkpoint);
  if (
    registered &&
    (registeredAttempt === null ||
      persistRegisteredSelectionArtifact(
        registeredAttempt,
        checkpoint,
        artifact,
      ) !== "created")
  ) {
    throw new TypeError("selection artifact must be persisted exactly once");
  }
  return artifact;
}
