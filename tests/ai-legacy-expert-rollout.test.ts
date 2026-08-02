import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_STRATEGY_PROFILES,
} from "../lib/game/ai.ts";
import {
  AI_RESIDUAL_CONTEXT_VERSION,
  resolveAiResidualMacroChoice,
  withAiResidualPolicyOverrides,
  type AiFreezeMacroContext,
  type AiRefreshMacroContext,
  type AiResidualMacroContext,
  type AiUpgradeMacroContext,
} from "../lib/game/ai-residual-policy.ts";
import {
  AI_LEGACY_EXPERT_ROLLOUT_VERSION,
  createAiLegacyExpertRecorder,
  recordAiLegacyExpertBenchmark,
} from "../scripts/ai-legacy-expert-rollout.ts";
import { runAiBenchmark } from "../scripts/benchmark-ai.ts";

function upgradeContext(): AiUpgradeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "upgrade",
    contentVersion: "test-content-v1",
    policyVersion: "test-policy-v1",
    profileId: "balanced",
    round: 5,
    tavernTier: 3,
    health: 28,
    armor: 2,
    gold: 7,
    boardSize: 4,
    handSize: 2,
    legacyChoice: "deferUpgrade",
    legalChoices: ["upgradeNow", "deferUpgrade"],
    checkpoint: "opening",
    actionsTaken: 0,
    refreshesTaken: 0,
    upgradeCost: 6,
    targetBoardSize: 5,
    bestShopScore: 12,
    weakestBoardScore: 7,
    bestAffordableSpellScore: null,
  };
}

function refreshContext(): AiRefreshMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "refresh",
    contentVersion: "test-content-v1",
    policyVersion: "test-policy-v1",
    profileId: "tempo",
    round: 6,
    tavernTier: 4,
    health: 25,
    armor: 3,
    gold: 4,
    boardSize: 5,
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
    refreshLimit: 2,
    actionsTaken: 3,
    actionLimit: 50,
    minionPurchaseCost: 3,
    canBuyAfterRefresh: true,
    canSpeculativelyRefresh: false,
    goldAfterRefresh: 3,
    effectiveHealthAfterRefresh: 28,
    healthSpendFloor: 10,
    targetBoardSize: 6,
  };
}

function freezeContext(): AiFreezeMacroContext {
  return {
    contextVersion: AI_RESIDUAL_CONTEXT_VERSION,
    kind: "freeze",
    contentVersion: "test-content-v1",
    policyVersion: "test-policy-v1",
    profileId: "triple",
    round: 7,
    tavernTier: 4,
    health: 22,
    armor: 0,
    gold: 0,
    boardSize: 7,
    handSize: 3,
    legacyChoice: "freeze",
    legalChoices: ["freeze", "unfreeze"],
    currentlyFrozen: false,
    bestMinionScore: 14,
    bestSpellScore: 5,
    bestTripleProgress: 2,
    remainingMinionPurchaseCost: 3,
    handFull: false,
    freezePairCount: 1,
    minionScoreThreshold: 13,
    spellScoreThreshold: 8,
    freezeMinionReason: true,
    freezeSpellReason: false,
    unspentGold: 0,
  };
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value as Record<string, unknown>).forEach(assertDeepFrozen);
}

const FORBIDDEN_KEYS = new Set([
  "seed",
  "seeds",
  "startseed",
  "rngstate",
  "pool",
  "shoppool",
  "spellpool",
  "instanceid",
  "interactionid",
  "playerid",
  "humanplayerid",
  "nextinstanceid",
  "nextinteractionid",
]);

function assertNoRuntimeKeys(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(assertNoRuntimeKeys);
    return;
  }
  for (const [key, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const normalized = key.toLowerCase();
    assert.equal(FORBIDDEN_KEYS.has(normalized), false, key);
    assert.equal(normalized.endsWith("instanceid"), false, key);
    assert.equal(normalized.endsWith("interactionid"), false, key);
    assert.equal(normalized.endsWith("playerid"), false, key);
    assertNoRuntimeKeys(child);
  }
}

test("legacy recorder retains validated frozen contexts and always abstains", () => {
  const recorder = createAiLegacyExpertRecorder();
  const contexts: AiResidualMacroContext[] = [
    upgradeContext(),
    refreshContext(),
    freezeContext(),
  ];
  const run = withAiResidualPolicyOverrides(
    new Map([["player-1", recorder.provider]]),
    () =>
      contexts.map((context) => {
        switch (context.kind) {
          case "upgrade":
            return resolveAiResidualMacroChoice("player-1", context);
          case "refresh":
            return resolveAiResidualMacroChoice("player-1", context);
          case "freeze":
            return resolveAiResidualMacroChoice("player-1", context);
        }
      }),
  );

  assert.deepEqual(
    run.result,
    contexts.map((context) => context.legacyChoice),
  );
  assert.equal(run.diagnostics.decisions, 3);
  assert.equal(run.diagnostics.providerCalls, 3);
  assert.equal(run.diagnostics.abstentions, 3);
  assert.equal(run.diagnostics.fallbacks, 3);
  assert.equal(run.diagnostics.overridesApplied, 0);
  assert.equal(run.diagnostics.providerErrors, 0);

  const snapshot = recorder.snapshot();
  assert.deepEqual(
    snapshot.samples.map((sample) => sample.kind),
    ["upgrade", "refresh", "freeze"],
  );
  assert.equal(snapshot.observedSamples, 3);
  assert.equal(snapshot.droppedSamples, 0);
  for (const sample of snapshot.samples) {
    assert.ok(sample.legalChoices.includes(sample.legacyChoice as never));
  }
  assertDeepFrozen(snapshot);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);

  recorder.clear();
  assert.deepEqual(recorder.snapshot(), {
    maxSamplesPerProfileKind: null,
    observedSamples: 0,
    droppedSamples: 0,
    observedByKind: { upgrade: 0, refresh: 0, freeze: 0 },
    observedByProfile: {},
    samples: [],
  });
});

test("per-profile-kind caps bound data without prefix biasing other buckets", () => {
  const recorder = createAiLegacyExpertRecorder({
    maxSamplesPerProfileKind: 1,
  });
  const contexts = [
    upgradeContext(),
    { ...upgradeContext(), round: 6 },
    refreshContext(),
    freezeContext(),
  ] as const;
  const run = withAiResidualPolicyOverrides(
    new Map([["player-1", recorder.provider]]),
    () => {
      for (const context of contexts) {
        switch (context.kind) {
          case "upgrade":
            assert.equal(
              resolveAiResidualMacroChoice("player-1", context),
              context.legacyChoice,
            );
            break;
          case "refresh":
            assert.equal(
              resolveAiResidualMacroChoice("player-1", context),
              context.legacyChoice,
            );
            break;
          case "freeze":
            assert.equal(
              resolveAiResidualMacroChoice("player-1", context),
              context.legacyChoice,
            );
            break;
        }
      }
    },
  );
  const snapshot = recorder.snapshot();

  assert.equal(snapshot.maxSamplesPerProfileKind, 1);
  assert.equal(snapshot.observedSamples, 4);
  assert.equal(snapshot.samples.length, 3);
  assert.equal(snapshot.droppedSamples, 1);
  assert.deepEqual(snapshot.observedByKind, {
    upgrade: 2,
    refresh: 1,
    freeze: 1,
  });
  assert.deepEqual(
    snapshot.samples.map((sample) => [sample.profileId, sample.kind]),
    [
      ["balanced", "upgrade"],
      ["tempo", "refresh"],
      ["triple", "freeze"],
    ],
  );
  assert.equal(run.diagnostics.abstentions, 4);
  assert.equal(run.diagnostics.overridesApplied, 0);
  assert.throws(
    () =>
      createAiLegacyExpertRecorder({ maxSamplesPerProfileKind: -1 }),
    RangeError,
  );
});

test("recorded benchmark is deterministic, private, and identical to direct legacy", () => {
  const options = {
    seeds: 1,
    startSeed: 0x5e01,
    maxRounds: 1,
  } as const;
  const direct = runAiBenchmark(options);
  const first = recordAiLegacyExpertBenchmark(options);
  const second = recordAiLegacyExpertBenchmark(options);

  assert.deepEqual(first.benchmark, direct);
  assert.deepEqual(second.benchmark, direct);
  assert.equal(first.bundle.bundleSha256, second.bundle.bundleSha256);
  assert.deepEqual(first.bundle.samples, second.bundle.samples);
  assert.match(first.bundle.bundleSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    first.bundle.schemaVersion,
    AI_LEGACY_EXPERT_ROLLOUT_VERSION,
  );
  assert.equal(first.bundle.contentVersion, direct.contentVersion);
  assert.equal(first.bundle.policyVersion, direct.policyVersion);
  assert.deepEqual(
    first.bundle.profileIds,
    AI_STRATEGY_PROFILES.map((profile) => profile.id),
  );
  for (const profileId of first.bundle.profileIds) {
    assert.ok(
      first.bundle.counts.observedByProfile[profileId] > 0,
      profileId,
    );
  }
  for (const kind of ["upgrade", "refresh", "freeze"] as const) {
    assert.ok(first.bundle.counts.retainedByKind[kind] > 0, kind);
  }
  assert.deepEqual(
    first.bundle.counts.observedByKind,
    first.bundle.counts.retainedByKind,
  );
  for (const sample of first.bundle.samples) {
    assert.ok(sample.legalChoices.includes(sample.legacyChoice as never));
  }

  const diagnostics = first.diagnostics;
  assert.ok(diagnostics.decisions > 0);
  assert.equal(diagnostics.decisions, diagnostics.providerCalls);
  assert.equal(diagnostics.providerCalls, diagnostics.abstentions);
  assert.equal(diagnostics.fallbacks, diagnostics.abstentions);
  assert.equal(diagnostics.overridesApplied, 0);
  assert.equal(diagnostics.noProvider, 0);
  assert.equal(diagnostics.lowConfidence, 0);
  assert.equal(diagnostics.invalidContexts, 0);
  assert.equal(diagnostics.invalidProposals, 0);
  assert.equal(diagnostics.providerErrors, 0);
  assert.equal(diagnostics.asyncProposals, 0);
  assert.equal(diagnostics.agreements, 0);

  assertDeepFrozen(first.bundle);
  assertDeepFrozen(first.benchmark);
  assertNoRuntimeKeys(first.bundle);
  assert.deepEqual(JSON.parse(JSON.stringify(first.bundle)), first.bundle);
  const serialized = JSON.stringify(first.bundle);
  assert.equal(serialized.includes("player-0"), false);
  assert.equal(serialized.includes("startSeed"), false);
  assert.equal(serialized.includes('"seed"'), false);
  assert.equal(serialized.includes('"seeds"'), false);

  assert.throws(
    () =>
      recordAiLegacyExpertBenchmark({
        ...options,
        profileOverrides: new Map(),
      } as never),
    /does not accept profileOverrides/,
  );

  const emptyShort = recordAiLegacyExpertBenchmark({
    ...options,
    maxSamplesPerProfileKind: 0,
  });
  const emptyLong = recordAiLegacyExpertBenchmark({
    ...options,
    maxRounds: 2,
    maxSamplesPerProfileKind: 0,
  });
  assert.equal(emptyShort.bundle.samples.length, 0);
  assert.equal(emptyLong.bundle.samples.length, 0);
  assert.notEqual(
    emptyShort.bundle.counts.observedSamples,
    emptyLong.bundle.counts.observedSamples,
  );
  assert.notEqual(
    emptyShort.bundle.bundleSha256,
    emptyLong.bundle.bundleSha256,
  );
});
