import type {
  SpellcraftDefinition,
  SpellcraftSpellInstance,
} from "./types.ts";
import { GENERATED_DARKMOON_SPELL_DEFINITIONS } from "./darkmoon-prizes.ts";

/**
 * The ten ordinary Spellcraft spells attached to active Solo Naga minions
 * in the pinned 36.0.3 / build 247416 card data. Slimy Seafood samples this
 * list up to the player's current Tavern Tier; generated copies never reserve
 * Tavern or minion pool slots.
 */
export const SPELLCRAFT_DEFINITIONS = [
  {
    id: "spellcraft-crab-rider",
    cardId: "BG27_004t",
    goldenCardId: "BG27_004_Gt",
    name: "螃蟹坐骑",
    description:
      "直到下个回合，使一个随从获得“亡语：召唤一只3/2的螃蟹”。",
    goldenDescription:
      "直到下个回合，使一个随从获得“亡语：召唤一只6/4的螃蟹”。",
    sourceTier: 1,
    effect: "crabRider",
    target: "friendly",
  },
  {
    id: "spellcraft-anglers-lure",
    cardId: "BG23_004t",
    goldenCardId: "BG23_004_Gt",
    name: "钓客的诱饵",
    description: "直到下个回合，使一个随从获得+2/+6和嘲讽。",
    goldenDescription:
      "直到下个回合，使一个随从获得+4/+12和嘲讽。",
    sourceTier: 3,
    effect: "anglersLure",
    target: "friendly",
  },
  {
    id: "spellcraft-glowing-crown",
    cardId: "BG23_008t",
    goldenCardId: "BG23_008_Gt",
    name: "闪鳞头冠",
    description: "直到下个回合，使一个随从获得圣盾。",
    sourceTier: 5,
    effect: "glowingCrown",
    target: "friendly",
  },
  {
    id: "spellcraft-sick-riffs",
    cardId: "BG26_501t",
    goldenCardId: "BG26_501_Gt",
    name: "精彩即兴",
    description: "直到下个回合，使一个随从获得等同于你当前等级的属性值。",
    goldenDescription:
      "直到下个回合，使一个随从获得等同于你当前等级两倍的属性值。",
    sourceTier: 2,
    effect: "sickRiffs",
    target: "friendly",
  },
  {
    id: "spellcraft-deep-blue-blues",
    cardId: "BG26_502t",
    goldenCardId: "BG26_502_Gt",
    name: "深沉蓝调",
    description: "直到下个回合，使一个随从获得+2/+2。提升你此后的深沉蓝调效果。",
    goldenDescription:
      "直到下个回合，使一个随从获得+4/+4。提升你此后的深沉蓝调效果。",
    sourceTier: 3,
    effect: "deepBlueBlues",
    target: "friendly",
  },
  {
    id: "spellcraft-escape-eruption",
    cardId: "BG30_117t",
    goldenCardId: "BG30_117_Gt",
    name: "躲避喷发",
    description: "抉择：使你的随从获得+4攻击力；或者+4生命值。",
    goldenDescription:
      "抉择：使你的随从获得+8攻击力；或者+8生命值。",
    sourceTier: 4,
    effect: "escapeEruption",
    target: "none",
  },
  {
    id: "spellcraft-evolving-strategy",
    cardId: "BG31_920t",
    goldenCardId: "BG31_920_Gt",
    name: "战略迭代",
    description: "随机获取一张等级1的纳迦牌。",
    goldenDescription: "随机获取两张等级1的纳迦牌。",
    sourceTier: 5,
    effect: "evolvingStrategy",
    target: "none",
  },
  {
    id: "spellcraft-meditation",
    cardId: "BG32_835t",
    goldenCardId: "BG32_835_Gt",
    name: "冥想",
    description: "在本局对战中，你的酒馆法术使随从额外获得+1/+1。",
    goldenDescription:
      "在本局对战中，你的酒馆法术使随从额外获得+2/+2。",
    sourceTier: 5,
    effect: "meditation",
    target: "none",
  },
  {
    id: "spellcraft-rime-or-reason",
    cardId: "BG33_319t",
    goldenCardId: "BG33_319_Gt",
    name: "霜鳞之理",
    description: "随机获取一张能使随从获得属性值的酒馆法术牌。",
    goldenDescription:
      "随机获取2张能使随从获得属性值的酒馆法术牌。",
    sourceTier: 4,
    effect: "rimeOrReason",
    target: "none",
  },
  {
    id: "spellcraft-sirens-song",
    cardId: "BG27_514t",
    goldenCardId: "BG27_514_Gt",
    name: "海妖之歌",
    description:
      "选择酒馆中的一个随从（海巫扎尔吉拉除外），获取一张复制。",
    goldenDescription:
      "选择酒馆中的一个随从（海巫扎尔吉拉除外），获取2张复制。",
    sourceTier: 7,
    effect: "sirensSong",
    target: "shop",
    randomlyGeneratable: false,
  },
] as const satisfies readonly SpellcraftDefinition[];

/**
 * Ordinary generated spells use the same card/target presentation as
 * Spellcraft, but they are excluded from random Spellcraft generation and
 * do not consume Lava Lurker or Zesty Shaker counters.
 */
export const GENERATED_TARGETED_SPELL_DEFINITIONS = [
  {
    id: "generated-slimy-shield",
    cardId: "BG27_002t",
    name: "黏黏盾",
    description: "使一个随从获得+1/+1和嘲讽。",
    sourceTier: 2,
    effect: "slimyShield",
    target: "friendly",
    spellFamily: "generated",
    randomlyGeneratable: false,
  },
] as const satisfies readonly SpellcraftDefinition[];

/**
 * Current Solo Trinkets that generate a real Spellcraft card each turn in
 * build 247416. They participate in Spellcraft cast triggers, but are kept
 * outside Slimy Seafood's ordinary Naga generation pool.
 */
export const TRINKET_SPELLCRAFT_DEFINITIONS = [
  {
    id: "trinket-spellcraft-jailer-sticker-lesser",
    cardId: "BG35_MagicItem_306t",
    name: "典狱长标签",
    description: "消灭一个友方亡灵以随机获取一张亡灵牌。",
    sourceTier: 1,
    effect: "jailerStickerLesser",
    target: "friendly",
    randomlyGeneratable: false,
  },
  {
    id: "trinket-spellcraft-jailer-sticker-greater",
    cardId: "BG35_MagicItem_733t",
    name: "典狱长标签",
    description: "消灭一个友方亡灵以随机获取2张亡灵牌。",
    sourceTier: 1,
    effect: "jailerStickerGreater",
    target: "friendly",
    randomlyGeneratable: false,
  },
  {
    id: "trinket-spellcraft-ophidian-staff",
    cardId: "BG35_MagicItem_872t",
    name: "蛇首之杖",
    description: "使一只野兽获得+2/+2和复生。",
    sourceTier: 1,
    effect: "ophidianStaff",
    target: "friendly",
    randomlyGeneratable: false,
  },
  {
    id: "trinket-spellcraft-chillmere-mosaic",
    cardId: "BG35_MagicItem_755t",
    name: "切米尔拼贴画",
    description: "刷新酒馆，使其中变为战吼随从牌。这些牌的消耗为（1）。",
    sourceTier: 1,
    effect: "chillmereMosaic",
    target: "none",
    randomlyGeneratable: false,
  },
  {
    id: "trinket-spellcraft-double-stitch",
    cardId: "BG35_MagicItem_838t",
    name: "双线缝合",
    description: "选择一个友方随从，使其属性值翻倍，并将其锁入你的手牌1个回合。",
    sourceTier: 1,
    effect: "doubleStitch",
    target: "friendly",
    randomlyGeneratable: false,
  },
  {
    id: "trinket-spellcraft-token-of-old-gods",
    cardId: "BG30_MagicItem_416t",
    name: "古神信物",
    description: "选择一个随从，将其变形成为你另选的高一级的随从。",
    sourceTier: 1,
    effect: "tokenOfOldGods",
    target: "friendly",
    randomlyGeneratable: false,
  },
] as const satisfies readonly SpellcraftDefinition[];

const SPELLCRAFT_BY_ID = new Map<string, SpellcraftDefinition>(
  [
    ...SPELLCRAFT_DEFINITIONS,
    ...GENERATED_TARGETED_SPELL_DEFINITIONS,
    ...TRINKET_SPELLCRAFT_DEFINITIONS,
    ...GENERATED_DARKMOON_SPELL_DEFINITIONS,
  ].map((definition) => [definition.id, definition]),
);

export function getSpellcraftDefinition(
  definitionId: string,
): SpellcraftDefinition {
  const definition = SPELLCRAFT_BY_ID.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown Spellcraft definition: ${definitionId}`);
  }
  return definition;
}

export function spellcraftNeedsTarget(
  spell: SpellcraftDefinition | SpellcraftSpellInstance,
): boolean {
  const target =
    "kind" in spell
      ? getSpellcraftDefinition(spell.definitionId).target
      : spell.target;
  return target !== "none";
}
