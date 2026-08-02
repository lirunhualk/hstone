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
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { getMinionDefinition } from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
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
    stealth: definition.stealth === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
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

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[],
): void {
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
      player.health = 40;
      player.hand = [];
      player.board = opponentBoard;
    } else if (!player.isHuman) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
    }
  }
}

function removeSuppressedBloodGemFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(removeSuppressedBloodGemFields);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "minion" || record.kind === "tripleReward") {
    delete record.suppressedBloodGemAttack;
    delete record.suppressedBloodGemHealth;
  }
  Object.values(record).forEach(removeSuppressedBloodGemFields);
}

test("Perfect Vision fixes visible stats after old temporary buffs and preserves Tavern Spell bonuses", () => {
  let state = createGame(0xf501);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG27_004",
    "perfect-temporary-target",
    {
      attack: 14,
      health: 18,
      temporaryAttack: 7,
      temporaryHealth: 9,
    },
  );
  const harmlessOpponent = definitionMinion(
    template,
    "BG20_100",
    "perfect-temporary-opponent",
    { attack: 0, health: 200 },
  );
  player.board = [target];
  player.hand = [
    tavernSpell("tavern-spell-perfect-vision", "perfect-temporary"),
  ];
  player.tavernSpellAttackBonus = 2;
  player.tavernSpellHealthBonus = 3;
  keepOnlyOneOpponent(state, [harmlessOpponent]);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "perfect-temporary",
    targetInstanceId: target.instanceId,
  });
  let fixed = boardMinion(state, target.instanceId);
  assert.deepEqual([fixed.attack, fixed.health], [22, 23]);
  assert.deepEqual(
    [fixed.temporaryAttack, fixed.temporaryHealth],
    [0, 0],
  );

  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  fixed = boardMinion(state, target.instanceId);
  assert.deepEqual([fixed.attack, fixed.health], [22, 23]);
  assert.deepEqual(
    [fixed.temporaryAttack, fixed.temporaryHealth],
    [0, 0],
  );
});

test("Gem Confiscation transfers old and new Blood Gems without lowering Perfect Vision's fixed baseline", () => {
  let state = createGame(0xf502);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const sourceDefinition = getMinionDefinition("BG27_004");
  const source = definitionMinion(
    template,
    sourceDefinition.id,
    "perfect-gem-source",
    {
      attack: sourceDefinition.attack + 5,
      health: sourceDefinition.health + 7,
      bloodGemAttack: 5,
      bloodGemHealth: 7,
    },
  );
  const recipient = definitionMinion(
    template,
    "BG20_100",
    "perfect-gem-recipient",
  );
  const recipientBase = [recipient.attack, recipient.health] as const;
  player.board = [source, recipient];
  player.bloodGemAttack = 2;
  player.bloodGemHealth = 3;
  player.hand = [
    tavernSpell("tavern-spell-perfect-vision", "perfect-gems"),
    bloodGem("post-perfect-gem"),
    tavernSpell("tavern-spell-gem-confiscation", "move-perfect-gems"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "perfect-gems",
    targetInstanceId: source.instanceId,
  });
  let fixedSource = boardMinion(state, source.instanceId);
  assert.deepEqual([fixedSource.attack, fixedSource.health], [20, 20]);
  assert.deepEqual(
    [
      fixedSource.bloodGemAttack,
      fixedSource.bloodGemHealth,
      fixedSource.suppressedBloodGemAttack,
      fixedSource.suppressedBloodGemHealth,
    ],
    [5, 7, 5, 7],
  );

  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: "post-perfect-gem",
    targetInstanceId: source.instanceId,
  });
  fixedSource = boardMinion(state, source.instanceId);
  assert.deepEqual([fixedSource.attack, fixedSource.health], [22, 23]);
  assert.deepEqual(
    [
      fixedSource.bloodGemAttack,
      fixedSource.bloodGemHealth,
      fixedSource.suppressedBloodGemAttack,
      fixedSource.suppressedBloodGemHealth,
    ],
    [7, 10, 5, 7],
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "move-perfect-gems",
    targetInstanceId: recipient.instanceId,
  });
  fixedSource = boardMinion(state, source.instanceId);
  const movedTo = boardMinion(state, recipient.instanceId);
  assert.deepEqual([fixedSource.attack, fixedSource.health], [20, 20]);
  assert.deepEqual(
    [
      fixedSource.bloodGemAttack,
      fixedSource.bloodGemHealth,
      fixedSource.suppressedBloodGemAttack,
      fixedSource.suppressedBloodGemHealth,
    ],
    [0, 0, 0, 0],
  );
  assert.deepEqual(
    [movedTo.attack, movedTo.health],
    [recipientBase[0] + 11, recipientBase[1] + 16],
  );
  assert.deepEqual(
    [
      movedTo.bloodGemAttack,
      movedTo.bloodGemHealth,
      movedTo.suppressedBloodGemAttack,
      movedTo.suppressedBloodGemHealth,
    ],
    [11, 16, 0, 0],
  );
});

test("Perfect Vision suppression is JSON-safe and old saves receive zero defaults", () => {
  let state = createGame(0xf503);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const source = definitionMinion(
    template,
    "BG27_004",
    "perfect-save-source",
    {
      attack: 13,
      health: 17,
      bloodGemAttack: 4,
      bloodGemHealth: 6,
    },
  );
  player.board = [source];
  player.hand = [
    tavernSpell("tavern-spell-perfect-vision", "perfect-save"),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "perfect-save",
    targetInstanceId: source.instanceId,
  });

  const roundTripped = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(roundTripped);
  const restored = boardMinion(roundTripped, source.instanceId);
  assert.deepEqual(
    [
      restored.suppressedBloodGemAttack,
      restored.suppressedBloodGemHealth,
    ],
    [4, 6],
  );

  const legacy = JSON.parse(JSON.stringify(createGame(0xf504))) as unknown;
  removeSuppressedBloodGemFields(legacy);
  const repaired = normalizePersistedGameState(legacy) as GameState | null;
  assert.ok(repaired);
  assert.ok(
    repaired.players.every((candidate) =>
      [...candidate.board, ...candidate.hand, ...candidate.ghostHand, ...candidate.shop]
        .filter(
          (card): card is BoardMinionInstance => card.kind === "minion",
        )
        .every(
          (minion) =>
            minion.suppressedBloodGemAttack === 0 &&
            minion.suppressedBloodGemHealth === 0,
        ),
    ),
  );

  const malformed = JSON.parse(JSON.stringify(state)) as GameState;
  const malformedTarget = boardMinion(malformed, source.instanceId);
  malformedTarget.suppressedBloodGemAttack =
    malformedTarget.bloodGemAttack + 1;
  assert.equal(normalizePersistedGameState(malformed), null);
});
