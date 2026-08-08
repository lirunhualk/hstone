import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import {
  AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST,
  assertAiCooperativeCemImplementationPinned,
} from "./ai-cooperative-cem-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_REGISTRATION_ID,
  canonicalAiCooperativeCemProtocolJson,
} from "./ai-cooperative-cem-registration.ts";
import {
  assertAiCooperativeCemRegisteredCheckpointPrefix,
  assertValidAiCooperativeCemRegisteredRunMarker,
  assertValidAiCooperativeCemTrainingArtifact,
  type AiCooperativeCemRegisteredRunMarker as LiveRunMarker,
  type AiCooperativeCemRegisteredSearchCheckpoint as LiveCheckpoint,
  type AiCooperativeCemTrainingArtifact as LiveArtifact,
} from "./ai-cooperative-cem.ts";
import {
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_BUNDLE_FILENAME,
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_FORMAT_VERSION,
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FILENAME,
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
  assertAiCooperativeCemHistoricalTrainingEvidence,
  computeAiCooperativeCemTrainingEvidenceManifestSha256,
  createAiCooperativeCemTrainingEvidenceManifest,
  type AiCooperativeCemArchivedSource,
  type AiCooperativeCemRegisteredRunMarker,
  type AiCooperativeCemRegisteredSearchCheckpoint,
  type AiCooperativeCemTrainingArtifact,
  type AiCooperativeCemTrainingEvidenceBundle,
  type AiCooperativeCemTrainingEvidenceManifest,
} from "./ai-cooperative-cem-training-evidence.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";

const CHECKPOINT_FILENAME_PATTERN = /^candidate-(\d{3})\.json$/;

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedSource(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
}

function collectGameSourcePaths(
  repositoryRoot: string,
  directory = resolve(repositoryRoot, "lib/game"),
): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => compareAscii(left.name, right.name),
  )) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectGameSourcePaths(repositoryRoot, absolutePath));
    } else if (entry.isFile() && /\.(?:json|ts)$/.test(entry.name)) {
      result.push(absolutePath);
    }
  }
  return result;
}

function archiveSource(
  repositoryRoot: string,
  absolutePath: string,
): AiCooperativeCemArchivedSource {
  return {
    relativePath: relative(repositoryRoot, absolutePath).replace(/\\/g, "/"),
    normalizedUtf8: normalizedSource(absolutePath),
  };
}

function implementationSourceSnapshot(
  repositoryRoot: string,
): AiCooperativeCemArchivedSource[] {
  const absolutePaths = [
    ...collectGameSourcePaths(repositoryRoot),
    ...AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST.scriptPaths.map(
      (path) => resolve(repositoryRoot, path),
    ),
  ];
  const paths = new Set<string>();
  const sources = absolutePaths
    .map((path) => archiveSource(repositoryRoot, path))
    .sort((left, right) => compareAscii(left.relativePath, right.relativePath));
  for (const source of sources) {
    if (paths.has(source.relativePath)) {
      throw new TypeError(`duplicate implementation source ${source.relativePath}`);
    }
    paths.add(source.relativePath);
  }
  return sources;
}

function literalAnchorSnapshot(
  repositoryRoot: string,
): AiCooperativeCemArchivedSource[] {
  return AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST.excludedLiteralAnchorPaths
    .map((path) => archiveSource(repositoryRoot, resolve(repositoryRoot, path)))
    .sort((left, right) => compareAscii(left.relativePath, right.relativePath));
}

function readJson(path: string, label: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`failed to read ${label} at ${path}`, { cause: error });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new TypeError(`${label} is not valid JSON`, { cause: error });
  }
}

function checkpointPaths(checkpointDirectory: string): string[] {
  const entries = readdirSync(checkpointDirectory, { withFileTypes: true });
  const candidates = entries
    .filter(
      (entry) => entry.isFile() && CHECKPOINT_FILENAME_PATTERN.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort(compareAscii);
  const unexpectedJson = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".json") &&
      entry.name !== "run-attempt.json" &&
      !CHECKPOINT_FILENAME_PATTERN.test(entry.name),
  );
  if (unexpectedJson.length > 0) {
    throw new TypeError(
      `unexpected checkpoint JSON files: ${unexpectedJson.map((entry) => entry.name).join(", ")}`,
    );
  }
  return candidates.map((name, index) => {
    const match = CHECKPOINT_FILENAME_PATTERN.exec(name);
    if (match === null || Number(match[1]) !== index) {
      throw new TypeError(`checkpoint filenames must be contiguous at ${index}`);
    }
    return resolve(checkpointDirectory, name);
  });
}

export function createAiCooperativeCemTrainingEvidenceBundle(
  repositoryRoot: string,
  runDirectory: string,
): AiCooperativeCemTrainingEvidenceBundle {
  const implementationSha256 = assertAiCooperativeCemImplementationPinned();
  const liveArtifact = readJson(
    resolve(runDirectory, "artifact.json"),
    "cooperative CEM artifact",
  ) as LiveArtifact;
  const checkpointDirectory = resolve(runDirectory, "checkpoints");
  const liveRunMarker = readJson(
    resolve(checkpointDirectory, "run-attempt.json"),
    "cooperative CEM run marker",
  ) as LiveRunMarker;
  const liveCheckpoints = checkpointPaths(checkpointDirectory).map(
    (path) => readJson(path, "cooperative CEM checkpoint") as LiveCheckpoint,
  );

  assertValidAiCooperativeCemRegisteredRunMarker(liveRunMarker);
  assertAiCooperativeCemRegisteredCheckpointPrefix(liveCheckpoints);
  assertValidAiCooperativeCemTrainingArtifact(liveArtifact);
  if (liveArtifact.candidateEvaluations.length !== liveCheckpoints.length) {
    throw new TypeError("artifact and checkpoint counts differ");
  }

  const artifact = liveArtifact as unknown as AiCooperativeCemTrainingArtifact;
  const runMarker =
    liveRunMarker as unknown as AiCooperativeCemRegisteredRunMarker;
  const checkpoints =
    liveCheckpoints as unknown as readonly AiCooperativeCemRegisteredSearchCheckpoint[];
  return {
    formatVersion: AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_FORMAT_VERSION,
    registrationId: AI_COOPERATIVE_CEM_REGISTRATION_ID,
    sourceSnapshot: {
      implementationSha256,
      implementationManifest: AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST,
      sources: implementationSourceSnapshot(repositoryRoot),
      literalAnchors: literalAnchorSnapshot(repositoryRoot),
      protocolSha256: AI_COOPERATIVE_CEM_PROTOCOL_SHA256,
      protocolCanonicalJson: canonicalAiCooperativeCemProtocolJson(),
    },
    runMarker,
    artifact,
    checkpoints,
  };
}

function writeOnce(path: string, value: string | Uint8Array): void {
  if (existsSync(path)) {
    const current = readFileSync(path);
    const expected =
      typeof value === "string"
        ? Buffer.from(value, "utf8")
        : Buffer.from(value);
    if (!current.equals(expected)) {
      throw new Error(`refusing to overwrite conflicting evidence file ${path}`);
    }
    return;
  }
  writeFileSync(path, value, { flag: "wx" });
}

export function archiveAiCooperativeCemTrainingEvidence(
  repositoryRoot: string,
  runDirectory: string,
  evidenceDirectory: string,
): AiCooperativeCemTrainingEvidenceManifest {
  const bundle = createAiCooperativeCemTrainingEvidenceBundle(
    repositoryRoot,
    runDirectory,
  );
  const canonicalPayload = canonicalAiPolicyEvolutionJson(bundle);
  const compressed = gzipSync(Buffer.from(canonicalPayload, "utf8"), {
    level: 9,
  });
  if (
    compressed[4] !== 0 ||
    compressed[5] !== 0 ||
    compressed[6] !== 0 ||
    compressed[7] !== 0
  ) {
    throw new Error("runtime produced a non-deterministic gzip mtime");
  }
  const manifest = createAiCooperativeCemTrainingEvidenceManifest(
    bundle,
    canonicalPayload,
    compressed,
  );
  assertAiCooperativeCemHistoricalTrainingEvidence(
    bundle,
    manifest,
    canonicalPayload,
    compressed,
  );
  const evidenceRoot = resolve(evidenceDirectory);
  const repository = resolve(repositoryRoot);
  const repositoryRelativeEvidence = relative(repository, evidenceRoot);
  if (
    repositoryRelativeEvidence.length === 0 ||
    repositoryRelativeEvidence === ".." ||
    repositoryRelativeEvidence.startsWith(`..\\`) ||
    repositoryRelativeEvidence.startsWith("../") ||
    isAbsolute(repositoryRelativeEvidence)
  ) {
    throw new Error("evidence directory must be a nested repository path");
  }
  mkdirSync(evidenceRoot, { recursive: true });
  writeOnce(
    resolve(
      evidenceRoot,
      AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_BUNDLE_FILENAME,
    ),
    compressed,
  );
  writeOnce(
    resolve(
      evidenceRoot,
      AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_MANIFEST_FILENAME,
    ),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export function mainAiCooperativeCemTrainingEvidenceArchive(): void {
  const repositoryRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
  const runDirectory = resolve(
    repositoryRoot,
    "outputs/ai-cooperative-cem/power-level-v1-93010001",
  );
  const evidenceDirectory = resolve(
    repositoryRoot,
    AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
  );
  if (!statSync(runDirectory).isDirectory()) {
    throw new Error(`training output directory is missing: ${runDirectory}`);
  }
  const manifest = archiveAiCooperativeCemTrainingEvidence(
    repositoryRoot,
    runDirectory,
    evidenceDirectory,
  );
  process.stdout.write(
    `${canonicalAiPolicyEvolutionJson({
      blobSha256: manifest.bundle.blobSha256,
      compressedBytes: manifest.bundle.compressedBytes,
      evidenceDirectory,
      manifestSha256:
        computeAiCooperativeCemTrainingEvidenceManifestSha256(manifest),
      payloadSha256: manifest.bundle.payloadSha256,
    })}\n`,
  );
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    pathToFileURL(resolve(entry)).href === import.meta.url
  );
}

if (isDirectExecution()) {
  try {
    mainAiCooperativeCemTrainingEvidenceArchive();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
