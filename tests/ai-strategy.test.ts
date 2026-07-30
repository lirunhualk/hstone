import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_STRATEGY_PROFILES,
  aiTargetBoardSize,
  createGame,
  gameReducer,
  getAiStrategyProfile,
  getTavernSpellDefinition,
  getUpgradeCost,
  planAiBoardOrder,
  scoreMinionForAi,
  shouldAiUpgrade,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player, `expected ${playerId} to exist`);
  return player;
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack,
    health: definition.health,
    golden: false,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    poolCopies: 0,
    ...overrides,
  };
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function isolateAiLobby(state: GameState, activeAiId: string): void {
  for (const player of state.players) {
    if (!player.isHuman && player.id !== activeAiId) {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.hand = [];
      player.shop = [];
      player.spellShop = null;
      player.additionalSpellShop = [];
    }
  }
  const human = playerById(state, state.humanPlayerId);
  human.alive = true;
  human.health = 40;
  human.armor = 0;
  human.gold = 0;
  human.board = [];
  human.hand = [];
  human.shop = [];
  human.spellShop = null;
  human.additionalSpellShop = [];
}

test("seven AI players receive stable, distinct strategy profiles", () => {
  const strategyIds = Array.from({ length: 7 }, (_, index) =>
    getAiStrategyProfile(`player-${index + 1}`).id,
  );

  assert.equal(AI_STRATEGY_PROFILES.length, 7);
  assert.equal(new Set(strategyIds).size, 7);
  assert.deepEqual(
    createGame(11).players
      .filter((player) => !player.isHuman)
      .map((player) => getAiStrategyProfile(player.id).id),
    createGame(98_765).players
      .filter((player) => !player.isHuman)
      .map((player) => getAiStrategyProfile(player.id).id),
  );
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) => aiTargetBoardSize(index + 1)),
    [1, 1, 3, 4, 5, 6, 7],
  );
});

test("upgrade decisions react to health, board pressure, and strategy", () => {
  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-1"),
      round: 6,
      tavernTier: 3,
      health: 35,
      armor: 5,
      gold: 7,
      upgradeCost: 6,
      boardSize: 6,
      bestShopScore: 8,
      weakestBoardScore: 10,
    }),
    true,
    "a healthy stable board should take its normal upgrade",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-3"),
      round: 7,
      tavernTier: 3,
      health: 12,
      armor: 0,
      gold: 8,
      upgradeCost: 8,
      boardSize: 3,
      bestShopScore: 16,
      weakestBoardScore: 4,
    }),
    false,
    "the tempo profile should fill a weak board instead of spending all gold",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-5"),
      round: 5,
      tavernTier: 3,
      health: 30,
      armor: 0,
      gold: 8,
      upgradeCost: 8,
      boardSize: 5,
      bestShopScore: 5,
      weakestBoardScore: 12,
    }),
    true,
    "the power-level profile should advance early when it is safe",
  );

  assert.equal(
    shouldAiUpgrade({
      profile: getAiStrategyProfile("player-1"),
      round: 6,
      tavernTier: 3,
      health: 12,
      armor: 0,
      gold: 8,
      upgradeCost: 8,
      boardSize: 6,
      bestShopScore: 5,
      weakestBoardScore: 12,
      bestAffordableSpellScore: 10,
    }),
    false,
    "a low-health AI should spend on a strong affordable spell instead",
  );
});

test("tribe identity is a soft preference and raw strength can override it", () => {
  const state = createGame(2_024);
  const player = playerById(state, "player-2");
  const template = player.shop[0];
  assert.ok(template);

  player.board = [
    definitionMinion(template, "BG_TTN_401", "mech-host-a"),
    definitionMinion(template, "BG_TTN_401", "mech-host-b"),
  ];

  const preferred = definitionMinion(
    template,
    "BG34_523",
    "preferred-mech",
    {
      attack: 8,
      health: 8,
      tribe: "mech",
      tribes: ["mech"],
      taunt: false,
      divineShield: false,
      reborn: false,
      poisonous: false,
      venomous: false,
      windfury: false,
      cleave: false,
    },
  );
  const offTheme = {
    ...preferred,
    instanceId: "off-theme-beast",
    tribe: "beast" as const,
    tribes: ["beast" as const],
  };
  assert.ok(
    scoreMinionForAi(player, preferred) >
      scoreMinionForAi(player, offTheme),
  );

  const overwhelmingOffTheme = {
    ...offTheme,
    instanceId: "overwhelming-beast",
    attack: 30,
    health: 30,
  };
  assert.ok(
    scoreMinionForAi(player, overwhelmingOffTheme) >
      scoreMinionForAi(player, preferred),
    "a large immediate upgrade must beat the preferred tribe",
  );
});

test("the triple profile values a pair and values its third copy even more", () => {
  const state = createGame(4_004);
  const player = playerById(state, "player-4");
  const template = player.shop[0];
  assert.ok(template);
  const candidate = definitionMinion(
    template,
    "BG28_300",
    "third-copy-candidate",
  );

  player.board = [];
  const noCopyScore = scoreMinionForAi(player, candidate);
  player.board = [
    definitionMinion(template, "BG28_300", "owned-copy-a"),
  ];
  const pairScore = scoreMinionForAi(player, candidate);
  player.board.push(
    definitionMinion(template, "BG28_300", "owned-copy-b"),
  );
  const tripleScore = scoreMinionForAi(player, candidate);

  assert.ok(pairScore > noCopyScore);
  assert.ok(tripleScore > pairScore);
});

test("opponent-aware positioning protects engines from cleave without mutation", () => {
  const state = createGame(7_007);
  const player = playerById(state, "player-7");
  const opponent = playerById(state, state.humanPlayerId);
  const template = player.shop[0];
  assert.ok(template);

  player.board = [
    definitionMinion(template, "titus-rivendare", "support-engine"),
    definitionMinion(template, "BG20_301", "large-taunt", {
      attack: 12,
      health: 12,
      taunt: true,
    }),
    definitionMinion(template, "BG28_300", "deathrattle"),
    definitionMinion(template, "BG20_301", "large-attacker", {
      attack: 10,
      health: 10,
    }),
    definitionMinion(template, "BG20_301", "cleave-buffer", {
      attack: 1,
      health: 1,
    }),
  ];
  opponent.board = [
    definitionMinion(template, "cave-hydra", "enemy-cleave", {
      cleave: true,
    }),
  ];
  const originalOrder = player.board.map((minion) => minion.instanceId);

  const plannedOrder = planAiBoardOrder(player, opponent);

  assert.deepEqual(
    player.board.map((minion) => minion.instanceId),
    originalOrder,
    "the planner must not mutate the recruit state",
  );
  const tauntIndex = plannedOrder.indexOf("large-taunt");
  assert.equal(plannedOrder[tauntIndex - 1], "cleave-buffer");
  assert.ok(
    plannedOrder.indexOf("deathrattle") <
      plannedOrder.indexOf("support-engine"),
  );
  assert.notEqual(plannedOrder[tauntIndex - 1], "support-engine");
});

test("the recruit engine executes safe leveling and low-health tempo plans", () => {
  const levelingState = createGame(5_005);
  levelingState.round = 5;
  isolateAiLobby(levelingState, "player-5");
  const leveler = playerById(levelingState, "player-5");
  const levelTemplate = leveler.shop[0];
  assert.ok(levelTemplate);
  leveler.alive = true;
  leveler.health = 30;
  leveler.armor = 0;
  leveler.tavernTier = 3;
  leveler.upgradeDiscount = 0;
  leveler.board = Array.from({ length: 5 }, (_, index) =>
    definitionMinion(
      levelTemplate,
      "BG_TTN_401",
      `stable-board-${index}`,
      { attack: 20, health: 20 },
    ),
  );
  leveler.shop = [
    definitionMinion(levelTemplate, "BG28_300", "weak-shop", {
      attack: 1,
      health: 1,
    }),
  ];
  leveler.hand = [];
  leveler.spellShop = null;
  leveler.additionalSpellShop = [];
  leveler.gold = getUpgradeCost(levelingState, leveler.id);

  const afterLeveling = gameReducer(levelingState, { type: "END_TURN" });
  assert.equal(playerById(afterLeveling, "player-5").tavernTier, 4);

  const tempoState = createGame(3_003);
  tempoState.round = 7;
  isolateAiLobby(tempoState, "player-3");
  const tempoPlayer = playerById(tempoState, "player-3");
  const tempoTemplate = tempoPlayer.shop[0];
  assert.ok(tempoTemplate);
  tempoPlayer.alive = true;
  tempoPlayer.health = 12;
  tempoPlayer.armor = 0;
  tempoPlayer.tavernTier = 3;
  tempoPlayer.upgradeDiscount = 0;
  tempoPlayer.board = [
    definitionMinion(tempoTemplate, "BG20_301", "weak-board-a", {
      attack: 1,
      health: 1,
    }),
    definitionMinion(tempoTemplate, "BG20_301", "weak-board-b", {
      attack: 1,
      health: 1,
    }),
  ];
  tempoPlayer.shop = [
    definitionMinion(tempoTemplate, "BG28_300", "tempo-shop", {
      attack: 20,
      health: 20,
    }),
  ];
  tempoPlayer.hand = [];
  tempoPlayer.spellShop = null;
  tempoPlayer.additionalSpellShop = [];
  tempoPlayer.gold = getUpgradeCost(tempoState, tempoPlayer.id);

  const afterTempo = gameReducer(tempoState, { type: "END_TURN" });
  const recruitedTempoPlayer = playerById(afterTempo, "player-3");
  assert.equal(recruitedTempoPlayer.tavernTier, 3);
  assert.ok(recruitedTempoPlayer.board.length >= 3);
});

test("round-one AI never spends its only three Gold and enters combat empty", () => {
  for (let seed = 1; seed <= 32; seed += 1) {
    const afterRecruit = gameReducer(createGame(seed), {
      type: "END_TURN",
    });
    for (const player of afterRecruit.players) {
      if (player.isHuman) {
        continue;
      }
      const battle = afterRecruit.lastRoundBattles.find(
        (candidate) =>
          candidate.playerAId === player.id ||
          candidate.playerBId === player.id,
      );
      const enteredThroughHandStartOfCombat =
        battle?.events.some(
          (event) =>
            event.type === "summon" &&
            event.actorPlayerId === player.id &&
            event.summonReason === "inHandStartOfCombat",
        ) ?? false;
      assert.ok(
        player.board.length >= 1 || enteredThroughHandStartOfCombat,
        `${player.id} entered round-one combat empty for seed ${seed}`,
      );
    }
  }
});

test("health-priced spells respect the post-purchase safety floor", () => {
  const runAtHealth = (health: number): PlayerState => {
    const state = createGame(8_008 + health);
    state.round = 3;
    isolateAiLobby(state, "player-1");
    const player = playerById(state, "player-1");
    const template = player.shop[0];
    assert.ok(template);
    player.alive = true;
    player.health = health;
    player.armor = 0;
    player.gold = 0;
    player.tavernTier = 2;
    player.board = [
      definitionMinion(template, "BG20_301", `health-board-${health}`, {
        attack: 5,
        health: 5,
      }),
    ];
    player.hand = [];
    player.shop = [];
    player.spellShop = tavernSpell(
      "tavern-spell-hasty-excavation",
      `hasty-${health}`,
    );
    player.additionalSpellShop = [];
    return playerById(
      gameReducer(state, { type: "END_TURN" }),
      player.id,
    );
  };

  assert.equal(runAtHealth(9).health, 9);
  assert.equal(runAtHealth(11).health, 8);
});

test("a full hand never makes AI sell before a purchase that cannot fit", () => {
  const state = createGame(9_009);
  state.round = 7;
  isolateAiLobby(state, "player-1");
  const player = playerById(state, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.alive = true;
  player.health = 30;
  player.gold = 3;
  player.tavernTier = 4;
  player.board = Array.from({ length: 7 }, (_, index) =>
    definitionMinion(template, "BG20_301", `full-board-${index}`, {
      attack: 2 + index,
      health: 3 + index,
    }),
  );
  const originalBoardIds = new Set(
    player.board.map((minion) => minion.instanceId),
  );
  player.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(template, "BG28_300", `locked-hand-${index}`, {
      attack: 1,
      health: 1,
      playableFromRound: state.round + 1,
    }),
  );
  player.shop = [
    definitionMinion(template, "BG_TTN_401", "unbuyable-upgrade", {
      attack: 50,
      health: 50,
    }),
  ];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const afterRecruit = playerById(
    gameReducer(state, { type: "END_TURN" }),
    player.id,
  );

  assert.equal(afterRecruit.board.length, 7);
  assert.ok(
    afterRecruit.board.every((minion) =>
      originalBoardIds.has(minion.instanceId),
    ),
  );
  assert.equal(afterRecruit.frozen, true);
});

test("AI positioning scouts only its own previous matchup snapshot", () => {
  const state = createGame(10_010);
  isolateAiLobby(state, "player-7");
  const player = playerById(state, "player-7");
  const human = playerById(state, state.humanPlayerId);
  const template = player.shop[0];
  assert.ok(template);
  player.gold = 0;
  player.board = [
    definitionMinion(template, "BG20_301", "first-ai-board", {
      attack: 1,
      health: 10,
    }),
  ];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  human.board = [
    definitionMinion(template, "cave-hydra", "observed-cleave", {
      attack: 1,
      health: 10,
      cleave: true,
    }),
  ];

  const priorCombat = gameReducer(state, { type: "END_TURN" });
  const nextRecruit = gameReducer(priorCombat, { type: "CONTINUE" });
  assert.ok(nextRecruit.lastRoundBattles.length > 0);
  const nextPlayer = playerById(nextRecruit, "player-7");
  const nextHuman = playerById(nextRecruit, nextRecruit.humanPlayerId);
  nextPlayer.gold = 0;
  nextPlayer.hand = [];
  nextPlayer.shop = [];
  nextPlayer.spellShop = null;
  nextPlayer.additionalSpellShop = [];
  nextPlayer.board = [
    definitionMinion(template, "titus-rivendare", "scouted-support"),
    definitionMinion(template, "BG20_301", "scouted-taunt", {
      attack: 12,
      health: 12,
      taunt: true,
    }),
    definitionMinion(template, "BG28_300", "scouted-deathrattle"),
    definitionMinion(template, "BG20_301", "scouted-attacker", {
      attack: 10,
      health: 10,
    }),
    definitionMinion(template, "BG20_301", "scouted-buffer", {
      attack: 1,
      health: 1,
    }),
  ];
  nextHuman.board = [
    definitionMinion(template, "BG20_301", "current-hidden-board", {
      attack: 0,
      health: 100,
      cleave: false,
    }),
  ];

  const nextCombat = gameReducer(nextRecruit, { type: "END_TURN" });
  const matchup = nextCombat.lastRoundBattles.find(
    (battle) =>
      battle.playerAId === nextPlayer.id ||
      battle.playerBId === nextPlayer.id,
  );
  assert.ok(matchup);
  const plannedOrder = matchup.initialBoards[nextPlayer.id].map(
    (minion) => minion.instanceId,
  );
  const tauntIndex = plannedOrder.indexOf("scouted-taunt");
  assert.equal(plannedOrder[tauntIndex - 1], "scouted-buffer");
});
