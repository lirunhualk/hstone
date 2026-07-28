import assert from "node:assert/strict";
import test from "node:test";

import {
  createBoardDragPreview,
  nearestBoardSlotIndex,
} from "../lib/game/drag-preview.ts";

test("hand drag reserves one slot and shifts every unit at or after the gap", () => {
  const preview = createBoardDragPreview({
    unitCount: 3,
    boardLimit: 7,
    sourceZone: "hand",
    sourceIndex: 4,
    targetIndex: 1,
  });

  assert.equal(preview.slotCount, 4);
  assert.equal(preview.targetIndex, 1);
  assert.deepEqual(
    preview.slots.map(({ isGap, shift }) => ({ isGap, shift })),
    [
      { isGap: false, shift: null },
      { isGap: true, shift: "right" },
      { isGap: false, shift: "right" },
      { isGap: false, shift: null },
    ],
  );
});

test("hand drag can preview the final position without shifting units", () => {
  const preview = createBoardDragPreview({
    unitCount: 3,
    boardLimit: 7,
    sourceZone: "hand",
    sourceIndex: 0,
    targetIndex: 3,
  });

  assert.equal(preview.slotCount, 4);
  assert.equal(preview.slots[3]?.isGap, true);
  assert.ok(preview.slots.every((slot) => slot.shift === null));
});

test("board drag to the left opens a gap and shifts intervening units right", () => {
  const preview = createBoardDragPreview({
    unitCount: 4,
    boardLimit: 7,
    sourceZone: "board",
    sourceIndex: 3,
    targetIndex: 1,
  });

  assert.deepEqual(
    preview.slots.map(({ isGap, isSource, shift }) => ({
      isGap,
      isSource,
      shift,
    })),
    [
      { isGap: false, isSource: false, shift: null },
      { isGap: true, isSource: false, shift: "right" },
      { isGap: false, isSource: false, shift: "right" },
      { isGap: false, isSource: true, shift: null },
    ],
  );
});

test("board drag to the right shifts intervening units left", () => {
  const preview = createBoardDragPreview({
    unitCount: 4,
    boardLimit: 7,
    sourceZone: "board",
    sourceIndex: 1,
    targetIndex: 3,
  });

  assert.deepEqual(
    preview.slots.map(({ isGap, isSource, shift }) => ({
      isGap,
      isSource,
      shift,
    })),
    [
      { isGap: false, isSource: false, shift: null },
      { isGap: false, isSource: true, shift: null },
      { isGap: false, isSource: false, shift: "left" },
      { isGap: true, isSource: false, shift: "left" },
    ],
  );
});

test("invalid targets and full boards never leave a stale preview gap", () => {
  const boardPreview = createBoardDragPreview({
    unitCount: 3,
    boardLimit: 7,
    sourceZone: "board",
    sourceIndex: 1,
    targetIndex: 8,
  });
  const fullHandPreview = createBoardDragPreview({
    unitCount: 7,
    boardLimit: 7,
    sourceZone: "hand",
    sourceIndex: 0,
    targetIndex: 6,
  });

  assert.equal(boardPreview.targetIndex, null);
  assert.ok(
    boardPreview.slots.every(
      (slot) => !slot.isGap && !slot.isSource && slot.shift === null,
    ),
  );
  assert.equal(fullHandPreview.slotCount, 7);
  assert.equal(fullHandPreview.targetIndex, null);
});

test("nearest slot uses stable centers and resolves ties to the left", () => {
  const centers = [120, 250, 380, 510];

  assert.equal(nearestBoardSlotIndex(90, centers), 0);
  assert.equal(nearestBoardSlotIndex(315, centers), 1);
  assert.equal(nearestBoardSlotIndex(499, centers), 3);
  assert.equal(nearestBoardSlotIndex(Number.NaN, centers), null);
  assert.equal(nearestBoardSlotIndex(100, []), null);
});
