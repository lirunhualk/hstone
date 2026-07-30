import liveRosterSnapshot from "./generated/battlegrounds-36.0.3-247416.zhCN.json" with {
  type: "json",
};
import type { MinionDefinition, Tribe } from "./types.ts";

export const CURRENT_ROSTER_VERSION = "battlegrounds-36.0.3-247416-v20";
/** Compatibility alias for existing save and engine imports. */
export const CLASSIC_ROSTER_VERSION = CURRENT_ROSTER_VERSION;

export const TRIBE_NAMES: Readonly<Record<Tribe, string>> = {
  beast: "野兽",
  mech: "机械",
  demon: "恶魔",
  murloc: "鱼人",
  dragon: "龙",
  pirate: "海盗",
  elemental: "元素",
  naga: "纳迦",
  quilboar: "野猪人",
  undead: "亡灵",
  all: "全部",
  neutral: "中立",
};

/**
 * Stable legacy fixtures for rules already implemented by the engine. They are
 * retained for focused mechanics tests and token generation, but are converted
 * to non-collectible definitions before joining the public definition catalog.
 */
const LEGACY_FIXTURE_DEFINITIONS: readonly MinionDefinition[] = [
  // Tier 1
  {
    id: "alleycat",
    cardId: "BG_CFM_315",
    name: "雄斑虎",
    tier: 1,
    tribe: "beast",
    attack: 1,
    health: 1,
    description: "战吼：召唤一头1/1的雌斑虎。",
    battlecry: [{ kind: "summon", definitionId: "tabbycat-token", count: 1 }],
  },
  {
    id: "murloc-tidehunter",
    cardId: "EX1_506",
    name: "鱼人猎潮者",
    tier: 1,
    tribe: "murloc",
    attack: 2,
    health: 1,
    description: "战吼：召唤一个1/1的鱼人斥候。",
    battlecry: [
      { kind: "summon", definitionId: "murloc-scout-token", count: 1 },
    ],
  },
  {
    id: "dragonspawn-lieutenant",
    cardId: "BGS_039",
    name: "龙人军官",
    tier: 1,
    tribe: "dragon",
    attack: 2,
    health: 3,
    taunt: true,
    description: "嘲讽",
  },
  {
    id: "vulgar-homunculus",
    cardId: "LOOT_013",
    name: "粗俗的矮劣魔",
    tier: 1,
    tribe: "demon",
    attack: 2,
    health: 4,
    taunt: true,
    description: "嘲讽。战吼：对你的英雄造成2点伤害。",
    battlecry: [{ kind: "damageHero", amount: 2 }],
  },
  {
    id: "wrath-weaver",
    cardId: "BGS_004",
    name: "愤怒编织者",
    tier: 1,
    tribe: "demon",
    attack: 1,
    health: 3,
    description:
      "在你使用一张恶魔牌后，对你的英雄造成1点伤害并获得+2/+2。",
    afterFriendlyPlayed: {
      tribe: "demon",
      attack: 2,
      health: 2,
      heroDamage: 1,
    },
  },
  {
    id: "scallywag",
    cardId: "BGS_061",
    name: "海盗无赖",
    tier: 1,
    tribe: "pirate",
    attack: 3,
    health: 1,
    description: "亡语：召唤一个1/1的海盗并使其立即发起攻击。",
    deathrattle: [
      {
        kind: "summon",
        definitionId: "sky-pirate-token",
        count: 1,
        immediateAttack: true,
      },
    ],
  },

  // Tier 2
  {
    id: "harvest-golem",
    cardId: "BG_EX1_556",
    name: "麦田傀儡",
    tier: 2,
    tribe: "mech",
    attack: 2,
    health: 3,
    description: "亡语：召唤一个2/1的损坏的傀儡。",
    deathrattle: [
      { kind: "summon", definitionId: "damaged-golem-token", count: 1 },
    ],
  },
  {
    id: "kaboom-bot",
    cardId: "BG_BOT_606",
    name: "爆爆机器人",
    tier: 2,
    tribe: "mech",
    attack: 2,
    health: 2,
    description: "亡语：随机对一个敌方随从造成4点伤害。",
    deathrattle: [{ kind: "damageEnemy", amount: 4, target: "random" }],
  },
  {
    id: "spawn-of-nzoth",
    cardId: "BG_OG_256",
    name: "恩佐斯的子嗣",
    tier: 2,
    tribe: "neutral",
    attack: 2,
    health: 2,
    description: "亡语：使你的所有随从获得+1/+1。",
    deathrattle: [
      { kind: "buff", target: "allFriendly", attack: 1, health: 1 },
    ],
  },
  {
    id: "selfless-hero",
    cardId: "BG_OG_221",
    name: "无私的英雄",
    tier: 2,
    tribe: "neutral",
    attack: 2,
    health: 1,
    description: "亡语：随机使一个友方随从获得圣盾。",
    deathrattle: [{ kind: "grantShield", target: "randomFriendly" }],
  },
  {
    id: "nathrezim-overseer",
    cardId: "BGS_001",
    name: "纳斯雷兹姆监工",
    tier: 2,
    tribe: "demon",
    attack: 2,
    health: 4,
    description: "战吼：随机使一个其他友方恶魔获得+2/+2。",
    battlecry: [
      {
        kind: "buff",
        target: "randomFriendlyTribe",
        tribe: "demon",
        attack: 2,
        health: 2,
      },
    ],
  },
  {
    id: "murloc-warleader",
    cardId: "BG_EX1_507",
    name: "鱼人领军",
    tier: 2,
    tribe: "murloc",
    attack: 3,
    health: 3,
    description: "你的其他鱼人拥有+2攻击力。",
    aura: { tribe: "murloc", attack: 2, health: 0, otherOnly: true },
  },

  // Tier 3
  {
    id: "bronze-warden",
    cardId: "BGS_034",
    name: "青铜守卫",
    tier: 3,
    tribe: "dragon",
    attack: 2,
    health: 1,
    divineShield: true,
    reborn: true,
    description: "圣盾，复生",
  },
  {
    id: "rat-pack",
    cardId: "BG_CFM_316",
    name: "瘟疫鼠群",
    tier: 3,
    tribe: "beast",
    attack: 2,
    health: 2,
    description: "亡语：召唤若干个1/1的老鼠，数量等同于本随从的攻击力。",
    deathrattle: [
      {
        kind: "summon",
        definitionId: "rat-token",
        count: "sourceAttack",
      },
    ],
  },
  {
    id: "deflect-o-bot",
    cardId: "BGS_071",
    name: "偏折机器人",
    tier: 3,
    tribe: "mech",
    attack: 3,
    health: 2,
    divineShield: true,
    description:
      "圣盾。在战斗阶段中，每当你召唤一个机械，便获得+2攻击力和圣盾。",
    afterFriendlySummoned: {
      tribe: "mech",
      attack: 2,
      grantShield: true,
    },
  },
  {
    id: "soul-juggler",
    cardId: "BGS_002",
    name: "灵魂杂耍者",
    tier: 3,
    tribe: "demon",
    attack: 3,
    health: 5,
    description:
      "在一个友方恶魔死亡后，对生命值最高的敌方随从造成4点伤害。",
    afterFriendlyDied: {
      tribe: "demon",
      damageEnemy: 4,
      damageTarget: "highestHealth",
    },
  },
  {
    id: "screwjank-clunker",
    cardId: "GVG_055",
    name: "废旧螺栓机甲",
    tier: 3,
    tribe: "mech",
    attack: 2,
    health: 5,
    description: "战吼：随机使一个其他友方机械获得+2/+2。",
    battlecry: [
      {
        kind: "buff",
        target: "randomFriendlyTribe",
        tribe: "mech",
        attack: 2,
        health: 2,
      },
    ],
  },
  {
    id: "houndmaster",
    cardId: "DS1_070",
    name: "驯兽师",
    tier: 3,
    tribe: "neutral",
    attack: 4,
    health: 3,
    description: "战吼：随机使一个友方野兽获得+2/+2和嘲讽。",
    battlecry: [
      {
        kind: "buff",
        target: "randomFriendlyTribe",
        tribe: "beast",
        attack: 2,
        health: 2,
        taunt: true,
      },
    ],
  },

  // Tier 4
  {
    id: "cave-hydra",
    cardId: "BG_LOOT_078",
    name: "洞穴多头蛇",
    tier: 4,
    tribe: "beast",
    attack: 2,
    health: 4,
    cleave: true,
    description: "同时对其攻击目标相邻的随从造成伤害。",
  },
  {
    id: "security-rover",
    cardId: "BOT_218",
    name: "安保巡游者",
    tier: 4,
    tribe: "mech",
    attack: 2,
    health: 6,
    description: "每当本随从受到伤害，召唤一个2/3并具有嘲讽的机械。",
    afterSelfDamaged: [
      { kind: "summon", definitionId: "guard-bot-token", count: 1 },
    ],
  },
  {
    id: "mechano-egg",
    cardId: "BOT_537",
    name: "机械蛋",
    tier: 4,
    tribe: "mech",
    attack: 0,
    health: 5,
    description: "亡语：召唤一个8/8的机械暴龙。",
    deathrattle: [
      { kind: "summon", definitionId: "robosaur-token", count: 1 },
    ],
  },
  {
    id: "savannah-highmane",
    cardId: "BG_EX1_534",
    name: "长鬃草原狮",
    tier: 4,
    tribe: "beast",
    attack: 6,
    health: 5,
    description: "亡语：召唤两只2/2的土狼。",
    deathrattle: [
      { kind: "summon", definitionId: "hyena-token", count: 2 },
    ],
  },
  {
    id: "defender-of-argus",
    cardId: "EX1_093",
    name: "阿古斯防御者",
    tier: 4,
    tribe: "neutral",
    attack: 3,
    health: 3,
    description: "战吼：使相邻的随从获得+1/+1和嘲讽。",
    battlecry: [
      {
        kind: "buff",
        target: "adjacentFriendly",
        attack: 1,
        health: 1,
        taunt: true,
      },
    ],
  },
  {
    id: "junkbot",
    cardId: "GVG_106",
    name: "回收机器人",
    tier: 4,
    tribe: "mech",
    attack: 1,
    health: 5,
    description: "每当一个友方机械死亡，便获得+2/+2。",
    afterFriendlyDied: { tribe: "mech", attack: 2, health: 2 },
  },

  // Tier 5
  {
    id: "titus-rivendare",
    cardId: "BG25_354",
    name: "提图斯·瑞文戴尔",
    tier: 5,
    tribe: "neutral",
    attack: 1,
    health: 7,
    description: "你的亡语额外触发一次。",
    extraDeathrattles: 1,
  },
  {
    id: "brann-bronzebeard",
    cardId: "BG_LOE_077",
    name: "布莱恩·铜须",
    tier: 5,
    tribe: "neutral",
    attack: 2,
    health: 4,
    description: "你的战吼会触发两次。",
    extraBattlecries: 1,
  },
  {
    id: "lightfang-enforcer",
    cardId: "BGS_009",
    name: "光牙执行者",
    tier: 5,
    tribe: "neutral",
    attack: 8,
    health: 8,
    description: "在你的回合结束时，使每个类型的各一个友方随从获得+4/+4。",
    endOfTurn: { kind: "onePerTribe", attack: 4, health: 4 },
  },
  {
    id: "kangors-apprentice",
    cardId: "BGS_012",
    name: "坎格尔的学徒",
    tier: 5,
    tribe: "neutral",
    attack: 3,
    health: 6,
    description: "亡语：召唤你本场战斗中最先死亡的2个机械的原始版复制。",
    deathrattle: [{ kind: "resummonMechs", count: 2 }],
  },
  {
    id: "annihilan-battlemaster",
    cardId: "BGS_010",
    name: "安尼赫兰战场军官",
    tier: 5,
    tribe: "demon",
    attack: 3,
    health: 1,
    description: "战吼：你的英雄每缺失1点生命值，便获得+1生命值。",
    battlecry: [{ kind: "gainMissingHealth", multiplier: 1 }],
  },
  {
    id: "voidlord",
    cardId: "LOOT_368",
    name: "虚空领主",
    tier: 5,
    tribe: "demon",
    attack: 3,
    health: 9,
    taunt: true,
    description: "嘲讽。亡语：召唤三个1/3并具有嘲讽的恶魔。",
    deathrattle: [
      { kind: "summon", definitionId: "voidwalker-token", count: 3 },
    ],
  },

  // Tier 6
  {
    id: "goldrinn",
    cardId: "BGS_018",
    name: "巨狼戈德林",
    tier: 6,
    tribe: "beast",
    attack: 8,
    health: 8,
    description: "亡语：在本场战斗的剩余时间内，你的野兽拥有+8/+8。",
    deathrattle: [
      {
        kind: "buff",
        target: "friendlyTribe",
        tribe: "beast",
        attack: 8,
        health: 8,
      },
    ],
  },
  {
    id: "ghastcoiler",
    cardId: "BGS_008",
    name: "阴森巨蟒",
    tier: 6,
    tribe: "beast",
    attack: 7,
    health: 7,
    description: "亡语：随机召唤两个亡语随从。",
    deathrattle: [{ kind: "summonRandomDeathrattle", count: 2 }],
  },
  {
    id: "foe-reaper-4000",
    cardId: "BG_GVG_113",
    name: "死神4000型",
    tier: 6,
    tribe: "mech",
    attack: 6,
    health: 9,
    cleave: true,
    description: "同时对其攻击目标相邻的随从造成伤害。",
  },
  {
    id: "zapp-slywick",
    cardId: "BGS_022",
    name: "扎普·斯里维克",
    tier: 6,
    tribe: "neutral",
    attack: 11,
    health: 22,
    windfury: true,
    alwaysAttacksLowestAttack: true,
    description: "风怒。本随从总会攻击攻击力最低的敌方随从。",
  },
  {
    id: "maexxna",
    cardId: "FP1_010",
    name: "迈克斯纳",
    tier: 6,
    tribe: "beast",
    attack: 2,
    health: 8,
    poisonous: true,
    description: "剧毒",
  },
  {
    id: "mama-bear",
    cardId: "BGS_021",
    name: "熊妈妈",
    tier: 6,
    tribe: "beast",
    attack: 6,
    health: 6,
    description: "每当你召唤一只野兽，使其获得+6/+6。",
    afterFriendlySummoned: { tribe: "beast", attack: 6, health: 6 },
  },

  // Combat/recruit tokens use their own Hearthstone CardIDs so their portraits
  // remain recognizable instead of reusing the parent minion's artwork.
  {
    id: "tabbycat-token",
    cardId: "BG_CFM_315t",
    name: "雌斑虎",
    tier: 1,
    tribe: "beast",
    attack: 1,
    health: 1,
    description: "由雄斑虎召唤。",
    collectible: false,
  },
  {
    id: "murloc-scout-token",
    cardId: "EX1_506a",
    name: "鱼人斥候",
    tier: 1,
    tribe: "murloc",
    attack: 1,
    health: 1,
    description: "由鱼人猎潮者召唤。",
    collectible: false,
  },
  {
    id: "sky-pirate-token",
    cardId: "BGS_061t",
    name: "空中海盗",
    tier: 1,
    tribe: "pirate",
    attack: 1,
    health: 1,
    description: "由海盗无赖召唤并立即攻击。",
    collectible: false,
  },
  {
    id: "damaged-golem-token",
    cardId: "BG_EX1_556t",
    name: "损坏的傀儡",
    tier: 1,
    tribe: "mech",
    attack: 2,
    health: 1,
    description: "由麦田傀儡召唤。",
    collectible: false,
  },
  {
    id: "rat-token",
    cardId: "BG_CFM_316t",
    name: "老鼠",
    tier: 1,
    tribe: "beast",
    attack: 1,
    health: 1,
    description: "由瘟疫鼠群召唤。",
    collectible: false,
  },
  {
    id: "guard-bot-token",
    cardId: "BOT_218t",
    name: "警卫机器人",
    tier: 1,
    tribe: "mech",
    attack: 2,
    health: 3,
    taunt: true,
    description: "嘲讽。由安保巡游者召唤。",
    collectible: false,
  },
  {
    id: "robosaur-token",
    cardId: "BOT_537t",
    name: "机械暴龙",
    tier: 1,
    tribe: "mech",
    attack: 8,
    health: 8,
    description: "由机械蛋召唤。",
    collectible: false,
  },
  {
    id: "hyena-token",
    cardId: "BG_EX1_534t",
    name: "土狼",
    tier: 1,
    tribe: "beast",
    attack: 2,
    health: 2,
    description: "由长鬃草原狮召唤。",
    collectible: false,
  },
  {
    id: "voidwalker-token",
    cardId: "BG_CS2_065",
    name: "虚空行者",
    tier: 1,
    tribe: "demon",
    attack: 1,
    health: 3,
    taunt: true,
    description: "嘲讽。由虚空领主召唤。",
    collectible: false,
  },
] as const;

interface LiveRosterCard {
  id: string;
  dbfId: number;
  premiumDbfId: number;
  name: string;
  tier: number;
  attack: number;
  health: number;
  races: readonly string[];
  associatedRaces: readonly string[];
  mechanics: readonly string[];
  referencedTags: readonly string[];
  elite: boolean;
  text: string;
}

interface LiveRosterSnapshot {
  minions: readonly LiveRosterCard[];
}

const SOURCE_TRIBE_MAP = {
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
} as const satisfies Readonly<Record<string, Exclude<Tribe, "neutral">>>;

const REUSED_RULE_CARD_IDS = new Set([
  "BGS_004",
  "BGS_071",
  "BG_LOE_077",
  "BG25_354",
  "BGS_012",
  "BGS_018",
]);

const CLEAVE_DESCRIPTION = "同时对其攻击目标相邻的随从造成伤害。";

// Build 247416 contains duplicated internal dynamic-template expansions in
// these zhCN text fields. Keep the pinned source untouched, but present the
// normal localized card text in-game.
const LIVE_DESCRIPTION_OVERRIDES: Readonly<Record<string, string>> = {
  BG21_018:
    "每当本随从通过其他来源获得攻击力时，获得+1生命值。",
  BG26_199:
    "每2个回合，在回合结束时，获取一张本随从左边随从的原始版复制。（还剩2回合！）",
  BG26_529:
    "每3个回合，在回合结束时，随机获取一张龙牌。（还剩3回合！）",
  BG26_810:
    "每当你花掉\n6枚铸币，使你的海盗获得+2攻击力。（还剩6枚！）",
  BG27_005:
    "每当你施放一个酒馆法术，使你的随从获得+1攻击力。",
  BG31_035:
    "在你使用一张纳迦牌后，获得+1/+1。（在本局对战中，你每施放4个法术都会提升！）",
  BG31_816:
    "当你出售本随从时，使你的随从获得+1攻击力。提升你此后投球手的效果。",
  BG31_818:
    "当你出售本随从时，使你的随从获得+1生命值。提升你此后投球手的效果。",
  BG32_235:
    "在你的回合结束时，使相邻的随从获得+1攻击力。每有一个友方金色随从，重复一次。",
  BG35_601:
    "每当本随从受到伤害，获得一次免费的刷新。（每回合限3次。）",
  BG35_801:
    "一旦你购买了4张牌，获得+4/+4。（还剩4张！）",
  BG35_814:
    "一旦本随从的攻击力达到6点，获得圣盾。",
};

function mapSourceTribe(source: string): Tribe {
  const mapped =
    SOURCE_TRIBE_MAP[source as keyof typeof SOURCE_TRIBE_MAP];
  if (!mapped) {
    throw new Error(`Unknown Battlegrounds minion type: ${source}`);
  }
  return mapped;
}

function plainCardText(html: string): string {
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
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function hasMechanic(card: LiveRosterCard, mechanic: string): boolean {
  return card.mechanics.includes(mechanic);
}

function legacyPrintedTribes(definition: MinionDefinition): readonly Tribe[] {
  return definition.tribe === "neutral" ? [] : [definition.tribe];
}

export const LEGACY_RULE_DEFINITIONS: readonly MinionDefinition[] =
  Object.freeze(
    LEGACY_FIXTURE_DEFINITIONS.filter(
      (definition) => definition.collectible !== false,
    ).map((definition) => ({
      ...definition,
      tribes: legacyPrintedTribes(definition),
      associatedTribes: [],
      effectSupport: "complete" as const,
      collectible: false,
    })),
  );

export const TOKEN_DEFINITIONS: readonly MinionDefinition[] = Object.freeze(
  LEGACY_FIXTURE_DEFINITIONS.filter(
    (definition) => definition.collectible === false,
  ).map((definition) => ({
    ...definition,
    tribes: legacyPrintedTribes(definition),
    associatedTribes: [],
    effectSupport: "complete" as const,
    collectible: false,
  })),
);

export const LIVE_TOKEN_DEFINITIONS: readonly MinionDefinition[] =
  Object.freeze([
    {
      id: "live-skeleton-token",
      cardId: "BG_ICC_026t",
      name: "骷髅",
      tier: 1,
      tribe: "undead",
      tribes: ["undead"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 1,
      health: 1,
      description: "由亡语召唤。",
      collectible: false,
    },
    {
      id: "live-microbot-token",
      cardId: "BG_BOT_312t",
      name: "微型机器人",
      tier: 1,
      tribe: "mech",
      tribes: ["mech"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 1,
      health: 1,
      description: "由拔线机召唤。",
      collectible: false,
    },
    {
      id: "live-beetle-token",
      cardId: "BG28_603t",
      name: "甲虫",
      tier: 1,
      tribe: "beast",
      tribes: ["beast"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 2,
      health: 2,
      description: "由甲虫恩泽或野兽效果召唤。",
      collectible: false,
    },
    {
      id: "live-crab-token",
      cardId: "BG27_004t2",
      goldenCardId: "BG27_004_Gt2",
      name: "螃蟹",
      tier: 1,
      tribe: "beast",
      tribes: ["beast"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 3,
      health: 2,
      description: "由螃蟹坐骑的临时亡语召唤。",
      goldenDescription: "由金色螃蟹坐骑的临时亡语召唤。",
      collectible: false,
    },
    {
      id: "live-twilight-whelp-token",
      cardId: "BG34_630t",
      name: "暮光雏龙",
      tier: 1,
      tribe: "dragon",
      tribes: ["dragon"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 3,
      health: 3,
      description: "由暮光龙崽召唤并立即攻击。",
      collectible: false,
    },
    {
      id: "live-helping-hand-token",
      cardId: "BG25_010t",
      name: "援手",
      tier: 1,
      tribe: "undead",
      tribes: ["undead"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 2,
      health: 1,
      reborn: true,
      description: "复生",
      collectible: false,
    },
    {
      id: "live-water-droplet-token",
      cardId: "BGS_115t",
      name: "水滴元素",
      tier: 1,
      tribe: "elemental",
      tribes: ["elemental"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 3,
      health: 3,
      description: "由商贩元素获取。",
      collectible: false,
    },
  ] satisfies readonly MinionDefinition[]);

const LEGACY_RULE_BY_CARD_ID = new Map(
  LEGACY_RULE_DEFINITIONS.map((definition) => [
    definition.cardId,
    definition,
  ]),
);

const LIVE_RULE_OVERRIDES: Readonly<
  Record<string, Partial<MinionDefinition>>
> = {
  BG24_009: {
    goldenCardId: "BG24_009_G",
    goldenDescription:
      "战吼：随机吞食酒馆中的一个随从，获得其双倍属性值。",
    battlecry: [
      {
        kind: "consumeRandomShopMinion",
        goldenMode: "doubleStats",
      },
    ],
  },
  BG26_529: {
    goldenCardId: "BG26_529_G",
    goldenDescription:
      "每3个回合，在回合结束时，随机获取2张龙牌。（还剩3回合！）",
    endOfTurn: {
      kind: "periodicGainRandomMinion",
      everyTurns: 3,
      count: 1,
      tribe: "dragon",
      goldenMode: "doubleCount",
    },
  },
  BG27_004: {
    goldenCardId: "BG27_004_G",
    goldenDescription:
      "塑造法术：直到下个回合，使一个随从获得“亡语：召唤一只6/4的螃蟹”。",
    spellcraft: {
      definitionId: "spellcraft-crab-rider",
    },
  },
  BG23_004: {
    goldenCardId: "BG23_004_G",
    goldenDescription:
      "塑造法术：直到下个回合，使一个随从获得+4/+12和嘲讽。",
    spellcraft: {
      definitionId: "spellcraft-anglers-lure",
    },
  },
  BG26_502: {
    goldenCardId: "BG26_502_G",
    goldenDescription:
      "塑造法术：直到下个回合，使一个随从获得+4/+4。提升你此后的深沉蓝调效果。",
    spellcraft: {
      definitionId: "spellcraft-deep-blue-blues",
    },
  },
  BG26_360: {
    goldenCardId: "BG26_360_G",
    goldenDescription:
      "亡语：随机使你手牌中的一张随从牌获得+14/+14。",
    deathrattle: [
      {
        kind: "buffRandomHandMinion",
        attack: 7,
        health: 7,
      },
    ],
  },
  BG26_160: {
    goldenCardId: "BG26_160_G",
    goldenDescription:
      "亡语：在本局对战中，你的鲜血宝石会额外获得+2攻击力。",
    deathrattle: [
      {
        kind: "improveBloodGems",
        attack: 1,
        health: 0,
      },
    ],
  },
  BG25_041: {
    goldenCardId: "BG25_041_G",
    goldenDescription:
      "战吼：使酒馆中的随从在本局对战中获得+2/+1，触发两次。",
    battlecry: [
      {
        kind: "buffTavern",
        attack: 2,
        health: 1,
        goldenMode: "repeat",
      },
    ],
  },
  BG34_635t: {
    goldenCardId: "BG34_635_Gt",
    goldenDescription:
      "战吼：在本局对战中，你的酒馆法术使随从额外获得+2生命值。",
    battlecry: [
      {
        kind: "improveTavernSpellBuffs",
        attack: 0,
        health: 1,
      },
    ],
  },
  BG34_638t: {
    goldenCardId: "BG34_638_Gt",
    goldenDescription:
      "战吼：在本局对战中，你的酒馆法术使随从额外获得+2攻击力。",
    battlecry: [
      {
        kind: "improveTavernSpellBuffs",
        attack: 1,
        health: 0,
      },
    ],
  },
  BG34_634t: {
    goldenCardId: "BG34_634_Gt",
    goldenDescription:
      "战吼：随机获取两张消耗2枚铸币的酒馆法术牌。",
    battlecry: [
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: { cost: 2 },
        goldenMode: "doubleCount",
      },
    ],
  },
  BG33_894: {
    goldenCardId: "BG33_894_G",
    goldenDescription:
      "战吼，亡语：随机获取两张等级1的酒馆法术牌。",
    battlecry: [
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: { exactTier: 1 },
        goldenMode: "doubleCount",
      },
    ],
    deathrattle: [
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: { exactTier: 1 },
        goldenMode: "doubleCount",
      },
    ],
  },
  BG35_340: {
    goldenCardId: "BG35_340_G",
    goldenDescription:
      "嘲讽。亡语：你购买的下一张酒馆法术牌消耗的铸币减少（2）枚。",
    deathrattle: [
      {
        kind: "discountNextTavernSpell",
        amount: 1,
      },
    ],
  },
  BG31_330: {
    goldenCardId: "BG31_330_G",
    goldenDescription:
      "战吼：你购买的下一张酒馆法术牌消耗的铸币减少（2）枚。",
    battlecry: [
      {
        kind: "discountNextTavernSpell",
        amount: 1,
      },
    ],
  },
  BG32_236: {
    goldenCardId: "BG32_236_G",
    goldenDescription: "圣盾。战吼：使本随从变为金色。",
    battlecry: [{ kind: "makeSelfGolden" }],
  },
  BG32_330: {
    goldenCardId: "BG32_330_G",
    goldenDescription:
      "战斗开始时：如果本随从在你的手牌中，召唤一个它的具有双倍属性值的复制。",
    inHandStartOfCombat: {
      kind: "summonSelfCopy",
      goldenMode: "doubleStats",
    },
  },
  BG35_801: {
    goldenCardId: "BG35_801_G",
    goldenDescription:
      "一旦你购买了4张牌，获得+8/+8。（还剩4张！）",
    afterCardPurchased: {
      purchases: 4,
      attack: 4,
      health: 4,
      goldenMode: "doubleStats",
    },
  },
  BG35_814: {
    goldenCardId: "BG35_814_G",
    goldenDescription:
      "一旦本随从的攻击力达到6点，获得圣盾。（已完成！）",
    conditionalKeyword: {
      attackAtLeast: 6,
      keyword: "divineShield",
    },
  },
  BG20_100: {
    battlecry: [{ kind: "gainBloodGems", count: 2 }],
  },
  BG20_301: {
    afterSold: [{ kind: "gainBloodGems", count: 2 }],
  },
  BG20_203: {
    afterFriendlyPlayed: {
      tribe: "quilboar",
      gainBloodGems: 1,
    },
  },
  BG26_159: {
    battlecry: [
      {
        kind: "improveBloodGems",
        attack: 0,
        health: 1,
      },
    ],
  },
  BG33_888: {
    battlecry: [
      {
        kind: "gainBloodGems",
        count: 1,
        bonusKeyword: "divineShieldForQuilboar",
      },
    ],
  },
  BG35_433: {
    endOfTurn: {
      kind: "gainBloodGems",
      count: 1,
      bonusKeyword: "rebornForQuilboar",
    },
  },
  BG26_135: {
    battlecry: [{ kind: "gainNextTurnGold", amount: 1 }],
  },
  BG33_140: {
    afterSold: [
      {
        kind: "getRandomMinion",
        count: 1,
        filter: { exactTier: 1 },
        maximumTier: "ownerTavern",
        source: "sharedPool",
        goldenMode: "doubleCount",
      },
    ],
  },
  BG31_815: {
    battlecry: [
      {
        kind: "buffTavernType",
        tribe: "elemental",
        attack: 1,
        health: 1,
      },
    ],
  },
  BG23_002: {
    battlecry: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-tavern-coin",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_683: {
    goldenCardId: "BG34_683_G",
    goldenDescription: "战吼：获取2张鲜血宝石弹幕。",
    battlecry: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-blood-gem-barrage",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_682: {
    goldenCardId: "BG34_682_G",
    goldenDescription: "亡语：获取2张鲜血宝石弹幕。",
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-blood-gem-barrage",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_684: {
    goldenCardId: "BG34_684_G",
    goldenDescription: "在你的回合结束时，获取2张查抄宝石。",
    endOfTurn: {
      kind: "gainTavernSpell",
      definitionId: "tavern-spell-gem-confiscation",
      count: 1,
      goldenMode: "doubleCount",
    },
  },
  BG35_143: {
    goldenCardId: "BG35_143_G",
    goldenDescription: "战吼，亡语：获取2张深水族群。",
    battlecry: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-deepwater-clan",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-deepwater-clan",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG35_881: {
    goldenCardId: "BG35_881_G",
    goldenDescription: "战吼，亡语：获取2张奥术吸收。",
    battlecry: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-arcane-absorption",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-arcane-absorption",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG32_111: {
    goldenCardId: "BG32_111_G",
    goldenDescription: "战吼，亡语：获取2张乱放的茶具。",
    battlecry: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-misplaced-tea-set",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-misplaced-tea-set",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG35_882: {
    goldenCardId: "BG35_882_G",
    goldenDescription: "战吼：获取2张燃焰。",
    battlecry: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-blazing-inferno",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG32_891: {
    goldenCardId: "BG32_891_G",
    goldenDescription: "嘲讽。亡语：获取2张富足之杖。",
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-staff-of-enrichment",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG33_809: {
    goldenCardId: "BG33_809_G",
    goldenDescription: "嘲讽。圣盾。亡语：获取2张圣洁庇护。",
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-sanctify",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_694: {
    goldenCardId: "BG34_694_G",
    goldenDescription: "亡语：获取2张惊扰墓穴。",
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-stir-the-graveyard",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG25_009: {
    goldenCardId: "BG25_009_G",
    goldenDescription: "复生。亡语：召唤一个金色的永恒骑士。",
    deathrattle: [
      {
        kind: "summon",
        definitionId: "BG25_008",
        count: 1,
        goldenMode: "goldenToken",
      },
    ],
  },
  BGS_123: {
    goldenCardId: "TB_BaconUps_162",
    goldenDescription: "战吼：随机获取2张元素牌。",
    battlecry: [
      {
        kind: "getRandomMinion",
        count: 1,
        filter: { tribe: "elemental" },
        maximumTier: "ownerTavern",
        source: "sharedPool",
        goldenMode: "doubleCount",
      },
    ],
  },
  BGS_116: {
    goldenCardId: "TB_BaconUps_167",
    goldenDescription: "战吼：获得4次免费的刷新。",
    battlecry: [{ kind: "gainFreeRefreshes", count: 2 }],
  },
  BGS_115: {
    afterSold: [
      {
        kind: "gainMinion",
        definitionId: "live-water-droplet-token",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG22_202: {
    afterSold: [
      {
        kind: "getRandomMinion",
        count: 1,
        filter: { tribe: "murloc" },
        maximumTier: "ownerTavern",
        source: "sharedPool",
        goldenMode: "doubleCount",
      },
    ],
  },
  BG25_011: {
    battlecry: [
      {
        kind: "improveUndeadArmy",
        attack: 1,
        health: 0,
      },
    ],
  },
  BG25_013: {
    afterFriendlyCombatDied: {
      attack: 1,
      health: 0,
    },
  },
  BG25_016: {
    rally: [
      {
        kind: "removeTargetKeywords",
        keywords: ["reborn", "taunt"],
      },
    ],
  },
  BG29_503: {
    interactiveBattlecry: {
      kind: "targetedDiscoverMagnetize",
      targetTribe: "mech",
      discoverTribe: "mech",
      goldenMode: "repeat",
    },
  },
  BG26_146: {
    endOfTurn: {
      kind: "buff",
      target: "self",
      attack: 0,
      health: 1,
    },
  },
  BG26_147: {
    startOfTurn: [{ kind: "gainGold", amount: 1 }],
  },
  BG26_148: {
    deathrattle: [
      {
        kind: "getRandomMinion",
        count: 1,
        filter: {
          tribe: "mech",
          magnetic: true,
        },
        maximumTier: "ownerTavern",
        source: "sharedPool",
        goldenMode: "doubleCount",
      },
    ],
  },
  BG26_501: {
    spellcraft: {
      definitionId: "spellcraft-sick-riffs",
    },
  },
  BG29_300: {
    afterSelfDamaged: [
      {
        kind: "buffRandomHandMinion",
        attack: 2,
        health: 1,
      },
    ],
  },
  BG32_170: {
    deathrattle: [
      {
        kind: "gainTavernSpell",
        definitionId: "tavern-spell-pointy-arrow",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG31_175: {
    rally: [
      {
        kind: "getRandomMinion",
        count: 1,
        filter: {
          tribe: "mech",
          magnetic: true,
        },
        maximumTier: "ownerTavern",
        source: "sharedPool",
        goldenMode: "doubleCount",
      },
    ],
  },
  BG33_241: {
    rally: [
      {
        kind: "buff",
        target: "rightFriendly",
        attack: 2,
        health: 2,
        goldenMode: "doubleStats",
      },
    ],
  },
  BG34_140: {
    rally: [
      {
        kind: "summonFromHand",
        selection: "highestAttack",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG31_859: {
    magnetic: {
      targetTribes: ["mech", "elemental"],
    },
  },
  BG_DEEP_015: {
    magnetic: {
      targetTribes: ["mech", "undead"],
    },
  },
  BG32_172: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "BG_TTN_401",
        count: 1,
        goldenMode: "goldenToken",
      },
    ],
  },
  BG_TTN_401: {
    goldenCardId: "BG_TTN_401_G",
    goldenDescription:
      "在本局对战中，你每召唤过一个其他星元自动机，便拥有+6/+4（无论本随从在哪）。",
  },
  BG25_008: {
    goldenCardId: "BG25_008_G",
    goldenDescription:
      "在本局对战中，每有一个友方永恒骑士死亡，便拥有+8/+4（无论本随从在哪）。",
  },
  BG34_231: {
    goldenCardId: "BG34_231_G",
    goldenDescription:
      "当本随从在你手牌中时，在15个友方随从死亡后，将本随从变为金色。（已完成！）",
  },
  BG34_175: {
    afterMagnetized: [
      {
        kind: "buff",
        target: "allFriendly",
        attack: 5,
        health: 5,
      },
    ],
  },
  BG25_022: {
    deathrattle: [
      {
        kind: "buff",
        target: "randomFriendlyTribe",
        tribe: "undead",
        attack: 1,
        health: 2,
      },
    ],
  },
  BG28_300: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-skeleton-token",
        count: 2,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG29_611: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-microbot-token",
        count: 1,
      },
    ],
  },
  BG31_803: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-beetle-token",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_630: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-twilight-whelp-token",
        count: 1,
        immediateAttack: true,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG25_010: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-helping-hand-token",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG30_125: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-skeleton-token",
        count: 3,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG31_816: {
    afterSold: [
      {
        kind: "improveBallers",
        attack: 1,
        health: 0,
      },
    ],
  },
  BG31_818: {
    afterSold: [
      {
        kind: "improveBallers",
        attack: 0,
        health: 1,
      },
    ],
  },
  BG34_731: {
    deathrattle: [
      {
        kind: "summon",
        definitionId: "BG34_630",
        count: 2,
        taunt: true,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_636t: {
    battlecry: [
      {
        kind: "buff",
        target: "otherFriendlyTribe",
        tribe: "dragon",
        attack: 1,
        health: 3,
      },
    ],
  },
  BG34_637t: {
    battlecry: [
      {
        kind: "buff",
        target: "otherFriendlyTribe",
        tribe: "dragon",
        attack: 3,
        health: 1,
      },
    ],
  },
  BG_DAL_775: {
    deathrattle: [
      {
        kind: "damageAllMinions",
        amount: 3,
        goldenMode: "repeat",
      },
    ],
  },
  BG33_156: {
    deathrattle: [
      {
        kind: "damageAllMinions",
        amount: 2,
        excludeFriendlyTribe: "demon",
        goldenMode: "repeat",
      },
    ],
  },
  BG21_014: {
    startOfCombat: [
      {
        kind: "buff",
        target: "friendlyTribe",
        tribe: "dragon",
        attack: 4,
        health: 4,
      },
    ],
  },
  BG26_805: {
    startOfCombat: [
      {
        kind: "buff",
        target: "friendlyTribe",
        tribe: "beast",
        attack: 1,
        health: 0,
      },
    ],
  },
  BG32_235: {
    endOfTurn: {
      kind: "buff",
      target: "adjacentFriendly",
      attack: 1,
      health: 0,
      repeatPerGoldenFriendly: true,
    },
  },
  BGS_049: {
    sellValue: 3,
    goldenSellValue: 6,
  },
  BG35_702: {
    interactiveBattlecry: {
      kind: "targetedBuff",
      target: "otherFriendly",
      attack: 2,
      health: 2,
      attackPerTavernSpell: 2,
      healthPerTavernSpell: 2,
      goldenMode: "repeat",
    },
  },
  BG34_523: {
    interactiveBattlecry: {
      kind: "discoverMinion",
      tribe: "beast",
      goldenMode: "repeat",
    },
  },
};

/**
 * A live card is marked complete only after its entire printed behavior has a
 * rules implementation. Keeping this allowlist explicit prevents a small
 * partial override from accidentally upgrading the whole card to "complete".
 */
const FULLY_SUPPORTED_LIVE_CARD_IDS = new Set([
  "BG20_100",
  "BG20_203",
  "BG20_301",
  "BG24_009",
  "BG22_202",
  "BG21_014",
  "BG23_002",
  "BG23_004",
  "BG25_001",
  "BG25_008",
  "BG25_009",
  "BG25_010",
  "BG25_011",
  "BG25_013",
  "BG25_016",
  "BG25_022",
  "BG25_041",
  "BG25_354",
  "BG26_146",
  "BG26_135",
  "BG26_147",
  "BG26_148",
  "BG26_159",
  "BG26_160",
  "BG26_360",
  "BG26_501",
  "BG26_502",
  "BG26_529",
  "BG26_805",
  "BG26_817",
  "BG27_004",
  "BG27_005",
  "BG28_300",
  "BG29_503",
  "BG29_611",
  "BG29_300",
  "BG30_125",
  "BG31_175",
  "BG31_330",
  "BG31_803",
  "BG31_815",
  "BG31_816",
  "BG31_818",
  "BG31_859",
  "BG32_235",
  "BG32_236",
  "BG32_330",
  "BG32_170",
  "BG32_172",
  "BG32_111",
  "BG32_891",
  "BG33_156",
  "BG33_140",
  "BG33_241",
  "BG33_888",
  "BG33_809",
  "BG33_894",
  "BG34_140",
  "BG34_175",
  "BG34_231",
  "BG34_523",
  "BG34_630",
  "BG34_634t",
  "BG34_635t",
  "BG34_636t",
  "BG34_637t",
  "BG34_638t",
  "BG34_682",
  "BG34_683",
  "BG34_684",
  "BG34_694",
  "BG34_731",
  "BG35_143",
  "BG35_340",
  "BG35_702",
  "BG35_801",
  "BG35_814",
  "BG35_881",
  "BG35_882",
  "BG35_433",
  "BG_DAL_775",
  "BG_BOT_911",
  "BG_DEEP_015",
  "BGS_004",
  "BGS_012",
  "BGS_018",
  "BGS_049",
  "BGS_115",
  "BGS_116",
  "BGS_123",
  "BGS_071",
  "BGS_119",
  "BGS_131",
  "BG_LOE_077",
  "BG_TTN_401",
]);

function createLiveDefinition(card: LiveRosterCard): MinionDefinition {
  if (
    !Number.isInteger(card.tier) ||
    card.tier < 1 ||
    card.tier > 6
  ) {
    throw new Error(`Invalid live Tavern Tier for ${card.id}: ${card.tier}`);
  }

  const tribes = card.races.map(mapSourceTribe);
  const associatedTribes = card.associatedRaces.map(mapSourceTribe);
  const description =
    LIVE_DESCRIPTION_OVERRIDES[card.id] ?? plainCardText(card.text);
  const cleave = description === CLEAVE_DESCRIPTION;
  const reusedFixture = REUSED_RULE_CARD_IDS.has(card.id)
    ? LEGACY_RULE_BY_CARD_ID.get(card.id)
    : undefined;
  const liveRuleOverride = LIVE_RULE_OVERRIDES[card.id];
  if (REUSED_RULE_CARD_IDS.has(card.id) && !reusedFixture) {
    throw new Error(`Missing legacy rules fixture for ${card.id}`);
  }

  const effectSupport = FULLY_SUPPORTED_LIVE_CARD_IDS.has(card.id)
    ? "complete"
    : "partial";

  return {
    ...reusedFixture,
    ...liveRuleOverride,
    id: card.id,
    cardId: card.id,
    name: card.name,
    tier: card.tier as MinionDefinition["tier"],
    tribe: tribes[0] ?? "neutral",
    tribes,
    associatedTribes,
    effectSupport,
    printedMechanics: [...card.mechanics],
    legendary: card.elite,
    attack: card.attack,
    health: card.health,
    description,
    magnetic:
      liveRuleOverride?.magnetic ??
      (hasMechanic(card, "MAGNETIC")
        ? { targetTribes: ["mech"] }
        : undefined),
    taunt: hasMechanic(card, "TAUNT"),
    divineShield: hasMechanic(card, "DIVINE_SHIELD"),
    reborn: hasMechanic(card, "REBORN"),
    poisonous: false,
    venomous: hasMechanic(card, "VENOMOUS"),
    windfury: hasMechanic(card, "WINDFURY"),
    cleave,
    collectible: true,
  };
}

const LIVE_ROSTER =
  liveRosterSnapshot as unknown as LiveRosterSnapshot;

export const LIVE_MINION_DEFINITIONS: readonly MinionDefinition[] =
  Object.freeze(LIVE_ROSTER.minions.map(createLiveDefinition));

export const MINION_DEFINITIONS: readonly MinionDefinition[] = Object.freeze([
  ...LEGACY_RULE_DEFINITIONS,
  ...TOKEN_DEFINITIONS,
  ...LIVE_TOKEN_DEFINITIONS,
  ...LIVE_MINION_DEFINITIONS,
]);

export const MINION_BY_ID: Readonly<Record<string, MinionDefinition>> =
  Object.freeze(
    Object.fromEntries(
      MINION_DEFINITIONS.map((definition) => [definition.id, definition]),
    ),
  );

export function getMinionDefinition(id: string): MinionDefinition {
  const definition = MINION_BY_ID[id];
  if (!definition) {
    throw new Error(`Unknown minion definition: ${id}`);
  }
  return definition;
}
