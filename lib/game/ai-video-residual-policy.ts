import type {
  AiResidualMacroContext,
  AiResidualPolicy,
  AiUpgradePolicyProposal,
  DeepReadonly,
} from "./ai-residual-policy.ts";

export const AI_VIDEO_RESIDUAL_POLICY_ID =
  "video-residual-buy-spike-before-level" as const;
export const AI_VIDEO_RESIDUAL_POLICY_VERSION =
  "buy-spike-before-level-v1" as const;
export const AI_VIDEO_BUY_SPIKE_CONFIDENCE = 0.95 as const;
export const AI_VIDEO_BUY_SPIKE_REASON_CODE =
  "video.buy-spike-before-level" as const;

export interface AiVideoResidualPolicyOptions {
  readonly expectedContentVersion: string;
  readonly expectedPolicyVersion: string;
}

const BUY_SPIKE_BEFORE_LEVEL_PROPOSAL: Readonly<AiUpgradePolicyProposal> =
  Object.freeze({
    kind: "upgrade",
    choice: "deferUpgrade",
    confidence: AI_VIDEO_BUY_SPIKE_CONFIDENCE,
    reasonCode: AI_VIDEO_BUY_SPIKE_REASON_CODE,
  });

function requireExpectedVersion(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

/**
 * Creates the first video-principle residual candidate.
 *
 * The arm abstains unless upgrading would leave less than a normal purchase,
 * while the visible shop contains a large immediate improvement and either
 * effective health or board development calls for tempo.
 */
export function createAiVideoResidualPolicy(
  options: Readonly<AiVideoResidualPolicyOptions>,
): AiResidualPolicy {
  if (options === null || typeof options !== "object") {
    throw new TypeError("video residual policy options must be an object");
  }
  const expectedContentVersion = requireExpectedVersion(
    options.expectedContentVersion,
    "expectedContentVersion",
  );
  const expectedPolicyVersion = requireExpectedVersion(
    options.expectedPolicyVersion,
    "expectedPolicyVersion",
  );

  return Object.freeze({
    policyId: AI_VIDEO_RESIDUAL_POLICY_ID,
    policyVersion: AI_VIDEO_RESIDUAL_POLICY_VERSION,
    propose(context: DeepReadonly<AiResidualMacroContext>) {
      if (
        context.contentVersion !== expectedContentVersion ||
        context.policyVersion !== expectedPolicyVersion ||
        context.kind !== "upgrade" ||
        context.legacyChoice !== "upgradeNow" ||
        !context.legalChoices.includes("deferUpgrade") ||
        context.gold - context.upgradeCost >= 3 ||
        context.handSize >= 10 ||
        context.bestShopScore === null ||
        context.weakestBoardScore === null ||
        context.bestShopScore < context.weakestBoardScore + 6 ||
        !(
          context.health + context.armor <= 26 ||
          context.boardSize < context.targetBoardSize
        )
      ) {
        return null;
      }

      return BUY_SPIKE_BEFORE_LEVEL_PROPOSAL;
    },
  });
}
