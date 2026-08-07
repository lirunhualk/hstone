// Hero and Hero Power registry for local Battlegrounds lobby.
// Total: 120 heroes, 120 hero powers
// Based on HearthstoneJSON build 247416 (patch 36.0.3)

import type {
  HeroDefinition,
  HeroPowerDefinition,
  HeroPowerEffect,
  Tribe,
} from "./types.ts";

export const HERO_OFFER_SIZE = 4;

/**
 * Registry entries retained for card-data completeness but not exposed to a
 * live lobby until their complete engine path is implemented.
 */
export const UNSUPPORTED_HERO_POWER_EFFECTS = new Set<HeroPowerEffect>([
  "unknown",
  "swapTwoMinionsAttack",
  "chooseHeroPowerEachTurn",
  "chooseFlightPath",
  "sellDevourStats",
  "cookMinionsForDiscover",
  "removeTavernShootEnemy",
  "chooseElementInvoke",
  "nagaExpedition",
  "deadMinionsForMech",
  "refreshCopyHighestFreeze",
  "revengeSummonScalingWhelp",
  "combatSummonTentacleScaling",
  "combatLowestAttackDeathrattle",
  "skipTurnForDiscovers",
  "holmesGuessMinion",
  "chooseQuestAtStart",
  "discoverTier7ForGoldSpent",
  "oncePerGameExactCopy",
  "timeWarpAtTurn8",
  "timeWarpAtTurn5",
  "triggerBattlecry",
  "giveMinionReborn",
  "dealDamageForPortal",
  "skipTwoTurnsForDiscovers",
  "oncePerGameGolden",
  "startDiscoverHeroPower",
  "removeDiscoverLowerTier",
  "deadHeroDiscoverMinion",
  "activeLockCardUnlockLater",
  "activeBetOnWinner",
  "swapNonGoldenWithTavern",
  "collectDarkmoonTickets",
  "periodicDarkmoonPrizes",
  "startChooseProtossMinion",
  "combatKillAndResummon",
  "activeUnlockZergTier",
  "activeStealFirstKillNextCombat",
  "activeRandomBuffChooseUpgrade",
  "activeRefreshHigherTier",
  "activeReplaceHigherTier",
  "activeStealTavernCardDamage",
  "activeBuildCustomUndead",
  "alternatingStatBuff",
  "copyLeftmostHandCard",
  "startWithVehicleSummon",
  "startWithBattlecruiser",
  "startWithDeathrattleFish",
  "turnStartRandomSpell",
  "goldPerTurnOnce",
  "activeScalingTargetBuff",
  "totalCardsForSulfuras",
  "activeDiscoverBuddy",
  "activeKillUndeadForUndead",
  "activeFindMissingTriple",
  "activeDiscoverRotatingTribe",
  "activeDiscoverDeadMinionCopy",
  "activeDiscoverFromNextOpponent",
  "activeRefreshOpponentMinions",
  "combatSummonHighestAttackDelayed",
  "combatSummonHighestHealthDelayed",
  "activeGetPirateCostReduces",
  "activeEndOfTurnScalingBuff",
  "increaseGoldCap",
  "activeStealAllTavernCards",
  "activeDoubleHealthTavernMinion",
  "easyTripleCoin",
  "combatBuffFlanks",
  "combatBuffPerTribe",
  "afterThreePurchasesGetCopy",
  "battlecryPurchasesForBrann",
  "activeRandomTavernSpell",
  "activeRollDiceForGold",
  "activeShrinkMinionToHand",
  "buyTierTripleReward",
  "hatPassesOnSell",
  "refreshRandomKeyword",
  "sellMinionsForRandomMurloc",
  "activeDigForGolden",
  "activeCopyLastTavernSpell",
  "nextTavernSpellDiscountDelayed",
  "chooseTrinketAtTurn5",
  "chooseGreaterTrinketAtTurn8",
  "activeGiveDivineShield",
  "chooseSecret",
  "discoverHeroPowerAtTurn4",
]);

const IDENTITY_INELIGIBLE_HERO_POWER_EFFECTS = new Set<HeroPowerEffect>([
  "bonusStartingHealth",
  "startWithAmalgam",
  "growingTavernBuff",
  "chooseTrinketAtTurn5",
  "chooseGreaterTrinketAtTurn8",
  "discoverHeroPowerAtTurn4",
]);

export const HERO_POWER_COUNTER_KEYS = {
  smartSavingsGold: "smartSavingsGold",
  chenvaalaElementals: "chenvaalaElementals",
  kaelthasMinions: "kaelthasMinions",
  taethelanSpells: "taethelanSpells",
  rakanishuTurns: "rakanishuTurns",
  rakanishuBonus: "rakanishuBonus",
  saurfangBuys: "saurfangBuys",
  saurfangBuff: "saurfangBuff",
  guffTiers: "guffTiers",
  kurtrusBuys: "kurtrusBuys",
  kurtrusUsed: "kurtrusUsed",
  sneedVehicle: "sneedVehicle",
  nagaAttack: "nagaAttack",
  nagaActive: "nagaActive",
  iniDeaths: "iniDeaths",
  onyxiaRevenge: "onyxiaRevenge",
  ozumatTentacle: "ozumatTentacle",
  holmesRound: "holmesRound",
  arannaAttacks: "arannaAttacks",
  flurglSells: "flurglSells",
  darkmoonTickets: "darkmoonTickets",
  jaraxxusDamage: "jaraxxusDamage",
  sulfurasCards: "sulfurasCards",
  ragnarosActive: "ragnarosActive",
  cthunBuff: "cthunBuff",
  edwinBuys: "edwinBuys",
  edwinBuff: "edwinBuff",
  eliseUses: "eliseUses",
  eudoraDigs: "eudoraDigs",
  tickatusRound: "tickatusRound",
  vooneRound: "vooneRound",
  vooneActive: "vooneActive",
  thorimGold: "thorimGold",
  artanisBuys: "artanisBuys",
  marinRound: "marinRound",
  buttonRound: "buttonRound",
  murozondRound: "murozondRound",
  mirokRound: "mirokRound",
  gennRound: "gennRound",
  luoAttacks: "luoAttacks",
  luoGranted: "luoGranted",
  arannaFreeBuyUsed: "arannaFreeBuyUsed",
  thorimUnlockRound: "thorimUnlockRound",
  artanisUnlockRound: "artanisUnlockRound",
  kerriganTier: "kerriganTier",
  carielLevel: "carielLevel",
  carielChoice: "carielChoice",
  scabbsUsed: "scabbsUsed",
  sylvanasUsed: "sylvanasUsed",
  nobundoRound: "nobundoRound",
  snakeEyesCooldown: "snakeEyesCooldown",
  patchesDiscount: "patchesDiscount",
  togwaggleDiscount: "togwaggleDiscount",
  kraggUsed: "kraggUsed",
  kraggBonus: "kraggBonus",
  putricideWorks: "putricideWorks",
  zephrysWishes: "zephrysWishes",
  cookPot: "cookPot",
  cookCount: "cookCount",
  vardenUsed: "vardenUsed",
  maievSlots: "maievSlots",
  derylHats: "derylHats",
  muklaBananas: "muklaBananas",
  akazamzarakSecrets: "akazamzarakSecrets",
  brannBuys: "brannBuys",
  blackthornPlays: "blackthornPlays",
  ingeToggle: "ingeToggle",
  renoUsed: "renoUsed",
  zerekUsed: "zerekUsed",
} as const;

export const HERO_POWER_DEFINITIONS = [
  {
    id: "hero-power-bg20_hero_100p",
    cardId: "BG20_HERO_100p",
    name: "战斗的荣耀",
    description: "在友方随从消灭敌人后，使其永久获得+1攻击力。",
    effect: "permanentAttackOnKill",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_101p",
    cardId: "BG20_HERO_101p",
    name: "亲见圣光",
    description: "选择酒馆中的一个随从，将其属性值变为2并置入你的手牌。",
    effect: "activeShrinkMinionToHand",
    activation: "active"
  },
  {
    id: "hero-power-bg20_hero_102p",
    cardId: "BG20_HERO_102p",
    name: "为了部落！",
    description: "酒馆中的随从拥有+1/+1。在你购买4个随从后提升此效果。（还剩4个！）",
    effect: "growingTavernBuff",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_103p",
    cardId: "BG20_HERO_103p",
    name: "血脉连接",
    description: "获取2张鲜血宝石。（每回合两次。）",
    effect: "getBloodGemsPerTurn",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_201p",
    cardId: "BG20_HERO_201p",
    name: "灵魂互换",
    description: "选择2个随从。直到下个回合，它们会获得对方的攻击力。",
    effect: "swapTwoMinionsAttack",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_202p",
    cardId: "BG20_HERO_202p",
    name: "风暴之力",
    description: "在每个回合开始时，从2个新英雄技能中选择一个。",
    effect: "chooseHeroPowerEachTurn",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_242p",
    cardId: "BG20_HERO_242p",
    name: "自然的平衡",
    description: "在你购买总计20级的卡牌后，获取一份三连奖励。（还剩20级！）",
    effect: "buyTierTripleReward",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_280p5",
    cardId: "BG20_HERO_280p5",
    name: "战刃飞旋",
    description: "每回合一次：在你购买3个随从后，获取所购买的一个随从的一张原始版复制。（还剩3个！）3每回合一次：在你购买3个随从后，获取所购买的一个随从的一张原始版复制。（已获取！）",
    effect: "afterThreePurchasesGetCopy",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_282p",
    cardId: "BG20_HERO_282p",
    name: "香氛护命匣",
    description: "战斗开始时：使你攻击力最低的随从获得“亡语：使你的其他随从获得本随从的属性值。”",
    effect: "combatLowestAttackDeathrattle",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_283p",
    cardId: "BG20_HERO_283p",
    name: "杜加尔的狮鹫",
    description: "选择一条新航线，完成飞行时获得特效！",
    effect: "chooseFlightPath",
    activation: "passive"
  },
  {
    id: "hero-power-bg20_hero_301p",
    cardId: "BG20_HERO_301p",
    name: "吞噬",
    description: "出售一个友方随从，将它的属性值吐到另一个友方随从身上。",
    effect: "sellDevourStats",
    activation: "passive"
  },
  {
    id: "hero-power-bg21_hero_000p",
    cardId: "BG21_HERO_000p",
    name: "定罪",
    description: "随机使1个友方随从获得+1/+1。被动：在每场战斗后，选择一项提升。1随机使1个友方随从获得+1/+1。被动：在每场战斗后，选择一项提升。",
    effect: "activeRandomBuffChooseUpgrade",
    activation: "active"
  },
  {
    id: "hero-power-bg21_hero_010p",
    cardId: "BG21_HERO_010p",
    name: "间谍探查",
    description: "从你下一个对手的战队中发现一个随从的原始版复制。",
    effect: "activeDiscoverFromNextOpponent",
    activation: "active"
  },
  {
    id: "hero-power-bg21_hero_020p",
    cardId: "BG21_HERO_020p",
    name: "搅动汤锅",
    description: "将一个随从投入你的锅中。当你集齐3个随从时，从它们的类型中发现一个随从。（还剩3个！）",
    effect: "cookMinionsForDiscover",
    activation: "passive"
  },
  {
    id: "hero-power-bg21_hero_030p",
    cardId: "BG21_HERO_030p",
    name: "驾驶伐木机",
    description: "开局时拥有一台2/1的伐木机。伐木机可以召唤你手牌中生命值最高的随从并使其获得圣盾。",
    effect: "startWithVehicleSummon",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_000p_alt",
    cardId: "BG22_HERO_000p_Alt",
    name: "子弹上膛",
    description: "移除一个酒馆中的随从。下场战斗中，当你有空位时，随机对一个敌方随从发射该随从。",
    effect: "removeTavernShootEnemy",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_001p",
    cardId: "BG22_HERO_001p",
    name: "拥抱元素",
    description: "选择一个元素。战斗开始时：唤起选择的元素。",
    effect: "chooseElementInvoke",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_002p",
    cardId: "BG22_HERO_002p",
    name: "霜狼热血",
    description: "当你在战斗中有空位时，召唤你攻击力最高的随从的一个复制。（第7回合解锁。）",
    effect: "combatSummonHighestAttackDelayed",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_003p",
    cardId: "BG22_HERO_003p",
    name: "雷矛之力",
    description: "当你在战斗中有空位时，召唤你生命值最高的随从的一个复制。（第7回合解锁。）",
    effect: "combatSummonHighestHealthDelayed",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_004p",
    cardId: "BG22_HERO_004p",
    name: "好事成霜",
    description: "在酒馆刷新后，复制酒馆中等级最高的随从并冻结这两个随从。",
    effect: "refreshCopyHighestFreeze",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_007p",
    cardId: "BG22_HERO_007p",
    name: "艾萨拉的野心",
    description: "当你的战队总计达到30点攻击力时，开启纳迦远征。0当你的战队总计达到30点攻击力时，开启纳迦远征。（还剩0点！）",
    effect: "nagaExpedition",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_007p2",
    cardId: "BG22_HERO_007p2",
    name: "纳迦远征",
    description: "发现一张纳迦牌。",
    effect: "unknown",
    activation: "active"
  },
  {
    id: "hero-power-bg22_hero_200p",
    cardId: "BG22_HERO_200p",
    name: "敲打机械",
    description: "在9个友方随从死亡后，随机获取一张机械牌。9在9个友方随从死亡后，随机获取一张机械牌。（还剩9个！）",
    effect: "deadMinionsForMech",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_201p",
    cardId: "BG22_HERO_201p",
    name: "远行计划",
    description: "跳过你的第一个回合。发现等级6，4和2的随从各一个，当你达到对应等级时才可使用。",
    effect: "skipTurnForDiscovers",
    activation: "passive"
  },
  {
    id: "hero-power-bg22_hero_305p",
    cardId: "BG22_HERO_305p",
    name: "巢母",
    description: "复仇（4）：召唤一条1/1的雏龙，并使其立即发起攻击。此效果提升+1/+1。",
    effect: "revengeSummonScalingWhelp",
    activation: "passive"
  },
  {
    id: "hero-power-bg23_hero_201p",
    cardId: "BG23_HERO_201p",
    name: "触须",
    description: "在战斗中，当你有空位时，召唤一条2/2并具有嘲讽的触须。（在你出售一个随从后获得+1/+1！）",
    effect: "combatSummonTentacleScaling",
    activation: "passive"
  },
  {
    id: "hero-power-bg23_hero_303p2",
    cardId: "BG23_HERO_303p2",
    name: "特邀侦探",
    description: "检视2个随从。猜中来自你下一个对手上一场战斗的随从，即可获取一张酒馆币。",
    effect: "holmesGuessMinion",
    activation: "passive"
  },
  {
    id: "hero-power-bg23_hero_304p",
    cardId: "BG23_HERO_304p",
    name: "深海遗物",
    description: "在每个回合开始时，随机获取一张塑造法术的法术牌。",
    effect: "spellcraftPerTurn",
    activation: "passive"
  },
  {
    id: "hero-power-bg23_hero_305p",
    cardId: "BG23_HERO_305p",
    name: "完美犯罪",
    description: "偷取酒馆中的所有牌。每个回合，你的下一个英雄技能消耗的铸币减少（1）枚。",
    effect: "activeStealAllTavernCards",
    activation: "active"
  },
  {
    id: "hero-power-bg23_hero_306p",
    cardId: "BG23_HERO_306p",
    name: "重拾灵魂",
    description: "发现一个在上一场战斗中死亡的随从的原始版复制。（第3回合解锁。）",
    effect: "activeDiscoverDeadMinionCopy",
    activation: "active"
  },
  {
    id: "hero-power-bg24_hero_100p",
    cardId: "BG24_HERO_100p",
    name: "悬案疑云",
    description: "对战开始时，从两个任务中选择 一个。",
    effect: "chooseQuestAtStart",
    activation: "passive"
  },
  {
    id: "hero-power-bg24_hero_204p",
    cardId: "BG24_HERO_204p",
    name: "强化",
    description: "在酒馆刷新后，随机使其中的一个随从获得一项随机额外关键词。",
    effect: "refreshRandomKeyword",
    activation: "passive"
  },
  {
    id: "hero-power-bg25_hero_100p",
    cardId: "BG25_HERO_100p",
    name: "构造亡灵",
    description: "制造一个自定义的亡灵。（还剩3件作品！）",
    effect: "activeBuildCustomUndead",
    activation: "active"
  },
  {
    id: "hero-power-bg25_hero_103p",
    cardId: "BG25_HERO_103p",
    name: "飞速复活",
    description: "选择一个友方随从。战斗开始时：将其消灭。当你有空位时，重新召唤一个完全相同的复制。",
    effect: "combatKillAndResummon",
    activation: "passive"
  },
  {
    id: "hero-power-bg25_hero_105p",
    cardId: "BG25_HERO_105p",
    name: "签约新人",
    description: "发现一个伙伴。（等级2时解锁。）",
    effect: "activeDiscoverBuddy",
    activation: "active"
  },
  {
    id: "hero-power-yo-ho-ogre",
    cardId: "BG26_HERO_101p",
    name: "我当船长啦",
    description: "在你购买一个海盗后，获得1枚铸币。",
    effect: "piratePurchaseRefund",
    activation: "passive"
  },
  {
    id: "hero-power-bg26_hero_102p",
    cardId: "BG26_HERO_102p",
    name: "大调颂歌",
    description: "使一个随从获得等同于你当前等级的攻击力。（下回合切换为 生命值！）",
    effect: "alternatingStatBuff",
    activation: "passive"
  },
  {
    id: "hero-power-bg26_hero_104p",
    cardId: "BG26_HERO_104p",
    name: "蓄势和声",
    description: "每3个回合，在回合结束时获取你最左边的手牌的一张原始版复制。（还剩3回合！）3每3个回合，在回合结束时获取你最左边的手牌的一张原始版复制。（就是这回合！）",
    effect: "copyLeftmostHandCard",
    activation: "passive"
  },
  {
    id: "hero-power-bg27_hero_801p2",
    cardId: "BG27_HERO_801p2",
    name: "挑选勇士",
    description: "被动 对战开始时，发现一个等级7的随从，在你花掉60枚铸币后才可使用。（还剩60枚！）",
    effect: "discoverTier7ForGoldSpent",
    activation: "passive"
  },
  {
    id: "hero-power-bg28_hero_400p",
    cardId: "BG28_HERO_400p",
    name: "好运当投",
    description: "投一枚6面骰，获得等量的铸币。（在相应数量的回合内无法再次使用！）",
    effect: "activeRollDiceForGold",
    activation: "active"
  },
  {
    id: "hero-power-reliquary-research",
    cardId: "BG28_HERO_800p",
    name: "神圣遗物学会研究",
    description: "你每购买四张酒馆法术牌，第四张消耗的铸币为（0）枚。",
    effect: "freeFourthTavernSpell",
    activation: "passive"
  },
  {
    id: "hero-power-bg28_hero_801p",
    cardId: "BG28_HERO_801p",
    name: "九蛙赐福",
    description: "随机获取一张酒馆法术牌。",
    effect: "activeRandomTavernSpell",
    activation: "active"
  },
  {
    id: "hero-power-bg30_hero_304p",
    cardId: "BG30_HERO_304p",
    name: "神奇宝藏",
    description: "在第5回合，选择一项小型饰品并购买。（还剩4回合！）4在第5回合，选择一项小型饰品并购买。（已完成！）",
    effect: "chooseTrinketAtTurn5",
    activation: "passive"
  },
  {
    id: "hero-power-bg31_hero_003p",
    cardId: "BG31_HERO_003p",
    name: "星系投影",
    description: "获取你施放的上一个酒馆法术的一张复制。每个回合，你的下一个英雄技能消耗的铸币减少（1）枚。",
    effect: "activeCopyLastTavernSpell",
    activation: "active"
  },
  {
    id: "hero-power-bg31_hero_005p",
    cardId: "BG31_HERO_005p",
    name: "克隆展览",
    description: "每局对战限一次。召唤一个友方随从的一个完全相同的 复制。0每局对战限一次。召唤一个友方随从的一个完全相同的复制。（时空扭曲随从除外。）",
    effect: "oncePerGameExactCopy",
    activation: "passive"
  },
  {
    id: "hero-power-bg31_hero_006p",
    cardId: "BG31_HERO_006p",
    name: "奥术知识",
    description: "你购买的下一张酒馆法术牌消耗的铸币减少（1）枚。（第3回合解锁。）",
    effect: "nextTavernSpellDiscountDelayed",
    activation: "passive"
  },
  {
    id: "hero-power-bg31_hero_801p",
    cardId: "BG31_HERO_801p",
    name: "升空",
    description: "开局时拥有一艘2/2的战列巡航舰。每当酒馆刷新时，在其中添加一项战列巡航舰升级。",
    effect: "startWithBattlecruiser",
    activation: "passive"
  },
  {
    id: "hero-power-bg31_hero_802p",
    cardId: "BG31_HERO_802p",
    name: "折跃门",
    description: "对战开始时，从2个星灵随从中选择一个，在你购买14张牌后才可使用。（还剩14张！）14对战开始时，从2个星灵随从中选择一个，在你购买14张牌后才可使用。（已完成！）",
    effect: "startChooseProtossMinion",
    activation: "passive"
  },
  {
    id: "hero-power-bg31_hero_811p",
    cardId: "BG31_HERO_811p",
    name: "孵化池",
    description: "解锁等级2的异虫。每个回合，消耗的铸币都会减少（1）枚。被动：开局时拥有一个2/2的幼虫。",
    effect: "activeUnlockZergTier",
    activation: "active"
  },
  {
    id: "hero-power-bg32_hero_001p",
    cardId: "BG32_HERO_001p",
    name: "古树的智慧",
    description: "你的铸币上限提高1枚。",
    effect: "increaseGoldCap",
    activation: "active"
  },
  {
    id: "hero-power-bg32_hero_002p",
    cardId: "BG32_HERO_002p",
    name: "藏品增生",
    description: "在第8回合，选择一项大型饰品并购买。（还剩7回合！）7在第8回合，选择一项大型饰品并购买。（已完成！）",
    effect: "chooseGreaterTrinketAtTurn8",
    activation: "passive"
  },
  {
    id: "hero-power-bg33_hero_001p_alt",
    cardId: "BG33_HERO_001p_ALT",
    name: "英勇鼓舞",
    description: "在15个友方随从攻击后，获取一份三连奖励。 （还剩15个！）",
    effect: "attacksForTriple",
    activation: "passive"
  },
  {
    id: "hero-power-bg34_hero_000p",
    cardId: "BG34_HERO_000p",
    name: "平行时间线",
    description: "在第8回合，前往大型时空扭曲。（还剩7回合！）7在第8回合，前往大型时空扭曲。（已结束！）",
    effect: "timeWarpAtTurn8",
    activation: "passive"
  },
  {
    id: "hero-power-bg34_hero_001p",
    cardId: "BG34_HERO_001p",
    name: "法力时刻",
    description: "刷新酒馆，使其中变为酒馆法术牌。",
    effect: "refreshToTavernSpells",
    activation: "passive"
  },
  {
    id: "hero-power-bg34_hero_002p",
    cardId: "BG34_HERO_002p",
    name: "双倍速",
    description: "你只需2个复制即可将随从变为金色。使用金色随从不会获取三连奖励，改为获取酒馆币。",
    effect: "easyTripleCoin",
    activation: "passive"
  },
  {
    id: "hero-power-bg34_hero_004p",
    cardId: "BG34_HERO_004p",
    name: "扭曲的时光流汇",
    description: "在第5回合，前往小型时空扭曲。（还剩4回合！）4在第5回合，前往小型时空扭曲。（已结束！）",
    effect: "timeWarpAtTurn5",
    activation: "passive"
  },
  {
    id: "hero-power-bg35_hero_001p",
    cardId: "BG35_HERO_001p",
    name: "双面之王",
    description: "在第4回合，发现两项英雄技能以替换本技能。（还剩3回合！）3在第4回合，发现两项英雄技能以替换本技能。（已完成！）",
    effect: "discoverHeroPowerAtTurn4",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_001",
    cardId: "TB_BaconShop_HP_001",
    name: "打磨利刃",
    description: "使一个随从获得+2/+2。在你购买5张牌后提升。（还剩5张！）",
    effect: "activeScalingTargetBuff",
    activation: "active"
  },
  {
    id: "hero-power-smart-savings",
    cardId: "TB_BaconShop_HP_008",
    name: "理财之道",
    description: "在你出售一个随从后，下回合获得1枚铸币。0在你出售一个随从后，下回合获得1枚铸币。（已储存0枚）",
    effect: "goldAfterSellNextTurn",
    activation: "passive"
  },
  {
    id: "hero-power-experienced-bartender",
    cardId: "TB_BaconShop_HP_009",
    name: "资深调酒师",
    description: "升级酒馆所需的铸币减少（1）枚。",
    effect: "upgradeDiscount",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_010",
    cardId: "TB_BaconShop_HP_010",
    name: "圣光恩泽",
    description: "使一个随从获得 圣盾。",
    effect: "activeGiveDivineShield",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_011",
    cardId: "TB_BaconShop_HP_011",
    name: "迦拉克隆的贪婪",
    description: "选择酒馆中的一个随从，另选一个更高等级的随从将其替换。",
    effect: "activeReplaceHigherTier",
    activation: "active"
  },
  {
    id: "hero-power-stay-frosty",
    cardId: "TB_BaconShop_HP_014",
    name: "冰冷静滞",
    description: "随从消耗（2）枚铸币。酒馆中提供的随从减少一个，且每回合结束时都会冻结。",
    effect: "freezeEndTurnSmallerTavern",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_015",
    cardId: "TB_BaconShop_HP_015",
    name: "修补匠",
    description: "发现一个磁力机械。（等级4时解锁。）",
    effect: "activeDiscoverMagneticMech",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_017",
    cardId: "TB_BaconShop_HP_017",
    name: "鱼人头领",
    description: "在下一场战斗开始时，使你的所有随从获得“亡语：召唤一个1/1的鱼人。”",
    effect: "unknown",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_020",
    cardId: "TB_BaconShop_HP_020",
    name: "神奇魔术",
    description: "选择一个奥秘。将其置入战场。",
    effect: "chooseSecret",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_022",
    cardId: "TB_BaconShop_HP_022",
    name: "奇诡尖啸",
    description: "触发一个友方随从的战吼。（第3回合解锁。）",
    effect: "triggerBattlecry",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_024",
    cardId: "TB_BaconShop_HP_024",
    name: "复生庇佑",
    description: "直到下个回合，使一个随从获得 复生。",
    effect: "giveMinionReborn",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_028",
    cardId: "TB_BaconShop_HP_028",
    name: "时空酒馆",
    description: "刷新酒馆，其中包含两个比当前酒馆等级高一级的随从。",
    effect: "activeRefreshHigherTier",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_033",
    cardId: "TB_BaconShop_HP_033",
    name: "馆长奇珍",
    description: "开局时拥有一个具有烈毒和全部随从类型的2/2的融合怪。",
    effect: "startWithAmalgam",
    activation: "passive"
  },
  {
    id: "hero-power-all-patched-up",
    cardId: "TB_BaconShop_HP_035",
    name: "缝合完毕",
    description: "开局时额外拥有30点生命值。",
    effect: "bonusStartingHealth",
    activation: "passive",
    identityEligible: false
  },
  {
    id: "hero-power-tb_baconshop_hp_036",
    cardId: "TB_BaconShop_HP_036",
    name: "血怒",
    description: "在友方随从造成150点伤害后，打开一道通往扭曲虚空的传送门！（还剩150点！）",
    effect: "dealDamageForPortal",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_037a",
    cardId: "TB_BaconShop_HP_037a",
    name: "蜡油战队",
    description: "战斗开始时：使每个类型的各一个友方随从获得+1/+1。（在你花掉10枚铸币后提升！）",
    effect: "combatBuffPerTribe",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_038",
    cardId: "TB_BaconShop_HP_038",
    name: "香蕉明猩",
    description: "在你的回合开始时，获取2根香蕉，并使其他所有人获得 一根。",
    effect: "giveBananasEveryone",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_039t",
    cardId: "TB_BaconShop_HP_039t",
    name: "谜之匣",
    description: "在你的回合开始时，随机施放一个酒馆法术。（第3回合解锁。）",
    effect: "turnStartRandomSpell",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_040",
    cardId: "TB_BaconShop_HP_040",
    name: "添砖加瓦",
    description: "随机偷取酒馆中的一个随从，使其生命值翻倍。",
    effect: "activeDoubleHealthTavernMinion",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_041",
    cardId: "TB_BaconShop_HP_041",
    name: "鼠王的故事",
    description: "发现一张特定类型的随从牌。每回合切换类型。",
    effect: "activeDiscoverRotatingTribe",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_042",
    cardId: "TB_BaconShop_HP_042",
    name: "帽子戏法",
    description: "当你使用随从牌时，使其获得一顶+1/+1的帽子。帽子会在出售随从时传递给一个友方随从。",
    effect: "hatPassesOnSell",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_043",
    cardId: "TB_BaconShop_HP_043",
    name: "极恶之火",
    description: "战斗开始时：对所有敌方随从造成1点伤害。",
    effect: "unknown",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_044",
    cardId: "TB_BaconShop_HP_044",
    name: "挂机成瘾",
    description: "跳过你的前两个回合，然后发现等级3和等级4的随从各一个。",
    effect: "skipTwoTurnsForDiscovers",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_046",
    cardId: "TB_BaconShop_HP_046",
    name: "要发财了！",
    description: "每局对战限一次。使一个友方随从变为金色。0每局对战限一次。使一个友方随从变为金色。（时空扭曲随从除外。）",
    effect: "oncePerGameGolden",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_047",
    cardId: "TB_BaconShop_HP_047",
    name: "探险者领队",
    description: "发现一个你当前等级的随从。每次使用后消耗的铸币增加（1）枚。",
    effect: "activeDiscoverCurrentTierCostIncreases",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_048",
    cardId: "TB_BaconShop_HP_048",
    name: "战斗印记",
    description: "在你购买4个战吼随从后，获取一张布莱恩·铜须。（每局对战限一次）4在你购买4个战吼随从后，获取一张布莱恩·铜须。（还剩0个！）",
    effect: "battlecryPurchasesForBrann",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_049",
    cardId: "TB_BaconShop_HP_049",
    name: "夜鬼淘金",
    description: "偷取 酒馆中的一张牌。受到2点伤害。",
    effect: "activeStealTavernCardDamage",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_051",
    cardId: "TB_BaconShop_HP_051",
    name: "荣誉之师",
    description: "使你没有类型的所有随从获得+1/+1。",
    effect: "unknown",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_052",
    cardId: "TB_BaconShop_HP_052",
    name: "奥术变易",
    description: "将一张牌随机替换为一张等级相同的牌。（每回合可使用两次。）",
    effect: "unknown",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_053",
    cardId: "TB_BaconShop_HP_053",
    name: "归我了",
    description: "下一场战斗，获取你消灭的第一个随从的一张原始版复制。",
    effect: "activeStealFirstKillNextCombat",
    activation: "active"
  },
  {
    id: "hero-power-manastorm",
    cardId: "TB_BaconShop_HP_054",
    name: "法力风暴",
    description: "购买随从和刷新的消耗改为（2）枚铸币。升级酒馆所需的铸币增加（1）枚。",
    effect: "twoGoldMinionRefresh",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_056",
    cardId: "TB_BaconShop_HP_056",
    name: "愿者上钩",
    description: "在你出售5个随从后，随机获取一个鱼人。（还剩5个！）",
    effect: "sellMinionsForRandomMurloc",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_057",
    cardId: "TB_BaconShop_HP_057",
    name: "冒险出发！",
    description: "对战开始时，发现一个英雄技能。",
    effect: "startDiscoverHeroPower",
    activation: "passive"
  },
  {
    id: "hero-power-all-will-burn",
    cardId: "TB_BaconShop_HP_061",
    name: "万物尽焚！",
    description: "战斗开始时：使所有随从永久获得+2攻击力。",
    effect: "buffAllCombatMinionsAttack",
    activation: "passive"
  },
  {
    id: "hero-power-dream-portal",
    cardId: "TB_BaconShop_HP_062",
    name: "梦境之门",
    description: "每当酒馆刷新时，总会额外提供一条龙。",
    effect: "extraDragonOnRefresh",
    activation: "passive"
  },
  {
    id: "hero-power-see-the-future",
    cardId: "TB_BaconShop_HP_063",
    name: "洞察未来",
    description: "在你的回合开始时，获得一次免费的刷新。",
    effect: "freeRefreshAtTurnStart",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_064",
    cardId: "TB_BaconShop_HP_064",
    name: "红龙女王",
    description: "发现一张龙牌。（等级4时解锁。）",
    effect: "activeDiscoverDragonTier4",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_065",
    cardId: "TB_BaconShop_HP_065",
    name: "恶魔猎手训练",
    description: "在14个友方随从攻击后，每回合你购买的第一个随从免费。（还剩14个！）",
    effect: "attacksForFirstFreeBuy",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_065t2",
    cardId: "TB_BaconShop_HP_065t2",
    name: "幽灵视觉",
    description: "每回合你购买的第一个随从免费。",
    effect: "unknown",
    activation: "passive"
  },
  {
    id: "hero-power-verdant-spheres",
    cardId: "TB_BaconShop_HP_066",
    name: "翠绿魔珠",
    description: "在你购买3个随从后，获取一张酒馆币。",
    effect: "tavernCoinAfterThreeMinions",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_068",
    cardId: "TB_BaconShop_HP_068",
    name: "禁锢",
    description: "选择酒馆中的一张牌锁入你的手牌，2回合后解锁。",
    effect: "activeLockCardUnlockLater",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_069",
    cardId: "TB_BaconShop_HP_069",
    name: "左膀右臂",
    description: "战斗开始时：你最左边和最右边的随从获得+2/+1并立即发起攻击。",
    effect: "combatBuffFlanks",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_072",
    cardId: "TB_BaconShop_HP_072",
    name: "海盗聚会！",
    description: "获取一个海盗。在你购买一个海盗后，你的下一个英雄技能消耗减少（1）枚铸币。",
    effect: "activeGetPirateCostReduces",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_074",
    cardId: "TB_BaconShop_HP_074",
    name: "埋藏的宝藏",
    description: "挖出一个金色随从！（还要挖4次）",
    effect: "activeDigForGolden",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_075",
    cardId: "TB_BaconShop_HP_075",
    name: "变废为宝",
    description: "移除一个友方随从，发现一张低一级的随从牌。",
    effect: "removeDiscoverLowerTier",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_076",
    cardId: "TB_BaconShop_HP_076",
    name: "招财小猪",
    description: "获得2枚铸币。每回合都会提高1枚。（每局对战限一次。）",
    effect: "goldPerTurnOnce",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_077",
    cardId: "TB_BaconShop_HP_077",
    name: "鲍勃的豪夺",
    description: "刷新酒馆，使其中的随从变为你上一个对手战队随从的原始版复制。",
    effect: "activeRefreshOpponentMinions",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_080",
    cardId: "TB_BaconShop_HP_080",
    name: "克尔苏加德的猫",
    description: "在一个其他英雄死亡后，从其战队中发现一个随从。保留所有附加效果。",
    effect: "deadHeroDiscoverMinion",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_081",
    cardId: "TB_BaconShop_HP_081",
    name: "友好投注",
    description: "猜测下一场战斗中获胜的玩家。如果猜中，获取3张酒馆币。",
    effect: "activeBetOnWinner",
    activation: "active"
  },
  {
    id: "hero-power-ever-blooming",
    cardId: "TB_BaconShop_HP_082",
    name: "永远绽放",
    description: "在你升级酒馆后，获得2枚铸币。",
    effect: "gainGoldAfterUpgrade",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_084",
    cardId: "TB_BaconShop_HP_084",
    name: "强买强换",
    description: "将一个非金色的友方随从和酒馆中随机一个随从交换。",
    effect: "swapNonGoldenWithTavern",
    activation: "passive"
  },
  {
    id: "hero-power-light-the-tavern",
    cardId: "TB_BaconShop_HP_085t",
    name: "点亮酒馆",
    description: "你的酒馆法术使随从额外获得+1/+1。每4个回合，在回合开始时，提升此效果。（还剩4个回合！）",
    effect: "growingTavernSpellBuff",
    activation: "passive"
  },
  {
    id: "hero-power-swatting-insects",
    cardId: "TB_BaconShop_HP_086",
    name: "随风而行",
    description: "战斗开始时：使你最左边的随从获得风怒，圣盾以及嘲讽。",
    effect: "buffLeftmostCombatKeywords",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_087",
    cardId: "TB_BaconShop_HP_087",
    name: "买吧，虫子！",
    description: "在你购买16张牌后，获得萨弗拉斯。（还剩16张！）",
    effect: "totalCardsForSulfuras",
    activation: "passive"
  },
  {
    id: "hero-power-avalanche",
    cardId: "TB_BaconShop_HP_088",
    name: "雪崩",
    description: "在你使用3张元素牌后，升级酒馆所需的铸币减少（3）枚。",
    effect: "upgradeDiscountAfterElementals",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_101",
    cardId: "TB_BaconShop_HP_101",
    name: "热闹非凡",
    description: "酒馆中加入了暗月奖券！收集3张，发现一个你当前等级的随从。",
    effect: "collectDarkmoonTickets",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_102",
    cardId: "TB_BaconShop_HP_102",
    name: "三个愿望",
    description: "如果你有两个 相同的随从，找到第三个。（还剩3个愿望）",
    effect: "activeFindMissingTriple",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_103",
    cardId: "TB_BaconShop_HP_103",
    name: "宣泄怒火",
    description: "战斗开始时：召唤并获取一个你当前等级的随机随从。",
    effect: "unknown",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_104",
    cardId: "TB_BaconShop_HP_104",
    name: "古神恩典",
    description: "在回合结束时，使一个友方随从获得+1/+1。重复0次。（每回合都会提升！）",
    effect: "activeEndOfTurnScalingBuff",
    activation: "active"
  },
  {
    id: "hero-power-tb_baconshop_hp_105",
    cardId: "TB_BaconShop_HP_105",
    name: "恩佐斯的化身",
    description: "开局时拥有一条可以在战斗中获得你的所有亡语效果的2/2的鱼。",
    effect: "startWithDeathrattleFish",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_106",
    cardId: "TB_BaconShop_HP_106",
    name: "奖品满墙",
    description: "每4个回合，发现一个暗月奖品。（还剩3回合！）",
    effect: "periodicDarkmoonPrizes",
    activation: "passive"
  },
  {
    id: "hero-power-sprout-it-out",
    cardId: "TB_BaconShop_HP_107",
    name: "老树新芽",
    description: "使你在战斗阶段中召唤的随从获得+1/+2和嘲讽。",
    effect: "buffCombatSummons",
    activation: "passive"
  },
  {
    id: "hero-power-tb_baconshop_hp_702t",
    cardId: "TB_BaconShop_HP_702t",
    name: "咒罚符文",
    description: "消灭一个友方亡灵以随机获取一张亡灵牌。（等级2时解锁。）",
    effect: "activeKillUndeadForUndead",
    activation: "active"
  },
] as const;

export const HERO_DEFINITIONS = [
  {
    id: "hero-bg20-100",
    cardId: "BG20_HERO_100",
    name: "洛卡拉",
    heroPowerId: "hero-power-bg20_hero_100p",
    armor: 18
  },
  {
    id: "hero-bg20-101",
    cardId: "BG20_HERO_101",
    name: "泽瑞拉",
    heroPowerId: "hero-power-bg20_hero_101p",
    armor: 12
  },
  {
    id: "hero-bg20-102",
    cardId: "BG20_HERO_102",
    name: "萨鲁法尔大王",
    heroPowerId: "hero-power-bg20_hero_102p",
    armor: 18
  },
  {
    id: "hero-bg20-103",
    cardId: "BG20_HERO_103",
    name: "亡语者布莱克松",
    heroPowerId: "hero-power-bg20_hero_103p",
    armor: 18
  },
  {
    id: "hero-bg20-201",
    cardId: "BG20_HERO_201",
    name: "沃金",
    heroPowerId: "hero-power-bg20_hero_201p",
    armor: 17
  },
  {
    id: "hero-bg20-202",
    cardId: "BG20_HERO_202",
    name: "阮大师",
    heroPowerId: "hero-power-bg20_hero_202p",
    armor: 10
  },
  {
    id: "hero-bg20-242",
    cardId: "BG20_HERO_242",
    name: "古夫·符文图腾",
    heroPowerId: "hero-power-bg20_hero_242p",
    armor: 12
  },
  {
    id: "hero-bg20-280",
    cardId: "BG20_HERO_280",
    name: "库尔特鲁斯·陨烬",
    heroPowerId: "hero-power-bg20_hero_280p5",
    armor: 14
  },
  {
    id: "hero-bg20-282",
    cardId: "BG20_HERO_282",
    name: "塔姆辛·罗姆",
    heroPowerId: "hero-power-bg20_hero_282p",
    armor: 10
  },
  {
    id: "hero-bg20-283",
    cardId: "BG20_HERO_283",
    name: "狂风之翼",
    heroPowerId: "hero-power-bg20_hero_283p",
    armor: 10
  },
  {
    id: "hero-bg20-301",
    cardId: "BG20_HERO_301",
    name: "吞噬者穆坦努斯",
    heroPowerId: "hero-power-bg20_hero_301p",
    armor: 20
  },
  {
    id: "hero-bg21-000",
    cardId: "BG21_HERO_000",
    name: "凯瑞尔·罗姆",
    heroPowerId: "hero-power-bg21_hero_000p",
    armor: 18
  },
  {
    id: "hero-bg21-010",
    cardId: "BG21_HERO_010",
    name: "斯卡布斯·刀油",
    heroPowerId: "hero-power-bg21_hero_010p",
    armor: 15
  },
  {
    id: "hero-bg21-020",
    cardId: "BG21_HERO_020",
    name: "厨师曲奇",
    heroPowerId: "hero-power-bg21_hero_020p",
    armor: 8
  },
  {
    id: "hero-bg21-030",
    cardId: "BG21_HERO_030",
    name: "斯尼德",
    heroPowerId: "hero-power-bg21_hero_030p",
    armor: 20
  },
  {
    id: "hero-bg22-000",
    cardId: "BG22_HERO_000",
    name: "塔维什·雷矛",
    heroPowerId: "hero-power-bg22_hero_000p_alt",
    armor: 14
  },
  {
    id: "hero-bg22-001",
    cardId: "BG22_HERO_001",
    name: "布鲁坎",
    heroPowerId: "hero-power-bg22_hero_001p",
    armor: 15
  },
  {
    id: "hero-bg22-002",
    cardId: "BG22_HERO_002",
    name: "德雷克塔尔",
    heroPowerId: "hero-power-bg22_hero_002p",
    armor: 10
  },
  {
    id: "hero-bg22-003",
    cardId: "BG22_HERO_003",
    name: "范达尔·雷矛",
    heroPowerId: "hero-power-bg22_hero_003p",
    armor: 12
  },
  {
    id: "hero-bg22-004",
    cardId: "BG22_HERO_004",
    name: "瓦尔登·晨拥",
    heroPowerId: "hero-power-bg22_hero_004p",
    armor: 18
  },
  {
    id: "hero-bg22-007",
    cardId: "BG22_HERO_007",
    name: "艾萨拉女王",
    heroPowerId: "hero-power-bg22_hero_007p",
    armor: 12
  },
  {
    id: "bg22-hero-007t",
    cardId: "BG22_HERO_007t",
    name: "纳迦女王艾萨拉",
    heroPowerId: "hero-power-bg22_hero_007p2",
    armor: 0
  },
  {
    id: "hero-bg22-200",
    cardId: "BG22_HERO_200",
    name: "伊妮·积雷",
    heroPowerId: "hero-power-bg22_hero_200p",
    armor: 15
  },
  {
    id: "hero-bg22-201",
    cardId: "BG22_HERO_201",
    name: "费林大使",
    heroPowerId: "hero-power-bg22_hero_201p",
    armor: 14
  },
  {
    id: "hero-bg22-305",
    cardId: "BG22_HERO_305",
    name: "奥妮克希亚",
    heroPowerId: "hero-power-bg22_hero_305p",
    armor: 10
  },
  {
    id: "hero-bg23-201",
    cardId: "BG23_HERO_201",
    name: "厄祖玛特",
    heroPowerId: "hero-power-bg23_hero_201p",
    armor: 15
  },
  {
    id: "hero-bg23-303",
    cardId: "BG23_HERO_303",
    name: "摩洛克·福尔摩斯",
    heroPowerId: "hero-power-bg23_hero_303p2",
    armor: 12
  },
  {
    id: "hero-bg23-304",
    cardId: "BG23_HERO_304",
    name: "瓦丝琪女士",
    heroPowerId: "hero-power-bg23_hero_304p",
    armor: 16
  },
  {
    id: "hero-bg23-305",
    cardId: "BG23_HERO_305",
    name: "劫匪之王托瓦格尔",
    heroPowerId: "hero-power-bg23_hero_305p",
    armor: 14
  },
  {
    id: "hero-bg23-306",
    cardId: "BG23_HERO_306",
    name: "希尔瓦娜斯·风行者",
    heroPowerId: "hero-power-bg23_hero_306p",
    armor: 10
  },
  {
    id: "hero-bg24-100",
    cardId: "BG24_HERO_100",
    name: "德纳修斯大帝",
    heroPowerId: "hero-power-bg24_hero_100p",
    armor: 11
  },
  {
    id: "hero-bg24-204",
    cardId: "BG24_HERO_204",
    name: "强化机器人",
    heroPowerId: "hero-power-bg24_hero_204p",
    armor: 20
  },
  {
    id: "hero-bg25-100",
    cardId: "BG25_HERO_100",
    name: "普崔塞德教授",
    heroPowerId: "hero-power-bg25_hero_100p",
    armor: 12
  },
  {
    id: "hero-bg25-103",
    cardId: "BG25_HERO_103",
    name: "塔隆·血魔",
    heroPowerId: "hero-power-bg25_hero_103p",
    armor: 14
  },
  {
    id: "hero-bg25-105",
    cardId: "BG25_HERO_105",
    name: "乐队经理精英牛头人酋长",
    heroPowerId: "hero-power-bg25_hero_105p",
    armor: 14
  },
  {
    id: "hero-capn-hoggarr",
    cardId: "BG26_HERO_101",
    name: "霍格船长",
    heroPowerId: "hero-power-yo-ho-ogre",
    armor: 12
  },
  {
    id: "hero-bg26-102",
    cardId: "BG26_HERO_102",
    name: "因葛，钢铁颂歌",
    heroPowerId: "hero-power-bg26_hero_102p",
    armor: 17
  },
  {
    id: "hero-bg26-104",
    cardId: "BG26_HERO_104",
    name: "摇滚教父沃恩",
    heroPowerId: "hero-power-bg26_hero_104p",
    armor: 15
  },
  {
    id: "hero-bg27-801",
    cardId: "BG27_HERO_801",
    name: "风暴之王托里姆",
    heroPowerId: "hero-power-bg27_hero_801p2",
    armor: 18
  },
  {
    id: "hero-bg28-400",
    cardId: "BG28_HERO_400",
    name: "蛇眼",
    heroPowerId: "hero-power-bg28_hero_400p",
    armor: 5
  },
  {
    id: "hero-taethelan-bloodwatcher",
    cardId: "BG28_HERO_800",
    name: "泰瑟兰·血望者",
    heroPowerId: "hero-power-reliquary-research",
    armor: 18
  },
  {
    id: "hero-bg28-801",
    cardId: "BG28_HERO_801",
    name: "荷利戴医生",
    heroPowerId: "hero-power-bg28_hero_801p",
    armor: 14
  },
  {
    id: "hero-bg30-304",
    cardId: "BG30_HERO_304",
    name: "经理马林",
    heroPowerId: "hero-power-bg30_hero_304p",
    armor: 12
  },
  {
    id: "hero-bg31-003",
    cardId: "BG31_HERO_003",
    name: "预言者努波顿",
    heroPowerId: "hero-power-bg31_hero_003p",
    armor: 15
  },
  {
    id: "hero-bg31-005",
    cardId: "BG31_HERO_005",
    name: "克隆大师泽里克",
    heroPowerId: "hero-power-bg31_hero_005p",
    armor: 18
  },
  {
    id: "hero-bg31-006",
    cardId: "BG31_HERO_006",
    name: "大主教奥萨尔",
    heroPowerId: "hero-power-bg31_hero_006p",
    armor: 15
  },
  {
    id: "hero-bg31-801",
    cardId: "BG31_HERO_801",
    name: "吉姆·雷诺",
    heroPowerId: "hero-power-bg31_hero_801p",
    armor: 16
  },
  {
    id: "hero-bg31-802",
    cardId: "BG31_HERO_802",
    name: "阿塔尼斯",
    heroPowerId: "hero-power-bg31_hero_802p",
    armor: 18
  },
  {
    id: "hero-bg31-811",
    cardId: "BG31_HERO_811",
    name: "刀锋女王凯瑞甘",
    heroPowerId: "hero-power-bg31_hero_811p",
    armor: 14
  },
  {
    id: "hero-bg32-001",
    cardId: "BG32_HERO_001",
    name: "森林之王塞纳留斯",
    heroPowerId: "hero-power-bg32_hero_001p",
    armor: 16
  },
  {
    id: "hero-bg32-002",
    cardId: "BG32_HERO_002",
    name: "扣子",
    heroPowerId: "hero-power-bg32_hero_002p",
    armor: 16
  },
  {
    id: "hero-bg33-001",
    cardId: "BG33_HERO_001",
    name: "洛，在世传奇",
    heroPowerId: "hero-power-bg33_hero_001p_alt",
    armor: 17
  },
  {
    id: "hero-bg34-000",
    cardId: "BG34_HERO_000",
    name: "无限巨龙姆诺兹多",
    heroPowerId: "hero-power-bg34_hero_000p",
    armor: 12
  },
  {
    id: "hero-bg34-001",
    cardId: "BG34_HERO_001",
    name: "时光扭曲者克罗米",
    heroPowerId: "hero-power-bg34_hero_001p",
    armor: 12
  },
  {
    id: "hero-bg34-002",
    cardId: "BG34_HERO_002",
    name: "钟表先生克劳沃斯",
    heroPowerId: "hero-power-bg34_hero_002p",
    armor: 18
  },
  {
    id: "hero-bg34-004",
    cardId: "BG34_HERO_004",
    name: "米罗克",
    heroPowerId: "hero-power-bg34_hero_004p",
    armor: 8
  },
  {
    id: "hero-bg35-001",
    cardId: "BG35_HERO_001",
    name: "吉恩，狼人国王",
    heroPowerId: "hero-power-bg35_hero_001p",
    armor: 7
  },
  {
    id: "hero-tb-01",
    cardId: "TB_BaconShop_HERO_01",
    name: "艾德温·范克里夫",
    heroPowerId: "hero-power-tb_baconshop_hp_001",
    armor: 18
  },
  {
    id: "hero-tb-02",
    cardId: "TB_BaconShop_HERO_02",
    name: "迦拉克隆",
    heroPowerId: "hero-power-tb_baconshop_hp_011",
    armor: 18
  },
  {
    id: "hero-tb-08",
    cardId: "TB_BaconShop_HERO_08",
    name: "伊利丹·怒风",
    heroPowerId: "hero-power-tb_baconshop_hp_069",
    armor: 18
  },
  {
    id: "hero-trade-prince-gallywix",
    cardId: "TB_BaconShop_HERO_10",
    name: "贸易亲王加里维克斯",
    heroPowerId: "hero-power-smart-savings",
    armor: 5
  },
  {
    id: "hero-tb-11",
    cardId: "TB_BaconShop_HERO_11",
    name: "炎魔之王拉格纳罗斯",
    heroPowerId: "hero-power-tb_baconshop_hp_087",
    armor: 18
  },
  {
    id: "hero-tb-12",
    cardId: "TB_BaconShop_HERO_12",
    name: "鼠王",
    heroPowerId: "hero-power-tb_baconshop_hp_041",
    armor: 12
  },
  {
    id: "hero-tb-14",
    cardId: "TB_BaconShop_HERO_14",
    name: "瓦托格尔女王",
    heroPowerId: "hero-power-tb_baconshop_hp_037a",
    armor: 14
  },
  {
    id: "hero-tb-15",
    cardId: "TB_BaconShop_HERO_15",
    name: "堕落的乔治",
    heroPowerId: "hero-power-tb_baconshop_hp_010",
    armor: 15
  },
  {
    id: "hero-tb-16",
    cardId: "TB_BaconShop_HERO_16",
    name: "挂机的阿凯",
    heroPowerId: "hero-power-tb_baconshop_hp_044",
    armor: 15
  },
  {
    id: "hero-tb-17",
    cardId: "TB_BaconShop_HERO_17",
    name: "米尔菲丝·法力风暴",
    heroPowerId: "hero-power-tb_baconshop_hp_015",
    armor: 15
  },
  {
    id: "hero-tb-18",
    cardId: "TB_BaconShop_HERO_18",
    name: "海盗帕奇斯",
    heroPowerId: "hero-power-tb_baconshop_hp_072",
    armor: 18
  },
  {
    id: "hero-tb-19",
    cardId: "TB_BaconShop_HERO_19",
    name: "老蓟皮",
    heroPowerId: "hero-power-tb_baconshop_hp_017",
    armor: 0
  },
  {
    id: "hero-tb-21",
    cardId: "TB_BaconShop_HERO_21",
    name: "伟大的阿卡扎曼扎拉克",
    heroPowerId: "hero-power-tb_baconshop_hp_020",
    armor: 12
  },
  {
    id: "hero-tb-22",
    cardId: "TB_BaconShop_HERO_22",
    name: "巫妖王",
    heroPowerId: "hero-power-tb_baconshop_hp_024",
    armor: 14
  },
  {
    id: "hero-tb-23",
    cardId: "TB_BaconShop_HERO_23",
    name: "沙德沃克",
    heroPowerId: "hero-power-tb_baconshop_hp_022",
    armor: 10
  },
  {
    id: "hero-tb-25",
    cardId: "TB_BaconShop_HERO_25",
    name: "巫妖巴兹亚尔",
    heroPowerId: "hero-power-tb_baconshop_hp_049",
    armor: 18
  },
  {
    id: "hero-sindragosa",
    cardId: "TB_BaconShop_HERO_27",
    name: "辛达苟萨",
    heroPowerId: "hero-power-stay-frosty",
    armor: 7
  },
  {
    id: "hero-tb-28",
    cardId: "TB_BaconShop_HERO_28",
    name: "永恒者托奇",
    heroPowerId: "hero-power-tb_baconshop_hp_028",
    armor: 10
  },
  {
    id: "hero-tb-29",
    cardId: "TB_BaconShop_HERO_29",
    name: "克苏恩",
    heroPowerId: "hero-power-tb_baconshop_hp_104",
    armor: 20
  },
  {
    id: "hero-tb-30",
    cardId: "TB_BaconShop_HERO_30",
    name: "奈法利安",
    heroPowerId: "hero-power-tb_baconshop_hp_043",
    armor: 0
  },
  {
    id: "hero-bartendotron",
    cardId: "TB_BaconShop_HERO_31",
    name: "调酒机器人",
    heroPowerId: "hero-power-experienced-bartender",
    armor: 0
  },
  {
    id: "hero-tb-33",
    cardId: "TB_BaconShop_HERO_33",
    name: "馆长",
    heroPowerId: "hero-power-tb_baconshop_hp_033",
    armor: 16
  },
  {
    id: "hero-patchwerk",
    cardId: "TB_BaconShop_HERO_34",
    name: "帕奇维克",
    heroPowerId: "hero-power-all-patched-up",
    armor: 0
  },
  {
    id: "hero-tb-35",
    cardId: "TB_BaconShop_HERO_35",
    name: "尤格-萨隆",
    heroPowerId: "hero-power-tb_baconshop_hp_039t",
    armor: 10
  },
  {
    id: "hero-tb-36",
    cardId: "TB_BaconShop_HERO_36",
    name: "舞者达瑞尔",
    heroPowerId: "hero-power-tb_baconshop_hp_042",
    armor: 16
  },
  {
    id: "hero-tb-37",
    cardId: "TB_BaconShop_HERO_37",
    name: "加拉克苏斯大王",
    heroPowerId: "hero-power-tb_baconshop_hp_036",
    armor: 15
  },
  {
    id: "hero-tb-38",
    cardId: "TB_BaconShop_HERO_38",
    name: "穆克拉",
    heroPowerId: "hero-power-tb_baconshop_hp_038",
    armor: 16
  },
  {
    id: "hero-tb-39",
    cardId: "TB_BaconShop_HERO_39",
    name: "疯狂金字塔",
    heroPowerId: "hero-power-tb_baconshop_hp_040",
    armor: 14
  },
  {
    id: "hero-tb-40",
    cardId: "TB_BaconShop_HERO_40",
    name: "芬利·莫格顿爵士",
    heroPowerId: "hero-power-tb_baconshop_hp_057",
    armor: 14
  },
  {
    id: "hero-tb-41",
    cardId: "TB_BaconShop_HERO_41",
    name: "雷诺·杰克逊",
    heroPowerId: "hero-power-tb_baconshop_hp_046",
    armor: 16
  },
  {
    id: "hero-tb-42",
    cardId: "TB_BaconShop_HERO_42",
    name: "伊莉斯·逐星",
    heroPowerId: "hero-power-tb_baconshop_hp_047",
    armor: 15
  },
  {
    id: "hero-tb-43",
    cardId: "TB_BaconShop_HERO_43",
    name: "恐龙大师布莱恩",
    heroPowerId: "hero-power-tb_baconshop_hp_048",
    armor: 18
  },
  {
    id: "hero-tb-45",
    cardId: "TB_BaconShop_HERO_45",
    name: "至尊盗王拉法姆",
    heroPowerId: "hero-power-tb_baconshop_hp_053",
    armor: 15
  },
  {
    id: "hero-tb-47",
    cardId: "TB_BaconShop_HERO_47",
    name: "提里奥·弗丁",
    heroPowerId: "hero-power-tb_baconshop_hp_051",
    armor: 0
  },
  {
    id: "hero-millhouse-manastorm",
    cardId: "TB_BaconShop_HERO_49",
    name: "米尔豪斯·法力风暴",
    heroPowerId: "hero-power-manastorm",
    armor: 16
  },
  {
    id: "hero-tb-50",
    cardId: "TB_BaconShop_HERO_50",
    name: "苔丝·格雷迈恩",
    heroPowerId: "hero-power-tb_baconshop_hp_077",
    armor: 17
  },
  {
    id: "hero-deathwing",
    cardId: "TB_BaconShop_HERO_52",
    name: "死亡之翼",
    heroPowerId: "hero-power-all-will-burn",
    armor: 18
  },
  {
    id: "hero-ysera",
    cardId: "TB_BaconShop_HERO_53",
    name: "伊瑟拉",
    heroPowerId: "hero-power-dream-portal",
    armor: 17
  },
  {
    id: "hero-tb-55",
    cardId: "TB_BaconShop_HERO_55",
    name: "菌菇术士弗洛格尔",
    heroPowerId: "hero-power-tb_baconshop_hp_056",
    armor: 12
  },
  {
    id: "hero-tb-56",
    cardId: "TB_BaconShop_HERO_56",
    name: "阿莱克丝塔萨",
    heroPowerId: "hero-power-tb_baconshop_hp_064",
    armor: 10
  },
  {
    id: "hero-nozdormu",
    cardId: "TB_BaconShop_HERO_57",
    name: "诺兹多姆",
    heroPowerId: "hero-power-see-the-future",
    armor: 13
  },
  {
    id: "hero-tb-58",
    cardId: "TB_BaconShop_HERO_58",
    name: "玛里苟斯",
    heroPowerId: "hero-power-tb_baconshop_hp_052",
    armor: 17
  },
  {
    id: "hero-tb-59",
    cardId: "TB_BaconShop_HERO_59",
    name: "阿兰娜·逐星",
    heroPowerId: "hero-power-tb_baconshop_hp_065",
    armor: 12
  },
  {
    id: "tb-baconshop-hero-59t",
    cardId: "TB_BaconShop_HERO_59t",
    name: "释放自我的阿兰娜",
    heroPowerId: "hero-power-tb_baconshop_hp_065t2",
    armor: 0
  },
  {
    id: "hero-kaelthas-sunstrider",
    cardId: "TB_BaconShop_HERO_60",
    name: "凯尔萨斯·逐日者",
    heroPowerId: "hero-power-verdant-spheres",
    armor: 16
  },
  {
    id: "hero-tb-62",
    cardId: "TB_BaconShop_HERO_62",
    name: "玛维·影歌",
    heroPowerId: "hero-power-tb_baconshop_hp_068",
    armor: 17
  },
  {
    id: "hero-tb-64",
    cardId: "TB_BaconShop_HERO_64",
    name: "尤朵拉船长",
    heroPowerId: "hero-power-tb_baconshop_hp_074",
    armor: 14
  },
  {
    id: "hero-tb-67",
    cardId: "TB_BaconShop_HERO_67",
    name: "钩牙船长",
    heroPowerId: "hero-power-tb_baconshop_hp_075",
    armor: 14
  },
  {
    id: "hero-tb-68",
    cardId: "TB_BaconShop_HERO_68",
    name: "天空上尉库拉格",
    heroPowerId: "hero-power-tb_baconshop_hp_076",
    armor: 14
  },
  {
    id: "hero-tb-70",
    cardId: "TB_BaconShop_HERO_70",
    name: "比格沃斯先生",
    heroPowerId: "hero-power-tb_baconshop_hp_080",
    armor: 19
  },
  {
    id: "hero-tb-702",
    cardId: "TB_BaconShop_HERO_702",
    name: "典狱长",
    heroPowerId: "hero-power-tb_baconshop_hp_702t",
    armor: 10
  },
  {
    id: "hero-tb-71",
    cardId: "TB_BaconShop_HERO_71",
    name: "詹迪斯·巴罗夫",
    heroPowerId: "hero-power-tb_baconshop_hp_084",
    armor: 18
  },
  {
    id: "hero-tb-72",
    cardId: "TB_BaconShop_HERO_72",
    name: "巴罗夫领主",
    heroPowerId: "hero-power-tb_baconshop_hp_081",
    armor: 14
  },
  {
    id: "hero-forest-warden-omu",
    cardId: "TB_BaconShop_HERO_74",
    name: "林地守护者欧穆",
    heroPowerId: "hero-power-ever-blooming",
    armor: 6
  },
  {
    id: "hero-rakanishu",
    cardId: "TB_BaconShop_HERO_75",
    name: "拉卡尼休",
    heroPowerId: "hero-power-light-the-tavern",
    armor: 15
  },
  {
    id: "hero-alakir",
    cardId: "TB_BaconShop_HERO_76",
    name: "奥拉基尔",
    heroPowerId: "hero-power-swatting-insects",
    armor: 15
  },
  {
    id: "hero-chenvaala",
    cardId: "TB_BaconShop_HERO_78",
    name: "齐恩瓦拉",
    heroPowerId: "hero-power-avalanche",
    armor: 15
  },
  {
    id: "hero-tb-90",
    cardId: "TB_BaconShop_HERO_90",
    name: "希拉斯·暗月",
    heroPowerId: "hero-power-tb_baconshop_hp_101",
    armor: 14
  },
  {
    id: "hero-tb-91",
    cardId: "TB_BaconShop_HERO_91",
    name: "了不起的杰弗里斯",
    heroPowerId: "hero-power-tb_baconshop_hp_102",
    armor: 17
  },
  {
    id: "hero-tb-92",
    cardId: "TB_BaconShop_HERO_92",
    name: "亚煞极",
    heroPowerId: "hero-power-tb_baconshop_hp_103",
    armor: 18
  },
  {
    id: "hero-tb-93",
    cardId: "TB_BaconShop_HERO_93",
    name: "恩佐斯",
    heroPowerId: "hero-power-tb_baconshop_hp_105",
    armor: 12
  },
  {
    id: "hero-tb-94",
    cardId: "TB_BaconShop_HERO_94",
    name: "提克特斯",
    heroPowerId: "hero-power-tb_baconshop_hp_106",
    armor: 17
  },
  {
    id: "hero-greybough",
    cardId: "TB_BaconShop_HERO_95",
    name: "格雷布",
    heroPowerId: "hero-power-sprout-it-out",
    armor: 16
  },
] as const;

const HERO_POWER_BY_ID = new Map<string, HeroPowerDefinition>(
  HERO_POWER_DEFINITIONS.map((d) => [d.id, d as unknown as HeroPowerDefinition]),
);

const HERO_BY_ID = new Map<string, HeroDefinition>(
  HERO_DEFINITIONS.map((d) => [d.id, d as unknown as HeroDefinition]),
);

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate ${label} in Hero registry.`);
  }
}

function validateHeroRegistry(): void {
  if (HERO_DEFINITIONS.length < HERO_OFFER_SIZE) {
    throw new Error(`Hero registry needs at least ${HERO_OFFER_SIZE} definitions.`);
  }
  assertUnique(HERO_POWER_DEFINITIONS.map((d) => d.id), "Hero Power definition ID");
  assertUnique(HERO_POWER_DEFINITIONS.map((d) => d.cardId), "Hero Power CardID");
  assertUnique(HERO_DEFINITIONS.map((d) => d.id), "Hero definition ID");
  assertUnique(HERO_DEFINITIONS.map((d) => d.cardId), "Hero CardID");
  assertUnique(HERO_DEFINITIONS.map((d) => d.heroPowerId), "Hero-to-power mapping");
  if (HERO_DEFINITIONS.length !== HERO_POWER_DEFINITIONS.length) {
    throw new Error("Hero/Power count mismatch: " + HERO_DEFINITIONS.length + " heroes, " + HERO_POWER_DEFINITIONS.length + " powers");
  }
  for (const hero of HERO_DEFINITIONS) {
    if (!HERO_POWER_BY_ID.has(hero.heroPowerId)) {
      throw new Error(`Hero ${hero.id} references unknown power ${hero.heroPowerId}.`);
    }
  }
  const linkedPowerIds = new Set(HERO_DEFINITIONS.map((d) => d.heroPowerId));
  for (const power of HERO_POWER_DEFINITIONS) {
    if (!linkedPowerIds.has(power.id)) {
      throw new Error(`Hero Power ${power.id} has no linked Hero.`);
    }
  }
}

validateHeroRegistry();

export function getHeroPowerDefinition(definitionId: string): HeroPowerDefinition {
  const def = HERO_POWER_BY_ID.get(definitionId);
  if (!def) throw new Error(`Unknown hero power definition: ${definitionId}`);
  return def;
}

export function heroPowerCanBeManuallyActivated(definitionId: string): boolean {
  return getHeroPowerDefinition(definitionId).activation === "active";
}

export function heroPowerIsPlayable(definitionId: string): boolean {
  return !UNSUPPORTED_HERO_POWER_EFFECTS.has(
    getHeroPowerDefinition(definitionId).effect,
  );
}

export function isHeroPowerDefinitionId(definitionId: string): boolean {
  return HERO_POWER_BY_ID.has(definitionId);
}

export function getHeroDefinition(definitionId: string): HeroDefinition {
  const def = HERO_BY_ID.get(definitionId);
  if (!def) throw new Error(`Unknown hero definition: ${definitionId}`);
  return def;
}

export function isHeroDefinitionId(definitionId: string): boolean {
  return HERO_BY_ID.has(definitionId);
}

const TRIBE_BOUND_HERO_POWERS: Record<string, readonly Tribe[]> = {
  "hero-power-sprout-it-out": ["beast", "undead"],
  "hero-power-dream-portal": ["dragon"],
  "hero-power-avalanche": ["elemental"],
  "hero-power-yo-ho-ogre": ["pirate"],
};

function heroPowerIsAvailableForTribes(
  heroPowerId: string,
  activeTribes: readonly Tribe[],
): boolean {
  const tribes = TRIBE_BOUND_HERO_POWERS[heroPowerId];
  if (!tribes || tribes.length === 0) return true;
  return tribes.some((tribe) => activeTribes.includes(tribe));
}

export function heroIsAvailableForTribes(
  definition: HeroDefinition,
  activeTribes: readonly Tribe[],
): boolean {
  return heroPowerIsAvailableForTribes(
    definition.heroPowerId,
    activeTribes,
  );
}

export function heroesAvailableForTribes(
  activeTribes: readonly Tribe[],
): HeroDefinition[] {
  return HERO_DEFINITIONS
    .filter(
      (d) =>
        heroPowerIsPlayable(d.heroPowerId) &&
        heroIsAvailableForTribes(d as unknown as HeroDefinition, activeTribes),
    )
    .map((d) => ({ ...(d as unknown as HeroDefinition), associatedTribes: undefined }));
}

export function identityEligibleHeroPowers(
  currentHeroPowerId: string | null,
  activeTribes: readonly Tribe[],
): HeroPowerDefinition[] {
  return HERO_POWER_DEFINITIONS
    .filter(
      (d) =>
        d.id !== currentHeroPowerId &&
        !UNSUPPORTED_HERO_POWER_EFFECTS.has(d.effect) &&
        !IDENTITY_INELIGIBLE_HERO_POWER_EFFECTS.has(d.effect) &&
        heroPowerIsAvailableForTribes(d.id, activeTribes) &&
        (d as unknown as HeroPowerDefinition).identityEligible !== false,
    )
    .map((d) => ({ ...d } as unknown as HeroPowerDefinition));
}

export function createInitialHeroPowerCounters(
  heroPowerId: string | null,
): Record<string, number> {
  if (heroPowerId === null) return {};
  const effect = getHeroPowerDefinition(heroPowerId).effect;
  switch (effect) {
    case "goldAfterSellNextTurn": return { [HERO_POWER_COUNTER_KEYS.smartSavingsGold]: 0 };
    case "upgradeDiscountAfterElementals": return { [HERO_POWER_COUNTER_KEYS.chenvaalaElementals]: 0 };
    case "tavernCoinAfterThreeMinions": return { [HERO_POWER_COUNTER_KEYS.kaelthasMinions]: 0 };
    case "freeFourthTavernSpell": return { [HERO_POWER_COUNTER_KEYS.taethelanSpells]: 0 };
    case "growingTavernSpellBuff": return { [HERO_POWER_COUNTER_KEYS.rakanishuTurns]: 4, [HERO_POWER_COUNTER_KEYS.rakanishuBonus]: 1 };
    case "growingTavernBuff": return { [HERO_POWER_COUNTER_KEYS.saurfangBuys]: 4, [HERO_POWER_COUNTER_KEYS.saurfangBuff]: 1 };
    case "buyTierTripleReward": return { [HERO_POWER_COUNTER_KEYS.guffTiers]: 20 };
    case "afterThreePurchasesGetCopy": return { [HERO_POWER_COUNTER_KEYS.kurtrusBuys]: 0, [HERO_POWER_COUNTER_KEYS.kurtrusUsed]: 0 };
    case "nagaExpedition": return { [HERO_POWER_COUNTER_KEYS.nagaAttack]: 0, [HERO_POWER_COUNTER_KEYS.nagaActive]: 0 };
    case "deadMinionsForMech": return { [HERO_POWER_COUNTER_KEYS.iniDeaths]: 9 };
    case "attacksForFirstFreeBuy": return { [HERO_POWER_COUNTER_KEYS.arannaAttacks]: 14, [HERO_POWER_COUNTER_KEYS.arannaFreeBuyUsed]: 0 };
    case "sellMinionsForRandomMurloc": return { [HERO_POWER_COUNTER_KEYS.flurglSells]: 5 };
    case "collectDarkmoonTickets": return { [HERO_POWER_COUNTER_KEYS.darkmoonTickets]: 0 };
    case "dealDamageForPortal": return { [HERO_POWER_COUNTER_KEYS.jaraxxusDamage]: 0 };
    case "totalCardsForSulfuras": return { [HERO_POWER_COUNTER_KEYS.sulfurasCards]: 0, [HERO_POWER_COUNTER_KEYS.ragnarosActive]: 0 };
    case "activeEndOfTurnScalingBuff": return { [HERO_POWER_COUNTER_KEYS.cthunBuff]: 0 };
    case "activeScalingTargetBuff": return { [HERO_POWER_COUNTER_KEYS.edwinBuys]: 0, [HERO_POWER_COUNTER_KEYS.edwinBuff]: 0 };
    case "activeDiscoverCurrentTierCostIncreases": return { [HERO_POWER_COUNTER_KEYS.eliseUses]: 0 };
    case "activeDigForGolden": return { [HERO_POWER_COUNTER_KEYS.eudoraDigs]: 0 };
    case "periodicDarkmoonPrizes": return { [HERO_POWER_COUNTER_KEYS.tickatusRound]: 4 };
    case "copyLeftmostHandCard": return { [HERO_POWER_COUNTER_KEYS.vooneRound]: 3, [HERO_POWER_COUNTER_KEYS.vooneActive]: 0 };
    case "discoverTier7ForGoldSpent": return { [HERO_POWER_COUNTER_KEYS.thorimGold]: 0, [HERO_POWER_COUNTER_KEYS.thorimUnlockRound]: 0 };
    case "delayedRewardAfterPurchases": return { [HERO_POWER_COUNTER_KEYS.artanisBuys]: 0, [HERO_POWER_COUNTER_KEYS.artanisUnlockRound]: 0 };
    case "chooseTrinketAtTurn5": return { [HERO_POWER_COUNTER_KEYS.marinRound]: 1 };
    case "chooseGreaterTrinketAtTurn8": return { [HERO_POWER_COUNTER_KEYS.buttonRound]: 1 };
    case "timeWarpAtTurn8": return { [HERO_POWER_COUNTER_KEYS.murozondRound]: 1 };
    case "timeWarpAtTurn5": return { [HERO_POWER_COUNTER_KEYS.mirokRound]: 1 };
    case "discoverHeroPowerAtTurn4": return { [HERO_POWER_COUNTER_KEYS.gennRound]: 4 };
    case "attacksForTriple": return { [HERO_POWER_COUNTER_KEYS.luoAttacks]: 15, [HERO_POWER_COUNTER_KEYS.luoGranted]: 0 };
    case "activeUnlockZergTier": return { [HERO_POWER_COUNTER_KEYS.kerriganTier]: 0 };
    case "activeRandomBuffChooseUpgrade": return { [HERO_POWER_COUNTER_KEYS.carielLevel]: 0 };
    case "activeDiscoverFromNextOpponent": return { [HERO_POWER_COUNTER_KEYS.scabbsUsed]: 0 };
    case "activeDiscoverDeadMinionCopy": return { [HERO_POWER_COUNTER_KEYS.sylvanasUsed]: 0 };
    case "activeCopyLastTavernSpell": return { [HERO_POWER_COUNTER_KEYS.nobundoRound]: 0 };
    case "activeRollDiceForGold": return { [HERO_POWER_COUNTER_KEYS.snakeEyesCooldown]: 0 };
    case "activeGetPirateCostReduces": return { [HERO_POWER_COUNTER_KEYS.patchesDiscount]: 0 };
    case "activeStealAllTavernCards": return { [HERO_POWER_COUNTER_KEYS.togwaggleDiscount]: 0 };
    case "goldPerTurnOnce": return { [HERO_POWER_COUNTER_KEYS.kraggUsed]: 0, [HERO_POWER_COUNTER_KEYS.kraggBonus]: 0 };
    case "activeBuildCustomUndead": return { [HERO_POWER_COUNTER_KEYS.putricideWorks]: 3 };
    case "activeFindMissingTriple": return { [HERO_POWER_COUNTER_KEYS.zephrysWishes]: 3 };
    case "cookMinionsForDiscover": return { [HERO_POWER_COUNTER_KEYS.cookPot]: 0, [HERO_POWER_COUNTER_KEYS.cookCount]: 0 };
    case "refreshCopyHighestFreeze": return { [HERO_POWER_COUNTER_KEYS.vardenUsed]: 0 };
    case "activeLockCardUnlockLater": return { [HERO_POWER_COUNTER_KEYS.maievSlots]: 0 };
    case "battlecryPurchasesForBrann": return { [HERO_POWER_COUNTER_KEYS.brannBuys]: 0 };
    case "hatPassesOnSell": return {};
    case "getBloodGemsPerTurn": return { [HERO_POWER_COUNTER_KEYS.blackthornPlays]: 0 };
    case "alternatingStatBuff": return { [HERO_POWER_COUNTER_KEYS.ingeToggle]: 0 };
    case "oncePerGameGolden": return { [HERO_POWER_COUNTER_KEYS.renoUsed]: 0 };
    case "oncePerGameExactCopy": return { [HERO_POWER_COUNTER_KEYS.zerekUsed]: 0 };
    default: return {};
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
      return `下回合已储存${safeCounter(counters, HERO_POWER_COUNTER_KEYS.smartSavingsGold)}枚铸币`;
    case "upgradeDiscountAfterElementals":
      return `已使用${Math.min(2, safeCounter(counters, HERO_POWER_COUNTER_KEYS.chenvaalaElementals))}/3张元素牌`;
    case "tavernCoinAfterThreeMinions":
      return `已购买${Math.min(2, safeCounter(counters, HERO_POWER_COUNTER_KEYS.kaelthasMinions))}/3个随从`;
    case "freeFourthTavernSpell": {
      const p = Math.min(3, safeCounter(counters, HERO_POWER_COUNTER_KEYS.taethelanSpells));
      return p === 3 ? "下一张酒馆法术免费" : `本周期已购买${p}/4张酒馆法术`;
    }
    case "growingTavernSpellBuff": {
      const nr = Math.max(4, safeCounter(counters, HERO_POWER_COUNTER_KEYS.rakanishuTurns, 4));
      const b = Math.max(1, safeCounter(counters, HERO_POWER_COUNTER_KEYS.rakanishuBonus, 1));
      const r = Math.max(0, nr - Math.max(1, Math.trunc(currentRound)));
      return r === 0 ? `酒馆法术额外+${b}/+${b}；本回合提升` : `酒馆法术额外+${b}/+${b}；还剩${r}个回合提升`;
    }
    case "growingTavernBuff": {
      const nb = Math.max(4, safeCounter(counters, HERO_POWER_COUNTER_KEYS.saurfangBuys, 4));
      const bb = Math.max(1, safeCounter(counters, HERO_POWER_COUNTER_KEYS.saurfangBuff, 1));
      const p = Math.min(nb, safeCounter(counters, HERO_POWER_COUNTER_KEYS.saurfangBuys));
      return `酒馆随从+${bb}/+${bb}；购买${p}/${nb}个随从提升`;
    }
    case "buyTierTripleReward": {
      const t = Math.max(0, safeCounter(counters, HERO_POWER_COUNTER_KEYS.guffTiers));
      return t === 0 ? "完成！获取一份三连奖励" : `还需购买总计${t}级卡牌`;
    }
    case "battlecryPurchasesForBrann": {
      const p = Math.min(4, safeCounter(counters, HERO_POWER_COUNTER_KEYS.brannBuys));
      return `已购买${p}/4个战吼随从`;
    }
    case "sellMinionsForRandomMurloc": {
      const remaining = Math.max(0, Math.min(5, safeCounter(counters, HERO_POWER_COUNTER_KEYS.flurglSells, 5)));
      return remaining === 0 ? "获取一个随机鱼人！" : `还需出售${remaining}个随从`;
    }
    case "totalCardsForSulfuras": {
      if (safeCounter(counters, HERO_POWER_COUNTER_KEYS.ragnarosActive)) {
        return "萨弗拉斯已激活：酒馆中的随从+3/+3";
      }
      const progress = safeCounter(counters, HERO_POWER_COUNTER_KEYS.sulfurasCards);
      return `已购买${progress}/16张牌`;
    }
    case "goldPerTurnOnce": {
      if (safeCounter(counters, HERO_POWER_COUNTER_KEYS.kraggUsed)) {
        return "已使用";
      }
      const bonus = Math.max(0, safeCounter(counters, HERO_POWER_COUNTER_KEYS.kraggBonus));
      return `可获得${bonus + 2}枚铸币`;
    }
    default: return null;
  }
}
