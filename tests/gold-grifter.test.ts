import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getMinionPurchaseQuote,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const GRIFTER = "BG31_826";
const PIRATE = "BG26_135";
const PROGRESS = "pirateCardsAcquired";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find((candidate) => candidate.isHuman);
  assert.ok(player);
  return player;
}

function minion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden ? definition.goldenCardId! : definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [...(definition.tribes ?? (definition.tribe === "neutral" ? [] : [definition.tribe]))],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack: definition.alwaysAttacksLowestAttack === true,
    description: golden
      ? definition.goldenDescription ?? definition.description
      : definition.description,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    effectCounters: {},
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function spell(definitionId: string, instanceId: string): TavernSpellInstance {
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
    target: definition.target,
    spellFamily: "tavern",
  };
}

function fixture(golden = false): GameState {
  const state = createGame(0x8260);
  state.activeTribes = ["pirate", "beast", "demon", "dragon", "mech"];
  const player = humanPlayer(state);
  player.board = [minion(GRIFTER, "grifter", { golden })];
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.gold = 10;
  player.maxGold = 10;
  return state;
}

function grifter(state: GameState): BoardMinionInstance {
  const source = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === "grifter",
  );
  assert.ok(source);
  return source;
}

function buy(state: GameState, card: BoardMinionInstance): GameState {
  const player = humanPlayer(state);
  player.gold = 10;
  player.shop = [card];
  return gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
}

function keepIdleOpponent(state: GameState): void {
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 2;
    player.health = index < 2 ? 100 : 0;
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    if (!player.isHuman) {
      player.board = [];
      player.hand = [];
    }
  }
}

for (const golden of [false, true]) {
  test(`${golden ? "Golden" : "Normal"} Gold Grifter increases the cap every four acquired Pirates`, () => {
    let state = fixture(golden);
    assert.equal(getMinionDefinition(GRIFTER).effectSupport, "complete");
    for (let acquired = 1; acquired <= 8; acquired += 1) {
      // Clear rewards to isolate acquisition from triples and hand capacity.
      humanPlayer(state).hand = [];
      state = buy(state, minion(PIRATE, `pirate-${acquired}`));
      assert.equal(humanPlayer(state).hand.length, 1);
      assert.equal(
        humanPlayer(state).maxGold,
        10 + Math.floor(acquired / 4) * (golden ? 2 : 1),
      );
      assert.equal(humanPlayer(state).gold, 7, "raising the cap does not grant spendable Gold");
      assert.equal(grifter(state).effectCounters?.[PROGRESS], acquired % 4);
      assert.match(grifter(state).description, new RegExp(`还剩${4 - acquired % 4}张`));
    }
  });
}

test("free Pirates from Grifter Portrait advance Gold Grifter", () => {
  let state = fixture();
  const player = humanPlayer(state);
  player.trinketIds = ["lesser-trinket-bg32-magicitem-957"];
  player.trinketCounters[player.trinketIds[0]] = 0;
  player.gold = 0;
  player.shop = [minion(PIRATE, "free-pirate")];
  grifter(state).effectCounters = { [PROGRESS]: 3 };
  assert.equal(getMinionPurchaseQuote(state, player.id, 0)?.cost, 0);
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  assert.equal(humanPlayer(state).gold, 0);
  assert.equal(humanPlayer(state).maxGold, 11);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 0);
});

test("non-Pirates, spells, and failed full-hand acquisitions do not advance Gold Grifter", () => {
  let state = fixture();
  grifter(state).effectCounters = { [PROGRESS]: 3 };
  state = buy(state, minion("BG26_805", "beast"));
  let player = humanPlayer(state);
  player.spellShop = spell("tavern-spell-tavern-coin", "bought-coin");
  state = gameReducer(state, { type: "BUY_TAVERN_SPELL" });
  assert.equal(humanPlayer(state).hand.length, 2);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 3);
  assert.equal(humanPlayer(state).maxGold, 10);

  player = humanPlayer(state);
  player.hand = Array.from({ length: 10 }, (_, index) =>
    spell("tavern-spell-tavern-coin", `full-${index}`),
  );
  state = buy(state, minion(PIRATE, "blocked-pirate"));
  assert.equal(humanPlayer(state).hand.length, 10);
  assert.equal(humanPlayer(state).shop.length, 1);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 3);
  assert.equal(humanPlayer(state).maxGold, 10);
});

test("generated and discovered Pirates use the same acquisition counter", () => {
  let state = fixture();
  state.pool = Object.fromEntries(Object.keys(state.pool).map((id) => [id, 0]));
  state.pool[PIRATE] = 8;
  grifter(state).effectCounters = { [PROGRESS]: 2 };
  humanPlayer(state).hand = [spell("tavern-spell-recruit-a-trainee", "generate")];
  state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "generate" });
  assert.equal(humanPlayer(state).hand[0]?.definitionId, PIRATE);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 3);

  humanPlayer(state).hand.push(spell("tavern-spell-new-sprout", "discover"));
  state = gameReducer(state, { type: "CAST_TAVERN_SPELL", cardInstanceId: "discover" });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 3, "offers are not acquired cards");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  assert.equal(humanPlayer(state).maxGold, 11);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 0);
});

test("only active Grifters track acquisitions and each copy has independent progress", () => {
  let state = fixture();
  const player = humanPlayer(state);
  grifter(state).effectCounters = { [PROGRESS]: 3 };
  player.board.push(minion(GRIFTER, "second", { golden: true, effectCounters: { [PROGRESS]: 1 } }));
  player.hand = [minion(GRIFTER, "held", { golden: true, effectCounters: { [PROGRESS]: 2 } })];
  state = buy(state, minion(PIRATE, "acquired"));
  const next = humanPlayer(state);
  assert.equal(next.maxGold, 11);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 0);
  assert.equal(next.board.find((card) => card.instanceId === "second")?.effectCounters?.[PROGRESS], 2);
  const held = next.hand.find((card) => card.instanceId === "held");
  assert.ok(held?.kind === "minion");
  assert.equal(held.effectCounters?.[PROGRESS], 2);
});

test("progress and raised cap survive save restoration and refill on the next turn", () => {
  let state = fixture();
  state.round = 10;
  humanPlayer(state).maxGold = 12;
  grifter(state).effectCounters = { [PROGRESS]: 3 };
  const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState | null;
  assert.ok(restored);
  assert.equal(humanPlayer(restored).maxGold, 12);
  assert.equal(grifter(restored).effectCounters?.[PROGRESS], 3);
  assert.match(grifter(restored).description, /还剩1张/u);
  state = buy(restored, minion(PIRATE, "after-restore"));
  assert.equal(humanPlayer(state).maxGold, 13);
  keepIdleOpponent(state);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  assert.equal(humanPlayer(state).maxGold, 13);
  assert.equal(humanPlayer(state).gold, 13);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 0);
});

test("Plane Alignment's turn-start Pirate reward advances Gold Grifter", () => {
  let state = fixture();
  state.lobbySystemsEnabled = true;
  state.systemEventId = "system-event-plane-alignment";
  state.pool[PIRATE] = 20;
  grifter(state).effectCounters = { [PROGRESS]: 3 };
  humanPlayer(state).board.push(minion(PIRATE, "tribe-anchor"));
  keepIdleOpponent(state);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  assert.ok(humanPlayer(state).hand.some((card) => card.kind === "minion" && card.tribes.includes("pirate")));
  assert.equal(humanPlayer(state).maxGold, 11);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 0);
});

test("AI Pirate purchases advance Gold Grifter through the shared recruit path", () => {
  let state = fixture();
  state.round = 10;
  keepIdleOpponent(state);
  const ai = state.players.find((player) => player.alive && !player.isHuman);
  assert.ok(ai);
  ai.tavernTier = 6;
  ai.maxGold = 10;
  ai.gold = 3;
  ai.board = [minion(GRIFTER, "ai-grifter", {
    attack: 100,
    health: 100,
    effectCounters: { [PROGRESS]: 3 },
  })];
  ai.shop = [minion(PIRATE, "ai-pirate", { attack: 50, health: 50 })];
  state = gameReducer(state, { type: "END_TURN" });
  const next = state.players.find((player) => player.id === ai.id);
  assert.ok(next);
  assert.equal(next.maxGold, 11);
  assert.equal(next.board.find((card) => card.instanceId === "ai-grifter")?.effectCounters?.[PROGRESS], 0);
  assert.equal(humanPlayer(state).maxGold, 10, "the human player's economy stays separate");
});

test("tripling Grifter retains its furthest progress and the Golden effect uses that progress", () => {
  let state = fixture();
  grifter(state).effectCounters = { [PROGRESS]: 2 };
  humanPlayer(state).hand = [minion(GRIFTER, "second-grifter", {
    effectCounters: { [PROGRESS]: 1 },
  })];
  state = buy(state, minion(GRIFTER, "third-grifter"));
  const golden = humanPlayer(state).hand.find(
    (card) => card.kind === "minion" && card.definitionId === GRIFTER,
  );
  assert.ok(golden?.kind === "minion" && golden.golden);
  assert.equal(golden.effectCounters?.[PROGRESS], 3);
  assert.match(golden.description, /还剩1张/u);
  assert.equal(humanPlayer(state).maxGold, 10);
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  state = buy(state, minion(PIRATE, "fourth-pirate"));
  const played = humanPlayer(state).board.find((card) => card.definitionId === GRIFTER);
  assert.equal(played?.effectCounters?.[PROGRESS], 0);
  assert.equal(humanPlayer(state).maxGold, 12);
});

test("acquiring a Pirate triple counts the purchased card and the resulting Golden card once each", () => {
  let state = fixture();
  grifter(state).effectCounters = { [PROGRESS]: 2 };
  humanPlayer(state).hand = [minion(PIRATE, "first"), minion(PIRATE, "second")];
  state = buy(state, minion(PIRATE, "third"));
  const hand = humanPlayer(state).hand;
  assert.equal(hand.length, 1);
  assert.ok(hand[0].kind === "minion" && hand[0].golden);
  assert.equal(grifter(state).effectCounters?.[PROGRESS], 0);
  assert.equal(humanPlayer(state).maxGold, 11);
});

test("current saves repair unsupported Grifters and missing or invalid progress without changing earned Gold cap", () => {
  for (const progress of [undefined, -1, 4, 1.5]) {
    const state = fixture();
    humanPlayer(state).maxGold = 12;
    const source = grifter(state);
    source.effectSupport = "partial";
    source.effectCounters = progress === undefined ? {} : { [PROGRESS]: progress };
    source.description = "未实现的旧卡面";
    const restored = normalizePersistedGameState(JSON.parse(JSON.stringify(state))) as GameState | null;
    assert.ok(restored);
    assert.equal(grifter(restored).effectSupport, "complete");
    assert.equal(grifter(restored).effectCounters?.[PROGRESS], 0);
    assert.match(grifter(restored).description, /还剩4张/u);
    assert.equal(humanPlayer(restored).maxGold, 12);
  }
});
