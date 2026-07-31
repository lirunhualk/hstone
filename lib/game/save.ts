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

const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
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
          !Array.isArray(card.attachments) ||
          !card.attachments.every(hasZeroAttachmentPoolOwnership),
      )
    ) {
      return false;
    }
  }
  return true;
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
  if (
    definition.conditionalKeyword?.keyword === "divineShield" &&
    typeof value.attack === "number" &&
    value.attack >= definition.conditionalKeyword.attackAtLeast
  ) {
    value.divineShield = true;
    value.temporaryDivineShield = false;
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

    migrated.version = 11;
    migrated.contentVersion = CURRENT_ROSTER_VERSION;
    migrated.spellPool = spellPool;
    if (!repairHumanScoutingReports(migrated)) {
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
      value.contentVersion !== LEGACY_SCHEMA_11_CONTENT_VERSION_V29) ||
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
    ].includes(value.contentVersion as string);
    const preservePendingSpellcraft =
      value.contentVersion === LEGACY_SCHEMA_11_CONTENT_VERSION_V17 ||
      preservePersistentFields;
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
      player.pendingCardPlayed = null;
      player.lastTavernSpellDefinitionId = null;
      player.pendingTavernSpellDefinitionId = null;
      player.demonFodderRefreshQueue = [];
      migrateBloodGemBarrageState(player);
    }
    if (!repairHumanScoutingReports(migrated)) {
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
    return repairGhostHandSnapshots(value) &&
      repairSpellPool(value) &&
      repairHumanScoutingReports(value)
      ? value
      : null;
  }
  const migrated = migrateLegacyGameState(value);
  return isRecord(migrated) &&
    repairGhostHandSnapshots(migrated)
    ? migrated
    : null;
}
