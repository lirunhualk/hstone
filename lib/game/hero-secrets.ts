import type { HeroSecretDefinition } from "./types.ts";

export const HERO_SECRET_DEFINITIONS = [
  {
    id: "hero-secret-tb_bacon_secrets_01",
    cardId: "TB_Bacon_Secrets_01",
    name: "眼镜蛇陷阱",
    description: "奥秘：当你的随从受到攻击时，召唤一条2/3并具有剧毒的眼镜蛇。",
    effect: "venomstrikeTrap",
    trigger: "friendlyAttacked",
  },
  {
    id: "hero-secret-tb_bacon_secrets_02",
    cardId: "TB_Bacon_Secrets_02",
    name: "毒蛇陷阱",
    description: "奥秘：当你的随从受到攻击时，召唤三条1/1的蛇。",
    effect: "snakeTrap",
    trigger: "friendlyAttacked",
  },
  {
    id: "hero-secret-tb_bacon_secrets_04",
    cardId: "TB_Bacon_Secrets_04",
    name: "裂魂残像",
    description: "奥秘：当你的随从受到攻击时，召唤一个该随从的复制。",
    effect: "splittingImage",
    trigger: "friendlyAttacked",
  },
  {
    id: "hero-secret-tb_bacon_secrets_05",
    cardId: "TB_Bacon_Secrets_05",
    name: "轮回",
    description: "奥秘：当一个友方随从死亡时，随机召唤一个法力值消耗相同的随从。",
    effect: "effigy",
    trigger: "friendlyDied",
  },
  {
    id: "hero-secret-tb_bacon_secrets_07",
    cardId: "TB_Bacon_Secrets_07",
    name: "自动防御矩阵",
    description: "奥秘：当你的随从受到攻击时，使其获得圣盾。",
    effect: "autodefenseMatrix",
    trigger: "friendlyAttacked",
  },
  {
    id: "hero-secret-tb_bacon_secrets_08",
    cardId: "TB_Bacon_Secrets_08",
    name: "复仇",
    description: "奥秘：当你的随从死亡时，随机使一个友方随从获得+3/+2。",
    effect: "avengeSecret",
    trigger: "friendlyDied",
  },
  {
    id: "hero-secret-tb_bacon_secrets_10",
    cardId: "TB_Bacon_Secrets_10",
    name: "救赎",
    description: "奥秘：当一个友方随从死亡时，使其回到战场，并具有1点生命值。",
    effect: "redemption",
    trigger: "friendlyDied",
  },
  {
    id: "hero-secret-tb_bacon_secrets_11",
    cardId: "TB_Bacon_Secrets_11",
    name: "拯救之手",
    description: "奥秘：在一回合中当你的第二个随从死亡时，将其复活。",
    effect: "handOfSalvation",
    trigger: "friendlyDied",
  },
  {
    id: "hero-secret-tb_bacon_secrets_12",
    cardId: "TB_Bacon_Secrets_12",
    name: "寒冰屏障",
    description: "奥秘：当你的英雄将要承受致命伤害时，防止这些伤害，并使其在本回合中免疫。",
    effect: "iceBlock",
    trigger: "heroLethalDamage",
  },
  {
    id: "hero-secret-tb_bacon_secrets_13",
    cardId: "TB_Bacon_Secrets_13",
    name: "争强好胜",
    description: "奥秘：在你的回合开始时，使你的所有随从获得+1/+1。",
    effect: "competitiveSpirit",
    trigger: "startOfTurn",
  },
  {
    id: "hero-secret-tb_bacon_secrets_14",
    cardId: "TB_Bacon_Secrets_14",
    name: "清算",
    description: "奥秘：在一个敌方随从造成3点或以上伤害后，将其消灭。",
    effect: "reckoning",
    trigger: "enemyDealsDamage",
  },
  {
    id: "hero-secret-tb_bacon_secrets_15",
    cardId: "TB_Bacon_Secrets_15",
    name: "集群战术",
    description: "奥秘：当一个友方随从受到攻击时，召唤一个该随从的3/3的复制。",
    effect: "packTactics",
    trigger: "friendlyAttacked",
  },
] as const satisfies readonly HeroSecretDefinition[];

const HERO_SECRET_BY_ID = new Map<string, HeroSecretDefinition>(
  HERO_SECRET_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const HERO_SECRET_BY_CARD_ID = new Map<string, HeroSecretDefinition>(
  HERO_SECRET_DEFINITIONS.map((definition) => [definition.cardId, definition]),
);

export function getHeroSecretDefinition(id: string): HeroSecretDefinition {
  const definition = HERO_SECRET_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Unknown hero secret definition: ${id}`);
  }
  return definition;
}

export function getHeroSecretDefinitionByCardId(
  cardId: string,
): HeroSecretDefinition {
  const definition = HERO_SECRET_BY_CARD_ID.get(cardId);
  if (!definition) {
    throw new Error(`Unknown hero secret cardId: ${cardId}`);
  }
  return definition;
}

export function isHeroSecretDefinitionId(
  value: string,
): value is HeroSecretDefinition["id"] {
  return HERO_SECRET_BY_ID.has(value);
}
