import assert from "node:assert/strict";
import test from "node:test";

import { isCombatPlaybackEvent } from "../lib/game/combat-presentation.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";

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
  return definitionMinion(definitionId, instanceId, {
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    description: definition.goldenDescription,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
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

function prepareDuel(
  state: GameState,
  enemyBoard: BoardMinionInstance[] = [],
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
    player.lastOpponentId = undefined;
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
      player.armor = 0;
      player.board = enemyBoard;
      continue;
    }
    player.alive = false;
    player.health = 0;
    player.board = [];
    player.eliminatedRound = 0;
  }
}

test("Captain Sanders and Futurefin expose the exact ordinary and Golden rules", () => {
  const sanders = getMinionDefinition("BG25_034");
  assert.deepEqual(
    [sanders.tier, sanders.tribe, sanders.attack, sanders.health],
    [7, "pirate", 9, 9],
  );
  assert.equal(sanders.effectSupport, "complete");
  assert.equal(
    sanders.description,
    "战吼：使一个等级6或以下的友方随从变为金色。",
  );
  assert.equal(sanders.goldenCardId, "BG25_034_G");
  assert.equal(
    sanders.goldenDescription,
    "战吼：使两个等级6或以下的友方随从变为金色。",
  );
  assert.deepEqual(sanders.interactiveBattlecry, {
    kind: "makeFriendlyGolden",
    maximumTier: 6,
    targets: 1,
    goldenMode: "doubleTargets",
  });

  const futurefin = getMinionDefinition("BG34_145");
  assert.deepEqual(
    [futurefin.tier, futurefin.tribe, futurefin.attack, futurefin.health],
    [7, "murloc", 7, 13],
  );
  assert.equal(futurefin.effectSupport, "complete");
  assert.equal(
    futurefin.description,
    "在你的回合结束时，使你手牌中最左边的随从牌获得本随从的属性值。",
  );
  assert.equal(futurefin.goldenCardId, "BG34_145_G");
  assert.equal(
    futurefin.goldenDescription,
    "在你的回合结束时，使你手牌中最左边的随从牌获得本随从的双倍属性值。",
  );
  assert.deepEqual(futurefin.endOfTurn, {
    kind: "giveStatsToLeftmostHandMinion",
    goldenMode: "doubleStats",
  });
});

test("Captain Sanders targets only non-Golden Tier 6-or-lower friends and preserves enchantments", () => {
  let state = createGame(0x7330);
  const player = humanPlayer(state);
  const targetDefinition = getMinionDefinition("BG35_801");
  const target = definitionMinion("BG35_801", "sanders-target", {
    attack: targetDefinition.attack + 5,
    health: targetDefinition.health + 7,
  });
  const alreadyGolden = goldenMinion("BG26_ICC_901", "sanders-golden");
  const tierSeven = definitionMinion("BG34_145", "sanders-tier-seven");
  const source = definitionMinion("BG25_034", "sanders-source");
  const originalAttack = target.attack;
  const originalHealth = target.health;
  player.board = [target, alreadyGolden, tierSeven];
  player.hand = [source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.equal(pending?.kind, "target");
  assert.ok(pending?.kind === "target");
  assert.deepEqual(pending.optionInstanceIds, [target.instanceId]);
  assert.equal(pending.repetitions, 1);
  assert.deepEqual(pending.resolution, {
    kind: "makeGolden",
    maximumTier: 6,
  });

  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });
  const transformed = humanPlayer(state).board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(transformed);
  assert.equal(transformed.golden, true);
  assert.equal(transformed.cardId, targetDefinition.goldenCardId);
  assert.equal(transformed.description, targetDefinition.goldenDescription);
  assert.equal(transformed.attack, originalAttack + targetDefinition.attack);
  assert.equal(transformed.health, originalHealth + targetDefinition.health);
  assert.equal(transformed.grantsTripleReward, false);
  assert.equal(state.pendingInteraction, null);
});

test("Golden Captain Sanders with Brann survives JSON round-trips and selects four distinct targets", () => {
  let state = createGame(0x7331);
  const player = humanPlayer(state);
  const targetIds = [
    "sanders-brann-target-1",
    "sanders-brann-target-2",
    "sanders-brann-target-3",
    "sanders-brann-target-4",
  ];
  player.board = [
    definitionMinion("BG_LOE_077", "sanders-brann"),
    definitionMinion("BG29_611", targetIds[0]),
    definitionMinion("BG35_801", targetIds[1]),
    definitionMinion("BG25_001", targetIds[2]),
    definitionMinion("BG29_503", targetIds[3]),
  ];
  const source = goldenMinion("BG25_034", "golden-sanders-source");
  player.hand = [source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  state = JSON.parse(JSON.stringify(state)) as GameState;
  let previousInteractionId: string | undefined;
  for (const [index, targetId] of targetIds.entries()) {
    const pending = state.pendingInteraction;
    assert.equal(pending?.kind, "target");
    assert.ok(pending?.kind === "target");
    assert.equal(pending.battlecryTriggerCount, 2);
    assert.equal(pending.repetitions, 4 - index);
    assert.ok(pending.optionInstanceIds.includes(targetId));
    if (previousInteractionId !== undefined) {
      assert.notEqual(pending.interactionId, previousInteractionId);
    }
    previousInteractionId = pending.interactionId;
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: targetId,
    });
    state = JSON.parse(JSON.stringify(state)) as GameState;
  }

  const resolvedPlayer = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.ok(
    targetIds.every(
      (targetId) =>
        resolvedPlayer.board.find(
          (minion) => minion.instanceId === targetId,
        )?.golden === true,
    ),
  );
  assert.equal(
    resolvedPlayer.board.find(
      (minion) => minion.instanceId === "sanders-brann",
    )?.golden,
    false,
  );
});

test("AI Captain Sanders resolves its target automatically", () => {
  let state = createGame(0x7332);
  const player = humanPlayer(state);
  player.isHuman = false;
  player.board = [
    definitionMinion("BG29_611", "ai-sanders-target-1"),
    definitionMinion("BG35_801", "ai-sanders-target-2"),
  ];
  const source = definitionMinion("BG25_034", "ai-sanders-source");
  player.hand = [source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const resolvedPlayer = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(resolvedPlayer);
  assert.equal(state.pendingInteraction, null);
  assert.equal(
    resolvedPlayer.board.filter(
      (minion) =>
        minion.instanceId.startsWith("ai-sanders-target-") && minion.golden,
    ).length,
    1,
  );
});

test("Futurefin skips a leftmost Tavern Spell and grants current stats to the leftmost minion", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0x7340 + index);
    const player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BG34_145", `futurefin-source-${index}`, {
          attack: 10,
          health: 20,
        })
      : definitionMinion("BG34_145", `futurefin-source-${index}`, {
          attack: 10,
          health: 20,
        });
    const target = definitionMinion(
      "BG29_611",
      `futurefin-target-${index}`,
    );
    const other = definitionMinion("BG35_801", `futurefin-other-${index}`);
    const targetBefore = [target.attack, target.health] as const;
    const otherBefore = [other.attack, other.health] as const;
    player.board = [source];
    player.hand = [
      tavernSpell("tavern-spell-shiny-ring", `futurefin-spell-${index}`),
      target,
      other,
    ];
    prepareDuel(state);

    state = gameReducer(state, { type: "END_TURN" });
    const resolvedPlayer = humanPlayer(state);
    const resolvedTarget = resolvedPlayer.hand.find(
      (card) => card.instanceId === target.instanceId,
    );
    const resolvedOther = resolvedPlayer.hand.find(
      (card) => card.instanceId === other.instanceId,
    );
    assert.ok(resolvedTarget?.kind === "minion");
    assert.ok(resolvedOther?.kind === "minion");
    const multiplier = golden ? 2 : 1;
    assert.deepEqual(
      [resolvedTarget.attack, resolvedTarget.health],
      [targetBefore[0] + 10 * multiplier, targetBefore[1] + 20 * multiplier],
    );
    assert.deepEqual(
      [resolvedOther.attack, resolvedOther.health],
      otherBefore,
    );
  }
});

test("Dakkari Enchanter repeats Futurefin's end-of-turn stat grant", () => {
  let state = createGame(0x7342);
  const player = humanPlayer(state);
  const source = definitionMinion("BG34_145", "futurefin-dakkari-source", {
    attack: 10,
    health: 20,
  });
  const target = definitionMinion("BG29_611", "futurefin-dakkari-target");
  const targetBefore = [target.attack, target.health] as const;
  player.board = [
    source,
    definitionMinion("BG26_ICC_901", "futurefin-dakkari"),
  ];
  player.hand = [target];
  prepareDuel(state);

  state = gameReducer(state, { type: "END_TURN" });
  const resolvedTarget = humanPlayer(state).hand.find(
    (card) => card.instanceId === target.instanceId,
  );
  assert.ok(resolvedTarget?.kind === "minion");
  assert.deepEqual(
    [resolvedTarget.attack, resolvedTarget.health],
    [targetBefore[0] + 20, targetBefore[1] + 40],
  );
});

test("Rylak-triggered Captain Sanders goldenizes only the combat copy and emits a buff event", () => {
  const state = createGame(0x7350);
  const player = humanPlayer(state);
  const target = definitionMinion("BG29_611", "rylak-sanders-target", {
    attack: 0,
    health: 100_000,
  });
  const sanders = definitionMinion("BG25_034", "rylak-sanders-source", {
    attack: 0,
    health: 100_000,
  });
  const rylak = definitionMinion("BG26_801", "rylak-sanders-rylak", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  player.board = [target, sanders, rylak];
  prepareDuel(state, [
    definitionMinion("defender-of-argus", "rylak-sanders-wall", {
      attack: 100,
      health: 1_000,
      taunt: true,
      divineShield: false,
    }),
  ]);

  const combat = gameReducer(state, { type: "END_TURN" });
  const battle = combat.lastBattle;
  assert.ok(battle);
  const goldenEvents = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorInstanceId === sanders.instanceId &&
      event.targetInstanceId === target.instanceId,
  );
  assert.equal(goldenEvents.length, 1);
  assert.ok(goldenEvents.every(isCombatPlaybackEvent));
  assert.equal(goldenEvents[0].minion?.golden, true);
  assert.equal(
    humanPlayer(combat).board.find(
      (minion) => minion.instanceId === target.instanceId,
    )?.golden,
    false,
  );
});
