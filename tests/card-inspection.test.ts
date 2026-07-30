import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_INSPECTION_HOVER_DELAY_MS,
  CARD_INSPECTION_LONG_PRESS_DELAY_MS,
  cardInspectionDelay,
  movedBeyondCardInspectionTolerance,
  placeCardInspection,
} from "../lib/game/card-inspection.ts";

test("card inspection uses immediate keyboard focus and deliberate pointer delays", () => {
  assert.equal(cardInspectionDelay("focus"), 0);
  assert.equal(
    cardInspectionDelay("hover"),
    CARD_INSPECTION_HOVER_DELAY_MS,
  );
  assert.equal(
    cardInspectionDelay("longPress"),
    CARD_INSPECTION_LONG_PRESS_DELAY_MS,
  );
  assert.ok(
    CARD_INSPECTION_LONG_PRESS_DELAY_MS >
      CARD_INSPECTION_HOVER_DELAY_MS,
  );
});

test("card inspection prefers the source card's right side when it fits", () => {
  assert.deepEqual(
    placeCardInspection({
      anchor: {
        left: 100,
        top: 200,
        right: 200,
        bottom: 340,
        width: 100,
        height: 140,
      },
      previewWidth: 280,
      previewHeight: 420,
      viewportWidth: 1200,
      viewportHeight: 800,
    }),
    { left: 214, top: 60, side: "right" },
  );
});

test("card inspection flips left and remains inside the viewport", () => {
  assert.deepEqual(
    placeCardInspection({
      anchor: {
        left: 920,
        top: 650,
        right: 1020,
        bottom: 790,
        width: 100,
        height: 140,
      },
      previewWidth: 280,
      previewHeight: 420,
      viewportWidth: 1080,
      viewportHeight: 800,
    }),
    { left: 626, top: 368, side: "left" },
  );
});

test("card inspection overlaps and clamps on a narrow viewport", () => {
  assert.deepEqual(
    placeCardInspection({
      anchor: {
        left: 120,
        top: 100,
        right: 220,
        bottom: 240,
        width: 100,
        height: 140,
      },
      previewWidth: 280,
      previewHeight: 420,
      viewportWidth: 320,
      viewportHeight: 480,
    }),
    { left: 28, top: 12, side: "overlap" },
  );
});

test("touch movement cancels inspection only after the tolerance", () => {
  assert.equal(
    movedBeyondCardInspectionTolerance(10, 10, 16, 18),
    false,
  );
  assert.equal(
    movedBeyondCardInspectionTolerance(10, 10, 21, 10),
    true,
  );
});
