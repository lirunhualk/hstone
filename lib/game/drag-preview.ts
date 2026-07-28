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
