import {
  AI_STRATEGY_PROFILES,
  aiTargetBoardSize,
  shouldAiUpgrade,
  type AiStrategyProfile,
} from "./ai.ts";
import {
  type AiTrainingCardObservation,
  type AiTrainingMinionObservation,
  type AiTrainingObservation,
  type DeepReadonly,
} from "./ai-training.ts";
import { getMinionDefinition } from "./content.ts";
import {
  AiTrainingEnvironment,
  type AiTrainingLegalAction,
} from "./ai-training-environment.ts";
import { getTavernSpellDefinition } from "./tavern-spells.ts";

export const AI_RECRUIT_PLANNER_VERSION = 3 as const;

export type AiRecruitPlanTermination =
  | "endTurn"
  | "replanAfterAction"
  | "searchExhausted";

export interface AiRecruitPlanScoreBreakdown {
  boardPower: number;
  boardCoverage: number;
  handPotential: number;
  pairAndTripleValue: number;
  tribeCohesion: number;
  tavernTierValue: number;
  futureEconomy: number;
  frozenOpportunity: number;
  actionExpectedValue: number;
  unspentGoldPenalty: number;
  handCongestionPenalty: number;
  actionCountPenalty: number;
  total: number;
}

export interface AiRecruitPlan {
  plannerVersion: typeof AI_RECRUIT_PLANNER_VERSION;
  termination: AiRecruitPlanTermination;
  complete: boolean;
  actions: readonly Readonly<AiTrainingLegalAction>[];
  observation: DeepReadonly<AiTrainingObservation>;
  score: number;
  scoreDelta: number;
  breakdown: Readonly<AiRecruitPlanScoreBreakdown>;
}

export interface AiRecruitPlannerOptions {
  beamWidth?: number;
  maxActions?: number;
  profile?: AiStrategyProfile;
}

interface PlannerNode {
  environment: AiTrainingEnvironment;
  actions: readonly Readonly<AiTrainingLegalAction>[];
  observation: DeepReadonly<AiTrainingObservation>;
  breakdown: Readonly<AiRecruitPlanScoreBreakdown>;
}

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  label: string,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  if (
    !Number.isSafeInteger(resolved) ||
    resolved < 1 ||
    resolved > maximum
  ) {
    throw new RangeError(
      label + " must be an integer from 1 to " + maximum,
    );
  }
  return resolved;
}

function minionVisiblePower(
  minion: DeepReadonly<AiTrainingMinionObservation>,
  profile: AiStrategyProfile,
): number {
  const definition =
    minion.kind === "minion"
      ? getMinionDefinition(minion.definitionId)
      : null;
  const stats = (minion.attack + minion.health) * profile.statWeight;
  const shieldValue = minion.divineShield
    ? Math.max(2, minion.attack * 0.55 + minion.health * 0.2)
    : 0;
  const rebornValue = minion.reborn
    ? Math.max(1.5, (minion.attack + minion.health) * 0.3)
    : 0;
  const poisonValue = minion.venomous || minion.poisonous
    ? 4 + minion.tier
    : 0;
  const cleaveValue = minion.cleave
    ? Math.max(2, minion.attack * 0.7)
    : 0;
  const windfuryValue = minion.windfury
    ? Math.max(1, minion.attack * 0.3)
    : 0;
  const utility =
    (minion.taunt ? 0.7 : 0) +
    (minion.stealth ? 0.5 : 0) +
    (minion.golden ? 1.5 : 0) +
    minion.tier * profile.highTierBonus * 0.35 +
    (definition?.battlecry ? profile.battlecryBonus : 0) +
    (definition?.deathrattle ? profile.deathrattleBonus : 0) +
    (definition?.magnetic ? profile.magneticBonus : 0) +
    (profile.preferredTribe !== null &&
    minion.tribes.includes(profile.preferredTribe)
      ? profile.preferredTribeBonus
      : 0);
  return (
    stats +
    shieldValue +
    rebornValue +
    poisonValue +
    cleaveValue +
    windfuryValue +
    utility
  );
}

function handCardPotential(
  card: DeepReadonly<AiTrainingCardObservation>,
  profile: AiStrategyProfile,
  playableBoardSlot: boolean,
): number {
  switch (card.kind) {
    case "minion":
      return (
        minionVisiblePower(card, profile) *
        (playableBoardSlot ? 0.34 : 0.08)
      );
    case "tripleReward":
      return Math.max(3, minionVisiblePower(card, profile) * 0.18);
    case "tavernSpell":
      return Math.max(
        0.75,
        card.tier * profile.spellValueMultiplier * 0.8,
      );
    case "bloodGem":
      return 1.4;
    case "consolationCoin":
      return 1;
    case "spellcraft":
      return 1.2 * (card.effectMultiplier ?? 1);
  }
}

function copyProgressValue(
  observation: DeepReadonly<AiTrainingObservation>,
  profile: AiStrategyProfile,
): number {
  const copies = new Map<string, number>();
  const add = (
    minion: DeepReadonly<AiTrainingMinionObservation>,
  ): void => {
    copies.set(
      minion.definitionId,
      (copies.get(minion.definitionId) ?? 0) + (minion.golden ? 3 : 1),
    );
  };
  observation.own.board.forEach(add);
  for (const card of observation.own.hand) {
    if (card.kind === "minion") add(card);
  }
  let value = 0;
  for (const count of copies.values()) {
    if (count >= 3) {
      value += profile.tripleBonus;
    } else if (count === 2) {
      value += profile.pairBonus;
    }
  }
  return value;
}

function tribeCohesionValue(
  board: readonly DeepReadonly<AiTrainingMinionObservation>[],
  profile: AiStrategyProfile,
): number {
  const counts = new Map<string, number>();
  for (const minion of board) {
    for (const tribe of minion.tribes) {
      if (tribe === "neutral" || tribe === "all") continue;
      counts.set(tribe, (counts.get(tribe) ?? 0) + 1);
    }
  }
  const largestGroup = Math.max(0, ...counts.values());
  return (
    largestGroup *
    Math.max(0, largestGroup - 1) *
    profile.synergyWeight *
    0.45
  );
}

function bestVisibleShopValue(
  observation: DeepReadonly<AiTrainingObservation>,
  profile: AiStrategyProfile,
): number {
  const minionValue = observation.own.shop.reduce(
    (best, minion) =>
      Math.max(best, minionVisiblePower(minion, profile)),
    0,
  );
  const spells = [
    ...(observation.own.spellShop
      ? [observation.own.spellShop]
      : []),
    ...observation.own.additionalSpellShop,
  ];
  const spellValue = spells.reduce(
    (best, spell) =>
      Math.max(best, spell.tier * profile.spellValueMultiplier),
    0,
  );
  return Math.max(minionValue, spellValue);
}

function referencedCard(
  observation: DeepReadonly<AiTrainingObservation>,
  reference: Readonly<AiTrainingLegalAction>["source"],
): DeepReadonly<AiTrainingCardObservation> | undefined {
  if (!reference) return undefined;
  switch (reference.zone) {
    case "board":
      return observation.own.board[reference.index];
    case "hand":
      return observation.own.hand[reference.index];
    case "shop":
      return observation.own.shop[reference.index];
    case "spellShop":
      return reference.index === 0
        ? observation.own.spellShop ?? undefined
        : undefined;
    case "additionalSpellShop":
      return observation.own.additionalSpellShop[reference.index];
  }
}

function ownedCopyCount(
  observation: DeepReadonly<AiTrainingObservation>,
  definitionId: string,
): number {
  let count = 0;
  for (const card of [
    ...observation.own.board,
    ...observation.own.hand,
  ]) {
    if (
      (card.kind === "minion" || card.kind === "tripleReward") &&
      card.definitionId === definitionId
    ) {
      count += card.golden ? 3 : 1;
    }
  }
  return count;
}

function visibleTavernSpellValue(
  card: Extract<
    DeepReadonly<AiTrainingCardObservation>,
    { readonly kind: "tavernSpell" }
  >,
  profile: AiStrategyProfile,
): number {
  const definition = getTavernSpellDefinition(card.definitionId);
  const immediateMinionEffects = new Set([
    "discoverTierOne",
    "stealRandomShopMinion",
    "recruitTrainee",
    "chefsChoice",
    "friendlyBounty",
    "planarTelescope",
    "cloneHorn",
    "temperatureShift",
    "reservedCorpse",
    "headhunter",
  ]);
  const immediateMinionBonus = immediateMinionEffects.has(
    definition.effect,
  )
    ? 7
    : 0;
  const economyBonus =
    definition.effect === "gainTwoGold"
      ? 2 * profile.economyBonus
      : definition.effect === "gainOneGold" ||
          definition.effect === "hastyExcavation"
        ? profile.economyBonus
        : 0;
  return (
    Math.max(1.2, card.tier * 1.7) *
      profile.spellValueMultiplier +
    immediateMinionBonus +
    economyBonus
  );
}

function weakestBoardPower(
  observation: DeepReadonly<AiTrainingObservation>,
  profile: AiStrategyProfile,
): number {
  return observation.own.board.reduce(
    (weakest, minion) =>
      Math.min(weakest, minionVisiblePower(minion, profile)),
    Number.POSITIVE_INFINITY,
  );
}

function bestPlayableHandMinionPower(
  observation: DeepReadonly<AiTrainingObservation>,
  profile: AiStrategyProfile,
): number {
  return observation.own.hand.reduce((best, card) => {
    if (
      card.kind !== "minion" ||
      (card.playableFromRound ?? 0) > observation.public.round
    ) {
      return best;
    }
    return Math.max(best, minionVisiblePower(card, profile));
  }, Number.NEGATIVE_INFINITY);
}

function upgradeIsPreferred(
  observation: DeepReadonly<AiTrainingObservation>,
  action: Readonly<AiTrainingLegalAction>,
  legalActions: readonly Readonly<AiTrainingLegalAction>[],
  profile: AiStrategyProfile,
): boolean {
  if (action.cost?.currency !== "gold") return false;
  const bestShopScore = observation.own.shop.reduce(
    (best, minion) =>
      Math.max(best, minionVisiblePower(minion, profile)),
    Number.NEGATIVE_INFINITY,
  );
  const weakestScore =
    observation.own.board.length > 0
      ? weakestBoardPower(observation, profile)
      : 0;
  const bestAffordableSpellScore = legalActions.reduce(
    (best, candidate) => {
      if (candidate.type !== "BUY_TAVERN_SPELL") return best;
      const card = referencedCard(observation, candidate.source);
      return card?.kind === "tavernSpell"
        ? Math.max(best, visibleTavernSpellValue(card, profile))
        : best;
    },
    Number.NEGATIVE_INFINITY,
  );
  return shouldAiUpgrade({
    profile,
    round: observation.public.round,
    tavernTier: observation.own.tavernTier,
    health: observation.own.health,
    armor: observation.own.armor,
    gold: observation.own.gold,
    upgradeCost: action.cost.amount,
    boardSize: observation.own.board.length,
    bestShopScore,
    weakestBoardScore: weakestScore,
    bestAffordableSpellScore,
  });
}

function buyMinionExpectedValue(
  observation: DeepReadonly<AiTrainingObservation>,
  action: Readonly<AiTrainingLegalAction>,
  profile: AiStrategyProfile,
): number {
  const card = referencedCard(observation, action.source);
  if (card?.kind !== "minion") return -100;
  const power = minionVisiblePower(card, profile);
  const copies = ownedCopyCount(observation, card.definitionId);
  const targetBoardSize = aiTargetBoardSize(observation.public.round);
  const boardSize = observation.own.board.length;
  if (copies >= 2) {
    return 225 + profile.tripleBonus + power * 0.25;
  }
  if (boardSize < targetBoardSize) {
    return 150 + power;
  }
  const weakest = weakestBoardPower(observation, profile);
  const margin = power - weakest;
  if (boardSize < 7 && margin >= profile.replacementMargin / 2) {
    return 115 + margin + (copies === 1 ? profile.pairBonus : 0);
  }
  if (boardSize >= 7 && margin >= profile.replacementMargin) {
    return 175 + margin + (copies === 1 ? profile.pairBonus : 0);
  }
  if (copies === 1) {
    return 95 + profile.pairBonus + power * 0.15;
  }
  return -40 + margin;
}

function actionExpectedValue(
  observation: DeepReadonly<AiTrainingObservation>,
  action: Readonly<AiTrainingLegalAction>,
  legalActions: readonly Readonly<AiTrainingLegalAction>[],
  profile: AiStrategyProfile,
): number {
  const source = referencedCard(observation, action.source);
  const target = referencedCard(observation, action.target);
  switch (action.type) {
    case "RESOLVE_INTERACTION": {
      const option =
        action.choiceIndex === null
          ? undefined
          : observation.own.pendingInteraction?.optionCards[
              action.choiceIndex
            ];
      return 400 + (option ? minionVisiblePower(option, profile) : 0);
    }
    case "PLAY_HAND_CARD":
      if (source?.kind === "minion") {
        const pressure =
          observation.own.health + observation.own.armor <
          profile.minimumUpgradeHealth
            ? 1.28
            : 1;
        const fillsDeficit =
          observation.own.board.length <
          aiTargetBoardSize(observation.public.round);
        return (
          300 +
          minionVisiblePower(source, profile) * 0.66 +
          (fillsDeficit ? 8.9 * pressure : 0)
        );
      }
      if (source?.kind === "tripleReward") return 340;
      if (source?.kind === "consolationCoin") return 310;
      return -100;
    case "MAGNETIZE_MINION":
      return source?.kind === "minion"
        ? 315 + minionVisiblePower(source, profile) * 0.7
        : -100;
    case "CAST_BLOOD_GEM":
      return (
        285 +
        observation.own.bloodGemAttack +
        observation.own.bloodGemHealth +
        (target?.kind === "minion" && target.divineShield ? 1 : 0)
      );
    case "CAST_TAVERN_SPELL":
      return source?.kind === "tavernSpell"
        ? 280 + visibleTavernSpellValue(source, profile)
        : -100;
    case "CAST_SPELLCRAFT":
      return source?.kind === "spellcraft"
        ? 280 + 2.5 * (source.effectMultiplier ?? 1)
        : -100;
    case "UPGRADE_TAVERN":
      return upgradeIsPreferred(
        observation,
        action,
        legalActions,
        profile,
      )
        ? 250 + observation.own.tavernTier * 2
        : -100;
    case "BUY_MINION":
      return buyMinionExpectedValue(observation, action, profile);
    case "BUY_TAVERN_SPELL": {
      if (source?.kind !== "tavernSpell" || !action.cost) return -100;
      const value = visibleTavernSpellValue(source, profile);
      const targetBoardSize = aiTargetBoardSize(observation.public.round);
      const boardDeficit = Math.max(
        0,
        targetBoardSize - observation.own.board.length,
      );
      const definition = getTavernSpellDefinition(source.definitionId);
      const suppliesMinion = new Set([
        "discoverTierOne",
        "stealRandomShopMinion",
        "recruitTrainee",
        "chefsChoice",
        "friendlyBounty",
        "planarTelescope",
        "cloneHorn",
        "temperatureShift",
        "reservedCorpse",
        "headhunter",
      ]).has(definition.effect);
      const tempoPenalty =
        boardDeficit > 0 && !suppliesMinion ? 65 : 0;
      return (
        105 +
        value * 4 -
        action.cost.amount * 3 -
        tempoPenalty
      );
    }
    case "SELL_MINION": {
      if (source?.kind !== "minion") return -100;
      const sourcePower = minionVisiblePower(source, profile);
      const replacementPower = bestPlayableHandMinionPower(
        observation,
        profile,
      );
      const targetBoardSize = aiTargetBoardSize(observation.public.round);
      if (
        observation.own.board.length >= 7 &&
        replacementPower >= sourcePower + profile.replacementMargin
      ) {
        return 230 + replacementPower - sourcePower;
      }
      if (
        observation.own.board.length > targetBoardSize &&
        source.sellValue > 1
      ) {
        return 120 + source.sellValue * profile.economyBonus;
      }
      return -120 - sourcePower;
    }
    case "REFRESH_SHOP": {
      if (!action.cost || observation.own.hand.length >= 10) return -100;
      const effectiveHealth =
        observation.own.health + observation.own.armor;
      if (
        action.cost.currency === "health" &&
        action.cost.amount > 0 &&
        effectiveHealth - action.cost.amount < profile.healthSpendFloor
      ) {
        return -100;
      }
      const bestBuy = legalActions.reduce(
        (best, candidate) =>
          candidate.type === "BUY_MINION"
            ? Math.max(
                best,
                buyMinionExpectedValue(
                  observation,
                  candidate,
                  profile,
                ),
              )
            : best,
        Number.NEGATIVE_INFINITY,
      );
      if (bestBuy >= 95) return -80;
      const minionCost =
        legalActions.find(
          (candidate) => candidate.type === "BUY_MINION",
        )?.cost?.amount ?? 3;
      const goldAfter =
        action.cost.currency === "gold"
          ? observation.own.gold - action.cost.amount
          : observation.own.gold;
      if (action.cost.amount === 0) return 92;
      if (goldAfter >= minionCost) return 82;
      if (
        action.cost.currency === "gold" &&
        observation.own.gold === action.cost.amount &&
        observation.own.board.length >=
          aiTargetBoardSize(observation.public.round)
      ) {
        return 55;
      }
      return -100;
    }
    default:
      return -100;
  }
}

/**
 * Public-state heuristic for short Recruit plans. It deliberately does not
 * inspect combat branches, hidden opponents, RNG state, or shared pool counts.
 */
export function scoreAiRecruitObservation(
  observation: DeepReadonly<AiTrainingObservation>,
  profile: AiStrategyProfile = AI_STRATEGY_PROFILES[0],
  options: {
    terminal?: boolean;
    actionCount?: number;
    actionExpectedValue?: number;
  } = {},
): Readonly<AiRecruitPlanScoreBreakdown> {
  const effectiveHealth = observation.own.health + observation.own.armor;
  const pressureMultiplier =
    effectiveHealth < profile.minimumUpgradeHealth ? 1.28 : 1;
  const boardPower =
    observation.own.board.reduce(
      (total, minion) =>
        total + minionVisiblePower(minion, profile),
      0,
    ) * pressureMultiplier;
  const targetBoardSize = aiTargetBoardSize(observation.public.round);
  const boardCoverage =
    Math.min(observation.own.board.length, targetBoardSize) *
      (3.4 * pressureMultiplier) -
    Math.max(0, targetBoardSize - observation.own.board.length) *
      (5.5 * pressureMultiplier);
  let remainingBoardSlots = Math.max(
    0,
    7 - observation.own.board.length,
  );
  let blockedMinionPower = 0;
  const handPotential = observation.own.hand.reduce((total, card) => {
    const playableBoardSlot =
      card.kind === "minion" && remainingBoardSlots > 0;
    if (card.kind === "minion") {
      if (playableBoardSlot) {
        remainingBoardSlots -= 1;
      } else {
        blockedMinionPower += minionVisiblePower(card, profile);
      }
    }
    return total + handCardPotential(card, profile, playableBoardSlot);
  }, 0);
  const pairAndTripleValue = copyProgressValue(observation, profile);
  const tribeCohesion = tribeCohesionValue(
    observation.own.board,
    profile,
  );
  const safeToInvest =
    effectiveHealth >= profile.minimumUpgradeHealth ? 1 : 0.45;
  const tavernTierValue =
    observation.own.tavernTier *
    (2.4 + profile.highTierBonus * 3.2) *
    safeToInvest;
  const projectedBaseGold = Math.min(
    observation.own.maxGold,
    observation.public.round + 3,
  );
  const futureEconomy =
    (projectedBaseGold + observation.own.pendingNextTurnGold) * 0.34 +
    observation.own.freeRefreshes * 0.7 +
    observation.own.freeTavernSpellPurchases * 1.1 +
    Math.max(0, observation.own.maxGold - 10) * 0.5;
  const freezeThreshold =
    7 +
    observation.own.tavernTier * 2 -
    profile.freezeScoreBonus;
  const frozenOpportunity = observation.own.frozen
    ? Math.max(
        0,
        bestVisibleShopValue(observation, profile) - freezeThreshold,
      ) * 0.4
    : 0;
  const actionExpectedValue = options.actionExpectedValue ?? 0;
  const unspentGoldPenalty = options.terminal
    ? observation.own.gold * 1.15
    : 0;
  const handCongestionPenalty =
    blockedMinionPower * 0.18 +
    Math.max(0, observation.own.hand.length - 7) * 1.6;
  const actionCountPenalty = (options.actionCount ?? 0) * 0.015;
  const total =
    boardPower +
    boardCoverage +
    handPotential +
    pairAndTripleValue +
    tribeCohesion +
    tavernTierValue +
    futureEconomy +
    frozenOpportunity +
    actionExpectedValue -
    unspentGoldPenalty -
    handCongestionPenalty -
    actionCountPenalty;
  return Object.freeze({
    boardPower,
    boardCoverage,
    handPotential,
    pairAndTripleValue,
    tribeCohesion,
    tavernTierValue,
    futureEconomy,
    frozenOpportunity,
    actionExpectedValue,
    unspentGoldPenalty,
    handCongestionPenalty,
    actionCountPenalty,
    total,
  });
}

function actionSortKey(
  actions: readonly Readonly<AiTrainingLegalAction>[],
): string {
  return actions
    .map((action) =>
      [
        action.type,
        action.source?.zone ?? "",
        action.source?.index ?? -1,
        action.target?.zone ?? "",
        action.target?.index ?? -1,
        action.boardIndex ?? -1,
        action.choiceIndex ?? -1,
      ].join(":"),
    )
    .join("|");
}

function sortNodes(left: PlannerNode, right: PlannerNode): number {
  return (
    right.breakdown.total - left.breakdown.total ||
    actionSortKey(left.actions).localeCompare(
      actionSortKey(right.actions),
    )
  );
}

function freezePlan(
  node: PlannerNode,
  termination: AiRecruitPlanTermination,
  baselineScore: number,
): AiRecruitPlan {
  return Object.freeze({
    plannerVersion: AI_RECRUIT_PLANNER_VERSION,
    termination,
    complete: termination === "endTurn",
    actions: Object.freeze([...node.actions]),
    observation: node.observation,
    score: node.breakdown.total,
    scoreDelta: node.breakdown.total - baselineScore,
    breakdown: node.breakdown,
  });
}

/**
 * Beam-searches only the visible Recruit phase. END_TURN is appended without
 * executing combat. Conservatively classified mutations become a final action
 * fragment and must be executed on the real episode before planning resumes;
 * no private random outcome is available to this function.
 */
export function planAiRecruitTurn(
  environment: AiTrainingEnvironment,
  options: AiRecruitPlannerOptions = {},
): AiRecruitPlan {
  const beamWidth = boundedPositiveInteger(
    options.beamWidth,
    8,
    "beamWidth",
    64,
  );
  const maxActions = boundedPositiveInteger(
    options.maxActions,
    6,
    "maxActions",
    20,
  );
  const profile = options.profile ?? AI_STRATEGY_PROFILES[0];
  const initialObservation = environment.observe();
  if (initialObservation.public.phase !== "recruit") {
    throw new Error("Recruit planning requires the Recruit phase");
  }
  const baseline = scoreAiRecruitObservation(
    initialObservation,
    profile,
    { terminal: true },
  );
  let beam: PlannerNode[] = [
    {
      environment: environment.fork(),
      actions: [],
      observation: initialObservation,
      breakdown: scoreAiRecruitObservation(initialObservation, profile),
    },
  ];
  const completed: PlannerNode[] = [];
  const replanBoundaries: PlannerNode[] = [];

  for (let depth = 0; depth <= maxActions; depth += 1) {
    const expanded: PlannerNode[] = [];
    for (const node of beam) {
      const legalActions = node.environment.plannerLegalActions();
      const endTurn = legalActions.find(
        (action) => action.type === "END_TURN",
      );
      if (endTurn) {
        const actions = Object.freeze([...node.actions, endTurn]);
        completed.push({
          ...node,
          actions,
          breakdown: scoreAiRecruitObservation(
            node.observation,
            profile,
            { terminal: true, actionCount: actions.length },
          ),
        });
      }
      if (depth === maxActions) continue;
      const previousAction = node.actions.at(-1);
      for (const action of legalActions) {
        if (
          action.type === "END_TURN" ||
          action.type === "CONTINUE" ||
          (action.type === "TOGGLE_FREEZE" &&
            previousAction?.type === "TOGGLE_FREEZE")
        ) {
          continue;
        }
        const plannerTransition = node.environment.plannerTransition(
          action.token,
        );
        const actions = Object.freeze([...node.actions, action]);
        if (plannerTransition.kind === "replanBoundary") {
          replanBoundaries.push({
            ...node,
            actions,
            breakdown: scoreAiRecruitObservation(
              node.observation,
              profile,
              {
                actionCount: actions.length,
                actionExpectedValue: actionExpectedValue(
                  node.observation,
                  action,
                  legalActions,
                  profile,
                ),
              },
            ),
          });
          continue;
        }
        if (
          plannerTransition.done ||
          plannerTransition.observation.public.phase !== "recruit"
        ) {
          continue;
        }
        expanded.push({
          environment: plannerTransition.environment,
          actions,
          observation: plannerTransition.observation,
          breakdown: scoreAiRecruitObservation(
            plannerTransition.observation,
            profile,
            { actionCount: actions.length },
          ),
        });
      }
    }
    if (expanded.length === 0) break;
    expanded.sort(sortNodes);
    beam = expanded.slice(0, beamWidth);
  }

  if (completed.length > 0) {
    completed.sort(sortNodes);
  }
  if (replanBoundaries.length > 0) {
    replanBoundaries.sort(sortNodes);
  }
  if (
    replanBoundaries[0] &&
    (!completed[0] ||
      replanBoundaries[0].breakdown.total >
        completed[0].breakdown.total)
  ) {
    return freezePlan(
      replanBoundaries[0],
      "replanAfterAction",
      baseline.total,
    );
  }
  if (completed[0]) {
    return freezePlan(completed[0], "endTurn", baseline.total);
  }
  beam.sort(sortNodes);
  return freezePlan(
    beam[0],
    "searchExhausted",
    baseline.total,
  );
}
