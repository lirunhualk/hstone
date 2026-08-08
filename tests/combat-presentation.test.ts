import assert from "node:assert/strict";
import test from "node:test";

import {
  COMBAT_START_INTRO_DURATION_MS,
  combatBuffLabel,
  combatDamageCapLabel,
  combatIntroOpponent,
  combatPlaybackKey,
  combatPlaybackRevealCountForEvent,
  combatPlaybackSessionSnapshot,
  combatTriggerLabel,
  createCombatPlaybackState,
  createCombatPlaybackTimeline,
  isCombatPlaybackEvent,
  projectCombatArmor,
  projectCombatHealth,
  resumeCombatPlayback,
  transitionCombatPlayback,
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
    playerAArmorBefore: 0,
    playerBArmorBefore: 0,
    playerAArmorAfter: 0,
    playerBArmorAfter: 0,
    initialBoards: {},
    finalBoards: {},
    events: [],
    ...overrides,
  };
}

test("combat playback omits framing events represented by the intro and result stages", () => {
  const events = [
    event("battleStart", 0),
    event("startOfCombat", 1),
    event("attack", 2),
    event("trigger", 3),
    event("damage", 4),
    event("heroDamage", 5),
    event("battleEnd", 6),
  ];

  assert.deepEqual(
    events.filter(isCombatPlaybackEvent).map(({ type }) => type),
    ["startOfCombat", "attack", "trigger", "damage", "heroDamage"],
  );
});

test("combat buff labels distinguish permanent changes from ordinary zero-stat keywords", () => {
  assert.equal(
    combatBuffLabel({
      ...event("buff", 0),
      attackDelta: 0,
      healthDelta: 0,
      message: "获得烈毒。",
    }),
    undefined,
  );
  assert.equal(
    combatBuffLabel({
      ...event("buff", 1),
      retained: true,
      message: "获得并永久保留圣盾。",
    }),
    "关键词永久保留",
  );
  assert.equal(
    combatBuffLabel({
      ...event("buff", 2),
      attackDelta: 0,
      healthDelta: 0,
      retained: true,
      message: "获得并永久保留烈毒。",
    }),
    "关键词永久保留",
  );
  assert.equal(
    combatBuffLabel({
      ...event("buff", 3),
      attackDelta: 0,
      healthDelta: 0,
      permanentEffectImprovement: true,
      message: "效果永久提升。",
    }),
    "效果永久提升",
  );
  assert.equal(
    combatBuffLabel({
      ...event("buff", 4),
      attackDelta: 2,
      healthDelta: 1,
      retained: true,
      retentionMultiplier: 2,
      message: "属性永久保留。",
    }),
    "+2/+1 · 永久×2",
  );
  assert.equal(
    combatTriggerLabel({
      ...event("trigger", 5),
      attackDelta: 5,
      healthDelta: 5,
      permanentEffectImprovement: true,
      message: "本局甲虫永久成长。",
    }),
    "本局永久 +5/+5",
  );
  assert.equal(
    combatTriggerLabel({
      ...event("trigger", 6),
      attackDelta: 5,
      healthDelta: 5,
      permanentEffectImprovement: false,
      message: "幽灵甲虫仅在本场战斗成长。",
    }),
    undefined,
  );
});

test("combat damage-cap labels only appear when the cap prevents damage", () => {
  assert.equal(
    combatDamageCapLabel({
      ...event("heroDamage", 0),
      amount: 5,
      uncappedAmount: 48,
      damageCap: 5,
      damagePreventedByCap: 43,
    }),
    "伤害上限 5 · 减免 43",
  );
  assert.equal(
    combatDamageCapLabel({
      ...event("heroDamage", 1),
      amount: 4,
      uncappedAmount: 4,
      damageCap: 5,
      damagePreventedByCap: 0,
    }),
    undefined,
  );
  assert.equal(combatDamageCapLabel(event("damage", 2)), undefined);
});

test("combat intro completion reveals the first real event or completes an empty battle", () => {
  const populated = createCombatPlaybackTimeline(
    battle({ events: [event("attack", 1), event("damage", 2)] }),
  );
  const empty = createCombatPlaybackTimeline(battle());

  assert.deepEqual(createCombatPlaybackState(populated), {
    battleKey: populated.battleKey,
    revealedCount: 1,
    furthestRevealedCount: 1,
    resultUnlocked: false,
    status: "playing",
    revision: 0,
  });
  assert.deepEqual(createCombatPlaybackState(empty), {
    battleKey: empty.battleKey,
    revealedCount: 0,
    furthestRevealedCount: 0,
    resultUnlocked: true,
    status: "complete",
    revision: 0,
  });
});

test("combat playback identity survives an equivalent battle object replacement", () => {
  const original = battle({
    events: Array.from({ length: 10 }, (_, index) =>
      event("trigger", index),
    ),
  });
  const restored = JSON.parse(JSON.stringify(original)) as BattleSummary;
  const key = combatPlaybackKey(original);
  const restoredTimeline = createCombatPlaybackTimeline(restored);

  assert.notEqual(restored, original);
  assert.equal(combatPlaybackKey(restored), key);
  assert.deepEqual(
    resumeCombatPlayback(restoredTimeline, {
      battleKey: key,
      revealedCount: 4,
      complete: false,
    }),
    {
      battleKey: key,
      revealedCount: 4,
      furthestRevealedCount: 4,
      resultUnlocked: false,
      status: "playing",
      revision: 0,
    },
  );
  assert.notEqual(
    combatPlaybackKey(battle({ round: original.round + 1 })),
    key,
  );
  assert.equal(
    resumeCombatPlayback(
      createCombatPlaybackTimeline(
        battle({ round: original.round + 1 }),
      ),
      {
        battleKey: key,
        revealedCount: 4,
        complete: false,
      },
    ),
    null,
  );
});

test("combat playback session data is validated and clamped before resume", () => {
  const summary = battle({
    events: [event("attack", 1), event("damage", 2), event("death", 3)],
  });
  const battleKey = combatPlaybackKey(summary);
  const timeline = createCombatPlaybackTimeline(summary);

  assert.deepEqual(
    resumeCombatPlayback(timeline, {
      battleKey,
      revealedCount: 99,
      complete: false,
    }),
    {
      battleKey,
      revealedCount: 3,
      furthestRevealedCount: 3,
      resultUnlocked: false,
      status: "playing",
      revision: 0,
    },
  );
  assert.deepEqual(
    resumeCombatPlayback(timeline, {
      battleKey,
      revealedCount: 3,
      complete: true,
    }),
    {
      battleKey,
      revealedCount: 3,
      furthestRevealedCount: 3,
      resultUnlocked: true,
      status: "complete",
      revision: 0,
    },
  );
  assert.deepEqual(
    resumeCombatPlayback(timeline, {
      battleKey,
      revealedCount: 2,
      furthestRevealedCount: 2,
      resultUnlocked: false,
      status: "paused",
    }),
    {
      battleKey,
      revealedCount: 2,
      furthestRevealedCount: 2,
      resultUnlocked: false,
      status: "paused",
      revision: 0,
    },
  );
  assert.equal(
    resumeCombatPlayback(timeline, {
      battleKey,
      revealedCount: -1,
      complete: false,
    }),
    null,
  );
  assert.equal(
    resumeCombatPlayback(timeline, {
      battleKey,
      revealedCount: 1,
      status: "stopped",
    }),
    null,
  );
});

test("combat playback timeline filters framing events and maps log rows", () => {
  const summary = battle({
    events: [
      event("battleStart", 0),
      event("attack", 2),
      event("shieldBroken", 4),
      event("death", 7),
      event("battleEnd", 9),
    ],
  });
  const timeline = createCombatPlaybackTimeline(summary);

  assert.deepEqual(
    timeline.events.map(({ type }) => type),
    ["attack", "shieldBroken", "death"],
  );
  assert.equal(
    combatPlaybackRevealCountForEvent(summary.events, 0),
    null,
  );
  assert.equal(
    combatPlaybackRevealCountForEvent(summary.events, 4),
    2,
  );
  assert.equal(
    combatPlaybackRevealCountForEvent(summary.events, 9),
    null,
  );
});

test("combat playback state machine pauses, steps, seeks, replays, and completes", () => {
  const timeline = createCombatPlaybackTimeline(
    battle({
      events: [event("attack", 1), event("damage", 2), event("death", 3)],
    }),
  );
  const initial = createCombatPlaybackState(timeline);
  const paused = transitionCombatPlayback(
    initial,
    { type: "pause" },
    timeline,
  );

  assert.deepEqual(paused, {
    battleKey: timeline.battleKey,
    revealedCount: 1,
    furthestRevealedCount: 1,
    resultUnlocked: false,
    status: "paused",
    revision: 1,
  });
  assert.equal(
    transitionCombatPlayback(
      paused,
      {
        type: "tick",
        expectedRevision: paused.revision,
        expectedRevealedCount: paused.revealedCount,
      },
      timeline,
    ),
    paused,
  );

  const atStart = transitionCombatPlayback(
    paused,
    { type: "step", direction: "backward" },
    timeline,
  );
  assert.equal(atStart.revealedCount, 0);
  assert.equal(atStart.status, "paused");

  const first = transitionCombatPlayback(
    atStart,
    { type: "step", direction: "forward" },
    timeline,
  );
  const lockedSeek = transitionCombatPlayback(
    first,
    { type: "seek", revealedCount: 99 },
    timeline,
  );
  assert.equal(first.revealedCount, 1);
  assert.equal(lockedSeek.revealedCount, 1);
  assert.equal(lockedSeek.furthestRevealedCount, 1);

  const second = transitionCombatPlayback(
    lockedSeek,
    { type: "step", direction: "forward" },
    timeline,
  );
  const last = transitionCombatPlayback(
    second,
    { type: "step", direction: "forward" },
    timeline,
  );
  assert.deepEqual(last, {
    battleKey: timeline.battleKey,
    revealedCount: 3,
    furthestRevealedCount: 3,
    resultUnlocked: false,
    status: "paused",
    revision: 6,
  });

  const complete = transitionCombatPlayback(
    last,
    { type: "step", direction: "forward" },
    timeline,
  );
  assert.equal(complete.status, "complete");
  assert.equal(complete.resultUnlocked, true);
  const lastAfterResult = transitionCombatPlayback(
    complete,
    { type: "step", direction: "backward" },
    timeline,
  );
  assert.deepEqual(
    {
      revealedCount: lastAfterResult.revealedCount,
      furthestRevealedCount: lastAfterResult.furthestRevealedCount,
      resultUnlocked: lastAfterResult.resultUnlocked,
      status: lastAfterResult.status,
    },
    {
      revealedCount: 3,
      furthestRevealedCount: 3,
      resultUnlocked: true,
      status: "paused",
    },
  );
  const replayed = transitionCombatPlayback(
    complete,
    { type: "replay" },
    timeline,
  );
  assert.equal(replayed.revealedCount, 1);
  assert.equal(replayed.furthestRevealedCount, 3);
  assert.equal(replayed.resultUnlocked, true);
  assert.equal(replayed.status, "playing");

  const skipped = transitionCombatPlayback(
    paused,
    { type: "skip" },
    timeline,
  );
  assert.equal(skipped.revealedCount, 3);
  assert.equal(skipped.furthestRevealedCount, 3);
  assert.equal(skipped.resultUnlocked, true);
  assert.equal(skipped.status, "complete");

  assert.deepEqual(combatPlaybackSessionSnapshot(replayed), {
    battleKey: timeline.battleKey,
    revealedCount: 1,
    furthestRevealedCount: 3,
    resultUnlocked: true,
    status: "playing",
  });
});

test("automatic playback holds the final event before revealing the result", () => {
  const timeline = createCombatPlaybackTimeline(
    battle({
      events: [event("attack", 1), event("damage", 2), event("death", 3)],
    }),
  );
  let state = createCombatPlaybackState(timeline);

  state = transitionCombatPlayback(
    state,
    {
      type: "tick",
      expectedRevision: state.revision,
      expectedRevealedCount: state.revealedCount,
    },
    timeline,
  );
  assert.deepEqual(
    { revealedCount: state.revealedCount, status: state.status },
    { revealedCount: 2, status: "playing" },
  );
  state = transitionCombatPlayback(
    state,
    {
      type: "tick",
      expectedRevision: state.revision,
      expectedRevealedCount: state.revealedCount,
    },
    timeline,
  );
  assert.deepEqual(
    { revealedCount: state.revealedCount, status: state.status },
    { revealedCount: 3, status: "playing" },
  );
  state = transitionCombatPlayback(
    state,
    {
      type: "tick",
      expectedRevision: state.revision,
      expectedRevealedCount: state.revealedCount,
    },
    timeline,
  );
  assert.equal(state.status, "complete");
  assert.equal(state.resultUnlocked, true);

  const replayed = transitionCombatPlayback(
    state,
    { type: "replay" },
    timeline,
  );
  const paused = transitionCombatPlayback(
    replayed,
    { type: "pause" },
    timeline,
  );
  const resumed = transitionCombatPlayback(
    paused,
    { type: "play" },
    timeline,
  );
  assert.equal(
    transitionCombatPlayback(
      resumed,
      {
        type: "tick",
        expectedRevision: replayed.revision,
        expectedRevealedCount: replayed.revealedCount,
      },
      timeline,
    ),
    resumed,
  );
});

test("empty and stale combat playback transitions are safe no-ops", () => {
  const emptyTimeline = createCombatPlaybackTimeline(battle());
  const empty = createCombatPlaybackState(emptyTimeline);
  for (const action of [
    { type: "play" },
    { type: "pause" },
    {
      type: "tick",
      expectedRevision: empty.revision,
      expectedRevealedCount: empty.revealedCount,
    },
    { type: "step", direction: "backward" },
    { type: "step", direction: "forward" },
    { type: "seek", revealedCount: 2 },
    { type: "replay" },
    { type: "skip" },
    { type: "reschedule" },
  ] as const) {
    assert.equal(
      transitionCombatPlayback(empty, action, emptyTimeline),
      empty,
    );
  }

  const otherTimeline = createCombatPlaybackTimeline(
    battle({ round: 5, events: [event("attack", 1)] }),
  );
  assert.equal(
    transitionCombatPlayback(
      empty,
      {
        type: "tick",
        expectedRevision: empty.revision,
        expectedRevealedCount: empty.revealedCount,
      },
      otherTimeline,
    ),
    empty,
  );
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

test("combat armor stays at the pre-combat value until hero damage is revealed", () => {
  const summary = battle({
    playerAArmorBefore: 6,
    playerBArmorBefore: 12,
    playerAArmorAfter: 6,
    playerBArmorAfter: 5,
  });
  const attack = event("attack", 1);
  const heroDamage: BattleEvent = {
    ...event("heroDamage", 2),
    targetPlayerId: "human",
    amount: 7,
  };

  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "human",
      revealedEvents: [],
      playbackComplete: false,
    }),
    12,
  );
  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "human",
      revealedEvents: [attack],
      playbackComplete: false,
    }),
    12,
  );
  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "human",
      revealedEvents: [attack, heroDamage],
      playbackComplete: false,
    }),
    5,
  );
  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "ai-1",
      revealedEvents: [attack, heroDamage],
      playbackComplete: false,
    }),
    6,
  );
});

test("combat armor uses each summary result when playback completes", () => {
  const summary = battle({
    playerAArmorBefore: 6,
    playerBArmorBefore: 12,
    playerAArmorAfter: -2,
    playerBArmorAfter: 5,
  });

  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "ai-1",
      revealedEvents: [],
      playbackComplete: true,
    }),
    0,
  );
  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "human",
      revealedEvents: [],
      playbackComplete: true,
    }),
    5,
  );
  assert.equal(
    projectCombatArmor({
      battle: summary,
      playerId: "not-in-this-battle",
      revealedEvents: [],
      playbackComplete: false,
    }),
    null,
  );
});
