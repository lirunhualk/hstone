import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
  type TavernTier,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function definitionMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
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
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function bloodGem(instanceId: string): BloodGemSpellInstance {
  return {
    kind: "bloodGem",
    instanceId,
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  };
}

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

function sickRiffsInHand(player: PlayerState): SpellcraftSpellInstance[] {
  return player.hand.filter(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft" &&
      card.definitionId === "spellcraft-sick-riffs",
  );
}

function pointyArrowsInHand(player: PlayerState): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell" &&
      card.definitionId === "tavern-spell-pointy-arrow",
  );
}

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[],
): PlayerState {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.health = 100;
    if (player.id === opponent.id) {
      player.alive = true;
      player.hand = [];
      player.board = opponentBoard;
    } else if (!player.isHuman) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
  return opponent;
}

function continueAfterCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function handStatsById(
  player: PlayerState,
): Map<string, readonly [number, number]> {
  return new Map(
    minionsInHand(player).map((minion) => [
      minion.instanceId,
      [minion.attack, minion.health] as const,
    ]),
  );
}

const COMPLETE_TIER_TWO_CARD_IDS = [
  "BG21_018",
  "BG26_501",
  "BG29_300",
  "BG32_170",
] as const;

test("the Tier 2 batch is explicitly marked complete", () => {
  for (const definitionId of COMPLETE_TIER_TWO_CARD_IDS) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
      `${definitionId} must not advertise full support before its whole text works`,
    );
  }
  assert.deepEqual(getMinionDefinition("BG21_018").afterSelfGainsAttack, {
    health: 1,
    goldenMode: "repeat",
  });
  assert.equal(
    getMinionDefinition("BG21_018").goldenDescription,
    "每当本随从通过其他来源获得攻击力时，获得+1生命值，触发两次。",
  );
});

test("挑衅的船工每次从其他来源获得攻击力时获得生命值，金色触发两次", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xf1f0 + index);
    let player = humanPlayer(state);
    const swabbie = definitionMinion("BG21_018", `deck-swabbie-${golden}`, {
      golden,
      attack: golden ? 4 : 2,
      health: golden ? 10 : 5,
    });
    player.board = [swabbie];
    player.hand = [
      tavernSpell("tavern-spell-pointy-arrow", `swabbie-arrow-a-${golden}`),
      tavernSpell("tavern-spell-pointy-arrow", `swabbie-arrow-b-${golden}`),
      tavernSpell("tavern-spell-fortify", `swabbie-fortify-${golden}`),
    ];

    for (const cardInstanceId of [
      `swabbie-arrow-a-${golden}`,
      `swabbie-arrow-b-${golden}`,
      `swabbie-fortify-${golden}`,
    ]) {
      state = gameReducer(state, {
        type: "CAST_TAVERN_SPELL",
        cardInstanceId,
        targetInstanceId: swabbie.instanceId,
      });
    }

    player = humanPlayer(state);
    const buffed = player.board.find(
      (minion) => minion.instanceId === swabbie.instanceId,
    );
    assert.ok(buffed);
    assert.deepEqual(
      [buffed.attack, buffed.health],
      golden ? [12, 17] : [10, 10],
    );
  }
});

test("挑衅的船工会响应鲜血宝石的混合增益且每颗只触发一次", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xf1f2 + index);
    let player = humanPlayer(state);
    const swabbie = definitionMinion("BG21_018", `gem-swabbie-${golden}`, {
      golden,
      attack: golden ? 4 : 2,
      health: golden ? 10 : 5,
    });
    player.board = [swabbie];
    player.hand = [bloodGem(`swabbie-gem-${golden}`)];

    state = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: `swabbie-gem-${golden}`,
      targetInstanceId: swabbie.instanceId,
    });
    player = humanPlayer(state);
    const buffed = player.board.find(
      (minion) => minion.instanceId === swabbie.instanceId,
    );
    assert.ok(buffed);
    assert.deepEqual(
      [buffed.attack, buffed.health],
      golden ? [5, 13] : [3, 7],
    );
  }
});

test("鲍勃酒馆里的挑衅的船工被加攻时也会触发生命值", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xf1f4 + index);
    let player = humanPlayer(state);
    const swabbie = definitionMinion("BG21_018", `shop-swabbie-${golden}`, {
      golden,
      attack: golden ? 4 : 2,
      health: golden ? 10 : 5,
    });
    player.board = [];
    player.shop = [swabbie];
    player.hand = [
      tavernSpell("tavern-spell-pointy-arrow", `shop-arrow-${golden}`),
    ];

    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `shop-arrow-${golden}`,
      targetInstanceId: swabbie.instanceId,
    });
    player = humanPlayer(state);
    const buffed = player.shop.find(
      (minion) => minion.instanceId === swabbie.instanceId,
    );
    assert.ok(buffed);
    assert.deepEqual(
      [buffed.attack, buffed.health],
      golden ? [8, 12] : [6, 6],
    );
  }
});

test("金色时空船长钩尾的两次加攻会让挑衅的船工触发两次", () => {
  let state = createGame(0xf1f6);
  let player = humanPlayer(state);
  const swabbie = definitionMinion("BG21_018", "hooktail-swabbie");
  const hooktail = definitionMinion("BG27_005", "golden-hooktail", {
    golden: true,
    attack: getMinionDefinition("BG27_005").attack * 2,
    health: getMinionDefinition("BG27_005").health * 2,
  });
  player.board = [swabbie, hooktail];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "hooktail-trigger-spell"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "hooktail-trigger-spell",
    targetInstanceId: hooktail.instanceId,
  });
  player = humanPlayer(state);
  const buffed = player.board.find(
    (minion) => minion.instanceId === swabbie.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual([buffed.attack, buffed.health], [4, 7]);
});

test("重复的回合结束加攻会逐次触发挑衅的船工", () => {
  let state = createGame(0xf1f7);
  const player = humanPlayer(state);
  const swabbie = definitionMinion("BG21_018", "repeated-eot-swabbie");
  player.board = [
    swabbie,
    definitionMinion("BG35_701", "repeated-eot-pirate"),
  ];
  player.cardsPlayedThisTurn = 2;
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "repeated-eot-wall", {
      attack: 0,
      health: 100,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  const buffed = humanPlayer(state).board.find(
    (minion) => minion.instanceId === swabbie.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual([buffed.attack, buffed.health], [8, 17]);
});

test("挑衅的船工的战斗攻击增益会触发生命值且不会写回招募阶段", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xf1f4 + index);
    const player = humanPlayer(state);
    const swabbie = definitionMinion("BG21_018", `combat-swabbie-${golden}`, {
      golden,
      attack: golden ? 4 : 2,
      health: golden ? 10 : 5,
    });
    player.board = [swabbie];
    player.nextCombatAttackBonus = 1;
    player.nextCombatDoubleLeftmostAttack = [{ attack: 0, health: 0 }];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `combat-swabbie-wall-${golden}`, {
        attack: 1,
        health: 30,
      }),
    ]);

    state = gameReducer(state, { type: "END_TURN" });
    const initial = state.lastBattle?.initialBoards[state.humanPlayerId]?.find(
      (minion) => minion.instanceId === swabbie.instanceId,
    );
    assert.ok(initial);
    assert.deepEqual(
      [initial.attack, initial.health],
      golden ? [4, 10] : [2, 5],
    );
    const combatBuff = state.lastBattle?.events.find(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === swabbie.instanceId &&
        event.message.includes("转瞬活力"),
    );
    assert.ok(combatBuff?.minion);
    assert.deepEqual(
      [
        combatBuff.attackDelta,
        combatBuff.healthDelta,
        combatBuff.minion.attack,
        combatBuff.minion.health,
      ],
      golden ? [1, 2, 5, 12] : [1, 1, 3, 6],
    );
    const doubled = state.lastBattle?.events.find(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === swabbie.instanceId &&
        event.message.includes("诺兹多姆的子嗣"),
    );
    assert.ok(doubled?.minion);
    assert.deepEqual(
      [
        doubled.attackDelta,
        doubled.healthDelta,
        doubled.minion.attack,
        doubled.minion.health,
      ],
      golden ? [5, 2, 10, 14] : [3, 1, 6, 7],
    );

    state = gameReducer(state, { type: "CONTINUE" });
    const persistent = humanPlayer(state).board.find(
      (minion) => minion.instanceId === swabbie.instanceId,
    );
    assert.ok(persistent);
    assert.deepEqual(
      [persistent.attack, persistent.health],
      golden ? [4, 10] : [2, 5],
    );
  }
});

test("Stormy Guitarist grants exactly one Sick Riffs now and each turn, with Golden scaling", () => {
  const scenarios = [
    {
      golden: false,
      tier: 3 as TavernTier,
      expectedBonus: 3,
      expectedCardId: "BG26_501t",
    },
    {
      golden: true,
      tier: 4 as TavernTier,
      expectedBonus: 8,
      expectedCardId: "BG26_501_Gt",
    },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0xf200 + index);
    let player = humanPlayer(state);
    player.tavernTier = scenario.tier;
    const target = definitionMinion(
      "BG35_801",
      `guitarist-target-${index}`,
      { attack: 5, health: 7 },
    );
    player.board = [target];
    player.hand = [
      definitionMinion(
        "BG26_501",
        `guitarist-${index}`,
        scenario.golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG26_501").attack * 2,
              health: getMinionDefinition("BG26_501").health * 2,
            }
          : {},
      ),
    ];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `guitarist-enemy-${index}`, {
        attack: 0,
        health: 100_000,
      }),
    ]);

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `guitarist-${index}`,
    });
    player = humanPlayer(state);
    let riffs = sickRiffsInHand(player);
    assert.equal(riffs.length, 1);
    assert.equal(riffs[0].cardId, scenario.expectedCardId);

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: riffs[0].instanceId,
      targetInstanceId: target.instanceId,
    });
    player = humanPlayer(state);
    let buffed = player.board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(buffed);
    assert.deepEqual(
      [
        buffed.attack,
        buffed.health,
        buffed.temporaryAttack,
        buffed.temporaryHealth,
      ],
      [
        5 + scenario.expectedBonus,
        7 + scenario.expectedBonus,
        scenario.expectedBonus,
        scenario.expectedBonus,
      ],
    );

    state = continueAfterCombat(state);
    player = humanPlayer(state);
    buffed = player.board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(buffed);
    assert.deepEqual(
      [
        buffed.attack,
        buffed.health,
        buffed.temporaryAttack,
        buffed.temporaryHealth,
      ],
      [5, 7, 0, 0],
      "the previous turn's temporary stats must expire",
    );

    riffs = sickRiffsInHand(player);
    assert.equal(
      riffs.length,
      1,
      "Golden changes the spell's value, not the number generated",
    );
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: riffs[0].instanceId,
      targetInstanceId: target.instanceId,
    });
    buffed = humanPlayer(state).board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(buffed);
    assert.deepEqual(
      [buffed.attack, buffed.health],
      [5 + scenario.expectedBonus, 7 + scenario.expectedBonus],
    );
  }
});

test("full-hand Stormy Guitarist queues Sick Riffs, fills an opened slot, and expires at end of turn", () => {
  let state = createGame(0xf202);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG26_501", "full-hand-guitarist", {
      attack: 0,
      health: 100,
    }),
  ];
  player.hand = Array.from({ length: 10 }, (_, index) =>
    tavernSpell(
      "tavern-spell-pointy-arrow",
      `guitarist-full-hand-${index}`,
    ),
  );
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "full-hand-guitarist-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);

  state = continueAfterCombat(state);
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(sickRiffsInHand(player).length, 0);
  assert.deepEqual(
    player.pendingSpellcraft.map((pending) => pending.sourceInstanceId),
    ["full-hand-guitarist"],
  );

  const spentArrow = pointyArrowsInHand(player)[0];
  assert.ok(spentArrow);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spentArrow.instanceId,
    targetInstanceId: "full-hand-guitarist",
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(sickRiffsInHand(player).length, 1);
  assert.deepEqual(player.pendingSpellcraft, []);

  let expiring = createGame(0xf203);
  const expiringPlayer = humanPlayer(expiring);
  expiringPlayer.board = [
    definitionMinion("BG26_501", "expiring-pending-guitarist", {
      attack: 0,
      health: 100,
    }),
  ];
  expiringPlayer.hand = Array.from({ length: 10 }, (_, index) =>
    tavernSpell(
      "tavern-spell-pointy-arrow",
      `expiring-pending-filler-${index}`,
    ),
  );
  keepOnlyOneOpponent(expiring, [
    definitionMinion("BG35_801", "expiring-pending-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);
  expiring = continueAfterCombat(expiring);
  assert.equal(humanPlayer(expiring).pendingSpellcraft.length, 1);
  expiring = gameReducer(expiring, { type: "END_TURN" });
  assert.equal(expiring.phase, "combat");
  assert.deepEqual(humanPlayer(expiring).pendingSpellcraft, []);
});

test("pending Spellcraft follows left-to-right board order", () => {
  let state = createGame(0xf204);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG26_501", "left-guitarist", {
      attack: 0,
      health: 100,
    }),
    definitionMinion("BG26_501", "right-golden-guitarist", {
      golden: true,
      attack: 0,
      health: 100,
    }),
  ];
  player.hand = Array.from({ length: 10 }, (_, index) =>
    tavernSpell(
      "tavern-spell-pointy-arrow",
      `ordered-pending-filler-${index}`,
    ),
  );
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "ordered-pending-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);

  state = continueAfterCombat(state);
  player = humanPlayer(state);
  assert.deepEqual(
    player.pendingSpellcraft.map((pending) => [
      pending.sourceInstanceId,
      pending.golden,
    ]),
    [
      ["left-guitarist", false],
      ["right-golden-guitarist", true],
    ],
  );

  for (const expectedRemaining of [1, 0]) {
    const arrow = pointyArrowsInHand(humanPlayer(state))[0];
    assert.ok(arrow);
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: arrow.instanceId,
      targetInstanceId: "left-guitarist",
    });
    assert.equal(
      humanPlayer(state).pendingSpellcraft.length,
      expectedRemaining,
    );
  }
  assert.deepEqual(
    sickRiffsInHand(humanPlayer(state)).map((spell) => [
      spell.cardId,
      spell.effectMultiplier,
    ]),
    [
      ["BG26_501t", 1],
      ["BG26_501_Gt", 2],
    ],
  );
});

test("selling or tripling away a Stormy Guitarist cancels its pending Spellcraft", () => {
  let soldState = createGame(0xf205);
  const soldPlayer = humanPlayer(soldState);
  soldPlayer.board = [
    definitionMinion("BG26_501", "sold-pending-guitarist"),
  ];
  soldPlayer.hand = Array.from({ length: 10 }, (_, index) =>
    tavernSpell(
      "tavern-spell-pointy-arrow",
      `sold-pending-filler-${index}`,
    ),
  );
  keepOnlyOneOpponent(soldState, [
    definitionMinion("BG35_801", "sold-pending-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);
  soldState = continueAfterCombat(soldState);
  assert.equal(humanPlayer(soldState).pendingSpellcraft.length, 1);
  soldState = gameReducer(soldState, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  assert.deepEqual(humanPlayer(soldState).pendingSpellcraft, []);
  assert.equal(sickRiffsInHand(humanPlayer(soldState)).length, 0);

  let tripleState = createGame(0xf206);
  const triplePlayer = humanPlayer(tripleState);
  triplePlayer.tavernTier = 2;
  if (!tripleState.activeTribes.includes("naga")) {
    tripleState.activeTribes = [
      ...tripleState.activeTribes
        .filter((tribe) => tribe !== "naga")
        .slice(0, 4),
      "naga",
    ];
  }
  triplePlayer.board = [
    definitionMinion("BG26_501", "tripled-pending-guitarist", {
      poolCopies: 1,
    }),
    definitionMinion("BG23_002", "tripled-pending-chef-target"),
  ];
  triplePlayer.hand = [
    definitionMinion("BG26_501", "tripled-pending-copy", {
      poolCopies: 1,
    }),
    tavernSpell(
      "tavern-spell-chefs-choice",
      "tripled-pending-chefs-choice",
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      tavernSpell(
        "tavern-spell-pointy-arrow",
        `tripled-pending-filler-${index}`,
      ),
    ),
  ];
  keepOnlyOneOpponent(tripleState, [
    definitionMinion("BG35_801", "tripled-pending-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);
  tripleState = continueAfterCombat(tripleState);
  for (const definitionId of Object.keys(tripleState.pool)) {
    tripleState.pool[definitionId] = 0;
  }
  tripleState.pool.BG26_501 = 1;
  assert.equal(humanPlayer(tripleState).pendingSpellcraft.length, 1);
  tripleState = gameReducer(tripleState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "tripled-pending-chefs-choice",
    targetInstanceId: "tripled-pending-chef-target",
  });
  const afterTriple = humanPlayer(tripleState);
  assert.deepEqual(afterTriple.pendingSpellcraft, []);
  assert.equal(sickRiffsInHand(afterTriple).length, 0);
  const goldenGuitarists = minionsInHand(afterTriple).filter(
    (minion) => minion.definitionId === "BG26_501" && minion.golden,
  );
  assert.equal(goldenGuitarists.length, 1);
  assert.equal(goldenGuitarists[0].grantsTripleReward, true);
});

test("a Golden minion's Triple Reward takes priority over existing pending Spellcraft", () => {
  let state = createGame(0xf207);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion("BG26_501", "reward-priority-guitarist"),
  ];
  player.hand = [
    definitionMinion("BG25_001", "reward-priority-golden-minion", {
      golden: true,
      grantsTripleReward: true,
      attack: getMinionDefinition("BG25_001").attack * 2,
      health: getMinionDefinition("BG25_001").health * 2,
    }),
    ...Array.from({ length: 9 }, (_, index) =>
      tavernSpell(
        "tavern-spell-pointy-arrow",
        `reward-priority-filler-${index}`,
      ),
    ),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "reward-priority-enemy", {
      attack: 0,
      health: 100,
    }),
  ]);
  state = continueAfterCombat(state);
  assert.equal(humanPlayer(state).pendingSpellcraft.length, 1);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "reward-priority-golden-minion",
  });
  player = humanPlayer(state);
  assert.equal(
    player.hand.filter((card) => card.kind === "tripleReward").length,
    1,
  );
  assert.equal(sickRiffsInHand(player).length, 0);
  assert.equal(player.pendingSpellcraft.length, 1);

  const arrow = pointyArrowsInHand(player)[0];
  assert.ok(arrow);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: arrow.instanceId,
    targetInstanceId: "reward-priority-guitarist",
  });
  assert.equal(sickRiffsInHand(humanPlayer(state)).length, 1);
  assert.deepEqual(humanPlayer(state).pendingSpellcraft, []);
});

test("Sick Riffs uses the Tavern Tier at cast time and Brann never duplicates it", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xf208 + index);
    let player = humanPlayer(state);
    player.tavernTier = 2;
    player.gold = 100;
    const target = definitionMinion(
      "BG35_801",
      `upgraded-riffs-target-${golden}`,
      { attack: 5, health: 7 },
    );
    player.board = [
      definitionMinion("BG_LOE_077", `riffs-brann-${golden}`),
      target,
    ];
    player.hand = [
      definitionMinion(
        "BG26_501",
        `upgraded-riffs-guitarist-${golden}`,
        golden
          ? {
              golden: true,
              attack: getMinionDefinition("BG26_501").attack * 2,
              health: getMinionDefinition("BG26_501").health * 2,
            }
          : {},
      ),
    ];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: `upgraded-riffs-guitarist-${golden}`,
    });
    assert.equal(
      sickRiffsInHand(humanPlayer(state)).length,
      1,
      "Spellcraft is not a Battlecry and Brann must not repeat it",
    );
    state = gameReducer(state, { type: "UPGRADE_TAVERN" });
    player = humanPlayer(state);
    assert.equal(player.tavernTier, 3);
    const [riff] = sickRiffsInHand(player);
    assert.ok(riff);
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: riff.instanceId,
      targetInstanceId: target.instanceId,
    });
    const buffed = humanPlayer(state).board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(buffed);
    const expectedBonus = golden ? 6 : 3;
    assert.deepEqual(
      [
        buffed.attack,
        buffed.health,
        buffed.temporaryAttack,
        buffed.temporaryHealth,
      ],
      [
        5 + expectedBonus,
        7 + expectedBonus,
        expectedBonus,
        expectedBonus,
      ],
    );
  }
});

test("AI plays Stormy Guitarist and spends the generated Sick Riffs", () => {
  const state = createGame(0xf20a);
  const human = humanPlayer(state);
  human.board = [
    definitionMinion("BG35_801", "guitarist-ai-opponent", {
      attack: 0,
      health: 100_000,
    }),
  ];
  const ai = keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "guitarist-ai-target", {
      attack: 5,
      health: 7,
    }),
  ]);
  ai.tavernTier = 4;
  ai.hand = [
    definitionMinion("BG26_501", "guitarist-ai-source"),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextAi = combat.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(
    nextAi.board.some(
      (minion) => minion.instanceId === "guitarist-ai-source",
    ),
    true,
  );
  assert.equal(sickRiffsInHand(nextAi).length, 0);
  assert.equal(
    nextAi.board.reduce(
      (total, minion) => total + minion.temporaryAttack,
      0,
    ),
    4,
  );
  assert.equal(
    nextAi.board.reduce(
      (total, minion) => total + minion.temporaryHealth,
      0,
    ),
    4,
  );
});

test("Hungry Winterfin randomly buffs exactly one hand minion per actual damage", () => {
  let state = createGame(0xf210);
  let player = humanPlayer(state);
  const winterfin = definitionMinion(
    "BG29_300",
    "random-winterfin",
    { attack: 10, health: 100 },
  );
  player.board = [winterfin];
  player.hand = [
    definitionMinion("BG25_001", "random-hand-minion-a"),
    definitionMinion("BG35_801", "random-hand-minion-b"),
  ];
  const before = handStatsById(player);
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "random-winterfin-enemy", {
      attack: 1,
      health: 1,
    }),
  ]);

  state = gameReducer(state, { type: "END_TURN" });
  player = humanPlayer(state);
  const deltas = minionsInHand(player)
    .map((minion) => {
      const original = before.get(minion.instanceId);
      assert.ok(original);
      return [
        minion.attack - original[0],
        minion.health - original[1],
      ] as const;
    })
    .sort((left, right) => left[0] - right[0]);
  assert.deepEqual(deltas, [
    [0, 0],
    [2, 1],
  ]);
  const events =
    state.lastBattle?.events.filter(
      (event) =>
        event.type === "handBuff" &&
        event.actorInstanceId === winterfin.instanceId,
    ) ?? [];
  assert.equal(events.length, 1);
  assert.ok(
    ["random-hand-minion-a", "random-hand-minion-b"].includes(
      events[0].targetInstanceId ?? "",
    ),
  );

  state = gameReducer(state, { type: "CONTINUE" });
  const persisted = handStatsById(humanPlayer(state));
  assert.deepEqual(persisted, handStatsById(player));
});

test("Hungry Winterfin triggers on every real hit and Golden doubles each permanent buff", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 0xf212 : 0xf211);
    let player = humanPlayer(state);
    const winterfin = definitionMinion(
      "BG29_300",
      `multi-hit-winterfin-${golden}`,
      {
        golden,
        attack: 10,
        health: 100,
      },
    );
    const target = definitionMinion(
      "BG25_001",
      `multi-hit-hand-target-${golden}`,
    );
    player.board = [winterfin];
    player.hand = [target];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `multi-hit-enemy-a-${golden}`, {
        attack: 1,
        health: 1,
      }),
      definitionMinion("BG35_801", `multi-hit-enemy-b-${golden}`, {
        attack: 1,
        health: 1,
      }),
    ]);

    state = gameReducer(state, { type: "END_TURN" });
    player = humanPlayer(state);
    const buffed = minionsInHand(player)[0];
    const perHitAttack = golden ? 4 : 2;
    const perHitHealth = golden ? 2 : 1;
    assert.deepEqual(
      [buffed.attack, buffed.health],
      [
        target.attack + perHitAttack * 2,
        target.health + perHitHealth * 2,
      ],
    );
    const events =
      state.lastBattle?.events.filter(
        (event) =>
          event.type === "handBuff" &&
          event.actorInstanceId === winterfin.instanceId,
      ) ?? [];
    assert.equal(events.length, 2);
    assert.ok(
      events.every(
        (event) =>
          event.attackDelta === perHitAttack &&
          event.healthDelta === perHitHealth,
      ),
    );

    state = gameReducer(state, { type: "CONTINUE" });
    const afterContinue = minionsInHand(humanPlayer(state))[0];
    assert.deepEqual(
      [afterContinue.attack, afterContinue.health],
      [buffed.attack, buffed.health],
    );
  }
});

test("Hungry Winterfin ignores Divine Shield blocks and hands without minions", () => {
  for (const [index, hand] of [
    [
      definitionMinion("BG25_001", "shielded-winterfin-target"),
    ],
    [],
    [
      tavernSpell(
        "tavern-spell-pointy-arrow",
        "winterfin-non-minion-card",
      ),
    ],
  ].entries()) {
    const state = createGame(0xf213 + index);
    const player = humanPlayer(state);
    const winterfin = definitionMinion(
      "BG29_300",
      `non-trigger-winterfin-${index}`,
      {
        attack: 10,
        health: 100,
        divineShield: index === 0,
      },
    );
    player.board = [winterfin];
    player.hand = hand;
    const before = JSON.parse(JSON.stringify(player.hand)) as PlayerState["hand"];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `non-trigger-enemy-${index}`, {
        attack: 1,
        health: 1,
      }),
    ]);

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.deepEqual(humanPlayer(combat).hand, before);
    assert.equal(
      combat.lastBattle?.events.some(
        (event) =>
          event.type === "handBuff" &&
          event.actorInstanceId === winterfin.instanceId,
      ),
      false,
    );
    if (index === 0) {
      assert.equal(
        combat.lastBattle?.events.some(
          (event) =>
            event.type === "shieldBroken" &&
            event.targetInstanceId === winterfin.instanceId,
        ),
        true,
      );
    }
  }
});

test("AI Hungry Winterfin keeps its random hand target private", () => {
  const state = createGame(0xf216);
  const human = humanPlayer(state);
  human.health = 100;
  human.board = [
    definitionMinion("BG35_801", "private-winterfin-opponent", {
      attack: 1,
      health: 1,
    }),
  ];
  const winterfin = definitionMinion(
    "BG29_300",
    "private-ai-winterfin",
    { attack: 10, health: 100 },
  );
  const ai = keepOnlyOneOpponent(state, [
    winterfin,
    ...Array.from({ length: 6 }, (_, index) =>
      definitionMinion(
        "BG35_801",
        `private-ai-board-filler-${index}`,
        { attack: 0, health: 100 },
      ),
    ),
  ]);
  ai.hand = [
    definitionMinion("BG25_001", "private-ai-hand-a"),
    definitionMinion("BG35_801", "private-ai-hand-b"),
  ];
  const before = handStatsById(ai);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextAi = combat.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  const deltas = minionsInHand(nextAi)
    .map((minion) => {
      const original = before.get(minion.instanceId);
      assert.ok(original);
      return [
        minion.attack - original[0],
        minion.health - original[1],
      ] as const;
    })
    .sort((left, right) => left[0] - right[0]);
  assert.deepEqual(deltas, [
    [0, 0],
    [2, 1],
  ]);

  const event = combat.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "handBuff" &&
      candidate.actorInstanceId === winterfin.instanceId,
  );
  assert.ok(event);
  assert.equal(event.targetInstanceId, undefined);
  assert.equal(event.cardName, undefined);
  assert.equal(event.minion, undefined);
  const publicEvent = JSON.stringify(event);
  for (const secret of [
    "private-ai-hand-a",
    "private-ai-hand-b",
    getMinionDefinition("BG25_001").name,
    getMinionDefinition("BG35_801").name,
  ]) {
    assert.equal(publicEvent.includes(secret), false);
  }
});

test("Steel Hunter gains Pointy Arrows with Golden and Titus repetitions", () => {
  const scenarios = [
    { hunterGolden: false, titusGolden: null, expected: 1 },
    { hunterGolden: true, titusGolden: null, expected: 2 },
    { hunterGolden: false, titusGolden: false, expected: 2 },
    { hunterGolden: true, titusGolden: false, expected: 4 },
    { hunterGolden: true, titusGolden: true, expected: 6 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    const state = createGame(0xf220 + index);
    const player = humanPlayer(state);
    const hunter = definitionMinion(
      "BG32_170",
      `steel-hunter-${index}`,
      {
        golden: scenario.hunterGolden,
        attack: scenario.hunterGolden ? 8 : 4,
        health: 1,
        taunt: true,
      },
    );
    player.board = [
      hunter,
      ...(scenario.titusGolden === null
        ? []
        : [
            definitionMinion(
              "BG25_354",
              `steel-hunter-titus-${index}`,
              {
                golden: scenario.titusGolden,
                attack: 0,
                health: 1_000,
              },
            ),
          ]),
    ];
    player.hand = [];
    keepOnlyOneOpponent(state, [
      definitionMinion("BG35_801", `steel-hunter-enemy-${index}`, {
        attack: 100,
        health: 100,
        taunt: true,
      }),
    ]);
    const spellPoolBefore =
      state.spellPool["tavern-spell-pointy-arrow"];

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      combat.spellPool["tavern-spell-pointy-arrow"],
      spellPoolBefore,
      "generated Pointy Arrows must not reserve shared spell-pool copies",
    );
    const arrows = pointyArrowsInHand(humanPlayer(combat));
    assert.equal(arrows.length, scenario.expected);
    assert.ok(
      arrows.every(
        (arrow) =>
          arrow.cardId === "EBG_Spell_014" &&
          arrow.cost === 1 &&
          arrow.target === "anyMinion",
      ),
    );
    const events =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === hunter.instanceId,
      ) ?? [];
    assert.equal(events.length, scenario.expected);
    assert.ok(
      events.every(
        (event) =>
          event.cardGainResult === "added" &&
          event.cardKind === "tavernSpell" &&
          event.cardName === "尖利箭矢",
      ),
    );
  }
});

test("Steel Hunter respects a full hand", () => {
  const state = createGame(0xf224);
  const player = humanPlayer(state);
  const hunter = definitionMinion(
    "BG32_170",
    "full-hand-steel-hunter",
    { attack: 4, health: 1, taunt: true },
  );
  player.board = [hunter];
  player.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(
      "BG25_001",
      `full-hand-steel-hunter-card-${index}`,
    ),
  );
  const before = JSON.parse(JSON.stringify(player.hand)) as PlayerState["hand"];
  keepOnlyOneOpponent(state, [
    definitionMinion("BG35_801", "full-hand-steel-hunter-enemy", {
      attack: 100,
      health: 100,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(humanPlayer(combat).hand, before);
  assert.equal(pointyArrowsInHand(humanPlayer(combat)).length, 0);
  const events =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === hunter.instanceId,
    ) ?? [];
  assert.deepEqual(
    events.map((event) => event.cardGainResult),
    ["handFull"],
  );
});

test("an eliminated ghost Steel Hunter cannot change its former owner's hand", () => {
  const state = createGame(0xf225);
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.gold = 0;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = undefined;
  }
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 100;
    player.board = [
      definitionMinion(
        "BG35_801",
        `steel-hunter-ghost-opponent-${index}`,
        { attack: 100, health: 100 },
      ),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.board = [
    definitionMinion("BG32_170", "ghost-steel-hunter", {
      attack: 4,
      health: 1,
    }),
  ];
  ghost.hand = [
    definitionMinion("BG25_001", "ghost-hand-sentinel"),
  ];
  const before = JSON.parse(JSON.stringify(ghost.hand)) as PlayerState["hand"];

  const combat = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id || battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.deepEqual(combat.players[3].hand, before);
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        event.actorPlayerId === ghost.id,
    ),
    false,
  );
});
