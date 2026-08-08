export const SPELL_CAST_PRESENTATION_STAGES = [
  "cardLift",
  "spellRelease",
  "effectResolve",
] as const;

export type SpellCastPresentationStage =
  (typeof SPELL_CAST_PRESENTATION_STAGES)[number];

export type SpellCastCardKind = "tavernSpell" | "spellcraft";

export interface SpellCastPresentationState {
  readonly token: number;
  readonly cardInstanceId: string;
  readonly cardKind: SpellCastCardKind;
  readonly cardName: string;
  readonly targetInstanceId: string | null;
  readonly targetName: string | null;
  readonly stage: SpellCastPresentationStage;
  readonly revision: number;
}

export type SpellCastPresentationAction =
  | {
      readonly type: "advance";
      readonly expectedToken: number;
      readonly expectedCardInstanceId: string;
      readonly expectedStage: SpellCastPresentationStage;
      readonly expectedRevision: number;
    }
  | {
      readonly type: "skip";
      readonly expectedToken: number;
      readonly expectedCardInstanceId: string;
    };

export interface CreateSpellCastPresentationInput {
  /** Must reflect an already accepted engine transition. */
  readonly accepted: boolean;
  readonly token: number;
  readonly cardInstanceId: string;
  readonly cardKind: SpellCastCardKind;
  readonly cardName: string;
  readonly targetInstanceId?: string | null;
  readonly targetName?: string | null;
}

const NEXT_STAGE: Readonly<
  Partial<Record<SpellCastPresentationStage, SpellCastPresentationStage>>
> = Object.freeze({
  cardLift: "spellRelease",
  spellRelease: "effectResolve",
});

// These timings are a conservative local presentation cadence, not a claim
// about exact frame timing in the live client.
const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<SpellCastPresentationStage, number>
> = Object.freeze({
  cardLift: 200,
  spellRelease: 260,
  effectResolve: 220,
});

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<SpellCastPresentationStage, number>
> = Object.freeze({
  cardLift: 30,
  spellRelease: 40,
  effectResolve: 30,
});

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isValidText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function isCardKind(value: unknown): value is SpellCastCardKind {
  return value === "tavernSpell" || value === "spellcraft";
}

function isPresentationStage(
  value: unknown,
): value is SpellCastPresentationStage {
  return (
    typeof value === "string" &&
    (SPELL_CAST_PRESENTATION_STAGES as readonly string[]).includes(value)
  );
}

function hasValidInputTargetPair(
  targetInstanceId: unknown,
  targetName: unknown,
): boolean {
  if (targetInstanceId === undefined && targetName === undefined) return true;
  if (targetInstanceId === null && targetName === null) return true;
  return isValidText(targetInstanceId) && isValidText(targetName);
}

function hasValidStateTargetPair(
  targetInstanceId: unknown,
  targetName: unknown,
): boolean {
  return (
    (targetInstanceId === null && targetName === null) ||
    (isValidText(targetInstanceId) && isValidText(targetName))
  );
}

function isValidState(value: unknown): value is SpellCastPresentationState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SpellCastPresentationState>;
  return (
    isPositiveInteger(candidate.token) &&
    isValidText(candidate.cardInstanceId) &&
    isCardKind(candidate.cardKind) &&
    isValidText(candidate.cardName) &&
    hasValidStateTargetPair(
      candidate.targetInstanceId,
      candidate.targetName,
    ) &&
    isPresentationStage(candidate.stage) &&
    isNonNegativeInteger(candidate.revision)
  );
}

function freezePresentation(
  state: SpellCastPresentationState,
): SpellCastPresentationState {
  return Object.freeze({ ...state });
}

/**
 * Creates an immutable, client-only animation snapshot after one spell action
 * has already been accepted and committed by the engine. It never enters
 * GameState, so refreshing cannot replay or repeat the spell effect.
 */
export function createSpellCastPresentation(
  input: CreateSpellCastPresentationInput,
): SpellCastPresentationState | null {
  if (!input || typeof input !== "object") return null;
  const {
    accepted,
    token,
    cardInstanceId,
    cardKind,
    cardName,
    targetInstanceId,
    targetName,
  } = input;
  if (
    accepted !== true ||
    !isPositiveInteger(token) ||
    !isValidText(cardInstanceId) ||
    !isCardKind(cardKind) ||
    !isValidText(cardName) ||
    !hasValidInputTargetPair(targetInstanceId, targetName)
  ) {
    return null;
  }

  return freezePresentation({
    token,
    cardInstanceId,
    cardKind,
    cardName,
    targetInstanceId: targetInstanceId ?? null,
    targetName: targetName ?? null,
    stage: "cardLift",
    revision: 0,
  });
}

export function transitionSpellCastPresentation(
  state: SpellCastPresentationState | null,
  action: SpellCastPresentationAction,
): SpellCastPresentationState | null {
  if (
    !state ||
    !isValidState(state) ||
    !action ||
    typeof action !== "object"
  ) {
    return state;
  }

  if (action.type === "skip") {
    if (
      !isPositiveInteger(action.expectedToken) ||
      !isValidText(action.expectedCardInstanceId) ||
      action.expectedToken !== state.token ||
      action.expectedCardInstanceId !== state.cardInstanceId
    ) {
      return state;
    }
    return null;
  }

  if (action.type !== "advance") return state;
  if (
    !isPositiveInteger(action.expectedToken) ||
    !isValidText(action.expectedCardInstanceId) ||
    !isPresentationStage(action.expectedStage) ||
    !isNonNegativeInteger(action.expectedRevision) ||
    action.expectedToken !== state.token ||
    action.expectedCardInstanceId !== state.cardInstanceId ||
    action.expectedStage !== state.stage ||
    action.expectedRevision !== state.revision
  ) {
    return state;
  }

  const nextStage = NEXT_STAGE[state.stage];
  if (!nextStage) return null;
  return freezePresentation({
    ...state,
    stage: nextStage,
    revision: state.revision + 1,
  });
}

export function spellCastPresentationDuration(
  stage: SpellCastPresentationStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}

export function spellCastPresentationAnnouncement(
  state: SpellCastPresentationState,
): string {
  if (!isValidState(state)) return "";
  const kindLabel =
    state.cardKind === "tavernSpell" ? "酒馆法术" : "塑造法术";
  if (state.stage === "cardLift") {
    return `举起${kindLabel}“${state.cardName}”。`;
  }
  if (state.stage === "spellRelease") {
    return state.targetName
      ? `向${state.targetName}施放“${state.cardName}”。`
      : `施放${kindLabel}“${state.cardName}”。`;
  }
  return state.targetName
    ? `“${state.cardName}”已作用于${state.targetName}。`
    : `“${state.cardName}”的效果已结算。`;
}
