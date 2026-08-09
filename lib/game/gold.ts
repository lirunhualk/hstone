import type { GameState, PlayerState } from "./types.ts";
import { getSystemEventDefinition } from "./lobby-systems.ts";

export function baseRecruitGoldForRound(state: GameState): number {
  if (
    state.lobbySystemsEnabled &&
    state.systemEventId &&
    getSystemEventDefinition(state.systemEventId).effect === "refundTrick"
  ) {
    return state.round;
  }
  return state.round + 2;
}

export function recruitGoldCapacity(
  state: GameState,
  player: PlayerState,
): number {
  return Math.min(player.maxGold, baseRecruitGoldForRound(state));
}
