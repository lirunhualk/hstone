import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";

import * as clientSave from "../lib/game/client-save.ts";
import * as content from "../lib/game/content.ts";
import * as darkmoonPrizes from "../lib/game/darkmoon-prizes.ts";
import * as engine from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V51,
  normalizePersistedGameState,
} from "../lib/game/save.ts";
import * as setup from "../lib/game/setup.ts";
import type { GameState, Tribe } from "../lib/game/types.ts";

// Run the actual browser save gate without mounting React or changing storage.
// Include its local helpers and constants so the rest of save validation stays
// active: a normalized object alone is not sufficient to restore in the client.
function loadClientSaveValidator(): (value: unknown) => value is GameState {
  const source = ts.createSourceFile(
    "GameClient.tsx",
    readFileSync(new URL("../app/GameClient.tsx", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const validator = source.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "isGameState",
  );
  assert.ok(validator, "the browser save gate must exist");
  const declarations = source.statements
    .filter(
      (statement) =>
        statement.end <= validator.end &&
        (ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement)),
    )
    .map((statement) => statement.getText(source))
    .join("\n");
  const compiled = ts.transpileModule(declarations, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  });
  return new Script(`${compiled.outputText}\nisGameState;`).runInNewContext({
    ...engine,
    ...content,
    ...clientSave,
    ...darkmoonPrizes,
    ...setup,
  }) as (value: unknown) => value is GameState;
}

const isClientGameState = loadClientSaveValidator();

function lobbyForEvent(eventId: string): GameState {
  for (let seed = 1; seed <= 256; seed += 1) {
    const state = engine.createLobbyGame(seed);
    if (state.systemEventId === eventId) return state;
  }
  throw new Error(`No deterministic lobby found for ${eventId}`);
}

function restoredSave(state: GameState): unknown {
  return normalizePersistedGameState(JSON.parse(JSON.stringify(state)));
}

test("Tavern Special's ten tribes survive client reload before hero selection", () => {
  const state = lobbyForEvent("system-event-tavern-special");
  assert.equal(state.activeTribes.length, 10);
  assert.equal(state.pendingInteraction?.kind, "heroChoice");
  const restored = restoredSave(state);

  assert.ok(isClientGameState(restored));
  assert.deepEqual(restored.activeTribes, state.activeTribes);
  assert.deepEqual(restored.pendingInteraction, state.pendingInteraction);
});

test("Tavern Special reload retains the selected hero and recruit state", () => {
  const lobby = lobbyForEvent("system-event-tavern-special");
  const pending = lobby.pendingInteraction;
  assert.ok(pending?.kind === "heroChoice");
  const state = engine.gameReducer(lobby, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.optionIds[0],
  });
  const restored = restoredSave(state);

  assert.ok(isClientGameState(restored));
  assert.equal(restored.pendingInteraction, null);
  assert.equal(restored.phase, state.phase);
  assert.equal(restored.round, state.round);
  assert.equal(restored.rngState, state.rngState);
  assert.deepEqual(restored.activeTribes, state.activeTribes);
  assert.deepEqual(restored.pool, state.pool);
  assert.deepEqual(restored.spellPool, state.spellPool);
  const playerSnapshots = (game: GameState) =>
    game.players.map((player) => ({
      id: player.id,
      heroId: player.heroId,
      heroPowerId: player.heroPowerId,
      gold: player.gold,
      tavernTier: player.tavernTier,
      shopIds: player.shop.map((card) => card.instanceId),
    }));
  assert.deepEqual(playerSnapshots(restored), playerSnapshots(state));
});

test("v51 Tavern Special saves migrate and pass the client reload gate", () => {
  const state = lobbyForEvent("system-event-tavern-special");
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V51;
  const restored = restoredSave(state);

  assert.ok(isClientGameState(restored));
  assert.equal(restored.contentVersion, content.CURRENT_ROSTER_VERSION);
  assert.equal(restored.systemEventId, state.systemEventId);
  assert.deepEqual(restored.activeTribes, state.activeTribes);
});

test("ordinary and neutral five-tribe saves still pass client reload", () => {
  for (const state of [
    engine.createGame(0x5a7e),
    lobbyForEvent("system-event-golden-arrow"),
  ]) {
    assert.equal(state.activeTribes.length, 5);
    assert.ok(isClientGameState(restoredSave(state)));
  }
});

test("Tavern Special validates the complete set without requiring tribe order", () => {
  const state = lobbyForEvent("system-event-tavern-special");
  state.activeTribes.reverse();
  assert.ok(isClientGameState(restoredSave(state)));
});

test("client reload rejects tribe counts that do not match the active event", () => {
  const state = lobbyForEvent("system-event-tavern-special");
  const allTribes = [...state.activeTribes];
  state.activeTribes = allTribes.slice(0, 5);
  assert.equal(isClientGameState(restoredSave(state)), false);

  for (const ordinary of [
    engine.createGame(0x5a7e),
    lobbyForEvent("system-event-golden-arrow"),
  ]) {
    ordinary.activeTribes = [...allTribes];
    assert.equal(isClientGameState(restoredSave(ordinary)), false);
  }
});

test("client reload rejects duplicate tribes in both five- and ten-tribe saves", () => {
  for (const state of [
    engine.createGame(0x5a7e),
    lobbyForEvent("system-event-tavern-special"),
  ]) {
    state.activeTribes[1] = state.activeTribes[0]!;
    assert.equal(isClientGameState(restoredSave(state)), false);
  }
});

test("client reload rejects neutral, all, and unknown active tribe entries", () => {
  for (const tribe of ["neutral", "all", "not-a-tribe"] as Tribe[]) {
    for (const state of [
      engine.createGame(0x5a7e),
      lobbyForEvent("system-event-tavern-special"),
    ]) {
      state.activeTribes[0] = tribe;
      assert.equal(isClientGameState(restoredSave(state)), false, tribe);
    }
  }
});

test("client reload rejects incomplete or oversized tribe sets", () => {
  for (const length of [0, 4, 6, 9, 11]) {
    const state = lobbyForEvent("system-event-tavern-special");
    state.activeTribes = Array.from(
      { length },
      (_, index) => state.activeTribes[index % 10]!,
    );
    assert.equal(isClientGameState(restoredSave(state)), false);
  }
});
