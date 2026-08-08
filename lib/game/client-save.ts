import {
  getHeroPowerDefinition,
  isHeroPowerDefinitionId,
} from "./hero-powers.ts";
import { isHeroSecretDefinitionId } from "./hero-secrets.ts";
import type {
  MinionTier,
  PendingDiscoverInteraction,
  PendingSecretChoiceInteraction,
  PlayerState,
} from "./types.ts";

const GALAKROND_HERO_POWER_ID =
  "hero-power-tb_baconshop_hp_011" as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPersistedSecretChoiceInteraction(
  value: unknown,
): value is PendingSecretChoiceInteraction {
  return (
    isRecord(value) &&
    value.kind === "secretChoice" &&
    typeof value.interactionId === "string" &&
    typeof value.playerId === "string" &&
    typeof value.sourceInstanceId === "string" &&
    typeof value.definitionId === "string" &&
    isHeroPowerDefinitionId(value.definitionId) &&
    getHeroPowerDefinition(value.definitionId).effect === "chooseSecret" &&
    Array.isArray(value.optionIds) &&
    value.optionIds.length > 0 &&
    value.optionIds.length <= 3 &&
    value.optionIds.every(
      (optionId) =>
        typeof optionId === "string" &&
        isHeroSecretDefinitionId(optionId),
    ) &&
    new Set(value.optionIds).size === value.optionIds.length
  );
}

export function persistedSecretChoiceMatchesPlayer(
  interaction: PendingSecretChoiceInteraction,
  player: PlayerState,
): boolean {
  return (
    player.isHuman &&
    interaction.playerId === player.id &&
    interaction.sourceInstanceId === "hero-power-akazamzarak" &&
    interaction.definitionId === player.heroPowerId &&
    isHeroPowerDefinitionId(interaction.definitionId) &&
    getHeroPowerDefinition(interaction.definitionId).effect ===
      "chooseSecret" &&
    interaction.optionIds.every(
      (optionId) =>
        isHeroSecretDefinitionId(optionId) &&
        !player.secretIds.includes(optionId),
    )
  );
}

export function persistedGalakrondDiscoverMatchesPlayer(
  interaction: PendingDiscoverInteraction,
  player: PlayerState,
  maximumTier: MinionTier,
): boolean {
  if (interaction.destination.kind !== "replaceShop") {
    return false;
  }
  const targetInstanceId = interaction.destination.targetInstanceId;
  const target = player.shop.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  if (!target || target.tier >= maximumTier) {
    return false;
  }
  const exactTier = (target.tier + 1) as MinionTier;
  const filter = interaction.filter;
  return (
    player.isHuman &&
    interaction.playerId === player.id &&
    player.heroPowerId === GALAKROND_HERO_POWER_ID &&
    interaction.sourceInstanceId === GALAKROND_HERO_POWER_ID &&
    interaction.sourceDefinitionId === GALAKROND_HERO_POWER_ID &&
    interaction.remainingDiscoveries === 1 &&
    interaction.battlecry !== true &&
    interaction.completionSource === undefined &&
    interaction.selectionEffect === undefined &&
    interaction.remainingCastCompletions === undefined &&
    interaction.firstCastFromHandPending === undefined &&
    filter.exactTier === exactTier &&
    filter.maximumTier === undefined &&
    filter.tribe === undefined &&
    filter.magnetic === undefined &&
    filter.ability === undefined &&
    filter.requiresMinionType === undefined &&
    (filter.usesSharedPool ?? false) === (exactTier === 7) &&
    interaction.options.length > 0 &&
    interaction.options.length <= 3 &&
    new Set(interaction.options.map((option) => option.instanceId)).size ===
      interaction.options.length &&
    new Set(interaction.options.map((option) => option.definitionId)).size ===
      interaction.options.length &&
    interaction.options.every(
      (option) => option.tier === exactTier && option.poolCopies > 0,
    )
  );
}
