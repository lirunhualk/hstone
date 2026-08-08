import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
  assertAiCooperativeCemHistoricalTrainingEvidence,
  assertAiCooperativeCemHistoricalTrainingEvidenceMatchesPinnedResult,
  computeAiCooperativeCemTrainingEvidenceManifestSha256,
  createAiCooperativeCemTrainingEvidenceManifest,
  readAiCooperativeCemHistoricalTrainingEvidence,
} from "../scripts/ai-cooperative-cem-training-evidence.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  AI_COOPERATIVE_CEM_TRAINING_RESULT,
  computeAiCooperativeCemTrainingResultSha256,
} from "../scripts/ai-cooperative-cem-training-result.ts";
import { canonicalAiPolicyEvolutionJson } from "../scripts/ai-policy-evolution.ts";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const EVIDENCE_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
);

test("historical evidence reader is independent of live CEM registrations", () => {
  const readerSource = readFileSync(
    resolve(
      REPOSITORY_ROOT,
      "scripts/ai-cooperative-cem-training-evidence.ts",
    ),
    "utf8",
  );
  for (const forbiddenImport of [
    'from "./ai-cooperative-cem.ts"',
    'from "./benchmark-ai-policy-suite.ts"',
    'from "./ai-seed-ledger.ts"',
    'from "./ai-cooperative-cem-registration.ts"',
    'from "./ai-cooperative-cem-implementation-integrity.ts"',
    'from "./ai-cooperative-cem-implementation-pin.ts"',
    'from "./ai-cooperative-cem-protocol-pin.ts"',
  ]) {
    assert.equal(readerSource.includes(forbiddenImport), false, forbiddenImport);
  }
  assert.doesNotThrow(() =>
    readAiCooperativeCemHistoricalTrainingEvidence(EVIDENCE_DIRECTORY),
  );
});

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test("registered cooperative CEM training result is pinned and raw-evidence bound", () => {
  assert.equal(
    computeAiCooperativeCemTrainingResultSha256(),
    AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  );
  assert.equal(
    AI_COOPERATIVE_CEM_TRAINING_RESULT.resultSha256,
    AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
  );
  assertDeepFrozen(AI_COOPERATIVE_CEM_TRAINING_RESULT);

  const archived = readAiCooperativeCemHistoricalTrainingEvidence(
    EVIDENCE_DIRECTORY,
  );
  const { archive, evidence, selected, trainingSeeds } =
    AI_COOPERATIVE_CEM_TRAINING_RESULT;
  assert.equal(archived.manifest.bundle.payloadSha256, archive.bundlePayloadSha256);
  assert.equal(archived.manifest.bundle.blobSha256, archive.bundleBlobSha256);
  assert.equal(
    computeAiCooperativeCemTrainingEvidenceManifestSha256(archived.manifest),
    archive.manifestSha256,
  );
  assert.equal(archived.manifest.artifactHash, evidence.artifactHash);
  assert.equal(
    archived.manifest.evolutionArtifactHash,
    evidence.evolutionArtifactHash,
  );
  assert.equal(archived.manifest.runMarkerHash, evidence.registeredRunMarkerHash);
  assert.equal(archived.manifest.checkpoints.length, 32);
  assert.deepEqual(
    archived.manifest.checkpoints.map((checkpoint) => checkpoint.checkpointHash),
    evidence.checkpointHashes,
  );
  assert.deepEqual(archived.manifest.selected, {
    sequenceIndex: selected.checkpointSequenceIndex,
    candidateId: selected.candidateId,
    checkpointHash: selected.checkpointHash,
    checkpointCanonicalSha256: selected.checkpointCanonicalSha256,
    evaluationRecordHash: selected.evaluationRecordHash,
    rawResultSha256: selected.rawResultSha256,
  });
  assert.equal(trainingSeeds.dispositionAfterRun, "consumed");
  assert.equal(
    AI_COOPERATIVE_CEM_TRAINING_RESULT.nextPhases.independentSelection.disposition,
    "sealed",
  );
  assert.equal(
    AI_COOPERATIVE_CEM_TRAINING_RESULT.nextPhases.rosterFinal.disposition,
    "sealed",
  );
  assert.equal(AI_COOPERATIVE_CEM_TRAINING_RESULT.production.promoted, false);
});

test("historical verifier rejects raw-result tampering with recomputed outer hashes", () => {
  const archived = readAiCooperativeCemHistoricalTrainingEvidence(
    EVIDENCE_DIRECTORY,
  );
  const first = archived.bundle.checkpoints[0];
  const tamperedCheckpointPayload = {
    ...first,
    rawBenchmarkResult: {
      ...first.rawBenchmarkResult,
      accepted: !first.rawBenchmarkResult.accepted,
    },
  };
  const { checkpointHash: _checkpointHash, ...checkpointPayload } =
    tamperedCheckpointPayload;
  void _checkpointHash;
  const tamperedCheckpoint = {
    ...checkpointPayload,
    checkpointHash: createHash("sha256")
      .update(canonicalAiPolicyEvolutionJson(checkpointPayload))
      .digest("hex"),
  };
  const tamperedBundle = {
    ...archived.bundle,
    checkpoints: [tamperedCheckpoint, ...archived.bundle.checkpoints.slice(1)],
  };
  const canonicalPayload = canonicalAiPolicyEvolutionJson(tamperedBundle);
  const compressed = gzipSync(Buffer.from(canonicalPayload, "utf8"), { level: 9 });
  const manifest = createAiCooperativeCemTrainingEvidenceManifest(
    tamperedBundle,
    canonicalPayload,
    compressed,
  );
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalTrainingEvidence(
        tamperedBundle,
        manifest,
        canonicalPayload,
        compressed,
      ),
    /raw result hash mismatch/,
  );
});

test("pinned-result verifier rejects a self-consistent re-signed evidence bundle", () => {
  const archived = readAiCooperativeCemHistoricalTrainingEvidence(
    EVIDENCE_DIRECTORY,
  );
  const [firstAnchor, ...otherAnchors] =
    archived.bundle.sourceSnapshot.literalAnchors;
  assert.ok(firstAnchor);
  const tamperedBundle = {
    ...archived.bundle,
    sourceSnapshot: {
      ...archived.bundle.sourceSnapshot,
      literalAnchors: [
        { ...firstAnchor, normalizedUtf8: `${firstAnchor.normalizedUtf8}\n` },
        ...otherAnchors,
      ],
    },
  };
  const canonicalPayload = canonicalAiPolicyEvolutionJson(tamperedBundle);
  const compressed = gzipSync(Buffer.from(canonicalPayload, "utf8"), { level: 9 });
  const manifest = createAiCooperativeCemTrainingEvidenceManifest(
    tamperedBundle,
    canonicalPayload,
    compressed,
  );
  assert.doesNotThrow(() =>
    assertAiCooperativeCemHistoricalTrainingEvidence(
      tamperedBundle,
      manifest,
      canonicalPayload,
      compressed,
    ),
  );
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalTrainingEvidenceMatchesPinnedResult(
        tamperedBundle,
        manifest,
      ),
    /does not match the pinned result registration/,
  );
});
