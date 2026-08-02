import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  getUpgradeCost,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type ConsolationCoinSpellInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
  type TripleRewardSpellInstance,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V22,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const COMPLETED_RECRUIT_EVENT_CARD_IDS = [
  "BG26_810",
  "BG31_824",
  "BG23_018",
  "BG33_823",
  "BG26_814",
  "BG29_840",
  "BG29_841",
  "BG33_893",
  "BG26_137",
  "BG30_122",
  "BG32_846",
  "BGS_104",
] as const;

const GOLDEN_CARD_IDS = {
  BG26_810: "BG26_810_G",
  BG31_824: "BG31_824_G",
  BG23_018: "BG23_018_G",
  BG33_823: "BG33_823_G",
  BG26_814: "BG26_814_G",
  BG29_840: "BG29_840_G",
  BG29_841: "BG29_841_G",
  BG33_893: "BG33_893_G",
  BG26_137: "BG26_137_G",
  BG30_122: "BG30_122_G",
  BG32_846: "BG32_846_G",
  BGS_104: "TB_BaconUps_201",
} as const;

const BOUNTY_DEFINITION_IDS = new Set([
  "tavern-spell-friendly-bounty",
  "tavern-spell-healthy-bounty",
  "tavern-spell-hostile-bounty",
  "tavern-spell-selfish-bounty",
  "tavern-spell-wealthy-bounty",
]);

function playerById(
  state: GameState,
  playerId: string,
): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === playerId,
  );
  assert.ok(player, `player ${playerId} must exist`);
  return player;
}

function humanPlayer(state: GameState): PlayerState {
  return playerById(state, state.humanPlayerId);
}

function definitionMinion(
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
    cardId: golden
      ? definition.goldenCardId ?? `${definition.cardId}_G`
      : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: golden
      ? definition.goldenSellValue ?? definition.sellValue ?? 1
      : definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
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
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
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
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
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
  return definitionMinion(definitionId, instanceId, {
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

function spellcraft(
  definitionId: string,
  instanceId: string,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: "spellcraft",
    target: definition.target,
    effectMultiplier: 1,
  };
}

function consolationCoin(
  instanceId: string,
): ConsolationCoinSpellInstance {
  return {
    kind: "consolationCoin",
    instanceId,
    definitionId: "consolation-coin",
    cardId: "BG28_521t",
    name: "补贴铸币",
    description: "获得1枚铸币。",
    spellFamily: "coin",
  };
}

function tripleReward(
  instanceId: string,
): TripleRewardSpellInstance {
  return {
    ...definitionMinion("BG35_801", instanceId, { tier: 2 }),
    kind: "tripleReward",
    tier: 2,
    definitionId: "triple-reward",
    cardId: "TB_BaconShop_Triples_01",
    name: "三连奖励",
    description: "发现一个比你当前酒馆等级高一级的随从。",
  };
}

function playHandCard(
  state: GameState,
  cardInstanceId: string,
): GameState {
  return gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId,
  });
}

function boardMinion(
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance {
  const minion = player.board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion, `${instanceId} must remain on the board`);
  return minion;
}

function handMinion(
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance {
  const minion = player.hand.find(
    (candidate): candidate is BoardMinionInstance =>
      candidate.kind === "minion" &&
      candidate.instanceId === instanceId,
  );
  assert.ok(minion, `${instanceId} must remain in hand`);
  return minion;
}

function tavernSpellsInHand(
  player: PlayerState,
): TavernSpellInstance[] {
  return player.hand.filter(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell",
  );
}

function assertStats(
  minion: BoardMinionInstance,
  attack: number,
  health: number,
): void {
  assert.deepEqual(
    [minion.attack, minion.health],
    [attack, health],
    `${minion.instanceId} has unexpected stats`,
  );
}

function assertStatDelta(
  minion: BoardMinionInstance,
  before: { attack: number; health: number },
  attack: number,
  health: number,
): void {
  assertStats(
    minion,
    before.attack + attack,
    before.health + health,
  );
}

function stats(minion: BoardMinionInstance): {
  attack: number;
  health: number;
} {
  return { attack: minion.attack, health: minion.health };
}

function upgradeForCost(
  state: GameState,
  tavernTier: 1 | 2 | 3 | 4 | 5,
  cost: number,
): GameState {
  const player = humanPlayer(state);
  player.tavernTier = tavernTier;
  player.upgradeDiscount = 0;
  const baseCost = getUpgradeCost(state, player.id);
  assert.ok(
    cost >= 0 && cost <= baseCost,
    `cannot make Tier ${tavernTier} upgrade cost ${cost}`,
  );
  player.upgradeDiscount = baseCost - cost;
  player.gold = Math.max(player.gold, cost);
  return gameReducer(state, { type: "UPGRADE_TAVERN" });
}

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[] = [],
): PlayerState {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    if (player.isHuman) {
      player.alive = true;
      player.health = 100;
      continue;
    }
    player.hand = [];
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 100;
      player.board = opponentBoard;
      delete player.eliminatedRound;
    } else {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
  return opponent;
}

function continueAfterCombat(state: GameState): GameState {
  assert.equal(state.phase, "combat");
  const recruit = gameReducer(state, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function isolateAiLobby(
  state: GameState,
  activeAiId: string,
): PlayerState {
  const human = humanPlayer(state);
  human.alive = true;
  human.health = 100;
  human.armor = 0;
  human.gold = 0;
  human.board = [];
  human.hand = [];
  human.shop = [];
  human.spellShop = null;
  human.additionalSpellShop = [];
  for (const player of state.players) {
    if (player.isHuman) {
      continue;
    }
    if (player.id === activeAiId) {
      player.alive = true;
      player.health = 100;
      delete player.eliminatedRound;
    } else {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.hand = [];
      player.shop = [];
      player.spellShop = null;
      player.additionalSpellShop = [];
      player.eliminatedRound = 0;
    }
  }
  return playerById(state, activeAiId);
}

function totalPoolCopies(
  state: GameState,
  definitionId: string,
): number {
  let total = state.pool[definitionId] ?? 0;
  for (const player of state.players) {
    for (const card of [
      ...player.board,
      ...player.hand,
      ...player.shop,
    ]) {
      if (
        card.kind === "minion" &&
        card.definitionId === definitionId
      ) {
        total += card.poolCopies;
      }
    }
  }
  if (state.pendingInteraction?.kind === "discover") {
    for (const option of state.pendingInteraction.options) {
      if (option.definitionId === definitionId) {
        total += option.poolCopies;
      }
    }
  }
  return total;
}

function clearMinionPool(state: GameState): void {
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
}

test("the Recruit-event batch has complete ordinary and Golden metadata", () => {
  for (const definitionId of COMPLETED_RECRUIT_EVENT_CARD_IDS) {
    const definition = getMinionDefinition(definitionId);
    assert.equal(definition.cardId, definitionId);
    assert.equal(definition.effectSupport, "complete", definitionId);
    assert.equal(
      definition.goldenCardId,
      GOLDEN_CARD_IDS[definitionId],
      definitionId,
    );
    assert.ok(definition.description.length > 0, definitionId);
    assert.ok(
      (definition.goldenDescription?.length ?? 0) > 0,
      `${definitionId} must expose its Golden rules`,
    );
  }
});

test("actual Gold spending is broadcast across minion, discounted spell, refresh, and upgrade purchases", () => {
  let state = createGame(0xa500);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG26_810",
    "ledger-powder-courier",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "ledger-pirate",
  );
  const pirateBefore = stats(pirate);
  player.board = [source, pirate];
  player.hand = [];
  player.gold = 20;
  player.shop = [
    definitionMinion("BG35_801", "ledger-minion-offer"),
  ];
  player.spellShop = tavernSpell(
    "tavern-spell-azerite-empowerment",
    "ledger-spell-offer",
  );
  player.additionalSpellShop = [];
  player.nextTavernSpellDiscount = 2;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 3);
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩3枚/,
  );

  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "ledger-spell-offer",
  });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 5);
  assert.equal(player.nextTavernSpellDiscount, 0);
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩1枚/,
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 6);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    pirateBefore,
    2,
    0,
  );
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩6枚/,
  );

  player.tavernTier = 1;
  player.upgradeDiscount = 4;
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 7);
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩5枚/,
  );
});

test("free, health-paid, and failed Recruit actions spend no Gold", () => {
  let state = createGame(0xa501);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG26_810",
    "free-powder-courier",
  );
  const pirate = definitionMinion("BG26_135", "free-pirate");
  const before = stats(pirate);
  player.board = [source, pirate];
  player.hand = [];
  player.gold = 0;
  player.freeRefreshes = 1;

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 0);
  assert.equal(player.freeRefreshes, 0);

  player.spellShop = tavernSpell(
    "tavern-spell-hasty-excavation",
    "health-spell-offer",
  );
  player.additionalSpellShop = [];
  const healthBefore = player.health;
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "health-spell-offer",
  });
  player = humanPlayer(state);
  assert.equal(player.health, healthBefore - 3);
  assert.equal(player.goldSpentThisTurn, 0);

  player.spellShop = tavernSpell(
    "tavern-spell-azerite-empowerment",
    "free-spell-offer",
  );
  player.nextTavernSpellDiscount = 4;
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "free-spell-offer",
  });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 0);

  player.shop = [
    definitionMinion("BG35_801", "failed-minion-offer"),
  ];
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 0);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    before,
    0,
    0,
  );
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩6枚/,
  );
});

test("Powder Courier crosses multiple thresholds while Brann, Titus, and Drakkari do not multiply it", () => {
  let state = createGame(0xa502);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG26_810",
    "multi-cross-powder-courier",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "multi-cross-pirate",
  );
  const before = stats(pirate);
  player.board = [
    source,
    pirate,
    definitionMinion("BG_LOE_077", "multi-cross-brann"),
    definitionMinion("BG25_354", "multi-cross-titus"),
    definitionMinion("BG26_ICC_901", "multi-cross-drakkari"),
  ];
  player.hand = [];

  state = upgradeForCost(state, 5, 12);
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 12);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    before,
    4,
    0,
  );
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩6枚/,
  );
});

test("Golden Powder Courier repeats each threshold exactly twice", () => {
  let state = createGame(0xa503);
  let player = humanPlayer(state);
  const source = goldenMinion(
    "BG26_810",
    "golden-powder-courier",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "golden-courier-pirate",
  );
  const before = stats(pirate);
  player.board = [source, pirate];
  player.hand = [];

  state = upgradeForCost(state, 2, 6);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    before,
    4,
    0,
  );
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩6枚/,
  );
});

test("Gold threshold progress is independent per watcher and carries across Recruit turns", () => {
  let state = createGame(0xa504);
  let player = humanPlayer(state);
  const first = definitionMinion(
    "BG26_810",
    "first-progress-courier",
  );
  const second = definitionMinion(
    "BG26_810",
    "second-progress-courier",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "progress-pirate",
  );
  const before = stats(pirate);
  player.board = [first, pirate];
  player.hand = [];

  state = upgradeForCost(state, 1, 5);
  player = humanPlayer(state);
  player.board.push(second);
  player.gold = 1;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    before,
    2,
    0,
  );
  assert.match(
    boardMinion(player, first.instanceId).description,
    /还剩6枚/,
  );
  assert.match(
    boardMinion(player, second.instanceId).description,
    /还剩5枚/,
  );

  keepOnlyOneOpponent(state);
  state = gameReducer(state, { type: "END_TURN" });
  state = continueAfterCombat(state);
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 0);
  assert.match(
    boardMinion(player, first.instanceId).description,
    /还剩6枚/,
  );
  assert.match(
    boardMinion(player, second.instanceId).description,
    /还剩5枚/,
  );

  player.gold = 5;
  for (let count = 0; count < 5; count += 1) {
    state = gameReducer(state, { type: "REFRESH_SHOP" });
  }
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 5);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    before,
    4,
    0,
  );
  assert.match(
    boardMinion(player, first.instanceId).description,
    /还剩1枚/,
  );
  assert.match(
    boardMinion(player, second.instanceId).description,
    /还剩6枚/,
  );
});

test("a purchased Gold watcher does not observe its own purchase", () => {
  let state = createGame(0xa505);
  let player = humanPlayer(state);
  const offer = definitionMinion(
    "BG26_810",
    "purchased-powder-courier",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "purchase-order-pirate",
  );
  const before = stats(pirate);
  player.board = [pirate];
  player.hand = [];
  player.shop = [offer];
  player.gold = 6;

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assert.equal(player.goldSpentThisTurn, 3);
  assert.match(
    handMinion(player, offer.instanceId).description,
    /还剩6枚/,
  );

  state = playHandCard(state, offer.instanceId);
  player = humanPlayer(state);
  assert.match(
    boardMinion(player, offer.instanceId).description,
    /还剩6枚/,
  );
  player.gold = 3;
  player.shop = [
    definitionMinion("BG35_801", "purchase-order-filler"),
  ];
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    before,
    0,
    0,
  );
  assert.match(
    boardMinion(player, offer.instanceId).description,
    /还剩3枚/,
  );
});

test("tripling preserves the nearest Gold threshold remainder", () => {
  let state = createGame(0xa506);
  let player = humanPlayer(state);
  const first = definitionMinion(
    "BG26_810",
    "triple-progress-courier-a",
  );
  const second = definitionMinion(
    "BG26_810",
    "triple-progress-courier-b",
  );
  const third = definitionMinion(
    "BG26_810",
    "triple-progress-courier-c",
    { poolCopies: 1 },
  );
  const pirate = definitionMinion(
    "BG26_135",
    "triple-progress-pirate",
  );
  player.board = [first, second, pirate];
  player.hand = [];

  state = upgradeForCost(state, 1, 5);
  player = humanPlayer(state);
  player.shop = [third];
  player.gold = 3;
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const golden = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG26_810" &&
      card.golden,
  );
  assert.ok(golden);
  assert.match(golden.description, /还剩4枚/);
  assert.equal(golden.poolCopies, 1);

  state = playHandCard(state, golden.instanceId);
  player = humanPlayer(state);
  const targetBefore = stats(
    boardMinion(player, pirate.instanceId),
  );
  state = upgradeForCost(state, 2, 4);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    targetBefore,
    4,
    0,
  );
  assert.match(
    boardMinion(player, golden.instanceId).description,
    /还剩6枚/,
  );
});

test("Dual-Wielding Pirate chooses two distinct Pirates in one pulse", () => {
  let state = createGame(0xa510);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG31_824",
    "ordinary-dual-wield-source",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "ordinary-dual-wield-target",
  );
  const outsider = definitionMinion(
    "BG35_801",
    "ordinary-dual-wield-outsider",
  );
  const sourceBefore = stats(source);
  const pirateBefore = stats(pirate);
  const outsiderBefore = stats(outsider);
  player.board = [source, pirate, outsider];
  player.hand = [];

  state = upgradeForCost(state, 1, 5);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, source.instanceId),
    sourceBefore,
    3,
    4,
  );
  assertStatDelta(
    boardMinion(player, pirate.instanceId),
    pirateBefore,
    3,
    4,
  );
  assertStatDelta(
    boardMinion(player, outsider.instanceId),
    outsiderBefore,
    0,
    0,
  );
});

test("Golden Dual-Wielding Pirate executes two independent random two-target pulses", () => {
  let observedDifferentSecondSubset = false;
  for (
    let seed = 0xa511;
    seed < 0xa591 && !observedDifferentSecondSubset;
    seed += 1
  ) {
    let state = createGame(seed);
    let player = humanPlayer(state);
    const pirates = [
      goldenMinion("BG31_824", `golden-dual-source-${seed}`),
      ...Array.from({ length: 3 }, (_, index) =>
        definitionMinion(
          "BG26_135",
          `golden-dual-target-${seed}-${index}`,
        ),
      ),
    ];
    const before = new Map(
      pirates.map((minion) => [minion.instanceId, stats(minion)]),
    );
    player.board = pirates;
    player.hand = [];

    state = upgradeForCost(state, 1, 5);
    player = humanPlayer(state);
    const pulseCounts = pirates.map((minion) => {
      const current = boardMinion(player, minion.instanceId);
      const original = before.get(minion.instanceId);
      assert.ok(original);
      const attackPulses = (current.attack - original.attack) / 3;
      const healthPulses = (current.health - original.health) / 4;
      assert.equal(attackPulses, healthPulses);
      assert.ok(
        attackPulses === 0 ||
          attackPulses === 1 ||
          attackPulses === 2,
      );
      return attackPulses;
    });
    assert.equal(
      pulseCounts.reduce<number>(
        (total, count) => total + count,
        0,
      ),
      4,
    );
    observedDifferentSecondSubset =
      pulseCounts.filter((count) => count > 0).length >= 3;
  }
  assert.equal(
    observedDifferentSecondSubset,
    true,
    "at least one fixed seed must prove pulse two selected a different subset",
  );
});

test("Darkgaze Elder applies current-value Blood Gems to every Quilboar", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xa520 + index);
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BG23_018", `darkgaze-source-${index}`)
      : definitionMinion("BG23_018", `darkgaze-source-${index}`);
    const quilboar = definitionMinion(
      "BG26_159",
      `darkgaze-quilboar-${index}`,
    );
    const outsider = definitionMinion(
      "BG35_801",
      `darkgaze-outsider-${index}`,
    );
    const sourceBefore = stats(source);
    const quilboarBefore = stats(quilboar);
    const outsiderBefore = stats(outsider);
    player.board = [source, quilboar, outsider];
    player.hand = [];
    player.bloodGemAttack = 2;
    player.bloodGemHealth = 3;

    state = upgradeForCost(state, 3, 8);
    player = humanPlayer(state);
    const gemCount = golden ? 4 : 2;
    for (const [minion, before] of [
      [boardMinion(player, source.instanceId), sourceBefore],
      [boardMinion(player, quilboar.instanceId), quilboarBefore],
    ] as const) {
      assertStatDelta(
        minion,
        before,
        2 * gemCount,
        3 * gemCount,
      );
      assert.deepEqual(
        [minion.bloodGemAttack, minion.bloodGemHealth],
        [2 * gemCount, 3 * gemCount],
      );
    }
    assertStatDelta(
      boardMinion(player, outsider.instanceId),
      outsiderBefore,
      0,
      0,
    );
  }
});

test("Admiral Rogers obeys hand capacity and never reserves the Tavern Spell pool", () => {
  for (const [index, scenario] of [
    { golden: false, handSize: 10, expectedRewards: 0 },
    { golden: true, handSize: 9, expectedRewards: 1 },
  ].entries()) {
    let state = createGame(0xa530 + index);
    state.activeTribes = ["pirate"];
    let player = humanPlayer(state);
    const source = scenario.golden
      ? goldenMinion("BG33_823", `rogers-capacity-${index}`)
      : definitionMinion("BG33_823", `rogers-capacity-${index}`);
    player.board = [source];
    player.hand = Array.from(
      { length: scenario.handSize },
      (_, fillerIndex) =>
        definitionMinion(
          "BG35_801",
          `rogers-capacity-${index}-${fillerIndex}`,
        ),
    );
    const poolBefore = structuredClone(state.spellPool);

    state = upgradeForCost(state, 5, 9);
    player = humanPlayer(state);
    const rewards = tavernSpellsInHand(player).filter((spell) =>
      BOUNTY_DEFINITION_IDS.has(spell.definitionId),
    );
    assert.equal(rewards.length, scenario.expectedRewards);
    assert.equal(player.hand.length, 10);
    assert.deepEqual(state.spellPool, poolBefore);
    assert.match(
      boardMinion(player, source.instanceId).description,
      /还剩9枚/,
    );
  }
});

test("a full hand discards Rogers' reward instead of banking it", () => {
  let state = createGame(0xa532);
  state.activeTribes = ["pirate"];
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG33_823",
    "full-hand-rogers",
  );
  player.board = [source];
  player.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion("BG35_801", `full-hand-rogers-${index}`),
  );

  state = upgradeForCost(state, 5, 9);
  player = humanPlayer(state);
  player.hand.pop();
  player.gold = 9;
  for (let count = 0; count < 9; count += 1) {
    state = gameReducer(state, { type: "REFRESH_SHOP" });
  }
  player = humanPlayer(state);
  const rewards = tavernSpellsInHand(player).filter((spell) =>
    BOUNTY_DEFINITION_IDS.has(spell.definitionId),
  );
  assert.equal(rewards.length, 1);
  assert.equal(player.hand.length, 10);
});

test("Admiral Rogers can generate every one of the five Bounties", () => {
  const seen = new Set<string>();
  for (let seed = 0xa540; seed < 0xa640 && seen.size < 5; seed += 1) {
    let state = createGame(seed);
    state.activeTribes = ["pirate"];
    let player = humanPlayer(state);
    player.board = [
      definitionMinion("BG33_823", `all-bounties-rogers-${seed}`),
    ];
    player.hand = [];
    state = upgradeForCost(state, 5, 9);
    player = humanPlayer(state);
    const reward = tavernSpellsInHand(player).find((spell) =>
      BOUNTY_DEFINITION_IDS.has(spell.definitionId),
    );
    assert.ok(reward);
    seen.add(reward.definitionId);
  }
  assert.deepEqual(seen, BOUNTY_DEFINITION_IDS);
});

test("AI Gold spending triggers Rogers through the shared Recruit engine", () => {
  let state = createGame(0xa550);
  state.activeTribes = ["pirate"];
  state.round = 10;
  const ai = isolateAiLobby(state, "player-5");
  const source = definitionMinion(
    "BG33_823",
    "ai-admiral-rogers",
  );
  ai.tavernTier = 5;
  ai.upgradeDiscount = 3;
  ai.gold = 9;
  ai.armor = 0;
  ai.board = [
    source,
    ...Array.from({ length: 5 }, (_, index) =>
      definitionMinion("BG26_135", `ai-rogers-board-${index}`, {
        attack: 30,
        health: 30,
      }),
    ),
  ];
  ai.hand = [];
  ai.shop = [];
  ai.spellShop = null;
  ai.additionalSpellShop = [];

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = playerById(state, ai.id);
  assert.equal(nextAi.tavernTier, 6);
  assert.equal(nextAi.goldSpentThisTurn, 9);
  assert.ok(
    nextAi.lastTavernSpellDefinitionId === null ||
      BOUNTY_DEFINITION_IDS.has(
        nextAi.lastTavernSpellDefinitionId,
      ),
  );
  assert.equal(
    nextAi.lastTavernSpellDefinitionId !== null ||
      tavernSpellsInHand(nextAi).some((spell) =>
        BOUNTY_DEFINITION_IDS.has(spell.definitionId),
      ),
    true,
  );
});

test("Balladist includes its purchase and resolves one target for Golden plus Brann repetitions", () => {
  for (const [index, scenario] of [
    { golden: false, brann: false, repetitions: 1 },
    { golden: true, brann: true, repetitions: 4 },
  ].entries()) {
    let state = createGame(0xa560 + index);
    let player = humanPlayer(state);
    const target = definitionMinion(
      "BG26_135",
      `balladist-target-${index}`,
    );
    const outsider = definitionMinion(
      "BG35_801",
      `balladist-outsider-${index}`,
    );
    const source = scenario.golden
      ? goldenMinion("BG26_814", `balladist-source-${index}`)
      : definitionMinion("BG26_814", `balladist-source-${index}`);
    const targetBefore = stats(target);
    player.board = [
      target,
      outsider,
      ...(scenario.brann
        ? [definitionMinion("BG_LOE_077", `balladist-brann-${index}`)]
        : []),
    ];
    player.hand = [];
    player.shop = [source];
    player.gold = 3;

    state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
    assert.equal(humanPlayer(state).goldSpentThisTurn, 3);
    state = playHandCard(state, source.instanceId);
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "target");
    assert.deepEqual(
      [...pending.optionInstanceIds].sort(),
      [source.instanceId, target.instanceId].sort(),
    );
    assert.equal(pending.repetitions, scenario.repetitions);
    assert.equal(pending.health, 4);

    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: target.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(state.pendingInteraction, null);
    assertStatDelta(
      boardMinion(player, target.instanceId),
      targetBefore,
      0,
      4 * scenario.repetitions,
    );
  }
});

test("after-card-play triggers wait for an interactive Balladist Battlecry to complete", () => {
  let state = createGame(0xa562);
  let player = humanPlayer(state);
  const greymane = definitionMinion(
    "BG29_841",
    "pending-balladist-greymane",
  );
  const target = definitionMinion(
    "BG26_135",
    "pending-balladist-target",
  );
  const source = definitionMinion(
    "BG26_814",
    "pending-balladist-source",
  );
  const greymaneBefore = stats(greymane);
  const sourceBefore = stats(source);
  const targetBefore = stats(target);
  player.board = [greymane, target];
  player.hand = [source];

  state = playHandCard(state, source.instanceId);
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "target");
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, greymane.instanceId),
    greymaneBefore,
    0,
    0,
  );
  assertStatDelta(
    boardMinion(player, source.instanceId),
    sourceBefore,
    0,
    0,
  );
  assert.notEqual(player.pendingCardPlayed, null);

  const unresolved = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: greymane.instanceId,
  });
  assert.equal(unresolved.pendingInteraction?.kind, "target");
  assertStatDelta(
    boardMinion(humanPlayer(unresolved), greymane.instanceId),
    greymaneBefore,
    0,
    0,
  );

  pending = unresolved.pendingInteraction;
  assert.ok(pending?.kind === "target");
  state = gameReducer(unresolved, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.pendingCardPlayed, null);
  assertStatDelta(
    boardMinion(player, greymane.instanceId),
    greymaneBefore,
    2,
    2,
  );
  assertStatDelta(
    boardMinion(player, source.instanceId),
    sourceBefore,
    2,
    2,
  );
  assertStatDelta(
    boardMinion(player, target.instanceId),
    targetBefore,
    0,
    1,
  );
});

test("Moon-Bacon, Greymane, and Paintfin filter both minions and Tavern Spells and scale when Golden", () => {
  const scenarios = [
    {
      definitionId: "BG29_840",
      matchingTier: 1 as const,
      wrongSpellId: "tavern-spell-hasty-excavation",
      matchingSpellId: "tavern-spell-tavern-coin",
      attack: 1,
      health: 1,
      targetIsMurloc: false,
      playedIsBuffTarget: true,
    },
    {
      definitionId: "BG29_841",
      matchingTier: 2 as const,
      wrongSpellId: "tavern-spell-tavern-coin",
      matchingSpellId: "tavern-spell-hasty-excavation",
      attack: 2,
      health: 2,
      targetIsMurloc: false,
      playedIsBuffTarget: true,
    },
    {
      definitionId: "BG33_893",
      matchingTier: 3 as const,
      wrongSpellId: "tavern-spell-ride-the-wind",
      matchingSpellId: "tavern-spell-careful-investment",
      attack: 2,
      health: 2,
      targetIsMurloc: true,
      playedIsBuffTarget: false,
    },
  ] as const;

  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    for (const [goldenIndex, golden] of [false, true].entries()) {
      let state = createGame(
        0xa570 + scenarioIndex * 2 + goldenIndex,
      );
      let player = humanPlayer(state);
      const source = golden
        ? goldenMinion(
            scenario.definitionId,
            `tier-source-${scenarioIndex}-${goldenIndex}`,
          )
        : definitionMinion(
            scenario.definitionId,
            `tier-source-${scenarioIndex}-${goldenIndex}`,
          );
      const target = definitionMinion(
        "BG35_801",
        `tier-target-${scenarioIndex}-${goldenIndex}`,
        {
          tier: scenario.matchingTier,
          ...(scenario.targetIsMurloc
            ? {
                tribe: "murloc" as const,
                tribes: ["murloc" as const],
              }
            : {}),
        },
      );
      const outsider = definitionMinion(
        "BG35_814",
        `tier-outsider-${scenarioIndex}-${goldenIndex}`,
        {
          tier:
            scenario.matchingTier === 1
              ? 2
              : scenario.matchingTier === 2
                ? 1
                : 4,
        },
      );
      const played = definitionMinion(
        "BG28_300",
        `tier-played-${scenarioIndex}-${goldenIndex}`,
        { tier: scenario.matchingTier },
      );
      const sourceBefore = stats(source);
      const targetBefore = stats(target);
      const outsiderBefore = stats(outsider);
      const playedBefore = stats(played);
      player.board = [source, target, outsider];
      player.hand = [
        played,
        tavernSpell(
          scenario.matchingSpellId,
          `tier-matching-spell-${scenarioIndex}-${goldenIndex}`,
        ),
        tavernSpell(
          scenario.wrongSpellId,
          `tier-wrong-spell-${scenarioIndex}-${goldenIndex}`,
        ),
      ];

      state = playHandCard(state, played.instanceId);
      player = humanPlayer(state);
      const scale = golden ? 2 : 1;
      const attack = scenario.attack * scale;
      const health = scenario.health * scale;
      assertStatDelta(
        boardMinion(player, source.instanceId),
        sourceBefore,
        attack,
        health,
      );
      assertStatDelta(
        boardMinion(player, target.instanceId),
        targetBefore,
        attack,
        health,
      );
      assertStatDelta(
        boardMinion(player, outsider.instanceId),
        outsiderBefore,
        0,
        0,
      );
      assertStatDelta(
        boardMinion(player, played.instanceId),
        playedBefore,
        scenario.playedIsBuffTarget ? attack : 0,
        scenario.playedIsBuffTarget ? health : 0,
      );

      const sourceAfterMinion = stats(
        boardMinion(player, source.instanceId),
      );
      const targetAfterMinion = stats(
        boardMinion(player, target.instanceId),
      );
      const matchingSpell = player.hand.find(
        (card): card is TavernSpellInstance =>
          card.kind === "tavernSpell" &&
          card.instanceId ===
            `tier-matching-spell-${scenarioIndex}-${goldenIndex}`,
      );
      assert.ok(matchingSpell);
      state = gameReducer(state, {
        type: "CAST_TAVERN_SPELL",
        cardInstanceId: matchingSpell.instanceId,
      });
      player = humanPlayer(state);
      assertStatDelta(
        boardMinion(player, source.instanceId),
        sourceAfterMinion,
        attack,
        health,
      );
      assertStatDelta(
        boardMinion(player, target.instanceId),
        targetAfterMinion,
        attack,
        health,
      );

      const sourceAfterMatchingSpell = stats(
        boardMinion(player, source.instanceId),
      );
      const targetAfterMatchingSpell = stats(
        boardMinion(player, target.instanceId),
      );
      const wrongSpell = player.hand.find(
        (card): card is TavernSpellInstance =>
          card.kind === "tavernSpell" &&
          card.instanceId ===
            `tier-wrong-spell-${scenarioIndex}-${goldenIndex}`,
      );
      assert.ok(wrongSpell);
      state = gameReducer(state, {
        type: "CAST_TAVERN_SPELL",
        cardInstanceId: wrongSpell.instanceId,
      });
      player = humanPlayer(state);
      assertStatDelta(
        boardMinion(player, source.instanceId),
        sourceAfterMatchingSpell,
        0,
        0,
      );
      assertStatDelta(
        boardMinion(player, target.instanceId),
        targetAfterMatchingSpell,
        0,
        0,
      );
    }
  }
});

test("Blood Gems, Spellcraft, consolation Coins, and Triple Rewards have no Tavern Tier", () => {
  const actions = [
    {
      label: "blood-gem",
      prepare(player: PlayerState, target: BoardMinionInstance): void {
        player.hand = [bloodGem("tierless-blood-gem")];
        void target;
      },
      play(state: GameState, target: BoardMinionInstance): GameState {
        return gameReducer(state, {
          type: "CAST_BLOOD_GEM",
          cardInstanceId: "tierless-blood-gem",
          targetInstanceId: target.instanceId,
        });
      },
    },
    {
      label: "spellcraft",
      prepare(player: PlayerState): void {
        player.hand = [
          spellcraft(
            "spellcraft-glowing-crown",
            "tierless-spellcraft",
          ),
        ];
      },
      play(state: GameState, target: BoardMinionInstance): GameState {
        return gameReducer(state, {
          type: "CAST_SPELLCRAFT",
          cardInstanceId: "tierless-spellcraft",
          targetInstanceId: target.instanceId,
        });
      },
    },
    {
      label: "coin",
      prepare(player: PlayerState): void {
        player.hand = [consolationCoin("tierless-coin")];
      },
      play(state: GameState): GameState {
        return playHandCard(state, "tierless-coin");
      },
    },
    {
      label: "triple-reward",
      prepare(player: PlayerState): void {
        player.hand = [tripleReward("tierless-triple-reward")];
      },
      play(state: GameState): GameState {
        return playHandCard(state, "tierless-triple-reward");
      },
    },
  ] as const;

  for (const [index, action] of actions.entries()) {
    let state = createGame(0xa580 + index);
    let player = humanPlayer(state);
    const odd = definitionMinion(
      "BG29_840",
      `tierless-odd-${action.label}`,
    );
    const even = definitionMinion(
      "BG29_841",
      `tierless-even-${action.label}`,
    );
    const painter = definitionMinion(
      "BG33_893",
      `tierless-painter-${action.label}`,
    );
    const target = definitionMinion(
      "BG35_801",
      `tierless-target-${action.label}`,
    );
    const before = new Map(
      [odd, even, painter].map((minion) => [
        minion.instanceId,
        stats(minion),
      ]),
    );
    player.board = [odd, even, painter, target];
    action.prepare(player, target);

    state = action.play(state, target);
    if (action.label === "triple-reward") {
      const pending = state.pendingInteraction;
      assert.ok(pending?.kind === "discover");
      const option = pending.options[0];
      assert.ok(option);
      state = gameReducer(state, {
        type: "RESOLVE_INTERACTION",
        interactionId: pending.interactionId,
        optionInstanceId: option.instanceId,
      });
    }
    player = humanPlayer(state);
    for (const watcher of [odd, even, painter]) {
      const watcherBefore = before.get(watcher.instanceId);
      assert.ok(watcherBefore);
      assertStatDelta(
        boardMinion(player, watcher.instanceId),
        watcherBefore,
        0,
        0,
      );
    }
    assert.equal(player.goldSpentThisTurn, 0);
  }
});

test("a newly played watcher does not trigger itself but can be buffed by an older watcher", () => {
  let state = createGame(0xa584);
  let player = humanPlayer(state);
  const oddTarget = definitionMinion(
    "BG35_801",
    "new-watcher-odd-target",
    { tier: 3 },
  );
  const first = definitionMinion(
    "BG29_840",
    "new-watcher-first",
  );
  const targetBefore = stats(oddTarget);
  const firstBefore = stats(first);
  player.board = [oddTarget];
  player.hand = [first];

  state = playHandCard(state, first.instanceId);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, oddTarget.instanceId),
    targetBefore,
    0,
    0,
  );
  assertStatDelta(
    boardMinion(player, first.instanceId),
    firstBefore,
    0,
    0,
  );

  const second = definitionMinion(
    "BG29_840",
    "new-watcher-second",
  );
  const targetBeforeSecond = stats(
    boardMinion(player, oddTarget.instanceId),
  );
  const firstBeforeSecond = stats(
    boardMinion(player, first.instanceId),
  );
  const secondBefore = stats(second);
  player.hand.push(second);
  state = playHandCard(state, second.instanceId);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, oddTarget.instanceId),
    targetBeforeSecond,
    1,
    1,
  );
  assertStatDelta(
    boardMinion(player, first.instanceId),
    firstBeforeSecond,
    1,
    1,
  );
  assertStatDelta(
    boardMinion(player, second.instanceId),
    secondBefore,
    1,
    1,
  );
});

test("a Discover Tavern Spell broadcasts its Tier only after the Discover completes", () => {
  let state = createGame(0xa585);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG29_840",
    "discover-spell-moon-bacon",
  );
  const target = definitionMinion(
    "BG35_801",
    "discover-spell-odd-target",
    { tier: 3 },
  );
  const sourceBefore = stats(source);
  const targetBefore = stats(target);
  const spell = tavernSpell(
    "tavern-spell-new-sprout",
    "discover-tier-one-spell",
  );
  player.board = [source, target];
  player.hand = [spell];
  player.tavernTier = 2;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
  });
  let pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, source.instanceId),
    sourceBefore,
    0,
    0,
  );
  assertStatDelta(
    boardMinion(player, target.instanceId),
    targetBefore,
    0,
    0,
  );
  assert.notEqual(player.pendingCardPlayed, null);

  const invalid = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "not-a-discover-option",
  });
  assert.equal(invalid.pendingInteraction?.kind, "discover");
  assertStatDelta(
    boardMinion(humanPlayer(invalid), source.instanceId),
    sourceBefore,
    0,
    0,
  );

  pending = invalid.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  const option = pending.options[0];
  assert.ok(option);
  state = gameReducer(invalid, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: option.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.pendingCardPlayed, null);
  assertStatDelta(
    boardMinion(player, source.instanceId),
    sourceBefore,
    1,
    1,
  );
  assertStatDelta(
    boardMinion(player, target.instanceId),
    targetBefore,
    1,
    1,
  );
});

test("Murloc War-Cutter grows in hand for a dual-type Murloc and doubles when Golden", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xa590 + index);
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BG26_137", `war-cutter-${index}`)
      : definitionMinion("BG26_137", `war-cutter-${index}`);
    const played = definitionMinion(
      "BG31_815",
      `war-cutter-dual-${index}`,
      {
        tribe: "murloc",
        tribes: ["murloc", "elemental"],
      },
    );
    const sourceBefore = stats(source);
    player.board = [];
    player.hand = [source, played];

    state = playHandCard(state, played.instanceId);
    player = humanPlayer(state);
    const amount = golden ? 12 : 6;
    assertStatDelta(
      handMinion(player, source.instanceId),
      sourceBefore,
      amount,
      amount,
    );
  }
});

test("a newly played Murloc War-Cutter cannot trigger from the board or hand", () => {
  let state = createGame(0xa592);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG26_137",
    "played-war-cutter",
  );
  const before = stats(source);
  player.board = [];
  player.hand = [source];

  state = playHandCard(state, source.instanceId);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, source.instanceId),
    before,
    0,
    0,
  );
});

test("Murloc Mugger selects one board minion and one minion card in hand", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xa5a0 + index);
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BG30_122", `mugger-source-${index}`)
      : definitionMinion("BG30_122", `mugger-source-${index}`);
    const handTarget = definitionMinion(
      "BG35_801",
      `mugger-hand-target-${index}`,
    );
    const played = definitionMinion(
      "BG31_815",
      `mugger-dual-played-${index}`,
      {
        tribe: "murloc",
        tribes: ["murloc", "elemental"],
      },
    );
    const spell = tavernSpell(
      "tavern-spell-tavern-coin",
      `mugger-spell-${index}`,
    );
    const sourceBefore = stats(source);
    const handBefore = stats(handTarget);
    const playedBefore = stats(played);
    player.board = [source];
    player.hand = [handTarget, spell, played];

    state = playHandCard(state, played.instanceId);
    player = humanPlayer(state);
    const amount = golden ? 10 : 5;
    const boardDeltas = [
      [
        boardMinion(player, source.instanceId),
        sourceBefore,
      ] as const,
      [
        boardMinion(player, played.instanceId),
        playedBefore,
      ] as const,
    ].map(
      ([minion, before]) => ({
        attack: minion.attack - before.attack,
        health: minion.health - before.health,
      }),
    );
    assert.equal(
      boardDeltas.filter(
        (delta) =>
          delta.attack === amount && delta.health === amount,
      ).length,
      1,
    );
    assert.equal(
      boardDeltas.filter(
        (delta) => delta.attack === 0 && delta.health === 0,
      ).length,
      1,
    );
    assertStatDelta(
      handMinion(player, handTarget.instanceId),
      handBefore,
      amount,
      amount,
    );
    assert.equal(
      player.hand.some(
        (card) =>
          card.kind === "tavernSpell" &&
          card.instanceId === spell.instanceId,
      ),
      true,
    );
  }
});

test("Wild Mana Surge buffs every Elemental once per ordinary or Golden pulse", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xa5b0 + index);
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BG32_846", `mana-surge-source-${index}`)
      : definitionMinion("BG32_846", `mana-surge-source-${index}`);
    const elemental = definitionMinion(
      "BG31_815",
      `mana-surge-target-${index}`,
    );
    const outsider = definitionMinion(
      "BG35_801",
      `mana-surge-outsider-${index}`,
    );
    const played = definitionMinion(
      "BG31_815",
      `mana-surge-dual-${index}`,
      {
        tribe: "murloc",
        tribes: ["murloc", "elemental"],
      },
    );
    const sourceBefore = stats(source);
    const elementalBefore = stats(elemental);
    const outsiderBefore = stats(outsider);
    const playedBefore = stats(played);
    player.board = [source, elemental, outsider];
    player.hand = [played];

    state = playHandCard(state, played.instanceId);
    player = humanPlayer(state);
    const amount = golden ? 8 : 4;
    for (const [minion, before] of [
      [boardMinion(player, source.instanceId), sourceBefore],
      [boardMinion(player, elemental.instanceId), elementalBefore],
      [boardMinion(player, played.instanceId), playedBefore],
    ] as const) {
      assertStatDelta(minion, before, amount, amount);
    }
    assertStatDelta(
      boardMinion(player, outsider.instanceId),
      outsiderBefore,
      0,
      0,
    );
  }
});

test("a newly played Wild Mana Surge does not trigger itself", () => {
  let state = createGame(0xa5b2);
  let player = humanPlayer(state);
  const target = definitionMinion(
    "BG31_815",
    "new-mana-surge-target",
  );
  const source = definitionMinion(
    "BG32_846",
    "new-mana-surge-source",
  );
  const targetBefore = stats(target);
  const sourceBefore = stats(source);
  player.board = [target];
  player.hand = [source];

  state = playHandCard(state, source.instanceId);
  player = humanPlayer(state);
  assertStatDelta(
    boardMinion(player, target.instanceId),
    targetBefore,
    0,
    0,
  );
  assertStatDelta(
    boardMinion(player, source.instanceId),
    sourceBefore,
    0,
    0,
  );
});

test("Nomi buffs current, frozen, and future Tavern Elementals without changing pool ownership", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0xa5c0 + index);
    state.activeTribes = ["elemental"];
    keepOnlyOneOpponent(state);
    clearMinionPool(state);
    state.pool.BG31_815 = 12;
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion("BGS_104", `nomi-source-${index}`)
      : definitionMinion("BGS_104", `nomi-source-${index}`);
    const played = definitionMinion(
      "BGS_119",
      `nomi-played-elemental-${index}`,
    );
    const currentOffer = definitionMinion(
      "BG31_815",
      `nomi-current-offer-${index}`,
      { poolCopies: 1 },
    );
    const outsider = definitionMinion(
      "BG35_801",
      `nomi-current-outsider-${index}`,
    );
    const offerBefore = stats(currentOffer);
    const outsiderBefore = stats(outsider);
    player.tavernTier = 1;
    player.board = [source];
    player.hand = [played];
    player.shop = [currentOffer, outsider];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.frozen = true;
    const poolBefore = totalPoolCopies(state, "BG31_815");

    state = playHandCard(state, played.instanceId);
    player = humanPlayer(state);
    const amount = golden ? 8 : 4;
    assertStatDelta(
      player.shop.find(
        (offer) => offer.instanceId === currentOffer.instanceId,
      ) ?? currentOffer,
      offerBefore,
      amount,
      amount,
    );
    assertStatDelta(
      player.shop.find(
        (offer) => offer.instanceId === outsider.instanceId,
      ) ?? outsider,
      outsiderBefore,
      0,
      0,
    );
    assert.equal(totalPoolCopies(state, "BG31_815"), poolBefore);

    state = gameReducer(state, { type: "END_TURN" });
    state = continueAfterCombat(state);
    player = humanPlayer(state);
    const frozenOffer = player.shop.find(
      (offer) => offer.instanceId === currentOffer.instanceId,
    );
    assert.ok(frozenOffer);
    assertStatDelta(
      frozenOffer,
      offerBefore,
      amount,
      amount,
    );
    assert.equal(totalPoolCopies(state, "BG31_815"), poolBefore);

    player.freeRefreshes = 1;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);
    assert.equal(player.freeRefreshes, 0);
    assert.ok(player.shop.length > 0);
    assert.ok(
      player.shop.every(
        (offer) => offer.definitionId === "BG31_815",
      ),
    );
    const base = getMinionDefinition("BG31_815");
    for (const offer of player.shop) {
      assertStats(
        offer,
        base.attack + amount,
        base.health + amount,
      );
      assert.equal(offer.poolCopies, 1);
    }
    assert.equal(totalPoolCopies(state, "BG31_815"), poolBefore);
  }
});

test("AI card play triggers Wild Mana Surge through the shared event pipeline", () => {
  let state = createGame(0xa5c2);
  state.activeTribes = ["elemental", "murloc"];
  const ai = isolateAiLobby(state, "player-3");
  const source = definitionMinion(
    "BG32_846",
    "ai-mana-surge",
  );
  const target = definitionMinion(
    "BG31_815",
    "ai-mana-target",
  );
  const played = definitionMinion(
    "BG31_815",
    "ai-mana-dual-played",
    {
      tribe: "murloc",
      tribes: ["murloc", "elemental"],
    },
  );
  const sourceBefore = stats(source);
  const targetBefore = stats(target);
  const playedBefore = stats(played);
  ai.gold = 0;
  ai.board = [source, target];
  ai.hand = [played];
  ai.shop = [];
  ai.spellShop = null;
  ai.additionalSpellShop = [];

  state = gameReducer(state, { type: "END_TURN" });
  const nextAi = playerById(state, ai.id);
  assertStatDelta(
    boardMinion(nextAi, source.instanceId),
    sourceBefore,
    4,
    4,
  );
  assertStatDelta(
    boardMinion(nextAi, target.instanceId),
    targetBefore,
    4,
    4,
  );
  assertStatDelta(
    boardMinion(nextAi, played.instanceId),
    playedBefore,
    4,
    4,
  );
});

test("v22 saves migrate Recruit-event defaults without losing threshold progress or core state", () => {
  let state = createGame(0xa5d0);
  let player = humanPlayer(state);
  const source = definitionMinion(
    "BG26_810",
    "saved-progress-courier",
  );
  const pirate = definitionMinion(
    "BG26_135",
    "saved-progress-pirate",
  );
  const pirateBefore = stats(pirate);
  player.board = [source, pirate];
  player.hand = [];
  state = upgradeForCost(state, 1, 5);
  player = humanPlayer(state);
  const savedCounters =
    boardMinion(player, source.instanceId).effectCounters;
  assert.ok(savedCounters);
  const countersBefore = structuredClone(savedCounters);
  assert.ok(Object.keys(countersBefore).length > 0);
  assert.match(
    boardMinion(player, source.instanceId).description,
    /还剩1枚/,
  );
  player.nextTavernSpellDiscount = 3;
  player.tavernSpellsCastThisTurn = 4;
  player.bloodGemAttack = 2;
  player.tavernTypeBuffs = [
    { tribes: ["elemental"], attack: 4, health: 4 },
  ];
  state.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V22;
  for (const legacyPlayer of state.players) {
    const record = legacyPlayer as unknown as Record<string, unknown>;
    delete record.goldSpentThisTurn;
    delete record.pendingCardPlayed;
  }

  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  for (const migratedPlayer of migrated.players) {
    assert.equal(migratedPlayer.goldSpentThisTurn, 0);
    assert.equal(migratedPlayer.pendingCardPlayed, null);
  }
  let migratedHuman = humanPlayer(migrated);
  assert.equal(migratedHuman.nextTavernSpellDiscount, 3);
  assert.equal(migratedHuman.tavernSpellsCastThisTurn, 4);
  assert.equal(migratedHuman.bloodGemAttack, 2);
  assert.deepEqual(migratedHuman.tavernTypeBuffs, [
    { tribes: ["elemental"], attack: 4, health: 4 },
  ]);
  assert.deepEqual(
    boardMinion(migratedHuman, source.instanceId).effectCounters,
    countersBefore,
  );
  assert.match(
    boardMinion(migratedHuman, source.instanceId).description,
    /还剩1枚/,
  );

  migratedHuman.gold = 1;
  const triggered = gameReducer(migrated, { type: "REFRESH_SHOP" });
  migratedHuman = humanPlayer(triggered);
  assert.equal(migratedHuman.goldSpentThisTurn, 1);
  assertStatDelta(
    boardMinion(migratedHuman, pirate.instanceId),
    pirateBefore,
    2,
    0,
  );
  assert.match(
    boardMinion(migratedHuman, source.instanceId).description,
    /还剩6枚/,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(triggered)), triggered);
});
