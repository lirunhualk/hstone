// Explicit `.ts` specifiers keep the pure engine directly runnable by Node
// 24's built-in type stripping as well as by the app's Vite bundler.
import {
  CURRENT_ROSTER_VERSION,
  MINION_DEFINITIONS,
  TIMEWARP_COST_TWO_MINION_DEFINITIONS,
  TIER_SEVEN_MINION_DEFINITIONS,
  TRIBE_NAMES,
  getMinionDefinition,
  isBountyTavernSpellDefinitionId,
} from "./content.ts";
import { getBuddyDefinitionIdForHeroPower } from "./buddies.ts";
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
  CORRUPTED_TOME_CARD_ID,
  DARKMOON_PRIZE_DEFINITIONS,
  TICKATUS_TAG_CARD_ID,
  TRIPLE_PRIZE_DEFINITION,
  TRIPLE_PRIZE_DEFINITION_ID,
  isTierThreeDarkmoonPrizeDefinitionId,
} from "./darkmoon-prizes.ts";
import {
  HERO_OFFER_SIZE,
  createInitialHeroPowerCounters,
  getHeroDefinition,
  getHeroPowerDefinition,
  heroesAvailableForTribes,
  identityEligibleHeroPowers,
} from "./hero-powers.ts";
import {
  GREATER_TRINKET_ROUND,
  LESSER_TRINKET_ROUND,
  SYSTEM_EVENT_DEFINITIONS,
  SYSTEM_TAVERN_SPELL_DEFINITIONS,
  createTrinketAliasDefinitionId,
  getSystemEventDefinition,
  getTrinketAliasKind,
  getTrinketDefinition,
  isSystemTavernSpellDefinitionId,
  trinketsForTier,
  type TrinketDefinition,
} from "./lobby-systems.ts";
import {
  createTrinketOfferWeightContext,
  getEligibleTrinketOfferCandidates,
  pickWeightedTrinketOfferCandidate,
  selectTrinketOffers,
} from "./trinket-offers.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  normalizeInitialHealth,
} from "./setup.ts";
import {
  AI_POLICY_VERSION,
  aiRefreshLimit,
  aiTargetBoardSize,
  getAiStrategyProfile,
  shouldAiUpgrade,
} from "./ai.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  hasAiResidualPolicyOverride,
  resolveAiResidualMacroChoice,
} from "./ai-residual-policy.ts";
import type {
  AvengeEffect,
  ApplyBloodGemsToTribeEffect,
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemBonusKeyword,
  BloodGemSpellInstance,
  BoardMinionInstance,
  BuffThenDamageFriendlyEffect,
  BuffRandomHandMinionEffect,
  BuffEffect,
  CastTavernSpellOnAdjacentEffect,
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
  GainLinkedRandomMinionEffect,
  GainRandomGeneratedMinionEffect,
  GainRandomTavernSpellEffect,
  GainTavernSpellEffect,
  GetRandomMinionEffect,
  GrantKeywordEffect,
  HandCardInstance,
  FriendlyDamageDealtTrigger,
  FriendlyDamagedTrigger,
  FriendlyDeathTrigger,
  HelpfulRefreshKind,
  HeroDefinition,
  HeroPowerDefinition,
  HumanScoutingReport,
  ImproveBeetlesEffect,
  ImproveBloodGemsEffect,
  ImproveElementalStatGrantsEffect,
  ImproveStartOfCombatBuffEffect,
  ImproveUndeadArmyEffect,
  MagneticAttachment,
  MinionTier,
  MinionEffect,
  MinionInstance,
  MinionChoiceId,
  PendingCardPlayedEvent,
  PendingDiscoverInteraction,
  PendingInteraction,
  TavernSpellChoiceId,
  PlayerId,
  PlayerState,
  QueueDemonFodderEffect,
  RecruitBloodGemPulseResolution,
  RallyBuffOneFriendlyPerTribeEffect,
  RallyCastChefsChoiceEffect,
  RallyDamageTargetAndAdjacentEffect,
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
  SummonRandomMinionEffect,
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernTier,
  TriggerAdjacentBattlecriesEffect,
  TrinketTier,
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
  HeroDefinition,
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
  TrinketTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export type { TrinketDefinition } from "./lobby-systems.ts";

export {
  HERO_OFFER_SIZE,
  HERO_POWER_COUNTER_KEYS,
  HERO_DEFINITIONS,
  HERO_POWER_DEFINITIONS,
  getHeroPowerProgressText,
  getHeroDefinition,
  getHeroPowerDefinition,
  heroesAvailableForTribes,
  isHeroDefinitionId,
  isHeroPowerDefinitionId,
} from "./hero-powers.ts";

export {
  ACTIVE_TRINKET_DEFINITIONS,
  GREATER_TRINKET_ROUND,
  LESSER_TRINKET_ROUND,
  SYSTEM_EVENT_DEFINITIONS,
  SYSTEM_TAVERN_SPELL_DEFINITIONS,
  TRINKET_DEFINITIONS,
  areOwnedTrinketDefinitionIdsValid,
  getSystemEventDefinition,
  getTrinketAliasKind,
  getTrinketDefinition,
  isSystemEventDefinitionId,
  isSystemTavernSpellDefinitionId,
  isTrinketDefinitionId,
  trinketsForTier,
} from "./lobby-systems.ts";

export { areTrinketOfferCandidatesValid } from "./trinket-offers.ts";

export {
  AI_STRATEGY_PROFILES,
  aiTargetBoardSize,
  getAiStrategyProfile,
  shouldAiUpgrade,
} from "./ai.ts";

export {
  SPELLCRAFT_DEFINITIONS,
  TRINKET_SPELLCRAFT_DEFINITIONS,
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
  tierSeven: "七星随从",
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
const POOL_COPIES_BY_TIER = [0, 15, 15, 13, 11, 9, 7, 0] as const;
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
export const MAX_BOARD_SIZE = 7;
export const MAX_HAND_SIZE = 10;
const BUY_COST = 3;
const REFRESH_COST = 1;
const MAX_COMBAT_ATTACKS = 100;
const TRIPLE_REWARD_CARD_ID = "TB_BaconShop_Triples_01" as const;
const TRIPLE_REWARD_DEFINITION_ID = "triple-reward" as const;
const BLOOD_GEM_CARD_ID = "BG20_GEM" as const;
const BLOOD_GEM_DEFINITION_ID = "blood-gem" as const;
const FEARLESS_FOODIE_DEFINITION_ID = "BG30_123" as const;
const BUDDING_BOTANIST_DEFINITION_ID = "BG32_237" as const;
const PATIENT_SCOUT_DEFINITION_ID = "BG24_715" as const;
const MALCHEZAAR_DEFINITION_ID = "BG26_524" as const;
const ADAPTABLE_BEETLE_DEFINITION_ID = "BG27_084" as const;
const GEOMAGUS_ROOGUG_DEFINITION_ID = "BG28_583" as const;
const COMPOSER_BRISTLEBACK_DEFINITION_ID = "BG26_157" as const;
const TIDE_RAISER_DEFINITION_ID = "BG34_920" as const;
const BEETLE_TOKEN_DEFINITION_ID = "live-beetle-token" as const;
const DEATHLY_STRIKER_DEFINITION_ID = "BG31_835" as const;
const STITCHED_SALVAGER_DEFINITION_ID = "BG31_999" as const;
const CONSOLATION_COIN_CARD_ID = "BG28_521t" as const;
const CONSOLATION_COIN_DEFINITION_ID = "consolation-coin" as const;
const ASTRAL_AUTOMATON_DEFINITION_ID = "BG_TTN_401" as const;
const ETERNAL_KNIGHT_DEFINITION_ID = "BG25_008" as const;
const FALLING_FLYING_GOLEM_DEFINITION_ID = "BG35_342" as const;
const ANCIENT_SOUL_DEFINITION_ID = "BG34_231" as const;
const ANCIENT_SOUL_DEATHS_REQUIRED = 15;
const UPBEAT_FRONTDRAKE_DEFINITION_ID = "BG26_529" as const;
const UPBEAT_DUO_DEFINITION_ID = "BG26_199" as const;
const HUNGRY_TROG_DEFINITION_ID = "BG35_801" as const;
const CRIMSON_SURVIVOR_DEFINITION_ID = "BG35_814" as const;
const MOONSTEEL_JUGGERNAUT_DEFINITION_ID = "BG31_171" as const;
const FELBOAR_DEFINITION_ID = "BG28_633" as const;
const TIDE_ORACLE_DEFINITION_ID = "BG35_895" as const;
const DARKCREST_STRATEGIST_DEFINITION_ID = "BG31_920" as const;
const MAGICFIN_MYCOLOGIST_DEFINITION_ID = "BG33_891" as const;
const MAGICFIN_APPRENTICE_DEFINITION_ID = "BG33_890t" as const;
const MRRGLTON_DEFINITION_IDS = new Set(["BG35_140", "BG35_141"]);
const DEMON_FODDER_DEFINITION_ID = "live-demon-fodder-token" as const;
const PERIODIC_TURN_COUNTER = "periodicEndOfTurn";
const PURCHASE_PROGRESS_COUNTER = "cardPurchases";
const STONE_AGE_SLAB_PURCHASE_USED_COUNTER =
  "stoneAgeSlabPurchaseUsedThisTurn";
const CONDITIONAL_KEYWORD_TRIGGERED_COUNTER =
  "conditionalKeywordTriggered";
const GOLD_SPEND_PROGRESS_COUNTER = "goldSpendProgress";
const DYNAMIC_END_OF_TURN_ATTACK_COUNTER = "dynamicEndOfTurnAttack";
const DYNAMIC_END_OF_TURN_HEALTH_COUNTER = "dynamicEndOfTurnHealth";
const DYNAMIC_AVENGE_PROGRESS_COUNTER = "dynamicAvengeProgress";
const START_OF_COMBAT_ATTACK_BONUS_COUNTER = "startOfCombatAttackBonus";
const START_OF_COMBAT_HEALTH_BONUS_COUNTER = "startOfCombatHealthBonus";
const SUMMON_ATTACK_GROWTH_COUNTER = "summonAttackGrowth";
const SPELLCRAFT_PERMANENT_CASTS_COUNTER =
  "spellcraftPermanentCastsThisTurn";
const SPELLCRAFT_COPY_USED_COUNTER =
  "spellcraftCopyUsedThisTurn";
const PATIENT_SCOUT_TIER_COUNTER = "patientScoutDiscoverTier";
const HEALTH_REFRESH_USED_COUNTER = "healthRefreshesUsedThisTurn";
const MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER =
  "magneticSatelliteAttackBonus";
const MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER =
  "magneticSatelliteHealthBonus";
const PLAYER_SPELL_PROGRESS_COUNTER = "playerSpellProgress";
const TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER =
  "tavernSpellAuraCardsPlayedThisTurn";
const TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER =
  "tavernSpellAuraAttackBonusThisTurn";
const TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER =
  "tavernSpellAuraHealthBonusThisTurn";
const EVOLVING_SPELLCRAFT_TIER_COUNTER =
  "evolvingSpellcraftRewardTier";
const TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER =
  "tavernSpellPurchasesObservedThisTurn";
const POCKET_FACTORY_TIER_BY_CARD_ID: Readonly<Record<string, TavernTier>> = {
  BG32_MagicItem_361: 4,
  BG32_MagicItem_361t: 5,
};
const INNKEEPERS_HEARTH_CARD_ID = "BG32_MagicItem_362t" as const;
const PAGLES_FISHING_ROD_CARD_ID = "BG30_MagicItem_993" as const;
const MYSTERY_CUBE_CARD_ID = "BG30_MagicItem_703" as const;
const LESSER_KALEIDOSCOPE_CARD_ID = "BG35_MagicItem_821" as const;
const GREATER_KALEIDOSCOPE_CARD_ID = "BG35_MagicItem_821t" as const;
const MIRROR_BOX_CARD_ID = "BG35_MagicItem_817" as const;
const LESSER_OLD_CANDLESTICK_CARD_ID = "BG35_MagicItem_823" as const;
const GREATER_OLD_CANDLESTICK_CARD_ID = "BG35_MagicItem_823t" as const;
const MIRROR_LENS_DEFINITION_ID = "system-spell-mirror-lens" as const;

const NOMI_TAG_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG30_MagicItem_544: { attack: 2, health: 2 },
  BG30_MagicItem_544t: { attack: 5, health: 5 },
};
const COMFORTABLE_COFFIN_ATTACK_BY_CARD_ID: Readonly<
  Record<string, number>
> = {
  BG30_MagicItem_547: 1,
  BG30_MagicItem_547t: 2,
};
const LOREWALKER_SCROLL_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG30_MagicItem_422: { attack: 4, health: 4 },
  BG30_MagicItem_422t: { attack: 10, health: 10 },
};
const MURLOC_MANUAL_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG30_MagicItem_914: { attack: 3, health: 3 },
  BG30_MagicItem_914t: { attack: 6, health: 6 },
};
const BOOTY_BAY_BREW_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG30_MagicItem_924: { attack: 4, health: 3 },
  BG30_MagicItem_924t: { attack: 6, health: 7 },
};
const TRANSCRIPTION_MACHINE_LIMIT_BY_CARD_ID: Readonly<
  Record<string, number>
> = {
  BG35_MagicItem_931: 2,
  BG35_MagicItem_931t: 4,
};
const DRAGONWING_GLIDER_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG30_MagicItem_900: { attack: 4, health: 4 },
};
const SPELL_POWERED_WRENCH_BY_CARD_ID: Readonly<
  Record<string, true>
> = {
  BG32_MagicItem_170: true,
};
const BLOODBOUND_EARRINGS_BY_CARD_ID: Readonly<
  Record<string, { threshold: number; bloodGemsPerMinion: number }>
> = {
  BG32_MagicItem_808: { threshold: 4, bloodGemsPerMinion: 1 },
  BG32_MagicItem_808t: { threshold: 5, bloodGemsPerMinion: 2 },
};
const BEWITCHED_RIBBON_CARD_ID = "BG35_MagicItem_923" as const;
const MAMA_BEAR_STICKER_CARD_ID = "BG35_MagicItem_871" as const;
const RIVENDARE_PORTRAIT_CARD_ID = "BG30_MagicItem_310" as const;
const WICKED_TOME_CARD_ID = "BG32_MagicItem_270t" as const;
const PROTECTIVE_RING_CARD_ID = "BG35_MagicItem_711" as const;
const DRAMALOC_STICKER_CARD_ID = "BG35_MagicItem_754" as const;
const WILDFEATHER_DUSTER_CARD_ID = "BG35_MagicItem_700" as const;
const BLOOD_AMULET_CARD_ID = "BG35_MagicItem_432" as const;
const SCRAPSMITH_PORTRAIT_CARD_ID = "BG35_MagicItem_430" as const;
const TRUSTY_CROWBAR_CARD_ID = "BG35_MagicItem_713" as const;
const BLOODBOUND_RING_CARD_ID = "BG35_MagicItem_435" as const;
const COPPER_COIL_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG35_MagicItem_300: { attack: 1, health: 1 },
  BG35_MagicItem_300t: { attack: 3, health: 2 },
};
const BLUEGILL_FLIPPERS_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG32_MagicItem_893: { attack: 3, health: 3 },
};
const ARCHAIC_SCROLL_THRESHOLD_BY_CARD_ID: Readonly<
  Record<string, number>
> = {
  BG32_MagicItem_930: 7,
};
const RECYCLING_STICKER_REFRESHES_BY_CARD_ID: Readonly<
  Record<string, number>
> = {
  BG32_MagicItem_888: 1,
};
const CURSED_CRYSTAL_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG35_MagicItem_150: { attack: 3, health: 3 },
};
const WATER_WHEEL_LIMIT_BY_CARD_ID: Readonly<Record<string, number>> = {
  BG35_MagicItem_851: 2,
};
const UPSTART_EMBERS_BY_CARD_ID: Readonly<Record<string, true>> = {
  BG35_MagicItem_862: true,
};
const LAVA_LAMP_THRESHOLD_BY_CARD_ID: Readonly<Record<string, number>> = {
  BG30_MagicItem_951: 5,
};
const MINIATURE_SHIP_BUFF_BY_CARD_ID: Readonly<
  Record<string, { attack: number; health: number }>
> = {
  BG35_MagicItem_710: { attack: 2, health: 2 },
};
const REPLICA_CATHEDRAL_CARD_ID = "BG30_MagicItem_434" as const;
const SINSTONE_STICKER_CARD_ID = "BG30_MagicItem_801" as const;
const SPITESCALE_SUSHI_ROLL_CARD_ID = "BG30_MagicItem_920" as const;
const SURVEYOR_PORTRAIT_CARD_ID = "BG30_MagicItem_943" as const;
const REDEEMER_PORTRAIT_CARD_ID = "BG30_MagicItem_944" as const;
const FANCY_SPELLBOOK_CARD_ID = "BG30_MagicItem_999" as const;
const WAR_DRUM_CARD_ID = "BG32_MagicItem_416" as const;
const HEART_OF_THE_FOREST_CARD_ID = "BG32_MagicItem_801t" as const;
const BUBBLE_CROWN_CARD_ID = "BG35_MagicItem_920" as const;
const CORAL_SPEAR_CARD_ID = "BG35_MagicItem_925" as const;
const CHROMATIC_TEAR_CARD_ID = "BG35_MagicItem_840t" as const;
const GOBLIN_WALLET_CARD_ID = "BG30_MagicItem_998" as const;
const TAVERN_FAN_CARD_ID = "BG30_MagicItem_841" as const;
const TIER_SEVEN_TICKET_CARD_ID = "BG30_MagicItem_423" as const;
const TYPED_TAVERN_CARD_ID = "BG30_MagicItem_973" as const;
const GOLDEN_PIRATE_STICKER_CARD_ID = "BG30_MagicItem_439" as const;
const NETHER_PENDANT_CARD_ID = "BG30_MagicItem_541" as const;
const MUTATING_CHEESE_WHEEL_CARD_ID = "BG30_MagicItem_879t" as const;
const GOLDEN_THRESHOLD_CARD_ID = "BG32_MagicItem_350" as const;
const PANPIPES_CARD_ID = "BG32_MagicItem_922" as const;
const STAT_SPELL_DISCOUNT_CARD_ID = "BG35_MagicItem_921" as const;
const WAR_BAND_REFRESH_CARD_ID = "BG35_MagicItem_930" as const;
const MAGNETIC_PRICE_TAG_CARD_ID = "BG35_MagicItem_743" as const;
const GOLDEN_WARBAND_PURCHASE_CARD_ID = "BG32_MagicItem_901" as const;
const REWINDER_PORTRAIT_CARD_ID = "BG30_MagicItem_868" as const;
const FELLEMENTAL_PORTRAIT_CARD_ID = "BG32_MagicItem_830" as const;
const LESSER_DEFILER_PORTRAIT_CARD_ID = "BG35_MagicItem_151" as const;
const GREATER_DEFILER_PORTRAIT_CARD_ID = "BG35_MagicItem_151t" as const;
const ERRGL_STICKER_CARD_ID = "BG35_MagicItem_309" as const;
const BRONZEBEARD_PORTRAIT_CARD_ID = "BG30_MagicItem_418" as const;
const LESSER_COLORFUL_COMPASS_CARD_ID = "BG30_MagicItem_426" as const;
const GREATER_COLORFUL_COMPASS_CARD_ID = "BG30_MagicItem_426t" as const;
const LESSER_UNKNOWN_ORB_CARD_ID = "BG35_MagicItem_816" as const;
const GREATER_UNKNOWN_ORB_CARD_ID = "BG35_MagicItem_816t" as const;
const WISDOMBALL_SUPPLY_CARD_ID = "BG31_MagicItem_903" as const;
const CZARINA_PORTRAIT_CARD_ID = "BG32_MagicItem_283" as const;
const AGGEM_STICKER_CARD_ID = "BG32_MagicItem_284" as const;
const DRAKKARI_PORTRAIT_CARD_ID = "BG32_MagicItem_367" as const;
const PRIVATEER_PORTRAIT_CARD_ID = "BG35_MagicItem_712" as const;
const BALLER_PORTRAIT_CARD_ID = "BG35_MagicItem_861" as const;
const NAZJATAR_POSTCARD_CARD_ID = "BG30_MagicItem_919" as const;
const SHARK_CANNON_CARD_ID = "BG32_MagicItem_232" as const;
const BLESSING_PORTRAIT_CARD_ID = "BG32_MagicItem_894" as const;
const SHAKER_PORTRAIT_CARD_ID = "BG30_MagicItem_828" as const;
const BALLADIST_PORTRAIT_CARD_ID = "BG30_MagicItem_987" as const;
const URZUL_STICKER_CARD_ID = "BG35_MagicItem_154" as const;
const FLAMING_PORTRAIT_CARD_ID = "BG35_MagicItem_156" as const;
const AVALANCHE_STICKER_CARD_ID = "BG35_MagicItem_863" as const;
const GROUNDBREAKER_PORTRAIT_CARD_ID = "BG35_MagicItem_924" as const;
const GUIDING_CANDLE_CARD_ID = "BG32_MagicItem_366" as const;
const ACCORD_O_TRON_PORTRAIT_CARD_ID = "BG35_MagicItem_742" as const;
const HERALD_STICKER_CARD_ID = "BG32_MagicItem_306" as const;
const FANG_ANKLET_CARD_ID = "BG35_MagicItem_701" as const;
const DEATHTOUCH_APPLE_CARD_ID = "BG35_MagicItem_731" as const;
const PILGRIMP_STICKER_CARD_ID = "BG32_MagicItem_821" as const;
const BAZAAR_STICKER_CARD_ID = "BG32_MagicItem_822" as const;
const DEMONIC_TAPESTRY_CARD_ID = "BG35_MagicItem_152" as const;
const EYE_OF_SARGERAS_CARD_ID = "BG30_MagicItem_701" as const;
const DEMONIC_TAPESTRY_HEALTH_PRICE_COUNTER =
  "demonicTapestryHealthPrice";
const CHILLMERE_MOSAIC_COST_COUNTER = "chillmereMosaicCost";
const MAGICFIN_TAG_CARD_ID = "BG35_MagicItem_750" as const;
const SAFE_BADGE_CARD_ID = "BG35_MagicItem_820" as const;
const MECHA_JARAXXUS_STICKER_CARD_ID = "BG30_MagicItem_942" as const;
const LESSER_MAXWELL_STICKER_CARD_ID = "BG35_MagicItem_803" as const;
const GREATER_MAXWELL_STICKER_CARD_ID = "BG35_MagicItem_803t" as const;
const LESSER_JAILER_STICKER_CARD_ID = "BG35_MagicItem_306" as const;
const GREATER_JAILER_STICKER_CARD_ID = "BG35_MagicItem_733" as const;
const OPHIDIAN_STAFF_CARD_ID = "BG35_MagicItem_872" as const;
const CHILLMERE_MOSAIC_CARD_ID = "BG35_MagicItem_755" as const;
const DOUBLE_STITCH_NEEDLE_CARD_ID = "BG35_MagicItem_838" as const;
const TOKEN_OF_OLD_GODS_CARD_ID = "BG30_MagicItem_416" as const;
const PUTRICIDE_STICKER_CARD_ID = "BG32_MagicItem_300" as const;
const PUTRICIDE_CREATION_DEFINITION_ID = "BG25_HERO_100pt" as const;
const THORNED_PAULDRONS_CARD_ID = "BG35_MagicItem_431t" as const;
const MURK_EYE_TAG_CARD_ID = "BG35_MagicItem_752" as const;
const MURKY_TAG_CARD_ID = "BG35_MagicItem_753" as const;
const YOGG_PASTRY_CARD_ID = "BG30_MagicItem_994" as const;
const YOGG_WHEEL_OUTCOMES = [
  "mysteryBoxHeroPower",
  "handOfFate",
  "curseOfFlesh",
  "devouringHunger",
  "rodOfRoasting",
  "goldenMysteryBox",
  "mindflayerGoggles",
] as const;
type YoggWheelOutcome = (typeof YOGG_WHEEL_OUTCOMES)[number];
const YOGG_WHEEL_OUTCOME_NAMES: Readonly<Record<YoggWheelOutcome, string>> = {
  mysteryBoxHeroPower: "神秘魔盒（英雄技能）",
  handOfFate: "命运之手",
  curseOfFlesh: "血肉诅咒",
  devouringHunger: "吞噬之饥",
  rodOfRoasting: "燃烧权杖",
  goldenMysteryBox: "神秘魔盒（金色酒馆随从）",
  mindflayerGoggles: "夺心护目镜",
};
const TRINKET_SPELLCRAFT_DEFINITION_ID_BY_CARD_ID: Readonly<
  Record<string, string>
> = {
  [LESSER_JAILER_STICKER_CARD_ID]:
    "trinket-spellcraft-jailer-sticker-lesser",
  [GREATER_JAILER_STICKER_CARD_ID]:
    "trinket-spellcraft-jailer-sticker-greater",
  [OPHIDIAN_STAFF_CARD_ID]: "trinket-spellcraft-ophidian-staff",
  [CHILLMERE_MOSAIC_CARD_ID]: "trinket-spellcraft-chillmere-mosaic",
  [DOUBLE_STITCH_NEEDLE_CARD_ID]: "trinket-spellcraft-double-stitch",
  [TOKEN_OF_OLD_GODS_CARD_ID]: "trinket-spellcraft-token-of-old-gods",
};
const MONSTROUS_MACAW_PORTRAIT_CARD_ID = "BG32_MagicItem_803" as const;
const FISH_PORTRAIT_CARD_ID = "BG30_MagicItem_821" as const;
const GRIFTER_PORTRAIT_CARD_ID = "BG32_MagicItem_957" as const;
const LEAPFROGGER_PORTRAIT_CARD_ID = "BG35_MagicItem_870" as const;
const MANIPULATOR_PORTRAIT_CARD_ID = "BG30_MagicItem_876" as const;
const BOOMS_MONSTER_PORTRAIT_CARD_ID = "BG32_MagicItem_172" as const;
const POET_PORTRAIT_CARD_ID = "BG32_MagicItem_364" as const;
const CURATOR_STICKER_CARD_ID = "BG32_MagicItem_807" as const;
const MORGL_PORTRAIT_CARD_ID = "BG32_MagicItem_926" as const;
const BEHEMOTH_PORTRAIT_CARD_ID = "BG32_MagicItem_998" as const;
const ANCIENT_WISHBONE_CARD_ID = "BG30_MagicItem_804" as const;
const SOUVENIR_STAND_CARD_ID = "BG30_MagicItem_888" as const;
const TRIP_VOUCHERS_CARD_ID = "BG30_MagicItem_891" as const;
const ORNATE_CLOCK_CARD_ID = "BG32_MagicItem_271" as const;
const MYSTERIOUS_ORB_CARD_ID = "BG35_MagicItem_818" as const;
const RYLAK_PORTRAIT_CARD_ID = "BG35_MagicItem_834" as const;
const TIDE_RAISER_PORTRAIT_CARD_ID = "BG35_MagicItem_922" as const;
const BOOK_OF_MEDIVH_DISCOVERIES_BY_CARD_ID: Readonly<
  Record<string, number>
> = {
  BG30_MagicItem_420: 1,
  BG30_MagicItem_420t: 2,
};
const SOUL_REWINDER_DEFINITION_ID = "BG26_174" as const;
const FELLEMENTAL_DEFINITION_ID = "BG25_041" as const;
const WOODLAND_DEFILER_DEFINITION_ID = "BG35_151" as const;
const BRANN_BRONZEBEARD_DEFINITION_ID = "BG_LOE_077" as const;
const CHARGING_CZARINA_DEFINITION_ID = "BG28_741" as const;
const PROUD_PRIVATEER_DEFINITION_ID = "BG33_825" as const;
const PASSIONATE_SHAKER_DEFINITION_ID = "BG26_505" as const;
const LOVESICK_BALLADIST_DEFINITION_ID = "BG26_814" as const;
const FELFIRE_EXECUTOR_DEFINITION_ID = "BG34_500" as const;
const GROUNDBREAKER_DEFINITION_ID = "BG31_035" as const;
const RYLAK_METALHEAD_DEFINITION_ID = "BG26_801" as const;
const ACCORD_O_TRON_DEFINITION_ID = "BG26_147" as const;
const FISH_DEFINITION_ID = "TB_BaconShop_HP_105t" as const;
const GRIFTER_DEFINITION_ID = "BG31_826" as const;
const LEAPFROGGER_DEFINITION_ID = "BG34_Giant_031" as const;
const MANIPULATOR_DEFINITION_ID = "BG_EX1_564" as const;
const BOOMS_MONSTER_DEFINITION_ID = "BG31_176" as const;
const POET_DEFINITION_ID = "BG34_Giant_314" as const;
const CURATOR_AMALGAM_DEFINITION_ID =
  "TB_BaconShop_HERO_33_Buddy" as const;
const CURATOR_FUSION_MONSTER_DEFINITION_ID =
  "TB_BaconShop_HP_033t" as const;
const MORGL_DEFINITION_ID = "BG27_513" as const;
const BEHEMOTH_DEFINITION_ID = "BG31_360" as const;
const MECHA_JARAXXUS_DEFINITION_IDS = [
  "BG25_807t",
  "BG25_807t2",
  "BG25_807t3",
  "BG25_807t4",
] as const;
const MRRGLTON_PORTRAIT_DEFINITION_IDS = ["BG35_140", "BG35_141"] as const;
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
  /** Living neighbors captured before the complete simultaneous death wave is removed. */
  adjacentInstanceIds?: readonly string[];
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
    ...(minion.deathlyStrikerLineageIds
      ? {
          deathlyStrikerLineageIds: [
            ...minion.deathlyStrikerLineageIds,
          ],
        }
      : {}),
    ...(minion.deathlyStrikerCreatorIds
      ? {
          deathlyStrikerCreatorIds: [
            ...minion.deathlyStrikerCreatorIds,
          ],
        }
      : {}),
    ...(minion.poolCopiesByDefinitionId
      ? {
          poolCopiesByDefinitionId: {
            ...minion.poolCopiesByDefinitionId,
          },
        }
      : {}),
    attachments: minion.attachments.map(cloneMagneticAttachment),
  };
}

function cloneBoard(
  board: readonly BoardMinionInstance[],
): BoardMinionInstance[] {
  return board.map(cloneMinion);
}

function cloneMinionAsGeneratedCopy(
  state: GameState,
  source: BoardMinionInstance,
): BoardMinionInstance {
  const copy = cloneMinion(source);
  copy.instanceId = `minion-${state.nextInstanceId}`;
  state.nextInstanceId += 1;
  copy.poolCopies = 0;
  delete copy.poolCopiesOnPurchase;
  delete copy.poolCopiesByDefinitionId;
  copy.attachments = copy.attachments.map(clearAttachmentPoolCopies);
  return copy;
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

function deathlyStrikerSourceLineage(
  source: MinionInstance,
  component: MinionEffectSource,
): readonly string[] {
  if (
    source.definitionId === DEATHLY_STRIKER_DEFINITION_ID &&
    component.definitionId === DEATHLY_STRIKER_DEFINITION_ID &&
    component.sourceInstanceId === source.instanceId &&
    source.deathlyStrikerLineageIds?.length
  ) {
    return source.deathlyStrikerLineageIds;
  }
  return [component.sourceInstanceId];
}

function minionHasDeathrattle(minion: MinionInstance): boolean {
  return (
    (minion.crabDeathrattles ?? 0) > 0 ||
    (minion.goldenCrabDeathrattles ?? 0) > 0 ||
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
  return definitionMatchesActiveTribes(definition, activeTribes);
}

function definitionMatchesActiveTribes(
  definition: (typeof MINION_DEFINITIONS)[number],
  activeTribes: readonly Tribe[],
): boolean {
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

function buffTavernMinionsThisTurn(
  player: PlayerState,
  attack: number,
  health: number,
): void {
  player.tavernMinionAttackBonusThisTurn += attack;
  player.tavernMinionHealthBonusThisTurn += health;
  for (const minion of player.shop) {
    applyTemporarySpellcraftBuff(minion, attack, health);
  }
}

function buffTavernMinionsPermanently(
  player: PlayerState,
  attack: number,
  health: number,
): void {
  player.tavernMinionAttackBonus += attack;
  player.tavernMinionHealthBonus += health;
  buffMinions(player.shop, attack, health, player.shop);
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

function consumeSafeBadgeForLethalCombatDamage(
  player: PlayerState,
  amount: number,
): TrinketDefinition | null {
  const safeAmount = Math.max(0, amount);
  if (safeAmount <= 0 || safeAmount < player.armor + player.health) {
    return null;
  }
  const badge = playerTrinkets(player).find(
    (trinket) =>
      trinket.cardId === SAFE_BADGE_CARD_ID &&
      (player.trinketCounters[trinket.id] ?? 0) > 0,
  );
  if (!badge) {
    return null;
  }
  player.trinketCounters[badge.id] = 0;
  return badge;
}

/**
 * Recruit-phase self damage uses one shared event path. Soul Rewinder restores
 * the exact pre-damage Armor/Health snapshot once, while every live copy still
 * receives its own permanent Health growth.
 */
function damageRecruitPlayer(
  player: PlayerState,
  amount: number,
): HeroDamageResult {
  const damage = damagePlayer(player, amount);
  if (damage.armorAbsorbed + damage.healthDamage <= 0) {
    return damage;
  }
  for (const trinket of playerTrinkets(player)) {
    if (
      trinket.cardId === NETHER_PENDANT_CARD_ID &&
      advanceTrinketCounter(player, trinket, 3)
    ) {
      buffTavernMinionsPermanently(player, 1, 1);
    }
  }
  const observers: Array<{
    source: BoardMinionInstance;
    attack: number;
    health: number;
    tavernAttackThisTurn: number;
    tavernHealthThisTurn: number;
  }> = [];
  for (const source of player.board) {
    for (const component of minionEffectSources(source)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterHeroDamaged;
      if (!trigger) {
        continue;
      }
      observers.push({
        source,
        attack:
          component.definitionId === SOUL_REWINDER_DEFINITION_ID &&
          playerHasTrinketCardId(player, REWINDER_PORTRAIT_CARD_ID)
            ? (trigger.health ?? 0) * (component.golden ? 2 : 1)
            : 0,
        health:
          (trigger.health ?? 0) * (component.golden ? 2 : 1),
        tavernAttackThisTurn:
          (trigger.tavernAttackThisTurn ?? 0) *
          (component.golden ? 2 : 1),
        tavernHealthThisTurn:
          (trigger.tavernHealthThisTurn ?? 0) *
          (component.golden ? 2 : 1),
      });
    }
  }
  if (observers.length === 0) {
    return damage;
  }
  player.armor += damage.armorAbsorbed;
  player.health += damage.healthDamage;
  for (const observer of observers) {
    if (
      observer.attack !== 0 &&
      player.board.some(
        (candidate) =>
          candidate.instanceId === observer.source.instanceId,
      )
    ) {
      observer.source.attack += observer.attack;
      observeRecruitFriendlyAttackGain(
        player,
        observer.source,
        observer.attack,
      );
    }
    if (
      observer.health !== 0 &&
      player.board.some(
        (candidate) =>
          candidate.instanceId === observer.source.instanceId,
      )
    ) {
      observer.source.health += observer.health;
      observeRecruitFriendlyHealthGain(
        player,
        observer.source,
        observer.health,
      );
    }
    if (
      observer.tavernAttackThisTurn !== 0 ||
      observer.tavernHealthThisTurn !== 0
    ) {
      buffTavernMinionsThisTurn(
        player,
        observer.tavernAttackThisTurn,
        observer.tavernHealthThisTurn,
      );
    }
  }
  return { armorAbsorbed: 0, healthDamage: 0 };
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

function heroPowerCounter(
  player: PlayerState,
  key: string,
): number {
  return player.heroPowerCounters[key] ?? 0;
}

function setHeroPowerCounter(
  player: PlayerState,
  key: string,
  value: number,
): void {
  player.heroPowerCounters[key] = Math.max(0, Math.floor(value));
}

function assignHeroPower(
  state: GameState,
  player: PlayerState,
  heroPowerId: string,
  currentRound = state.round,
  grantCurrentTurnRefresh = false,
): void {
  getHeroPowerDefinition(heroPowerId);
  player.heroPowerId = heroPowerId;
  player.heroPowerCounters = createInitialHeroPowerCounters(
    heroPowerId,
  );
  if (playerHasHeroPower(player, "growingTavernSpellBuff")) {
    setHeroPowerCounter(
      player,
      "rakanishuTurns",
      (Math.floor(Math.max(1, currentRound) / 4) + 1) * 4,
    );
  }
  player.heroRefreshAvailable =
    grantCurrentTurnRefresh &&
    playerHasHeroPower(player, "freeRefreshAtTurnStart");
  trimTavernForAssignedHeroPower(state, player);
}

function assignHeroDefinition(
  state: GameState,
  player: PlayerState,
  hero: HeroDefinition,
): void {
  player.heroId = hero.id;
  assignHeroPower(
    state,
    player,
    hero.heroPowerId,
    state.round,
    true,
  );
  if (playerHasHeroPower(player, "bonusStartingHealth")) {
    player.health += 30;
  }
  // createGame fills the first Tavern before the lobby choice resolves, so
  // Ysera's first extra Dragon has to be dealt at hero assignment time.
  if (playerHasHeroPower(player, "extraDragonOnRefresh")) {
    addYseraDragonToTavern(state, player);
  }
}

function playerTrinkets(player: PlayerState): TrinketDefinition[] {
  return player.trinketIds.map(getTrinketDefinition);
}

function playerHasTrinketCardId(
  player: PlayerState,
  cardId: string,
): boolean {
  return playerTrinkets(player).some(
    (definition) => definition.cardId === cardId,
  );
}

function recordBattlecriesTriggered(
  player: PlayerState,
  count: number,
): void {
  if (count <= 0) {
    return;
  }
  player.battlecriesTriggered =
    battlecriesTriggeredThisGame(player) + count;
}

function battlecriesTriggeredThisGame(player: PlayerState): number {
  const count = player.battlecriesTriggered;
  return typeof count === "number" && Number.isFinite(count)
    ? Math.max(0, Math.floor(count))
    : 0;
}

function activateThornedPauldrons(player: PlayerState): void {
  for (const definition of playerTrinkets(player)) {
    if (definition.cardId === THORNED_PAULDRONS_CARD_ID) {
      player.trinketCounters[definition.id] = 1;
    }
  }
}

function resetThornedPauldrons(player: PlayerState): void {
  for (const definition of playerTrinkets(player)) {
    if (definition.cardId === THORNED_PAULDRONS_CARD_ID) {
      player.trinketCounters[definition.id] = 0;
    }
  }
}

function thornedPauldronsBloodGemBonus(
  player: PlayerState,
): { attack: number; health: number } {
  let activeCopies = 0;
  for (const definition of playerTrinkets(player)) {
    if (
      definition.cardId === THORNED_PAULDRONS_CARD_ID &&
      (player.trinketCounters[definition.id] ?? 0) > 0
    ) {
      activeCopies += 1;
    }
  }
  return { attack: activeCopies * 2, health: activeCopies };
}

function heroPowerTriggerMultiplier(player: PlayerState): number {
  const yoggExtraTriggers =
    typeof player.heroPowerExtraTriggers === "number" &&
    Number.isFinite(player.heroPowerExtraTriggers)
      ? Math.max(0, Math.floor(player.heroPowerExtraTriggers))
      : 0;
  return (
    1 +
    (playerHasTrinketCardId(player, ANCIENT_WISHBONE_CARD_ID) ? 1 : 0) +
    yoggExtraTriggers
  );
}

function ancientWishbone(player: PlayerState): TrinketDefinition | null {
  return (
    playerTrinkets(player).find(
      (definition) => definition.cardId === ANCIENT_WISHBONE_CARD_ID,
    ) ?? null
  );
}

function improveFangAnklet(
  player: PlayerState,
): { trinket: TrinketDefinition; nextCombatBuff: number } | null {
  const trinket = playerTrinkets(player).find(
    (definition) => definition.cardId === FANG_ANKLET_CARD_ID,
  );
  if (!trinket) {
    return null;
  }
  const improvements =
    Math.max(
      0,
      Math.floor(player.trinketCounters[trinket.id] ?? 0),
    ) + 1;
  player.trinketCounters[trinket.id] = improvements;
  return { trinket, nextCombatBuff: improvements + 1 };
}

function unusedPerTurnHealthPurchaseTrinket(
  player: PlayerState,
  cardId: typeof PILGRIMP_STICKER_CARD_ID | typeof BAZAAR_STICKER_CARD_ID,
): TrinketDefinition | null {
  return (
    playerTrinkets(player).find(
      (definition) =>
        definition.cardId === cardId &&
        Math.max(
          0,
          Math.floor(player.trinketCounters[definition.id] ?? 0),
        ) < 1,
    ) ?? null
  );
}

function unusedFirstPirateFreeTrinket(
  player: PlayerState,
): TrinketDefinition | null {
  return (
    playerTrinkets(player).find(
      (definition) =>
        definition.cardId === GRIFTER_PORTRAIT_CARD_ID &&
        Math.max(
          0,
          Math.floor(player.trinketCounters[definition.id] ?? 0),
        ) < 1,
    ) ?? null
  );
}

function eyeOfSargerasTrinkets(
  player: PlayerState,
): TrinketDefinition[] {
  return playerTrinkets(player).filter(
    (definition) => definition.cardId === EYE_OF_SARGERAS_CARD_ID,
  );
}

function eyeOfSargerasIsDue(player: PlayerState): boolean {
  return eyeOfSargerasTrinkets(player).some(
    (definition) =>
      Math.max(
        0,
        Math.floor(player.trinketCounters[definition.id] ?? 0),
      ) % 4 ===
      3,
  );
}

function minionHasDemonicTapestryHealthPrice(
  minion: MinionInstance,
): boolean {
  return (
    effectCounter(
      minion,
      DEMONIC_TAPESTRY_HEALTH_PRICE_COUNTER,
      0,
    ) > 0
  );
}

function recordHealthPurchaseTrinketProgress(
  player: PlayerState,
  purchase: "minion" | "tavernSpell",
  minion?: BoardMinionInstance,
  purchaseCurrency: "gold" | "health" = "gold",
): void {
  if (
    purchase === "minion" &&
    purchaseCurrency === "health" &&
    minion &&
    minionHasTribe(minion, "demon")
  ) {
    const pilgrimp = unusedPerTurnHealthPurchaseTrinket(
      player,
      PILGRIMP_STICKER_CARD_ID,
    );
    if (pilgrimp) {
      player.trinketCounters[pilgrimp.id] = 1;
    }
  }
  if (purchase === "tavernSpell" && purchaseCurrency === "health") {
    const bazaar = unusedPerTurnHealthPurchaseTrinket(
      player,
      BAZAAR_STICKER_CARD_ID,
    );
    if (bazaar) {
      player.trinketCounters[bazaar.id] = 1;
    }
  }
  for (const eye of eyeOfSargerasTrinkets(player)) {
    const progress = Math.max(
      0,
      Math.floor(player.trinketCounters[eye.id] ?? 0),
    );
    player.trinketCounters[eye.id] = (progress + 1) % 4;
  }
}

function recordFirstPirateFreeTrinketProgress(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (!minionHasTribe(minion, "pirate")) {
    return;
  }
  const grifter = unusedFirstPirateFreeTrinket(player);
  if (grifter) {
    player.trinketCounters[grifter.id] = 1;
  }
}

export function getTrinketProgressText(
  player: PlayerState,
  definitionId: string,
): string | null {
  if (!player.trinketIds.includes(definitionId)) {
    return null;
  }
  const definition = getTrinketDefinition(definitionId);
  const progress = Math.max(
    0,
    Math.floor(player.trinketCounters[definition.id] ?? 0),
  );
  switch (definition.cardId) {
    case PILGRIMP_STICKER_CARD_ID:
      return progress >= 1
        ? "本回合的恶魔生命购买已使用"
        : "本回合还可用生命购买1张恶魔牌";
    case BAZAAR_STICKER_CARD_ID:
      return progress >= 1
        ? "本回合的酒馆法术生命购买已使用"
        : "本回合还可用生命购买1张酒馆法术牌";
    case GRIFTER_PORTRAIT_CARD_ID:
      return progress >= 1
        ? "本回合的免费海盗购买已使用"
        : "本回合购买的第一张海盗免费";
    case DEMONIC_TAPESTRY_CARD_ID:
      return player.shop.some(minionHasDemonicTapestryHealthPrice)
        ? "当前酒馆已有1张最高等级随从改为消耗生命"
        : `再刷新${4 - (progress % 4)}次后触发`;
    case EYE_OF_SARGERAS_CARD_ID: {
      const ordinaryPurchasesRemaining = 3 - (progress % 4);
      return ordinaryPurchasesRemaining === 0
        ? "下一张购买的牌改为消耗生命"
        : `再购买${ordinaryPurchasesRemaining}张牌后，下一张改为消耗生命`;
    }
    case YOGG_PASTRY_CARD_ID: {
      const outcome = YOGG_WHEEL_OUTCOMES[progress - 1];
      return outcome
        ? `上次命运之轮：${YOGG_WHEEL_OUTCOME_NAMES[outcome]}`
        : "命运之轮尚未转动";
    }
    case THORNED_PAULDRONS_CARD_ID:
      return progress > 0
        ? "已触发亡语：鲜血宝石额外获得+2/+1，直到下一场战斗"
        : "触发一个亡语后强化鲜血宝石";
    case MURKY_TAG_CARD_ID: {
      const amount = 1 + battlecriesTriggeredThisGame(player);
      return `本局已触发${amount - 1}次战吼；回合结束增益为+${amount}/+${amount}`;
    }
    default:
      return null;
  }
}

function applyOwnedTrinketMinionOverrides(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (
    minion.definitionId !== BRANN_BRONZEBEARD_DEFINITION_ID ||
    !playerHasTrinketCardId(player, BRONZEBEARD_PORTRAIT_CARD_ID)
  ) {
    return;
  }
  minion.tribes = [
    ...new Set<Tribe>([...minion.tribes, "murloc", "dragon"]),
  ];
}

function trinketsWithEffect(
  player: PlayerState,
  effect: TrinketDefinition["effect"],
): TrinketDefinition[] {
  return playerTrinkets(player).filter(
    (definition) => definition.effect === effect,
  );
}

function ownedTrinketBuffTargets(
  player: PlayerState,
): BoardMinionInstance[] {
  return [
    ...player.board,
    ...player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
  ];
}

function improveUndeadArmyFromTrinket(
  player: PlayerState,
  attack: number,
  health: number,
): void {
  player.undeadArmyAttackBonus += attack;
  player.undeadArmyHealthBonus += health;
  buffMinions(
    ownedTrinketBuffTargets(player).filter((minion) =>
      minionHasTribe(minion, "undead"),
    ),
    attack,
    health,
    player.board,
    player,
  );
}

function addRandomGeneratedMinionAtTier(
  state: GameState,
  player: PlayerState,
  tier: TavernTier,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const candidates = MINION_DEFINITIONS.filter(
    (definition) =>
      definition.tier === tier &&
      definitionIsAvailable(definition, state.activeTribes),
  );
  if (candidates.length === 0) {
    return false;
  }
  addGeneratedMinionCopyToHand(
    state,
    player,
    candidates[randomIndex(state, candidates.length)].id,
  );
  return true;
}

function addRandomTierSevenMinionToHand(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const candidates = TIER_SEVEN_MINION_DEFINITIONS.filter((definition) =>
    definitionMatchesActiveTribes(definition, state.activeTribes),
  );
  if (candidates.length === 0) {
    return false;
  }
  addGeneratedMinionCopyToHand(
    state,
    player,
    candidates[randomIndex(state, candidates.length)].id,
  );
  return true;
}

function addRandomGoldenGeneratedMinionAtTier(
  state: GameState,
  player: PlayerState,
  tier: TavernTier,
): boolean {
  const candidates = MINION_DEFINITIONS.filter(
    (candidate) =>
      candidate.tier === tier &&
      definitionIsAvailable(candidate, state.activeTribes),
  );
  if (candidates.length === 0 || player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const minion = createMinionInstance(
    state,
    candidates[randomIndex(state, candidates.length)].id,
    0,
  );
  makeMinionGoldenPreservingEnchantments(minion);
  minion.grantsTripleReward = false;
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  return addCardToHand(state, player, minion);
}

function applyGoldThresholdTrinket(
  state: GameState,
  player: PlayerState,
): void {
  if (player.gold < 15) {
    return;
  }
  for (const trinket of playerTrinkets(player)) {
    if (
      trinket.cardId !== GOLDEN_THRESHOLD_CARD_ID ||
      (player.trinketCounters[trinket.id] ?? 0) > 0
    ) {
      continue;
    }
    player.trinketCounters[trinket.id] = 1;
    addRandomGoldenGeneratedMinionAtTier(state, player, 5);
  }
}

const CHROMATIC_WHELP_DEFINITION_IDS = [
  "BG34_634t",
  "BG34_635t",
  "BG34_636t",
  "BG34_637t",
  "BG34_638t",
] as const;

function addRandomChromaticWhelps(
  state: GameState,
  player: PlayerState,
  count: number,
): void {
  for (let gained = 0; gained < count; gained += 1) {
    addGeneratedMinionCopyToHand(
      state,
      player,
      CHROMATIC_WHELP_DEFINITION_IDS[
        randomIndex(state, CHROMATIC_WHELP_DEFINITION_IDS.length)
      ],
    );
  }
}

function addGeneratedTavernSpellToHand(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  return addCardToHand(
    state,
    player,
    createTavernSpell(
      state,
      getTavernSpellDefinition(definitionId),
    ),
  );
}

function addRandomBountyToHand(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const candidates = TAVERN_SPELL_DEFINITIONS.filter(
    (candidate) =>
      isBountyTavernSpellDefinitionId(candidate.id) &&
      tavernSpellIsAvailable(candidate, state.activeTribes),
  );
  if (candidates.length === 0) {
    return false;
  }
  return addCardToHand(
    state,
    player,
    createTavernSpell(
      state,
      candidates[randomIndex(state, candidates.length)],
    ),
  );
}

function addRandomMechaJaraxxusMinionsToHand(
  state: GameState,
  player: PlayerState,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    addGeneratedMinionCopyToHand(
      state,
      player,
      MECHA_JARAXXUS_DEFINITION_IDS[
        randomIndex(state, MECHA_JARAXXUS_DEFINITION_IDS.length)
      ],
    );
  }
}

function addCustomizedGeneratedMinionToHand(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  customize: (minion: BoardMinionInstance) => void,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const minion = createMinionInstance(state, definitionId, 0);
  customize(minion);
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  const added = addCardToHand(state, player, minion);
  if (added) {
    resolveTriples(state, player);
  }
  return added;
}

function addCuratorStickerMinionsToHand(
  state: GameState,
  player: PlayerState,
): void {
  addCustomizedGeneratedMinionToHand(
    state,
    player,
    CURATOR_AMALGAM_DEFINITION_ID,
    (minion) => {
      makeMinionGoldenPreservingEnchantments(minion);
      minion.grantsTripleReward = false;
    },
  );
  addCustomizedGeneratedMinionToHand(
    state,
    player,
    CURATOR_FUSION_MONSTER_DEFINITION_ID,
    (minion) => {
      minion.attack = 10;
      minion.health = 10;
      minion.venomous = true;
    },
  );
}

function addRandomSharedPoolMinionToHand(
  state: GameState,
  player: PlayerState,
  matches: (
    definition: (typeof MINION_DEFINITIONS)[number],
  ) => boolean,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const minion = drawMatchingFromPool(
    state,
    player.tavernTier,
    matches,
  );
  if (!minion) {
    return false;
  }
  addDrawnMinionToHand(state, player, minion);
  return true;
}

function addRandomMrrgltonToHand(
  state: GameState,
  player: PlayerState,
): void {
  addGeneratedMinionCopyToHand(
    state,
    player,
    MRRGLTON_PORTRAIT_DEFINITION_IDS[
      randomIndex(state, MRRGLTON_PORTRAIT_DEFINITION_IDS.length)
    ],
  );
}

function addRandomWarbandTypeMinionToHand(
  state: GameState,
  player: PlayerState,
): void {
  const tribe = mostCommonBoardTribe(player);
  addRandomSharedPoolMinionToHand(
    state,
    player,
    (candidate) =>
      tribe === null
        ? (candidate.tribes ??
            (candidate.tribe === "neutral" ? [] : [candidate.tribe]))
            .some((candidateTribe) =>
              state.activeTribes.includes(candidateTribe),
            )
        : definitionHasTribe(candidate, tribe),
  );
}

function addRandomWarbandTypeMinionsToHand(
  state: GameState,
  player: PlayerState,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    addRandomWarbandTypeMinionToHand(state, player);
  }
}

function grantRandomAdditionalTrinket(
  state: GameState,
  player: PlayerState,
  tier: TrinketTier,
): boolean {
  const context = createTrinketOfferWeightContext(
    player.board,
    state.activeTribes,
  );
  const candidates = getEligibleTrinketOfferCandidates(
    trinketsForTier(tier, player.heroPowerId).filter(
      (candidate) => !player.trinketIds.includes(candidate.id),
    ),
    tier,
    context,
  );
  if (candidates.length === 0) {
    return false;
  }
  const choice = pickWeightedTrinketOfferCandidate(
    candidates,
    context,
    () => nextRandom(state),
  );
  return grantTrinketDefinitionWithoutCost(state, player, choice);
}

function makeRandomLowTierFriendlyGolden(
  state: GameState,
  player: PlayerState,
): boolean {
  const candidates = player.board.filter(
    (minion) => !minion.golden && minion.tier <= 4,
  );
  if (candidates.length === 0) {
    return false;
  }
  const target = candidates[randomIndex(state, candidates.length)];
  makeMinionGoldenPreservingEnchantments(target);
  reconcileWhereverMinion(
    target,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(target, player);
  return true;
}

function addRandomFriendlyPlainCopy(
  state: GameState,
  player: PlayerState,
): void {
  if (player.board.length === 0 || player.hand.length >= MAX_HAND_SIZE) {
    return;
  }
  const selected = player.board[randomIndex(state, player.board.length)];
  addGeneratedMinionCopyToHand(state, player, selected.definitionId);
}

function stealHighestTierTavernCard(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const offers: Array<
    | { kind: "minion"; card: BoardMinionInstance }
    | { kind: "spell"; card: TavernSpellInstance }
  > = [
    ...player.shop.map((card) => ({ kind: "minion" as const, card })),
    ...tavernSpellShopOffers(player).map((card) => ({
      kind: "spell" as const,
      card,
    })),
  ];
  if (offers.length === 0) {
    return false;
  }
  const highestTier = Math.max(...offers.map((offer) => offer.card.tier));
  const candidates = offers.filter(
    (offer) => offer.card.tier === highestTier,
  );
  const selected = candidates[randomIndex(state, candidates.length)];
  if (selected.kind === "minion") {
    const shopIndex = player.shop.findIndex(
      (card) => card.instanceId === selected.card.instanceId,
    );
    if (shopIndex < 0) {
      return false;
    }
    const [stolen] = player.shop.splice(shopIndex, 1);
    addDrawnMinionToHand(state, player, stolen);
    return true;
  }

  state.spellPool[selected.card.definitionId] =
    (state.spellPool[selected.card.definitionId] ?? 0) + 1;
  addCardToHand(state, player, selected.card);
  if (player.spellShop?.instanceId === selected.card.instanceId) {
    player.spellShop = player.additionalSpellShop.shift() ?? null;
  } else {
    player.additionalSpellShop = player.additionalSpellShop.filter(
      (card) => card.instanceId !== selected.card.instanceId,
    );
  }
  return true;
}

const JEWELRY_BOX_BLOOD_GEM_KEYWORDS: readonly BloodGemBonusKeyword[] = [
  "tauntForQuilboar",
  "divineShieldForQuilboar",
  "rebornForQuilboar",
];

function addJewelryBoxBloodGem(
  state: GameState,
  player: PlayerState,
): void {
  const bonusKeyword =
    JEWELRY_BOX_BLOOD_GEM_KEYWORDS[
      randomIndex(state, JEWELRY_BOX_BLOOD_GEM_KEYWORDS.length)
    ];
  addBloodGems(state, player, 1, bonusKeyword);
}

function castRideTheWindFromTrinket(
  state: GameState,
  player: PlayerState,
  effectPulses: number,
): void {
  const definition = getTavernSpellDefinition(
    "tavern-spell-ride-the-wind",
  );
  const spell = createTavernSpell(state, definition);
  const bonusAtCast = recruitTavernSpellBuffBonus(player);
  for (let pulse = 0; pulse < effectPulses; pulse += 1) {
    if (
      !applyTavernSpellEffect(
        state,
        player,
        spell,
        definition,
        undefined,
        bonusAtCast,
      )
    ) {
      throw new Error(
        "Ride the Wind from a Trinket did not finish synchronously",
      );
    }
  }
  recordRecruitTavernSpellCast(state, player, definition.id);
}

function queueBookOfMedivhDiscoveries(
  player: PlayerState,
  definition: TrinketDefinition,
): boolean {
  const discoveries =
    BOOK_OF_MEDIVH_DISCOVERIES_BY_CARD_ID[definition.cardId];
  if (discoveries === undefined) {
    return false;
  }
  const queued = Math.max(
    0,
    Math.floor(player.trinketCounters[definition.id] ?? 0),
  );
  player.trinketCounters[definition.id] = queued + discoveries;
  return true;
}

function flushPendingBookOfMedivhDiscoveries(
  state: GameState,
  player: PlayerState,
): boolean {
  if (state.pendingInteraction !== null) {
    return false;
  }
  for (const definition of playerTrinkets(player)) {
    if (
      BOOK_OF_MEDIVH_DISCOVERIES_BY_CARD_ID[definition.cardId] ===
      undefined
    ) {
      continue;
    }
    const discoveries = Math.max(
      0,
      Math.floor(player.trinketCounters[definition.id] ?? 0),
    );
    if (discoveries === 0) {
      continue;
    }
    player.trinketCounters[definition.id] = 0;
    const started = beginTavernSpellDiscoverInteraction(
      state,
      player,
      definition.id,
      discoveries,
      player.tavernTier,
      definition.id,
    );
    if (!started) {
      player.trinketCounters[definition.id] = discoveries;
    }
    return started;
  }
  return false;
}

function applyRepeatableOfficialTrinketReward(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): boolean {
  switch (definition.cardId) {
    case "BG30_MagicItem_406":
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-slaughter",
      );
      return true;
    case "BG30_MagicItem_430":
      addRandomSharedPoolMinionToHand(
        state,
        player,
        (candidate) =>
          candidate.battlecry !== undefined ||
          candidate.interactiveBattlecry !== undefined ||
          candidate.printedMechanics?.includes("BATTLECRY") === true,
      );
      return true;
    case "BG30_MagicItem_706":
      addRandomFriendlyPlainCopy(state, player);
      return true;
    case "BG32_MagicItem_831":
      addGeneratedMinionCopyToHand(state, player, "BGS_115");
      return true;
    case "BG32_MagicItem_951":
      makeRandomLowTierFriendlyGolden(state, player);
      return true;
    case "BG32_MagicItem_931":
      addRandomSpellcraftSpells(state, player, 3);
      return true;
    case "BG35_MagicItem_301":
      addRandomSharedPoolMinionToHand(
        state,
        player,
        (candidate) =>
          candidate.magnetic !== undefined &&
          definitionHasTribe(candidate, "mech"),
      );
      return true;
    case "BG35_MagicItem_305":
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-clone-horn",
      );
      return true;
    case "BG35_MagicItem_434":
      addJewelryBoxBloodGem(state, player);
      return true;
    case "BG35_MagicItem_840":
      addRandomChromaticWhelps(state, player, 1);
      return true;
    case "BG35_MagicItem_850":
      castRideTheWindFromTrinket(state, player, 1);
      return true;
    case "BG35_MagicItem_890":
      for (let count = 0; count < 2; count += 1) {
        addRandomBountyToHand(state, player);
      }
      return true;
    case AVALANCHE_STICKER_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-stacked-avalanche",
      );
      return true;
    case PUTRICIDE_STICKER_CARD_ID:
      return beginPutricideCustomUndeadCraft(
        state,
        player,
        definition.id,
      );
    default:
      return false;
  }
}

function queueTrinketSpellcraft(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): boolean {
  const definitionId =
    TRINKET_SPELLCRAFT_DEFINITION_ID_BY_CARD_ID[definition.cardId];
  if (!definitionId) {
    return false;
  }
  player.pendingSpellcraft.push({
    sourceInstanceId: `trinket:${definition.id}`,
    sourceTrinketDefinitionId: definition.id,
    definitionId,
    golden: false,
    round: state.round,
  });
  flushPendingSpellcraft(state, player);
  return true;
}

type PutricideComponentSet = "combat" | "utility";

function isPutricideComponentDefinition(
  definition: (typeof MINION_DEFINITIONS)[number],
  player: PlayerState,
): boolean {
  return (
    definition.collectible !== false &&
    (definition.effectSupport ?? "complete") === "complete" &&
    definition.tier <= player.tavernTier &&
    definition.tier <= 6 &&
    definitionHasTribe(definition, "undead") &&
    definition.magnetic === undefined &&
    hasPutricideTransferableComponentEffect(definition) &&
    definition.id !== PUTRICIDE_CREATION_DEFINITION_ID
  );
}

function isPutricideCombatComponent(
  definition: (typeof MINION_DEFINITIONS)[number],
): boolean {
  return (
    (definition.deathrattle?.length ?? 0) > 0 ||
    definition.avenge !== undefined ||
    (definition.rally?.length ?? 0) > 0 ||
    definition.afterFriendlyCombatDied !== undefined ||
    (definition.startOfCombat?.length ?? 0) > 0 ||
    (definition.afterSelfDamaged?.length ?? 0) > 0 ||
    definition.afterAttackKills !== undefined ||
    (definition.afterFriendlyAttacks?.length ?? 0) > 0
  );
}

function hasPutricideTransferableComponentEffect(
  definition: (typeof MINION_DEFINITIONS)[number],
): boolean {
  return (
    isPutricideCombatComponent(definition) ||
    definition.taunt === true ||
    definition.divineShield === true ||
    definition.reborn === true ||
    definition.stealth === true ||
    definition.poisonous === true ||
    definition.venomous === true ||
    definition.windfury === true ||
    definition.cleave === true ||
    (definition.battlecry?.length ?? 0) > 0 ||
    definition.interactiveBattlecry !== undefined ||
    (definition.afterTavernSpellCast?.length ?? 0) > 0 ||
    definition.endOfTurn !== undefined ||
    (definition.startOfTurn?.length ?? 0) > 0 ||
    definition.afterFriendlyPlayed !== undefined ||
    definition.afterCardPlayed !== undefined ||
    definition.afterFriendlySummoned !== undefined ||
    definition.afterFriendlyDied !== undefined ||
    definition.afterFriendlyDamaged !== undefined ||
    definition.afterFriendlyDealsDamage !== undefined ||
    definition.afterGoldSpent !== undefined ||
    definition.aura !== undefined ||
    definition.spellcraft !== undefined
  );
}

function createPutricideComponentOptions(
  state: GameState,
  player: PlayerState,
  componentSet: PutricideComponentSet,
): BoardMinionInstance[] {
  const allCandidates = MINION_DEFINITIONS.filter((definition) =>
    isPutricideComponentDefinition(definition, player),
  );
  const preferred = allCandidates.filter((definition) =>
    componentSet === "combat"
      ? isPutricideCombatComponent(definition)
      : !isPutricideCombatComponent(definition),
  );
  const preferredIds = new Set(preferred.map((definition) => definition.id));
  const candidates = [
    ...preferred,
    ...allCandidates.filter((definition) => !preferredIds.has(definition.id)),
  ];
  const options: BoardMinionInstance[] = [];
  while (candidates.length > 0 && options.length < 3) {
    const preferredRemaining = candidates.filter((definition) =>
      componentSet === "combat"
        ? isPutricideCombatComponent(definition)
        : !isPutricideCombatComponent(definition),
    );
    const drawFrom = preferredRemaining.length > 0
      ? preferredRemaining
      : candidates;
    const selected = drawFrom[randomIndex(state, drawFrom.length)];
    const selectedIndex = candidates.findIndex(
      (definition) => definition.id === selected.id,
    );
    candidates.splice(selectedIndex, 1);
    options.push(createMinionInstance(state, selected.id, 0));
  }
  return options;
}

function playerOwnsPutricideTrinket(
  player: PlayerState,
  definitionId: string,
): boolean {
  if (!player.trinketIds.includes(definitionId)) {
    return false;
  }
  try {
    return getTrinketDefinition(definitionId).cardId === PUTRICIDE_STICKER_CARD_ID;
  } catch {
    return false;
  }
}

function isPutricideComponentDefinitionId(
  player: PlayerState,
  definitionId: string,
): boolean {
  try {
    return isPutricideComponentDefinition(
      getMinionDefinition(definitionId),
      player,
    );
  } catch {
    return false;
  }
}

function refreshPutricideCreationDescription(
  minion: MinionInstance,
): boolean {
  if (minion.definitionId !== PUTRICIDE_CREATION_DEFINITION_ID) {
    return false;
  }
  const components = minion.attachments.slice(0, 2);
  minion.description =
    components.length === 2
      ? `由“${components[0].name}”与“${components[1].name}”制造。${components
          .map((component) => component.description)
          .filter((description) => description.length > 0)
          .join(" ")} 无法三连。`
      : "由两个亡灵组件制造而成。无法三连。";
  return true;
}

function createPutricideCustomUndead(
  state: GameState,
  player: PlayerState,
  firstDefinitionId: string,
  secondDefinitionId: string,
): BoardMinionInstance {
  const first = createMinionInstance(state, firstDefinitionId, 0);
  const second = createMinionInstance(state, secondDefinitionId, 0);
  const creation = createMinionInstance(
    state,
    PUTRICIDE_CREATION_DEFINITION_ID,
    0,
  );
  creation.tier = Math.max(first.tier, second.tier) as MinionTier;
  creation.attack = first.attack + second.attack;
  creation.health = first.health + second.health;
  creation.taunt = first.taunt || second.taunt;
  creation.divineShield = first.divineShield || second.divineShield;
  creation.reborn = first.reborn || second.reborn;
  creation.stealth = first.stealth || second.stealth;
  creation.poisonous = first.poisonous || second.poisonous;
  creation.venomous = first.venomous || second.venomous;
  creation.windfury = first.windfury || second.windfury;
  creation.cleave = first.cleave || second.cleave;
  creation.alwaysAttacksLowestAttack =
    first.alwaysAttacksLowestAttack || second.alwaysAttacksLowestAttack;
  creation.effectCounters = {
    ...(first.effectCounters ?? {}),
    ...(second.effectCounters ?? {}),
  };
  creation.attachments = [
    createMagneticAttachment(first),
    createMagneticAttachment(second),
  ];
  applyOwnedUndeadArmyBonus(player, creation);
  reconcileWhereverMinion(
    creation,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(creation, player);
  return creation;
}

function finishPutricideCustomUndeadCraft(
  state: GameState,
  player: PlayerState,
  firstDefinitionId: string,
  secondDefinitionId: string,
): void {
  const creation = createPutricideCustomUndead(
    state,
    player,
    firstDefinitionId,
    secondDefinitionId,
  );
  addCardToHand(state, player, creation);
}

function beginPutricideSecondComponentInteraction(
  state: GameState,
  player: PlayerState,
  sourceTrinketDefinitionId: string,
  firstComponentDefinitionId: string,
): boolean {
  if (
    !playerOwnsPutricideTrinket(player, sourceTrinketDefinitionId) ||
    (player.isHuman && state.pendingInteraction !== null)
  ) {
    return false;
  }
  const options = createPutricideComponentOptions(state, player, "utility");
  if (options.length !== 3) {
    return false;
  }
  if (!player.isHuman) {
    const selected = bestMinionByScore(player, options);
    finishPutricideCustomUndeadCraft(
      state,
      player,
      firstComponentDefinitionId,
      selected.definitionId,
    );
    return true;
  }
  state.pendingInteraction = {
    kind: "discover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: `putricide:${sourceTrinketDefinitionId}:second`,
    options,
    filter: { maximumTier: player.tavernTier, tribe: "undead" },
    remainingDiscoveries: 1,
    destination: {
      kind: "customUndeadSecond",
      sourceTrinketDefinitionId,
      firstComponentDefinitionId,
    },
    sourceDefinitionId: sourceTrinketDefinitionId,
  };
  return true;
}

function beginPutricideCustomUndeadCraft(
  state: GameState,
  player: PlayerState,
  sourceTrinketDefinitionId: string,
): boolean {
  if (
    !playerOwnsPutricideTrinket(player, sourceTrinketDefinitionId) ||
    (player.isHuman && state.pendingInteraction !== null)
  ) {
    return false;
  }
  const options = createPutricideComponentOptions(state, player, "combat");
  if (options.length !== 3) {
    return false;
  }
  if (!player.isHuman) {
    const selected = bestMinionByScore(player, options);
    return beginPutricideSecondComponentInteraction(
      state,
      player,
      sourceTrinketDefinitionId,
      selected.definitionId,
    );
  }
  state.pendingInteraction = {
    kind: "discover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: `putricide:${sourceTrinketDefinitionId}:first`,
    options,
    filter: { maximumTier: player.tavernTier, tribe: "undead" },
    remainingDiscoveries: 1,
    destination: {
      kind: "customUndeadFirst",
      sourceTrinketDefinitionId,
    },
    sourceDefinitionId: sourceTrinketDefinitionId,
  };
  return true;
}

function grantRandomDarkmoonPrizes(
  state: GameState,
  player: PlayerState,
  count: number,
): void {
  for (
    let prize = 0;
    prize < count && player.hand.length < MAX_HAND_SIZE;
    prize += 1
  ) {
    const definition =
      DARKMOON_PRIZE_DEFINITIONS[
        randomIndex(state, DARKMOON_PRIZE_DEFINITIONS.length)
      ];
    addCardToHand(
      state,
      player,
      createSpellcraftSpell(state, definition),
    );
  }
}

function applyYoggCurseOfFlesh(
  state: GameState,
  player: PlayerState,
): void {
  if (player.board.length < 2) {
    return;
  }
  const targetIndex = randomIndex(state, player.board.length);
  const sourceOffset = randomIndex(state, player.board.length - 1);
  const sourceIndex =
    sourceOffset >= targetIndex ? sourceOffset + 1 : sourceOffset;
  const target = player.board[targetIndex];
  const source = player.board[sourceIndex];
  buffMinions(
    [target],
    source.attack,
    source.health,
    player.board,
    player,
  );
}

function applyYoggDevouringHunger(
  state: GameState,
  player: PlayerState,
): void {
  const consumed = player.shop.splice(0);
  for (const minion of consumed) {
    if (player.board.length > 0) {
      const target =
        player.board[randomIndex(state, player.board.length)];
      consumeShopMinionInto(state, player, target, minion, 1);
    } else {
      finishConsumedShopMinion(state, player, minion);
    }
  }
  releaseShop(state, player);
  fillShop(state, player);
}

function applyYoggRodOfRoasting(
  state: GameState,
  player: PlayerState,
): void {
  // The two terminating slots are the player's hero and the Bartender. The
  // safety cap is unreachable in normal play but protects deterministic tests
  // from an adversarial RNG stream.
  for (let cast = 0; cast < 100; cast += 1) {
    const minionCount = player.board.length + player.shop.length;
    const targetIndex = randomIndex(state, minionCount + 2);
    if (targetIndex >= minionCount) {
      return;
    }
    if (targetIndex < player.board.length) {
      buffMinions(
        [player.board[targetIndex]],
        10,
        10,
        player.board,
        player,
      );
    } else {
      const shopTarget =
        player.shop[targetIndex - player.board.length];
      buffMinions([shopTarget], 10, 10, player.shop);
    }
  }
}

function applyYoggGoldenMysteryBox(
  state: GameState,
  player: PlayerState,
): void {
  const candidates = player.shop.filter((minion) => !minion.golden);
  if (candidates.length === 0) {
    return;
  }
  const target = candidates[randomIndex(state, candidates.length)];
  makeMinionGoldenPreservingEnchantments(target);
  reconcileWhereverMinion(
    target,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
}

function applyYoggMindflayerGoggles(
  state: GameState,
  player: PlayerState,
): void {
  for (let cast = 0; cast < 4; cast += 1) {
    const definition = randomGeneratedTavernSpellDefinition(state, {
      kind: "gainRandomTavernSpell",
      count: 1,
      filter: {},
    });
    if (!definition) {
      return;
    }
    const targets = tavernSpellNeedsTarget(definition)
      ? tavernSpellLegalTargets(player, definition)
      : [];
    const target =
      targets.length > 0
        ? targets[randomIndex(state, targets.length)]
        : undefined;
    resolveTaughtTavernSpellBattlecryCast(
      state,
      player,
      definition,
      target,
    );
  }
}

function spinYoggWheel(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): YoggWheelOutcome {
  const outcome =
    YOGG_WHEEL_OUTCOMES[
      randomIndex(state, YOGG_WHEEL_OUTCOMES.length)
    ];
  player.trinketCounters[definition.id] =
    YOGG_WHEEL_OUTCOMES.indexOf(outcome) + 1;
  switch (outcome) {
    case "mysteryBoxHeroPower":
      player.heroPowerExtraTriggers =
        (typeof player.heroPowerExtraTriggers === "number" &&
        Number.isFinite(player.heroPowerExtraTriggers)
          ? Math.max(0, Math.floor(player.heroPowerExtraTriggers))
          : 0) + 1;
      break;
    case "handOfFate":
      grantRandomDarkmoonPrizes(state, player, 2);
      break;
    case "curseOfFlesh":
      applyYoggCurseOfFlesh(state, player);
      break;
    case "devouringHunger":
      applyYoggDevouringHunger(state, player);
      break;
    case "rodOfRoasting":
      applyYoggRodOfRoasting(state, player);
      break;
    case "goldenMysteryBox":
      applyYoggGoldenMysteryBox(state, player);
      break;
    case "mindflayerGoggles":
      applyYoggMindflayerGoggles(state, player);
      break;
  }
  return outcome;
}

function applyOfficialTrinketOnAcquire(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): void {
  if (definition.cardId === YOGG_PASTRY_CARD_ID) {
    spinYoggWheel(state, player, definition);
    return;
  }
  if (definition.cardId === TICKATUS_TAG_CARD_ID) {
    player.trinketCounters[definition.id] = 0;
    queueTickatusTagPrize(player);
    flushPendingTickatusTagPrizes(state, player);
    return;
  }
  if (definition.cardId === CORRUPTED_TOME_CARD_ID) {
    if (player.hand.length < MAX_HAND_SIZE) {
      addCardToHand(
        state,
        player,
        createSpellcraftSpell(state, TRIPLE_PRIZE_DEFINITION),
      );
    }
    return;
  }
  if (definition.cardId === MYSTERY_CUBE_CARD_ID) {
    queueMysteryCubeReplacement(player, definition.id);
    flushPendingMysteryCubeReplacements(state, player);
    return;
  }
  const pocketFactoryTier =
    POCKET_FACTORY_TIER_BY_CARD_ID[definition.cardId];
  if (pocketFactoryTier !== undefined) {
    beginDiscoverInteraction(
      state,
      player,
      definition.id,
      { exactTier: pocketFactoryTier, requiresMinionType: true },
      1,
      { kind: "hand", allowOverflow: true },
      undefined,
      {
        kind: "rememberTrinketMinion",
        trinketDefinitionId: definition.id,
      },
      definition.id,
    );
    return;
  }
  if (definition.cardId === INNKEEPERS_HEARTH_CARD_ID) {
    beginDiscoverInteraction(
      state,
      player,
      definition.id,
      { exactTier: 6 },
      2,
      { kind: "hand", allowOverflow: true },
      undefined,
      { kind: "setStats", attack: 30, health: 30 },
      definition.id,
    );
    return;
  }
  if (definition.cardId === PAGLES_FISHING_ROD_CARD_ID) {
    addRandomTierSevenMinionToHand(state, player);
    return;
  }
  if (
    definition.cardId === LESSER_KALEIDOSCOPE_CARD_ID ||
    definition.cardId === GREATER_KALEIDOSCOPE_CARD_ID
  ) {
    beginDiscoverInteraction(
      state,
      player,
      definition.id,
      { exactTier: 7 },
      1,
      {
        kind: "hand",
        playableFromRound: state.round + 2,
        allowOverflow: true,
      },
      undefined,
      definition.cardId === GREATER_KALEIDOSCOPE_CARD_ID
        ? { kind: "makeGolden" }
        : undefined,
      definition.id,
    );
    return;
  }
  if (definition.cardId === MIRROR_BOX_CARD_ID) {
    player.trinketCounters[definition.id] = 0;
    addGeneratedTavernSpellToHand(
      state,
      player,
      MIRROR_LENS_DEFINITION_ID,
    );
    return;
  }
  if (
    definition.cardId === LESSER_OLD_CANDLESTICK_CARD_ID ||
    definition.cardId === GREATER_OLD_CANDLESTICK_CARD_ID
  ) {
    beginTimewarpCandlestickDiscover(state, player, definition);
    return;
  }
  if (queueBookOfMedivhDiscoveries(player, definition)) {
    flushPendingBookOfMedivhDiscoveries(state, player);
    return;
  }
  if (queueTrinketSpellcraft(state, player, definition)) {
    return;
  }
  if (applyRepeatableOfficialTrinketReward(state, player, definition)) {
    return;
  }
  switch (definition.cardId) {
    case MECHA_JARAXXUS_STICKER_CARD_ID:
      addRandomMechaJaraxxusMinionsToHand(state, player, 2);
      break;
    case LESSER_MAXWELL_STICKER_CARD_ID:
    case GREATER_MAXWELL_STICKER_CARD_ID: {
      const buddyDefinitionId = getBuddyDefinitionIdForHeroPower(
        player.heroPowerId,
      );
      if (buddyDefinitionId) {
        addGeneratedMinionCopyToHand(
          state,
          player,
          buddyDefinitionId,
          definition.cardId === GREATER_MAXWELL_STICKER_CARD_ID,
        );
      }
      break;
    }
    case FISH_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, FISH_DEFINITION_ID);
      break;
    case GRIFTER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, GRIFTER_DEFINITION_ID);
      break;
    case LEAPFROGGER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        LEAPFROGGER_DEFINITION_ID,
      );
      break;
    case MANIPULATOR_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        MANIPULATOR_DEFINITION_ID,
      );
      break;
    case BOOMS_MONSTER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        BOOMS_MONSTER_DEFINITION_ID,
      );
      break;
    case POET_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, POET_DEFINITION_ID);
      break;
    case CURATOR_STICKER_CARD_ID:
      addCuratorStickerMinionsToHand(state, player);
      break;
    case MORGL_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, MORGL_DEFINITION_ID);
      break;
    case BEHEMOTH_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, BEHEMOTH_DEFINITION_ID);
      break;
    case SAFE_BADGE_CARD_ID:
      player.gold += 5;
      player.trinketCounters[definition.id] = 1;
      break;
    case ORNATE_CLOCK_CARD_ID:
      player.gold += 2;
      break;
    case MYSTERIOUS_ORB_CARD_ID:
      player.gold += 8;
      player.trinketCounters[definition.id] = 1;
      break;
    case TAVERN_FAN_CARD_ID:
      buffTavernMinionsPermanently(player, 3, 3);
      fillShop(state, player);
      break;
    case GOBLIN_WALLET_CARD_ID:
      player.gold += 2;
      break;
    case NETHER_PENDANT_CARD_ID:
      buffTavernMinionsPermanently(player, 2, 2);
      break;
    case MUTATING_CHEESE_WHEEL_CARD_ID:
      buffTavernMinionsPermanently(player, 2, 2);
      break;
    case GOLDEN_THRESHOLD_CARD_ID:
      applyGoldThresholdTrinket(state, player);
      break;
    case WAR_BAND_REFRESH_CARD_ID:
      player.trinketCounters[definition.id] = 1;
      break;
    case GOLDEN_WARBAND_PURCHASE_CARD_ID:
      player.freeRefreshes += 5;
      player.trinketCounters[definition.id] = 1;
      break;
    case REWINDER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        SOUL_REWINDER_DEFINITION_ID,
      );
      addGeneratedMinionCopyToHand(state, player, "BGS_004");
      break;
    case FELLEMENTAL_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        FELLEMENTAL_DEFINITION_ID,
      );
      break;
    case LESSER_DEFILER_PORTRAIT_CARD_ID:
    case GREATER_DEFILER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        WOODLAND_DEFILER_DEFINITION_ID,
      );
      break;
    case ERRGL_STICKER_CARD_ID:
      addRandomMrrgltonToHand(state, player);
      break;
    case BRONZEBEARD_PORTRAIT_CARD_ID:
      for (const minion of ownedTrinketBuffTargets(player)) {
        applyOwnedTrinketMinionOverrides(player, minion);
      }
      addGeneratedMinionCopyToHand(
        state,
        player,
        BRANN_BRONZEBEARD_DEFINITION_ID,
      );
      addRandomSharedPoolMinionToHand(
        state,
        player,
        (candidate) =>
          candidate.battlecry !== undefined ||
          candidate.interactiveBattlecry !== undefined ||
          candidate.printedMechanics?.includes("BATTLECRY") === true,
      );
      break;
    case LESSER_COLORFUL_COMPASS_CARD_ID:
      addRandomWarbandTypeMinionToHand(state, player);
      break;
    case GREATER_COLORFUL_COMPASS_CARD_ID:
      addRandomWarbandTypeMinionsToHand(state, player, 2);
      break;
    case LESSER_UNKNOWN_ORB_CARD_ID:
      grantRandomAdditionalTrinket(state, player, "lesser");
      break;
    case GREATER_UNKNOWN_ORB_CARD_ID:
      grantRandomAdditionalTrinket(state, player, "greater");
      player.gold += 4;
      break;
    case WISDOMBALL_SUPPLY_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-knockoff-wisdomball",
      );
      break;
    case CZARINA_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        CHARGING_CZARINA_DEFINITION_ID,
      );
      break;
    case PRIVATEER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        PROUD_PRIVATEER_DEFINITION_ID,
      );
      for (let count = 0; count < 2; count += 1) {
        addRandomBountyToHand(state, player);
      }
      break;
    case BALLER_PORTRAIT_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-temperature-shift",
      );
      break;
    case BLESSING_PORTRAIT_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-natural-blessing",
      );
      break;
    case SHAKER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        PASSIONATE_SHAKER_DEFINITION_ID,
      );
      break;
    case BALLADIST_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        LOVESICK_BALLADIST_DEFINITION_ID,
      );
      break;
    case FLAMING_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        FELFIRE_EXECUTOR_DEFINITION_ID,
      );
      break;
    case GROUNDBREAKER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        GROUNDBREAKER_DEFINITION_ID,
      );
      break;
    case RIVENDARE_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, "titus-rivendare");
      break;
    case RYLAK_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        RYLAK_METALHEAD_DEFINITION_ID,
      );
      break;
    case TIDE_RAISER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        TIDE_RAISER_DEFINITION_ID,
      );
      break;
    case SCRAPSMITH_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, "BG24_707");
      break;
    case "BG30_MagicItem_301":
      addGeneratedMinionCopyToHand(state, player, "BG25_008");
      break;
    case "BG30_MagicItem_555":
      addGeneratedMinionCopyToHand(state, player, "BG26_175");
      break;
    case MONSTROUS_MACAW_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, "BGS_078");
      break;
    case "BG30_MagicItem_700":
      beginDiscoverInteraction(
        state,
        player,
        definition.id,
        { ability: "deathrattle" },
        1,
        { kind: "hand", allowOverflow: true },
        undefined,
        undefined,
        definition.id,
      );
      break;
    case SPITESCALE_SUSHI_ROLL_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-slimy-seafood",
      );
      break;
    case SURVEYOR_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, "BG30_121");
      break;
    case REDEEMER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(state, player, "BG28_551");
      break;
    case "BG30_MagicItem_988":
      player.bloodGemAttack += 2;
      player.bloodGemHealth += 1;
      addBloodGems(state, player, 3);
      break;
    case "BG30_MagicItem_988t":
      player.bloodGemAttack += 3;
      player.bloodGemHealth += 3;
      addBloodGems(state, player, 5);
      break;
    case "BG30_MagicItem_989t":
      improveUndeadArmyFromTrinket(player, 15, 0);
      break;
    case "BG32_MagicItem_400":
      transformWarbandIntoRandomTierFourMinions(state, player);
      break;
    case "BG32_MagicItem_817":
      stealHighestTierTavernCard(state, player);
      break;
    case "BG32_MagicItem_844": {
      const removed = player.board.splice(0);
      for (const minion of removed) {
        returnMinionToPool(state, minion);
      }
      player.gold += removed.length * 3;
      break;
    }
    case "BG32_MagicItem_858":
      for (let count = 0; count < 3; count += 1) {
        addRandomGeneratedMinionAtTier(state, player, 4);
      }
      break;
    case HEART_OF_THE_FOREST_CARD_ID:
      player.tavernSpellAttackBonus += 1;
      player.tavernSpellHealthBonus += 1;
      break;
    case "BG35_MagicItem_815":
      for (const tier of [1, 2, 3] as const) {
        for (let count = 0; count < 2; count += 1) {
          addRandomGeneratedMinionAtTier(state, player, tier);
        }
      }
      break;
    case "BG35_MagicItem_740":
      addGeneratedMinionCopyToHand(state, player, "BG35_342");
      break;
    case "BG35_MagicItem_741":
      addGeneratedMinionCopyToHand(state, player, "BG26_149");
      break;
    case CHROMATIC_TEAR_CARD_ID:
      addRandomChromaticWhelps(state, player, 2);
      break;
    case "BG35_MagicItem_850t":
      castRideTheWindFromTrinket(state, player, 4);
      break;
  }
}

function applyOfficialTrinketAtStartOfTurn(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): void {
  if (definition.cardId === YOGG_PASTRY_CARD_ID) {
    spinYoggWheel(state, player, definition);
    return;
  }
  if (
    definition.cardId === TICKATUS_TAG_CARD_ID &&
    advanceTrinketCounter(player, definition, 3)
  ) {
    queueTickatusTagPrize(player);
    flushPendingTickatusTagPrizes(state, player);
    return;
  }
  if (queueBookOfMedivhDiscoveries(player, definition)) {
    return;
  }
  if (queueTrinketSpellcraft(state, player, definition)) {
    return;
  }
  switch (definition.cardId) {
    case MIRROR_BOX_CARD_ID:
      if (advanceTrinketCounter(player, definition, 2)) {
        addGeneratedTavernSpellToHand(
          state,
          player,
          MIRROR_LENS_DEFINITION_ID,
        );
      }
      return;
    case PUTRICIDE_STICKER_CARD_ID: {
      const nextElapsedTurns =
        Math.max(
          0,
          Math.floor(player.trinketCounters[definition.id] ?? 0),
        ) + 1;
      if (nextElapsedTurns < 2) {
        player.trinketCounters[definition.id] = nextElapsedTurns;
        return;
      }
      if (
        beginPutricideCustomUndeadCraft(
          state,
          player,
          definition.id,
        )
      ) {
        player.trinketCounters[definition.id] = 0;
      } else {
        player.trinketCounters[definition.id] = 2;
      }
      return;
    }
    case MECHA_JARAXXUS_STICKER_CARD_ID:
      addRandomMechaJaraxxusMinionsToHand(state, player, 2);
      return;
    case BOOMS_MONSTER_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        BOOMS_MONSTER_DEFINITION_ID,
      );
      return;
    case "BG32_MagicItem_361":
    case "BG32_MagicItem_361t": {
      const selectedDefinitionId = player.trinketSelections[definition.id];
      if (selectedDefinitionId) {
        addGeneratedMinionCopyToHand(
          state,
          player,
          selectedDefinitionId,
        );
      }
      return;
    }
    case PAGLES_FISHING_ROD_CARD_ID:
      addRandomTierSevenMinionToHand(state, player);
      return;
    case TRIP_VOUCHERS_CARD_ID:
      player.trinketCounters[definition.id] = Math.min(
        2,
        Math.max(
          0,
          Math.floor(player.trinketCounters[definition.id] ?? 0),
        ) + 1,
      );
      return;
    case ORNATE_CLOCK_CARD_ID:
      player.trinketCounters[definition.id] = Math.min(
        1,
        Math.max(
          0,
          Math.floor(player.trinketCounters[definition.id] ?? 0),
        ) + 1,
      );
      return;
    case ERRGL_STICKER_CARD_ID:
      addRandomMrrgltonToHand(state, player);
      return;
    case LESSER_COLORFUL_COMPASS_CARD_ID:
      addRandomWarbandTypeMinionToHand(state, player);
      return;
    case GREATER_COLORFUL_COMPASS_CARD_ID:
      addRandomWarbandTypeMinionsToHand(state, player, 2);
      return;
    case WISDOMBALL_SUPPLY_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-knockoff-wisdomball",
      );
      return;
    case PRIVATEER_PORTRAIT_CARD_ID:
      for (let count = 0; count < 2; count += 1) {
        addRandomBountyToHand(state, player);
      }
      return;
    case BLESSING_PORTRAIT_CARD_ID:
      addGeneratedTavernSpellToHand(
        state,
        player,
        "tavern-spell-natural-blessing",
      );
      return;
    case BALLADIST_PORTRAIT_CARD_ID:
      addGeneratedMinionCopyToHand(
        state,
        player,
        LOVESICK_BALLADIST_DEFINITION_ID,
      );
      return;
    case GUIDING_CANDLE_CARD_ID:
      player.trinketCounters[definition.id] = 0;
      return;
  }
  if (definition.cardId === "BG32_MagicItem_428") {
    const elapsedTurns = Math.max(
      0,
      Math.floor(player.trinketCounters[definition.id] ?? 0),
    );
    if (elapsedTurns >= 2) {
      return;
    }
    const nextElapsedTurns = elapsedTurns + 1;
    player.trinketCounters[definition.id] = nextElapsedTurns;
    if (nextElapsedTurns === 2) {
      player.gold += 10;
    }
    return;
  }
  if (definition.cardId === "BG35_MagicItem_305") {
    const nextElapsedTurns =
      Math.max(
        0,
        Math.floor(player.trinketCounters[definition.id] ?? 0),
      ) + 1;
    if (nextElapsedTurns < 2) {
      player.trinketCounters[definition.id] = nextElapsedTurns;
      return;
    }
    player.trinketCounters[definition.id] = 0;
    applyRepeatableOfficialTrinketReward(state, player, definition);
    return;
  }
  if (definition.cardId === "BG30_MagicItem_425") {
    const nextElapsedTurns =
      Math.max(
        0,
        Math.floor(player.trinketCounters[definition.id] ?? 0),
      ) + 1;
    if (nextElapsedTurns < 2) {
      player.trinketCounters[definition.id] = nextElapsedTurns;
      return;
    }
    player.trinketCounters[definition.id] = 0;
    player.gold += 2;
    beginDiscoverInteraction(
      state,
      player,
      definition.id,
      { exactTier: 6 },
      1,
      { kind: "hand", allowOverflow: true },
      undefined,
      undefined,
      definition.id,
    );
    return;
  }
  if (definition.cardId === "BG35_MagicItem_850t") {
    castRideTheWindFromTrinket(state, player, 1);
    castRideTheWindFromTrinket(state, player, 1);
    return;
  }
  applyRepeatableOfficialTrinketReward(state, player, definition);
}

function magnetizeAccordOTronsFromPortrait(
  state: GameState,
  player: PlayerState,
): void {
  const mechs = player.board.filter((minion) =>
    minionHasTribe(minion, "mech"),
  );
  if (mechs.length === 0) {
    return;
  }
  const targets = [...new Map(
    [mechs[0], mechs[mechs.length - 1]].map((minion) => [
      minion.instanceId,
      minion,
    ]),
  ).values()];
  for (const target of targets) {
    const accordOTron = createMinionInstance(
      state,
      ACCORD_O_TRON_DEFINITION_ID,
      0,
    );
    reconcileWhereverMinion(
      accordOTron,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
    refreshDynamicMinionDescription(accordOTron, player);
    fuseMinionIntoHost(state, player, accordOTron, target);
    applyAfterMagnetizedEffects(state, player);
  }
}

function triggerRecruitBattlecryFromTrinket(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  if (!minionHasPrintedBattlecry(target)) {
    return;
  }
  const triggerCount = battlecryTriggerCount(player);
  recordBattlecriesTriggered(player, triggerCount);
  for (let trigger = 0; trigger < triggerCount; trigger += 1) {
    for (const component of minionEffectSources(target)) {
      applyRecruitEffects(
        state,
        player,
        target,
        getMinionDefinition(component.definitionId).battlecry,
        component.golden ? 2 : 1,
        { effectSourceDefinitionId: component.definitionId },
      );
    }
    observeRecruitBattlecryTriggered(player);
  }
}

function applyOfficialTrinketAtEndOfTurn(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
  repetitions: number,
): void {
  if (definition.cardId === MURK_EYE_TAG_CARD_ID) {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const leftmost = player.board[0];
      const rightmost = player.board[player.board.length - 1];
      if (leftmost) {
        triggerRecruitBattlecryFromTrinket(state, player, leftmost);
      }
      if (rightmost) {
        triggerRecruitBattlecryFromTrinket(state, player, rightmost);
      }
    }
    return;
  }
  if (definition.cardId === MURKY_TAG_CARD_ID) {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const amount = 1 + battlecriesTriggeredThisGame(player);
      buffMinions(
        player.board.slice(0, 2),
        amount,
        amount,
        player.board,
        player,
      );
    }
    return;
  }
  if (definition.cardId === PANPIPES_CARD_ID) {
    const amount = 3 + (player.trinketCounters[definition.id] ?? 0);
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const leftmost = player.board[0];
      if (leftmost) {
        buffMinions([leftmost], amount, amount, player.board, player);
      }
    }
    return;
  }
  if (definition.cardId === AGGEM_STICKER_CARD_ID) {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      for (const target of selectDistinctMinionsByTribe(
        state,
        player.board,
      )) {
        for (let gem = 0; gem < 7; gem += 1) {
          if (
            player.board.some(
              (candidate) => candidate.instanceId === target.instanceId,
            )
          ) {
            applyRecruitBloodGemPulse(state, player, target);
          }
        }
      }
    }
    return;
  }
  if (definition.cardId === "BG32_MagicItem_276") {
    improveUndeadArmyFromTrinket(player, 2 * repetitions, 0);
    return;
  }
  if (definition.cardId === "BG32_MagicItem_817") {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      stealHighestTierTavernCard(state, player);
    }
    return;
  }
  if (definition.cardId === ACCORD_O_TRON_PORTRAIT_CARD_ID) {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      magnetizeAccordOTronsFromPortrait(state, player);
    }
  }
}

function applyTrinketDefinitionEffects(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): void {
  switch (definition.effect) {
    case "repeatUpgradeDiscount":
      if (player.tavernTier < 6) {
        player.upgradeDiscount += definition.count ?? 0;
      }
      break;
    case "bobsTipJar":
      player.maxGold += definition.count ?? 0;
      player.gold += definition.count ?? 0;
      break;
    case "freeTavernSpells":
      player.freeTavernSpellPurchases = Math.max(
        player.freeTavernSpellPurchases,
        definition.count ?? 0,
      );
      break;
    case "growingTavernSpellBuff":
      player.tavernSpellAttackBonus += definition.attack ?? 0;
      player.tavernSpellHealthBonus += definition.health ?? 0;
      break;
    case "growMaxGold":
    case "buffAfterPurchase":
    case "goldenizerSupply":
      break;
    case "officialTrinket":
      applyOfficialTrinketOnAcquire(state, player, definition);
      break;
  }
}

function grantTrinketDefinitionWithoutCost(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): boolean {
  if (player.trinketIds.includes(definition.id)) {
    return false;
  }
  player.trinketIds.push(definition.id);
  player.trinketCounters[definition.id] = 0;
  applyTrinketDefinitionEffects(state, player, definition);
  return true;
}

function playerHasRawTrinketOfTier(
  player: PlayerState,
  tier: TrinketTier,
): boolean {
  return player.trinketIds.some(
    (id) => {
      const aliasKind = getTrinketAliasKind(id);
      return (
        (aliasKind === null || aliasKind === "mysteryCubeReplacement") &&
        getTrinketDefinition(id).tier === tier
      );
    },
  );
}

function transformSouvenirStandAfterGreaterPurchase(
  player: PlayerState,
  purchased: TrinketDefinition,
): void {
  if (purchased.tier !== "greater") {
    return;
  }
  const souvenirIndex = player.trinketIds.findIndex(
    (id) => getTrinketDefinition(id).cardId === SOUVENIR_STAND_CARD_ID,
  );
  if (souvenirIndex < 0) {
    return;
  }
  const souvenirId = player.trinketIds[souvenirIndex];
  if (!souvenirId) {
    return;
  }
  const copyId = createTrinketAliasDefinitionId(
    "souvenirCopy",
    purchased.id,
  );
  player.trinketIds[souvenirIndex] = copyId;
  delete player.trinketCounters[souvenirId];
  player.trinketCounters[copyId] = 0;
}

function applyTrinketDefinition(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): boolean {
  if (
    player.trinketIds.includes(definition.id) ||
    playerHasRawTrinketOfTier(player, definition.tier) ||
    player.gold < definition.cost ||
    !spendGold(state, player, definition.cost)
  ) {
    return false;
  }
  const granted = grantTrinketDefinitionWithoutCost(
    state,
    player,
    definition,
  );
  if (granted) {
    transformSouvenirStandAfterGreaterPurchase(player, definition);
  }
  return granted;
}

function replaceTripVouchersWithGreaterTrinket(
  state: GameState,
  player: PlayerState,
  replaceTrinketId: string,
  definition: TrinketDefinition,
): boolean {
  const replaceIndex = player.trinketIds.indexOf(replaceTrinketId);
  if (
    replaceIndex < 0 ||
    getTrinketDefinition(replaceTrinketId).cardId !==
      TRIP_VOUCHERS_CARD_ID ||
    definition.tier !== "greater" ||
    player.gold < definition.cost
  ) {
    return false;
  }
  const replacementId = createTrinketAliasDefinitionId(
    "tripVoucherReplacement",
    definition.id,
  );
  if (
    player.trinketIds.includes(replacementId) ||
    !spendGold(state, player, definition.cost)
  ) {
    return false;
  }
  player.trinketIds[replaceIndex] = replacementId;
  delete player.trinketCounters[replaceTrinketId];
  player.trinketCounters[replacementId] = 0;
  applyTrinketDefinitionEffects(
    state,
    player,
    getTrinketDefinition(replacementId),
  );
  transformSouvenirStandAfterGreaterPurchase(player, definition);
  return true;
}

function grantAdditionalLesserFromMysteriousOrb(
  state: GameState,
  player: PlayerState,
  sourceId: string,
  definition: TrinketDefinition,
): boolean {
  if (
    !player.trinketIds.includes(sourceId) ||
    getTrinketDefinition(sourceId).cardId !== MYSTERIOUS_ORB_CARD_ID ||
    player.trinketCounters[sourceId] !== 1 ||
    definition.tier !== "lesser" ||
    player.trinketIds.includes(definition.id) ||
    player.gold < definition.cost ||
    !spendGold(state, player, definition.cost)
  ) {
    return false;
  }
  player.trinketCounters[sourceId] = 2;
  return grantTrinketDefinitionWithoutCost(state, player, definition);
}

function isMysteryCubeTrinketSlotId(id: string): boolean {
  return (
    getTrinketAliasKind(id) === "mysteryCubeReplacement" ||
    getTrinketDefinition(id).cardId === MYSTERY_CUBE_CARD_ID
  );
}

function queueMysteryCubeReplacement(
  player: PlayerState,
  trinketId: string,
): void {
  if (
    isMysteryCubeTrinketSlotId(trinketId) &&
    player.trinketIds.includes(trinketId) &&
    !player.pendingMysteryCubeReplacementIds.includes(trinketId)
  ) {
    player.pendingMysteryCubeReplacementIds.push(trinketId);
  }
}

function mysteryCubeReplacementOptions(
  state: GameState,
  player: PlayerState,
): TrinketDefinition[] {
  const excludedCardIds = new Set(
    player.trinketIds.map((id) => getTrinketDefinition(id).cardId),
  );
  excludedCardIds.add(MYSTERY_CUBE_CARD_ID);
  const context = createTrinketOfferWeightContext(
    player.board,
    state.activeTribes,
  );
  const eligible = getEligibleTrinketOfferCandidates(
    trinketsForTier("lesser", player.heroPowerId).filter(
      (definition) => !excludedCardIds.has(definition.cardId),
    ),
    "lesser",
    context,
  );
  const selected: TrinketDefinition[] = [];
  while (eligible.length > 0 && selected.length < 2) {
    const choice = pickWeightedTrinketOfferCandidate(
      eligible,
      context,
      () => nextRandom(state),
    );
    selected.push(choice);
    eligible.splice(
      eligible.findIndex((candidate) => candidate.id === choice.id),
      1,
    );
  }
  return selected;
}

function replaceMysteryCubeWithLesserTrinket(
  state: GameState,
  player: PlayerState,
  replaceTrinketId: string,
  definition: TrinketDefinition,
): boolean {
  const replaceIndex = player.trinketIds.indexOf(replaceTrinketId);
  if (
    replaceIndex < 0 ||
    !isMysteryCubeTrinketSlotId(replaceTrinketId) ||
    definition.tier !== "lesser" ||
    definition.cardId === MYSTERY_CUBE_CARD_ID
  ) {
    return false;
  }
  const replacementId = createTrinketAliasDefinitionId(
    "mysteryCubeReplacement",
    definition.id,
  );
  if (player.trinketIds.includes(replacementId)) {
    return false;
  }
  player.trinketIds[replaceIndex] = replacementId;
  delete player.trinketCounters[replaceTrinketId];
  delete player.trinketSelections[replaceTrinketId];
  player.trinketCounters[replacementId] = 0;
  applyTrinketDefinitionEffects(
    state,
    player,
    getTrinketDefinition(replacementId),
  );
  return true;
}

function flushPendingMysteryCubeReplacements(
  state: GameState,
  player: PlayerState,
): boolean {
  if (state.phase !== "recruit" || state.pendingInteraction !== null) {
    return false;
  }
  while (player.pendingMysteryCubeReplacementIds.length > 0) {
    const replaceTrinketId =
      player.pendingMysteryCubeReplacementIds.shift();
    if (
      !replaceTrinketId ||
      !player.trinketIds.includes(replaceTrinketId) ||
      !isMysteryCubeTrinketSlotId(replaceTrinketId)
    ) {
      continue;
    }
    const options = mysteryCubeReplacementOptions(state, player);
    if (options.length < 2) {
      return false;
    }
    if (!player.isHuman) {
      const choice = [...options].sort((left, right) => {
        const scoreDifference =
          trinketAiScore(player, right) - trinketAiScore(player, left);
        return scoreDifference !== 0
          ? scoreDifference
          : left.id.localeCompare(right.id);
      })[0];
      replaceMysteryCubeWithLesserTrinket(
        state,
        player,
        replaceTrinketId,
        choice,
      );
      return true;
    }
    state.pendingInteraction = {
      kind: "trinketChoice",
      interactionId: nextInteractionId(state),
      playerId: player.id,
      sourceInstanceId: `turn-${state.round}-mystery-cube-replacement`,
      trinketTier: "lesser",
      optionIds: options.map((definition) => definition.id),
      replaceTrinketId,
    };
    return true;
  }
  return false;
}

function trinketAiScore(
  player: PlayerState,
  definition: TrinketDefinition,
): number {
  switch (definition.effect) {
    case "repeatUpgradeDiscount":
      return player.tavernTier < 6 ? 18 - player.tavernTier : 2;
    case "growMaxGold":
      return 10;
    case "buffAfterPurchase":
      return 8 + Math.min(7, player.board.length) * 1.5;
    case "goldenizerSupply":
      return 15;
    case "bobsTipJar":
      return 19;
    case "freeTavernSpells":
      return 15 + player.tavernSpellsCastThisTurn;
    case "growingTavernSpellBuff":
      return 14 + player.tavernSpellsCast;
    case "officialTrinket": {
      const matchingMinions = player.board.filter((minion) =>
        definition.associatedTribes.some((tribe) =>
          minionHasTribe(minion, tribe),
        ),
      ).length;
      return 10 + matchingMinions * 2 + Math.max(0, 4 - definition.cost);
    }
  }
}

interface TrinketOfferOptions {
  eligible?: (player: PlayerState) => boolean;
  candidateEligible?: (
    player: PlayerState,
    definition: TrinketDefinition,
  ) => boolean;
  replaceTrinketId?: (player: PlayerState) => string | null;
  additionalTrinketSourceId?: (player: PlayerState) => string | null;
  source: string;
}

function offerTrinkets(
  state: GameState,
  tier: TrinketTier,
  options: TrinketOfferOptions,
): boolean {
  const human = humanPlayer(state);
  const isEligible = options.eligible ?? (() => true);
  const drawOptions = (player: PlayerState): TrinketDefinition[] => {
    const candidates = trinketsForTier(tier, player.heroPowerId);
    return selectTrinketOffers({
      tier,
      candidates: options.candidateEligible
        ? candidates.filter((definition) =>
            options.candidateEligible?.(player, definition),
          )
        : candidates,
      board: player.board,
      activeTribes: state.activeTribes,
      random: () => nextRandom(state),
    });
  };
  const humanOptions = isEligible(human) ? drawOptions(human) : [];
  for (const player of state.players) {
    if (!player.alive || player.isHuman || !isEligible(player)) {
      continue;
    }
    const choice = drawOptions(player)
      .filter((definition) => definition.cost <= player.gold)
      .sort((left, right) => {
        const scoreDifference =
          trinketAiScore(player, right) -
          trinketAiScore(player, left);
        return scoreDifference !== 0
          ? scoreDifference
          : left.id.localeCompare(right.id);
    })[0];
    if (choice) {
      const replaceTrinketId = options.replaceTrinketId?.(player) ?? null;
      const additionalTrinketSourceId =
        options.additionalTrinketSourceId?.(player) ?? null;
      if (replaceTrinketId) {
        replaceTripVouchersWithGreaterTrinket(
          state,
          player,
          replaceTrinketId,
          choice,
        );
      } else if (additionalTrinketSourceId) {
        grantAdditionalLesserFromMysteriousOrb(
          state,
          player,
          additionalTrinketSourceId,
          choice,
        );
      } else {
        applyTrinketDefinition(state, player, choice);
      }
    }
  }
  if (!isEligible(human)) {
    return false;
  }
  const replaceTrinketId = options.replaceTrinketId?.(human) ?? null;
  const additionalTrinketSourceId =
    options.additionalTrinketSourceId?.(human) ?? null;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: nextInteractionId(state),
    playerId: human.id,
    sourceInstanceId: `turn-${state.round}-${options.source}`,
    trinketTier: tier,
    optionIds: humanOptions.map((definition) => definition.id),
    ...(replaceTrinketId ? { replaceTrinketId } : {}),
    ...(additionalTrinketSourceId
      ? { additionalTrinketSourceId }
      : {}),
  };
  return true;
}

function dueTripVouchersId(player: PlayerState): string | null {
  return (
    player.trinketIds.find((id) => {
      const definition = getTrinketDefinition(id);
      return (
        definition.cardId === TRIP_VOUCHERS_CARD_ID &&
        (player.trinketCounters[id] ?? 0) >= 2
      );
    }) ?? null
  );
}

function ornateClockIsDue(player: PlayerState): boolean {
  return (
    !playerHasRawTrinketOfTier(player, "greater") &&
    player.trinketIds.some((id) => {
      const definition = getTrinketDefinition(id);
      return (
        definition.cardId === ORNATE_CLOCK_CARD_ID &&
        (player.trinketCounters[id] ?? 0) >= 1
      );
    })
  );
}

function dueMysteriousOrbId(player: PlayerState): string | null {
  return (
    player.trinketIds.find(
      (id) =>
        getTrinketDefinition(id).cardId === MYSTERIOUS_ORB_CARD_ID &&
        player.trinketCounters[id] === 1,
    ) ?? null
  );
}

function playerHasMysteriousOrb(player: PlayerState): boolean {
  return player.trinketIds.some(
    (id) => getTrinketDefinition(id).cardId === MYSTERIOUS_ORB_CARD_ID,
  );
}

function flushPendingTrinketOffers(state: GameState): void {
  if (
    !state.lobbySystemsEnabled ||
    state.phase !== "recruit" ||
    state.pendingInteraction !== null
  ) {
    return;
  }
  if (state.round === LESSER_TRINKET_ROUND) {
    offerTrinkets(state, "lesser", {
      source: "lesser-trinket-offer",
      eligible: (player) =>
        !playerHasRawTrinketOfTier(player, "lesser"),
    });
    if (state.pendingInteraction !== null) {
      return;
    }
  }
  offerTrinkets(state, "greater", {
    source: "ornate-clock-greater-trinket-offer",
    eligible: ornateClockIsDue,
  });
  if (state.pendingInteraction !== null) {
    return;
  }
  offerTrinkets(state, "greater", {
    source: "trip-vouchers-greater-trinket-offer",
    eligible: (player) => dueTripVouchersId(player) !== null,
    replaceTrinketId: dueTripVouchersId,
  });
  if (state.pendingInteraction !== null) {
    return;
  }
  if (state.round === GREATER_TRINKET_ROUND) {
    offerTrinkets(state, "lesser", {
      source: "mysterious-orb-lesser-trinket-offer",
      eligible: (player) => dueMysteriousOrbId(player) !== null,
      candidateEligible: (player, definition) =>
        !player.trinketIds.includes(definition.id),
      additionalTrinketSourceId: dueMysteriousOrbId,
    });
    if (state.pendingInteraction !== null) {
      return;
    }
    offerTrinkets(state, "greater", {
      source: "greater-trinket-offer",
      eligible: (player) =>
        !playerHasRawTrinketOfTier(player, "greater") &&
        !playerHasMysteriousOrb(player),
    });
  }
}

function applyStartOfTurnTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  player.freeTavernSpellPurchases = 0;
  for (const definition of playerTrinkets(player)) {
    if (
      definition.cardId === PILGRIMP_STICKER_CARD_ID ||
      definition.cardId === BAZAAR_STICKER_CARD_ID ||
      definition.cardId === GRIFTER_PORTRAIT_CARD_ID
    ) {
      player.trinketCounters[definition.id] = 0;
    }
    switch (definition.effect) {
      case "repeatUpgradeDiscount":
        if (player.tavernTier < 6) {
          player.upgradeDiscount += definition.count ?? 0;
        }
        break;
      case "freeTavernSpells":
        player.freeTavernSpellPurchases = Math.max(
          player.freeTavernSpellPurchases,
          definition.count ?? 0,
        );
        break;
      case "growingTavernSpellBuff":
        player.tavernSpellAttackBonus += definition.attack ?? 0;
        player.tavernSpellHealthBonus += definition.health ?? 0;
        break;
      case "growMaxGold":
      case "buffAfterPurchase":
      case "goldenizerSupply":
      case "bobsTipJar":
        break;
      case "officialTrinket":
        applyOfficialTrinketAtStartOfTurn(
          state,
          player,
          definition,
        );
        break;
    }
    if (getTrinketAliasKind(definition.id) === "mysteryCubeReplacement") {
      queueMysteryCubeReplacement(player, definition.id);
    }
  }
  if (!player.isHuman) {
    while (flushPendingMysteryCubeReplacements(state, player)) {
      // AI replaces every due Mystery Cube slot synchronously.
    }
    while (flushPendingBookOfMedivhDiscoveries(state, player)) {
      // AI Discover choices resolve synchronously, so drain both Books.
    }
  }
}

function applyEndOfTurnTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  const triggerCount = endOfTurnTriggerCount(player);
  for (const definition of playerTrinkets(player)) {
    if (definition.effect === "growMaxGold") {
      player.maxGold += (definition.count ?? 0) * triggerCount;
      continue;
    }
    if (definition.effect === "officialTrinket") {
      applyOfficialTrinketAtEndOfTurn(
        state,
        player,
        definition,
        triggerCount,
      );
      continue;
    }
    if (definition.effect !== "goldenizerSupply") {
      continue;
    }
    const requiredTurns = Math.max(1, definition.count ?? 3);
    for (let trigger = 0; trigger < triggerCount; trigger += 1) {
      const progress = (player.trinketCounters[definition.id] ?? 0) + 1;
      if (progress >= requiredTurns) {
        player.trinketCounters[definition.id] = 0;
        grantSystemSpell(state, player, "system-spell-goldenizer");
      } else {
        player.trinketCounters[definition.id] = progress;
      }
    }
  }
}

function applySystemEventAtLobbyStart(state: GameState): void {
  if (!state.systemEventId) {
    return;
  }
  const definition = getSystemEventDefinition(state.systemEventId);
  for (const player of state.players) {
    switch (definition.effect) {
      case "startWithTenGold":
        player.gold = 10;
        break;
      case "startWithGoldenizer":
        grantSystemSpell(state, player, "system-spell-goldenizer");
        break;
      case "goldenArrowEveryThreeTurns":
        break;
    }
  }
}

function applySystemEventAtTurnStart(state: GameState): void {
  if (!state.systemEventId || state.round % 3 !== 0) {
    return;
  }
  const definition = getSystemEventDefinition(state.systemEventId);
  if (definition.effect !== "goldenArrowEveryThreeTurns") {
    return;
  }
  for (const player of state.players) {
    if (player.alive) {
      grantSystemSpell(state, player, "system-spell-golden-arrow");
    }
  }
}

function initialEffectCounters(
  definitionId: string,
): Record<string, number> {
  if (definitionId === PATIENT_SCOUT_DEFINITION_ID) {
    return { [PATIENT_SCOUT_TIER_COUNTER]: 1 };
  }
  if (definitionId === MALCHEZAAR_DEFINITION_ID) {
    return { [HEALTH_REFRESH_USED_COUNTER]: 0 };
  }
  if (definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID) {
    return { [PERIODIC_TURN_COUNTER]: 3 };
  }
  if (definitionId === UPBEAT_DUO_DEFINITION_ID) {
    return { [PERIODIC_TURN_COUNTER]: 2 };
  }
  if (definitionId === HUNGRY_TROG_DEFINITION_ID) {
    return { [PURCHASE_PROGRESS_COUNTER]: 0 };
  }
  if (definitionId === MOONSTEEL_JUGGERNAUT_DEFINITION_ID) {
    return {
      [MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER]: 0,
      [MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER]: 0,
    };
  }
  if (definitionId === FELBOAR_DEFINITION_ID) {
    return { [PLAYER_SPELL_PROGRESS_COUNTER]: 0 };
  }
  if (definitionId === TIDE_ORACLE_DEFINITION_ID) {
    return {
      [TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER]: 0,
      [TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER]: 0,
      [TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER]: 0,
    };
  }
  if (definitionId === DARKCREST_STRATEGIST_DEFINITION_ID) {
    return { [EVOLVING_SPELLCRAFT_TIER_COUNTER]: 1 };
  }
  if (definitionId === MAGICFIN_MYCOLOGIST_DEFINITION_ID) {
    return { [TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER]: 0 };
  }
  if (getMinionDefinition(definitionId).afterMinionPurchased) {
    return { [STONE_AGE_SLAB_PURCHASE_USED_COUNTER]: 0 };
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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: initialEffectCounters(definition.id),
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
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
  if (refreshPutricideCreationDescription(minion)) {
    return;
  }
  const definition = getMinionDefinition(minion.definitionId);
  const printedDescription = minion.golden
    ? goldenMinionDescription(minion.definitionId)
    : definition.description;
  if (definition.battlecryCastsTaughtTavernSpell) {
    const taughtDefinitionId = minion.taughtTavernSpellDefinitionId;
    if (!taughtDefinitionId) {
      minion.description = printedDescription;
      return;
    }
    try {
      const taught = getTavernSpellDefinition(taughtDefinitionId);
      minion.description = `战吼：施放“${taught.name}”。（${taught.description}）`;
    } catch {
      minion.description = printedDescription;
    }
    return;
  }
  const tavernSpellPurchaseTrigger =
    definition.afterTavernSpellPurchased;
  if (tavernSpellPurchaseTrigger) {
    const limit =
      tavernSpellPurchaseTrigger.timesPerTurn *
      (minion.golden &&
      tavernSpellPurchaseTrigger.goldenMode === "doubleLimit"
        ? 2
        : 1);
    const used = Math.min(
      limit,
      Math.max(
        0,
        effectCounter(
          minion,
          TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER,
          0,
        ),
      ),
    );
    const status = `（还剩${Math.max(0, limit - used)}次！）`;
    minion.description = /（还剩\d+次！）/u.test(printedDescription)
      ? printedDescription.replace(/（还剩\d+次！）/u, status)
      : `${printedDescription}${status}`;
    return;
  }
  const playerSpellTrigger = definition.afterPlayerSpellCast;
  if (
    playerSpellTrigger?.kind === "consumeRandomShopMinion" &&
    playerSpellTrigger.spellsRequired > 0
  ) {
    const progress =
      effectCounter(minion, PLAYER_SPELL_PROGRESS_COUNTER, 0) %
      playerSpellTrigger.spellsRequired;
    const status = `（还剩${playerSpellTrigger.spellsRequired - progress}个！）`;
    minion.description = /（还剩\d+个！）/u.test(printedDescription)
      ? printedDescription.replace(/（还剩\d+个！）/u, status)
      : `${printedDescription}${status}`;
    return;
  }
  const auraGrowth = definition.afterCardPlayed?.effects.find(
    (effect) => effect.kind === "improveTavernSpellAuraThisTurn",
  );
  if (
    auraGrowth?.kind === "improveTavernSpellAuraThisTurn" &&
    definition.tavernSpellBuffAura
  ) {
    const scale = minion.golden ? 2 : 1;
    const attack =
      definition.tavernSpellBuffAura.attack * scale +
      effectCounter(
        minion,
        TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
        0,
      ) * scale;
    const health =
      definition.tavernSpellBuffAura.health * scale +
      effectCounter(
        minion,
        TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
        0,
      ) * scale;
    const progress =
      effectCounter(
        minion,
        TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER,
        0,
      ) % auraGrowth.cardsRequired;
    const status = `（还剩${auraGrowth.cardsRequired - progress}张！）`;
    minion.description = printedDescription
      .replace(/\+\d+\/\+\d+/u, `+${attack}/+${health}`)
      .replace(/（还剩\d+张！）/u, status);
    return;
  }
  const spellHistoryBuff = definition.afterCardPlayed?.effects.find(
    (effect) => effect.kind === "buffSelfByPlayerSpellHistory",
  );
  if (
    spellHistoryBuff?.kind === "buffSelfByPlayerSpellHistory" &&
    spellHistoryBuff.spellsPerUpgrade > 0
  ) {
    const castCount = Math.max(0, player?.playerSpellsCast ?? 0);
    const stages = 1 + Math.floor(castCount / spellHistoryBuff.spellsPerUpgrade);
    const scale = minion.golden ? 2 : 1;
    const attack = spellHistoryBuff.attack * scale * stages;
    const health = spellHistoryBuff.health * scale * stages;
    const progress = castCount % spellHistoryBuff.spellsPerUpgrade;
    minion.description = printedDescription
      .replace(/\+\d+\/\+\d+/u, `+${attack}/+${health}`)
      .replace(
        /（.*?施放.*?法术.*?提升！）/u,
        `（施放${progress}/${spellHistoryBuff.spellsPerUpgrade}个法术即可提升！）`,
      );
    return;
  }
  const evolvingRewardTier = definition.spellcraft?.evolvingRewardTier;
  if (evolvingRewardTier) {
    const rewardTier = Math.max(
      evolvingRewardTier.initialTier,
      Math.min(
        evolvingRewardTier.maximumTier,
        effectCounter(
          minion,
          EVOLVING_SPELLCRAFT_TIER_COUNTER,
          evolvingRewardTier.initialTier,
        ),
      ),
    );
    minion.description = printedDescription.replace(
      /等级\d+/gu,
      `等级${rewardTier}`,
    );
    return;
  }
  if (MRRGLTON_DEFINITION_IDS.has(definition.id)) {
    const familyCount = player?.mrrgltonsPlayed ?? 0;
    const amount = (2 + familyCount) * (minion.golden ? 2 : 1);
    minion.description = printedDescription.replace(
      /\+\d+(攻击力|生命值)/u,
      `+${amount}$1`,
    );
    return;
  }
  if (definition.sellDiscover) {
    const discoverTier = Math.max(
      definition.sellDiscover.initialTier,
      Math.min(
        definition.sellDiscover.maximumTier,
        effectCounter(
          minion,
          PATIENT_SCOUT_TIER_COUNTER,
          definition.sellDiscover.initialTier,
        ),
      ),
    );
    minion.description = printedDescription.replace(
      /等级\d+/gu,
      `等级${discoverTier}`,
    );
    return;
  }
  if (definition.healthRefreshesPerTurn) {
    const maximum =
      definition.healthRefreshesPerTurn.count *
      (minion.golden &&
      definition.healthRefreshesPerTurn.goldenMode === "doubleCount"
        ? 2
        : 1);
    const remaining = Math.max(
      0,
      maximum -
        effectCounter(minion, HEALTH_REFRESH_USED_COUNTER, 0),
    );
    const printedDescription = minion.golden
      ? goldenMinionDescription(minion.definitionId)
      : definition.description;
    const status = `（还剩${remaining}次！）`;
    minion.description = /（还剩\d+次！）/u.test(printedDescription)
      ? printedDescription.replace(/（还剩\d+次！）/u, status)
      : `${printedDescription}${status}`;
    return;
  }
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
  if (definition.spellcraftPermanentOnSelf) {
    const limit =
      definition.spellcraftPermanentOnSelf.castsPerTurn *
      (minion.golden ? 2 : 1);
    const remaining = Math.max(
      0,
      limit -
        effectCounter(
          minion,
          SPELLCRAFT_PERMANENT_CASTS_COUNTER,
          0,
        ),
    );
    const printedDescription = minion.golden
      ? goldenMinionDescription(minion.definitionId)
      : definition.description;
    const status = `（还剩${remaining}张！）`;
    minion.description = /（还剩\d+张！）/.test(printedDescription)
      ? printedDescription.replace(/（还剩\d+张！）/, status)
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
  if (
    dynamicEndOfTurn?.kind ===
    "gainUpgradingMagneticSatellites"
  ) {
    const scale =
      minion.golden &&
      dynamicEndOfTurn.goldenMode === "doubleStats"
        ? 2
        : 1;
    const attack =
      dynamicEndOfTurn.attack * scale +
      effectCounter(
        minion,
        MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
        0,
      );
    const health =
      dynamicEndOfTurn.health * scale +
      effectCounter(
        minion,
        MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
        0,
      );
    minion.description =
      `在你的回合结束时，获取两张${attack}/${health}的磁力卫星` +
      "并提升此效果。";
    return;
  }
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
  const minionPurchaseEffect = definition.afterMinionPurchased;
  if (minionPurchaseEffect) {
    const used = effectCounter(
      minion,
      STONE_AGE_SLAB_PURCHASE_USED_COUNTER,
      0,
    );
    const printed = minion.golden
      ? (definition.goldenDescription ?? definition.description)
      : definition.description;
    minion.description =
      used >= minionPurchaseEffect.timesPerTurn
        ? `${printed}（本回合已触发。）`
        : printed;
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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
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
    addCardToHand(
      state,
      player,
      playerHasTrinketCardId(player, CORRUPTED_TOME_CARD_ID)
        ? createSpellcraftSpell(state, TRIPLE_PRIZE_DEFINITION)
        : createTripleRewardSpell(state, player.tavernTier),
    );
  }
}

function bloodGemBonusDescription(
  bonusKeyword: BloodGemBonusKeyword | undefined,
): string {
  switch (bonusKeyword) {
    case "tauntForQuilboar":
      return "如果目标是野猪人，还会使其获得嘲讽。";
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
  rewardTier?: TavernTier,
): SpellcraftSpellInstance {
  const baseDescription =
    golden && definition.goldenDescription
      ? definition.goldenDescription
      : definition.description;
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
      rewardTier === undefined
        ? baseDescription
        : baseDescription.replace(/等级\d+/gu, `等级${rewardTier}`),
    spellFamily: definition.spellFamily ?? "spellcraft",
    target: definition.target,
    effectMultiplier: golden ? 2 : 1,
    ...(rewardTier === undefined ? {} : { rewardTier }),
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

function observeRecruitCardAddedToHand(
  state: GameState,
  player: PlayerState,
  card: HandCardInstance,
): void {
  for (const watcher of [...player.board]) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterCardAddedToHand;
      if (
        !trigger ||
        !player.board.some(
          (candidate) => candidate.instanceId === watcher.instanceId,
        )
      ) {
        continue;
      }
      if (trigger.kind === "buffRandomOtherPirate") {
        const repetitions =
          component.golden && trigger.goldenMode === "repeat" ? 2 : 1;
        for (let repetition = 0; repetition < repetitions; repetition += 1) {
          const candidates = player.board.filter(
            (candidate) =>
              candidate.instanceId !== watcher.instanceId &&
              minionHasTribe(candidate, "pirate"),
          );
          if (candidates.length === 0) {
            break;
          }
          const target = candidates[randomIndex(state, candidates.length)];
          buffMinions(
            [target],
            trigger.attack,
            trigger.health,
            player.board,
            player,
          );
        }
        continue;
      }
      if (
        card.kind !== "minion" ||
        !minionHasTribe(card, trigger.tribe)
      ) {
        continue;
      }
      const sourceScale =
        component.golden && trigger.goldenMode === "doubleStats" ? 2 : 1;
      for (const target of player.board) {
        buffMinions(
          [target],
          (target.golden
            ? trigger.goldenTargetAttack
            : trigger.attack) * sourceScale,
          (target.golden
            ? trigger.goldenTargetHealth
            : trigger.health) * sourceScale,
          player.board,
          player,
        );
      }
    }
  }
  if (
    card.kind === "minion" &&
    minionHasTribe(card, "pirate") &&
    playerOwnsTrinketCardId(player, TRUSTY_CROWBAR_CARD_ID)
  ) {
    const leftmost = player.board[0];
    if (leftmost) {
      buffMinions([leftmost], 12, 12, player.board, player);
    }
  }
}

interface AddCardToHandOptions {
  combatContext?: CombatContext;
  combatOwnerId?: PlayerId;
  combatEvent?: Omit<BattleEvent, "index">;
}

function addCardToHand(
  state: GameState,
  player: PlayerState,
  card: HandCardInstance,
  options: AddCardToHandOptions = {},
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  if (card.kind === "minion") {
    applyOwnedTrinketMinionOverrides(player, card);
  }
  player.hand.push(card);
  if (card.kind === "minion") {
    refreshDynamicMinionDescription(card, player);
  }
  if (
    options.combatContext &&
    options.combatOwnerId !== undefined
  ) {
    if (options.combatEvent) {
      pushBattleEvent(
        options.combatContext.events,
        options.combatEvent,
      );
    }
    observeCombatCardAddedToHand(
      options.combatContext,
      options.combatOwnerId,
      card,
    );
  } else if (state.phase === "recruit") {
    observeRecruitCardAddedToHand(state, player, card);
  }
  return true;
}

function grantSystemSpell(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): boolean {
  const definition = SYSTEM_TAVERN_SPELL_DEFINITIONS.find(
    (candidate) => candidate.id === definitionId,
  );
  if (!definition) {
    throw new Error(`Unknown system spell definition: ${definitionId}`);
  }
  if (player.hand.length >= MAX_HAND_SIZE) {
    player.pendingSystemSpellIds.push(definitionId);
    return false;
  }
  return addCardToHand(
    state,
    player,
    createTavernSpell(state, definition),
  );
}

function flushPendingSystemSpells(
  state: GameState,
  player: PlayerState,
): void {
  if (state.pendingInteraction !== null) {
    return;
  }
  while (
    player.hand.length < MAX_HAND_SIZE &&
    player.pendingSystemSpellIds.length > 0
  ) {
    const definitionId = player.pendingSystemSpellIds.shift();
    if (definitionId) {
      grantSystemSpell(state, player, definitionId);
    }
  }
}

function drawTavernSpell(
  state: GameState,
  tavernTier: TavernTier,
  excludedDefinitionIds: ReadonlySet<string> = new Set(),
  exactTier?: TavernTier,
): TavernSpellInstance | null {
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= tavernTier &&
      (exactTier === undefined || definition.tier === exactTier) &&
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

function reserveTavernSpellDiscoverOptions(
  state: GameState,
  maximumTier: TavernTier,
): TavernSpellInstance[] {
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= maximumTier &&
      tavernSpellIsAvailable(definition, state.activeTribes),
  );
  shuffleInPlace(state, eligible);
  return eligible.slice(0, 3).map((definition) =>
    createTavernSpell(state, definition),
  );
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
  options: AddCardToHandOptions = {},
): number {
  let added = 0;
  for (
    let index = 0;
    index < count && player.hand.length < MAX_HAND_SIZE;
    index += 1
  ) {
    if (addCardToHand(
      state,
      player,
      createBloodGemSpell(state, bonusKeyword),
      options,
    )) {
      added += 1;
    }
  }
  return added;
}

function addConsolationCoin(
  state: GameState,
  player: PlayerState,
  options: AddCardToHandOptions = {},
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  return addCardToHand(
    state,
    player,
    createConsolationCoin(state),
    options,
  );
}

function addRandomSpellcraftSpells(
  state: GameState,
  player: PlayerState,
  count: number,
): number {
  const eligible = SPELLCRAFT_DEFINITIONS.filter(
    (definition) =>
      definition.sourceTier <= player.tavernTier &&
      (!("randomlyGeneratable" in definition) ||
        definition.randomlyGeneratable !== false),
  );
  let added = 0;
  while (
    added < count &&
    player.hand.length < MAX_HAND_SIZE &&
    eligible.length > 0
  ) {
    const definition = eligible[randomIndex(state, eligible.length)];
    if (addCardToHand(
      state,
      player,
      createSpellcraftSpell(state, definition),
    )) {
      added += 1;
    }
  }
  return added;
}

function addGeneratedTargetedSpells(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  count: number,
): number {
  const definition = getSpellcraftDefinition(definitionId);
  let added = 0;
  while (added < count && player.hand.length < MAX_HAND_SIZE) {
    if (addCardToHand(
      state,
      player,
      createSpellcraftSpell(state, definition),
    )) {
      added += 1;
    }
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
  const source = player.board.find(
    (minion) => minion.instanceId === sourceInstanceId,
  );
  const evolvingRewardTier = spellcraft.evolvingRewardTier;
  const rewardTier =
    source && evolvingRewardTier
      ? (Math.max(
          evolvingRewardTier.initialTier,
          Math.min(
            evolvingRewardTier.maximumTier,
            effectCounter(
              source,
              EVOLVING_SPELLCRAFT_TIER_COUNTER,
              evolvingRewardTier.initialTier,
            ),
          ),
        ) as TavernTier)
      : undefined;
  player.pendingSpellcraft.push({
    sourceInstanceId,
    definitionId: spellcraft.definitionId,
    golden: component.golden,
    round: state.round,
    ...(rewardTier === undefined ? {} : { rewardTier }),
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
      if (pending.sourceTrinketDefinitionId !== undefined) {
        if (!player.trinketIds.includes(pending.sourceTrinketDefinitionId)) {
          return false;
        }
        try {
          const source = getTrinketDefinition(
            pending.sourceTrinketDefinitionId,
          );
          return (
            TRINKET_SPELLCRAFT_DEFINITION_ID_BY_CARD_ID[source.cardId] ===
            pending.definitionId
          );
        } catch {
          return false;
        }
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
  if (state.pendingInteraction !== null) {
    return;
  }
  while (
    player.hand.length < MAX_HAND_SIZE &&
    player.pendingSpellcraft.length > 0
  ) {
    const pending = player.pendingSpellcraft.shift();
    if (!pending) {
      break;
    }
    addCardToHand(
      state,
      player,
      createSpellcraftSpell(
        state,
        getSpellcraftDefinition(pending.definitionId),
        pending.golden,
        pending.rewardTier,
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
  player?: PlayerState,
): number {
  const triggeredHealth = healthGainedFromExternalAttack(target, attack);
  target.attack += attack;
  target.health += health + triggeredHealth;
  target.bloodGemAttack += attack;
  target.bloodGemHealth += health;
  reconcileConditionalMinion(target);
  observeRecruitFriendlyAttackGain(player, target, attack);
  return triggeredHealth;
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
  attackBonus?: number;
  bonusKeyword?: BloodGemBonusKeyword;
  healthBonus?: number;
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
  if (bonusKeyword === "tauntForQuilboar") {
    target.taunt = true;
    target.temporaryTaunt = false;
  } else if (bonusKeyword === "rebornForQuilboar") {
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
  const thornedPauldronsBonus = thornedPauldronsBloodGemBonus(player);
  const attackBonus =
    (options.attackBonus ?? 0) + thornedPauldronsBonus.attack;
  const healthBonus =
    (options.healthBonus ?? 0) + thornedPauldronsBonus.health;
  const targetBefore =
    trace && options.origin && options.sourceInstanceId
      ? cloneMinion(target)
      : null;
  const triggeredHealth = applyBloodGemStats(
    target,
    player.bloodGemAttack + attackBonus,
    player.bloodGemHealth + healthBonus,
    player,
  );
  observeRecruitFriendlyHealthGain(
    player,
    target,
    player.bloodGemHealth + healthBonus + triggeredHealth,
  );
  applyBloodGemBonusKeyword(target, options.bonusKeyword);
  triggerRecruitTargetedSpellCast(player, target);
  if (targetBefore && trace && options.origin && options.sourceInstanceId) {
    const gainedKeywords: RecruitBloodGemPulseResolution["gainedKeywords"] =
      [];
    if (!targetBefore.taunt && target.taunt) {
      gainedKeywords.push("taunt");
    }
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
      attackDelta: player.bloodGemAttack + attackBonus,
      healthDelta:
        player.bloodGemHealth + healthBonus + triggeredHealth,
      gainedKeywords,
      targetBefore,
      targetAfter: cloneMinion(target),
    });
  }
  if (options.triggerObservers !== false) {
    triggerRecruitBloodGemObservers(state, player, target, trace);
  }
}

interface TargetedSpellCastTriggerResult {
  changed: boolean;
  permanent: boolean;
}

function applyTargetedSpellCastTrigger(
  target: MinionInstance,
): TargetedSpellCastTriggerResult {
  let hasTrigger = false;
  let permanent = false;
  for (const component of minionEffectSources(target)) {
    const effect = getMinionDefinition(
      component.definitionId,
    ).afterTargetedSpellCast;
    if (effect?.kind !== "gainVenomous") {
      continue;
    }
    hasTrigger = true;
    if (
      component.golden &&
      effect.goldenMode === "permanent"
    ) {
      permanent = true;
    }
  }
  if (!hasTrigger) {
    return { changed: false, permanent: false };
  }

  const wasVenomous = target.venomous;
  const wasTemporary = target.temporaryVenomous === true;
  target.venomous = true;
  if (permanent) {
    target.temporaryVenomous = false;
  } else if (!wasVenomous) {
    target.temporaryVenomous = true;
  }
  return {
    changed:
      target.venomous !== wasVenomous ||
      target.temporaryVenomous !== wasTemporary,
    permanent,
  };
}

function triggerRecruitTargetedSpellCast(
  player: PlayerState,
  target: BoardMinionInstance,
): TargetedSpellCastTriggerResult {
  if (target.health > 0) {
    applyAfterTargetedSpellCastTrinkets(player, target);
  }
  if (
    target.health <= 0 ||
    !player.board.some(
      (candidate) => candidate.instanceId === target.instanceId,
    )
  ) {
    return { changed: false, permanent: false };
  }
  return applyTargetedSpellCastTrigger(target);
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
  if (minion.poolCopiesByDefinitionId) {
    for (const [definitionId, copies] of Object.entries(
      minion.poolCopiesByDefinitionId,
    )) {
      if (copies > 0) {
        state.pool[definitionId] =
          (state.pool[definitionId] ?? 0) + copies;
      }
    }
  } else if (minion.poolCopies > 0) {
    state.pool[minion.definitionId] =
      (state.pool[minion.definitionId] ?? 0) + minion.poolCopies;
  }
  for (const attachment of minion.attachments) {
    returnAttachmentToPool(state, attachment);
  }
}

function claimGeneratedShopMinion(minion: BoardMinionInstance): void {
  if ((minion.poolCopiesOnPurchase ?? 0) > 0) {
    const claimed = minion.poolCopiesOnPurchase ?? 0;
    minion.poolCopies += claimed;
    if (minion.poolCopiesByDefinitionId) {
      minion.poolCopiesByDefinitionId[minion.definitionId] =
        (minion.poolCopiesByDefinitionId[minion.definitionId] ?? 0) +
        claimed;
    }
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
  statGrantBonus: { attack: number; health: number } = {
    attack: 0,
    health: 0,
  },
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
      nestedStats.attack +
      statGrantBonus.attack,
    healthGranted:
      source.health -
      source.temporaryHealth -
      nestedStats.health +
      statGrantBonus.health,
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

function drawTavernMinionFromPool(
  state: GameState,
  player: PlayerState,
): BoardMinionInstance | null {
  const minimumTier = playerHasTrinketCardId(player, GOBLIN_WALLET_CARD_ID)
    ? 3
    : 1;
  return drawMatchingFromPool(
    state,
    player.tavernTier,
    (definition) => definition.tier >= minimumTier,
  );
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

function addExtraTavernMinion(
  state: GameState,
  player: PlayerState,
  maximumTier: TavernTier,
  matches: (
    definition: (typeof MINION_DEFINITIONS)[number],
  ) => boolean,
): boolean {
  const minimumTier = playerHasTrinketCardId(player, GOBLIN_WALLET_CARD_ID)
    ? 3
    : 1;
  const minion = drawMatchingFromPool(
    state,
    maximumTier,
    (definition) => definition.tier >= minimumTier && matches(definition),
  );
  if (!minion) {
    return false;
  }
  applyTavernBonuses(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(minion, player);
  player.shop.push(minion);
  return true;
}

function applyExtraTavernMinionTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  if (playerHasTrinketCardId(player, TIER_SEVEN_TICKET_CARD_ID)) {
    const tier = Math.min(6, player.tavernTier + 1) as TavernTier;
    addExtraTavernMinion(
      state,
      player,
      tier,
      (definition) => definition.tier === tier,
    );
  }
  if (playerHasTrinketCardId(player, TYPED_TAVERN_CARD_ID)) {
    const representedTribes = state.activeTribes.filter((tribe) =>
      player.board.some((minion) => minionHasTribe(minion, tribe)),
    );
    for (let count = 0; count < 2 && representedTribes.length > 0; count += 1) {
      addExtraTavernMinion(
        state,
        player,
        player.tavernTier,
        (definition) =>
          representedTribes.some((tribe) =>
            definitionHasTribe(definition, tribe),
          ),
      );
    }
  }
  if (playerHasTrinketCardId(player, MAGNETIC_PRICE_TAG_CARD_ID)) {
    addExtraTavernMinion(
      state,
      player,
      player.tavernTier,
      (definition) =>
        definition.magnetic !== undefined &&
        definitionHasTribe(definition, "mech"),
    );
  }
}

function addYseraDragonToTavern(
  state: GameState,
  player: PlayerState,
): boolean {
  if (!playerHasHeroPower(player, "extraDragonOnRefresh")) {
    return false;
  }
  let added = false;
  for (
    let trigger = 0;
    trigger < heroPowerTriggerMultiplier(player);
    trigger += 1
  ) {
    const dragon = drawMatchingFromPool(
      state,
      player.tavernTier,
      (definition) => definitionHasTribe(definition, "dragon"),
    );
    if (!dragon) {
      break;
    }
    applyTavernBonuses(player, dragon);
    reconcileWhereverMinion(
      dragon,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
    refreshDynamicMinionDescription(dragon, player);
    player.shop.push(dragon);
    added = true;
  }
  return added;
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

function getRandomMinionMaximumTier(
  player: PlayerState,
  effect: GetRandomMinionEffect,
): TavernTier {
  return effect.maximumTier === "ownerTavern"
    ? player.tavernTier
    : effect.maximumTier;
}

function reserveDiscoverOptions(
  state: GameState,
  filter: DiscoverFilter,
): BoardMinionInstance[] {
  if (filter.exactTier === 7) {
    const candidates = TIER_SEVEN_MINION_DEFINITIONS.filter(
      (definition) =>
        definitionMatchesActiveTribes(definition, state.activeTribes) &&
        (filter.ability !== "battlecry" ||
          definition.printedMechanics?.includes("BATTLECRY") === true) &&
        (filter.ability !== "deathrattle" ||
          definition.printedMechanics?.includes("DEATHRATTLE") === true) &&
        (filter.requiresMinionType !== true ||
          (definition.tribes ??
            (definition.tribe === "neutral" ? [] : [definition.tribe]))
            .length > 0) &&
        (filter.tribe === undefined ||
          definitionHasTribe(definition, filter.tribe)),
    );
    const options: BoardMinionInstance[] = [];
    while (candidates.length > 0 && options.length < 3) {
      const [definition] = candidates.splice(
        randomIndex(state, candidates.length),
        1,
      );
      options.push(createMinionInstance(state, definition.id, 0));
    }
    return options;
  }
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
    if (
      filter.requiresMinionType === true &&
      (definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])).length ===
        0
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
    [minion],
  );
}

function applyCurrentTurnTavernBonuses(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  applyTemporarySpellcraftBuff(
    minion,
    player.tavernMinionAttackBonusThisTurn,
    player.tavernMinionHealthBonusThisTurn,
  );
}

function applyTavernBonuses(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  applyPersistentTavernBonuses(player, minion);
  applyCurrentTurnTavernBonuses(player, minion);
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
  tavernSpellsCast: number,
  deathrattlesTriggered: number,
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
  if (minion.definitionId === FALLING_FLYING_GOLEM_DEFINITION_ID) {
    return minion.golden
      ? {
          attack: deathrattlesTriggered * 8,
          health: deathrattlesTriggered * 4,
        }
      : {
          attack: deathrattlesTriggered * 4,
          health: deathrattlesTriggered * 2,
        };
  }
  const tavernSpellHistoryBuff = getMinionDefinition(
    minion.definitionId,
  ).tavernSpellHistoryBuff;
  if (tavernSpellHistoryBuff) {
    const scale = minion.golden ? 2 : 1;
    return {
      attack: tavernSpellsCast * tavernSpellHistoryBuff.attack * scale,
      health: tavernSpellsCast * tavernSpellHistoryBuff.health * scale,
    };
  }
  return { attack: 0, health: 0 };
}

function reconcileWhereverMinion(
  minion: MinionInstance,
  astralAutomatonsSummoned: number,
  eternalKnightsDied: number,
  tavernSpellsCast = 0,
  deathrattlesTriggered = 0,
  _magnetizationsThisGame = 0,
): { attack: number; health: number } {
  const desired = desiredWhereverBonuses(
    minion,
    astralAutomatonsSummoned,
    eternalKnightsDied,
    tavernSpellsCast,
    deathrattlesTriggered,
  );
  if (
    desired.attack === 0 &&
    desired.health === 0 &&
    minion.whereverAttackBonus === undefined &&
    minion.whereverHealthBonus === undefined
  ) {
    return { attack: 0, health: 0 };
  }
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

function configuredOwnedTrinkets<T>(
  player: PlayerState,
  valuesByCardId: Readonly<Record<string, T>>,
): Array<{ definition: TrinketDefinition; value: T }> {
  const configured: Array<{
    definition: TrinketDefinition;
    value: T;
  }> = [];
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    const value = valuesByCardId[definition.cardId];
    if (value !== undefined) {
      configured.push({ definition, value });
    }
  }
  return configured;
}

function playerOwnsTrinketCardId(
  player: PlayerState,
  cardId: string,
): boolean {
  return player.trinketIds.some(
    (definitionId) => getTrinketDefinition(definitionId).cardId === cardId,
  );
}

function advanceTrinketCounter(
  player: PlayerState,
  definition: TrinketDefinition,
  threshold: number,
): boolean {
  const progress = (player.trinketCounters[definition.id] ?? 0) + 1;
  if (progress < threshold) {
    player.trinketCounters[definition.id] = progress;
    return false;
  }
  player.trinketCounters[definition.id] = 0;
  return true;
}

function consumePerRoundTrinketTrigger(
  player: PlayerState,
  definition: TrinketDefinition,
  round: number,
  limit: number,
): boolean {
  const radix = limit + 1;
  const encoded = player.trinketCounters[definition.id] ?? 0;
  const encodedRound = Math.floor(encoded / radix);
  const used = encodedRound === round ? encoded % radix : 0;
  if (used >= limit) {
    return false;
  }
  player.trinketCounters[definition.id] = round * radix + used + 1;
  return true;
}

function extraFirstSpellCasts(
  state: GameState,
  player: PlayerState,
): number {
  let extraCasts = 0;
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    if (
      definition.cardId === REPLICA_CATHEDRAL_CARD_ID &&
      consumePerRoundTrinketTrigger(player, definition, state.round, 1)
    ) {
      extraCasts += 1;
    }
  }
  return extraCasts;
}

function extraSpellcraftCasts(
  state: GameState,
  player: PlayerState,
): number {
  let extraCasts = extraFirstSpellCasts(state, player);
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    if (
      definition.cardId === SPITESCALE_SUSHI_ROLL_CARD_ID &&
      consumePerRoundTrinketTrigger(player, definition, state.round, 2)
    ) {
      extraCasts += 1;
    }
  }
  return extraCasts;
}

function applyAfterDiscoverTrinkets(
  state: GameState,
  player: PlayerState,
  selectedDefinitionId: string,
): void {
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    if (
      definition.cardId === SINSTONE_STICKER_CARD_ID &&
      consumePerRoundTrinketTrigger(player, definition, state.round, 2)
    ) {
      addGeneratedMinionCopyToHand(state, player, selectedDefinitionId);
    }
  }
}

function battlecryTriggerCountForPlay(
  state: GameState,
  player: PlayerState,
): number {
  let triggerCount = battlecryTriggerCount(player);
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    if (
      definition.cardId === WAR_DRUM_CARD_ID &&
      consumePerRoundTrinketTrigger(player, definition, state.round, 1)
    ) {
      triggerCount += 2;
    }
  }
  return triggerCount;
}

function triggerAfterRecruitSpellcraftCast(
  state: GameState,
  player: PlayerState,
): void {
  const triggerCount = player.trinketIds.reduce(
    (count, definitionId) =>
      count +
      (getTrinketDefinition(definitionId).cardId === CORAL_SPEAR_CARD_ID
        ? 1
        : 0),
    0,
  );
  for (let trigger = 0; trigger < triggerCount; trigger += 1) {
    resolveTriggeredRecruitTavernSpell(
      state,
      player,
      "tavern-spell-might-of-stormwind",
    );
  }
}

function addRandomGeneratedTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const definition = randomGeneratedTavernSpellDefinition(state, {
    kind: "gainRandomTavernSpell",
    count: 1,
    filter: {},
  });
  return definition
    ? addCardToHand(state, player, createTavernSpell(state, definition))
    : false;
}

function playedMinionDefinitionId(
  player: PlayerState,
  event: PendingCardPlayedEvent,
): string | null {
  for (const minion of player.board) {
    const component = minionEffectSources(minion).find(
      (candidate) => candidate.sourceInstanceId === event.sourceInstanceId,
    );
    if (component) {
      return component.definitionId;
    }
  }
  return null;
}

function applyAfterMinionPlayedTrinkets(
  state: GameState,
  player: PlayerState,
  event: PendingCardPlayedEvent,
): void {
  for (const { value } of configuredOwnedTrinkets(
    player,
    DRAGONWING_GLIDER_BUFF_BY_CARD_ID,
  )) {
    const dragons = player.board.filter((minion) =>
      minionHasTribe(minion, "dragon"),
    );
    if (dragons.length > 0) {
      const target = dragons[randomIndex(state, dragons.length)];
      buffMinions(
        [target],
        value.attack,
        value.health,
        player.board,
        player,
      );
    }
  }

  if (event.cardKind !== "minion") {
    return;
  }

  const playedElemental =
    event.tribes.includes("elemental") ||
    event.tribes.includes("all");
  if (playedElemental) {
    for (const { value } of configuredOwnedTrinkets(
      player,
      NOMI_TAG_BUFF_BY_CARD_ID,
    )) {
      applyPersistentTavernTypeBuff(
        player,
        "elemental",
        value.attack,
        value.health,
      );
    }
    for (const { value: refreshes } of configuredOwnedTrinkets(
      player,
      RECYCLING_STICKER_REFRESHES_BY_CARD_ID,
    )) {
      player.freeRefreshes += refreshes;
    }
    for (const { definition, value: limit } of configuredOwnedTrinkets(
      player,
      WATER_WHEEL_LIMIT_BY_CARD_ID,
    )) {
      if (
        consumePerRoundTrinketTrigger(
          player,
          definition,
          state.round,
          limit,
        )
      ) {
        addRandomGeneratedTavernSpell(state, player);
      }
    }
    for (const definitionId of player.trinketIds) {
      const trinket = getTrinketDefinition(definitionId);
      if (
        trinket.cardId === BALLER_PORTRAIT_CARD_ID &&
        advanceTrinketCounter(player, trinket, 10)
      ) {
        addGeneratedTavernSpellToHand(
          state,
          player,
          "tavern-spell-temperature-shift",
        );
      }
    }
  }

  const playedNaga =
    event.tribes.includes("naga") || event.tribes.includes("all");
  if (
    playedNaga &&
    playerHasTrinketCardId(player, NAZJATAR_POSTCARD_CARD_ID)
  ) {
    addRandomSpellcraftSpells(state, player, 1);
  }

  const playedDemon =
    event.tribes.includes("demon") || event.tribes.includes("all");
  if (
    playedDemon &&
    playerHasTrinketCardId(player, URZUL_STICKER_CARD_ID) &&
    player.shop.length > 0
  ) {
    const otherDemons = player.board.filter(
      (candidate) =>
        minionHasTribe(candidate, "demon") &&
        !minionEffectSources(candidate).some(
          (component) =>
            component.sourceInstanceId === event.sourceInstanceId,
        ),
    );
    if (otherDemons.length > 0) {
      const target = otherDemons[randomIndex(state, otherDemons.length)];
      const consumedIndex = randomIndex(state, player.shop.length);
      const [consumed] = player.shop.splice(consumedIndex, 1);
      consumeShopMinionInto(state, player, target, consumed, 1);
    }
  }

  const definitionId = playedMinionDefinitionId(player, event);
  if (
    definitionId &&
    getMinionDefinition(definitionId).magnetic !== undefined
  ) {
    const triggerCount = configuredOwnedTrinkets(
      player,
      SPELL_POWERED_WRENCH_BY_CARD_ID,
    ).length;
    for (let trigger = 0; trigger < triggerCount; trigger += 1) {
      addRandomGeneratedTavernSpell(state, player);
    }
  }

  if (definitionId) {
    const playedDefinition = getMinionDefinition(definitionId);
    const playedBattlecry =
      playedDefinition.battlecry !== undefined ||
      playedDefinition.interactiveBattlecry !== undefined ||
      playedDefinition.printedMechanics?.includes("BATTLECRY") === true;
    if (playedBattlecry) {
      for (const trinketDefinitionId of player.trinketIds) {
        const trinket = getTrinketDefinition(trinketDefinitionId);
        if (
          trinket.cardId === CHROMATIC_TEAR_CARD_ID &&
          advanceTrinketCounter(player, trinket, 7)
        ) {
          addRandomChromaticWhelps(state, player, 2);
        }
      }
    }
  }

  const leftmostHandMinion = player.hand.find(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  if (!leftmostHandMinion) {
    return;
  }
  for (const { value } of configuredOwnedTrinkets(
    player,
    MURLOC_MANUAL_BUFF_BY_CARD_ID,
  )) {
    buffMinions(
      [leftmostHandMinion],
      value.attack,
      value.health,
    );
  }
}

function applyAfterTargetedSpellCastTrinkets(
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  for (const { value } of configuredOwnedTrinkets(
    player,
    LOREWALKER_SCROLL_BUFF_BY_CARD_ID,
  )) {
    buffMinions(
      [target],
      value.attack,
      value.health,
      [...player.board, ...player.shop],
      player,
    );
  }
}

function applyAfterTavernSpellCastTrinkets(
  player: PlayerState,
  fromHand: boolean,
): void {
  for (const { value: attack } of configuredOwnedTrinkets(
    player,
    COMFORTABLE_COFFIN_ATTACK_BY_CARD_ID,
  )) {
    player.undeadArmyAttackBonus += attack;
    buffMinions(
      [
        ...player.board,
        ...player.hand.filter(
          (card): card is BoardMinionInstance => card.kind === "minion",
        ),
      ].filter((minion) => minionHasTribe(minion, "undead")),
      attack,
      0,
      player.board,
      player,
    );
  }
  for (const { value } of configuredOwnedTrinkets(
    player,
    BLUEGILL_FLIPPERS_BUFF_BY_CARD_ID,
  )) {
    const leftmostBoardMinion = player.board[0];
    const leftmostHandMinion = player.hand.find(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    if (leftmostBoardMinion) {
      buffMinions(
        [leftmostBoardMinion],
        value.attack,
        value.health,
        player.board,
        player,
      );
    }
    if (leftmostHandMinion) {
      buffMinions([leftmostHandMinion], value.attack, value.health);
    }
  }
  for (const { value } of configuredOwnedTrinkets(
    player,
    MINIATURE_SHIP_BUFF_BY_CARD_ID,
  )) {
    buffMinions(
      player.board.filter((minion) => minionHasTribe(minion, "pirate")),
      value.attack,
      value.health,
      player.board,
      player,
    );
  }
  if (fromHand) {
    for (const definitionId of player.trinketIds) {
      const definition = getTrinketDefinition(definitionId);
      if (
        definition.cardId === HEART_OF_THE_FOREST_CARD_ID &&
        advanceTrinketCounter(player, definition, 6)
      ) {
        player.tavernSpellAttackBonus += 1;
        player.tavernSpellHealthBonus += 1;
      }
    }
  }
}

function applyAfterRecruitSpellCastTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  for (const { definition, value } of configuredOwnedTrinkets(
    player,
    BLOODBOUND_EARRINGS_BY_CARD_ID,
  )) {
    if (!advanceTrinketCounter(player, definition, value.threshold)) {
      continue;
    }
    const targets = [...player.board];
    for (
      let application = 0;
      application < value.bloodGemsPerMinion;
      application += 1
    ) {
      for (const target of targets) {
        if (
          player.board.some(
            (candidate) => candidate.instanceId === target.instanceId,
          )
        ) {
          applyRecruitBloodGemPulse(state, player, target);
        }
      }
    }
  }
  for (const { definition, value: threshold } of configuredOwnedTrinkets(
    player,
    ARCHAIC_SCROLL_THRESHOLD_BY_CARD_ID,
  )) {
    if (!advanceTrinketCounter(player, definition, threshold)) {
      continue;
    }
    addDrawnMinionToHand(
      state,
      player,
      drawMatchingFromPool(
        state,
        player.tavernTier,
        (candidate) => definitionHasTribe(candidate, "naga"),
      ),
    );
  }
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    const progress = player.trinketCounters[definition.id] ?? 0;
    if (
      definition.cardId !== BUBBLE_CROWN_CARD_ID ||
      progress >= 12
    ) {
      continue;
    }
    const nextProgress = progress + 1;
    player.trinketCounters[definition.id] = nextProgress;
    if (nextProgress === 12) {
      player.tavernSpellAttackBonus += 4;
      player.tavernSpellHealthBonus += 4;
    }
  }
  if (
    playerTrinkets(player).some(
      (trinket) => trinket.cardId === BEWITCHED_RIBBON_CARD_ID,
    )
  ) {
    buffMinions(player.board, 1, 1, player.board, player);
  }
  for (const definition of playerTrinkets(player)) {
    if (definition.cardId === PANPIPES_CARD_ID) {
      player.trinketCounters[definition.id] =
        (player.trinketCounters[definition.id] ?? 0) + 1;
    }
  }
}

function applyAfterTavernRefreshedTrinkets(player: PlayerState): void {
  for (const { value } of configuredOwnedTrinkets(
    player,
    CURSED_CRYSTAL_BUFF_BY_CARD_ID,
  )) {
    player.tavernMinionAttackBonusThisTurn += value.attack;
    player.tavernMinionHealthBonusThisTurn += value.health;
    for (const minion of player.shop) {
      applyTemporarySpellcraftBuff(minion, value.attack, value.health);
    }
  }
}

function applyAfterManualRefreshTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  const triggerCount = configuredOwnedTrinkets(
    player,
    UPSTART_EMBERS_BY_CARD_ID,
  ).length;
  for (let trigger = 0; trigger < triggerCount; trigger += 1) {
    if (player.shop.length === 0) {
      continue;
    }
    const highestHealth = Math.max(
      ...player.shop.map((minion) => minion.health),
    );
    const candidates = player.shop.filter(
      (minion) => minion.health === highestHealth,
    );
    const target = candidates[randomIndex(state, candidates.length)];
    buffMinions(
      [target],
      target.attack,
      target.health,
      player.shop,
    );
  }
  for (const definition of playerTrinkets(player)) {
    if (
      definition.cardId === MUTATING_CHEESE_WHEEL_CARD_ID &&
      advanceTrinketCounter(player, definition, 4)
    ) {
      buffTavernMinionsPermanently(player, 1, 1);
    }
  }
  for (const definition of playerTrinkets(player)) {
    if (
      definition.cardId !== DEMONIC_TAPESTRY_CARD_ID ||
      !advanceTrinketCounter(player, definition, 4) ||
      player.shop.length === 0
    ) {
      continue;
    }
    const highestTier = Math.max(
      ...player.shop.map((minion) => minion.tier),
    );
    const highestTierMinions = player.shop.filter(
      (minion) => minion.tier === highestTier,
    );
    const unpricedCandidates = highestTierMinions.filter(
      (minion) => !minionHasDemonicTapestryHealthPrice(minion),
    );
    const candidates =
      unpricedCandidates.length > 0
        ? unpricedCandidates
        : highestTierMinions;
    const target = candidates[randomIndex(state, candidates.length)];
    setEffectCounter(
      target,
      DEMONIC_TAPESTRY_HEALTH_PRICE_COUNTER,
      1,
    );
  }
}

function applyAfterMinionSoldTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  for (const { definition, value: threshold } of configuredOwnedTrinkets(
    player,
    LAVA_LAMP_THRESHOLD_BY_CARD_ID,
  )) {
    if (!advanceTrinketCounter(player, definition, threshold)) {
      continue;
    }
    addDrawnMinionToHand(
      state,
      player,
      drawMatchingFromPool(
        state,
        player.tavernTier,
        (candidate) => definitionHasTribe(candidate, "elemental"),
      ),
    );
  }
  for (const definition of playerTrinkets(player)) {
    if (
      definition.cardId === AVALANCHE_STICKER_CARD_ID &&
      advanceTrinketCounter(player, definition, 4)
    ) {
      applyRepeatableOfficialTrinketReward(state, player, definition);
    }
  }
}

function applyAfterGoldSpentTrinkets(
  state: GameState,
  player: PlayerState,
  amount = 1,
): void {
  for (const { value } of configuredOwnedTrinkets(
    player,
    BOOTY_BAY_BREW_BUFF_BY_CARD_ID,
  )) {
    const pirates = player.board.filter((minion) =>
      minionHasTribe(minion, "pirate"),
    );
    if (pirates.length === 0) {
      continue;
    }
    const target = pirates[randomIndex(state, pirates.length)];
    buffMinions(
      [target],
      value.attack,
      value.health,
      player.board,
      player,
    );
  }
  for (const definitionId of player.trinketIds) {
    const definition = getTrinketDefinition(definitionId);
    if (definition.cardId === SHARK_CANNON_CARD_ID) {
      const encoded = Math.max(
        0,
        Math.floor(player.trinketCounters[definition.id] ?? 0),
      );
      let improvements = Math.floor(encoded / 10);
      const accumulated = (encoded % 10) + amount;
      const triggers = Math.floor(accumulated / 10);
      for (let trigger = 0; trigger < triggers; trigger += 1) {
        const buff = improvements + 1;
        buffMinions(
          player.board.filter((minion) =>
            minionHasTribe(minion, "pirate"),
          ),
          buff,
          buff,
          player.board,
          player,
        );
        improvements += 1;
      }
      player.trinketCounters[definition.id] =
        improvements * 10 + (accumulated % 10);
      continue;
    }
    if (definition.cardId !== FANCY_SPELLBOOK_CARD_ID) {
      continue;
    }
    const total =
      Math.max(0, player.trinketCounters[definition.id] ?? 0) + amount;
    const casts = Math.floor(total / 7);
    player.trinketCounters[definition.id] = total % 7;
    for (let cast = 0; cast < casts; cast += 1) {
      resolveTriggeredRecruitTavernSpell(
        state,
        player,
        "tavern-spell-shiny-ring",
      );
    }
  }
}

function applyAfterMinionPurchasedTrinkets(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): void {
  for (const { definition, value: limit } of configuredOwnedTrinkets(
    player,
    TRANSCRIPTION_MACHINE_LIMIT_BY_CARD_ID,
  )) {
    const copied = player.trinketCounters[definition.id] ?? 0;
    if (copied >= limit) {
      continue;
    }
    player.trinketCounters[definition.id] = copied + 1;
    addGeneratedMinionCopyToHand(state, player, definitionId);
  }
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
  applyAfterMinionPlayedTrinkets(state, player, event);

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
    for (const component of minionEffectSources(watcher)) {
      const trigger =
        getMinionDefinition(component.definitionId).afterCardPlayed;
      if (
        !trigger ||
        (watcher.instanceId === event.sourceInstanceId &&
          trigger.includeSource !== true) ||
        !playedCardMatches(event, trigger.filter)
      ) {
        continue;
      }
      applyRecruitEffects(
        state,
        player,
        watcher,
        trigger.effects,
        component.golden ? 2 : 1,
        { effectSourceDefinitionId: component.definitionId },
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
  applyAfterGoldSpentTrinkets(state, player, amount);

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
        source as BoardMinionInstance,
        trigger.effects,
        1,
      );
    }
  }
  return true;
}

function healthGainedFromExternalAttack(
  minion: MinionInstance,
  attackGain: number,
): number {
  if (attackGain <= 0 || minion.health <= 0) {
    return 0;
  }
  const effect =
    getMinionDefinition(minion.definitionId).afterSelfGainsAttack;
  if (!effect) {
    return 0;
  }
  const repetitions =
    minion.golden && effect.goldenMode === "repeat" ? 2 : 1;
  return effect.health * repetitions;
}

function reconcileConditionalMinion(minion: MinionInstance): boolean {
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

interface RecruitCardPurchase {
  kind: "minion" | "tavernSpell";
  definitionId: string;
  instanceId: string;
}

function observeCardPurchase(
  state: GameState,
  player: PlayerState,
  purchase: RecruitCardPurchase,
): void {
  const purchasedMinion =
    purchase.kind === "minion"
      ? player.hand.find(
          (card): card is BoardMinionInstance =>
            card.kind === "minion" &&
            card.instanceId === purchase.instanceId,
        )
      : undefined;
  for (const source of [...player.board]) {
    const definition = getMinionDefinition(source.definitionId);
    const milestone = definition.afterCardPurchased;
    if (milestone) {
      const progress = effectCounter(
        source,
        PURCHASE_PROGRESS_COUNTER,
        0,
      );
      if (progress >= 0) {
        const nextProgress = progress + 1;
        if (nextProgress >= milestone.purchases) {
          const scale =
            source.golden && milestone.goldenMode === "doubleStats"
              ? 2
              : 1;
          source.attack += milestone.attack * scale;
          source.health += milestone.health * scale;
          observeRecruitFriendlyAttackGain(
            player,
            source,
            milestone.attack * scale,
          );
          observeRecruitFriendlyHealthGain(
            player,
            source,
            milestone.health * scale,
          );
          setEffectCounter(source, PURCHASE_PROGRESS_COUNTER, -1);
        } else {
          setEffectCounter(
            source,
            PURCHASE_PROGRESS_COUNTER,
            nextProgress,
          );
        }
      }
    }

    const minionPurchaseEffect =
      purchasedMinion ? definition.afterMinionPurchased : undefined;
    if (minionPurchaseEffect && purchasedMinion) {
      const used = effectCounter(
        source,
        STONE_AGE_SLAB_PURCHASE_USED_COUNTER,
        0,
      );
      if (used < minionPurchaseEffect.timesPerTurn) {
        setEffectCounter(
          source,
          STONE_AGE_SLAB_PURCHASE_USED_COUNTER,
          used + 1,
        );
        const elementalBonus = recruitElementalStatGrantBonus(
          player,
          source,
          {},
        );
        const attackBefore = purchasedMinion.attack;
        const healthBefore = purchasedMinion.health;
        const multiplier = source.golden
          ? minionPurchaseEffect.goldenStatMultiplier
          : minionPurchaseEffect.statMultiplier;
        purchasedMinion.attack =
          (purchasedMinion.attack +
            minionPurchaseEffect.attack +
            elementalBonus.attack) *
          multiplier;
        purchasedMinion.health =
          (purchasedMinion.health +
            minionPurchaseEffect.health +
            elementalBonus.health) *
          multiplier;
        observeRecruitFriendlyAttackGain(
          player,
          purchasedMinion,
          purchasedMinion.attack - attackBefore,
        );
        observeRecruitFriendlyHealthGain(
          player,
          purchasedMinion,
          purchasedMinion.health - healthBefore,
        );
        refreshDynamicMinionDescription(purchasedMinion, player);
      }
    }

    const tavernSpellTrigger =
      purchase.kind === "tavernSpell"
        ? definition.afterTavernSpellPurchased
        : undefined;
    if (tavernSpellTrigger) {
      const limit =
        tavernSpellTrigger.timesPerTurn *
        (source.golden &&
        tavernSpellTrigger.goldenMode === "doubleLimit"
          ? 2
          : 1);
      const used = effectCounter(
        source,
        TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER,
        0,
      );
      if (used < limit) {
        setEffectCounter(
          source,
          TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER,
          used + 1,
        );
        const apprentice = createMinionInstance(
          state,
          tavernSpellTrigger.tokenDefinitionId,
          0,
        );
        apprentice.taughtTavernSpellDefinitionId = purchase.definitionId;
        refreshDynamicMinionDescription(apprentice, player);
        addCardToHand(state, player, apprentice);
      }
    }
    refreshDynamicMinionDescription(source, player);
  }
  if (purchase.kind === "tavernSpell") {
    for (const trinket of playerTrinkets(player)) {
      if (
        trinket.cardId !== MAGICFIN_TAG_CARD_ID ||
        !consumePerRoundTrinketTrigger(player, trinket, state.round, 2)
      ) {
        continue;
      }
      const apprentice = createMinionInstance(
        state,
        MAGICFIN_APPRENTICE_DEFINITION_ID,
        0,
      );
      apprentice.taughtTavernSpellDefinitionId = purchase.definitionId;
      refreshDynamicMinionDescription(apprentice, player);
      addCardToHand(state, player, apprentice);
    }
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
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  }
}

function observeRecruitDeathrattleTriggered(player: PlayerState): void {
  player.deathrattlesTriggered =
    (player.deathrattlesTriggered ?? 0) + 1;
  reconcilePlayerWhereverMinions(player);
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

function tavernMinionCapacity(player: PlayerState): number {
  if (playerHasTrinketCardId(player, TAVERN_FAN_CARD_ID)) {
    return 6;
  }
  const fewerMinions = playerHasHeroPower(
    player,
    "freezeEndTurnSmallerTavern",
  )
    ? 1
    : 0;
  return Math.max(
    0,
    SHOP_SIZE_BY_TIER[player.tavernTier] - fewerMinions,
  );
}

function trimTavernForAssignedHeroPower(
  state: GameState,
  player: PlayerState,
): void {
  if (!playerHasHeroPower(player, "freezeEndTurnSmallerTavern")) {
    return;
  }
  const minionCapacity = tavernMinionCapacity(player);
  while (player.shop.length > minionCapacity) {
    const released = player.shop.pop();
    if (released) {
      returnMinionToPool(state, released);
    }
  }
}

function tavernCardCapacity(player: PlayerState): number {
  return playerHasTrinketCardId(player, TAVERN_FAN_CARD_ID)
    ? 7
    : tavernMinionCapacity(player) + 1;
}

function applyAfterTavernRefreshEffects(
  state: GameState,
  player: PlayerState,
): void {
  addYseraDragonToTavern(state, player);
  applyExtraTavernMinionTrinkets(state, player);
  if (
    player.tavernBloodGemBarrageCount > 0
  ) {
    const count = player.tavernBloodGemBarrageCount;
    // The save model stores cast-time bonuses as totals. Distribute them over
    // the original Barrage pulses so event-sensitive minions trigger per cast.
    const attackBonusPerPulse = Math.floor(
      player.tavernBloodGemBarrageAttack / count,
    );
    const healthBonusPerPulse = Math.floor(
      player.tavernBloodGemBarrageHealth / count,
    );
    const attackBonusRemainder =
      player.tavernBloodGemBarrageAttack % count;
    const healthBonusRemainder =
      player.tavernBloodGemBarrageHealth % count;
    for (const minion of player.shop) {
      for (let pulse = 0; pulse < count; pulse += 1) {
        applyBloodGemStats(
          minion,
          player.bloodGemAttack +
            attackBonusPerPulse +
            (pulse < attackBonusRemainder ? 1 : 0),
          player.bloodGemHealth +
            healthBonusPerPulse +
            (pulse < healthBonusRemainder ? 1 : 0),
        );
      }
    }
  }
  if (player.shop.length > 0) {
    for (const buff of player.rideTheWindBuffs) {
      const target =
        player.shop[randomIndex(state, player.shop.length)];
      buffMinions([target], buff.attack, buff.health, player.shop);
    }
  }
  applyAfterTavernRefreshedTrinkets(player);
}

function fillShop(
  state: GameState,
  player: PlayerState,
  applyRefreshEffects = true,
  exactTier?: TavernTier,
): void {
  const normalMinionTargetSize = tavernMinionCapacity(player);
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
    const minion = exactTier === undefined
      ? drawTavernMinionFromPool(state, player)
      : drawMatchingFromPool(
          state,
          exactTier,
          (definition) => definition.tier === exactTier,
        );
    if (!minion) {
      break;
    }
    applyTavernBonuses(player, minion);
    reconcileWhereverMinion(
      minion,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
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
    const spell = exactTier === undefined
      ? drawTavernSpell(state, player.tavernTier)
      : drawTavernSpell(state, exactTier, new Set(), exactTier);
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
  const minion = drawTavernMinionFromPool(state, player);
  if (!minion) {
    return;
  }
  applyTavernBonuses(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
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
    consumeShopMinionInto(
      state,
      player,
      target,
      fodder,
      fodder.golden ? 2 : 1,
    );
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
    applyTavernBonuses(player, fodder);
    const portraitBonus =
      (playerHasTrinketCardId(
        player,
        LESSER_DEFILER_PORTRAIT_CARD_ID,
      )
        ? 4
        : 0) +
      (playerHasTrinketCardId(
        player,
        GREATER_DEFILER_PORTRAIT_CARD_ID,
      )
        ? 15
        : 0);
    fodder.attack += portraitBonus;
    fodder.health += portraitBonus;
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
  const heroPowerSurcharge = playerHasHeroPower(
    player,
    "twoGoldMinionRefresh",
  )
    ? 1
    : 0;
  return Math.max(
    0,
    baseCost -
      player.upgradeDiscount -
      heroPowerDiscount +
      heroPowerSurcharge,
  );
}

function baseMinionPurchaseCost(
  player: PlayerState,
  offered?: BoardMinionInstance,
): number {
  if (
    offered &&
    effectCounter(offered, CHILLMERE_MOSAIC_COST_COUNTER, 0) > 0
  ) {
    return 1;
  }
  if (
    offered &&
    playerHasTrinketCardId(player, MAGNETIC_PRICE_TAG_CARD_ID) &&
    getMinionDefinition(offered.definitionId).magnetic !== undefined
  ) {
    return 2;
  }
  return playerHasHeroPower(player, "twoGoldMinionRefresh") ||
    playerHasHeroPower(player, "freezeEndTurnSmallerTavern")
    ? 2
    : BUY_COST;
}

export interface MinionPurchaseQuote {
  currency: "gold" | "health";
  cost: number;
  affordable: boolean;
}

export function getMinionPurchaseQuote(
  state: GameState,
  playerId: PlayerId,
  shopIndex: number,
): MinionPurchaseQuote | null {
  const player = findPlayer(state, playerId);
  const offered = player?.shop[shopIndex];
  if (!player || !offered) {
    return null;
  }
  const usesFreePiratePurchase =
    minionHasTribe(offered, "pirate") &&
    unusedFirstPirateFreeTrinket(player) !== null;
  const cost = usesFreePiratePurchase
    ? 0
    : baseMinionPurchaseCost(player, offered);
  const currency =
    !usesFreePiratePurchase &&
    (minionHasDemonicTapestryHealthPrice(offered) ||
      (minionHasTribe(offered, "demon") &&
        unusedPerTurnHealthPurchaseTrinket(
          player,
          PILGRIMP_STICKER_CARD_ID,
        ) !== null) ||
      eyeOfSargerasIsDue(player))
      ? "health"
      : "gold";
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

export function getMinionPurchaseCost(
  state: GameState,
  playerId: PlayerId,
  shopIndex?: number,
): number {
  const player = findPlayer(state, playerId);
  if (!player) {
    return BUY_COST;
  }
  if (shopIndex !== undefined) {
    return (
      getMinionPurchaseQuote(state, playerId, shopIndex)?.cost ??
      baseMinionPurchaseCost(player)
    );
  }
  return baseMinionPurchaseCost(player);
}

export function getRefreshCost(
  state: GameState,
  playerId: PlayerId,
): number {
  return getTavernRefreshQuote(state, playerId)?.cost ?? REFRESH_COST;
}

interface HealthRefreshSource {
  minion: BoardMinionInstance;
  healthCost: number;
  maximum: number;
  used: number;
}

function nextHealthRefreshSource(
  player: PlayerState,
): HealthRefreshSource | null {
  for (const minion of player.board) {
    const spec = getMinionDefinition(
      minion.definitionId,
    ).healthRefreshesPerTurn;
    if (!spec) {
      continue;
    }
    const maximum =
      spec.count *
      (minion.golden && spec.goldenMode === "doubleCount" ? 2 : 1);
    const used = effectCounter(
      minion,
      HEALTH_REFRESH_USED_COUNTER,
      0,
    );
    if (used < maximum) {
      return {
        minion,
        healthCost: spec.healthCost,
        maximum,
        used,
      };
    }
  }
  return null;
}

function pendingWarbandCopyRefreshTrinket(
  player: PlayerState,
): TrinketDefinition | null {
  return (
    playerTrinkets(player).find(
      (definition) =>
        definition.cardId === WAR_BAND_REFRESH_CARD_ID &&
        (player.trinketCounters[definition.id] ?? 0) > 0,
    ) ?? null
  );
}

function availableGuidingCandleRefresh(
  player: PlayerState,
): { definition: TrinketDefinition; used: number } | null {
  const definition = playerTrinkets(player).find(
    (candidate) => candidate.cardId === GUIDING_CANDLE_CARD_ID,
  );
  if (!definition) {
    return null;
  }
  const used = Math.max(
    0,
    Math.floor(player.trinketCounters[definition.id] ?? 0),
  );
  return used < 2 ? { definition, used } : null;
}

function availableWishboneHeroRefresh(
  player: PlayerState,
): TrinketDefinition | null {
  const wishbone = ancientWishbone(player);
  return wishbone &&
    playerHasHeroPower(player, "freeRefreshAtTurnStart") &&
    (player.trinketCounters[wishbone.id] ?? 0) > 0
    ? wishbone
    : null;
}

function hasFreeRefresh(player: PlayerState): boolean {
  return (
    pendingWarbandCopyRefreshTrinket(player) !== null ||
    (player.heroRefreshAvailable &&
      playerHasHeroPower(player, "freeRefreshAtTurnStart")) ||
    availableWishboneHeroRefresh(player) !== null ||
    player.freeRefreshes > 0
  );
}

export interface TavernRefreshQuote {
  currency: "gold" | "health";
  cost: number;
  affordable: boolean;
  remainingHealthRefreshes: number;
}

export function getTavernRefreshQuote(
  state: GameState,
  playerId: PlayerId,
): TavernRefreshQuote | null {
  const player = findPlayer(state, playerId);
  if (!player) {
    return null;
  }
  const healthSource = nextHealthRefreshSource(player);
  if (healthSource) {
    const cost = hasFreeRefresh(player) ? 0 : healthSource.healthCost;
    return {
      currency: "health",
      cost,
      affordable: cost === 0 || player.health + player.armor > cost,
      remainingHealthRefreshes:
        healthSource.maximum - healthSource.used,
    };
  }
  const baseCost = playerHasHeroPower(player, "twoGoldMinionRefresh")
    ? 2
    : REFRESH_COST;
  const cost = hasFreeRefresh(player) ? 0 : baseCost;
  return {
    currency: "gold",
    cost,
    affordable: player.gold >= cost,
    remainingHealthRefreshes: 0,
  };
}

export interface TavernSpellPurchaseQuote {
  currency: "gold" | "health";
  cost: number;
  affordable: boolean;
}

function usesTaeThelanFreeTavernSpell(
  player: PlayerState,
): boolean {
  return (
    playerHasHeroPower(player, "freeFourthTavernSpell") &&
    heroPowerCounter(player, "taethelanSpells") === 3
  );
}

function tavernSpellPurchaseCost(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  const currency = tavernSpellPurchaseCurrency(spell);
  if (
    player.freeTavernSpellPurchases > 0 ||
    usesTaeThelanFreeTavernSpell(player)
  ) {
    return 0;
  }
  const statSpellDiscount =
    playerHasTrinketCardId(player, STAT_SPELL_DISCOUNT_CARD_ID) &&
    STAT_GRANTING_TAVERN_SPELL_CARD_IDS.has(spell.cardId)
      ? 2
      : 0;
  const reservePricesDiscount = Math.max(
    0,
    Math.floor(player.darkmoonReservePricesDiscount ?? 0),
  );
  return currency === "gold"
    ? Math.max(
        0,
        spell.cost -
          (player.nextTavernSpellDiscount ?? 0) -
          statSpellDiscount -
          reservePricesDiscount,
      )
    : spell.cost;
}

function tavernSpellDynamicPurchaseCurrency(
  player: PlayerState,
  spell: TavernSpellInstance,
): "gold" | "health" {
  return tavernSpellPurchaseCurrency(spell) === "health" ||
    unusedPerTurnHealthPurchaseTrinket(
      player,
      BAZAAR_STICKER_CARD_ID,
    ) !== null ||
    eyeOfSargerasIsDue(player)
    ? "health"
    : "gold";
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
  const currency = tavernSpellDynamicPurchaseCurrency(player, spell);
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
  if (definition.effect === "goldenizer") {
    return player.board.filter((candidate) => !candidate.golden);
  }
  if (definition.effect === "goldenArrow") {
    return player.shop.filter((candidate) => !candidate.golden);
  }
  if (definition.effect === "mirrorLens") {
    return candidates.filter((candidate) => candidate.tier <= 3);
  }
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
  if (!spellcraftNeedsTarget(spell)) {
    return [];
  }
  const definition =
    "kind" in spell
      ? getSpellcraftDefinition(spell.definitionId)
      : spell;
  if (
    definition.effect === "jailerStickerLesser" ||
    definition.effect === "jailerStickerGreater"
  ) {
    return player.board.filter((minion) =>
      minionHasTribe(minion, "undead"),
    );
  }
  if (definition.effect === "ophidianStaff") {
    return player.board.filter((minion) =>
      minionHasTribe(minion, "beast"),
    );
  }
  if (definition.effect === "tokenOfOldGods") {
    return player.board.filter((minion) => minion.tier < 6);
  }
  if (definition.effect === "darkmoonRepeatCustomer") {
    return player.board.filter((minion) => !minion.golden);
  }
  if (definition.effect === "sirensSong") {
    return player.shop.filter(
      (minion) => minion.definitionId !== "BG27_514",
    );
  }
  return [...player.board];
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

function applyBuff(
  target: MinionInstance,
  effect: BuffEffect,
  scale: number,
  triggerExternalAttackGain = false,
  healthGainOwner?: PlayerState,
): void {
  const attackGain = effect.attack * scale;
  const triggeredHealth = triggerExternalAttackGain
    ? healthGainedFromExternalAttack(target, attackGain)
    : 0;
  target.attack = Math.max(0, target.attack + attackGain);
  target.health = Math.max(
    1,
    target.health + effect.health * scale + triggeredHealth,
  );
  if (effect.taunt) {
    target.taunt = true;
    target.temporaryTaunt = false;
  }
  reconcileConditionalMinion(target);
  if (target.kind === "minion") {
    observeRecruitFriendlyAttackGain(
      healthGainOwner,
      target,
      attackGain,
    );
    observeRecruitFriendlyHealthGain(
      healthGainOwner,
      target,
      effect.health * scale + triggeredHealth,
    );
  }
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
    player.board,
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
    player.shop,
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
    player.shop,
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

interface RecruitEffectContext {
  /** Original board slot of a minion whose Deathrattle is resolving. */
  deathBoardIndex?: number;
  /** Living original neighbors captured immediately before that minion died. */
  deathAdjacentInstanceIds?: readonly string[];
  /** Exact Magnetic/base component whose rule produced these effects. */
  effectSourceDefinitionId?: string;
}

function recruitElementalStatGrantBonus(
  player: PlayerState,
  source: MinionInstance,
  context: RecruitEffectContext,
): CombatStatBuff {
  const definition = getMinionDefinition(
    context.effectSourceDefinitionId ?? source.definitionId,
  );
  if (!definitionHasTribe(definition, "elemental")) {
    return { attack: 0, health: 0 };
  }
  return {
    attack: player.elementalGrantAttackBonus,
    health: player.elementalGrantHealthBonus,
  };
}

function generatedMinionDefinitions(
  state: GameState,
  effect: SummonRandomMinionEffect,
): (typeof MINION_DEFINITIONS)[number][] {
  return MINION_DEFINITIONS.filter(
    (definition) =>
      definitionIsAvailable(definition, state.activeTribes) &&
      definitionHasTribe(definition, effect.filter.tribe),
  );
}

function randomGeneratedMinionDefinition(
  state: GameState,
  effect: SummonRandomMinionEffect,
): (typeof MINION_DEFINITIONS)[number] | null {
  const candidates = generatedMinionDefinitions(state, effect);
  return candidates.length > 0
    ? candidates[randomIndex(state, candidates.length)]
    : null;
}

/**
 * Resolves the replacement trigger for an actual Recruit-phase summon attempt
 * that cannot enter because all seven warband slots are occupied.
 */
function rejectRecruitSummonForFullBoard(player: PlayerState): boolean {
  if (player.board.length < MAX_BOARD_SIZE) {
    return false;
  }
  const watchers = [...player.board];
  for (const watcher of watchers) {
    if (
      watcher.health <= 0 ||
      !player.board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const effect = getMinionDefinition(
        component.definitionId,
      ).onFriendlySummonOverflow;
      if (!effect) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      buffMinions(
        player.board.filter((target) => target.health > 0),
        effect.attack * scale,
        effect.health * scale,
        player.board,
        player,
      );
    }
  }
  return true;
}

function recruitDeathrattleAdjacentTargets(
  player: PlayerState,
  context: RecruitEffectContext,
): BoardMinionInstance[] {
  const capturedIds = context.deathAdjacentInstanceIds;
  if (capturedIds) {
    return capturedIds
      .map((instanceId) =>
        player.board.find(
          (candidate) => candidate.instanceId === instanceId,
        ),
      )
      .filter(
        (candidate): candidate is BoardMinionInstance =>
          candidate !== undefined && candidate.health > 0,
      );
  }
  const index = context.deathBoardIndex;
  if (index === undefined) {
    return [];
  }
  return [player.board[index - 1], player.board[index]]
    .filter(
      (candidate): candidate is BoardMinionInstance =>
        candidate !== undefined && candidate.health > 0,
    );
}

function applyRecruitBuffThenDamageFriendly(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effect: BuffThenDamageFriendlyEffect,
  goldenSource: boolean,
): void {
  const pulses =
    Math.max(1, Math.floor(effect.pulses ?? 1)) *
    (goldenSource && effect.goldenMode === "repeat" ? 2 : 1);
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const targets = player.board.filter(
      (minion) =>
        minion.health > 0 &&
        (!effect.otherOnly ||
          minion.instanceId !== source.instanceId) &&
        (!effect.tribes ||
          effect.tribes.some((tribe) => minionHasTribe(minion, tribe))),
    );
    buffMinions(
      targets,
      effect.attack,
      effect.health,
      player.board,
      player,
    );
    const damageObservations: Array<{
      target: BoardMinionInstance;
      observers: Array<{
        watcher: BoardMinionInstance;
        component: MinionEffectSource;
        trigger: FriendlyDamagedTrigger;
      }>;
    }> = [];
    for (const target of targets) {
      if (
        !player.board.some(
          (candidate) => candidate.instanceId === target.instanceId,
        ) ||
        effect.damage <= 0
      ) {
        continue;
      }
      reconcileConditionalMinion(target);
      if (target.divineShield) {
        target.divineShield = false;
        target.temporaryDivineShield = false;
        continue;
      }
      const observers = player.board.flatMap((watcher) =>
        minionEffectSources(watcher).flatMap((component) => {
          const trigger = getMinionDefinition(
            component.definitionId,
          ).afterFriendlyDamaged;
          return trigger &&
            minionHasTribe(target, trigger.tribe) &&
            (!trigger.otherOnly ||
              watcher.instanceId !== target.instanceId)
            ? [{ watcher, component, trigger }]
            : [];
        }),
      );
      target.health -= effect.damage;
      reconcileConditionalMinion(target);
      damageObservations.push({ target, observers });
    }
    for (const { target, observers } of damageObservations) {
      for (const { watcher, component, trigger } of observers) {
        if (
          !player.board.some(
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
                const candidates = player.board.filter(
                  (candidate) =>
                    candidate.health > 0 &&
                    candidate.instanceId !== target.instanceId &&
                    minionHasTribe(candidate, targetTribe),
                );
                return candidates.length === 0
                  ? undefined
                  : candidates[randomIndex(state, candidates.length)];
              })();
        if (!buffTarget) {
          continue;
        }
        const scale = component.golden ? 2 : 1;
        buffTarget.attack += trigger.attack * scale;
        buffTarget.health += trigger.health * scale;
        reconcileConditionalMinion(buffTarget);
        observeRecruitFriendlyAttackGain(
          player,
          buffTarget,
          trigger.attack * scale,
        );
        observeRecruitFriendlyHealthGain(
          player,
          buffTarget,
          trigger.health * scale,
        );
      }
    }
    for (const target of targets) {
      if (
        target.health <= 0 &&
        player.board.some(
          (candidate) => candidate.instanceId === target.instanceId,
        )
      ) {
        destroyRecruitMinion(state, player, target.instanceId);
      }
    }
  }
}

function applyRecruitEffects(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effects: readonly MinionEffect[] | undefined,
  scaleOverride?: number,
  context: RecruitEffectContext = {},
): void {
  if (!effects) {
    return;
  }
  const scale = scaleOverride ?? (source.golden ? 2 : 1);
  const effectSourceIsGolden =
    scaleOverride === undefined ? source.golden : scaleOverride > 1;
  const elementalGrantBonus = recruitElementalStatGrantBonus(
    player,
    source,
    context,
  );
  for (const effect of effects) {
    if (effect.kind === "buff") {
      const repetitions = effect.goldenMode === "repeat" ? scale : 1;
      const statScale = effect.goldenMode === "repeat" ? 1 : scale;
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        for (const target of recruitEffectTargets(
          state,
          player,
          source,
          effect,
        )) {
          applyBuff(
            target,
            {
              ...effect,
              attack:
                effect.attack * statScale + elementalGrantBonus.attack,
              health:
                effect.health * statScale + elementalGrantBonus.health,
            },
            1,
            [...player.board, ...player.shop].some(
              (candidate) => candidate.instanceId === target.instanceId,
            ),
            player,
          );
        }
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
          effect.attack * scale + elementalGrantBonus.attack,
          effect.health * scale + elementalGrantBonus.health,
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
        effect.attack * scale + elementalGrantBonus.attack,
        effect.health * scale + elementalGrantBonus.health,
        player.board,
        player,
      );
    } else if (
      effect.kind === "buffOtherFriendlyTribeByFamilyPlayed"
    ) {
      const familyCount =
        effect.family === "mrrglton" ? player.mrrgltonsPlayed : 0;
      const statScale =
        effect.goldenMode === "doubleStats" ? scale : 1;
      const attack =
        effect.attack === 0
          ? 0
          : (effect.attack + familyCount) * statScale;
      const health =
        effect.health === 0
          ? 0
          : (effect.health + familyCount) * statScale;
      buffMinions(
        player.board.filter(
          (target) =>
            target.instanceId !== source.instanceId &&
            minionHasTribe(target, effect.tribe),
        ),
        attack + elementalGrantBonus.attack,
        health + elementalGrantBonus.health,
        player.board,
        player,
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
          attack: effect.attack + elementalGrantBonus.attack,
          health: effect.health + elementalGrantBonus.health,
        });
      }
    } else if (effect.kind === "buffTavernTier") {
      applyPersistentTavernTierBuff(
        player,
        effect.maximumTier,
        effect.attack * scale + elementalGrantBonus.attack,
        effect.health * scale + elementalGrantBonus.health,
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
        addCardToHand(
          state,
          player,
          createTavernSpell(state, definition),
        );
      }
    } else if (effect.kind === "gainGeneratedSpell") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      addGeneratedTargetedSpells(
        state,
        player,
        effect.definitionId,
        gainCount,
      );
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
        addCardToHand(
          state,
          player,
          createTavernSpell(state, definition),
        );
      }
    } else if (effect.kind === "castTavernSpell") {
      const repetitions =
        effect.goldenMode === "repeat" ? scale : 1;
      for (let count = 0; count < repetitions; count += 1) {
        resolveTriggeredRecruitTavernSpell(
          state,
          player,
          effect.definitionId,
          elementalGrantBonus,
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
            getRandomMinionMaximumTier(player, effect),
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
      damageRecruitPlayer(player, effect.amount);
    } else if (effect.kind === "gainMissingHealth") {
      const healthGain =
        Math.max(0, 40 - player.health) * effect.multiplier * scale;
      source.health += healthGain;
      if (source.kind === "minion") {
        observeRecruitFriendlyHealthGain(player, source, healthGain);
      }
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
    } else if (effect.kind === "improveElementalStatGrants") {
      player.elementalGrantAttackBonus += effect.attack * scale;
      player.elementalGrantHealthBonus += effect.health * scale;
    } else if (effect.kind === "improveBallers") {
      buffMinions(
        player.board,
        (effect.attack > 0 ? player.ballerAttackBonus * scale : 0) +
          elementalGrantBonus.attack,
        (effect.health > 0 ? player.ballerHealthBonus * scale : 0) +
          elementalGrantBonus.health,
        player.board,
        player,
      );
      player.ballerAttackBonus += effect.attack * scale;
      player.ballerHealthBonus += effect.health * scale;
    } else if (effect.kind === "buffTavern") {
      const repetitions =
        effect.goldenMode === "repeat" ? scale : 1;
      const portraitBonus =
        source.definitionId === FELLEMENTAL_DEFINITION_ID &&
        playerHasTrinketCardId(player, FELLEMENTAL_PORTRAIT_CARD_ID)
          ? 2
          : 0;
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        player.tavernMinionAttackBonus +=
          effect.attack + portraitBonus + elementalGrantBonus.attack;
        player.tavernMinionHealthBonus +=
          effect.health + portraitBonus + elementalGrantBonus.health;
        buffMinions(
          player.shop,
          effect.attack + portraitBonus + elementalGrantBonus.attack,
          effect.health + portraitBonus + elementalGrantBonus.health,
          player.shop,
        );
      }
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
          effect.attack * pulseScale + elementalGrantBonus.attack,
          effect.health * pulseScale + elementalGrantBonus.health,
        );
      }
    } else if (effect.kind === "improveUndeadArmy") {
      const outOfCombatScale =
        effect.outOfCombatMultiplier ?? 1;
      const attack =
        effect.attack * scale * outOfCombatScale +
        elementalGrantBonus.attack;
      const health =
        effect.health * scale * outOfCombatScale +
        elementalGrantBonus.health;
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
        player.board,
      );
    } else if (effect.kind === "consumeRandomShopMinion") {
      if (source.kind !== "minion" || player.shop.length === 0) {
        continue;
      }
      const consumedIndex = randomIndex(state, player.shop.length);
      const [consumed] = player.shop.splice(consumedIndex, 1);
      const statScale =
        effect.goldenMode === "doubleStats" ? scale : 1;
      consumeShopMinionInto(
        state,
        player,
        source as BoardMinionInstance,
        consumed,
        statScale,
        elementalGrantBonus,
      );
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
    } else if (effect.kind === "buffSelfByPlayerSpellHistory") {
      if (source.kind !== "minion" || effect.spellsPerUpgrade <= 0) {
        continue;
      }
      const stages =
        1 +
        Math.floor(
          Math.max(0, player.playerSpellsCast ?? 0) /
            effect.spellsPerUpgrade,
        );
      const attack = effect.attack * scale * stages;
      const health = effect.health * scale * stages;
      const minionSource = source as BoardMinionInstance;
      const sourceIndex = player.board.findIndex(
        (candidate) => candidate.instanceId === minionSource.instanceId,
      );
      buffMinions(
        [minionSource],
        attack,
        health,
        player.board,
      );
      if (
        minionSource.definitionId === GROUNDBREAKER_DEFINITION_ID &&
        playerHasTrinketCardId(player, GROUNDBREAKER_PORTRAIT_CARD_ID) &&
        sourceIndex > 0
      ) {
        buffMinions(
          [player.board[sourceIndex - 1]],
          attack,
          health,
          player.board,
        );
      }
    } else if (effect.kind === "improveTavernSpellAuraThisTurn") {
      if (source.kind !== "minion" || effect.cardsRequired <= 0) {
        continue;
      }
      const totalProgress =
        effectCounter(
          source,
          TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER,
          0,
        ) + 1;
      const improvements = Math.floor(
        totalProgress / effect.cardsRequired,
      );
      setEffectCounter(
        source,
        TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER,
        totalProgress % effect.cardsRequired,
      );
      if (improvements > 0) {
        setEffectCounter(
          source,
          TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
          effectCounter(
            source,
            TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
            0,
          ) +
            effect.attack * improvements,
        );
        setEffectCounter(
          source,
          TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
          effectCounter(
            source,
            TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
            0,
          ) +
            effect.health * improvements,
        );
      }
      refreshDynamicMinionDescription(source, player);
    } else if (effect.kind === "summon") {
      const baseCount =
        effect.count === "sourceAttack" ? source.attack : effect.count;
      const doublesCount =
        effectSourceIsGolden && effect.goldenMode === "doubleCount";
      const summonCount = baseCount * (doublesCount ? 2 : 1);
      const summonedTokens: BoardMinionInstance[] = [];
      for (let count = 0; count < summonCount; count += 1) {
        if (rejectRecruitSummonForFullBoard(player)) {
          continue;
        }
        const summoned = createMinionInstance(state, effect.definitionId, 0);
        if (effectSourceIsGolden && !doublesCount) {
          makeGoldenToken(summoned);
        }
        if (effect.taunt) {
          summoned.taunt = true;
        }
        applyOwnedUndeadArmyBonus(player, summoned);
        applyOwnedBeetleBonus(player, summoned);
        const insertAt =
          context.deathBoardIndex === undefined
            ? player.board.length
            : Math.min(
                context.deathBoardIndex + count,
                player.board.length,
              );
        player.board.splice(insertAt, 0, summoned);
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
    } else if (effect.kind === "summonRandomMinion") {
      const candidates = generatedMinionDefinitions(state, effect);
      if (candidates.length === 0) {
        continue;
      }
      if (rejectRecruitSummonForFullBoard(player)) {
        continue;
      }
      const definition = candidates[randomIndex(state, candidates.length)];
      const summoned = createMinionInstance(state, definition.id, 0);
      const statScale =
        effectSourceIsGolden && effect.goldenMode === "doubleSetStats"
          ? 2
          : 1;
      summoned.attack = effect.setAttack * statScale;
      summoned.health = effect.setHealth * statScale;
      summoned.whereverAttackBonus = 0;
      summoned.whereverHealthBonus = 0;
      applyOwnedUndeadArmyBonus(player, summoned);
      applyOwnedBeetleBonus(player, summoned);
      const insertAt = Math.min(
        context.deathBoardIndex ?? player.board.length,
        player.board.length,
      );
      player.board.splice(insertAt, 0, summoned);
      applyRecruitSummonTriggers(state, player, summoned);
    } else if (effect.kind === "castTavernSpellOnAdjacent") {
      const adjacent = recruitDeathrattleAdjacentTargets(
        player,
        context,
      );
      const targets =
        effectSourceIsGolden && effect.goldenMode === "allAdjacent"
          ? adjacent
          : adjacent.length > 0
            ? [adjacent[randomIndex(state, adjacent.length)]]
            : [];
      for (const target of targets) {
        resolveTriggeredRecruitTavernSpellOnTarget(
          state,
          player,
          effect.definitionId,
          target,
        );
      }
    } else if (effect.kind === "triggerAdjacentBattlecries") {
      const eligible = recruitDeathrattleAdjacentTargets(
        player,
        context,
      ).filter(minionHasPrintedBattlecry);
      const targets =
        effectSourceIsGolden && effect.goldenMode === "allAdjacent"
          ? eligible
          : eligible.length > 0
            ? [eligible[randomIndex(state, eligible.length)]]
            : [];
      for (const target of targets) {
        const triggerCount = battlecryTriggerCount(player);
        recordBattlecriesTriggered(player, triggerCount);
        for (let trigger = 0; trigger < triggerCount; trigger += 1) {
          for (const component of minionEffectSources(target)) {
            const definition = getMinionDefinition(
              component.definitionId,
            );
            applyRecruitEffects(
              state,
              player,
              target,
              definition.battlecry,
              component.golden ? 2 : 1,
              { effectSourceDefinitionId: component.definitionId },
            );
            resolveTriggeredRecruitInteractiveBattlecry(
              state,
              player,
              target,
              component,
            );
          }
          observeRecruitBattlecryTriggered(player);
        }
      }
    } else if (effect.kind === "buffThenDamageFriendly") {
      applyRecruitBuffThenDamageFriendly(
        state,
        player,
        source,
        effect,
        effectSourceIsGolden,
      );
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
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
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
        const attackGain =
          (trigger.attack ?? 0) * scale +
          effectCounter(
            watcher,
            SUMMON_ATTACK_GROWTH_COUNTER,
            0,
          );
        summoned.attack += attackGain;
        observeRecruitFriendlyAttackGain(player, summoned, attackGain);
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
        const attackGain = (trigger.attack ?? 0) * scale;
        const healthGain = (trigger.health ?? 0) * scale;
        const triggeredHealth = healthGainedFromExternalAttack(
          summoned,
          attackGain,
        );
        summoned.attack += attackGain;
        summoned.health += healthGain + triggeredHealth;
        observeRecruitFriendlyAttackGain(player, summoned, attackGain);
        observeRecruitFriendlyHealthGain(
          player,
          summoned,
          healthGain + triggeredHealth,
        );
      }
    }
  }
  if (summoned.kind === "minion" && minionHasTribe(summoned, "demon")) {
    resolveShopFodder(state, player);
  }
  if (summoned.kind !== "minion" || !minionHasTribe(summoned, "beast")) {
    return;
  }
  const recruited = summoned as BoardMinionInstance;
  improveFangAnklet(player);
  if (playerOwnsTrinketCardId(player, MAMA_BEAR_STICKER_CARD_ID)) {
    buffMinions([recruited], 5, 5, player.board, player);
  }
  for (const definition of playerTrinkets(player)) {
    if (
      definition.cardId !== WILDFEATHER_DUSTER_CARD_ID ||
      !advanceTrinketCounter(player, definition, 6)
    ) {
      continue;
    }
    const candidates = MINION_DEFINITIONS.filter(
      (candidate) =>
        candidate.tier <= player.tavernTier &&
        definitionIsAvailable(candidate, state.activeTribes) &&
        definitionHasTribe(candidate, "beast"),
    );
    if (candidates.length > 0) {
      addGeneratedMinionCopyToHand(
        state,
        player,
        candidates[randomIndex(state, candidates.length)].id,
      );
    }
  }
}

function applyAfterFriendlyPlayed(
  state: GameState,
  player: PlayerState,
  played: Pick<MinionInstance, "instanceId" | "tribe" | "tribes">,
): void {
  if (minionHasTribe(played, "elemental")) {
    player.elementalsPlayedThisTurn += 1;
    if (
      playerHasHeroPower(
        player,
        "upgradeDiscountAfterElementals",
      )
    ) {
      const progress =
        heroPowerCounter(player, "chenvaalaElementals") + 1;
      if (progress >= 3) {
        setHeroPowerCounter(player, "chenvaalaElementals", 0);
        if (player.tavernTier < 6) {
          for (
            let trigger = 0;
            trigger < heroPowerTriggerMultiplier(player);
            trigger += 1
          ) {
            player.upgradeDiscount += 3;
          }
        }
      } else {
        setHeroPowerCounter(
          player,
          "chenvaalaElementals",
          progress,
        );
      }
    }
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
      observeRecruitFriendlyAttackGain(
        player,
        watcher,
        (trigger.attack ?? 0) * scale,
      );
      observeRecruitFriendlyHealthGain(
        player,
        watcher,
        (trigger.health ?? 0) * scale,
      );
      damageRecruitPlayer(player, (trigger.heroDamage ?? 0) * scale);
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
    (playerHasTrinketCardId(player, DRAKKARI_PORTRAIT_CARD_ID) ? 1 : 0) +
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
  player: PlayerState,
  attack: number,
  health: number,
): void {
  buffMinions(
    selectDistinctMinionsByTribe(state, player.board),
    attack,
    health,
    player.board,
    player,
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
        { effectSourceDefinitionId: component.definitionId },
      );
    }
  }
}

function observeMinionConsumed(player: PlayerState): void {
  for (const watcher of [...player.board]) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterMinionConsumed;
      if (
        !trigger ||
        !player.board.some(
          (candidate) => candidate.instanceId === watcher.instanceId,
        )
      ) {
        continue;
      }
      const scale =
        component.golden && trigger.goldenMode === "doubleStats"
          ? 2
          : 1;
      const attack = trigger.tavernAttackThisTurn * scale;
      const health = trigger.tavernHealthThisTurn * scale;
      buffTavernMinionsThisTurn(player, attack, health);
    }
  }
}

function finishConsumedShopMinion(
  state: GameState,
  player: PlayerState,
  consumed: BoardMinionInstance,
): void {
  returnMinionToPool(state, consumed);
  observeMinionConsumed(player);
}

function consumeShopMinionInto(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
  consumed: BoardMinionInstance,
  statScale: number,
  statGrantBonus: CombatStatBuff = { attack: 0, health: 0 },
): void {
  const attackGain = consumed.attack * statScale + statGrantBonus.attack;
  const triggeredHealth = player.board.some(
    (candidate) => candidate.instanceId === target.instanceId,
  )
    ? healthGainedFromExternalAttack(target, attackGain)
    : 0;
  target.attack += attackGain;
  const healthGain = consumed.health * statScale + statGrantBonus.health;
  target.health += healthGain + triggeredHealth;
  reconcileConditionalMinion(target);
  observeRecruitFriendlyAttackGain(player, target, attackGain);
  observeRecruitFriendlyHealthGain(
    player,
    target,
    healthGain + triggeredHealth,
  );
  finishConsumedShopMinion(state, player, consumed);
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
  const attackGain = consumed.attack * statScale;
  const healthGain = consumed.health * statScale;
  const elementalGrantBonus = recruitElementalStatGrantBonus(
    player,
    source,
    { effectSourceDefinitionId: source.definitionId },
  );
  const sourceIndex = player.board.findIndex(
    (minion) => minion.instanceId === source.instanceId,
  );
  const portraitNeighbors =
    source.definitionId === FELFIRE_EXECUTOR_DEFINITION_ID &&
    playerHasTrinketCardId(player, FLAMING_PORTRAIT_CARD_ID)
      ? [player.board[sourceIndex - 1], player.board[sourceIndex + 1]].filter(
          (minion): minion is BoardMinionInstance => minion !== undefined,
        )
      : [];
  consumeShopMinionInto(
    state,
    player,
    source,
    consumed,
    statScale,
    elementalGrantBonus,
  );
  buffMinions(
    portraitNeighbors,
    attackGain + elementalGrantBonus.attack,
    healthGain + elementalGrantBonus.health,
    player.board,
    player,
  );
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
    consumeShopMinionInto(state, player, demon, consumed, statScale);
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
  if (rejectRecruitSummonForFullBoard(player)) {
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
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
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
    addCardToHand(
      state,
      player,
      createTavernSpell(state, definition),
    );
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

  if (effect.kind === "gainUpgradingMagneticSatellites") {
    const statScale =
      source.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
    const attack =
      effect.attack * statScale +
      effectCounter(
        source,
        MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
        0,
      );
    const health =
      effect.health * statScale +
      effectCounter(
        source,
        MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
        0,
      );
    for (let count = 0; count < effect.count; count += 1) {
      if (player.hand.length >= MAX_HAND_SIZE) {
        break;
      }
      const satellite = createMinionInstance(
        state,
        effect.definitionId,
        0,
      );
      satellite.attack = attack;
      satellite.health = health;
      if (!addCardToHand(state, player, satellite)) {
        break;
      }
      resolveTriples(state, player);
    }
    setEffectCounter(
      source,
      MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
      effectCounter(
        source,
        MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
        0,
      ) + effect.attack * statScale,
    );
    setEffectCounter(
      source,
      MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
      effectCounter(
        source,
        MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
        0,
      ) + effect.health * statScale,
    );
    refreshDynamicMinionDescription(source, player);
    return;
  }

  if (effect.kind === "giveStatsToLeftmostHandMinion") {
    const target = player.hand.find(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    if (target) {
      const statScale =
        effect.goldenMode === "doubleStats" ? scale : 1;
      buffMinions(
        [target],
        source.attack * statScale,
        source.health * statScale,
        player.board,
        player,
      );
    }
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
      player.board,
      player,
    );
    return;
  }

  if (effect.kind === "leftmostTribeRepeatPerCardPlayed") {
    const target = player.board.find((minion) =>
      minionHasTribe(minion, effect.tribe),
    );
    if (target) {
      const repetitions = 1 + player.cardsPlayedThisTurn;
      for (let repetition = 0; repetition < repetitions; repetition += 1) {
        buffMinions(
          [target],
          effect.attack * scale,
          effect.health * scale,
          player.board,
          player,
        );
      }
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
      player,
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
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    buffMinions(
      targets,
      effect.attack * scale,
      effect.health * scale,
      player.board,
      player,
    );
  }
}

function applyEndOfTurnEffects(
  state: GameState,
  player: PlayerState,
): void {
  const triggerCount = endOfTurnTriggerCount(player);
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      const definition = getMinionDefinition(component.definitionId);
      if (definition.sellDiscover) {
        setEffectCounter(
          source,
          PATIENT_SCOUT_TIER_COUNTER,
          Math.min(
            definition.sellDiscover.maximumTier,
            effectCounter(
              source,
              PATIENT_SCOUT_TIER_COUNTER,
              definition.sellDiscover.initialTier,
            ) + triggerCount,
          ),
        );
        refreshDynamicMinionDescription(source, player);
      }
      const evolvingRewardTier =
        definition.spellcraft?.evolvingRewardTier;
      if (evolvingRewardTier) {
        setEffectCounter(
          source,
          EVOLVING_SPELLCRAFT_TIER_COUNTER,
          Math.min(
            evolvingRewardTier.maximumTier,
            effectCounter(
              source,
              EVOLVING_SPELLCRAFT_TIER_COUNTER,
              evolvingRewardTier.initialTier,
            ) + triggerCount,
          ),
        );
        refreshDynamicMinionDescription(source, player);
      }
      const effect = definition.endOfTurn;
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
        { effectSourceDefinitionId: component.definitionId },
      );
    }
  }
}

interface TripleCombination {
  definitionId: string;
  consumed: BoardMinionInstance[];
  mixed: boolean;
}

function ownedTripleMinions(player: PlayerState): BoardMinionInstance[] {
  return [
    ...player.board,
    ...player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
  ];
}

function findTripleCombination(
  state: GameState,
  player: PlayerState,
): TripleCombination | null {
  const owned = ownedTripleMinions(player);
  const orderedDefinitionIds = [...new Set(owned.map((minion) => minion.definitionId))];

  // Ordinary triples always resolve before a wildcard can consume one of the
  // same cards. This also makes three regular Elementals of Surprise become a
  // Golden Elemental of Surprise instead of targeting an unrelated Elemental.
  for (const definitionId of orderedDefinitionIds) {
    const definition = getMinionDefinition(definitionId);
    if (definition.canTriple === false) {
      continue;
    }
    const matches = owned.filter(
      (minion) =>
        minion.definitionId === definitionId && minion.golden === false,
    );
    const copiesRequired =
      playerHasTrinketCardId(player, GOLDEN_PIRATE_STICKER_CARD_ID) &&
      definitionHasTribe(definition, "pirate")
        ? 2
        : 3;
    if (matches.length >= copiesRequired) {
      return {
        definitionId,
        consumed: matches.slice(0, copiesRequired),
        mixed: false,
      };
    }
  }

  const wildcardMinions = owned.filter(
    (minion) =>
      getMinionDefinition(minion.definitionId).tripleWildcardFor !==
      undefined,
  );
  if (wildcardMinions.length === 0) {
    return null;
  }

  // The Golden wildcard keeps the same text. Three wildcard card entities can
  // therefore combine again even when one or more of them is already Golden;
  // their existing stats and exact pool ledgers become enchantments on the
  // resulting Golden wildcard.
  for (const definitionId of orderedDefinitionIds) {
    const definition = getMinionDefinition(definitionId);
    if (definition.tripleWildcardFor === undefined) {
      continue;
    }
    const matches = wildcardMinions.filter(
      (minion) => minion.definitionId === definitionId,
    );
    if (matches.length >= 3) {
      return {
        definitionId,
        consumed: matches.slice(0, 3),
        mixed: false,
      };
    }
  }

  const candidatePlans: TripleCombination[] = [];
  for (const definitionId of orderedDefinitionIds) {
    const definition = getMinionDefinition(definitionId);
    if (definition.tripleWildcardFor !== undefined) {
      continue;
    }
    const targets = owned.filter(
      (minion) =>
        minion.definitionId === definitionId && minion.golden === false,
    );
    if (targets.length === 0 || targets.length >= 3) {
      continue;
    }
    const compatibleWildcards = wildcardMinions.filter((wildcard) => {
      const tribe = getMinionDefinition(
        wildcard.definitionId,
      ).tripleWildcardFor;
      return tribe !== undefined && definitionHasTribe(definition, tribe);
    });
    const targetCount = Math.min(2, targets.length);
    const wildcardCount = 3 - targetCount;
    if (compatibleWildcards.length < wildcardCount) {
      continue;
    }
    candidatePlans.push({
      definitionId,
      consumed: [
        ...targets.slice(0, targetCount),
        ...compatibleWildcards.slice(0, wildcardCount),
      ],
      mixed: true,
    });
  }
  return candidatePlans.length === 0
    ? null
    : candidatePlans[randomIndex(state, candidatePlans.length)];
}

function addMinionPoolOwnership(
  ownership: Record<string, number>,
  minion: BoardMinionInstance,
): void {
  if (minion.poolCopiesByDefinitionId) {
    for (const [definitionId, copies] of Object.entries(
      minion.poolCopiesByDefinitionId,
    )) {
      ownership[definitionId] =
        (ownership[definitionId] ?? 0) + copies;
    }
    return;
  }
  if (minion.poolCopies > 0) {
    ownership[minion.definitionId] =
      (ownership[minion.definitionId] ?? 0) + minion.poolCopies;
  }
}

function shouldDeferTripleResolution(
  state: GameState,
  player: PlayerState,
  combatContext?: CombatContext,
): boolean {
  return (
    combatContext !== undefined ||
    state.deferredTriplePlayerIds.includes(player.id)
  );
}

function resolveTriples(
  state: GameState,
  player: PlayerState,
  combatContext?: CombatContext,
): void {
  if (shouldDeferTripleResolution(state, player, combatContext)) {
    return;
  }
  let combined = true;
  while (combined) {
    combined = false;
    const combination = findTripleCombination(state, player);
    if (!combination) {
      break;
    }
    for (const definitionId of [combination.definitionId]) {
      const consumed = combination.consumed;
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
          (combination.mixed && minion.definitionId !== definitionId
            ? minion.attack
            : minion.attack -
              definition.attack -
              undeadArmyAttack -
              beetleAttack -
              (minion.whereverAttackBonus ?? 0)),
        0,
      );
      const extraHealth = consumed.reduce(
        (total, minion) =>
          total +
          (combination.mixed && minion.definitionId !== definitionId
            ? minion.health
            : minion.health -
              definition.health -
              undeadArmyHealth -
              beetleHealth -
              (minion.whereverHealthBonus ?? 0)),
        0,
      );
      const poolOwnership: Record<string, number> = {};
      for (const minion of consumed) {
        addMinionPoolOwnership(poolOwnership, minion);
      }
      const golden = createMinionInstance(
        state,
        definitionId,
        consumed.reduce((total, minion) => total + minion.poolCopies, 0),
      );
      const deathlyStrikerCreatorIds = [
        ...new Set(
          consumed.flatMap(
            (minion) => minion.deathlyStrikerCreatorIds ?? [],
          ),
        ),
      ];
      if (deathlyStrikerCreatorIds.length > 0) {
        golden.deathlyStrikerCreatorIds = deathlyStrikerCreatorIds;
      }
      if (definitionId === DEATHLY_STRIKER_DEFINITION_ID) {
        golden.deathlyStrikerLineageIds = [
          ...new Set([
            ...consumed.flatMap(
              (minion) =>
                minion.deathlyStrikerLineageIds ?? [minion.instanceId],
            ),
            golden.instanceId,
          ]),
        ];
      }
      const representedDefinitions = Object.keys(poolOwnership).filter(
        (ownedDefinitionId) => poolOwnership[ownedDefinitionId] > 0,
      );
      if (
        representedDefinitions.length > 1 ||
        (representedDefinitions.length === 1 &&
          representedDefinitions[0] !== definitionId)
      ) {
        golden.poolCopiesByDefinitionId = poolOwnership;
      }
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
      golden.suppressedBloodGemAttack = consumed.reduce(
        (total, minion) =>
          total + (minion.suppressedBloodGemAttack ?? 0),
        0,
      );
      golden.suppressedBloodGemHealth = consumed.reduce(
        (total, minion) =>
          total + (minion.suppressedBloodGemHealth ?? 0),
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
      golden.crabDeathrattles = consumed.reduce(
        (total, minion) => total + (minion.crabDeathrattles ?? 0),
        0,
      );
      golden.goldenCrabDeathrattles = consumed.reduce(
        (total, minion) =>
          total + (minion.goldenCrabDeathrattles ?? 0),
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
      if (definition.sellDiscover) {
        setEffectCounter(
          golden,
          PATIENT_SCOUT_TIER_COUNTER,
          Math.max(
            ...consumed.map((minion) =>
              effectCounter(
                minion,
                PATIENT_SCOUT_TIER_COUNTER,
                definition.sellDiscover?.initialTier ?? 1,
              ),
            ),
          ),
        );
      }
      if (definition.spellcraft?.evolvingRewardTier) {
        setEffectCounter(
          golden,
          EVOLVING_SPELLCRAFT_TIER_COUNTER,
          Math.max(
            ...consumed.map((minion) =>
              effectCounter(
                minion,
                EVOLVING_SPELLCRAFT_TIER_COUNTER,
                definition.spellcraft?.evolvingRewardTier
                  ?.initialTier ?? 1,
              ),
            ),
          ),
        );
      }
      if (definition.afterPlayerSpellCast) {
        setEffectCounter(
          golden,
          PLAYER_SPELL_PROGRESS_COUNTER,
          Math.max(
            ...consumed.map((minion) =>
              effectCounter(minion, PLAYER_SPELL_PROGRESS_COUNTER, 0),
            ),
          ),
        );
      }
      if (definition.afterTavernSpellPurchased) {
        setEffectCounter(
          golden,
          TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER,
          Math.max(
            ...consumed.map((minion) =>
              effectCounter(
                minion,
                TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER,
                0,
              ),
            ),
          ),
        );
      }
      if (definition.afterMinionPurchased) {
        setEffectCounter(
          golden,
          STONE_AGE_SLAB_PURCHASE_USED_COUNTER,
          Math.max(
            ...consumed.map((minion) =>
              effectCounter(
                minion,
                STONE_AGE_SLAB_PURCHASE_USED_COUNTER,
                0,
              ),
            ),
          ),
        );
      }
      if (
        definition.afterCardPlayed?.effects.some(
          (effect) => effect.kind === "improveTavernSpellAuraThisTurn",
        )
      ) {
        for (const counter of [
          TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER,
          TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
          TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
        ] as const) {
          setEffectCounter(
            golden,
            counter,
            Math.max(
              ...consumed.map((minion) =>
                effectCounter(minion, counter, 0),
              ),
            ),
          );
        }
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
        definition.endOfTurn?.kind ===
        "gainUpgradingMagneticSatellites"
      ) {
        setEffectCounter(
          golden,
          MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
                0,
              ),
            0,
          ),
        );
        setEffectCounter(
          golden,
          MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
          consumed.reduce(
            (total, minion) =>
              total +
              effectCounter(
                minion,
                MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
                0,
              ),
            0,
          ),
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
      const hasPermanentVenomous =
        definition.venomous === true ||
        consumed.some(
          (minion) =>
            minion.venomous && minion.temporaryVenomous !== true,
        );
      golden.temporaryVenomous =
        !hasPermanentVenomous &&
        consumed.some(
          (minion) => minion.temporaryVenomous === true,
        );
      golden.venomous =
        hasPermanentVenomous || golden.temporaryVenomous;
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
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
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
      addCardToHand(state, player, golden);
      combined = true;
      break;
    }
  }
}

function applyAfterCardPurchaseTrinkets(
  state: GameState,
  player: PlayerState,
): void {
  for (const trinket of trinketsWithEffect(
    player,
    "buffAfterPurchase",
  )) {
    const candidates = [...player.board];
    const count = Math.min(trinket.count ?? 0, candidates.length);
    for (let index = 0; index < count; index += 1) {
      const targetIndex = randomIndex(state, candidates.length);
      const [target] = candidates.splice(targetIndex, 1);
      if (target) {
        buffMinions(
          [target],
          trinket.attack ?? 0,
          trinket.health ?? 0,
          player.board,
          player,
        );
      }
    }
  }
}

function applyAfterMinionPurchasedHeroPower(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (
    playerHasHeroPower(player, "piratePurchaseRefund") &&
    minionHasTribe(minion, "pirate")
  ) {
    for (
      let trigger = 0;
      trigger < heroPowerTriggerMultiplier(player);
      trigger += 1
    ) {
      player.gold += 1;
    }
  }
  if (
    !playerHasHeroPower(
      player,
      "tavernCoinAfterThreeMinions",
    )
  ) {
    return;
  }
  const progress = heroPowerCounter(player, "kaelthasMinions") + 1;
  if (progress < 3) {
    setHeroPowerCounter(player, "kaelthasMinions", progress);
    return;
  }
  setHeroPowerCounter(player, "kaelthasMinions", 0);
  for (
    let trigger = 0;
    trigger < heroPowerTriggerMultiplier(player) &&
    player.hand.length < MAX_HAND_SIZE;
    trigger += 1
  ) {
    addCardToHand(
      state,
      player,
      createTavernSpell(
        state,
        getTavernSpellDefinition("tavern-spell-tavern-coin"),
      ),
    );
  }
}

function applyGoldenWarbandPurchaseTrinket(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  const representedTribes = state.activeTribes.filter((tribe) =>
    player.board.some((owned) => minionHasTribe(owned, tribe)),
  );
  if (
    representedTribes.length === 0 ||
    !representedTribes.some((tribe) => minionHasTribe(minion, tribe))
  ) {
    return;
  }
  for (const trinket of playerTrinkets(player)) {
    if (
      trinket.cardId !== GOLDEN_WARBAND_PURCHASE_CARD_ID ||
      (player.trinketCounters[trinket.id] ?? 0) <= 0
    ) {
      continue;
    }
    player.trinketCounters[trinket.id] = 0;
    makeMinionGoldenPreservingEnchantments(minion);
    reconcileWhereverMinion(
      minion,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
    refreshDynamicMinionDescription(minion, player);
    return;
  }
}

function buyMinion(
  state: GameState,
  player: PlayerState,
  shopIndex: number,
): boolean {
  const quote = getMinionPurchaseQuote(state, player.id, shopIndex);
  if (!quote?.affordable) {
    return false;
  }
  const [minion] = player.shop.splice(shopIndex, 1);
  if (minion.effectCounters) {
    delete minion.effectCounters[DEMONIC_TAPESTRY_HEALTH_PRICE_COUNTER];
    delete minion.effectCounters[CHILLMERE_MOSAIC_COST_COUNTER];
  }
  claimGeneratedShopMinion(minion);
  applyGoldenWarbandPurchaseTrinket(state, player, minion);
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  refreshDynamicMinionDescription(minion, player);
  addCardToHand(state, player, minion);
  if (quote.currency === "health") {
    player.health -= quote.cost;
  } else {
    spendGold(state, player, quote.cost);
  }
  recordFirstPirateFreeTrinketProgress(player, minion);
  recordHealthPurchaseTrinketProgress(
    player,
    "minion",
    minion,
    quote.currency,
  );
  observeCardPurchase(state, player, {
    kind: "minion",
    definitionId: minion.definitionId,
    instanceId: minion.instanceId,
  });
  applyAfterCardPurchaseTrinkets(state, player);
  applyAfterMinionPurchasedTrinkets(
    state,
    player,
    minion.definitionId,
  );
  resolveTriples(state, player);
  applyAfterMinionPurchasedHeroPower(state, player, minion);
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
  const quote = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spell.instanceId,
  );
  if (!quote?.affordable) {
    return false;
  }
  const currency = quote.currency;
  const usesFreeTavernSpellPurchase =
    player.freeTavernSpellPurchases > 0 &&
    !usesTaeThelanFreeTavernSpell(player);
  const cost = quote.cost;
  state.spellPool[spell.definitionId] =
    (state.spellPool[spell.definitionId] ?? 0) + 1;
  addCardToHand(state, player, spell);
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
  }
  if (tavernSpellPurchaseCurrency(spell) === "gold") {
    player.nextTavernSpellDiscount = 0;
  }
  if (usesFreeTavernSpellPurchase) {
    player.freeTavernSpellPurchases -= 1;
  }
  if (playerHasHeroPower(player, "freeFourthTavernSpell")) {
    setHeroPowerCounter(
      player,
      "taethelanSpells",
      (heroPowerCounter(player, "taethelanSpells") + 1) % 4,
    );
  }
  recordHealthPurchaseTrinketProgress(
    player,
    "tavernSpell",
    undefined,
    currency,
  );
  observeCardPurchase(state, player, {
    kind: "tavernSpell",
    definitionId: spell.definitionId,
    instanceId: spell.instanceId,
  });
  applyAfterCardPurchaseTrinkets(state, player);
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

function beginSellDiscover(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  const definition = getMinionDefinition(minion.definitionId);
  const spec = definition.sellDiscover;
  if (!spec) {
    return;
  }
  const exactTier = Math.max(
    spec.initialTier,
    Math.min(
      spec.maximumTier,
      effectCounter(
        minion,
        PATIENT_SCOUT_TIER_COUNTER,
        spec.initialTier,
      ),
    ),
  ) as TavernTier;
  const discoveries =
    spec.discoveries *
    (minion.golden && spec.goldenMode === "doubleCount" ? 2 : 1);
  const started = beginDiscoverInteraction(
    state,
    player,
    minion.instanceId,
    { exactTier },
    discoveries,
    { kind: "hand", allowOverflow: true },
  );
  if (
    started &&
    state.pendingInteraction?.kind === "discover" &&
    state.pendingInteraction.sourceInstanceId === minion.instanceId
  ) {
    state.pendingInteraction.sourceDefinitionId = definition.id;
  }
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
  beginSellDiscover(state, player, minion);
  for (const watcher of [...player.board]) {
    for (const component of minionEffectSources(watcher)) {
      applyRecruitEffects(
        state,
        player,
        watcher,
        getMinionDefinition(component.definitionId).afterFriendlySold,
        component.golden ? 2 : 1,
        { effectSourceDefinitionId: component.definitionId },
      );
    }
  }
  if (playerHasHeroPower(player, "goldAfterSellNextTurn")) {
    const triggerCount = heroPowerTriggerMultiplier(player);
    player.pendingNextTurnGold += triggerCount;
    setHeroPowerCounter(
      player,
      "smartSavingsGold",
      heroPowerCounter(player, "smartSavingsGold") + triggerCount,
    );
  }
  applyAfterMinionSoldTrinkets(state, player);
  return minion;
}

function sellMinion(
  state: GameState,
  player: PlayerState,
  boardIndex: number,
): boolean {
  const sold = sellMinionTransaction(state, player, boardIndex) !== null;
  if (sold) {
    applyGoldThresholdTrinket(state, player);
  }
  return sold;
}

function fearlessFoodieOptionIds(
  golden: boolean,
): [MinionChoiceId, MinionChoiceId] {
  return golden
    ? ["BG30_123_Gt", "BG30_123_Gt2"]
    : ["BG30_123t", "BG30_123t2"];
}

function buddingBotanistOptionIds(
  golden: boolean,
): [MinionChoiceId, MinionChoiceId] {
  return golden
    ? ["BG32_237_Gt", "BG32_237_Gt2"]
    : ["BG32_237t", "BG32_237t2"];
}

function adaptableBeetleOptionIds(
  golden: boolean,
): [MinionChoiceId, MinionChoiceId] {
  return golden
    ? ["BG27_084_Gt", "BG27_084_Gt2"]
    : ["BG27_084t", "BG27_084t2"];
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

function applyTavernSpellBuffChoice(
  player: PlayerState,
  source: BoardMinionInstance,
  optionId: MinionChoiceId,
  effectMultiplier: 1 | 2,
): boolean {
  const effect = getMinionDefinition(source.definitionId).onPlayChoice;
  const optionIds = buddingBotanistOptionIds(source.golden);
  const expectedMultiplier: 1 | 2 =
    source.golden && effect?.goldenMode === "doubleValues" ? 2 : 1;
  if (
    effect?.kind !== "tavernSpellBuff" ||
    !optionIds.includes(optionId) ||
    effectMultiplier !== expectedMultiplier
  ) {
    return false;
  }
  if (optionId === optionIds[0]) {
    player.tavernSpellAttackBonus += effect.attack * effectMultiplier;
  } else {
    player.tavernSpellHealthBonus += effect.health * effectMultiplier;
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

function chooseAiTavernSpellBuffOption(
  player: PlayerState,
  source: BoardMinionInstance,
): MinionChoiceId {
  const [attackOption, healthOption] = buddingBotanistOptionIds(
    source.golden,
  );
  const totalAttack = player.board.reduce(
    (total, minion) => total + minion.attack,
    0,
  );
  const totalHealth = player.board.reduce(
    (total, minion) => total + minion.health,
    0,
  );
  return totalAttack <= totalHealth ? attackOption : healthOption;
}

interface AdaptableBeetleBranch {
  optionId: MinionChoiceId;
  attack: number;
  health: number;
  keyword: "reborn" | "windfury";
}

function adaptableBeetleBranch(
  source: BoardMinionInstance,
  optionId: MinionChoiceId,
  effectMultiplier: 1 | 2,
): AdaptableBeetleBranch | null {
  const effect = getMinionDefinition(source.definitionId).onPlayChoice;
  if (effect?.kind !== "beastKeywordBuff") {
    return null;
  }
  const expectedMultiplier: 1 | 2 =
    source.golden && effect.goldenMode === "doubleValues" ? 2 : 1;
  if (effectMultiplier !== expectedMultiplier) {
    return null;
  }
  const [rebornOption, windfuryOption] = adaptableBeetleOptionIds(
    source.golden,
  );
  if (optionId === rebornOption) {
    return {
      optionId,
      attack: effect.rebornAttack * effectMultiplier,
      health: effect.rebornHealth * effectMultiplier,
      keyword: "reborn",
    };
  }
  if (optionId === windfuryOption) {
    return {
      optionId,
      attack: effect.windfuryAttack * effectMultiplier,
      health: effect.windfuryHealth * effectMultiplier,
      keyword: "windfury",
    };
  }
  return null;
}

function adaptableBeetleTargets(
  player: PlayerState,
  source: BoardMinionInstance,
): BoardMinionInstance[] {
  // Choose One locks its target before Adaptable Beetle itself enters play.
  return player.board.filter(
    (candidate) =>
      candidate.instanceId !== source.instanceId &&
      minionHasTribe(candidate, "beast"),
  );
}

function chooseAiAdaptableBeetleBranch(
  player: PlayerState,
  source: BoardMinionInstance,
  effectMultiplier: 1 | 2,
): { branch: AdaptableBeetleBranch; target: BoardMinionInstance } | null {
  const candidates = adaptableBeetleTargets(player, source);
  if (candidates.length === 0) {
    return null;
  }
  const optionIds = adaptableBeetleOptionIds(source.golden);
  const branches = optionIds
    .map((optionId) =>
      adaptableBeetleBranch(source, optionId, effectMultiplier),
    )
    .filter((branch): branch is AdaptableBeetleBranch => branch !== null);
  const choices = branches.flatMap((branch) =>
    candidates.map((target) => ({
      branch,
      target,
      score:
        minionScore(player, target) * 0.08 +
        branch.attack +
        branch.health +
        (target[branch.keyword]
          ? 0
          : branch.keyword === "reborn"
            ? 5
            : Math.max(3, target.attack * 0.55)),
    })),
  );
  return choices.sort((left, right) => {
    const difference = right.score - left.score;
    return difference !== 0
      ? difference
      : left.target.instanceId.localeCompare(right.target.instanceId);
  })[0] ?? null;
}

function beginAdaptableBeetleTarget(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  optionId: MinionChoiceId,
  effectMultiplier: 1 | 2,
): boolean {
  const branch = adaptableBeetleBranch(
    source,
    optionId,
    effectMultiplier,
  );
  const candidates = adaptableBeetleTargets(player, source);
  if (!branch || candidates.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    const target =
      chooseAiAdaptableBeetleBranch(
        player,
        source,
        effectMultiplier,
      )?.target ?? bestMinionByScore(player, candidates);
    buffMinions(
      [target],
      branch.attack,
      branch.health,
      player.board,
      player,
    );
    target[branch.keyword] = true;
    return false;
  }
  state.pendingInteraction = {
    kind: "target",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: source.instanceId,
    optionInstanceIds: candidates.map((candidate) => candidate.instanceId),
    attack: branch.attack,
    health: branch.health,
    repetitions: 1,
    grantKeywords: [branch.keyword],
    resolution: { kind: "buff" },
  };
  return true;
}

function beginOnPlayMinionChoice(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
): boolean {
  const effect = getMinionDefinition(source.definitionId).onPlayChoice;
  if (!effect) {
    return false;
  }
  const effectMultiplier: 1 | 2 =
    source.golden && effect.goldenMode === "doubleValues" ? 2 : 1;
  const optionIds =
    effect.kind === "bloodGemImproveOrGain"
      ? fearlessFoodieOptionIds(source.golden)
      : effect.kind === "tavernSpellBuff"
        ? buddingBotanistOptionIds(source.golden)
        : adaptableBeetleOptionIds(source.golden);
  if (!player.isHuman) {
    if (effect.kind === "bloodGemImproveOrGain") {
      applyBloodGemImproveOrGainChoice(
        state,
        player,
        source,
        chooseAiBloodGemImproveOrGainOption(state, player, source),
        effectMultiplier,
      );
    } else if (effect.kind === "tavernSpellBuff") {
      applyTavernSpellBuffChoice(
        player,
        source,
        chooseAiTavernSpellBuffOption(player, source),
        effectMultiplier,
      );
    } else {
      const choice = chooseAiAdaptableBeetleBranch(
        player,
        source,
        effectMultiplier,
      );
      if (choice) {
        buffMinions(
          [choice.target],
          choice.branch.attack,
          choice.branch.health,
          player.board,
          player,
        );
        choice.target[choice.branch.keyword] = true;
      }
    }
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
  if (MRRGLTON_DEFINITION_IDS.has(minion.definitionId)) {
    player.mrrgltonsPlayed += 1;
  }
  const definition = getMinionDefinition(minion.definitionId);
  const battlecry = definition.battlecry;
  const triggerCount =
    minionHasPrintedBattlecry(minion) ||
    definition.battlecryCastsTaughtTavernSpell === true
    ? battlecryTriggerCountForPlay(state, player)
    : 0;
  recordBattlecriesTriggered(player, triggerCount);
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, minion, battlecry);
    if (battlecry && battlecry.length > 0) {
      observeRecruitBattlecryTriggered(player);
    }
  }
  const taughtSpellInteractionStarted =
    definition.battlecryCastsTaughtTavernSpell === true
      ? beginTaughtTavernSpellBattlecry(
          state,
          player,
          minion,
          triggerCount,
        )
      : false;
  if (!taughtSpellInteractionStarted) {
    beginInteractiveBattlecry(state, player, minion, triggerCount);
  }
  if (
    triggerCount > 0 &&
    (!battlecry || battlecry.length === 0) &&
    definition.battlecryCastsTaughtTavernSpell !== true &&
    definition.interactiveBattlecry === undefined
  ) {
    for (let trigger = 0; trigger < triggerCount; trigger += 1) {
      observeRecruitBattlecryTriggered(player);
    }
  }
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
  /** Resolve card text after removal but before death observers/Deathrattles. */
  beforeDeath?: (destroyed: BoardMinionInstance) => void;
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

  const deathAdjacentInstanceIds = [
    player.board[boardIndex - 1],
    player.board[boardIndex + 1],
  ]
    .filter(
      (neighbor): neighbor is BoardMinionInstance =>
        neighbor !== undefined && neighbor.health > 0,
    )
    .map((neighbor) => neighbor.instanceId);

  player.board.splice(boardIndex, 1);
  if (options.returnToPool !== false) {
    returnMinionToPool(state, source);
  }
  options.beforeDeath?.(source);
  observePersistentFriendlyDeath(player, source);
  for (const watcher of player.board) {
    for (const component of minionEffectSources(watcher)) {
      const definition = getMinionDefinition(component.definitionId);
      const trigger = definition.afterFriendlyDied;
      const scale = component.golden ? 2 : 1;
      if (trigger && friendlyDeathMatches(source, trigger)) {
        watcher.attack += (trigger.attack ?? 0) * scale;
        watcher.health += (trigger.health ?? 0) * scale;
        observeRecruitFriendlyAttackGain(
          player,
          watcher,
          (trigger.attack ?? 0) * scale,
        );
        observeRecruitFriendlyHealthGain(
          player,
          watcher,
          (trigger.health ?? 0) * scale,
        );
        applyRecruitEffects(
          state,
          player,
          watcher,
          trigger.effects,
          scale,
          { effectSourceDefinitionId: component.definitionId },
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
  if (minionHasTriggerableDeathrattle(source)) {
    activateThornedPauldrons(player);
  }
  for (const component of minionEffectSources(source)) {
    const deathrattle =
      getMinionDefinition(component.definitionId).deathrattle;
    if (!deathrattle || deathrattle.length === 0) {
      continue;
    }
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      observeRecruitDeathrattleTriggered(player);
      applyRecruitEffects(
        state,
        player,
        source,
        deathrattle,
        component.golden ? 2 : 1,
        {
          deathBoardIndex: boardIndex,
          deathAdjacentInstanceIds,
          effectSourceDefinitionId: component.definitionId,
        },
      );
    }
  }
  const crabDeathrattlePulses =
    ((source.crabDeathrattles ?? 0) +
      source.temporaryCrabDeathrattles) * repetitions;
  for (let count = 0; count < crabDeathrattlePulses; count += 1) {
    observeRecruitDeathrattleTriggered(player);
    if (rejectRecruitSummonForFullBoard(player)) {
      continue;
    }
    const crab = createMinionInstance(state, "live-crab-token", 0);
    player.board.splice(
      Math.min(boardIndex + count, player.board.length),
      0,
      crab,
    );
    applyRecruitSummonTriggers(state, player, crab);
  }
  const goldenCrabDeathrattlePulses =
    ((source.goldenCrabDeathrattles ?? 0) +
      (source.temporaryGoldenCrabDeathrattles ?? 0)) * repetitions;
  for (
    let count = 0;
    count < goldenCrabDeathrattlePulses;
    count += 1
  ) {
    observeRecruitDeathrattleTriggered(player);
    if (rejectRecruitSummonForFullBoard(player)) {
      continue;
    }
    const crab = createMinionInstance(state, "live-crab-token", 0);
    makeGoldenToken(crab);
    player.board.splice(
      Math.min(
        boardIndex +
          crabDeathrattlePulses +
          count,
        player.board.length,
      ),
      0,
      crab,
    );
    applyRecruitSummonTriggers(state, player, crab);
  }
  if (source.reborn && !rejectRecruitSummonForFullBoard(player)) {
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

function gainPlainMinionCopies(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  count: number,
): number {
  let gained = 0;
  for (let copy = 0; copy < count; copy += 1) {
    if (player.hand.length >= MAX_HAND_SIZE) {
      break;
    }
    const minion = createMinionInstance(state, definitionId, 0);
    applyOwnedUndeadArmyBonus(player, minion);
    applyOwnedBeetleBonus(player, minion);
    reconcileWhereverMinion(
      minion,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
    if (addCardToHand(state, player, minion)) {
      gained += 1;
    }
    resolveTriples(state, player);
  }
  return gained;
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

function applyCopperCoilBeforeMagnetize(
  player: PlayerState,
  source: BoardMinionInstance,
): void {
  for (const { definition, value } of configuredOwnedTrinkets(
    player,
    COPPER_COIL_BUFF_BY_CARD_ID,
  )) {
    const priorTriggers = Math.max(
      0,
      Math.floor(player.trinketCounters[definition.id] ?? 0),
    );
    const multiplier = priorTriggers + 1;
    buffMinions(
      [source],
      value.attack * multiplier,
      value.health * multiplier,
      undefined,
      player,
    );
    player.trinketCounters[definition.id] = priorTriggers + 1;
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
  const triggerCount = minionHasPrintedBattlecry(source)
    ? battlecryTriggerCountForPlay(state, player)
    : 0;
  recordBattlecriesTriggered(player, triggerCount);
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, source, battlecry);
    if (battlecry && battlecry.length > 0) {
      observeRecruitBattlecryTriggered(player);
    }
  }

  applyCopperCoilBeforeMagnetize(player, source);
  fuseMinionIntoHost(state, player, source, target);

  applyAfterMagnetizedEffects(state, player);
  finishCardPlayed(state, player);
  return true;
}

function applyMagneticSourceToHost(
  player: PlayerState,
  source: BoardMinionInstance,
  target: BoardMinionInstance,
  elementalGrantBonus: { attack: number; health: number },
): void {
  const attackGain = source.attack + elementalGrantBonus.attack;
  const healthGain = source.health + elementalGrantBonus.health;
  target.attack += attackGain;
  target.health += healthGain;
  observeRecruitFriendlyAttackGain(player, target, attackGain);
  observeRecruitFriendlyHealthGain(player, target, healthGain);
  target.bloodGemAttack += source.bloodGemAttack;
  target.bloodGemHealth += source.bloodGemHealth;
  target.suppressedBloodGemAttack =
    (target.suppressedBloodGemAttack ?? 0) +
    (source.suppressedBloodGemAttack ?? 0);
  target.suppressedBloodGemHealth =
    (target.suppressedBloodGemHealth ?? 0) +
    (source.suppressedBloodGemHealth ?? 0);
  target.temporaryAttack += source.temporaryAttack;
  target.temporaryHealth += source.temporaryHealth;
  target.temporaryCrabDeathrattles +=
    source.temporaryCrabDeathrattles;
  target.temporaryGoldenCrabDeathrattles =
    (target.temporaryGoldenCrabDeathrattles ?? 0) +
    (source.temporaryGoldenCrabDeathrattles ?? 0);
  target.crabDeathrattles =
    (target.crabDeathrattles ?? 0) +
    (source.crabDeathrattles ?? 0);
  target.goldenCrabDeathrattles =
    (target.goldenCrabDeathrattles ?? 0) +
    (source.goldenCrabDeathrattles ?? 0);
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
  const hasPermanentVenomous =
    (target.venomous && target.temporaryVenomous !== true) ||
    (source.venomous && source.temporaryVenomous !== true);
  target.venomous ||= source.venomous;
  target.temporaryVenomous =
    !hasPermanentVenomous &&
    target.venomous &&
    (target.temporaryVenomous === true ||
      source.temporaryVenomous === true);
  target.windfury ||= source.windfury;
  target.cleave ||= source.cleave;
  target.alwaysAttacksLowestAttack ||=
    source.alwaysAttacksLowestAttack;
  if (source.effectSupport === "partial") {
    target.effectSupport = "partial";
  }
  target.attachments.push(
    createMagneticAttachment(source, elementalGrantBonus),
  );
}

function copyMagnetizationToBeatboxers(
  player: PlayerState,
  source: BoardMinionInstance,
  originalTarget: BoardMinionInstance,
  elementalGrantBonus: { attack: number; health: number },
): void {
  const triggers = player.board.flatMap((watcher) => {
    if (watcher.instanceId === originalTarget.instanceId) {
      return [];
    }
    return minionEffectSources(watcher).flatMap((component) => {
      const effect = getMinionDefinition(
        component.definitionId,
      ).copyOtherMagnetization;
      return effect ? [{ watcher, component, effect }] : [];
    });
  });
  for (const { watcher, component, effect } of triggers) {
    if (
      !player.board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    const copies =
      effect.copies *
      (component.golden && effect.goldenMode === "doubleCopies" ? 2 : 1);
    for (let copy = 0; copy < copies; copy += 1) {
      applyMagneticSourceToHost(
        player,
        source,
        watcher,
        elementalGrantBonus,
      );
    }
  }
}

function fuseMinionIntoHost(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  target: BoardMinionInstance,
): void {
  // Patch 27.0 changed Battlegrounds Magnetic pool behavior: every pool copy
  // represented by the source returns immediately when it is Magnetized.
  // Beatboxer copies the attachment snapshot without representing more pool
  // copies, so this return must happen exactly once for the original source.
  returnMinionToPool(state, source);
  const elementalGrantBonus = recruitElementalStatGrantBonus(
    player,
    source,
    { effectSourceDefinitionId: source.definitionId },
  );
  applyMagneticSourceToHost(player, source, target, elementalGrantBonus);
  copyMagnetizationToBeatboxers(
    player,
    source,
    target,
    elementalGrantBonus,
  );
  player.magnetizationsThisGame =
    (player.magnetizationsThisGame ?? 0) + 1;
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
  const castCount = 1 + extraFirstSpellCasts(state, player);
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
    castCount,
    { kind: "hand" },
    "tripleRewardCast",
  );
  if (
    state.pendingInteraction?.kind === "discover" &&
    state.pendingInteraction.completionSource === "tripleRewardCast"
  ) {
    return true;
  }
  for (let cast = 0; cast < castCount; cast += 1) {
    triggerRecruitAfterSpellCast(state, player);
  }
  if (state.pendingInteraction === null) {
    finishCardPlayed(state, player);
  }
  return true;
}

function triggerBloodboundRingAfterHandBloodGem(
  state: GameState,
  player: PlayerState,
): void {
  if (!playerOwnsTrinketCardId(player, BLOODBOUND_RING_CARD_ID)) {
    return;
  }
  const shielded = player.board.filter((minion) => minion.divineShield);
  for (const target of shielded) {
    if (
      player.board.some(
        (candidate) => candidate.instanceId === target.instanceId,
      )
    ) {
      applyRecruitBloodGemPulse(state, player, target);
    }
  }
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
  const surveyorPortraitBonus = playerOwnsTrinketCardId(
    player,
    SURVEYOR_PORTRAIT_CARD_ID,
  )
    ? 6
    : 0;
  beginCardPlayed(player, {
    sourceInstanceId: card.instanceId,
    cardKind: "other",
    tribes: [],
  });
  const pulseCount =
    (1 + bloodGemFromHandExtraCasts(player)) *
      friendlyTargetSpellCastMultiplier(player.board) +
    extraFirstSpellCasts(state, player);
  for (let pulse = 0; pulse < pulseCount; pulse += 1) {
    applyRecruitBloodGemPulse(
      state,
      player,
      target,
      {
        bonusKeyword: card.bonusKeyword,
        attackBonus: surveyorPortraitBonus,
        healthBonus: surveyorPortraitBonus,
        origin: "hand",
        sourceInstanceId: card.instanceId,
      },
      trace,
    );
    triggerRecruitAfterSpellCast(state, player);
  }
  triggerBloodboundRingAfterHandBloodGem(state, player);
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
  eligibleAttackGainTargets?: readonly BoardMinionInstance[],
  healthGainOwner?: PlayerState,
): void {
  for (const minion of minions) {
    const canTrigger =
      eligibleAttackGainTargets?.some(
        (candidate) => candidate.instanceId === minion.instanceId,
      ) === true;
    const triggeredHealth = canTrigger
      ? healthGainedFromExternalAttack(minion, attack)
      : 0;
    minion.attack += attack;
    minion.health += health + triggeredHealth;
    reconcileConditionalMinion(minion);
    observeRecruitFriendlyAttackGain(
      healthGainOwner,
      minion,
      attack,
    );
    observeRecruitFriendlyHealthGain(
      healthGainOwner,
      minion,
      health + triggeredHealth,
    );
  }
}

function observeRecruitFriendlyAttackGain(
  player: PlayerState | undefined,
  target: MinionInstance,
  attackGain: number,
): void {
  if (
    !player ||
    attackGain <= 0 ||
    target.health <= 0 ||
    !minionHasTribe(target, "pirate") ||
    !player.board.some(
      (candidate) => candidate.instanceId === target.instanceId,
    )
  ) {
    return;
  }
  const watchers = [...player.board];
  for (const watcher of watchers) {
    if (
      watcher.health <= 0 ||
      !player.board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyGainsAttack;
      if (
        !trigger ||
        !minionHasTribe(target, trigger.tribe) ||
        (trigger.otherOnly && watcher.instanceId === target.instanceId)
      ) {
        continue;
      }
      const scale =
        component.golden && trigger.goldenMode === "doubleStats" ? 2 : 1;
      const healthGain = trigger.health * scale;
      watcher.health += healthGain;
      reconcileConditionalMinion(watcher);
      observeRecruitFriendlyHealthGain(player, watcher, healthGain);
    }
  }
}

function observeRecruitBattlecryTriggered(
  player: PlayerState,
): void {
  const watchers = [...player.board];
  for (const watcher of watchers) {
    if (
      watcher.health <= 0 ||
      !player.board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterBattlecryTriggered;
      if (!trigger) {
        continue;
      }
      const scale =
        component.golden && trigger.goldenMode === "doubleStats" ? 2 : 1;
      buffMinions(
        player.board.filter(
          (target) =>
            target.health > 0 && minionHasTribe(target, trigger.tribe),
        ),
        trigger.attack * scale,
        trigger.health * scale,
        player.board,
        player,
      );
    }
  }
}

function observeRecruitFriendlyHealthGain(
  player: PlayerState | undefined,
  target: MinionInstance,
  healthGain: number,
): void {
  if (
    !player ||
    healthGain <= 0 ||
    target.health <= 0 ||
    !minionHasTribe(target, "naga") ||
    !player.board.some(
      (candidate) => candidate.instanceId === target.instanceId,
    )
  ) {
    return;
  }
  const watchers = [...player.board];
  for (const watcher of watchers) {
    if (
      watcher.health <= 0 ||
      !player.board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyGainsHealth;
      if (
        !trigger ||
        !minionHasTribe(target, trigger.tribe) ||
        (trigger.otherOnly && watcher.instanceId === target.instanceId)
      ) {
        continue;
      }
      const scale =
        component.golden && trigger.goldenMode === "doubleStats" ? 2 : 1;
      const attackGain = healthGain * trigger.attackPerHealth * scale;
      // This Attack gain is the consequence of the Health-gain event. Apply it
      // as its own packet so Pirate observers see every Wrathscale trigger.
      target.attack += attackGain;
      reconcileConditionalMinion(target);
      observeRecruitFriendlyAttackGain(player, target, attackGain);
    }
  }
}

function tavernSpellAuraBonus(
  board: readonly MinionInstance[],
): { attack: number; health: number } {
  let attack = 0;
  let health = 0;
  for (const source of board) {
    if (source.health <= 0) {
      continue;
    }
    for (const component of minionEffectSources(source)) {
      const aura = getMinionDefinition(
        component.definitionId,
      ).tavernSpellBuffAura;
      if (!aura) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      const growsThisTurn = getMinionDefinition(
        component.definitionId,
      ).afterCardPlayed?.effects.some(
        (effect) => effect.kind === "improveTavernSpellAuraThisTurn",
      );
      attack +=
        aura.attack * scale +
        (growsThisTurn
          ? effectCounter(
              source,
              TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
              0,
            ) * scale
          : 0);
      health +=
        aura.health * scale +
        (growsThisTurn
          ? effectCounter(
              source,
              TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
              0,
            ) * scale
          : 0);
    }
  }
  return { attack, health };
}

function heroTavernSpellBuffBonus(
  player: PlayerState | undefined,
): number {
  return player && playerHasHeroPower(player, "growingTavernSpellBuff")
    ? Math.max(1, heroPowerCounter(player, "rakanishuBonus"))
    : 0;
}

function recruitTavernSpellBuffBonus(
  player: PlayerState,
): { attack: number; health: number } {
  const aura = tavernSpellAuraBonus(player.board);
  const heroBonus = heroTavernSpellBuffBonus(player);
  return {
    attack: player.tavernSpellAttackBonus + aura.attack + heroBonus,
    health: player.tavernSpellHealthBonus + aura.health + heroBonus,
  };
}

function friendlyTargetSpellCastMultiplier(
  board: readonly MinionInstance[],
): number {
  let strongestExtraCasts = 0;
  for (const source of board) {
    if (source.health <= 0) {
      continue;
    }
    for (const component of minionEffectSources(source)) {
      const extraCasts = getMinionDefinition(
        component.definitionId,
      ).friendlyTargetSpellExtraCasts;
      if (!extraCasts) {
        continue;
      }
      strongestExtraCasts = Math.max(
        strongestExtraCasts,
        extraCasts * (component.golden ? 2 : 1),
      );
    }
  }
  return 1 + strongestExtraCasts;
}

function bountyCastMultiplier(
  board: readonly MinionInstance[],
): number {
  let strongestExtraCasts = 0;
  for (const source of board) {
    if (source.health <= 0) {
      continue;
    }
    for (const component of minionEffectSources(source)) {
      const extraCasts = getMinionDefinition(
        component.definitionId,
      ).bountyExtraCasts;
      if (!extraCasts) {
        continue;
      }
      strongestExtraCasts = Math.max(
        strongestExtraCasts,
        extraCasts * (component.golden ? 2 : 1),
      );
    }
  }
  return 1 + strongestExtraCasts;
}

function triggerRecruitAfterSpellCast(
  state: GameState,
  player: PlayerState,
  castByPlayer = true,
): void {
  if (castByPlayer) {
    player.playerSpellsCast = (player.playerSpellsCast ?? 0) + 1;
  }
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      const definition = getMinionDefinition(component.definitionId);
      const effect = definition.afterSpellCast;
      if (effect) {
        const scale = component.golden ? 2 : 1;
        buffMinions(
          player.board,
          effect.attack * scale,
          effect.health * scale,
          player.board,
          player,
        );
      }
      const playerCastTrigger = castByPlayer
        ? definition.afterPlayerSpellCast
        : undefined;
      if (
        playerCastTrigger?.kind !== "consumeRandomShopMinion" ||
        playerCastTrigger.spellsRequired <= 0
      ) {
        continue;
      }
      const totalProgress =
        effectCounter(source, PLAYER_SPELL_PROGRESS_COUNTER, 0) + 1;
      const triggerCount = Math.floor(
        totalProgress / playerCastTrigger.spellsRequired,
      );
      setEffectCounter(
        source,
        PLAYER_SPELL_PROGRESS_COUNTER,
        totalProgress % playerCastTrigger.spellsRequired,
      );
      for (let trigger = 0; trigger < triggerCount; trigger += 1) {
        if (player.shop.length === 0) {
          continue;
        }
        const consumedIndex = randomIndex(state, player.shop.length);
        const [consumed] = player.shop.splice(consumedIndex, 1);
        const statScale =
          component.golden &&
          playerCastTrigger.goldenMode === "doubleStats"
            ? 2
            : 1;
        consumeShopMinionInto(
          state,
          player,
          source,
          consumed,
          statScale,
        );
      }
      refreshDynamicMinionDescription(source, player);
    }
  }
  if (castByPlayer) {
    for (const minion of ownedMinionCards(player)) {
      refreshDynamicMinionDescription(minion, player);
    }
  }
  applyAfterRecruitSpellCastTrinkets(state, player);
}

function reconcileOwnedWhereverMinions(player: PlayerState): void {
  for (const minion of ownedMinionCards(player)) {
    reconcileWhereverMinion(
      minion,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  }
}

function buffMinionsFromTavernSpell(
  player: PlayerState,
  minions: readonly BoardMinionInstance[],
  attack: number,
  health: number,
  repetitions = 1,
  bonusOverride?: { attack: number; health: number },
): void {
  const bonus = bonusOverride ?? recruitTavernSpellBuffBonus(player);
  const eligibleAttackGainTargets = [...player.board, ...player.shop];
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    buffMinions(
      minions,
      attack + bonus.attack,
      health + bonus.health,
      eligibleAttackGainTargets,
      player,
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

function tavernSpellTargetBuffPulses(
  effect: TavernSpellEffect,
  target: MinionInstance,
): readonly TavernSpellWarbandBuffPulse[] | null {
  if (effect === "shiftingTide") {
    return Array.from(
      { length: minionHasTribe(target, "naga") ? 4 : 2 },
      () => ({ attack: 1, health: 1 }),
    );
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
  player?: PlayerState,
): void {
  const triggeredHealth = healthGainedFromExternalAttack(target, attack);
  target.attack += attack;
  target.health += health + triggeredHealth;
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
  observeRecruitFriendlyAttackGain(player, target, attack);
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
  if (minion.temporaryVenomous) {
    minion.venomous = false;
    minion.temporaryVenomous = false;
  }
  minion.temporaryCrabDeathrattles = 0;
  minion.temporaryGoldenCrabDeathrattles = 0;
}

function applySpellcraftStats(
  target: BoardMinionInstance,
  attack: number,
  health: number,
  permanent: boolean,
  player: PlayerState,
  keywords: { taunt?: boolean; divineShield?: boolean } = {},
): void {
  const triggeredHealth = healthGainedFromExternalAttack(target, attack);
  if (!permanent) {
    applyTemporarySpellcraftBuff(
      target,
      attack,
      health,
      keywords,
      player,
    );
    observeRecruitFriendlyHealthGain(
      player,
      target,
      health + triggeredHealth,
    );
    return;
  }
  target.attack += attack;
  target.health += health + triggeredHealth;
  observeRecruitFriendlyAttackGain(player, target, attack);
  if (keywords.taunt) {
    target.taunt = true;
    target.temporaryTaunt = false;
  }
  if (keywords.divineShield) {
    target.divineShield = true;
    target.temporaryDivineShield = false;
  }
  reconcileConditionalMinion(target);
  observeRecruitFriendlyHealthGain(
    player,
    target,
    health + triggeredHealth,
  );
}

function makeSpellcraftHandCardPermanent(
  target: BoardMinionInstance | undefined,
  card: SpellcraftSpellInstance,
): boolean {
  if (!target || card.spellFamily !== "spellcraft") {
    return false;
  }
  const effect = getMinionDefinition(
    target.definitionId,
  ).spellcraftPermanentOnSelf;
  if (!effect) {
    return false;
  }
  const limit = effect.castsPerTurn * (target.golden ? 2 : 1);
  const used = effectCounter(
    target,
    SPELLCRAFT_PERMANENT_CASTS_COUNTER,
    0,
  );
  if (used >= limit) {
    return false;
  }
  setEffectCounter(
    target,
    SPELLCRAFT_PERMANENT_CASTS_COUNTER,
    used + 1,
  );
  refreshDynamicMinionDescription(target);
  return true;
}

function copySpellcraftHandCardAfterCast(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance | undefined,
  card: SpellcraftSpellInstance,
): void {
  if (!target || card.spellFamily !== "spellcraft") {
    return;
  }
  const effect = getMinionDefinition(
    target.definitionId,
  ).copySpellcraftOnSelf;
  if (
    !effect ||
    effectCounter(target, SPELLCRAFT_COPY_USED_COUNTER, 0) > 0
  ) {
    return;
  }
  setEffectCounter(target, SPELLCRAFT_COPY_USED_COUNTER, 1);
  refreshDynamicMinionDescription(target);
  const count =
    effect.count * (target.golden ? 2 : 1) +
    (target.definitionId === PASSIONATE_SHAKER_DEFINITION_ID &&
    playerHasTrinketCardId(player, SHAKER_PORTRAIT_CARD_ID)
      ? 1
      : 0);
  const definition = getSpellcraftDefinition(card.definitionId);
  for (
    let copy = 0;
    copy < count && player.hand.length < MAX_HAND_SIZE;
    copy += 1
  ) {
    addCardToHand(
      state,
      player,
      createSpellcraftSpell(
        state,
        definition,
        (card.effectMultiplier ?? 1) > 1,
        card.rewardTier,
      ),
    );
  }
}

function applySpellcraftCastPulse(
  state: GameState,
  player: PlayerState,
  card: SpellcraftSpellInstance,
  definition: SpellcraftDefinition,
  target: BoardMinionInstance | undefined,
  permanent: boolean,
): void {
  const effectMultiplier = card.effectMultiplier ?? 1;
  switch (definition.effect) {
    case "sirensSong":
      if (target) {
        for (
          let copy = 0;
          copy < effectMultiplier && player.hand.length < MAX_HAND_SIZE;
          copy += 1
        ) {
          addCopiedShopMinionToHand(state, player, target);
        }
      }
      break;
    case "crabRider":
      if (target) {
        if (effectMultiplier > 1) {
          if (permanent) {
            target.goldenCrabDeathrattles =
              (target.goldenCrabDeathrattles ?? 0) + 1;
          } else {
            target.temporaryGoldenCrabDeathrattles =
              (target.temporaryGoldenCrabDeathrattles ?? 0) + 1;
          }
        } else if (permanent) {
          target.crabDeathrattles =
            (target.crabDeathrattles ?? 0) + 1;
        } else {
          target.temporaryCrabDeathrattles += 1;
        }
      }
      break;
    case "slimyShield":
      if (target) {
        applySpellcraftStats(target, 1, 1, true, player, {
          taunt: true,
        });
      }
      break;
    case "anglersLure":
      if (target) {
        applySpellcraftStats(
          target,
          2 * effectMultiplier,
          6 * effectMultiplier,
          permanent,
          player,
          { taunt: true },
        );
      }
      break;
    case "glowingCrown":
      if (target) {
        applySpellcraftStats(target, 0, 0, permanent, player, {
          divineShield: true,
        });
      }
      break;
    case "sickRiffs":
      if (target) {
        applySpellcraftStats(
          target,
          player.tavernTier * effectMultiplier,
          player.tavernTier * effectMultiplier,
          permanent,
          player,
        );
      }
      break;
    case "deepBlueBlues":
      if (target) {
        const amount =
          (2 + player.deepBlueBonus) * effectMultiplier;
        applySpellcraftStats(target, amount, amount, permanent, player);
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
          player.board,
          player,
        );
      }
      break;
    case "evolvingStrategy": {
      const rewardTier = card.rewardTier ?? 1;
      for (let reward = 0; reward < effectMultiplier; reward += 1) {
        addDrawnMinionToHand(
          state,
          player,
          drawMatchingFromPool(
            state,
            rewardTier,
            (candidate) =>
              candidate.tier === rewardTier &&
              definitionHasTribe(candidate, "naga"),
          ),
        );
      }
      break;
    }
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
    case "jailerStickerLesser":
    case "jailerStickerGreater": {
      if (
        !target ||
        !player.board.some(
          (minion) => minion.instanceId === target.instanceId,
        ) ||
        !destroyRecruitMinion(state, player, target.instanceId)
      ) {
        break;
      }
      const rewardCount =
        definition.effect === "jailerStickerGreater" ? 2 : 1;
      for (let reward = 0; reward < rewardCount; reward += 1) {
        if (
          !addRandomSharedPoolMinionToHand(
            state,
            player,
            (candidate) => definitionHasTribe(candidate, "undead"),
          )
        ) {
          break;
        }
      }
      break;
    }
    case "ophidianStaff":
      if (target) {
        applySpellcraftStats(target, 2, 2, true, player);
        target.reborn = true;
      }
      break;
    case "chillmereMosaic":
      refreshWithChillmereMosaic(state, player);
      break;
    case "doubleStitch": {
      if (!target) {
        break;
      }
      const boardIndex = player.board.findIndex(
        (minion) => minion.instanceId === target.instanceId,
      );
      if (boardIndex < 0) {
        break;
      }
      applySpellcraftStats(
        target,
        target.attack,
        target.health,
        true,
        player,
      );
      const [moved] = player.board.splice(boardIndex, 1);
      moved.playableFromRound = Math.max(
        moved.playableFromRound ?? 0,
        state.round + 1,
      );
      if (!addCardToHand(state, player, moved)) {
        player.board.splice(boardIndex, 0, moved);
        break;
      }
      resolveTriples(state, player);
      break;
    }
    case "tokenOfOldGods": {
      if (
        !target ||
        target.tier >= 6 ||
        !player.board.some(
          (minion) => minion.instanceId === target.instanceId,
        )
      ) {
        break;
      }
      const existingInteraction = state.pendingInteraction;
      if (
        player.isHuman &&
        existingInteraction?.kind === "discover" &&
        existingInteraction.sourceInstanceId === card.instanceId &&
        existingInteraction.destination.kind === "transform" &&
        existingInteraction.destination.targetInstanceId === target.instanceId
      ) {
        existingInteraction.remainingDiscoveries += 1;
        break;
      }
      beginDiscoverInteraction(
        state,
        player,
        card.instanceId,
        { exactTier: (target.tier + 1) as MinionTier },
        1,
        { kind: "transform", targetInstanceId: target.instanceId },
        undefined,
        undefined,
        definition.id,
      );
      break;
    }
  }
}

function resolveDarkmoonPrizePulse(
  state: GameState,
  player: PlayerState,
  definition: SpellcraftDefinition,
  target?: BoardMinionInstance,
): void {
  switch (definition.effect) {
    case "darkmoonBuyTheHolyLight":
      if (target) {
        buffMinions([target], 10, 0, player.board, player);
        target.divineShield = true;
        target.temporaryDivineShield = false;
      }
      return;
    case "darkmoonBananas":
      while (player.hand.length < MAX_HAND_SIZE) {
        addGeneratedTavernSpellToHand(
          state,
          player,
          "tavern-spell-tavern-dish-banana",
        );
      }
      return;
    case "darkmoonRepeatCustomer": {
      if (!target || target.golden) {
        return;
      }
      const boardIndex = player.board.findIndex(
        (minion) => minion.instanceId === target.instanceId,
      );
      if (boardIndex < 0) {
        return;
      }
      buffMinions([target], 6, 6, player.board, player);
      const [moved] = player.board.splice(boardIndex, 1);
      if (!addCardToHand(state, player, moved)) {
        player.board.splice(boardIndex, 0, moved);
        return;
      }
      resolveTriples(state, player);
      return;
    }
    case "darkmoonAllThatGlitters": {
      if (player.shop.length === 0) {
        return;
      }
      const selected =
        player.shop[randomIndex(state, player.shop.length)];
      makeMinionGoldenPreservingEnchantments(selected);
      return;
    }
    case "darkmoonMindflayerGoggles":
      while (
        player.hand.length < MAX_HAND_SIZE &&
        stealHighestTierTavernCard(state, player)
      ) {
        // The helper removes one Tavern card per pass.
      }
      releaseShop(state, player);
      player.frozen = false;
      fillShop(state, player);
      applyAfterTavernRefreshEffects(state, player);
      return;
    case "darkmoonReservePrices":
      player.darkmoonReservePricesDiscount =
        Math.max(
          0,
          Math.floor(player.darkmoonReservePricesDiscount ?? 0),
        ) + 1;
      return;
    default:
      return;
  }
}

function castDarkmoonGeneratedSpell(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId?: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  if (
    handIndex < 0 ||
    card?.kind !== "spellcraft" ||
    card.spellFamily !== "generated"
  ) {
    return false;
  }
  const definition = getSpellcraftDefinition(card.definitionId);
  if (
    definition.id !== TRIPLE_PRIZE_DEFINITION_ID &&
    !isTierThreeDarkmoonPrizeDefinitionId(definition.id)
  ) {
    return false;
  }
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
  const castCount =
    (target ? friendlyTargetSpellCastMultiplier(player.board) : 1) +
    extraFirstSpellCasts(state, player);

  if (definition.effect === "darkmoonPrizeDiscover") {
    beginDarkmoonPrizeDiscoverInteraction(
      state,
      player,
      card.instanceId,
      castCount,
      "generatedSpellCast",
    );
    if (state.pendingInteraction === null) {
      for (let cast = 0; cast < castCount; cast += 1) {
        triggerRecruitAfterSpellCast(state, player);
      }
      finishCardPlayed(state, player);
    }
    return true;
  }

  if (definition.effect === "darkmoonTrainingSession") {
    if (player.isHuman) {
      beginHeroPowerChoice(
        state,
        player,
        { instanceId: card.instanceId },
        definition,
        "best",
        "generatedSpellCast",
        castCount,
      );
      if (state.pendingInteraction !== null) {
        return true;
      }
    } else {
      for (let cast = 0; cast < castCount; cast += 1) {
        beginHeroPowerChoice(
          state,
          player,
          { instanceId: card.instanceId },
          definition,
        );
        triggerRecruitAfterSpellCast(state, player);
      }
      finishCardPlayed(state, player);
      return true;
    }
    for (let cast = 0; cast < castCount; cast += 1) {
      triggerRecruitAfterSpellCast(state, player);
    }
    finishCardPlayed(state, player);
    return true;
  }

  if (definition.effect === "darkmoonTopShelf") {
    beginDiscoverInteraction(
      state,
      player,
      card.instanceId,
      {
        exactTier: Math.min(
          7,
          player.tavernTier + 1,
        ) as MinionTier,
      },
      castCount,
      { kind: "hand", allowOverflow: true },
      "generatedSpellCast",
      undefined,
      definition.id,
    );
    if (state.pendingInteraction === null) {
      for (let cast = 0; cast < castCount; cast += 1) {
        triggerRecruitAfterSpellCast(state, player);
      }
      finishCardPlayed(state, player);
    }
    return true;
  }

  for (let cast = 0; cast < castCount; cast += 1) {
    resolveDarkmoonPrizePulse(state, player, definition, target);
    if (target) {
      triggerRecruitTargetedSpellCast(player, target);
    }
    triggerRecruitAfterSpellCast(state, player);
  }
  finishCardPlayed(state, player);
  return true;
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
  if (
    card.spellFamily === "generated" &&
    (definition.id === TRIPLE_PRIZE_DEFINITION_ID ||
      isTierThreeDarkmoonPrizeDefinitionId(definition.id))
  ) {
    return castDarkmoonGeneratedSpell(
      state,
      player,
      cardInstanceId,
      targetInstanceId,
    );
  }
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
  const targetsFriendlyMinion = definition.target === "friendly";
  const permanent = targetsFriendlyMinion
    ? makeSpellcraftHandCardPermanent(target, card)
    : false;
  const castCount =
    (targetsFriendlyMinion
      ? friendlyTargetSpellCastMultiplier(player.board)
      : 1) +
    extraSpellcraftCasts(state, player);
  for (let cast = 0; cast < castCount; cast += 1) {
    const pendingSpellcraftChoice =
      state.pendingInteraction?.kind === "spellcraftChoice"
        ? state.pendingInteraction
        : null;
    const repeatsPendingEscapeEruption =
      cast > 0 &&
      definition.effect === "escapeEruption" &&
      pendingSpellcraftChoice?.sourceInstanceId === card.instanceId;
    if (repeatsPendingEscapeEruption) {
      pendingSpellcraftChoice.effectMultiplier =
        (pendingSpellcraftChoice.effectMultiplier ?? 1) +
        (card.effectMultiplier ?? 1);
      pendingSpellcraftChoice.castCompletions =
        (pendingSpellcraftChoice.castCompletions ?? 1) + 1;
    } else {
      applySpellcraftCastPulse(
        state,
        player,
        card,
        definition,
        target,
        permanent,
      );
      if (
        definition.effect === "escapeEruption" &&
        state.pendingInteraction?.kind === "spellcraftChoice" &&
        state.pendingInteraction.sourceInstanceId === card.instanceId
      ) {
        state.pendingInteraction.castCompletions = 1;
      }
    }
    if (target && targetsFriendlyMinion) {
      triggerRecruitTargetedSpellCast(player, target);
    }
    const defersCastCompletion =
      state.pendingInteraction?.kind === "spellcraftChoice" &&
      state.pendingInteraction.sourceInstanceId === card.instanceId &&
      state.pendingInteraction.castCompletions !== undefined;
    if (state.pendingInteraction === null) {
      triggerRecruitAfterSpellCast(state, player);
    } else if (repeatsPendingEscapeEruption && !defersCastCompletion) {
      // The original cast resolves after the player chooses a branch. Extra
      // casts use that same branch and can fire generic cast observers now.
      triggerRecruitAfterSpellCast(state, player);
    }
    if (!defersCastCompletion) {
      triggerAfterRecruitSpellcraftCast(state, player);
    }
  }
  if (targetsFriendlyMinion) {
    copySpellcraftHandCardAfterCast(
      state,
      player,
      target,
      card,
    );
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
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  refreshDynamicMinionDescription(minion, player);
  addCardToHand(state, player, minion);
  resolveTriples(state, player);
}

function addGeneratedMinionCopyToHand(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  golden = false,
): void {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return;
  }
  const minion = createMinionInstance(state, definitionId, 0);
  if (golden) {
    makeGoldenToken(minion);
  }
  applyOwnedUndeadArmyBonus(player, minion);
  applyOwnedBeetleBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  addCardToHand(state, player, minion);
  resolveTriples(state, player);
}

function addCopiedShopMinionToHand(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const copy = cloneMinionAsGeneratedCopy(state, source);
  applyOwnedUndeadArmyBonus(player, copy);
  applyOwnedBeetleBonus(player, copy);
  reconcileWhereverMinion(
    copy,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(copy, player);
  if (!addCardToHand(state, player, copy)) {
    return false;
  }
  resolveTriples(state, player);
  return true;
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
  addCardToHand(
    state,
    player,
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
            { effectSourceDefinitionId: component.definitionId },
          );
          continue;
        }
        if (effect.kind === "onePerTribe") {
          const portraitBonus =
            component.definitionId === "BG28_551" &&
            playerOwnsTrinketCardId(player, REDEEMER_PORTRAIT_CARD_ID)
              ? 4
              : 0;
          applyOnePerTribeBuff(
            state,
            player,
            (effect.attack + portraitBonus) * scale,
            (effect.health + portraitBonus) * scale,
          );
          continue;
        }
        if (effect.kind === "buffKeyword") {
          const portraitHealth =
            component.definitionId === CHARGING_CZARINA_DEFINITION_ID &&
            playerOwnsTrinketCardId(player, CZARINA_PORTRAIT_CARD_ID)
              ? effect.attack
              : 0;
          buffMinions(
            player.board.filter(
              (target) =>
                effect.keyword === "divineShield" &&
                target.divineShield,
            ),
            effect.attack * scale,
            (effect.health + portraitHealth) * scale,
            player.board,
            player,
          );
        }
      }
    }
  }
}

function recordRecruitTavernSpellCast(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  fromHand = false,
  castByPlayer = false,
): void {
  player.lastTavernSpellDefinitionId = definitionId;
  player.tavernSpellsCastThisTurn += 1;
  player.tavernSpellsCast = (player.tavernSpellsCast ?? 0) + 1;
  reconcileOwnedWhereverMinions(player);
  applyAfterTavernSpellCastTrinkets(player, fromHand);
  triggerRecruitAfterSpellCast(state, player, castByPlayer);
  applyAfterTavernSpellCastTriggers(state, player);
}

function finishTavernSpellCast(
  state: GameState,
  player: PlayerState,
): void {
  const definitionId = player.pendingTavernSpellDefinitionId;
  if (definitionId) {
    recordRecruitTavernSpellCast(
      state,
      player,
      definitionId,
      true,
      true,
    );
    player.pendingTavernSpellDefinitionId = null;
  }
  finishCardPlayed(state, player);
}

function resolveTriggeredRecruitTavernSpell(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  sourceStatGrantBonus: CombatStatBuff = { attack: 0, health: 0 },
): void {
  const definition = getTavernSpellDefinition(definitionId);
  if (tavernSpellNeedsTarget(definition)) {
    throw new Error(
      `Triggered Tavern Spell ${definition.id} requires a target`,
    );
  }
  const spell = createTavernSpell(state, definition);
  const castCount = isBountyTavernSpellDefinitionId(definition.id)
    ? bountyCastMultiplier(player.board)
    : 1;
  const tavernSpellBonus = recruitTavernSpellBuffBonus(player);
  const bonusAtCast = {
    attack: tavernSpellBonus.attack + sourceStatGrantBonus.attack,
    health: tavernSpellBonus.health + sourceStatGrantBonus.health,
  };
  for (let cast = 0; cast < castCount; cast += 1) {
    if (
      !applyTavernSpellEffect(
        state,
        player,
        spell,
        definition,
        undefined,
        bonusAtCast,
      )
    ) {
      throw new Error(
        `Triggered Tavern Spell ${definition.id} did not finish synchronously`,
      );
    }
    recordRecruitTavernSpellCast(state, player, definition.id);
  }
}

function resolveTriggeredRecruitTavernSpellOnTarget(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  target: BoardMinionInstance,
): void {
  const definition = getTavernSpellDefinition(definitionId);
  if (!tavernSpellNeedsTarget(definition)) {
    throw new Error(
      `Triggered Tavern Spell ${definition.id} does not accept a target`,
    );
  }
  const spell = createTavernSpell(state, definition);
  const castCount = friendlyTargetSpellCastMultiplier(player.board);
  const bonusAtCast = recruitTavernSpellBuffBonus(player);
  for (let cast = 0; cast < castCount; cast += 1) {
    if (
      !applyTavernSpellEffect(
        state,
        player,
        spell,
        definition,
        target,
        bonusAtCast,
      )
    ) {
      throw new Error(
        `Triggered Tavern Spell ${definition.id} did not finish synchronously`,
      );
    }
    triggerRecruitTargetedSpellCast(player, target);
    recordRecruitTavernSpellCast(state, player, definition.id);
  }
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

function transformWarbandIntoRandomTierFourMinions(
  state: GameState,
  player: PlayerState,
): void {
  let transformed = false;
  for (let boardIndex = 0; boardIndex < player.board.length; boardIndex += 1) {
    const original = player.board[boardIndex];
    const replacement = drawMatchingFromPool(
      state,
      4,
      (candidate) => candidate.tier === 4,
    );
    if (!replacement) {
      continue;
    }
    const originalInstanceId = original.instanceId;
    returnMinionToPool(state, original);
    replacement.instanceId = originalInstanceId;
    applyOwnedUndeadArmyBonus(player, replacement);
    applyOwnedBeetleBonus(player, replacement);
    reconcileWhereverMinion(
      replacement,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
    refreshDynamicMinionDescription(replacement, player);
    player.board[boardIndex] = replacement;
    transformed = true;
  }
  if (transformed) {
    resolveTriples(state, player);
  }
}

function transformFriendlyMinionFromDiscover(
  state: GameState,
  player: PlayerState,
  selected: BoardMinionInstance,
  targetInstanceId: string,
): BoardMinionInstance | null {
  const target = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  if (!target) {
    return null;
  }
  const preservedInstanceId = target.instanceId;
  returnMinionToPool(state, target);
  selected.instanceId = preservedInstanceId;
  applyOwnedUndeadArmyBonus(player, selected);
  applyOwnedBeetleBonus(player, selected);
  reconcileWhereverMinion(
    selected,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
        );
  refreshDynamicMinionDescription(selected, player);
  Object.assign(target, selected);
  resolveTriples(state, player);
  return target;
}

function transformMinionKeepingStats(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
): boolean {
  const wasInShop = player.shop.includes(target);
  const replacementTier = target.tier === 6 ? 7 : Math.min(6, target.tier + 1);
  const replacement =
    replacementTier === 7
      ? (() => {
          const candidates = TIER_SEVEN_MINION_DEFINITIONS.filter(
            (definition) =>
              definitionMatchesActiveTribes(definition, state.activeTribes),
          );
          const definition = candidates[randomIndex(state, candidates.length)];
          return definition
            ? createMinionInstance(state, definition.id, 0)
            : null;
        })()
      : drawMatchingFromPool(
          state,
          replacementTier as MutableTier,
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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    temporaryAttack: target.temporaryAttack,
    temporaryHealth: target.temporaryHealth,
    temporaryTaunt: false,
    temporaryDivineShield: false,
  };
  returnMinionToPool(state, target);
  delete target.poolCopiesOnPurchase;
  delete target.poolCopiesByDefinitionId;
  Object.assign(target, replacement, preserved);
  reconcileWhereverMinion(
    target,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
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
    case "bonusStartingHealth":
      return 0;
    case "goldAfterSellNextTurn":
      return 7;
    case "twoGoldMinionRefresh":
      return player.tavernTier < 6 ? 8 : 6;
    case "freezeEndTurnSmallerTavern":
      return 7;
    case "extraDragonOnRefresh":
      return 8;
    case "upgradeDiscountAfterElementals":
      return player.tavernTier < 6 ? 8 : 1;
    case "piratePurchaseRefund":
      return 8;
    case "tavernCoinAfterThreeMinions":
      return 7;
    case "freeFourthTavernSpell":
      return 7;
    case "growingTavernSpellBuff":
      return 7;
    case "buffAllCombatMinionsAttack":
      return 7;
    case "buffLeftmostCombatKeywords":
      return player.board.length > 0 ? 8 : 5;
  }
}

function beginHeroPowerChoice(
  state: GameState,
  player: PlayerState,
  source: { instanceId: string },
  definition: { id: string },
  nonHumanSelectionMode: NonHumanChoiceMode = "best",
  completionSource: "tavernSpellCast" | "generatedSpellCast" =
    "tavernSpellCast",
  remainingChoices = 1,
): boolean {
  const candidates = identityEligibleHeroPowers(player.heroPowerId);
  shuffleInPlace(state, candidates);
  const options = candidates.slice(0, 3);
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    const selected =
      nonHumanSelectionMode === "random"
        ? options[randomIndex(state, options.length)]
        : [...options].sort((left, right) => {
            const scoreDifference =
              heroPowerAiScore(player, right) -
              heroPowerAiScore(player, left);
            return scoreDifference !== 0
              ? scoreDifference
              : left.id.localeCompare(right.id);
          })[0];
    if (selected) {
      assignHeroPower(state, player, selected.id, state.round);
    }
    return false;
  }
  state.pendingInteraction = {
    kind: "heroPowerChoice",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: source.instanceId,
    definitionId: definition.id,
    optionIds: options.map((option) => option.id),
    ...(completionSource === "generatedSpellCast"
      ? { completionSource, remainingChoices }
      : {}),
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
  if (populated) {
    applyAfterTavernRefreshEffects(state, player);
  }
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
  applyTavernBonuses(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
        );
  refreshDynamicMinionDescription(minion, player);
  player.shop.push(minion);
}

function drawOrGenerateSpecificWisdomballCopy(
  state: GameState,
  definitionId: string,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const pooled =
    definition.tier === 7
      ? null
      : drawMatchingFromPool(
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

function fillTierSevenMinionPage(
  state: GameState,
  player: PlayerState,
): boolean {
  const candidates = TIER_SEVEN_MINION_DEFINITIONS.filter((definition) =>
    definitionMatchesActiveTribes(definition, state.activeTribes),
  );
  if (candidates.length === 0) {
    return false;
  }
  const capacity = tavernCardCapacity(player);
  while (player.shop.length < capacity) {
    const definition = candidates[randomIndex(state, candidates.length)];
    if (!definition) {
      break;
    }
    addSpecialShopMinion(
      player,
      createMinionInstance(state, definition.id, 0),
    );
  }
  return player.shop.length > 0;
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
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
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
          player.shop,
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
    case "tierSeven":
      return fillTierSevenMinionPage(state, player);
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

function refreshWithChillmereMosaic(
  state: GameState,
  player: PlayerState,
): void {
  releaseShop(state, player);
  player.frozen = false;
  player.lastHelpfulRefreshKind = null;
  const populated = fillSpecialMinionPage(
    state,
    player,
    player.tavernTier,
    1,
    (definition) =>
      definition.battlecry !== undefined ||
      definition.interactiveBattlecry !== undefined ||
      definition.printedMechanics?.includes("BATTLECRY") === true,
    false,
  );
  if (!populated) {
    return;
  }
  for (const offer of player.shop) {
    setEffectCounter(offer, CHILLMERE_MOSAIC_COST_COUNTER, 1);
  }
  applyAfterTavernRefreshEffects(state, player);
}

type NonHumanChoiceMode = "best" | "random";

function applyTavernSpellEffect(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
  definition: TavernSpellDefinition,
  target: BoardMinionInstance | undefined,
  bonusAtCast = recruitTavernSpellBuffBonus(player),
  nonHumanSelectionMode: NonHumanChoiceMode = "best",
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
        undefined,
        undefined,
        nonHumanSelectionMode,
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
        undefined,
        undefined,
        nonHumanSelectionMode,
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
        2 + recruitTavernSpellBuffBonus(player).attack;
      player.nextCombatHealthBonus +=
        1 + recruitTavernSpellBuffBonus(player).health;
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
      const bonus = recruitTavernSpellBuffBonus(player);
      const attack = 2 + bonus.attack;
      const health = 2 + bonus.health;
      player.tavernMinionAttackBonus += attack;
      player.tavernMinionHealthBonus += health;
      buffMinions(player.shop, attack, health, player.shop);
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
          undefined,
          undefined,
          nonHumanSelectionMode,
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
        const chooseImmediate =
          nonHumanSelectionMode === "random"
            ? randomIndex(state, 2) === 0
            : (() => {
                const profile = getAiStrategyProfile(player.id);
                return (
                  player.health + player.armor <
                    profile.minimumUpgradeHealth ||
                  player.board.length < aiTargetBoardSize(state.round)
                );
              })();
        if (chooseImmediate) {
          buffMinionsFromTavernSpell(
            player,
            player.board,
            2,
            2,
          );
        } else {
          player.nextTurnBoardAttackBonus +=
            (2 + recruitTavernSpellBuffBonus(player).attack) * 2;
          player.nextTurnBoardHealthBonus +=
            (2 + recruitTavernSpellBuffBonus(player).health) * 2;
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
          1,
          bonusAtCast,
        );
      }
      break;
    }
    case "bloodGemBarrage":
      player.tavernBloodGemBarrageCount += 1;
      player.tavernBloodGemBarrageAttack +=
        recruitTavernSpellBuffBonus(player).attack;
      player.tavernBloodGemBarrageHealth +=
        recruitTavernSpellBuffBonus(player).health;
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
        const suppressedAttack = Math.min(
          stolenAttack,
          neighbor.suppressedBloodGemAttack ?? 0,
        );
        const suppressedHealth = Math.min(
          stolenHealth,
          neighbor.suppressedBloodGemHealth ?? 0,
        );
        neighbor.attack = Math.max(
          0,
          neighbor.attack - (stolenAttack - suppressedAttack),
        );
        neighbor.health = Math.max(
          1,
          neighbor.health - (stolenHealth - suppressedHealth),
        );
        neighbor.bloodGemAttack = 0;
        neighbor.bloodGemHealth = 0;
        neighbor.suppressedBloodGemAttack = 0;
        neighbor.suppressedBloodGemHealth = 0;
        const triggeredHealth = healthGainedFromExternalAttack(
          target,
          stolenAttack,
        );
        target.attack += stolenAttack;
        target.health += stolenHealth + triggeredHealth;
        observeRecruitFriendlyAttackGain(player, target, stolenAttack);
        observeRecruitFriendlyHealthGain(
          player,
          target,
          stolenHealth + triggeredHealth,
        );
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
        const allRecruitMinions = [
          ...player.board,
          ...player.shop,
          ...(playerHasTrinketCardId(player, BLESSING_PORTRAIT_CARD_ID)
            ? player.hand.filter(
                (card): card is BoardMinionInstance =>
                  card.kind === "minion",
              )
            : []),
        ];
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
        attack: 6 + bonusAtCast.attack,
        health: 6 + bonusAtCast.health,
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
        undefined,
        undefined,
        nonHumanSelectionMode,
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
          attack: 3 + recruitTavernSpellBuffBonus(player).attack,
          health: 3 + recruitTavernSpellBuffBonus(player).health,
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
          player.shop,
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
          const attack = 5 + bonusAtCast.attack;
          const health = bonusAtCast.health;
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
              observeRecruitFriendlyAttackGain(player, minion, attack);
              observeRecruitFriendlyHealthGain(player, minion, health);
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
          finishConsumedShopMinion(state, player, consumed);
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
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
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
        undefined,
        undefined,
        nonHumanSelectionMode,
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
        undefined,
        undefined,
        nonHumanSelectionMode,
      );
      break;
    case "nozdormusProgeny":
      player.nextCombatDoubleLeftmostAttack.push({
        attack: recruitTavernSpellBuffBonus(player).attack,
        health: recruitTavernSpellBuffBonus(player).health,
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
            1,
            bonusAtCast,
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
          nonHumanSelectionMode,
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
        const previousAttack = target.attack;
        const previousHealth = target.health;
        const attack =
          20 +
          recruitTavernSpellBuffBonus(player).attack;
        const health =
          20 +
          recruitTavernSpellBuffBonus(player).health;
        const triggeredHealth = healthGainedFromExternalAttack(
          target,
          attack - target.attack,
        );
        target.attack = attack;
        target.health = health + triggeredHealth;
        target.temporaryAttack = 0;
        target.temporaryHealth = 0;
        target.suppressedBloodGemAttack = target.bloodGemAttack;
        target.suppressedBloodGemHealth = target.bloodGemHealth;
        reconcileConditionalMinion(target);
        observeRecruitFriendlyAttackGain(
          player,
          target,
          Math.max(0, target.attack - previousAttack),
        );
        observeRecruitFriendlyHealthGain(
          player,
          target,
          Math.max(0, target.health - previousHealth),
        );
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
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
        );
      }
      break;
    case "mirrorLens":
      if (target) {
        addGeneratedMinionCopyToHand(
          state,
          player,
          target.definitionId,
        );
      }
      break;
    case "goldenizer":
    case "goldenArrow":
      if (target) {
        makeMinionGoldenPreservingEnchantments(target);
        reconcileWhereverMinion(
          target,
          player.astralAutomatonsSummoned ?? 0,
          player.eternalKnightsDied ?? 0,
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
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

function resolveTaughtTavernSpellBattlecryCast(
  state: GameState,
  player: PlayerState,
  definition: TavernSpellDefinition,
  target: BoardMinionInstance | undefined,
): boolean {
  const spell = createTavernSpell(state, definition);
  const previousHumanFlag = player.isHuman;
  const previousPendingInteraction = state.pendingInteraction;
  let finished = false;
  try {
    // Magicfin Apprentice is the caster. Choice-based spells therefore resolve
    // automatically and randomly instead of opening the player's spell UI.
    player.isHuman = false;
    finished = applyTavernSpellEffect(
      state,
      player,
      spell,
      definition,
      target,
      recruitTavernSpellBuffBonus(player),
      "random",
    );
  } finally {
    player.isHuman = previousHumanFlag;
  }
  if (!finished || state.pendingInteraction !== previousPendingInteraction) {
    state.pendingInteraction = previousPendingInteraction;
    return false;
  }
  if (target) {
    triggerRecruitTargetedSpellCast(player, target);
  }
  recordRecruitTavernSpellCast(
    state,
    player,
    definition.id,
    false,
    false,
  );
  return true;
}

function beginTaughtTavernSpellBattlecry(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  repetitions: number,
): boolean {
  const definitionId = source.taughtTavernSpellDefinitionId;
  if (!definitionId || repetitions <= 0) {
    return false;
  }
  let definition: TavernSpellDefinition;
  try {
    definition = getTavernSpellDefinition(definitionId);
  } catch {
    return false;
  }
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    let target: BoardMinionInstance | undefined;
    if (tavernSpellNeedsTarget(definition)) {
      const candidates = tavernSpellLegalTargets(player, definition);
      if (candidates.length === 0) {
        observeRecruitBattlecryTriggered(player);
        continue;
      }
      target = candidates[randomIndex(state, candidates.length)];
    }
    resolveTaughtTavernSpellBattlecryCast(
      state,
      player,
      definition,
      target,
    );
    observeRecruitBattlecryTriggered(player);
  }
  return false;
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
  const isSystemSpell = isSystemTavernSpellDefinitionId(definition.id);
  player.hand.splice(handIndex, 1);
  const extraCasts = extraFirstSpellCasts(state, player);
  beginCardPlayed(player, {
    sourceInstanceId: card.instanceId,
    cardKind: isSystemSpell ? "other" : "tavernSpell",
    ...(isSystemSpell ? {} : { tier: definition.tier }),
    tribes: [],
  });
  if (!isSystemSpell) {
    player.pendingTavernSpellDefinitionId = definition.id;
  }
  const targetsFriendlyBoard =
    target !== undefined &&
    player.board.some(
      (minion) => minion.instanceId === target.instanceId,
    );
  const castCount =
    (isBountyTavernSpellDefinitionId(definition.id)
      ? bountyCastMultiplier(player.board)
      : targetsFriendlyBoard
        ? friendlyTargetSpellCastMultiplier(player.board)
        : 1) + extraCasts;
  const bonusAtCast = isSystemSpell
    ? { attack: 0, health: 0 }
    : recruitTavernSpellBuffBonus(player);
  for (let cast = 0; cast < castCount; cast += 1) {
    const finished = applyTavernSpellEffect(
      state,
      player,
      card,
      definition,
      target,
      bonusAtCast,
    );
    if (!finished) {
      if (
        !isSystemSpell &&
        state.pendingInteraction?.kind === "discover"
      ) {
        state.pendingInteraction.remainingDiscoveries += castCount - 1;
        state.pendingInteraction.remainingCastCompletions = castCount;
        state.pendingInteraction.firstCastFromHandPending = true;
      }
      return true;
    }
    if (target) {
      triggerRecruitTargetedSpellCast(player, target);
    }
    if (!isSystemSpell) {
      recordRecruitTavernSpellCast(
        state,
        player,
        definition.id,
        cast === 0,
        true,
      );
    } else {
      triggerRecruitAfterSpellCast(state, player, true);
    }
  }
  if (!isSystemSpell) {
    player.pendingTavernSpellDefinitionId = null;
  }
  finishCardPlayed(state, player);
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
    const castCount = 1 + extraFirstSpellCasts(state, player);
    beginCardPlayed(player, {
      sourceInstanceId: card.instanceId,
      cardKind: "other",
      tribes: [],
    });
    player.gold += castCount;
    for (let cast = 0; cast < castCount; cast += 1) {
      triggerRecruitAfterSpellCast(state, player);
    }
    finishCardPlayed(state, player);
    return true;
  }
  return card.kind === "tripleReward"
    ? castTripleReward(state, player, handIndex)
    : false;
}

function refreshShop(state: GameState, player: PlayerState): boolean {
  const warbandCopyRefresh = pendingWarbandCopyRefreshTrinket(player);
  const guidingCandleRefresh = availableGuidingCandleRefresh(player);
  const wishboneHeroRefresh = availableWishboneHeroRefresh(player);
  const usesHeroRefresh =
    player.heroRefreshAvailable &&
    playerHasHeroPower(player, "freeRefreshAtTurnStart");
  const healthSource = nextHealthRefreshSource(player);
  const quote = getTavernRefreshQuote(state, player.id);
  if (!quote?.affordable) {
    return false;
  }
  if (healthSource) {
    setEffectCounter(
      healthSource.minion,
      HEALTH_REFRESH_USED_COUNTER,
      healthSource.used + 1,
    );
    refreshDynamicMinionDescription(healthSource.minion, player);
  }
  if (warbandCopyRefresh) {
    player.trinketCounters[warbandCopyRefresh.id] = 0;
  } else if (usesHeroRefresh) {
    player.heroRefreshAvailable = false;
  } else if (wishboneHeroRefresh) {
    player.trinketCounters[wishboneHeroRefresh.id] = Math.max(
      0,
      (player.trinketCounters[wishboneHeroRefresh.id] ?? 0) - 1,
    );
  } else if (player.freeRefreshes > 0) {
    player.freeRefreshes -= 1;
  } else if (quote.currency === "health") {
    damageRecruitPlayer(player, quote.cost);
  } else {
    spendGold(state, player, quote.cost);
  }
  player.frozen = false;
  if (guidingCandleRefresh) {
    player.trinketCounters[guidingCandleRefresh.definition.id] =
      guidingCandleRefresh.used + 1;
    player.lastHelpfulRefreshKind = null;
    releaseShop(state, player);
    fillShop(state, player, false, 6);
    applyQueuedDemonFodderToRefresh(state, player);
    applyAfterTavernRefreshEffects(state, player);
    applyAfterManualRefreshTrinkets(state, player);
    return true;
  }
  if (warbandCopyRefresh) {
    releaseShop(state, player);
    const populated = populateHelpfulRefresh(
      state,
      player,
      "warbandCopies",
    );
    player.lastHelpfulRefreshKind = populated ? "warbandCopies" : null;
    if (!populated) {
      releaseShop(state, player);
      fillShop(state, player, false);
    }
    applyQueuedDemonFodderToRefresh(state, player);
    applyAfterTavernRefreshEffects(state, player);
    applyAfterManualRefreshTrinkets(state, player);
    return true;
  }
  if (player.helpfulRefreshes > 0) {
    const helpfulKind = refreshWithWisdomball(state, player, false);
    if (helpfulKind !== null) {
      player.helpfulRefreshes -= 1;
    }
    applyQueuedDemonFodderToRefresh(state, player);
    applyAfterTavernRefreshEffects(state, player);
    applyAfterManualRefreshTrinkets(state, player);
    return true;
  }
  player.lastHelpfulRefreshKind = null;
  releaseShop(state, player);
  fillShop(state, player, false);
  applyQueuedDemonFodderToRefresh(state, player);
  applyAfterTavernRefreshEffects(state, player);
  applyAfterManualRefreshTrinkets(state, player);
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
    for (
      let trigger = 0;
      trigger < heroPowerTriggerMultiplier(player);
      trigger += 1
    ) {
      player.gold += 2;
    }
  }
  if (
    player.tavernTier === 6 &&
    playerHasTrinketCardId(player, "BG35_MagicItem_814")
  ) {
    player.gold += 12;
  }
  return true;
}

function ownedNormalCount(
  player: PlayerState,
  definitionId: string,
  excludedInstanceId?: string,
): number {
  return [...player.board, ...player.hand].filter(
    (minion) =>
      minion.kind === "minion" &&
      minion.instanceId !== excludedInstanceId &&
      minion.definitionId === definitionId && minion.golden === false,
  ).length;
}

export type AiMinionScorePurpose = "card" | "magneticAttachment";

function tripleProgressForCandidate(
  player: PlayerState,
  candidate: BoardMinionInstance,
  excludedInstanceId?: string,
  purpose: AiMinionScorePurpose = "card",
): number {
  const owned = ownedTripleMinions(player).filter(
    (minion) => minion.instanceId !== excludedInstanceId,
  );
  const candidateDefinition = getMinionDefinition(candidate.definitionId);
  const wildcardTribe = candidateDefinition.tripleWildcardFor;
  if (
    purpose === "magneticAttachment" ||
    (candidate.golden && wildcardTribe === undefined)
  ) {
    // A fused Magnetic card does not remain a triple entity. Ordinary Golden
    // minions cannot combine again; Elemental of Surprise is the exception
    // because its Golden text explicitly remains a physical wildcard.
    return 0;
  }
  if (wildcardTribe !== undefined) {
    // Golden wildcards still count as one physical wildcard card and can be
    // retripled with two more wildcard entities.
    let best = owned.filter(
      (minion) => minion.definitionId === candidate.definitionId,
    ).length;
    const compatibleWildcards = owned.filter(
      (minion) =>
        getMinionDefinition(minion.definitionId).tripleWildcardFor ===
        wildcardTribe,
    ).length;
    const targetDefinitionIds = new Set(
      owned
        .filter((minion) => {
          const definition = getMinionDefinition(minion.definitionId);
          return (
            minion.golden === false &&
            definition.tripleWildcardFor === undefined &&
            definitionHasTribe(definition, wildcardTribe)
          );
        })
        .map((minion) => minion.definitionId),
    );
    for (const definitionId of targetDefinitionIds) {
      best = Math.max(
        best,
        ownedNormalCount(player, definitionId, excludedInstanceId) +
          compatibleWildcards,
      );
    }
    return Math.min(2, best);
  }

  let progress = ownedNormalCount(
    player,
    candidate.definitionId,
    excludedInstanceId,
  );
  for (const wildcard of owned) {
    const tribe = getMinionDefinition(
      wildcard.definitionId,
    ).tripleWildcardFor;
    if (tribe !== undefined && definitionHasTribe(candidateDefinition, tribe)) {
      progress += 1;
    }
  }
  return Math.min(2, progress);
}

function tribeCount(player: PlayerState, tribe: Tribe): number {
  return player.board.filter((minion) => minionHasTribe(minion, tribe)).length;
}

const AI_ECONOMY_EFFECT_KINDS = new Set<MinionEffect["kind"]>([
  "gainGold",
  "gainNextTurnGold",
  "gainFreeRefreshes",
  "gainTavernSpell",
  "gainGeneratedSpell",
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
        (effect) =>
          effect.kind === "castTavernSpell" ||
          effect.kind === "castTavernSpellOnAdjacent",
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
        if (effect.kind === "summonRandomMinion") {
          if (effect.filter.tribe === tribe) {
            summons += 1;
          }
          continue;
        }
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
  purpose: AiMinionScorePurpose = "card",
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
  if (
    definitions.some(
      (definition) =>
        definition.battlecry || definition.interactiveBattlecry,
    )
  ) {
    score += profile.battlecryBonus * battlecryScale;
  }
  const projectedBoard = boardWithCandidate(player, minion);
  const availableDeathrattleSpace = Math.max(
    0,
    MAX_BOARD_SIZE - Math.min(MAX_BOARD_SIZE, projectedBoard.length) + 1,
  );
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
    for (const effect of definition.battlecry ?? []) {
      if (effect.kind === "buffThenDamageFriendly") {
        const targets = projectedBoard.filter(
          (target) =>
            target.instanceId !== minion.instanceId &&
            (!effect.tribes ||
              effect.tribes.some((tribe) =>
                minionHasTribe(target, tribe),
              )),
        ).length;
        const pulses =
          Math.max(1, Math.floor(effect.pulses ?? 1)) *
          (minion.golden && effect.goldenMode === "repeat" ? 2 : 1);
        score +=
          targets *
          pulses *
          Math.max(0, effect.attack + effect.health - effect.damage) *
          battlecryScale *
          0.45;
      } else if (
        effect.kind === "buffOtherFriendlyTribeByFamilyPlayed"
      ) {
        const targets = projectedBoard.filter(
          (target) =>
            target.instanceId !== minion.instanceId &&
            minionHasTribe(target, effect.tribe),
        ).length;
        const familyCount =
          effect.family === "mrrglton"
            ? player.mrrgltonsPlayed + (candidateAlreadyOwned ? 0 : 1)
            : 0;
        const amount =
          ((effect.attack > 0 ? effect.attack : effect.health) +
            familyCount) *
          (minion.golden && effect.goldenMode === "doubleStats" ? 2 : 1);
        score += targets * amount * battlecryScale * 0.45;
      }
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
      } else if (effect.kind === "summon") {
        const doublesCount =
          minion.golden && effect.goldenMode === "doubleCount";
        const baseSummonCount =
          effect.count === "sourceAttack"
            ? Math.max(0, minion.attack)
            : effect.count;
        const summonCount = baseSummonCount * (doublesCount ? 2 : 1);
        const expectedSummons = Math.min(
          summonCount,
          availableDeathrattleSpace,
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
          ((effect.definitionId === BEETLE_TOKEN_DEFINITION_ID
            ? 0
            : (token.attack + token.health) *
              (goldenToken ? 2 : 1)) +
            gemCount *
              (player.bloodGemAttack +
                player.bloodGemHealth)) *
          deathrattleScale *
          0.3;
      } else if (effect.kind === "summonRandomMinion") {
        if (availableDeathrattleSpace > 0) {
          const statScale =
            minion.golden && effect.goldenMode === "doubleSetStats"
              ? 2
              : 1;
          score +=
            (effect.setAttack + effect.setHealth) *
            statScale *
            deathrattleScale *
            0.3;
        }
      } else if (effect.kind === "castTavernSpellOnAdjacent") {
        const otherMinions = projectedBoard.filter(
          (target) => target.instanceId !== minion.instanceId,
        );
        const targetCount = Math.min(
          minion.golden && effect.goldenMode === "allAdjacent" ? 2 : 1,
          otherMinions.length,
        );
        const shiftingTideStatValue = otherMinions
          .map((target) => (minionHasTribe(target, "naga") ? 8 : 4))
          .sort((left, right) => right - left)
          .slice(0, targetCount)
          .reduce((total, value) => total + value, 0);
        const combatCastMultiplier =
          1 +
          projectedBoard.reduce(
            (warbandTotal, source) =>
              warbandTotal +
              minionEffectSources(source).reduce(
                (sourceTotal, component) =>
                  sourceTotal +
                  (getMinionDefinition(component.definitionId)
                    .combatTavernSpellExtraCasts ?? 0) *
                    (component.golden ? 2 : 1),
                0,
              ),
            0,
          );
        score +=
          shiftingTideStatValue *
          friendlyTargetSpellCastMultiplier(projectedBoard) *
          combatCastMultiplier *
          deathrattleScale *
          0.3;
      } else if (effect.kind === "buffThenDamageFriendly") {
        const pulses =
          Math.max(1, Math.floor(effect.pulses ?? 1)) *
          (minion.golden && effect.goldenMode === "repeat" ? 2 : 1);
        const damageTriggerValue = projectedBoard.reduce(
          (warbandTotal, watcher) =>
            warbandTotal +
            minionEffectSources(watcher).reduce(
              (watcherTotal, component) => {
                const trigger = getMinionDefinition(
                  component.definitionId,
                ).afterFriendlyDamaged;
                if (!trigger) {
                  return watcherTotal;
                }
                const eligibleTargets = projectedBoard.filter(
                  (target) =>
                    target.instanceId !== minion.instanceId &&
                    !target.divineShield &&
                    minionHasTribe(target, trigger.tribe) &&
                    (!trigger.otherOnly ||
                      target.instanceId !== watcher.instanceId),
                ).length;
                return (
                  watcherTotal +
                  eligibleTargets *
                    (trigger.attack + trigger.health) *
                    (component.golden ? 2 : 1)
                );
              },
              0,
            ),
          0,
        );
        score +=
          damageTriggerValue *
          pulses *
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
      } else if (effect.kind === "destroyKiller") {
        score += 12 * deathrattleScale;
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
      const evolvingRewardTier =
        definition.spellcraft.evolvingRewardTier;
      if (evolvingRewardTier) {
        score +=
          effectCounter(
            minion,
            EVOLVING_SPELLCRAFT_TIER_COUNTER,
            evolvingRewardTier.initialTier,
          ) *
          (minion.golden ? 2 : 1) *
          0.9;
      }
    }
    if (definition.sellDiscover) {
      const discoverTier = effectCounter(
        minion,
        PATIENT_SCOUT_TIER_COUNTER,
        definition.sellDiscover.initialTier,
      );
      score +=
        profile.economyBonus +
        discoverTier *
          definition.sellDiscover.discoveries *
          (minion.golden ? 2 : 1) *
          0.9;
    }
    if (definition.afterHeroDamaged) {
      const selfDamageSources = projectedBoard.filter((candidate) => {
        const candidateDefinition = getMinionDefinition(
          candidate.definitionId,
        );
        return (
          (candidateDefinition.battlecry ?? []).some(
            (effect) => effect.kind === "damageHero",
          ) ||
          candidateDefinition.afterFriendlyPlayed?.heroDamage !==
            undefined ||
          candidateDefinition.healthRefreshesPerTurn !== undefined ||
          candidateDefinition.interactiveBattlecry?.kind ===
            "discoverMinion" &&
            candidateDefinition.interactiveBattlecry
              .damageHeroByDiscoveredTier === true
        );
      }).length;
      score +=
        (3 + Math.min(4, selfDamageSources) * 2) *
        (minion.golden ? 1.5 : 1);
    }
    if (definition.healthRefreshesPerTurn) {
      const maximum =
        definition.healthRefreshesPerTurn.count *
        (minion.golden ? 2 : 1);
      const remaining = Math.max(
        0,
        maximum -
          effectCounter(minion, HEALTH_REFRESH_USED_COUNTER, 0),
      );
      const hasRewinder = projectedBoard.some(
        (candidate) =>
          getMinionDefinition(candidate.definitionId)
            .afterHeroDamaged !== undefined,
      );
      score +=
        remaining *
        (profile.economyBonus + (hasRewinder ? 2.5 : 0.8));
    }
    if (
      definition.onPlayChoice?.kind === "beastKeywordBuff" &&
      !candidateAlreadyOwned
    ) {
      const targets = player.board.filter((candidate) =>
        minionHasTribe(candidate, "beast"),
      );
      if (targets.length > 0) {
        score +=
          Math.max(
            definition.onPlayChoice.rebornAttack +
              definition.onPlayChoice.rebornHealth +
              5,
            definition.onPlayChoice.windfuryAttack + 4,
          ) * (minion.golden ? 2 : 1);
      }
    }
    if (
      definition.interactiveBattlecry?.kind ===
      "destroyFriendlyAndCopy"
    ) {
      const eligible = player.board.filter((candidate) =>
        minionHasTribe(
          candidate,
          definition.interactiveBattlecry?.kind ===
            "destroyFriendlyAndCopy"
            ? definition.interactiveBattlecry.targetTribe
            : "neutral",
        ),
      );
      if (eligible.length > 0) {
        score +=
          profile.economyBonus +
          definition.interactiveBattlecry.copies *
            (minion.golden ? 2 : 1) *
            3;
      }
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
  const handTavernStatSpells = player.hand.filter(
    (card) =>
      card.kind === "tavernSpell" &&
      RIME_OR_REASON_STAT_GRANTING_CARD_IDS.some(
        (cardId) =>
          cardId ===
          getTavernSpellDefinition(card.definitionId).cardId,
      ),
  ).length;
  const handSpellcraft = player.hand.filter(
    (card) =>
      card.kind === "spellcraft" && card.spellFamily === "spellcraft",
  ).length;
  const handSpellCasts = player.hand.filter(
    (card) =>
      card.kind === "tavernSpell" ||
      card.kind === "spellcraft" ||
      card.kind === "bloodGem" ||
      card.kind === "tripleReward" ||
      card.kind === "consolationCoin",
  ).length;
  const handFriendlyTargetSpells = player.hand.filter((card) => {
    if (card.kind === "bloodGem") {
      return true;
    }
    if (card.kind === "spellcraft") {
      return getSpellcraftDefinition(card.definitionId).target === "friendly";
    }
    if (card.kind === "tavernSpell") {
      const target = getTavernSpellDefinition(card.definitionId).target;
      return target === "friendly" || target === "anyMinion";
    }
    return false;
  }).length;
  const handBounties = player.hand.filter(
    (card) =>
      card.kind === "tavernSpell" &&
      isBountyTavernSpellDefinitionId(card.definitionId),
  ).length;
  for (const component of minionEffectSources(minion)) {
    const definition = getMinionDefinition(component.definitionId);
    const scale = component.golden ? 2 : 1;
    if (definition.tavernSpellBuffAura) {
      const expectedCasts = Math.max(1, handTavernStatSpells);
      const growsThisTurn = definition.afterCardPlayed?.effects.some(
        (effect) => effect.kind === "improveTavernSpellAuraThisTurn",
      );
      score +=
        (definition.tavernSpellBuffAura.attack * scale +
          definition.tavernSpellBuffAura.health * scale +
          (growsThisTurn
            ? (effectCounter(
                minion,
                TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
                0,
              ) +
                effectCounter(
                  minion,
                  TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
                  0,
                )) *
              scale
            : 0)) *
        expectedCasts *
        Math.max(1, projectedBoard.length) *
        0.28;
    }
    if (definition.tavernSpellHistoryBuff) {
      score +=
        (definition.tavernSpellHistoryBuff.attack +
          definition.tavernSpellHistoryBuff.health) *
        scale *
        1.5;
    }
    if (definition.afterSpellCast) {
      score +=
        (definition.afterSpellCast.attack +
          definition.afterSpellCast.health) *
        scale *
        Math.max(1, Math.min(3, handSpellCasts)) *
        Math.max(1, projectedBoard.length) *
        0.2;
    }
    if (definition.afterPlayerSpellCast) {
      const averageShopStats =
        player.shop.length === 0
          ? 0
          : player.shop.reduce(
              (total, offer) => total + offer.attack + offer.health,
              0,
            ) / player.shop.length;
      const remaining = Math.max(
        1,
        definition.afterPlayerSpellCast.spellsRequired -
          effectCounter(minion, PLAYER_SPELL_PROGRESS_COUNTER, 0),
      );
      score +=
        averageShopStats *
        (component.golden &&
        definition.afterPlayerSpellCast.goldenMode === "doubleStats"
          ? 2
          : 1) *
        Math.min(1, Math.max(0, handSpellCasts) / remaining) *
        0.7;
    }
    const spellHistoryBuff = definition.afterCardPlayed?.effects.find(
      (effect) => effect.kind === "buffSelfByPlayerSpellHistory",
    );
    if (
      spellHistoryBuff?.kind === "buffSelfByPlayerSpellHistory" &&
      spellHistoryBuff.spellsPerUpgrade > 0
    ) {
      const stages =
        1 +
        Math.floor(
          Math.max(0, player.playerSpellsCast ?? 0) /
            spellHistoryBuff.spellsPerUpgrade,
        );
      score +=
        (spellHistoryBuff.attack + spellHistoryBuff.health) *
        scale *
        stages *
        1.5;
    }
    if (definition.spellcraftPermanentOnSelf) {
      const remainingCasts = Math.max(
        0,
        definition.spellcraftPermanentOnSelf.castsPerTurn * scale -
          effectCounter(
            minion,
            SPELLCRAFT_PERMANENT_CASTS_COUNTER,
            0,
          ),
      );
      score +=
        Math.min(
          remainingCasts,
          Math.max(1, handSpellcraft),
        ) * 2.5;
    }
    if (definition.copySpellcraftOnSelf) {
      const canCopy =
        effectCounter(minion, SPELLCRAFT_COPY_USED_COUNTER, 0) === 0;
      score +=
        definition.copySpellcraftOnSelf.count *
        scale *
        (canCopy ? 1 : 0) *
        Math.max(1, Math.min(2, handSpellcraft)) *
        (1.5 + profile.economyBonus * 0.2);
    }
    if (definition.friendlyTargetSpellExtraCasts) {
      score +=
        definition.friendlyTargetSpellExtraCasts *
        scale *
        Math.max(1, Math.min(3, handFriendlyTargetSpells)) *
        3;
    }
    if (definition.afterTargetedSpellCast?.kind === "gainVenomous") {
      score +=
        (1 + Math.min(3, handFriendlyTargetSpells)) *
        (component.golden ? 7 : 4);
    }
    if (definition.bountyExtraCasts) {
      score +=
        definition.bountyExtraCasts *
        scale *
        (1 + Math.min(3, handBounties)) *
        5;
    }
    const handTrigger = definition.afterCardAddedToHand;
    if (handTrigger?.kind === "buffRandomOtherPirate") {
      const otherPirates = projectedBoard.filter(
        (target) =>
          target.instanceId !== minion.instanceId &&
          minionHasTribe(target, "pirate"),
      ).length;
      const repetitions =
        component.golden && handTrigger.goldenMode === "repeat" ? 2 : 1;
      score +=
        Math.min(3, Math.max(1, player.hand.length + 1)) *
        Math.min(2, otherPirates) *
        (handTrigger.attack + handTrigger.health) *
        repetitions *
        0.3;
    } else if (
      handTrigger?.kind === "buffWarbandAfterTribeCardAdded"
    ) {
      const sourceScale =
        component.golden && handTrigger.goldenMode === "doubleStats"
          ? 2
          : 1;
      const pulseValue = projectedBoard.reduce(
        (total, target) =>
          total +
          (target.golden
            ? handTrigger.goldenTargetAttack +
              handTrigger.goldenTargetHealth
            : handTrigger.attack + handTrigger.health),
        0,
      );
      score += pulseValue * sourceScale * 0.35;
    }
    if (definition.afterMinionConsumed) {
      const consumers = projectedBoard.reduce(
        (total, target) => {
          const targetDefinition = getMinionDefinition(
            target.definitionId,
          );
          const consumes =
            (targetDefinition.battlecry ?? []).some(
              (effect) => effect.kind === "consumeRandomShopMinion",
            ) ||
            targetDefinition.endOfTurn?.kind ===
              "consumeHighestHealthShop" ||
            targetDefinition.endOfTurn?.kind === "demonsConsumeShop";
          return total + (consumes ? 1 : 0);
        },
        0,
      );
      score +=
        Math.min(4, Math.max(1, consumers)) *
        (definition.afterMinionConsumed.tavernAttackThisTurn +
          definition.afterMinionConsumed.tavernHealthThisTurn) *
        scale *
        Math.max(1, Math.min(4, player.shop.length)) *
        0.35;
    }
    if (
      definition.endOfTurn?.kind ===
      "gainUpgradingMagneticSatellites"
    ) {
      const effect = definition.endOfTurn;
      const statScale =
        component.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
      const satelliteStats =
        effect.attack * statScale +
        effect.health * statScale +
        effectCounter(
          minion,
          MAGNETIC_SATELLITE_ATTACK_BONUS_COUNTER,
          0,
        ) +
        effectCounter(
          minion,
          MAGNETIC_SATELLITE_HEALTH_BONUS_COUNTER,
          0,
        );
      const handSpace = Math.max(0, MAX_HAND_SIZE - player.hand.length);
      score +=
        Math.min(effect.count, Math.max(1, handSpace)) *
        satelliteStats *
        (projectedBoard.some((target) => minionHasTribe(target, "mech"))
          ? 0.35
          : 0.22);
    }
    if (
      definition.onPlayChoice?.kind === "tavernSpellBuff" &&
      !candidateAlreadyOwned
    ) {
      score +=
        Math.max(
          definition.onPlayChoice.attack,
          definition.onPlayChoice.health,
        ) *
        scale *
        Math.max(1, handTavernStatSpells) *
        2;
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
  const evaluatedMinionIsOwned = ownedTripleMinions(player).some(
    (owned) => owned.instanceId === minion.instanceId,
  );
  const tripleProgress = tripleProgressForCandidate(
    player,
    minion,
    evaluatedMinionIsOwned ? minion.instanceId : undefined,
    purpose,
  );
  if (tripleProgress === 1) {
    score += profile.pairBonus;
  } else if (tripleProgress >= 2) {
    score += profile.tripleBonus;
  }
  return score;
}

export function scoreMinionForAi(
  player: PlayerState,
  minion: BoardMinionInstance,
  purpose: AiMinionScorePurpose = "card",
): number {
  return minionScore(player, minion, purpose);
}

function bestMinionByScore(
  player: PlayerState,
  options: readonly BoardMinionInstance[],
  purpose: AiMinionScorePurpose = "card",
): BoardMinionInstance {
  return [...options].sort((left, right) => {
    const scoreDifference =
      minionScore(player, right, purpose) -
      minionScore(player, left, purpose);
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

function prepareDiscoverSelection(
  player: PlayerState,
  selected: BoardMinionInstance,
  effect: PendingDiscoverInteraction["selectionEffect"],
): void {
  if (effect?.kind === "rememberTrinketMinion") {
    player.trinketSelections[effect.trinketDefinitionId] =
      selected.definitionId;
  } else if (effect?.kind === "setStats") {
    selected.attack = effect.attack;
    selected.health = effect.health;
  } else if (effect?.kind === "makeGolden") {
    makeMinionGoldenPreservingEnchantments(selected);
  }
}

function applyDiscoverSelectionAfterResolution(
  player: PlayerState,
  selected: BoardMinionInstance,
  effect: PendingDiscoverInteraction["selectionEffect"],
): void {
  if (effect?.kind === "damageHeroBySelectedTier") {
    damageRecruitPlayer(player, selected.tier);
  }
}

function darkmoonPrizeAiScore(
  player: PlayerState,
  definition: SpellcraftDefinition,
): number {
  switch (definition.effect) {
    case "darkmoonBuyTheHolyLight":
      return player.board.length > 0 ? 18 : 0;
    case "darkmoonBananas":
      return Math.max(0, MAX_HAND_SIZE - player.hand.length) * 2;
    case "darkmoonTopShelf":
      return 12 + player.tavernTier;
    case "darkmoonRepeatCustomer":
      return player.board.some((minion) => !minion.golden) ? 14 : 0;
    case "darkmoonAllThatGlitters":
      return player.shop.length > 0 ? 13 : 0;
    case "darkmoonMindflayerGoggles":
      return Math.min(
        MAX_HAND_SIZE - player.hand.length,
        player.shop.length + tavernSpellShopOffers(player).length,
      ) * 4;
    case "darkmoonReservePrices":
      return tavernSpellShopOffers(player).length > 0 ? 10 : 4;
    case "darkmoonTrainingSession":
      return 8;
    default:
      return 0;
  }
}

function reserveDarkmoonPrizeOptions(
  state: GameState,
): SpellcraftSpellInstance[] {
  const candidates = [...DARKMOON_PRIZE_DEFINITIONS];
  shuffleInPlace(state, candidates);
  return candidates
    .slice(0, 3)
    .map((definition) => createSpellcraftSpell(state, definition));
}

function beginDarkmoonPrizeDiscoverInteraction(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  discoveries: number,
  completionSource?: "generatedSpellCast",
): boolean {
  if (
    discoveries <= 0 ||
    (player.isHuman && state.pendingInteraction !== null)
  ) {
    return false;
  }
  const options = reserveDarkmoonPrizeOptions(state);
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    const selected = [...options].sort((left, right) => {
      const scoreDifference =
        darkmoonPrizeAiScore(
          player,
          getSpellcraftDefinition(right.definitionId),
        ) -
        darkmoonPrizeAiScore(
          player,
          getSpellcraftDefinition(left.definitionId),
        );
      return scoreDifference !== 0
        ? scoreDifference
        : left.definitionId.localeCompare(right.definitionId);
    })[0];
    if (selected && player.hand.length < MAX_HAND_SIZE) {
      addCardToHand(state, player, selected);
    }
    beginDarkmoonPrizeDiscoverInteraction(
      state,
      player,
      sourceInstanceId,
      discoveries - 1,
      completionSource,
    );
    return true;
  }
  state.pendingInteraction = {
    kind: "darkmoonPrizeDiscover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId,
    options,
    remainingDiscoveries: discoveries,
    ...(completionSource ? { completionSource } : {}),
  };
  return true;
}

function queueTickatusTagPrize(player: PlayerState): void {
  player.pendingTickatusTagPrizes =
    Math.max(
      0,
      Math.floor(player.pendingTickatusTagPrizes ?? 0),
    ) + 1;
}

function flushPendingTickatusTagPrizes(
  state: GameState,
  player: PlayerState,
): void {
  const tickatusTag = playerTrinkets(player).find(
    (definition) => definition.cardId === TICKATUS_TAG_CARD_ID,
  );
  if (!tickatusTag) {
    player.pendingTickatusTagPrizes = 0;
    return;
  }
  let pending = Math.max(
    0,
    Math.floor(player.pendingTickatusTagPrizes ?? 0),
  );
  while (pending > 0 && state.pendingInteraction === null) {
    if (
      !beginDarkmoonPrizeDiscoverInteraction(
        state,
        player,
        tickatusTag.id,
        1,
      )
    ) {
      break;
    }
    pending -= 1;
    player.pendingTickatusTagPrizes = pending;
  }
}

function beginTimewarpCandlestickDiscover(
  state: GameState,
  player: PlayerState,
  definition: TrinketDefinition,
): boolean {
  if (player.isHuman && state.pendingInteraction !== null) {
    return false;
  }
  const isLesser = definition.cardId === LESSER_OLD_CANDLESTICK_CARD_ID;
  const pool = TIMEWARP_COST_TWO_MINION_DEFINITIONS[
    isLesser ? "lesser" : "greater"
  ];
  const candidates = [...pool];
  shuffleInPlace(state, candidates);
  const options = candidates
    .slice(0, 3)
    .map((candidate) => createMinionInstance(state, candidate.id, 0));
  for (const option of options) {
    reconcileWhereverMinion(
      option,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  }
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    const selected = bestMinionByScore(player, options);
    const gainsSelected = player.hand.length < MAX_HAND_SIZE;
    returnDiscoverOptions(
      state,
      options,
      gainsSelected ? selected.instanceId : undefined,
    );
    if (gainsSelected) {
      applyOwnedUndeadArmyBonus(player, selected);
      applyOwnedBeetleBonus(player, selected);
      reconcileWhereverMinion(
        selected,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
        );
      addCardToHand(state, player, selected);
      resolveTriples(state, player);
    }
    applyAfterDiscoverTrinkets(state, player, selected.definitionId);
    return true;
  }
  state.pendingInteraction = {
    kind: "discover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: definition.id,
    options,
    filter: { exactTier: isLesser ? 3 : 5 },
    remainingDiscoveries: 1,
    destination: { kind: "hand", allowOverflow: true },
    sourceDefinitionId: definition.id,
  };
  return true;
}

function beginDiscoverInteraction(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  filter: DiscoverFilter,
  discoveries: number,
  destination: DiscoverDestination,
  completionSource?: PendingDiscoverInteraction["completionSource"],
  selectionEffect?: PendingDiscoverInteraction["selectionEffect"],
  sourceDefinitionId?: string,
  nonHumanSelectionMode: NonHumanChoiceMode = "best",
  battlecry = false,
  battlecryEffectRepetitionsPerTrigger = 1,
): boolean {
  if (discoveries <= 0) {
    return false;
  }
  if (
    (destination.kind === "hand" &&
      destination.allowOverflow !== true &&
      player.hand.length >= MAX_HAND_SIZE) ||
    (player.isHuman && state.pendingInteraction !== null)
  ) {
    if (battlecry) {
      const unresolvedTriggers = Math.ceil(
        discoveries /
          Math.max(1, battlecryEffectRepetitionsPerTrigger),
      );
      for (let pulse = 0; pulse < unresolvedTriggers; pulse += 1) {
        observeRecruitBattlecryTriggered(player);
      }
    }
    return false;
  }
  const options = reserveDiscoverOptions(state, filter);
  for (const option of options) {
    reconcileWhereverMinion(
      option,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
      player.tavernSpellsCast ?? 0,
      player.deathrattlesTriggered ?? 0,
      player.magnetizationsThisGame ?? 0,
    );
  }
  if (options.length === 0) {
    if (battlecry) {
      const unresolvedTriggers = Math.ceil(
        discoveries /
          Math.max(1, battlecryEffectRepetitionsPerTrigger),
      );
      for (let pulse = 0; pulse < unresolvedTriggers; pulse += 1) {
        observeRecruitBattlecryTriggered(player);
      }
    }
    return false;
  }
  if (!player.isHuman) {
    const selected =
      nonHumanSelectionMode === "random"
        ? options[randomIndex(state, options.length)]
        : bestMinionByScore(
            player,
            options,
            destination.kind === "magnetize" ? "magneticAttachment" : "card",
          );
    const gainsSelected =
      destination.kind !== "hand" ||
      player.hand.length < MAX_HAND_SIZE;
    returnDiscoverOptions(
      state,
      options,
      gainsSelected ? selected.instanceId : undefined,
    );
    prepareDiscoverSelection(player, selected, selectionEffect);
    if (destination.kind === "hand") {
      if (gainsSelected) {
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
          player.tavernSpellsCast ?? 0,
          player.deathrattlesTriggered ?? 0,
          player.magnetizationsThisGame ?? 0,
        );
        addCardToHand(state, player, selected);
        resolveTriples(state, player);
      }
    } else if (destination.kind === "magnetize") {
      const target = player.board.find(
        (minion) =>
          minion.instanceId === destination.targetInstanceId,
      );
      if (!target) {
        returnMinionToPool(state, selected);
        if (battlecry) {
          const unresolvedTriggers = Math.ceil(
            discoveries /
              Math.max(1, battlecryEffectRepetitionsPerTrigger),
          );
          for (let trigger = 0; trigger < unresolvedTriggers; trigger += 1) {
            observeRecruitBattlecryTriggered(player);
          }
        }
        return false;
      }
      fuseMinionIntoHost(state, player, selected, target);
      applyAfterMagnetizedEffects(state, player);
    } else if (destination.kind === "transform") {
      if (
        !transformFriendlyMinionFromDiscover(
          state,
          player,
          selected,
          destination.targetInstanceId,
        )
      ) {
        returnMinionToPool(state, selected);
        if (battlecry) {
          const unresolvedTriggers = Math.ceil(
            discoveries /
              Math.max(1, battlecryEffectRepetitionsPerTrigger),
          );
          for (let trigger = 0; trigger < unresolvedTriggers; trigger += 1) {
            observeRecruitBattlecryTriggered(player);
          }
        }
        return false;
      }
    } else {
      return false;
    }
    applyDiscoverSelectionAfterResolution(player, selected, selectionEffect);
    if (destination.kind !== "transform") {
      applyAfterDiscoverTrinkets(state, player, selected.definitionId);
    }
    if (
      battlecry &&
      (discoveries - 1) %
        Math.max(1, battlecryEffectRepetitionsPerTrigger) ===
        0
    ) {
      observeRecruitBattlecryTriggered(player);
    }
    const remainingDiscoveries =
      destination.kind === "transform" && selected.tier >= 6
        ? 0
        : discoveries - 1;
    const continuedFilter =
      destination.kind === "transform"
        ? { exactTier: (selected.tier + 1) as MinionTier }
        : filter;
    beginDiscoverInteraction(
      state,
      player,
      sourceInstanceId,
      continuedFilter,
      remainingDiscoveries,
      destination,
      completionSource,
      selectionEffect,
      sourceDefinitionId,
      nonHumanSelectionMode,
      battlecry,
      battlecryEffectRepetitionsPerTrigger,
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
    sourceDefinitionId,
    selectionEffect,
    completionSource,
    ...(battlecry ? { battlecry: true as const } : {}),
    ...(battlecry
      ? { battlecryEffectRepetitionsPerTrigger }
      : {}),
  };
  state.pendingInteraction = interaction;
  return true;
}

function beginTavernSpellDiscoverInteraction(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  discoveries: number,
  maximumTier: TavernTier,
  sourceDefinitionId?: string,
  battlecry = false,
  battlecryEffectRepetitionsPerTrigger = 1,
): boolean {
  if (discoveries <= 0) {
    return false;
  }
  if (player.isHuman && state.pendingInteraction !== null) {
    if (battlecry) {
      const unresolvedTriggers = Math.ceil(
        discoveries /
          Math.max(1, battlecryEffectRepetitionsPerTrigger),
      );
      for (let pulse = 0; pulse < unresolvedTriggers; pulse += 1) {
        observeRecruitBattlecryTriggered(player);
      }
    }
    return false;
  }
  const options = reserveTavernSpellDiscoverOptions(state, maximumTier);
  if (options.length === 0) {
    if (battlecry) {
      const unresolvedTriggers = Math.ceil(
        discoveries /
          Math.max(1, battlecryEffectRepetitionsPerTrigger),
      );
      for (let pulse = 0; pulse < unresolvedTriggers; pulse += 1) {
        observeRecruitBattlecryTriggered(player);
      }
    }
    return false;
  }
  if (!player.isHuman) {
    const selected = [...options].sort((left, right) => {
      const difference =
        tavernSpellAiScore(player, right) -
        tavernSpellAiScore(player, left);
      return difference !== 0
        ? difference
        : left.definitionId.localeCompare(right.definitionId);
    })[0];
    if (player.hand.length < MAX_HAND_SIZE) {
      addCardToHand(state, player, selected);
    }
    if (
      battlecry &&
      (discoveries - 1) %
        Math.max(1, battlecryEffectRepetitionsPerTrigger) ===
        0
    ) {
      observeRecruitBattlecryTriggered(player);
    }
    beginTavernSpellDiscoverInteraction(
      state,
      player,
      sourceInstanceId,
      discoveries - 1,
      maximumTier,
      sourceDefinitionId,
      battlecry,
      battlecryEffectRepetitionsPerTrigger,
    );
    return true;
  }
  state.pendingInteraction = {
    kind: "tavernSpellDiscover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId,
    options,
    maximumTier,
    remainingDiscoveries: discoveries,
    sourceDefinitionId,
    ...(battlecry ? { battlecry: true as const } : {}),
    ...(battlecry
      ? { battlecryEffectRepetitionsPerTrigger }
      : {}),
  };
  return true;
}

function makeFriendlyGoldenCandidates(
  player: PlayerState,
  maximumTier: TavernTier,
): BoardMinionInstance[] {
  return player.board.filter(
    (candidate) =>
      !candidate.golden &&
      getMinionDefinition(candidate.definitionId).tier <= maximumTier,
  );
}

function makeRecruitMinionGolden(
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  makeMinionGoldenPreservingEnchantments(target);
  reconcileWhereverMinion(
    target,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
    player.tavernSpellsCast ?? 0,
    player.deathrattlesTriggered ?? 0,
    player.magnetizationsThisGame ?? 0,
  );
  refreshDynamicMinionDescription(target, player);
}

function beginInteractiveBattlecry(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  battlecryTriggers: number,
): void {
  const ability = getMinionDefinition(
    source.definitionId,
  ).interactiveBattlecry;
  if (!ability) {
    return;
  }
  const goldenRepetitions =
    source.golden && ability.goldenMode === "repeat" ? 2 : 1;
  const repetitions = battlecryTriggers * goldenRepetitions;
  if (ability.kind === "discoverTavernSpell") {
    beginTavernSpellDiscoverInteraction(
      state,
      player,
      source.instanceId,
      repetitions,
      6,
      source.definitionId,
      true,
      goldenRepetitions,
    );
    return;
  }
  if (ability.kind === "discoverMinion") {
    if (
      ability.requiresOtherTribe &&
      !player.board.some(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, ability.requiresOtherTribe),
      )
    ) {
      for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
        observeRecruitBattlecryTriggered(player);
      }
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
      {
        kind: "hand",
        allowOverflow: ability.allowHandOverflow === true,
      },
      undefined,
      ability.damageHeroByDiscoveredTier
        ? { kind: "damageHeroBySelectedTier" }
        : undefined,
      source.definitionId,
      "best",
      true,
      goldenRepetitions,
    );
    return;
  }

  if (ability.kind === "makeFriendlyGolden") {
    const targetsPerTrigger =
      ability.targets *
      (source.golden && ability.goldenMode === "doubleTargets" ? 2 : 1);
    const totalTargets = battlecryTriggers * targetsPerTrigger;
    const candidates = makeFriendlyGoldenCandidates(
      player,
      ability.maximumTier,
    );
    if (candidates.length === 0) {
      for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
        observeRecruitBattlecryTriggered(player);
      }
      return;
    }
    if (!player.isHuman) {
      for (let targetIndex = 0; targetIndex < totalTargets; targetIndex += 1) {
        const remainingCandidates = makeFriendlyGoldenCandidates(
          player,
          ability.maximumTier,
        );
        if (remainingCandidates.length === 0) {
          break;
        }
        makeRecruitMinionGolden(
          player,
          bestMinionByScore(player, remainingCandidates),
        );
      }
      for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
        observeRecruitBattlecryTriggered(player);
      }
      return;
    }
    state.pendingInteraction = {
      kind: "target",
      interactionId: nextInteractionId(state),
      playerId: player.id,
      sourceInstanceId: source.instanceId,
      optionInstanceIds: candidates.map((minion) => minion.instanceId),
      attack: 0,
      health: 0,
      repetitions: totalTargets,
      resolution: {
        kind: "makeGolden",
        maximumTier: ability.maximumTier,
      },
      battlecry: true,
      battlecryTriggerCount: battlecryTriggers,
    };
    return;
  }

  if (ability.kind === "destroyFriendlyAndCopy") {
    const candidates = player.board.filter(
      (minion) =>
        minion.instanceId !== source.instanceId &&
        minionHasTribe(minion, ability.targetTribe),
    );
    if (candidates.length === 0) {
      for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
        observeRecruitBattlecryTriggered(player);
      }
      return;
    }
    const copies =
      ability.copies *
      (source.golden && ability.goldenMode === "doubleCopies" ? 2 : 1);
    if (!player.isHuman) {
      const target = [...candidates].sort((left, right) => {
        const copyValue = (candidate: BoardMinionInstance) => {
          const definition = getMinionDefinition(candidate.definitionId);
          return (
            (definition.attack + definition.health) * copies +
            definition.tier * 2 -
            minionScore(player, candidate)
          );
        };
        const difference = copyValue(right) - copyValue(left);
        return difference !== 0
          ? difference
          : left.instanceId.localeCompare(right.instanceId);
      })[0];
      destroyRecruitMinion(state, player, target.instanceId, {
        beforeDeath: (destroyed) => {
          gainPlainMinionCopies(
            state,
            player,
            destroyed.definitionId,
            copies,
          );
        },
      });
      for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
        observeRecruitBattlecryTriggered(player);
      }
      return;
    }
    state.pendingInteraction = {
      kind: "target",
      interactionId: nextInteractionId(state),
      playerId: player.id,
      sourceInstanceId: source.instanceId,
      optionInstanceIds: candidates.map((minion) => minion.instanceId),
      attack: 0,
      health: 0,
      repetitions,
      resolution: {
        kind: "destroyFriendlyAndCopy",
        copies,
      },
      battlecry: true,
      battlecryTriggerCount: battlecryTriggers,
    };
    return;
  }

  if (ability.kind === "targetedDiscoverMagnetize") {
    const candidates = player.board.filter(
      (minion) =>
        minion.instanceId !== source.instanceId &&
        minionHasTribe(minion, ability.targetTribe),
    );
    if (candidates.length === 0) {
      for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
        observeRecruitBattlecryTriggered(player);
      }
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
        undefined,
        undefined,
        source.definitionId,
        "best",
        true,
        goldenRepetitions,
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
      battlecry: true,
      battlecryEffectRepetitionsPerTrigger: goldenRepetitions,
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
    for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
      observeRecruitBattlecryTriggered(player);
    }
    return;
  }
  const health =
    ability.health +
    ability.healthPerTavernSpell * player.tavernSpellsCastThisTurn +
    (ability.healthPerGoldSpentThisTurn ?? 0) *
      player.goldSpentThisTurn;
  const attack =
    ability.attack +
    ability.attackPerTavernSpell * player.tavernSpellsCastThisTurn +
    (ability.attackPerGoldSpentThisTurn ?? 0) *
      player.goldSpentThisTurn +
    (source.definitionId === LOVESICK_BALLADIST_DEFINITION_ID &&
    playerHasTrinketCardId(player, BALLADIST_PORTRAIT_CARD_ID)
      ? health
      : 0);
  if (!player.isHuman) {
    const target = bestMinionByScore(player, candidates);
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      buffMinions([target], attack, health, player.board, player);
    }
    for (let trigger = 0; trigger < battlecryTriggers; trigger += 1) {
      observeRecruitBattlecryTriggered(player);
    }
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
    battlecry: true,
    battlecryTriggerCount: battlecryTriggers,
  };
}

/**
 * Battlecries triggered by another effect cannot pause for player input. The
 * live game resolves their Discover and targeting choices randomly, while a
 * Golden component repeats only the portion its printed Golden text repeats.
 */
function resolveTriggeredRecruitInteractiveBattlecry(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  component: MinionEffectSource,
): void {
  const ability = getMinionDefinition(
    component.definitionId,
  ).interactiveBattlecry;
  if (!ability) {
    return;
  }
  const repetitions =
    component.golden && ability.goldenMode === "repeat" ? 2 : 1;

  if (ability.kind === "discoverTavernSpell") {
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      addRandomGeneratedTavernSpell(state, player);
    }
    return;
  }

  if (ability.kind === "discoverMinion") {
    if (
      ability.requiresOtherTribe &&
      !player.board.some(
        (candidate) =>
          candidate.instanceId !== source.instanceId &&
          minionHasTribe(candidate, ability.requiresOtherTribe),
      )
    ) {
      return;
    }
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      if (
        player.hand.length >= MAX_HAND_SIZE &&
        ability.allowHandOverflow !== true
      ) {
        continue;
      }
      const gained = drawMatchingFromPool(
        state,
        player.tavernTier,
        (definition) => definitionHasTribe(definition, ability.tribe),
      );
      if (!gained) {
        continue;
      }
      if (ability.damageHeroByDiscoveredTier) {
        damageRecruitPlayer(player, gained.tier);
      }
      addDrawnMinionToHand(state, player, gained);
    }
    return;
  }

  if (ability.kind === "makeFriendlyGolden") {
    const targetCount =
      ability.targets *
      (component.golden && ability.goldenMode === "doubleTargets" ? 2 : 1);
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
      const candidates = makeFriendlyGoldenCandidates(
        player,
        ability.maximumTier,
      );
      if (candidates.length === 0) {
        break;
      }
      makeRecruitMinionGolden(
        player,
        candidates[randomIndex(state, candidates.length)],
      );
    }
    return;
  }

  if (ability.kind === "destroyFriendlyAndCopy") {
    const candidates = player.board.filter(
      (candidate) =>
        candidate.instanceId !== source.instanceId &&
        minionHasTribe(candidate, ability.targetTribe),
    );
    if (candidates.length === 0) {
      return;
    }
    const target = candidates[randomIndex(state, candidates.length)];
    const copies =
      ability.copies *
      (component.golden && ability.goldenMode === "doubleCopies" ? 2 : 1);
    destroyRecruitMinion(state, player, target.instanceId, {
      beforeDeath: (destroyed) => {
        gainPlainMinionCopies(
          state,
          player,
          destroyed.definitionId,
          copies,
        );
      },
    });
    return;
  }

  if (ability.kind === "targetedDiscoverMagnetize") {
    const candidates = player.board.filter(
      (candidate) =>
        candidate.instanceId !== source.instanceId &&
        minionHasTribe(candidate, ability.targetTribe),
    );
    if (candidates.length === 0) {
      return;
    }
    const target = candidates[randomIndex(state, candidates.length)];
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const magnetic = drawMatchingFromPool(
        state,
        player.tavernTier,
        (definition) =>
          definitionHasTribe(definition, ability.discoverTribe) &&
          definition.magnetic !== undefined,
      );
      if (!magnetic) {
        continue;
      }
      fuseMinionIntoHost(state, player, magnetic, target);
      applyAfterMagnetizedEffects(state, player);
    }
    return;
  }

  const candidates =
    ability.target === "friendlyTribe"
      ? player.board.filter((candidate) =>
          minionHasTribe(candidate, ability.targetTribe),
        )
      : player.board.filter(
          (candidate) => candidate.instanceId !== source.instanceId,
        );
  if (candidates.length === 0) {
    return;
  }
  const target = candidates[randomIndex(state, candidates.length)];
  const health =
    ability.health +
    ability.healthPerTavernSpell * player.tavernSpellsCastThisTurn +
    (ability.healthPerGoldSpentThisTurn ?? 0) * player.goldSpentThisTurn;
  const attack =
    ability.attack +
    ability.attackPerTavernSpell * player.tavernSpellsCastThisTurn +
    (ability.attackPerGoldSpentThisTurn ?? 0) * player.goldSpentThisTurn +
    (component.definitionId === LOVESICK_BALLADIST_DEFINITION_ID &&
    playerHasTrinketCardId(player, BALLADIST_PORTRAIT_CARD_ID)
      ? health
      : 0);
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    buffMinions([target], attack, health, player.board, player);
  }
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
    const targetCandidates =
      pending.resolution?.kind === "castTaughtTavernSpell"
        ? [...player.board, ...player.shop]
        : player.board;
    const target = targetCandidates.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!target) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextTargetCandidates = nextPlayer
      ? pending.resolution?.kind === "castTaughtTavernSpell"
        ? [...nextPlayer.board, ...nextPlayer.shop]
        : nextPlayer.board
      : [];
    const nextTarget = nextTargetCandidates.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!nextPlayer || !nextTarget) {
      return state;
    }
    const targetResolution = pending.resolution;
    const completedBattlecryTriggers = pending.battlecry
      ? Math.max(
          0,
          pending.battlecryTriggerCount ?? pending.repetitions,
        )
      : 0;
    if (targetResolution?.kind === "castTaughtTavernSpell") {
      let definition: TavernSpellDefinition;
      try {
        definition = getTavernSpellDefinition(targetResolution.definitionId);
      } catch {
        return state;
      }
      next.pendingInteraction = null;
      for (
        let repetition = 0;
        repetition < pending.repetitions;
        repetition += 1
      ) {
        resolveTaughtTavernSpellBattlecryCast(
          next,
          nextPlayer,
          definition,
          nextTarget,
        );
      }
      for (
        let trigger = 0;
        trigger < completedBattlecryTriggers;
        trigger += 1
      ) {
        observeRecruitBattlecryTriggered(nextPlayer);
      }
      finishCardPlayed(next, nextPlayer);
      return next;
    }
    if (targetResolution?.kind === "makeGolden") {
      if (
        nextTarget.golden ||
        getMinionDefinition(nextTarget.definitionId).tier >
          targetResolution.maximumTier
      ) {
        return state;
      }
      makeRecruitMinionGolden(nextPlayer, nextTarget);
      const remainingTargets = pending.repetitions - 1;
      const remainingCandidates = makeFriendlyGoldenCandidates(
        nextPlayer,
        targetResolution.maximumTier,
      );
      if (remainingTargets > 0 && remainingCandidates.length > 0) {
        next.pendingInteraction = {
          ...pending,
          interactionId: nextInteractionId(next),
          optionInstanceIds: remainingCandidates.map(
            (candidate) => candidate.instanceId,
          ),
          repetitions: remainingTargets,
        };
        return next;
      }
      for (
        let trigger = 0;
        trigger < completedBattlecryTriggers;
        trigger += 1
      ) {
        observeRecruitBattlecryTriggered(nextPlayer);
      }
      next.pendingInteraction = null;
      finishCardPlayed(next, nextPlayer);
      return next;
    }
    if (targetResolution?.kind === "destroyFriendlyAndCopy") {
      if (
        !destroyRecruitMinion(
          next,
          nextPlayer,
          nextTarget.instanceId,
          {
            beforeDeath: (destroyed) => {
              gainPlainMinionCopies(
                next,
                nextPlayer,
                destroyed.definitionId,
                targetResolution.copies,
              );
            },
          },
        )
      ) {
        return state;
      }
      for (
        let trigger = 0;
        trigger < completedBattlecryTriggers;
        trigger += 1
      ) {
        observeRecruitBattlecryTriggered(nextPlayer);
      }
    } else {
      for (
        let repetition = 0;
        repetition < pending.repetitions;
        repetition += 1
      ) {
        buffMinions(
          [nextTarget],
          pending.attack,
          pending.health,
          nextPlayer.board,
          nextPlayer,
        );
      }
      for (
        let trigger = 0;
        trigger < completedBattlecryTriggers;
        trigger += 1
      ) {
        observeRecruitBattlecryTriggered(nextPlayer);
      }
      for (const keyword of pending.grantKeywords ?? []) {
        nextTarget[keyword] = true;
      }
    }
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
      undefined,
      undefined,
      undefined,
      "best",
      pending.battlecry === true,
      pending.battlecryEffectRepetitionsPerTrigger ?? 1,
    );
    if (!continued) {
      finishCardPlayed(next, nextPlayer);
    }
    return next;
  }

  if (pending.kind === "darkmoonPrizeDiscover") {
    const selected = pending.options.find(
      (option) => option.instanceId === action.optionInstanceId,
    );
    if (!selected) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    if (
      !nextPlayer ||
      nextPending?.kind !== "darkmoonPrizeDiscover"
    ) {
      return state;
    }
    const nextSelected = nextPending.options.find(
      (option) => option.instanceId === action.optionInstanceId,
    );
    if (!nextSelected) {
      return state;
    }
    if (nextPlayer.hand.length < MAX_HAND_SIZE) {
      addCardToHand(next, nextPlayer, nextSelected);
    }
    if (nextPending.completionSource === "generatedSpellCast") {
      triggerRecruitAfterSpellCast(next, nextPlayer);
    }
    next.pendingInteraction = null;
    const continued = beginDarkmoonPrizeDiscoverInteraction(
      next,
      nextPlayer,
      nextPending.sourceInstanceId,
      nextPending.remainingDiscoveries - 1,
      nextPending.completionSource,
    );
    if (
      !continued &&
      nextPending.completionSource === "generatedSpellCast"
    ) {
      finishCardPlayed(next, nextPlayer);
    }
    return next;
  }

  if (pending.kind === "tavernSpellDiscover") {
    const selected = pending.options.find(
      (option) => option.instanceId === action.optionInstanceId,
    );
    if (!selected) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    if (
      !nextPlayer ||
      nextPending?.kind !== "tavernSpellDiscover"
    ) {
      return state;
    }
    const nextSelected = nextPending.options.find(
      (option) => option.instanceId === action.optionInstanceId,
    );
    if (!nextSelected) {
      return state;
    }
    if (nextPlayer.hand.length < MAX_HAND_SIZE) {
      addCardToHand(next, nextPlayer, nextSelected);
    }
    if (
      nextPending.battlecry &&
      (nextPending.remainingDiscoveries - 1) %
        Math.max(
          1,
          nextPending.battlecryEffectRepetitionsPerTrigger ?? 1,
        ) ===
        0
    ) {
      observeRecruitBattlecryTriggered(nextPlayer);
    }
    next.pendingInteraction = null;
    const continued = beginTavernSpellDiscoverInteraction(
      next,
      nextPlayer,
      nextPending.sourceInstanceId,
      nextPending.remainingDiscoveries - 1,
      nextPending.maximumTier,
      nextPending.sourceDefinitionId,
      nextPending.battlecry === true,
      nextPending.battlecryEffectRepetitionsPerTrigger ?? 1,
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
        (2 + recruitTavernSpellBuffBonus(nextPlayer).attack) * 2;
      nextPlayer.nextTurnBoardHealthBonus +=
        (2 + recruitTavernSpellBuffBonus(nextPlayer).health) * 2;
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
      if (
        getHeroPowerDefinition(action.optionInstanceId)
          .identityEligible === false
      ) {
        return state;
      }
    } catch {
      return state;
    }
    assignHeroPower(
      next,
      nextPlayer,
      action.optionInstanceId,
      next.round,
    );
    next.pendingInteraction = null;
    if (nextPending.completionSource === "generatedSpellCast") {
      triggerRecruitAfterSpellCast(next, nextPlayer);
      const remainingChoices = Math.max(
        0,
        (nextPending.remainingChoices ?? 1) - 1,
      );
      const continued =
        remainingChoices > 0 &&
        beginHeroPowerChoice(
          next,
          nextPlayer,
          { instanceId: nextPending.sourceInstanceId },
          { id: nextPending.definitionId },
          "best",
          "generatedSpellCast",
          remainingChoices,
        );
      if (!continued) {
        for (
          let unresolved = 0;
          unresolved < remainingChoices;
          unresolved += 1
        ) {
          triggerRecruitAfterSpellCast(next, nextPlayer);
        }
        finishCardPlayed(next, nextPlayer);
      }
      return next;
    }
    finishTavernSpellCast(next, nextPlayer);
    return next;
  }

  if (pending.kind === "heroChoice") {
    if (!pending.optionIds.includes(action.optionInstanceId)) {
      return state;
    }
    let definition;
    try {
      definition = getHeroDefinition(action.optionInstanceId);
    } catch {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    if (
      !nextPlayer ||
      next.pendingInteraction?.kind !== "heroChoice"
    ) {
      return state;
    }
    assignHeroDefinition(next, nextPlayer, definition);
    next.pendingInteraction = null;
    return next;
  }

  if (pending.kind === "trinketChoice") {
    if (!pending.optionIds.includes(action.optionInstanceId)) {
      return state;
    }
    let definition;
    try {
      definition = getTrinketDefinition(action.optionInstanceId);
    } catch {
      return state;
    }
    if (definition.tier !== pending.trinketTier) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    if (
      !nextPlayer ||
      next.pendingInteraction?.kind !== "trinketChoice"
    ) {
      return state;
    }
    // Resolve the offer before applying the chosen effect. An acquisition
    // effect may open its own target or Discover interaction, which must not
    // be overwritten by cleanup of the Trinket picker.
    next.pendingInteraction = null;
    const applied = pending.replaceTrinketId
      ? isMysteryCubeTrinketSlotId(pending.replaceTrinketId)
        ? replaceMysteryCubeWithLesserTrinket(
            next,
            nextPlayer,
            pending.replaceTrinketId,
            definition,
          )
        : replaceTripVouchersWithGreaterTrinket(
            next,
            nextPlayer,
            pending.replaceTrinketId,
            definition,
          )
      : pending.additionalTrinketSourceId
        ? grantAdditionalLesserFromMysteriousOrb(
            next,
            nextPlayer,
            pending.additionalTrinketSourceId,
            definition,
          )
        : applyTrinketDefinition(next, nextPlayer, definition);
    if (!applied) {
      return state;
    }
    return next;
  }

  if (pending.kind === "minionChoice") {
    if (
      (pending.definitionId !== FEARLESS_FOODIE_DEFINITION_ID &&
        pending.definitionId !== BUDDING_BOTANIST_DEFINITION_ID &&
        pending.definitionId !== ADAPTABLE_BEETLE_DEFINITION_ID) ||
      !pending.optionIds.includes(
        action.optionInstanceId as MinionChoiceId,
      )
    ) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const source = nextPlayer?.board.find(
      (minion) =>
        minion.instanceId === pending.sourceInstanceId &&
        minion.definitionId === pending.definitionId,
    );
    if (
      !nextPlayer ||
      !source ||
      next.pendingInteraction?.kind !== "minionChoice"
    ) {
      return state;
    }
    const optionId = action.optionInstanceId as MinionChoiceId;
    if (pending.definitionId === ADAPTABLE_BEETLE_DEFINITION_ID) {
      if (
        !adaptableBeetleBranch(
          source,
          optionId,
          pending.effectMultiplier,
        )
      ) {
        return state;
      }
      next.pendingInteraction = null;
      const continued = beginAdaptableBeetleTarget(
        next,
        nextPlayer,
        source,
        optionId,
        pending.effectMultiplier,
      );
      if (!continued) {
        finishCardPlayed(next, nextPlayer);
      }
      return next;
    }
    const applied =
      pending.definitionId === FEARLESS_FOODIE_DEFINITION_ID
        ? applyBloodGemImproveOrGainChoice(
            next,
            nextPlayer,
            source,
            optionId,
            pending.effectMultiplier,
          )
        : applyTavernSpellBuffChoice(
            nextPlayer,
            source,
            optionId,
            pending.effectMultiplier,
          );
    if (!applied) {
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
    next.pendingInteraction = null;
    const castCompletions = pending.castCompletions;
    if (castCompletions === undefined) {
      const amount = 4 * (pending.effectMultiplier ?? 1);
      if (action.optionInstanceId === "escapeEruptionAttack") {
        buffMinions(
          nextPlayer.board,
          amount,
          0,
          nextPlayer.board,
          nextPlayer,
        );
      } else {
        buffMinions(
          nextPlayer.board,
          0,
          amount,
          nextPlayer.board,
          nextPlayer,
        );
      }
      triggerRecruitAfterSpellCast(next, nextPlayer);
    } else {
      const perCastMultiplier =
        (pending.effectMultiplier ?? castCompletions) / castCompletions;
      for (let cast = 0; cast < castCompletions; cast += 1) {
        const amount = 4 * perCastMultiplier;
        if (action.optionInstanceId === "escapeEruptionAttack") {
          buffMinions(
            nextPlayer.board,
            amount,
            0,
            nextPlayer.board,
            nextPlayer,
          );
        } else {
          buffMinions(
            nextPlayer.board,
            0,
            amount,
            nextPlayer.board,
            nextPlayer,
          );
        }
        triggerRecruitAfterSpellCast(next, nextPlayer);
        triggerAfterRecruitSpellcraftCast(next, nextPlayer);
      }
    }
    finishCardPlayed(next, nextPlayer);
    return next;
  }

  if (
    pending.kind === "discover" &&
    (pending.destination.kind === "customUndeadFirst" ||
      pending.destination.kind === "customUndeadSecond")
  ) {
    const selected = pending.options.find(
      (option) => option.instanceId === action.optionInstanceId,
    );
    const destination = pending.destination;
    if (
      !selected ||
      !playerOwnsPutricideTrinket(
        player,
        destination.sourceTrinketDefinitionId,
      ) ||
      !isPutricideComponentDefinitionId(player, selected.definitionId) ||
      (destination.kind === "customUndeadSecond" &&
        !isPutricideComponentDefinitionId(
          player,
          destination.firstComponentDefinitionId,
        ))
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
    returnDiscoverOptions(next, nextPending.options);
    next.pendingInteraction = null;
    if (destination.kind === "customUndeadFirst") {
      beginPutricideSecondComponentInteraction(
        next,
        nextPlayer,
        destination.sourceTrinketDefinitionId,
        nextSelected.definitionId,
      );
    } else {
      finishPutricideCustomUndeadCraft(
        next,
        nextPlayer,
        destination.firstComponentDefinitionId,
        nextSelected.definitionId,
      );
    }
    return next;
  }

  const selected = pending.options.find(
    (option) => option.instanceId === action.optionInstanceId,
  );
  if (
    !selected ||
    (pending.destination.kind === "hand" &&
      pending.destination.allowOverflow !== true &&
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
  const destination = nextPending.destination;
  const gainsSelected =
    destination.kind !== "hand" ||
    nextPlayer.hand.length < MAX_HAND_SIZE;
  returnDiscoverOptions(
    next,
    nextPending.options,
    gainsSelected ? nextSelected.instanceId : undefined,
  );
  prepareDiscoverSelection(
    nextPlayer,
    nextSelected,
    nextPending.selectionEffect,
  );
  if (destination.kind === "hand") {
    if (gainsSelected) {
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
        nextPlayer.tavernSpellsCast ?? 0,
        nextPlayer.deathrattlesTriggered ?? 0,
        nextPlayer.magnetizationsThisGame ?? 0,
      );
      addCardToHand(next, nextPlayer, nextSelected);
      resolveTriples(next, nextPlayer);
    }
  } else if (destination.kind === "magnetize") {
    const target = nextPlayer.board.find(
      (minion) =>
        minion.instanceId === destination.targetInstanceId,
    );
    if (!target) {
      returnMinionToPool(next, nextSelected);
      if (nextPending.battlecry) {
        const unresolvedTriggers = Math.ceil(
          nextPending.remainingDiscoveries /
            Math.max(
              1,
              nextPending.battlecryEffectRepetitionsPerTrigger ?? 1,
            ),
        );
        for (let trigger = 0; trigger < unresolvedTriggers; trigger += 1) {
          observeRecruitBattlecryTriggered(nextPlayer);
        }
      }
      next.pendingInteraction = null;
      finishCardPlayed(next, nextPlayer);
      return next;
    }
    fuseMinionIntoHost(next, nextPlayer, nextSelected, target);
    applyAfterMagnetizedEffects(next, nextPlayer);
  } else if (destination.kind === "transform") {
    if (
      !transformFriendlyMinionFromDiscover(
        next,
        nextPlayer,
        nextSelected,
        destination.targetInstanceId,
      )
    ) {
      returnMinionToPool(next, nextSelected);
      if (nextPending.battlecry) {
        const unresolvedTriggers = Math.ceil(
          nextPending.remainingDiscoveries /
            Math.max(
              1,
              nextPending.battlecryEffectRepetitionsPerTrigger ?? 1,
            ),
        );
        for (let trigger = 0; trigger < unresolvedTriggers; trigger += 1) {
          observeRecruitBattlecryTriggered(nextPlayer);
        }
      }
      next.pendingInteraction = null;
      triggerRecruitAfterSpellCast(next, nextPlayer);
      finishCardPlayed(next, nextPlayer);
      return next;
    }
    triggerRecruitAfterSpellCast(next, nextPlayer);
  } else {
    return state;
  }
  applyDiscoverSelectionAfterResolution(
    nextPlayer,
    nextSelected,
    nextPending.selectionEffect,
  );
  if (destination.kind !== "transform") {
    applyAfterDiscoverTrinkets(
      next,
      nextPlayer,
      nextSelected.definitionId,
    );
  }
  if (
    nextPending.battlecry &&
    (nextPending.remainingDiscoveries - 1) %
      Math.max(
        1,
        nextPending.battlecryEffectRepetitionsPerTrigger ?? 1,
      ) ===
      0
  ) {
    observeRecruitBattlecryTriggered(nextPlayer);
  }
  const deferredCastCompletions = nextPending.remainingCastCompletions;
  let remainingDeferredCastCompletions = deferredCastCompletions ?? 0;
  if (
    nextPending.completionSource === "tavernSpellCast" &&
    deferredCastCompletions !== undefined &&
    nextPending.remainingDiscoveries <= deferredCastCompletions
  ) {
    const pendingDefinitionId = nextPlayer.pendingTavernSpellDefinitionId;
    if (pendingDefinitionId) {
      recordRecruitTavernSpellCast(
        next,
        nextPlayer,
        pendingDefinitionId,
        nextPending.firstCastFromHandPending === true,
        true,
      );
    }
    remainingDeferredCastCompletions = Math.max(
      0,
      deferredCastCompletions - 1,
    );
  }
  if (
    nextPending.completionSource === "tripleRewardCast" ||
    nextPending.completionSource === "generatedSpellCast"
  ) {
    triggerRecruitAfterSpellCast(next, nextPlayer);
  }
  next.pendingInteraction = null;
  const remainingDiscoveries =
    destination.kind === "transform" && nextSelected.tier >= 6
      ? 0
      : nextPending.remainingDiscoveries - 1;
  const continuedFilter: DiscoverFilter =
    destination.kind === "transform"
      ? { exactTier: (nextSelected.tier + 1) as MinionTier }
      : nextPending.filter;
  const continued = beginDiscoverInteraction(
    next,
    nextPlayer,
    nextPending.sourceInstanceId,
    continuedFilter,
    remainingDiscoveries,
    destination,
    nextPending.completionSource,
    nextPending.selectionEffect,
    nextPending.sourceDefinitionId,
    "best",
    nextPending.battlecry === true,
    nextPending.battlecryEffectRepetitionsPerTrigger ?? 1,
  );
  const chainedInteraction = next.pendingInteraction as PendingInteraction | null;
  if (
    continued &&
    deferredCastCompletions !== undefined &&
    chainedInteraction?.kind === "discover"
  ) {
    chainedInteraction.remainingCastCompletions =
      remainingDeferredCastCompletions;
    chainedInteraction.firstCastFromHandPending = false;
  }
  if (
    !continued &&
    nextPending.completionSource === "tavernSpellCast"
  ) {
    if (deferredCastCompletions === undefined) {
      finishTavernSpellCast(next, nextPlayer);
    } else {
      const pendingDefinitionId = nextPlayer.pendingTavernSpellDefinitionId;
      if (pendingDefinitionId) {
        for (
          let cast = 0;
          cast < remainingDeferredCastCompletions;
          cast += 1
        ) {
          recordRecruitTavernSpellCast(
            next,
            nextPlayer,
            pendingDefinitionId,
            false,
            true,
          );
        }
      }
      nextPlayer.pendingTavernSpellDefinitionId = null;
      finishCardPlayed(next, nextPlayer);
    }
  } else if (
    !continued &&
    (nextPending.completionSource === "tripleRewardCast" ||
      nextPending.completionSource === "generatedSpellCast")
  ) {
    for (
      let unresolved = 1;
      unresolved < nextPending.remainingDiscoveries;
      unresolved += 1
    ) {
      triggerRecruitAfterSpellCast(next, nextPlayer);
    }
    finishCardPlayed(next, nextPlayer);
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
    gem.bonusKeyword === "tauntForQuilboar"
      ? player.board.filter(
          (minion) => minionHasTribe(minion, "quilboar") && !minion.taunt,
        )
      : gem.bonusKeyword === "rebornForQuilboar"
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
      const target =
        definition.effect === "jailerStickerLesser" ||
        definition.effect === "jailerStickerGreater"
          ? [...targets].sort(
              (left, right) =>
                minionScore(player, left) - minionScore(player, right) ||
                left.instanceId.localeCompare(right.instanceId),
            )[0]
          : bestMinionByScore(player, targets);
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
    player.pendingSpellcraft.length > 0 ||
    player.pendingSystemSpellIds.length > 0
  ) {
    flushPendingSpellcraft(state, player);
    flushPendingSystemSpells(state, player);
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
            minionScore(player, right.source, "magneticAttachment") -
            minionScore(player, left.source, "magneticAttachment");
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

function canAiPurchaseMinion(
  state: GameState,
  player: PlayerState,
  shopIndex: number,
): boolean {
  const quote = getMinionPurchaseQuote(state, player.id, shopIndex);
  if (!quote || player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  return quote.currency === "health"
    ? quote.cost === 0 || canAiSpendHealth(player, quote.cost)
    : quote.affordable;
}

function canAiPurchaseTavernSpell(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
): boolean {
  const quote = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spell.instanceId,
  );
  if (!quote || player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  return quote.currency === "health"
    ? quote.cost === 0 || canAiSpendHealth(player, quote.cost)
    : quote.affordable;
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
    case "goldenizer":
      return targetCount > 0 ? 18 : 0;
    case "goldenArrow":
      return targetCount > 0 ? 16 : 0;
    case "mirrorLens":
      return targetCount > 0 && player.hand.length < MAX_HAND_SIZE ? 12 : 0;
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

function bestPurchasableShopIndex(
  state: GameState,
  player: PlayerState,
): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < player.shop.length; index += 1) {
    if (!canAiPurchaseMinion(state, player, index)) {
      continue;
    }
    const score = minionScore(player, player.shop[index]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function bestMagneticShopIndex(
  state: GameState,
  player: PlayerState,
): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < player.shop.length; index += 1) {
    const offer = player.shop[index];
    if (
      !canAiPurchaseMinion(state, player, index) ||
      !player.board.some((target) => canMagnetize(offer, target))
    ) {
      continue;
    }
    const score = minionScore(player, offer, "magneticAttachment");
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

  const tideRaisers = player.board.filter((minion) =>
    minionEffectSources(minion).some(
      (component) =>
        component.definitionId === TIDE_RAISER_DEFINITION_ID,
    ),
  );
  for (const tideRaiser of tideRaisers) {
    if (opponentHasCleave) {
      break;
    }
    if (player.board.length < 3) {
      break;
    }
    const sourceIndex = player.board.findIndex(
      (minion) => minion.instanceId === tideRaiser.instanceId,
    );
    if (sourceIndex < 0) {
      continue;
    }
    const leadingMacawCount = player.board.findIndex(
      (minion) => !macaws.some((macaw) => macaw.instanceId === minion.instanceId),
    );
    const lockedDeathrattleTargetIndex =
      leadingMacawCount > 0 ? leadingMacawCount : -1;
    if (sourceIndex === lockedDeathrattleTargetIndex) {
      continue;
    }

    const [source] = player.board.splice(sourceIndex, 1);
    const minimumGap =
      lockedDeathrattleTargetIndex >= 0
        ? lockedDeathrattleTargetIndex + 1
        : 1;
    let bestGap = -1;
    let bestNagaCount = -1;
    let bestTargetValue = Number.NEGATIVE_INFINITY;
    let bestMovement = Number.POSITIVE_INFINITY;
    for (
      let gap = minimumGap;
      gap < player.board.length;
      gap += 1
    ) {
      const targets = [player.board[gap - 1], player.board[gap]];
      if (
        targets.some((target) => poetIds.has(target.instanceId))
      ) {
        continue;
      }
      const nagaCount = targets.filter((target) =>
        minionHasTribe(target, "naga"),
      ).length;
      const targetValue = targets.reduce(
        (total, target) => total + minionScore(player, target),
        0,
      );
      const movement = Math.abs(gap - sourceIndex);
      if (
        nagaCount > bestNagaCount ||
        (nagaCount === bestNagaCount &&
          (targetValue > bestTargetValue ||
            (targetValue === bestTargetValue && movement < bestMovement)))
      ) {
        bestGap = gap;
        bestNagaCount = nagaCount;
        bestTargetValue = targetValue;
        bestMovement = movement;
      }
    }
    if (bestGap < 0) {
      player.board.splice(
        Math.min(sourceIndex, player.board.length),
        0,
        source,
      );
      continue;
    }
    player.board.splice(bestGap, 0, source);
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
  const bestIndex = bestPurchasableShopIndex(state, player);
  const bestAffordableSpellScore =
    tavernSpellShopOffers(player)
      .filter((spell) => canAiPurchaseTavernSpell(state, player, spell))
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

function shouldUpgradeAiTavernWithResidual(
  state: GameState,
  player: PlayerState,
  checkpoint: "opening" | "loop",
  actionsTaken: number,
  refreshesTaken: number,
): boolean {
  const legacyShouldUpgrade = shouldUpgradeAiTavern(state, player);
  if (!hasAiResidualPolicyOverride(player.id)) {
    return legacyShouldUpgrade;
  }

  const profile = getAiStrategyProfile(player.id);
  const upgradeCost = getUpgradeCost(state, player.id);
  const canUpgrade =
    player.tavernTier < 6 && player.gold >= upgradeCost;
  const bestIndex = bestPurchasableShopIndex(state, player);
  const weakestIndex =
    player.board.length > 0 ? weakestBoardIndex(player) : -1;
  const bestAffordableSpellScore = tavernSpellShopOffers(player)
    .filter((spell) => canAiPurchaseTavernSpell(state, player, spell))
    .reduce(
      (best, spell) =>
        Math.max(best, tavernSpellAiScore(player, spell)),
      Number.NEGATIVE_INFINITY,
    );
  const choice = resolveAiResidualMacroChoice(player.id, {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "upgrade",
    contentVersion: CURRENT_ROSTER_VERSION,
    policyVersion: AI_POLICY_VERSION,
    profileId: profile.id,
    round: state.round,
    tavernTier: player.tavernTier,
    health: player.health,
    armor: player.armor,
    gold: player.gold,
    boardSize: player.board.length,
    handSize: player.hand.length,
    legacyChoice:
      legacyShouldUpgrade && canUpgrade
        ? "upgradeNow"
        : "deferUpgrade",
    legalChoices: canUpgrade
      ? ["upgradeNow", "deferUpgrade"]
      : ["deferUpgrade"],
    checkpoint,
    actionsTaken,
    refreshesTaken,
    upgradeCost,
    targetBoardSize: aiTargetBoardSize(state.round),
    bestShopScore:
      bestIndex >= 0
        ? minionScore(player, player.shop[bestIndex])
        : null,
    weakestBoardScore:
      weakestIndex >= 0
        ? minionScore(player, player.board[weakestIndex])
        : null,
    bestAffordableSpellScore: Number.isFinite(bestAffordableSpellScore)
      ? bestAffordableSpellScore
      : null,
  });
  return choice === "upgradeNow";
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
    "mirrorLens",
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
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
): boolean {
  const definition = getTavernSpellDefinition(spell.definitionId);
  if (AI_IMMEDIATE_MINION_SPELL_EFFECTS.has(definition.effect)) {
    return true;
  }
  const quote = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spell.instanceId,
  );
  const goldCost = quote?.currency === "health" ? 0 : (quote?.cost ?? 0);
  return (
    player.gold -
      goldCost +
      immediateAiSpellGoldGain(definition.effect) >=
    getMinionPurchaseCost(state, player.id)
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

function sellAiMaturePatientScouts(
  state: GameState,
  player: PlayerState,
): number {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return 0;
  }
  let sold = 0;
  for (let index = player.board.length - 1; index >= 0; index -= 1) {
    const minion = player.board[index];
    if (
      minion.definitionId !== PATIENT_SCOUT_DEFINITION_ID ||
      effectCounter(minion, PATIENT_SCOUT_TIER_COUNTER, 1) < 5
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
  actions += sellAiMaturePatientScouts(state, player);
  actions += sellAiLossBonusMinions(state, player);

  if (
    shouldUpgradeAiTavernWithResidual(
      state,
      player,
      "opening",
      actions,
      0,
    ) &&
    upgradeTavern(state, player)
  ) {
    upgradedThisTurn = true;
    actions += 1;
  }

  let refreshes = 0;
  while (actions < 50) {
    playAiHand(state, player);
    actions += sellAiMaturePatientScouts(state, player);
    actions += sellAiLossBonusMinions(state, player);
    if (actions >= 50) {
      break;
    }
    if (
      !upgradedThisTurn &&
      shouldUpgradeAiTavernWithResidual(
        state,
        player,
        "loop",
        actions,
        refreshes,
      ) &&
      upgradeTavern(state, player)
    ) {
      upgradedThisTurn = true;
      actions += 1;
      continue;
    }
    const shopIndex = bestPurchasableShopIndex(state, player);
    const bestMinionOffer =
      shopIndex >= 0 ? player.shop[shopIndex] : undefined;
    const minionPurchaseQuote =
      shopIndex >= 0
        ? getMinionPurchaseQuote(state, player.id, shopIndex)
        : null;
    const minionPurchaseCost =
      minionPurchaseQuote?.cost ??
      getMinionPurchaseCost(state, player.id);
    const bestMinionScore = bestMinionOffer
      ? minionScore(player, bestMinionOffer)
      : Number.NEGATIVE_INFINITY;
    const spellOffer = tavernSpellShopOffers(player)
      .filter((offer) => canAiPurchaseTavernSpell(state, player, offer))
      .sort((left, right) => {
        const scoreDifference =
          tavernSpellAiScore(player, right) -
          tavernSpellAiScore(player, left);
        return scoreDifference !== 0
          ? scoreDifference
          : left.instanceId.localeCompare(right.instanceId);
      })[0] ?? null;
    const spellPurchaseQuote = spellOffer
      ? getTavernSpellPurchaseQuote(
          state,
          player.id,
          spellOffer.instanceId,
        )
      : null;
    const spellCurrency = spellPurchaseQuote?.currency ?? "gold";
    const canAffordSpell =
      spellOffer !== null &&
      canAiPurchaseTavernSpell(state, player, spellOffer);
    const spellScore = spellOffer
      ? tavernSpellAiScore(player, spellOffer)
      : Number.NEGATIVE_INFINITY;
    const spellPurchaseCost = spellPurchaseQuote?.cost ?? 0;
    const spellEfficiency = spellOffer
      ? spellScore / Math.max(1, spellPurchaseCost)
      : Number.NEGATIVE_INFINITY;
    const minionEfficiency =
      bestMinionOffer && minionPurchaseQuote
        ? bestMinionScore / minionPurchaseCost
        : Number.NEGATIVE_INFINITY;
    const minionCompletesTriple =
      bestMinionOffer !== undefined &&
      tripleProgressForCandidate(player, bestMinionOffer) >= 2;
    const needsBoardMinion =
      bestMinionOffer !== undefined &&
      minionPurchaseQuote !== null &&
      player.board.length < aiTargetBoardSize(state.round);
    const spellPreservesTempo =
      spellOffer === null ||
      !needsBoardMinion ||
      aiSpellPreservesTempo(state, player, spellOffer);
    const preferSpell =
      spellPreservesTempo &&
      (spellCurrency === "health" ||
        bestMinionOffer === undefined ||
        minionPurchaseQuote === null ||
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
      minionPurchaseQuote !== null &&
      player.hand.length < MAX_HAND_SIZE
    ) {
      if (
        player.board.length >= MAX_BOARD_SIZE &&
        minionCompletesTriple &&
        buyMinion(state, player, shopIndex)
      ) {
        // Buying the third card resolves the triple atomically and frees its
        // occupied board slots. Do not sell a real warband minion first.
        actions += 1;
        continue;
      }
      if (player.board.length < MAX_BOARD_SIZE) {
        const weakestIndex =
          player.board.length > 0 ? weakestBoardIndex(player) : -1;
        const weakestScore =
          weakestIndex >= 0
            ? minionScore(player, player.board[weakestIndex])
            : Number.NEGATIVE_INFINITY;
        const ownedCopies = tripleProgressForCandidate(
          player,
          player.shop[shopIndex],
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
        const magneticShopIndex = bestMagneticShopIndex(state, player);
        if (
          magneticShopIndex >= 0 &&
          buyMinion(state, player, magneticShopIndex)
        ) {
          actions += 1;
          playAiHand(state, player);
          continue;
        }
        const weakestIndex = weakestBoardIndex(player);
        const certifiedOffer = player.shop[shopIndex];
        const candidateScore = minionScore(player, certifiedOffer);
        const weakestScore = minionScore(player, player.board[weakestIndex]);
        if (
          candidateScore >=
            weakestScore + profile.replacementMargin &&
          buyMinion(state, player, shopIndex)
        ) {
          // Secure the offer that passed the margin before selling anything.
          // Sell triggers can fill the hand or otherwise mutate recruit state;
          // playAiHand can now replace safely without a partial sell-and-buy.
          actions += 1;
          playAiHand(state, player);
          continue;
        }
      }
    }

    const refreshQuote = getTavernRefreshQuote(state, player.id);
    const refreshCost = refreshQuote?.cost ?? REFRESH_COST;
    const refreshGoldAfter =
      refreshQuote?.currency === "gold"
        ? player.gold - refreshCost
        : player.gold;
    const rewindsRecruitDamage = player.board.some(
      (minion) =>
        getMinionDefinition(minion.definitionId).afterHeroDamaged !==
        undefined,
    );
    const healthRefreshIsSafe =
      refreshQuote?.currency !== "health" ||
      refreshCost === 0 ||
      rewindsRecruitDamage ||
      player.health + player.armor - refreshCost >=
        profile.healthSpendFloor;
    const refreshLimit = aiRefreshLimit(
      profile,
      player.tavernTier,
      player.board.length,
      player.health + player.armor,
    );
    const canBuyAfterRefresh =
      player.hand.length < MAX_HAND_SIZE &&
      refreshQuote?.affordable === true &&
      healthRefreshIsSafe &&
      refreshGoldAfter >= minionPurchaseCost;
    const canSpeculativelyRefresh =
      player.hand.length < MAX_HAND_SIZE &&
      refreshes === 0 &&
      refreshQuote?.affordable === true &&
      healthRefreshIsSafe &&
      ((refreshCost === 0 && hasFreeRefresh(player)) ||
        (refreshQuote.currency === "gold" &&
          refreshCost === REFRESH_COST &&
          player.gold === REFRESH_COST &&
          player.board.length >= aiTargetBoardSize(state.round)));
    const legacyShouldRefresh =
      refreshes < refreshLimit &&
      (canBuyAfterRefresh || canSpeculativelyRefresh);
    let shouldRefresh = legacyShouldRefresh;
    if (
      refreshQuote !== null &&
      hasAiResidualPolicyOverride(player.id)
    ) {
      const refreshIsLegal =
        player.hand.length < MAX_HAND_SIZE &&
        refreshes < refreshLimit &&
        refreshQuote.affordable &&
        healthRefreshIsSafe;
      shouldRefresh =
        resolveAiResidualMacroChoice(player.id, {
          contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
          kind: "refresh",
          contentVersion: CURRENT_ROSTER_VERSION,
          policyVersion: AI_POLICY_VERSION,
          profileId: profile.id,
          round: state.round,
          tavernTier: player.tavernTier,
          health: player.health,
          armor: player.armor,
          gold: player.gold,
          boardSize: player.board.length,
          handSize: player.hand.length,
          legacyChoice: legacyShouldRefresh
            ? "refreshOnce"
            : "stopRefreshing",
          legalChoices: refreshIsLegal
            ? ["refreshOnce", "stopRefreshing"]
            : ["stopRefreshing"],
          refreshCurrency: refreshQuote.currency,
          refreshCost,
          affordable: refreshQuote.affordable,
          healthSpendSafe: healthRefreshIsSafe,
          freeRefreshSource:
            refreshCost === 0 &&
            player.heroRefreshAvailable &&
            playerHasHeroPower(player, "freeRefreshAtTurnStart")
              ? "hero"
              : refreshCost === 0 && player.freeRefreshes > 0
                ? "counter"
                : null,
          remainingHealthRefreshes:
            refreshQuote.remainingHealthRefreshes,
          rewindsRecruitDamage,
          refreshesThisTurn: refreshes,
          refreshLimit,
          actionsTaken: actions,
          actionLimit: 50,
          minionPurchaseCost,
          canBuyAfterRefresh,
          canSpeculativelyRefresh,
          goldAfterRefresh: Math.max(0, refreshGoldAfter),
          effectiveHealthAfterRefresh: Math.max(
            0,
            player.health +
              player.armor -
              (refreshQuote.currency === "health" ? refreshCost : 0),
          ),
          healthSpendFloor: profile.healthSpendFloor,
          targetBoardSize: aiTargetBoardSize(state.round),
        }) === "refreshOnce";
    }
    if (shouldRefresh) {
      refreshShop(state, player);
      refreshes += 1;
      actions += 1;
      continue;
    }
    break;
  }

  playAiHand(state, player);
  sellAiMaturePatientScouts(state, player);
  sellAiLossBonusMinions(state, player);
  const bestRemainingIndex = bestShopIndex(player);
  const bestRemaining =
    bestRemainingIndex >= 0
      ? player.shop[bestRemainingIndex]
      : undefined;
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
    (!canAiPurchaseMinion(state, player, bestRemainingIndex) ||
      player.hand.length >= MAX_HAND_SIZE) &&
    (tripleProgressForCandidate(player, bestRemaining) >=
      freezePairCount ||
      minionScore(player, bestRemaining) >=
        7 +
          player.tavernTier * 2 -
          profile.freezeScoreBonus);
  const freezeSpell =
    bestRemainingSpell !== undefined &&
    tavernSpellAiScore(player, bestRemainingSpell) >=
      8 - profile.freezeScoreBonus;
  const legacyShouldFreeze = freezeMinion || freezeSpell;
  let shouldFreeze = legacyShouldFreeze;
  if (hasAiResidualPolicyOverride(player.id)) {
    const bestRemainingTripleProgress = Math.min(
      2,
      bestRemaining === undefined
        ? 0
        : tripleProgressForCandidate(player, bestRemaining),
    ) as 0 | 1 | 2;
    const bestRemainingMinionScore =
      bestRemaining === undefined
        ? null
        : minionScore(player, bestRemaining);
    const bestRemainingSpellScore =
      bestRemainingSpell === undefined
        ? null
        : tavernSpellAiScore(player, bestRemainingSpell);
    const freezeMinionScoreThreshold =
      7 + player.tavernTier * 2 - profile.freezeScoreBonus;
    const freezeSpellScoreThreshold = 8 - profile.freezeScoreBonus;
    const remainingMinionPurchaseCost =
      bestRemainingIndex >= 0
        ? getMinionPurchaseCost(state, player.id, bestRemainingIndex)
        : getMinionPurchaseCost(state, player.id);
    shouldFreeze =
      resolveAiResidualMacroChoice(player.id, {
        contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
        kind: "freeze",
        contentVersion: CURRENT_ROSTER_VERSION,
        policyVersion: AI_POLICY_VERSION,
        profileId: profile.id,
        round: state.round,
        tavernTier: player.tavernTier,
        health: player.health,
        armor: player.armor,
        gold: player.gold,
        boardSize: player.board.length,
        handSize: player.hand.length,
        legacyChoice: legacyShouldFreeze ? "freeze" : "unfreeze",
        legalChoices: ["freeze", "unfreeze"],
        currentlyFrozen: player.frozen,
        bestMinionScore: bestRemainingMinionScore,
        bestSpellScore: bestRemainingSpellScore,
        bestTripleProgress: bestRemainingTripleProgress,
        remainingMinionPurchaseCost,
        handFull: player.hand.length >= MAX_HAND_SIZE,
        freezePairCount,
        minionScoreThreshold: freezeMinionScoreThreshold,
        spellScoreThreshold: freezeSpellScoreThreshold,
        freezeMinionReason: freezeMinion,
        freezeSpellReason: freezeSpell,
        unspentGold: player.gold,
      }) === "freeze";
  }
  player.frozen = shouldFreeze;
  reconcileConditionalMinions(player);
  arrangeAiBoard(player);
}

type DeferredBattleEventFactory = () => Array<Omit<BattleEvent, "index">>;

const DEFERRED_BATTLE_EVENTS = new WeakMap<
  BattleEvent[],
  DeferredBattleEventFactory[]
>();

function deferBattleEventsAfterCurrent(
  events: BattleEvent[],
  factory: DeferredBattleEventFactory,
): void {
  const queued = DEFERRED_BATTLE_EVENTS.get(events) ?? [];
  queued.push(factory);
  DEFERRED_BATTLE_EVENTS.set(events, queued);
}

function pushBattleEvent(
  events: BattleEvent[],
  event: Omit<BattleEvent, "index">,
): void {
  events.push({ ...event, index: events.length });
  const queued = DEFERRED_BATTLE_EVENTS.get(events);
  if (!queued || queued.length === 0) {
    return;
  }
  DEFERRED_BATTLE_EVENTS.delete(events);
  for (const factory of queued) {
    for (const deferredEvent of factory()) {
      events.push({ ...deferredEvent, index: events.length });
    }
  }
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
      dead.push({
        minion: board[index],
        index,
        ownerId,
        adjacentInstanceIds: [board[index - 1], board[index + 1]]
          .filter(
            (neighbor): neighbor is MinionInstance =>
              neighbor !== undefined && neighbor.health > 0,
          )
          .map((neighbor) => neighbor.instanceId),
      });
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
  attackGainHealth: number;
}

const COMBAT_TRINKET_CARD_IDS = {
  eternalPortrait: "BG30_MagicItem_301",
  automatonPortrait: "BG30_MagicItem_303",
  hoggyBank: "BG30_MagicItem_411",
  staffOfTheScourge: "BG30_MagicItem_437",
  deathlyPhylactery: "BG30_MagicItem_700",
  holyMallet: "BG30_MagicItem_902",
  rustyTrident: "BG30_MagicItem_917",
  balefulIncense: "BG32_MagicItem_360",
  ironforgeAnvil: "BG30_MagicItem_403",
  allPurposeKibble: "BG32_MagicItem_200",
  slammaSticker: "BG30_MagicItem_540",
  bronzeTimepiece: "BG30_MagicItem_995",
  faerieDragonScale: "BG32_MagicItem_363",
  reinforcedShield: "BG30_MagicItem_886",
  bassgillPortrait: "BG32_MagicItem_301",
  jarOfGems: "BG30_MagicItem_546",
  lesserQuilligraphySet: "BG30_MagicItem_410",
  greaterQuilligraphySet: "BG30_MagicItem_410t2",
  fridgeMagnet: "BG30_MagicItem_545",
  bleedingHeart: "BG30_MagicItem_713",
  gilneanThornedRose: "BG30_MagicItem_864",
  luckyTabby: "BG30_MagicItem_931",
  eyeOfDalaran: "BG30_MagicItem_981",
  lesserBeetleBand: "BG32_MagicItem_860",
  greaterBeetleBand: "BG32_MagicItem_860t",
  stormcoilSticker: "BG35_MagicItem_302",
  bewitchedRibbon: BEWITCHED_RIBBON_CARD_ID,
  mamaBearSticker: MAMA_BEAR_STICKER_CARD_ID,
  rivendarePortrait: RIVENDARE_PORTRAIT_CARD_ID,
  wickedTome: WICKED_TOME_CARD_ID,
  protectiveRing: PROTECTIVE_RING_CARD_ID,
  dramalocSticker: DRAMALOC_STICKER_CARD_ID,
  wildfeatherDuster: WILDFEATHER_DUSTER_CARD_ID,
  bloodAmulet: BLOOD_AMULET_CARD_ID,
  scrapsmithPortrait: SCRAPSMITH_PORTRAIT_CARD_ID,
  trustyCrowbar: TRUSTY_CROWBAR_CARD_ID,
  heraldSticker: HERALD_STICKER_CARD_ID,
  fangAnklet: FANG_ANKLET_CARD_ID,
  deathtouchApple: DEATHTOUCH_APPLE_CARD_ID,
  rylakPortrait: RYLAK_PORTRAIT_CARD_ID,
  flyingGolemPortrait: "BG35_MagicItem_740",
  bloodGolemSticker: "BG30_MagicItem_442",
  powderKeg: "BG35_MagicItem_714",
  soulFermenter: "BG35_MagicItem_732",
} as const;

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
  /** Combat-local snapshot of persistent Elemental stat-grant improvements. */
  elementalGrantBonuses: Record<PlayerId, CombatStatBuff>;
  pendingBeetles: Record<PlayerId, number>;
  pendingStartOfCombatHandSummons: Record<
    PlayerId,
    PendingStartOfCombatHandSummon[]
  >;
  /** A physical hand card may be pulled onto the board only once this combat. */
  startOfCombatSummonedHandInstanceIds: Record<
    PlayerId,
    Set<string>
  >;
  /** Prevent a nested immediate attack from outrunning its outer death wave. */
  deathResolutionDepth: number;
  astralAutomatonsSummoned: Record<PlayerId, number>;
  eternalKnightsDied: Record<PlayerId, number>;
  tavernSpellsCast: Record<PlayerId, number>;
  deathrattlesTriggered: Record<PlayerId, number>;
  magnetizationsThisGame: Record<PlayerId, number>;
  /** Combat-only counters keyed by the exact minion or Magnetic component. */
  avengeProgress: Record<PlayerId, Record<string, number>>;
  /** Per-combat self-damage trigger counts keyed by the exact component. */
  limitedSelfDamageTriggers: Record<PlayerId, Record<string, number>>;
  /** Per-combat summon-observer trigger counts keyed by the exact component. */
  limitedFriendlySummonTriggers: Record<
    PlayerId,
    Record<string, number>
  >;
  /** Per-combat Trinket progress; persistent growth is mirrored separately. */
  trinketCombatCounters: Record<PlayerId, Record<string, number>>;
  /** Minions granted Hoggy Bank's temporary Deathrattle this combat. */
  hoggyBankDeathrattles: Record<PlayerId, Set<string>>;
  /** Minions granted Rusty Trident's temporary Deathrattle this combat. */
  rustyTridentDeathrattles: Record<PlayerId, Set<string>>;
  /** Minions granted Falling Flying Golem Portrait's temporary Deathrattle. */
  flyingGolemDeathrattles: Record<PlayerId, Set<string>>;
  /** Pirates granted Powder Keg's temporary Sky Pirate Deathrattle. */
  powderKegDeathrattles: Record<PlayerId, Set<string>>;
  /** Exact combat copies destroyed by Soul Fermenter and waiting to return. */
  soulFermenterDestroyed: Record<PlayerId, BoardMinionInstance[]>;
  /** Prevents the stored Soul Fermenter band from returning more than once. */
  soulFermenterArmed: Record<PlayerId, boolean>;
  /** Exact combat snapshots stored by each Stitched Salvager component. */
  stitchedSalvagerDestroyed: Record<
    PlayerId,
    Record<string, BoardMinionInstance[]>
  >;
  /** Poisonous/Venomous damage remains lethal even if later triggers grant Health. */
  poisonLethalMinionIds: Record<PlayerId, Set<string>>;
  /** The final damage source is retained until that exact lethal wave resolves. */
  lethalDamageSources: Record<
    PlayerId,
    Record<string, { ownerId: PlayerId; instanceId: string }>
  >;
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

function combatTrinketByCardId(
  context: CombatContext,
  ownerId: PlayerId,
  cardId: string,
): TrinketDefinition | undefined {
  const owner = findPlayer(context.state, ownerId);
  return owner
    ? playerTrinkets(owner).find((trinket) => trinket.cardId === cardId)
    : undefined;
}

function trinketCombatCounter(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  counter: string,
): number {
  return (
    context.trinketCombatCounters[ownerId][
      `${trinket.id}:${counter}`
    ] ?? 0
  );
}

function setTrinketCombatCounter(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  counter: string,
  value: number,
): void {
  context.trinketCombatCounters[ownerId][
    `${trinket.id}:${counter}`
  ] = value;
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

function retainCombatAttackGain(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  attack: number,
): CombatRetentionMultiplier {
  const retentionMultiplier = combatRetentionMultiplier(
    context,
    ownerId,
    target,
  );
  if (retentionMultiplier === 0 || attack <= 0) {
    return 0;
  }
  const ledger = context.retainedCombatEnchantments[ownerId];
  const retained = (ledger[target.instanceId] ??= {
    attack: 0,
    health: 0,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    keywords: new Set(),
  });
  retained.attack += attack * retentionMultiplier;
  return retentionMultiplier;
}

interface CombatFriendlyHealthGainTrigger {
  watcherInstanceId: string;
  component: MinionEffectSource;
  attackPerHealth: number;
  goldenMode?: "doubleStats";
}

function captureCombatFriendlyHealthGainTriggers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  healthGain: number,
): CombatFriendlyHealthGainTrigger[] {
  if (
    healthGain <= 0 ||
    target.health <= 0 ||
    !minionHasTribe(target, "naga")
  ) {
    return [];
  }
  return context.boards[ownerId].flatMap((watcher) =>
    minionEffectSources(watcher).flatMap((component) => {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyGainsHealth;
      if (
        !trigger ||
        !minionHasTribe(target, trigger.tribe) ||
        (trigger.otherOnly && watcher.instanceId === target.instanceId)
      ) {
        return [];
      }
      return [
        {
          watcherInstanceId: watcher.instanceId,
          component,
          attackPerHealth: trigger.attackPerHealth,
          goldenMode: trigger.goldenMode,
        },
      ];
    }),
  );
}

function resolveCombatFriendlyHealthGainTriggers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  healthGain: number,
  triggers: readonly CombatFriendlyHealthGainTrigger[],
): Array<Omit<BattleEvent, "index">> {
  if (triggers.length === 0) {
    return [];
  }
  const liveTarget = context.boards[ownerId].find(
    (candidate) =>
      candidate.instanceId === target.instanceId && candidate.health > 0,
  );
  if (!liveTarget || !minionHasTribe(liveTarget, "naga")) {
    return [];
  }
  const events: Array<Omit<BattleEvent, "index">> = [];
  for (const queued of triggers) {
    const watcher = context.boards[ownerId].find(
      (candidate) =>
        candidate.instanceId === queued.watcherInstanceId &&
        candidate.health > 0,
    );
    if (!watcher) {
      continue;
    }
    const scale =
      queued.component.golden && queued.goldenMode === "doubleStats"
        ? 2
        : 1;
    const attackDelta = healthGain * queued.attackPerHealth * scale;
    liveTarget.attack += attackDelta;
    reconcileConditionalMinion(liveTarget);
    const retentionMultiplier = retainCombatAttackGain(
      context,
      ownerId,
      liveTarget,
      attackDelta,
    );
    events.push({
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: watcher.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: liveTarget.instanceId,
      attackDelta,
      healthDelta: 0,
      minion: cloneMinion(liveTarget),
      retained: retentionMultiplier > 0,
      ...(retentionMultiplier > 0 ? { retentionMultiplier } : {}),
      message: `${rallySourceLabel(queued.component)}看到${liveTarget.name}获得${healthGain}点生命值，使其获得+${attackDelta}攻击力。`,
    });
  }
  return events;
}

function deferCombatFriendlyHealthGainTriggers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  healthGain: number,
): void {
  const triggers = captureCombatFriendlyHealthGainTriggers(
    context,
    ownerId,
    target,
    healthGain,
  );
  if (triggers.length === 0) {
    return;
  }
  deferBattleEventsAfterCurrent(context.events, () =>
    resolveCombatFriendlyHealthGainTriggers(
      context,
      ownerId,
      target,
      healthGain,
      triggers,
    ),
  );
}

interface CombatFriendlyAttackGainTrigger {
  watcherInstanceId: string;
  component: MinionEffectSource;
  health: number;
  goldenMode?: "doubleStats";
}

function captureCombatFriendlyAttackGainTriggers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  attackGain: number,
): CombatFriendlyAttackGainTrigger[] {
  if (
    attackGain <= 0 ||
    target.health <= 0 ||
    !minionHasTribe(target, "pirate")
  ) {
    return [];
  }
  return context.boards[ownerId].flatMap((watcher) =>
    minionEffectSources(watcher).flatMap((component) => {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyGainsAttack;
      if (
        !trigger ||
        !minionHasTribe(target, trigger.tribe) ||
        (trigger.otherOnly && watcher.instanceId === target.instanceId)
      ) {
        return [];
      }
      return [
        {
          watcherInstanceId: watcher.instanceId,
          component,
          health: trigger.health,
          goldenMode: trigger.goldenMode,
        },
      ];
    }),
  );
}

function resolveCombatFriendlyAttackGainTriggers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  attackGain: number,
  triggers: readonly CombatFriendlyAttackGainTrigger[],
): Array<Omit<BattleEvent, "index">> {
  if (triggers.length === 0) {
    return [];
  }
  const liveTarget = context.boards[ownerId].find(
    (candidate) =>
      candidate.instanceId === target.instanceId && candidate.health > 0,
  );
  if (!liveTarget || !minionHasTribe(liveTarget, "pirate")) {
    return [];
  }
  const events: Array<Omit<BattleEvent, "index">> = [];
  for (const queued of triggers) {
    const watcher = context.boards[ownerId].find(
      (candidate) =>
        candidate.instanceId === queued.watcherInstanceId &&
        candidate.health > 0,
    );
    if (!watcher || watcher.instanceId === liveTarget.instanceId) {
      continue;
    }
    const scale =
      queued.component.golden && queued.goldenMode === "doubleStats" ? 2 : 1;
    const healthDelta = queued.health * scale;
    const healthTriggers = captureCombatFriendlyHealthGainTriggers(
      context,
      ownerId,
      watcher,
      healthDelta,
    );
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      watcher,
      { health: healthDelta },
      false,
    );
    events.push({
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: watcher.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: watcher.instanceId,
      healthDelta,
      attackDelta: 0,
      actorMinion: cloneMinion(watcher),
      minion: cloneMinion(watcher),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `${rallySourceLabel(queued.component)}看到${liveTarget.name}获得${attackGain}点攻击力，获得+${healthDelta}生命值。`,
    });
    events.push(
      ...resolveCombatFriendlyHealthGainTriggers(
        context,
        ownerId,
        watcher,
        healthDelta,
        healthTriggers,
      ),
    );
  }
  return events;
}

function deferCombatFriendlyAttackGainTriggers(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  attackGain: number,
): void {
  const triggers = captureCombatFriendlyAttackGainTriggers(
    context,
    ownerId,
    target,
    attackGain,
  );
  if (triggers.length === 0) {
    return;
  }
  deferBattleEventsAfterCurrent(context.events, () =>
    resolveCombatFriendlyAttackGainTriggers(
      context,
      ownerId,
      target,
      attackGain,
      triggers,
    ),
  );
}

function applyCombatEnchantingGain(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
  gain: CombatEnchantingGain,
  deferFriendlyHealthGain = true,
): CombatEnchantingGainResult {
  const attack = gain.attack ?? 0;
  const health = gain.health ?? 0;
  const attackGainHealth = healthGainedFromExternalAttack(target, attack);
  const totalHealth = health + attackGainHealth;
  const retentionMultiplier = combatRetentionMultiplier(
    context,
    ownerId,
    target,
  );
  if (totalHealth !== 0) {
    adjustCombatMaximumHealth(context, ownerId, target, totalHealth);
  }
  target.attack = Math.max(0, target.attack + attack);
  target.health = context.poisonLethalMinionIds[ownerId].has(
    target.instanceId,
  )
    ? Math.min(0, target.health + totalHealth)
    : Math.max(1, target.health + totalHealth);
  deferCombatFriendlyAttackGainTriggers(
    context,
    ownerId,
    target,
    Math.max(0, attack),
  );
  if (deferFriendlyHealthGain) {
    deferCombatFriendlyHealthGainTriggers(
      context,
      ownerId,
      target,
      Math.max(0, totalHealth),
    );
  }
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
    return { gainedKeywords, retentionMultiplier: 0, attackGainHealth };
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
  return { gainedKeywords, retentionMultiplier, attackGainHealth };
}

function applyCombatCardAddedBuff(
  context: CombatContext,
  ownerId: PlayerId,
  watcher: BoardMinionInstance,
  component: MinionEffectSource,
  target: BoardMinionInstance,
  attack: number,
  health: number,
  triggerLabel: string,
): void {
  const result = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    { attack, health },
  );
  const definition = getMinionDefinition(component.definitionId);
  const sourceLabel = component.golden
    ? `金色·${definition.name}`
    : definition.name;
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: watcher.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: attack,
    healthDelta: health + result.attackGainHealth,
    minion: cloneMinion(target),
    retained: result.retentionMultiplier > 0,
    ...(result.retentionMultiplier > 0
      ? { retentionMultiplier: result.retentionMultiplier }
      : {}),
    message: `${sourceLabel}${triggerLabel}，使${target.name}获得+${attack}/+${health}。`,
  });
}

function observeCombatCardAddedToHand(
  context: CombatContext,
  ownerId: PlayerId,
  card: HandCardInstance,
): void {
  const board = context.boards[ownerId];
  for (const watcher of [...board]) {
    if (watcher.kind !== "minion" || watcher.health <= 0) {
      continue;
    }
    const boardWatcher = watcher as BoardMinionInstance;
    for (const component of minionEffectSources(boardWatcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterCardAddedToHand;
      if (
        !trigger ||
        !board.some(
          (candidate) =>
            candidate.instanceId === boardWatcher.instanceId &&
            candidate.health > 0,
        )
      ) {
        continue;
      }
      if (trigger.kind === "buffRandomOtherPirate") {
        const repetitions =
          component.golden && trigger.goldenMode === "repeat" ? 2 : 1;
        for (let repetition = 0; repetition < repetitions; repetition += 1) {
          const candidates = board.filter(
            (candidate): candidate is BoardMinionInstance =>
              candidate.kind === "minion" &&
              candidate.health > 0 &&
              candidate.instanceId !== boardWatcher.instanceId &&
              minionHasTribe(candidate, "pirate"),
          );
          if (candidates.length === 0) {
            break;
          }
          const target =
            candidates[randomIndex(context.state, candidates.length)];
          applyCombatCardAddedBuff(
            context,
            ownerId,
            boardWatcher,
            component,
            target,
            trigger.attack,
            trigger.health,
            "在有卡牌加入手牌后触发",
          );
        }
        continue;
      }
      if (
        card.kind !== "minion" ||
        !minionHasTribe(card, trigger.tribe)
      ) {
        continue;
      }
      const sourceScale =
        component.golden && trigger.goldenMode === "doubleStats" ? 2 : 1;
      for (const target of board) {
        if (target.kind !== "minion" || target.health <= 0) {
          continue;
        }
        const boardTarget = target as BoardMinionInstance;
        applyCombatCardAddedBuff(
          context,
          ownerId,
          boardWatcher,
          component,
          boardTarget,
          (boardTarget.golden
            ? trigger.goldenTargetAttack
            : trigger.attack) * sourceScale,
          (boardTarget.golden
            ? trigger.goldenTargetHealth
            : trigger.health) * sourceScale,
          "在获取海盗牌后触发",
        );
      }
    }
  }
  const crowbar = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.trustyCrowbar,
  );
  const leftmost = board.find((minion) => minion.health > 0);
  if (
    crowbar &&
    leftmost &&
    card.kind === "minion" &&
    minionHasTribe(card, "pirate")
  ) {
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      leftmost,
      { attack: 12, health: 12 },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: crowbar.id,
      targetPlayerId: ownerId,
      targetInstanceId: leftmost.instanceId,
      attackDelta: 12,
      healthDelta: 12 + gain.attackGainHealth,
      minion: cloneMinion(leftmost),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `${crowbar.name}在你获取海盗牌后使最左边的${leftmost.name}获得+12/+12。`,
    });
  }
}

interface ExplicitPermanentCombatGainResult {
  persisted: boolean;
  attackGainHealth: number;
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
  const attackGainHealth = healthGainedFromExternalAttack(
    target,
    gain.attack,
  );
  const combatHealthGain = gain.health + attackGainHealth;
  if (combatHealthGain !== 0) {
    adjustCombatMaximumHealth(
      context,
      ownerId,
      target,
      combatHealthGain,
    );
  }
  target.attack = Math.max(0, target.attack + gain.attack);
  // Keep exact non-positive Health so a small gain cannot revive overkill.
  target.health += combatHealthGain;
  if (
    context.poisonLethalMinionIds[ownerId].has(target.instanceId)
  ) {
    target.health = Math.min(0, target.health);
  }
  reconcileConditionalMinion(target);
  deferCombatFriendlyAttackGainTriggers(
    context,
    ownerId,
    target,
    Math.max(0, gain.attack),
  );
  deferCombatFriendlyHealthGainTriggers(
    context,
    ownerId,
    target,
    Math.max(0, combatHealthGain),
  );

  if (!context.originalCombatMinionIds[ownerId].has(target.instanceId)) {
    return { persisted: false, attackGainHealth };
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
    return { persisted: false, attackGainHealth };
  }
  persistent.attack = Math.max(0, persistent.attack + gain.attack);
  persistent.health += gain.health;
  reconcileConditionalMinion(persistent);
  refreshDynamicMinionDescription(persistent, owner);
  return { persisted: true, attackGainHealth };
}

/**
 * Resolves the replacement trigger for an actual combat summon attempt that
 * cannot enter because all seven warband slots are occupied. Each live copy
 * triggers independently, and printed permanent gains write back only to real
 * player-owned combat entities (never to tokens or ghost boards).
 */
function rejectCombatSummonForFullBoard(
  context: CombatContext,
  ownerId: PlayerId,
): boolean {
  const board = context.boards[ownerId];
  if (board.length < MAX_BOARD_SIZE) {
    return false;
  }
  const watchers = [...board];
  for (const watcher of watchers) {
    if (
      watcher.health <= 0 ||
      !board.some(
        (candidate) => candidate.instanceId === watcher.instanceId,
      )
    ) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const effect = getMinionDefinition(
        component.definitionId,
      ).onFriendlySummonOverflow;
      if (!effect) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      const attack = effect.attack * scale;
      const health = effect.health * scale;
      const sourceLabel = rallySourceLabel(component);
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: watcher.instanceId,
        targetPlayerId: ownerId,
        actorMinion: cloneMinion(watcher),
        message: `${sourceLabel}发现战队已满，使你的随从永久获得+${attack}/+${health}。`,
      });
      for (const target of board.filter((candidate) => candidate.health > 0)) {
        const gain = applyExplicitPermanentCombatStatGain(
          context,
          ownerId,
          target,
          { attack, health },
        );
        pushBattleEvent(context.events, {
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: target.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta: attack,
          healthDelta: health + gain.attackGainHealth,
          minion: cloneMinion(target),
          retained: gain.persisted,
          ...(gain.persisted ? { retentionMultiplier: 1 } : {}),
          message: `${sourceLabel}使${target.name}永久获得+${attack}/+${health}。`,
        });
      }
    }
  }
  return true;
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
  const targetedSpellTrigger = applyTargetedSpellCastTrigger(target);
  const applicationCount = options.applicationCount ?? 1;
  const applicationIndex = options.applicationIndex ?? 0;
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: options.actorInstanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: owner.bloodGemAttack,
    healthDelta: owner.bloodGemHealth + gain.attackGainHealth,
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
  pushCombatTargetedSpellCastTriggerEvent(
    context,
    ownerId,
    options.actorInstanceId,
    target,
    targetedSpellTrigger,
  );
  if (options.triggerObservers !== false) {
    triggerCombatBloodGemObservers(context, ownerId, target);
  }
}

function applyPermanentCombatBloodGemFromTrinket(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  target: MinionInstance,
): void {
  const owner = findPlayer(context.state, ownerId);
  if (!owner || target.kind !== "minion" || target.health <= 0) {
    return;
  }
  const attack = owner.bloodGemAttack;
  const health = owner.bloodGemHealth;
  const gain = applyExplicitPermanentCombatStatGain(
    context,
    ownerId,
    target,
    { attack, health },
  );
  target.bloodGemAttack += attack;
  target.bloodGemHealth += health;
  if (gain.persisted) {
    const persistentOwner = persistentCombatOwner(context, ownerId);
    const persistent = persistentOwner
      ? findCombatWritebackMinion(
          context,
          persistentOwner,
          ownerId,
          target.instanceId,
        )
      : undefined;
    if (persistent) {
      persistent.bloodGemAttack += attack;
      persistent.bloodGemHealth += health;
    }
  }
  const targetedSpellTrigger = applyTargetedSpellCastTrigger(target);
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: attack,
    healthDelta: health + gain.attackGainHealth,
    minion: cloneMinion(target),
    retained: gain.persisted,
    ...(gain.persisted ? { retentionMultiplier: 1 } : {}),
    message: `${trinket.name}对${target.name}永久使用了一张鲜血宝石，使其获得+${attack}/+${health}。`,
  });
  pushCombatTargetedSpellCastTriggerEvent(
    context,
    ownerId,
    trinket.id,
    target,
    targetedSpellTrigger,
  );
  triggerCombatBloodGemObservers(context, ownerId, target);
}

function applyFangAnkletAtStartOfCombat(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.fangAnklet,
  );
  if (!trinket) {
    return;
  }
  const owner = findPlayer(context.state, ownerId);
  const amount =
    1 +
    Math.max(
      0,
      Math.floor(owner?.trinketCounters[trinket.id] ?? 0),
    );
  const current = context.tribeBuffs[ownerId].beast ?? {
    attack: 0,
    health: 0,
  };
  context.tribeBuffs[ownerId].beast = {
    attack: current.attack + amount,
    health: current.health + amount,
  };
  pushBattleEvent(context.events, {
    type: "startOfCombat",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    attackDelta: amount,
    healthDelta: amount,
    message: `${trinket.name}使你的野兽在本场战斗中获得+${amount}/+${amount}。`,
  });
  for (const target of context.boards[ownerId].filter(
    (minion) => minion.health > 0 && minionHasTribe(minion, "beast"),
  )) {
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      target,
      { attack: amount, health: amount },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta: amount,
      healthDelta: amount + gain.attackGainHealth,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `${trinket.name}使${target.name}获得+${amount}/+${amount}。`,
    });
  }
}

function triggerHeraldStickerAtStartOfCombat(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.heraldSticker,
  );
  if (!trinket) {
    return;
  }
  const board = context.boards[ownerId];
  const candidates = [...board].filter(
    (minion) =>
      minionHasDeathrattle(minion) ||
      hasTrinketGrantedDeathrattle(context, ownerId, minion),
  );
  if (candidates.length === 0) {
    return;
  }
  pushBattleEvent(context.events, {
    type: "startOfCombat",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    message: `${trinket.name}触发所有友方亡语。`,
  });
  for (const [originalIndex, source] of candidates.entries()) {
    const currentIndex = board.findIndex(
      (minion) => minion.instanceId === source.instanceId,
    );
    const index = currentIndex >= 0 ? currentIndex : originalIndex;
    const adjacentInstanceIds = [board[index - 1], board[index + 1]]
      .filter(
        (minion): minion is MinionInstance =>
          minion !== undefined && minion.health > 0,
      )
      .map((minion) => minion.instanceId);
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: source.instanceId,
      minion: cloneMinion(source),
      message: `${trinket.name}触发了${source.name}的亡语。`,
    });
    resolveOneDeathrattle(context, {
      minion: source,
      index,
      ownerId,
      adjacentInstanceIds,
    });
  }
  resolveCombatDeaths(context);
}

/**
 * Trinket trigger semantics are cross-checked against the MIT Firestone battle
 * simulator's corresponding CardID handlers, then expressed through this
 * engine's native combat state and structured events.
 */
function applyStartOfCombatTrinkets(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const board = context.boards[ownerId];

  const soulFermenter = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.soulFermenter,
  );
  if (soulFermenter) {
    const destroyed = board.slice(0, 3);
    if (destroyed.length > 0) {
      context.soulFermenterDestroyed[ownerId] = destroyed.map(cloneMinion);
      context.soulFermenterArmed[ownerId] = true;
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: soulFermenter.id,
        targetPlayerId: ownerId,
        message: `${soulFermenter.name}消灭了最左边的${destroyed.length}个友方随从。`,
      });
      for (const target of destroyed) {
        target.health = 0;
      }
      resolveCombatDeaths(context);
    }
  }

  const eternalPortrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.eternalPortrait,
  );
  if (eternalPortrait) {
    const knights = board.filter(
      (minion) =>
        minion.health > 0 &&
        minion.definitionId === "BG25_008" &&
        (!minion.taunt || !minion.reborn),
    );
    if (knights.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: eternalPortrait.id,
        targetPlayerId: ownerId,
        message: `${eternalPortrait.name}触发。`,
      });
    }
    for (const knight of knights) {
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        knight,
        { keywords: ["taunt", "reborn"] },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: eternalPortrait.id,
        targetPlayerId: ownerId,
        targetInstanceId: knight.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(knight),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${eternalPortrait.name}使${knight.name}获得嘲讽和复生。`,
      });
    }
  }

  const automatonPortrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.automatonPortrait,
  );
  if (automatonPortrait) {
    setTrinketCombatCounter(
      context,
      ownerId,
      automatonPortrait,
      "armed",
      1,
    );
    pushBattleEvent(context.events, {
      type: "startOfCombat",
      actorPlayerId: ownerId,
      actorInstanceId: automatonPortrait.id,
      targetPlayerId: ownerId,
      message: `${automatonPortrait.name}已准备在出现空位时召唤星元自动机。`,
    });
    summonAutomatonPortraitWhenSpace(context, ownerId);
  }

  const hoggyBank = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.hoggyBank,
  );
  if (hoggyBank) {
    const quilboars = board.filter(
      (minion) => minion.health > 0 && minionHasTribe(minion, "quilboar"),
    );
    if (quilboars.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: hoggyBank.id,
        targetPlayerId: ownerId,
        message: `${hoggyBank.name}触发。`,
      });
    }
    for (const quilboar of quilboars) {
      context.hoggyBankDeathrattles[ownerId].add(quilboar.instanceId);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: hoggyBank.id,
        targetPlayerId: ownerId,
        targetInstanceId: quilboar.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(quilboar),
        message: `${hoggyBank.name}使${quilboar.name}获得“亡语：获取2张鲜血宝石”。`,
      });
    }
  }

  const holyMallet = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.holyMallet,
  );
  if (holyMallet && board.length > 0) {
    const targets = [...new Map(
      [board[0], board[board.length - 1]].map((minion) => [
        minion.instanceId,
        minion,
      ]),
    ).values()];
    pushBattleEvent(context.events, {
      type: "startOfCombat",
      actorPlayerId: ownerId,
      actorInstanceId: holyMallet.id,
      targetPlayerId: ownerId,
      message: `${holyMallet.name}触发。`,
    });
    for (const target of targets) {
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { keywords: ["divineShield"] },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: holyMallet.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${holyMallet.name}使${target.name}获得圣盾。`,
      });
    }
  }

  const rustyTrident = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.rustyTrident,
  );
  if (rustyTrident) {
    const naga = board.filter(
      (minion) => minion.health > 0 && minionHasTribe(minion, "naga"),
    );
    if (naga.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: rustyTrident.id,
        targetPlayerId: ownerId,
        message: `${rustyTrident.name}触发。`,
      });
    }
    for (const target of naga) {
      context.rustyTridentDeathrattles[ownerId].add(target.instanceId);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: rustyTrident.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        message: `${rustyTrident.name}使${target.name}获得获取随机塑造法术的亡语。`,
      });
    }
  }

  const flyingGolemPortrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.flyingGolemPortrait,
  );
  if (flyingGolemPortrait && board.length > 0) {
    pushBattleEvent(context.events, {
      type: "startOfCombat",
      actorPlayerId: ownerId,
      actorInstanceId: flyingGolemPortrait.id,
      targetPlayerId: ownerId,
      message: `${flyingGolemPortrait.name}使你的随从获得永久强化战队的亡语。`,
    });
    for (const target of board) {
      context.flyingGolemDeathrattles[ownerId].add(target.instanceId);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: flyingGolemPortrait.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        message: `${flyingGolemPortrait.name}使${target.name}获得“亡语：使你的随从永久获得+2/+2”。`,
      });
    }
  }

  const powderKeg = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.powderKeg,
  );
  if (powderKeg) {
    const targets = randomBoardSubset(
      context.state,
      board.filter(
        (minion) => minion.health > 0 && minionHasTribe(minion, "pirate"),
      ),
      3,
    );
    if (targets.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: powderKeg.id,
        targetPlayerId: ownerId,
        message: `${powderKeg.name}使${targets.length}个友方海盗获得空中海盗亡语。`,
      });
    }
    for (const target of targets) {
      context.powderKegDeathrattles[ownerId].add(target.instanceId);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: powderKeg.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        message: `${powderKeg.name}使${target.name}获得召唤空中海盗并使其立即攻击的亡语。`,
      });
    }
  }

  const balefulIncense = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.balefulIncense,
  );
  if (balefulIncense) {
    const undead = board.filter(
      (minion) => minion.health > 0 && minionHasTribe(minion, "undead"),
    );
    const targets = undead.length === 0
      ? []
      : [...new Map(
          [undead[0], undead[undead.length - 1]].map((minion) => [
            minion.instanceId,
            minion,
          ]),
        ).values()];
    if (targets.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: balefulIncense.id,
        targetPlayerId: ownerId,
        message: `${balefulIncense.name}触发。`,
      });
    }
    for (const target of targets) {
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { keywords: ["reborn"] },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: balefulIncense.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${balefulIncense.name}使${target.name}获得复生。`,
      });
    }
  }

  const anvil = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.ironforgeAnvil,
  );
  if (anvil) {
    const targets = board.filter(
      (minion) => minion.health > 0 && minion.tribes.length === 0,
    );
    if (targets.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: anvil.id,
        targetPlayerId: ownerId,
        message: `${anvil.name}触发。`,
      });
    }
    for (const target of targets) {
      // Ironforge Anvil sets current stats to exactly triple rather than
      // emitting a conventional stat-gain enchantment.
      const attackDelta = target.attack * 2;
      const healthDelta = target.health * 2;
      target.attack *= 3;
      target.health *= 3;
      adjustCombatMaximumHealth(context, ownerId, target, healthDelta);
      reconcileConditionalMinion(target);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: anvil.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: cloneMinion(target),
        message: `${anvil.name}使没有类型的${target.name}的属性值变为三倍。`,
      });
    }
  }

  const timepiece = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.bronzeTimepiece,
  );
  if (timepiece && board.length > 0) {
    pushBattleEvent(context.events, {
      type: "startOfCombat",
      actorPlayerId: ownerId,
      actorInstanceId: timepiece.id,
      targetPlayerId: ownerId,
      message: `${timepiece.name}触发。`,
    });
    for (const target of board.filter((minion) => minion.health > 0)) {
      const healthDelta = Math.ceil(target.attack / 2);
      if (healthDelta <= 0) {
        continue;
      }
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { health: healthDelta },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: timepiece.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${timepiece.name}使${target.name}获得+${healthDelta}生命值。`,
      });
    }
  }

  const rivendarePortrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.rivendarePortrait,
  );
  if (rivendarePortrait) {
    const tituses = board.filter(
      (minion) =>
        minion.health > 0 &&
        minionHasEffectSource(minion, "titus-rivendare"),
    );
    if (tituses.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: rivendarePortrait.id,
        targetPlayerId: ownerId,
        message: `${rivendarePortrait.name}使你的提图斯的生命值翻倍。`,
      });
    }
    for (const target of tituses) {
      const healthDelta = target.health;
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { health: healthDelta },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: rivendarePortrait.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${rivendarePortrait.name}使${target.name}的生命值翻倍。`,
      });
    }
  }

  const protectiveRing = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.protectiveRing,
  );
  if (protectiveRing) {
    const targets = randomBoardSubset(
      context.state,
      board.filter(
        (minion) =>
          minion.health > 0 && minionHasTribe(minion, "pirate"),
      ),
      4,
    );
    if (targets.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: protectiveRing.id,
        targetPlayerId: ownerId,
        message: `${protectiveRing.name}随机使至多4个友方海盗获得圣盾。`,
      });
    }
    for (const target of targets) {
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { keywords: ["divineShield"] },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: protectiveRing.id,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${protectiveRing.name}使${target.name}获得圣盾。`,
      });
    }
  }

  const dramalocSticker = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.dramalocSticker,
  );
  if (dramalocSticker) {
    const highestHandAttack = combatHandMinions(context, ownerId).reduce(
      (highest, minion) => Math.max(highest, minion.attack),
      0,
    );
    const targets = board.filter(
      (minion) =>
        minion.health > 0 && minionHasTribe(minion, "murloc"),
    );
    if (highestHandAttack > 0 && targets.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: dramalocSticker.id,
        targetPlayerId: ownerId,
        attackDelta: highestHandAttack,
        message: `${dramalocSticker.name}读取手牌中的最高攻击力${highestHandAttack}。`,
      });
      for (const target of targets) {
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          target,
          { attack: highestHandAttack },
        );
        pushBattleEvent(context.events, {
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: dramalocSticker.id,
          targetPlayerId: ownerId,
          targetInstanceId: target.instanceId,
          attackDelta: highestHandAttack,
          healthDelta: gain.attackGainHealth,
          minion: cloneMinion(target),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${dramalocSticker.name}使${target.name}获得+${highestHandAttack}攻击力。`,
        });
      }
    }
  }

  const rylakPortrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.rylakPortrait,
  );
  if (rylakPortrait) {
    const rylaks = [...board].filter(
      (minion) =>
        minion.health > 0 &&
        minionHasEffectSource(minion, RYLAK_METALHEAD_DEFINITION_ID),
    );
    if (rylaks.length > 0) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: ownerId,
        actorInstanceId: rylakPortrait.id,
        targetPlayerId: ownerId,
        message: `${rylakPortrait.name}触发了你的重金属双头飞龙的亡语。`,
      });
    }
    for (const rylak of rylaks) {
      const index = board.findIndex(
        (candidate) =>
          candidate.instanceId === rylak.instanceId &&
          candidate.health > 0,
      );
      if (index < 0) {
        continue;
      }
      resolveOneDeathrattle(context, {
        minion: rylak,
        index,
        ownerId,
        adjacentInstanceIds: [board[index - 1], board[index + 1]]
          .filter(
            (neighbor): neighbor is MinionInstance =>
              neighbor !== undefined && neighbor.health > 0,
          )
          .map((neighbor) => neighbor.instanceId),
      });
      resolveCombatDeaths(context);
    }
  }

  applyFangAnkletAtStartOfCombat(context, ownerId);
  triggerHeraldStickerAtStartOfCombat(context, ownerId);
}

function summonAutomatonPortraitWhenSpace(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const portrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.automatonPortrait,
  );
  if (
    !portrait ||
    context.boards[ownerId].length >= MAX_BOARD_SIZE ||
    trinketCombatCounter(context, ownerId, portrait, "armed") <= 0
  ) {
    return;
  }
  setTrinketCombatCounter(context, ownerId, portrait, "armed", 0);
  const automaton = createMinionInstance(
    context.state,
    ASTRAL_AUTOMATON_DEFINITION_ID,
    0,
  );
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: portrait.id,
    targetPlayerId: ownerId,
    message: `${portrait.name}发现空位并召唤星元自动机。`,
  });
  insertCombatMinion(
    context,
    ownerId,
    automaton,
    context.boards[ownerId].length,
    automaton,
    `${portrait.name}召唤了${automaton.name}。`,
  );
}

function triggerCombatAttackTrinkets(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
): void {
  const kibble = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.allPurposeKibble,
  );
  if (kibble && minionHasTribe(attacker, "beast")) {
    const counterKey = `${kibble.id}:persistentAttackGrowth`;
    const owner = findPlayer(context.state, ownerId);
    const growth =
      context.trinketCombatCounters[ownerId][counterKey] ??
      owner?.trinketCounters[kibble.id] ??
      0;
    const attackDelta = 2 + growth;
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      attacker,
      { attack: attackDelta },
    );
    const nextGrowth = growth + 2;
    context.trinketCombatCounters[ownerId][counterKey] = nextGrowth;
    const persistentOwner = persistentCombatOwner(context, ownerId);
    if (persistentOwner) {
      persistentOwner.trinketCounters[kibble.id] = nextGrowth;
    }
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: kibble.id,
      targetPlayerId: ownerId,
      targetInstanceId: attacker.instanceId,
      attackDelta,
      healthDelta: gain.attackGainHealth,
      minion: cloneMinion(attacker),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      permanentEffectImprovement: persistentOwner !== undefined,
      message: `${kibble.name}使正在攻击的${attacker.name}获得+${attackDelta}攻击力；后续增益永久提高。`,
    });
  }

  const dragonScale = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.faerieDragonScale,
  );
  if (
    dragonScale &&
    minionHasTribe(attacker, "dragon") &&
    !attacker.divineShield
  ) {
    const uses = trinketCombatCounter(
      context,
      ownerId,
      dragonScale,
      "uses",
    );
    if (uses < 3) {
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        attacker,
        { keywords: ["divineShield"] },
      );
      setTrinketCombatCounter(
        context,
        ownerId,
        dragonScale,
        "uses",
        uses + 1,
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: dragonScale.id,
        targetPlayerId: ownerId,
        targetInstanceId: attacker.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(attacker),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${dragonScale.name}使正在攻击的${attacker.name}获得圣盾（本场第${uses + 1}次）。`,
      });
    }
  }

  const jar = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.jarOfGems,
  );
  if (!jar) {
    return;
  }
  const attacks =
    trinketCombatCounter(context, ownerId, jar, "attacks") + 1;
  if (attacks < 2) {
    setTrinketCombatCounter(
      context,
      ownerId,
      jar,
      "attacks",
      attacks,
    );
    return;
  }
  setTrinketCombatCounter(context, ownerId, jar, "attacks", 0);
  const targets = context.boards[ownerId].filter(
    (minion) => minion.health > 0 && minionHasTribe(minion, "quilboar"),
  );
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: jar.id,
    targetPlayerId: ownerId,
    message: `${jar.name}在两次友方攻击后对所有友方野猪人使用鲜血宝石。`,
  });
  for (const target of targets) {
    applyCombatBloodGemPulse(context, ownerId, target, {
      actorInstanceId: jar.id,
      sourceLabel: jar.name,
    });
  }
}

function grantSummonedMinionShieldFromTrinket(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  summoned: MinionInstance,
  suffix: string,
): boolean {
  if (summoned.divineShield || summoned.health <= 0) {
    return false;
  }
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    summoned,
    { keywords: ["divineShield"] },
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    targetInstanceId: summoned.instanceId,
    attackDelta: 0,
    healthDelta: 0,
    minion: cloneMinion(summoned),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message: `${trinket.name}使新召唤的${summoned.name}获得圣盾${suffix}。`,
  });
  return true;
}

function triggerCombatSummonTrinkets(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: MinionInstance,
): void {
  if (
    summoned.health <= 0 ||
    !context.boards[ownerId].some(
      (candidate) => candidate.instanceId === summoned.instanceId,
    )
  ) {
    return;
  }

  const slamma = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.slammaSticker,
  );
  if (slamma && minionHasTribe(summoned, "beast")) {
    const attackDelta = summoned.attack;
    summoned.attack *= 2;
    reconcileConditionalMinion(summoned);
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: slamma.id,
      targetPlayerId: ownerId,
      targetInstanceId: summoned.instanceId,
      attackDelta,
      healthDelta: 0,
      minion: cloneMinion(summoned),
      message: `${slamma.name}使新召唤的${summoned.name}攻击力翻倍。`,
    });
  }

  const reinforcedShield = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.reinforcedShield,
  );
  if (reinforcedShield) {
    const uses = trinketCombatCounter(
      context,
      ownerId,
      reinforcedShield,
      "uses",
    );
    if (
      uses < 5 &&
      grantSummonedMinionShieldFromTrinket(
        context,
        ownerId,
        reinforcedShield,
        summoned,
        `（本场第${uses + 1}次）`,
      )
    ) {
      setTrinketCombatCounter(
        context,
        ownerId,
        reinforcedShield,
        "uses",
        uses + 1,
      );
    }
  }

  const bassgill = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.bassgillPortrait,
  );
  if (bassgill && minionHasTribe(summoned, "murloc")) {
    grantSummonedMinionShieldFromTrinket(
      context,
      ownerId,
      bassgill,
      summoned,
      "",
    );
  }

  const mamaBearSticker = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.mamaBearSticker,
  );
  if (mamaBearSticker && minionHasTribe(summoned, "beast")) {
    const gain = applyCombatEnchantingGain(
      context,
      ownerId,
      summoned,
      { attack: 5, health: 5 },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: mamaBearSticker.id,
      targetPlayerId: ownerId,
      targetInstanceId: summoned.instanceId,
      attackDelta: 5,
      healthDelta: 5 + gain.attackGainHealth,
      minion: cloneMinion(summoned),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `${mamaBearSticker.name}使新召唤的${summoned.name}获得+5/+5。`,
    });
  }

  const wildfeatherDuster = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.wildfeatherDuster,
  );
  if (wildfeatherDuster && minionHasTribe(summoned, "beast")) {
    const owner = findPlayer(context.state, ownerId);
    const counterKey = `${wildfeatherDuster.id}:beastSummons`;
    const priorProgress =
      context.trinketCombatCounters[ownerId][counterKey] ??
      owner?.trinketCounters[wildfeatherDuster.id] ??
      0;
    const total = priorProgress + 1;
    const nextProgress = total % 6;
    context.trinketCombatCounters[ownerId][counterKey] = nextProgress;
    const persistentOwner = persistentCombatOwner(context, ownerId);
    if (persistentOwner) {
      persistentOwner.trinketCounters[wildfeatherDuster.id] = nextProgress;
    }
    if (total >= 6) {
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: wildfeatherDuster.id,
        targetPlayerId: ownerId,
        message: `${wildfeatherDuster.name}在召唤6只野兽后触发。`,
      });
      gainRandomGeneratedMinionFromTrinket(
        context,
        ownerId,
        wildfeatherDuster,
        (definition, currentOwner) =>
          definition.tier <= currentOwner.tavernTier &&
          definitionHasTribe(definition, "beast"),
        "野兽牌",
      );
    }
  }

  if (minionHasTribe(summoned, "beast")) {
    const owner = persistentCombatOwner(context, ownerId);
    const improvement = owner ? improveFangAnklet(owner) : null;
    if (improvement) {
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: improvement.trinket.id,
        targetPlayerId: ownerId,
        targetInstanceId: summoned.instanceId,
        minion: cloneMinion(summoned),
        amount: improvement.nextCombatBuff,
        permanentEffectImprovement: true,
        message: `${improvement.trinket.name}在召唤${summoned.name}后，永久提升至+${improvement.nextCombatBuff}/+${improvement.nextCombatBuff}。`,
      });
    }
  }
}

function pushCombatTargetedSpellCastTriggerEvent(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
  target: MinionInstance,
  result: TargetedSpellCastTriggerResult,
): void {
  if (!result.changed) {
    return;
  }
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    minion: cloneMinion(target),
    message: `${target.name}因法术施放获得了烈毒${
      result.permanent ? "。" : "，直到下个回合。"
    }`,
  });
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
      context.tavernSpellsCast[ownerId],
      context.deathrattlesTriggered[ownerId],
      context.magnetizationsThisGame[ownerId],
    );
    if (delta.health !== 0) {
      adjustCombatMaximumHealth(
        context,
        ownerId,
        minion,
        delta.health,
      );
    }
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

function observeCombatDeathrattleTriggered(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): void {
  context.deathrattlesTriggered[ownerId] =
    (context.deathrattlesTriggered[ownerId] ?? 0) + 1;
  const persistentOwner = persistentCombatOwner(context, ownerId);
  if (persistentOwner) {
    persistentOwner.deathrattlesTriggered =
      context.deathrattlesTriggered[ownerId];
    reconcilePlayerWhereverMinions(persistentOwner);
  }
  reconcileCombatWhereverMinions(
    context,
    ownerId,
    source.instanceId,
    `${source.name}的亡语触发，使坠落的飞天魔像获得本局永久成长。`,
  );
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
    healthDelta: healthDelta + gain.attackGainHealth,
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
        if (effect.kind === "destroyNeighborsForStitchedSalvager") {
          const sourceIndex = board.findIndex(
            (minion) =>
              minion.instanceId === source.instanceId && minion.health > 0,
          );
          if (sourceIndex < 0) {
            continue;
          }
          const neighborIndexes =
            component.golden && effect.goldenMode === "adjacent"
              ? [sourceIndex - 1, sourceIndex + 1]
              : [sourceIndex - 1];
          const destroyed = neighborIndexes
            .map((index) => board[index])
            .filter(
              (minion): minion is BoardMinionInstance =>
                minion !== undefined &&
                minion.health > 0 &&
                minion.definitionId !== STITCHED_SALVAGER_DEFINITION_ID,
            );
          if (destroyed.length === 0) {
            continue;
          }
          const stored =
            context.stitchedSalvagerDestroyed[ownerId][
              component.sourceInstanceId
            ] ?? [];
          stored.push(...destroyed.map(cloneMinion));
          context.stitchedSalvagerDestroyed[ownerId][
            component.sourceInstanceId
          ] = stored;
          for (const target of destroyed) {
            target.health = 0;
            pushBattleEvent(context.events, {
              type: "trigger",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              actorMinion: cloneMinion(source),
              minion: cloneMinion(target),
              message: `${rallySourceLabel(component)}消灭了相邻的${target.name}，并保存了它的完全相同复制。`,
            });
          }
          resolveCombatDeaths(context);
          continue;
        }

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
      const attackDelta = aura.attack * scale;
      const healthDelta = aura.health * scale;
      for (const target of board) {
        if (
          !minionHasTribe(target, aura.tribe) ||
          (aura.otherOnly && target.instanceId === source.instanceId)
        ) {
          continue;
        }
        const triggeredHealth = healthGainedFromExternalAttack(
          target,
          attackDelta,
        );
        target.attack += attackDelta;
        target.health += healthDelta + triggeredHealth;
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
      const attackDelta = aura.attack * scale;
      const triggeredHealth = healthGainedFromExternalAttack(
        summoned,
        attackDelta,
      );
      summoned.attack += attackDelta;
      summoned.health += aura.health * scale + triggeredHealth;
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
      const triggeredHealth = healthGainedFromExternalAttack(
        target,
        attackDelta,
      );
      const totalHealthDelta = healthDelta + triggeredHealth;
      target.attack += attackDelta;
      target.health += totalHealthDelta;
      adjustCombatMaximumHealth(
        context,
        ownerId,
        target,
        totalHealthDelta,
      );
      reconcileConditionalMinion(target);
      events.push({
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta: totalHealthDelta,
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
    const triggeredHealth = healthGainedFromExternalAttack(
      minion,
      buff.attack,
    );
    minion.attack += buff.attack;
    minion.health += buff.health + triggeredHealth;
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
  for (
    let trigger = 0;
    trigger < heroPowerTriggerMultiplier(owner);
    trigger += 1
  ) {
    const triggeredHealth = healthGainedFromExternalAttack(minion, 1);
    minion.attack += 1;
    minion.health += 2 + triggeredHealth;
  }
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
  const appendHealthGainTriggers = (
    target: MinionInstance,
    healthGain: number,
  ): void => {
    const triggers = captureCombatFriendlyHealthGainTriggers(
      context,
      ownerId,
      target,
      healthGain,
    );
    events.push(
      ...resolveCombatFriendlyHealthGainTriggers(
        context,
        ownerId,
        target,
        healthGain,
        triggers,
      ),
    );
  };
  let summonSnapshotBeforeBuff: BoardMinionInstance | undefined;
  for (const watcher of context.boards[ownerId]) {
    if (watcher.instanceId === summoned.instanceId) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlySummoned;
      if (
        !trigger ||
        (trigger.giveSourceMaximumStats !== true &&
          !minionHasTribe(summoned, trigger.tribe))
      ) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      if (trigger.giveSourceMaximumStats) {
        const triggerKey =
          `${watcher.instanceId}:${component.sourceInstanceId}:` +
          `${component.definitionId}:sourceMaximumStats`;
        const triggerCounts =
          context.limitedFriendlySummonTriggers[ownerId];
        const previousTriggers = triggerCounts[triggerKey] ?? 0;
        if (
          trigger.maximumTriggersPerCombat !== undefined &&
          previousTriggers >= trigger.maximumTriggersPerCombat
        ) {
          continue;
        }
        triggerCounts[triggerKey] = previousTriggers + 1;
        summonSnapshotBeforeBuff ??= cloneMinion(summoned);
        const statScale =
          component.golden && trigger.goldenMode === "doubleStats"
            ? 2
            : 1;
        const attackDelta = watcher.attack * statScale;
        const healthDelta =
          combatMaximumHealth(context, ownerId, watcher) * statScale;
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          summoned,
          { attack: attackDelta, health: healthDelta },
          false,
        );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: summoned.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta,
          healthDelta: healthDelta + gain.attackGainHealth,
          minion: cloneMinion(summoned),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}在${summoned.name}被召唤后使其获得+${attackDelta}/+${healthDelta}（本场第${previousTriggers + 1}次）。`,
        });
        appendHealthGainTriggers(
          summoned,
          healthDelta + gain.attackGainHealth,
        );
      } else if (trigger.permanentAttackGrowth !== undefined) {
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
          false,
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
          healthDelta: gain.attackGainHealth,
          minion: cloneMinion(summoned),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}使${summoned.name}获得+${attackDelta}攻击力。`,
        });
        appendHealthGainTriggers(summoned, gain.attackGainHealth);
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
          false,
        );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: summoned.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta,
          healthDelta: gain.attackGainHealth,
          minion: cloneMinion(summoned),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}使${summoned.name}的攻击力变为${multiplier}倍。`,
        });
        appendHealthGainTriggers(summoned, gain.attackGainHealth);
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
          false,
        );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: summoned.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: watcher.instanceId,
          attackDelta,
          healthDelta: healthDelta + gain.attackGainHealth,
          minion: cloneMinion(watcher),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${summoned.name}被召唤后，${watcher.name}获得+${attackDelta}/+${healthDelta}和圣盾。`,
        });
        appendHealthGainTriggers(
          watcher,
          healthDelta + gain.attackGainHealth,
        );
      } else {
        summonSnapshotBeforeBuff ??= cloneMinion(summoned);
        const attackDelta = (trigger.attack ?? 0) * scale;
        const healthDelta = (trigger.health ?? 0) * scale;
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          summoned,
          { attack: attackDelta, health: healthDelta },
          false,
        );
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: summoned.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta,
          healthDelta: healthDelta + gain.attackGainHealth,
          minion: cloneMinion(summoned),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}在${summoned.name}被召唤后使其获得+${attackDelta}/+${healthDelta}。`,
        });
        appendHealthGainTriggers(
          summoned,
          healthDelta + gain.attackGainHealth,
        );
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
  if (rejectCombatSummonForFullBoard(context, ownerId)) {
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
  for (let count = 0; count < summonCount; count += 1) {
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
  if (rejectCombatSummonForFullBoard(context, ownerId)) {
    return null;
  }
  const healthBeforeSummonBonuses = summoned.health;
  reconcileWhereverMinion(
    summoned,
    context.astralAutomatonsSummoned[ownerId],
    context.eternalKnightsDied[ownerId],
    context.tavernSpellsCast[ownerId],
    context.deathrattlesTriggered[ownerId],
    context.magnetizationsThisGame[ownerId],
  );
  if (
    summonReason !== "rallyFromHand" &&
    summonReason !== "startOfCombatFromHand" &&
    summonReason !== "deathlyStrikerFromHand" &&
    summonReason !== "stitchedSalvagerCopy"
  ) {
    applyPersistentTribeBuff(context, ownerId, summoned);
  }
  applyCombatSummonHeroPower(context, ownerId, summoned);
  if (summonReason !== "stitchedSalvagerCopy") {
    applyExistingAurasToSummoned(board, summoned);
  }
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
  triggerCombatSummonTrinkets(context, ownerId, summoned);
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
          !context.startOfCombatSummonedHandInstanceIds[
            ownerId
          ].has(candidate.instanceId),
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
      context.startOfCombatSummonedHandInstanceIds[ownerId].add(
        selected.instanceId,
      );
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
            healthDelta: healthDelta + gain.attackGainHealth,
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
    let attackGainHealth = 0;
    if (trigger.permanent) {
      const gain = applyExplicitPermanentCombatStatGain(
        context,
        targetOwnerId,
        buffTarget,
        { attack: attackDelta, health: healthDelta },
      );
      retentionMultiplier = gain.persisted ? 1 : 0;
      attackGainHealth = gain.attackGainHealth;
    } else {
      const gain = applyCombatEnchantingGain(
        context,
        targetOwnerId,
        buffTarget,
        { attack: attackDelta, health: healthDelta },
      );
      retentionMultiplier = gain.retentionMultiplier;
      attackGainHealth = gain.attackGainHealth;
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
      healthDelta: healthDelta + attackGainHealth,
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
      let attackGainHealth = 0;
      if (trigger.permanent) {
        const gain = applyExplicitPermanentCombatStatGain(
          context,
          sourceOwnerId,
          buffTarget,
          { attack: attackDelta, health: healthDelta },
        );
        retentionMultiplier = gain.persisted ? 1 : 0;
        attackGainHealth = gain.attackGainHealth;
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
        attackGainHealth = gain.attackGainHealth;
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
        healthDelta: healthDelta + attackGainHealth,
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
  appliesVenomous = true,
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
  if (poisonous || (appliesVenomous && source.venomous)) {
    target.health = Math.min(0, target.health);
    context.poisonLethalMinionIds[targetOwnerId].add(target.instanceId);
  }
  if (appliesVenomous && source.venomous) {
    source.venomous = false;
  }
  if (target.health <= 0) {
    context.lethalDamageSources[targetOwnerId][target.instanceId] = {
      ownerId: sourceOwnerId,
      instanceId: source.instanceId,
    };
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
      getRandomMinionMaximumTier(owner, effect),
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
      owner.tavernSpellsCast ?? 0,
      owner.deathrattlesTriggered ?? 0,
      owner.magnetizationsThisGame ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    addCardToHand(context.state, owner, gained, {
      combatContext: context,
      combatOwnerId: ownerId,
      combatEvent: {
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
      },
    });
    resolveTriples(context.state, owner, context);
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
      owner.tavernSpellsCast ?? 0,
      owner.deathrattlesTriggered ?? 0,
      owner.magnetizationsThisGame ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    addCardToHand(context.state, owner, gained, {
      combatContext: context,
      combatOwnerId: ownerId,
      combatEvent: {
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
      },
    });
    resolveTriples(context.state, owner, context);
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
      {
        combatContext: context,
        combatOwnerId: ownerId,
        combatEvent: {
          type: "cardGain",
          actorPlayerId: ownerId,
          actorInstanceId: source.instanceId,
          targetPlayerId: ownerId,
          amount: 1,
          cardName: owner.isHuman ? "鲜血宝石" : undefined,
          cardKind: "bloodGem",
          cardGainResult: "added",
          message: owner.isHuman
            ? `${sourceLabel}使你获得了一张鲜血宝石。`
            : `${sourceLabel}使${owner.name}获得了一张牌。`,
        },
      },
    );
    if (added === 0) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardName: owner.isHuman ? "鲜血宝石" : undefined,
        cardKind: "bloodGem",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得鲜血宝石。`
          : `${sourceLabel}未能使${owner.name}获得牌。`,
      });
    }
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
    addCardToHand(context.state, owner, gained, {
      combatContext: context,
      combatOwnerId: ownerId,
      combatEvent: {
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
      },
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
    addCardToHand(context.state, owner, gained, {
      combatContext: context,
      combatOwnerId: ownerId,
      combatEvent: {
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
      },
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
  if (
    combatCopy.definitionId === DEATHLY_STRIKER_DEFINITION_ID &&
    !combatCopy.deathlyStrikerLineageIds?.length
  ) {
    combatCopy.deathlyStrikerLineageIds = [minion.instanceId];
  }
  combatCopy.instanceId = `minion-${state.nextInstanceId}`;
  combatCopy.poolCopies = 0;
  delete combatCopy.poolCopiesOnPurchase;
  delete combatCopy.poolCopiesByDefinitionId;
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
  if (!owner) {
    return;
  }
  const count =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);
  const selections = selectHighestAttackHandMinions(
    context.state,
    combatHandMinions(context, ownerId),
    count,
  );
  const definition = getMinionDefinition(component.definitionId);
  for (const [selectionIndex, selected] of selections.entries()) {
    const attackerIndex = board.findIndex(
      (minion) => minion.instanceId === attacker.instanceId,
    );
    if (attackerIndex < 0) {
      break;
    }
    if (rejectCombatSummonForFullBoard(context, ownerId)) {
      continue;
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
    healthDelta: gain.attackGainHealth,
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
        healthDelta: gain.attackGainHealth,
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
    (minion.crabDeathrattles ?? 0) > 0 ||
    (minion.goldenCrabDeathrattles ?? 0) > 0 ||
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
  const deathrattleSource = board.find(
    (minion) =>
      minion.instanceId !== attacker.instanceId &&
      minion.health > 0 &&
      minionHasTriggerableDeathrattle(minion),
  );
  const triggersBattlecry =
    component.definitionId === "BGS_078" &&
    (() => {
      const owner = findPlayer(context.state, ownerId);
      return (
        owner !== undefined &&
        playerHasTrinketCardId(
          owner,
          MONSTROUS_MACAW_PORTRAIT_CARD_ID,
        )
      );
    })();
  const battlecrySource = triggersBattlecry
    ? board.find(
        (minion) =>
          minion.instanceId !== attacker.instanceId &&
          minion.health > 0 &&
          minionHasPrintedBattlecry(minion),
      )
    : undefined;
  if (!deathrattleSource && !battlecrySource) {
    return;
  }
  const originalSourceIndex = deathrattleSource
    ? board.findIndex(
        (minion) => minion.instanceId === deathrattleSource.instanceId,
      )
    : -1;
  const repetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    if (deathrattleSource) {
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: deathrattleSource.instanceId,
        minion: cloneMinion(deathrattleSource),
        message: `${rallySourceLabel(component)}的进击触发了${deathrattleSource.name}的亡语${
          repetitions > 1 ? `（第${repetition + 1}次）` : ""
        }。`,
      });
      resolveOneDeathrattle(context, {
        minion: deathrattleSource,
        index: (() => {
          const liveSourceIndex = board.findIndex(
            (minion) =>
              minion.instanceId === deathrattleSource.instanceId,
          );
          return liveSourceIndex >= 0
            ? liveSourceIndex + 1
            : Math.min(originalSourceIndex, board.length);
        })(),
        ownerId,
      });
      resolveCombatDeaths(context);
    }
    if (
      battlecrySource &&
      board.some(
        (minion) => minion.instanceId === battlecrySource.instanceId,
      )
    ) {
      resolveCombatBattlecry(
        context,
        ownerId,
        battlecrySource,
        attacker,
      );
    }
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
    healthDelta: healthDelta + gain.attackGainHealth,
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
    const aura = tavernSpellAuraBonus(context.boards[ownerId]);
    const heroBonus =
      context.ghostOwnerId === ownerId
        ? 0
        : heroTavernSpellBuffBonus(owner);
    const attackBonus =
      (owner?.tavernSpellAttackBonus ?? 0) + aura.attack + heroBonus;
    const healthBonus =
      (owner?.tavernSpellHealthBonus ?? 0) + aura.health + heroBonus;
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
    triggerCombatAfterTavernSpellCast(
      context,
      ownerId,
      source.instanceId,
      definition.id,
    );
  }
}

function combatDeathrattleAdjacentTargets(
  context: CombatContext,
  death: DeadMinion,
): MinionInstance[] {
  const board = context.boards[death.ownerId];
  if (death.adjacentInstanceIds) {
    return death.adjacentInstanceIds
      .map((instanceId) =>
        board.find((candidate) => candidate.instanceId === instanceId),
      )
      .filter(
        (candidate): candidate is MinionInstance =>
          candidate !== undefined && candidate.health > 0,
      );
  }

  const liveSourceIndex = board.findIndex(
    (candidate) =>
      candidate.instanceId === death.minion.instanceId,
  );
  if (liveSourceIndex >= 0) {
    return [board[liveSourceIndex - 1], board[liveSourceIndex + 1]]
      .filter(
        (candidate): candidate is MinionInstance =>
          candidate !== undefined && candidate.health > 0,
      );
  }
  return [board[death.index - 1], board[death.index]]
    .filter(
      (candidate): candidate is MinionInstance =>
        candidate !== undefined && candidate.health > 0,
    );
}

function combatBattlecryTriggerCount(
  board: readonly MinionInstance[],
): number {
  return (
    1 +
    board.reduce((largestExtra, minion) => {
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

function minionHasPrintedBattlecry(minion: MinionInstance): boolean {
  return minionEffectSources(minion).some((component) => {
    const definition = getMinionDefinition(component.definitionId);
    return (
      definition.battlecry !== undefined ||
      definition.interactiveBattlecry !== undefined ||
      definition.printedMechanics?.includes("BATTLECRY") === true
    );
  });
}

function combatElementalStatGrantBonus(
  context: CombatContext,
  ownerId: PlayerId,
  component: MinionEffectSource,
): CombatStatBuff {
  if (
    !definitionHasTribe(
      getMinionDefinition(component.definitionId),
      "elemental",
    )
  ) {
    return { attack: 0, health: 0 };
  }
  return context.elementalGrantBonuses[ownerId] ?? {
    attack: 0,
    health: 0,
  };
}

function improveElementalStatGrantsInCombat(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: ImproveElementalStatGrantsEffect,
  triggerLabel: string,
): void {
  const scale = component.golden ? 2 : 1;
  const attackDelta = effect.attack * scale;
  const healthDelta = effect.health * scale;
  const localBonus = context.elementalGrantBonuses[ownerId];
  localBonus.attack += attackDelta;
  localBonus.health += healthDelta;
  const owner = persistentCombatOwner(context, ownerId);
  if (owner) {
    owner.elementalGrantAttackBonus += attackDelta;
    owner.elementalGrantHealthBonus += healthDelta;
  }
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: source.instanceId,
    actorMinion: cloneMinion(source),
    minion: cloneMinion(source),
    attackDelta,
    healthDelta,
    ...(owner ? { permanentEffectImprovement: true } : {}),
    message: `${rallySourceLabel(component)}的${triggerLabel}使元素给予随从的属性永久额外获得+${attackDelta}/+${healthDelta}。`,
  });
}

function pushCombatBattlecryBuff(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  target: MinionInstance,
  attack: number,
  health: number,
  taunt: boolean,
): void {
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    {
      attack,
      health,
      keywords: taunt ? ["taunt"] : [],
    },
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: attack,
    healthDelta: health + gain.attackGainHealth,
    minion: cloneMinion(target),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message: `${source.name}的战吼使${target.name}获得+${attack}/+${health}。`,
  });
}

function combatBattlecryBuffTargets(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  effect: BuffEffect,
): MinionInstance[] {
  const board = context.boards[ownerId];
  const matchesTier = (minion: MinionInstance): boolean =>
    effect.tierParity === undefined ||
    (effect.tierParity === "odd"
      ? minion.tier % 2 === 1
      : minion.tier % 2 === 0);
  const filterTier = (minions: readonly MinionInstance[]) =>
    minions.filter(matchesTier);
  const chooseRandom = (minions: readonly MinionInstance[]) => {
    const candidates = [...minions];
    const selected: MinionInstance[] = [];
    const count = Math.max(1, effect.count ?? 1);
    while (selected.length < count && candidates.length > 0) {
      const index = randomIndex(context.state, candidates.length);
      selected.push(candidates[index]);
      candidates.splice(index, 1);
    }
    return selected;
  };
  switch (effect.target) {
    case "self":
      return matchesTier(source) ? [source] : [];
    case "allFriendly":
      return filterTier(board);
    case "otherFriendly":
      return filterTier(
        board.filter(
          (minion) => minion.instanceId !== source.instanceId,
        ),
      );
    case "otherFriendlyTribe":
      return filterTier(
        board.filter(
          (minion) =>
            minion.instanceId !== source.instanceId &&
            minionHasTribe(minion, effect.tribe),
        ),
      );
    case "friendlyTribe":
      return filterTier(
        board.filter((minion) => minionHasTribe(minion, effect.tribe)),
      );
    case "adjacentFriendly": {
      const sourceIndex = board.findIndex(
        (minion) => minion.instanceId === source.instanceId,
      );
      return sourceIndex < 0
        ? []
        : filterTier(
            board.filter(
              (minion, index) =>
                minion.instanceId !== source.instanceId &&
                Math.abs(index - sourceIndex) === 1,
            ),
          );
    }
    case "randomFriendlyTribe":
      return chooseRandom(
        filterTier(
          board.filter(
            (minion) =>
              (effect.includeSelf ||
                minion.instanceId !== source.instanceId) &&
              minionHasTribe(minion, effect.tribe),
          ),
        ),
      );
    case "randomFriendly":
      return chooseRandom(
        filterTier(
          board.filter(
            (minion) =>
              effect.includeSelf ||
              minion.instanceId !== source.instanceId,
          ),
        ),
      );
  }
}

function resolveCombatBattlecryEffect(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: MinionEffect,
): void {
  const board = context.boards[ownerId];
  const scale = component.golden ? 2 : 1;
  const elementalGrantBonus = combatElementalStatGrantBonus(
    context,
    ownerId,
    component,
  );
  if (effect.kind === "buff") {
    const repetitions = effect.goldenMode === "repeat" ? scale : 1;
    const statScale = effect.goldenMode === "repeat" ? 1 : scale;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      for (const target of combatBattlecryBuffTargets(
        context,
        ownerId,
        source,
        effect,
      )) {
        pushCombatBattlecryBuff(
          context,
          ownerId,
          source,
          target,
          effect.attack * statScale + elementalGrantBonus.attack,
          effect.health * statScale + elementalGrantBonus.health,
          effect.taunt === true,
        );
      }
    }
    return;
  }
  if (effect.kind === "buffOtherFriendlyTribeByFamilyPlayed") {
    const owner = findPlayer(context.state, ownerId);
    const familyCount =
      effect.family === "mrrglton" ? (owner?.mrrgltonsPlayed ?? 0) : 0;
    const statScale =
      effect.goldenMode === "doubleStats" ? scale : 1;
    const attack =
      effect.attack === 0
        ? 0
        : (effect.attack + familyCount) * statScale;
    const health =
      effect.health === 0
        ? 0
        : (effect.health + familyCount) * statScale;
    for (const target of board.filter(
      (candidate) =>
        candidate.health > 0 &&
        candidate.instanceId !== source.instanceId &&
        minionHasTribe(candidate, effect.tribe),
    )) {
      pushCombatBattlecryBuff(
        context,
        ownerId,
        source,
        target,
        attack + elementalGrantBonus.attack,
        health + elementalGrantBonus.health,
        false,
      );
    }
    return;
  }
  if (effect.kind === "buffOwnedTribe") {
    for (const target of board.filter(
      (candidate) =>
        candidate.health > 0 &&
        candidate.instanceId !== source.instanceId &&
        minionHasTribe(candidate, effect.tribe),
    )) {
      pushCombatBattlecryBuff(
        context,
        ownerId,
        source,
        target,
        effect.attack * scale + elementalGrantBonus.attack,
        effect.health * scale + elementalGrantBonus.health,
        false,
      );
    }
    return;
  }
  if (effect.kind === "summon") {
    resolveCombatSummonEffect(
      context,
      ownerId,
      source,
      component,
      effect,
      Math.max(0, board.indexOf(source) + 1),
    );
    return;
  }
  if (effect.kind === "buffThenDamageFriendly") {
    resolveCombatBuffThenDamageFriendly(
      context,
      ownerId,
      source,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "gainMissingHealth") {
    const owner = findPlayer(context.state, ownerId);
    const health =
      Math.max(0, 40 - (owner?.health ?? 40)) *
      effect.multiplier *
      scale;
    if (health > 0) {
      pushCombatBattlecryBuff(
        context,
        ownerId,
        source,
        source,
        elementalGrantBonus.attack,
        health + elementalGrantBonus.health,
        false,
      );
    }
    return;
  }
  if (effect.kind === "improveBeetles") {
    improveBeetlesInCombat(
      context,
      ownerId,
      source,
      component,
      effect,
      "战吼",
    );
    return;
  }
  if (effect.kind === "improveUndeadArmy") {
    resolveCombatImproveUndeadArmy(
      context,
      ownerId,
      source,
      component,
      effect,
      "战吼",
    );
    return;
  }
  if (effect.kind === "gainBloodGems") {
    resolveCombatGainBloodGems(
      context,
      ownerId,
      source,
      component,
      effect,
      "战吼",
    );
    return;
  }
  if (effect.kind === "getRandomMinion") {
    resolveCombatGetRandomMinion(
      context,
      ownerId,
      source,
      component,
      effect,
      "战吼",
    );
    return;
  }
  if (effect.kind === "gainRandomGeneratedMinion") {
    resolveCombatGainRandomGeneratedMinion(
      context,
      ownerId,
      source,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "gainTavernSpell") {
    resolveCombatGainTavernSpell(
      context,
      ownerId,
      source,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "gainRandomTavernSpell") {
    resolveCombatGainRandomTavernSpell(
      context,
      ownerId,
      source,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "castTavernSpell") {
    resolveCombatCastTavernSpell(
      context,
      ownerId,
      source,
      component,
      effect,
      "战吼",
    );
    return;
  }
  if (effect.kind === "applyBloodGemsToTribe") {
    resolveCombatApplyBloodGemsToTribe(
      context,
      ownerId,
      source,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "grantKeyword") {
    resolveCombatGrantKeyword(
      context,
      ownerId,
      source,
      component,
      effect,
    );
    return;
  }
  if (effect.kind === "improveElementalStatGrants") {
    improveElementalStatGrantsInCombat(
      context,
      ownerId,
      source,
      component,
      effect,
      "战吼",
    );
    return;
  }

  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    if (effect.kind === "makeSelfGolden") {
      makeMinionGoldenPreservingEnchantments(source);
    }
    return;
  }
  if (effect.kind === "gainGold") {
    owner.gold += effect.amount * scale;
  } else if (effect.kind === "gainNextTurnGold") {
    owner.pendingNextTurnGold += effect.amount * scale;
  } else if (effect.kind === "gainFreeRefreshes") {
    owner.freeRefreshes += effect.count * scale;
  } else if (effect.kind === "damageHero") {
    damageRecruitPlayer(owner, effect.amount * scale);
  } else if (effect.kind === "gainGeneratedSpell") {
    const count =
      effect.count *
      (effect.goldenMode === "doubleCount" ? scale : 1);
    addGeneratedTargetedSpells(
      context.state,
      owner,
      effect.definitionId,
      count,
    );
  } else if (effect.kind === "gainMinion") {
    const count =
      effect.count *
      (effect.goldenMode === "doubleCount" ? scale : 1);
    for (let index = 0; index < count; index += 1) {
      addGeneratedMinionCopyToHand(
        context.state,
        owner,
        effect.definitionId,
      );
    }
  } else if (effect.kind === "improveBloodGems") {
    owner.bloodGemAttack += effect.attack * scale;
    owner.bloodGemHealth += effect.health * scale;
  } else if (effect.kind === "improveTavernSpellBuffs") {
    owner.tavernSpellAttackBonus += effect.attack * scale;
    owner.tavernSpellHealthBonus += effect.health * scale;
  } else if (effect.kind === "installTavernRefreshBuff") {
    const repetitions = effect.goldenMode === "repeat" ? scale : 1;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      owner.rideTheWindBuffs.push({
        attack: effect.attack + elementalGrantBonus.attack,
        health: effect.health + elementalGrantBonus.health,
      });
    }
  } else if (effect.kind === "buffTavern") {
    const repetitions = effect.goldenMode === "repeat" ? scale : 1;
    const portraitBonus =
      component.definitionId === FELLEMENTAL_DEFINITION_ID &&
      playerHasTrinketCardId(owner, FELLEMENTAL_PORTRAIT_CARD_ID)
        ? 2
        : 0;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      buffTavernMinionsPermanently(
        owner,
        effect.attack + portraitBonus + elementalGrantBonus.attack,
        effect.health + portraitBonus + elementalGrantBonus.health,
      );
    }
  } else if (effect.kind === "buffTavernTier") {
    applyPersistentTavernTierBuff(
      owner,
      effect.maximumTier,
      effect.attack * scale + elementalGrantBonus.attack,
      effect.health * scale + elementalGrantBonus.health,
    );
  } else if (effect.kind === "buffTavernType") {
    const repetitions = effect.goldenMode === "repeat" ? scale : 1;
    const pulseScale = effect.goldenMode === "repeat" ? 1 : scale;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      applyPersistentTavernTypeBuff(
        owner,
        effect.tribe,
        effect.attack * pulseScale + elementalGrantBonus.attack,
        effect.health * pulseScale + elementalGrantBonus.health,
      );
    }
  } else if (effect.kind === "queueDemonFodder") {
    queueDemonFodder(owner, effect, scale);
  } else if (effect.kind === "discountNextTavernSpell") {
    owner.nextTavernSpellDiscount =
      (owner.nextTavernSpellDiscount ?? 0) + effect.amount * scale;
  } else if (effect.kind === "consumeRandomShopMinion") {
    if (source.kind !== "minion" || owner.shop.length === 0) {
      return;
    }
    const [consumed] = owner.shop.splice(
      randomIndex(context.state, owner.shop.length),
      1,
    );
    const statScale =
      effect.goldenMode === "doubleStats" ? scale : 1;
    const attack =
      consumed.attack * statScale + elementalGrantBonus.attack;
    const health =
      consumed.health * statScale + elementalGrantBonus.health;
    pushCombatBattlecryBuff(
      context,
      ownerId,
      source,
      source,
      attack,
      health,
      false,
    );
    finishConsumedShopMinion(context.state, owner, consumed);
  } else if (effect.kind === "makeSelfGolden") {
    makeMinionGoldenPreservingEnchantments(source);
  }
}

function observeCombatBattlecryTriggered(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const watchers = [...context.boards[ownerId]];
  for (const watcherSnapshot of watchers) {
    const watcher = context.boards[ownerId].find(
      (candidate) =>
        candidate.instanceId === watcherSnapshot.instanceId &&
        candidate.health > 0,
    );
    if (!watcher) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterBattlecryTriggered;
      if (!trigger) {
        continue;
      }
      const scale =
        component.golden && trigger.goldenMode === "doubleStats" ? 2 : 1;
      const attackDelta = trigger.attack * scale;
      const healthDelta = trigger.health * scale;
      const targets = [...context.boards[ownerId]].filter(
        (target) =>
          target.health > 0 && minionHasTribe(target, trigger.tribe),
      );
      for (const targetSnapshot of targets) {
        const target = context.boards[ownerId].find(
          (candidate) =>
            candidate.instanceId === targetSnapshot.instanceId &&
            candidate.health > 0,
        );
        if (!target) {
          continue;
        }
        const gain = applyCombatEnchantingGain(
          context,
          ownerId,
          target,
          { attack: attackDelta, health: healthDelta },
        );
        pushBattleEvent(context.events, {
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: watcher.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: target.instanceId,
          actorMinion: cloneMinion(watcher),
          attackDelta,
          healthDelta: healthDelta + gain.attackGainHealth,
          minion: cloneMinion(target),
          retained: gain.retentionMultiplier > 0,
          ...(gain.retentionMultiplier > 0
            ? { retentionMultiplier: gain.retentionMultiplier }
            : {}),
          message: `${rallySourceLabel(component)}在战吼触发后使${target.name}获得+${attackDelta}/+${healthDelta}。`,
        });
      }
    }
  }
}

interface CombatMagnetizationResult {
  attackDelta: number;
  healthDelta: number;
  retentionMultiplier: CombatRetentionMultiplier;
}

function applyCombatMagneticSourceToHost(
  context: CombatContext,
  ownerId: PlayerId,
  magnetic: BoardMinionInstance,
  target: MinionInstance,
  elementalBonus: { attack: number; health: number },
): CombatMagnetizationResult {
  const keywords: CombatBonusKeyword[] = [];
  if (magnetic.divineShield) keywords.push("divineShield");
  if (magnetic.reborn) keywords.push("reborn");
  if (magnetic.stealth) keywords.push("stealth");
  if (magnetic.taunt) keywords.push("taunt");
  if (magnetic.venomous) keywords.push("venomous");
  if (magnetic.windfury) keywords.push("windfury");
  const attack = magnetic.attack + elementalBonus.attack;
  const health = magnetic.health + elementalBonus.health;
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    { attack, health, keywords },
  );
  target.bloodGemAttack += magnetic.bloodGemAttack;
  target.bloodGemHealth += magnetic.bloodGemHealth;
  target.temporaryCrabDeathrattles += magnetic.temporaryCrabDeathrattles;
  target.temporaryGoldenCrabDeathrattles =
    (target.temporaryGoldenCrabDeathrattles ?? 0) +
    (magnetic.temporaryGoldenCrabDeathrattles ?? 0);
  target.crabDeathrattles =
    (target.crabDeathrattles ?? 0) + (magnetic.crabDeathrattles ?? 0);
  target.goldenCrabDeathrattles =
    (target.goldenCrabDeathrattles ?? 0) +
    (magnetic.goldenCrabDeathrattles ?? 0);
  target.poisonous ||= magnetic.poisonous;
  target.cleave ||= magnetic.cleave;
  target.alwaysAttacksLowestAttack ||=
    magnetic.alwaysAttacksLowestAttack;
  if (magnetic.effectSupport === "partial") {
    target.effectSupport = "partial";
  }
  target.attachments.push(
    createMagneticAttachment(magnetic, elementalBonus),
  );
  return {
    attackDelta: attack,
    healthDelta: health + gain.attackGainHealth,
    retentionMultiplier: gain.retentionMultiplier,
  };
}

function copyCombatMagnetizationToBeatboxers(
  context: CombatContext,
  ownerId: PlayerId,
  magnetic: BoardMinionInstance,
  originalTarget: MinionInstance,
  elementalBonus: { attack: number; health: number },
): void {
  const triggers = context.boards[ownerId].flatMap((watcher) => {
    if (
      watcher.health <= 0 ||
      watcher.instanceId === originalTarget.instanceId
    ) {
      return [];
    }
    return minionEffectSources(watcher).flatMap((component) => {
      const effect = getMinionDefinition(
        component.definitionId,
      ).copyOtherMagnetization;
      return effect ? [{ watcher, component, effect }] : [];
    });
  });
  for (const { watcher, component, effect } of triggers) {
    if (watcher.health <= 0) {
      continue;
    }
    const copies =
      effect.copies *
      (component.golden && effect.goldenMode === "doubleCopies" ? 2 : 1);
    for (let copy = 0; copy < copies; copy += 1) {
      const gain = applyCombatMagneticSourceToHost(
        context,
        ownerId,
        magnetic,
        watcher,
        elementalBonus,
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: watcher.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: watcher.instanceId,
        actorMinion: cloneMinion(watcher),
        attackDelta: gain.attackDelta,
        healthDelta: gain.healthDelta,
        minion: cloneMinion(watcher),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${watcher.name}复制了${magnetic.name}的磁力吸附。`,
      });
    }
  }
}

function resolveTriggeredCombatInteractiveBattlecry(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
): void {
  const ability = getMinionDefinition(
    component.definitionId,
  ).interactiveBattlecry;
  if (!ability) {
    return;
  }
  const board = context.boards[ownerId];
  const repetitions =
    component.golden && ability.goldenMode === "repeat" ? 2 : 1;

  if (ability.kind === "makeFriendlyGolden") {
    const targetCount =
      ability.targets *
      (component.golden && ability.goldenMode === "doubleTargets" ? 2 : 1);
    for (let targetIndex = 0; targetIndex < targetCount; targetIndex += 1) {
      const candidates = board.filter(
        (candidate) =>
          candidate.health > 0 &&
          !candidate.golden &&
          getMinionDefinition(candidate.definitionId).tier <=
            ability.maximumTier,
      );
      if (candidates.length === 0) {
        break;
      }
      const target = candidates[randomIndex(context.state, candidates.length)];
      const previousAttack = target.attack;
      const previousHealth = target.health;
      makeMinionGoldenPreservingEnchantments(target);
      reconcileWhereverMinion(
        target,
        context.astralAutomatonsSummoned[ownerId],
        context.eternalKnightsDied[ownerId],
        context.tavernSpellsCast[ownerId],
        context.deathrattlesTriggered[ownerId],
        context.magnetizationsThisGame[ownerId],
      );
      const attackDelta = target.attack - previousAttack;
      const healthDelta = target.health - previousHealth;
      adjustCombatMaximumHealth(
        context,
        ownerId,
        target,
        healthDelta,
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        actorMinion: cloneMinion(source),
        attackDelta,
        healthDelta,
        minion: cloneMinion(target),
        message: `${rallySourceLabel(component)}被触发的战吼使${target.name}变为金色。`,
      });
    }
    return;
  }

  if (ability.kind === "discoverTavernSpell") {
    resolveCombatGainRandomTavernSpell(
      context,
      ownerId,
      source,
      component,
      {
        kind: "gainRandomTavernSpell",
        count: 1,
        filter: {},
        goldenMode: "doubleCount",
      },
      "被触发的战吼",
    );
    return;
  }

  if (ability.kind === "discoverMinion") {
    if (
      ability.requiresOtherTribe &&
      !board.some(
        (candidate) =>
          candidate.health > 0 &&
          candidate.instanceId !== source.instanceId &&
          minionHasTribe(candidate, ability.requiresOtherTribe),
      )
    ) {
      return;
    }
    const owner = persistentCombatOwner(context, ownerId);
    if (!owner) {
      return;
    }
    const sourceLabel = rallySourceLabel(component);
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      if (
        owner.hand.length >= MAX_HAND_SIZE &&
        ability.allowHandOverflow !== true
      ) {
        pushBattleEvent(context.events, {
          type: "cardGain",
          actorPlayerId: ownerId,
          actorInstanceId: source.instanceId,
          targetPlayerId: ownerId,
          amount: 0,
          cardKind: "minion",
          cardGainResult: "handFull",
          message: owner.isHuman
            ? `手牌已满，${sourceLabel}被触发的战吼未能发现随从。`
            : `${sourceLabel}被触发的战吼未能使${owner.name}获得随从。`,
        });
        continue;
      }
      const gained = drawMatchingFromPool(
        context.state,
        owner.tavernTier,
        (definition) => definitionHasTribe(definition, ability.tribe),
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
          message: `${sourceLabel}被触发的战吼没有找到可发现的随从。`,
        });
        continue;
      }
      if (ability.damageHeroByDiscoveredTier) {
        const damage = damageRecruitPlayer(owner, gained.tier);
        pushBattleEvent(context.events, {
          type: "heroDamage",
          actorPlayerId: ownerId,
          actorInstanceId: source.instanceId,
          targetPlayerId: ownerId,
          amount: gained.tier,
          armorAbsorbed: damage.armorAbsorbed,
          healthDamage: damage.healthDamage,
          message: `${sourceLabel}被触发的战吼对${owner.name}造成了${gained.tier}点伤害。`,
        });
      }
      if (owner.hand.length >= MAX_HAND_SIZE) {
        returnMinionToPool(context.state, gained);
        pushBattleEvent(context.events, {
          type: "cardGain",
          actorPlayerId: ownerId,
          actorInstanceId: source.instanceId,
          targetPlayerId: ownerId,
          amount: 0,
          cardKind: "minion",
          cardGainResult: "handFull",
          message: owner.isHuman
            ? `手牌已满，发现的「${gained.name}」被弃掉。`
            : `${owner.name}的手牌已满，发现的随从被弃掉。`,
        });
        continue;
      }
      claimGeneratedShopMinion(gained);
      applyOwnedUndeadArmyBonus(owner, gained);
      applyOwnedBeetleBonus(owner, gained);
      reconcileWhereverMinion(
        gained,
        owner.astralAutomatonsSummoned ?? 0,
        owner.eternalKnightsDied ?? 0,
        owner.tavernSpellsCast ?? 0,
        owner.deathrattlesTriggered ?? 0,
        owner.magnetizationsThisGame ?? 0,
      );
      const snapshot = cloneMinion(gained);
      addCardToHand(context.state, owner, gained, {
        combatContext: context,
        combatOwnerId: ownerId,
        combatEvent: {
          type: "cardGain",
          actorPlayerId: ownerId,
          actorInstanceId: source.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: owner.isHuman ? gained.instanceId : undefined,
          amount: 1,
          minion: owner.isHuman ? snapshot : undefined,
          cardKind: "minion",
          cardGainResult: "added",
          message: owner.isHuman
            ? `${sourceLabel}被触发的战吼使你获得了「${gained.name}」。`
            : `${sourceLabel}被触发的战吼使${owner.name}获得了一张随从牌。`,
        },
      });
      resolveTriples(context.state, owner, context);
    }
    return;
  }

  if (ability.kind === "destroyFriendlyAndCopy") {
    const candidates = board.filter(
      (candidate) =>
        candidate.health > 0 &&
        candidate.instanceId !== source.instanceId &&
        minionHasTribe(candidate, ability.targetTribe),
    );
    if (candidates.length === 0) {
      return;
    }
    const target = candidates[randomIndex(context.state, candidates.length)];
    const copies =
      ability.copies *
      (component.golden && ability.goldenMode === "doubleCopies" ? 2 : 1);
    const owner = persistentCombatOwner(context, ownerId);
    const gained = owner
      ? gainPlainMinionCopies(
          context.state,
          owner,
          target.definitionId,
          copies,
        )
      : 0;
    target.health = 0;
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      actorMinion: cloneMinion(source),
      minion: cloneMinion(target),
      amount: gained,
      message: `${rallySourceLabel(component)}被触发的战吼消灭了${target.name}${gained > 0 ? `，并使其拥有者获得${gained}张原始版复制` : ""}。`,
    });
    return;
  }

  if (ability.kind === "targetedDiscoverMagnetize") {
    const candidates = board.filter(
      (candidate) =>
        candidate.health > 0 &&
        candidate.instanceId !== source.instanceId &&
        minionHasTribe(candidate, ability.targetTribe),
    );
    if (candidates.length === 0) {
      return;
    }
    const target = candidates[randomIndex(context.state, candidates.length)];
    const owner = findPlayer(context.state, ownerId);
    if (!owner) {
      return;
    }
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      const magnetic = drawMatchingFromPool(
        context.state,
        owner.tavernTier,
        (definition) =>
          definitionHasTribe(definition, ability.discoverTribe) &&
          definition.magnetic !== undefined,
      );
      if (!magnetic) {
        continue;
      }
      const elementalBonus = definitionHasTribe(
        getMinionDefinition(magnetic.definitionId),
        "elemental",
      )
        ? context.elementalGrantBonuses[ownerId]
        : { attack: 0, health: 0 };
      const gain = applyCombatMagneticSourceToHost(
        context,
        ownerId,
        magnetic,
        target,
        elementalBonus,
      );
      returnMinionToPool(context.state, magnetic);
      context.magnetizationsThisGame[ownerId] += 1;
      const persistentOwner = persistentCombatOwner(context, ownerId);
      if (persistentOwner) {
        persistentOwner.magnetizationsThisGame += 1;
      }
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        actorMinion: cloneMinion(source),
        attackDelta: gain.attackDelta,
        healthDelta: gain.healthDelta,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${rallySourceLabel(component)}被触发的战吼将${magnetic.name}磁力吸附到了${target.name}。`,
      });
      copyCombatMagnetizationToBeatboxers(
        context,
        ownerId,
        magnetic,
        target,
        elementalBonus,
      );
    }
    return;
  }

  const candidates =
    ability.target === "friendlyTribe"
      ? board.filter(
          (candidate) =>
            candidate.health > 0 &&
            minionHasTribe(candidate, ability.targetTribe),
        )
      : board.filter(
          (candidate) =>
            candidate.health > 0 &&
            candidate.instanceId !== source.instanceId,
        );
  if (candidates.length === 0) {
    return;
  }
  const target = candidates[randomIndex(context.state, candidates.length)];
  const owner = findPlayer(context.state, ownerId);
  const health =
    ability.health +
    ability.healthPerTavernSpell * (owner?.tavernSpellsCastThisTurn ?? 0) +
    (ability.healthPerGoldSpentThisTurn ?? 0) *
      (owner?.goldSpentThisTurn ?? 0);
  const attack =
    ability.attack +
    ability.attackPerTavernSpell * (owner?.tavernSpellsCastThisTurn ?? 0) +
    (ability.attackPerGoldSpentThisTurn ?? 0) *
      (owner?.goldSpentThisTurn ?? 0) +
    (component.definitionId === LOVESICK_BALLADIST_DEFINITION_ID &&
    owner &&
    playerHasTrinketCardId(owner, BALLADIST_PORTRAIT_CARD_ID)
      ? health
      : 0);
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    pushCombatBattlecryBuff(
      context,
      ownerId,
      source,
      target,
      attack,
      health,
      false,
    );
  }
}

function resolveCombatBattlecry(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  triggerActor: MinionInstance,
): void {
  const triggerCount = combatBattlecryTriggerCount(
    context.boards[ownerId],
  );
  const persistentOwner = persistentCombatOwner(context, ownerId);
  if (persistentOwner) {
    recordBattlecriesTriggered(persistentOwner, triggerCount);
  }
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: triggerActor.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: source.instanceId,
    minion: cloneMinion(source),
    amount: triggerCount,
    message: `${triggerActor.name}触发了${source.name}的战吼${
      triggerCount > 1 ? `，共${triggerCount}次` : ""
    }。`,
  });
  for (let trigger = 0; trigger < triggerCount; trigger += 1) {
    for (const component of minionEffectSources(source)) {
      const definition = getMinionDefinition(component.definitionId);
      const effects = definition.battlecry ?? [];
      for (const effect of effects) {
        resolveCombatBattlecryEffect(
          context,
          ownerId,
          source,
          component,
          effect,
        );
      }
      resolveTriggeredCombatInteractiveBattlecry(
        context,
        ownerId,
        source,
        component,
      );
    }
    observeCombatBattlecryTriggered(context, ownerId);
  }
}

function resolveCombatTriggerAdjacentBattlecries(
  context: CombatContext,
  death: DeadMinion,
  component: MinionEffectSource,
  effect: TriggerAdjacentBattlecriesEffect,
): void {
  const eligible = combatDeathrattleAdjacentTargets(context, death).filter(
    minionHasPrintedBattlecry,
  );
  const targets =
    component.golden && effect.goldenMode === "allAdjacent"
      ? eligible
      : eligible.length > 0
        ? [eligible[randomIndex(context.state, eligible.length)]]
        : [];
  for (const target of targets) {
    resolveCombatBattlecry(
      context,
      death.ownerId,
      target,
      death.minion,
    );
  }
}

function resolveCombatCastTavernSpellOnAdjacent(
  context: CombatContext,
  death: DeadMinion,
  component: MinionEffectSource,
  effect: CastTavernSpellOnAdjacentEffect,
): void {
  const ownerId = death.ownerId;
  const source = death.minion;
  const adjacent = combatDeathrattleAdjacentTargets(context, death);
  const targets =
    component.golden && effect.goldenMode === "allAdjacent"
      ? adjacent
      : adjacent.length > 0
        ? [adjacent[randomIndex(context.state, adjacent.length)]]
        : [];
  const definition = getTavernSpellDefinition(effect.definitionId);

  for (const target of targets) {
    const castCount =
      friendlyTargetSpellCastMultiplier(context.boards[ownerId]) *
      combatTavernSpellCastMultiplier(context, ownerId);
    for (let cast = 0; cast < castCount; cast += 1) {
      const aura = tavernSpellAuraBonus(context.boards[ownerId]);
      const owner = findPlayer(context.state, ownerId);
      const heroBonus =
        context.ghostOwnerId === ownerId
          ? 0
          : heroTavernSpellBuffBonus(owner);
      const attackBonus =
        (owner?.tavernSpellAttackBonus ?? 0) + aura.attack + heroBonus;
      const healthBonus =
        (owner?.tavernSpellHealthBonus ?? 0) + aura.health + heroBonus;
      pushBattleEvent(context.events, {
        type: "tavernSpellCast",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        cardName: definition.name,
        cardKind: "tavernSpell",
        message: `${rallySourceLabel(component)}的亡语对${target.name}施放了「${definition.name}」${
          castCount > 1 ? `（第${cast + 1}次）` : ""
        }。`,
      });
      const pulses = tavernSpellTargetBuffPulses(
        definition.effect,
        target,
      );
      if (!pulses) {
        throw new Error(
          `Combat-triggered targeted Tavern Spell ${definition.id} is not supported`,
        );
      }
      for (const pulse of pulses) {
        pushCombatSpellBuff(
          context,
          ownerId,
          source,
          target,
          pulse.attack + attackBonus,
          pulse.health + healthBonus,
          `${definition.name}使${target.name}获得+${
            pulse.attack + attackBonus
          }/+${pulse.health + healthBonus}。`,
        );
      }
      pushCombatTargetedSpellCastTriggerEvent(
        context,
        ownerId,
        source.instanceId,
        target,
        applyTargetedSpellCastTrigger(target),
      );
      triggerCombatAfterTavernSpellCast(
        context,
        ownerId,
        source.instanceId,
        definition.id,
      );
    }
  }
}

function resolveCombatSummonRandomMinion(
  context: CombatContext,
  death: DeadMinion,
  component: MinionEffectSource,
  effect: SummonRandomMinionEffect,
): void {
  const candidates = generatedMinionDefinitions(context.state, effect);
  if (candidates.length === 0) {
    return;
  }
  if (rejectCombatSummonForFullBoard(context, death.ownerId)) {
    return;
  }
  const definition = candidates[randomIndex(context.state, candidates.length)];
  const summoned = createMinionInstance(context.state, definition.id, 0);
  const statScale =
    component.golden && effect.goldenMode === "doubleSetStats" ? 2 : 1;
  summoned.attack = effect.setAttack * statScale;
  summoned.health = effect.setHealth * statScale;
  summoned.whereverAttackBonus = 0;
  summoned.whereverHealthBonus = 0;
  applyCurrentBeetleBonus(context, death.ownerId, summoned);
  insertCombatMinion(
    context,
    death.ownerId,
    summoned,
    death.index,
    death.minion,
    `${rallySourceLabel(component)}召唤了${summoned.name}，并将其属性值变为${summoned.attack}/${summoned.health}。`,
  );
}

function resolveCombatBuffThenDamageFriendly(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: BuffThenDamageFriendlyEffect,
): void {
  const pulses =
    Math.max(1, Math.floor(effect.pulses ?? 1)) *
    (component.golden && effect.goldenMode === "repeat" ? 2 : 1);
  for (let pulse = 0; pulse < pulses; pulse += 1) {
    const targets = context.boards[ownerId].filter(
      (candidate) =>
        candidate.health > 0 &&
        (!effect.otherOnly ||
          candidate.instanceId !== source.instanceId) &&
        (!effect.tribes ||
          effect.tribes.some((tribe) =>
            minionHasTribe(candidate, tribe),
          )),
    );
    for (const target of targets) {
      const gain = applyCombatEnchantingGain(
        context,
        ownerId,
        target,
        { attack: effect.attack, health: effect.health },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta: effect.attack,
        healthDelta: effect.health + gain.attackGainHealth,
        minion: cloneMinion(target),
        retained: gain.retentionMultiplier > 0,
        ...(gain.retentionMultiplier > 0
          ? { retentionMultiplier: gain.retentionMultiplier }
          : {}),
        message: `${rallySourceLabel(component)}的亡语使${target.name}获得+${effect.attack}/+${effect.health}${
          pulses > 1 ? `（第${pulse + 1}次）` : ""
        }。`,
      });
    }

    const observations: CombatDamageObservation[] = [];
    for (const target of targets) {
      const observation = dealCombatDamage(
        context,
        ownerId,
        source,
        ownerId,
        target,
        effect.damage,
        false,
        true,
        false,
      );
      if (observation) {
        observations.push(observation);
      }
    }
    triggerDeferredDamageObservers(context, observations);
    resolveCombatDeaths(context);
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

function triggerCombatAfterSpellCast(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const board = context.boards[ownerId];
  for (const source of [...board]) {
    if (source.health <= 0) {
      continue;
    }
    for (const component of minionEffectSources(source)) {
      const effect = getMinionDefinition(
        component.definitionId,
      ).afterSpellCast;
      if (!effect) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      for (const target of board.filter((candidate) => candidate.health > 0)) {
        pushCombatSpellBuff(
          context,
          ownerId,
          source,
          target,
          effect.attack * scale,
          effect.health * scale,
          `${source.name}响应施法，使${target.name}获得+${effect.attack * scale}/+${effect.health * scale}。`,
        );
      }
    }
  }

  const ribbon = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.bewitchedRibbon,
  );
  if (!ribbon) {
    return;
  }
  for (const target of board.filter((candidate) => candidate.health > 0)) {
    const gain = applyExplicitPermanentCombatStatGain(
      context,
      ownerId,
      target,
      { attack: 2, health: 2 },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: ribbon.id,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta: 2,
      healthDelta: 2 + gain.attackGainHealth,
      minion: cloneMinion(target),
      retained: gain.persisted,
      ...(gain.persisted ? { retentionMultiplier: 1 } : {}),
      message: `${ribbon.name}响应施法，使${target.name}永久获得+2/+2。`,
    });
  }
}

function recordCombatTavernSpellCast(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
): void {
  context.tavernSpellsCast[ownerId] =
    (context.tavernSpellsCast[ownerId] ?? 0) + 1;
  const owner = persistentCombatOwner(context, ownerId);
  if (owner) {
    owner.tavernSpellsCast = context.tavernSpellsCast[ownerId];
    reconcileOwnedWhereverMinions(owner);
  }
  reconcileCombatWhereverMinions(
    context,
    ownerId,
    actorInstanceId,
    "酒馆法术使深渊打手的本局属性成长。",
  );
  triggerCombatAfterSpellCast(context, ownerId);
}

function triggerCombatAfterTavernSpellCast(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
  tavernSpellDefinitionId: string,
): void {
  recordCombatTavernSpellCast(context, ownerId, actorInstanceId);
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
          const portraitBonus =
            component.definitionId === "BG28_551" &&
            combatTrinketByCardId(
              context,
              ownerId,
              REDEEMER_PORTRAIT_CARD_ID,
            )
              ? 4
              : 0;
          for (const target of selectDistinctMinionsByTribe(
            context.state,
            board,
          )) {
            pushCombatSpellBuff(
              context,
              ownerId,
              source,
              target,
              (effect.attack + portraitBonus) * scale,
              (effect.health + portraitBonus) * scale,
              `${source.name}响应酒馆法术，使${target.name}获得+${(effect.attack + portraitBonus) * scale}/+${(effect.health + portraitBonus) * scale}。`,
            );
          }
          continue;
        }
        if (effect.kind === "buffKeyword") {
          const portraitHealth =
            component.definitionId === CHARGING_CZARINA_DEFINITION_ID &&
            combatTrinketByCardId(
              context,
              ownerId,
              CZARINA_PORTRAIT_CARD_ID,
            )
              ? effect.attack
              : 0;
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
              (effect.health + portraitHealth) * scale,
              `${source.name}响应酒馆法术，使${target.name}获得+${effect.attack * scale}/+${(effect.health + portraitHealth) * scale}。`,
            );
          }
        }
      }
    }
  }
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  for (const portrait of playerTrinkets(owner).filter(
    (trinket) => trinket.cardId === TIDE_RAISER_PORTRAIT_CARD_ID,
  )) {
    const copiesMade = trinketCombatCounter(
      context,
      ownerId,
      portrait,
      "tavernSpellCopies",
    );
    if (copiesMade >= 3) {
      continue;
    }
    setTrinketCombatCounter(
      context,
      ownerId,
      portrait,
      "tavernSpellCopies",
      copiesMade + 1,
    );
    const copied = addGeneratedTavernSpellToHand(
      context.state,
      owner,
      tavernSpellDefinitionId,
    );
    const copiedDefinition = getTavernSpellDefinition(
      tavernSpellDefinitionId,
    );
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: portrait.id,
      targetPlayerId: ownerId,
      amount: copied ? 1 : 0,
      cardName: copied ? copiedDefinition.name : undefined,
      cardGainResult: copied ? "added" : "handFull",
      message: copied
        ? `${portrait.name}复制了「${copiedDefinition.name}」。`
        : `手牌已满，${portrait.name}未能复制「${copiedDefinition.name}」。`,
    });
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
    combatTavernSpellCastMultiplier(context, ownerId) *
    friendlyTargetSpellCastMultiplier(context.boards[ownerId]);
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
      triggerCombatAfterTavernSpellCast(
        context,
        ownerId,
        attacker.instanceId,
        definition.id,
      );
      continue;
    }
    const gained = drawMatchingFromPool(
      context.state,
      owner.tavernTier,
      (candidate) => chefsChoiceMatches(candidate, target),
    );
    if (!gained) {
      addConsolationCoin(context.state, owner, {
        combatContext: context,
        combatOwnerId: ownerId,
        combatEvent: {
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
        },
      });
      triggerCombatAfterTavernSpellCast(
        context,
        ownerId,
        attacker.instanceId,
        definition.id,
      );
      continue;
    }
    applyOwnedUndeadArmyBonus(owner, gained);
    applyOwnedBeetleBonus(owner, gained);
    reconcileWhereverMinion(
      gained,
      owner.astralAutomatonsSummoned ?? 0,
      owner.eternalKnightsDied ?? 0,
      owner.tavernSpellsCast ?? 0,
      owner.deathrattlesTriggered ?? 0,
      owner.magnetizationsThisGame ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    addCardToHand(context.state, owner, gained, {
      combatContext: context,
      combatOwnerId: ownerId,
      combatEvent: {
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
      },
    });
    resolveTriples(context.state, owner, context);
    triggerCombatAfterTavernSpellCast(
      context,
      ownerId,
      attacker.instanceId,
      definition.id,
    );
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
          healthDelta: healthDelta + gain.attackGainHealth,
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

function resolveRallyBuffOneFriendlyPerTribe(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallyBuffOneFriendlyPerTribeEffect,
): void {
  const repetitions =
    component.golden && effect.goldenMode === "repeat" ? 2 : 1;
  const sourceLabel = rallySourceLabel(component);
  for (
    let repetition = 0;
    repetition < repetitions;
    repetition += 1
  ) {
    const selected = selectDistinctMinionsByTribe(
      context.state,
      context.boards[ownerId].filter((minion) => minion.health > 0),
    );
    for (const target of selected) {
      const gain = applyExplicitPermanentCombatStatGain(
        context,
        ownerId,
        target,
        { attack: effect.attack, health: effect.health },
      );
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        actorMinion: cloneMinion(attacker),
        attackDelta: effect.attack,
        healthDelta: effect.health + gain.attackGainHealth,
        minion: cloneMinion(target),
        retained: gain.persisted,
        ...(gain.persisted ? { retentionMultiplier: 1 } : {}),
        message: `${sourceLabel}的进击使${target.name}永久获得+${effect.attack}/+${effect.health}${
          repetitions > 1 ? `（第${repetition + 1}次）` : ""
        }。`,
      });
    }
  }
}

function resolveRallyDamageTargetAndAdjacent(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  attackTarget: MinionInstance,
  component: MinionEffectSource,
  effect: RallyDamageTargetAndAdjacentEffect,
): void {
  const targetOwnerId = opponentId(context, ownerId);
  const enemyBoard = context.boards[targetOwnerId];
  const targetIndex = enemyBoard.findIndex(
    (minion) => minion.instanceId === attackTarget.instanceId,
  );
  if (targetIndex < 0 || attackTarget.health <= 0) {
    return;
  }

  const adjacent = [
    enemyBoard[targetIndex - 1],
    enemyBoard[targetIndex + 1],
  ].filter(
    (minion): minion is MinionInstance =>
      minion !== undefined && minion.health > 0,
  );
  const adjacentTargets =
    component.golden && effect.goldenMode === "bothAdjacent"
      ? adjacent
      : randomBoardSubset(context.state, adjacent, 1);
  const targets = [attackTarget, ...adjacentTargets];
  const damage = attacker.attack;
  const sourceLabel = rallySourceLabel(component);

  for (const target of targets) {
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: attacker.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: target.instanceId,
      actorMinion: cloneMinion(attacker),
      minion: cloneMinion(target),
      amount: damage,
      message: `${sourceLabel}的进击将对${target.name}造成${damage}点伤害。`,
    });
  }

  const observations: CombatDamageObservation[] = [];
  for (const target of targets) {
    const observation = dealCombatDamage(
      context,
      ownerId,
      attacker,
      targetOwnerId,
      target,
      damage,
      attacker.poisonous,
      true,
    );
    if (observation) {
      observations.push(observation);
    }
  }
  triggerDeferredDamageObservers(context, observations);
  resolveCombatDeaths(context);
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

      if (effect.kind === "buffOneFriendlyPerTribe") {
        resolveRallyBuffOneFriendlyPerTribe(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "damageTargetAndAdjacent") {
        resolveRallyDamageTargetAndAdjacent(
          context,
          ownerId,
          attacker,
          attackTarget,
          component,
          effect,
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
        healthDelta: healthDelta + gain.attackGainHealth,
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
  triggerCombatAttackTrinkets(context, ownerId, attacker);
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

function resolveCombatGainLinkedRandomMinion(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GainLinkedRandomMinionEffect,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const sourceLabel = rallySourceLabel(component);
  const sourceLineage = deathlyStrikerSourceLineage(
    source,
    component,
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
        cardKind: "minion",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}的复仇未能使你获得亡灵牌。`
          : `${sourceLabel}的复仇未能使${owner.name}获得亡灵牌。`,
      });
      continue;
    }
    const gained = drawMatchingFromPool(
      context.state,
      owner.tavernTier,
      (definition) => definitionHasTribe(definition, effect.tribe),
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
          ? `当前共享池中没有可由${sourceLabel}的复仇获取的亡灵牌。`
          : `${sourceLabel}的复仇没有找到可获取的亡灵牌。`,
      });
      continue;
    }
    gained.deathlyStrikerCreatorIds = [
      ...new Set([
        ...(gained.deathlyStrikerCreatorIds ?? []),
        ...sourceLineage,
      ]),
    ];
    applyOwnedUndeadArmyBonus(owner, gained);
    applyOwnedBeetleBonus(owner, gained);
    reconcileWhereverMinion(
      gained,
      owner.astralAutomatonsSummoned ?? 0,
      owner.eternalKnightsDied ?? 0,
      owner.tavernSpellsCast ?? 0,
      owner.deathrattlesTriggered ?? 0,
      owner.magnetizationsThisGame ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    addCardToHand(context.state, owner, gained, {
      combatContext: context,
      combatOwnerId: ownerId,
      combatEvent: {
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
          ? `${sourceLabel}的复仇使你获得了「${gained.name}」。`
          : `${sourceLabel}的复仇使${owner.name}获得了一张亡灵牌。`,
      },
    });
    resolveTriples(context.state, owner, context);
  }
}

function resolveCombatAvengeEffect(
  context: CombatContext,
  ownerId: PlayerId,
  watcher: MinionInstance,
  component: MinionEffectSource,
  effect: AvengeEffect,
): void {
  if (effect.kind === "gainLinkedRandomMinion") {
    resolveCombatGainLinkedRandomMinion(
      context,
      ownerId,
      watcher,
      component,
      effect,
    );
    return;
  }
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

function advanceStaffOfTheScourge(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const staff = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.staffOfTheScourge,
  );
  if (!staff) {
    return;
  }
  const progress =
    trinketCombatCounter(context, ownerId, staff, "avenge") + 1;
  if (progress < 5) {
    setTrinketCombatCounter(
      context,
      ownerId,
      staff,
      "avenge",
      progress,
    );
    return;
  }
  setTrinketCombatCounter(
    context,
    ownerId,
    staff,
    "avenge",
    progress - 5,
  );
  pushBattleEvent(context.events, {
    type: "avenge",
    actorPlayerId: ownerId,
    actorInstanceId: staff.id,
    targetPlayerId: ownerId,
    message: `${staff.name}触发了复仇（5）。`,
  });
  const candidates = context.boards[ownerId].filter(
    (minion) =>
      minion.health > 0 &&
      minionHasTribe(minion, "undead") &&
      !minion.reborn,
  );
  if (candidates.length === 0) {
    return;
  }
  const target = candidates[randomIndex(context.state, candidates.length)];
  const gain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    { keywords: ["reborn"] },
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: staff.id,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: 0,
    healthDelta: 0,
    minion: cloneMinion(target),
    retained: gain.retentionMultiplier > 0,
    ...(gain.retentionMultiplier > 0
      ? { retentionMultiplier: gain.retentionMultiplier }
      : {}),
    message: `${staff.name}随机使${target.name}获得复生。`,
  });
}

function advanceTrinketDeathThreshold(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  counter: string,
  threshold: number,
  eventType: "avenge" | "trigger",
): boolean {
  const progress =
    trinketCombatCounter(context, ownerId, trinket, counter) + 1;
  if (progress < threshold) {
    setTrinketCombatCounter(
      context,
      ownerId,
      trinket,
      counter,
      progress,
    );
    return false;
  }

  // Reset before the payload. Summons and damage can synchronously produce a
  // new death wave, which must begin the next cycle rather than be discarded.
  setTrinketCombatCounter(
    context,
    ownerId,
    trinket,
    counter,
    progress - threshold,
  );
  if (eventType === "avenge") {
    pushBattleEvent(context.events, {
      type: "avenge",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      message: `${trinket.name}触发了复仇（${threshold}）。`,
    });
  } else {
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      message: `${trinket.name}在${threshold}个友方随从死亡后触发。`,
    });
  }
  return true;
}

function gainRandomGeneratedMinionFromTrinket(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  matches: (
    definition: (typeof MINION_DEFINITIONS)[number],
    owner: PlayerState,
  ) => boolean,
  rewardDescription: string,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  if (owner.hand.length >= MAX_HAND_SIZE) {
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      amount: 0,
      cardKind: "minion",
      cardGainResult: "handFull",
      message: owner.isHuman
        ? `手牌已满，${trinket.name}未能使你获得${rewardDescription}。`
        : `${trinket.name}未能使${owner.name}获得${rewardDescription}。`,
    });
    return;
  }

  const candidates = MINION_DEFINITIONS.filter(
    (definition) =>
      definitionIsAvailable(definition, context.state.activeTribes) &&
      matches(definition, owner),
  );
  if (candidates.length === 0) {
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      amount: 0,
      cardKind: "minion",
      cardGainResult: "noCandidate",
      message: `${trinket.name}没有找到可获取的${rewardDescription}。`,
    });
    return;
  }

  const definition =
    candidates[randomIndex(context.state, candidates.length)];
  const gained = createMinionInstance(context.state, definition.id, 0);
  applyOwnedUndeadArmyBonus(owner, gained);
  applyOwnedBeetleBonus(owner, gained);
  reconcileWhereverMinion(
    gained,
    owner.astralAutomatonsSummoned ?? 0,
    owner.eternalKnightsDied ?? 0,
    owner.tavernSpellsCast ?? 0,
    owner.deathrattlesTriggered ?? 0,
    owner.magnetizationsThisGame ?? 0,
  );
  const gainedSnapshot = cloneMinion(gained);
  addCardToHand(context.state, owner, gained, {
    combatContext: context,
    combatOwnerId: ownerId,
    combatEvent: {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman ? gained.instanceId : undefined,
      amount: 1,
      minion: owner.isHuman ? gainedSnapshot : undefined,
      cardKind: "minion",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${trinket.name}使你获得了「${gained.name}」。`
        : `${trinket.name}使${owner.name}获得了一张${rewardDescription}。`,
    },
  });
  resolveTriples(context.state, owner, context);
}

function gainRandomTavernSpellFromTrinket(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  if (owner.hand.length >= MAX_HAND_SIZE) {
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      amount: 0,
      cardKind: "tavernSpell",
      cardGainResult: "handFull",
      message: owner.isHuman
        ? `手牌已满，${trinket.name}未能使你获得随机酒馆法术。`
        : `${trinket.name}未能使${owner.name}获得一张酒馆法术。`,
    });
    return;
  }
  const definition = randomGeneratedTavernSpellDefinition(
    context.state,
    { kind: "gainRandomTavernSpell", count: 1, filter: {} },
  );
  if (!definition) {
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      amount: 0,
      cardKind: "tavernSpell",
      cardGainResult: "noCandidate",
      message: `${trinket.name}没有找到可获取的酒馆法术。`,
    });
    return;
  }
  const gained = createTavernSpell(context.state, definition);
  addCardToHand(context.state, owner, gained, {
    combatContext: context,
    combatOwnerId: ownerId,
    combatEvent: {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman ? gained.instanceId : undefined,
      amount: 1,
      cardName: owner.isHuman ? gained.name : undefined,
      cardKind: "tavernSpell",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${trinket.name}使你获得了「${gained.name}」。`
        : `${trinket.name}使${owner.name}获得了一张酒馆法术。`,
    },
  });
}

function improveBloodGemsFromTrinket(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  attack: number,
  health: number,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  owner.bloodGemAttack += attack;
  owner.bloodGemHealth += health;
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    attackDelta: 0,
    healthDelta: 0,
    permanentEffectImprovement: true,
    message: `${trinket.name}使鲜血宝石在本局对战中永久获得+${attack}/+${health}。`,
  });
}

function summonBeetlesFromTrinket(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    if (rejectCombatSummonForFullBoard(context, ownerId)) {
      continue;
    }
    const beetle = createMinionInstance(
      context.state,
      BEETLE_TOKEN_DEFINITION_ID,
      0,
    );
    applyCurrentBeetleBonus(context, ownerId, beetle);
    beetle.taunt = true;
    insertCombatMinion(
      context,
      ownerId,
      beetle,
      context.boards[ownerId].length,
      beetle,
      `${trinket.name}召唤了${beetle.name}。`,
    );
  }
}

function summonBloodGolemFromTrinket(
  context: CombatContext,
  death: DeadMinion,
  trinket: TrinketDefinition,
): void {
  const ownerId = death.ownerId;
  if (rejectCombatSummonForFullBoard(context, ownerId)) {
    return;
  }
  const golem = createMinionInstance(
    context.state,
    "BG30_MagicItem_442t",
    0,
  );
  golem.attack = Math.max(1, death.minion.bloodGemAttack);
  golem.health = Math.max(1, death.minion.bloodGemHealth);
  insertCombatMinion(
    context,
    ownerId,
    golem,
    death.index,
    death.minion,
    `${trinket.name}召唤了${golem.attack}/${golem.health}的鲜血魔像。`,
  );
}

function dealFriendlyTrinketDamage(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
  target: MinionInstance,
  amount: number,
): CombatDamageObservation | null {
  if (amount <= 0 || target.health <= 0) {
    return null;
  }
  const conditionalGain = applyCombatEnchantingGain(
    context,
    ownerId,
    target,
    {},
  );
  if (conditionalGain.gainedKeywords.includes("divineShield")) {
    const threshold =
      getMinionDefinition(target.definitionId).conditionalKeyword
        ?.attackAtLeast ?? target.attack;
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: target.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      retained: conditionalGain.retentionMultiplier > 0,
      ...(conditionalGain.retentionMultiplier > 0
        ? { retentionMultiplier: conditionalGain.retentionMultiplier }
        : {}),
      message: `${target.name}达到${threshold}点攻击力，获得圣盾。`,
    });
  }
  if (target.divineShield) {
    target.divineShield = false;
    pushBattleEvent(context.events, {
      type: "shieldBroken",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      message: `${trinket.name}造成的伤害击破了${target.name}的圣盾。`,
    });
    return null;
  }

  target.health -= amount;
  if (target.health <= 0) {
    // A Trinket is not a minion and therefore cannot be Leeroy's killer.
    delete context.lethalDamageSources[ownerId][target.instanceId];
  }
  const snapshot = cloneMinion(target);
  snapshot.health = Math.max(0, snapshot.health);
  pushBattleEvent(context.events, {
    type: "damage",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    amount,
    minion: snapshot,
    message: `${trinket.name}对${target.name}造成${amount}点伤害，剩余${snapshot.health}点生命。`,
  });
  const observation = captureCombatDamageObservation(
    context,
    ownerId,
    target,
    ownerId,
    target,
  );
  return {
    ...observation,
    // The Trinket dealt the damage, so minion damage-dealt listeners do not
    // observe the temporary target used to capture friendly-damaged listeners.
    friendlyDamageDealtObservers: [],
  };
}

function resolveGilneanThornedRose(
  context: CombatContext,
  ownerId: PlayerId,
  trinket: TrinketDefinition,
): void {
  const targets = context.boards[ownerId].filter(
    (minion) => minion.health > 0,
  );
  for (const target of targets) {
    const gain = applyExplicitPermanentCombatStatGain(
      context,
      ownerId,
      target,
      { attack: 4, health: 5 },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta: 4,
      healthDelta: 5 + gain.attackGainHealth,
      minion: cloneMinion(target),
      retained: gain.persisted,
      ...(gain.persisted ? { retentionMultiplier: 1 } : {}),
      message: `${trinket.name}使${target.name}永久获得+4/+5。`,
    });
  }

  const observations = targets
    .map((target) =>
      dealFriendlyTrinketDamage(
        context,
        ownerId,
        trinket,
        target,
        1,
      ),
    )
    .filter(
      (observation): observation is CombatDamageObservation =>
        observation !== null,
    );
  triggerDeferredDamageObservers(context, observations);
  resolveCombatDeaths(context);
}

function advanceCombatDeathTrinkets(
  context: CombatContext,
  death: DeadMinion,
): void {
  const ownerId = death.ownerId;
  const bloodGolemSticker = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.bloodGolemSticker,
  );
  if (
    bloodGolemSticker &&
    minionHasTribe(death.minion, "quilboar")
  ) {
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: bloodGolemSticker.id,
      targetPlayerId: ownerId,
      targetInstanceId: death.minion.instanceId,
      minion: cloneMinion(death.minion),
      message: `${bloodGolemSticker.name}响应了${death.minion.name}的死亡。`,
    });
    summonBloodGolemFromTrinket(context, death, bloodGolemSticker);
  }
  const wickedTome = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.wickedTome,
  );
  if (
    wickedTome &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      wickedTome,
      "avenge",
      4,
      "avenge",
    )
  ) {
    const owner = persistentCombatOwner(context, ownerId);
    if (owner) {
      owner.tavernSpellAttackBonus += 1;
      owner.tavernSpellHealthBonus += 1;
    }
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: wickedTome.id,
      targetPlayerId: ownerId,
      attackDelta: 1,
      healthDelta: 1,
      permanentEffectImprovement: owner !== undefined,
      message: `${wickedTome.name}使你的酒馆法术在本局对战中额外提供+1/+1。`,
    });
  }

  const scrapsmithPortrait = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.scrapsmithPortrait,
  );
  if (scrapsmithPortrait && death.minion.taunt) {
    const scrapsmiths = context.boards[ownerId].filter(
      (minion) =>
        minion.health > 0 && minionHasEffectSource(minion, "BG24_707"),
    );
    if (scrapsmiths.length > 0) {
      pushBattleEvent(context.events, {
        type: "trigger",
        actorPlayerId: ownerId,
        actorInstanceId: scrapsmithPortrait.id,
        targetPlayerId: ownerId,
        targetInstanceId: death.minion.instanceId,
        minion: cloneMinion(death.minion),
        message: `${scrapsmithPortrait.name}在友方嘲讽随从死亡后触发。`,
      });
      for (const target of scrapsmiths) {
        applyPermanentCombatBloodGemFromTrinket(
          context,
          ownerId,
          scrapsmithPortrait,
          target,
        );
      }
    }
  }

  const eye = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.eyeOfDalaran,
  );
  if (eye && death.minion.tribes.length === 0) {
    pushBattleEvent(context.events, {
      type: "trigger",
      actorPlayerId: ownerId,
      actorInstanceId: eye.id,
      targetPlayerId: ownerId,
      targetInstanceId: death.minion.instanceId,
      minion: cloneMinion(death.minion),
      message: `${eye.name}响应了没有类型的${death.minion.name}死亡。`,
    });
    gainRandomTavernSpellFromTrinket(context, ownerId, eye);
  }

  const lesserQuilligraphy = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.lesserQuilligraphySet,
  );
  if (
    lesserQuilligraphy &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      lesserQuilligraphy,
      "avenge",
      3,
      "avenge",
    )
  ) {
    improveBloodGemsFromTrinket(
      context,
      ownerId,
      lesserQuilligraphy,
      0,
      1,
    );
  }

  const greaterQuilligraphy = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.greaterQuilligraphySet,
  );
  if (
    greaterQuilligraphy &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      greaterQuilligraphy,
      "avenge",
      4,
      "avenge",
    )
  ) {
    improveBloodGemsFromTrinket(
      context,
      ownerId,
      greaterQuilligraphy,
      1,
      1,
    );
  }

  const fridgeMagnet = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.fridgeMagnet,
  );
  if (
    fridgeMagnet &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      fridgeMagnet,
      "avenge",
      3,
      "avenge",
    )
  ) {
    gainRandomGeneratedMinionFromTrinket(
      context,
      ownerId,
      fridgeMagnet,
      (definition, owner) =>
        definition.tier <= owner.tavernTier &&
        definition.magnetic !== undefined,
      "磁力随从牌",
    );
  }

  const bleedingHeart = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.bleedingHeart,
  );
  if (
    bleedingHeart &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      bleedingHeart,
      "deaths",
      8,
      "trigger",
    )
  ) {
    gainRandomGeneratedMinionFromTrinket(
      context,
      ownerId,
      bleedingHeart,
      (definition, owner) =>
        definition.tier <= owner.tavernTier &&
        definitionHasTribe(definition, "undead"),
      "亡灵牌",
    );
  }

  // Lesser Trinkets resolve before the Greater slot. This matters when the
  // Band and Thorned Rose complete on the same death: the summoned Beetle is
  // already present for the later Greater-Trinket board buff.
  const lesserBeetleBand = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.lesserBeetleBand,
  );
  if (
    lesserBeetleBand &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      lesserBeetleBand,
      "avenge",
      5,
      "avenge",
    )
  ) {
    summonBeetlesFromTrinket(context, ownerId, lesserBeetleBand, 1);
  }

  const thornedRose = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.gilneanThornedRose,
  );
  if (
    thornedRose &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      thornedRose,
      "avenge",
      3,
      "avenge",
    )
  ) {
    resolveGilneanThornedRose(context, ownerId, thornedRose);
  }

  const luckyTabby = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.luckyTabby,
  );
  if (
    luckyTabby &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      luckyTabby,
      "deaths",
      7,
      "trigger",
    )
  ) {
    gainRandomGeneratedMinionFromTrinket(
      context,
      ownerId,
      luckyTabby,
      (definition) => definitionHasTribe(definition, "beast"),
      "野兽牌",
    );
  }

  const greaterBeetleBand = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.greaterBeetleBand,
  );
  if (
    greaterBeetleBand &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      greaterBeetleBand,
      "avenge",
      7,
      "avenge",
    )
  ) {
    summonBeetlesFromTrinket(context, ownerId, greaterBeetleBand, 2);
  }

  const stormcoilSticker = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.stormcoilSticker,
  );
  if (
    stormcoilSticker &&
    advanceTrinketDeathThreshold(
      context,
      ownerId,
      stormcoilSticker,
      "deaths",
      8,
      "trigger",
    )
  ) {
    gainRandomGeneratedMinionFromTrinket(
      context,
      ownerId,
      stormcoilSticker,
      (definition, owner) =>
        definition.tier <= owner.tavernTier &&
        definitionHasTribe(definition, "mech"),
      "机械牌",
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
            healthDelta: healthDelta + gain.attackGainHealth,
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
          healthDelta: healthDelta + gain.attackGainHealth,
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

function resolveCombatDestroyKiller(
  context: CombatContext,
  death: DeadMinion,
  component: MinionEffectSource,
): void {
  const killerReference =
    context.lethalDamageSources[death.ownerId][
      death.minion.instanceId
    ];
  if (!killerReference) {
    return;
  }
  const killer = context.boards[killerReference.ownerId].find(
    (candidate) =>
      candidate.instanceId === killerReference.instanceId &&
      candidate.health > 0,
  );
  if (!killer) {
    return;
  }
  killer.health = 0;
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: death.ownerId,
    actorInstanceId: death.minion.instanceId,
    targetPlayerId: killerReference.ownerId,
    targetInstanceId: killer.instanceId,
    actorMinion: cloneMinion(death.minion),
    message: `${rallySourceLabel(component)}的亡语消灭了击杀它的${killer.name}。`,
  });
}

function hasTrinketGrantedDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): boolean {
  return (
    context.hoggyBankDeathrattles[ownerId].has(source.instanceId) ||
    context.rustyTridentDeathrattles[ownerId].has(source.instanceId) ||
    context.flyingGolemDeathrattles[ownerId].has(source.instanceId) ||
    context.powderKegDeathrattles[ownerId].has(source.instanceId)
  );
}

function deathlyPhylacteryBonusRepetitions(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): number {
  const phylactery = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.deathlyPhylactery,
  );
  if (
    !phylactery ||
    (!minionHasTriggerableDeathrattle(source) &&
      !hasTrinketGrantedDeathrattle(context, ownerId, source)) ||
    trinketCombatCounter(context, ownerId, phylactery, "used") > 0
  ) {
    return 0;
  }
  setTrinketCombatCounter(context, ownerId, phylactery, "used", 1);
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: phylactery.id,
    targetPlayerId: ownerId,
    targetInstanceId: source.instanceId,
    minion: cloneMinion(source),
    message: `${phylactery.name}使${source.name}的第一个亡语额外触发一次。`,
  });
  return 1;
}

function resolveHoggyBankDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): void {
  if (!context.hoggyBankDeathrattles[ownerId].has(source.instanceId)) {
    return;
  }
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.hoggyBank,
  );
  const owner = persistentCombatOwner(context, ownerId);
  if (!trinket || !owner) {
    return;
  }
  for (let count = 0; count < 2; count += 1) {
    const added = addBloodGems(
      context.state,
      owner,
      1,
      undefined,
      {
        combatContext: context,
        combatOwnerId: ownerId,
        combatEvent: {
          type: "cardGain",
          actorPlayerId: ownerId,
          actorInstanceId: trinket.id,
          targetPlayerId: ownerId,
          amount: 1,
          cardName: owner.isHuman ? "鲜血宝石" : undefined,
          cardKind: "bloodGem",
          cardGainResult: "added",
          message: owner.isHuman
            ? `${trinket.name}赋予${source.name}的亡语使你获得一张鲜血宝石。`
            : `${trinket.name}使${owner.name}获得一张牌。`,
        },
      },
    );
    if (added > 0) {
      continue;
    }
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      amount: 0,
      cardName: owner.isHuman ? "鲜血宝石" : undefined,
      cardKind: "bloodGem",
      cardGainResult: "handFull",
      message: owner.isHuman
        ? `手牌已满，${source.name}的亡语未能使你获得鲜血宝石。`
        : `${trinket.name}未能使${owner.name}获得牌。`,
    });
  }
}

function resolveRustyTridentDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): void {
  if (!context.rustyTridentDeathrattles[ownerId].has(source.instanceId)) {
    return;
  }
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.rustyTrident,
  );
  const owner = persistentCombatOwner(context, ownerId);
  if (!trinket || !owner) {
    return;
  }
  const candidates = SPELLCRAFT_DEFINITIONS.filter(
    (definition) => definition.sourceTier <= owner.tavernTier,
  );
  if (candidates.length === 0) {
    return;
  }
  const definition = candidates[randomIndex(context.state, candidates.length)];
  const spell = createSpellcraftSpell(context.state, definition);
  const added = addCardToHand(context.state, owner, spell, {
    combatContext: context,
    combatOwnerId: ownerId,
    combatEvent: {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman ? spell.instanceId : undefined,
      amount: 1,
      cardName: owner.isHuman ? spell.name : undefined,
      cardGainResult: "added",
      message: owner.isHuman
        ? `${trinket.name}赋予${source.name}的亡语使你获得「${spell.name}」。`
        : `${trinket.name}使${owner.name}获得一张牌。`,
    },
  });
  if (!added) {
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: trinket.id,
      targetPlayerId: ownerId,
      amount: 0,
      cardName: owner.isHuman ? spell.name : undefined,
      cardGainResult: "handFull",
      message: owner.isHuman
        ? `手牌已满，${source.name}的亡语未能使你获得塑造法术。`
        : `${trinket.name}未能使${owner.name}获得牌。`,
    });
  }
}

function resolveFlyingGolemPortraitDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): void {
  if (!context.flyingGolemDeathrattles[ownerId].has(source.instanceId)) {
    return;
  }
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.flyingGolemPortrait,
  );
  if (!trinket) {
    return;
  }
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    actorMinion: cloneMinion(source),
    message: `${source.name}获得的亡语使你的随从永久获得+2/+2。`,
  });
  for (const target of context.boards[ownerId].filter(
    (minion) => minion.health > 0,
  )) {
    const gain = applyExplicitPermanentCombatStatGain(
      context,
      ownerId,
      target,
      { attack: 2, health: 2 },
    );
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: target.instanceId,
      attackDelta: 2,
      healthDelta: 2 + gain.attackGainHealth,
      minion: cloneMinion(target),
      retained: gain.persisted,
      ...(gain.persisted ? { retentionMultiplier: 1 } : {}),
      message: `${source.name}的亡语使${target.name}永久获得+2/+2。`,
    });
  }
}

function resolvePowderKegDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  insertAt: number,
): void {
  if (!context.powderKegDeathrattles[ownerId].has(source.instanceId)) {
    return;
  }
  const powderKeg = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.powderKeg,
  );
  if (!powderKeg) {
    return;
  }
  if (rejectCombatSummonForFullBoard(context, ownerId)) {
    return;
  }
  const skyPirate = createMinionInstance(
    context.state,
    "sky-pirate-token",
    0,
  );
  skyPirate.attack += Math.max(0, source.attack);
  const summoned = insertCombatMinion(
    context,
    ownerId,
    skyPirate,
    insertAt,
    source,
    `${powderKeg.name}召唤了${skyPirate.attack}/1的空中海盗。`,
  );
  if (summoned) {
    performImmediateAttack(context, ownerId, summoned);
  }
}

function resolveCombatSummonLinkedHandMinions(
  context: CombatContext,
  death: DeadMinion,
  component: MinionEffectSource,
): void {
  const ownerId = death.ownerId;
  const source = death.minion;
  const sourceLineage = new Set(
    deathlyStrikerSourceLineage(source, component),
  );
  const linkedMinions = combatHandMinions(context, ownerId).filter(
    (minion) =>
      minion.deathlyStrikerCreatorIds?.some((creatorId) =>
        sourceLineage.has(creatorId),
      ) === true,
  );
  let summonedCount = 0;
  for (const linked of linkedMinions) {
    if (rejectCombatSummonForFullBoard(context, ownerId)) {
      continue;
    }
    const summoned = cloneOwnedMinionForCombat(context.state, linked);
    const inserted = insertCombatMinion(
      context,
      ownerId,
      summoned,
      death.index + summonedCount,
      source,
      `${rallySourceLabel(component)}的亡语从手牌召唤了${summoned.name}（仅限本场战斗）。`,
      "deathlyStrikerFromHand",
    );
    if (inserted) {
      summonedCount += 1;
    }
  }
}

function resolveCombatSummonStitchedSalvagerCopies(
  context: CombatContext,
  death: DeadMinion,
  component: MinionEffectSource,
): void {
  const ownerId = death.ownerId;
  const source = death.minion;
  const snapshots =
    context.stitchedSalvagerDestroyed[ownerId][
      component.sourceInstanceId
    ] ?? [];
  let summonedCount = 0;
  for (const snapshot of snapshots) {
    if (rejectCombatSummonForFullBoard(context, ownerId)) {
      continue;
    }
    const summoned = cloneOwnedMinionForCombat(context.state, snapshot);
    const inserted = insertCombatMinion(
      context,
      ownerId,
      summoned,
      death.index + summonedCount,
      source,
      `${rallySourceLabel(component)}的亡语召唤了${summoned.name}的完全相同复制。`,
      "stitchedSalvagerCopy",
    );
    if (inserted) {
      summonedCount += 1;
    }
  }
}

function triggerBloodAmuletAfterDeathrattle(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
): void {
  const bloodAmulet = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.bloodAmulet,
  );
  if (!bloodAmulet) {
    return;
  }
  const targets = randomBoardSubset(
    context.state,
    context.boards[ownerId].filter((minion) => minion.health > 0),
    3,
  );
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: bloodAmulet.id,
    targetPlayerId: ownerId,
    targetInstanceId: source.instanceId,
    minion: cloneMinion(source),
    message: `${bloodAmulet.name}在${source.name}的亡语触发后，随机对至多3个友方随从永久使用鲜血宝石。`,
  });
  for (const target of targets) {
    applyPermanentCombatBloodGemFromTrinket(
      context,
      ownerId,
      bloodAmulet,
      target,
    );
  }
}

function resolveOneDeathrattle(
  context: CombatContext,
  death: DeadMinion,
): void {
  const source = death.minion;
  const ownerId = death.ownerId;
  const triggeredDeathrattle =
    minionHasTriggerableDeathrattle(source) ||
    context.hoggyBankDeathrattles[ownerId].has(source.instanceId) ||
    context.rustyTridentDeathrattles[ownerId].has(source.instanceId) ||
    context.flyingGolemDeathrattles[ownerId].has(source.instanceId) ||
    context.powderKegDeathrattles[ownerId].has(source.instanceId);
  if (triggeredDeathrattle) {
    const persistentOwner = persistentCombatOwner(context, ownerId);
    if (persistentOwner) {
      activateThornedPauldrons(persistentOwner);
    }
  }
  const enemyId = opponentId(context, ownerId);
  const board = context.boards[ownerId];
  const repetitions =
    1 +
    extraDeathrattles(board) +
    deathlyPhylacteryBonusRepetitions(context, ownerId, source);
  for (const component of minionEffectSources(source)) {
    const effects =
      getMinionDefinition(component.definitionId).deathrattle ?? [];
    const scale = component.golden ? 2 : 1;
    const elementalGrantBonus = combatElementalStatGrantBonus(
      context,
      ownerId,
      component,
    );
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      if (effects.length > 0) {
        observeCombatDeathrattleTriggered(context, ownerId, source);
      }
      for (const effect of effects) {
        if (effect.kind === "summonLinkedHandMinions") {
          resolveCombatSummonLinkedHandMinions(
            context,
            death,
            component,
          );
        } else if (effect.kind === "summonStitchedSalvagerCopies") {
          resolveCombatSummonStitchedSalvagerCopies(
            context,
            death,
            component,
          );
        } else if (effect.kind === "summon") {
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
              attack:
                current.attack +
                effect.attack * scale +
                elementalGrantBonus.attack,
              health:
                current.health +
                effect.health * scale +
                elementalGrantBonus.health,
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
                attack:
                  effect.attack * scale + elementalGrantBonus.attack,
                health:
                  effect.health * scale + elementalGrantBonus.health,
                keywords: effect.taunt ? ["taunt"] : [],
              },
            );
            pushBattleEvent(context.events, {
              type: "buff",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              attackDelta:
                effect.attack * scale + elementalGrantBonus.attack,
              healthDelta:
                effect.health * scale +
                elementalGrantBonus.health +
                gain.attackGainHealth,
              minion: cloneMinion(target),
              retained: gain.retentionMultiplier > 0,
              ...(gain.retentionMultiplier > 0
                ? {
                    retentionMultiplier:
                      gain.retentionMultiplier,
                  }
                : {}),
              message: `${source.name}的亡语使${target.name}获得+${
                effect.attack * scale + elementalGrantBonus.attack
              }/+${effect.health * scale + elementalGrantBonus.health}。`,
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
        } else if (effect.kind === "destroyKiller") {
          resolveCombatDestroyKiller(context, death, component);
        } else if (effect.kind === "resummonMechs") {
          const history = context.deadMechs[ownerId];
          for (
            let index = 0;
            index < effect.count * scale &&
            index < history.length;
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
            candidates.length > 0;
            count += 1
          ) {
            if (rejectCombatSummonForFullBoard(context, ownerId)) {
              continue;
            }
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
        } else if (effect.kind === "summonRandomMinion") {
          resolveCombatSummonRandomMinion(
            context,
            death,
            component,
            effect,
          );
        } else if (effect.kind === "buffThenDamageFriendly") {
          resolveCombatBuffThenDamageFriendly(
            context,
            ownerId,
            source,
            component,
            effect,
          );
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
        } else if (effect.kind === "improveElementalStatGrants") {
          improveElementalStatGrantsInCombat(
            context,
            ownerId,
            source,
            component,
            effect,
            "亡语",
          );
        } else if (effect.kind === "buffFriendlyMechsByMagnetizations") {
          const attackDelta =
            (effect.attack +
              effect.attackPerMagnetization *
                context.magnetizationsThisGame[ownerId]) *
            scale;
          const current = context.tribeBuffs[ownerId].mech ?? {
            attack: 0,
            health: 0,
          };
          context.tribeBuffs[ownerId].mech = {
            attack: current.attack + attackDelta,
            health: current.health,
          };
          for (const target of board.filter((minion) =>
            minionHasTribe(minion, "mech"),
          )) {
            const gain = applyCombatEnchantingGain(
              context,
              ownerId,
              target,
              { attack: attackDelta },
            );
            pushBattleEvent(context.events, {
              type: "buff",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              attackDelta,
              healthDelta: gain.attackGainHealth,
              minion: cloneMinion(target),
              retained: gain.retentionMultiplier > 0,
              ...(gain.retentionMultiplier > 0
                ? { retentionMultiplier: gain.retentionMultiplier }
                : {}),
              message: `${rallySourceLabel(component)}的亡语使${target.name}在本场战斗中获得+${attackDelta}攻击力。`,
            });
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
                attack: effect.attack + elementalGrantBonus.attack,
                health: effect.health + elementalGrantBonus.health,
              });
              pushBattleEvent(context.events, {
                type: "trigger",
                actorPlayerId: ownerId,
                actorInstanceId: source.instanceId,
                targetPlayerId: ownerId,
                actorMinion: cloneMinion(source),
                attackDelta: effect.attack + elementalGrantBonus.attack,
                healthDelta: effect.health + elementalGrantBonus.health,
                permanentEffectImprovement: true,
                message: `${rallySourceLabel(component)}的亡语为后续刷新安装了+${effect.attack + elementalGrantBonus.attack}/+${effect.health + elementalGrantBonus.health}酒馆增益。`,
              });
            }
          }
        } else if (effect.kind === "buffTavern") {
          const owner = persistentCombatOwner(context, ownerId);
          if (owner) {
            const effectRepetitions =
              effect.goldenMode === "repeat" ? scale : 1;
            const portraitBonus =
              component.definitionId === FELLEMENTAL_DEFINITION_ID &&
              playerHasTrinketCardId(owner, FELLEMENTAL_PORTRAIT_CARD_ID)
                ? 2
                : 0;
            for (
              let effectRepetition = 0;
              effectRepetition < effectRepetitions;
              effectRepetition += 1
            ) {
              const attackDelta =
                effect.attack + portraitBonus + elementalGrantBonus.attack;
              const healthDelta =
                effect.health + portraitBonus + elementalGrantBonus.health;
              buffTavernMinionsPermanently(
                owner,
                attackDelta,
                healthDelta,
              );
              pushBattleEvent(context.events, {
                type: "trigger",
                actorPlayerId: ownerId,
                actorInstanceId: source.instanceId,
                targetPlayerId: ownerId,
                actorMinion: cloneMinion(source),
                attackDelta,
                healthDelta,
                permanentEffectImprovement: true,
                message: `${rallySourceLabel(component)}的亡语使酒馆中的随从在本局对战中获得+${attackDelta}/+${healthDelta}。`,
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
              const attackDelta =
                effect.attack * pulseScale + elementalGrantBonus.attack;
              const healthDelta =
                effect.health * pulseScale + elementalGrantBonus.health;
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
        } else if (effect.kind === "castTavernSpellOnAdjacent") {
          resolveCombatCastTavernSpellOnAdjacent(
            context,
            death,
            component,
            effect,
          );
        } else if (effect.kind === "triggerAdjacentBattlecries") {
          resolveCombatTriggerAdjacentBattlecries(
            context,
            death,
            component,
            effect,
          );
        }
      }
      if (effects.length > 0) {
        triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
      }
    }
  }
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    const hasHoggyBankDeathrattle =
      context.hoggyBankDeathrattles[ownerId].has(source.instanceId);
    if (hasHoggyBankDeathrattle) {
      observeCombatDeathrattleTriggered(context, ownerId, source);
      resolveHoggyBankDeathrattle(context, ownerId, source);
      triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
    }
    const hasRustyTridentDeathrattle =
      context.rustyTridentDeathrattles[ownerId].has(source.instanceId);
    if (hasRustyTridentDeathrattle) {
      observeCombatDeathrattleTriggered(context, ownerId, source);
      resolveRustyTridentDeathrattle(context, ownerId, source);
      triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
    }
    const hasFlyingGolemDeathrattle =
      context.flyingGolemDeathrattles[ownerId].has(source.instanceId);
    if (hasFlyingGolemDeathrattle) {
      observeCombatDeathrattleTriggered(context, ownerId, source);
      resolveFlyingGolemPortraitDeathrattle(context, ownerId, source);
      triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
    }
    const hasPowderKegDeathrattle =
      context.powderKegDeathrattles[ownerId].has(source.instanceId);
    if (hasPowderKegDeathrattle) {
      observeCombatDeathrattleTriggered(context, ownerId, source);
      resolvePowderKegDeathrattle(context, ownerId, source, death.index);
      triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
    }
    const crabDeathrattles =
      (source.crabDeathrattles ?? 0) +
      source.temporaryCrabDeathrattles;
    for (let count = 0; count < crabDeathrattles; count += 1) {
      observeCombatDeathrattleTriggered(context, ownerId, source);
      summonCombatMinion(
        context,
        ownerId,
        "live-crab-token",
        death.index + count,
        source,
        false,
        false,
      );
      triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
    }
    const goldenCrabDeathrattles =
      (source.goldenCrabDeathrattles ?? 0) +
      (source.temporaryGoldenCrabDeathrattles ?? 0);
    for (let count = 0; count < goldenCrabDeathrattles; count += 1) {
      observeCombatDeathrattleTriggered(context, ownerId, source);
      summonCombatMinion(
        context,
        ownerId,
        "live-crab-token",
        death.index + crabDeathrattles + count,
        source,
        true,
        false,
      );
      triggerBloodAmuletAfterDeathrattle(context, ownerId, source);
    }
  }
}

function restoreRebornWithDeathtouchApple(
  context: CombatContext,
  ownerId: PlayerId,
  reborn: MinionInstance,
): void {
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.deathtouchApple,
  );
  if (
    !trinket ||
    reborn.health <= 0 ||
    reborn.reborn ||
    !minionHasTribe(reborn, "undead")
  ) {
    return;
  }
  const uses = trinketCombatCounter(
    context,
    ownerId,
    trinket,
    "uses",
  );
  if (uses >= 3) {
    return;
  }
  reborn.reborn = true;
  setTrinketCombatCounter(
    context,
    ownerId,
    trinket,
    "uses",
    uses + 1,
  );
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    targetInstanceId: reborn.instanceId,
    attackDelta: 0,
    healthDelta: 0,
    minion: cloneMinion(reborn),
    message: `${trinket.name}使复生的${reborn.name}再次获得复生（本场第${uses + 1}次）。`,
  });
}

function resummonSoulFermenterBandIfReady(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  const stored = context.soulFermenterDestroyed[ownerId];
  if (
    !context.soulFermenterArmed[ownerId] ||
    stored.length === 0 ||
    context.boards[ownerId].some((minion) => minion.health > 0)
  ) {
    return;
  }
  const trinket = combatTrinketByCardId(
    context,
    ownerId,
    COMBAT_TRINKET_CARD_IDS.soulFermenter,
  );
  if (!trinket) {
    return;
  }
  context.soulFermenterArmed[ownerId] = false;
  context.soulFermenterDestroyed[ownerId] = [];
  pushBattleEvent(context.events, {
    type: "trigger",
    actorPlayerId: ownerId,
    actorInstanceId: trinket.id,
    targetPlayerId: ownerId,
    message: `${trinket.name}在你的最后一个随从死亡后重新召唤了被消灭的随从。`,
  });
  for (const original of stored) {
    if (rejectCombatSummonForFullBoard(context, ownerId)) {
      continue;
    }
    const returned = cloneOwnedMinionForCombat(context.state, original);
    insertCombatMinion(
      context,
      ownerId,
      returned,
      context.boards[ownerId].length,
      original,
      `${trinket.name}重新召唤了${returned.name}。`,
    );
  }
}

function resolveCombatDeaths(context: CombatContext): void {
  context.deathResolutionDepth += 1;
  try {
    for (let wave = 0; wave < 50; wave += 1) {
      for (const ownerId of context.playerIds) {
        for (const minion of context.boards[ownerId]) {
          if (minion.health > 0) {
            delete context.lethalDamageSources[ownerId][
              minion.instanceId
            ];
          }
        }
      }
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
        advanceStaffOfTheScourge(context, death.ownerId);
        advanceCombatDeathTrinkets(context, death);
      }
      for (const death of deaths) {
        resolveOneDeathrattle(context, death);
      }
      for (const death of deaths) {
        if (!death.minion.reborn) {
          continue;
        }
        if (rejectCombatSummonForFullBoard(context, death.ownerId)) {
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
        const inserted = insertCombatMinion(
          context,
          death.ownerId,
          reborn,
          death.index,
          death.minion,
          `${death.minion.name}复生了。`,
          "reborn",
          rebornMaximumHealth,
        );
        if (inserted) {
          restoreRebornWithDeathtouchApple(
            context,
            death.ownerId,
            inserted,
          );
        }
      }
      for (const ownerId of context.playerIds) {
        summonPendingBeetles(context, ownerId);
      }
      for (const ownerId of context.playerIds) {
        summonAutomatonPortraitWhenSpace(context, ownerId);
      }
      if (context.deathResolutionDepth === 1) {
        for (const ownerId of context.playerIds) {
          summonPendingStartOfCombatHandMinions(context, ownerId);
        }
      }
      for (const ownerId of context.playerIds) {
        resummonSoulFermenterBandIfReady(context, ownerId);
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
      healthDelta: healthDelta + gain.attackGainHealth,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `转瞬活力使${target.name}在本场战斗中获得+${attackDelta}/+${healthDelta + gain.attackGainHealth}。`,
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
      healthDelta: healthDelta + gain.attackGainHealth,
      minion: cloneMinion(target),
      retained: gain.retentionMultiplier > 0,
      ...(gain.retentionMultiplier > 0
        ? { retentionMultiplier: gain.retentionMultiplier }
        : {}),
      message: `诺兹多姆的子嗣使${target.name}的攻击力翻倍${gain.attackGainHealth > 0 ? `，并触发+${gain.attackGainHealth}生命值` : ""}。`,
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

function applyStartOfCombatHeroPowers(
  context: CombatContext,
  playerA: PlayerState,
  playerB: PlayerState,
  isGhost: boolean,
): void {
  const activeOwners = isGhost ? [playerA] : [playerA, playerB];
  const persistentOwners = new Map<PlayerId, PlayerState>(
    activeOwners.map((player) => [player.id, player]),
  );
  for (const owner of activeOwners) {
    if (playerHasHeroPower(owner, "buffAllCombatMinionsAttack")) {
      for (
        let trigger = 0;
        trigger < heroPowerTriggerMultiplier(owner);
        trigger += 1
      ) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: owner.id,
        message: `${owner.name}的“万物尽焚！”触发。`,
      });
      for (const targetPlayerId of context.playerIds) {
        for (const target of context.boards[targetPlayerId]) {
          const triggeredHealth = healthGainedFromExternalAttack(target, 2);
          target.attack += 2;
          target.health += triggeredHealth;
          if (triggeredHealth > 0) {
            adjustCombatMaximumHealth(
              context,
              targetPlayerId,
              target,
              triggeredHealth,
            );
          }
          reconcileConditionalMinion(target);
          const persistentOwner = persistentOwners.get(targetPlayerId);
          const persistentTarget = persistentOwner?.board.find(
            (minion) => minion.instanceId === target.instanceId,
          );
          if (persistentTarget) {
            persistentTarget.attack += 2;
            reconcileConditionalMinion(persistentTarget);
            refreshDynamicMinionDescription(
              persistentTarget,
              persistentOwner,
            );
          }
          pushBattleEvent(context.events, {
            type: "buff",
            actorPlayerId: owner.id,
            targetPlayerId,
            targetInstanceId: target.instanceId,
            attackDelta: 2,
            healthDelta: triggeredHealth,
            minion: cloneMinion(target),
            retained: persistentTarget !== undefined,
            message: `万物尽焚使${target.name}永久获得+2攻击力${triggeredHealth > 0 ? `，并在本场战斗中触发+${triggeredHealth}生命值` : ""}。`,
          });
        }
      }
      }
    }
    if (playerHasHeroPower(owner, "buffLeftmostCombatKeywords")) {
      const target = context.boards[owner.id][0];
      if (!target) {
        continue;
      }
      for (
        let trigger = 0;
        trigger < heroPowerTriggerMultiplier(owner);
        trigger += 1
      ) {
      pushBattleEvent(context.events, {
        type: "startOfCombat",
        actorPlayerId: owner.id,
        targetPlayerId: owner.id,
        targetInstanceId: target.instanceId,
        message: `${owner.name}的“随风而行”触发。`,
      });
      target.windfury = true;
      target.divineShield = true;
      target.taunt = true;
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: owner.id,
        targetPlayerId: owner.id,
        targetInstanceId: target.instanceId,
        attackDelta: 0,
        healthDelta: 0,
        minion: cloneMinion(target),
        message: `随风而行使${target.name}获得风怒、圣盾和嘲讽。`,
      });
      }
    }
  }
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
    if (card.kind !== "minion") {
      continue;
    }
    const effect =
      getMinionDefinition(card.definitionId).inHandStartOfCombat;
    if (effect?.kind !== "summonSelfCopy") {
      continue;
    }
    if (rejectCombatSummonForFullBoard(context, player.id)) {
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
  resetThornedPauldrons(playerA);
  if (!isGhost) {
    resetThornedPauldrons(playerB);
  }
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
      playerA.tavernSpellsCast ?? 0,
      playerA.deathrattlesTriggered ?? 0,
      playerA.magnetizationsThisGame ?? 0,
    );
  }
  for (const minion of boardB) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned[playerB.id],
      eternalKnightsDied[playerB.id],
      playerB.tavernSpellsCast ?? 0,
      playerB.deathrattlesTriggered ?? 0,
      playerB.magnetizationsThisGame ?? 0,
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
    elementalGrantBonuses: {
      [playerA.id]: {
        attack: playerA.elementalGrantAttackBonus,
        health: playerA.elementalGrantHealthBonus,
      },
      [playerB.id]: {
        attack: playerB.elementalGrantAttackBonus,
        health: playerB.elementalGrantHealthBonus,
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
    startOfCombatSummonedHandInstanceIds: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    deathResolutionDepth: 0,
    astralAutomatonsSummoned,
    eternalKnightsDied,
    tavernSpellsCast: {
      [playerA.id]: playerA.tavernSpellsCast ?? 0,
      [playerB.id]: playerB.tavernSpellsCast ?? 0,
    },
    deathrattlesTriggered: {
      [playerA.id]: playerA.deathrattlesTriggered ?? 0,
      [playerB.id]: playerB.deathrattlesTriggered ?? 0,
    },
    magnetizationsThisGame: {
      [playerA.id]: playerA.magnetizationsThisGame ?? 0,
      [playerB.id]: playerB.magnetizationsThisGame ?? 0,
    },
    avengeProgress: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    limitedSelfDamageTriggers: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    limitedFriendlySummonTriggers: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    trinketCombatCounters: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    hoggyBankDeathrattles: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    rustyTridentDeathrattles: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    flyingGolemDeathrattles: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    powderKegDeathrattles: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    soulFermenterDestroyed: {
      [playerA.id]: [],
      [playerB.id]: [],
    },
    soulFermenterArmed: {
      [playerA.id]: false,
      [playerB.id]: false,
    },
    stitchedSalvagerDestroyed: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
    poisonLethalMinionIds: {
      [playerA.id]: new Set(),
      [playerB.id]: new Set(),
    },
    lethalDamageSources: {
      [playerA.id]: {},
      [playerB.id]: {},
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
  applyStartOfCombatHeroPowers(context, playerA, playerB, isGhost);
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
  applyStartOfCombatTrinkets(context, playerA.id);
  applyStartOfCombatTrinkets(context, playerB.id);
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
      const safeBadge = consumeSafeBadgeForLethalCombatDamage(
        playerB,
        damageToPlayerB,
      );
      if (safeBadge) {
        damageToPlayerB = 0;
        pushBattleEvent(events, {
          type: "trigger",
          actorPlayerId: playerB.id,
          actorInstanceId: safeBadge.id,
          targetPlayerId: playerB.id,
          message: `${playerB.name}的安全徽章触发了寒冰屏障，防止了致命伤害。`,
        });
      }
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
    const safeBadge = consumeSafeBadgeForLethalCombatDamage(
      playerA,
      damageToPlayerA,
    );
    if (safeBadge) {
      damageToPlayerA = 0;
      pushBattleEvent(events, {
        type: "trigger",
        actorPlayerId: playerA.id,
        actorInstanceId: safeBadge.id,
        targetPlayerId: playerA.id,
        message: `${playerA.name}的安全徽章触发了寒冰屏障，防止了致命伤害。`,
      });
    }
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
    delete snapshot.poolCopiesByDefinitionId;
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
  player.board = player.board.map((minion) => {
    const snapshot = {
      ...minion,
      poolCopies: 0,
      attachments: minion.attachments.map(clearAttachmentPoolCopies),
    };
    // Keep eliminated-player snapshots stable across JSON save/load. Optional
    // ownership metadata is omitted, rather than retained as an explicit
    // `undefined` property that JSON serialization would silently drop.
    delete snapshot.poolCopiesByDefinitionId;
    return snapshot;
  });
  player.hand = [];
  player.pendingSpellcraft = [];
  player.pendingMysteryCubeReplacementIds = [];
  player.pendingSystemSpellIds = [];
  player.freeTavernSpellPurchases = 0;
  player.heroRefreshAvailable = false;
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

function applyEndOfTurnHeroPower(player: PlayerState): void {
  if (playerHasHeroPower(player, "freezeEndTurnSmallerTavern")) {
    player.frozen = true;
  }
}

function deferTriplesUntilNextRecruit(
  state: GameState,
  player: PlayerState,
): void {
  if (!state.deferredTriplePlayerIds.includes(player.id)) {
    state.deferredTriplePlayerIds.push(player.id);
  }
}

function endTurn(state: GameState): void {
  const previousRoundBattles = state.lastRoundBattles;
  const human = humanPlayer(state);
  if (human.isHuman && human.alive) {
    deferTriplesUntilNextRecruit(state, human);
    applyEndOfTurnEffects(state, human);
    applyEndOfTurnTrinkets(state, human);
    applyEndOfTurnHeroPower(human);
    reconcileConditionalMinions(human);
    human.hand = human.hand.filter(
      (card) =>
        card.kind !== "spellcraft" ||
        card.spellFamily !== "spellcraft",
    );
    human.pendingSpellcraft = [];
    flushPendingSystemSpells(state, human);
  }
  const aiPlayers = state.players.filter(
    (player) => player.alive && !player.isHuman,
  );
  shuffleInPlace(state, aiPlayers);
  for (const player of aiPlayers) {
    runAiRecruit(state, player);
    deferTriplesUntilNextRecruit(state, player);
    applyEndOfTurnEffects(state, player);
    applyEndOfTurnTrinkets(state, player);
    applyEndOfTurnHeroPower(player);
    reconcileConditionalMinions(player);
    player.hand = player.hand.filter(
      (card) =>
        card.kind !== "spellcraft" ||
        card.spellFamily !== "spellcraft",
    );
    player.pendingSpellcraft = [];
    flushPendingSystemSpells(state, player);
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
  state.lastBattle = human.isHuman
    ? (battles.find(
        (battle) =>
          battle.playerAId === state.humanPlayerId ||
          battle.playerBId === state.humanPlayerId,
      ) ?? null)
    : null;
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
  if ((human.isHuman && !human.alive) || alivePlayers.length <= 1) {
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
    for (const minion of player.shop) {
      clearTemporarySpellcraftBuffs(minion);
    }
    player.tavernMinionAttackBonusThisTurn = 0;
    player.tavernMinionHealthBonusThisTurn = 0;
  }
  state.deferredTriplePlayerIds = [];
  for (const player of alivePlayers) {
    resolveTriples(state, player);
  }
  for (const player of alivePlayers) {
    player.gold =
      Math.min(player.maxGold, state.round + 2) +
      player.pendingNextTurnGold;
    player.pendingNextTurnGold = 0;
    if (playerHasHeroPower(player, "goldAfterSellNextTurn")) {
      setHeroPowerCounter(player, "smartSavingsGold", 0);
    }
    if (playerHasHeroPower(player, "growingTavernSpellBuff")) {
      const nextImprovementRound = Math.max(
        4,
        heroPowerCounter(player, "rakanishuTurns") || 4,
      );
      if (state.round >= nextImprovementRound) {
        const improvements =
          Math.floor((state.round - nextImprovementRound) / 4) + 1;
        setHeroPowerCounter(
          player,
          "rakanishuBonus",
          Math.max(
            1,
            heroPowerCounter(player, "rakanishuBonus"),
          ) + improvements * heroPowerTriggerMultiplier(player),
        );
        setHeroPowerCounter(
          player,
          "rakanishuTurns",
          nextImprovementRound + improvements * 4,
        );
      }
    }
    player.tavernSpellsCastThisTurn = 0;
    player.darkmoonReservePricesDiscount = 0;
    applyStartOfTurnTrinkets(state, player);
    player.cardsPlayedThisTurn = 0;
    player.goldSpentThisTurn = 0;
    player.pendingCardPlayed = null;
    player.pendingTavernSpellDefinitionId = null;
    for (const minion of ownedMinionCards(player)) {
      const definition = getMinionDefinition(minion.definitionId);
      if (definition.spellcraftPermanentOnSelf) {
        setEffectCounter(
          minion,
          SPELLCRAFT_PERMANENT_CASTS_COUNTER,
          0,
        );
      }
      if (definition.copySpellcraftOnSelf) {
        setEffectCounter(
          minion,
          SPELLCRAFT_COPY_USED_COUNTER,
          0,
        );
      }
      if (definition.healthRefreshesPerTurn) {
        setEffectCounter(
          minion,
          HEALTH_REFRESH_USED_COUNTER,
          0,
        );
      }
      if (definition.afterTavernSpellPurchased) {
        setEffectCounter(
          minion,
          TAVERN_SPELL_PURCHASES_OBSERVED_COUNTER,
          0,
        );
        refreshDynamicMinionDescription(minion, player);
      }
      if (definition.afterMinionPurchased) {
        setEffectCounter(
          minion,
          STONE_AGE_SLAB_PURCHASE_USED_COUNTER,
          0,
        );
        refreshDynamicMinionDescription(minion, player);
      }
      if (
        definition.afterCardPlayed?.effects.some(
          (effect) => effect.kind === "improveTavernSpellAuraThisTurn",
        )
      ) {
        setEffectCounter(
          minion,
          TAVERN_SPELL_AURA_CARD_PROGRESS_COUNTER,
          0,
        );
        setEffectCounter(
          minion,
          TAVERN_SPELL_AURA_ATTACK_BONUS_COUNTER,
          0,
        );
        setEffectCounter(
          minion,
          TAVERN_SPELL_AURA_HEALTH_BONUS_COUNTER,
          0,
        );
      }
      refreshDynamicMinionDescription(minion, player);
    }
    player.elementalsPlayedThisTurn = 0;
    player.heroRefreshAvailable = playerHasHeroPower(
      player,
      "freeRefreshAtTurnStart",
    );
    const wishbone = ancientWishbone(player);
    if (wishbone) {
      player.trinketCounters[wishbone.id] = player.heroRefreshAvailable
        ? heroPowerTriggerMultiplier(player) - 1
        : 0;
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
          player.board,
          player,
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
    applyGoldThresholdTrinket(state, player);
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
  if (state.lobbySystemsEnabled) {
    applySystemEventAtTurnStart(state);
    flushPendingMysteryCubeReplacements(state, human);
    if (state.pendingInteraction === null) {
      flushPendingTrinketOffers(state);
    }
  }
  if (state.pendingInteraction === null) {
    flushPendingBookOfMedivhDiscoveries(state, human);
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
    heroPowerCounters: {},
    heroId: null,
    trinketIds: [],
    trinketCounters: {},
    trinketSelections: {},
    pendingMysteryCubeReplacementIds: [],
    pendingSystemSpellIds: [],
    freeTavernSpellPurchases: 0,
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
    tavernSpellsCast: 0,
    playerSpellsCast: 0,
    battlecriesTriggered: 0,
    heroPowerExtraTriggers: 0,
    darkmoonReservePricesDiscount: 0,
    pendingTickatusTagPrizes: 0,
    cardsPlayedThisTurn: 0,
    goldSpentThisTurn: 0,
    mrrgltonsPlayed: 0,
    pendingCardPlayed: null,
    lastTavernSpellDefinitionId: null,
    pendingTavernSpellDefinitionId: null,
    demonFodderRefreshQueue: [],
    maxGold: 10,
    pendingNextTurnGold: 0,
    heroRefreshAvailable: false,
    freeRefreshes: 0,
    helpfulRefreshes: 0,
    lastHelpfulRefreshKind: null,
    tavernMinionAttackBonus: 0,
    tavernMinionHealthBonus: 0,
    tavernMinionAttackBonusThisTurn: 0,
    tavernMinionHealthBonusThisTurn: 0,
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
    elementalGrantAttackBonus: 0,
    elementalGrantHealthBonus: 0,
    deathrattlesTriggered: 0,
    magnetizationsThisGame: 0,
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
    lobbySystemsEnabled: false,
    systemEventId: null,
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
    deferredTriplePlayerIds: [],
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
    pool[definition.id] =
      definition.tier !== 7 &&
      definitionIsAvailable(definition, state.activeTribes)
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

/**
 * Create the neutral eight-bot lobby used by deterministic self-play and
 * policy benchmarks. The humanPlayerId remains a stable replay anchor, but no
 * player is exempt from the existing AI recruit and positioning policies.
 */
export function createHeadlessGame(
  seed?: number,
  initialHealth = DEFAULT_INITIAL_HEALTH,
): GameState {
  const state = createGame(seed, initialHealth);
  for (const player of state.players) {
    player.isHuman = false;
  }
  return state;
}

/** Advance exactly one recruit/combat phase without mutating the input. */
export function advanceHeadlessGame(state: GameState): GameState {
  if (state.players.some((player) => player.isHuman)) {
    throw new Error("headless games cannot contain a human player");
  }
  if (state.pendingInteraction !== null) {
    throw new Error("headless games cannot pause for an interaction");
  }

  const next = cloneState(state);
  if (next.phase === "recruit") {
    endTurn(next);
  } else if (next.phase === "combat") {
    beginNextRecruit(next);
  }
  return next;
}

/**
 * User-facing new games enable the official-style lobby systems. The core
 * `createGame` factory intentionally stays neutral for legacy saves and the
 * hundreds of focused mechanic fixtures that do not model pre-game choices.
 */
export function createLobbyGame(
  seed?: number,
  initialHealth = DEFAULT_INITIAL_HEALTH,
): GameState {
  const state = createGame(seed, initialHealth);
  state.lobbySystemsEnabled = true;

  const events = [...SYSTEM_EVENT_DEFINITIONS];
  shuffleInPlace(state, events);
  state.systemEventId = events[0]?.id ?? null;

  const heroDeal = heroesAvailableForTribes(state.activeTribes);
  shuffleInPlace(state, heroDeal);
  const aiPlayers = state.players.filter((player) => !player.isHuman);
  if (heroDeal.length < HERO_OFFER_SIZE + aiPlayers.length) {
    throw new Error(
      `Lobby needs ${HERO_OFFER_SIZE + aiPlayers.length} eligible Heroes; ` +
        `only ${heroDeal.length} are available.`,
    );
  }
  const heroOptions = heroDeal.slice(0, HERO_OFFER_SIZE);
  const aiHeroes = heroDeal.slice(
    HERO_OFFER_SIZE,
    HERO_OFFER_SIZE + aiPlayers.length,
  );
  aiPlayers.forEach((player, index) => {
    const hero = aiHeroes[index];
    if (hero) {
      assignHeroDefinition(state, player, hero);
    }
  });

  applySystemEventAtLobbyStart(state);

  state.pendingInteraction = {
    kind: "heroChoice",
    interactionId: nextInteractionId(state),
    playerId: state.humanPlayerId,
    sourceInstanceId: "lobby-hero-offer",
    optionIds: heroOptions.map((definition) => definition.id),
  };
  return state;
}

function reduceGame(
  state: GameState,
  action: GameAction,
  trace?: GameActionTrace,
  acceptance?: { accepted: boolean },
): GameState {
  if (acceptance) {
    acceptance.accepted = false;
  }
  if (action.type === "RESOLVE_INTERACTION") {
    const resolved = resolvePendingInteraction(state, action);
    const accepted = resolved !== state;
    if (acceptance) {
      acceptance.accepted = accepted;
    }
    if (
      accepted &&
      resolved.pendingInteraction === null &&
      resolved.phase === "recruit"
    ) {
      const player = humanPlayer(resolved);
      flushPendingMysteryCubeReplacements(resolved, player);
      if (resolved.pendingInteraction === null) {
        flushPendingTrinketOffers(resolved);
      }
      if (resolved.pendingInteraction === null) {
        flushPendingBookOfMedivhDiscoveries(resolved, player);
        flushPendingTickatusTagPrizes(resolved, player);
        flushPendingSpellcraft(resolved, player);
        flushPendingSystemSpells(resolved, player);
        resolvePendingStirDeaths(resolved, player);
      }
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
      if (acceptance) {
        acceptance.accepted = true;
      }
      return next;
    }
    return state;
  }
  if (next.phase !== "recruit") {
    return state;
  }

  const player = humanPlayer(next);
  if (!player.alive) {
    return state;
  }
  let accepted = false;
  switch (action.type) {
    case "BUY_MINION":
      accepted = buyMinion(next, player, action.shopIndex);
      break;
    case "BUY_TAVERN_SPELL":
      accepted = buyTavernSpell(next, player, action.spellInstanceId);
      break;
    case "SELL_MINION":
      accepted = sellMinion(next, player, action.boardIndex);
      break;
    case "PLAY_MINION":
      accepted = playMinion(
        next,
        player,
        action.handIndex,
        action.boardIndex,
      );
      break;
    case "PLAY_HAND_CARD":
      accepted = playHandCard(
        next,
        player,
        action.cardInstanceId,
        action.boardIndex,
      );
      break;
    case "MAGNETIZE_MINION":
      accepted = magnetizeMinion(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_BLOOD_GEM":
      accepted = castBloodGem(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
        trace,
      );
      break;
    case "CAST_TAVERN_SPELL":
      accepted = castTavernSpell(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_SPELLCRAFT":
      accepted = castSpellcraft(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "REFRESH_SHOP":
      accepted = refreshShop(next, player);
      break;
    case "TOGGLE_FREEZE":
      player.frozen = !player.frozen;
      accepted = true;
      break;
    case "UPGRADE_TAVERN":
      accepted = upgradeTavern(next, player);
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
        accepted = true;
      }
      break;
    }
    case "END_TURN":
      endTurn(next);
      accepted = true;
      break;
  }
  if (!accepted) {
    return state;
  }
  if (acceptance) {
    acceptance.accepted = true;
  }
  applyGoldThresholdTrinket(next, player);
  if (next.phase === "recruit" && next.pendingInteraction === null) {
    flushPendingMysteryCubeReplacements(next, player);
    if (next.pendingInteraction === null) {
      flushPendingBookOfMedivhDiscoveries(next, player);
      flushPendingSpellcraft(next, player);
      flushPendingSystemSpells(next, player);
      reconcileConditionalMinions(player);
    }
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
  const acceptance = { accepted: false };
  return {
    state: reduceGame(state, action, trace, acceptance),
    trace,
    accepted: acceptance.accepted,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  return reduceGame(state, action);
}
