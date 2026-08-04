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

/** Tier 7 minions are effect-generated and never unlock a Tavern upgrade. */
export type MinionTier = TavernTier | 7;

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
  /** Golden sources repeat the complete buff event instead of doubling stats. */
  goldenMode?: "repeat";
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
  /** Apply real Blood Gem pulses to each successfully summoned token. */
  bloodGemsPerSummon?: number;
  /** Explicit Golden quantity when it differs from the ordinary token. */
  goldenBloodGemsPerSummon?: number;
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
  /** Limits trigger occurrences, not the number of free refreshes granted. */
  maxTriggersPerTurn?: number;
}

export interface GainTavernSpellEffect {
  kind: "gainTavernSpell";
  definitionId: string;
  count: number;
  goldenMode?: "doubleCount";
}

export interface GainGeneratedSpellEffect {
  kind: "gainGeneratedSpell";
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

export interface BuffTavernTierEffect {
  kind: "buffTavernTier";
  maximumTier: TavernTier;
  attack: number;
  health: number;
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

export interface SummonRandomMinionEffect {
  kind: "summonRandomMinion";
  filter: {
    tribe: Tribe;
  };
  setAttack: number;
  setHealth: number;
  /** Golden sources keep the summoned minion non-Golden and double set stats. */
  goldenMode?: "doubleSetStats";
}

export interface CastTavernSpellOnAdjacentEffect {
  kind: "castTavernSpellOnAdjacent";
  definitionId: string;
  /** Golden sources cast once on each surviving original neighbor. */
  goldenMode?: "allAdjacent";
}

/** Deathrattle payload used by Rylak Metalhead. */
export interface TriggerAdjacentBattlecriesEffect {
  kind: "triggerAdjacentBattlecries";
  /** Golden Rylak triggers both surviving original neighbors. */
  goldenMode?: "allAdjacent";
}

/** Avenge reward used by Deathly Striker; gained cards remember this source. */
export interface GainLinkedRandomMinionEffect {
  kind: "gainLinkedRandomMinion";
  tribe: Tribe;
  count: number;
  goldenMode?: "doubleCount";
}

/** Summons this source's still-linked hand cards as combat-only copies. */
export interface SummonLinkedHandMinionsEffect {
  kind: "summonLinkedHandMinions";
}

/** Summons the exact combat snapshots destroyed by this Stitched Salvager. */
export interface SummonStitchedSalvagerCopiesEffect {
  kind: "summonStitchedSalvagerCopies";
}

export interface BuffThenDamageFriendlyEffect {
  kind: "buffThenDamageFriendly";
  attack: number;
  health: number;
  damage: number;
  /** Restrict each pulse to minions matching at least one listed tribe. */
  tribes?: readonly Tribe[];
  /** Exclude the source when it is still present on the Recruit board. */
  otherOnly?: boolean;
  /** Number of complete buff-then-damage pulses for a regular source. */
  pulses?: number;
  /** Golden sources resolve twice the configured number of complete pulses. */
  goldenMode?: "repeat";
}

/** Combat-only Deathrattle payload used by Leeroy the Reckless. */
export interface DestroyKillerEffect {
  kind: "destroyKiller";
}

export interface BuffOtherFriendlyTribeByFamilyPlayedEffect {
  kind: "buffOtherFriendlyTribeByFamilyPlayed";
  family: "mrrglton";
  tribe: Tribe;
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
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
  maximumTier: "ownerTavern" | TavernTier;
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

export interface RallyBuffOneFriendlyPerTribeEffect {
  kind: "buffOneFriendlyPerTribe";
  attack: number;
  health: number;
  permanent: true;
  goldenMode?: "repeat";
}

export interface RallyDamageTargetAndAdjacentEffect {
  kind: "damageTargetAndAdjacent";
  goldenMode?: "bothAdjacent";
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
  | RallyBuffOneFriendlyPerTribeEffect
  | RallyDamageTargetAndAdjacentEffect
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

export interface ImproveElementalStatGrantsEffect {
  kind: "improveElementalStatGrants";
  attack: number;
  health: number;
}

export interface BuffFriendlyMechsByMagnetizationsEffect {
  kind: "buffFriendlyMechsByMagnetizations";
  /** Base combat-only Attack granted by each Deathrattle pulse. */
  attack: number;
  /** Additional Attack for every successful Magnetization this game. */
  attackPerMagnetization: number;
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
  /** Some Deathrattles are explicitly stronger outside combat. */
  outOfCombatMultiplier?: number;
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

export interface BuffSelfByPlayerSpellHistoryEffect {
  kind: "buffSelfByPlayerSpellHistory";
  attack: number;
  health: number;
  spellsPerUpgrade: number;
}

export interface ImproveTavernSpellAuraThisTurnEffect {
  kind: "improveTavernSpellAuraThisTurn";
  cardsRequired: number;
  attack: number;
  health: number;
}

export type MinionEffect =
  | BuffEffect
  | SummonEffect
  | GrantShieldEffect
  | GainGoldEffect
  | GainNextTurnGoldEffect
  | GainFreeRefreshesEffect
  | GainTavernSpellEffect
  | GainGeneratedSpellEffect
  | GainRandomTavernSpellEffect
  | CastTavernSpellEffect
  | BuffRandomHandMinionEffect
  | BuffOwnedTribeEffect
  | InstallTavernRefreshBuffEffect
  | BuffTavernTierEffect
  | GainMinionEffect
  | GainRandomGeneratedMinionEffect
  | DamageHeroEffect
  | DamageEnemyEffect
  | GainMissingHealthEffect
  | ResummonMechsEffect
  | SummonRandomDeathrattleEffect
  | SummonRandomMinionEffect
  | CastTavernSpellOnAdjacentEffect
  | TriggerAdjacentBattlecriesEffect
  | SummonLinkedHandMinionsEffect
  | SummonStitchedSalvagerCopiesEffect
  | BuffThenDamageFriendlyEffect
  | DestroyKillerEffect
  | BuffOtherFriendlyTribeByFamilyPlayedEffect
  | GetRandomMinionEffect
  | GrantKeywordEffect
  | DamageAllMinionsEffect
  | GainBloodGemsEffect
  | ImproveBloodGemsEffect
  | ImproveBeetlesEffect
  | ApplyBloodGemsToTribeEffect
  | ImproveTavernSpellBuffsEffect
  | ImproveBallersEffect
  | ImproveElementalStatGrantsEffect
  | BuffFriendlyMechsByMagnetizationsEffect
  | BuffTavernEffect
  | BuffTavernTypeEffect
  | ImproveUndeadArmyEffect
  | ConsumeRandomShopMinionEffect
  | QueueDemonFodderEffect
  | DiscountNextTavernSpellEffect
  | MakeSelfGoldenEffect
  | BuffSelfByPlayerSpellHistoryEffect
  | ImproveTavernSpellAuraThisTurnEffect;

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
  /** Resolve this after the chosen card enters hand and Triples are checked. */
  damageHeroByDiscoveredTier?: true;
  /** Still present choices when the hand is full; the chosen card is burned. */
  allowHandOverflow?: true;
  goldenMode: "repeat";
}

export interface DiscoverTavernSpellBattlecry {
  kind: "discoverTavernSpell";
  /** Tavern Spell discoveries are repeated for Golden copies and Battlecry doublers. */
  goldenMode: "repeat";
}

export interface TargetedDiscoverMagnetizeBattlecry {
  kind: "targetedDiscoverMagnetize";
  targetTribe: Tribe;
  discoverTribe: Tribe;
  goldenMode: "repeat";
}

export interface DestroyFriendlyAndCopyBattlecry {
  kind: "destroyFriendlyAndCopy";
  targetTribe: Tribe;
  copies: number;
  goldenMode: "doubleCopies";
}

export interface MakeFriendlyGoldenBattlecry {
  kind: "makeFriendlyGolden";
  maximumTier: TavernTier;
  targets: number;
  goldenMode: "doubleTargets";
}

export type InteractiveBattlecry =
  | TargetedBuffBattlecry
  | DiscoverMinionBattlecry
  | DiscoverTavernSpellBattlecry
  | TargetedDiscoverMagnetizeBattlecry
  | DestroyFriendlyAndCopyBattlecry
  | MakeFriendlyGoldenBattlecry;

export interface FriendlyTribeTrigger {
  tribe: Tribe;
  attack?: number;
  health?: number;
  /** This summon observer is inactive during the Recruit phase. */
  combatOnly?: boolean;
  /** Multiplies the summoned minion's current Attack in observer order. */
  attackMultiplier?: number;
  /** Golden multipliers are card-specific rather than ordinary x2 scaling. */
  goldenAttackMultiplier?: number;
  /** Permanently increases this source's future summoned-minion Attack bonus. */
  permanentAttackGrowth?: number;
  heroDamage?: number;
  gainBloodGems?: number;
  damageEnemy?: number;
  damageTarget?: "random" | "highestHealth";
  grantShield?: boolean;
  /** Grants the summoned minion this observer's Attack and maximum Health. */
  giveSourceMaximumStats?: boolean;
  maximumTriggersPerCombat?: number;
  goldenMode?: "doubleStats";
}

export interface FriendlyDamagedTrigger {
  /** Only damage to friendly minions of this type is observed. */
  tribe: Tribe;
  /** The damaged minion must not be the observer itself. */
  otherOnly?: boolean;
  target: "self" | "randomOtherFriendlyTribe";
  /** Required by randomOtherFriendlyTribe; the damaged minion is excluded. */
  targetTribe?: Tribe;
  attack: number;
  health: number;
  /** Printed permanent gains write directly to the original Recruit entity. */
  permanent?: boolean;
}

export interface FriendlyDamageDealtTrigger {
  /** Only actual damage dealt by a friendly minion of this type is observed. */
  tribe: Tribe;
  /** The damage source must not be this observer. */
  otherSourceOnly?: boolean;
  target: "self" | "allFriendlyExceptSource";
  attack: number;
  health: number;
  /** Printed permanent gains write directly to the original Recruit entity. */
  permanent?: boolean;
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
  | GainLinkedRandomMinionEffect
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
  /** Some after-play observers, unlike ordinary board watchers, see themselves. */
  includeSource?: boolean;
}

export interface BuffRandomOtherPirateAfterCardAddedTrigger {
  kind: "buffRandomOtherPirate";
  attack: number;
  health: number;
  /** Golden Pirates repeat the ordinary pulse so each pulse chooses a target. */
  goldenMode?: "repeat";
}

export interface BuffWarbandAfterTribeCardAddedTrigger {
  kind: "buffWarbandAfterTribeCardAdded";
  tribe: Tribe;
  attack: number;
  health: number;
  goldenTargetAttack: number;
  goldenTargetHealth: number;
  goldenMode?: "doubleStats";
}

export type CardAddedToHandTrigger =
  | BuffRandomOtherPirateAfterCardAddedTrigger
  | BuffWarbandAfterTribeCardAddedTrigger;

export interface MinionConsumedTrigger {
  tavernAttackThisTurn: number;
  tavernHealthThisTurn: number;
  goldenMode?: "doubleStats";
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

export interface GainUpgradingMagneticSatellitesEffect {
  kind: "gainUpgradingMagneticSatellites";
  definitionId: string;
  count: number;
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
}

export interface GiveStatsToLeftmostHandMinionEffect {
  kind: "giveStatsToLeftmostHandMinion";
  goldenMode?: "doubleStats";
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
  | ApplyBloodGemToAllPerBonusKeywordEffect
  | GainUpgradingMagneticSatellitesEffect
  | GiveStatsToLeftmostHandMinionEffect;

export interface CardPurchaseMilestoneEffect {
  purchases: number;
  attack: number;
  health: number;
  goldenMode?: "doubleStats";
}

export interface MinionPurchaseStatsEffect {
  timesPerTurn: number;
  attack: number;
  health: number;
  statMultiplier: number;
  goldenStatMultiplier: number;
}

export interface TavernSpellPurchaseTrigger {
  timesPerTurn: number;
  tokenDefinitionId: string;
  goldenMode?: "doubleLimit";
}

export interface FriendlyHealthGainTrigger {
  tribe: Tribe;
  otherOnly?: boolean;
  attackPerHealth: number;
  goldenMode?: "doubleStats";
}

export interface FriendlyAttackGainTrigger {
  tribe: Tribe;
  otherOnly?: boolean;
  health: number;
  goldenMode?: "doubleStats";
}

export interface BattlecryTriggeredTrigger {
  tribe: Tribe;
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

/** Stores and destroys the printed neighbor(s) for Stitched Salvager. */
export interface StartOfCombatStitchedSalvagerEffect {
  kind: "destroyNeighborsForStitchedSalvager";
  goldenMode?: "adjacent";
}

export type StartOfCombatEffect =
  | BuffEffect
  | GrantShieldEffect
  | StartOfCombatBuffRandomOtherTribeEffect
  | StartOfCombatGainHighestHandAttackEffect
  | StartOfCombatGainAllHandMinionStatsEffect
  | StartOfCombatSummonHighestAttackHandTribeEffect
  | StartOfCombatGrowingTribeBuffEffect
  | StartOfCombatStitchedSalvagerEffect;

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

export interface CopyOtherMagnetizationEffect {
  copies: number;
  goldenMode: "doubleCopies";
}

export interface SpellcraftSpec {
  definitionId: string;
  /** Exact-tier rewards whose tier advances at each end-of-turn pulse. */
  evolvingRewardTier?: {
    initialTier: TavernTier;
    maximumTier: TavernTier;
  };
}

export interface BloodGemImproveOrGainChoice {
  kind: "bloodGemImproveOrGain";
  attack: number;
  health: number;
  count: number;
  goldenMode?: "doubleValues";
}

export interface TavernSpellBuffChoice {
  kind: "tavernSpellBuff";
  attack: number;
  health: number;
  goldenMode?: "doubleValues";
}

export interface BeastKeywordBuffChoice {
  kind: "beastKeywordBuff";
  rebornAttack: number;
  rebornHealth: number;
  windfuryAttack: number;
  windfuryHealth: number;
  goldenMode?: "doubleValues";
}

export type MinionOnPlayChoice =
  | BloodGemImproveOrGainChoice
  | TavernSpellBuffChoice
  | BeastKeywordBuffChoice;

export interface HeroDamagedTrigger {
  /** Permanent Health granted to this observer after the damage is rewound. */
  health?: number;
  /** Temporary stats granted to every current and later Tavern minion this turn. */
  tavernAttackThisTurn?: number;
  tavernHealthThisTurn?: number;
}

export interface HealthRefreshSpec {
  count: number;
  healthCost: number;
  goldenMode?: "doubleCount";
}

export interface SellDiscoverSpec {
  initialTier: TavernTier;
  maximumTier: TavernTier;
  discoveries: number;
  goldenMode?: "doubleCount";
}

export interface TavernSpellBuffAura {
  attack: number;
  health: number;
}

export interface TavernSpellHistoryBuff {
  attack: number;
  health: number;
}

export interface AfterSpellCastEffect {
  attack: number;
  health: number;
}

export interface AfterPlayerSpellCastTrigger {
  kind: "consumeRandomShopMinion";
  spellsRequired: number;
  goldenMode?: "doubleStats";
}

export interface SelfAttackGainTrigger {
  health: number;
  goldenMode?: "repeat";
}

export interface SpellcraftPermanentOnSelf {
  castsPerTurn: number;
}

export interface CopySpellcraftOnSelf {
  count: number;
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

export interface AfterTargetedSpellCastEffect {
  kind: "gainVenomous";
  /** Golden Pufferquil keeps Venomous instead of losing it next Recruit. */
  goldenMode: "permanent";
}

export interface MinionDefinition {
  id: string;
  /** Hearthstone CardID used only to locate the familiar card artwork. */
  cardId: string;
  /** Real premium CardID when the Golden card has distinct artwork. */
  goldenCardId?: string;
  name: string;
  tier: MinionTier;
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
  /** Fires once after a card successfully enters this player's hand. */
  afterCardAddedToHand?: CardAddedToHandTrigger;
  /** Fires after each real consume, including sequential multi-consume effects. */
  afterMinionConsumed?: MinionConsumedTrigger;
  afterGoldSpent?: GoldSpentThresholdTrigger;
  afterFriendlySummoned?: FriendlyTribeTrigger;
  /** Permanently buffs the warband whenever a real summon attempt finds no board space. */
  onFriendlySummonOverflow?: {
    attack: number;
    health: number;
  };
  afterFriendlyDamaged?: FriendlyDamagedTrigger;
  afterFriendlyDealsDamage?: FriendlyDamageDealtTrigger;
  /** Recruit-phase hero damage is rewound once, then every observer grows. */
  afterHeroDamaged?: HeroDamagedTrigger;
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
  /** Applies directly to the bought minion before any resulting Triple is formed. */
  afterMinionPurchased?: MinionPurchaseStatsEffect;
  /** Fires only after a Tavern Spell is successfully bought from the shop. */
  afterTavernSpellPurchased?: TavernSpellPurchaseTrigger;
  /** Fires after another friendly board minion actually gains positive Health. */
  afterFriendlyGainsHealth?: FriendlyHealthGainTrigger;
  /** Fires once after another friendly board minion actually gains positive Attack. */
  afterFriendlyGainsAttack?: FriendlyAttackGainTrigger;
  /** Fires once after each Battlecry pulse actually finishes resolving. */
  afterBattlecryTriggered?: BattlecryTriggeredTrigger;
  conditionalKeyword?: ConditionalKeywordEffect;
  /** Fires once for each positive Attack-gain event caused by another source. */
  afterSelfGainsAttack?: SelfAttackGainTrigger;
  afterSold?: readonly MinionEffect[];
  afterFriendlySold?: readonly MinionEffect[];
  afterMagnetized?: readonly MinionEffect[];
  /** Copies the complete Magnetic source onto this host without another pool return. */
  copyOtherMagnetization?: CopyOtherMagnetizationEffect;
  aura?: StatAura;
  magnetic?: MagneticSpec;
  spellcraft?: SpellcraftSpec;
  /** A non-Battlecry choice that resolves only when this minion is played. */
  onPlayChoice?: MinionOnPlayChoice;
  /** Refreshes paid with Health before ordinary Gold refreshes are considered. */
  healthRefreshesPerTurn?: HealthRefreshSpec;
  /** Discover whose exact Tier advances while this card ends a turn in play. */
  sellDiscover?: SellDiscoverSpec;
  /** Extra full pulses for a Blood Gem played from hand. */
  bloodGemFromHandAura?: BloodGemFromHandAura;
  /** Observer invoked after each real Blood Gem pulse lands on this minion. */
  afterBloodGemCastOnSelf?: AfterBloodGemCastOnSelfEffect;
  /** Observer invoked after each real targeted spell cast resolves on this minion. */
  afterTargetedSpellCast?: AfterTargetedSpellCastEffect;
  /** Live aura added to every stat grant made by a Tavern Spell. */
  tavernSpellBuffAura?: TavernSpellBuffAura;
  /** Dynamic stats per Tavern Spell actually cast during this game. */
  tavernSpellHistoryBuff?: TavernSpellHistoryBuff;
  /** Observer invoked after every actual spell-cast pulse. */
  afterSpellCast?: AfterSpellCastEffect;
  /** Observer invoked only when this player is the spell's caster. */
  afterPlayerSpellCast?: AfterPlayerSpellCastTrigger;
  /** Number of targeted Spellcraft hand cards made permanent each turn. */
  spellcraftPermanentOnSelf?: SpellcraftPermanentOnSelf;
  /** Once each turn, copy a Spellcraft hand card used on this source. */
  copySpellcraftOnSelf?: CopySpellcraftOnSelf;
  /** Extra casts for a spell whose explicit target is a friendly minion. */
  friendlyTargetSpellExtraCasts?: number;
  /** Extra complete casts for each Bounty while this source is alive. */
  bountyExtraCasts?: number;
  /** Generated apprentice text: cast the Tavern Spell stored on this instance. */
  battlecryCastsTaughtTavernSpell?: boolean;
  /** Additional times each Tavern Spell is cast while this source is alive in combat. */
  combatTavernSpellExtraCasts?: number;
  extraBattlecries?: number;
  extraDeathrattles?: number;
  extraEndOfTurnTriggers?: number;
  sellValue?: number;
  goldenSellValue?: number;
  /** Total sell value after this player lost their previous combat. */
  sellValueAfterLoss?: number;
  goldenSellValueAfterLoss?: number;
  /** A generated Fodder feeds itself while offered instead of entering the pool. */
  shopFodder?: boolean;
  collectible?: boolean;
  /** Some generated cards have no Golden form and can never form a Triple. */
  canTriple?: boolean;
  /** This minion may replace one or more missing copies in a mixed triple. */
  tripleWildcardFor?: Tribe;
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
  tier: MinionTier;
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
  /** Stable source identities retained when Deathly Strikers form a Triple. */
  deathlyStrikerLineageIds?: string[];
  /** Deathly Striker source identities that generated this hand card. */
  deathlyStrikerCreatorIds?: string[];
  /** JSON-safe progress for card-specific counters such as "every 3 turns". */
  effectCounters?: Record<string, number>;
  /** Tavern Spell taught to a generated Magicfin Apprentice. */
  taughtTavernSpellDefinitionId?: string;
  /** Total permanent stats on this minion that came specifically from Blood Gems. */
  bloodGemAttack: number;
  bloodGemHealth: number;
  /**
   * Blood Gem stats hidden by a later fixed-stat effect. They remain part of
   * the transferable Blood Gem ledger, but no longer contribute to the
   * minion's visible stats when those Gems are moved away.
   */
  suppressedBloodGemAttack?: number;
  suppressedBloodGemHealth?: number;
  /** Spellcraft enchantments remain for combat, then expire next Recruit phase. */
  temporaryAttack: number;
  temporaryHealth: number;
  temporaryTaunt: boolean;
  temporaryDivineShield: boolean;
  /** Venomous granted only through the next combat, cleared next Recruit. */
  temporaryVenomous?: boolean;
  /** Temporary "Deathrattle: summon a 3/2 Crab" effects from Crab Rider. */
  temporaryCrabDeathrattles: number;
  /** Temporary Golden Crab Rider deathrattles that summon one 6/4 Crab. */
  temporaryGoldenCrabDeathrattles?: number;
  /** Permanent Crab Rider deathrattles retained after the Recruit turn. */
  crabDeathrattles?: number;
  /** Permanent Golden Crab Rider deathrattles retained after the Recruit turn. */
  goldenCrabDeathrattles?: number;
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
   * Exact shared-pool ownership for mixed-identity triples. Omitted when every
   * represented copy has the visible minion's definition ID.
   */
  poolCopiesByDefinitionId?: Record<string, number>;
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
  tier: TavernTier;
}

export type SpellFamily =
  | "bloodGem"
  | "tavern"
  | "spellcraft"
  | "generated"
  | "coin";

export type BloodGemBonusKeyword =
  | "tauntForQuilboar"
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
  | "slimyShield"
  | "anglersLure"
  | "glowingCrown"
  | "sickRiffs"
  | "deepBlueBlues"
  | "escapeEruption"
  | "evolvingStrategy"
  | "meditation"
  | "rimeOrReason"
  | "sirensSong"
  | "jailerStickerLesser"
  | "jailerStickerGreater"
  | "ophidianStaff"
  | "chillmereMosaic"
  | "doubleStitch"
  | "tokenOfOldGods"
  | "darkmoonPrizeDiscover"
  | "darkmoonTrainingSession"
  | "darkmoonBuyTheHolyLight"
  | "darkmoonBananas"
  | "darkmoonTopShelf"
  | "darkmoonRepeatCustomer"
  | "darkmoonAllThatGlitters"
  | "darkmoonMindflayerGoggles"
  | "darkmoonReservePrices";

export type SpellcraftTarget = "none" | "friendly" | "shop";

export interface SpellcraftDefinition {
  id: string;
  cardId: string;
  goldenCardId?: string;
  name: string;
  description: string;
  goldenDescription?: string;
  /** Tier of the active Naga that normally generates this spell. */
  sourceTier: MinionTier;
  effect: SpellcraftEffect;
  target: SpellcraftTarget;
  /** Generated ordinary spells share the targeting/casting UI but are not Spellcraft. */
  spellFamily?: "spellcraft" | "generated";
  /** False for tokens such as Slimy Shield that random Spellcraft cannot create. */
  randomlyGeneratable?: boolean;
}

export interface SpellcraftSpellInstance {
  kind: "spellcraft";
  instanceId: string;
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  spellFamily: "spellcraft" | "generated";
  target: SpellcraftTarget;
  /** Missing on older saves means the ordinary x1 version. */
  effectMultiplier?: number;
  /** Exact reward Tier snapshotted when an evolving Spellcraft was granted. */
  rewardTier?: TavernTier;
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
  | "lostStaffOfHamuul"
  | "goldenizer"
  | "goldenArrow"
  | "mirrorLens";

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
  | "buffCombatSummons"
  | "bonusStartingHealth"
  | "goldAfterSellNextTurn"
  | "twoGoldMinionRefresh"
  | "freezeEndTurnSmallerTavern"
  | "extraDragonOnRefresh"
  | "upgradeDiscountAfterElementals"
  | "piratePurchaseRefund"
  | "tavernCoinAfterThreeMinions"
  | "freeFourthTavernSpell"
  | "growingTavernSpellBuff"
  | "buffAllCombatMinionsAttack"
  | "buffLeftmostCombatKeywords"
  | "permanentAttackOnKill"
  | "growingTavernBuff"
  | "swapTwoMinionsAttack"
  | "chooseHeroPowerEachTurn"
  | "buyTierTripleReward"
  | "afterThreePurchasesGetCopy"
  | "combatLowestAttackDeathrattle"
  | "chooseFlightPath"
  | "sellDevourStats"
  | "cookMinionsForDiscover"
  | "startWithVehicleSummon"
  | "removeTavernShootEnemy"
  | "chooseElementInvoke"
  | "combatSummonHighestAttackDelayed"
  | "combatSummonHighestHealthDelayed"
  | "refreshCopyHighestFreeze"
  | "nagaExpedition"
  | "deadMinionsForMech"
  | "skipTurnForDiscovers"
  | "revengeSummonScalingWhelp"
  | "combatSummonTentacleScaling"
  | "holmesGuessMinion"
  | "spellcraftPerTurn"
  | "chooseQuestAtStart"
  | "refreshRandomKeyword"
  | "combatKillAndResummon"
  | "alternatingStatBuff"
  | "copyLeftmostHandCard"
  | "discoverTier7ForGoldSpent"
  | "chooseTrinketAtTurn5"
  | "oncePerGameExactCopy"
  | "nextTavernSpellDiscountDelayed"
  | "startWithBattlecruiser"
  | "startChooseProtossMinion"
  | "increaseGoldCap"
  | "chooseGreaterTrinketAtTurn8"
  | "attacksForTriple"
  | "timeWarpAtTurn8"
  | "refreshToTavernSpells"
  | "easyTripleCoin"
  | "timeWarpAtTurn5"
  | "discoverHeroPowerAtTurn4"
  | "totalCardsForSulfuras"
  | "skipTwoTurnsForDiscovers"
  | "chooseSecret"
  | "triggerBattlecry"
  | "giveMinionReborn"
  | "startWithAmalgam"
  | "turnStartRandomSpell"
  | "hatPassesOnSell"
  | "dealDamageForPortal"
  | "giveBananasEveryone"
  | "startDiscoverHeroPower"
  | "oncePerGameGolden"
  | "battlecryPurchasesForBrann"
  | "sellMinionsForRandomMurloc"
  | "replaceCardSameTier"
  | "attacksForFirstFreeBuy"
  | "removeDiscoverLowerTier"
  | "goldPerTurnOnce"
  | "deadHeroDiscoverMinion"
  | "swapNonGoldenWithTavern"
  | "collectDarkmoonTickets"
  | "startWithDeathrattleFish"
  | "periodicDarkmoonPrizes"
  | "combatSummonCurrentTier"
  | "combatBuffFlanks"
  | "combatBuffPerTribe"
  | "getBloodGemsPerTurn"
  | "delayedRewardAfterPurchases"
  | "activeShrinkMinionToHand"
  | "activeRandomBuffChooseUpgrade"
  | "activeDiscoverFromNextOpponent"
  | "activeStealAllTavernCards"
  | "activeDiscoverDeadMinionCopy"
  | "activeBuildCustomUndead"
  | "activeDiscoverBuddy"
  | "activeRollDiceForGold"
  | "activeRandomTavernSpell"
  | "activeCopyLastTavernSpell"
  | "activeUnlockZergTier"
  | "activeScalingTargetBuff"
  | "activeReplaceHigherTier"
  | "activeDiscoverRotatingTribe"
  | "activeGiveDivineShield"
  | "activeDiscoverMagneticMech"
  | "activeGetPirateCostReduces"
  | "activeStealTavernCardDamage"
  | "activeRefreshHigherTier"
  | "activeEndOfTurnScalingBuff"
  | "activeDoubleHealthTavernMinion"
  | "activeDiscoverCurrentTierCostIncreases"
  | "activeStealFirstKillNextCombat"
  | "activeRefreshOpponentMinions"
  | "activeDiscoverDragonTier4"
  | "activeLockCardUnlockLater"
  | "activeDigForGolden"
  | "activeBetOnWinner"
  | "activeFindMissingTriple"
  | "activeKillUndeadForUndead"
  | "unknown";

export interface HeroPowerDefinition {
  id: string;
  cardId: string;
  name: string;
  description: string;
  effect: HeroPowerEffect;
  activation: "passive" | "active";
  /** False for start-of-game powers that cannot be acquired mid-game. */
  identityEligible?: boolean;
}

export interface HeroDefinition {
  id: string;
  cardId: string;
  name: string;
  heroPowerId: string;
  /** Starting armor granted when the hero is assigned. */
  armor: number;
  /** At least one associated type must be active for this hero to be offered. */
  associatedTribes?: readonly Tribe[];
}

export type TrinketTier = "lesser" | "greater";

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

export interface TavernTierBuff extends TavernRefreshBuff {
  maximumTier: TavernTier;
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
  | "tierSeven"
  | "allSame"
  | "utility"
  | "allSpells";

export interface PendingSpellcraftGrant {
  sourceInstanceId: string;
  /** Trinket-backed Spellcraft uses its owned definition instead of a board source. */
  sourceTrinketDefinitionId?: string;
  definitionId: string;
  golden: boolean;
  round: number;
  /** Exact reward Tier retained while a full hand delays materialization. */
  rewardTier?: TavernTier;
}

export interface PendingCardPlayedEvent {
  sourceInstanceId: string;
  cardKind: "minion" | "tavernSpell" | "other";
  tier?: MinionTier;
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
  /** Per-power progress, reset whenever the current Hero Power changes. */
  heroPowerCounters: Record<string, number>;
  /** Selected lobby hero; legacy saves may resume without one. */
  heroId: string | null;
  /** Persistent Lesser and Greater Trinkets bought this game. */
  trinketIds: string[];
  /** Per-Trinket periodic progress, keyed by definition ID. */
  trinketCounters: Record<string, number>;
  /** Per-SystemEvent turn tracking, keyed by counter name. */
  systemEventCounters: Record<string, number>;
  /** Same-turn Tavern Spell discount granted by Reserve Prices. */
  darkmoonReservePricesDiscount?: number;
  /** Tickatus Tag rewards queued behind another modal interaction. */
  pendingTickatusTagPrizes?: number;
  /** Minion choices remembered by persistent Trinkets such as Pocket Factory. */
  trinketSelections: Record<string, string>;
  /** Mystery Cube replacements deferred behind an earlier start-of-turn choice. */
  pendingMysteryCubeReplacementIds: string[];
  /** System rewards wait here instead of disappearing when the hand is full. */
  pendingSystemSpellIds: string[];
  /** Remaining free Tavern Spell purchases granted this turn. */
  freeTavernSpellPurchases: number;
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
  /** Tavern Spells actually cast across the complete game. */
  tavernSpellsCast: number;
  /** Spells actually cast by this player across the complete game. */
  playerSpellsCast: number;
  /** Battlecries actually triggered for this player across the complete game. */
  battlecriesTriggered?: number;
  /** Permanent extra Hero Power triggers accumulated from Yogg's wheel. */
  heroPowerExtraTriggers?: number;
  /** Whether the active hero power has been used this recruit turn. */
  heroPowerActiveThisTurn?: boolean;
  /** Every successfully played hand card this Recruit turn. */
  cardsPlayedThisTurn: number;
  /** Gold actually deducted during this Recruit turn. */
  goldSpentThisTurn: number;
  /** Mama and Papa Mrrglton cards successfully played during this game. */
  mrrgltonsPlayed: number;
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
  /** Nozdormu's one non-stacking free Refresh for the current Recruit turn. */
  heroRefreshAvailable: boolean;
  freeRefreshes: number;
  /** Remaining successful manual Refreshes replaced by Wisdomball pages. */
  helpfulRefreshes: number;
  /** Most recent page, retained for deterministic feedback and save restore. */
  lastHelpfulRefreshKind: HelpfulRefreshKind | null;
  tavernMinionAttackBonus: number;
  tavernMinionHealthBonus: number;
  /** Tavern-wide temporary bonus, cleared at the next Recruit phase. */
  tavernMinionAttackBonusThisTurn: number;
  tavernMinionHealthBonusThisTurn: number;
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
  tavernTierBuffs: TavernTierBuff[];
  rideTheWindBuffs: TavernRefreshBuff[];
  elementalsPlayedThisTurn: number;
  nextCombatBeetles: number;
  /** Permanent game-wide stats granted to every Beetle token. */
  beetleAttackBonus: number;
  beetleHealthBonus: number;
  ballerAttackBonus: number;
  ballerHealthBonus: number;
  /** Extra stats appended once to every stat-grant packet from an Elemental. */
  elementalGrantAttackBonus: number;
  elementalGrantHealthBonus: number;
  /** Deathrattle abilities actually triggered for this player this game. */
  deathrattlesTriggered: number;
  /** Successful Magnetic attachments performed by this player this game. */
  magnetizationsThisGame: number;
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
    | "deathlyStrikerFromHand"
    | "stitchedSalvagerCopy"
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
  /** The repeated target resolution is a Battlecry pulse. */
  battlecry?: true;
  /** Number of actual Battlecry triggers represented by all effect repetitions. */
  battlecryTriggerCount?: number;
  grantKeywords?: Array<"reborn" | "windfury">;
  resolution?:
    | { kind: "buff" }
    | {
        kind: "destroyFriendlyAndCopy";
        copies: number;
      }
    | {
        kind: "castTaughtTavernSpell";
        definitionId: string;
      }
    | {
        kind: "makeGolden";
        maximumTier: TavernTier;
      };
}

export interface PendingMagnetizeTargetInteraction
  extends PendingInteractionBase {
  kind: "magnetizeTarget";
  optionInstanceIds: string[];
  filter: DiscoverFilter;
  remainingDiscoveries: number;
  /** The chained Magnetize discovery was started by a Battlecry. */
  battlecry?: true;
  /** Effect repetitions that belong to one actual Battlecry trigger. */
  battlecryEffectRepetitionsPerTrigger?: number;
}

export interface DiscoverFilter {
  exactTier?: MinionTier;
  maximumTier?: TavernTier;
  tribe?: Tribe;
  ability?: "battlecry" | "deathrattle";
  /** Excludes typeless minions while still allowing dual-type and All minions. */
  requiresMinionType?: boolean;
}

export type DiscoverDestination =
  | {
      kind: "hand";
      playableFromRound?: number;
      destroyAfterPlayThroughRound?: number;
      /** A full hand burns the selected card but does not cancel the choice. */
      allowOverflow?: boolean;
    }
  | { kind: "magnetize"; targetInstanceId: string }
  | { kind: "transform"; targetInstanceId: string }
  | {
      kind: "customUndeadFirst";
      sourceTrinketDefinitionId: string;
    }
  | {
      kind: "customUndeadSecond";
      sourceTrinketDefinitionId: string;
      firstComponentDefinitionId: string;
    };

export type DiscoverSelectionEffect =
  | { kind: "damageHeroBySelectedTier" }
  | { kind: "makeGolden" }
  | {
      kind: "rememberTrinketMinion";
      trinketDefinitionId: string;
    }
  | {
      kind: "setStats";
      attack: number;
      health: number;
    };

export interface PendingDiscoverInteraction extends PendingInteractionBase {
  kind: "discover";
  options: BoardMinionInstance[];
  filter: DiscoverFilter;
  remainingDiscoveries: number;
  destination: DiscoverDestination;
  /** Retained after a source leaves play so the UI can name the effect. */
  sourceDefinitionId?: string;
  selectionEffect?: DiscoverSelectionEffect;
  /** Optional action completed only after the final chained discovery. */
  completionSource?:
    | "tavernSpellCast"
    | "tripleRewardCast"
    | "generatedSpellCast";
  /** Each selected discovery completes one Battlecry pulse. */
  battlecry?: true;
  /** Effect repetitions that belong to one actual Battlecry trigger. */
  battlecryEffectRepetitionsPerTrigger?: number;
  /** New saves defer every repeated Tavern Spell cast until its Discover resolves. */
  remainingCastCompletions?: number;
  /** Only the first deferred cast came from the player's hand. */
  firstCastFromHandPending?: boolean;
}

export interface PendingTavernSpellDiscoverInteraction
  extends PendingInteractionBase {
  kind: "tavernSpellDiscover";
  options: TavernSpellInstance[];
  maximumTier: TavernTier;
  remainingDiscoveries: number;
  sourceDefinitionId?: string;
  /** Each selected Tavern Spell completes one Battlecry pulse. */
  battlecry?: true;
  /** Effect repetitions that belong to one actual Battlecry trigger. */
  battlecryEffectRepetitionsPerTrigger?: number;
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
  /** New saves defer repeated cast observers until the player chooses a branch. */
  castCompletions?: number;
}

export interface PendingHeroPowerChoiceInteraction
  extends PendingInteractionBase {
  kind: "heroPowerChoice";
  definitionId: string;
  optionIds: string[];
  /** Missing on old saves means Unmasked Identity, a Tavern Spell. */
  completionSource?: "tavernSpellCast" | "generatedSpellCast";
  /** Additional generated-spell casts waiting on their own Hero Power choice. */
  remainingChoices?: number;
}

export interface PendingDarkmoonPrizeDiscoverInteraction
  extends PendingInteractionBase {
  kind: "darkmoonPrizeDiscover";
  options: SpellcraftSpellInstance[];
  remainingDiscoveries: number;
  completionSource?: "generatedSpellCast";
}

export interface PendingHeroChoiceInteraction
  extends PendingInteractionBase {
  kind: "heroChoice";
  optionIds: string[];
}

export interface PendingTrinketChoiceInteraction
  extends PendingInteractionBase {
  kind: "trinketChoice";
  trinketTier: TrinketTier;
  optionIds: string[];
  /** A delayed or free choice replaces this exact owned Trinket slot. */
  replaceTrinketId?: string;
  /** An owned source allows this offer to add another raw Trinket of the tier. */
  additionalTrinketSourceId?: string;
}

export type MinionChoiceId =
  | "BG30_123t"
  | "BG30_123t2"
  | "BG30_123_Gt"
  | "BG30_123_Gt2"
  | "BG32_237t"
  | "BG32_237t2"
  | "BG32_237_Gt"
  | "BG32_237_Gt2"
  | "BG27_084t"
  | "BG27_084t2"
  | "BG27_084_Gt"
  | "BG27_084_Gt2";

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
  | PendingTavernSpellDiscoverInteraction
  | PendingTavernSpellChoiceInteraction
  | PendingSpellcraftChoiceInteraction
  | PendingHeroPowerChoiceInteraction
  | PendingDarkmoonPrizeDiscoverInteraction
  | PendingHeroChoiceInteraction
  | PendingTrinketChoiceInteraction
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
  /** Shared starting Health selected before this eight-player lobby began. */
  initialHealth: number;
  /** New games use official-style lobby systems; migrated runs stay legacy. */
  lobbySystemsEnabled: boolean;
  /** One game-wide Anomaly selected before the first Recruit turn. */
  systemEventId: string | null;
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
  /** Players whose end-step or combat triples wait for the next Recruit. */
  deferredTriplePlayerIds: PlayerId[];
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
  | { type: "CONTINUE" }
  | { type: "ACTIVATE_HERO_POWER"; targetInstanceId?: string };

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
  gainedKeywords: Array<"taunt" | "divineShield" | "reborn">;
  targetBefore: BoardMinionInstance;
  targetAfter: BoardMinionInstance;
}

export interface GameActionTrace {
  recruitBloodGemPulses: RecruitBloodGemPulseResolution[];
}

export interface GameTransition {
  state: GameState;
  trace: GameActionTrace;
  /** True only when the action passed every engine legality check. */
  accepted: boolean;
}
