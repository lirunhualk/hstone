import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type MagneticAttachment,
  type PlayerState,
  type Tribe,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";

const ALL_LOBBY_TRIBES: Tribe[] = [
  "beast",
  "mech",
  "demon",
  "murloc",
  "dragon",
  "pirate",
  "elemental",
  "naga",
  "quilboar",
  "undead",
];

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

function attachment(
  definitionId: string,
  sourceInstanceId: string,
  golden = false,
): MagneticAttachment {
  const definition = getMinionDefinition(definitionId);
  return {
    sourceInstanceId,
    definitionId,
    cardId:
      golden && definition.goldenCardId
        ? definition.goldenCardId
        : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    effectSupport: definition.effectSupport ?? "complete",
    golden,
    poolCopies: 0,
    attackGranted: 0,
    healthGranted: 0,
    attachments: [],
  };
}

function rylakCarrier(
  instanceId: string,
  golden = false,
): BoardMinionInstance {
  return minion("BG25_001", instanceId, {
    reborn: false,
    taunt: false,
    attachments: [
      attachment("BG26_801", `${instanceId}-rylak-component`, golden),
    ],
  });
}

function restrictMinionPool(
  state: GameState,
  copies: Readonly<Record<string, number>>,
): void {
  state.activeTribes = [...ALL_LOBBY_TRIBES];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const [definitionId, count] of Object.entries(copies)) {
    state.pool[definitionId] = count;
  }
}

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): void {
  state.lobbySystemsEnabled = false;
  const enemy = state.players.find((player) => !player.isHuman);
  assert.ok(enemy);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.isHuman) {
      player.alive = true;
      player.health = 1_000;
      player.armor = 0;
      continue;
    }
    player.hand = [];
    player.ghostHand = [];
    if (player.id === enemy.id) {
      player.alive = true;
      player.health = 1_000;
      player.board = enemyBoard;
      continue;
    }
    player.alive = false;
    player.health = 0;
    player.board = [];
    player.eliminatedRound = 0;
  }
}

function lethalWall(instanceId: string): BoardMinionInstance {
  return minion("defender-of-argus", instanceId, {
    attack: 100,
    health: 1,
    taunt: true,
    divineShield: false,
  });
}

function playGraverobberAndDestroy(
  state: GameState,
  graverobberInstanceId: string,
  targetInstanceId: string,
): GameState {
  let next = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: graverobberInstanceId,
  });
  const interaction = next.pendingInteraction;
  assert.equal(interaction?.kind, "target");
  assert.ok(interaction?.kind === "target");
  assert.ok(interaction.optionInstanceIds.includes(targetInstanceId));
  next = gameReducer(next, {
    type: "RESOLVE_INTERACTION",
    interactionId: interaction.interactionId,
    optionInstanceId: targetInstanceId,
  });
  return next;
}

function prepareGhostMatch(
  state: GameState,
  ghostBoard: BoardMinionInstance[],
): PlayerState {
  state.lobbySystemsEnabled = false;
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.armor = 0;
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
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
    player.health = 1_000;
    player.board = [lethalWall(`rylak-ghost-wall-${index}`)];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.board = ghostBoard;
  return ghost;
}

test("Rylak metadata and combat targeting distinguish one random adjacent minion from both Golden adjacencies", () => {
  const definition = getMinionDefinition("BG26_801");
  assert.deepEqual(
    [
      definition.name,
      definition.tier,
      definition.attack,
      definition.health,
      definition.tribe,
      definition.effectSupport,
    ],
    ["重金属双头飞龙", 4, 5, 3, "beast", "complete"],
  );
  assert.equal(definition.goldenCardId, "BG26_801_G");
  assert.deepEqual(definition.deathrattle, [
    {
      kind: "triggerAdjacentBattlecries",
      goldenMode: "allAdjacent",
    },
  ]);

  const selectedSides = new Set<string>();
  for (let index = 0; index < 16; index += 1) {
    const state = createGame(0xfb00 + index);
    const player = humanPlayer(state);
    const left = minion("BG35_702", "rylak-random-left", {
      attack: 0,
      health: 100_000,
    });
    const source = minion("BG26_801", "rylak-random-source", {
      attack: 1,
      health: 1,
    });
    const right = minion("BG35_702", "rylak-random-right", {
      attack: 0,
      health: 100_000,
    });
    player.board = [left, source, right];
    prepareDuel(state, [lethalWall(`rylak-random-wall-${index}`)]);

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    const triggers = battle.events.filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === source.instanceId &&
        (event.targetInstanceId === left.instanceId ||
          event.targetInstanceId === right.instanceId),
    );
    assert.equal(triggers.length, 1);
    assert.ok(triggers.every(isCombatPlaybackEvent));
    assert.equal(triggers[0].amount, 1);
    assert.ok(triggers[0].targetInstanceId);
    selectedSides.add(triggers[0].targetInstanceId);
  }
  assert.deepEqual(
    [...selectedSides].sort(),
    ["rylak-random-left", "rylak-random-right"],
  );

  const goldenState = createGame(0xfb20);
  const goldenPlayer = humanPlayer(goldenState);
  const goldenLeft = minion("BG35_702", "rylak-golden-left", {
    attack: 0,
    health: 100_000,
  });
  const goldenSource = goldenMinion("BG26_801", "rylak-golden-source", {
    attack: 1,
    health: 1,
  });
  const goldenRight = minion("BG35_702", "rylak-golden-right", {
    attack: 0,
    health: 100_000,
  });
  goldenPlayer.board = [goldenLeft, goldenSource, goldenRight];
  prepareDuel(goldenState, [lethalWall("rylak-golden-wall")]);

  const goldenCombat = gameReducer(goldenState, { type: "END_TURN" });
  const goldenBattle = goldenCombat.lastBattle;
  assert.ok(goldenBattle);
  const goldenTriggers = goldenBattle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === goldenSource.instanceId &&
      (event.targetInstanceId === goldenLeft.instanceId ||
        event.targetInstanceId === goldenRight.instanceId),
  );
  assert.equal(goldenTriggers.length, 2);
  assert.deepEqual(
    goldenTriggers.map((event) => event.targetInstanceId).sort(),
    [goldenLeft.instanceId, goldenRight.instanceId].sort(),
  );
  assert.ok(goldenTriggers.every(isCombatPlaybackEvent));
});

test("Titus repeats Rylak's Deathrattle while Brann repeats each automatically resolved targeted Battlecry", () => {
  const state = createGame(0xfb30);
  const player = humanPlayer(state);
  const titus = minion("titus-rivendare", "rylak-repeat-titus", {
    attack: 0,
    health: 100_000,
  });
  const brann = minion("BG_LOE_077", "rylak-repeat-brann", {
    attack: 0,
    health: 100_000,
  });
  const battlecry = minion("BG35_702", "rylak-repeat-battlecry", {
    attack: 0,
    health: 100_000,
  });
  const source = minion("BG26_801", "rylak-repeat-source", {
    attack: 1,
    health: 1,
  });
  player.board = [titus, brann, battlecry, source];
  prepareDuel(state, [lethalWall("rylak-repeat-wall")]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const triggers = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === source.instanceId &&
      event.targetInstanceId === battlecry.instanceId,
  );
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === battlecry.instanceId &&
      (event.targetInstanceId === titus.instanceId ||
        event.targetInstanceId === brann.instanceId),
  );
  assert.equal(triggers.length, 2);
  assert.deepEqual(
    triggers.map((event) => event.amount),
    [2, 2],
  );
  assert.equal(buffs.length, 4);
  assert.ok(
    buffs.every(
      (event) =>
        isCombatPlaybackEvent(event) &&
        event.attackDelta === 2 &&
        event.healthDelta === 2 &&
        event.retained === false,
    ),
  );
});

test("a Recruit-phase Rylak component automatically resolves targetedBuff without opening a target prompt", () => {
  const state = createGame(0xfb40);
  const player = humanPlayer(state);
  const carrier = rylakCarrier("rylak-recruit-buff-carrier");
  const battlecry = minion("BG35_702", "rylak-recruit-buff-source");
  const graverobber = minion("BG28_303", "rylak-recruit-buff-graverobber");
  player.board = [carrier, battlecry];
  player.hand = [graverobber];

  const next = playGraverobberAndDestroy(
    state,
    graverobber.instanceId,
    carrier.instanceId,
  );
  const nextPlayer = humanPlayer(next);
  const grown = nextPlayer.board.find(
    (candidate) => candidate.instanceId === graverobber.instanceId,
  );
  assert.ok(grown);
  assert.deepEqual(
    [grown.attack, grown.health],
    [graverobber.attack + 2, graverobber.health + 2],
  );
  assert.equal(next.pendingInteraction, null);
});

test("Rylak-triggered discoverMinion consumes the shared pool, damages the hero, and burns a full-hand result only after returning it", () => {
  for (const [index, fullHand] of [false, true].entries()) {
    const state = createGame(0xfb50 + index);
    const player = humanPlayer(state);
    const percussionist = minion(
      "BG26_525",
      `rylak-discover-minion-${index}`,
      { attack: 0, health: 100_000 },
    );
    const source = minion("BG26_801", `rylak-discover-source-${index}`, {
      attack: 1,
      health: 1,
    });
    player.board = [percussionist, source];
    prepareDuel(state, [lethalWall(`rylak-discover-wall-${index}`)]);
    const preparedPlayer = humanPlayer(state);
    preparedPlayer.tavernTier = 6;
    preparedPlayer.health = 100;
    preparedPlayer.armor = 0;
    preparedPlayer.hand = fullHand
      ? Array.from({ length: 10 }, (_, handIndex) =>
          minion("BG25_001", `rylak-full-hand-${index}-${handIndex}`),
        )
      : [];
    restrictMinionPool(state, { BG26_524: 1 });
    const discoveredDefinition = getMinionDefinition("BG26_524");

    const combat = gameReducer(state, { type: "END_TURN" });
    const battle = combat.lastBattle;
    assert.ok(battle);
    const heroDamage = battle.events.filter(
      (event) =>
        event.type === "heroDamage" &&
        event.actorInstanceId === percussionist.instanceId &&
        event.targetPlayerId === preparedPlayer.id,
    );
    const cardGains = battle.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === percussionist.instanceId &&
        event.cardKind === "minion",
    );
    assert.equal(heroDamage.length, 1);
    assert.equal(heroDamage[0].amount, discoveredDefinition.tier);
    assert.equal(heroDamage[0].armorAbsorbed, 0);
    assert.equal(heroDamage[0].healthDamage, discoveredDefinition.tier);
    assert.ok(heroDamage.every(isCombatPlaybackEvent));
    assert.equal(cardGains.length, 1);
    assert.equal(
      cardGains[0].cardGainResult,
      fullHand ? "handFull" : "added",
    );
    assert.ok(cardGains.every(isCombatPlaybackEvent));

    const persisted = humanPlayer(combat);
    assert.equal(persisted.health, 100 - discoveredDefinition.tier);
    assert.equal(persisted.hand.length, fullHand ? 10 : 1);
    assert.equal(
      persisted.hand.some(
        (card) =>
          card.kind === "minion" && card.definitionId === "BG26_524",
      ),
      !fullHand,
    );
    assert.equal(combat.pool.BG26_524, fullHand ? 1 : 0);
  }
});

test("a Recruit-phase Rylak component resolves discoverTavernSpell immediately into the hand", () => {
  const state = createGame(0xfb60);
  const player = humanPlayer(state);
  const carrier = rylakCarrier("rylak-spell-carrier");
  const arena = minion("BG28_550", "rylak-spell-arena");
  const graverobber = minion("BG28_303", "rylak-spell-graverobber");
  player.board = [carrier, arena];
  player.hand = [graverobber];

  const next = playGraverobberAndDestroy(
    state,
    graverobber.instanceId,
    carrier.instanceId,
  );
  const spells = humanPlayer(next).hand.filter(
    (card) => card.kind === "tavernSpell",
  );
  assert.equal(spells.length, 1);
  assert.equal(next.pendingInteraction, null);
});

test("a Recruit-phase Rylak component lets Graverobber destroy the only eligible Undead and gain its plain original", () => {
  const state = createGame(0xfb70);
  const player = humanPlayer(state);
  const target = minion("BG28_300", "rylak-copy-target", {
    attack: 30,
    health: 40,
    reborn: false,
    taunt: false,
  });
  const carrier = rylakCarrier("rylak-copy-carrier");
  const graverobber = minion("BG28_303", "rylak-copy-graverobber");
  player.board = [target, carrier];
  player.hand = [graverobber];

  const next = playGraverobberAndDestroy(
    state,
    graverobber.instanceId,
    carrier.instanceId,
  );
  const nextPlayer = humanPlayer(next);
  assert.equal(
    nextPlayer.board.some(
      (candidate) => candidate.instanceId === target.instanceId,
    ),
    false,
  );
  const copies = nextPlayer.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === target.definitionId,
  );
  assert.equal(copies.length, 1);
  const definition = getMinionDefinition(target.definitionId);
  assert.deepEqual(
    [
      copies[0].golden,
      copies[0].attack,
      copies[0].health,
      copies[0].reborn,
      copies[0].poolCopies,
    ],
    [
      false,
      definition.attack,
      definition.health,
      definition.reborn === true,
      0,
    ],
  );
  assert.equal(next.pendingInteraction, null);
});

test("Rylak automatically discovers and Magnetizes a shared-pool Mech in Recruit and emits a combat buff while advancing the real counter", () => {
  const magneticDefinition = getMinionDefinition("BG_BOT_911");
  assert.ok(magneticDefinition.magnetic);

  const recruitState = createGame(0xfb80);
  const recruitPlayer = humanPlayer(recruitState);
  recruitPlayer.tavernTier = 6;
  const recruitHost = minion("BG29_611", "rylak-magnet-recruit-host");
  const carrier = rylakCarrier("rylak-magnet-carrier");
  const clunker = minion("BG29_503", "rylak-magnet-recruit-clunker");
  const graverobber = minion("BG28_303", "rylak-magnet-graverobber");
  recruitPlayer.board = [recruitHost, carrier, clunker];
  recruitPlayer.hand = [graverobber];
  restrictMinionPool(recruitState, { BG_BOT_911: 1 });

  const recruitNext = playGraverobberAndDestroy(
    recruitState,
    graverobber.instanceId,
    carrier.instanceId,
  );
  const recruitPersisted = humanPlayer(recruitNext);
  const fusedHost = recruitPersisted.board.find(
    (candidate) => candidate.instanceId === recruitHost.instanceId,
  );
  assert.ok(fusedHost);
  assert.equal(
    fusedHost.attachments.some(
      (candidate) => candidate.definitionId === magneticDefinition.id,
    ),
    true,
  );
  assert.deepEqual(
    [fusedHost.attack, fusedHost.health],
    [
      recruitHost.attack + magneticDefinition.attack,
      recruitHost.health + magneticDefinition.health,
    ],
  );
  assert.equal(recruitPersisted.magnetizationsThisGame, 1);
  // Magnetized pool copies return immediately under the live pool rule.
  assert.equal(recruitNext.pool.BG_BOT_911, 1);
  assert.equal(recruitNext.pendingInteraction, null);

  const combatState = createGame(0xfb81);
  const combatPlayer = humanPlayer(combatState);
  combatPlayer.tavernTier = 6;
  const combatHost = minion("BG29_611", "rylak-magnet-combat-host", {
    attack: 0,
    health: 100_000,
  });
  const combatClunker = minion("BG29_503", "rylak-magnet-combat-clunker", {
    attack: 0,
    health: 100_000,
  });
  const combatRylak = minion("BG26_801", "rylak-magnet-combat-source", {
    attack: 1,
    health: 1,
  });
  combatPlayer.board = [combatHost, combatClunker, combatRylak];
  prepareDuel(combatState, [lethalWall("rylak-magnet-combat-wall")]);
  humanPlayer(combatState).tavernTier = 6;
  restrictMinionPool(combatState, { BG_BOT_911: 1 });

  const combat = gameReducer(combatState, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const buffs = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === combatClunker.instanceId &&
      event.targetInstanceId === combatHost.instanceId,
  );
  assert.equal(buffs.length, 1);
  assert.ok(buffs.every(isCombatPlaybackEvent));
  assert.deepEqual(
    [buffs[0].attackDelta, buffs[0].healthDelta, buffs[0].retained],
    [magneticDefinition.attack, magneticDefinition.health, false],
  );
  assert.equal(humanPlayer(combat).magnetizationsThisGame, 1);
  assert.equal(combat.pool.BG_BOT_911, 1);
});

test("combat-triggered Graverobber emits a structured destroy-and-copy event without deleting the persistent Undead", () => {
  const state = createGame(0xfb90);
  const player = humanPlayer(state);
  const target = minion("BG25_001", "rylak-combat-copy-target", {
    attack: 0,
    health: 100_000,
    reborn: false,
    taunt: false,
  });
  const graverobber = minion("BG28_303", "rylak-combat-copy-source", {
    attack: 0,
    health: 100_000,
  });
  const source = minion("BG26_801", "rylak-combat-copy-rylak", {
    attack: 1,
    health: 1,
  });
  player.board = [target, graverobber, source];
  prepareDuel(state, [lethalWall("rylak-combat-copy-wall")]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const destroyEvents = battle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === graverobber.instanceId &&
      event.targetInstanceId === target.instanceId &&
      event.amount === 1,
  );
  assert.equal(destroyEvents.length, 1);
  assert.ok(destroyEvents.every(isCombatPlaybackEvent));
  assert.equal(
    humanPlayer(combat).board.some(
      (candidate) => candidate.instanceId === target.instanceId,
    ),
    true,
  );
  assert.equal(
    humanPlayer(combat).hand.filter(
      (card) =>
        card.kind === "minion" && card.definitionId === target.definitionId,
    ).length,
    1,
  );
});

test("ghost Rylak Discover Battlecries cannot mutate persistent hands, while ghost Magnetize animates without advancing its persistent counter", () => {
  const handState = createGame(0xfba0);
  restrictMinionPool(handState, { BG26_524: 1 });
  const percussionist = minion("BG26_525", "rylak-ghost-percussionist", {
    attack: 0,
    health: 100_000,
  });
  const handRylak = goldenMinion("BG26_801", "rylak-ghost-hand-source", {
    attack: 1,
    health: 1,
  });
  const arena = minion("BG28_550", "rylak-ghost-arena", {
    attack: 0,
    health: 100_000,
  });
  const handGhost = prepareGhostMatch(handState, [
    percussionist,
    handRylak,
    arena,
  ]);
  handGhost.tavernTier = 6;
  handGhost.hand = [minion("BG25_001", "rylak-ghost-hand-sentinel")];
  handGhost.ghostHand = [
    minion("BG25_001", "rylak-ghost-snapshot-sentinel"),
  ];
  const handBefore = structuredClone(handGhost.hand);
  const ghostHandBefore = structuredClone(handGhost.ghostHand);

  const handCombat = gameReducer(handState, { type: "END_TURN" });
  const handGhostBattle = handCombat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === handGhost.id || battle.playerBId === handGhost.id),
  );
  assert.ok(handGhostBattle);
  const discoverTriggers = handGhostBattle.events.filter(
    (event) =>
      event.type === "trigger" &&
      event.actorInstanceId === handRylak.instanceId &&
      (event.targetInstanceId === percussionist.instanceId ||
        event.targetInstanceId === arena.instanceId),
  );
  assert.equal(discoverTriggers.length, 2);
  assert.ok(discoverTriggers.every(isCombatPlaybackEvent));
  const persistedHandGhost = handCombat.players.find(
    (candidate) => candidate.id === handGhost.id,
  );
  assert.ok(persistedHandGhost);
  assert.deepEqual(persistedHandGhost.hand, handBefore);
  assert.deepEqual(persistedHandGhost.ghostHand, ghostHandBefore);
  assert.equal(
    handGhostBattle.events.some(
      (event) =>
        event.type === "cardGain" &&
        (event.actorInstanceId === percussionist.instanceId ||
          event.actorInstanceId === arena.instanceId),
    ),
    false,
  );

  const magnetState = createGame(0xfba1);
  restrictMinionPool(magnetState, { BG_BOT_911: 1 });
  const ghostHost = minion("BG29_611", "rylak-ghost-magnet-host", {
    attack: 0,
    health: 100_000,
  });
  const ghostClunker = minion("BG29_503", "rylak-ghost-magnet-clunker", {
    attack: 0,
    health: 100_000,
  });
  const magnetRylak = minion("BG26_801", "rylak-ghost-magnet-source", {
    attack: 1,
    health: 1,
  });
  const magnetGhost = prepareGhostMatch(magnetState, [
    ghostHost,
    ghostClunker,
    magnetRylak,
  ]);
  magnetGhost.tavernTier = 6;
  magnetGhost.magnetizationsThisGame = 7;
  const magnetBoardBefore = structuredClone(magnetGhost.board);

  const magnetCombat = gameReducer(magnetState, { type: "END_TURN" });
  const magnetGhostBattle = magnetCombat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === magnetGhost.id ||
        battle.playerBId === magnetGhost.id),
  );
  assert.ok(magnetGhostBattle);
  const magnetBuffs = magnetGhostBattle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === ghostClunker.instanceId &&
      event.targetInstanceId === ghostHost.instanceId,
  );
  assert.equal(magnetBuffs.length, 1);
  assert.ok(magnetBuffs.every(isCombatPlaybackEvent));
  assert.equal(magnetBuffs[0].retained, false);
  const persistedMagnetGhost = magnetCombat.players.find(
    (candidate) => candidate.id === magnetGhost.id,
  );
  assert.ok(persistedMagnetGhost);
  assert.equal(persistedMagnetGhost.magnetizationsThisGame, 7);
  assert.deepEqual(persistedMagnetGhost.board, magnetBoardBefore);
  assert.equal(magnetCombat.pool.BG_BOT_911, 1);
});
