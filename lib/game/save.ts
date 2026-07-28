import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "./content.ts";

export const LEGACY_SCHEMA_5_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v9";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function refreshMinionSupport(value: unknown): void {
  if (
    !isRecord(value) ||
    value.kind !== "minion" ||
    typeof value.definitionId !== "string"
  ) {
    return;
  }
  value.effectSupport =
    getMinionDefinition(value.definitionId).effectSupport ?? "complete";
}

/**
 * Schema 6 only adds per-player Blood Gem values. A schema 5 save cannot
 * contain Blood Gems, so the migration is lossless and keeps the current run.
 */
export function migrateSchema5GameState(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 5 ||
    value.contentVersion !== LEGACY_SCHEMA_5_CONTENT_VERSION ||
    !Array.isArray(value.players)
  ) {
    return null;
  }

  try {
    const migrated: unknown = JSON.parse(JSON.stringify(value));
    if (!isRecord(migrated) || !Array.isArray(migrated.players)) {
      return null;
    }
    migrated.version = 6;
    migrated.contentVersion = CURRENT_ROSTER_VERSION;
    for (const player of migrated.players) {
      if (!isRecord(player)) {
        return null;
      }
      player.bloodGemAttack = 1;
      player.bloodGemHealth = 1;
      for (const zone of ["board", "hand", "shop"] as const) {
        const cards = player[zone];
        if (!Array.isArray(cards)) {
          return null;
        }
        cards.forEach(refreshMinionSupport);
      }
    }
    if (
      isRecord(migrated.pendingInteraction) &&
      migrated.pendingInteraction.kind === "discover" &&
      Array.isArray(migrated.pendingInteraction.options)
    ) {
      migrated.pendingInteraction.options.forEach(refreshMinionSupport);
    }
    return migrated;
  } catch {
    return null;
  }
}
