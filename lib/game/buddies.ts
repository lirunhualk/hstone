import type { MinionDefinition } from "./types.ts";

interface FixedBuildBuddyRecord {
  /** Local Hero Power definition that points back to the source Hero card. */
  heroPowerId: string;
  /** Normal and premium dbfIds from HearthstoneJSON build 247416. */
  dbfId: number;
  goldenDbfId: number;
  definition: MinionDefinition;
}

/**
 * Buddy links come from each Hero card's `battlegroundsBuddyDbfId`; CardIDs,
 * stats, types, keywords, and premium links come from the referenced cards in
 * the pinned zhCN HearthstoneJSON build 247416. Their bespoke rules are not
 * represented by the local minion DSL yet, so every definition is explicitly
 * partial instead of pretending that card text is active.
 *
 * Bartendotron (`hero-power-experienced-bartender`) has no Buddy link in that
 * build and is intentionally absent.
 */
const FIXED_BUILD_BUDDY_RECORDS = [
  {
    heroPowerId: "hero-power-see-the-future",
    dbfId: 77512,
    goldenDbfId: 77549,
    definition: {
      id: "TB_BaconShop_HERO_57_Buddy",
      cardId: "TB_BaconShop_HERO_57_Buddy",
      goldenCardId: "TB_BaconShop_HERO_57_Buddy_G",
      name: "克罗米",
      tier: 4,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["AURA", "TRIGGER_VISUAL"],
      legendary: true,
      attack: 6,
      health: 6,
      description: "每回合中，有一次有用的刷新。",
      goldenDescription: "每回合中，有两次有用的刷新。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-ever-blooming",
    dbfId: 77493,
    goldenDbfId: 77541,
    definition: {
      id: "TB_BaconShop_HERO_74_Buddy",
      cardId: "TB_BaconShop_HERO_74_Buddy",
      goldenCardId: "TB_BaconShop_HERO_74_Buddy_G",
      name: "常青绿植",
      tier: 4,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["END_OF_TURN_TRIGGER"],
      attack: 8,
      health: 5,
      description: "在你的回合结束时，随机获取一张你当前等级的随从牌。",
      goldenDescription:
        "在你的回合结束时，随机获取两张你当前等级的随从牌。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-sprout-it-out",
    dbfId: 77502,
    goldenDbfId: 77545,
    definition: {
      id: "TB_BaconShop_HERO_95_Buddy",
      cardId: "TB_BaconShop_HERO_95_Buddy",
      goldenCardId: "TB_BaconShop_HERO_95_Buddy_G",
      name: "游荡树人",
      tier: 4,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["TRIGGER_VISUAL"],
      attack: 3,
      health: 9,
      description:
        "每当一个友方嘲讽随从受到攻击时，使你的随从永久获得+1/+1。",
      goldenDescription:
        "每当一个友方嘲讽随从受到攻击时，使你的随从永久获得+2/+2。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-all-patched-up",
    dbfId: 77817,
    goldenDbfId: 77818,
    definition: {
      id: "TB_BaconShop_HERO_34_Buddy",
      cardId: "TB_BaconShop_HERO_34_Buddy",
      goldenCardId: "TB_BaconShop_HERO_34_Buddy_G",
      name: "迷你憎恶",
      tier: 4,
      tribe: "undead",
      tribes: ["undead"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["END_OF_TURN_TRIGGER"],
      attack: 6,
      health: 6,
      description:
        "在你的回合结束时，使本随从左边的随从获得+1生命值。（你的英雄每缺失一点生命值都会提升。）",
      goldenDescription:
        "在你的回合结束时，使相邻的随从获得+1生命值。（你的英雄每缺失一点生命值都会提升。）",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-smart-savings",
    dbfId: 77847,
    goldenDbfId: 77848,
    definition: {
      id: "TB_BaconShop_HERO_10_Buddy",
      cardId: "TB_BaconShop_HERO_10_Buddy",
      goldenCardId: "TB_BaconShop_HERO_10_Buddy_G",
      name: "锈水大亨",
      tier: 4,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["END_OF_TURN_TRIGGER"],
      attack: 6,
      health: 5,
      description: "在你的回合结束时，你的铸币上限提高1枚。",
      goldenDescription: "在你的回合结束时，你的铸币上限提高2枚。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-manastorm",
    dbfId: 77803,
    goldenDbfId: 77804,
    definition: {
      id: "TB_BaconShop_HERO_49_Buddy",
      cardId: "TB_BaconShop_HERO_49_Buddy",
      goldenCardId: "TB_BaconShop_HERO_49_Buddy_G",
      name: "玛格努斯·法力风暴",
      tier: 4,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      legendary: true,
      attack: 4,
      health: 4,
      description: "每回合中，有两次刷新免费。",
      goldenDescription: "每回合中，有四次刷新免费。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-stay-frosty",
    dbfId: 77724,
    goldenDbfId: 77725,
    definition: {
      id: "TB_BaconShop_HERO_27_Buddy",
      cardId: "TB_BaconShop_HERO_27_Buddy",
      goldenCardId: "TB_BaconShop_HERO_27_Buddy_G",
      name: "解冻的勇士",
      tier: 6,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["END_OF_TURN_TRIGGER"],
      attack: 4,
      health: 5,
      description:
        "在你的回合结束时，随机将酒馆中被冻结的一个随从变为金色。",
      goldenDescription:
        "在你的回合结束时，随机将酒馆中被冻结的2个随从变为金色。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-dream-portal",
    dbfId: 77855,
    goldenDbfId: 77856,
    definition: {
      id: "TB_BaconShop_HERO_53_Buddy",
      cardId: "TB_BaconShop_HERO_53_Buddy",
      goldenCardId: "TB_BaconShop_HERO_53_Buddy_G",
      name: "踏梦者瓦莉瑟瑞娅",
      tier: 1,
      tribe: "dragon",
      tribes: ["dragon"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["TRIGGER_VISUAL"],
      legendary: true,
      attack: 6,
      health: 4,
      description: "每当一条龙进入你的战队或酒馆时，获得+1/+1。",
      goldenDescription: "每当一条龙进入你的战队或酒馆时，获得+2/+2。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-avalanche",
    dbfId: 77780,
    goldenDbfId: 77781,
    definition: {
      id: "TB_BaconShop_HERO_78_Buddy",
      cardId: "TB_BaconShop_HERO_78_Buddy",
      goldenCardId: "TB_BaconShop_HERO_78_Buddy_G",
      name: "冰雪元素",
      tier: 3,
      tribe: "elemental",
      tribes: ["elemental"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["TRIGGER_VISUAL"],
      attack: 5,
      health: 4,
      description: "每当酒馆刷新时，总会额外提供一个冻结的元素。",
      goldenDescription: "每当酒馆刷新时，总会额外提供2个冻结的元素。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-yo-ho-ogre",
    dbfId: 114598,
    goldenDbfId: 114599,
    definition: {
      id: "BG26_HERO_101_Buddy",
      cardId: "BG26_HERO_101_Buddy",
      goldenCardId: "BG26_HERO_101_Buddy_G",
      name: "辉金水手",
      tier: 3,
      tribe: "pirate",
      tribes: ["pirate"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["DIVINE_SHIELD", "TRIGGER_VISUAL"],
      attack: 4,
      health: 5,
      divineShield: true,
      description: "圣盾。每当酒馆刷新时，总会额外提供一个海盗。",
      goldenDescription:
        "圣盾。每当酒馆刷新时，总会额外提供2个海盗。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-verdant-spheres",
    dbfId: 77794,
    goldenDbfId: 77795,
    definition: {
      id: "TB_BaconShop_HERO_60_Buddy",
      cardId: "TB_BaconShop_HERO_60_Buddy",
      goldenCardId: "TB_BaconShop_HERO_60_Buddy_G",
      name: "炽手百夫长",
      tier: 2,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["DIVINE_SHIELD", "TRIGGER_VISUAL"],
      attack: 3,
      health: 3,
      divineShield: true,
      description:
        "圣盾。在“翠绿魔珠”触发后，获得你购买的上一个随从的属性值。",
      goldenDescription:
        "圣盾。在“翠绿魔珠”触发后，获得你购买的上一个随从的双倍属性值。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-reliquary-research",
    dbfId: 113650,
    goldenDbfId: 113651,
    definition: {
      id: "BG28_HERO_800_Buddy",
      cardId: "BG28_HERO_800_Buddy",
      goldenCardId: "BG28_HERO_800_Buddy_G",
      name: "遗物学会侍从",
      tier: 3,
      tribe: "elemental",
      tribes: ["elemental"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["TRIGGER_VISUAL"],
      attack: 6,
      health: 4,
      description:
        "每回合一次：在你施放酒馆法术后，获取一张它的新复制。",
      goldenDescription:
        "每回合一次：在你施放酒馆法术后，获取2张它的新复制。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-light-the-tavern",
    dbfId: 77823,
    goldenDbfId: 77824,
    definition: {
      id: "TB_BaconShop_HERO_75_Buddy",
      cardId: "TB_BaconShop_HERO_75_Buddy",
      goldenCardId: "TB_BaconShop_HERO_75_Buddy_G",
      name: "护灯人",
      tier: 4,
      tribe: "neutral",
      tribes: [],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["END_OF_TURN_TRIGGER"],
      attack: 6,
      health: 4,
      description:
        "在你的回合结束时，随机获取2张能使随从获得属性值的酒馆法术牌。",
      goldenDescription:
        "在你的回合结束时，随机获取4张能使随从获得属性值的酒馆法术牌。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-all-will-burn",
    dbfId: 77782,
    goldenDbfId: 77783,
    definition: {
      id: "TB_BaconShop_HERO_52_Buddy",
      cardId: "TB_BaconShop_HERO_52_Buddy",
      goldenCardId: "TB_BaconShop_HERO_52_Buddy_G",
      name: "希奈丝特拉",
      tier: 2,
      tribe: "dragon",
      tribes: ["dragon"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["TRIGGER_VISUAL"],
      legendary: true,
      attack: 2,
      health: 6,
      description:
        "每当友方随从在战斗阶段获得攻击力时，使其永久获得+1生命值。",
      goldenDescription:
        "每当友方随从在战斗阶段获得攻击力时，使其永久获得+2生命值。",
      collectible: false,
    },
  },
  {
    heroPowerId: "hero-power-swatting-insects",
    dbfId: 77447,
    goldenDbfId: 77532,
    definition: {
      id: "TB_BaconShop_HERO_76_Buddy",
      cardId: "TB_BaconShop_HERO_76_Buddy",
      goldenCardId: "TB_BaconShop_HERO_76_Buddy_G",
      name: "空气之灵",
      tier: 1,
      tribe: "elemental",
      tribes: ["elemental"],
      associatedTribes: [],
      effectSupport: "partial",
      printedMechanics: ["DEATHRATTLE"],
      attack: 5,
      health: 2,
      description:
        "亡语：随机使一个友方随从获得风怒，圣盾和嘲讽。",
      goldenDescription:
        "亡语：随机使2个友方随从获得风怒，圣盾和嘲讽。",
      collectible: false,
    },
  },
] as const satisfies readonly FixedBuildBuddyRecord[];

export const BUDDY_MINION_DEFINITIONS: readonly MinionDefinition[] =
  Object.freeze(
    FIXED_BUILD_BUDDY_RECORDS.map((record) => record.definition),
  );

const BUDDY_DEFINITION_ID_BY_HERO_POWER_ID = new Map<string, string>(
  FIXED_BUILD_BUDDY_RECORDS.map((record) => [
    record.heroPowerId,
    record.definition.id,
  ]),
);

export function getBuddyDefinitionIdForHeroPower(
  heroPowerId: string | null | undefined,
): string | null {
  if (!heroPowerId) {
    return null;
  }
  return BUDDY_DEFINITION_ID_BY_HERO_POWER_ID.get(heroPowerId) ?? null;
}
