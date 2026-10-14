import type { MinionDefinition, TavernSpellEffect } from "./types.ts";
import roster from "./generated/battlegrounds-36.0.3-247416.zhCN.json" with { type: "json" };
import { RIME_OR_REASON_STAT_GRANTING_CARD_IDS, TAVERN_SPELL_DEFINITIONS } from "./tavern-spells.ts";

/** Reuse the fixed-build Blizzard stat-grant tag list used by Rime or Reason. */
export const TIMEWARP_STAT_GRANTING_TAVERN_SPELL_EFFECTS: ReadonlySet<TavernSpellEffect> =
  new Set(TAVERN_SPELL_DEFINITIONS.filter((spell) =>
    RIME_OR_REASON_STAT_GRANTING_CARD_IDS.some((id) => id === spell.cardId),
  ).map((spell) => spell.effect));

/**
 * Only reviewed, behaviorally tested rules enter the playable Candlestick pool.
 * The complete fixed-build source registry remains available for old saves.
 */
export const TIMEWARP_RULE_OVERRIDES: Readonly<Record<string, Partial<MinionDefinition>>> = {
  BG34_Giant_065: {
    endOfTurn: { kind: "buffLowerThanSource", attack: 2, health: 2 },
  },
  BG34_Giant_067: {
    endOfTurn: { kind: "gainMinion", definitionId: "BGS_115", count: 1, goldenMode: "doubleCount" },
  },
  BG34_Giant_072: {
    afterFriendlySoldTier: 2,
    afterFriendlySold: [{ kind: "getRandomMinion", count: 1, filter: { exactTier: 1 }, maximumTier: 1, source: "sharedPool", goldenMode: "doubleCount" }],
  },
  BG34_Giant_082: {
    avenge: { threshold: 4, effects: [{ kind: "increaseMaxGold", amount: 1 }] },
  },
  BG34_Giant_204: {
    deathrattle: [{ kind: "gainTavernSpell", definitionId: "tavern-spell-tavern-coin", count: 1, goldenMode: "doubleCount" }],
  },
  BG34_Giant_302: {
    avenge: { threshold: 3, effects: [{ kind: "gainRandomGeneratedMinion", count: 1, definitionIds: roster.minions.filter((card) => card.races.some((race) => race === "MECHANICAL" || race === "ALL")).map((card) => card.id), goldenMode: "doubleCount" }] },
  },
  BG34_Giant_304: {
    deathrattle: [{ kind: "gainTavernSpell", definitionId: "tavern-spell-slimy-seafood", count: 1, goldenMode: "doubleCount" }],
  },
  BG34_Giant_305: {
    avenge: { threshold: 5, effects: [{ kind: "gainBloodGems", count: 1, goldenCount: 1 }, { kind: "improveBloodGems", attack: 1, health: 1 }] },
  },
  BG34_Giant_306: {
    deathrattle: [{ kind: "improveBloodGems", attack: 0, health: 2 }],
  },
  BG34_Giant_310: {
    endOfTurn: { kind: "buffOwned", attack: 2, health: 1 },
  },
  BG34_Giant_582: {
    deathrattle: [{ kind: "gainRandomTavernSpell", count: 1, filter: { minimumCost: 2 }, goldenMode: "doubleCount" }],
  },
  BG34_Giant_603: {
    endOfTurn: { kind: "gainRandomTavernSpell", count: 2, filter: { grantsStats: true }, goldenMode: "doubleCount" },
  },
  BG34_Giant_015: {
    afterTavernSpellCast: [{ kind: "buff", target: "allFriendly", attack: 2, health: 2, goldenMode: "repeat" }],
  },
  BG34_Giant_021: {
    endOfTurn: { kind: "buff", target: "adjacentFriendly", attack: 8, health: 8, repeatPerGoldenFriendly: true },
  },
  BG34_Giant_032: {
    afterCardPlayed: { filter: { tribe: "elemental" }, includeSource: true, effects: [{ kind: "buffTavern", attack: 4, health: 3, goldenMode: "doubleStats" }] },
  },
  BG34_Giant_034: {
    deathrattle: [{ kind: "improveTavernSpellBuffs", attack: 2, health: 2 }],
  },
  BG34_Giant_205: {
    afterSpellCast: { attack: 4, health: 3, target: "onePerTribe" },
  },
  BG34_Giant_321: {
    startOfCombat: [{ kind: "gainAllHandMinionStats", target: "adjacentFriendlyTribe", tribe: "murloc", goldenMode: "repeat" }],
  },
  BG34_Giant_323: {
    afterSpellcraftCast: { threshold: 2, effects: [{ kind: "gainRandomTavernSpell", count: 1, filter: {}, goldenMode: "doubleCount" }] },
  },
  BG34_Giant_327: {
    afterCardAddedToHand: { kind: "buffFriendlyTribe", tribe: "pirate", attack: 1, health: 1, goldenMode: "repeat" },
  },
  BG34_Giant_335: {
    afterCardPlayed: { filter: { tribe: "neutral" }, effects: [{ kind: "onePerTribe", attack: 6, health: 6 }] },
  },
  BG34_Giant_608: {
    deathrattle: [{ kind: "applyBloodGemsToTribe", tribe: "quilboar", count: 3 }],
  },
  BG34_PreMadeChamp_013: {
    afterGoldSpent: { threshold: 8, effects: [{ kind: "buffTavern", attack: 3, health: 3, goldenMode: "doubleStats" }] },
  },
  BG34_PreMadeChamp_020: {
    avenge: { threshold: 1, effects: [{ kind: "buff", target: "friendlyTribe", tribe: "dragon", attack: 6, health: 4 }] },
  },
  BG34_PreMadeChamp_032: {
    endOfTurn: { kind: "gainTavernSpell", definitionId: "tavern-spell-temperature-shift", count: 1, goldenMode: "doubleCount" },
  },
  BG34_PreMadeChamp_049: {
    afterCardPlayed: { filter: { tribe: "murloc" }, includeSource: true, effects: [{ kind: "buffOwned", attack: 2, health: 2 }] },
  },
  BG34_PreMadeChamp_065: {
    afterCardPlayed: { filter: { minimumTier: 4 }, includeSource: true, effects: [{ kind: "buff", target: "friendlyTribe", tribe: "pirate", attack: 3, health: 2, goldenMode: "repeat" }] },
  },
  BG34_PreMadeChamp_083: {
    afterCardPlayed: { filter: { tribe: "undead" }, includeSource: true, effects: [{ kind: "improveUndeadArmy", attack: 3, health: 0 }] },
  },
};

export const FULLY_SUPPORTED_TIMEWARP_CARD_IDS: ReadonlySet<string> =
  new Set(Object.keys(TIMEWARP_RULE_OVERRIDES));
