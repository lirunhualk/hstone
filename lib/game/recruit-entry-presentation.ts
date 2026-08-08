import type { GameState, PlayerState } from "./types";

export type RecruitEntryStage =
  | "curtain"
  | "roundBanner"
  | "shopReveal"
  | "goldRefill"
  | "complete";

export interface RecruitEntryPresentationState {
  transitionKey: string;
  stage: RecruitEntryStage;
  revision: number;
  round: number;
  tavernTier: number;
  previousGold: number;
  /** Displayed Gold slots for the combat turn, not the player's hard cap. */
  previousMaxGold: number;
  gold: number;
  /** Displayed Gold slots for the new Recruit turn, not the player's hard cap. */
  maxGold: number;
  freshOfferInstanceIds: readonly string[];
  retainedOfferInstanceIds: readonly string[];
  rewardHandInstanceIds: readonly string[];
}

export type RecruitEntryPresentationAction =
  | {
      type: "advance";
      expectedKey: string;
      expectedStage: RecruitEntryStage;
      expectedRevision: number;
    }
  | { type: "skip"; expectedKey?: string }
  | { type: "cancel" };

const NEXT_STAGE: Readonly<
  Partial<Record<RecruitEntryStage, RecruitEntryStage>>
> = {
  curtain: "roundBanner",
  roundBanner: "shopReveal",
  shopReveal: "goldRefill",
  goldRefill: "complete",
};

const NORMAL_STAGE_DURATIONS_MS: Readonly<Record<RecruitEntryStage, number>> = {
  curtain: 220,
  roundBanner: 1_350,
  shopReveal: 560,
  goldRefill: 1_000,
  complete: 0,
};

const REDUCED_MOTION_STAGE_DURATIONS_MS: Readonly<
  Record<RecruitEntryStage, number>
> = {
  curtain: 50,
  roundBanner: 90,
  shopReveal: 70,
  goldRefill: 90,
  complete: 0,
};

function humanPlayer(state: GameState): PlayerState | null {
  return (
    state.players.find((player) => player.id === state.humanPlayerId) ?? null
  );
}

function uniqueInstanceIds(instanceIds: readonly string[]): string[] {
  return [...new Set(instanceIds)];
}

function shopOfferInstanceIds(player: PlayerState): string[] {
  return uniqueInstanceIds([
    ...player.shop.map((offer) => offer.instanceId),
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((offer) => offer.instanceId),
  ]);
}

function displayedGoldSlots(state: GameState, player: PlayerState): number {
  const turnAllowance = Math.min(player.maxGold, state.round + 2);
  return Math.max(player.gold, turnAllowance);
}

/**
 * Captures the transient client-only sequence for one accepted CONTINUE action.
 * No part of this state belongs in a saved GameState.
 */
export function createRecruitEntryPresentation({
  before,
  after,
  accepted,
  token,
  rewardHandInstanceIds = [],
}: {
  before: GameState;
  after: GameState;
  accepted: boolean;
  token: number;
  rewardHandInstanceIds?: readonly string[];
}): RecruitEntryPresentationState | null {
  if (
    !accepted ||
    before.phase !== "combat" ||
    after.phase !== "recruit" ||
    after.round !== before.round + 1 ||
    before.humanPlayerId !== after.humanPlayerId
  ) {
    return null;
  }

  const previousHuman = humanPlayer(before);
  const human = humanPlayer(after);
  if (!previousHuman || !human) {
    return null;
  }

  const previousOfferIds = new Set(shopOfferInstanceIds(previousHuman));
  const currentOfferIds = shopOfferInstanceIds(human);
  const currentHandIds = new Set(human.hand.map((card) => card.instanceId));

  return {
    transitionKey: `${after.humanPlayerId}:${after.round}:${token}`,
    stage: "curtain",
    revision: 0,
    round: after.round,
    tavernTier: human.tavernTier,
    previousGold: previousHuman.gold,
    previousMaxGold: displayedGoldSlots(before, previousHuman),
    gold: human.gold,
    maxGold: displayedGoldSlots(after, human),
    freshOfferInstanceIds: currentOfferIds.filter(
      (instanceId) => !previousOfferIds.has(instanceId),
    ),
    retainedOfferInstanceIds: currentOfferIds.filter((instanceId) =>
      previousOfferIds.has(instanceId),
    ),
    rewardHandInstanceIds: uniqueInstanceIds(rewardHandInstanceIds).filter(
      (instanceId) => currentHandIds.has(instanceId),
    ),
  };
}

export function transitionRecruitEntryPresentation(
  state: RecruitEntryPresentationState | null,
  action: RecruitEntryPresentationAction,
): RecruitEntryPresentationState | null {
  if (action.type === "cancel") {
    return null;
  }
  if (!state) {
    return null;
  }
  if (action.type === "skip") {
    if (
      (action.expectedKey !== undefined &&
        action.expectedKey !== state.transitionKey) ||
      state.stage === "complete"
    ) {
      return state;
    }
    return {
      ...state,
      stage: "complete",
      revision: state.revision + 1,
    };
  }
  if (
    action.expectedKey !== state.transitionKey ||
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

export function recruitEntryStageDuration(
  stage: RecruitEntryStage,
  reducedMotion = false,
): number {
  return (reducedMotion
    ? REDUCED_MOTION_STAGE_DURATIONS_MS
    : NORMAL_STAGE_DURATIONS_MS)[stage];
}

export function recruitEntryAnnouncement(
  state: RecruitEntryPresentationState,
): string {
  switch (state.stage) {
    case "curtain":
      return "战斗结束，正在返回酒馆";
    case "roundBanner":
      return `第 ${state.round} 回合，招募阶段`;
    case "shopReveal":
      return "酒馆报价已刷新";
    case "goldRefill":
      return `金币已补充至 ${state.gold}/${state.maxGold}`;
    case "complete":
      return "招募阶段开始";
  }
}
