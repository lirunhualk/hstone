import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTrinketDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  TIER_SEVEN_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { PendingDiscoverInteraction } from "../lib/game/types.ts";

const POCKET_FACTORY_SCENARIOS = [
  {
    trinketId: "lesser-trinket-bg32-magicitem-361",
    tier: 4,
  },
  {
    trinketId: "greater-trinket-bg32-magicitem-361t",
    tier: 5,
  },
] as const;

const TIER_SEVEN_IDS = [
  "BG23_017",
  "BG25_034",
  "BG26_149",
  "BG27_016",
  "BG27_017",
  "BG27_514",
  "BG31_999",
  "BG34_145",
  "BG34_319",
  "BG34_320",
  "BG34_322",
  "BG34_950",
] as const;
const TIER_SEVEN_ID_SET = new Set<string>(TIER_SEVEN_IDS);

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
  playerId: string,
  trinketId: string,
): GameState {
  const player = playerById(state, playerId);
  const definition = getTrinketDefinition(trinketId);
  player.gold = Math.max(player.gold, definition.cost);
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `acquire-${playerId}-${trinketId}`,
    playerId,
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

function pendingDiscover(
  state: GameState,
  remainingDiscoveries: number,
): PendingDiscoverInteraction {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.remainingDiscoveries, remainingDiscoveries);
  assert.ok(pending.options.length > 0);
  assert.ok(pending.options.length <= 3);
  return pending;
}

function resolveFirstDiscoverOption(state: GameState): {
  state: GameState;
  selected: BoardMinionInstance;
} {
  const pending = pendingDiscover(
    state,
    (state.pendingInteraction as PendingDiscoverInteraction)
      .remainingDiscoveries,
  );
  const selected = pending.options[0];
  assert.ok(selected);
  return {
    state: gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: selected.instanceId,
    }),
    selected,
  };
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("registers the complete fixed-build Tier 7 pool outside the Tavern", () => {
  assert.deepEqual(
    TIER_SEVEN_MINION_DEFINITIONS.map((definition) => definition.id),
    TIER_SEVEN_IDS,
  );
  const state = createGame(0x9930);
  for (const definition of TIER_SEVEN_MINION_DEFINITIONS) {
    assert.equal(definition.tier, 7);
    assert.equal(definition.collectible, false);
    assert.equal(state.pool[definition.id], 0);
  }
});

for (const [index, scenario] of POCKET_FACTORY_SCENARIOS.entries()) {
  test(`Pocket Factory Tier ${scenario.tier} Discover persists and copies the chosen typed minion`, () => {
    let state = createGame(0x3610 + index);
    humanPlayer(state).hand = [];
    state = acquireTrinket(
      state,
      state.humanPlayerId,
      scenario.trinketId,
    );

    const pending = pendingDiscover(state, 1);
    assert.deepEqual(pending.filter, {
      exactTier: scenario.tier,
      requiresMinionType: true,
    });
    assert.deepEqual(pending.selectionEffect, {
      kind: "rememberTrinketMinion",
      trinketDefinitionId: scenario.trinketId,
    });
    assert.ok(
      pending.options.every(
        (option) => option.tier === scenario.tier && option.tribes.length > 0,
      ),
    );

    const restored = normalizePersistedGameState(
      jsonClone(state),
    ) as GameState | null;
    assert.ok(restored);
    assert.deepEqual(
      restored.pendingInteraction,
      jsonClone(state.pendingInteraction),
    );

    const resolution = resolveFirstDiscoverOption(restored);
    state = resolution.state;
    const selectedDefinitionId = resolution.selected.definitionId;
    assert.equal(
      humanPlayer(state).trinketSelections[scenario.trinketId],
      selectedDefinitionId,
    );
    assert.equal(state.pendingInteraction, null);

    const persisted = normalizePersistedGameState(
      jsonClone(state),
    ) as GameState | null;
    assert.ok(persisted);
    assert.equal(
      humanPlayer(persisted).trinketSelections[scenario.trinketId],
      selectedDefinitionId,
    );

    state = continueThroughCombat(persisted);
    const copies = humanPlayer(state).hand.filter(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.definitionId === selectedDefinitionId,
    );
    assert.equal(copies.length, 2);
    assert.deepEqual(
      copies.map((copy) => copy.poolCopies).sort((left, right) => left - right),
      [0, 1],
    );
  });
}

test("AI resolves Pocket Factory synchronously and remembers its choice", () => {
  let state = createGame(0x361a);
  const ai = humanPlayer(state);
  ai.isHuman = false;
  ai.hand = [];
  state = acquireTrinket(
    state,
    state.humanPlayerId,
    "lesser-trinket-bg32-magicitem-361",
  );

  assert.equal(state.pendingInteraction, null);
  const nextAi = playerById(state, ai.id);
  const selectedDefinitionId =
    nextAi.trinketSelections["lesser-trinket-bg32-magicitem-361"];
  assert.ok(selectedDefinitionId);
  const selected = nextAi.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === selectedDefinitionId,
  );
  assert.ok(selected);
  assert.equal(selected.tier, 4);
  assert.ok(selected.tribes.length > 0);
});

test("Innkeeper's Hearth discovers two Tier 6 minions and sets both to 30/30", () => {
  let state = createGame(0x3620);
  humanPlayer(state).hand = [];
  state = acquireTrinket(
    state,
    state.humanPlayerId,
    "greater-trinket-bg32-magicitem-362t",
  );

  const firstPending = pendingDiscover(state, 2);
  assert.deepEqual(firstPending.filter, { exactTier: 6 });
  assert.deepEqual(firstPending.selectionEffect, {
    kind: "setStats",
    attack: 30,
    health: 30,
  });

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);

  const first = resolveFirstDiscoverOption(restored);
  state = first.state;
  let gained = humanPlayer(state).hand.find(
    (card) => card.instanceId === first.selected.instanceId,
  );
  assert.ok(gained?.kind === "minion");
  assert.equal(gained.attack, 30);
  assert.equal(gained.health, 30);

  pendingDiscover(state, 1);
  const second = resolveFirstDiscoverOption(state);
  state = second.state;
  gained = humanPlayer(state).hand.find(
    (card) => card.instanceId === second.selected.instanceId,
  );
  assert.ok(gained?.kind === "minion");
  assert.equal(gained.attack, 30);
  assert.equal(gained.health, 30);
  assert.equal(state.pendingInteraction, null);
});

test("Pagle's Fishing Rod grants an active-type Tier 7 minion now and each turn", () => {
  let state = createGame(0x9931);
  state.activeTribes = ["beast"];
  humanPlayer(state).hand = [];
  state = acquireTrinket(
    state,
    state.humanPlayerId,
    "greater-trinket-bg30-magicitem-993",
  );

  const first = humanPlayer(state).hand[0];
  assert.ok(first?.kind === "minion");
  assert.equal(first.tier, 7);
  assert.equal(first.poolCopies, 0);
  assert.ok(TIER_SEVEN_ID_SET.has(first.definitionId));
  assert.ok(
    first.tribes.length === 0 ||
      first.tribes.includes("all") ||
      first.tribes.includes("beast"),
  );

  state = continueThroughCombat(state);
  const tierSevenCards = humanPlayer(state).hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && getMinionDefinition(card.definitionId).tier === 7,
  );
  assert.equal(tierSevenCards.length, 2);
  assert.ok(tierSevenCards.every((card) => card.poolCopies === 0));
  assert.ok(
    tierSevenCards.every(
      (card) =>
        card.tribes.length === 0 ||
        card.tribes.includes("all") ||
        card.tribes.includes("beast"),
    ),
  );
});

test("current saves repair a missing Trinket selection map", () => {
  const state = jsonClone(createGame(0x361f)) as unknown as {
    players: Array<Record<string, unknown>>;
  };
  delete state.players[0].trinketSelections;
  const restored = normalizePersistedGameState(state) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(humanPlayer(restored).trinketSelections, {});
});
