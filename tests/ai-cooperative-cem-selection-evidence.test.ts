import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { canonicalHistoricalJsonV1 } from "../scripts/ai-historical-canonical-json-v1.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_RELATIVE_DIRECTORY,
  assertAiCooperativeCemHistoricalSelectionEvidence,
  assertAiCooperativeCemHistoricalSelectionEvidenceMatchesPinnedResult,
  readAiCooperativeCemHistoricalSelectionEvidence,
} from "../scripts/ai-cooperative-cem-selection-evidence.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_RESULT,
  computeAiCooperativeCemSelectionResultSha256,
} from "../scripts/ai-cooperative-cem-selection-result.ts";

interface MutableRecord {
  [key: string]: unknown;
}

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const EVIDENCE_DIRECTORY = resolve(
  REPOSITORY_ROOT,
  AI_COOPERATIVE_CEM_SELECTION_EVIDENCE_RELATIVE_DIRECTORY,
);

function record(value: unknown, label: string): MutableRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as MutableRecord;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalFileEntry(value: unknown) {
  const canonicalPayload = canonicalHistoricalJsonV1(value);
  const fileBytes = Buffer.from(`${canonicalPayload}\n`, "utf8");
  return {
    fileBytes: fileBytes.byteLength,
    fileSha256: sha256(fileBytes),
    canonicalPayloadBytes: Buffer.byteLength(canonicalPayload, "utf8"),
    canonicalPayloadSha256: sha256(canonicalPayload),
  };
}

function hashWithout(value: MutableRecord, property: string): string {
  const payload = { ...value };
  delete payload[property];
  return sha256(canonicalHistoricalJsonV1(payload));
}

function createOuterResignedComparisonTamper() {
  const historical = readAiCooperativeCemHistoricalSelectionEvidence(
    EVIDENCE_DIRECTORY,
  );
  const bundle = structuredClone(historical.bundle) as MutableRecord;
  const manifest = structuredClone(historical.manifest) as MutableRecord;
  const runEvidence = record(bundle.runEvidence, "runEvidence");
  const checkpoint = record(
    record(runEvidence.checkpoint, "checkpointEntry").value,
    "checkpoint",
  );
  const artifact = record(
    record(runEvidence.artifact, "artifactEntry").value,
    "artifact",
  );
  const raw = record(checkpoint.rawBenchmarkResult, "rawBenchmarkResult");
  const rawComparisons = record(raw.comparisons, "raw.comparisons");
  const rawOverallWin = record(rawComparisons.win, "raw.comparisons.win");
  const matrix = record(raw.comparisonMatrix, "raw.comparisonMatrix");
  const matrixOverall = record(matrix.overall, "raw.comparisonMatrix.overall");
  const matrixOverallWin = record(matrixOverall.win, "matrix.overall.win");
  const checkpointBenchmark = record(checkpoint.benchmark, "checkpoint.benchmark");
  const checkpointOverall = record(
    checkpointBenchmark.overall,
    "checkpoint.benchmark.overall",
  );
  const checkpointOverallWin = record(
    checkpointOverall.win,
    "checkpoint.benchmark.overall.win",
  );
  const artifactBenchmark = record(artifact.benchmark, "artifact.benchmark");
  const artifactOverall = record(
    artifactBenchmark.overall,
    "artifact.benchmark.overall",
  );
  const artifactOverallWin = record(
    artifactOverall.win,
    "artifact.benchmark.overall.win",
  );

  for (const metric of [
    rawOverallWin,
    matrixOverallWin,
    checkpointOverallWin,
    artifactOverallWin,
  ]) {
    metric.meanDelta = 0.003;
  }

  const rawResultSha256 = sha256(canonicalHistoricalJsonV1(raw));
  checkpoint.rawResultSha256 = rawResultSha256;
  checkpointBenchmark.rawResultSha256 = rawResultSha256;
  artifact.rawResultSha256 = rawResultSha256;
  artifactBenchmark.rawResultSha256 = rawResultSha256;
  checkpoint.checkpointHash = hashWithout(checkpoint, "checkpointHash");
  artifact.checkpointHash = checkpoint.checkpointHash;
  artifact.artifactHash = hashWithout(artifact, "artifactHash");

  const canonicalPayload = canonicalHistoricalJsonV1(bundle);
  const compressed = gzipSync(Buffer.from(canonicalPayload, "utf8"), {
    level: 9,
  });
  const manifestBundle = record(manifest.bundle, "manifest.bundle");
  manifestBundle.uncompressedBytes = Buffer.byteLength(canonicalPayload, "utf8");
  manifestBundle.compressedBytes = compressed.byteLength;
  manifestBundle.payloadSha256 = sha256(canonicalPayload);
  manifestBundle.blobSha256 = sha256(compressed);

  const manifestCheckpoint = record(
    manifest.checkpoint,
    "manifest.checkpoint",
  );
  Object.assign(manifestCheckpoint, canonicalFileEntry(checkpoint));
  manifestCheckpoint.checkpointHash = checkpoint.checkpointHash;
  manifestCheckpoint.rawBenchmarkResult = {
    includedInBundle: true,
    canonicalPayloadBytes: Buffer.byteLength(
      canonicalHistoricalJsonV1(raw),
      "utf8",
    ),
    canonicalPayloadSha256: rawResultSha256,
    registeredRawResultSha256: rawResultSha256,
  };
  const manifestArtifact = record(manifest.artifact, "manifest.artifact");
  Object.assign(manifestArtifact, canonicalFileEntry(artifact));
  manifestArtifact.artifactHash = artifact.artifactHash;
  manifestArtifact.checkpointHash = checkpoint.checkpointHash;
  manifestArtifact.rawResultSha256 = rawResultSha256;

  return { bundle, manifest, canonicalPayload, compressed };
}

test("selection result is immutable and contains all seven complete profile summaries", () => {
  assert.equal(
    computeAiCooperativeCemSelectionResultSha256(),
    AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256,
  );
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_RESULT.resultSha256,
    AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256,
  );
  assert.equal(AI_COOPERATIVE_CEM_SELECTION_RESULT.status, "completed-gate-rejected");
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_RESULT.resultRegistrationId,
    "cooperative-cem-power-level-selection-result-93100001-v1",
  );
  assert.equal(AI_COOPERATIVE_CEM_SELECTION_RESULT.rosterFinalScreenEligible, false);
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_RESULT.selectionSeeds.ledgerRegistrationStatus,
    "consumed",
  );
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_RESULT.selectionSeeds.consumedLedgerEntryId,
    "cooperative-cem-power-level-selection-93100001-consumed-v1",
  );
  assert.equal(
    AI_COOPERATIVE_CEM_SELECTION_RESULT.upstreamTraining.evaluatorHash,
    "a297f431dadf32e6626c876ccd3390fd8830e7fb9cc1f2bfe8a5084863eec7aa",
  );
  const byProfile = AI_COOPERATIVE_CEM_SELECTION_RESULT.benchmark.byProfile;
  assert.deepEqual(Object.keys(byProfile).sort(), [
    "balanced",
    "deathrattle",
    "economy",
    "magnetic",
    "powerLevel",
    "tempo",
    "triple",
  ]);
  for (const profile of Object.values(byProfile)) {
    assert.deepEqual(Object.keys(profile).sort(), ["placement", "topFour", "win"]);
  }
});

test("pure historical reader verifies the immutable archive and pinned result", () => {
  const historical = readAiCooperativeCemHistoricalSelectionEvidence(
    EVIDENCE_DIRECTORY,
  );
  assert.equal(
    historical.manifest.bundle.blobSha256,
    AI_COOPERATIVE_CEM_SELECTION_RESULT.archive.bundleBlobSha256,
  );
  assert.equal(
    record(
      record(historical.bundle.runEvidence, "runEvidence").artifact,
      "artifactEntry",
    ).relativePath,
    "outputs/ai-cooperative-cem-selection/cooperative-cem-power-level-selection-93100001-v1/selection-artifact.json",
  );
});

test("historical reader imports no live selection, benchmark, ledger, or game module", () => {
  const allowedImports = new Map<string, readonly string[]>([
    [
      "scripts/ai-cooperative-cem-selection-evidence.ts",
      [
        "node:crypto",
        "node:fs",
        "node:path",
        "node:zlib",
        "./ai-historical-canonical-json-v1.ts",
        "./ai-cooperative-cem-selection-result.ts",
      ],
    ],
    [
      "scripts/ai-cooperative-cem-selection-result.ts",
      ["node:crypto", "./ai-historical-canonical-json-v1.ts"],
    ],
    ["scripts/ai-historical-canonical-json-v1.ts", []],
  ]);
  for (const [relativePath, expectedImports] of allowedImports) {
    const source = readFileSync(resolve(REPOSITORY_ROOT, relativePath), "utf8");
    assert.doesNotMatch(
      source,
      /\b(?:import\s*\(|require\s*\()/,
      `${relativePath} must not use dynamic imports or require`,
    );
    const imports = [
      ...source.matchAll(/\b(?:from|import)\s*["']([^"']+)["']/g),
    ].map((match) => match[1]);
    assert.deepEqual(imports, expectedImports, relativePath);
  }
});

test("ordinary tampering is rejected by the archive self-consistency layer", () => {
  const historical = readAiCooperativeCemHistoricalSelectionEvidence(
    EVIDENCE_DIRECTORY,
  );
  const tampered = structuredClone(historical.bundle) as MutableRecord;
  record(
    record(
      record(tampered.runEvidence, "runEvidence").artifact,
      "artifactEntry",
    ).value,
    "artifact",
  ).rosterFinalScreenEligible = true;
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalSelectionEvidence(
        tampered,
        historical.manifest,
        historical.canonicalPayload,
        historical.compressed,
      ),
    /payload is not canonical JSON/,
  );
});

test("outer re-signing can remain self-consistent but cannot replace the pinned result", () => {
  const resigned = createOuterResignedComparisonTamper();
  assert.doesNotThrow(() =>
    assertAiCooperativeCemHistoricalSelectionEvidence(
      resigned.bundle,
      resigned.manifest,
      resigned.canonicalPayload,
      resigned.compressed,
    ),
  );
  assert.throws(
    () =>
      assertAiCooperativeCemHistoricalSelectionEvidenceMatchesPinnedResult(
        resigned.bundle,
        resigned.manifest,
      ),
    /pinned selection archive mismatch/,
  );
});
