import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { ACTIVE_TRINKET_DEFINITIONS } from "../lib/game/lobby-systems.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

test("every active Solo Trinket can be selected through the shared choice path", () => {
  for (const [index, definition] of ACTIVE_TRINKET_DEFINITIONS.entries()) {
    const state = createGame(0x36_00_03 + index, 999);
    const player = humanPlayer(state);
    player.gold = 999;
    player.maxGold = 999;
    state.pendingInteraction = {
      kind: "trinketChoice",
      interactionId: `smoke-${definition.id}`,
      playerId: player.id,
      sourceInstanceId: `smoke-source-${definition.id}`,
      trinketTier: definition.tier,
      optionIds: [definition.id],
    };

    const next = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: state.pendingInteraction.interactionId,
      optionInstanceId: definition.id,
    });

    assert.ok(
      humanPlayer(next).trinketIds.includes(definition.id),
      `${definition.cardId} must be acquirable`,
    );
  }
});
