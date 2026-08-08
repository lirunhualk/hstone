import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
  assertAiCooperativeCemSelectionSharedClaimAvailable,
  prepareFreshAiCooperativeCemSelectionAttemptPaths,
  type AiCooperativeCemSelectionAttemptPaths,
} from "./ai-cooperative-cem-selection-attempt.ts";
export {
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
  AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
} from "./ai-cooperative-cem-selection-attempt.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256,
  assertAiCooperativeCemSelectionImplementationPinned,
} from "./ai-cooperative-cem-selection-implementation-integrity.ts";
import {
  AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256,
  AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION,
} from "./ai-cooperative-cem-selection-registration.ts";
import {
  assertAiCooperativeCemSelectionNotCompleted,
  assertValidAiCooperativeCemSelectionArtifact,
  runAiCooperativeCemSelection,
  type AiCooperativeCemSelectionArtifact,
} from "./ai-cooperative-cem-selection.ts";
import {
  AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
  readAiCooperativeCemHistoricalTrainingEvidence,
} from "./ai-cooperative-cem-training-evidence.ts";
import {
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
} from "./ai-cooperative-cem-training-result.ts";
import { canonicalAiPolicyEvolutionJson } from "./ai-policy-evolution.ts";

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));

export const AI_COOPERATIVE_CEM_SELECTION_CLI_USAGE = [
  "Registered cooperative CEM selection requires every explicit capability:",
  "  --run-registered-selection run-registered-cooperative-cem-power-level-selection-v1",
  "  --protocol-sha256 <registered selection protocol SHA-256>",
  "  --implementation-sha256 <registered selection implementation SHA-256>",
  "  --training-result-sha256 <pinned training result SHA-256>",
  `  --checkpoint-dir ${AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY}`,
  `  --output ${AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH}`,
  "Selection is fresh-only; marker, checkpoint, and artifact paths must not exist.",
].join("\n");

export interface AiCooperativeCemSelectionCliConfiguration {
  readonly confirmation: typeof AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION;
  readonly protocolSha256: typeof AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256;
  readonly implementationSha256: typeof AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256;
  readonly trainingResultSha256: typeof AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256;
  readonly checkpointDirectory: string;
  readonly outputPath: string;
}

export type AiCooperativeCemSelectionCliPreflight =
  AiCooperativeCemSelectionAttemptPaths;

function requireValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new TypeError(`${flag} requires one value`);
  }
  return value;
}

function assertExactSelectionCapability(
  configuration: AiCooperativeCemSelectionCliConfiguration,
): void {
  if (
    configuration.confirmation !==
      AI_COOPERATIVE_CEM_SELECTION_RUN_CONFIRMATION
  ) {
    throw new TypeError("registered cooperative CEM selection confirmation mismatch");
  }
  if (
    configuration.protocolSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_PROTOCOL_SHA256
  ) {
    throw new TypeError("registered cooperative CEM selection protocol hash mismatch");
  }
  if (
    configuration.implementationSha256 !==
      AI_COOPERATIVE_CEM_SELECTION_IMPLEMENTATION_SHA256
  ) {
    throw new TypeError(
      "registered cooperative CEM selection implementation hash mismatch",
    );
  }
  if (
    configuration.trainingResultSha256 !==
      AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256
  ) {
    throw new TypeError(
      "registered cooperative CEM selection training result hash mismatch",
    );
  }
}

function assertExactSelectionClaimPaths(
  configuration: AiCooperativeCemSelectionCliConfiguration,
  repositoryRoot: string,
): void {
  if (
    resolve(configuration.checkpointDirectory) !==
      resolve(
        repositoryRoot,
        AI_COOPERATIVE_CEM_SELECTION_REGISTERED_CHECKPOINT_DIRECTORY,
      ) ||
    resolve(configuration.outputPath) !==
      resolve(
        repositoryRoot,
        AI_COOPERATIVE_CEM_SELECTION_REGISTERED_OUTPUT_PATH,
      )
  ) {
    throw new RangeError(
      "registered cooperative CEM selection paths must claim the one fixed reservation directory and artifact",
    );
  }
}

export function parseAiCooperativeCemSelectionCliArguments(
  argv: readonly string[],
  workingDirectory = process.cwd(),
): AiCooperativeCemSelectionCliConfiguration {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (
      flag !== "--run-registered-selection" &&
      flag !== "--protocol-sha256" &&
      flag !== "--implementation-sha256" &&
      flag !== "--training-result-sha256" &&
      flag !== "--checkpoint-dir" &&
      flag !== "--output"
    ) {
      throw new TypeError(
        `unknown cooperative CEM selection argument ${String(flag)}`,
      );
    }
    if (values.has(flag)) {
      throw new TypeError(`${flag} may only be supplied once`);
    }
    values.set(flag, requireValue(argv, index, flag));
    index += 1;
  }

  const confirmation = values.get("--run-registered-selection");
  const protocolSha256 = values.get("--protocol-sha256");
  const implementationSha256 = values.get("--implementation-sha256");
  const trainingResultSha256 = values.get("--training-result-sha256");
  const checkpointDirectory = values.get("--checkpoint-dir");
  const outputPath = values.get("--output");
  if (
    confirmation === undefined ||
    protocolSha256 === undefined ||
    implementationSha256 === undefined ||
    trainingResultSha256 === undefined ||
    checkpointDirectory === undefined ||
    outputPath === undefined
  ) {
    throw new TypeError(
      `incomplete cooperative CEM selection capability\n${AI_COOPERATIVE_CEM_SELECTION_CLI_USAGE}`,
    );
  }

  const configuration = {
    confirmation,
    protocolSha256,
    implementationSha256,
    trainingResultSha256,
    checkpointDirectory: resolve(workingDirectory, checkpointDirectory),
    outputPath: resolve(workingDirectory, outputPath),
  } as AiCooperativeCemSelectionCliConfiguration;
  assertExactSelectionCapability(configuration);
  assertExactSelectionClaimPaths(configuration, workingDirectory);
  return Object.freeze(configuration);
}

/**
 * Verifies capability and immutable historical evidence before creating any
 * output directory. A custom evidence directory is accepted only so tests can
 * verify the real pinned bytes while using a disposable repository root.
 */
export function preflightAiCooperativeCemSelectionCli(
  configuration: AiCooperativeCemSelectionCliConfiguration,
  repositoryRoot = REPOSITORY_ROOT,
  historicalEvidenceDirectory = resolve(
    repositoryRoot,
    AI_COOPERATIVE_CEM_TRAINING_EVIDENCE_RELATIVE_DIRECTORY,
  ),
): AiCooperativeCemSelectionCliPreflight {
  assertAiCooperativeCemSelectionNotCompleted();
  assertExactSelectionCapability(configuration);

  const resolvedRepositoryRoot = resolve(repositoryRoot);
  assertExactSelectionClaimPaths(configuration, resolvedRepositoryRoot);
  assertAiCooperativeCemSelectionSharedClaimAvailable(
    resolvedRepositoryRoot,
  );
  assertAiCooperativeCemSelectionImplementationPinned();
  readAiCooperativeCemHistoricalTrainingEvidence(
    resolve(historicalEvidenceDirectory),
  );
  return prepareFreshAiCooperativeCemSelectionAttemptPaths(
    resolvedRepositoryRoot,
  );
}

export function runAiCooperativeCemSelectionCli(
  configuration: AiCooperativeCemSelectionCliConfiguration,
  report: (message: string) => void = () => undefined,
): AiCooperativeCemSelectionArtifact {
  assertAiCooperativeCemSelectionNotCompleted();
  preflightAiCooperativeCemSelectionCli(
    configuration,
    REPOSITORY_ROOT,
  );
  const artifact = runAiCooperativeCemSelection({
    authorization: {
      confirmation: configuration.confirmation,
      protocolSha256: configuration.protocolSha256,
      implementationSha256: configuration.implementationSha256,
      trainingResultSha256: configuration.trainingResultSha256,
    },
  });
  assertValidAiCooperativeCemSelectionArtifact(artifact);
  report(
    "registered cooperative CEM selection marker, checkpoint, and artifact were persisted by the fixed attempt",
  );
  return artifact;
}

export function mainAiCooperativeCemSelectionCli(
  argv: readonly string[] = process.argv.slice(2),
): void {
  if (argv.length === 1 && argv[0] === "--help") {
    process.stdout.write(`${AI_COOPERATIVE_CEM_SELECTION_CLI_USAGE}\n`);
    return;
  }
  assertAiCooperativeCemSelectionNotCompleted();
  const configuration = parseAiCooperativeCemSelectionCliArguments(
    argv,
    REPOSITORY_ROOT,
  );
  const artifact = runAiCooperativeCemSelectionCli(
    configuration,
    (message) => process.stderr.write(`${message}\n`),
  );
  process.stdout.write(
    `${canonicalAiPolicyEvolutionJson({
      artifactHash: artifact.artifactHash,
      checkpointHash: artifact.checkpointHash,
      gateAccepted: artifact.gate.accepted,
      output: configuration.outputPath,
      rosterFinalScreenEligible: artifact.rosterFinalScreenEligible,
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
    mainAiCooperativeCemSelectionCli();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
