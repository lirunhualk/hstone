import {
  getHeroPowerDefinition,
  isHeroPowerDefinitionId,
} from "./hero-powers.ts";
import { isHeroSecretDefinitionId } from "./hero-secrets.ts";
import type {
  PendingSecretChoiceInteraction,
  PlayerState,
} from "./types.ts";

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
