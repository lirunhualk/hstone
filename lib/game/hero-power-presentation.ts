export const HERO_POWER_PRESENTATION_STAGES = [
  "sourcePulse",
  "resourceCommit",
  "effectResolve",
] as const;

export type HeroPowerPresentationStage =
  (typeof HERO_POWER_PRESENTATION_STAGES)[number];

export interface HeroPowerPresentationState {
  readonly token: number;
  readonly heroPowerId: string;
  readonly heroName: string;
  readonly powerName: string;
  readonly cost: number;
  readonly stage: HeroPowerPresentationStage;
  readonly revision: number;
}

export type HeroPowerPresentationAction =
  | {
      readonly type: "advance";
      readonly expectedToken: number;
      readonly expectedHeroPowerId: string;
      readonly expectedStage: HeroPowerPresentationStage;
      readonly expectedRevision: number;
    }
  | {
      readonly type: "skip";
      readonly expectedToken: number;
      readonly expectedHeroPowerId: string;
    };

export interface CreateHeroPowerPresentationInput {
  /** Must describe an engine transition that has already been accepted. */
  readonly accepted: boolean;
  readonly token: number;
  readonly heroPowerId: string;
  readonly heroName: string;
  readonly powerName: string;
  readonly cost: number;
}

const NEXT_STAGE: Readonly<
  Partial<Record<HeroPowerPresentationStage, HeroPowerPresentationStage>>
> = Object.freeze({
  sourcePulse: "resourceCommit",
  resourceCommit: "effectResolve",
});

// These timings preserve the observed source -> state -> effect order while
// remaining deliberately conservative about exact live-client frame timing.
const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<HeroPowerPresentationStage, number>
> = Object.freeze({
  sourcePulse: 240,
  resourceCommit: 260,
  effectResolve: 180,
});

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<HeroPowerPresentationStage, number>
> = Object.freeze({
  sourcePulse: 30,
  resourceCommit: 40,
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

function isPresentationStage(
  value: unknown,
): value is HeroPowerPresentationStage {
  return (
    typeof value === "string" &&
    (HERO_POWER_PRESENTATION_STAGES as readonly string[]).includes(value)
  );
}

function isValidState(value: unknown): value is HeroPowerPresentationState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HeroPowerPresentationState>;
  return (
    isPositiveInteger(candidate.token) &&
    isValidText(candidate.heroPowerId) &&
    isValidText(candidate.heroName) &&
    isValidText(candidate.powerName) &&
    isNonNegativeInteger(candidate.cost) &&
    isPresentationStage(candidate.stage) &&
    isNonNegativeInteger(candidate.revision)
  );
}

function freezePresentation(
  state: HeroPowerPresentationState,
): HeroPowerPresentationState {
  return Object.freeze({ ...state });
}

/**
 * Creates an immutable, client-only activation snapshot after the rules engine
 * has committed the Hero Power. It is never persisted and therefore cannot
 * replay or charge the player again after a refresh.
 */
export function createHeroPowerPresentation(
  input: CreateHeroPowerPresentationInput,
): HeroPowerPresentationState | null {
  if (!input || typeof input !== "object") return null;
  const { accepted, token, heroPowerId, heroName, powerName, cost } = input;
  if (
    accepted !== true ||
    !isPositiveInteger(token) ||
    !isValidText(heroPowerId) ||
    !isValidText(heroName) ||
    !isValidText(powerName) ||
    !isNonNegativeInteger(cost)
  ) {
    return null;
  }

  return freezePresentation({
    token,
    heroPowerId,
    heroName,
    powerName,
    cost,
    stage: "sourcePulse",
    revision: 0,
  });
}

export function transitionHeroPowerPresentation(
  state: HeroPowerPresentationState | null,
  action: HeroPowerPresentationAction,
): HeroPowerPresentationState | null {
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
      !isValidText(action.expectedHeroPowerId) ||
      action.expectedToken !== state.token ||
      action.expectedHeroPowerId !== state.heroPowerId
    ) {
      return state;
    }
    return null;
  }

  if (action.type !== "advance") return state;
  if (
    !isPositiveInteger(action.expectedToken) ||
    !isValidText(action.expectedHeroPowerId) ||
    !isPresentationStage(action.expectedStage) ||
    !isNonNegativeInteger(action.expectedRevision) ||
    action.expectedToken !== state.token ||
    action.expectedHeroPowerId !== state.heroPowerId ||
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

export function heroPowerPresentationDuration(
  stage: HeroPowerPresentationStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}

export function heroPowerPresentationAnnouncement(
  state: HeroPowerPresentationState,
): string {
  if (!isValidState(state)) return "";
  if (state.stage === "sourcePulse") {
    return `${state.heroName}发动英雄技能“${state.powerName}”。`;
  }
  if (state.stage === "resourceCommit") {
    return state.cost > 0
      ? `消耗${state.cost}枚金币，英雄技能状态已更新。`
      : "英雄技能状态已更新。";
  }
  return `英雄技能“${state.powerName}”的效果已结算。`;
}
