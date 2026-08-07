import assert from "node:assert/strict";
import test from "node:test";

import {
  isPersistedSecretChoiceInteraction,
  persistedSecretChoiceMatchesPlayer,
} from "../lib/game/client-save.ts";
import {
  createGame,
  gameReducer,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function akazamzarakSecretChoice(): GameState {
  let state = createGame(0xc11e17);
  const player = humanPlayer(state);
  player.heroId = "hero-tb-21";
  player.heroPowerId = "hero-power-tb_baconshop_hp_020";
  player.gold = 0;

  state = gameReducer(state, { type: "ACTIVATE_HERO_POWER" });
  assert.equal(state.pendingInteraction?.kind, "secretChoice");
  return state;
}

test("Secret choice survives a JSON save roundtrip", () => {
  const state = akazamzarakSecretChoice();
  const persistedState = JSON.parse(JSON.stringify(state)) as GameState;
  const persisted: unknown = persistedState.pendingInteraction;

  assert.ok(isPersistedSecretChoiceInteraction(persisted));
  assert.equal(
    persistedSecretChoiceMatchesPlayer(
      persisted,
      humanPlayer(persistedState),
    ),
    true,
  );
});

test("Secret choice rejects a mismatched player", () => {
  const state = akazamzarakSecretChoice();
  const persisted: unknown = JSON.parse(
    JSON.stringify(state.pendingInteraction),
  );
  assert.ok(isPersistedSecretChoiceInteraction(persisted));

  assert.equal(
    persistedSecretChoiceMatchesPlayer(persisted, state.players[1]!),
    false,
  );
});

test("Secret choice rejects an invalid option", () => {
  const state = akazamzarakSecretChoice();
  const persisted = JSON.parse(JSON.stringify(state.pendingInteraction)) as {
    optionIds: string[];
  };
  persisted.optionIds[0] = "not-a-hero-secret";

  assert.equal(isPersistedSecretChoiceInteraction(persisted), false);
});
