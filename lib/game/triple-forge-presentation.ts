export const TRIPLE_FORGE_PRESENTATION_STAGES = [
  "acquireHandoff",
  "forgeImpact",
  "goldenReveal",
  "handArrival",
] as const;

export type TripleForgePresentationStage =
  (typeof TRIPLE_FORGE_PRESENTATION_STAGES)[number];

export interface TripleForgePresentationState {
  readonly token: number;
  readonly goldenInstanceId: string;
  readonly stage: TripleForgePresentationStage;
  readonly revision: number;
}

export type TripleForgePresentationAction =
  | {
      readonly type: "advance";
      readonly expectedToken: number;
      readonly expectedGoldenInstanceId: string;
      readonly expectedStage: TripleForgePresentationStage;
      readonly expectedRevision: number;
    }
  | {
      readonly type: "skip";
      readonly expectedToken: number;
      readonly expectedGoldenInstanceId: string;
    };

export interface CreateTripleForgePresentationInput {
  readonly token: number;
  readonly goldenInstanceId: string;
}

const NEXT_STAGE: Readonly<
  Partial<Record<TripleForgePresentationStage, TripleForgePresentationStage>>
> = Object.freeze({
  acquireHandoff: "forgeImpact",
  forgeImpact: "goldenReveal",
  goldenReveal: "handArrival",
});

const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<TripleForgePresentationStage, number>
> = Object.freeze({
  acquireHandoff: 100,
  forgeImpact: 230,
  goldenReveal: 170,
  handArrival: 90,
});

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<TripleForgePresentationStage, number>
> = Object.freeze({
  acquireHandoff: 20,
  forgeImpact: 40,
  goldenReveal: 40,
  handArrival: 20,
});

export const TRIPLE_FORGE_STAGE_ANNOUNCEMENTS: Readonly<
  Record<TripleForgePresentationStage, string>
> = Object.freeze({
  acquireHandoff: "第三张随从已获得，开始三连。",
  forgeImpact: "三连锻造中。",
  goldenReveal: "金色随从已揭示。",
  handArrival: "金色随从已进入手牌。",
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

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function isPresentationStage(
  value: unknown,
): value is TripleForgePresentationStage {
  return (
    typeof value === "string" &&
    (TRIPLE_FORGE_PRESENTATION_STAGES as readonly string[]).includes(value)
  );
}

function isValidState(
  value: unknown,
): value is TripleForgePresentationState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TripleForgePresentationState>;
  return (
    isPositiveInteger(candidate.token) &&
    isValidId(candidate.goldenInstanceId) &&
    isPresentationStage(candidate.stage) &&
    isNonNegativeInteger(candidate.revision)
  );
}

function freezePresentation(
  state: TripleForgePresentationState,
): TripleForgePresentationState {
  return Object.freeze({ ...state });
}

/**
 * Creates client-only presentation state after the engine has already
 * committed a triple. The token distinguishes repeated forges of the same
 * definition, while the instance ID anchors the real golden hand card.
 */
export function createTripleForgePresentation(
  input: CreateTripleForgePresentationInput,
): TripleForgePresentationState | null {
  if (
    !input ||
    typeof input !== "object" ||
    !isPositiveInteger(input.token) ||
    !isValidId(input.goldenInstanceId)
  ) {
    return null;
  }

  return freezePresentation({
    token: input.token,
    goldenInstanceId: input.goldenInstanceId,
    stage: "acquireHandoff",
    revision: 0,
  });
}

export function transitionTripleForgePresentation(
  state: TripleForgePresentationState | null,
  action: TripleForgePresentationAction,
): TripleForgePresentationState | null {
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
      !isValidId(action.expectedGoldenInstanceId) ||
      action.expectedToken !== state.token ||
      action.expectedGoldenInstanceId !== state.goldenInstanceId
    ) {
      return state;
    }
    return null;
  }

  if (action.type !== "advance") return state;
  if (
    !isPositiveInteger(action.expectedToken) ||
    !isValidId(action.expectedGoldenInstanceId) ||
    !isPresentationStage(action.expectedStage) ||
    !isNonNegativeInteger(action.expectedRevision) ||
    action.expectedToken !== state.token ||
    action.expectedGoldenInstanceId !== state.goldenInstanceId ||
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

export function tripleForgePresentationDuration(
  stage: TripleForgePresentationStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}

export function tripleForgeStageAnnouncement(
  stage: TripleForgePresentationStage,
): string {
  return TRIPLE_FORGE_STAGE_ANNOUNCEMENTS[stage];
}
