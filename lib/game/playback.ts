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
 * localized event messages. Deaths remain visible for their own event. A dead
 * source is temporarily restored for each later trigger frame, including
 * simultaneous deaths and repeated Deathrattles, before summon positions and
 * effect snapshots update later replay frames.
 */
export function projectCombatBoard(
  initialBoard: readonly BoardMinionInstance[],
  playerId: PlayerId,
  events: readonly BattleEvent[],
  options: { flushPendingDeaths?: boolean } = {},
): BoardMinionInstance[] {
  const projected = [...initialBoard];
  const recentlyDead = new Map<
    string,
    { boardIndex: number; minion?: BoardMinionInstance }
  >();
  let transientDeathInstanceId: string | undefined;
  for (const event of events) {
    if (transientDeathInstanceId) {
      const deadIndex = projected.findIndex(
        (unit) => unit.instanceId === transientDeathInstanceId,
      );
      if (deadIndex >= 0) {
        projected.splice(deadIndex, 1);
      }
      transientDeathInstanceId = undefined;
    }

    if (
      event.type === "death" &&
      event.actorPlayerId === playerId &&
      event.actorInstanceId
    ) {
      const snapshot = event.minion
        ? asBoardMinion(event.minion)
        : undefined;
      const dyingIndex = projected.findIndex(
        (unit) => unit.instanceId === event.actorInstanceId,
      );
      if (snapshot && dyingIndex >= 0) {
        projected[dyingIndex] = snapshot;
      }
      recentlyDead.set(event.actorInstanceId, {
        boardIndex: Math.max(0, dyingIndex),
        minion: snapshot,
      });
      transientDeathInstanceId = event.actorInstanceId;
      continue;
    }

    if (
      event.type === "trigger" &&
      event.actorPlayerId === playerId &&
      event.actorInstanceId &&
      !projected.some(
        (unit) => unit.instanceId === event.actorInstanceId,
      )
    ) {
      const deadSource = recentlyDead.get(event.actorInstanceId);
      const triggerSnapshot =
        deadSource?.minion ??
        (event.actorMinion
          ? asBoardMinion(event.actorMinion)
          : undefined);
      if (deadSource && triggerSnapshot) {
        projected.splice(
          Math.min(
            Math.max(0, deadSource.boardIndex),
            projected.length,
          ),
          0,
          triggerSnapshot,
        );
        transientDeathInstanceId = event.actorInstanceId;
      }
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
      (event.type === "damage" ||
        event.type === "shieldBroken" ||
        event.type === "buff" ||
        event.type === "keywordRemoved") &&
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

    if (
      event.type === "damage" &&
      event.actorPlayerId === playerId &&
      event.actorInstanceId &&
      event.actorMinion
    ) {
      const actorSnapshot = asBoardMinion(event.actorMinion);
      const actorIndex = projected.findIndex(
        (unit) => unit.instanceId === event.actorInstanceId,
      );
      if (actorSnapshot && actorIndex >= 0) {
        projected[actorIndex] = actorSnapshot;
      }
    }
  }
  if (options.flushPendingDeaths && transientDeathInstanceId) {
    const deadIndex = projected.findIndex(
      (unit) => unit.instanceId === transientDeathInstanceId,
    );
    if (deadIndex >= 0) {
      projected.splice(deadIndex, 1);
    }
  }
  return projected;
}
