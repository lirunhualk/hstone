import {
  CURRENT_ROSTER_VERSION,
  TRIBE_NAMES,
  getMinionDefinition,
} from "./content.ts";
import {
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellIsAvailable,
} from "./tavern-spells.ts";
import {
  DEFAULT_INITIAL_HEALTH,
  isValidInitialHealth,
} from "./setup.ts";
import {
  HERO_POWER_COUNTER_KEYS,
  createInitialHeroPowerCounters,
  isHeroDefinitionId,
  isHeroPowerDefinitionId,
} from "./hero-powers.ts";
import { isHeroSecretDefinitionId } from "./hero-secrets.ts";
import {
  GREATER_TRINKET_ROUND,
  LESSER_TRINKET_ROUND,
  areOwnedTrinketDefinitionIdsValid,
  getTrinketAliasKind,
  getTrinketDefinition,
  isSystemEventDefinitionId,
  isSystemTavernSpellDefinitionId,
  isTrinketDefinitionId,
  trinketCanBeOfferedWithHeroPower,
} from "./lobby-systems.ts";
import {
  areTrinketOfferCandidatesValid,
  type TrinketOfferBoardUnit,
} from "./trinket-offers.ts";
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
export const LEGACY_SCHEMA_8_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v12";
export const LEGACY_SCHEMA_9_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v13";
export const LEGACY_SCHEMA_10_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v14";
export const LEGACY_SCHEMA_11_CONTENT_VERSION =
  "battlegrounds-36.0.3-247416-v15";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V16 =
  "battlegrounds-36.0.3-247416-v16";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V17 =
  "battlegrounds-36.0.3-247416-v17";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V18 =
  "battlegrounds-36.0.3-247416-v18";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V19 =
  "battlegrounds-36.0.3-247416-v19";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V20 =
  "battlegrounds-36.0.3-247416-v20";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V21 =
  "battlegrounds-36.0.3-247416-v21";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V22 =
  "battlegrounds-36.0.3-247416-v22";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V23 =
  "battlegrounds-36.0.3-247416-v23";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V24 =
  "battlegrounds-36.0.3-247416-v24";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V25 =
  "battlegrounds-36.0.3-247416-v25";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V26 =
  "battlegrounds-36.0.3-247416-v26";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V27 =
  "battlegrounds-36.0.3-247416-v27";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V28 =
  "battlegrounds-36.0.3-247416-v28";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V29 =
  "battlegrounds-36.0.3-247416-v29";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V30 =
  "battlegrounds-36.0.3-247416-v30";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V31 =
  "battlegrounds-36.0.3-247416-v31";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V32 =
  "battlegrounds-36.0.3-247416-v32";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V33 =
  "battlegrounds-36.0.3-247416-v33";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V34 =
  "battlegrounds-36.0.3-247416-v34";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V35 =
  "battlegrounds-36.0.3-247416-v35";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V36 =
  "battlegrounds-36.0.3-247416-v36";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V37 =
  "battlegrounds-36.0.3-247416-v37";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V38 =
  "battlegrounds-36.0.3-247416-v38";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V39 =
  "battlegrounds-36.0.3-247416-v39";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V40 =
  "battlegrounds-36.0.3-247416-v40";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V41 =
  "battlegrounds-36.0.3-247416-v41";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V42 =
  "battlegrounds-36.0.3-247416-v42";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V43 =
  "battlegrounds-36.0.3-247416-v43";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V44 =
  "battlegrounds-36.0.3-247416-v44";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V45 =
  "battlegrounds-36.0.3-247416-v45";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V46 =
  "battlegrounds-36.0.3-247416-v46";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V47 =
  "battlegrounds-36.0.3-247416-v47";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V48 =
  "battlegrounds-36.0.3-247416-v48";
export const LEGACY_SCHEMA_11_CONTENT_VERSION_V49 =
  "battlegrounds-36.0.3-247416-v49";

const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;
const HERO_POWER_COUNTER_KEY_SET = new Set<string>(
  Object.values(HERO_POWER_COUNTER_KEYS),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isTribe(value: unknown): value is Tribe {
  return typeof value === "string" && Object.hasOwn(TRIBE_NAMES, value);
}

function isTrinketOfferBoardUnit(
  value: unknown,
): value is TrinketOfferBoardUnit {
  return (
    isRecord(value) &&
    isTribe(value.tribe) &&
    Array.isArray(value.tribes) &&
    value.tribes.every(isTribe)
  );
}

function migrateLegacyLobbySystems(
  value: Record<string, unknown>,
): boolean {
  if (
    !Array.isArray(value.players) ||
    !value.players.every(isRecord)
  ) {
    return false;
  }
  value.lobbySystemsEnabled = false;
  value.systemEventId = null;
  if (
    isRecord(value.pendingInteraction) &&
    (value.pendingInteraction.kind === "heroChoice" ||
      value.pendingInteraction.kind === "trinketChoice")
  ) {
    value.pendingInteraction = null;
  }
  for (const player of value.players) {
    if (!Array.isArray(player.hand)) {
      return false;
    }
    player.hand = player.hand.filter(
      (card) =>
        !isRecord(card) ||
        typeof card.definitionId !== "string" ||
        !isSystemTavernSpellDefinitionId(card.definitionId),
    );
    player.heroId = null;
    player.heroPowerCounters = {};
    player.trinketIds = [];
    player.trinketCounters = {};
    player.systemEventCounters = {};
    player.trinketSelections = {};
    player.pendingMysteryCubeReplacementIds = [];
    player.pendingSystemSpellIds = [];
    player.freeTavernSpellPurchases = 0;
    player.heroRefreshAvailable = false;
  }
  return true;
}

function repairTrinketSelections(
  value: Record<string, unknown>,
): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (player.trinketSelections === undefined) {
      player.trinketSelections = {};
    }
    if (
      !isRecord(player.trinketSelections) ||
      Array.isArray(player.trinketSelections)
    ) {
      return false;
    }
  }
  return true;
}

function repairPendingMysteryCubeReplacements(
  value: Record<string, unknown>,
): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (player.pendingMysteryCubeReplacementIds === undefined) {
      player.pendingMysteryCubeReplacementIds = [];
    }
  }
  return true;
}

function repairHeroSecrets(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (player.secretIds === undefined) {
      player.secretIds = [];
      continue;
    }
    if (
      !Array.isArray(player.secretIds) ||
      !player.secretIds.every(
        (id) => typeof id === "string" && isHeroSecretDefinitionId(id),
      )
    ) {
      return false;
    }
  }
  return true;
}

function isMysteryCubeTrinketSlotId(id: string): boolean {
  return (
    getTrinketAliasKind(id) === "mysteryCubeReplacement" ||
    getTrinketDefinition(id).cardId === "BG30_MagicItem_703"
  );
}

function repairHeroPowerCounters(
  value: Record<string, unknown>,
): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (player.heroPowerCounters === undefined) {
      player.heroPowerCounters = createInitialHeroPowerCounters(
        typeof player.heroPowerId === "string" &&
          isHeroPowerDefinitionId(player.heroPowerId)
          ? player.heroPowerId
          : null,
      );
      continue;
    }
    if (
      !isRecord(player.heroPowerCounters) ||
      Array.isArray(player.heroPowerCounters) ||
      !Object.entries(player.heroPowerCounters).every(
        ([definitionId, count]) =>
          HERO_POWER_COUNTER_KEY_SET.has(definitionId) &&
          typeof count === "number" &&
          Number.isInteger(count) &&
          count >= 0,
      )
    ) {
      return false;
    }
    const expectedCounters = createInitialHeroPowerCounters(
      typeof player.heroPowerId === "string" &&
        isHeroPowerDefinitionId(player.heroPowerId)
        ? player.heroPowerId
        : null,
    );
    if (
      Object.keys(player.heroPowerCounters).some(
        (key) => !(key in expectedCounters),
      )
    ) {
      return false;
    }
    for (const [key, fallback] of Object.entries(expectedCounters)) {
      if (player.heroPowerCounters[key] === undefined) {
        player.heroPowerCounters[key] = fallback;
      }
    }
  }
  return true;
}

function repairHeroRefreshAvailability(
  value: Record<string, unknown>,
): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (typeof player.heroRefreshAvailable === "boolean") {
      continue;
    }
    if (player.heroRefreshAvailable !== undefined) {
      return false;
    }
    const isNozdormu =
      player.heroPowerId === "hero-power-see-the-future";
    const savedFreeRefreshes =
      typeof player.freeRefreshes === "number" &&
      Number.isInteger(player.freeRefreshes) &&
      player.freeRefreshes >= 0
        ? player.freeRefreshes
        : 0;
    player.heroRefreshAvailable =
      isNozdormu && (value.round === 1 || savedFreeRefreshes > 0);
    if (isNozdormu && savedFreeRefreshes > 0) {
      player.freeRefreshes = savedFreeRefreshes - 1;
    }
  }
  return true;
}

function repairStaleLobbyInteraction(
  value: Record<string, unknown>,
): boolean {
  const pending = value.pendingInteraction;
  if (
    !isRecord(pending) ||
    (pending.kind !== "heroChoice" && pending.kind !== "trinketChoice")
  ) {
    return true;
  }
  if (!Array.isArray(value.players)) {
    return false;
  }
  const player = value.players.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.id === pending.playerId,
  );
  if (!isRecord(player)) {
    return false;
  }
  if (value.lobbySystemsEnabled !== true || player.isHuman !== true) {
    value.pendingInteraction = null;
    return true;
  }
  if (pending.kind === "heroChoice") {
    if (
      !Array.isArray(pending.optionIds) ||
      pending.optionIds.length !== 4 ||
      new Set(pending.optionIds).size !== pending.optionIds.length ||
      !pending.optionIds.every(
        (definitionId) =>
          typeof definitionId === "string" &&
          isHeroDefinitionId(definitionId),
      )
    ) {
      return false;
    }
    if (
      player.heroId !== null ||
      value.phase !== "recruit" ||
      value.round !== 1
    ) {
      value.pendingInteraction = null;
    }
    return true;
  }
  const replacementId = pending.replaceTrinketId;
  const additionalTrinketSourceId = pending.additionalTrinketSourceId;
  const isMysteryCubeReplacement =
    typeof replacementId === "string" &&
    Array.isArray(player.trinketIds) &&
    player.trinketIds.includes(replacementId) &&
    isTrinketDefinitionId(replacementId) &&
    isMysteryCubeTrinketSlotId(replacementId) &&
    pending.trinketTier === "lesser";
  const expectedOptionCount = isMysteryCubeReplacement ? 2 : 4;
  const eligibleHeroPowerId =
    typeof player.heroPowerId === "string" &&
    isHeroPowerDefinitionId(player.heroPowerId)
      ? player.heroPowerId
      : null;
  if (
    (pending.trinketTier !== "lesser" &&
      pending.trinketTier !== "greater") ||
    !Array.isArray(pending.optionIds) ||
    !pending.optionIds.every(
      (definitionId) =>
        typeof definitionId === "string" &&
        isTrinketDefinitionId(definitionId) &&
        getTrinketAliasKind(definitionId) === null &&
        trinketCanBeOfferedWithHeroPower(
          getTrinketDefinition(definitionId),
          eligibleHeroPowerId,
        ),
    ) ||
    !Array.isArray(player.board) ||
    !player.board.every(isTrinketOfferBoardUnit) ||
    !Array.isArray(value.activeTribes) ||
    !value.activeTribes.every(isTribe) ||
    !areTrinketOfferCandidatesValid({
      tier: pending.trinketTier,
      candidates: pending.optionIds.map(getTrinketDefinition),
      board: player.board,
      activeTribes: value.activeTribes,
      count: expectedOptionCount,
    })
  ) {
    return false;
  }
  if (!Array.isArray(player.trinketIds)) {
    return false;
  }
  const ownsRawTier = player.trinketIds.some(
    (definitionId) => {
      if (
        typeof definitionId !== "string" ||
        !isTrinketDefinitionId(definitionId)
      ) {
        return false;
      }
      const aliasKind = getTrinketAliasKind(definitionId);
      return (
        (aliasKind === null || aliasKind === "mysteryCubeReplacement") &&
        getTrinketDefinition(definitionId).tier === pending.trinketTier
      );
    },
  );
  const trinketCounters = isRecord(player.trinketCounters)
    ? player.trinketCounters
    : null;
  const isTripVouchersReplacement =
    typeof replacementId === "string" &&
    player.trinketIds.includes(replacementId) &&
    isTrinketDefinitionId(replacementId) &&
    getTrinketDefinition(replacementId).cardId === "BG30_MagicItem_891" &&
    trinketCounters !== null &&
    typeof trinketCounters[replacementId] === "number" &&
    trinketCounters[replacementId] >= 2 &&
    pending.trinketTier === "greater" &&
    value.round === LESSER_TRINKET_ROUND + 2;
  if (
    replacementId !== undefined &&
    !isTripVouchersReplacement &&
    !isMysteryCubeReplacement
  ) {
    return false;
  }
  if (isMysteryCubeReplacement) {
    const ownedCardIds = new Set(
      player.trinketIds
        .filter(
          (definitionId): definitionId is string =>
            typeof definitionId === "string" &&
            isTrinketDefinitionId(definitionId),
        )
        .map((definitionId) => getTrinketDefinition(definitionId).cardId),
    );
    if (
      additionalTrinketSourceId !== undefined ||
      pending.optionIds.some((definitionId) => {
        const cardId = getTrinketDefinition(definitionId).cardId;
        return cardId === "BG30_MagicItem_703" || ownedCardIds.has(cardId);
      })
    ) {
      return false;
    }
  }
  const isMysteriousOrbAdditional =
    typeof additionalTrinketSourceId === "string" &&
    replacementId === undefined &&
    player.trinketIds.includes(additionalTrinketSourceId) &&
    isTrinketDefinitionId(additionalTrinketSourceId) &&
    getTrinketDefinition(additionalTrinketSourceId).cardId ===
      "BG35_MagicItem_818" &&
    trinketCounters !== null &&
    trinketCounters[additionalTrinketSourceId] === 1 &&
    pending.trinketTier === "lesser" &&
    value.round === GREATER_TRINKET_ROUND &&
    pending.optionIds.every(
      (definitionId) =>
        !(player.trinketIds as unknown[]).includes(definitionId),
    );
  if (
    additionalTrinketSourceId !== undefined &&
    !isMysteriousOrbAdditional
  ) {
    return false;
  }
  const hasDueOrnateClock =
    pending.trinketTier === "greater" &&
    value.round === LESSER_TRINKET_ROUND + 1 &&
    trinketCounters !== null &&
    player.trinketIds.some(
      (definitionId) =>
        typeof definitionId === "string" &&
        isTrinketDefinitionId(definitionId) &&
        getTrinketDefinition(definitionId).cardId ===
          "BG32_MagicItem_271" &&
        typeof trinketCounters[definitionId] === "number" &&
        trinketCounters[definitionId] >= 1,
    );
  const isRegularOffer =
    replacementId === undefined &&
    additionalTrinketSourceId === undefined &&
    ((pending.trinketTier === "lesser" &&
      value.round === LESSER_TRINKET_ROUND) ||
      (pending.trinketTier === "greater" &&
        (value.round === GREATER_TRINKET_ROUND ||
          hasDueOrnateClock)));
  if (
    (!isTripVouchersReplacement &&
      !isMysteryCubeReplacement &&
      !isMysteriousOrbAdditional &&
      ownsRawTier) ||
    value.phase !== "recruit" ||
    (!isTripVouchersReplacement &&
      !isMysteryCubeReplacement &&
      !isMysteriousOrbAdditional &&
      !isRegularOffer)
  ) {
    value.pendingInteraction = null;
  }
  return true;
}

function hasValidLobbySystemPlayerState(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (
    value.heroId !== null &&
    (typeof value.heroId !== "string" ||
      !isHeroDefinitionId(value.heroId))
  ) {
    return false;
  }
  if (
    value.heroPowerId !== null &&
    (typeof value.heroPowerId !== "string" ||
      !isHeroPowerDefinitionId(value.heroPowerId))
  ) {
    return false;
  }
  if (
    !isRecord(value.heroPowerCounters) ||
    Array.isArray(value.heroPowerCounters) ||
    !Object.entries(value.heroPowerCounters).every(
      ([definitionId, count]) =>
        HERO_POWER_COUNTER_KEY_SET.has(definitionId) &&
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= 0,
    )
  ) {
    return false;
  }
  const trinketIds = value.trinketIds;
  if (
    !Array.isArray(trinketIds) ||
    !areOwnedTrinketDefinitionIdsValid(trinketIds)
  ) {
    return false;
  }
  const normalizedTrinketIds = trinketIds as string[];
  if (
    !isRecord(value.trinketCounters) ||
    Array.isArray(value.trinketCounters) ||
    !Object.entries(value.trinketCounters).every(
      ([definitionId, count]) =>
        normalizedTrinketIds.includes(definitionId) &&
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= 0,
    )
  ) {
    return false;
  }
  if (
    !isRecord(value.trinketSelections) ||
    Array.isArray(value.trinketSelections) ||
    !Object.entries(value.trinketSelections).every(
      ([definitionId, selectedMinionDefinitionId]) => {
        if (
          !normalizedTrinketIds.includes(definitionId) ||
          typeof selectedMinionDefinitionId !== "string"
        ) {
          return false;
        }
        try {
          getMinionDefinition(selectedMinionDefinitionId);
          return true;
        } catch {
          return false;
        }
      },
    )
  ) {
    return false;
  }
  if (
    !Array.isArray(value.pendingMysteryCubeReplacementIds) ||
    new Set(value.pendingMysteryCubeReplacementIds).size !==
      value.pendingMysteryCubeReplacementIds.length ||
    !value.pendingMysteryCubeReplacementIds.every(
      (definitionId) =>
        typeof definitionId === "string" &&
        normalizedTrinketIds.includes(definitionId) &&
        isTrinketDefinitionId(definitionId) &&
        isMysteryCubeTrinketSlotId(definitionId),
    )
  ) {
    return false;
  }
  return (
    Array.isArray(value.pendingSystemSpellIds) &&
    value.pendingSystemSpellIds.every(
      (definitionId) =>
        typeof definitionId === "string" &&
        isSystemTavernSpellDefinitionId(definitionId),
    ) &&
    typeof value.freeTavernSpellPurchases === "number" &&
    Number.isInteger(value.freeTavernSpellPurchases) &&
    value.freeTavernSpellPurchases >= 0 &&
    typeof value.heroRefreshAvailable === "boolean"
  );
}

function hasValidLobbySystemState(
  value: Record<string, unknown>,
): boolean {
  return (
    typeof value.lobbySystemsEnabled === "boolean" &&
    (value.lobbySystemsEnabled
      ? typeof value.systemEventId === "string" &&
        isSystemEventDefinitionId(value.systemEventId)
      : value.systemEventId === null) &&
    Array.isArray(value.players) &&
    value.players.every(hasValidLobbySystemPlayerState)
  );
}

function repairInitialHealth(value: Record<string, unknown>): boolean {
  if (value.initialHealth === undefined) {
    value.initialHealth = DEFAULT_INITIAL_HEALTH;
    return true;
  }
  return isValidInitialHealth(value.initialHealth);
}

function hasZeroAttachmentPoolOwnership(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.poolCopies === 0 &&
    Array.isArray(value.attachments) &&
    value.attachments.every(hasZeroAttachmentPoolOwnership)
  );
}

function repairGhostHandSnapshots(
  value: Record<string, unknown>,
): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (player.ghostHand === undefined) {
      player.ghostHand = [];
    }
    if (
      !Array.isArray(player.ghostHand) ||
      player.ghostHand.some(
        (card) =>
          !isRecord(card) ||
          card.kind !== "minion" ||
          card.poolCopies !== 0 ||
          card.poolCopiesOnPurchase !== undefined ||
          card.poolCopiesByDefinitionId !== undefined ||
          !Array.isArray(card.attachments) ||
          !card.attachments.every(hasZeroAttachmentPoolOwnership),
      )
    ) {
      return false;
    }
  }
  return true;
}

function hasValidPoolOwnershipMap(card: unknown): boolean {
  if (!isRecord(card) || card.kind !== "minion") {
    return true;
  }
  const ownership = card.poolCopiesByDefinitionId;
  if (ownership === undefined) {
    return true;
  }
  if (!isRecord(ownership) || Array.isArray(ownership)) {
    return false;
  }
  let total = 0;
  for (const [definitionId, copies] of Object.entries(ownership)) {
    try {
      getMinionDefinition(definitionId);
    } catch {
      return false;
    }
    if (
      typeof copies !== "number" ||
      !Number.isInteger(copies) ||
      copies < 0
    ) {
      return false;
    }
    total += copies;
  }
  return (
    typeof card.poolCopies === "number" &&
    Number.isInteger(card.poolCopies) &&
    card.poolCopies >= 0 &&
    total === card.poolCopies
  );
}

function hasValidOptionalUniqueStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (entry) => typeof entry === "string" && entry.length > 0,
      ) &&
      new Set(value).size === value.length)
  );
}

function repairSpellcraftRewardTier(value: unknown): void {
  if (!isRecord(value) || value.rewardTier === undefined) {
    return;
  }
  if (
    typeof value.rewardTier !== "number" ||
    !Number.isInteger(value.rewardTier) ||
    value.rewardTier < 1 ||
    value.rewardTier > 6
  ) {
    delete value.rewardTier;
  }
}

function repairMinionEffectCounters(value: unknown): void {
  if (!isRecord(value) || value.kind !== "minion") {
    return;
  }
  const counters = isRecord(value.effectCounters)
    ? value.effectCounters
    : {};
  value.effectCounters = counters;
  const repairInteger = (
    key: string,
    fallback: number,
    minimum: number,
    maximum = Number.POSITIVE_INFINITY,
  ): void => {
    const current = counters[key];
    counters[key] =
      typeof current === "number" &&
      Number.isInteger(current) &&
      current >= minimum &&
      current <= maximum
        ? current
        : fallback;
  };
  if (value.definitionId === "BG28_633") {
    repairInteger("playerSpellProgress", 0, 0, 2);
  } else if (value.definitionId === "BG35_895") {
    repairInteger("tavernSpellAuraCardsPlayedThisTurn", 0, 0, 1);
    repairInteger("tavernSpellAuraAttackBonusThisTurn", 0, 0);
    repairInteger("tavernSpellAuraHealthBonusThisTurn", 0, 0);
  } else if (value.definitionId === "BG31_920") {
    repairInteger("evolvingSpellcraftRewardTier", 1, 1, 6);
  } else if (value.definitionId === "BG33_891") {
    repairInteger(
      "tavernSpellPurchasesObservedThisTurn",
      0,
      0,
      value.golden === true ? 2 : 1,
    );
  } else if (value.definitionId === "BG34_950") {
    repairInteger("stoneAgeSlabPurchaseUsedThisTurn", 0, 0, 1);
  }
}

function repairTaughtTavernSpell(value: unknown): void {
  if (
    !isRecord(value) ||
    value.kind !== "minion" ||
    typeof value.definitionId !== "string"
  ) {
    return;
  }
  let definition: ReturnType<typeof getMinionDefinition>;
  try {
    definition = getMinionDefinition(value.definitionId);
  } catch {
    delete value.taughtTavernSpellDefinitionId;
    return;
  }
  const printedDescription =
    value.golden === true
      ? (definition.goldenDescription ?? definition.description)
      : definition.description;
  if (!definition.battlecryCastsTaughtTavernSpell) {
    delete value.taughtTavernSpellDefinitionId;
    return;
  }
  if (typeof value.taughtTavernSpellDefinitionId !== "string") {
    delete value.taughtTavernSpellDefinitionId;
    value.description = printedDescription;
    return;
  }
  try {
    const taught = getTavernSpellDefinition(
      value.taughtTavernSpellDefinitionId,
    );
    value.description =
      `战吼：施放“${taught.name}”。（${taught.description}）`;
  } catch {
    delete value.taughtTavernSpellDefinitionId;
    value.description = printedDescription;
  }
}

function repairSuppressedBloodGemStats(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(repairSuppressedBloodGemStats);
  }
  if (!isRecord(value)) {
    return true;
  }
  if (value.kind === "minion" || value.kind === "tripleReward") {
    for (const [suppressedField, totalField] of [
      ["suppressedBloodGemAttack", "bloodGemAttack"],
      ["suppressedBloodGemHealth", "bloodGemHealth"],
    ] as const) {
      if (value[suppressedField] === undefined) {
        value[suppressedField] = 0;
      }
      const suppressed = value[suppressedField];
      const total = value[totalField];
      if (
        typeof suppressed !== "number" ||
        !Number.isFinite(suppressed) ||
        suppressed < 0 ||
        typeof total !== "number" ||
        !Number.isFinite(total) ||
        total < 0 ||
        suppressed > total
      ) {
        return false;
      }
    }
  }
  return Object.values(value).every(repairSuppressedBloodGemStats);
}

function repairV42State(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.players)) {
    return false;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    for (const field of [
      "mrrgltonsPlayed",
      "tavernMinionAttackBonusThisTurn",
      "tavernMinionHealthBonusThisTurn",
      "playerSpellsCast",
      "battlecriesTriggered",
      "heroPowerExtraTriggers",
      "darkmoonReservePricesDiscount",
      "pendingTickatusTagPrizes",
      "elementalGrantAttackBonus",
      "elementalGrantHealthBonus",
      "deathrattlesTriggered",
      "magnetizationsThisGame",
    ] as const) {
      if (player[field] === undefined) {
        player[field] = 0;
      }
      if (
        typeof player[field] !== "number" ||
        !Number.isInteger(player[field]) ||
        player[field] < 0
      ) {
        return false;
      }
    }
    for (const zone of ["board", "hand", "ghostHand", "shop"] as const) {
      const cards = player[zone];
      if (!Array.isArray(cards) || !cards.every(hasValidPoolOwnershipMap)) {
        return false;
      }
      for (const card of cards) {
        if (
          isRecord(card) &&
          (!hasValidOptionalUniqueStringArray(
            card.deathlyStrikerLineageIds,
          ) ||
            !hasValidOptionalUniqueStringArray(
              card.deathlyStrikerCreatorIds,
            ))
        ) {
          return false;
        }
        repairSpellcraftRewardTier(card);
        repairMinionEffectCounters(card);
        repairTaughtTavernSpell(card);
      }
    }
    if (Array.isArray(player.pendingSpellcraft)) {
      for (const pending of player.pendingSpellcraft) {
        repairSpellcraftRewardTier(pending);
      }
    }
  }
  const playerIds = value.players
    .filter(isRecord)
    .map((player) => player.id)
    .filter((id): id is string => typeof id === "string");
  if (value.deferredTriplePlayerIds === undefined) {
    value.deferredTriplePlayerIds =
      value.phase === "combat"
        ? value.players
            .filter(
              (player): player is Record<string, unknown> =>
                isRecord(player) &&
                player.alive === true &&
                typeof player.id === "string",
            )
            .map((player) => player.id as string)
        : [];
  }
  if (
    !Array.isArray(value.deferredTriplePlayerIds) ||
    value.deferredTriplePlayerIds.some(
      (playerId) =>
        typeof playerId !== "string" || !playerIds.includes(playerId),
    ) ||
    new Set(value.deferredTriplePlayerIds).size !==
      value.deferredTriplePlayerIds.length
  ) {
    return false;
  }
  return repairSuppressedBloodGemStats(value);
}

function migrateBloodGemBarrageState(
  player: Record<string, unknown>,
): void {
  const legacyBarrageAttack =
    typeof player.tavernBloodGemBarrageAttack === "number"
      ? Math.max(0, player.tavernBloodGemBarrageAttack)
      : 0;
  const legacyBarrageHealth =
    typeof player.tavernBloodGemBarrageHealth === "number"
      ? Math.max(0, player.tavernBloodGemBarrageHealth)
      : 0;
  const hadLegacyBarrage =
    legacyBarrageAttack > 0 || legacyBarrageHealth > 0;
  const currentBloodGemAttack =
    typeof player.bloodGemAttack === "number"
      ? Math.max(0, player.bloodGemAttack)
      : 1;
  const currentBloodGemHealth =
    typeof player.bloodGemHealth === "number"
      ? Math.max(0, player.bloodGemHealth)
      : 1;
  player.tavernBloodGemBarrageCount = hadLegacyBarrage ? 1 : 0;
  player.tavernBloodGemBarrageAttack = hadLegacyBarrage
    ? Math.max(0, legacyBarrageAttack - currentBloodGemAttack)
    : 0;
  player.tavernBloodGemBarrageHealth = hadLegacyBarrage
    ? Math.max(0, legacyBarrageHealth - currentBloodGemHealth)
    : 0;
}

function migrateBeetleBonusState(
  player: Record<string, unknown>,
): void {
  player.beetleAttackBonus =
    typeof player.beetleAttackBonus === "number"
      ? Math.max(0, player.beetleAttackBonus)
      : 0;
  player.beetleHealthBonus =
    typeof player.beetleHealthBonus === "number"
      ? Math.max(0, player.beetleHealthBonus)
      : 0;
}

function repairHumanScoutingReports(
  value: Record<string, unknown>,
): boolean {
  if (value.humanScoutingReports === undefined) {
    const reports: Record<string, unknown> = {};
    const humanPlayerId =
      typeof value.humanPlayerId === "string"
        ? value.humanPlayerId
        : null;
    const battleCandidates = [
      value.lastBattle,
      ...(Array.isArray(value.lastRoundBattles)
        ? value.lastRoundBattles
        : []),
    ];
    const battle = battleCandidates.find(
      (candidate) =>
        humanPlayerId !== null &&
        isRecord(candidate) &&
        (candidate.playerAId === humanPlayerId ||
          candidate.playerBId === humanPlayerId),
    );
    if (
      humanPlayerId !== null &&
      isRecord(battle) &&
      typeof battle.playerAId === "string" &&
      typeof battle.playerBId === "string" &&
      typeof battle.round === "number" &&
      Number.isInteger(battle.round) &&
      typeof battle.isGhost === "boolean" &&
      isRecord(battle.initialBoards)
    ) {
      const opponentId =
        battle.playerAId === humanPlayerId
          ? battle.playerBId
          : battle.playerAId;
      const board = battle.initialBoards[opponentId];
      const resultForHuman =
        battle.resultForHuman === "win" ||
        battle.resultForHuman === "loss" ||
        battle.resultForHuman === "tie"
          ? battle.resultForHuman
          : battle.winnerId === null
            ? "tie"
            : battle.winnerId === humanPlayerId
              ? "win"
              : "loss";
      if (Array.isArray(board)) {
        reports[opponentId] = {
          opponentId,
          observedRound: battle.round,
          resultForHuman,
          isGhost: battle.isGhost,
          board: JSON.parse(JSON.stringify(board)),
        };
      }
    }
    value.humanScoutingReports = reports;
    return true;
  }
  return isRecord(value.humanScoutingReports);
}

function rebuildSpellPool(value: Record<string, unknown>): boolean {
  if (
    !Array.isArray(value.activeTribes) ||
    !Array.isArray(value.players)
  ) {
    return false;
  }
  const activeTribes = value.activeTribes.filter(
    (tribe): tribe is Tribe => typeof tribe === "string",
  );
  if (activeTribes.length !== value.activeTribes.length) {
    return false;
  }
  const spellPool: Record<string, number> = {};
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    spellPool[definition.id] = tavernSpellIsAvailable(
      definition,
      activeTribes,
    )
      ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
      : 0;
  }
  for (const player of value.players) {
    if (!isRecord(player)) {
      return false;
    }
    const offers = [
      player.spellShop,
      ...(Array.isArray(player.additionalSpellShop)
        ? player.additionalSpellShop
        : []),
    ];
    for (const offer of offers) {
      if (
        !isRecord(offer) ||
        offer.kind !== "tavernSpell" ||
        typeof offer.definitionId !== "string" ||
        !(offer.definitionId in spellPool)
      ) {
        continue;
      }
      spellPool[offer.definitionId] = Math.max(
        0,
        spellPool[offer.definitionId] - 1,
      );
    }
  }
  value.spellPool = spellPool;
  return true;
}

function hasValidSpellPool(value: Record<string, unknown>): boolean {
  if (
    !isRecord(value.spellPool) ||
    !Array.isArray(value.activeTribes)
  ) {
    return false;
  }
  const activeTribes = value.activeTribes.filter(
    (tribe): tribe is Tribe => typeof tribe === "string",
  );
  if (activeTribes.length !== value.activeTribes.length) {
    return false;
  }
  const expectedIds = new Set(
    TAVERN_SPELL_DEFINITIONS.map((definition) => definition.id),
  );
  if (
    Object.keys(value.spellPool).length !== expectedIds.size ||
    Object.keys(value.spellPool).some((id) => !expectedIds.has(id))
  ) {
    return false;
  }
  let remainingCopies = 0;
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    const copies = value.spellPool[definition.id];
    const maximum = tavernSpellIsAvailable(definition, activeTribes)
      ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
      : 0;
    if (
      typeof copies !== "number" ||
      !Number.isInteger(copies) ||
      copies < 0 ||
      copies > maximum
    ) {
      return false;
    }
    remainingCopies += copies;
  }
  return remainingCopies > 0;
}

function repairSpellPool(value: Record<string, unknown>): boolean {
  return hasValidSpellPool(value) || rebuildSpellPool(value);
}

function refreshMinionSupport(
  value: unknown,
  preservePersistentFields = false,
  preserveCurrentFields = false,
): void {
  if (
    !isRecord(value) ||
    value.kind !== "minion" ||
    typeof value.definitionId !== "string"
  ) {
    return;
  }
  const definition = getMinionDefinition(value.definitionId);
  value.effectSupport = definition.effectSupport ?? "complete";
  if (!preservePersistentFields) {
    value.whereverAttackBonus = 0;
    value.whereverHealthBonus = 0;
    value.astralAutomatonSummoned = false;
    value.ancientSoulFriendlyDeaths = 0;
  }
  if (!preserveCurrentFields) {
    value.effectCounters = {};
    value.temporaryGoldenCrabDeathrattles = 0;
  }
  value.crabDeathrattles =
    typeof value.crabDeathrattles === "number"
      ? value.crabDeathrattles
      : 0;
  value.goldenCrabDeathrattles =
    typeof value.goldenCrabDeathrattles === "number"
      ? value.goldenCrabDeathrattles
      : 0;
  value.temporaryVenomous =
    typeof value.temporaryVenomous === "boolean"
      ? value.temporaryVenomous
      : false;
  if (
    definition.conditionalKeyword?.keyword === "divineShield" &&
    typeof value.attack === "number" &&
    value.attack >= definition.conditionalKeyword.attackAtLeast
  ) {
    const counters = isRecord(value.effectCounters)
      ? value.effectCounters
      : {};
    value.effectCounters = counters;
    const alreadyTriggered =
      typeof counters.conditionalKeywordTriggered === "number" &&
      counters.conditionalKeywordTriggered > 0;
    if (!alreadyTriggered) {
      counters.conditionalKeywordTriggered = 1;
      value.divineShield = true;
      value.temporaryDivineShield = false;
    }
  }
  if (definition.stealth === true) {
    value.stealth = true;
  }
  if (value.golden === true) {
    value.cardId = definition.goldenCardId ?? value.cardId;
    value.description =
      definition.goldenDescription ?? value.description;
  }
  const growingStartOfCombat = definition.startOfCombat?.find(
    (effect) => effect.kind === "growingTribeBuff",
  );
  if (growingStartOfCombat?.kind === "growingTribeBuff") {
    const counters = isRecord(value.effectCounters)
      ? value.effectCounters
      : {};
    const attackBonus =
      typeof counters.startOfCombatAttackBonus === "number"
        ? counters.startOfCombatAttackBonus
        : 0;
    const healthBonus =
      typeof counters.startOfCombatHealthBonus === "number"
        ? counters.startOfCombatHealthBonus
        : 0;
    const scale =
      value.golden === true &&
      growingStartOfCombat.goldenMode === "doubleStats"
        ? 2
        : 1;
    value.description =
      `战斗开始时：使你的龙获得+` +
      `${growingStartOfCombat.attack * scale + attackBonus}/+` +
      `${growingStartOfCombat.health * scale + healthBonus}。` +
      "在你施放一个酒馆法术后永久提升此效果。";
  }
  const upgradingSatellites = definition.endOfTurn;
  if (
    upgradingSatellites?.kind ===
    "gainUpgradingMagneticSatellites"
  ) {
    const counters = isRecord(value.effectCounters)
      ? value.effectCounters
      : {};
    value.effectCounters = counters;
    const attackBonus =
      typeof counters.magneticSatelliteAttackBonus === "number"
        ? counters.magneticSatelliteAttackBonus
        : 0;
    const healthBonus =
      typeof counters.magneticSatelliteHealthBonus === "number"
        ? counters.magneticSatelliteHealthBonus
        : 0;
    counters.magneticSatelliteAttackBonus = attackBonus;
    counters.magneticSatelliteHealthBonus = healthBonus;
    const scale =
      value.golden === true &&
      upgradingSatellites.goldenMode === "doubleStats"
        ? 2
        : 1;
    value.description =
      `在你的回合结束时，获取两张` +
      `${upgradingSatellites.attack * scale + attackBonus}/` +
      `${upgradingSatellites.health * scale + healthBonus}的磁力卫星` +
      "并提升此效果。";
  }
  const growingSummon = definition.afterFriendlySummoned;
  if (growingSummon?.permanentAttackGrowth !== undefined) {
    const counters = isRecord(value.effectCounters)
      ? value.effectCounters
      : {};
    const attackBonus =
      typeof counters.summonAttackGrowth === "number"
        ? counters.summonAttackGrowth
        : 0;
    const scale = value.golden === true ? 2 : 1;
    value.description =
      `每当你召唤野兽时，使其获得+` +
      `${(growingSummon.attack ?? 0) * scale + attackBonus}攻击力` +
      "并永久提升此效果。";
  }
}

function refreshOwnedMinions(
  migrated: Record<string, unknown>,
  preservePendingSpellcraft = false,
  preservePersistentFields = false,
  preserveCurrentFields = false,
): boolean {
  if (!Array.isArray(migrated.players)) {
    return false;
  }
  for (const player of migrated.players) {
    if (!isRecord(player)) {
      return false;
    }
    if (preservePendingSpellcraft) {
      if (!Array.isArray(player.pendingSpellcraft)) {
        return false;
      }
    } else {
      // v16 and earlier had no deferred Spellcraft state, so no queue from
      // those payloads is trustworthy or meaningful.
      player.pendingSpellcraft = [];
    }
    if (!preservePersistentFields) {
      player.astralAutomatonsSummoned = 0;
      player.eternalKnightsDied = 0;
    }
    if (!preserveCurrentFields) {
      player.nextTavernSpellDiscount = 0;
    }
    if (player.ghostHand === undefined) {
      player.ghostHand = [];
    }
    for (const zone of [
      "board",
      "hand",
      "ghostHand",
      "shop",
    ] as const) {
      const cards = player[zone];
      if (!Array.isArray(cards)) {
        return false;
      }
      cards.forEach((card) =>
        refreshMinionSupport(
          card,
          preservePersistentFields,
          preserveCurrentFields,
        ),
      );
    }
  }
  if (
    isRecord(migrated.pendingInteraction) &&
    migrated.pendingInteraction.kind === "discover" &&
    Array.isArray(migrated.pendingInteraction.options)
  ) {
    migrated.pendingInteraction.options.forEach((option) =>
      refreshMinionSupport(
        option,
        preservePersistentFields,
        preserveCurrentFields,
      ),
    );
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
    value.temporaryAttack =
      typeof value.temporaryAttack === "number"
        ? value.temporaryAttack
        : 0;
    value.temporaryHealth =
      typeof value.temporaryHealth === "number"
        ? value.temporaryHealth
        : 0;
    value.temporaryTaunt =
      typeof value.temporaryTaunt === "boolean"
        ? value.temporaryTaunt
        : false;
    value.temporaryDivineShield =
      typeof value.temporaryDivineShield === "boolean"
        ? value.temporaryDivineShield
        : false;
    value.temporaryVenomous =
      typeof value.temporaryVenomous === "boolean"
        ? value.temporaryVenomous
        : false;
    value.temporaryCrabDeathrattles =
      typeof value.temporaryCrabDeathrattles === "number"
        ? value.temporaryCrabDeathrattles
        : 0;
    if (
      value.playableFromRound !== undefined &&
      typeof value.playableFromRound !== "number"
    ) {
      delete value.playableFromRound;
    }
    if (
      value.destroyAfterPlayThroughRound !== undefined &&
      typeof value.destroyAfterPlayThroughRound !== "number"
    ) {
      delete value.destroyAfterPlayThroughRound;
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

function migrateSchema7To8(value: unknown): unknown {
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
    migrated.contentVersion = LEGACY_SCHEMA_8_CONTENT_VERSION;
    migrated.nextInstanceId = nextInstanceId;
    migrated.spellPool = spellPool;
    return migrated;
  } catch {
    return null;
  }
}

function migrateSchema8To9(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 8 ||
    value.contentVersion !== LEGACY_SCHEMA_8_CONTENT_VERSION ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.activeTribes) ||
    !value.activeTribes.every((tribe) => typeof tribe === "string")
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

    for (const player of migrated.players) {
      if (!isRecord(player)) {
        return null;
      }
      player.tavernSpellAttackBonus = 0;
      player.tavernSpellHealthBonus = 0;
      player.tavernTypeBuffs = [];
      player.rideTheWindBuffs = [];
      player.elementalsPlayedThisTurn = 0;
      player.nextCombatBeetles = 0;
      player.ballerAttackBonus = 1;
      player.ballerHealthBonus = 1;
      player.deepBlueBonus = 0;

      if (!isRecord(player.spellShop)) {
        player.spellShop = null;
        continue;
      }
      try {
        const definition = getTavernSpellDefinition(
          String(player.spellShop.definitionId),
        );
        if (
          player.alive === true &&
          tavernSpellIsAvailable(definition, activeTribes) &&
          spellPool[definition.id] > 0
        ) {
          refreshMigratedSpell(player.spellShop, definition);
          spellPool[definition.id] -= 1;
        } else {
          player.spellShop = null;
        }
      } catch {
        player.spellShop = null;
      }
    }

    migrated.version = 9;
    migrated.contentVersion = LEGACY_SCHEMA_9_CONTENT_VERSION;
    migrated.spellPool = spellPool;
    return migrated;
  } catch {
    return null;
  }
}

function refreshLegacyBattleArmor(value: unknown): void {
  if (!isRecord(value)) {
    return;
  }
  value.playerAArmorBefore =
    typeof value.playerAArmorBefore === "number"
      ? value.playerAArmorBefore
      : 0;
  value.playerBArmorBefore =
    typeof value.playerBArmorBefore === "number"
      ? value.playerBArmorBefore
      : 0;
  value.playerAArmorAfter =
    typeof value.playerAArmorAfter === "number"
      ? value.playerAArmorAfter
      : 0;
  value.playerBArmorAfter =
    typeof value.playerBArmorAfter === "number"
      ? value.playerBArmorAfter
      : 0;
}

function migrateSchema9To10(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 9 ||
    value.contentVersion !== LEGACY_SCHEMA_9_CONTENT_VERSION ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.activeTribes) ||
    !value.activeTribes.every((tribe) => typeof tribe === "string")
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

    for (const player of migrated.players) {
      if (!isRecord(player)) {
        return null;
      }
      player.armor = 0;
      player.heroPowerId = null;
      player.additionalSpellShop = [];
      player.spellOnlyRefreshActive = false;
      player.nextCombatSetEnemyHealthToOne = 0;
      player.nextCombatDoubleLeftmostAttack = [];
      player.undeadArmyAttackBonus = 0;
      player.undeadArmyHealthBonus = 0;

      if (!isRecord(player.spellShop)) {
        player.spellShop = null;
        continue;
      }
      try {
        const definition = getTavernSpellDefinition(
          String(player.spellShop.definitionId),
        );
        if (
          player.alive === true &&
          typeof player.tavernTier === "number" &&
          definition.tier <= player.tavernTier &&
          tavernSpellIsAvailable(definition, activeTribes) &&
          spellPool[definition.id] > 0
        ) {
          refreshMigratedSpell(player.spellShop, definition);
          spellPool[definition.id] -= 1;
        } else {
          player.spellShop = null;
        }
      } catch {
        player.spellShop = null;
      }
    }

    refreshLegacyBattleArmor(migrated.lastBattle);
    if (Array.isArray(migrated.lastRoundBattles)) {
      migrated.lastRoundBattles.forEach(refreshLegacyBattleArmor);
    }
    migrated.version = 10;
    migrated.contentVersion = LEGACY_SCHEMA_10_CONTENT_VERSION;
    migrated.spellPool = spellPool;
    return migrated;
  } catch {
    return null;
  }
}

export function migrateSchema10GameState(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 10 ||
    value.contentVersion !== LEGACY_SCHEMA_10_CONTENT_VERSION ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.activeTribes) ||
    !value.activeTribes.every((tribe) => typeof tribe === "string")
  ) {
    return null;
  }
  try {
    const migrated: unknown = JSON.parse(JSON.stringify(value));
    if (
      !isRecord(migrated) ||
      !Array.isArray(migrated.players) ||
      !Array.isArray(migrated.activeTribes) ||
      !refreshOwnedMinions(migrated)
    ) {
      return null;
    }
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

    for (const player of migrated.players) {
      if (
        !isRecord(player) ||
        typeof player.alive !== "boolean" ||
        typeof player.tavernTier !== "number" ||
        player.tavernTier < 1 ||
        player.tavernTier > 6
      ) {
        return null;
      }
      player.helpfulRefreshes = 0;
      player.lastHelpfulRefreshKind = null;
      player.tavernTierBuffs = [];
      player.tavernSpellsCast = 0;
      migrateBeetleBonusState(player);
      migrateBloodGemBarrageState(player);

      const reserveOffer = (offer: unknown): Record<string, unknown> | null => {
        if (!isRecord(offer) || !player.alive) {
          return null;
        }
        try {
          const definition = getTavernSpellDefinition(
            String(offer.definitionId),
          );
          if (
            definition.tier > (player.tavernTier as TavernTier) ||
            !tavernSpellIsAvailable(definition, activeTribes) ||
            spellPool[definition.id] <= 0
          ) {
            return null;
          }
          refreshMigratedSpell(offer, definition);
          spellPool[definition.id] -= 1;
          return offer;
        } catch {
          return null;
        }
      };

      player.spellShop = reserveOffer(player.spellShop);
      const additionalOffers = Array.isArray(player.additionalSpellShop)
        ? player.additionalSpellShop
        : [];
      player.additionalSpellShop = additionalOffers
        .map(reserveOffer)
        .filter((offer): offer is Record<string, unknown> => offer !== null);
      if (
        player.spellShop === null &&
        (player.additionalSpellShop as unknown[]).length === 0
      ) {
        player.spellOnlyRefreshActive = false;
      }
    }

    if (!migrateLegacyLobbySystems(migrated)) {
      return null;
    }

    migrated.version = 11;
    migrated.contentVersion = CURRENT_ROSTER_VERSION;
    migrated.spellPool = spellPool;
    if (
      !repairInitialHealth(migrated) ||
      !repairHumanScoutingReports(migrated)
    ) {
      return null;
    }
    return migrated;
  } catch {
    return null;
  }
}

export function migrateSchema11GameState(value: unknown): unknown {
  if (
    !isRecord(value) ||
    value.version !== 11 ||
    (value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V16 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V17 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V18 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V19 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V20 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V21 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V22 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V23 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V24 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V25 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V26 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V27 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V28 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V29 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V30 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V31 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V32 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V33 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V34 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V35 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V36 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V37 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V38 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V39 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V40 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V41 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V42 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V43 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V44 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V45 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V46 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V47 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V48 &&
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V49) ||
    !Array.isArray(value.players)
  ) {
    return null;
  }
  try {
    const preservePersistentFields = [
      LEGACY_SCHEMA_11_CONTENT_VERSION_V18,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V19,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V20,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V21,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V22,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V23,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V24,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V25,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V26,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V27,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V28,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V29,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V30,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V31,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V32,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V33,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V34,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V35,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V36,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V37,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V38,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V39,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V40,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V41,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V42,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V43,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V44,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V45,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V46,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V47,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V48,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V49,
    ].includes(value.contentVersion as string);
    const preserveCurrentFields = [
      LEGACY_SCHEMA_11_CONTENT_VERSION_V19,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V20,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V21,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V22,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V23,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V24,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V25,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V26,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V27,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V28,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V29,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V30,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V31,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V32,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V33,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V34,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V35,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V36,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V37,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V38,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V39,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V40,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V41,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V42,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V43,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V44,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V45,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V46,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V47,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V48,
      LEGACY_SCHEMA_11_CONTENT_VERSION_V49,
    ].includes(value.contentVersion as string);
    const preserveTavernTierBuffs =
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V35 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V36 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V37 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V38 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V39 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V40 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V41 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V42 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V43 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V44 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V45 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V46 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V47 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V48 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V49;
    const preservePendingSpellcraft =
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V17 ||
      preservePersistentFields;
    const preserveTavernSpellHistory =
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V39 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V40 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V41 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V42 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V43 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V44 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V45 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V46 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V47 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V48 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V49;
    const preserveLobbySystems =
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V40 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V41 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V42 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V43 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V44 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V45 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V46 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V47 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V48 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V49;
    const preservePlayerSpellHistory =
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V45 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V46 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V47 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V48 ||
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V49;
    const migrated: unknown = JSON.parse(JSON.stringify(value));
    if (
      !isRecord(migrated) ||
      !refreshOwnedMinions(
        migrated,
        preservePendingSpellcraft,
        preservePersistentFields,
        preserveCurrentFields,
      ) ||
      !repairSpellPool(migrated)
    ) {
      return null;
    }
    if (!Array.isArray(migrated.players)) {
      return null;
    }
    for (const player of migrated.players) {
      if (!isRecord(player)) {
        return null;
      }
      player.cardsPlayedThisTurn = 0;
      player.goldSpentThisTurn = 0;
      player.mrrgltonsPlayed = 0;
      player.tavernMinionAttackBonusThisTurn = 0;
      player.tavernMinionHealthBonusThisTurn = 0;
      player.pendingCardPlayed = null;
      const lastTavernSpellDefinitionId =
        player.lastTavernSpellDefinitionId;
      player.lastTavernSpellDefinitionId = null;
      if (
        preserveTavernSpellHistory &&
        typeof lastTavernSpellDefinitionId === "string"
      ) {
        try {
          getTavernSpellDefinition(lastTavernSpellDefinitionId);
          player.lastTavernSpellDefinitionId =
            lastTavernSpellDefinitionId;
        } catch {
          // Invalid legacy identifiers are dropped so copy-last-spell effects
          // cannot crash after the save is resumed.
        }
      }
      player.pendingTavernSpellDefinitionId = null;
      player.tavernSpellsCast =
        preserveTavernSpellHistory &&
        typeof player.tavernSpellsCast === "number"
          ? Math.max(0, Math.floor(player.tavernSpellsCast))
          : 0;
      player.playerSpellsCast =
        preservePlayerSpellHistory &&
        typeof player.playerSpellsCast === "number" &&
        Number.isFinite(player.playerSpellsCast)
          ? Math.max(0, Math.floor(player.playerSpellsCast))
          : 0;
      player.demonFodderRefreshQueue = [];
      player.tavernTierBuffs =
        preserveTavernTierBuffs &&
        Array.isArray(player.tavernTierBuffs)
          ? player.tavernTierBuffs
          : [];
      migrateBeetleBonusState(player);
      migrateBloodGemBarrageState(player);
    }
    if (
      (!preserveLobbySystems && !migrateLegacyLobbySystems(migrated)) ||
      !repairInitialHealth(migrated) ||
      !repairHumanScoutingReports(migrated) ||
      !repairV42State(migrated)
    ) {
      return null;
    }
    migrated.contentVersion = CURRENT_ROSTER_VERSION;
    return migrated;
  } catch {
    return null;
  }
}

export function migrateSchema9GameState(value: unknown): unknown {
  const schema10 = migrateSchema9To10(value);
  return schema10 ? migrateSchema10GameState(schema10) : null;
}

export function migrateSchema8GameState(value: unknown): unknown {
  const schema9 = migrateSchema8To9(value);
  return schema9 ? migrateSchema9GameState(schema9) : null;
}

export function migrateSchema7GameState(value: unknown): unknown {
  const schema8 = migrateSchema7To8(value);
  return schema8 ? migrateSchema8GameState(schema8) : null;
}

export function migrateSchema6GameState(value: unknown): unknown {
  const schema7 = migrateSchema6To7(value);
  return schema7 ? migrateSchema7GameState(schema7) : null;
}

/**
 * Kept as a public compatibility entry point for existing tests and older
 * installs. It now performs the complete v5 -> v6 -> ... -> v10 chain.
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
  if (value.version === 8) {
    return migrateSchema8GameState(value);
  }
  if (value.version === 9) {
    return migrateSchema9GameState(value);
  }
  if (value.version === 10) {
    return migrateSchema10GameState(value);
  }
  if (value.version === 11) {
    return migrateSchema11GameState(value);
  }
  return null;
}

export function normalizePersistedGameState(value: unknown): unknown {
  if (
    isRecord(value) &&
    value.version === 11 &&
    value.contentVersion === CURRENT_ROSTER_VERSION
  ) {
    return repairInitialHealth(value) &&
      repairGhostHandSnapshots(value) &&
      repairV42State(value) &&
      repairSpellPool(value) &&
      repairHumanScoutingReports(value) &&
      repairHeroSecrets(value) &&
      repairHeroPowerCounters(value) &&
      repairHeroRefreshAvailability(value) &&
      repairTrinketSelections(value) &&
      repairPendingMysteryCubeReplacements(value) &&
      repairStaleLobbyInteraction(value) &&
      hasValidLobbySystemState(value)
      ? value
      : null;
  }
  const migrated = migrateLegacyGameState(value);
  return isRecord(migrated) &&
    repairInitialHealth(migrated) &&
    repairGhostHandSnapshots(migrated) &&
    repairV42State(migrated) &&
    repairHeroSecrets(migrated) &&
    repairHeroPowerCounters(migrated) &&
    repairHeroRefreshAvailability(migrated) &&
    repairTrinketSelections(migrated) &&
    repairPendingMysteryCubeReplacements(migrated) &&
    repairStaleLobbyInteraction(migrated) &&
    hasValidLobbySystemState(migrated)
    ? migrated
    : null;
}
