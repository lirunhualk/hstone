import assert from "node:assert/strict";
import test from "node:test";

import {
  LIVE_MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  minionHasTribe,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import type { PendingDiscoverInteraction } from "../lib/game/types.ts";

const TOKEN_OF_OLD_GODS_CARD_ID = "BG30_MagicItem_416";
const TOKEN_OF_OLD_GODS_SPELL_CARD_ID = "BG30_MagicItem_416t";
const PUTRICIDE_STICKER_CARD_ID = "BG32_MagicItem_300";
const PUTRICIDE_CREATION_DEFINITION_ID = "BG25_HERO_100pt";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function trinketForCard(cardId: string) {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be an active Trinket`);
  return definition;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const definition = trinketForCard(cardId);
  const player = humanPlayer(state);
  player.gold = 100;
  player.maxGold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `choose-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: `choose-${cardId}`,
    optionInstanceId: definition.id,
  });
}

function minion(
  state: GameState,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  const definition = getMinionDefinition(definitionId);
  return {
    ...structuredClone(template),
    instanceId,
    definitionId: definition.id,
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
    effectCounters: {},
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function trinketSpellcraft(
  player: PlayerState,
  cardId: string,
): SpellcraftSpellInstance {
  const spell = player.hand.find(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft" && card.cardId === cardId,
  );
  assert.ok(spell, `${cardId} must be in hand`);
  return spell;
}

function pendingDiscover(state: GameState): PendingDiscoverInteraction {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.options.length, 3);
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    3,
  );
  return pending;
}

function resolveDiscover(
  state: GameState,
  pending: PendingDiscoverInteraction,
  optionIndex: number,
): GameState {
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[optionIndex].instanceId,
  });
}

function jsonRoundTrip(state: GameState): GameState {
  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  return restored;
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function prepareTwoPlayerLobby(state: GameState): void {
  const human = humanPlayer(state);
  const opponent = state.players.find((player) => player.id !== human.id);
  assert.ok(opponent);
  for (const player of state.players) {
    player.alive = player.id === human.id || player.id === opponent.id;
    if (player.id !== human.id) {
      player.gold = 0;
      player.hand = [];
      player.board = [];
      player.shop = [];
      player.spellShop = null;
      player.additionalSpellShop = [];
    }
  }
}

function fillHand(state: GameState, prefix: string): string[] {
  const player = humanPlayer(state);
  const definition = LIVE_MINION_DEFINITIONS.find(
    (candidate) => candidate.tier === 1,
  );
  assert.ok(definition);
  player.hand = Array.from({ length: 10 }, (_, index) =>
    minion(state, definition.id, `${prefix}-${index}`),
  );
  return player.hand.map((card) => card.instanceId);
}

test("Old Gods token transforms through a three-option higher-tier shared-pool choice", () => {
  let state = createGame(0x4160);
  state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
  let player = humanPlayer(state);
  player.hand = [];
  player.board = [
    minion(state, "BG25_001", "old-gods-target", {
      attack: 99,
      health: 101,
      poolCopies: 1,
    }),
    minion(state, "BG34_692", "old-gods-tier-six"),
  ];
  const tierTwoDefinitions = LIVE_MINION_DEFINITIONS.filter(
    (definition) => {
      const cardTribes =
        definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe]);
      const associatedTribes = definition.associatedTribes ?? [];
      return (
        definition.tier === 2 &&
        definition.collectible !== false &&
        (definition.effectSupport ?? "complete") === "complete" &&
        (state.pool[definition.id] ?? 0) > 0 &&
        (cardTribes.length + associatedTribes.length === 0 ||
          cardTribes.includes("all") ||
          [...cardTribes, ...associatedTribes].some((tribe) =>
            state.activeTribes.includes(tribe),
          ))
      );
    },
  ).slice(0, 3);
  assert.equal(tierTwoDefinitions.length, 3);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = tierTwoDefinitions.some(
      (definition) => definition.id === definitionId,
    )
      ? 5
      : 0;
  }

  state = acquireTrinket(state, TOKEN_OF_OLD_GODS_CARD_ID);
  player = humanPlayer(state);
  const spell = trinketSpellcraft(
    player,
    TOKEN_OF_OLD_GODS_SPELL_CARD_ID,
  );
  assert.deepEqual(getLegalSpellcraftTargetIds(state, player.id, spell), [
    "old-gods-target",
  ]);
  assert.equal(
    gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: spell.instanceId,
      targetInstanceId: "old-gods-tier-six",
    }),
    state,
  );

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spell.instanceId,
    targetInstanceId: "old-gods-target",
  });
  let pending = pendingDiscover(state);
  assert.equal(pending.destination.kind, "transform");
  assert.ok(pending.options.every((option) => option.tier === 2));
  assert.ok(
    pending.options.every((option) => state.pool[option.definitionId] === 4),
  );
  assert.equal(
    gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: "illegal-option",
    }),
    state,
  );

  state = jsonRoundTrip(state);
  pending = pendingDiscover(state);
  const selected = pending.options[0];
  const unselectedDefinitionIds = pending.options
    .slice(1)
    .map((option) => option.definitionId);
  state = resolveDiscover(state, pending, 0);
  player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  const transformed = player.board.find(
    (candidate) => candidate.instanceId === "old-gods-target",
  );
  assert.ok(transformed);
  assert.equal(transformed.definitionId, selected.definitionId);
  assert.equal(transformed.tier, 2);
  assert.notDeepEqual([transformed.attack, transformed.health], [99, 101]);
  assert.equal(state.pool.BG25_001, 1);
  assert.equal(state.pool[selected.definitionId], 4);
  for (const definitionId of unselectedDefinitionIds) {
    assert.equal(state.pool[definitionId], 5);
  }
});

test("Old Gods token resolves its higher-tier choice synchronously for AI", () => {
  function transform(seed: number): string {
    let state = createGame(seed);
    state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
    const player = humanPlayer(state);
    player.isHuman = false;
    player.hand = [];
    player.board = [
      minion(state, "BG25_001", "ai-old-gods-target", {
        poolCopies: 1,
      }),
    ];
    const candidateIds = ["BG_TTN_401", "BG24_715", "BG27_002"];
    for (const definitionId of Object.keys(state.pool)) {
      state.pool[definitionId] = candidateIds.includes(definitionId) ? 5 : 0;
    }
    state = acquireTrinket(state, TOKEN_OF_OLD_GODS_CARD_ID);
    const spell = trinketSpellcraft(
      humanPlayer(state),
      TOKEN_OF_OLD_GODS_SPELL_CARD_ID,
    );
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: spell.instanceId,
      targetInstanceId: "ai-old-gods-target",
    });
    assert.equal(state.pendingInteraction, null);
    const transformed = humanPlayer(state).board[0];
    assert.ok(transformed);
    assert.ok(candidateIds.includes(transformed.definitionId));
    assert.equal(state.pool.BG25_001, 1);
    assert.equal(state.pool[transformed.definitionId], 4);
    for (const candidateId of candidateIds) {
      if (candidateId !== transformed.definitionId) {
        assert.equal(state.pool[candidateId], 5);
      }
    }
    return transformed.definitionId;
  }

  assert.equal(transform(0x4161), transform(0x4161));
});

test("Putricide uses two generated three-card component sets and persists both steps", () => {
  let state = createGame(0x3000);
  state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
  let player = humanPlayer(state);
  player.tavernTier = 2;
  player.hand = [];
  const poolBefore = structuredClone(state.pool);

  state = acquireTrinket(state, PUTRICIDE_STICKER_CARD_ID);
  let first = pendingDiscover(state);
  assert.equal(first.destination.kind, "customUndeadFirst");
  assert.ok(
    first.options.every(
      (option) =>
        option.poolCopies === 0 &&
        option.tier <= player.tavernTier &&
        minionHasTribe(option, "undead"),
    ),
  );
  assert.deepEqual(state.pool, poolBefore);
  assert.equal(
    gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: first.interactionId,
      optionInstanceId: "illegal-component",
    }),
    state,
  );

  state = jsonRoundTrip(state);
  first = pendingDiscover(state);
  const firstOption =
    first.options.find(
      (option) =>
        (getMinionDefinition(option.definitionId).deathrattle?.length ?? 0) > 0,
    ) ?? first.options[0];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: first.interactionId,
    optionInstanceId: firstOption.instanceId,
  });
  let second = pendingDiscover(state);
  assert.equal(second.destination.kind, "customUndeadSecond");
  assert.equal(
    second.destination.kind === "customUndeadSecond"
      ? second.destination.firstComponentDefinitionId
      : null,
    firstOption.definitionId,
  );
  assert.ok(
    second.options.every(
      (option) =>
        option.poolCopies === 0 &&
        option.tier <= humanPlayer(state).tavernTier &&
        minionHasTribe(option, "undead") &&
        !["BG25_008", "BG34_231", "BG_DEEP_015"].includes(
          option.definitionId,
        ),
    ),
  );
  assert.deepEqual(state.pool, poolBefore);

  state = jsonRoundTrip(state);
  second = pendingDiscover(state);
  const secondOption = second.options[0];
  const expectedAttack = firstOption.attack + secondOption.attack;
  const expectedHealth = firstOption.health + secondOption.health;
  state = resolveDiscover(state, second, 0);
  player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  const creation = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === PUTRICIDE_CREATION_DEFINITION_ID,
  );
  assert.ok(creation);
  assert.deepEqual([creation.attack, creation.health], [
    expectedAttack,
    expectedHealth,
  ]);
  assert.equal(creation.tier, Math.max(firstOption.tier, secondOption.tier));
  assert.deepEqual(
    creation.attachments.map((attachment) => attachment.definitionId),
    [firstOption.definitionId, secondOption.definitionId],
  );
  assert.equal(creation.poolCopies, 0);
  assert.equal(creation.taunt, firstOption.taunt || secondOption.taunt);
  assert.equal(creation.reborn, firstOption.reborn || secondOption.reborn);
  assert.match(creation.description, /无法三连/u);
  assert.match(creation.description, new RegExp(firstOption.name, "u"));
  assert.match(creation.description, new RegExp(secondOption.name, "u"));
  assert.equal(
    getMinionDefinition(PUTRICIDE_CREATION_DEFINITION_ID).canTriple,
    false,
  );
  assert.deepEqual(state.pool, poolBefore);
});

test("Putricide repeats every two Recruit turns and safely burns into a full hand", () => {
  let state = createGame(0x3001);
  state.lobbySystemsEnabled = false;
  state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
  humanPlayer(state).tavernTier = 2;
  humanPlayer(state).hand = [];
  state = acquireTrinket(state, PUTRICIDE_STICKER_CARD_ID);
  state = resolveDiscover(state, pendingDiscover(state), 0);
  state = resolveDiscover(state, pendingDiscover(state), 0);
  const trinketId = trinketForCard(PUTRICIDE_STICKER_CARD_ID).id;
  assert.equal(humanPlayer(state).trinketCounters[trinketId], 0);
  prepareTwoPlayerLobby(state);

  state = continueThroughCombat(state);
  assert.equal(state.pendingInteraction, null);
  assert.equal(humanPlayer(state).trinketCounters[trinketId], 1);
  state = continueThroughCombat(state);
  assert.equal(pendingDiscover(state).destination.kind, "customUndeadFirst");
  assert.equal(humanPlayer(state).trinketCounters[trinketId], 0);

  state = resolveDiscover(state, pendingDiscover(state), 0);
  const second = pendingDiscover(state);
  const handIds = fillHand(state, "putricide-full");
  state = resolveDiscover(state, second, 0);
  assert.equal(state.pendingInteraction, null);
  assert.deepEqual(
    humanPlayer(state).hand.map((card) => card.instanceId),
    handIds,
  );
});

test("AI crafts Putricide creations synchronously and deterministically", () => {
  function craft(seed: number): readonly string[] {
    let state = createGame(seed);
    state.activeTribes = ["undead", "beast", "mech", "demon", "dragon"];
    const player = humanPlayer(state);
    player.isHuman = false;
    player.tavernTier = 4;
    player.hand = [];
    state = acquireTrinket(state, PUTRICIDE_STICKER_CARD_ID);
    assert.equal(state.pendingInteraction, null);
    const creation = humanPlayer(state).hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.definitionId === PUTRICIDE_CREATION_DEFINITION_ID,
    );
    assert.ok(creation);
    return creation.attachments.map((attachment) => attachment.definitionId);
  }

  assert.deepEqual(craft(0x3002), craft(0x3002));
});
