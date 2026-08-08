export type HeroChoicePresentationStage = "focus" | "lobbyReveal";

export interface HeroChoicePresentationState {
  interactionId: string;
  optionIds: readonly [string, string, string, string];
  selectedHeroId: string;
  stage: HeroChoicePresentationStage;
  revision: number;
}

export type HeroChoicePresentationAction =
  | {
      type: "advance";
      expectedInteractionId: string;
      expectedStage: HeroChoicePresentationStage;
      expectedRevision: number;
    }
  | {
      type: "skip";
      expectedInteractionId: string;
    };

const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<HeroChoicePresentationStage, number>
> = {
  focus: 800,
  lobbyReveal: 1_500,
};

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<HeroChoicePresentationStage, number>
> = {
  focus: 80,
  lobbyReveal: 80,
};

/**
 * Captures one accepted Hero Choice as short-lived client presentation state.
 * This snapshot deliberately stays outside GameState and saved games.
 */
export function createHeroChoicePresentation({
  interactionId,
  optionIds,
  selectedHeroId,
}: {
  interactionId: string;
  optionIds: readonly string[];
  selectedHeroId: string;
}): HeroChoicePresentationState | null {
  if (
    interactionId.length === 0 ||
    selectedHeroId.length === 0 ||
    optionIds.length !== 4 ||
    optionIds.some((optionId) => optionId.length === 0) ||
    new Set(optionIds).size !== 4 ||
    !optionIds.includes(selectedHeroId)
  ) {
    return null;
  }

  return {
    interactionId,
    optionIds: [optionIds[0], optionIds[1], optionIds[2], optionIds[3]],
    selectedHeroId,
    stage: "focus",
    revision: 0,
  };
}

export function transitionHeroChoicePresentation(
  state: HeroChoicePresentationState | null,
  action: HeroChoicePresentationAction,
): HeroChoicePresentationState | null {
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
  if (state.stage === "lobbyReveal") {
    return null;
  }
  return {
    ...state,
    stage: "lobbyReveal",
    revision: state.revision + 1,
  };
}

export function heroChoicePresentationDuration(
  stage: HeroChoicePresentationStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}
