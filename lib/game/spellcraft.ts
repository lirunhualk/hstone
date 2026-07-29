import type {
  SpellcraftDefinition,
  SpellcraftSpellInstance,
} from "./types.ts";

/**
 * The nine ordinary Spellcraft spells attached to active Solo Naga minions
 * in the pinned 36.0.3 / build 247416 card data. Slimy Seafood samples this
 * list up to the player's current Tavern Tier; generated copies never reserve
 * Tavern or minion pool slots.
 */
export const SPELLCRAFT_DEFINITIONS = [
  {
    id: "spellcraft-crab-rider",
    cardId: "BG27_004t",
    name: "螃蟹坐骑",
    description:
      "直到下个回合，使一个随从获得“亡语：召唤一只3/2的螃蟹”。",
    sourceTier: 1,
    effect: "crabRider",
    target: "friendly",
  },
  {
    id: "spellcraft-anglers-lure",
    cardId: "BG23_004t",
    name: "钓客的诱饵",
    description: "直到下个回合，使一个随从获得+2/+6和嘲讽。",
    sourceTier: 3,
    effect: "anglersLure",
    target: "friendly",
  },
  {
    id: "spellcraft-glowing-crown",
    cardId: "BG23_008t",
    name: "闪鳞头冠",
    description: "直到下个回合，使一个随从获得圣盾。",
    sourceTier: 5,
    effect: "glowingCrown",
    target: "friendly",
  },
  {
    id: "spellcraft-sick-riffs",
    cardId: "BG26_501t",
    name: "精彩即兴",
    description: "直到下个回合，使一个随从获得等同于你当前酒馆等级的属性值。",
    sourceTier: 2,
    effect: "sickRiffs",
    target: "friendly",
  },
  {
    id: "spellcraft-deep-blue-blues",
    cardId: "BG26_502t",
    name: "深沉蓝调",
    description: "直到下个回合，使一个随从获得+2/+2。提升你此后的深沉蓝调效果。",
    sourceTier: 3,
    effect: "deepBlueBlues",
    target: "friendly",
  },
  {
    id: "spellcraft-escape-eruption",
    cardId: "BG30_117t",
    name: "躲避喷发",
    description: "抉择：使你的随从获得+4攻击力；或者+4生命值。",
    sourceTier: 4,
    effect: "escapeEruption",
    target: "none",
  },
  {
    id: "spellcraft-evolving-strategy",
    cardId: "BG31_920t",
    name: "战略迭代",
    description: "随机获取一张等级1的纳迦牌。",
    sourceTier: 5,
    effect: "evolvingStrategy",
    target: "none",
  },
  {
    id: "spellcraft-meditation",
    cardId: "BG32_835t",
    name: "冥想",
    description: "在本局对战中，你的酒馆法术使随从额外获得+1/+1。",
    sourceTier: 5,
    effect: "meditation",
    target: "none",
  },
  {
    id: "spellcraft-rime-or-reason",
    cardId: "BG33_319t",
    name: "霜鳞之理",
    description: "随机获取一张能使随从获得属性值的酒馆法术牌。",
    sourceTier: 4,
    effect: "rimeOrReason",
    target: "none",
  },
] as const satisfies readonly SpellcraftDefinition[];

const SPELLCRAFT_BY_ID = new Map<string, SpellcraftDefinition>(
  SPELLCRAFT_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
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
