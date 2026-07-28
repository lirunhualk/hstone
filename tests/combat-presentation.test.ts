import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_START_INTRO_DURATION_MS,
  combatIntroOpponent,
  initialCombatPlayback,
  isCombatPlaybackEvent,
  projectCombatHealth,
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

test("combat health stays at the pre-combat value until hero damage is revealed", () => {
  const summary = battle({
    playerAHealthBefore: 31,
    playerBHealthBefore: 27,
    playerAHealthAfter: 31,
    playerBHealthAfter: 18,
  });
  const attack = event("attack", 1);
  const heroDamage: BattleEvent = {
    ...event("heroDamage", 2),
    targetPlayerId: "human",
    amount: 7,
  };

  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "human",
      revealedEvents: [],
      playbackComplete: false,
    }),
    27,
  );
  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "human",
      revealedEvents: [attack],
      playbackComplete: false,
    }),
    27,
  );
  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "human",
      revealedEvents: [attack, heroDamage],
      playbackComplete: false,
    }),
    18,
  );
  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "ai-1",
      revealedEvents: [attack, heroDamage],
      playbackComplete: false,
    }),
    31,
  );
});

test("combat health selects the correct side and ignores non-target events", () => {
  const summary = battle({
    playerAHealthBefore: 31,
    playerAHealthAfter: 24,
    playerBHealthBefore: 27,
    playerBHealthAfter: 19,
  });
  const fakeAttackDamage: BattleEvent = {
    ...event("attack", 1),
    targetPlayerId: "ai-1",
    amount: 7,
  };
  const enemyDamage: BattleEvent = {
    ...event("heroDamage", 2),
    targetPlayerId: "human",
    amount: 8,
  };
  const playerADamage: BattleEvent = {
    ...event("heroDamage", 3),
    targetPlayerId: "ai-1",
    amount: 2,
  };

  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "ai-1",
      revealedEvents: [fakeAttackDamage, enemyDamage],
      playbackComplete: false,
    }),
    31,
  );
  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "ai-1",
      revealedEvents: [
        fakeAttackDamage,
        enemyDamage,
        playerADamage,
      ],
      playbackComplete: false,
    }),
    24,
  );
});

test("combat health uses each summary result when playback completes", () => {
  const summary = battle({
    playerAHealthBefore: 31,
    playerAHealthAfter: -2,
    playerBHealthAfter: 13,
  });

  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "ai-1",
      revealedEvents: [],
      playbackComplete: true,
    }),
    0,
  );
  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "human",
      revealedEvents: [],
      playbackComplete: true,
    }),
    13,
  );
  assert.equal(
    projectCombatHealth({
      battle: summary,
      playerId: "not-in-this-battle",
      revealedEvents: [],
      playbackComplete: false,
    }),
    null,
  );
});

test("a matching hero damage event reveals the authoritative summary health", () => {
  const damageWithoutAmount: BattleEvent = {
    ...event("heroDamage", 1),
    targetPlayerId: "human",
  };

  assert.equal(
    projectCombatHealth({
      battle: battle({ playerBHealthAfter: 11 }),
      playerId: "human",
      revealedEvents: [damageWithoutAmount],
      playbackComplete: false,
    }),
    11,
  );
});
