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
  BG34_Giant_008: { timewarp: "discountSpells" },
  BG34_Giant_024: { timewarp: "rebornWarband" },
  BG34_Giant_027: { timewarp: "attackedAttack" },
  BG34_Giant_038: { timewarp: "refreshGolden" },
  BG34_Giant_064: { timewarp: "attackGainHealth" },
  BG34_Giant_068: { timewarp: "rallyShield" },
  BG34_Giant_069: { timewarp: "damageGems" },
  BG34_Giant_208: { timewarp: "attackKillTriple" },
  BG34_Giant_210: { spellcraft: { definitionId: "spellcraft-timewarped-shoal" } },
  BG34_Giant_211: { avenge: { threshold: 3, effects: [
    { kind: "gainRandomSpellcraft", count: 1 },
    { kind: "gainRandomTavernSpell", count: 1, filter: {}, goldenMode: "doubleCount" },
  ] } },
  BG34_Giant_332: { timewarp: "rebornSummons" },
  BG34_Giant_590: { deathrattle: [{ kind: "timewarpDeathrattle", action: "undeadCreation" }] },
  BG34_Giant_602: { timewarp: "currentBuddy" },
  BG34_Giant_042: { timewarp: "copyLeft" },
  BG34_Giant_088: { timewarp: "growingCombatBuff" },
  BG34_Giant_102: { timewarp: "rallyBloodGems" },
  BG34_Giant_105: { timewarp: "bloodGemBarrage" },
  BG34_Giant_120: { timewarp: "mechPlayedOrMagnetized" },
  BG34_Giant_311: { timewarp: "consumeStats" },
  BG34_Giant_313: { timewarp: "extraDemons" },
  BG34_Giant_317: { timewarp: "handStatRelay" },
  BG34_Giant_319: { timewarp: "growingPainter" },
  BG34_Giant_336: { timewarp: "playedTribeTavern" },
  BG34_Giant_362: { deathrattle: [{ kind: "timewarpDeathrattle", action: "permanentBeasts" }] },
  BG34_Giant_370: { timewarp: "triggerAllDeathrattles" },
  BG34_Giant_376: { extraBattlecries: 1, extraDeathrattles: 1, extraRallies: 1 },
  BG34_Giant_599: { timewarp: "copyLeftDeathrattles" },
  BG34_Giant_609: { timewarp: "deathrattleWarband" },
  BG34_Giant_610: { timewarp: "spellSatellites" },
  BG34_Giant_618: { deathrattle: [{ kind: "timewarpDeathrattle", action: "overflowSkeletons" }] },
  BG34_Giant_619: { deathrattle: [{ kind: "timewarpDeathrattle", action: "opponentCopy" }] },
  BG34_Giant_656: { timewarp: "shieldLossWarband" },
  BG34_Giant_678: { timewarp: "spellcraftLurker" },
  BG34_Giant_686: { timewarp: "elementalGrantAura" },
  BG34_Giant_687: {
    battlecry: [{ kind: "improveBeetles", attack: 2, health: 2 }, { kind: "summon", definitionId: "live-beetle-token", count: 1, goldenMode: "doubleCount" }],
    deathrattle: [{ kind: "improveBeetles", attack: 2, health: 2 }, { kind: "summon", definitionId: "live-beetle-token", count: 1, goldenMode: "doubleCount" }],
    rally: [{ kind: "improveBeetles", attack: 2, health: 2 }, { kind: "summon", definitionId: "live-beetle-token", count: 1, goldenMode: "doubleCount" }],
  },
  BG34_Giant_777: { timewarp: "purchaseElementalStats" },
  BG34_PreMadeChamp_004: { timewarp: "growingBeastSummon" },
  BG34_PreMadeChamp_200: { timewarp: "copyTavernSpell" },
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

interface TimewarpPresentation {
  definitionId: string;
  description: string;
  golden: boolean;
  effectCounters?: Readonly<Record<string, unknown>>;
}

/** Shared by live rendering and save repair; does not change stats or counters. */
export function refreshTimewarpDescription(
  minion: TimewarpPresentation,
  round?: number,
  printedDescription = minion.description,
): boolean {
  const mechanic = TIMEWARP_RULE_OVERRIDES[minion.definitionId]?.timewarp;
  const counter = (key: string): number => {
    const value = minion.effectCounters?.[key];
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  const scale = minion.golden ? 2 : 1;
  const upgrades = 1 + counter("timewarpGrowth");
  const growth = mechanic === "growingPainter" ? [3, 2]
    : mechanic === "growingBeastSummon" ? [4, 3]
      : mechanic === "growingCombatBuff" ? [5, 5]
        : mechanic === "extraDemons" ? [7, 7] : undefined;
  if (growth) {
    minion.description = printedDescription.replace(/\+\d+\/\+\d+/u,
      `+${growth[0] * upgrades * scale}/+${growth[1] * upgrades * scale}`);
    return true;
  }
  let remaining: number;
  let unit: string;
  if (mechanic === "discountSpells") {
    remaining = Math.max(0, 2 * scale - counter("timewarpDiscountUses"));
    unit = "张";
  } else if (mechanic === "refreshGolden") {
    remaining = 5 - counter("timewarpRefreshes") % 5;
    unit = "次";
  } else if (mechanic === "spellSatellites") {
    remaining = 2 - counter("timewarpTavernSpells") % 2;
    unit = "个";
  } else if (mechanic === "rebornSummons" || mechanic === "copyTavernSpell" || mechanic === "spellcraftLurker") {
    const key = mechanic === "rebornSummons" ? "timewarpSummons"
      : mechanic === "copyTavernSpell" ? "timewarpSpellCopies" : "timewarpPermanentCopies";
    const encoded = counter(key);
    const used = round === undefined || Math.floor(encoded / 100) === round ? encoded % 100 : 0;
    remaining = Math.max(0, (mechanic === "rebornSummons" ? scale : mechanic === "copyTavernSpell" ? 3 : 2) - used);
    unit = mechanic === "rebornSummons" ? "个" : "次";
  } else {
    return false;
  }
  const suffix = `（还剩${remaining}${unit}！）`;
  minion.description = /（还剩\d+[^）]*）/u.test(printedDescription)
    ? printedDescription.replace(/（还剩\d+[^）]*）/u, suffix)
    : `${printedDescription}${suffix}`;
  return true;
}
