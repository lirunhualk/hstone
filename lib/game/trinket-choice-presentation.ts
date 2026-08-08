export type TrinketChoicePresentationStage =
  | "reveal"
  | "choosing"
  | "confirmFocus"
  | "effectHandoff";

export interface TrinketChoicePresentationState {
  readonly interactionId: string;
  readonly optionIds: readonly string[];
  readonly selectedOptionId: string | null;
  readonly hidden: boolean;
  readonly paidCost: number | null;
  readonly goldBefore: number | null;
  readonly goldAfter: number | null;
  readonly stage: TrinketChoicePresentationStage;
  readonly revision: number;
}

export type TrinketChoicePresentationAction =
  | {
      readonly type: "advance";
      readonly expectedInteractionId: string;
      readonly expectedStage: TrinketChoicePresentationStage;
      readonly expectedRevision: number;
    }
  | {
      readonly type: "select";
      readonly expectedInteractionId: string;
      readonly optionId: string;
    }
  | {
      readonly type: "toggleVisibility";
      readonly expectedInteractionId: string;
    }
  | {
      readonly type: "confirm";
      readonly expectedInteractionId: string;
      readonly selectedOptionId: string;
      readonly accepted: boolean;
      readonly paidCost: number;
      readonly goldBefore: number;
      readonly goldAfter: number;
    }
  | {
      readonly type: "skip";
      readonly expectedInteractionId: string;
    };

const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<Exclude<TrinketChoicePresentationStage, "choosing">, number>
> = {
  reveal: 720,
  confirmFocus: 650,
  effectHandoff: 420,
};

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<Exclude<TrinketChoicePresentationStage, "choosing">, number>
> = {
  reveal: 80,
  confirmFocus: 80,
  effectHandoff: 80,
};

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function freezePresentation(
  state: TrinketChoicePresentationState,
): TrinketChoicePresentationState {
  return Object.freeze({
    ...state,
    optionIds: Object.freeze([...state.optionIds]),
  });
}

/**
 * Starts the client-only ceremony for one persisted Trinket offer. Two options
 * are used by Mystery Cube replacements; regular lesser/greater offers use
 * four. The snapshot never enters GameState, so reloading cannot replay a
 * purchase or its effects.
 */
export function createTrinketChoicePresentation({
  interactionId,
  optionIds,
}: {
  readonly interactionId: string;
  readonly optionIds: readonly string[];
}): TrinketChoicePresentationState | null {
  if (
    !isValidId(interactionId) ||
    !Array.isArray(optionIds) ||
    (optionIds.length !== 2 && optionIds.length !== 4) ||
    !optionIds.every(isValidId) ||
    new Set(optionIds).size !== optionIds.length
  ) {
    return null;
  }

  return freezePresentation({
    interactionId,
    optionIds,
    selectedOptionId: null,
    hidden: false,
    paidCost: null,
    goldBefore: null,
    goldAfter: null,
    stage: "reveal",
    revision: 0,
  });
}

export function transitionTrinketChoicePresentation(
  state: TrinketChoicePresentationState | null,
  action: TrinketChoicePresentationAction,
): TrinketChoicePresentationState | null {
  if (!state || action.expectedInteractionId !== state.interactionId) {
    return state;
  }

  if (action.type === "skip") {
    if (state.stage === "reveal") {
      return freezePresentation({
        ...state,
        stage: "choosing",
        revision: state.revision + 1,
      });
    }
    return state.stage === "choosing" ? state : null;
  }

  if (action.type === "select") {
    if (
      state.stage !== "choosing" ||
      !state.optionIds.includes(action.optionId) ||
      state.selectedOptionId === action.optionId
    ) {
      return state;
    }
    return freezePresentation({
      ...state,
      selectedOptionId: action.optionId,
      revision: state.revision + 1,
    });
  }

  if (action.type === "toggleVisibility") {
    if (state.stage !== "choosing") return state;
    return freezePresentation({
      ...state,
      hidden: !state.hidden,
      revision: state.revision + 1,
    });
  }

  if (action.type === "confirm") {
    if (
      state.stage !== "choosing" ||
      !action.accepted ||
      action.selectedOptionId !== state.selectedOptionId ||
      !state.optionIds.includes(action.selectedOptionId) ||
      !isNonNegativeInteger(action.paidCost) ||
      !isNonNegativeInteger(action.goldBefore) ||
      !isNonNegativeInteger(action.goldAfter) ||
      action.paidCost > action.goldBefore
    ) {
      return state;
    }
    return freezePresentation({
      ...state,
      hidden: false,
      paidCost: action.paidCost,
      goldBefore: action.goldBefore,
      goldAfter: action.goldAfter,
      stage: "confirmFocus",
      revision: state.revision + 1,
    });
  }

  if (
    action.expectedStage !== state.stage ||
    action.expectedRevision !== state.revision ||
    state.stage === "choosing"
  ) {
    return state;
  }

  if (state.stage === "effectHandoff") return null;
  return freezePresentation({
    ...state,
    stage:
      state.stage === "reveal" ? "choosing" : "effectHandoff",
    revision: state.revision + 1,
  });
}

export function trinketChoicePresentationDuration(
  stage: TrinketChoicePresentationStage,
  reducedMotion = false,
): number | null {
  if (stage === "choosing") return null;
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}
