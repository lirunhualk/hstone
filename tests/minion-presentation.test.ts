import assert from "node:assert/strict";
import test from "node:test";

import { activeMinionKeywordVisuals } from "../lib/game/minion-presentation.ts";
import type { MinionKeywordVisualState } from "../lib/game/minion-presentation.ts";

function keywordState(
  overrides: Partial<MinionKeywordVisualState> = {},
): MinionKeywordVisualState {
  return {
    stealth: false,
    divineShield: false,
    taunt: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    reborn: false,
    ...overrides,
  };
}

test("minion presentation exposes a distinct visual layer for every requested keyword", () => {
  assert.deepEqual(
    activeMinionKeywordVisuals(
      keywordState({
        stealth: true,
        divineShield: true,
        taunt: true,
        poisonous: true,
        windfury: true,
        reborn: true,
      }),
    ),
    [
      { kind: "taunt", label: "嘲讽" },
      { kind: "stealth", label: "潜行" },
      { kind: "divine-shield", label: "圣盾" },
      { kind: "poisonous", label: "剧毒" },
      { kind: "windfury", label: "风怒" },
      { kind: "reborn", label: "复生" },
    ],
  );
});

test("stealth visual follows the current combat snapshot", () => {
  assert.deepEqual(
    activeMinionKeywordVisuals(keywordState({ stealth: true })),
    [{ kind: "stealth", label: "潜行" }],
  );
  assert.deepEqual(
    activeMinionKeywordVisuals(keywordState({ stealth: false })),
    [],
  );
});

test("poisonous and one-use venomous retain separate visual identities", () => {
  assert.deepEqual(
    activeMinionKeywordVisuals(
      keywordState({ poisonous: true, venomous: true }),
    ),
    [
      { kind: "poisonous", label: "剧毒" },
      { kind: "venomous", label: "烈毒" },
    ],
  );
});

test("consumed Divine Shield and Reborn state removes their persistent visuals", () => {
  assert.deepEqual(
    activeMinionKeywordVisuals(
      keywordState({
        divineShield: false,
        reborn: false,
        taunt: true,
      }),
    ),
    [{ kind: "taunt", label: "嘲讽" }],
  );
});
