import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORICAL_CEM_PROBABILITY_DECIMALS,
  DEFAULT_POWER_LEVEL_GENE_SCHEMA,
  assertValidAiPolicyEvolutionArtifact,
  canonicalAiPolicyEvolutionJson,
  computeAiPolicyEvolutionArtifactHash,
  createUniformCategoricalDistribution,
  runCategoricalCem,
  updateCategoricalDistribution,
  type AiPolicyEvolutionArtifact,
  type PolicyGenome,
} from "../scripts/ai-policy-evolution.ts";

const INITIAL_POWER_LEVEL_GENOME: PolicyGenome = {
  upgradeRoundOffset: 0,
  minimumUpgradeHealth: 14,
  replacementMargin: 3,
  maxRefreshes: 3,
};

function scorePowerLevelGenome(candidate: {
  genome: PolicyGenome;
}): number {
  const genome = candidate.genome;
  return (
    -Math.abs(genome.upgradeRoundOffset - 1) * 20 -
    Math.abs(genome.minimumUpgradeHealth - 16) * 3 -
    Math.abs(genome.replacementMargin - 3.5) * 5 -
    Math.abs(genome.maxRefreshes - 4) * 2
  );
}

function runExample(seed = 0x1234_5678): AiPolicyEvolutionArtifact {
  return runCategoricalCem({
    seed,
    generations: 4,
    populationSize: 12,
    initialIncumbent: INITIAL_POWER_LEVEL_GENOME,
    evaluate: scorePowerLevelGenome,
  });
}

test("default powerLevel schema exposes the four finite categorical genes", () => {
  assert.deepEqual(DEFAULT_POWER_LEVEL_GENE_SCHEMA, [
    { name: "upgradeRoundOffset", values: [-1, 0, 1] },
    { name: "minimumUpgradeHealth", values: [10, 12, 14, 16, 18] },
    { name: "replacementMargin", values: [2, 2.5, 3, 3.5, 4] },
    { name: "maxRefreshes", values: [1, 2, 3, 4, 5] },
  ]);
  for (const definition of DEFAULT_POWER_LEVEL_GENE_SCHEMA) {
    assert.ok(definition.values.every(Number.isFinite));
  }
});

test("categorical CEM is deterministic for the same seed and inputs", () => {
  const first = runExample();
  const second = runExample();
  assert.deepEqual(first, second);
  assert.equal(first.artifactHash, second.artifactHash);
  assertValidAiPolicyEvolutionArtifact(first);
  assert.notDeepEqual(runExample(0x1234_5679).trajectory, first.trajectory);
});

test("configuration, gene, score, and categorical boundaries fail closed", () => {
  const base = {
    seed: 1,
    generations: 1,
    populationSize: 4,
    initialIncumbent: INITIAL_POWER_LEVEL_GENOME,
    evaluate: scorePowerLevelGenome,
  };

  assert.throws(() => runCategoricalCem({ ...base, seed: 1.5 }), /seed.*integer/);
  assert.throws(
    () => runCategoricalCem({ ...base, generations: 0 }),
    /generations.*integer/,
  );
  assert.throws(
    () => runCategoricalCem({ ...base, populationSize: 1 }),
    /populationSize.*integer/,
  );
  assert.throws(
    () => runCategoricalCem({ ...base, populationSize: 2 }),
    /populationSize.*integer/,
  );
  assert.throws(
    () => runCategoricalCem({ ...base, smoothing: Number.NaN }),
    /smoothing.*finite/,
  );
  assert.throws(
    () => runCategoricalCem({ ...base, smoothing: 0 }),
    /smoothing.*\(0, 1\]/,
  );
  assert.throws(
    () => runCategoricalCem({ ...base, probabilityFloor: 0.2 }),
    /probabilityFloor.*less than/,
  );
  assert.throws(
    () =>
      runCategoricalCem({
        ...base,
        schema: [{ name: "bad", values: [0, Number.POSITIVE_INFINITY] }],
        populationSize: 2,
        initialIncumbent: { bad: 0 },
      }),
    /finite number/,
  );
  assert.throws(
    () =>
      runCategoricalCem({
        ...base,
        initialIncumbent: {
          ...INITIAL_POWER_LEVEL_GENOME,
          replacementMargin: 2.6,
        },
      }),
    /replacementMargin must be one of/,
  );
  assert.throws(
    () =>
      runCategoricalCem({
        ...base,
        evaluate: () => Number.NaN,
      }),
    /evaluation score.*finite/,
  );
});

test("sampled genomes remain on-grid and distributions are stably rounded", () => {
  const artifact = runExample();
  const scale = 10 ** CATEGORICAL_CEM_PROBABILITY_DECIMALS;

  for (const trace of artifact.trajectory) {
    for (const candidate of trace.sampledGenomes) {
      for (const definition of DEFAULT_POWER_LEVEL_GENE_SCHEMA) {
        assert.ok(
          (definition.values as readonly number[]).includes(
            candidate.genome[definition.name],
          ),
        );
      }
      assert.ok(Number.isInteger(candidate.genome.upgradeRoundOffset));
      assert.ok(Number.isInteger(candidate.genome.minimumUpgradeHealth));
      assert.ok(Number.isInteger(candidate.genome.maxRefreshes));
    }
    for (const probabilities of Object.values(trace.nextDistribution)) {
      assert.ok(
        Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) <
          1e-12,
      );
      for (const probability of probabilities) {
        assert.ok(Math.abs(probability * scale - Math.round(probability * scale)) < 1e-3);
      }
    }
  }
});

test("every generation samples unique genomes and globally unique candidate ids", () => {
  const artifact = runCategoricalCem({
    seed: 77,
    generations: 3,
    populationSize: 375,
    initialIncumbent: INITIAL_POWER_LEVEL_GENOME,
    evaluate: scorePowerLevelGenome,
  });
  const allIds = new Set<string>();

  for (const trace of artifact.trajectory) {
    const genomeKeys = trace.sampledGenomes.map((candidate) =>
      canonicalAiPolicyEvolutionJson(candidate.genome),
    );
    assert.equal(new Set(genomeKeys).size, trace.sampledGenomes.length);
    for (const candidate of trace.sampledGenomes) {
      assert.ok(!allIds.has(candidate.candidateId));
      allIds.add(candidate.candidateId);
    }
  }
});

test("the incumbent is retained exactly once and ties favor it", () => {
  const artifact = runCategoricalCem({
    seed: 99,
    generations: 3,
    populationSize: 8,
    initialIncumbent: INITIAL_POWER_LEVEL_GENOME,
    evaluate: () => 0,
  });
  let expected = INITIAL_POWER_LEVEL_GENOME;

  for (const trace of artifact.trajectory) {
    const retained = trace.sampledGenomes.filter(
      (candidate) => candidate.retainedIncumbent,
    );
    assert.equal(retained.length, 1);
    assert.deepEqual(retained[0].genome, expected);
    assert.equal(trace.incumbentCandidateId, retained[0].candidateId);
    expected = retained[0].genome;
  }
});

test("two elites update a smoothed distribution while respecting its floor", () => {
  const schema = [{ name: "choice", values: [0, 1, 2] }] as const;
  const parent = createUniformCategoricalDistribution(schema);
  const next = updateCategoricalDistribution(
    schema,
    parent,
    [{ choice: 2 }, { choice: 2 }],
    0.5,
    0.05,
  );

  assert.ok(next.choice[2] > parent.choice[2]);
  assert.ok(next.choice[0] < parent.choice[0]);
  assert.ok(next.choice.every((probability) => probability >= 0.05));
  assert.ok(
    Math.abs(next.choice.reduce((sum, probability) => sum + probability, 0) - 1) <
      1e-12,
  );
});

test("canonical hash binds the compact trajectory and detects tampering", () => {
  const artifact = runExample();
  assert.match(artifact.artifactHash, /^[0-9a-f]{64}$/);
  assert.equal(
    canonicalAiPolicyEvolutionJson({ z: [3, { b: 2, a: 1 }], a: true }),
    canonicalAiPolicyEvolutionJson({ a: true, z: [3, { a: 1, b: 2 }] }),
  );

  const tampered = structuredClone(artifact);
  tampered.trajectory[0].sampledGenomes[0].score += 1;
  assert.throws(
    () => assertValidAiPolicyEvolutionArtifact(tampered),
    /eliteCandidateIds|artifactHash does not match/,
  );

  const duplicateId = structuredClone(artifact);
  duplicateId.trajectory[0].sampledGenomes[1].candidateId =
    duplicateId.trajectory[0].sampledGenomes[0].candidateId;
  duplicateId.artifactHash = computeAiPolicyEvolutionArtifactHash(duplicateId);
  assert.throws(
    () => assertValidAiPolicyEvolutionArtifact(duplicateId),
    /duplicates another candidate id/,
  );

  const forgedId = structuredClone(artifact);
  const originalId = forgedId.trajectory[0].sampledGenomes[0].candidateId;
  forgedId.trajectory[0].sampledGenomes[0].candidateId = "forged";
  forgedId.trajectory[0].eliteCandidateIds = forgedId.trajectory[0].eliteCandidateIds.map(
    (candidateId) => (candidateId === originalId ? "forged" : candidateId),
  ) as [string, string];
  if (forgedId.trajectory[0].incumbentCandidateId === originalId) {
    forgedId.trajectory[0].incumbentCandidateId = "forged";
  }
  forgedId.artifactHash = computeAiPolicyEvolutionArtifactHash(forgedId);
  assert.throws(
    () => assertValidAiPolicyEvolutionArtifact(forgedId),
    /candidateId does not match its deterministic candidate/,
  );

  const forgedSeed = structuredClone(artifact);
  forgedSeed.config.seed += 1;
  forgedSeed.artifactHash = computeAiPolicyEvolutionArtifactHash(forgedSeed);
  assert.throws(
    () => assertValidAiPolicyEvolutionArtifact(forgedSeed),
    /genome does not match deterministic seed replay/,
  );
});
