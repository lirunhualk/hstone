import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const COMPLETED_CARD_IDS = [
  "BG23_009",
  "BG27_002",
  "BG32_237",
  "BG26_505",
  "BG32_341",
  "BG35_341",
  "BG35_921",
  "BG33_923",
  "BG35_883",
] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
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
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  assert.ok(definition.goldenCardId);
  assert.ok(definition.goldenDescription);
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId,
    description: definition.goldenDescription,
    attack: definition.attack * 2,
    health: definition.health * 2,
    ...overrides,
  });
}

function targetedSpell(
  definitionId: string,
  instanceId: string,
  effectMultiplier = 1,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  const golden = effectMultiplier > 1;
  return {
    kind: "spellcraft",
    instanceId,
    definitionId: definition.id,
    cardId:
      golden && definition.goldenCardId
        ? definition.goldenCardId
        : definition.cardId,
    name: definition.name,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    spellFamily: definition.spellFamily ?? "spellcraft",
    target: definition.target,
    effectMultiplier,
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

function boardMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const minion = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion);
  return minion;
}

function keepOnlyOneOpponent(state: GameState): void {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 100;
      player.hand = [];
      player.board = [];
    } else if (!player.isHuman) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
}

function advanceTurn(state: GameState): GameState {
  keepOnlyOneOpponent(state);
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("the nine spell-synergy minions expose complete ordinary and Golden rules", () => {
  for (const definitionId of COMPLETED_CARD_IDS) {
    const definition = getMinionDefinition(definitionId);
    assert.equal(definition.effectSupport, "complete", definitionId);
    assert.equal(definition.goldenCardId, `${definitionId}_G`, definitionId);
    assert.ok(definition.goldenDescription, definitionId);
  }

  assert.deepEqual(
    getMinionDefinition("BG23_009").spellcraftPermanentOnSelf,
    { castsPerTurn: 1 },
  );
  assert.deepEqual(getMinionDefinition("BG26_505").copySpellcraftOnSelf, {
    count: 1,
  });
  assert.deepEqual(getMinionDefinition("BG32_341").tavernSpellBuffAura, {
    attack: 1,
    health: 2,
  });
  assert.deepEqual(getMinionDefinition("BG35_341").tavernSpellBuffAura, {
    attack: 1,
    health: 1,
  });
  assert.deepEqual(getMinionDefinition("BG35_921").tavernSpellHistoryBuff, {
    attack: 1,
    health: 1,
  });
  assert.deepEqual(getMinionDefinition("BG33_923").afterSpellCast, {
    attack: 0,
    health: 3,
  });
  assert.equal(
    getMinionDefinition("BG35_883").friendlyTargetSpellExtraCasts,
    1,
  );

  const slimyShield = getSpellcraftDefinition("generated-slimy-shield");
  assert.equal(slimyShield.cardId, "BG27_002t");
  assert.equal(slimyShield.spellFamily, "generated");
  assert.equal(slimyShield.randomlyGeneratable, false);
});

test("Oozeling Battlecry gives two Slimy Shields, or four when Golden", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 6102 : 6101);
    const player = humanPlayer(state);
    const oozeling = golden
      ? goldenMinion("BG27_002", "golden-oozeling")
      : definitionMinion("BG27_002", "ordinary-oozeling");
    player.hand = [oozeling];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const shields = humanPlayer(state).hand.filter(
      (card): card is SpellcraftSpellInstance =>
        card.kind === "spellcraft" &&
        card.definitionId === "generated-slimy-shield",
    );
    assert.equal(shields.length, golden ? 4 : 2);
    assert.equal(
      shields.every(
        (spell) =>
          spell.cardId === "BG27_002t" &&
          spell.spellFamily === "generated" &&
          spell.target === "friendly",
      ),
      true,
    );
  }
});

test("Slimy Shield repeats through Balinda without spending Lava or Shaker quotas", () => {
  let state = createGame(6103);
  const player = humanPlayer(state);
  const lava = definitionMinion("BG23_009", "slimy-lava");
  const shaker = definitionMinion("BG26_505", "slimy-shaker");
  const balinda = definitionMinion("BG35_883", "slimy-balinda");
  player.board = [lava, shaker, balinda];
  player.hand = [
    targetedSpell("generated-slimy-shield", "slimy-on-lava"),
    targetedSpell("generated-slimy-shield", "slimy-on-shaker"),
  ];

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "slimy-on-lava",
    targetInstanceId: lava.instanceId,
  });
  const nextLava = boardMinion(state, lava.instanceId);
  assert.deepEqual(
    [nextLava.attack - lava.attack, nextLava.health - lava.health],
    [2, 2],
  );
  assert.equal(nextLava.taunt, true);
  assert.equal(nextLava.temporaryAttack, 0);
  assert.equal(nextLava.temporaryHealth, 0);
  assert.equal(
    nextLava.effectCounters?.spellcraftPermanentCastsThisTurn ?? 0,
    0,
  );

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "slimy-on-shaker",
    targetInstanceId: shaker.instanceId,
  });
  const nextShaker = boardMinion(state, shaker.instanceId);
  assert.deepEqual(
    [nextShaker.attack - shaker.attack, nextShaker.health - shaker.health],
    [2, 2],
  );
  assert.equal(
    nextShaker.effectCounters?.spellcraftCopyUsedThisTurn ?? 0,
    0,
  );
  assert.equal(humanPlayer(state).hand.length, 0);
  assert.equal(humanPlayer(state).tavernSpellsCast, 0);
});

test("Slimy Shield survives Recruit turns and a JSON save while Spellcraft expires", () => {
  let state = createGame(6120);
  const player = humanPlayer(state);
  player.hand = [
    targetedSpell("generated-slimy-shield", "saved-slimy-shield"),
    targetedSpell("spellcraft-anglers-lure", "expiring-spellcraft"),
  ];

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  );
  assert.ok(restored && typeof restored === "object");
  state = advanceTurn(restored as GameState);
  assert.deepEqual(
    humanPlayer(state).hand.map((card) => card.instanceId),
    ["saved-slimy-shield"],
  );
  const shield = humanPlayer(state).hand[0];
  assert.equal(
    shield?.kind === "spellcraft" ? shield.spellFamily : null,
    "generated",
  );
});

test("multiple Balindas use only the strongest ordinary or Golden repeat", () => {
  const scenarios = [
    {
      seed: 6104,
      balindas: [
        definitionMinion("BG35_883", "ordinary-balinda-a"),
        definitionMinion("BG35_883", "ordinary-balinda-b"),
      ],
      expectedCasts: 2,
    },
    {
      seed: 6105,
      balindas: [
        definitionMinion("BG35_883", "ordinary-balinda"),
        goldenMinion("BG35_883", "golden-balinda"),
      ],
      expectedCasts: 3,
    },
  ];

  for (const scenario of scenarios) {
    let state = createGame(scenario.seed);
    const player = humanPlayer(state);
    const target = definitionMinion("BG29_611", `balinda-target-${scenario.seed}`);
    player.board = [target, ...scenario.balindas];
    player.hand = [
      targetedSpell("generated-slimy-shield", `balinda-spell-${scenario.seed}`),
    ];

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: `balinda-spell-${scenario.seed}`,
      targetInstanceId: target.instanceId,
    });
    const nextTarget = boardMinion(state, target.instanceId);
    assert.deepEqual(
      [nextTarget.attack - target.attack, nextTarget.health - target.health],
      [scenario.expectedCasts, scenario.expectedCasts],
    );
  }
});

test("ordinary Lava Lurker makes one hand Spellcraft permanent per turn even when repeated", () => {
  let state = createGame(6106);
  let player = humanPlayer(state);
  const lava = definitionMinion("BG23_009", "ordinary-lava");
  const balinda = definitionMinion("BG35_883", "lava-balinda");
  player.board = [lava, balinda];
  player.hand = [
    targetedSpell("spellcraft-anglers-lure", "lava-first"),
    targetedSpell("spellcraft-anglers-lure", "lava-second"),
  ];

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "lava-first",
    targetInstanceId: lava.instanceId,
  });
  let nextLava = boardMinion(state, lava.instanceId);
  assert.deepEqual([nextLava.attack, nextLava.health], [6, 17]);
  assert.deepEqual([nextLava.temporaryAttack, nextLava.temporaryHealth], [0, 0]);
  assert.equal(
    nextLava.effectCounters?.spellcraftPermanentCastsThisTurn,
    1,
  );

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "lava-second",
    targetInstanceId: lava.instanceId,
  });
  nextLava = boardMinion(state, lava.instanceId);
  assert.deepEqual([nextLava.attack, nextLava.health], [10, 29]);
  assert.deepEqual([nextLava.temporaryAttack, nextLava.temporaryHealth], [4, 12]);
  assert.equal(
    nextLava.effectCounters?.spellcraftPermanentCastsThisTurn,
    1,
  );

  state = advanceTurn(state);
  nextLava = boardMinion(state, lava.instanceId);
  assert.deepEqual([nextLava.attack, nextLava.health], [6, 17]);
  assert.deepEqual([nextLava.temporaryAttack, nextLava.temporaryHealth], [0, 0]);
  assert.equal(
    nextLava.effectCounters?.spellcraftPermanentCastsThisTurn,
    0,
  );

  player = humanPlayer(state);
  player.hand = [
    targetedSpell("spellcraft-anglers-lure", "lava-next-turn"),
  ];
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "lava-next-turn",
    targetInstanceId: lava.instanceId,
  });
  nextLava = boardMinion(state, lava.instanceId);
  assert.deepEqual([nextLava.attack, nextLava.health], [10, 29]);
  assert.deepEqual([nextLava.temporaryAttack, nextLava.temporaryHealth], [0, 0]);
});

test("Golden Lava Lurker makes exactly the first two hand Spellcraft cards permanent", () => {
  let state = createGame(6107);
  const player = humanPlayer(state);
  const lava = goldenMinion("BG23_009", "golden-lava");
  player.board = [lava];
  player.hand = [
    targetedSpell("spellcraft-anglers-lure", "golden-lava-first"),
    targetedSpell("spellcraft-anglers-lure", "golden-lava-second"),
    targetedSpell("spellcraft-anglers-lure", "golden-lava-third"),
  ];

  for (const cardInstanceId of [
    "golden-lava-first",
    "golden-lava-second",
    "golden-lava-third",
  ]) {
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId,
      targetInstanceId: lava.instanceId,
    });
  }

  const nextLava = boardMinion(state, lava.instanceId);
  assert.deepEqual([nextLava.attack, nextLava.health], [10, 28]);
  assert.deepEqual([nextLava.temporaryAttack, nextLava.temporaryHealth], [2, 6]);
  assert.equal(
    nextLava.effectCounters?.spellcraftPermanentCastsThisTurn,
    2,
  );
});

test("Zesty Shaker copies once per turn, independent of Balinda repeat count", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 6109 : 6108);
    let player = humanPlayer(state);
    const shaker = golden
      ? goldenMinion("BG26_505", "golden-shaker")
      : definitionMinion("BG26_505", "ordinary-shaker");
    const balinda = golden
      ? goldenMinion("BG35_883", "golden-shaker-balinda")
      : definitionMinion("BG35_883", "ordinary-shaker-balinda");
    player.board = [shaker, balinda];
    player.hand = [
      targetedSpell("spellcraft-anglers-lure", `shaker-first-${golden}`),
    ];

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: `shaker-first-${golden}`,
      targetInstanceId: shaker.instanceId,
    });
    player = humanPlayer(state);
    let copies = player.hand.filter(
      (card): card is SpellcraftSpellInstance =>
        card.kind === "spellcraft" &&
        card.definitionId === "spellcraft-anglers-lure",
    );
    assert.equal(copies.length, golden ? 2 : 1);
    assert.equal(
      boardMinion(state, shaker.instanceId).effectCounters
        ?.spellcraftCopyUsedThisTurn,
      1,
    );

    const spentCopy = copies[0];
    assert.ok(spentCopy);
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: spentCopy.instanceId,
      targetInstanceId: shaker.instanceId,
    });
    copies = humanPlayer(state).hand.filter(
      (card): card is SpellcraftSpellInstance =>
        card.kind === "spellcraft" &&
        card.definitionId === "spellcraft-anglers-lure",
    );
    assert.equal(copies.length, golden ? 1 : 0);

    if (!golden) {
      state = advanceTurn(state);
      player = humanPlayer(state);
      player.hand = [
        targetedSpell("spellcraft-anglers-lure", "shaker-next-turn"),
      ];
      state = gameReducer(state, {
        type: "CAST_SPELLCRAFT",
        cardInstanceId: "shaker-next-turn",
        targetInstanceId: shaker.instanceId,
      });
      assert.equal(
        humanPlayer(state).hand.filter(
          (card) =>
            card.kind === "spellcraft" &&
            card.definitionId === "spellcraft-anglers-lure",
        ).length,
        1,
      );
    }
  }
});

test("Budding Botanist offers exact ordinary and Golden choices and buffs Tavern Spells", () => {
  const scenarios = [
    {
      seed: 6110,
      golden: false,
      optionIds: ["BG32_237t", "BG32_237t2"],
      chosenOption: "BG32_237t",
      expectedBonus: [3, 2],
    },
    {
      seed: 6111,
      golden: true,
      optionIds: ["BG32_237_Gt", "BG32_237_Gt2"],
      chosenOption: "BG32_237_Gt2",
      expectedBonus: [2, 4],
    },
  ] as const;

  for (const scenario of scenarios) {
    let state = createGame(scenario.seed);
    let player = humanPlayer(state);
    const target = definitionMinion(
      "BG29_611",
      `botanist-target-${scenario.seed}`,
    );
    const botanist = scenario.golden
      ? goldenMinion("BG32_237", `golden-botanist-${scenario.seed}`)
      : definitionMinion("BG32_237", `ordinary-botanist-${scenario.seed}`);
    player.board = [target];
    player.hand = [botanist];

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "minionChoice");
    assert.deepEqual(pending.optionIds, [...scenario.optionIds]);
    assert.equal(pending.effectMultiplier, scenario.golden ? 2 : 1);

    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: scenario.chosenOption,
    });
    player = humanPlayer(state);
    assert.equal(state.pendingInteraction, null);
    assert.deepEqual(
      [player.tavernSpellAttackBonus, player.tavernSpellHealthBonus],
      scenario.golden ? [0, 2] : [1, 0],
    );
    player.hand = [
      tavernSpell(
        "tavern-spell-tavern-dish-banana",
        `botanist-banana-${scenario.seed}`,
      ),
    ];

    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `botanist-banana-${scenario.seed}`,
      targetInstanceId: target.instanceId,
    });
    const nextTarget = boardMinion(state, target.instanceId);
    assert.deepEqual(
      [nextTarget.attack - target.attack, nextTarget.health - target.health],
      [...scenario.expectedBonus],
    );
  }
});

test("Humongozz and Enchanted Sentinel Tavern Spell auras stack and scale when Golden", () => {
  const scenarios = [
    {
      seed: 6112,
      humongozz: definitionMinion("BG32_341", "ordinary-humongozz"),
      sentinel: definitionMinion("BG35_341", "ordinary-sentinel"),
      expectedBonus: [4, 5],
    },
    {
      seed: 6113,
      humongozz: goldenMinion("BG32_341", "golden-humongozz"),
      sentinel: goldenMinion("BG35_341", "golden-sentinel"),
      expectedBonus: [6, 8],
    },
  ] as const;

  for (const scenario of scenarios) {
    let state = createGame(scenario.seed);
    const player = humanPlayer(state);
    const target = definitionMinion("BG29_611", `aura-target-${scenario.seed}`);
    player.board = [target, scenario.humongozz, scenario.sentinel];
    player.hand = [
      tavernSpell(
        "tavern-spell-tavern-dish-banana",
        `aura-banana-${scenario.seed}`,
      ),
    ];

    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `aura-banana-${scenario.seed}`,
      targetInstanceId: target.instanceId,
    });
    const nextTarget = boardMinion(state, target.instanceId);
    assert.deepEqual(
      [nextTarget.attack - target.attack, nextTarget.health - target.health],
      [...scenario.expectedBonus],
    );
  }
});

test("Enchanted Sentinel keeps its Tavern Spell aura while Magnetized", () => {
  let state = createGame(6114);
  let player = humanPlayer(state);
  const target = definitionMinion("BG25_001", "attached-aura-target");
  const host = definitionMinion("BG29_611", "sentinel-host");
  const sentinel = definitionMinion("BG35_341", "sentinel-attachment");
  player.board = [target, host];
  player.hand = [sentinel];

  state = gameReducer(state, {
    type: "MAGNETIZE_MINION",
    cardInstanceId: sentinel.instanceId,
    targetInstanceId: host.instanceId,
  });
  assert.equal(boardMinion(state, host.instanceId).attachments.length, 1);
  player = humanPlayer(state);
  player.hand = [
    tavernSpell("tavern-spell-tavern-dish-banana", "attached-aura-banana"),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "attached-aura-banana",
    targetInstanceId: target.instanceId,
  });

  const nextTarget = boardMinion(state, target.instanceId);
  assert.deepEqual(
    [nextTarget.attack - target.attack, nextTarget.health - target.health],
    [3, 3],
  );
});

test("Stacked Avalanche snapshots Humongozz's Tavern Spell aura before selling it", () => {
  let state = createGame(6119);
  const player = humanPlayer(state);
  const humongozz = definitionMinion("BG32_341", "avalanche-humongozz");
  const elemental = definitionMinion("BG31_815", "avalanche-leftmost-elemental");
  const elementalBase = {
    attack: elemental.attack,
    health: elemental.health,
  };
  player.board = [humongozz, elemental];
  player.gold = 0;
  player.hand = [
    tavernSpell("tavern-spell-stacked-avalanche", "humongozz-avalanche"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "humongozz-avalanche",
    targetInstanceId: humongozz.instanceId,
  });

  const nextPlayer = humanPlayer(state);
  assert.equal(
    nextPlayer.board.some(
      (minion) => minion.instanceId === humongozz.instanceId,
    ),
    false,
  );
  assert.equal(nextPlayer.gold, humongozz.sellValue);
  const nextElemental = boardMinion(state, elemental.instanceId);
  assert.deepEqual(
    [
      nextElemental.attack - elementalBase.attack,
      nextElemental.health - elementalBase.health,
    ],
    [6, 7],
    "the sold 5/5 body and its +1/+2 cast-start aura must both apply",
  );
  assert.equal(nextPlayer.tavernSpellsCast, 1);
});

test("Deep-Sea Bruiser immediately reflects prior Tavern Spell history in every zone", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 6116 : 6115);
    let player = humanPlayer(state);
    player.tavernSpellsCast = 3;
    player.gold = 10;
    const bruiser = golden
      ? goldenMinion("BG35_921", "golden-bruiser")
      : definitionMinion("BG35_921", "ordinary-bruiser");
    const baseAttack = bruiser.attack;
    const baseHealth = bruiser.health;
    const scale = golden ? 2 : 1;
    player.shop = [bruiser];

    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    player = humanPlayer(state);
    let owned = player.hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" && card.instanceId === bruiser.instanceId,
    );
    assert.ok(owned);
    assert.deepEqual(
      [owned.attack, owned.health],
      [baseAttack + 3 * scale, baseHealth + 3 * scale],
    );

    state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
    player = humanPlayer(state);
    player.hand = [
      tavernSpell("tavern-spell-tavern-coin", `bruiser-coin-${golden}`),
    ];
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `bruiser-coin-${golden}`,
    });
    assert.equal(humanPlayer(state).tavernSpellsCast, 4);
    owned = boardMinion(state, bruiser.instanceId);
    assert.deepEqual(
      [owned.attack, owned.health],
      [baseAttack + 4 * scale, baseHealth + 4 * scale],
    );
  }
});

test("Shattered Matriarch observes every real repeated spell pulse with Golden scaling", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 6118 : 6117);
    let player = humanPlayer(state);
    const target = definitionMinion("BG29_611", `matriarch-target-${golden}`);
    const matriarch = golden
      ? goldenMinion("BG33_923", "golden-matriarch")
      : definitionMinion("BG33_923", "ordinary-matriarch");
    const balinda = definitionMinion("BG35_883", `matriarch-balinda-${golden}`);
    const targetBase = { attack: target.attack, health: target.health };
    const matriarchBaseHealth = matriarch.health;
    const balindaBaseHealth = balinda.health;
    const healthPerCast = golden ? 6 : 3;
    player.board = [target, matriarch, balinda];
    player.hand = [
      bloodGem(`matriarch-gem-${golden}`),
      targetedSpell("spellcraft-anglers-lure", `matriarch-lure-${golden}`),
      tavernSpell("tavern-spell-tavern-coin", `matriarch-coin-${golden}`),
    ];

    state = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: `matriarch-gem-${golden}`,
      targetInstanceId: target.instanceId,
    });
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: `matriarch-lure-${golden}`,
      targetInstanceId: target.instanceId,
    });
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `matriarch-coin-${golden}`,
    });

    player = humanPlayer(state);
    assert.equal(player.tavernSpellsCast, 1);
    const nextTarget = boardMinion(state, target.instanceId);
    const nextMatriarch = boardMinion(state, matriarch.instanceId);
    const nextBalinda = boardMinion(state, balinda.instanceId);
    const actualSpellPulses = 5;
    assert.deepEqual(
      [nextTarget.attack, nextTarget.health],
      [
        targetBase.attack + 6,
        targetBase.health + 14 + actualSpellPulses * healthPerCast,
      ],
    );
    assert.equal(
      nextMatriarch.health,
      matriarchBaseHealth + actualSpellPulses * healthPerCast,
    );
    assert.equal(
      nextBalinda.health,
      balindaBaseHealth + actualSpellPulses * healthPerCast,
    );
  }
});
