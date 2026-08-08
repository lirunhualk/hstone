import { createHash } from "node:crypto";

import { canonicalHistoricalJsonV1 } from "./ai-historical-canonical-json-v1.ts";

export const AI_COOPERATIVE_CEM_SELECTION_RESULT_FORMAT_VERSION = 1 as const;

const AI_COOPERATIVE_CEM_SELECTION_RESULT_PAYLOAD = {
  formatVersion: AI_COOPERATIVE_CEM_SELECTION_RESULT_FORMAT_VERSION,
  resultRegistrationId:
    "cooperative-cem-power-level-selection-result-93100001-v1",
  registrationId: "cooperative-cem-power-level-selection-v1",
  method: "single-candidate-independent-selection-v1",
  status: "completed-gate-rejected",
  reservation: {
    id: "cooperative-cem-power-level-selection-93100001-v1",
    mode: "cooperative-cem-selection",
    confirmation: "run-registered-cooperative-cem-power-level-selection-v1",
  },
  selectionSeeds: {
    startSeed: 93_100_001,
    seeds: 24,
    endSeed: 93_100_024,
    dispositionAfterRun: "consumed",
    ledgerRegistrationStatus: "consumed",
    consumedLedgerEntryId:
      "cooperative-cem-power-level-selection-93100001-consumed-v1",
    retirementReason:
      "completed-registered-selection-gate-rejected-artifact-d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b",
  },
  archivedSource: {
    repositoryBaseCommit: "3deb633ade5e06272da335f49037bcd5665f9ef2",
    snapshotKind: "canonical-source-bundle",
    note: "the pinned selection implementation was uncommitted; all 49 hashed sources and both literal anchors are embedded in the evidence bundle",
  },
  archive: {
    directory:
      "evidence/ai-cooperative-cem-selection/power-level-selection-v1-93100001",
    bundleFilename: "selection-evidence-v1.json.gz",
    manifestFilename: "manifest.json",
    compression: "gzip-level-9-mtime-0",
    canonicalJson: "canonical-ai-policy-evolution-json-v1",
    uncompressedBytes: 5_491_940,
    compressedBytes: 522_137,
    bundlePayloadSha256:
      "cffdb55a3d19404f03c5d0a1dd832c8dd824536714995ccaeb88e87db8a8391b",
    bundleBlobSha256:
      "211cd71dbc2f363ffc77b5d329d3f056c03e891c941f5fc29542cae219f76973",
    manifestFileBytes: 12_671,
    manifestFileSha256:
      "1b85c47f8b14ba15cfe593dd06a2ba6680f1033e2bb7690d0a3d38754db4d310",
    archivedImplementationSourceFiles: 49,
    archivedLiteralAnchorFiles: 2,
  },
  upstreamTraining: {
    resultRegistrationId:
      "cooperative-cem-power-level-training-result-93010001-v1",
    resultSha256:
      "11dcd989e16b8eef0679b65e4cf0517bdc73e1c937097eb3fc3ffaed74151b7c",
    protocolSha256:
      "875b635dab585be70c75f576294806069b048ea39709f6d849debf29ad4f512d",
    implementationSha256:
      "11afa8ce77a348397ef984eef92a72d27a25b999834ad2e9dc0476054f8ecd88",
    evaluatorHash:
      "a297f431dadf32e6626c876ccd3390fd8830e7fb9cc1f2bfe8a5084863eec7aa",
    artifactHash:
      "21cd6816bf562c12e0a2b313a58fd77368c074921521acb7f580b53378c0f8b8",
    runMarkerHash:
      "ee0f2d47e14a5deb51811edfe973708ba3c261f06ad68d30152cd24278e9faaf",
    selectedEvaluationRecordHash:
      "a21f7e15a2e1d46562fecc8394bc0927742db5e465d4000ea8250119d7237363",
    selectedRawResultSha256:
      "dbcbd3e7abd7c6653e5512141e9e61a2d13587370c4c469f5351c6bfa439c070",
    bundlePayloadSha256:
      "a391f271f15afd0946bde35a1599080adb1166aeabf940af39b58008e7e9ce1b",
    bundleBlobSha256:
      "af2b63510891f78e7d61877d7ae2f49add6789ea9b1a1694f521736093ca2465",
    manifestSha256:
      "38eb37d9eb7ad6993eb52a00b0b826dad68e63465f77a9224dc7ae52455b1a5f",
  },
  evidence: {
    protocolSha256:
      "5b787b14590f9438f6774732dd02b7464d381b7f752442b12e5c09ca2281f1f3",
    implementationSha256:
      "17bfbb298f9ffc2a5b5f217cb8ec188b6bbb0e725386bba87303f705f9646383",
    evaluatorHash:
      "4b3c11d3c3c109451f3d142e9263a92ec48ecfd56f07714fd545a1f8c8ff9468",
    registeredRunMarkerHash:
      "b3c088b602a2094217601a8fc01d2df3ab6e0969da8110a739a6c8df779f6645",
    markerCanonicalSha256:
      "09bf387c33018446ddb47c52922c2e1e891e663d9c0226b69c1b09a9696446c1",
    markerFileBytes: 1_309,
    markerFileSha256:
      "e8f4883594650afe190da2e40acda1f5380eae11839431899e82dea8365bab23",
    checkpointHash:
      "47645dc8c269dbc46bc02fab4f7fb70bdd8af33d0ad82631b185cb6ef9f6d6e6",
    checkpointCanonicalSha256:
      "d7be27c7201126e93665b4edbf6949e65971ceffe22fdc0a0855ac55bfa30bbb",
    checkpointFileBytes: 2_982_144,
    checkpointFileSha256:
      "676370c511d060dfc767d3208956811d4c6bfe8c4a1730b525c6fb36147082b8",
    rawResultCanonicalBytes: 2_976_781,
    rawResultSha256:
      "6d661e2b5fdb0ae409a4349b7474c1d6f494d3d54280d54d2736b9f2fa697e88",
    artifactHash:
      "d3cfa2193d0ebcf9c3258591404a34596e83cb6b871b147d9105cf322001077b",
    artifactCanonicalSha256:
      "b693e85efb5b284212f23ee416ce721c21f12c5d4aac57b500819c54c9bfb1ad",
    artifactFileBytes: 5_570,
    artifactFileSha256:
      "2be0e4d5a7325b9368981471877318f853a5d760fe8cfba42d327e95c37ebb5c",
    gateCanonicalSha256:
      "e4706dc791aed1925db8bf9639d006cedd9a1149bfa2688a1db98263abddf715",
    executionKind: "registered",
  },
  candidate: {
    id: "cooperative-cem-power-level-v1-g0003-c0000-83a9c758b795",
    genome: {
      upgradeRoundOffset: -1,
      minimumUpgradeHealth: 14,
      replacementMargin: 3.5,
      maxRefreshes: 2,
    },
    candidateProfileHash:
      "b74a7e3ee4b7165d18426ef6618f85d039f5e0dfb45de0acb1248396fc82751a",
  },
  benchmark: {
    method: "paired-seven-profile-suite-v1",
    benchmarkVersion: 1,
    config: {
      controlPlayerId: "player-0",
      initialHealth: 40,
      maxRounds: 150,
      profileOverridesProvided: true,
      residualPolicyProvided: false,
      rotations: [0, 1, 2, 3, 4, 5, 6, 7],
      scenarioIds: ["neutral-v1", "live-lobby-v1"],
      scoredPlayerIds: [
        "player-1",
        "player-2",
        "player-3",
        "player-4",
        "player-5",
        "player-6",
        "player-7",
      ],
      seeds: 24,
      startSeed: 93_100_001,
    },
    provenance: {
      policyVersion: "video-strategy-v4-safe-recruit-health",
      policyVersionAfter: "video-strategy-v4-safe-recruit-health",
      policyVersionStable: true,
      contentVersion: "battlegrounds-36.0.3-247416-v52",
      contentSnapshotSha256:
        "54749567d46e76bb73bdc0253fd48754f6a3223101bac4a152bd2e90d634d97c",
      contentSnapshotSha256After:
        "54749567d46e76bb73bdc0253fd48754f6a3223101bac4a152bd2e90d634d97c",
      contentSnapshotStable: true,
      evaluatorHash:
        "4b3c11d3c3c109451f3d142e9263a92ec48ecfd56f07714fd545a1f8c8ff9468",
      evaluatorHashAfter:
        "4b3c11d3c3c109451f3d142e9263a92ec48ecfd56f07714fd545a1f8c8ff9468",
      evaluatorStable: true,
      strategyProfileHash:
        "93d9b2524ac63c9468c91b64ddc988d164dad846e5180fa86494b6f2e4cca2d9",
      strategyProfileHashAfter:
        "93d9b2524ac63c9468c91b64ddc988d164dad846e5180fa86494b6f2e4cca2d9",
      strategyProfilesStable: true,
      strategyProfilesCanonicalSha256:
        "132c893aa256867dde64e91eae36d30eb9392c4647add28dde58849d029c8ff6",
      candidateProfileHash:
        "b74a7e3ee4b7165d18426ef6618f85d039f5e0dfb45de0acb1248396fc82751a",
      candidateProfileHashAfter:
        "b74a7e3ee4b7165d18426ef6618f85d039f5e0dfb45de0acb1248396fc82751a",
      candidateProfilesStable: true,
      candidateProfilesCanonicalSha256:
        "271a1632ef7bf187783e86c67dab56a62c979baffe36e5ae6ca64f2c3b89f62a",
    },
    accounting: {
      clusterCount: 24,
      clusterStartSeed: 93_100_001,
      clusterEndSeed: 93_100_024,
      clusterSeedsContiguous: true,
      progress: {
        scheduledRuns: 768,
        processedRuns: 768,
        completedRuns: 768,
        failedRuns: 0,
      },
      expectedPairs: 2_688,
      pairedPairs: 2_688,
      missingPairs: 0,
      runnerFailureCount: 0,
      truncatedRuns: 0,
      providerErrorTotal: 0,
      providerDiagnosticsCanonicalSha256:
        "adaa377fb9a77fdaf4bd7a1a7231542498076a7f895e4ea947f0ba177f6d9ac7",
      comparisonMatrixCanonicalSha256:
        "08075cc31ab016603605a4a16fcaad369280fe6bff335f9df9d6c3ca92e9650e",
      clustersCanonicalSha256:
        "fcc62671c91a183ec72d95924f80cedcebb6889d1396f584d852fb6f980e3c00",
      evidenceUsable: true,
      evidenceReasons: [],
    },
    draw: {
      baselineDrawRate: 0,
      baselineDrawnGames: 0,
      candidateDrawRate: 0,
      candidateDrawnGames: 0,
      comparison: {
        confidence95: { lower: 0, upper: 0 },
        meanDelta: 0,
        nonInferiorityMargin: 0.01,
        pairedGames: 384,
        seedClusters: 24,
      },
    },
    genericPromotionGate: {
      accepted: false,
      reasons: [
        "mean placement delta must be at most -0.10",
        "placement CI upper bound must be below 0",
      ],
    },
    overall: {
      placement: {
        confidence95: { lower: -0.01652328, upper: 0.00833876 },
        meanDelta: -0.00409226,
        pairedSeats: 2_688,
        seedClusters: 24,
      },
      topFour: {
        confidence95: { lower: -0.0050209, upper: 0.00427686 },
        meanDelta: -0.00037202,
        pairedSeats: 2_688,
        seedClusters: 24,
      },
      win: {
        confidence95: { lower: 0.00148341, upper: 0.00521302 },
        meanDelta: 0.00334821,
        pairedSeats: 2_688,
        seedClusters: 24,
      },
    },
    byProfile: {
      balanced: {
        placement: {
          confidence95: { lower: -0.09529257, upper: 0.07966757 },
          meanDelta: -0.0078125,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.02335109, upper: 0.02335109 },
          meanDelta: 0,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.02082395, upper: 0.01561562 },
          meanDelta: -0.00260417,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
      deathrattle: {
        placement: {
          confidence95: { lower: -0.15280566, upper: 0.03301399 },
          meanDelta: -0.05989583,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.01906609, upper: 0.01906609 },
          meanDelta: 0,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.00305774, upper: 0.03951607 },
          meanDelta: 0.01822917,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
      economy: {
        placement: {
          confidence95: { lower: -0.17030943, upper: 0.0713511 },
          meanDelta: -0.04947917,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.01575209, upper: 0.04700209 },
          meanDelta: 0.015625,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.0089661, upper: 0.03500777 },
          meanDelta: 0.01302083,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
      magnetic: {
        placement: {
          confidence95: { lower: -0.03511552, upper: 0.07678219 },
          meanDelta: 0.02083333,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.02335109, upper: 0.02335109 },
          meanDelta: 0,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.01850153, upper: 0.00808486 },
          meanDelta: -0.00520833,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
      powerLevel: {
        placement: {
          confidence95: { lower: -0.01149406, upper: 0.2042024 },
          meanDelta: 0.09635417,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.04781986, upper: 0.00094486 },
          meanDelta: -0.0234375,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.02710899, upper: 0.01669232 },
          meanDelta: -0.00520833,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
      tempo: {
        placement: {
          confidence95: { lower: -0.0874926, upper: 0.0562426 },
          meanDelta: -0.015625,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.02461421, upper: 0.02461421 },
          meanDelta: 0,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.01348176, upper: 0.01348176 },
          meanDelta: 0,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
      triple: {
        placement: {
          confidence95: { lower: -0.09390359, upper: 0.06786192 },
          meanDelta: -0.01302083,
          pairedSeats: 384,
          seedClusters: 24,
        },
        topFour: {
          confidence95: { lower: -0.0180344, upper: 0.02845107 },
          meanDelta: 0.00520833,
          pairedSeats: 384,
          seedClusters: 24,
        },
        win: {
          confidence95: { lower: -0.00808486, upper: 0.01850153 },
          meanDelta: 0.00520833,
          pairedSeats: 384,
          seedClusters: 24,
        },
      },
    },
  },
  gate: {
    accepted: false,
    reasons: [
      "powerLevel placement mean delta must be at most -0.1",
      "powerLevel placement confidence interval upper bound must be below 0",
      "powerLevel top-four confidence interval lower bound must be at least -0.02",
    ],
  },
  rosterFinalScreenEligible: false,
  nextPhases: {
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
    unchanged: true,
  },
} as const;

export const AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256 =
  "1bcf2fc7d17d73b014a6f460871149cad8b7cfac4cce1a4a821af6ecbd8d46f7" as const;

export function computeAiCooperativeCemSelectionResultSha256(
  value: unknown = AI_COOPERATIVE_CEM_SELECTION_RESULT_PAYLOAD,
): string {
  return createHash("sha256")
    .update(canonicalHistoricalJsonV1(value))
    .digest("hex");
}

const computedResultSha256 =
  computeAiCooperativeCemSelectionResultSha256();
if (
  computedResultSha256 !== AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256
) {
  throw new Error(
    `cooperative CEM selection result drifted: expected ${AI_COOPERATIVE_CEM_SELECTION_PINNED_RESULT_SHA256}, received ${computedResultSha256}`,
  );
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const AI_COOPERATIVE_CEM_SELECTION_RESULT = deepFreeze({
  ...AI_COOPERATIVE_CEM_SELECTION_RESULT_PAYLOAD,
  resultSha256: computedResultSha256,
});
