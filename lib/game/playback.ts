import type {
  BattleEvent,
  BoardMinionInstance,
  MinionInstance,
  PlayerId,
} from "./types.ts";

function asBoardMinion(
  minion: MinionInstance,
): BoardMinionInstance | undefined {
  return minion.kind === "minion"
    ? { ...minion, kind: "minion" }
    : undefined;
}

/**
 * Projects structured combat snapshots onto the opening board without parsing
 * localized event messages. Deaths remain visible for their own event, then
 * structured summon positions and buff snapshots update later replay frames.
 */
export function projectCombatBoard(
  initialBoard: readonly BoardMinionInstance[],
  playerId: PlayerId,
  events: readonly BattleEvent[],
  options: { flushPendingDeaths?: boolean } = {},
): BoardMinionInstance[] {
  const projected = [...initialBoard];
  let pendingDeathInstanceId: string | undefined;
  for (const event of events) {
    if (pendingDeathInstanceId) {
      const deadIndex = projected.findIndex(
        (unit) => unit.instanceId === pendingDeathInstanceId,
      );
      if (deadIndex >= 0) {
        projected.splice(deadIndex, 1);
      }
      pendingDeathInstanceId = undefined;
    }

    if (
      event.type === "death" &&
      event.actorPlayerId === playerId &&
      event.actorInstanceId
    ) {
      pendingDeathInstanceId = event.actorInstanceId;
      continue;
    }

    if (
      event.type === "summon" &&
      event.targetPlayerId === playerId &&
      event.targetInstanceId &&
      event.boardIndex !== undefined &&
      event.minion
    ) {
      const summoned = asBoardMinion(event.minion);
      if (summoned) {
        const boardIndex = Math.min(
          Math.max(0, event.boardIndex),
          projected.length,
        );
        projected.splice(boardIndex, 0, summoned);
      }
      continue;
    }

    if (
      event.type === "buff" &&
      event.targetPlayerId === playerId &&
      event.targetInstanceId &&
      event.minion
    ) {
      const snapshot = asBoardMinion(event.minion);
      const targetIndex = projected.findIndex(
        (unit) => unit.instanceId === event.targetInstanceId,
      );
      if (snapshot && targetIndex >= 0) {
        projected[targetIndex] = snapshot;
      }
    }
  }
  if (options.flushPendingDeaths && pendingDeathInstanceId) {
    const deadIndex = projected.findIndex(
      (unit) => unit.instanceId === pendingDeathInstanceId,
    );
    if (deadIndex >= 0) {
      projected.splice(deadIndex, 1);
    }
  }
  return projected;
}
