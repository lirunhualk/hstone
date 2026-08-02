import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const snapshotUrl = new URL(
  "../lib/game/generated/battlegrounds-36.0.3-247416.zhCN.json",
  import.meta.url,
);
const snapshot = JSON.parse(await readFile(snapshotUrl, "utf8"));
const {
  source,
  counts,
  tavernSpellCounts,
  minions,
  tierSevenMinions,
  tavernSpells,
} = snapshot;

function byTier(cards) {
  return Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((tier) => [
      String(tier),
      cards.filter((card) => card.tier === tier).length,
    ]),
  );
}

test("pins the verified 36.0.3 / build 247416 source", () => {
  assert.equal(snapshot.schemaVersion, 3);
  assert.deepEqual(source, {
    patch: "36.0.3",
    build: 247416,
    locale: "zhCN",
    cutoffDate: "2026-07-27",
    url: "https://api.hearthstonejson.com/v1/247416/zhCN/cards.json",
    sha256:
      "5E48186C2E1702B474088958978D560026A6CDC3990F181CAB790D42A7727013",
  });
});

test("records the complete current Solo Tavern Spell pool", () => {
  assert.deepEqual(tavernSpellCounts, {
    rawPoolSpells: 72,
    duosExcluded: 3,
    soloPoolSpells: 69,
    tierSevenExcluded: 4,
    snapshotSpells: 65,
    byTier: {
      1: 8,
      2: 6,
      3: 16,
      4: 16,
      5: 14,
      6: 5,
    },
  });
  assert.equal(tavernSpells.length, 65);
  assert.deepEqual(byTier(tavernSpells), tavernSpellCounts.byTier);
  assert.ok(
    tavernSpells.every(
      (card) =>
        Number.isInteger(card.tier) && card.tier >= 1 && card.tier <= 6,
    ),
  );
  for (const duosCardId of ["BG31_242", "BG31_243", "BG31_244"]) {
    assert.equal(
      tavernSpells.some((card) => card.id === duosCardId),
      false,
    );
  }
});

test("preserves stable Tavern Spell facts and tribe associations", () => {
  for (const card of tavernSpells) {
    assert.match(card.id, /^[A-Za-z0-9_]+$/);
    assert.ok(Number.isInteger(card.dbfId) && card.dbfId > 0);
    assert.ok(typeof card.name === "string" && card.name.length > 0);
    assert.ok(Number.isInteger(card.cost) && card.cost >= 0);
    assert.ok(Array.isArray(card.associatedRaces));
    assert.ok(Array.isArray(card.mechanics));
    assert.ok(Array.isArray(card.referencedTags));
    assert.equal(typeof card.text, "string");
  }
  assert.equal(
    tavernSpells.filter((card) => card.associatedRaces.length > 0).length,
    24,
  );
  assert.deepEqual(
    tavernSpells.find((card) => card.id === "BG34_689"),
    {
      id: "BG34_689",
      dbfId: 126676,
      name: "鲜血宝石弹幕",
      tier: 3,
      cost: 1,
      associatedRaces: ["QUILBOAR"],
      mechanics: [],
      referencedTags: [
        "BACON_REFRESH_TOOLTIP",
        "BACON_BLOOD_GEM_TOOLTIP",
      ],
      text: "在本局对战中，在酒馆<b>刷新</b>后，使其中的随从获得+1/+1的<b>鲜血宝石</b>。",
    },
  );
});

test("records the complete source-to-Solo filtering counts", () => {
  assert.deepEqual(counts, {
    rawPoolMinions: 278,
    duosExcluded: 29,
    soloPoolMinions: 249,
    tierSevenExcluded: 12,
    snapshotMinions: 237,
    byTier: {
      1: 22,
      2: 32,
      3: 41,
      4: 50,
      5: 57,
      6: 35,
    },
  });
  assert.equal(
    counts.rawPoolMinions - counts.duosExcluded,
    counts.soloPoolMinions,
  );
  assert.equal(
    counts.soloPoolMinions - counts.tierSevenExcluded,
    counts.snapshotMinions,
  );
});

test("contains exactly the 237 Solo Tavern Tier 1-6 minions", () => {
  assert.equal(minions.length, 237);
  assert.deepEqual(byTier(minions), counts.byTier);
  assert.ok(
    minions.every(
      (card) =>
        Number.isInteger(card.tier) && card.tier >= 1 && card.tier <= 6,
    ),
  );
  assert.ok(minions.every((card) => !card.id.startsWith("BGDUO")));
});

test("preserves the complete effect-generated Solo Tier 7 pool", () => {
  assert.equal(tierSevenMinions.length, counts.tierSevenExcluded);
  assert.ok(tierSevenMinions.every((card) => card.tier === 7));
  assert.deepEqual(
    tierSevenMinions.map((card) => card.id),
    [
      "BG23_017",
      "BG25_034",
      "BG26_149",
      "BG27_016",
      "BG27_017",
      "BG27_514",
      "BG31_999",
      "BG34_145",
      "BG34_319",
      "BG34_320",
      "BG34_322",
      "BG34_950",
    ],
  );
});

test("has unique stable card and premium identifiers", () => {
  for (const field of ["id", "dbfId", "premiumDbfId"]) {
    const values = [...minions, ...tierSevenMinions].map(
      (card) => card[field],
    );
    assert.equal(
      new Set(values).size,
      values.length,
      `${field} must be unique`,
    );
  }
});

test("preserves the fields needed by the future live-roster engine", () => {
  for (const card of minions) {
    assert.match(card.id, /^[A-Za-z0-9_]+$/);
    assert.ok(Number.isInteger(card.dbfId) && card.dbfId > 0);
    assert.ok(Number.isInteger(card.premiumDbfId) && card.premiumDbfId > 0);
    assert.ok(typeof card.name === "string" && card.name.length > 0);
    assert.ok(Number.isInteger(card.attack));
    assert.ok(Number.isInteger(card.health));
    assert.ok(Array.isArray(card.races));
    assert.ok(Array.isArray(card.associatedRaces));
    assert.ok(Array.isArray(card.mechanics));
    assert.ok(Array.isArray(card.referencedTags));
    assert.equal(typeof card.elite, "boolean");
    assert.equal(typeof card.text, "string");
  }

  assert.equal(minions.filter((card) => card.races.length > 1).length, 13);
  assert.equal(
    minions.filter((card) => card.associatedRaces.length > 0).length,
    5,
  );
  assert.equal(minions.filter((card) => card.elite).length, 21);
  assert.equal(
    minions.find((card) => card.id === "BG_LOE_077")?.elite,
    true,
  );
  assert.equal(
    minions.find((card) => card.id === "BG20_100")?.elite,
    false,
  );
});

test("is sorted deterministically by Tier and CardID", () => {
  for (const cards of [minions, tierSevenMinions, tavernSpells]) {
    const actual = cards.map((card) => `${card.tier}:${card.id}`);
    const sorted = [...cards]
      .sort(
        (left, right) =>
          left.tier - right.tier ||
          left.id.localeCompare(right.id, "en"),
      )
      .map((card) => `${card.tier}:${card.id}`);
    assert.deepEqual(actual, sorted);
  }
});

test("matches the 36.0.3 returning and removed minion sentinels", () => {
  const sanguineRefiner = minions.find((card) => card.id === "BG33_885");
  assert.deepEqual(
    {
      name: sanguineRefiner?.name,
      tier: sanguineRefiner?.tier,
      attack: sanguineRefiner?.attack,
      health: sanguineRefiner?.health,
    },
    {
      name: "鲜血精研者",
      tier: 6,
      attack: 3,
      health: 11,
    },
  );
  assert.equal(
    minions.some((card) => card.id === "BG32_433"),
    false,
    "睡梦织棘者 was removed in 36.0.3",
  );
});
