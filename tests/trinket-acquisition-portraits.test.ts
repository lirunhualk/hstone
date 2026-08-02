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
  getMinionPurchaseQuote,
  getTrinketDefinition,
  getTrinketProgressText,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const ACQUISITION_SCENARIOS = [
  ["BG30_MagicItem_821", "TB_BaconShop_HP_105t"],
  ["BG32_MagicItem_957", "BG31_826"],
  ["BG35_MagicItem_870", "BG34_Giant_031"],
  ["BG30_MagicItem_876", "BG_EX1_564"],
  ["BG32_MagicItem_172", "BG31_176"],
  ["BG32_MagicItem_364", "BG34_Giant_314"],
  ["BG32_MagicItem_926", "BG27_513"],
  ["BG32_MagicItem_998", "BG31_360"],
] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function acquireTrinket(state: GameState, cardId: string): GameState {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be active`);
  const player = humanPlayer(state);
  player.gold = 100;
  player.hand = [];
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `acquire-${cardId}`,
    playerId: player.id,
    sourceInstanceId: `offer-${cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: `acquire-${cardId}`,
    optionInstanceId: definition.id,
  });
}

function minionInHand(
  player: PlayerState,
  definitionId: string,
): BoardMinionInstance {
  const minion = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === definitionId,
  );
  assert.ok(minion, `${definitionId} must be in hand`);
  return minion;
}

function createShopMinion(
  state: GameState,
  definitionId: string,
  instanceId: string,
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
  };
}

function ordinaryPirateDefinitionId(): string {
  const definition = LIVE_MINION_DEFINITIONS.find((candidate) => {
    const tribes =
      candidate.tribes ??
      (candidate.tribe === "neutral" ? [] : [candidate.tribe]);
    return tribes.includes("pirate") && candidate.id !== "BG31_826";
  });
  assert.ok(definition);
  return definition.id;
}

function keepOnlyTwoPlayers(state: GameState): void {
  for (let index = 0; index < state.players.length; index += 1) {
    const player = state.players[index];
    player.alive = index < 2;
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }
}

for (const [index, [cardId, definitionId]] of
  ACQUISITION_SCENARIOS.entries()) {
  test(`${cardId} grants its fixed-build related minion`, () => {
    const state = acquireTrinket(createGame(0x8210 + index), cardId);
    const card = minionInHand(humanPlayer(state), definitionId);
    const definition = getMinionDefinition(definitionId);
    assert.equal(card.cardId, definition.cardId);
    assert.equal(card.attack, definition.attack);
    assert.equal(card.health, definition.health);
    assert.equal(definition.collectible, false);
    assert.equal(definition.effectSupport, "partial");
  });
}

test("Boom's Monster Portrait grants another Monster at every turn start and survives save restore", () => {
  let state = acquireTrinket(createGame(0x1721), "BG32_MagicItem_172");
  state.lobbySystemsEnabled = false;
  humanPlayer(state).hand = [];

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  keepOnlyTwoPlayers(restored);

  state = gameReducer(restored, { type: "END_TURN" });
  assert.equal(state.phase, "combat");
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.phase, "recruit");
  const monster = minionInHand(humanPlayer(state), "BG31_176");
  assert.deepEqual(monster.tribes, ["mech"]);
  assert.equal(getMinionDefinition(monster.definitionId).magnetic !== undefined, true);
});

test("Curator Sticker grants the exact Golden Amalgam and modified 10/10 Venomous Amalgam pair", () => {
  const state = acquireTrinket(createGame(0x8071), "BG32_MagicItem_807");
  const player = humanPlayer(state);
  assert.equal(player.hand.length, 2);

  const amalgam = minionInHand(player, "TB_BaconShop_HERO_33_Buddy");
  assert.equal(amalgam.golden, true);
  assert.equal(amalgam.cardId, "TB_BaconShop_HERO_33_Buddy_G");
  assert.equal(amalgam.attack, 8);
  assert.equal(amalgam.health, 8);
  assert.equal(amalgam.grantsTripleReward, false);
  assert.deepEqual(amalgam.tribes, ["all"]);

  const fusionMonster = minionInHand(player, "TB_BaconShop_HP_033t");
  assert.equal(fusionMonster.golden, false);
  assert.equal(fusionMonster.cardId, "TB_BaconShop_HP_033t");
  assert.equal(fusionMonster.attack, 10);
  assert.equal(fusionMonster.health, 10);
  assert.equal(fusionMonster.venomous, true);
  assert.deepEqual(fusionMonster.tribes, ["all"]);
  assert.equal(
    getMinionDefinition(fusionMonster.definitionId).effectSupport,
    "complete",
  );
});

test("Grifter Portrait makes only the first Pirate each turn free and restores the charge next turn", () => {
  let state = acquireTrinket(createGame(0x9571), "BG32_MagicItem_957");
  state.lobbySystemsEnabled = false;
  let player = humanPlayer(state);
  const trinket = getTrinketDefinition(
    "lesser-trinket-bg32-magicitem-957",
  );
  const pirateId = ordinaryPirateDefinitionId();
  player.shop = [
    createShopMinion(state, pirateId, "grifter-first"),
    createShopMinion(state, pirateId, "grifter-second"),
  ];
  player.gold = 3;

  assert.deepEqual(getMinionPurchaseQuote(state, player.id, 0), {
    currency: "gold",
    cost: 0,
    affordable: true,
  });
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 3);
  assert.equal(player.trinketCounters[trinket.id], 1);
  assert.equal(getMinionPurchaseQuote(state, player.id, 0)?.cost, 3);
  assert.match(getTrinketProgressText(player, trinket.id) ?? "", /已使用/);

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.gold, 0);

  keepOnlyTwoPlayers(state);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(player.trinketCounters[trinket.id], 0);
  player.shop = [createShopMinion(state, pirateId, "grifter-next-turn")];
  assert.equal(getMinionPurchaseQuote(state, player.id, 0)?.cost, 0);
  assert.match(
    getTrinketProgressText(player, trinket.id) ?? "",
    /第一张海盗免费/,
  );
});
