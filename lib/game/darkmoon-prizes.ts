import type { SpellcraftDefinition } from "./types.ts";

export const TICKATUS_TAG_CARD_ID = "BG30_MagicItem_707" as const;
export const CORRUPTED_TOME_CARD_ID = "BG35_MagicItem_812" as const;
export const TRIPLE_PRIZE_DEFINITION_ID =
  "generated-darkmoon-triple-prize" as const;

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
  TRIPLE_PRIZE_DEFINITION,
  ...DARKMOON_PRIZE_DEFINITIONS,
] as const satisfies readonly SpellcraftDefinition[];

const DARKMOON_PRIZE_DEFINITION_IDS = new Set<string>(
  DARKMOON_PRIZE_DEFINITIONS.map((definition) => definition.id),
);

export function isTierThreeDarkmoonPrizeDefinitionId(
  definitionId: string,
): boolean {
  return DARKMOON_PRIZE_DEFINITION_IDS.has(definitionId);
}

