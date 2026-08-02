import assert from "node:assert/strict";
import test from "node:test";

import { createGame, createLobbyGame } from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_10_CONTENT_VERSION,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V39,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V40,
  normalizePersistedGameState,
} from "../lib/game/save.ts";
import type { GameState } from "../lib/game/types.ts";

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("v39 saves disable lobby systems without replacing hero powers", () => {
  const legacy = createGame(0x40aa);
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V39;
  legacy.lobbySystemsEnabled = true;
  legacy.systemEventId = "system-event-golden-arrow";

  const human = legacy.players[0];
  assert.ok(human);
  human.heroPowerId = "hero-power-see-the-future";
  human.heroId = "hero-nozdormu";
  human.trinketIds = [
    "lesser-trinket-goldenizer-supply",
    "greater-trinket-calming-candle",
  ];
  human.trinketCounters = {
    "lesser-trinket-goldenizer-supply": 2,
  };
  human.pendingSystemSpellIds = ["system-spell-goldenizer"];
  human.freeTavernSpellPurchases = 2;

  const normalized = normalizePersistedGameState(
    jsonClone(legacy),
  ) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.lobbySystemsEnabled, false);
  assert.equal(normalized.systemEventId, null);
  assert.equal(normalized.players[0]?.heroPowerId, human.heroPowerId);
  assert.ok(
    normalized.players.every(
      (player) =>
        player.heroId === null &&
        Object.keys(player.heroPowerCounters).length === 0 &&
        player.trinketIds.length === 0 &&
        Object.keys(player.trinketCounters).length === 0 &&
        player.pendingSystemSpellIds.length === 0 &&
        player.freeTavernSpellPurchases === 0,
    ),
  );
});

test("v39 lobby saves remove stale choices and generated system spells", () => {
  let legacy: GameState | null = null;
  for (let seed = 1; seed <= 256; seed += 1) {
    const candidate = createLobbyGame(seed);
    if (candidate.systemEventId === "system-event-perfected-alchemy") {
      legacy = candidate;
      break;
    }
  }
  assert.ok(legacy);
  assert.equal(legacy.pendingInteraction?.kind, "heroChoice");
  assert.ok(
    legacy.players.every((player) =>
      player.hand.some(
        (card) => card.definitionId === "system-spell-goldenizer",
      ),
    ),
  );
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V39;

  const normalized = normalizePersistedGameState(
    jsonClone(legacy),
  ) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.lobbySystemsEnabled, false);
  assert.equal(normalized.pendingInteraction, null);
  assert.ok(
    normalized.players.every((player) =>
      player.hand.every(
        (card) =>
          card.definitionId !== "system-spell-goldenizer" &&
          card.definitionId !== "system-spell-golden-arrow",
      ),
    ),
  );
  assert.ok(
    normalized.players.every(
      (player) =>
        player.heroPowerCounters !== null &&
        typeof player.heroPowerCounters === "object" &&
        Object.values(player.heroPowerCounters).every(
          (count) => Number.isInteger(count) && count >= 0,
        ),
    ),
  );
});

test("v40 lobby saves retain their hero choice, event, and system cards", () => {
  let legacy: GameState | null = null;
  for (let seed = 1; seed <= 256; seed += 1) {
    const candidate = createLobbyGame(seed);
    if (candidate.systemEventId === "system-event-perfected-alchemy") {
      legacy = candidate;
      break;
    }
  }
  assert.ok(legacy);
  const eventId = legacy.systemEventId;
  const interaction = legacy.pendingInteraction;
  assert.ok(interaction?.kind === "heroChoice");
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V40;
  for (const player of legacy.players) {
    delete (player as Partial<GameState["players"][number]>)
      .heroRefreshAvailable;
    delete (player as Partial<GameState["players"][number]>)
      .heroPowerCounters;
  }

  const normalized = normalizePersistedGameState(
    jsonClone(legacy),
  ) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.lobbySystemsEnabled, true);
  assert.equal(normalized.systemEventId, eventId);
  assert.deepEqual(normalized.pendingInteraction, interaction);
  assert.ok(
    normalized.players.every((player) =>
      player.hand.some(
        (card) => card.definitionId === "system-spell-goldenizer",
      ),
    ),
  );
  assert.ok(
    normalized.players.every(
      (player) => typeof player.heroRefreshAvailable === "boolean",
    ),
  );
  assert.ok(
    normalized.players.every(
      (player) =>
        player.heroPowerCounters !== null &&
        typeof player.heroPowerCounters === "object" &&
        Object.values(player.heroPowerCounters).every(
          (count) => Number.isInteger(count) && count >= 0,
        ),
    ),
  );
});

test("current hero-choice saves retain exactly four valid candidates", () => {
  const current = createLobbyGame(0x40b0);
  const offer = current.pendingInteraction;
  assert.ok(offer?.kind === "heroChoice");
  assert.equal(offer.optionIds.length, 4);
  assert.equal(new Set(offer.optionIds).size, 4);

  const normalized = normalizePersistedGameState(
    jsonClone(current),
  ) as GameState | null;
  assert.ok(normalized);
  const restoredOffer = normalized.pendingInteraction;
  assert.ok(restoredOffer?.kind === "heroChoice");
  assert.deepEqual(restoredOffer.optionIds, offer.optionIds);

  const [first, second, third] = offer.optionIds;
  assert.ok(first && second && third);
  const invalidOffers = [
    {
      name: "three candidates",
      optionIds: [first, second, third],
    },
    {
      name: "duplicate candidate",
      optionIds: [first, first, second, third],
    },
    {
      name: "unknown candidate",
      optionIds: [first, second, third, "hero-unknown"],
    },
  ];
  for (const { name, optionIds } of invalidOffers) {
    const invalid = jsonClone(current);
    const pending = invalid.pendingInteraction;
    assert.ok(pending?.kind === "heroChoice");
    pending.optionIds = optionIds;
    assert.equal(normalizePersistedGameState(invalid), null, name);
  }
});

test("current Trinket-choice saves preserve exactly four valid candidates", () => {
  const current = createGame(0x40b1);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-golden-arrow";
  current.round = 6;
  const human = current.players[0];
  assert.ok(human);
  const optionIds = [
    "lesser-trinket-oilcan",
    "lesser-trinket-goblin-wallet",
    "lesser-trinket-bg30-magicitem-416",
    "lesser-trinket-goldenizer-supply",
  ];
  current.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "saved-lesser-choice",
    playerId: human.id,
    sourceInstanceId: "turn-6-lesser-trinket-offer",
    trinketTier: "lesser",
    optionIds,
  };

  const normalized = normalizePersistedGameState(
    jsonClone(current),
  ) as GameState | null;

  assert.ok(normalized);
  const restoredOffer = normalized.pendingInteraction;
  assert.ok(restoredOffer?.kind === "trinketChoice");
  assert.deepEqual(restoredOffer.optionIds, optionIds);
  assert.equal(restoredOffer.interactionId, "saved-lesser-choice");
});

test("current Trinket-choice saves reject malformed candidate sets", () => {
  const current = createGame(0x40b2);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-golden-arrow";
  current.round = 6;
  const human = current.players[0];
  assert.ok(human);
  const [first, second, third, fourth] = [
    "lesser-trinket-oilcan",
    "lesser-trinket-goblin-wallet",
    "lesser-trinket-bg30-magicitem-416",
    "lesser-trinket-goldenizer-supply",
  ];
  current.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "invalid-lesser-choice",
    playerId: human.id,
    sourceInstanceId: "turn-6-lesser-trinket-offer",
    trinketTier: "lesser",
    optionIds: [first, second, third, fourth],
  };

  const invalidOffers = [
    {
      name: "three candidates",
      optionIds: [first, second, third],
    },
    {
      name: "duplicate candidate",
      optionIds: [first, first, second, third],
    },
    {
      name: "unknown candidate",
      optionIds: [first, second, third, "lesser-trinket-unknown"],
    },
    {
      name: "candidate from the other tier",
      optionIds: [
        first,
        second,
        third,
        "greater-trinket-bobs-tip-jar",
      ],
    },
    {
      name: "retired candidate",
      optionIds: [
        first,
        second,
        third,
        "lesser-trinket-kodo-leather-pouch",
      ],
    },
    {
      name: "Hero Power-use candidate without an active Hero Power",
      optionIds: [
        first,
        second,
        third,
        "lesser-trinket-bg35-magicitem-801",
      ],
    },
    {
      name: "typed candidate without a matching board minion",
      optionIds: [
        first,
        second,
        third,
        "lesser-trinket-bg30-magicitem-301",
      ],
    },
  ];
  for (const { name, optionIds: invalidOptionIds } of invalidOffers) {
    const invalid = jsonClone(current);
    const pending = invalid.pendingInteraction;
    assert.ok(pending?.kind === "trinketChoice");
    pending.optionIds = invalidOptionIds;
    assert.equal(normalizePersistedGameState(invalid), null, name);
  }
});

test("current saves clear an already-owned Trinket choice without losing progress", () => {
  const current = createGame(0x40ac);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-golden-arrow";
  current.round = 6;
  const human = current.players[0];
  assert.ok(human);
  human.heroId = "hero-nozdormu";
  human.heroPowerId = "hero-power-see-the-future";
  human.trinketIds = ["lesser-trinket-oilcan"];
  human.trinketCounters = { "lesser-trinket-oilcan": 0 };
  current.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: "stale-lesser-choice",
    playerId: human.id,
    sourceInstanceId: "lobby-trinket-offer-lesser",
    trinketTier: "lesser",
    optionIds: [
      "lesser-trinket-oilcan",
      "lesser-trinket-goblin-wallet",
      "lesser-trinket-bg30-magicitem-416",
      "lesser-trinket-goldenizer-supply",
    ],
  };

  const normalized = normalizePersistedGameState(
    jsonClone(current),
  ) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.pendingInteraction, null);
  assert.deepEqual(normalized.players[0]?.trinketIds, [
    "lesser-trinket-oilcan",
  ]);
});

test("current saves recover Nozdormu's in-turn Refresh marker", () => {
  const current = createGame(0x40ad);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-money-match";
  const human = current.players[0];
  assert.ok(human);
  human.heroId = "hero-nozdormu";
  human.heroPowerId = "hero-power-see-the-future";
  delete (human as Partial<GameState["players"][number]>).heroRefreshAvailable;

  const normalized = normalizePersistedGameState(
    jsonClone(current),
  ) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.players[0]?.heroRefreshAvailable, true);
  assert.equal(normalized.players[0]?.freeRefreshes, 0);
});

test("current saves preserve Hero Power counters through JSON", () => {
  const current = createGame(0x40ae);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-money-match";
  const human = current.players[0];
  assert.ok(human);
  human.heroId = "hero-trade-prince-gallywix";
  human.heroPowerId = "hero-power-smart-savings";
  human.heroPowerCounters = { smartSavingsGold: 7 };

  const normalized = normalizePersistedGameState(
    JSON.parse(JSON.stringify(current)) as unknown,
  ) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.players[0]?.heroId, human.heroId);
  assert.equal(normalized.players[0]?.heroPowerId, human.heroPowerId);
  assert.deepEqual(normalized.players[0]?.heroPowerCounters, {
    smartSavingsGold: 7,
  });
});

test("current saves repair missing Rakanishu Hero Power counters", () => {
  const current = createGame(0x40af);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-golden-arrow";
  const human = current.players[0];
  assert.ok(human);
  human.heroId = "hero-rakanishu";
  human.heroPowerId = "hero-power-light-the-tavern";
  delete (human as Partial<GameState["players"][number]>)
    .heroPowerCounters;

  const normalized = normalizePersistedGameState(
    jsonClone(current),
  ) as GameState | null;

  assert.ok(normalized);
  assert.deepEqual(normalized.players[0]?.heroPowerCounters, {
    rakanishuTurns: 4,
    rakanishuBonus: 1,
  });
});

test("schema 10 and earlier migration chains gain legacy lobby defaults", () => {
  const legacy = jsonClone(createGame(0x40ab)) as unknown as Record<
    string,
    unknown
  >;
  legacy.version = 10;
  legacy.contentVersion = LEGACY_SCHEMA_10_CONTENT_VERSION;
  legacy.lobbySystemsEnabled = true;
  legacy.systemEventId = "system-event-golden-arrow";

  const players = legacy.players as Array<Record<string, unknown>>;
  players[0]!.heroPowerId = "hero-power-see-the-future";
  players[0]!.heroId = "hero-nozdormu";
  players[0]!.trinketIds = ["lesser-trinket-oilcan"];
  players[0]!.trinketCounters = { "lesser-trinket-oilcan": 1 };
  players[0]!.pendingSystemSpellIds = ["system-spell-goldenizer"];
  players[0]!.freeTavernSpellPurchases = 1;

  const normalized = normalizePersistedGameState(legacy) as GameState | null;

  assert.ok(normalized);
  assert.equal(normalized.lobbySystemsEnabled, false);
  assert.equal(normalized.systemEventId, null);
  assert.equal(
    normalized.players[0]?.heroPowerId,
    "hero-power-see-the-future",
  );
  assert.ok(
    normalized.players.every(
      (player) =>
        player.heroId === null &&
        Object.keys(player.heroPowerCounters).length === 0 &&
        player.trinketIds.length === 0 &&
        Object.keys(player.trinketCounters).length === 0 &&
        player.pendingSystemSpellIds.length === 0 &&
        player.freeTavernSpellPurchases === 0,
    ),
  );
});

test("current saves accept valid lobby state and reject unsafe values", () => {
  const current = createGame(0x40bb);
  current.lobbySystemsEnabled = true;
  current.systemEventId = "system-event-golden-arrow";
  const human = current.players[0];
  assert.ok(human);
  human.heroId = "hero-nozdormu";
  human.heroPowerId = "hero-power-see-the-future";
  human.heroPowerCounters = {};
  human.trinketIds = [
    "lesser-trinket-goldenizer-supply",
    "greater-trinket-calming-candle",
  ];
  human.trinketCounters = {
    "lesser-trinket-goldenizer-supply": 1,
    "greater-trinket-calming-candle": 0,
  };
  human.pendingSystemSpellIds = [
    "system-spell-goldenizer",
    "system-spell-golden-arrow",
  ];
  human.freeTavernSpellPurchases = 2;

  assert.equal(normalizePersistedGameState(current), current);

  const invalidCases: Array<{
    name: string;
    mutate: (state: GameState) => void;
  }> = [
    {
      name: "unknown event",
      mutate: (state) => {
        state.systemEventId = "unknown-event";
      },
    },
    {
      name: "unknown hero",
      mutate: (state) => {
        state.players[0]!.heroId = "unknown-hero";
      },
    },
    {
      name: "unknown Hero Power counter key",
      mutate: (state) => {
        const player = state.players[0]!;
        player.heroId = "hero-trade-prince-gallywix";
        player.heroPowerId = "hero-power-smart-savings";
        player.heroPowerCounters = { unknownCounter: 1 };
      },
    },
    {
      name: "negative Hero Power counter",
      mutate: (state) => {
        const player = state.players[0]!;
        player.heroId = "hero-trade-prince-gallywix";
        player.heroPowerId = "hero-power-smart-savings";
        player.heroPowerCounters = { smartSavingsGold: -1 };
      },
    },
    {
      name: "counter from a different Hero Power",
      mutate: (state) => {
        const player = state.players[0]!;
        player.heroId = "hero-trade-prince-gallywix";
        player.heroPowerId = "hero-power-smart-savings";
        player.heroPowerCounters = { chenvaalaElementals: 1 };
      },
    },
    {
      name: "two Lesser Trinkets",
      mutate: (state) => {
        state.players[0]!.trinketIds = [
          "lesser-trinket-oilcan",
          "lesser-trinket-goblin-wallet",
        ];
      },
    },
    {
      name: "counter for an unowned Trinket",
      mutate: (state) => {
        state.players[0]!.trinketCounters = {
          "lesser-trinket-oilcan": 1,
        };
      },
    },
    {
      name: "unknown queued system spell",
      mutate: (state) => {
        state.players[0]!.pendingSystemSpellIds = ["unknown-spell"];
      },
    },
    {
      name: "negative free purchase count",
      mutate: (state) => {
        state.players[0]!.freeTavernSpellPurchases = -1;
      },
    },
  ];

  for (const { name, mutate } of invalidCases) {
    const invalid = jsonClone(current);
    mutate(invalid);
    assert.equal(normalizePersistedGameState(invalid), null, name);
  }
});
