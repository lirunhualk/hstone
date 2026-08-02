import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import { isTierThreeDarkmoonPrizeDefinitionId } from "../lib/game/darkmoon-prizes.ts";
import {
  createGame,
  gameReducer,
  trinketsForTier,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TrinketDefinition,
} from "../lib/game/engine.ts";
import { createInitialHeroPowerCounters } from "../lib/game/hero-powers.ts";

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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
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

function prepareDuel(state: GameState): [PlayerState, PlayerState] {
  state.lobbySystemsEnabled = false;
  state.pendingInteraction = null;
  for (const [index, player] of state.players.entries()) {
    player.gold = 100;
    player.hand = [];
    player.ghostHand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.trinketIds = [];
    player.trinketCounters = {};
    player.trinketSelections = {};
    player.battlecriesTriggered = 0;
    player.heroPowerExtraTriggers = 0;
    player.isHuman = index < 2;
    player.alive = index < 2;
    player.health = index < 2 ? 100 : 0;
    player.armor = 0;
    player.eliminatedRound = index < 2 ? undefined : 0;
  }
  return [state.players[0], state.players[1]];
}

function trinket(cardId: string): TrinketDefinition {
  const definition = [
    ...trinketsForTier("lesser"),
    ...trinketsForTier("greater"),
  ].find((candidate) => candidate.cardId === cardId);
  assert.ok(definition, `missing Trinket ${cardId}`);
  return definition;
}

function equip(player: PlayerState, ...cardIds: string[]): string[] {
  const definitions = cardIds.map(trinket);
  player.trinketIds = definitions.map((definition) => definition.id);
  player.trinketCounters = Object.fromEntries(
    definitions.map((definition) => [definition.id, 0]),
  );
  return player.trinketIds;
}

function acquireYogg(state: GameState): GameState {
  const player = state.players[0];
  const definition = trinket("BG30_MagicItem_994");
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "choose-yogg",
    playerId: player.id,
    sourceInstanceId: "yogg-offer",
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: "choose-yogg",
    optionInstanceId: definition.id,
  });
}

function boardStatTotal(player: PlayerState): number {
  return player.board.reduce(
    (total, current) => total + current.attack + current.health,
    0,
  );
}

function findYoggOutcome(
  outcome: number,
  predicate: (state: GameState) => boolean = () => true,
): GameState {
  const definition = trinket("BG30_MagicItem_994");
  for (let seed = 1; seed <= 2_000; seed += 1) {
    const state = createGame(seed);
    const [human] = prepareDuel(state);
    human.board = [
      minion("BG29_611", "yogg-board-a", { attack: 3, health: 4 }),
      minion("BG29_611", "yogg-board-b", { attack: 5, health: 6 }),
    ];
    human.shop = [
      minion("BG29_611", "yogg-shop-a", { attack: 2, health: 3 }),
      minion("BG29_611", "yogg-shop-b", { attack: 4, health: 5 }),
    ];
    const resolved = acquireYogg(state);
    if (
      resolved.players[0].trinketCounters[definition.id] === outcome &&
      predicate(resolved)
    ) {
      return resolved;
    }
  }
  throw new Error(`unable to find deterministic Yogg outcome ${outcome}`);
}

test("Yogg Pastry exposes all seven fixed-build wheel outcomes", () => {
  const mysteryBox = findYoggOutcome(1);
  const mysteryPlayer = mysteryBox.players[0];
  assert.equal(mysteryPlayer.heroPowerExtraTriggers, 1);
  mysteryPlayer.heroPowerId = "hero-power-smart-savings";
  mysteryPlayer.heroPowerCounters = createInitialHeroPowerCounters(
    mysteryPlayer.heroPowerId,
  );
  const afterSell = gameReducer(mysteryBox, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  assert.equal(afterSell.players[0].pendingNextTurnGold, 2);

  const handOfFate = findYoggOutcome(2);
  assert.equal(handOfFate.players[0].hand.length, 2);
  assert.ok(
    handOfFate.players[0].hand.every(
      (card) =>
        card.kind === "spellcraft" &&
        isTierThreeDarkmoonPrizeDefinitionId(card.definitionId),
    ),
  );

  const curseOfFlesh = findYoggOutcome(3);
  assert.ok(boardStatTotal(curseOfFlesh.players[0]) > 18);

  const devouringHunger = findYoggOutcome(4);
  assert.equal(boardStatTotal(devouringHunger.players[0]), 32);
  assert.equal(devouringHunger.players[0].shop.length, 3);
  assert.ok(
    devouringHunger.players[0].shop.every(
      (card) => !card.instanceId.startsWith("yogg-shop-"),
    ),
  );

  const rodOfRoasting = findYoggOutcome(
    5,
    (state) => boardStatTotal(state.players[0]) > 18,
  );
  assert.equal((boardStatTotal(rodOfRoasting.players[0]) - 18) % 20, 0);

  const goldenMysteryBox = findYoggOutcome(6);
  assert.equal(
    goldenMysteryBox.players[0].shop.filter((card) => card.golden).length,
    1,
  );

  const mindflayerGoggles = findYoggOutcome(7);
  assert.equal(mindflayerGoggles.players[0].tavernSpellsCast, 4);
});

test("Yogg Pastry spins again at the start of every Recruit turn", () => {
  let state = createGame(0x994);
  const [human, enemy] = prepareDuel(state);
  const [definitionId] = equip(human, "BG30_MagicItem_994");
  human.board = [minion("BG29_611", "yogg-repeat-human")];
  enemy.board = [minion("BG29_611", "yogg-repeat-enemy")];

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  assert.ok(state.players[0].trinketCounters[definitionId] >= 1);
  assert.ok(state.players[0].trinketCounters[definitionId] <= 7);
});

test("Murk-Eye Tag triggers both edge Battlecries and counts each trigger", () => {
  const state = createGame(0x752);
  const [human] = prepareDuel(state);
  equip(human, "BG35_MagicItem_752");
  human.board = [
    minion("BG26_135", "murkeye-left"),
    minion("BG29_611", "murkeye-middle"),
    minion("BG26_135", "murkeye-right"),
  ];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.players[0].pendingNextTurnGold, 2);
  assert.equal(combat.players[0].battlecriesTriggered, 2);
});

test("Murky Tag remembers Battlecries from before acquisition", () => {
  let state = createGame(0x753);
  let [human] = prepareDuel(state);
  human.hand = [minion("BG26_135", "murky-played")];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = state.players[0];
  assert.equal(human.battlecriesTriggered, 1);
  equip(human, "BG35_MagicItem_753");
  human.board.push(
    minion("BG29_611", "murky-second", { attack: 2, health: 3 }),
  );
  const before = human.board.slice(0, 2).map((card) => ({
    attack: card.attack,
    health: card.health,
  }));

  const combat = gameReducer(state, { type: "END_TURN" });
  for (const [index, card] of combat.players[0].board.slice(0, 2).entries()) {
    assert.equal(card.attack, before[index].attack + 2);
    assert.equal(card.health, before[index].health + 2);
  }
});

test("Thorned Pauldrons turns on after a Deathrattle and expires at next combat", () => {
  let state = createGame(0x431);
  let [human, enemy] = prepareDuel(state);
  const [definitionId] = equip(human, "BG35_MagicItem_431t");
  human.board = [minion("rat-pack", "pauldrons-rat", { health: 1 })];
  enemy.board = [
    minion("BG29_611", "pauldrons-wall", {
      attack: 100,
      health: 1_000,
      taunt: true,
    }),
  ];

  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.players[0].trinketCounters[definitionId], 1);
  state = gameReducer(state, { type: "CONTINUE" });
  human = state.players[0];
  const target = human.board[0];
  const before = { attack: target.attack, health: target.health };
  const gem: BloodGemSpellInstance = {
    kind: "bloodGem",
    instanceId: "pauldrons-gem",
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  };
  human.hand = [gem];
  state = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: gem.instanceId,
    targetInstanceId: target.instanceId,
  });
  assert.equal(state.players[0].board[0].attack, before.attack + 3);
  assert.equal(state.players[0].board[0].health, before.health + 2);

  human = state.players[0];
  enemy = state.players[1];
  human.board = [
    minion("dragonspawn-lieutenant", "pauldrons-passive"),
  ];
  enemy.board = [
    minion("dragonspawn-lieutenant", "pauldrons-passive-enemy"),
  ];
  state = gameReducer(state, { type: "END_TURN" });
  assert.equal(state.players[0].trinketCounters[definitionId], 0);
});
