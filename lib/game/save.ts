import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "./content.ts";
import { TAVERN_SPELL_DEFINITIONS } from "./tavern-spells.ts";
import type {
  TavernSpellDefinition,
  TavernSpellInstance,
  TavernTier,
} from "./types.ts";

export const LEGACY_SCHEMA_5_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v9";
export const LEGACY_SCHEMA_6_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v10";

const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;

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

function refreshOwnedMinions(migrated: Record<string, unknown>): boolean {
  if (!Array.isArray(migrated.players)) {
    return false;
  }
  for (const player of migrated.players) {
    if (!isRecord(player)) {
      return false;
    }
    for (const zone of ["board", "hand", "shop"] as const) {
      const cards = player[zone];
      if (!Array.isArray(cards)) {
        return false;
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
  return true;
}

function createMigratedSpellOffer(
  definition: TavernSpellDefinition,
  nextInstanceId: number,
): TavernSpellInstance {
  return {
    kind: "tavernSpell",
    instanceId: `card-${nextInstanceId}`,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function migrateSchema5To6(value: unknown): unknown {
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
    if (
      !isRecord(migrated) ||
      !Array.isArray(migrated.players) ||
      !refreshOwnedMinions(migrated)
    ) {
      return null;
    }
    migrated.version = 6;
    migrated.contentVersion = LEGACY_SCHEMA_6_CONTENT_VERSION;
    for (const player of migrated.players) {
      if (!isRecord(player)) {
        return null;
      }
      player.bloodGemAttack = 1;
      player.bloodGemHealth = 1;
    }
    return migrated;
  } catch {
    return null;
  }
}

export function migrateSchema6GameState(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 6 ||
    value.contentVersion !== LEGACY_SCHEMA_6_CONTENT_VERSION ||
    !Array.isArray(value.players) ||
    typeof value.nextInstanceId !== "number" ||
    typeof value.round !== "number"
  ) {
    return null;
  }
  try {
    const migrated: unknown = JSON.parse(JSON.stringify(value));
    if (
      !isRecord(migrated) ||
      !Array.isArray(migrated.players) ||
      !refreshOwnedMinions(migrated)
    ) {
      return null;
    }

    migrated.version = 7;
    migrated.contentVersion = CURRENT_ROSTER_VERSION;
    const spellPool: Record<string, number> = {};
    for (const definition of TAVERN_SPELL_DEFINITIONS) {
      spellPool[definition.id] =
        SPELL_POOL_COPIES_BY_TIER[definition.tier];
    }

    let nextInstanceId = migrated.nextInstanceId as number;
    const round = migrated.round as number;
    for (
      let playerIndex = 0;
      playerIndex < migrated.players.length;
      playerIndex += 1
    ) {
      const player = migrated.players[playerIndex];
      if (
        !isRecord(player) ||
        typeof player.alive !== "boolean" ||
        typeof player.tavernTier !== "number" ||
        player.tavernTier < 1 ||
        player.tavernTier > 6
      ) {
        return null;
      }
      player.maxGold = 10;
      player.pendingNextTurnGold = 0;
      player.freeRefreshes = 0;
      player.tavernMinionAttackBonus = 0;
      player.tavernMinionHealthBonus = 0;
      player.nextCombatAttackBonus = 0;
      player.nextCombatHealthBonus = 0;
      player.backToBackBonus = 0;
      player.spellShop = null;

      if (!player.alive) {
        continue;
      }

      const eligible = TAVERN_SPELL_DEFINITIONS.filter(
        (definition) =>
          definition.tier <= (player.tavernTier as TavernTier) &&
          spellPool[definition.id] > 0,
      );
      const definition =
        eligible[(round + playerIndex) % eligible.length];
      player.spellShop = createMigratedSpellOffer(
        definition,
        nextInstanceId,
      );
      nextInstanceId += 1;
      spellPool[definition.id] -= 1;
    }
    migrated.nextInstanceId = nextInstanceId;
    migrated.spellPool = spellPool;
    return migrated;
  } catch {
    return null;
  }
}

/**
 * Kept as a public compatibility entry point for existing tests and older
 * installs. It now performs the complete v5 -> v6 -> v7 chain.
 */
export function migrateSchema5GameState(value: unknown): unknown {
  const schema6 = migrateSchema5To6(value);
  return schema6 ? migrateSchema6GameState(schema6) : null;
}

export function migrateLegacyGameState(value: unknown): unknown {
  if (!isRecord(value)) {
    return null;
  }
  if (value.version === 5) {
    return migrateSchema5GameState(value);
  }
  if (value.version === 6) {
    return migrateSchema6GameState(value);
  }
  return null;
}
