export const CARD_INSPECTION_HOVER_DELAY_MS = 120;
export const CARD_INSPECTION_LONG_PRESS_DELAY_MS = 480;
export const CARD_INSPECTION_MOVE_TOLERANCE_PX = 10;
export const CARD_INSPECTION_GAP_PX = 14;
export const CARD_INSPECTION_VIEWPORT_MARGIN_PX = 12;

export type CardInspectionTrigger = "hover" | "focus" | "longPress";
export type CardInspectionSide = "left" | "right" | "overlap";

export type CardInspectionAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type CardInspectionPlacement = {
  left: number;
  top: number;
  side: CardInspectionSide;
};

type CardInspectionPlacementInput = {
  anchor: CardInspectionAnchor;
  previewWidth: number;
  previewHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  margin?: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function cardInspectionDelay(
  trigger: CardInspectionTrigger,
): number {
  if (trigger === "hover") return CARD_INSPECTION_HOVER_DELAY_MS;
  if (trigger === "longPress") {
    return CARD_INSPECTION_LONG_PRESS_DELAY_MS;
  }
  return 0;
}

export function movedBeyondCardInspectionTolerance(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  tolerance = CARD_INSPECTION_MOVE_TOLERANCE_PX,
): boolean {
  return Math.hypot(clientX - startX, clientY - startY) > tolerance;
}

export function placeCardInspection({
  anchor,
  previewWidth,
  previewHeight,
  viewportWidth,
  viewportHeight,
  gap = CARD_INSPECTION_GAP_PX,
  margin = CARD_INSPECTION_VIEWPORT_MARGIN_PX,
}: CardInspectionPlacementInput): CardInspectionPlacement {
  const rightCandidate = anchor.right + gap;
  const leftCandidate = anchor.left - gap - previewWidth;
  const rightFits = rightCandidate + previewWidth <= viewportWidth - margin;
  const leftFits = leftCandidate >= margin;

  const side: CardInspectionSide = rightFits
    ? "right"
    : leftFits
      ? "left"
      : "overlap";
  const desiredLeft =
    side === "right"
      ? rightCandidate
      : side === "left"
        ? leftCandidate
        : anchor.left + anchor.width / 2 - previewWidth / 2;
  const desiredTop =
    anchor.top + anchor.height / 2 - previewHeight / 2;

  return {
    left: Math.round(
      clamp(desiredLeft, margin, viewportWidth - margin - previewWidth),
    ),
    top: Math.round(
      clamp(desiredTop, margin, viewportHeight - margin - previewHeight),
    ),
    side,
  };
}
