// Explicit `.ts` specifiers keep the pure engine directly runnable by Node
// 24's built-in type stripping as well as by the app's Vite bundler.
import {
  CURRENT_ROSTER_VERSION,
  MINION_DEFINITIONS,
  TRIBE_NAMES,
  getMinionDefinition,
} from "./content.ts";
import {
  RIME_OR_REASON_STAT_GRANTING_CARD_IDS,
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellCanTargetShop,
  tavernSpellIsAvailable,
  tavernSpellNeedsTarget,
  tavernSpellPurchaseCurrency,
} from "./tavern-spells.ts";
import {
  SPELLCRAFT_DEFINITIONS,
  getSpellcraftDefinition,
  spellcraftNeedsTarget,
} from "./spellcraft.ts";
import {
  HERO_POWER_DEFINITIONS,
  getHeroPowerDefinition,
} from "./hero-powers.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  normalizeInitialHealth,
} from "./setup.ts";
import {
  aiTargetBoardSize,
  getAiStrategyProfile,
  shouldAiUpgrade,
} from "./ai.ts";
import type {
  AvengeEffect,
  ApplyBloodGemsToTribeEffect,
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemBonusKeyword,
  BloodGemSpellInstance,
  BoardMinionInstance,
  BuffRandomHandMinionEffect,
  BuffEffect,
  CastTavernSpellEffect,
  ConsolationCoinSpellInstance,
  DiscoverDestination,
  DiscoverFilter,
  DynamicWarbandEndOfTurnEffect,
  EndOfTurnEffect,
  GameAction,
  GameActionTrace,
  GameState,
  GameTransition,
  GainBloodGemsEffect,
  GainRandomGeneratedMinionEffect,
  GainRandomTavernSpellEffect,
  GainTavernSpellEffect,
  GetRandomMinionEffect,
  GrantKeywordEffect,
  FriendlyDamageDealtTrigger,
  FriendlyDamagedTrigger,
  FriendlyDeathTrigger,
  HelpfulRefreshKind,
  HeroPowerDefinition,
  HumanScoutingReport,
  ImproveBeetlesEffect,
  ImproveBloodGemsEffect,
  ImproveStartOfCombatBuffEffect,
  ImproveUndeadArmyEffect,
  MagneticAttachment,
  MinionEffect,
  MinionInstance,
  MinionChoiceId,
  PendingCardPlayedEvent,
  PendingDiscoverInteraction,
  TavernSpellChoiceId,
  PlayerId,
  PlayerState,
  QueueDemonFodderEffect,
  RecruitBloodGemPulseResolution,
  RallyCastChefsChoiceEffect,
  RallyGrantSourceAttackEffect,
  RallyGrantSourceMaxHealthEffect,
  RallyGrantVenomousEffect,
  RallyRemoveTargetKeywordsEffect,
  RallyRemovedKeyword,
  RallySummonFromHandEffect,
  RallyTriggerLeftmostDeathrattleEffect,
  ScheduledPairing,
  SpellcraftDefinition,
  SpellcraftSpellInstance,
  StartOfCombatGrowingTribeBuffEffect,
  SummonEffect,
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemBonusKeyword,
  BloodGemSpellInstance,
  BoardMinionInstance,
  ConsolationCoinSpellInstance,
  GameAction,
  GameActionTrace,
  GamePhase,
  GameState,
  GameTransition,
  HandCardInstance,
  HelpfulRefreshKind,
  HeroPowerDefinition,
  HumanScoutingReport,
  MagneticAttachment,
  MinionDefinition,
  MinionEffect,
  MinionInstance,
  PendingInteraction,
  PlayerId,
  PlayerState,
  RecruitBloodGemPulseResolution,
  ScheduledPairing,
  SpellFamily,
  SpellcraftDefinition,
  SpellcraftEffect,
  SpellcraftSpellInstance,
  SpellcraftTarget,
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernSpellTarget,
  TavernTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export {
  HERO_POWER_DEFINITIONS,
  getHeroPowerDefinition,
  isHeroPowerDefinitionId,
} from "./hero-powers.ts";

export {
  AI_STRATEGY_PROFILES,
  aiTargetBoardSize,
  getAiStrategyProfile,
  shouldAiUpgrade,
} from "./ai.ts";

export {
  SPELLCRAFT_DEFINITIONS,
  getSpellcraftDefinition,
  spellcraftNeedsTarget,
} from "./spellcraft.ts";

export {
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellCanTargetShop,
  tavernSpellIsAvailable,
  tavernSpellNeedsTarget,
  tavernSpellPurchaseCurrency,
} from "./tavern-spells.ts";

export const HELPFUL_REFRESH_LABELS: Readonly<
  Record<HelpfulRefreshKind, string>
> = {
  warbandCopies: "战队原始复制",
  legendary: "传说随从",
  golden: "金色随从",
  triple: "凑成三连",
  divineShield: "全员圣盾",
  tavernBuff: "酒馆等级强化",
  majorityTribe: "多数随从类型",
  highTier: "高等级随从",
  allSame: "整页同一随从",
  utility: "功能随从",
  allSpells: "整页酒馆法术",
};

const HUMAN_PLAYER_ID = "player-0";
const PLAYER_NAMES = [
  "你",
  "酒馆老手",
  "机械收藏家",
  "恶魔商人",
  "鱼人侦察兵",
  "龙族学者",
  "海盗船长",
  "野兽驯养师",
] as const;

// Tavern Spells occupy the extra card slot documented in Patch 34.2. The UI
// interleaves that offer with these normal minion offers, as the live game does.
// Patch 23.6 reduced Tier 1 to 15 copies, matching Tier 2; the remaining copy
// counts retain the 13/11/9/7 distribution.
const SHOP_SIZE_BY_TIER = [0, 3, 4, 4, 5, 5, 6] as const;
const UPGRADE_BASE_COST = [0, 5, 7, 8, 11, 12, 0] as const;
const POOL_COPIES_BY_TIER = [0, 15, 15, 13, 11, 9, 7] as const;
const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;
const HELPFUL_REFRESH_KINDS = Object.freeze(
  Object.keys(HELPFUL_REFRESH_LABELS) as HelpfulRefreshKind[],
);
const HELPFUL_UTILITY_MINION_IDS = new Set([
  "BG_DAL_775",
  "BG_LOE_077",
  "BG25_354",
]);
const DEFAULT_SEED = 0x4853544e;
const MAX_BOARD_SIZE = 7;
const MAX_HAND_SIZE = 10;
const BUY_COST = 3;
const REFRESH_COST = 1;
const MAX_COMBAT_ATTACKS = 100;
const TRIPLE_REWARD_CARD_ID = "TB_BaconShop_Triples_01" as const;
const TRIPLE_REWARD_DEFINITION_ID = "triple-reward" as const;
const BLOOD_GEM_CARD_ID = "BG20_GEM" as const;
const BLOOD_GEM_DEFINITION_ID = "blood-gem" as const;
const FEARLESS_FOODIE_DEFINITION_ID = "BG30_123" as const;
const GEOMAGUS_ROOGUG_DEFINITION_ID = "BG28_583" as const;
const COMPOSER_BRISTLEBACK_DEFINITION_ID = "BG26_157" as const;
const BEETLE_TOKEN_DEFINITION_ID = "live-beetle-token" as const;
const CONSOLATION_COIN_CARD_ID = "BG28_521t" as const;
const CONSOLATION_COIN_DEFINITION_ID = "consolation-coin" as const;
const ASTRAL_AUTOMATON_DEFINITION_ID = "BG_TTN_401" as const;
const ETERNAL_KNIGHT_DEFINITION_ID = "BG25_008" as const;
const ANCIENT_SOUL_DEFINITION_ID = "BG34_231" as const;
const ANCIENT_SOUL_DEATHS_REQUIRED = 15;
const UPBEAT_FRONTDRAKE_DEFINITION_ID = "BG26_529" as const;
const UPBEAT_DUO_DEFINITION_ID = "BG26_199" as const;
const HUNGRY_TROG_DEFINITION_ID = "BG35_801" as const;
const CRIMSON_SURVIVOR_DEFINITION_ID = "BG35_814" as const;
const DEMON_FODDER_DEFINITION_ID = "live-demon-fodder-token" as const;
const PERIODIC_TURN_COUNTER = "periodicEndOfTurn";
const PURCHASE_PROGRESS_COUNTER = "cardPurchases";
const CONDITIONAL_KEYWORD_TRIGGERED_COUNTER =
  "conditionalKeywordTriggered";
const GOLD_SPEND_PROGRESS_COUNTER = "goldSpendProgress";
const DYNAMIC_END_OF_TURN_ATTACK_COUNTER = "dynamicEndOfTurnAttack";
const DYNAMIC_END_OF_TURN_HEALTH_COUNTER = "dynamicEndOfTurnHealth";
const DYNAMIC_AVENGE_PROGRESS_COUNTER = "dynamicAvengeProgress";
const START_OF_COMBAT_ATTACK_BONUS_COUNTER = "startOfCombatAttackBonus";
const START_OF_COMBAT_HEALTH_BONUS_COUNTER = "startOfCombatHealthBonus";
const SUMMON_ATTACK_GROWTH_COUNTER = "summonAttackGrowth";
const LOBBY_TRIBES: readonly Tribe[] = [
  "beast",
  "mech",
  "demon",
  "murloc",
  "dragon",
  "pirate",
  "elemental",
  "naga",
  "quilboar",
  "undead",
];

type MutableTier = TavernTier;

interface Pairing {
  playerA: PlayerState;
  playerB: PlayerState;
  isGhost: boolean;
}

interface DeadMinion {
  minion: MinionInstance;
  index: number;
  ownerId: PlayerId;
}

interface MinionEffectSource {
  sourceInstanceId: string;
  definitionId: string;
  golden: boolean;
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function cloneMagneticAttachment(
  attachment: MagneticAttachment,
): MagneticAttachment {
  return {
    ...attachment,
    attachments: attachment.attachments.map(cloneMagneticAttachment),
  };
}

function cloneMinion(minion: MinionInstance): BoardMinionInstance {
  if (minion.kind !== "minion") {
    throw new Error("Only minions can be cloned onto a combat board");
  }
  return {
    ...minion,
    kind: "minion",
    effectCounters: { ...(minion.effectCounters ?? {}) },
    attachments: minion.attachments.map(cloneMagneticAttachment),
  };
}

function cloneBoard(
  board: readonly BoardMinionInstance[],
): BoardMinionInstance[] {
  return board.map(cloneMinion);
}

function collectAttachmentEffectSources(
  attachment: MagneticAttachment,
  sources: MinionEffectSource[],
): void {
  sources.push({
    sourceInstanceId: attachment.sourceInstanceId,
    definitionId: attachment.definitionId,
    golden: attachment.golden,
  });
  for (const nested of attachment.attachments) {
    collectAttachmentEffectSources(nested, sources);
  }
}

function minionEffectSources(
  minion: MinionInstance,
): MinionEffectSource[] {
  const sources: MinionEffectSource[] = [
    {
      sourceInstanceId: minion.instanceId,
      definitionId: minion.definitionId,
      golden: minion.golden,
    },
  ];
  for (const attachment of minion.attachments) {
    collectAttachmentEffectSources(attachment, sources);
  }
  return sources;
}

function minionHasDeathrattle(minion: MinionInstance): boolean {
  return (
    minion.temporaryCrabDeathrattles > 0 ||
    (minion.temporaryGoldenCrabDeathrattles ?? 0) > 0 ||
    minionEffectSources(minion).some(
      (component) => {
        const definition = getMinionDefinition(
          component.definitionId,
        );
        return (
          (definition.deathrattle?.length ?? 0) > 0 ||
          definition.printedMechanics?.includes("DEATHRATTLE") ===
            true
        );
      },
    )
  );
}

function friendlyDeathMatches(
  minion: MinionInstance,
  trigger: FriendlyDeathTrigger,
): boolean {
  return (
    (trigger.tribe === undefined ||
      minionHasTribe(minion, trigger.tribe)) &&
    (trigger.taunt !== true || minion.taunt) &&
    (trigger.deathrattle !== true || minionHasDeathrattle(minion))
  );
}

export function minionHasTribe(
  minion: Pick<BoardMinionInstance, "tribe" | "tribes">,
  tribe: Tribe | undefined,
): boolean {
  if (!tribe || tribe === "neutral") {
    return minion.tribe === "neutral";
  }
  return minion.tribes.includes("all") || minion.tribes.includes(tribe);
}

export function canMagnetize(
  source: BoardMinionInstance,
  target: BoardMinionInstance,
): boolean {
  if (source.instanceId === target.instanceId) {
    return false;
  }
  const magnetic = getMinionDefinition(source.definitionId).magnetic;
  return (
    magnetic !== undefined &&
    magnetic.targetTribes.some((tribe) =>
      minionHasTribe(target, tribe),
    )
  );
}

function definitionIsAvailable(
  definition: (typeof MINION_DEFINITIONS)[number],
  activeTribes: readonly Tribe[],
): boolean {
  if (definition.collectible === false) {
    return false;
  }
  const cardTribes =
    definition.tribes ??
    (definition.tribe === "neutral" ? [] : [definition.tribe]);
  const associatedTribes = definition.associatedTribes ?? [];
  if (
    cardTribes.length === 0 &&
    associatedTribes.length === 0
  ) {
    return true;
  }
  if (cardTribes.includes("all")) {
    return true;
  }
  return [...cardTribes, ...associatedTribes].some((tribe) =>
    activeTribes.includes(tribe),
  );
}

function normalizeSeed(seed: number | undefined): number {
  if (seed === undefined || !Number.isFinite(seed)) {
    return DEFAULT_SEED;
  }
  const normalized = seed >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

/** xorshift32: small, fast, serializable, and deterministic on JS bitwise ops. */
function nextRandom(state: GameState): number {
  let value = state.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 0x1_0000_0000;
}

function randomIndex(state: GameState, length: number): number {
  if (length <= 1) {
    return 0;
  }
  return Math.floor(nextRandom(state) * length);
}

function shuffleInPlace<T>(state: GameState, values: T[]): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(state, index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function findPlayer(
  state: GameState,
  playerId: PlayerId,
): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

function humanPlayer(state: GameState): PlayerState {
  const player = findPlayer(state, state.humanPlayerId);
  if (!player) {
    throw new Error("Game state has no human player");
  }
  return player;
}

interface HeroDamageResult {
  armorAbsorbed: number;
  healthDamage: number;
}

function damagePlayer(
  player: PlayerState,
  amount: number,
): HeroDamageResult {
  const safeAmount = Math.max(0, amount);
  const armorAbsorbed = Math.min(player.armor, safeAmount);
  const healthDamage = safeAmount - armorAbsorbed;
  player.armor -= armorAbsorbed;
  player.health -= healthDamage;
  return { armorAbsorbed, healthDamage };
}

function playerHasHeroPower(
  player: PlayerState,
  effect: HeroPowerDefinition["effect"],
): boolean {
  return (
    player.heroPowerId !== null &&
    getHeroPowerDefinition(player.heroPowerId).effect === effect
  );
}

function initialEffectCounters(
  definitionId: string,
): Record<string, number> {
  if (definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID) {
    return { [PERIODIC_TURN_COUNTER]: 3 };
  }
  if (definitionId === UPBEAT_DUO_DEFINITION_ID) {
    return { [PERIODIC_TURN_COUNTER]: 2 };
  }
  if (definitionId === HUNGRY_TROG_DEFINITION_ID) {
    return { [PURCHASE_PROGRESS_COUNTER]: 0 };
  }
  return {};
}

function createMinionInstance(
  state: GameState,
  definitionId: string,
  poolCopies: number,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const instance: BoardMinionInstance = {
    kind: "minion",
    instanceId: `minion-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack,
    health: definition.health,
    golden: false,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    stealth: definition.stealth === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: initialEffectCounters(definition.id),
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies,
    attachments: [],
  };
  state.nextInstanceId += 1;
  refreshDynamicMinionDescription(instance);
  return instance;
}

function describeGoldenMinion(description: string): string {
  return `金色随从：基础属性已翻倍；可倍增的效果会按金色规则结算。普通版本牌面：${description}`;
}

function goldenMinionDescription(definitionId: string): string {
  const definition = getMinionDefinition(definitionId);
  return (
    definition.goldenDescription ??
    describeGoldenMinion(definition.description)
  );
}

function effectCounter(
  minion: MinionInstance,
  key: string,
  fallback: number,
): number {
  return minion.effectCounters?.[key] ?? fallback;
}

function setEffectCounter(
  minion: MinionInstance,
  key: string,
  value: number,
): void {
  minion.effectCounters ??= {};
  minion.effectCounters[key] = value;
}

function refreshDynamicMinionDescription(
  minion: MinionInstance,
  player?: PlayerState,
): void {
  const definition = getMinionDefinition(minion.definitionId);
  const goldSpendTrigger = definition.afterGoldSpent;
  if (goldSpendTrigger) {
    const progress =
      effectCounter(minion, GOLD_SPEND_PROGRESS_COUNTER, 0) %
      goldSpendTrigger.threshold;
    const remaining = Math.max(
      1,
      goldSpendTrigger.threshold - progress,
    );
    const printedDescription = minion.golden
      ? goldenMinionDescription(minion.definitionId)
      : definition.description;
    const status = `（还剩${remaining}枚！）`;
    minion.description = /（还剩\d+枚！）/.test(printedDescription)
      ? printedDescription.replace(/（还剩\d+枚！）/, status)
      : `${printedDescription}${status}`;
    return;
  }
  const growingStartOfCombat = definition.startOfCombat?.find(
    (effect) => effect.kind === "growingTribeBuff",
  );
  if (growingStartOfCombat?.kind === "growingTribeBuff") {
    const scale =
      minion.golden &&
      growingStartOfCombat.goldenMode === "doubleStats"
        ? 2
        : 1;
    const attack =
      growingStartOfCombat.attack * scale +
      effectCounter(
        minion,
        START_OF_COMBAT_ATTACK_BONUS_COUNTER,
        0,
      );
    const health =
      growingStartOfCombat.health * scale +
      effectCounter(
        minion,
        START_OF_COMBAT_HEALTH_BONUS_COUNTER,
        0,
      );
    minion.description =
      `战斗开始时：使你的龙获得+${attack}/+${health}。` +
      "在你施放一个酒馆法术后永久提升此效果。";
    return;
  }
  const growingSummon = definition.afterFriendlySummoned;
  if (growingSummon?.permanentAttackGrowth !== undefined) {
    const scale = minion.golden ? 2 : 1;
    const attack =
      (growingSummon.attack ?? 0) * scale +
      effectCounter(minion, SUMMON_ATTACK_GROWTH_COUNTER, 0);
    minion.description =
      `每当你召唤${TRIBE_NAMES[growingSummon.tribe]}时，使其获得+${attack}攻击力` +
      "并永久提升此效果。";
    return;
  }
  const dynamicEndOfTurn = definition.endOfTurn;
  if (dynamicEndOfTurn?.kind === "dynamicWarbandEndOfTurn") {
    const scale = minion.golden ? 2 : 1;
    const attack =
      dynamicEndOfTurn.attack * scale +
      effectCounter(
        minion,
        DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
        0,
      );
    const health =
      dynamicEndOfTurn.health * scale +
      effectCounter(
        minion,
        DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
        0,
      );
    minion.description =
      `在你的回合结束时，使你的随从获得+${attack}/+${health}。` +
      `复仇（${dynamicEndOfTurn.avengeThreshold}）：永久提升此效果。`;
    return;
  }
  if (
    dynamicEndOfTurn?.kind ===
      "leftmostTribeRepeatPerCardPlayed" &&
    player
  ) {
    const scale = minion.golden ? 2 : 1;
    minion.description =
      `在你的回合结束时，使你最左边的海盗获得+` +
      `${dynamicEndOfTurn.attack * scale}/+` +
      `${dynamicEndOfTurn.health * scale}。在本回合中你每使用过一张牌，` +
      `重复一次。（重复${player.cardsPlayedThisTurn}次）`;
    return;
  }
  if (minion.definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID) {
    const remaining = Math.max(
      1,
      effectCounter(minion, PERIODIC_TURN_COUNTER, 3),
    );
    const reward = minion.golden ? "2张龙牌" : "一张龙牌";
    const status =
      remaining === 1
        ? "（就是这回合！）"
        : `（还剩${remaining}回合！）`;
    minion.description = `每3个回合，在回合结束时，随机获取${reward}。${status}`;
    return;
  }
  if (minion.definitionId === UPBEAT_DUO_DEFINITION_ID) {
    const remaining = Math.max(
      1,
      effectCounter(minion, PERIODIC_TURN_COUNTER, 2),
    );
    const status =
      remaining === 1
        ? "（就是这回合！）"
        : `（还剩${remaining}回合！）`;
    minion.description =
      minion.golden
        ? `每2个回合，在回合结束时，获取本随从相邻随从各一张原始版复制。${status}`
        : `每2个回合，在回合结束时，获取一张本随从左边随从的原始版复制。${status}`;
    return;
  }
  if (minion.definitionId === HUNGRY_TROG_DEFINITION_ID) {
    const definition = getMinionDefinition(minion.definitionId);
    const purchases = effectCounter(
      minion,
      PURCHASE_PROGRESS_COUNTER,
      0,
    );
    const required = definition.afterCardPurchased?.purchases ?? 4;
    const stats = minion.golden ? "+8/+8" : "+4/+4";
    const status =
      purchases < 0
        ? "（已完成！）"
        : `（还剩${Math.max(0, required - purchases)}张！）`;
    minion.description = `一旦你购买了${required}张牌，获得${stats}。${status}`;
    return;
  }
  if (
    minion.definitionId === CRIMSON_SURVIVOR_DEFINITION_ID &&
    (effectCounter(
      minion,
      CONDITIONAL_KEYWORD_TRIGGERED_COUNTER,
      0,
    ) > 0 ||
      (minion.divineShield && minion.attack >= 6))
  ) {
    minion.description =
      "一旦本随从的攻击力达到6点，获得圣盾。（已完成！）";
  }
}

function makeGoldenToken(
  minion: BoardMinionInstance,
): BoardMinionInstance {
  if (minion.golden) {
    return minion;
  }
  const definition = getMinionDefinition(minion.definitionId);
  minion.golden = true;
  minion.cardId = definition.goldenCardId ?? definition.cardId;
  minion.name = `金色·${definition.name}`;
  minion.attack *= 2;
  minion.health *= 2;
  minion.sellValue =
    definition.goldenSellValue ?? minion.sellValue;
  minion.description = goldenMinionDescription(definition.id);
  if (definition.id === ANCIENT_SOUL_DEFINITION_ID) {
    minion.ancientSoulFriendlyDeaths = ANCIENT_SOUL_DEATHS_REQUIRED;
  }
  refreshDynamicMinionDescription(minion);
  return minion;
}

function makeMinionGoldenPreservingEnchantments(
  minion: MinionInstance,
): MinionInstance {
  if (minion.golden) {
    return minion;
  }
  const definition = getMinionDefinition(minion.definitionId);
  minion.golden = true;
  minion.cardId = definition.goldenCardId ?? definition.cardId;
  minion.name = `金色·${definition.name}`;
  // Golden Touch and Eyes of the Earth Mother add the second copy of the
  // printed base stats. Existing
  // Tavern buffs and enchantments are retained once rather than doubled.
  minion.attack += definition.attack;
  minion.health += definition.health;
  minion.sellValue =
    definition.goldenSellValue ?? minion.sellValue;
  minion.description = goldenMinionDescription(definition.id);
  minion.grantsTripleReward = false;
  if (definition.id === ANCIENT_SOUL_DEFINITION_ID) {
    minion.ancientSoulFriendlyDeaths = ANCIENT_SOUL_DEATHS_REQUIRED;
  }
  refreshDynamicMinionDescription(minion);
  return minion;
}

function createTripleRewardSpell(
  state: GameState,
  tavernTier: TavernTier,
): TripleRewardSpellInstance {
  const rewardTier = Math.min(6, tavernTier + 1) as TavernTier;
  const instance: TripleRewardSpellInstance = {
    kind: "tripleReward",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: TRIPLE_REWARD_DEFINITION_ID,
    cardId: TRIPLE_REWARD_CARD_ID,
    name: "三连奖励",
    tier: rewardTier,
    tribe: "neutral",
    tribes: [],
    associatedTribes: [],
    effectSupport: "complete",
    sellValue: 0,
    attack: 0,
    health: 0,
    golden: false,
    taunt: false,
    divineShield: false,
    reborn: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    cleave: false,
    alwaysAttacksLowestAttack: false,
    description: `发现一个 ${rewardTier} 级随从。`,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
  };
  state.nextInstanceId += 1;
  return instance;
}

function grantTripleRewardBeforeGeneratedCards(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (!minion.grantsTripleReward) {
    return;
  }
  minion.grantsTripleReward = false;
  if (player.hand.length < MAX_HAND_SIZE) {
    player.hand.push(
      createTripleRewardSpell(state, player.tavernTier),
    );
  }
}

function bloodGemBonusDescription(
  bonusKeyword: BloodGemBonusKeyword | undefined,
): string {
  switch (bonusKeyword) {
    case "rebornForQuilboar":
      return "如果目标是野猪人，还会使其获得复生。";
    case "divineShieldForQuilboar":
      return "如果目标是野猪人，还会使其获得圣盾。";
    default:
      return "";
  }
}

function createBloodGemSpell(
  state: GameState,
  bonusKeyword?: BloodGemBonusKeyword,
): BloodGemSpellInstance {
  const instance: BloodGemSpellInstance = {
    kind: "bloodGem",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: BLOOD_GEM_DEFINITION_ID,
    cardId: BLOOD_GEM_CARD_ID,
    name: "鲜血宝石",
    description: `使一个友方随从获得+1/+1。${bloodGemBonusDescription(
      bonusKeyword,
    )}`,
    spellFamily: "bloodGem",
    ...(bonusKeyword ? { bonusKeyword } : {}),
  };
  state.nextInstanceId += 1;
  return instance;
}

function createConsolationCoin(
  state: GameState,
): ConsolationCoinSpellInstance {
  const instance: ConsolationCoinSpellInstance = {
    kind: "consolationCoin",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: CONSOLATION_COIN_DEFINITION_ID,
    cardId: CONSOLATION_COIN_CARD_ID,
    name: "补贴铸币",
    description: "获得1枚铸币。（没有有效随从。）",
    spellFamily: "coin",
  };
  state.nextInstanceId += 1;
  return instance;
}

function createSpellcraftSpell(
  state: GameState,
  definition: SpellcraftDefinition,
  golden = false,
): SpellcraftSpellInstance {
  const instance: SpellcraftSpellInstance = {
    kind: "spellcraft",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId:
      golden && definition.goldenCardId
        ? definition.goldenCardId
        : definition.cardId,
    name: definition.name,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    spellFamily: "spellcraft",
    target: definition.target,
    effectMultiplier: golden ? 2 : 1,
  };
  state.nextInstanceId += 1;
  return instance;
}

function createTavernSpell(
  state: GameState,
  definition: TavernSpellDefinition,
): TavernSpellInstance {
  const instance: TavernSpellInstance = {
    kind: "tavernSpell",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
  state.nextInstanceId += 1;
  return instance;
}

function drawTavernSpell(
  state: GameState,
  tavernTier: TavernTier,
  excludedDefinitionIds: ReadonlySet<string> = new Set(),
): TavernSpellInstance | null {
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= tavernTier &&
      !excludedDefinitionIds.has(definition.id) &&
      tavernSpellIsAvailable(definition, state.activeTribes) &&
      (state.spellPool[definition.id] ?? 0) > 0,
  );
  const totalCopies = eligible.reduce(
    (total, definition) =>
      total + (state.spellPool[definition.id] ?? 0),
    0,
  );
  if (totalCopies <= 0) {
    return null;
  }
  let roll = Math.floor(nextRandom(state) * totalCopies);
  let definition = eligible[0];
  for (const candidate of eligible) {
    const copies = state.spellPool[candidate.id] ?? 0;
    if (roll < copies) {
      definition = candidate;
      break;
    }
    roll -= copies;
  }
  state.spellPool[definition.id] -= 1;
  return createTavernSpell(state, definition);
}

function randomGeneratedTavernSpellDefinition(
  state: GameState,
  effect: GainRandomTavernSpellEffect,
): TavernSpellDefinition | null {
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      (effect.filter.definitionIds === undefined ||
        effect.filter.definitionIds.includes(definition.id)) &&
      (effect.filter.cost === undefined ||
        definition.cost === effect.filter.cost) &&
      (effect.filter.exactTier === undefined ||
        definition.tier === effect.filter.exactTier) &&
      tavernSpellIsAvailable(definition, state.activeTribes),
  );
  return eligible.length === 0
    ? null
    : eligible[randomIndex(state, eligible.length)];
}

function addBloodGems(
  state: GameState,
  player: PlayerState,
  count: number,
  bonusKeyword?: BloodGemBonusKeyword,
): number {
  let added = 0;
  for (
    let index = 0;
    index < count && player.hand.length < MAX_HAND_SIZE;
    index += 1
  ) {
    player.hand.push(createBloodGemSpell(state, bonusKeyword));
    added += 1;
  }
  return added;
}

function addConsolationCoin(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  player.hand.push(createConsolationCoin(state));
  return true;
}

function addRandomSpellcraftSpells(
  state: GameState,
  player: PlayerState,
  count: number,
): number {
  const eligible = SPELLCRAFT_DEFINITIONS.filter(
    (definition) => definition.sourceTier <= player.tavernTier,
  );
  let added = 0;
  while (
    added < count &&
    player.hand.length < MAX_HAND_SIZE &&
    eligible.length > 0
  ) {
    const definition = eligible[randomIndex(state, eligible.length)];
    player.hand.push(createSpellcraftSpell(state, definition));
    added += 1;
  }
  return added;
}

function addMinionSpellcraft(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  component: MinionEffectSource,
): boolean {
  const spellcraft =
    getMinionDefinition(component.definitionId).spellcraft;
  if (!spellcraft) {
    return false;
  }
  player.pendingSpellcraft.push({
    sourceInstanceId,
    definitionId: spellcraft.definitionId,
    golden: component.golden,
    round: state.round,
  });
  flushPendingSpellcraft(state, player);
  return true;
}

function flushPendingSpellcraft(
  state: GameState,
  player: PlayerState,
): void {
  player.pendingSpellcraft = player.pendingSpellcraft.filter(
    (pending) => {
      if (pending.round !== state.round) {
        return false;
      }
      const source = player.board.find(
        (minion) => minion.instanceId === pending.sourceInstanceId,
      );
      return (
        source !== undefined &&
        minionEffectSources(source).some(
          (component) =>
            getMinionDefinition(component.definitionId).spellcraft
              ?.definitionId === pending.definitionId,
        )
      );
    },
  );
  while (
    player.hand.length < MAX_HAND_SIZE &&
    player.pendingSpellcraft.length > 0
  ) {
    const pending = player.pendingSpellcraft.shift();
    if (!pending) {
      break;
    }
    player.hand.push(
      createSpellcraftSpell(
        state,
        getSpellcraftDefinition(pending.definitionId),
        pending.golden,
      ),
    );
  }
}

function grantPlayedMinionSpellcraft(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  for (const component of minionEffectSources(minion)) {
    addMinionSpellcraft(
      state,
      player,
      minion.instanceId,
      component,
    );
  }
}

function applyBloodGemStats(
  target: BoardMinionInstance,
  attack: number,
  health: number,
): void {
  target.attack += attack;
  target.health += health;
  target.bloodGemAttack += attack;
  target.bloodGemHealth += health;
  reconcileConditionalMinion(target);
}

function bloodGemFromHandExtraCasts(player: PlayerState): number {
  return bloodGemHandCastMultiplier(player.board) - 1;
}

function minionHasEffectSource(
  minion: MinionInstance,
  definitionId: string,
): boolean {
  return minionEffectSources(minion).some(
    (component) => component.definitionId === definitionId,
  );
}

interface RecruitBloodGemPulseOptions {
  bonusKeyword?: BloodGemBonusKeyword;
  origin?: RecruitBloodGemPulseResolution["origin"];
  sourceInstanceId?: string;
  triggerObservers?: boolean;
}

function applyBloodGemBonusKeyword(
  target: BoardMinionInstance,
  bonusKeyword: BloodGemBonusKeyword | undefined,
): void {
  if (!minionHasTribe(target, "quilboar")) {
    return;
  }
  if (bonusKeyword === "rebornForQuilboar") {
    target.reborn = true;
  } else if (bonusKeyword === "divineShieldForQuilboar") {
    target.divineShield = true;
    target.temporaryDivineShield = false;
  }
}

function triggerRecruitBloodGemObservers(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
  trace?: GameActionTrace,
): void {
  for (const component of minionEffectSources(target)) {
    const effect = getMinionDefinition(
      component.definitionId,
    ).afterBloodGemCastOnSelf;
    if (
      effect?.kind !== "playBloodGemsOnRandomOther" ||
      !player.board.some(
        (minion) => minion.instanceId === target.instanceId,
      )
    ) {
      continue;
    }
    const candidates = player.board.filter(
      (candidate) =>
        candidate.instanceId !== target.instanceId &&
        !minionHasEffectSource(
          candidate,
          GEOMAGUS_ROOGUG_DEFINITION_ID,
        ),
    );
    if (candidates.length === 0) {
      continue;
    }
    const selected =
      candidates[randomIndex(state, candidates.length)];
    const count =
      effect.count *
      (component.golden && effect.goldenMode === "doubleCount"
        ? 2
        : 1);
    for (let application = 0; application < count; application += 1) {
      applyRecruitBloodGemPulse(
        state,
        player,
        selected,
        {
          origin: "roogug",
          sourceInstanceId: component.sourceInstanceId,
        },
        trace,
      );
    }
  }
}

function applyRecruitBloodGemPulse(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
  options: RecruitBloodGemPulseOptions = {},
  trace?: GameActionTrace,
): void {
  const targetBefore =
    trace && options.origin && options.sourceInstanceId
      ? cloneMinion(target)
      : null;
  applyBloodGemStats(
    target,
    player.bloodGemAttack,
    player.bloodGemHealth,
  );
  applyBloodGemBonusKeyword(target, options.bonusKeyword);
  if (targetBefore && trace && options.origin && options.sourceInstanceId) {
    const gainedKeywords: RecruitBloodGemPulseResolution["gainedKeywords"] =
      [];
    if (!targetBefore.divineShield && target.divineShield) {
      gainedKeywords.push("divineShield");
    }
    if (!targetBefore.reborn && target.reborn) {
      gainedKeywords.push("reborn");
    }
    trace.recruitBloodGemPulses.push({
      origin: options.origin,
      sourceInstanceId: options.sourceInstanceId,
      targetInstanceId: target.instanceId,
      attackDelta: player.bloodGemAttack,
      healthDelta: player.bloodGemHealth,
      gainedKeywords,
      targetBefore,
      targetAfter: cloneMinion(target),
    });
  }
  if (options.triggerObservers !== false) {
    triggerRecruitBloodGemObservers(state, player, target, trace);
  }
}

function nextInteractionId(state: GameState): string {
  const interactionId = `interaction-${state.nextInteractionId}`;
  state.nextInteractionId += 1;
  return interactionId;
}

function returnAttachmentToPool(
  state: GameState,
  attachment: MagneticAttachment,
): void {
  if (attachment.poolCopies > 0) {
    state.pool[attachment.definitionId] =
      (state.pool[attachment.definitionId] ?? 0) +
      attachment.poolCopies;
  }
  for (const nested of attachment.attachments) {
    returnAttachmentToPool(state, nested);
  }
}

function returnMinionToPool(state: GameState, minion: MinionInstance): void {
  if (minion.poolCopies > 0) {
    state.pool[minion.definitionId] =
      (state.pool[minion.definitionId] ?? 0) + minion.poolCopies;
  }
  for (const attachment of minion.attachments) {
    returnAttachmentToPool(state, attachment);
  }
}

function claimGeneratedShopMinion(minion: BoardMinionInstance): void {
  if ((minion.poolCopiesOnPurchase ?? 0) > 0) {
    minion.poolCopies += minion.poolCopiesOnPurchase ?? 0;
    delete minion.poolCopiesOnPurchase;
  }
}

function clearAttachmentPoolCopies(
  attachment: MagneticAttachment,
): MagneticAttachment {
  return {
    ...attachment,
    poolCopies: 0,
    attachments: attachment.attachments.map(clearAttachmentPoolCopies),
  };
}

function attachmentGrantedStats(
  attachment: MagneticAttachment,
): { attack: number; health: number } {
  return attachment.attachments.reduce(
    (total, nested) => {
      const nestedStats = attachmentGrantedStats(nested);
      return {
        attack:
          total.attack + nested.attackGranted + nestedStats.attack,
        health:
          total.health + nested.healthGranted + nestedStats.health,
      };
    },
    { attack: 0, health: 0 },
  );
}

function createMagneticAttachment(
  source: BoardMinionInstance,
): MagneticAttachment {
  const nestedStats = source.attachments.reduce(
    (total, attachment) => {
      const descendantStats = attachmentGrantedStats(attachment);
      return {
        attack:
          total.attack +
          attachment.attackGranted +
          descendantStats.attack,
        health:
          total.health +
          attachment.healthGranted +
          descendantStats.health,
      };
    },
    { attack: 0, health: 0 },
  );
  return {
    sourceInstanceId: source.instanceId,
    definitionId: source.definitionId,
    cardId: source.cardId,
    name: source.name,
    description: source.description,
    effectSupport: source.effectSupport,
    golden: source.golden,
    poolCopies: 0,
    attackGranted:
      source.attack -
      source.temporaryAttack -
      nestedStats.attack,
    healthGranted:
      source.health -
      source.temporaryHealth -
      nestedStats.health,
    attachments: source.attachments.map(clearAttachmentPoolCopies),
  };
}

function drawMatchingFromPool(
  state: GameState,
  tavernTier: MutableTier,
  matches: (
    definition: (typeof MINION_DEFINITIONS)[number],
  ) => boolean,
): BoardMinionInstance | null {
  const eligible = MINION_DEFINITIONS.filter(
    (definition) =>
      definitionIsAvailable(definition, state.activeTribes) &&
      definition.tier <= tavernTier &&
      (state.pool[definition.id] ?? 0) > 0 &&
      matches(definition),
  );
  let totalCopies = 0;
  for (const definition of eligible) {
    totalCopies += state.pool[definition.id] ?? 0;
  }
  if (totalCopies <= 0) {
    return null;
  }

  let roll = Math.floor(nextRandom(state) * totalCopies);
  for (const definition of eligible) {
    const copies = state.pool[definition.id] ?? 0;
    if (roll < copies) {
      state.pool[definition.id] = copies - 1;
      return createMinionInstance(state, definition.id, 1);
    }
    roll -= copies;
  }
  return null;
}

function drawFromPool(
  state: GameState,
  tavernTier: MutableTier,
): BoardMinionInstance | null {
  return drawMatchingFromPool(state, tavernTier, () => true);
}

function definitionHasTribe(
  definition: (typeof MINION_DEFINITIONS)[number],
  tribe: Tribe,
): boolean {
  const tribes =
    definition.tribes ??
    (definition.tribe === "neutral" ? [] : [definition.tribe]);
  return tribes.includes("all") || tribes.includes(tribe);
}

function matchesGetRandomMinionEffect(
  definition: (typeof MINION_DEFINITIONS)[number],
  effect: GetRandomMinionEffect,
): boolean {
  return (
    (effect.filter.tribe === undefined ||
      definitionHasTribe(definition, effect.filter.tribe)) &&
    (effect.filter.magnetic !== true ||
      definition.magnetic !== undefined) &&
    (effect.filter.battlecry !== true ||
      definition.battlecry !== undefined ||
      definition.interactiveBattlecry !== undefined ||
      definition.printedMechanics?.includes("BATTLECRY") === true) &&
    (effect.filter.exactTier === undefined ||
      definition.tier === effect.filter.exactTier)
  );
}

function reserveDiscoverOptions(
  state: GameState,
  filter: DiscoverFilter,
): BoardMinionInstance[] {
  const candidates = MINION_DEFINITIONS.filter((definition) => {
    if (
      !definitionIsAvailable(definition, state.activeTribes) ||
      (state.pool[definition.id] ?? 0) <= 0
    ) {
      return false;
    }
    if (
      filter.exactTier !== undefined &&
      definition.tier !== filter.exactTier
    ) {
      return false;
    }
    if (
      filter.maximumTier !== undefined &&
      definition.tier > filter.maximumTier
    ) {
      return false;
    }
    if (
      filter.ability === "battlecry" &&
      !definition.printedMechanics?.includes("BATTLECRY")
    ) {
      return false;
    }
    if (
      filter.ability === "deathrattle" &&
      !definition.printedMechanics?.includes("DEATHRATTLE")
    ) {
      return false;
    }
    return (
      filter.tribe === undefined ||
      definitionHasTribe(definition, filter.tribe)
    );
  });
  const options: BoardMinionInstance[] = [];
  while (candidates.length > 0 && options.length < 3) {
    const totalCopies = candidates.reduce(
      (total, definition) => total + (state.pool[definition.id] ?? 0),
      0,
    );
    if (totalCopies <= 0) {
      break;
    }
    let roll = Math.floor(nextRandom(state) * totalCopies);
    let candidateIndex = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const copies = state.pool[candidates[index].id] ?? 0;
      if (roll < copies) {
        candidateIndex = index;
        break;
      }
      roll -= copies;
    }
    const [definition] = candidates.splice(candidateIndex, 1);
    state.pool[definition.id] -= 1;
    options.push(createMinionInstance(state, definition.id, 1));
  }
  return options;
}

function tavernSpellShopOffers(
  player: PlayerState,
): TavernSpellInstance[] {
  return [
    ...(player.spellShop ? [player.spellShop] : []),
    ...player.additionalSpellShop,
  ];
}

function releaseShop(state: GameState, player: PlayerState): void {
  for (const minion of player.shop) {
    returnMinionToPool(state, minion);
  }
  player.shop = [];
  for (const spell of tavernSpellShopOffers(player)) {
    state.spellPool[spell.definitionId] =
      (state.spellPool[spell.definitionId] ?? 0) + 1;
  }
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
}

function applyPersistentTavernBonuses(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  const matchingBuffs = player.tavernTypeBuffs.filter(
    (buff) =>
      buff.tribes.length > 0 &&
      (minion.tribes.includes("all") ||
        buff.tribes.some((tribe) => minionHasTribe(minion, tribe))),
  );
  const matchingTierBuffs = player.tavernTierBuffs.filter(
    (buff) => minion.tier <= buff.maximumTier,
  );
  buffMinions(
    [minion],
    player.tavernMinionAttackBonus +
      matchingBuffs.reduce((total, buff) => total + buff.attack, 0) +
      matchingTierBuffs.reduce(
        (total, buff) => total + buff.attack,
        0,
      ),
    player.tavernMinionHealthBonus +
      matchingBuffs.reduce((total, buff) => total + buff.health, 0) +
      matchingTierBuffs.reduce(
        (total, buff) => total + buff.health,
        0,
      ),
  );
}

function applyOwnedUndeadArmyBonus(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (!minionHasTribe(minion, "undead")) {
    return;
  }
  minion.attack += player.undeadArmyAttackBonus;
  minion.health += player.undeadArmyHealthBonus;
}

function applyOwnedBeetleBonus(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (!isBeetleToken(minion)) {
    return;
  }
  minion.attack += player.beetleAttackBonus;
  minion.health += player.beetleHealthBonus;
}

function ancientSoulDescription(remainingDeaths: number): string {
  return `当本随从在你手牌中时，在15个友方随从死亡后，将本随从变为金色。（还剩${Math.max(
    0,
    remainingDeaths,
  )}个！）`;
}

function refreshAncientSoulDescription(
  minion: MinionInstance,
): void {
  if (minion.definitionId !== ANCIENT_SOUL_DEFINITION_ID) {
    return;
  }
  if (minion.golden) {
    minion.description = goldenMinionDescription(minion.definitionId);
    return;
  }
  minion.description = ancientSoulDescription(
    ANCIENT_SOUL_DEATHS_REQUIRED -
      (minion.ancientSoulFriendlyDeaths ?? 0),
  );
}

function desiredWhereverBonuses(
  minion: MinionInstance,
  astralAutomatonsSummoned: number,
  eternalKnightsDied: number,
): { attack: number; health: number } {
  if (minion.definitionId === ASTRAL_AUTOMATON_DEFINITION_ID) {
    const otherSummons = Math.max(
      0,
      astralAutomatonsSummoned -
        (minion.astralAutomatonSummoned === true ? 1 : 0),
    );
    return minion.golden
      ? { attack: otherSummons * 6, health: otherSummons * 4 }
      : { attack: otherSummons * 3, health: otherSummons * 2 };
  }
  if (minion.definitionId === ETERNAL_KNIGHT_DEFINITION_ID) {
    return minion.golden
      ? { attack: eternalKnightsDied * 8, health: eternalKnightsDied * 4 }
      : { attack: eternalKnightsDied * 4, health: eternalKnightsDied * 2 };
  }
  return { attack: 0, health: 0 };
}

function reconcileWhereverMinion(
  minion: MinionInstance,
  astralAutomatonsSummoned: number,
  eternalKnightsDied: number,
): { attack: number; health: number } {
  const desired = desiredWhereverBonuses(
    minion,
    astralAutomatonsSummoned,
    eternalKnightsDied,
  );
  const attackDelta =
    desired.attack - (minion.whereverAttackBonus ?? 0);
  const healthDelta =
    desired.health - (minion.whereverHealthBonus ?? 0);
  minion.attack += attackDelta;
  minion.health += healthDelta;
  minion.whereverAttackBonus = desired.attack;
  minion.whereverHealthBonus = desired.health;
  refreshAncientSoulDescription(minion);
  return { attack: attackDelta, health: healthDelta };
}

function ownedMinionCards(player: PlayerState): BoardMinionInstance[] {
  return [
    ...player.board,
    ...player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
    ...player.shop,
  ];
}

function beginCardPlayed(
  player: PlayerState,
  event: PendingCardPlayedEvent,
): void {
  player.pendingCardPlayed = {
    ...event,
    tribes: [...event.tribes],
  };
}

function playedCardMatches(
  event: PendingCardPlayedEvent,
  filter: {
    tribe?: Tribe;
    tierParity?: "odd" | "even";
    maximumTier?: TavernTier;
  },
): boolean {
  if (
    filter.tribe !== undefined &&
    (event.cardKind !== "minion" ||
      (!event.tribes.includes("all") &&
        !event.tribes.includes(filter.tribe)))
  ) {
    return false;
  }
  if (
    filter.tierParity !== undefined &&
    (event.tier === undefined ||
      (filter.tierParity === "odd"
        ? event.tier % 2 !== 1
        : event.tier % 2 !== 0))
  ) {
    return false;
  }
  return !(
    filter.maximumTier !== undefined &&
    (event.tier === undefined || event.tier > filter.maximumTier)
  );
}

function finishCardPlayed(
  state: GameState,
  player: PlayerState,
): void {
  const event = player.pendingCardPlayed;
  if (!event) {
    return;
  }
  player.pendingCardPlayed = null;
  player.cardsPlayedThisTurn += 1;

  if (
    event.cardKind === "minion" &&
    event.tribe !== undefined
  ) {
    applyAfterFriendlyPlayed(state, player, {
      instanceId: event.sourceInstanceId,
      tribe: event.tribe,
      tribes: event.tribes,
    });
  }

  for (const watcher of [...player.board]) {
    if (watcher.instanceId === event.sourceInstanceId) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger =
        getMinionDefinition(component.definitionId).afterCardPlayed;
      if (!trigger || !playedCardMatches(event, trigger.filter)) {
        continue;
      }
      applyRecruitEffects(
        state,
        player,
        watcher,
        trigger.effects,
        component.golden ? 2 : 1,
      );
    }
  }

  const handWatchers = player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  for (const watcher of handWatchers) {
    const trigger =
      getMinionDefinition(watcher.definitionId).inHandAfterCardPlayed;
    if (!trigger || !playedCardMatches(event, trigger.filter)) {
      continue;
    }
    applyRecruitEffects(
      state,
      player,
      watcher,
      trigger.effects,
      watcher.golden ? 2 : 1,
    );
  }

  for (const minion of ownedMinionCards(player)) {
    refreshDynamicMinionDescription(minion, player);
  }

  if (event.cardKind === "minion") {
    resolveTriples(state, player);
    resolveStirTheGraveyardDeath(
      state,
      player,
      event.sourceInstanceId,
    );
  }
}

function spendGold(
  state: GameState,
  player: PlayerState,
  amount: number,
): boolean {
  if (amount <= 0) {
    return true;
  }
  if (player.gold < amount) {
    return false;
  }
  player.gold -= amount;
  player.goldSpentThisTurn += amount;

  for (const source of [...player.board]) {
    const trigger =
      getMinionDefinition(source.definitionId).afterGoldSpent;
    if (!trigger || trigger.threshold <= 0) {
      continue;
    }
    const progress = effectCounter(
      source,
      GOLD_SPEND_PROGRESS_COUNTER,
      0,
    );
    const total = progress + amount;
    const triggerCount = Math.floor(total / trigger.threshold);
    setEffectCounter(
      source,
      GOLD_SPEND_PROGRESS_COUNTER,
      total % trigger.threshold,
    );
    refreshDynamicMinionDescription(source, player);
    const repetitionsPerTrigger = source.golden ? 2 : 1;
    for (
      let count = 0;
      count < triggerCount * repetitionsPerTrigger;
      count += 1
    ) {
      applyRecruitEffects(
        state,
        player,
        source,
        trigger.effects,
        1,
      );
    }
  }
  return true;
}

function reconcileConditionalMinion(
  minion: MinionInstance,
): boolean {
  const effect =
    getMinionDefinition(minion.definitionId).conditionalKeyword;
  const shouldTrigger =
    effect?.keyword === "divineShield" &&
    minion.attack >= effect.attackAtLeast &&
    effectCounter(
      minion,
      CONDITIONAL_KEYWORD_TRIGGERED_COUNTER,
      0,
    ) <= 0;
  const gainedDivineShield =
    shouldTrigger &&
    !minion.divineShield;
  if (shouldTrigger) {
    setEffectCounter(
      minion,
      CONDITIONAL_KEYWORD_TRIGGERED_COUNTER,
      1,
    );
    minion.divineShield = true;
    minion.temporaryDivineShield = false;
  }
  refreshDynamicMinionDescription(minion);
  return gainedDivineShield;
}

function reconcileConditionalMinions(player: PlayerState): void {
  for (const minion of ownedMinionCards(player)) {
    reconcileConditionalMinion(minion);
    refreshDynamicMinionDescription(minion, player);
  }
}

function observeCardPurchase(player: PlayerState): void {
  for (const source of [...player.board]) {
    const effect =
      getMinionDefinition(source.definitionId).afterCardPurchased;
    if (!effect) {
      continue;
    }
    const progress = effectCounter(
      source,
      PURCHASE_PROGRESS_COUNTER,
      0,
    );
    if (progress < 0) {
      continue;
    }
    const nextProgress = progress + 1;
    if (nextProgress >= effect.purchases) {
      const scale =
        source.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
      source.attack += effect.attack * scale;
      source.health += effect.health * scale;
      setEffectCounter(source, PURCHASE_PROGRESS_COUNTER, -1);
    } else {
      setEffectCounter(
        source,
        PURCHASE_PROGRESS_COUNTER,
        nextProgress,
      );
    }
    refreshDynamicMinionDescription(source);
  }
  reconcileConditionalMinions(player);
}

function reconcilePlayerWhereverMinions(player: PlayerState): void {
  const astralAutomatonsSummoned =
    player.astralAutomatonsSummoned ?? 0;
  const eternalKnightsDied = player.eternalKnightsDied ?? 0;
  for (const minion of ownedMinionCards(player)) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned,
      eternalKnightsDied,
    );
  }
}

function observeRecruitAutomatonSummon(
  player: PlayerState,
  summoned: MinionInstance,
): void {
  if (
    summoned.kind !== "minion" ||
    summoned.definitionId !== ASTRAL_AUTOMATON_DEFINITION_ID
  ) {
    return;
  }
  summoned.astralAutomatonSummoned = true;
  player.astralAutomatonsSummoned =
    (player.astralAutomatonsSummoned ?? 0) + 1;
  reconcilePlayerWhereverMinions(player);
}

function observeAncientSoulFriendlyDeath(player: PlayerState): void {
  for (const card of player.hand) {
    if (
      card.kind !== "minion" ||
      card.definitionId !== ANCIENT_SOUL_DEFINITION_ID ||
      card.golden
    ) {
      continue;
    }
    card.ancientSoulFriendlyDeaths = Math.min(
      ANCIENT_SOUL_DEATHS_REQUIRED,
      (card.ancientSoulFriendlyDeaths ?? 0) + 1,
    );
    if (
      card.ancientSoulFriendlyDeaths >= ANCIENT_SOUL_DEATHS_REQUIRED
    ) {
      makeMinionGoldenPreservingEnchantments(card);
      card.grantsTripleReward = false;
    }
    refreshAncientSoulDescription(card);
  }
}

function observePersistentFriendlyDeath(
  player: PlayerState,
  minion: MinionInstance,
): void {
  observeAncientSoulFriendlyDeath(player);
  if (minion.definitionId !== ETERNAL_KNIGHT_DEFINITION_ID) {
    return;
  }
  player.eternalKnightsDied =
    (player.eternalKnightsDied ?? 0) + 1;
  reconcilePlayerWhereverMinions(player);
}

function tavernCardCapacity(player: PlayerState): number {
  return SHOP_SIZE_BY_TIER[player.tavernTier] + 1;
}

function applyAfterTavernRefreshEffects(
  state: GameState,
  player: PlayerState,
): void {
  if (
    player.tavernBloodGemBarrageCount > 0
  ) {
    const attack =
      player.tavernBloodGemBarrageCount * player.bloodGemAttack +
      player.tavernBloodGemBarrageAttack;
    const health =
      player.tavernBloodGemBarrageCount * player.bloodGemHealth +
      player.tavernBloodGemBarrageHealth;
    for (const minion of player.shop) {
      applyBloodGemStats(
        minion,
        attack,
        health,
      );
    }
  }
  if (player.shop.length > 0) {
    for (const buff of player.rideTheWindBuffs) {
      const target =
        player.shop[randomIndex(state, player.shop.length)];
      buffMinions([target], buff.attack, buff.health);
    }
  }
}

function fillShop(
  state: GameState,
  player: PlayerState,
  applyRefreshEffects = true,
): void {
  const normalMinionTargetSize = SHOP_SIZE_BY_TIER[player.tavernTier];
  const totalTargetSize = tavernCardCapacity(player);
  const currentSpellCount = tavernSpellShopOffers(player).length;
  const minionTargetSize = player.spellOnlyRefreshActive
    ? Math.max(0, totalTargetSize - currentSpellCount)
    : Math.min(
        normalMinionTargetSize,
        Math.max(0, totalTargetSize - currentSpellCount),
      );
  let tavernRefreshed = false;
  while (player.shop.length < minionTargetSize) {
    const minion = drawFromPool(state, player.tavernTier);
    if (!minion) {
      break;
    }
    applyPersistentTavernBonuses(player, minion);
    reconcileWhereverMinion(
      minion,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
    );
    refreshDynamicMinionDescription(minion, player);
    player.shop.push(minion);
    tavernRefreshed = true;
  }
  if (
    !player.spellOnlyRefreshActive &&
    player.spellShop === null &&
    player.shop.length + tavernSpellShopOffers(player).length <
      totalTargetSize
  ) {
    const spell = drawTavernSpell(state, player.tavernTier);
    if (spell) {
      player.spellShop = spell;
      tavernRefreshed = true;
    }
  }
  if (tavernRefreshed && applyRefreshEffects) {
    applyAfterTavernRefreshEffects(state, player);
  }
}

function tavernOfferCount(player: PlayerState): number {
  return player.shop.length + tavernSpellShopOffers(player).length;
}

function releaseOneTavernOfferForFodder(
  state: GameState,
  player: PlayerState,
): boolean {
  const minionIndex = player.shop.findLastIndex(
    (minion) =>
      getMinionDefinition(minion.definitionId).shopFodder !== true,
  );
  if (minionIndex >= 0) {
    const [released] = player.shop.splice(minionIndex, 1);
    returnMinionToPool(state, released);
    return true;
  }
  const additionalSpell = player.additionalSpellShop.pop();
  if (additionalSpell) {
    state.spellPool[additionalSpell.definitionId] =
      (state.spellPool[additionalSpell.definitionId] ?? 0) + 1;
    return true;
  }
  if (player.spellShop) {
    state.spellPool[player.spellShop.definitionId] =
      (state.spellPool[player.spellShop.definitionId] ?? 0) + 1;
    player.spellShop = null;
    return true;
  }
  return tavernOfferCount(player) < tavernCardCapacity(player);
}

function refillFodderSlot(
  state: GameState,
  player: PlayerState,
): void {
  if (tavernOfferCount(player) >= tavernCardCapacity(player)) {
    return;
  }
  const minion = drawFromPool(state, player.tavernTier);
  if (!minion) {
    return;
  }
  applyPersistentTavernBonuses(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  player.shop.push(minion);
}

function resolveShopFodder(
  state: GameState,
  player: PlayerState,
): void {
  while (true) {
    const fodderIndex = player.shop.findIndex(
      (minion) =>
        getMinionDefinition(minion.definitionId).shopFodder === true,
    );
    const demons = player.board.filter((minion) =>
      minionHasTribe(minion, "demon"),
    );
    if (fodderIndex < 0 || demons.length === 0) {
      return;
    }
    const target = demons[randomIndex(state, demons.length)];
    const [fodder] = player.shop.splice(fodderIndex, 1);
    consumeShopMinionInto(state, target, fodder, fodder.golden ? 2 : 1);
    refillFodderSlot(state, player);
  }
}

function applyQueuedDemonFodderToRefresh(
  state: GameState,
  player: PlayerState,
): void {
  const fodderCount = player.demonFodderRefreshQueue.shift() ?? 0;
  while (
    player.demonFodderRefreshQueue.length > 0 &&
    player.demonFodderRefreshQueue.at(-1) === 0
  ) {
    player.demonFodderRefreshQueue.pop();
  }
  for (let count = 0; count < fodderCount; count += 1) {
    if (
      tavernOfferCount(player) >= tavernCardCapacity(player) &&
      !releaseOneTavernOfferForFodder(state, player)
    ) {
      break;
    }
    const fodder = createMinionInstance(
      state,
      DEMON_FODDER_DEFINITION_ID,
      0,
    );
    applyPersistentTavernBonuses(player, fodder);
    player.shop.push(fodder);
    resolveShopFodder(state, player);
  }
}

export function getUpgradeCost(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = findPlayer(state, playerId);
  if (!player || player.tavernTier >= 6) {
    return 0;
  }
  const baseCost = UPGRADE_BASE_COST[player.tavernTier];
  const heroPowerDiscount = playerHasHeroPower(
    player,
    "upgradeDiscount",
  )
    ? 1
    : 0;
  return Math.max(
    0,
    baseCost - player.upgradeDiscount - heroPowerDiscount,
  );
}

export function getRefreshCost(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = findPlayer(state, playerId);
  return player?.freeRefreshes ? 0 : REFRESH_COST;
}

export interface TavernSpellPurchaseQuote {
  currency: "gold" | "health";
  cost: number;
  affordable: boolean;
}

function tavernSpellPurchaseCost(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  return tavernSpellPurchaseCurrency(spell) === "gold"
    ? Math.max(
        0,
        spell.cost - (player.nextTavernSpellDiscount ?? 0),
      )
    : spell.cost;
}

export function getTavernSpellPurchaseQuote(
  state: GameState,
  playerId: PlayerId,
  spellInstanceId?: string,
): TavernSpellPurchaseQuote | null {
  const player = findPlayer(state, playerId);
  const spell = player
    ? spellInstanceId
      ? tavernSpellShopOffers(player).find(
          (candidate) => candidate.instanceId === spellInstanceId,
        )
      : player.spellShop
    : undefined;
  if (!player || !spell) {
    return null;
  }
  const currency = tavernSpellPurchaseCurrency(spell);
  const cost = tavernSpellPurchaseCost(player, spell);
  return {
    currency,
    cost,
    affordable:
      player.hand.length < MAX_HAND_SIZE &&
      (currency === "health"
        ? player.health > cost
        : player.gold >= cost),
  };
}

function tavernSpellLegalTargets(
  player: PlayerState,
  spell: TavernSpellDefinition | TavernSpellInstance,
): BoardMinionInstance[] {
  const definition =
    "kind" in spell
      ? getTavernSpellDefinition(spell.definitionId)
      : spell;
  if (!tavernSpellNeedsTarget(definition)) {
    return [];
  }
  const candidates = tavernSpellCanTargetShop(definition)
    ? [...player.board, ...player.shop]
    : [...player.board];
  if (definition.effect === "stackedAvalanche") {
    return candidates.filter((candidate) =>
      player.board.some(
        (minion) =>
          minion.instanceId !== candidate.instanceId &&
          minionHasTribe(minion, "elemental"),
      ),
    );
  }
  if (definition.effect === "arcaneAbsorption") {
    if (player.shop.length === 0) {
      return [];
    }
    return candidates.filter((candidate) =>
      minionHasTribe(candidate, "elemental"),
    );
  }
  if (definition.effect === "slaughter") {
    return candidates.filter((candidate) =>
      minionHasTribe(candidate, "undead"),
    );
  }
  if (definition.effect === "corruptedCupcakes") {
    return candidates.filter((candidate) =>
      minionHasTribe(candidate, "demon"),
    );
  }
  if (definition.effect === "invokeTheDevourer") {
    return candidates.filter((candidate) =>
      player.board.includes(candidate),
    );
  }
  if (definition.effect === "eyesOfTheEarthMother") {
    return candidates.filter(
      (candidate) =>
        player.board.includes(candidate) &&
        candidate.tier <= 4 &&
        !candidate.golden,
    );
  }
  if (definition.effect === "lostStaffOfHamuul") {
    return candidates.filter(
      (candidate) =>
        candidate.tribes.length > 0 &&
        candidate.tribes.some((tribe) => tribe !== "neutral"),
    );
  }
  return candidates;
}

export function getLegalTavernSpellTargetIds(
  state: GameState,
  playerId: PlayerId,
  spell: TavernSpellDefinition | TavernSpellInstance,
): string[] {
  const player = findPlayer(state, playerId);
  return player
    ? tavernSpellLegalTargets(player, spell).map(
        (minion) => minion.instanceId,
      )
    : [];
}

function spellcraftLegalTargets(
  player: PlayerState,
  spell: SpellcraftDefinition | SpellcraftSpellInstance,
): BoardMinionInstance[] {
  return spellcraftNeedsTarget(spell) ? [...player.board] : [];
}

export function getLegalSpellcraftTargetIds(
  state: GameState,
  playerId: PlayerId,
  spell: SpellcraftDefinition | SpellcraftSpellInstance,
): string[] {
  const player = findPlayer(state, playerId);
  return player
    ? spellcraftLegalTargets(player, spell).map(
        (minion) => minion.instanceId,
      )
    : [];
}

function applyBuff(target: MinionInstance, effect: BuffEffect, scale: number): void {
  target.attack = Math.max(0, target.attack + effect.attack * scale);
  target.health = Math.max(1, target.health + effect.health * scale);
  if (effect.taunt) {
    target.taunt = true;
    target.temporaryTaunt = false;
  }
  reconcileConditionalMinion(target);
}

function recruitEffectTargets(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effect: BuffEffect,
): MinionInstance[] {
  const matchesTier = (minion: MinionInstance): boolean =>
    effect.tierParity === undefined ||
    (effect.tierParity === "odd"
      ? minion.tier % 2 === 1
      : minion.tier % 2 === 0);
  const filterTier = (
    minions: readonly BoardMinionInstance[],
  ): BoardMinionInstance[] => minions.filter(matchesTier);
  const chooseRandom = (
    minions: readonly BoardMinionInstance[],
  ): BoardMinionInstance[] => {
    const candidates = [...minions];
    const selected: BoardMinionInstance[] = [];
    const count = Math.max(1, effect.count ?? 1);
    while (selected.length < count && candidates.length > 0) {
      const index = randomIndex(state, candidates.length);
      selected.push(candidates[index]);
      candidates.splice(index, 1);
    }
    return selected;
  };
  switch (effect.target) {
    case "self":
      return matchesTier(source) ? [source] : [];
    case "allFriendly":
      return filterTier(player.board);
    case "otherFriendly":
      return filterTier(player.board.filter(
        (minion) => minion.instanceId !== source.instanceId,
      ));
    case "otherFriendlyTribe":
      return filterTier(player.board.filter(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, effect.tribe),
      ));
    case "friendlyTribe":
      return filterTier(player.board.filter((minion) =>
        minionHasTribe(minion, effect.tribe),
      ));
    case "adjacentFriendly": {
      const sourceIndex = player.board.findIndex(
        (minion) => minion.instanceId === source.instanceId,
      );
      if (sourceIndex < 0) {
        return [];
      }
      return filterTier(player.board.filter(
        (minion, index) =>
          minion.instanceId !== source.instanceId &&
          Math.abs(index - sourceIndex) === 1,
      ));
    }
    case "randomFriendlyTribe": {
      const candidates = filterTier(player.board.filter(
        (minion) =>
          (effect.includeSelf ||
            minion.instanceId !== source.instanceId) &&
          minionHasTribe(minion, effect.tribe),
      ));
      return chooseRandom(candidates);
    }
    case "randomFriendly": {
      const candidates = filterTier(player.board.filter(
        (minion) =>
          effect.includeSelf ||
          minion.instanceId !== source.instanceId,
      ));
      return chooseRandom(candidates);
    }
  }
}

function queueDemonFodder(
  player: PlayerState,
  effect: QueueDemonFodderEffect,
  scale: number,
): void {
  const count =
    effect.count *
    (effect.goldenMode === "doubleCount" ? scale : 1);
  for (let refresh = 0; refresh < effect.refreshes; refresh += 1) {
    player.demonFodderRefreshQueue[refresh] =
      (player.demonFodderRefreshQueue[refresh] ?? 0) + count;
  }
}

function isBeetleToken(
  minion: Pick<BoardMinionInstance, "definitionId">,
): boolean {
  return minion.definitionId === BEETLE_TOKEN_DEFINITION_ID;
}

function improveRecruitBeetles(
  player: PlayerState,
  effect: ImproveBeetlesEffect,
  scale: number,
): void {
  const attack = effect.attack * scale;
  const health = effect.health * scale;
  player.beetleAttackBonus += attack;
  player.beetleHealthBonus += health;
  const handBeetles = player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && isBeetleToken(card),
  );
  buffMinions(
    [
      ...player.board.filter(isBeetleToken),
      ...handBeetles,
    ],
    attack,
    health,
  );
}

function applyPersistentTavernTypeBuff(
  player: PlayerState,
  tribe: Tribe,
  attack: number,
  health: number,
): void {
  const existing = player.tavernTypeBuffs.find(
    (buff) =>
      buff.tribes.length === 1 && buff.tribes[0] === tribe,
  );
  if (existing) {
    existing.attack += attack;
    existing.health += health;
  } else {
    player.tavernTypeBuffs.push({
      tribes: [tribe],
      attack,
      health,
    });
  }
  buffMinions(
    player.shop.filter((minion) => minionHasTribe(minion, tribe)),
    attack,
    health,
  );
}

function applyPersistentTavernTierBuff(
  player: PlayerState,
  maximumTier: TavernTier,
  attack: number,
  health: number,
): void {
  const existing = player.tavernTierBuffs.find(
    (buff) => buff.maximumTier === maximumTier,
  );
  if (existing) {
    existing.attack += attack;
    existing.health += health;
  } else {
    player.tavernTierBuffs.push({
      maximumTier,
      attack,
      health,
    });
  }
  buffMinions(
    player.shop.filter((minion) => minion.tier <= maximumTier),
    attack,
    health,
  );
}

function grantRecruitKeyword(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effect: GrantKeywordEffect,
  scale: number,
): void {
  const candidates = player.board.filter(
    (minion) =>
      minion.instanceId !== source.instanceId &&
      minionHasTribe(minion, effect.tribe) &&
      !minion[effect.keyword],
  );
  const count =
    effect.count *
    (effect.goldenMode === "doubleCount" ? scale : 1);
  for (
    let granted = 0;
    granted < count && candidates.length > 0;
    granted += 1
  ) {
    const targetIndex = randomIndex(state, candidates.length);
    const [target] = candidates.splice(targetIndex, 1);
    target[effect.keyword] = true;
  }
}

function bloodGemsPerSummonedToken(
  effect: SummonEffect,
  goldenSource: boolean,
): number {
  if (effect.bloodGemsPerSummon === undefined) {
    return 0;
  }
  return goldenSource
    ? (effect.goldenBloodGemsPerSummon ??
        effect.bloodGemsPerSummon)
    : effect.bloodGemsPerSummon;
}

function applyRecruitEffects(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effects: readonly MinionEffect[] | undefined,
  scaleOverride?: number,
): void {
  if (!effects) {
    return;
  }
  const scale = scaleOverride ?? (source.golden ? 2 : 1);
  const effectSourceIsGolden =
    scaleOverride === undefined ? source.golden : scaleOverride > 1;
  for (const effect of effects) {
    if (effect.kind === "buff") {
      for (const target of recruitEffectTargets(state, player, source, effect)) {
        applyBuff(target, effect, scale);
      }
    } else if (effect.kind === "grantShield") {
      if (effect.target === "self") {
        source.divineShield = true;
        source.temporaryDivineShield = false;
      } else {
        const candidates = player.board.filter(
          (minion) => minion.instanceId !== source.instanceId,
        );
        for (
          let count = 0;
          count < scale && candidates.length > 0;
          count += 1
        ) {
          const targetIndex = randomIndex(state, candidates.length);
          candidates[targetIndex].divineShield = true;
          candidates[targetIndex].temporaryDivineShield = false;
          candidates.splice(targetIndex, 1);
        }
      }
    } else if (effect.kind === "buffRandomHandMinion") {
      const candidates = player.hand.filter(
        (card): card is BoardMinionInstance => card.kind === "minion",
      );
      if (candidates.length > 0) {
        const target =
          candidates[randomIndex(state, candidates.length)];
        buffMinions(
          [target],
          effect.attack * scale,
          effect.health * scale,
        );
      }
    } else if (effect.kind === "buffOwnedTribe") {
      buffMinions(
        [
          ...player.board,
          ...player.hand.filter(
            (card): card is BoardMinionInstance =>
              card.kind === "minion",
          ),
        ].filter(
          (target) =>
            target.instanceId !== source.instanceId &&
            minionHasTribe(target, effect.tribe),
        ),
        effect.attack * scale,
        effect.health * scale,
      );
    } else if (effect.kind === "installTavernRefreshBuff") {
      const repetitions =
        effect.goldenMode === "repeat" ? scale : 1;
      for (
        let repetition = 0;
        repetition < repetitions;
        repetition += 1
      ) {
        player.rideTheWindBuffs.push({
          attack: effect.attack,
          health: effect.health,
        });
      }
    } else if (effect.kind === "buffTavernTier") {
      applyPersistentTavernTierBuff(
        player,
        effect.maximumTier,
        effect.attack * scale,
        effect.health * scale,
      );
    } else if (effect.kind === "gainGold") {
      player.gold += effect.amount * scale;
    } else if (effect.kind === "gainNextTurnGold") {
      player.pendingNextTurnGold += effect.amount * scale;
    } else if (effect.kind === "gainFreeRefreshes") {
      player.freeRefreshes += effect.count * scale;
    } else if (effect.kind === "gainTavernSpell") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      const definition = getTavernSpellDefinition(
        effect.definitionId,
      );
      for (
        let count = 0;
        count < gainCount && player.hand.length < MAX_HAND_SIZE;
        count += 1
      ) {
        player.hand.push(createTavernSpell(state, definition));
      }
    } else if (effect.kind === "gainRandomTavernSpell") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      for (
        let count = 0;
        count < gainCount && player.hand.length < MAX_HAND_SIZE;
        count += 1
      ) {
        const definition = randomGeneratedTavernSpellDefinition(
          state,
          effect,
        );
        if (!definition) {
          break;
        }
        player.hand.push(createTavernSpell(state, definition));
      }
    } else if (effect.kind === "castTavernSpell") {
      const repetitions =
        effect.goldenMode === "repeat" ? scale : 1;
      for (let count = 0; count < repetitions; count += 1) {
        resolveTriggeredRecruitTavernSpell(
          state,
          player,
          effect.definitionId,
        );
      }
    } else if (effect.kind === "gainMinion") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      for (let count = 0; count < gainCount; count += 1) {
        addGeneratedMinionCopyToHand(
          state,
          player,
          effect.definitionId,
        );
      }
    } else if (effect.kind === "gainRandomGeneratedMinion") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      for (
        let count = 0;
        count < gainCount &&
        effect.definitionIds.length > 0 &&
        player.hand.length < MAX_HAND_SIZE;
        count += 1
      ) {
        const definitionId =
          effect.definitionIds[
            randomIndex(state, effect.definitionIds.length)
          ];
        addGeneratedMinionCopyToHand(
          state,
          player,
          definitionId,
        );
      }
    } else if (effect.kind === "getRandomMinion") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      for (let count = 0; count < gainCount; count += 1) {
        addDrawnMinionToHand(
          state,
          player,
          drawMatchingFromPool(
            state,
            player.tavernTier,
            (definition) =>
              matchesGetRandomMinionEffect(definition, effect),
          ),
        );
      }
    } else if (effect.kind === "grantKeyword") {
      grantRecruitKeyword(
        state,
        player,
        source,
        effect,
        scale,
      );
    } else if (effect.kind === "damageHero") {
      damagePlayer(player, effect.amount);
    } else if (effect.kind === "gainMissingHealth") {
      source.health +=
        Math.max(0, 40 - player.health) * effect.multiplier * scale;
    } else if (effect.kind === "gainBloodGems") {
      addBloodGems(
        state,
        player,
        effect.count * scale,
        effect.bonusKeyword,
      );
    } else if (effect.kind === "applyBloodGemsToTribe") {
      const targets = player.board.filter((minion) =>
        minionHasTribe(minion, effect.tribe),
      );
      for (
        let application = 0;
        application < effect.count * scale;
        application += 1
      ) {
        for (const target of targets) {
          applyRecruitBloodGemPulse(state, player, target);
        }
      }
    } else if (effect.kind === "improveBloodGems") {
      player.bloodGemAttack += effect.attack * scale;
      player.bloodGemHealth += effect.health * scale;
    } else if (effect.kind === "improveBeetles") {
      improveRecruitBeetles(player, effect, scale);
    } else if (effect.kind === "improveBallers") {
      if (effect.attack > 0) {
        buffMinions(
          player.board,
          player.ballerAttackBonus * scale,
          0,
        );
        player.ballerAttackBonus += effect.attack * scale;
      }
      if (effect.health > 0) {
        buffMinions(
          player.board,
          0,
          player.ballerHealthBonus * scale,
        );
        player.ballerHealthBonus += effect.health * scale;
      }
    } else if (effect.kind === "buffTavern") {
      const repetitions =
        effect.goldenMode === "repeat" ? scale : 1;
      const attack = effect.attack * repetitions;
      const health = effect.health * repetitions;
      player.tavernMinionAttackBonus += attack;
      player.tavernMinionHealthBonus += health;
      buffMinions(player.shop, attack, health);
    } else if (effect.kind === "improveTavernSpellBuffs") {
      player.tavernSpellAttackBonus += effect.attack * scale;
      player.tavernSpellHealthBonus += effect.health * scale;
    } else if (effect.kind === "buffTavernType") {
      const repetitions =
        effect.goldenMode === "repeat" ? scale : 1;
      const pulseScale =
        effect.goldenMode === "repeat" ? 1 : scale;
      for (
        let repetition = 0;
        repetition < repetitions;
        repetition += 1
      ) {
        applyPersistentTavernTypeBuff(
          player,
          effect.tribe,
          effect.attack * pulseScale,
          effect.health * pulseScale,
        );
      }
    } else if (effect.kind === "improveUndeadArmy") {
      const outOfCombatScale =
        effect.outOfCombatMultiplier ?? 1;
      const attack =
        effect.attack * scale * outOfCombatScale;
      const health =
        effect.health * scale * outOfCombatScale;
      player.undeadArmyAttackBonus += attack;
      player.undeadArmyHealthBonus += health;
      buffMinions(
        [
          ...player.board,
          ...player.hand.filter(
            (card): card is BoardMinionInstance =>
              card.kind === "minion",
          ),
        ].filter((minion) => minionHasTribe(minion, "undead")),
        attack,
        health,
      );
    } else if (effect.kind === "consumeRandomShopMinion") {
      if (player.shop.length === 0) {
        continue;
      }
      const consumedIndex = randomIndex(state, player.shop.length);
      const [consumed] = player.shop.splice(consumedIndex, 1);
      const statScale =
        effect.goldenMode === "doubleStats" ? scale : 1;
      source.attack += consumed.attack * statScale;
      source.health += consumed.health * statScale;
      returnMinionToPool(state, consumed);
    } else if (effect.kind === "queueDemonFodder") {
      queueDemonFodder(player, effect, scale);
    } else if (effect.kind === "discountNextTavernSpell") {
      player.nextTavernSpellDiscount =
        (player.nextTavernSpellDiscount ?? 0) +
        effect.amount * scale;
    } else if (effect.kind === "makeSelfGolden") {
      if (source.kind === "minion") {
        makeMinionGoldenPreservingEnchantments(source);
      }
    } else if (effect.kind === "summon") {
      const baseCount =
        effect.count === "sourceAttack" ? source.attack : effect.count;
      const doublesCount =
        effectSourceIsGolden && effect.goldenMode === "doubleCount";
      const summonCount = baseCount * (doublesCount ? 2 : 1);
      const summonedTokens: BoardMinionInstance[] = [];
      for (
        let count = 0;
        count < summonCount && player.board.length < MAX_BOARD_SIZE;
        count += 1
      ) {
        const summoned = createMinionInstance(state, effect.definitionId, 0);
        if (effectSourceIsGolden && !doublesCount) {
          makeGoldenToken(summoned);
        }
        if (effect.taunt) {
          summoned.taunt = true;
        }
        applyOwnedUndeadArmyBonus(player, summoned);
        applyOwnedBeetleBonus(player, summoned);
        player.board.push(summoned);
        applyRecruitSummonTriggers(state, player, summoned);
        summonedTokens.push(summoned);
      }
      const bloodGemCount = bloodGemsPerSummonedToken(
        effect,
        effectSourceIsGolden,
      );
      for (const summoned of summonedTokens) {
        for (
          let application = 0;
          application < bloodGemCount;
          application += 1
        ) {
          applyRecruitBloodGemPulse(
            state,
            player,
            summoned,
          );
        }
      }
    }
  }
}

function applyRecruitSummonTriggers(
  state: GameState,
  player: PlayerState,
  summoned: MinionInstance,
): void {
  if (summoned.kind === "minion") {
    reconcileWhereverMinion(
      summoned,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
    );
    refreshDynamicMinionDescription(summoned, player);
  }
  observeRecruitAutomatonSummon(player, summoned);
  for (const watcher of player.board) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlySummoned;
      if (
        !trigger ||
        trigger.combatOnly ||
        trigger.grantShield ||
        !minionHasTribe(summoned, trigger.tribe) ||
        watcher.instanceId === summoned.instanceId
      ) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      if (trigger.permanentAttackGrowth !== undefined) {
        summoned.attack +=
          (trigger.attack ?? 0) * scale +
          effectCounter(
            watcher,
            SUMMON_ATTACK_GROWTH_COUNTER,
            0,
          );
        setEffectCounter(
          watcher,
          SUMMON_ATTACK_GROWTH_COUNTER,
          effectCounter(
            watcher,
            SUMMON_ATTACK_GROWTH_COUNTER,
            0,
          ) +
            trigger.permanentAttackGrowth * scale,
        );
        refreshDynamicMinionDescription(watcher, player);
      } else {
        summoned.attack += (trigger.attack ?? 0) * scale;
        summoned.health += (trigger.health ?? 0) * scale;
      }
    }
  }
  if (summoned.kind === "minion" && minionHasTribe(summoned, "demon")) {
    resolveShopFodder(state, player);
  }
}

function applyAfterFriendlyPlayed(
  state: GameState,
  player: PlayerState,
  played: Pick<MinionInstance, "instanceId" | "tribe" | "tribes">,
): void {
  if (minionHasTribe(played, "elemental")) {
    player.elementalsPlayedThisTurn += 1;
  }
  for (const watcher of player.board) {
    if (watcher.instanceId === played.instanceId) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyPlayed;
      if (!trigger || !minionHasTribe(played, trigger.tribe)) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      watcher.attack += (trigger.attack ?? 0) * scale;
      watcher.health += (trigger.health ?? 0) * scale;
      damagePlayer(player, (trigger.heroDamage ?? 0) * scale);
      addBloodGems(
        state,
        player,
        (trigger.gainBloodGems ?? 0) * scale,
      );
    }
  }
}

function battlecryTriggerCount(player: PlayerState): number {
  return (
    1 +
    player.board.reduce((largestExtra, minion) => {
      return minionEffectSources(minion).reduce(
        (componentLargest, component) => {
          const extra =
            getMinionDefinition(component.definitionId)
              .extraBattlecries ?? 0;
          return Math.max(
            componentLargest,
            extra * (component.golden ? 2 : 1),
          );
        },
        largestExtra,
      );
    }, 0)
  );
}

function endOfTurnTriggerCount(player: PlayerState): number {
  return (
    1 +
    player.board.reduce((largestExtra, minion) => {
      return minionEffectSources(minion).reduce(
        (componentLargest, component) => {
          const extra =
            getMinionDefinition(component.definitionId)
              .extraEndOfTurnTriggers ?? 0;
          return Math.max(
            componentLargest,
            extra * (component.golden ? 2 : 1),
          );
        },
        largestExtra,
      );
    }, 0)
  );
}

function applyOnePerTribeBuff(
  state: GameState,
  board: readonly BoardMinionInstance[],
  attack: number,
  health: number,
): void {
  buffMinions(
    selectDistinctMinionsByTribe(state, board),
    attack,
    health,
  );
}

function applyStartOfTurnEffects(
  state: GameState,
  player: PlayerState,
): void {
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      addMinionSpellcraft(
        state,
        player,
        source.instanceId,
        component,
      );
      const effects =
        getMinionDefinition(component.definitionId).startOfTurn;
      applyRecruitEffects(
        state,
        player,
        source,
        effects,
        component.golden ? 2 : 1,
      );
    }
  }
}

function consumeShopMinionInto(
  state: GameState,
  target: BoardMinionInstance,
  consumed: BoardMinionInstance,
  statScale: number,
): void {
  target.attack += consumed.attack * statScale;
  target.health += consumed.health * statScale;
  returnMinionToPool(state, consumed);
  reconcileConditionalMinion(target);
}

function consumeHighestHealthShopMinion(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  statScale: number,
): void {
  if (
    !player.board.some(
      (minion) => minion.instanceId === source.instanceId,
    ) ||
    player.shop.length === 0
  ) {
    return;
  }
  const highestHealth = Math.max(
    ...player.shop.map((minion) => minion.health),
  );
  const candidates = player.shop.filter(
    (minion) => minion.health === highestHealth,
  );
  const consumed =
    candidates[randomIndex(state, candidates.length)];
  player.shop.splice(player.shop.indexOf(consumed), 1);
  consumeShopMinionInto(state, source, consumed, statScale);
}

function haveDemonsConsumeShop(
  state: GameState,
  player: PlayerState,
  statScale: number,
): void {
  const demons = player.board.filter((minion) =>
    minionHasTribe(minion, "demon"),
  );
  for (const demon of demons) {
    if (player.shop.length === 0) {
      return;
    }
    const consumedIndex = randomIndex(state, player.shop.length);
    const [consumed] = player.shop.splice(consumedIndex, 1);
    consumeShopMinionInto(state, demon, consumed, statScale);
  }
}

function copyAdjacentOriginalsToHand(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  includeRight: boolean,
  repetitions: number,
): void {
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const sourceIndex = player.board.findIndex(
      (minion) => minion.instanceId === source.instanceId,
    );
    if (sourceIndex < 0) {
      return;
    }
    const adjacent = [
      player.board[sourceIndex - 1],
      ...(includeRight ? [player.board[sourceIndex + 1]] : []),
    ].filter(
      (target): target is BoardMinionInstance => target !== undefined,
    );
    for (const target of adjacent) {
      addGeneratedMinionCopyToHand(
        state,
        player,
        target.definitionId,
      );
    }
  }
}

interface ExactRecruitResummonSnapshot {
  minion: BoardMinionInstance;
  boardIndex: number;
}

function summonExactRecruitSnapshot(
  state: GameState,
  player: PlayerState,
  snapshot: ExactRecruitResummonSnapshot,
): void {
  if (player.board.length >= MAX_BOARD_SIZE) {
    returnMinionToPool(state, snapshot.minion);
    return;
  }
  const resummoned = cloneMinion(snapshot.minion);
  resummoned.instanceId = `minion-${state.nextInstanceId}`;
  state.nextInstanceId += 1;
  reconcileWhereverMinion(
    resummoned,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  player.board.splice(
    Math.min(snapshot.boardIndex, player.board.length),
    0,
    resummoned,
  );
  applyRecruitSummonTriggers(state, player, resummoned);
}

function destroyAndResummonAdjacentUndead(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  includeRight: boolean,
): void {
  const sourceIndex = player.board.findIndex(
    (minion) => minion.instanceId === source.instanceId,
  );
  if (sourceIndex < 0) {
    return;
  }
  const snapshots: ExactRecruitResummonSnapshot[] = [
    { minion: player.board[sourceIndex - 1], boardIndex: sourceIndex - 1 },
    ...(includeRight
      ? [
          {
            minion: player.board[sourceIndex + 1],
            boardIndex: sourceIndex + 1,
          },
        ]
      : []),
  ]
    .filter(
      (
        entry,
      ): entry is {
        minion: BoardMinionInstance;
        boardIndex: number;
      } =>
        entry.minion !== undefined &&
        minionHasTribe(entry.minion, "undead"),
    )
    .map(({ minion, boardIndex }) => ({
      minion: cloneMinion(minion),
      boardIndex,
    }));
  const destroyedSnapshots: ExactRecruitResummonSnapshot[] = [];
  for (const snapshot of snapshots) {
    const destroyed = destroyRecruitMinion(
      state,
      player,
      snapshot.minion.instanceId,
      { returnToPool: false },
    );
    if (destroyed) {
      destroyedSnapshots.push(snapshot);
    }
  }
  for (const snapshot of destroyedSnapshots) {
    summonExactRecruitSnapshot(state, player, snapshot);
  }
  resolveTriples(state, player);
}

function copyLastTavernSpellToHand(
  state: GameState,
  player: PlayerState,
  count: number,
): void {
  const definitionId = player.lastTavernSpellDefinitionId;
  if (!definitionId) {
    return;
  }
  const definition = getTavernSpellDefinition(definitionId);
  for (
    let copy = 0;
    copy < count && player.hand.length < MAX_HAND_SIZE;
    copy += 1
  ) {
    player.hand.push(createTavernSpell(state, definition));
  }
}

function gainRandomOrAllMinion(
  state: GameState,
  player: PlayerState,
  definitionIds: readonly string[],
  gainAll: boolean,
): void {
  if (gainAll) {
    for (const definitionId of definitionIds) {
      if (player.hand.length >= MAX_HAND_SIZE) {
        return;
      }
      addDrawnMinionToHand(
        state,
        player,
        drawMatchingFromPool(
          state,
          player.tavernTier,
          (definition) => definition.id === definitionId,
        ),
      );
    }
    return;
  }
  if (player.hand.length >= MAX_HAND_SIZE) {
    return;
  }
  addDrawnMinionToHand(
    state,
    player,
    drawMatchingFromPool(
      state,
      player.tavernTier,
      (definition) => definitionIds.includes(definition.id),
    ),
  );
}

function bonusKeywordCount(minion: BoardMinionInstance): number {
  return [
    minion.divineShield,
    minion.reborn,
    minion.stealth === true,
    minion.taunt,
    minion.venomous,
    minion.windfury,
  ].filter(Boolean).length;
}

function applyOneEndOfTurnEffect(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  effect: EndOfTurnEffect,
  scale: number,
  payoffRepetitions = 1,
): void {
  if (
    effect.kind === "gainBloodGems" ||
    effect.kind === "gainTavernSpell" ||
    effect.kind === "gainRandomTavernSpell" ||
    effect.kind === "improveTavernSpellBuffs" ||
    effect.kind === "queueDemonFodder"
  ) {
    applyRecruitEffects(state, player, source, [effect], scale);
    return;
  }

  if (effect.kind === "periodicGainRandomMinion") {
    const remaining =
      effectCounter(
        source,
        PERIODIC_TURN_COUNTER,
        effect.everyTurns,
      ) - 1;
    if (remaining <= 0) {
      const rewardCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1) *
        payoffRepetitions;
      for (let count = 0; count < rewardCount; count += 1) {
        addDrawnMinionToHand(
          state,
          player,
          drawMatchingFromPool(
            state,
            player.tavernTier,
            (definition) =>
              definitionHasTribe(definition, effect.tribe),
          ),
        );
      }
      setEffectCounter(
        source,
        PERIODIC_TURN_COUNTER,
        effect.everyTurns,
      );
    } else {
      setEffectCounter(
        source,
        PERIODIC_TURN_COUNTER,
        remaining,
      );
    }
    refreshDynamicMinionDescription(source);
    return;
  }

  if (effect.kind === "copyLeftOriginal") {
    const remaining =
      effectCounter(
        source,
        PERIODIC_TURN_COUNTER,
        effect.everyTurns,
      ) - 1;
    if (remaining <= 0) {
      copyAdjacentOriginalsToHand(
        state,
        player,
        source,
        effect.goldenMode === "adjacent" && scale > 1,
        payoffRepetitions,
      );
      setEffectCounter(
        source,
        PERIODIC_TURN_COUNTER,
        effect.everyTurns,
      );
    } else {
      setEffectCounter(
        source,
        PERIODIC_TURN_COUNTER,
        remaining,
      );
    }
    refreshDynamicMinionDescription(source);
    return;
  }

  if (effect.kind === "consumeHighestHealthShop") {
    consumeHighestHealthShopMinion(
      state,
      player,
      source,
      effect.goldenMode === "doubleStats" ? scale : 1,
    );
    return;
  }

  if (effect.kind === "demonsConsumeShop") {
    haveDemonsConsumeShop(
      state,
      player,
      effect.goldenMode === "doubleStats" ? scale : 1,
    );
    return;
  }

  if (effect.kind === "destroyAndResummonLeftUndead") {
    destroyAndResummonAdjacentUndead(
      state,
      player,
      source,
      effect.goldenMode === "adjacentUndead" && scale > 1,
    );
    return;
  }

  if (effect.kind === "copyLastTavernSpell") {
    copyLastTavernSpellToHand(
      state,
      player,
      effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1),
    );
    return;
  }

  if (effect.kind === "gainRandomOrAllMinion") {
    gainRandomOrAllMinion(
      state,
      player,
      effect.definitionIds,
      effect.goldenMode === "all" && scale > 1,
    );
    return;
  }

  if (effect.kind === "dynamicWarbandEndOfTurn") {
    buffMinions(
      player.board,
      effect.attack * scale +
        effectCounter(
          source,
          DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
          0,
        ),
      effect.health * scale +
        effectCounter(
          source,
          DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
          0,
        ),
    );
    return;
  }

  if (effect.kind === "leftmostTribeRepeatPerCardPlayed") {
    const target = player.board.find((minion) =>
      minionHasTribe(minion, effect.tribe),
    );
    if (target) {
      const repetitions = 1 + player.cardsPlayedThisTurn;
      buffMinions(
        [target],
        effect.attack * scale * repetitions,
        effect.health * scale * repetitions,
      );
    }
    return;
  }

  if (effect.kind === "applyBloodGemToAllPerBonusKeyword") {
    const applications =
      effect.count *
      (effect.goldenMode === "doubleCount" ? scale : 1) *
      (1 + bonusKeywordCount(source));
    for (let application = 0; application < applications; application += 1) {
      for (const target of player.board) {
        applyRecruitBloodGemPulse(state, player, target);
      }
    }
    return;
  }

  if (effect.kind === "onePerTribe") {
    applyOnePerTribeBuff(
      state,
      player.board,
      effect.attack * scale,
      effect.health * scale,
    );
    return;
  }

  const sourceIndex = player.board.findIndex(
    (minion) => minion.instanceId === source.instanceId,
  );
  const targets =
    effect.target === "self"
      ? [source]
      : player.board.filter(
          (_, index) => Math.abs(index - sourceIndex) === 1,
        );
  const repetitions =
    1 +
    (effect.repeatPerGoldenFriendly
      ? player.board.filter((minion) => minion.golden).length
      : 0);
  buffMinions(
    targets,
    effect.attack * scale * repetitions,
    effect.health * scale * repetitions,
  );
}

function applyEndOfTurnEffects(
  state: GameState,
  player: PlayerState,
): void {
  const triggerCount = endOfTurnTriggerCount(player);
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      const effect =
        getMinionDefinition(component.definitionId).endOfTurn;
      if (!effect) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      if (
        effect.kind === "periodicGainRandomMinion" ||
        effect.kind === "copyLeftOriginal"
      ) {
        applyOneEndOfTurnEffect(
          state,
          player,
          source,
          effect,
          scale,
          triggerCount,
        );
        continue;
      }
      for (
        let repetition = 0;
        repetition < triggerCount;
        repetition += 1
      ) {
        applyOneEndOfTurnEffect(
          state,
          player,
          source,
          effect,
          scale,
        );
      }
    }
  }
}

function applyAfterMagnetizedEffects(
  state: GameState,
  player: PlayerState,
): void {
  for (const watcher of [...player.board]) {
    for (const component of minionEffectSources(watcher)) {
      const effects =
        getMinionDefinition(component.definitionId).afterMagnetized;
      applyRecruitEffects(
        state,
        player,
        watcher,
        effects,
        component.golden ? 2 : 1,
      );
    }
  }
}

function resolveTriples(
  state: GameState,
  player: PlayerState,
  combatContext?: CombatContext,
): void {
  let combined = true;
  while (combined) {
    combined = false;
    const definitionIds = [
      ...player.board.map((minion) => minion.definitionId),
      ...player.hand
        .filter(
          (card): card is BoardMinionInstance => card.kind === "minion",
        )
        .map((minion) => minion.definitionId),
    ];
    for (const definitionId of definitionIds) {
      const boardMatches = player.board.filter(
        (minion) =>
          minion.definitionId === definitionId && minion.golden === false,
      );
      const handMatches = player.hand.filter(
        (minion): minion is BoardMinionInstance =>
          minion.kind === "minion" &&
          minion.definitionId === definitionId && minion.golden === false,
      );
      const matches = [...boardMatches, ...handMatches];
      if (matches.length < 3) {
        continue;
      }

      const consumed = matches.slice(0, 3);
      const consumedIds = new Set(consumed.map((minion) => minion.instanceId));
      player.board = player.board.filter(
        (minion) => !consumedIds.has(minion.instanceId),
      );
      player.hand = player.hand.filter(
        (minion) => !consumedIds.has(minion.instanceId),
      );

      const definition = getMinionDefinition(definitionId);
      const undeadArmyAttack =
        definitionHasTribe(definition, "undead")
          ? player.undeadArmyAttackBonus
          : 0;
      const undeadArmyHealth =
        definitionHasTribe(definition, "undead")
          ? player.undeadArmyHealthBonus
          : 0;
      const beetleAttack =
        definitionId === BEETLE_TOKEN_DEFINITION_ID
          ? player.beetleAttackBonus
          : 0;
      const beetleHealth =
        definitionId === BEETLE_TOKEN_DEFINITION_ID
          ? player.beetleHealthBonus
          : 0;
      const extraAttack = consumed.reduce(
        (total, minion) =>
          total +
          (minion.attack -
            definition.attack -
            undeadArmyAttack -
            beetleAttack -
            (minion.whereverAttackBonus ?? 0)),
        0,
      );
      const extraHealth = consumed.reduce(
        (total, minion) =>
          total +
          (minion.health -
            definition.health -
            undeadArmyHealth -
            beetleHealth -
            (minion.whereverHealthBonus ?? 0)),
        0,
      );
      const golden = createMinionInstance(
        state,
        definitionId,
        consumed.reduce((total, minion) => total + minion.poolCopies, 0),
      );
      golden.golden = true;
      golden.cardId = definition.goldenCardId ?? definition.cardId;
      golden.grantsTripleReward = true;
      golden.name = `金色·${definition.name}`;
      golden.attack =
        definition.attack * 2 +
        undeadArmyAttack +
        beetleAttack +
        extraAttack;
      golden.health =
        definition.health * 2 +
        undeadArmyHealth +
        beetleHealth +
        extraHealth;
      golden.bloodGemAttack = consumed.reduce(
        (total, minion) => total + minion.bloodGemAttack,
        0,
      );
      golden.bloodGemHealth = consumed.reduce(
        (total, minion) => total + minion.bloodGemHealth,
        0,
      );
      golden.temporaryAttack = consumed.reduce(
        (total, minion) => total + minion.temporaryAttack,
        0,
      );
      golden.temporaryHealth = consumed.reduce(
        (total, minion) => total + minion.temporaryHealth,
        0,
      );
      golden.temporaryCrabDeathrattles = consumed.reduce(
        (total, minion) =>
          total + minion.temporaryCrabDeathrattles,
        0,
      );
      golden.temporaryGoldenCrabDeathrattles = consumed.reduce(
        (total, minion) =>
          total + (minion.temporaryGoldenCrabDeathrattles ?? 0),
        0,
      );
      if (definition.afterGoldSpent) {
        setEffectCounter(
          golden,
          GOLD_SPEND_PROGRESS_COUNTER,
          Math.max(
            ...consumed.map((minion) =>
              effectCounter(
                minion,
                GOLD_SPEND_PROGRESS_COUNTER,
                0,
              ),
            ),
          ),
        );
      }
      if (
        definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID ||
        definitionId === UPBEAT_DUO_DEFINITION_ID
      ) {
        const defaultTurns =
          definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID ? 3 : 2;
        setEffectCounter(
          golden,
          PERIODIC_TURN_COUNTER,
          Math.min(
            ...consumed.map((minion) =>
              effectCounter(
                minion,
                PERIODIC_TURN_COUNTER,
                defaultTurns,
              ),
            ),
          ),
        );
      } else if (definitionId === HUNGRY_TROG_DEFINITION_ID) {
        const purchaseProgress = consumed.some(
          (minion) =>
            effectCounter(minion, PURCHASE_PROGRESS_COUNTER, 0) < 0,
        )
          ? -1
          : Math.max(
              ...consumed.map((minion) =>
                effectCounter(
                  minion,
                  PURCHASE_PROGRESS_COUNTER,
                  0,
                ),
              ),
            );
        setEffectCounter(
          golden,
          PURCHASE_PROGRESS_COUNTER,
          purchaseProgress,
        );
      } else if (
        definition.endOfTurn?.kind === "dynamicWarbandEndOfTurn"
      ) {
        setEffectCounter(
          golden,
          DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
                0,
              ),
            0,
          ),
        );
        setEffectCounter(
          golden,
          DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
                0,
              ),
            0,
          ),
        );
        setEffectCounter(golden, DYNAMIC_AVENGE_PROGRESS_COUNTER, 0);
      } else if (
        definition.startOfCombat?.some(
          (effect) => effect.kind === "growingTribeBuff",
        )
      ) {
        setEffectCounter(
          golden,
          START_OF_COMBAT_ATTACK_BONUS_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                START_OF_COMBAT_ATTACK_BONUS_COUNTER,
                0,
              ),
            0,
          ),
        );
        setEffectCounter(
          golden,
          START_OF_COMBAT_HEALTH_BONUS_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                START_OF_COMBAT_HEALTH_BONUS_COUNTER,
                0,
              ),
            0,
          ),
        );
      } else if (
        definition.afterFriendlySummoned?.permanentAttackGrowth !==
        undefined
      ) {
        setEffectCounter(
          golden,
          SUMMON_ATTACK_GROWTH_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                SUMMON_ATTACK_GROWTH_COUNTER,
                0,
              ),
            0,
          ),
        );
      }
      const playableFromRound = Math.max(
        0,
        ...consumed.map((minion) => minion.playableFromRound ?? 0),
      );
      if (playableFromRound > 0) {
        golden.playableFromRound = playableFromRound;
      }
      const hasPermanentTaunt =
        definition.taunt === true ||
        consumed.some(
          (minion) => minion.taunt && !minion.temporaryTaunt,
        );
      golden.temporaryTaunt =
        !hasPermanentTaunt &&
        consumed.some((minion) => minion.temporaryTaunt);
      golden.taunt =
        hasPermanentTaunt || golden.temporaryTaunt;
      const hasPermanentDivineShield =
        definition.divineShield === true ||
        consumed.some(
          (minion) =>
            minion.divineShield &&
            !minion.temporaryDivineShield,
        );
      golden.temporaryDivineShield =
        !hasPermanentDivineShield &&
        consumed.some((minion) => minion.temporaryDivineShield);
      golden.divineShield =
        hasPermanentDivineShield ||
        golden.temporaryDivineShield;
      golden.reborn =
        definition.reborn === true ||
        consumed.some((minion) => minion.reborn);
      golden.stealth =
        definition.stealth === true ||
        consumed.some((minion) => minion.stealth === true);
      golden.poisonous =
        definition.poisonous === true ||
        consumed.some((minion) => minion.poisonous);
      golden.venomous =
        definition.venomous === true ||
        consumed.some((minion) => minion.venomous);
      golden.windfury =
        definition.windfury === true ||
        consumed.some((minion) => minion.windfury);
      golden.cleave =
        definition.cleave === true ||
        consumed.some((minion) => minion.cleave);
      golden.alwaysAttacksLowestAttack =
        definition.alwaysAttacksLowestAttack === true ||
        consumed.some(
          (minion) => minion.alwaysAttacksLowestAttack,
        );
      golden.attachments = consumed.flatMap((minion) =>
        minion.attachments.map(cloneMagneticAttachment),
      );
      if (
        consumed.some(
          (minion) => minion.effectSupport === "partial",
        )
      ) {
        golden.effectSupport = "partial";
      }
      golden.sellValue =
        definition.goldenSellValue ?? definition.sellValue ?? 1;
      golden.description = goldenMinionDescription(definition.id);
      if (definition.id === ANCIENT_SOUL_DEFINITION_ID) {
        golden.ancientSoulFriendlyDeaths =
          ANCIENT_SOUL_DEATHS_REQUIRED;
      }
      reconcileWhereverMinion(
        golden,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
      );
      refreshDynamicMinionDescription(golden);
      const writebackTargets =
        combatContext?.retentionWritebackTargets[player.id];
      if (writebackTargets) {
        for (const [originInstanceId, targetInstanceId] of Object.entries(
          writebackTargets,
        )) {
          if (consumedIds.has(targetInstanceId)) {
            writebackTargets[originInstanceId] = golden.instanceId;
          }
        }
      }
      player.hand.push(golden);
      combined = true;
      break;
    }
  }
}

function buyMinion(
  state: GameState,
  player: PlayerState,
  shopIndex: number,
): boolean {
  if (
    player.gold < BUY_COST ||
    player.hand.length >= MAX_HAND_SIZE ||
    shopIndex < 0 ||
    shopIndex >= player.shop.length
  ) {
    return false;
  }
  const [minion] = player.shop.splice(shopIndex, 1);
  claimGeneratedShopMinion(minion);
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  player.hand.push(minion);
  spendGold(state, player, BUY_COST);
  observeCardPurchase(player);
  resolveTriples(state, player);
  return true;
}

function buyTavernSpell(
  state: GameState,
  player: PlayerState,
  spellInstanceId?: string,
): boolean {
  const offers = tavernSpellShopOffers(player);
  const spell = spellInstanceId
    ? offers.find((candidate) => candidate.instanceId === spellInstanceId)
    : player.spellShop;
  if (!spell || player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const currency = tavernSpellPurchaseCurrency(spell);
  const cost = tavernSpellPurchaseCost(player, spell);
  if (
    (currency === "gold" && player.gold < cost) ||
    (currency === "health" && player.health <= cost)
  ) {
    return false;
  }
  state.spellPool[spell.definitionId] =
    (state.spellPool[spell.definitionId] ?? 0) + 1;
  player.hand.push(spell);
  if (player.spellShop?.instanceId === spell.instanceId) {
    player.spellShop = player.additionalSpellShop.shift() ?? null;
  } else {
    player.additionalSpellShop = player.additionalSpellShop.filter(
      (candidate) => candidate.instanceId !== spell.instanceId,
    );
  }
  if (currency === "health") {
    player.health -= cost;
  } else {
    spendGold(state, player, cost);
    player.nextTavernSpellDiscount = 0;
  }
  observeCardPurchase(player);
  return true;
}

export function getMinionSellValue(
  state: GameState,
  playerId: PlayerId,
  minion: Pick<
    MinionInstance,
    "definitionId" | "sellValue" | "golden"
  >,
): number {
  const definition = getMinionDefinition(minion.definitionId);
  if (definition.sellValueAfterLoss === undefined) {
    return minion.sellValue;
  }
  const previousBattle = state.lastRoundBattles.find(
    (battle) =>
      battle.playerAId === playerId ||
      (!battle.isGhost && battle.playerBId === playerId),
  );
  if (
    !previousBattle ||
    previousBattle.winnerId === null ||
    previousBattle.winnerId === playerId
  ) {
    return minion.sellValue;
  }
  return minion.golden
    ? definition.goldenSellValueAfterLoss ??
        definition.sellValueAfterLoss
    : definition.sellValueAfterLoss;
}

function sellMinionTransaction(
  state: GameState,
  player: PlayerState,
  boardIndex: number,
): BoardMinionInstance | null {
  if (boardIndex < 0 || boardIndex >= player.board.length) {
    return null;
  }
  const [minion] = player.board.splice(boardIndex, 1);
  const sellValue = getMinionSellValue(state, player.id, minion);
  returnMinionToPool(state, minion);
  player.gold += sellValue;
  applyRecruitEffects(
    state,
    player,
    minion,
    getMinionDefinition(minion.definitionId).afterSold,
  );
  for (const watcher of [...player.board]) {
    for (const component of minionEffectSources(watcher)) {
      applyRecruitEffects(
        state,
        player,
        watcher,
        getMinionDefinition(component.definitionId).afterFriendlySold,
        component.golden ? 2 : 1,
      );
    }
  }
  return minion;
}

function sellMinion(
  state: GameState,
  player: PlayerState,
  boardIndex: number,
): boolean {
  return sellMinionTransaction(state, player, boardIndex) !== null;
}

function fearlessFoodieOptionIds(
  golden: boolean,
): [MinionChoiceId, MinionChoiceId] {
  return golden
    ? ["BG30_123_Gt", "BG30_123_Gt2"]
    : ["BG30_123t", "BG30_123t2"];
}

function minionChoiceImprovesBloodGems(
  optionId: MinionChoiceId,
): boolean {
  return optionId === "BG30_123t" || optionId === "BG30_123_Gt";
}

function boardWithCandidate(
  player: PlayerState,
  candidate?: BoardMinionInstance,
): readonly BoardMinionInstance[] {
  return candidate &&
    !player.board.some(
      (minion) => minion.instanceId === candidate.instanceId,
    )
    ? [...player.board, candidate]
    : player.board;
}

function beetleSummonCount(
  minion: BoardMinionInstance,
): number {
  return minionEffectSources(minion).reduce((total, component) => {
    const definition = getMinionDefinition(component.definitionId);
    return (
      total +
      [
        ...(definition.battlecry ?? []),
        ...(definition.deathrattle ?? []),
        ...(definition.afterSelfDamaged ?? []),
      ].reduce((effectTotal, effect) => {
        if (
          effect.kind !== "summon" ||
          effect.definitionId !== BEETLE_TOKEN_DEFINITION_ID ||
          typeof effect.count !== "number"
        ) {
          return effectTotal;
        }
        return (
          effectTotal +
          effect.count *
            (component.golden &&
            effect.goldenMode === "doubleCount"
              ? 2
              : 1)
        );
      }, 0)
    );
  }, 0);
}

interface BeetleGrowthPotential {
  battlecry: number;
  deathrattle: number;
  selfDamaged: number;
}

function beetleGrowthPotential(
  minion: BoardMinionInstance,
): BeetleGrowthPotential {
  return minionEffectSources(minion).reduce<BeetleGrowthPotential>(
    (total, component) => {
      const definition = getMinionDefinition(component.definitionId);
      const scale = component.golden ? 2 : 1;
      const growth = (effects: readonly MinionEffect[] | undefined) =>
        (effects ?? []).reduce(
          (amount, effect) =>
            effect.kind === "improveBeetles"
              ? amount +
                (effect.attack + effect.health) * scale
              : amount,
          0,
        );
      total.battlecry += growth(definition.battlecry);
      total.deathrattle += growth(definition.deathrattle);
      total.selfDamaged += growth(definition.afterSelfDamaged);
      return total;
    },
    { battlecry: 0, deathrattle: 0, selfDamaged: 0 },
  );
}

function roogugRedirectCount(minion: MinionInstance): number {
  return minionEffectSources(minion).reduce((total, component) => {
    const effect = getMinionDefinition(
      component.definitionId,
    ).afterBloodGemCastOnSelf;
    if (effect?.kind !== "playBloodGemsOnRandomOther") {
      return total;
    }
    return (
      total +
      effect.count *
        (component.golden && effect.goldenMode === "doubleCount"
          ? 2
          : 1)
    );
  }, 0);
}

function hasRoogugRedirectTarget(
  board: readonly BoardMinionInstance[],
  roogug: BoardMinionInstance,
): boolean {
  return board.some(
    (candidate) =>
      candidate.instanceId !== roogug.instanceId &&
      !minionHasEffectSource(
        candidate,
        GEOMAGUS_ROOGUG_DEFINITION_ID,
      ),
  );
}

function bestUsefulRoogugRedirectCount(
  board: readonly BoardMinionInstance[],
): number {
  return board.reduce((best, minion) => {
    const count = roogugRedirectCount(minion);
    return count > 0 && hasRoogugRedirectTarget(board, minion)
      ? Math.max(best, count)
      : best;
  }, 0);
}

function bloodGemHandCastMultiplier(
  board: readonly BoardMinionInstance[],
): number {
  return (
    1 +
    board.reduce(
      (total, minion) =>
        total +
        minionEffectSources(minion).reduce(
          (componentTotal, component) => {
            const aura = getMinionDefinition(
              component.definitionId,
            ).bloodGemFromHandAura;
            if (!aura) {
              return componentTotal;
            }
            return (
              componentTotal +
              aura.extraCasts *
                (component.golden &&
                aura.goldenMode === "doubleCount"
                  ? 2
                  : 1)
            );
          },
          0,
        ),
      0,
    )
  );
}

function estimatedNearTermHandBloodGems(
  player: PlayerState,
  excludedInstanceId?: string,
): number {
  let estimate = player.hand.filter(
    (card) => card.kind === "bloodGem",
  ).length;
  for (const card of player.hand) {
    if (
      card.kind !== "minion" ||
      card.instanceId === excludedInstanceId
    ) {
      continue;
    }
    for (const component of minionEffectSources(card)) {
      const definition = getMinionDefinition(component.definitionId);
      const choice = definition.onPlayChoice;
      if (choice?.kind === "bloodGemImproveOrGain") {
        const count =
          choice.count *
          (component.golden &&
          choice.goldenMode === "doubleValues"
            ? 2
            : 1);
        const spaceAfterPlay =
          MAX_HAND_SIZE - player.hand.length + 1;
        estimate += Math.min(Math.max(0, spaceAfterPlay), count);
      }
      for (const effect of definition.battlecry ?? []) {
        if (effect.kind === "gainBloodGems") {
          estimate +=
            effect.count *
            (component.golden ? 2 : 1) *
            battlecryTriggerCount(player);
        }
      }
    }
  }
  for (const source of player.board) {
    for (const component of minionEffectSources(source)) {
      const effect =
        getMinionDefinition(component.definitionId).endOfTurn;
      if (effect?.kind === "gainBloodGems") {
        estimate +=
          effect.count *
          (component.golden ? 2 : 1) *
          endOfTurnTriggerCount(player);
      }
    }
  }
  return Math.min(8, estimate);
}

function composerBloodGemPulsesOnTarget(
  board: readonly BoardMinionInstance[],
  target: BoardMinionInstance,
): number {
  const expectedDeaths = Math.max(0, board.length - 1);
  let pulses = 0;
  for (const source of board) {
    for (const component of minionEffectSources(source)) {
      const avenge = getMinionDefinition(component.definitionId).avenge;
      if (!avenge || expectedDeaths < avenge.threshold) {
        continue;
      }
      for (const effect of avenge.effects) {
        if (
          effect.kind === "applyBloodGemsToTribe" &&
          minionHasTribe(target, effect.tribe)
        ) {
          pulses += effect.count * (component.golden ? 2 : 1);
        }
      }
    }
  }
  return pulses;
}

function composerBloodGemApplications(
  board: readonly BoardMinionInstance[],
): number {
  return board.reduce((total, target) => {
    const pulses = composerBloodGemPulsesOnTarget(board, target);
    const redirects =
      roogugRedirectCount(target) > 0 &&
      hasRoogugRedirectTarget(board, target)
        ? roogugRedirectCount(target)
        : 0;
    return total + pulses * (1 + redirects);
  }, 0);
}

interface BloodGemAiBranchScores {
  gainScore: number;
  improveScore: number;
}

function bloodGemAiBranchScores(
  player: PlayerState,
  source: BoardMinionInstance,
  underPressure: boolean,
): BloodGemAiBranchScores {
  const effect = getMinionDefinition(source.definitionId).onPlayChoice;
  if (effect?.kind !== "bloodGemImproveOrGain") {
    return { gainScore: 0, improveScore: 0 };
  }
  const multiplier =
    source.golden && effect.goldenMode === "doubleValues" ? 2 : 1;
  const sourceWasInHand = player.hand.some(
    (card) => card.instanceId === source.instanceId,
  );
  const handSpace =
    MAX_HAND_SIZE -
    player.hand.length +
    (sourceWasInHand ? 1 : 0);
  const retained = Math.min(
    Math.max(0, handSpace),
    effect.count * multiplier,
  );
  const projectedBoard = boardWithCandidate(player, source);
  const handMultiplier = bloodGemHandCastMultiplier(projectedBoard);
  const redirectMultiplier =
    1 + bestUsefulRoogugRedirectCount(projectedBoard);
  const applicationMultiplier =
    handMultiplier * redirectMultiplier;
  const currentGemStats =
    player.bloodGemAttack + player.bloodGemHealth;
  const gainScore =
    retained *
    applicationMultiplier *
    currentGemStats *
    (underPressure ? 1.25 : 1);
  const futureApplications =
    estimatedNearTermHandBloodGems(player, source.instanceId) *
      applicationMultiplier +
    composerBloodGemApplications(projectedBoard);
  const improveScore =
    (effect.attack + effect.health) *
    multiplier *
    Math.min(24, futureApplications);
  return { gainScore, improveScore };
}

function applyBloodGemImproveOrGainChoice(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  optionId: MinionChoiceId,
  effectMultiplier: 1 | 2,
): boolean {
  const definition = getMinionDefinition(source.definitionId);
  const effect = definition.onPlayChoice;
  const optionIds = fearlessFoodieOptionIds(source.golden);
  const expectedMultiplier: 1 | 2 =
    source.golden && effect?.goldenMode === "doubleValues" ? 2 : 1;
  if (
    effect?.kind !== "bloodGemImproveOrGain" ||
    !optionIds.includes(optionId) ||
    effectMultiplier !== expectedMultiplier
  ) {
    return false;
  }
  if (minionChoiceImprovesBloodGems(optionId)) {
    player.bloodGemAttack += effect.attack * effectMultiplier;
    player.bloodGemHealth += effect.health * effectMultiplier;
  } else {
    addBloodGems(
      state,
      player,
      effect.count * effectMultiplier,
    );
  }
  return true;
}

function chooseAiBloodGemImproveOrGainOption(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
): MinionChoiceId {
  const [improveOption, gainOption] = fearlessFoodieOptionIds(
    source.golden,
  );
  const underPressure =
    player.health + player.armor <= 20 ||
    player.board.length < aiTargetBoardSize(state.round);
  const scores = bloodGemAiBranchScores(
    player,
    source,
    underPressure,
  );
  if (scores.gainScore > scores.improveScore) {
    return gainOption;
  }
  return improveOption;
}

function beginOnPlayMinionChoice(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
): boolean {
  const effect = getMinionDefinition(source.definitionId).onPlayChoice;
  if (effect?.kind !== "bloodGemImproveOrGain") {
    return false;
  }
  const effectMultiplier: 1 | 2 =
    source.golden && effect.goldenMode === "doubleValues" ? 2 : 1;
  const optionIds = fearlessFoodieOptionIds(source.golden);
  if (!player.isHuman) {
    applyBloodGemImproveOrGainChoice(
      state,
      player,
      source,
      chooseAiBloodGemImproveOrGainOption(state, player, source),
      effectMultiplier,
    );
    return false;
  }
  state.pendingInteraction = {
    kind: "minionChoice",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: source.instanceId,
    definitionId: source.definitionId,
    optionIds,
    effectMultiplier,
  };
  return true;
}

function playMinion(
  state: GameState,
  player: PlayerState,
  handIndex: number,
  boardIndex?: number,
): boolean {
  const card = player.hand[handIndex];
  if (
    player.board.length >= MAX_BOARD_SIZE ||
    handIndex < 0 ||
    handIndex >= player.hand.length ||
    card?.kind !== "minion" ||
    (card.playableFromRound ?? 0) > state.round
  ) {
    return false;
  }
  const [removed] = player.hand.splice(handIndex, 1);
  if (removed.kind !== "minion") {
    throw new Error("PLAY_MINION removed a non-minion hand card");
  }
  const minion = removed;
  const insertAt =
    boardIndex === undefined
      ? player.board.length
      : Math.max(0, Math.min(boardIndex, player.board.length));
  player.board.splice(insertAt, 0, minion);
  beginCardPlayed(player, {
    sourceInstanceId: minion.instanceId,
    cardKind: "minion",
    tier: minion.tier,
    tribe: minion.tribe,
    tribes: [...minion.tribes],
  });
  grantTripleRewardBeforeGeneratedCards(state, player, minion);
  grantPlayedMinionSpellcraft(state, player, minion);
  // The played minion finishes being summoned before its Battlecry can
  // summon additional minions. Summon observers therefore see the played
  // body first and every Battlecry token afterward.
  applyRecruitSummonTriggers(state, player, minion);
  const battlecry = getMinionDefinition(minion.definitionId).battlecry;
  const triggerCount = battlecry ? battlecryTriggerCount(player) : 0;
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, minion, battlecry);
  }
  beginInteractiveBattlecry(state, player, minion);
  if (state.pendingInteraction === null) {
    beginOnPlayMinionChoice(state, player, minion);
  }
  if (state.pendingInteraction === null) {
    finishCardPlayed(state, player);
  }
  return true;
}

interface DestroyRecruitMinionOptions {
  returnToPool?: boolean;
}

function advanceRecruitDynamicEndOfTurnAvenge(
  player: PlayerState,
  watcher: BoardMinionInstance,
  effect: DynamicWarbandEndOfTurnEffect,
  scale: number,
): void {
  const progress =
    effectCounter(
      watcher,
      DYNAMIC_AVENGE_PROGRESS_COUNTER,
      0,
    ) + 1;
  if (progress < effect.avengeThreshold) {
    setEffectCounter(
      watcher,
      DYNAMIC_AVENGE_PROGRESS_COUNTER,
      progress,
    );
    return;
  }
  setEffectCounter(watcher, DYNAMIC_AVENGE_PROGRESS_COUNTER, 0);
  setEffectCounter(
    watcher,
    DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
    effectCounter(
      watcher,
      DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
      0,
    ) +
      effect.avengeAttack * scale,
  );
  setEffectCounter(
    watcher,
    DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
    effectCounter(
      watcher,
      DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
      0,
    ) +
      effect.avengeHealth * scale,
  );
  refreshDynamicMinionDescription(watcher, player);
}

function destroyRecruitMinion(
  state: GameState,
  player: PlayerState,
  instanceId: string,
  options: DestroyRecruitMinionOptions = {},
): BoardMinionInstance | null {
  const boardIndex = player.board.findIndex(
    (minion) => minion.instanceId === instanceId,
  );
  const source = player.board[boardIndex];
  if (!source) {
    return null;
  }

  player.board.splice(boardIndex, 1);
  if (options.returnToPool !== false) {
    returnMinionToPool(state, source);
  }
  observePersistentFriendlyDeath(player, source);
  for (const watcher of player.board) {
    for (const component of minionEffectSources(watcher)) {
      const definition = getMinionDefinition(component.definitionId);
      const trigger = definition.afterFriendlyDied;
      const scale = component.golden ? 2 : 1;
      if (trigger && friendlyDeathMatches(source, trigger)) {
        watcher.attack += (trigger.attack ?? 0) * scale;
        watcher.health += (trigger.health ?? 0) * scale;
        applyRecruitEffects(
          state,
          player,
          watcher,
          trigger.effects,
          scale,
        );
      }
      const dynamicEndOfTurn = definition.endOfTurn;
      if (dynamicEndOfTurn?.kind === "dynamicWarbandEndOfTurn") {
        advanceRecruitDynamicEndOfTurnAvenge(
          player,
          watcher,
          dynamicEndOfTurn,
          scale,
        );
      }
    }
  }

  const repetitions = 1 + extraDeathrattles(player.board);
  for (const component of minionEffectSources(source)) {
    const deathrattle =
      getMinionDefinition(component.definitionId).deathrattle;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      applyRecruitEffects(
        state,
        player,
        source,
        deathrattle,
        component.golden ? 2 : 1,
      );
    }
  }
  for (
    let count = 0;
    count < source.temporaryCrabDeathrattles * repetitions &&
    player.board.length < MAX_BOARD_SIZE;
    count += 1
  ) {
    const crab = createMinionInstance(state, "live-crab-token", 0);
    player.board.splice(
      Math.min(boardIndex + count, player.board.length),
      0,
      crab,
    );
    applyRecruitSummonTriggers(state, player, crab);
  }
  for (
    let count = 0;
    count <
      (source.temporaryGoldenCrabDeathrattles ?? 0) * repetitions &&
    player.board.length < MAX_BOARD_SIZE;
    count += 1
  ) {
    const crab = createMinionInstance(state, "live-crab-token", 0);
    makeGoldenToken(crab);
    player.board.splice(
      Math.min(
        boardIndex +
          source.temporaryCrabDeathrattles * repetitions +
          count,
        player.board.length,
      ),
      0,
      crab,
    );
    applyRecruitSummonTriggers(state, player, crab);
  }
  if (source.reborn && player.board.length < MAX_BOARD_SIZE) {
    const reborn = createMinionInstance(
      state,
      source.definitionId,
      0,
    );
    if (source.golden) {
      makeGoldenToken(reborn);
    }
    reborn.health = 1;
    reborn.reborn = false;
    applyOwnedUndeadArmyBonus(player, reborn);
    applyOwnedBeetleBonus(player, reborn);
    player.board.splice(
      Math.min(boardIndex, player.board.length),
      0,
      reborn,
    );
    applyRecruitSummonTriggers(state, player, reborn);
  }
  return source;
}

function resolveStirTheGraveyardDeath(
  state: GameState,
  player: PlayerState,
  instanceId: string,
): void {
  const source = player.board.find(
    (minion) => minion.instanceId === instanceId,
  );
  if (
    !source ||
    source.destroyAfterPlayThroughRound === undefined ||
    source.destroyAfterPlayThroughRound < state.round
  ) {
    return;
  }
  destroyRecruitMinion(state, player, instanceId);
}

function resolvePendingStirDeaths(
  state: GameState,
  player: PlayerState,
): void {
  for (const minion of [...player.board]) {
    if (
      minion.destroyAfterPlayThroughRound !== undefined &&
      minion.destroyAfterPlayThroughRound >= state.round
    ) {
      resolveStirTheGraveyardDeath(
        state,
        player,
        minion.instanceId,
      );
    }
  }
}

function magnetizeMinion(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  const target = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  if (
    handIndex < 0 ||
    card?.kind !== "minion" ||
    !target ||
    !canMagnetize(card, target) ||
    (card.playableFromRound ?? 0) > state.round
  ) {
    return false;
  }

  const [removed] = player.hand.splice(handIndex, 1);
  if (removed.kind !== "minion") {
    throw new Error("MAGNETIZE_MINION removed a non-minion hand card");
  }
  const source = removed;
  beginCardPlayed(player, {
    sourceInstanceId: source.instanceId,
    cardKind: "minion",
    tier: source.tier,
    tribe: source.tribe,
    tribes: [...source.tribes],
  });
  grantTripleRewardBeforeGeneratedCards(state, player, source);
  const battlecry = getMinionDefinition(source.definitionId).battlecry;
  const triggerCount = battlecry ? battlecryTriggerCount(player) : 0;
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, source, battlecry);
  }

  fuseMinionIntoHost(state, player, source, target);

  applyAfterMagnetizedEffects(state, player);
  finishCardPlayed(state, player);
  return true;
}

function fuseMinionIntoHost(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  target: BoardMinionInstance,
): void {
  // Patch 27.0 changed Battlegrounds Magnetic pool behavior: every pool copy
  // represented by the source returns immediately when it is Magnetized.
  // The attached component therefore retains its effects but carries zero
  // future pool contribution when the host is sold or eliminated.
  returnMinionToPool(state, source);
  target.attack += source.attack;
  target.health += source.health;
  target.bloodGemAttack += source.bloodGemAttack;
  target.bloodGemHealth += source.bloodGemHealth;
  target.temporaryAttack += source.temporaryAttack;
  target.temporaryHealth += source.temporaryHealth;
  target.temporaryCrabDeathrattles +=
    source.temporaryCrabDeathrattles;
  target.temporaryGoldenCrabDeathrattles =
    (target.temporaryGoldenCrabDeathrattles ?? 0) +
    (source.temporaryGoldenCrabDeathrattles ?? 0);
  if (source.temporaryTaunt && !target.taunt) {
    target.temporaryTaunt = true;
  }
  if (source.temporaryDivineShield && !target.divineShield) {
    target.temporaryDivineShield = true;
  }
  target.taunt ||= source.taunt;
  target.divineShield ||= source.divineShield;
  if (source.taunt && !source.temporaryTaunt) {
    target.temporaryTaunt = false;
  }
  if (
    source.divineShield &&
    !source.temporaryDivineShield
  ) {
    target.temporaryDivineShield = false;
  }
  target.reborn ||= source.reborn;
  if (source.stealth === true) {
    target.stealth = true;
  }
  target.poisonous ||= source.poisonous;
  target.venomous ||= source.venomous;
  target.windfury ||= source.windfury;
  target.cleave ||= source.cleave;
  target.alwaysAttacksLowestAttack ||=
    source.alwaysAttacksLowestAttack;
  if (source.effectSupport === "partial") {
    target.effectSupport = "partial";
  }
  target.attachments.push(createMagneticAttachment(source));
}

function castTripleReward(
  state: GameState,
  player: PlayerState,
  handIndex: number,
): boolean {
  const card = player.hand[handIndex];
  if (card?.kind !== "tripleReward") {
    return false;
  }
  player.hand.splice(handIndex, 1);
  beginCardPlayed(player, {
    sourceInstanceId: card.instanceId,
    cardKind: "other",
    tribes: [],
  });
  beginDiscoverInteraction(
    state,
    player,
    card.instanceId,
    { exactTier: card.tier },
    1,
    { kind: "hand" },
  );
  if (state.pendingInteraction === null) {
    finishCardPlayed(state, player);
  }
  return true;
}

function castBloodGem(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId: string,
  trace?: GameActionTrace,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  const target = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  if (handIndex < 0 || card?.kind !== "bloodGem" || !target) {
    return false;
  }
  player.hand.splice(handIndex, 1);
  beginCardPlayed(player, {
    sourceInstanceId: card.instanceId,
    cardKind: "other",
    tribes: [],
  });
  const pulseCount = 1 + bloodGemFromHandExtraCasts(player);
  for (let pulse = 0; pulse < pulseCount; pulse += 1) {
    applyRecruitBloodGemPulse(
      state,
      player,
      target,
      {
        bonusKeyword: card.bonusKeyword,
        origin: "hand",
        sourceInstanceId: card.instanceId,
      },
      trace,
    );
  }
  finishCardPlayed(state, player);
  return true;
}

function randomBoardSubset<T extends MinionInstance>(
  state: GameState,
  board: readonly T[],
  count: number,
): T[] {
  const candidates = [...board];
  const selected: T[] = [];
  while (candidates.length > 0 && selected.length < count) {
    selected.push(candidates.splice(randomIndex(state, candidates.length), 1)[0]);
  }
  return selected;
}

function buffMinions(
  minions: readonly BoardMinionInstance[],
  attack: number,
  health: number,
): void {
  for (const minion of minions) {
    minion.attack += attack;
    minion.health += health;
    reconcileConditionalMinion(minion);
  }
}

function buffMinionsFromTavernSpell(
  player: PlayerState,
  minions: readonly BoardMinionInstance[],
  attack: number,
  health: number,
  repetitions = 1,
): void {
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    buffMinions(
      minions,
      attack + player.tavernSpellAttackBonus,
      health + player.tavernSpellHealthBonus,
    );
  }
}

interface TavernSpellWarbandBuffPulse {
  attack: number;
  health: number;
  tribe?: Tribe;
}

function tavernSpellWarbandBuffPulses(
  effect: TavernSpellEffect,
): readonly TavernSpellWarbandBuffPulse[] | null {
  if (effect === "shinyRing") {
    return [{ attack: 1, health: 1 }];
  }
  if (effect === "queensCommand") {
    return [
      { attack: 2, health: 2 },
      { attack: 2, health: 2, tribe: "naga" },
    ];
  }
  return null;
}

function applyTavernSpellWarbandBuffPulses(
  player: PlayerState,
  effect: TavernSpellEffect,
): void {
  const pulses = tavernSpellWarbandBuffPulses(effect);
  if (!pulses) {
    throw new Error(`Tavern Spell ${effect} has no warband buff payload`);
  }
  for (const pulse of pulses) {
    buffMinionsFromTavernSpell(
      player,
      pulse.tribe
        ? player.board.filter((minion) =>
            minionHasTribe(minion, pulse.tribe),
          )
        : player.board,
      pulse.attack,
      pulse.health,
    );
  }
}

function applyTemporarySpellcraftBuff(
  target: BoardMinionInstance,
  attack: number,
  health: number,
  keywords: {
    taunt?: boolean;
    divineShield?: boolean;
  } = {},
): void {
  target.attack += attack;
  target.health += health;
  target.temporaryAttack += attack;
  target.temporaryHealth += health;
  if (keywords.taunt && !target.taunt) {
    target.taunt = true;
    target.temporaryTaunt = true;
  }
  if (keywords.divineShield && !target.divineShield) {
    target.divineShield = true;
    target.temporaryDivineShield = true;
  }
  reconcileConditionalMinion(target);
}

function clearTemporarySpellcraftBuffs(
  minion: BoardMinionInstance,
): void {
  minion.attack = Math.max(
    0,
    minion.attack - minion.temporaryAttack,
  );
  minion.health = Math.max(
    1,
    minion.health - minion.temporaryHealth,
  );
  minion.temporaryAttack = 0;
  minion.temporaryHealth = 0;
  if (minion.temporaryTaunt) {
    minion.taunt = false;
    minion.temporaryTaunt = false;
  }
  if (minion.temporaryDivineShield) {
    minion.divineShield = false;
    minion.temporaryDivineShield = false;
  }
  minion.temporaryCrabDeathrattles = 0;
  minion.temporaryGoldenCrabDeathrattles = 0;
}

function castSpellcraft(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId?: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  if (handIndex < 0 || card?.kind !== "spellcraft") {
    return false;
  }
  const definition = getSpellcraftDefinition(card.definitionId);
  const effectMultiplier = card.effectMultiplier ?? 1;
  const legalTargets = spellcraftLegalTargets(player, definition);
  const target = targetInstanceId
    ? legalTargets.find(
        (minion) => minion.instanceId === targetInstanceId,
      )
    : undefined;
  if (
    (spellcraftNeedsTarget(definition) && !target) ||
    (!spellcraftNeedsTarget(definition) &&
      targetInstanceId !== undefined)
  ) {
    return false;
  }

  player.hand.splice(handIndex, 1);
  beginCardPlayed(player, {
    sourceInstanceId: card.instanceId,
    cardKind: "other",
    tribes: [],
  });
  switch (definition.effect) {
    case "crabRider":
      if (target) {
        if (effectMultiplier > 1) {
          target.temporaryGoldenCrabDeathrattles =
            (target.temporaryGoldenCrabDeathrattles ?? 0) + 1;
        } else {
          target.temporaryCrabDeathrattles += 1;
        }
      }
      break;
    case "anglersLure":
      if (target) {
        applyTemporarySpellcraftBuff(
          target,
          2 * effectMultiplier,
          6 * effectMultiplier,
          {
            taunt: true,
          },
        );
      }
      break;
    case "glowingCrown":
      if (target) {
        applyTemporarySpellcraftBuff(target, 0, 0, {
          divineShield: true,
        });
      }
      break;
    case "sickRiffs":
      if (target) {
        applyTemporarySpellcraftBuff(
          target,
          player.tavernTier * effectMultiplier,
          player.tavernTier * effectMultiplier,
        );
      }
      break;
    case "deepBlueBlues":
      if (target) {
        const amount =
          (2 + player.deepBlueBonus) * effectMultiplier;
        applyTemporarySpellcraftBuff(target, amount, amount);
        player.deepBlueBonus += 1;
      }
      break;
    case "escapeEruption":
      if (player.isHuman) {
        state.pendingInteraction = {
          kind: "spellcraftChoice",
          interactionId: nextInteractionId(state),
          playerId: player.id,
          sourceInstanceId: card.instanceId,
          definitionId: definition.id,
          effectMultiplier,
          optionIds: [
            "escapeEruptionAttack",
            "escapeEruptionHealth",
          ],
        };
      } else {
        const totalAttack = player.board.reduce(
          (total, minion) => total + minion.attack,
          0,
        );
        const totalHealth = player.board.reduce(
          (total, minion) => total + minion.health,
          0,
        );
        const amount = 4 * effectMultiplier;
        buffMinions(
          player.board,
          totalAttack <= totalHealth ? amount : 0,
          totalAttack <= totalHealth ? 0 : amount,
        );
      }
      break;
    case "evolvingStrategy":
      addDrawnMinionToHand(
        state,
        player,
        drawMatchingFromPool(
          state,
          1,
          (candidate) =>
            candidate.tier === 1 &&
            definitionHasTribe(candidate, "naga"),
        ),
      );
      break;
    case "meditation":
      player.tavernSpellAttackBonus += effectMultiplier;
      player.tavernSpellHealthBonus += effectMultiplier;
      break;
    case "rimeOrReason":
      for (let count = 0; count < effectMultiplier; count += 1) {
        if (!addRandomStatTavernSpell(state, player)) {
          break;
        }
      }
      break;
  }
  if (state.pendingInteraction === null) {
    finishCardPlayed(state, player);
  }
  return true;
}

function mostCommonBoardTribe(player: PlayerState): Tribe | null {
  let best: Tribe | null = null;
  let bestCount = 0;
  for (const tribe of LOBBY_TRIBES) {
    const count = player.board.filter((minion) =>
      minionHasTribe(minion, tribe),
    ).length;
    if (count > bestCount) {
      best = tribe;
      bestCount = count;
    }
  }
  return best;
}

function addDrawnMinionToHand(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance | null,
): void {
  if (!minion) {
    return;
  }
  if (player.hand.length >= MAX_HAND_SIZE) {
    returnMinionToPool(state, minion);
    return;
  }
  claimGeneratedShopMinion(minion);
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  player.hand.push(minion);
  resolveTriples(state, player);
}

function addGeneratedMinionCopyToHand(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): void {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return;
  }
  const minion = createMinionInstance(state, definitionId, 0);
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  player.hand.push(minion);
  resolveTriples(state, player);
}

const STAT_GRANTING_TAVERN_SPELL_CARD_IDS = new Set<string>(
  RIME_OR_REASON_STAT_GRANTING_CARD_IDS,
);

function addRandomStatTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      STAT_GRANTING_TAVERN_SPELL_CARD_IDS.has(definition.cardId) &&
      tavernSpellIsAvailable(definition, state.activeTribes),
  );
  if (eligible.length === 0) {
    return false;
  }
  player.hand.push(
    createTavernSpell(
      state,
      eligible[randomIndex(state, eligible.length)],
    ),
  );
  return true;
}

function growingStartOfCombatBuffAmount(
  minion: MinionInstance,
  effect: StartOfCombatGrowingTribeBuffEffect,
): { attack: number; health: number } {
  const scale =
    minion.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
  return {
    attack:
      effect.attack * scale +
      effectCounter(
        minion,
        START_OF_COMBAT_ATTACK_BONUS_COUNTER,
        0,
      ),
    health:
      effect.health * scale +
      effectCounter(
        minion,
        START_OF_COMBAT_HEALTH_BONUS_COUNTER,
        0,
      ),
  };
}

function improveStartOfCombatBuff(
  minion: MinionInstance,
  effect: ImproveStartOfCombatBuffEffect,
  scale: number,
): { attackIncrease: number; healthIncrease: number } {
  const attackIncrease = effect.attack * scale;
  const healthIncrease = effect.health * scale;
  setEffectCounter(
    minion,
    START_OF_COMBAT_ATTACK_BONUS_COUNTER,
    effectCounter(
      minion,
      START_OF_COMBAT_ATTACK_BONUS_COUNTER,
      0,
    ) + attackIncrease,
  );
  setEffectCounter(
    minion,
    START_OF_COMBAT_HEALTH_BONUS_COUNTER,
    effectCounter(
      minion,
      START_OF_COMBAT_HEALTH_BONUS_COUNTER,
      0,
    ) + healthIncrease,
  );
  refreshDynamicMinionDescription(minion);
  return { attackIncrease, healthIncrease };
}

function applyAfterTavernSpellCastTriggers(
  state: GameState,
  player: PlayerState,
): void {
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      const effects =
        getMinionDefinition(component.definitionId)
          .afterTavernSpellCast ?? [];
      const scale = component.golden ? 2 : 1;
      for (const effect of effects) {
        if (effect.kind === "improveStartOfCombatBuff") {
          improveStartOfCombatBuff(source, effect, scale);
          continue;
        }
        if (
          effect.kind === "buff" ||
          effect.kind === "improveUndeadArmy"
        ) {
          applyRecruitEffects(
            state,
            player,
            source,
            [effect],
            scale,
          );
          continue;
        }
        if (effect.kind === "onePerTribe") {
          applyOnePerTribeBuff(
            state,
            player.board,
            effect.attack * scale,
            effect.health * scale,
          );
          continue;
        }
        if (effect.kind === "buffKeyword") {
          buffMinions(
            player.board.filter(
              (target) =>
                effect.keyword === "divineShield" &&
                target.divineShield,
            ),
            effect.attack * scale,
            effect.health * scale,
          );
        }
      }
    }
  }
}

function finishTavernSpellCast(
  state: GameState,
  player: PlayerState,
): void {
  if (player.pendingTavernSpellDefinitionId) {
    player.lastTavernSpellDefinitionId =
      player.pendingTavernSpellDefinitionId;
    player.pendingTavernSpellDefinitionId = null;
  }
  player.tavernSpellsCastThisTurn += 1;
  applyAfterTavernSpellCastTriggers(state, player);
  finishCardPlayed(state, player);
}

function resolveTriggeredRecruitTavernSpell(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): void {
  const definition = getTavernSpellDefinition(definitionId);
  if (tavernSpellNeedsTarget(definition)) {
    throw new Error(
      `Triggered Tavern Spell ${definition.id} requires a target`,
    );
  }
  const spell = createTavernSpell(state, definition);
  if (
    !applyTavernSpellEffect(
      state,
      player,
      spell,
      definition,
      undefined,
    )
  ) {
    throw new Error(
      `Triggered Tavern Spell ${definition.id} did not finish synchronously`,
    );
  }
  player.lastTavernSpellDefinitionId = definition.id;
  player.tavernSpellsCastThisTurn += 1;
  applyAfterTavernSpellCastTriggers(state, player);
}

function chefsChoiceMatches(
  candidate: (typeof MINION_DEFINITIONS)[number],
  target: MinionInstance,
): boolean {
  if (candidate.id === target.definitionId) {
    return false;
  }
  if (target.tribes.includes("all")) {
    return LOBBY_TRIBES.some((tribe) =>
      definitionHasTribe(candidate, tribe),
    );
  }
  const targetTribes = target.tribes.filter(
    (tribe) => tribe !== "neutral" && tribe !== "all",
  );
  return targetTribes.some((tribe) =>
    definitionHasTribe(candidate, tribe),
  );
}

function transformMinionKeepingStats(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
): boolean {
  const wasInShop = player.shop.includes(target);
  const replacementTier = Math.min(6, target.tier + 1) as MutableTier;
  const replacement = drawMatchingFromPool(
    state,
    replacementTier,
    (candidate) => candidate.tier === replacementTier,
  );
  if (!replacement) {
    return false;
  }
  const replacementBaseAttack = replacement.attack;
  const replacementBaseHealth = replacement.health;
  if (wasInShop) {
    applyPersistentTavernBonuses(player, replacement);
  }
  const preserved = {
    instanceId: target.instanceId,
    attack:
      target.attack +
      (replacement.attack - replacementBaseAttack),
    health:
      target.health +
      (replacement.health - replacementBaseHealth),
    // This special transform keeps only the final numbers, not the old
    // enchantment provenance. Later Gem Confiscation must not recover Blood
    // Gems that were already baked into the transformed minion's stats.
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: target.temporaryAttack,
    temporaryHealth: target.temporaryHealth,
    temporaryTaunt: false,
    temporaryDivineShield: false,
  };
  returnMinionToPool(state, target);
  delete target.poolCopiesOnPurchase;
  Object.assign(target, replacement, preserved);
  reconcileWhereverMinion(
    target,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  if (player.board.includes(target)) {
    resolveTriples(state, player);
  }
  return true;
}

function adjacentRecruitMinions(
  player: PlayerState,
  target: BoardMinionInstance,
): BoardMinionInstance[] {
  const boardIndex = player.board.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  if (boardIndex >= 0) {
    return [player.board[boardIndex - 1], player.board[boardIndex + 1]]
      .filter(
        (minion): minion is BoardMinionInstance =>
          minion !== undefined,
      );
  }

  const shopIndex = player.shop.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  if (shopIndex < 0) {
    return [];
  }
  const displayOffers: Array<
    | { kind: "minion"; minion: BoardMinionInstance }
    | { kind: "spell"; spell: TavernSpellInstance }
  > = player.shop.map((minion) => ({ kind: "minion", minion }));
  for (const spell of tavernSpellShopOffers(player)) {
    const spellPosition =
      [...spell.instanceId].reduce(
        (hash, character) =>
          (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0,
        5381,
      ) %
      (displayOffers.length + 1);
    displayOffers.splice(spellPosition, 0, { kind: "spell", spell });
  }
  const targetDisplayIndex = displayOffers.findIndex(
    (offer) =>
      offer.kind === "minion" &&
      offer.minion.instanceId === target.instanceId,
  );
  return [targetDisplayIndex - 1, targetDisplayIndex + 1].flatMap(
    (displayIndex) => {
      const offer = displayOffers[displayIndex];
      return offer?.kind === "minion" ? [offer.minion] : [];
    },
  );
}

function selectDistinctMinionsByTribe<T extends MinionInstance>(
  state: GameState,
  board: readonly T[],
): T[] {
  const tribes = [...LOBBY_TRIBES];
  shuffleInPlace(state, tribes);
  const assignedTribeByInstance = new Map<string, Tribe>();

  const assign = (tribe: Tribe, visited: Set<string>): boolean => {
    const candidates = board.filter((minion) =>
      minionHasTribe(minion, tribe),
    );
    shuffleInPlace(state, candidates);
    for (const candidate of candidates) {
      if (visited.has(candidate.instanceId)) {
        continue;
      }
      visited.add(candidate.instanceId);
      const previousTribe = assignedTribeByInstance.get(
        candidate.instanceId,
      );
      if (
        previousTribe === undefined ||
        assign(previousTribe, visited)
      ) {
        assignedTribeByInstance.set(candidate.instanceId, tribe);
        return true;
      }
    }
    return false;
  };

  for (const tribe of tribes) {
    assign(tribe, new Set<string>());
  }
  const selectedIds = new Set(assignedTribeByInstance.keys());
  return board.filter((minion) => selectedIds.has(minion.instanceId));
}

function heroPowerAiScore(
  player: PlayerState,
  definition: HeroPowerDefinition,
): number {
  switch (definition.effect) {
    case "upgradeDiscount":
      return player.tavernTier < 6 ? 9 : 1;
    case "gainGoldAfterUpgrade":
      return player.tavernTier < 6 ? 8 : 1;
    case "freeRefreshAtTurnStart":
      return 7;
    case "buffCombatSummons":
      return 4 + player.board.filter((minion) => {
        const minionDefinition = getMinionDefinition(minion.definitionId);
        return minionDefinition.deathrattle?.some(
          (effect) => effect.kind === "summon",
        );
      }).length;
  }
}

function beginHeroPowerChoice(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
  definition: TavernSpellDefinition,
): boolean {
  const candidates = HERO_POWER_DEFINITIONS.filter(
    (candidate) => candidate.id !== player.heroPowerId,
  ).map((candidate) => ({ ...candidate }));
  shuffleInPlace(state, candidates);
  const options = candidates.slice(0, 3);
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    player.heroPowerId = [...options].sort((left, right) => {
      const scoreDifference =
        heroPowerAiScore(player, right) -
        heroPowerAiScore(player, left);
      return scoreDifference !== 0
        ? scoreDifference
        : left.id.localeCompare(right.id);
    })[0].id;
    return false;
  }
  state.pendingInteraction = {
    kind: "heroPowerChoice",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: spell.instanceId,
    definitionId: definition.id,
    optionIds: options.map((option) => option.id),
  };
  return true;
}

function refreshWithTavernSpells(
  state: GameState,
  player: PlayerState,
): boolean {
  releaseShop(state, player);
  player.frozen = false;
  player.spellOnlyRefreshActive = true;
  const excluded = new Set(["tavern-spell-saloons-finest"]);
  const offers: TavernSpellInstance[] = [];
  while (offers.length < tavernCardCapacity(player)) {
    const offer = drawTavernSpell(
      state,
      player.tavernTier,
      excluded,
    );
    if (!offer) {
      break;
    }
    offers.push(offer);
  }
  const populated = offers.length > 0;
  player.spellShop = offers.shift() ?? null;
  player.additionalSpellShop = offers;
  return populated;
}

type LiveMinionDefinition = (typeof MINION_DEFINITIONS)[number];

function specialRefreshDefinitions(
  state: GameState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
  matches: (definition: LiveMinionDefinition) => boolean,
): LiveMinionDefinition[] {
  return MINION_DEFINITIONS.filter(
    (definition) =>
      definition.collectible !== false &&
      definitionIsAvailable(definition, state.activeTribes) &&
      definition.tier >= minimumTier &&
      definition.tier <= maximumTier &&
      matches(definition),
  );
}

function drawOrGenerateSpecialMinion(
  state: GameState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
  matches: (definition: LiveMinionDefinition) => boolean,
  generateBeyondPool: boolean,
): BoardMinionInstance | null {
  const candidates = specialRefreshDefinitions(
    state,
    maximumTier,
    minimumTier,
    matches,
  );
  if (candidates.length === 0) {
    return null;
  }
  const pooled = drawMatchingFromPool(
    state,
    maximumTier,
    (definition) =>
      definition.tier >= minimumTier && matches(definition),
  );
  if (pooled || !generateBeyondPool) {
    return pooled;
  }
  // Wisdomball overflow is outside the pool while offered. Buying or stealing
  // it turns it into one returnable copy; releasing an unbought offer does not.
  const generated = createMinionInstance(
    state,
    candidates[randomIndex(state, candidates.length)].id,
    0,
  );
  generated.poolCopiesOnPurchase = 1;
  return generated;
}

function addSpecialShopMinion(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  applyPersistentTavernBonuses(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  player.shop.push(minion);
}

function drawOrGenerateSpecificWisdomballCopy(
  state: GameState,
  definitionId: string,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const pooled = drawMatchingFromPool(
    state,
    definition.tier,
    (candidate) => candidate.id === definitionId,
  );
  if (pooled) {
    return pooled;
  }
  const generated = createMinionInstance(state, definitionId, 0);
  if (definition.collectible !== false) {
    generated.poolCopiesOnPurchase = 1;
  }
  return generated;
}

function fillSpecialMinionPage(
  state: GameState,
  player: PlayerState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
  matches: (definition: LiveMinionDefinition) => boolean,
  generateBeyondPool: boolean,
): boolean {
  const capacity = tavernCardCapacity(player);
  while (player.shop.length < capacity) {
    const minion = drawOrGenerateSpecialMinion(
      state,
      maximumTier,
      minimumTier,
      matches,
      generateBeyondPool,
    );
    if (!minion) {
      break;
    }
    addSpecialShopMinion(player, minion);
  }
  if (player.shop.length === 0) {
    return false;
  }
  return true;
}

function fillWarbandCopyPage(
  state: GameState,
  player: PlayerState,
): boolean {
  const sources = player.board.slice(0, tavernCardCapacity(player));
  if (sources.length === 0) {
    return false;
  }
  for (const source of sources) {
    addSpecialShopMinion(
      player,
      drawOrGenerateSpecificWisdomballCopy(
        state,
        source.definitionId,
      ),
    );
  }
  return true;
}

function mostCommonActiveBoardTribe(
  state: GameState,
  player: PlayerState,
): Tribe | null {
  const counts = state.activeTribes.map((tribe) => ({
    tribe,
    count: player.board.filter((minion) =>
      minionHasTribe(minion, tribe),
    ).length,
  }));
  const bestCount = Math.max(0, ...counts.map(({ count }) => count));
  if (bestCount === 0) {
    return null;
  }
  const tied = counts.filter(({ count }) => count === bestCount);
  return tied[randomIndex(state, tied.length)]?.tribe ?? null;
}

function helpfulTripleCandidates(
  player: PlayerState,
): Array<{ definitionId: string; copiesNeeded: number }> {
  const definitionIds = new Set(
    [...player.board, ...player.hand]
      .filter(
        (card): card is BoardMinionInstance =>
          card.kind === "minion" && !card.golden,
      )
      .map((minion) => minion.definitionId),
  );
  return [...definitionIds]
    .map((definitionId) => {
      const owned = ownedNormalCount(player, definitionId);
      return {
        definitionId,
        copiesNeeded: Math.max(0, 3 - owned),
      };
    })
    .filter(
      ({ copiesNeeded }) => copiesNeeded > 0 && copiesNeeded <= 2,
    );
}

function fillHelpfulTriplePage(
  state: GameState,
  player: PlayerState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
): boolean {
  const candidates = helpfulTripleCandidates(player);
  const chosen = candidates[randomIndex(state, candidates.length)];
  if (!chosen) {
    return false;
  }
  for (let count = 0; count < chosen.copiesNeeded; count += 1) {
    addSpecialShopMinion(
      player,
      drawOrGenerateSpecificWisdomballCopy(
        state,
        chosen.definitionId,
      ),
    );
  }
  return fillSpecialMinionPage(
    state,
    player,
    maximumTier,
    minimumTier,
    () => true,
    true,
  );
}

function populateHelpfulRefresh(
  state: GameState,
  player: PlayerState,
  kind: HelpfulRefreshKind,
): boolean {
  if (kind !== "allSpells") {
    player.spellOnlyRefreshActive = false;
  }
  const maximumTier = player.tavernTier;
  const minimumTier = 1 as TavernTier;
  switch (kind) {
    case "warbandCopies":
      return fillWarbandCopyPage(state, player);
    case "legendary":
      return fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        (definition) => definition.legendary === true,
        true,
      );
    case "golden": {
      const populated = fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        () => true,
        true,
      );
      if (!populated) {
        return false;
      }
      const target =
        player.shop[randomIndex(state, player.shop.length)];
      makeMinionGoldenPreservingEnchantments(target);
      reconcileWhereverMinion(
        target,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
      );
      return true;
    }
    case "triple":
      return fillHelpfulTriplePage(
        state,
        player,
        maximumTier,
        minimumTier,
      );
    case "divineShield": {
      const populated = fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        () => true,
        true,
      );
      if (populated) {
        player.shop.forEach((minion) => {
          minion.divineShield = true;
        });
      }
      return populated;
    }
    case "tavernBuff": {
      const populated = fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        () => true,
        true,
      );
      if (populated) {
        buffMinions(
          player.shop,
          player.tavernTier,
          player.tavernTier,
        );
      }
      return populated;
    }
    case "majorityTribe": {
      const tribe = mostCommonActiveBoardTribe(state, player);
      return (
        tribe !== null &&
        fillSpecialMinionPage(
          state,
          player,
          maximumTier,
          minimumTier,
          (definition) => definitionHasTribe(definition, tribe),
          true,
        )
      );
    }
    case "highTier":
      return fillSpecialMinionPage(
        state,
        player,
        6,
        player.tavernTier,
        () => true,
        true,
      );
    case "allSame": {
      const candidates = specialRefreshDefinitions(
        state,
        maximumTier,
        minimumTier,
        () => true,
      );
      if (candidates.length === 0) {
        return false;
      }
      const definitionId =
        candidates[randomIndex(state, candidates.length)].id;
      return fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        (definition) => definition.id === definitionId,
        true,
      );
    }
    case "utility":
      return fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        (definition) =>
          HELPFUL_UTILITY_MINION_IDS.has(definition.id),
        true,
      );
    case "allSpells":
      return refreshWithTavernSpells(state, player);
  }
}

function refreshWithWisdomball(
  state: GameState,
  player: PlayerState,
  applyRefreshEffects = true,
): HelpfulRefreshKind | null {
  releaseShop(state, player);
  player.frozen = false;
  const kinds = [...HELPFUL_REFRESH_KINDS];
  shuffleInPlace(state, kinds);
  for (const kind of kinds) {
    if (populateHelpfulRefresh(state, player, kind)) {
      player.lastHelpfulRefreshKind = kind;
      if (applyRefreshEffects) {
        applyAfterTavernRefreshEffects(state, player);
      }
      return kind;
    }
  }
  releaseShop(state, player);
  fillShop(state, player, false);
  if (applyRefreshEffects) {
    applyAfterTavernRefreshEffects(state, player);
  }
  player.lastHelpfulRefreshKind = null;
  return null;
}

function hamuulTargetTribe(
  state: GameState,
  target: BoardMinionInstance,
): Tribe | null {
  if (target.tribes.includes("all")) {
    return state.activeTribes[
      randomIndex(state, state.activeTribes.length)
    ] ?? null;
  }
  const printed = target.tribes.filter(
    (tribe) => tribe !== "neutral" && tribe !== "all",
  );
  const active = printed.filter((tribe) =>
    state.activeTribes.includes(tribe),
  );
  const candidates = active.length > 0 ? active : printed;
  return candidates[randomIndex(state, candidates.length)] ?? null;
}

function refreshWithHamuul(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  const tribe = hamuulTargetTribe(state, target);
  releaseShop(state, player);
  player.frozen = false;
  if (tribe) {
    const populated = fillSpecialMinionPage(
      state,
      player,
      player.tavernTier,
      1,
      (definition) => definitionHasTribe(definition, tribe),
      false,
    );
    if (populated) {
      applyAfterTavernRefreshEffects(state, player);
    }
  }
}

function applyTavernSpellEffect(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
  definition: TavernSpellDefinition,
  target: BoardMinionInstance | undefined,
): boolean {
  switch (definition.effect) {
    case "discoverTierOne":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        { exactTier: 1 },
        1,
        { kind: "hand" },
        "tavernSpellCast",
      );
      break;
    case "stealRandomShopMinion": {
      if (player.shop.length === 0) {
        break;
      }
      const [stolen] = player.shop.splice(
        randomIndex(state, player.shop.length),
        1,
      );
      addDrawnMinionToHand(state, player, stolen);
      break;
    }
    case "fortify":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 0, 3);
        target.taunt = true;
        target.temporaryTaunt = false;
      }
      break;
    case "pointyArrow":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 4, 0);
      }
      break;
    case "recruitTrainee":
      addDrawnMinionToHand(
        state,
        player,
        drawMatchingFromPool(state, 1, (candidate) => candidate.tier === 1),
      );
      break;
    case "gainOneGold":
      player.gold += 1;
      break;
    case "tavernDishBanana":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 2, 2);
      }
      break;
    case "themApples":
      buffMinionsFromTavernSpell(player, player.shop, 1, 2);
      break;
    case "chefsChoice": {
      if (!target) {
        break;
      }
      const minion = drawMatchingFromPool(
        state,
        player.tavernTier,
        (candidate) => chefsChoiceMatches(candidate, target),
      );
      if (!minion) {
        addConsolationCoin(state, player);
      } else {
        addDrawnMinionToHand(state, player, minion);
      }
      break;
    }
    case "hastyExcavation":
      player.gold += 1;
      break;
    case "searchThePast":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        { exactTier: player.tavernTier },
        1,
        {
          kind: "hand",
          playableFromRound: state.round + 1,
        },
        "tavernSpellCast",
      );
      break;
    case "freeRefreshes":
      player.freeRefreshes += 2;
      break;
    case "mightOfStormwind":
      buffMinionsFromTavernSpell(
        player,
        randomBoardSubset(state, player.board, 4),
        1,
        2,
      );
      break;
    case "increaseMaxGold":
      player.maxGold += 1;
      break;
    case "carefulInvestment":
      player.pendingNextTurnGold += 2;
      break;
    case "fleetingVigor":
      player.nextCombatAttackBonus +=
        2 + player.tavernSpellAttackBonus;
      player.nextCombatHealthBonus +=
        1 + player.tavernSpellHealthBonus;
      break;
    case "friendlyBounty": {
      const tribe = mostCommonBoardTribe(player);
      addDrawnMinionToHand(
        state,
        player,
        tribe
          ? drawMatchingFromPool(
              state,
              player.tavernTier,
              (candidate) => definitionHasTribe(candidate, tribe),
            )
          : null,
      );
      break;
    }
    case "healthyBounty":
      buffMinionsFromTavernSpell(
        player,
        randomBoardSubset(state, player.board, 4),
        0,
        4,
      );
      break;
    case "hostileBounty":
      buffMinionsFromTavernSpell(
        player,
        randomBoardSubset(state, player.board, 4),
        4,
        0,
      );
      break;
    case "selfishBounty":
      if (player.board[0]) {
        buffMinionsFromTavernSpell(
          player,
          [player.board[0]],
          6,
          6,
        );
      }
      break;
    case "shinyRing":
      applyTavernSpellWarbandBuffPulses(
        player,
        definition.effect,
      );
      break;
    case "staffOfEnrichment": {
      const attack = 2 + player.tavernSpellAttackBonus;
      const health = 2 + player.tavernSpellHealthBonus;
      player.tavernMinionAttackBonus += attack;
      player.tavernMinionHealthBonus += health;
      buffMinions(player.shop, attack, health);
      break;
    }
    case "trickyTrousers":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 1, 2);
        target.taunt = !target.taunt;
        target.temporaryTaunt = false;
      }
      break;
    case "gainTwoGold":
      player.gold += 2;
      break;
    case "planarTelescope": {
      const tribe = mostCommonBoardTribe(player);
      const discovered =
        tribe !== null &&
        beginDiscoverInteraction(
          state,
          player,
          spell.instanceId,
          { maximumTier: player.tavernTier, tribe },
          1,
          { kind: "hand" },
          "tavernSpellCast",
        );
      if (!discovered) {
        addConsolationCoin(state, player);
      }
      break;
    }
    case "hubris":
      player.nextCombatWinGold += 3;
      player.nextCombatTieGold += 1;
      break;
    case "carefulMutation":
      if (target) {
        transformMinionKeepingStats(state, player, target);
      }
      break;
    case "timeManagement":
      if (player.isHuman) {
        state.pendingInteraction = {
          kind: "tavernSpellChoice",
          interactionId: nextInteractionId(state),
          playerId: player.id,
          sourceInstanceId: spell.instanceId,
          definitionId: definition.id,
          optionIds: [
            "timeManagementNow",
            "timeManagementNextTurn",
          ],
        };
        return false;
      }
      {
        const profile = getAiStrategyProfile(player.id);
        const needsImmediateTempo =
          player.health + player.armor <
            profile.minimumUpgradeHealth ||
          player.board.length < aiTargetBoardSize(state.round);
        if (needsImmediateTempo) {
          buffMinionsFromTavernSpell(
            player,
            player.board,
            2,
            2,
          );
        } else {
          player.nextTurnBoardAttackBonus +=
            (2 + player.tavernSpellAttackBonus) * 2;
          player.nextTurnBoardHealthBonus +=
            (2 + player.tavernSpellHealthBonus) * 2;
          player.nextTurnBoardBuffPulses += 2;
        }
      }
      break;
    case "stackedAvalanche": {
      if (!target) {
        break;
      }
      const boardIndex = player.board.findIndex(
        (minion) => minion.instanceId === target.instanceId,
      );
      const sold = sellMinionTransaction(state, player, boardIndex);
      const leftmostElemental = player.board.find((minion) =>
        minionHasTribe(minion, "elemental"),
      );
      if (sold && leftmostElemental) {
        buffMinionsFromTavernSpell(
          player,
          [leftmostElemental],
          sold.attack,
          sold.health,
        );
      }
      break;
    }
    case "bloodGemBarrage":
      player.tavernBloodGemBarrageCount += 1;
      player.tavernBloodGemBarrageAttack +=
        player.tavernSpellAttackBonus;
      player.tavernBloodGemBarrageHealth +=
        player.tavernSpellHealthBonus;
      break;
    case "cloneHorn": {
      const original = drawMatchingFromPool(
        state,
        player.tavernTier,
        (candidate) => definitionHasTribe(candidate, "murloc"),
      );
      if (original) {
        const definitionId = original.definitionId;
        addDrawnMinionToHand(state, player, original);
        addGeneratedMinionCopyToHand(state, player, definitionId);
      }
      break;
    }
    case "beetleBlessing":
      player.nextCombatBeetles += 2;
      break;
    case "slimySeafood":
      addRandomSpellcraftSpells(state, player, 3);
      break;
    case "gemConfiscation": {
      if (!target) {
        break;
      }
      applyRecruitBloodGemPulse(state, player, target);
      applyRecruitBloodGemPulse(state, player, target);
      for (const neighbor of adjacentRecruitMinions(player, target)) {
        const stolenAttack = neighbor.bloodGemAttack;
        const stolenHealth = neighbor.bloodGemHealth;
        neighbor.attack = Math.max(
          0,
          neighbor.attack - stolenAttack,
        );
        neighbor.health = Math.max(
          1,
          neighbor.health - stolenHealth,
        );
        neighbor.bloodGemAttack = 0;
        neighbor.bloodGemHealth = 0;
        target.attack += stolenAttack;
        target.health += stolenHealth;
        target.bloodGemAttack += stolenAttack;
        target.bloodGemHealth += stolenHealth;
      }
      break;
    }
    case "backToBack":
      if (target) {
        const repetitions =
          1 + Math.floor(player.backToBackBonus / 4);
        buffMinionsFromTavernSpell(
          player,
          [target],
          4,
          4,
          repetitions,
        );
        player.backToBackBonus += 4;
      }
      break;
    case "deepwaterClan":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 2, 2);
        buffMinionsFromTavernSpell(
          player,
          player.board.filter((minion) =>
            minionHasTribe(minion, "murloc"),
          ),
          2,
          2,
        );
      }
      break;
    case "defendersRites":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 6, 6);
        target.taunt = true;
        target.temporaryTaunt = false;
      }
      break;
    case "misplacedTeaSet": {
      const selected = selectDistinctMinionsByTribe(
        state,
        player.board,
      );
      buffMinionsFromTavernSpell(player, selected, 2, 2);
      break;
    }
    case "naturalBlessing":
      if (target) {
        const allRecruitMinions = [...player.board, ...player.shop];
        const targetTribes = target.tribes.filter(
          (tribe) => tribe !== "neutral" && tribe !== "all",
        );
        const matches = target.tribes.includes("all")
          ? allRecruitMinions.filter((minion) =>
              minion.tribes.some((tribe) => tribe !== "neutral"),
            )
          : targetTribes.length === 0
            ? []
            : allRecruitMinions.filter((minion) =>
                targetTribes.some((tribe) =>
                  minionHasTribe(minion, tribe),
                ),
              );
        buffMinionsFromTavernSpell(player, matches, 3, 3);
      }
      break;
    case "shiftingTide":
      if (target) {
        const repetitions = minionHasTribe(target, "naga") ? 4 : 2;
        buffMinionsFromTavernSpell(
          player,
          [target],
          1,
          1,
          repetitions,
        );
      }
      break;
    case "temperatureShift":
      for (const definitionId of ["BG31_816", "BG31_818"]) {
        addDrawnMinionToHand(
          state,
          player,
          drawMatchingFromPool(
            state,
            player.tavernTier,
            (candidate) => candidate.id === definitionId,
          ),
        );
      }
      break;
    case "rideTheWind":
      player.rideTheWindBuffs.push({
        attack: 6 + player.tavernSpellAttackBonus,
        health: 6 + player.tavernSpellHealthBonus,
      });
      break;
    case "stirTheGraveyard":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        {
          maximumTier: player.tavernTier,
          tribe: "undead",
        },
        1,
        {
          kind: "hand",
          destroyAfterPlayThroughRound: state.round,
        },
        "tavernSpellCast",
      );
      break;
    case "blazingInferno":
      if (target) {
        const amount = 4 + player.elementalsPlayedThisTurn;
        buffMinionsFromTavernSpell(
          player,
          [target],
          amount,
          amount,
        );
      }
      break;
    case "arcaneAbsorption":
      if (target && player.shop.length > 0) {
        const highestHealth = Math.max(
          ...player.shop.map((minion) => minion.health),
        );
        const sources = player.shop.filter(
          (minion) => minion.health === highestHealth,
        );
        const source = sources[randomIndex(state, sources.length)];
        buffMinionsFromTavernSpell(
          player,
          [target],
          Math.floor(source.attack / 2),
          Math.floor(source.health / 2),
        );
      }
      break;
    case "eonarsFavor":
      if (target) {
        const tribes = target.tribes.includes("all")
          ? [...LOBBY_TRIBES]
          : target.tribes.filter(
              (tribe) => tribe !== "neutral" && tribe !== "all",
            );
        const buff = {
          tribes,
          attack: 3 + player.tavernSpellAttackBonus,
          health: 3 + player.tavernSpellHealthBonus,
        };
        player.tavernTypeBuffs.push(buff);
        buffMinions(
          player.shop.filter(
            (minion) =>
              tribes.length > 0 &&
              (minion.tribes.includes("all") ||
                tribes.some((tribe) =>
                  minionHasTribe(minion, tribe),
                )),
          ),
          buff.attack,
          buff.health,
        );
      }
      break;
    case "armorStash":
      player.armor = 5;
      break;
    case "overpowered":
      player.nextCombatSetEnemyHealthToOne += 1;
      break;
    case "slaughter":
      if (target) {
        const destroyed = destroyRecruitMinion(
          state,
          player,
          target.instanceId,
        );
        if (destroyed) {
          const attack =
            5 + player.tavernSpellAttackBonus;
          const health = player.tavernSpellHealthBonus;
          player.undeadArmyAttackBonus += attack;
          player.undeadArmyHealthBonus += health;
          for (const minion of [
            ...player.board,
            ...player.hand.filter(
              (card): card is BoardMinionInstance =>
                card.kind === "minion",
            ),
          ]) {
            if (minionHasTribe(minion, "undead")) {
              minion.attack += attack;
              minion.health += health;
            }
          }
        }
      }
      break;
    case "corruptedCupcakes":
      if (target && player.shop.length > 0) {
        let attack = 0;
        let health = 0;
        for (
          let count = 0;
          count < 3 && player.shop.length > 0;
          count += 1
        ) {
          const [consumed] = player.shop.splice(
            randomIndex(state, player.shop.length),
            1,
          );
          attack += consumed.attack;
          health += consumed.health;
          returnMinionToPool(state, consumed);
        }
        buffMinionsFromTavernSpell(
          player,
          [target],
          attack,
          health,
        );
      }
      break;
    case "goldenTouch": {
      const candidates = player.shop.filter(
        (minion) => !minion.golden,
      );
      if (candidates.length > 0) {
        const goldenTarget =
          candidates[randomIndex(state, candidates.length)];
        makeMinionGoldenPreservingEnchantments(goldenTarget);
        reconcileWhereverMinion(
          goldenTarget,
          player.astralAutomatonsSummoned ?? 0,
          player.eternalKnightsDied ?? 0,
        );
      }
      break;
    }
    case "saloonsFinest":
      refreshWithTavernSpells(state, player);
      break;
    case "reservedCorpse":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        {
          maximumTier: player.tavernTier,
          ability: "deathrattle",
        },
        1,
        { kind: "hand" },
        "tavernSpellCast",
      );
      break;
    case "headhunter":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        {
          maximumTier: player.tavernTier,
          ability: "battlecry",
        },
        1,
        { kind: "hand" },
        "tavernSpellCast",
      );
      break;
    case "nozdormusProgeny":
      player.nextCombatDoubleLeftmostAttack.push({
        attack: player.tavernSpellAttackBonus,
        health: player.tavernSpellHealthBonus,
      });
      break;
    case "invokeTheDevourer":
      if (target) {
        const boardIndex = player.board.findIndex(
          (minion) => minion.instanceId === target.instanceId,
        );
        const sold = sellMinionTransaction(
          state,
          player,
          boardIndex,
        );
        if (sold && player.board.length > 0) {
          const recipient =
            player.board[randomIndex(state, player.board.length)];
          buffMinionsFromTavernSpell(
            player,
            [recipient],
            sold.attack,
            sold.health,
          );
        }
      }
      break;
    case "unmaskedIdentity":
      if (
        beginHeroPowerChoice(
          state,
          player,
          spell,
          definition,
        )
      ) {
        return false;
      }
      break;
    case "queensCommand":
      applyTavernSpellWarbandBuffPulses(
        player,
        definition.effect,
      );
      break;
    case "sanctify":
      buffMinionsFromTavernSpell(
        player,
        player.board.filter((minion) => minion.divineShield),
        6,
        0,
      );
      break;
    case "waveOfGold":
      buffMinionsFromTavernSpell(player, player.board, 3, 2);
      buffMinionsFromTavernSpell(
        player,
        player.board.filter((minion) => minion.golden),
        3,
        2,
      );
      break;
    case "azeriteEmpowerment":
      buffMinionsFromTavernSpell(player, player.board, 2, 2, 2);
      break;
    case "perfectVision":
      if (target) {
        target.attack =
          20 +
          target.temporaryAttack +
          player.tavernSpellAttackBonus;
        target.health =
          20 +
          target.temporaryHealth +
          player.tavernSpellHealthBonus;
      }
      break;
    case "knockoffWisdomball":
      player.helpfulRefreshes += 2;
      break;
    case "eyesOfTheEarthMother":
      if (target) {
        makeMinionGoldenPreservingEnchantments(target);
        reconcileWhereverMinion(
          target,
          player.astralAutomatonsSummoned ?? 0,
          player.eternalKnightsDied ?? 0,
        );
      }
      break;
    case "lostStaffOfHamuul":
      if (target) {
        refreshWithHamuul(state, player, target);
      }
      break;
  }
  if (
    player.isHuman &&
    state.pendingInteraction?.kind === "discover" &&
    state.pendingInteraction.completionSource === "tavernSpellCast"
  ) {
    return false;
  }
  return true;
}

function castTavernSpell(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId?: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  if (handIndex < 0 || card?.kind !== "tavernSpell") {
    return false;
  }
  const definition = getTavernSpellDefinition(card.definitionId);
  const legalTargets = tavernSpellLegalTargets(player, definition);
  const target = targetInstanceId
    ? legalTargets.find(
        (minion) => minion.instanceId === targetInstanceId,
      )
    : undefined;
  if (
    (tavernSpellNeedsTarget(definition) && !target) ||
    (!tavernSpellNeedsTarget(definition) && targetInstanceId !== undefined)
  ) {
    return false;
  }
  player.hand.splice(handIndex, 1);
  beginCardPlayed(player, {
    sourceInstanceId: card.instanceId,
    cardKind: "tavernSpell",
    tier: definition.tier,
    tribes: [],
  });
  player.pendingTavernSpellDefinitionId = definition.id;
  const finished = applyTavernSpellEffect(
    state,
    player,
    card,
    definition,
    target,
  );
  if (finished) {
    finishTavernSpellCast(state, player);
  }
  return true;
}

function playHandCard(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  boardIndex?: number,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  if (handIndex < 0) {
    return false;
  }
  const card = player.hand[handIndex];
  if (card.kind === "minion") {
    return playMinion(state, player, handIndex, boardIndex);
  }
  if (card.kind === "consolationCoin") {
    player.hand.splice(handIndex, 1);
    beginCardPlayed(player, {
      sourceInstanceId: card.instanceId,
      cardKind: "other",
      tribes: [],
    });
    player.gold += 1;
    finishCardPlayed(state, player);
    return true;
  }
  return card.kind === "tripleReward"
    ? castTripleReward(state, player, handIndex)
    : false;
}

function refreshShop(state: GameState, player: PlayerState): boolean {
  const refreshCost = player.freeRefreshes > 0 ? 0 : REFRESH_COST;
  if (player.gold < refreshCost) {
    return false;
  }
  if (player.freeRefreshes > 0) {
    player.freeRefreshes -= 1;
  } else {
    spendGold(state, player, refreshCost);
  }
  player.frozen = false;
  if (player.helpfulRefreshes > 0) {
    const helpfulKind = refreshWithWisdomball(state, player, false);
    if (helpfulKind !== null) {
      player.helpfulRefreshes -= 1;
    }
    applyQueuedDemonFodderToRefresh(state, player);
    applyAfterTavernRefreshEffects(state, player);
    return true;
  }
  player.lastHelpfulRefreshKind = null;
  releaseShop(state, player);
  fillShop(state, player, false);
  applyQueuedDemonFodderToRefresh(state, player);
  applyAfterTavernRefreshEffects(state, player);
  return true;
}

function upgradeTavern(state: GameState, player: PlayerState): boolean {
  if (player.tavernTier >= 6) {
    return false;
  }
  const cost = getUpgradeCost(state, player.id);
  if (player.gold < cost) {
    return false;
  }
  spendGold(state, player, cost);
  player.tavernTier = (player.tavernTier + 1) as MutableTier;
  player.upgradeDiscount = 0;
  if (playerHasHeroPower(player, "gainGoldAfterUpgrade")) {
    player.gold += 2;
  }
  return true;
}

function ownedNormalCount(player: PlayerState, definitionId: string): number {
  return [...player.board, ...player.hand].filter(
    (minion) =>
      minion.kind === "minion" &&
      minion.definitionId === definitionId && minion.golden === false,
  ).length;
}

function tribeCount(player: PlayerState, tribe: Tribe): number {
  return player.board.filter((minion) => minionHasTribe(minion, tribe)).length;
}

const AI_ECONOMY_EFFECT_KINDS = new Set<MinionEffect["kind"]>([
  "gainGold",
  "gainNextTurnGold",
  "gainFreeRefreshes",
  "gainTavernSpell",
  "gainRandomTavernSpell",
  "gainMinion",
  "gainRandomGeneratedMinion",
  "getRandomMinion",
  "gainBloodGems",
  "discountNextTavernSpell",
  "installTavernRefreshBuff",
  "buffTavernTier",
]);

function combatTavernSpellSourceWeight(
  minion: BoardMinionInstance,
): number {
  let weight = 0;
  for (const component of minionEffectSources(minion)) {
    const definition = getMinionDefinition(component.definitionId);
    const scale = component.golden ? 2 : 1;
    weight +=
      (definition.deathrattle ?? []).filter(
        (effect) => effect.kind === "castTavernSpell",
      ).length * scale;
    weight +=
      (definition.rally ?? []).filter(
        (effect) =>
          effect.kind === "castTavernSpell" ||
          effect.kind === "castChefsChoice",
      ).length * scale;
    weight +=
      (definition.afterFriendlyAttacks ?? []).filter(
        (effect) => effect.kind === "castTavernSpell",
      ).length * scale;
  }
  return weight;
}

function estimatedCombatSummonsOfTribe(
  board: readonly BoardMinionInstance[],
  tribe: Tribe,
): number {
  let summons = board.filter(
    (minion) => minion.reborn && minionHasTribe(minion, tribe),
  ).length;
  for (const minion of board) {
    for (const component of minionEffectSources(minion)) {
      const definition = getMinionDefinition(component.definitionId);
      for (const effect of [
        ...(definition.deathrattle ?? []),
        ...(definition.afterSelfDamaged ?? []),
      ]) {
        if (
          effect.kind !== "summon" ||
          !definitionHasTribe(
            getMinionDefinition(effect.definitionId),
            tribe,
          )
        ) {
          continue;
        }
        const baseCount =
          typeof effect.count === "number"
            ? effect.count
            : Math.min(3, Math.max(0, minion.attack));
        summons +=
          baseCount *
          (component.golden && effect.goldenMode === "doubleCount"
            ? 2
            : 1);
      }
    }
  }
  return Math.min(MAX_BOARD_SIZE - 1, summons);
}

function minionScore(
  player: PlayerState,
  minion: BoardMinionInstance,
): number {
  const profile = getAiStrategyProfile(player.id);
  let score = (minion.attack + minion.health) * profile.statWeight;
  if (minion.divineShield) {
    score += Math.max(3, minion.attack * 0.65);
  }
  if (minion.taunt) {
    score += 1.5;
  }
  if (minion.poisonous || minion.venomous) {
    score += 8;
  }
  if (minion.reborn) {
    score += 4;
  }
  if (minion.cleave) {
    score += Math.max(3, minion.attack * 0.6);
  }
  if (minion.windfury) {
    score += Math.max(3, minion.attack * 0.5);
  }
  const definitions = minionEffectSources(minion).map((component) =>
    getMinionDefinition(component.definitionId),
  );
  const battlecryScale = battlecryTriggerCount(player);
  const deathrattleScale = 1 + extraDeathrattles(player.board);
  if (definitions.some((definition) => definition.deathrattle)) {
    score += profile.deathrattleBonus * deathrattleScale;
  }
  if (definitions.some((definition) => definition.battlecry)) {
    score += profile.battlecryBonus * battlecryScale;
  }
  const projectedBoard = boardWithCandidate(player, minion);
  const projectedBeetleCount =
    player.nextCombatBeetles +
    projectedBoard.reduce(
      (total, candidate) => total + beetleSummonCount(candidate),
      0,
    );
  const candidateBeetleSummons = beetleSummonCount(minion);
  const growth = beetleGrowthPotential(minion);
  const candidateAlreadyOwned = player.board.some(
    (owned) => owned.instanceId === minion.instanceId,
  );
  const expectedGrowth =
    (candidateAlreadyOwned ? 0 : growth.battlecry * battlecryScale) +
    growth.deathrattle * deathrattleScale +
    growth.selfDamaged * 2;
  const beetleStatValue =
    4 + player.beetleAttackBonus + player.beetleHealthBonus;
  score +=
    candidateBeetleSummons *
    beetleStatValue *
    deathrattleScale *
    0.32;
  score +=
    expectedGrowth *
    Math.max(1, projectedBeetleCount) *
    0.28;
  for (const definition of definitions) {
    const consumeEffect = (definition.battlecry ?? []).find(
      (effect) => effect.kind === "consumeRandomShopMinion",
    );
    if (consumeEffect) {
      const edible = player.shop.filter(
        (offer) => offer.instanceId !== minion.instanceId,
      );
      const averageStats =
        edible.length === 0
          ? 0
          : edible.reduce(
              (total, offer) =>
                total + offer.attack + offer.health,
              0,
            ) / edible.length;
      score +=
        averageStats *
        (minion.golden &&
        consumeEffect.goldenMode === "doubleStats"
          ? 2
          : 1) *
        0.7;
    }
    for (const effect of definition.deathrattle ?? []) {
      if (effect.kind === "applyBloodGemsToTribe") {
        const eligibleTargets = projectedBoard.filter(
          (target) =>
            target.instanceId !== minion.instanceId &&
            minionHasTribe(target, effect.tribe),
        ).length;
        score +=
          eligibleTargets *
          effect.count *
          (minion.golden ? 2 : 1) *
          (player.bloodGemAttack + player.bloodGemHealth) *
          deathrattleScale *
          0.3;
      } else if (
        effect.kind === "summon" &&
        effect.bloodGemsPerSummon !== undefined &&
        typeof effect.count === "number"
      ) {
        const doublesCount =
          minion.golden && effect.goldenMode === "doubleCount";
        const summonCount =
          effect.count * (doublesCount ? 2 : 1);
        const availableSpace = Math.max(
          0,
          MAX_BOARD_SIZE - projectedBoard.length + 1,
        );
        const expectedSummons = Math.min(
          summonCount,
          availableSpace,
        );
        const token = getMinionDefinition(effect.definitionId);
        const goldenToken =
          minion.golden && !doublesCount;
        const gemCount = bloodGemsPerSummonedToken(
          effect,
          minion.golden,
        );
        score +=
          expectedSummons *
          ((token.attack + token.health) *
            (goldenToken ? 2 : 1) +
            gemCount *
              (player.bloodGemAttack +
                player.bloodGemHealth)) *
          deathrattleScale *
          0.3;
      } else if (effect.kind === "installTavernRefreshBuff") {
        const repetitions =
          minion.golden && effect.goldenMode === "repeat" ? 2 : 1;
        score +=
          (effect.attack + effect.health) *
          repetitions *
          deathrattleScale *
          0.45;
      } else if (effect.kind === "improveUndeadArmy") {
        const eligibleTargets = [
          ...projectedBoard,
          ...player.hand.filter(
            (card): card is BoardMinionInstance =>
              card.kind === "minion",
          ),
        ].filter((target) =>
          minionHasTribe(target, "undead"),
        ).length;
        score +=
          Math.max(1, eligibleTargets) *
          (effect.attack + effect.health) *
          (minion.golden ? 2 : 1) *
          deathrattleScale *
          0.35;
      }
    }
    for (const effect of definition.afterSelfDamaged ?? []) {
      if (effect.kind === "gainFreeRefreshes") {
        const expectedTriggers = Math.min(
          effect.maxTriggersPerTurn ?? 2,
          2,
        );
        score +=
          effect.count *
          (minion.golden ? 2 : 1) *
          expectedTriggers *
          (1.25 + profile.economyBonus * 0.15);
      } else if (effect.kind === "buff") {
        const eligibleTargets = projectedBoard.filter(
          (target) => target.instanceId !== minion.instanceId,
        ).length;
        score +=
          eligibleTargets *
          (effect.attack + effect.health) *
          (minion.golden ? 2 : 1) *
          0.55;
      }
    }
    const summonTrigger = definition.afterFriendlySummoned;
    if (summonTrigger) {
      const observedCombatSummons = estimatedCombatSummonsOfTribe(
        projectedBoard,
        summonTrigger.tribe,
      );
      const estimatedSummons = summonTrigger.combatOnly
        ? observedCombatSummons
        : Math.max(1, observedCombatSummons);
      const scale = minion.golden ? 2 : 1;
      if (summonTrigger.attackMultiplier !== undefined) {
        const multiplier = minion.golden
          ? (summonTrigger.goldenAttackMultiplier ??
            summonTrigger.attackMultiplier)
          : summonTrigger.attackMultiplier;
        score += estimatedSummons * (multiplier - 1) * 2.4;
      } else if (
        summonTrigger.permanentAttackGrowth !== undefined
      ) {
        const currentAttack =
          (summonTrigger.attack ?? 0) * scale +
          effectCounter(
            minion,
            SUMMON_ATTACK_GROWTH_COUNTER,
            0,
          );
        const growth =
          summonTrigger.permanentAttackGrowth * scale;
        score +=
          estimatedSummons *
            (currentAttack +
              (growth * Math.max(0, estimatedSummons - 1)) / 2) *
            0.45 +
          currentAttack * 0.25;
      } else if (!summonTrigger.grantShield) {
        score +=
          estimatedSummons *
          ((summonTrigger.attack ?? 0) +
            (summonTrigger.health ?? 0)) *
          scale *
          0.35;
      }
    }
    const damagedTrigger = definition.afterFriendlyDamaged;
    if (damagedTrigger) {
      const observedMinions = projectedBoard.filter(
        (target) =>
          minionHasTribe(target, damagedTrigger.tribe) &&
          (!damagedTrigger.otherOnly ||
            target.instanceId !== minion.instanceId),
      ).length;
      const expectedTriggers = Math.min(3, observedMinions);
      score +=
        expectedTriggers *
        (damagedTrigger.attack + damagedTrigger.health) *
        (minion.golden ? 2 : 1) *
          (damagedTrigger.target === "self" ? 0.7 : 0.55);
    }
    const damageDealtTrigger =
      definition.afterFriendlyDealsDamage;
    if (damageDealtTrigger) {
      const observedDemons = projectedBoard.filter(
        (target) =>
          minionHasTribe(target, damageDealtTrigger.tribe) &&
          (!damageDealtTrigger.otherSourceOnly ||
            target.instanceId !== minion.instanceId),
      ).length;
      const targetCount =
        damageDealtTrigger.target === "self"
          ? 1
          : Math.max(0, projectedBoard.length - 1);
      score +=
        Math.min(3, observedDemons) *
        targetCount *
        (damageDealtTrigger.attack +
          damageDealtTrigger.health) *
        (minion.golden ? 2 : 1) *
        (damageDealtTrigger.permanent ? 0.5 : 0.28);
    }
    if (definition.spellcraft) {
      score += 3;
    }
    const combatTavernSpellExtraCasts =
      definition.combatTavernSpellExtraCasts ?? 0;
    if (combatTavernSpellExtraCasts > 0) {
      const extraCasts =
        combatTavernSpellExtraCasts *
        (minion.golden ? 2 : 1);
      score +=
        player.board.reduce(
          (total, candidate) =>
            total + combatTavernSpellSourceWeight(candidate),
          0,
        ) *
        extraCasts *
        2.5;
    }
    if (
      definition.onPlayChoice?.kind === "bloodGemImproveOrGain" &&
      !player.board.some(
        (owned) => owned.instanceId === minion.instanceId,
      )
    ) {
      const branchScores = bloodGemAiBranchScores(
        player,
        minion,
        false,
      );
      score +=
        Math.max(
          branchScores.gainScore,
          branchScores.improveScore,
        ) * 0.35;
    }
    if (definition.bloodGemFromHandAura) {
      const extraCasts =
        definition.bloodGemFromHandAura.extraCasts *
        (minion.golden &&
        definition.bloodGemFromHandAura.goldenMode === "doubleCount"
          ? 2
          : 1);
      const projectedBoard = boardWithCandidate(player, minion);
      const expectedGems = estimatedNearTermHandBloodGems(player);
      const redirects =
        1 + bestUsefulRoogugRedirectCount(projectedBoard);
      score +=
        extraCasts *
        expectedGems *
        redirects *
        (player.bloodGemAttack + player.bloodGemHealth) *
        0.45;
    }
    if (
      definition.afterBloodGemCastOnSelf?.kind ===
      "playBloodGemsOnRandomOther"
    ) {
      const projectedBoard = boardWithCandidate(player, minion);
      const count = roogugRedirectCount(minion);
      if (hasRoogugRedirectTarget(projectedBoard, minion)) {
        const expectedHandPulses =
          estimatedNearTermHandBloodGems(player) *
          bloodGemHandCastMultiplier(projectedBoard);
        const expectedComposerPulses =
          composerBloodGemPulsesOnTarget(projectedBoard, minion);
        score +=
          count *
          (expectedHandPulses + expectedComposerPulses) *
          (player.bloodGemAttack + player.bloodGemHealth) *
          0.45;
      }
    }
    if (definition.id === COMPOSER_BRISTLEBACK_DEFINITION_ID) {
      const withoutComposer = player.board.filter(
        (owned) => owned.instanceId !== minion.instanceId,
      );
      const withComposer = boardWithCandidate(player, minion);
      const marginalApplications = Math.max(
        0,
        composerBloodGemApplications(withComposer) -
          composerBloodGemApplications(withoutComposer),
      );
      score +=
        marginalApplications *
        (player.bloodGemAttack + player.bloodGemHealth) *
        0.35;
    }
    if (definition.afterCardPurchased) {
      score += 2.5;
    }
    if (definition.conditionalKeyword) {
      score += 2;
    }
    const retention = definition.combatEnchantmentRetention;
    if (retention?.target === "self") {
      score += minion.golden ? 5 : 3;
    } else if (retention?.target === "adjacentFriendlyTribe") {
      const eligibleNeighbors = player.board.filter(
        (target) =>
          target.instanceId !== minion.instanceId &&
          (!retention.tribe ||
            minionHasTribe(target, retention.tribe)),
      ).length;
      score +=
        Math.min(2, eligibleNeighbors) * (minion.golden ? 4 : 2);
    }
    const growingStartOfCombat = definition.startOfCombat?.find(
      (effect) => effect.kind === "growingTribeBuff",
    );
    if (growingStartOfCombat?.kind === "growingTribeBuff") {
      const amount = growingStartOfCombatBuffAmount(
        minion,
        growingStartOfCombat,
      );
      const eligibleTargets = player.board.filter((target) =>
        minionHasTribe(target, growingStartOfCombat.tribe),
      ).length;
      score +=
        Math.max(1, eligibleTargets) *
        (amount.attack + amount.health) *
        0.45;
    }
    for (const effect of definition.afterFriendlyAttacks ?? []) {
      if (effect.kind === "buffAttacker") {
        const eligibleAttackers = player.board.filter(
          (target) =>
            target.instanceId !== minion.instanceId &&
            target.attack > 0 &&
            (!effect.tribe ||
              minionHasTribe(target, effect.tribe)),
        ).length;
        const scale =
          minion.golden &&
          effect.goldenMode === "doubleStats"
            ? 2
            : 1;
        score +=
          eligibleAttackers *
          (effect.attack + effect.health) *
          scale *
          0.65;
      } else if (effect.kind === "castTavernSpell") {
        const repetitions =
          minion.golden && effect.goldenMode === "repeat" ? 2 : 1;
        const likelyAttackers = Math.max(
          1,
          player.board.filter((target) => target.attack > 0).length,
        );
        score +=
          likelyAttackers *
          player.board.length *
          repetitions *
          0.55;
      }
    }
    if (
      definition.afterAttackKills?.kind ===
      "excessDamageToAdjacent"
    ) {
      score += minion.attack * (minion.golden ? 0.8 : 0.55);
    }
    for (const effect of definition.rally ?? []) {
      if (effect.kind === "grantSourceMaxHealth") {
        const eligibleTargets = player.board.filter(
          (target) =>
            target.definitionId !== minion.definitionId &&
            minionHasTribe(target, effect.tribe),
        ).length;
        const repetitions =
          minion.golden && effect.goldenMode === "repeat" ? 2 : 1;
        score +=
          Math.min(effect.count, eligibleTargets) *
          minion.health *
          repetitions *
          0.25;
      } else if (effect.kind === "triggerLeftmostDeathrattle") {
        const target = player.board.find(
          (candidate) =>
            candidate.instanceId !== minion.instanceId &&
            minionHasTriggerableDeathrattle(candidate),
        );
        if (target) {
          const repetitions =
            minion.golden && effect.goldenMode === "repeat" ? 2 : 1;
          score +=
            (6 + (target.attack + target.health) * 0.08) *
            repetitions;
        }
      }
    }
    if (
      definition.endOfTurn?.kind ===
      "periodicGainRandomMinion"
    ) {
      score += profile.economyBonus + 2;
    }
  }
  if (
    definitions.some(
      (definition) =>
        (definition.battlecry ?? []).some((effect) =>
          AI_ECONOMY_EFFECT_KINDS.has(effect.kind),
        ) ||
        (definition.deathrattle ?? []).some((effect) =>
          AI_ECONOMY_EFFECT_KINDS.has(effect.kind),
        ) ||
        (definition.afterSold ?? []).some((effect) =>
          AI_ECONOMY_EFFECT_KINDS.has(effect.kind),
        ) ||
        (definition.afterSelfDamaged ?? []).some((effect) =>
          AI_ECONOMY_EFFECT_KINDS.has(effect.kind),
        ) ||
        (definition.sellValueAfterLoss ??
          definition.sellValue ??
          1) > 1,
    )
  ) {
    score += profile.economyBonus;
  }
  if (
    definitions.some((definition) => definition.magnetic) &&
    player.board.some((target) => canMagnetize(minion, target))
  ) {
    score += profile.magneticBonus;
  }
  const synergyTribes = minion.tribes.filter(
    (tribe) => tribe !== "all" && tribe !== "neutral",
  );
  const strongestTribeCount = synergyTribes.reduce(
    (best, tribe) => Math.max(best, tribeCount(player, tribe)),
    0,
  );
  score += strongestTribeCount * profile.synergyWeight;
  if (
    profile.preferredTribe !== null &&
    minionHasTribe(minion, profile.preferredTribe)
  ) {
    const committedCopies = tribeCount(player, profile.preferredTribe);
    const commitment =
      committedCopies >= 2 ? 1 : committedCopies === 1 ? 0.55 : 0.15;
    score += profile.preferredTribeBonus * commitment;
  }
  score += minion.tier * profile.highTierBonus;
  const copies = ownedNormalCount(player, minion.definitionId);
  if (copies === 1) {
    score += profile.pairBonus;
  } else if (copies >= 2) {
    score += profile.tripleBonus;
  }
  return score;
}

export function scoreMinionForAi(
  player: PlayerState,
  minion: BoardMinionInstance,
): number {
  return minionScore(player, minion);
}

function bestMinionByScore(
  player: PlayerState,
  options: readonly BoardMinionInstance[],
): BoardMinionInstance {
  return [...options].sort((left, right) => {
    const scoreDifference =
      minionScore(player, right) - minionScore(player, left);
    return scoreDifference !== 0
      ? scoreDifference
      : left.instanceId.localeCompare(right.instanceId);
  })[0];
}

function returnDiscoverOptions(
  state: GameState,
  options: readonly BoardMinionInstance[],
  selectedInstanceId?: string,
): void {
  for (const option of options) {
    if (option.instanceId !== selectedInstanceId) {
      returnMinionToPool(state, option);
    }
  }
}

function beginDiscoverInteraction(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  filter: DiscoverFilter,
  discoveries: number,
  destination: DiscoverDestination,
  completionSource?: PendingDiscoverInteraction["completionSource"],
): boolean {
  if (
    discoveries <= 0 ||
    (destination.kind === "hand" &&
      player.hand.length >= MAX_HAND_SIZE) ||
    state.pendingInteraction !== null
  ) {
    return false;
  }
  const options = reserveDiscoverOptions(state, filter);
  for (const option of options) {
    reconcileWhereverMinion(
      option,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
    );
  }
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    const selected = bestMinionByScore(player, options);
    returnDiscoverOptions(state, options, selected.instanceId);
    if (destination.kind === "hand") {
      if (destination.playableFromRound !== undefined) {
        selected.playableFromRound = destination.playableFromRound;
      }
      if (destination.destroyAfterPlayThroughRound !== undefined) {
        selected.destroyAfterPlayThroughRound =
          destination.destroyAfterPlayThroughRound;
      }
      applyOwnedUndeadArmyBonus(player, selected);
      applyOwnedBeetleBonus(player, selected);
      reconcileWhereverMinion(
        selected,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
      );
      player.hand.push(selected);
      resolveTriples(state, player);
    } else {
      const target = player.board.find(
        (minion) =>
          minion.instanceId === destination.targetInstanceId,
      );
      if (!target) {
        returnMinionToPool(state, selected);
        return false;
      }
      fuseMinionIntoHost(state, player, selected, target);
      applyAfterMagnetizedEffects(state, player);
    }
    beginDiscoverInteraction(
      state,
      player,
      sourceInstanceId,
      filter,
      discoveries - 1,
      destination,
      completionSource,
    );
    return true;
  }
  const interaction: PendingDiscoverInteraction = {
    kind: "discover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId,
    options,
    filter: { ...filter },
    remainingDiscoveries: discoveries,
    destination: { ...destination },
    completionSource,
  };
  state.pendingInteraction = interaction;
  return true;
}

function beginInteractiveBattlecry(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
): void {
  const ability = getMinionDefinition(
    source.definitionId,
  ).interactiveBattlecry;
  if (!ability) {
    return;
  }
  const goldenRepetitions =
    source.golden && ability.goldenMode === "repeat" ? 2 : 1;
  const repetitions =
    battlecryTriggerCount(player) * goldenRepetitions;
  if (ability.kind === "discoverMinion") {
    if (
      ability.requiresOtherTribe &&
      !player.board.some(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, ability.requiresOtherTribe),
      )
    ) {
      return;
    }
    beginDiscoverInteraction(
      state,
      player,
      source.instanceId,
      {
        maximumTier: player.tavernTier,
        tribe: ability.tribe,
      },
      repetitions,
      { kind: "hand" },
    );
    return;
  }

  if (ability.kind === "targetedDiscoverMagnetize") {
    const candidates = player.board.filter(
      (minion) =>
        minion.instanceId !== source.instanceId &&
        minionHasTribe(minion, ability.targetTribe),
    );
    if (candidates.length === 0) {
      return;
    }
    const filter: DiscoverFilter = {
      maximumTier: player.tavernTier,
      tribe: ability.discoverTribe,
    };
    if (!player.isHuman) {
      const target = bestMinionByScore(player, candidates);
      beginDiscoverInteraction(
        state,
        player,
        source.instanceId,
        filter,
        repetitions,
        {
          kind: "magnetize",
          targetInstanceId: target.instanceId,
        },
      );
      return;
    }
    state.pendingInteraction = {
      kind: "magnetizeTarget",
      interactionId: nextInteractionId(state),
      playerId: player.id,
      sourceInstanceId: source.instanceId,
      optionInstanceIds: candidates.map(
        (minion) => minion.instanceId,
      ),
      filter,
      remainingDiscoveries: repetitions,
    };
    return;
  }

  const candidates =
    ability.target === "friendlyTribe"
      ? player.board.filter((minion) =>
          minionHasTribe(minion, ability.targetTribe),
        )
      : player.board.filter(
          (minion) => minion.instanceId !== source.instanceId,
        );
  if (candidates.length === 0) {
    return;
  }
  const attack =
    ability.attack +
    ability.attackPerTavernSpell * player.tavernSpellsCastThisTurn +
    (ability.attackPerGoldSpentThisTurn ?? 0) *
      player.goldSpentThisTurn;
  const health =
    ability.health +
    ability.healthPerTavernSpell * player.tavernSpellsCastThisTurn +
    (ability.healthPerGoldSpentThisTurn ?? 0) *
      player.goldSpentThisTurn;
  if (!player.isHuman) {
    const target = bestMinionByScore(player, candidates);
    target.attack += attack * repetitions;
    target.health += health * repetitions;
    return;
  }
  state.pendingInteraction = {
    kind: "target",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: source.instanceId,
    optionInstanceIds: candidates.map((minion) => minion.instanceId),
    attack,
    health,
    repetitions,
  };
}

function resolvePendingInteraction(
  state: GameState,
  action: Extract<GameAction, { type: "RESOLVE_INTERACTION" }>,
): GameState {
  const pending = state.pendingInteraction;
  if (
    !pending ||
    pending.interactionId !== action.interactionId ||
    pending.playerId !== state.humanPlayerId
  ) {
    return state;
  }
  const player = findPlayer(state, pending.playerId);
  if (!player) {
    return state;
  }
  if (pending.kind === "target") {
    if (!pending.optionInstanceIds.includes(action.optionInstanceId)) {
      return state;
    }
    const target = player.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!target) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextTarget = nextPlayer?.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!nextPlayer || !nextTarget) {
      return state;
    }
    nextTarget.attack += pending.attack * pending.repetitions;
    nextTarget.health += pending.health * pending.repetitions;
    next.pendingInteraction = null;
    finishCardPlayed(next, nextPlayer);
    return next;
  }

  if (pending.kind === "magnetizeTarget") {
    if (!pending.optionInstanceIds.includes(action.optionInstanceId)) {
      return state;
    }
    const target = player.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!target) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextTarget = nextPlayer?.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!nextPlayer || !nextTarget) {
      return state;
    }
    next.pendingInteraction = null;
    const continued = beginDiscoverInteraction(
      next,
      nextPlayer,
      pending.sourceInstanceId,
      pending.filter,
      pending.remainingDiscoveries,
      {
        kind: "magnetize",
        targetInstanceId: nextTarget.instanceId,
      },
    );
    if (!continued) {
      finishCardPlayed(next, nextPlayer);
    }
    return next;
  }

  if (pending.kind === "tavernSpellChoice") {
    if (
      !pending.optionIds.includes(
        action.optionInstanceId as TavernSpellChoiceId,
      )
    ) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    if (
      !nextPlayer ||
      nextPending?.kind !== "tavernSpellChoice"
    ) {
      return state;
    }
    if (action.optionInstanceId === "timeManagementNow") {
      buffMinionsFromTavernSpell(
        nextPlayer,
        nextPlayer.board,
        2,
        2,
      );
    } else {
      nextPlayer.nextTurnBoardAttackBonus +=
        (2 + nextPlayer.tavernSpellAttackBonus) * 2;
      nextPlayer.nextTurnBoardHealthBonus +=
        (2 + nextPlayer.tavernSpellHealthBonus) * 2;
      nextPlayer.nextTurnBoardBuffPulses += 2;
    }
    next.pendingInteraction = null;
    finishTavernSpellCast(next, nextPlayer);
    return next;
  }

  if (pending.kind === "heroPowerChoice") {
    if (!pending.optionIds.includes(action.optionInstanceId)) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    if (
      !nextPlayer ||
      nextPending?.kind !== "heroPowerChoice"
    ) {
      return state;
    }
    try {
      getHeroPowerDefinition(action.optionInstanceId);
    } catch {
      return state;
    }
    nextPlayer.heroPowerId = action.optionInstanceId;
    next.pendingInteraction = null;
    finishTavernSpellCast(next, nextPlayer);
    return next;
  }

  if (pending.kind === "minionChoice") {
    if (
      pending.definitionId !== FEARLESS_FOODIE_DEFINITION_ID ||
      !pending.optionIds.includes(
        action.optionInstanceId as MinionChoiceId,
      )
    ) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    const source = nextPlayer?.board.find(
      (minion) =>
        minion.instanceId === pending.sourceInstanceId &&
        minion.definitionId === pending.definitionId,
    );
    if (
      !nextPlayer ||
      !source ||
      nextPending?.kind !== "minionChoice" ||
      !applyBloodGemImproveOrGainChoice(
        next,
        nextPlayer,
        source,
        action.optionInstanceId as MinionChoiceId,
        pending.effectMultiplier,
      )
    ) {
      return state;
    }
    next.pendingInteraction = null;
    finishCardPlayed(next, nextPlayer);
    return next;
  }

  if (pending.kind === "spellcraftChoice") {
    if (
      action.optionInstanceId !== "escapeEruptionAttack" &&
      action.optionInstanceId !== "escapeEruptionHealth"
    ) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    if (!nextPlayer) {
      return state;
    }
    const amount = 4 * (pending.effectMultiplier ?? 1);
    if (action.optionInstanceId === "escapeEruptionAttack") {
      buffMinions(nextPlayer.board, amount, 0);
    } else {
      buffMinions(nextPlayer.board, 0, amount);
    }
    next.pendingInteraction = null;
    finishCardPlayed(next, nextPlayer);
    return next;
  }

  const selected = pending.options.find(
    (option) => option.instanceId === action.optionInstanceId,
  );
  if (
    !selected ||
    (pending.destination.kind === "hand" &&
      player.hand.length >= MAX_HAND_SIZE)
  ) {
    return state;
  }
  const next = cloneState(state);
  const nextPlayer = findPlayer(next, pending.playerId);
  const nextPending = next.pendingInteraction;
  if (!nextPlayer || nextPending?.kind !== "discover") {
    return state;
  }
  const nextSelected = nextPending.options.find(
    (option) => option.instanceId === action.optionInstanceId,
  );
  if (!nextSelected) {
    return state;
  }
  returnDiscoverOptions(
    next,
    nextPending.options,
    nextSelected.instanceId,
  );
  const destination = nextPending.destination;
  if (destination.kind === "hand") {
    if (destination.playableFromRound !== undefined) {
      nextSelected.playableFromRound = destination.playableFromRound;
    }
    if (destination.destroyAfterPlayThroughRound !== undefined) {
      nextSelected.destroyAfterPlayThroughRound =
        destination.destroyAfterPlayThroughRound;
    }
    applyOwnedUndeadArmyBonus(nextPlayer, nextSelected);
    applyOwnedBeetleBonus(nextPlayer, nextSelected);
    reconcileWhereverMinion(
      nextSelected,
      nextPlayer.astralAutomatonsSummoned ?? 0,
      nextPlayer.eternalKnightsDied ?? 0,
    );
    nextPlayer.hand.push(nextSelected);
    resolveTriples(next, nextPlayer);
  } else {
    const target = nextPlayer.board.find(
      (minion) =>
        minion.instanceId === destination.targetInstanceId,
    );
    if (!target) {
      returnMinionToPool(next, nextSelected);
      next.pendingInteraction = null;
      finishCardPlayed(next, nextPlayer);
      return next;
    }
    fuseMinionIntoHost(next, nextPlayer, nextSelected, target);
    applyAfterMagnetizedEffects(next, nextPlayer);
  }
  next.pendingInteraction = null;
  const continued = beginDiscoverInteraction(
    next,
    nextPlayer,
    nextPending.sourceInstanceId,
    nextPending.filter,
    nextPending.remainingDiscoveries - 1,
    destination,
    nextPending.completionSource,
  );
  if (
    !continued &&
    nextPending.completionSource === "tavernSpellCast"
  ) {
    finishTavernSpellCast(next, nextPlayer);
  } else if (!continued) {
    finishCardPlayed(next, nextPlayer);
  }
  return next;
}

function playBestAiBloodGem(
  state: GameState,
  player: PlayerState,
): boolean {
  const gem = player.hand.find(
    (card): card is BloodGemSpellInstance => card.kind === "bloodGem",
  );
  if (!gem || player.board.length === 0) {
    return false;
  }
  const keywordTargets =
    gem.bonusKeyword === "rebornForQuilboar"
      ? player.board.filter(
          (minion) => minionHasTribe(minion, "quilboar") && !minion.reborn,
        )
      : gem.bonusKeyword === "divineShieldForQuilboar"
        ? player.board.filter(
            (minion) =>
              minionHasTribe(minion, "quilboar") &&
              !minion.divineShield,
          )
        : [];
  const usefulRoogugs = player.board.filter(
    (minion) =>
      minionHasEffectSource(
        minion,
        GEOMAGUS_ROOGUG_DEFINITION_ID,
      ) &&
      player.board.some(
        (candidate) =>
          candidate.instanceId !== minion.instanceId &&
          !minionHasEffectSource(
            candidate,
            GEOMAGUS_ROOGUG_DEFINITION_ID,
          ),
      ),
  );
  const usefulKeywordRoogugs = keywordTargets.filter((minion) =>
    usefulRoogugs.some(
      (candidate) => candidate.instanceId === minion.instanceId,
    ),
  );
  const candidates =
    usefulKeywordRoogugs.length > 0
      ? usefulKeywordRoogugs
      : keywordTargets.length > 0
        ? keywordTargets
        : usefulRoogugs.length > 0
          ? usefulRoogugs
          : player.board;
  const target = bestMinionByScore(
    player,
    candidates,
  );
  return castBloodGem(
    state,
    player,
    gem.instanceId,
    target.instanceId,
  );
}

function playBestAiSpellcraft(
  state: GameState,
  player: PlayerState,
): boolean {
  const spells = player.hand.filter(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft",
  );
  for (const spell of spells) {
    const definition = getSpellcraftDefinition(spell.definitionId);
    if (spellcraftNeedsTarget(definition)) {
      const targets = spellcraftLegalTargets(player, definition);
      if (targets.length === 0) {
        continue;
      }
      const target = bestMinionByScore(player, targets);
      return castSpellcraft(
        state,
        player,
        spell.instanceId,
        target.instanceId,
      );
    }
    return castSpellcraft(state, player, spell.instanceId);
  }
  return false;
}

function playBestAiTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  const spells = player.hand.filter(
    (card): card is TavernSpellInstance => card.kind === "tavernSpell",
  ).sort((left, right) => {
    const scoreDifference =
      tavernSpellAiScore(player, right) -
      tavernSpellAiScore(player, left);
    return scoreDifference !== 0
      ? scoreDifference
      : left.instanceId.localeCompare(right.instanceId);
  });
  for (const spell of spells) {
    const definition = getTavernSpellDefinition(spell.definitionId);
    if (tavernSpellNeedsTarget(definition)) {
      const legalTargets = tavernSpellLegalTargets(player, definition);
      const targets =
        definition.effect === "stackedAvalanche"
          ? legalTargets.filter((candidate) =>
              player.board.some(
                (minion) =>
                  minion.instanceId !== candidate.instanceId &&
                  minionHasTribe(minion, "elemental"),
              ),
            )
          : legalTargets;
      if (targets.length === 0) {
        continue;
      }
      const hamuulTarget =
        definition.effect === "lostStaffOfHamuul"
          ? [...targets].sort((left, right) => {
              const matchingBoardCount = (
                candidate: BoardMinionInstance,
              ) =>
                LOBBY_TRIBES.reduce(
                  (best, tribe) =>
                    candidate.tribes.includes("all") ||
                    candidate.tribes.includes(tribe)
                      ? Math.max(
                          best,
                          player.board.filter((minion) =>
                            minionHasTribe(minion, tribe),
                          ).length,
                        )
                      : best,
                  0,
                );
              return (
                matchingBoardCount(right) -
                  matchingBoardCount(left) ||
                left.instanceId.localeCompare(right.instanceId)
              );
            })[0]
          : undefined;
      const target =
        hamuulTarget ??
        (definition.effect === "stackedAvalanche" ||
        definition.effect === "carefulMutation" ||
        definition.effect === "slaughter" ||
        definition.effect === "invokeTheDevourer"
          ? [...targets].sort((left, right) => {
              const scoreDifference =
                minionScore(player, left) -
                minionScore(player, right);
              return scoreDifference !== 0
                ? scoreDifference
                : left.instanceId.localeCompare(
                    right.instanceId,
                  );
            })[0]
          : bestMinionByScore(player, targets));
      return castTavernSpell(
        state,
        player,
        spell.instanceId,
        target.instanceId,
      );
    }
    return castTavernSpell(state, player, spell.instanceId);
  }
  return false;
}

function aiReservedCombatHandMinionIds(
  state: GameState,
  player: PlayerState,
): Set<string> {
  let reserveHighestAttackCount = 0;
  let reserveAllHandMinions = false;
  const reserveHighestAttackByTribe = new Map<Tribe, number>();
  for (const minion of player.board) {
    for (const component of minionEffectSources(minion)) {
      const definition = getMinionDefinition(component.definitionId);
      for (const rally of definition.rally ?? []) {
        if (rally.kind !== "summonFromHand") {
          continue;
        }
        const count =
          rally.count *
          (component.golden && rally.goldenMode === "doubleCount"
            ? 2
            : 1);
        reserveHighestAttackCount = Math.max(
          reserveHighestAttackCount,
          count,
        );
      }
      for (const effect of definition.startOfCombat ?? []) {
        if (effect.kind === "gainHighestHandAttack") {
          reserveHighestAttackCount = Math.max(
            reserveHighestAttackCount,
            1,
          );
        } else if (effect.kind === "gainAllHandMinionStats") {
          reserveAllHandMinions = true;
        } else if (
          effect.kind === "summonHighestAttackHandTribeWhenSpace"
        ) {
          const count =
            effect.count *
            (component.golden &&
            effect.goldenMode === "doubleCount"
              ? 2
              : 1);
          reserveHighestAttackByTribe.set(
            effect.tribe,
            Math.max(
              reserveHighestAttackByTribe.get(effect.tribe) ?? 0,
              count,
            ),
          );
        }
      }
    }
  }
  if (
    reserveHighestAttackCount === 0 &&
    !reserveAllHandMinions &&
    reserveHighestAttackByTribe.size === 0
  ) {
    return new Set();
  }
  const candidates = player.hand
    .filter(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        (card.playableFromRound ?? 0) <= state.round &&
        (card.destroyAfterPlayThroughRound ?? -1) < state.round &&
        getMinionDefinition(card.definitionId)
          .inHandStartOfCombat === undefined,
    )
    .sort((left, right) => {
      if (left.attack !== right.attack) {
        return right.attack - left.attack;
      }
      if (left.health !== right.health) {
        return right.health - left.health;
      }
      return left.instanceId.localeCompare(right.instanceId);
    });
  const boardSlotsNeeded = Math.max(
    0,
    Math.min(MAX_BOARD_SIZE, aiTargetBoardSize(state.round)) -
      player.board.length,
  );
  const maximumReserveCount = Math.max(
    0,
    candidates.length - boardSlotsNeeded,
  );
  const reservationScores = new Map<string, number>();
  const addReservationScore = (
    minion: BoardMinionInstance,
    amount = 1,
  ) => {
    reservationScores.set(
      minion.instanceId,
      (reservationScores.get(minion.instanceId) ?? 0) + amount,
    );
  };
  if (reserveAllHandMinions) {
    candidates.forEach((candidate) =>
      addReservationScore(candidate),
    );
  }
  candidates
    .slice(0, reserveHighestAttackCount)
    .forEach((candidate) => addReservationScore(candidate));
  for (const [tribe, count] of reserveHighestAttackByTribe) {
    candidates
      .filter((candidate) => minionHasTribe(candidate, tribe))
      .slice(0, count)
      // Prefer overlap: this card can still satisfy a generic hand reader
      // after higher non-matching cards are played onto the board.
      .forEach((candidate) => addReservationScore(candidate, 2));
  }
  return new Set(
    candidates
      .filter(
        (candidate) =>
          (reservationScores.get(candidate.instanceId) ?? 0) > 0,
      )
      .sort((left, right) => {
        const scoreDifference =
          (reservationScores.get(right.instanceId) ?? 0) -
          (reservationScores.get(left.instanceId) ?? 0);
        if (scoreDifference !== 0) {
          return scoreDifference;
        }
        if (left.attack !== right.attack) {
          return right.attack - left.attack;
        }
        if (left.health !== right.health) {
          return right.health - left.health;
        }
        return left.instanceId.localeCompare(right.instanceId);
      })
      .slice(0, maximumReserveCount)
      .map((minion) => minion.instanceId),
  );
}

function playAiHand(state: GameState, player: PlayerState): void {
  while (
    player.hand.length > 0 ||
    player.pendingSpellcraft.length > 0
  ) {
    flushPendingSpellcraft(state, player);
    if (player.hand.length === 0) {
      break;
    }
    const consolationCoin = player.hand.find(
      (card): card is ConsolationCoinSpellInstance =>
        card.kind === "consolationCoin",
    );
    if (consolationCoin) {
      playHandCard(state, player, consolationCoin.instanceId);
      continue;
    }
    const reward = player.hand.find(
      (card): card is TripleRewardSpellInstance =>
        card.kind === "tripleReward",
    );
    if (reward) {
      playHandCard(state, player, reward.instanceId);
      continue;
    }
    const playableMinions = player.hand.filter(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        (card.playableFromRound ?? 0) <= state.round &&
        (card.destroyAfterPlayThroughRound ?? -1) < state.round,
    );
    const reservedCombatTargets =
      aiReservedCombatHandMinionIds(state, player);
    const unreservedPlayableMinions = playableMinions.filter(
      (card) =>
        !reservedCombatTargets.has(card.instanceId) &&
        getMinionDefinition(card.definitionId)
          .inHandStartOfCombat === undefined,
    );
    const canKeepAncientSoulInHand =
      player.board.length > 0 ||
      unreservedPlayableMinions.some(
        (card) =>
          card.definitionId !== ANCIENT_SOUL_DEFINITION_ID ||
          card.golden,
      );
    const minions = canKeepAncientSoulInHand
      ? unreservedPlayableMinions.filter(
          (card) =>
            card.definitionId !== ANCIENT_SOUL_DEFINITION_ID ||
            card.golden,
        )
      : unreservedPlayableMinions;
    if (minions.length === 0) {
      if (playBestAiTavernSpell(state, player)) {
        continue;
      }
      if (playBestAiSpellcraft(state, player)) {
        continue;
      }
      if (playBestAiBloodGem(state, player)) {
        continue;
      }
      break;
    }
    if (player.board.length >= MAX_BOARD_SIZE) {
      const magneticOptions = minions
        .map((source) => ({
          source,
          targets: player.board.filter((target) =>
            canMagnetize(source, target),
          ),
        }))
        .filter((option) => option.targets.length > 0)
        .sort((left, right) => {
          const scoreDifference =
            minionScore(player, right.source) -
            minionScore(player, left.source);
          return scoreDifference !== 0
            ? scoreDifference
            : left.source.instanceId.localeCompare(
                right.source.instanceId,
              );
        });
      const magnetic = magneticOptions[0];
      if (!magnetic) {
        const profile = getAiStrategyProfile(player.id);
        const strongestHandMinion = bestMinionByScore(player, minions);
        const weakestIndex = weakestBoardIndex(player);
        const handScore = minionScore(player, strongestHandMinion);
        const weakestScore = minionScore(
          player,
          player.board[weakestIndex],
        );
        if (
          handScore >= weakestScore + profile.replacementMargin &&
          sellMinion(state, player, weakestIndex)
        ) {
          continue;
        }
        if (playBestAiTavernSpell(state, player)) {
          continue;
        }
        if (playBestAiSpellcraft(state, player)) {
          continue;
        }
        if (playBestAiBloodGem(state, player)) {
          continue;
        }
        break;
      }
      const target = bestMinionByScore(player, magnetic.targets);
      if (!magnetizeMinion(
        state,
        player,
        magnetic.source.instanceId,
        target.instanceId,
      )) {
        break;
      }
      continue;
    }
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < minions.length; index += 1) {
      const score = minionScore(player, minions[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const chosen = minions[bestIndex];
    playHandCard(state, player, chosen.instanceId);
  }
}

function canAiSpendHealth(
  player: PlayerState,
  cost: number,
): boolean {
  const floor = getAiStrategyProfile(player.id).healthSpendFloor;
  return player.health > cost && player.health - cost >= floor;
}

function canAiPurchaseTavernSpell(
  player: PlayerState,
  spell: TavernSpellInstance,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  return tavernSpellPurchaseCurrency(spell) === "health"
    ? canAiSpendHealth(player, spell.cost)
    : player.gold >= tavernSpellPurchaseCost(player, spell);
}

function baseTavernSpellAiScore(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  const effect = getTavernSpellDefinition(spell.definitionId).effect;
  const boardSize = player.board.length;
  const targetCount = tavernSpellLegalTargets(player, spell).length;
  switch (effect) {
    case "discoverTierOne":
    case "recruitTrainee":
    case "searchThePast":
      return 4;
    case "stealRandomShopMinion":
      return player.shop.length > 0 ? 7 : 0;
    case "fortify":
    case "pointyArrow":
    case "tavernDishBanana":
    case "trickyTrousers":
      return targetCount > 0 ? 6 : 0;
    case "backToBack":
    case "defendersRites":
    case "shiftingTide":
    case "perfectVision":
      return targetCount > 0 ? 10 : 0;
    case "knockoffWisdomball":
      return 12 + Math.min(4, player.helpfulRefreshes);
    case "eyesOfTheEarthMother":
      return targetCount > 0 ? 14 : 0;
    case "lostStaffOfHamuul":
      return targetCount > 0 ? 11 : 0;
    case "deepwaterClan":
    case "naturalBlessing":
      return targetCount > 0 ? 12 : 0;
    case "chefsChoice":
      return targetCount > 0 ? 6 : 0;
    case "hastyExcavation":
      return canAiSpendHealth(player, spell.cost) ? 4 : 0;
    case "gainOneGold":
      return 1.5;
    case "gainTwoGold":
      return 3;
    case "freeRefreshes":
      return 4;
    case "increaseMaxGold":
      return stateRoundValue(player);
    case "carefulInvestment":
      return 3;
    case "themApples":
      return player.shop.length * 2.5;
    case "staffOfEnrichment":
      return player.shop.length * 3 + 5;
    case "friendlyBounty":
    case "planarTelescope":
      return mostCommonBoardTribe(player) ? 6 : 0;
    case "hubris":
      return 4;
    case "carefulMutation":
      return targetCount > 0 ? 8 : 0;
    case "timeManagement":
      return boardSize * 5;
    case "stackedAvalanche":
      return player.board.some((candidate) =>
        player.board.some(
          (minion) =>
            minion.instanceId !== candidate.instanceId &&
            minionHasTribe(minion, "elemental"),
        ),
      )
        ? 8
        : 0;
    case "bloodGemBarrage":
      return player.shop.length * 3 + 5;
    case "cloneHorn":
      return player.hand.length <= 8 ? 10 : 4;
    case "beetleBlessing":
      return player.board.length < MAX_BOARD_SIZE ? 8 : 4;
    case "slimySeafood":
      return player.hand.length <= 7 && boardSize > 0 ? 10 : 2;
    case "gemConfiscation":
      return targetCount > 0 ? 9 : 0;
    case "temperatureShift":
      return player.hand.length <= 8 ? 10 : 3;
    case "rideTheWind":
      return 11;
    case "stirTheGraveyard":
      return player.hand.length < MAX_HAND_SIZE ? 8 : 0;
    case "blazingInferno":
      return targetCount > 0
        ? 8 + player.elementalsPlayedThisTurn
        : 0;
    case "arcaneAbsorption":
      return targetCount > 0 ? 10 : 0;
    case "eonarsFavor":
      return targetCount > 0 ? 10 : 0;
    case "armorStash":
      return player.armor < 5 ? (5 - player.armor) * 2 : 0;
    case "overpowered":
      return 8;
    case "slaughter":
      return targetCount > 0 ? 11 : 0;
    case "corruptedCupcakes":
      return targetCount > 0 && player.shop.length > 0
        ? player.shop
            .map((minion) => minion.attack + minion.health)
            .sort((left, right) => right - left)
            .slice(0, 3)
            .reduce((total, value) => total + value, 0) / 2
        : 0;
    case "goldenTouch":
      return player.shop.some((minion) => !minion.golden) ? 12 : 0;
    case "saloonsFinest":
      return player.spellOnlyRefreshActive ? 0 : 9;
    case "reservedCorpse":
    case "headhunter":
      return player.hand.length < MAX_HAND_SIZE ? 8 : 0;
    case "nozdormusProgeny":
      return boardSize > 0 ? 10 : 3;
    case "invokeTheDevourer":
      return targetCount > 1 ? 10 : targetCount === 1 ? 2 : 0;
    case "unmaskedIdentity":
      return 8;
    case "selfishBounty":
      return boardSize > 0 ? 12 : 0;
    case "fleetingVigor":
    case "shinyRing":
    case "azeriteEmpowerment":
      return boardSize * 3;
    case "mightOfStormwind":
    case "healthyBounty":
    case "hostileBounty":
    case "misplacedTeaSet":
    case "queensCommand":
    case "sanctify":
    case "waveOfGold":
      return boardSize * 4;
  }
}

const AI_ECONOMY_TAVERN_SPELL_EFFECTS = new Set<
  TavernSpellDefinition["effect"]
>([
  "discoverTierOne",
  "recruitTrainee",
  "stealRandomShopMinion",
  "knockoffWisdomball",
  "hastyExcavation",
  "gainOneGold",
  "gainTwoGold",
  "freeRefreshes",
  "increaseMaxGold",
  "carefulInvestment",
  "cloneHorn",
  "temperatureShift",
  "reservedCorpse",
  "headhunter",
  "saloonsFinest",
]);

function tavernSpellAiScore(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  const profile = getAiStrategyProfile(player.id);
  const effect = getTavernSpellDefinition(spell.definitionId).effect;
  const economyBonus = AI_ECONOMY_TAVERN_SPELL_EFFECTS.has(effect)
    ? profile.economyBonus * 0.75
    : 0;
  const permanentGrowingBuffBonus = player.board.reduce(
    (total, minion) =>
      total +
      minionEffectSources(minion).reduce(
        (componentTotal, component) => {
          const improvement = getMinionDefinition(
            component.definitionId,
          ).afterTavernSpellCast?.find(
            (candidate) =>
              candidate.kind === "improveStartOfCombatBuff",
          );
          return improvement?.kind ===
            "improveStartOfCombatBuff"
            ? componentTotal +
                (improvement.attack + improvement.health) *
                  (component.golden ? 2 : 1) *
                  0.9
            : componentTotal;
        },
        0,
      ),
    0,
  );
  return (
    baseTavernSpellAiScore(player, spell) *
      profile.spellValueMultiplier +
    economyBonus +
    permanentGrowingBuffBonus
  );
}

function stateRoundValue(player: PlayerState): number {
  return player.maxGold < 13 ? 5 : 1;
}

function weakestBoardIndex(player: PlayerState): number {
  let weakestIndex = 0;
  let weakestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index < player.board.length; index += 1) {
    const score = minionScore(player, player.board[index]);
    if (score < weakestScore) {
      weakestScore = score;
      weakestIndex = index;
    }
  }
  return weakestIndex;
}

function bestShopIndex(player: PlayerState): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < player.shop.length; index += 1) {
    const score = minionScore(player, player.shop[index]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function bestMagneticShopIndex(player: PlayerState): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < player.shop.length; index += 1) {
    const offer = player.shop[index];
    if (
      !player.board.some((target) => canMagnetize(offer, target))
    ) {
      continue;
    }
    const score = minionScore(player, offer);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function arrangeAiBoard(
  player: PlayerState,
  opponent?: PlayerState,
): void {
  const profile = getAiStrategyProfile(player.id);
  const opponentHasTaunt =
    opponent?.board.some((minion) => minion.taunt) ?? false;
  const opponentHasShieldedTaunt =
    opponent?.board.some(
      (minion) => minion.taunt && minion.divineShield,
    ) ?? false;
  const opponentHasCleave =
    opponent?.board.some((minion) => minion.cleave) ?? false;
  const hasDeathrattle = (minion: BoardMinionInstance) =>
    minionEffectSources(minion).some(
      (component) =>
        getMinionDefinition(component.definitionId).deathrattle !==
        undefined,
    );
  const isSupport = (minion: BoardMinionInstance) =>
    minionEffectSources(minion).some((component) => {
      const definition = getMinionDefinition(component.definitionId);
      return (
        (definition.extraBattlecries ?? 0) > 0 ||
        (definition.extraDeathrattles ?? 0) > 0 ||
        definition.aura !== undefined ||
        definition.afterFriendlyPlayed !== undefined ||
        definition.afterFriendlySummoned !== undefined ||
        definition.afterFriendlyDamaged !== undefined ||
        definition.afterFriendlyDealsDamage !== undefined ||
        definition.afterFriendlyDied !== undefined ||
        definition.afterFriendlyAttacks !== undefined ||
        (definition.combatTavernSpellExtraCasts ?? 0) > 0 ||
        definition.combatEnchantmentRetention?.target ===
          "adjacentFriendlyTribe"
      );
    });

  player.board.sort((left, right) => {
    const attackOrder = (minion: BoardMinionInstance) => {
      if (minion.taunt) {
        return 5;
      }
      if (opponentHasTaunt && minion.cleave) {
        return 0;
      }
      if (hasDeathrattle(minion)) {
        return profile.id === "deathrattle" ? 0 : 1;
      }
      if (isSupport(minion)) {
        return 4;
      }
      return 2;
    };
    const orderDifference = attackOrder(left) - attackOrder(right);
    if (orderDifference !== 0) {
      return orderDifference;
    }
    if (left.attack !== right.attack) {
      return right.attack - left.attack;
    }
    return left.instanceId.localeCompare(right.instanceId);
  });

  if (
    opponentHasShieldedTaunt &&
    profile.scoutingWeight >= 0.5
  ) {
    const shieldBreakerIndex = player.board.reduce(
      (bestIndex, minion, index) => {
        if (
          minion.attack <= 0 ||
          minion.taunt ||
          minion.cleave ||
          isSupport(minion)
        ) {
          return bestIndex;
        }
        if (bestIndex < 0) {
          return index;
        }
        const best = player.board[bestIndex];
        return minion.attack < best.attack ||
          (minion.attack === best.attack &&
            minion.instanceId.localeCompare(best.instanceId) < 0)
          ? index
          : bestIndex;
      },
      -1,
    );
    if (shieldBreakerIndex > 0) {
      const [shieldBreaker] = player.board.splice(
        shieldBreakerIndex,
        1,
      );
      player.board.unshift(shieldBreaker);
    }
  }

  if (opponentHasCleave) {
    const firstTauntIndex = player.board.findIndex(
      (minion) => minion.taunt,
    );
    if (firstTauntIndex > 1) {
      const bufferIndex = player.board.reduce(
        (bestIndex, minion, index) => {
          if (
            index >= firstTauntIndex ||
            minion.taunt ||
            hasDeathrattle(minion) ||
            isSupport(minion)
          ) {
            return bestIndex;
          }
          if (bestIndex < 0) {
            return index;
          }
          const best = player.board[bestIndex];
          const minionValue = minion.attack + minion.health;
          const bestValue = best.attack + best.health;
          return minionValue < bestValue ||
            (minionValue === bestValue &&
              minion.instanceId.localeCompare(best.instanceId) < 0)
            ? index
            : bestIndex;
        },
        -1,
      );
      if (bufferIndex >= 0 && bufferIndex !== firstTauntIndex - 1) {
        const [buffer] = player.board.splice(bufferIndex, 1);
        const nextTauntIndex = player.board.findIndex(
          (minion) => minion.taunt,
        );
        player.board.splice(nextTauntIndex, 0, buffer);
      }
    }
  }

  const poets = player.board
    .filter(
      (minion) =>
        getMinionDefinition(minion.definitionId)
          .combatEnchantmentRetention?.target ===
        "adjacentFriendlyTribe",
    )
    .sort((left, right) => {
      if (left.golden !== right.golden) {
        return left.golden ? -1 : 1;
      }
      return (
        minionScore(player, right) - minionScore(player, left) ||
        left.instanceId.localeCompare(right.instanceId)
      );
    });
  const poetIds = new Set(poets.map((poet) => poet.instanceId));
  const poetMultipliers = new Map(
    poets.map((poet) => {
      const effect = getMinionDefinition(
        poet.definitionId,
      ).combatEnchantmentRetention;
      return [
        poet.instanceId,
        poet.golden && effect?.goldenMode === "doubleStats"
          ? 2
          : 1,
      ];
    }),
  );
  const dragonChainCandidates = player.board.filter((minion) =>
    minionHasTribe(minion, "dragon"),
  );
  const hasProtectableDragon =
    dragonChainCandidates.some(
      (minion) => !poetIds.has(minion.instanceId),
    ) || poets.length > 1;
  if (
    poets.length > 0 &&
    dragonChainCandidates.length > 1 &&
    hasProtectableDragon
  ) {
    const baseIndices = new Map(
      dragonChainCandidates.map((minion, index) => [
        minion.instanceId,
        index,
      ]),
    );
    const values = new Map(
      dragonChainCandidates.map((minion) => [
        minion.instanceId,
        Math.max(0, minionScore(player, minion)),
      ]),
    );
    const selfRetentionMultipliers = new Map(
      dragonChainCandidates.map((minion) => {
        const effect = getMinionDefinition(
          minion.definitionId,
        ).combatEnchantmentRetention;
        const multiplier =
          effect?.target === "self"
            ? minion.golden &&
              effect.goldenMode === "doubleStats"
              ? 2
              : 1
            : 0;
        return [minion.instanceId, multiplier];
      }),
    );
    let chain = [...dragonChainCandidates];
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestProtectedCount = -1;
    let bestMovement = Number.POSITIVE_INFINITY;
    let bestKey = "";
    const working = [...dragonChainCandidates];
    const considerWorkingOrder = () => {
      let score = 0;
      let protectedCount = 0;
      for (let index = 0; index < working.length; index += 1) {
        const adjacentPoetMultiplier = Math.max(
          index > 0
            ? (poetMultipliers.get(
                working[index - 1].instanceId,
              ) ?? 0)
            : 0,
          index + 1 < working.length
            ? (poetMultipliers.get(
                working[index + 1].instanceId,
              ) ?? 0)
            : 0,
        );
        const selfMultiplier =
          selfRetentionMultipliers.get(
            working[index].instanceId,
          ) ?? 0;
        const incrementalMultiplier = Math.max(
          0,
          adjacentPoetMultiplier - selfMultiplier,
        );
        if (incrementalMultiplier === 0) {
          continue;
        }
        protectedCount += 1;
        score +=
          (values.get(working[index].instanceId) ?? 0) *
          incrementalMultiplier;
      }
      const movement = working.reduce(
        (total, minion, index) =>
          total +
          Math.abs((baseIndices.get(minion.instanceId) ?? index) - index),
        0,
      );
      const key = working.map((minion) => minion.instanceId).join("\0");
      if (
        score > bestScore ||
        (score === bestScore &&
          (protectedCount > bestProtectedCount ||
            (protectedCount === bestProtectedCount &&
              (movement < bestMovement ||
                (movement === bestMovement &&
                  (bestKey === "" || key < bestKey))))))
      ) {
        chain = [...working];
        bestScore = score;
        bestProtectedCount = protectedCount;
        bestMovement = movement;
        bestKey = key;
      }
    };
    const permute = (startIndex: number): void => {
      if (startIndex >= working.length - 1) {
        considerWorkingOrder();
        return;
      }
      for (
        let swapIndex = startIndex;
        swapIndex < working.length;
        swapIndex += 1
      ) {
        [working[startIndex], working[swapIndex]] = [
          working[swapIndex],
          working[startIndex],
        ];
        permute(startIndex + 1);
        [working[startIndex], working[swapIndex]] = [
          working[swapIndex],
          working[startIndex],
        ];
      }
    };
    permute(0);
    const chainIds = new Set(
      chain.map((minion) => minion.instanceId),
    );
    player.board = [
      ...player.board.filter(
        (minion) => !chainIds.has(minion.instanceId),
      ),
      ...chain,
    ];
  }

  const macaws = player.board
    .filter((minion) =>
      getMinionDefinition(minion.definitionId).rally?.some(
        (effect) => effect.kind === "triggerLeftmostDeathrattle",
      ),
    )
    .sort(
      (left, right) =>
        Number(right.golden) - Number(left.golden) ||
        right.attack - left.attack ||
        left.instanceId.localeCompare(right.instanceId),
    );
  if (macaws.length > 0) {
    const macawIds = new Set(
      macaws.map((minion) => minion.instanceId),
    );
    const deathrattleTarget = player.board
      .filter(
        (minion) =>
          !macawIds.has(minion.instanceId) &&
          minionHasTriggerableDeathrattle(minion),
      )
      .sort(
        (left, right) =>
          minionScore(player, right) - minionScore(player, left) ||
          right.attack + right.health - (left.attack + left.health) ||
          left.instanceId.localeCompare(right.instanceId),
      )[0];
    if (deathrattleTarget) {
      player.board = [
        ...macaws,
        deathrattleTarget,
        ...player.board.filter(
          (minion) =>
            !macawIds.has(minion.instanceId) &&
            minion.instanceId !== deathrattleTarget.instanceId,
        ),
      ];
    }
  }
}

export function planAiBoardOrder(
  player: PlayerState,
  opponent?: PlayerState,
): string[] {
  const workingPlayer: PlayerState = {
    ...player,
    board: [...player.board],
  };
  arrangeAiBoard(workingPlayer, opponent);
  return workingPlayer.board.map((minion) => minion.instanceId);
}

function previouslyObservedOpponent(
  battles: readonly BattleSummary[],
  observer: PlayerState,
  opponent: PlayerState,
): PlayerState | undefined {
  if (observer.lastOpponentId !== opponent.id) {
    return undefined;
  }
  const previousMatchup = battles.find(
    (battle) =>
      (battle.playerAId === observer.id &&
        battle.playerBId === opponent.id) ||
      (battle.playerAId === opponent.id &&
        battle.playerBId === observer.id),
  );
  const observedBoard =
    previousMatchup?.initialBoards[opponent.id]?.filter(
      (minion): minion is BoardMinionInstance =>
        minion.kind === "minion",
    );
  if (!observedBoard) {
    return undefined;
  }
  return {
    ...opponent,
    board: observedBoard,
    hand: [],
    shop: [],
    spellShop: null,
    additionalSpellShop: [],
  };
}

function shouldUpgradeAiTavern(
  state: GameState,
  player: PlayerState,
): boolean {
  const bestIndex = bestShopIndex(player);
  const bestAffordableSpellScore =
    tavernSpellShopOffers(player)
      .filter((spell) => canAiPurchaseTavernSpell(player, spell))
      .reduce(
        (best, spell) =>
          Math.max(best, tavernSpellAiScore(player, spell)),
        Number.NEGATIVE_INFINITY,
      );
  const weakestIndex =
    player.board.length > 0 ? weakestBoardIndex(player) : -1;
  return shouldAiUpgrade({
    profile: getAiStrategyProfile(player.id),
    round: state.round,
    tavernTier: player.tavernTier,
    health: player.health,
    armor: player.armor,
    gold: player.gold,
    upgradeCost: getUpgradeCost(state, player.id),
    boardSize: player.board.length,
    bestShopScore:
      bestIndex >= 0
        ? minionScore(player, player.shop[bestIndex])
        : Number.NEGATIVE_INFINITY,
    weakestBoardScore:
      weakestIndex >= 0
        ? minionScore(player, player.board[weakestIndex])
        : 0,
    bestAffordableSpellScore,
  });
}

const AI_IMMEDIATE_MINION_SPELL_EFFECTS =
  new Set<TavernSpellEffect>([
    "discoverTierOne",
    "stealRandomShopMinion",
    "recruitTrainee",
    "chefsChoice",
    "friendlyBounty",
    "planarTelescope",
    "cloneHorn",
    "temperatureShift",
    "reservedCorpse",
    "headhunter",
  ]);

function immediateAiSpellGoldGain(effect: TavernSpellEffect): number {
  switch (effect) {
    case "hastyExcavation":
    case "gainOneGold":
      return 1;
    case "gainTwoGold":
      return 2;
    default:
      return 0;
  }
}

/**
 * A real player does not spend the only three Gold on a small buff and enter
 * combat with an empty board. Until the stage target is met, a spell must
 * either supply a playable minion itself or leave enough Gold to buy one.
 */
function aiSpellPreservesTempo(
  player: PlayerState,
  spell: TavernSpellInstance,
): boolean {
  const definition = getTavernSpellDefinition(spell.definitionId);
  if (AI_IMMEDIATE_MINION_SPELL_EFFECTS.has(definition.effect)) {
    return true;
  }
  const goldCost =
    tavernSpellPurchaseCurrency(spell) === "health"
      ? 0
      : tavernSpellPurchaseCost(player, spell);
  return (
    player.gold -
      goldCost +
      immediateAiSpellGoldGain(definition.effect) >=
    BUY_COST
  );
}

function sellAiLossBonusMinions(
  state: GameState,
  player: PlayerState,
): number {
  let sold = 0;
  for (let index = player.board.length - 1; index >= 0; index -= 1) {
    const minion = player.board[index];
    if (
      getMinionSellValue(state, player.id, minion) <= minion.sellValue
    ) {
      continue;
    }
    if (sellMinion(state, player, index)) {
      sold += 1;
    }
  }
  return sold;
}

function runAiRecruit(state: GameState, player: PlayerState): void {
  const profile = getAiStrategyProfile(player.id);
  let actions = 0;
  let upgradedThisTurn = false;
  playAiHand(state, player);
  actions += sellAiLossBonusMinions(state, player);

  if (
    shouldUpgradeAiTavern(state, player) &&
    upgradeTavern(state, player)
  ) {
    upgradedThisTurn = true;
    actions += 1;
  }

  let refreshes = 0;
  while (actions < 50) {
    playAiHand(state, player);
    actions += sellAiLossBonusMinions(state, player);
    if (actions >= 50) {
      break;
    }
    if (
      !upgradedThisTurn &&
      shouldUpgradeAiTavern(state, player) &&
      upgradeTavern(state, player)
    ) {
      upgradedThisTurn = true;
      actions += 1;
      continue;
    }
    const shopIndex = bestShopIndex(player);
    const bestMinionOffer =
      shopIndex >= 0 ? player.shop[shopIndex] : undefined;
    const bestMinionScore = bestMinionOffer
      ? minionScore(player, bestMinionOffer)
      : Number.NEGATIVE_INFINITY;
    const spellOffer = tavernSpellShopOffers(player)
      .filter((offer) => canAiPurchaseTavernSpell(player, offer))
      .sort((left, right) => {
        const scoreDifference =
          tavernSpellAiScore(player, right) -
          tavernSpellAiScore(player, left);
        return scoreDifference !== 0
          ? scoreDifference
          : left.instanceId.localeCompare(right.instanceId);
      })[0] ?? null;
    const spellCurrency = spellOffer
      ? tavernSpellPurchaseCurrency(spellOffer)
      : "gold";
    const canAffordSpell =
      spellOffer !== null &&
      canAiPurchaseTavernSpell(player, spellOffer);
    const spellScore = spellOffer
      ? tavernSpellAiScore(player, spellOffer)
      : Number.NEGATIVE_INFINITY;
    const spellPurchaseCost = spellOffer
      ? tavernSpellPurchaseCost(player, spellOffer)
      : 0;
    const spellEfficiency = spellOffer
      ? spellScore / Math.max(1, spellPurchaseCost)
      : Number.NEGATIVE_INFINITY;
    const minionEfficiency =
      bestMinionOffer && player.gold >= BUY_COST
        ? bestMinionScore / BUY_COST
        : Number.NEGATIVE_INFINITY;
    const minionCompletesTriple =
      bestMinionOffer !== undefined &&
      ownedNormalCount(player, bestMinionOffer.definitionId) >= 2;
    const needsBoardMinion =
      bestMinionOffer !== undefined &&
      player.gold >= BUY_COST &&
      player.board.length < aiTargetBoardSize(state.round);
    const spellPreservesTempo =
      spellOffer === null ||
      !needsBoardMinion ||
      aiSpellPreservesTempo(player, spellOffer);
    const preferSpell =
      spellPreservesTempo &&
      (spellCurrency === "health" ||
        bestMinionOffer === undefined ||
        player.gold < BUY_COST ||
        (!minionCompletesTriple &&
          spellEfficiency >= minionEfficiency * 0.85));
    if (
      spellOffer &&
      player.hand.length < MAX_HAND_SIZE &&
      canAffordSpell &&
      preferSpell &&
      spellScore >=
        (spellCurrency === "health"
          ? 3
          : Math.max(1.5, spellPurchaseCost * 1.7)) &&
      buyTavernSpell(state, player, spellOffer.instanceId)
    ) {
      actions += 1;
      continue;
    }
    if (
      shopIndex >= 0 &&
      player.gold >= BUY_COST &&
      player.hand.length < MAX_HAND_SIZE
    ) {
      if (player.board.length < MAX_BOARD_SIZE) {
        const weakestIndex =
          player.board.length > 0 ? weakestBoardIndex(player) : -1;
        const weakestScore =
          weakestIndex >= 0
            ? minionScore(player, player.board[weakestIndex])
            : Number.NEGATIVE_INFINITY;
        const ownedCopies = ownedNormalCount(
          player,
          player.shop[shopIndex].definitionId,
        );
        const shouldBuy =
          player.board.length < aiTargetBoardSize(state.round) ||
          ownedCopies >= 1 ||
          bestMinionScore >=
            weakestScore + profile.replacementMargin / 2;
        if (
          shouldBuy &&
          buyMinion(state, player, shopIndex)
        ) {
          actions += 1;
          continue;
        }
      } else {
        const magneticShopIndex = bestMagneticShopIndex(player);
        if (
          magneticShopIndex >= 0 &&
          buyMinion(state, player, magneticShopIndex)
        ) {
          actions += 1;
          playAiHand(state, player);
          continue;
        }
        const weakestIndex = weakestBoardIndex(player);
        const candidateScore = minionScore(player, player.shop[shopIndex]);
        const weakestScore = minionScore(player, player.board[weakestIndex]);
        if (
          candidateScore >=
          weakestScore + profile.replacementMargin
        ) {
          sellMinion(state, player, weakestIndex);
          actions += 1;
          if (buyMinion(state, player, bestShopIndex(player))) {
            actions += 1;
            continue;
          }
        }
      }
    }

    const refreshCost = player.freeRefreshes > 0 ? 0 : REFRESH_COST;
    const refreshLimit =
      profile.maxRefreshes +
      (player.health + player.armor <
      profile.minimumUpgradeHealth
        ? 1
        : 0);
    const canBuyAfterRefresh =
      player.hand.length < MAX_HAND_SIZE &&
      player.gold - refreshCost >= BUY_COST;
    const canSpeculativelyRefresh =
      player.hand.length < MAX_HAND_SIZE &&
      refreshes === 0 &&
      ((refreshCost === 0 && player.freeRefreshes > 0) ||
        (refreshCost === REFRESH_COST &&
          player.gold === REFRESH_COST &&
          player.board.length >= aiTargetBoardSize(state.round)));
    if (
      refreshes < refreshLimit &&
      (canBuyAfterRefresh || canSpeculativelyRefresh)
    ) {
      refreshShop(state, player);
      refreshes += 1;
      actions += 1;
      continue;
    }
    break;
  }

  playAiHand(state, player);
  sellAiLossBonusMinions(state, player);
  const bestRemaining =
    player.shop.length > 0 ? player.shop[bestShopIndex(player)] : undefined;
  const bestRemainingSpell = [...tavernSpellShopOffers(player)].sort(
    (left, right) => {
      const scoreDifference =
        tavernSpellAiScore(player, right) -
        tavernSpellAiScore(player, left);
      return scoreDifference !== 0
        ? scoreDifference
        : left.instanceId.localeCompare(right.instanceId);
    },
  )[0];
  const freezePairCount = profile.id === "triple" ? 1 : 2;
  const freezeMinion =
    bestRemaining !== undefined &&
    (player.gold < BUY_COST ||
      player.hand.length >= MAX_HAND_SIZE) &&
    (ownedNormalCount(player, bestRemaining.definitionId) >=
      freezePairCount ||
      minionScore(player, bestRemaining) >=
        7 +
          player.tavernTier * 2 -
          profile.freezeScoreBonus);
  const freezeSpell =
    bestRemainingSpell !== undefined &&
    tavernSpellAiScore(player, bestRemainingSpell) >=
      8 - profile.freezeScoreBonus;
  player.frozen = freezeMinion || freezeSpell;
  reconcileConditionalMinions(player);
  arrangeAiBoard(player);
}

function pushBattleEvent(
  events: BattleEvent[],
  event: Omit<BattleEvent, "index">,
): void {
  events.push({ ...event, index: events.length });
}

function availableAttackIndex(
  board: readonly MinionInstance[],
  cursor: number,
): number {
  if (board.length === 0) {
    return -1;
  }
  for (let offset = 0; offset < board.length; offset += 1) {
    const index = (cursor + offset) % board.length;
    if (board[index].attack > 0) {
      return index;
    }
  }
  return -1;
}

function removeDead(
  board: MinionInstance[],
  ownerId: PlayerId,
): DeadMinion[] {
  const dead: DeadMinion[] = [];
  for (let index = 0; index < board.length; index += 1) {
    if (board[index].health <= 0) {
      dead.push({ minion: board[index], index, ownerId });
    }
  }
  for (let index = dead.length - 1; index >= 0; index -= 1) {
    board.splice(dead[index].index, 1);
  }
  return dead;
}

interface CombatStatBuff {
  attack: number;
  health: number;
}

interface PendingStartOfCombatHandSummon {
  source: BoardMinionInstance;
  sourceLabel: string;
  tribe: Tribe;
  remainingCount: number;
  usedHandInstanceIds: Set<string>;
}

type CombatBonusKeyword =
  | "divineShield"
  | "reborn"
  | "stealth"
  | "taunt"
  | "venomous"
  | "windfury";

type CombatRetentionMultiplier = 0 | 1 | 2;

interface RetainedCombatEnchantment {
  attack: number;
  health: number;
  bloodGemAttack: number;
  bloodGemHealth: number;
  keywords: Set<CombatBonusKeyword>;
}

interface CombatEnchantingGain {
  attack?: number;
  health?: number;
  bloodGemAttack?: number;
  bloodGemHealth?: number;
  keywords?: readonly CombatBonusKeyword[];
}

interface CombatEnchantingGainResult {
  gainedKeywords: readonly CombatBonusKeyword[];
  retentionMultiplier: CombatRetentionMultiplier;
}

interface CombatContext {
  state: GameState;
  events: BattleEvent[];
  playerIds: readonly [PlayerId, PlayerId];
  /** A ghost board fights normally but must never mutate its former owner. */
  ghostOwnerId?: PlayerId;
  boards: Record<PlayerId, MinionInstance[]>;
  deadMechs: Record<PlayerId, MinionInstance[]>;
  tribeBuffs: Record<PlayerId, Partial<Record<Tribe, CombatStatBuff>>>;
  /** Current per-player Beetle stats, including permanent in-game growth. */
  beetleBonuses: Record<PlayerId, CombatStatBuff>;
  pendingBeetles: Record<PlayerId, number>;
  pendingStartOfCombatHandSummons: Record<
    PlayerId,
    PendingStartOfCombatHandSummon[]
  >;
  /** Prevent a nested immediate attack from outrunning its outer death wave. */
  deathResolutionDepth: number;
  astralAutomatonsSummoned: Record<PlayerId, number>;
  eternalKnightsDied: Record<PlayerId, number>;
  /** Combat-only counters keyed by the exact minion or Magnetic component. */
  avengeProgress: Record<PlayerId, Record<string, number>>;
  /** Per-combat self-damage trigger counts keyed by the exact component. */
  limitedSelfDamageTriggers: Record<PlayerId, Record<string, number>>;
  /** Poisonous/Venomous damage remains lethal even if later triggers grant Health. */
  poisonLethalMinionIds: Record<PlayerId, Set<string>>;
  /** Maximum Health is tracked separately from damage for Charmwing. */
  maximumHealths: Record<PlayerId, Record<string, number>>;
  /** Only the original Recruit-board entities may receive permanent combat gains. */
  originalCombatMinionIds: Record<PlayerId, Set<string>>;
  /** Event-time combat enchantments flushed to Recruit entities after combat. */
  retainedCombatEnchantments: Record<
    PlayerId,
    Record<string, RetainedCombatEnchantment>
  >;
  /** Tracks an original combat entity through a Recruit-side combat triple. */
  retentionWritebackTargets: Record<
    PlayerId,
    Record<string, string>
  >;
}

function opponentId(context: CombatContext, ownerId: PlayerId): PlayerId {
  return context.playerIds[0] === ownerId
    ? context.playerIds[1]
    : context.playerIds[0];
}

function combatMaximumHealth(
  context: CombatContext,
  ownerId: PlayerId,
  minion: MinionInstance,
): number {
  return (
    context.maximumHealths[ownerId][minion.instanceId] ??
    Math.max(1, minion.health)
  );
}

function adjustCombatMaximumHealth(
  context: CombatContext,
  ownerId: PlayerId,
  minion: MinionInstance,
  healthDelta: number,
): void {
  const maximumHealth = combatMaximumHealth(context, ownerId, minion);
  context.maximumHealths[ownerId][minion.instanceId] = Math.max(
    1,
    maximumHealth + healthDelta,
  );
}

function persistentCombatOwner(
  context: CombatContext,
  ownerId: PlayerId,
): PlayerState | undefined {
  if (context.ghostOwnerId === ownerId) {
    return undefined;
  }
  const owner = findPlayer(context.state, ownerId);
  return owner?.alive ? owner : undefined;
}

function findCombatWritebackMinion(
  context: CombatContext,
  owner: PlayerState,
  ownerId: PlayerId,
  originalInstanceId: string,
): BoardMinionInstance | undefined {
  const writebackInstanceId =
    context.retentionWritebackTargets[ownerId][originalInstanceId] ??
    originalInstanceId;
  return (
    owner.board.find(
      (minion) => minion.instanceId === writebackInstanceId,
    ) ??
    owner.hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.instanceId === writebackInstanceId,
    )
  );
}

function combatRetentionMultiplier(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
): CombatRetentionMultiplier {
  if (context.ghostOwnerId === ownerId) {
    return 0;
  }
  if (!context.originalCombatMinionIds[ownerId].has(target.instanceId)) {
    return 0;
  }

  let multiplier: CombatRetentionMultiplier = 0;
  const selfEffect =
    getMinionDefinition(target.definitionId)
      .combatEnchantmentRetention;
  if (selfEffect?.target === "self") {
    multiplier =
      target.golden && selfEffect.goldenMode === "doubleStats" ? 2 : 1;
  }

  const board = context.boards[ownerId];
  const targetIndex = board.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  if (targetIndex < 0) {
    return multiplier;
  }
  for (const sourceIndex of [targetIndex - 1, targetIndex + 1]) {
    const source = board[sourceIndex];
    if (!source || source.health <= 0) {
      continue;
    }
    const adjacentEffect =
      getMinionDefinition(source.definitionId)
        .combatEnchantmentRetention;
    if (
      adjacentEffect?.target !== "adjacentFriendlyTribe" ||
      (adjacentEffect.tribe &&
        !minionHasTribe(target, adjacentEffect.tribe))
    ) {
      continue;
    }
    const sourceMultiplier: 1 | 2 =
      source.golden &&
      adjacentEffect.goldenMode === "doubleStats"
        ? 2
        : 1;
    multiplier = Math.max(multiplier, sourceMultiplier) as 1 | 2;
  }
  return multiplier;
}

function gainCombatBonusKeywords(
  target: MinionInstance,
  keywords: readonly CombatBonusKeyword[],
): CombatBonusKeyword[] {
  const gained: CombatBonusKeyword[] = [];
  for (const keyword of keywords) {
    if (target[keyword] === true) {
      continue;
    }
    target[keyword] = true;
    if (keyword === "taunt") {
      target.temporaryTaunt = false;
    } else if (keyword === "divineShield") {
      target.temporaryDivineShield = false;
    }
    gained.push(keyword);
  }
  return gained;
}

function makeCombatBonusKeywordsPermanent(
  target: MinionInstance,
  keywords: Iterable<CombatBonusKeyword>,
): void {
  for (const keyword of keywords) {
    target[keyword] = true;
    if (keyword === "taunt") {
      target.temporaryTaunt = false;
    } else if (keyword === "divineShield") {
      target.temporaryDivineShield = false;
    }
  }
}

function applyCombatEnchantingGain(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  gain: CombatEnchantingGain,
): CombatEnchantingGainResult {
  const attack = gain.attack ?? 0;
  const health = gain.health ?? 0;
  const retentionMultiplier = combatRetentionMultiplier(
    context,
    ownerId,
    target,
  );
  if (health !== 0) {
    adjustCombatMaximumHealth(context, ownerId, target, health);
  }
  target.attack = Math.max(0, target.attack + attack);
  target.health = context.poisonLethalMinionIds[ownerId].has(
    target.instanceId,
  )
    ? Math.min(0, target.health + health)
    : Math.max(1, target.health + health);
  const gainedKeywords = gainCombatBonusKeywords(
    target,
    gain.keywords ?? [],
  );
  if (
    reconcileConditionalMinion(target) &&
    !gainedKeywords.includes("divineShield")
  ) {
    gainedKeywords.push("divineShield");
  }

  const retainableAttack = Math.max(0, attack);
  const retainableHealth = Math.max(0, health);
  if (
    retentionMultiplier === 0 ||
    (retainableAttack === 0 &&
      retainableHealth === 0 &&
      gainedKeywords.length === 0)
  ) {
    return { gainedKeywords, retentionMultiplier: 0 };
  }

  const ledger = context.retainedCombatEnchantments[ownerId];
  const retained = (ledger[target.instanceId] ??= {
    attack: 0,
    health: 0,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    keywords: new Set(),
  });
  retained.attack += retainableAttack * retentionMultiplier;
  retained.health += retainableHealth * retentionMultiplier;
  retained.bloodGemAttack +=
    Math.max(0, gain.bloodGemAttack ?? 0) * retentionMultiplier;
  retained.bloodGemHealth +=
    Math.max(0, gain.bloodGemHealth ?? 0) * retentionMultiplier;
  for (const keyword of gainedKeywords) {
    retained.keywords.add(keyword);
  }
  return { gainedKeywords, retentionMultiplier };
}

interface ExplicitPermanentCombatGainResult {
  persisted: boolean;
}

/**
 * Printed permanent combat gains bypass the Tarecgosa/Poet retention ledger:
 * they are written back exactly once, and only for an original combat entity.
 */
function applyExplicitPermanentCombatStatGain(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  gain: CombatStatBuff,
): ExplicitPermanentCombatGainResult {
  if (gain.health !== 0) {
    adjustCombatMaximumHealth(context, ownerId, target, gain.health);
  }
  target.attack = Math.max(0, target.attack + gain.attack);
  // Keep exact non-positive Health so a small gain cannot revive overkill.
  target.health += gain.health;
  if (
    context.poisonLethalMinionIds[ownerId].has(target.instanceId)
  ) {
    target.health = Math.min(0, target.health);
  }
  reconcileConditionalMinion(target);

  if (!context.originalCombatMinionIds[ownerId].has(target.instanceId)) {
    return { persisted: false };
  }
  const owner = persistentCombatOwner(context, ownerId);
  const persistent = owner
    ? findCombatWritebackMinion(
        context,
        owner,
        ownerId,
        target.instanceId,
      )
    : undefined;
  if (!persistent) {
    return { persisted: false };
  }
  persistent.attack = Math.max(0, persistent.attack + gain.attack);
  persistent.health += gain.health;
  reconcileConditionalMinion(persistent);
  refreshDynamicMinionDescription(persistent, owner);
  return { persisted: true };
}

function applyCurrentBeetleBonus(
  context: CombatContext,
  ownerId: PlayerId,
  minion: BoardMinionInstance,
): void {
  if (!isBeetleToken(minion)) {
    return;
  }
  const bonus = context.beetleBonuses[ownerId];
  minion.attack += bonus.attack;
  minion.health += bonus.health;
  reconcileConditionalMinion(minion);
}

function improveBeetlesInCombat(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: ImproveBeetlesEffect,
  triggerLabel: string,
): void {
  const scale = component.golden ? 2 : 1;
  const attackDelta = effect.attack * scale;
  const healthDelta = effect.health * scale;
  const bonus = context.beetleBonuses[ownerId];
  bonus.attack += attackDelta;
  bonus.health += healthDelta;

  const owner = persistentCombatOwner(context, ownerId);
  if (owner) {
    owner.beetleAttackBonus += attackDelta;
    owner.beetleHealthBonus += healthDelta;
    const handBeetles = owner.hand.filter(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" && isBeetleToken(card),
    );
    buffMinions(
      [
        ...owner.board.filter(isBeetleToken),
        ...handBeetles,
      ],
      attackDelta,
      healthDelta,
    );
  }

  const sourceLabel = rallySourceLabel(component);
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    actorMinion: cloneMinion(source),
    attackDelta,
    healthDelta,
    permanentEffectImprovement: owner !== undefined,
    message: `${sourceLabel}的${triggerLabel}使本局甲虫获得+${attackDelta}/+${healthDelta}。`,
  });

  for (const target of context.boards[ownerId]) {
    if (!isBeetleToken(target) || target.health <= 0) {
      continue;
    }
    target.attack += attackDelta;
    target.health += healthDelta;
    adjustCombatMaximumHealth(
      context,
      ownerId,
      target,
      healthDelta,
    );
    reconcileConditionalMinion(target);

    const persistentTarget = owner?.board.find(
      (candidate) =>
        candidate.instanceId === target.instanceId &&
        isBeetleToken(candidate),
    );

    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta,
      healthDelta,
      minion: cloneMinion(target),
      retained: persistentTarget !== undefined,
      ...(persistentTarget
        ? { retentionMultiplier: 1 as const }
        : {}),
      message: `${sourceLabel}使${target.name}获得+${attackDelta}/+${healthDelta}。`,
    });
  }
}

interface CombatBloodGemPulseOptions {
  actorInstanceId: string;
  sourceLabel: string;
  applicationIndex?: number;
  applicationCount?: number;
  triggerObservers?: boolean;
}

function triggerCombatBloodGemObservers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
): void {
  if (target.kind !== "minion" || target.health <= 0) {
    return;
  }
  for (const component of minionEffectSources(target)) {
    const effect = getMinionDefinition(
      component.definitionId,
    ).afterBloodGemCastOnSelf;
    if (
      effect?.kind !== "playBloodGemsOnRandomOther" ||
      !context.boards[ownerId].some(
        (minion) =>
          minion.instanceId === target.instanceId &&
          minion.health > 0,
      )
    ) {
      continue;
    }
    const candidates = context.boards[ownerId].filter(
      (candidate): candidate is BoardMinionInstance =>
        candidate.kind === "minion" &&
        candidate.health > 0 &&
        candidate.instanceId !== target.instanceId &&
        !minionHasEffectSource(
          candidate,
          GEOMAGUS_ROOGUG_DEFINITION_ID,
        ),
    );
    if (candidates.length === 0) {
      continue;
    }
    const selected =
      candidates[randomIndex(context.state, candidates.length)];
    const applicationCount =
      effect.count *
      (component.golden && effect.goldenMode === "doubleCount"
        ? 2
        : 1);
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: target.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: selected.instanceId,
      actorMinion: cloneMinion(target),
      minion: cloneMinion(selected),
      message: `${rallySourceLabel(component)}触发，对${selected.name}使用${
        applicationCount
      }张鲜血宝石。`,
    });
    for (
      let application = 0;
      application < applicationCount;
      application += 1
    ) {
      applyCombatBloodGemPulse(context, ownerId, selected, {
        actorInstanceId: target.instanceId,
        sourceLabel: rallySourceLabel(component),
        applicationIndex: application,
        applicationCount,
      });
    }
  }
}

function applyCombatBloodGemPulse(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  options: CombatBloodGemPulseOptions,
): void {
  const owner = findPlayer(context.state, ownerId);
  if (!owner || target.kind !== "minion" || target.health <= 0) {
    return;
  }
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    {
      attack: owner.bloodGemAttack,
      health: owner.bloodGemHealth,
      bloodGemAttack: owner.bloodGemAttack,
      bloodGemHealth: owner.bloodGemHealth,
    },
  );
  target.bloodGemAttack += owner.bloodGemAttack;
  target.bloodGemHealth += owner.bloodGemHealth;
  const applicationCount = options.applicationCount ?? 1;
  const applicationIndex = options.applicationIndex ?? 0;
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: options.actorInstanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: owner.bloodGemAttack,
    healthDelta: owner.bloodGemHealth,
    minion: cloneMinion(target),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message: `${options.sourceLabel}对${target.name}使用了一张鲜血宝石${
      applicationCount > 1
        ? `（第${applicationIndex + 1}张）`
        : ""
    }，使其获得+${owner.bloodGemAttack}/+${owner.bloodGemHealth}。`,
  });
  if (options.triggerObservers !== false) {
    triggerCombatBloodGemObservers(context, ownerId, target);
  }
}

function flushRetainedCombatEnchantments(
  context: CombatContext,
): void {
  for (const ownerId of context.playerIds) {
    if (context.ghostOwnerId === ownerId) {
      continue;
    }
    const owner = findPlayer(context.state, ownerId);
    if (!owner) {
      continue;
    }
    for (const [instanceId, retained] of Object.entries(
      context.retainedCombatEnchantments[ownerId],
    )) {
      const target = findCombatWritebackMinion(
        context,
        owner,
        ownerId,
        instanceId,
      );
      if (!target) {
        continue;
      }
      target.attack += retained.attack;
      target.health += retained.health;
      target.bloodGemAttack += retained.bloodGemAttack;
      target.bloodGemHealth += retained.bloodGemHealth;
      makeCombatBonusKeywordsPermanent(
        target,
        retained.keywords,
      );
      reconcileConditionalMinion(target);
      refreshDynamicMinionDescription(target, owner);
    }
    context.retainedCombatEnchantments[ownerId] = {};
  }
}

function combatHandMinions(
  context: CombatContext,
  ownerId: PlayerId,
): readonly BoardMinionInstance[] {
  const owner = findPlayer(context.state, ownerId);
  if (!owner) {
    return [];
  }
  if (context.ghostOwnerId === ownerId) {
    const currentBonus = context.beetleBonuses[ownerId];
    const attackDelta =
      currentBonus.attack - owner.beetleAttackBonus;
    const healthDelta =
      currentBonus.health - owner.beetleHealthBonus;
    if (attackDelta === 0 && healthDelta === 0) {
      return owner.ghostHand;
    }
    return owner.ghostHand.map((minion) => {
      if (!isBeetleToken(minion)) {
        return minion;
      }
      const adjusted = cloneMinion(minion);
      adjusted.attack += attackDelta;
      adjusted.health += healthDelta;
      reconcileConditionalMinion(adjusted);
      return adjusted;
    });
  }
  return owner.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function pushWhereverBuffEvent(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
  target: MinionInstance,
  delta: { attack: number; health: number },
  message: string,
): void {
  if (delta.attack === 0 && delta.health === 0) {
    return;
  }
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: delta.attack,
    healthDelta: delta.health,
    minion: cloneMinion(target),
    message,
  });
}

function reconcileCombatWhereverMinions(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
  message: string,
): void {
  for (const minion of context.boards[ownerId]) {
    const delta = reconcileWhereverMinion(
      minion,
      context.astralAutomatonsSummoned[ownerId],
      context.eternalKnightsDied[ownerId],
    );
    pushWhereverBuffEvent(
      context,
      ownerId,
      actorInstanceId,
      minion,
      delta,
      message,
    );
  }
}

function observeCombatAutomatonSummon(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: BoardMinionInstance,
): void {
  if (summoned.definitionId !== ASTRAL_AUTOMATON_DEFINITION_ID) {
    return;
  }
  summoned.astralAutomatonSummoned = true;
  context.astralAutomatonsSummoned[ownerId] += 1;
  const persistentOwner = persistentCombatOwner(context, ownerId);
  if (persistentOwner) {
    persistentOwner.astralAutomatonsSummoned += 1;
    reconcilePlayerWhereverMinions(persistentOwner);
  }
  reconcileCombatWhereverMinions(
    context,
    ownerId,
    summoned.instanceId,
    `${summoned.name}的召唤强化了其他星元自动机。`,
  );
}

function observeCombatFriendlyDeath(
  context: CombatContext,
  death: DeadMinion,
): void {
  const persistentOwner = persistentCombatOwner(
    context,
    death.ownerId,
  );
  if (persistentOwner) {
    observePersistentFriendlyDeath(persistentOwner, death.minion);
  }
  if (death.minion.definitionId !== ETERNAL_KNIGHT_DEFINITION_ID) {
    return;
  }
  context.eternalKnightsDied[death.ownerId] += 1;
  reconcileCombatWhereverMinions(
    context,
    death.ownerId,
    death.minion.instanceId,
    `${death.minion.name}的死亡强化了永恒骑士。`,
  );
}

function combatBuffTargets(
  state: GameState,
  board: MinionInstance[],
  source: MinionInstance,
  effect: BuffEffect,
): MinionInstance[] {
  switch (effect.target) {
    case "self":
      return [];
    case "allFriendly":
      return [...board];
    case "otherFriendly":
      return board.filter(
        (minion) => minion.instanceId !== source.instanceId,
      );
    case "otherFriendlyTribe":
      return board.filter(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, effect.tribe),
      );
    case "friendlyTribe":
      return board.filter((minion) =>
        minionHasTribe(minion, effect.tribe),
      );
    case "randomFriendlyTribe": {
      const candidates = board.filter(
        (minion) => minionHasTribe(minion, effect.tribe),
      );
      return candidates.length === 0
        ? []
        : [candidates[randomIndex(state, candidates.length)]];
    }
    case "adjacentFriendly":
      return [];
    case "randomFriendly":
      return board.length === 0
        ? []
        : [board[randomIndex(state, board.length)]];
  }
}

function pushStartOfCombatBuff(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  target: MinionInstance,
  attackDelta: number,
  healthDelta: number,
  divineShield: boolean,
  message: string,
  taunt = false,
): void {
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    {
      attack: attackDelta,
      health: healthDelta,
      keywords: [
        ...(divineShield ? (["divineShield"] as const) : []),
        ...(taunt ? (["taunt"] as const) : []),
      ],
    },
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta,
    healthDelta,
    minion: cloneMinion(target),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message: `${rallySourceLabel(component)}${message}`,
  });
}

function applyStartOfCombatEffects(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const board = context.boards[ownerId];
  for (const source of [...board]) {
    for (const component of minionEffectSources(source)) {
      const effects =
        getMinionDefinition(component.definitionId).startOfCombat ?? [];
      if (effects.length === 0) {
        continue;
      }
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        message: `${rallySourceLabel(component)}触发了战斗开始效果。`,
      });
      const scale = component.golden ? 2 : 1;
      for (const effect of effects) {
        if (effect.kind === "buff") {
          const targets =
            effect.target === "self"
              ? [source]
              : combatBuffTargets(
                  context.state,
                  board,
                  source,
                  effect,
                );
          for (const target of targets) {
            const attackDelta = effect.attack * scale;
            const healthDelta = effect.health * scale;
            pushStartOfCombatBuff(
              context,
              ownerId,
              source,
              component,
              target,
              attackDelta,
              healthDelta,
              false,
              `使${target.name}获得+${attackDelta}/+${healthDelta}。`,
              effect.taunt === true,
            );
          }
          continue;
        }

        if (effect.kind === "grantShield") {
          if (effect.target === "self") {
            pushStartOfCombatBuff(
              context,
              ownerId,
              source,
              component,
              source,
              0,
              0,
              true,
              "获得了圣盾。",
            );
            continue;
          }
          const candidates = board.filter(
            (minion) => minion.instanceId !== source.instanceId,
          );
          for (
            let count = 0;
            count < scale && candidates.length > 0;
            count += 1
          ) {
            const targetIndex = randomIndex(
              context.state,
              candidates.length,
            );
            const target = candidates[targetIndex];
            pushStartOfCombatBuff(
              context,
              ownerId,
              source,
              component,
              target,
              0,
              0,
              true,
              `使${target.name}获得圣盾。`,
            );
            candidates.splice(targetIndex, 1);
          }
          continue;
        }

        if (effect.kind === "buffRandomOtherTribe") {
          const candidates = board.filter(
            (minion) =>
              minion.instanceId !== source.instanceId &&
              minionHasTribe(minion, effect.tribe) &&
              (!effect.divineShield || !minion.divineShield),
          );
          const targetCount =
            effect.count *
            (component.golden &&
            effect.goldenMode === "doubleCount"
              ? 2
              : 1);
          for (
            let count = 0;
            count < targetCount && candidates.length > 0;
            count += 1
          ) {
            const targetIndex = randomIndex(
              context.state,
              candidates.length,
            );
            const target = candidates[targetIndex];
            pushStartOfCombatBuff(
              context,
              ownerId,
              source,
              component,
              target,
              effect.attack,
              effect.health,
              effect.divineShield === true,
              `使${target.name}获得+${effect.attack}/+${effect.health}${
                effect.divineShield ? "和圣盾" : ""
              }。`,
            );
            candidates.splice(targetIndex, 1);
          }
          continue;
        }

        if (effect.kind === "growingTribeBuff") {
          const amount = growingStartOfCombatBuffAmount(
            source,
            effect,
          );
          for (const target of board.filter((minion) =>
            minionHasTribe(minion, effect.tribe),
          )) {
            pushStartOfCombatBuff(
              context,
              ownerId,
              source,
              component,
              target,
              amount.attack,
              amount.health,
              false,
              `使${target.name}获得+${amount.attack}/+${amount.health}。`,
            );
          }
          continue;
        }

        const handMinions = combatHandMinions(context, ownerId);
        if (
          effect.kind === "summonHighestAttackHandTribeWhenSpace"
        ) {
          const pendingSummon: PendingStartOfCombatHandSummon = {
            source: cloneMinion(source),
            sourceLabel: rallySourceLabel(component),
            tribe: effect.tribe,
            remainingCount:
              effect.count *
              (component.golden &&
              effect.goldenMode === "doubleCount"
                ? 2
                : 1),
            usedHandInstanceIds: new Set(),
          };
          context.pendingStartOfCombatHandSummons[ownerId].push(
            pendingSummon,
          );
          summonPendingStartOfCombatHandMinions(
            context,
            ownerId,
            pendingSummon,
          );
          continue;
        }
        const amountScale =
          component.golden &&
          effect.goldenMode === "doubleAmount"
            ? 2
            : 1;
        if (effect.kind === "gainHighestHandAttack") {
          if (handMinions.length === 0) {
            continue;
          }
          const attackDelta =
            Math.max(...handMinions.map((minion) => minion.attack)) *
            amountScale;
          pushStartOfCombatBuff(
            context,
            ownerId,
            source,
            component,
            source,
            attackDelta,
            0,
            false,
            `从手牌随从中获得了+${attackDelta}攻击力。`,
          );
          continue;
        }

        if (effect.kind !== "gainAllHandMinionStats") {
          continue;
        }
        const attackDelta =
          handMinions.reduce(
            (total, minion) => total + minion.attack,
            0,
          ) * amountScale;
        const healthDelta =
          handMinions.reduce(
            (total, minion) => total + minion.health,
            0,
          ) * amountScale;
        if (attackDelta === 0 && healthDelta === 0) {
          continue;
        }
        pushStartOfCombatBuff(
          context,
          ownerId,
          source,
          component,
          source,
          attackDelta,
          healthDelta,
          false,
          `汇总手牌随从，获得+${attackDelta}/+${healthDelta}。`,
        );
      }
    }
  }
}

function applyCombatAuras(board: MinionInstance[]): void {
  for (const source of board) {
    for (const component of minionEffectSources(source)) {
      const aura = getMinionDefinition(component.definitionId).aura;
      if (!aura) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      for (const target of board) {
        if (
          !minionHasTribe(target, aura.tribe) ||
          (aura.otherOnly && target.instanceId === source.instanceId)
        ) {
          continue;
        }
        target.attack += aura.attack * scale;
        target.health += aura.health * scale;
      }
    }
  }
  for (const minion of board) {
    reconcileConditionalMinion(minion);
  }
}

function applyExistingAurasToSummoned(
  board: readonly MinionInstance[],
  summoned: MinionInstance,
): void {
  for (const source of board) {
    for (const component of minionEffectSources(source)) {
      const aura = getMinionDefinition(component.definitionId).aura;
      if (
        !aura ||
        !minionHasTribe(summoned, aura.tribe) ||
        (aura.otherOnly && summoned.instanceId === source.instanceId)
      ) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      summoned.attack += aura.attack * scale;
      summoned.health += aura.health * scale;
    }
  }
  reconcileConditionalMinion(summoned);
}

function applyNewAuraSource(
  context: CombatContext,
  source: MinionInstance,
  ownerId: PlayerId,
): Omit<BattleEvent, "index">[] {
  const board = context.boards[ownerId];
  const events: Omit<BattleEvent, "index">[] = [];
  for (const component of minionEffectSources(source)) {
    const aura = getMinionDefinition(component.definitionId).aura;
    if (!aura) {
      continue;
    }
    const scale = component.golden ? 2 : 1;
    for (const target of board) {
      if (
        !minionHasTribe(target, aura.tribe) ||
        (aura.otherOnly && target.instanceId === source.instanceId)
      ) {
        continue;
      }
      const attackDelta = aura.attack * scale;
      const healthDelta = aura.health * scale;
      target.attack += attackDelta;
      target.health += healthDelta;
      adjustCombatMaximumHealth(
        context,
        ownerId,
        target,
        healthDelta,
      );
      reconcileConditionalMinion(target);
      events.push({
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: cloneMinion(target),
        message: `${source.name}的光环使${target.name}获得+${attackDelta}/+${healthDelta}。`,
      });
    }
  }
  return events;
}

function removeCombatAuraSource(
  context: CombatContext,
  death: DeadMinion,
): void {
  for (const component of minionEffectSources(death.minion)) {
    const aura = getMinionDefinition(component.definitionId).aura;
    if (!aura) {
      continue;
    }
    const scale = component.golden ? 2 : 1;
    for (const target of context.boards[death.ownerId]) {
      if (!minionHasTribe(target, aura.tribe)) {
        continue;
      }
      const attackDelta = -aura.attack * scale;
      const healthDelta = -aura.health * scale;
      target.attack += attackDelta;
      target.health += healthDelta;
      adjustCombatMaximumHealth(
        context,
        death.ownerId,
        target,
        healthDelta,
      );
      const targetSnapshot = cloneMinion(target);
      targetSnapshot.health = Math.max(0, targetSnapshot.health);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        targetPlayerId: death.ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: targetSnapshot,
        message: `${death.minion.name}阵亡后，${target.name}失去光环加成。`,
      });
    }
  }
}

function extraDeathrattles(board: readonly MinionInstance[]): number {
  return board.reduce((total, minion) => {
    return (
      total +
      minionEffectSources(minion).reduce((sourceTotal, component) => {
        const extra =
          getMinionDefinition(component.definitionId)
            .extraDeathrattles ?? 0;
        return sourceTotal + extra * (component.golden ? 2 : 1);
      }, 0)
    );
  }, 0);
}

function applyPersistentTribeBuff(
  context: CombatContext,
  ownerId: PlayerId,
  minion: MinionInstance,
): void {
  for (const [tribe, buff] of Object.entries(
    context.tribeBuffs[ownerId],
  ) as [Tribe, CombatStatBuff][]) {
    if (!buff || !minionHasTribe(minion, tribe)) {
      continue;
    }
    minion.attack += buff.attack;
    minion.health += buff.health;
  }
}

function applyCombatSummonHeroPower(
  context: CombatContext,
  ownerId: PlayerId,
  minion: MinionInstance,
): void {
  const owner = findPlayer(context.state, ownerId);
  if (!owner || !playerHasHeroPower(owner, "buffCombatSummons")) {
    return;
  }
  minion.attack += 1;
  minion.health += 2;
  minion.taunt = true;
}

interface FriendlySummonTriggerResult {
  events: Omit<BattleEvent, "index">[];
  /** Snapshot immediately before the first visible buff to the summoned unit. */
  summonSnapshotBeforeBuff?: BoardMinionInstance;
}

function improveGrowingSummonAttackInCombat(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  growth: number,
): boolean {
  setEffectCounter(
    source,
    SUMMON_ATTACK_GROWTH_COUNTER,
    effectCounter(source, SUMMON_ATTACK_GROWTH_COUNTER, 0) +
      growth,
  );
  refreshDynamicMinionDescription(source);

  if (
    !context.originalCombatMinionIds[ownerId].has(
      source.instanceId,
    )
  ) {
    return false;
  }
  const owner = persistentCombatOwner(context, ownerId);
  const persistent = owner
    ? findCombatWritebackMinion(
        context,
        owner,
        ownerId,
        source.instanceId,
      )
    : undefined;
  if (!persistent) {
    return false;
  }
  setEffectCounter(
    persistent,
    SUMMON_ATTACK_GROWTH_COUNTER,
    effectCounter(
      persistent,
      SUMMON_ATTACK_GROWTH_COUNTER,
      0,
    ) + growth,
  );
  refreshDynamicMinionDescription(persistent, owner);
  return true;
}

function triggerAfterFriendlySummoned(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: MinionInstance,
): FriendlySummonTriggerResult {
  const events: Omit<BattleEvent, "index">[] = [];
  let summonSnapshotBeforeBuff: BoardMinionInstance | undefined;
  for (const watcher of context.boards[ownerId]) {
    if (watcher.instanceId === summoned.instanceId) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlySummoned;
      if (!trigger || !minionHasTribe(summoned, trigger.tribe)) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      if (trigger.permanentAttackGrowth !== undefined) {
        summonSnapshotBeforeBuff ??= cloneMinion(summoned);
        const attackDelta =
          (trigger.attack ?? 0) * scale +
          effectCounter(
            watcher,
            SUMMON_ATTACK_GROWTH_COUNTER,
            0,
          );
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          summoned,
          { attack: attackDelta },
        );
        const persisted = improveGrowingSummonAttackInCombat(
          context,
          ownerId,
          watcher,
          trigger.permanentAttackGrowth * scale,
        );
        const nextAttack =
          (trigger.attack ?? 0) * scale +
          effectCounter(
            watcher,
            SUMMON_ATTACK_GROWTH_COUNTER,
            0,
          );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: summoned.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta,
          healthDelta: 0,
          minion: cloneMinion(summoned),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}使${summoned.name}获得+${attackDelta}攻击力。`,
        });
        events.push({
          type: "trigger",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          actorMinion: cloneMinion(watcher),
          amount: nextAttack,
          permanentEffectImprovement: persisted,
          message: persisted
            ? `${rallySourceLabel(component)}将下一次召唤野兽的攻击力加成永久提升至+${nextAttack}。`
            : `${rallySourceLabel(component)}将本场战斗中下一次召唤野兽的攻击力加成提升至+${nextAttack}。`,
        });
      } else if (trigger.attackMultiplier !== undefined) {
        summonSnapshotBeforeBuff ??= cloneMinion(summoned);
        const multiplier = component.golden
          ? (trigger.goldenAttackMultiplier ?? trigger.attackMultiplier)
          : trigger.attackMultiplier;
        const attackDelta = summoned.attack * (multiplier - 1);
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          summoned,
          { attack: attackDelta },
        );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: summoned.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta,
          healthDelta: 0,
          minion: cloneMinion(summoned),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}使${summoned.name}的攻击力变为${multiplier}倍。`,
        });
      } else if (trigger.grantShield) {
        const attackDelta = (trigger.attack ?? 0) * scale;
        const healthDelta = (trigger.health ?? 0) * scale;
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          watcher,
          {
            attack: attackDelta,
            health: healthDelta,
            keywords: ["divineShield"],
          },
        );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: summoned.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: watcher.instanceId,
          attackDelta,
          healthDelta,
          minion: cloneMinion(watcher),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${summoned.name}被召唤后，${watcher.name}获得+${attackDelta}/+${healthDelta}和圣盾。`,
        });
      } else {
        applyCombatEnchantingGain(context, ownerId, summoned, {
          attack: (trigger.attack ?? 0) * scale,
          health: (trigger.health ?? 0) * scale,
        });
      }
    }
  }
  return {
    events,
    ...(summonSnapshotBeforeBuff
      ? { summonSnapshotBeforeBuff }
      : {}),
  };
}

function summonCombatMinion(
  context: CombatContext,
  ownerId: PlayerId,
  definitionId: string,
  insertAt: number,
  source: MinionInstance,
  golden = false,
  taunt = false,
): MinionInstance | null {
  if (context.boards[ownerId].length >= MAX_BOARD_SIZE) {
    return null;
  }
  const summoned = createMinionInstance(context.state, definitionId, 0);
  if (golden) {
    makeGoldenToken(summoned);
  }
  applyCurrentBeetleBonus(context, ownerId, summoned);
  if (taunt) {
    summoned.taunt = true;
  }
  return insertCombatMinion(
    context,
    ownerId,
    summoned,
    insertAt,
    source,
    `${source.name}召唤了${summoned.name}。`,
  );
}

function resolveCombatSummonEffect(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: SummonEffect,
  insertAt: number,
): void {
  const board = context.boards[ownerId];
  const baseCount =
    effect.count === "sourceAttack" ? source.attack : effect.count;
  const doublesCount =
    component.golden && effect.goldenMode === "doubleCount";
  const summonCount = baseCount * (doublesCount ? 2 : 1);
  const summonedTokens: MinionInstance[] = [];
  for (
    let count = 0;
    count < summonCount && board.length < MAX_BOARD_SIZE;
    count += 1
  ) {
    const summoned = summonCombatMinion(
      context,
      ownerId,
      effect.definitionId,
      insertAt + count,
      source,
      component.golden && !doublesCount,
      effect.taunt === true,
    );
    if (summoned) {
      summonedTokens.push(summoned);
    }
    if (summoned && effect.immediateAttack) {
      performImmediateAttack(context, ownerId, summoned);
    }
  }
  const bloodGemCount = bloodGemsPerSummonedToken(
    effect,
    component.golden,
  );
  for (const summoned of summonedTokens) {
    if (bloodGemCount > 0) {
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: summoned.instanceId,
        actorMinion: cloneMinion(source),
        minion: cloneMinion(summoned),
        message: `${rallySourceLabel(component)}开始对${summoned.name}使用${bloodGemCount}张鲜血宝石。`,
      });
      for (
        let application = 0;
        application < bloodGemCount;
        application += 1
      ) {
        applyCombatBloodGemPulse(context, ownerId, summoned, {
          actorInstanceId: source.instanceId,
          sourceLabel: rallySourceLabel(component),
          applicationIndex: application,
          applicationCount: bloodGemCount,
        });
      }
    }
  }
}

function insertCombatMinion(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: BoardMinionInstance,
  insertAt: number,
  source: MinionInstance,
  message: string,
  summonReason?: BattleEvent["summonReason"],
  maximumHealthBeforeSummonBonuses?: number,
): MinionInstance | null {
  const board = context.boards[ownerId];
  if (board.length >= MAX_BOARD_SIZE) {
    return null;
  }
  const healthBeforeSummonBonuses = summoned.health;
  reconcileWhereverMinion(
    summoned,
    context.astralAutomatonsSummoned[ownerId],
    context.eternalKnightsDied[ownerId],
  );
  if (
    summonReason !== "rallyFromHand" &&
    summonReason !== "startOfCombatFromHand"
  ) {
    applyPersistentTribeBuff(context, ownerId, summoned);
  }
  applyCombatSummonHeroPower(context, ownerId, summoned);
  applyExistingAurasToSummoned(board, summoned);
  context.maximumHealths[ownerId][summoned.instanceId] ??= Math.max(
    1,
    (maximumHealthBeforeSummonBonuses ??
      healthBeforeSummonBonuses) +
      (summoned.health - healthBeforeSummonBonuses),
  );
  const boardIndex = Math.min(Math.max(0, insertAt), board.length);
  board.splice(boardIndex, 0, summoned);
  const auraEvents = applyNewAuraSource(context, summoned, ownerId);
  const afterSummon = triggerAfterFriendlySummoned(
    context,
    ownerId,
    summoned,
  );
  for (const minion of board) {
    reconcileConditionalMinion(minion);
  }
  pushBattleEvent(context.events, {
    type: "summon",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: summoned.instanceId,
    boardIndex,
    minion:
      afterSummon.summonSnapshotBeforeBuff ?? cloneMinion(summoned),
    summonReason,
    message,
  });
  for (const event of [...auraEvents, ...afterSummon.events]) {
    pushBattleEvent(context.events, event);
  }
  observeCombatAutomatonSummon(context, ownerId, summoned);
  return summoned;
}

function summonPendingBeetles(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  while (
    context.pendingBeetles[ownerId] > 0 &&
    context.boards[ownerId].length < MAX_BOARD_SIZE
  ) {
    const beetle = createMinionInstance(
      context.state,
      BEETLE_TOKEN_DEFINITION_ID,
      0,
    );
    applyCurrentBeetleBonus(context, ownerId, beetle);
    beetle.taunt = true;
    const summoned = insertCombatMinion(
      context,
      ownerId,
      beetle,
      context.boards[ownerId].length,
      beetle,
      "甲虫恩泽召唤了一只具有嘲讽的甲虫。",
      "beetle",
    );
    if (!summoned) {
      return;
    }
    context.pendingBeetles[ownerId] -= 1;
  }
}

function summonPendingStartOfCombatHandMinions(
  context: CombatContext,
  ownerId: PlayerId,
  openingPending?: PendingStartOfCombatHandSummon,
): void {
  const queue = context.pendingStartOfCombatHandSummons[ownerId];
  let openingInsertAfterInstanceId =
    openingPending?.source.instanceId;
  let madeProgress = true;
  while (
    madeProgress &&
    queue.length > 0 &&
    context.boards[ownerId].length < MAX_BOARD_SIZE
  ) {
    madeProgress = false;
    for (
      let queueIndex = 0;
      queueIndex < queue.length &&
      context.boards[ownerId].length < MAX_BOARD_SIZE;

    ) {
      const pending = queue[queueIndex];
      if (pending.remainingCount <= 0) {
        queue.splice(queueIndex, 1);
        continue;
      }
      const candidates = combatHandMinions(context, ownerId).filter(
        (candidate) =>
          minionHasTribe(candidate, pending.tribe) &&
          !pending.usedHandInstanceIds.has(candidate.instanceId),
      );
      const [selected] = selectHighestAttackHandMinions(
        context.state,
        candidates,
        1,
      );
      if (!selected) {
        queueIndex += 1;
        continue;
      }
      const summoned = cloneOwnedMinionForCombat(
        context.state,
        selected,
      );
      const openingAnchorIndex =
        pending === openingPending &&
        openingInsertAfterInstanceId !== undefined
          ? context.boards[ownerId].findIndex(
              (minion) =>
                minion.instanceId === openingInsertAfterInstanceId,
            )
          : -1;
      const inserted = insertCombatMinion(
        context,
        ownerId,
        summoned,
        openingAnchorIndex >= 0
          ? openingAnchorIndex + 1
          : context.boards[ownerId].length,
        pending.source,
        `${pending.sourceLabel}从手牌召唤了${summoned.name}（仅限本场战斗）。`,
        "startOfCombatFromHand",
      );
      if (!inserted) {
        return;
      }
      pending.usedHandInstanceIds.add(selected.instanceId);
      pending.remainingCount -= 1;
      madeProgress = true;
      if (pending === openingPending && openingAnchorIndex >= 0) {
        openingInsertAfterInstanceId = summoned.instanceId;
      }
      if (pending.remainingCount <= 0) {
        queue.splice(queueIndex, 1);
      }
    }
  }
}

function targetForEnemyDamage(
  context: CombatContext,
  enemyId: PlayerId,
  rule: "random" | "highestHealth",
): MinionInstance | null {
  const candidates = context.boards[enemyId].filter(
    (minion) => minion.health > 0,
  );
  if (candidates.length === 0) {
    return null;
  }
  if (rule === "random") {
    return candidates[randomIndex(context.state, candidates.length)];
  }
  const highestHealth = Math.max(...candidates.map((minion) => minion.health));
  const healthiest = candidates.filter(
    (minion) => minion.health === highestHealth,
  );
  return healthiest[randomIndex(context.state, healthiest.length)];
}

function triggerSelfDamaged(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
): void {
  const board = context.boards[ownerId];
  const sourceIndex = Math.max(
    0,
    board.findIndex((minion) => minion.instanceId === target.instanceId),
  );
  for (const component of minionEffectSources(target)) {
    const effects =
      getMinionDefinition(component.definitionId).afterSelfDamaged;
    if (!effects) {
      continue;
    }
    for (const effect of effects) {
      if (effect.kind === "gainFreeRefreshes") {
        const triggerKey = `${target.instanceId}:${component.sourceInstanceId}:${component.definitionId}:freeRefreshes`;
        const triggerCounts =
          context.limitedSelfDamageTriggers[ownerId];
        const previousTriggers = triggerCounts[triggerKey] ?? 0;
        if (
          effect.maxTriggersPerTurn !== undefined &&
          previousTriggers >= effect.maxTriggersPerTurn
        ) {
          continue;
        }
        triggerCounts[triggerKey] = previousTriggers + 1;
        const refreshCount =
          effect.count * (component.golden ? 2 : 1);
        const owner = persistentCombatOwner(context, ownerId);
        if (owner) {
          owner.freeRefreshes += refreshCount;
        }
        const remaining =
          effect.maxTriggersPerTurn === undefined
            ? undefined
            : Math.max(
                0,
                effect.maxTriggersPerTurn - previousTriggers - 1,
              );
        pushBattleEvent(context.events, {
          type: "trigger",
          actorPlayerId: ownerId,
          actorInstanceId: target.instanceId,
          targetPlayerId: ownerId,
          amount: refreshCount,
          actorMinion: cloneMinion(target),
          message: owner
            ? `${rallySourceLabel(component)}获得${refreshCount}次免费刷新${remaining === undefined ? "" : `（本场还可触发${remaining}次）`}。`
            : `${rallySourceLabel(component)}触发了免费刷新效果，但幽灵不会保留奖励。`,
        });
        continue;
      }
      if (effect.kind === "buff") {
        const attackDelta =
          effect.attack * (component.golden ? 2 : 1);
        const healthDelta =
          effect.health * (component.golden ? 2 : 1);
        for (const buffTarget of combatBuffTargets(
          context.state,
          board,
          target,
          effect,
        )) {
          const healthBeforeGain = buffTarget.health;
          const gain = applyCombatEnchantingGain(
            context,
            ownerId,
            buffTarget,
            {
              attack: attackDelta,
              health: healthDelta,
              keywords: effect.taunt ? ["taunt"] : [],
            },
          );
          const exactHealthAfterGain =
            healthBeforeGain + healthDelta;
          if (
            healthBeforeGain <= 0 &&
            exactHealthAfterGain <= 0
          ) {
            buffTarget.health = exactHealthAfterGain;
          }
          const buffSnapshot = cloneMinion(buffTarget);
          buffSnapshot.health = Math.max(
            0,
            buffSnapshot.health,
          );
          pushBattleEvent(context.events, {
            type: "buff",
            actorPlayerId: ownerId,
            actorInstanceId: target.instanceId,
            targetPlayerId: ownerId,
            targetInstanceId: buffTarget.instanceId,
            actorMinion: cloneMinion(target),
            attackDelta,
            healthDelta,
            minion: buffSnapshot,
            retained: gain.retentionMultiplier > 0,
            ...(gain.retentionMultiplier > 0
              ? {
                  retentionMultiplier:
                    gain.retentionMultiplier,
                }
              : {}),
            message: `${rallySourceLabel(component)}受伤后，使${buffTarget.name}获得+${attackDelta}/+${healthDelta}。`,
          });
        }
        continue;
      }
      if (effect.kind === "buffRandomHandMinion") {
        resolveCombatHandBuff(
          context,
          ownerId,
          target,
          component,
          effect,
        );
        continue;
      }
      if (effect.kind === "improveBeetles") {
        improveBeetlesInCombat(
          context,
          ownerId,
          target,
          component,
          effect,
          "受伤效果",
        );
        continue;
      }
      if (effect.kind !== "summon") {
        continue;
      }
      const baseCount =
        effect.count === "sourceAttack" ? target.attack : effect.count;
      for (let count = 0; count < baseCount; count += 1) {
        summonCombatMinion(
          context,
          ownerId,
          effect.definitionId,
          sourceIndex + 1 + count,
          target,
          component.golden,
        );
      }
    }
  }
}

interface CapturedFriendlyDamagedObserver {
  watcher: MinionInstance;
  component: MinionEffectSource;
  trigger: FriendlyDamagedTrigger;
}

interface CapturedFriendlyDamageDealtObserver {
  watcher: MinionInstance;
  component: MinionEffectSource;
  trigger: FriendlyDamageDealtTrigger;
}

interface CombatDamageObservation {
  sourceOwnerId: PlayerId;
  source: MinionInstance;
  targetOwnerId: PlayerId;
  target: MinionInstance;
  friendlyDamagedObservers: readonly CapturedFriendlyDamagedObserver[];
  friendlyDamageDealtObservers: readonly CapturedFriendlyDamageDealtObserver[];
}

function captureCombatDamageObservation(
  context: CombatContext,
  sourceOwnerId: PlayerId,
  source: MinionInstance,
  targetOwnerId: PlayerId,
  target: MinionInstance,
): CombatDamageObservation {
  const friendlyDamagedObservers: CapturedFriendlyDamagedObserver[] = [];
  const friendlyDamageDealtObservers: CapturedFriendlyDamageDealtObserver[] =
    [];
  for (const watcher of context.boards[targetOwnerId]) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyDamaged;
      if (
        !trigger ||
        !minionHasTribe(target, trigger.tribe) ||
        (trigger.otherOnly &&
          watcher.instanceId === target.instanceId)
      ) {
        continue;
      }
      friendlyDamagedObservers.push({ watcher, component, trigger });
    }
  }
  for (const watcher of context.boards[sourceOwnerId]) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyDealsDamage;
      if (
        !trigger ||
        !minionHasTribe(source, trigger.tribe) ||
        (trigger.otherSourceOnly &&
          watcher.instanceId === source.instanceId)
      ) {
        continue;
      }
      friendlyDamageDealtObservers.push({
        watcher,
        component,
        trigger,
      });
    }
  }
  return {
    sourceOwnerId,
    source,
    targetOwnerId,
    target,
    friendlyDamagedObservers,
    friendlyDamageDealtObservers,
  };
}

function triggerFriendlyDamagedObservers(
  context: CombatContext,
  observation: CombatDamageObservation,
): void {
  const { targetOwnerId, target } = observation;
  const board = context.boards[targetOwnerId];
  for (const captured of observation.friendlyDamagedObservers) {
    const { watcher, component, trigger } = captured;
    if (
      !board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    const buffTarget =
      trigger.target === "self"
        ? watcher
        : (() => {
            const targetTribe = trigger.targetTribe ?? trigger.tribe;
            const candidates = board.filter(
              (candidate) =>
                candidate.health > 0 &&
                candidate.instanceId !== target.instanceId &&
                minionHasTribe(candidate, targetTribe),
            );
            return candidates.length === 0
              ? undefined
              : candidates[
                  randomIndex(context.state, candidates.length)
                ];
          })();
    if (!buffTarget) {
      continue;
    }

    const scale = component.golden ? 2 : 1;
    const attackDelta = trigger.attack * scale;
    const healthDelta = trigger.health * scale;
    let retentionMultiplier: CombatRetentionMultiplier = 0;
    if (trigger.permanent) {
      const gain = applyExplicitPermanentCombatStatGain(
        context,
        targetOwnerId,
        buffTarget,
        { attack: attackDelta, health: healthDelta },
      );
      retentionMultiplier = gain.persisted ? 1 : 0;
    } else {
      retentionMultiplier = applyCombatEnchantingGain(
        context,
        targetOwnerId,
        buffTarget,
        { attack: attackDelta, health: healthDelta },
      ).retentionMultiplier;
    }

    const buffSnapshot = cloneMinion(buffTarget);
    buffSnapshot.health = Math.max(0, buffSnapshot.health);
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: targetOwnerId,
      actorInstanceId: watcher.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: buffTarget.instanceId,
      actorMinion: cloneMinion(watcher),
      attackDelta,
      healthDelta,
      minion: buffSnapshot,
      retained: retentionMultiplier > 0,
      ...(retentionMultiplier > 0 ? { retentionMultiplier } : {}),
      message:
        trigger.target === "self"
          ? `${rallySourceLabel(component)}因${target.name}受到伤害而获得+${attackDelta}/+${healthDelta}。`
          : `${rallySourceLabel(component)}因${target.name}受到伤害，使${buffTarget.name}获得+${attackDelta}/+${healthDelta}。`,
    });
  }
}

function triggerFriendlyDamageDealtObservers(
  context: CombatContext,
  observation: CombatDamageObservation,
): void {
  const { sourceOwnerId, source } = observation;
  const board = context.boards[sourceOwnerId];
  for (const captured of observation.friendlyDamageDealtObservers) {
    const { watcher, component, trigger } = captured;
    if (
      !board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    const targets =
      trigger.target === "self"
        ? [watcher]
        : board.filter(
            (candidate) =>
              candidate.instanceId !== source.instanceId,
          );
    const scale = component.golden ? 2 : 1;
    const attackDelta = trigger.attack * scale;
    const healthDelta = trigger.health * scale;

    for (const buffTarget of targets) {
      let retentionMultiplier: CombatRetentionMultiplier = 0;
      if (trigger.permanent) {
        const gain = applyExplicitPermanentCombatStatGain(
          context,
          sourceOwnerId,
          buffTarget,
          { attack: attackDelta, health: healthDelta },
        );
        retentionMultiplier = gain.persisted ? 1 : 0;
      } else {
        const healthBeforeGain = buffTarget.health;
        const gain = applyCombatEnchantingGain(
          context,
          sourceOwnerId,
          buffTarget,
          { attack: attackDelta, health: healthDelta },
        );
        const exactHealthAfterGain =
          healthBeforeGain + healthDelta;
        if (
          healthBeforeGain <= 0 &&
          exactHealthAfterGain <= 0
        ) {
          buffTarget.health = exactHealthAfterGain;
        }
        retentionMultiplier = gain.retentionMultiplier;
      }

      const buffSnapshot = cloneMinion(buffTarget);
      buffSnapshot.health = Math.max(0, buffSnapshot.health);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: sourceOwnerId,
        actorInstanceId: watcher.instanceId,
        targetPlayerId: sourceOwnerId,
        targetInstanceId: buffTarget.instanceId,
        actorMinion: cloneMinion(watcher),
        attackDelta,
        healthDelta,
        minion: buffSnapshot,
        retained: retentionMultiplier > 0,
        ...(retentionMultiplier > 0
          ? { retentionMultiplier }
          : {}),
        message:
          trigger.target === "self"
            ? retentionMultiplier > 0
              ? `${rallySourceLabel(component)}因${source.name}造成伤害而永久获得+${attackDelta}/+${healthDelta}。`
              : `${rallySourceLabel(component)}因${source.name}造成伤害，在本场战斗中获得+${attackDelta}/+${healthDelta}。`
            : `${rallySourceLabel(component)}因${source.name}造成伤害，使${buffTarget.name}获得+${attackDelta}/+${healthDelta}。`,
      });
    }
  }
}

function triggerCombatDamageObservation(
  context: CombatContext,
  observation: CombatDamageObservation,
): void {
  triggerSelfDamaged(
    context,
    observation.targetOwnerId,
    observation.target,
  );
  triggerFriendlyDamagedObservers(context, observation);
  triggerFriendlyDamageDealtObservers(context, observation);
}

function resolveCombatHandBuff(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: BuffRandomHandMinionEffect,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const candidates = owner.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  if (candidates.length === 0) {
    return;
  }
  const target =
    candidates[randomIndex(context.state, candidates.length)];
  const scale = component.golden ? 2 : 1;
  const attackDelta = effect.attack * scale;
  const healthDelta = effect.health * scale;
  target.attack += attackDelta;
  target.health += healthDelta;
  reconcileConditionalMinion(target);
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const sourceLabel = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  pushBattleEvent(context.events, {
    type: "handBuff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: owner.isHuman ? target.instanceId : undefined,
    attackDelta,
    healthDelta,
    cardName: owner.isHuman ? target.name : undefined,
    cardKind: "minion",
    message: owner.isHuman
      ? `${sourceLabel}使你手牌中的「${target.name}」获得+${attackDelta}/+${healthDelta}。`
      : `${sourceLabel}使${owner.name}手牌中的一张随从牌获得+${attackDelta}/+${healthDelta}。`,
  });
}

function dealCombatDamage(
  context: CombatContext,
  sourceOwnerId: PlayerId,
  source: MinionInstance,
  targetOwnerId: PlayerId,
  target: MinionInstance,
  amount: number,
  poisonous: boolean,
  deferDamageObservers = false,
): CombatDamageObservation | null {
  if (amount <= 0 || target.health <= 0) {
    return null;
  }
  const conditionalGain = applyCombatEnchantingGain(
    context,
    targetOwnerId,
    target,
    {},
  );
  if (conditionalGain.gainedKeywords.includes("divineShield")) {
    const threshold =
      getMinionDefinition(target.definitionId).conditionalKeyword
        ?.attackAtLeast ?? target.attack;
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: targetOwnerId,
      actorInstanceId: target.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      retained: conditionalGain.retentionMultiplier > 0,
      ...(conditionalGain.retentionMultiplier > 0
        ? {
            retentionMultiplier:
              conditionalGain.retentionMultiplier,
          }
        : {}),
      message: `${target.name}达到${threshold}点攻击力，获得圣盾。`,
    });
  }
  if (target.divineShield) {
    target.divineShield = false;
    pushBattleEvent(context.events, {
      type: "shieldBroken",
      actorPlayerId: sourceOwnerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      message: `${target.name}的圣盾被击破。`,
    });
    return null;
  }
  target.health -= amount;
  if (poisonous || source.venomous) {
    target.health = Math.min(0, target.health);
    context.poisonLethalMinionIds[targetOwnerId].add(target.instanceId);
  }
  if (source.venomous) {
    source.venomous = false;
  }
  const targetSnapshot = cloneMinion(target);
  targetSnapshot.health = Math.max(0, targetSnapshot.health);
  pushBattleEvent(context.events, {
    type: "damage",
    actorPlayerId: sourceOwnerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: targetOwnerId,
    targetInstanceId: target.instanceId,
    amount,
    actorMinion: cloneMinion(source),
    minion: targetSnapshot,
    message: `${target.name}受到${amount}点伤害，剩余${targetSnapshot.health}点生命。`,
  });
  const observation = captureCombatDamageObservation(
    context,
    sourceOwnerId,
    source,
    targetOwnerId,
    target,
  );
  if (!deferDamageObservers) {
    triggerCombatDamageObservation(context, observation);
  }
  return observation;
}

function triggerDeferredDamageObservers(
  context: CombatContext,
  observations: readonly CombatDamageObservation[],
): void {
  for (const observation of observations) {
    triggerCombatDamageObservation(context, observation);
  }
}

function chooseAttackTarget(
  context: CombatContext,
  attacker: MinionInstance,
  enemyId: PlayerId,
): MinionInstance | null {
  const enemyBoard = context.boards[enemyId].filter(
    (minion) => minion.health > 0 && !minion.stealth,
  );
  if (enemyBoard.length === 0) {
    return null;
  }
  if (attacker.alwaysAttacksLowestAttack) {
    const lowestAttack = Math.min(
      ...enemyBoard.map((minion) => minion.attack),
    );
    const candidates = enemyBoard.filter(
      (minion) => minion.attack === lowestAttack,
    );
    return candidates[randomIndex(context.state, candidates.length)];
  }
  const taunts = enemyBoard.filter((minion) => minion.taunt);
  const candidates = taunts.length > 0 ? taunts : enemyBoard;
  return candidates[randomIndex(context.state, candidates.length)];
}

function resolveCombatGetRandomMinion(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GetRandomMinionEffect,
  triggerLabel?: string,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const componentName = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  const sourceLabel = triggerLabel
    ? `${componentName}的${triggerLabel}`
    : componentName;
  const rewardDescription = effect.filter.magnetic
    ? "磁力机械"
    : effect.filter.battlecry
      ? "战吼随从牌"
      : "随从牌";
  const gainCount =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount"
      ? 2
      : 1);

  for (let count = 0; count < gainCount; count += 1) {
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardKind: "minion",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得${rewardDescription}。`
          : `${sourceLabel}未能使${owner.name}获得${rewardDescription}。`,
      });
      continue;
    }
    const gained = drawMatchingFromPool(
      context.state,
      owner.tavernTier,
      (definition) =>
        matchesGetRandomMinionEffect(definition, effect),
    );
    if (!gained) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardKind: "minion",
        cardGainResult: "noCandidate",
        message: owner.isHuman
          ? `当前共享池中没有可由${sourceLabel}获取的${rewardDescription}。`
          : `${sourceLabel}没有找到可获取的${rewardDescription}。`,
      });
      continue;
    }
    applyOwnedUndeadArmyBonus(owner, gained);
    applyOwnedBeetleBonus(owner, gained);
    reconcileWhereverMinion(
      gained,
      owner.astralAutomatonsSummoned ?? 0,
      owner.eternalKnightsDied ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    owner.hand.push(gained);
    resolveTriples(context.state, owner, context);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      minion: owner.isHuman ? gainedSnapshot : undefined,
      cardKind: "minion",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${sourceLabel}使你获得了「${gained.name}」。`
        : `${sourceLabel}使${owner.name}获得了一张${rewardDescription}。`,
    });
  }
}

function resolveCombatGainRandomGeneratedMinion(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GainRandomGeneratedMinionEffect,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const sourceLabel = rallySourceLabel(component);
  const gainCount =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);

  for (let count = 0; count < gainCount; count += 1) {
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardKind: "minion",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得随从牌。`
          : `${sourceLabel}未能使${owner.name}获得一张随从牌。`,
      });
      continue;
    }
    if (effect.definitionIds.length === 0) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardKind: "minion",
        cardGainResult: "noCandidate",
        message: `${sourceLabel}没有找到可获取的随从牌。`,
      });
      continue;
    }
    const definitionId =
      effect.definitionIds[
        randomIndex(context.state, effect.definitionIds.length)
      ];
    const gained = createMinionInstance(
      context.state,
      definitionId,
      0,
    );
    applyOwnedUndeadArmyBonus(owner, gained);
    applyOwnedBeetleBonus(owner, gained);
    reconcileWhereverMinion(
      gained,
      owner.astralAutomatonsSummoned ?? 0,
      owner.eternalKnightsDied ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    owner.hand.push(gained);
    resolveTriples(context.state, owner, context);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      minion: owner.isHuman ? gainedSnapshot : undefined,
      cardKind: "minion",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${sourceLabel}使你获得了「${gained.name}」。`
        : `${sourceLabel}使${owner.name}获得了一张随从牌。`,
    });
  }
}

function resolveCombatGainBloodGems(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GainBloodGemsEffect,
  triggerLabel?: string,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const requested =
    effect.count * (component.golden ? 2 : 1);
  const sourceName = rallySourceLabel(component);
  const sourceLabel = triggerLabel
    ? `${sourceName}的${triggerLabel}`
    : sourceName;
  for (let count = 0; count < requested; count += 1) {
    const added = addBloodGems(
      context.state,
      owner,
      1,
      effect.bonusKeyword,
    );
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      amount: added,
      cardName: owner.isHuman ? "鲜血宝石" : undefined,
      cardKind: "bloodGem",
      cardGainResult: added > 0 ? "added" : "handFull",
      message:
        added > 0
          ? owner.isHuman
            ? `${sourceLabel}使你获得了一张鲜血宝石。`
            : `${sourceLabel}使${owner.name}获得了一张牌。`
          : owner.isHuman
            ? `手牌已满，${sourceLabel}未能使你获得鲜血宝石。`
            : `${sourceLabel}未能使${owner.name}获得牌。`,
    });
  }
}

function resolveCombatGainTavernSpell(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GainTavernSpellEffect,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const sourceLabel = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  const spellDefinition = getTavernSpellDefinition(
    effect.definitionId,
  );
  const gainCount =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);

  for (let count = 0; count < gainCount; count += 1) {
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardName: owner.isHuman ? spellDefinition.name : undefined,
        cardKind: "tavernSpell",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得「${spellDefinition.name}」。`
          : `${sourceLabel}未能使${owner.name}获得一张酒馆法术。`,
      });
      continue;
    }
    const gained = createTavernSpell(context.state, spellDefinition);
    owner.hand.push(gained);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      cardName: owner.isHuman ? gained.name : undefined,
      cardKind: "tavernSpell",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${sourceLabel}使你获得了「${gained.name}」。`
        : `${sourceLabel}使${owner.name}获得了一张酒馆法术。`,
    });
  }
}

function resolveCombatGainRandomTavernSpell(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GainRandomTavernSpellEffect,
  triggerLabel?: string,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const componentName = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  const sourceLabel = triggerLabel
    ? `${componentName}的${triggerLabel}`
    : componentName;
  const gainCount =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);

  for (let count = 0; count < gainCount; count += 1) {
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardKind: "tavernSpell",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得随机酒馆法术。`
          : `${sourceLabel}未能使${owner.name}获得一张酒馆法术。`,
      });
      continue;
    }
    const spellDefinition = randomGeneratedTavernSpellDefinition(
      context.state,
      effect,
    );
    if (!spellDefinition) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardKind: "tavernSpell",
        cardGainResult: "noCandidate",
        message: owner.isHuman
          ? `${sourceLabel}没有找到符合条件的酒馆法术。`
          : `${sourceLabel}没有找到可获取的酒馆法术。`,
      });
      continue;
    }
    const gained = createTavernSpell(context.state, spellDefinition);
    owner.hand.push(gained);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      cardName: owner.isHuman ? gained.name : undefined,
      cardKind: "tavernSpell",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${sourceLabel}使你获得了「${gained.name}」。`
        : `${sourceLabel}使${owner.name}获得了一张酒馆法术。`,
    });
  }
}

function selectHighestAttackHandMinions(
  state: GameState,
  handMinions: readonly BoardMinionInstance[],
  count: number,
): BoardMinionInstance[] {
  const candidates = [...handMinions];
  const selected: BoardMinionInstance[] = [];
  while (selected.length < count && candidates.length > 0) {
    const highestAttack = Math.max(
      ...candidates.map((candidate) => candidate.attack),
    );
    const highestCandidates = candidates.filter(
      (candidate) => candidate.attack === highestAttack,
    );
    const choice =
      highestCandidates.length === 1
        ? highestCandidates[0]
        : highestCandidates[randomIndex(state, highestCandidates.length)];
    selected.push(choice);
    candidates.splice(candidates.indexOf(choice), 1);
  }
  return selected;
}

function cloneOwnedMinionForCombat(
  state: GameState,
  minion: BoardMinionInstance,
): BoardMinionInstance {
  const combatCopy = cloneMinion(minion);
  combatCopy.instanceId = `minion-${state.nextInstanceId}`;
  combatCopy.poolCopies = 0;
  delete combatCopy.poolCopiesOnPurchase;
  combatCopy.grantsTripleReward = false;
  combatCopy.attachments = combatCopy.attachments.map(
    clearAttachmentPoolCopies,
  );
  state.nextInstanceId += 1;
  return combatCopy;
}

function resolveRallySummonFromHand(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallySummonFromHandEffect,
): void {
  const owner = findPlayer(context.state, ownerId);
  const board = context.boards[ownerId];
  if (!owner || board.length >= MAX_BOARD_SIZE) {
    return;
  }
  const count =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);
  const selections = selectHighestAttackHandMinions(
    context.state,
    combatHandMinions(context, ownerId),
    Math.min(count, MAX_BOARD_SIZE - board.length),
  );
  const definition = getMinionDefinition(component.definitionId);
  for (const [selectionIndex, selected] of selections.entries()) {
    const attackerIndex = board.findIndex(
      (minion) => minion.instanceId === attacker.instanceId,
    );
    if (attackerIndex < 0 || board.length >= MAX_BOARD_SIZE) {
      break;
    }
    const summoned = cloneOwnedMinionForCombat(
      context.state,
      selected,
    );
    insertCombatMinion(
      context,
      ownerId,
      summoned,
      attackerIndex + 1 + selectionIndex,
      attacker,
      `${definition.name}的进击从手牌召唤了${summoned.name}（仅限本场战斗）。`,
      "rallyFromHand",
    );
  }
}

function rallySourceLabel(component: MinionEffectSource): string {
  const definition = getMinionDefinition(component.definitionId);
  return component.golden
    ? `金色·${definition.name}`
    : definition.name;
}

function resolveCombatImproveUndeadArmy(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: ImproveUndeadArmyEffect,
  triggerLabel: string,
): void {
  const scale = component.golden ? 2 : 1;
  const attackDelta = effect.attack * scale;
  const healthDelta = effect.health * scale;
  const current = context.tribeBuffs[ownerId].undead ?? {
    attack: 0,
    health: 0,
  };
  context.tribeBuffs[ownerId].undead = {
    attack: current.attack + attackDelta,
    health: current.health + healthDelta,
  };

  for (const target of context.boards[ownerId]) {
    if (!minionHasTribe(target, "undead")) {
      continue;
    }
    target.attack += attackDelta;
    target.health += healthDelta;
    if (healthDelta !== 0) {
      adjustCombatMaximumHealth(
        context,
        ownerId,
        target,
        healthDelta,
      );
    }
    reconcileConditionalMinion(target);
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta,
      healthDelta,
      minion: cloneMinion(target),
      message: `${rallySourceLabel(component)}的${triggerLabel}使${target.name}获得+${attackDelta}/+${healthDelta}。`,
    });
  }

  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  owner.undeadArmyAttackBonus += attackDelta;
  owner.undeadArmyHealthBonus += healthDelta;
  for (const target of [
    ...owner.board,
    ...owner.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
  ]) {
    if (!minionHasTribe(target, "undead")) {
      continue;
    }
    target.attack += attackDelta;
    target.health += healthDelta;
    reconcileConditionalMinion(target);
  }
}

function resolveCombatImproveBloodGems(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: ImproveBloodGemsEffect,
  triggerLabel: string,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const scale = component.golden ? 2 : 1;
  const attackDelta = effect.attack * scale;
  const healthDelta = effect.health * scale;
  owner.bloodGemAttack += attackDelta;
  owner.bloodGemHealth += healthDelta;
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: source.instanceId,
    attackDelta: 0,
    healthDelta: 0,
    permanentEffectImprovement: true,
    minion: cloneMinion(source),
    message: `${rallySourceLabel(component)}的${triggerLabel}使鲜血宝石永久获得+${attackDelta}/+${healthDelta}。`,
  });
}

function resolveRallyGainTargetAttack(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  attackTarget: MinionInstance,
  component: MinionEffectSource,
): void {
  const attackDelta =
    attackTarget.attack * (component.golden ? 2 : 1);
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    attacker,
    { attack: attackDelta },
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: attacker.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: attacker.instanceId,
    attackDelta,
    healthDelta: 0,
    minion: cloneMinion(attacker),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message: `${rallySourceLabel(component)}的进击获得了${attackTarget.name}的${attackDelta}点攻击力。`,
  });
}

function resolveRallyGrantVenomous(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallyGrantVenomousEffect,
): void {
  const count =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);
  const candidates = context.boards[ownerId].filter(
    (minion) =>
      minion.instanceId !== attacker.instanceId &&
      minion.health > 0 &&
      minionHasTribe(minion, effect.tribe),
  );
  for (const target of randomBoardSubset(
    context.state,
    candidates,
    count,
  )) {
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      target,
      { keywords: ["venomous"] },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: attacker.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta: 0,
      healthDelta: 0,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `${rallySourceLabel(component)}的进击使${target.name}获得烈毒。`,
    });
  }
}

function resolveRallyGrantSourceAttack(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallyGrantSourceAttackEffect,
): void {
  const repetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const candidates = context.boards[ownerId].filter(
      (minion) =>
        minion.instanceId !== attacker.instanceId &&
        minion.health > 0,
    );
    for (const target of randomBoardSubset(
      context.state,
      candidates,
      effect.count,
    )) {
      const attackDelta = attacker.attack;
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { attack: attackDelta },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta: 0,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${rallySourceLabel(component)}的进击使${target.name}获得+${attackDelta}攻击力。`,
      });
    }
  }
}

function resolveRallyGrantSourceMaxHealth(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallyGrantSourceMaxHealthEffect,
): void {
  const repetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const candidates = context.boards[ownerId].filter(
      (minion) =>
        minion.instanceId !== attacker.instanceId &&
        minion.definitionId !== component.definitionId &&
        minion.health > 0 &&
        minionHasTribe(minion, effect.tribe),
    );
    for (const target of randomBoardSubset(
      context.state,
      candidates,
      effect.count,
    )) {
      const healthDelta = combatMaximumHealth(
        context,
        ownerId,
        attacker,
      );
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { health: healthDelta },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${rallySourceLabel(component)}的进击使${target.name}获得+${healthDelta}生命值${
          repetitions > 1 ? `（第${repetition + 1}次）` : ""
        }。`,
      });
    }
  }
}

function minionHasTriggerableDeathrattle(
  minion: MinionInstance,
): boolean {
  return (
    minion.temporaryCrabDeathrattles > 0 ||
    (minion.temporaryGoldenCrabDeathrattles ?? 0) > 0 ||
    minionEffectSources(minion).some(
      (component) =>
        (getMinionDefinition(component.definitionId).deathrattle
          ?.length ?? 0) > 0,
    )
  );
}

function resolveRallyTriggerLeftmostDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallyTriggerLeftmostDeathrattleEffect,
): void {
  const board = context.boards[ownerId];
  const source = board.find(
    (minion) =>
      minion.instanceId !== attacker.instanceId &&
      minion.health > 0 &&
      minionHasTriggerableDeathrattle(minion),
  );
  if (!source) {
    return;
  }
  const originalSourceIndex = board.findIndex(
    (minion) => minion.instanceId === source.instanceId,
  );
  const repetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: attacker.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: source.instanceId,
      minion: cloneMinion(source),
      message: `${rallySourceLabel(component)}的进击触发了${source.name}的亡语${
        repetitions > 1 ? `（第${repetition + 1}次）` : ""
      }。`,
    });
    resolveOneDeathrattle(context, {
      minion: source,
      index: (() => {
        const liveSourceIndex = board.findIndex(
          (minion) => minion.instanceId === source.instanceId,
        );
        return liveSourceIndex >= 0
          ? liveSourceIndex + 1
          : Math.min(originalSourceIndex, board.length);
      })(),
      ownerId,
    });
    resolveCombatDeaths(context);
  }
}

function pushCombatSpellBuff(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  target: MinionInstance,
  attackDelta: number,
  healthDelta: number,
  message: string,
): void {
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    { attack: attackDelta, health: healthDelta },
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta,
    healthDelta,
    minion: cloneMinion(target),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message,
  });
}

function combatTavernSpellCastMultiplier(
  context: CombatContext,
  ownerId: PlayerId,
): number {
  let extraCasts = 0;
  for (const source of context.boards[ownerId]) {
    if (source.health <= 0) {
      continue;
    }
    for (const component of minionEffectSources(source)) {
      const amount =
        getMinionDefinition(component.definitionId)
          .combatTavernSpellExtraCasts ?? 0;
      extraCasts += amount * (component.golden ? 2 : 1);
    }
  }
  return 1 + extraCasts;
}

function resolveCombatCastTavernSpell(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: CastTavernSpellEffect,
  triggerLabel: string,
): void {
  const definition = getTavernSpellDefinition(effect.definitionId);
  const printedRepetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  const repetitions =
    printedRepetitions *
    combatTavernSpellCastMultiplier(context, ownerId);
  const owner = findPlayer(context.state, ownerId);

  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const attackBonus = owner?.tavernSpellAttackBonus ?? 0;
    const healthBonus = owner?.tavernSpellHealthBonus ?? 0;
    pushBattleEvent(context.events, {
      type: "tavernSpellCast",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      cardName: definition.name,
      cardKind: "tavernSpell",
      message: `${rallySourceLabel(component)}的${triggerLabel}施放了「${definition.name}」${
        repetitions > 1 ? `（第${repetition + 1}次）` : ""
      }。`,
    });

    const pulses = tavernSpellWarbandBuffPulses(
      definition.effect,
    );
    if (!pulses) {
      throw new Error(
        `Combat-triggered Tavern Spell ${definition.id} is not supported`,
      );
    }
    for (const pulse of pulses) {
      const attackDelta = pulse.attack + attackBonus;
      const healthDelta = pulse.health + healthBonus;
      const targets = context.boards[ownerId].filter(
        (target) =>
          target.health > 0 &&
          (!pulse.tribe || minionHasTribe(target, pulse.tribe)),
      );
      for (const target of targets) {
        pushCombatSpellBuff(
          context,
          ownerId,
          source,
          target,
          attackDelta,
          healthDelta,
          pulse.tribe
            ? `${definition.name}额外使${pulse.tribe === "naga" ? "纳迦" : ""}${target.name}获得+${attackDelta}/+${healthDelta}。`
            : `${definition.name}使${target.name}获得+${attackDelta}/+${healthDelta}。`,
        );
      }
    }
    triggerCombatAfterTavernSpellCast(context, ownerId);
  }
}

function resolveCombatImproveStartOfCombatBuff(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: ImproveStartOfCombatBuffEffect,
): void {
  const scale = component.golden ? 2 : 1;
  improveStartOfCombatBuff(source, effect, scale);

  let persistentImproved = false;
  if (
    component.sourceInstanceId === source.instanceId &&
    context.originalCombatMinionIds[ownerId].has(source.instanceId)
  ) {
    const owner = persistentCombatOwner(context, ownerId);
    const persistent = owner
      ? findCombatWritebackMinion(
          context,
          owner,
          ownerId,
          source.instanceId,
        )
      : undefined;
    if (persistent) {
      improveStartOfCombatBuff(persistent, effect, scale);
      refreshDynamicMinionDescription(persistent, owner);
      persistentImproved = true;
    }
  }

  const growingEffect = getMinionDefinition(
    component.definitionId,
  ).startOfCombat?.find(
    (candidate) => candidate.kind === "growingTribeBuff",
  );
  const amount =
    growingEffect?.kind === "growingTribeBuff"
      ? growingStartOfCombatBuffAmount(source, growingEffect)
      : undefined;
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: source.instanceId,
    attackDelta: 0,
    healthDelta: 0,
    ...(persistentImproved
      ? { permanentEffectImprovement: true }
      : {}),
    minion: cloneMinion(source),
    message: persistentImproved
      ? amount
        ? `${source.name}响应酒馆法术，将战斗开始效果永久提升至+${amount.attack}/+${amount.health}。`
        : `${source.name}响应酒馆法术，永久提升了战斗开始效果。`
      : amount
        ? `${source.name}响应酒馆法术，将本场战斗中的战斗开始效果提升至+${amount.attack}/+${amount.health}。`
        : `${source.name}响应酒馆法术，提升了本场战斗中的战斗开始效果。`,
  });
}

function triggerCombatAfterTavernSpellCast(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const board = context.boards[ownerId];
  for (const source of [...board]) {
    for (const component of minionEffectSources(source)) {
      const effects =
        getMinionDefinition(component.definitionId)
          .afterTavernSpellCast ?? [];
      const scale = component.golden ? 2 : 1;
      for (const effect of effects) {
        if (effect.kind === "improveStartOfCombatBuff") {
          resolveCombatImproveStartOfCombatBuff(
            context,
            ownerId,
            source,
            component,
            effect,
          );
          continue;
        }
        if (effect.kind === "improveUndeadArmy") {
          resolveCombatImproveUndeadArmy(
            context,
            ownerId,
            source,
            component,
            effect,
            "酒馆法术响应",
          );
          continue;
        }
        if (effect.kind === "buff") {
          for (const target of combatBuffTargets(
            context.state,
            board,
            source,
            effect,
          )) {
            pushCombatSpellBuff(
              context,
              ownerId,
              source,
              target,
              effect.attack * scale,
              effect.health * scale,
              `${source.name}响应酒馆法术，使${target.name}获得+${effect.attack * scale}/+${effect.health * scale}。`,
            );
          }
          continue;
        }
        if (effect.kind === "onePerTribe") {
          for (const target of selectDistinctMinionsByTribe(
            context.state,
            board,
          )) {
            pushCombatSpellBuff(
              context,
              ownerId,
              source,
              target,
              effect.attack * scale,
              effect.health * scale,
              `${source.name}响应酒馆法术，使${target.name}获得+${effect.attack * scale}/+${effect.health * scale}。`,
            );
          }
          continue;
        }
        if (effect.kind === "buffKeyword") {
          for (const target of board.filter(
            (candidate) =>
              effect.keyword === "divineShield" &&
              candidate.divineShield,
          )) {
            pushCombatSpellBuff(
              context,
              ownerId,
              source,
              target,
              effect.attack * scale,
              effect.health * scale,
              `${source.name}响应酒馆法术，使${target.name}获得+${effect.attack * scale}/+${effect.health * scale}。`,
            );
          }
        }
      }
    }
  }
}

function resolveRallyCastChefsChoice(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallyCastChefsChoiceEffect,
): void {
  const board = context.boards[ownerId];
  const attackerIndex = board.findIndex(
    (minion) => minion.instanceId === attacker.instanceId,
  );
  const target =
    effect.target === "rightFriendly" && attackerIndex >= 0
      ? board[attackerIndex + 1]
      : undefined;
  const owner = persistentCombatOwner(context, ownerId);
  if (!target || target.health <= 0 || !owner) {
    return;
  }
  const definition = getTavernSpellDefinition(
    "tavern-spell-chefs-choice",
  );
  const printedRepetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  const repetitions =
    printedRepetitions *
    combatTavernSpellCastMultiplier(context, ownerId);
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    pushBattleEvent(context.events, {
      type: "tavernSpellCast",
      actorPlayerId: ownerId,
      actorInstanceId: attacker.instanceId,
      cardName: definition.name,
      cardKind: "tavernSpell",
      message: `${rallySourceLabel(component)}的进击施放了「${definition.name}」${
        repetitions > 1 ? `（第${repetition + 1}次）` : ""
      }。`,
    });
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${rallySourceLabel(component)}的主厨甄选未能获取随从。`
          : `${rallySourceLabel(component)}的主厨甄选未能使${owner.name}获取随从。`,
      });
      triggerCombatAfterTavernSpellCast(context, ownerId);
      continue;
    }
    const gained = drawMatchingFromPool(
      context.state,
      owner.tavernTier,
      (candidate) => chefsChoiceMatches(candidate, target),
    );
    if (!gained) {
      addConsolationCoin(context.state, owner);
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        amount: 1,
        cardName: owner.isHuman ? "酒馆币" : undefined,
        cardGainResult: "noCandidate",
        message: owner.isHuman
          ? `${rallySourceLabel(component)}的主厨甄选没有找到候选，改为获得一张酒馆币。`
          : `${rallySourceLabel(component)}的主厨甄选没有找到候选。`,
      });
      triggerCombatAfterTavernSpellCast(context, ownerId);
      continue;
    }
    applyOwnedUndeadArmyBonus(owner, gained);
    applyOwnedBeetleBonus(owner, gained);
    reconcileWhereverMinion(
      gained,
      owner.astralAutomatonsSummoned ?? 0,
      owner.eternalKnightsDied ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    owner.hand.push(gained);
    resolveTriples(context.state, owner, context);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: attacker.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      minion: owner.isHuman ? gainedSnapshot : undefined,
      cardGainResult: "added",
      message: owner.isHuman
        ? `${rallySourceLabel(component)}的主厨甄选使你获得了「${gained.name}」。`
        : `${rallySourceLabel(component)}的主厨甄选使${owner.name}获得了一张随从牌。`,
    });
    triggerCombatAfterTavernSpellCast(context, ownerId);
  }
}

function removedKeywordLabel(
  keywords: readonly RallyRemovedKeyword[],
): string {
  return keywords
    .map((keyword) =>
      keyword === "reborn"
        ? "复生"
        : keyword === "taunt"
          ? "嘲讽"
          : "潜行",
    )
    .join("和");
}

function resolveRallyKeywordRemoval(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  target: MinionInstance,
  component: MinionEffectSource,
  effect: RallyRemoveTargetKeywordsEffect,
): void {
  const removedKeywords: RallyRemovedKeyword[] = [];
  for (const keyword of effect.keywords) {
    if (keyword === "reborn" && target.reborn) {
      target.reborn = false;
      removedKeywords.push(keyword);
    } else if (keyword === "taunt" && target.taunt) {
      target.taunt = false;
      removedKeywords.push(keyword);
    } else if (keyword === "stealth" && target.stealth) {
      target.stealth = false;
      removedKeywords.push(keyword);
    }
  }
  if (removedKeywords.length === 0) {
    return;
  }
  const definition = getMinionDefinition(component.definitionId);
  pushBattleEvent(context.events, {
    type: "keywordRemoved",
    actorPlayerId: ownerId,
    actorInstanceId: attacker.instanceId,
    targetPlayerId: opponentId(context, ownerId),
    targetInstanceId: target.instanceId,
    removedKeywords,
    minion: cloneMinion(target),
    message: `${definition.name}的进击移除了${target.name}的${removedKeywordLabel(removedKeywords)}。`,
  });
}

function triggerAfterFriendlyAttacks(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
): void {
  for (const watcher of [...context.boards[ownerId]]) {
    if (watcher.health <= 0) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const effects =
        getMinionDefinition(component.definitionId)
          .afterFriendlyAttacks ?? [];
      for (const effect of effects) {
        if (effect.kind === "castTavernSpell") {
          resolveCombatCastTavernSpell(
            context,
            ownerId,
            watcher,
            component,
            effect,
            "友方随从攻击触发效果",
          );
          continue;
        }
        if (
          (effect.otherOnly &&
            watcher.instanceId === attacker.instanceId) ||
          (effect.tribe &&
            !minionHasTribe(attacker, effect.tribe)) ||
          attacker.health <= 0
        ) {
          continue;
        }
        const scale =
          component.golden &&
          effect.goldenMode === "doubleStats"
            ? 2
            : 1;
        const attackDelta = effect.attack * scale;
        const healthDelta = effect.health * scale;
        pushBattleEvent(context.events, {
          type: "trigger",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: attacker.instanceId,
          minion: cloneMinion(attacker),
          message: `${rallySourceLabel(component)}响应${attacker.name}的攻击并触发了增益。`,
        });
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          attacker,
          { attack: attackDelta, health: healthDelta },
        );
        pushBattleEvent(context.events, {
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: attacker.instanceId,
          attackDelta,
          healthDelta,
          minion: cloneMinion(attacker),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}使正在攻击的${attacker.name}获得+${attackDelta}/+${healthDelta}。`,
        });
      }
    }
  }
}

function triggerRally(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  attackTarget: MinionInstance,
): void {
  for (const component of minionEffectSources(attacker)) {
    const definition = getMinionDefinition(component.definitionId);
    const effects = definition.rally ?? [];
    for (const effect of effects) {
      if (effect.kind === "getRandomMinion") {
        resolveCombatGetRandomMinion(
          context,
          ownerId,
          attacker,
          component,
          effect,
          "进击",
        );
        continue;
      }

      if (effect.kind === "gainRandomTavernSpell") {
        resolveCombatGainRandomTavernSpell(
          context,
          ownerId,
          attacker,
          component,
          effect,
          "进击",
        );
        continue;
      }

      if (effect.kind === "castTavernSpell") {
        resolveCombatCastTavernSpell(
          context,
          ownerId,
          attacker,
          component,
          effect,
          "进击",
        );
        continue;
      }

      if (effect.kind === "summonFromHand") {
        resolveRallySummonFromHand(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "removeTargetKeywords") {
        resolveRallyKeywordRemoval(
          context,
          ownerId,
          attacker,
          attackTarget,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "gainTargetAttack") {
        resolveRallyGainTargetAttack(
          context,
          ownerId,
          attacker,
          attackTarget,
          component,
        );
        continue;
      }

      if (effect.kind === "castChefsChoice") {
        resolveRallyCastChefsChoice(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "grantVenomous") {
        resolveRallyGrantVenomous(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "grantSourceAttack") {
        resolveRallyGrantSourceAttack(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "grantSourceMaxHealth") {
        resolveRallyGrantSourceMaxHealth(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "triggerLeftmostDeathrattle") {
        resolveRallyTriggerLeftmostDeathrattle(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "improveUndeadArmy") {
        resolveCombatImproveUndeadArmy(
          context,
          ownerId,
          attacker,
          component,
          effect,
          "进击",
        );
        continue;
      }

      if (effect.kind === "improveBloodGems") {
        resolveCombatImproveBloodGems(
          context,
          ownerId,
          attacker,
          component,
          effect,
          "进击",
        );
        continue;
      }

      const board = context.boards[ownerId];
      const attackerIndex = board.findIndex(
        (minion) => minion.instanceId === attacker.instanceId,
      );
      const target =
        attackerIndex >= 0 ? board[attackerIndex + 1] : undefined;
      if (
        effect.target !== "rightFriendly" ||
        !target ||
        target.health <= 0
      ) {
        continue;
      }

      const scale =
        component.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
      const attackDelta = effect.attack * scale;
      const healthDelta = effect.health * scale;
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { attack: attackDelta, health: healthDelta },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${definition.name}的进击使右侧的${target.name}获得+${attackDelta}/+${healthDelta}。`,
      });
    }
  }
}

interface AttackStrikeOptions {
  immediate?: boolean;
  windfuryStrike?: boolean;
}

function triggerAfterAttackKills(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  targetOwnerId: PlayerId,
  target: MinionInstance,
  targetIndex: number,
  targetHealthBefore: number,
  attackDamage: number,
): void {
  if (
    targetHealthBefore <= 0 ||
    target.health > 0 ||
    attackDamage <= targetHealthBefore
  ) {
    return;
  }
  const excessDamage = attackDamage - targetHealthBefore;
  const enemyBoard = context.boards[targetOwnerId];
  const adjacent = [
    enemyBoard[targetIndex - 1],
    enemyBoard[targetIndex + 1],
  ].filter(
    (minion): minion is MinionInstance =>
      minion !== undefined &&
      minion.instanceId !== target.instanceId &&
      minion.health > 0,
  );
  if (adjacent.length === 0) {
    return;
  }

  for (const component of minionEffectSources(attacker)) {
    const effect = getMinionDefinition(
      component.definitionId,
    ).afterAttackKills;
    if (effect?.kind !== "excessDamageToAdjacent") {
      continue;
    }
    const targets =
      component.golden && effect.goldenMode === "bothAdjacent"
        ? adjacent
        : randomBoardSubset(context.state, adjacent, 1);
    for (const adjacentTarget of targets) {
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: targetOwnerId,
        targetInstanceId: adjacentTarget.instanceId,
        minion: cloneMinion(adjacentTarget),
        message: `${rallySourceLabel(component)}将${excessDamage}点过量伤害溅射给${adjacentTarget.name}。`,
      });
    }
    const damageObservations: CombatDamageObservation[] = [];
    for (const adjacentTarget of targets) {
      const observation = dealCombatDamage(
        context,
        ownerId,
        attacker,
        targetOwnerId,
        adjacentTarget,
        excessDamage,
        false,
        true,
      );
      if (observation) {
        damageObservations.push(observation);
      }
    }
    triggerDeferredDamageObservers(context, damageObservations);
  }
}

function performAttackStrike(
  context: CombatContext,
  ownerId: PlayerId,
  attackerInstanceId: string,
  options: AttackStrikeOptions = {},
): boolean {
  const attacker = context.boards[ownerId].find(
    (minion) => minion.instanceId === attackerInstanceId,
  );
  if (!attacker || attacker.health <= 0 || attacker.attack <= 0) {
    return false;
  }

  const enemyId = opponentId(context, ownerId);
  const enemyBoard = context.boards[enemyId];
  const target = chooseAttackTarget(context, attacker, enemyId);
  if (!target) {
    return false;
  }
  const targetIndex = enemyBoard.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  const cleaveTargets = attacker.cleave
    ? [enemyBoard[targetIndex - 1], enemyBoard[targetIndex + 1]].filter(
        (minion): minion is BoardMinionInstance =>
          minion !== undefined,
      )
    : [];

  pushBattleEvent(context.events, {
    type: "attack",
    actorPlayerId: ownerId,
    actorInstanceId: attacker.instanceId,
    targetPlayerId: enemyId,
    targetInstanceId: target.instanceId,
    amount: attacker.attack,
    message: `${attacker.name}${options.immediate ? "立即攻击" : "攻击"}${target.name}${options.windfuryStrike ? "（风怒）" : ""}。`,
  });
  if (attacker.stealth) {
    attacker.stealth = false;
    pushBattleEvent(context.events, {
      type: "keywordRemoved",
      actorPlayerId: ownerId,
      actorInstanceId: attacker.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: attacker.instanceId,
      removedKeywords: ["stealth"],
      minion: cloneMinion(attacker),
      message: `${attacker.name}发动攻击后失去了潜行。`,
    });
  }
  triggerAfterFriendlyAttacks(context, ownerId, attacker);
  triggerRally(context, ownerId, attacker, target);
  if (context.deathResolutionDepth === 0) {
    summonPendingStartOfCombatHandMinions(context, ownerId);
  }

  if (
    attacker.health <= 0 ||
    target.health <= 0 ||
    !context.boards[ownerId].some(
      (minion) => minion.instanceId === attacker.instanceId,
    ) ||
    !enemyBoard.some(
      (minion) => minion.instanceId === target.instanceId,
    )
  ) {
    resolveCombatDeaths(context);
    return true;
  }

  const targetHealthBefore = target.health;
  const attackDamage = attacker.attack;
  const retaliationDamage = target.attack;
  const attackerPoisonous = attacker.poisonous;
  const targetPoisonous = target.poisonous;
  const damageObservations: CombatDamageObservation[] = [];
  const targetObservation = dealCombatDamage(
    context,
    ownerId,
    attacker,
    enemyId,
    target,
    attackDamage,
    attackerPoisonous,
    true,
  );
  if (targetObservation) {
    damageObservations.push(targetObservation);
  }
  const attackerObservation = dealCombatDamage(
    context,
    enemyId,
    target,
    ownerId,
    attacker,
    retaliationDamage,
    targetPoisonous,
    true,
  );
  if (attackerObservation) {
    damageObservations.push(attackerObservation);
  }
  for (const adjacent of cleaveTargets) {
    const observation = dealCombatDamage(
      context,
      ownerId,
      attacker,
      enemyId,
      adjacent,
      attackDamage,
      attackerPoisonous,
      true,
    );
    if (observation) {
      damageObservations.push(observation);
    }
  }
  triggerDeferredDamageObservers(context, damageObservations);
  triggerAfterAttackKills(
    context,
    ownerId,
    attacker,
    enemyId,
    target,
    targetIndex,
    targetHealthBefore,
    attackDamage,
  );
  resolveCombatDeaths(context);
  return true;
}

function performImmediateAttack(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
): void {
  performAttackStrike(context, ownerId, attacker.instanceId, {
    immediate: true,
  });
}

function resolveCombatApplyBloodGemsToTribe(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: ApplyBloodGemsToTribeEffect,
): void {
  const applicationCount =
    effect.count * (component.golden ? 2 : 1);
  const targets = context.boards[ownerId].filter(
    (minion) =>
      minion.health > 0 &&
      minionHasTribe(minion, effect.tribe),
  );
  for (const target of targets) {
    for (
      let application = 0;
      application < applicationCount;
      application += 1
    ) {
      applyCombatBloodGemPulse(context, ownerId, target, {
        actorInstanceId: source.instanceId,
        sourceLabel: rallySourceLabel(component),
        applicationIndex: application,
        applicationCount,
      });
    }
  }
}

function resolveCombatAvengeEffect(
  context: CombatContext,
  ownerId: PlayerId,
  watcher: MinionInstance,
  component: MinionEffectSource,
  effect: AvengeEffect,
): void {
  if (effect.kind === "gainRandomGeneratedMinion") {
    resolveCombatGainRandomGeneratedMinion(
      context,
      ownerId,
      watcher,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "gainTavernSpell") {
    resolveCombatGainTavernSpell(
      context,
      ownerId,
      watcher,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "summon") {
    const watcherIndex = context.boards[ownerId].findIndex(
      (minion) => minion.instanceId === watcher.instanceId,
    );
    if (watcherIndex >= 0) {
      resolveCombatSummonEffect(
        context,
        ownerId,
        watcher,
        component,
        effect,
        watcherIndex + 1,
      );
    }
    return;
  }

  resolveCombatApplyBloodGemsToTribe(
    context,
    ownerId,
    watcher,
    component,
    effect,
  );
}

function advanceAvenge(
  context: CombatContext,
  ownerId: PlayerId,
  watcher: MinionInstance,
  component: MinionEffectSource,
): void {
  const avenge = getMinionDefinition(component.definitionId).avenge;
  if (!avenge) {
    return;
  }
  const progressKey =
    `${watcher.instanceId}:${component.sourceInstanceId}:` +
    component.definitionId;
  const progress =
    (context.avengeProgress[ownerId][progressKey] ?? 0) + 1;
  if (progress < avenge.threshold) {
    context.avengeProgress[ownerId][progressKey] = progress;
    return;
  }

  // Reset before resolving effects: an immediate attack may synchronously
  // produce more friendly deaths and start the next Avenge cycle.
  context.avengeProgress[ownerId][progressKey] =
    progress - avenge.threshold;
  pushBattleEvent(context.events, {
    type: "avenge",
    actorPlayerId: ownerId,
    actorInstanceId: watcher.instanceId,
    minion: cloneMinion(watcher),
    message: `${rallySourceLabel(component)}触发了复仇（${avenge.threshold}）。`,
  });
  for (const effect of avenge.effects) {
    resolveCombatAvengeEffect(
      context,
      ownerId,
      watcher,
      component,
      effect,
    );
  }
}

function advanceDynamicEndOfTurnAvenge(
  context: CombatContext,
  ownerId: PlayerId,
  watcher: MinionInstance,
  effect: DynamicWarbandEndOfTurnEffect,
  scale: number,
): void {
  const progress =
    effectCounter(
      watcher,
      DYNAMIC_AVENGE_PROGRESS_COUNTER,
      0,
    ) + 1;
  if (progress < effect.avengeThreshold) {
    setEffectCounter(
      watcher,
      DYNAMIC_AVENGE_PROGRESS_COUNTER,
      progress,
    );
    return;
  }
  setEffectCounter(watcher, DYNAMIC_AVENGE_PROGRESS_COUNTER, 0);
  const attackIncrease = effect.avengeAttack * scale;
  const healthIncrease = effect.avengeHealth * scale;
  setEffectCounter(
    watcher,
    DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
    effectCounter(
      watcher,
      DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
      0,
    ) + attackIncrease,
  );
  setEffectCounter(
    watcher,
    DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
    effectCounter(
      watcher,
      DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
      0,
    ) + healthIncrease,
  );
  refreshDynamicMinionDescription(watcher);

  const owner = persistentCombatOwner(context, ownerId);
  const persistent = owner
    ? findCombatWritebackMinion(
        context,
        owner,
        ownerId,
        watcher.instanceId,
      )
    : undefined;
  if (persistent) {
    setEffectCounter(persistent, DYNAMIC_AVENGE_PROGRESS_COUNTER, 0);
    setEffectCounter(
      persistent,
      DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
      effectCounter(
        persistent,
        DYNAMIC_END_OF_TURN_ATTACK_COUNTER,
        0,
      ) + attackIncrease,
    );
    setEffectCounter(
      persistent,
      DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
      effectCounter(
        persistent,
        DYNAMIC_END_OF_TURN_HEALTH_COUNTER,
        0,
      ) + healthIncrease,
    );
    refreshDynamicMinionDescription(persistent, owner);
  }
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: watcher.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: watcher.instanceId,
    attackDelta: 0,
    healthDelta: 0,
    ...(persistent ? { permanentEffectImprovement: true } : {}),
    minion: cloneMinion(watcher),
    message: persistent
      ? `${watcher.name}的复仇永久提升了回合结束效果。`
      : `${watcher.name}的复仇提升了本场战斗中的回合结束效果。`,
  });
}

function resolveCombatGrantKeyword(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GrantKeywordEffect,
): void {
  const candidates = context.boards[ownerId].filter(
    (minion) =>
      minion.health > 0 &&
      minion.instanceId !== source.instanceId &&
      minionHasTribe(minion, effect.tribe) &&
      !minion[effect.keyword],
  );
  const count =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount"
      ? 2
      : 1);
  for (
    let granted = 0;
    granted < count && candidates.length > 0;
    granted += 1
  ) {
    const targetIndex = randomIndex(
      context.state,
      candidates.length,
    );
    const [target] = candidates.splice(targetIndex, 1);
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      target,
      { keywords: [effect.keyword] },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `${rallySourceLabel(component)}使${target.name}获得复生。`,
    });
  }
}

function resolveCombatFriendlyDeathEffects(
  context: CombatContext,
  ownerId: PlayerId,
  watcher: MinionInstance,
  component: MinionEffectSource,
  effects: readonly MinionEffect[] | undefined,
): void {
  if (!effects) {
    return;
  }
  for (const effect of effects) {
    if (effect.kind === "gainBloodGems") {
      resolveCombatGainBloodGems(
        context,
        ownerId,
        watcher,
        component,
        effect,
        "死亡观察",
      );
      continue;
    }
    if (effect.kind === "improveBloodGems") {
      const owner = persistentCombatOwner(context, ownerId);
      if (!owner) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      const attackDelta = effect.attack * scale;
      const healthDelta = effect.health * scale;
      owner.bloodGemAttack += attackDelta;
      owner.bloodGemHealth += healthDelta;
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: watcher.instanceId,
        targetPlayerId: ownerId,
        actorMinion: cloneMinion(watcher),
        attackDelta,
        healthDelta,
        permanentEffectImprovement: true,
        message: `${rallySourceLabel(component)}使本局鲜血宝石额外获得+${attackDelta}/+${healthDelta}。`,
      });
    }
  }
}

function triggerAfterFriendlyDied(
  context: CombatContext,
  ownerId: PlayerId,
  death: DeadMinion,
  eligibleWatcherInstanceIds: ReadonlySet<string>,
): void {
  const enemyId = opponentId(context, ownerId);
  for (const watcher of [...context.boards[ownerId]]) {
    if (
      watcher.health <= 0 ||
      !eligibleWatcherInstanceIds.has(watcher.instanceId) ||
      !context.boards[ownerId].some(
        (minion) =>
          minion.instanceId === watcher.instanceId &&
          minion.health > 0,
      )
    ) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      if (
        !context.boards[ownerId].some(
          (minion) =>
            minion.instanceId === watcher.instanceId &&
            minion.health > 0,
        )
      ) {
        break;
      }
      const definition = getMinionDefinition(component.definitionId);
      const trigger = definition.afterFriendlyDied;
      const scale = component.golden ? 2 : 1;
      if (trigger && friendlyDeathMatches(death.minion, trigger)) {
        const attackDelta = (trigger.attack ?? 0) * scale;
        const healthDelta = (trigger.health ?? 0) * scale;
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          watcher,
          { attack: attackDelta, health: healthDelta },
        );
        if (attackDelta !== 0 || healthDelta !== 0) {
          pushBattleEvent(context.events, {
            type: "buff",
            actorPlayerId: ownerId,
            actorInstanceId: watcher.instanceId,
            targetPlayerId: ownerId,
            targetInstanceId: watcher.instanceId,
            attackDelta,
            healthDelta,
            minion: cloneMinion(watcher),
            retained: gain.retentionMultiplier > 0,
            ...(gain.retentionMultiplier > 0
              ? { retentionMultiplier: gain.retentionMultiplier }
              : {}),
            message: `${watcher.name}因友方随从死亡获得+${
              attackDelta
            }/+${healthDelta}。`,
          });
        }
        if (trigger.damageEnemy) {
          for (let hit = 0; hit < scale; hit += 1) {
            const target = targetForEnemyDamage(
              context,
              enemyId,
              trigger.damageTarget ?? "random",
            );
            if (!target) {
              break;
            }
            dealCombatDamage(
              context,
              ownerId,
              watcher,
              enemyId,
              target,
              trigger.damageEnemy,
              false,
            );
          }
        }
        resolveCombatFriendlyDeathEffects(
          context,
          ownerId,
          watcher,
          component,
          trigger.effects,
        );
      }

      const combatDeathTrigger =
        definition.afterFriendlyCombatDied;
      if (combatDeathTrigger) {
        const attackDelta = combatDeathTrigger.attack * scale;
        const healthDelta = combatDeathTrigger.health * scale;
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          watcher,
          { attack: attackDelta, health: healthDelta },
        );
        pushBattleEvent(context.events, {
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: watcher.instanceId,
          attackDelta,
          healthDelta,
          minion: cloneMinion(watcher),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${watcher.name}因友方随从死亡获得+${
            attackDelta
          }攻击力${
            healthDelta > 0 ? `和+${healthDelta}生命值` : ""
          }。`,
        });
      }

      const dynamicEndOfTurn = definition.endOfTurn;
      if (dynamicEndOfTurn?.kind === "dynamicWarbandEndOfTurn") {
        advanceDynamicEndOfTurnAvenge(
          context,
          ownerId,
          watcher,
          dynamicEndOfTurn,
          scale,
        );
      }

      if (definition.avenge) {
        advanceAvenge(
          context,
          ownerId,
          watcher,
          component,
        );
      }
    }
  }
}

function resolveOneDeathrattle(
  context: CombatContext,
  death: DeadMinion,
): void {
  const source = death.minion;
  const ownerId = death.ownerId;
  const enemyId = opponentId(context, ownerId);
  const board = context.boards[ownerId];
  const repetitions = 1 + extraDeathrattles(board);
  for (const component of minionEffectSources(source)) {
    const effects =
      getMinionDefinition(component.definitionId).deathrattle ?? [];
    const scale = component.golden ? 2 : 1;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      for (const effect of effects) {
        if (effect.kind === "summon") {
          resolveCombatSummonEffect(
            context,
            ownerId,
            source,
            component,
            effect,
            death.index,
          );
        } else if (effect.kind === "buff") {
          if (
            effect.target === "friendlyTribe" &&
            effect.tribe
          ) {
            const current =
              context.tribeBuffs[ownerId][effect.tribe] ?? {
                attack: 0,
                health: 0,
              };
            context.tribeBuffs[ownerId][effect.tribe] = {
              attack: current.attack + effect.attack * scale,
              health: current.health + effect.health * scale,
            };
          }
          for (const target of combatBuffTargets(
            context.state,
            board,
            source,
            effect,
          )) {
            const gain = applyCombatEnchantingGain(
              context,
              ownerId,
              target,
              {
                attack: effect.attack * scale,
                health: effect.health * scale,
                keywords: effect.taunt ? ["taunt"] : [],
              },
            );
            pushBattleEvent(context.events, {
              type: "buff",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              attackDelta: effect.attack * scale,
              healthDelta: effect.health * scale,
              minion: cloneMinion(target),
              retained: gain.retentionMultiplier > 0,
              ...(gain.retentionMultiplier > 0
                ? {
                    retentionMultiplier:
                      gain.retentionMultiplier,
                  }
                : {}),
              message: `${source.name}的亡语使${target.name}获得+${
                effect.attack * scale
              }/+${effect.health * scale}。`,
            });
          }
        } else if (effect.kind === "grantShield") {
          const candidates = [...board];
          for (
            let count = 0;
            count < scale && candidates.length > 0;
            count += 1
          ) {
            const targetIndex = randomIndex(context.state, candidates.length);
            const target = candidates[targetIndex];
            const gain = applyCombatEnchantingGain(
              context,
              ownerId,
              target,
              { keywords: ["divineShield"] },
            );
            candidates.splice(targetIndex, 1);
            pushBattleEvent(context.events, {
              type: "buff",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              minion: cloneMinion(target),
              retained: gain.retentionMultiplier > 0,
              ...(gain.retentionMultiplier > 0
                ? {
                    retentionMultiplier:
                      gain.retentionMultiplier,
                  }
                : {}),
              message: `${source.name}的亡语使${target.name}获得圣盾。`,
            });
          }
        } else if (effect.kind === "damageEnemy") {
          const target = targetForEnemyDamage(context, enemyId, effect.target);
          if (target) {
            for (let hit = 0; hit < scale; hit += 1) {
              const nextTarget = targetForEnemyDamage(
                context,
                enemyId,
                effect.target,
              );
              if (!nextTarget) {
                break;
              }
              dealCombatDamage(
                context,
                ownerId,
                source,
                enemyId,
                nextTarget,
                effect.amount,
                false,
              );
            }
          }
        } else if (effect.kind === "damageAllMinions") {
          const repeats =
            component.golden && effect.goldenMode === "repeat" ? 2 : 1;
          const amount =
            component.golden && effect.goldenMode !== "repeat"
              ? effect.amount * 2
              : effect.amount;
          for (let hit = 0; hit < repeats; hit += 1) {
            const damageObservations: CombatDamageObservation[] = [];
            for (const targetOwnerId of context.playerIds) {
              for (const target of [...context.boards[targetOwnerId]]) {
                if (
                  targetOwnerId === ownerId &&
                  effect.excludeFriendlyTribe &&
                  minionHasTribe(target, effect.excludeFriendlyTribe)
                ) {
                  continue;
                }
                const observation = dealCombatDamage(
                  context,
                  ownerId,
                  source,
                  targetOwnerId,
                  target,
                  amount,
                  false,
                  true,
                );
                if (observation) {
                  damageObservations.push(observation);
                }
              }
            }
            triggerDeferredDamageObservers(
              context,
              damageObservations,
            );
          }
        } else if (effect.kind === "resummonMechs") {
          const history = context.deadMechs[ownerId];
          for (
            let index = 0;
            index < effect.count * scale &&
            index < history.length &&
            board.length < MAX_BOARD_SIZE;
            index += 1
          ) {
            summonCombatMinion(
              context,
              ownerId,
              history[index].definitionId,
              death.index + index,
              source,
              history[index].golden,
            );
          }
        } else if (effect.kind === "summonRandomDeathrattle") {
          const candidates = MINION_DEFINITIONS.filter(
            (candidate) =>
              definitionIsAvailable(
                candidate,
                context.state.activeTribes,
              ) &&
              candidate.deathrattle !== undefined &&
              candidate.id !== component.definitionId,
          );
          for (
            let count = 0;
            count < effect.count * scale &&
            candidates.length > 0 &&
            board.length < MAX_BOARD_SIZE;
            count += 1
          ) {
            const choice =
              candidates[randomIndex(context.state, candidates.length)];
            summonCombatMinion(
              context,
              ownerId,
              choice.id,
              death.index + count,
              source,
            );
          }
        } else if (effect.kind === "buffRandomHandMinion") {
          resolveCombatHandBuff(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "improveBeetles") {
          improveBeetlesInCombat(
            context,
            ownerId,
            source,
            component,
            effect,
            "亡语",
          );
        } else if (effect.kind === "improveBloodGems") {
          const owner = persistentCombatOwner(context, ownerId);
          if (owner) {
            owner.bloodGemAttack += effect.attack * scale;
            owner.bloodGemHealth += effect.health * scale;
          }
        } else if (effect.kind === "improveUndeadArmy") {
          resolveCombatImproveUndeadArmy(
            context,
            ownerId,
            source,
            component,
            effect,
            "亡语",
          );
        } else if (effect.kind === "improveTavernSpellBuffs") {
          const owner = persistentCombatOwner(context, ownerId);
          if (owner) {
            owner.tavernSpellAttackBonus += effect.attack * scale;
            owner.tavernSpellHealthBonus += effect.health * scale;
          }
        } else if (effect.kind === "installTavernRefreshBuff") {
          const owner = persistentCombatOwner(context, ownerId);
          if (owner) {
            const effectRepetitions =
              effect.goldenMode === "repeat" ? scale : 1;
            for (
              let effectRepetition = 0;
              effectRepetition < effectRepetitions;
              effectRepetition += 1
            ) {
              owner.rideTheWindBuffs.push({
                attack: effect.attack,
                health: effect.health,
              });
              pushBattleEvent(context.events, {
                type: "trigger",
                actorPlayerId: ownerId,
                actorInstanceId: source.instanceId,
                targetPlayerId: ownerId,
                actorMinion: cloneMinion(source),
                attackDelta: effect.attack,
                healthDelta: effect.health,
                permanentEffectImprovement: true,
                message: `${rallySourceLabel(component)}的亡语为后续刷新安装了+${effect.attack}/+${effect.health}酒馆增益。`,
              });
            }
          }
        } else if (effect.kind === "applyBloodGemsToTribe") {
          resolveCombatApplyBloodGemsToTribe(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "discountNextTavernSpell") {
          const owner = persistentCombatOwner(context, ownerId);
          if (owner) {
            owner.nextTavernSpellDiscount =
              (owner.nextTavernSpellDiscount ?? 0) +
              effect.amount * scale;
          }
        } else if (effect.kind === "buffTavernType") {
          const owner = persistentCombatOwner(context, ownerId);
          if (owner) {
            const effectRepetitions =
              effect.goldenMode === "repeat" ? scale : 1;
            const pulseScale =
              effect.goldenMode === "repeat" ? 1 : scale;
            for (
              let effectRepetition = 0;
              effectRepetition < effectRepetitions;
              effectRepetition += 1
            ) {
              const attackDelta = effect.attack * pulseScale;
              const healthDelta = effect.health * pulseScale;
              applyPersistentTavernTypeBuff(
                owner,
                effect.tribe,
                attackDelta,
                healthDelta,
              );
              pushBattleEvent(context.events, {
                type: "trigger",
                actorPlayerId: ownerId,
                actorInstanceId: source.instanceId,
                targetPlayerId: ownerId,
                attackDelta,
                healthDelta,
                permanentEffectImprovement: true,
                message: `${rallySourceLabel(component)}的亡语使酒馆中对应类型的随从在本局对战中获得+${attackDelta}/+${healthDelta}。`,
              });
            }
          }
        } else if (effect.kind === "grantKeyword") {
          resolveCombatGrantKeyword(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "getRandomMinion") {
          resolveCombatGetRandomMinion(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "gainRandomGeneratedMinion") {
          resolveCombatGainRandomGeneratedMinion(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "gainTavernSpell") {
          resolveCombatGainTavernSpell(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "gainRandomTavernSpell") {
          resolveCombatGainRandomTavernSpell(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "castTavernSpell") {
          resolveCombatCastTavernSpell(
            context,
            ownerId,
            source,
            component,
            effect,
            "亡语",
          );
        }
      }
    }
  }
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (
      let count = 0;
      count < source.temporaryCrabDeathrattles &&
      board.length < MAX_BOARD_SIZE;
      count += 1
    ) {
      summonCombatMinion(
        context,
        ownerId,
        "live-crab-token",
        death.index + count,
        source,
        false,
        false,
      );
    }
    for (
      let count = 0;
      count < (source.temporaryGoldenCrabDeathrattles ?? 0) &&
      board.length < MAX_BOARD_SIZE;
      count += 1
    ) {
      summonCombatMinion(
        context,
        ownerId,
        "live-crab-token",
        death.index +
          source.temporaryCrabDeathrattles +
          count,
        source,
        true,
        false,
      );
    }
  }
}

function resolveCombatDeaths(context: CombatContext): void {
  context.deathResolutionDepth += 1;
  try {
    for (let wave = 0; wave < 50; wave += 1) {
      const deaths = context.playerIds.flatMap((ownerId) =>
        removeDead(context.boards[ownerId], ownerId),
      );
      if (deaths.length === 0) {
        return;
      }

      for (const death of deaths) {
        if (minionHasTribe(death.minion, "mech")) {
          context.deadMechs[death.ownerId].push(
            cloneMinion(death.minion),
          );
        }
        const deathSnapshot = cloneMinion(death.minion);
        deathSnapshot.health = 0;
        pushBattleEvent(context.events, {
          type: "death",
          actorPlayerId: death.ownerId,
          actorInstanceId: death.minion.instanceId,
          minion: deathSnapshot,
          message: `${death.minion.name}被消灭。`,
        });
      }
      for (const death of deaths) {
        removeCombatAuraSource(context, death);
      }
      for (const death of deaths) {
        observeCombatFriendlyDeath(context, death);
      }
      const eligibleDeathWatchers = Object.fromEntries(
        context.playerIds.map((ownerId) => [
          ownerId,
          new Set(
            context.boards[ownerId]
              .filter((minion) => minion.health > 0)
              .map((minion) => minion.instanceId),
          ),
        ]),
      ) as Record<PlayerId, ReadonlySet<string>>;
      for (const death of deaths) {
        triggerAfterFriendlyDied(
          context,
          death.ownerId,
          death,
          eligibleDeathWatchers[death.ownerId],
        );
      }
      for (const death of deaths) {
        resolveOneDeathrattle(context, death);
      }
      for (const death of deaths) {
        if (
          !death.minion.reborn ||
          context.boards[death.ownerId].length >= MAX_BOARD_SIZE
        ) {
          continue;
        }
        const reborn = createMinionInstance(
          context.state,
          death.minion.definitionId,
          0,
        );
        if (death.minion.golden) {
          makeGoldenToken(reborn);
        }
        applyCurrentBeetleBonus(context, death.ownerId, reborn);
        const rebornMaximumHealth = reborn.health;
        reborn.health = 1;
        reborn.reborn = false;
        insertCombatMinion(
          context,
          death.ownerId,
          reborn,
          death.index,
          death.minion,
          `${death.minion.name}复生了。`,
          "reborn",
          rebornMaximumHealth,
        );
      }
      for (const ownerId of context.playerIds) {
        summonPendingBeetles(context, ownerId);
      }
      if (context.deathResolutionDepth === 1) {
        for (const ownerId of context.playerIds) {
          summonPendingStartOfCombatHandMinions(context, ownerId);
        }
      }
    }
  } finally {
    context.deathResolutionDepth -= 1;
  }
}

interface AlivePairingPlan {
  pairs: Array<readonly [PlayerState, PlayerState]>;
  rematches: number;
}

function pairingRandomSeed(state: GameState, aliveCount: number): number {
  return normalizeSeed(
    (
      state.seed ^
      Math.imul(state.round, 0x9e37_79b9) ^
      Math.imul(aliveCount, 0x85eb_ca6b)
    ) >>> 0,
  );
}

function shuffleForPairings(
  state: GameState,
  players: readonly PlayerState[],
): PlayerState[] {
  const shuffled = [...players];
  let value = pairingRandomSeed(state, shuffled.length);
  const nextPairingRandom = () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 0x1_0000_0000;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextPairingRandom() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function isImmediateRematch(
  playerA: PlayerState,
  playerB: PlayerState,
): boolean {
  return (
    playerA.lastOpponentId === playerB.id ||
    playerB.lastOpponentId === playerA.id
  );
}

function bestAlivePairingPlan(
  players: readonly PlayerState[],
): AlivePairingPlan {
  if (players.length < 2) {
    return { pairs: [], rematches: 0 };
  }
  const playerA = players[0];
  let bestPlan: AlivePairingPlan | null = null;
  for (let opponentIndex = 1; opponentIndex < players.length; opponentIndex += 1) {
    const playerB = players[opponentIndex];
    const remaining = players.filter(
      (_, index) => index !== 0 && index !== opponentIndex,
    );
    const tailPlan = bestAlivePairingPlan(remaining);
    const candidate: AlivePairingPlan = {
      pairs: [[playerA, playerB], ...tailPlan.pairs],
      rematches:
        tailPlan.rematches +
        (isImmediateRematch(playerA, playerB) ? 1 : 0),
    };
    if (!bestPlan || candidate.rematches < bestPlan.rematches) {
      bestPlan = candidate;
    }
  }
  return bestPlan ?? { pairs: [], rematches: 0 };
}

/**
 * Recruit-phase pairings use a dedicated deterministic random stream. Shop
 * rolls and AI decisions therefore cannot silently change the opponent shown
 * to the player before END_TURN.
 */
export function getScheduledPairings(
  state: GameState,
): ScheduledPairing[] {
  const alive = shuffleForPairings(
    state,
    state.players.filter((player) => player.alive),
  );
  const ghost =
    alive.length % 2 === 1
      ? state.players
          .filter(
            (player) =>
              !player.alive && player.eliminatedRound !== undefined,
          )
          .sort((left, right) => {
            const roundDifference =
              (right.eliminatedRound ?? -1) -
              (left.eliminatedRound ?? -1);
            return roundDifference !== 0
              ? roundDifference
              : left.id.localeCompare(right.id);
          })[0]
      : undefined;

  let livingPlan: AlivePairingPlan;
  let ghostParticipant: PlayerState | undefined;
  if (ghost) {
    let bestGhostPlan:
      | {
          participant: PlayerState;
          living: AlivePairingPlan;
          rematches: number;
        }
      | undefined;
    for (let index = 0; index < alive.length; index += 1) {
      const participant = alive[index];
      const living = bestAlivePairingPlan(
        alive.filter((_, candidateIndex) => candidateIndex !== index),
      );
      const rematches =
        living.rematches +
        (isImmediateRematch(participant, ghost) ? 1 : 0);
      if (!bestGhostPlan || rematches < bestGhostPlan.rematches) {
        bestGhostPlan = { participant, living, rematches };
      }
    }
    ghostParticipant = bestGhostPlan?.participant;
    livingPlan = bestGhostPlan?.living ?? { pairs: [], rematches: 0 };
  } else {
    const pairedAlive =
      alive.length % 2 === 0 ? alive : alive.slice(0, -1);
    livingPlan = bestAlivePairingPlan(pairedAlive);
  }

  const pairings: ScheduledPairing[] = livingPlan.pairs.map(
    ([playerA, playerB]) => ({
      playerAId: playerA.id,
      playerBId: playerB.id,
      isGhost: false,
    }),
  );
  if (ghost && ghostParticipant) {
    pairings.push({
      playerAId: ghostParticipant.id,
      playerBId: ghost.id,
      isGhost: true,
    });
  }
  return pairings;
}

export function getScheduledOpponent(
  state: GameState,
  playerId: PlayerId,
): { opponentId: PlayerId; isGhost: boolean } | null {
  if (state.phase !== "recruit") {
    return null;
  }
  const pairing = getScheduledPairings(state).find(
    (candidate) =>
      candidate.playerAId === playerId ||
      candidate.playerBId === playerId,
  );
  if (!pairing) {
    return null;
  }
  return {
    opponentId:
      pairing.playerAId === playerId
        ? pairing.playerBId
        : pairing.playerAId,
    isGhost: pairing.isGhost,
  };
}

function buildPairings(state: GameState): Pairing[] {
  return getScheduledPairings(state).map((pairing) => {
    const playerA = findPlayer(state, pairing.playerAId);
    const playerB = findPlayer(state, pairing.playerBId);
    if (!playerA || !playerB) {
      throw new Error("Scheduled pairing references an unknown player");
    }
    return {
      playerA,
      playerB,
      isGhost: pairing.isGhost,
    };
  });
}

function resultForPlayer(
  winnerId: PlayerId | null,
  playerId: PlayerId,
): BattleResult {
  if (winnerId === null) {
    return "tie";
  }
  return winnerId === playerId ? "win" : "loss";
}

function settleNextCombatGold(
  player: PlayerState,
  result: BattleResult,
  events: BattleEvent[],
): void {
  const amount =
    result === "win"
      ? player.nextCombatWinGold
      : result === "tie"
        ? player.nextCombatTieGold
        : 0;
  player.nextCombatWinGold = 0;
  player.nextCombatTieGold = 0;
  if (amount <= 0) {
    return;
  }
  player.pendingNextTurnGold += amount;
  pushBattleEvent(events, {
    type: "goldReward",
    actorPlayerId: player.id,
    amount,
    message: `${player.name}的“自负”将在下回合提供 ${amount} 枚铸币。`,
  });
}

function applyQueuedWarbandStatBuff(
  context: CombatContext,
  ownerId: PlayerId,
  attackDelta: number,
  healthDelta: number,
): void {
  if (attackDelta === 0 && healthDelta === 0) {
    return;
  }
  for (const target of context.boards[ownerId]) {
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      target,
      { attack: attackDelta, health: healthDelta },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta,
      healthDelta,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `转瞬活力使${target.name}在本场战斗中获得+${attackDelta}/+${healthDelta}。`,
    });
  }
}

function applyQueuedStartOfCombatSpells(
  context: CombatContext,
  owner: PlayerState,
  enemy: PlayerState,
  isGhostOwner: boolean,
): void {
  if (isGhostOwner) {
    return;
  }
  const ownBoard = context.boards[owner.id];
  for (const buff of owner.nextCombatDoubleLeftmostAttack) {
    const target = ownBoard[0];
    if (!target) {
      continue;
    }
    const attackDelta = target.attack + buff.attack;
    const healthDelta = buff.health;
    const gain = applyCombatEnchantingGain(
      context,
      owner.id,
      target,
      { attack: attackDelta, health: healthDelta },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: owner.id,
      targetPlayerId: owner.id,
      targetInstanceId: target.instanceId,
      attackDelta,
      healthDelta,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `诺兹多姆的子嗣使${target.name}的攻击力翻倍。`,
    });
  }
  owner.nextCombatDoubleLeftmostAttack = [];

  const enemyBoard = context.boards[enemy.id];
  for (
    let count = 0;
    count < owner.nextCombatSetEnemyHealthToOne &&
    enemyBoard.length > 0;
    count += 1
  ) {
    const target = enemyBoard[randomIndex(context.state, enemyBoard.length)];
    const healthDelta = 1 - target.health;
    target.health = 1;
    context.maximumHealths[enemy.id][target.instanceId] = 1;
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: owner.id,
      targetPlayerId: enemy.id,
      targetInstanceId: target.instanceId,
      attackDelta: 0,
      healthDelta,
      minion: cloneMinion(target),
      message: `优势压制将${target.name}的生命值变为1。`,
    });
  }
  owner.nextCombatSetEnemyHealthToOne = 0;
}

function resolveInHandStartOfCombatMinions(
  context: CombatContext,
  player: PlayerState,
  isGhost: boolean,
): void {
  if (isGhost) {
    return;
  }
  const board = context.boards[player.id];
  for (const card of player.hand) {
    if (card.kind !== "minion" || board.length >= MAX_BOARD_SIZE) {
      continue;
    }
    const effect =
      getMinionDefinition(card.definitionId).inHandStartOfCombat;
    if (effect?.kind !== "summonSelfCopy") {
      continue;
    }
    const summoned = cloneOwnedMinionForCombat(context.state, card);
    if (card.golden && effect.goldenMode === "doubleStats") {
      summoned.attack *= 2;
      summoned.health *= 2;
    }
    insertCombatMinion(
      context,
      player.id,
      summoned,
      board.length,
      card,
      `${card.name}从手牌召唤了一个仅限本场战斗的复制。`,
      "inHandStartOfCombat",
    );
  }
}

function simulateBattle(
  state: GameState,
  pairing: Pairing,
): BattleSummary {
  const { playerA, playerB, isGhost } = pairing;
  const boardA = cloneBoard(playerA.board);
  const boardB = cloneBoard(playerB.board);
  const events: BattleEvent[] = [];
  const astralAutomatonsSummoned = {
    [playerA.id]: playerA.astralAutomatonsSummoned,
    [playerB.id]: playerB.astralAutomatonsSummoned,
  };
  const eternalKnightsDied = {
    [playerA.id]: playerA.eternalKnightsDied,
    [playerB.id]: playerB.eternalKnightsDied,
  };
  for (const minion of boardA) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned[playerA.id],
      eternalKnightsDied[playerA.id],
    );
  }
  for (const minion of boardB) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned[playerB.id],
      eternalKnightsDied[playerB.id],
    );
  }
  const queuedWarbandBuffA = {
    attack: playerA.nextCombatAttackBonus,
    health: playerA.nextCombatHealthBonus,
  };
  const queuedWarbandBuffB = {
    attack: playerB.nextCombatAttackBonus,
    health: playerB.nextCombatHealthBonus,
  };
  playerA.nextCombatAttackBonus = 0;
  playerA.nextCombatHealthBonus = 0;
  playerB.nextCombatAttackBonus = 0;
  playerB.nextCombatHealthBonus = 0;
  applyCombatAuras(boardA);
  applyCombatAuras(boardB);
  const initialBoards: Record<PlayerId, MinionInstance[]> = {
    [playerA.id]: cloneBoard(boardA),
    [playerB.id]: cloneBoard(boardB),
  };
  const context: CombatContext = {
    state,
    events,
    playerIds: [playerA.id, playerB.id],
    ...(isGhost ? { ghostOwnerId: playerB.id } : {}),
    boards: {
      [playerA.id]: boardA,
      [playerB.id]: boardB,
    },
    deadMechs: {
      [playerA.id]: [],
      [playerB.id]: [],
    },
    tribeBuffs: {
      [playerA.id]: {
        undead: {
          attack: playerA.undeadArmyAttackBonus,
          health: playerA.undeadArmyHealthBonus,
        },
      },
      [playerB.id]: {
        undead: {
          attack: playerB.undeadArmyAttackBonus,
          health: playerB.undeadArmyHealthBonus,
        },
      },
    },
    beetleBonuses: {
      [playerA.id]: {
        attack: playerA.beetleAttackBonus,
        health: playerA.beetleHealthBonus,
      },
      [playerB.id]: {
        attack: playerB.beetleAttackBonus,
        health: playerB.beetleHealthBonus,
      },
    },
    pendingBeetles: {
      [playerA.id]: playerA.nextCombatBeetles,
      [playerB.id]: isGhost ? 0 : playerB.nextCombatBeetles,
    },
    pendingStartOfCombatHandSummons: {
      [playerA.id]: [],
      [playerB.id]: [],
    },
    deathResolutionDepth: 0,
    astralAutomatonsSummoned,
    eternalKnightsDied,
    avengeProgress: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    limitedSelfDamageTriggers: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    poisonLethalMinionIds: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    maximumHealths: {
      [playerA.id]: Object.fromEntries(
        boardA.map((minion) => [minion.instanceId, minion.health]),
      ),
      [playerB.id]: Object.fromEntries(
        boardB.map((minion) => [minion.instanceId, minion.health]),
      ),
    },
    originalCombatMinionIds: {
      [playerA.id]: new Set(
        boardA.map((minion) => minion.instanceId),
      ),
      [playerB.id]: new Set(
        boardB.map((minion) => minion.instanceId),
      ),
    },
    retainedCombatEnchantments: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    retentionWritebackTargets: {
      [playerA.id]: Object.fromEntries(
        boardA.map((minion) => [
          minion.instanceId,
          minion.instanceId,
        ]),
      ),
      [playerB.id]: Object.fromEntries(
        boardB.map((minion) => [
          minion.instanceId,
          minion.instanceId,
        ]),
      ),
    },
  };
  const healthABefore = playerA.health;
  const healthBBefore = playerB.health;
  const armorABefore = playerA.armor;
  const armorBBefore = playerB.armor;
  pushBattleEvent(events, {
    type: "battleStart",
    actorPlayerId: playerA.id,
    targetPlayerId: playerB.id,
    message: `${playerA.name}对阵${isGhost ? "幽灵·" : ""}${playerB.name}。`,
  });
  applyQueuedWarbandStatBuff(
    context,
    playerA.id,
    queuedWarbandBuffA.attack,
    queuedWarbandBuffA.health,
  );
  if (!isGhost) {
    applyQueuedWarbandStatBuff(
      context,
      playerB.id,
      queuedWarbandBuffB.attack,
      queuedWarbandBuffB.health,
    );
  }
  applyQueuedStartOfCombatSpells(
    context,
    playerA,
    playerB,
    false,
  );
  applyQueuedStartOfCombatSpells(
    context,
    playerB,
    playerA,
    isGhost,
  );
  summonPendingBeetles(context, playerA.id);
  summonPendingBeetles(context, playerB.id);
  applyStartOfCombatEffects(context, playerA.id);
  applyStartOfCombatEffects(context, playerB.id);
  summonPendingStartOfCombatHandMinions(context, playerA.id);
  summonPendingStartOfCombatHandMinions(context, playerB.id);
  resolveInHandStartOfCombatMinions(context, playerA, false);
  resolveInHandStartOfCombatMinions(context, playerB, isGhost);

  let attackingPlayerId: PlayerId;
  if (boardA.length > boardB.length) {
    attackingPlayerId = playerA.id;
  } else if (boardB.length > boardA.length) {
    attackingPlayerId = playerB.id;
  } else {
    attackingPlayerId =
      randomIndex(state, 2) === 0 ? playerA.id : playerB.id;
  }

  const cursors: Record<PlayerId, number> = {
    [playerA.id]: 0,
    [playerB.id]: 0,
  };
  let attackCount = 0;
  let consecutiveSkips = 0;

  while (
    boardA.length > 0 &&
    boardB.length > 0 &&
    attackCount < MAX_COMBAT_ATTACKS
  ) {
    const attackingA = attackingPlayerId === playerA.id;
    const ownBoard = attackingA ? boardA : boardB;
    const attackerOwner = attackingA ? playerA : playerB;
    const defenderOwner = attackingA ? playerB : playerA;
    const attackIndex = availableAttackIndex(
      ownBoard,
      cursors[attackerOwner.id] ?? 0,
    );
    if (attackIndex < 0) {
      consecutiveSkips += 1;
      if (consecutiveSkips >= 2) {
        break;
      }
      attackingPlayerId = defenderOwner.id;
      continue;
    }
    const attacker = ownBoard[attackIndex];
    const attackerInstanceId = attacker.instanceId;
    const strikes = attacker.windfury ? 2 : 1;
    let completedStrike = false;
    for (
      let strike = 0;
      strike < strikes &&
      boardA.length > 0 &&
      boardB.length > 0 &&
      attackCount < MAX_COMBAT_ATTACKS;
      strike += 1
    ) {
      const attacked = performAttackStrike(
        context,
        attackerOwner.id,
        attackerInstanceId,
        { windfuryStrike: strike > 0 },
      );
      if (!attacked) {
        break;
      }
      completedStrike = true;
      attackCount += 1;
    }
    if (completedStrike) {
      consecutiveSkips = 0;
    } else {
      consecutiveSkips += 1;
      if (consecutiveSkips >= 2) {
        break;
      }
    }

    const survivingAttackerIndex = ownBoard.findIndex(
      (minion) => minion.instanceId === attackerInstanceId,
    );
    cursors[attackerOwner.id] =
      ownBoard.length === 0
        ? 0
        : survivingAttackerIndex >= 0
          ? (survivingAttackerIndex + 1) % ownBoard.length
          : Math.min(attackIndex, ownBoard.length - 1);
    attackingPlayerId = defenderOwner.id;
  }

  playerA.nextCombatBeetles =
    context.pendingBeetles[playerA.id];
  if (!isGhost) {
    playerB.nextCombatBeetles =
      context.pendingBeetles[playerB.id];
  }

  let winnerId: PlayerId | null = null;
  if (boardA.length > 0 && boardB.length === 0) {
    winnerId = playerA.id;
  } else if (boardB.length > 0 && boardA.length === 0) {
    winnerId = playerB.id;
  }

  let damageToPlayerA = 0;
  let damageToPlayerB = 0;
  if (winnerId === playerA.id) {
    damageToPlayerB =
      playerA.tavernTier +
      boardA.reduce((total, minion) => total + minion.tier, 0);
    if (!isGhost) {
      const damage = damagePlayer(playerB, damageToPlayerB);
      pushBattleEvent(events, {
        type: "heroDamage",
        actorPlayerId: playerA.id,
        targetPlayerId: playerB.id,
        amount: damageToPlayerB,
        armorAbsorbed: damage.armorAbsorbed,
        healthDamage: damage.healthDamage,
        message:
          damage.armorAbsorbed > 0
            ? `${playerB.name}受到 ${damageToPlayerB} 点伤害，护甲抵挡 ${damage.armorAbsorbed} 点。`
            : `${playerB.name}受到 ${damageToPlayerB} 点伤害。`,
      });
    } else {
      damageToPlayerB = 0;
    }
  } else if (winnerId === playerB.id) {
    damageToPlayerA =
      playerB.tavernTier +
      boardB.reduce((total, minion) => total + minion.tier, 0);
    const damage = damagePlayer(playerA, damageToPlayerA);
    pushBattleEvent(events, {
      type: "heroDamage",
      actorPlayerId: playerB.id,
      targetPlayerId: playerA.id,
      amount: damageToPlayerA,
      armorAbsorbed: damage.armorAbsorbed,
      healthDamage: damage.healthDamage,
      message:
        damage.armorAbsorbed > 0
          ? `${playerA.name}受到 ${damageToPlayerA} 点伤害，护甲抵挡 ${damage.armorAbsorbed} 点。`
          : `${playerA.name}受到 ${damageToPlayerA} 点伤害。`,
    });
  }

  if (playerA.alive) {
    settleNextCombatGold(
      playerA,
      resultForPlayer(winnerId, playerA.id),
      events,
    );
  }
  if (!isGhost && playerB.alive) {
    settleNextCombatGold(
      playerB,
      resultForPlayer(winnerId, playerB.id),
      events,
    );
  }

  const resultText =
    winnerId === null
      ? "战斗以平局结束。"
      : `${winnerId === playerA.id ? playerA.name : playerB.name}获胜。`;
  pushBattleEvent(events, {
    type: "battleEnd",
    actorPlayerId: winnerId ?? undefined,
    message: resultText,
  });
  flushRetainedCombatEnchantments(context);

  const humanInBattle =
    playerA.id === state.humanPlayerId || playerB.id === state.humanPlayerId;
  return {
    round: state.round,
    playerAId: playerA.id,
    playerBId: playerB.id,
    playerAName: playerA.name,
    playerBName: playerB.name,
    isGhost,
    winnerId,
    resultForHuman: humanInBattle
      ? resultForPlayer(winnerId, state.humanPlayerId)
      : undefined,
    damageToPlayerA,
    damageToPlayerB,
    playerAHealthBefore: healthABefore,
    playerBHealthBefore: healthBBefore,
    playerAHealthAfter: playerA.health,
    playerBHealthAfter: playerB.health,
    playerAArmorBefore: armorABefore,
    playerBArmorBefore: armorBBefore,
    playerAArmorAfter: playerA.armor,
    playerBArmorAfter: playerB.armor,
    initialBoards,
    finalBoards: {
      [playerA.id]: cloneBoard(boardA),
      [playerB.id]: cloneBoard(boardB),
    },
    events,
  };
}

function releaseEliminatedPlayer(
  state: GameState,
  player: PlayerState,
): void {
  const ownedMinions = player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  player.ghostHand = ownedMinions.map((minion) => {
    const snapshot = cloneMinion(minion);
    clearTemporarySpellcraftBuffs(snapshot);
    snapshot.poolCopies = 0;
    delete snapshot.poolCopiesOnPurchase;
    snapshot.attachments = snapshot.attachments.map(
      clearAttachmentPoolCopies,
    );
    return snapshot;
  });
  for (const minion of [...player.board, ...ownedMinions, ...player.shop]) {
    returnMinionToPool(state, minion);
  }
  for (const spell of tavernSpellShopOffers(player)) {
    state.spellPool[spell.definitionId] =
      (state.spellPool[spell.definitionId] ?? 0) + 1;
  }
  for (const minion of player.board) {
    clearTemporarySpellcraftBuffs(minion);
  }
  player.board = player.board.map((minion) => ({
    ...minion,
    poolCopies: 0,
    attachments: minion.attachments.map(clearAttachmentPoolCopies),
  }));
  player.hand = [];
  player.pendingSpellcraft = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
  player.helpfulRefreshes = 0;
  player.lastHelpfulRefreshKind = null;
  player.cardsPlayedThisTurn = 0;
  player.goldSpentThisTurn = 0;
  player.pendingCardPlayed = null;
  player.lastTavernSpellDefinitionId = null;
  player.pendingTavernSpellDefinitionId = null;
  player.demonFodderRefreshQueue = [];
  player.frozen = false;
}

function settleEliminations(state: GameState): void {
  const newlyEliminated = state.players.filter(
    (player) => player.alive && player.health <= 0,
  );
  for (const player of newlyEliminated) {
    player.alive = false;
    player.eliminatedRound = state.round;
    releaseEliminatedPlayer(state, player);
  }

  const alivePlayers = state.players.filter((player) => player.alive);
  const sharedPlacement = alivePlayers.length + 1;
  for (const player of newlyEliminated) {
    player.placement = sharedPlacement;
  }
  if (alivePlayers.length === 1) {
    alivePlayers[0].placement = 1;
    state.winnerId = alivePlayers[0].id;
  } else if (alivePlayers.length === 0) {
    state.winnerId = null;
  }
}

function endTurn(state: GameState): void {
  const previousRoundBattles = state.lastRoundBattles;
  const human = humanPlayer(state);
  if (human.alive) {
    applyEndOfTurnEffects(state, human);
    reconcileConditionalMinions(human);
    human.hand = human.hand.filter(
      (card) => card.kind !== "spellcraft",
    );
    human.pendingSpellcraft = [];
  }
  const aiPlayers = state.players.filter(
    (player) => player.alive && !player.isHuman,
  );
  shuffleInPlace(state, aiPlayers);
  for (const player of aiPlayers) {
    runAiRecruit(state, player);
    applyEndOfTurnEffects(state, player);
    reconcileConditionalMinions(player);
    player.hand = player.hand.filter(
      (card) => card.kind !== "spellcraft",
    );
    player.pendingSpellcraft = [];
  }

  const pairings = buildPairings(state);
  const battles: BattleSummary[] = [];
  for (const pairing of pairings) {
    const playerAObservation = previouslyObservedOpponent(
      previousRoundBattles,
      pairing.playerA,
      pairing.playerB,
    );
    const playerBObservation = pairing.isGhost
      ? undefined
      : previouslyObservedOpponent(
          previousRoundBattles,
          pairing.playerB,
          pairing.playerA,
        );
    if (!pairing.playerA.isHuman) {
      arrangeAiBoard(pairing.playerA, playerAObservation);
    }
    if (!pairing.isGhost && !pairing.playerB.isHuman) {
      arrangeAiBoard(pairing.playerB, playerBObservation);
    }
    pairing.playerA.lastOpponentId = pairing.playerB.id;
    if (!pairing.isGhost) {
      pairing.playerB.lastOpponentId = pairing.playerA.id;
    }
    battles.push(simulateBattle(state, pairing));
  }
  state.lastRoundBattles = battles;
  state.lastBattle =
    battles.find(
      (battle) =>
        battle.playerAId === state.humanPlayerId ||
        battle.playerBId === state.humanPlayerId,
    ) ?? null;
  if (state.lastBattle) {
    const opponentId =
      state.lastBattle.playerAId === state.humanPlayerId
        ? state.lastBattle.playerBId
        : state.lastBattle.playerAId;
    const report: HumanScoutingReport = {
      opponentId,
      observedRound: state.lastBattle.round,
      resultForHuman:
        state.lastBattle.resultForHuman ??
        resultForPlayer(state.lastBattle.winnerId, state.humanPlayerId),
      isGhost: state.lastBattle.isGhost,
      board: cloneBoard(
        (state.lastBattle.initialBoards[opponentId] ?? []).filter(
          (minion): minion is BoardMinionInstance =>
            minion.kind === "minion",
        ),
      ),
    };
    state.humanScoutingReports[opponentId] = report;
  }
  settleEliminations(state);
  state.phase = "combat";
}

function beginNextRecruit(state: GameState): void {
  const alivePlayers = state.players.filter((player) => player.alive);
  const human = humanPlayer(state);
  if (!human.alive || alivePlayers.length <= 1) {
    state.phase = "gameOver";
    return;
  }

  state.round += 1;
  state.phase = "recruit";
  state.lastBattle = null;
  for (const player of state.players) {
    for (const minion of player.board) {
      clearTemporarySpellcraftBuffs(minion);
    }
    for (const card of player.hand) {
      if (card.kind !== "minion") {
        continue;
      }
      clearTemporarySpellcraftBuffs(card);
      if (
        card.destroyAfterPlayThroughRound !== undefined &&
        card.destroyAfterPlayThroughRound < state.round
      ) {
        delete card.destroyAfterPlayThroughRound;
      }
    }
  }
  for (const player of alivePlayers) {
    player.gold =
      Math.min(player.maxGold, state.round + 2) +
      player.pendingNextTurnGold;
    player.pendingNextTurnGold = 0;
    player.tavernSpellsCastThisTurn = 0;
    player.cardsPlayedThisTurn = 0;
    player.goldSpentThisTurn = 0;
    player.pendingCardPlayed = null;
    player.pendingTavernSpellDefinitionId = null;
    for (const minion of ownedMinionCards(player)) {
      refreshDynamicMinionDescription(minion, player);
    }
    player.elementalsPlayedThisTurn = 0;
    if (playerHasHeroPower(player, "freeRefreshAtTurnStart")) {
      player.freeRefreshes += 1;
    }
    if (
      player.nextTurnBoardAttackBonus > 0 ||
      player.nextTurnBoardHealthBonus > 0
    ) {
      const pulses = Math.max(1, player.nextTurnBoardBuffPulses);
      const attackPerPulse =
        player.nextTurnBoardAttackBonus / pulses;
      const healthPerPulse =
        player.nextTurnBoardHealthBonus / pulses;
      for (let pulse = 0; pulse < pulses; pulse += 1) {
        buffMinions(
          player.board,
          attackPerPulse,
          healthPerPulse,
        );
      }
      player.nextTurnBoardAttackBonus = 0;
      player.nextTurnBoardHealthBonus = 0;
      player.nextTurnBoardBuffPulses = 0;
    }
    if (player.tavernTier < 6) {
      player.upgradeDiscount += 1;
    }
    applyStartOfTurnEffects(state, player);
    if (player.frozen) {
      player.frozen = false;
      player.spellOnlyRefreshActive = false;
      fillShop(state, player);
    } else {
      releaseShop(state, player);
      fillShop(state, player);
    }
    reconcileConditionalMinions(player);
  }
}

export function createGame(
  seed?: number,
  initialHealth = DEFAULT_INITIAL_HEALTH,
): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const normalizedInitialHealth = normalizeInitialHealth(initialHealth);
  const players: PlayerState[] = PLAYER_NAMES.map((name, index) => ({
    id: `player-${index}`,
    name,
    isHuman: index === 0,
    health: normalizedInitialHealth,
    armor: 0,
    alive: true,
    heroPowerId: null,
    tavernTier: 1,
    gold: 3,
    board: [],
    hand: [],
    ghostHand: [],
    pendingSpellcraft: [],
    shop: [],
    spellShop: null,
    additionalSpellShop: [],
    spellOnlyRefreshActive: false,
    frozen: false,
    upgradeDiscount: 0,
    nextTavernSpellDiscount: 0,
    tavernSpellsCastThisTurn: 0,
    cardsPlayedThisTurn: 0,
    goldSpentThisTurn: 0,
    pendingCardPlayed: null,
    lastTavernSpellDefinitionId: null,
    pendingTavernSpellDefinitionId: null,
    demonFodderRefreshQueue: [],
    maxGold: 10,
    pendingNextTurnGold: 0,
    freeRefreshes: 0,
    helpfulRefreshes: 0,
    lastHelpfulRefreshKind: null,
    tavernMinionAttackBonus: 0,
    tavernMinionHealthBonus: 0,
    nextCombatAttackBonus: 0,
    nextCombatHealthBonus: 0,
    nextCombatSetEnemyHealthToOne: 0,
    nextCombatDoubleLeftmostAttack: [],
    nextCombatWinGold: 0,
    nextCombatTieGold: 0,
    nextTurnBoardAttackBonus: 0,
    nextTurnBoardHealthBonus: 0,
    nextTurnBoardBuffPulses: 0,
    tavernBloodGemBarrageCount: 0,
    tavernBloodGemBarrageAttack: 0,
    tavernBloodGemBarrageHealth: 0,
    backToBackBonus: 0,
    tavernSpellAttackBonus: 0,
    tavernSpellHealthBonus: 0,
    tavernTypeBuffs: [],
    tavernTierBuffs: [],
    rideTheWindBuffs: [],
    elementalsPlayedThisTurn: 0,
    nextCombatBeetles: 0,
    beetleAttackBonus: 0,
    beetleHealthBonus: 0,
    ballerAttackBonus: 1,
    ballerHealthBonus: 1,
    deepBlueBonus: 0,
    undeadArmyAttackBonus: 0,
    undeadArmyHealthBonus: 0,
    astralAutomatonsSummoned: 0,
    eternalKnightsDied: 0,
    bloodGemAttack: 1,
    bloodGemHealth: 1,
  }));
  const pool: Record<string, number> = {};
  const spellPool: Record<string, number> = {};
  const state: GameState = {
    version: 11,
    contentVersion: CURRENT_ROSTER_VERSION,
    initialHealth: normalizedInitialHealth,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextInstanceId: 1,
    nextInteractionId: 1,
    phase: "recruit",
    round: 1,
    humanPlayerId: HUMAN_PLAYER_ID,
    activeTribes: [],
    players,
    pool,
    spellPool,
    pendingInteraction: null,
    lastBattle: null,
    lastRoundBattles: [],
    humanScoutingReports: {},
    winnerId: null,
  };
  const shuffledTribes = [...LOBBY_TRIBES];
  shuffleInPlace(state, shuffledTribes);
  const chosenTribes = new Set(shuffledTribes.slice(0, 5));
  state.activeTribes = LOBBY_TRIBES.filter((tribe) =>
    chosenTribes.has(tribe),
  );
  for (const definition of MINION_DEFINITIONS) {
    pool[definition.id] = definitionIsAvailable(
      definition,
      state.activeTribes,
    )
      ? POOL_COPIES_BY_TIER[definition.tier]
      : 0;
  }
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    spellPool[definition.id] =
      tavernSpellIsAvailable(definition, state.activeTribes)
        ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
        : 0;
  }
  for (const player of state.players) {
    fillShop(state, player);
  }
  return state;
}

function reduceGame(
  state: GameState,
  action: GameAction,
  trace?: GameActionTrace,
): GameState {
  if (action.type === "RESOLVE_INTERACTION") {
    const resolved = resolvePendingInteraction(state, action);
    if (resolved !== state && resolved.phase === "recruit") {
      flushPendingSpellcraft(resolved, humanPlayer(resolved));
    }
    if (
      resolved !== state &&
      resolved.pendingInteraction === null &&
      resolved.phase === "recruit"
    ) {
      const player = humanPlayer(resolved);
      resolvePendingStirDeaths(resolved, player);
    }
    return resolved;
  }
  if (state.pendingInteraction !== null) {
    return state;
  }
  const next = cloneState(state);
  if (action.type === "CONTINUE") {
    if (next.phase === "combat") {
      beginNextRecruit(next);
    }
    return next;
  }
  if (next.phase !== "recruit") {
    return state;
  }

  const player = humanPlayer(next);
  if (!player.alive) {
    return state;
  }
  switch (action.type) {
    case "BUY_MINION":
      buyMinion(next, player, action.shopIndex);
      break;
    case "BUY_TAVERN_SPELL":
      buyTavernSpell(next, player, action.spellInstanceId);
      break;
    case "SELL_MINION":
      sellMinion(next, player, action.boardIndex);
      break;
    case "PLAY_MINION":
      playMinion(next, player, action.handIndex, action.boardIndex);
      break;
    case "PLAY_HAND_CARD":
      playHandCard(
        next,
        player,
        action.cardInstanceId,
        action.boardIndex,
      );
      break;
    case "MAGNETIZE_MINION":
      magnetizeMinion(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_BLOOD_GEM":
      castBloodGem(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
        trace,
      );
      break;
    case "CAST_TAVERN_SPELL":
      castTavernSpell(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_SPELLCRAFT":
      castSpellcraft(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "REFRESH_SHOP":
      refreshShop(next, player);
      break;
    case "TOGGLE_FREEZE":
      player.frozen = !player.frozen;
      break;
    case "UPGRADE_TAVERN":
      upgradeTavern(next, player);
      break;
    case "MOVE_MINION": {
      if (
        action.fromIndex >= 0 &&
        action.fromIndex < player.board.length &&
        action.toIndex >= 0 &&
        action.toIndex < player.board.length
      ) {
        const [minion] = player.board.splice(action.fromIndex, 1);
        player.board.splice(action.toIndex, 0, minion);
      }
      break;
    }
    case "END_TURN":
      endTurn(next);
      break;
  }
  if (next.phase === "recruit") {
    flushPendingSpellcraft(next, player);
    reconcileConditionalMinions(player);
  }
  return next;
}

function createGameActionTrace(): GameActionTrace {
  return {
    recruitBloodGemPulses: [],
  };
}

export function gameTransition(
  state: GameState,
  action: GameAction,
): GameTransition {
  const trace = createGameActionTrace();
  return {
    state: reduceGame(state, action, trace),
    trace,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  return reduceGame(state, action);
}
