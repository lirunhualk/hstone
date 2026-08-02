import type { Tribe } from "./types.ts";

export type TrinketOfferTier = "lesser" | "greater";

export type TrinketOfferTribe = Exclude<Tribe, "all" | "neutral">;

export interface TrinketOfferCandidate {
  readonly id: string;
  readonly tier: TrinketOfferTier;
  readonly cost: number;
  readonly associatedTribes: readonly Tribe[];
  readonly inPool?: boolean;
}

export interface TrinketOfferBoardUnit {
  readonly tribe: Tribe;
  readonly tribes: readonly Tribe[];
}

export type TrinketTribeCounts = Readonly<
  Partial<Record<TrinketOfferTribe, number>>
>;

export interface TrinketOfferWeightContext {
  readonly activeTribes: readonly TrinketOfferTribe[];
  readonly boardSize: number;
  readonly tribeCounts: TrinketTribeCounts;
}

export interface SelectTrinketOffersInput<
  Candidate extends TrinketOfferCandidate,
> {
  readonly tier: TrinketOfferTier;
  readonly candidates: readonly Candidate[];
  readonly board: readonly TrinketOfferBoardUnit[];
  readonly activeTribes: readonly Tribe[];
  readonly random: () => number;
  readonly count?: number;
}

const TRIBAL_WEIGHT_MULTIPLIER = 4;

function isOfferTribe(tribe: Tribe): tribe is TrinketOfferTribe {
  return tribe !== "all" && tribe !== "neutral";
}

export function getActiveTrinketOfferTribes(
  activeTribes: readonly Tribe[],
): TrinketOfferTribe[] {
  const seen = new Set<TrinketOfferTribe>();
  const result: TrinketOfferTribe[] = [];
  for (const tribe of activeTribes) {
    if (!isOfferTribe(tribe) || seen.has(tribe)) {
      continue;
    }
    seen.add(tribe);
    result.push(tribe);
  }
  return result;
}

export function trinketOfferUnitHasTribe(
  unit: TrinketOfferBoardUnit,
  tribe: TrinketOfferTribe,
): boolean {
  return (
    unit.tribe === "all" ||
    unit.tribes.includes("all") ||
    unit.tribe === tribe ||
    unit.tribes.includes(tribe)
  );
}

export function countTrinketOfferBoardTribes(
  board: readonly TrinketOfferBoardUnit[],
  activeTribes: readonly Tribe[],
): TrinketTribeCounts {
  const offerTribes = getActiveTrinketOfferTribes(activeTribes);
  const counts: Partial<Record<TrinketOfferTribe, number>> = {};
  for (const tribe of offerTribes) {
    counts[tribe] = 0;
  }
  for (const unit of board) {
    for (const tribe of offerTribes) {
      if (trinketOfferUnitHasTribe(unit, tribe)) {
        counts[tribe] = (counts[tribe] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export function createTrinketOfferWeightContext(
  board: readonly TrinketOfferBoardUnit[],
  activeTribes: readonly Tribe[],
): TrinketOfferWeightContext {
  const normalizedActiveTribes = getActiveTrinketOfferTribes(activeTribes);
  return {
    activeTribes: normalizedActiveTribes,
    boardSize: board.length,
    tribeCounts: countTrinketOfferBoardTribes(
      board,
      normalizedActiveTribes,
    ),
  };
}

export function isNeutralTrinketOfferCandidate(
  candidate: TrinketOfferCandidate,
): boolean {
  return candidate.associatedTribes.every((tribe) => tribe === "neutral");
}

export function getTrinketCandidateAssociatedActiveTribes(
  candidate: TrinketOfferCandidate,
  activeTribes: readonly Tribe[],
): TrinketOfferTribe[] {
  const normalizedActiveTribes = getActiveTrinketOfferTribes(activeTribes);
  const activeSet = new Set<TrinketOfferTribe>(normalizedActiveTribes);
  const result = new Set<TrinketOfferTribe>();
  for (const tribe of candidate.associatedTribes) {
    if (tribe === "all") {
      for (const activeTribe of normalizedActiveTribes) {
        result.add(activeTribe);
      }
    } else if (isOfferTribe(tribe) && activeSet.has(tribe)) {
      result.add(tribe);
    }
  }
  return [...result];
}

function normalizedTribeCount(
  tribeCounts: TrinketTribeCounts,
  tribe: TrinketOfferTribe,
): number {
  const value = tribeCounts[tribe] ?? 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function getTrinketCandidateMatchCount(
  candidate: TrinketOfferCandidate,
  context: TrinketOfferWeightContext,
): number {
  let highestMatchCount = 0;
  for (const tribe of getTrinketCandidateAssociatedActiveTribes(
    candidate,
    context.activeTribes,
  )) {
    highestMatchCount = Math.max(
      highestMatchCount,
      normalizedTribeCount(context.tribeCounts, tribe),
    );
  }
  return highestMatchCount;
}

export function isTrinketOfferCandidateEligible(
  candidate: TrinketOfferCandidate,
  tier: TrinketOfferTier,
  context: TrinketOfferWeightContext,
): boolean {
  if (candidate.tier !== tier) {
    return false;
  }
  return (
    isNeutralTrinketOfferCandidate(candidate) ||
    getTrinketCandidateMatchCount(candidate, context) > 0
  );
}

export function getEligibleTrinketOfferCandidates<
  Candidate extends TrinketOfferCandidate,
>(
  candidates: readonly Candidate[],
  tier: TrinketOfferTier,
  context: TrinketOfferWeightContext,
): Candidate[] {
  const seenIds = new Set<string>();
  const eligible: Candidate[] = [];
  for (const candidate of candidates) {
    if (
      seenIds.has(candidate.id) ||
      !isTrinketOfferCandidateEligible(candidate, tier, context)
    ) {
      continue;
    }
    seenIds.add(candidate.id);
    eligible.push(candidate);
  }
  return eligible;
}

export function areTrinketOfferCandidatesValid<
  Candidate extends TrinketOfferCandidate,
>({
  tier,
  candidates,
  board,
  activeTribes,
  count = 4,
}: Omit<SelectTrinketOffersInput<Candidate>, "random">): boolean {
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    candidates.length !== count ||
    new Set(candidates.map((candidate) => candidate.id)).size !==
      candidates.length ||
    candidates.some((candidate) => candidate.inPool === false)
  ) {
    return false;
  }
  const context = createTrinketOfferWeightContext(board, activeTribes);
  return candidates.every((candidate) =>
    isTrinketOfferCandidateEligible(candidate, tier, context),
  );
}

export function getMostCommonTrinketOfferTribes(
  context: TrinketOfferWeightContext,
): TrinketOfferTribe[] {
  let highestCount = 0;
  const result: TrinketOfferTribe[] = [];
  for (const tribe of context.activeTribes) {
    const count = normalizedTribeCount(context.tribeCounts, tribe);
    if (count > highestCount) {
      highestCount = count;
      result.length = 0;
      result.push(tribe);
    } else if (count > 0 && count === highestCount) {
      result.push(tribe);
    }
  }
  return result;
}

export function getTrinketOfferCandidateWeight(
  candidate: TrinketOfferCandidate,
  context: TrinketOfferWeightContext,
): number {
  if (!Number.isInteger(context.boardSize) || context.boardSize < 0) {
    throw new RangeError("Trinket offer boardSize must be a non-negative integer.");
  }
  if (isNeutralTrinketOfferCandidate(candidate) || context.boardSize === 0) {
    return 1;
  }
  const matchingShare =
    getTrinketCandidateMatchCount(candidate, context) / context.boardSize;
  return 1 + TRIBAL_WEIGHT_MULTIPLIER * matchingShare;
}

function nextRandomUnit(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      `Trinket offer random() must return a finite value in [0, 1); received ${value}.`,
    );
  }
  return value;
}

export function pickWeightedTrinketOfferCandidate<
  Candidate extends TrinketOfferCandidate,
>(
  candidates: readonly Candidate[],
  context: TrinketOfferWeightContext,
  random: () => number,
): Candidate {
  if (candidates.length === 0) {
    throw new Error("Cannot draw a weighted trinket from an empty candidate list.");
  }
  const weights = candidates.map((candidate) =>
    getTrinketOfferCandidateWeight(candidate, context),
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = nextRandomUnit(random) * totalWeight;
  for (let index = 0; index < candidates.length; index += 1) {
    threshold -= weights[index] ?? 0;
    if (threshold < 0) {
      return candidates[index] as Candidate;
    }
  }
  return candidates[candidates.length - 1] as Candidate;
}

function candidateMatchesAnyTribe(
  candidate: TrinketOfferCandidate,
  tribes: ReadonlySet<TrinketOfferTribe>,
  activeTribes: readonly TrinketOfferTribe[],
): boolean {
  return getTrinketCandidateAssociatedActiveTribes(
    candidate,
    activeTribes,
  ).some((tribe) => tribes.has(tribe));
}

export function selectTrinketOffers<
  Candidate extends TrinketOfferCandidate,
>({
  tier,
  candidates,
  board,
  activeTribes,
  random,
  count = 4,
}: SelectTrinketOffersInput<Candidate>): Candidate[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Trinket offer count must be a non-negative integer.");
  }
  if (count === 0) {
    return [];
  }

  const context = createTrinketOfferWeightContext(board, activeTribes);
  const eligible = getEligibleTrinketOfferCandidates(
    candidates,
    tier,
    context,
  );
  if (eligible.length < count) {
    throw new Error(
      `Cannot offer ${count} distinct ${tier} trinkets: only ${eligible.length} eligible candidates remain after tribe filtering.`,
    );
  }

  const selected: Candidate[] = [];
  const selectedIds = new Set<string>();
  const ensureGuarantee = (
    label: string,
    guaranteeCandidates: readonly Candidate[],
  ): void => {
    if (
      guaranteeCandidates.length === 0 ||
      guaranteeCandidates.some((candidate) => selectedIds.has(candidate.id))
    ) {
      return;
    }
    if (selected.length >= count) {
      throw new Error(
        `Cannot satisfy the ${label} trinket guarantee with an offer count of ${count}.`,
      );
    }
    const remaining = guaranteeCandidates.filter(
      (candidate) => !selectedIds.has(candidate.id),
    );
    const choice = pickWeightedTrinketOfferCandidate(
      remaining,
      context,
      random,
    );
    selected.push(choice);
    selectedIds.add(choice.id);
  };

  ensureGuarantee(
    "neutral",
    eligible.filter(isNeutralTrinketOfferCandidate),
  );

  const mostCommonTribes = new Set(getMostCommonTrinketOfferTribes(context));
  ensureGuarantee(
    "most-common-tribe",
    mostCommonTribes.size === 0
      ? []
      : eligible.filter((candidate) =>
          candidateMatchesAnyTribe(
            candidate,
            mostCommonTribes,
            context.activeTribes,
          ),
        ),
  );

  ensureGuarantee(
    "low-cost",
    eligible.filter((candidate) => candidate.cost <= 2),
  );

  while (selected.length < count) {
    const remaining = eligible.filter(
      (candidate) => !selectedIds.has(candidate.id),
    );
    const choice = pickWeightedTrinketOfferCandidate(
      remaining,
      context,
      random,
    );
    selected.push(choice);
    selectedIds.add(choice.id);
  }

  // Guarantees determine membership, not a predictable card position.
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandomUnit(random) * (index + 1));
    [selected[index], selected[swapIndex]] = [
      selected[swapIndex] as Candidate,
      selected[index] as Candidate,
    ];
  }

  return selected;
}
