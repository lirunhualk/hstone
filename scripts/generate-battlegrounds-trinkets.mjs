import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PATCH = "36.0.3";
const BUILD = 247416;
const LOCALE = "zhCN";
const CUTOFF_DATE = "2026-08-02";
const OFFICIAL_SOURCE_URL =
  "https://hearthstone.blizzard.com/en-us/api/cards?gameMode=battlegrounds&bgCardType=trinket&pageSize=450";
const OFFICIAL_SOURCE_SHA256 =
  "F5BCBCCFA352F9A6568E05D4DBC4C919F586279BFBCE2305227BB9CCF0A9C565";
const CARDS_SOURCE_URL =
  `https://api.hearthstonejson.com/v1/${BUILD}/${LOCALE}/cards.json`;
const CARDS_SOURCE_SHA256 =
  "5E48186C2E1702B474088958978D560026A6CDC3990F181CAB790D42A7727013";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = path.join(
  ROOT,
  "lib",
  "game",
  "generated",
  `battlegrounds-trinkets-${PATCH}-${BUILD}.${LOCALE}.json`,
);

const EXPECTED_COUNTS = Object.freeze({
  officialTrinkets: 213,
  duosExcluded: 9,
  soloTrinkets: 204,
  byTier: Object.freeze({
    lesser: 98,
    greater: 106,
  }),
});

const EXPECTED_TIMEWARP_COST_TWO_COUNTS = Object.freeze({
  lesser: 25,
  greater: 41,
});

const MIRROR_LENS_CARD_ID = "BG35_MagicItem_817t";

const DUOS_CARD_IDS = Object.freeze([
  "BGDUO_MagicItem_001",
  "BGDUO_MagicItem_002",
  "BGDUO_MagicItem_003",
  "BGDUO_MagicItem_005",
  "BGDUO_MagicItem_006",
  "BGDUO_MagicItem_007",
  "BGDUO_MagicItem_008",
  "BGDUO_MagicItem_010",
  "BGDUO_MagicItem_010t",
]);

const COMPATIBLE_LOCAL_IDS = Object.freeze({
  BG30_MagicItem_414: "lesser-trinket-kodo-leather-pouch",
  BG30_MagicItem_414t: "greater-trinket-kodo-leather-pouch",
  BG30_MagicItem_435: "lesser-trinket-goldenizer-supply",
  BG30_MagicItem_705: "lesser-trinket-oilcan",
  BG30_MagicItem_847: "lesser-trinket-goblin-wallet",
  BG30_MagicItem_986: "greater-trinket-calming-candle",
  BG30_MagicItem_996: "greater-trinket-bobs-tip-jar",
  BG32_MagicItem_700: "greater-trinket-magic-mushroom",
});

const TIER_BY_SPELL_SCHOOL = Object.freeze({
  LESSER_TRINKET: "lesser",
  GREATER_TRINKET: "greater",
});

function fail(message) {
  throw new Error(`Battlegrounds Trinket data validation failed: ${message}`);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function parseArguments(argv) {
  const result = {
    officialSource: undefined,
    cardsSource: undefined,
  };
  const fields = {
    "--official-source": "officialSource",
    "--cards-source": "cardsSource",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const field = fields[argument];
    expect(field, `unknown argument ${argument}`);
    const value = argv[index + 1];
    expect(value && !value.startsWith("--"), `${argument} requires a path`);
    expect(!result[field], `${argument} was provided more than once`);
    result[field] = path.resolve(value);
    index += 1;
  }

  return result;
}

async function loadSourceBytes(filePath, url, label) {
  if (filePath) {
    console.log(`Reading pinned ${label} source from ${filePath}`);
    return readFile(filePath);
  }

  console.log(`Downloading ${url}`);
  const response = await fetch(url, {
    headers: { "User-Agent": "hstone-local-fan-game/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    fail(`${label} download returned ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function verifySourceHash(bytes, expected, label) {
  const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  expect(
    actual === expected,
    `${label} SHA-256 changed (expected ${expected}, received ${actual})`,
  );
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    fail(
      `${label} JSON could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function validateUnique(records, field) {
  const values = records.map((record) => record[field]);
  expect(
    new Set(values).size === values.length,
    `snapshot contains duplicate ${field} values`,
  );
}

function countByTier(records) {
  return Object.fromEntries(
    ["lesser", "greater"].map((tier) => [
      tier,
      records.filter((record) => record.tier === tier).length,
    ]),
  );
}

function makeLocalId(cardId, tier) {
  if (COMPATIBLE_LOCAL_IDS[cardId]) return COMPATIBLE_LOCAL_IDS[cardId];
  const normalizedCardId = cardId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${tier}-trinket-${normalizedCardId}`;
}

function plainCardText(html) {
  // HearthstoneJSON concatenates the base text and a counter-state variant
  // for a small number of Trinkets (for example "3 ... remaining").  The
  // client card face starts from the first variant; keeping both would show
  // the entire sentence twice in our choice dialog.
  const initialVariant = html.replace(
    /^([\s\S]*?<\/i>)\d+[\s\S]*$/iu,
    "$1",
  );
  return initialVariant
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]+>/gu, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/\r/gu, "")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n[ \t]+/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function displayCardText(card) {
  const description = plainCardText(card.text);
  // These card records receive a runtime minion-type icon in the official
  // client.  Static card JSON exposes that placeholder as the numeric race
  // token "92", so use a readable generic phrase in the fixed snapshot.
  if (
    card.id === "BG30_MagicItem_426" ||
    card.id === "BG30_MagicItem_426t" ||
    card.id === "BG30_MagicItem_973" ||
    card.id === "BG32_MagicItem_901"
  ) {
    return description.replaceAll("92", "与你战队相符类型的随从");
  }
  return description;
}

function getRelatedDbfIds(card) {
  const values = [];
  if (card.battlegroundsRelatedCard !== undefined) {
    values.push(card.battlegroundsRelatedCard);
  }
  if (card.battlegroundsRelatedCards !== undefined) {
    expect(
      Array.isArray(card.battlegroundsRelatedCards),
      `${card.id} has invalid battlegroundsRelatedCards`,
    );
    values.push(...card.battlegroundsRelatedCards);
  }
  return [...new Set(values)];
}

function ordinaryTimewarpMinionRaces(card) {
  if (Array.isArray(card.races)) return card.races;
  return typeof card.race === "string" ? [card.race] : [];
}

function buildTimewarpCostTwoPools(sourceCards, sourceByDbfId) {
  const ordinaryMinions = sourceCards.filter(
    (card) =>
      card.battlegroundsTimewarpCard === 1 &&
      card.type === "MINION" &&
      card.cost === 2 &&
      (card.techLevel === 3 || card.techLevel === 5) &&
      Number.isInteger(card.battlegroundsPremiumDbfId),
  );

  const records = ordinaryMinions.map((card) => {
    const goldenCard = sourceByDbfId.get(card.battlegroundsPremiumDbfId);
    expect(
      goldenCard && goldenCard.type === "MINION",
      `${card.id} is missing its Timewarp Golden minion`,
    );
    expect(
      goldenCard.battlegroundsTimewarpCard === 1 &&
        goldenCard.techLevel === card.techLevel &&
        goldenCard.cost === card.cost,
      `${card.id} has inconsistent Timewarp Golden metadata`,
    );
    expect(
      typeof card.id === "string" &&
        typeof card.name === "string" &&
        Number.isInteger(card.dbfId) &&
        Number.isInteger(card.attack) &&
        Number.isInteger(card.health) &&
        typeof card.text === "string",
      `${card.id ?? "unknown Timewarp minion"} has incomplete printed data`,
    );
    expect(
      typeof goldenCard.id === "string" &&
        Number.isInteger(goldenCard.dbfId) &&
        Number.isInteger(goldenCard.attack) &&
        Number.isInteger(goldenCard.health) &&
        typeof goldenCard.text === "string",
      `${card.id} has incomplete Golden printed data`,
    );

    return {
      cardId: card.id,
      dbfId: card.dbfId,
      goldenCardId: goldenCard.id,
      goldenDbfId: goldenCard.dbfId,
      name: card.name,
      tier: card.techLevel,
      cost: card.cost,
      attack: card.attack,
      health: card.health,
      goldenAttack: goldenCard.attack,
      goldenHealth: goldenCard.health,
      races: ordinaryTimewarpMinionRaces(card),
      associatedRaces: card.battlegroundsAssociatedRaces ?? [],
      mechanics: card.mechanics ?? [],
      referencedTags: card.referencedTags ?? [],
      elite: card.elite === true,
      description: plainCardText(card.text),
      goldenDescription: plainCardText(goldenCard.text),
    };
  });

  const pools = {
    lesser: records
      .filter((record) => record.tier === 3)
      .sort((left, right) => left.cardId.localeCompare(right.cardId, "en")),
    greater: records
      .filter((record) => record.tier === 5)
      .sort((left, right) => left.cardId.localeCompare(right.cardId, "en")),
  };
  expect(
    pools.lesser.length === EXPECTED_TIMEWARP_COST_TWO_COUNTS.lesser,
    `expected ${EXPECTED_TIMEWARP_COST_TWO_COUNTS.lesser} Lesser 2-Cost Timewarp minions, got ${pools.lesser.length}`,
  );
  expect(
    pools.greater.length === EXPECTED_TIMEWARP_COST_TWO_COUNTS.greater,
    `expected ${EXPECTED_TIMEWARP_COST_TWO_COUNTS.greater} Greater 2-Cost Timewarp minions, got ${pools.greater.length}`,
  );
  validateUnique(records, "cardId");
  validateUnique(records, "dbfId");
  validateUnique(records, "goldenCardId");
  validateUnique(records, "goldenDbfId");
  return pools;
}

function buildSnapshot(officialPayload, sourceCards) {
  expect(
    officialPayload && typeof officialPayload === "object",
    "official source root is not an object",
  );
  expect(Array.isArray(officialPayload.cards), "official cards is not an array");
  expect(
    officialPayload.cardCount === EXPECTED_COUNTS.officialTrinkets,
    `expected official cardCount ${EXPECTED_COUNTS.officialTrinkets}, got ${officialPayload.cardCount}`,
  );
  expect(officialPayload.page === 1, `expected official page 1, got ${officialPayload.page}`);
  expect(
    officialPayload.pageCount === 1,
    `expected official pageCount 1, got ${officialPayload.pageCount}`,
  );
  expect(
    officialPayload.cards.length === EXPECTED_COUNTS.officialTrinkets,
    `expected ${EXPECTED_COUNTS.officialTrinkets} official cards, got ${officialPayload.cards.length}`,
  );
  expect(Array.isArray(sourceCards), "fixed-build source root is not an array");

  const sourceByDbfId = new Map();
  for (const card of sourceCards) {
    if (!Number.isInteger(card.dbfId)) continue;
    expect(!sourceByDbfId.has(card.dbfId), `duplicate source dbfId ${card.dbfId}`);
    sourceByDbfId.set(card.dbfId, card);
  }

  const officialDbfIds = officialPayload.cards.map((card) => card.id);
  const officialSlugs = officialPayload.cards.map((card) => card.slug);
  expect(
    new Set(officialDbfIds).size === officialDbfIds.length,
    "official source contains duplicate card ids",
  );
  expect(
    new Set(officialSlugs).size === officialSlugs.length,
    "official source contains duplicate slugs",
  );

  const joined = officialPayload.cards.map((officialCard) => {
    expect(
      Number.isInteger(officialCard.id) && officialCard.id > 0,
      "official card has invalid id",
    );
    expect(
      typeof officialCard.slug === "string" && officialCard.slug.length > 0,
      `${officialCard.id} has invalid official slug`,
    );
    expect(
      officialCard.battlegrounds &&
        typeof officialCard.battlegrounds.duosOnly === "boolean",
      `${officialCard.slug} has invalid battlegrounds metadata`,
    );

    const sourceCard = sourceByDbfId.get(officialCard.id);
    expect(sourceCard, `${officialCard.slug} is missing from build ${BUILD}`);
    expect(
      sourceCard.type === "BATTLEGROUND_TRINKET",
      `${sourceCard.id} is not a Battlegrounds Trinket`,
    );
    const tier = TIER_BY_SPELL_SCHOOL[sourceCard.spellSchool];
    expect(tier, `${sourceCard.id} has invalid spellSchool ${sourceCard.spellSchool}`);
    expect(
      officialCard.spellSchoolId === (tier === "lesser" ? 11 : 12),
      `${sourceCard.id} disagrees with the official Trinket tier`,
    );
    expect(
      typeof sourceCard.id === "string" && sourceCard.id.length > 0,
      `${officialCard.slug} has invalid CardID`,
    );
    expect(
      typeof sourceCard.name === "string" && sourceCard.name.length > 0,
      `${sourceCard.id} has no localized name`,
    );
    expect(
      Number.isInteger(sourceCard.cost) && sourceCard.cost >= 0,
      `${sourceCard.id} has invalid cost`,
    );
    expect(typeof sourceCard.text === "string", `${sourceCard.id} has no localized text`);

    const relatedCardIds = getRelatedDbfIds(sourceCard).map((relatedDbfId) => {
      expect(
        Number.isInteger(relatedDbfId) && relatedDbfId > 0,
        `${sourceCard.id} has invalid related dbfId ${relatedDbfId}`,
      );
      const relatedCard = sourceByDbfId.get(relatedDbfId);
      expect(
        relatedCard && typeof relatedCard.id === "string",
        `${sourceCard.id} related dbfId ${relatedDbfId} is missing from build ${BUILD}`,
      );
      return relatedCard.id;
    });

    return {
      officialCard,
      sourceCard,
      tier,
      relatedCardIds,
    };
  });

  const duos = joined.filter((entry) => entry.officialCard.battlegrounds.duosOnly);
  expect(
    duos.length === EXPECTED_COUNTS.duosExcluded,
    `expected ${EXPECTED_COUNTS.duosExcluded} Duos Trinkets, got ${duos.length}`,
  );
  const actualDuosCardIds = duos
    .map((entry) => entry.sourceCard.id)
    .sort((left, right) => left.localeCompare(right, "en"));
  expect(
    JSON.stringify(actualDuosCardIds) === JSON.stringify(DUOS_CARD_IDS),
    `Duos-only CardID set changed: ${actualDuosCardIds.join(", ")}`,
  );

  const trinkets = joined
    .filter((entry) => !entry.officialCard.battlegrounds.duosOnly)
    .map(({ officialCard, sourceCard, tier, relatedCardIds }) => ({
      id: makeLocalId(sourceCard.id, tier),
      cardId: sourceCard.id,
      dbfId: sourceCard.dbfId,
      name: sourceCard.name,
      tier,
      cost: sourceCard.cost,
      description: displayCardText(sourceCard),
      associatedTribes: sourceCard.battlegroundsAssociatedRaces ?? [],
      relatedCardIds,
      sourceSlug: officialCard.slug,
    }))
    .sort(
      (left, right) =>
        ["lesser", "greater"].indexOf(left.tier) -
          ["lesser", "greater"].indexOf(right.tier) ||
        left.cardId.localeCompare(right.cardId, "en"),
    );

  expect(
    trinkets.length === EXPECTED_COUNTS.soloTrinkets,
    `expected ${EXPECTED_COUNTS.soloTrinkets} Solo Trinkets, got ${trinkets.length}`,
  );
  expect(
    JSON.stringify(countByTier(trinkets)) ===
      JSON.stringify(EXPECTED_COUNTS.byTier),
    "Trinket tier distribution changed",
  );
  for (const field of ["id", "cardId", "dbfId", "sourceSlug"]) {
    validateUnique(trinkets, field);
  }

  const excludedDuos = duos
    .map(({ officialCard, sourceCard, tier }) => ({
      cardId: sourceCard.id,
      dbfId: sourceCard.dbfId,
      name: sourceCard.name,
      tier,
      sourceSlug: officialCard.slug,
    }))
    .sort((left, right) => left.cardId.localeCompare(right.cardId, "en"));

  const mirrorLens = sourceCards.find(
    (card) => card.id === MIRROR_LENS_CARD_ID,
  );
  expect(
    mirrorLens &&
      mirrorLens.type === "SPELL" &&
      mirrorLens.cost === 0 &&
      typeof mirrorLens.name === "string" &&
      typeof mirrorLens.text === "string" &&
      Number.isInteger(mirrorLens.dbfId),
    `${MIRROR_LENS_CARD_ID} is missing or invalid in build ${BUILD}`,
  );
  const timewarpCostTwoMinions = buildTimewarpCostTwoPools(
    sourceCards,
    sourceByDbfId,
  );

  return {
    schemaVersion: 1,
    source: {
      patch: PATCH,
      build: BUILD,
      locale: LOCALE,
      cutoffDate: CUTOFF_DATE,
      officialCardLibrary: {
        url: OFFICIAL_SOURCE_URL,
        sha256: OFFICIAL_SOURCE_SHA256,
      },
      hearthstoneJson: {
        url: CARDS_SOURCE_URL,
        sha256: CARDS_SOURCE_SHA256,
      },
    },
    counts: EXPECTED_COUNTS,
    legacyLocalIdByCardId: COMPATIBLE_LOCAL_IDS,
    excludedDuos,
    relatedCards: {
      mirrorLens: {
        cardId: mirrorLens.id,
        dbfId: mirrorLens.dbfId,
        name: mirrorLens.name,
        cost: mirrorLens.cost,
        description: plainCardText(mirrorLens.text),
      },
    },
    timewarpCostTwoMinions,
    trinkets,
  };
}

const argumentsBySource = parseArguments(process.argv.slice(2));
const [officialBytes, cardsBytes] = await Promise.all([
  loadSourceBytes(
    argumentsBySource.officialSource,
    OFFICIAL_SOURCE_URL,
    "official Card Library",
  ),
  loadSourceBytes(
    argumentsBySource.cardsSource,
    CARDS_SOURCE_URL,
    "fixed-build card",
  ),
]);
verifySourceHash(
  officialBytes,
  OFFICIAL_SOURCE_SHA256,
  "official Card Library source",
);
verifySourceHash(cardsBytes, CARDS_SOURCE_SHA256, "fixed-build card source");

const snapshot = buildSnapshot(
  parseJson(officialBytes, "official Card Library source"),
  parseJson(cardsBytes, "fixed-build card source"),
);
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
  console.log(`Wrote ${snapshot.trinkets.length} Solo Trinkets to ${OUTPUT_PATH}`);
}
