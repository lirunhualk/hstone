import {
  AI_STRATEGY_PROFILES,
  type AiStrategyId,
} from "./ai.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  snapshotAiResidualMacroContext,
  type AiFreezeMacroChoice,
  type AiRefreshMacroChoice,
  type AiResidualMacroContext,
  type AiResidualMacroKind,
  type AiUpgradeMacroChoice,
  type DeepReadonly,
} from "./ai-residual-policy.ts";

export const AI_RESIDUAL_FEATURE_SCHEMA_VERSION = 1 as const;

/**
 * SHA-256 of the canonical `AI_RESIDUAL_FEATURE_SCHEMA` payload.
 *
 * The literal lives in the browser-safe feature module so production scoring
 * can reject schema drift without importing `node:crypto`. The offline
 * trainer independently recomputes and verifies it before creating artifacts.
 */
export const AI_RESIDUAL_FEATURE_SCHEMA_HASH =
  "774d0f08151828b7fd663740cf11146a80457a07eecbfbbc0b1008fca565593d" as const;

export const AI_RESIDUAL_FEATURE_PROFILE_IDS = Object.freeze(
  AI_STRATEGY_PROFILES.map((profile) => profile.id),
) as readonly AiStrategyId[];

export type AiResidualKnownValue<Value> =
  | Readonly<{ known: false }>
  | Readonly<{ known: true; value: Value }>;

interface AiResidualSemanticBase<
  Kind extends AiResidualMacroKind,
  Choice extends string,
> {
  readonly schemaVersion: typeof AI_RESIDUAL_FEATURE_SCHEMA_VERSION;
  readonly contextVersion: typeof AI_RESIDUAL_CONTEXT_VERSION;
  readonly kind: Kind;
  readonly profileId: AiResidualKnownValue<AiStrategyId>;
  readonly round: AiResidualKnownValue<number>;
  readonly tavernTier: AiResidualKnownValue<number>;
  readonly health: AiResidualKnownValue<number>;
  readonly armor: AiResidualKnownValue<number>;
  readonly gold: AiResidualKnownValue<number>;
  readonly boardSize: AiResidualKnownValue<number>;
  readonly handSize: AiResidualKnownValue<number>;
  readonly legacyChoice: AiResidualKnownValue<Choice>;
}

export interface AiResidualUpgradeSemanticRecord
  extends AiResidualSemanticBase<"upgrade", AiUpgradeMacroChoice> {
  readonly checkpoint: AiResidualKnownValue<"opening" | "loop">;
  readonly actionsTaken: AiResidualKnownValue<number>;
  readonly refreshesTaken: AiResidualKnownValue<number>;
  readonly upgradeCost: AiResidualKnownValue<number>;
  readonly targetBoardSize: AiResidualKnownValue<number>;
  readonly bestShopScore: AiResidualKnownValue<number | null>;
  readonly weakestBoardScore: AiResidualKnownValue<number | null>;
  readonly bestAffordableSpellScore: AiResidualKnownValue<number | null>;
}

export interface AiResidualRefreshSemanticRecord
  extends AiResidualSemanticBase<"refresh", AiRefreshMacroChoice> {
  readonly refreshCurrency: AiResidualKnownValue<"gold" | "health">;
  readonly refreshCost: AiResidualKnownValue<number>;
  readonly affordable: AiResidualKnownValue<boolean>;
  readonly healthSpendSafe: AiResidualKnownValue<boolean>;
  readonly freeRefreshSource: AiResidualKnownValue<"hero" | "counter" | null>;
  readonly remainingHealthRefreshes: AiResidualKnownValue<number>;
  readonly rewindsRecruitDamage: AiResidualKnownValue<boolean>;
  readonly refreshesThisTurn: AiResidualKnownValue<number>;
  readonly refreshLimit: AiResidualKnownValue<number>;
  readonly actionsTaken: AiResidualKnownValue<number>;
  readonly actionLimit: AiResidualKnownValue<number>;
  readonly minionPurchaseCost: AiResidualKnownValue<number>;
  readonly canBuyAfterRefresh: AiResidualKnownValue<boolean>;
  readonly canSpeculativelyRefresh: AiResidualKnownValue<boolean>;
  readonly goldAfterRefresh: AiResidualKnownValue<number>;
  readonly effectiveHealthAfterRefresh: AiResidualKnownValue<number>;
  readonly healthSpendFloor: AiResidualKnownValue<number>;
  readonly targetBoardSize: AiResidualKnownValue<number>;
}

export interface AiResidualFreezeSemanticRecord
  extends AiResidualSemanticBase<"freeze", AiFreezeMacroChoice> {
  readonly currentlyFrozen: AiResidualKnownValue<boolean>;
  readonly bestMinionScore: AiResidualKnownValue<number | null>;
  readonly bestSpellScore: AiResidualKnownValue<number | null>;
  readonly bestTripleProgress: AiResidualKnownValue<0 | 1 | 2>;
  readonly remainingMinionPurchaseCost: AiResidualKnownValue<number>;
  readonly handFull: AiResidualKnownValue<boolean>;
  readonly freezePairCount: AiResidualKnownValue<number>;
  readonly minionScoreThreshold: AiResidualKnownValue<number>;
  readonly spellScoreThreshold: AiResidualKnownValue<number>;
  readonly freezeMinionReason: AiResidualKnownValue<boolean>;
  readonly freezeSpellReason: AiResidualKnownValue<boolean>;
  readonly unspentGold: AiResidualKnownValue<number>;
}

export type AiResidualSemanticRecord =
  | AiResidualUpgradeSemanticRecord
  | AiResidualRefreshSemanticRecord
  | AiResidualFreezeSemanticRecord;

export interface AiResidualVisibleCommonProjection {
  readonly round?: number;
  readonly tavernTier?: number;
  readonly health?: number;
  readonly armor?: number;
  readonly gold?: number;
  readonly boardSize?: number;
  readonly handSize?: number;
}

export type AiResidualVisibleProjection =
  | Readonly<{
      kind: "upgrade";
      common: AiResidualVisibleCommonProjection;
      upgradeCost?: number;
    }>
  | Readonly<{
      kind: "refresh";
      common: AiResidualVisibleCommonProjection;
      refreshCurrency?: "gold" | "health";
      refreshCost?: number;
    }>
  | Readonly<{
      kind: "freeze";
      common: AiResidualVisibleCommonProjection;
      currentlyFrozen?: boolean;
    }>;

export interface AiResidualEncodedFeatures<
  Kind extends AiResidualMacroKind = AiResidualMacroKind,
> {
  readonly schemaVersion: typeof AI_RESIDUAL_FEATURE_SCHEMA_VERSION;
  readonly contextVersion: typeof AI_RESIDUAL_CONTEXT_VERSION;
  readonly kind: Kind;
  readonly names: readonly string[];
  readonly values: readonly number[];
}

const UNKNOWN_VALUE = Object.freeze({ known: false as const });

function unknownValue<Value>(): AiResidualKnownValue<Value> {
  return UNKNOWN_VALUE;
}

function knownValue<Value>(value: Value): AiResidualKnownValue<Value> {
  return Object.freeze({ known: true as const, value });
}

function knownOptional<Value>(
  value: Value | undefined,
): AiResidualKnownValue<Value> {
  return value === undefined ? unknownValue<Value>() : knownValue(value);
}

function isProfileId(value: string): value is AiStrategyId {
  return AI_RESIDUAL_FEATURE_PROFILE_IDS.includes(value as AiStrategyId);
}

function assertFiniteInteger(
  value: number | undefined,
  label: string,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY,
): void {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value < minimum || value > maximum)
  ) {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
}

function validateVisibleCommon(common: AiResidualVisibleCommonProjection): void {
  assertFiniteInteger(common.round, "round", 0);
  assertFiniteInteger(common.tavernTier, "tavernTier", 1, 7);
  assertFiniteInteger(common.health, "health", 0);
  assertFiniteInteger(common.armor, "armor", 0);
  assertFiniteInteger(common.gold, "gold", 0);
  assertFiniteInteger(common.boardSize, "boardSize", 0, 7);
  assertFiniteInteger(common.handSize, "handSize", 0, 10);
}

function commonSemanticFields<Choice extends string>(
  common: AiResidualVisibleCommonProjection,
): Omit<
  AiResidualSemanticBase<AiResidualMacroKind, Choice>,
  "schemaVersion" | "contextVersion" | "kind"
> {
  return {
    profileId: unknownValue<AiStrategyId>(),
    round: knownOptional(common.round),
    tavernTier: knownOptional(common.tavernTier),
    health: knownOptional(common.health),
    armor: knownOptional(common.armor),
    gold: knownOptional(common.gold),
    boardSize: knownOptional(common.boardSize),
    handSize: knownOptional(common.handSize),
    legacyChoice: unknownValue<Choice>(),
  };
}

/** Creates a profile-neutral semantic record from strictly visible fields. */
export function createProfileNeutralAiResidualSemanticRecord(
  projection: AiResidualVisibleProjection,
): DeepReadonly<AiResidualSemanticRecord> {
  validateVisibleCommon(projection.common);
  const base = {
    schemaVersion: AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
  } as const;
  switch (projection.kind) {
    case "upgrade": {
      assertFiniteInteger(projection.upgradeCost, "upgradeCost", 0);
      return Object.freeze({
        ...base,
        kind: "upgrade" as const,
        ...commonSemanticFields<AiUpgradeMacroChoice>(projection.common),
        checkpoint: unknownValue<"opening" | "loop">(),
        actionsTaken: unknownValue<number>(),
        refreshesTaken: unknownValue<number>(),
        upgradeCost: knownOptional(projection.upgradeCost),
        targetBoardSize: unknownValue<number>(),
        bestShopScore: unknownValue<number | null>(),
        weakestBoardScore: unknownValue<number | null>(),
        bestAffordableSpellScore: unknownValue<number | null>(),
      });
    }
    case "refresh": {
      if (
        projection.refreshCurrency !== undefined &&
        projection.refreshCurrency !== "gold" &&
        projection.refreshCurrency !== "health"
      ) {
        throw new TypeError("refreshCurrency must be gold or health");
      }
      assertFiniteInteger(projection.refreshCost, "refreshCost", 0);
      return Object.freeze({
        ...base,
        kind: "refresh" as const,
        ...commonSemanticFields<AiRefreshMacroChoice>(projection.common),
        refreshCurrency: knownOptional(projection.refreshCurrency),
        refreshCost: knownOptional(projection.refreshCost),
        affordable: unknownValue<boolean>(),
        healthSpendSafe: unknownValue<boolean>(),
        freeRefreshSource: unknownValue<"hero" | "counter" | null>(),
        remainingHealthRefreshes: unknownValue<number>(),
        rewindsRecruitDamage: unknownValue<boolean>(),
        refreshesThisTurn: unknownValue<number>(),
        refreshLimit: unknownValue<number>(),
        actionsTaken: unknownValue<number>(),
        actionLimit: unknownValue<number>(),
        minionPurchaseCost: unknownValue<number>(),
        canBuyAfterRefresh: unknownValue<boolean>(),
        canSpeculativelyRefresh: unknownValue<boolean>(),
        goldAfterRefresh: unknownValue<number>(),
        effectiveHealthAfterRefresh: unknownValue<number>(),
        healthSpendFloor: unknownValue<number>(),
        targetBoardSize: unknownValue<number>(),
      });
    }
    case "freeze": {
      if (
        projection.currentlyFrozen !== undefined &&
        typeof projection.currentlyFrozen !== "boolean"
      ) {
        throw new TypeError("currentlyFrozen must be boolean");
      }
      return Object.freeze({
        ...base,
        kind: "freeze" as const,
        ...commonSemanticFields<AiFreezeMacroChoice>(projection.common),
        currentlyFrozen: knownOptional(projection.currentlyFrozen),
        bestMinionScore: unknownValue<number | null>(),
        bestSpellScore: unknownValue<number | null>(),
        bestTripleProgress: unknownValue<0 | 1 | 2>(),
        remainingMinionPurchaseCost: unknownValue<number>(),
        handFull: unknownValue<boolean>(),
        freezePairCount: unknownValue<number>(),
        minionScoreThreshold: unknownValue<number>(),
        spellScoreThreshold: unknownValue<number>(),
        freezeMinionReason: unknownValue<boolean>(),
        freezeSpellReason: unknownValue<boolean>(),
        unspentGold: knownOptional(projection.common.gold),
      });
    }
  }
}

function fullBase<Choice extends string>(
  context: AiResidualMacroContext & { legacyChoice: Choice },
) {
  if (!isProfileId(context.profileId)) {
    throw new TypeError(`unsupported residual profile: ${context.profileId}`);
  }
  return {
    schemaVersion: AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    profileId: knownValue(context.profileId),
    round: knownValue(context.round),
    tavernTier: knownValue(context.tavernTier),
    health: knownValue(context.health),
    armor: knownValue(context.armor),
    gold: knownValue(context.gold),
    boardSize: knownValue(context.boardSize),
    handSize: knownValue(context.handSize),
    legacyChoice: knownValue(context.legacyChoice),
  } as const;
}

/** Converts a validated full legacy/runtime context into the shared schema. */
export function createFullAiResidualSemanticRecord(
  context: AiResidualMacroContext,
): DeepReadonly<AiResidualSemanticRecord> {
  const snapshot = snapshotAiResidualMacroContext(context);
  if (snapshot === null) {
    throw new TypeError("invalid residual macro context");
  }
  switch (snapshot.kind) {
    case "upgrade":
      return Object.freeze({
        ...fullBase(snapshot),
        kind: "upgrade" as const,
        checkpoint: knownValue(snapshot.checkpoint),
        actionsTaken: knownValue(snapshot.actionsTaken),
        refreshesTaken: knownValue(snapshot.refreshesTaken),
        upgradeCost: knownValue(snapshot.upgradeCost),
        targetBoardSize: knownValue(snapshot.targetBoardSize),
        bestShopScore: knownValue(snapshot.bestShopScore),
        weakestBoardScore: knownValue(snapshot.weakestBoardScore),
        bestAffordableSpellScore: knownValue(snapshot.bestAffordableSpellScore),
      });
    case "refresh":
      return Object.freeze({
        ...fullBase(snapshot),
        kind: "refresh" as const,
        refreshCurrency: knownValue(snapshot.refreshCurrency),
        refreshCost: knownValue(snapshot.refreshCost),
        affordable: knownValue(snapshot.affordable),
        healthSpendSafe: knownValue(snapshot.healthSpendSafe),
        freeRefreshSource: knownValue(snapshot.freeRefreshSource),
        remainingHealthRefreshes: knownValue(snapshot.remainingHealthRefreshes),
        rewindsRecruitDamage: knownValue(snapshot.rewindsRecruitDamage),
        refreshesThisTurn: knownValue(snapshot.refreshesThisTurn),
        refreshLimit: knownValue(snapshot.refreshLimit),
        actionsTaken: knownValue(snapshot.actionsTaken),
        actionLimit: knownValue(snapshot.actionLimit),
        minionPurchaseCost: knownValue(snapshot.minionPurchaseCost),
        canBuyAfterRefresh: knownValue(snapshot.canBuyAfterRefresh),
        canSpeculativelyRefresh: knownValue(snapshot.canSpeculativelyRefresh),
        goldAfterRefresh: knownValue(snapshot.goldAfterRefresh),
        effectiveHealthAfterRefresh: knownValue(snapshot.effectiveHealthAfterRefresh),
        healthSpendFloor: knownValue(snapshot.healthSpendFloor),
        targetBoardSize: knownValue(snapshot.targetBoardSize),
      });
    case "freeze":
      return Object.freeze({
        ...fullBase(snapshot),
        kind: "freeze" as const,
        currentlyFrozen: knownValue(snapshot.currentlyFrozen),
        bestMinionScore: knownValue(snapshot.bestMinionScore),
        bestSpellScore: knownValue(snapshot.bestSpellScore),
        bestTripleProgress: knownValue(snapshot.bestTripleProgress),
        remainingMinionPurchaseCost: knownValue(
          snapshot.remainingMinionPurchaseCost,
        ),
        handFull: knownValue(snapshot.handFull),
        freezePairCount: knownValue(snapshot.freezePairCount),
        minionScoreThreshold: knownValue(snapshot.minionScoreThreshold),
        spellScoreThreshold: knownValue(snapshot.spellScoreThreshold),
        freezeMinionReason: knownValue(snapshot.freezeMinionReason),
        freezeSpellReason: knownValue(snapshot.freezeSpellReason),
        unspentGold: knownValue(snapshot.unspentGold),
      });
  }
}

/**
 * Projects a live engine context onto exactly the fields that can also be
 * established from reviewed video evidence. Profile identity, the legacy
 * policy decision, and engine-only scores/reasons deliberately remain
 * unknown so offline and live feature distributions cannot diverge.
 */
export function createVisibleOnlyAiResidualSemanticRecord(
  context: AiResidualMacroContext,
): DeepReadonly<AiResidualSemanticRecord> {
  const snapshot = snapshotAiResidualMacroContext(context);
  if (snapshot === null) {
    throw new TypeError("invalid residual macro context");
  }
  const common = {
    round: snapshot.round,
    tavernTier: snapshot.tavernTier,
    health: snapshot.health,
    armor: snapshot.armor,
    gold: snapshot.gold,
    boardSize: snapshot.boardSize,
    handSize: snapshot.handSize,
  };
  switch (snapshot.kind) {
    case "upgrade":
      return createProfileNeutralAiResidualSemanticRecord({
        kind: "upgrade",
        common,
        upgradeCost: snapshot.upgradeCost,
      });
    case "refresh":
      return createProfileNeutralAiResidualSemanticRecord({
        kind: "refresh",
        common,
        refreshCurrency: snapshot.refreshCurrency,
        refreshCost: snapshot.refreshCost,
      });
    case "freeze":
      return createProfileNeutralAiResidualSemanticRecord({
        kind: "freeze",
        common,
        currentlyFrozen: snapshot.currentlyFrozen,
      });
  }
}

const COMMON_FEATURE_NAMES = Object.freeze([
  "round_known", "round_value",
  "tavern_tier_known", "tavern_tier_value",
  "health_known", "health_value",
  "armor_known", "armor_value",
  "effective_health_known", "effective_health_value",
  "gold_known", "gold_value",
  "board_size_known", "board_size_value",
  "hand_size_known", "hand_size_value",
  "legacy_choice_known", "legacy_choice_positive",
  "profile_known",
  ...AI_RESIDUAL_FEATURE_PROFILE_IDS.map((id) => `profile_${id}`),
]);

const UPGRADE_FEATURE_NAMES = Object.freeze([
  ...COMMON_FEATURE_NAMES,
  "checkpoint_known", "checkpoint_opening",
  "actions_taken_known", "actions_taken_value",
  "refreshes_taken_known", "refreshes_taken_value",
  "upgrade_cost_known", "upgrade_cost_value",
  "gold_after_upgrade_known", "gold_after_upgrade_value",
  "target_board_size_known", "target_board_size_value",
  "best_shop_score_known", "best_shop_score_present", "best_shop_score_value",
  "weakest_board_score_known", "weakest_board_score_present", "weakest_board_score_value",
  "shop_board_margin_known", "shop_board_margin_value",
  "best_affordable_spell_score_known", "best_affordable_spell_score_present", "best_affordable_spell_score_value",
]);

const REFRESH_FEATURE_NAMES = Object.freeze([
  ...COMMON_FEATURE_NAMES,
  "refresh_currency_known", "refresh_currency_gold", "refresh_currency_health",
  "refresh_cost_known", "refresh_cost_value",
  "affordable_known", "affordable_true",
  "health_spend_safe_known", "health_spend_safe_true",
  "free_refresh_source_known", "free_refresh_source_none", "free_refresh_source_hero", "free_refresh_source_counter",
  "remaining_health_refreshes_known", "remaining_health_refreshes_value",
  "rewinds_recruit_damage_known", "rewinds_recruit_damage_true",
  "refreshes_this_turn_known", "refreshes_this_turn_value",
  "refresh_limit_known", "refresh_limit_value",
  "refresh_fraction_known", "refresh_fraction_value",
  "actions_taken_known", "actions_taken_value",
  "action_limit_known", "action_limit_value",
  "action_fraction_known", "action_fraction_value",
  "minion_purchase_cost_known", "minion_purchase_cost_value",
  "can_buy_after_refresh_known", "can_buy_after_refresh_true",
  "can_speculatively_refresh_known", "can_speculatively_refresh_true",
  "gold_after_refresh_known", "gold_after_refresh_value",
  "effective_health_after_refresh_known", "effective_health_after_refresh_value",
  "health_spend_floor_known", "health_spend_floor_value",
  "health_margin_after_refresh_known", "health_margin_after_refresh_value",
  "target_board_size_known", "target_board_size_value",
]);

const FREEZE_FEATURE_NAMES = Object.freeze([
  ...COMMON_FEATURE_NAMES,
  "currently_frozen_known", "currently_frozen_true",
  "best_minion_score_known", "best_minion_score_present", "best_minion_score_value",
  "best_spell_score_known", "best_spell_score_present", "best_spell_score_value",
  "best_triple_progress_known", "best_triple_progress_value",
  "remaining_minion_purchase_cost_known", "remaining_minion_purchase_cost_value",
  "hand_full_known", "hand_full_true",
  "freeze_pair_count_known", "freeze_pair_count_value",
  "minion_score_threshold_known", "minion_score_threshold_value",
  "spell_score_threshold_known", "spell_score_threshold_value",
  "minion_score_margin_known", "minion_score_margin_value",
  "spell_score_margin_known", "spell_score_margin_value",
  "freeze_minion_reason_known", "freeze_minion_reason_true",
  "freeze_spell_reason_known", "freeze_spell_reason_true",
  "unspent_gold_known", "unspent_gold_value",
]);

export const AI_RESIDUAL_FEATURE_SCHEMA = Object.freeze({
  schemaVersion: AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
  contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
  transforms: Object.freeze({
    nonNegative: "x/(x+scale)",
    signed: "tanh(x/scale)",
    missing: "known=0,value=0",
  }),
  profileIds: AI_RESIDUAL_FEATURE_PROFILE_IDS,
  heads: Object.freeze({
    upgrade: Object.freeze({
      positiveChoice: "upgradeNow" as const,
      negativeChoice: "deferUpgrade" as const,
      featureNames: UPGRADE_FEATURE_NAMES,
    }),
    refresh: Object.freeze({
      positiveChoice: "refreshOnce" as const,
      negativeChoice: "stopRefreshing" as const,
      featureNames: REFRESH_FEATURE_NAMES,
    }),
    freeze: Object.freeze({
      positiveChoice: "freeze" as const,
      negativeChoice: "unfreeze" as const,
      featureNames: FREEZE_FEATURE_NAMES,
    }),
  }),
});

function nonNegative(value: number, scale: number): number {
  return value / (value + scale);
}

function signed(value: number, scale: number): number {
  return Math.tanh(value / scale);
}

function numeric(
  field: AiResidualKnownValue<number>,
  transform: (value: number) => number,
): number[] {
  return field.known ? [1, transform(field.value)] : [0, 0];
}

function boolean(field: AiResidualKnownValue<boolean>): number[] {
  return field.known ? [1, field.value ? 1 : 0] : [0, 0];
}

function nullableScore(field: AiResidualKnownValue<number | null>): number[] {
  if (!field.known) return [0, 0, 0];
  if (field.value === null) return [1, 0, 0];
  return [1, 1, signed(field.value, 20)];
}

function derivedNumeric(
  dependencies: readonly AiResidualKnownValue<unknown>[],
  value: () => number,
  transform: (item: number) => number,
): number[] {
  return dependencies.every((field) => field.known)
    ? [1, transform(value())]
    : [0, 0];
}

function positiveLegacyChoice(record: AiResidualSemanticRecord): string {
  switch (record.kind) {
    case "upgrade": return "upgradeNow";
    case "refresh": return "refreshOnce";
    case "freeze": return "freeze";
  }
}

function commonFeatures(record: AiResidualSemanticRecord): number[] {
  const values = [
    ...numeric(record.round, (value) => nonNegative(value, 20)),
    ...numeric(record.tavernTier, (value) => (value - 1) / 6),
    ...numeric(record.health, (value) => nonNegative(value, 40)),
    ...numeric(record.armor, (value) => nonNegative(value, 20)),
    ...derivedNumeric(
      [record.health, record.armor],
      () =>
        (record.health as { known: true; value: number }).value +
        (record.armor as { known: true; value: number }).value,
      (value) => nonNegative(value, 40),
    ),
    ...numeric(record.gold, (value) => nonNegative(value, 10)),
    ...numeric(record.boardSize, (value) => value / 7),
    ...numeric(record.handSize, (value) => value / 10),
  ];
  if (record.legacyChoice.known) {
    values.push(
      1,
      record.legacyChoice.value === positiveLegacyChoice(record) ? 1 : 0,
    );
  } else {
    values.push(0, 0);
  }
  if (record.profileId.known) {
    values.push(1);
    for (const profileId of AI_RESIDUAL_FEATURE_PROFILE_IDS) {
      values.push(record.profileId.value === profileId ? 1 : 0);
    }
  } else {
    values.push(0, ...AI_RESIDUAL_FEATURE_PROFILE_IDS.map(() => 0));
  }
  return values;
}

function upgradeFeatures(record: AiResidualUpgradeSemanticRecord): number[] {
  const values = commonFeatures(record);
  const shopBoardMargin =
    record.bestShopScore.known &&
    record.bestShopScore.value !== null &&
    record.weakestBoardScore.known &&
    record.weakestBoardScore.value !== null
      ? [
          1,
          signed(record.bestShopScore.value - record.weakestBoardScore.value, 20),
        ]
      : [0, 0];
  values.push(
    ...(record.checkpoint.known
      ? [1, record.checkpoint.value === "opening" ? 1 : 0]
      : [0, 0]),
    ...numeric(record.actionsTaken, (value) => nonNegative(value, 10)),
    ...numeric(record.refreshesTaken, (value) => nonNegative(value, 5)),
    ...numeric(record.upgradeCost, (value) => nonNegative(value, 10)),
    ...derivedNumeric(
      [record.gold, record.upgradeCost],
      () =>
        (record.gold as { known: true; value: number }).value -
        (record.upgradeCost as { known: true; value: number }).value,
      (value) => signed(value, 10),
    ),
    ...numeric(record.targetBoardSize, (value) => value / 7),
    ...nullableScore(record.bestShopScore),
    ...nullableScore(record.weakestBoardScore),
    ...shopBoardMargin,
    ...nullableScore(record.bestAffordableSpellScore),
  );
  return values;
}

function refreshFeatures(record: AiResidualRefreshSemanticRecord): number[] {
  const values = commonFeatures(record);
  values.push(
    ...(record.refreshCurrency.known
      ? [
          1,
          record.refreshCurrency.value === "gold" ? 1 : 0,
          record.refreshCurrency.value === "health" ? 1 : 0,
        ]
      : [0, 0, 0]),
    ...numeric(record.refreshCost, (value) => nonNegative(value, 5)),
    ...boolean(record.affordable),
    ...boolean(record.healthSpendSafe),
    ...(record.freeRefreshSource.known
      ? [
          1,
          record.freeRefreshSource.value === null ? 1 : 0,
          record.freeRefreshSource.value === "hero" ? 1 : 0,
          record.freeRefreshSource.value === "counter" ? 1 : 0,
        ]
      : [0, 0, 0, 0]),
    ...numeric(record.remainingHealthRefreshes, (value) => nonNegative(value, 3)),
    ...boolean(record.rewindsRecruitDamage),
    ...numeric(record.refreshesThisTurn, (value) => nonNegative(value, 5)),
    ...numeric(record.refreshLimit, (value) => nonNegative(value, 5)),
    ...derivedNumeric(
      [record.refreshesThisTurn, record.refreshLimit],
      () =>
        (record.refreshesThisTurn as { known: true; value: number }).value /
        Math.max(1, (record.refreshLimit as { known: true; value: number }).value),
      (value) => value,
    ),
    ...numeric(record.actionsTaken, (value) => nonNegative(value, 10)),
    ...numeric(record.actionLimit, (value) => nonNegative(value, 10)),
    ...derivedNumeric(
      [record.actionsTaken, record.actionLimit],
      () =>
        (record.actionsTaken as { known: true; value: number }).value /
        Math.max(1, (record.actionLimit as { known: true; value: number }).value),
      (value) => value,
    ),
    ...numeric(record.minionPurchaseCost, (value) => nonNegative(value, 5)),
    ...boolean(record.canBuyAfterRefresh),
    ...boolean(record.canSpeculativelyRefresh),
    ...numeric(record.goldAfterRefresh, (value) => nonNegative(value, 10)),
    ...numeric(record.effectiveHealthAfterRefresh, (value) => nonNegative(value, 40)),
    ...numeric(record.healthSpendFloor, (value) => nonNegative(value, 40)),
    ...derivedNumeric(
      [record.effectiveHealthAfterRefresh, record.healthSpendFloor],
      () =>
        (record.effectiveHealthAfterRefresh as { known: true; value: number }).value -
        (record.healthSpendFloor as { known: true; value: number }).value,
      (value) => signed(value, 20),
    ),
    ...numeric(record.targetBoardSize, (value) => value / 7),
  );
  return values;
}

function freezeFeatures(record: AiResidualFreezeSemanticRecord): number[] {
  const values = commonFeatures(record);
  values.push(
    ...boolean(record.currentlyFrozen),
    ...nullableScore(record.bestMinionScore),
    ...nullableScore(record.bestSpellScore),
    ...numeric(record.bestTripleProgress, (value) => value / 2),
    ...numeric(record.remainingMinionPurchaseCost, (value) => nonNegative(value, 5)),
    ...boolean(record.handFull),
    ...numeric(record.freezePairCount, (value) => (value - 1) / 1),
    ...numeric(record.minionScoreThreshold, (value) => signed(value, 20)),
    ...numeric(record.spellScoreThreshold, (value) => signed(value, 20)),
  );
  const minionMargin =
    record.bestMinionScore.known &&
    record.bestMinionScore.value !== null &&
    record.minionScoreThreshold.known
      ? [
          1,
          signed(
            record.bestMinionScore.value - record.minionScoreThreshold.value,
            20,
          ),
        ]
      : [0, 0];
  const spellMargin =
    record.bestSpellScore.known &&
    record.bestSpellScore.value !== null &&
    record.spellScoreThreshold.known
      ? [
          1,
          signed(
            record.bestSpellScore.value - record.spellScoreThreshold.value,
            20,
          ),
        ]
      : [0, 0];
  values.push(
    ...minionMargin,
    ...spellMargin,
    ...boolean(record.freezeMinionReason),
    ...boolean(record.freezeSpellReason),
    ...numeric(record.unspentGold, (value) => nonNegative(value, 10)),
  );
  return values;
}

/** Encodes full and partial semantic records into one stable feature schema. */
export function encodeAiResidualSemanticRecord(
  record: AiResidualSemanticRecord,
): DeepReadonly<AiResidualEncodedFeatures> {
  let names: readonly string[];
  let values: number[];
  switch (record.kind) {
    case "upgrade":
      names = UPGRADE_FEATURE_NAMES;
      values = upgradeFeatures(record);
      break;
    case "refresh":
      names = REFRESH_FEATURE_NAMES;
      values = refreshFeatures(record);
      break;
    case "freeze":
      names = FREEZE_FEATURE_NAMES;
      values = freezeFeatures(record);
      break;
  }
  if (values.length !== names.length || values.some((value) => !Number.isFinite(value))) {
    throw new TypeError(`invalid ${record.kind} residual feature vector`);
  }
  return Object.freeze({
    schemaVersion: AI_RESIDUAL_FEATURE_SCHEMA_VERSION,
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: record.kind,
    names,
    values: Object.freeze(values),
  });
}

export function encodeAiResidualMacroContext(
  context: AiResidualMacroContext,
): DeepReadonly<AiResidualEncodedFeatures> {
  return encodeAiResidualSemanticRecord(
    createVisibleOnlyAiResidualSemanticRecord(context),
  );
}

export function tryEncodeAiResidualMacroContext(
  context: AiResidualMacroContext,
): DeepReadonly<AiResidualEncodedFeatures> | null {
  try {
    return encodeAiResidualMacroContext(context);
  } catch {
    return null;
  }
}
