import type { SpellcraftDefinition } from "./types.ts";

export const TICKATUS_TAG_CARD_ID = "BG30_MagicItem_707" as const;
export const CORRUPTED_TOME_CARD_ID = "BG35_MagicItem_812" as const;
export const TRIPLE_PRIZE_DEFINITION_ID =
  "generated-darkmoon-triple-prize" as const;
export const TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID =
  "generated-darkmoon-tier-one-triple-prize" as const;

export const TIER_ONE_DARKMOON_PRIZE_DEFINITIONS = [
  {
    id: "generated-darkmoon-pocket-change",
    cardId: "BGS_Treasures_001",
    name: "压袋零钱",
    description: "获取2张酒馆币。",
    sourceTier: 1,
    effect: "darkmoonPocketChange",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-gacha-gift",
    cardId: "BGS_Treasures_004",
    name: "抽卡赠礼",
    description: "发现一个等级1的随从。",
    sourceTier: 1,
    effect: "darkmoonGachaGift",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-might-of-stormwind",
    cardId: "BGS_Treasures_007",
    name: "暴风城之力",
    description: "使所有友方随从获得等同于你当前等级的攻击力。",
    sourceTier: 1,
    effect: "darkmoonMightOfStormwind",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-the-good-stuff",
    cardId: "BGS_Treasures_013",
    name: "珍藏好酒",
    description: "使酒馆中的随从在本局对战中获得+1/+1。",
    sourceTier: 1,
    effect: "darkmoonTheGoodStuff",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-rocking-and-rolling",
    cardId: "BGS_Treasures_029",
    name: "摇起来吧",
    description: "在本局对战的剩余时间内，在每个回合开始时获得1次免费的刷新。",
    sourceTier: 1,
    effect: "darkmoonRockingAndRolling",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-new-recruit",
    cardId: "BGS_Treasures_033",
    name: "物色新人",
    description: "在本局对战中，酒馆额外提供一个具有+2/+2的随从。",
    sourceTier: 1,
    effect: "darkmoonNewRecruit",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-banana-bunch",
    cardId: "BGS_Treasures_040",
    name: "一串香蕉",
    description: "获取2张香蕉果盘。",
    sourceTier: 1,
    effect: "darkmoonBananaBunch",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-spread-tome",
    cardId: "BGS_Treasures_100",
    name: "摊开的秘典",
    description: "随机获取一张消耗为（2）或以上的酒馆法术牌。",
    sourceTier: 1,
    effect: "darkmoonSpreadTome",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-crystallized",
    cardId: "BGS_Treasures_110",
    name: "化作结晶",
    description: "在本局对战中，你的酒馆法术使随从额外获得+1/+1。",
    sourceTier: 1,
    effect: "darkmoonCrystallized",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
] as const satisfies readonly SpellcraftDefinition[];

export const TIER_ONE_TRIPLE_PRIZE_DEFINITION = {
  id: TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID,
  cardId: "BG27_Anomaly_755t",
  name: "三连奖励",
  description: "发现一个等级1的暗月奖品。",
  sourceTier: 1,
  effect: "darkmoonTierOnePrizeDiscover",
  target: "none",
  spellFamily: "generated",
  randomlyGeneratable: false,
} as const satisfies SpellcraftDefinition;

export const DARKMOON_PRIZE_DEFINITIONS = [
  {
    id: "generated-darkmoon-training-session",
    cardId: "BGS_Treasures_011",
    name: "重新训练",
    description: "发现一个新的英雄技能。",
    sourceTier: 3,
    effect: "darkmoonTrainingSession",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-buy-the-holy-light",
    cardId: "BGS_Treasures_015",
    name: "圣光在售",
    description: "使一个友方随从获得+10攻击力和圣盾。",
    sourceTier: 3,
    effect: "darkmoonBuyTheHolyLight",
    target: "friendly",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-bananas",
    cardId: "BGS_Treasures_019",
    name: "香蕉满手",
    description: "用香蕉果盘填满你的手牌。",
    sourceTier: 3,
    effect: "darkmoonBananas",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-top-shelf",
    cardId: "BGS_Treasures_020",
    name: "顶级优选",
    description: "发现一个高一级的随从（最高等级7）。",
    sourceTier: 3,
    effect: "darkmoonTopShelf",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-repeat-customer",
    cardId: "BGS_Treasures_034",
    name: "回头客",
    description: "将一个非金色友方随从移回你的手牌，并使其获得+6/+6。",
    sourceTier: 3,
    effect: "darkmoonRepeatCustomer",
    target: "friendly",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-all-that-glitters",
    cardId: "BGS_Treasures_037",
    name: "金光闪闪",
    description: "随机使酒馆中的一个随从变为金色。",
    sourceTier: 3,
    effect: "darkmoonAllThatGlitters",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-mindflayer-goggles",
    cardId: "BGS_Treasures_039",
    name: "夺心护目镜",
    description: "偷取酒馆中的所有卡牌，然后刷新酒馆。",
    sourceTier: 3,
    effect: "darkmoonMindflayerGoggles",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
  {
    id: "generated-darkmoon-reserve-prices",
    cardId: "BGS_Treasures_104",
    name: "底价销售",
    description: "在本回合中，酒馆法术消耗的铸币减少（1）枚。",
    sourceTier: 3,
    effect: "darkmoonReservePrices",
    target: "none",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
] as const satisfies readonly SpellcraftDefinition[];

export const TRIPLE_PRIZE_DEFINITION = {
  id: TRIPLE_PRIZE_DEFINITION_ID,
  cardId: "BG35_MagicItem_812t",
  name: "三连奖品",
  description: "发现一个等级3的暗月奖品。",
  sourceTier: 3,
  effect: "darkmoonPrizeDiscover",
  target: "none",
  spellFamily: "generated",
  randomlyGeneratable: false,
} as const satisfies SpellcraftDefinition;

export const GENERATED_DARKMOON_SPELL_DEFINITIONS = [
  TIER_ONE_TRIPLE_PRIZE_DEFINITION,
  TRIPLE_PRIZE_DEFINITION,
  ...TIER_ONE_DARKMOON_PRIZE_DEFINITIONS,
  ...DARKMOON_PRIZE_DEFINITIONS,
] as const satisfies readonly SpellcraftDefinition[];

const TIER_ONE_DARKMOON_PRIZE_DEFINITION_IDS = new Set<string>(
  TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.map((definition) => definition.id),
);

const DARKMOON_PRIZE_DEFINITION_IDS = new Set<string>(
  DARKMOON_PRIZE_DEFINITIONS.map((definition) => definition.id),
);

export function isTierThreeDarkmoonPrizeDefinitionId(
  definitionId: string,
): boolean {
  return DARKMOON_PRIZE_DEFINITION_IDS.has(definitionId);
}

export function isTierOneDarkmoonPrizeDefinitionId(
  definitionId: string,
): boolean {
  return TIER_ONE_DARKMOON_PRIZE_DEFINITION_IDS.has(definitionId);
}
