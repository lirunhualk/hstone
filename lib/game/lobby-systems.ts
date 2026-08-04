import type {
  TavernSpellDefinition,
  Tribe,
  TrinketTier,
} from "./types.ts";
import { getBuddyDefinitionIdForHeroPower } from "./buddies.ts";
import { heroPowerCanBeManuallyActivated } from "./hero-powers.ts";
import trinketSnapshot from "./generated/battlegrounds-trinkets-36.0.3-247416.zhCN.json" with {
  type: "json",
};

export const LESSER_TRINKET_ROUND = 6;
export const GREATER_TRINKET_ROUND = 9;

const SOUS_CHEF_LABEL_CARD_ID = "BG35_MagicItem_801";
const MAXWELL_STICKER_CARD_IDS = new Set([
  "BG35_MagicItem_803",
  "BG35_MagicItem_803t",
]);

export type TrinketEffect =
  | "repeatUpgradeDiscount"
  | "growMaxGold"
  | "buffAfterPurchase"
  | "goldenizerSupply"
  | "bobsTipJar"
  | "freeTavernSpells"
  | "growingTavernSpellBuff"
  | "officialTrinket";

export interface TrinketDefinition {
  id: string;
  cardId: string;
  name: string;
  tier: TrinketTier;
  cost: number;
  description: string;
  effect: TrinketEffect;
  /** Types printed at the bottom of the Trinket card. Empty means neutral. */
  associatedTribes: readonly Tribe[];
  /** Related minion or spell CardIDs supplied by the fixed client build. */
  relatedCardIds: readonly string[];
  /** Removed Trinkets stay registered only so old local saves remain readable. */
  inPool: boolean;
  dbfId?: number;
  sourceSlug?: string;
  attack?: number;
  health?: number;
  count?: number;
}

const SOURCE_TRIBE_TO_LOCAL = {
  BEAST: "beast",
  DEMON: "demon",
  DRAGON: "dragon",
  ELEMENTAL: "elemental",
  MECHANICAL: "mech",
  MURLOC: "murloc",
  NAGA: "naga",
  PIRATE: "pirate",
  QUILBOAR: "quilboar",
  UNDEAD: "undead",
} as const satisfies Readonly<Record<string, Tribe>>;

type SourceTribe = keyof typeof SOURCE_TRIBE_TO_LOCAL;

function mapTrinketTribe(sourceTribe: string): Tribe {
  const tribe = SOURCE_TRIBE_TO_LOCAL[sourceTribe as SourceTribe];
  if (!tribe) {
    throw new Error(`Unknown Trinket associated tribe: ${sourceTribe}`);
  }
  return tribe;
}

const CURRENT_RULE_OVERRIDES: Readonly<
  Record<
    string,
    Pick<TrinketDefinition, "effect"> &
      Partial<Pick<TrinketDefinition, "attack" | "health" | "count">>
  >
> = {
  BG30_MagicItem_435: { effect: "goldenizerSupply", count: 3 },
  BG30_MagicItem_705: { effect: "repeatUpgradeDiscount", count: 3 },
  BG30_MagicItem_847: { effect: "growMaxGold", count: 1 },
  BG30_MagicItem_996: { effect: "bobsTipJar", count: 4 },
};

/**
 * The complete current Solo pool from the pinned 36.0.3 / build-247416
 * snapshot. The official Card Library provides pool membership and tribes;
 * the fixed client build provides localized text, cost, tier, and CardIDs.
 */
export const ACTIVE_TRINKET_DEFINITIONS: readonly TrinketDefinition[] =
  Object.freeze(
    trinketSnapshot.trinkets.map((record) => {
      const override = CURRENT_RULE_OVERRIDES[record.cardId];
      return {
        id: record.id,
        cardId: record.cardId,
        dbfId: record.dbfId,
        name: record.name,
        tier: record.tier as TrinketTier,
        cost: record.cost,
        description: record.description,
        associatedTribes: record.associatedTribes.map(mapTrinketTribe),
        relatedCardIds: [...record.relatedCardIds],
        sourceSlug: record.sourceSlug,
        inPool: true,
        effect: override?.effect ?? "officialTrinket",
        attack: override?.attack,
        health: override?.health,
        count: override?.count,
      };
    }),
  );

/** Four previously supported cards removed from the current official pool. */
const LEGACY_REMOVED_TRINKET_DEFINITIONS = [
  {
    id: "lesser-trinket-kodo-leather-pouch",
    cardId: "BG30_MagicItem_414",
    name: "科多兽皮袋",
    tier: "lesser",
    cost: 3,
    description: "在你购买一张牌后，使两个随机友方随从获得+2/+1。",
    effect: "buffAfterPurchase",
    associatedTribes: [],
    relatedCardIds: [],
    inPool: false,
    attack: 2,
    health: 1,
    count: 2,
  },
  {
    id: "greater-trinket-calming-candle",
    cardId: "BG30_MagicItem_986",
    name: "宁神蜡烛",
    tier: "greater",
    cost: 2,
    description: "每回合中，你购买的前3张酒馆法术牌免费。",
    effect: "freeTavernSpells",
    associatedTribes: [],
    relatedCardIds: [],
    inPool: false,
    count: 3,
  },
  {
    id: "greater-trinket-magic-mushroom",
    cardId: "BG32_MagicItem_700",
    name: "魔幻蘑菇",
    tier: "greater",
    cost: 2,
    description:
      "你的酒馆法术使随从额外获得+1/+1。在每个回合开始时，提升此效果。",
    effect: "growingTavernSpellBuff",
    associatedTribes: [],
    relatedCardIds: [],
    inPool: false,
    attack: 1,
    health: 1,
  },
  {
    id: "greater-trinket-kodo-leather-pouch",
    cardId: "BG30_MagicItem_414t",
    name: "科多兽皮袋",
    tier: "greater",
    cost: 4,
    description: "在你购买一张牌后，使两个随机友方随从获得+4/+4。",
    effect: "buffAfterPurchase",
    associatedTribes: [],
    relatedCardIds: [],
    inPool: false,
    attack: 4,
    health: 4,
    count: 2,
  },
] as const satisfies readonly TrinketDefinition[];

/** Active definitions plus compatibility-only definitions for old saves. */
export const TRINKET_DEFINITIONS: readonly TrinketDefinition[] = Object.freeze([
  ...ACTIVE_TRINKET_DEFINITIONS,
  ...LEGACY_REMOVED_TRINKET_DEFINITIONS,
]);

export type SystemEventEffect =
  | "goldenArrowEveryThreeTurns"
  | "startWithGoldenizer"
  | "startWithTenGold"
  | "startAtTier2"
  | "startAtTier3With9Gold"
  | "fullHouse"
  | "titanGrip"
  | "buyOneGetOne"
  | "goldCarryover"
  | "refundTrick"
  | "mimironsClockworkArena"
  | "norgannonsSecret"
  | "lightTheWay"
  | "finalHour"
  | "immediateFormation"
  | "scoutsHonor"
  | "tierMatchOnly"
  | "assemblyLine"
  | "planeAlignment"
  | "goldenArena"
  | "falseIdols"
  | "extraSpellPerRefresh"
  | "gladiatorSpoils"
  | "gargonnisStorm"
  | "overseersOrb"
  | "tavernSpecial"
  | "wisdomballAnomaly"
  | "yoggArena"
  | "upgradePrize"
  | "vault"
  | "sinDoreiMirror"
  | "mysteryFlower"
  | "circusPrize"
  | "continuingEducation"
  | "herosCall"
  | "risingTide"
  | "matchFixing"
  | "incubating"
  | "treasureSeeker"
  | "facelessEvery4"
  | "bringBuddies"
  | "dualUniverse"
  | "emergencyLanding";

export interface SystemEventDefinition {
  id: string;
  cardId: string;
  name: string;
  description: string;
  effect: SystemEventEffect;
}

/** Official Anomalies that can coexist with this local Trinket ruleset. */
export const SYSTEM_EVENT_DEFINITIONS = [
  {
    id: "system-event-golden-arrow",
    cardId: "BG31_Anomaly_124",
    name: "点金箭",
    description: "每3个回合，获取一张点金箭。",
    effect: "goldenArrowEveryThreeTurns",
  },
  {
    id: "system-event-perfected-alchemy",
    cardId: "BG27_Anomaly_751",
    name: "完美炼金术",
    description: "开局时拥有一张点金术。",
    effect: "startWithGoldenizer",
  },
  {
    id: "system-event-money-match",
    cardId: "BG27_Anomaly_000",
    name: "金钱大战",
    description: "对战开始时即有10枚铸币。",
    effect: "startWithTenGold",
  },
  {
    id: "system-event-sandglass",
    cardId: "BG27_Anomaly_116",
    name: "讲究的沙漏",
    description: "以酒馆等级2开始赛局。",
    effect: "startAtTier2",
  },
  {
    id: "system-event-amanthul",
    cardId: "BG27_Anomaly_119",
    name: "阿曼苏尔的节制",
    description: "以酒馆等级3和9枚铸币开始赛局。",
    effect: "startAtTier3With9Gold",
  },
  {
    id: "system-event-full-house",
    cardId: "BG27_Anomaly_102",
    name: "座无虚席",
    description: "旅店中永远有7个卡牌。",
    effect: "fullHouse",
  },
  {
    id: "system-event-titan-grip",
    cardId: "BG27_Anomaly_113",
    name: "泰坦爪钩",
    description: "每回合你购买的第一个手下免费。",
    effect: "titanGrip",
  },
  {
    id: "system-event-buy-one-get-one",
    cardId: "BG27_Anomaly_111",
    name: "买一送一",
    description: "你每回合第一次购买手下时，会获得一张它的复製品。",
    effect: "buyOneGetOne",
  },
  {
    id: "system-event-gold-carryover",
    cardId: "BG27_Anomaly_100",
    name: "艾蜜特斯的谨慎",
    description: "未花费的金币会带到你的下一回合。若你存了至少5枚金币，获得1枚额外金币。",
    effect: "goldCarryover",
  },
  {
    id: "system-event-refund-trick",
    cardId: "BG27_Anomaly_104",
    name: "不退款就捣蛋",
    description:
      "以1枚金币开始赛局。手下花费(1)枚金币，但卖出时获得(0)枚金币。升级旅店的消耗降低(2)。",
    effect: "refundTrick",
  },
  {
    id: "system-event-mimiron-clockwork",
    cardId: "BG27_Anomaly_117",
    name: "弥米伦发条竞技场",
    description: "无法以金币升级旅店。旅店每两回合会自动升级。",
    effect: "mimironsClockworkArena",
  },
  {
    id: "system-event-norgannon",
    cardId: "BG27_Anomaly_106",
    name: "诺甘农的秘密",
    description: "可提升至旅店等级7。对战开始时拥有10点额外护甲值。",
    effect: "norgannonsSecret",
  },
  {
    id: "system-event-light-the-way",
    cardId: "BG31_Anomaly_109",
    name: "点亮道路",
    description: "每当你重置两次后，下回合获得1枚金币。",
    effect: "lightTheWay",
  },
  {
    id: "system-event-final-hour",
    cardId: "BG31_Anomaly_126",
    name: "最后时刻",
    description: "抵销你的英雄在战斗中第一次受到的致命伤，并在下回合获得11枚金币。",
    effect: "finalHour",
  },
  {
    id: "system-event-immediate-formation",
    cardId: "BG31_Anomaly_122",
    name: "立即布阵",
    description: "开 局时获得3个不同的旅店等级1手下。",
    effect: "immediateFormation",
  },
  {
    id: "system-event-scouts-honor",
    cardId: "BG31_Anomaly_118",
    name: "斥候荣耀",
    description: "开局时场上有一张有耐心的斥候。",
    effect: "scoutsHonor",
  },
  {
    id: "system-event-tier-match",
    cardId: "BG31_Anomaly_108",
    name: "精灵精英",
    description: "旅店只会提供与你的旅店等级相同的卡牌。",
    effect: "tierMatchOnly",
  },
  {
    id: "system-event-assembly-line",
    cardId: "BG31_Anomaly_112",
    name: "流水线",
    description: "每第2个回合结束时，获得你最左边的手下的一 张未加成分身。",
    effect: "assemblyLine",
  },
  {
    id: "system-event-plane-alignment",
    cardId: "BG31_Anomaly_121",
    name: "界域校准",
    description: "每个回合开始时获得一个你数量最多手下类型的随机手下。（于第2回合解 锁）",
    effect: "planeAlignment",
  },
  {
    id: "system-event-golden-arena",
    cardId: "BG27_Anomaly_115",
    name: "黄金竞技场",
    description: "全部手下皆為金卡，但你无法取得三合一奖励。",
    effect: "goldenArena",
  },
  {
    id: "system-event-false-idols",
    cardId: "BG27_Anomaly_110",
    name: "虚假塑像",
    description: "你只需要2个手下，就能合成金卡。不再获得三合一奖励，改為获得金币。",
    effect: "falseIdols",
  },
  {
    id: "system-event-extra-spell",
    cardId: "BG31_Anomaly_101",
    name: "情势判断",
    description: "每次重置后，旅店都会提供1个额 外的旅店法术。",
    effect: "extraSpellPerRefresh",
  },
  {
    id: "system-event-gladiator-spoils",
    cardId: "BG31_Anomaly_105",
    name: "斗士的战利品",
    description: "在你赢得一场战斗后，发现一个你旅 店等级的手下。反之则获得一个低于你旅店等级一级的随机手下。",
    effect: "gladiatorSpoils",
  },
  {
    id: "system-event-gargonnis-storm",
    cardId: "BG27_Anomaly_114",
    name: "葛刚尼斯的风暴",
    description: "手下花费2枚金币。你无法重置旅店。旅店会 在你购买一张卡牌后自行重置。",
    effect: "gargonnisStorm",
  },
  {
    id: "system-event-overseers-orb",
    cardId: "BG27_Anomaly_120",
    name: "监督者的宝珠",
    description: "在你升级旅店后，以你数量最 多的手下类型重置旅店。",
    effect: "overseersOrb",
  },
  {
    id: "system-event-tavern-special",
    cardId: "BG27_Anomaly_107",
    name: "旅店 特典",
    description: "旅店内所有类型的手下，永远有7张卡牌。",
    effect: "tavernSpecial",
  },
  {
    id: "system-event-wisdomball",
    cardId: "BG27_Anomaly_118",
    name: "异象智慧球",
    description: "偶尔会获得有用的重置！（于第6回合解锁）",
    effect: "wisdomballAnomaly",
  },
  {
    id: "system-event-yogg-arena",
    cardId: "BG27_Anomaly_122",
    name: "尤格竞技场",
    description: "在每个回合开始时转动相同的尤格萨轮。",
    effect: "yoggArena",
  },
  {
    id: "system-event-upgrade-prize",
    cardId: "BG27_Anomaly_121",
    name: "升级奖品",
    description: "在你升级旅店后，发现一个等级1的暗月奖品。（3回合后强化！）",
    effect: "upgradePrize",
  },
  {
    id: "system-event-vault",
    cardId: "BG27_Anomaly_123",
    name: "宝库",
    description: "在第X回合，发现一个金卡等级X手下（等级3-7版本）。",
    effect: "vault",
  },
  {
    id: "system-event-sindorei-mirror",
    cardId: "BG31_Anomaly_103",
    name: "辛多雷之镜",
    description: "你每回合第一次购买旅店法术後，获得一张它的复製品（於第5回合解锁）。",
    effect: "sinDoreiMirror",
  },
  {
    id: "system-event-mystery-flower",
    cardId: "BG31_Anomaly_106",
    name: "奥秘之花",
    description: "在每个回合开始时，发现一个旅店法术。（於第3回合解锁）",
    effect: "mysteryFlower",
  },
  {
    id: "system-event-circus-prize",
    cardId: "BG27_Anomaly_103",
    name: "马戏团奖赏",
    description: "三合一奖励不提供手下，改為发现一个等级1暗月奖品。",
    effect: "circusPrize",
  },
  {
    id: "system-event-continuing-education",
    cardId: "BG31_Anomaly_102",
    name: "继续教育",
    description: "在每个回合开始时获得一个进化卷轴。每个回合都会变成高一 级的旅店法术。",
    effect: "continuingEducation",
  },
  {
    id: "system-event-heros-call",
    cardId: "BG27_Anomaly_125",
    name: "勇士召唤",
    description: "在赛局开始时，全部玩家从同样的选择中发现一个等级6的手下。",
    effect: "herosCall",
  },
  {
    id: "system-event-rising-tide",
    cardId: "BG31_Anomaly_104",
    name: "水涨船高",
    description: "在你升级旅店後，发现一个等级1的法术。（每2个回合获得强化！）",
    effect: "risingTide",
  },
  {
    id: "system-event-match-fixing",
    cardId: "BG27_Anomaly_105",
    name: "打假赛",
    description: "每个回合获得3枚金币。",
    effect: "matchFixing",
  },
  {
    id: "system-event-incubating",
    cardId: "BG31_Anomaly_107",
    name: "孵育异变",
    description: "不具有类型的手下拥有全部手下类型。",
    effect: "incubating",
  },
  {
    id: "system-event-treasure-seeker",
    cardId: "BG27_Anomaly_112",
    name: "宝库追寻者之路",
    description: "重置5次以後，获得一个当前酒馆等级的金卡手下。",
    effect: "treasureSeeker",
  },
  {
    id: "system-event-faceless",
    cardId: "BG27_Anomaly_119",
    name: "无面无间",
    description: "每4回合获得一个「无面操纵者」。",
    effect: "facelessEvery4",
  },
  {
    id: "system-event-bring-buddies",
    cardId: "BG27_Anomaly_108",
    name: "叫伙伴来",
    description: "每个玩家获得其英雄的伙伴。",
    effect: "bringBuddies",
  },
  {
    id: "system-event-dual-universe",
    cardId: "BG31_Anomaly_125",
    name: "双重宇宙",
    description: "在赛局开始时发现第二个英雄能力。",
    effect: "dualUniverse",
  },
  {
    id: "system-event-emergency-landing",
    cardId: "BG31_Anomaly_111",
    name: "紧急着陆",
    description: "每回合从备选手下库中移除旅店一个手下的所有卡牌。",
    effect: "emergencyLanding",
  },
] as const satisfies readonly SystemEventDefinition[];

export const SYSTEM_TAVERN_SPELL_DEFINITIONS = [
  {
    id: "system-spell-goldenizer",
    cardId: "BG26_813t",
    name: "点金术",
    tier: 1,
    cost: 0,
    description: "使一个友方随从变为金色。",
    effectSupport: "complete",
    effect: "goldenizer",
    target: "friendly",
  },
  {
    id: "system-spell-golden-arrow",
    cardId: "BG31_Anomaly_124t4",
    name: "点金箭",
    tier: 1,
    cost: 0,
    description: "选择酒馆里的一个随从，将其变为金色。",
    effectSupport: "complete",
    effect: "goldenArrow",
    target: "anyMinion",
  },
  {
    id: "system-spell-mirror-lens",
    cardId: trinketSnapshot.relatedCards.mirrorLens.cardId,
    name: trinketSnapshot.relatedCards.mirrorLens.name,
    tier: 1,
    cost: trinketSnapshot.relatedCards.mirrorLens.cost,
    description: trinketSnapshot.relatedCards.mirrorLens.description,
    effectSupport: "complete",
    effect: "mirrorLens",
    target: "anyMinion",
  },
] as const satisfies readonly TavernSpellDefinition[];

const TRINKET_BY_ID = new Map<string, TrinketDefinition>(
  TRINKET_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const SOUVENIR_COPY_TRINKET_ID_PREFIX =
  "souvenir-copy:" as const;
export const TRIP_VOUCHER_REPLACEMENT_TRINKET_ID_PREFIX =
  "trip-voucher-replacement:" as const;
export const MYSTERY_CUBE_REPLACEMENT_TRINKET_ID_PREFIX =
  "mystery-cube-replacement:" as const;

export type TrinketAliasKind =
  | "souvenirCopy"
  | "tripVoucherReplacement"
  | "mysteryCubeReplacement";

const TRINKET_ALIAS_PREFIX_BY_KIND = {
  souvenirCopy: SOUVENIR_COPY_TRINKET_ID_PREFIX,
  tripVoucherReplacement:
    TRIP_VOUCHER_REPLACEMENT_TRINKET_ID_PREFIX,
  mysteryCubeReplacement:
    MYSTERY_CUBE_REPLACEMENT_TRINKET_ID_PREFIX,
} as const satisfies Readonly<Record<TrinketAliasKind, string>>;

const TRINKET_ALIAS_TARGET_TIER_BY_KIND = {
  souvenirCopy: "greater",
  tripVoucherReplacement: "greater",
  mysteryCubeReplacement: "lesser",
} as const satisfies Readonly<Record<TrinketAliasKind, TrinketTier>>;

export function createTrinketAliasDefinitionId(
  kind: TrinketAliasKind,
  targetDefinitionId: string,
): string {
  const target = TRINKET_BY_ID.get(targetDefinitionId);
  const requiredTier = TRINKET_ALIAS_TARGET_TIER_BY_KIND[kind];
  if (!target || target.tier !== requiredTier) {
    throw new Error(
      `The ${kind} Trinket alias requires a ${requiredTier} target: ${targetDefinitionId}`,
    );
  }
  return `${TRINKET_ALIAS_PREFIX_BY_KIND[kind]}${targetDefinitionId}`;
}

export function getTrinketAliasKind(
  id: string,
): TrinketAliasKind | null {
  for (const [kind, prefix] of Object.entries(
    TRINKET_ALIAS_PREFIX_BY_KIND,
  ) as [TrinketAliasKind, string][]) {
    if (id.startsWith(prefix)) {
      return kind;
    }
  }
  return null;
}

function getAliasedTrinketDefinition(
  id: string,
): TrinketDefinition | null {
  const kind = getTrinketAliasKind(id);
  if (kind === null) {
    return null;
  }
  const prefix = TRINKET_ALIAS_PREFIX_BY_KIND[kind];
  const target = TRINKET_BY_ID.get(id.slice(prefix.length));
  return target?.tier === TRINKET_ALIAS_TARGET_TIER_BY_KIND[kind]
    ? { ...target, id }
    : null;
}
const SYSTEM_EVENT_BY_ID = new Map<string, SystemEventDefinition>(
  SYSTEM_EVENT_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
);
const SYSTEM_TAVERN_SPELL_ID_SET = new Set<string>(
  SYSTEM_TAVERN_SPELL_DEFINITIONS.map((definition) => definition.id),
);

export function getTrinketDefinition(id: string): TrinketDefinition {
  const definition = TRINKET_BY_ID.get(id) ?? getAliasedTrinketDefinition(id);
  if (!definition) {
    throw new Error(`Unknown Trinket definition: ${id}`);
  }
  return definition;
}

export function isTrinketDefinitionId(id: string): boolean {
  return TRINKET_BY_ID.has(id) || getAliasedTrinketDefinition(id) !== null;
}

const ADDITIONAL_TRINKET_SOURCE_CARD_IDS_BY_TIER = {
  lesser: new Set(["BG35_MagicItem_816", "BG35_MagicItem_818"]),
  greater: new Set(["BG35_MagicItem_816t"]),
} as const satisfies Readonly<Record<TrinketTier, ReadonlySet<string>>>;

/**
 * A player normally owns one Trinket of each tier. Orb of the Unknown grants
 * one additional Trinket of its own tier, while Souvenir Stand and Trip
 * Vouchers retain their Lesser slot as an aliased Greater Trinket. Mystery
 * Cube aliases still occupy its regular Lesser slot while changing the
 * definition whose effects are active.
 */
export function areOwnedTrinketDefinitionIdsValid(
  ids: readonly unknown[],
): ids is readonly string[] {
  if (
    ids.length > 4 ||
    !ids.every(
      (id): id is string =>
        typeof id === "string" && isTrinketDefinitionId(id),
    ) ||
    new Set(ids).size !== ids.length
  ) {
    return false;
  }
  const definitions = ids.map(getTrinketDefinition);
  for (const tier of ["lesser", "greater"] as const) {
    const tierEntries = definitions
      .map((definition, index) => ({ definition, id: ids[index] as string }))
      .filter(
        ({ definition }) => definition.tier === tier,
      );
    const aliasCount = tierEntries.filter(({ id }) => {
      const aliasKind = getTrinketAliasKind(id);
      return (
        aliasKind === "souvenirCopy" ||
        aliasKind === "tripVoucherReplacement"
      );
    }).length;
    const additionalTrinketSourceCount = tierEntries.filter(
      ({ definition }) =>
        ADDITIONAL_TRINKET_SOURCE_CARD_IDS_BY_TIER[tier].has(
          definition.cardId,
        ),
    ).length;
    if (
      tierEntries.length >
      1 + aliasCount + additionalTrinketSourceCount
    ) {
      return false;
    }
  }
  return true;
}

export function getSystemEventDefinition(
  id: string,
): SystemEventDefinition {
  const definition = SYSTEM_EVENT_BY_ID.get(id);
  if (!definition) {
    throw new Error(`Unknown system event definition: ${id}`);
  }
  return definition;
}

export function isSystemEventDefinitionId(id: string): boolean {
  return SYSTEM_EVENT_BY_ID.has(id);
}

export function isSystemTavernSpellDefinitionId(id: string): boolean {
  return SYSTEM_TAVERN_SPELL_ID_SET.has(id);
}

export function trinketsForTier(
  tier: TrinketTier,
  heroPowerId?: string | null,
): TrinketDefinition[] {
  return TRINKET_DEFINITIONS.filter(
    (definition) =>
      definition.inPool &&
      definition.tier === tier &&
      (heroPowerId === undefined ||
        trinketCanBeOfferedWithHeroPower(definition, heroPowerId)),
  ).map((definition) => ({ ...definition }));
}

export function trinketCanBeOfferedWithHeroPower(
  definition: TrinketDefinition,
  heroPowerId: string | null,
): boolean {
  if (MAXWELL_STICKER_CARD_IDS.has(definition.cardId)) {
    return getBuddyDefinitionIdForHeroPower(heroPowerId) !== null;
  }
  if (definition.cardId === SOUS_CHEF_LABEL_CARD_ID) {
    return (
      heroPowerId !== null &&
      heroPowerCanBeManuallyActivated(heroPowerId)
    );
  }
  return true;
}
