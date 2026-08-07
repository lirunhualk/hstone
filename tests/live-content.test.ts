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
  TIER_SEVEN_MINION_DEFINITIONS,
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
    "battlegrounds-36.0.3-247416-v52",
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

test("keeps all current Tier 7 rewards addressable but outside the Tavern pool", () => {
  assert.equal(TIER_SEVEN_MINION_DEFINITIONS.length, 12);
  assert.ok(
    TIER_SEVEN_MINION_DEFINITIONS.every(
      (definition) =>
        definition.tier === 7 &&
        definition.collectible === false &&
        definition.effectSupport === "complete",
    ),
  );
  assert.deepEqual(
    TIER_SEVEN_MINION_DEFINITIONS.map((definition) => definition.id),
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
  assert.equal(getMinionDefinition("BG34_322").attack, 16);
  assert.equal(getMinionDefinition("BG34_322").health, 32);
});

test("keeps legacy rules and tokens addressable but out of the shared pool", () => {
  assert.equal(LEGACY_RULE_DEFINITIONS.length, 36);
  assert.equal(TOKEN_DEFINITIONS.length, 11);
  assert.equal(LIVE_TOKEN_DEFINITIONS.length, 47);
  assert.ok(
    [
      ...LEGACY_RULE_DEFINITIONS,
      ...TOKEN_DEFINITIONS,
      ...LIVE_TOKEN_DEFINITIONS,
      ...TIER_SEVEN_MINION_DEFINITIONS,
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

test("maps persistent Tier 2 minions to their real normal and Golden cards", () => {
  const automaton = getMinionDefinition("BG_TTN_401");
  assert.equal(automaton.attack, 3);
  assert.equal(automaton.health, 4);
  assert.equal(
    automaton.description,
    "在本局对战中，你每召唤过一个其他星元自动机，便拥有+3/+2（无论本随从在哪）。",
  );
  assert.equal(automaton.goldenCardId, "BG_TTN_401_G");
  assert.equal(
    automaton.goldenDescription,
    "在本局对战中，你每召唤过一个其他星元自动机，便拥有+6/+4（无论本随从在哪）。",
  );

  const eternalKnight = getMinionDefinition("BG25_008");
  assert.equal(eternalKnight.attack, 4);
  assert.equal(eternalKnight.health, 2);
  assert.equal(
    eternalKnight.description,
    "在本局对战中，每有一个友方永恒骑士死亡，便拥有+4/+2（无论本随从在哪）。",
  );
  assert.equal(eternalKnight.goldenCardId, "BG25_008_G");
  assert.equal(
    eternalKnight.goldenDescription,
    "在本局对战中，每有一个友方永恒骑士死亡，便拥有+8/+4（无论本随从在哪）。",
  );

  const ancientSoul = getMinionDefinition("BG34_231");
  assert.equal(ancientSoul.attack, 3);
  assert.equal(ancientSoul.health, 4);
  assert.equal(
    ancientSoul.description,
    "当本随从在你手牌中时，在15个友方随从死亡后，将本随从变为金色。（还剩15个！）",
  );
  assert.equal(ancientSoul.goldenCardId, "BG34_231_G");
  assert.equal(
    ancientSoul.goldenDescription,
    "当本随从在你手牌中时，在15个友方随从死亡后，将本随从变为金色。（已完成！）",
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
  assert.deepEqual(getMinionDefinition("BG34_140").rally, [
    {
      kind: "summonFromHand",
      selection: "highestAttack",
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);
  assert.deepEqual(getMinionDefinition("BG25_016").rally, [
    {
      kind: "removeTargetKeywords",
      keywords: ["reborn", "taunt"],
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
  assert.equal(getMinionDefinition("BG35_341").effectSupport, "complete");
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

test("maps the fifth complete-effects batch to its real Golden cards and rules", () => {
  assert.deepEqual(
    [
      "BG26_810",
      "BG31_824",
      "BG23_018",
      "BG33_823",
      "BG26_814",
      "BG29_840",
      "BG29_841",
      "BG33_893",
      "BG26_137",
      "BG30_122",
      "BG32_846",
      "BGS_104",
    ].map((cardId) => getMinionDefinition(cardId).goldenCardId),
    [
      "BG26_810_G",
      "BG31_824_G",
      "BG23_018_G",
      "BG33_823_G",
      "BG26_814_G",
      "BG29_840_G",
      "BG29_841_G",
      "BG33_893_G",
      "BG26_137_G",
      "BG30_122_G",
      "BG32_846_G",
      "TB_BaconUps_201",
    ],
  );

  assert.deepEqual(getMinionDefinition("BG26_810").afterGoldSpent, {
    threshold: 6,
    effects: [
      {
        kind: "buff",
        target: "friendlyTribe",
        tribe: "pirate",
        attack: 2,
        health: 0,
      },
    ],
  });
  assert.deepEqual(getMinionDefinition("BG31_824").afterGoldSpent, {
    threshold: 5,
    effects: [
      {
        kind: "buff",
        target: "randomFriendlyTribe",
        tribe: "pirate",
        count: 2,
        includeSelf: true,
        attack: 3,
        health: 4,
      },
    ],
  });
  assert.deepEqual(getMinionDefinition("BG23_018").afterGoldSpent, {
    threshold: 8,
    effects: [
      {
        kind: "applyBloodGemsToTribe",
        tribe: "quilboar",
        count: 2,
      },
    ],
  });
  assert.equal(
    getMinionDefinition("BG33_823").afterGoldSpent?.effects[0]?.kind,
    "gainRandomTavernSpell",
  );
  assert.deepEqual(getMinionDefinition("BG26_814").interactiveBattlecry, {
    kind: "targetedBuff",
    target: "friendlyTribe",
    targetTribe: "pirate",
    attack: 0,
    health: 1,
    attackPerTavernSpell: 0,
    healthPerTavernSpell: 0,
    healthPerGoldSpentThisTurn: 1,
    goldenMode: "repeat",
  });
  assert.deepEqual(getMinionDefinition("BG29_840").afterCardPlayed, {
    filter: { tierParity: "odd" },
    effects: [
      {
        kind: "buff",
        target: "allFriendly",
        tierParity: "odd",
        attack: 1,
        health: 1,
      },
    ],
  });
  assert.deepEqual(getMinionDefinition("BG29_841").afterCardPlayed, {
    filter: { tierParity: "even" },
    effects: [
      {
        kind: "buff",
        target: "allFriendly",
        tierParity: "even",
        attack: 2,
        health: 2,
      },
    ],
  });
  assert.deepEqual(getMinionDefinition("BG33_893").afterCardPlayed, {
    filter: { maximumTier: 3 },
    effects: [
      {
        kind: "buff",
        target: "friendlyTribe",
        tribe: "murloc",
        attack: 2,
        health: 2,
      },
    ],
  });
  assert.deepEqual(getMinionDefinition("BG26_137").inHandAfterCardPlayed, {
    filter: { tribe: "murloc" },
    effects: [{ kind: "buff", target: "self", attack: 6, health: 6 }],
  });
  assert.deepEqual(getMinionDefinition("BG30_122").afterCardPlayed, {
    filter: { tribe: "murloc" },
    effects: [
      {
        kind: "buff",
        target: "randomFriendly",
        includeSelf: true,
        attack: 5,
        health: 5,
      },
      { kind: "buffRandomHandMinion", attack: 5, health: 5 },
    ],
  });
  assert.deepEqual(getMinionDefinition("BG32_846").afterCardPlayed, {
    filter: { tribe: "elemental" },
    effects: [
      {
        kind: "buff",
        target: "friendlyTribe",
         tribe: "elemental",
         attack: 4,
         health: 4,
         goldenMode: "repeat",
      },
    ],
  });
  assert.deepEqual(getMinionDefinition("BGS_104").afterCardPlayed, {
    filter: { tribe: "elemental" },
    effects: [
      {
        kind: "buffTavernType",
        tribe: "elemental",
        attack: 4,
        health: 4,
      },
    ],
  });
});

test("maps the sixth complete Rally batch to its exact ordinary and Golden rules", () => {
  const expectations = [
    {
      cardId: "BG33_323",
      description:
        "进击：\n在本局对战中，你的亡灵拥有+2攻击力（无论它们在哪）。",
      goldenCardId: "BG33_323_G",
      goldenDescription:
        "进击：\n在本局对战中，你的亡灵拥有+4攻击力（无论它们在哪）。",
      rally: [
        {
          kind: "improveUndeadArmy",
          attack: 2,
          health: 0,
        },
      ],
      stealth: false,
    },
    {
      cardId: "BG34_604",
      description: "潜行。进击：获得目标的攻击力。",
      goldenCardId: "BG34_604_G",
      goldenDescription: "潜行。进击：获得目标的双倍攻击力。",
      rally: [{ kind: "gainTargetAttack" }],
      stealth: true,
    },
    {
      cardId: "BG34_925",
      description: "进击：对本随从右边的随从施放主厨\n甄选。",
      goldenCardId: "BG34_925_G",
      goldenDescription:
        "进击：对本随从右边的随从施放主厨甄选，触发两次。",
      rally: [
        {
          kind: "castChefsChoice",
          target: "rightFriendly",
          goldenMode: "repeat",
        },
      ],
      stealth: false,
    },
    {
      cardId: "BG33_318",
      description: "烈毒。进击：使另一个友方鱼人获得烈毒。",
      goldenCardId: "BG33_318_G",
      goldenDescription:
        "烈毒。进击：使2个其他友方鱼人获得烈毒。",
      rally: [
        {
          kind: "grantVenomous",
          target: "otherFriendlyTribe",
          tribe: "murloc",
          count: 1,
          goldenMode: "doubleCount",
        },
      ],
      stealth: false,
    },
    {
      cardId: "BG33_885",
      description:
        "进击：在本局对战中，你的鲜血宝石使随从额外获得+1/+2。",
      goldenCardId: "BG33_885_G",
      goldenDescription:
        "进击：在本局对战中，你的鲜血宝石使随从额外获得+2/+4。",
      rally: [
        {
          kind: "improveBloodGems",
          attack: 1,
          health: 2,
        },
      ],
      stealth: false,
    },
    {
      cardId: "BG34_765",
      description: "进击：使4个其他友方随从获得本随从的攻击力。",
      goldenCardId: "BG34_765_G",
      goldenDescription:
        "进击：使4个其他友方随从获得本随从的攻击力，触发两次。",
      rally: [
        {
          kind: "grantSourceAttack",
          target: "otherFriendly",
          count: 4,
          goldenMode: "repeat",
        },
      ],
      stealth: false,
    },
  ] as const;

  for (const expectation of expectations) {
    const definition = getMinionDefinition(expectation.cardId);
    assert.equal(definition.effectSupport, "complete");
    assert.equal(definition.description, expectation.description);
    assert.equal(definition.goldenCardId, expectation.goldenCardId);
    assert.equal(
      definition.goldenDescription,
      expectation.goldenDescription,
    );
    assert.deepEqual(definition.rally, expectation.rally);
    assert.equal(definition.stealth, expectation.stealth);
    assert.ok(definition.printedMechanics?.includes("BACON_RALLY"));
  }

  assert.ok(
    getMinionDefinition("BG34_604").printedMechanics?.includes(
      "STEALTH",
    ),
  );
});

test("maps Merciless Queen's Guard to the same exact Tavern Spell cast for Battlecry, Deathrattle, and Rally", () => {
  const definition = getMinionDefinition("BG34_926");
  const castQueensCommand = [
    {
      kind: "castTavernSpell",
      definitionId: "tavern-spell-queens-command",
      goldenMode: "repeat",
    },
  ] as const;

  assert.equal(definition.effectSupport, "complete");
  assert.equal(
    definition.description,
    "战吼，亡语，进击：施放女王的命令。",
  );
  assert.equal(definition.goldenCardId, "BG34_926_G");
  assert.equal(
    definition.goldenDescription,
    "战吼，亡语，进击：施放女王的命令，触发两次。",
  );
  assert.deepEqual(definition.battlecry, castQueensCommand);
  assert.deepEqual(definition.deathrattle, castQueensCommand);
  assert.deepEqual(definition.rally, castQueensCommand);
  assert.ok(definition.printedMechanics?.includes("BATTLECRY"));
  assert.ok(definition.printedMechanics?.includes("DEATHRATTLE"));
  assert.ok(definition.printedMechanics?.includes("BACON_RALLY"));
});

test("marks every live card as fully implemented", () => {
  assert.ok(
    LIVE_MINION_DEFINITIONS.every(
      (definition) =>
        definition.effectSupport === "complete" ||
        definition.effectSupport === "partial",
    ),
  );
  assert.ok(
    LIVE_MINION_DEFINITIONS.every(
      (definition) => definition.effectSupport === "complete",
    ),
  );
  assert.deepEqual(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "complete",
    )
      .map((definition) => definition.id)
      .sort(),
    [
      "BG26_801",
      "BG28_550",
      "BG30_129",
      "BG31_820",
      "BG31_835",
      "BG32_841",
      "BG32_842",
      "BG33_891",
      "BG33_920",
      "BG35_342",
      "BG35_890",
      "BGS_041",
      "BG20_100",
      "BG20_203",
      "BG20_301",
      "BG21_005",
      "BG21_015",
      "BG21_018",
      "BG24_009",
      "BG24_500",
      "BG24_707",
      "BG24_715",
      "BG22_202",
      "BG23_002",
      "BG23_004",
      "BG23_008",
      "BG23_009",
      "BG23_018",
      "BG23_318",
      "BG24_018",
      "BG25_001",
      "BG25_008",
      "BG25_009",
      "BG25_010",
      "BG25_011",
      "BG25_013",
      "BG25_016",
      "BG25_022",
      "BG25_032",
      "BG25_039",
      "BG25_041",
      "BG25_806",
      "BG25_354",
      "BG26_146",
      "BG26_135",
      "BG26_137",
      "BG26_147",
      "BG26_148",
      "BG26_157",
      "BG26_159",
      "BG26_160",
      "BG26_162",
      "BG26_174",
      "BG26_175",
      "BG26_199",
      "BG26_354",
      "BG26_360",
      "BG26_501",
      "BG26_502",
      "BG26_505",
      "BG26_524",
      "BG26_525",
      "BG26_529",
      "BG21_014",
      "BG26_802",
      "BG26_817",
      "BG26_867",
      "BG26_805",
      "BG26_810",
      "BG26_814",
      "BG26_ICC_901",
      "BG27_002",
      "BG27_004",
      "BG27_005",
      "BG27_084",
      "BG27_556",
      "BG28_300",
      "BG28_303",
      "BG28_551",
      "BG28_583",
      "BG28_595",
      "BG28_633",
      "BG28_741",
      "BG28_308",
      "BG28_309",
      "BG29_503",
      "BG29_611",
      "BG29_806",
      "BG29_807",
      "BG29_808",
      "BG29_816",
      "BG29_813",
      "BG29_840",
      "BG29_841",
      "BG29_862",
      "BG29_300",
      "BG30_117",
      "BG30_121",
      "BG30_122",
      "BG30_123",
      "BG30_125",
      "BG31_035",
      "BG31_171",
      "BG31_175",
      "BG31_178",
      "BG31_330",
      "BG31_801",
      "BG31_803",
      "BG31_809",
      "BG31_815",
      "BG31_816",
      "BG31_818",
      "BG31_824",
      "BG31_859",
      "BG31_920",
      "BG32_172",
      "BG32_170",
      "BG32_111",
      "BG32_204",
      "BG32_234",
      "BG32_235",
      "BG32_236",
      "BG32_237",
      "BG32_324",
      "BG32_341",
      "BG32_430",
      "BG32_330",
      "BG32_821",
      "BG32_822",
      "BG32_835",
      "BG32_846",
      "BG32_873",
      "BG32_880",
      "BG32_891",
      "BG33_156",
      "BG33_154",
      "BG33_155",
      "BG33_140",
      "BG33_241",
      "BG33_240",
      "BG33_318",
      "BG33_323",
      "BG33_319",
      "BG33_820",
      "BG33_821",
      "BG33_822",
      "BG33_823",
      "BG33_825",
      "BG33_893",
      "BG33_923",
      "BG33_809",
      "BG33_888",
      "BG33_894",
      "BG33_885",
      "BG34_140",
      "BG34_142",
      "BG34_175",
      "BG34_231",
      "BG34_312",
      "BG34_321",
      "BG34_403",
      "BG34_500",
      "BG34_523",
      "BG34_604",
      "BG34_630",
      "BG34_632",
      "BG34_633",
      "BG34_634t",
      "BG34_635t",
      "BG34_636t",
      "BG34_637t",
      "BG34_638t",
      "BG34_682",
      "BG34_683",
      "BG34_684",
      "BG34_690",
      "BG34_692",
      "BG34_694",
      "BG34_731",
      "BG34_765",
      "BG34_781",
      "BG34_856",
      "BG34_858",
      "BG34_865",
      "BG34_920",
      "BG34_921",
      "BG34_922",
      "BG34_925",
      "BG34_926",
      "BG35_143",
      "BG35_123",
      "BG35_140",
      "BG35_141",
      "BG35_142",
      "BG35_150",
      "BG35_151",
      "BG35_152",
      "BG35_153",
      "BG35_155",
      "BG35_334",
      "BG35_340",
      "BG35_341",
      "BG35_431",
      "BG35_437",
      "BG35_601",
      "BG35_602",
      "BG35_604",
      "BG35_701",
      "BG35_702",
      "BG35_801",
      "BG35_814",
      "BG35_881",
      "BG35_882",
      "BG35_883",
      "BG35_895",
      "BG35_921",
      "BG35_433",
      "BG_DAL_775",
      "BG_BOT_911",
      "BG_DEEP_015",
      "BGS_004",
      "BGS_020",
      "BGS_030",
      "BGS_049",
      "BGS_104",
      "BGS_115",
      "BGS_116",
      "BGS_123",
      "BGS_126",
      "BGS_012",
      "BGS_018",
      "BGS_071",
      "BGS_078",
      "BGS_119",
      "BGS_131",
      "BG_LOE_077",
      "BG_TTN_401",
    ].sort(),
  );
  assert.equal(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "partial",
    ).length,
    0,
  );
  assert.equal(
    LIVE_MINION_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "complete",
    ).length,
    237,
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
