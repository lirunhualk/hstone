import type {
  HeroPowerDefinition,
  HeroPowerEffect,
} from "./types.ts";

interface HeroPowerRule {
  id: string;
  cardId: string;
  name: string;
  description: string;
  effect: HeroPowerEffect;
}

/**
 * Unmasked Identity only offers powers whose complete gameplay is implemented.
 * The printed facts are pinned to Hearthstone build 247416, matching the
 * minion and Tavern Spell snapshot used by the rest of the game.
 */
export const HERO_POWER_DEFINITIONS = [
  {
    id: "hero-power-experienced-bartender",
    cardId: "TB_BaconShop_HP_009",
    name: "资深调酒师",
    description: "升级酒馆所需的铸币减少（1）枚。",
    effect: "upgradeDiscount",
  },
  {
    id: "hero-power-see-the-future",
    cardId: "TB_BaconShop_HP_063",
    name: "洞察未来",
    description: "在你的回合开始时，获得一次免费的刷新。",
    effect: "freeRefreshAtTurnStart",
  },
  {
    id: "hero-power-ever-blooming",
    cardId: "TB_BaconShop_HP_082",
    name: "永远绽放",
    description: "在你升级酒馆后，获得2枚铸币。",
    effect: "gainGoldAfterUpgrade",
  },
  {
    id: "hero-power-sprout-it-out",
    cardId: "TB_BaconShop_HP_107",
    name: "老树新芽",
    description: "使你在战斗阶段中召唤的随从获得+1/+2和嘲讽。",
    effect: "buffCombatSummons",
  },
] as const satisfies readonly HeroPowerRule[];

const HERO_POWER_BY_ID = new Map<string, HeroPowerDefinition>(
  HERO_POWER_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
);

export function getHeroPowerDefinition(
  definitionId: string,
): HeroPowerDefinition {
  const definition = HERO_POWER_BY_ID.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown hero power definition: ${definitionId}`);
  }
  return definition;
}

export function isHeroPowerDefinitionId(
  definitionId: string,
): boolean {
  return HERO_POWER_BY_ID.has(definitionId);
}
