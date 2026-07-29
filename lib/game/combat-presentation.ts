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
