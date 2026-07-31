import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V33,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const PRIMALFIN_DISCOVER_IDS = [
  "BG32_330",
  "BG33_140",
  "BG22_202",
  "BG29_300",
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
    stealth: definition.stealth === true,
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
    bloodGemAttack: overrides.bloodGemAttack ?? 0,
    bloodGemHealth: overrides.bloodGemHealth ?? 0,
    temporaryAttack: overrides.temporaryAttack ?? 0,
    temporaryHealth: overrides.temporaryHealth ?? 0,
    temporaryTaunt: overrides.temporaryTaunt ?? false,
    temporaryDivineShield:
      overrides.temporaryDivineShield ?? false,
    temporaryCrabDeathrattles:
      overrides.temporaryCrabDeathrattles ?? 0,
    temporaryGoldenCrabDeathrattles:
      overrides.temporaryGoldenCrabDeathrattles ?? 0,
  };
}

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return definitionMinion(definitionId, instanceId, {
    cardId: definition.goldenCardId ?? definition.cardId,
    name: `金色·${definition.name}`,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
}

function playHandMinion(
  state: GameState,
  instanceId: string,
): GameState {
  return gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: instanceId,
  });
}

function keepOnlyPoolDefinitions(
  state: GameState,
  definitionIds: readonly string[],
  copies = 1,
): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = definitionIds.includes(definitionId)
      ? copies
      : 0;
  }
}

function minionCardsInHand(
  player: PlayerState,
): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

test("the five Tavern-utility minions expose exact fixed-build normal and Golden rules", () => {
  const glowscale = getMinionDefinition("BG23_008");
  assert.equal(glowscale.goldenCardId, "BG23_008_G");
  assert.equal(
    glowscale.goldenDescription,
    "嘲讽，塑造法术：直到下个回合，使一个随从获得圣盾。",
  );
  assert.deepEqual(glowscale.spellcraft, {
    definitionId: "spellcraft-glowing-crown",
  });

  const revenant = getMinionDefinition("BG34_858");
  assert.equal(revenant.goldenCardId, "BG34_858_G");
  assert.equal(
    revenant.goldenDescription,
    "在你花掉7枚铸币后，施放两张乘借东风。（还剩7枚！）",
  );
  assert.deepEqual(revenant.afterGoldSpent, {
    threshold: 7,
    effects: [
      {
        kind: "castTavernSpell",
        definitionId: "tavern-spell-ride-the-wind",
      },
    ],
  });

  const lamp = getMinionDefinition("BG34_865");
  assert.equal(lamp.goldenCardId, "BG34_865_G");
  assert.equal(
    lamp.goldenDescription,
    "战吼：在本局对战中，在酒馆刷新后，使酒馆中一个随机随从获得+7/+7，触发两次。",
  );
  assert.deepEqual(lamp.battlecry, [
    {
      kind: "installTavernRefreshBuff",
      attack: 7,
      health: 7,
      goldenMode: "repeat",
    },
  ]);

  const bagurgle = getMinionDefinition("BGS_030");
  assert.equal(bagurgle.goldenCardId, "TB_BaconUps_100");
  assert.equal(
    bagurgle.goldenDescription,
    "战吼：使你手牌中和场上的所有其他鱼人获得+8/+8。",
  );
  assert.deepEqual(bagurgle.battlecry, [
    {
      kind: "buffOwnedTribe",
      tribe: "murloc",
      attack: 4,
      health: 4,
    },
  ]);

  const primalfin = getMinionDefinition("BGS_020");
  assert.equal(primalfin.goldenCardId, "TB_BaconUps_089");
  assert.equal(
    primalfin.goldenDescription,
    "战吼：如果你控制着其他鱼人，发现2张鱼人牌。",
  );
  assert.deepEqual(primalfin.interactiveBattlecry, {
    kind: "discoverMinion",
    tribe: "murloc",
    requiresOtherTribe: "murloc",
    goldenMode: "repeat",
  });

  for (const definitionId of [
    "BG23_008",
    "BG34_858",
    "BG34_865",
    "BGS_030",
    "BGS_020",
  ]) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
    );
  }
});

test("ordinary and Golden Glowscale both grant one real Glowing Crown with matching art", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xd3400 + Number(golden));
    let player = humanPlayer(state);
    const target = definitionMinion(
      "BG25_001",
      `glowscale-target-${golden}`,
    );
    const source = golden
      ? goldenMinion("BG23_008", `glowscale-${golden}`)
      : definitionMinion("BG23_008", `glowscale-${golden}`);
    player.board = [target];
    player.hand = [source];

    state = playHandMinion(state, source.instanceId);
    player = humanPlayer(state);
    const crowns = player.hand.filter(
      (card): card is SpellcraftSpellInstance =>
        card.kind === "spellcraft" &&
        card.definitionId === "spellcraft-glowing-crown",
    );
    assert.equal(crowns.length, 1);
    assert.equal(
      crowns[0].cardId,
      golden ? "BG23_008_Gt" : "BG23_008t",
    );

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: crowns[0].instanceId,
      targetInstanceId: target.instanceId,
    });
    const shielded = humanPlayer(state).board.find(
      (minion) => minion.instanceId === target.instanceId,
    );
    assert.ok(shielded);
    assert.equal(shielded.divineShield, true);
    assert.equal(shielded.temporaryDivineShield, true);
  }
});

test("Air Revenant casts each Ride the Wind separately at every seven-Gold threshold", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xd3410 + Number(golden));
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BG34_858", `revenant-${golden}`)
      : definitionMinion("BG34_858", `revenant-${golden}`);
    const brann = definitionMinion(
      "BG_LOE_077",
      `revenant-brann-${golden}`,
    );
    player.board = [source, brann];
    player.gold = 10;
    player.maxGold = 10;
    player.tavernSpellAttackBonus = 2;
    player.tavernSpellHealthBonus = 3;

    for (let refresh = 0; refresh < 6; refresh += 1) {
      state = gameReducer(state, { type: "REFRESH_SHOP" });
    }
    player = humanPlayer(state);
    assert.deepEqual(player.rideTheWindBuffs, []);
    const almostReadySource = player.board.find(
      (minion) => minion.instanceId === source.instanceId,
    );
    assert.match(almostReadySource?.description ?? "", /还剩1枚/u);

    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);
    const expectedCasts = golden ? 2 : 1;
    assert.equal(player.tavernSpellsCastThisTurn, expectedCasts);
    assert.deepEqual(
      player.rideTheWindBuffs,
      Array.from({ length: expectedCasts }, () => ({
        attack: 8,
        health: 9,
      })),
    );
    const nextSource = player.board.find(
      (minion) => minion.instanceId === source.instanceId,
    );
    assert.match(nextSource?.description ?? "", /还剩7枚/u);
  }
});

test("Golden Lamp Genie with Brann installs four independent future Refresh pulses", () => {
  let state = createGame(0xd3420);
  let player = humanPlayer(state);
  const brann = definitionMinion("BG_LOE_077", "lamp-brann");
  const lamp = goldenMinion("BG34_865", "golden-lamp");
  const currentOffer = definitionMinion(
    "BG25_001",
    "lamp-current-offer",
  );
  const currentStats = [currentOffer.attack, currentOffer.health];
  player.board = [brann];
  player.shop = [currentOffer];
  player.hand = [lamp];
  player.gold = 1;

  state = playHandMinion(state, lamp.instanceId);
  player = humanPlayer(state);
  assert.deepEqual(
    player.rideTheWindBuffs,
    Array.from({ length: 4 }, () => ({
      attack: 7,
      health: 7,
    })),
  );
  assert.deepEqual(
    [player.shop[0].attack, player.shop[0].health],
    currentStats,
    "the Battlecry installs only future Refresh effects",
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  const totalRefreshGain = player.shop.reduce((total, minion) => {
    const definition = getMinionDefinition(minion.definitionId);
    return (
      total +
      minion.attack -
      definition.attack +
      minion.health -
      definition.health
    );
  }, 0);
  assert.equal(totalRefreshGain, 56);
});

test("Golden King Bagurgle with Brann buffs every other owned Murloc in board and hand", () => {
  let state = createGame(0xd3430);
  let player = humanPlayer(state);
  const brann = definitionMinion("BG_LOE_077", "bagurgle-brann");
  const boardMurloc = definitionMinion(
    "BG25_001",
    "bagurgle-board-murloc",
    { tribe: "murloc", tribes: ["murloc"] },
  );
  const allMinion = definitionMinion(
    "BG25_008",
    "bagurgle-board-all",
    { tribe: "all", tribes: ["all"] },
  );
  const handMurloc = definitionMinion(
    "BG25_009",
    "bagurgle-hand-murloc",
    { tribe: "murloc", tribes: ["murloc"] },
  );
  const nonMurloc = definitionMinion(
    "BG25_010",
    "bagurgle-hand-non-murloc",
  );
  const bagurgle = goldenMinion("BGS_030", "golden-bagurgle");
  const before = new Map(
    [brann, boardMurloc, allMinion, handMurloc, nonMurloc, bagurgle].map(
      (minion) => [
        minion.instanceId,
        [minion.attack, minion.health] as const,
      ],
    ),
  );
  player.board = [brann, boardMurloc, allMinion];
  player.hand = [bagurgle, handMurloc, nonMurloc];

  state = playHandMinion(state, bagurgle.instanceId);
  player = humanPlayer(state);
  const updated = [
    ...player.board,
    ...minionCardsInHand(player),
  ];
  for (const instanceId of [
    boardMurloc.instanceId,
    allMinion.instanceId,
    handMurloc.instanceId,
  ]) {
    const target = updated.find(
      (minion) => minion.instanceId === instanceId,
    );
    assert.ok(target);
    assert.deepEqual(
      [target.attack, target.health],
      [
        (before.get(instanceId)?.[0] ?? 0) + 16,
        (before.get(instanceId)?.[1] ?? 0) + 16,
      ],
    );
  }
  for (const instanceId of [
    brann.instanceId,
    nonMurloc.instanceId,
    bagurgle.instanceId,
  ]) {
    const target = updated.find(
      (minion) => minion.instanceId === instanceId,
    );
    assert.ok(target);
    assert.deepEqual(
      [target.attack, target.health],
      before.get(instanceId),
    );
  }
});

test("Primalfin Lookout requires another Murloc and chains Golden Brann discoveries", () => {
  {
    let state = createGame(0xd3440);
    const player = humanPlayer(state);
    const source = definitionMinion("BGS_020", "lone-primalfin");
    player.board = [];
    player.hand = [source];

    state = playHandMinion(state, source.instanceId);
    assert.equal(state.pendingInteraction, null);
    assert.equal(minionCardsInHand(humanPlayer(state)).length, 0);
  }

  {
    let state = createGame(0xd3441);
    let player = humanPlayer(state);
    state.activeTribes = ["murloc"];
    keepOnlyPoolDefinitions(state, PRIMALFIN_DISCOVER_IDS);
    player.tavernTier = 5;
    const brann = definitionMinion("BG_LOE_077", "primalfin-brann");
    const otherMurloc = definitionMinion(
      "BG25_001",
      "primalfin-other-murloc",
      { tribe: "murloc", tribes: ["murloc"] },
    );
    const source = goldenMinion("BGS_020", "golden-primalfin");
    player.board = [brann, otherMurloc];
    player.hand = [source];

    state = playHandMinion(state, source.instanceId);
    assert.equal(state.pendingInteraction?.kind, "discover");
    if (state.pendingInteraction?.kind !== "discover") {
      assert.fail("expected chained Primalfin Discover");
    }
    assert.equal(state.pendingInteraction.remainingDiscoveries, 4);

    const selectedDefinitionIds: string[] = [];
    while (state.pendingInteraction?.kind === "discover") {
      const pending = state.pendingInteraction;
      assert.ok(
        pending.options.every((option) =>
          option.tribes.includes("murloc"),
        ),
      );
      const selected = pending.options[0];
      selectedDefinitionIds.push(selected.definitionId);
      state = gameReducer(state, {
        type: "RESOLVE_INTERACTION",
        interactionId: pending.interactionId,
        optionInstanceId: selected.instanceId,
      });
    }

    player = humanPlayer(state);
    assert.equal(state.pendingInteraction, null);
    assert.equal(minionCardsInHand(player).length, 4);
    assert.equal(new Set(selectedDefinitionIds).size, 4);
    assert.ok(
      minionCardsInHand(player).every(
        (minion) =>
          minion.poolCopies === 1 &&
          minion.tribes.includes("murloc"),
      ),
    );
    assert.equal(
      PRIMALFIN_DISCOVER_IDS.reduce(
        (total, definitionId) =>
          total + (state.pool[definitionId] ?? 0),
        0,
      ),
      0,
    );
  }
});

test("v33 saves migrate to v34 and refresh all five newly complete definitions", () => {
  const legacy = structuredClone(createGame(0xd3450));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V33;
  const player = humanPlayer(legacy);
  player.rideTheWindBuffs = [{ attack: 7, health: 7 }];
  player.board = [
    definitionMinion("BG23_008", "legacy-glowscale", {
      effectSupport: "partial",
    }),
    definitionMinion("BG34_858", "legacy-revenant", {
      effectSupport: "partial",
    }),
  ];

  const migrated = normalizePersistedGameState(legacy);
  assert.ok(migrated);
  const migratedState = migrated as GameState;
  assert.equal(
    migratedState.contentVersion,
    CURRENT_ROSTER_VERSION,
  );
  assert.deepEqual(
    humanPlayer(migratedState).rideTheWindBuffs,
    [{ attack: 7, health: 7 }],
  );
  assert.equal(
    humanPlayer(migratedState).board.every(
      (minion) => minion.effectSupport === "complete",
    ),
    true,
  );
  for (const definitionId of [
    "BG23_008",
    "BG34_858",
    "BG34_865",
    "BGS_030",
    "BGS_020",
  ]) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
    );
  }
});
