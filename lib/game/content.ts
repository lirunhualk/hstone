import liveRosterSnapshot from "./generated/battlegrounds-36.0.3-247416.zhCN.json" with {
  type: "json",
};
import type { MinionDefinition, Tribe } from "./types.ts";

export const CURRENT_ROSTER_VERSION = "battlegrounds-36.0.3-247416-v34";
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
    {
      id: "live-demon-fodder-token",
      cardId: "BG35_150t",
      goldenCardId: "BG35_150t_G",
      name: "恶魔饲料",
      tier: 1,
      tribe: "demon",
      tribes: ["demon"],
      associatedTribes: [],
      effectSupport: "complete",
      attack: 2,
      health: 2,
      description:
        "当本随从在酒馆中时，会将自身随机喂给一个友方恶魔，并填补空位。",
      goldenDescription:
        "当本随从在酒馆中时，会将自身随机喂给一个友方恶魔使其获得双倍属性值，并填补空位。",
      shopFodder: true,
      collectible: false,
    },
  ] satisfies readonly MinionDefinition[]);

const LEGACY_RULE_BY_CARD_ID = new Map(
  LEGACY_RULE_DEFINITIONS.map((definition) => [
    definition.cardId,
    definition,
  ]),
);

const BOUNTY_TAVERN_SPELL_DEFINITION_IDS = [
  "tavern-spell-friendly-bounty",
  "tavern-spell-healthy-bounty",
  "tavern-spell-hostile-bounty",
  "tavern-spell-selfish-bounty",
  "tavern-spell-wealthy-bounty",
] as const;

const LIVE_RULE_OVERRIDES: Readonly<
  Record<string, Partial<MinionDefinition>>
> = {
  BG21_015: {
    goldenCardId: "BG21_015_G",
    goldenDescription:
      "本随从可永久保留战斗阶段获得的额外关键词和双倍属性值。",
    combatEnchantmentRetention: {
      target: "self",
      goldenMode: "doubleStats",
    },
  },
  BG29_813: {
    goldenCardId: "BG29_813_G",
    goldenDescription:
      "圣盾。相邻的龙可永久保留战斗阶段获得的额外关键词和双倍属性值。",
    combatEnchantmentRetention: {
      target: "adjacentFriendlyTribe",
      tribe: "dragon",
      goldenMode: "doubleStats",
    },
  },
  BG32_822: {
    goldenCardId: "BG32_822_G",
    goldenDescription:
      "战斗开始时：使你的龙获得+4/+2。在你施放一个酒馆法术后永久提升此效果。",
    startOfCombat: [
      {
        kind: "growingTribeBuff",
        tribe: "dragon",
        attack: 2,
        health: 1,
        goldenMode: "doubleStats",
      },
    ],
    afterTavernSpellCast: [
      {
        kind: "improveStartOfCombatBuff",
        attack: 2,
        health: 1,
      },
    ],
  },
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
  BG26_ICC_901: {
    goldenCardId: "BG26_ICC_901_G",
    goldenDescription: "你的回合结束效果会触发三次。",
    extraEndOfTurnTriggers: 1,
  },
  BG31_178: {
    goldenCardId: "BG31_178_G",
    goldenDescription:
      "在你的回合结束时，随机获取2张酒馆法术牌。",
    endOfTurn: {
      kind: "gainRandomTavernSpell",
      count: 1,
      filter: {},
      goldenMode: "doubleCount",
    },
  },
  BG28_595: {
    goldenCardId: "BG28_595_G",
    goldenDescription:
      "在你的回合结束时，随机获取4张酒馆法术牌。",
    endOfTurn: {
      kind: "gainRandomTavernSpell",
      count: 2,
      filter: {},
      goldenMode: "doubleCount",
    },
  },
  BG33_820: {
    goldenCardId: "BG33_820_G",
    goldenDescription:
      "嘲讽。在你的回合结束时，随机获取2张悬赏令。",
    endOfTurn: {
      kind: "gainRandomTavernSpell",
      count: 1,
      filter: {
        definitionIds: BOUNTY_TAVERN_SPELL_DEFINITION_IDS,
      },
      goldenMode: "doubleCount",
    },
  },
  BG32_821: {
    goldenCardId: "BG32_821_G",
    goldenDescription:
      "在你的回合结束时，你的酒馆法术在本局对战中使随从额外获得+2/+2。",
    endOfTurn: {
      kind: "improveTavernSpellBuffs",
      attack: 1,
      health: 1,
    },
  },
  BG30_117: {
    goldenCardId: "BG30_117_G",
    goldenDescription:
      "塑造法术：\n抉择：使你的随从获得+8攻击力；或者+8生命值。",
    spellcraft: {
      definitionId: "spellcraft-escape-eruption",
    },
  },
  BG30_123: {
    goldenCardId: "BG30_123_G",
    goldenDescription:
      "抉择：在本局对战中，你的鲜血宝石使随从额外获得+2/+2；或者获取8张鲜血宝石。",
    onPlayChoice: {
      kind: "bloodGemImproveOrGain",
      attack: 1,
      health: 1,
      count: 4,
      goldenMode: "doubleValues",
    },
  },
  BG30_121: {
    goldenCardId: "BG30_121_G",
    goldenDescription:
      "从你手牌中使用的鲜血宝石会额外施放2次。",
    bloodGemFromHandAura: {
      extraCasts: 1,
      goldenMode: "doubleCount",
    },
  },
  BG28_583: {
    goldenCardId: "BG28_583_G",
    goldenDescription:
      "圣盾。每当一张鲜血宝石被用于本随从时，本随从对一个不同的友方随从使用2张鲜血宝石。",
    afterBloodGemCastOnSelf: {
      kind: "playBloodGemsOnRandomOther",
      count: 1,
      goldenMode: "doubleCount",
    },
  },
  BG33_319: {
    goldenCardId: "BG33_319_G",
    goldenDescription:
      "塑造法术：随机获取2张能使随从获得属性值的酒馆法术牌。",
    spellcraft: {
      definitionId: "spellcraft-rime-or-reason",
    },
  },
  BG32_835: {
    goldenCardId: "BG32_835_G",
    goldenDescription:
      "塑造法术：在本局对战中，你的酒馆法术使随从额外获得+2/+2。",
    spellcraft: {
      definitionId: "spellcraft-meditation",
    },
  },
  BG33_821: {
    goldenCardId: "BG33_821_G",
    goldenDescription:
      "战吼，亡语：随机获取2张悬赏令。",
    battlecry: [
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: {
          definitionIds: BOUNTY_TAVERN_SPELL_DEFINITION_IDS,
        },
        goldenMode: "doubleCount",
      },
    ],
    deathrattle: [
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: {
          definitionIds: BOUNTY_TAVERN_SPELL_DEFINITION_IDS,
        },
        goldenMode: "doubleCount",
      },
    ],
  },
  BG33_822: {
    goldenCardId: "BG33_822_G",
    goldenDescription:
      "进击：随机获取2张悬赏令。",
    rally: [
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: {
          definitionIds: BOUNTY_TAVERN_SPELL_DEFINITION_IDS,
        },
        goldenMode: "doubleCount",
      },
    ],
  },
  BG33_323: {
    goldenCardId: "BG33_323_G",
    goldenDescription:
      "进击：\n在本局对战中，你的亡灵拥有+4攻击力（无论它们在哪）。",
    rally: [
      {
        kind: "improveUndeadArmy",
        attack: 2,
        health: 0,
      },
    ],
  },
  BG34_604: {
    goldenCardId: "BG34_604_G",
    goldenDescription:
      "潜行。进击：获得目标的双倍攻击力。",
    rally: [{ kind: "gainTargetAttack" }],
  },
  BG34_925: {
    goldenCardId: "BG34_925_G",
    goldenDescription:
      "进击：对本随从右边的随从施放主厨甄选，触发两次。",
    rally: [
      {
        kind: "castChefsChoice",
        target: "rightFriendly",
        goldenMode: "repeat",
      },
    ],
  },
  BG33_318: {
    goldenCardId: "BG33_318_G",
    goldenDescription:
      "烈毒。进击：使2个其他友方鱼人获得烈毒。",
    rally: [
      {
        kind: "grantVenomous",
        target: "otherFriendlyTribe",
        tribe: "murloc",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG33_885: {
    goldenCardId: "BG33_885_G",
    goldenDescription:
      "进击：在本局对战中，你的鲜血宝石使随从额外获得+2/+4。",
    rally: [
      {
        kind: "improveBloodGems",
        attack: 1,
        health: 2,
      },
    ],
  },
  BG34_765: {
    goldenCardId: "BG34_765_G",
    goldenDescription:
      "进击：使4个其他友方随从获得本随从的攻击力，触发两次。",
    rally: [
      {
        kind: "grantSourceAttack",
        target: "otherFriendly",
        count: 4,
        goldenMode: "repeat",
      },
    ],
  },
  BG34_926: {
    goldenCardId: "BG34_926_G",
    goldenDescription:
      "战吼，亡语，进击：施放女王的命令，触发两次。",
    battlecry: [
      {
        kind: "castTavernSpell",
        definitionId: "tavern-spell-queens-command",
        goldenMode: "repeat",
      },
    ],
    deathrattle: [
      {
        kind: "castTavernSpell",
        definitionId: "tavern-spell-queens-command",
        goldenMode: "repeat",
      },
    ],
    rally: [
      {
        kind: "castTavernSpell",
        definitionId: "tavern-spell-queens-command",
        goldenMode: "repeat",
      },
    ],
  },
  BG29_816: {
    goldenCardId: "BG29_816_G",
    goldenDescription:
      "每当另一条友方的龙攻击时，使其获得+6/+2。",
    afterFriendlyAttacks: [
      {
        kind: "buffAttacker",
        tribe: "dragon",
        otherOnly: true,
        attack: 3,
        health: 1,
        goldenMode: "doubleStats",
      },
    ],
  },
  BGS_126: {
    goldenCardId: "TB_BaconUps_166",
    goldenDescription:
      "在本随从攻击并消灭一个随从后，对相邻的随从均造成超过目标生命值的伤害。",
    afterAttackKills: {
      kind: "excessDamageToAdjacent",
      goldenMode: "bothAdjacent",
    },
  },
  BGS_078: {
    goldenCardId: "TB_BaconUps_135",
    goldenDescription:
      "进击：触发你最左边的亡语（本随从的除外），触发两次。",
    rally: [
      {
        kind: "triggerLeftmostDeathrattle",
        goldenMode: "repeat",
      },
    ],
  },
  BG33_240: {
    goldenCardId: "BG33_240_G",
    goldenDescription:
      "进击：使2条友方的龙获得本随从的生命值上限，触发两次（魅惑之翼除外）。",
    rally: [
      {
        kind: "grantSourceMaxHealth",
        target: "otherFriendlyTribe",
        tribe: "dragon",
        count: 2,
        goldenMode: "repeat",
      },
    ],
  },
  BG34_921: {
    goldenCardId: "BG34_921_G",
    goldenDescription:
      "每当一个友方随从攻击时，施放闪亮的戒指，触发两次。",
    afterFriendlyAttacks: [
      {
        kind: "castTavernSpell",
        definitionId: "tavern-spell-shiny-ring",
        goldenMode: "repeat",
      },
    ],
  },
  BG34_632: {
    goldenCardId: "BG34_632_G",
    goldenDescription:
      "复仇（3）：随机获取2张多彩幼龙。",
    avenge: {
      threshold: 3,
      effects: [
        {
          kind: "gainRandomGeneratedMinion",
          definitionIds: [
            "BG34_634t",
            "BG34_635t",
            "BG34_636t",
            "BG34_637t",
            "BG34_638t",
          ],
          count: 1,
          goldenMode: "doubleCount",
        },
      ],
    },
  },
  BG24_707: {
    goldenCardId: "BG24_707_G",
    goldenDescription:
      "在一个友方嘲讽随从死亡后，获取2张鲜血宝石。",
    afterFriendlyDied: {
      taunt: true,
      effects: [{ kind: "gainBloodGems", count: 1 }],
    },
  },
  BG28_309: {
    goldenCardId: "BG28_309_G",
    goldenDescription:
      "亡语：使2个不同的友方亡灵获得复生。",
    deathrattle: [
      {
        kind: "grantKeyword",
        keyword: "reborn",
        target: "otherFriendlyTribe",
        tribe: "undead",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG29_862: {
    goldenCardId: "BG29_862_G",
    goldenDescription:
      "亡语：随机获取2张战吼随从牌。",
    deathrattle: [
      {
        kind: "getRandomMinion",
        count: 1,
        filter: { battlecry: true },
        maximumTier: "ownerTavern",
        source: "sharedPool",
        goldenMode: "doubleCount",
      },
    ],
  },
  BG26_162: {
    goldenCardId: "BG26_162_G",
    goldenDescription:
      "战吼，亡语：使酒馆中的元素在本局对战中获得+8/+8，触发两次。",
    battlecry: [
      {
        kind: "buffTavernType",
        tribe: "elemental",
        attack: 8,
        health: 8,
        goldenMode: "repeat",
      },
    ],
    deathrattle: [
      {
        kind: "buffTavernType",
        tribe: "elemental",
        attack: 8,
        health: 8,
        goldenMode: "repeat",
      },
    ],
  },
  BG34_633: {
    goldenCardId: "BG34_633_G",
    goldenDescription:
      "战吼，亡语：随机获取2张多彩幼龙。",
    battlecry: [
      {
        kind: "gainRandomGeneratedMinion",
        definitionIds: [
          "BG34_634t",
          "BG34_635t",
          "BG34_636t",
          "BG34_637t",
          "BG34_638t",
        ],
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
    deathrattle: [
      {
        kind: "gainRandomGeneratedMinion",
        definitionIds: [
          "BG34_634t",
          "BG34_635t",
          "BG34_636t",
          "BG34_637t",
          "BG34_638t",
        ],
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG35_437: {
    goldenCardId: "BG35_437_G",
    goldenDescription:
      "在一个友方亡语随从死亡后，你的鲜血宝石会在本局对战中使随从额外获得+4攻击力。",
    afterFriendlyDied: {
      deathrattle: true,
      effects: [
        {
          kind: "improveBloodGems",
          attack: 2,
          health: 0,
        },
      ],
    },
  },
  BG23_008: {
    goldenCardId: "BG23_008_G",
    goldenDescription:
      "嘲讽，塑造法术：直到下个回合，使一个随从获得圣盾。",
    spellcraft: {
      definitionId: "spellcraft-glowing-crown",
    },
  },
  BG34_858: {
    goldenCardId: "BG34_858_G",
    goldenDescription:
      "在你花掉7枚铸币后，施放两张乘借东风。（还剩7枚！）",
    afterGoldSpent: {
      threshold: 7,
      effects: [
        {
          kind: "castTavernSpell",
          definitionId: "tavern-spell-ride-the-wind",
        },
      ],
    },
  },
  BG34_865: {
    goldenCardId: "BG34_865_G",
    goldenDescription:
      "战吼：在本局对战中，在酒馆刷新后，使酒馆中一个随机随从获得+7/+7，触发两次。",
    battlecry: [
      {
        kind: "installTavernRefreshBuff",
        attack: 7,
        health: 7,
        goldenMode: "repeat",
      },
    ],
  },
  BGS_030: {
    goldenCardId: "TB_BaconUps_100",
    goldenDescription:
      "战吼：使你手牌中和场上的所有其他鱼人获得+8/+8。",
    battlecry: [
      {
        kind: "buffOwnedTribe",
        tribe: "murloc",
        attack: 4,
        health: 4,
      },
    ],
  },
  BGS_020: {
    goldenCardId: "TB_BaconUps_089",
    goldenDescription:
      "战吼：如果你控制着其他鱼人，发现2张鱼人牌。",
    interactiveBattlecry: {
      kind: "discoverMinion",
      tribe: "murloc",
      requiresOtherTribe: "murloc",
      goldenMode: "repeat",
    },
  },
  BG32_324: {
    goldenCardId: "BG32_324_G",
    goldenDescription:
      "复仇（3）：获取2张宰割。",
    avenge: {
      threshold: 3,
      effects: [
        {
          kind: "gainTavernSpell",
          definitionId: "tavern-spell-slaughter",
          count: 1,
          goldenMode: "doubleCount",
        },
      ],
    },
  },
  BG34_403: {
    goldenCardId: "BG34_403_G",
    goldenDescription:
      "复仇（5）：召唤一个金色永恒骑士并使其立即发起攻击。",
    avenge: {
      threshold: 5,
      effects: [
        {
          kind: "summon",
          definitionId: "BG25_008",
          count: 1,
          immediateAttack: true,
          goldenMode: "goldenToken",
        },
      ],
    },
  },
  BG24_500: {
    goldenCardId: "BG24_500_G",
    goldenDescription:
      "嘲讽。战斗开始时：使两条其他友方的龙获得+2/+2和圣盾。",
    startOfCombat: [
      {
        kind: "buffRandomOtherTribe",
        tribe: "dragon",
        attack: 2,
        health: 2,
        divineShield: true,
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG34_142: {
    goldenCardId: "BG34_142_G",
    goldenDescription:
      "圣盾。战斗开始时：获得你手牌中攻击力最高的随从牌的双倍攻击力。",
    startOfCombat: [
      {
        kind: "gainHighestHandAttack",
        goldenMode: "doubleAmount",
      },
    ],
  },
  BG26_354: {
    goldenCardId: "BG26_354_G",
    goldenDescription:
      "战斗开始时：获得你手牌中所有随从牌的双倍属性值。",
    startOfCombat: [
      {
        kind: "gainAllHandMinionStats",
        goldenMode: "doubleAmount",
      },
    ],
  },
  BG27_556: {
    goldenCardId: "BG27_556_G",
    goldenDescription:
      "战斗开始时：当你有空位时，召唤你手牌中攻击力最高的两个鱼人，其登场仅限本场战斗。",
    startOfCombat: [
      {
        kind: "summonHighestAttackHandTribeWhenSpace",
        tribe: "murloc",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG26_157: {
    goldenCardId: "BG26_157_G",
    goldenDescription:
      "复仇（2）：本随从对你的所有野猪人各使用4张鲜血宝石。",
    avenge: {
      threshold: 2,
      effects: [
        {
          kind: "applyBloodGemsToTribe",
          tribe: "quilboar",
          count: 2,
        },
      ],
    },
  },
  BG32_880: {
    goldenCardId: "BG32_880_G",
    goldenDescription:
      "亡语：在本局对战中，你酒馆法术使随从额外获得+2攻击力。",
    deathrattle: [
      {
        kind: "improveTavernSpellBuffs",
        attack: 1,
        health: 0,
      },
    ],
  },
  BG28_551: {
    goldenCardId: "BG28_551_G",
    goldenDescription:
      "每当你施放一个酒馆法术，使每个类型的各一个友方随从获得+8/+6。",
    afterTavernSpellCast: [
      {
        kind: "onePerTribe",
        attack: 4,
        health: 3,
      },
    ],
  },
  BG28_741: {
    goldenCardId: "BG28_741_G",
    goldenDescription:
      "圣盾。每当你施放一个酒馆法术时，使你具有圣盾的随从获得+8攻击力。",
    afterTavernSpellCast: [
      {
        kind: "buffKeyword",
        keyword: "divineShield",
        attack: 4,
        health: 0,
      },
    ],
  },
  BG34_692: {
    goldenCardId: "BG34_692_G",
    goldenDescription:
      "在你施放一个酒馆法术后，你的亡灵在本局对战中拥有+4攻击力（无论它们在哪）。",
    afterTavernSpellCast: [
      {
        kind: "improveUndeadArmy",
        attack: 2,
        health: 0,
      },
    ],
  },
  BG27_005: {
    goldenCardId: "BG27_005_G",
    goldenDescription:
      "每当你施放一个酒馆法术，使你的随从获得+1攻击力，触发两次。",
    afterTavernSpellCast: [
      {
        kind: "buff",
        target: "allFriendly",
        attack: 1,
        health: 0,
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
  BG31_801: {
    goldenCardId: "BG31_801_G",
    goldenDescription:
      "战吼：在本局对战中，你的甲虫拥有+4/+2。\n亡语：召唤两只2/2的甲虫。",
    battlecry: [
      {
        kind: "improveBeetles",
        attack: 2,
        health: 1,
      },
    ],
    deathrattle: [
      {
        kind: "summon",
        definitionId: "live-beetle-token",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG31_809: {
    goldenCardId: "BG31_809_G",
    goldenDescription:
      "亡语：在本局对战中，你的甲虫拥有+10/+10。召唤两只2/2的甲虫。",
    deathrattle: [
      {
        kind: "improveBeetles",
        attack: 5,
        health: 5,
      },
      {
        kind: "summon",
        definitionId: "live-beetle-token",
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG32_204: {
    goldenCardId: "BG32_204_G",
    goldenDescription:
      "每当本随从受到伤害，在本局对战中，你的甲虫拥有+4/+4。亡语：召唤两只2/2的甲虫。",
    afterSelfDamaged: [
      {
        kind: "improveBeetles",
        attack: 2,
        health: 2,
      },
    ],
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
  BG34_500: {
    goldenCardId: "BG34_500_G",
    goldenDescription:
      "在你的回合结束时，吞食酒馆中生命值最高的随从以获得其双倍属性值。",
    endOfTurn: {
      kind: "consumeHighestHealthShop",
      goldenMode: "doubleStats",
    },
  },
  BG35_151: {
    goldenCardId: "BG35_151_G",
    goldenDescription:
      "在你的回合结束时，在你的下3次刷新中各添加两个恶魔饲料。",
    endOfTurn: {
      kind: "queueDemonFodder",
      refreshes: 3,
      count: 1,
      goldenMode: "doubleCount",
    },
  },
  BG21_005: {
    goldenCardId: "BG21_005_G",
    goldenDescription:
      "在你的回合结束时，你的恶魔各吞食酒馆中的一个随从，获得其双倍属性值。",
    endOfTurn: {
      kind: "demonsConsumeShop",
      goldenMode: "doubleStats",
    },
  },
  BG26_199: {
    goldenCardId: "BG26_199_G",
    goldenDescription:
      "每2个回合，在回合结束时，获取本随从相邻随从的各一张原始版复制。（还剩2回合！）",
    endOfTurn: {
      kind: "copyLeftOriginal",
      everyTurns: 2,
      goldenMode: "adjacent",
    },
  },
  BG28_308: {
    goldenCardId: "BG28_308_G",
    goldenDescription:
      "在你的回合结束时，消灭相邻的亡灵并再次召唤完全相同的复制。",
    endOfTurn: {
      kind: "destroyAndResummonLeftUndead",
      goldenMode: "adjacentUndead",
    },
  },
  BG35_123: {
    goldenCardId: "BG35_123_G",
    goldenDescription:
      "在你的回合结束时，获取你施放的上一个酒馆法术的2张复制。",
    endOfTurn: {
      kind: "copyLastTavernSpell",
      count: 1,
      goldenMode: "doubleCount",
    },
  },
  BG35_142: {
    goldenCardId: "BG35_142_G",
    goldenDescription:
      "在你的回合结束时，获取莫格顿大妈和莫格顿老爹各一张。",
    endOfTurn: {
      kind: "gainRandomOrAllMinion",
      definitionIds: ["BG35_140", "BG35_141"],
      goldenMode: "all",
    },
  },
  BG35_334: {
    goldenCardId: "BG35_334_G",
    goldenDescription:
      "在你的回合结束时，使你的随从获得+2/+2。复仇（1）：永久提升此效果。",
    endOfTurn: {
      kind: "dynamicWarbandEndOfTurn",
      attack: 1,
      health: 1,
      avengeThreshold: 1,
      avengeAttack: 1,
      avengeHealth: 1,
    },
  },
  BG35_701: {
    goldenCardId: "BG35_701_G",
    goldenDescription:
      "在你的回合结束时，使你最左边的海盗获得+4/+6。在本回合中你每使用过一张牌，重复一次。（重复0次）",
    endOfTurn: {
      kind: "leftmostTribeRepeatPerCardPlayed",
      tribe: "pirate",
      attack: 2,
      health: 3,
    },
  },
  BG35_431: {
    goldenCardId: "BG35_431_G",
    goldenDescription:
      "风怒。在你的回合结束时，本随从对你的所有随从各使用2张鲜血宝石。本随从每拥有一个额外关键词，重复一次。",
    endOfTurn: {
      kind: "applyBloodGemToAllPerBonusKeyword",
      count: 1,
      goldenMode: "doubleCount",
    },
  },
  BG35_150: {
    goldenCardId: "BG35_150_G",
    goldenDescription:
      "战吼：在你的下3次刷新中各添加两个恶魔饲料。",
    battlecry: [
      {
        kind: "queueDemonFodder",
        refreshes: 3,
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG35_155: {
    goldenCardId: "BG35_155_G",
    goldenDescription:
      "在你出售一个随从后，在你的下一次刷新中添加两个恶魔饲料。",
    afterFriendlySold: [
      {
        kind: "queueDemonFodder",
        refreshes: 1,
        count: 1,
        goldenMode: "doubleCount",
      },
    ],
  },
  BG26_810: {
    goldenCardId: "BG26_810_G",
    goldenDescription:
      "每当你花掉6枚铸币，使你的海盗获得+2攻击力，触发两次。（还剩6枚！）",
    afterGoldSpent: {
      threshold: 6,
      effects: [
        {
          kind: "buff",
          target: "friendlyTribe",
          tribe: "pirate",
          attack: 2,
          health: 0,
        },
      ],
    },
  },
  BG31_824: {
    goldenCardId: "BG31_824_G",
    goldenDescription:
      "每当你花掉5枚铸币，使两个友方海盗获得+3/+4，触发两次。（还剩5枚！）",
    afterGoldSpent: {
      threshold: 5,
      effects: [
        {
          kind: "buff",
          target: "randomFriendlyTribe",
          tribe: "pirate",
          count: 2,
          includeSelf: true,
          attack: 3,
          health: 4,
        },
      ],
    },
  },
  BG23_018: {
    goldenCardId: "BG23_018_G",
    goldenDescription:
      "每当你花掉8枚铸币，本随从对你的所有野猪人各使用四张鲜血宝石。（还剩8枚！）",
    afterGoldSpent: {
      threshold: 8,
      effects: [
        {
          kind: "applyBloodGemsToTribe",
          tribe: "quilboar",
          count: 2,
        },
      ],
    },
  },
  BG33_823: {
    goldenCardId: "BG33_823_G",
    goldenDescription:
      "在你花掉9枚铸币后，随机获取两张悬赏令。（还剩9枚！）",
    afterGoldSpent: {
      threshold: 9,
      effects: [
        {
          kind: "gainRandomTavernSpell",
          count: 1,
          filter: {
            definitionIds: BOUNTY_TAVERN_SPELL_DEFINITION_IDS,
          },
          goldenMode: "doubleCount",
        },
      ],
    },
  },
  BG26_814: {
    goldenCardId: "BG26_814_G",
    goldenDescription:
      "战吼：使一个海盗获得+1生命值，触发两次。（在本回合中你每花费一枚铸币都会提升！）",
    interactiveBattlecry: {
      kind: "targetedBuff",
      target: "friendlyTribe",
      targetTribe: "pirate",
      attack: 0,
      health: 1,
      attackPerTavernSpell: 0,
      healthPerTavernSpell: 0,
      healthPerGoldSpentThisTurn: 1,
      goldenMode: "repeat",
    },
  },
  BG29_840: {
    goldenCardId: "BG29_840_G",
    goldenDescription:
      "在你使用奇数等级的牌后，使你的奇数等级的随从获得+2/+2。",
    afterCardPlayed: {
      filter: { tierParity: "odd" },
      effects: [
        {
          kind: "buff",
          target: "allFriendly",
          tierParity: "odd",
          attack: 1,
          health: 1,
        },
      ],
    },
  },
  BG29_841: {
    goldenCardId: "BG29_841_G",
    goldenDescription:
      "在你使用偶数等级的牌后，使你的偶数等级的随从获得+4/+4。",
    afterCardPlayed: {
      filter: { tierParity: "even" },
      effects: [
        {
          kind: "buff",
          target: "allFriendly",
          tierParity: "even",
          attack: 2,
          health: 2,
        },
      ],
    },
  },
  BG33_893: {
    goldenCardId: "BG33_893_G",
    goldenDescription:
      "在你使用一张等级3或以下的牌后，使你的鱼人获得+4/+4。",
    afterCardPlayed: {
      filter: { maximumTier: 3 },
      effects: [
        {
          kind: "buff",
          target: "friendlyTribe",
          tribe: "murloc",
          attack: 2,
          health: 2,
        },
      ],
    },
  },
  BG26_137: {
    goldenCardId: "BG26_137_G",
    goldenDescription:
      "当本牌在你手牌中时，在你使用一张鱼人牌后，获得+12/+12。",
    inHandAfterCardPlayed: {
      filter: { tribe: "murloc" },
      effects: [
        {
          kind: "buff",
          target: "self",
          attack: 6,
          health: 6,
        },
      ],
    },
  },
  BG30_122: {
    goldenCardId: "BG30_122_G",
    goldenDescription:
      "在你使用一张鱼人牌后，使一个友方随从和你手牌中的一张随从牌获得+10/+10。",
    afterCardPlayed: {
      filter: { tribe: "murloc" },
      effects: [
        {
          kind: "buff",
          target: "randomFriendly",
          includeSelf: true,
          attack: 5,
          health: 5,
        },
        {
          kind: "buffRandomHandMinion",
          attack: 5,
          health: 5,
        },
      ],
    },
  },
  BG32_846: {
    goldenCardId: "BG32_846_G",
    goldenDescription:
      "在你使用一张元素牌后，使你的元素获得+4/+4，触发两次。",
    afterCardPlayed: {
      filter: { tribe: "elemental" },
      effects: [
        {
          kind: "buff",
          target: "friendlyTribe",
          tribe: "elemental",
          attack: 4,
          health: 4,
        },
      ],
    },
  },
  BGS_104: {
    goldenCardId: "TB_BaconUps_201",
    goldenDescription:
      "在你使用一张元素牌后，使酒馆中的元素在本局对战中获得+8/+8。",
    afterCardPlayed: {
      filter: { tribe: "elemental" },
      effects: [
        {
          kind: "buffTavernType",
          tribe: "elemental",
          attack: 4,
          health: 4,
        },
      ],
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
  "BG24_500",
  "BG22_202",
  "BG21_014",
  "BG21_005",
  "BG21_015",
  "BG23_002",
  "BG23_004",
  "BG23_008",
  "BG23_018",
  "BG24_707",
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
  "BG26_137",
  "BG26_147",
  "BG26_148",
  "BG26_157",
  "BG26_159",
  "BG26_160",
  "BG26_162",
  "BG26_199",
  "BG26_354",
  "BG26_360",
  "BG26_501",
  "BG26_502",
  "BG26_529",
  "BG26_ICC_901",
  "BG26_805",
  "BG26_810",
  "BG26_814",
  "BG26_817",
  "BG27_004",
  "BG27_005",
  "BG27_556",
  "BG28_551",
  "BG28_583",
  "BG28_595",
  "BG28_741",
  "BG28_300",
  "BG28_308",
  "BG28_309",
  "BG29_503",
  "BG29_611",
  "BG29_816",
  "BG29_813",
  "BG29_840",
  "BG29_841",
  "BG29_862",
  "BG29_300",
  "BG30_117",
  "BG30_121",
  "BG30_122",
  "BG30_123",
  "BG30_125",
  "BG31_175",
  "BG31_178",
  "BG31_330",
  "BG31_801",
  "BG31_803",
  "BG31_809",
  "BG31_815",
  "BG31_816",
  "BG31_818",
  "BG31_824",
  "BG31_859",
  "BG32_235",
  "BG32_236",
  "BG32_324",
  "BG32_330",
  "BG32_821",
  "BG32_822",
  "BG32_835",
  "BG32_846",
  "BG32_880",
  "BG32_170",
  "BG32_172",
  "BG32_204",
  "BG32_111",
  "BG32_891",
  "BG33_156",
  "BG33_140",
  "BG33_241",
  "BG33_240",
  "BG33_318",
  "BG33_323",
  "BG33_319",
  "BG33_888",
  "BG33_809",
  "BG33_820",
  "BG33_821",
  "BG33_822",
  "BG33_823",
  "BG33_893",
  "BG33_894",
  "BG33_885",
  "BG34_140",
  "BG34_142",
  "BG34_175",
  "BG34_231",
  "BG34_403",
  "BG34_500",
  "BG34_523",
  "BG34_604",
  "BG34_630",
  "BG34_632",
  "BG34_633",
  "BG34_634t",
  "BG34_635t",
  "BG34_636t",
  "BG34_637t",
  "BG34_638t",
  "BG34_682",
  "BG34_683",
  "BG34_684",
  "BG34_692",
  "BG34_694",
  "BG34_731",
  "BG34_765",
  "BG34_858",
  "BG34_865",
  "BG34_921",
  "BG34_925",
  "BG34_926",
  "BG35_143",
  "BG35_123",
  "BG35_142",
  "BG35_150",
  "BG35_151",
  "BG35_155",
  "BG35_334",
  "BG35_340",
  "BG35_431",
  "BG35_437",
  "BG35_701",
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
  "BGS_020",
  "BGS_030",
  "BGS_049",
  "BGS_104",
  "BGS_115",
  "BGS_116",
  "BGS_123",
  "BGS_126",
  "BGS_071",
  "BGS_119",
  "BGS_131",
  "BGS_078",
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
    stealth: hasMechanic(card, "STEALTH"),
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
