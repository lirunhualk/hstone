import assert from "node:assert/strict";
import test from "node:test";

import { getAiStrategyProfile } from "../lib/game/ai.ts";
import {
  advanceHeadlessGame,
  advanceHeadlessGameWithAiRecruitSafetyModes,
  createHeadlessGame,
  createLobbyGame,
  type AiRecruitSafetyMode,
  type AiRecruitSafetyPlayerDiagnostics,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player, `expected ${playerId}`);
  return player;
}

function clonedMinion(
  template: BoardMinionInstance,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return {
    ...template,
    instanceId,
    poolCopies: 0,
    golden: false,
    ...overrides,
  };
}

function safetyModes(
  state: GameState,
  mode: AiRecruitSafetyMode,
): Record<string, AiRecruitSafetyMode> {
  return Object.fromEntries(
    state.players.map((player) => [player.id, mode]),
  );
}

function prepareSelfDamageRecruit(
  seed: number,
  options: { rewinder?: boolean; health?: number } = {},
): { state: GameState; playerId: string; cardId: string } {
  const state = createHeadlessGame(seed);
  const playerId = "player-1";
  const focal = playerById(state, playerId);
  const template = focal.shop[0];
  assert.ok(template, "the focal AI must start with a shop minion template");

  state.phase = "recruit";
  state.round = 12;
  state.pendingInteraction = null;
  state.lastBattle = null;
  state.lastRoundBattles = [];
  state.winnerId = null;
  for (const player of state.players) {
    const remainsAlive = player.id === "player-0" || player.id === playerId;
    player.isHuman = false;
    player.alive = remainsAlive;
    player.health = remainsAlive ? 40 : 0;
    player.armor = 0;
    player.gold = 0;
    player.heroPowerId = null;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }

  focal.health =
    options.health ?? getAiStrategyProfile(playerId).healthSpendFloor + 1;
  if (options.rewinder) {
    focal.board = [
      clonedMinion(template, "headless-safety-soul-rewinder", {
        definitionId: "BG26_174",
        tribe: "demon",
        tribes: ["demon"],
        attack: 3,
        health: 6,
      }),
    ];
  }
  const cardId = "headless-safety-vulgar-homunculus";
  focal.hand = [
    clonedMinion(template, cardId, {
      definitionId: "vulgar-homunculus",
      tribe: "demon",
      tribes: ["demon"],
      attack: 2,
      health: 4,
    }),
  ];
  return { state, playerId, cardId };
}

function assertSelfDamageCardLocation(
  state: GameState,
  playerId: string,
  cardId: string,
  location: "board" | "hand",
): void {
  const player = playerById(state, playerId);
  assert.equal(
    player.board.some((minion) => minion.instanceId === cardId),
    location === "board",
  );
  assert.equal(
    player.hand.some((card) => card.instanceId === cardId),
    location === "hand",
  );
}

test("headless recruit-safety modes reject human and pending-input states", () => {
  const human = createHeadlessGame(90_040_101);
  human.players[0]!.isHuman = true;
  const humanSnapshot = JSON.stringify(human);
  assert.throws(
    () =>
      advanceHeadlessGameWithAiRecruitSafetyModes(
        human,
        safetyModes(human, "safe-v4"),
      ),
    /headless games cannot contain a human player/,
  );
  assert.equal(JSON.stringify(human), humanSnapshot);

  const pending = createLobbyGame(90_040_102);
  for (const player of pending.players) {
    player.isHuman = false;
  }
  const pendingSnapshot = JSON.stringify(pending);
  assert.throws(
    () =>
      advanceHeadlessGameWithAiRecruitSafetyModes(
        pending,
        safetyModes(pending, "safe-v4"),
      ),
    /headless games cannot pause for an interaction/,
  );
  assert.equal(JSON.stringify(pending), pendingSnapshot);
});

test("headless recruit-safety modes require one valid entry per player", () => {
  const state = createHeadlessGame(90_040_103);
  const snapshot = JSON.stringify(state);

  const missing = safetyModes(state, "safe-v4");
  delete missing["player-7"];
  assert.throws(
    () => advanceHeadlessGameWithAiRecruitSafetyModes(state, missing),
    /must contain exactly the game players/,
  );

  const extra = safetyModes(state, "safe-v4");
  extra["not-a-player"] = "safe-v4";
  assert.throws(
    () => advanceHeadlessGameWithAiRecruitSafetyModes(state, extra),
    /must contain exactly the game players/,
  );

  const invalid = safetyModes(state, "safe-v4");
  invalid["player-1"] = "unsafe-v5" as AiRecruitSafetyMode;
  assert.throws(
    () => advanceHeadlessGameWithAiRecruitSafetyModes(state, invalid),
    /invalid headless recruit-safety mode for player-1: unsafe-v5/,
  );
  assert.equal(JSON.stringify(state), snapshot);
});

test("headless recruit-safety modes reject a non-canonical player roster", () => {
  const state = createHeadlessGame(90_040_108);
  state.players[7]!.id = "player-8";
  const snapshot = JSON.stringify(state);

  assert.throws(
    () =>
      advanceHeadlessGameWithAiRecruitSafetyModes(
        state,
        safetyModes(state, "safe-v4"),
      ),
    /requires canonical player-0\.\.player-7/,
  );
  assert.equal(JSON.stringify(state), snapshot);
});

test("single-seat safe-v4 blocks a floor-crossing minion that legacy-v3 plays", () => {
  const { state, playerId, cardId } = prepareSelfDamageRecruit(90_040_104);
  const floor = getAiStrategyProfile(playerId).healthSpendFloor;
  const snapshot = JSON.stringify(state);
  const legacyModes = safetyModes(state, "legacy-v3");
  const safeModes = { ...legacyModes, [playerId]: "safe-v4" } as const;

  const legacy = advanceHeadlessGameWithAiRecruitSafetyModes(
    state,
    legacyModes,
  );
  const safe = advanceHeadlessGameWithAiRecruitSafetyModes(state, safeModes);

  assert.equal(JSON.stringify(state), snapshot);
  assertSelfDamageCardLocation(legacy.state, playerId, cardId, "board");
  assert.equal(playerById(legacy.state, playerId).health, floor - 1);
  assertSelfDamageCardLocation(safe.state, playerId, cardId, "hand");
  assert.equal(playerById(safe.state, playerId).health, floor + 1);

  const legacyDiagnostics: AiRecruitSafetyPlayerDiagnostics = {
    minionDamageOpportunities: 1,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 0,
    heroPowerBlocks: 0,
    decisionDivergences: 0,
    rewinderExemptions: 0,
    floorCrossings: 1,
    lethalRisks: 0,
  };
  assert.deepEqual(legacy.diagnostics.byPlayer[playerId], legacyDiagnostics);
  assert.deepEqual(safe.diagnostics.byPlayer[playerId], {
    ...legacyDiagnostics,
    minionBlocks: 1,
    decisionDivergences: 1,
  });
});

test("filtering an unchosen unsafe minion is not treatment exposure", () => {
  const { state, playerId, cardId } = prepareSelfDamageRecruit(90_040_111);
  const player = playerById(state, playerId);
  const unsafe = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.instanceId === cardId,
  );
  assert.ok(unsafe);
  player.board = Array.from({ length: 6 }, (_, index) =>
    clonedMinion(unsafe, `strong-existing-board-${index}`, {
      attack: 200,
      health: 200,
      golden: true,
    }),
  );
  const preferredSafeCardId = "preferred-safe-soul-rewinder";
  player.hand = [
    unsafe,
    clonedMinion(unsafe, preferredSafeCardId, {
      definitionId: "BG26_174",
      attack: 500,
      health: 500,
    }),
  ];

  const result = advanceHeadlessGameWithAiRecruitSafetyModes(
    state,
    safetyModes(state, "safe-v4"),
  );
  const nextPlayer = playerById(result.state, playerId);

  assert.ok(
    nextPlayer.board.some(
      (minion) => minion.instanceId === preferredSafeCardId,
    ),
  );
  assert.ok(nextPlayer.hand.some((card) => card.instanceId === cardId));
  assert.ok(result.diagnostics.byPlayer[playerId]!.minionBlocks > 0);
  assert.equal(
    result.diagnostics.byPlayer[playerId]!.decisionDivergences,
    0,
  );
});

test("single-seat safe-v4 blocks the floor-crossing tavern-steal Hero Power", () => {
  const { state, playerId } = prepareSelfDamageRecruit(90_040_107);
  const player = playerById(state, playerId);
  const template = player.hand.find(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.ok(template, "the focal AI must have a minion template");
  const floor = getAiStrategyProfile(playerId).healthSpendFloor;
  player.heroPowerId = "hero-power-tb_baconshop_hp_049";
  player.heroPowerActiveThisTurn = false;
  player.health = floor + 1;
  player.gold = 2;
  player.hand = [];
  player.board = Array.from({ length: 7 }, (_, index) =>
    clonedMinion(template, `headless-hero-power-board-${index}`, {
      definitionId: "scallywag",
      tribe: "pirate",
      tribes: ["pirate"],
      attack: 100,
      health: 100,
      golden: true,
    }),
  );
  player.shop = [
    clonedMinion(template, "headless-hero-power-offer", {
      definitionId: "scallywag",
      tribe: "pirate",
      tribes: ["pirate"],
      attack: 1,
      health: 1,
    }),
  ];
  const snapshot = JSON.stringify(state);
  const legacyModes = safetyModes(state, "legacy-v3");
  const safeModes = { ...legacyModes, [playerId]: "safe-v4" } as const;

  const legacy = advanceHeadlessGameWithAiRecruitSafetyModes(
    state,
    legacyModes,
  );
  const safe = advanceHeadlessGameWithAiRecruitSafetyModes(state, safeModes);

  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(playerById(legacy.state, playerId).heroPowerActiveThisTurn, true);
  assert.equal(playerById(legacy.state, playerId).health, floor - 1);
  assert.equal(playerById(safe.state, playerId).heroPowerActiveThisTurn, false);
  assert.equal(playerById(safe.state, playerId).health, floor + 1);
  assert.deepEqual(legacy.diagnostics.byPlayer[playerId], {
    minionDamageOpportunities: 0,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 1,
    heroPowerBlocks: 0,
    decisionDivergences: 0,
    rewinderExemptions: 0,
    floorCrossings: 1,
    lethalRisks: 0,
  });
  assert.deepEqual(safe.diagnostics.byPlayer[playerId], {
    minionDamageOpportunities: 0,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 1,
    heroPowerBlocks: 1,
    decisionDivergences: 1,
    rewinderExemptions: 0,
    floorCrossings: 1,
    lethalRisks: 0,
  });
});

test("safe-v4 records Soul Rewinder as an exemption and still plays", () => {
  const { state, playerId, cardId } = prepareSelfDamageRecruit(90_040_105, {
    rewinder: true,
    health: 1,
  });
  const snapshot = JSON.stringify(state);
  const result = advanceHeadlessGameWithAiRecruitSafetyModes(
    state,
    safetyModes(state, "safe-v4"),
  );

  assert.equal(JSON.stringify(state), snapshot);
  assertSelfDamageCardLocation(result.state, playerId, cardId, "board");
  assert.equal(playerById(result.state, playerId).health, 1);
  assert.deepEqual(result.diagnostics.byPlayer[playerId], {
    minionDamageOpportunities: 1,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 0,
    heroPowerBlocks: 0,
    decisionDivergences: 0,
    rewinderExemptions: 1,
    floorCrossings: 0,
    lethalRisks: 0,
  });
});

test("safe-v4 counts a Soul Rewinder being played as its own exemption", () => {
  const { state, playerId, cardId } = prepareSelfDamageRecruit(90_040_109, {
    health: 1,
  });
  const player = playerById(state, playerId);
  const template = player.hand.find(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  assert.ok(template, "the focal AI must have a minion template");
  player.board = [
    clonedMinion(template, "headless-self-rewind-wrath-weaver", {
      definitionId: "wrath-weaver",
      tribe: "demon",
      tribes: ["demon"],
      attack: 1,
      health: 3,
    }),
  ];
  player.hand = [
    clonedMinion(template, cardId, {
      definitionId: "BG26_174",
      tribe: "demon",
      tribes: ["demon"],
      attack: 3,
      health: 6,
    }),
  ];
  const snapshot = JSON.stringify(state);

  const result = advanceHeadlessGameWithAiRecruitSafetyModes(
    state,
    safetyModes(state, "safe-v4"),
  );

  assert.equal(JSON.stringify(state), snapshot);
  assertSelfDamageCardLocation(result.state, playerId, cardId, "board");
  assert.equal(playerById(result.state, playerId).health, 1);
  assert.deepEqual(result.diagnostics.byPlayer[playerId], {
    minionDamageOpportunities: 1,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 0,
    heroPowerBlocks: 0,
    decisionDivergences: 0,
    rewinderExemptions: 1,
    floorCrossings: 0,
    lethalRisks: 0,
  });
});

test("safe-v4 does not project an already-used War Drum a second time", () => {
  const { state, playerId, cardId } = prepareSelfDamageRecruit(90_040_110);
  const player = playerById(state, playerId);
  const floor = getAiStrategyProfile(playerId).healthSpendFloor;
  const warDrumId = "lesser-trinket-bg32-magicitem-416";
  const usedThisRound = state.round * 2 + 1;
  player.health = floor + 2;
  player.trinketIds = [warDrumId];
  player.trinketCounters = { [warDrumId]: usedThisRound };
  const snapshot = JSON.stringify(state);

  const result = advanceHeadlessGameWithAiRecruitSafetyModes(
    state,
    safetyModes(state, "safe-v4"),
  );

  assert.equal(JSON.stringify(state), snapshot);
  assertSelfDamageCardLocation(result.state, playerId, cardId, "board");
  assert.equal(playerById(result.state, playerId).health, floor);
  assert.equal(
    playerById(result.state, playerId).trinketCounters[warDrumId],
    usedThisRound,
  );
  assert.deepEqual(result.diagnostics.byPlayer[playerId], {
    minionDamageOpportunities: 1,
    minionBlocks: 0,
    heroPowerDamageOpportunities: 0,
    heroPowerBlocks: 0,
    decisionDivergences: 0,
    rewinderExemptions: 0,
    floorCrossings: 0,
    lethalRisks: 0,
  });
});

test("production headless advancement remains safe-v4 without a game-state switch", () => {
  const { state, playerId, cardId } = prepareSelfDamageRecruit(90_040_106);
  assert.equal("aiRecruitSafetyModes" in state, false);

  const forged = structuredClone(state) as GameState & {
    aiRecruitSafetyModes: Record<string, AiRecruitSafetyMode>;
  };
  forged.aiRecruitSafetyModes = safetyModes(forged, "legacy-v3");
  const next = advanceHeadlessGame(forged);

  assertSelfDamageCardLocation(next, playerId, cardId, "hand");
  assert.equal(
    playerById(next, playerId).health,
    getAiStrategyProfile(playerId).healthSpendFloor + 1,
  );
});
