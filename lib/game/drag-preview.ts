export type BoardDragPreviewZone = "hand" | "board";

export type BoardPreviewShift = "left" | "right" | null;

export interface BoardPreviewSlot {
  index: number;
  isGap: boolean;
  isSource: boolean;
  shift: BoardPreviewShift;
}

export interface BoardDragPreview {
  slotCount: number;
  targetIndex: number | null;
  slots: BoardPreviewSlot[];
}

export interface LiftedCardDragPreview {
  left: number;
  top: number;
  width: number;
  height: number;
  directTouch: boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/**
 * Converts the compact hand-card rectangle into a readable, Hearthstone-style
 * lifted card. Mouse dragging preserves the relative grab point; direct touch
 * keeps the whole card above the finger. The final rectangle is always
 * clamped to the visible viewport.
 */
export function createLiftedCardDragPreview({
  clientX,
  clientY,
  offsetX,
  offsetY,
  sourceWidth,
  sourceHeight,
  viewportWidth,
  viewportHeight,
  pointerType,
}: {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pointerType: string;
}): LiftedCardDragPreview {
  const margin = 8;
  const safeSourceWidth =
    Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : 94;
  const safeSourceHeight =
    Number.isFinite(sourceHeight) && sourceHeight > 0
      ? sourceHeight
      : safeSourceWidth * 1.4;
  const safeViewportWidth = Math.max(
    margin * 2 + 1,
    Number.isFinite(viewportWidth) ? viewportWidth : 1280,
  );
  const safeViewportHeight = Math.max(
    margin * 2 + 1,
    Number.isFinite(viewportHeight) ? viewportHeight : 720,
  );
  const aspectRatio = safeSourceWidth / safeSourceHeight;
  const preferredWidth = clamp(safeSourceWidth, 150, 168);
  const width = Math.max(
    1,
    Math.min(
      preferredWidth,
      safeViewportWidth - margin * 2,
      (safeViewportHeight - margin * 2) * aspectRatio,
    ),
  );
  const height = width / aspectRatio;
  const directTouch = pointerType === "touch" || pointerType === "pen";

  const horizontalAnchor = directTouch
    ? 0.5
    : clamp(offsetX / safeSourceWidth, 0, 1);
  const verticalAnchor = directTouch
    ? 1
    : clamp(offsetY / safeSourceHeight, 0, 1);
  const rawLeft = clientX - width * horizontalAnchor;
  const rawTop = directTouch
    ? clientY - height - 56
    : clientY - height * verticalAnchor;

  return {
    left: clamp(
      rawLeft,
      margin,
      safeViewportWidth - margin - width,
    ),
    top: clamp(
      rawTop,
      margin,
      safeViewportHeight - margin - height,
    ),
    width,
    height,
    directTouch,
  };
}

export function createBoardDragPreview({
  unitCount,
  boardLimit,
  sourceZone,
  sourceIndex,
  targetIndex,
}: {
  unitCount: number;
  boardLimit: number;
  sourceZone: BoardDragPreviewZone;
  sourceIndex: number;
  targetIndex: number | null;
}): BoardDragPreview {
  const safeBoardLimit = Math.max(0, Math.trunc(boardLimit));
  const safeUnitCount = Math.min(
    safeBoardLimit,
    Math.max(0, Math.trunc(unitCount)),
  );
  const canInsertFromHand =
    sourceZone === "hand" && safeUnitCount < safeBoardLimit;
  const slotCount = canInsertFromHand
    ? safeUnitCount + 1
    : safeUnitCount;
  const maxTargetIndex =
    sourceZone === "hand" ? safeUnitCount : safeUnitCount - 1;
  const normalizedTargetIndex =
    Number.isInteger(targetIndex) &&
    targetIndex !== null &&
    targetIndex >= 0 &&
    targetIndex <= maxTargetIndex &&
    (sourceZone !== "hand" || canInsertFromHand)
      ? targetIndex
      : null;
  const normalizedSourceIndex =
    sourceZone === "board" &&
    Number.isInteger(sourceIndex) &&
    sourceIndex >= 0 &&
    sourceIndex < safeUnitCount
      ? sourceIndex
      : null;

  return {
    slotCount,
    targetIndex: normalizedTargetIndex,
    slots: Array.from({ length: slotCount }, (_, index) => {
      let shift: BoardPreviewShift = null;
      if (normalizedTargetIndex !== null && index < safeUnitCount) {
        if (
          sourceZone === "hand" &&
          index >= normalizedTargetIndex
        ) {
          shift = "right";
        } else if (
          normalizedSourceIndex !== null &&
          normalizedTargetIndex < normalizedSourceIndex &&
          index >= normalizedTargetIndex &&
          index < normalizedSourceIndex
        ) {
          shift = "right";
        } else if (
          normalizedSourceIndex !== null &&
          normalizedTargetIndex > normalizedSourceIndex &&
          index > normalizedSourceIndex &&
          index <= normalizedTargetIndex
        ) {
          shift = "left";
        }
      }

      return {
        index,
        isGap: normalizedTargetIndex === index,
        isSource:
          normalizedTargetIndex !== null &&
          normalizedSourceIndex === index,
        shift,
      };
    }),
  };
}

export function nearestBoardSlotIndex(
  clientX: number,
  slotCenters: readonly number[],
): number | null {
  if (!Number.isFinite(clientX) || slotCenters.length === 0) {
    return null;
  }

  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  slotCenters.forEach((center, index) => {
    if (!Number.isFinite(center)) return;
    const distance = Math.abs(clientX - center);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}
