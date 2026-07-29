import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PATCH = "36.0.3";
const BUILD = 247416;
const LOCALE = "zhCN";
const CUTOFF_DATE = "2026-07-27";
const SOURCE_URL =
  `https://api.hearthstonejson.com/v1/${BUILD}/${LOCALE}/cards.json`;
const SOURCE_SHA256 =
  "5E48186C2E1702B474088958978D560026A6CDC3990F181CAB790D42A7727013";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(
  ROOT,
  "lib",
  "game",
  "generated",
  `battlegrounds-${PATCH}-${BUILD}.${LOCALE}.json`,
);

const EXPECTED_COUNTS = Object.freeze({
  rawPoolMinions: 278,
  duosExcluded: 29,
  soloPoolMinions: 249,
  tierSevenExcluded: 12,
  snapshotMinions: 237,
  byTier: Object.freeze({
    1: 22,
    2: 32,
    3: 41,
    4: 50,
    5: 57,
    6: 35,
  }),
});
const EXPECTED_TAVERN_SPELL_COUNTS = Object.freeze({
  rawPoolSpells: 72,
  duosExcluded: 3,
  soloPoolSpells: 69,
  tierSevenExcluded: 4,
  snapshotSpells: 65,
  byTier: Object.freeze({
    1: 8,
    2: 6,
    3: 16,
    4: 16,
    5: 14,
    6: 5,
  }),
});
const DUOS_TAVERN_SPELL_IDS = new Set([
  "BG31_242",
  "BG31_243",
  "BG31_244",
]);

function fail(message) {
  throw new Error(`Battlegrounds data validation failed: ${message}`);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function parseSourceFileArgument() {
  const index = process.argv.indexOf("--source");
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    fail("--source requires a JSON file path");
  }
  return path.resolve(value);
}

async function loadSourceBytes() {
  const sourceFile = parseSourceFileArgument();
  if (sourceFile) {
    console.log(`Reading pinned source from ${sourceFile}`);
    return readFile(sourceFile);
  }

  console.log(`Downloading ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "hstone-local-fan-game/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    fail(`source download returned ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function verifySourceHash(bytes) {
  const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  expect(
    actual === SOURCE_SHA256,
    `source SHA-256 changed (expected ${SOURCE_SHA256}, received ${actual})`,
  );
}

function countByTier(minions) {
  return Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((tier) => [
      String(tier),
      minions.filter((card) => card.techLevel === tier).length,
    ]),
  );
}

function validateSourceMinion(card) {
  expect(typeof card.id === "string" && card.id.length > 0, "card missing id");
  expect(
    Number.isInteger(card.dbfId) && card.dbfId > 0,
    `${card.id} has invalid dbfId`,
  );
  expect(
    Number.isInteger(card.battlegroundsPremiumDbfId) &&
      card.battlegroundsPremiumDbfId > 0,
    `${card.id} has invalid battlegroundsPremiumDbfId`,
  );
  expect(
    typeof card.name === "string" && card.name.length > 0,
    `${card.id} has no localized name`,
  );
  expect(
    Number.isInteger(card.techLevel) &&
      card.techLevel >= 1 &&
      card.techLevel <= 7,
    `${card.id} has invalid techLevel`,
  );
  expect(Number.isInteger(card.attack), `${card.id} has invalid attack`);
  expect(Number.isInteger(card.health), `${card.id} has invalid health`);
  expect(typeof card.text === "string", `${card.id} has no localized text`);
  expect(card.type === "MINION", `${card.id} is not a minion`);
}

function validateSourceTavernSpell(card) {
  expect(typeof card.id === "string" && card.id.length > 0, "spell missing id");
  expect(
    Number.isInteger(card.dbfId) && card.dbfId > 0,
    `${card.id} has invalid dbfId`,
  );
  expect(
    typeof card.name === "string" && card.name.length > 0,
    `${card.id} has no localized name`,
  );
  expect(
    Number.isInteger(card.techLevel) &&
      card.techLevel >= 1 &&
      card.techLevel <= 7,
    `${card.id} has invalid techLevel`,
  );
  expect(
    Number.isInteger(card.cost) && card.cost >= 0,
    `${card.id} has invalid cost`,
  );
  expect(typeof card.text === "string", `${card.id} has no localized text`);
  expect(
    card.type === "BATTLEGROUND_SPELL",
    `${card.id} is not a Battlegrounds spell`,
  );
  expect(
    card.spellSchool === "TAVERN",
    `${card.id} is not a Tavern Spell`,
  );
}

function normalizeMinion(card) {
  return {
    id: card.id,
    dbfId: card.dbfId,
    premiumDbfId: card.battlegroundsPremiumDbfId,
    name: card.name,
    tier: card.techLevel,
    attack: card.attack,
    health: card.health,
    races: Array.isArray(card.races)
      ? card.races
      : card.race
        ? [card.race]
        : [],
    associatedRaces: card.battlegroundsAssociatedRaces ?? [],
    mechanics: card.mechanics ?? [],
    referencedTags: card.referencedTags ?? [],
    text: card.text,
  };
}

function normalizeTavernSpell(card) {
  return {
    id: card.id,
    dbfId: card.dbfId,
    name: card.name,
    tier: card.techLevel,
    cost: card.cost,
    associatedRaces: card.battlegroundsAssociatedRaces ?? [],
    mechanics: card.mechanics ?? [],
    referencedTags: card.referencedTags ?? [],
    text: card.text,
  };
}

function validateUnique(cards, field) {
  const values = cards.map((card) => card[field]);
  expect(
    new Set(values).size === values.length,
    `snapshot contains duplicate ${field} values`,
  );
}

function buildSnapshot(cards) {
  expect(Array.isArray(cards), "source root is not an array");

  const tagged = cards.filter(
    (card) => card.isBattlegroundsPoolMinion === true,
  );
  expect(
    tagged.every((card) => card.type === "MINION"),
    "active pool flag is present on a non-minion",
  );
  expect(
    tagged.length === EXPECTED_COUNTS.rawPoolMinions,
    `expected ${EXPECTED_COUNTS.rawPoolMinions} tagged minions, got ${tagged.length}`,
  );
  tagged.forEach(validateSourceMinion);

  const duos = tagged.filter((card) => card.id.startsWith("BGDUO"));
  expect(
    duos.length === EXPECTED_COUNTS.duosExcluded,
    `expected ${EXPECTED_COUNTS.duosExcluded} Duos minions, got ${duos.length}`,
  );

  const solo = tagged.filter((card) => !card.id.startsWith("BGDUO"));
  expect(
    solo.length === EXPECTED_COUNTS.soloPoolMinions,
    `expected ${EXPECTED_COUNTS.soloPoolMinions} Solo minions, got ${solo.length}`,
  );

  const tierSeven = solo.filter((card) => card.techLevel === 7);
  expect(
    tierSeven.length === EXPECTED_COUNTS.tierSevenExcluded,
    `expected ${EXPECTED_COUNTS.tierSevenExcluded} Solo Tier 7 minions, got ${tierSeven.length}`,
  );

  const tavern = solo
    .filter((card) => card.techLevel >= 1 && card.techLevel <= 6)
    .sort(
      (left, right) =>
        left.techLevel - right.techLevel ||
        left.id.localeCompare(right.id, "en"),
    );
  expect(
    tavern.length === EXPECTED_COUNTS.snapshotMinions,
    `expected ${EXPECTED_COUNTS.snapshotMinions} Solo Tavern minions, got ${tavern.length}`,
  );
  expect(
    JSON.stringify(countByTier(tavern)) ===
      JSON.stringify(EXPECTED_COUNTS.byTier),
    "Tavern Tier distribution changed",
  );

  const sanguineRefiner = tavern.find((card) => card.id === "BG33_885");
  expect(
    sanguineRefiner?.name === "鲜血精研者" &&
      sanguineRefiner.techLevel === 6 &&
      sanguineRefiner.attack === 3 &&
      sanguineRefiner.health === 11,
    "36.0.3 returning-minion sentinel 鲜血精研者 is missing or changed",
  );
  expect(
    !tavern.some((card) => card.id === "BG32_433"),
    "36.0.3 removed-minion sentinel 睡梦织棘者 is still active",
  );

  const normalizedMinions = tavern.map(normalizeMinion);
  validateUnique(normalizedMinions, "id");
  validateUnique(normalizedMinions, "dbfId");
  validateUnique(normalizedMinions, "premiumDbfId");

  const taggedSpells = cards.filter(
    (card) => card.isBattlegroundsPoolSpell === true,
  );
  expect(
    taggedSpells.length === EXPECTED_TAVERN_SPELL_COUNTS.rawPoolSpells,
    `expected ${EXPECTED_TAVERN_SPELL_COUNTS.rawPoolSpells} tagged Tavern Spells, got ${taggedSpells.length}`,
  );
  taggedSpells.forEach(validateSourceTavernSpell);

  const duosSpells = taggedSpells.filter((card) =>
    DUOS_TAVERN_SPELL_IDS.has(card.id),
  );
  expect(
    duosSpells.length === EXPECTED_TAVERN_SPELL_COUNTS.duosExcluded,
    `expected ${EXPECTED_TAVERN_SPELL_COUNTS.duosExcluded} Duos Tavern Spells, got ${duosSpells.length}`,
  );
  const soloSpells = taggedSpells.filter(
    (card) => !DUOS_TAVERN_SPELL_IDS.has(card.id),
  );
  expect(
    soloSpells.length === EXPECTED_TAVERN_SPELL_COUNTS.soloPoolSpells,
    `expected ${EXPECTED_TAVERN_SPELL_COUNTS.soloPoolSpells} Solo Tavern Spells, got ${soloSpells.length}`,
  );
  const tierSevenSpells = soloSpells.filter(
    (card) => card.techLevel === 7,
  );
  expect(
    tierSevenSpells.length === EXPECTED_TAVERN_SPELL_COUNTS.tierSevenExcluded,
    `expected ${EXPECTED_TAVERN_SPELL_COUNTS.tierSevenExcluded} Solo Tier 7 Tavern Spells, got ${tierSevenSpells.length}`,
  );
  const tavernSpells = soloSpells
    .filter((card) => card.techLevel >= 1 && card.techLevel <= 6)
    .sort(
      (left, right) =>
        left.techLevel - right.techLevel ||
        left.id.localeCompare(right.id, "en"),
    );
  expect(
    tavernSpells.length === EXPECTED_TAVERN_SPELL_COUNTS.snapshotSpells,
    `expected ${EXPECTED_TAVERN_SPELL_COUNTS.snapshotSpells} Solo Tavern Spells, got ${tavernSpells.length}`,
  );
  expect(
    JSON.stringify(countByTier(tavernSpells)) ===
      JSON.stringify(EXPECTED_TAVERN_SPELL_COUNTS.byTier),
    "Tavern Spell Tier distribution changed",
  );
  expect(
    !tavernSpells.some((card) => DUOS_TAVERN_SPELL_IDS.has(card.id)),
    "Duos-only Tavern Spell entered the Solo snapshot",
  );
  const normalizedTavernSpells = tavernSpells.map(normalizeTavernSpell);
  validateUnique(normalizedTavernSpells, "id");
  validateUnique(normalizedTavernSpells, "dbfId");

  return {
    schemaVersion: 2,
    source: {
      patch: PATCH,
      build: BUILD,
      locale: LOCALE,
      cutoffDate: CUTOFF_DATE,
      url: SOURCE_URL,
      sha256: SOURCE_SHA256,
    },
    counts: EXPECTED_COUNTS,
    tavernSpellCounts: EXPECTED_TAVERN_SPELL_COUNTS,
    minions: normalizedMinions,
    tavernSpells: normalizedTavernSpells,
  };
}

const sourceBytes = await loadSourceBytes();
verifySourceHash(sourceBytes);

let cards;
try {
  cards = JSON.parse(sourceBytes.toString("utf8"));
} catch (error) {
  fail(
    `source JSON could not be parsed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

const snapshot = buildSnapshot(cards);
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
let previous;
try {
  previous = await readFile(OUTPUT_PATH, "utf8");
} catch {
  // The first generation has no previous snapshot.
}

if (previous === serialized) {
  console.log(`Snapshot unchanged: ${OUTPUT_PATH}`);
} else {
  await writeFile(OUTPUT_PATH, serialized, "utf8");
  console.log(
    `Wrote ${snapshot.minions.length} minions and ${snapshot.tavernSpells.length} Tavern Spells to ${OUTPUT_PATH}`,
  );
}
