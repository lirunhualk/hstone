import type { PlayerId, TavernTier } from "./types.ts";

/**
 * Engine-independent boundary for optional residual AI policies.
 *
 * The legacy engine remains authoritative: providers may only choose between
 * the public, legal macro choices supplied by the caller, and every provider
 * failure falls back atomically to `legacyChoice`.
 */

export const AI_RESIDUAL_CONTEXT_VERSION = 1 as const;
export const AI_RESIDUAL_OVERRIDE_THRESHOLD = 0.9 as const;

export const AI_RESIDUAL_FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  "rngState",
  "seed",
  "pool",
  "shopPool",
  "spellPool",
  "instanceId",
  "interactionId",
  "playerId",
  "humanPlayerId",
  "pendingInteraction",
  "lastBattle",
  "lastRoundBattles",
  "nextInstanceId",
  "nextInteractionId",
] as const);

const FORBIDDEN_CONTEXT_KEY_SET = new Set<string>(
  AI_RESIDUAL_FORBIDDEN_CONTEXT_KEYS.map((key) => key.toLowerCase()),
);

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type AiResidualMacroKind = "upgrade" | "refresh" | "freeze";
export type AiUpgradeMacroChoice = "upgradeNow" | "deferUpgrade";
export type AiRefreshMacroChoice = "refreshOnce" | "stopRefreshing";
export type AiFreezeMacroChoice = "freeze" | "unfreeze";

interface AiResidualMacroContextBase<
  Kind extends AiResidualMacroKind,
  Choice extends string,
> {
  readonly contextVersion: typeof AI_RESIDUAL_CONTEXT_VERSION;
  readonly kind: Kind;
  readonly contentVersion: string;
  readonly policyVersion: string;
  readonly profileId: string;
  readonly round: number;
  readonly tavernTier: TavernTier;
  readonly health: number;
  readonly armor: number;
  readonly gold: number;
  readonly boardSize: number;
  readonly handSize: number;
  readonly legacyChoice: Choice;
  readonly legalChoices: readonly Choice[];
}

export interface AiUpgradeMacroContext
  extends AiResidualMacroContextBase<"upgrade", AiUpgradeMacroChoice> {
  readonly checkpoint: "opening" | "loop";
  readonly actionsTaken: number;
  readonly refreshesTaken: number;
  readonly upgradeCost: number;
  readonly targetBoardSize: number;
  readonly bestShopScore: number | null;
  readonly weakestBoardScore: number | null;
  readonly bestAffordableSpellScore: number | null;
}

export interface AiRefreshMacroContext
  extends AiResidualMacroContextBase<"refresh", AiRefreshMacroChoice> {
  readonly refreshCurrency: "gold" | "health";
  readonly refreshCost: number;
  readonly affordable: boolean;
  readonly healthSpendSafe: boolean;
  readonly freeRefreshSource: "hero" | "counter" | null;
  readonly remainingHealthRefreshes: number;
  readonly rewindsRecruitDamage: boolean;
  readonly refreshesThisTurn: number;
  readonly refreshLimit: number;
  readonly actionsTaken: number;
  readonly actionLimit: number;
  readonly minionPurchaseCost: number;
  readonly canBuyAfterRefresh: boolean;
  readonly canSpeculativelyRefresh: boolean;
  readonly goldAfterRefresh: number;
  readonly effectiveHealthAfterRefresh: number;
  readonly healthSpendFloor: number;
  readonly targetBoardSize: number;
}

export interface AiFreezeMacroContext
  extends AiResidualMacroContextBase<"freeze", AiFreezeMacroChoice> {
  readonly currentlyFrozen: boolean;
  readonly bestMinionScore: number | null;
  readonly bestSpellScore: number | null;
  readonly bestTripleProgress: 0 | 1 | 2;
  readonly remainingMinionPurchaseCost: number;
  readonly handFull: boolean;
  readonly freezePairCount: number;
  readonly minionScoreThreshold: number;
  readonly spellScoreThreshold: number;
  readonly freezeMinionReason: boolean;
  readonly freezeSpellReason: boolean;
  readonly unspentGold: number;
}

export type AiResidualMacroContext =
  | AiUpgradeMacroContext
  | AiRefreshMacroContext
  | AiFreezeMacroContext;

interface AiResidualPolicyProposalBase<
  Kind extends AiResidualMacroKind,
  Choice extends string,
> {
  readonly kind: Kind;
  readonly choice: Choice;
  readonly confidence: number;
  readonly reasonCode: string;
}

export type AiUpgradePolicyProposal = AiResidualPolicyProposalBase<
  "upgrade",
  AiUpgradeMacroChoice
>;
export type AiRefreshPolicyProposal = AiResidualPolicyProposalBase<
  "refresh",
  AiRefreshMacroChoice
>;
export type AiFreezePolicyProposal = AiResidualPolicyProposalBase<
  "freeze",
  AiFreezeMacroChoice
>;

export type AiResidualPolicyProposal =
  | AiUpgradePolicyProposal
  | AiRefreshPolicyProposal
  | AiFreezePolicyProposal;

export interface AiResidualPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly propose: (
    context: DeepReadonly<AiResidualMacroContext>,
  ) => AiResidualPolicyProposal | null;
}

export interface AiResidualKindDiagnostics {
  readonly decisions: number;
  readonly overridesApplied: number;
}

export interface AiResidualPolicyDiagnostics {
  readonly decisions: number;
  readonly providerCalls: number;
  readonly overridesApplied: number;
  readonly fallbacks: number;
  readonly noProvider: number;
  readonly abstentions: number;
  readonly lowConfidence: number;
  readonly invalidContexts: number;
  readonly invalidProposals: number;
  readonly providerErrors: number;
  readonly asyncProposals: number;
  readonly agreements: number;
  readonly byKind: Readonly<
    Record<AiResidualMacroKind, AiResidualKindDiagnostics>
  >;
}

export interface AiResidualPolicyRunResult<Result> {
  readonly result: Result;
  readonly diagnostics: AiResidualPolicyDiagnostics;
}

interface MutableKindDiagnostics {
  decisions: number;
  overridesApplied: number;
}

interface MutableDiagnostics {
  decisions: number;
  providerCalls: number;
  overridesApplied: number;
  fallbacks: number;
  noProvider: number;
  abstentions: number;
  lowConfidence: number;
  invalidContexts: number;
  invalidProposals: number;
  providerErrors: number;
  asyncProposals: number;
  agreements: number;
  byKind: Record<AiResidualMacroKind, MutableKindDiagnostics>;
}

interface ActivePolicyScope {
  readonly overrides: ReadonlyMap<PlayerId, AiResidualPolicy>;
  readonly diagnostics: MutableDiagnostics;
}

class InvalidResidualContextError extends Error {}

let activePolicyScope: ActivePolicyScope | null = null;

function createDiagnostics(): MutableDiagnostics {
  return {
    decisions: 0,
    providerCalls: 0,
    overridesApplied: 0,
    fallbacks: 0,
    noProvider: 0,
    abstentions: 0,
    lowConfidence: 0,
    invalidContexts: 0,
    invalidProposals: 0,
    providerErrors: 0,
    asyncProposals: 0,
    agreements: 0,
    byKind: {
      upgrade: { decisions: 0, overridesApplied: 0 },
      refresh: { decisions: 0, overridesApplied: 0 },
      freeze: { decisions: 0, overridesApplied: 0 },
    },
  };
}

function frozenDiagnostics(
  diagnostics: MutableDiagnostics,
): AiResidualPolicyDiagnostics {
  const byKind = Object.freeze({
    upgrade: Object.freeze({ ...diagnostics.byKind.upgrade }),
    refresh: Object.freeze({ ...diagnostics.byKind.refresh }),
    freeze: Object.freeze({ ...diagnostics.byKind.freeze }),
  });
  return Object.freeze({
    decisions: diagnostics.decisions,
    providerCalls: diagnostics.providerCalls,
    overridesApplied: diagnostics.overridesApplied,
    fallbacks: diagnostics.fallbacks,
    noProvider: diagnostics.noProvider,
    abstentions: diagnostics.abstentions,
    lowConfidence: diagnostics.lowConfidence,
    invalidContexts: diagnostics.invalidContexts,
    invalidProposals: diagnostics.invalidProposals,
    providerErrors: diagnostics.providerErrors,
    asyncProposals: diagnostics.asyncProposals,
    agreements: diagnostics.agreements,
    byKind,
  });
}

export function isAiResidualForbiddenContextKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    FORBIDDEN_CONTEXT_KEY_SET.has(normalized) ||
    normalized.endsWith("instanceid") ||
    normalized.endsWith("playerid")
  );
}

function cloneAndFreezeJson(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new InvalidResidualContextError("numbers must be finite");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new InvalidResidualContextError("context must be JSON data");
  }
  if (ancestors.has(value)) {
    throw new InvalidResidualContextError("context must not contain cycles");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const symbolKeys = Object.getOwnPropertySymbols(value);
      if (symbolKeys.length > 0) {
        throw new InvalidResidualContextError("symbol keys are not allowed");
      }
      const clone: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new InvalidResidualContextError("sparse arrays are not allowed");
        }
        clone.push(cloneAndFreezeJson(value[index], ancestors));
      }
      if (Object.keys(value).length !== value.length) {
        throw new InvalidResidualContextError(
          "array properties other than indexes are not allowed",
        );
      }
      return Object.freeze(clone);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new InvalidResidualContextError("only plain objects are allowed");
    }
    const clone: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new InvalidResidualContextError("symbol keys are not allowed");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !("value" in descriptor)
      ) {
        throw new InvalidResidualContextError(
          "context fields must be enumerable data properties",
        );
      }
      if (isAiResidualForbiddenContextKey(key)) {
        throw new InvalidResidualContextError(`forbidden context key: ${key}`);
      }
      clone[key] = cloneAndFreezeJson(descriptor.value, ancestors);
    }
    return Object.freeze(clone);
  } finally {
    ancestors.delete(value);
  }
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isNullableFiniteNumber(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

const CHOICES_BY_KIND = Object.freeze({
  upgrade: new Set<AiUpgradeMacroChoice>(["upgradeNow", "deferUpgrade"]),
  refresh: new Set<AiRefreshMacroChoice>([
    "refreshOnce",
    "stopRefreshing",
  ]),
  freeze: new Set<AiFreezeMacroChoice>(["freeze", "unfreeze"]),
});

const BASE_CONTEXT_KEYS = [
  "contextVersion",
  "kind",
  "contentVersion",
  "policyVersion",
  "profileId",
  "round",
  "tavernTier",
  "health",
  "armor",
  "gold",
  "boardSize",
  "handSize",
  "legacyChoice",
  "legalChoices",
] as const;

const CONTEXT_KEYS_BY_KIND: Readonly<
  Record<AiResidualMacroKind, ReadonlySet<string>>
> = Object.freeze({
  upgrade: new Set([
    ...BASE_CONTEXT_KEYS,
    "checkpoint",
    "actionsTaken",
    "refreshesTaken",
    "upgradeCost",
    "targetBoardSize",
    "bestShopScore",
    "weakestBoardScore",
    "bestAffordableSpellScore",
  ]),
  refresh: new Set([
    ...BASE_CONTEXT_KEYS,
    "refreshCurrency",
    "refreshCost",
    "affordable",
    "healthSpendSafe",
    "freeRefreshSource",
    "remainingHealthRefreshes",
    "rewindsRecruitDamage",
    "refreshesThisTurn",
    "refreshLimit",
    "actionsTaken",
    "actionLimit",
    "minionPurchaseCost",
    "canBuyAfterRefresh",
    "canSpeculativelyRefresh",
    "goldAfterRefresh",
    "effectiveHealthAfterRefresh",
    "healthSpendFloor",
    "targetBoardSize",
  ]),
  freeze: new Set([
    ...BASE_CONTEXT_KEYS,
    "currentlyFrozen",
    "bestMinionScore",
    "bestSpellScore",
    "bestTripleProgress",
    "remainingMinionPurchaseCost",
    "handFull",
    "freezePairCount",
    "minionScoreThreshold",
    "spellScoreThreshold",
    "freezeMinionReason",
    "freezeSpellReason",
    "unspentGold",
  ]),
});

function hasExactContextKeys(context: AiResidualMacroContext): boolean {
  const allowedKeys = CONTEXT_KEYS_BY_KIND[context.kind];
  if (allowedKeys === undefined) {
    return false;
  }
  const keys = Object.keys(context);
  return (
    keys.length === allowedKeys.size &&
    keys.every((key) => allowedKeys.has(key))
  );
}

function hasValidBaseFields(context: AiResidualMacroContext): boolean {
  if (
    !hasExactContextKeys(context) ||
    context.contextVersion !== AI_RESIDUAL_CONTEXT_VERSION ||
    typeof context.contentVersion !== "string" ||
    context.contentVersion.length === 0 ||
    context.contentVersion.length > 128 ||
    typeof context.policyVersion !== "string" ||
    context.policyVersion.length === 0 ||
    context.policyVersion.length > 128 ||
    typeof context.profileId !== "string" ||
    context.profileId.length === 0 ||
    context.profileId.length > 128 ||
    !isIntegerInRange(context.round, 0) ||
    !isIntegerInRange(context.tavernTier, 1, 6) ||
    !isIntegerInRange(context.health, 0) ||
    !isIntegerInRange(context.armor, 0) ||
    !isIntegerInRange(context.gold, 0) ||
    !isIntegerInRange(context.boardSize, 0, 7) ||
    !isIntegerInRange(context.handSize, 0)
  ) {
    return false;
  }

  const allowedChoices = CHOICES_BY_KIND[context.kind];
  if (
    allowedChoices === undefined ||
    !Array.isArray(context.legalChoices) ||
    context.legalChoices.length === 0 ||
    context.legalChoices.length > allowedChoices.size
  ) {
    return false;
  }
  const legalChoices = new Set<string>();
  for (const choice of context.legalChoices) {
    if (!allowedChoices.has(choice as never) || legalChoices.has(choice)) {
      return false;
    }
    legalChoices.add(choice);
  }
  return legalChoices.has(context.legacyChoice);
}

function hasValidKindFields(context: AiResidualMacroContext): boolean {
  switch (context.kind) {
    case "upgrade": {
      const exposesUpgradeNow = context.legalChoices.includes("upgradeNow");
      return (
        (context.checkpoint === "opening" ||
          context.checkpoint === "loop") &&
        isIntegerInRange(context.actionsTaken, 0, 50) &&
        isIntegerInRange(context.refreshesTaken, 0) &&
        isIntegerInRange(context.upgradeCost, 0) &&
        isIntegerInRange(context.targetBoardSize, 0, 7) &&
        isNullableFiniteNumber(context.bestShopScore) &&
        isNullableFiniteNumber(context.weakestBoardScore) &&
        isNullableFiniteNumber(context.bestAffordableSpellScore) &&
        (!exposesUpgradeNow ||
          (context.tavernTier < 6 && context.gold >= context.upgradeCost))
      );
    }
    case "refresh": {
      const exposesRefreshOnce =
        context.legalChoices.includes("refreshOnce");
      return (
        (context.refreshCurrency === "gold" ||
          context.refreshCurrency === "health") &&
        isIntegerInRange(context.refreshCost, 0) &&
        typeof context.affordable === "boolean" &&
        typeof context.healthSpendSafe === "boolean" &&
        (context.freeRefreshSource === null ||
          context.freeRefreshSource === "hero" ||
          context.freeRefreshSource === "counter") &&
        isIntegerInRange(context.remainingHealthRefreshes, 0) &&
        typeof context.rewindsRecruitDamage === "boolean" &&
        isIntegerInRange(context.refreshesThisTurn, 0) &&
        isIntegerInRange(context.refreshLimit, 0) &&
        context.refreshesThisTurn <= context.refreshLimit &&
        isIntegerInRange(context.actionsTaken, 0) &&
        isIntegerInRange(context.actionLimit, 1) &&
        context.actionsTaken < context.actionLimit &&
        isIntegerInRange(context.minionPurchaseCost, 0) &&
        typeof context.canBuyAfterRefresh === "boolean" &&
        typeof context.canSpeculativelyRefresh === "boolean" &&
        isIntegerInRange(context.goldAfterRefresh, 0) &&
        isIntegerInRange(context.effectiveHealthAfterRefresh, 0) &&
        isIntegerInRange(context.healthSpendFloor, 0) &&
        isIntegerInRange(context.targetBoardSize, 0, 7) &&
        (!exposesRefreshOnce ||
          (context.handSize < 10 &&
            context.refreshesThisTurn < context.refreshLimit &&
            context.actionsTaken < context.actionLimit &&
            context.affordable &&
            context.healthSpendSafe))
      );
    }
    case "freeze":
      return (
        typeof context.currentlyFrozen === "boolean" &&
        isNullableFiniteNumber(context.bestMinionScore) &&
        isNullableFiniteNumber(context.bestSpellScore) &&
        (context.bestTripleProgress === 0 ||
          context.bestTripleProgress === 1 ||
          context.bestTripleProgress === 2) &&
        isIntegerInRange(context.remainingMinionPurchaseCost, 0) &&
        typeof context.handFull === "boolean" &&
        isIntegerInRange(context.freezePairCount, 1, 2) &&
        Number.isFinite(context.minionScoreThreshold) &&
        Number.isFinite(context.spellScoreThreshold) &&
        typeof context.freezeMinionReason === "boolean" &&
        typeof context.freezeSpellReason === "boolean" &&
        isIntegerInRange(context.unspentGold, 0)
      );
  }
}

function validatedFrozenContext(
  context: AiResidualMacroContext,
): DeepReadonly<AiResidualMacroContext> {
  const cloned = cloneAndFreezeJson(
    context,
    new WeakSet<object>(),
  ) as DeepReadonly<AiResidualMacroContext>;
  if (!hasValidBaseFields(cloned) || !hasValidKindFields(cloned)) {
    throw new InvalidResidualContextError("invalid macro context");
  }
  return cloned;
}

function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function suppressThenableRejection(value: unknown): void {
  try {
    void Promise.resolve(value).catch(() => undefined);
  } catch {
    // A hostile thenable may throw while being assimilated. The residual
    // boundary has already rejected it and must never let that affect play.
  }
}

function isValidProposal(
  proposal: unknown,
  context: DeepReadonly<AiResidualMacroContext>,
): proposal is AiResidualPolicyProposal {
  if (
    proposal === null ||
    typeof proposal !== "object" ||
    Array.isArray(proposal)
  ) {
    return false;
  }
  const keys = Object.keys(proposal);
  if (
    keys.length !== 4 ||
    !keys.every((key) =>
      key === "kind" ||
      key === "choice" ||
      key === "confidence" ||
      key === "reasonCode"
    )
  ) {
    return false;
  }
  const candidate = proposal as Partial<AiResidualPolicyProposal>;
  return (
    candidate.kind === context.kind &&
    typeof candidate.choice === "string" &&
    context.legalChoices.includes(candidate.choice as never) &&
    typeof candidate.confidence === "number" &&
    Number.isFinite(candidate.confidence) &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    typeof candidate.reasonCode === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(candidate.reasonCode)
  );
}

function validatedFrozenProposal(
  proposal: unknown,
  context: DeepReadonly<AiResidualMacroContext>,
): Readonly<AiResidualPolicyProposal> | null {
  let snapshot: unknown;
  try {
    snapshot = cloneAndFreezeJson(proposal, new WeakSet<object>());
  } catch {
    return null;
  }
  return isValidProposal(snapshot, context) ? snapshot : null;
}

function recordDecision(
  diagnostics: MutableDiagnostics,
  kind: AiResidualMacroKind,
): void {
  diagnostics.decisions += 1;
  diagnostics.byKind[kind].decisions += 1;
}

function recordFallback(diagnostics: MutableDiagnostics): void {
  diagnostics.fallbacks += 1;
}

function safeInvalidContextFallback(
  context: AiResidualMacroContext,
): AiUpgradeMacroChoice | AiRefreshMacroChoice | AiFreezeMacroChoice {
  try {
    switch (context.kind) {
      case "upgrade":
        return "deferUpgrade";
      case "refresh":
        return "stopRefreshing";
      case "freeze":
        return "unfreeze";
    }
  } catch {
    // Accessors and proxies are rejected by context cloning. If even the kind
    // cannot be read safely, use a token that all engine mutation checks treat
    // as a no-op.
  }
  return "deferUpgrade";
}

/** Lets the engine avoid constructing a context when a seat has no provider. */
export function hasAiResidualPolicyOverride(playerId: PlayerId): boolean {
  return activePolicyScope?.overrides.has(playerId) === true;
}

/** Lets benchmark/search entry points fail closed on untracked providers. */
export function hasAnyAiResidualPolicyOverrides(): boolean {
  return (activePolicyScope?.overrides.size ?? 0) > 0;
}

export function resolveAiResidualMacroChoice(
  playerId: PlayerId,
  context: AiUpgradeMacroContext,
): AiUpgradeMacroChoice;
export function resolveAiResidualMacroChoice(
  playerId: PlayerId,
  context: AiRefreshMacroContext,
): AiRefreshMacroChoice;
export function resolveAiResidualMacroChoice(
  playerId: PlayerId,
  context: AiFreezeMacroContext,
): AiFreezeMacroChoice;
export function resolveAiResidualMacroChoice(
  playerId: PlayerId,
  context: AiResidualMacroContext,
): AiUpgradeMacroChoice | AiRefreshMacroChoice | AiFreezeMacroChoice {
  const scope = activePolicyScope;
  if (scope === null) {
    return context.legacyChoice;
  }

  const diagnostics = scope.diagnostics;
  let frozenContext: DeepReadonly<AiResidualMacroContext>;
  try {
    frozenContext = validatedFrozenContext(context);
  } catch {
    diagnostics.decisions += 1;
    diagnostics.invalidContexts += 1;
    recordFallback(diagnostics);
    return safeInvalidContextFallback(context);
  }
  const legacyChoice = frozenContext.legacyChoice;
  recordDecision(diagnostics, frozenContext.kind);
  const provider = scope.overrides.get(playerId);
  if (provider === undefined) {
    diagnostics.noProvider += 1;
    recordFallback(diagnostics);
    return legacyChoice;
  }

  diagnostics.providerCalls += 1;
  try {
    const proposal: unknown = provider.propose(frozenContext);
    if (isThenable(proposal)) {
      suppressThenableRejection(proposal);
      diagnostics.asyncProposals += 1;
      recordFallback(diagnostics);
      return legacyChoice;
    }
    if (proposal === null) {
      diagnostics.abstentions += 1;
      recordFallback(diagnostics);
      return legacyChoice;
    }
    const frozenProposal = validatedFrozenProposal(proposal, frozenContext);
    if (frozenProposal === null) {
      diagnostics.invalidProposals += 1;
      recordFallback(diagnostics);
      return legacyChoice;
    }
    if (frozenProposal.confidence < AI_RESIDUAL_OVERRIDE_THRESHOLD) {
      diagnostics.lowConfidence += 1;
      recordFallback(diagnostics);
      return legacyChoice;
    }
    if (frozenProposal.choice === legacyChoice) {
      diagnostics.agreements += 1;
      recordFallback(diagnostics);
      return legacyChoice;
    }

    diagnostics.overridesApplied += 1;
    diagnostics.byKind[context.kind].overridesApplied += 1;
    return frozenProposal.choice;
  } catch {
    diagnostics.providerErrors += 1;
    recordFallback(diagnostics);
    return legacyChoice;
  }
}

export function withAiResidualPolicyOverrides<Result>(
  overrides: ReadonlyMap<PlayerId, AiResidualPolicy>,
  run: () => Result,
): Readonly<AiResidualPolicyRunResult<Result>> {
  if (activePolicyScope !== null) {
    throw new Error("AI residual policy override scopes cannot be nested");
  }
  if (!(overrides instanceof Map)) {
    throw new TypeError("AI residual policy overrides must be a Map");
  }

  const copiedOverrides = new Map<PlayerId, AiResidualPolicy>();
  for (const [playerId, provider] of overrides) {
    if (!/^player-[0-7]$/.test(playerId)) {
      throw new RangeError(`invalid residual policy seat: ${playerId}`);
    }
    if (
      provider === null ||
      typeof provider !== "object" ||
      typeof provider.policyId !== "string" ||
      provider.policyId.length === 0 ||
      typeof provider.policyVersion !== "string" ||
      provider.policyVersion.length === 0 ||
      typeof provider.propose !== "function"
    ) {
      throw new TypeError(`invalid residual policy provider for ${playerId}`);
    }
    copiedOverrides.set(playerId, provider);
  }

  const diagnostics = createDiagnostics();
  activePolicyScope = { overrides: copiedOverrides, diagnostics };
  try {
    const result = run();
    if (isThenable(result)) {
      suppressThenableRejection(result);
      throw new TypeError(
        "AI residual policy override callbacks must be synchronous",
      );
    }
    return Object.freeze({
      result,
      diagnostics: frozenDiagnostics(diagnostics),
    });
  } finally {
    activePolicyScope = null;
  }
}
