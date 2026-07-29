import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "./content.ts";
import {
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellIsAvailable,
} from "./tavern-spells.ts";
import type {
  TavernSpellDefinition,
  TavernSpellInstance,
  TavernTier,
  Tribe,
} from "./types.ts";

export const LEGACY_SCHEMA_5_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v9";
export const LEGACY_SCHEMA_6_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v10";
export const LEGACY_SCHEMA_7_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v11";

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

function refreshSchema8Minions(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(refreshSchema8Minions);
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (value.kind === "minion" || value.kind === "tripleReward") {
    value.bloodGemAttack =
      typeof value.bloodGemAttack === "number"
        ? value.bloodGemAttack
        : 0;
    value.bloodGemHealth =
      typeof value.bloodGemHealth === "number"
        ? value.bloodGemHealth
        : 0;
    if (
      value.playableFromRound !== undefined &&
      typeof value.playableFromRound !== "number"
    ) {
      delete value.playableFromRound;
    }
    if (
      value.kind === "minion" &&
      typeof value.definitionId === "string"
    ) {
      value.effectSupport =
        getMinionDefinition(value.definitionId).effectSupport ??
        "complete";
    }
  }
  Object.values(value).forEach(refreshSchema8Minions);
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

function migrateSchema6To7(value: unknown): unknown {
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
    migrated.contentVersion = LEGACY_SCHEMA_7_CONTENT_VERSION;
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

function refreshMigratedSpell(
  value: Record<string, unknown>,
  definition: TavernSpellDefinition,
): void {
  value.definitionId = definition.id;
  value.cardId = definition.cardId;
  value.name = definition.name;
  value.tier = definition.tier;
  value.cost = definition.cost;
  value.description = definition.description;
  value.target = definition.target;
  value.spellFamily = "tavern";
}

export function migrateSchema7GameState(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 7 ||
    value.contentVersion !== LEGACY_SCHEMA_7_CONTENT_VERSION ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.activeTribes) ||
    !value.activeTribes.every((tribe) => typeof tribe === "string") ||
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
      !Array.isArray(migrated.activeTribes)
    ) {
      return null;
    }
    refreshSchema8Minions(migrated);
    const activeTribes = migrated.activeTribes as Tribe[];
    const spellPool: Record<string, number> = {};
    for (const definition of TAVERN_SPELL_DEFINITIONS) {
      spellPool[definition.id] = tavernSpellIsAvailable(
        definition,
        activeTribes,
      )
        ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
        : 0;
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

      player.nextCombatWinGold = 0;
      player.nextCombatTieGold = 0;
      player.nextTurnBoardAttackBonus = 0;
      player.nextTurnBoardHealthBonus = 0;
      player.nextTurnBoardBuffPulses = 0;
      player.tavernBloodGemBarrageAttack = 0;
      player.tavernBloodGemBarrageHealth = 0;

      let reserved = false;
      if (isRecord(player.spellShop)) {
        try {
          const definition = getTavernSpellDefinition(
            String(player.spellShop.definitionId),
          );
          if (
            player.alive &&
            definition.tier <= (player.tavernTier as TavernTier) &&
            tavernSpellIsAvailable(definition, activeTribes) &&
            spellPool[definition.id] > 0
          ) {
            refreshMigratedSpell(player.spellShop, definition);
            spellPool[definition.id] -= 1;
            reserved = true;
          }
        } catch {
          // An obsolete offer is replaced deterministically below.
        }
      }
      if (!reserved) {
        player.spellShop = null;
      }
      if (!player.alive || reserved) {
        continue;
      }

      const eligible = TAVERN_SPELL_DEFINITIONS.filter(
        (definition) =>
          definition.tier <= (player.tavernTier as TavernTier) &&
          tavernSpellIsAvailable(definition, activeTribes) &&
          spellPool[definition.id] > 0,
      );
      if (eligible.length === 0) {
        continue;
      }
      const definition =
        eligible[(round + playerIndex) % eligible.length];
      player.spellShop = createMigratedSpellOffer(
        definition,
        nextInstanceId,
      );
      nextInstanceId += 1;
      spellPool[definition.id] -= 1;
    }

    migrated.version = 8;
    migrated.contentVersion = CURRENT_ROSTER_VERSION;
    migrated.nextInstanceId = nextInstanceId;
    migrated.spellPool = spellPool;
    return migrated;
  } catch {
    return null;
  }
}

export function migrateSchema6GameState(value: unknown): unknown {
  const schema7 = migrateSchema6To7(value);
  return schema7 ? migrateSchema7GameState(schema7) : null;
}

/**
 * Kept as a public compatibility entry point for existing tests and older
 * installs. It now performs the complete v5 -> v6 -> v7 -> v8 chain.
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
  if (value.version === 7) {
    return migrateSchema7GameState(value);
  }
  return null;
}
