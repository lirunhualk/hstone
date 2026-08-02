import type {
  HeroDefinition,
  HeroPowerDefinition,
  HeroPowerEffect,
  Tribe,
} from "./types.ts";

interface HeroPowerRule {
  id: string;
  cardId: string;
  name: string;
  description: string;
  effect: HeroPowerEffect;
  activation: "passive" | "active";
  identityEligible?: boolean;
}

export const HERO_OFFER_SIZE = 4;

export const HERO_POWER_COUNTER_KEYS = {
  smartSavingsGold: "smartSavingsGold",
  chenvaalaElementals: "chenvaalaElementals",
  kaelthasMinions: "kaelthasMinions",
  taethelanSpells: "taethelanSpells",
  rakanishuTurns: "rakanishuTurns",
  rakanishuBonus: "rakanishuBonus",
} as const;

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
    activation: "passive",
  },
  {
    id: "hero-power-see-the-future",
    cardId: "TB_BaconShop_HP_063",
    name: "洞察未来",
    description: "在你的回合开始时，获得一次免费的刷新。",
    effect: "freeRefreshAtTurnStart",
    activation: "passive",
  },
  {
    id: "hero-power-ever-blooming",
    cardId: "TB_BaconShop_HP_082",
    name: "永远绽放",
    description: "在你升级酒馆后，获得2枚铸币。",
    effect: "gainGoldAfterUpgrade",
    activation: "passive",
  },
  {
    id: "hero-power-sprout-it-out",
    cardId: "TB_BaconShop_HP_107",
    name: "老树新芽",
    description: "使你在战斗阶段中召唤的随从获得+1/+2和嘲讽。",
    effect: "buffCombatSummons",
    activation: "passive",
  },
  {
    id: "hero-power-all-patched-up",
    cardId: "TB_BaconShop_HP_035",
    name: "缝合完毕",
    description: "开局时额外拥有30点生命值。",
    effect: "bonusStartingHealth",
    activation: "passive",
    identityEligible: false,
  },
  {
    id: "hero-power-smart-savings",
    cardId: "TB_BaconShop_HP_008",
    name: "理财之道",
    description: "在你出售一个随从后，下回合获得1枚铸币。",
    effect: "goldAfterSellNextTurn",
    activation: "passive",
  },
  {
    id: "hero-power-manastorm",
    cardId: "TB_BaconShop_HP_054",
    name: "法力风暴",
    description:
      "购买随从和刷新消耗（2）枚铸币。升级酒馆所需的铸币增加（1）枚。",
    effect: "twoGoldMinionRefresh",
    activation: "passive",
  },
  {
    id: "hero-power-stay-frosty",
    cardId: "TB_BaconShop_HP_014",
    name: "冰冷静滞",
    description:
      "随从消耗（2）枚铸币。酒馆中提供的随从减少一个，且每回合结束时都会冻结。",
    effect: "freezeEndTurnSmallerTavern",
    activation: "passive",
  },
  {
    id: "hero-power-dream-portal",
    cardId: "TB_BaconShop_HP_062",
    name: "梦境之门",
    description: "每当酒馆刷新时，总会额外提供一条龙。",
    effect: "extraDragonOnRefresh",
    activation: "passive",
  },
  {
    id: "hero-power-avalanche",
    cardId: "TB_BaconShop_HP_088",
    name: "雪崩",
    description: "在你使用3张元素牌后，升级酒馆所需的铸币减少（3）枚。",
    effect: "upgradeDiscountAfterElementals",
    activation: "passive",
  },
  {
    id: "hero-power-yo-ho-ogre",
    cardId: "BG26_HERO_101p",
    name: "我当船长啦",
    description: "在你购买一个海盗后，获得1枚铸币。",
    effect: "piratePurchaseRefund",
    activation: "passive",
  },
  {
    id: "hero-power-verdant-spheres",
    cardId: "TB_BaconShop_HP_066",
    name: "翠绿魔珠",
    description: "在你购买3个随从后，获取一张酒馆币。",
    effect: "tavernCoinAfterThreeMinions",
    activation: "passive",
  },
  {
    id: "hero-power-reliquary-research",
    cardId: "BG28_HERO_800p",
    name: "神圣遗物学会研究",
    description: "你每购买四张酒馆法术牌，第四张消耗的铸币为（0）枚。",
    effect: "freeFourthTavernSpell",
    activation: "passive",
  },
  {
    id: "hero-power-light-the-tavern",
    cardId: "TB_BaconShop_HP_085t",
    name: "点亮酒馆",
    description:
      "你的酒馆法术使随从额外获得+1/+1。每4个回合，在回合开始时，提升此效果。",
    effect: "growingTavernSpellBuff",
    activation: "passive",
  },
  {
    id: "hero-power-all-will-burn",
    cardId: "TB_BaconShop_HP_061",
    name: "万物尽焚！",
    description: "战斗开始时：使所有随从永久获得+2攻击力。",
    effect: "buffAllCombatMinionsAttack",
    activation: "passive",
  },
  {
    id: "hero-power-swatting-insects",
    cardId: "TB_BaconShop_HP_086",
    name: "随风而行",
    description:
      "战斗开始时：使你最左边的随从获得风怒，圣盾以及嘲讽。",
    effect: "buffLeftmostCombatKeywords",
    activation: "passive",
  },
] as const satisfies readonly HeroPowerRule[];

/** Heroes exposed by the local deterministic lobby draft. */
export const HERO_DEFINITIONS = [
  {
    id: "hero-bartendotron",
    cardId: "TB_BaconShop_HERO_31",
    name: "调酒机器人",
    heroPowerId: "hero-power-experienced-bartender",
  },
  {
    id: "hero-nozdormu",
    cardId: "TB_BaconShop_HERO_57",
    name: "诺兹多姆",
    heroPowerId: "hero-power-see-the-future",
  },
  {
    id: "hero-forest-warden-omu",
    cardId: "TB_BaconShop_HERO_74",
    name: "林地守护者欧穆",
    heroPowerId: "hero-power-ever-blooming",
  },
  {
    id: "hero-greybough",
    cardId: "TB_BaconShop_HERO_95",
    name: "格雷布",
    heroPowerId: "hero-power-sprout-it-out",
    associatedTribes: ["beast", "undead"],
  },
  {
    id: "hero-patchwerk",
    cardId: "TB_BaconShop_HERO_34",
    name: "帕奇维克",
    heroPowerId: "hero-power-all-patched-up",
  },
  {
    id: "hero-trade-prince-gallywix",
    cardId: "TB_BaconShop_HERO_10",
    name: "贸易亲王加里维克斯",
    heroPowerId: "hero-power-smart-savings",
  },
  {
    id: "hero-millhouse-manastorm",
    cardId: "TB_BaconShop_HERO_49",
    name: "米尔豪斯·法力风暴",
    heroPowerId: "hero-power-manastorm",
  },
  {
    id: "hero-sindragosa",
    cardId: "TB_BaconShop_HERO_27",
    name: "辛达苟萨",
    heroPowerId: "hero-power-stay-frosty",
  },
  {
    id: "hero-ysera",
    cardId: "TB_BaconShop_HERO_53",
    name: "伊瑟拉",
    heroPowerId: "hero-power-dream-portal",
    associatedTribes: ["dragon"],
  },
  {
    id: "hero-chenvaala",
    cardId: "TB_BaconShop_HERO_78",
    name: "齐恩瓦拉",
    heroPowerId: "hero-power-avalanche",
    associatedTribes: ["elemental"],
  },
  {
    id: "hero-capn-hoggarr",
    cardId: "BG26_HERO_101",
    name: "霍格船长",
    heroPowerId: "hero-power-yo-ho-ogre",
    associatedTribes: ["pirate"],
  },
  {
    id: "hero-kaelthas-sunstrider",
    cardId: "TB_BaconShop_HERO_60",
    name: "凯尔萨斯·逐日者",
    heroPowerId: "hero-power-verdant-spheres",
  },
  {
    id: "hero-taethelan-bloodwatcher",
    cardId: "BG28_HERO_800",
    name: "泰瑟兰·血望者",
    heroPowerId: "hero-power-reliquary-research",
  },
  {
    id: "hero-rakanishu",
    cardId: "TB_BaconShop_HERO_75",
    name: "拉卡尼休",
    heroPowerId: "hero-power-light-the-tavern",
  },
  {
    id: "hero-deathwing",
    cardId: "TB_BaconShop_HERO_52",
    name: "死亡之翼",
    heroPowerId: "hero-power-all-will-burn",
  },
  {
    id: "hero-alakir",
    cardId: "TB_BaconShop_HERO_76",
    name: "奥拉基尔",
    heroPowerId: "hero-power-swatting-insects",
  },
] as const satisfies readonly HeroDefinition[];

const HERO_POWER_BY_ID = new Map<string, HeroPowerDefinition>(
  HERO_POWER_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
);

const HERO_BY_ID = new Map<string, HeroDefinition>(
  HERO_DEFINITIONS.map((definition) => [definition.id, definition]),
);

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label} in Hero registry.`);
  }
}

function validateHeroRegistry(): void {
  if (HERO_DEFINITIONS.length < HERO_OFFER_SIZE) {
    throw new Error(
      `Hero registry needs at least ${HERO_OFFER_SIZE} definitions.`,
    );
  }
  assertUnique(
    HERO_POWER_DEFINITIONS.map((definition) => definition.id),
    "Hero Power definition ID",
  );
  assertUnique(
    HERO_POWER_DEFINITIONS.map((definition) => definition.cardId),
    "Hero Power CardID",
  );
  assertUnique(
    HERO_DEFINITIONS.map((definition) => definition.id),
    "Hero definition ID",
  );
  assertUnique(
    HERO_DEFINITIONS.map((definition) => definition.cardId),
    "Hero CardID",
  );
  assertUnique(
    HERO_DEFINITIONS.map((definition) => definition.heroPowerId),
    "Hero-to-power mapping",
  );
  if (
    HERO_DEFINITIONS.length !== HERO_POWER_DEFINITIONS.length ||
    HERO_POWER_BY_ID.size !== HERO_POWER_DEFINITIONS.length ||
    HERO_BY_ID.size !== HERO_DEFINITIONS.length
  ) {
    throw new Error("Hero registry map is incomplete.");
  }
  for (const hero of HERO_DEFINITIONS) {
    if (!HERO_POWER_BY_ID.has(hero.heroPowerId)) {
      throw new Error(
        `Hero ${hero.id} references unknown power ${hero.heroPowerId}.`,
      );
    }
  }
  const linkedPowerIds = new Set(
    HERO_DEFINITIONS.map((definition) => definition.heroPowerId),
  );
  for (const power of HERO_POWER_DEFINITIONS) {
    if (!linkedPowerIds.has(power.id)) {
      throw new Error(`Hero Power ${power.id} has no linked Hero.`);
    }
  }
}

validateHeroRegistry();

export function getHeroPowerDefinition(
  definitionId: string,
): HeroPowerDefinition {
  const definition = HERO_POWER_BY_ID.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown hero power definition: ${definitionId}`);
  }
  return definition;
}

export function heroPowerCanBeManuallyActivated(
  definitionId: string,
): boolean {
  return getHeroPowerDefinition(definitionId).activation === "active";
}

export function isHeroPowerDefinitionId(
  definitionId: string,
): boolean {
  return HERO_POWER_BY_ID.has(definitionId);
}

export function getHeroDefinition(definitionId: string): HeroDefinition {
  const definition = HERO_BY_ID.get(definitionId);
  if (!definition) {
    throw new Error(`Unknown hero definition: ${definitionId}`);
  }
  return definition;
}

export function isHeroDefinitionId(definitionId: string): boolean {
  return HERO_BY_ID.has(definitionId);
}

export function heroIsAvailableForTribes(
  definition: HeroDefinition,
  activeTribes: readonly Tribe[],
): boolean {
  return (
    !definition.associatedTribes?.length ||
    definition.associatedTribes.some((tribe) =>
      activeTribes.includes(tribe),
    )
  );
}

export function heroesAvailableForTribes(
  activeTribes: readonly Tribe[],
): HeroDefinition[] {
  const definitions: readonly HeroDefinition[] = HERO_DEFINITIONS;
  return definitions
    .filter((definition) =>
      heroIsAvailableForTribes(definition, activeTribes),
    )
    .map((definition) => ({
      ...definition,
      associatedTribes: definition.associatedTribes
        ? [...definition.associatedTribes]
        : undefined,
    }));
}

export function identityEligibleHeroPowers(
  currentHeroPowerId: string | null,
): HeroPowerDefinition[] {
  const definitions: readonly HeroPowerDefinition[] =
    HERO_POWER_DEFINITIONS;
  return definitions
    .filter(
      (definition) =>
        definition.id !== currentHeroPowerId &&
        definition.identityEligible !== false,
    )
    .map((definition) => ({ ...definition }));
}

export function createInitialHeroPowerCounters(
  heroPowerId: string | null,
): Record<string, number> {
  if (heroPowerId === null) {
    return {};
  }
  const effect = getHeroPowerDefinition(heroPowerId).effect;
  switch (effect) {
    case "goldAfterSellNextTurn":
      return { [HERO_POWER_COUNTER_KEYS.smartSavingsGold]: 0 };
    case "upgradeDiscountAfterElementals":
      return { [HERO_POWER_COUNTER_KEYS.chenvaalaElementals]: 0 };
    case "tavernCoinAfterThreeMinions":
      return { [HERO_POWER_COUNTER_KEYS.kaelthasMinions]: 0 };
    case "freeFourthTavernSpell":
      return { [HERO_POWER_COUNTER_KEYS.taethelanSpells]: 0 };
    case "growingTavernSpellBuff":
      return {
        [HERO_POWER_COUNTER_KEYS.rakanishuTurns]: 4,
        [HERO_POWER_COUNTER_KEYS.rakanishuBonus]: 1,
      };
    default:
      return {};
  }
}

function safeCounter(
  counters: Readonly<Record<string, number>>,
  key: string,
  fallback = 0,
): number {
  const value = counters[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

export function getHeroPowerProgressText(
  heroPowerId: string,
  counters: Readonly<Record<string, number>>,
  currentRound: number,
): string | null {
  const effect = getHeroPowerDefinition(heroPowerId).effect;
  switch (effect) {
    case "goldAfterSellNextTurn":
      return `下回合已储存${safeCounter(
        counters,
        HERO_POWER_COUNTER_KEYS.smartSavingsGold,
      )}枚铸币`;
    case "upgradeDiscountAfterElementals":
      return `已使用${Math.min(
        2,
        safeCounter(
          counters,
          HERO_POWER_COUNTER_KEYS.chenvaalaElementals,
        ),
      )}/3张元素牌`;
    case "tavernCoinAfterThreeMinions":
      return `已购买${Math.min(
        2,
        safeCounter(
          counters,
          HERO_POWER_COUNTER_KEYS.kaelthasMinions,
        ),
      )}/3个随从`;
    case "freeFourthTavernSpell": {
      const purchased = Math.min(
        3,
        safeCounter(
          counters,
          HERO_POWER_COUNTER_KEYS.taethelanSpells,
        ),
      );
      return purchased === 3
        ? "下一张酒馆法术免费"
        : `本周期已购买${purchased}/4张酒馆法术`;
    }
    case "growingTavernSpellBuff": {
      const nextRound = Math.max(
        4,
        safeCounter(
          counters,
          HERO_POWER_COUNTER_KEYS.rakanishuTurns,
          4,
        ),
      );
      const bonus = Math.max(
        1,
        safeCounter(
          counters,
          HERO_POWER_COUNTER_KEYS.rakanishuBonus,
          1,
        ),
      );
      const roundsLeft = Math.max(
        0,
        nextRound - Math.max(1, Math.trunc(currentRound)),
      );
      return roundsLeft === 0
        ? `酒馆法术额外+${bonus}/+${bonus}；本回合提升`
        : `酒馆法术额外+${bonus}/+${bonus}；还剩${roundsLeft}个回合提升`;
    }
    default:
      return null;
  }
}
