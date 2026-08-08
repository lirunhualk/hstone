import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceHeadlessGame,
  createHeadlessLobbyGame,
  createLobbyGame,
  gameReducer,
  getHeroDefinition,
  getTrinketDefinition,
  type GameState,
  type PlayerState,
  type TrinketTier,
} from "../lib/game/engine.ts";

function replayAnchor(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the replay anchor must exist");
  return player;
}

function trinketCount(
  player: PlayerState,
  tier: TrinketTier,
): number {
  return player.trinketIds.filter(
    (definitionId) => getTrinketDefinition(definitionId).tier === tier,
  ).length;
}

function tierSixHandCount(player: PlayerState): number {
  return player.hand.filter(
    (card) => card.kind === "minion" && card.tier === 6,
  ).length;
}

function prepareRecruitStart(
  state: GameState,
  completedRound: number,
): GameState {
  state.phase = "combat";
  state.round = completedRound;
  state.pendingInteraction = null;
  state.systemEventId = null;
  state.lobbySystemsEnabled = true;
  state.lastBattle = null;
  state.lastRoundBattles = [];
  state.deferredTriplePlayerIds = [];
  state.winnerId = null;
  for (const player of state.players) {
    player.alive = true;
    player.health = 999;
    player.armor = 0;
    delete player.eliminatedRound;
    delete player.placement;
    player.heroPowerId = null;
    player.heroPowerCounters = {};
    player.systemEventCounters = {};
    player.trinketIds = [];
    player.trinketCounters = {};
    player.trinketSelections = {};
    player.pendingMysteryCubeReplacementIds = [];
    player.pendingSystemSpellIds = [];
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.frozen = false;
    player.gold = 10;
    player.maxGold = 10;
    player.pendingNextTurnGold = 0;
  }
  return state;
}

function unresolvedLobbyHeroOffer(state: GameState) {
  const offer = state.pendingInteraction;
  assert.ok(offer?.kind === "heroChoice");
  const selectedHeroId = offer.optionIds[0];
  assert.ok(selectedHeroId, "the lobby must offer a Hero");
  return { offer, selectedHeroId };
}

function resolveForcedHeadlessLobbyEvent(
  eventId: string,
  seed: number,
): GameState {
  const state = createLobbyGame(seed, 999);
  const { offer, selectedHeroId } = unresolvedLobbyHeroOffer(state);
  state.systemEventId = eventId;
  for (const player of state.players) {
    player.isHuman = false;
  }
  const resolved = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: offer.interactionId,
    optionInstanceId: selectedHeroId,
  });
  assert.notEqual(resolved, state);
  return resolved;
}

test("production headless lobby resolves its Hero offer deterministically", () => {
  const seed = 24_680;
  const interactive = createLobbyGame(seed, 999);
  const { selectedHeroId } = unresolvedLobbyHeroOffer(interactive);

  const first = createHeadlessLobbyGame(seed, 999);
  const second = createHeadlessLobbyGame(seed, 999);

  assert.deepEqual(first, second);
  assert.equal(first.lobbySystemsEnabled, true);
  assert.equal(first.systemEventId, interactive.systemEventId);
  assert.deepEqual(first.activeTribes, interactive.activeTribes);
  assert.equal(first.pendingInteraction, null);
  assert.equal(
    first.players.every((player) => !player.isHuman),
    true,
  );
  assert.equal(replayAnchor(first).heroId, selectedHeroId);
  assert.ok(replayAnchor(first).heroPowerId);
  assert.equal(
    first.players.every(
      (player) => player.heroId !== null && player.heroPowerId !== null,
    ),
    true,
  );
  assert.equal(
    new Set(first.players.map((player) => player.heroId)).size,
    first.players.length,
  );

  const snapshot = JSON.stringify(first);
  const afterRecruit = advanceHeadlessGame(first);
  assert.equal(JSON.stringify(first), snapshot);
  assert.equal(afterRecruit.phase, "combat");
  assert.equal(afterRecruit.pendingInteraction, null);
  assert.equal(afterRecruit.lastBattle, null);
});

test("headless lobby-start followups never pause the replay anchor", () => {
  const dualSeed = 0xd00;
  const dualLobby = createLobbyGame(dualSeed, 999);
  const dualOffer = unresolvedLobbyHeroOffer(dualLobby);
  const basePowerId = getHeroDefinition(
    dualOffer.selectedHeroId,
  ).heroPowerId;
  const dual = resolveForcedHeadlessLobbyEvent(
    "system-event-dual-universe",
    dualSeed,
  );
  assert.equal(dual.pendingInteraction, null);
  assert.equal(replayAnchor(dual).heroId, dualOffer.selectedHeroId);
  assert.ok(replayAnchor(dual).heroPowerId);
  assert.notEqual(replayAnchor(dual).heroPowerId, basePowerId);

  const callSeed = 0xca11;
  const callLobby = createLobbyGame(callSeed, 999);
  const tierSixBefore = new Map(
    callLobby.players.map((player) => [
      player.id,
      tierSixHandCount(player),
    ]),
  );
  const callOffer = unresolvedLobbyHeroOffer(callLobby);
  callLobby.systemEventId = "system-event-heros-call";
  for (const player of callLobby.players) {
    player.isHuman = false;
  }
  const called = gameReducer(callLobby, {
    type: "RESOLVE_INTERACTION",
    interactionId: callOffer.offer.interactionId,
    optionInstanceId: callOffer.selectedHeroId,
  });
  assert.equal(called.pendingInteraction, null);
  for (const player of called.players) {
    assert.equal(
      tierSixHandCount(player),
      (tierSixBefore.get(player.id) ?? 0) + 1,
      player.id,
    );
  }
});

test("headless Hero Trinket offers on rounds 5 and 8 resolve exactly once", () => {
  const marin = prepareRecruitStart(
    createHeadlessLobbyGame(50_005, 999),
    4,
  );
  const marinAnchor = replayAnchor(marin);
  marinAnchor.heroPowerId = "hero-power-bg30_hero_304p";
  marinAnchor.heroPowerCounters = { marinRound: 1 };
  const afterMarin = advanceHeadlessGame(marin);
  assert.equal(afterMarin.round, 5);
  assert.equal(afterMarin.pendingInteraction, null);
  assert.equal(trinketCount(replayAnchor(afterMarin), "lesser"), 1);
  assert.equal(
    afterMarin.players
      .filter((player) => player.id !== afterMarin.humanPlayerId)
      .every((player) => player.trinketIds.length === 0),
    true,
  );

  const button = prepareRecruitStart(
    createHeadlessLobbyGame(80_008, 999),
    7,
  );
  const buttonAnchor = replayAnchor(button);
  buttonAnchor.heroPowerId = "hero-power-bg32_hero_002p";
  buttonAnchor.heroPowerCounters = { buttonRound: 1 };
  const afterButton = advanceHeadlessGame(button);
  assert.equal(afterButton.round, 8);
  assert.equal(afterButton.pendingInteraction, null);
  assert.equal(trinketCount(replayAnchor(afterButton), "greater"), 1);
  assert.equal(
    afterButton.players
      .filter((player) => player.id !== afterButton.humanPlayerId)
      .every((player) => player.trinketIds.length === 0),
    true,
  );
});

test("headless global Trinket offers on rounds 6 and 9 include the anchor once", () => {
  const lesser = prepareRecruitStart(
    createHeadlessLobbyGame(60_006, 999),
    5,
  );
  const afterLesser = advanceHeadlessGame(lesser);
  assert.equal(afterLesser.round, 6);
  assert.equal(afterLesser.pendingInteraction, null);
  assert.equal(
    afterLesser.players.every(
      (player) => trinketCount(player, "lesser") === 1,
    ),
    true,
  );

  const greater = prepareRecruitStart(
    createHeadlessLobbyGame(90_009, 999),
    8,
  );
  const afterGreater = advanceHeadlessGame(greater);
  assert.equal(afterGreater.round, 9);
  assert.equal(afterGreater.pendingInteraction, null);
  assert.equal(
    afterGreater.players.every(
      (player) => trinketCount(player, "greater") === 1,
    ),
    true,
  );
});

test("an eliminated replay anchor cannot pause the round 6 offer", () => {
  const state = prepareRecruitStart(
    createHeadlessLobbyGame(60_106, 999),
    5,
  );
  const anchor = replayAnchor(state);
  anchor.alive = false;
  anchor.health = 0;
  anchor.eliminatedRound = 5;
  anchor.placement = 8;

  const next = advanceHeadlessGame(state);

  assert.equal(next.round, 6);
  assert.equal(next.pendingInteraction, null);
  assert.equal(trinketCount(replayAnchor(next), "lesser"), 0);
  assert.equal(
    next.players
      .filter((player) => player.alive)
      .every((player) => trinketCount(player, "lesser") === 1),
    true,
  );
});

test("interactive lobbies retain the human round 6 Trinket picker", () => {
  let state = createLobbyGame(61_006, 999);
  const { offer, selectedHeroId } = unresolvedLobbyHeroOffer(state);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: offer.interactionId,
    optionInstanceId: selectedHeroId,
  });
  prepareRecruitStart(state, 5);

  const next = gameReducer(state, { type: "CONTINUE" });

  assert.equal(next.round, 6);
  assert.equal(next.pendingInteraction?.kind, "trinketChoice");
  assert.equal(trinketCount(replayAnchor(next), "lesser"), 0);
  assert.equal(
    next.players
      .filter((player) => !player.isHuman)
      .every((player) => trinketCount(player, "lesser") === 1),
    true,
  );
});

test("headless advancement rejects human or pending input states", () => {
  const human = createLobbyGame(70_001, 999);
  assert.throws(
    () => advanceHeadlessGame(human),
    /headless games cannot contain a human player/,
  );

  const pending = createLobbyGame(70_002, 999);
  for (const player of pending.players) {
    player.isHuman = false;
  }
  const snapshot = JSON.stringify(pending);
  assert.throws(
    () => advanceHeadlessGame(pending),
    /headless games cannot pause for an interaction/,
  );
  assert.equal(JSON.stringify(pending), snapshot);
});
