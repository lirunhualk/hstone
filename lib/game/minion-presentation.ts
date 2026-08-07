import type { MinionInstance } from "./types";

export type MinionKeywordVisualKind =
  | "divine-shield"
  | "taunt"
  | "stealth"
  | "poisonous"
  | "venomous"
  | "windfury"
  | "reborn"
  | "cleave";

export interface MinionKeywordVisual {
  kind: MinionKeywordVisualKind;
  label: string;
}

export type MinionKeywordVisualState = Pick<
  MinionInstance,
  | "divineShield"
  | "taunt"
  | "stealth"
  | "poisonous"
  | "venomous"
  | "windfury"
  | "reborn"
  | "cleave"
>;

const KEYWORD_VISUALS: ReadonlyArray<{
  kind: MinionKeywordVisualKind;
  field: keyof MinionKeywordVisualState;
  label: string;
}> = [
  { kind: "taunt", field: "taunt", label: "嘲讽" },
  { kind: "stealth", field: "stealth", label: "潜行" },
  {
    kind: "divine-shield",
    field: "divineShield",
    label: "圣盾",
  },
  { kind: "poisonous", field: "poisonous", label: "剧毒" },
  { kind: "venomous", field: "venomous", label: "烈毒" },
  { kind: "windfury", field: "windfury", label: "风怒" },
  { kind: "reborn", field: "reborn", label: "复生" },
  { kind: "cleave", field: "cleave", label: "顺劈" },
];

/**
 * Converts live minion state into presentation-only visual layers. Combat
 * playback feeds projected snapshots into this function, so consumed keywords
 * such as Divine Shield and Reborn disappear without parsing event text.
 */
export function activeMinionKeywordVisuals(
  minion: MinionKeywordVisualState,
): MinionKeywordVisual[] {
  return KEYWORD_VISUALS.filter(({ field }) => minion[field]).map(
    ({ kind, label }) => ({ kind, label }),
  );
}
