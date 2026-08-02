import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RESIDUAL_CONTEXT_VERSION,
  type AiFreezeMacroContext,
  type AiRefreshMacroContext,
  type AiUpgradeMacroContext,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_VIDEO_BUY_SPIKE_CONFIDENCE,
  AI_VIDEO_BUY_SPIKE_REASON_CODE,
  AI_VIDEO_RESIDUAL_POLICY_ID,
  AI_VIDEO_RESIDUAL_POLICY_VERSION,
  createAiVideoResidualPolicy,
} from "../lib/game/ai-video-residual-policy.ts";

const CONTENT_VERSION = "test-content-v1";
const POLICY_VERSION = "test-policy-v1";

function videoPolicy() {
  return createAiVideoResidualPolicy({
    expectedContentVersion: CONTENT_VERSION,
    expectedPolicyVersion: POLICY_VERSION,
  });
}

function upgradeContext(
  overrides: Partial<AiUpgradeMacroContext> = {},
): AiUpgradeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "upgrade",
    contentVersion: CONTENT_VERSION,
    policyVersion: POLICY_VERSION,
    profileId: "balanced",
    round: 8,
    tavernTier: 4,
    health: 26,
    armor: 0,
    gold: 9,
    boardSize: 7,
    handSize: 9,
    legacyChoice: "upgradeNow",
    legalChoices: ["upgradeNow", "deferUpgrade"],
    checkpoint: "opening",
    actionsTaken: 0,
    refreshesTaken: 0,
    upgradeCost: 7,
    targetBoardSize: 7,
    bestShopScore: 17,
    weakestBoardScore: 11,
    bestAffordableSpellScore: null,
    ...overrides,
  };
}

function refreshContext(): AiRefreshMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "refresh",
    contentVersion: CONTENT_VERSION,
    policyVersion: POLICY_VERSION,
    profileId: "balanced",
    round: 8,
    tavernTier: 4,
    health: 26,
    armor: 0,
    gold: 4,
    boardSize: 7,
    handSize: 1,
    legacyChoice: "refreshOnce",
    legalChoices: ["refreshOnce", "stopRefreshing"],
    refreshCurrency: "gold",
    refreshCost: 1,
    affordable: true,
    healthSpendSafe: true,
    freeRefreshSource: null,
    remainingHealthRefreshes: 0,
    rewindsRecruitDamage: false,
    refreshesThisTurn: 0,
    refreshLimit: 3,
    actionsTaken: 1,
    actionLimit: 50,
    minionPurchaseCost: 3,
    canBuyAfterRefresh: true,
    canSpeculativelyRefresh: false,
    goldAfterRefresh: 3,
    effectiveHealthAfterRefresh: 26,
    healthSpendFloor: 8,
    targetBoardSize: 7,
  };
}

function freezeContext(): AiFreezeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "freeze",
    contentVersion: CONTENT_VERSION,
    policyVersion: POLICY_VERSION,
    profileId: "balanced",
    round: 8,
    tavernTier: 4,
    health: 26,
    armor: 0,
    gold: 0,
    boardSize: 7,
    handSize: 1,
    legacyChoice: "unfreeze",
    legalChoices: ["freeze", "unfreeze"],
    currentlyFrozen: false,
    bestMinionScore: 17,
    bestSpellScore: 7,
    bestTripleProgress: 1,
    remainingMinionPurchaseCost: 3,
    handFull: false,
    freezePairCount: 2,
    minionScoreThreshold: 17,
    spellScoreThreshold: 8,
    freezeMinionReason: false,
    freezeSpellReason: false,
    unspentGold: 0,
  };
}

test("buySpikeBeforeLevel returns one frozen deterministic proposal", () => {
  const policy = videoPolicy();
  const context = upgradeContext();
  const original = structuredClone(context);

  const first = policy.propose(context);
  const second = policy.propose(context);

  assert.equal(policy.policyId, AI_VIDEO_RESIDUAL_POLICY_ID);
  assert.equal(policy.policyVersion, AI_VIDEO_RESIDUAL_POLICY_VERSION);
  assert.equal(Object.isFrozen(policy), true);
  assert.strictEqual(first, second);
  assert.deepEqual(first, {
    kind: "upgrade",
    choice: "deferUpgrade",
    confidence: AI_VIDEO_BUY_SPIKE_CONFIDENCE,
    reasonCode: AI_VIDEO_BUY_SPIKE_REASON_CODE,
  });
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(context, original);
});

test("buySpikeBeforeLevel uses inclusive and exclusive decision boundaries", () => {
  const policy = videoPolicy();
  const cases: ReadonlyArray<
    readonly [string, Partial<AiUpgradeMacroContext>, boolean]
  > = [
    ["two gold remains", {}, true],
    ["three gold remains", { gold: 10 }, false],
    ["nine cards in hand", { handSize: 9 }, true],
    ["ten cards in hand", { handSize: 10 }, false],
    ["score gap is exactly six", { bestShopScore: 17 }, true],
    ["score gap is below six", { bestShopScore: 16.999 }, false],
    ["effective health is exactly 26", { health: 24, armor: 2 }, true],
    ["healthy full board", { health: 27 }, false],
    [
      "healthy board deficit",
      { health: 27, boardSize: 6, targetBoardSize: 7 },
      true,
    ],
    ["missing best shop score", { bestShopScore: null }, false],
    ["missing weakest board score", { weakestBoardScore: null }, false],
  ];

  for (const [label, overrides, shouldPropose] of cases) {
    assert.equal(
      policy.propose(upgradeContext(overrides)) !== null,
      shouldPropose,
      label,
    );
  }
});

test("buySpikeBeforeLevel fails closed on versions, legacy choice, and mask", () => {
  const policy = videoPolicy();

  assert.equal(
    policy.propose(upgradeContext({ contentVersion: "other-content" })),
    null,
  );
  assert.equal(
    policy.propose(upgradeContext({ policyVersion: "other-policy" })),
    null,
  );
  assert.equal(
    policy.propose(upgradeContext({ legacyChoice: "deferUpgrade" })),
    null,
  );
  assert.equal(
    policy.propose(upgradeContext({ legalChoices: ["upgradeNow"] })),
    null,
  );
  assert.throws(
    () =>
      createAiVideoResidualPolicy({
        expectedContentVersion: "",
        expectedPolicyVersion: POLICY_VERSION,
      }),
    /expectedContentVersion must be a non-empty string/,
  );
  assert.throws(
    () =>
      createAiVideoResidualPolicy({
        expectedContentVersion: CONTENT_VERSION,
        expectedPolicyVersion: "",
      }),
    /expectedPolicyVersion must be a non-empty string/,
  );
});

test("buySpikeBeforeLevel abstains from refresh and freeze contexts", () => {
  const policy = videoPolicy();

  assert.equal(policy.propose(refreshContext()), null);
  assert.equal(policy.propose(freezeContext()), null);
});
