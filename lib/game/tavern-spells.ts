import type {
  TavernSpellDefinition,
  TavernSpellInstance,
} from "./types.ts";

/**
 * A fully playable first slice of the live 36.0.3 Tavern Spell pool.
 *
 * The shop only rolls definitions in this list, so every spell the player can
 * buy has a complete local rules implementation. Card IDs, tiers, costs, names,
 * text, and art identifiers come from the 36.0.3 (247416) game data.
 */
export const TAVERN_SPELL_DEFINITIONS = [
  {
    id: "tavern-spell-new-sprout",
    cardId: "BG33_101",
    name: "新生幼苗",
    tier: 1,
    cost: 3,
    description: "发现一个等级1的随从。",
    effect: "discoverTierOne",
    target: "none",
  },
  {
    id: "tavern-spell-enchanted-lasso",
    cardId: "BG28_512",
    name: "附魔链索",
    tier: 1,
    cost: 2,
    description: "随机偷取酒馆中的一个随从。",
    effect: "stealRandomShopMinion",
    target: "none",
  },
  {
    id: "tavern-spell-fortify",
    cardId: "BG28_503",
    name: "强固",
    tier: 1,
    cost: 1,
    description: "使一个随从获得+3生命值和嘲讽。",
    effect: "fortify",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-pointy-arrow",
    cardId: "EBG_Spell_014",
    name: "尖利箭矢",
    tier: 1,
    cost: 1,
    description: "使一个随从获得+4攻击力。",
    effect: "pointyArrow",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-recruit-a-trainee",
    cardId: "BG28_504",
    name: "招募新人",
    tier: 1,
    cost: 2,
    description: "随机获取一张等级1的随从牌。",
    effect: "recruitTrainee",
    target: "none",
  },
  {
    id: "tavern-spell-tavern-coin",
    cardId: "BG28_810",
    name: "酒馆币",
    tier: 1,
    cost: 1,
    description: "获得1枚铸币。",
    effect: "gainOneGold",
    target: "none",
  },
  {
    id: "tavern-spell-tavern-dish-banana",
    cardId: "BG28_897",
    name: "香蕉果盘",
    tier: 1,
    cost: 1,
    description: "使一个随从获得+2/+2。",
    effect: "tavernDishBanana",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-them-apples",
    cardId: "BG28_966",
    name: "意外之果",
    tier: 1,
    cost: 1,
    description: "使酒馆中的随从获得+1/+2。",
    effect: "themApples",
    target: "none",
  },
  {
    id: "tavern-spell-leaf-through-the-pages",
    cardId: "BG28_827",
    name: "快速浏览",
    tier: 2,
    cost: 1,
    description: "获得2次免费的刷新。",
    effect: "freeRefreshes",
    target: "none",
  },
  {
    id: "tavern-spell-might-of-stormwind",
    cardId: "BG35_951",
    name: "暴风城之力",
    tier: 2,
    cost: 2,
    description: "随机使四个友方随从获得+1/+2。",
    effect: "mightOfStormwind",
    target: "none",
  },
  {
    id: "tavern-spell-strike-oil",
    cardId: "BG28_805",
    name: "钻探原油",
    tier: 2,
    cost: 3,
    description: "你的铸币上限提高1枚。",
    effect: "increaseMaxGold",
    target: "none",
  },
  {
    id: "tavern-spell-careful-investment",
    cardId: "BG28_800",
    name: "慎重投资",
    tier: 3,
    cost: 1,
    description: "下回合获得2枚铸币。",
    effect: "carefulInvestment",
    target: "none",
  },
  {
    id: "tavern-spell-fleeting-vigor",
    cardId: "BG28_519",
    name: "瞬息活力",
    tier: 3,
    cost: 1,
    description: "战斗开始时：使你的随从获得+2/+1。",
    effect: "fleetingVigor",
    target: "none",
  },
  {
    id: "tavern-spell-friendly-bounty",
    cardId: "BG33_814",
    name: "友方悬赏令",
    tier: 3,
    cost: 2,
    description: "随机获取一张你的多数随从的类型的随从牌。",
    effect: "friendlyBounty",
    target: "none",
  },
  {
    id: "tavern-spell-healthy-bounty",
    cardId: "BG33_811",
    name: "生命悬赏令",
    tier: 3,
    cost: 2,
    description: "使四个友方随从获得+4生命值。",
    effect: "healthyBounty",
    target: "none",
  },
  {
    id: "tavern-spell-hostile-bounty",
    cardId: "BG33_812",
    name: "敌对悬赏令",
    tier: 3,
    cost: 2,
    description: "使四个友方随从获得+4攻击力。",
    effect: "hostileBounty",
    target: "none",
  },
  {
    id: "tavern-spell-selfish-bounty",
    cardId: "BG33_813",
    name: "谋私悬赏令",
    tier: 3,
    cost: 2,
    description: "使你最左边的随从获得+6/+6。",
    effect: "selfishBounty",
    target: "none",
  },
  {
    id: "tavern-spell-shiny-ring",
    cardId: "BG28_168",
    name: "闪亮的戒指",
    tier: 3,
    cost: 2,
    description: "使你的随从获得+1/+1。",
    effect: "shinyRing",
    target: "none",
  },
  {
    id: "tavern-spell-staff-of-enrichment",
    cardId: "BG28_886",
    name: "富足之杖",
    tier: 3,
    cost: 2,
    description: "使酒馆中的随从在本局对战中获得+2/+2。",
    effect: "staffOfEnrichment",
    target: "none",
  },
  {
    id: "tavern-spell-tricky-trousers",
    cardId: "BG28_520",
    name: "搞怪裤",
    tier: 3,
    cost: 1,
    description: "使一个随从获得+1/+2和嘲讽。如果它已经拥有嘲讽，则移除。",
    effect: "trickyTrousers",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-wealthy-bounty",
    cardId: "BG33_815",
    name: "财富悬赏令",
    tier: 3,
    cost: 2,
    description: "获得2枚铸币。",
    effect: "gainTwoGold",
    target: "none",
  },
  {
    id: "tavern-spell-back-to-back",
    cardId: "BG35_952",
    name: "背靠背",
    tier: 4,
    cost: 1,
    description: "使一个随从获得+4/+4。你此后的背靠背使随从额外获得+4/+4。",
    effect: "backToBack",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-deepwater-clan",
    cardId: "BG35_149",
    name: "深水族群",
    tier: 4,
    cost: 2,
    description: "使一个随从获得+2/+2。使你的鱼人获得+2/+2。",
    effect: "deepwaterClan",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-defenders-rites",
    cardId: "BG28_825",
    name: "防御者的仪式",
    tier: 4,
    cost: 2,
    description: "使一个友方随从获得+6/+6和嘲讽。",
    effect: "defendersRites",
    target: "friendly",
  },
  {
    id: "tavern-spell-misplaced-tea-set",
    cardId: "BG28_888",
    name: "乱放的茶具",
    tier: 4,
    cost: 2,
    description: "使每个类型的各一个友方随从获得+2/+2。",
    effect: "misplacedTeaSet",
    target: "none",
  },
  {
    id: "tavern-spell-natural-blessing",
    cardId: "BG28_845",
    name: "自然祝福",
    tier: 4,
    cost: 4,
    description: "选择一个随从，使所有该类型的随从获得+3/+3。",
    effect: "naturalBlessing",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-shifting-tide",
    cardId: "BG32_815",
    name: "变换之潮",
    tier: 4,
    cost: 1,
    description: "使一个随从获得+1/+1，触发两次。如果该随从是纳迦，重复此效果。",
    effect: "shiftingTide",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-queens-command",
    cardId: "BG35_922",
    name: "女王的命令",
    tier: 5,
    cost: 2,
    description: "使你的随从获得+2/+2。使你的所有纳迦额外获得+2/+2。",
    effect: "queensCommand",
    target: "none",
  },
  {
    id: "tavern-spell-sanctify",
    cardId: "BG33_817",
    name: "圣洁庇护",
    tier: 5,
    cost: 1,
    description: "使你具有圣盾的随从获得+6攻击力。",
    effect: "sanctify",
    target: "none",
  },
  {
    id: "tavern-spell-wave-of-gold",
    cardId: "BG34_990",
    name: "黄金狂潮",
    tier: 5,
    cost: 2,
    description: "使你的随从获得+3/+2。使你的金色随从额外获得+3/+2。",
    effect: "waveOfGold",
    target: "none",
  },
  {
    id: "tavern-spell-azerite-empowerment",
    cardId: "BG28_169",
    name: "艾泽里特强化",
    tier: 6,
    cost: 4,
    description: "使你的随从获得+2/+2，触发两次。",
    effect: "azeriteEmpowerment",
    target: "none",
  },
  {
    id: "tavern-spell-perfect-vision",
    cardId: "BG28_838",
    name: "完美形象",
    tier: 6,
    cost: 2,
    description: "将一个随从的属性值变为20/20。",
    effect: "perfectVision",
    target: "anyMinion",
  },
] as const satisfies readonly TavernSpellDefinition[];

const TAVERN_SPELL_BY_ID = new Map<string, TavernSpellDefinition>(
  TAVERN_SPELL_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
);

export function getTavernSpellDefinition(
  definitionId: string,
): TavernSpellDefinition {
  const definition = TAVERN_SPELL_BY_ID.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown Tavern Spell definition: ${definitionId}`);
  }
  return definition;
}

export function isTavernSpellDefinitionId(
  definitionId: string,
): boolean {
  return TAVERN_SPELL_BY_ID.has(definitionId);
}

export function tavernSpellNeedsTarget(
  spell: TavernSpellDefinition | TavernSpellInstance,
): boolean {
  const target =
    "kind" in spell
      ? getTavernSpellDefinition(spell.definitionId).target
      : spell.target;
  return target !== "none";
}

export function tavernSpellCanTargetShop(
  spell: TavernSpellDefinition | TavernSpellInstance,
): boolean {
  const target =
    "kind" in spell
      ? getTavernSpellDefinition(spell.definitionId).target
      : spell.target;
  return target === "anyMinion";
}
