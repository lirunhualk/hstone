export type CombatEntryStage =
  | "versusReveal"
  | "warbandReveal"
  | "battleReady"
  | "complete";

export interface CombatEntryPresentationState {
  battleKey: string;
  stage: CombatEntryStage;
  revision: number;
}

export type CombatEntryPresentationAction =
  | {
      type: "advance";
      expectedBattleKey: string;
      expectedStage: CombatEntryStage;
      expectedRevision: number;
    }
  | {
      type: "skip";
      expectedBattleKey: string;
    };

const NEXT_STAGE: Readonly<
  Partial<Record<CombatEntryStage, CombatEntryStage>>
> = {
  versusReveal: "warbandReveal",
  warbandReveal: "battleReady",
  battleReady: "complete",
};

const NORMAL_STAGE_DURATIONS_MS: Readonly<
  Record<CombatEntryStage, number>
> = {
  versusReveal: 1_300,
  warbandReveal: 1_700,
  battleReady: 500,
  complete: 0,
};

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<CombatEntryStage, number>
> = {
  versusReveal: 80,
  warbandReveal: 120,
  battleReady: 80,
  complete: 0,
};

/**
 * Creates client-only presentation state for one combat entry. The engine has
 * already accepted and saved the battle; this state only gates its reveal.
 */
export function createCombatEntryPresentation(
  battleKey: string,
): CombatEntryPresentationState | null {
  if (battleKey.trim().length === 0) {
    return null;
  }
  return {
    battleKey,
    stage: "versusReveal",
    revision: 0,
  };
}

export function transitionCombatEntryPresentation(
  state: CombatEntryPresentationState | null,
  action: CombatEntryPresentationAction,
): CombatEntryPresentationState | null {
  if (!state || action.expectedBattleKey !== state.battleKey) {
    return state;
  }
  if (action.type === "skip") {
    if (state.stage === "complete") {
      return state;
    }
    return {
      ...state,
      stage: "complete",
      revision: state.revision + 1,
    };
  }
  if (
    action.expectedStage !== state.stage ||
    action.expectedRevision !== state.revision
  ) {
    return state;
  }

  const nextStage = NEXT_STAGE[state.stage];
  if (!nextStage) {
    return state;
  }
  return {
    ...state,
    stage: nextStage,
    revision: state.revision + 1,
  };
}

export function combatEntryStageDuration(
  stage: CombatEntryStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}
