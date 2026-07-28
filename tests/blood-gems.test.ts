import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_5_CONTENT_VERSION,
  migrateSchema5GameState,
} from "../lib/game/save.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
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
    kind: "minion",
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
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function bloodGems(player: PlayerState): BloodGemSpellInstance[] {
  return player.hand.filter(
    (card): card is BloodGemSpellInstance => card.kind === "bloodGem",
  );
}

test("Razorfen Geomancer generates the live normal, Golden, and Brann quantities", () => {
  const cases = [
    { golden: false, brann: false, expected: 2 },
    { golden: true, brann: false, expected: 4 },
    { golden: false, brann: true, expected: 4 },
    { golden: true, brann: true, expected: 8 },
  ] as const;

  for (const [index, scenario] of cases.entries()) {
    let state = createGame(0xb100 + index);
    const player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    player.board = scenario.brann
      ? [definitionMinion(template, "BG_LOE_077", `brann-${index}`)]
      : [];
    player.hand = [
      definitionMinion(
        template,
        "BG20_100",
        `geomancer-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG20_100").attack * 2,
              health: getMinionDefinition("BG20_100").health * 2,
            }
          : {},
      ),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `geomancer-${index}`,
    });

    const generated = bloodGems(humanPlayer(state));
    assert.equal(
      generated.length,
      scenario.expected,
      `${scenario.golden ? "Golden" : "normal"} Geomancer${
        scenario.brann ? " with Brann" : ""
      } generated the wrong number of Blood Gems`,
    );
    assert.ok(
      generated.every(
        (gem) =>
          gem.cardId === "BG20_GEM" &&
          gem.definitionId === "blood-gem" &&
          gem.spellFamily === "bloodGem",
      ),
    );
    assert.equal(
      new Set(generated.map((gem) => gem.instanceId)).size,
      generated.length,
    );
  }
});

test("Blood Gem generation stops at the ten-card hand limit", () => {
  let state = createGame(0xb110);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const fillerDefinition = getMinionDefinition("BG25_001");
  player.hand = [
    ...Array.from({ length: 9 }, (_, index) =>
      definitionMinion(
        template,
        fillerDefinition.id,
        `hand-filler-${index}`,
        {
          golden: true,
          attack: fillerDefinition.attack * 2,
          health: fillerDefinition.health * 2,
        },
      ),
    ),
    definitionMinion(template, "BG20_100", "limit-geomancer"),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "limit-geomancer",
  });

  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(bloodGems(nextPlayer).length, 1);
  assert.equal(
    nextPlayer.hand.filter((card) => card.kind === "minion").length,
    9,
  );
});

test("a full hand reserves the played Golden minion's Triple Reward before Blood Gems", () => {
  let state = createGame(0xb115);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const fillerDefinition = getMinionDefinition("BG25_001");
  player.hand = [
    ...Array.from({ length: 9 }, (_, index) =>
      definitionMinion(
        template,
        fillerDefinition.id,
        `reward-filler-${index}`,
        {
          golden: true,
          attack: fillerDefinition.attack * 2,
          health: fillerDefinition.health * 2,
        },
      ),
    ),
    definitionMinion(
      template,
      "BG20_100",
      "golden-reward-geomancer",
      {
        golden: true,
        attack: getMinionDefinition("BG20_100").attack * 2,
        health: getMinionDefinition("BG20_100").health * 2,
        grantsTripleReward: true,
      },
    ),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "golden-reward-geomancer",
  });

  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(bloodGems(nextPlayer).length, 0);
  assert.equal(
    nextPlayer.hand.filter((card) => card.kind === "tripleReward")
      .length,
    1,
  );
  assert.equal(nextPlayer.board[0]?.grantsTripleReward, false);
});

test("an existing Blood Gem reads Jazzer's current upgrade and casts only on a friendly minion", () => {
  let state = createGame(0xb120);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG25_001",
    "blood-gem-target",
    { attack: 5, health: 7 },
  );
  player.board = [target];
  player.hand = [
    definitionMinion(template, "BG20_100", "old-gem-geomancer"),
    definitionMinion(template, "BG26_159", "jazzer"),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "old-gem-geomancer",
  });
  player = humanPlayer(state);
  const oldGem = bloodGems(player)[0];
  assert.ok(oldGem);
  assert.equal(player.bloodGemAttack, 1);
  assert.equal(player.bloodGemHealth, 1);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "jazzer",
  });
  player = humanPlayer(state);
  assert.equal(player.bloodGemAttack, 1);
  assert.equal(player.bloodGemHealth, 2);
  player.tavernSpellsCastThisTurn = 3;

  const remainingGem = bloodGems(player).find(
    (gem) => gem.instanceId !== oldGem.instanceId,
  );
  assert.ok(remainingGem);
  const invalidTarget = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: remainingGem.instanceId,
    targetInstanceId: "missing-friendly-target",
  });
  assert.deepEqual(invalidTarget, state);

  const opponent = state.players.find(
    (candidate) => candidate.id !== state.humanPlayerId,
  );
  assert.ok(opponent);
  opponent.board = [
    definitionMinion(
      template,
      "BG25_001",
      "opponent-blood-gem-target",
    ),
  ];
  const enemyTarget = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: remainingGem.instanceId,
    targetInstanceId: "opponent-blood-gem-target",
  });
  assert.deepEqual(enemyTarget, state);

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: oldGem.instanceId,
    targetInstanceId: "blood-gem-target",
  });
  player = humanPlayer(state);
  const buffed = player.board.find(
    (minion) => minion.instanceId === "blood-gem-target",
  );
  assert.ok(buffed);
  assert.equal(buffed.attack, 6);
  assert.equal(buffed.health, 9);
  assert.equal(
    player.hand.some((card) => card.instanceId === oldGem.instanceId),
    false,
  );
  assert.equal(
    player.hand.some((card) => card.instanceId === remainingGem.instanceId),
    true,
  );
  assert.equal(player.tavernSpellsCastThisTurn, 3);
});

test("selling Sun-Bacon Relaxer grants gold plus two or four Blood Gems", () => {
  const cases = [
    { golden: false, expected: 2 },
    { golden: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of cases.entries()) {
    let state = createGame(0xb130 + index);
    const player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const definition = getMinionDefinition("BG20_301");
    player.gold = 0;
    player.board = [
      definitionMinion(
        template,
        definition.id,
        `sun-bacon-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: definition.attack * 2,
              health: definition.health * 2,
            }
          : {},
      ),
    ];
    player.hand = [];

    state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
    const soldPlayer = humanPlayer(state);
    assert.equal(soldPlayer.board.length, 0);
    assert.equal(soldPlayer.gold, 1);
    assert.equal(bloodGems(soldPlayer).length, scenario.expected);
  }
});

test("Prophet of the Boar triggers only after a Quilboar is played and doubles while Golden", () => {
  const cases = [
    { golden: false, expected: 1 },
    { golden: true, expected: 2 },
  ] as const;

  for (const [index, scenario] of cases.entries()) {
    let state = createGame(0xb140 + index);
    let player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const prophet = getMinionDefinition("BG20_203");
    player.board = [
      definitionMinion(
        template,
        prophet.id,
        `prophet-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: prophet.attack * 2,
              health: prophet.health * 2,
            }
          : {},
      ),
    ];
    player.hand = [
      definitionMinion(template, "BG25_001", `non-quilboar-${index}`),
      definitionMinion(template, "BG20_301", `played-quilboar-${index}`),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `non-quilboar-${index}`,
    });
    assert.equal(bloodGems(humanPlayer(state)).length, 0);

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `played-quilboar-${index}`,
    });
    player = humanPlayer(state);
    assert.equal(bloodGems(player).length, scenario.expected);
  }
});

test("AI uses generated Blood Gems through the same recruit rules", () => {
  const state = createGame(0xb150);
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  for (const player of state.players) {
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.frozen = false;
  }
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  ai.board = [
    definitionMinion(template, "BG25_001", "ai-blood-gem-target", {
      attack: 5,
      health: 7,
    }),
  ];
  ai.hand = [
    definitionMinion(template, "BG20_100", "ai-geomancer"),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const recruitedAi = combat.players.find(
    (player) => player.id === ai.id,
  );
  assert.ok(recruitedAi);
  assert.equal(recruitedAi.board.length, 2);
  assert.equal(bloodGems(recruitedAi).length, 0);
  assert.equal(
    recruitedAi.board.reduce((total, minion) => total + minion.attack, 0),
    9,
  );
  assert.equal(
    recruitedAi.board.reduce((total, minion) => total + minion.health, 0),
    10,
  );
  assert.equal(recruitedAi.tavernSpellsCastThisTurn, 0);
});

test("schema 5 saves migrate Blood Gem values without losing the current run", () => {
  const state = createGame(0xb160);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG20_100", "legacy-geomancer", {
      effectSupport: "partial",
    }),
  ];
  state.pendingInteraction = {
    kind: "discover",
    interactionId: "legacy-discover",
    playerId: player.id,
    sourceInstanceId: "legacy-geomancer",
    options: [
      definitionMinion(
        template,
        "BG20_100",
        "legacy-discover-geomancer",
        { effectSupport: "partial" },
      ),
    ],
    filter: { exactTier: 1 },
    remainingDiscoveries: 1,
    destination: { kind: "hand" },
  };
  player.gold = 7;

  const legacy = JSON.parse(JSON.stringify(state)) as {
    version: number;
    contentVersion: string;
    players: Array<Record<string, unknown>>;
  };
  legacy.version = 5;
  legacy.contentVersion = LEGACY_SCHEMA_5_CONTENT_VERSION;
  for (const legacyPlayer of legacy.players) {
    delete legacyPlayer.bloodGemAttack;
    delete legacyPlayer.bloodGemHealth;
  }

  const migrated = migrateSchema5GameState(legacy) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.version, 6);
  assert.equal(humanPlayer(migrated).gold, 7);
  assert.equal(humanPlayer(migrated).bloodGemAttack, 1);
  assert.equal(humanPlayer(migrated).bloodGemHealth, 1);
  assert.equal(
    humanPlayer(migrated).board[0].effectSupport,
    "complete",
  );
  assert.equal(
    migrated.pendingInteraction?.kind === "discover"
      ? migrated.pendingInteraction.options[0]?.effectSupport
      : null,
    "complete",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(migrated)),
    migrated,
  );
  assert.equal(migrateSchema5GameState({ version: 4 }), null);
});
