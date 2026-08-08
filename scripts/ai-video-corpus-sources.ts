import { CURRENT_ROSTER_VERSION } from "../lib/game/content.ts";

export const AI_VIDEO_CORPUS_SOURCE_REGISTRY_VERSION = 1 as const;

export type AiVideoCorpusSourcePatch = "35.4.2" | "36.0" | "36.0.3" | "36.2";

export interface AiVideoCorpusSource {
  readonly registryVersion: typeof AI_VIDEO_CORPUS_SOURCE_REGISTRY_VERSION;
  readonly platform: "bilibili";
  readonly bvid: string;
  readonly pageUrl: `https://www.bilibili.com/video/${string}/`;
  readonly title: string;
  readonly publishedAt: string;
  readonly durationSeconds: number;
  readonly cid: number;
  /** SHA-256 of the exact temporary MP4 reviewed frame by frame. */
  readonly reviewedMediaSha256: string;
  readonly sourcePatch: AiVideoCorpusSourcePatch;
  readonly targetContentVersion: typeof CURRENT_ROSTER_VERSION;
  readonly runtimeCompatible: boolean;
  readonly compatibilityReason: string;
}

function source(
  value: Omit<AiVideoCorpusSource, "registryVersion" | "platform" | "pageUrl">,
): Readonly<AiVideoCorpusSource> {
  return Object.freeze({
    registryVersion: AI_VIDEO_CORPUS_SOURCE_REGISTRY_VERSION,
    platform: "bilibili" as const,
    pageUrl: `https://www.bilibili.com/video/${value.bvid}/` as const,
    ...value,
  });
}

/**
 * Reproducible source metadata only. Video bytes and extracted frames remain
 * outside the repository and are never fetched by the browser game runtime.
 */
export const AI_VIDEO_CORPUS_SOURCES: readonly Readonly<AiVideoCorpusSource>[] =
  Object.freeze([
    source({
      bvid: "BV11BNb6qEgy",
      title: "手动刷蛾，13回合直接杀死对局！",
      publishedAt: "2026-07-14T17:58:26+08:00",
      durationSeconds: 1_222,
      cid: 39_941_246_218,
      reviewedMediaSha256:
        "94178bba6ad73c248e2392bb961e125ed49024f7f6f56f20a804c90ec76fb89f",
      sourcePatch: "36.0",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "Reviewed only the upgrade, refresh, and freeze macro semantics, which are unchanged by the 36.0.3 hotfix for this 36.0 gameplay source.",
    }),
    source({
      bvid: "BV16q3z66Euu",
      title: "跳本苔丝，3回合四本，巴琳达切割亡灵！",
      publishedAt: "2026-07-28T23:50:00+08:00",
      durationSeconds: 1_228,
      cid: 40_383_676_654,
      reviewedMediaSha256:
        "407d39c2c997366db4df562f3d7a206e402762191883fc6e9faff67e1f68dc5f",
      sourcePatch: "36.0.3",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "The source and target both use patch 36.0.3; only visible upgrade, refresh, and freeze macro decisions are retained.",
    }),
    source({
      bvid: "BV1FvNR6iEEP",
      title: "酒馆三千+，瑞文启动战斗形态！",
      publishedAt: "2026-07-17T22:12:52+08:00",
      durationSeconds: 1_215,
      cid: 40_046_757_728,
      reviewedMediaSha256:
        "5e9c8d5b101a956d05f7838a06035c7139929d79e10b10a301b79d34babf5d52",
      sourcePatch: "36.0",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "Reviewed only the upgrade, refresh, and freeze macro semantics, which are unchanged by the 36.0.3 hotfix for this 36.0 gameplay source.",
    }),
    source({
      bvid: "BV1GCNT6REBk",
      title: "速八到恰鸡！一切铺垫只为一个大饰品！",
      publishedAt: "2026-07-12T15:13:55+08:00",
      durationSeconds: 1_108,
      cid: 39_875_773_626,
      reviewedMediaSha256:
        "d130c0f2c2c2c8d641329988b1193527e86dc0492f627c1605f316bc5e4fc3a5",
      sourcePatch: "36.0",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "Reviewed only the upgrade, refresh, and freeze macro semantics, which are unchanged by the 36.0.3 hotfix for this 36.0 gameplay source.",
    }),
    source({
      bvid: "BV1TPN26RETm",
      title: "教您战棋思路，从详细分析到确定套路！",
      publishedAt: "2026-07-13T22:31:59+08:00",
      durationSeconds: 1_890,
      cid: 39_918_177_102,
      reviewedMediaSha256:
        "b0399c318a5af8dd092a08d57f137c4682fa5252f360084e125c17a253ce3ff2",
      sourcePatch: "36.0",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "Reviewed only the upgrade, refresh, and freeze macro semantics, which are unchanged by the 36.0.3 hotfix for this 36.0 gameplay source.",
    }),
    source({
      bvid: "BV1w9Ti6tEMq",
      title: "伊莉斯+腐蚀秘典，打开上限！想玩什么随心所欲！",
      publishedAt: "2026-07-01T22:37:28+08:00",
      durationSeconds: 1_578,
      cid: 39_567_689_901,
      reviewedMediaSha256:
        "0d149b042d1af45f0497df792b98383917bd1e2fec3fa97eadd0fc1ee4c98948",
      sourcePatch: "36.0",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "Reviewed only visible upgrade, refresh, and freeze macro decisions from this 36.0 gameplay source; no card-specific rules are transferred.",
    }),
    source({
      bvid: "BV1y1VD6DEj7",
      title: "龙族巅峰，人均十万，暴打背靠背！",
      publishedAt: "2026-05-31T23:39:53+08:00",
      durationSeconds: 1_325,
      cid: 38_752_552_321,
      reviewedMediaSha256:
        "b8a70895c8fcd532e179804e8a8eec2726b021fa08ee0ea1033aee1e412ce182",
      sourcePatch: "35.4.2",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: true,
      compatibilityReason:
        "Cross-patch review is limited to visible upgrade, refresh, and freeze macro buttons, gold legality, and recruit-to-combat boundaries; no card, stats, hero, trinket, or anomaly rules are transferred from patch 35.4.2.",
    }),
    source({
      bvid: "BV1mvuH6cENp",
      title: "新发明：大地之母点金铜须！",
      publishedAt: "2026-08-06T23:28:28+08:00",
      durationSeconds: 1_347,
      cid: 40_661_748_578,
      reviewedMediaSha256:
        "07137afa4a7f383796c1fd42fb52df23b1d913f51a26ac5dd45239193b6d7d70",
      sourcePatch: "36.2",
      targetContentVersion: CURRENT_ROSTER_VERSION,
      runtimeCompatible: false,
      compatibilityReason:
        "Season 14 patch 36.2 postdates the pinned Season 13 36.0.3 runtime, so its reviewed windows remain evidence-only and are excluded from current training.",
    }),
  ]);

export function getAiVideoCorpusSource(
  bvid: string,
): Readonly<AiVideoCorpusSource> | null {
  return AI_VIDEO_CORPUS_SOURCES.find((item) => item.bvid === bvid) ?? null;
}

export const AI_RUNTIME_COMPATIBLE_VIDEO_CORPUS_SOURCES = Object.freeze(
  AI_VIDEO_CORPUS_SOURCES.filter((item) => item.runtimeCompatible),
);
