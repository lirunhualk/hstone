import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const snapshotUrl = new URL(
  "../lib/game/generated/battlegrounds-trinkets-36.0.3-247416.zhCN.json",
  import.meta.url,
);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
const {
  source,
  counts,
  legacyLocalIdByCardId,
  excludedDuos,
  relatedCards,
  timewarpCostTwoMinions,
  trinkets,
} = snapshot;

const compatibleLocalIds = {
  BG30_MagicItem_414: "lesser-trinket-kodo-leather-pouch",
  BG30_MagicItem_414t: "greater-trinket-kodo-leather-pouch",
  BG30_MagicItem_435: "lesser-trinket-goldenizer-supply",
  BG30_MagicItem_705: "lesser-trinket-oilcan",
  BG30_MagicItem_847: "lesser-trinket-goblin-wallet",
  BG30_MagicItem_986: "greater-trinket-calming-candle",
  BG30_MagicItem_996: "greater-trinket-bobs-tip-jar",
  BG32_MagicItem_700: "greater-trinket-magic-mushroom",
};

function countByTier(records) {
  return Object.fromEntries(
    ["lesser", "greater"].map((tier) => [
      tier,
      records.filter((record) => record.tier === tier).length,
    ]),
  );
}

test("pins the official pool and localized build sources", () => {
  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(source, {
    patch: "36.0.3",
    build: 247416,
    locale: "zhCN",
    cutoffDate: "2026-08-02",
    officialCardLibrary: {
      url: "https://hearthstone.blizzard.com/en-us/api/cards?gameMode=battlegrounds&bgCardType=trinket&pageSize=450",
      sha256:
        "F5BCBCCFA352F9A6568E05D4DBC4C919F586279BFBCE2305227BB9CCF0A9C565",
    },
    hearthstoneJson: {
      url: "https://api.hearthstonejson.com/v1/247416/zhCN/cards.json",
      sha256:
        "5E48186C2E1702B474088958978D560026A6CDC3990F181CAB790D42A7727013",
    },
  });
});

test("contains every current Solo Trinket in the correct tier", () => {
  assert.deepEqual(counts, {
    officialTrinkets: 213,
    duosExcluded: 9,
    soloTrinkets: 204,
    byTier: {
      lesser: 98,
      greater: 106,
    },
  });
  assert.equal(trinkets.length, 204);
  assert.deepEqual(countByTier(trinkets), counts.byTier);
});

test("records and excludes exactly the nine Duos-only Trinkets", () => {
  assert.deepEqual(
    excludedDuos.map((card) => card.cardId),
    [
      "BGDUO_MagicItem_001",
      "BGDUO_MagicItem_002",
      "BGDUO_MagicItem_003",
      "BGDUO_MagicItem_005",
      "BGDUO_MagicItem_006",
      "BGDUO_MagicItem_007",
      "BGDUO_MagicItem_008",
      "BGDUO_MagicItem_010",
      "BGDUO_MagicItem_010t",
    ],
  );
  const excludedIds = new Set(excludedDuos.map((card) => card.cardId));
  assert.ok(trinkets.every((card) => !excludedIds.has(card.cardId)));
  assert.equal(excludedDuos.filter((card) => card.tier === "lesser").length, 5);
  assert.equal(excludedDuos.filter((card) => card.tier === "greater").length, 4);
});

test("preserves unique identifiers and all runtime data fields", () => {
  for (const field of ["id", "cardId", "dbfId", "sourceSlug"]) {
    const values = trinkets.map((card) => card[field]);
    assert.equal(new Set(values).size, values.length, `${field} must be unique`);
  }

  for (const card of trinkets) {
    assert.match(card.id, /^(lesser|greater)-trinket-[a-z0-9-]+$/);
    assert.match(card.cardId, /^[A-Za-z0-9_]+$/);
    assert.ok(Number.isInteger(card.dbfId) && card.dbfId > 0);
    assert.ok(typeof card.name === "string" && card.name.length > 0);
    assert.ok(card.tier === "lesser" || card.tier === "greater");
    assert.ok(Number.isInteger(card.cost) && card.cost >= 0);
    assert.ok(
      typeof card.description === "string" && card.description.length > 0,
    );
    assert.equal(card.description, card.description.trim());
    assert.doesNotMatch(card.description, /<[^>]+>/);
    assert.doesNotMatch(card.description, /92/);
    assert.ok(Array.isArray(card.associatedTribes));
    assert.ok(Array.isArray(card.relatedCardIds));
    assert.ok(card.relatedCardIds.every((id) => /^[A-Za-z0-9_]+$/.test(id)));
    assert.match(card.sourceSlug, /^\d+-[a-z0-9-]+$/);
  }
  assert.equal(
    trinkets.filter((card) => card.relatedCardIds.length > 0).length,
    58,
  );
});

test("keeps only the initial readable text for runtime counter variants", () => {
  const typewriter = trinkets.find(
    (card) => card.cardId === "BG35_MagicItem_931",
  );
  assert.equal(
    typewriter.description,
    "获取你购买的下2个随从的各一张额外复制。（还剩2个！）",
  );
  assert.equal(
    trinkets.find((card) => card.cardId === "BG35_MagicItem_731")
      .description,
    "在一个友方亡灵\n复生后，使其获得复生。（每回合限3次。）",
  );

  const compass = trinkets.find(
    (card) => card.cardId === "BG30_MagicItem_426",
  );
  assert.equal(
    compass.description,
    "随机获取一张与你战队相符类型的随从牌。在每个回合开始时，再获取一张。",
  );
});

test("records all eight legacy ids and applies the four still in the live pool", () => {
  assert.deepEqual(legacyLocalIdByCardId, compatibleLocalIds);
  for (const [cardId, expectedId] of Object.entries(compatibleLocalIds)) {
    const active = trinkets.find((card) => card.cardId === cardId);
    if (active) assert.equal(active.id, expectedId);
  }
  assert.deepEqual(
    Object.keys(compatibleLocalIds).filter((cardId) =>
      trinkets.some((card) => card.cardId === cardId),
    ),
    [
      "BG30_MagicItem_435",
      "BG30_MagicItem_705",
      "BG30_MagicItem_847",
      "BG30_MagicItem_996",
    ],
  );
});

test("generates deterministic ids for newly imported Trinkets", () => {
  for (const card of trinkets) {
    if (compatibleLocalIds[card.cardId]) continue;
    const normalizedCardId = card.cardId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    assert.equal(card.id, `${card.tier}-trinket-${normalizedCardId}`);
  }
});

test("is sorted deterministically by tier and CardID", () => {
  const actual = trinkets.map((card) => `${card.tier}:${card.cardId}`);
  const sorted = [...trinkets]
    .sort(
      (left, right) =>
        ["lesser", "greater"].indexOf(left.tier) -
          ["lesser", "greater"].indexOf(right.tier) ||
        left.cardId.localeCompare(right.cardId, "en"),
    )
    .map((card) => `${card.tier}:${card.cardId}`);
  assert.deepEqual(actual, sorted);
});

test("preserves localized and tribe data for a typed sentinel", () => {
  const accordOTRon = trinkets.find((card) => card.cardId === "BG35_MagicItem_742");
  assert.deepEqual(accordOTRon, {
    id: "greater-trinket-bg35-magicitem-742",
    cardId: "BG35_MagicItem_742",
    dbfId: 131140,
    name: "手风琴机器人肖像",
    tier: "greater",
    cost: 5,
    description:
      "在每个回合结束时，对你最左边和最右边的机械各磁力吸附一个手风琴机器人。",
    associatedTribes: ["MECHANICAL"],
    relatedCardIds: ["BG26_147"],
    sourceSlug: "131140-accord-o-tron-portrait",
  });
});

test("pins Mirror Lens and the complete 2-Cost Timewarp minion pools", () => {
  assert.deepEqual(relatedCards.mirrorLens, {
    cardId: "BG35_MagicItem_817t",
    dbfId: 130853,
    name: "复映透镜",
    cost: 0,
    description: "选择一个等级3或以下的随从，获取一张该随从的原始版复制。",
  });
  assert.equal(timewarpCostTwoMinions.lesser.length, 25);
  assert.equal(timewarpCostTwoMinions.greater.length, 41);

  const all = [
    ...timewarpCostTwoMinions.lesser,
    ...timewarpCostTwoMinions.greater,
  ];
  for (const field of ["cardId", "dbfId", "goldenCardId", "goldenDbfId"]) {
    const values = all.map((card) => card[field]);
    assert.equal(new Set(values).size, 66, `${field} must be unique`);
  }
  assert.ok(
    timewarpCostTwoMinions.lesser.every(
      (card) => card.cost === 2 && card.tier === 3,
    ),
  );
  assert.ok(
    timewarpCostTwoMinions.greater.every(
      (card) => card.cost === 2 && card.tier === 5,
    ),
  );

  const lesserShield = timewarpCostTwoMinions.lesser.find(
    (card) => card.cardId === "BG34_Giant_068",
  );
  assert.ok(lesserShield);
  assert.deepEqual(lesserShield.races, ["MECHANICAL"]);
  assert.ok(lesserShield.mechanics.includes("DIVINE_SHIELD"));
  assert.deepEqual(
    [lesserShield.attack, lesserShield.health, lesserShield.goldenAttack, lesserShield.goldenHealth],
    [5, 10, 10, 20],
  );

  const greaterWindfury = timewarpCostTwoMinions.greater.find(
    (card) => card.cardId === "BG34_Giant_102",
  );
  assert.ok(greaterWindfury);
  assert.deepEqual(greaterWindfury.races, ["QUILBOAR"]);
  assert.ok(greaterWindfury.mechanics.includes("WINDFURY"));
  assert.deepEqual(
    [
      greaterWindfury.attack,
      greaterWindfury.health,
      greaterWindfury.goldenAttack,
      greaterWindfury.goldenHealth,
    ],
    [7, 14, 14, 28],
  );
});
