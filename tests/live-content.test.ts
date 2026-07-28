import assert from "node:assert/strict";
import test from "node:test";

import snapshot from "../lib/game/generated/battlegrounds-36.0.3-247416.zhCN.json" with {
  type: "json",
};
import {
  CLASSIC_ROSTER_VERSION,
  CURRENT_ROSTER_VERSION,
  LEGACY_RULE_DEFINITIONS,
  LIVE_MINION_DEFINITIONS,
  LIVE_TOKEN_DEFINITIONS,
  MINION_DEFINITIONS,
  TOKEN_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";

const EXPECTED_TIERS = {
  1: 22,
  2: 32,
  3: 41,
  4: 50,
  5: 57,
  6: 35,
} as const;

const REUSED_RULE_CARD_IDS = [
  "BGS_004",
  "BGS_071",
  "BG_LOE_077",
  "BG25_354",
  "BGS_012",
  "BGS_018",
] as const;

const SOURCE_TRIBES: Readonly<Record<string, string>> = {
  BEAST: "beast",
  MECHANICAL: "mech",
  DEMON: "demon",
  MURLOC: "murloc",
  DRAGON: "dragon",
  PIRATE: "pirate",
  ELEMENTAL: "elemental",
  NAGA: "naga",
  QUILBOAR: "quilboar",
  UNDEAD: "undead",
  ALL: "all",
};

function expectedPlainText(html: string): string {
  return html
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

test("exports the pinned current roster version through the legacy alias", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v8",
  );
  assert.equal(CLASSIC_ROSTER_VERSION, CURRENT_ROSTER_VERSION);
});

test("maps all 237 live Solo Tavern minions as the only collectible cards", () => {
  assert.equal(LIVE_MINION_DEFINITIONS.length, 237);
  assert.ok(
    LIVE_MINION_DEFINITIONS.every(
      (definition) => definition.collectible === true,
    ),
  );

  for (const [tier, expected] of Object.entries(EXPECTED_TIERS)) {
    assert.equal(
      LIVE_MINION_DEFINITIONS.filter(
        (definition) => definition.tier === Number(tier),
      ).length,
      expected,
    );
  }

  const collectible = MINION_DEFINITIONS.filter(
    (definition) => definition.collectible !== false,
  );
  assert.deepEqual(collectible, LIVE_MINION_DEFINITIONS);
  assert.equal(new Set(collectible.map((card) => card.id)).size, 237);
});

test("keeps legacy rules and tokens addressable but out of the shared pool", () => {
  assert.equal(LEGACY_RULE_DEFINITIONS.length, 36);
  assert.equal(TOKEN_DEFINITIONS.length, 9);
  assert.equal(LIVE_TOKEN_DEFINITIONS.length, 5);
  assert.ok(
    [
      ...LEGACY_RULE_DEFINITIONS,
      ...TOKEN_DEFINITIONS,
      ...LIVE_TOKEN_DEFINITIONS,
    ].every(
      (definition) => definition.collectible === false,
    ),
  );
  assert.equal(getMinionDefinition("wrath-weaver").collectible, false);
  assert.equal(getMinionDefinition("BGS_004").collectible, true);
  assert.equal(
    MINION_DEFINITIONS.filter(
      (definition) => definition.collectible !== false,
    ).some((definition) => definition.id === "wrath-weaver"),
    false,
  );
});

test("preserves printed, dual, all, and associated minion types", () => {
  const thorncaptain = getMinionDefinition("BG25_039");
  assert.equal(thorncaptain.tribe, "quilboar");
  assert.deepEqual(thorncaptain.tribes, ["quilboar", "naga"]);
  assert.deepEqual(thorncaptain.associatedTribes, []);

  const kangor = getMinionDefinition("BGS_012");
  assert.equal(kangor.tribe, "neutral");
  assert.deepEqual(kangor.tribes, []);
  assert.deepEqual(kangor.associatedTribes, ["mech"]);

  const nightmareTeaGuest = getMinionDefinition("BG32_111");
  assert.equal(nightmareTeaGuest.tribe, "all");
  assert.deepEqual(nightmareTeaGuest.tribes, ["all"]);

  assert.equal(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => (definition.tribes?.length ?? 0) > 1,
    ).length,
    13,
  );
});

test("maps every source card's identity, stats, types, and base keywords", () => {
  assert.equal(snapshot.minions.length, LIVE_MINION_DEFINITIONS.length);

  for (const source of snapshot.minions) {
    const definition = getMinionDefinition(source.id);
    const expectedTribes = source.races.map((race) => SOURCE_TRIBES[race]);
    const expectedAssociated = source.associatedRaces.map(
      (race) => SOURCE_TRIBES[race],
    );
    assert.ok(
      expectedTribes.every(Boolean) && expectedAssociated.every(Boolean),
      `${source.id} contains an unmapped source race`,
    );
    assert.equal(definition.cardId, source.id);
    assert.equal(definition.name, source.name);
    assert.equal(definition.tier, source.tier);
    assert.equal(definition.attack, source.attack);
    assert.equal(definition.health, source.health);
    assert.deepEqual(definition.tribes, expectedTribes);
    assert.deepEqual(definition.associatedTribes, expectedAssociated);
    const expectedDescription =
      {
        BG26_810:
          "每当你花掉\n6枚铸币，使你的海盗获得+2攻击力。（还剩6枚！）",
        BG21_018:
          "每当本随从通过其他来源获得攻击力时，获得+1生命值。",
        BG26_199:
          "每2个回合，在回合结束时，获取一张本随从左边随从的原始版复制。（还剩2回合！）",
        BG26_529:
          "每3个回合，在回合结束时，随机获取一张龙牌。（还剩3回合！）",
        BG27_005:
          "每当你施放一个酒馆法术，使你的随从获得+1攻击力。",
        BG31_035:
          "在你使用一张纳迦牌后，获得+1/+1。（在本局对战中，你每施放4个法术都会提升！）",
        BG31_816:
          "当你出售本随从时，使你的随从获得+1攻击力。提升你此后投球手的效果。",
        BG31_818:
          "当你出售本随从时，使你的随从获得+1生命值。提升你此后投球手的效果。",
        BG32_235:
          "在你的回合结束时，使相邻的随从获得+1攻击力。每有一个友方金色随从，重复一次。",
        BG35_601:
          "每当本随从受到伤害，获得一次免费的刷新。（每回合限3次。）",
        BG35_801:
          "一旦你购买了4张牌，获得+4/+4。（还剩4张！）",
        BG35_814:
          "一旦本随从的攻击力达到6点，获得圣盾。",
      }[source.id] ?? expectedPlainText(source.text);
    assert.equal(definition.description, expectedDescription);
    assert.equal(definition.taunt, source.mechanics.includes("TAUNT"));
    assert.equal(
      definition.divineShield,
      source.mechanics.includes("DIVINE_SHIELD"),
    );
    assert.equal(definition.reborn, source.mechanics.includes("REBORN"));
    assert.equal(definition.windfury, source.mechanics.includes("WINDFURY"));
    assert.equal(definition.venomous, source.mechanics.includes("VENOMOUS"));
  }
});

test("converts localized Hearthstone HTML into readable Chinese plain text", () => {
  assert.equal(
    getMinionDefinition("BG20_100").description,
    "战吼：获取2张\n鲜血宝石。",
  );
  assert.equal(
    getMinionDefinition("BG_LOE_077").description,
    "你的战吼会触发\n两次。",
  );
  assert.ok(
    LIVE_MINION_DEFINITIONS.every(
      (definition) => !/<[^>]+>/u.test(definition.description),
    ),
  );
  assert.ok(
    LIVE_MINION_DEFINITIONS.every(
      (definition) =>
        !/\+\d+\/\+0/u.test(definition.description) &&
        !/(?<=[。！？）)！])\d(?=[\p{Script=Han}（(])/u.test(
          definition.description,
        ),
    ),
  );
});

test("maps supported basic keywords and exact cleave text", () => {
  const risenRider = getMinionDefinition("BG25_001");
  assert.equal(risenRider.taunt, true);
  assert.equal(risenRider.reborn, true);
  assert.equal(risenRider.effectSupport, "complete");

  const cracklingCyclone = getMinionDefinition("BGS_119");
  assert.equal(cracklingCyclone.divineShield, true);
  assert.equal(cracklingCyclone.windfury, true);
  assert.equal(cracklingCyclone.effectSupport, "complete");

  const deadlySpore = getMinionDefinition("BGS_131");
  assert.equal(deadlySpore.venomous, true);
  assert.equal(deadlySpore.poisonous, false);
  assert.equal(deadlySpore.effectSupport, "complete");

  const bladeCollector = getMinionDefinition("BG26_817");
  assert.equal(bladeCollector.cleave, true);
  assert.equal(bladeCollector.effectSupport, "complete");

  const cordPuller = getMinionDefinition("BG29_611");
  assert.equal(cordPuller.divineShield, true);
  assert.equal(cordPuller.effectSupport, "complete");

  const boneheadDeathrattle =
    getMinionDefinition("BG28_300").deathrattle?.[0];
  assert.equal(boneheadDeathrattle?.kind, "summon");
  assert.equal(
    boneheadDeathrattle?.kind === "summon"
      ? boneheadDeathrattle.goldenMode
      : undefined,
    "doubleCount",
  );
  const cordPullerDeathrattle =
    getMinionDefinition("BG29_611").deathrattle?.[0];
  assert.equal(cordPullerDeathrattle?.kind, "summon");
  assert.equal(
    cordPullerDeathrattle?.kind === "summon"
      ? cordPullerDeathrattle.goldenMode
      : undefined,
    undefined,
  );
  const tunnelBlasterDeathrattle =
    getMinionDefinition("BG_DAL_775").deathrattle?.[0];
  assert.equal(tunnelBlasterDeathrattle?.kind, "damageAllMinions");
  assert.equal(
    tunnelBlasterDeathrattle?.kind === "damageAllMinions"
      ? tunnelBlasterDeathrattle.goldenMode
      : undefined,
    "repeat",
  );
  assert.equal(getMinionDefinition("BGS_049").goldenSellValue, 6);
});

test("maps Magnetic targets, generation, and the first complete live Magnetic effects", () => {
  assert.deepEqual(getMinionDefinition("BG26_146").magnetic, {
    targetTribes: ["mech"],
  });
  assert.deepEqual(getMinionDefinition("BG26_146").endOfTurn, {
    kind: "buff",
    target: "self",
    attack: 0,
    health: 1,
  });
  assert.deepEqual(getMinionDefinition("BG26_147").startOfTurn, [
    { kind: "gainGold", amount: 1 },
  ]);
  assert.deepEqual(getMinionDefinition("BG26_148").deathrattle, [
    {
      kind: "getRandomMinion",
      count: 1,
      filter: {
        tribe: "mech",
        magnetic: true,
      },
      maximumTier: "ownerTavern",
      source: "sharedPool",
      goldenMode: "doubleCount",
    },
  ]);
  assert.deepEqual(getMinionDefinition("BG31_175").rally, [
    {
      kind: "getRandomMinion",
      count: 1,
      filter: {
        tribe: "mech",
        magnetic: true,
      },
      maximumTier: "ownerTavern",
      source: "sharedPool",
      goldenMode: "doubleCount",
    },
  ]);
  assert.deepEqual(getMinionDefinition("BG33_241").rally, [
    {
      kind: "buff",
      target: "rightFriendly",
      attack: 2,
      health: 2,
      goldenMode: "doubleStats",
    },
  ]);
  assert.deepEqual(getMinionDefinition("BG31_859").magnetic, {
    targetTribes: ["mech", "elemental"],
  });
  assert.deepEqual(getMinionDefinition("BG_DEEP_015").magnetic, {
    targetTribes: ["mech", "undead"],
  });
  assert.deepEqual(getMinionDefinition("BG32_172").deathrattle, [
    {
      kind: "summon",
      definitionId: "BG_TTN_401",
      count: 1,
      goldenMode: "goldenToken",
    },
  ]);
  assert.deepEqual(getMinionDefinition("BG34_175").afterMagnetized, [
    {
      kind: "buff",
      target: "allFriendly",
      attack: 5,
      health: 5,
    },
  ]);
  assert.equal(getMinionDefinition("BG35_341").effectSupport, "partial");
});

test("reuses the six exact legacy rules that still match live card text", () => {
  for (const cardId of REUSED_RULE_CARD_IDS) {
    assert.equal(getMinionDefinition(cardId).effectSupport, "complete");
  }

  assert.deepEqual(getMinionDefinition("BGS_004").afterFriendlyPlayed, {
    tribe: "demon",
    attack: 2,
    health: 2,
    heroDamage: 1,
  });
  assert.deepEqual(getMinionDefinition("BGS_071").afterFriendlySummoned, {
    tribe: "mech",
    attack: 2,
    grantShield: true,
  });
  assert.equal(getMinionDefinition("BG_LOE_077").extraBattlecries, 1);
  assert.equal(getMinionDefinition("BG25_354").extraDeathrattles, 1);
  assert.deepEqual(getMinionDefinition("BGS_012").deathrattle, [
    { kind: "resummonMechs", count: 2 },
  ]);
  assert.deepEqual(getMinionDefinition("BGS_018").deathrattle, [
    {
      kind: "buff",
      target: "friendlyTribe",
      tribe: "beast",
      attack: 8,
      health: 8,
    },
  ]);
});

test("marks every live card honestly as complete or partial", () => {
  assert.ok(
    LIVE_MINION_DEFINITIONS.every(
      (definition) =>
        definition.effectSupport === "complete" ||
        definition.effectSupport === "partial",
    ),
  );
  assert.ok(
    LIVE_MINION_DEFINITIONS.some(
      (definition) => definition.effectSupport === "complete",
    ),
  );
  assert.ok(
    LIVE_MINION_DEFINITIONS.some(
      (definition) => definition.effectSupport === "partial",
    ),
  );
  assert.deepEqual(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "complete",
    )
      .map((definition) => definition.id)
      .sort(),
    [
      "BG25_001",
      "BG25_010",
      "BG25_022",
      "BG25_354",
      "BG26_146",
      "BG26_147",
      "BG26_148",
      "BG21_014",
      "BG26_817",
      "BG26_805",
      "BG28_300",
      "BG29_503",
      "BG29_611",
      "BG30_125",
      "BG31_175",
      "BG31_803",
      "BG31_859",
      "BG32_172",
      "BG32_235",
      "BG33_156",
      "BG33_241",
      "BG34_175",
      "BG34_523",
      "BG34_630",
      "BG34_636t",
      "BG34_637t",
      "BG34_731",
      "BG35_702",
      "BG_DAL_775",
      "BG_BOT_911",
      "BG_DEEP_015",
      "BGS_004",
      "BGS_049",
      "BGS_012",
      "BGS_018",
      "BGS_071",
      "BGS_119",
      "BGS_131",
      "BG_LOE_077",
    ].sort(),
  );
  assert.equal(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "partial",
    ).length,
    198,
  );
  assert.equal(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "complete",
    ).length,
    39,
  );
  assert.deepEqual(getMinionDefinition("BG35_702").interactiveBattlecry, {
    kind: "targetedBuff",
    target: "otherFriendly",
    attack: 2,
    health: 2,
    attackPerTavernSpell: 2,
    healthPerTavernSpell: 2,
    goldenMode: "repeat",
  });
  assert.deepEqual(getMinionDefinition("BG34_523").interactiveBattlecry, {
    kind: "discoverMinion",
    tribe: "beast",
    goldenMode: "repeat",
  });
  assert.deepEqual(getMinionDefinition("BG29_503").interactiveBattlecry, {
    kind: "targetedDiscoverMagnetize",
    targetTribe: "mech",
    discoverTribe: "mech",
    goldenMode: "repeat",
  });
});
