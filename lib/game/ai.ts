import type {
  PlayerId,
  TavernTier,
  Tribe,
} from "./types.ts";

export type AiStrategyId =
  | "balanced"
  | "magnetic"
  | "tempo"
  | "triple"
  | "powerLevel"
  | "economy"
  | "deathrattle";

/**
 * Stable, deterministic strategy weights extracted from recurring decisions in
 * high-level Battlegrounds teaching and match videos. These are intentionally
 * soft preferences: immediate relative strength can always outweigh a theme.
 *
 * The reviewed observations and their Bilibili timestamps are recorded in
 * `docs/ai-strategy.md`; videos are never fetched while the game is running.
 */
export interface AiStrategyProfile {
  id: AiStrategyId;
  label: string;
  description: string;
  preferredTribe: Tribe | null;
  upgradeRoundOffset: number;
  minimumUpgradeHealth: number;
  statWeight: number;
  synergyWeight: number;
  preferredTribeBonus: number;
  pairBonus: number;
  tripleBonus: number;
  battlecryBonus: number;
  deathrattleBonus: number;
  economyBonus: number;
  magneticBonus: number;
  highTierBonus: number;
  spellValueMultiplier: number;
  replacementMargin: number;
  maxRefreshes: number;
  freezeScoreBonus: number;
  scoutingWeight: number;
  healthSpendFloor: number;
}

export const AI_STRATEGY_PROFILES: readonly AiStrategyProfile[] =
  Object.freeze([
    {
      id: "balanced",
      label: "灵活运营",
      description: "比较即时战力、经济和成长空间，不提前锁死流派。",
      preferredTribe: null,
      upgradeRoundOffset: 0,
      minimumUpgradeHealth: 16,
      statWeight: 1,
      synergyWeight: 0.8,
      preferredTribeBonus: 0,
      pairBonus: 3,
      tripleBonus: 10,
      battlecryBonus: 1.5,
      deathrattleBonus: 2.5,
      economyBonus: 1,
      magneticBonus: 2,
      highTierBonus: 0,
      spellValueMultiplier: 1,
      replacementMargin: 2.5,
      maxRefreshes: 3,
      freezeScoreBonus: 0,
      scoutingWeight: 0.5,
      healthSpendFloor: 8,
    },
    {
      id: "magnetic",
      label: "磁力成长",
      description: "优先构筑机械宿主、磁力成长和圣盾刷新链。",
      preferredTribe: "mech",
      upgradeRoundOffset: 0,
      minimumUpgradeHealth: 17,
      statWeight: 0.98,
      synergyWeight: 1.15,
      preferredTribeBonus: 2.5,
      pairBonus: 3.5,
      tripleBonus: 11,
      battlecryBonus: 1.5,
      deathrattleBonus: 2.8,
      economyBonus: 1,
      magneticBonus: 5,
      highTierBonus: 0,
      spellValueMultiplier: 0.95,
      replacementMargin: 2,
      maxRefreshes: 3,
      freezeScoreBonus: 1,
      scoutingWeight: 0.55,
      healthSpendFloor: 8,
    },
    {
      id: "tempo",
      label: "稳血节奏",
      description: "低血或弱场时延后升本，优先购买可立即上场的战力。",
      preferredTribe: "demon",
      upgradeRoundOffset: 1,
      minimumUpgradeHealth: 21,
      statWeight: 1.08,
      synergyWeight: 0.9,
      preferredTribeBonus: 2,
      pairBonus: 2.5,
      tripleBonus: 9,
      battlecryBonus: 1.8,
      deathrattleBonus: 2.3,
      economyBonus: 1.2,
      magneticBonus: 1.5,
      highTierBonus: 0,
      spellValueMultiplier: 0.9,
      replacementMargin: 1.5,
      maxRefreshes: 3,
      freezeScoreBonus: 0,
      scoutingWeight: 0.45,
      healthSpendFloor: 12,
    },
    {
      id: "triple",
      label: "对子搜牌",
      description: "提高对子、第三张和可冻结三连机会的优先级。",
      preferredTribe: "murloc",
      upgradeRoundOffset: 0,
      minimumUpgradeHealth: 17,
      statWeight: 0.95,
      synergyWeight: 1.2,
      preferredTribeBonus: 2.5,
      pairBonus: 5,
      tripleBonus: 14,
      battlecryBonus: 1.5,
      deathrattleBonus: 2,
      economyBonus: 1.2,
      magneticBonus: 1,
      highTierBonus: 0,
      spellValueMultiplier: 1,
      replacementMargin: 2,
      maxRefreshes: 4,
      freezeScoreBonus: 2,
      scoutingWeight: 0.6,
      healthSpendFloor: 9,
    },
    {
      id: "powerLevel",
      label: "健康升本",
      description: "在生命和场面允许时提前升本，寻找更高等级核心。",
      preferredTribe: "dragon",
      upgradeRoundOffset: -1,
      minimumUpgradeHealth: 14,
      statWeight: 1,
      synergyWeight: 1.05,
      preferredTribeBonus: 2.2,
      pairBonus: 2.5,
      tripleBonus: 9,
      battlecryBonus: 1.5,
      deathrattleBonus: 2,
      economyBonus: 0.8,
      magneticBonus: 1,
      highTierBonus: 0.8,
      spellValueMultiplier: 0.9,
      replacementMargin: 3,
      maxRefreshes: 2,
      freezeScoreBonus: -0.5,
      scoutingWeight: 0.45,
      healthSpendFloor: 7,
    },
    {
      id: "economy",
      label: "经济循环",
      description: "重视理财、资源牌、低费法术和把金币完整转化为行动。",
      preferredTribe: "pirate",
      upgradeRoundOffset: 0,
      minimumUpgradeHealth: 16,
      statWeight: 0.98,
      synergyWeight: 1,
      preferredTribeBonus: 2.2,
      pairBonus: 3,
      tripleBonus: 10,
      battlecryBonus: 2.2,
      deathrattleBonus: 2,
      economyBonus: 4,
      magneticBonus: 1,
      highTierBonus: 0.1,
      spellValueMultiplier: 1.2,
      replacementMargin: 1.5,
      maxRefreshes: 4,
      freezeScoreBonus: 0.5,
      scoutingWeight: 0.5,
      healthSpendFloor: 8,
    },
    {
      id: "deathrattle",
      label: "亡语站位",
      description: "重视亡语与召唤空间，并根据对手圣盾、嘲讽和顺劈调位。",
      preferredTribe: "beast",
      upgradeRoundOffset: 1,
      minimumUpgradeHealth: 20,
      statWeight: 1,
      synergyWeight: 1.1,
      preferredTribeBonus: 2.3,
      pairBonus: 3,
      tripleBonus: 10,
      battlecryBonus: 1.2,
      deathrattleBonus: 4.5,
      economyBonus: 1,
      magneticBonus: 1,
      highTierBonus: 0,
      spellValueMultiplier: 0.95,
      replacementMargin: 1.8,
      maxRefreshes: 4,
      freezeScoreBonus: 0.5,
      scoutingWeight: 1,
      healthSpendFloor: 9,
    },
  ] satisfies readonly AiStrategyProfile[]);

/**
 * The player IDs are part of the deterministic lobby schema, so profiles do
 * not need another save field or migration.
 */
export function getAiStrategyProfile(
  playerId: PlayerId,
): AiStrategyProfile {
  const match = /^player-(\d+)$/.exec(playerId);
  const numericId = match ? Number.parseInt(match[1], 10) : 1;
  if (numericId >= 1 && numericId <= AI_STRATEGY_PROFILES.length) {
    return AI_STRATEGY_PROFILES[numericId - 1];
  }
  return AI_STRATEGY_PROFILES[0];
}

export const AI_BASE_TIER_UP_ROUND = [
  0,
  0,
  2,
  4,
  6,
  9,
  11,
] as const;

export function aiTargetBoardSize(round: number): number {
  if (round <= 1) {
    return 1;
  }
  if (round === 2) {
    return 1;
  }
  if (round === 3) {
    return 3;
  }
  if (round === 4) {
    return 4;
  }
  if (round === 5) {
    return 5;
  }
  if (round === 6) {
    return 6;
  }
  return 7;
}

export interface AiUpgradeContext {
  profile: AiStrategyProfile;
  round: number;
  tavernTier: TavernTier;
  health: number;
  armor: number;
  gold: number;
  upgradeCost: number;
  boardSize: number;
  bestShopScore: number;
  weakestBoardScore: number;
  bestAffordableSpellScore?: number;
}

/**
 * Upgrade decisions compare the current shop with the current warband. This is
 * deliberately relative instead of relying on one absolute "good board" score.
 */
export function shouldAiUpgrade({
  profile,
  round,
  tavernTier,
  health,
  armor,
  gold,
  upgradeCost,
  boardSize,
  bestShopScore,
  weakestBoardScore,
  bestAffordableSpellScore = Number.NEGATIVE_INFINITY,
}: AiUpgradeContext): boolean {
  if (tavernTier >= 6 || gold < upgradeCost) {
    return false;
  }
  const nextTier = tavernTier + 1;
  const scheduledRound = Math.max(
    2,
    AI_BASE_TIER_UP_ROUND[nextTier] + profile.upgradeRoundOffset,
  );
  if (round < scheduledRound) {
    return false;
  }

  const effectiveHealth = health + armor;
  if (nextTier === 2) {
    return effectiveHealth > 8;
  }

  const remainingGold = gold - upgradeCost;
  const targetBoardSize = aiTargetBoardSize(round);
  const boardDeficit = Math.max(0, targetBoardSize - boardSize);
  const underPressure =
    effectiveHealth < profile.minimumUpgradeHealth;
  const shopHasImmediateUpgrade =
    bestShopScore > Number.NEGATIVE_INFINITY &&
    bestShopScore >= weakestBoardScore + 2.5 &&
    gold >= 3;
  const spellHasImmediateValue = bestAffordableSpellScore >= 8;
  const hasImmediateSpend =
    shopHasImmediateUpgrade || spellHasImmediateValue;

  if (boardDeficit >= 2 && remainingGold < 3) {
    return false;
  }
  if (
    underPressure &&
    (boardDeficit > 0 || hasImmediateSpend)
  ) {
    return false;
  }
  if (
    round === scheduledRound &&
    profile.upgradeRoundOffset >= 0 &&
    remainingGold < 3 &&
    hasImmediateSpend
  ) {
    return false;
  }
  return true;
}
