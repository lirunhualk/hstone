import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTrinketDefinition,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { PendingTavernSpellDiscoverInteraction } from "../lib/game/types.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function acquireBook(state: GameState, trinketId: string): GameState {
  const player = humanPlayer(state);
  const definition = getTrinketDefinition(trinketId);
  player.gold = Math.max(player.gold, definition.cost);
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `acquire-${trinketId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${trinketId}`,
    trinketTier: definition.tier,
    optionIds: [trinketId],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: trinketId,
  });
}

function pendingSpellDiscover(
  state: GameState,
  expectedDiscoveries: number,
): PendingTavernSpellDiscoverInteraction {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "tavernSpellDiscover");
  assert.equal(pending.remainingDiscoveries, expectedDiscoveries);
  assert.ok(pending.options.length > 0);
  assert.ok(pending.options.length <= 3);
  assert.equal(
    new Set(pending.options.map((option) => option.instanceId)).size,
    pending.options.length,
  );
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    pending.options.length,
  );
  assert.ok(
    pending.options.every((option) => option.tier <= pending.maximumTier),
  );
  return pending;
}

function resolveSpellDiscoveries(
  state: GameState,
  count: number,
): GameState {
  for (let remaining = count; remaining > 0; remaining -= 1) {
    const pending = pendingSpellDiscover(state, remaining);
    const selected = pending.options[0];
    assert.ok(selected);
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: selected.instanceId,
    });
    assert.ok(
      humanPlayer(state).hand.some(
        (card) => card.instanceId === selected.instanceId,
      ),
    );
  }
  assert.equal(state.pendingInteraction, null);
  return state;
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("Lesser Book of Medivh persists its Tavern Spell Discover", () => {
  let state = createGame(0x4201);
  humanPlayer(state).tavernTier = 3;
  const spellPoolBefore = jsonClone(state.spellPool);

  state = acquireBook(
    state,
    "lesser-trinket-bg30-magicitem-420",
  );
  const pending = pendingSpellDiscover(state, 1);
  assert.equal(pending.maximumTier, 3);
  assert.equal(
    pending.sourceDefinitionId,
    "lesser-trinket-bg30-magicitem-420",
  );
  assert.deepEqual(state.spellPool, spellPoolBefore);

  const invalid = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "not-an-offered-spell",
  });
  assert.equal(invalid, state);

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(restored.pendingInteraction, state.pendingInteraction);

  const option = pending.options[0];
  assert.ok(option);
  const resolved = gameReducer(restored, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: option.instanceId,
  });
  assert.equal(resolved.pendingInteraction, null);
  assert.ok(
    humanPlayer(resolved).hand.some(
      (card) => card.instanceId === option.instanceId,
    ),
  );
  assert.deepEqual(resolved.spellPool, spellPoolBefore);
});

for (const scenario of [
  {
    label: "Lesser",
    trinketId: "lesser-trinket-bg30-magicitem-420",
    discoveries: 1,
  },
  {
    label: "Greater",
    trinketId: "greater-trinket-bg30-magicitem-420t",
    discoveries: 2,
  },
] as const) {
  test(`${scenario.label} Book of Medivh discovers immediately and each turn`, () => {
    let state = createGame(0x4202 + scenario.discoveries);
    humanPlayer(state).tavernTier = 4;

    state = acquireBook(state, scenario.trinketId);
    const handBefore = humanPlayer(state).hand.length;
    state = resolveSpellDiscoveries(state, scenario.discoveries);
    assert.equal(
      humanPlayer(state).hand.length,
      handBefore + scenario.discoveries,
    );

    const handBeforeNextTurn = humanPlayer(state).hand.length;
    state = continueThroughCombat(state);
    pendingSpellDiscover(state, scenario.discoveries);
    state = resolveSpellDiscoveries(state, scenario.discoveries);
    assert.equal(
      humanPlayer(state).hand.length,
      handBeforeNextTurn + scenario.discoveries,
    );
    assert.equal(
      humanPlayer(state).trinketCounters[scenario.trinketId],
      0,
    );
  });
}
