export type DiscoverChoicePresentationStage =
  | "selectedFocus"
  | "returnToTavern"
  | "rewardArrival";

export type DiscoverChoiceRewardKind = "hand" | "immediate";

export interface DiscoverChoicePresentationState {
  readonly interactionId: string;
  readonly optionIds: readonly string[];
  readonly selectedOptionId: string;
  readonly rewardKind: DiscoverChoiceRewardKind | null;
  readonly rewardInstanceId: string | null;
  readonly stage: DiscoverChoicePresentationStage;
  readonly revision: number;
}

export type DiscoverChoicePresentationAction =
  | {
      readonly type: "advance";
      readonly expectedInteractionId: string;
      readonly expectedStage: DiscoverChoicePresentationStage;
      readonly expectedRevision: number;
    }
  | {
      readonly type: "skip";
      readonly expectedInteractionId: string;
    };

export interface CreateDiscoverChoicePresentationInput {
  readonly accepted: boolean;
  readonly interactionId: string;
  readonly optionIds: readonly string[];
  readonly selectedOptionId: string;
  readonly rewardKind?: DiscoverChoiceRewardKind;
  readonly rewardInstanceId?: string;
}

export interface DiscoverTripleEventLike {
  readonly kind: string;
  readonly golden?: {
    readonly instanceId: string;
    readonly definitionId: string;
    readonly name: string;
  };
  readonly knownConsumedInstanceIds?: readonly string[];
}

export interface DiscoverTripleRewardMatch {
  readonly instanceId: string;
  readonly definitionId: string;
  readonly name: string;
}

const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<DiscoverChoicePresentationStage, number>
> = {
  selectedFocus: 520,
  returnToTavern: 420,
  rewardArrival: 620,
};

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<DiscoverChoicePresentationStage, number>
> = {
  selectedFocus: 80,
  returnToTavern: 80,
  rewardArrival: 80,
};

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function isRewardKind(value: unknown): value is DiscoverChoiceRewardKind {
  return value === "hand" || value === "immediate";
}

/**
 * Finds the golden hand card created when a Discover choice supplies the
 * third copy. The consumed-ID list can be incomplete for effect-created
 * copies, so matching the selected definition is an intentional fallback.
 */
export function findDiscoverTripleReward(
  events: readonly DiscoverTripleEventLike[],
  selectedInstanceId: string,
  selectedDefinitionId: string,
): DiscoverTripleRewardMatch | null {
  const triples = events.filter(
    (event): event is DiscoverTripleEventLike & {
      readonly golden: DiscoverTripleRewardMatch;
    } => event.kind === "triple" && event.golden !== undefined,
  );
  const exactConsumedMatch = triples.find(
    (event) =>
      event.knownConsumedInstanceIds?.includes(selectedInstanceId) === true,
  );
  const definitionFallback = triples.find(
    (event) => event.golden.definitionId === selectedDefinitionId,
  );
  const triple = exactConsumedMatch ?? definitionFallback;
  return triple ? { ...triple.golden } : null;
}

function freezePresentation({
  interactionId,
  optionIds,
  selectedOptionId,
  rewardKind,
  rewardInstanceId,
  stage,
  revision,
}: DiscoverChoicePresentationState): DiscoverChoicePresentationState {
  const immutableOptionIds = Object.freeze([...optionIds]);
  return Object.freeze({
    interactionId,
    optionIds: immutableOptionIds,
    selectedOptionId,
    rewardKind,
    rewardInstanceId,
    stage,
    revision,
  });
}

/**
 * Captures one accepted one-to-four-option Discover-style selection as
 * client-only presentation state. The engine result is already authoritative;
 * this immutable snapshot exists only long enough to focus the selection and
 * return it to the tavern.
 */
export function createDiscoverChoicePresentation({
  accepted,
  interactionId,
  optionIds,
  selectedOptionId,
  rewardKind: requestedRewardKind,
  rewardInstanceId,
}: CreateDiscoverChoicePresentationInput): DiscoverChoicePresentationState | null {
  const rewardKind = requestedRewardKind ?? null;
  if (
    !accepted ||
    !isValidId(interactionId) ||
    !Array.isArray(optionIds) ||
    optionIds.length < 1 ||
    optionIds.length > 4 ||
    !optionIds.every(isValidId) ||
    new Set(optionIds).size !== optionIds.length ||
    !isValidId(selectedOptionId) ||
    !optionIds.includes(selectedOptionId) ||
    (rewardKind !== null && !isRewardKind(rewardKind))
  ) {
    return null;
  }

  if (
    (rewardKind === "hand" && !isValidId(rewardInstanceId)) ||
    (rewardKind === "immediate" &&
      rewardInstanceId !== undefined &&
      !isValidId(rewardInstanceId)) ||
    (rewardKind === null && rewardInstanceId !== undefined)
  ) {
    return null;
  }

  return freezePresentation({
    interactionId,
    optionIds,
    selectedOptionId,
    rewardKind,
    rewardInstanceId: rewardInstanceId ?? null,
    stage: "selectedFocus",
    revision: 0,
  });
}

export function transitionDiscoverChoicePresentation(
  state: DiscoverChoicePresentationState | null,
  action: DiscoverChoicePresentationAction,
): DiscoverChoicePresentationState | null {
  if (!state || action.expectedInteractionId !== state.interactionId) {
    return state;
  }
  if (action.type === "skip") {
    return null;
  }
  if (
    action.expectedStage !== state.stage ||
    action.expectedRevision !== state.revision
  ) {
    return state;
  }

  if (state.stage === "rewardArrival") {
    return null;
  }
  if (state.stage === "returnToTavern" && state.rewardKind !== "hand") {
    return null;
  }

  return freezePresentation({
    ...state,
    stage:
      state.stage === "selectedFocus" ? "returnToTavern" : "rewardArrival",
    revision: state.revision + 1,
  });
}

export function discoverChoicePresentationDuration(
  stage: DiscoverChoicePresentationStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}
