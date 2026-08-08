import type { BattleEvent, BattleSummary, PlayerId } from "./types";

export const COMBAT_START_INTRO_DURATION_MS = 2_800;

export function combatPlaybackKey(
  battle: Pick<
    BattleSummary,
    "round" | "playerAId" | "playerBId" | "isGhost"
  >,
): string {
  return JSON.stringify([
    battle.round,
    battle.playerAId,
    battle.playerBId,
    battle.isGhost,
  ]);
}

export type CombatPlaybackStatus = "playing" | "paused" | "complete";

export interface CombatPlaybackTimeline {
  battleKey: string;
  events: readonly BattleEvent[];
}

export interface CombatPlaybackState {
  battleKey: string;
  revealedCount: number;
  furthestRevealedCount: number;
  resultUnlocked: boolean;
  status: CombatPlaybackStatus;
  revision: number;
}

export type CombatPlaybackSessionSnapshot = Omit<
  CombatPlaybackState,
  "revision"
>;

export type CombatPlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | {
      type: "tick";
      expectedRevision: number;
      expectedRevealedCount: number;
    }
  | { type: "step"; direction: "backward" | "forward" }
  | { type: "seek"; revealedCount: number }
  | { type: "replay" }
  | { type: "skip" }
  | { type: "reschedule" };

export interface CombatIntroOpponent {
  opponentName: string;
  opponentIsGhost: boolean;
}

function formatSignedCombatStat(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function combatBuffLabel(
  event: BattleEvent | undefined,
): string | undefined {
  if (event?.type !== "buff") {
    return undefined;
  }
  if (event.permanentEffectImprovement) {
    return "效果永久提升";
  }
  if (
    event.retained &&
    (event.attackDelta === undefined ||
      event.healthDelta === undefined ||
      (event.attackDelta === 0 && event.healthDelta === 0))
  ) {
    return "关键词永久保留";
  }
  if (
    event.attackDelta === undefined ||
    event.healthDelta === undefined ||
    (event.attackDelta === 0 && event.healthDelta === 0)
  ) {
    return undefined;
  }
  return `${formatSignedCombatStat(event.attackDelta)}/${formatSignedCombatStat(
    event.healthDelta,
  )}${
    event.retained
      ? ` · 永久${event.retentionMultiplier === 2 ? "×2" : ""}`
      : ""
  }`;
}

export function combatTriggerLabel(
  event: BattleEvent | undefined,
): string | undefined {
  if (
    event?.type !== "trigger" ||
    !event.permanentEffectImprovement
  ) {
    return undefined;
  }
  if (
    event.attackDelta === undefined ||
    event.healthDelta === undefined ||
    (event.attackDelta === 0 && event.healthDelta === 0)
  ) {
    return "效果永久提升";
  }
  return `本局永久 ${formatSignedCombatStat(
    event.attackDelta,
  )}/${formatSignedCombatStat(event.healthDelta)}`;
}

export function combatDamageCapLabel(
  event: BattleEvent | undefined,
): string | undefined {
  if (
    event?.type !== "heroDamage" ||
    event.damageCap === undefined ||
    (event.damagePreventedByCap ?? 0) <= 0
  ) {
    return undefined;
  }
  return `伤害上限 ${event.damageCap} · 减免 ${event.damagePreventedByCap}`;
}

export function isCombatPlaybackEvent(event: BattleEvent): boolean {
  return event.type !== "battleStart" && event.type !== "battleEnd";
}

function safeCombatPlaybackEventCount(eventCount: number): number {
  return Number.isFinite(eventCount)
    ? Math.max(0, Math.trunc(eventCount))
    : 0;
}

function clampCombatPlaybackCount(
  revealedCount: number,
  eventCount: number,
): number {
  return Math.min(
    eventCount,
    Math.max(0, Math.trunc(revealedCount)),
  );
}

export function createCombatPlaybackTimeline(
  battle: Pick<
    BattleSummary,
    "round" | "playerAId" | "playerBId" | "isGhost" | "events"
  >,
): CombatPlaybackTimeline {
  return {
    battleKey: combatPlaybackKey(battle),
    events: battle.events.filter(isCombatPlaybackEvent),
  };
}

export function createCombatPlaybackState(
  timeline: CombatPlaybackTimeline,
): CombatPlaybackState {
  const eventCount = safeCombatPlaybackEventCount(timeline.events.length);
  const revealedCount = eventCount > 0 ? 1 : 0;
  return {
    battleKey: timeline.battleKey,
    revealedCount,
    furthestRevealedCount: revealedCount,
    resultUnlocked: eventCount === 0,
    status: eventCount > 0 ? "playing" : "complete",
    revision: 0,
  };
}

export function transitionCombatPlayback(
  state: CombatPlaybackState,
  action: CombatPlaybackAction,
  timeline: CombatPlaybackTimeline,
): CombatPlaybackState {
  if (state.battleKey !== timeline.battleKey) {
    return state;
  }

  const eventCount = safeCombatPlaybackEventCount(timeline.events.length);
  if (eventCount === 0) {
    return state.revealedCount === 0 &&
      state.furthestRevealedCount === 0 &&
      state.resultUnlocked &&
      state.status === "complete"
      ? state
      : {
          battleKey: timeline.battleKey,
          revealedCount: 0,
          furthestRevealedCount: 0,
          resultUnlocked: true,
          status: "complete",
          revision: state.revision + 1,
        };
  }

  const revealedCount = clampCombatPlaybackCount(
    state.revealedCount,
    eventCount,
  );
  const furthestRevealedCount = clampCombatPlaybackCount(
    Math.max(state.furthestRevealedCount, revealedCount),
    eventCount,
  );
  const nextRevision = state.revision + 1;
  if (action.type === "replay") {
    const initial = createCombatPlaybackState(timeline);
    return {
      ...initial,
      furthestRevealedCount: Math.max(
        furthestRevealedCount,
        initial.furthestRevealedCount,
      ),
      resultUnlocked: state.resultUnlocked,
      revision: nextRevision,
    };
  }
  if (action.type === "skip") {
    if (
      state.status === "complete" &&
      revealedCount === eventCount &&
      furthestRevealedCount === eventCount &&
      state.resultUnlocked
    ) {
      return state;
    }
    return {
      battleKey: timeline.battleKey,
      revealedCount: eventCount,
      furthestRevealedCount: eventCount,
      resultUnlocked: true,
      status: "complete",
      revision: nextRevision,
    };
  }
  if (action.type === "reschedule") {
    if (state.status === "complete") return state;
    return {
      ...state,
      revealedCount,
      furthestRevealedCount,
      revision: nextRevision,
    };
  }
  if (action.type === "pause") {
    if (state.status === "complete" || state.status === "paused") {
      return state;
    }
    return {
      battleKey: timeline.battleKey,
      revealedCount,
      furthestRevealedCount,
      resultUnlocked: state.resultUnlocked,
      status: "paused",
      revision: nextRevision,
    };
  }
  if (action.type === "play") {
    if (state.status === "complete" || state.status === "playing") {
      return state;
    }
    return {
      battleKey: timeline.battleKey,
      revealedCount,
      furthestRevealedCount,
      resultUnlocked: state.resultUnlocked,
      status: "playing",
      revision: nextRevision,
    };
  }
  if (action.type === "tick") {
    if (
      state.status !== "playing" ||
      state.revision !== action.expectedRevision ||
      revealedCount !== action.expectedRevealedCount
    ) {
      return state;
    }
    if (revealedCount >= eventCount) {
      return {
        battleKey: timeline.battleKey,
        revealedCount: eventCount,
        furthestRevealedCount: eventCount,
        resultUnlocked: true,
        status: "complete",
        revision: state.revision,
      };
    }
    const nextRevealedCount = revealedCount + 1;
    return {
      battleKey: timeline.battleKey,
      revealedCount: nextRevealedCount,
      furthestRevealedCount: Math.max(
        furthestRevealedCount,
        nextRevealedCount,
      ),
      resultUnlocked: state.resultUnlocked,
      status: "playing",
      revision: state.revision,
    };
  }
  if (action.type === "step") {
    if (action.direction === "backward") {
      return {
        battleKey: timeline.battleKey,
        revealedCount:
          state.status === "complete"
            ? eventCount
            : Math.max(0, revealedCount - 1),
        furthestRevealedCount,
        resultUnlocked: state.resultUnlocked,
        status: "paused",
        revision: nextRevision,
      };
    }
    if (revealedCount >= eventCount) {
      return {
        battleKey: timeline.battleKey,
        revealedCount: eventCount,
        furthestRevealedCount: eventCount,
        resultUnlocked: true,
        status: "complete",
        revision: nextRevision,
      };
    }
    const nextRevealedCount = revealedCount + 1;
    return {
      battleKey: timeline.battleKey,
      revealedCount: nextRevealedCount,
      furthestRevealedCount: Math.max(
        furthestRevealedCount,
        nextRevealedCount,
      ),
      resultUnlocked: state.resultUnlocked,
      status: "paused",
      revision: nextRevision,
    };
  }

  if (!Number.isFinite(action.revealedCount)) {
    return state;
  }
  const seekLimit = state.resultUnlocked
    ? eventCount
    : furthestRevealedCount;
  return {
    battleKey: timeline.battleKey,
    revealedCount: clampCombatPlaybackCount(
      action.revealedCount,
      seekLimit,
    ),
    furthestRevealedCount,
    resultUnlocked: state.resultUnlocked,
    status: "paused",
    revision: nextRevision,
  };
}

export function combatPlaybackRevealCountForEvent(
  events: readonly BattleEvent[],
  eventIndex: number,
): number | null {
  let revealedCount = 0;
  for (const event of events) {
    if (!isCombatPlaybackEvent(event)) continue;
    revealedCount += 1;
    if (event.index === eventIndex) return revealedCount;
  }
  return null;
}

export function combatPlaybackSessionSnapshot(
  state: CombatPlaybackState,
): CombatPlaybackSessionSnapshot {
  return {
    battleKey: state.battleKey,
    revealedCount: state.revealedCount,
    furthestRevealedCount: state.furthestRevealedCount,
    resultUnlocked: state.resultUnlocked,
    status: state.status,
  };
}

export function resumeCombatPlayback(
  timeline: CombatPlaybackTimeline,
  snapshot: unknown,
): CombatPlaybackState | null {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  const candidate = snapshot as Partial<CombatPlaybackState> & {
    complete?: unknown;
  };
  const battleKey = timeline.battleKey;
  if (
    candidate.battleKey !== battleKey ||
    typeof candidate.revealedCount !== "number" ||
    !Number.isFinite(candidate.revealedCount) ||
    candidate.revealedCount < 0
  ) {
    return null;
  }

  const safeEventCount = safeCombatPlaybackEventCount(
    timeline.events.length,
  );
  let status: CombatPlaybackStatus;
  let revealedCount: number;
  let furthestRevealedCount: number;
  let resultUnlocked: boolean;
  if (candidate.status !== undefined) {
    if (
      candidate.status !== "playing" &&
      candidate.status !== "paused" &&
      candidate.status !== "complete"
    ) {
      return null;
    }
    status = candidate.status;
    if (
      typeof candidate.furthestRevealedCount !== "number" ||
      !Number.isFinite(candidate.furthestRevealedCount) ||
      candidate.furthestRevealedCount < 0 ||
      typeof candidate.resultUnlocked !== "boolean"
    ) {
      return null;
    }
    revealedCount = clampCombatPlaybackCount(
      candidate.revealedCount,
      safeEventCount,
    );
    furthestRevealedCount = clampCombatPlaybackCount(
      Math.max(candidate.furthestRevealedCount, revealedCount),
      safeEventCount,
    );
    resultUnlocked = candidate.resultUnlocked;
  } else if (typeof candidate.complete === "boolean") {
    status = candidate.complete ? "complete" : "playing";
    const initial = createCombatPlaybackState(timeline);
    revealedCount = Math.min(
      safeEventCount,
      Math.max(
        initial.revealedCount,
        Math.trunc(candidate.revealedCount),
      ),
    );
    resultUnlocked =
      candidate.complete && revealedCount >= safeEventCount;
    furthestRevealedCount = resultUnlocked
      ? safeEventCount
      : revealedCount;
  } else {
    return null;
  }

  if (safeEventCount === 0) {
    status = "complete";
    revealedCount = 0;
    furthestRevealedCount = 0;
    resultUnlocked = true;
  } else if (status === "complete" && revealedCount < safeEventCount) {
    status = resultUnlocked ? "paused" : "playing";
  }
  if (status === "complete") {
    resultUnlocked = true;
    furthestRevealedCount = safeEventCount;
  } else if (resultUnlocked) {
    furthestRevealedCount = safeEventCount;
  }
  return {
    battleKey,
    revealedCount,
    furthestRevealedCount,
    resultUnlocked,
    status,
    revision: 0,
  };
}

export function combatIntroOpponent(
  battle: BattleSummary,
  humanPlayerId: PlayerId,
): CombatIntroOpponent {
  const humanIsPlayerA = battle.playerAId === humanPlayerId;
  return {
    opponentName: humanIsPlayerA
      ? battle.playerBName
      : battle.playerAName,
    opponentIsGhost: battle.isGhost,
  };
}

export function projectCombatHealth({
  battle,
  playerId,
  revealedEvents,
  playbackComplete,
}: {
  battle: BattleSummary;
  playerId: PlayerId;
  revealedEvents: readonly BattleEvent[];
  playbackComplete: boolean;
}): number | null {
  const isPlayerA = battle.playerAId === playerId;
  const isPlayerB = battle.playerBId === playerId;
  if (!isPlayerA && !isPlayerB) return null;

  const healthBefore = isPlayerA
    ? battle.playerAHealthBefore
    : battle.playerBHealthBefore;
  const healthAfter = isPlayerA
    ? battle.playerAHealthAfter
    : battle.playerBHealthAfter;
  const damageRevealed = revealedEvents.some(
    (event) =>
      event.type === "heroDamage" &&
      event.targetPlayerId === playerId,
  );
  const projectedHealth =
    playbackComplete || damageRevealed ? healthAfter : healthBefore;

  return Number.isFinite(projectedHealth)
    ? Math.max(0, projectedHealth)
    : 0;
}

export function projectCombatArmor({
  battle,
  playerId,
  revealedEvents,
  playbackComplete,
}: {
  battle: BattleSummary;
  playerId: PlayerId;
  revealedEvents: readonly BattleEvent[];
  playbackComplete: boolean;
}): number | null {
  const isPlayerA = battle.playerAId === playerId;
  const isPlayerB = battle.playerBId === playerId;
  if (!isPlayerA && !isPlayerB) return null;

  const armorBefore = isPlayerA
    ? battle.playerAArmorBefore
    : battle.playerBArmorBefore;
  const armorAfter = isPlayerA
    ? battle.playerAArmorAfter
    : battle.playerBArmorAfter;
  const damageRevealed = revealedEvents.some(
    (event) =>
      event.type === "heroDamage" &&
      event.targetPlayerId === playerId,
  );
  const projectedArmor =
    playbackComplete || damageRevealed ? armorAfter : armorBefore;

  return Number.isFinite(projectedArmor)
    ? Math.max(0, projectedArmor)
    : 0;
}
