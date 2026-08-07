import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_RESIDUAL_CONTEXT_VERSION,
  AI_RESIDUAL_FORBIDDEN_CONTEXT_KEYS,
  AI_RESIDUAL_OVERRIDE_THRESHOLD,
  hasAiResidualPolicyOverride,
  isAiResidualForbiddenContextKey,
  resolveAiResidualMacroChoice,
  withAiResidualPolicyOverrides,
  type AiFreezeMacroContext,
  type AiRefreshMacroContext,
  type AiResidualMacroContext,
  type AiResidualPolicy,
  type AiResidualPolicyProposal,
  type AiUpgradeMacroContext,
} from "../lib/game/ai-residual-policy.ts";

function upgradeContext(
  overrides: Partial<AiUpgradeMacroContext> = {},
): AiUpgradeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "upgrade",
    contentVersion: "content-v1",
    policyVersion: "legacy-v1",
    profileId: "steady-curve",
    round: 6,
    tavernTier: 3,
    health: 31,
    armor: 4,
    gold: 9,
    boardSize: 6,
    handSize: 1,
    legacyChoice: "deferUpgrade",
    legalChoices: ["upgradeNow", "deferUpgrade"],
    checkpoint: "opening",
    actionsTaken: 0,
    refreshesTaken: 0,
    upgradeCost: 5,
    targetBoardSize: 6,
    bestShopScore: 12.5,
    weakestBoardScore: 9,
    bestAffordableSpellScore: null,
    ...overrides,
  };
}

function refreshContext(
  overrides: Partial<AiRefreshMacroContext> = {},
): AiRefreshMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "refresh",
    contentVersion: "content-v1",
    policyVersion: "legacy-v1",
    profileId: "tempo",
    round: 8,
    tavernTier: 4,
    health: 25,
    armor: 2,
    gold: 4,
    boardSize: 7,
    handSize: 0,
    legacyChoice: "stopRefreshing",
    legalChoices: ["refreshOnce", "stopRefreshing"],
    refreshCurrency: "gold",
    refreshCost: 1,
    affordable: true,
    healthSpendSafe: true,
    freeRefreshSource: null,
    remainingHealthRefreshes: 0,
    rewindsRecruitDamage: false,
    refreshesThisTurn: 1,
    refreshLimit: 4,
    actionsTaken: 3,
    actionLimit: 50,
    minionPurchaseCost: 3,
    canBuyAfterRefresh: true,
    canSpeculativelyRefresh: false,
    goldAfterRefresh: 3,
    effectiveHealthAfterRefresh: 27,
    healthSpendFloor: 8,
    targetBoardSize: 7,
    ...overrides,
  };
}

function freezeContext(
  overrides: Partial<AiFreezeMacroContext> = {},
): AiFreezeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "freeze",
    contentVersion: "content-v1",
    policyVersion: "legacy-v1",
    profileId: "triple-hunter",
    round: 9,
    tavernTier: 4,
    health: 19,
    armor: 0,
    gold: 0,
    boardSize: 7,
    handSize: 2,
    legacyChoice: "unfreeze",
    legalChoices: ["freeze", "unfreeze"],
    currentlyFrozen: false,
    bestMinionScore: 18,
    bestSpellScore: 8,
    bestTripleProgress: 2,
    remainingMinionPurchaseCost: 3,
    handFull: false,
    freezePairCount: 1,
    minionScoreThreshold: 14,
    spellScoreThreshold: 8,
    freezeMinionReason: true,
    freezeSpellReason: true,
    unspentGold: 0,
    ...overrides,
  };
}

function provider(
  propose: AiResidualPolicy["propose"],
  policyId = "test-residual",
): AiResidualPolicy {
  return {
    policyId,
    policyVersion: "test-v1",
    propose,
  };
}

test("exports a versioned contract and fixed 0.90 override threshold", () => {
  assert.equal(AI_RESIDUAL_CONTEXT_VERSION, 2);
  assert.equal(AI_RESIDUAL_OVERRIDE_THRESHOLD, 0.9);

  const result = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        provider((context) => ({
          kind: "upgrade",
          choice: "upgradeNow",
          confidence: AI_RESIDUAL_OVERRIDE_THRESHOLD,
          reasonCode: `round-${context.round}`,
        })),
      ],
    ]),
    () => resolveAiResidualMacroChoice("player-1", upgradeContext()),
  );

  assert.equal(result.result, "upgradeNow");
  assert.equal(result.diagnostics.decisions, 1);
  assert.equal(result.diagnostics.overridesApplied, 1);
  assert.equal(result.diagnostics.fallbacks, 0);
  assert.equal(result.diagnostics.byKind.upgrade.overridesApplied, 1);
});

test("supports upgrade, refresh, and freeze macro contexts", () => {
  const allKinds = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        provider((context) => {
          switch (context.kind) {
            case "upgrade":
              return {
                kind: "upgrade",
                choice: "upgradeNow",
                confidence: 1,
                reasonCode: "curve-window",
              };
            case "refresh":
              return {
                kind: "refresh",
                choice: "refreshOnce",
                confidence: 1,
                reasonCode: "search-window",
              };
            case "freeze":
              return {
                kind: "freeze",
                choice: "freeze",
                confidence: 1,
                reasonCode: "triple-progress",
              };
          }
        }),
      ],
    ]),
    () => [
      resolveAiResidualMacroChoice("player-1", upgradeContext()),
      resolveAiResidualMacroChoice("player-1", refreshContext()),
      resolveAiResidualMacroChoice("player-1", freezeContext()),
    ],
  );

  assert.deepEqual(allKinds.result, [
    "upgradeNow",
    "refreshOnce",
    "freeze",
  ]);
  assert.deepEqual(allKinds.diagnostics.byKind, {
    upgrade: { decisions: 1, overridesApplied: 1 },
    refresh: { decisions: 1, overridesApplied: 1 },
    freeze: { decisions: 1, overridesApplied: 1 },
  });
});

test("is deterministic and isolates providers by seat", () => {
  let calls = 0;
  const deterministicProvider = provider(() => {
    calls += 1;
    return {
      kind: "upgrade",
      choice: "upgradeNow",
      confidence: 0.95,
      reasonCode: "stable-choice",
    };
  });
  const run = () =>
    withAiResidualPolicyOverrides(
      new Map([["player-3", deterministicProvider]]),
      () => ({
        selectedEnabled: hasAiResidualPolicyOverride("player-3"),
        otherEnabled: hasAiResidualPolicyOverride("player-4"),
        selected: resolveAiResidualMacroChoice("player-3", upgradeContext()),
        otherSeat: resolveAiResidualMacroChoice("player-4", upgradeContext()),
      }),
    );

  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.deepEqual(first.result, {
    selectedEnabled: true,
    otherEnabled: false,
    selected: "upgradeNow",
    otherSeat: "deferUpgrade",
  });
  assert.equal(first.diagnostics.noProvider, 1);
  assert.equal(first.diagnostics.providerCalls, 1);
  assert.equal(calls, 2);
  assert.equal(hasAiResidualPolicyOverride("player-3"), false);

  assert.equal(
    resolveAiResidualMacroChoice("player-3", upgradeContext()),
    "deferUpgrade",
    "providers must not leak outside their synchronous scope",
  );
});

test("deep-clones and deep-freezes provider context and diagnostics", () => {
  const original = upgradeContext();
  let received: AiResidualMacroContext | undefined;
  const run = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-2",
        provider((context) => {
          received = context as AiResidualMacroContext;
          assert.ok(Object.isFrozen(context));
          assert.ok(Object.isFrozen(context.legalChoices));
          assert.throws(() => {
            (context.legalChoices as string[]).push("upgradeNow");
          }, TypeError);
          return null;
        }),
      ],
    ]),
    () => resolveAiResidualMacroChoice("player-2", original),
  );

  assert.notEqual(received, original);
  assert.notEqual(received?.legalChoices, original.legalChoices);
  assert.equal(Object.isFrozen(original), false);
  assert.equal(Object.isFrozen(original.legalChoices), false);
  assert.ok(Object.isFrozen(run));
  assert.ok(Object.isFrozen(run.diagnostics));
  assert.ok(Object.isFrozen(run.diagnostics.byKind));
  assert.ok(Object.isFrozen(run.diagnostics.byKind.upgrade));
  assert.throws(() => {
    (run.diagnostics as { decisions: number }).decisions = 999;
  }, TypeError);
});

test("atomically falls back for all provider failure modes", () => {
  const asyncProvider = provider(
    (() =>
      Promise.resolve({
        kind: "upgrade",
        choice: "upgradeNow",
        confidence: 1,
        reasonCode: "too-late",
      })) as unknown as AiResidualPolicy["propose"],
    "async-provider",
  );
  const result = withAiResidualPolicyOverrides(
    new Map([
      ["player-1", provider(() => null, "abstain")],
      [
        "player-2",
        provider(
          () => ({
            kind: "upgrade",
            choice: "upgradeNow",
            confidence: 0.8999,
            reasonCode: "not-sure",
          }),
          "low-confidence",
        ),
      ],
      [
        "player-3",
        provider(
          (() => ({
            kind: "upgrade",
            choice: "not-legal",
            confidence: 1,
            reasonCode: "invalid-choice",
          })) as unknown as AiResidualPolicy["propose"],
          "invalid",
        ),
      ],
      [
        "player-4",
        provider(() => {
          throw new Error("provider failed");
        }, "throws"),
      ],
      ["player-5", asyncProvider],
      [
        "player-6",
        provider(
          () => ({
            kind: "upgrade",
            choice: "deferUpgrade",
            confidence: 1,
            reasonCode: "legacy-agrees",
          }),
          "agreement",
        ),
      ],
    ]),
    () =>
      ["player-0", "player-1", "player-2", "player-3", "player-4", "player-5", "player-6"].map(
        (playerId) =>
          resolveAiResidualMacroChoice(playerId, upgradeContext()),
      ),
  );

  assert.deepEqual(result.result, Array(7).fill("deferUpgrade"));
  assert.deepEqual(
    {
      decisions: result.diagnostics.decisions,
      providerCalls: result.diagnostics.providerCalls,
      overridesApplied: result.diagnostics.overridesApplied,
      fallbacks: result.diagnostics.fallbacks,
      noProvider: result.diagnostics.noProvider,
      abstentions: result.diagnostics.abstentions,
      lowConfidence: result.diagnostics.lowConfidence,
      invalidProposals: result.diagnostics.invalidProposals,
      providerErrors: result.diagnostics.providerErrors,
      asyncProposals: result.diagnostics.asyncProposals,
      agreements: result.diagnostics.agreements,
    },
    {
      decisions: 7,
      providerCalls: 6,
      overridesApplied: 0,
      fallbacks: 7,
      noProvider: 1,
      abstentions: 1,
      lowConfidence: 1,
      invalidProposals: 1,
      providerErrors: 1,
      asyncProposals: 1,
      agreements: 1,
    },
  );
});

test("snapshots dynamic proposals before validating the hard mask", () => {
  let choiceReads = 0;
  const dynamicProposal = new Proxy(
    {
      kind: "refresh",
      choice: "stopRefreshing",
      confidence: 1,
      reasonCode: "dynamic-choice",
    },
    {
      getOwnPropertyDescriptor(target, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (property !== "choice" || descriptor === undefined) {
          return descriptor;
        }
        choiceReads += 1;
        return {
          ...descriptor,
          value:
            choiceReads === 1 ? "stopRefreshing" : "refreshOnce",
        };
      },
    },
  );
  const context = {
    ...refreshContext(),
    legacyChoice: "stopRefreshing",
    legalChoices: ["stopRefreshing"],
  } as AiRefreshMacroContext;

  const result = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        provider(
          () => dynamicProposal as AiResidualPolicyProposal,
          "dynamic-proposal",
        ),
      ],
    ]),
    () => resolveAiResidualMacroChoice("player-1", context),
  );

  assert.equal(result.result, "stopRefreshing");
  assert.equal(choiceReads, 1);
  assert.equal(result.diagnostics.overridesApplied, 0);
  assert.equal(result.diagnostics.agreements, 1);
  assert.equal(result.diagnostics.invalidProposals, 0);
});

test("snapshots context before choosing the validated legacy fallback", () => {
  let legacyChoiceReads = 0;
  const target = upgradeContext({
    legacyChoice: "deferUpgrade",
    legalChoices: ["deferUpgrade"],
  });
  const dynamicContext = new Proxy(target, {
    get(original, property, receiver) {
      if (property === "legacyChoice") {
        legacyChoiceReads += 1;
        return "upgradeNow";
      }
      return Reflect.get(original, property, receiver);
    },
  });

  const result = withAiResidualPolicyOverrides(
    new Map([["player-1", provider(() => null, "context-snapshot")]]),
    () => resolveAiResidualMacroChoice("player-1", dynamicContext),
  );

  assert.equal(result.result, "deferUpgrade");
  assert.equal(legacyChoiceReads, 0);
  assert.equal(result.diagnostics.abstentions, 1);
  assert.equal(result.diagnostics.invalidContexts, 0);
});

test("rejects invalid contexts before calling a provider", () => {
  let calls = 0;
  const invalidVersion = {
    ...upgradeContext(),
    contextVersion: 1,
  } as unknown as AiUpgradeMacroContext;
  const nonFinite = {
    ...upgradeContext(),
    bestShopScore: Number.POSITIVE_INFINITY,
  };
  const unknownPublicField = {
    ...upgradeContext(),
    opponentBoardStrength: 99,
  } as AiUpgradeMacroContext;
  const impossibleUpgradeMask = upgradeContext({
    tavernTier: 6,
    gold: 0,
    legalChoices: ["upgradeNow", "deferUpgrade"],
  });
  const unsafeRefreshMask = refreshContext({
    healthSpendSafe: false,
    legalChoices: ["refreshOnce", "stopRefreshing"],
  });
  const result = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        provider(() => {
          calls += 1;
          return null;
        }),
      ],
    ]),
    () => [
      resolveAiResidualMacroChoice("player-1", invalidVersion),
      resolveAiResidualMacroChoice("player-1", nonFinite),
      resolveAiResidualMacroChoice("player-1", unknownPublicField),
      resolveAiResidualMacroChoice("player-1", impossibleUpgradeMask),
      resolveAiResidualMacroChoice("player-1", unsafeRefreshMask),
    ],
  );

  assert.deepEqual(result.result, [
    "deferUpgrade",
    "deferUpgrade",
    "deferUpgrade",
    "deferUpgrade",
    "stopRefreshing",
  ]);
  assert.equal(calls, 0);
  assert.equal(result.diagnostics.invalidContexts, 5);
  assert.equal(result.diagnostics.providerCalls, 0);
  assert.equal(result.diagnostics.fallbacks, 5);
});

test("recursively rejects hidden-state keys and exposes JSON-safe public data", () => {
  for (const key of AI_RESIDUAL_FORBIDDEN_CONTEXT_KEYS) {
    assert.equal(isAiResidualForbiddenContextKey(key), true);
  }
  assert.equal(isAiResidualForbiddenContextKey("nestedInstanceId"), true);
  assert.equal(isAiResidualForbiddenContextKey("opponentPlayerId"), true);
  assert.equal(isAiResidualForbiddenContextKey("profileId"), false);

  let calls = 0;
  const nestedSecret = {
    ...upgradeContext(),
    publicExtension: {
      observations: [{ rngState: 12345 }],
    },
  } as AiUpgradeMacroContext;
  const rejected = withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        provider(() => {
          calls += 1;
          return null;
        }),
      ],
    ]),
    () => resolveAiResidualMacroChoice("player-1", nestedSecret),
  );
  assert.equal(rejected.result, "deferUpgrade");
  assert.equal(rejected.diagnostics.invalidContexts, 1);
  assert.equal(calls, 0);

  const observedKeys: string[] = [];
  withAiResidualPolicyOverrides(
    new Map([
      [
        "player-1",
        provider((context) => {
          const walk = (value: unknown): void => {
            if (value === null || typeof value !== "object") return;
            for (const [key, nested] of Object.entries(value)) {
              observedKeys.push(key);
              assert.equal(isAiResidualForbiddenContextKey(key), false);
              walk(nested);
            }
          };
          walk(JSON.parse(JSON.stringify(context)));
          return null;
        }),
      ],
    ]),
    () => resolveAiResidualMacroChoice("player-1", upgradeContext()),
  );
  assert.ok(observedKeys.includes("legacyChoice"));
  assert.ok(observedKeys.includes("legalChoices"));
});

test("rejects async callbacks and nested scopes, then restores the scope", async () => {
  const empty = new Map<string, AiResidualPolicy>();
  assert.throws(
    () =>
      withAiResidualPolicyOverrides(
        empty,
        (() => Promise.resolve("async")) as unknown as () => string,
      ),
    /must be synchronous/,
  );
  assert.throws(
    () =>
      withAiResidualPolicyOverrides(
        empty,
        (() => Promise.reject(new Error("async callback failed"))) as unknown as () => string,
      ),
    /must be synchronous/,
  );
  assert.throws(
    () =>
      withAiResidualPolicyOverrides(empty, () =>
        withAiResidualPolicyOverrides(empty, () => "nested"),
      ),
    /cannot be nested/,
  );
  assert.throws(
    () =>
      withAiResidualPolicyOverrides(empty, () => {
        throw new Error("callback failure");
      }),
    /callback failure/,
  );

  const restored = withAiResidualPolicyOverrides(empty, () => "restored");
  assert.equal(restored.result, "restored");
  const rejectingProvider = provider(
    (() =>
      Promise.reject(
        new Error("async proposal failed"),
      )) as unknown as AiResidualPolicy["propose"],
    "rejecting-async",
  );
  const rejectedProposal = withAiResidualPolicyOverrides(
    new Map([["player-1", rejectingProvider]]),
    () => resolveAiResidualMacroChoice("player-1", upgradeContext()),
  );
  assert.equal(rejectedProposal.result, "deferUpgrade");
  assert.equal(rejectedProposal.diagnostics.asyncProposals, 1);
  await new Promise<void>((resolve) => setImmediate(resolve));
});

test("rejects invalid seat keys at the scope boundary", () => {
  assert.throws(
    () =>
      withAiResidualPolicyOverrides(
        new Map([["opponent", provider(() => null)]]),
        () => undefined,
      ),
    /invalid residual policy seat/,
  );
});
