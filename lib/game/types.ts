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
  taunt?: boolean;
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
  };
  maximumTier: "ownerTavern";
  source: "sharedPool";
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

export type RallyRemovedKeyword = "reborn" | "taunt";

export interface RallyRemoveTargetKeywordsEffect {
  kind: "removeTargetKeywords";
  keywords: readonly RallyRemovedKeyword[];
}

export type RallyEffect =
  | GetRandomMinionEffect
  | RallyBuffEffect
  | RallySummonFromHandEffect
  | RallyRemoveTargetKeywordsEffect;

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
}

export interface ImproveBloodGemsEffect {
  kind: "improveBloodGems";
  attack: number;
  health: number;
}

export interface ImproveBallersEffect {
  kind: "improveBallers";
  attack: number;
  health: number;
}

export type MinionEffect =
  | BuffEffect
  | SummonEffect
  | GrantShieldEffect
  | GainGoldEffect
  | DamageHeroEffect
  | DamageEnemyEffect
  | GainMissingHealthEffect
  | ResummonMechsEffect
  | SummonRandomDeathrattleEffect
  | GetRandomMinionEffect
  | DamageAllMinionsEffect
  | GainBloodGemsEffect
  | ImproveBloodGemsEffect
  | ImproveBallersEffect;

export interface TargetedBuffBattlecry {
  kind: "targetedBuff";
  target: "otherFriendly";
  attack: number;
  health: number;
  attackPerTavernSpell: number;
  healthPerTavernSpell: number;
  goldenMode: "repeat";
}

export interface DiscoverMinionBattlecry {
  kind: "discoverMinion";
  tribe: Tribe;
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

export interface MenagerieEndOfTurnEffect {
  kind: "onePerTribe";
  attack: number;
  health: number;
}

export interface BuffEndOfTurnEffect {
  kind: "buff";
  target: "self" | "adjacentFriendly";
  attack: number;
  health: number;
  repeatPerGoldenFriendly?: boolean;
}

export type EndOfTurnEffect =
  | MenagerieEndOfTurnEffect
  | BuffEndOfTurnEffect;

export interface StatAura {
  tribe: Tribe;
  attack: number;
  health: number;
  otherOnly?: boolean;
}

export interface MagneticSpec {
  targetTribes: readonly Tribe[];
}

export interface MinionDefinition {
  id: string;
  /** Hearthstone CardID used only to locate the familiar card artwork. */
  cardId: string;
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
  attack: number;
  health: number;
  description: string;
  taunt?: boolean;
  divineShield?: boolean;
  reborn?: boolean;
  poisonous?: boolean;
  venomous?: boolean;
  windfury?: boolean;
  cleave?: boolean;
  alwaysAttacksLowestAttack?: boolean;
  battlecry?: readonly MinionEffect[];
  interactiveBattlecry?: InteractiveBattlecry;
  deathrattle?: readonly MinionEffect[];
  afterFriendlyPlayed?: FriendlyTribeTrigger;
  afterFriendlySummoned?: FriendlyTribeTrigger;
  afterFriendlyDied?: FriendlyTribeTrigger;
  afterSelfDamaged?: readonly MinionEffect[];
  startOfTurn?: readonly MinionEffect[];
  startOfCombat?: readonly MinionEffect[];
  rally?: readonly RallyEffect[];
  endOfTurn?: EndOfTurnEffect;
  afterSold?: readonly MinionEffect[];
  afterMagnetized?: readonly MinionEffect[];
  aura?: StatAura;
  magnetic?: MagneticSpec;
  extraBattlecries?: number;
  extraDeathrattles?: number;
  sellValue?: number;
  goldenSellValue?: number;
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
  poisonous: boolean;
  venomous: boolean;
  windfury: boolean;
  cleave: boolean;
  alwaysAttacksLowestAttack: boolean;
  description: string;
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

export interface BloodGemSpellInstance {
  kind: "bloodGem";
  instanceId: string;
  definitionId: "blood-gem";
  cardId: "BG20_GEM";
  name: "鲜血宝石";
  description: string;
  spellFamily: "bloodGem";
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
  name: string;
  description: string;
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
  | "perfectVision";

export type TavernSpellTarget = "none" | "friendly" | "anyMinion";

export interface TavernSpellDefinition {
  id: string;
  cardId: string;
  name: string;
  tier: TavernTier;
  cost: number;
  description: string;
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
  shop: BoardMinionInstance[];
  /** One extra Tavern Spell offer, matching the live Battlegrounds shop. */
  spellShop: TavernSpellInstance | null;
  /** Saloon's Finest can reserve several additional spell offers at once. */
  additionalSpellShop: TavernSpellInstance[];
  /** Those spell offers temporarily occupy the Tavern's normal minion slots. */
  spellOnlyRefreshActive: boolean;
  frozen: boolean;
  upgradeDiscount: number;
  tavernSpellsCastThisTurn: number;
  /** Recruit-turn economy and persistent Tavern Spell counters. */
  maxGold: number;
  pendingNextTurnGold: number;
  freeRefreshes: number;
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
  tavernBloodGemBarrageAttack: number;
  tavernBloodGemBarrageHealth: number;
  backToBackBonus: number;
  tavernSpellAttackBonus: number;
  tavernSpellHealthBonus: number;
  tavernTypeBuffs: TavernTypeBuff[];
  rideTheWindBuffs: TavernRefreshBuff[];
  elementalsPlayedThisTurn: number;
  nextCombatBeetles: number;
  ballerAttackBonus: number;
  ballerHealthBonus: number;
  deepBlueBonus: number;
  /** Permanent "wherever they are" stats granted by Slaughter. */
  undeadArmyAttackBonus: number;
  undeadArmyHealthBonus: number;
  /** Permanent per-player Blood Gem values; new Gems read these on cast. */
  bloodGemAttack: number;
  bloodGemHealth: number;
  lastOpponentId?: PlayerId;
  eliminatedRound?: number;
  placement?: number;
}

export type BattleEventType =
  | "battleStart"
  | "attack"
  | "buff"
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
  minion?: MinionInstance;
  summonReason?: "reborn" | "rallyFromHand" | "beetle" | "spellcraft";
  removedKeywords?: RallyRemovedKeyword[];
  cardGainResult?: CardGainResult;
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
}

export interface PendingHeroPowerChoiceInteraction
  extends PendingInteractionBase {
  kind: "heroPowerChoice";
  definitionId: string;
  optionIds: string[];
}

export type PendingInteraction =
  | PendingTargetInteraction
  | PendingMagnetizeTargetInteraction
  | PendingDiscoverInteraction
  | PendingTavernSpellChoiceInteraction
  | PendingSpellcraftChoiceInteraction
  | PendingHeroPowerChoiceInteraction;

export type BattleResult = "win" | "loss" | "tie";

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
  version: 10;
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
  /** All battles resolved by the latest END_TURN action. */
  lastRoundBattles: BattleSummary[];
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
