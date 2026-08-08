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
  getHeroPowerActivationQuote,
  getScheduledOpponent,
  getMinionPurchaseCost,
  getMinionPurchaseQuote,
  getMinionSellValue,
  getMaximumTavernTier,
  getSoloCombatDamageCap,
  getTavernRefreshQuote,
  getHeroDefinition,
  getHeroPowerDefinition,
  getHeroSecretDefinition,
  getHeroPowerProgressText,
  getSystemEventDefinition,
  heroPowerCanBeManuallyActivated,
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
  isPersistedSecretChoiceInteraction,
  persistedGalakrondDiscoverMatchesPlayer,
  persistedSecretChoiceMatchesPlayer,
} from "../lib/game/client-save";
import {
  CURRENT_ROSTER_VERSION,
  TRIBE_NAMES,
  getMinionDefinition,
} from "../lib/game/content";
import { isTierThreeDarkmoonPrizeDefinitionId } from "../lib/game/darkmoon-prizes";
import {
  combatBuffLabel,
  combatDamageCapLabel,
  combatIntroOpponent,
  combatPlaybackRevealCountForEvent,
  combatPlaybackSessionSnapshot,
  combatTriggerLabel,
  createCombatPlaybackState,
  createCombatPlaybackTimeline,
  projectCombatArmor,
  projectCombatHealth,
  resumeCombatPlayback,
  transitionCombatPlayback,
  type CombatPlaybackAction,
  type CombatPlaybackState,
} from "../lib/game/combat-presentation";
import {
  combatEntryStageDuration,
  createCombatEntryPresentation,
  transitionCombatEntryPresentation,
  type CombatEntryPresentationState,
} from "../lib/game/combat-entry-presentation";
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
  createDiscoverChoicePresentation,
  discoverChoicePresentationDuration,
  findDiscoverTripleReward,
  transitionDiscoverChoicePresentation,
  type DiscoverChoicePresentationState,
} from "../lib/game/discover-choice-presentation";
import {
  createHeroChoicePresentation,
  heroChoicePresentationDuration,
  transitionHeroChoicePresentation,
  type HeroChoicePresentationState,
} from "../lib/game/hero-choice-presentation";
import {
  createHeroPowerPresentation,
  heroPowerPresentationAnnouncement,
  heroPowerPresentationDuration,
  transitionHeroPowerPresentation,
  type HeroPowerPresentationState,
} from "../lib/game/hero-power-presentation";
import {
  createTrinketChoicePresentation,
  transitionTrinketChoicePresentation,
  trinketChoicePresentationDuration,
  type TrinketChoicePresentationState,
} from "../lib/game/trinket-choice-presentation";
import {
  createTripleForgePresentation,
  transitionTripleForgePresentation,
  tripleForgePresentationDuration,
  tripleForgeStageAnnouncement,
  type TripleForgePresentationState,
} from "../lib/game/triple-forge-presentation";
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
  groupRecruitPresentationEvents,
  recruitPresentationAnnouncement,
  recruitPresentationDuration,
  type RecruitPresentationEvent,
} from "../lib/game/recruit-presentation";
import {
  createRecruitEntryPresentation,
  recruitEntryAnnouncement,
  recruitEntryStageDuration,
  transitionRecruitEntryPresentation,
  type RecruitEntryPresentationState,
} from "../lib/game/recruit-entry-presentation";
import {
  createSpellCastPresentation,
  spellCastPresentationAnnouncement,
  spellCastPresentationDuration,
  transitionSpellCastPresentation,
  type SpellCastPresentationState,
} from "../lib/game/spell-cast-presentation";
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
  "hearthstone-battlegrounds-local.combat-playback.v2";
const LEGACY_COMBAT_PLAYBACK_SESSION_KEY =
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

function readCombatPlaybackSession(
  timeline: Parameters<typeof resumeCombatPlayback>[0],
): CombatPlaybackState | null {
  for (const key of [
    COMBAT_PLAYBACK_SESSION_KEY,
    LEGACY_COMBAT_PLAYBACK_SESSION_KEY,
  ]) {
    const raw = safeReadSessionStorage(key);
    if (!raw) continue;
    try {
      const resumed = resumeCombatPlayback(
        timeline,
        JSON.parse(raw) as unknown,
      );
      if (resumed) return resumed;
      safeRemoveSessionStorage(key);
    } catch {
      safeRemoveSessionStorage(key);
    }
  }
  return null;
}

function clearCombatPlaybackSession(): void {
  safeRemoveSessionStorage(COMBAT_PLAYBACK_SESSION_KEY);
  safeRemoveSessionStorage(LEGACY_COMBAT_PLAYBACK_SESSION_KEY);
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

type BattleSpeed = 1 | 2 | 4;

type CombatPresentationStage = "intro" | "playback" | "result";

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

type SpellCastMotionGeometry = {
  fromLeft: number;
  fromTop: number;
  fromWidth: number;
  fromHeight: number;
  liftX: number;
  liftY: number;
  releaseX: number;
  releaseY: number;
  travelX: number;
  travelY: number;
  impactLeft: number;
  impactTop: number;
  impactWidth: number;
  impactHeight: number;
  impactScope: "target" | "board";
};

type SpellCastPresentationView = {
  state: SpellCastPresentationState;
  card: TavernSpellInstance | SpellcraftSpellInstance;
  targetCard: BoardMinionInstance | null;
  motion: SpellCastMotionGeometry;
};

type HeroPowerPresentationGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type HeroPowerPresentationTargetView = {
  instanceId: string;
  name: string;
  zone: "shop" | "board";
  geometry: HeroPowerPresentationGeometry;
};

type HeroPowerPresentationView = {
  state: HeroPowerPresentationState;
  geometry: HeroPowerPresentationGeometry;
  target: HeroPowerPresentationTargetView | null;
};

type RecruitMotionGeometry = {
  fromLeft: number;
  fromTop: number;
  fromWidth: number;
  fromHeight: number;
  travelX: number;
  travelY: number;
};

type RecruitTripleHandoffGeometry = {
  travelX: number;
  travelY: number;
};

type RecruitPresentationBatch = {
  token: number;
  events: RecruitPresentationEvent[];
  announcement: string;
  motion: RecruitMotionGeometry | null;
  tripleForge: TripleForgePresentationState | null;
  tripleHandoff: RecruitTripleHandoffGeometry | null;
};

type DiscoverPresentationOption =
  | {
      kind: "minion";
      card: BoardMinionInstance;
    }
  | {
      kind: "tavernSpell";
      card: TavernSpellInstance;
    }
  | {
      kind: "darkmoonPrize";
      card: SpellcraftSpellInstance;
    };

type DiscoverRewardStrategy =
  | "selected"
  | "generatedMinion"
  | "shopReplace"
  | "immediate";

type DiscoverChoicePresentationView = {
  state: DiscoverChoicePresentationState;
  title: string;
  copy: string;
  options: readonly DiscoverPresentationOption[];
  rewardCard: DiscoverPresentationOption | null;
  outcomeLabel: string;
  rewardStrategy: DiscoverRewardStrategy;
  shopTarget: HeroPowerPresentationTargetView | null;
  handTravelX: number;
  handTravelY: number;
  shopTravelX: number;
  shopTravelY: number;
};

type PendingDiscoverRecruitPresentation = {
  events: RecruitPresentationEvent[];
  motion: RecruitMotionGeometry | null;
};

type SendGameActionOptions = {
  deferRecruitPresentation?: boolean;
};

type ResolveDiscoverChoicePresentationInput = {
  interactionId: string;
  options: readonly DiscoverPresentationOption[];
  selectedOptionId: string;
  title: string;
  copy: string;
  rewardStrategy: DiscoverRewardStrategy;
  shopTargetInstanceId?: string;
};

function snapshotDiscoverPresentationOption(
  option: DiscoverPresentationOption,
): DiscoverPresentationOption {
  if (option.kind === "minion") {
    return { kind: "minion", card: { ...option.card } };
  }
  if (option.kind === "tavernSpell") {
    return { kind: "tavernSpell", card: { ...option.card } };
  }
  return { kind: "darkmoonPrize", card: { ...option.card } };
}

function discoverHandTravel(): { x: number; y: number } {
  const handRow = document.querySelector<HTMLElement>(
    '[data-testid="hand-row"]',
  );
  if (!handRow) {
    return { x: 0, y: Math.max(180, window.innerHeight * 0.32) };
  }
  const handRect = handRow.getBoundingClientRect();
  return {
    x: handRect.left + handRect.width / 2 - window.innerWidth / 2,
    y:
      handRect.top +
      Math.min(handRect.height / 2, 72) -
      window.innerHeight / 2,
  };
}

function trinketHudTravel(
  tier: "lesser" | "greater",
): { x: number; y: number } {
  const target = document.querySelector<HTMLElement>(
    `[data-testid="trinket-hud-slot-${tier}"]`,
  );
  if (!target) {
    return {
      x: Math.max(180, window.innerWidth * 0.32),
      y: -Math.max(180, window.innerHeight * 0.32),
    };
  }
  const targetRect = target.getBoundingClientRect();
  return {
    x:
      targetRect.left +
      targetRect.width / 2 -
      window.innerWidth / 2,
    y:
      targetRect.top +
      targetRect.height / 2 -
      window.innerHeight / 2,
  };
}

type PendingRecruitEntryFeedback = {
  rewardNotice: CombatRewardSummary | null;
  rewardIds: string[];
  presentationEvents: RecruitPresentationEvent[];
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

function handCardElementForPresentation(
  instanceId: string,
): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    '[data-testid^="hand-card-"][data-unit-instance-id]',
  );
  for (const candidate of candidates) {
    if (candidate.dataset.unitInstanceId === instanceId) {
      return candidate;
    }
  }
  return null;
}

function captureSpellCastMotion(
  cardInstanceId: string,
  targetInstanceId?: string,
): SpellCastMotionGeometry {
  const viewportWidth = Math.max(1, window.innerWidth);
  const viewportHeight = Math.max(1, window.innerHeight);
  const source = cardElementForPresentation(cardInstanceId);
  const measuredSource = source?.getBoundingClientRect();
  const hasMeasuredSource =
    measuredSource !== undefined &&
    measuredSource.width > 0 &&
    measuredSource.height > 0;
  const fromWidth = hasMeasuredSource
    ? measuredSource.width
    : Math.min(132, Math.max(88, viewportWidth * 0.13));
  const fromHeight = hasMeasuredSource
    ? measuredSource.height
    : fromWidth * 1.42;
  const fromLeft = hasMeasuredSource
    ? measuredSource.left
    : viewportWidth / 2 - fromWidth / 2;
  const fromTop = hasMeasuredSource
    ? measuredSource.top
    : viewportHeight - fromHeight - 24;

  const board = document.querySelector<HTMLElement>(
    '[data-board-drop-zone="true"]',
  );
  const impactElement = targetInstanceId
    ? cardElementForPresentation(targetInstanceId)
    : board;
  const measuredImpact = impactElement?.getBoundingClientRect();
  const hasMeasuredImpact =
    measuredImpact !== undefined &&
    measuredImpact.width > 0 &&
    measuredImpact.height > 0;
  const impactScope = targetInstanceId ? "target" : "board";
  const impactWidth = hasMeasuredImpact
    ? measuredImpact.width
    : impactScope === "target"
      ? Math.min(126, viewportWidth * 0.16)
      : Math.min(860, viewportWidth * 0.72);
  const impactHeight = hasMeasuredImpact
    ? measuredImpact.height
    : impactScope === "target"
      ? impactWidth * 1.28
      : Math.min(270, viewportHeight * 0.3);
  const impactLeft = hasMeasuredImpact
    ? measuredImpact.left
    : viewportWidth / 2 - impactWidth / 2;
  const impactTop = hasMeasuredImpact
    ? measuredImpact.top
    : viewportHeight * 0.42 - impactHeight / 2;

  const sourceCenterX = fromLeft + fromWidth / 2;
  const sourceCenterY = fromTop + fromHeight / 2;
  const impactCenterX = impactLeft + impactWidth / 2;
  const impactCenterY = impactTop + impactHeight / 2;
  const travelX = impactCenterX - sourceCenterX;
  const travelY = impactCenterY - sourceCenterY;

  return {
    fromLeft,
    fromTop,
    fromWidth,
    fromHeight,
    liftX: travelX * 0.3,
    liftY: travelY * 0.3 - 34,
    releaseX: travelX * 0.76,
    releaseY: travelY * 0.76 - 14,
    travelX,
    travelY,
    impactLeft,
    impactTop,
    impactWidth,
    impactHeight,
    impactScope,
  };
}

function captureHeroPowerPresentationGeometry(): HeroPowerPresentationGeometry {
  const viewportWidth = Math.max(1, window.innerWidth);
  const source = document.querySelector<HTMLElement>(
    '[data-testid="human-hero-power"]',
  );
  const measured = source?.getBoundingClientRect();
  if (measured && measured.width > 0 && measured.height > 0) {
    return {
      left: measured.left,
      top: measured.top,
      width: measured.width,
      height: measured.height,
    };
  }
  const width = Math.min(230, Math.max(150, viewportWidth * 0.18));
  return {
    left: Math.max(12, viewportWidth / 2 - width / 2),
    top: 12,
    width,
    height: 64,
  };
}

function captureHeroPowerPresentationTarget(
  player: PlayerState,
  targetInstanceId: string | undefined,
): HeroPowerPresentationTargetView | null {
  if (!targetInstanceId) return null;
  const shopTarget = player.shop.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  const boardTarget = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  const target = shopTarget ?? boardTarget;
  if (!target) return null;
  const element = Array.from(
    document.querySelectorAll<HTMLElement>("[data-unit-instance-id]"),
  ).find(
    (candidate) =>
      candidate.dataset.unitInstanceId === targetInstanceId,
  );
  const measured = element?.getBoundingClientRect();
  if (!measured || measured.width <= 0 || measured.height <= 0) {
    return null;
  }
  return {
    instanceId: target.instanceId,
    name: target.name,
    zone: shopTarget ? "shop" : "board",
    geometry: {
      left: measured.left,
      top: measured.top,
      width: measured.width,
      height: measured.height,
    },
  };
}

function heroPowerPresentationTargetPath(
  source: HeroPowerPresentationGeometry,
  target: HeroPowerPresentationGeometry,
): string {
  const sourceX = source.left + source.width * 0.2;
  const sourceY = source.top + source.height * 0.56;
  const targetX = target.left + target.width / 2;
  const targetY = target.top + target.height / 2;
  const controlX = (sourceX + targetX) / 2;
  const controlY = Math.min(sourceY, targetY) - 72;
  return `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;
}

function captureRecruitMotion(
  state: GameState,
  action: GameAction,
): RecruitMotionGeometry | null {
  const player = humanPlayerForPresentation(state);
  if (!player) return null;

  let instanceId: string | null = null;
  let targetTestId: "hand-row" | "tavern-keeper" | null = null;
  let target: HTMLElement | null = null;
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
  } else if (
    action.type === "PLAY_HAND_CARD" ||
    action.type === "PLAY_MINION"
  ) {
    const card =
      action.type === "PLAY_HAND_CARD"
        ? player.hand.find(
            (candidate) => candidate.instanceId === action.cardInstanceId,
          )
        : player.hand[action.handIndex];
    if (card?.kind !== "minion") return null;
    instanceId = card.instanceId;
    const requestedIndex = Math.max(
      0,
      Math.min(action.boardIndex ?? player.board.length, player.board.length),
    );
    target = document.querySelector<HTMLElement>(
      `[data-board-insert-index="${requestedIndex}"], [data-board-slot-index="${requestedIndex}"]`,
    );
    target ??= document.querySelector<HTMLElement>(
      '[data-board-drop-zone="true"]',
    );
  }
  if (!instanceId || (!targetTestId && !target)) return null;

  const source = cardElementForPresentation(instanceId);
  target ??= document.querySelector<HTMLElement>(
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
  if (value.kind === "secretChoice") {
    return isPersistedSecretChoiceInteraction(value);
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
      (value.destination.kind === "replaceShop" &&
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
      typeof value.filter.requiresMinionType === "boolean") &&
    (value.filter.usesSharedPool === undefined ||
      typeof value.filter.usesSharedPool === "boolean");
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
  maximumTavernTier: ReturnType<typeof getMaximumTavernTier>,
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
    if (destination.kind === "replaceShop") {
      return (
        shopIds.has(destination.targetInstanceId) &&
        persistedGalakrondDiscoverMatchesPlayer(
          interaction,
          player,
          maximumTavernTier,
        )
      );
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
  if (interaction.kind === "secretChoice") {
    return persistedSecretChoiceMatchesPlayer(interaction, player);
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
  if (
    interaction.kind !== "target" &&
    interaction.kind !== "magnetizeTarget"
  ) {
    return false;
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
          getMaximumTavernTier(candidate as unknown as GameState),
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
  tripleForgePending = false,
  discoverRewardPending = false,
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
  tripleForgePending?: boolean;
  discoverRewardPending?: boolean;
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
        tripleForgePending ? " is-triple-forge-pending" : ""
      }${
        discoverRewardPending ? " is-discover-reward-pending" : ""
      }${
        locked ? " is-turn-locked" : ""
      }${
        disabled ? " is-disabled" : ""
      }`}
      aria-hidden={tripleForgePending || undefined}
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
        heroPowerTarget ? "，可作为英雄技能目标" : ""
      }${
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
          heroPowerTarget ? "hero-power-target-instructions" : "",
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
      data-triple-forge-pending={tripleForgePending || undefined}
      data-discover-reward-pending={discoverRewardPending || undefined}
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
  discoverRewardPending = false,
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
  discoverRewardPending?: boolean;
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
        discoverRewardPending ? " is-discover-reward-pending" : ""
      }${
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
      data-discover-reward-pending={discoverRewardPending || undefined}
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
  discoverRewardPending = false,
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
  discoverRewardPending?: boolean;
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
        discoverRewardPending ? " is-discover-reward-pending" : ""
      }${
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
      data-discover-reward-pending={discoverRewardPending || undefined}
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

function DiscoverPresentationCard({
  option,
  testId,
}: {
  option: DiscoverPresentationOption;
  testId?: string;
}) {
  if (option.kind === "minion") {
    return (
      <div
        className="unit-card discover-presentation-card"
        aria-hidden="true"
        data-testid={testId}
        data-unit-instance-id={option.card.instanceId}
        style={{ "--card-hue": TRIBE_HUE[option.card.tribe] } as CSSProperties}
      >
        <UnitCardFace unit={option.card} />
      </div>
    );
  }

  if (option.kind === "tavernSpell") {
    return (
      <div
        className="tavern-spell-card discover-presentation-card"
        aria-hidden="true"
        data-card-instance-id={option.card.instanceId}
        data-testid={testId}
        style={{ "--card-hue": 266 } as CSSProperties}
      >
        <TavernSpellCardFace card={option.card} />
      </div>
    );
  }

  return (
    <div
      className={`tavern-spell-card spellcraft-card discover-presentation-card${
        (option.card.effectMultiplier ?? 1) > 1 ? " is-golden" : ""
      }`}
      aria-hidden="true"
      data-card-instance-id={option.card.instanceId}
      data-testid={testId}
      style={{ "--card-hue": 222 } as CSSProperties}
    >
      <SpellcraftCardFace card={option.card} />
    </div>
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
        onChargeVector?.({ x: 0, y: 0 });
        return;
      }
      onChargeVector?.({ x: dx, y: dy });
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
  }, [actorInstanceId, eventIndex, onChargeVector, targetInstanceId]);

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
  recruitArrivalInstanceId,
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
  recruitArrivalInstanceId?: string;
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
                className={`board-card-motion${
                  unit.instanceId === recruitArrivalInstanceId
                    ? " is-recruit-arriving"
                    : ""
                }`}
                data-recruit-arrival={
                  unit.instanceId === recruitArrivalInstanceId || undefined
                }
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
                    (isMagneticTarget && onMagneticTarget) ||
                    (isHeroPowerTarget && onHeroPowerTarget)
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
                          } else if (isMagneticTarget && onMagneticTarget) {
                            onMagneticTarget?.(unit.instanceId);
                          } else {
                            onHeroPowerTarget?.(unit.instanceId);
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
  const [heroPowerPresentation, setHeroPowerPresentation] =
    useState<HeroPowerPresentationView | null>(null);
  const [spellCastPresentation, setSpellCastPresentation] =
    useState<SpellCastPresentationView | null>(null);
  const [recruitPresentationQueue, setRecruitPresentationQueue] =
    useState<RecruitPresentationBatch[]>([]);
  const [recruitEntryPresentation, setRecruitEntryPresentation] =
    useState<RecruitEntryPresentationState | null>(null);
  const [heroChoicePresentation, setHeroChoicePresentation] =
    useState<HeroChoicePresentationState | null>(null);
  const [trinketChoicePresentation, setTrinketChoicePresentation] =
    useState<TrinketChoicePresentationState | null>(null);
  const [trinketChoiceHudTravel, setTrinketChoiceHudTravel] = useState({
    x: 0,
    y: 0,
  });
  const [discoverChoicePresentation, setDiscoverChoicePresentation] =
    useState<DiscoverChoicePresentationView | null>(null);
  const [hiddenDiscoverInteractionId, setHiddenDiscoverInteractionId] =
    useState<string | null>(null);
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeed>(1);
  const [combatRewardNotice, setCombatRewardNotice] =
    useState<CombatRewardSummary | null>(null);
  const [newCombatRewardIds, setNewCombatRewardIds] = useState<string[]>(
    [],
  );
  const [battlePlayback, setBattlePlayback] =
    useState<CombatPlaybackState | null>(null);
  const [combatEntryPresentation, setCombatEntryPresentation] =
    useState<CombatEntryPresentationState | null>(null);
  const gameRef = useRef(game);
  const heroPowerPresentationTokenRef = useRef(0);
  const spellCastPresentationTokenRef = useRef(0);
  const recruitPresentationTokenRef = useRef(0);
  const recruitEntryTokenRef = useRef(0);
  const resolvingHeroChoiceInteractionRef = useRef<string | null>(null);
  const resolvingTrinketChoiceInteractionRef = useRef<string | null>(null);
  const pendingTrinketRecruitPresentationRef =
    useRef<PendingDiscoverRecruitPresentation | null>(null);
  const resolvingDiscoverInteractionRef = useRef<string | null>(null);
  const pendingDiscoverRecruitPresentationRef =
    useRef<PendingDiscoverRecruitPresentation | null>(null);
  const pendingHeroPowerRecruitPresentationRef =
    useRef<PendingDiscoverRecruitPresentation | null>(null);
  const pendingSpellCastRecruitPresentationRef =
    useRef<PendingDiscoverRecruitPresentation | null>(null);
  const deferredDiscoverTripleFocusPhaseRef =
    useRef<"pending" | "active" | null>(null);
  const pendingRecruitEntryFeedbackRef =
    useRef<PendingRecruitEntryFeedback | null>(null);
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
  const tavernSpellCastFeedback: TavernSpellCastFeedback | null =
    spellCastPresentation?.state.stage === "effectResolve" &&
    spellCastPresentation.state.targetInstanceId !== null
      ? {
          targetInstanceId:
            spellCastPresentation.state.targetInstanceId,
          label: spellCastPresentation.state.cardName,
          token: `${spellCastPresentation.state.cardInstanceId}-${spellCastPresentation.state.revision}`,
        }
      : null;

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

  const clearCombatRewardFeedback = useCallback(() => {
    setCombatRewardNotice(null);
    setNewCombatRewardIds([]);
  }, []);

  const enqueueRecruitPresentationEvents = useCallback(
    (
      events: readonly RecruitPresentationEvent[],
      motion: RecruitMotionGeometry | null = null,
    ) => {
      if (events.length === 0) return;
      const eventGroups = groupRecruitPresentationEvents(events);
      const presentations = eventGroups.map((group, index) => {
        recruitPresentationTokenRef.current += 1;
        const token = recruitPresentationTokenRef.current;
        const triple = group.find((event) => event.kind === "triple");
        const presentation: RecruitPresentationBatch = {
          token,
          events: group,
          announcement: recruitPresentationAnnouncement(group),
          motion: index === 0 ? motion : null,
          tripleForge:
            triple?.kind === "triple"
              ? createTripleForgePresentation({
                  token,
                  goldenInstanceId: triple.golden.instanceId,
                })
              : null,
          tripleHandoff: null,
        };
        return presentation;
      });
      setRecruitPresentationQueue((current) => [
        ...current,
        ...presentations,
      ]);
    },
    [],
  );

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const restoreGame = (saved: GameState) => {
          setGame(saved);
          setStarted(true);
          setInitialHealthInput(String(saved.initialHealth));
          safeWriteLocalStorage(SAVE_KEY, JSON.stringify(saved));

          const playbackTimeline =
            saved.phase === "combat" && saved.lastBattle
              ? createCombatPlaybackTimeline(saved.lastBattle)
              : null;
          const resumedPlayback = playbackTimeline
            ? readCombatPlaybackSession(playbackTimeline)
            : null;
          if (resumedPlayback) {
            setBattlePlayback(resumedPlayback);
          } else {
            setBattlePlayback(
              playbackTimeline
                ? createCombatPlaybackState(playbackTimeline)
                : null,
            );
            clearCombatPlaybackSession();
          }
          // Combat entry is a client-only transition. Restoring a saved
          // combat resumes its real replay without repeating the ceremony.
          setCombatEntryPresentation(null);
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
    if (!battlePlayback) return;
    safeWriteSessionStorage(
      COMBAT_PLAYBACK_SESSION_KEY,
      JSON.stringify(combatPlaybackSessionSnapshot(battlePlayback)),
    );
    safeRemoveSessionStorage(LEGACY_COMBAT_PLAYBACK_SESSION_KEY);
  }, [battlePlayback]);

  useEffect(() => {
    if (!loaded || game.phase === "combat") return;
    clearCombatPlaybackSession();
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
    if (
      !activeRecruitPresentation ||
      activeRecruitPresentation.tripleForge !== null
    ) {
      return;
    }
    const activeToken = activeRecruitPresentation.token;
    const presentationTimer = window.setTimeout(() => {
      setRecruitPresentationQueue((current) =>
        completeRecruitPresentation(current, activeToken),
      );
    }, recruitPresentationDuration(activeRecruitPresentation.events));
    return () => window.clearTimeout(presentationTimer);
  }, [activeRecruitPresentation]);

  useEffect(() => {
    const forge = activeRecruitPresentation?.tripleForge;
    if (!forge) return;
    const expectedToken = forge.token;
    const expectedGoldenInstanceId = forge.goldenInstanceId;
    const expectedStage = forge.stage;
    const expectedRevision = forge.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const stageTimer = window.setTimeout(() => {
      setRecruitPresentationQueue((current) => {
        const active = current[0];
        if (
          !active ||
          active.token !== expectedToken ||
          active.tripleForge === null
        ) {
          return current;
        }
        const next = transitionTripleForgePresentation(
          active.tripleForge,
          {
            type: "advance",
            expectedToken,
            expectedGoldenInstanceId,
            expectedStage,
            expectedRevision,
          },
        );
        if (next === active.tripleForge) return current;
        if (next === null) return current.slice(1);
        return [{ ...active, tripleForge: next }, ...current.slice(1)];
      });
    }, tripleForgePresentationDuration(expectedStage, reducedMotion));
    return () => window.clearTimeout(stageTimer);
  }, [activeRecruitPresentation]);

  useEffect(() => {
    const forge = activeRecruitPresentation?.tripleForge;
    if (!forge || activeRecruitPresentation.tripleHandoff !== null) {
      return;
    }
    const expectedToken = forge.token;
    const expectedGoldenInstanceId = forge.goldenInstanceId;
    const measurementFrame = window.requestAnimationFrame(() => {
      const target =
        handCardElementForPresentation(expectedGoldenInstanceId) ??
        document.querySelector<HTMLElement>('[data-testid="hand-row"]');
      if (!target) return;
      const targetRect = target.getBoundingClientRect();
      if (targetRect.width <= 0 || targetRect.height <= 0) return;
      const nextHandoff: RecruitTripleHandoffGeometry = {
        travelX:
          targetRect.left + targetRect.width / 2 - window.innerWidth / 2,
        travelY:
          targetRect.top +
          targetRect.height / 2 -
          window.innerHeight * 0.46,
      };
      setRecruitPresentationQueue((current) => {
        const active = current[0];
        if (
          !active ||
          active.token !== expectedToken ||
          active.tripleForge?.goldenInstanceId !==
            expectedGoldenInstanceId ||
          active.tripleHandoff !== null
        ) {
          return current;
        }
        return [
          { ...active, tripleHandoff: nextHandoff },
          ...current.slice(1),
        ];
      });
    });
    return () => window.cancelAnimationFrame(measurementFrame);
  }, [activeRecruitPresentation]);

  useEffect(() => {
    if (
      !recruitEntryPresentation ||
      recruitEntryPresentation.stage === "complete"
    ) {
      return;
    }
    const expectedKey = recruitEntryPresentation.transitionKey;
    const expectedStage = recruitEntryPresentation.stage;
    const expectedRevision = recruitEntryPresentation.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const stageTimer = window.setTimeout(() => {
      setRecruitEntryPresentation((current) =>
        transitionRecruitEntryPresentation(current, {
          type: "advance",
          expectedKey,
          expectedStage,
          expectedRevision,
        }),
      );
    }, recruitEntryStageDuration(expectedStage, reducedMotion));
    return () => window.clearTimeout(stageTimer);
  }, [recruitEntryPresentation]);

  useEffect(() => {
    if (!heroChoicePresentation) return;
    const expectedInteractionId = heroChoicePresentation.interactionId;
    const expectedStage = heroChoicePresentation.stage;
    const expectedRevision = heroChoicePresentation.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const stageTimer = window.setTimeout(() => {
      setHeroChoicePresentation((current) =>
        transitionHeroChoicePresentation(current, {
          type: "advance",
          expectedInteractionId,
          expectedStage,
          expectedRevision,
        }),
      );
    }, heroChoicePresentationDuration(expectedStage, reducedMotion));
    return () => window.clearTimeout(stageTimer);
  }, [heroChoicePresentation]);

  useEffect(() => {
    if (heroChoicePresentation === null) {
      resolvingHeroChoiceInteractionRef.current = null;
    }
  }, [heroChoicePresentation]);

  useEffect(() => {
    if (!trinketChoicePresentation) return;
    const expectedInteractionId =
      trinketChoicePresentation.interactionId;
    const expectedStage = trinketChoicePresentation.stage;
    const expectedRevision = trinketChoicePresentation.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const duration = trinketChoicePresentationDuration(
      expectedStage,
      reducedMotion,
    );
    if (duration === null) return;
    const stageTimer = window.setTimeout(() => {
      setTrinketChoicePresentation((current) =>
        transitionTrinketChoicePresentation(current, {
          type: "advance",
          expectedInteractionId,
          expectedStage,
          expectedRevision,
        }),
      );
    }, duration);
    return () => window.clearTimeout(stageTimer);
  }, [trinketChoicePresentation]);

  useLayoutEffect(() => {
    if (trinketChoicePresentation !== null) return;
    resolvingTrinketChoiceInteractionRef.current = null;
    const deferred = pendingTrinketRecruitPresentationRef.current;
    pendingTrinketRecruitPresentationRef.current = null;
    if (deferred && deferred.events.length > 0) {
      enqueueRecruitPresentationEvents(deferred.events, deferred.motion);
    }
  }, [
    enqueueRecruitPresentationEvents,
    trinketChoicePresentation,
  ]);

  useEffect(() => {
    if (!heroPowerPresentation) return;
    const expectedToken = heroPowerPresentation.state.token;
    const expectedHeroPowerId =
      heroPowerPresentation.state.heroPowerId;
    const expectedStage = heroPowerPresentation.state.stage;
    const expectedRevision = heroPowerPresentation.state.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const stageTimer = window.setTimeout(() => {
      setHeroPowerPresentation((current) => {
        if (!current) return null;
        const next = transitionHeroPowerPresentation(current.state, {
          type: "advance",
          expectedToken,
          expectedHeroPowerId,
          expectedStage,
          expectedRevision,
        });
        if (next === current.state) return current;
        return next ? { ...current, state: next } : null;
      });
    }, heroPowerPresentationDuration(expectedStage, reducedMotion));
    return () => window.clearTimeout(stageTimer);
  }, [heroPowerPresentation]);

  useLayoutEffect(() => {
    if (heroPowerPresentation !== null) return;
    const deferred = pendingHeroPowerRecruitPresentationRef.current;
    pendingHeroPowerRecruitPresentationRef.current = null;
    if (deferred && deferred.events.length > 0) {
      enqueueRecruitPresentationEvents(deferred.events, deferred.motion);
    }
  }, [enqueueRecruitPresentationEvents, heroPowerPresentation]);

  useEffect(() => {
    if (!spellCastPresentation) return;
    const expectedToken = spellCastPresentation.state.token;
    const expectedCardInstanceId =
      spellCastPresentation.state.cardInstanceId;
    const expectedStage = spellCastPresentation.state.stage;
    const expectedRevision = spellCastPresentation.state.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const stageTimer = window.setTimeout(() => {
      setSpellCastPresentation((current) => {
        if (!current) return null;
        const next = transitionSpellCastPresentation(current.state, {
          type: "advance",
          expectedToken,
          expectedCardInstanceId,
          expectedStage,
          expectedRevision,
        });
        if (next === current.state) return current;
        return next ? { ...current, state: next } : null;
      });
    }, spellCastPresentationDuration(expectedStage, reducedMotion));
    return () => window.clearTimeout(stageTimer);
  }, [spellCastPresentation]);

  useLayoutEffect(() => {
    if (spellCastPresentation !== null) return;
    const deferred = pendingSpellCastRecruitPresentationRef.current;
    pendingSpellCastRecruitPresentationRef.current = null;
    if (deferred && deferred.events.length > 0) {
      enqueueRecruitPresentationEvents(deferred.events, deferred.motion);
    }
  }, [enqueueRecruitPresentationEvents, spellCastPresentation]);

  useEffect(() => {
    if (!discoverChoicePresentation) return;
    const expectedInteractionId =
      discoverChoicePresentation.state.interactionId;
    const expectedStage = discoverChoicePresentation.state.stage;
    const expectedRevision = discoverChoicePresentation.state.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    const stageTimer = window.setTimeout(() => {
      setDiscoverChoicePresentation((current) => {
        if (!current) return null;
        const next = transitionDiscoverChoicePresentation(current.state, {
          type: "advance",
          expectedInteractionId,
          expectedStage,
          expectedRevision,
        });
        return next ? { ...current, state: next } : null;
      });
    }, discoverChoicePresentationDuration(expectedStage, reducedMotion));
    return () => window.clearTimeout(stageTimer);
  }, [discoverChoicePresentation]);

  useLayoutEffect(() => {
    if (discoverChoicePresentation !== null) return;
    resolvingDiscoverInteractionRef.current = null;
    const deferred = pendingDiscoverRecruitPresentationRef.current;
    pendingDiscoverRecruitPresentationRef.current = null;
    if (deferred && deferred.events.length > 0) {
      enqueueRecruitPresentationEvents(deferred.events, deferred.motion);
    }
  }, [discoverChoicePresentation, enqueueRecruitPresentationEvents]);

  useEffect(() => {
    if (recruitEntryPresentation?.stage !== "complete") return;
    const completionTimer = window.setTimeout(() => {
      const pending = pendingRecruitEntryFeedbackRef.current;
      if (pending && pending.presentationEvents.length > 0) {
        pendingRecruitEntryFeedbackRef.current = {
          ...pending,
          presentationEvents: [],
        };
        enqueueRecruitPresentationEvents(pending.presentationEvents);
      }
      setRecruitEntryPresentation(null);
    }, 0);
    return () => window.clearTimeout(completionTimer);
  }, [enqueueRecruitPresentationEvents, recruitEntryPresentation]);

  useEffect(() => {
    if (
      recruitEntryPresentation !== null ||
      recruitPresentationQueue.length > 0
    ) {
      return;
    }
    const pending = pendingRecruitEntryFeedbackRef.current;
    if (!pending) return;
    const feedbackTimer = window.setTimeout(() => {
      if (pendingRecruitEntryFeedbackRef.current !== pending) return;
      pendingRecruitEntryFeedbackRef.current = null;
      if (pending.rewardNotice) {
        setCombatRewardNotice(pending.rewardNotice);
        setNewCombatRewardIds(pending.rewardIds);
      } else {
        clearCombatRewardFeedback();
      }
    }, 0);
    return () => window.clearTimeout(feedbackTimer);
  }, [
    clearCombatRewardFeedback,
    recruitEntryPresentation,
    recruitPresentationQueue.length,
  ]);

  const send = useCallback(
    (action: GameAction, options: SendGameActionOptions = {}) => {
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
      } else if (
        events.length > 0 &&
        options.deferRecruitPresentation !== true
      ) {
        enqueueRecruitPresentationEvents(events, motion);
      }
      if (started) {
        safeWriteLocalStorage(SAVE_KEY, JSON.stringify(next));
      }
      setGame(next);
      setSelection(null);
      return { transition, events, motion };
    },
    [dismissCardInspection, enqueueRecruitPresentationEvents, started],
  );

  const resolveHeroChoiceWithPresentation = useCallback(
    (
      interaction: Extract<PendingInteraction, { kind: "heroChoice" }>,
      selectedHeroId: string,
    ) => {
      if (resolvingHeroChoiceInteractionRef.current !== null) return;
      const presentation = createHeroChoicePresentation({
        interactionId: interaction.interactionId,
        optionIds: interaction.optionIds,
        selectedHeroId,
      });
      if (!presentation) return;

      resolvingHeroChoiceInteractionRef.current = interaction.interactionId;
      setHeroChoicePresentation(presentation);
      const { transition } = send({
        type: "RESOLVE_INTERACTION",
        interactionId: interaction.interactionId,
        optionInstanceId: selectedHeroId,
      });
      if (!transition.accepted) {
        resolvingHeroChoiceInteractionRef.current = null;
        setHeroChoicePresentation(null);
      }
    },
    [send],
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
  const humanSecrets = human.secretIds.map((secretId) =>
    getHeroSecretDefinition(secretId),
  );
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
      }${
        humanSecrets.length > 0
          ? ` · 当前奥秘：${humanSecrets.map((secret) => secret.name).join("、")}`
          : ""
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
  const lesserTrinket = humanTrinkets.find(
    (definition) => definition.tier === "lesser",
  );
  const greaterTrinket = humanTrinkets.find(
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
  const pendingHumanInteraction =
    game.pendingInteraction?.playerId === human.id
      ? game.pendingInteraction
      : null;
  const pendingTrinketChoiceInteraction =
    heroPowerPresentation === null &&
    spellCastPresentation === null &&
    pendingHumanInteraction?.kind === "trinketChoice"
      ? pendingHumanInteraction
      : null;
  const recruitTripleBlocksInteraction =
    recruitPresentationQueue.some((presentation) =>
      presentation.events.some((event) => event.kind === "triple"),
    );
  const recruitPlayBlocksInteraction =
    activeRecruitPresentation?.events.some(
      (event) =>
        event.kind === "cardMove" && event.motion === "hand-to-board",
    ) ?? false;
  const recruitPresentationBlocksInteraction =
    recruitTripleBlocksInteraction || recruitPlayBlocksInteraction;
  const trinketChoicePresentationBlocksInteraction =
    trinketChoicePresentation?.stage === "confirmFocus" ||
    trinketChoicePresentation?.stage === "effectHandoff";
  const humanInteraction =
    recruitEntryPresentation !== null ||
    heroChoicePresentation !== null ||
    heroPowerPresentation !== null ||
    trinketChoicePresentationBlocksInteraction ||
    spellCastPresentation !== null ||
    discoverChoicePresentation !== null ||
    recruitPresentationBlocksInteraction
      ? null
      : pendingHumanInteraction;
  const heroChoiceInteraction =
    humanInteraction?.kind === "heroChoice" ? humanInteraction : null;
  const heroChoiceStage = heroChoicePresentation?.stage ?? "choosing";
  const heroChoiceOptionIds =
    heroChoiceInteraction?.optionIds ?? heroChoicePresentation?.optionIds ?? [];
  const selectedHeroChoice = heroChoicePresentation
    ? getHeroDefinition(heroChoicePresentation.selectedHeroId)
    : null;
  const selectedHeroChoicePower = selectedHeroChoice
    ? getHeroPowerDefinition(selectedHeroChoice.heroPowerId)
    : null;
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
  useEffect(() => {
    const synchronizeTimer = window.setTimeout(() => {
      setTrinketChoicePresentation((current) => {
        if (
          current?.stage === "confirmFocus" ||
          current?.stage === "effectHandoff"
        ) {
          return current;
        }
        if (!pendingTrinketChoiceInteraction) return null;
        if (
          current?.interactionId ===
            pendingTrinketChoiceInteraction.interactionId &&
          current.optionIds.length ===
            pendingTrinketChoiceInteraction.optionIds.length &&
          current.optionIds.every(
            (optionId, index) =>
              optionId ===
              pendingTrinketChoiceInteraction.optionIds[index],
          )
        ) {
          return current;
        }
        return createTrinketChoicePresentation({
          interactionId:
            pendingTrinketChoiceInteraction.interactionId,
          optionIds: pendingTrinketChoiceInteraction.optionIds,
        });
      });
    }, 0);
    return () => window.clearTimeout(synchronizeTimer);
  }, [
    pendingTrinketChoiceInteraction,
    trinketChoicePresentation,
  ]);
  const activeTrinketChoicePresentation =
    trinketChoiceInteraction &&
    trinketChoicePresentation?.interactionId ===
      trinketChoiceInteraction.interactionId
      ? trinketChoicePresentation
      : null;
  const trinketChoiceStage =
    activeTrinketChoicePresentation?.stage ?? "reveal";
  const selectedTrinketChoiceId =
    activeTrinketChoicePresentation?.selectedOptionId ?? null;
  const selectedTrinketChoice = selectedTrinketChoiceId
    ? getTrinketDefinition(selectedTrinketChoiceId)
    : null;
  const trinketChoicesHidden =
    activeTrinketChoicePresentation?.hidden ?? false;
  const selectedTrinketChoiceAffordable =
    selectedTrinketChoice !== null &&
    (isMysteryCubeTrinketChoice ||
      human.gold >= selectedTrinketChoice.cost);
  const trinketChoiceCanConfirm =
    trinketChoiceStage === "choosing" &&
    selectedTrinketChoiceAffordable;
  const presentedTrinketChoice =
    trinketChoicePresentation?.selectedOptionId !== null &&
    trinketChoicePresentation?.selectedOptionId !== undefined
      ? getTrinketDefinition(
          trinketChoicePresentation.selectedOptionId,
        )
      : null;
  const selectTrinketChoice = (optionId: string) => {
    if (!trinketChoiceInteraction) return;
    setTrinketChoicePresentation((current) =>
      transitionTrinketChoicePresentation(current, {
        type: "select",
        expectedInteractionId:
          trinketChoiceInteraction.interactionId,
        optionId,
      }),
    );
  };
  const toggleTrinketChoices = () => {
    if (!trinketChoiceInteraction) return;
    setTrinketChoicePresentation((current) =>
      transitionTrinketChoicePresentation(current, {
        type: "toggleVisibility",
        expectedInteractionId:
          trinketChoiceInteraction.interactionId,
      }),
    );
  };
  const confirmTrinketChoice = (): boolean => {
    if (
      !trinketChoiceInteraction ||
      !activeTrinketChoicePresentation ||
      !selectedTrinketChoice ||
      !trinketChoiceCanConfirm ||
      resolvingTrinketChoiceInteractionRef.current !== null
    ) {
      return false;
    }

    const interactionId = trinketChoiceInteraction.interactionId;
    const selectedOptionId = selectedTrinketChoice.id;
    const paidCost = isMysteryCubeTrinketChoice
      ? 0
      : selectedTrinketChoice.cost;
    const beforeHuman = humanPlayerForPresentation(gameRef.current);
    if (!beforeHuman || paidCost > beforeHuman.gold) return false;
    const hudTravel = trinketHudTravel(selectedTrinketChoice.tier);

    resolvingTrinketChoiceInteractionRef.current = interactionId;
    const { transition, events, motion } = send(
      {
        type: "RESOLVE_INTERACTION",
        interactionId,
        optionInstanceId: selectedOptionId,
      },
      { deferRecruitPresentation: true },
    );
    const afterHuman = humanPlayerForPresentation(transition.state);
    if (!transition.accepted || !afterHuman) {
      resolvingTrinketChoiceInteractionRef.current = null;
      return false;
    }

    const nextPresentation = transitionTrinketChoicePresentation(
      activeTrinketChoicePresentation,
      {
        type: "confirm",
        expectedInteractionId: interactionId,
        selectedOptionId,
        accepted: transition.accepted,
        paidCost,
        goldBefore: beforeHuman.gold,
        goldAfter: afterHuman.gold,
      },
    );
    if (
      nextPresentation === activeTrinketChoicePresentation ||
      nextPresentation === null
    ) {
      resolvingTrinketChoiceInteractionRef.current = null;
      if (events.length > 0) {
        enqueueRecruitPresentationEvents(events, motion);
      }
      setTrinketChoicePresentation(null);
      return true;
    }

    pendingTrinketRecruitPresentationRef.current =
      events.length > 0 ? { events, motion } : null;
    setTrinketChoiceHudTravel(hudTravel);
    setTrinketChoicePresentation(nextPresentation);
    return true;
  };
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
  const activeDiscoverInteraction =
    discoverInteraction ??
    tavernSpellDiscoverInteraction ??
    darkmoonPrizeDiscoverInteraction;
  const discoverChoicesHidden =
    activeDiscoverInteraction?.interactionId ===
    hiddenDiscoverInteractionId;
  const toggleDiscoverChoices = () => {
    if (!activeDiscoverInteraction) return;
    setHiddenDiscoverInteractionId((current) =>
      current === activeDiscoverInteraction.interactionId
        ? null
        : activeDiscoverInteraction.interactionId,
    );
  };
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
  const secretChoiceInteraction =
    humanInteraction?.kind === "secretChoice" ? humanInteraction : null;
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
    queuedRecruitBloodGemPulse?.kind === "bloodGemPulse" ||
    recruitEntryPresentation !== null ||
    heroChoicePresentation !== null ||
    heroPowerPresentation !== null ||
    trinketChoicePresentationBlocksInteraction ||
    spellCastPresentation !== null ||
    discoverChoicePresentation !== null ||
    recruitPresentationBlocksInteraction;
  const humanHeroPowerQuote =
    humanHeroPowerActive &&
    !humanHeroPowerUsedThisTurn &&
    !interactionLocked &&
    game.phase === "recruit"
      ? getHeroPowerActivationQuote(game, human.id)
      : null;
  const humanHeroPowerCanActivate = humanHeroPowerQuote !== null;
  const humanHeroPowerCost = humanHeroPowerQuote?.cost ?? 99;
  const humanHeroPowerAffordable =
    humanHeroPowerQuote?.affordable ?? false;
  const humanHeroPowerUsable = humanHeroPowerQuote?.usable ?? false;
  const humanHeroPowerTargetMode =
    humanHeroPowerQuote?.targetKind ?? null;
  const [heroPowerTargeting, setHeroPowerTargeting] = useState(false);
  const heroPowerTargetValidIds = (() => {
    if (
      !heroPowerTargeting ||
      !humanHeroPowerTargetMode
    ) {
      return new Set<string>();
    }
    const candidates =
      humanHeroPowerTargetMode === "shop"
        ? human.shop
        : humanHeroPowerTargetMode === "board"
          ? human.board
          : [...human.shop, ...human.board];
    return new Set(
      candidates
        .filter(
          (candidate) =>
            getHeroPowerActivationQuote(
              game,
              human.id,
              candidate.instanceId,
            )?.usable === true,
        )
        .map((candidate) => candidate.instanceId),
    );
  })();

  const doActivateHeroPower = (targetInstanceId?: string) => {
    if (!humanHeroPowerCanActivate || !humanHero || !humanHeroPower) return;
    const quote = getHeroPowerActivationQuote(
      gameRef.current,
      human.id,
      targetInstanceId,
    );
    if (!quote?.usable) return;
    if (quote.targetKind && !targetInstanceId) {
      setSelection(null);
      setHeroPowerTargeting(true);
      return;
    }
    const geometry = captureHeroPowerPresentationGeometry();
    const presentationTarget = captureHeroPowerPresentationTarget(
      humanPlayerForPresentation(gameRef.current) ?? human,
      targetInstanceId,
    );
    const { transition, events, motion } = send(
      { type: "ACTIVATE_HERO_POWER", targetInstanceId },
      { deferRecruitPresentation: true },
    );
    if (!transition.accepted) return;
    setHeroPowerTargeting(false);

    heroPowerPresentationTokenRef.current += 1;
    const presentationState = createHeroPowerPresentation({
      accepted: transition.accepted,
      token: heroPowerPresentationTokenRef.current,
      heroPowerId: humanHeroPower.id,
      heroName: humanHero.name,
      powerName: humanHeroPower.name,
      cost: quote.cost,
    });
    if (!presentationState) {
      enqueueRecruitPresentationEvents(events, motion);
      return;
    }
    pendingHeroPowerRecruitPresentationRef.current =
      events.length > 0 ? { events, motion } : null;
    setHeroPowerPresentation({
      state: presentationState,
      geometry,
      target: presentationTarget,
    });
  };

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

  const onHeroPowerTargetClick = (instanceId: string) => {
    if (!heroPowerTargeting) return;
    doActivateHeroPower(instanceId);
  };
  const modalInteractionLocked = interactionRequiresModalBackdrop(
    humanInteraction,
  );

  useEffect(() => {
    if (heroPowerPresentation) {
      const focusFrame = window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '[data-testid="skip-hero-power-presentation"]',
          )
          ?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    if (trinketChoicePresentationBlocksInteraction) {
      const focusFrame = window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '[data-testid="skip-trinket-choice-presentation"]',
          )
          ?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    if (discoverChoicePresentation) {
      const focusFrame = window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '[data-testid="skip-discover-choice-presentation"]',
          )
          ?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

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
                  trinketChoicesHidden
                    ? '[data-testid="toggle-trinket-visibility"]'
                    : trinketChoiceStage === "reveal"
                      ? '[data-testid="skip-trinket-choice-reveal"]'
                      : selectedTrinketChoiceId
                        ? `[data-trinket-option-id="${selectedTrinketChoiceId}"]`
                        : '[data-testid="trinket-choice-0"]',
                )
          : humanInteraction.kind === "discover"
            ? document.querySelector<HTMLElement>(
                discoverChoicesHidden
                  ? '[data-testid="toggle-discover-visibility"]'
                  : '[data-testid="discover-option-0"]',
              )
            : humanInteraction.kind === "tavernSpellDiscover"
              ? document.querySelector<HTMLElement>(
                  discoverChoicesHidden
                    ? '[data-testid="toggle-discover-visibility"]'
                    : '[data-testid="tavern-spell-discover-option-0"]',
                )
            : humanInteraction.kind === "darkmoonPrizeDiscover"
              ? document.querySelector<HTMLElement>(
                  discoverChoicesHidden
                    ? '[data-testid="toggle-discover-visibility"]'
                    : '[data-testid="darkmoon-prize-discover-option-0"]',
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
            : humanInteraction.kind === "secretChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="secret-choice-0"]',
                )
            : humanInteraction.kind === "minionChoice"
              ? document.querySelector<HTMLElement>(
                  humanInteraction.definitionId === "BG32_237"
                    ? '[data-testid="budding-botanist-attack"]'
                    : humanInteraction.definitionId === "BG27_084"
                      ? '[data-testid="adaptable-beetle-reborn"]'
                      : '[data-testid="fearless-foodie-improve"]',
                )
            : humanInteraction.kind === "target" ||
                humanInteraction.kind === "magnetizeTarget"
              ? Array.from(
                  document.querySelectorAll<HTMLElement>(
                    "[data-unit-instance-id]",
                  ),
                ).find(
                  (element) =>
                    element.dataset.unitInstanceId ===
                    humanInteraction.optionInstanceIds[0],
                )
              : null;
        focusTarget?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    if (heroChoicePresentation) {
      const focusFrame = window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            '[data-testid="skip-hero-choice-presentation"]',
          )
          ?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }

    if (previousInteractionIdRef.current !== null) {
      const deferredTripleFocusPhase =
        deferredDiscoverTripleFocusPhaseRef.current;
      if (recruitTripleBlocksInteraction) {
        if (deferredTripleFocusPhase === "pending") {
          deferredDiscoverTripleFocusPhaseRef.current = "active";
        }
        return;
      }
      if (deferredTripleFocusPhase === "pending") return;
      if (deferredTripleFocusPhase === "active") {
        deferredDiscoverTripleFocusPhaseRef.current = null;
      }
      previousInteractionIdRef.current = null;
      const returnTarget = interactionReturnFocusRef.current;
      interactionReturnFocusRef.current = null;
      const focusFrame = window.requestAnimationFrame(() => {
        if (
          returnTarget?.isConnected &&
          returnTarget !== document.body
        ) {
          returnTarget.focus();
          if (document.activeElement === returnTarget) return;
        }
        document
          .querySelector<HTMLElement>('[data-testid="end-turn"]')
          ?.focus();
      });
      return () => window.cancelAnimationFrame(focusFrame);
    }
  }, [
    discoverChoicePresentation,
    discoverChoicesHidden,
    heroChoicePresentation,
    heroPowerPresentation,
    humanInteraction,
    recruitTripleBlocksInteraction,
    selectedTrinketChoiceId,
    trinketChoicePresentationBlocksInteraction,
    trinketChoiceStage,
    trinketChoicesHidden,
  ]);

  useEffect(() => {
    if (discoverChoicePresentation !== null) return;
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
  }, [discoverChoicePresentation, game.players]);

  const trapModalFocus = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.closest('[inert], [aria-hidden="true"]') &&
          element.getClientRects().length > 0,
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
  const combatTimeline = useMemo(
    () => (battle ? createCombatPlaybackTimeline(battle) : null),
    [battle],
  );
  const battleKey = combatTimeline?.battleKey ?? null;
  const combatEntryStage =
    combatEntryPresentation?.battleKey === battleKey
      ? combatEntryPresentation.stage
      : null;
  const combatIntroActive =
    started &&
    game.phase === "combat" &&
    battleKey !== null &&
    combatEntryStage !== null;
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
  const opponentHero = opponent?.heroId
    ? getHeroDefinition(opponent.heroId)
    : null;
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
  const playbackEvents = combatTimeline?.events ?? [];
  const playbackEventCount = playbackEvents.length;
  const playbackIsCurrent =
    game.phase === "combat" &&
    battleKey !== null &&
    battlePlayback?.battleKey === battleKey;
  const effectiveBattlePlayback =
    game.phase === "combat" && combatTimeline
      ? playbackIsCurrent && battlePlayback
        ? battlePlayback
        : createCombatPlaybackState(combatTimeline)
      : null;
  const revealedBattleEventCount =
    game.phase === "combat" && battle
      ? combatIntroActive
        ? 0
        : Math.min(
            effectiveBattlePlayback?.revealedCount ?? 0,
            playbackEventCount,
          )
      : 0;
  const battlePlaybackComplete =
    game.phase === "combat" &&
    battle !== null &&
    !combatIntroActive &&
    effectiveBattlePlayback?.status === "complete";
  const battlePlaybackPaused =
    game.phase === "combat" &&
    battle !== null &&
    !combatIntroActive &&
    effectiveBattlePlayback?.status === "paused";
  const battlePlaybackResultUnlocked =
    game.phase !== "combat" ||
    (!combatIntroActive &&
      (effectiveBattlePlayback?.resultUnlocked ?? false));
  const furthestRevealedBattleEventCount =
    game.phase === "combat" && battle && !combatIntroActive
      ? Math.min(
          effectiveBattlePlayback?.furthestRevealedCount ?? 0,
          playbackEventCount,
        )
      : 0;
  const battlePlaybackRevision = effectiveBattlePlayback?.revision ?? 0;
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
  const currentDamageCapLabel = combatDamageCapLabel(currentBattleEvent);
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
  const currentAttackEventIndex =
    currentBattleEvent?.type === "attack" ? currentBattleEvent.index : null;
  const [combatChargeState, setCombatChargeState] = useState<{
    eventIndex: number;
    revision: number;
    phase: "charge" | "collide" | "rebound";
  } | null>(null);
  const combatChargePhase =
    effectiveBattlePlayback?.status === "playing" &&
    currentAttackEventIndex !== null &&
    combatChargeState?.eventIndex === currentAttackEventIndex &&
    combatChargeState.revision === battlePlaybackRevision
      ? combatChargeState.phase
      : "idle";
  const [combatChargeVector, setCombatChargeVector] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });

  useEffect(() => {
    if (
      currentAttackEventIndex === null ||
      effectiveBattlePlayback?.status !== "playing"
    ) {
      return;
    }
    const schedulePhase = (
      phase: "charge" | "collide" | "rebound",
      delayAtNormalSpeed: number,
    ) =>
      window.setTimeout(() => {
        setCombatChargeState({
          eventIndex: currentAttackEventIndex,
          revision: battlePlaybackRevision,
          phase,
        });
      }, delayAtNormalSpeed / battleSpeed);
    const timers = [
      schedulePhase("charge", 40),
      schedulePhase("collide", 400),
      schedulePhase("rebound", 560),
      window.setTimeout(() => {
        setCombatChargeState(null);
      }, 740 / battleSpeed),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    battlePlaybackRevision,
    battleSpeed,
    currentAttackEventIndex,
    effectiveBattlePlayback?.status,
  ]);

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
    ? game.phase !== "combat" || battlePlaybackResultUnlocked
      ? battle.events
      : playbackEvents.slice(0, furthestRevealedBattleEventCount)
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
  const scoutingResultRevealed = battlePlaybackResultUnlocked;
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
  const maximumTavernTier = getMaximumTavernTier(game);
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
  const discoverSourceHeroPower =
    discoverInteraction?.sourceDefinitionId !== undefined &&
    isHeroPowerDefinitionId(discoverInteraction.sourceDefinitionId)
      ? getHeroPowerDefinition(discoverInteraction.sourceDefinitionId)
      : undefined;
  const discoverSourceHeroPowerPrompt = discoverSourceHeroPower
    ? discoverSourceHeroPower.effect ===
      "activeDiscoverMagneticMech"
      ? "发现一个磁力机械"
      : discoverSourceHeroPower.effect === "activeDiscoverDragonTier4"
        ? "发现一张龙牌"
        : discoverInteraction?.filter.exactTier
          ? `发现一个 ${discoverInteraction.filter.exactTier} 级随从`
          : "发现一个随从"
    : null;
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
  const discoverShopReplaceTarget =
    discoverDestination?.kind === "replaceShop"
      ? human.shop.find(
          (minion) =>
            minion.instanceId === discoverDestination.targetInstanceId,
        )
      : undefined;
  const discoverTitle = discoverInteraction
    ? discoverInteraction.destination.kind === "replaceShop"
      ? `迦拉克隆的贪婪 · 为${discoverShopReplaceTarget?.name ?? "目标随从"}选择高一级随从`
      : discoverInteraction.destination.kind === "transform"
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
      : discoverSourceHeroPower && discoverSourceHeroPowerPrompt
        ? `${discoverSourceHeroPower.name} · ${discoverSourceHeroPowerPrompt}`
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
  const discoverCopy = discoverInteraction
    ? discoverInteraction.destination.kind === "replaceShop"
      ? "选择后，所选随从会替换酒馆中的目标；原目标和另外两张候选会回到共享随从池。"
      : discoverInteraction.destination.kind === "transform"
      ? "选择后，目标会变形为所选随从；原随从和另外两张候选会回到共享随从池。"
      : discoverInteraction.destination.kind === "customUndeadFirst"
        ? "先从三个战斗组件中选择一个。候选是制造用组件，不会占用共享随从池。"
        : discoverInteraction.destination.kind === "customUndeadSecond"
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
                    : "选择一张加入手牌；另外两张会回到共享随从池。"
    : "";

  const resolveDiscoverChoiceWithPresentation = (
    input: ResolveDiscoverChoicePresentationInput,
  ): boolean => {
    if (resolvingDiscoverInteractionRef.current !== null) return false;
    const selectedOption = input.options.find(
      (option) => option.card.instanceId === input.selectedOptionId,
    );
    if (!selectedOption) return false;

    const current = gameRef.current;
    const beforeHuman = humanPlayerForPresentation(current);
    if (!beforeHuman) return false;
    const capturedOptions = Object.freeze(
      input.options.map(snapshotDiscoverPresentationOption),
    );
    const capturedSelected = capturedOptions.find(
      (option) => option.card.instanceId === input.selectedOptionId,
    );
    if (!capturedSelected) return false;
    const handTravel = discoverHandTravel();
    const shopTarget =
      input.rewardStrategy === "shopReplace"
        ? captureHeroPowerPresentationTarget(
            beforeHuman,
            input.shopTargetInstanceId,
          )
        : null;
    const shopTravel = shopTarget
      ? {
          x:
            shopTarget.geometry.left +
            shopTarget.geometry.width / 2 -
            window.innerWidth / 2,
          y:
            shopTarget.geometry.top +
            shopTarget.geometry.height / 2 -
            window.innerHeight / 2,
        }
      : { x: 0, y: 0 };

    resolvingDiscoverInteractionRef.current = input.interactionId;
    const { transition, events, motion } = send(
      {
        type: "RESOLVE_INTERACTION",
        interactionId: input.interactionId,
        optionInstanceId: input.selectedOptionId,
      },
      { deferRecruitPresentation: true },
    );
    if (!transition.accepted) {
      resolvingDiscoverInteractionRef.current = null;
      return false;
    }
    setHiddenDiscoverInteractionId(null);

    const afterHuman = humanPlayerForPresentation(transition.state);
    const beforeHandIds = new Set(
      beforeHuman.hand.map((card) => card.instanceId),
    );
    let rewardCard: DiscoverPresentationOption | null = null;
    let rewardInstanceId: string | null = null;
    const discoverTripleReward =
      capturedSelected.kind === "minion"
        ? findDiscoverTripleReward(
            events,
            input.selectedOptionId,
            capturedSelected.card.definitionId,
          )
        : null;

    if (input.rewardStrategy === "selected" && afterHuman) {
      const arrived = afterHuman.hand.find(
        (card) => card.instanceId === input.selectedOptionId,
      );
      if (capturedSelected.kind === "minion" && arrived?.kind === "minion") {
        rewardCard = { kind: "minion", card: { ...arrived } };
        rewardInstanceId = arrived.instanceId;
      } else if (
        capturedSelected.kind === "tavernSpell" &&
        arrived?.kind === "tavernSpell"
      ) {
        rewardCard = { kind: "tavernSpell", card: { ...arrived } };
        rewardInstanceId = arrived.instanceId;
      } else if (
        capturedSelected.kind === "darkmoonPrize" &&
        arrived?.kind === "spellcraft"
      ) {
        rewardCard = { kind: "darkmoonPrize", card: { ...arrived } };
        rewardInstanceId = arrived.instanceId;
      } else if (discoverTripleReward) {
        rewardCard = capturedSelected;
        rewardInstanceId = discoverTripleReward.instanceId;
      }
    } else if (
      input.rewardStrategy === "generatedMinion" &&
      afterHuman
    ) {
      const generated = afterHuman.hand.find(
        (card) =>
          card.kind === "minion" &&
          !beforeHandIds.has(card.instanceId),
      );
      if (generated?.kind === "minion") {
        rewardCard = { kind: "minion", card: { ...generated } };
        rewardInstanceId = generated.instanceId;
      }
    }

    const presentationState = createDiscoverChoicePresentation({
      accepted: transition.accepted,
      interactionId: input.interactionId,
      optionIds: capturedOptions.map((option) => option.card.instanceId),
      selectedOptionId: input.selectedOptionId,
      rewardKind: rewardCard ? "hand" : "immediate",
      rewardInstanceId: rewardInstanceId ?? input.selectedOptionId,
    });
    if (!presentationState) {
      resolvingDiscoverInteractionRef.current = null;
      if (events.length > 0) {
        enqueueRecruitPresentationEvents(events, motion);
      }
      return true;
    }

    pendingDiscoverRecruitPresentationRef.current =
      events.length > 0 ? { events, motion } : null;
    deferredDiscoverTripleFocusPhaseRef.current = events.some(
      (event) => event.kind === "triple",
    )
      ? "pending"
      : null;
    const selectedName = capturedSelected.card.name;
    const outcomeLabel = rewardCard
      ? discoverTripleReward
        ? `${selectedName}已选定，等待三连锻造`
        : `${rewardCard.card.name}正在进入手牌`
      : input.rewardStrategy === "shopReplace"
        ? `已选择${selectedName}，正在替换酒馆中的${shopTarget?.name ?? "目标随从"}`
      : input.rewardStrategy === "immediate"
        ? `已选择${selectedName}，效果已经结算`
        : `手牌已满，${selectedName}未能进入手牌`;
    setDiscoverChoicePresentation({
      state: presentationState,
      title: input.title,
      copy: input.copy,
      options: capturedOptions,
      rewardCard,
      outcomeLabel,
      rewardStrategy: input.rewardStrategy,
      shopTarget,
      handTravelX: handTravel.x,
      handTravelY: handTravel.y,
      shopTravelX: shopTravel.x,
      shopTravelY: shopTravel.y,
    });
    return true;
  };
  const discoverPresentationSelectedOption =
    discoverChoicePresentation?.options.find(
      (option) =>
        option.card.instanceId ===
        discoverChoicePresentation.state.selectedOptionId,
    ) ?? null;
  const discoverPresentationActiveCard =
    discoverChoicePresentation?.state.stage === "rewardArrival"
      ? discoverChoicePresentation.rewardCard
      : discoverPresentationSelectedOption;
  const pendingDiscoverRewardInstanceId =
    discoverChoicePresentation?.state.rewardKind === "hand"
      ? discoverChoicePresentation.state.rewardInstanceId
      : null;

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
      !combatEntryPresentation ||
      !battleKey ||
      !combatTimeline ||
      game.phase !== "combat"
    ) {
      return clearCombatIntroTimer;
    }
    if (combatEntryPresentation.battleKey !== battleKey) {
      return clearCombatIntroTimer;
    }
    if (combatEntryPresentation.stage === "complete") {
      const completedBattleKey = combatEntryPresentation.battleKey;
      const completedRevision = combatEntryPresentation.revision;
      combatIntroTimerRef.current = window.setTimeout(() => {
        combatIntroTimerRef.current = null;
        setBattlePlayback(createCombatPlaybackState(combatTimeline));
        setCombatEntryPresentation((current) =>
          current?.battleKey === completedBattleKey &&
          current.stage === "complete" &&
          current.revision === completedRevision
            ? null
            : current,
        );
      }, 0);
      return clearCombatIntroTimer;
    }

    const expectedBattleKey = combatEntryPresentation.battleKey;
    const expectedStage = combatEntryPresentation.stage;
    const expectedRevision = combatEntryPresentation.revision;
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    combatIntroTimerRef.current = window.setTimeout(() => {
      combatIntroTimerRef.current = null;
      setCombatEntryPresentation((current) =>
        transitionCombatEntryPresentation(current, {
          type: "advance",
          expectedBattleKey,
          expectedStage,
          expectedRevision,
        }),
      );
    }, combatEntryStageDuration(expectedStage, reducedMotion));

    return clearCombatIntroTimer;
  }, [
    battleKey,
    clearCombatIntroTimer,
    combatEntryPresentation,
    combatTimeline,
    game.phase,
  ]);

  useEffect(() => {
    clearBattlePlaybackTimer();
    if (
      !combatTimeline ||
      game.phase !== "combat" ||
      combatIntroActive ||
      effectiveBattlePlayback?.status !== "playing"
    ) {
      return clearBattlePlaybackTimer;
    }

    const expectedRevision = effectiveBattlePlayback.revision;
    const expectedRevealedCount =
      effectiveBattlePlayback.revealedCount;
    battlePlaybackTimerRef.current = window.setTimeout(() => {
      battlePlaybackTimerRef.current = null;
      setBattlePlayback((current) => {
        const currentState =
          current?.battleKey === combatTimeline.battleKey
            ? current
            : createCombatPlaybackState(combatTimeline);
        return transitionCombatPlayback(
          currentState,
          {
            type: "tick",
            expectedRevision,
            expectedRevealedCount,
          },
          combatTimeline,
        );
      });
    }, currentBattleEventDelay);

    return clearBattlePlaybackTimer;
  }, [
    clearBattlePlaybackTimer,
    combatIntroActive,
    combatTimeline,
    currentBattleEventDelay,
    effectiveBattlePlayback?.revealedCount,
    effectiveBattlePlayback?.revision,
    effectiveBattlePlayback?.status,
    game.phase,
  ]);

  const controlBattlePlayback = useCallback(
    (action: CombatPlaybackAction) => {
      clearBattlePlaybackTimer();
      if (
        !combatTimeline ||
        game.phase !== "combat" ||
        combatIntroActive
      ) {
        return;
      }
      setBattlePlayback((current) => {
        const currentState =
          current?.battleKey === combatTimeline.battleKey
            ? current
            : createCombatPlaybackState(combatTimeline);
        return transitionCombatPlayback(
          currentState,
          action,
          combatTimeline,
        );
      });
    },
    [
      clearBattlePlaybackTimer,
      combatIntroActive,
      combatTimeline,
      game.phase,
    ],
  );

  const toggleBattlePlayback = useCallback(() => {
    controlBattlePlayback({
      type: battlePlaybackPaused ? "play" : "pause",
    });
  }, [battlePlaybackPaused, controlBattlePlayback]);

  const stepBattlePlaybackBackward = useCallback(() => {
    controlBattlePlayback({ type: "step", direction: "backward" });
  }, [controlBattlePlayback]);

  const stepBattlePlaybackForward = useCallback(() => {
    controlBattlePlayback({ type: "step", direction: "forward" });
  }, [controlBattlePlayback]);

  const replayBattlePlayback = useCallback(() => {
    controlBattlePlayback({ type: "replay" });
  }, [controlBattlePlayback]);

  const skipBattlePlayback = useCallback(() => {
    controlBattlePlayback({ type: "skip" });
  }, [controlBattlePlayback]);

  const seekBattlePlayback = useCallback(
    (revealedCount: number) => {
      controlBattlePlayback({ type: "seek", revealedCount });
    },
    [controlBattlePlayback],
  );

  const changeBattleSpeed = useCallback(
    (speed: BattleSpeed) => {
      if (speed === battleSpeed) return;
      controlBattlePlayback({ type: "reschedule" });
      setBattleSpeed(speed);
    },
    [battleSpeed, controlBattlePlayback],
  );

  const continueAfterCombat = useCallback(() => {
    if (!battle || game.phase !== "combat") return;
    const before = gameRef.current;
    const rewardNotice =
      human.alive && humanCombatRewardOutcomeCount > 0
        ? humanCombatRewards
        : null;
    const preCombatHandIds = preCombatHandIdsRef.current;
    const rewardIds = rewardNotice
      ? preCombatHandIds
        ? human.hand
            .filter(
              (card) =>
                card.kind === "minion" &&
                !preCombatHandIds.has(card.instanceId),
            )
            .map((card) => card.instanceId)
        : humanCombatRewards.addedInstanceIds
      : [];
    clearCombatRewardFeedback();
    preCombatHandIdsRef.current = null;
    clearBattlePlaybackTimer();
    clearCombatIntroTimer();
    setCombatEntryPresentation(null);
    setBattlePlayback(null);
    clearCombatPlaybackSession();
    const { transition, events } = send({ type: "CONTINUE" });
    recruitEntryTokenRef.current += 1;
    const entry = createRecruitEntryPresentation({
      before,
      after: transition.state,
      accepted: transition.accepted,
      token: recruitEntryTokenRef.current,
      rewardHandInstanceIds: rewardIds,
    });
    if (entry) {
      pendingRecruitEntryFeedbackRef.current = {
        rewardNotice,
        rewardIds: [...entry.rewardHandInstanceIds],
        presentationEvents: events,
      };
      setRecruitEntryPresentation(entry);
      return;
    }

    pendingRecruitEntryFeedbackRef.current = null;
    setRecruitEntryPresentation(null);
    if (transition.accepted && transition.state.phase === "recruit") {
      enqueueRecruitPresentationEvents(events);
      if (rewardNotice) {
        const afterHuman = transition.state.players.find(
          (player) => player.id === transition.state.humanPlayerId,
        );
        const afterHandIds = new Set(
          afterHuman?.hand.map((card) => card.instanceId) ?? [],
        );
        setCombatRewardNotice(rewardNotice);
        setNewCombatRewardIds(
          rewardIds.filter((instanceId) => afterHandIds.has(instanceId)),
        );
      }
    }
  }, [
    battle,
    clearBattlePlaybackTimer,
    clearCombatIntroTimer,
    clearCombatRewardFeedback,
    enqueueRecruitPresentationEvents,
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
    const next = createLobbyGame(seed, configuredInitialHealth);
    safeWriteLocalStorage(SAVE_KEY, JSON.stringify(next));
    gameRef.current = next;
    setGame(next);
    setStarted(true);
    setLoaded(true);
    setSelection(null);
    setHeroPowerTargeting(false);
    setSelectedStandingPlayerId(null);
    setShowRestart(false);
    setShowLobbyOverview(false);
    setInfoTab("details");
    setMagneticAnnouncement("");
    setHeroPowerPresentation(null);
    setSpellCastPresentation(null);
    setBattlePlayback(null);
    clearCombatPlaybackSession();
    setRecruitPresentationQueue([]);
    setRecruitEntryPresentation(null);
    setHeroChoicePresentation(null);
    setTrinketChoicePresentation(null);
    setTrinketChoiceHudTravel({ x: 0, y: 0 });
    setDiscoverChoicePresentation(null);
    setHiddenDiscoverInteractionId(null);
    resolvingHeroChoiceInteractionRef.current = null;
    resolvingTrinketChoiceInteractionRef.current = null;
    pendingTrinketRecruitPresentationRef.current = null;
    resolvingDiscoverInteractionRef.current = null;
    pendingDiscoverRecruitPresentationRef.current = null;
    pendingHeroPowerRecruitPresentationRef.current = null;
    pendingSpellCastRecruitPresentationRef.current = null;
    deferredDiscoverTripleFocusPhaseRef.current = null;
    pendingRecruitEntryFeedbackRef.current = null;
    setCombatEntryPresentation(null);
    clearCombatRewardFeedback();
    restartReturnFocusRef.current = null;
    lobbyOverviewReturnFocusRef.current = null;
    magneticFocusTargetRef.current = null;
    preCombatHandIdsRef.current = null;
  }, [
    clearBattlePlaybackTimer,
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
      const castMotion = captureSpellCastMotion(
        card.instanceId,
        target?.instanceId,
      );
      const { transition, events, motion: recruitMotion } = send(
        {
          type: "CAST_TAVERN_SPELL",
          cardInstanceId,
          targetInstanceId,
        },
        { deferRecruitPresentation: true },
      );
      if (!transition.accepted) return;

      spellCastPresentationTokenRef.current += 1;
      const presentationState = createSpellCastPresentation({
        accepted: transition.accepted,
        token: spellCastPresentationTokenRef.current,
        cardInstanceId: card.instanceId,
        cardKind: "tavernSpell",
        cardName: card.name,
        ...(target
          ? {
              targetInstanceId: target.instanceId,
              targetName: target.name,
            }
          : {}),
      });
      if (!presentationState) {
        enqueueRecruitPresentationEvents(events, recruitMotion);
        return;
      }
      pendingSpellCastRecruitPresentationRef.current =
        events.length > 0 ? { events, motion: recruitMotion } : null;
      setSpellCastPresentation({
        state: presentationState,
        card: { ...card },
        targetCard: target ? { ...target } : null,
        motion: castMotion,
      });
      setMagneticAnnouncement(
        target
          ? `已对${target.name}施放${card.name}`
          : `已施放${card.name}：${card.description}`,
      );
    },
    [
      enqueueRecruitPresentationEvents,
      game,
      human.board,
      human.hand,
      human.id,
      human.shop,
      send,
    ],
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
      const spellLabel = spellcraftDisplayLabel(card);
      const castMotion = captureSpellCastMotion(
        card.instanceId,
        target?.instanceId,
      );
      const { transition, events, motion: recruitMotion } = send(
        {
          type: "CAST_SPELLCRAFT",
          cardInstanceId,
          targetInstanceId,
        },
        { deferRecruitPresentation: true },
      );
      if (!transition.accepted) return;

      spellCastPresentationTokenRef.current += 1;
      const presentationState = createSpellCastPresentation({
        accepted: transition.accepted,
        token: spellCastPresentationTokenRef.current,
        cardInstanceId: card.instanceId,
        cardKind: "spellcraft",
        cardName: card.name,
        ...(target
          ? {
              targetInstanceId: target.instanceId,
              targetName: target.name,
            }
          : {}),
      });
      if (!presentationState) {
        enqueueRecruitPresentationEvents(events, recruitMotion);
        return;
      }
      pendingSpellCastRecruitPresentationRef.current =
        events.length > 0 ? { events, motion: recruitMotion } : null;
      setSpellCastPresentation({
        state: presentationState,
        card: { ...card },
        targetCard: target ? { ...target } : null,
        motion: castMotion,
      });
      setMagneticAnnouncement(
        target
          ? `已对${target.name}施放${spellLabel}${card.name}`
          : `已施放${spellLabel}${card.name}：${card.description}`,
      );
    },
    [
      enqueueRecruitPresentationEvents,
      game,
      human.board,
      human.hand,
      human.id,
      human.shop,
      send,
    ],
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
      if (game.phase === "combat" && !battlePlaybackResultUnlocked) {
        return;
      }
      setSelection(null);
      setSelectedStandingPlayerId(playerId);
      setInfoTab("scouting");
    },
    [battlePlaybackResultUnlocked, game.phase],
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
  const alivePlayersAtDamageCapSnapshot =
    game.phase === "combat" && battle
      ? (battle.alivePlayersAtCombatStart ??
        game.players.filter((player) => player.alive).length)
      : game.players.filter((player) => player.alive).length;
  const currentDamageCap =
    game.phase === "combat" && battle && battle.damageCap !== undefined
      ? battle.damageCap
      : getSoloCombatDamageCap(game.round, alivePlayersAtDamageCapSnapshot);
  const damageCapStatusText =
    currentDamageCap === null
      ? "已进入前四，战斗伤害上限已解除"
      : `当前战斗伤害上限 ${currentDamageCap} 点${
          currentDamageCap === 5
            ? "，第 4 回合提高至 10 点"
            : currentDamageCap === 10
              ? "，第 8 回合提高至 15 点"
              : "，进入前四后解除"
        }`;
  const cappedHeroDamageEvent = battle?.events.find(
    (event) =>
      event.type === "heroDamage" &&
      (event.damagePreventedByCap ?? 0) > 0,
  );
  const activeRecruitCurrencies =
    activeRecruitPresentation?.events.filter(
      (event) => event.kind === "currency",
    ) ?? [];
  const activeRecruitCurrency = activeRecruitCurrencies[0];
  const activeRecruitMove = activeRecruitPresentation?.events.find(
    (event) => event.kind === "cardMove",
  );
  const activeRecruitArrival =
    activeRecruitMove?.kind === "cardMove" &&
    activeRecruitMove.motion === "hand-to-board" &&
    activeRecruitMove.card.kind === "minion"
      ? activeRecruitMove
      : null;
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
  const activeRecruitTriple = activeRecruitTriples[0] ?? null;
  const activeTripleForge =
    activeRecruitPresentation?.tripleForge ?? null;
  const pendingTripleGoldenIds = new Set(
    recruitPresentationQueue.flatMap((presentation) =>
      presentation.events.flatMap((event) =>
        event.kind === "triple" ? [event.golden.instanceId] : [],
      ),
    ),
  );
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
  const tripleForgeHasTakenOver =
    activeTripleForge !== null &&
    activeTripleForge.stage !== "acquireHandoff";
  const activeRecruitAction =
    tripleForgeHasTakenOver
      ? "triple-merge"
      : activeRecruitMove?.kind === "cardMove"
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
    tripleForgeHasTakenOver && activeRecruitTriple?.kind === "triple"
      ? `三连 · ${activeRecruitTriple.golden.name}`
      : activeRecruitMove?.kind === "cardMove"
      ? activeRecruitMove.motion === "shop-to-hand"
        ? `购买 · ${activeRecruitMove.card.name}`
        : activeRecruitMove.motion === "hand-to-board"
          ? `打出 · ${activeRecruitMove.card.name}`
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
  const recruitEntryStage = recruitEntryPresentation?.stage ?? null;
  const recruitEntryShowsPreviousGold =
    recruitEntryStage === "curtain" ||
    recruitEntryStage === "roundBanner" ||
    recruitEntryStage === "shopReveal";
  const displayedGold = recruitEntryShowsPreviousGold
    ? recruitEntryPresentation?.previousGold ?? human.gold
    : recruitEntryPresentation?.gold ?? human.gold;
  const defaultGoldCapacity = Math.max(
    human.gold,
    Math.min(human.maxGold, game.round + 2),
  );
  const displayedGoldCapacity = recruitEntryShowsPreviousGold
    ? recruitEntryPresentation?.previousMaxGold ?? defaultGoldCapacity
    : recruitEntryPresentation?.maxGold ?? defaultGoldCapacity;
  const goldPipCount = Math.min(12, Math.max(0, displayedGoldCapacity));
  const goldRefillActive = recruitEntryStage === "goldRefill";

  return (
    <main
      className={`game-shell${dragSession?.active ? " is-dragging" : ""}${
        interactionLocked ? " has-pending-interaction" : ""
      }${
        activeRecruitPresentation ? " has-recruit-presentation" : ""
      }${
        recruitEntryPresentation ? " has-recruit-entry" : ""
      }`}
      style={
        {
          "--combat-attack-duration": `${320 / battleSpeed}ms`,
          "--combat-charge-duration": `${360 / battleSpeed}ms`,
          "--combat-collision-duration": `${160 / battleSpeed}ms`,
          "--combat-rebound-duration": `${180 / battleSpeed}ms`,
        } as CSSProperties
      }
      data-phase={game.phase}
      data-loaded={loaded}
      data-dragging={dragSession?.active === true}
      data-combat-stage={combatPresentationStage ?? "none"}
      data-recruit-entry-stage={recruitEntryStage ?? "none"}
      data-recruit-entry-fresh-offers={
        recruitEntryPresentation?.freshOfferInstanceIds.length ?? 0
      }
      data-recruit-entry-retained-offers={
        recruitEntryPresentation?.retainedOfferInstanceIds.length ?? 0
      }
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
          className="hud-stat damage-cap"
          aria-label={damageCapStatusText}
          data-damage-cap={currentDamageCap ?? "none"}
          data-stat="damage-cap"
          data-testid="combat-damage-cap"
          role="status"
          title={damageCapStatusText}
        >
          <small>伤害上限</small>
          <strong>{currentDamageCap ?? "无"}</strong>
        </div>
        <div
          className={`hud-stat gold${
            activeRecruitCurrency?.currency === "gold"
              ? activeRecruitCurrency.delta < 0
                ? " is-spending"
                : " is-earning"
              : ""
          }${goldRefillActive ? " is-refilling" : ""}`}
          aria-label={`金币 ${displayedGold} / ${displayedGoldCapacity}`}
          data-displayed-gold={displayedGold}
          data-displayed-max-gold={displayedGoldCapacity}
          data-stat="gold"
          data-testid="human-gold"
        >
          <small>金币</small>
          <strong>
            {displayedGold} / {displayedGoldCapacity}
          </strong>
          <span
            className="gold-refill-track"
            aria-hidden="true"
            data-testid="gold-refill-track"
          >
            {Array.from({ length: goldPipCount }, (_, index) => {
              const wasFilled =
                index <
                (recruitEntryPresentation?.previousGold ?? displayedGold);
              const isFilled = index < displayedGold;
              const isNew = goldRefillActive && isFilled && !wasFilled;
              return (
                <span
                  className={`gold-refill-pip${
                    isFilled ? " is-filled" : ""
                  }${wasFilled ? " was-filled" : ""}${
                    isNew ? " is-new" : ""
                  }`}
                  key={`gold-pip-${index}`}
                  style={{ "--gold-pip-index": index } as CSSProperties}
                />
              );
            })}
            {displayedGoldCapacity > goldPipCount && (
              <span className="gold-refill-overflow">
                +{displayedGoldCapacity - goldPipCount}
              </span>
            )}
          </span>
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
          <strong>{human.tavernTier} / {maximumTavernTier}</strong>
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
            title={`${humanHeroPower?.name ?? "英雄技能"} · ${humanHeroPowerCost} 金币${!humanHeroPowerAffordable ? " · 金币不足" : !humanHeroPowerUsable ? " · 当前条件不满足" : ""}`}
            onClick={() => doActivateHeroPower()}
            disabled={!humanHeroPowerUsable || heroPowerTargeting}
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
              humanHeroPowerUsedThisTurn
                ? " is-used"
                : humanHeroPowerActive
                  ? " is-locked"
                  : ""
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
            <span className="trinket-hud-slots" aria-hidden="true">
              <span
                className={`trinket-hud-slot${
                  lesserTrinket ? " is-filled" : ""
                }`}
                data-testid="trinket-hud-slot-lesser"
              >
                {lesserTrinket ? (
                  <CardArtwork unit={lesserTrinket} kind="portrait" />
                ) : (
                  "小"
                )}
              </span>
              <span
                className={`trinket-hud-slot${
                  greaterTrinket ? " is-filled" : ""
                }`}
                data-testid="trinket-hud-slot-greater"
              >
                {greaterTrinket ? (
                  <CardArtwork unit={greaterTrinket} kind="portrait" />
                ) : (
                  "大"
                )}
              </span>
            </span>
            <span className="trinket-hud-copy">
              <small>饰品</small>
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
              const { transition } = send({ type: "END_TURN" });
              const nextTimeline =
                transition.accepted &&
                transition.state.phase === "combat" &&
                transition.state.lastBattle
                  ? createCombatPlaybackTimeline(
                      transition.state.lastBattle,
                    )
                  : null;
              setBattlePlayback(null);
              clearCombatPlaybackSession();
              setCombatEntryPresentation(
                nextTimeline
                  ? createCombatEntryPresentation(nextTimeline.battleKey)
                  : null,
              );
            }}
          >
            {game.phase === "recruit" ? "结束回合" : "战斗中"}
          </button>
        </div>
      </header>

      <div
        className="main-grid"
        inert={
          modalInteractionLocked ||
          recruitEntryPresentation !== null ||
          discoverChoicePresentation !== null ||
          recruitPresentationBlocksInteraction ||
          combatIntroActive ||
          pageModalOpen
        }
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
                  className="tavern-control"
                  data-testid="upgrade-tavern"
                  disabled={
                    game.phase !== "recruit" ||
                    interactionLocked ||
                    human.tavernTier >= maximumTavernTier ||
                    human.gold < upgradeCost
                  }
                  onClick={() => send({ type: "UPGRADE_TAVERN" })}
                >
                  <span className="tavern-control-icon" aria-hidden="true">★</span>
                  <span className="tavern-control-label">
                    <strong>
                      {human.tavernTier >= maximumTavernTier
                        ? "酒馆已满级"
                        : `升至 ${human.tavernTier + 1}星`}
                    </strong>
                  </span>
                  {human.tavernTier < maximumTavernTier && (
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
                      heroPowerTarget={
                        heroPowerTargeting &&
                        (humanHeroPowerTargetMode === "shop" ||
                          humanHeroPowerTargetMode === "shopOrBoard") &&
                        heroPowerTargetValidIds.has(offer.unit.instanceId)
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
                        if (
                          heroPowerTargeting &&
                          (humanHeroPowerTargetMode === "shop" ||
                            humanHeroPowerTargetMode === "shopOrBoard") &&
                          heroPowerTargetValidIds.has(offer.unit.instanceId)
                        ) {
                          onHeroPowerTargetClick(offer.unit.instanceId);
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
                    humanHeroPowerTargetMode === "board" ||
                    humanHeroPowerTargetMode === "shopOrBoard"
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
                    className={`combat-playback${
                      battlePlaybackPaused ? " is-paused" : ""
                    }`}
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
                      >
                        战斗事件 {revealedBattleEventCount} /{" "}
                        {playbackEventCount}
                        {battlePlaybackPaused && (
                          <span className="combat-playback-state">
                            已暂停
                          </span>
                        )}
                      </span>
                      <input
                        type="range"
                        className="combat-playback-scrubber"
                        min={0}
                        max={furthestRevealedBattleEventCount}
                        value={Math.min(
                          revealedBattleEventCount,
                          furthestRevealedBattleEventCount,
                        )}
                        aria-label={`战斗回放进度，已显示 ${revealedBattleEventCount} / ${playbackEventCount} 个事件`}
                        data-testid="battle-playback-scrubber"
                        onChange={(event) =>
                          seekBattlePlayback(Number(event.currentTarget.value))
                        }
                      />
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
                        {currentDamageCapLabel && (
                          <span
                            className="combat-damage-cap-mark"
                            data-testid="combat-damage-cap-mark"
                          >
                            {currentDamageCapLabel}
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
                        className="combat-control-button"
                        aria-label="重新播放本场战斗"
                        title="重新播放本场战斗"
                        data-testid="battle-replay-restart"
                        onClick={replayBattlePlayback}
                      >
                        ↺
                      </button>
                      <button
                        type="button"
                        className="combat-control-button"
                        aria-label="上一个战斗事件"
                        title="上一个战斗事件"
                        data-testid="battle-step-back"
                        disabled={revealedBattleEventCount <= 0}
                        onClick={stepBattlePlaybackBackward}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="combat-control-button combat-play-pause-button"
                        aria-pressed={battlePlaybackPaused}
                        data-testid="battle-play-pause"
                        onClick={toggleBattlePlayback}
                      >
                        {battlePlaybackPaused ? "继续" : "暂停"}
                      </button>
                      <button
                        type="button"
                        className="combat-control-button"
                        aria-label="下一个战斗事件"
                        title="下一个战斗事件"
                        data-testid="battle-step-forward"
                        onClick={stepBattlePlaybackForward}
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        className={`combat-speed-button${
                          battleSpeed === 1 ? " is-active" : ""
                        }`}
                        aria-pressed={battleSpeed === 1}
                        data-testid="battle-speed-1"
                        onClick={() => changeBattleSpeed(1)}
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
                        onClick={() => changeBattleSpeed(2)}
                      >
                        2×
                      </button>
                      <button
                        type="button"
                        className={`combat-speed-button${
                          battleSpeed === 4 ? " is-active" : ""
                        }`}
                        aria-pressed={battleSpeed === 4}
                        data-testid="battle-speed-4"
                        onClick={() => changeBattleSpeed(4)}
                      >
                        4×
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
                      {cappedHeroDamageEvent && (
                        <span
                          className="combat-damage-cap-summary"
                          data-testid="combat-damage-cap-summary"
                        >
                          原始 {cappedHeroDamageEvent.uncappedAmount} 点 · 上限{" "}
                          {cappedHeroDamageEvent.damageCap} · 减免{" "}
                          {cappedHeroDamageEvent.damagePreventedByCap}
                        </span>
                      )}
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
                    <div className="combat-banner-actions">
                      <button
                        type="button"
                        className="action-button secondary"
                        data-testid="battle-result-step-back"
                        onClick={stepBattlePlaybackBackward}
                      >
                        上一条
                      </button>
                      <button
                        type="button"
                        className="action-button secondary"
                        data-testid="battle-result-replay"
                        onClick={replayBattlePlayback}
                      >
                        重新播放
                      </button>
                      <button
                        type="button"
                        className="action-button primary"
                        data-testid="continue-after-combat"
                        onClick={continueAfterCombat}
                      >
                        {human.alive ? "继续招募" : "查看最终名次"}
                      </button>
                    </div>
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
                recruitArrivalInstanceId={
                  activeRecruitArrival?.card.instanceId
                }
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
                  humanHeroPowerTargetMode === "board" ||
                  humanHeroPowerTargetMode === "shopOrBoard"
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
                    discoverRewardPending={
                      pendingDiscoverRewardInstanceId === card.instanceId
                    }
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
                    discoverRewardPending={
                      pendingDiscoverRewardInstanceId === card.instanceId
                    }
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
                    discoverRewardPending={
                      pendingDiscoverRewardInstanceId === card.instanceId
                    }
                    tripleForgePending={pendingTripleGoldenIds.has(
                      card.instanceId,
                    )}
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
                  game.phase === "combat" &&
                  effectiveBattlePlayback?.status === "playing"
                    ? "off"
                    : "polite"
                }
              >
                {revealedBattleLogEvents.length ? (
                  revealedBattleLogEvents.slice(-80).map((event) => {
                    const revealCount = battle
                      ? combatPlaybackRevealCountForEvent(
                          battle.events,
                          event.index,
                        )
                      : null;
                    const canSeekToEvent =
                      game.phase === "combat" &&
                      revealCount !== null &&
                      revealCount <= furthestRevealedBattleEventCount;
                    const content = (
                      <>
                        <strong>{event.index + 1}</strong> {event.message}
                      </>
                    );
                    return canSeekToEvent ? (
                      <button
                        type="button"
                        className="battle-log-event"
                        aria-current={
                          !battlePlaybackComplete &&
                          revealedBattleEventCount === revealCount
                            ? "step"
                            : undefined
                        }
                        data-testid={`battle-log-event-${revealCount}`}
                        key={`${battle?.round ?? "battle"}-${event.index}`}
                        onClick={() => seekBattlePlayback(revealCount)}
                      >
                        {content}
                      </button>
                    ) : (
                      <p
                        className="battle-log-event"
                        key={`${battle?.round ?? "battle"}-${event.index}`}
                      >
                        {content}
                      </p>
                    );
                  })
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

      {recruitEntryPresentation &&
        recruitEntryPresentation.stage !== "complete" && (
          <section
            className={`recruit-entry-intro stage-${recruitEntryPresentation.stage}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={recruitEntryAnnouncement(recruitEntryPresentation)}
            data-round={recruitEntryPresentation.round}
            data-stage={recruitEntryPresentation.stage}
            data-testid="recruit-entry-intro"
            data-transition-key={recruitEntryPresentation.transitionKey}
          >
            <span className="recruit-entry-rays" aria-hidden="true" />
            <div className="recruit-entry-ribbon">
              <span className="recruit-entry-round">
                第 {recruitEntryPresentation.round} 回合
              </span>
              <strong className="recruit-entry-title">招募阶段</strong>
              <span className="recruit-entry-subtitle">
                {recruitEntryPresentation.stage === "curtain"
                  ? "战斗结算完毕"
                  : recruitEntryPresentation.stage === "roundBanner"
                    ? "返回鲍勃的酒馆"
                    : recruitEntryPresentation.stage === "shopReveal"
                      ? `酒馆 ${recruitEntryPresentation.tavernTier} 星 · 商店报价就绪`
                      : `金币补充至 ${recruitEntryPresentation.gold} / ${recruitEntryPresentation.maxGold}`}
              </span>
            </div>
            <button
              type="button"
              className="recruit-entry-skip"
              data-testid="skip-recruit-entry"
              onClick={() =>
                setRecruitEntryPresentation((current) =>
                  transitionRecruitEntryPresentation(current, {
                    type: "skip",
                    expectedKey: recruitEntryPresentation.transitionKey,
                  }),
                )
              }
            >
              跳过动画
            </button>
          </section>
        )}

      {combatIntroActive &&
        combatEntryStage !== "complete" &&
        battle &&
        introOpponent && (
        <section
          className={`combat-start-intro stage-${combatEntryStage}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`第 ${battle.round} 回合，开始战斗，对阵${
            introOpponent.opponentIsGhost ? "幽灵" : ""
          }${introOpponent.opponentName}；${
            combatEntryStage === "versusReveal"
              ? "正在揭示双方英雄"
              : combatEntryStage === "warbandReveal"
                ? "双方初始阵容已揭示，首次攻击尚未开始"
                : "阵容阅读完毕，准备首次攻击"
          }`}
          data-friendly-board-count={friendlyCombatBoard.length}
          data-opponent-board-count={opponentInitialBoard.length}
          data-stage={combatEntryStage}
          data-testid="combat-start-intro"
        >
          <div className="combat-start-stage">
            <span className="combat-start-round">
              第 {battle.round} 回合
            </span>
            <div className="combat-start-versus" aria-hidden="true">
              <article className="combat-start-hero is-friendly">
                <span className="combat-start-hero-art">
                  {humanHero ? (
                    <CardArtwork unit={humanHero} kind="portrait" />
                  ) : (
                    <span className="art-fallback">{human.name}</span>
                  )}
                </span>
                <strong>{human.name}</strong>
                <span>{humanHero?.name ?? "你的英雄"}</span>
              </article>
              <span className="combat-start-versus-mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="combat-start-emblem"
                  src="/ui/battle-crossed-weapons.webp"
                  alt=""
                  draggable={false}
                />
                <b>VS</b>
              </span>
              <article className="combat-start-hero is-opponent">
                <span className="combat-start-hero-art">
                  {opponentHero ? (
                    <CardArtwork unit={opponentHero} kind="portrait" />
                  ) : (
                    <span className="art-fallback">
                      {introOpponent.opponentName}
                    </span>
                  )}
                </span>
                <strong>{introOpponent.opponentName}</strong>
                <span>
                  {introOpponent.opponentIsGhost
                    ? "幽灵阵容"
                    : opponentHero?.name ?? "对手英雄"}
                </span>
              </article>
            </div>
            <div className="combat-start-banner">
              <strong>
                {combatEntryStage === "versusReveal"
                  ? "开始战斗"
                  : combatEntryStage === "warbandReveal"
                    ? "双方阵容"
                    : "准备攻击"}
              </strong>
              <span>
                {combatEntryStage === "versusReveal"
                  ? `对阵 ${
                      introOpponent.opponentIsGhost ? "幽灵 · " : ""
                    }${introOpponent.opponentName}`
                  : combatEntryStage === "warbandReveal"
                    ? `你的 ${friendlyCombatBoard.length} 名随从 · 对手 ${opponentInitialBoard.length} 名随从`
                    : "首次攻击即将开始"}
              </span>
              {introOpponent.opponentIsGhost && (
                <small>
                  幽灵不会受到伤害
                </small>
              )}
            </div>
            <span className="combat-start-status">
              {combatEntryStage === "versusReveal"
                ? "正在切换至战斗阵型"
                : combatEntryStage === "warbandReveal"
                  ? "查看双方开战阵容"
                  : "阵容已锁定"}
            </span>
          </div>
          <button
            type="button"
            className="combat-start-skip"
            data-testid="skip-combat-entry"
            onClick={() =>
              setCombatEntryPresentation((current) =>
                transitionCombatEntryPresentation(current, {
                  type: "skip",
                  expectedBattleKey: battleKey ?? "",
                }),
              )
            }
          >
            跳过动画
          </button>
        </section>
      )}

      <span className="sr-only" id="drag-instructions">
        可按住并拖动。商店随从拖到手牌区域购买；普通手牌拖到战场插位线上场；磁力随从拖到标有“可吸附”的友方随从进行吸附，拖到插位线则普通上场；场上随从可拖动换位，或拖到鲍勃的酒馆出售。也可点击卡牌后使用详情面板中的按钮。
      </span>
      <span className="sr-only" id="magnetic-target-instructions">
        这是当前磁力牌的合法目标。点击或按回车键即可完成吸附；按 Escape 键取消选择。
      </span>
      <span className="sr-only" id="hero-power-target-instructions">
        这是当前英雄技能的合法目标。点击或按回车键即可确认；按 Escape 键取消选择。
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

      {heroPowerPresentation && (
        <div
          className={`hero-power-presentation stage-${heroPowerPresentation.state.stage}`}
          data-hero-power-stage={heroPowerPresentation.state.stage}
          data-hero-power-id={heroPowerPresentation.state.heroPowerId}
          data-testid="hero-power-presentation"
          role="group"
          aria-label={`英雄技能激活演出：${heroPowerPresentation.state.powerName}`}
          key={`hero-power-${heroPowerPresentation.state.token}`}
        >
          {heroPowerPresentation.target && (
            <>
              <svg
                className="hero-power-presentation-target-arc"
                width="100%"
                height="100%"
                aria-hidden="true"
                data-testid="hero-power-presentation-target-arc"
              >
                <path
                  d={heroPowerPresentationTargetPath(
                    heroPowerPresentation.geometry,
                    heroPowerPresentation.target.geometry,
                  )}
                />
              </svg>
              <div
                className="hero-power-presentation-target-impact"
                data-testid="hero-power-presentation-target-impact"
                data-target-instance-id={
                  heroPowerPresentation.target.instanceId
                }
                data-target-zone={heroPowerPresentation.target.zone}
                aria-hidden="true"
                style={{
                  left: heroPowerPresentation.target.geometry.left,
                  top: heroPowerPresentation.target.geometry.top,
                  width: heroPowerPresentation.target.geometry.width,
                  height: heroPowerPresentation.target.geometry.height,
                }}
              >
                <span className="hero-power-presentation-target-ring" />
                {heroPowerPresentation.state.heroPowerId ===
                  "hero-power-tb_baconshop_hp_010" && (
                  <span
                    className="hero-power-presentation-divine-shield-bloom"
                    data-testid="hero-power-presentation-divine-shield-bloom"
                  >
                    <span />
                  </span>
                )}
                <strong>{heroPowerPresentation.target.name}</strong>
              </div>
            </>
          )}
          <div
            className="hud-hero-power hero-power-presentation-source"
            data-testid="hero-power-presentation-source"
            aria-hidden="true"
            style={{
              left: heroPowerPresentation.geometry.left,
              top: heroPowerPresentation.geometry.top,
              width: heroPowerPresentation.geometry.width,
              height: heroPowerPresentation.geometry.height,
              maxWidth: "none",
            }}
          >
            {humanHero && (
              <span className="hero-hud-portrait">
                <CardArtwork unit={humanHero} kind="portrait" />
              </span>
            )}
            <small>{heroPowerPresentation.state.heroName}</small>
            <strong>{heroPowerPresentation.state.powerName}</strong>
            <span className="hero-power-presentation-status">
              {heroPowerPresentation.state.stage === "sourcePulse"
                ? "正在发动"
                : heroPowerPresentation.state.stage === "resourceCommit"
                  ? "费用与使用状态已更新"
                  : heroPowerPresentation.target
                    ? "目标已锁定"
                    : "技能效果已结算"}
            </span>
            <span className="hero-power-cost-badge">
              {heroPowerPresentation.state.cost} 币
            </span>
            {heroPowerPresentation.state.stage === "resourceCommit" &&
              heroPowerPresentation.state.cost > 0 && (
                <span className="hero-power-presentation-cost-delta">
                  -{heroPowerPresentation.state.cost}
                </span>
              )}
            <span className="hero-power-presentation-ring" />
            <span className="hero-power-presentation-core" />
            <span className="hero-power-presentation-sparks" />
          </div>
          <span
            className="sr-only"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
          >
            {heroPowerPresentationAnnouncement(
              heroPowerPresentation.state,
            )}
          </span>
          <button
            type="button"
            className="hero-power-presentation-skip"
            data-testid="skip-hero-power-presentation"
            onClick={() => {
              const expectedToken = heroPowerPresentation.state.token;
              const expectedHeroPowerId =
                heroPowerPresentation.state.heroPowerId;
              setHeroPowerPresentation((current) => {
                if (!current) return null;
                const next = transitionHeroPowerPresentation(
                  current.state,
                  {
                    type: "skip",
                    expectedToken,
                    expectedHeroPowerId,
                  },
                );
                if (next === current.state) return current;
                return next ? { ...current, state: next } : null;
              });
            }}
          >
            跳过技能动画
          </button>
        </div>
      )}

      {spellCastPresentation && (
        <div
          className={`spell-cast-presentation stage-${spellCastPresentation.state.stage}`}
          data-card-kind={spellCastPresentation.state.cardKind}
          data-impact-scope={spellCastPresentation.motion.impactScope}
          data-spell-cast-stage={spellCastPresentation.state.stage}
          data-target-instance-id={
            spellCastPresentation.state.targetInstanceId ?? undefined
          }
          data-testid="spell-cast-presentation"
          role="group"
          aria-label={`${
            spellCastPresentation.state.cardKind === "tavernSpell"
              ? "酒馆法术"
              : "塑造法术"
          }施放演出：${spellCastPresentation.state.cardName}`}
          key={`spell-cast-${spellCastPresentation.state.token}`}
        >
          <div
            className={`tavern-spell-card spell-cast-source-card${
              spellCastPresentation.state.cardKind === "spellcraft"
                ? " spellcraft-card"
                : ""
            }${
              spellCastPresentation.card.kind === "spellcraft" &&
              (spellCastPresentation.card.effectMultiplier ?? 1) > 1
                ? " is-golden"
                : ""
            }`}
            aria-hidden="true"
            data-testid="spell-cast-source-card"
            style={
              {
                "--card-hue":
                  spellCastPresentation.state.cardKind === "spellcraft"
                    ? 222
                    : 266,
                "--spell-lift-x": `${spellCastPresentation.motion.liftX}px`,
                "--spell-lift-y": `${spellCastPresentation.motion.liftY}px`,
                "--spell-release-x": `${spellCastPresentation.motion.releaseX}px`,
                "--spell-release-y": `${spellCastPresentation.motion.releaseY}px`,
                "--spell-travel-x": `${spellCastPresentation.motion.travelX}px`,
                "--spell-travel-y": `${spellCastPresentation.motion.travelY}px`,
                left: spellCastPresentation.motion.fromLeft,
                top: spellCastPresentation.motion.fromTop,
                width: spellCastPresentation.motion.fromWidth,
                height: spellCastPresentation.motion.fromHeight,
                maxWidth: "none",
              } as CSSProperties
            }
          >
            {spellCastPresentation.card.kind === "tavernSpell" ? (
              <TavernSpellCardFace card={spellCastPresentation.card} />
            ) : (
              <SpellcraftCardFace card={spellCastPresentation.card} />
            )}
          </div>
          {spellCastPresentation.targetCard && (
            <div
              className="unit-card is-compact spell-cast-target-snapshot"
              aria-hidden="true"
              data-testid="spell-cast-target-snapshot"
              style={
                {
                  "--card-hue":
                    TRIBE_HUE[spellCastPresentation.targetCard.tribe],
                  left: spellCastPresentation.motion.impactLeft,
                  top: spellCastPresentation.motion.impactTop,
                  width: spellCastPresentation.motion.impactWidth,
                  height: spellCastPresentation.motion.impactHeight,
                  maxWidth: "none",
                } as CSSProperties
              }
            >
              <UnitCardFace unit={spellCastPresentation.targetCard} />
            </div>
          )}
          <div
            className={`spell-cast-impact is-${spellCastPresentation.motion.impactScope}`}
            aria-hidden="true"
            data-testid="spell-cast-impact"
            style={{
              left: spellCastPresentation.motion.impactLeft,
              top: spellCastPresentation.motion.impactTop,
              width: spellCastPresentation.motion.impactWidth,
              height: spellCastPresentation.motion.impactHeight,
            }}
          >
            <span className="spell-cast-impact-ring" />
            <span className="spell-cast-impact-core" />
            <span className="spell-cast-impact-sparks" />
          </div>
          <span
            className="sr-only"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
          >
            {spellCastPresentationAnnouncement(
              spellCastPresentation.state,
            )}
          </span>
          <button
            type="button"
            className="spell-cast-skip"
            data-testid="skip-spell-cast-presentation"
            onClick={() => {
              const expectedToken = spellCastPresentation.state.token;
              const expectedCardInstanceId =
                spellCastPresentation.state.cardInstanceId;
              setSpellCastPresentation((current) => {
                if (!current) return null;
                const next = transitionSpellCastPresentation(
                  current.state,
                  {
                    type: "skip",
                    expectedToken,
                    expectedCardInstanceId,
                  },
                );
                if (next === current.state) return current;
                return next ? { ...current, state: next } : null;
              });
            }}
          >
            跳过动画
          </button>
        </div>
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
            data-board-index={activeRecruitMove.boardIndex}
            data-recruit-motion={activeRecruitMove.motion}
            data-triple-forge={activeTripleForge !== null || undefined}
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

      {activeRecruitTriple?.kind === "triple" && activeTripleForge && (
        <div
          className={`recruit-triple-stage stage-${activeTripleForge.stage}`}
          data-triple-stage={activeTripleForge.stage}
          data-testid="triple-forge"
          role="group"
          aria-label={`三连锻造：${activeRecruitTriple.golden.name}`}
          key={`triple-${activeRecruitPresentation?.token ?? 0}`}
        >
          <div
            className="recruit-triple-forge"
            data-known-consumed-count={
              activeRecruitTriple.knownConsumedInstanceIds.length
            }
            data-golden-instance-id={activeRecruitTriple.golden.instanceId}
          >
            <span className="recruit-triple-energy" aria-hidden="true" />
            <span
              className="recruit-triple-light-column"
              aria-hidden="true"
            />
            <span className="recruit-triple-smoke" aria-hidden="true" />
            <div
              className="unit-card recruit-triple-card"
              data-testid="triple-forge-card"
              data-golden-instance-id={activeRecruitTriple.golden.instanceId}
              style={
                {
                  "--card-hue": TRIBE_HUE[activeRecruitTriple.golden.tribe],
                  ...(activeRecruitPresentation?.tripleHandoff
                    ? {
                        "--triple-hand-x": `${activeRecruitPresentation.tripleHandoff.travelX}px`,
                        "--triple-hand-y": `${activeRecruitPresentation.tripleHandoff.travelY}px`,
                      }
                    : {}),
                } as CSSProperties
              }
            >
              <UnitCardFace unit={activeRecruitTriple.golden} />
            </div>
          </div>
          <span className="sr-only" role="status" aria-live="assertive">
            {tripleForgeStageAnnouncement(activeTripleForge.stage)}
          </span>
          <button
            type="button"
            className="recruit-triple-skip"
            data-testid="skip-triple-forge"
            onClick={() => {
              const expectedToken = activeTripleForge.token;
              const expectedGoldenInstanceId =
                activeTripleForge.goldenInstanceId;
              setRecruitPresentationQueue((current) => {
                const active = current[0];
                if (
                  !active ||
                  active.token !== expectedToken ||
                  active.tripleForge === null
                ) {
                  return current;
                }
                const next = transitionTripleForgePresentation(
                  active.tripleForge,
                  {
                    type: "skip",
                    expectedToken,
                    expectedGoldenInstanceId,
                  },
                );
                if (next === active.tripleForge) return current;
                if (next === null) return current.slice(1);
                return [
                  { ...active, tripleForge: next },
                  ...current.slice(1),
                ];
              });
            }}
          >
            跳过动画
          </button>
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

      {(heroChoiceInteraction || heroChoicePresentation) && (
        <div
          className="overlay interaction-overlay hero-choice-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hero-choice-title"
          aria-describedby="hero-choice-description"
          data-hero-choice-stage={heroChoiceStage}
          data-testid="hero-choice-dialog"
          onKeyDown={trapModalFocus}
        >
          {heroChoiceStage !== "lobbyReveal" ? (
            <div className="modal lobby-choice-modal hero-choice-modal">
              <span className="discover-kicker">
                {heroChoiceStage === "focus"
                  ? "英雄已锁定"
                  : "开局 · 四选一"}
              </span>
              <h2 className="discover-title" id="hero-choice-title">
                {selectedHeroChoice
                  ? `已选择 ${selectedHeroChoice.name}`
                  : "选择你的英雄"}
              </h2>
              <p className="discover-copy" id="hero-choice-description">
                {selectedHeroChoice
                  ? "选择已保存。你的英雄正在进入本局八人大厅。"
                  : "每位英雄拥有不同的英雄技能。选择会立即保存，并用于本局余下时间。"}
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
                {heroChoiceOptionIds.map((optionId, index) => {
                  const option = getHeroDefinition(optionId);
                  const power = getHeroPowerDefinition(option.heroPowerId);
                  const selectionState = heroChoicePresentation
                    ? option.id === heroChoicePresentation.selectedHeroId
                      ? "selected"
                      : "dismissed"
                    : "available";
                  return (
                    <button
                      type="button"
                      className="lobby-choice-card hero-choice-card"
                      data-hero-id={option.id}
                      data-selection-state={selectionState}
                      data-testid={`hero-choice-${index}`}
                      aria-pressed={selectionState === "selected"}
                      disabled={heroChoiceInteraction === null}
                      key={option.id}
                      onClick={() => {
                        if (!heroChoiceInteraction) return;
                        resolveHeroChoiceWithPresentation(
                          heroChoiceInteraction,
                          option.id,
                        );
                      }}
                      style={
                        {
                          "--hero-choice-index": index,
                        } as CSSProperties
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
          ) : selectedHeroChoice && selectedHeroChoicePower ? (
            <div
              className="hero-choice-confirmation"
              data-testid="hero-choice-confirmation"
            >
              <span className="discover-kicker">八人大厅</span>
              <h2 className="discover-title" id="hero-choice-title">
                {selectedHeroChoice.name}，准备入局
              </h2>
              <p className="discover-copy" id="hero-choice-description">
                七名 AI 对手已经就位，本局没有回合倒计时。
              </p>
              <div
                className="hero-choice-confirmed-card"
                data-hero-id={selectedHeroChoice.id}
              >
                <CardArtwork unit={selectedHeroChoice} kind="portrait" />
                <span>
                  <small>你的英雄</small>
                  <strong>{selectedHeroChoice.name}</strong>
                  <span>{selectedHeroChoicePower.name}</span>
                </span>
              </div>
              <div
                className="hero-choice-lobby-table"
                data-testid="hero-choice-lobby"
                aria-label="本局八名玩家的英雄"
              >
                {game.players.map((player, index) => {
                  const lobbyHero =
                    typeof player.heroId === "string" &&
                    isHeroDefinitionId(player.heroId)
                      ? getHeroDefinition(player.heroId)
                      : null;
                  return (
                    <div
                      className={`hero-choice-lobby-seat${
                        player.isHuman ? " is-human" : ""
                      }`}
                      data-hero-id={lobbyHero?.id}
                      data-player-id={player.id}
                      data-testid={`hero-choice-lobby-seat-${index}`}
                      key={player.id}
                      style={
                        {
                          "--hero-choice-seat-index": index,
                        } as CSSProperties
                      }
                    >
                      {lobbyHero ? (
                        <CardArtwork unit={lobbyHero} kind="portrait" />
                      ) : (
                        <span className="hero-choice-lobby-placeholder">
                          ?
                        </span>
                      )}
                      <span>
                        <small>{player.isHuman ? "你" : "AI"}</small>
                        <strong>{lobbyHero?.name ?? "英雄待定"}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {heroChoicePresentation && (
            <button
              type="button"
              className="hero-choice-skip"
              data-testid="skip-hero-choice-presentation"
              onClick={() =>
                setHeroChoicePresentation((current) =>
                  transitionHeroChoicePresentation(current, {
                    type: "skip",
                    expectedInteractionId:
                      heroChoicePresentation.interactionId,
                  }),
                )
              }
            >
              跳过动画
            </button>
          )}
          {heroChoicePresentation && (
            <span
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {heroChoicePresentation.stage === "focus"
                ? `已选择${selectedHeroChoice?.name ?? "英雄"}`
                : "八名玩家的英雄已经就位"}
            </span>
          )}
        </div>
      )}

      {trinketChoiceInteraction && (
        <div
          className={`overlay interaction-overlay trinket-selection-overlay stage-${trinketChoiceStage}${
            trinketChoicesHidden ? " is-peeking" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trinket-choice-title"
          aria-describedby="trinket-choice-description"
          aria-busy={trinketChoiceStage === "reveal"}
          data-stage={trinketChoiceStage}
          data-testid="trinket-choice-dialog"
          onKeyDown={(event) => {
            if (
              event.key === "Escape" &&
              trinketChoiceStage === "choosing"
            ) {
              event.preventDefault();
              toggleTrinketChoices();
              return;
            }
            trapModalFocus(event);
          }}
        >
          <div
            className="modal lobby-choice-modal trinket-choice-modal"
            inert={trinketChoicesHidden}
            aria-hidden={trinketChoicesHidden || undefined}
          >
            <span className="discover-kicker">
              饰品商店 · 第 {game.round} 回合 ·
              {trinketChoiceInteraction.trinketTier === "lesser"
                ? " 小型"
                : " 大型"}
            </span>
            <h2 className="discover-title" id="trinket-choice-title">
              {isMysteryCubeTrinketChoice
                ? "神秘魔方 · 更换小型饰品"
                : "选择一项并购买"}
            </h2>
            <p className="discover-copy" id="trinket-choice-description">
              {isMysteryCubeTrinketChoice
                ? "从两个新小型饰品中先点选一个，再确认免费替换。候选在确认前不会改变。"
                : `从本局 ${
                    ACTIVE_TRINKET_DEFINITIONS.filter(
                      (definition) =>
                        definition.tier ===
                        trinketChoiceInteraction.trinketTier,
                    ).length
                  } 件同级饰品中生成四个候选。点选只会高亮，按下确认后才会支付费用。`}
            </p>
            <div
              className="lobby-choice-options trinket-choice-options"
              data-option-count={trinketChoiceInteraction.optionIds.length}
              style={
                {
                  "--trinket-choice-columns":
                    trinketChoiceInteraction.optionIds.length,
                } as CSSProperties
              }
            >
              {trinketChoiceInteraction.optionIds.map(
                (optionId, index) => {
                  const option = getTrinketDefinition(optionId);
                  const affordable =
                    isMysteryCubeTrinketChoice || human.gold >= option.cost;
                  const selected = selectedTrinketChoiceId === option.id;
                  return (
                    <button
                      type="button"
                      className={`lobby-choice-card trinket-choice-card${
                        selected ? " is-selected" : ""
                      }${!affordable ? " is-unaffordable" : ""}`}
                      aria-label={`${option.name}，${
                        isMysteryCubeTrinketChoice
                          ? "免费替换"
                          : `${option.cost} 枚铸币`
                      }，${option.description}`}
                      aria-pressed={selected}
                      data-affordable={affordable}
                      data-selection-state={
                        selected ? "selected" : "available"
                      }
                      data-trinket-option-id={option.id}
                      data-testid={`trinket-choice-${index}`}
                      disabled={trinketChoiceStage !== "choosing"}
                      key={option.id}
                      style={
                        {
                          "--trinket-choice-delay": `${
                            120 + index * 58
                          }ms`,
                        } as CSSProperties
                      }
                      onClick={() => selectTrinketChoice(option.id)}
                    >
                      <span className="trinket-choice-cost-badge">
                        {isMysteryCubeTrinketChoice ? 0 : option.cost}
                      </span>
                      <CardArtwork unit={option} kind="portrait" />
                      <small>
                        {option.tier === "lesser"
                          ? "小型饰品"
                          : "大型饰品"}
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
                      <span className="trinket-choice-selection-mark">
                        {selected
                          ? "已选中"
                          : affordable
                            ? "点击选中"
                            : "可查看 · 金币不足"}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
            <div className="trinket-choice-confirmation">
              <span role="status" aria-live="polite">
                {selectedTrinketChoice
                  ? `${selectedTrinketChoice.name}已选中${
                      selectedTrinketChoiceAffordable
                        ? "，可以确认"
                        : "，但金币不足"
                    }`
                  : trinketChoiceStage === "reveal"
                    ? "正在揭示饰品候选"
                    : "请先选择一个饰品"}
              </span>
              <button
                type="button"
                className="trinket-choice-confirm"
                data-testid="confirm-trinket-choice"
                disabled={!trinketChoiceCanConfirm}
                onClick={confirmTrinketChoice}
              >
                确认
              </button>
            </div>
          </div>
          {trinketChoiceStage === "choosing" && (
            <button
              type="button"
              className="trinket-visibility-toggle"
              aria-pressed={!trinketChoicesHidden}
              data-testid="toggle-trinket-visibility"
              onClick={toggleTrinketChoices}
            >
              {trinketChoicesHidden ? "待选择 · 显示" : "隐藏"}
            </button>
          )}
          {trinketChoiceStage === "reveal" && (
            <button
              type="button"
              className="trinket-choice-skip"
              data-testid="skip-trinket-choice-reveal"
              onClick={() =>
                setTrinketChoicePresentation((current) =>
                  transitionTrinketChoicePresentation(current, {
                    type: "skip",
                    expectedInteractionId:
                      trinketChoiceInteraction.interactionId,
                  }),
                )
              }
            >
              跳过揭示
            </button>
          )}
        </div>
      )}

      {trinketChoicePresentationBlocksInteraction &&
        trinketChoicePresentation &&
        presentedTrinketChoice && (
          <div
            className={`overlay trinket-choice-presentation-overlay stage-${trinketChoicePresentation.stage}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trinket-choice-presentation-title"
            data-stage={trinketChoicePresentation.stage}
            data-testid="trinket-choice-presentation"
            onKeyDown={trapModalFocus}
          >
            <div className="trinket-choice-return-scene">
              <span
                className="trinket-choice-return-label"
                id="trinket-choice-presentation-title"
              >
                {trinketChoicePresentation.stage === "confirmFocus"
                  ? "饰品已获得"
                  : "装备到饰品槽"}
              </span>
              <div
                className="lobby-choice-card trinket-choice-card trinket-choice-acquired-card"
                data-testid="trinket-choice-acquired-card"
                style={
                  {
                    "--trinket-fly-x": `${trinketChoiceHudTravel.x}px`,
                    "--trinket-fly-y": `${trinketChoiceHudTravel.y}px`,
                  } as CSSProperties
                }
              >
                <span className="trinket-choice-cost-badge">
                  {trinketChoicePresentation.paidCost ?? 0}
                </span>
                <CardArtwork
                  unit={presentedTrinketChoice}
                  kind="portrait"
                />
                <small>
                  {presentedTrinketChoice.tier === "lesser"
                    ? "小型饰品"
                    : "大型饰品"}
                </small>
                <strong>{presentedTrinketChoice.name}</strong>
                <span>{presentedTrinketChoice.description}</span>
                <span className="trinket-choice-acquired-outcome">
                  {(trinketChoicePresentation.paidCost ?? 0) > 0
                    ? `支付 ${trinketChoicePresentation.paidCost} 枚铸币 · 剩余 ${trinketChoicePresentation.goldAfter}`
                    : `免费获得 · 当前 ${trinketChoicePresentation.goldAfter} 枚铸币`}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="trinket-choice-skip"
              data-testid="skip-trinket-choice-presentation"
              onClick={() =>
                setTrinketChoicePresentation((current) =>
                  transitionTrinketChoicePresentation(current, {
                    type: "skip",
                    expectedInteractionId:
                      trinketChoicePresentation.interactionId,
                  }),
                )
              }
            >
              跳过动画
            </button>
            <span
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {trinketChoicePresentation.stage === "confirmFocus"
                ? `已获得${presentedTrinketChoice.name}`
                : `${presentedTrinketChoice.name}正在进入饰品槽`}
            </span>
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

      {secretChoiceInteraction && (
        <div
          className="overlay interaction-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="secret-choice-title"
          aria-describedby="secret-choice-description"
          data-testid="secret-choice-dialog"
          onKeyDown={trapModalFocus}
        >
          <div className="modal hero-power-choice-modal">
            <span className="discover-kicker">发现 · 奥秘</span>
            <h2
              className="discover-title"
              id="secret-choice-title"
            >
              神奇魔术 · 选择一个奥秘
            </h2>
            <p
              className="discover-copy"
              id="secret-choice-description"
            >
              选择后会立刻进入你的英雄奥秘区，并在之后的招募或战斗中按卡面触发一次。
            </p>
            <div className="hero-power-choice-options">
              {secretChoiceInteraction.optionIds.map((optionId, index) => {
                const option = getHeroSecretDefinition(optionId);
                return (
                  <button
                    type="button"
                    className="hero-power-choice"
                    data-testid={`secret-choice-${index}`}
                    key={option.id}
                    onClick={() =>
                      send({
                        type: "RESOLVE_INTERACTION",
                        interactionId: secretChoiceInteraction.interactionId,
                        optionInstanceId: option.id,
                      })
                    }
                  >
                    <CardArtwork unit={option} kind="portrait" />
                    <span className="hero-power-choice-type">奥秘</span>
                    <strong>{option.name}</strong>
                    <span className="hero-power-choice-copy">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {discoverChoicePresentation &&
        discoverPresentationActiveCard && (
          <div
            className="overlay interaction-overlay discover-choice-presentation"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discover-choice-presentation-title"
            data-discover-stage={discoverChoicePresentation.state.stage}
            data-reward-strategy={
              discoverChoicePresentation.rewardStrategy
            }
            data-testid="discover-choice-presentation"
            onKeyDown={trapModalFocus}
          >
            {discoverChoicePresentation.state.stage ===
            "selectedFocus" ? (
              <div className="modal discover-modal discover-choice-presentation-modal">
                <span className="discover-kicker">发现</span>
                <h2
                  className="discover-title"
                  id="discover-choice-presentation-title"
                >
                  {discoverChoicePresentation.title}
                </h2>
                <p className="discover-copy">
                  {discoverChoicePresentation.copy}
                </p>
                <div className="discover-options">
                  {discoverChoicePresentation.options.map(
                    (option, index) => {
                      const selected =
                        option.card.instanceId ===
                        discoverChoicePresentation.state.selectedOptionId;
                      return (
                        <div
                          className="discover-option discover-presentation-option"
                          data-selection-state={
                            selected ? "selected" : "dismissed"
                          }
                          data-testid={`discover-presentation-option-${index}`}
                          key={option.card.instanceId}
                        >
                          <DiscoverPresentationCard option={option} />
                          <div className="discover-option-summary">
                            <span>
                              {option.kind === "minion"
                                ? `${option.card.tier} 级 · ${printedTribeLabel(
                                    option.card,
                                  )} · ATK ${option.card.attack} / HP ${
                                    option.card.health
                                  }`
                                : option.kind === "tavernSpell"
                                  ? `${option.card.tier} 级 · ${option.card.cost} 枚铸币`
                                  : "等级3暗月奖品"}
                            </span>
                            <p>{option.card.description}</p>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            ) : (
              <div className="discover-choice-return-scene">
                <span
                  className="discover-choice-return-label"
                  id="discover-choice-presentation-title"
                >
                  {discoverChoicePresentation.state.stage ===
                  "rewardArrival"
                    ? "奖励进入手牌"
                    : discoverChoicePresentation.rewardStrategy ===
                        "shopReplace"
                      ? "替换酒馆随从"
                    : "返回酒馆"}
                </span>
                {discoverChoicePresentation.rewardStrategy ===
                  "shopReplace" &&
                  discoverChoicePresentation.shopTarget && (
                    <div
                      className="discover-choice-shop-vortex"
                      data-testid="discover-choice-shop-vortex"
                      data-target-instance-id={
                        discoverChoicePresentation.shopTarget.instanceId
                      }
                      style={{
                        left:
                          discoverChoicePresentation.shopTarget.geometry
                            .left,
                        top:
                          discoverChoicePresentation.shopTarget.geometry
                            .top,
                        width:
                          discoverChoicePresentation.shopTarget.geometry
                            .width,
                        height:
                          discoverChoicePresentation.shopTarget.geometry
                            .height,
                      }}
                    >
                      <span />
                      <strong>
                        {discoverChoicePresentation.shopTarget.name}
                      </strong>
                    </div>
                  )}
                <div
                  className="discover-choice-selected-card"
                  data-reward-kind={
                    discoverChoicePresentation.state.rewardKind ?? undefined
                  }
                  data-testid={
                    discoverChoicePresentation.state.stage ===
                    "rewardArrival"
                      ? "discover-choice-reward-card"
                      : "discover-choice-selected-card"
                  }
                  style={
                    {
                      "--discover-fly-x": `${discoverChoicePresentation.handTravelX}px`,
                      "--discover-fly-y": `${discoverChoicePresentation.handTravelY}px`,
                      "--discover-shop-x": `${discoverChoicePresentation.shopTravelX}px`,
                      "--discover-shop-y": `${discoverChoicePresentation.shopTravelY}px`,
                    } as CSSProperties
                  }
                >
                  <span className="discover-choice-outcome">
                    {discoverChoicePresentation.state.stage ===
                      "returnToTavern" &&
                    discoverChoicePresentation.state.rewardKind === "hand"
                      ? `已确认${discoverPresentationSelectedOption?.card.name ?? "所选卡牌"}`
                      : discoverChoicePresentation.outcomeLabel}
                  </span>
                  <DiscoverPresentationCard
                    option={discoverPresentationActiveCard}
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              className="discover-choice-skip"
              data-testid="skip-discover-choice-presentation"
              onClick={() =>
                setDiscoverChoicePresentation((current) => {
                  if (!current) return null;
                  const next = transitionDiscoverChoicePresentation(
                    current.state,
                    {
                      type: "skip",
                      expectedInteractionId:
                        discoverChoicePresentation.state.interactionId,
                    },
                  );
                  return next ? { ...current, state: next } : null;
                })
              }
            >
              跳过动画
            </button>
            <span
              className="sr-only"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {discoverChoicePresentation.state.stage === "selectedFocus"
                ? `已选择${discoverPresentationSelectedOption?.card.name ?? "卡牌"}`
                : discoverChoicePresentation.state.stage ===
                    "returnToTavern"
                  ? discoverChoicePresentation.state.rewardKind === "hand"
                    ? `已确认${discoverPresentationSelectedOption?.card.name ?? "所选卡牌"}，正在返回酒馆`
                    : discoverChoicePresentation.outcomeLabel
                  : discoverChoicePresentation.outcomeLabel}
            </span>
          </div>
        )}

      {discoverInteraction && (
        <div
          className={`overlay interaction-overlay discover-selection-overlay${
            discoverChoicesHidden ? " is-peeking" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="discover-title"
          data-discover-destination={
            discoverInteraction.destination.kind
          }
          data-testid="discover-dialog"
          onKeyDown={trapModalFocus}
        >
          <div
            className="modal discover-modal"
            inert={discoverChoicesHidden}
            aria-hidden={discoverChoicesHidden || undefined}
          >
            <span className="discover-kicker">发现</span>
            <h2 className="discover-title" id="discover-title">
              {discoverTitle}
            </h2>
            <p className="discover-copy">
              {discoverCopy}
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
            {discoverInteraction.destination.kind === "replaceShop" && (
              <div
                className="discover-destination"
                data-testid="discover-shop-replace-target"
              >
                <span>替换目标</span>
                <strong>
                  {discoverShopReplaceTarget?.name ?? "酒馆中的目标随从"}
                </strong>
                <small>
                  当前等级 {discoverShopReplaceTarget?.tier ?? "?"} · 选择后保留此酒馆栏位
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
                      const accepted =
                        resolveDiscoverChoiceWithPresentation({
                          interactionId:
                            discoverInteraction.interactionId,
                          options: discoverInteraction.options.map(
                            (candidate) => ({
                              kind: "minion" as const,
                              card: candidate,
                            }),
                          ),
                          selectedOptionId: option.instanceId,
                          title: discoverTitle,
                          copy: discoverCopy,
                          rewardStrategy:
                            discoverInteraction.destination.kind ===
                            "customUndeadSecond"
                              ? "generatedMinion"
                              : discoverInteraction.destination.kind ===
                                  "hand"
                                ? "selected"
                                : discoverInteraction.destination.kind ===
                                    "replaceShop"
                                  ? "shopReplace"
                                : "immediate",
                          shopTargetInstanceId:
                            discoverInteraction.destination.kind ===
                            "replaceShop"
                              ? discoverInteraction.destination
                                  .targetInstanceId
                              : undefined,
                        });
                      if (
                        accepted &&
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
                      if (
                        accepted &&
                        discoverInteraction.destination.kind ===
                          "replaceShop"
                      ) {
                        setMagneticAnnouncement(
                          `已用${option.name}替换酒馆中的${
                            discoverShopReplaceTarget?.name ?? "目标随从"
                          }，原目标和未选候选已回到共享随从池`,
                        );
                      }
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
          <button
            type="button"
            className="discover-visibility-toggle"
            aria-pressed={!discoverChoicesHidden}
            data-testid="toggle-discover-visibility"
            onClick={toggleDiscoverChoices}
          >
            {discoverChoicesHidden ? "待选择 · 显示" : "隐藏"}
          </button>
        </div>
      )}

      {darkmoonPrizeDiscoverInteraction && (
        <div
          className={`overlay interaction-overlay discover-selection-overlay${
            discoverChoicesHidden ? " is-peeking" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="darkmoon-prize-discover-title"
          data-testid="darkmoon-prize-discover-dialog"
          onKeyDown={trapModalFocus}
        >
          <div
            className="modal discover-modal"
            inert={discoverChoicesHidden}
            aria-hidden={discoverChoicesHidden || undefined}
          >
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
                      onClick={() =>
                        resolveDiscoverChoiceWithPresentation({
                          interactionId:
                            darkmoonPrizeDiscoverInteraction.interactionId,
                          options:
                            darkmoonPrizeDiscoverInteraction.options.map(
                              (candidate) => ({
                                kind: "darkmoonPrize" as const,
                                card: candidate,
                              }),
                            ),
                          selectedOptionId: option.instanceId,
                          title: "发现等级3暗月奖品",
                          copy: "从随机出现的三张等级3暗月奖品中选择一张加入手牌。",
                          rewardStrategy: "selected",
                        })
                      }
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
          <button
            type="button"
            className="discover-visibility-toggle"
            aria-pressed={!discoverChoicesHidden}
            data-testid="toggle-discover-visibility"
            onClick={toggleDiscoverChoices}
          >
            {discoverChoicesHidden ? "待选择 · 显示" : "隐藏"}
          </button>
        </div>
      )}

      {tavernSpellDiscoverInteraction && (
        <div
          className={`overlay interaction-overlay discover-selection-overlay${
            discoverChoicesHidden ? " is-peeking" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tavern-spell-discover-title"
          data-testid="tavern-spell-discover-dialog"
          onKeyDown={trapModalFocus}
        >
          <div
            className="modal discover-modal"
            inert={discoverChoicesHidden}
            aria-hidden={discoverChoicesHidden || undefined}
          >
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
                      onClick={() =>
                        resolveDiscoverChoiceWithPresentation({
                          interactionId:
                            tavernSpellDiscoverInteraction.interactionId,
                          options:
                            tavernSpellDiscoverInteraction.options.map(
                              (candidate) => ({
                                kind: "tavernSpell" as const,
                                card: candidate,
                              }),
                            ),
                          selectedOptionId: option.instanceId,
                          title: "发现酒馆法术",
                          copy: "选择一张加入手牌；竞技表演者可以发现当前牌池中的任意等级酒馆法术。",
                          rewardStrategy: "selected",
                        })
                      }
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
          <button
            type="button"
            className="discover-visibility-toggle"
            aria-pressed={!discoverChoicesHidden}
            data-testid="toggle-discover-visibility"
            onClick={toggleDiscoverChoices}
          >
            {discoverChoicesHidden ? "待选择 · 显示" : "隐藏"}
          </button>
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
          <div className={`modal game-over-modal${game.winnerId === game.humanPlayerId ? " is-victory" : ""}`}>
            <span className="modal-kicker">
              {game.winnerId === game.humanPlayerId ? "酒馆战棋胜利" : "战局结束"}
            </span>
            <h1>
              {game.winnerId === game.humanPlayerId
                ? "你赢得了战局"
                : `最终第 ${human.placement ?? 8} 名`}
            </h1>
            <p>
              坚持 {game.round} 回合 ·{" "}
              {humanHero?.name ?? "中立英雄"}
              {humanHeroPower ? ` · ${humanHeroPower.name}` : ""}
            </p>
            <div className="game-over-standings">
              {[...game.players]
                .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
                .filter((p) => p.placement !== undefined)
                .slice(0, 4)
                .map((p) => (
                  <div
                    className={`game-over-player${p.id === game.humanPlayerId ? " is-self" : ""}`}
                    key={p.id}
                  >
                    <span className="game-over-rank">
                      {p.placement === 1 ? "🥇" : p.placement === 2 ? "🥈" : p.placement === 3 ? "🥉" : `#${p.placement}`}
                    </span>
                    <span className="game-over-name">
                      {p.id === game.humanPlayerId ? "你" : p.name}
                    </span>
                  </div>
                ))}
            </div>
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
