import assert from "node:assert/strict";
import test from "node:test";

import {
  areTrinketOfferCandidatesValid,
  countTrinketOfferBoardTribes,
  createTrinketOfferWeightContext,
  getEligibleTrinketOfferCandidates,
  getMostCommonTrinketOfferTribes,
  getTrinketCandidateMatchCount,
  getTrinketOfferCandidateWeight,
  isNeutralTrinketOfferCandidate,
  pickWeightedTrinketOfferCandidate,
  selectTrinketOffers,
  type TrinketOfferBoardUnit,
  type TrinketOfferCandidate,
  type TrinketOfferTier,
} from "../lib/game/trinket-offers.ts";
import { ACTIVE_TRINKET_DEFINITIONS } from "../lib/game/lobby-systems.ts";
import type { Tribe } from "../lib/game/types.ts";

function boardUnit(tribe: Tribe, tribes: readonly Tribe[] = [tribe]) {
  return { tribe, tribes } satisfies TrinketOfferBoardUnit;
}

function candidate(
  id: string,
  associatedTribes: readonly Tribe[] = [],
  cost = 3,
  tier: TrinketOfferTier = "lesser",
) {
  return {
    id,
    tier,
    cost,
    associatedTribes,
  } satisfies TrinketOfferCandidate;
}

function sequenceRandom(values: readonly number[]): () => number {
  assert.ok(values.length > 0);
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    assert.notEqual(value, undefined);
    return value;
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

test("tribe counts include dual-type and All units only for active tribes", () => {
  const counts = countTrinketOfferBoardTribes(
    [
      boardUnit("beast"),
      boardUnit("beast", ["beast", "mech"]),
      boardUnit("all", ["all"]),
      boardUnit("murloc"),
    ],
    ["beast", "mech", "dragon"],
  );

  assert.equal(counts.murloc, undefined);
  assert.deepEqual(counts, {
    beast: 3,
    mech: 2,
    dragon: 1,
  });
});

test("tribal candidates with zero board share are hard-filtered", () => {
  const context = createTrinketOfferWeightContext(
    [boardUnit("beast")],
    ["beast", "mech", "murloc"],
  );
  const candidates = [
    candidate("neutral"),
    candidate("beast", ["beast"]),
    candidate("mech", ["mech"]),
    candidate("dual-present", ["beast", "murloc"]),
    candidate("greater-neutral", [], 3, "greater"),
  ];

  assert.deepEqual(
    getEligibleTrinketOfferCandidates(
      candidates,
      "lesser",
      context,
    ).map((entry) => entry.id),
    ["neutral", "beast", "dual-present"],
  );
});

test("tribal weight rises strictly with board share and dual-type uses its highest match", () => {
  const beast = candidate("beast", ["beast"]);
  const dual = candidate("dual", ["beast", "murloc"]);
  const neutral = candidate("neutral");
  const lowShareContext = {
    activeTribes: ["beast", "murloc"] as const,
    boardSize: 4,
    tribeCounts: { beast: 1, murloc: 3 },
  };
  const highShareContext = {
    activeTribes: ["beast", "murloc"] as const,
    boardSize: 4,
    tribeCounts: { beast: 2, murloc: 3 },
  };

  assert.equal(getTrinketOfferCandidateWeight(neutral, lowShareContext), 1);
  assert.equal(getTrinketOfferCandidateWeight(beast, lowShareContext), 2);
  assert.equal(getTrinketCandidateMatchCount(dual, lowShareContext), 3);
  assert.equal(getTrinketOfferCandidateWeight(dual, lowShareContext), 4);
  assert.ok(
    getTrinketOfferCandidateWeight(beast, highShareContext) >
      getTrinketOfferCandidateWeight(beast, lowShareContext),
  );
});

test("four-option selection is unique, tier-correct, and satisfies available guarantees", () => {
  const candidates = [
    candidate("neutral-a", [], 4),
    candidate("neutral-b", [], 5),
    candidate("beast-a", ["beast"], 4),
    candidate("beast-b", ["beast"], 5),
    candidate("mech-low", ["mech"], 2),
    candidate("mech-a", ["mech"], 4),
    candidate("dual-a", ["beast", "mech"], 3),
    candidate("wrong-tier", [], 1, "greater"),
  ];
  const board = [
    boardUnit("beast"),
    boardUnit("beast"),
    boardUnit("beast"),
    boardUnit("mech"),
  ];

  const offers = selectTrinketOffers({
    tier: "lesser",
    candidates,
    board,
    activeTribes: ["beast", "mech", "murloc"],
    random: sequenceRandom([0.72, 0.18, 0.91, 0.34]),
  });

  assert.equal(offers.length, 4);
  assert.equal(new Set(offers.map((entry) => entry.id)).size, 4);
  assert.ok(offers.every((entry) => entry.tier === "lesser"));
  assert.ok(offers.some(isNeutralTrinketOfferCandidate));
  assert.ok(
    offers.some((entry) => entry.associatedTribes.includes("beast")),
  );
  assert.ok(offers.some((entry) => entry.cost <= 2));

  const context = createTrinketOfferWeightContext(board, [
    "beast",
    "mech",
    "murloc",
  ]);
  assert.deepEqual(getMostCommonTrinketOfferTribes(context), ["beast"]);
});

test("the same candidate order and random sequence reproduce the same offer", () => {
  const candidates = [
    candidate("neutral-a", [], 2),
    candidate("neutral-b"),
    candidate("beast-a", ["beast"]),
    candidate("beast-b", ["beast"]),
    candidate("mech-a", ["mech"]),
    candidate("mech-b", ["mech"]),
  ];
  const input = {
    tier: "lesser" as const,
    candidates,
    board: [boardUnit("beast"), boardUnit("mech")],
    activeTribes: ["beast", "mech"] as const,
  };
  const randomValues = [0.83, 0.11, 0.62, 0.37, 0.95];

  const first = selectTrinketOffers({
    ...input,
    random: sequenceRandom(randomValues),
  });
  const second = selectTrinketOffers({
    ...input,
    random: sequenceRandom(randomValues),
  });

  assert.deepEqual(
    first.map((entry) => entry.id),
    second.map((entry) => entry.id),
  );
});

test("weighted draws make a tribal candidate more frequent as its board share grows", () => {
  const beast = candidate("beast", ["beast"]);
  const neutral = candidate("neutral");
  const candidates = [beast, neutral];
  const lowShareContext = {
    activeTribes: ["beast"] as const,
    boardSize: 7,
    tribeCounts: { beast: 1 },
  };
  const highShareContext = {
    activeTribes: ["beast"] as const,
    boardSize: 7,
    tribeCounts: { beast: 5 },
  };
  const lowRandom = seededRandom(0x5eed);
  const highRandom = seededRandom(0x5eed);
  let lowShareBeastDraws = 0;
  let highShareBeastDraws = 0;

  for (let draw = 0; draw < 10_000; draw += 1) {
    if (
      pickWeightedTrinketOfferCandidate(
        candidates,
        lowShareContext,
        lowRandom,
      ).id === "beast"
    ) {
      lowShareBeastDraws += 1;
    }
    if (
      pickWeightedTrinketOfferCandidate(
        candidates,
        highShareContext,
        highRandom,
      ).id === "beast"
    ) {
      highShareBeastDraws += 1;
    }
  }

  assert.ok(
    highShareBeastDraws > lowShareBeastDraws + 1_000,
    `expected higher-share draws (${highShareBeastDraws}) to exceed lower-share draws (${lowShareBeastDraws}) by more than 1000`,
  );
});

test("selection reports a clear error when tribe filtering leaves fewer than four", () => {
  assert.throws(
    () =>
      selectTrinketOffers({
        tier: "lesser",
        candidates: [
          candidate("neutral-a"),
          candidate("neutral-b"),
          candidate("beast", ["beast"]),
          candidate("missing-mech", ["mech"]),
        ],
        board: [boardUnit("beast")],
        activeTribes: ["beast", "mech"],
        random: () => 0.5,
      }),
    /Cannot offer 4 distinct lesser trinkets: only 3 eligible candidates/,
  );
});

test("saved offers must remain active and eligible for the current board", () => {
  const board = [boardUnit("beast")];
  const base = [
    candidate("neutral-a"),
    candidate("neutral-b"),
    candidate("neutral-c"),
    candidate("beast", ["beast"]),
  ];
  const input = {
    tier: "lesser" as const,
    board,
    activeTribes: ["beast", "mech"] as const,
  };

  assert.equal(
    areTrinketOfferCandidatesValid({ ...input, candidates: base }),
    true,
  );
  assert.equal(
    areTrinketOfferCandidatesValid({
      ...input,
      candidates: [
        ...base.slice(0, 3),
        { ...candidate("retired"), inPool: false },
      ],
    }),
    false,
  );
  assert.equal(
    areTrinketOfferCandidatesValid({
      ...input,
      candidates: [
        ...base.slice(0, 3),
        candidate("missing-mech", ["mech"]),
      ],
    }),
    false,
  );
});

test("the complete live pool can always produce four legal offers for empty and single-tribe boards", () => {
  const activeTribes = [
    "beast",
    "demon",
    "dragon",
    "elemental",
    "mech",
    "murloc",
    "naga",
    "pirate",
    "quilboar",
    "undead",
  ] as const;
  const boards: readonly (readonly TrinketOfferBoardUnit[])[] = [
    [],
    ...activeTribes.map((tribe) => [boardUnit(tribe)]),
  ];

  for (const tier of ["lesser", "greater"] as const) {
    for (const board of boards) {
      const offers = selectTrinketOffers({
        tier,
        candidates: ACTIVE_TRINKET_DEFINITIONS,
        board,
        activeTribes,
        random: seededRandom(0x36_00_03 + board.length),
      });
      const context = createTrinketOfferWeightContext(board, activeTribes);

      assert.equal(offers.length, 4, `${tier} / ${board[0]?.tribe ?? "empty"}`);
      assert.equal(new Set(offers.map((offer) => offer.id)).size, 4);
      for (const offer of offers) {
        assert.ok(
          isNeutralTrinketOfferCandidate(offer) ||
            getTrinketCandidateMatchCount(offer, context) > 0,
          `${offer.cardId} must not be offered without a matching board tribe`,
        );
      }
    }
  }
});
