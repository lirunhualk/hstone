import { createHash } from "node:crypto";

import { canonicalHistoricalJsonV1 as canonicalAiPolicyEvolutionJson } from "./ai-historical-canonical-json-v1.ts";

export const AI_COOPERATIVE_CEM_TRAINING_RESULT_FORMAT_VERSION = 1 as const;

const AI_COOPERATIVE_CEM_TRAINING_RESULT_PAYLOAD = {
  formatVersion: AI_COOPERATIVE_CEM_TRAINING_RESULT_FORMAT_VERSION,
  resultRegistrationId:
    "cooperative-cem-power-level-training-result-93010001-v1",
  registrationId: "cooperative-cem-power-level-v1",
  method: "single-focus-cooperative-categorical-cem-v1",
  status: "completed-selection-pending",
  reservation: {
    id: "cooperative-cem-power-level-training-93010001-v1",
    mode: "cooperative-cem-training",
    confirmation: "run-registered-cooperative-cem-power-level-v1",
  },
  trainingSeeds: {
    startSeed: 93_010_001,
    seeds: 8,
    endSeed: 93_010_008,
    dispositionAfterRun: "consumed",
    consumedLedgerEntryId:
      "cooperative-cem-power-level-training-93010001-consumed-v1",
    retirementReason:
      "completed-registered-training-artifact-21cd6816bf562c12e0a2b313a58fd77368c074921521acb7f580b53378c0f8b8",
  },
  archivedSource: {
    repositoryBaseCommit: "3deb633ade5e06272da335f49037bcd5665f9ef2",
    snapshotKind: "canonical-source-bundle",
    note: "the pinned implementation was uncommitted; all 42 hashed sources and both literal anchors are embedded in the evidence bundle",
  },
  archive: {
    directory:
      "evidence/ai-cooperative-cem/power-level-v1-93010001",
    bundleFilename: "training-evidence-v1.json.gz",
    manifestFilename: "manifest.json",
    compression: "gzip-level-9-mtime-0",
    canonicalJson: "canonical-ai-policy-evolution-json-v1",
    uncompressedBytes: 34_964_659,
    compressedBytes: 1_509_477,
    bundlePayloadSha256:
      "a391f271f15afd0946bde35a1599080adb1166aeabf940af39b58008e7e9ce1b",
    bundleBlobSha256:
      "af2b63510891f78e7d61877d7ae2f49add6789ea9b1a1694f521736093ca2465",
    manifestSha256:
      "38eb37d9eb7ad6993eb52a00b0b826dad68e63465f77a9224dc7ae52455b1a5f",
    archivedImplementationSourceFiles: 42,
    archivedLiteralAnchorFiles: 2,
  },
  evidence: {
    artifactHash:
      "21cd6816bf562c12e0a2b313a58fd77368c074921521acb7f580b53378c0f8b8",
    protocolSha256:
      "875b635dab585be70c75f576294806069b048ea39709f6d849debf29ad4f512d",
    implementationSha256:
      "11afa8ce77a348397ef984eef92a72d27a25b999834ad2e9dc0476054f8ecd88",
    registeredRunMarkerHash:
      "ee0f2d47e14a5deb51811edfe973708ba3c261f06ad68d30152cd24278e9faaf",
    evolutionArtifactHash:
      "10a6a388050577bb548f5d39b0d3318e89bab57a675412ded319a511c9ffaee0",
    executionKind: "registered",
    registeredResumeMode: "none",
    cachedCandidateCount: 0,
    freshCandidateCount: 32,
    trainingEvidenceUsable: true,
    selectionScreenEligible: true,
    checkpointFormatVersion: 1,
    checkpointHashes: [
      "291f8cecc03d086abd828f0a4afbf2815b3861a354630fc8dbaa28fc30f3135c",
      "0e3dfab68007ad77405e615319f996e5065845cfaaa62568b53a7597965ef81d",
      "4c575dffd16e8d0f1ef7dfde82ce6953537eed21a90c053af088e01ad8597812",
      "0253db1cf971a7a7c244dc6a13fb75c277971ca68c2bdfc4b20334af9fc25f34",
      "42e0f4995baf918184372cbe0c276973199f06f45ddc9ba202d67b10eb11760d",
      "2a7a5c17aeb7fb9e6d3058a621f8d71242be7ab55f1670848f1ece3c4468773a",
      "1fab654632c6643dbdf6ff6448634f953ce601441aaf11cfcc52a60431eac24f",
      "559565ca4172189ccd8fc0fddad2efc7a253593815cc88105ddcd0f1cfba602a",
      "ff27377535b5f0585b97b1a41b3b8475e2e10bd7076c76b23fc3eccc82000bcd",
      "49964632ee30843fe522ea205604fe512a35ae33d4b8fdc13195b22ccde9277f",
      "6b429f29fe1a48118fd762b46579a8884686cb411d87e0ddce3bbda91dd6417c",
      "94d6be3dda0dbc83af334586e2d851d06b4bc20ba2ce01ef5c148a1b626f44e1",
      "6863267373c5689b8d5f7b36633f1b9c8ce223dedfded9989ed82ddc6aa6995b",
      "e96d0e385e587b05a0f292136a0cc888d14dc039e11c2e6c9b64ebfbca9bd9b5",
      "b8e09d7c2bd5f878977f3af924b6f8720c8eb26d8e849b2bb5c88702e6532869",
      "9c64dd0cb0a0bfda76696e79c36472b76cb1ebab45b339b3151bc140bd820eff",
      "e7f1798d80511983969d9e9c9d79d14213220798ef27b835a6f87c19cf8868f0",
      "f84ae7a120d67e666ca936035cebb93c4955e9a25c27dafe11fb10e5680cfa6a",
      "d1dcf0b3795ce507f77057897216a51584eedff6091beaf86442ec9400947795",
      "f8bdd88e920dba60c1c010902e1c6e81c1cb6611682e85d34deb5968d802be5d",
      "e6a0d69c59679a62f705dbb781576339e61909128fcfad1f4fbb1989a6248d99",
      "b6f92ce3c5741978bd264def0b8cae6abf42247280251a0f9a1e141c9be4e98c",
      "34fa72e02bcfaaa7fb25da7f1eee6b4349d47d30b708e93ef23b25b23b6e6eef",
      "8bf9e8e741025f6b1abf1e1872c82f1cd48e76c52dc0250d39a35c734e3a4fe7",
      "82ca5204e0e84b4771e335df169baeeb62c0789852c4875b9617c88b4d460bbf",
      "b3bd6f2dc50bb3c13737eaf0109dbc8fde4cb7d4125103c36f6f4d0adc7385e6",
      "d8e33728900a4613e463c8519026fd562296b2255ae034b002a267cd50c4c9e1",
      "c865b43e08a40a0b544cd0e7762a8c59d9ecd12b15b542f6b0c19c50395523ab",
      "e7d68f72f7f364f2326888f1d3ce1c676274d3f9775ebaf0e61018f61ed3ae5e",
      "9d776ed105728f5644b15f09aa60171199fa7222ea02387efd24355c830ddfc3",
      "7dfd8517ffc3e01751dab00f482a7cffd3c326e504a297bc1e0d342a3c8db3ba",
      "f6f5987d1ed419e24f11ce883ce0f93587f9ba839a7ab5182aa2bd229f44c611",
    ],
    policyVersion: "video-strategy-v4-safe-recruit-health",
    contentVersion: "battlegrounds-36.0.3-247416-v52",
    contentSnapshotSha256:
      "54749567d46e76bb73bdc0253fd48754f6a3223101bac4a152bd2e90d634d97c",
    evaluatorHash:
      "a297f431dadf32e6626c876ccd3390fd8830e7fb9cc1f2bfe8a5084863eec7aa",
    strategyProfileHash:
      "93d9b2524ac63c9468c91b64ddc988d164dad846e5180fa86494b6f2e4cca2d9",
    completedRunsPerCandidate: 256,
    expectedPairsPerCandidate: 896,
    runnerFailureCount: 0,
    truncatedRuns: 0,
    missingPairs: 0,
    providerErrorTotal: 0,
  },
  selected: {
    candidateId: "cooperative-cem-power-level-v1-g0003-c0000-83a9c758b795",
    checkpointSequenceIndex: 24,
    checkpointHash:
      "82ca5204e0e84b4771e335df169baeeb62c0789852c4875b9617c88b4d460bbf",
    checkpointCanonicalSha256:
      "22fd8deaf1a4ff7a2948e4b4cac7f84abd31a4a1af00654fe8d3fa31620d32c4",
    evaluationRecordHash:
      "a21f7e15a2e1d46562fecc8394bc0927742db5e465d4000ea8250119d7237363",
    genome: {
      upgradeRoundOffset: -1,
      minimumUpgradeHealth: 14,
      replacementMargin: 3.5,
      maxRefreshes: 2,
    },
    candidateProfileHash:
      "b74a7e3ee4b7165d18426ef6618f85d039f5e0dfb45de0acb1248396fc82751a",
    rawResultSha256:
      "dbcbd3e7abd7c6653e5512141e9e61a2d13587370c4c469f5351c6bfa439c070",
    feasible: true,
    score: 1_000_016.13504464,
    overall: {
      placementMeanDelta: -0.00223214,
      placementConfidence95: [-0.02325373, 0.01878945],
      topFourMeanDelta: 0.00669643,
      winMeanDelta: 0,
    },
    focusPowerLevel: {
      placementMeanDelta: -0.15625,
      placementConfidence95: [-0.38318638, 0.07068638],
      topFourMeanDelta: 0.03125,
      winMeanDelta: 0.0390625,
    },
    benchmarkPromotionAccepted: false,
  },
  nextPhases: {
    independentSelection: {
      startSeed: 93_100_001,
      seeds: 24,
      endSeed: 93_100_024,
      disposition: "sealed",
    },
    rosterFinal: {
      startSeed: 93_200_001,
      seeds: 96,
      endSeed: 93_200_096,
      disposition: "sealed",
    },
  },
  production: {
    policyVersion: "video-strategy-v4-safe-recruit-health",
    promoted: false,
  },
} as const;

export const AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256 =
  "11dcd989e16b8eef0679b65e4cf0517bdc73e1c937097eb3fc3ffaed74151b7c" as const;

export function computeAiCooperativeCemTrainingResultSha256(
  value: unknown = AI_COOPERATIVE_CEM_TRAINING_RESULT_PAYLOAD,
): string {
  return createHash("sha256")
    .update(canonicalAiPolicyEvolutionJson(value))
    .digest("hex");
}

const computedTrainingResultSha256 =
  computeAiCooperativeCemTrainingResultSha256();
if (
  computedTrainingResultSha256 !==
  AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256
) {
  throw new Error(
    `cooperative CEM training result drifted: expected ${AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256}, received ${computedTrainingResultSha256}`,
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const AI_COOPERATIVE_CEM_TRAINING_RESULT = deepFreeze({
  ...AI_COOPERATIVE_CEM_TRAINING_RESULT_PAYLOAD,
  resultSha256: AI_COOPERATIVE_CEM_PINNED_TRAINING_RESULT_SHA256,
});
