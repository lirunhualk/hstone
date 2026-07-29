import pinnedSnapshot from "./generated/battlegrounds-36.0.3-247416.zhCN.json" with {
  type: "json",
};
import type {
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernSpellTarget,
  TavernTier,
  Tribe,
} from "./types.ts";

interface TavernSpellRule {
  id: string;
  cardId: string;
  effect: TavernSpellEffect;
  target: TavernSpellTarget;
  purchaseCurrency?: "health";
}

/**
 * Only rules in this list may enter the playable shop pool. Printed card facts
 * come from the pinned 36.0.3 / build 247416 snapshot, keeping card data and
 * local effect support separate.
 */
export const TAVERN_SPELL_RULES = [
  {
    id: "tavern-spell-new-sprout",
    cardId: "BG33_101",
    effect: "discoverTierOne",
    target: "none",
  },
  {
    id: "tavern-spell-enchanted-lasso",
    cardId: "BG28_512",
    effect: "stealRandomShopMinion",
    target: "none",
  },
  {
    id: "tavern-spell-fortify",
    cardId: "BG28_503",
    effect: "fortify",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-pointy-arrow",
    cardId: "EBG_Spell_014",
    effect: "pointyArrow",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-recruit-a-trainee",
    cardId: "BG28_504",
    effect: "recruitTrainee",
    target: "none",
  },
  {
    id: "tavern-spell-tavern-coin",
    cardId: "BG28_810",
    effect: "gainOneGold",
    target: "none",
  },
  {
    id: "tavern-spell-tavern-dish-banana",
    cardId: "BG28_897",
    effect: "tavernDishBanana",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-them-apples",
    cardId: "BG28_966",
    effect: "themApples",
    target: "none",
  },
  {
    id: "tavern-spell-chefs-choice",
    cardId: "BG28_518",
    effect: "chefsChoice",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-hasty-excavation",
    cardId: "BG28_571",
    effect: "hastyExcavation",
    target: "none",
    purchaseCurrency: "health",
  },
  {
    id: "tavern-spell-leaf-through-the-pages",
    cardId: "BG28_827",
    effect: "freeRefreshes",
    target: "none",
  },
  {
    id: "tavern-spell-might-of-stormwind",
    cardId: "BG35_951",
    effect: "mightOfStormwind",
    target: "none",
  },
  {
    id: "tavern-spell-strike-oil",
    cardId: "BG28_805",
    effect: "increaseMaxGold",
    target: "none",
  },
  {
    id: "tavern-spell-search-the-past",
    cardId: "BG34_330",
    effect: "searchThePast",
    target: "none",
  },
  {
    id: "tavern-spell-careful-investment",
    cardId: "BG28_800",
    effect: "carefulInvestment",
    target: "none",
  },
  {
    id: "tavern-spell-fleeting-vigor",
    cardId: "BG28_519",
    effect: "fleetingVigor",
    target: "none",
  },
  {
    id: "tavern-spell-friendly-bounty",
    cardId: "BG33_814",
    effect: "friendlyBounty",
    target: "none",
  },
  {
    id: "tavern-spell-healthy-bounty",
    cardId: "BG33_811",
    effect: "healthyBounty",
    target: "none",
  },
  {
    id: "tavern-spell-hostile-bounty",
    cardId: "BG33_812",
    effect: "hostileBounty",
    target: "none",
  },
  {
    id: "tavern-spell-selfish-bounty",
    cardId: "BG33_813",
    effect: "selfishBounty",
    target: "none",
  },
  {
    id: "tavern-spell-shiny-ring",
    cardId: "BG28_168",
    effect: "shinyRing",
    target: "none",
  },
  {
    id: "tavern-spell-staff-of-enrichment",
    cardId: "BG28_886",
    effect: "staffOfEnrichment",
    target: "none",
  },
  {
    id: "tavern-spell-tricky-trousers",
    cardId: "BG28_520",
    effect: "trickyTrousers",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-wealthy-bounty",
    cardId: "BG33_815",
    effect: "gainTwoGold",
    target: "none",
  },
  {
    id: "tavern-spell-planar-telescope",
    cardId: "BG28_521",
    effect: "planarTelescope",
    target: "none",
  },
  {
    id: "tavern-spell-hubris",
    cardId: "BG28_884",
    effect: "hubris",
    target: "none",
  },
  {
    id: "tavern-spell-careful-mutation",
    cardId: "BG30_804",
    effect: "carefulMutation",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-time-management",
    cardId: "BG31_881",
    effect: "timeManagement",
    target: "none",
  },
  {
    id: "tavern-spell-stacked-avalanche",
    cardId: "BG33_899",
    effect: "stackedAvalanche",
    target: "friendly",
  },
  {
    id: "tavern-spell-blood-gem-barrage",
    cardId: "BG34_689",
    effect: "bloodGemBarrage",
    target: "none",
  },
  {
    id: "tavern-spell-clone-horn",
    cardId: "BG28_601",
    effect: "cloneHorn",
    target: "none",
  },
  {
    id: "tavern-spell-beetle-blessing",
    cardId: "BG28_603",
    effect: "beetleBlessing",
    target: "none",
  },
  {
    id: "tavern-spell-slimy-seafood",
    cardId: "BG28_606",
    effect: "slimySeafood",
    target: "none",
  },
  {
    id: "tavern-spell-gem-confiscation",
    cardId: "BG28_698",
    effect: "gemConfiscation",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-back-to-back",
    cardId: "BG35_952",
    effect: "backToBack",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-deepwater-clan",
    cardId: "BG35_149",
    effect: "deepwaterClan",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-defenders-rites",
    cardId: "BG28_825",
    effect: "defendersRites",
    target: "friendly",
  },
  {
    id: "tavern-spell-misplaced-tea-set",
    cardId: "BG28_888",
    effect: "misplacedTeaSet",
    target: "none",
  },
  {
    id: "tavern-spell-natural-blessing",
    cardId: "BG28_845",
    effect: "naturalBlessing",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-shifting-tide",
    cardId: "BG32_815",
    effect: "shiftingTide",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-temperature-shift",
    cardId: "BG31_819",
    effect: "temperatureShift",
    target: "none",
  },
  {
    id: "tavern-spell-ride-the-wind",
    cardId: "BG34_444",
    effect: "rideTheWind",
    target: "none",
  },
  {
    id: "tavern-spell-stir-the-graveyard",
    cardId: "BG34_888",
    effect: "stirTheGraveyard",
    target: "none",
  },
  {
    id: "tavern-spell-blazing-inferno",
    cardId: "BG35_910",
    effect: "blazingInferno",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-arcane-absorption",
    cardId: "BG35_911",
    effect: "arcaneAbsorption",
    target: "friendly",
  },
  {
    id: "tavern-spell-eonars-favor",
    cardId: "BG35_912",
    effect: "eonarsFavor",
    target: "anyMinion",
  },
  {
    id: "tavern-spell-queens-command",
    cardId: "BG35_922",
    effect: "queensCommand",
    target: "none",
  },
  {
    id: "tavern-spell-sanctify",
    cardId: "BG33_817",
    effect: "sanctify",
    target: "none",
  },
  {
    id: "tavern-spell-wave-of-gold",
    cardId: "BG34_990",
    effect: "waveOfGold",
    target: "none",
  },
  {
    id: "tavern-spell-azerite-empowerment",
    cardId: "BG28_169",
    effect: "azeriteEmpowerment",
    target: "none",
  },
  {
    id: "tavern-spell-perfect-vision",
    cardId: "BG28_838",
    effect: "perfectVision",
    target: "anyMinion",
  },
] as const satisfies readonly TavernSpellRule[];

const SOURCE_TRIBES: Readonly<Record<string, Tribe>> = {
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

const READABLE_TEXT_OVERRIDES: Readonly<Record<string, string>> = {
  BG28_503: "使一个随从获得+3生命值和嘲讽。",
  EBG_Spell_014: "使一个随从获得+4攻击力。",
  BG33_811: "使四个友方随从获得+4生命值。",
  BG33_812: "使四个友方随从获得+4攻击力。",
  BG33_817: "使你具有圣盾的随从获得+6攻击力。",
};

function plainText(html: string): string {
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
    .replace(/\n+/gu, " ")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

const PINNED_SPELL_BY_CARD_ID = new Map(
  pinnedSnapshot.tavernSpells.map((spell) => [spell.id, spell]),
);

function mapAssociatedTribes(rawTribes: readonly string[]): Tribe[] {
  return rawTribes.map((rawTribe) => {
    const tribe = SOURCE_TRIBES[rawTribe];
    if (!tribe) {
      throw new Error(`Unknown Tavern Spell associated race: ${rawTribe}`);
    }
    return tribe;
  });
}

export const TAVERN_SPELL_DEFINITIONS: readonly TavernSpellDefinition[] =
  TAVERN_SPELL_RULES.map((rule: TavernSpellRule) => {
    const printed = PINNED_SPELL_BY_CARD_ID.get(rule.cardId);
    if (!printed) {
      throw new Error(
        `Playable Tavern Spell ${rule.id} is absent from the pinned Solo pool`,
      );
    }
    if (
      !Number.isInteger(printed.tier) ||
      printed.tier < 1 ||
      printed.tier > 6
    ) {
      throw new Error(
        `Playable Tavern Spell ${rule.id} has invalid Tier ${printed.tier}`,
      );
    }
    return {
      id: rule.id,
      cardId: printed.id,
      name: printed.name,
      tier: printed.tier as TavernTier,
      cost: printed.cost,
      description:
        READABLE_TEXT_OVERRIDES[printed.id] ??
        plainText(printed.text),
      effect: rule.effect,
      target: rule.target,
      ...(rule.purchaseCurrency
        ? { purchaseCurrency: rule.purchaseCurrency }
        : {}),
      associatedTribes: mapAssociatedTribes(printed.associatedRaces),
    };
  });

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

export function tavernSpellIsAvailable(
  spell: TavernSpellDefinition | TavernSpellInstance,
  activeTribes: readonly Tribe[],
): boolean {
  const definition =
    "kind" in spell
      ? getTavernSpellDefinition(spell.definitionId)
      : spell;
  const associatedTribes = definition.associatedTribes ?? [];
  return (
    associatedTribes.length === 0 ||
    associatedTribes.some((tribe) => activeTribes.includes(tribe))
  );
}

export function tavernSpellPurchaseCurrency(
  spell: TavernSpellDefinition | TavernSpellInstance,
): "gold" | "health" {
  const definition =
    "kind" in spell
      ? getTavernSpellDefinition(spell.definitionId)
      : spell;
  return definition.purchaseCurrency ?? "gold";
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
