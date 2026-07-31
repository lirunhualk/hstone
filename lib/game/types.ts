export type PlayerId = string;

export type GamePhase = "recruit" | "combat" | "gameOver";

export type Tribe =
  | "beast"
  | "mech"
  | "demon"
  | "murloc"
  | "dragon"
  | "pirate"
  | "elemental"
  | "naga"
  | "quilboar"
  | "undead"
  | "all"
  | "neutral";

export type EffectSupport = "complete" | "partial";

export type TavernTier = 1 | 2 | 3 | 4 | 5 | 6;

export type TierParity = "odd" | "even";

export type EffectTarget =
  | "self"
  | "randomFriendly"
  | "randomFriendlyTribe"
  | "allFriendly"
  | "otherFriendly"
  | "otherFriendlyTribe"
  | "friendlyTribe"
  | "adjacentFriendly";

export interface BuffEffect {
  kind: "buff";
  target: EffectTarget;
  attack: number;
  health: number;
  tribe?: Tribe;
  /** Select several distinct random targets when the target is random. */
  count?: number;
  /** Random friendly targeting normally excludes the effect source. */
  includeSelf?: boolean;
  /** Restrict eligible friendly minions by their printed Tavern Tier. */
  tierParity?: TierParity;
  taunt?: boolean;
}

export interface BuffKeywordEffect {
  kind: "buffKeyword";
  keyword: "divineShield";
  attack: number;
  health: number;
}

export interface SummonEffect {
  kind: "summon";
  definitionId: string;
  count: number | "sourceAttack";
  immediateAttack?: boolean;
  taunt?: boolean;
  /**
   * Golden summon text is card-specific: some cards summon a Golden token,
   * while others summon twice as many regular tokens.
   */
  goldenMode?: "goldenToken" | "doubleCount";
}

export interface GrantShieldEffect {
  kind: "grantShield";
  target: "self" | "randomFriendly";
}

export interface GainGoldEffect {
  kind: "gainGold";
  amount: number;
}

export interface GainNextTurnGoldEffect {
  kind: "gainNextTurnGold";
  amount: number;
}

export interface GainFreeRefreshesEffect {
  kind: "gainFreeRefreshes";
  count: number;
}

export interface GainTavernSpellEffect {
  kind: "gainTavernSpell";
  definitionId: string;
  count: number;
  goldenMode?: "doubleCount";
}

export interface GainRandomTavernSpellEffect {
  kind: "gainRandomTavernSpell";
  count: number;
  filter: {
    cost?: number;
    exactTier?: TavernTier;
    definitionIds?: readonly string[];
  };
  goldenMode?: "doubleCount";
}

export interface CastTavernSpellEffect {
  kind: "castTavernSpell";
  definitionId: string;
  /** Golden cards repeat the complete spell instead of doubling one buff. */
  goldenMode?: "repeat";
}

export interface BuffRandomHandMinionEffect {
  kind: "buffRandomHandMinion";
  attack: number;
  health: number;
}

export interface BuffOwnedTribeEffect {
  kind: "buffOwnedTribe";
  tribe: Tribe;
  attack: number;
  health: number;
}

export interface InstallTavernRefreshBuffEffect {
  kind: "installTavernRefreshBuff";
  attack: number;
  health: number;
  goldenMode?: "repeat";
}

export interface GainMinionEffect {
  kind: "gainMinion";
  definitionId: string;
  count: number;
  goldenMode?: "doubleCount";
}

export interface GainRandomGeneratedMinionEffect {
  kind: "gainRandomGeneratedMinion";
  definitionIds: readonly string[];
  count: number;
  goldenMode?: "doubleCount";
}

export interface DamageHeroEffect {
  kind: "damageHero";
  amount: number;
}

export interface DamageEnemyEffect {
  kind: "damageEnemy";
  amount: number;
  target: "random" | "highestHealth";
}

export interface GainMissingHealthEffect {
  kind: "gainMissingHealth";
  multiplier: number;
}

export interface ResummonMechsEffect {
  kind: "resummonMechs";
  count: number;
}

export interface SummonRandomDeathrattleEffect {
  kind: "summonRandomDeathrattle";
  count: number;
}

export interface GetRandomMinionEffect {
  kind: "getRandomMinion";
  count: number;
  filter: {
    tribe?: Tribe;
    magnetic?: true;
    battlecry?: true;
    exactTier?: TavernTier;
  };
  maximumTier: "ownerTavern";
  source: "sharedPool";
  goldenMode?: "doubleCount";
}

export interface GrantKeywordEffect {
  kind: "grantKeyword";
  keyword: "reborn";
  target: "otherFriendlyTribe";
  tribe: Tribe;
  count: number;
  goldenMode?: "doubleCount";
}

export interface RallyBuffEffect {
  kind: "buff";
  target: "rightFriendly";
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
}

export interface RallySummonFromHandEffect {
  kind: "summonFromHand";
  selection: "highestAttack";
  count: number;
  goldenMode?: "doubleCount";
}

export type RallyRemovedKeyword = "reborn" | "taunt" | "stealth";

export interface RallyRemoveTargetKeywordsEffect {
  kind: "removeTargetKeywords";
  keywords: readonly RallyRemovedKeyword[];
}

export interface RallyGainTargetAttackEffect {
  kind: "gainTargetAttack";
}

export interface RallyCastChefsChoiceEffect {
  kind: "castChefsChoice";
  target: "rightFriendly";
  goldenMode?: "repeat";
}

export interface RallyGrantVenomousEffect {
  kind: "grantVenomous";
  target: "otherFriendlyTribe";
  tribe: Tribe;
  count: number;
  goldenMode?: "doubleCount";
}

export interface RallyGrantSourceAttackEffect {
  kind: "grantSourceAttack";
  target: "otherFriendly";
  count: number;
  goldenMode?: "repeat";
}

export interface RallyGrantSourceMaxHealthEffect {
  kind: "grantSourceMaxHealth";
  target: "otherFriendlyTribe";
  tribe: Tribe;
  count: number;
  goldenMode?: "repeat";
}

export interface RallyTriggerLeftmostDeathrattleEffect {
  kind: "triggerLeftmostDeathrattle";
  goldenMode?: "repeat";
}

export type RallyEffect =
  | GetRandomMinionEffect
  | GainRandomTavernSpellEffect
  | CastTavernSpellEffect
  | RallyBuffEffect
  | RallySummonFromHandEffect
  | RallyRemoveTargetKeywordsEffect
  | RallyGainTargetAttackEffect
  | RallyCastChefsChoiceEffect
  | RallyGrantVenomousEffect
  | RallyGrantSourceAttackEffect
  | RallyGrantSourceMaxHealthEffect
  | RallyTriggerLeftmostDeathrattleEffect
  | ImproveUndeadArmyEffect
  | ImproveBloodGemsEffect;

export interface BuffFriendlyAttackerEffect {
  kind: "buffAttacker";
  tribe?: Tribe;
  otherOnly?: boolean;
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
}

export type FriendlyAttackTriggerEffect =
  | BuffFriendlyAttackerEffect
  | CastTavernSpellEffect;

export interface ExcessDamageToAdjacentEffect {
  kind: "excessDamageToAdjacent";
  goldenMode?: "bothAdjacent";
}

export interface DamageAllMinionsEffect {
  kind: "damageAllMinions";
  amount: number;
  excludeFriendlyTribe?: Tribe;
  /** Some Golden cards repeat the damage instead of combining it into one hit. */
  goldenMode?: "doubleDamage" | "repeat";
}

export interface GainBloodGemsEffect {
  kind: "gainBloodGems";
  count: number;
  bonusKeyword?: BloodGemBonusKeyword;
}

export interface ImproveBloodGemsEffect {
  kind: "improveBloodGems";
  attack: number;
  health: number;
}

export interface ImproveBeetlesEffect {
  kind: "improveBeetles";
  attack: number;
  health: number;
}

export interface ApplyBloodGemsToTribeEffect {
  kind: "applyBloodGemsToTribe";
  tribe: Tribe;
  count: number;
}

export interface ImproveTavernSpellBuffsEffect {
  kind: "improveTavernSpellBuffs";
  attack: number;
  health: number;
}

export interface ImproveBallersEffect {
  kind: "improveBallers";
  attack: number;
  health: number;
}

export interface BuffTavernEffect {
  kind: "buffTavern";
  attack: number;
  health: number;
  goldenMode?: "repeat";
}

export interface BuffTavernTypeEffect {
  kind: "buffTavernType";
  tribe: Tribe;
  attack: number;
  health: number;
  goldenMode?: "repeat";
}

export interface ImproveUndeadArmyEffect {
  kind: "improveUndeadArmy";
  attack: number;
  health: number;
}

export interface ConsumeRandomShopMinionEffect {
  kind: "consumeRandomShopMinion";
  goldenMode?: "doubleStats";
}

export interface QueueDemonFodderEffect {
  kind: "queueDemonFodder";
  refreshes: number;
  count: number;
  goldenMode?: "doubleCount";
}

export interface DiscountNextTavernSpellEffect {
  kind: "discountNextTavernSpell";
  amount: number;
}

export interface MakeSelfGoldenEffect {
  kind: "makeSelfGolden";
}

export type MinionEffect =
  | BuffEffect
  | SummonEffect
  | GrantShieldEffect
  | GainGoldEffect
  | GainNextTurnGoldEffect
  | GainFreeRefreshesEffect
  | GainTavernSpellEffect
  | GainRandomTavernSpellEffect
  | CastTavernSpellEffect
  | BuffRandomHandMinionEffect
  | BuffOwnedTribeEffect
  | InstallTavernRefreshBuffEffect
  | GainMinionEffect
  | GainRandomGeneratedMinionEffect
  | DamageHeroEffect
  | DamageEnemyEffect
  | GainMissingHealthEffect
  | ResummonMechsEffect
  | SummonRandomDeathrattleEffect
  | GetRandomMinionEffect
  | GrantKeywordEffect
  | DamageAllMinionsEffect
  | GainBloodGemsEffect
  | ImproveBloodGemsEffect
  | ImproveBeetlesEffect
  | ApplyBloodGemsToTribeEffect
  | ImproveTavernSpellBuffsEffect
  | ImproveBallersEffect
  | BuffTavernEffect
  | BuffTavernTypeEffect
  | ImproveUndeadArmyEffect
  | ConsumeRandomShopMinionEffect
  | QueueDemonFodderEffect
  | DiscountNextTavernSpellEffect
  | MakeSelfGoldenEffect;

export interface TargetedBuffBattlecry {
  kind: "targetedBuff";
  target: "otherFriendly" | "friendlyTribe";
  targetTribe?: Tribe;
  attack: number;
  health: number;
  attackPerTavernSpell: number;
  healthPerTavernSpell: number;
  attackPerGoldSpentThisTurn?: number;
  healthPerGoldSpentThisTurn?: number;
  goldenMode: "repeat";
}

export interface DiscoverMinionBattlecry {
  kind: "discoverMinion";
  tribe: Tribe;
  requiresOtherTribe?: Tribe;
  goldenMode: "repeat";
}

export interface TargetedDiscoverMagnetizeBattlecry {
  kind: "targetedDiscoverMagnetize";
  targetTribe: Tribe;
  discoverTribe: Tribe;
  goldenMode: "repeat";
}

export type InteractiveBattlecry =
  | TargetedBuffBattlecry
  | DiscoverMinionBattlecry
  | TargetedDiscoverMagnetizeBattlecry;

export interface FriendlyTribeTrigger {
  tribe: Tribe;
  attack?: number;
  health?: number;
  heroDamage?: number;
  gainBloodGems?: number;
  damageEnemy?: number;
  damageTarget?: "random" | "highestHealth";
  grantShield?: boolean;
}

export interface FriendlyDeathTrigger {
  tribe?: Tribe;
  taunt?: true;
  deathrattle?: true;
  attack?: number;
  health?: number;
  damageEnemy?: number;
  damageTarget?: "random" | "highestHealth";
  effects?: readonly MinionEffect[];
}

export interface FriendlyCombatDeathTrigger {
  attack: number;
  health: number;
}

export type AvengeEffect =
  | GainRandomGeneratedMinionEffect
  | GainTavernSpellEffect
  | SummonEffect
  | ApplyBloodGemsToTribeEffect;

export interface AvengeTrigger {
  threshold: number;
  effects: readonly AvengeEffect[];
}

export interface CardPlayedFilter {
  tribe?: Tribe;
  tierParity?: TierParity;
  maximumTier?: TavernTier;
}

export interface CardPlayedTrigger {
  filter: CardPlayedFilter;
  effects: readonly MinionEffect[];
}

export interface GoldSpentThresholdTrigger {
  threshold: number;
  effects: readonly MinionEffect[];
}

export interface MenagerieEndOfTurnEffect {
  kind: "onePerTribe";
  attack: number;
  health: number;
}

export interface ImproveStartOfCombatBuffEffect {
  kind: "improveStartOfCombatBuff";
  attack: number;
  health: number;
}

export type AfterTavernSpellCastEffect =
  | BuffEffect
  | MenagerieEndOfTurnEffect
  | BuffKeywordEffect
  | ImproveUndeadArmyEffect
  | ImproveStartOfCombatBuffEffect;

export interface BuffEndOfTurnEffect {
  kind: "buff";
  target: "self" | "adjacentFriendly";
  attack: number;
  health: number;
  repeatPerGoldenFriendly?: boolean;
}

export interface PeriodicGainRandomMinionEndOfTurnEffect {
  kind: "periodicGainRandomMinion";
  everyTurns: number;
  count: number;
  tribe: Tribe;
  goldenMode?: "doubleCount";
}

export interface ConsumeHighestHealthShopEffect {
  kind: "consumeHighestHealthShop";
  goldenMode?: "doubleStats";
}

export interface DemonsConsumeShopEffect {
  kind: "demonsConsumeShop";
  goldenMode?: "doubleStats";
}

export interface CopyLeftOriginalEffect {
  kind: "copyLeftOriginal";
  everyTurns: number;
  goldenMode?: "adjacent";
}

export interface DestroyAndResummonLeftUndeadEffect {
  kind: "destroyAndResummonLeftUndead";
  goldenMode?: "adjacentUndead";
}

export interface CopyLastTavernSpellEffect {
  kind: "copyLastTavernSpell";
  count: number;
  goldenMode?: "doubleCount";
}

export interface GainRandomOrAllMinionEffect {
  kind: "gainRandomOrAllMinion";
  definitionIds: readonly string[];
  goldenMode?: "all";
}

export interface DynamicWarbandEndOfTurnEffect {
  kind: "dynamicWarbandEndOfTurn";
  attack: number;
  health: number;
  avengeThreshold: number;
  avengeAttack: number;
  avengeHealth: number;
}

export interface LeftmostTribeRepeatPerCardPlayedEffect {
  kind: "leftmostTribeRepeatPerCardPlayed";
  tribe: Tribe;
  attack: number;
  health: number;
}

export interface ApplyBloodGemToAllPerBonusKeywordEffect {
  kind: "applyBloodGemToAllPerBonusKeyword";
  count: number;
  goldenMode?: "doubleCount";
}

export type EndOfTurnEffect =
  | MenagerieEndOfTurnEffect
  | BuffEndOfTurnEffect
  | GainBloodGemsEffect
  | GainTavernSpellEffect
  | GainRandomTavernSpellEffect
  | ImproveTavernSpellBuffsEffect
  | PeriodicGainRandomMinionEndOfTurnEffect
  | QueueDemonFodderEffect
  | ConsumeHighestHealthShopEffect
  | DemonsConsumeShopEffect
  | CopyLeftOriginalEffect
  | DestroyAndResummonLeftUndeadEffect
  | CopyLastTavernSpellEffect
  | GainRandomOrAllMinionEffect
  | DynamicWarbandEndOfTurnEffect
  | LeftmostTribeRepeatPerCardPlayedEffect
  | ApplyBloodGemToAllPerBonusKeywordEffect;

export interface CardPurchaseMilestoneEffect {
  purchases: number;
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
}

export interface InHandStartOfCombatEffect {
  kind: "summonSelfCopy";
  goldenMode?: "doubleStats";
}

export interface StartOfCombatBuffRandomOtherTribeEffect {
  kind: "buffRandomOtherTribe";
  tribe: Tribe;
  attack: number;
  health: number;
  divineShield?: boolean;
  count: number;
  goldenMode?: "doubleCount";
}

export interface StartOfCombatGainHighestHandAttackEffect {
  kind: "gainHighestHandAttack";
  goldenMode?: "doubleAmount";
}

export interface StartOfCombatGainAllHandMinionStatsEffect {
  kind: "gainAllHandMinionStats";
  goldenMode?: "doubleAmount";
}

export interface StartOfCombatSummonHighestAttackHandTribeEffect {
  kind: "summonHighestAttackHandTribeWhenSpace";
  tribe: Tribe;
  count: number;
  goldenMode?: "doubleCount";
}

export interface StartOfCombatGrowingTribeBuffEffect {
  kind: "growingTribeBuff";
  tribe: Tribe;
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
}

export type StartOfCombatEffect =
  | BuffEffect
  | GrantShieldEffect
  | StartOfCombatBuffRandomOtherTribeEffect
  | StartOfCombatGainHighestHandAttackEffect
  | StartOfCombatGainAllHandMinionStatsEffect
  | StartOfCombatSummonHighestAttackHandTribeEffect
  | StartOfCombatGrowingTribeBuffEffect;

export interface CombatEnchantmentRetentionEffect {
  target: "self" | "adjacentFriendlyTribe";
  tribe?: Tribe;
  goldenMode?: "doubleStats";
}

export interface ConditionalKeywordEffect {
  attackAtLeast: number;
  keyword: "divineShield";
}

export interface StatAura {
  tribe: Tribe;
  attack: number;
  health: number;
  otherOnly?: boolean;
}

export interface MagneticSpec {
  targetTribes: readonly Tribe[];
}

export interface SpellcraftSpec {
  definitionId: string;
}

export interface BloodGemImproveOrGainChoice {
  kind: "bloodGemImproveOrGain";
  attack: number;
  health: number;
  count: number;
  goldenMode?: "doubleValues";
}

export interface BloodGemFromHandAura {
  extraCasts: number;
  goldenMode?: "doubleCount";
}

export interface AfterBloodGemCastOnSelfEffect {
  kind: "playBloodGemsOnRandomOther";
  count: number;
  goldenMode?: "doubleCount";
}

export interface MinionDefinition {
  id: string;
  /** Hearthstone CardID used only to locate the familiar card artwork. */
  cardId: string;
  /** Real premium CardID when the Golden card has distinct artwork. */
  goldenCardId?: string;
  name: string;
  tier: TavernTier;
  /** Primary type retained for the current single-type engine compatibility. */
  tribe: Tribe;
  /** Printed minion types. Empty means the card is typeless. */
  tribes?: readonly Tribe[];
  /** Type-specific pool affinity for a printed typeless support minion. */
  associatedTribes?: readonly Tribe[];
  /** Whether all card-text behavior is represented by the current rules DSL. */
  effectSupport?: EffectSupport;
  /** Printed client mechanics retained for pool-wide Discover filters. */
  printedMechanics?: readonly string[];
  /** Whether the live card uses Hearthstone's legendary border. */
  legendary?: boolean;
  attack: number;
  health: number;
  description: string;
  /** Printed Golden text when its values or completion state differ. */
  goldenDescription?: string;
  taunt?: boolean;
  divineShield?: boolean;
  reborn?: boolean;
  stealth?: boolean;
  poisonous?: boolean;
  venomous?: boolean;
  windfury?: boolean;
  cleave?: boolean;
  alwaysAttacksLowestAttack?: boolean;
  battlecry?: readonly MinionEffect[];
  interactiveBattlecry?: InteractiveBattlecry;
  deathrattle?: readonly MinionEffect[];
  afterFriendlyPlayed?: FriendlyTribeTrigger;
  afterCardPlayed?: CardPlayedTrigger;
  inHandAfterCardPlayed?: CardPlayedTrigger;
  afterGoldSpent?: GoldSpentThresholdTrigger;
  afterFriendlySummoned?: FriendlyTribeTrigger;
  afterFriendlyDied?: FriendlyDeathTrigger;
  afterFriendlyCombatDied?: FriendlyCombatDeathTrigger;
  afterFriendlyAttacks?: readonly FriendlyAttackTriggerEffect[];
  afterAttackKills?: ExcessDamageToAdjacentEffect;
  avenge?: AvengeTrigger;
  afterSelfDamaged?: readonly MinionEffect[];
  afterTavernSpellCast?: readonly AfterTavernSpellCastEffect[];
  startOfTurn?: readonly MinionEffect[];
  startOfCombat?: readonly StartOfCombatEffect[];
  combatEnchantmentRetention?: CombatEnchantmentRetentionEffect;
  inHandStartOfCombat?: InHandStartOfCombatEffect;
  rally?: readonly RallyEffect[];
  endOfTurn?: EndOfTurnEffect;
  afterCardPurchased?: CardPurchaseMilestoneEffect;
  conditionalKeyword?: ConditionalKeywordEffect;
  afterSold?: readonly MinionEffect[];
  afterFriendlySold?: readonly MinionEffect[];
  afterMagnetized?: readonly MinionEffect[];
  aura?: StatAura;
  magnetic?: MagneticSpec;
  spellcraft?: SpellcraftSpec;
  /** A non-Battlecry choice that resolves only when this minion is played. */
  onPlayChoice?: BloodGemImproveOrGainChoice;
  /** Extra full pulses for a Blood Gem played from hand. */
  bloodGemFromHandAura?: BloodGemFromHandAura;
  /** Observer invoked after each real Blood Gem pulse lands on this minion. */
  afterBloodGemCastOnSelf?: AfterBloodGemCastOnSelfEffect;
  extraBattlecries?: number;
  extraDeathrattles?: number;
  extraEndOfTurnTriggers?: number;
  sellValue?: number;
  goldenSellValue?: number;
  /** A generated Fodder feeds itself while offered instead of entering the pool. */
  shopFodder?: boolean;
  collectible?: boolean;
}

/**
 * The complete, JSON-safe representation of a minion owned by a player or
 * reserved in a shop. Combat works on cloned instances, never on the permanent
 * board itself.
 */
/**
 * Shared visual/card fields used by both board minions and the Triple Reward
 * spell. Runtime minion factories always set `kind: "minion"`; the wider
 * discriminator keeps the existing card renderer compatible while hand cards
 * become a serializable union.
 */
export interface MinionInstance {
  kind: "minion" | "tripleReward";
  instanceId: string;
  definitionId: string;
  cardId: string;
  name: string;
  tier: TavernTier;
  tribe: Tribe;
  tribes: Tribe[];
  associatedTribes: Tribe[];
  effectSupport: EffectSupport;
  sellValue: number;
  attack: number;
  health: number;
  golden: boolean;
  taunt: boolean;
  divineShield: boolean;
  reborn: boolean;
  /** Reserved for the Bonus Keyword set even before stealth-granting cards land. */
  stealth?: boolean;
  poisonous: boolean;
  venomous: boolean;
  windfury: boolean;
  cleave: boolean;
  alwaysAttacksLowestAttack: boolean;
  description: string;
  /** Derived "wherever this is" stats already represented in attack/health. */
  whereverAttackBonus?: number;
  whereverHealthBonus?: number;
  /** Whether this Astral Automaton has already contributed to its owner count. */
  astralAutomatonSummoned?: boolean;
  /** Friendly deaths observed while this Ancient Soul was held in hand. */
  ancientSoulFriendlyDeaths?: number;
  /** JSON-safe progress for card-specific counters such as "every 3 turns". */
  effectCounters?: Record<string, number>;
  /** Total permanent stats on this minion that came specifically from Blood Gems. */
  bloodGemAttack: number;
  bloodGemHealth: number;
  /** Spellcraft enchantments remain for combat, then expire next Recruit phase. */
  temporaryAttack: number;
  temporaryHealth: number;
  temporaryTaunt: boolean;
  temporaryDivineShield: boolean;
  /** Temporary "Deathrattle: summon a 3/2 Crab" effects from Crab Rider. */
  temporaryCrabDeathrattles: number;
  /** Temporary Golden Crab Rider deathrattles that summon one 6/4 Crab. */
  temporaryGoldenCrabDeathrattles?: number;
  /** A hand minion cannot be played before this Recruit round. */
  playableFromRound?: number;
  /** Stir the Graveyard destroys this minion if it is played through this round. */
  destroyAfterPlayThroughRound?: number;
  /**
   * True only for a Golden minion produced by combining three owned copies.
   * Combat/token Golden minions never grant a Triple Reward.
   */
  grantsTripleReward: boolean;
  /**
   * Number of base copies represented in the shared pool. It is 1 for a
   * regular purchased minion, 3 for a golden minion, and 0 for combat tokens.
   */
  poolCopies: number;
  /**
   * Wisdomball overflow is not in the pool while offered, but becomes one
   * returnable shared-pool copy if the player acquires it.
   */
  poolCopiesOnPurchase?: number;
  /**
   * Minions fused into this host through Magnetic. The tree retains each
   * component's own Golden state while the host keeps its identity, Tavern
   * Tier, sell value, and visible card art. Under current Battlegrounds rules,
   * a component normally has zero poolCopies because its copies return to the
   * shared pool immediately when Magnetized.
   */
  attachments: MagneticAttachment[];
}

export interface MagneticAttachment {
  sourceInstanceId: string;
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  effectSupport: EffectSupport;
  golden: boolean;
  poolCopies: number;
  /**
   * The component's own stat contribution, excluding nested attachments.
   * Summing the complete attachment tree therefore reproduces the total stats
   * that were transferred to the host.
   */
  attackGranted: number;
  healthGranted: number;
  attachments: MagneticAttachment[];
}

export type BoardMinionInstance = MinionInstance & { kind: "minion" };

export interface TripleRewardSpellInstance extends MinionInstance {
  kind: "tripleReward";
  cardId: "TB_BaconShop_Triples_01";
  definitionId: "triple-reward";
}

export type SpellFamily =
  | "bloodGem"
  | "tavern"
  | "spellcraft"
  | "coin";

export type BloodGemBonusKeyword =
  | "rebornForQuilboar"
  | "divineShieldForQuilboar";

export interface BloodGemSpellInstance {
  kind: "bloodGem";
  instanceId: string;
  definitionId: "blood-gem";
  cardId: "BG20_GEM";
  name: "鲜血宝石";
  description: string;
  spellFamily: "bloodGem";
  bonusKeyword?: BloodGemBonusKeyword;
}

export interface ConsolationCoinSpellInstance {
  kind: "consolationCoin";
  instanceId: string;
  definitionId: "consolation-coin";
  cardId: "BG28_521t";
  name: "补贴铸币";
  description: string;
  spellFamily: "coin";
}

export type SpellcraftEffect =
  | "crabRider"
  | "anglersLure"
  | "glowingCrown"
  | "sickRiffs"
  | "deepBlueBlues"
  | "escapeEruption"
  | "evolvingStrategy"
  | "meditation"
  | "rimeOrReason";

export type SpellcraftTarget = "none" | "friendly";

export interface SpellcraftDefinition {
  id: string;
  cardId: string;
  goldenCardId?: string;
  name: string;
  description: string;
  goldenDescription?: string;
  /** Tavern Tier of the active Naga that normally generates this spell. */
  sourceTier: TavernTier;
  effect: SpellcraftEffect;
  target: SpellcraftTarget;
}

export interface SpellcraftSpellInstance {
  kind: "spellcraft";
  instanceId: string;
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  spellFamily: "spellcraft";
  target: SpellcraftTarget;
  /** Missing on older saves means the ordinary x1 version. */
  effectMultiplier?: number;
}

export type TavernSpellEffect =
  | "discoverTierOne"
  | "stealRandomShopMinion"
  | "fortify"
  | "pointyArrow"
  | "recruitTrainee"
  | "gainOneGold"
  | "tavernDishBanana"
  | "themApples"
  | "chefsChoice"
  | "hastyExcavation"
  | "searchThePast"
  | "freeRefreshes"
  | "mightOfStormwind"
  | "increaseMaxGold"
  | "carefulInvestment"
  | "fleetingVigor"
  | "friendlyBounty"
  | "healthyBounty"
  | "hostileBounty"
  | "selfishBounty"
  | "shinyRing"
  | "staffOfEnrichment"
  | "trickyTrousers"
  | "gainTwoGold"
  | "planarTelescope"
  | "hubris"
  | "carefulMutation"
  | "timeManagement"
  | "stackedAvalanche"
  | "bloodGemBarrage"
  | "cloneHorn"
  | "beetleBlessing"
  | "slimySeafood"
  | "gemConfiscation"
  | "backToBack"
  | "deepwaterClan"
  | "defendersRites"
  | "misplacedTeaSet"
  | "naturalBlessing"
  | "shiftingTide"
  | "temperatureShift"
  | "rideTheWind"
  | "stirTheGraveyard"
  | "blazingInferno"
  | "arcaneAbsorption"
  | "eonarsFavor"
  | "armorStash"
  | "overpowered"
  | "slaughter"
  | "corruptedCupcakes"
  | "goldenTouch"
  | "saloonsFinest"
  | "reservedCorpse"
  | "headhunter"
  | "nozdormusProgeny"
  | "invokeTheDevourer"
  | "unmaskedIdentity"
  | "queensCommand"
  | "sanctify"
  | "waveOfGold"
  | "azeriteEmpowerment"
  | "perfectVision"
  | "knockoffWisdomball"
  | "eyesOfTheEarthMother"
  | "lostStaffOfHamuul";

export type TavernSpellTarget = "none" | "friendly" | "anyMinion";

export interface TavernSpellDefinition {
  id: string;
  cardId: string;
  name: string;
  tier: TavernTier;
  cost: number;
  description: string;
  effectSupport: EffectSupport;
  /** Reader-facing boundary when the local rule is intentionally incomplete. */
  implementationNote?: string;
  effect: TavernSpellEffect;
  target: TavernSpellTarget;
  /** Omitted for Gold. Hasty Excavation is bought with Health instead. */
  purchaseCurrency?: "health";
  /** Tribe-gated spells enter only lobbies containing one of these types. */
  associatedTribes?: readonly Tribe[];
}

export interface TavernSpellInstance {
  kind: "tavernSpell";
  instanceId: string;
  definitionId: string;
  cardId: string;
  name: string;
  tier: TavernTier;
  cost: number;
  description: string;
  spellFamily: "tavern";
  target: TavernSpellTarget;
}

export type HeroPowerEffect =
  | "upgradeDiscount"
  | "freeRefreshAtTurnStart"
  | "gainGoldAfterUpgrade"
  | "buffCombatSummons";

export interface HeroPowerDefinition {
  id: string;
  cardId: string;
  name: string;
  description: string;
  effect: HeroPowerEffect;
}

export type HandCardInstance =
  | BoardMinionInstance
  | TripleRewardSpellInstance
  | BloodGemSpellInstance
  | ConsolationCoinSpellInstance
  | SpellcraftSpellInstance
  | TavernSpellInstance;

export interface TavernRefreshBuff {
  attack: number;
  health: number;
}

export interface TavernTypeBuff extends TavernRefreshBuff {
  tribes: Tribe[];
}

export type HelpfulRefreshKind =
  | "warbandCopies"
  | "legendary"
  | "golden"
  | "triple"
  | "divineShield"
  | "tavernBuff"
  | "majorityTribe"
  | "highTier"
  | "allSame"
  | "utility"
  | "allSpells";

export interface PendingSpellcraftGrant {
  sourceInstanceId: string;
  definitionId: string;
  golden: boolean;
  round: number;
}

export interface PendingCardPlayedEvent {
  sourceInstanceId: string;
  cardKind: "minion" | "tavernSpell" | "other";
  tier?: TavernTier;
  tribe?: Tribe;
  tribes: Tribe[];
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  isHuman: boolean;
  health: number;
  /** Damage removes Armor before Health. Paying Health never spends Armor. */
  armor: number;
  alive: boolean;
  /** Null is the local game's neutral starting power. */
  heroPowerId: string | null;
  tavernTier: TavernTier;
  gold: number;
  board: BoardMinionInstance[];
  hand: HandCardInstance[];
  /**
   * Minion-only, zero-pool-ownership hand snapshot retained when this player
   * becomes a ghost. Combat may read it, but no game action mutates it.
   */
  ghostHand: BoardMinionInstance[];
  /**
   * Spellcraft waits here when the hand is full and materializes as soon as a
   * slot opens during the same Recruit turn.
   */
  pendingSpellcraft: PendingSpellcraftGrant[];
  shop: BoardMinionInstance[];
  /** One extra Tavern Spell offer, matching the live Battlegrounds shop. */
  spellShop: TavernSpellInstance | null;
  /** Saloon's Finest can reserve several additional spell offers at once. */
  additionalSpellShop: TavernSpellInstance[];
  /** Those spell offers temporarily occupy the Tavern's normal minion slots. */
  spellOnlyRefreshActive: boolean;
  frozen: boolean;
  upgradeDiscount: number;
  /** Gold reduction retained until the next Gold-cost Tavern Spell purchase. */
  nextTavernSpellDiscount: number;
  tavernSpellsCastThisTurn: number;
  /** Every successfully played hand card this Recruit turn. */
  cardsPlayedThisTurn: number;
  /** Gold actually deducted during this Recruit turn. */
  goldSpentThisTurn: number;
  /** A played card whose interactive effect has not finished resolving yet. */
  pendingCardPlayed: PendingCardPlayedEvent | null;
  /** Most recently cast Tavern Spell; generated copies do not consume its pool. */
  lastTavernSpellDefinitionId: string | null;
  /** Tavern Spell whose interactive resolution has not completed yet. */
  pendingTavernSpellDefinitionId: string | null;
  /**
   * Fodder counts for successive manual Refreshes. Each queue slot is consumed
   * by one successful Refresh action, including a helpful Wisdomball page.
   */
  demonFodderRefreshQueue: number[];
  /** Recruit-turn economy and persistent Tavern Spell counters. */
  maxGold: number;
  pendingNextTurnGold: number;
  freeRefreshes: number;
  /** Remaining successful manual Refreshes replaced by Wisdomball pages. */
  helpfulRefreshes: number;
  /** Most recent page, retained for deterministic feedback and save restore. */
  lastHelpfulRefreshKind: HelpfulRefreshKind | null;
  tavernMinionAttackBonus: number;
  tavernMinionHealthBonus: number;
  nextCombatAttackBonus: number;
  nextCombatHealthBonus: number;
  nextCombatSetEnemyHealthToOne: number;
  nextCombatDoubleLeftmostAttack: TavernRefreshBuff[];
  nextCombatWinGold: number;
  nextCombatTieGold: number;
  nextTurnBoardAttackBonus: number;
  nextTurnBoardHealthBonus: number;
  nextTurnBoardBuffPulses: number;
  /** Number of persistent Blood Gem Barrage refresh triggers. */
  tavernBloodGemBarrageCount: number;
  /**
   * Cast-time Tavern Spell bonuses are stored separately; each refresh reads
   * the player's current Blood Gem value for every active Barrage.
   */
  tavernBloodGemBarrageAttack: number;
  tavernBloodGemBarrageHealth: number;
  backToBackBonus: number;
  tavernSpellAttackBonus: number;
  tavernSpellHealthBonus: number;
  tavernTypeBuffs: TavernTypeBuff[];
  rideTheWindBuffs: TavernRefreshBuff[];
  elementalsPlayedThisTurn: number;
  nextCombatBeetles: number;
  /** Permanent game-wide stats granted to every Beetle token. */
  beetleAttackBonus: number;
  beetleHealthBonus: number;
  ballerAttackBonus: number;
  ballerHealthBonus: number;
  deepBlueBonus: number;
  /** Permanent "wherever they are" stats granted by Slaughter. */
  undeadArmyAttackBonus: number;
  undeadArmyHealthBonus: number;
  /** Persistent game-wide history used by Astral Automaton and Eternal Knight. */
  astralAutomatonsSummoned: number;
  eternalKnightsDied: number;
  /** Permanent per-player Blood Gem values; new Gems read these on cast. */
  bloodGemAttack: number;
  bloodGemHealth: number;
  lastOpponentId?: PlayerId;
  eliminatedRound?: number;
  placement?: number;
}

export type BattleEventType =
  | "battleStart"
  | "startOfCombat"
  | "attack"
  | "avenge"
  | "trigger"
  | "tavernSpellCast"
  | "damage"
  | "buff"
  | "handBuff"
  | "keywordRemoved"
  | "shieldBroken"
  | "death"
  | "summon"
  | "cardGain"
  | "goldReward"
  | "heroDamage"
  | "battleEnd";

export type CardGainResult = "added" | "handFull" | "noCandidate";

/**
 * Battle events deliberately contain IDs and a readable fallback message.
 * A simple UI can render `message`; an animated UI can use the structured
 * fields and the battle's initial boards.
 */
export interface BattleEvent {
  index: number;
  type: BattleEventType;
  message: string;
  actorPlayerId?: PlayerId;
  actorInstanceId?: string;
  targetPlayerId?: PlayerId;
  targetInstanceId?: string;
  amount?: number;
  armorAbsorbed?: number;
  healthDamage?: number;
  attackDelta?: number;
  healthDelta?: number;
  boardIndex?: number;
  /** Updated source snapshot when an event consumes or changes the actor. */
  actorMinion?: MinionInstance;
  /** Updated target snapshot used by combat playback. */
  minion?: MinionInstance;
  cardName?: string;
  cardKind?: "minion" | "tavernSpell" | "bloodGem";
  summonReason?:
    | "reborn"
    | "rallyFromHand"
    | "startOfCombatFromHand"
    | "inHandStartOfCombat"
    | "beetle"
    | "spellcraft";
  removedKeywords?: RallyRemovedKeyword[];
  cardGainResult?: CardGainResult;
  /** This combat enchantment will be written back to the Recruit minion. */
  retained?: boolean;
  /** Golden Tarecgosa/Poet retain twice the gained Attack and Health. */
  retentionMultiplier?: 0 | 1 | 2;
  /** This event permanently improved a persistent card effect or global ledger. */
  permanentEffectImprovement?: boolean;
}

interface PendingInteractionBase {
  interactionId: string;
  playerId: PlayerId;
  sourceInstanceId: string;
}

export interface PendingTargetInteraction extends PendingInteractionBase {
  kind: "target";
  optionInstanceIds: string[];
  attack: number;
  health: number;
  repetitions: number;
}

export interface PendingMagnetizeTargetInteraction
  extends PendingInteractionBase {
  kind: "magnetizeTarget";
  optionInstanceIds: string[];
  filter: DiscoverFilter;
  remainingDiscoveries: number;
}

export interface DiscoverFilter {
  exactTier?: TavernTier;
  maximumTier?: TavernTier;
  tribe?: Tribe;
  ability?: "battlecry" | "deathrattle";
}

export type DiscoverDestination =
  | {
      kind: "hand";
      playableFromRound?: number;
      destroyAfterPlayThroughRound?: number;
    }
  | { kind: "magnetize"; targetInstanceId: string };

export interface PendingDiscoverInteraction extends PendingInteractionBase {
  kind: "discover";
  options: BoardMinionInstance[];
  filter: DiscoverFilter;
  remainingDiscoveries: number;
  destination: DiscoverDestination;
  /** Optional action completed only after the final chained discovery. */
  completionSource?: "tavernSpellCast";
}

export type TavernSpellChoiceId =
  | "timeManagementNow"
  | "timeManagementNextTurn";

export interface PendingTavernSpellChoiceInteraction
  extends PendingInteractionBase {
  kind: "tavernSpellChoice";
  definitionId: string;
  optionIds: TavernSpellChoiceId[];
}

export type SpellcraftChoiceId =
  | "escapeEruptionAttack"
  | "escapeEruptionHealth";

export interface PendingSpellcraftChoiceInteraction
  extends PendingInteractionBase {
  kind: "spellcraftChoice";
  definitionId: string;
  optionIds: SpellcraftChoiceId[];
  effectMultiplier?: number;
}

export interface PendingHeroPowerChoiceInteraction
  extends PendingInteractionBase {
  kind: "heroPowerChoice";
  definitionId: string;
  optionIds: string[];
}

export type MinionChoiceId =
  | "BG30_123t"
  | "BG30_123t2"
  | "BG30_123_Gt"
  | "BG30_123_Gt2";

export interface PendingMinionChoiceInteraction
  extends PendingInteractionBase {
  kind: "minionChoice";
  definitionId: string;
  optionIds: MinionChoiceId[];
  effectMultiplier: 1 | 2;
}

export type PendingInteraction =
  | PendingTargetInteraction
  | PendingMagnetizeTargetInteraction
  | PendingDiscoverInteraction
  | PendingTavernSpellChoiceInteraction
  | PendingSpellcraftChoiceInteraction
  | PendingHeroPowerChoiceInteraction
  | PendingMinionChoiceInteraction;

export type BattleResult = "win" | "loss" | "tie";

export interface HumanScoutingReport {
  opponentId: PlayerId;
  observedRound: number;
  resultForHuman: BattleResult;
  isGhost: boolean;
  /** The opposing warband exactly as the human saw it at combat start. */
  board: BoardMinionInstance[];
}

export interface ScheduledPairing {
  playerAId: PlayerId;
  playerBId: PlayerId;
  isGhost: boolean;
}

export interface BattleSummary {
  round: number;
  playerAId: PlayerId;
  playerBId: PlayerId;
  playerAName: string;
  playerBName: string;
  isGhost: boolean;
  winnerId: PlayerId | null;
  resultForHuman?: BattleResult;
  damageToPlayerA: number;
  damageToPlayerB: number;
  playerAHealthBefore: number;
  playerBHealthBefore: number;
  playerAHealthAfter: number;
  playerBHealthAfter: number;
  playerAArmorBefore: number;
  playerBArmorBefore: number;
  playerAArmorAfter: number;
  playerBArmorAfter: number;
  initialBoards: Record<PlayerId, MinionInstance[]>;
  finalBoards: Record<PlayerId, MinionInstance[]>;
  events: BattleEvent[];
}

export interface GameState {
  version: 11;
  /** Invalidates local saves when the roster or its mechanics change. */
  contentVersion: string;
  seed: number;
  rngState: number;
  nextInstanceId: number;
  nextInteractionId: number;
  phase: GamePhase;
  round: number;
  humanPlayerId: PlayerId;
  /** Five ordinary minion types enabled for this deterministic Solo lobby. */
  activeTribes: Tribe[];
  players: PlayerState[];
  /** Available (not owned and not reserved in a shop) copies by definition ID. */
  pool: Record<string, number>;
  /** Tavern Spells reserved in shops use their own tier-weighted shared pool. */
  spellPool: Record<string, number>;
  pendingInteraction: PendingInteraction | null;
  /** The human player's most recently resolved battle. */
  lastBattle: BattleSummary | null;
  /**
   * All battles resolved by the latest END_TURN action. The latest round is
   * retained during Recruit so AI can use only a personally observed previous
   * matchup for fair scouting, then replaced by the next combat round.
   */
  lastRoundBattles: BattleSummary[];
  /**
   * One private report per opponent, populated only by the human's own
   * combats. It must never be refreshed from an AI player's current board.
   */
  humanScoutingReports: Record<PlayerId, HumanScoutingReport>;
  winnerId: PlayerId | null;
}

export type GameAction =
  | { type: "BUY_MINION"; shopIndex: number }
  | { type: "BUY_TAVERN_SPELL"; spellInstanceId?: string }
  | { type: "SELL_MINION"; boardIndex: number }
  | { type: "PLAY_MINION"; handIndex: number; boardIndex?: number }
  | {
      type: "PLAY_HAND_CARD";
      cardInstanceId: string;
      boardIndex?: number;
    }
  | {
      type: "MAGNETIZE_MINION";
      cardInstanceId: string;
      targetInstanceId: string;
    }
  | {
      type: "CAST_BLOOD_GEM";
      cardInstanceId: string;
      targetInstanceId: string;
    }
  | {
      type: "CAST_TAVERN_SPELL";
      cardInstanceId: string;
      targetInstanceId?: string;
    }
  | {
      type: "CAST_SPELLCRAFT";
      cardInstanceId: string;
      targetInstanceId?: string;
    }
  | {
      type: "RESOLVE_INTERACTION";
      interactionId: string;
      optionInstanceId: string;
    }
  | { type: "REFRESH_SHOP" }
  | { type: "TOGGLE_FREEZE" }
  | { type: "UPGRADE_TAVERN" }
  | { type: "MOVE_MINION"; fromIndex: number; toIndex: number }
  | { type: "END_TURN" }
  | { type: "CONTINUE" };

/**
 * One real Recruit-phase Blood Gem resolution. These snapshots are emitted in
 * causal order for presentation only and never become part of GameState.
 */
export interface RecruitBloodGemPulseResolution {
  origin: "hand" | "roogug";
  sourceInstanceId: string;
  targetInstanceId: string;
  attackDelta: number;
  healthDelta: number;
  gainedKeywords: Array<"divineShield" | "reborn">;
  targetBefore: BoardMinionInstance;
  targetAfter: BoardMinionInstance;
}

export interface GameActionTrace {
  recruitBloodGemPulses: RecruitBloodGemPulseResolution[];
}

export interface GameTransition {
  state: GameState;
  trace: GameActionTrace;
}
