import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  gameReducer,
  getScheduledOpponent,
  getScheduledPairings,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  getHumanScoutingReport,
  getPublicLastRoundResult,
  getVisibleWarband,
} from "../lib/game/opponent-intelligence.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player);
  return player;
}

function fixtureMinion(
  template: BoardMinionInstance,
  instanceId: string,
  name: string,
): BoardMinionInstance {
  return {
    ...structuredClone(template),
    instanceId,
    name,
    attack: 3,
    health: 3,
  };
}

function actualHumanOpponentId(state: GameState): string {
  assert.ok(state.lastBattle);
  return state.lastBattle.playerAId === state.humanPlayerId
    ? state.lastBattle.playerBId
    : state.lastBattle.playerAId;
}

function stopRecruiting(state: GameState): void {
  for (const player of state.players) {
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }
}

test("recruit actions cannot change the announced opponent", () => {
  for (let seed = 1; seed <= 64; seed += 1) {
    let state = createGame(0x7100 + seed);
    const rngBeforePreview = state.rngState;
    const announced = getScheduledOpponent(state, state.humanPlayerId);
    assert.ok(announced);
    assert.equal(state.rngState, rngBeforePreview);

    state = gameReducer(state, { type: "REFRESH_SHOP" });
    assert.deepEqual(
      getScheduledOpponent(state, state.humanPlayerId),
      announced,
    );

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(actualHumanOpponentId(combat), announced.opponentId);
    assert.equal(combat.lastBattle?.isGhost, announced.isGhost);
    assert.equal(
      getScheduledOpponent(combat, combat.humanPlayerId),
      null,
    );
  }
});

test("odd-player schedules use one legal ghost and include each survivor once", () => {
  for (let seed = 1; seed <= 32; seed += 1) {
    const state = createGame(0x7200 + seed);
    const ghost = state.players.at(-1);
    assert.ok(ghost);
    ghost.alive = false;
    ghost.health = 0;
    ghost.eliminatedRound = 1;

    const oldPairs = [
      [state.players[0], state.players[1]],
      [state.players[2], state.players[3]],
      [state.players[4], state.players[5]],
    ] as const;
    for (const [left, right] of oldPairs) {
      left.lastOpponentId = right.id;
      right.lastOpponentId = left.id;
    }
    state.players[6].lastOpponentId = ghost.id;

    const pairings = getScheduledPairings(state);
    const ghostPairings = pairings.filter((pairing) => pairing.isGhost);
    assert.equal(ghostPairings.length, 1);
    assert.equal(ghostPairings[0].playerBId, ghost.id);

    const survivorAppearances = new Map<string, number>();
    for (const pairing of pairings) {
      for (const playerId of [pairing.playerAId, pairing.playerBId]) {
        const player = playerById(state, playerId);
        if (!player.alive) continue;
        survivorAppearances.set(
          playerId,
          (survivorAppearances.get(playerId) ?? 0) + 1,
        );
      }
      const playerA = playerById(state, pairing.playerAId);
      const playerB = playerById(state, pairing.playerBId);
      assert.notEqual(playerA.lastOpponentId, playerB.id);
      assert.notEqual(playerB.lastOpponentId, playerA.id);
    }
    assert.deepEqual(
      [...survivorAppearances.entries()].sort(),
      state.players
        .filter((player) => player.alive)
        .map((player) => [player.id, 1] as const)
        .sort(),
    );
  }
});

test("human scouting retains only personally observed warbands", () => {
  const state = createGame(0x7300);
  const human = playerById(state, state.humanPlayerId);
  const template = human.shop[0];
  assert.ok(template);
  const firstOpponent = getScheduledOpponent(state, human.id);
  assert.ok(firstOpponent);
  const observedOpponent = playerById(state, firstOpponent.opponentId);

  human.board = [
    fixtureMinion(template, "human-board", "HUMAN_VISIBLE"),
  ];
  observedOpponent.board = [
    fixtureMinion(template, "observed-board", "OBSERVED_CANARY"),
  ];
  for (const player of state.players) {
    if (
      player.id !== human.id &&
      player.id !== observedOpponent.id &&
      player.alive
    ) {
      player.board = [
        fixtureMinion(
          template,
          `ai-secret-${player.id}`,
          `AI_SECRET_${player.id}`,
        ),
      ];
    }
  }
  stopRecruiting(state);

  const firstCombat = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(Object.keys(firstCombat.humanScoutingReports), [
    observedOpponent.id,
  ]);
  const firstReport = getHumanScoutingReport(
    firstCombat,
    observedOpponent.id,
  );
  assert.ok(firstReport);
  assert.equal(firstReport.board[0]?.name, "OBSERVED_CANARY");
  assert.equal(
    JSON.stringify(firstCombat.humanScoutingReports).includes(
      "AI_SECRET_",
    ),
    false,
  );

  const nextRecruit = gameReducer(firstCombat, { type: "CONTINUE" });
  const hiddenOpponent = playerById(nextRecruit, observedOpponent.id);
  hiddenOpponent.board = [
    fixtureMinion(
      template,
      "current-hidden-board",
      "SECRET_CURRENT_CANARY",
    ),
  ];
  hiddenOpponent.hand = [
    fixtureMinion(
      template,
      "current-hidden-hand",
      "SECRET_HAND_CANARY",
    ),
  ];
  hiddenOpponent.shop = [
    fixtureMinion(
      template,
      "current-hidden-shop",
      "SECRET_SHOP_CANARY",
    ),
  ];
  const visible = getVisibleWarband(nextRecruit, hiddenOpponent.id);
  assert.equal(visible.visibility, "observed");
  assert.equal(visible.board[0]?.name, "OBSERVED_CANARY");
  assert.equal(JSON.stringify(visible).includes("SECRET_"), false);

  const secondOpponent = getScheduledOpponent(
    nextRecruit,
    nextRecruit.humanPlayerId,
  );
  assert.ok(secondOpponent);
  assert.notEqual(secondOpponent.opponentId, observedOpponent.id);
  const secondOpponentPlayer = playerById(
    nextRecruit,
    secondOpponent.opponentId,
  );
  secondOpponentPlayer.board = [
    fixtureMinion(template, "second-observed", "SECOND_OBSERVED"),
  ];
  stopRecruiting(nextRecruit);
  const secondCombat = gameReducer(nextRecruit, { type: "END_TURN" });
  assert.equal(
    getHumanScoutingReport(secondCombat, observedOpponent.id)?.board[0]
      ?.name,
    "OBSERVED_CANARY",
  );
  assert.equal(
    getHumanScoutingReport(secondCombat, secondOpponent.opponentId)
      ?.board[0]?.name,
    "SECOND_OBSERVED",
  );
});

test("public round results expose outcome and damage but no warband data", () => {
  const combat = gameReducer(createGame(0x7400), {
    type: "END_TURN",
  });
  const battle = combat.lastRoundBattles[0];
  assert.ok(battle);
  const resultA = getPublicLastRoundResult(combat, battle.playerAId);
  const resultB = getPublicLastRoundResult(combat, battle.playerBId);
  assert.ok(resultA);
  assert.ok(resultB);
  assert.equal(resultA.damageDealt, battle.damageToPlayerB);
  assert.equal(resultA.damageTaken, battle.damageToPlayerA);
  assert.equal(resultB.damageDealt, battle.damageToPlayerA);
  assert.equal(resultB.damageTaken, battle.damageToPlayerB);
  if (resultA.result === "tie") {
    assert.equal(resultB.result, "tie");
  } else {
    assert.notEqual(resultA.result, resultB.result);
  }
  for (const result of [resultA, resultB]) {
    assert.deepEqual(
      Object.keys(result).sort(),
      [
        "damageDealt",
        "damageTaken",
        "isGhost",
        "opponentId",
        "opponentName",
        "result",
        "round",
      ],
    );
  }
});

test("v23 saves without scouting reports backfill the latest human battle", () => {
  const combat = gameReducer(createGame(0x7500), {
    type: "END_TURN",
  });
  const expectedOpponentId = actualHumanOpponentId(combat);
  const expectedBoard =
    combat.lastBattle?.initialBoards[expectedOpponentId] ?? [];

  for (const snapshot of [
    structuredClone(combat),
    gameReducer(combat, { type: "CONTINUE" }),
  ]) {
    const legacy = snapshot as GameState;
    delete (
      legacy as {
        humanScoutingReports?: GameState["humanScoutingReports"];
      }
    ).humanScoutingReports;
    const normalized = normalizePersistedGameState(
      JSON.parse(JSON.stringify(legacy)),
    ) as GameState | null;
    assert.ok(normalized);
    assert.deepEqual(
      normalized.humanScoutingReports[expectedOpponentId]?.board,
      expectedBoard,
    );
    assert.deepEqual(
      JSON.parse(JSON.stringify(normalized)),
      normalized,
    );
  }
});
