import type { PendingInteraction } from "./types.ts";

/**
 * Full-screen choice panels own their input, while board-target interactions
 * deliberately keep legal minion buttons operable for mouse, keyboard and
 * touch.
 */
export function interactionRequiresModalBackdrop(
  interaction: PendingInteraction | null,
): boolean {
  return (
    interaction !== null &&
    interaction.kind !== "target" &&
    interaction.kind !== "magnetizeTarget"
  );
}
