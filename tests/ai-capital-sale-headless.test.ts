import assert from "node:assert/strict";
import test from "node:test";

import { getAiStrategyProfile } from "../lib/game/ai.ts";
import {
  advanceHeadlessGame,
  advanceHeadlessGameWithAiCapitalSaleModes,
  createHeadlessGame,
  scoreMinionForAi,
  type AiCapitalSaleMode,
  type AiCapitalSalePlayerDiagnostics,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

interface OpportunityOptions {
  handSize?: number;
  sourceDefinitionId?: string;
  targetMatchesSource?: boolean;
}

interface PreparedOpportunity {
  state: GameState;
  sourceIds: Record<string, string>;
  targetIds: Record<string, string>;
}

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player, `expected ${playerId}`);
  return player;
}

function clonedMinion(
  template: BoardMinionInstance,
  instanceId: string,
  definitionId: string,
  attack: number,
  health: number,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return {
    ...structuredClone(template),
    kind: "minion",
    instanceId,
    definitionId,
    tier: 1,
    tribe: "neutral",
    tribes: ["neutral"],
    associatedTribes: [],
    sellValue: 1,
    attack,
    health,
    golden: false,
    taunt: false,
    divineShield: false,
    reborn: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    cleave: false,
    alwaysAttacksLowestAttack: false,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    effectCounters: {},
    ...overrides,
  };
}

function prepareOpportunity(
  seed: number,
  focalPlayerIds: readonly string[] = ["player-1"],
  optionsByPlayer: Readonly<Record<string, OpportunityOptions>> = {},
): PreparedOpportunity {
  const state = createHeadlessGame(seed);
  const templates = new Map(
    state.players.map((player) => {
      const template = player.shop[0];
      assert.ok(template, `expected a shop template for ${player.id}`);
      return [player.id, structuredClone(template)] as const;
    }),
  );
  const aliveIds = new Set(["player-0", ...focalPlayerIds]);

  state.phase = "recruit";
  state.round = 12;
  state.pendingInteraction = null;
  state.lastBattle = null;
  state.lastRoundBattles = [];
  state.winnerId = null;
  state.lobbySystemsEnabled = false;
  state.systemEventId = null;
  for (const player of state.players) {
    const alive = aliveIds.has(player.id);
    player.isHuman = false;
    player.alive = alive;
    player.health = alive ? 40 : 0;
    player.armor = 0;
    player.heroId = null;
    player.heroPowerId = null;
    player.heroPowerCounters = {};
    player.heroPowerActiveThisTurn = false;
    player.trinketIds = [];
    player.trinketCounters = {};
    player.secretIds = [];
    player.gold = 0;
    player.maxGold = 10;
    player.tavernTier = 6;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.frozen = false;
    player.freeRefreshes = 0;
    player.heroRefreshAvailable = false;
    player.helpfulRefreshes = 0;
    player.pendingSpellcraft = [];
    player.pendingCardPlayed = null;
    player.pendingTavernSpellDefinitionId = null;
  }

  const sourceIds: Record<string, string> = {};
  const targetIds: Record<string, string> = {};
  for (const playerId of focalPlayerIds) {
    const player = playerById(state, playerId);
    const template = templates.get(playerId);
    assert.ok(template);
    const options = optionsByPlayer[playerId] ?? {};
    const sourceDefinitionId =
      options.sourceDefinitionId ?? "vulgar-homunculus";
    const targetDefinitionId = options.targetMatchesSource
      ? sourceDefinitionId
      : "dragonspawn-lieutenant";
    const sourceId = `capital-source-${playerId}`;
    const targetId = `capital-target-${playerId}`;
    sourceIds[playerId] = sourceId;
    targetIds[playerId] = targetId;
    player.gold = 2;
    player.board = [
      clonedMinion(
        template,
        sourceId,
        sourceDefinitionId,
        options.targetMatchesSource ? 5 : 1,
        options.targetMatchesSource ? 5 : 1,
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        clonedMinion(
          template,
          `capital-anchor-${playerId}-${index}`,
          sourceDefinitionId,
          100,
          100,
          { golden: true },
        ),
      ),
    ];
    player.hand = Array.from({ length: options.handSize ?? 0 }, (_, index) =>
      clonedMinion(
        template,
        `capital-hand-${playerId}-${index}`,
        "dragonspawn-lieutenant",
        0,
        0,
        { golden: true },
      ),
    );
    player.shop = [
      clonedMinion(
        template,
        targetId,
        targetDefinitionId,
        options.targetMatchesSource ? 5 : 30,
        options.targetMatchesSource ? 5 : 30,
      ),
    ];
  }
  return { state, sourceIds, targetIds };
}

function capitalModes(
  state: GameState,
  mode: AiCapitalSaleMode,
): Record<string, AiCapitalSaleMode> {
  return Object.fromEntries(
    state.players.map((player) => [player.id, mode]),
  );
}

function successfulDiagnostics(): AiCapitalSalePlayerDiagnostics {
  return {
    eligible: 1,
    dryRunAccepted: 1,
    salesCommitted: 1,
    purchasesCommitted: 1,
    decisionDivergences: 1,
    postSaleAborts: 0,
    handCapacityAborts: 0,
    offerMutationAborts: 0,
    fundingAborts: 0,
    scoreAborts: 0,
    settledWarbandScoreAborts: 0,
    interactionAborts: 0,
    executionFailureAborts: 0,
  };
}

function configureReplacementBoundary(
  prepared: PreparedOpportunity,
  playerId: string,
  scoreOffset: number,
): { threshold: number; candidateScore: number } {
  const player = playerById(prepared.state, playerId);
  const source = player.board.find(
    (minion) => minion.instanceId === prepared.sourceIds[playerId],
  );
  const target = player.shop.find(
    (minion) => minion.instanceId === prepared.targetIds[playerId],
  );
  assert.ok(source && target);
  source.definitionId = "dragonspawn-lieutenant";
  source.golden = true;
  source.attack = 5;
  source.health = 5;
  target.definitionId = "dragonspawn-lieutenant";
  target.golden = false;
  target.attack = 5;
  target.health = 5;

  const profile = getAiStrategyProfile(playerId);
  const sourceScore = scoreMinionForAi(player, source);
  const threshold = sourceScore + profile.replacementMargin;
  const scoreAfterRemovingSource = () => {
    const postRemovalPlayer = structuredClone(player);
    postRemovalPlayer.board = postRemovalPlayer.board.filter(
      (minion) => minion.instanceId !== source.instanceId,
    );
    const postRemovalTarget = postRemovalPlayer.shop.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(postRemovalTarget);
    return scoreMinionForAi(postRemovalPlayer, postRemovalTarget);
  };
  const initialCandidateScore = scoreAfterRemovingSource();
  target.attack +=
    (threshold + scoreOffset - initialCandidateScore) /
    profile.statWeight;
  let candidateScore = scoreAfterRemovingSource();
  if (scoreOffset === 0 && candidateScore < threshold) {
    target.attack += 1e-10 / profile.statWeight;
    candidateScore = scoreAfterRemovingSource();
  }
  return { threshold, candidateScore };
}

function warbandScore(player: PlayerState): number {
  return player.board.reduce(
    (total, minion) => total + scoreMinionForAi(player, minion),
    0,
  );
}

function configurePostRemovalReplacementBoundary(
  prepared: PreparedOpportunity,
  playerId: string,
  scoreOffset: number,
): { threshold: number; candidateScore: number } {
  const player = playerById(prepared.state, playerId);
  const source = player.board.find(
    (minion) => minion.instanceId === prepared.sourceIds[playerId],
  );
  const target = player.shop.find(
    (minion) => minion.instanceId === prepared.targetIds[playerId],
  );
  assert.ok(source && target);
  const profile = getAiStrategyProfile(playerId);
  const threshold = scoreMinionForAi(player, source) + profile.replacementMargin;
  const candidateScoreAfterRemoval = () => {
    const postRemovalPlayer = structuredClone(player);
    postRemovalPlayer.board = postRemovalPlayer.board.filter(
      (minion) => minion.instanceId !== source.instanceId,
    );
    const postRemovalTarget = postRemovalPlayer.shop.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(postRemovalTarget);
    return scoreMinionForAi(postRemovalPlayer, postRemovalTarget);
  };
  target.attack +=
    (threshold + scoreOffset - candidateScoreAfterRemoval()) /
    profile.statWeight;
  return { threshold, candidateScore: candidateScoreAfterRemoval() };
}

function configureSettledWarbandBoundary(
  prepared: PreparedOpportunity,
  playerId: string,
  scoreOffset: number,
): {
  threshold: number;
  settledScore: number;
  localThreshold: number;
  localCandidateScore: number;
} {
  const player = playerById(prepared.state, playerId);
  const source = player.board.find(
    (minion) => minion.instanceId === prepared.sourceIds[playerId],
  );
  const target = player.shop.find(
    (minion) => minion.instanceId === prepared.targetIds[playerId],
  );
  assert.ok(source && target);
  source.definitionId = "titus-rivendare";
  source.golden = false;
  source.attack = 1;
  source.health = 1;
  for (const minion of player.board) {
    if (minion.instanceId !== source.instanceId) {
      minion.definitionId = "kangors-apprentice";
    }
  }
  target.definitionId = "dragonspawn-lieutenant";
  target.golden = false;
  target.attack = 5;
  target.health = 5;

  const profile = getAiStrategyProfile(playerId);
  const threshold = warbandScore(player) + profile.replacementMargin;
  const scoreAfterReplacement = () => {
    const settledPlayer = structuredClone(player);
    const settledTarget = settledPlayer.shop.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(settledTarget);
    settledPlayer.board = settledPlayer.board.filter(
      (minion) => minion.instanceId !== source.instanceId,
    );
    settledPlayer.shop = settledPlayer.shop.filter(
      (minion) => minion.instanceId !== target.instanceId,
    );
    settledPlayer.board.push(settledTarget);
    return warbandScore(settledPlayer);
  };
  target.attack +=
    (threshold + scoreOffset - scoreAfterReplacement()) /
    profile.statWeight;
  let settledScore = scoreAfterReplacement();
  if (scoreOffset === 0 && settledScore < threshold) {
    target.attack += 1e-10 / profile.statWeight;
    settledScore = scoreAfterReplacement();
  }
  const postRemovalPlayer = structuredClone(player);
  postRemovalPlayer.board = postRemovalPlayer.board.filter(
    (minion) => minion.instanceId !== source.instanceId,
  );
  const postRemovalTarget = postRemovalPlayer.shop.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(postRemovalTarget);
  return {
    threshold,
    settledScore,
    localThreshold:
      scoreMinionForAi(player, source) + profile.replacementMargin,
    localCandidateScore: scoreMinionForAi(
      postRemovalPlayer,
      postRemovalTarget,
    ),
  };
}

test("sell-one-v5 dry-runs, sells one weak minion, and buys the locked offer", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(90_050_101, [playerId]);
  const snapshot = JSON.stringify(prepared.state);
  const modes = capitalModes(prepared.state, "legacy-v4");
  modes[playerId] = "sell-one-v5";

  const result = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    modes,
  );
  const player = playerById(result.state, playerId);

  assert.equal(JSON.stringify(prepared.state), snapshot);
  assert.equal(player.gold, 0);
  assert.equal(player.board.length, 7);
  assert.equal(
    player.board.some(
      (minion) => minion.instanceId === prepared.sourceIds[playerId],
    ),
    false,
  );
  assert.equal(
    player.board.some(
      (minion) => minion.instanceId === prepared.targetIds[playerId],
    ),
    true,
  );
  assert.equal(
    player.shop.some(
      (minion) => minion.instanceId === prepared.targetIds[playerId],
    ),
    false,
  );
  assert.deepEqual(
    result.diagnostics.byPlayer[playerId],
    successfulDiagnostics(),
  );
});

test("sell-one-v6 settles the bought minion before atomically installing the stronger warband", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(90_060_101, [playerId]);
  const v5Modes = capitalModes(prepared.state, "legacy-v4");
  v5Modes[playerId] = "sell-one-v5";
  const v6Modes = capitalModes(prepared.state, "legacy-v4");
  v6Modes[playerId] = "sell-one-v6-settled-warband";

  const v5 = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    v5Modes,
  );
  const v6 = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    v6Modes,
  );
  const player = playerById(v6.state, playerId);

  assert.deepEqual(v6.state, v5.state);
  assert.equal(player.gold, 0);
  assert.equal(player.board.length, 7);
  assert.ok(
    player.board.some(
      (minion) => minion.instanceId === prepared.targetIds[playerId],
    ),
  );
  assert.deepEqual(
    v6.diagnostics.byPlayer[playerId],
    successfulDiagnostics(),
  );
});

test("sell-one-v6 rejects a local upgrade that weakens the settled support warband", () => {
  const playerId = "player-7";
  const prepared = prepareOpportunity(
    90_060_102,
    [playerId],
    { [playerId]: { sourceDefinitionId: "titus-rivendare" } },
  );
  const player = playerById(prepared.state, playerId);
  for (const minion of player.board) {
    if (minion.instanceId !== prepared.sourceIds[playerId]) {
      minion.definitionId = "kangors-apprentice";
    }
  }
  const localBoundary = configurePostRemovalReplacementBoundary(
    prepared,
    playerId,
    0.1,
  );
  assert.ok(localBoundary.candidateScore >= localBoundary.threshold);

  const legacy = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "legacy-v4"),
  );
  const v5 = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "sell-one-v5"),
  );
  const v6 = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "sell-one-v6-settled-warband"),
  );

  assert.equal(v5.diagnostics.byPlayer[playerId]?.decisionDivergences, 1);
  assert.deepEqual(v6.state, legacy.state);
  assert.deepEqual(v6.diagnostics.byPlayer[playerId], {
    ...successfulDiagnostics(),
    dryRunAccepted: 0,
    salesCommitted: 0,
    purchasesCommitted: 0,
    decisionDivergences: 0,
    settledWarbandScoreAborts: 1,
  });
});

test("sell-one-v6 rejects an unplayable purchase without leaking clone mutations", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(90_060_103, [playerId]);
  const target = playerById(prepared.state, playerId).shop.find(
    (minion) => minion.instanceId === prepared.targetIds[playerId],
  );
  assert.ok(target);
  target.playableFromRound = prepared.state.round + 1;

  const legacy = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "legacy-v4"),
  );
  const v6 = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "sell-one-v6-settled-warband"),
  );

  assert.deepEqual(v6.state, legacy.state);
  assert.equal(
    v6.diagnostics.byPlayer[playerId]?.settledWarbandScoreAborts,
    1,
  );
  assert.equal(v6.diagnostics.byPlayer[playerId]?.salesCommitted, 0);
  assert.equal(v6.diagnostics.byPlayer[playerId]?.purchasesCommitted, 0);
});

test("legacy-v4 certifies the opportunity but does not sell", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(90_050_102, [playerId]);
  const result = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "legacy-v4"),
  );
  const player = playerById(result.state, playerId);

  assert.equal(player.gold, 2);
  assert.ok(
    player.board.some(
      (minion) => minion.instanceId === prepared.sourceIds[playerId],
    ),
  );
  assert.ok(
    player.shop.some(
      (minion) => minion.instanceId === prepared.targetIds[playerId],
    ),
  );
  assert.deepEqual(result.diagnostics.byPlayer[playerId], {
    ...successfulDiagnostics(),
    salesCommitted: 0,
    purchasesCommitted: 0,
    decisionDivergences: 0,
  });
});

test("production headless advancement stays byte-equivalent to legacy-v4", () => {
  const prepared = prepareOpportunity(90_050_103, ["player-1"]);
  const snapshot = JSON.stringify(prepared.state);
  const production = advanceHeadlessGame(prepared.state);
  const benchmark = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "legacy-v4"),
  );

  assert.equal(JSON.stringify(prepared.state), snapshot);
  assert.deepEqual(benchmark.state, production);
  assert.equal("aiCapitalSaleModes" in prepared.state, false);
});

test("sell-one-v5 abstains with nine cards or a source sell trigger", () => {
  const playerId = "player-1";
  const fullHand = prepareOpportunity(
    90_050_104,
    [playerId],
    { [playerId]: { handSize: 9 } },
  );
  const fullHandResult = advanceHeadlessGameWithAiCapitalSaleModes(
    fullHand.state,
    capitalModes(fullHand.state, "sell-one-v5"),
  );
  const fullHandPlayer = playerById(fullHandResult.state, playerId);
  assert.ok(
    fullHandPlayer.board.some(
      (minion) => minion.instanceId === fullHand.sourceIds[playerId],
    ),
  );
  assert.equal(
    fullHandResult.diagnostics.byPlayer[playerId]?.handCapacityAborts,
    1,
  );
  assert.equal(
    fullHandResult.diagnostics.byPlayer[playerId]?.salesCommitted,
    0,
  );

  const sellTrigger = prepareOpportunity(
    90_050_105,
    [playerId],
    { [playerId]: { sourceDefinitionId: "BG20_301" } },
  );
  const sellTriggerResult = advanceHeadlessGameWithAiCapitalSaleModes(
    sellTrigger.state,
    capitalModes(sellTrigger.state, "sell-one-v5"),
  );
  const sellTriggerPlayer = playerById(sellTriggerResult.state, playerId);
  assert.ok(
    sellTriggerPlayer.board.some(
      (minion) => minion.instanceId === sellTrigger.sourceIds[playerId],
    ),
  );
  assert.equal(
    sellTriggerResult.diagnostics.byPlayer[playerId]?.eligible,
    0,
  );
  assert.equal(
    sellTriggerResult.diagnostics.byPlayer[playerId]?.salesCommitted,
    0,
  );
});

test("the post-removal score must still clear the profile replacement margin", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(
    90_050_106,
    [playerId],
    { [playerId]: { targetMatchesSource: true } },
  );
  const player = playerById(prepared.state, playerId);
  const source = player.board.find(
    (minion) => minion.instanceId === prepared.sourceIds[playerId],
  );
  const target = player.shop.find(
    (minion) => minion.instanceId === prepared.targetIds[playerId],
  );
  assert.ok(source && target);
  const sourceScore = scoreMinionForAi(player, source);
  const preRemovalScore = scoreMinionForAi(player, target);
  const postRemovalPlayer = structuredClone(player);
  postRemovalPlayer.board = postRemovalPlayer.board.filter(
    (minion) => minion.instanceId !== source.instanceId,
  );
  const postRemovalTarget = postRemovalPlayer.shop.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(postRemovalTarget);
  const postRemovalScore = scoreMinionForAi(
    postRemovalPlayer,
    postRemovalTarget,
  );
  const margin = getAiStrategyProfile(playerId).replacementMargin;
  assert.ok(preRemovalScore >= sourceScore + margin);
  assert.ok(postRemovalScore < sourceScore + margin);

  const result = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "sell-one-v5"),
  );
  const nextPlayer = playerById(result.state, playerId);
  assert.ok(
    nextPlayer.board.some(
      (minion) => minion.instanceId === prepared.sourceIds[playerId],
    ),
  );
  assert.deepEqual(result.diagnostics.byPlayer[playerId], {
    eligible: 1,
    dryRunAccepted: 0,
    salesCommitted: 0,
    purchasesCommitted: 0,
    decisionDivergences: 0,
    postSaleAborts: 0,
    handCapacityAborts: 0,
    offerMutationAborts: 0,
    fundingAborts: 0,
    scoreAborts: 1,
    settledWarbandScoreAborts: 0,
    interactionAborts: 0,
    executionFailureAborts: 0,
  });
});

test("a matching quote without sale proceeds is classified as funding, not offer mutation", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(90_050_110, [playerId]);
  prepared.state.lobbySystemsEnabled = true;
  prepared.state.systemEventId = "system-event-refund-trick";
  playerById(prepared.state, playerId).gold = 0;

  const result = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "sell-one-v5"),
  );
  const diagnostics = result.diagnostics.byPlayer[playerId];
  assert.equal(diagnostics?.eligible, 1);
  assert.equal(diagnostics?.fundingAborts, 1);
  assert.equal(diagnostics?.offerMutationAborts, 0);
  assert.equal(diagnostics?.salesCommitted, 0);
  assert.equal(diagnostics?.purchasesCommitted, 0);
  assert.equal(diagnostics?.postSaleAborts, 0);
  assert.ok(
    playerById(result.state, playerId).board.some(
      (minion) => minion.instanceId === prepared.sourceIds[playerId],
    ),
  );
});

test("a free refresh can expose a new capital-sale purchase", () => {
  const playerId = "player-1";
  const prepared = prepareOpportunity(90_050_111, [playerId]);
  const player = playerById(prepared.state, playerId);
  player.shop = [];
  player.freeRefreshes = 1;
  player.tavernMinionAttackBonus = 30;
  player.tavernMinionHealthBonus = 30;
  prepared.state.activeTribes = ["mech"];
  for (const definitionId of Object.keys(prepared.state.pool)) {
    prepared.state.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(prepared.state.spellPool)) {
    prepared.state.spellPool[definitionId] = 0;
  }
  prepared.state.pool.BG35_801 = 20;

  const legacy = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "legacy-v4"),
  );
  const legacyPlayer = playerById(legacy.state, playerId);
  assert.ok(
    legacyPlayer.board.some(
      (minion) => minion.instanceId === prepared.sourceIds[playerId],
    ),
    JSON.stringify({
      shop: legacyPlayer.shop.map((minion) => minion.definitionId),
      gold: legacyPlayer.gold,
      hand: legacyPlayer.hand.map((card) => card.definitionId),
      board: legacyPlayer.board.map((minion) => minion.definitionId),
    }),
  );

  const result = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    capitalModes(prepared.state, "sell-one-v5"),
  );
  const nextPlayer = playerById(result.state, playerId);
  assert.equal(nextPlayer.freeRefreshes, 0);
  assert.equal(
    nextPlayer.board.some(
      (minion) => minion.instanceId === prepared.sourceIds[playerId],
    ),
    false,
  );
  assert.ok(
    nextPlayer.board.some((minion) => minion.definitionId === "BG35_801"),
  );
  assert.deepEqual(
    result.diagnostics.byPlayer[playerId],
    successfulDiagnostics(),
    JSON.stringify({
      shop: nextPlayer.shop.map((minion) => minion.definitionId),
      gold: nextPlayer.gold,
      board: nextPlayer.board.map((minion) => ({
        id: minion.instanceId,
        attack: minion.attack,
        health: minion.health,
      })),
    }),
  );
});

test("single-seat modes and cloned-state identity isolate the candidate", () => {
  const prepared = prepareOpportunity(
    90_050_107,
    ["player-1", "player-2"],
  );
  const modes = capitalModes(prepared.state, "legacy-v4");
  modes["player-1"] = "sell-one-v5";
  const result = advanceHeadlessGameWithAiCapitalSaleModes(
    prepared.state,
    modes,
  );

  assert.equal(
    playerById(result.state, "player-1").board.some(
      (minion) => minion.instanceId === prepared.sourceIds["player-1"],
    ),
    false,
  );
  assert.equal(
    playerById(result.state, "player-2").board.some(
      (minion) => minion.instanceId === prepared.sourceIds["player-2"],
    ),
    true,
  );
  const production = advanceHeadlessGame(prepared.state);
  assert.ok(
    playerById(production, "player-1").board.some(
      (minion) => minion.instanceId === prepared.sourceIds["player-1"],
    ),
  );
});

test("capital-sale modes require canonical player-0..player-7 maps", () => {
  const prepared = prepareOpportunity(90_050_108, ["player-1"]);
  const snapshot = JSON.stringify(prepared.state);
  const missing = capitalModes(prepared.state, "legacy-v4");
  delete missing["player-7"];
  assert.throws(
    () => advanceHeadlessGameWithAiCapitalSaleModes(prepared.state, missing),
    /must contain exactly the game players/,
  );
  const invalid = capitalModes(prepared.state, "legacy-v4");
  invalid["player-1"] = "future-v6" as AiCapitalSaleMode;
  assert.throws(
    () => advanceHeadlessGameWithAiCapitalSaleModes(prepared.state, invalid),
    /invalid headless capital-sale mode for player-1: future-v6/,
  );
  const nonCanonical = structuredClone(prepared.state);
  nonCanonical.players[7].id = "player-8";
  assert.throws(
    () =>
      advanceHeadlessGameWithAiCapitalSaleModes(
        nonCanonical,
        capitalModes(nonCanonical, "legacy-v4"),
      ),
    /requires canonical player-0\.\.player-7/,
  );
  assert.equal(JSON.stringify(prepared.state), snapshot);
});

test("capital-sale benchmark rejects synchronous reentry and cleans up failures", () => {
  const prepared = prepareOpportunity(90_050_109, ["player-1"]);
  const ordinaryModes = capitalModes(prepared.state, "legacy-v4");
  let nestedRejected = false;
  let attempted = false;
  const reentrantModes = new Proxy(ordinaryModes, {
    get(target, property, receiver) {
      if (property === "player-0" && !attempted) {
        attempted = true;
        assert.throws(
          () =>
            advanceHeadlessGameWithAiCapitalSaleModes(
              prepared.state,
              ordinaryModes,
            ),
          /already active/,
        );
        nestedRejected = true;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  advanceHeadlessGameWithAiCapitalSaleModes(prepared.state, reentrantModes);
  assert.equal(nestedRejected, true);

  const throwingModes = new Proxy(ordinaryModes, {
    get(target, property, receiver) {
      if (property === "player-0") {
        throw new Error("capital mode getter failed");
      }
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () =>
      advanceHeadlessGameWithAiCapitalSaleModes(
        prepared.state,
        throwingModes,
      ),
    /capital mode getter failed/,
  );
  assert.doesNotThrow(() =>
    advanceHeadlessGameWithAiCapitalSaleModes(
      prepared.state,
      ordinaryModes,
    ),
  );
});

test("sell-one-v5 accepts equality and rejects just below all seven profile margins", () => {
  for (let index = 1; index <= 7; index += 1) {
    const playerId = `player-${index}`;
    const passing = prepareOpportunity(90_050_200 + index, [playerId]);
    const passingBoundary = configureReplacementBoundary(
      passing,
      playerId,
      0,
    );
    assert.ok(
      passingBoundary.candidateScore >= passingBoundary.threshold,
      `${playerId} nearest equality is not below the threshold`,
    );
    assert.ok(
      passingBoundary.candidateScore - passingBoundary.threshold < 1e-8,
      `${playerId} equality construction stays on the boundary`,
    );
    const modes = capitalModes(passing.state, "legacy-v4");
    modes[playerId] = "sell-one-v5";
    const passingResult = advanceHeadlessGameWithAiCapitalSaleModes(
      passing.state,
      modes,
    );
    assert.deepEqual(
      passingResult.diagnostics.byPlayer[playerId],
      successfulDiagnostics(),
      `${playerId} (${getAiStrategyProfile(playerId).id}) equality`,
    );
    assert.ok(
      playerById(passingResult.state, playerId).board.some(
        (minion) => minion.instanceId === passing.targetIds[playerId],
      ),
      `${playerId} (${getAiStrategyProfile(playerId).id}) bought the target`,
    );

    const failing = prepareOpportunity(90_050_300 + index, [playerId]);
    const failingBoundary = configureReplacementBoundary(
      failing,
      playerId,
      -0.01,
    );
    assert.ok(
      failingBoundary.candidateScore < failingBoundary.threshold,
      `${playerId} lower boundary is rejected`,
    );
    assert.ok(
      failingBoundary.candidateScore > failingBoundary.threshold - 0.011,
      `${playerId} lower boundary stays close to the margin`,
    );
    const failingModes = capitalModes(failing.state, "legacy-v4");
    failingModes[playerId] = "sell-one-v5";
    const failingResult = advanceHeadlessGameWithAiCapitalSaleModes(
      failing.state,
      failingModes,
    );
    const failingDiagnostics = failingResult.diagnostics.byPlayer[playerId];
    assert.equal(failingDiagnostics?.eligible, 1);
    assert.equal(failingDiagnostics?.dryRunAccepted, 0);
    assert.equal(failingDiagnostics?.scoreAborts, 1);
    assert.equal(failingDiagnostics?.salesCommitted, 0);
    assert.equal(failingDiagnostics?.purchasesCommitted, 0);
    assert.equal(failingDiagnostics?.postSaleAborts, 0);
    assert.ok(
      playerById(failingResult.state, playerId).board.some(
        (minion) => minion.instanceId === failing.sourceIds[playerId],
      ),
      `${playerId} (${getAiStrategyProfile(playerId).id}) kept the source`,
    );
  }
});

test("sell-one-v6 applies the settled-warband margin equally to all seven profiles", () => {
  for (let index = 1; index <= 7; index += 1) {
    const playerId = `player-${index}`;
    const passing = prepareOpportunity(90_060_200 + index, [playerId]);
    const passingBoundary = configureSettledWarbandBoundary(
      passing,
      playerId,
      0,
    );
    assert.ok(
      passingBoundary.settledScore >= passingBoundary.threshold,
      `${playerId} settled equality is not below the threshold`,
    );
    assert.ok(
      passingBoundary.settledScore - passingBoundary.threshold < 1e-8,
      `${playerId} settled equality stays on the boundary`,
    );
    const passingModes = capitalModes(passing.state, "legacy-v4");
    passingModes[playerId] = "sell-one-v6-settled-warband";
    const passingResult = advanceHeadlessGameWithAiCapitalSaleModes(
      passing.state,
      passingModes,
    );
    assert.deepEqual(
      passingResult.diagnostics.byPlayer[playerId],
      successfulDiagnostics(),
      `${playerId} (${getAiStrategyProfile(playerId).id}) equality`,
    );

    const failing = prepareOpportunity(90_060_300 + index, [playerId]);
    const failingBoundary = configureSettledWarbandBoundary(
      failing,
      playerId,
      -0.01,
    );
    assert.ok(
      failingBoundary.settledScore < failingBoundary.threshold,
      `${playerId} settled lower boundary is rejected`,
    );
    assert.ok(
      failingBoundary.settledScore > failingBoundary.threshold - 0.011,
      `${playerId} settled lower boundary stays close to the margin`,
    );
    assert.ok(
      failingBoundary.localCandidateScore >= failingBoundary.localThreshold,
      `${playerId} local candidate ${failingBoundary.localCandidateScore} clears ${failingBoundary.localThreshold}`,
    );
    const failingModes = capitalModes(failing.state, "legacy-v4");
    failingModes[playerId] = "sell-one-v6-settled-warband";
    const failingResult = advanceHeadlessGameWithAiCapitalSaleModes(
      failing.state,
      failingModes,
    );
    const diagnostics = failingResult.diagnostics.byPlayer[playerId];
    assert.equal(diagnostics?.eligible, 1);
    assert.equal(diagnostics?.dryRunAccepted, 0);
    assert.equal(
      diagnostics?.scoreAborts,
      0,
      `${playerId} (${getAiStrategyProfile(playerId).id}) cleared the local margin`,
    );
    assert.equal(
      diagnostics?.settledWarbandScoreAborts,
      1,
      `${playerId} (${getAiStrategyProfile(playerId).id}) failed the settled margin`,
    );
    assert.equal(diagnostics?.salesCommitted, 0);
    assert.equal(diagnostics?.purchasesCommitted, 0);
    assert.ok(
      playerById(failingResult.state, playerId).board.some(
        (minion) => minion.instanceId === failing.sourceIds[playerId],
      ),
      `${playerId} (${getAiStrategyProfile(playerId).id}) kept the source`,
    );
  }
});
