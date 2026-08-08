import assert from "node:assert/strict";
import test from "node:test";

import {
  isPersistedSecretChoiceInteraction,
  persistedGalakrondDiscoverMatchesPlayer,
  persistedSecretChoiceMatchesPlayer,
} from "../lib/game/client-save.ts";
import { LIVE_MINION_DEFINITIONS } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import type { PendingDiscoverInteraction, Tribe } from "../lib/game/types.ts";

const ALL_TRIBES: Tribe[] = [
  "beast",
  "demon",
  "dragon",
  "elemental",
  "mech",
  "murloc",
  "naga",
  "pirate",
  "quilboar",
  "undead",
];

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

function galakrondDiscover(): GameState {
  let state = createGame(0x6a22);
  let player = humanPlayer(state);
  state.activeTribes = [...ALL_TRIBES];
  player.heroId = "hero-tb-02";
  player.heroPowerId = "hero-power-tb_baconshop_hp_011";
  player.heroPowerActiveThisTurn = false;
  player.gold = 10;
  const target = player.shop[0];
  assert.ok(target);
  assert.equal(target.tier, 1);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  const tierTwoDefinitions = LIVE_MINION_DEFINITIONS.filter(
    (definition) => definition.tier === 2,
  ).slice(0, 3);
  assert.equal(tierTwoDefinitions.length, 3);
  for (const definition of tierTwoDefinitions) {
    state.pool[definition.id] = 1;
  }
  state = gameReducer(state, {
    type: "ACTIVATE_HERO_POWER",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.gold, 9);
  assert.equal(state.pendingInteraction?.kind, "discover");
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

test("Galakrond shop replacement Discover survives a JSON save roundtrip", () => {
  const persistedState = JSON.parse(
    JSON.stringify(galakrondDiscover()),
  ) as GameState;
  const interaction = persistedState.pendingInteraction;
  assert.ok(interaction?.kind === "discover");
  assert.equal(interaction.destination.kind, "replaceShop");
  assert.equal(
    persistedGalakrondDiscoverMatchesPlayer(
      interaction,
      humanPlayer(persistedState),
      6,
    ),
    true,
  );
});

test("Galakrond save validation rejects the wrong source, filter, or target zone", () => {
  const state = galakrondDiscover();
  const interaction = state.pendingInteraction;
  assert.ok(interaction?.kind === "discover");

  const wrongSource = structuredClone(
    interaction,
  ) as PendingDiscoverInteraction;
  wrongSource.sourceDefinitionId = "not-galakrond";
  assert.equal(
    persistedGalakrondDiscoverMatchesPlayer(
      wrongSource,
      humanPlayer(state),
      6,
    ),
    false,
  );

  const wrongFilter = structuredClone(
    interaction,
  ) as PendingDiscoverInteraction;
  wrongFilter.filter.exactTier = 3;
  assert.equal(
    persistedGalakrondDiscoverMatchesPlayer(
      wrongFilter,
      humanPlayer(state),
      6,
    ),
    false,
  );

  const duplicateOptions = structuredClone(
    interaction,
  ) as PendingDiscoverInteraction;
  duplicateOptions.options[1] = structuredClone(duplicateOptions.options[0]);
  assert.equal(
    persistedGalakrondDiscoverMatchesPlayer(
      duplicateOptions,
      humanPlayer(state),
      6,
    ),
    false,
  );

  const wrongZoneState = structuredClone(state);
  humanPlayer(wrongZoneState).shop = [];
  assert.equal(
    persistedGalakrondDiscoverMatchesPlayer(
      interaction,
      humanPlayer(wrongZoneState),
      6,
    ),
    false,
  );
});
