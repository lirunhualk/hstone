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
  const maxGoldBonus = Math.max(0, player.maxGold - 10);
  return Math.min(player.maxGold, baseRecruitGoldForRound(state) + maxGoldBonus);
}
