import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const SLAB_COUNTER = "stoneAgeSlabPurchaseUsedThisTurn";

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
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
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

function goldenSlab(instanceId: string): BoardMinionInstance {
  const definition = getMinionDefinition("BG34_950");
  assert.ok(definition.goldenCardId);
  assert.ok(definition.goldenDescription);
  return minion("BG34_950", instanceId, {
    golden: true,
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    attack: definition.attack * 2,
    health: definition.health * 2,
    description: definition.goldenDescription,
  });
}

function prepareRecruitState(
  seed: number,
  slab: BoardMinionInstance,
): { state: GameState; player: PlayerState } {
  const state = createGame(seed);
  state.lobbySystemsEnabled = false;
  const player = humanPlayer(state);
  player.gold = 30;
  player.hand = [];
  player.board = [slab];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  return { state, player };
}

function boughtMinion(
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance {
  const card = player.hand.find(
    (candidate): candidate is BoardMinionInstance =>
      candidate.kind === "minion" &&
      candidate.instanceId === instanceId,
  );
  assert.ok(card);
  return card;
}

test("Stone Age Slab exposes exact ordinary and Golden purchase rules", () => {
  const definition = getMinionDefinition("BG34_950");
  assert.equal(definition.name, "石器时代顽石");
  assert.equal(definition.effectSupport, "complete");
  assert.equal(definition.goldenCardId, "BG34_950_G");
  assert.equal(
    definition.description,
    "在你购买一个随从后，使其获得+10/+10并使其属性值翻倍。（每回合一次。）",
  );
  assert.equal(
    definition.goldenDescription,
    "在你购买一个随从后，使其获得+10/+10并使其属性值变为三倍。（每回合一次。）",
  );
  assert.deepEqual(definition.afterMinionPurchased, {
    timesPerTurn: 1,
    attack: 10,
    health: 10,
    statMultiplier: 2,
    goldenStatMultiplier: 3,
  });
});

for (const golden of [false, true]) {
  test(`${golden ? "Golden" : "ordinary"} Stone Age Slab applies Elemental stat-grant improvements before multiplying`, () => {
    const slab = golden
      ? goldenSlab("golden-stone-age-slab")
      : minion("BG34_950", "stone-age-slab");
    let { state, player } = prepareRecruitState(
      golden ? 0x51ab2 : 0x51ab1,
      slab,
    );
    player.elementalGrantAttackBonus = 2;
    player.elementalGrantHealthBonus = 3;
    const target = minion("BG25_001", "stone-age-target", {
      poolCopies: 1,
    });
    const attackBefore = target.attack;
    const healthBefore = target.health;
    player.shop = [target];

    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    player = humanPlayer(state);
    const bought = boughtMinion(player, target.instanceId);
    const multiplier = golden ? 3 : 2;
    assert.equal(bought.attack, (attackBefore + 12) * multiplier);
    assert.equal(bought.health, (healthBefore + 13) * multiplier);
    const persistedSlab = player.board[0];
    assert.equal(
      persistedSlab.effectCounters?.[SLAB_COUNTER],
      1,
    );
    assert.match(persistedSlab.description, /本回合已触发/u);
  });
}

test("Stone Age Slab triggers once per turn and resets for the next Recruit phase", () => {
  let { state, player } = prepareRecruitState(
    0x51ab3,
    minion("BG34_950", "reset-stone-age-slab"),
  );
  const first = minion("BG25_001", "slab-first-buy", {
    poolCopies: 1,
  });
  const second = minion("BG25_008", "slab-second-buy", {
    poolCopies: 1,
  });
  player.shop = [first, second];
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(
    boughtMinion(player, first.instanceId).attack,
    (first.attack + 10) * 2,
  );
  assert.equal(
    boughtMinion(player, second.instanceId).attack,
    second.attack,
  );

  const enemy = state.players.find((candidate) => !candidate.isHuman);
  assert.ok(enemy);
  for (const candidate of state.players) {
    if (candidate.isHuman || candidate.id === enemy.id) {
      candidate.alive = true;
      candidate.health = 1_000;
      if (!candidate.isHuman) {
        candidate.board = [];
      }
    } else {
      candidate.alive = false;
      candidate.health = 0;
      candidate.board = [];
      candidate.eliminatedRound = 0;
    }
  }
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(
    player.board[0]?.effectCounters?.[SLAB_COUNTER],
    0,
  );
  const third = minion("BG25_009", "slab-third-buy", {
    poolCopies: 1,
  });
  player.gold = 10;
  player.hand = [];
  player.shop = [third];
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  assert.equal(
    boughtMinion(humanPlayer(state), third.instanceId).attack,
    (third.attack + 10) * 2,
  );
});

test("Stone Age Slab preserves its complete purchase enchantment when the bought copy forms a Triple", () => {
  let { state, player } = prepareRecruitState(
    0x51ab4,
    minion("BG34_950", "triple-stone-age-slab"),
  );
  const definition = getMinionDefinition("BG25_001");
  player.hand = [
    minion("BG25_001", "slab-triple-a", { poolCopies: 1 }),
    minion("BG25_001", "slab-triple-b", { poolCopies: 1 }),
  ];
  player.shop = [
    minion("BG25_001", "slab-triple-c", { poolCopies: 1 }),
  ];

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const golden = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG25_001" &&
      card.golden,
  );
  assert.ok(golden);
  assert.equal(golden.attack, definition.attack * 3 + 20);
  assert.equal(golden.health, definition.health * 3 + 20);
  assert.equal(player.board[0]?.effectCounters?.[SLAB_COUNTER], 1);
});
