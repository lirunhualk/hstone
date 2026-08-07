import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function minion(
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
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
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
  return minion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    attack: definition.attack * 2,
    health: definition.health * 2,
    description: definition.goldenDescription,
    ...overrides,
  });
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

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): void {
  const enemy = state.players.find((player) => !player.isHuman);
  assert.ok(enemy);
  for (const player of state.players) {
    if (player.isHuman) {
      player.alive = true;
      player.health = 1_000;
      continue;
    }
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.id === enemy.id) {
      player.alive = true;
      player.health = 1_000;
      player.board = enemyBoard;
    } else {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
}

test("v47 exposes complete Spacefarer and Kalecgos rules", () => {
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v52",
  );
  const spacefarer = getMinionDefinition("BG31_820");
  assert.equal(spacefarer.effectSupport, "complete");
  assert.deepEqual(spacefarer.afterFriendlyGainsAttack, {
    tribe: "pirate",
    otherOnly: true,
    health: 2,
    goldenMode: "doubleStats",
  });
  assert.equal(spacefarer.goldenDescription?.includes("+4生命值"), true);

  const kalecgos = getMinionDefinition("BGS_041");
  assert.equal(kalecgos.effectSupport, "complete");
  assert.equal(kalecgos.goldenCardId, "TB_BaconUps_109");
  assert.deepEqual(kalecgos.afterBattlecryTriggered, {
    tribe: "dragon",
    attack: 2,
    health: 2,
    goldenMode: "doubleStats",
  });
});

test("ordinary and Golden Spacefarers observe each Blood Gem Attack-gain pulse and exclude themselves", () => {
  let state = createGame(0xf701);
  let player = humanPlayer(state);
  const ordinary = minion("BG31_820", "spacefarer-ordinary");
  const golden = goldenMinion("BG31_820", "spacefarer-golden");
  const pirate = minion("tabbycat-token", "spacefarer-target", {
    attack: 10,
    health: 10,
    tribe: "pirate",
    tribes: ["pirate"],
  });
  player.board = [ordinary, golden, pirate];
  player.hand = [bloodGem("spacefarer-gem-1")];

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "spacefarer-gem-1",
    targetInstanceId: pirate.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((candidate) => [candidate.attack, candidate.health]),
    [
      [3, 8],
      [6, 16],
      [11, 11],
    ],
  );

  player.hand = [bloodGem("spacefarer-gem-2")];
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "spacefarer-gem-2",
    targetInstanceId: ordinary.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((candidate) => [candidate.attack, candidate.health]),
    [
      [4, 9],
      [6, 20],
      [11, 11],
    ],
  );
});

test("Brann repeats each Battlecry pulse and ordinary plus Golden Kalecgos buff every Dragon after each pulse", () => {
  const state = createGame(0xf702);
  const player = humanPlayer(state);
  const ordinary = minion("BGS_041", "kalecgos-ordinary");
  const golden = goldenMinion("BGS_041", "kalecgos-golden");
  const dragon = minion("tabbycat-token", "kalecgos-target", {
    attack: 1,
    health: 1,
    tribe: "dragon",
    tribes: ["dragon"],
  });
  player.board = [
    ordinary,
    golden,
    dragon,
    minion("BG_LOE_077", "kalecgos-brann"),
  ];
  player.hand = [minion("nathrezim-overseer", "kalecgos-battlecry")];

  const next = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
  });
  const nextPlayer = humanPlayer(next);
  assert.deepEqual(
    nextPlayer.board.slice(0, 3).map((candidate) => [candidate.attack, candidate.health]),
    [
      [16, 24],
      [20, 36],
      [13, 13],
    ],
  );
});

test("interactive Battlecries wait for their target resolution before Kalecgos triggers", () => {
  let state = createGame(0xf703);
  let player = humanPlayer(state);
  const kalecgos = minion("BGS_041", "interactive-kalecgos");
  const target = minion("tabbycat-token", "interactive-dragon", {
    attack: 1,
    health: 1,
    tribe: "dragon",
    tribes: ["dragon", "pirate"],
  });
  player.board = [kalecgos, target];
  player.hand = [minion("BG26_814", "interactive-battlecry")];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [4, 12],
  );
  assert.equal(state.pendingInteraction?.kind, "target");
  assert.equal(state.pendingInteraction?.battlecry, true);
  const interaction = state.pendingInteraction;
  assert.ok(interaction);

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: interaction.interactionId,
    optionInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [6, 14],
  );
  assert.equal(state.pendingInteraction, null);
});

test("an interactive Battlecry with no legal target still triggers Kalecgos", () => {
  const state = createGame(0xf705);
  const player = humanPlayer(state);
  player.board = [minion("BGS_041", "fizzled-kalecgos")];
  player.hand = [minion("BGS_020", "fizzled-battlecry")];

  const next = gameReducer(state, {
    type: "PLAY_MINION",
    handIndex: 0,
  });
  const nextPlayer = humanPlayer(next);
  assert.equal(next.pendingInteraction, null);
  assert.deepEqual(
    [nextPlayer.board[0].attack, nextPlayer.board[0].health],
    [6, 14],
  );
});

test("a Golden interactive Battlecry completes one Kalecgos trigger only after both effect repetitions", () => {
  let state = createGame(0xf706);
  let player = humanPlayer(state);
  const kalecgos = minion("BGS_041", "golden-interactive-kalecgos");
  const otherMurloc = minion("tabbycat-token", "golden-interactive-murloc", {
    tribe: "murloc",
    tribes: ["murloc"],
  });
  player.board = [kalecgos, otherMurloc];
  player.hand = [goldenMinion("BGS_020", "golden-interactive-battlecry")];

  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  for (let discovery = 0; discovery < 2; discovery += 1) {
    const interaction = state.pendingInteraction;
    assert.equal(interaction?.kind, "discover");
    assert.ok(interaction?.kind === "discover");
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: interaction.interactionId,
      optionInstanceId: interaction.options[0].instanceId,
    });
    player = humanPlayer(state);
    assert.deepEqual(
      [player.board[0].attack, player.board[0].health],
      discovery === 0 ? [4, 12] : [6, 14],
    );
  }
  assert.equal(state.pendingInteraction, null);
});

test("Rylak-triggered combat Battlecries feed both Spacefarer and Kalecgos in causal event order", () => {
  const state = createGame(0xf704);
  const player = humanPlayer(state);
  const spacefarer = minion("BG31_820", "combat-spacefarer");
  const kalecgos = minion("BGS_041", "combat-kalecgos");
  const target = minion("tabbycat-token", "combat-multitype-target", {
    attack: 3,
    health: 100,
    tribe: "dragon",
    tribes: ["dragon", "demon", "pirate"],
  });
  const rylak = minion("BG26_801", "combat-rylak", { health: 1 });
  const battlecry = minion("nathrezim-overseer", "combat-battlecry", {
    attack: 0,
    health: 100,
  });
  player.board = [spacefarer, kalecgos, target, rylak, battlecry];
  prepareDuel(
    state,
    Array.from({ length: 6 }, (_, index) =>
      minion("defender-of-argus", `combat-enemy-${index}`, {
        attack: index === 0 ? 1 : 0,
        health: 100_000,
        taunt: index === 0,
      }),
    ),
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = combat.lastBattle?.events ?? [];
  const sourceBuff = events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === battlecry.instanceId &&
      event.targetInstanceId === target.instanceId &&
      event.attackDelta === 2 &&
      event.healthDelta === 2,
  );
  assert.ok(sourceBuff);
  const spacefarerBuff = events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === spacefarer.instanceId &&
      event.targetInstanceId === spacefarer.instanceId &&
      event.healthDelta === 2,
  );
  assert.ok(spacefarerBuff);
  const kalecgosBuff = events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === kalecgos.instanceId &&
      event.targetInstanceId === target.instanceId &&
      event.attackDelta === 2 &&
      event.healthDelta === 2,
  );
  assert.ok(kalecgosBuff);
  assert.equal(sourceBuff.index + 1, spacefarerBuff.index);
  assert.ok(spacefarerBuff.index < kalecgosBuff.index);
  assert.equal(spacefarerBuff.retained, false);
  assert.equal(kalecgosBuff.retained, false);
});

test("each Wrathscale Health-to-Attack packet notifies Spacefarers exactly once", () => {
  let state = createGame(0xf707);
  let player = humanPlayer(state);
  const ordinarySpacefarer = minion("BG31_820", "chain-spacefarer");
  const goldenSpacefarer = goldenMinion(
    "BG31_820",
    "chain-spacefarer-golden",
  );
  const ordinaryWrathscale = minion("BG33_920", "chain-wrathscale");
  const goldenWrathscale = goldenMinion(
    "BG33_920",
    "chain-wrathscale-golden",
  );
  const pirate = minion("tabbycat-token", "chain-pirate", {
    attack: 10,
    health: 10,
    tribe: "pirate",
    tribes: ["pirate", "naga"],
  });
  player.board = [
    ordinarySpacefarer,
    goldenSpacefarer,
    ordinaryWrathscale,
    goldenWrathscale,
    pirate,
  ];
  player.hand = [bloodGem("chain-gem")];

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "chain-gem",
    targetInstanceId: pirate.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((candidate) => [candidate.attack, candidate.health]),
    [
      [3, 12],
      [6, 24],
      [3, 6],
      [6, 12],
      [14, 11],
    ],
  );
});

test("explicit permanent combat Attack gains notify Spacefarer once while its response remains combat-only", () => {
  const state = createGame(0xf708);
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  const ribbon = ACTIVE_TRINKET_DEFINITIONS.find(
    (definition) => definition.cardId === "BG35_MagicItem_923",
  );
  assert.ok(ribbon);
  player.trinketIds = [ribbon.id];
  player.trinketCounters = { [ribbon.id]: 0 };
  const tideRaiser = minion("BG34_920", "spacefarer-tide-raiser", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  const spacefarer = minion("BG31_820", "explicit-spacefarer", {
    health: 1_000,
  });
  const pirate = minion("tabbycat-token", "explicit-pirate", {
    attack: 0,
    health: 1_000,
    tribe: "pirate",
    tribes: ["pirate"],
  });
  player.board = [tideRaiser, spacefarer, pirate];
  prepareDuel(state, [
    minion("defender-of-argus", "explicit-spacefarer-enemy", {
      attack: 1,
      health: 100_000,
      taunt: true,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const events = combat.lastBattle?.events ?? [];
  const ribbonBuff = events.find(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === ribbon.id &&
      event.targetInstanceId === pirate.instanceId &&
      event.attackDelta === 2 &&
      event.healthDelta === 2 &&
      event.retained === true,
  );
  assert.ok(ribbonBuff);
  const spacefarerBuffs = events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === spacefarer.instanceId &&
      event.targetInstanceId === spacefarer.instanceId &&
      event.attackDelta === 0 &&
      event.healthDelta === 2,
  );
  assert.equal(spacefarerBuffs.length, 1);
  assert.equal(spacefarerBuffs[0].index, ribbonBuff.index + 1);
  assert.equal(spacefarerBuffs[0].retained, false);
  assert.equal(spacefarerBuffs[0].retentionMultiplier, undefined);

  const persistentSpacefarer = humanPlayer(combat).board.find(
    (candidate) => candidate.instanceId === spacefarer.instanceId,
  );
  assert.ok(persistentSpacefarer);
  assert.deepEqual(
    [persistentSpacefarer.attack, persistentSpacefarer.health],
    [5, 1_002],
  );
});
