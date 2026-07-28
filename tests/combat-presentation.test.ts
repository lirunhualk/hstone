import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_START_INTRO_DURATION_MS,
  combatIntroOpponent,
  initialCombatPlayback,
  isCombatPlaybackEvent,
} from "../lib/game/combat-presentation.ts";
import type {
  BattleEvent,
  BattleSummary,
} from "../lib/game/types.ts";

function event(
  type: BattleEvent["type"],
  index: number,
): BattleEvent {
  return { type, index, message: type };
}

function battle(overrides: Partial<BattleSummary> = {}): BattleSummary {
  return {
    round: 4,
    playerAId: "ai-1",
    playerBId: "human",
    playerAName: "酒馆老手",
    playerBName: "你",
    isGhost: false,
    winnerId: null,
    damageToPlayerA: 0,
    damageToPlayerB: 0,
    playerAHealthBefore: 31,
    playerBHealthBefore: 27,
    playerAHealthAfter: 31,
    playerBHealthAfter: 27,
    initialBoards: {},
    finalBoards: {},
    events: [],
    ...overrides,
  };
}

test("combat playback omits framing events represented by the intro and result stages", () => {
  const events = [
    event("battleStart", 0),
    event("attack", 1),
    event("heroDamage", 2),
    event("battleEnd", 3),
  ];

  assert.deepEqual(
    events.filter(isCombatPlaybackEvent).map(({ type }) => type),
    ["attack", "heroDamage"],
  );
});

test("combat intro completion reveals the first real event or completes an empty battle", () => {
  assert.deepEqual(initialCombatPlayback(3), {
    revealedCount: 1,
    complete: false,
  });
  assert.deepEqual(initialCombatPlayback(0), {
    revealedCount: 0,
    complete: true,
  });
});

test("combat intro duration and opponent label match the current transition contract", () => {
  assert.ok(COMBAT_START_INTRO_DURATION_MS >= 2_400);
  assert.ok(COMBAT_START_INTRO_DURATION_MS <= 3_000);
  assert.deepEqual(combatIntroOpponent(battle(), "human"), {
    opponentName: "酒馆老手",
    opponentIsGhost: false,
  });

  assert.deepEqual(
    combatIntroOpponent(
      battle({
        playerAId: "human",
        playerBId: "ghost-ai",
        playerAName: "你",
        playerBName: "海盗船长",
        isGhost: true,
        playerAHealthBefore: 38,
        playerBHealthBefore: 0,
      }),
      "human",
    ),
    {
      opponentName: "海盗船长",
      opponentIsGhost: true,
    },
  );
});
