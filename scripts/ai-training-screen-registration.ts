import type { AiStrategyProfile } from "../lib/game/ai.ts";

export type AiPolicyTrainingCandidateId =
  | "offset0-scouted-shield-break-v1"
  | "offset0-safe-tier6-v1"
  | "offset0-tier6-refresh-v1";

export const AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID =
  "power-level-offset0-final-conversion-screen-30300001-v1";

export const AI_POLICY_TRAINING_SCREEN_REGISTRATION = Object.freeze({
  id: AI_POLICY_TRAINING_SCREEN_REGISTRATION_ID,
  strategyId: "powerLevel" as const,
  playerId: "player-5",
  seeds: 64,
  startSeed: 30_300_001,
  maxRounds: 100,
  rotationsPerSeed: 8,
  scheduledGames: 512,
  baselineStrategyProfileHash:
    "c9488d3eaf97e25a5026354f9a07f7579e4733158ff13122d411487e17366051",
  minimumPlacementImprovement: 0.1,
  topFourNoninferiorityGuard: 0.01,
  winRateNoninferiorityGuard: 0.02,
  candidateIds: Object.freeze([
    "offset0-scouted-shield-break-v1",
    "offset0-safe-tier6-v1",
    "offset0-tier6-refresh-v1",
  ] as const satisfies readonly AiPolicyTrainingCandidateId[]),
});

export const AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE = Object.freeze({
  id: "powerLevel",
  label: "健康升本",
  description: "在生命和场面允许时提前升本，寻找更高等级核心。",
  preferredTribe: "dragon",
  upgradeRoundOffset: -1,
  safeTierSixUpgradeAcceleration: 0,
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
  tierSixRefreshBonus: 0,
  freezeScoreBonus: -0.5,
  scoutingWeight: 0.45,
  healthSpendFloor: 7,
} satisfies AiStrategyProfile);

export interface AiPolicyTrainingCandidateDefinition {
  readonly id: AiPolicyTrainingCandidateId;
  readonly profile: Readonly<AiStrategyProfile>;
}

export const AI_POLICY_TRAINING_SCREEN_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "offset0-scouted-shield-break-v1",
    profile: Object.freeze({
      ...AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
      upgradeRoundOffset: 0,
      scoutingWeight: 0.5,
    }),
  }),
  Object.freeze({
    id: "offset0-safe-tier6-v1",
    profile: Object.freeze({
      ...AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
      upgradeRoundOffset: 0,
      safeTierSixUpgradeAcceleration: 1,
    }),
  }),
  Object.freeze({
    id: "offset0-tier6-refresh-v1",
    profile: Object.freeze({
      ...AI_POLICY_TRAINING_SCREEN_BASELINE_PROFILE,
      upgradeRoundOffset: 0,
      tierSixRefreshBonus: 1,
    }),
  }),
] as const satisfies readonly AiPolicyTrainingCandidateDefinition[]);
