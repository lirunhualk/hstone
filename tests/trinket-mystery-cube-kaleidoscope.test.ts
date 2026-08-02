import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTrinketDefinition,
  SYSTEM_EVENT_DEFINITIONS,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  createTrinketAliasDefinitionId,
  getTrinketAliasKind,
} from "../lib/game/lobby-systems.ts";
import {
  TIER_SEVEN_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type {
  PendingDiscoverInteraction,
  PendingTrinketChoiceInteraction,
} from "../lib/game/types.ts";

const MYSTERY_CUBE_ID = "lesser-trinket-bg30-magicitem-703";
const LESSER_KALEIDOSCOPE_ID =
  "lesser-trinket-bg35-magicitem-821";
const GREATER_KALEIDOSCOPE_ID =
  "greater-trinket-bg35-magicitem-821t";

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player;
}

function humanPlayer(state: GameState): PlayerState {
  return playerById(state, state.humanPlayerId);
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function acquireTrinket(
  state: GameState,
  trinketId: string,
): GameState {
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

function pendingTrinketChoice(
  state: GameState,
  count: number,
): PendingTrinketChoiceInteraction {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "trinketChoice");
  assert.equal(pending.optionIds.length, count);
  assert.equal(new Set(pending.optionIds).size, count);
  return pending;
}

function pendingDiscover(state: GameState): PendingDiscoverInteraction {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.options.length, 3);
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    3,
  );
  return pending;
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("Mystery Cube immediately offers two new Lesser Trinkets and replaces itself for free", () => {
  let state = createGame(0x7030);
  state.lobbySystemsEnabled = true;
  state.systemEventId = SYSTEM_EVENT_DEFINITIONS[0].id;
  humanPlayer(state).gold = 10;
  state = acquireTrinket(state, MYSTERY_CUBE_ID);

  assert.equal(humanPlayer(state).gold, 5);
  const pending = pendingTrinketChoice(state, 2);
  assert.equal(pending.trinketTier, "lesser");
  assert.equal(pending.replaceTrinketId, MYSTERY_CUBE_ID);
  assert.ok(
    pending.optionIds.every((optionId) => {
      const definition = getTrinketDefinition(optionId);
      return (
        definition.tier === "lesser" &&
        definition.cardId !== "BG30_MagicItem_703"
      );
    }),
  );

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(restored.pendingInteraction, jsonClone(pending));

  const selectedId = pending.optionIds[0];
  const selectedCardId = getTrinketDefinition(selectedId).cardId;
  state = gameReducer(restored, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selectedId,
  });

  const player = humanPlayer(state);
  assert.equal(player.gold, 5);
  assert.equal(player.trinketIds.length, 1);
  assert.equal(
    getTrinketAliasKind(player.trinketIds[0]),
    "mysteryCubeReplacement",
  );
  assert.equal(
    getTrinketDefinition(player.trinketIds[0]).cardId,
    selectedCardId,
  );
  assert.ok(!player.trinketIds.includes(MYSTERY_CUBE_ID));
  assert.deepEqual(player.pendingMysteryCubeReplacementIds, []);
});

test("Mystery Cube applies the current Trinket first, repeats each turn, and precedes the round-9 offer", () => {
  let state = createGame(0x7031);
  state.round = 8;
  state.lobbySystemsEnabled = true;
  state.systemEventId = SYSTEM_EVENT_DEFINITIONS[0].id;
  const player = humanPlayer(state);
  const originalAliasId = createTrinketAliasDefinitionId(
    "mysteryCubeReplacement",
    "lesser-trinket-oilcan",
  );
  player.trinketIds = [originalAliasId];
  player.trinketCounters = { [originalAliasId]: 0 };
  player.pendingMysteryCubeReplacementIds = [];

  state = continueThroughCombat(state);
  assert.equal(state.round, 9);
  assert.equal(humanPlayer(state).upgradeDiscount, 4);
  const cubeChoice = pendingTrinketChoice(state, 2);
  assert.equal(cubeChoice.trinketTier, "lesser");
  assert.equal(cubeChoice.replaceTrinketId, originalAliasId);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: cubeChoice.interactionId,
    optionInstanceId: cubeChoice.optionIds[0],
  });
  const newAliasId = humanPlayer(state).trinketIds[0];
  assert.notEqual(newAliasId, originalAliasId);
  assert.equal(getTrinketAliasKind(newAliasId), "mysteryCubeReplacement");

  const greaterChoice = pendingTrinketChoice(state, 4);
  assert.equal(greaterChoice.trinketTier, "greater");
  assert.equal(greaterChoice.replaceTrinketId, undefined);
  const passiveGreaterId = greaterChoice.optionIds.find(
    (optionId) => getTrinketDefinition(optionId).cardId === "BG35_MagicItem_820",
  );
  assert.ok(passiveGreaterId);
  humanPlayer(state).gold = 99;
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: greaterChoice.interactionId,
    optionInstanceId: passiveGreaterId,
  });
  assert.equal(state.pendingInteraction, null);

  state = continueThroughCombat(state);
  assert.equal(state.round, 10);
  const nextCubeChoice = pendingTrinketChoice(state, 2);
  assert.equal(nextCubeChoice.replaceTrinketId, newAliasId);
});

test("AI resolves Mystery Cube replacement synchronously", () => {
  let state = createGame(0x7032);
  const player = humanPlayer(state);
  player.isHuman = false;
  player.gold = 10;

  state = acquireTrinket(state, MYSTERY_CUBE_ID);

  const nextPlayer = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(nextPlayer.gold, 5);
  assert.equal(nextPlayer.trinketIds.length, 1);
  assert.equal(
    getTrinketAliasKind(nextPlayer.trinketIds[0]),
    "mysteryCubeReplacement",
  );
  assert.notEqual(
    getTrinketDefinition(nextPlayer.trinketIds[0]).cardId,
    "BG30_MagicItem_703",
  );
  assert.deepEqual(nextPlayer.pendingMysteryCubeReplacementIds, []);
});

test("Lesser Kaleidoscope Discovers a generated Tier 7 minion locked for two rounds", () => {
  let state = createGame(0x8210);
  state.round = 6;
  humanPlayer(state).gold = 10;
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, LESSER_KALEIDOSCOPE_ID);

  const pending = pendingDiscover(state);
  assert.deepEqual(pending.filter, { exactTier: 7 });
  assert.equal(pending.selectionEffect, undefined);
  assert.deepEqual(pending.destination, {
    kind: "hand",
    playableFromRound: 8,
    allowOverflow: true,
  });
  assert.ok(
    pending.options.every(
      (option) =>
        option.tier === 7 && !option.golden && option.poolCopies === 0,
    ),
  );

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(restored.pendingInteraction, jsonClone(pending));

  const selected = pending.options[0];
  state = gameReducer(restored, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  const gained = humanPlayer(state).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.instanceId === selected.instanceId,
  );
  assert.ok(gained);
  assert.equal(gained.playableFromRound, 8);
  assert.equal(gained.poolCopies, 0);

  const lockedAtRoundSix = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: gained.instanceId,
  });
  assert.equal(lockedAtRoundSix, state);
  state.round = 7;
  const lockedAtRoundSeven = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: gained.instanceId,
  });
  assert.equal(lockedAtRoundSeven, state);

  state.round = 8;
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: gained.instanceId,
  });
  assert.ok(
    humanPlayer(state).board.some(
      (minion) => minion.instanceId === gained.instanceId,
    ),
  );
});

test("Greater Kaleidoscope makes its generated Tier 7 choice golden and preserves it through save", () => {
  let state = createGame(0x8211);
  state.round = 9;
  humanPlayer(state).gold = 10;
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, GREATER_KALEIDOSCOPE_ID);

  const pending = pendingDiscover(state);
  assert.deepEqual(pending.filter, { exactTier: 7 });
  assert.deepEqual(pending.selectionEffect, { kind: "makeGolden" });
  assert.deepEqual(pending.destination, {
    kind: "hand",
    playableFromRound: 11,
    allowOverflow: true,
  });

  const selected = pending.options[0];
  const definition = getMinionDefinition(selected.definitionId);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  const gained = humanPlayer(state).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.instanceId === selected.instanceId,
  );
  assert.ok(gained);
  assert.equal(gained.golden, true);
  assert.equal(gained.attack, definition.attack * 2);
  assert.equal(gained.health, definition.health * 2);
  assert.equal(gained.tier, 7);
  assert.equal(gained.poolCopies, 0);
  assert.equal(gained.grantsTripleReward, false);
  assert.equal(gained.playableFromRound, 11);
  assert.ok(
    TIER_SEVEN_MINION_DEFINITIONS.every(
      (tierSevenDefinition) => state.pool[tierSevenDefinition.id] === 0,
    ),
  );

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);
  const restoredCard = humanPlayer(restored).hand.find(
    (card) => card.instanceId === gained.instanceId,
  );
  assert.ok(restoredCard?.kind === "minion");
  assert.equal(restoredCard.golden, true);
  assert.equal(restoredCard.playableFromRound, 11);
});

test("current saves repair a missing Mystery Cube replacement queue", () => {
  const state = jsonClone(createGame(0x703f)) as unknown as {
    players: Array<Record<string, unknown>>;
  };
  delete state.players[0].pendingMysteryCubeReplacementIds;

  const restored = normalizePersistedGameState(state) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(
    humanPlayer(restored).pendingMysteryCubeReplacementIds,
    [],
  );
});
