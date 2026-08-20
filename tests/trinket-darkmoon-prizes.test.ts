import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  getSpellcraftDefinition,
  getTavernSpellPurchaseQuote,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  CORRUPTED_TOME_CARD_ID,
  DARKMOON_PRIZE_DEFINITIONS,
  TIER_ONE_DARKMOON_PRIZE_DEFINITIONS,
  TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID,
  TICKATUS_TAG_CARD_ID,
  TRIPLE_PRIZE_DEFINITION_ID,
} from "../lib/game/darkmoon-prizes.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";
import { getTavernSpellDefinition } from "../lib/game/tavern-spells.ts";
import {
  UNSUPPORTED_SYSTEM_EVENT_EFFECTS,
  getSystemEventDefinition,
} from "../lib/game/lobby-systems.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: definition.id,
  });
}

function addGeneratedSpell(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  const card: SpellcraftSpellInstance = {
    kind: "spellcraft",
    instanceId: `test-darkmoon-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: "generated",
    target: definition.target,
    effectMultiplier: 1,
  };
  state.nextInstanceId += 1;
  player.hand.push(card);
  return card;
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

const DARKMOON_EXTRA_SLOT_MARKER = "darkmoonExtraTavernSlotBuff";

function isDarkmoonExtraOffer(minion: BoardMinionInstance): boolean {
  return minion.effectCounters?.[DARKMOON_EXTRA_SLOT_MARKER] === 1;
}

function prizeDefinitionId(cardId: string): string {
  const definition = DARKMOON_PRIZE_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be a Tier 3 Darkmoon Prize`);
  return definition.id;
}

function tierOnePrizeDefinitionId(cardId: string): string {
  const definition = TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be a Tier 1 Darkmoon Prize`);
  return definition.id;
}

function enableCircusPrize(state: GameState): void {
  state.lobbySystemsEnabled = true;
  state.systemEventId = "system-event-circus-prize";
}

function definitionMinion(
  state: GameState,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    ...jsonClone(template),
    instanceId,
    definitionId,
    cardId: golden
      ? definition.goldenCardId ?? definition.cardId
      : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function moveFirstShopMinionToBoard(
  state: GameState,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const player = humanPlayer(state);
  const minion = player.shop.shift();
  assert.ok(minion);
  Object.assign(minion, overrides);
  player.board.push(minion);
  return minion;
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("the fixed build has the exact eight Tier 3 Darkmoon Prizes", () => {
  assert.deepEqual(
    DARKMOON_PRIZE_DEFINITIONS.map((definition) => definition.cardId),
    [
      "BGS_Treasures_011",
      "BGS_Treasures_015",
      "BGS_Treasures_019",
      "BGS_Treasures_020",
      "BGS_Treasures_034",
      "BGS_Treasures_037",
      "BGS_Treasures_039",
      "BGS_Treasures_104",
    ],
  );
  assert.ok(
    DARKMOON_PRIZE_DEFINITIONS.every(
      (definition) =>
        definition.spellFamily === "generated" &&
        definition.randomlyGeneratable === false,
    ),
  );
});

test("the fixed build has the exact nine Tier 1 Darkmoon Prizes", () => {
  assert.deepEqual(
    TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.map((definition) =>
      [definition.cardId, definition.description]
    ),
    [
      ["BGS_Treasures_001", "获取2张酒馆币。"],
      ["BGS_Treasures_004", "发现一个等级1的随从。"],
      ["BGS_Treasures_007", "使所有友方随从获得等同于你当前等级的攻击力。"],
      ["BGS_Treasures_013", "使酒馆中的随从在本局对战中获得+1/+1。"],
      ["BGS_Treasures_029", "在本局对战的剩余时间内，在每个回合开始时获得1次免费的刷新。"],
      ["BGS_Treasures_033", "在本局对战中，酒馆额外提供一个具有+2/+2的随从。"],
      ["BGS_Treasures_040", "获取2张香蕉果盘。"],
      ["BGS_Treasures_100", "随机获取一张消耗为（2）或以上的酒馆法术牌。"],
      ["BGS_Treasures_110", "在本局对战中，你的酒馆法术使随从额外获得+1/+1。"],
    ],
  );
  assert.ok(
    TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.every(
      (definition) =>
        definition.sourceTier === 1 &&
        definition.spellFamily === "generated" &&
        definition.randomlyGeneratable === false,
    ),
  );
});

test("Circus Prize keeps its exact registry identity and remains unsupported for random lobbies", () => {
  const definition = getSystemEventDefinition("system-event-circus-prize");
  assert.deepEqual(definition, {
    id: "system-event-circus-prize",
    cardId: "BG27_Anomaly_755",
    name: "马戏奖品",
    description:
      "三合一奖励改为一张可发现等级1暗月奖品的奖励牌；当前仅实现等级1奖品。",
    effect: "circusPrize",
  });
  assert.equal(UNSUPPORTED_SYSTEM_EVENT_EFFECTS.has(definition.effect), true);
});

test("Tickatus Tag discovers three unique saveable Prize options", () => {
  let state = acquireTrinket(createGame(0x7071), TICKATUS_TAG_CARD_ID);
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  assert.equal(pending.options.length, 3);
  assert.equal(
    new Set(pending.options.map((option) => option.definitionId)).size,
    3,
  );
  assert.ok(
    pending.options.every((option) =>
      DARKMOON_PRIZE_DEFINITIONS.some(
        (definition) => definition.id === option.definitionId,
      ),
    ),
  );

  const restored = normalizePersistedGameState(
    jsonClone(state),
  ) as GameState | null;
  assert.ok(restored);
  assert.deepEqual(restored.pendingInteraction, pending);

  const selected = pending.options[0];
  assert.ok(selected);
  state = gameReducer(restored, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  const player = humanPlayer(state);
  assert.equal(state.pendingInteraction, null);
  assert.ok(
    player.hand.some((card) => card.instanceId === selected.instanceId),
  );
  assert.equal(player.tavernSpellsCast, 0);
  assert.equal(player.playerSpellsCast, 0);
});

test("Tickatus Tag repeats at the start of every third turn", () => {
  let state = acquireTrinket(createGame(0x7072, 999), TICKATUS_TAG_CARD_ID);
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0]!.instanceId,
  });

  state = continueThroughCombat(state);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  assert.equal(pending.options.length, 3);
  assert.equal(
    humanPlayer(state).trinketCounters[
      trinketForCard(TICKATUS_TAG_CARD_ID).id
    ],
    0,
  );
});

test("Corrupted Tome grants and replaces Triple Rewards with Triple Prizes", () => {
  let state = acquireTrinket(createGame(0x8121), CORRUPTED_TOME_CARD_ID);
  let player = humanPlayer(state);
  assert.equal(
    player.hand.filter(
      (card) => card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
    ).length,
    1,
  );

  const minion = player.shop.shift();
  assert.ok(minion);
  minion.grantsTripleReward = true;
  player.hand.push(minion);
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: minion.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(
    player.hand.filter(
      (card) => card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
    ).length,
    2,
  );
  assert.equal(
    player.hand.some((card) => card.kind === "tripleReward"),
    false,
  );
});

test("Triple Prize discovers a Prize without counting as a Tavern Spell", () => {
  let state = acquireTrinket(createGame(0x8122), CORRUPTED_TOME_CARD_ID);
  let player = humanPlayer(state);
  const triplePrize = player.hand.find(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft" &&
      card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
  );
  assert.ok(triplePrize);
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: triplePrize.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  const selected = pending.options[0];
  assert.ok(selected);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.tavernSpellsCast, 0);
  assert.equal(player.tavernSpellsCastThisTurn, 0);
  assert.equal(player.playerSpellsCast, 1);
  assert.ok(
    player.hand.some((card) => card.instanceId === selected.instanceId),
  );
});

test("Circus Prize gives a Tier 1 reward spell before a Golden minion's interactive Battlecry", () => {
  let state = createGame(0x81220);
  enableCircusPrize(state);
  let player = humanPlayer(state);
  const discoverer = definitionMinion(
    state,
    "BG28_550",
    "circus-interactive-golden",
    { golden: true, grantsTripleReward: true },
  );
  player.hand = [discoverer];
  while (player.hand.length < 10) {
    addGeneratedSpell(
      state,
      player,
      prizeDefinitionId("BGS_Treasures_104"),
    );
  }

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: discoverer.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(
    player.hand.filter(
      (card) => card.definitionId === TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID,
    ).length,
    1,
  );
  assert.equal(
    player.hand.some((card) =>
      TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.some(
        (definition) => definition.id === card.definitionId,
      ),
    ),
    false,
  );
  assert.equal(state.pendingInteraction?.kind, "tavernSpellDiscover");
});

test("Circus Prize gives exactly one Tier 1 reward spell when a normal triple forms", () => {
  let state = createGame(0x812201);
  enableCircusPrize(state);
  let player = humanPlayer(state);
  player.board = [
    definitionMinion(state, "BG28_550", "circus-triple-board"),
  ];
  player.hand = [
    definitionMinion(state, "BG28_550", "circus-triple-hand"),
  ];
  player.shop = [
    definitionMinion(state, "BG28_550", "circus-triple-shop"),
  ];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.gold = 10;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(
    player.hand.filter(
      (card) => card.definitionId === TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID,
    ).length,
    1,
  );
  assert.equal(
    player.hand.filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === "BG28_550" &&
        card.golden,
    ).length,
    1,
  );
  assert.equal(
    player.hand.some((card) =>
      TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.some(
        (definition) => definition.id === card.definitionId,
      ),
    ),
    false,
  );
  assert.equal(state.pendingInteraction, null);
});

test("a full-hand Tier 1 reward spell discovers only Tier 1 Prizes and preserves the selected card", () => {
  let state = createGame(0x81221);
  let player = humanPlayer(state);
  const reward = addGeneratedSpell(
    state,
    player,
    TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID,
  );
  while (player.hand.length < 10) {
    addGeneratedSpell(
      state,
      player,
      prizeDefinitionId("BGS_Treasures_104"),
    );
  }

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: reward.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "darkmoonPrizeDiscover");
  assert.equal(pending.options.length, 3);
  assert.ok(
    pending.options.every((option) =>
      TIER_ONE_DARKMOON_PRIZE_DEFINITIONS.some(
        (definition) => definition.id === option.definitionId,
      ),
    ),
  );
  const selected = pending.options[0];
  assert.ok(selected);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: selected.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.ok(
    player.hand.some((card) => card.instanceId === selected.instanceId),
  );
  assert.equal(player.playerSpellsCast, 1);
});

test("Holy Light and Repeat Customer use their exact friendly targets", () => {
  let state = createGame(0x8123);
  let player = humanPlayer(state);
  const holyTarget = moveFirstShopMinionToBoard(state);
  const holyAttack = holyTarget.attack;
  const holy = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_015"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: holy.instanceId,
    targetInstanceId: holyTarget.instanceId,
  });
  player = humanPlayer(state);
  const blessed = player.board.find(
    (minion) => minion.instanceId === holyTarget.instanceId,
  );
  assert.ok(blessed);
  assert.equal(blessed.attack, holyAttack + 10);
  assert.equal(blessed.divineShield, true);

  const repeatTarget = moveFirstShopMinionToBoard(state);
  const attackBefore = repeatTarget.attack;
  const healthBefore = repeatTarget.health;
  const repeat = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_034"),
  );
  blessed.golden = true;
  assert.ok(
    getLegalSpellcraftTargetIds(state, player.id, repeat).includes(
      repeatTarget.instanceId,
    ),
  );
  assert.equal(
    getLegalSpellcraftTargetIds(state, player.id, repeat).includes(
      blessed.instanceId,
    ),
    false,
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: repeat.instanceId,
    targetInstanceId: repeatTarget.instanceId,
  });
  const returned = humanPlayer(state).hand.find(
    (card) => card.instanceId === repeatTarget.instanceId,
  );
  assert.ok(returned?.kind === "minion");
  assert.equal(returned.attack, attackBefore + 6);
  assert.equal(returned.health, healthBefore + 6);
});

test("Bananas, All That Glitters, and Mindflayer Goggles resolve exactly", () => {
  let state = createGame(0x8124);
  let player = humanPlayer(state);
  const bananas = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_019"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: bananas.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.ok(
    player.hand.every(
      (card) =>
        card.kind === "tavernSpell" && card.cardId === "BG28_897",
    ),
  );

  player.hand = [];
  const glitter = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_037"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: glitter.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.shop.filter((minion) => minion.golden).length, 1);

  const stolenIds = new Set([
    ...player.shop.map((card) => card.instanceId),
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((card) => card.instanceId),
  ]);
  const goggles = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_039"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: goggles.instanceId,
  });
  player = humanPlayer(state);
  assert.ok(
    [...stolenIds].every((instanceId) =>
      player.hand.some((card) => card.instanceId === instanceId),
    ),
  );
  assert.ok(
    player.shop.every((card) => !stolenIds.has(card.instanceId)),
  );
});

test("Top Shelf, Training Session, and Reserve Prices use deferred and same-turn state", () => {
  let state = createGame(0x8125, 999);
  let player = humanPlayer(state);
  player.tavernTier = 2;
  const topShelf = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_020"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: topShelf.instanceId,
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.exactTier, 3);
  assert.ok(pending.options.every((option) => option.tier === 3));
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0]!.instanceId,
  });
  assert.equal(humanPlayer(state).playerSpellsCast, 1);

  player = humanPlayer(state);
  const oldHeroPower = player.heroPowerId;
  const training = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_011"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: training.instanceId,
  });
  pending = state.pendingInteraction;
  assert.ok(pending?.kind === "heroPowerChoice");
  assert.equal(pending.completionSource, "generatedSpellCast");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.optionIds[0]!,
  });
  player = humanPlayer(state);
  assert.notEqual(player.heroPowerId, oldHeroPower);
  assert.equal(player.playerSpellsCast, 2);

  const spellOffer = player.spellShop;
  assert.ok(spellOffer);
  const costBefore = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spellOffer.instanceId,
  )?.cost;
  assert.equal(typeof costBefore, "number");
  const reservePrices = addGeneratedSpell(
    state,
    player,
    prizeDefinitionId("BGS_Treasures_104"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: reservePrices.instanceId,
  });
  player = humanPlayer(state);
  const costAfter = getTavernSpellPurchaseQuote(
    state,
    player.id,
    spellOffer.instanceId,
  )?.cost;
  assert.equal(costAfter, Math.max(0, (costBefore ?? 0) - 1));
  assert.equal(player.darkmoonReservePricesDiscount, 1);

  state = continueThroughCombat(state);
  assert.equal(humanPlayer(state).darkmoonReservePricesDiscount, 0);
});

test("Pocket Change, Might of Stormwind, and Gacha Gift use real cards and Tier 1 discovery", () => {
  let state = createGame(0x81250);
  let player = humanPlayer(state);
  player.hand = [];
  const target = moveFirstShopMinionToBoard(state);
  const targetAttack = target.attack;

  const pocketChange = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_001"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: pocketChange.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.hand.map((card) => [card.kind, card.cardId]),
    [
      ["tavernSpell", "BG28_810"],
      ["tavernSpell", "BG28_810"],
    ],
  );

  const might = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_007"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: might.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.board[0]?.attack, targetAttack + player.tavernTier);

  const gacha = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_004"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: gacha.instanceId,
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.exactTier, 1);
  assert.ok(pending.options.every((option) => option.tier === 1));
});

test("The Good Stuff and New Recruit persist across refreshes with one separately buffed extra slot", () => {
  let state = createGame(0x81251);
  let player = humanPlayer(state);
  player.hand = [];
  const before = new Map(
    player.shop.map((minion) => [
      minion.instanceId,
      [minion.attack, minion.health] as const,
    ]),
  );
  const goodStuff = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_013"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: goodStuff.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.tavernMinionAttackBonus, 1);
  assert.equal(player.tavernMinionHealthBonus, 1);
  for (const minion of player.shop) {
    const stats = before.get(minion.instanceId);
    assert.ok(stats);
    assert.deepEqual([minion.attack, minion.health], [stats[0] + 1, stats[1] + 1]);
  }

  const normalCount = player.shop.length;
  const newRecruit = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_033"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: newRecruit.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.shop.length, normalCount + 1);
  assert.equal(player.systemEventCounters.darkmoonExtraTavernMinions, 1);
  const immediateExtra = player.shop.at(-1);
  assert.ok(immediateExtra);
  const immediateDefinition = getMinionDefinition(
    immediateExtra.definitionId,
  );
  assert.deepEqual(
    [immediateExtra.attack, immediateExtra.health],
    [immediateDefinition.attack + 3, immediateDefinition.health + 3],
  );

  player.gold = 100;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, normalCount + 1);
  const extraBuffed = player.shop.filter((minion) => {
    const definition = getMinionDefinition(minion.definitionId);
    return (
      minion.attack === definition.attack + 3 &&
      minion.health === definition.health + 3
    );
  });
  assert.equal(extraBuffed.length, 1);
  assert.equal(player.shop.filter(isDarkmoonExtraOffer).length, 1);
});

test("New Recruit keeps the buff on the extra slot through frozen Full House refills", () => {
  let state = createGame(0x812511);
  let player = humanPlayer(state);
  player.hand = [];
  player.systemEventCounters.fullHouseActive = 1;
  const newRecruit = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_033"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: newRecruit.instanceId,
  });
  player = humanPlayer(state);
  player.gold = 100;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);

  assert.equal(player.shop.length, 7);
  assert.equal(player.shop.filter(isDarkmoonExtraOffer).length, 1);
  const initialExtra = player.shop.find(isDarkmoonExtraOffer);
  assert.ok(initialExtra);
  const initialExtraDefinition = getMinionDefinition(initialExtra.definitionId);
  assert.deepEqual(
    [initialExtra.attack, initialExtra.health],
    [initialExtraDefinition.attack + 2, initialExtraDefinition.health + 2],
  );

  player.frozen = true;
  const normalIndex = player.shop.findIndex(
    (minion) => !isDarkmoonExtraOffer(minion),
  );
  assert.ok(normalIndex >= 0);
  const normalId = player.shop[normalIndex]!.instanceId;
  const beforeNormalPurchaseIds = new Set(
    player.shop.map((minion) => minion.instanceId),
  );
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: normalIndex });
  player = humanPlayer(state);
  assert.equal(player.frozen, true);
  assert.equal(player.shop.length, 7);
  assert.equal(player.shop.filter(isDarkmoonExtraOffer).length, 1);
  const normalReplacement = player.shop.find(
    (minion) => !beforeNormalPurchaseIds.has(minion.instanceId),
  );
  assert.ok(normalReplacement);
  assert.equal(isDarkmoonExtraOffer(normalReplacement), false);
  const purchasedNormal = player.hand.find(
    (card) => card.instanceId === normalId,
  );
  assert.ok(purchasedNormal?.kind === "minion");
  assert.equal(
    purchasedNormal.effectCounters?.[DARKMOON_EXTRA_SLOT_MARKER],
    undefined,
  );

  player.hand = [];
  const extraIndex = player.shop.findIndex(isDarkmoonExtraOffer);
  assert.ok(extraIndex >= 0);
  const extraId = player.shop[extraIndex]!.instanceId;
  const beforeExtraPurchaseIds = new Set(
    player.shop.map((minion) => minion.instanceId),
  );
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: extraIndex });
  player = humanPlayer(state);
  assert.equal(player.frozen, true);
  assert.equal(player.shop.length, 7);
  assert.equal(player.shop.filter(isDarkmoonExtraOffer).length, 1);
  const extraReplacement = player.shop.find(
    (minion) => !beforeExtraPurchaseIds.has(minion.instanceId),
  );
  assert.ok(extraReplacement);
  assert.equal(isDarkmoonExtraOffer(extraReplacement), true);
  const purchasedExtra = player.hand.find(
    (card) => card.instanceId === extraId,
  );
  assert.ok(purchasedExtra?.kind === "minion");
  assert.equal(
    purchasedExtra.effectCounters?.[DARKMOON_EXTRA_SLOT_MARKER],
    undefined,
  );
});

test("New Recruit marks and buffs only its extra slot on Hamuul special pages", () => {
  let state = createGame(0x812512);
  let player = humanPlayer(state);
  player.tavernTier = 6;
  const tribe = state.activeTribes[0];
  assert.ok(tribe);
  const targetDefinition = MINION_DEFINITIONS.find((definition) => {
    const tribes =
      definition.tribes ??
      (definition.tribe === "neutral" ? [] : [definition.tribe]);
    return tribes.includes(tribe);
  });
  assert.ok(targetDefinition);
  const target = definitionMinion(
    state,
    targetDefinition.id,
    "darkmoon-hamuul-target",
  );
  player.board = [target];
  player.hand = [
    tavernSpell(
      "tavern-spell-lost-staff-of-hamuul",
      "darkmoon-hamuul-staff",
    ),
  ];
  player.systemEventCounters.darkmoonExtraTavernMinions = 1;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "darkmoon-hamuul-staff",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);

  assert.equal(player.shop.length, 8);
  assert.equal(player.shop.filter(isDarkmoonExtraOffer).length, 1);
  assert.ok(
    player.shop.every(
      (minion) => minion.tribes.includes(tribe) || minion.tribes.includes("all"),
    ),
  );
  const extra = player.shop.find(isDarkmoonExtraOffer);
  assert.ok(extra);
  const definition = getMinionDefinition(extra.definitionId);
  assert.deepEqual(
    [extra.attack, extra.health],
    [definition.attack + 2, definition.health + 2],
  );
});

test("New Recruit transfers its extra-slot buff through queued Fodder with and without a Demon", () => {
  const fodderDefinition = getMinionDefinition("live-demon-fodder-token");
  for (const [caseIndex, withDemon] of [false, true].entries()) {
    let state = createGame(0x812513 + caseIndex);
    let player = humanPlayer(state);
    const demon = withDemon
      ? definitionMinion(
          state,
          "BG35_801",
          `darkmoon-fodder-demon-${caseIndex}`,
          { tribe: "demon", tribes: ["demon"] },
        )
      : null;
    player.board = demon ? [demon] : [];
    player.hand = [];
    player.systemEventCounters.darkmoonExtraTavernMinions = 1;
    player.demonFodderRefreshQueue = [1];
    player.freeRefreshes = 1;
    const demonStatsBefore = demon
      ? [demon.attack, demon.health] as const
      : null;

    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);

    assert.equal(player.shop.filter(isDarkmoonExtraOffer).length, 1);
    const markedOffer = player.shop.find(isDarkmoonExtraOffer);
    assert.ok(markedOffer);
    const markedDefinition = getMinionDefinition(markedOffer.definitionId);
    assert.deepEqual(
      [markedOffer.attack, markedOffer.health],
      [markedDefinition.attack + 2, markedDefinition.health + 2],
    );
    if (!withDemon) {
      assert.equal(
        markedOffer.definitionId,
        "live-demon-fodder-token",
      );
      continue;
    }

    assert.notEqual(
      markedOffer.definitionId,
      "live-demon-fodder-token",
    );
    assert.equal(
      player.shop.some(
        (minion) => minion.definitionId === "live-demon-fodder-token",
      ),
      false,
    );
    const fedDemon = player.board.find(
      (minion) => minion.instanceId === demon?.instanceId,
    );
    assert.ok(fedDemon && demonStatsBefore);
    assert.deepEqual(
      [fedDemon.attack, fedDemon.health],
      [
        demonStatsBefore[0] + fodderDefinition.attack + 2,
        demonStatsBefore[1] + fodderDefinition.health + 2,
      ],
    );
  }
});

test("New Recruit distinguishes the baseline spell-converted Wisdomball slot from a real extra offer", () => {
  const refreshWarbandCopies = (
    seed: number,
    boardSize: number,
  ): GameState => {
    let state = createGame(seed);
    let player = humanPlayer(state);
    player.tavernTier = 5;
    const sourceDefinitionId = player.shop[0]?.definitionId;
    assert.ok(sourceDefinitionId);
    player.board = Array.from({ length: boardSize }, (_, index) =>
      definitionMinion(
        state,
        sourceDefinitionId,
        `darkmoon-warband-copy-${boardSize}-${index}`,
      )
    );
    state = acquireTrinket(state, "BG35_MagicItem_930");
    player = humanPlayer(state);
    player.systemEventCounters.darkmoonExtraTavernMinions = 1;
    return gameReducer(state, { type: "REFRESH_SHOP" });
  };

  const partial = humanPlayer(refreshWarbandCopies(0x812515, 6));
  assert.equal(partial.shop.length, 6);
  assert.equal(partial.shop.filter(isDarkmoonExtraOffer).length, 0);

  const extended = humanPlayer(refreshWarbandCopies(0x812516, 7));
  assert.equal(extended.shop.length, 7);
  assert.equal(extended.shop.filter(isDarkmoonExtraOffer).length, 1);
  const extra = extended.shop.find(isDarkmoonExtraOffer);
  assert.ok(extra);
  const definition = getMinionDefinition(extra.definitionId);
  assert.deepEqual(
    [extra.attack, extra.health],
    [definition.attack + 2, definition.health + 2],
  );
});

test("Rocking and Rolling, Banana Bunch, Spread Tome, and Crystallized use persistent Tavern Spell state", () => {
  let state = createGame(0x81252, 999);
  let player = humanPlayer(state);
  player.hand = [];
  const target = definitionMinion(
    state,
    "BG28_550",
    "tier-one-banana-target",
  );
  player.board = [target];
  const originalStats = [target.attack, target.health] as const;

  for (const cardId of ["BGS_Treasures_029", "BGS_Treasures_110"] as const) {
    const prize = addGeneratedSpell(
      state,
      humanPlayer(state),
      tierOnePrizeDefinitionId(cardId),
    );
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: prize.instanceId,
    });
  }
  player = humanPlayer(state);
  assert.equal(
    player.systemEventCounters.darkmoonFreeRefreshesPerTurn,
    1,
  );
  assert.deepEqual(
    [player.tavernSpellAttackBonus, player.tavernSpellHealthBonus],
    [1, 1],
  );

  const bananaBunch = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_040"),
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: bananaBunch.instanceId,
  });
  player = humanPlayer(state);
  const bananas = player.hand.filter(
    (card) => card.kind === "tavernSpell" && card.cardId === "BG28_897",
  );
  assert.equal(bananas.length, 2);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: bananas[0]!.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0]?.attack, player.board[0]?.health],
    [originalStats[0] + 3, originalStats[1] + 3],
  );

  const spreadTome = addGeneratedSpell(
    state,
    player,
    tierOnePrizeDefinitionId("BGS_Treasures_100"),
  );
  const handIdsBefore = new Set(player.hand.map((card) => card.instanceId));
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: spreadTome.instanceId,
  });
  player = humanPlayer(state);
  const gainedSpell = player.hand.find(
    (card) => card.kind === "tavernSpell" && !handIdsBefore.has(card.instanceId),
  );
  assert.ok(gainedSpell?.kind === "tavernSpell");
  assert.ok(getTavernSpellDefinition(gainedSpell.definitionId).cost >= 2);

  state = continueThroughCombat(state);
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 1);
  const goldBefore = player.gold;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).gold, goldBefore);
});

test("AI chooses and casts generated Darkmoon Prizes without pausing", () => {
  let state = createGame(0x8126, 999);
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  ai.hand = [];
  addGeneratedSpell(state, ai, TRIPLE_PRIZE_DEFINITION_ID);
  const castsBefore = ai.playerSpellsCast;

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(state.pendingInteraction, null);
  assert.ok(nextAi.playerSpellsCast >= castsBefore + 2);
  assert.equal(
    nextAi.hand.some(
      (card) => card.definitionId === TRIPLE_PRIZE_DEFINITION_ID,
    ),
    false,
  );
});

test("AI automatically chooses and casts a Tier 1 Circus Prize without pausing", () => {
  let state = createGame(0x81260, 999);
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  ai.hand = [];
  addGeneratedSpell(state, ai, TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID);
  const castsBefore = ai.playerSpellsCast;

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = state.players.find((player) => player.id === ai.id);
  assert.ok(nextAi);
  assert.equal(state.pendingInteraction, null);
  assert.ok(nextAi.playerSpellsCast >= castsBefore + 2);
  assert.equal(
    nextAi.hand.some(
      (card) => card.definitionId === TIER_ONE_TRIPLE_PRIZE_DEFINITION_ID,
    ),
    false,
  );
});

test("current saves repair missing Darkmoon counters and reject unsafe values", () => {
  const legacyShape = jsonClone(createGame(0x8127)) as GameState;
  for (const player of legacyShape.players) {
    delete player.darkmoonReservePricesDiscount;
    delete player.pendingTickatusTagPrizes;
  }
  const repaired = normalizePersistedGameState(legacyShape) as GameState | null;
  assert.ok(repaired);
  assert.ok(
    repaired.players.every(
      (player) =>
        player.darkmoonReservePricesDiscount === 0 &&
        player.pendingTickatusTagPrizes === 0,
    ),
  );

  const unsafe = jsonClone(repaired);
  unsafe.players[0]!.darkmoonReservePricesDiscount = -1;
  assert.equal(normalizePersistedGameState(unsafe), null);
});
