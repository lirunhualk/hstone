"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEventHandler,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEventHandler,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";
import {
  canMagnetize,
  createGame,
  createLobbyGame,
  gameTransition,
  ACTIVE_TRINKET_DEFINITIONS,
  areOwnedTrinketDefinitionIdsValid,
  areTrinketOfferCandidatesValid,
  GREATER_TRINKET_ROUND,
  HERO_POWER_COUNTER_KEYS,
  HELPFUL_REFRESH_LABELS,
  LESSER_TRINKET_ROUND,
  TAVERN_SPELL_DEFINITIONS,
  getLegalSpellcraftTargetIds,
  getLegalTavernSpellTargetIds,
  getAiStrategyProfile,
  getScheduledOpponent,
  getMinionPurchaseCost,
  getMinionPurchaseQuote,
  getMinionSellValue,
  getTavernRefreshQuote,
  getHeroDefinition,
  getHeroPowerDefinition,
  getHeroPowerProgressText,
  getSystemEventDefinition,
  heroPowerActiveCost,
  heroPowerCanBeManuallyActivated,
  heroPowerNeedsTarget,
  getTrinketAliasKind,
  getTrinketDefinition,
  getTrinketProgressText,
  getTavernSpellPurchaseQuote,
  getTavernSpellDefinition,
  getSpellcraftDefinition,
  getUpgradeCost,
  minionHasTribe,
  isHeroDefinitionId,
  isHeroPowerDefinitionId,
  isSystemEventDefinitionId,
  isSystemTavernSpellDefinitionId,
  isTrinketDefinitionId,
  tavernSpellCanTargetShop,
  tavernSpellNeedsTarget,
  tavernSpellPurchaseCurrency,
  spellcraftNeedsTarget,
  type BattleEvent,
  type BattleResult,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type ConsolationCoinSpellInstance,
  type GameAction,
  type GameState,
  type HumanScoutingReport,
  type MagneticAttachment,
  type MinionInstance,
  type PendingInteraction,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
  type TripleRewardSpellInstance,
  type Tribe,
} from "../lib/game/engine";
import {
  CURRENT_ROSTER_VERSION,
  TRIBE_NAMES,
  getMinionDefinition,
} from "../lib/game/content";
import { isTierThreeDarkmoonPrizeDefinitionId } from "../lib/game/darkmoon-prizes";
import {
  COMBAT_START_INTRO_DURATION_MS,
  combatBuffLabel,
  combatIntroOpponent,
  combatPlaybackKey,
  combatTriggerLabel,
  initialCombatPlayback,
  isCombatPlaybackEvent,
  projectCombatArmor,
  projectCombatHealth,
  resumeCombatPlayback,
} from "../lib/game/combat-presentation";
import {
  cardInspectionDelay,
  movedBeyondCardInspectionTolerance,
  placeCardInspection,
  type CardInspectionAnchor,
  type CardInspectionTrigger,
} from "../lib/game/card-inspection";
import {
  createBoardDragPreview,
  createLiftedCardDragPreview,
  nearestBoardSlotIndex,
} from "../lib/game/drag-preview";
import { interactionRequiresModalBackdrop } from "../lib/game/interaction-presentation";
import {
  activeMinionKeywordVisuals,
  type MinionKeywordVisual,
} from "../lib/game/minion-presentation";
import { projectCombatBoard } from "../lib/game/playback";
import {
  getHumanScoutingReport,
  getPublicLastRoundResult,
  getVisibleWarband,
} from "../lib/game/opponent-intelligence";
import {
  completeRecruitPresentation,
  deriveRecruitPresentation,
  recruitPresentationAnnouncement,
  recruitPresentationDuration,
  type RecruitPresentationEvent,
} from "../lib/game/recruit-presentation";
import { normalizePersistedGameState } from "../lib/game/save";
import {
  DEFAULT_INITIAL_HEALTH,
  MAX_INITIAL_HEALTH,
  MIN_INITIAL_HEALTH,
  isValidInitialHealth,
  normalizeInitialHealth,
  parseInitialHealthInput,
} from "../lib/game/setup";

const SAVE_KEY = "hearthstone-battlegrounds-local.save.v11";
const COMBAT_PLAYBACK_SESSION_KEY =
  "hearthstone-battlegrounds-local.combat-playback.v1";
const LEGACY_SAVE_KEYS = [
  "hearthstone-battlegrounds-local.save.v10",
  "hearthstone-battlegrounds-local.save.v9",
  "hearthstone-battlegrounds-local.save.v8",
  "hearthstone-battlegrounds-local.save.v7",
  "hearthstone-battlegrounds-local.save.v6",
  "hearthstone-battlegrounds-local.save.v5",
] as const;
const INITIAL_SEED = 0x53544152;
const BOARD_LIMIT = 7;
const MOUSE_DRAG_THRESHOLD_PX = 8;
const TOUCH_DRAG_THRESHOLD_PX = 12;
const TAVERN_SPELL_DEFINITION_IDS = new Set(
  TAVERN_SPELL_DEFINITIONS.map((definition) => definition.id),
);
const VALID_HERO_POWER_COUNTER_KEYS = new Set<string>(
  Object.values(HERO_POWER_COUNTER_KEYS),
);

function safeReadLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteLocalStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable under private or restricted browser policies.
  }
}

function safeReadSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteSessionStorage(key: string, value: string): boolean {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveSessionStorage(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable under restricted browser policies.
  }
}

function readCombatPlaybackSession(): unknown {
  const raw = safeReadSessionStorage(COMBAT_PLAYBACK_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    safeRemoveSessionStorage(COMBAT_PLAYBACK_SESSION_KEY);
    return null;
  }
}

type Selection =
  | { zone: "shop" | "spellShop" | "hand" | "board"; index: number }
  | null;

type InfoTab = "details" | "scouting" | "battle";

type DragSource = {
  zone: "shop" | "spellShop" | "hand" | "board";
  index: number;
};

type DragTarget =
  | { kind: "board"; index: number }
  | { kind: "hand" }
  | { kind: "sell" }
  | { kind: "magnetic"; targetInstanceId: string }
  | { kind: "bloodGem"; targetInstanceId: string }
  | { kind: "tavernSpell"; targetInstanceId: string }
  | { kind: "spellcraft"; targetInstanceId: string }
  | { kind: "castTavernSpell" }
  | { kind: "castSpellcraft" }
  | {
      kind: "blockedMagnetic";
      targetInstanceId: string;
      targetName: string;
    }
  | null;

type DraggableCard =
  | BoardMinionInstance
  | BloodGemSpellInstance
  | SpellcraftSpellInstance
  | TavernSpellInstance;

type InspectableCard = PlayerState["hand"][number];

type CardInspectionState = {
  card: InspectableCard;
  anchor: CardInspectionAnchor;
  trigger: CardInspectionTrigger;
};

type TouchInspectionGesture = {
  pointerId: number;
  cardInstanceId: string;
  startX: number;
  startY: number;
};

type ShopDisplayOffer =
  | {
      kind: "minion";
      unit: BoardMinionInstance;
      shopIndex: number;
    }
  | {
      kind: "tavernSpell";
      spell: TavernSpellInstance;
      spellIndex: number;
    };

type DragSession = DragSource & {
  card: DraggableCard;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  active: boolean;
  target: DragTarget;
};

type DragPointerHandlers = {
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onLostPointerCapture: PointerEventHandler<HTMLButtonElement>;
};

type CardInspectionHandlers = {
  onPointerEnter: PointerEventHandler<HTMLButtonElement>;
  onPointerLeave: PointerEventHandler<HTMLButtonElement>;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onPointerMove: PointerEventHandler<HTMLButtonElement>;
  onPointerUp: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel: PointerEventHandler<HTMLButtonElement>;
  onLostPointerCapture: PointerEventHandler<HTMLButtonElement>;
  onClickCapture: MouseEventHandler<HTMLButtonElement>;
  onFocus: FocusEventHandler<HTMLButtonElement>;
  onBlur: FocusEventHandler<HTMLButtonElement>;
};

type BattleSpeed = 1 | 2;

type CombatPresentationStage = "intro" | "playback" | "result";

type BattlePlaybackState = {
  battleKey: string | null;
  revealedCount: number;
  complete: boolean;
};

type CombatRewardSummary = {
  addedCount: number;
  handFullCount: number;
  noCandidateCount: number;
  addedNames: string[];
  addedInstanceIds: string[];
};

type BloodGemCastFeedback = {
  targetInstanceId: string;
  attack: number;
  health: number;
  bonusKeyword: string;
  token: string;
};

type TavernSpellCastFeedback = {
  targetInstanceId: string;
  label: string;
  token: string;
};

type RecruitMotionGeometry = {
  fromLeft: number;
  fromTop: number;
  fromWidth: number;
  fromHeight: number;
  travelX: number;
  travelY: number;
};

type RecruitPresentationBatch = {
  token: number;
  events: RecruitPresentationEvent[];
  announcement: string;
  motion: RecruitMotionGeometry | null;
};

function humanPlayerForPresentation(
  state: GameState,
): PlayerState | null {
  return (
    state.players.find((player) => player.id === state.humanPlayerId) ??
    null
  );
}

function cardElementForPresentation(
  instanceId: string,
): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    "[data-unit-instance-id], [data-card-instance-id]",
  );
  for (const candidate of candidates) {
    if (
      candidate.dataset.unitInstanceId === instanceId ||
      candidate.dataset.cardInstanceId === instanceId
    ) {
      return candidate;
    }
  }
  return null;
}

function captureRecruitMotion(
  state: GameState,
  action: GameAction,
): RecruitMotionGeometry | null {
  const player = humanPlayerForPresentation(state);
  if (!player) return null;

  let instanceId: string | null = null;
  let targetTestId: "hand-row" | "tavern-keeper" | null = null;
  if (action.type === "BUY_MINION") {
    instanceId = player.shop[action.shopIndex]?.instanceId ?? null;
    targetTestId = "hand-row";
  } else if (action.type === "BUY_TAVERN_SPELL") {
    const offers = [
      ...(player.spellShop ? [player.spellShop] : []),
      ...player.additionalSpellShop,
    ];
    instanceId =
      (action.spellInstanceId
        ? offers.find(
            (spell) => spell.instanceId === action.spellInstanceId,
          )
        : player.spellShop
      )?.instanceId ?? null;
    targetTestId = "hand-row";
  } else if (action.type === "SELL_MINION") {
    instanceId = player.board[action.boardIndex]?.instanceId ?? null;
    targetTestId = "tavern-keeper";
  }
  if (!instanceId || !targetTestId) return null;

  const source = cardElementForPresentation(instanceId);
  const target = document.querySelector<HTMLElement>(
    `[data-testid="${targetTestId}"]`,
  );
  if (!source || !target) return null;
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return {
    fromLeft: sourceRect.left,
    fromTop: sourceRect.top,
    fromWidth: sourceRect.width,
    fromHeight: sourceRect.height,
    travelX:
      targetRect.left +
      targetRect.width / 2 -
      (sourceRect.left + sourceRect.width / 2),
    travelY:
      targetRect.top +
      targetRect.height / 2 -
      (sourceRect.top + sourceRect.height / 2),
  };
}

const TRIBE_HUE: Record<Tribe, number> = {
  beast: 106,
  mech: 198,
  demon: 286,
  murloc: 190,
  dragon: 18,
  pirate: 42,
  elemental: 205,
  naga: 258,
  quilboar: 332,
  undead: 274,
  all: 52,
  neutral: 42,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isTribe(value: unknown): value is Tribe {
  return typeof value === "string" && Object.hasOwn(TRIBE_NAMES, value);
}

function isTavernTier(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

function isMinionTier(value: unknown): boolean {
  return isTavernTier(value) || value === 7;
}

function isPendingCardPlayedEvent(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.sourceInstanceId !== "string" ||
    (value.cardKind !== "minion" &&
      value.cardKind !== "tavernSpell" &&
      value.cardKind !== "other") ||
    !Array.isArray(value.tribes) ||
    !value.tribes.every(isTribe)
  ) {
    return false;
  }
  if (value.cardKind === "minion") {
    return (
      isTavernTier(value.tier) &&
      isTribe(value.tribe) &&
      value.tribes.length > 0
    );
  }
  if (value.cardKind === "tavernSpell") {
    return (
      isTavernTier(value.tier) &&
      value.tribe === undefined &&
      value.tribes.length === 0
    );
  }
  return (
    value.tier === undefined &&
    value.tribe === undefined &&
    value.tribes.length === 0
  );
}

function isTavernSpellPool(
  value: unknown,
): value is Record<string, number> {
  if (!isRecord(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return (
    entries.length === TAVERN_SPELL_DEFINITION_IDS.size &&
    entries.every(
      ([definitionId, copies]) =>
        TAVERN_SPELL_DEFINITION_IDS.has(definitionId) &&
        typeof copies === "number" &&
        Number.isInteger(copies) &&
        copies >= 0,
    ) &&
    entries.some(([, copies]) => (copies as number) > 0)
  );
}

function formatSignedStat(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function hasValidPoolCopiesByDefinitionId(
  value: unknown,
  poolCopies: number,
): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value) || Array.isArray(value)) {
    return false;
  }
  let total = 0;
  for (const [definitionId, copies] of Object.entries(value)) {
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
  return total === poolCopies;
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

function hasSchema9MinionState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.bloodGemAttack === "number" &&
    Number.isFinite(value.bloodGemAttack) &&
    value.bloodGemAttack >= 0 &&
    typeof value.bloodGemHealth === "number" &&
    Number.isFinite(value.bloodGemHealth) &&
    value.bloodGemHealth >= 0 &&
    typeof value.suppressedBloodGemAttack === "number" &&
    Number.isFinite(value.suppressedBloodGemAttack) &&
    value.suppressedBloodGemAttack >= 0 &&
    value.suppressedBloodGemAttack <= value.bloodGemAttack &&
    typeof value.suppressedBloodGemHealth === "number" &&
    Number.isFinite(value.suppressedBloodGemHealth) &&
    value.suppressedBloodGemHealth >= 0 &&
    value.suppressedBloodGemHealth <= value.bloodGemHealth &&
    typeof value.temporaryAttack === "number" &&
    typeof value.temporaryHealth === "number" &&
    typeof value.temporaryTaunt === "boolean" &&
    typeof value.temporaryDivineShield === "boolean" &&
    typeof value.temporaryCrabDeathrattles === "number" &&
    typeof value.temporaryGoldenCrabDeathrattles === "number" &&
    isRecord(value.effectCounters) &&
    Object.values(value.effectCounters).every(
      (counter) =>
        typeof counter === "number" && Number.isInteger(counter),
    ) &&
    (value.whereverAttackBonus === undefined ||
      typeof value.whereverAttackBonus === "number") &&
    (value.whereverHealthBonus === undefined ||
      typeof value.whereverHealthBonus === "number") &&
    (value.astralAutomatonSummoned === undefined ||
      typeof value.astralAutomatonSummoned === "boolean") &&
    (value.ancientSoulFriendlyDeaths === undefined ||
      (typeof value.ancientSoulFriendlyDeaths === "number" &&
        Number.isInteger(value.ancientSoulFriendlyDeaths) &&
        value.ancientSoulFriendlyDeaths >= 0)) &&
    hasValidOptionalUniqueStringArray(
      value.deathlyStrikerLineageIds,
    ) &&
    hasValidOptionalUniqueStringArray(
      value.deathlyStrikerCreatorIds,
    ) &&
    (value.stealth === undefined ||
      typeof value.stealth === "boolean") &&
    typeof value.poolCopies === "number" &&
    Number.isInteger(value.poolCopies) &&
    value.poolCopies >= 0 &&
    hasValidPoolCopiesByDefinitionId(
      value.poolCopiesByDefinitionId,
      value.poolCopies,
    ) &&
    (value.poolCopiesOnPurchase === undefined ||
      (typeof value.poolCopiesOnPurchase === "number" &&
        Number.isInteger(value.poolCopiesOnPurchase) &&
        value.poolCopiesOnPurchase >= 0)) &&
    (value.playableFromRound === undefined ||
      typeof value.playableFromRound === "number") &&
    (value.destroyAfterPlayThroughRound === undefined ||
      typeof value.destroyAfterPlayThroughRound === "number") &&
    (value.taughtTavernSpellDefinitionId === undefined ||
      (typeof value.taughtTavernSpellDefinitionId === "string" &&
        TAVERN_SPELL_DEFINITION_IDS.has(
          value.taughtTavernSpellDefinitionId,
        )))
  );
}

function hasValidTrinketChoiceOptions(
  trinketTier: unknown,
  optionIds: unknown,
  expectedCount = 4,
): boolean {
  if (
    (trinketTier !== "lesser" && trinketTier !== "greater") ||
    !Array.isArray(optionIds) ||
    optionIds.length !== expectedCount ||
    new Set(optionIds).size !== optionIds.length
  ) {
    return false;
  }
  return optionIds.every(
    (optionId) =>
      typeof optionId === "string" &&
      isTrinketDefinitionId(optionId) &&
      getTrinketDefinition(optionId).inPool &&
      getTrinketDefinition(optionId).tier === trinketTier,
  );
}

function isMysteryCubeTrinketSlotId(id: string): boolean {
  return (
    getTrinketAliasKind(id) === "mysteryCubeReplacement" ||
    getTrinketDefinition(id).cardId === "BG30_MagicItem_703"
  );
}

function pendingTrinketChoiceMatchesState(
  interaction: PendingInteraction,
  players: readonly PlayerState[],
  activeTribes: readonly Tribe[],
): boolean {
  if (interaction.kind !== "trinketChoice") {
    return true;
  }
  const player = players.find(
    (candidate) => candidate.id === interaction.playerId,
  );
  if (!player) {
    return false;
  }
  const replacementId = interaction.replaceTrinketId;
  const isMysteryCubeReplacement =
    replacementId !== undefined &&
    player.trinketIds.includes(replacementId) &&
    isMysteryCubeTrinketSlotId(replacementId);
  const ownedCardIds = new Set(
    player.trinketIds.map(
      (definitionId) => getTrinketDefinition(definitionId).cardId,
    ),
  );
  return (
    (!isMysteryCubeReplacement ||
      (interaction.trinketTier === "lesser" &&
        interaction.additionalTrinketSourceId === undefined &&
        interaction.optionIds.every((optionId) => {
          const definition = getTrinketDefinition(optionId);
          return (
            definition.cardId !== "BG30_MagicItem_703" &&
            !ownedCardIds.has(definition.cardId)
          );
        }))) &&
    areTrinketOfferCandidatesValid({
      tier: interaction.trinketTier,
      candidates: interaction.optionIds.map(getTrinketDefinition),
      board: player.board,
      activeTribes,
      count: isMysteryCubeReplacement ? 2 : 4,
    })
  );
}

function isPendingInteraction(
  value: unknown,
): value is PendingInteraction {
  if (
    !isRecord(value) ||
    typeof value.interactionId !== "string" ||
    typeof value.playerId !== "string" ||
    typeof value.sourceInstanceId !== "string"
  ) {
    return false;
  }
  const validBattlecryFlag =
    value.battlecry === undefined || value.battlecry === true;
  const validBattlecryTriggerCount =
    value.battlecryTriggerCount === undefined ||
    (value.battlecry === true &&
      typeof value.battlecryTriggerCount === "number" &&
      Number.isInteger(value.battlecryTriggerCount) &&
      value.battlecryTriggerCount > 0);
  const validBattlecryEffectGrouping =
    value.battlecryEffectRepetitionsPerTrigger === undefined ||
    (value.battlecry === true &&
      typeof value.battlecryEffectRepetitionsPerTrigger === "number" &&
      Number.isInteger(value.battlecryEffectRepetitionsPerTrigger) &&
      value.battlecryEffectRepetitionsPerTrigger > 0);
  if (value.kind === "target") {
    return (
      Array.isArray(value.optionInstanceIds) &&
      value.optionInstanceIds.length > 0 &&
      value.optionInstanceIds.every(
        (instanceId) => typeof instanceId === "string",
      ) &&
      typeof value.attack === "number" &&
      typeof value.health === "number" &&
      typeof value.repetitions === "number" &&
      value.repetitions > 0 &&
      validBattlecryFlag &&
      validBattlecryTriggerCount &&
      (value.grantKeywords === undefined ||
        (Array.isArray(value.grantKeywords) &&
          value.grantKeywords.every(
            (keyword) =>
              keyword === "reborn" || keyword === "windfury",
          ))) &&
      (value.resolution === undefined ||
        (isRecord(value.resolution) &&
          (value.resolution.kind === "buff" ||
            (value.resolution.kind === "destroyFriendlyAndCopy" &&
              typeof value.resolution.copies === "number" &&
              value.resolution.copies > 0) ||
            (value.resolution.kind === "castTaughtTavernSpell" &&
              typeof value.resolution.definitionId === "string" &&
              TAVERN_SPELL_DEFINITION_IDS.has(
                value.resolution.definitionId,
              ) &&
              tavernSpellNeedsTarget(
                getTavernSpellDefinition(value.resolution.definitionId),
              )) ||
            (value.resolution.kind === "makeGolden" &&
              typeof value.resolution.maximumTier === "number" &&
              Number.isInteger(value.resolution.maximumTier) &&
              value.resolution.maximumTier >= 1 &&
              value.resolution.maximumTier <= 6))))
    );
  }
  if (value.kind === "magnetizeTarget") {
    return (
      Array.isArray(value.optionInstanceIds) &&
      value.optionInstanceIds.length > 0 &&
      value.optionInstanceIds.every(
        (instanceId) => typeof instanceId === "string",
      ) &&
      isRecord(value.filter) &&
      typeof value.remainingDiscoveries === "number" &&
      value.remainingDiscoveries > 0 &&
      validBattlecryFlag &&
      validBattlecryEffectGrouping
    );
  }
  if (value.kind === "tavernSpellChoice") {
    return (
      typeof value.definitionId === "string" &&
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds.every(
        (optionId) =>
          optionId === "timeManagementNow" ||
          optionId === "timeManagementNextTurn",
      )
    );
  }
  if (value.kind === "spellcraftChoice") {
    return (
      typeof value.definitionId === "string" &&
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds.every(
        (optionId) =>
          optionId === "escapeEruptionAttack" ||
          optionId === "escapeEruptionHealth",
      ) &&
      (value.effectMultiplier === undefined ||
        (typeof value.effectMultiplier === "number" &&
          Number.isInteger(value.effectMultiplier) &&
          value.effectMultiplier > 0)) &&
      (value.castCompletions === undefined ||
        (typeof value.castCompletions === "number" &&
          Number.isInteger(value.castCompletions) &&
          value.castCompletions > 0)) &&
      (value.effectMultiplier === undefined ||
        value.castCompletions === undefined ||
        (value.effectMultiplier >= value.castCompletions &&
          value.effectMultiplier % value.castCompletions === 0))
    );
  }
  if (value.kind === "heroChoice") {
    return (
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 4 &&
      value.optionIds.every(
        (optionId) =>
          typeof optionId === "string" &&
          isHeroDefinitionId(optionId),
      ) &&
      new Set(value.optionIds).size === value.optionIds.length
    );
  }
  if (value.kind === "trinketChoice") {
    const replacementId = value.replaceTrinketId;
    const isMysteryCubeReplacement =
      typeof replacementId === "string" &&
      isTrinketDefinitionId(replacementId) &&
      isMysteryCubeTrinketSlotId(replacementId);
    return hasValidTrinketChoiceOptions(
      value.trinketTier,
      value.optionIds,
      isMysteryCubeReplacement ? 2 : 4,
    );
  }
  if (value.kind === "heroPowerChoice") {
    return (
      typeof value.definitionId === "string" &&
      Array.isArray(value.optionIds) &&
      value.optionIds.length > 0 &&
      value.optionIds.every(
        (optionId) =>
          typeof optionId === "string" &&
          isHeroPowerDefinitionId(optionId),
      ) &&
      (value.completionSource === undefined ||
        value.completionSource === "tavernSpellCast" ||
        value.completionSource === "generatedSpellCast") &&
      (value.remainingChoices === undefined ||
        (typeof value.remainingChoices === "number" &&
          Number.isInteger(value.remainingChoices) &&
          value.remainingChoices > 0))
    );
  }
  if (value.kind === "minionChoice") {
    const foodieNormalOptions =
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds[0] === "BG30_123t" &&
      value.optionIds[1] === "BG30_123t2" &&
      value.effectMultiplier === 1;
    const foodieGoldenOptions =
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds[0] === "BG30_123_Gt" &&
      value.optionIds[1] === "BG30_123_Gt2" &&
      value.effectMultiplier === 2;
    const botanistNormalOptions =
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds[0] === "BG32_237t" &&
      value.optionIds[1] === "BG32_237t2" &&
      value.effectMultiplier === 1;
    const botanistGoldenOptions =
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds[0] === "BG32_237_Gt" &&
      value.optionIds[1] === "BG32_237_Gt2" &&
      value.effectMultiplier === 2;
    const beetleNormalOptions =
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds[0] === "BG27_084t" &&
      value.optionIds[1] === "BG27_084t2" &&
      value.effectMultiplier === 1;
    const beetleGoldenOptions =
      Array.isArray(value.optionIds) &&
      value.optionIds.length === 2 &&
      value.optionIds[0] === "BG27_084_Gt" &&
      value.optionIds[1] === "BG27_084_Gt2" &&
      value.effectMultiplier === 2;
    return value.definitionId === "BG30_123"
      ? foodieNormalOptions || foodieGoldenOptions
      : value.definitionId === "BG32_237"
        ? botanistNormalOptions || botanistGoldenOptions
        : value.definitionId === "BG27_084" &&
          (beetleNormalOptions || beetleGoldenOptions);
  }
  if (value.kind === "tavernSpellDiscover") {
    return (
      Array.isArray(value.options) &&
      value.options.length > 0 &&
      value.options.length <= 3 &&
      value.options.every(isTavernSpell) &&
      new Set(value.options.map((option) => option.instanceId)).size ===
        value.options.length &&
      new Set(value.options.map((option) => option.definitionId)).size ===
        value.options.length &&
      isTavernTier(value.maximumTier) &&
      value.options.every(
        (option) => option.tier <= (value.maximumTier as number),
      ) &&
      typeof value.remainingDiscoveries === "number" &&
      Number.isInteger(value.remainingDiscoveries) &&
      value.remainingDiscoveries > 0 &&
      validBattlecryFlag &&
      validBattlecryEffectGrouping &&
      (value.sourceDefinitionId === undefined ||
        typeof value.sourceDefinitionId === "string")
    );
  }
  if (value.kind === "darkmoonPrizeDiscover") {
    return (
      Array.isArray(value.options) &&
      value.options.length === 3 &&
      value.options.every(
        (option) =>
          isSpellcraftSpell(option) &&
          option.spellFamily === "generated" &&
          isTierThreeDarkmoonPrizeDefinitionId(option.definitionId),
      ) &&
      new Set(value.options.map((option) => option.instanceId)).size ===
        value.options.length &&
      new Set(value.options.map((option) => option.definitionId)).size ===
        value.options.length &&
      typeof value.remainingDiscoveries === "number" &&
      Number.isInteger(value.remainingDiscoveries) &&
      value.remainingDiscoveries > 0 &&
      (value.completionSource === undefined ||
        value.completionSource === "generatedSpellCast")
    );
  }
  if (value.kind !== "discover") {
    return false;
  }
  const validDestination =
    isRecord(value.destination) &&
    ((value.destination.kind === "hand" &&
      (value.destination.playableFromRound === undefined ||
        typeof value.destination.playableFromRound === "number") &&
      (value.destination.destroyAfterPlayThroughRound === undefined ||
        typeof value.destination.destroyAfterPlayThroughRound ===
          "number") &&
      (value.destination.allowOverflow === undefined ||
        typeof value.destination.allowOverflow === "boolean")) ||
      (value.destination.kind === "magnetize" &&
        typeof value.destination.targetInstanceId === "string") ||
      (value.destination.kind === "transform" &&
        typeof value.destination.targetInstanceId === "string") ||
      (value.destination.kind === "customUndeadFirst" &&
        typeof value.destination.sourceTrinketDefinitionId === "string" &&
        isTrinketDefinitionId(
          value.destination.sourceTrinketDefinitionId,
        )) ||
      (value.destination.kind === "customUndeadSecond" &&
        typeof value.destination.sourceTrinketDefinitionId === "string" &&
        isTrinketDefinitionId(
          value.destination.sourceTrinketDefinitionId,
        ) &&
        typeof value.destination.firstComponentDefinitionId === "string"));
  const validFilter =
    isRecord(value.filter) &&
    (value.filter.exactTier === undefined ||
      isMinionTier(value.filter.exactTier)) &&
    (value.filter.maximumTier === undefined ||
      isTavernTier(value.filter.maximumTier)) &&
    (value.filter.tribe === undefined || isTribe(value.filter.tribe)) &&
    (value.filter.ability === undefined ||
      value.filter.ability === "battlecry" ||
      value.filter.ability === "deathrattle") &&
    (value.filter.requiresMinionType === undefined ||
      typeof value.filter.requiresMinionType === "boolean");
  const validSelectionEffect =
    value.selectionEffect === undefined ||
    (isRecord(value.selectionEffect) &&
      (value.selectionEffect.kind === "damageHeroBySelectedTier" ||
        value.selectionEffect.kind === "makeGolden" ||
        (value.selectionEffect.kind === "rememberTrinketMinion" &&
          typeof value.selectionEffect.trinketDefinitionId === "string" &&
          isTrinketDefinitionId(
            value.selectionEffect.trinketDefinitionId,
          )) ||
        (value.selectionEffect.kind === "setStats" &&
          typeof value.selectionEffect.attack === "number" &&
          Number.isInteger(value.selectionEffect.attack) &&
          value.selectionEffect.attack >= 0 &&
          typeof value.selectionEffect.health === "number" &&
          Number.isInteger(value.selectionEffect.health) &&
          value.selectionEffect.health >= 0)));
  return (
    Array.isArray(value.options) &&
    value.options.length > 0 &&
    value.options.every(
      (option) =>
        isRecord(option) &&
        option.kind === "minion" &&
        typeof option.instanceId === "string" &&
        hasSchema9MinionState(option),
    ) &&
    validFilter &&
    validDestination &&
    typeof value.remainingDiscoveries === "number" &&
    value.remainingDiscoveries > 0 &&
    validBattlecryFlag &&
    validBattlecryEffectGrouping &&
    (value.sourceDefinitionId === undefined ||
      typeof value.sourceDefinitionId === "string") &&
    validSelectionEffect &&
      (value.completionSource === undefined ||
        value.completionSource === "tavernSpellCast" ||
        value.completionSource === "tripleRewardCast" ||
        value.completionSource === "generatedSpellCast") &&
    (value.remainingCastCompletions === undefined ||
      (typeof value.remainingCastCompletions === "number" &&
        Number.isInteger(value.remainingCastCompletions) &&
        value.remainingCastCompletions > 0)) &&
    (value.firstCastFromHandPending === undefined ||
      typeof value.firstCastFromHandPending === "boolean")
  );
}

function pendingInteractionMatchesPlayer(
  interaction: PendingInteraction,
  players: readonly PlayerState[],
): boolean {
  const player = players.find(
    (candidate) => candidate.id === interaction.playerId,
  );
  if (!player?.isHuman) return false;

  const boardIds = new Set(
    player.board.map((minion) => minion.instanceId),
  );
  const shopIds = new Set(player.shop.map((minion) => minion.instanceId));
  if (interaction.kind === "discover") {
    if (
      interaction.selectionEffect?.kind === "rememberTrinketMinion" &&
      !player.trinketIds.includes(
        interaction.selectionEffect.trinketDefinitionId,
      )
    ) {
      return false;
    }
    const destination = interaction.destination;
    if (destination.kind === "hand") {
      return true;
    }
    if (
      destination.kind === "magnetize" ||
      destination.kind === "transform"
    ) {
      return boardIds.has(destination.targetInstanceId);
    }
    if (
      !player.trinketIds.includes(destination.sourceTrinketDefinitionId) ||
      !isTrinketDefinitionId(destination.sourceTrinketDefinitionId) ||
      getTrinketDefinition(destination.sourceTrinketDefinitionId).cardId !==
        "BG32_MagicItem_300" ||
      interaction.sourceDefinitionId !==
        destination.sourceTrinketDefinitionId ||
      interaction.options.length !== 3 ||
      interaction.options.some(
        (option) =>
          option.poolCopies !== 0 ||
          option.tier > player.tavernTier ||
          !minionHasTribe(option, "undead"),
      )
    ) {
      return false;
    }
    if (destination.kind === "customUndeadSecond") {
      try {
        const first = getMinionDefinition(
          destination.firstComponentDefinitionId,
        );
        const tribes =
          first.tribes ?? (first.tribe === "neutral" ? [] : [first.tribe]);
        return (
          first.collectible !== false &&
          first.tier <= player.tavernTier &&
          (tribes.includes("undead") || tribes.includes("all"))
        );
      } catch {
        return false;
      }
    }
    return true;
  }
  if (interaction.kind === "darkmoonPrizeDiscover") {
    return interaction.completionSource === "generatedSpellCast"
      ? player.pendingCardPlayed?.sourceInstanceId ===
          interaction.sourceInstanceId
      : player.trinketIds.includes(interaction.sourceInstanceId);
  }
  if (interaction.kind === "tavernSpellDiscover") {
    const source = player.board.find(
      (minion) => minion.instanceId === interaction.sourceInstanceId,
    );
    const sourceMatches =
      (source !== undefined &&
        (interaction.sourceDefinitionId === undefined ||
          source.definitionId === interaction.sourceDefinitionId)) ||
      (interaction.sourceDefinitionId !== undefined &&
        player.trinketIds.includes(interaction.sourceDefinitionId));
    return (
      sourceMatches &&
      interaction.maximumTier <= 6 &&
      interaction.options.every(
        (option) => option.tier <= interaction.maximumTier,
      )
    );
  }
  if (interaction.kind === "tavernSpellChoice") {
    return (
      interaction.definitionId === "tavern-spell-time-management" &&
      interaction.optionIds.length === 2
    );
  }
  if (interaction.kind === "spellcraftChoice") {
    return (
      interaction.definitionId ===
        "spellcraft-escape-eruption" &&
      interaction.optionIds.length === 2
    );
  }
  if (interaction.kind === "heroChoice") {
    return (
      interaction.sourceInstanceId === "lobby-hero-offer" &&
      interaction.optionIds.length === 4 &&
      interaction.optionIds.every(isHeroDefinitionId)
    );
  }
  if (interaction.kind === "trinketChoice") {
    const replacementId = interaction.replaceTrinketId;
    const isMysteryCubeReplacement =
      replacementId !== undefined &&
      player.trinketIds.includes(replacementId) &&
      isMysteryCubeTrinketSlotId(replacementId);
    return hasValidTrinketChoiceOptions(
      interaction.trinketTier,
      interaction.optionIds,
      isMysteryCubeReplacement ? 2 : 4,
    );
  }
  if (interaction.kind === "heroPowerChoice") {
    if (interaction.completionSource === "generatedSpellCast") {
      try {
        return (
          getSpellcraftDefinition(interaction.definitionId).effect ===
            "darkmoonTrainingSession" &&
          player.pendingCardPlayed?.sourceInstanceId ===
            interaction.sourceInstanceId
        );
      } catch {
        return false;
      }
    }
    return (
      interaction.definitionId ===
        "tavern-spell-unmasked-identity" &&
      interaction.optionIds.length > 0 &&
      interaction.optionIds.every(isHeroPowerDefinitionId)
    );
  }
  if (interaction.kind === "minionChoice") {
    const source = player.board.find(
      (minion) =>
        minion.instanceId === interaction.sourceInstanceId,
    );
    return (
      (interaction.definitionId === "BG30_123" ||
        interaction.definitionId === "BG32_237" ||
        interaction.definitionId === "BG27_084") &&
      source?.definitionId === interaction.definitionId &&
      source.golden === (interaction.effectMultiplier === 2)
    );
  }
  if (
    interaction.kind === "target" &&
    interaction.resolution?.kind === "castTaughtTavernSpell"
  ) {
    const source = player.board.find(
      (minion) => minion.instanceId === interaction.sourceInstanceId,
    );
    return (
      source?.taughtTavernSpellDefinitionId ===
        interaction.resolution.definitionId &&
      interaction.optionInstanceIds.every(
        (instanceId) => boardIds.has(instanceId) || shopIds.has(instanceId),
      )
    );
  }
  if (
    interaction.kind === "target" &&
    interaction.resolution?.kind === "makeGolden"
  ) {
    const maximumTier = interaction.resolution.maximumTier;
    const source = player.board.find(
      (minion) => minion.instanceId === interaction.sourceInstanceId,
    );
    return (
      source?.definitionId === "BG25_034" &&
      maximumTier === 6 &&
      interaction.optionInstanceIds.every((instanceId) => {
        const target = player.board.find(
          (minion) => minion.instanceId === instanceId,
        );
        return (
          target !== undefined &&
          !target.golden &&
          getMinionDefinition(target.definitionId).tier <= maximumTier
        );
      })
    );
  }
  return (
    boardIds.has(interaction.sourceInstanceId) &&
    interaction.optionInstanceIds.every((instanceId) =>
      boardIds.has(instanceId),
    )
  );
}

function isMagneticAttachment(
  value: unknown,
): value is MagneticAttachment {
  return (
    isRecord(value) &&
    typeof value.sourceInstanceId === "string" &&
    typeof value.definitionId === "string" &&
    typeof value.cardId === "string" &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    (value.effectSupport === "complete" ||
      value.effectSupport === "partial") &&
    typeof value.golden === "boolean" &&
    typeof value.poolCopies === "number" &&
    typeof value.attackGranted === "number" &&
    typeof value.healthGranted === "number" &&
    Array.isArray(value.attachments) &&
    value.attachments.every(isMagneticAttachment)
  );
}

function isZeroPoolMagneticAttachment(
  value: unknown,
): value is MagneticAttachment {
  return (
    isMagneticAttachment(value) &&
    value.poolCopies === 0 &&
    value.attachments.every(isZeroPoolMagneticAttachment)
  );
}

function isGhostHandMinion(
  value: unknown,
): value is BoardMinionInstance {
  return (
    isRecord(value) &&
    value.kind === "minion" &&
    value.poolCopies === 0 &&
    value.poolCopiesOnPurchase === undefined &&
    value.poolCopiesByDefinitionId === undefined &&
    Array.isArray(value.attachments) &&
    value.attachments.every(isZeroPoolMagneticAttachment) &&
    hasSchema9MinionState(value)
  );
}

function isBloodGemSpell(value: unknown): value is BloodGemSpellInstance {
  return (
    isRecord(value) &&
    value.kind === "bloodGem" &&
    typeof value.instanceId === "string" &&
    value.definitionId === "blood-gem" &&
    value.cardId === "BG20_GEM" &&
    value.name === "鲜血宝石" &&
    typeof value.description === "string" &&
    value.spellFamily === "bloodGem" &&
    (value.bonusKeyword === undefined ||
      value.bonusKeyword === "tauntForQuilboar" ||
      value.bonusKeyword === "rebornForQuilboar" ||
      value.bonusKeyword === "divineShieldForQuilboar")
  );
}

function isConsolationCoin(
  value: unknown,
): value is ConsolationCoinSpellInstance {
  return (
    isRecord(value) &&
    value.kind === "consolationCoin" &&
    typeof value.instanceId === "string" &&
    value.definitionId === "consolation-coin" &&
    value.cardId === "BG28_521t" &&
    value.name === "补贴铸币" &&
    typeof value.description === "string" &&
    value.spellFamily === "coin"
  );
}

function isTavernSpell(
  value: unknown,
): value is TavernSpellInstance {
  if (
    !isRecord(value) ||
    value.kind !== "tavernSpell" ||
    typeof value.instanceId !== "string" ||
    typeof value.definitionId !== "string" ||
    typeof value.cardId !== "string" ||
    typeof value.name !== "string" ||
    typeof value.tier !== "number" ||
    typeof value.cost !== "number" ||
    typeof value.description !== "string" ||
    value.spellFamily !== "tavern" ||
    value.target !== "none" &&
    value.target !== "friendly" &&
    value.target !== "anyMinion"
  ) {
    return false;
  }
  try {
    const definition = getTavernSpellDefinition(value.definitionId);
    return (
      definition.cardId === value.cardId &&
      definition.name === value.name &&
      definition.tier === value.tier &&
      definition.cost === value.cost &&
      (definition.target === value.target ||
        (definition.target === "anyMinion" &&
          value.target === "friendly"))
    );
  } catch {
    return false;
  }
}

function isSpellcraftSpell(
  value: unknown,
): value is SpellcraftSpellInstance {
  if (
    !isRecord(value) ||
    value.kind !== "spellcraft" ||
    typeof value.instanceId !== "string" ||
    typeof value.definitionId !== "string" ||
    typeof value.cardId !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string" ||
    (value.spellFamily !== "spellcraft" &&
      value.spellFamily !== "generated") ||
    (value.target !== "none" &&
      value.target !== "friendly" &&
      value.target !== "shop")
  ) {
    return false;
  }
  try {
    const definition = getSpellcraftDefinition(value.definitionId);
    const effectMultiplier = value.effectMultiplier ?? 1;
    if (effectMultiplier !== 1 && effectMultiplier !== 2) {
      return false;
    }
    if (
      effectMultiplier === 2 &&
      (!definition.goldenCardId || !definition.goldenDescription)
    ) {
      return false;
    }
    const expectedCardId =
      effectMultiplier === 2
        ? definition.goldenCardId
        : definition.cardId;
    const expectedDescription =
      effectMultiplier === 2
        ? definition.goldenDescription
        : definition.description;
    return (
      expectedCardId === value.cardId &&
      definition.name === value.name &&
      expectedDescription === value.description &&
      definition.target === value.target &&
      (definition.spellFamily ?? "spellcraft") === value.spellFamily
    );
  } catch {
    return false;
  }
}

function isPendingSpellcraftGrant(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.sourceInstanceId !== "string" ||
    typeof value.definitionId !== "string" ||
    typeof value.golden !== "boolean" ||
    !Number.isInteger(value.round) ||
    (value.round as number) < 1
  ) {
    return false;
  }
  try {
    const definition = getSpellcraftDefinition(value.definitionId);
    return (
      value.golden === false ||
      (definition.goldenCardId !== undefined &&
        definition.goldenDescription !== undefined)
    );
  } catch {
    return false;
  }
}

function isHumanScoutingReport(
  value: unknown,
  opponentId: string,
): value is HumanScoutingReport {
  return (
    isRecord(value) &&
    value.opponentId === opponentId &&
    typeof value.observedRound === "number" &&
    Number.isInteger(value.observedRound) &&
    value.observedRound >= 1 &&
    (value.resultForHuman === "win" ||
      value.resultForHuman === "loss" ||
      value.resultForHuman === "tie") &&
    typeof value.isGhost === "boolean" &&
    Array.isArray(value.board) &&
    value.board.every(
      (minion) =>
        isRecord(minion) &&
        minion.kind === "minion" &&
        Array.isArray(minion.attachments) &&
        minion.attachments.every(isMagneticAttachment) &&
        hasSchema9MinionState(minion),
    )
  );
}

function isHumanScoutingReports(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(([opponentId, report]) =>
      isHumanScoutingReport(report, opponentId),
    )
  );
}

function hasLobbySystemPlayerState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    !Array.isArray(value.trinketIds) ||
    !areOwnedTrinketDefinitionIdsValid(value.trinketIds)
  ) {
    return false;
  }
  const trinketIds = value.trinketIds as string[];
  if (
    !Array.isArray(value.pendingMysteryCubeReplacementIds) ||
    new Set(value.pendingMysteryCubeReplacementIds).size !==
      value.pendingMysteryCubeReplacementIds.length ||
    !value.pendingMysteryCubeReplacementIds.every(
      (definitionId) =>
        typeof definitionId === "string" &&
        trinketIds.includes(definitionId) &&
        isMysteryCubeTrinketSlotId(definitionId),
    )
  ) {
    return false;
  }
  if (
    !isRecord(value.heroPowerCounters) ||
    Array.isArray(value.heroPowerCounters) ||
    !Object.entries(value.heroPowerCounters).every(
      ([counterKey, count]) =>
        VALID_HERO_POWER_COUNTER_KEYS.has(counterKey) &&
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= 0,
    )
  ) {
    return false;
  }
  return (
    (value.heroId === null ||
      (typeof value.heroId === "string" &&
        isHeroDefinitionId(value.heroId))) &&
    isRecord(value.trinketCounters) &&
    Object.entries(value.trinketCounters).every(
      ([definitionId, count]) =>
        trinketIds.includes(definitionId) &&
        typeof count === "number" &&
        Number.isInteger(count) &&
        count >= 0,
    ) &&
    isRecord(value.trinketSelections) &&
    !Array.isArray(value.trinketSelections) &&
    Object.entries(value.trinketSelections).every(
      ([definitionId, selectedMinionDefinitionId]) => {
        if (
          !trinketIds.includes(definitionId) ||
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
    ) &&
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

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 11 &&
    candidate.contentVersion === CURRENT_ROSTER_VERSION &&
    isValidInitialHealth(candidate.initialHealth) &&
    typeof candidate.seed === "number" &&
    typeof candidate.nextInteractionId === "number" &&
    typeof candidate.lobbySystemsEnabled === "boolean" &&
    (candidate.lobbySystemsEnabled
      ? typeof candidate.systemEventId === "string" &&
        isSystemEventDefinitionId(candidate.systemEventId)
      : candidate.systemEventId === null) &&
    isTavernSpellPool(candidate.spellPool) &&
    isHumanScoutingReports(candidate.humanScoutingReports) &&
    Array.isArray(candidate.activeTribes) &&
    candidate.activeTribes.length === 5 &&
    candidate.activeTribes.every(isTribe) &&
    Array.isArray(candidate.players) &&
    candidate.players.length === 8 &&
    Array.isArray(candidate.deferredTriplePlayerIds) &&
    candidate.deferredTriplePlayerIds.every(
      (playerId) =>
        typeof playerId === "string" &&
        candidate.players?.some((player) => player.id === playerId),
    ) &&
    new Set(candidate.deferredTriplePlayerIds).size ===
      candidate.deferredTriplePlayerIds.length &&
    candidate.players.every(
      (player) =>
        typeof player.armor === "number" &&
        player.armor >= 0 &&
        hasLobbySystemPlayerState(player) &&
        (player.heroPowerId === null ||
          (typeof player.heroPowerId === "string" &&
            isHeroPowerDefinitionId(player.heroPowerId))) &&
        typeof player.tavernSpellsCastThisTurn === "number" &&
        typeof player.tavernSpellsCast === "number" &&
        typeof player.cardsPlayedThisTurn === "number" &&
        Number.isInteger(player.cardsPlayedThisTurn) &&
        player.cardsPlayedThisTurn >= 0 &&
        typeof player.goldSpentThisTurn === "number" &&
        Number.isInteger(player.goldSpentThisTurn) &&
        player.goldSpentThisTurn >= 0 &&
        typeof player.mrrgltonsPlayed === "number" &&
        Number.isInteger(player.mrrgltonsPlayed) &&
        player.mrrgltonsPlayed >= 0 &&
        typeof player.battlecriesTriggered === "number" &&
        Number.isInteger(player.battlecriesTriggered) &&
        player.battlecriesTriggered >= 0 &&
        typeof player.heroPowerExtraTriggers === "number" &&
        Number.isInteger(player.heroPowerExtraTriggers) &&
        player.heroPowerExtraTriggers >= 0 &&
        typeof player.darkmoonReservePricesDiscount === "number" &&
        Number.isInteger(player.darkmoonReservePricesDiscount) &&
        player.darkmoonReservePricesDiscount >= 0 &&
        typeof player.pendingTickatusTagPrizes === "number" &&
        Number.isInteger(player.pendingTickatusTagPrizes) &&
        player.pendingTickatusTagPrizes >= 0 &&
        (player.pendingCardPlayed === null ||
          isPendingCardPlayedEvent(player.pendingCardPlayed)) &&
        (player.lastTavernSpellDefinitionId === null ||
          (typeof player.lastTavernSpellDefinitionId === "string" &&
            TAVERN_SPELL_DEFINITION_IDS.has(
              player.lastTavernSpellDefinitionId,
            ))) &&
        (player.pendingTavernSpellDefinitionId === null ||
          (typeof player.pendingTavernSpellDefinitionId === "string" &&
            TAVERN_SPELL_DEFINITION_IDS.has(
              player.pendingTavernSpellDefinitionId,
            ))) &&
        Array.isArray(player.demonFodderRefreshQueue) &&
        player.demonFodderRefreshQueue.every(
          (count) =>
            typeof count === "number" &&
            Number.isInteger(count) &&
            count >= 0,
        ) &&
        typeof player.nextTavernSpellDiscount === "number" &&
        player.nextTavernSpellDiscount >= 0 &&
        typeof player.maxGold === "number" &&
        player.maxGold >= 10 &&
        typeof player.pendingNextTurnGold === "number" &&
        Array.isArray(player.pendingSpellcraft) &&
        player.pendingSpellcraft.every(isPendingSpellcraftGrant) &&
        typeof player.freeRefreshes === "number" &&
        typeof player.helpfulRefreshes === "number" &&
        player.helpfulRefreshes >= 0 &&
        (player.lastHelpfulRefreshKind === null ||
          (typeof player.lastHelpfulRefreshKind === "string" &&
            Object.hasOwn(
              HELPFUL_REFRESH_LABELS,
              player.lastHelpfulRefreshKind,
            ))) &&
        typeof player.tavernMinionAttackBonus === "number" &&
        typeof player.tavernMinionHealthBonus === "number" &&
        typeof player.tavernMinionAttackBonusThisTurn === "number" &&
        Number.isInteger(player.tavernMinionAttackBonusThisTurn) &&
        player.tavernMinionAttackBonusThisTurn >= 0 &&
        typeof player.tavernMinionHealthBonusThisTurn === "number" &&
        Number.isInteger(player.tavernMinionHealthBonusThisTurn) &&
        player.tavernMinionHealthBonusThisTurn >= 0 &&
        typeof player.nextCombatAttackBonus === "number" &&
        typeof player.nextCombatHealthBonus === "number" &&
        typeof player.nextCombatSetEnemyHealthToOne === "number" &&
        Array.isArray(player.nextCombatDoubleLeftmostAttack) &&
        player.nextCombatDoubleLeftmostAttack.every(
          (buff) =>
            typeof buff.attack === "number" &&
            typeof buff.health === "number",
        ) &&
        typeof player.nextCombatWinGold === "number" &&
        typeof player.nextCombatTieGold === "number" &&
        typeof player.nextTurnBoardAttackBonus === "number" &&
        typeof player.nextTurnBoardHealthBonus === "number" &&
        typeof player.nextTurnBoardBuffPulses === "number" &&
        typeof player.tavernBloodGemBarrageCount === "number" &&
        Number.isInteger(player.tavernBloodGemBarrageCount) &&
        player.tavernBloodGemBarrageCount >= 0 &&
        typeof player.tavernBloodGemBarrageAttack === "number" &&
        typeof player.tavernBloodGemBarrageHealth === "number" &&
        typeof player.backToBackBonus === "number" &&
        typeof player.tavernSpellAttackBonus === "number" &&
        typeof player.tavernSpellHealthBonus === "number" &&
        Array.isArray(player.tavernTypeBuffs) &&
        player.tavernTypeBuffs.every(
          (buff) =>
            Array.isArray(buff.tribes) &&
            buff.tribes.every((tribe) => typeof tribe === "string") &&
            typeof buff.attack === "number" &&
            typeof buff.health === "number",
        ) &&
        Array.isArray(player.tavernTierBuffs) &&
        player.tavernTierBuffs.every(
          (buff) =>
            Number.isInteger(buff.maximumTier) &&
            buff.maximumTier >= 1 &&
            buff.maximumTier <= 6 &&
            typeof buff.attack === "number" &&
            typeof buff.health === "number",
        ) &&
        Array.isArray(player.rideTheWindBuffs) &&
        player.rideTheWindBuffs.every(
          (buff) =>
            typeof buff.attack === "number" &&
            typeof buff.health === "number",
        ) &&
        typeof player.elementalsPlayedThisTurn === "number" &&
        typeof player.nextCombatBeetles === "number" &&
        typeof player.beetleAttackBonus === "number" &&
        player.beetleAttackBonus >= 0 &&
        typeof player.beetleHealthBonus === "number" &&
        player.beetleHealthBonus >= 0 &&
        typeof player.ballerAttackBonus === "number" &&
        typeof player.ballerHealthBonus === "number" &&
        typeof player.elementalGrantAttackBonus === "number" &&
        Number.isInteger(player.elementalGrantAttackBonus) &&
        player.elementalGrantAttackBonus >= 0 &&
        typeof player.elementalGrantHealthBonus === "number" &&
        Number.isInteger(player.elementalGrantHealthBonus) &&
        player.elementalGrantHealthBonus >= 0 &&
        typeof player.deathrattlesTriggered === "number" &&
        Number.isInteger(player.deathrattlesTriggered) &&
        player.deathrattlesTriggered >= 0 &&
        typeof player.magnetizationsThisGame === "number" &&
        Number.isInteger(player.magnetizationsThisGame) &&
        player.magnetizationsThisGame >= 0 &&
        typeof player.deepBlueBonus === "number" &&
        typeof player.undeadArmyAttackBonus === "number" &&
        typeof player.undeadArmyHealthBonus === "number" &&
        typeof player.astralAutomatonsSummoned === "number" &&
        Number.isInteger(player.astralAutomatonsSummoned) &&
        player.astralAutomatonsSummoned >= 0 &&
        typeof player.eternalKnightsDied === "number" &&
        Number.isInteger(player.eternalKnightsDied) &&
        player.eternalKnightsDied >= 0 &&
        typeof player.bloodGemAttack === "number" &&
        player.bloodGemAttack >= 1 &&
        typeof player.bloodGemHealth === "number" &&
        player.bloodGemHealth >= 1 &&
        Array.isArray(player.board) &&
        player.board.every(
          (minion) =>
            Array.isArray(minion.attachments) &&
            minion.attachments.every(isMagneticAttachment) &&
            hasSchema9MinionState(minion),
        ) &&
        Array.isArray(player.hand) &&
        player.hand.every(
          (card) =>
            (card.kind === "tripleReward" &&
              hasSchema9MinionState(card)) ||
            isBloodGemSpell(card) ||
            isConsolationCoin(card) ||
            isSpellcraftSpell(card) ||
            isTavernSpell(card) ||
            (card.kind === "minion" &&
              Array.isArray(card.attachments) &&
              card.attachments.every(isMagneticAttachment) &&
              hasSchema9MinionState(card)),
        ) &&
        Array.isArray(player.ghostHand) &&
        player.ghostHand.length <= 10 &&
        player.ghostHand.every(isGhostHandMinion) &&
        Array.isArray(player.shop) &&
        player.shop.every(
          (minion) =>
            Array.isArray(minion.attachments) &&
            minion.attachments.every(isMagneticAttachment) &&
            hasSchema9MinionState(minion),
        ) &&
        (player.spellShop === null ||
          isTavernSpell(player.spellShop)) &&
        Array.isArray(player.additionalSpellShop) &&
        player.additionalSpellShop.every(isTavernSpell) &&
        typeof player.spellOnlyRefreshActive === "boolean",
    ) &&
    (candidate.pendingInteraction === null ||
      (isPendingInteraction(candidate.pendingInteraction) &&
        pendingInteractionMatchesPlayer(
          candidate.pendingInteraction,
          candidate.players,
        ) &&
        pendingTrinketChoiceMatchesState(
          candidate.pendingInteraction,
          candidate.players,
          candidate.activeTribes,
        ))) &&
    typeof candidate.humanPlayerId === "string" &&
    (candidate.phase === "recruit" ||
      candidate.phase === "combat" ||
      candidate.phase === "gameOver")
  );
}

function printedTribeLabel(unit: MinionInstance): string {
  if (unit.tribes.length === 0) {
    return TRIBE_NAMES.neutral;
  }
  return unit.tribes.map((tribe) => TRIBE_NAMES[tribe]).join(" / ");
}

function isMagneticMinion(unit: MinionInstance): boolean {
  return (
    unit.kind === "minion" &&
    getMinionDefinition(unit.definitionId).magnetic !== undefined
  );
}

function isBoardMinionInstance(
  unit: MinionInstance,
): unit is BoardMinionInstance {
  return unit.kind === "minion";
}

function dragThreshold(pointerType: string): number {
  return pointerType === "touch" || pointerType === "pen"
    ? TOUCH_DRAG_THRESHOLD_PX
    : MOUSE_DRAG_THRESHOLD_PX;
}

function mergeCardPointerHandlers(
  inspectionHandlers?: CardInspectionHandlers,
  dragHandlers?: DragPointerHandlers,
) {
  const mergePointerHandler = (
    inspectionHandler:
      | PointerEventHandler<HTMLButtonElement>
      | undefined,
    dragHandler:
      | PointerEventHandler<HTMLButtonElement>
      | undefined,
  ): PointerEventHandler<HTMLButtonElement> | undefined => {
    if (!inspectionHandler) return dragHandler;
    if (!dragHandler) return inspectionHandler;
    return (event) => {
      inspectionHandler(event);
      dragHandler(event);
    };
  };

  return {
    onPointerEnter: inspectionHandlers?.onPointerEnter,
    onPointerLeave: inspectionHandlers?.onPointerLeave,
    onPointerDown: mergePointerHandler(
      inspectionHandlers?.onPointerDown,
      dragHandlers?.onPointerDown,
    ),
    onPointerMove: mergePointerHandler(
      inspectionHandlers?.onPointerMove,
      dragHandlers?.onPointerMove,
    ),
    onPointerUp: mergePointerHandler(
      inspectionHandlers?.onPointerUp,
      dragHandlers?.onPointerUp,
    ),
    onPointerCancel: mergePointerHandler(
      inspectionHandlers?.onPointerCancel,
      dragHandlers?.onPointerCancel,
    ),
    onLostPointerCapture: mergePointerHandler(
      inspectionHandlers?.onLostPointerCapture,
      dragHandlers?.onLostPointerCapture,
    ),
    onClickCapture: inspectionHandlers?.onClickCapture,
    onFocus: inspectionHandlers?.onFocus,
    onBlur: inspectionHandlers?.onBlur,
  };
}

function countMagneticAttachments(
  attachments: readonly MagneticAttachment[],
): number {
  return attachments.reduce(
    (count, attachment) =>
      count + 1 + countMagneticAttachments(attachment.attachments),
    0,
  );
}

function newSeed(): number {
  const seed = Date.now() >>> 0;
  return seed === 0 ? INITIAL_SEED : seed;
}

function resultLabel(result: BattleResult | undefined): string {
  if (result === "win") return "战斗胜利";
  if (result === "loss") return "战斗失利";
  return "势均力敌";
}

function summarizeCombatRewards(
  events: readonly BattleEvent[],
  playerId: string,
): CombatRewardSummary {
  const rewardEvents = events.filter(
    (event) =>
      event.type === "cardGain" &&
      event.actorPlayerId === playerId,
  );
  return {
    addedCount: rewardEvents.filter(
      (event) => event.cardGainResult === "added",
    ).length,
    handFullCount: rewardEvents.filter(
      (event) => event.cardGainResult === "handFull",
    ).length,
    noCandidateCount: rewardEvents.filter(
      (event) => event.cardGainResult === "noCandidate",
    ).length,
    addedNames: rewardEvents.flatMap((event) =>
      event.cardGainResult === "added" &&
      (event.minion || event.cardName)
        ? [event.minion?.name ?? event.cardName ?? ""]
        : [],
    ),
    addedInstanceIds: rewardEvents.flatMap((event) =>
      event.cardGainResult === "added" &&
      (event.minion || event.targetInstanceId)
        ? [event.minion?.instanceId ?? event.targetInstanceId ?? ""]
        : [],
    ),
  };
}

function combatRewardSummaryText(
  summary: CombatRewardSummary,
): string {
  const parts = [
    summary.addedCount > 0
      ? `战斗中获得 ${summary.addedCount} 张卡牌`
      : "战斗中未获得卡牌",
  ];
  if (summary.handFullCount > 0) {
    parts.push(`手牌已满 ${summary.handFullCount} 次`);
  }
  if (summary.noCandidateCount > 0) {
    parts.push(`随从池无候选 ${summary.noCandidateCount} 次`);
  }
  return parts.join(" · ");
}

function battleEventDelay(
  event: BattleEvent | undefined,
  speed: BattleSpeed,
): number {
  const baseDelay =
    event?.type === "battleStart"
      ? 850
      : event?.type === "attack"
        ? 800
        : event?.type === "damage"
          ? 720
          : event?.type === "startOfCombat"
            ? 720
            : event?.type === "avenge"
              ? 720
              : event?.type === "trigger" ||
                  event?.type === "tavernSpellCast"
                ? 720
              : event?.type === "buff"
                ? 620
                : event?.type === "handBuff"
                  ? 620
                  : event?.type === "keywordRemoved"
                    ? 620
                    : event?.type === "shieldBroken"
                      ? 620
                      : event?.type === "death"
                        ? 680
                        : event?.type === "summon"
                          ? 650
                          : event?.type === "cardGain"
                            ? 720
                            : event?.type === "heroDamage"
                              ? 850
                              : 650;
  return Math.max(180, Math.round(baseDelay / speed));
}

function phaseLabel(phase: GameState["phase"]): string {
  if (phase === "recruit") return "招募";
  if (phase === "combat") return "战斗";
  return "终局";
}

function selectionUnit(
  selection: Selection,
  player: PlayerState,
): MinionInstance | null {
  if (!selection || selection.zone === "spellShop") return null;
  const card = player[selection.zone][selection.index];
  return card?.kind === "minion" ? card : null;
}

function unitKeyword(unit: MinionInstance): string {
  return (
    [
      unit.golden ? "金色" : "",
      isMagneticMinion(unit) ? "磁力" : "",
      unit.taunt ? "嘲讽" : "",
      unit.stealth ? "潜行" : "",
      unit.divineShield ? "圣盾" : "",
      unit.reborn ? "复生" : "",
      unit.poisonous ? "剧毒" : "",
      unit.venomous ? "烈毒" : "",
      unit.windfury ? "风怒" : "",
      unit.cleave ? "顺劈" : "",
    ]
      .filter(Boolean)
      .join(" · ") || printedTribeLabel(unit)
  );
}

function UnitKeywordVisuals({
  visuals,
}: {
  visuals: readonly MinionKeywordVisual[];
}) {
  if (visuals.length === 0) return null;

  return (
    <span className="keyword-vfx-layer" aria-hidden="true">
      {visuals.map((visual) => (
        <span
          className={`keyword-vfx keyword-vfx-${visual.kind}`}
          data-keyword-vfx={visual.kind}
          key={visual.kind}
        />
      ))}
    </span>
  );
}

function UnitCardFace({
  unit,
  keywordVisuals = activeMinionKeywordVisuals(unit),
}: {
  unit: MinionInstance;
  keywordVisuals?: readonly MinionKeywordVisual[];
}) {
  return (
    <>
      <CardArtwork unit={unit} kind="portrait" />
      <UnitKeywordVisuals visuals={keywordVisuals} />
      <span className="card-tier">{unit.tier}</span>
      <span className="card-name">{unit.name}</span>
      <span className="keyword">{unitKeyword(unit)}</span>
      <span className="card-stats">
        <span className="stat" data-stat="attack">
          ATK {unit.attack}
        </span>
        <span className="stat" data-stat="health">
          HP {unit.health}
        </span>
      </span>
    </>
  );
}

function UnitCard({
  unit,
  purchaseCost,
  purchaseCurrency = "gold",
  selected = false,
  unaffordable = false,
  compact = false,
  playable = false,
  dragEnabled = false,
  dragging = false,
  combatActor = false,
  combatTarget = false,
  combatAttacking = false,
  combatHit = false,
  combatDamageLabel,
  combatShieldBreaking = false,
  combatDead = false,
  combatStartOfCombat = false,
  combatAvenge = false,
  combatTrigger = false,
  combatTriggerLabel,
  combatBuffTarget = false,
  combatBuffLabel,
  combatDebuffTarget = false,
  combatDebuffLabel,
  combatSummoned = false,
  combatSummonLabel,
  choiceTarget = false,
  magneticTarget = false,
  magneticDropTarget = false,
  bloodGemTarget = false,
  bloodGemDropTarget = false,
  bloodGemCast = false,
  bloodGemCastLabel,
  bloodGemCastToken,
  tavernSpellTarget = false,
  spellTargetKind,
  tavernSpellDropTarget = false,
  tavernSpellCast = false,
  tavernSpellCastLabel,
  tavernSpellCastToken,
  heroPowerTarget = false,
  newlyGenerated = false,
  locked = false,
  disabled = false,
  combatShieldBurst = false,
  combatDeadDissolve = false,
  combatCharging = false,
  combatColliding = false,
  combatRebounding = false,
  combatChargeX = 0,
  combatChargeY = 0,
  dragHandlers,
  inspectionHandlers,
  testId,
  onClick,
  onKeyDown,
}: {
  unit: MinionInstance;
  purchaseCost?: number;
  purchaseCurrency?: "gold" | "health";
  selected?: boolean;
  unaffordable?: boolean;
  compact?: boolean;
  playable?: boolean;
  dragEnabled?: boolean;
  dragging?: boolean;
  combatActor?: boolean;
  combatTarget?: boolean;
  combatAttacking?: boolean;
  combatHit?: boolean;
  combatDamageLabel?: string;
  combatShieldBreaking?: boolean;
  combatShieldBurst?: boolean;
  combatDead?: boolean;
  combatDeadDissolve?: boolean;
  combatCharging?: boolean;
  combatColliding?: boolean;
  combatRebounding?: boolean;
  combatChargeX?: number;
  combatChargeY?: number;
  combatStartOfCombat?: boolean;
  combatAvenge?: boolean;
  combatTrigger?: boolean;
  combatTriggerLabel?: string;
  combatBuffTarget?: boolean;
  combatBuffLabel?: string;
  combatDebuffTarget?: boolean;
  combatDebuffLabel?: string;
  combatSummoned?: boolean;
  combatSummonLabel?: string;
  choiceTarget?: boolean;
  magneticTarget?: boolean;
  magneticDropTarget?: boolean;
  bloodGemTarget?: boolean;
  bloodGemDropTarget?: boolean;
  bloodGemCast?: boolean;
  bloodGemCastLabel?: string;
  bloodGemCastToken?: string;
  tavernSpellTarget?: boolean;
  spellTargetKind?: "tavernSpell" | "spellcraft" | "generated";
  tavernSpellDropTarget?: boolean;
  tavernSpellCast?: boolean;
  tavernSpellCastLabel?: string;
  tavernSpellCastToken?: string;
  heroPowerTarget?: boolean;
  newlyGenerated?: boolean;
  locked?: boolean;
  disabled?: boolean;
  dragHandlers?: DragPointerHandlers;
  inspectionHandlers?: CardInspectionHandlers;
  testId?: string;
  onClick?: () => void;
  onKeyDown?: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => void;
}) {
  const keywordVisuals = activeMinionKeywordVisuals(unit);
  const combatRole = combatDead
    ? "dead"
    : combatStartOfCombat
      ? "start-of-combat"
      : combatAvenge
        ? "avenge"
        : combatTrigger
          ? "trigger"
        : combatActor
          ? combatBuffTarget
            ? "actor buff-target"
            : combatDebuffTarget
              ? "actor debuff-target"
              : combatTarget
                ? "actor target"
                : "actor"
          : combatBuffTarget
            ? "buff-target"
            : combatDebuffTarget
              ? "debuff-target"
              : combatSummoned
                ? "summoned"
                : combatTarget
                  ? "target"
                  : undefined;
  return (
    <button
      type="button"
      className={`unit-card${selected ? " is-selected" : ""}${
        unaffordable ? " is-unaffordable" : ""
      }${compact ? " is-compact" : ""}${
        playable ? " is-playable" : ""
      }${
        dragEnabled ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}${
        combatActor ? " is-combat-actor" : ""
      }${combatTarget ? " is-combat-target" : ""}${
        combatAttacking ? " is-attacking" : ""
      }${combatHit ? " is-hit" : ""}${
        combatShieldBreaking ? " is-shield-breaking" : ""
      }${
        combatShieldBurst ? " is-shield-burst" : ""
      }${
        combatDead ? " is-dead" : ""
      }${
        combatDeadDissolve ? " is-dead-dissolve" : ""
      }${
        combatCharging ? " is-charging" : ""
      }${
        combatColliding ? " is-colliding" : ""
      }${
        combatRebounding ? " is-rebounding" : ""
      }${
        combatStartOfCombat ? " is-start-of-combat-trigger" : ""
      }${
        combatAvenge ? " is-avenge-trigger" : ""
      }${
        combatTrigger ? " is-effect-trigger" : ""
      }${
        combatBuffTarget ? " is-combat-buff-target is-buffed" : ""
      }${
        combatDebuffTarget
          ? " is-combat-debuff-target is-debuffed"
          : ""
      }${combatSummoned ? " is-summoned" : ""}${
        choiceTarget ? " is-choice-target" : ""
      }${magneticTarget ? " is-magnetic-target" : ""}${
        magneticDropTarget ? " is-magnetic-drop-target" : ""
      }${bloodGemTarget ? " is-blood-gem-target" : ""}${
        bloodGemDropTarget ? " is-blood-gem-drop-target" : ""
      }${bloodGemCast ? " is-blood-gem-cast" : ""}${
        tavernSpellTarget ? " is-tavern-spell-target" : ""
      }${tavernSpellDropTarget ? " is-tavern-spell-drop-target" : ""}${
        tavernSpellCast ? " is-tavern-spell-cast" : ""
      }${heroPowerTarget ? " is-hero-power-target" : ""}${
        newlyGenerated ? " is-newly-generated" : ""
      }${
        locked ? " is-turn-locked" : ""
      }${
        disabled ? " is-disabled" : ""
      }`}
      aria-label={`${unit.name}，${unit.tier} 级，${printedTribeLabel(
        unit,
      )}，${unit.attack} 攻击，${unit.health} 生命，${
        unit.description
      }${purchaseCost === undefined ? "" : `，购买费用${purchaseCost}${purchaseCurrency === "health" ? "点生命" : "枚金币"}`}${
        keywordVisuals.length > 0
          ? `，当前关键词：${keywordVisuals
              .map(({ label }) => label)
              .join("、")}`
          : ""
      }${choiceTarget ? "，可选择为效果目标" : ""}${
        magneticTarget ? "，可作为磁力吸附目标" : ""
      }${bloodGemTarget ? "，可作为鲜血宝石目标" : ""}${
        tavernSpellTarget
          ? spellTargetKind === "spellcraft"
            ? "，可作为塑造法术目标"
            : spellTargetKind === "generated"
              ? "，可作为法术目标"
              : "，可作为酒馆法术目标"
          : ""
      }${
        newlyGenerated ? "，本轮战斗新获得" : ""
      }${
        combatStartOfCombat ? "，正在触发战斗开始效果" : ""
      }${
        combatAvenge ? "，正在触发复仇" : ""
      }${
        combatTrigger ? "，正在触发特殊效果" : ""
      }${
        locked ? "，当前锁定，达到可用回合后解锁" : ""
      }`}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-describedby={
        [
          dragEnabled ? "drag-instructions" : "",
          magneticTarget ? "magnetic-target-instructions" : "",
          bloodGemTarget ? "blood-gem-target-instructions" : "",
          tavernSpellTarget
            ? spellTargetKind === "tavernSpell"
              ? "tavern-spell-target-instructions"
              : "spellcraft-target-instructions"
            : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined
      }
      data-combat-role={combatRole}
      data-drag-enabled={dragEnabled}
      data-magnetic-target={magneticTarget || undefined}
      data-magnetic-drop-target={magneticDropTarget || undefined}
      data-blood-gem-target={bloodGemTarget || undefined}
      data-blood-gem-drop-target={bloodGemDropTarget || undefined}
      data-tavern-spell-target={tavernSpellTarget || undefined}
      data-tavern-spell-drop-target={tavernSpellDropTarget || undefined}
      data-newly-generated={newlyGenerated || undefined}
      data-turn-locked={locked || undefined}
      data-keyword-visuals={
        keywordVisuals.map(({ kind }) => kind).join(" ") || undefined
      }
      data-shield-breaking={combatShieldBreaking || undefined}
      data-start-of-combat-trigger={combatStartOfCombat || undefined}
      data-avenge-trigger={combatAvenge || undefined}
      data-effect-trigger={combatTrigger || undefined}
      data-testid={testId}
      data-unit-instance-id={unit.instanceId}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      style={
        {
          "--card-hue": TRIBE_HUE[unit.tribe],
          ...(combatCharging || combatColliding
            ? {
                "--charge-x": `${combatChargeX ?? 0}px`,
                "--charge-y": `${combatChargeY ?? 0}px`,
              }
            : {}),
          ...(combatRebounding
            ? {
                "--bounce-x": `${combatChargeX ?? 0}px`,
                "--bounce-y": `${combatChargeY ?? 0}px`,
              }
            : {}),
          ...(combatColliding
            ? {
                "--hit-x": `${-(combatChargeX ?? 0)}px`,
                "--hit-y": `${-(combatChargeY ?? 0)}px`,
              }
            : {}),
        } as CSSProperties
      }
      {...mergeCardPointerHandlers(inspectionHandlers, dragHandlers)}
    >
      <UnitCardFace unit={unit} keywordVisuals={keywordVisuals} />
      {purchaseCost !== undefined && (
        <span
          className={`shop-purchase-cost${
            purchaseCurrency === "health" ? " is-health-cost" : ""
          }`}
          data-purchase-currency={purchaseCurrency}
        >
          {purchaseCurrency === "health" ? "♥" : ""}
          {purchaseCost}
        </span>
      )}
      {combatShieldBreaking && (
        <span className="keyword-vfx-shield-break" aria-hidden="true" />
      )}
      {locked && (
        <span className="turn-lock-label" aria-hidden="true">
          本回合锁定
        </span>
      )}
      {combatBuffTarget && combatBuffLabel && (
        <span className="combat-buff-label" aria-hidden="true">
          {combatBuffLabel}
        </span>
      )}
      {combatHit && combatDamageLabel && (
        <span className="combat-damage-label" aria-hidden="true">
          {combatDamageLabel}
        </span>
      )}
      {combatDead && (
        <span className="combat-death-label" aria-hidden="true">
          阵亡
        </span>
      )}
      {combatStartOfCombat && (
        <span className="combat-start-of-combat-label" aria-hidden="true">
          开战！
        </span>
      )}
      {combatAvenge && (
        <span className="combat-avenge-label" aria-hidden="true">
          复仇！
        </span>
      )}
      {combatTrigger && (
        <span className="combat-trigger-label" aria-hidden="true">
          {combatTriggerLabel ?? "触发！"}
        </span>
      )}
      {combatDebuffTarget && combatDebuffLabel && (
        <span className="combat-debuff-label" aria-hidden="true">
          {combatDebuffLabel}
        </span>
      )}
      {combatSummoned && combatSummonLabel && (
        <span className="combat-summon-label" aria-hidden="true">
          {combatSummonLabel}
        </span>
      )}
      {magneticTarget && (
        <span className="magnetic-target-label" aria-hidden="true">
          可吸附
        </span>
      )}
      {bloodGemTarget && (
        <span className="blood-gem-target-label" aria-hidden="true">
          使用宝石
        </span>
      )}
      {bloodGemCast && bloodGemCastLabel && (
        <span
          className="blood-gem-cast-label"
          aria-hidden="true"
          key={bloodGemCastToken}
        >
          {bloodGemCastLabel}
        </span>
      )}
      {tavernSpellTarget && (
        <span className="tavern-spell-target-label" aria-hidden="true">
          施放法术
        </span>
      )}
      {tavernSpellCast && tavernSpellCastLabel && (
        <span
          className="tavern-spell-cast-label"
          aria-hidden="true"
          key={tavernSpellCastToken}
        >
          {tavernSpellCastLabel}
        </span>
      )}
      {newlyGenerated && (
        <span className="new-card-label" aria-hidden="true">
          新获得
        </span>
      )}
    </button>
  );
}

function MagneticAttachmentList({
  attachments,
}: {
  attachments: readonly MagneticAttachment[];
}) {
  return (
    <ul className="magnetic-attachment-list">
      {attachments.map((attachment) => (
        <li key={attachment.sourceInstanceId}>
          <div className="magnetic-attachment-row">
            <span>
              <strong>
                {attachment.golden ? "金色 " : ""}
                {attachment.name}
              </strong>
              {attachment.attachments.length > 0 && (
                <small>
                  含 {countMagneticAttachments(attachment.attachments)} 个附件
                </small>
              )}
            </span>
            <span
              className="magnetic-attachment-stats"
              aria-label={`自身贡献 ${attachment.attackGranted} 攻击和 ${attachment.healthGranted} 生命`}
            >
              +{attachment.attackGranted}/+{attachment.healthGranted}
            </span>
          </div>
          <p className="magnetic-attachment-description">
            {attachment.description}
          </p>
          {attachment.effectSupport === "partial" && (
            <small className="magnetic-attachment-support">
              部分专属文字效果仍在适配
            </small>
          )}
          {attachment.attachments.length > 0 && (
            <MagneticAttachmentList attachments={attachment.attachments} />
          )}
        </li>
      ))}
    </ul>
  );
}

function TripleRewardCard({
  card,
  disabled = false,
  inspectionHandlers,
  testId,
  onPlay,
}: {
  card: TripleRewardSpellInstance;
  disabled?: boolean;
  inspectionHandlers?: CardInspectionHandlers;
  testId?: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className={`triple-reward-card${
        disabled ? "" : " is-playable"
      }`}
      aria-label={`三连奖励，发现一个 ${card.tier} 级随从`}
      data-testid={testId}
      disabled={disabled}
      onClick={onPlay}
      style={{ "--card-hue": TRIBE_HUE.neutral } as CSSProperties}
      {...mergeCardPointerHandlers(inspectionHandlers)}
    >
      <CardArtwork unit={card} kind="portrait" />
      <span className="triple-reward-tier">{card.tier}</span>
      <span className="triple-reward-name">三连奖励</span>
      <span className="triple-reward-copy">
        发现一个 <strong>{card.tier}</strong> 级随从
      </span>
      <span className="triple-reward-hint">点击使用</span>
    </button>
  );
}

function ConsolationCoinCard({
  card,
  disabled = false,
  inspectionHandlers,
  testId,
  onPlay,
}: {
  card: ConsolationCoinSpellInstance;
  disabled?: boolean;
  inspectionHandlers?: CardInspectionHandlers;
  testId?: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className={`tavern-spell-card consolation-coin-card${
        disabled ? "" : " is-playable"
      }`}
      aria-label={`${card.name}，0费法术，${card.description}，点击使用`}
      data-testid={testId}
      disabled={disabled}
      onClick={onPlay}
      style={{ "--card-hue": 42 } as CSSProperties}
      {...mergeCardPointerHandlers(inspectionHandlers)}
    >
      <CardArtwork unit={card} kind="portrait" />
      <span className="tavern-spell-cost">0</span>
      <span className="tavern-spell-name">{card.name}</span>
      <span className="tavern-spell-copy">{card.description}</span>
      <span className="tavern-spell-hint">点击使用</span>
    </button>
  );
}

function bloodGemKeywordText(card: BloodGemSpellInstance): string {
  return card.bonusKeyword === "tauntForQuilboar"
    ? "嘲讽"
    : card.bonusKeyword === "rebornForQuilboar"
    ? "复生"
    : card.bonusKeyword === "divineShieldForQuilboar"
      ? "圣盾"
      : "";
}

function bloodGemBonusText(card: BloodGemSpellInstance): string {
  const keyword = bloodGemKeywordText(card);
  return keyword ? `野猪人还会获得${keyword}` : "";
}

function BloodGemCardFace({
  card,
  attack,
  health,
}: {
  card: BloodGemSpellInstance;
  attack: number;
  health: number;
}) {
  return (
    <>
      <CardArtwork unit={card} kind="portrait" />
      <span className="blood-gem-cost">0</span>
      <span className="blood-gem-name">鲜血宝石</span>
      <span className="blood-gem-copy">
        使一个友方随从获得
        <strong>
          +{attack}/+{health}
        </strong>
        {bloodGemBonusText(card) && (
          <small>{bloodGemBonusText(card)}</small>
        )}
      </span>
      <span className="blood-gem-hint">拖到随从上使用</span>
    </>
  );
}

function BloodGemCard({
  card,
  attack,
  health,
  selected = false,
  playable = false,
  disabled = false,
  dragging = false,
  dragHandlers,
  inspectionHandlers,
  testId,
  onClick,
}: {
  card: BloodGemSpellInstance;
  attack: number;
  health: number;
  selected?: boolean;
  playable?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dragHandlers?: DragPointerHandlers;
  inspectionHandlers?: CardInspectionHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`blood-gem-card${
        bloodGemBonusText(card) ? " has-bonus" : ""
      }${selected ? " is-selected" : ""}${
        playable ? " is-playable" : ""
      }${
        dragHandlers ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}`}
      aria-label={`鲜血宝石，使一个友方随从获得+${attack}/+${health}。${bloodGemBonusText(
        card,
      )}。拖到友方随从上使用`}
      aria-pressed={selected}
      data-card-instance-id={card.instanceId}
      data-drag-enabled={Boolean(dragHandlers)}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{ "--card-hue": TRIBE_HUE.quilboar } as CSSProperties}
      {...mergeCardPointerHandlers(inspectionHandlers, dragHandlers)}
    >
      <BloodGemCardFace card={card} attack={attack} health={health} />
    </button>
  );
}

function SpellcraftCardFace({
  card,
}: {
  card: SpellcraftSpellInstance;
}) {
  return (
    <>
      <CardArtwork unit={card} kind="portrait" />
      <span className="tavern-spell-cost">0</span>
      <span className="tavern-spell-name">{card.name}</span>
      <span className="tavern-spell-copy">{card.description}</span>
      <span className="tavern-spell-hint">
        {spellcraftNeedsTarget(card)
          ? card.target === "shop"
            ? "拖到酒馆随从上塑造"
            : card.spellFamily === "generated"
            ? "拖到友方随从上施放"
            : "拖到友方随从上塑造"
          : "拖到战场或点击施放"}
      </span>
    </>
  );
}

function SpellcraftCard({
  card,
  selected = false,
  playable = false,
  disabled = false,
  dragging = false,
  dragHandlers,
  inspectionHandlers,
  testId,
  onClick,
}: {
  card: SpellcraftSpellInstance;
  selected?: boolean;
  playable?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dragHandlers?: DragPointerHandlers;
  inspectionHandlers?: CardInspectionHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`tavern-spell-card spellcraft-card${
        (card.effectMultiplier ?? 1) > 1 ? " is-golden" : ""
      }${
        selected ? " is-selected" : ""
      }${playable ? " is-playable" : ""}${
        dragHandlers ? " is-draggable" : ""
      }${
        dragging ? " is-drag-source" : ""
      }`}
      aria-label={`${(card.effectMultiplier ?? 1) > 1 ? "金色" : ""}${
        card.name
      }，0费${
        card.spellFamily === "generated" ? "法术" : "塑造法术"
      }，${card.description}`}
      aria-pressed={selected}
      data-card-instance-id={card.instanceId}
      data-drag-enabled={Boolean(dragHandlers)}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{ "--card-hue": 222 } as CSSProperties}
      {...mergeCardPointerHandlers(inspectionHandlers, dragHandlers)}
    >
      <SpellcraftCardFace card={card} />
    </button>
  );
}

function TavernSpellCardFace({
  card,
  inShop = false,
  purchaseCost,
  purchaseCurrency,
}: {
  card: TavernSpellInstance;
  inShop?: boolean;
  purchaseCost?: number;
  purchaseCurrency?: "gold" | "health";
}) {
  const displayedPurchaseCurrency = inShop
    ? (purchaseCurrency ?? tavernSpellPurchaseCurrency(card))
    : tavernSpellPurchaseCurrency(card);
  const displayCost = inShop ? (purchaseCost ?? card.cost) : card.cost;
  const discounted = inShop && displayCost < card.cost;
  return (
    <>
      <CardArtwork unit={card} kind="portrait" />
      <span
        className={`tavern-spell-cost${
          displayedPurchaseCurrency === "health" ? " is-health-cost" : ""
        }${discounted ? " is-discounted" : ""
        }`}
      >
        {displayedPurchaseCurrency === "health" ? "♥" : ""}
        {displayCost}
      </span>
      <span className="tavern-spell-tier">{card.tier}</span>
      <span className="tavern-spell-name">{card.name}</span>
      <span className="tavern-spell-copy">{card.description}</span>
      <span className="tavern-spell-hint">
        {inShop
          ? displayedPurchaseCurrency === "health"
            ? `购买 · ${displayCost} 生命`
            : discounted
              ? `购买 · ${displayCost}（原${card.cost}）`
              : `购买 · ${displayCost}`
          : tavernSpellNeedsTarget(card)
            ? "拖到随从上施放"
            : "拖到战场或点击施放"}
      </span>
    </>
  );
}

function TavernSpellCard({
  card,
  inShop = false,
  purchaseCost,
  purchaseCurrency,
  selected = false,
  playable = false,
  unaffordable = false,
  disabled = false,
  dragging = false,
  dragHandlers,
  inspectionHandlers,
  testId,
  onClick,
}: {
  card: TavernSpellInstance;
  inShop?: boolean;
  purchaseCost?: number;
  purchaseCurrency?: "gold" | "health";
  selected?: boolean;
  playable?: boolean;
  unaffordable?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dragHandlers?: DragPointerHandlers;
  inspectionHandlers?: CardInspectionHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  const displayedPurchaseCurrency = inShop
    ? (purchaseCurrency ?? tavernSpellPurchaseCurrency(card))
    : tavernSpellPurchaseCurrency(card);
  const displayCost = inShop ? (purchaseCost ?? card.cost) : card.cost;
  return (
    <button
      type="button"
      className={`tavern-spell-card${inShop ? " is-shop-offer" : ""}${
        selected ? " is-selected" : ""
      }${playable ? " is-playable" : ""}${
        unaffordable ? " is-unaffordable" : ""
      }${
        dragHandlers ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}`}
      aria-label={`${card.name}，${card.tier}级酒馆法术，费用${displayCost}${
        displayedPurchaseCurrency === "health" ? "点生命" : "枚金币"
      }，${card.description}`}
      aria-pressed={selected}
      data-card-instance-id={card.instanceId}
      data-drag-enabled={Boolean(dragHandlers)}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{ "--card-hue": 266 } as CSSProperties}
      {...mergeCardPointerHandlers(inspectionHandlers, dragHandlers)}
    >
      <TavernSpellCardFace
        card={card}
        inShop={inShop}
        purchaseCost={purchaseCost}
        purchaseCurrency={displayedPurchaseCurrency}
      />
    </button>
  );
}

function CardArtwork({
  unit,
  kind,
}: {
  unit: { cardId: string; name: string };
  kind: "portrait" | "detail";
}) {
  const cardId = encodeURIComponent(unit.cardId);
  const portraitLocal = `/card-art/portraits/${cardId}.webp`;
  const portraitRemote = `https://art.hearthstonejson.com/v1/256x/${cardId}.webp`;
  const renderLocal = `/card-art/renders/zhCN/${cardId}.png`;
  const renderRemote = `https://art.hearthstonejson.com/v1/render/latest/zhCN/512x/${cardId}.png`;
  const preferRemote = unit.cardId.includes("_MagicItem_");
  const sources =
    kind === "detail"
      ? preferRemote
        ? [renderRemote, portraitRemote, renderLocal, portraitLocal]
        : [renderLocal, renderRemote, portraitLocal, portraitRemote]
      : preferRemote
        ? [portraitRemote, portraitLocal]
        : [portraitLocal, portraitRemote];
  const [sourceIndex, setSourceIndex] = useState(0);

  const source = sources[sourceIndex];
  return (
    <span
      className={`${kind === "detail" ? "detail-art" : "card-art"}${
        source ? " has-image" : ""
      }`}
      data-fallback={unit.name}
    >
      {source ? (
        // A plain img is required for the preferred source -> fallback chain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={kind === "detail" ? `${unit.name}卡牌图` : ""}
          draggable={false}
          loading={kind === "detail" ? "eager" : "lazy"}
          onError={() => setSourceIndex((index) => index + 1)}
        />
      ) : (
        <span className="art-fallback">{unit.name}</span>
      )}
    </span>
  );
}

function spellcraftDisplayLabel(card: SpellcraftSpellInstance): string {
  return card.spellFamily === "generated" ? "法术" : "塑造法术";
}

function inspectionCardMeta(
  card: InspectableCard,
  bloodGemAttack: number,
  bloodGemHealth: number,
): string {
  if (card.kind === "tripleReward") {
    return `${card.tier} 星三连奖励`;
  }
  if (card.kind === "minion") {
    return `${card.tier} 星 · ${printedTribeLabel(card)} · ${
      card.attack
    } 攻 / ${card.health} 血 · ${unitKeyword(card)}`;
  }
  if (card.kind === "tavernSpell") {
    return `${card.tier} 星酒馆法术 · ${card.cost} 费`;
  }
  if (card.kind === "spellcraft") {
    if (card.spellFamily === "generated") {
      return "法术 · 0 费";
    }
    return `${
      (card.effectMultiplier ?? 1) > 1 ? "金色" : "普通"
    }塑造法术 · 0 费`;
  }
  if (card.kind === "bloodGem") {
    return `鲜血宝石 · 当前 +${bloodGemAttack}/+${bloodGemHealth}`;
  }
  return "酒馆法术 · 0 费";
}

function inspectionCardDescription(
  card: InspectableCard,
  bloodGemAttack: number,
  bloodGemHealth: number,
): string {
  if (card.kind === "tripleReward") {
    return `发现一个 ${card.tier} 星随从。`;
  }
  if (card.kind === "bloodGem") {
    const bonus = bloodGemBonusText(card);
    return `使一个友方随从获得 +${bloodGemAttack}/+${bloodGemHealth}${
      bonus ? `；${bonus}` : ""
    }。`;
  }
  return card.description;
}

function CardInspectionPreview({
  inspection,
  layout,
  bloodGemAttack,
  bloodGemHealth,
}: {
  inspection: CardInspectionState;
  layout: {
    left: number;
    top: number;
    width: number;
    height: number;
    side: "left" | "right" | "overlap";
  };
  bloodGemAttack: number;
  bloodGemHealth: number;
}) {
  const triggerLabel =
    inspection.trigger === "hover"
      ? "悬停检查"
      : inspection.trigger === "focus"
        ? "键盘检查"
        : "长按检查";
  return (
    <aside
      className="card-inspection-preview"
      role="tooltip"
      aria-live="polite"
      data-card-instance-id={inspection.card.instanceId}
      data-placement={layout.side}
      data-testid="card-inspection-preview"
      data-trigger={inspection.trigger}
      style={
        {
          left: layout.left,
          top: layout.top,
          width: layout.width,
          height: layout.height,
        } as CSSProperties
      }
    >
      <span className="card-inspection-kicker">
        {triggerLabel} · Esc 关闭
      </span>
      <div className="card-inspection-art">
        <CardArtwork
          key={inspection.card.cardId}
          unit={inspection.card}
          kind="detail"
        />
      </div>
      <div className="card-inspection-copy">
        <strong>{inspection.card.name}</strong>
        <span>
          {inspectionCardMeta(
            inspection.card,
            bloodGemAttack,
            bloodGemHealth,
          )}
        </span>
        <p>
          {inspectionCardDescription(
            inspection.card,
            bloodGemAttack,
            bloodGemHealth,
          )}
        </p>
      </div>
    </aside>
  );
}

type CombatLinkGeometry = {
  width: number;
  height: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function CombatAttackLink({
  actorInstanceId,
  targetInstanceId,
  eventIndex,
  onChargeVector,
}: {
  actorInstanceId: string;
  targetInstanceId: string;
  eventIndex: number;
  onChargeVector?: (vector: { x: number; y: number }) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [geometry, setGeometry] = useState<CombatLinkGeometry | null>(
    null,
  );

  const chargeVectorRef = useRef(onChargeVector);
  chargeVectorRef.current = onChargeVector;

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const board = svg?.closest(".board") as HTMLElement | null;
    if (!svg || !board) {
      setGeometry(null);
      return;
    }

    const updateGeometry = () => {
      const cards = Array.from(
        board.querySelectorAll<HTMLElement>(
          "[data-unit-instance-id]",
        ),
      );
      const actor = cards.find(
        (card) =>
          card.dataset.unitInstanceId === actorInstanceId,
      );
      const target = cards.find(
        (card) =>
          card.dataset.unitInstanceId === targetInstanceId,
      );
      if (!actor || !target) {
        setGeometry(null);
        return;
      }

      const boardRect = board.getBoundingClientRect();
      const actorRect = actor.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const actorX =
        actorRect.left + actorRect.width / 2 - boardRect.left;
      const actorY =
        actorRect.top + actorRect.height / 2 - boardRect.top;
      const targetX =
        targetRect.left + targetRect.width / 2 - boardRect.left;
      const targetY =
        targetRect.top + targetRect.height / 2 - boardRect.top;
      const dx = targetX - actorX;
      const dy = targetY - actorY;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) {
        setGeometry(null);
        chargeVectorRef.current?.({ x: 0, y: 0 });
        return;
      }
      chargeVectorRef.current?.({ x: dx, y: dy });
      const startPadding = Math.min(44, distance * 0.2);
      const endPadding = Math.min(50, distance * 0.23);
      const unitX = dx / distance;
      const unitY = dy / distance;
      setGeometry({
        width: Math.max(1, boardRect.width),
        height: Math.max(1, boardRect.height),
        x1: actorX + unitX * startPadding,
        y1: actorY + unitY * startPadding,
        x2: targetX - unitX * endPadding,
        y2: targetY - unitY * endPadding,
      });
    };

    updateGeometry();
    const frame = window.requestAnimationFrame(updateGeometry);
    const resizeObserver = new ResizeObserver(updateGeometry);
    resizeObserver.observe(board);
    window.addEventListener("resize", updateGeometry);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateGeometry);
    };
  }, [actorInstanceId, eventIndex, targetInstanceId]);

  return (
    <svg
      ref={svgRef}
      className="combat-attack-link"
      data-testid="combat-attack-link"
      data-actor-instance-id={actorInstanceId}
      data-target-instance-id={targetInstanceId}
      viewBox={
        geometry
          ? `0 0 ${geometry.width} ${geometry.height}`
          : undefined
      }
      aria-hidden="true"
    >
      {geometry && (
        <>
          <defs>
            <marker
              id="combat-attack-arrowhead"
              markerWidth="15"
              markerHeight="15"
              refX="11"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
              viewBox="0 0 12 10"
            >
              <path d="M 0 0 L 12 5 L 0 10 z" />
            </marker>
          </defs>
          <path
            className="combat-attack-link-glow"
            d={`M ${geometry.x1} ${geometry.y1} L ${geometry.x2} ${geometry.y2}`}
          />
          <path
            className="combat-attack-link-path"
            d={`M ${geometry.x1} ${geometry.y1} L ${geometry.x2} ${geometry.y2}`}
            markerEnd="url(#combat-attack-arrowhead)"
          />
        </>
      )}
    </svg>
  );
}

function BoardRow({
  units,
  side,
  selection,
  canDeploy,
  dragSession,
  actorInstanceId,
  targetInstanceId,
  attackingInstanceId,
  hitInstanceId,
  hitLabel,
  shieldBrokenInstanceId,
  deadInstanceId,
  startOfCombatInstanceId,
  avengeInstanceId,
  triggerInstanceId,
  triggerLabel,
  combatEventIndex,
  buffTargetInstanceId,
  buffLabel,
  debuffTargetInstanceId,
  debuffLabel,
  summonedInstanceId,
  summonLabel,
  combatCharging,
  combatColliding,
  combatRebounding,
  combatChargeX = 0,
  combatChargeY = 0,
  choiceTargetIds,
  magneticTargetIds,
  magneticDropTargetId,
  bloodGemTargetIds,
  bloodGemDropTargetId,
  bloodGemCastFeedback,
  tavernSpellTargetIds,
  spellTargetKind,
  tavernSpellDropTargetId,
  tavernSpellCastFeedback,
  heroPowerTargetIds,
  getDragHandlers,
  getCardInspectionHandlers,
  onUnitClick,
  onChoiceTarget,
  onMagneticTarget,
  onBloodGemTarget,
  onTavernSpellTarget,
  onHeroPowerTarget,
  onEmptyClick,
  interactionLocked = false,
}: {
  units: readonly BoardMinionInstance[];
  side: "enemy" | "friendly";
  selection?: Selection;
  canDeploy?: boolean;
  dragSession?: DragSession | null;
  actorInstanceId?: string;
  targetInstanceId?: string;
  attackingInstanceId?: string;
  hitInstanceId?: string;
  hitLabel?: string;
  shieldBrokenInstanceId?: string;
  deadInstanceId?: string;
  startOfCombatInstanceId?: string;
  avengeInstanceId?: string;
  triggerInstanceId?: string;
  triggerLabel?: string;
  combatEventIndex?: number;
  buffTargetInstanceId?: string;
  buffLabel?: string;
  debuffTargetInstanceId?: string;
  debuffLabel?: string;
  summonedInstanceId?: string;
  summonLabel?: string;
  combatCharging?: boolean;
  combatColliding?: boolean;
  combatRebounding?: boolean;
  combatChargeX?: number;
  combatChargeY?: number;
  choiceTargetIds?: readonly string[];
  magneticTargetIds?: readonly string[];
  magneticDropTargetId?: string;
  bloodGemTargetIds?: readonly string[];
  bloodGemDropTargetId?: string;
  bloodGemCastFeedback?: BloodGemCastFeedback | null;
  tavernSpellTargetIds?: readonly string[];
  spellTargetKind?: "tavernSpell" | "spellcraft" | "generated";
  tavernSpellDropTargetId?: string;
  tavernSpellCastFeedback?: TavernSpellCastFeedback | null;
  heroPowerTargetIds?: readonly string[];
  getDragHandlers?: (
    source: DragSource,
    card: DraggableCard,
  ) => DragPointerHandlers;
  getCardInspectionHandlers?: (
    card: InspectableCard,
  ) => CardInspectionHandlers;
  onUnitClick?: (index: number) => void;
  onChoiceTarget?: (instanceId: string) => void;
  onMagneticTarget?: (instanceId: string) => void;
  onBloodGemTarget?: (instanceId: string) => void;
  onTavernSpellTarget?: (instanceId: string) => void;
  onHeroPowerTarget?: (instanceId: string) => void;
  onEmptyClick?: (index: number) => void;
  interactionLocked?: boolean;
}) {
  const boardDragPreview =
    side === "friendly" &&
    dragSession?.active === true &&
    dragSession.card.kind === "minion" &&
    (dragSession.zone === "hand" || dragSession.zone === "board")
    ? createBoardDragPreview({
        unitCount: units.length,
        boardLimit: BOARD_LIMIT,
        sourceZone: dragSession.zone,
        sourceIndex: dragSession.index,
        targetIndex:
          dragSession.target?.kind === "board"
            ? dragSession.target.index
            : null,
      })
    : null;
  const draggingHandWithOpenSlot =
    boardDragPreview !== null &&
    dragSession?.zone === "hand" &&
    units.length < BOARD_LIMIT;
  const slotCount =
    side === "enemy"
      ? units.length
      : boardDragPreview
        ? boardDragPreview.slotCount
        : canDeploy && units.length < BOARD_LIMIT
          ? units.length + 1
          : units.length;

  return (
    <div
      className={`board-row${side === "enemy" ? " enemy" : ""}${
        side === "friendly" && dragSession?.active ? " is-drag-active" : ""
      }${
        side === "friendly" && magneticTargetIds?.length
          ? " has-magnetic-targets"
          : ""
      }${
        side === "friendly" && bloodGemTargetIds?.length
          ? " has-blood-gem-targets"
          : ""
      }${
        side === "friendly" && tavernSpellTargetIds?.length
          ? " has-tavern-spell-targets"
          : ""
      }`}
      data-side={side}
      data-magnetic-ready={
        side === "friendly" && Boolean(magneticTargetIds?.length)
      }
      data-board-drop-zone={side === "friendly" ? "true" : undefined}
    >
      {Array.from({ length: slotCount }, (_, index) => {
        const unit = units[index];
        const previewSlot = boardDragPreview?.slots[index];
        const isChoiceTarget =
          unit !== undefined &&
          choiceTargetIds?.includes(unit.instanceId) === true;
        const isMagneticTarget =
          unit !== undefined &&
          magneticTargetIds?.includes(unit.instanceId) === true;
        const isMagneticDropTarget =
          isMagneticTarget &&
          magneticDropTargetId === unit?.instanceId;
        const isBloodGemTarget =
          unit !== undefined &&
          bloodGemTargetIds?.includes(unit.instanceId) === true;
        const isBloodGemDropTarget =
          isBloodGemTarget &&
          bloodGemDropTargetId === unit?.instanceId;
        const isBloodGemCast =
          bloodGemCastFeedback?.targetInstanceId === unit?.instanceId;
        const isTavernSpellTarget =
          unit !== undefined &&
          tavernSpellTargetIds?.includes(unit.instanceId) === true;
        const isTavernSpellDropTarget =
          isTavernSpellTarget &&
          tavernSpellDropTargetId === unit?.instanceId;
        const isTavernSpellCast =
          tavernSpellCastFeedback?.targetInstanceId === unit?.instanceId;
        const isHeroPowerTarget =
          unit !== undefined &&
          heroPowerTargetIds?.includes(unit.instanceId) === true;
        const isValidDragTarget =
          side === "friendly" &&
          dragSession?.active === true &&
          (dragSession.zone === "hand"
            ? units.length < BOARD_LIMIT && index <= units.length
            : dragSession.zone === "board"
              ? index < units.length
              : false);
        const isDropTarget =
          isValidDragTarget && previewSlot?.isGap === true;
        const slotProps = {
          "data-board-slot-index":
            side === "friendly" ? index : undefined,
          "data-valid": isValidDragTarget || (unit === undefined && canDeploy),
          "data-target": isDropTarget,
          "data-preview-gap": previewSlot?.isGap || undefined,
        };
        if (unit) {
          return (
            <div className="slot" key={unit.instanceId} {...slotProps}>
              {draggingHandWithOpenSlot && (
                <span
                  className="board-insert-target"
                  aria-hidden="true"
                  data-board-insert-index={index}
                  data-target={isDropTarget}
                />
              )}
              <div
                className="board-card-motion"
                data-preview-shift={previewSlot?.shift ?? undefined}
                data-preview-source={previewSlot?.isSource || undefined}
              >
                <UnitCard
                  key={
                    combatEventIndex !== undefined &&
                    (unit.instanceId === attackingInstanceId ||
                      unit.instanceId === hitInstanceId ||
                      unit.instanceId === shieldBrokenInstanceId ||
                      unit.instanceId === deadInstanceId ||
                      unit.instanceId === startOfCombatInstanceId ||
                      unit.instanceId === avengeInstanceId ||
                      unit.instanceId === triggerInstanceId ||
                      unit.instanceId === buffTargetInstanceId ||
                      unit.instanceId === debuffTargetInstanceId ||
                      unit.instanceId === summonedInstanceId)
                      ? `${unit.instanceId}-combat-${combatEventIndex}`
                      : unit.instanceId
                  }
                  unit={unit}
                  compact
                  selected={
                    side === "friendly" &&
                    selection?.zone === "board" &&
                    selection.index === index
                  }
                  testId={`${side}-unit-${index}`}
                  dragEnabled={
                    side === "friendly" &&
                    getDragHandlers !== undefined
                  }
                  dragging={
                    dragSession?.active === true &&
                    dragSession.card.instanceId === unit.instanceId
                  }
                  combatActor={unit.instanceId === actorInstanceId}
                  combatTarget={unit.instanceId === targetInstanceId}
                  combatAttacking={
                    unit.instanceId === attackingInstanceId
                  }
                  combatHit={unit.instanceId === hitInstanceId}
                  combatDamageLabel={
                    unit.instanceId === hitInstanceId
                      ? hitLabel
                      : undefined
                  }
                  combatShieldBreaking={
                    unit.instanceId === shieldBrokenInstanceId
                  }
                  combatDead={unit.instanceId === deadInstanceId}
                  combatStartOfCombat={
                    unit.instanceId === startOfCombatInstanceId
                  }
                  combatAvenge={
                    unit.instanceId === avengeInstanceId
                  }
                  combatTrigger={
                    unit.instanceId === triggerInstanceId
                  }
                  combatTriggerLabel={
                    unit.instanceId === triggerInstanceId
                      ? triggerLabel
                      : undefined
                  }
                  combatBuffTarget={
                    unit.instanceId === buffTargetInstanceId
                  }
                  combatBuffLabel={
                    unit.instanceId === buffTargetInstanceId
                      ? buffLabel
                      : undefined
                  }
                  combatDebuffTarget={
                    unit.instanceId === debuffTargetInstanceId
                  }
                  combatDebuffLabel={
                    unit.instanceId === debuffTargetInstanceId
                      ? debuffLabel
                      : undefined
                  }
                  combatSummoned={
                    unit.instanceId === summonedInstanceId
                  }
                  combatSummonLabel={
                    unit.instanceId === summonedInstanceId
                      ? summonLabel
                      : undefined
                  }
                  combatCharging={
                    combatCharging &&
                    unit.instanceId === actorInstanceId
                  }
                  combatColliding={
                    combatColliding &&
                    unit.instanceId === targetInstanceId
                  }
                  combatRebounding={
                    combatRebounding &&
                    unit.instanceId === actorInstanceId
                  }
                  combatChargeX={
                    unit.instanceId === actorInstanceId
                      ? combatChargeX
                      : 0
                  }
                  combatChargeY={
                    unit.instanceId === actorInstanceId
                      ? combatChargeY
                      : 0
                  }
                  choiceTarget={isChoiceTarget}
                  magneticTarget={isMagneticTarget}
                  magneticDropTarget={isMagneticDropTarget}
                  bloodGemTarget={isBloodGemTarget}
                  bloodGemDropTarget={isBloodGemDropTarget}
                  bloodGemCast={isBloodGemCast}
                  bloodGemCastLabel={
                    isBloodGemCast && bloodGemCastFeedback
                      ? `+${bloodGemCastFeedback.attack}/+${bloodGemCastFeedback.health}${
                          bloodGemCastFeedback.bonusKeyword
                            ? ` · ${bloodGemCastFeedback.bonusKeyword}`
                            : ""
                        }`
                      : undefined
                  }
                  bloodGemCastToken={
                    isBloodGemCast
                      ? bloodGemCastFeedback?.token
                      : undefined
                  }
                  tavernSpellTarget={isTavernSpellTarget}
                  spellTargetKind={
                    isTavernSpellTarget ? spellTargetKind : undefined
                  }
                  tavernSpellDropTarget={isTavernSpellDropTarget}
                  tavernSpellCast={isTavernSpellCast}
                  tavernSpellCastLabel={
                    isTavernSpellCast
                      ? tavernSpellCastFeedback?.label
                      : undefined
                  }
                  tavernSpellCastToken={
                    isTavernSpellCast
                      ? tavernSpellCastFeedback?.token
                      : undefined
                  }
                  heroPowerTarget={
                    heroPowerTargetIds?.includes(unit.instanceId)
                  }
                  disabled={interactionLocked && !isChoiceTarget}
                  dragHandlers={
                    side === "friendly" && getDragHandlers
                      ? getDragHandlers(
                          { zone: "board", index },
                          unit,
                        )
                      : undefined
                  }
                  inspectionHandlers={getCardInspectionHandlers?.(unit)}
                  onClick={
                    isChoiceTarget && onChoiceTarget
                      ? () => onChoiceTarget(unit.instanceId)
                      : isTavernSpellTarget && onTavernSpellTarget
                        ? () => onTavernSpellTarget(unit.instanceId)
                      : isBloodGemTarget && onBloodGemTarget
                        ? () => onBloodGemTarget(unit.instanceId)
                      : isMagneticTarget && onMagneticTarget
                        ? () => onMagneticTarget(unit.instanceId)
                      : isHeroPowerTarget && onHeroPowerTarget
                        ? () => onHeroPowerTarget(unit.instanceId)
                      : onUnitClick
                        ? () => onUnitClick(index)
                        : undefined
                  }
                  onKeyDown={
                    (isTavernSpellTarget && onTavernSpellTarget) ||
                    (isBloodGemTarget && onBloodGemTarget) ||
                    (isMagneticTarget && onMagneticTarget)
                      ? (event) => {
                          if (
                            event.key !== "Enter" &&
                            event.key !== " "
                          ) {
                            return;
                          }
                          event.preventDefault();
                          if (
                            isTavernSpellTarget &&
                            onTavernSpellTarget
                          ) {
                            onTavernSpellTarget(unit.instanceId);
                          } else if (isBloodGemTarget && onBloodGemTarget) {
                            onBloodGemTarget(unit.instanceId);
                          } else {
                            onMagneticTarget?.(unit.instanceId);
                          }
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          );
        }
        return (
          <button
            type="button"
            className="slot"
            aria-label={
              canDeploy ? `部署到第 ${index + 1} 个位置` : "空阵位"
            }
            key={`${side}-empty-${index}`}
            {...slotProps}
            onClick={
              canDeploy && onEmptyClick
                ? () => onEmptyClick(index)
                : undefined
            }
            disabled={!canDeploy}
          >
            {draggingHandWithOpenSlot && (
              <span
                className="board-insert-target"
                aria-hidden="true"
                data-board-insert-index={index}
                data-target={isDropTarget}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlayerRow({
  player,
  humanId,
  opponentId,
  opponentLabel = "本轮对手",
  opponentIsGhost = false,
  rank,
  selected,
  observedBoardCount,
  observedRound,
  displayHealth,
  displayArmor,
  displayAlive,
  takingHeroDamage = false,
  disabled = false,
  onSelect,
}: {
  player: PlayerState;
  humanId: string;
  opponentId?: string;
  opponentLabel?: string;
  opponentIsGhost?: boolean;
  rank: number;
  selected: boolean;
  observedBoardCount?: number;
  observedRound?: number;
  displayHealth?: number;
  displayArmor?: number;
  displayAlive?: boolean;
  takingHeroDamage?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const renderedHealth = Math.max(
    0,
    displayHealth ?? player.health,
  );
  const renderedArmor = Math.max(0, displayArmor ?? player.armor);
  const renderedAlive = displayAlive ?? player.alive;
  const aiStrategy = player.isHuman
    ? null
    : getAiStrategyProfile(player.id);

  return (
    <button
      type="button"
      className={`player-row${player.id === humanId ? " is-player" : ""}${
        !renderedAlive ? " is-dead" : ""
      }${player.id === opponentId ? " is-opponent" : ""}${
        takingHeroDamage ? " is-taking-hero-damage" : ""
      }${selected ? " is-selected" : ""}`}
      aria-current={player.id === humanId ? "true" : undefined}
      aria-pressed={selected}
      aria-label={`查看${player.name}的侦察信息${
        !renderedAlive ? "，已淘汰" : ""
      }${
        player.id === opponentId ? `，${opponentLabel}` : ""
      }`}
      disabled={disabled}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onSelect();
      }}
      data-rank={
        renderedAlive ? rank : (player.placement ?? rank)
      }
      data-player={player.id === humanId ? "human" : "ai"}
      data-eliminated={!renderedAlive}
      data-opponent={player.id === opponentId}
      data-displayed-health={renderedHealth}
      data-displayed-armor={renderedArmor}
      data-testid={`standing-${player.id}`}
    >
      <span className="player-meta">
        <strong>{player.name}</strong>
        <small>
          {player.id === opponentId
            ? `${opponentLabel}${
                opponentIsGhost ? "（幽灵）" : ""
              } · ${aiStrategy?.label ?? "AI"}`
            : renderedAlive
              ? player.isHuman
                ? `你的战队 · ${player.board.length} 随从 · ${player.tavernTier}星`
                : `${aiStrategy?.label ?? "AI"} · ${
                    observedBoardCount === undefined
                      ? "阵容未知"
                      : `第 ${observedRound} 回合见到 ${observedBoardCount} 随从`
                  } · ${player.tavernTier}星`
              : `第 ${player.placement ?? rank} 名`}
        </small>
      </span>
      <span className="player-survivability">
        {!renderedAlive ? (
          <span className="player-eliminated-mark">
            <span aria-hidden="true">☠</span> 已淘汰
          </span>
        ) : (
          <>
            {renderedArmor > 0 && (
              <span className="player-armor">护甲 {renderedArmor}</span>
            )}
            <span className="player-health">生命 {renderedHealth}</span>
          </>
        )}
      </span>
    </button>
  );
}

function InitialHealthControl({
  value,
  onChange,
  onConfirm,
  inputTestId,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  inputTestId: string;
  autoFocus?: boolean;
}) {
  const parsedHealth = parseInitialHealthInput(value);
  const inputId = `${inputTestId}-field`;
  const descriptionId = `${inputTestId}-description`;
  const adjustHealth = (amount: number) => {
    const current = parsedHealth ?? DEFAULT_INITIAL_HEALTH;
    onChange(String(normalizeInitialHealth(current + amount)));
  };

  return (
    <div
      className={`initial-health-setting${
        parsedHealth === null ? " is-invalid" : ""
      }`}
    >
      <label htmlFor={inputId}>
        <span>所有玩家基础生命值</span>
        <small>你和 7 位 AI 使用同一基础值；英雄技能会另行结算</small>
      </label>
      <div className="initial-health-control">
        <button
          type="button"
          className="initial-health-step"
          aria-label="减少一点初始生命值"
          disabled={parsedHealth === MIN_INITIAL_HEALTH}
          onClick={() => adjustHealth(-1)}
        >
          −
        </button>
        <div className="initial-health-input-shell">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={MIN_INITIAL_HEALTH}
            max={MAX_INITIAL_HEALTH}
            step={1}
            value={value}
            autoFocus={autoFocus}
            aria-invalid={parsedHealth === null}
            aria-describedby={descriptionId}
            data-testid={inputTestId}
            onChange={(event) => onChange(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter" && parsedHealth !== null) {
                event.preventDefault();
                onConfirm();
              }
            }}
          />
          <span>生命</span>
        </div>
        <button
          type="button"
          className="initial-health-step"
          aria-label="增加一点初始生命值"
          disabled={parsedHealth === MAX_INITIAL_HEALTH}
          onClick={() => adjustHealth(1)}
        >
          +
        </button>
      </div>
      <span
        id={descriptionId}
        className="initial-health-description"
        role={parsedHealth === null ? "alert" : "status"}
      >
        {parsedHealth === null
          ? `请输入 ${MIN_INITIAL_HEALTH} 到 ${MAX_INITIAL_HEALTH} 的整数。`
          : `本局 8 名玩家的基础生命值均为 ${parsedHealth} 点。`}
      </span>
    </div>
  );
}

export default function GameClient() {
  const [game, setGame] = useState<GameState>(() => createGame(INITIAL_SEED));
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [initialHealthInput, setInitialHealthInput] = useState(
    String(DEFAULT_INITIAL_HEALTH),
  );
  const [selection, setSelection] = useState<Selection>(null);
  const [infoTab, setInfoTab] = useState<InfoTab>("details");
  const [selectedStandingPlayerId, setSelectedStandingPlayerId] =
    useState<string | null>(null);
  const [showRestart, setShowRestart] = useState(false);
  const [showLobbyOverview, setShowLobbyOverview] = useState(false);
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [cardInspection, setCardInspection] =
    useState<CardInspectionState | null>(null);
  const [magneticAnnouncement, setMagneticAnnouncement] = useState("");
  const [tavernSpellCastFeedback, setTavernSpellCastFeedback] =
    useState<TavernSpellCastFeedback | null>(null);
  const [recruitPresentationQueue, setRecruitPresentationQueue] =
    useState<RecruitPresentationBatch[]>([]);
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeed>(1);
  const [combatRewardNotice, setCombatRewardNotice] =
    useState<CombatRewardSummary | null>(null);
  const [newCombatRewardIds, setNewCombatRewardIds] = useState<string[]>(
    [],
  );
  const [battlePlayback, setBattlePlayback] =
    useState<BattlePlaybackState>({
      battleKey: null,
      revealedCount: 0,
      complete: false,
    });
  const [combatIntroCompletedBattleKey, setCombatIntroCompletedBattleKey] =
    useState<string | null>(null);
  const gameRef = useRef(game);
  const recruitPresentationTokenRef = useRef(0);
  const dragSessionRef = useRef<DragSession | null>(null);
  const cardInspectionRef = useRef<CardInspectionState | null>(null);
  const cardInspectionTimerRef = useRef<number | null>(null);
  const pendingInspectionCardIdRef = useRef<string | null>(null);
  const touchInspectionGestureRef =
    useRef<TouchInspectionGesture | null>(null);
  const suppressLongPressClickRef = useRef<string | null>(null);
  const pointerInitiatedFocusRef = useRef(false);
  const dragCaptureElementRef = useRef<HTMLButtonElement | null>(null);
  const suppressCardClickRef = useRef(false);
  const battlePlaybackTimerRef = useRef<number | null>(null);
  const combatIntroTimerRef = useRef<number | null>(null);
  const tavernSpellCastTimerRef = useRef<number | null>(null);
  const interactionReturnFocusRef = useRef<HTMLElement | null>(null);
  const restartReturnFocusRef = useRef<HTMLElement | null>(null);
  const lobbyOverviewReturnFocusRef = useRef<HTMLElement | null>(null);
  const previousInteractionIdRef = useRef<string | null>(null);
  const magneticFocusTargetRef = useRef<string | null>(null);
  const previousMagneticSelectionRef = useRef<string | null>(null);
  const preCombatHandIdsRef = useRef<Set<string> | null>(null);
  const activeRecruitPresentation =
    recruitPresentationQueue[0] ?? null;
  const activeRecruitBloodGemPulse =
    activeRecruitPresentation?.events.find(
      (event) => event.kind === "bloodGemPulse",
    );
  const queuedRecruitBloodGemPulse = recruitPresentationQueue
    .flatMap((presentation) => presentation.events)
    .find((event) => event.kind === "bloodGemPulse");

  useLayoutEffect(() => {
    gameRef.current = game;
  }, [game]);

  const writeDragSession = useCallback((next: DragSession | null) => {
    dragSessionRef.current = next;
    setDragSession(next);
  }, []);

  const writeCardInspection = useCallback(
    (next: CardInspectionState | null) => {
      cardInspectionRef.current = next;
      setCardInspection(next);
    },
    [],
  );

  const cardInspectionLayout = useMemo(() => {
    if (!cardInspection) return null;
    const width = Math.max(1, Math.min(290, window.innerWidth - 24));
    const height = Math.max(
      1,
      Math.min(430, window.innerHeight - 24),
    );
    return {
      width,
      height,
      ...placeCardInspection({
        anchor: cardInspection.anchor,
        previewWidth: width,
        previewHeight: height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }),
    };
  }, [cardInspection]);

  const liftedDragPreview = useMemo(() => {
    if (!dragSession?.active) {
      return null;
    }
    return createLiftedCardDragPreview({
      clientX: dragSession.clientX,
      clientY: dragSession.clientY,
      offsetX: dragSession.offsetX,
      offsetY: dragSession.offsetY,
      sourceWidth: dragSession.width,
      sourceHeight: dragSession.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      pointerType: dragSession.pointerType,
    });
  }, [dragSession]);

  const clearBattlePlaybackTimer = useCallback(() => {
    if (battlePlaybackTimerRef.current === null) return;
    window.clearTimeout(battlePlaybackTimerRef.current);
    battlePlaybackTimerRef.current = null;
  }, []);

  const clearCombatIntroTimer = useCallback(() => {
    if (combatIntroTimerRef.current === null) return;
    window.clearTimeout(combatIntroTimerRef.current);
    combatIntroTimerRef.current = null;
  }, []);

  const clearCardInspectionTimer = useCallback(() => {
    if (cardInspectionTimerRef.current !== null) {
      window.clearTimeout(cardInspectionTimerRef.current);
      cardInspectionTimerRef.current = null;
    }
    pendingInspectionCardIdRef.current = null;
  }, []);

  const dismissCardInspection = useCallback(() => {
    clearCardInspectionTimer();
    touchInspectionGestureRef.current = null;
    writeCardInspection(null);
  }, [clearCardInspectionTimer, writeCardInspection]);

  const clearTavernSpellCastFeedback = useCallback(() => {
    if (tavernSpellCastTimerRef.current !== null) {
      window.clearTimeout(tavernSpellCastTimerRef.current);
      tavernSpellCastTimerRef.current = null;
    }
    setTavernSpellCastFeedback(null);
  }, []);

  const clearCombatRewardFeedback = useCallback(() => {
    setCombatRewardNotice(null);
    setNewCombatRewardIds([]);
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const restoreGame = (saved: GameState) => {
          setGame(saved);
          setStarted(true);
          setInitialHealthInput(String(saved.initialHealth));
          safeWriteLocalStorage(SAVE_KEY, JSON.stringify(saved));

          const resumedPlayback =
            saved.phase === "combat" && saved.lastBattle
              ? resumeCombatPlayback(
                  saved.lastBattle,
                  saved.lastBattle.events.filter(isCombatPlaybackEvent)
                    .length,
                  readCombatPlaybackSession(),
                )
              : null;
          if (resumedPlayback) {
            setBattlePlayback(resumedPlayback);
            setCombatIntroCompletedBattleKey(
              resumedPlayback.battleKey,
            );
          } else {
            safeRemoveSessionStorage(COMBAT_PLAYBACK_SESSION_KEY);
          }
        };

        const raw = safeReadLocalStorage(SAVE_KEY);
        let restored = false;
        if (raw) {
          try {
            const saved = normalizePersistedGameState(JSON.parse(raw));
            if (isGameState(saved)) {
              restoreGame(saved);
              restored = true;
            } else {
              safeRemoveLocalStorage(SAVE_KEY);
            }
          } catch {
            safeRemoveLocalStorage(SAVE_KEY);
          }
        }
        if (!restored) {
          for (const legacyKey of LEGACY_SAVE_KEYS) {
            const legacyRaw = safeReadLocalStorage(legacyKey);
            if (!legacyRaw) {
              continue;
            }
            if (legacyRaw) {
              try {
                const migrated = normalizePersistedGameState(
                  JSON.parse(legacyRaw) as unknown,
                );
                if (isGameState(migrated)) {
                  restoreGame(migrated);
                  restored = true;
                }
                safeRemoveLocalStorage(legacyKey);
                if (restored) {
                  break;
                }
              } catch {
                safeRemoveLocalStorage(legacyKey);
              }
            }
          }
        }
      } catch {
        safeRemoveLocalStorage(SAVE_KEY);
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!loaded || !started) return;
    safeWriteLocalStorage(SAVE_KEY, JSON.stringify(game));
  }, [game, loaded, started]);

  useEffect(() => {
    if (battlePlayback.battleKey === null) return;
    safeWriteSessionStorage(
      COMBAT_PLAYBACK_SESSION_KEY,
      JSON.stringify(battlePlayback),
    );
  }, [battlePlayback]);

  useEffect(() => {
    if (!loaded || game.phase === "combat") return;
    safeRemoveSessionStorage(COMBAT_PLAYBACK_SESSION_KEY);
  }, [game.phase, loaded]);

  useEffect(() => {
    if (!combatRewardNotice) return;
    const noticeTimer = window.setTimeout(
      clearCombatRewardFeedback,
      5200,
    );
    return () => window.clearTimeout(noticeTimer);
  }, [clearCombatRewardFeedback, combatRewardNotice]);

  useEffect(() => {
    if (!activeRecruitPresentation) return;
    const activeToken = activeRecruitPresentation.token;
    const presentationTimer = window.setTimeout(() => {
      setRecruitPresentationQueue((current) =>
        completeRecruitPresentation(current, activeToken),
      );
    }, recruitPresentationDuration(activeRecruitPresentation.events));
    return () => window.clearTimeout(presentationTimer);
  }, [activeRecruitPresentation]);

  const send = useCallback(
    (action: GameAction) => {
      const current = gameRef.current;
      const motion = captureRecruitMotion(current, action);
      dismissCardInspection();
      const transition = gameTransition(current, action);
      const next = transition.state;
      const events = deriveRecruitPresentation(
        current,
        next,
        action,
        transition.trace,
      );
      gameRef.current = next;
      if (action.type === "END_TURN" || action.type === "CONTINUE") {
        setRecruitPresentationQueue([]);
      } else if (events.length > 0) {
        const eventGroups = events.every(
          (event) => event.kind === "bloodGemPulse",
        )
          ? events.map((event) => [event])
          : [events];
        const presentations = eventGroups.map((group, index) => {
          recruitPresentationTokenRef.current += 1;
          return {
            token: recruitPresentationTokenRef.current,
            events: group,
            announcement: recruitPresentationAnnouncement(group),
            motion: index === 0 ? motion : null,
          };
        });
        setRecruitPresentationQueue((current) => [
          ...current,
          ...presentations,
        ]);
      }
      if (started) {
        safeWriteLocalStorage(SAVE_KEY, JSON.stringify(next));
      }
      setGame(next);
      setSelection(null);
    },
    [dismissCardInspection, started],
  );

  const human = useMemo(
    () =>
      game.players.find((player) => player.id === game.humanPlayerId) ??
      game.players[0],
    [game],
  );
  const humanHero = human.heroId
    ? getHeroDefinition(human.heroId)
    : null;
  const humanHeroPower = human.heroPowerId
    ? getHeroPowerDefinition(human.heroPowerId)
    : null;
  const humanHeroPowerProgress = human.heroPowerId
    ? getHeroPowerProgressText(
        human.heroPowerId,
        human.heroPowerCounters,
        game.round,
      )
    : null;
  const humanHeroPowerStatus = humanHeroPower
    ? `${humanHeroPower.description}${
        humanHeroPowerProgress ? ` · ${humanHeroPowerProgress}` : ""
      }`
    : null;
  const humanHeroPowerActive =
    humanHeroPower !== null &&
    heroPowerCanBeManuallyActivated(humanHeroPower.id);
  const humanHeroPowerUsedThisTurn =
    human.heroPowerActiveThisTurn === true;
  const systemEvent = game.systemEventId
    ? getSystemEventDefinition(game.systemEventId)
    : null;
  const humanTrinkets = human.trinketIds.map(getTrinketDefinition);
  const humanTrinketDescription = (
    definition: (typeof humanTrinkets)[number],
  ) => {
    const progress = getTrinketProgressText(human, definition.id);
    return `${definition.description}${
      progress ? ` · 当前：${progress}` : ""
    }`;
  };
  const lobbyOverviewSummary = [
    systemEvent
      ? `系统事件 ${systemEvent.name}：${systemEvent.description}`
      : "无系统事件",
    humanHeroPower
      ? `英雄技能 ${humanHeroPower.name}：${
          humanHeroPowerStatus ?? humanHeroPower.description
        }`
      : "无英雄技能",
    humanTrinkets.length > 0
      ? `已选符文：${humanTrinkets
          .map(
            (definition) =>
              `${definition.name}：${humanTrinketDescription(definition)}`,
          )
          .join("；")}`
      : `尚未选择符文，首次将在第 ${LESSER_TRINKET_ROUND} 回合开启`,
  ].join("；");
  const hasLesserTrinket = humanTrinkets.some(
    (definition) => definition.tier === "lesser",
  );
  const hasGreaterTrinket = humanTrinkets.some(
    (definition) => definition.tier === "greater",
  );
  const nextTrinketRound = !hasLesserTrinket
    ? LESSER_TRINKET_ROUND
    : !hasGreaterTrinket
      ? GREATER_TRINKET_ROUND
      : null;
  const tavernSpellShopOffers = useMemo(
    () => [
      ...(human.spellShop ? [human.spellShop] : []),
      ...human.additionalSpellShop,
    ],
    [human.additionalSpellShop, human.spellShop],
  );
  const shopDisplayOffers = useMemo<ShopDisplayOffer[]>(() => {
    const minionOffers = human.shop.map((unit, shopIndex) => ({
      kind: "minion" as const,
      unit,
      shopIndex,
    }));
    const offers: ShopDisplayOffer[] = [...minionOffers];
    tavernSpellShopOffers.forEach((spell, spellIndex) => {
      const spellPosition =
        [...spell.instanceId].reduce(
          (hash, character) =>
            (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0,
          5381,
        ) %
        (offers.length + 1);
      offers.splice(spellPosition, 0, {
        kind: "tavernSpell",
        spell,
        spellIndex,
      });
    });
    return offers;
  }, [human.shop, tavernSpellShopOffers]);
  const humanInteraction =
    game.pendingInteraction?.playerId === human.id
      ? game.pendingInteraction
      : null;
  const heroChoiceInteraction =
    humanInteraction?.kind === "heroChoice" ? humanInteraction : null;
  const trinketChoiceInteraction =
    humanInteraction?.kind === "trinketChoice"
      ? humanInteraction
      : null;
  const isMysteryCubeTrinketChoice =
    trinketChoiceInteraction?.replaceTrinketId !== undefined &&
    isTrinketDefinitionId(trinketChoiceInteraction.replaceTrinketId) &&
    isMysteryCubeTrinketSlotId(
      trinketChoiceInteraction.replaceTrinketId,
    );
  const targetInteraction =
    humanInteraction?.kind === "target" ? humanInteraction : null;
  const taughtTavernSpellTargetResolution =
    targetInteraction?.resolution?.kind === "castTaughtTavernSpell"
      ? targetInteraction.resolution
      : null;
  const taughtTavernSpellTargetInteraction =
    taughtTavernSpellTargetResolution ? targetInteraction : null;
  const taughtTavernSpellDefinition = taughtTavernSpellTargetResolution
    ? getTavernSpellDefinition(
        taughtTavernSpellTargetResolution.definitionId,
      )
    : null;
  const magnetizeTargetInteraction =
    humanInteraction?.kind === "magnetizeTarget"
      ? humanInteraction
      : null;
  const boardChoiceInteraction =
    magnetizeTargetInteraction ?? targetInteraction;
  const discoverInteraction =
    humanInteraction?.kind === "discover" ? humanInteraction : null;
  const tavernSpellDiscoverInteraction =
    humanInteraction?.kind === "tavernSpellDiscover"
      ? humanInteraction
      : null;
  const darkmoonPrizeDiscoverInteraction =
    humanInteraction?.kind === "darkmoonPrizeDiscover"
      ? humanInteraction
      : null;
  const tavernSpellChoiceInteraction =
    humanInteraction?.kind === "tavernSpellChoice"
      ? humanInteraction
      : null;
  const spellcraftChoiceInteraction =
    humanInteraction?.kind === "spellcraftChoice"
      ? humanInteraction
      : null;
  const escapeEruptionAmount =
    4 * (spellcraftChoiceInteraction?.effectMultiplier ?? 1);
  const heroPowerChoiceInteraction =
    humanInteraction?.kind === "heroPowerChoice"
      ? humanInteraction
      : null;
  const minionChoiceInteraction =
    humanInteraction?.kind === "minionChoice"
      ? humanInteraction
      : null;
  const isBuddingBotanistChoice =
    minionChoiceInteraction?.definitionId === "BG32_237";
  const isAdaptableBeetleChoice =
    minionChoiceInteraction?.definitionId === "BG27_084";
  const interactionLocked =
    game.pendingInteraction !== null ||
    queuedRecruitBloodGemPulse?.kind === "bloodGemPulse";
  const humanHeroPowerCanActivate =
    humanHeroPowerActive &&
    !humanHeroPowerUsedThisTurn &&
    !interactionLocked &&
    game.phase === "recruit";
  const humanHeroPowerCost =
    humanHeroPower ? heroPowerActiveCost(humanHeroPower.effect) : 99;
  const humanHeroPowerAffordable =
    humanHeroPowerCost <= human.gold;
  const humanHeroPowerTargetMode =
    humanHeroPower ? heroPowerNeedsTarget(humanHeroPower.effect) : null;
  const [heroPowerTargeting, setHeroPowerTargeting] = useState(false);
  const heroPowerTargetValidIds = useMemo(() => {
    if (
      !heroPowerTargeting ||
      !humanHeroPowerTargetMode ||
      !humanHeroPower
    ) {
      return new Set<string>();
    }
    if (humanHeroPowerTargetMode === "shop") {
      return new Set(human.shop.map((m) => m.instanceId));
    }
    return new Set(human.board.map((m) => m.instanceId));
  }, [heroPowerTargeting, humanHeroPowerTargetMode, humanHeroPower, human.shop, human.board]);

  const doActivateHeroPower = useCallback(
    (targetInstanceId?: string) => {
      if (!humanHeroPowerCanActivate || !humanHeroPowerAffordable) return;
      if (humanHeroPowerTargetMode && !targetInstanceId) {
        setHeroPowerTargeting(true);
        return;
      }
      setHeroPowerTargeting(false);
      send({ type: "ACTIVATE_HERO_POWER", targetInstanceId });
    },
    [
      humanHeroPowerCanActivate,
      humanHeroPowerAffordable,
      humanHeroPowerTargetMode,
      send,
    ],
  );

  useEffect(() => {
    if (!heroPowerTargeting) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setHeroPowerTargeting(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [heroPowerTargeting]);

  const onHeroPowerTargetClick = useCallback(
    (instanceId: string) => {
      if (!heroPowerTargeting) return;
      doActivateHeroPower(instanceId);
    },
    [heroPowerTargeting, doActivateHeroPower],
  );
  const modalInteractionLocked = interactionRequiresModalBackdrop(
    game.pendingInteraction,
  );

  useEffect(() => {
    if (humanInteraction) {
      if (previousInteractionIdRef.current === null) {
        const activeElement = document.activeElement;
        interactionReturnFocusRef.current =
          activeElement instanceof HTMLElement &&
          activeElement !== document.body
            ? activeElement
            : null;
      }
      previousInteractionIdRef.current =
        humanInteraction.interactionId;
      const focusFrame = window.requestAnimationFrame(() => {
        const focusTarget =
          humanInteraction.kind === "heroChoice"
            ? document.querySelector<HTMLElement>(
                '[data-testid="hero-choice-0"]',
              )
            : humanInteraction.kind === "trinketChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="trinket-choice-dialog"] button:not(:disabled)',
                )
          : humanInteraction.kind === "discover"
            ? document.querySelector<HTMLElement>(
                '[data-testid="discover-option-0"]',
              )
            : humanInteraction.kind === "tavernSpellDiscover"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="tavern-spell-discover-option-0"]',
                )
            : humanInteraction.kind === "darkmoonPrizeDiscover"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="darkmoon-prize-discover-option-0"]',
                )
            : humanInteraction.kind === "tavernSpellChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="time-management-now"]',
                )
            : humanInteraction.kind === "spellcraftChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="escape-eruption-attack"]',
                )
            : humanInteraction.kind === "heroPowerChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="hero-power-choice-0"]',
                )
            : humanInteraction.kind === "minionChoice"
              ? document.querySelector<HTMLElement>(
                  humanInteraction.definitionId === "BG32_237"
                    ? '[data-testid="budding-botanist-attack"]'
                    : humanInteraction.definitionId === "BG27_084"
                      ? '[data-testid="adaptable-beetle-reborn"]'
                      : '[data-testid="fearless-foodie-improve"]',
                )
            : Array.from(
                document.querySelectorAll<HTMLElement>(
                  "[data-unit-instance-id]",
                ),
              ).find(
                (element) =>
                  element.dataset.unitInstanceId ===
                  humanInteraction.optionInstanceIds[0],
              );
        focusTarget?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    if (previousInteractionIdRef.current !== null) {
      previousInteractionIdRef.current = null;
      const returnTarget = interactionReturnFocusRef.current;
      interactionReturnFocusRef.current = null;
      const focusFrame = window.requestAnimationFrame(() => {
        if (
          returnTarget?.isConnected &&
          returnTarget !== document.body
        ) {
          returnTarget.focus();
          return;
        }
        document
          .querySelector<HTMLElement>('[data-testid="end-turn"]')
          ?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }
  }, [humanInteraction]);

  useEffect(() => {
    const targetInstanceId = magneticFocusTargetRef.current;
    if (!targetInstanceId) return;
    const focusFrame = window.requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-unit-instance-id]",
        ),
      ).find(
        (element) =>
          element.dataset.unitInstanceId === targetInstanceId,
      );
      if (target) {
        magneticFocusTargetRef.current = null;
        target.focus();
      }
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [game.players]);

  const trapModalFocus = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    },
    [],
  );

  const battle = game.lastBattle;
  const battleKey = battle ? combatPlaybackKey(battle) : null;
  const combatIntroActive =
    started &&
    game.phase === "combat" &&
    battleKey !== null &&
    combatIntroCompletedBattleKey !== battleKey;
  const pageModalOpen =
    (loaded && !started) ||
    showRestart ||
    showLobbyOverview ||
    game.phase === "gameOver";
  const introOpponent = battle
    ? combatIntroOpponent(battle, game.humanPlayerId)
    : null;
  const humanCombatRewards = useMemo(
    () => summarizeCombatRewards(battle?.events ?? [], human.id),
    [battle, human.id],
  );
  const humanCombatRewardOutcomeCount =
    humanCombatRewards.addedCount +
    humanCombatRewards.handFullCount +
    humanCombatRewards.noCandidateCount;
  const opponentId = battle
    ? battle.playerAId === game.humanPlayerId
      ? battle.playerBId
      : battle.playerAId
    : human.lastOpponentId;
  const opponent = game.players.find((player) => player.id === opponentId);
  const scheduledHumanOpponent =
    game.phase === "recruit"
      ? getScheduledOpponent(game, game.humanPlayerId)
      : null;
  const highlightedOpponentId =
    game.phase === "recruit"
      ? scheduledHumanOpponent?.opponentId
      : game.phase === "combat"
        ? opponentId
        : undefined;
  const opponentInitialBoard =
    battle && opponentId
      ? (battle.initialBoards[opponentId] ?? []).filter(
          isBoardMinionInstance,
        )
      : [];
  const playbackEvents = useMemo(
    () => battle?.events.filter(isCombatPlaybackEvent) ?? [],
    [battle],
  );
  const playbackEventCount = playbackEvents.length;
  const playbackIsCurrent =
    game.phase === "combat" &&
    battleKey !== null &&
    battlePlayback.battleKey === battleKey;
  const revealedBattleEventCount =
    game.phase === "combat" && battle
      ? combatIntroActive
        ? 0
        : playbackIsCurrent
        ? Math.min(battlePlayback.revealedCount, playbackEventCount)
        : playbackEventCount > 0
          ? 1
          : 0
      : 0;
  const battlePlaybackComplete =
    game.phase === "combat" && battle
      ? combatIntroActive
        ? false
        : playbackIsCurrent
        ? battlePlayback.complete
        : playbackEventCount === 0
      : false;
  const combatPresentationStage: CombatPresentationStage | null =
    game.phase === "combat" && battle
      ? combatIntroActive
        ? "intro"
        : battlePlaybackComplete
          ? "result"
          : "playback"
      : null;
  const currentBattleEvent =
    revealedBattleEventCount > 0
      ? playbackEvents[revealedBattleEventCount - 1]
      : undefined;
  const currentBattleEventDelay = battleEventDelay(
    currentBattleEvent,
    battleSpeed,
  );
  const revealedPlaybackEvents =
    battle && game.phase === "combat"
      ? playbackEvents.slice(0, revealedBattleEventCount)
      : [];
  const displayedHumanHealth =
    game.phase === "combat" && battle
      ? (projectCombatHealth({
          battle,
          playerId: human.id,
          revealedEvents: revealedPlaybackEvents,
          playbackComplete: battlePlaybackComplete,
        }) ?? Math.max(0, human.health))
      : Math.max(0, human.health);
  const displayedHumanArmor =
    game.phase === "combat" && battle
      ? (projectCombatArmor({
          battle,
          playerId: human.id,
          revealedEvents: revealedPlaybackEvents,
          playbackComplete: battlePlaybackComplete,
        }) ?? Math.max(0, human.armor))
      : Math.max(0, human.armor);
  const displayedOpponentHealth =
    game.phase === "combat" && battle && opponentId
      ? projectCombatHealth({
          battle,
          playerId: opponentId,
          revealedEvents: revealedPlaybackEvents,
          playbackComplete: battlePlaybackComplete,
        })
      : null;
  const displayedOpponentArmor =
    game.phase === "combat" && battle && opponentId
      ? projectCombatArmor({
          battle,
          playerId: opponentId,
          revealedEvents: revealedPlaybackEvents,
          playbackComplete: battlePlaybackComplete,
        })
      : null;
  const currentHeroDamageTargetId =
    !battlePlaybackComplete &&
    currentBattleEvent?.type === "heroDamage"
      ? currentBattleEvent.targetPlayerId
      : undefined;
  const projectedStandingHealth = (player: PlayerState) =>
    game.phase === "combat" && battle
      ? player.id === human.id
        ? displayedHumanHealth
        : player.id === opponentId
          ? (displayedOpponentHealth ?? player.health)
          : player.health
      : player.health;
  const projectedStandingArmor = (player: PlayerState) =>
    game.phase === "combat" && battle
      ? player.id === human.id
        ? displayedHumanArmor
        : player.id === opponentId
          ? (displayedOpponentArmor ?? player.armor)
          : player.armor
      : player.armor;
  const projectedStandingAlive = (player: PlayerState) =>
    game.phase === "combat" &&
    battle &&
    (player.id === human.id || player.id === opponentId)
      ? projectedStandingHealth(player) > 0
      : player.alive;
  const standings = [...game.players].sort((left, right) => {
    const leftAlive = projectedStandingAlive(left);
    const rightAlive = projectedStandingAlive(right);
    if (leftAlive !== rightAlive) return leftAlive ? -1 : 1;
    if (leftAlive) {
      return (
        projectedStandingHealth(right) -
          projectedStandingHealth(left) ||
        right.tavernTier - left.tavernTier ||
        left.id.localeCompare(right.id)
      );
    }
    return (
      (left.placement ?? 99) - (right.placement ?? 99) ||
      left.id.localeCompare(right.id)
    );
  });
  const displayedAlivePlayerCount = game.players.filter((player) => {
    if (
      game.phase !== "combat" ||
      !battle ||
      (player.id !== human.id && player.id !== opponentId)
    ) {
      return player.alive;
    }
    const displayedHealth =
      player.id === human.id
        ? displayedHumanHealth
        : (displayedOpponentHealth ?? player.health);
    return displayedHealth > 0;
  }).length;
  const opponentBoard =
    battle && opponentId
      ? projectCombatBoard(
          opponentInitialBoard,
          opponentId,
          revealedPlaybackEvents,
          { flushPendingDeaths: battlePlaybackComplete },
        )
      : opponentInitialBoard;
  const friendlyCombatBoard =
    game.phase === "combat" && battle
      ? projectCombatBoard(
          (battle.initialBoards[human.id] ?? human.board).filter(
            isBoardMinionInstance,
          ),
          human.id,
          revealedPlaybackEvents,
          { flushPendingDeaths: battlePlaybackComplete },
        )
      : activeRecruitBloodGemPulse?.kind === "bloodGemPulse"
        ? activeRecruitBloodGemPulse.boardAfterPulse
        : queuedRecruitBloodGemPulse?.kind === "bloodGemPulse"
          ? queuedRecruitBloodGemPulse.boardBeforePulse
          : human.board;
  const currentBuffLabel = combatBuffLabel(currentBattleEvent);
  const currentTriggerLabel = combatTriggerLabel(currentBattleEvent);
  const currentHitLabel =
    currentBattleEvent?.type === "damage"
      ? `-${currentBattleEvent.amount ?? 0} · 剩余 ${
          currentBattleEvent.minion
            ? Math.max(0, currentBattleEvent.minion.health)
            : "?"
        }`
      : currentBattleEvent?.type === "shieldBroken"
        ? "圣盾破裂"
        : undefined;
  const currentStrikeEvent =
    currentBattleEvent &&
    (currentBattleEvent.type === "attack" ||
      currentBattleEvent.type === "damage" ||
      currentBattleEvent.type === "shieldBroken") &&
    currentBattleEvent.actorInstanceId &&
    currentBattleEvent.targetInstanceId
      ? {
          index: currentBattleEvent.index,
          actorPlayerId: currentBattleEvent.actorPlayerId,
          actorInstanceId: currentBattleEvent.actorInstanceId,
          targetInstanceId: currentBattleEvent.targetInstanceId,
        }
      : undefined;
  const [combatChargePhase, setCombatChargePhase] = useState<
    "idle" | "charge" | "collide" | "rebound"
  >("idle");
  const [combatChargeVector, setCombatChargeVector] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const combatChargePhaseRef = useRef(combatChargePhase);
  combatChargePhaseRef.current = combatChargePhase;

  useEffect(() => {
    if (!currentBattleEvent || currentBattleEvent.type !== "attack") {
      return;
    }
    const chargeTimer = setTimeout(() => {
      setCombatChargePhase("charge");
      const collideTimer = setTimeout(() => {
        setCombatChargePhase("collide");
        const reboundTimer = setTimeout(() => {
          setCombatChargePhase("rebound");
          const clearTimer = setTimeout(() => {
            setCombatChargePhase("idle");
          }, 300);
          return () => clearTimeout(clearTimer);
        }, 380);
        return () => clearTimeout(reboundTimer);
      }, 540);
      return () => clearTimeout(collideTimer);
    }, 80);
    return () => clearTimeout(chargeTimer);
  }, [currentBattleEvent]);

  const currentDebuffLabel =
    currentBattleEvent?.type === "keywordRemoved" &&
    currentBattleEvent.removedKeywords?.length
      ? `移除 ${currentBattleEvent.removedKeywords
          .map((keyword) =>
            keyword === "reborn"
              ? "复生"
              : keyword === "taunt"
                ? "嘲讽"
                : "潜行",
          )
          .join(" · ")}`
      : undefined;
  const currentSummonLabel =
    currentBattleEvent?.type === "summon"
      ? currentBattleEvent.summonReason === "rallyFromHand" ||
        currentBattleEvent.summonReason === "startOfCombatFromHand" ||
        currentBattleEvent.summonReason === "inHandStartOfCombat"
        ? "仅本场"
        : currentBattleEvent.summonReason === "reborn"
          ? "复生"
          : "召唤"
      : undefined;
  const revealedBattleLogEvents = battle
    ? game.phase !== "combat" || battlePlaybackComplete
      ? battle.events
      : playbackEvents.slice(0, revealedBattleEventCount)
    : [];
  const selectedUnit = selectionUnit(selection, human);
  const selectedHandCard =
    selection?.zone === "hand"
      ? human.hand[selection.index]
      : undefined;
  const selectedBloodGem =
    selectedHandCard?.kind === "bloodGem" ? selectedHandCard : null;
  const selectedSpellcraft =
    selectedHandCard?.kind === "spellcraft"
      ? selectedHandCard
      : null;
  const selectedShopSpell =
    selection?.zone === "spellShop"
      ? (tavernSpellShopOffers[selection.index] ?? null)
      : null;
  const selectedHandTavernSpell =
    selectedHandCard?.kind === "tavernSpell" ? selectedHandCard : null;
  const selectedTavernSpell =
    selectedHandTavernSpell ?? selectedShopSpell;
  const selectedTavernSpellDefinition = selectedTavernSpell
    ? getTavernSpellDefinition(selectedTavernSpell.definitionId)
    : null;
  const selectedMagneticSource =
    !interactionLocked &&
    selectedHandCard?.kind === "minion" &&
    (selectedHandCard.playableFromRound ?? 0) <= game.round &&
    isMagneticMinion(selectedHandCard)
      ? selectedHandCard
      : null;
  const dragMagneticSource =
    dragSession?.active === true &&
    dragSession.zone === "hand" &&
    dragSession.card.kind === "minion" &&
    isMagneticMinion(dragSession.card)
      ? dragSession.card
      : null;
  const activeHandDragCard =
    dragSession?.active === true && dragSession.zone === "hand"
      ? dragSession.card
      : null;
  const magneticSourceForTargets =
    dragSession?.active === true
      ? dragMagneticSource
      : selectedMagneticSource;
  const magneticTargetIds = magneticSourceForTargets
    ? human.board
        .filter((target) =>
          canMagnetize(magneticSourceForTargets, target),
        )
        .map((target) => target.instanceId)
    : [];
  const bloodGemSourceForTargets =
    dragSession?.active === true
      ? activeHandDragCard?.kind === "bloodGem"
        ? activeHandDragCard
        : null
      : selectedBloodGem;
  const bloodGemTargetIds = bloodGemSourceForTargets
    ? human.board.map((target) => target.instanceId)
    : [];
  const tavernSpellSourceForTargets =
    dragSession?.active === true
      ? activeHandDragCard?.kind === "tavernSpell" &&
        tavernSpellNeedsTarget(activeHandDragCard)
        ? activeHandDragCard
        : null
      : selectedHandTavernSpell &&
          tavernSpellNeedsTarget(selectedHandTavernSpell)
        ? selectedHandTavernSpell
        : null;
  const tavernSpellTargetIds = useMemo(
    () =>
      tavernSpellSourceForTargets
        ? getLegalTavernSpellTargetIds(
            game,
            human.id,
            tavernSpellSourceForTargets,
          )
        : [],
    [game, human.id, tavernSpellSourceForTargets],
  );
  const spellcraftSourceForTargets =
    dragSession?.active === true
      ? activeHandDragCard?.kind === "spellcraft" &&
        spellcraftNeedsTarget(activeHandDragCard)
        ? activeHandDragCard
        : null
      : selectedSpellcraft && spellcraftNeedsTarget(selectedSpellcraft)
        ? selectedSpellcraft
        : null;
  const spellcraftTargetIds = useMemo(
    () =>
      spellcraftSourceForTargets
        ? getLegalSpellcraftTargetIds(
            game,
            human.id,
            spellcraftSourceForTargets,
          )
        : [],
    [game, human.id, spellcraftSourceForTargets],
  );
  const activeSpellTargetIds =
    spellcraftSourceForTargets !== null
      ? spellcraftTargetIds
      : tavernSpellTargetIds;
  const activeSpellTargetKind =
    spellcraftSourceForTargets !== null
      ? spellcraftSourceForTargets.spellFamily
      : tavernSpellSourceForTargets !== null
        ? "tavernSpell"
        : undefined;
  const selectedMagneticTargetIds = useMemo(
    () =>
      selectedMagneticSource
        ? human.board
            .filter((target) =>
              canMagnetize(selectedMagneticSource, target),
            )
            .map((target) => target.instanceId)
        : [],
    [human.board, selectedMagneticSource],
  );
  const boardHasOpenSlot = human.board.length < BOARD_LIMIT;
  const canDragHandCard = (card: DraggableCard) => {
    if (game.phase !== "recruit" || interactionLocked) {
      return false;
    }
    if (card.kind === "bloodGem") {
      return human.board.length > 0;
    }
    if (card.kind === "tavernSpell") {
      return (
        !tavernSpellNeedsTarget(card) ||
        getLegalTavernSpellTargetIds(game, human.id, card).length > 0
      );
    }
    if (card.kind === "spellcraft") {
      return (
        !spellcraftNeedsTarget(card) ||
        getLegalSpellcraftTargetIds(game, human.id, card).length > 0
      );
    }
    return (
      (card.playableFromRound ?? 0) <= game.round &&
      (boardHasOpenSlot ||
        human.board.some((target) => canMagnetize(card, target)))
    );
  };
  const selectedStandingPlayer =
    selectedStandingPlayerId === null
      ? null
      : (game.players.find(
          (player) => player.id === selectedStandingPlayerId,
        ) ?? null);
  const selectedScoutingReport =
    selectedStandingPlayer &&
    selectedStandingPlayer.id !== game.humanPlayerId
      ? getHumanScoutingReport(game, selectedStandingPlayer.id)
      : null;
  const selectedVisibleWarband = selectedStandingPlayer
    ? getVisibleWarband(game, selectedStandingPlayer.id)
    : null;
  const scoutingResultRevealed =
    game.phase !== "combat" || battlePlaybackComplete;
  const selectedLastRoundResult =
    selectedStandingPlayer && scoutingResultRevealed
      ? getPublicLastRoundResult(game, selectedStandingPlayer.id)
      : null;
  const infoOpen =
    selectedUnit !== null ||
    selectedBloodGem !== null ||
    selectedSpellcraft !== null ||
    selectedTavernSpell !== null ||
    (infoTab === "scouting" && selectedStandingPlayer !== null) ||
    (infoTab === "battle" && battle !== null);
  const upgradeCost = getUpgradeCost(game, human.id);
  const selectedMinionPurchaseQuote =
    selection?.zone === "shop"
      ? getMinionPurchaseQuote(game, human.id, selection.index)
      : null;
  const minionPurchaseCost =
    selectedMinionPurchaseQuote?.cost ??
    getMinionPurchaseCost(game, human.id);
  const refreshQuote = getTavernRefreshQuote(game, human.id);
  const refreshCost = refreshQuote?.cost ?? 1;
  const tavernSpellPurchaseQuote = getTavernSpellPurchaseQuote(
    game,
    human.id,
    selectedShopSpell?.instanceId,
  );
  const canBuyTavernSpellOffer = useCallback(
    (spell: TavernSpellInstance) =>
      game.phase === "recruit" &&
      !interactionLocked &&
      getTavernSpellPurchaseQuote(
        game,
        human.id,
        spell.instanceId,
      )?.affordable === true,
    [game, human.id, interactionLocked],
  );
  const canBuyMinionOffer = useCallback(
    (shopIndex: number) =>
      game.phase === "recruit" &&
      !interactionLocked &&
      getMinionPurchaseQuote(game, human.id, shopIndex)?.affordable === true,
    [game, human.id, interactionLocked],
  );
  const canBuyFromShop =
    game.phase === "recruit" &&
    !interactionLocked &&
    (selectedMinionPurchaseQuote?.affordable === true ||
      (dragSession?.zone === "shop" &&
        getMinionPurchaseQuote(
          game,
          human.id,
          dragSession.index,
        )?.affordable === true));
  const canBuyTavernSpell =
    game.phase === "recruit" &&
    !interactionLocked &&
    tavernSpellPurchaseQuote?.affordable === true;
  const selectedCanBuy =
    (selection?.zone === "shop" && canBuyFromShop) ||
    (selection?.zone === "spellShop" && canBuyTavernSpell);
  const selectedCanPlay =
    !interactionLocked &&
    selection?.zone === "hand" &&
    selectedUnit?.kind === "minion" &&
    human.board.length < BOARD_LIMIT &&
    (selectedUnit.playableFromRound ?? 0) <= game.round;
  const selectedOfferCost =
    selection?.zone === "spellShop"
      ? (tavernSpellPurchaseQuote?.cost ?? selectedShopSpell?.cost ?? 0)
      : minionPurchaseCost;
  const selectedTavernSpellDisplayCost =
    selection?.zone === "spellShop"
      ? selectedOfferCost
      : (selectedTavernSpell?.cost ?? 0);
  const selectedOfferCurrency =
    selection?.zone === "spellShop"
      ? (tavernSpellPurchaseQuote?.currency ?? "gold")
      : (selectedMinionPurchaseQuote?.currency ?? "gold");
  const buyUnavailableReason =
    interactionLocked
      ? "请先完成当前选择"
      : human.hand.length >= 10
      ? "手牌已满"
      : selectedOfferCurrency === "health" &&
          human.health <= selectedOfferCost
        ? `生命值不足，需要保留至少 1 点生命（购买消耗 ${selectedOfferCost} 点）`
      : selectedOfferCurrency === "gold" &&
          human.gold < selectedOfferCost
        ? `金币不足，需要 ${selectedOfferCost} 枚金币`
        : null;
  const targetSource = boardChoiceInteraction
    ? human.board.find(
        (minion) =>
          minion.instanceId === boardChoiceInteraction.sourceInstanceId,
      )
    : undefined;
  const discoverSource = discoverInteraction
    ? human.board.find(
        (minion) =>
          minion.instanceId === discoverInteraction.sourceInstanceId,
      )
    : undefined;
  const discoverSourceTrinket =
    discoverInteraction?.sourceDefinitionId !== undefined &&
    human.trinketIds.includes(discoverInteraction.sourceDefinitionId) &&
    isTrinketDefinitionId(discoverInteraction.sourceDefinitionId)
      ? getTrinketDefinition(discoverInteraction.sourceDefinitionId)
      : undefined;
  const isKaleidoscopeDiscover =
    discoverSourceTrinket?.cardId === "BG35_MagicItem_821" ||
    discoverSourceTrinket?.cardId === "BG35_MagicItem_821t";
  const discoverDestination = discoverInteraction?.destination;
  const discoverMagnetizeTarget =
    discoverDestination?.kind === "magnetize"
      ? human.board.find(
          (minion) =>
            minion.instanceId ===
            discoverDestination.targetInstanceId,
        )
      : undefined;
  const discoverTransformTarget =
    discoverDestination?.kind === "transform"
      ? human.board.find(
          (minion) =>
            minion.instanceId === discoverDestination.targetInstanceId,
        )
      : undefined;
  const discoverTitle = discoverInteraction
    ? discoverInteraction.destination.kind === "transform"
      ? `古神信物 · 为${discoverTransformTarget?.name ?? "目标随从"}选择高一级形态`
      : discoverInteraction.destination.kind === "customUndeadFirst"
        ? "普崔塞德标签 · 选择战斗组件"
        : discoverInteraction.destination.kind === "customUndeadSecond"
          ? "普崔塞德标签 · 选择功能组件"
      : discoverInteraction.destination.kind === "magnetize"
      ? `${discoverSource?.name ?? "战吼"} · 发现机械并吸附到${
          discoverMagnetizeTarget?.name ?? "目标机械"
        }`
      : discoverInteraction.destination.kind === "hand" &&
          discoverInteraction.destination.destroyAfterPlayThroughRound !== undefined
        ? "惊扰墓穴 · 发现一张亡灵牌"
      : isKaleidoscopeDiscover
        ? `${discoverSourceTrinket?.name ?? "万花筒"} · 发现一个${
            discoverInteraction.selectionEffect?.kind === "makeGolden"
              ? "金色"
              : ""
          }等级7随从`
      : discoverInteraction.destination.kind === "hand" &&
          discoverInteraction.destination.playableFromRound !== undefined
        ? `搜寻时光 · 发现一个 ${discoverInteraction.filter.exactTier} 级随从`
      : discoverInteraction.sourceDefinitionId === "BG24_715"
        ? `耐心的侦查员 · 发现一个 ${discoverInteraction.filter.exactTier} 级随从`
      : discoverInteraction.sourceDefinitionId === "BG26_525"
        ? "奇瑰打击乐手 · 发现一张恶魔牌"
      : discoverInteraction.sourceDefinitionId ===
            "lesser-trinket-bg32-magicitem-361" ||
          discoverInteraction.sourceDefinitionId ===
            "greater-trinket-bg32-magicitem-361t"
        ? `口袋工厂 · 发现一张等级${discoverInteraction.filter.exactTier}的具有类型的随从牌`
      : discoverInteraction.sourceDefinitionId ===
          "greater-trinket-bg32-magicitem-362t"
        ? "旅店老板的炉火 · 发现两张等级6的随从牌"
      : discoverInteraction.filter.ability === "deathrattle"
        ? "预订遗体 · 发现一张亡语随从牌"
      : discoverInteraction.filter.ability === "battlecry"
        ? "猎头招聘 · 发现一张战吼随从牌"
      : discoverInteraction.filter.exactTier
      ? discoverInteraction.filter.exactTier === 1 &&
        !discoverSource
        ? "新生幼苗 · 发现一个等级1的随从"
        : `三连奖励 · 发现一个 ${discoverInteraction.filter.exactTier} 级随从`
      : discoverInteraction.filter.tribe
        ? `${discoverSource?.name ?? "位面望远镜"} · 发现一张${
            TRIBE_NAMES[discoverInteraction.filter.tribe]
          }牌`
        : "发现一个随从"
    : "";

  useEffect(() => {
    const sourceInstanceId =
      selectedMagneticSource?.instanceId ?? null;
    if (!sourceInstanceId) {
      previousMagneticSelectionRef.current = null;
      return;
    }
    if (
      previousMagneticSelectionRef.current === sourceInstanceId ||
      selectedMagneticTargetIds.length === 0
    ) {
      return;
    }
    previousMagneticSelectionRef.current = sourceInstanceId;
    const firstTargetInstanceId = selectedMagneticTargetIds[0];
    const focusFrame = window.requestAnimationFrame(() => {
      const firstTarget = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-unit-instance-id]",
        ),
      ).find(
        (element) =>
          element.dataset.unitInstanceId === firstTargetInstanceId,
      );
      firstTarget?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [selectedMagneticSource, selectedMagneticTargetIds]);

  useEffect(() => {
    const firstTargetInstanceId = selectedBloodGem
      ? human.board[0]?.instanceId
      : selectedSpellcraft &&
          spellcraftNeedsTarget(selectedSpellcraft)
        ? spellcraftTargetIds[0]
      : selectedHandTavernSpell &&
          tavernSpellNeedsTarget(selectedHandTavernSpell)
        ? tavernSpellTargetIds[0]
        : undefined;
    if (!firstTargetInstanceId) {
      return;
    }
    const focusFrame = window.requestAnimationFrame(() => {
      const firstTarget = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-unit-instance-id]",
        ),
      ).find(
        (element) =>
          element.dataset.unitInstanceId === firstTargetInstanceId,
      );
      firstTarget?.focus();
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [
    human.board,
    human.shop,
    selectedBloodGem,
    selectedSpellcraft,
    selectedHandTavernSpell,
    spellcraftTargetIds,
    tavernSpellTargetIds,
  ]);

  useEffect(() => {
    clearCombatIntroTimer();
    if (
      !battleKey ||
      game.phase !== "combat" ||
      combatIntroCompletedBattleKey === battleKey
    ) {
      return clearCombatIntroTimer;
    }

    combatIntroTimerRef.current = window.setTimeout(() => {
      combatIntroTimerRef.current = null;
      setBattlePlayback({
        battleKey,
        ...initialCombatPlayback(playbackEventCount),
      });
      setCombatIntroCompletedBattleKey(battleKey);
    }, COMBAT_START_INTRO_DURATION_MS);

    return clearCombatIntroTimer;
  }, [
    battleKey,
    clearCombatIntroTimer,
    combatIntroCompletedBattleKey,
    game.phase,
    playbackEventCount,
  ]);

  useEffect(() => {
    clearBattlePlaybackTimer();
    if (
      !battleKey ||
      game.phase !== "combat" ||
      combatIntroActive ||
      battlePlaybackComplete
    ) {
      return clearBattlePlaybackTimer;
    }

    battlePlaybackTimerRef.current = window.setTimeout(() => {
      battlePlaybackTimerRef.current = null;
      setBattlePlayback((current) => {
        const currentIsThisBattle = current.battleKey === battleKey;
        const currentRevealedCount = currentIsThisBattle
          ? Math.min(current.revealedCount, playbackEventCount)
          : playbackEventCount > 0
            ? 1
            : 0;
        if (currentIsThisBattle && current.complete) return current;
        if (currentRevealedCount >= playbackEventCount) {
          return {
            battleKey,
            revealedCount: playbackEventCount,
            complete: true,
          };
        }
        return {
          battleKey,
          revealedCount: currentRevealedCount + 1,
          complete: false,
        };
      });
    }, currentBattleEventDelay);

    return clearBattlePlaybackTimer;
  }, [
    battleKey,
    battlePlaybackComplete,
    clearBattlePlaybackTimer,
    currentBattleEventDelay,
    game.phase,
    playbackEventCount,
    revealedBattleEventCount,
    combatIntroActive,
  ]);

  const skipBattlePlayback = useCallback(() => {
    clearBattlePlaybackTimer();
    if (!battleKey || game.phase !== "combat" || combatIntroActive) {
      return;
    }
    setBattlePlayback({
      battleKey,
      revealedCount: playbackEventCount,
      complete: true,
    });
  }, [
    battleKey,
    clearBattlePlaybackTimer,
    combatIntroActive,
    game.phase,
    playbackEventCount,
  ]);

  const continueAfterCombat = useCallback(() => {
    if (!battle || game.phase !== "combat") return;
    if (human.alive && humanCombatRewardOutcomeCount > 0) {
      setCombatRewardNotice(humanCombatRewards);
      const preCombatHandIds = preCombatHandIdsRef.current;
      setNewCombatRewardIds(
        preCombatHandIds
          ? human.hand
              .filter(
                (card) =>
                  card.kind === "minion" &&
                  !preCombatHandIds.has(card.instanceId),
              )
              .map((card) => card.instanceId)
          : humanCombatRewards.addedInstanceIds,
      );
    } else {
      clearCombatRewardFeedback();
    }
    preCombatHandIdsRef.current = null;
    send({ type: "CONTINUE" });
  }, [
    battle,
    clearCombatRewardFeedback,
    game.phase,
    human.alive,
    human.hand,
    humanCombatRewardOutcomeCount,
    humanCombatRewards,
    send,
  ]);

  const configuredInitialHealth = useMemo(
    () => parseInitialHealthInput(initialHealthInput),
    [initialHealthInput],
  );

  const startConfiguredGame = useCallback((seed: number) => {
    if (configuredInitialHealth === null) {
      return;
    }
    clearBattlePlaybackTimer();
    clearCombatIntroTimer();
    clearTavernSpellCastFeedback();
    const next = createLobbyGame(seed, configuredInitialHealth);
    safeWriteLocalStorage(SAVE_KEY, JSON.stringify(next));
    gameRef.current = next;
    setGame(next);
    setStarted(true);
    setLoaded(true);
    setSelection(null);
    setSelectedStandingPlayerId(null);
    setShowRestart(false);
    setShowLobbyOverview(false);
    setInfoTab("details");
    setMagneticAnnouncement("");
    setBattlePlayback({
      battleKey: null,
      revealedCount: 0,
      complete: false,
    });
    setRecruitPresentationQueue([]);
    setCombatIntroCompletedBattleKey(null);
    clearCombatRewardFeedback();
    restartReturnFocusRef.current = null;
    lobbyOverviewReturnFocusRef.current = null;
    magneticFocusTargetRef.current = null;
    preCombatHandIdsRef.current = null;
  }, [
    clearBattlePlaybackTimer,
    clearTavernSpellCastFeedback,
    clearCombatIntroTimer,
    clearCombatRewardFeedback,
    configuredInitialHealth,
  ]);

  const startInitialGame = useCallback(() => {
    startConfiguredGame(newSeed());
  }, [startConfiguredGame]);

  const startFreshGame = useCallback(() => {
    startConfiguredGame(newSeed());
  }, [startConfiguredGame]);

  const openRestartDialog = useCallback(() => {
    restartReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setInitialHealthInput(String(gameRef.current.initialHealth));
    setShowRestart(true);
  }, []);

  const closeRestartDialog = useCallback(() => {
    const returnTarget = restartReturnFocusRef.current;
    restartReturnFocusRef.current = null;
    setShowRestart(false);
    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) {
        returnTarget.focus();
        return;
      }
      document
        .querySelector<HTMLElement>('[data-testid="play-again"]')
        ?.focus();
    });
  }, []);

  const openLobbyOverview = useCallback(() => {
    lobbyOverviewReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setShowLobbyOverview(true);
  }, []);

  const closeLobbyOverview = useCallback(() => {
    const returnTarget = lobbyOverviewReturnFocusRef.current;
    lobbyOverviewReturnFocusRef.current = null;
    setShowLobbyOverview(false);
    window.requestAnimationFrame(() => {
      if (
        returnTarget?.isConnected &&
        returnTarget.getClientRects().length > 0
      ) {
        returnTarget.focus();
        return;
      }
      document
        .querySelector<HTMLElement>(
          '[data-testid="trinket-hud"], [data-testid="end-turn"]',
        )
        ?.focus();
    });
  }, []);

  const deploySelected = useCallback(
    (boardIndex?: number) => {
      if (selection?.zone !== "hand" || interactionLocked) return;
      const card = human.hand[selection.index];
      if (
        card?.kind !== "minion" ||
        (card.playableFromRound ?? 0) > game.round
      ) {
        return;
      }
      setMagneticAnnouncement("");
      send({
        type: "PLAY_HAND_CARD",
        cardInstanceId: card.instanceId,
        boardIndex,
      });
    },
    [game.round, human.hand, interactionLocked, selection, send],
  );

  const magnetizeCard = useCallback(
    (cardInstanceId: string, targetInstanceId: string) => {
      const source = human.hand.find(
        (card) =>
          card.kind === "minion" &&
          card.instanceId === cardInstanceId,
      );
      const target = human.board.find(
        (minion) => minion.instanceId === targetInstanceId,
      );
      if (
        source?.kind !== "minion" ||
        !target ||
        (source.playableFromRound ?? 0) > game.round ||
        !canMagnetize(source, target)
      ) {
        return;
      }
      magneticFocusTargetRef.current = targetInstanceId;
      setMagneticAnnouncement(
        `已将${source.name}吸附到${target.name}，贡献 +${source.attack}/+${source.health}`,
      );
      send({
        type: "MAGNETIZE_MINION",
        cardInstanceId,
        targetInstanceId,
      });
    },
    [game.round, human.board, human.hand, send],
  );

  const castBloodGem = useCallback(
    (cardInstanceId: string, targetInstanceId: string) => {
      const card = human.hand.find(
        (candidate): candidate is BloodGemSpellInstance =>
          candidate.kind === "bloodGem" &&
          candidate.instanceId === cardInstanceId,
      );
      const target = human.board.find(
        (minion) => minion.instanceId === targetInstanceId,
      );
      if (!card || !target) {
        return;
      }
      const bonusKeyword =
        minionHasTribe(target, "quilboar") &&
        ((card.bonusKeyword === "tauntForQuilboar" && !target.taunt) ||
          (card.bonusKeyword === "rebornForQuilboar" &&
          !target.reborn) ||
          (card.bonusKeyword === "divineShieldForQuilboar" &&
            !target.divineShield))
          ? bloodGemKeywordText(card)
          : "";
      setMagneticAnnouncement(
        `已对${target.name}使用鲜血宝石，获得 +${human.bloodGemAttack}/+${human.bloodGemHealth}${
          bonusKeyword
            ? `，并获得${bonusKeyword}`
            : ""
        }`,
      );
      send({
        type: "CAST_BLOOD_GEM",
        cardInstanceId,
        targetInstanceId,
      });
    },
    [
      human.bloodGemAttack,
      human.bloodGemHealth,
      human.board,
      human.hand,
      send,
    ],
  );

  const castTavernSpell = useCallback(
    (cardInstanceId: string, targetInstanceId?: string) => {
      const card = human.hand.find(
        (candidate): candidate is TavernSpellInstance =>
          candidate.kind === "tavernSpell" &&
          candidate.instanceId === cardInstanceId,
      );
      if (!card) {
        return;
      }
      const legalTargetIds = getLegalTavernSpellTargetIds(
        game,
        human.id,
        card,
      );
      const needsTarget = tavernSpellNeedsTarget(card);
      const target = targetInstanceId
        ? legalTargetIds.includes(targetInstanceId)
          ? (human.board.find(
              (minion) => minion.instanceId === targetInstanceId,
            ) ??
            human.shop.find(
              (minion) => minion.instanceId === targetInstanceId,
            ))
          : undefined
        : undefined;
      if (
        (needsTarget && !target) ||
        (!needsTarget && targetInstanceId !== undefined)
      ) {
        return;
      }
      if (tavernSpellCastTimerRef.current !== null) {
        window.clearTimeout(tavernSpellCastTimerRef.current);
      }
      if (target) {
        setTavernSpellCastFeedback({
          targetInstanceId: target.instanceId,
          label: card.name,
          token: card.instanceId,
        });
        tavernSpellCastTimerRef.current = window.setTimeout(() => {
          tavernSpellCastTimerRef.current = null;
          setTavernSpellCastFeedback(null);
        }, 720);
      }
      setMagneticAnnouncement(
        target
          ? `已对${target.name}施放${card.name}`
          : `已施放${card.name}：${card.description}`,
      );
      send({
        type: "CAST_TAVERN_SPELL",
        cardInstanceId,
        targetInstanceId,
      });
    },
    [game, human.board, human.hand, human.id, human.shop, send],
  );

  const castSpellcraft = useCallback(
    (cardInstanceId: string, targetInstanceId?: string) => {
      const card = human.hand.find(
        (candidate): candidate is SpellcraftSpellInstance =>
          candidate.kind === "spellcraft" &&
          candidate.instanceId === cardInstanceId,
      );
      if (!card) {
        return;
      }
      const legalTargetIds = getLegalSpellcraftTargetIds(
        game,
        human.id,
        card,
      );
      const needsTarget = spellcraftNeedsTarget(card);
      const target = targetInstanceId
        ? legalTargetIds.includes(targetInstanceId)
          ? (human.board.find(
              (minion) => minion.instanceId === targetInstanceId,
            ) ??
            human.shop.find(
              (minion) => minion.instanceId === targetInstanceId,
            ))
          : undefined
        : undefined;
      if (
        (needsTarget && !target) ||
        (!needsTarget && targetInstanceId !== undefined)
      ) {
        return;
      }
      if (target) {
        if (tavernSpellCastTimerRef.current !== null) {
          window.clearTimeout(tavernSpellCastTimerRef.current);
        }
        setTavernSpellCastFeedback({
          targetInstanceId: target.instanceId,
          label: card.name,
          token: card.instanceId,
        });
        tavernSpellCastTimerRef.current = window.setTimeout(() => {
          tavernSpellCastTimerRef.current = null;
          setTavernSpellCastFeedback(null);
        }, 720);
      }
      const spellLabel = spellcraftDisplayLabel(card);
      setMagneticAnnouncement(
        target
          ? `已对${target.name}施放${spellLabel}${card.name}`
          : `已施放${spellLabel}${card.name}：${card.description}`,
      );
      send({
        type: "CAST_SPELLCRAFT",
        cardInstanceId,
        targetInstanceId,
      });
    },
    [game, human.board, human.hand, human.id, human.shop, send],
  );

  const showCardInspection = useCallback(
    (
      card: InspectableCard,
      source: HTMLButtonElement,
      trigger: CardInspectionTrigger,
    ) => {
      if (
        interactionLocked ||
        combatIntroActive ||
        dragSessionRef.current?.active ||
        !source.isConnected
      ) {
        return;
      }
      if (trigger === "longPress") {
        suppressLongPressClickRef.current = card.instanceId;
      }
      const rect = source.getBoundingClientRect();
      writeCardInspection({
        card,
        trigger,
        anchor: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      });
    },
    [combatIntroActive, interactionLocked, writeCardInspection],
  );

  const scheduleCardInspection = useCallback(
    (
      card: InspectableCard,
      source: HTMLButtonElement,
      trigger: "hover" | "longPress",
    ) => {
      clearCardInspectionTimer();
      pendingInspectionCardIdRef.current = card.instanceId;
      cardInspectionTimerRef.current = window.setTimeout(() => {
        cardInspectionTimerRef.current = null;
        if (
          pendingInspectionCardIdRef.current !== card.instanceId
        ) {
          return;
        }
        pendingInspectionCardIdRef.current = null;
        showCardInspection(card, source, trigger);
      }, cardInspectionDelay(trigger));
    },
    [clearCardInspectionTimer, showCardInspection],
  );

  const getCardInspectionHandlers = useCallback(
    (card: InspectableCard): CardInspectionHandlers => {
      const closeCardInspection = (
        trigger?: CardInspectionTrigger,
      ) => {
        if (pendingInspectionCardIdRef.current === card.instanceId) {
          clearCardInspectionTimer();
        }
        const current = cardInspectionRef.current;
        if (
          current?.card.instanceId === card.instanceId &&
          (trigger === undefined || current.trigger === trigger)
        ) {
          writeCardInspection(null);
        }
      };
      const cancelTouchInspection = (pointerId: number) => {
        const gesture = touchInspectionGestureRef.current;
        if (gesture?.pointerId !== pointerId) return;
        touchInspectionGestureRef.current = null;
        if (
          pendingInspectionCardIdRef.current === card.instanceId
        ) {
          clearCardInspectionTimer();
        }
      };

      return {
        onPointerEnter: (event) => {
          if (
            event.pointerType !== "mouse" ||
            interactionLocked ||
            combatIntroActive ||
            dragSessionRef.current?.active
          ) {
            return;
          }
          scheduleCardInspection(
            card,
            event.currentTarget,
            "hover",
          );
        },
        onPointerLeave: (event) => {
          if (event.pointerType !== "mouse") return;
          closeCardInspection("hover");
        },
        onPointerDown: (event) => {
          suppressLongPressClickRef.current = null;
          pointerInitiatedFocusRef.current = true;
          window.setTimeout(() => {
            pointerInitiatedFocusRef.current = false;
          }, 0);
          dismissCardInspection();
          if (
            (event.pointerType !== "touch" &&
              event.pointerType !== "pen") ||
            !event.isPrimary ||
            event.button !== 0 ||
            interactionLocked ||
            combatIntroActive
          ) {
            return;
          }
          touchInspectionGestureRef.current = {
            pointerId: event.pointerId,
            cardInstanceId: card.instanceId,
            startX: event.clientX,
            startY: event.clientY,
          };
          scheduleCardInspection(
            card,
            event.currentTarget,
            "longPress",
          );
        },
        onPointerMove: (event) => {
          const gesture = touchInspectionGestureRef.current;
          if (
            gesture?.pointerId !== event.pointerId ||
            gesture.cardInstanceId !== card.instanceId ||
            !movedBeyondCardInspectionTolerance(
              gesture.startX,
              gesture.startY,
              event.clientX,
              event.clientY,
            )
          ) {
            return;
          }
          cancelTouchInspection(event.pointerId);
          closeCardInspection("longPress");
        },
        onPointerUp: (event) => {
          cancelTouchInspection(event.pointerId);
          window.setTimeout(() => {
            if (
              suppressLongPressClickRef.current === card.instanceId
            ) {
              suppressLongPressClickRef.current = null;
            }
          }, 0);
        },
        onPointerCancel: (event) => {
          cancelTouchInspection(event.pointerId);
          closeCardInspection("longPress");
          if (
            suppressLongPressClickRef.current === card.instanceId
          ) {
            suppressLongPressClickRef.current = null;
          }
        },
        onLostPointerCapture: (event) => {
          cancelTouchInspection(event.pointerId);
        },
        onClickCapture: (event) => {
          if (
            suppressLongPressClickRef.current !== card.instanceId
          ) {
            return;
          }
          suppressLongPressClickRef.current = null;
          event.preventDefault();
          event.stopPropagation();
        },
        onFocus: (event) => {
          if (
            pointerInitiatedFocusRef.current ||
            interactionLocked ||
            combatIntroActive
          ) {
            return;
          }
          clearCardInspectionTimer();
          showCardInspection(card, event.currentTarget, "focus");
        },
        onBlur: () => {
          closeCardInspection("focus");
        },
      };
    },
    [
      clearCardInspectionTimer,
      combatIntroActive,
      dismissCardInspection,
      interactionLocked,
      scheduleCardInspection,
      showCardInspection,
      writeCardInspection,
    ],
  );

  const select = useCallback((nextSelection: Exclude<Selection, null>) => {
    setSelection(nextSelection);
    setSelectedStandingPlayerId(null);
    setInfoTab("details");
  }, []);

  const selectCard = useCallback(
    (nextSelection: Exclude<Selection, null>) => {
      if (interactionLocked) return;
      if (suppressCardClickRef.current) {
        suppressCardClickRef.current = false;
        return;
      }
      setMagneticAnnouncement("");
      select(nextSelection);
    },
    [interactionLocked, select],
  );

  const selectStandingPlayer = useCallback(
    (playerId: string) => {
      if (game.phase === "combat" && !battlePlaybackComplete) {
        return;
      }
      setSelection(null);
      setSelectedStandingPlayerId(playerId);
      setInfoTab("scouting");
    },
    [battlePlaybackComplete, game.phase],
  );

  const resolveDragTarget = useCallback(
    (
      clientX: number,
      clientY: number,
      source: DragSource,
    ): DragTarget => {
      const hit = document.elementFromPoint(clientX, clientY);
      if (!hit) return null;

      if (source.zone === "shop") {
        return canBuyMinionOffer(source.index) &&
          hit.closest('[data-hand-drop-zone="true"]')
          ? { kind: "hand" }
          : null;
      }
      if (source.zone === "spellShop") {
        const spell = tavernSpellShopOffers[source.index];
        return spell &&
          canBuyTavernSpellOffer(spell) &&
          hit.closest('[data-hand-drop-zone="true"]')
          ? { kind: "hand" }
          : null;
      }

      if (
        source.zone === "board" &&
        hit.closest('[data-sell-drop-zone="true"]')
      ) {
        return { kind: "sell" };
      }

      if (source.zone === "hand") {
        const sourceCard = human.hand[source.index];
        const hoveredCard = hit.closest<HTMLElement>(
          "[data-unit-instance-id]",
        );
        const hoveredInstanceId =
          hoveredCard?.dataset.unitInstanceId;
        const hoveredBoardTarget = hoveredInstanceId
          ? human.board.find(
              (minion) =>
                minion.instanceId === hoveredInstanceId,
            )
          : undefined;
        const hoveredShopTarget = hoveredInstanceId
          ? human.shop.find(
              (minion) => minion.instanceId === hoveredInstanceId,
            )
          : undefined;
        if (sourceCard?.kind === "bloodGem" && hoveredBoardTarget) {
          return {
            kind: "bloodGem",
            targetInstanceId: hoveredBoardTarget.instanceId,
          };
        }
        const hoveredTavernSpellTarget =
          sourceCard?.kind === "tavernSpell" &&
          tavernSpellCanTargetShop(sourceCard)
            ? (hoveredBoardTarget ?? hoveredShopTarget)
            : hoveredBoardTarget;
        if (
          sourceCard?.kind === "tavernSpell" &&
          tavernSpellNeedsTarget(sourceCard) &&
          hoveredTavernSpellTarget &&
          getLegalTavernSpellTargetIds(
            game,
            human.id,
            sourceCard,
          ).includes(hoveredTavernSpellTarget.instanceId)
        ) {
          return {
            kind: "tavernSpell",
            targetInstanceId: hoveredTavernSpellTarget.instanceId,
          };
        }
        const hoveredSpellcraftTarget =
          hoveredBoardTarget ?? hoveredShopTarget;
        if (
          sourceCard?.kind === "spellcraft" &&
          spellcraftNeedsTarget(sourceCard) &&
          hoveredSpellcraftTarget &&
          getLegalSpellcraftTargetIds(
            game,
            human.id,
            sourceCard,
          ).includes(hoveredSpellcraftTarget.instanceId)
        ) {
          return {
            kind: "spellcraft",
            targetInstanceId: hoveredSpellcraftTarget.instanceId,
          };
        }
        if (
          sourceCard?.kind === "minion" &&
          isMagneticMinion(sourceCard) &&
          hoveredBoardTarget
        ) {
          return canMagnetize(sourceCard, hoveredBoardTarget)
            ? {
                kind: "magnetic",
                targetInstanceId: hoveredBoardTarget.instanceId,
              }
            : {
                kind: "blockedMagnetic",
                targetInstanceId: hoveredBoardTarget.instanceId,
                targetName: hoveredBoardTarget.name,
              };
        }
      }

      const insertionTarget = hit.closest<HTMLElement>(
        "[data-board-insert-index]",
      );
      const draggedHandCard =
        source.zone === "hand" ? human.hand[source.index] : undefined;
      if (
        source.zone === "hand" &&
        draggedHandCard?.kind === "minion" &&
        insertionTarget
      ) {
        const insertionIndex = Number(
          insertionTarget.dataset.boardInsertIndex,
        );
        if (
          Number.isInteger(insertionIndex) &&
          (draggedHandCard.playableFromRound ?? 0) <= game.round &&
          human.board.length < BOARD_LIMIT &&
          insertionIndex >= 0 &&
          insertionIndex <= human.board.length
        ) {
          return { kind: "board", index: insertionIndex };
        }
      }

      const boardDropZone = document.querySelector<HTMLElement>(
        '[data-board-drop-zone="true"]',
      );
      if (!boardDropZone) return null;
      const dropZoneRect = boardDropZone.getBoundingClientRect();
      const dropZoneSlop = 20;
      if (
        clientX < dropZoneRect.left - dropZoneSlop ||
        clientX > dropZoneRect.right + dropZoneSlop ||
        clientY < dropZoneRect.top - dropZoneSlop ||
        clientY > dropZoneRect.bottom + dropZoneSlop
      ) {
        return null;
      }
      if (
        source.zone === "hand" &&
        draggedHandCard?.kind === "tavernSpell" &&
        !tavernSpellNeedsTarget(draggedHandCard)
      ) {
        return { kind: "castTavernSpell" };
      }
      if (
        source.zone === "hand" &&
        draggedHandCard?.kind === "spellcraft" &&
        !spellcraftNeedsTarget(draggedHandCard)
      ) {
        return { kind: "castSpellcraft" };
      }
      const slots = Array.from(
        boardDropZone.querySelectorAll<HTMLElement>(
          ":scope > [data-board-slot-index]",
        ),
      );
      const nearestSlotPosition = nearestBoardSlotIndex(
        clientX,
        slots.map((slot) => {
          const rect = slot.getBoundingClientRect();
          return rect.left + rect.width / 2;
        }),
      );
      if (nearestSlotPosition === null) return null;
      const index = Number(
        slots[nearestSlotPosition]?.dataset.boardSlotIndex,
      );
      if (!Number.isInteger(index)) return null;

      if (source.zone === "hand") {
        if (
          draggedHandCard?.kind !== "minion" ||
          (draggedHandCard.playableFromRound ?? 0) > game.round ||
          human.board.length >= BOARD_LIMIT ||
          index < 0 ||
          index > human.board.length
        ) {
          return null;
        }
        return { kind: "board", index };
      }

      if (
        source.zone === "board" &&
        index >= 0 &&
        index < human.board.length
      ) {
        return { kind: "board", index };
      }
      return null;
    },
    [
      canBuyMinionOffer,
      canBuyTavernSpellOffer,
      game,
      human.board,
      human.hand,
      human.id,
      human.shop,
      tavernSpellShopOffers,
    ],
  );

  const beginDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      source: DragSource,
      card: DraggableCard,
    ) => {
      const hasMagneticTarget =
        source.zone === "hand" &&
        card.kind === "minion" &&
        human.board.some((target) => canMagnetize(card, target));
      const handCardCannotAct =
        source.zone === "hand" &&
        (card.kind === "minion" &&
        (card.playableFromRound ?? 0) > game.round
          ? true
          : card.kind === "bloodGem"
          ? human.board.length === 0
          : card.kind === "tavernSpell"
            ? tavernSpellNeedsTarget(card) &&
              getLegalTavernSpellTargetIds(
                game,
                human.id,
                card,
              ).length === 0
          : card.kind === "spellcraft"
            ? spellcraftNeedsTarget(card) &&
              getLegalSpellcraftTargetIds(
                game,
                human.id,
                card,
              ).length === 0
          : human.board.length >= BOARD_LIMIT && !hasMagneticTarget);
      if (
        dragSessionRef.current !== null ||
        interactionLocked ||
        game.phase !== "recruit" ||
        !event.isPrimary ||
        event.button !== 0 ||
        handCardCannotAct ||
        (source.zone === "shop" && !canBuyMinionOffer(source.index)) ||
        (source.zone === "spellShop" &&
          (card.kind !== "tavernSpell" ||
            !canBuyTavernSpellOffer(card)))
      ) {
        return;
      }

      setMagneticAnnouncement("");
      const rect = event.currentTarget.getBoundingClientRect();
      dragCaptureElementRef.current = event.currentTarget;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The browser can decline capture if the pointer ended immediately.
      }
      writeDragSession({
        ...source,
        card,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        active: false,
        target: null,
      });
    },
    [
      canBuyMinionOffer,
      canBuyTavernSpellOffer,
      game,
      human,
      interactionLocked,
      writeDragSession,
    ],
  );

  const moveDragSession = useCallback(
    (pointerId: number, clientX: number, clientY: number): boolean => {
      const current = dragSessionRef.current;
      if (!current || current.pointerId !== pointerId) return false;

      const distance = Math.hypot(
        clientX - current.startX,
        clientY - current.startY,
      );
      const active =
        current.active ||
        distance >= dragThreshold(current.pointerType);
      if (!active) return false;
      if (
        current.active &&
        current.clientX === clientX &&
        current.clientY === clientY
      ) {
        return true;
      }

      if (!current.active && active) {
        dismissCardInspection();
      }
      writeDragSession({
        ...current,
        clientX,
        clientY,
        active,
        target: resolveDragTarget(clientX, clientY, current),
      });
      return true;
    },
    [
      dismissCardInspection,
      resolveDragTarget,
      writeDragSession,
    ],
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (
        moveDragSession(
          event.pointerId,
          event.clientX,
          event.clientY,
        )
      ) {
        event.preventDefault();
      }
    },
    [moveDragSession],
  );

  const finishDragSession = useCallback(
    (
      pointerId: number,
      clientX: number,
      clientY: number,
      cancelled: boolean,
    ): boolean => {
      const current = dragSessionRef.current;
      if (!current || current.pointerId !== pointerId) return false;

      const distance = Math.hypot(
        clientX - current.startX,
        clientY - current.startY,
      );
      const wasActive =
        current.active ||
        distance >= dragThreshold(current.pointerType);
      const target = cancelled || !wasActive
        ? null
        : resolveDragTarget(clientX, clientY, current);
      writeDragSession(null);
      const captureElement = dragCaptureElementRef.current;
      dragCaptureElementRef.current = null;
      try {
        if (captureElement?.hasPointerCapture(pointerId)) {
          captureElement.releasePointerCapture(pointerId);
        }
      } catch {
        // Capture may already be gone after a system-level pointer cancel.
      }

      if (!wasActive) return false;
      suppressCardClickRef.current = true;
      window.setTimeout(() => {
        suppressCardClickRef.current = false;
      }, 0);

      if (!target) {
        if (
          current.zone === "hand" &&
          (current.card.kind === "bloodGem" ||
            current.card.kind === "tavernSpell" ||
            current.card.kind === "spellcraft")
        ) {
          setMagneticAnnouncement(
            `${current.card.name}没有落在合法目标上，已返回手牌`,
          );
        }
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "minion" &&
        target.kind === "magnetic"
      ) {
        magnetizeCard(
          current.card.instanceId,
          target.targetInstanceId,
        );
        return true;
      }
      if (
        current.zone === "hand" &&
        target.kind === "blockedMagnetic"
      ) {
        setMagneticAnnouncement(
          `${current.card.name}不能吸附到${target.targetName}，已返回手牌`,
        );
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "bloodGem" &&
        target.kind === "bloodGem"
      ) {
        castBloodGem(
          current.card.instanceId,
          target.targetInstanceId,
        );
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "tavernSpell" &&
        target.kind === "tavernSpell"
      ) {
        castTavernSpell(
          current.card.instanceId,
          target.targetInstanceId,
        );
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "spellcraft" &&
        target.kind === "spellcraft"
      ) {
        castSpellcraft(
          current.card.instanceId,
          target.targetInstanceId,
        );
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "spellcraft" &&
        target.kind === "castSpellcraft"
      ) {
        castSpellcraft(current.card.instanceId);
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "tavernSpell" &&
        target.kind === "castTavernSpell"
      ) {
        castTavernSpell(current.card.instanceId);
        return true;
      }
      if (current.zone === "shop" && target.kind === "hand") {
        send({ type: "BUY_MINION", shopIndex: current.index });
        return true;
      }
      if (current.zone === "spellShop" && target.kind === "hand") {
        send({
          type: "BUY_TAVERN_SPELL",
          spellInstanceId: current.card.instanceId,
        });
        return true;
      }
      if (
        current.zone === "hand" &&
        current.card.kind === "minion" &&
        target.kind === "board"
      ) {
        send({
          type: "PLAY_HAND_CARD",
          cardInstanceId: current.card.instanceId,
          boardIndex: target.index,
        });
        return true;
      }
      if (current.zone === "board" && target.kind === "sell") {
        send({ type: "SELL_MINION", boardIndex: current.index });
        return true;
      }
      if (
        current.zone === "board" &&
        target.kind === "board" &&
        current.index !== target.index
      ) {
        send({
          type: "MOVE_MINION",
          fromIndex: current.index,
          toIndex: target.index,
        });
      }
      return true;
    },
    [
      castBloodGem,
      castSpellcraft,
      castTavernSpell,
      magnetizeCard,
      resolveDragTarget,
      send,
      writeDragSession,
    ],
  );

  const finishDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      cancelled: boolean,
    ) => {
      if (
        finishDragSession(
          event.pointerId,
          event.clientX,
          event.clientY,
          cancelled,
        )
      ) {
        event.preventDefault();
      }
    },
    [finishDragSession],
  );

  const getDragHandlers = useCallback(
    (
      source: DragSource,
      card: DraggableCard,
    ): DragPointerHandlers => ({
      onPointerDown: (event) => beginDrag(event, source, card),
      onPointerMove: moveDrag,
      onPointerUp: (event) => finishDrag(event, false),
      onPointerCancel: (event) => finishDrag(event, true),
      onLostPointerCapture: (event) => {
        const current = dragSessionRef.current;
        if (current?.pointerId === event.pointerId) {
          finishDragSession(
            event.pointerId,
            current.clientX,
            current.clientY,
            true,
          );
        }
      },
    }),
    [beginDrag, finishDrag, finishDragSession, moveDrag],
  );

  useEffect(() => {
    const handleWindowPointerMove = (event: PointerEvent) => {
      if (
        moveDragSession(
          event.pointerId,
          event.clientX,
          event.clientY,
        )
      ) {
        event.preventDefault();
      }
    };
    const handleWindowPointerEnd = (event: PointerEvent) => {
      if (
        finishDragSession(
          event.pointerId,
          event.clientX,
          event.clientY,
          event.type === "pointercancel",
        )
      ) {
        event.preventDefault();
      }
    };
    const cancelStaleDrag = () => {
      const current = dragSessionRef.current;
      if (!current) return;
      finishDragSession(
        current.pointerId,
        current.clientX,
        current.clientY,
        true,
      );
      // This listener runs before a new pointerdown reaches a card. The stale
      // gesture must not consume the fresh click that is about to begin.
      suppressCardClickRef.current = false;
    };
    const handleWindowPointerDown = () => {
      dismissCardInspection();
      cancelStaleDrag();
    };
    const handleWindowBlur = () => {
      dismissCardInspection();
      cancelStaleDrag();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (
        cardInspectionRef.current ||
        cardInspectionTimerRef.current !== null
      ) {
        dismissCardInspection();
        return;
      }
      if (dragSessionRef.current) {
        cancelStaleDrag();
        return;
      }
      if (
        selectedMagneticSource ||
        selectedBloodGem ||
        selectedSpellcraft ||
        selectedHandTavernSpell
      ) {
        setSelection(null);
        setMagneticAnnouncement(
          selectedBloodGem
            ? "已取消鲜血宝石目标选择"
            : selectedSpellcraft
              ? `已取消${spellcraftDisplayLabel(selectedSpellcraft)}目标选择`
            : selectedHandTavernSpell
              ? "已取消酒馆法术目标选择"
            : "已取消磁力目标选择",
        );
      }
    };

    window.addEventListener("pointermove", handleWindowPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handleWindowPointerEnd, {
      passive: false,
    });
    window.addEventListener("pointercancel", handleWindowPointerEnd, {
      passive: false,
    });
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("resize", dismissCardInspection);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
      window.removeEventListener(
        "pointerdown",
        handleWindowPointerDown,
        true,
      );
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("resize", dismissCardInspection);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    dismissCardInspection,
    finishDragSession,
    moveDragSession,
    selectedBloodGem,
    selectedSpellcraft,
    selectedHandTavernSpell,
    selectedMagneticSource,
  ]);

  useEffect(
    () => () => {
      clearCardInspectionTimer();
    },
    [clearCardInspectionTimer],
  );

  useEffect(() => {
    const current = dragSessionRef.current;
    if ((game.phase !== "recruit" || interactionLocked) && current) {
      finishDragSession(
        current.pointerId,
        current.clientX,
        current.clientY,
        true,
      );
    }
  }, [finishDragSession, game.phase, interactionLocked]);

  const dragMagneticTargetInstanceId =
    dragSession?.target?.kind === "magnetic"
      ? dragSession.target.targetInstanceId
      : undefined;
  const dragMagneticTargetName =
    dragMagneticTargetInstanceId
      ? human.board.find(
          (minion) =>
            minion.instanceId === dragMagneticTargetInstanceId,
        )?.name
      : undefined;
  const draggedMinionShopIndex =
    dragSession?.zone === "shop" && dragSession.card.kind === "minion"
      ? human.shop.findIndex(
          (minion) => minion.instanceId === dragSession.card.instanceId,
        )
      : -1;
  const draggedMinionPurchaseQuote =
    draggedMinionShopIndex >= 0
      ? getMinionPurchaseQuote(game, human.id, draggedMinionShopIndex)
      : null;
  const draggedTavernSpellPurchaseQuote =
    dragSession?.zone === "spellShop" &&
    dragSession.card.kind === "tavernSpell"
      ? getTavernSpellPurchaseQuote(
          game,
          human.id,
          dragSession.card.instanceId,
        )
      : null;
  const draggedOfferCost =
    draggedTavernSpellPurchaseQuote?.cost ??
    draggedMinionPurchaseQuote?.cost ??
    (dragSession?.card.kind === "tavernSpell"
        ? dragSession.card.cost
        : minionPurchaseCost);
  const draggedOfferCurrency =
    draggedTavernSpellPurchaseQuote?.currency ??
    draggedMinionPurchaseQuote?.currency ??
    (dragSession?.card.kind === "tavernSpell"
      ? tavernSpellPurchaseCurrency(dragSession.card)
      : "gold");
  const dragAnnouncement =
    dragSession?.active !== true
      ? ""
      : dragSession.target?.kind === "sell"
        ? `松手出售${dragSession.card.name}，获得 ${
            dragSession.card.kind === "minion"
              ? getMinionSellValue(
                  game,
                  human.id,
                  dragSession.card,
                )
              : 0
          } 枚金币`
        : dragSession.target?.kind === "hand"
          ? draggedOfferCurrency === "health"
            ? `松手购买${dragSession.card.name}，支付 ${draggedOfferCost} 点生命`
            : `松手购买${dragSession.card.name}，支付 ${
                draggedOfferCost
              } 枚金币`
          : dragSession.target?.kind === "magnetic"
            ? `松手将${dragSession.card.name}吸附到${
                dragMagneticTargetName ?? "目标随从"
              }`
            : dragSession.target?.kind === "bloodGem"
              ? `松手对目标随从使用鲜血宝石，获得 +${human.bloodGemAttack}/+${human.bloodGemHealth}`
            : dragSession.target?.kind === "tavernSpell"
              ? `松手对目标随从施放${dragSession.card.name}`
            : dragSession.target?.kind === "spellcraft"
              ? `松手对目标随从施放${dragSession.card.name}`
            : dragSession.target?.kind === "castTavernSpell"
              ? `松手施放${dragSession.card.name}`
            : dragSession.target?.kind === "castSpellcraft"
              ? `松手施放${
                  dragSession.card.kind === "spellcraft"
                    ? spellcraftDisplayLabel(dragSession.card)
                    : "法术"
                }${dragSession.card.name}`
            : dragSession.target?.kind === "blockedMagnetic"
              ? `${dragSession.card.name}不能吸附到${dragSession.target.targetName}，松手将返回手牌`
          : dragSession.target?.kind === "board"
            ? `松手放到战场第 ${dragSession.target.index + 1} 个位置`
            : dragSession.zone === "shop"
              ? `拖到发光的手牌区域购买，花费 ${draggedOfferCost} ${
                  draggedOfferCurrency === "health" ? "点生命" : "枚金币"
                }`
              : dragSession.zone === "spellShop" &&
                  dragSession.card.kind === "tavernSpell"
                ? draggedOfferCurrency === "health"
                  ? `拖到发光的手牌区域购买，花费 ${draggedOfferCost} 点生命`
                  : `拖到发光的手牌区域购买，花费 ${draggedOfferCost} 枚金币`
              : dragSession.zone === "board"
                ? "拖到战场位置来换位，或拖到鲍勃的酒馆出售"
                : dragSession.card.kind === "bloodGem"
                  ? "拖到任意友方随从上使用鲜血宝石"
                : dragSession.card.kind === "tavernSpell"
                  ? tavernSpellNeedsTarget(dragSession.card)
                    ? tavernSpellCanTargetShop(dragSession.card)
                      ? "拖到任意发光随从上施放；酒馆随从也是合法目标"
                      : "拖到任意发光的友方随从上施放酒馆法术"
                    : "拖到战场区域施放酒馆法术"
                : dragSession.card.kind === "spellcraft"
                  ? spellcraftNeedsTarget(dragSession.card)
                    ? `拖到任意发光的友方随从上施放${spellcraftDisplayLabel(dragSession.card)}`
                    : `拖到战场区域施放${spellcraftDisplayLabel(dragSession.card)}`
                : isMagneticMinion(dragSession.card)
                  ? boardHasOpenSlot
                    ? "拖到标有“可吸附”的随从进行磁力吸附，或拖到插位线上普通上场"
                    : "战场已满，只能拖到标有“可吸附”的随从进行磁力吸附"
                  : "拖到发光的战场位置上场";
  const magneticSelectionAnnouncement = selectedMagneticSource
    ? selectedMagneticTargetIds.length > 0
      ? boardHasOpenSlot
        ? `已选择${selectedMagneticSource.name}，场上有 ${selectedMagneticTargetIds.length} 个可吸附目标。点击发光随从吸附，或点击空阵位普通上场`
        : `已选择${selectedMagneticSource.name}，场上有 ${selectedMagneticTargetIds.length} 个可吸附目标。战场已满，只能点击发光随从吸附`
      : boardHasOpenSlot
        ? `已选择${selectedMagneticSource.name}，当前没有可吸附目标，可以作为普通随从上场`
        : `已选择${selectedMagneticSource.name}，战场已满且当前没有可吸附目标`
    : "";
  const bloodGemSelectionAnnouncement = selectedBloodGem
    ? human.board.length > 0
      ? `已选择鲜血宝石，可对 ${human.board.length} 个友方随从使用，当前效果 +${human.bloodGemAttack}/+${human.bloodGemHealth}`
      : "已选择鲜血宝石，但场上没有可用目标"
    : "";
  const tavernSpellSelectionAnnouncement = selectedHandTavernSpell
    ? tavernSpellNeedsTarget(selectedHandTavernSpell)
      ? tavernSpellTargetIds.length > 0
        ? `已选择${selectedHandTavernSpell.name}，可对 ${tavernSpellTargetIds.length} 个发光随从施放${
            tavernSpellCanTargetShop(selectedHandTavernSpell)
              ? "，包括酒馆随从"
              : ""
          }`
        : `已选择${selectedHandTavernSpell.name}，但场上没有合法目标`
      : `已选择${selectedHandTavernSpell.name}，可在详情面板点击施放，或拖到战场区域`
    : "";
  const spellcraftSelectionAnnouncement = selectedSpellcraft
    ? spellcraftNeedsTarget(selectedSpellcraft)
      ? spellcraftTargetIds.length > 0
        ? `已选择${spellcraftDisplayLabel(selectedSpellcraft)}${selectedSpellcraft.name}，可对 ${spellcraftTargetIds.length} 个发光的友方随从施放`
        : `已选择${spellcraftDisplayLabel(selectedSpellcraft)}${selectedSpellcraft.name}，但场上没有合法目标`
      : `已选择${spellcraftDisplayLabel(selectedSpellcraft)}${selectedSpellcraft.name}，可在详情面板点击施放，或拖到战场区域`
    : "";
  const interactionAnnouncement =
    dragAnnouncement ||
    magneticAnnouncement ||
    spellcraftSelectionAnnouncement ||
    tavernSpellSelectionAnnouncement ||
    bloodGemSelectionAnnouncement ||
    magneticSelectionAnnouncement ||
    ((selection?.zone === "shop" ||
      selection?.zone === "spellShop") &&
    buyUnavailableReason
      ? `无法购买${
          selectedUnit?.name ?? selectedShopSpell?.name ?? "该牌"
        }：${buyUnavailableReason}`
      : "");
  const aimedSpellDrag =
    dragSession?.active === true &&
    dragSession.zone === "hand" &&
    (dragSession.card.kind === "bloodGem" ||
      (dragSession.card.kind === "tavernSpell" &&
        tavernSpellNeedsTarget(dragSession.card)) ||
      (dragSession.card.kind === "spellcraft" &&
        spellcraftNeedsTarget(dragSession.card)))
      ? dragSession
      : null;
  const aimedSpellHasValidTarget =
    aimedSpellDrag?.card.kind === "bloodGem"
      ? aimedSpellDrag.target?.kind === "bloodGem"
      : aimedSpellDrag?.card.kind === "tavernSpell"
        ? aimedSpellDrag.target?.kind === "tavernSpell"
        : aimedSpellDrag?.card.kind === "spellcraft"
          ? aimedSpellDrag.target?.kind === "spellcraft"
        : false;
  const aimedSpellPath = aimedSpellDrag
    ? (() => {
        const startX =
          aimedSpellDrag.startX -
          aimedSpellDrag.offsetX +
          aimedSpellDrag.width / 2;
        const startY =
          aimedSpellDrag.startY -
          aimedSpellDrag.offsetY +
          aimedSpellDrag.height / 2;
        const endX = aimedSpellDrag.clientX;
        const endY = aimedSpellDrag.clientY;
        const controlX = (startX + endX) / 2;
        const controlY =
          Math.min(startY, endY) -
          Math.min(110, Math.abs(endX - startX) * 0.18 + 28);
        return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
      })()
    : null;

  const battleDamage = battle
    ? battle.resultForHuman === "win"
      ? battle.playerAId === game.humanPlayerId
        ? battle.damageToPlayerB
        : battle.damageToPlayerA
      : battle.resultForHuman === "loss"
        ? battle.playerAId === game.humanPlayerId
          ? battle.damageToPlayerA
          : battle.damageToPlayerB
        : 0
    : 0;
  const activeRecruitCurrencies =
    activeRecruitPresentation?.events.filter(
      (event) => event.kind === "currency",
    ) ?? [];
  const activeRecruitCurrency = activeRecruitCurrencies[0];
  const activeRecruitMove = activeRecruitPresentation?.events.find(
    (event) => event.kind === "cardMove",
  );
  const activeRecruitRefresh =
    activeRecruitPresentation?.events.find(
      (event) => event.kind === "shopRefresh",
    );
  const activeRecruitUpgrade =
    activeRecruitPresentation?.events.find(
      (event) => event.kind === "tavernUpgrade",
    );
  const activeRecruitTriples =
    activeRecruitPresentation?.events.filter(
      (event) => event.kind === "triple",
    ) ?? [];
  const bloodGemCastFeedback: BloodGemCastFeedback | null =
    activeRecruitBloodGemPulse?.kind === "bloodGemPulse"
      ? {
          targetInstanceId:
            activeRecruitBloodGemPulse.targetInstanceId,
          attack: activeRecruitBloodGemPulse.attack,
          health: activeRecruitBloodGemPulse.health,
          bonusKeyword:
            activeRecruitBloodGemPulse.bonusKeyword ===
            "tauntForQuilboar"
              ? "嘲讽"
              : activeRecruitBloodGemPulse.bonusKeyword ===
                  "rebornForQuilboar"
                ? "复生"
                : activeRecruitBloodGemPulse.bonusKeyword ===
                    "divineShieldForQuilboar"
                  ? "圣盾"
                  : "",
          token: `${activeRecruitPresentation?.token ?? 0}-${
            activeRecruitBloodGemPulse.pulseIndex
          }`,
        }
      : null;
  const activeRecruitMotion = activeRecruitPresentation?.motion ?? null;
  const activeRecruitAction =
    activeRecruitMove?.kind === "cardMove"
      ? activeRecruitMove.motion
      : activeRecruitRefresh
        ? "shop-refresh"
        : activeRecruitUpgrade
          ? "tavern-upgrade"
          : activeRecruitTriples.length > 0
            ? "triple-merge"
            : activeRecruitBloodGemPulse
              ? "blood-gem-pulse"
            : "none";
  const recruitFeedbackTitle =
    activeRecruitMove?.kind === "cardMove"
      ? activeRecruitMove.motion === "shop-to-hand"
        ? `购买 · ${activeRecruitMove.card.name}`
        : `出售 · ${activeRecruitMove.card.name}`
      : activeRecruitRefresh?.kind === "shopRefresh"
        ? activeRecruitRefresh.free
          ? "免费刷新"
          : "刷新酒馆"
        : activeRecruitUpgrade?.kind === "tavernUpgrade"
          ? `酒馆升至 ${activeRecruitUpgrade.toTier} 星`
          : activeRecruitTriples[0]?.kind === "triple"
            ? `三连 · ${activeRecruitTriples[0].golden.name}`
            : activeRecruitBloodGemPulse?.kind === "bloodGemPulse"
              ? activeRecruitBloodGemPulse.origin === "roogug"
                ? "鲁古格 · 鲜血宝石转投"
                : "鲜血宝石 · 逐颗结算"
            : "";

  return (
    <main
      className={`game-shell${dragSession?.active ? " is-dragging" : ""}${
        interactionLocked ? " has-pending-interaction" : ""
      }${
        activeRecruitPresentation ? " has-recruit-presentation" : ""
      }`}
      data-phase={game.phase}
      data-loaded={loaded}
      data-dragging={dragSession?.active === true}
      data-combat-stage={combatPresentationStage ?? "none"}
      data-pending-interaction={humanInteraction?.kind ?? "none"}
      data-testid="game-shell"
    >
      <header
        className="top-hud"
        inert={interactionLocked || combatIntroActive || pageModalOpen}
      >
        <div className="brand">
          酒馆战棋 · 单机版
          <small
            title={`本局开放：${game.activeTribes
              .map((tribe) => TRIBE_NAMES[tribe])
              .join("、")}`}
          >
            第 {game.round} 回合 · 36.0.3 · 本局 5 种族
          </small>
        </div>
        <span className="phase-pill">{phaseLabel(game.phase)}</span>
        <div
          className={`hud-stat health${
            currentHeroDamageTargetId === human.id
              ? " is-taking-hero-damage"
              : ""
          }${
            activeRecruitCurrency?.currency === "health"
              ? activeRecruitCurrency.delta < 0
                ? " is-spending"
                : " is-earning"
              : ""
          }`}
          aria-atomic="true"
          aria-label={`生命 ${displayedHumanHealth}`}
          aria-live="polite"
          data-displayed-health={displayedHumanHealth}
          data-stat="health"
          data-testid="human-health"
          role="status"
        >
          <small>生命</small>
          <strong>{displayedHumanHealth}</strong>
          {activeRecruitCurrencies
            .filter((currency) => currency.currency === "health")
            .map((currency, index) => (
              <span
                className="recruit-resource-delta"
                data-delta={formatSignedStat(currency.delta)}
                data-currency="health"
                data-reason={currency.reason}
                data-testid="recruit-resource-delta"
                aria-hidden="true"
                key={`health-${activeRecruitPresentation?.token ?? 0}-${index}`}
                style={
                  {
                    "--resource-delta-index": index,
                  } as CSSProperties
                }
              >
                {formatSignedStat(currency.delta)}
              </span>
            ))}
        </div>
        <div
          className={`hud-stat armor${
            currentHeroDamageTargetId === human.id
              ? " is-taking-hero-damage"
              : ""
          }`}
          aria-atomic="true"
          aria-label={`护甲 ${displayedHumanArmor}`}
          aria-live="polite"
          data-displayed-armor={displayedHumanArmor}
          data-stat="armor"
          data-testid="human-armor"
          role="status"
        >
          <small>护甲</small>
          <strong>{displayedHumanArmor}</strong>
        </div>
        <div
          className={`hud-stat gold${
            activeRecruitCurrency?.currency === "gold"
              ? activeRecruitCurrency.delta < 0
                ? " is-spending"
                : " is-earning"
              : ""
          }`}
          aria-label={`金币 ${human.gold}`}
          data-stat="gold"
          data-testid="human-gold"
        >
          <small>金币</small>
          <strong>{human.gold}</strong>
          {activeRecruitCurrencies
            .filter((currency) => currency.currency === "gold")
            .map((currency, index) => (
              <span
                className="recruit-resource-delta"
                data-delta={formatSignedStat(currency.delta)}
                data-currency="gold"
                data-reason={currency.reason}
                data-testid="recruit-resource-delta"
                aria-hidden="true"
                key={`gold-${activeRecruitPresentation?.token ?? 0}-${index}`}
                style={
                  {
                    "--resource-delta-index":
                      index + (currency.reason === "sell" ? 1 : 0),
                  } as CSSProperties
                }
              >
                {formatSignedStat(currency.delta)}
              </span>
            ))}
        </div>
        <div
          className={`hud-stat tavern-tier${
            activeRecruitUpgrade ? " is-upgrading" : ""
          }`}
          aria-label={`酒馆等级 ${human.tavernTier}`}
          data-stat="tavern-tier"
          data-testid="human-tavern-tier"
        >
          <small>酒馆</small>
          <strong>{human.tavernTier} / 6</strong>
          {activeRecruitUpgrade?.kind === "tavernUpgrade" && (
            <span
              className="tavern-tier-burst"
              data-from-tier={activeRecruitUpgrade.fromTier}
              data-to-tier={activeRecruitUpgrade.toTier}
              data-testid="tavern-upgrade-burst"
              aria-hidden="true"
              key={`tier-${activeRecruitPresentation?.token ?? 0}`}
            >
              ★ {activeRecruitUpgrade.toTier}
            </span>
          )}
        </div>
        {humanHeroPowerCanActivate ? (
          <button
            type="button"
            className={`hud-hero-power${
              humanHeroPowerAffordable ? " is-affordable" : " is-unaffordable"
            }`}
            aria-label={
              humanHeroPower
                ? `${humanHero?.name ?? "英雄"}，英雄技能 ${humanHeroPower.name} · 费用 ${humanHeroPowerCost} 金币：${humanHeroPowerStatus ?? humanHeroPower.description}`
                : "英雄与英雄技能：无"
            }
            data-testid="human-hero-power"
            title={`${humanHeroPower?.name ?? "英雄技能"} · ${humanHeroPowerCost} 金币${humanHeroPowerAffordable ? "" : " · 金币不足"}`}
            onClick={() => doActivateHeroPower()}
            disabled={!humanHeroPowerAffordable || heroPowerTargeting}
          >
            {humanHero && (
              <span className="hero-hud-portrait" aria-hidden="true">
                <CardArtwork unit={humanHero} kind="portrait" />
              </span>
            )}
            <small>{humanHero?.name ?? "英雄技能"}</small>
            <strong>{humanHeroPower?.name ?? "无"}</strong>
            <span>
              {humanHeroPowerStatus ??
                (game.lobbySystemsEnabled
                  ? "等待选择英雄"
                  : "旧存档沿用中立英雄")}
            </span>
            <span className="hero-power-cost-badge">
              {humanHeroPowerCost} 币
            </span>
          </button>
        ) : (
          <div
            className={`hud-hero-power${
              humanHeroPowerActive ? " is-used" : ""
            }`}
            aria-label={
              humanHeroPower
                ? `${humanHero?.name ?? "英雄"}，英雄技能 ${humanHeroPower.name}：${humanHeroPowerStatus ?? humanHeroPower.description}`
                : "英雄与英雄技能：无"
            }
            data-testid="human-hero-power"
            title={
              humanHeroPowerUsedThisTurn
                ? "本轮已使用英雄技能"
                : humanHeroPowerActive
                  ? "英雄技能无法使用（战斗阶段或锁定中）"
                  : humanHeroPowerStatus ?? "尚未获得英雄技能"
            }
          >
            {humanHero && (
              <span className="hero-hud-portrait" aria-hidden="true">
                <CardArtwork unit={humanHero} kind="portrait" />
              </span>
            )}
            <small>{humanHero?.name ?? "英雄技能"}</small>
            <strong>{humanHeroPower?.name ?? "无"}</strong>
            <span>
              {humanHeroPowerStatus ??
                (game.lobbySystemsEnabled
                  ? "等待选择英雄"
                  : "旧存档沿用中立英雄")}
            </span>
            {humanHeroPowerUsedThisTurn && (
              <span className="hero-power-used-label">已使用</span>
            )}
          </div>
        )}
        {systemEvent && (
          <button
            type="button"
            className="hud-lobby-system hud-system-event"
            aria-label={`系统事件 ${systemEvent.name}：${systemEvent.description}`}
            data-testid="system-event-hud"
            title={systemEvent.description}
            onClick={openLobbyOverview}
          >
            <small>系统事件</small>
            <strong>{systemEvent.name}</strong>
            <span>{systemEvent.description}</span>
          </button>
        )}
        {game.lobbySystemsEnabled && (
          <button
            type="button"
            className="hud-lobby-system hud-trinkets"
            aria-label={`查看本局大厅规则。${lobbyOverviewSummary}`}
            data-testid="trinket-hud"
            title={lobbyOverviewSummary}
            onClick={openLobbyOverview}
          >
            <small>大厅规则</small>
            <strong>
              {humanTrinkets.length > 0
                ? humanTrinkets
                    .map((definition) => definition.name)
                    .join(" · ")
                : "尚未开启"}
            </strong>
            <span>
              {nextTrinketRound === null
                ? "小符文与大符文均已生效"
                : game.round < nextTrinketRound
                  ? `第 ${nextTrinketRound} 回合开启下一次选择`
                  : "本回合等待选择"}
              {human.pendingSystemSpellIds.length > 0
                ? ` · ${human.pendingSystemSpellIds.length} 张系统牌等待手牌空位`
                : ""}
            </span>
          </button>
        )}
        <div className="hud-actions">
          <button
            type="button"
            className="action-button secondary"
            disabled={interactionLocked}
            onClick={openRestartDialog}
          >
            重开
          </button>
          <button
            type="button"
            className="action-button primary"
            data-testid="end-turn"
            disabled={
              game.phase !== "recruit" ||
              !started ||
              interactionLocked
            }
            onClick={() => {
              clearCombatRewardFeedback();
              preCombatHandIdsRef.current = new Set(
                human.hand.map((card) => card.instanceId),
              );
              setInfoTab("battle");
              send({ type: "END_TURN" });
            }}
          >
            {game.phase === "recruit" ? "结束回合" : "战斗中"}
          </button>
        </div>
      </header>

      <div
        className="main-grid"
        inert={modalInteractionLocked || combatIntroActive || pageModalOpen}
      >
        <section className="play-column" aria-label="游戏区域">
          <section
            className={`panel shop-panel${
              human.frozen ? " is-frozen" : ""
            }${
              human.spellOnlyRefreshActive ? " is-spell-only" : ""
            }${
              dragSession?.active && dragSession.zone === "board"
                ? " is-sell-ready"
                : ""
            }${
              dragSession?.target?.kind === "sell" ? " is-sell-target" : ""
            }${
              activeRecruitRefresh ? " is-refreshing" : ""
            }${
              activeRecruitMove?.kind === "cardMove" &&
              activeRecruitMove.motion === "board-to-bob"
                ? " is-receiving-sale"
                : ""
            }`}
            aria-label="鲍勃的酒馆"
            aria-hidden={game.phase !== "recruit"}
            inert={interactionLocked || game.phase !== "recruit"}
            data-sell-drop-zone="true"
            data-frozen={human.frozen}
            data-helpful-refreshes={human.helpfulRefreshes}
            data-recruit-motion={
              activeRecruitRefresh ? "shop-refresh" : undefined
            }
            data-testid="sell-drop-zone"
          >
            <div
              className="tavern-keeper"
              data-testid="tavern-keeper"
              role="img"
              aria-label="酒馆老板鲍勃"
              key={
                activeRecruitMove?.kind === "cardMove" &&
                activeRecruitMove.motion === "board-to-bob"
                  ? `keeper-${activeRecruitPresentation?.token ?? 0}`
                  : "keeper"
              }
            >
              <span className="tavern-keeper-portrait" aria-hidden="true">
                鲍
              </span>
              <strong>鲍勃</strong>
            </div>
            {activeRecruitRefresh && (
              <span
                className="shop-refresh-sweep"
                data-free={activeRecruitRefresh.free}
                data-testid="shop-refresh-sweep"
                aria-hidden="true"
                key={`refresh-${activeRecruitPresentation?.token ?? 0}`}
              />
            )}
            <div className="sell-drop-feedback" aria-hidden="true">
              <strong>出售给鲍勃</strong>
              <span>
                松手获得{" "}
                {dragSession?.card.kind === "minion"
                  ? getMinionSellValue(
                      game,
                      human.id,
                      dragSession.card,
                    )
                  : 1}{" "}
                枚金币
              </span>
            </div>
            <div className="panel-title">
              <span>
                鲍勃的酒馆
                <small>
                  随从 3 金币 · 法术按卡面费用 · 本局{" "}
                  {game.activeTribes
                    .map((tribe) => TRIBE_NAMES[tribe])
                    .join(" / ")}
                </small>
              </span>
              <span>
                {human.frozen
                  ? "已冻结"
                  : human.spellOnlyRefreshActive
                    ? `法术专场 · ${tavernSpellShopOffers.length} 张`
                    : human.helpfulRefreshes > 0
                      ? `有用刷新剩余 ${human.helpfulRefreshes} 次${
                          human.lastHelpfulRefreshKind
                            ? ` · ${
                                HELPFUL_REFRESH_LABELS[
                                  human.lastHelpfulRefreshKind
                                ]
                              }`
                            : ""
                        }`
                    : "招募中"}
              </span>
            </div>
            <div className="shop-layout">
              <div className="shop-actions">
                <button
                  type="button"
                  className={`tavern-control${
                    human.tavernTier >= 6 ? "" : ""
                  }`}
                  data-testid="upgrade-tavern"
                  disabled={
                    game.phase !== "recruit" ||
                    interactionLocked ||
                    human.tavernTier >= 6 ||
                    human.gold < upgradeCost
                  }
                  onClick={() => send({ type: "UPGRADE_TAVERN" })}
                >
                  <span className="tavern-control-icon" aria-hidden="true">★</span>
                  <span className="tavern-control-label">
                    <strong>
                      {human.tavernTier >= 6
                        ? "酒馆已满级"
                        : `升至 ${human.tavernTier + 1}星`}
                    </strong>
                  </span>
                  {human.tavernTier < 6 && (
                    <span className="tavern-control-cost">
                      {upgradeCost}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="tavern-control"
                  data-testid="refresh-shop"
                  disabled={
                    game.phase !== "recruit" ||
                    interactionLocked ||
                    refreshQuote?.affordable !== true
                  }
                  onClick={() => send({ type: "REFRESH_SHOP" })}
                >
                  <span className="tavern-control-icon" aria-hidden="true">↻</span>
                  <span className="tavern-control-label">
                    <strong>刷新</strong>
                    {human.freeRefreshes > 0 ? (
                      <span>免费剩余 {human.freeRefreshes}</span>
                    ) : human.heroRefreshAvailable ? (
                      <span>英雄首次免费</span>
                    ) : (refreshQuote?.remainingHealthRefreshes ?? 0) > 0 ? (
                      <span>生命刷新剩余 {refreshQuote?.remainingHealthRefreshes}</span>
                    ) : human.helpfulRefreshes > 0 ? (
                      <span>有用 {human.helpfulRefreshes}</span>
                    ) : null}
                  </span>
                  {refreshCost > 0 && (
                    <span
                      className={`tavern-control-cost${
                        refreshCost === 0 ? " is-free" : ""
                      }${
                        refreshQuote?.currency === "health" ? " is-health" : ""
                      }`}
                    >
                      {refreshCost}
                    </span>
                  )}
                  {refreshCost === 0 && (
                    <span className="tavern-control-cost is-free">免费</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`tavern-control${
                    human.frozen ? " is-active" : ""
                  }`}
                  data-testid="freeze-shop"
                  aria-pressed={human.frozen}
                  disabled={
                    game.phase !== "recruit" || interactionLocked
                  }
                  onClick={() => send({ type: "TOGGLE_FREEZE" })}
                >
                  <span className="tavern-control-icon" aria-hidden="true">❄</span>
                  <span className="tavern-control-label">
                    <strong>{human.frozen ? "已冻结" : "冻结"}</strong>
                    {human.frozen ? <span>点击解冻</span> : <span>保留当前报价</span>}
                  </span>
                  <span className="tavern-control-frost" aria-hidden="true" />
                  <span className="tavern-control-ice-edge" aria-hidden="true" />
                </button>
              </div>
              <div className="card-row" data-testid="shop-row">
                {shopDisplayOffers.map((offer) =>
                  offer.kind === "minion" ? (
                    <UnitCard
                      unit={offer.unit}
                      key={offer.unit.instanceId}
                      purchaseCost={
                        getMinionPurchaseQuote(
                          game,
                          human.id,
                          offer.shopIndex,
                        )?.cost
                      }
                      purchaseCurrency={
                        getMinionPurchaseQuote(
                          game,
                          human.id,
                          offer.shopIndex,
                        )?.currency
                      }
                      selected={
                        selection?.zone === "shop" &&
                        selection.index === offer.shopIndex
                      }
                      unaffordable={
                        !canBuyMinionOffer(offer.shopIndex)
                      }
                      choiceTarget={
                        taughtTavernSpellTargetInteraction?.optionInstanceIds.includes(
                          offer.unit.instanceId,
                        ) === true
                      }
                      disabled={
                        interactionLocked &&
                        !taughtTavernSpellTargetInteraction?.optionInstanceIds.includes(
                          offer.unit.instanceId,
                        )
                      }
                      testId={`shop-card-${offer.shopIndex}`}
                      tavernSpellTarget={activeSpellTargetIds.includes(
                        offer.unit.instanceId,
                      )}
                      spellTargetKind={activeSpellTargetKind}
                      tavernSpellDropTarget={
                        (dragSession?.target?.kind === "tavernSpell" ||
                          dragSession?.target?.kind === "spellcraft") &&
                        dragSession.target.targetInstanceId ===
                          offer.unit.instanceId
                      }
                      tavernSpellCast={
                        tavernSpellCastFeedback?.targetInstanceId ===
                        offer.unit.instanceId
                      }
                      tavernSpellCastLabel={
                        tavernSpellCastFeedback?.targetInstanceId ===
                        offer.unit.instanceId
                          ? tavernSpellCastFeedback.label
                          : undefined
                      }
                      tavernSpellCastToken={
                        tavernSpellCastFeedback?.targetInstanceId ===
                        offer.unit.instanceId
                          ? tavernSpellCastFeedback.token
                          : undefined
                      }
                      dragEnabled={
                        canBuyMinionOffer(offer.shopIndex) &&
                        !activeSpellTargetIds.includes(
                          offer.unit.instanceId,
                        )
                      }
                      dragging={
                        dragSession?.active === true &&
                        dragSession.card.instanceId ===
                          offer.unit.instanceId
                      }
                      dragHandlers={
                        canBuyMinionOffer(offer.shopIndex) &&
                        !activeSpellTargetIds.includes(
                          offer.unit.instanceId,
                        )
                          ? getDragHandlers(
                              {
                                zone: "shop",
                                index: offer.shopIndex,
                              },
                              offer.unit,
                            )
                          : undefined
                      }
                      inspectionHandlers={getCardInspectionHandlers(
                        offer.unit,
                      )}
                      onClick={() => {
                        if (
                          taughtTavernSpellTargetInteraction?.optionInstanceIds.includes(
                            offer.unit.instanceId,
                          )
                        ) {
                          send({
                            type: "RESOLVE_INTERACTION",
                            interactionId:
                              taughtTavernSpellTargetInteraction.interactionId,
                            optionInstanceId: offer.unit.instanceId,
                          });
                          return;
                        }
                        if (
                          selectedSpellcraft &&
                          spellcraftTargetIds.includes(
                            offer.unit.instanceId,
                          )
                        ) {
                          castSpellcraft(
                            selectedSpellcraft.instanceId,
                            offer.unit.instanceId,
                          );
                          return;
                        }
                        if (
                          selectedHandTavernSpell &&
                          tavernSpellTargetIds.includes(
                            offer.unit.instanceId,
                          )
                        ) {
                          castTavernSpell(
                            selectedHandTavernSpell.instanceId,
                            offer.unit.instanceId,
                          );
                          return;
                        }
                        selectCard({
                          zone: "shop",
                          index: offer.shopIndex,
                        });
                      }}
                    />
                  ) : (
                    <div
                      className="shop-spell-slot"
                      data-testid={`tavern-spell-slot-${offer.spellIndex}`}
                      key={offer.spell.instanceId}
                    >
                      <TavernSpellCard
                        card={offer.spell}
                        inShop
                        purchaseCost={
                          getTavernSpellPurchaseQuote(
                            game,
                            human.id,
                            offer.spell.instanceId,
                          )?.cost
                        }
                        purchaseCurrency={
                          getTavernSpellPurchaseQuote(
                            game,
                            human.id,
                            offer.spell.instanceId,
                          )?.currency
                        }
                        selected={
                          selection?.zone === "spellShop" &&
                          selection.index === offer.spellIndex
                        }
                        unaffordable={
                          !canBuyTavernSpellOffer(offer.spell)
                        }
                        disabled={interactionLocked}
                        testId={`tavern-spell-offer-${offer.spellIndex}`}
                        dragging={
                          dragSession?.active === true &&
                          dragSession.card.instanceId ===
                            offer.spell.instanceId
                        }
                        dragHandlers={
                          canBuyTavernSpellOffer(offer.spell)
                            ? getDragHandlers(
                                {
                                  zone: "spellShop",
                                  index: offer.spellIndex,
                                },
                                offer.spell,
                              )
                            : undefined
                        }
                        inspectionHandlers={getCardInspectionHandlers(
                          offer.spell,
                        )}
                        onClick={() =>
                          selectCard({
                            zone: "spellShop",
                            index: offer.spellIndex,
                          })
                        }
                      />
                    </div>
                  ),
                )}
                {shopDisplayOffers.length === 0 && (
                  <div className="empty-state">酒馆暂时没有可购买的牌</div>
                )}
              </div>
            </div>
          </section>

          <section className="panel board-panel" aria-label="战场">
            <div className="panel-title">
              <span>
                {game.phase === "combat" ? "战斗区" : "你的战场"}
                <small>
                  {game.phase === "combat"
                    ? `对阵 ${opponent?.name ?? "克尔苏加德"}`
                    : "随从从左到右依次攻击"}
                </small>
              </span>
              <span>{human.board.length} / 7</span>
            </div>
            <div className="board">
              {game.phase === "combat" && (
                <BoardRow
                  units={opponentBoard}
                  side="enemy"
                  getCardInspectionHandlers={
                    getCardInspectionHandlers
                  }
                  actorInstanceId={
                    currentStrikeEvent?.actorPlayerId === opponentId
                      ? currentStrikeEvent?.actorInstanceId
                      : undefined
                  }
                  targetInstanceId={
                    currentBattleEvent &&
                    currentBattleEvent.type !== "buff" &&
                    currentBattleEvent.type !== "keywordRemoved" &&
                    currentBattleEvent.type !== "summon" &&
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                  attackingInstanceId={
                    currentBattleEvent?.type === "attack" &&
                    currentBattleEvent.actorPlayerId === opponentId
                      ? currentBattleEvent.actorInstanceId
                      : undefined
                  }
                  hitInstanceId={
                    (currentBattleEvent?.type === "damage" ||
                      currentBattleEvent?.type === "shieldBroken") &&
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                  hitLabel={currentHitLabel}
                  shieldBrokenInstanceId={
                    currentBattleEvent?.type === "shieldBroken" &&
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                  deadInstanceId={
                    currentBattleEvent?.type === "death" &&
                    currentBattleEvent.actorPlayerId === opponentId
                      ? currentBattleEvent.actorInstanceId
                      : undefined
                  }
                  startOfCombatInstanceId={
                    currentBattleEvent?.type === "startOfCombat" &&
                    currentBattleEvent.actorPlayerId === opponentId
                      ? currentBattleEvent.actorInstanceId
                      : undefined
                  }
                  avengeInstanceId={
                    currentBattleEvent?.type === "avenge" &&
                    currentBattleEvent.actorPlayerId === opponentId
                      ? currentBattleEvent.actorInstanceId
                      : undefined
                  }
                  triggerInstanceId={
                    (currentBattleEvent?.type === "trigger" ||
                      currentBattleEvent?.type ===
                        "tavernSpellCast") &&
                    currentBattleEvent.actorPlayerId === opponentId
                      ? currentBattleEvent.actorInstanceId
                      : undefined
                  }
                  triggerLabel={currentTriggerLabel}
                  combatEventIndex={currentBattleEvent?.index}
                  buffTargetInstanceId={
                    currentBattleEvent?.type === "buff" &&
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                  buffLabel={currentBuffLabel}
                  debuffTargetInstanceId={
                    currentBattleEvent?.type ===
                      "keywordRemoved" &&
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                  debuffLabel={currentDebuffLabel}
                  summonedInstanceId={
                    currentBattleEvent?.type === "summon" &&
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                  summonLabel={currentSummonLabel}
                  combatCharging={
                    combatChargePhase === "charge" &&
                    currentStrikeEvent?.actorInstanceId !== undefined
                  }
                  combatColliding={
                    combatChargePhase === "collide" &&
                    currentStrikeEvent?.targetInstanceId !== undefined
                  }
                  combatRebounding={
                    combatChargePhase === "rebound" &&
                    currentStrikeEvent?.actorInstanceId !== undefined
                  }
                  combatChargeX={combatChargeVector.x}
                  combatChargeY={combatChargeVector.y}
                  heroPowerTargetIds={
                    humanHeroPowerTargetMode === "board"
                      ? [...heroPowerTargetValidIds]
                      : undefined
                  }
                />
              )}
              {game.phase === "combat" &&
                battle &&
                !combatIntroActive &&
                !battlePlaybackComplete && (
                  <div
                    className="combat-playback"
                    data-event-type={currentBattleEvent?.type}
                    data-testid="combat-playback"
                  >
                    <div
                      className="combat-playback-copy"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <span
                        className="combat-playback-progress"
                        aria-hidden="true"
                      >
                        战斗事件 {revealedBattleEventCount} /{" "}
                        {playbackEventCount}
                      </span>
                      <strong>
                        {currentBattleEvent?.type === "attack" && (
                          <span
                            className="combat-attack-mark"
                            aria-hidden="true"
                          >
                            攻击 →
                          </span>
                        )}
                        {currentBattleEvent?.type ===
                          "startOfCombat" && (
                          <span
                            className="combat-start-of-combat-mark"
                            aria-hidden="true"
                          >
                            开战！
                          </span>
                        )}
                        {currentBattleEvent?.type === "avenge" && (
                          <span
                            className="combat-avenge-mark"
                            aria-hidden="true"
                          >
                            复仇！
                          </span>
                        )}
                        {(currentBattleEvent?.type === "trigger" ||
                          currentBattleEvent?.type ===
                            "tavernSpellCast") && (
                          <span
                            className="combat-trigger-mark"
                            aria-hidden="true"
                          >
                            触发！
                          </span>
                        )}
                        {currentBattleEvent?.message ?? "准备战斗回放…"}
                      </strong>
                    </div>
                    <div
                      className="combat-playback-controls"
                      aria-label="战斗回放控制"
                    >
                      <button
                        type="button"
                        className={`combat-speed-button${
                          battleSpeed === 1 ? " is-active" : ""
                        }`}
                        aria-pressed={battleSpeed === 1}
                        data-testid="battle-speed-1"
                        onClick={() => setBattleSpeed(1)}
                      >
                        1×
                      </button>
                      <button
                        type="button"
                        className={`combat-speed-button${
                          battleSpeed === 2 ? " is-active" : ""
                        }`}
                        aria-pressed={battleSpeed === 2}
                        data-testid="battle-speed-2"
                        onClick={() => setBattleSpeed(2)}
                      >
                        2×
                      </button>
                      <button
                        type="button"
                        className="action-button secondary combat-skip-button"
                        data-testid="skip-battle-animation"
                        onClick={skipBattlePlayback}
                      >
                        跳过动画
                      </button>
                    </div>
                  </div>
                )}
              {game.phase === "combat" &&
                battle &&
                !combatIntroActive &&
                battlePlaybackComplete && (
                  <div className="combat-banner" role="status">
                    <div className="combat-banner-copy">
                      <div className="combat-banner-result">
                        <strong>{resultLabel(battle.resultForHuman)}</strong>
                        <span>
                          {battleDamage > 0
                            ? `${battleDamage} 点英雄伤害`
                            : "双方英雄未受伤害"}
                        </span>
                      </div>
                      {human.alive &&
                        humanCombatRewardOutcomeCount > 0 && (
                        <span
                          className="combat-reward-summary"
                          data-testid="combat-reward-summary"
                        >
                          战斗奖励：
                          {combatRewardSummaryText(humanCombatRewards)}
                        </span>
                        )}
                    </div>
                    <button
                      type="button"
                      className="action-button primary"
                      data-testid="continue-after-combat"
                      onClick={continueAfterCombat}
                    >
                      {human.alive ? "继续招募" : "查看最终名次"}
                    </button>
                  </div>
                )}
              {boardChoiceInteraction && (
                <div
                  className="target-choice-banner"
                  role="status"
                  aria-live="polite"
                  data-purpose={
                    magnetizeTargetInteraction
                      ? "magnetize-discover"
                      : taughtTavernSpellTargetInteraction
                        ? "cast-taught-tavern-spell"
                       : targetInteraction?.resolution?.kind ===
                           "destroyFriendlyAndCopy"
                         ? "destroy-copy"
                        : targetInteraction?.resolution?.kind === "makeGolden"
                          ? "make-golden"
                        : targetInteraction?.grantKeywords?.length
                          ? "keyword-buff"
                          : "buff"
                  }
                  data-testid="target-choice-banner"
                >
                  <strong>
                    {magnetizeTargetInteraction
                      ? `为${targetSource?.name ?? "这张牌"}选择一个友方机械`
                      : taughtTavernSpellTargetInteraction
                        ? `为${targetSource?.name ?? "魔鳍学徒"}选择“${taughtTavernSpellDefinition?.name ?? "酒馆法术"}”的目标`
                       : targetInteraction?.resolution?.kind ===
                           "destroyFriendlyAndCopy"
                         ? `为${targetSource?.name ?? "这张牌"}选择一个友方亡灵`
                        : targetInteraction?.resolution?.kind === "makeGolden"
                          ? `为${targetSource?.name ?? "杉德尔船长"}选择一个等级6或以下的非金色友方随从`
                        : targetInteraction?.grantKeywords?.length
                          ? `为${targetSource?.name ?? "这张牌"}选择一个此前在场的友方野兽`
                          : `为${targetSource?.name ?? "这张牌"}选择一个友方随从`}
                  </strong>
                  <span>
                    {magnetizeTargetInteraction
                      ? `点击发光机械，随后连续发现 ${magnetizeTargetInteraction.remainingDiscoveries} 次并立即吸附`
                      : taughtTavernSpellTargetInteraction
                        ? `点击发光随从，由魔鳍学徒施放“${taughtTavernSpellDefinition?.name ?? "酒馆法术"}”`
                       : targetInteraction?.resolution?.kind ===
                           "destroyFriendlyAndCopy"
                         ? `点击发光亡灵，将其消灭并获取 ${targetInteraction.resolution.copies} 张原始版复制`
                        : targetInteraction?.resolution?.kind === "makeGolden"
                          ? `点击发光随从，使其变为金色${
                              targetInteraction.repetitions > 1
                                ? `（还需选择 ${targetInteraction.repetitions} 个目标）`
                                : ""
                            }`
                       : targetInteraction?.grantKeywords?.includes("reborn")
                        ? `点击发光野兽，使其获得 +${targetInteraction.attack}/+${targetInteraction.health} 和复生`
                      : targetInteraction?.grantKeywords?.includes("windfury")
                        ? `点击发光野兽，使其获得 +${targetInteraction.attack} 攻击力和风怒`
                      : targetInteraction
                        ? `点击发光随从，使其获得 +${
                            targetInteraction.attack *
                            targetInteraction.repetitions
                          }/+${
                            targetInteraction.health *
                            targetInteraction.repetitions
                          }`
                        : ""}
                  </span>
                </div>
              )}
              <BoardRow
                units={friendlyCombatBoard}
                side="friendly"
                getCardInspectionHandlers={getCardInspectionHandlers}
                selection={selection}
                dragSession={dragSession}
                actorInstanceId={
                  currentStrikeEvent?.actorPlayerId === human.id
                    ? currentStrikeEvent?.actorInstanceId
                    : undefined
                }
                targetInstanceId={
                  currentBattleEvent?.type !== "buff" &&
                  currentBattleEvent?.type !== "keywordRemoved" &&
                  currentBattleEvent?.type !== "summon" &&
                  currentBattleEvent?.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                attackingInstanceId={
                  currentBattleEvent?.type === "attack" &&
                  currentBattleEvent.actorPlayerId === human.id
                    ? currentBattleEvent.actorInstanceId
                    : undefined
                }
                hitInstanceId={
                  (currentBattleEvent?.type === "damage" ||
                    currentBattleEvent?.type === "shieldBroken") &&
                  currentBattleEvent.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                hitLabel={currentHitLabel}
                shieldBrokenInstanceId={
                  currentBattleEvent?.type === "shieldBroken" &&
                  currentBattleEvent.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                deadInstanceId={
                  currentBattleEvent?.type === "death" &&
                  currentBattleEvent.actorPlayerId === human.id
                    ? currentBattleEvent.actorInstanceId
                    : undefined
                }
                startOfCombatInstanceId={
                  currentBattleEvent?.type === "startOfCombat" &&
                  currentBattleEvent.actorPlayerId === human.id
                    ? currentBattleEvent.actorInstanceId
                    : undefined
                }
                avengeInstanceId={
                  currentBattleEvent?.type === "avenge" &&
                  currentBattleEvent.actorPlayerId === human.id
                    ? currentBattleEvent.actorInstanceId
                    : undefined
                }
                triggerInstanceId={
                  (currentBattleEvent?.type === "trigger" ||
                    currentBattleEvent?.type ===
                      "tavernSpellCast") &&
                  currentBattleEvent.actorPlayerId === human.id
                    ? currentBattleEvent.actorInstanceId
                    : undefined
                }
                triggerLabel={currentTriggerLabel}
                combatEventIndex={currentBattleEvent?.index}
                buffTargetInstanceId={
                  currentBattleEvent?.type === "buff" &&
                  currentBattleEvent.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                buffLabel={currentBuffLabel}
                debuffTargetInstanceId={
                  currentBattleEvent?.type === "keywordRemoved" &&
                  currentBattleEvent.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                debuffLabel={currentDebuffLabel}
                summonedInstanceId={
                  currentBattleEvent?.type === "summon" &&
                  currentBattleEvent.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                summonLabel={currentSummonLabel}
                combatCharging={
                  combatChargePhase === "charge"
                }
                combatColliding={
                  combatChargePhase === "collide"
                }
                combatRebounding={
                  combatChargePhase === "rebound"
                }
                combatChargeX={combatChargeVector.x}
                combatChargeY={combatChargeVector.y}
                heroPowerTargetIds={
                  humanHeroPowerTargetMode === "board"
                    ? [...heroPowerTargetValidIds]
                    : undefined
                }
                choiceTargetIds={
                  boardChoiceInteraction?.optionInstanceIds
                }
                magneticTargetIds={
                  game.phase === "recruit" && !interactionLocked
                    ? magneticTargetIds
                    : []
                }
                magneticDropTargetId={
                  dragSession?.target?.kind === "magnetic"
                    ? dragSession.target.targetInstanceId
                    : undefined
                }
                bloodGemTargetIds={
                  game.phase === "recruit" && !interactionLocked
                    ? bloodGemTargetIds
                    : []
                }
                bloodGemDropTargetId={
                  dragSession?.target?.kind === "bloodGem"
                    ? dragSession.target.targetInstanceId
                    : undefined
                }
                bloodGemCastFeedback={bloodGemCastFeedback}
                tavernSpellTargetIds={
                  game.phase === "recruit" && !interactionLocked
                    ? activeSpellTargetIds
                    : []
                }
                spellTargetKind={activeSpellTargetKind}
                tavernSpellDropTargetId={
                  dragSession?.target?.kind === "tavernSpell"
                    ? dragSession.target.targetInstanceId
                    : dragSession?.target?.kind === "spellcraft"
                      ? dragSession.target.targetInstanceId
                    : undefined
                }
                tavernSpellCastFeedback={tavernSpellCastFeedback}
                interactionLocked={interactionLocked}
                canDeploy={
                  game.phase === "recruit" &&
                  !interactionLocked &&
                  selection?.zone === "hand" &&
                  selectedUnit?.kind === "minion" &&
                  human.board.length < BOARD_LIMIT
                }
                getDragHandlers={
                  game.phase === "recruit" && !interactionLocked
                    ? getDragHandlers
                    : undefined
                }
                onUnitClick={(index) =>
                  game.phase === "recruit" &&
                  !interactionLocked &&
                  selectCard({ zone: "board", index })
                }
                onChoiceTarget={(instanceId) => {
                  if (!boardChoiceInteraction) return;
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      boardChoiceInteraction.interactionId,
                    optionInstanceId: instanceId,
                  });
                }}
                onMagneticTarget={(targetInstanceId) => {
                  if (!selectedMagneticSource) return;
                  magnetizeCard(
                    selectedMagneticSource.instanceId,
                    targetInstanceId,
                  );
                }}
                onBloodGemTarget={(targetInstanceId) => {
                  if (!selectedBloodGem) return;
                  castBloodGem(
                    selectedBloodGem.instanceId,
                    targetInstanceId,
                  );
                }}
                onTavernSpellTarget={(targetInstanceId) => {
                  if (selectedSpellcraft) {
                    castSpellcraft(
                      selectedSpellcraft.instanceId,
                      targetInstanceId,
                    );
                  } else if (selectedHandTavernSpell) {
                    castTavernSpell(
                      selectedHandTavernSpell.instanceId,
                      targetInstanceId,
                    );
                  }
                }}
                onHeroPowerTarget={onHeroPowerTargetClick}
                onEmptyClick={deploySelected}
              />
              {game.phase === "combat" && currentStrikeEvent && (
                <CombatAttackLink
                  actorInstanceId={
                    currentStrikeEvent.actorInstanceId
                  }
                  targetInstanceId={
                    currentStrikeEvent.targetInstanceId
                  }
                  eventIndex={currentStrikeEvent.index}
                  onChargeVector={setCombatChargeVector}
                />
              )}
              {game.phase === "recruit" &&
                !interactionLocked &&
                human.board.length === 0 && (
                <div className="empty-state board-empty">
                  从手牌选择随从，再点空位上场
                </div>
                )}
            </div>
          </section>

          <section
            className={`panel hand-panel${
              dragSession?.active &&
              (dragSession.zone === "shop" ||
                dragSession.zone === "spellShop")
                ? " is-buy-ready"
                : ""
            }${
              dragSession?.target?.kind === "hand" ? " is-buy-target" : ""
            }${
              (selection?.zone === "shop" ||
                selection?.zone === "spellShop") &&
              buyUnavailableReason
                ? " is-buy-unavailable"
                : ""
            }${
              activeRecruitMove?.kind === "cardMove" &&
              activeRecruitMove.motion === "shop-to-hand"
                ? " is-receiving-purchase"
                : ""
            }`}
            aria-label="手牌"
            aria-hidden={false}
            inert={interactionLocked || game.phase !== "recruit"}
            aria-describedby="buy-drop-description"
            data-drop-cost={selectedOfferCost}
            data-drop-kind="buy"
            data-drop-reason={buyUnavailableReason ?? undefined}
            data-drop-state={
              dragSession?.target?.kind === "hand"
                ? "target"
                : dragSession?.active &&
                    (dragSession.zone === "shop" ||
                      dragSession.zone === "spellShop")
                  ? "ready"
                  : (selection?.zone === "shop" ||
                        selection?.zone === "spellShop") &&
                      buyUnavailableReason
                    ? "unavailable"
                    : "idle"
            }
            data-drop-valid={
              selection?.zone === "spellShop"
                ? canBuyTavernSpell
                : canBuyFromShop
            }
            data-hand-drop-zone="true"
            data-recruit-motion={
              activeRecruitMove?.kind === "cardMove" &&
              activeRecruitMove.motion === "shop-to-hand"
                ? "shop-to-hand"
                : undefined
            }
            data-testid="buy-drop-zone"
          >
            <div className="buy-drop-feedback" aria-hidden="true">
              <strong>
                {(selection?.zone === "shop" ||
                  selection?.zone === "spellShop") &&
                buyUnavailableReason
                  ? "无法购买"
                  : "购买到手牌"}
              </strong>
              <span>
                {(selection?.zone === "shop" ||
                  selection?.zone === "spellShop") &&
                buyUnavailableReason
                  ? buyUnavailableReason
                  : draggedOfferCurrency === "health"
                    ? `松手支付 ${draggedOfferCost} 点生命`
                    : `松手支付 ${draggedOfferCost} 枚金币`}
              </span>
            </div>
            <div className="panel-title">
              <span>
                手牌
                <small>
              随从拖到战场；酒馆法术、普通法术、塑造法术和鲜血宝石拖放施放；三连奖励点击使用
                </small>
              </span>
              <span
                title={
                  human.pendingSpellcraft.length > 0
                    ? `${human.pendingSpellcraft.length} 张塑造法术正在等待手牌空位`
                    : undefined
                }
                data-testid="hand-capacity"
              >
                {human.hand.length} / 10
                {human.pendingSpellcraft.length > 0
                  ? ` · 塑造等待 ${human.pendingSpellcraft.length}`
                  : ""}
              </span>
            </div>
            <div className="card-row" data-testid="hand-row">
              {human.hand.map((card, index) =>
                card.kind === "tripleReward" ? (
                  <TripleRewardCard
                    card={card}
                    key={card.instanceId}
                    inspectionHandlers={getCardInspectionHandlers(card)}
                    testId={`triple-reward-card-${index}`}
                    disabled={interactionLocked}
                    onPlay={() =>
                      send({
                        type: "PLAY_HAND_CARD",
                        cardInstanceId: card.instanceId,
                      })
                    }
                  />
                ) : card.kind === "consolationCoin" ? (
                  <ConsolationCoinCard
                    card={card}
                    key={card.instanceId}
                    inspectionHandlers={getCardInspectionHandlers(card)}
                    testId={`consolation-coin-card-${index}`}
                    disabled={interactionLocked}
                    onPlay={() =>
                      send({
                        type: "PLAY_HAND_CARD",
                        cardInstanceId: card.instanceId,
                      })
                    }
                  />
                ) : card.kind === "bloodGem" ? (
                  <BloodGemCard
                    card={card}
                    attack={human.bloodGemAttack}
                    health={human.bloodGemHealth}
                    key={card.instanceId}
                    selected={
                      selection?.zone === "hand" &&
                      selection.index === index
                    }
                    playable={canDragHandCard(card)}
                    testId={`blood-gem-card-${index}`}
                    disabled={interactionLocked}
                    dragging={
                      dragSession?.active === true &&
                      dragSession.card.instanceId === card.instanceId
                    }
                    dragHandlers={
                      canDragHandCard(card)
                        ? getDragHandlers(
                            { zone: "hand", index },
                            card,
                          )
                        : undefined
                    }
                    inspectionHandlers={getCardInspectionHandlers(card)}
                    onClick={() =>
                      selectCard({ zone: "hand", index })
                    }
                  />
                ) : card.kind === "tavernSpell" ? (
                  <TavernSpellCard
                    card={card}
                    key={card.instanceId}
                    selected={
                      selection?.zone === "hand" &&
                      selection.index === index
                    }
                    playable={canDragHandCard(card)}
                    testId={`tavern-spell-card-${index}`}
                    disabled={interactionLocked}
                    dragging={
                      dragSession?.active === true &&
                      dragSession.card.instanceId === card.instanceId
                    }
                    dragHandlers={
                      canDragHandCard(card)
                        ? getDragHandlers(
                            { zone: "hand", index },
                            card,
                          )
                        : undefined
                    }
                    inspectionHandlers={getCardInspectionHandlers(card)}
                    onClick={() =>
                      selectCard({ zone: "hand", index })
                    }
                  />
                ) : card.kind === "spellcraft" ? (
                  <SpellcraftCard
                    card={card}
                    key={card.instanceId}
                    selected={
                      selection?.zone === "hand" &&
                      selection.index === index
                    }
                    playable={canDragHandCard(card)}
                    testId={`spellcraft-card-${index}`}
                    disabled={interactionLocked}
                    dragging={
                      dragSession?.active === true &&
                      dragSession.card.instanceId === card.instanceId
                    }
                    dragHandlers={
                      canDragHandCard(card)
                        ? getDragHandlers(
                            { zone: "hand", index },
                            card,
                          )
                        : undefined
                    }
                    inspectionHandlers={getCardInspectionHandlers(card)}
                    onClick={() =>
                      selectCard({ zone: "hand", index })
                    }
                  />
                ) : (
                  <UnitCard
                    unit={card}
                    compact
                    key={card.instanceId}
                    selected={
                      selection?.zone === "hand" &&
                      selection.index === index
                    }
                    testId={`hand-card-${index}`}
                    disabled={interactionLocked}
                    newlyGenerated={newCombatRewardIds.includes(
                      card.instanceId,
                    )}
                    locked={
                      (card.playableFromRound ?? 0) > game.round
                    }
                    playable={canDragHandCard(card)}
                    dragEnabled={canDragHandCard(card)}
                    dragging={
                      dragSession?.active === true &&
                      dragSession.card.instanceId === card.instanceId
                    }
                    dragHandlers={
                      canDragHandCard(card)
                        ? getDragHandlers(
                            { zone: "hand", index },
                            card,
                          )
                        : undefined
                    }
                    inspectionHandlers={getCardInspectionHandlers(card)}
                    onClick={() =>
                      selectCard({ zone: "hand", index })
                    }
                  />
                ),
              )}
              {human.hand.length === 0 && (
                <div className="empty-state hand-empty">
                  <span>购买的牌会进入这里</span>
                  <small data-testid="blood-gem-source-hint">
                    {game.activeTribes.includes("quilboar")
                      ? "鲜血宝石不会在酒馆直接出售；通过野猪人随从效果获取。"
                      : "本局未开放野猪人，因此不会出现鲜血宝石；它也不会在酒馆直接出售。"}
                  </small>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside
          className="side-rail"
          aria-label="排名与战报"
          inert={interactionLocked}
        >
          <section className="panel standings-panel">
            <div className="panel-title">
              <span>8 人战局</span>
              <span>{displayedAlivePlayerCount} 存活</span>
            </div>
            <div className="standings" data-testid="standings">
              {standings.map((player, index) => {
                const scoutingReport =
                  player.id === game.humanPlayerId
                    ? null
                    : getHumanScoutingReport(game, player.id);
                return (
                  <PlayerRow
                    player={player}
                    humanId={game.humanPlayerId}
                    opponentId={highlightedOpponentId}
                    opponentLabel={
                      game.phase === "recruit"
                        ? "下轮对手"
                        : "本轮对手"
                    }
                    opponentIsGhost={
                      game.phase === "recruit"
                        ? (scheduledHumanOpponent?.isGhost ?? false)
                        : (battle?.isGhost ?? false)
                    }
                    selected={
                      selectedStandingPlayerId === player.id &&
                      infoTab === "scouting"
                    }
                    observedBoardCount={scoutingReport?.board.length}
                    observedRound={scoutingReport?.observedRound}
                    displayHealth={
                      game.phase === "combat" && battle
                        ? player.id === human.id
                          ? displayedHumanHealth
                          : player.id === opponentId
                            ? (displayedOpponentHealth ?? undefined)
                            : undefined
                        : undefined
                    }
                    displayArmor={
                      game.phase === "combat" && battle
                        ? projectedStandingArmor(player)
                        : player.armor
                    }
                    displayAlive={
                      game.phase === "combat" &&
                      battle &&
                      (player.id === human.id ||
                        player.id === opponentId)
                        ? (player.id === human.id
                            ? displayedHumanHealth
                            : (displayedOpponentHealth ??
                              player.health)) > 0
                        : undefined
                    }
                    takingHeroDamage={
                      currentHeroDamageTargetId === player.id
                    }
                    disabled={!scoutingResultRevealed}
                    onSelect={() => selectStandingPlayer(player.id)}
                    rank={index + 1}
                    key={player.id}
                  />
                );
              })}
            </div>
          </section>

          <section
            className={`panel info-panel${infoOpen ? " is-open" : ""}`}
            data-open={infoOpen}
            aria-label="随从详情、侦察与战报"
          >
            <div className="tabs" role="tablist" aria-label="信息切换">
              <button
                type="button"
                className={`tab${infoTab === "details" ? " is-active" : ""}`}
                role="tab"
                aria-selected={infoTab === "details"}
                onClick={() => setInfoTab("details")}
              >
                详情
              </button>
              <button
                type="button"
                className={`tab${
                  infoTab === "scouting" ? " is-active" : ""
                }`}
                role="tab"
                aria-selected={infoTab === "scouting"}
                disabled={!scoutingResultRevealed}
                onClick={() => {
                  setSelection(null);
                  setSelectedStandingPlayerId(
                    selectedStandingPlayerId ??
                      highlightedOpponentId ??
                      human.id,
                  );
                  setInfoTab("scouting");
                }}
              >
                侦察
              </button>
              <button
                type="button"
                className={`tab${infoTab === "battle" ? " is-active" : ""}`}
                role="tab"
                aria-selected={infoTab === "battle"}
                onClick={() => setInfoTab("battle")}
              >
                战报
              </button>
              <button
                type="button"
                className="mobile-info-close"
                aria-label="关闭详情面板"
                onClick={() => {
                  setSelection(null);
                  setSelectedStandingPlayerId(null);
                  setInfoTab("details");
                }}
              >
                关闭
              </button>
            </div>

            {infoTab === "details" ? (
              <div className="details-content">
                {selectedSpellcraft ? (
                  <>
                    <CardArtwork
                      key={selectedSpellcraft.instanceId}
                      unit={selectedSpellcraft}
                      kind="detail"
                    />
                    <h2>{selectedSpellcraft.name}</h2>
                    <p className="detail-meta">
                      0 费{spellcraftDisplayLabel(selectedSpellcraft)}
                      {selectedSpellcraft.spellFamily === "spellcraft"
                        ? " · 回合结束时未使用会消失"
                        : " · 可以保留在手牌中"}
                    </p>
                    <p>{selectedSpellcraft.description}</p>
                    <p
                      className="tavern-spell-play-hint"
                      data-testid="spellcraft-selection-hint"
                      role="status"
                    >
                      {spellcraftNeedsTarget(selectedSpellcraft)
                        ? spellcraftTargetIds.length > 0
                          ? selectedSpellcraft.target === "shop"
                            ? `点击任意发光的酒馆随从，或把法术拖到目标上施放。当前有 ${spellcraftTargetIds.length} 个合法目标。`
                            : `点击任意发光的友方随从，或把法术拖到目标上施放。当前有 ${spellcraftTargetIds.length} 个合法目标。`
                          : "当前没有合法随从目标；法术会留在手牌中。"
                        : "点击下方按钮施放，或把法术拖到战场区域。"}
                    </p>
                    <div className="detail-keywords">
                      <span>{spellcraftDisplayLabel(selectedSpellcraft)}</span>
                      <span>0费</span>
                      {selectedSpellcraft.spellFamily === "spellcraft" ? (
                        <span>回合结束消失</span>
                      ) : (
                        <span>不会在回合结束时消失</span>
                      )}
                      {spellcraftNeedsTarget(selectedSpellcraft) && (
                        <span>需要目标</span>
                      )}
                    </div>
                    <div className="detail-actions">
                      <button
                        type="button"
                        className="action-button primary"
                        data-testid="cast-selected-spellcraft"
                        disabled={
                          interactionLocked ||
                          spellcraftNeedsTarget(selectedSpellcraft)
                        }
                        onClick={() =>
                          castSpellcraft(selectedSpellcraft.instanceId)
                        }
                      >
                        {spellcraftNeedsTarget(selectedSpellcraft)
                          ? selectedSpellcraft.target === "shop"
                            ? "请选择发光的酒馆随从"
                            : "请选择发光随从"
                          : `施放${spellcraftDisplayLabel(selectedSpellcraft)}`}
                      </button>
                    </div>
                  </>
                ) : selectedTavernSpell ? (
                  <>
                    <CardArtwork
                      key={selectedTavernSpell.instanceId}
                      unit={selectedTavernSpell}
                      kind="detail"
                    />
                    <h2>{selectedTavernSpell.name}</h2>
                    <p className="detail-meta">
                      {selectedTavernSpell.tier} 级酒馆法术 ·{" "}
                      {selectedTavernSpellDisplayCost}{" "}
                      {(selection?.zone === "spellShop"
                        ? selectedOfferCurrency
                        : tavernSpellPurchaseCurrency(
                            selectedTavernSpell,
                          )) === "health"
                        ? "点生命"
                        : "枚金币"}
                    </p>
                    <p>{selectedTavernSpell.description}</p>
                    {selectedTavernSpellDefinition?.effectSupport ===
                      "partial" && (
                      <p
                        className="rules-support-note"
                        data-testid="partial-tavern-spell-rules-note"
                      >
                        {
                          selectedTavernSpellDefinition.implementationNote
                        }
                      </p>
                    )}
                    {selection?.zone === "hand" && (
                      <p
                        className="tavern-spell-play-hint"
                        data-testid="tavern-spell-selection-hint"
                        role="status"
                      >
                        {tavernSpellNeedsTarget(selectedTavernSpell)
                          ? tavernSpellTargetIds.length > 0
                            ? `点击任意发光随从，或把法术拖到目标上施放。当前有 ${tavernSpellTargetIds.length} 个合法目标${
                                tavernSpellCanTargetShop(
                                  selectedTavernSpell,
                                )
                                  ? "（战场或酒馆）"
                                  : ""
                              }。`
                            : "当前没有合法随从目标；法术会留在手牌中。"
                          : "点击下方按钮施放，或把法术拖到战场区域。"}
                      </p>
                    )}
                    <div className="detail-keywords">
                      <span>酒馆法术</span>
                      <span>一次性</span>
                      {tavernSpellNeedsTarget(selectedTavernSpell) && (
                        <span>需要目标</span>
                      )}
                    </div>
                    <div className="detail-actions">
                      {selection?.zone === "spellShop" && (
                        <button
                          type="button"
                          className="action-button primary"
                          data-testid="buy-selected-tavern-spell"
                          disabled={!selectedCanBuy}
                          onClick={() =>
                            send({
                              type: "BUY_TAVERN_SPELL",
                              spellInstanceId:
                                selectedTavernSpell.instanceId,
                            })
                          }
                        >
                          购买 · {selectedOfferCost}
                          {selectedOfferCurrency === "health"
                            ? " 生命"
                            : " 金币"}
                        </button>
                      )}
                      {selection?.zone === "hand" && (
                        <button
                          type="button"
                          className="action-button primary"
                          data-testid="cast-selected-tavern-spell"
                          disabled={
                            interactionLocked ||
                            tavernSpellNeedsTarget(
                              selectedTavernSpell,
                            )
                          }
                          onClick={() =>
                            castTavernSpell(
                              selectedTavernSpell.instanceId,
                            )
                          }
                        >
                          {tavernSpellNeedsTarget(selectedTavernSpell)
                            ? "请选择发光随从"
                            : "施放法术"}
                        </button>
                      )}
                    </div>
                  </>
                ) : selectedBloodGem ? (
                  <>
                    <CardArtwork
                      key={selectedBloodGem.instanceId}
                      unit={selectedBloodGem}
                      kind="detail"
                    />
                    <h2>鲜血宝石</h2>
                    <p className="detail-meta">
                      0 费法术 · 当前效果 +{human.bloodGemAttack}/+
                      {human.bloodGemHealth}
                    </p>
                    <p>
                      使一个友方随从永久获得+
                      {human.bloodGemAttack}/+{human.bloodGemHealth}。
                      {bloodGemBonusText(selectedBloodGem)}
                    </p>
                    <p
                      className="blood-gem-play-hint"
                      data-testid="blood-gem-selection-hint"
                      role="status"
                    >
                      {human.board.length > 0
                        ? `点击任意发光的友方随从，或把宝石拖到目标上使用。当前有 ${human.board.length} 个合法目标。`
                        : "场上没有友方随从；鲜血宝石会留在手牌中。"}
                    </p>
                    <div className="detail-keywords">
                      <span>鲜血宝石</span>
                      <span>永久增益</span>
                      <span>不是酒馆法术</span>
                    </div>
                  </>
                ) : selectedUnit ? (
                  <>
                    <CardArtwork
                      key={`${selectedUnit.instanceId}-${selectedUnit.golden}`}
                      unit={selectedUnit}
                      kind="detail"
                    />
                    <h2>{selectedUnit.name}</h2>
                    <p className="detail-meta">
                      {selectedUnit.tier} 级 ·{" "}
                      {printedTribeLabel(selectedUnit)} · ATK{" "}
                      {selectedUnit.attack} / HP {selectedUnit.health}
                    </p>
                    <p>{selectedUnit.description}</p>
                    {(selectedUnit.playableFromRound ?? 0) >
                      game.round && (
                      <p
                        className="turn-lock-note"
                        data-testid="selected-minion-turn-lock"
                      >
                        这张牌还会锁定
                        {Math.max(
                          1,
                          (selectedUnit.playableFromRound ?? game.round) -
                            game.round,
                        )}
                        个回合；达到可用回合后才能打出或磁力吸附。
                      </p>
                    )}
                    {selectedUnit.effectSupport === "partial" && (
                      <p
                        className="rules-support-note"
                        data-testid="partial-rules-note"
                      >
                        本地版已结算这张牌的基础属性与卡面关键词；专属文字效果仍在逐张适配。
                      </p>
                    )}
                    <div className="detail-keywords">
                      {isMagneticMinion(selectedUnit) && <span>磁力</span>}
                      {selectedUnit.taunt && <span>嘲讽</span>}
                      {selectedUnit.stealth && <span>潜行</span>}
                      {selectedUnit.divineShield && <span>圣盾</span>}
                      {selectedUnit.reborn && <span>复生</span>}
                      {selectedUnit.poisonous && <span>剧毒</span>}
                      {selectedUnit.venomous && <span>烈毒</span>}
                      {selectedUnit.windfury && <span>风怒</span>}
                      {selectedUnit.cleave && <span>顺劈</span>}
                      {selectedUnit.golden && <span>金色随从</span>}
                      {(selectedUnit.playableFromRound ?? 0) >
                        game.round && <span>本回合锁定</span>}
                      {selectedUnit.attachments.length > 0 && (
                        <span>
                          已吸附{" "}
                          {countMagneticAttachments(
                            selectedUnit.attachments,
                          )}
                        </span>
                      )}
                    </div>
                    {selectedUnit.attachments.length > 0 && (
                      <section
                        className="magnetic-attachments"
                        aria-label="磁力附件"
                      >
                        <h3>
                          磁力附件 ·{" "}
                          {countMagneticAttachments(
                            selectedUnit.attachments,
                          )}
                        </h3>
                        <MagneticAttachmentList
                          attachments={selectedUnit.attachments}
                        />
                      </section>
                    )}
                    {selection?.zone === "hand" &&
                      selectedMagneticSource && (
                        <p
                          className="magnetic-play-hint"
                          data-testid="magnetic-selection-hint"
                          role="status"
                        >
                          {selectedMagneticTargetIds.length > 0
                            ? boardHasOpenSlot
                              ? `场上有 ${selectedMagneticTargetIds.length} 个可吸附目标。点击标有“可吸附”的随从，或把它作为普通随从上场。`
                              : `场上有 ${selectedMagneticTargetIds.length} 个可吸附目标。战场已满，只能点击标有“可吸附”的随从。`
                            : boardHasOpenSlot
                              ? "场上暂时没有可吸附目标，仍可把它作为普通随从上场。"
                              : "战场已满，且当前没有可吸附目标。"}
                        </p>
                      )}
                    <div className="detail-actions">
                      {selection?.zone === "shop" && (
                        <button
                          type="button"
                          className="action-button primary"
                          data-testid="buy-selected"
                          disabled={!selectedCanBuy}
                          onClick={() =>
                            send({
                              type: "BUY_MINION",
                              shopIndex: selection.index,
                            })
                          }
                        >
                          购买 · {minionPurchaseCost}
                          {selectedOfferCurrency === "health"
                            ? " 生命"
                            : " 金币"}
                        </button>
                      )}
                      {selection?.zone === "hand" && (
                        <button
                          type="button"
                          className="action-button primary"
                          data-testid="play-selected"
                          disabled={!selectedCanPlay}
                          onClick={() => deploySelected()}
                        >
                          作为随从上场
                        </button>
                      )}
                      {selection?.zone === "board" && (
                        <>
                          <button
                            type="button"
                          className="action-button secondary"
                          disabled={
                            interactionLocked || selection.index === 0
                          }
                            onClick={() =>
                              send({
                                type: "MOVE_MINION",
                                fromIndex: selection.index,
                                toIndex: selection.index - 1,
                              })
                            }
                          >
                            向左移
                          </button>
                          <button
                            type="button"
                            className="action-button secondary"
                          disabled={
                            interactionLocked ||
                            selection.index >= human.board.length - 1
                          }
                            onClick={() =>
                              send({
                                type: "MOVE_MINION",
                                fromIndex: selection.index,
                                toIndex: selection.index + 1,
                              })
                            }
                          >
                            向右移
                          </button>
                          <button
                            type="button"
                          className="action-button danger"
                          data-testid="sell-selected"
                          disabled={interactionLocked}
                            onClick={() =>
                              send({
                                type: "SELL_MINION",
                                boardIndex: selection.index,
                              })
                            }
                          >
                            出售 +{
                              getMinionSellValue(
                                game,
                                human.id,
                                selectedUnit,
                              )
                            }
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state details-empty">
                    <strong>选择一个随从</strong>
                    <span>查看属性、能力与可用操作</span>
                  </div>
                )}
              </div>
            ) : infoTab === "scouting" ? (
              <div
                className="scouting-content"
                data-testid="scouting-panel"
              >
                {selectedStandingPlayer && selectedVisibleWarband ? (
                  <>
                    <header className="scouting-identity">
                      <span
                        className="scouting-avatar"
                        aria-hidden="true"
                      >
                        {selectedStandingPlayer.name.slice(0, 1)}
                      </span>
                      <span>
                        <small>
                          {selectedStandingPlayer.isHuman
                            ? "本机玩家"
                            : getAiStrategyProfile(
                                selectedStandingPlayer.id,
                              ).label}
                        </small>
                        <strong>{selectedStandingPlayer.name}</strong>
                        <span>
                          {selectedStandingPlayer.alive
                            ? `${selectedStandingPlayer.tavernTier} 星酒馆`
                            : `第 ${
                                selectedStandingPlayer.placement ?? "?"
                              } 名`}
                          {" · "}生命{" "}
                          {Math.max(
                            0,
                            projectedStandingHealth(
                              selectedStandingPlayer,
                            ),
                          )}
                          {projectedStandingArmor(
                            selectedStandingPlayer,
                          ) > 0
                            ? ` · 护甲 ${projectedStandingArmor(
                                selectedStandingPlayer,
                              )}`
                            : ""}
                        </span>
                      </span>
                      {selectedStandingPlayer.id ===
                        highlightedOpponentId && (
                        <span className="scouting-next-badge">
                          {game.phase === "recruit"
                            ? "下轮对手"
                            : "本轮对手"}
                          {(game.phase === "recruit"
                            ? scheduledHumanOpponent?.isGhost
                            : battle?.isGhost)
                            ? " · 幽灵"
                            : ""}
                        </span>
                      )}
                    </header>

                    <section className="scouting-result">
                      <h3>上一轮结果</h3>
                      {!scoutingResultRevealed ? (
                        <p>战斗回放结束后揭晓。</p>
                      ) : selectedLastRoundResult ? (
                        <>
                          <strong
                            data-result={selectedLastRoundResult.result}
                          >
                            {resultLabel(selectedLastRoundResult.result)}
                          </strong>
                          <p>
                            对阵 {selectedLastRoundResult.opponentName}
                            {selectedLastRoundResult.isGhost
                              ? "（幽灵）"
                              : ""}
                            {" · "}
                            {selectedLastRoundResult.damageDealt > 0
                              ? `造成 ${selectedLastRoundResult.damageDealt} 点英雄伤害`
                              : selectedLastRoundResult.damageTaken > 0
                                ? `承受 ${selectedLastRoundResult.damageTaken} 点英雄伤害`
                                : "双方均未受到英雄伤害"}
                          </p>
                        </>
                      ) : (
                        <p>尚无可展示的战斗结果。</p>
                      )}
                    </section>

                    <section className="scouting-warband">
                      <div className="scouting-section-title">
                        <h3>
                          {selectedVisibleWarband.visibility === "own"
                            ? "当前战队"
                            : "最后见到的战队"}
                        </h3>
                        {selectedVisibleWarband.observedRound !== null && (
                          <span>
                            第 {selectedVisibleWarband.observedRound} 回合
                          </span>
                        )}
                      </div>
                      {selectedVisibleWarband.visibility === "unknown" ? (
                        <div
                          className="empty-state scouting-unknown"
                          data-testid="scouting-warband-unknown"
                        >
                          <strong>阵容未知</strong>
                          <span>
                            你尚未与该玩家交手；不会读取其当前隐藏战队。
                          </span>
                        </div>
                      ) : selectedVisibleWarband.board.length > 0 ? (
                        <div
                          className="scouting-board"
                          data-testid="scouting-warband"
                        >
                          {selectedVisibleWarband.board.map(
                            (minion, index) => (
                              <UnitCard
                                unit={minion}
                                compact
                                disabled
                                testId={`scouting-minion-${index}`}
                                key={minion.instanceId}
                              />
                            ),
                          )}
                        </div>
                      ) : (
                        <div className="empty-state scouting-unknown">
                          当时没有随从。
                        </div>
                      )}
                    </section>

                    {selectedVisibleWarband.visibility === "observed" && (
                      <p className="scouting-privacy-note">
                        仅显示你第{" "}
                        {selectedScoutingReport?.observedRound ??
                          selectedVisibleWarband.observedRound}{" "}
                        回合亲眼见到的开战阵容；对手之后的购买、出售和站位均保持隐藏。
                      </p>
                    )}
                  </>
                ) : (
                  <div className="empty-state details-empty">
                    <strong>选择一名玩家</strong>
                    <span>查看公开状态、上一轮结果与已见阵容</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="battle-log"
                aria-live={
                  game.phase === "combat" && !battlePlaybackComplete
                    ? "off"
                    : "polite"
                }
              >
                {revealedBattleLogEvents.length ? (
                  revealedBattleLogEvents.slice(-80).map((event) => (
                    <p key={`${battle?.round ?? "battle"}-${event.index}`}>
                      <strong>{event.index + 1}</strong> {event.message}
                    </p>
                  ))
                ) : battle && game.phase === "combat" ? (
                  <div className="empty-state">战斗回放准备中…</div>
                ) : (
                  <div className="empty-state">
                    点击“结束回合”后，7 名 AI 会完成招募并自动战斗。
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      {combatIntroActive && battle && introOpponent && (
        <section
          className="combat-start-intro"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`第 ${battle.round} 回合，开始战斗，对阵${
            introOpponent.opponentIsGhost ? "幽灵" : ""
          }${introOpponent.opponentName}`}
          data-testid="combat-start-intro"
        >
          <div className="combat-start-stage">
            <span className="combat-start-round">
              第 {battle.round} 回合
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="combat-start-emblem"
              src="/ui/battle-crossed-weapons.webp"
              alt=""
              draggable={false}
            />
            <div className="combat-start-banner">
              <strong>开始战斗</strong>
              <span>
                对阵{" "}
                {introOpponent.opponentIsGhost ? "幽灵 · " : ""}
                {introOpponent.opponentName}
              </span>
              {introOpponent.opponentIsGhost && (
                <small>
                  幽灵不会受到伤害
                </small>
              )}
            </div>
            <span className="combat-start-status">
              正在切换至战斗阵型
            </span>
          </div>
        </section>
      )}

      <span className="sr-only" id="drag-instructions">
        可按住并拖动。商店随从拖到手牌区域购买；普通手牌拖到战场插位线上场；磁力随从拖到标有“可吸附”的友方随从进行吸附，拖到插位线则普通上场；场上随从可拖动换位，或拖到鲍勃的酒馆出售。也可点击卡牌后使用详情面板中的按钮。
      </span>
      <span className="sr-only" id="magnetic-target-instructions">
        这是当前磁力牌的合法目标。点击或按回车键即可完成吸附；按 Escape 键取消选择。
      </span>
      <span className="sr-only" id="blood-gem-target-instructions">
        这是当前鲜血宝石的合法目标。点击或按回车键即可使用；按 Escape 键取消选择。
      </span>
      <span className="sr-only" id="tavern-spell-target-instructions">
        这是当前酒馆法术的合法目标。点击或按回车键即可施放；按 Escape 键取消选择。
      </span>
          <span className="sr-only" id="spellcraft-target-instructions">
            这是当前所选法术的合法目标。点击或按回车键即可施放；按 Escape 键取消选择。
          </span>
      <span className="sr-only" id="buy-drop-description">
        购买随从需要 {minionPurchaseCost}
        {selectedOfferCurrency === "health" ? "点生命" : "枚金币"}
        ；饰品可能把随从或酒馆法术的费用改为生命值。生命购买必须保留至少1点生命，且购买时手牌必须未满；也可点击卡牌后使用详情面板中的购买按钮。
      </span>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {interactionAnnouncement}
      </span>

      {!interactionLocked &&
        !combatIntroActive &&
        cardInspection &&
        cardInspectionLayout && (
          <CardInspectionPreview
            inspection={cardInspection}
            layout={cardInspectionLayout}
            bloodGemAttack={human.bloodGemAttack}
            bloodGemHealth={human.bloodGemHealth}
          />
        )}

      {aimedSpellPath && (
        <svg
          className={`spell-aim-arrow${
            aimedSpellHasValidTarget ? " is-valid" : ""
          }`}
          width="100%"
          height="100%"
          aria-hidden="true"
          data-testid="spell-aim-arrow"
        >
          <defs>
            <marker
              id="spell-aim-arrowhead"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 12 6 L 0 12 z" />
            </marker>
          </defs>
          <path
            className="spell-aim-arrow-path"
            d={aimedSpellPath}
            markerEnd="url(#spell-aim-arrowhead)"
          />
        </svg>
      )}

      {game.phase === "recruit" && combatRewardNotice && (
        <div
          className="toast combat-reward-toast"
          role="status"
          aria-live="polite"
          data-testid="combat-reward-toast"
        >
          <strong>
            {combatRewardNotice.addedCount > 0
              ? `本轮战斗获得 ${combatRewardNotice.addedCount} 张卡牌`
              : "本轮战斗未获得卡牌"}
          </strong>
          <span>
            {[
              combatRewardNotice.addedNames.length > 0
                ? `战斗获取：${combatRewardNotice.addedNames.join("、")}`
                : null,
              combatRewardNotice.handFullCount > 0
                ? `${combatRewardNotice.handFullCount} 张因手牌已满未获得`
                : null,
              combatRewardNotice.noCandidateCount > 0
                ? `${combatRewardNotice.noCandidateCount} 次随从池无可用候选`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      )}

      {activeRecruitPresentation && (
        <div
          className="toast recruit-feedback-toast"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-action={activeRecruitAction}
          data-event-kinds={activeRecruitPresentation.events
            .map((event) => event.kind)
            .join(" ")}
          data-presentation-queue-length={
            recruitPresentationQueue.length
          }
          data-presentation-token={activeRecruitPresentation.token}
          data-testid="recruit-feedback"
          key={`feedback-${activeRecruitPresentation.token}`}
        >
          <strong>{recruitFeedbackTitle}</strong>
          <span>{activeRecruitPresentation.announcement}</span>
        </div>
      )}

      {activeRecruitMove?.kind === "cardMove" &&
        activeRecruitMotion && (
          <div
            className={`${
              activeRecruitMove.card.kind === "minion"
                ? "unit-card is-compact"
                : "tavern-spell-card is-shop-offer"
            } recruit-card-motion`}
            aria-hidden="true"
            data-card-instance-id={activeRecruitMove.card.instanceId}
            data-recruit-motion={activeRecruitMove.motion}
            data-testid="recruit-card-motion"
            key={`motion-${activeRecruitPresentation?.token ?? 0}`}
            style={
              {
                "--card-hue":
                  activeRecruitMove.card.kind === "minion"
                    ? TRIBE_HUE[activeRecruitMove.card.tribe]
                    : 266,
                "--recruit-travel-x": `${activeRecruitMotion.travelX}px`,
                "--recruit-travel-y": `${activeRecruitMotion.travelY}px`,
                left: activeRecruitMotion.fromLeft,
                top: activeRecruitMotion.fromTop,
                width: activeRecruitMotion.fromWidth,
                height: activeRecruitMotion.fromHeight,
                maxWidth: "none",
              } as CSSProperties
            }
          >
            {activeRecruitMove.card.kind === "minion" ? (
              <UnitCardFace unit={activeRecruitMove.card} />
            ) : (
              <TavernSpellCardFace
                card={activeRecruitMove.card}
                inShop
                purchaseCost={activeRecruitMove.purchaseCost}
                purchaseCurrency={activeRecruitMove.purchaseCurrency}
              />
            )}
          </div>
        )}

      {activeRecruitTriples.length > 0 && (
        <div
          className="recruit-triple-stage"
          data-testid="triple-forge"
          aria-hidden="true"
          key={`triple-${activeRecruitPresentation?.token ?? 0}`}
        >
          {activeRecruitTriples.map((event, index) => (
            <div
              className="recruit-triple-forge"
              data-known-consumed-count={
                event.knownConsumedInstanceIds.length
              }
              data-golden-instance-id={event.golden.instanceId}
              key={event.golden.instanceId}
              style={{ "--triple-index": index } as CSSProperties}
            >
              <span className="recruit-triple-rays" />
              <div
                className="unit-card recruit-triple-card"
                style={
                  {
                    "--card-hue": TRIBE_HUE[event.golden.tribe],
                  } as CSSProperties
                }
              >
                <UnitCardFace unit={event.golden} />
              </div>
              <strong>三连！</strong>
              <span>{event.golden.name}</span>
            </div>
          ))}
        </div>
      )}

      {dragSession?.active && liftedDragPreview && (
        <div
          className={`${
            dragSession.card.kind === "bloodGem"
              ? "blood-gem-card"
              : dragSession.card.kind === "tavernSpell"
                ? "tavern-spell-card"
                : dragSession.card.kind === "spellcraft"
                  ? "tavern-spell-card spellcraft-card"
              : "unit-card is-compact"
          }${
            dragSession.card.kind === "spellcraft" &&
            (dragSession.card.effectMultiplier ?? 1) > 1
              ? " is-golden"
              : ""
          } is-dragging drag-ghost${
            liftedDragPreview.directTouch
              ? " is-direct-touch-drag"
              : ""
          }`}
          aria-hidden="true"
          data-testid="drag-ghost"
          data-pointer-type={dragSession.pointerType}
          style={
            {
              "--card-hue":
                dragSession.card.kind === "minion"
                  ? TRIBE_HUE[dragSession.card.tribe]
                  : dragSession.card.kind === "tavernSpell"
                    ? 266
                    : dragSession.card.kind === "spellcraft"
                      ? 222
                    : TRIBE_HUE.quilboar,
              left: liftedDragPreview.left,
              top: liftedDragPreview.top,
              width: liftedDragPreview.width,
              height: liftedDragPreview.height,
              maxWidth: "none",
            } as CSSProperties
          }
        >
          {dragSession.card.kind === "bloodGem" ? (
            <BloodGemCardFace
              card={dragSession.card}
              attack={human.bloodGemAttack}
              health={human.bloodGemHealth}
            />
          ) : dragSession.card.kind === "tavernSpell" ? (
            <TavernSpellCardFace
              card={dragSession.card}
              inShop={dragSession.zone === "spellShop"}
              purchaseCost={draggedOfferCost}
              purchaseCurrency={draggedOfferCurrency}
            />
          ) : dragSession.card.kind === "spellcraft" ? (
            <SpellcraftCardFace card={dragSession.card} />
          ) : (
            <UnitCardFace unit={dragSession.card} />
          )}
        </div>
      )}

      {heroChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-choice-title"
          aria-describedby="hero-choice-description"
          data-testid="hero-choice-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal lobby-choice-modal hero-choice-modal">
            <span className="discover-kicker">开局 · 四选一</span>
            <h2 className="discover-title" id="hero-choice-title">
              选择你的英雄
            </h2>
            <p className="discover-copy" id="hero-choice-description">
              每位英雄拥有不同的被动英雄技能。选择会立即保存，并用于本局余下时间。
            </p>
            {systemEvent && (
              <div
                className="lobby-event-banner"
                data-testid="hero-choice-system-event"
              >
                <CardArtwork unit={systemEvent} kind="portrait" />
                <span>
                  <small>本局随机系统事件</small>
                  <strong>{systemEvent.name}</strong>
                  <span>{systemEvent.description}</span>
                </span>
              </div>
            )}
            <div className="lobby-choice-options hero-choice-options">
              {heroChoiceInteraction.optionIds.map((optionId, index) => {
                const option = getHeroDefinition(optionId);
                const power = getHeroPowerDefinition(option.heroPowerId);
                return (
                  <button
                    type="button"
                    className="lobby-choice-card hero-choice-card"
                    data-testid={`hero-choice-${index}`}
                    key={option.id}
                    onClick={() =>
                      send({
                        type: "RESOLVE_INTERACTION",
                        interactionId: heroChoiceInteraction.interactionId,
                        optionInstanceId: option.id,
                      })
                    }
                  >
                    <CardArtwork unit={option} kind="portrait" />
                    <small>英雄</small>
                    <strong>{option.name}</strong>
                    <span className="lobby-choice-power-name">
                      {power.name}
                    </span>
                    <span>{power.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {trinketChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trinket-choice-title"
          aria-describedby="trinket-choice-description"
          data-testid="trinket-choice-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal lobby-choice-modal trinket-choice-modal">
            <span className="discover-kicker">
              第 {game.round} 回合 ·
              {trinketChoiceInteraction.trinketTier === "lesser"
                ? " 小符文"
                : " 大符文"}
            </span>
            <h2 className="discover-title" id="trinket-choice-title">
              {isMysteryCubeTrinketChoice
                ? "神秘魔方 · 选择新的次级饰品"
                : `选择一个${
                    trinketChoiceInteraction.trinketTier === "lesser"
                      ? "次级饰品"
                      : "强效饰品"
                  }`}
            </h2>
            <p className="discover-copy" id="trinket-choice-description">
              {isMysteryCubeTrinketChoice ? (
                "从两个新的次级饰品中选择一个，免费替换神秘魔方；以后每个回合开始时会再次替换。"
              ) : (
                <>
                  本局从
                  {ACTIVE_TRINKET_DEFINITIONS.filter(
                    (definition) =>
                      definition.tier ===
                      trinketChoiceInteraction.trinketTier,
                  ).length}
                  件
                  {trinketChoiceInteraction.trinketTier === "lesser"
                    ? "次级"
                    : "强效"}
                  饰品中随机生成四个候选，选择一个并支付标示费用。类型专属饰品只会在你的战队拥有该类型时出现，所占比例越高，进入候选的概率越大；完成选择前其他酒馆操作保持锁定。
                </>
              )}
            </p>
            <div className="lobby-choice-options trinket-choice-options">
              {trinketChoiceInteraction.optionIds.map(
                (optionId, index) => {
                  const option = getTrinketDefinition(optionId);
                  const affordable =
                    isMysteryCubeTrinketChoice || human.gold >= option.cost;
                  return (
                    <button
                      type="button"
                      className="lobby-choice-card trinket-choice-card"
                      data-testid={`trinket-choice-${index}`}
                      disabled={!affordable}
                      key={option.id}
                      onClick={() =>
                        send({
                          type: "RESOLVE_INTERACTION",
                          interactionId:
                            trinketChoiceInteraction.interactionId,
                          optionInstanceId: option.id,
                        })
                      }
                    >
                      <CardArtwork unit={option} kind="portrait" />
                      <small>
                        {option.tier === "lesser"
                          ? "次级饰品"
                          : "强效饰品"}
                      </small>
                      <strong>{option.name}</strong>
                      <span className="trinket-choice-tribes">
                        {option.associatedTribes.length > 0
                          ? `专属类型：${option.associatedTribes
                              .map((tribe) => TRIBE_NAMES[tribe])
                              .join(" / ")}`
                          : "无类型饰品"}
                      </span>
                      <span>{option.description}</span>
                      <span className="lobby-choice-cost">
                        {isMysteryCubeTrinketChoice
                          ? `免费替换 · 原价 ${option.cost} 枚铸币`
                          : `${option.cost} 枚铸币${
                              !affordable ? " · 当前不足" : ""
                            }`}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      )}

      {minionChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="minion-choice-title"
          aria-describedby="minion-choice-description"
          data-testid={
            isBuddingBotanistChoice
              ? "budding-botanist-dialog"
              : isAdaptableBeetleChoice
                ? "adaptable-beetle-dialog"
                : "fearless-foodie-dialog"
          }
          onKeyDown={trapModalFocus}
        >
          <div className="modal minion-choice-modal">
            <span className="discover-kicker">抉择 · 随从</span>
            <h2 className="discover-title" id="minion-choice-title">
              {isBuddingBotanistChoice
                ? "新锐植物学家 · 选择酒馆法术路线"
                : isAdaptableBeetleChoice
                  ? "机变甲虫 · 选择强化路线"
                  : "无畏的食客 · 选择鲜血宝石路线"}
            </h2>
            <p
              className="discover-copy"
              id="minion-choice-description"
            >
              没有倒计时。选择只结算一次，不会被布莱恩重复；完成前其他酒馆操作保持锁定。
            </p>
            <div className="minion-choice-options">
              <button
                type="button"
                className="minion-choice"
                data-testid={
                  isBuddingBotanistChoice
                    ? "budding-botanist-attack"
                    : isAdaptableBeetleChoice
                      ? "adaptable-beetle-reborn"
                      : "fearless-foodie-improve"
                }
                onClick={() =>
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      minionChoiceInteraction.interactionId,
                    optionInstanceId:
                      minionChoiceInteraction.optionIds[0],
                  })
                }
              >
                <CardArtwork
                  unit={{
                    cardId: minionChoiceInteraction.optionIds[0],
                    name: isBuddingBotanistChoice
                      ? "纯净百合"
                      : isAdaptableBeetleChoice
                        ? "机变精修"
                        : "大吃特吃",
                  }}
                  kind="portrait"
                />
                {isBuddingBotanistChoice ? (
                  <>
                    <strong>纯净百合</strong>
                    <span>
                      本局酒馆法术使随从额外获得 +
                      {minionChoiceInteraction.effectMultiplier} 攻击力。
                    </span>
                    <small>
                      永久攻击加成将变为 +
                      {human.tavernSpellAttackBonus +
                        minionChoiceInteraction.effectMultiplier}
                    </small>
                  </>
                ) : isAdaptableBeetleChoice ? (
                  <>
                    <strong>机变精修</strong>
                    <span>
                      使一只此前在场的友方野兽获得 +
                      {minionChoiceInteraction.effectMultiplier}/+
                      {minionChoiceInteraction.effectMultiplier} 和复生。
                    </span>
                    <small>选择后点击发光野兽；机变甲虫自己不能成为目标</small>
                  </>
                ) : (
                  <>
                    <strong>大吃特吃</strong>
                    <span>
                      本局鲜血宝石额外获得 +
                      {minionChoiceInteraction.effectMultiplier}/+
                      {minionChoiceInteraction.effectMultiplier}。
                    </span>
                    <small>
                      当前宝石将变为 +
                      {human.bloodGemAttack +
                        minionChoiceInteraction.effectMultiplier}
                      /+
                      {human.bloodGemHealth +
                        minionChoiceInteraction.effectMultiplier}
                    </small>
                  </>
                )}
              </button>
              <button
                type="button"
                className="minion-choice"
                data-testid={
                  isBuddingBotanistChoice
                    ? "budding-botanist-health"
                    : isAdaptableBeetleChoice
                      ? "adaptable-beetle-windfury"
                      : "fearless-foodie-gain"
                }
                onClick={() =>
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      minionChoiceInteraction.interactionId,
                    optionInstanceId:
                      minionChoiceInteraction.optionIds[1],
                  })
                }
              >
                <CardArtwork
                  unit={{
                    cardId: minionChoiceInteraction.optionIds[1],
                    name: isBuddingBotanistChoice
                      ? "巨硕滴露"
                      : isAdaptableBeetleChoice
                        ? "机变加强"
                        : "餐盘装满",
                  }}
                  kind="portrait"
                />
                {isBuddingBotanistChoice ? (
                  <>
                    <strong>巨硕滴露</strong>
                    <span>
                      本局酒馆法术使随从额外获得 +
                      {minionChoiceInteraction.effectMultiplier} 生命值。
                    </span>
                    <small>
                      永久生命加成将变为 +
                      {human.tavernSpellHealthBonus +
                        minionChoiceInteraction.effectMultiplier}
                    </small>
                  </>
                ) : isAdaptableBeetleChoice ? (
                  <>
                    <strong>机变加强</strong>
                    <span>
                      使一只此前在场的友方野兽获得 +
                      {4 * minionChoiceInteraction.effectMultiplier}{" "}
                      攻击力和风怒。
                    </span>
                    <small>选择后点击发光野兽；已有风怒仍会获得攻击力</small>
                  </>
                ) : (
                  <>
                    <strong>餐盘装满</strong>
                    <span>
                      获取 {4 * minionChoiceInteraction.effectMultiplier}{" "}
                      张鲜血宝石。
                    </span>
                    <small>手牌已满时，超出上限的宝石不会进入手牌</small>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {spellcraftChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spellcraft-choice-title"
          aria-describedby="spellcraft-choice-description"
          data-testid="escape-eruption-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal tavern-spell-choice-modal">
            <span className="discover-kicker">抉择 · 塑造法术</span>
            <h2
              className="discover-title"
              id="spellcraft-choice-title"
            >
              躲避喷发 · 选择永久增益
            </h2>
            <p
              className="discover-copy"
              id="spellcraft-choice-description"
            >
              没有倒计时。选择完成前，酒馆中的其他操作会保持锁定。
            </p>
            <div className="tavern-spell-choice-options">
              <button
                type="button"
                className="tavern-spell-choice"
                data-testid="escape-eruption-attack"
                onClick={() =>
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      spellcraftChoiceInteraction.interactionId,
                    optionInstanceId: "escapeEruptionAttack",
                  })
                }
              >
                <strong>喷发攻击</strong>
                <span>
                  使你当前的所有随从永久获得 +
                  {escapeEruptionAmount} 攻击力。
                </span>
              </button>
              <button
                type="button"
                className="tavern-spell-choice"
                data-testid="escape-eruption-health"
                onClick={() =>
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      spellcraftChoiceInteraction.interactionId,
                    optionInstanceId: "escapeEruptionHealth",
                  })
                }
              >
                <strong>躲避防守</strong>
                <span>
                  使你当前的所有随从永久获得 +
                  {escapeEruptionAmount} 生命值。
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {tavernSpellChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tavern-spell-choice-title"
          aria-describedby="tavern-spell-choice-description"
          data-testid="time-management-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal tavern-spell-choice-modal">
            <span className="discover-kicker">抉择</span>
            <h2
              className="discover-title"
              id="tavern-spell-choice-title"
            >
              时间管理 · 选择生效时机
            </h2>
            <p
              className="discover-copy"
              id="tavern-spell-choice-description"
            >
              没有倒计时。选择完成前，酒馆中的其他操作会保持锁定。
            </p>
            <div className="tavern-spell-choice-options">
              <button
                type="button"
                className="tavern-spell-choice"
                data-testid="time-management-now"
                onClick={() =>
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      tavernSpellChoiceInteraction.interactionId,
                    optionInstanceId: "timeManagementNow",
                  })
                }
              >
                <strong>立即生效</strong>
                <span>使你当前的所有随从获得 +2/+2。</span>
                <small>现在提高下一场战斗的战力</small>
              </button>
              <button
                type="button"
                className="tavern-spell-choice"
                data-testid="time-management-next-turn"
                onClick={() =>
                  send({
                    type: "RESOLVE_INTERACTION",
                    interactionId:
                      tavernSpellChoiceInteraction.interactionId,
                    optionInstanceId:
                      "timeManagementNextTurn",
                  })
                }
              >
                <strong>留到下回合</strong>
                <span>
                  下个招募回合开始时，使届时场上的所有随从获得
                  +2/+2，触发两次。
                </span>
                <small>合计 +4/+4，但本场战斗不生效</small>
              </button>
            </div>
          </div>
        </div>
      )}

      {heroPowerChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-power-choice-title"
          aria-describedby="hero-power-choice-description"
          data-testid="hero-power-choice-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal hero-power-choice-modal">
            <span className="discover-kicker">发现 · 英雄技能</span>
            <h2
              className="discover-title"
              id="hero-power-choice-title"
            >
              身份揭晓 · 选择一个新的英雄技能
            </h2>
            <p
              className="discover-copy"
              id="hero-power-choice-description"
            >
              没有倒计时。选择后会替换你当前的英雄技能，并在本局余下时间持续生效。
            </p>
            <div className="hero-power-choice-options">
              {heroPowerChoiceInteraction.optionIds.map(
                (optionId, index) => {
                  const option = getHeroPowerDefinition(optionId);
                  return (
                    <button
                      type="button"
                      className="hero-power-choice"
                      data-testid={`hero-power-choice-${index}`}
                      key={option.id}
                      onClick={() =>
                        send({
                          type: "RESOLVE_INTERACTION",
                          interactionId:
                            heroPowerChoiceInteraction.interactionId,
                          optionInstanceId: option.id,
                        })
                      }
                    >
                      <CardArtwork unit={option} kind="portrait" />
                      <span className="hero-power-choice-type">
                        {heroPowerCanBeManuallyActivated(option.id)
                          ? "主动英雄技能"
                          : "被动英雄技能"}
                      </span>
                      <strong>{option.name}</strong>
                      <span className="hero-power-choice-copy">
                        {option.description}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      )}

      {discoverInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discover-title"
          data-discover-destination={
            discoverInteraction.destination.kind
          }
          data-testid="discover-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal discover-modal">
            <span className="discover-kicker">发现</span>
            <h2 className="discover-title" id="discover-title">
              {discoverTitle}
            </h2>
            <p className="discover-copy">
              {discoverInteraction.destination.kind === "transform"
                ? "选择后，目标会变形为所选随从；原随从和另外两张候选会回到共享随从池。"
                : discoverInteraction.destination.kind ===
                    "customUndeadFirst"
                  ? "先从三个战斗组件中选择一个。候选是制造用组件，不会占用共享随从池。"
                  : discoverInteraction.destination.kind ===
                      "customUndeadSecond"
                    ? "再从三个功能组件中选择一个；两个组件的属性、关键词与可组合效果会制造成一张无法三连的亡灵牌。"
              : discoverInteraction.destination.kind === "magnetize"
                ? "选择后会立即吸附到目标，不会进入手牌；其余候选会回到共享随从池。"
                : discoverInteraction.destination.kind === "hand" &&
                    discoverInteraction.destination
                      .destroyAfterPlayThroughRound !== undefined
                  ? "选择一张加入手牌；本回合打出时会先完成入场效果，随后死亡并触发亡语。组成三连会清除死亡预言。"
                  : discoverInteraction.selectionEffect?.kind === "setStats"
                    ? "选择一张加入手牌并将其属性值变为30/30；另外两张会回到共享随从池。"
                    : isKaleidoscopeDiscover
                      ? discoverInteraction.selectionEffect?.kind ===
                        "makeGolden"
                        ? "选择一个金色等级7随从加入手牌。它将在手牌中锁定两回合，达到可用回合后才能打出；这些候选不占用共享随从池。"
                        : "选择一个等级7随从加入手牌。它将在手牌中锁定两回合，达到可用回合后才能打出；这些候选不占用共享随从池。"
                    : discoverInteraction.selectionEffect?.kind ===
                        "rememberTrinketMinion"
                      ? "选择一张加入手牌；口袋工厂会在以后每个回合开始时获取一张它的复制。"
                      : "选择一张加入手牌；另外两张会回到共享随从池。"}
            </p>
            {discoverInteraction.destination.kind === "magnetize" && (
              <div
                className="discover-destination"
                data-testid="discover-magnetize-target"
              >
                <span>吸附目标</span>
                <strong>
                  {discoverMagnetizeTarget?.name ?? "目标机械"}
                </strong>
                <small>
                  当前{" "}
                  {discoverMagnetizeTarget?.attack ?? "?"}/
                  {discoverMagnetizeTarget?.health ?? "?"}
                </small>
              </div>
            )}
            <div className="discover-options">
              {discoverInteraction.options.map((option, index) => (
                <div className="discover-option" key={option.instanceId}>
                  <UnitCard
                    unit={option}
                    testId={`discover-option-${index}`}
                    onClick={() => {
                      if (
                        discoverInteraction.destination.kind ===
                          "magnetize" &&
                        discoverInteraction.remainingDiscoveries === 1
                      ) {
                        magneticFocusTargetRef.current =
                          discoverInteraction.destination.targetInstanceId;
                        setMagneticAnnouncement(
                          `已将发现的${option.name}吸附到${
                            discoverMagnetizeTarget?.name ?? "目标机械"
                          }，贡献 +${option.attack}/+${option.health}`,
                        );
                      }
                      send({
                        type: "RESOLVE_INTERACTION",
                        interactionId:
                          discoverInteraction.interactionId,
                        optionInstanceId: option.instanceId,
                      });
                    }}
                  />
                  <div className="discover-option-summary">
                    <span>
                      {option.tier} 级 · {printedTribeLabel(option)} · ATK{" "}
                      {option.attack} / HP {option.health}
                    </span>
                    <p>{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {discoverInteraction.remainingDiscoveries > 1 && (
              <p className="discover-progress" role="status">
                {discoverInteraction.destination.kind === "magnetize"
                  ? `还需为${
                      discoverMagnetizeTarget?.name ?? "目标机械"
                    }选择 ${discoverInteraction.remainingDiscoveries} 次`
                  : `还需选择 ${discoverInteraction.remainingDiscoveries} 次`}
              </p>
            )}
          </div>
        </div>
      )}

      {darkmoonPrizeDiscoverInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="darkmoon-prize-discover-title"
          data-testid="darkmoon-prize-discover-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal discover-modal">
            <span className="discover-kicker">发现</span>
            <h2
              className="discover-title"
              id="darkmoon-prize-discover-title"
            >
              发现等级3暗月奖品
            </h2>
            <p className="discover-copy">
              从随机出现的三张等级3暗月奖品中选择一张加入手牌。
            </p>
            <div className="discover-options">
              {darkmoonPrizeDiscoverInteraction.options.map(
                (option, index) => (
                  <div
                    className="discover-option"
                    key={option.instanceId}
                  >
                    <SpellcraftCard
                      card={option}
                      testId={`darkmoon-prize-discover-option-${index}`}
                      onClick={() => {
                        send({
                          type: "RESOLVE_INTERACTION",
                          interactionId:
                            darkmoonPrizeDiscoverInteraction.interactionId,
                          optionInstanceId: option.instanceId,
                        });
                      }}
                    />
                    <div className="discover-option-summary">
                      <span>等级3暗月奖品</span>
                      <p>{option.description}</p>
                    </div>
                  </div>
                ),
              )}
            </div>
            {darkmoonPrizeDiscoverInteraction.remainingDiscoveries > 1 && (
              <p className="discover-progress" role="status">
                还需选择{" "}
                {darkmoonPrizeDiscoverInteraction.remainingDiscoveries} 次
              </p>
            )}
          </div>
        </div>
      )}

      {tavernSpellDiscoverInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tavern-spell-discover-title"
          data-testid="tavern-spell-discover-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal discover-modal">
            <span className="discover-kicker">发现</span>
            <h2
              className="discover-title"
              id="tavern-spell-discover-title"
            >
              发现酒馆法术
            </h2>
            <p className="discover-copy">
              选择一张加入手牌；竞技表演者可以发现当前牌池中的任意等级酒馆法术。
            </p>
            <div className="discover-options">
              {tavernSpellDiscoverInteraction.options.map(
                (option, index) => (
                  <div
                    className="discover-option"
                    key={option.instanceId}
                  >
                    <TavernSpellCard
                      card={option}
                      testId={`tavern-spell-discover-option-${index}`}
                      onClick={() => {
                        send({
                          type: "RESOLVE_INTERACTION",
                          interactionId:
                            tavernSpellDiscoverInteraction.interactionId,
                          optionInstanceId: option.instanceId,
                        });
                      }}
                    />
                    <div className="discover-option-summary">
                      <span>
                        {option.tier} 级 · {option.cost} 枚铸币
                      </span>
                      <p>{option.description}</p>
                    </div>
                  </div>
                ),
              )}
            </div>
            {tavernSpellDiscoverInteraction.remainingDiscoveries > 1 && (
              <p className="discover-progress" role="status">
                还需选择 {tavernSpellDiscoverInteraction.remainingDiscoveries}{" "}
                次
              </p>
            )}
          </div>
        </div>
      )}

      {!started && loaded && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="start-game-title"
          aria-describedby="start-game-description"
          onKeyDown={trapModalFocus}
        >
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              startInitialGame();
            }}
          >
            <span className="modal-kicker">非官方本地单人版本</span>
            <h1 id="start-game-title">酒馆战棋 · 单机版</h1>
            <p id="start-game-description">
              你将与 7 名 AI 对战。没有回合倒计时，由你决定何时结束招募并进入战斗。
            </p>
            <div className="modal-features">
              <span>8 人战局</span>
              <span>36.0.3 · 237 随从 · 65 法术数据</span>
              <span>每局开放 5 个种族</span>
              <span>开局 4 选 1 英雄</span>
              <span>第 6 / 9 回合符文选择</span>
              <span>随机系统事件</span>
              <span>鼠标与触控拖拽</span>
              <span>三连奖励与发现</span>
              <span>磁力吸附</span>
            </div>
            <InitialHealthControl
              value={initialHealthInput}
              onChange={setInitialHealthInput}
              onConfirm={startInitialGame}
              inputTestId="initial-health-input"
              autoFocus
            />
            <button
              type="submit"
              className="action-button primary"
              data-testid="start-game"
              disabled={configuredInitialHealth === null}
            >
              开始新局
            </button>
          </form>
        </div>
      )}

      {showRestart && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="restart-game-title"
          aria-describedby="restart-game-description"
          onKeyDown={(event) => {
            trapModalFocus(event);
            if (event.key === "Escape") {
              closeRestartDialog();
            }
          }}
        >
          <form
            className="modal"
            onSubmit={(event) => {
              event.preventDefault();
              startFreshGame();
            }}
          >
            <h2 id="restart-game-title">设置并重新开始？</h2>
            <p id="restart-game-description">
              当前进度会被新的八人战局覆盖，你可以先调整所有玩家的初始生命值。
            </p>
            <InitialHealthControl
              value={initialHealthInput}
              onChange={setInitialHealthInput}
              onConfirm={startFreshGame}
              inputTestId="restart-initial-health-input"
              autoFocus
            />
            <div className="modal-actions">
              <button
                type="button"
                className="action-button secondary"
                onClick={closeRestartDialog}
              >
                取消
              </button>
              <button
                type="submit"
                className="action-button danger"
                data-testid="confirm-restart"
                disabled={configuredInitialHealth === null}
              >
                重开本局
              </button>
            </div>
          </form>
        </div>
      )}

      {showLobbyOverview && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lobby-overview-title"
          aria-describedby="lobby-overview-description"
          data-testid="lobby-overview-dialog"
          onKeyDown={(event) => {
            trapModalFocus(event);
            if (event.key === "Escape") {
              closeLobbyOverview();
            }
          }}
        >
          <div className="modal lobby-overview-modal">
            <span className="modal-kicker">本局持续生效</span>
            <h2 id="lobby-overview-title">英雄、符文与系统事件</h2>
            <p id="lobby-overview-description">
              可随时从顶部的“大厅规则”入口回看本局效果。
            </p>
            <div className="lobby-overview-sections">
              <section>
                <small>系统事件</small>
                <strong>{systemEvent?.name ?? "无"}</strong>
                <p>{systemEvent?.description ?? "本局没有启用系统事件。"}</p>
              </section>
              <section>
                <small>{humanHero?.name ?? "英雄技能"}</small>
                <strong>{humanHeroPower?.name ?? "无"}</strong>
                <p>
                  {humanHeroPowerStatus ??
                    (game.lobbySystemsEnabled
                      ? "尚未选择英雄。"
                      : "旧存档沿用中立英雄。")}
                </p>
              </section>
              <section>
                <small>符文 · 饰品</small>
                {humanTrinkets.length > 0 ? (
                  <ul>
                    {humanTrinkets.map((definition) => (
                      <li key={definition.id}>
                        <strong>{definition.name}</strong>
                        <span>{humanTrinketDescription(definition)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    尚未选择；小符文在第 {LESSER_TRINKET_ROUND}
                    回合、大符文在第 {GREATER_TRINKET_ROUND} 回合开启。
                  </p>
                )}
              </section>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="action-button primary"
                data-testid="close-lobby-overview"
                autoFocus
                onClick={closeLobbyOverview}
              >
                返回酒馆
              </button>
            </div>
          </div>
        </div>
      )}

      {game.phase === "gameOver" && !showRestart && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          onKeyDown={trapModalFocus}
        >
          <div className="modal">
            <span className="modal-kicker">
              {game.winnerId === game.humanPlayerId ? "酒馆战棋胜利" : "战局结束"}
            </span>
            <h1>
              {game.winnerId === game.humanPlayerId
                ? "你赢得了战局"
                : `最终第 ${human.placement ?? 8} 名`}
            </h1>
            <p>
              坚持 {game.round} 回合，最终战场保留 {human.board.length} 个随从。
            </p>
            <button
              type="button"
              className="action-button primary"
              data-testid="play-again"
              onClick={openRestartDialog}
            >
              设置下一局
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
