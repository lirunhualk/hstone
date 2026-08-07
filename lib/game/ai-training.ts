import {
  getHumanScoutingReport,
  getPublicLastRoundResult,
} from "./opponent-intelligence.ts";
import type {
  BattleResult,
  BoardMinionInstance,
  DiscoverDestination,
  DiscoverFilter,
  GameState,
  HandCardInstance,
  HelpfulRefreshKind,
  MagneticAttachment,
  MinionTier,
  MinionInstance,
  PendingInteraction,
  PlayerState,
  TavernRefreshBuff,
  TavernTier,
  TavernTierBuff,
  TavernTypeBuff,
  Tribe,
} from "./types.ts";

export const AI_TRAINING_OBSERVATION_VERSION = 3 as const;

export type DeepReadonly<T> = T extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T;

export interface AiTrainingCardReference {
  zone:
    | "board"
    | "hand"
    | "shop"
    | "spellShop"
    | "additionalSpellShop";
  index: number;
}

export interface AiTrainingMagneticAttachmentObservation {
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  effectSupport: MinionInstance["effectSupport"];
  golden: boolean;
  attackGranted: number;
  healthGranted: number;
  attachments: AiTrainingMagneticAttachmentObservation[];
}

/**
 * A card snapshot with public card identity and visible state, but without the
 * runtime instance IDs or shared-pool ownership accounting used by the engine.
 */
export interface AiTrainingMinionObservation {
  kind: MinionInstance["kind"];
  definitionId: string;
  cardId: string;
  name: string;
  tier: MinionTier;
  tribe: Tribe;
  tribes: Tribe[];
  associatedTribes: Tribe[];
  effectSupport: MinionInstance["effectSupport"];
  sellValue: number;
  attack: number;
  health: number;
  golden: boolean;
  taunt: boolean;
  divineShield: boolean;
  reborn: boolean;
  stealth: boolean;
  poisonous: boolean;
  venomous: boolean;
  windfury: boolean;
  cleave: boolean;
  alwaysAttacksLowestAttack: boolean;
  description: string;
  whereverAttackBonus: number;
  whereverHealthBonus: number;
  astralAutomatonSummoned: boolean;
  ancientSoulFriendlyDeaths: number;
  effectCounters: Record<string, number>;
  bloodGemAttack: number;
  bloodGemHealth: number;
  temporaryAttack: number;
  temporaryHealth: number;
  temporaryTaunt: boolean;
  temporaryDivineShield: boolean;
  temporaryVenomous: boolean;
  temporaryCrabDeathrattles: number;
  temporaryGoldenCrabDeathrattles: number;
  crabDeathrattles: number;
  goldenCrabDeathrattles: number;
  playableFromRound: number | null;
  destroyAfterPlayThroughRound: number | null;
  grantsTripleReward: boolean;
  taughtTavernSpellDefinitionId: string | null;
  attachments: AiTrainingMagneticAttachmentObservation[];
}

export interface AiTrainingBloodGemObservation {
  kind: "bloodGem";
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  spellFamily: "bloodGem";
  bonusKeyword: NonNullable<
    Extract<HandCardInstance, { kind: "bloodGem" }>["bonusKeyword"]
  > | null;
}

export interface AiTrainingConsolationCoinObservation {
  kind: "consolationCoin";
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  spellFamily: "coin";
}

export interface AiTrainingSpellcraftObservation {
  kind: "spellcraft";
  definitionId: string;
  cardId: string;
  name: string;
  description: string;
  spellFamily: "spellcraft" | "generated";
  target: Extract<
    HandCardInstance,
    { kind: "spellcraft" }
  >["target"];
  effectMultiplier: number;
  rewardTier: TavernTier | null;
}

export interface AiTrainingTavernSpellObservation {
  kind: "tavernSpell";
  definitionId: string;
  cardId: string;
  name: string;
  tier: TavernTier;
  cost: number;
  description: string;
  spellFamily: "tavern";
  target: Extract<
    HandCardInstance,
    { kind: "tavernSpell" }
  >["target"];
}

export type AiTrainingCardObservation =
  | AiTrainingMinionObservation
  | AiTrainingBloodGemObservation
  | AiTrainingConsolationCoinObservation
  | AiTrainingSpellcraftObservation
  | AiTrainingTavernSpellObservation;

export interface AiTrainingDiscoverFilterObservation {
  exactTier: MinionTier | null;
  maximumTier: MinionTier | null;
  tribe: Tribe | null;
  magnetic: boolean;
  ability: "battlecry" | "deathrattle" | null;
  requiresMinionType: boolean;
  usesSharedPool: boolean;
}

export type AiTrainingDiscoverDestinationObservation =
  | {
      kind: "hand";
      playableFromRound: number | null;
      destroyAfterPlayThroughRound: number | null;
      allowOverflow: boolean;
    }
  | {
      kind: "magnetize";
      target: AiTrainingCardReference | null;
    }
  | {
      kind: "transform";
      target: AiTrainingCardReference | null;
    }
  | {
      kind: "customUndeadFirst";
      sourceTrinketDefinitionId: string;
    }
  | {
      kind: "customUndeadSecond";
      sourceTrinketDefinitionId: string;
      firstComponentDefinitionId: string;
    };

/**
 * Uniform pending-choice schema. Runtime interaction and card IDs are replaced
 * with controlled-player zone references; content definition IDs remain.
 */
export interface AiTrainingPendingInteractionObservation {
  kind: PendingInteraction["kind"];
  source: AiTrainingCardReference | null;
  optionReferences: Array<AiTrainingCardReference | null>;
  optionCards: AiTrainingMinionObservation[];
  optionIds: string[];
  filter: AiTrainingDiscoverFilterObservation | null;
  remainingDiscoveries: number | null;
  destination: AiTrainingDiscoverDestinationObservation | null;
  attack: number | null;
  health: number | null;
  repetitions: number | null;
  battlecryTriggerCount: number | null;
  battlecryEffectRepetitionsPerTrigger: number | null;
  grantKeywords: Array<"reborn" | "windfury">;
  resolution:
    | { kind: "buff" }
    | { kind: "destroyFriendlyAndCopy"; copies: number }
    | { kind: "castTaughtTavernSpell"; definitionId: string }
    | { kind: "makeGolden"; maximumTier: number }
    | null;
  definitionId: string | null;
  trinketTier: "lesser" | "greater" | null;
  effectMultiplier: number | null;
  selectionEffect:
    | { kind: "damageHeroBySelectedTier" }
    | { kind: "makeGolden" }
    | { kind: "rememberTrinketMinion"; trinketDefinitionId: string }
    | { kind: "setStats"; attack: number; health: number }
    | null;
  completionSource:
    | "tavernSpellCast"
    | "tripleRewardCast"
    | "generatedSpellCast"
    | null;
}

export interface AiTrainingPendingSpellcraftObservation {
  source: AiTrainingCardReference | null;
  definitionId: string;
  golden: boolean;
  round: number;
  rewardTier: TavernTier | null;
}

export interface AiTrainingPendingCardPlayedObservation {
  source: AiTrainingCardReference | null;
  cardKind: "minion" | "tavernSpell" | "other";
  tier: MinionTier | null;
  tribe: Tribe | null;
  tribes: Tribe[];
}

export interface AiTrainingRecruitObservation {
  seat: number;
  name: string;
  isHuman: boolean;
  health: number;
  armor: number;
  alive: boolean;
  heroPowerId: string | null;
  heroPowerCounters: Record<string, number>;
  heroPowerActiveThisTurn: boolean;
  heroId: string | null;
  secretIds: string[];
  trinketIds: string[];
  trinketCounters: Record<string, number>;
  systemEventCounters: Record<string, number>;
  trinketSelections: Record<string, string>;
  pendingMysteryCubeReplacementIds: string[];
  pendingSystemSpellIds: string[];
  freeTavernSpellPurchases: number;
  tavernTier: MinionTier;
  gold: number;
  board: AiTrainingMinionObservation[];
  hand: AiTrainingCardObservation[];
  ghostHand: AiTrainingMinionObservation[];
  pendingSpellcraft: AiTrainingPendingSpellcraftObservation[];
  shop: AiTrainingMinionObservation[];
  spellShop: AiTrainingTavernSpellObservation | null;
  additionalSpellShop: AiTrainingTavernSpellObservation[];
  spellOnlyRefreshActive: boolean;
  frozen: boolean;
  upgradeDiscount: number;
  nextTavernSpellDiscount: number;
  tavernSpellsCastThisTurn: number;
  tavernSpellsCast: number;
  playerSpellsCast: number;
  battlecriesTriggered: number;
  heroPowerExtraTriggers: number;
  darkmoonReservePricesDiscount: number;
  pendingTickatusTagPrizes: number;
  cardsPlayedThisTurn: number;
  goldSpentThisTurn: number;
  mrrgltonsPlayed: number;
  pendingCardPlayed: AiTrainingPendingCardPlayedObservation | null;
  lastTavernSpellDefinitionId: string | null;
  pendingTavernSpellDefinitionId: string | null;
  demonFodderRefreshQueue: number[];
  maxGold: number;
  pendingNextTurnGold: number;
  heroRefreshAvailable: boolean;
  freeRefreshes: number;
  helpfulRefreshes: number;
  lastHelpfulRefreshKind: HelpfulRefreshKind | null;
  tavernMinionAttackBonus: number;
  tavernMinionHealthBonus: number;
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
  tavernBloodGemBarrageCount: number;
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
  beetleAttackBonus: number;
  beetleHealthBonus: number;
  ballerAttackBonus: number;
  ballerHealthBonus: number;
  elementalGrantAttackBonus: number;
  elementalGrantHealthBonus: number;
  deathrattlesTriggered: number;
  magnetizationsThisGame: number;
  deepBlueBonus: number;
  undeadArmyAttackBonus: number;
  undeadArmyHealthBonus: number;
  astralAutomatonsSummoned: number;
  eternalKnightsDied: number;
  bloodGemAttack: number;
  bloodGemHealth: number;
  lastOpponentSeat: number | null;
  eliminatedRound: number | null;
  placement: number | null;
  pendingInteraction: AiTrainingPendingInteractionObservation | null;
}

export interface AiTrainingPublicRoundResultObservation {
  round: number;
  result: BattleResult;
  opponentSeat: number;
  damageDealt: number;
  damageTaken: number;
  isGhost: boolean;
}

export interface AiTrainingPublicPlayerObservation {
  seat: number;
  name: string;
  health: number;
  armor: number;
  alive: boolean;
  heroId: string | null;
  heroPowerId: string | null;
  tavernTier: MinionTier;
  eliminatedRound: number | null;
  placement: number | null;
  lastRoundResult: AiTrainingPublicRoundResultObservation | null;
}

export interface AiTrainingPublicObservation {
  gameStateVersion: GameState["version"];
  contentVersion: string;
  initialHealth: number;
  lobbySystemsEnabled: boolean;
  systemEventId: string | null;
  phase: GameState["phase"];
  round: number;
  activeTribes: Tribe[];
  winnerSeat: number | null;
  players: AiTrainingPublicPlayerObservation[];
}

export interface AiTrainingScoutingObservation {
  opponentSeat: number;
  observedRound: number;
  resultForObserver: BattleResult;
  isGhost: boolean;
  board: AiTrainingMinionObservation[];
}

export interface AiTrainingObservation {
  schemaVersion: typeof AI_TRAINING_OBSERVATION_VERSION;
  controlledSeat: number;
  public: AiTrainingPublicObservation;
  own: AiTrainingRecruitObservation;
  scoutingReports: AiTrainingScoutingObservation[];
}

type AssertNever<Value extends never> = Value;

/** Compile-time tripwire: every future PlayerState field must be audited. */
export type AiTrainingPlayerStateCoverage = AssertNever<
  Exclude<
    keyof PlayerState,
    | keyof AiTrainingRecruitObservation
    | "id"
    | "lastOpponentId"
  >
>;

/** Compile-time tripwire: new minion fields cannot silently cross the boundary. */
export type AiTrainingMinionStateCoverage = AssertNever<
  Exclude<
    keyof MinionInstance,
    | keyof AiTrainingMinionObservation
    | "instanceId"
    | "poolCopies"
    | "poolCopiesByDefinitionId"
    | "poolCopiesOnPurchase"
    | "deathlyStrikerLineageIds"
    | "deathlyStrikerCreatorIds"
    | "suppressedBloodGemAttack"
    | "suppressedBloodGemHealth"
  >
>;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== "object") {
    return value as DeepReadonly<T>;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

function cloneNumberRecord(
  record: Readonly<Record<string, number>>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function cloneStringRecord(
  record: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function observeAttachment(
  attachment: MagneticAttachment,
): AiTrainingMagneticAttachmentObservation {
  return {
    definitionId: attachment.definitionId,
    cardId: attachment.cardId,
    name: attachment.name,
    description: attachment.description,
    effectSupport: attachment.effectSupport,
    golden: attachment.golden,
    attackGranted: attachment.attackGranted,
    healthGranted: attachment.healthGranted,
    attachments: attachment.attachments.map(observeAttachment),
  };
}

function observeMinion(
  minion: MinionInstance,
): AiTrainingMinionObservation {
  return {
    kind: minion.kind,
    definitionId: minion.definitionId,
    cardId: minion.cardId,
    name: minion.name,
    tier: minion.tier,
    tribe: minion.tribe,
    tribes: [...minion.tribes],
    associatedTribes: [...minion.associatedTribes],
    effectSupport: minion.effectSupport,
    sellValue: minion.sellValue,
    attack: minion.attack,
    health: minion.health,
    golden: minion.golden,
    taunt: minion.taunt,
    divineShield: minion.divineShield,
    reborn: minion.reborn,
    stealth: minion.stealth ?? false,
    poisonous: minion.poisonous,
    venomous: minion.venomous,
    windfury: minion.windfury,
    cleave: minion.cleave,
    alwaysAttacksLowestAttack: minion.alwaysAttacksLowestAttack,
    description: minion.description,
    whereverAttackBonus: minion.whereverAttackBonus ?? 0,
    whereverHealthBonus: minion.whereverHealthBonus ?? 0,
    astralAutomatonSummoned: minion.astralAutomatonSummoned ?? false,
    ancientSoulFriendlyDeaths: minion.ancientSoulFriendlyDeaths ?? 0,
    effectCounters: cloneNumberRecord(minion.effectCounters ?? {}),
    bloodGemAttack: minion.bloodGemAttack,
    bloodGemHealth: minion.bloodGemHealth,
    temporaryAttack: minion.temporaryAttack,
    temporaryHealth: minion.temporaryHealth,
    temporaryTaunt: minion.temporaryTaunt,
    temporaryDivineShield: minion.temporaryDivineShield,
    temporaryVenomous: minion.temporaryVenomous ?? false,
    temporaryCrabDeathrattles: minion.temporaryCrabDeathrattles,
    temporaryGoldenCrabDeathrattles:
      minion.temporaryGoldenCrabDeathrattles ?? 0,
    crabDeathrattles: minion.crabDeathrattles ?? 0,
    goldenCrabDeathrattles: minion.goldenCrabDeathrattles ?? 0,
    playableFromRound: minion.playableFromRound ?? null,
    destroyAfterPlayThroughRound:
      minion.destroyAfterPlayThroughRound ?? null,
    grantsTripleReward: minion.grantsTripleReward,
    taughtTavernSpellDefinitionId:
      minion.taughtTavernSpellDefinitionId ?? null,
    attachments: minion.attachments.map(observeAttachment),
  };
}

function observeTavernSpell(
  spell: Extract<HandCardInstance, { kind: "tavernSpell" }>,
): AiTrainingTavernSpellObservation {
  return {
    kind: spell.kind,
    definitionId: spell.definitionId,
    cardId: spell.cardId,
    name: spell.name,
    tier: spell.tier,
    cost: spell.cost,
    description: spell.description,
    spellFamily: spell.spellFamily,
    target: spell.target,
  };
}

function observeHandCard(
  card: HandCardInstance,
): AiTrainingCardObservation {
  switch (card.kind) {
    case "minion":
    case "tripleReward":
      return observeMinion(card);
    case "bloodGem":
      return {
        kind: card.kind,
        definitionId: card.definitionId,
        cardId: card.cardId,
        name: card.name,
        description: card.description,
        spellFamily: card.spellFamily,
        bonusKeyword: card.bonusKeyword ?? null,
      };
    case "consolationCoin":
      return {
        kind: card.kind,
        definitionId: card.definitionId,
        cardId: card.cardId,
        name: card.name,
        description: card.description,
        spellFamily: card.spellFamily,
      };
    case "spellcraft":
      return {
        kind: card.kind,
        definitionId: card.definitionId,
        cardId: card.cardId,
        name: card.name,
        description: card.description,
        spellFamily: card.spellFamily,
        target: card.target,
        effectMultiplier: card.effectMultiplier ?? 1,
        rewardTier: card.rewardTier ?? null,
      };
    case "tavernSpell":
      return observeTavernSpell(card);
  }
}

function seatForPlayerId(state: GameState, playerId: string): number | null {
  const seat = state.players.findIndex((player) => player.id === playerId);
  return seat >= 0 ? seat : null;
}

function cardReference(
  player: PlayerState,
  instanceId: string,
): AiTrainingCardReference | null {
  const boardIndex = player.board.findIndex(
    (card) => card.instanceId === instanceId,
  );
  if (boardIndex >= 0) return { zone: "board", index: boardIndex };
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === instanceId,
  );
  if (handIndex >= 0) return { zone: "hand", index: handIndex };
  const shopIndex = player.shop.findIndex(
    (card) => card.instanceId === instanceId,
  );
  if (shopIndex >= 0) return { zone: "shop", index: shopIndex };
  if (player.spellShop?.instanceId === instanceId) {
    return { zone: "spellShop", index: 0 };
  }
  const additionalSpellShopIndex = player.additionalSpellShop.findIndex(
    (card) => card.instanceId === instanceId,
  );
  return additionalSpellShopIndex >= 0
    ? { zone: "additionalSpellShop", index: additionalSpellShopIndex }
    : null;
}

function observeFilter(
  filter: DiscoverFilter,
): AiTrainingDiscoverFilterObservation {
  return {
    exactTier: filter.exactTier ?? null,
    maximumTier: filter.maximumTier ?? null,
    tribe: filter.tribe ?? null,
    magnetic: filter.magnetic ?? false,
    ability: filter.ability ?? null,
    requiresMinionType: filter.requiresMinionType ?? false,
    usesSharedPool: filter.usesSharedPool ?? false,
  };
}

function observeDiscoverDestination(
  destination: DiscoverDestination,
  player: PlayerState,
): AiTrainingDiscoverDestinationObservation {
  switch (destination.kind) {
    case "hand":
      return {
        kind: "hand",
        playableFromRound: destination.playableFromRound ?? null,
        destroyAfterPlayThroughRound:
          destination.destroyAfterPlayThroughRound ?? null,
        allowOverflow: destination.allowOverflow ?? false,
      };
    case "magnetize":
    case "transform":
      return {
        kind: destination.kind,
        target: cardReference(player, destination.targetInstanceId),
      };
    case "customUndeadFirst":
      return {
        kind: "customUndeadFirst",
        sourceTrinketDefinitionId: destination.sourceTrinketDefinitionId,
      };
    case "customUndeadSecond":
      return {
        kind: "customUndeadSecond",
        sourceTrinketDefinitionId: destination.sourceTrinketDefinitionId,
        firstComponentDefinitionId:
          destination.firstComponentDefinitionId,
      };
  }
}

function emptyPendingInteraction(
  interaction: PendingInteraction,
  player: PlayerState,
): AiTrainingPendingInteractionObservation {
  return {
    kind: interaction.kind,
    source: cardReference(player, interaction.sourceInstanceId),
    optionReferences: [],
    optionCards: [],
    optionIds: [],
    filter: null,
    remainingDiscoveries: null,
    destination: null,
    attack: null,
    health: null,
    repetitions: null,
    battlecryTriggerCount: null,
    battlecryEffectRepetitionsPerTrigger: null,
    grantKeywords: [],
    resolution: null,
    definitionId: null,
    trinketTier: null,
    effectMultiplier: null,
    selectionEffect: null,
    completionSource: null,
  };
}

function observePendingInteraction(
  interaction: PendingInteraction,
  player: PlayerState,
): AiTrainingPendingInteractionObservation {
  const observation = emptyPendingInteraction(interaction, player);
  switch (interaction.kind) {
    case "target":
      observation.optionReferences = interaction.optionInstanceIds.map(
        (instanceId) => cardReference(player, instanceId),
      );
      observation.attack = interaction.attack;
      observation.health = interaction.health;
      observation.repetitions = interaction.repetitions;
      observation.battlecryTriggerCount =
        interaction.battlecryTriggerCount ?? null;
      observation.grantKeywords = [...(interaction.grantKeywords ?? [])];
      observation.resolution =
        interaction.resolution === undefined
          ? null
          : interaction.resolution.kind === "buff"
            ? { kind: "buff" }
            : interaction.resolution.kind === "destroyFriendlyAndCopy"
              ? {
                  kind: "destroyFriendlyAndCopy",
                  copies: interaction.resolution.copies,
                }
              : interaction.resolution.kind === "castTaughtTavernSpell"
                ? {
                    kind: "castTaughtTavernSpell",
                    definitionId: interaction.resolution.definitionId,
                  }
                : {
                    kind: "makeGolden",
                    maximumTier: interaction.resolution.maximumTier,
                  };
      return observation;
    case "magnetizeTarget":
      observation.optionReferences = interaction.optionInstanceIds.map(
        (instanceId) => cardReference(player, instanceId),
      );
      observation.filter = observeFilter(interaction.filter);
      observation.remainingDiscoveries = interaction.remainingDiscoveries;
      observation.battlecryEffectRepetitionsPerTrigger =
        interaction.battlecryEffectRepetitionsPerTrigger ?? null;
      return observation;
    case "discover":
      observation.optionCards = interaction.options.map(observeMinion);
      observation.filter = observeFilter(interaction.filter);
      observation.remainingDiscoveries = interaction.remainingDiscoveries;
      observation.battlecryEffectRepetitionsPerTrigger =
        interaction.battlecryEffectRepetitionsPerTrigger ?? null;
      observation.destination = observeDiscoverDestination(
        interaction.destination,
        player,
      );
      observation.definitionId = interaction.sourceDefinitionId ?? null;
      observation.selectionEffect = interaction.selectionEffect
        ? interaction.selectionEffect.kind === "rememberTrinketMinion"
          ? {
              kind: "rememberTrinketMinion",
              trinketDefinitionId:
                interaction.selectionEffect.trinketDefinitionId,
            }
          : interaction.selectionEffect.kind === "setStats"
            ? {
                kind: "setStats",
                attack: interaction.selectionEffect.attack,
                health: interaction.selectionEffect.health,
              }
            : interaction.selectionEffect.kind === "makeGolden"
              ? { kind: "makeGolden" }
              : { kind: "damageHeroBySelectedTier" }
        : null;
      observation.completionSource = interaction.completionSource ?? null;
      return observation;
    case "tavernSpellDiscover":
      observation.optionIds = interaction.options.map(
        (option) => option.definitionId,
      );
      observation.filter = observeFilter({
        maximumTier: interaction.maximumTier,
      });
      observation.remainingDiscoveries = interaction.remainingDiscoveries;
      observation.battlecryEffectRepetitionsPerTrigger =
        interaction.battlecryEffectRepetitionsPerTrigger ?? null;
      observation.definitionId = interaction.sourceDefinitionId ?? null;
      return observation;
    case "darkmoonPrizeDiscover":
      observation.optionIds = interaction.options.map(
        (option) => option.definitionId,
      );
      observation.remainingDiscoveries = interaction.remainingDiscoveries;
      observation.completionSource = interaction.completionSource ?? null;
      return observation;
    case "tavernSpellChoice":
      observation.definitionId = interaction.definitionId;
      observation.optionIds = [...interaction.optionIds];
      return observation;
    case "spellcraftChoice":
      observation.definitionId = interaction.definitionId;
      observation.optionIds = [...interaction.optionIds];
      observation.effectMultiplier = interaction.effectMultiplier ?? 1;
      return observation;
    case "heroPowerChoice":
      observation.definitionId = interaction.definitionId;
      observation.optionIds = [...interaction.optionIds];
      observation.remainingDiscoveries =
        interaction.remainingChoices ?? null;
      observation.completionSource = interaction.completionSource ?? null;
      return observation;
    case "secretChoice":
      observation.definitionId = interaction.definitionId;
      observation.optionIds = [...interaction.optionIds];
      return observation;
    case "heroChoice":
      observation.optionIds = [...interaction.optionIds];
      return observation;
    case "trinketChoice":
      observation.optionIds = [...interaction.optionIds];
      observation.trinketTier = interaction.trinketTier;
      return observation;
    case "minionChoice":
      observation.definitionId = interaction.definitionId;
      observation.optionIds = [...interaction.optionIds];
      observation.effectMultiplier = interaction.effectMultiplier;
      return observation;
  }
}

function cloneRefreshBuff(buff: TavernRefreshBuff): TavernRefreshBuff {
  return { attack: buff.attack, health: buff.health };
}

function cloneTypeBuff(buff: TavernTypeBuff): TavernTypeBuff {
  return {
    attack: buff.attack,
    health: buff.health,
    tribes: [...buff.tribes],
  };
}

function cloneTierBuff(buff: TavernTierBuff): TavernTierBuff {
  return {
    attack: buff.attack,
    health: buff.health,
    maximumTier: buff.maximumTier,
  };
}

function observeRecruitState(
  state: GameState,
  player: PlayerState,
  seat: number,
): AiTrainingRecruitObservation {
  return {
    seat,
    name: player.name,
    isHuman: player.isHuman,
    health: player.health,
    armor: player.armor,
    alive: player.alive,
    heroPowerId: player.heroPowerId,
    heroPowerCounters: cloneNumberRecord(player.heroPowerCounters),
    heroPowerActiveThisTurn: player.heroPowerActiveThisTurn ?? false,
    heroId: player.heroId,
    secretIds: [...player.secretIds],
    trinketIds: [...player.trinketIds],
    trinketCounters: cloneNumberRecord(player.trinketCounters),
    systemEventCounters: cloneNumberRecord(player.systemEventCounters),
    trinketSelections: cloneStringRecord(player.trinketSelections),
    pendingMysteryCubeReplacementIds: [
      ...player.pendingMysteryCubeReplacementIds,
    ],
    pendingSystemSpellIds: [...player.pendingSystemSpellIds],
    freeTavernSpellPurchases: player.freeTavernSpellPurchases,
    tavernTier: player.tavernTier,
    gold: player.gold,
    board: player.board.map(observeMinion),
    hand: player.hand.map(observeHandCard),
    ghostHand: player.ghostHand.map(observeMinion),
    pendingSpellcraft: player.pendingSpellcraft.map((grant) => ({
      source: cardReference(player, grant.sourceInstanceId),
      definitionId: grant.definitionId,
      golden: grant.golden,
      round: grant.round,
      rewardTier: grant.rewardTier ?? null,
    })),
    shop: player.shop.map(observeMinion),
    spellShop: player.spellShop
      ? observeTavernSpell(player.spellShop)
      : null,
    additionalSpellShop: player.additionalSpellShop.map(observeTavernSpell),
    spellOnlyRefreshActive: player.spellOnlyRefreshActive,
    frozen: player.frozen,
    upgradeDiscount: player.upgradeDiscount,
    nextTavernSpellDiscount: player.nextTavernSpellDiscount,
    tavernSpellsCastThisTurn: player.tavernSpellsCastThisTurn,
    tavernSpellsCast: player.tavernSpellsCast,
    playerSpellsCast: player.playerSpellsCast,
    battlecriesTriggered: Math.max(
      0,
      Math.floor(player.battlecriesTriggered ?? 0),
    ),
    heroPowerExtraTriggers: Math.max(
      0,
      Math.floor(player.heroPowerExtraTriggers ?? 0),
    ),
    darkmoonReservePricesDiscount: Math.max(
      0,
      Math.floor(player.darkmoonReservePricesDiscount ?? 0),
    ),
    pendingTickatusTagPrizes: Math.max(
      0,
      Math.floor(player.pendingTickatusTagPrizes ?? 0),
    ),
    cardsPlayedThisTurn: player.cardsPlayedThisTurn,
    goldSpentThisTurn: player.goldSpentThisTurn,
    mrrgltonsPlayed: player.mrrgltonsPlayed,
    pendingCardPlayed: player.pendingCardPlayed
      ? {
          source: cardReference(
            player,
            player.pendingCardPlayed.sourceInstanceId,
          ),
          cardKind: player.pendingCardPlayed.cardKind,
          tier: player.pendingCardPlayed.tier ?? null,
          tribe: player.pendingCardPlayed.tribe ?? null,
          tribes: [...player.pendingCardPlayed.tribes],
        }
      : null,
    lastTavernSpellDefinitionId: player.lastTavernSpellDefinitionId,
    pendingTavernSpellDefinitionId: player.pendingTavernSpellDefinitionId,
    demonFodderRefreshQueue: [...player.demonFodderRefreshQueue],
    maxGold: player.maxGold,
    pendingNextTurnGold: player.pendingNextTurnGold,
    heroRefreshAvailable: player.heroRefreshAvailable,
    freeRefreshes: player.freeRefreshes,
    helpfulRefreshes: player.helpfulRefreshes,
    lastHelpfulRefreshKind: player.lastHelpfulRefreshKind,
    tavernMinionAttackBonus: player.tavernMinionAttackBonus,
    tavernMinionHealthBonus: player.tavernMinionHealthBonus,
    tavernMinionAttackBonusThisTurn:
      player.tavernMinionAttackBonusThisTurn,
    tavernMinionHealthBonusThisTurn:
      player.tavernMinionHealthBonusThisTurn,
    nextCombatAttackBonus: player.nextCombatAttackBonus,
    nextCombatHealthBonus: player.nextCombatHealthBonus,
    nextCombatSetEnemyHealthToOne: player.nextCombatSetEnemyHealthToOne,
    nextCombatDoubleLeftmostAttack:
      player.nextCombatDoubleLeftmostAttack.map(cloneRefreshBuff),
    nextCombatWinGold: player.nextCombatWinGold,
    nextCombatTieGold: player.nextCombatTieGold,
    nextTurnBoardAttackBonus: player.nextTurnBoardAttackBonus,
    nextTurnBoardHealthBonus: player.nextTurnBoardHealthBonus,
    nextTurnBoardBuffPulses: player.nextTurnBoardBuffPulses,
    tavernBloodGemBarrageCount: player.tavernBloodGemBarrageCount,
    tavernBloodGemBarrageAttack: player.tavernBloodGemBarrageAttack,
    tavernBloodGemBarrageHealth: player.tavernBloodGemBarrageHealth,
    backToBackBonus: player.backToBackBonus,
    tavernSpellAttackBonus: player.tavernSpellAttackBonus,
    tavernSpellHealthBonus: player.tavernSpellHealthBonus,
    tavernTypeBuffs: player.tavernTypeBuffs.map(cloneTypeBuff),
    tavernTierBuffs: player.tavernTierBuffs.map(cloneTierBuff),
    rideTheWindBuffs: player.rideTheWindBuffs.map(cloneRefreshBuff),
    elementalsPlayedThisTurn: player.elementalsPlayedThisTurn,
    nextCombatBeetles: player.nextCombatBeetles,
    beetleAttackBonus: player.beetleAttackBonus,
    beetleHealthBonus: player.beetleHealthBonus,
    ballerAttackBonus: player.ballerAttackBonus,
    ballerHealthBonus: player.ballerHealthBonus,
    elementalGrantAttackBonus: player.elementalGrantAttackBonus,
    elementalGrantHealthBonus: player.elementalGrantHealthBonus,
    deathrattlesTriggered: player.deathrattlesTriggered,
    magnetizationsThisGame: player.magnetizationsThisGame,
    deepBlueBonus: player.deepBlueBonus,
    undeadArmyAttackBonus: player.undeadArmyAttackBonus,
    undeadArmyHealthBonus: player.undeadArmyHealthBonus,
    astralAutomatonsSummoned: player.astralAutomatonsSummoned,
    eternalKnightsDied: player.eternalKnightsDied,
    bloodGemAttack: player.bloodGemAttack,
    bloodGemHealth: player.bloodGemHealth,
    lastOpponentSeat: player.lastOpponentId
      ? seatForPlayerId(state, player.lastOpponentId)
      : null,
    eliminatedRound: player.eliminatedRound ?? null,
    placement: player.placement ?? null,
    pendingInteraction:
      state.pendingInteraction?.playerId === player.id
        ? observePendingInteraction(state.pendingInteraction, player)
        : null,
  };
}

function observePublicPlayers(
  state: GameState,
): AiTrainingPublicPlayerObservation[] {
  return state.players.map((player, seat) => {
    const result = getPublicLastRoundResult(state, player.id);
    const opponentSeat = result
      ? seatForPlayerId(state, result.opponentId)
      : null;
    return {
      seat,
      name: player.name,
      health: player.health,
      armor: player.armor,
      alive: player.alive,
      heroId: player.heroId,
      heroPowerId: player.heroPowerId,
      tavernTier: player.tavernTier,
      eliminatedRound: player.eliminatedRound ?? null,
      placement: player.placement ?? null,
      lastRoundResult:
        result && opponentSeat !== null
          ? {
              round: result.round,
              result: result.result,
              opponentSeat,
              damageDealt: result.damageDealt,
              damageTaken: result.damageTaken,
              isGhost: result.isGhost,
            }
          : null,
    };
  });
}

function resultForObserver(
  winnerId: string | null,
  observerId: string,
): BattleResult {
  return winnerId === null
    ? "tie"
    : winnerId === observerId
      ? "win"
      : "loss";
}

function observeHumanScoutingReports(
  state: GameState,
): AiTrainingScoutingObservation[] {
  return state.players
    .flatMap((opponent, opponentSeat) => {
      const report = getHumanScoutingReport(state, opponent.id);
      return report === null
        ? []
        : [
            {
              opponentSeat,
              observedRound: report.observedRound,
              resultForObserver: report.resultForHuman,
              isGhost: report.isGhost,
              board: report.board.map(observeMinion),
            },
          ];
    })
    .sort(
      (left, right) =>
        left.observedRound - right.observedRound ||
        left.opponentSeat - right.opponentSeat,
    );
}

function observeAiScoutingReports(
  state: GameState,
  observer: PlayerState,
): AiTrainingScoutingObservation[] {
  return state.lastRoundBattles
    .flatMap((battle) => {
      const observerIsA = battle.playerAId === observer.id;
      const observerIsLegalB =
        !battle.isGhost && battle.playerBId === observer.id;
      if (!observerIsA && !observerIsLegalB) return [];
      const opponentId = observerIsA
        ? battle.playerBId
        : battle.playerAId;
      const opponentSeat = seatForPlayerId(state, opponentId);
      if (opponentSeat === null) return [];
      const board = (battle.initialBoards[opponentId] ?? []).filter(
        (minion): minion is BoardMinionInstance =>
          minion.kind === "minion",
      );
      return [
        {
          opponentSeat,
          observedRound: battle.round,
          resultForObserver: resultForObserver(
            battle.winnerId,
            observer.id,
          ),
          isGhost: battle.isGhost,
          board: board.map(observeMinion),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.observedRound - right.observedRound ||
        left.opponentSeat - right.opponentSeat,
    );
}

/**
 * Builds the privacy boundary consumed by offline policy learning. The input is
 * never mutated, and the returned JSON-only graph is deeply frozen.
 */
export function createAiTrainingObservation(
  state: GameState,
  controlledSeat: number,
): DeepReadonly<AiTrainingObservation> {
  if (
    !Number.isInteger(controlledSeat) ||
    controlledSeat < 0 ||
    controlledSeat >= state.players.length
  ) {
    throw new RangeError(`Unknown controlled seat: ${controlledSeat}`);
  }
  const player = state.players[controlledSeat];
  const observation: AiTrainingObservation = {
    schemaVersion: AI_TRAINING_OBSERVATION_VERSION,
    controlledSeat,
    public: {
      gameStateVersion: state.version,
      contentVersion: state.contentVersion,
      initialHealth: state.initialHealth,
      lobbySystemsEnabled: state.lobbySystemsEnabled,
      systemEventId: state.systemEventId,
      phase: state.phase,
      round: state.round,
      activeTribes: [...state.activeTribes],
      winnerSeat: state.winnerId
        ? seatForPlayerId(state, state.winnerId)
        : null,
      players: observePublicPlayers(state),
    },
    own: observeRecruitState(state, player, controlledSeat),
    scoutingReports:
      player.isHuman && player.id === state.humanPlayerId
        ? observeHumanScoutingReports(state)
        : observeAiScoutingReports(state, player),
  };
  return deepFreeze(observation);
}
