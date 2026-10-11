import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { constants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const AUDIT_PATH = "docs/trinket-functional-audit.json";
const SNAPSHOT_PATH =
  "lib/game/generated/battlegrounds-trinkets-36.0.3-247416.zhCN.json";
const EXPECTED_COUNTS = { total: 204, lesser: 98, greater: 106 };
const STATUSES = ["reviewed", "bug", "partial"];
const LIMITATION_KINDS = [
  "none",
  "known-bug",
  "implementation-gap",
  "indirect-unimplemented",
  "verification-gap",
];
const TIERS = ["lesser", "greater"];
const IDENTITY_FIELDS = ["id", "cardId", "name", "tier", "description"];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function loadJson(relativePath) {
  let source;
  try {
    source = readFileSync(path.join(ROOT, relativePath), "utf8");
  } catch {
    throw new Error(`Cannot read ${relativePath}.`);
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`Invalid JSON in ${relativePath}.`);
  }
}

function isInsideRoot(candidate) {
  const relativePath = path.relative(ROOT, candidate);
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}

function validateTestReference(reference, label) {
  // References may include a one-based source line or source-line range.
  const match = /^(tests\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.test\.(?:ts|mjs|js))(?::([1-9]\d*)(?:-([1-9]\d*))?)?$/u.exec(
    reference,
  );
  requireCondition(match !== null, `${label} must reference a test in tests/.`);
  const relativePath = match[1];
  requireCondition(
    relativePath.split("/").every((segment) => segment !== "." && segment !== ".."),
    `${label} must not contain traversal segments.`,
  );
  if (match[2]) {
    requireCondition(
      Number.isSafeInteger(Number(match[2])) &&
        (!match[3] || Number.isSafeInteger(Number(match[3]))),
      `${label} must use safe integer source lines.`,
    );
  }
  if (match[3]) {
    requireCondition(
      Number(match[3]) >= Number(match[2]),
      `${label} has a reversed source-line range.`,
    );
  }
  const candidate = path.resolve(ROOT, relativePath);
  requireCondition(isInsideRoot(candidate), `${label} must stay in the repository.`);
  let resolved;
  let isFile;
  try {
    resolved = realpathSync(candidate);
    isFile = statSync(resolved).isFile();
  } catch {
    throw new Error(`${label} references a missing test file.`);
  }
  requireCondition(
    isInsideRoot(resolved) && isFile,
    `${label} must resolve to a repository test file.`,
  );
}

function validateEvidenceArray(value, label, testReferences = false) {
  requireCondition(
    Array.isArray(value) && value.length > 0,
    `${label} must be a nonempty array.`,
  );
  const seen = new Set();
  for (const [index, reference] of value.entries()) {
    const itemLabel = `${label}[${index}]`;
    requireCondition(isNonemptyString(reference), `${itemLabel} must be nonempty.`);
    requireCondition(!seen.has(reference), `${itemLabel} repeats an evidence reference.`);
    seen.add(reference);
    if (testReferences) validateTestReference(reference, itemLabel);
  }
}

function validateSnapshot(snapshot) {
  requireCondition(isObject(snapshot), "Snapshot must be an object.");
  requireCondition(snapshot.schemaVersion === 1, "Snapshot schemaVersion must be 1.");
  requireCondition(
    snapshot.source?.patch === "36.0.3" &&
      snapshot.source?.build === 247416 &&
      snapshot.source?.locale === "zhCN",
    "Snapshot must use patch 36.0.3, build 247416, and locale zhCN.",
  );
  requireCondition(
    Array.isArray(snapshot.trinkets) && snapshot.trinkets.length === EXPECTED_COUNTS.total,
    "Snapshot must contain exactly 204 trinkets.",
  );
  const byId = new Map();
  const cardIds = new Set();
  const counts = { lesser: 0, greater: 0 };
  for (const [index, trinket] of snapshot.trinkets.entries()) {
    const label = `snapshot.trinkets[${index}]`;
    requireCondition(isObject(trinket), `${label} must be an object.`);
    for (const field of IDENTITY_FIELDS) {
      requireCondition(isNonemptyString(trinket[field]), `${label}.${field} must be nonempty.`);
    }
    requireCondition(!byId.has(trinket.id), `${label}.id must be unique.`);
    requireCondition(!cardIds.has(trinket.cardId), `${label}.cardId must be unique.`);
    requireCondition(TIERS.includes(trinket.tier), `${label}.tier is invalid.`);
    byId.set(trinket.id, trinket);
    cardIds.add(trinket.cardId);
    counts[trinket.tier] += 1;
  }
  for (const tier of TIERS) {
    requireCondition(
      counts[tier] === EXPECTED_COUNTS[tier] &&
        snapshot.counts?.byTier?.[tier] === EXPECTED_COUNTS[tier],
      `Snapshot ${tier} count must be ${EXPECTED_COUNTS[tier]}.`,
    );
  }
  requireCondition(
    snapshot.counts?.soloTrinkets === EXPECTED_COUNTS.total,
    "Snapshot soloTrinkets count must be 204.",
  );
  return byId;
}

function validateAudit(audit, byId) {
  requireCondition(isObject(audit), "Audit must be an object.");
  requireCondition(audit.schemaVersion === 1, "Audit schemaVersion must be 1.");
  requireCondition(
    isNonemptyString(audit.scope) ||
      (isObject(audit.scope) && Object.keys(audit.scope).length > 0),
    "Audit scope must be a nonempty string or object.",
  );
  requireCondition(isObject(audit.summary), "Audit summary must be an object.");
  requireCondition(
    Array.isArray(audit.trinkets) && audit.trinkets.length === EXPECTED_COUNTS.total,
    "Audit must contain exactly 204 trinkets.",
  );
  const seenIds = new Set();
  const counts = { ...EXPECTED_COUNTS, lesser: 0, greater: 0, reviewed: 0, bug: 0, partial: 0 };
  for (const [index, trinket] of audit.trinkets.entries()) {
    const label = `trinkets[${index}]`;
    requireCondition(isObject(trinket), `${label} must be an object.`);
    requireCondition(!seenIds.has(trinket.id), `${label}.id must be unique.`);
    const snapshotTrinket = byId.get(trinket.id);
    requireCondition(snapshotTrinket !== undefined, `${label}.id is absent from the snapshot.`);
    seenIds.add(trinket.id);
    for (const field of IDENTITY_FIELDS) {
      requireCondition(
        trinket[field] === snapshotTrinket[field],
        `${label}.${field} must match the fixed snapshot.`,
      );
    }
    requireCondition(STATUSES.includes(trinket.status), `${label}.status is invalid.`);
    requireCondition(STATUSES.includes(trinket.initialStatus), `${label}.initialStatus is invalid.`);
    requireCondition(
      isNonemptyString(trinket.initialStatusSource),
      `${label}.initialStatusSource must be nonempty.`,
    );
    requireCondition(
      LIMITATION_KINDS.includes(trinket.limitationKind),
      `${label}.limitationKind is invalid.`,
    );
    requireCondition(
      (trinket.status === "reviewed" && trinket.limitationKind === "none") ||
        (trinket.status === "bug" && trinket.limitationKind === "known-bug") ||
        (trinket.status === "partial" &&
          ["implementation-gap", "indirect-unimplemented", "verification-gap"].includes(
            trinket.limitationKind,
          )),
      `${label}.limitationKind must agree with status.`,
    );
    validateEvidenceArray(trinket.implementation, `${label}.implementation`);
    validateEvidenceArray(trinket.tests, `${label}.tests`, true);
    requireCondition(isNonemptyString(trinket.notes), `${label}.notes must be nonempty.`);
    counts[trinket.tier] += 1;
    counts[trinket.status] += 1;
  }
  requireCondition(seenIds.size === byId.size, "Audit must cover every snapshot trinket ID.");
  for (const [field, expected] of Object.entries(counts)) {
    requireCondition(
      Number.isSafeInteger(audit.summary[field]) && audit.summary[field] === expected,
      `summary.${field} must equal the row count (${expected}).`,
    );
  }
  for (const tier of TIERS) {
    requireCondition(
      counts[tier] === EXPECTED_COUNTS[tier],
      `Audit ${tier} count must be ${EXPECTED_COUNTS[tier]}.`,
    );
  }
  return counts;
}

function runTrinketTests() {
  let files;
  try {
    files = readdirSync(path.join(ROOT, "tests"), { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^trinket-.*\.test\.ts$/u.test(entry.name))
      .map((entry) => `tests/${entry.name}`)
      .sort();
  } catch {
    throw new Error("Cannot enumerate tests/trinket-*.test.ts.");
  }
  requireCondition(files.length > 0, "No tests/trinket-*.test.ts files were found.");
  for (const file of files) validateTestReference(file, "Trinket test selection");
  console.log(`Running ${files.length} offline tests/trinket-*.test.ts files.`);
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--test", ...files],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (result.error) {
    throw new Error("Could not start the trinket test process.");
  }
  if (result.signal) {
    const signalCode = constants.signals[result.signal] ?? 1;
    process.exitCode = 128 + signalCode;
    console.error(`Trinket tests terminated by ${result.signal}.`);
    // Preserve signal termination where the host supports it; retain a nonzero fallback.
    try {
      process.kill(process.pid, result.signal);
    } catch {
      return;
    }
    return;
  }
  requireCondition(
    Number.isInteger(result.status) && result.status >= 0,
    "Trinket test process returned no exit status.",
  );
  process.exitCode = result.status;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log("Usage: node scripts/check-trinket-functional-audit.mjs [--test]");
    console.log("Validate the fixed audit offline; --test also runs tests/trinket-*.test.ts.");
    return;
  }
  requireCondition(
    args.length === 0 || (args.length === 1 && args[0] === "--test"),
    "Expected no arguments or --test; use --help for usage.",
  );
  const byId = validateSnapshot(loadJson(SNAPSHOT_PATH));
  const counts = validateAudit(loadJson(AUDIT_PATH), byId);
  console.log(
    `${AUDIT_PATH}: ${counts.total} unique trinkets ` +
      `(${counts.lesser} lesser, ${counts.greater} greater); ` +
      `${counts.reviewed} reviewed, ${counts.bug} bug, ${counts.partial} partial.`,
  );
  console.log("Reviewed means documented review evidence, not exhaustive correctness.");
  if (args[0] === "--test") runTrinketTests();
}

try {
  main();
} catch (error) {
  console.error(`Trinket functional audit failed: ${error.message}`);
  process.exitCode = 1;
}
