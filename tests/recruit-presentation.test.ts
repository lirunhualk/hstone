import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getTavernSpellPurchaseQuote,
  type BoardMinionInstance,
  type ConsolationCoinSpellInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import { getTavernSpellDefinition } from "../lib/game/tavern-spells.ts";
import {
  completeRecruitPresentation,
  deriveRecruitPresentation,
  enqueueRecruitPresentation,
  groupRecruitPresentationEvents,
  recruitPresentationAnnouncement,
  recruitPresentationDuration,
} from "../lib/game/recruit-presentation.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function minionCopy(
  source: BoardMinionInstance,
  instanceId: string,
): BoardMinionInstance {
  return {
    ...structuredClone(source),
    instanceId,
    golden: false,
  };
}

function exhaustHumanShop(state: GameState): void {
  const player = humanPlayer(state);
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
}

function replaceSpellOffer(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  instanceId: string,
): void {
  const definition = getTavernSpellDefinition(definitionId);
  for (const offer of [
    ...(player.spellShop ? [player.spellShop] : []),
    ...player.additionalSpellShop,
  ]) {
    state.spellPool[offer.definitionId] =
      (state.spellPool[offer.definitionId] ?? 0) + 1;
  }
  player.additionalSpellShop = [];
  player.spellShop = {
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

test("rapid presentation batches remain FIFO and stale timers are harmless", () => {
  const buy = { token: 1, label: "buy" };
  const refresh = { token: 2, label: "refresh" };
  const sell = { token: 3, label: "sell" };
  let queue = enqueueRecruitPresentation([], buy);
  queue = enqueueRecruitPresentation(queue, refresh);
  queue = enqueueRecruitPresentation(queue, sell);

  assert.deepEqual(
    queue.map((entry) => entry.label),
    ["buy", "refresh", "sell"],
  );
  assert.equal(completeRecruitPresentation(queue, 99), queue);

  queue = completeRecruitPresentation(queue, buy.token);
  assert.deepEqual(
    queue.map((entry) => entry.label),
    ["refresh", "sell"],
  );
  queue = completeRecruitPresentation(queue, refresh.token);
  assert.deepEqual(queue, [sell]);
});

test("multiple triples become FIFO forge batches without repeating the leading action", () => {
  const state = createGame(0x7115);
  const template = humanPlayer(state).shop[0];
  const firstGolden = minionCopy(template, "first-forge");
  firstGolden.golden = true;
  firstGolden.grantsTripleReward = true;
  const secondGolden = minionCopy(template, "second-forge");
  secondGolden.golden = true;
  secondGolden.grantsTripleReward = true;

  const groups = groupRecruitPresentationEvents([
    {
      kind: "currency",
      currency: "gold",
      delta: -3,
      reason: "buy",
    },
    {
      kind: "triple",
      golden: firstGolden,
      knownConsumedInstanceIds: [],
    },
    {
      kind: "triple",
      golden: secondGolden,
      knownConsumedInstanceIds: [],
    },
  ]);

  assert.deepEqual(
    groups.map((group) => group.map((event) => event.kind)),
    [["currency", "triple"], ["triple"]],
  );
  assert.equal(groups[0]?.[1]?.kind, "triple");
  assert.equal(groups[1]?.[0]?.kind, "triple");
  if (groups[0]?.[1]?.kind === "triple") {
    assert.equal(groups[0][1].golden.instanceId, firstGolden.instanceId);
  }
  if (groups[1]?.[0]?.kind === "triple") {
    assert.equal(groups[1][0].golden.instanceId, secondGolden.instanceId);
  }
});

test("successful hand plays move the exact minion to its final board index", () => {
  const before = createGame(0x7114);
  const player = humanPlayer(before);
  const played = player.shop.shift();
  assert.ok(played);
  player.hand = [played];
  const action = {
    type: "PLAY_HAND_CARD",
    cardInstanceId: played.instanceId,
    boardIndex: 0,
  } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(events.map((event) => event.kind), ["cardMove"]);
  const move = events[0];
  assert.equal(move?.kind, "cardMove");
  if (move?.kind === "cardMove") {
    assert.equal(move.motion, "hand-to-board");
    assert.equal(move.card.instanceId, played.instanceId);
    assert.equal(move.boardIndex, 0);
  }
  assert.equal(humanPlayer(after).board[0]?.instanceId, played.instanceId);
  assert.equal(recruitPresentationAnnouncement(events), `打出${played.name}`);
  assert.equal(recruitPresentationDuration(events), 900);
});

test("legacy PLAY_MINION records the clamped final position", () => {
  const before = createGame(0x7115);
  const player = humanPlayer(before);
  const played = player.shop.shift();
  const existing = player.shop.shift();
  assert.ok(played);
  assert.ok(existing);
  player.board = [existing];
  player.hand = [played];
  const action = {
    type: "PLAY_MINION",
    handIndex: 0,
    boardIndex: 99,
  } as const;
  const after = gameReducer(before, action);
  const finalBoardIndex = humanPlayer(after).board.findIndex(
    (minion) => minion.instanceId === played.instanceId,
  );
  const events = deriveRecruitPresentation(before, after, action);
  const move = events.find((event) => event.kind === "cardMove");

  assert.ok(finalBoardIndex >= 0);
  assert.equal(move?.kind, "cardMove");
  if (move?.kind === "cardMove") {
    assert.equal(move.motion, "hand-to-board");
    assert.equal(move.boardIndex, finalBoardIndex);
    assert.notEqual(move.boardIndex, action.boardIndex);
  }
});

test("failed hand plays do not claim that a minion reached the board", () => {
  const before = createGame(0x7116);
  const player = humanPlayer(before);
  const played = player.shop.shift();
  assert.ok(played);
  player.board = Array.from({ length: 7 }, (_, index) =>
    minionCopy(played, `full-board-${index}`),
  );
  player.hand = [played];
  const action = {
    type: "PLAY_HAND_CARD",
    cardInstanceId: played.instanceId,
  } as const;
  const after = gameReducer(before, action);

  assert.deepEqual(
    deriveRecruitPresentation(before, after, action),
    [],
  );
  assert.equal(humanPlayer(after).hand[0]?.instanceId, played.instanceId);
});

test("accepted non-minion hand cards never receive hand-to-board motion", () => {
  const before = createGame(0x7117);
  const player = humanPlayer(before);
  const coin: ConsolationCoinSpellInstance = {
    kind: "consolationCoin",
    instanceId: "presentation-coin",
    definitionId: "consolation-coin",
    cardId: "BG28_521t",
    name: "补贴铸币",
    description: "获得1枚铸币。",
    spellFamily: "coin",
  };
  player.hand = [coin];
  player.gold = 0;
  const action = {
    type: "PLAY_HAND_CARD",
    cardInstanceId: coin.instanceId,
  } as const;
  const after = gameReducer(before, action);

  assert.equal(humanPlayer(after).gold, 1);
  assert.deepEqual(
    deriveRecruitPresentation(before, after, action),
    [],
  );
});

test("a hand play is presented before a triple forged by the same action", () => {
  const before = createGame(0x7118);
  const player = humanPlayer(before);
  const played = player.shop.shift();
  assert.ok(played);
  const tripleTemplate = player.shop.find(
    (candidate) => candidate.definitionId !== played.definitionId,
  );
  assert.ok(tripleTemplate);
  const firstId = "play-triple-board";
  const secondId = "play-triple-hand";
  player.board = [minionCopy(tripleTemplate, firstId)];
  player.hand = [played, minionCopy(tripleTemplate, secondId)];
  const action = {
    type: "PLAY_HAND_CARD",
    cardInstanceId: played.instanceId,
    boardIndex: 0,
  } as const;
  const after = gameReducer(before, action);
  const afterPlayer = humanPlayer(after);
  afterPlayer.board = afterPlayer.board.filter(
    (minion) => minion.instanceId !== firstId,
  );
  afterPlayer.hand = afterPlayer.hand.filter(
    (card) => card.instanceId !== secondId,
  );
  const golden = minionCopy(tripleTemplate, "play-triggered-golden");
  golden.golden = true;
  golden.grantsTripleReward = true;
  afterPlayer.hand.push(golden);

  const events = deriveRecruitPresentation(before, after, action);
  assert.deepEqual(
    events.map((event) => event.kind),
    ["cardMove", "triple"],
  );
  const move = events[0];
  assert.equal(move?.kind, "cardMove");
  if (move?.kind === "cardMove") {
    assert.equal(move.motion, "hand-to-board");
    assert.equal(move.card.instanceId, played.instanceId);
  }
  assert.ok(
    recruitPresentationAnnouncement(events).startsWith(
      `打出${played.name}，凑成三连，获得`,
    ),
  );
  assert.equal(recruitPresentationDuration(events), 590);
  assert.equal(recruitPresentationDuration(events, true), 120);
});

test("successful minion purchases present payment before the card move", () => {
  const before = createGame(0x7101);
  const offered = humanPlayer(before).shop[0];
  const after = gameReducer(before, {
    type: "BUY_MINION",
    shopIndex: 0,
  });

  const events = deriveRecruitPresentation(before, after, {
    type: "BUY_MINION",
    shopIndex: 0,
  });

  assert.deepEqual(
    events.map((event) => event.kind),
    ["currency", "cardMove"],
  );
  assert.deepEqual(events[0], {
    kind: "currency",
    currency: "gold",
    delta: -3,
    reason: "buy",
  });
  assert.equal(events[1]?.kind, "cardMove");
  if (events[1]?.kind === "cardMove") {
    assert.equal(events[1].motion, "shop-to-hand");
    assert.equal(events[1].card.instanceId, offered.instanceId);
  }
  assert.match(recruitPresentationAnnouncement(events), /购买.+消耗3枚金币/);
});

test("failed purchases produce no presentation", () => {
  const before = createGame(0x7102);
  humanPlayer(before).gold = 0;
  const action = { type: "BUY_MINION", shopIndex: 0 } as const;
  const after = gameReducer(before, action);

  assert.deepEqual(
    deriveRecruitPresentation(before, after, action),
    [],
  );
});

test("tavern spell purchases use their quoted currency and cost", () => {
  const before = createGame(0x7103);
  const player = humanPlayer(before);
  player.gold = 20;
  const offered = player.spellShop ?? player.additionalSpellShop[0];
  assert.ok(offered);
  const quote = getTavernSpellPurchaseQuote(
    before,
    player.id,
    offered.instanceId,
  );
  assert.ok(quote);
  if (quote.currency === "health") {
    player.health = Math.max(player.health, quote.cost + 1);
  }
  const action = {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: offered.instanceId,
  } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);
  const move = events.find((event) => event.kind === "cardMove");
  const currency = events.find((event) => event.kind === "currency");

  assert.equal(move?.kind, "cardMove");
  if (move?.kind === "cardMove") {
    assert.equal(move.motion, "shop-to-hand");
    assert.equal(move.card.instanceId, offered.instanceId);
    assert.equal(move.purchaseCost, quote.cost);
    assert.equal(move.purchaseCurrency, quote.currency);
  }
  if (quote.cost > 0) {
    assert.deepEqual(currency, {
      kind: "currency",
      currency: quote.currency,
      delta: -quote.cost,
      reason: "buy",
    });
  } else {
    assert.equal(currency, undefined);
  }
});

test("a fully discounted tavern spell still carries its zero display cost", () => {
  const before = createGame(0x7108);
  const player = humanPlayer(before);
  player.gold = 20;
  player.nextTavernSpellDiscount = 99;
  const offered = player.spellShop ?? player.additionalSpellShop[0];
  assert.ok(offered);
  const action = {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: offered.instanceId,
  } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);
  const move = events.find((event) => event.kind === "cardMove");

  assert.equal(
    events.some((event) => event.kind === "currency"),
    false,
  );
  assert.equal(move?.kind, "cardMove");
  if (move?.kind === "cardMove") {
    assert.equal(move.purchaseCost, 0);
    assert.equal(move.purchaseCurrency, "gold");
  }
});

test("Hasty Excavation presents its nonlethal Health payment", () => {
  const before = createGame(0x7114);
  const player = humanPlayer(before);
  player.health = 4;
  player.gold = 0;
  player.hand = [];
  replaceSpellOffer(
    before,
    player,
    "tavern-spell-hasty-excavation",
    "presentation-health-spell",
  );
  const action = {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "presentation-health-spell",
  } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["currency", "cardMove"],
  );
  assert.deepEqual(events[0], {
    kind: "currency",
    currency: "health",
    delta: -3,
    reason: "buy",
  });
  assert.equal(events[1]?.kind, "cardMove");
  if (events[1]?.kind === "cardMove") {
    assert.equal(events[1].purchaseCost, 3);
    assert.equal(events[1].purchaseCurrency, "health");
  }
  assert.match(
    recruitPresentationAnnouncement(events),
    /消耗3点生命/,
  );
});

test("a lethal Hasty Excavation attempt produces no presentation", () => {
  const before = createGame(0x7115);
  const player = humanPlayer(before);
  player.health = 3;
  player.gold = 10;
  player.hand = [];
  replaceSpellOffer(
    before,
    player,
    "tavern-spell-hasty-excavation",
    "presentation-lethal-health-spell",
  );
  const action = {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "presentation-lethal-health-spell",
  } as const;
  const after = gameReducer(before, action);

  assert.deepEqual(
    deriveRecruitPresentation(before, after, action),
    [],
  );
});

test("selling moves the minion to Bob before showing its real sell value", () => {
  const before = createGame(0x7104);
  const player = humanPlayer(before);
  const sold = player.shop.shift();
  assert.ok(sold);
  sold.sellValue = 3;
  player.board = [sold];
  player.gold = 0;
  const action = { type: "SELL_MINION", boardIndex: 0 } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["cardMove", "currency"],
  );
  assert.equal(events[0]?.kind, "cardMove");
  if (events[0]?.kind === "cardMove") {
    assert.equal(events[0].motion, "board-to-bob");
    assert.equal(events[0].card.instanceId, sold.instanceId);
  }
  assert.deepEqual(events[1], {
    kind: "currency",
    currency: "gold",
    delta: 3,
    reason: "sell",
  });
});

test("free refreshes sweep the shop without a false gold payment", () => {
  const before = createGame(0x7105);
  const player = humanPlayer(before);
  player.gold = 0;
  player.freeRefreshes = 1;
  const action = { type: "REFRESH_SHOP" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["shopRefresh"],
  );
  assert.equal(events[0]?.kind, "shopRefresh");
  if (events[0]?.kind === "shopRefresh") {
    assert.equal(events[0].free, true);
    assert.notDeepEqual(
      events[0].outgoingInstanceIds,
      events[0].incomingInstanceIds,
    );
  }
  assert.equal(
    recruitPresentationAnnouncement(events),
    "免费刷新酒馆",
  );
});

test("an empty paid refresh still presents its payment and sweep", () => {
  const before = createGame(0x7109);
  exhaustHumanShop(before);
  humanPlayer(before).gold = 1;
  const action = { type: "REFRESH_SHOP" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["currency", "shopRefresh"],
  );
  assert.deepEqual(events[0], {
    kind: "currency",
    currency: "gold",
    delta: -1,
    reason: "refresh",
  });
  assert.equal(events[1]?.kind, "shopRefresh");
  if (events[1]?.kind === "shopRefresh") {
    assert.deepEqual(events[1].outgoingInstanceIds, []);
    assert.deepEqual(events[1].incomingInstanceIds, []);
    assert.equal(events[1].free, false);
  }
});

test("an empty free refresh still presents a free sweep", () => {
  const before = createGame(0x7110);
  exhaustHumanShop(before);
  const player = humanPlayer(before);
  player.gold = 0;
  player.freeRefreshes = 1;
  const action = { type: "REFRESH_SHOP" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["shopRefresh"],
  );
  assert.equal(events[0]?.kind, "shopRefresh");
  if (events[0]?.kind === "shopRefresh") {
    assert.equal(events[0].free, true);
  }
});

test("upgrades present the paid cost before the new tavern tier", () => {
  const before = createGame(0x7106);
  humanPlayer(before).gold = 20;
  const action = { type: "UPGRADE_TAVERN" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["currency", "tavernUpgrade"],
  );
  assert.deepEqual(events[0], {
    kind: "currency",
    currency: "gold",
    delta: -5,
    reason: "upgrade",
  });
  assert.equal(events[1]?.kind, "tavernUpgrade");
  if (events[1]?.kind === "tavernUpgrade") {
    assert.equal(events[1].fromTier, 1);
    assert.equal(events[1].toTier, 2);
  }
});

test("upgrade discounts and the Bartender hero power use the quoted cost", () => {
  const before = createGame(0x7116);
  const player = humanPlayer(before);
  player.gold = 1;
  player.upgradeDiscount = 3;
  player.heroPowerId = "hero-power-experienced-bartender";
  const action = { type: "UPGRADE_TAVERN" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(events[0], {
    kind: "currency",
    currency: "gold",
    delta: -1,
    reason: "upgrade",
  });
  assert.equal(events[1]?.kind, "tavernUpgrade");
});

test("a fully discounted upgrade shows the tier change without false payment", () => {
  const before = createGame(0x7117);
  const player = humanPlayer(before);
  player.gold = 0;
  player.upgradeDiscount = 5;
  const action = { type: "UPGRADE_TAVERN" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["tavernUpgrade"],
  );
  assert.equal(events[0]?.kind, "tavernUpgrade");
  if (events[0]?.kind === "tavernUpgrade") {
    assert.equal(events[0].fromTier, 1);
    assert.equal(events[0].toTier, 2);
  }
});

test("upgrade gold rewards are presented after the new tier", () => {
  const before = createGame(0x7111);
  const player = humanPlayer(before);
  player.gold = 10;
  player.heroPowerId = "hero-power-ever-blooming";
  const action = { type: "UPGRADE_TAVERN" } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["currency", "tavernUpgrade", "currency"],
  );
  assert.deepEqual(
    events
      .filter((event) => event.kind === "currency")
      .map((event) => event.delta),
    [-5, 2],
  );
  assert.match(
    recruitPresentationAnnouncement(events),
    /消耗5枚金币，获得2枚金币/,
  );
  assert.equal(recruitPresentationDuration(events), 1260);
});

test("new golden tokens are not mislabeled as triples", () => {
  const before = createGame(0x7112);
  const after = structuredClone(before);
  const template = humanPlayer(before).shop[0];
  const goldenToken = minionCopy(template, "generated-golden-token");
  goldenToken.golden = true;
  goldenToken.grantsTripleReward = false;
  humanPlayer(after).board.push(goldenToken);

  const events = deriveRecruitPresentation(before, after, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "generated-golden-token",
  });
  assert.equal(
    events.some((event) => event.kind === "triple"),
    false,
  );
});

test("a forged golden still presents when its normal Triple Reward is replaced", () => {
  const before = createGame(0x7114);
  const beforePlayer = humanPlayer(before);
  const template = beforePlayer.shop[0];
  beforePlayer.board = [
    minionCopy(template, "replacement-triple-first"),
    minionCopy(template, "replacement-triple-second"),
  ];
  beforePlayer.hand = [];

  const after = structuredClone(before);
  const afterPlayer = humanPlayer(after);
  afterPlayer.board = [];
  const golden = minionCopy(template, "replacement-triple-golden");
  golden.golden = true;
  golden.grantsTripleReward = false;
  afterPlayer.hand = [golden];

  const events = deriveRecruitPresentation(before, after, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  const triple = events.find((event) => event.kind === "triple");
  assert.equal(triple?.kind, "triple");
  if (triple?.kind === "triple") {
    assert.equal(triple.golden.instanceId, golden.instanceId);
    assert.deepEqual(triple.knownConsumedInstanceIds, [
      "replacement-triple-first",
      "replacement-triple-second",
    ]);
  }
});

test("triple traces label only consumed copies visible across the transition", () => {
  const before = createGame(0x7113);
  const beforePlayer = humanPlayer(before);
  const sold = beforePlayer.shop[0];
  const tripleTemplate = beforePlayer.shop[1];
  beforePlayer.board = [
    sold,
    minionCopy(tripleTemplate, "known-triple-board"),
  ];
  beforePlayer.hand = [
    minionCopy(tripleTemplate, "known-triple-hand"),
  ];
  const after = structuredClone(before);
  const afterPlayer = humanPlayer(after);
  afterPlayer.board = [];
  afterPlayer.hand = [];
  const golden = minionCopy(tripleTemplate, "effect-forged-golden");
  golden.golden = true;
  golden.grantsTripleReward = true;
  afterPlayer.hand.push(golden);

  const events = deriveRecruitPresentation(before, after, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  const triple = events.find((event) => event.kind === "triple");
  assert.equal(triple?.kind, "triple");
  if (triple?.kind === "triple") {
    assert.deepEqual(triple.knownConsumedInstanceIds, [
      "known-triple-board",
      "known-triple-hand",
    ]);
  }
});

test("a purchased third copy presents payment, movement, then the triple", () => {
  const before = createGame(0x7107);
  const player = humanPlayer(before);
  const offered = player.shop[0];
  const firstId = "presentation-triple-board";
  const secondId = "presentation-triple-hand";
  player.board = [minionCopy(offered, firstId)];
  player.hand = [minionCopy(offered, secondId)];
  player.shop = [offered];
  player.gold = 3;
  const action = { type: "BUY_MINION", shopIndex: 0 } as const;
  const after = gameReducer(before, action);
  const events = deriveRecruitPresentation(before, after, action);

  assert.deepEqual(
    events.map((event) => event.kind),
    ["currency", "cardMove", "triple"],
  );
  const triple = events[2];
  assert.equal(triple?.kind, "triple");
  if (triple?.kind === "triple") {
    assert.equal(triple.golden.golden, true);
    assert.equal(triple.golden.definitionId, offered.definitionId);
    assert.deepEqual(new Set(triple.knownConsumedInstanceIds), new Set([
      firstId,
      secondId,
      offered.instanceId,
    ]));
  }
  assert.match(
    recruitPresentationAnnouncement(events),
    /凑成三连，获得金色/,
  );
  assert.equal(recruitPresentationDuration(events), 590);
  assert.equal(recruitPresentationDuration(events, true), 120);
});
