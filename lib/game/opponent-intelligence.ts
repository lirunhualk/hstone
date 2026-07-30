import type {
  BattleResult,
  BoardMinionInstance,
  GameState,
  HumanScoutingReport,
  PlayerId,
} from "./types.ts";

export interface PublicRoundResult {
  round: number;
  result: BattleResult;
  opponentId: PlayerId;
  opponentName: string;
  damageDealt: number;
  damageTaken: number;
  isGhost: boolean;
}

export type VisibleWarband =
  | {
      visibility: "own";
      board: readonly BoardMinionInstance[];
      observedRound: number;
    }
  | {
      visibility: "observed";
      board: readonly BoardMinionInstance[];
      observedRound: number;
    }
  | {
      visibility: "unknown";
      board: readonly [];
      observedRound: null;
    };

export function getPublicLastRoundResult(
  state: GameState,
  playerId: PlayerId,
): PublicRoundResult | null {
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === playerId ||
      candidate.playerBId === playerId,
  );
  if (!battle) {
    return null;
  }
  const isPlayerA = battle.playerAId === playerId;
  return {
    round: battle.round,
    result:
      battle.winnerId === null
        ? "tie"
        : battle.winnerId === playerId
          ? "win"
          : "loss",
    opponentId: isPlayerA ? battle.playerBId : battle.playerAId,
    opponentName: isPlayerA ? battle.playerBName : battle.playerAName,
    damageDealt: isPlayerA
      ? battle.damageToPlayerB
      : battle.damageToPlayerA,
    damageTaken: isPlayerA
      ? battle.damageToPlayerA
      : battle.damageToPlayerB,
    isGhost: battle.isGhost,
  };
}

export function getHumanScoutingReport(
  state: GameState,
  opponentId: PlayerId,
): HumanScoutingReport | null {
  if (opponentId === state.humanPlayerId) {
    return null;
  }
  const report = state.humanScoutingReports[opponentId];
  return report?.opponentId === opponentId ? report : null;
}

/**
 * This is the sole UI boundary for opponent warbands. In particular, the AI
 * player's live `board` field is deliberately never read here.
 */
export function getVisibleWarband(
  state: GameState,
  playerId: PlayerId,
): VisibleWarband {
  if (playerId === state.humanPlayerId) {
    const human = state.players.find(
      (player) => player.id === state.humanPlayerId,
    );
    return {
      visibility: "own",
      board: human?.board ?? [],
      observedRound: state.round,
    };
  }
  const report = getHumanScoutingReport(state, playerId);
  if (!report) {
    return {
      visibility: "unknown",
      board: [],
      observedRound: null,
    };
  }
  return {
    visibility: "observed",
    board: report.board,
    observedRound: report.observedRound,
  };
}
