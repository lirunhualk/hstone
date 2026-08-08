import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_POLICY_VERSION,
  getAiStrategyProfile,
} from "../lib/game/ai.ts";
import {
  hasAiResidualPolicyOverride,
  isAiResidualForbiddenContextKey,
  withAiResidualPolicyOverrides,
  type AiResidualMacroContext,
  type AiResidualPolicy,
  type DeepReadonly,
} from "../lib/game/ai-residual-policy.ts";
import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getUpgradeCost,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { runAiBenchmark } from "../scripts/benchmark-ai.ts";

function playerById(state: GameState, playerId: string): PlayerState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  assert.ok(player, `expected ${playerId}`);
  return player;
}

function isolateAiLobby(state: GameState, activeAiId: string): PlayerState {
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
  return playerById(state, activeAiId);
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

function lockedHand(
  template: BoardMinionInstance,
  round: number,
  count: number,
): BoardMinionInstance[] {
  return Array.from({ length: count }, (_, index) =>
    clonedMinion(template, `residual-locked-hand-${index}`, {
      golden: true,
      playableFromRound: round + 1,
    }),
  );
}

function policy(
  propose: AiResidualPolicy["propose"],
): AiResidualPolicy {
  return {
    policyId: "engine-residual-test",
    policyVersion: "test-v1",
    propose,
  };
}

test("an abstaining controlled-seat residual is byte-identical to legacy", () => {
  const initial = createGame(45_001);
  const snapshot = JSON.stringify(initial);
  const baseline = gameReducer(initial, { type: "END_TURN" });
  const contexts: Array<DeepReadonly<AiResidualMacroContext>> = [];

  const candidate = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        policy((context) => {
          assert.equal(hasAiResidualPolicyOverride("player-1"), true);
          assert.equal(hasAiResidualPolicyOverride("player-2"), false);
          assert.ok(Object.isFrozen(context));
          assert.ok(Object.isFrozen(context.legalChoices));
          assert.equal(context.contentVersion, CURRENT_ROSTER_VERSION);
          assert.equal(context.policyVersion, AI_POLICY_VERSION);
          contexts.push(context);
          return null;
        }),
      ],
    ]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  assert.equal(JSON.stringify(initial), snapshot);
  assert.deepEqual(candidate.result, baseline);
  assert.ok(contexts.length > 0);
  assert.equal(candidate.diagnostics.providerCalls, contexts.length);
  assert.equal(candidate.diagnostics.abstentions, contexts.length);
  assert.equal(candidate.diagnostics.noProvider, 0);
  for (const context of contexts) {
    const walk = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      for (const [key, nested] of Object.entries(value)) {
        assert.equal(isAiResidualForbiddenContextKey(key), false, key);
        walk(nested);
      }
    };
    walk(context);
  }
});

test("a high-confidence upgrade override uses the canonical upgrade mutation", () => {
  const initial = createGame(45_002);
  initial.round = 1;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.tavernTier = 1;
  player.gold = getUpgradeCost(initial, player.id);
  player.board = [];
  player.hand = lockedHand(template, initial.round, 10);
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  const baseline = gameReducer(initial, { type: "END_TURN" });
  assert.equal(playerById(baseline, player.id).tavernTier, 1);

  const upgradeContexts: Array<
    Extract<AiResidualMacroContext, { kind: "upgrade" }>
  > = [];
  const candidate = withAiResidualPolicyOverrides(
    new Map([
      [
        player.id,
        policy((context) => {
          if (context.kind !== "upgrade") return null;
          upgradeContexts.push(context as typeof upgradeContexts[number]);
          if (context.checkpoint !== "opening") return null;
          assert.equal(context.legacyChoice, "deferUpgrade");
          assert.ok(context.legalChoices.includes("upgradeNow"));
          return {
            kind: "upgrade",
            choice: "upgradeNow",
            confidence: 1,
            reasonCode: "test-open-upgrade",
          };
        }),
      ],
    ]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.equal(recruited.tavernTier, 2);
  assert.equal(recruited.gold, 0);
  assert.equal(candidate.result.rngState, baseline.rngState);
  assert.equal(candidate.result.nextInstanceId, baseline.nextInstanceId);
  assert.equal(candidate.diagnostics.overridesApplied, 1);
  assert.equal(candidate.diagnostics.byKind.upgrade.overridesApplied, 1);
  assert.equal(upgradeContexts[0]?.checkpoint, "opening");
});

test("refresh overrides execute once, observe the result, and re-decide", () => {
  const initial = createGame(45_003);
  initial.round = 8;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.tavernTier = 6;
  player.gold = 2;
  player.hand = [];
  player.board = Array.from({ length: 7 }, (_, index) =>
    clonedMinion(template, `residual-refresh-board-${index}`, {
      attack: 100,
      health: 100,
      golden: true,
    }),
  );
  player.spellShop = null;
  player.additionalSpellShop = [];
  const baseline = gameReducer(initial, { type: "END_TURN" });
  assert.equal(playerById(baseline, player.id).gold, 2);

  const refreshes: number[] = [];
  const candidate = withAiResidualPolicyOverrides(
    new Map([
      [
        player.id,
        policy((context) => {
          if (context.kind !== "refresh") return null;
          refreshes.push(context.refreshesThisTurn);
          if (context.refreshesThisTurn === 0) {
            assert.equal(context.legacyChoice, "stopRefreshing");
            assert.equal(context.canBuyAfterRefresh, false);
            assert.equal(context.canSpeculativelyRefresh, false);
            return {
              kind: "refresh",
              choice: "refreshOnce",
              confidence: 1,
              reasonCode: "test-two-gold-search",
            };
          }
          return {
            kind: "refresh",
            choice: "stopRefreshing",
            confidence: 1,
            reasonCode: "test-stop-after-result",
          };
        }),
      ],
    ]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.deepEqual(refreshes, [0, 1]);
  assert.equal(recruited.gold, 1);
  assert.notEqual(candidate.result.rngState, baseline.rngState);
  assert.equal(candidate.diagnostics.byKind.refresh.overridesApplied, 1);
  assert.equal(candidate.diagnostics.agreements, 1);
});

test("a freeze override changes only the controlled seat's frozen field", () => {
  const initial = createGame(45_004);
  initial.round = 8;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.tavernTier = 6;
  player.gold = 0;
  player.board = [];
  player.hand = lockedHand(template, initial.round, 10);
  player.shop = [
    clonedMinion(template, "residual-freeze-offer", {
      attack: 100,
      health: 100,
    }),
  ];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const baseline = gameReducer(initial, { type: "END_TURN" });
  assert.equal(playerById(baseline, player.id).frozen, true);
  const candidate = withAiResidualPolicyOverrides(
    new Map([
      [
        player.id,
        policy((context) => {
          if (context.kind !== "freeze") return null;
          assert.equal(context.legacyChoice, "freeze");
          assert.equal(context.freezeMinionReason, true);
          return {
            kind: "freeze",
            choice: "unfreeze",
            confidence: 1,
            reasonCode: "test-decline-freeze",
          };
        }),
      ],
    ]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  assert.equal(playerById(candidate.result, player.id).frozen, false);
  const normalized = structuredClone(candidate.result);
  playerById(normalized, player.id).frozen = true;
  assert.deepEqual(normalized, baseline);
  assert.equal(candidate.diagnostics.overridesApplied, 1);
  assert.equal(candidate.diagnostics.byKind.freeze.overridesApplied, 1);
});

test("an empty residual-policy scope is benchmark-equivalent to legacy play", () => {
  const options = {
    seeds: 1,
    startSeed: 20_260_801,
    maxRounds: 1,
    includeGames: true,
  };

  const direct = runAiBenchmark(options);
  const scoped = withAiResidualPolicyOverrides(new Map(), () =>
    runAiBenchmark(options),
  );

  assert.deepEqual(scoped.result, direct);
  assert.deepEqual(scoped.diagnostics, {
    decisions: 0,
    providerCalls: 0,
    overridesApplied: 0,
    fallbacks: 0,
    noProvider: 0,
    abstentions: 0,
    lowConfidence: 0,
    invalidContexts: 0,
    invalidProposals: 0,
    providerErrors: 0,
    asyncProposals: 0,
    agreements: 0,
    byKind: {
      upgrade: { decisions: 0, overridesApplied: 0 },
      refresh: { decisions: 0, overridesApplied: 0 },
      freeze: { decisions: 0, overridesApplied: 0 },
    },
  });
});

test("AI never kills itself with the tavern-steal damage hero power", () => {
  const initial = createGame(45_005);
  initial.round = 12;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.heroPowerId = "hero-power-tb_baconshop_hp_049";
  player.health = 1;
  player.armor = 0;
  player.tavernTier = 6;
  player.gold = 2;
  player.board = Array.from({ length: 7 }, (_, index) =>
    clonedMinion(template, `safe-self-damage-board-${index}`, {
      attack: 100,
      health: 100,
      golden: true,
    }),
  );
  player.hand = lockedHand(template, initial.round, 9);
  player.shop = [clonedMinion(template, "safe-self-damage-offer")];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const contexts: Array<DeepReadonly<AiResidualMacroContext>> = [];
  const candidate = withAiResidualPolicyOverrides(
    new Map([
      [
        player.id,
        policy((context) => {
          contexts.push(context);
          return null;
        }),
      ],
    ]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.equal(recruited.alive, true);
  assert.equal(recruited.health, 1);
  assert.equal(recruited.heroPowerActiveThisTurn, false);
  assert.equal(recruited.hand.length, 9);
  assert.ok(contexts.length > 0);
  assert.ok(contexts.every((context) => context.health > 0));
  assert.equal(candidate.diagnostics.invalidContexts, 0);
});

test("AI holds a minion whose recruit damage would cross its health floor", () => {
  const initial = createGame(45_006);
  initial.round = 12;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.heroPowerId = null;
  player.health = 1;
  player.armor = 0;
  player.tavernTier = 6;
  player.gold = 0;
  player.board = [
    clonedMinion(template, "safe-recruit-damage-watcher", {
      definitionId: "wrath-weaver",
      tribe: "demon",
      tribes: ["demon"],
      attack: 1,
      health: 3,
    }),
  ];
  player.hand = [
    clonedMinion(template, "unsafe-recruit-damage-minion", {
      definitionId: "vulgar-homunculus",
      tribe: "demon",
      tribes: ["demon"],
      attack: 2,
      health: 4,
    }),
  ];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const candidate = withAiResidualPolicyOverrides(
    new Map([[player.id, policy(() => null)]]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.equal(recruited.alive, true);
  assert.equal(recruited.health, 1);
  assert.ok(
    recruited.hand.some(
      (card) => card.instanceId === "unsafe-recruit-damage-minion",
    ),
  );
  assert.equal(candidate.diagnostics.invalidContexts, 0);
});

test("all seven AI profiles enforce both sides of their recruit-damage floor", () => {
  for (let seat = 1; seat <= 7; seat += 1) {
    const playerId = `player-${seat}`;
    const floor = getAiStrategyProfile(playerId).healthSpendFloor;
    for (const [label, health, shouldPlay] of [
      ["below", floor + 1, false],
      ["exact", floor + 2, true],
    ] as const) {
      const initial = createGame(46_000 + seat * 10 + Number(shouldPlay));
      initial.round = 12;
      const player = isolateAiLobby(initial, playerId);
      const template = player.shop[0];
      assert.ok(template);
      player.heroPowerId = null;
      player.health = health;
      player.armor = 0;
      player.tavernTier = 6;
      player.gold = 0;
      player.board = [];
      const instanceId = `profile-${seat}-${label}-floor-minion`;
      player.hand = [
        clonedMinion(template, instanceId, {
          definitionId: "vulgar-homunculus",
          tribe: "demon",
          tribes: ["demon"],
          attack: 2,
          health: 4,
        }),
      ];
      player.shop = [];
      player.spellShop = null;
      player.additionalSpellShop = [];

      const recruited = playerById(
        gameReducer(initial, { type: "END_TURN" }),
        playerId,
      );
      assert.equal(
        recruited.hand.some((card) => card.instanceId === instanceId),
        !shouldPlay,
        `${playerId} must ${shouldPlay ? "play at" : "hold below"} floor ${floor}`,
      );
      assert.equal(
        recruited.board.some((minion) => minion.instanceId === instanceId),
        shouldPlay,
        `${playerId} board result at ${label} boundary`,
      );
      assert.equal(
        recruited.health,
        shouldPlay ? floor : health,
        `${playerId} health result at ${label} boundary`,
      );
    }
  }
});

test("AI still plays a self-damaging minion when Soul Rewinder restores it", () => {
  const initial = createGame(45_007);
  initial.round = 12;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.heroPowerId = null;
  player.health = 1;
  player.armor = 0;
  player.tavernTier = 6;
  player.gold = 0;
  player.board = [
    clonedMinion(template, "safe-soul-rewinder", {
      definitionId: "BG26_174",
      tribe: "demon",
      tribes: ["demon"],
      attack: 3,
      health: 6,
    }),
  ];
  player.hand = [
    clonedMinion(template, "rewound-self-damage-minion", {
      definitionId: "vulgar-homunculus",
      tribe: "demon",
      tribes: ["demon"],
      attack: 2,
      health: 4,
    }),
  ];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const candidate = withAiResidualPolicyOverrides(
    new Map([[player.id, policy(() => null)]]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.equal(recruited.alive, true);
  assert.equal(recruited.health, 1);
  assert.equal(recruited.hand.length, 0);
  assert.ok(
    recruited.board.some(
      (minion) => minion.instanceId === "rewound-self-damage-minion",
    ),
  );
  assert.equal(candidate.diagnostics.invalidContexts, 0);
});

test("AI projects Golden battlecry self-damage with the engine's real amount", () => {
  const initial = createGame(45_009);
  initial.round = 12;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.heroPowerId = null;
  player.health = 11;
  player.armor = 0;
  player.tavernTier = 6;
  player.gold = 0;
  player.board = [];
  player.hand = [
    clonedMinion(template, "safe-golden-battlecry-damage-minion", {
      definitionId: "vulgar-homunculus",
      tribe: "demon",
      tribes: ["demon"],
      attack: 4,
      health: 8,
      golden: true,
    }),
  ];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const candidate = withAiResidualPolicyOverrides(
    new Map([[player.id, policy(() => null)]]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.equal(recruited.alive, true);
  assert.equal(recruited.health, 9);
  assert.equal(recruited.hand.length, 0);
  assert.ok(
    recruited.board.some(
      (minion) =>
        minion.instanceId === "safe-golden-battlecry-damage-minion",
    ),
  );
  assert.equal(candidate.diagnostics.invalidContexts, 0);
});

test("AI holds a Discover minion whose selected tier could cause lethal damage", () => {
  const initial = createGame(45_008);
  initial.round = 12;
  const player = isolateAiLobby(initial, "player-1");
  const template = player.shop[0];
  assert.ok(template);
  player.heroPowerId = null;
  player.health = 1;
  player.armor = 0;
  player.tavernTier = 6;
  player.gold = 0;
  player.board = [
    clonedMinion(template, "safe-discover-damage-board", {
      definitionId: "scallywag",
      tribe: "pirate",
      tribes: ["pirate"],
      attack: 100,
      health: 100,
    }),
  ];
  player.hand = [
    clonedMinion(template, "unsafe-discover-damage-minion", {
      definitionId: "BG26_525",
      tribe: "demon",
      tribes: ["demon"],
    }),
  ];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];

  const candidate = withAiResidualPolicyOverrides(
    new Map([[player.id, policy(() => null)]]),
    () => gameReducer(initial, { type: "END_TURN" }),
  );

  const recruited = playerById(candidate.result, player.id);
  assert.equal(recruited.alive, true);
  assert.equal(recruited.health, 1);
  assert.ok(
    recruited.hand.some(
      (card) => card.instanceId === "unsafe-discover-damage-minion",
    ),
  );
  assert.equal(candidate.diagnostics.invalidContexts, 0);
});
