import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

import { AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256 } from "./ai-cooperative-cem-implementation-pin.ts";

export { AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256 } from "./ai-cooperative-cem-implementation-pin.ts";

export const AI_COOPERATIVE_CEM_IMPLEMENTATION_PIN_FORMAT_VERSION = 1 as const;
export const AI_COOPERATIVE_CEM_IMPLEMENTATION_HASH_ALGORITHM =
  "sha256-path-null-normalized-utf8-null-v1" as const;

export const AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS = Object.freeze([
  "scripts/ai-benchmark-scenarios.ts",
  "scripts/ai-cooperative-cem-implementation-integrity.ts",
  "scripts/ai-cooperative-cem-registration.ts",
  "scripts/ai-cooperative-cem.ts",
  "scripts/ai-policy-evolution.ts",
  "scripts/ai-seed-ledger.ts",
  "scripts/ai-training-screen-registration.ts",
  "scripts/benchmark-ai-recruit-planner.ts",
  "scripts/benchmark-ai-policy-suite.ts",
  "scripts/run-ai-cooperative-cem.ts",
] as const);

export const AI_COOPERATIVE_CEM_IMPLEMENTATION_SOURCE_MANIFEST = Object.freeze({
  formatVersion: AI_COOPERATIVE_CEM_IMPLEMENTATION_PIN_FORMAT_VERSION,
  hashAlgorithm: AI_COOPERATIVE_CEM_IMPLEMENTATION_HASH_ALGORITHM,
  gameSources: "recursive-lib-game-ts-json-ascii-path-order" as const,
  lineEndings: "normalize-crlf-and-cr-to-lf" as const,
  scriptPaths: AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS,
  excludedLiteralAnchorPaths: Object.freeze([
    "scripts/ai-cooperative-cem-implementation-pin.ts",
    "scripts/ai-cooperative-cem-protocol-pin.ts",
  ] as const),
});

export const AI_COOPERATIVE_CEM_IMPLEMENTATION_SHA256 =
  AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256;

interface ImplementationSource {
  readonly relativePath: string;
  readonly url: URL;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function collectGameSources(
  directory: URL,
  prefix = "lib/game/",
): ImplementationSource[] {
  const sources: ImplementationSource[] = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => compareAscii(left.name, right.name),
  );
  for (const entry of entries) {
    const relativePath = `${prefix}${entry.name}`;
    const url = new URL(
      entry.isDirectory() ? `${entry.name}/` : entry.name,
      directory,
    );
    if (entry.isDirectory()) {
      sources.push(...collectGameSources(url, `${relativePath}/`));
    } else if (entry.isFile() && /\.(?:json|ts)$/.test(entry.name)) {
      sources.push({ relativePath, url });
    }
  }
  return sources;
}

function implementationSources(): ImplementationSource[] {
  const repositoryRoot = new URL("../", import.meta.url);
  const sources = collectGameSources(new URL("../lib/game/", import.meta.url));
  for (const relativePath of AI_COOPERATIVE_CEM_IMPLEMENTATION_SCRIPT_PATHS) {
    sources.push({ relativePath, url: new URL(relativePath, repositoryRoot) });
  }
  return sources.sort((left, right) =>
    compareAscii(left.relativePath, right.relativePath),
  );
}

function normalizedSource(url: URL): string {
  return readFileSync(url, "utf8").replace(/\r\n?/g, "\n");
}

export function computeAiCooperativeCemImplementationSha256(): string {
  const hash = createHash("sha256");
  hash
    .update(AI_COOPERATIVE_CEM_IMPLEMENTATION_HASH_ALGORITHM)
    .update("\0");
  for (const source of implementationSources()) {
    hash
      .update(source.relativePath)
      .update("\0")
      .update(normalizedSource(source.url), "utf8")
      .update("\0");
  }
  return hash.digest("hex");
}

/** Returns the observed digest after proving it matches the literal anchor. */
export function assertAiCooperativeCemImplementationPinned(): string {
  const observed = computeAiCooperativeCemImplementationSha256();
  if (observed !== AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256) {
    throw new Error(
      `cooperative CEM implementation drifted: expected ${AI_COOPERATIVE_CEM_PINNED_IMPLEMENTATION_SHA256}, received ${observed}`,
    );
  }
  return observed;
}
