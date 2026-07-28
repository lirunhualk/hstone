import type { BattleEvent, BattleSummary, PlayerId } from "./types";

export const COMBAT_START_INTRO_DURATION_MS = 2_800;

export interface CombatIntroOpponent {
  opponentName: string;
  opponentIsGhost: boolean;
}

export function isCombatPlaybackEvent(event: BattleEvent): boolean {
  return event.type !== "battleStart" && event.type !== "battleEnd";
}

export function initialCombatPlayback(eventCount: number): {
  revealedCount: number;
  complete: boolean;
} {
  const safeEventCount = Math.max(0, Math.trunc(eventCount));
  return {
    revealedCount: safeEventCount > 0 ? 1 : 0,
    complete: safeEventCount === 0,
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
