"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";
import {
  canMagnetize,
  createGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  getLegalTavernSpellTargetIds,
  getRefreshCost,
  getTavernSpellPurchaseQuote,
  getTavernSpellDefinition,
  getSpellcraftDefinition,
  getUpgradeCost,
  tavernSpellCanTargetShop,
  tavernSpellNeedsTarget,
  tavernSpellPurchaseCurrency,
  spellcraftNeedsTarget,
  type BattleEvent,
  type BattleResult,
  type BattleSummary,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type ConsolationCoinSpellInstance,
  type GameAction,
  type GameState,
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
import {
  COMBAT_START_INTRO_DURATION_MS,
  combatIntroOpponent,
  initialCombatPlayback,
  isCombatPlaybackEvent,
  projectCombatHealth,
} from "../lib/game/combat-presentation";
import {
  createBoardDragPreview,
  nearestBoardSlotIndex,
} from "../lib/game/drag-preview";
import { projectCombatBoard } from "../lib/game/playback";
import { migrateLegacyGameState } from "../lib/game/save";

const SAVE_KEY = "hearthstone-battlegrounds-local.save.v9";
const LEGACY_SAVE_KEYS = [
  "hearthstone-battlegrounds-local.save.v8",
  "hearthstone-battlegrounds-local.save.v7",
  "hearthstone-battlegrounds-local.save.v6",
  "hearthstone-battlegrounds-local.save.v5",
] as const;
const INITIAL_SEED = 0x53544152;
const BOARD_LIMIT = 7;
const MOUSE_DRAG_THRESHOLD_PX = 8;
const TOUCH_DRAG_THRESHOLD_PX = 12;

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

type Selection =
  | { zone: "shop" | "spellShop" | "hand" | "board"; index: number }
  | null;

type InfoTab = "details" | "battle";

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

type ShopDisplayOffer =
  | {
      kind: "minion";
      unit: BoardMinionInstance;
      shopIndex: number;
    }
  | {
      kind: "tavernSpell";
      spell: TavernSpellInstance;
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

type BattleSpeed = 1 | 2;

type CombatPresentationStage = "intro" | "playback" | "result";

type BattlePlaybackState = {
  battle: BattleSummary | null;
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
  token: string;
};

type TavernSpellCastFeedback = {
  targetInstanceId: string;
  label: string;
  token: string;
};

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

function hasSchema9MinionState(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.bloodGemAttack === "number" &&
    typeof value.bloodGemHealth === "number" &&
    typeof value.temporaryAttack === "number" &&
    typeof value.temporaryHealth === "number" &&
    typeof value.temporaryTaunt === "boolean" &&
    typeof value.temporaryDivineShield === "boolean" &&
    typeof value.temporaryCrabDeathrattles === "number" &&
    (value.playableFromRound === undefined ||
      typeof value.playableFromRound === "number") &&
    (value.destroyAfterPlayThroughRound === undefined ||
      typeof value.destroyAfterPlayThroughRound === "number")
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
      value.repetitions > 0
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
      value.remainingDiscoveries > 0
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
      )
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
          "number")) ||
      (value.destination.kind === "magnetize" &&
        typeof value.destination.targetInstanceId === "string"));
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
    isRecord(value.filter) &&
    validDestination &&
    typeof value.remainingDiscoveries === "number" &&
    value.remainingDiscoveries > 0
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
  if (interaction.kind === "discover") {
    return (
      interaction.destination.kind === "hand" ||
      boardIds.has(interaction.destination.targetInstanceId)
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

function isBloodGemSpell(value: unknown): value is BloodGemSpellInstance {
  return (
    isRecord(value) &&
    value.kind === "bloodGem" &&
    typeof value.instanceId === "string" &&
    value.definitionId === "blood-gem" &&
    value.cardId === "BG20_GEM" &&
    value.name === "鲜血宝石" &&
    typeof value.description === "string" &&
    value.spellFamily === "bloodGem"
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
    value.spellFamily !== "spellcraft" ||
    (value.target !== "none" && value.target !== "friendly")
  ) {
    return false;
  }
  try {
    const definition = getSpellcraftDefinition(value.definitionId);
    return (
      definition.cardId === value.cardId &&
      definition.name === value.name &&
      definition.target === value.target
    );
  } catch {
    return false;
  }
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 9 &&
    candidate.contentVersion === CURRENT_ROSTER_VERSION &&
    typeof candidate.seed === "number" &&
    typeof candidate.nextInteractionId === "number" &&
    isRecord(candidate.spellPool) &&
    Array.isArray(candidate.activeTribes) &&
    candidate.activeTribes.length === 5 &&
    Array.isArray(candidate.players) &&
    candidate.players.length === 8 &&
    candidate.players.every(
      (player) =>
        typeof player.tavernSpellsCastThisTurn === "number" &&
        typeof player.maxGold === "number" &&
        player.maxGold >= 10 &&
        typeof player.pendingNextTurnGold === "number" &&
        typeof player.freeRefreshes === "number" &&
        typeof player.tavernMinionAttackBonus === "number" &&
        typeof player.tavernMinionHealthBonus === "number" &&
        typeof player.nextCombatAttackBonus === "number" &&
        typeof player.nextCombatHealthBonus === "number" &&
        typeof player.nextCombatWinGold === "number" &&
        typeof player.nextCombatTieGold === "number" &&
        typeof player.nextTurnBoardAttackBonus === "number" &&
        typeof player.nextTurnBoardHealthBonus === "number" &&
        typeof player.nextTurnBoardBuffPulses === "number" &&
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
        Array.isArray(player.rideTheWindBuffs) &&
        player.rideTheWindBuffs.every(
          (buff) =>
            typeof buff.attack === "number" &&
            typeof buff.health === "number",
        ) &&
        typeof player.elementalsPlayedThisTurn === "number" &&
        typeof player.nextCombatBeetles === "number" &&
        typeof player.ballerAttackBonus === "number" &&
        typeof player.ballerHealthBonus === "number" &&
        typeof player.deepBlueBonus === "number" &&
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
        Array.isArray(player.shop) &&
        player.shop.every(
          (minion) =>
            Array.isArray(minion.attachments) &&
            minion.attachments.every(isMagneticAttachment) &&
            hasSchema9MinionState(minion),
        ) &&
        (player.spellShop === null ||
          isTavernSpell(player.spellShop)),
    ) &&
    (candidate.pendingInteraction === null ||
      (isPendingInteraction(candidate.pendingInteraction) &&
        pendingInteractionMatchesPlayer(
          candidate.pendingInteraction,
          candidate.players,
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
      event.cardGainResult === "added" && event.minion
        ? [event.minion.name]
        : [],
    ),
    addedInstanceIds: rewardEvents.flatMap((event) =>
      event.cardGainResult === "added" && event.minion
        ? [event.minion.instanceId]
        : [],
    ),
  };
}

function combatRewardSummaryText(
  summary: CombatRewardSummary,
): string {
  const parts = [
    summary.addedCount > 0
      ? `获得 ${summary.addedCount} 张磁力机械牌`
      : "未获得磁力机械牌",
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
        : event?.type === "buff"
          ? 620
          : event?.type === "keywordRemoved"
            ? 620
            : event?.type === "shieldBroken"
              ? 500
              : event?.type === "death"
                ? 600
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

function UnitCardFace({ unit }: { unit: MinionInstance }) {
  return (
    <>
      <CardArtwork unit={unit} kind="portrait" />
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
  selected = false,
  unaffordable = false,
  compact = false,
  dragEnabled = false,
  dragging = false,
  combatActor = false,
  combatTarget = false,
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
  newlyGenerated = false,
  locked = false,
  disabled = false,
  dragHandlers,
  testId,
  onClick,
  onKeyDown,
}: {
  unit: MinionInstance;
  selected?: boolean;
  unaffordable?: boolean;
  compact?: boolean;
  dragEnabled?: boolean;
  dragging?: boolean;
  combatActor?: boolean;
  combatTarget?: boolean;
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
  spellTargetKind?: "tavernSpell" | "spellcraft";
  tavernSpellDropTarget?: boolean;
  tavernSpellCast?: boolean;
  tavernSpellCastLabel?: string;
  tavernSpellCastToken?: string;
  newlyGenerated?: boolean;
  locked?: boolean;
  disabled?: boolean;
  dragHandlers?: DragPointerHandlers;
  testId?: string;
  onClick?: () => void;
  onKeyDown?: (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => void;
}) {
  const combatRole = combatActor
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
        dragEnabled ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}${
        combatActor ? " is-combat-actor" : ""
      }${combatTarget ? " is-combat-target" : ""}${
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
      }${
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
      }${choiceTarget ? "，可选择为效果目标" : ""}${
        magneticTarget ? "，可作为磁力吸附目标" : ""
      }${bloodGemTarget ? "，可作为鲜血宝石目标" : ""}${
        tavernSpellTarget
          ? spellTargetKind === "spellcraft"
            ? "，可作为塑造法术目标"
            : "，可作为酒馆法术目标"
          : ""
      }${
        newlyGenerated ? "，本轮战斗新获得" : ""
      }${
        locked ? "，锁定至下个招募回合" : ""
      }`}
      aria-pressed={selected}
      aria-disabled={disabled}
      aria-describedby={
        [
          dragEnabled ? "drag-instructions" : "",
          magneticTarget ? "magnetic-target-instructions" : "",
          bloodGemTarget ? "blood-gem-target-instructions" : "",
          tavernSpellTarget
            ? spellTargetKind === "spellcraft"
              ? "spellcraft-target-instructions"
              : "tavern-spell-target-instructions"
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
      data-testid={testId}
      data-unit-instance-id={unit.instanceId}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      style={{ "--card-hue": TRIBE_HUE[unit.tribe] } as CSSProperties}
      {...dragHandlers}
    >
      <UnitCardFace unit={unit} />
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
  testId,
  onPlay,
}: {
  card: TripleRewardSpellInstance;
  disabled?: boolean;
  testId?: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className="triple-reward-card"
      aria-label={`三连奖励，发现一个 ${card.tier} 级随从`}
      data-testid={testId}
      disabled={disabled}
      onClick={onPlay}
      style={{ "--card-hue": TRIBE_HUE.neutral } as CSSProperties}
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
  testId,
  onPlay,
}: {
  card: ConsolationCoinSpellInstance;
  disabled?: boolean;
  testId?: string;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      className="tavern-spell-card consolation-coin-card"
      aria-label={`${card.name}，0费法术，${card.description}，点击使用`}
      data-testid={testId}
      disabled={disabled}
      onClick={onPlay}
      style={{ "--card-hue": 42 } as CSSProperties}
    >
      <CardArtwork unit={card} kind="portrait" />
      <span className="tavern-spell-cost">0</span>
      <span className="tavern-spell-name">{card.name}</span>
      <span className="tavern-spell-copy">{card.description}</span>
      <span className="tavern-spell-hint">点击使用</span>
    </button>
  );
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
  disabled = false,
  dragging = false,
  dragHandlers,
  testId,
  onClick,
}: {
  card: BloodGemSpellInstance;
  attack: number;
  health: number;
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dragHandlers?: DragPointerHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`blood-gem-card${selected ? " is-selected" : ""}${
        dragHandlers ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}`}
      aria-label={`鲜血宝石，使一个友方随从获得+${attack}/+${health}。拖到友方随从上使用`}
      aria-pressed={selected}
      data-card-instance-id={card.instanceId}
      data-drag-enabled={Boolean(dragHandlers)}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{ "--card-hue": TRIBE_HUE.quilboar } as CSSProperties}
      {...dragHandlers}
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
          ? "拖到友方随从上塑造"
          : "拖到战场或点击施放"}
      </span>
    </>
  );
}

function SpellcraftCard({
  card,
  selected = false,
  disabled = false,
  dragging = false,
  dragHandlers,
  testId,
  onClick,
}: {
  card: SpellcraftSpellInstance;
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dragHandlers?: DragPointerHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`tavern-spell-card spellcraft-card${
        selected ? " is-selected" : ""
      }${dragHandlers ? " is-draggable" : ""}${
        dragging ? " is-drag-source" : ""
      }`}
      aria-label={`${card.name}，0费塑造法术，${card.description}`}
      aria-pressed={selected}
      data-card-instance-id={card.instanceId}
      data-drag-enabled={Boolean(dragHandlers)}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{ "--card-hue": 222 } as CSSProperties}
      {...dragHandlers}
    >
      <SpellcraftCardFace card={card} />
    </button>
  );
}

function TavernSpellCardFace({
  card,
  inShop = false,
}: {
  card: TavernSpellInstance;
  inShop?: boolean;
}) {
  const purchaseCurrency = tavernSpellPurchaseCurrency(card);
  return (
    <>
      <CardArtwork unit={card} kind="portrait" />
      <span
        className={`tavern-spell-cost${
          purchaseCurrency === "health" ? " is-health-cost" : ""
        }`}
      >
        {purchaseCurrency === "health" ? "♥" : ""}
        {card.cost}
      </span>
      <span className="tavern-spell-tier">{card.tier}</span>
      <span className="tavern-spell-name">{card.name}</span>
      <span className="tavern-spell-copy">{card.description}</span>
      <span className="tavern-spell-hint">
        {inShop
          ? purchaseCurrency === "health"
            ? `购买 · ${card.cost} 生命`
            : `购买 · ${card.cost}`
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
  selected = false,
  unaffordable = false,
  disabled = false,
  dragging = false,
  dragHandlers,
  testId,
  onClick,
}: {
  card: TavernSpellInstance;
  inShop?: boolean;
  selected?: boolean;
  unaffordable?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  dragHandlers?: DragPointerHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  const purchaseCurrency = tavernSpellPurchaseCurrency(card);
  return (
    <button
      type="button"
      className={`tavern-spell-card${inShop ? " is-shop-offer" : ""}${
        selected ? " is-selected" : ""
      }${unaffordable ? " is-unaffordable" : ""}${
        dragHandlers ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}`}
      aria-label={`${card.name}，${card.tier}级酒馆法术，费用${card.cost}${
        purchaseCurrency === "health" ? "点生命" : "枚金币"
      }，${card.description}`}
      aria-pressed={selected}
      data-card-instance-id={card.instanceId}
      data-drag-enabled={Boolean(dragHandlers)}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{ "--card-hue": 266 } as CSSProperties}
      {...dragHandlers}
    >
      <TavernSpellCardFace card={card} inShop={inShop} />
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
  const sources =
    kind === "detail"
      ? [renderLocal, renderRemote, portraitLocal, portraitRemote]
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
        // A plain img is required for the local -> remote -> placeholder chain.
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

function BoardRow({
  units,
  side,
  selection,
  canDeploy,
  dragSession,
  actorInstanceId,
  targetInstanceId,
  buffTargetInstanceId,
  buffLabel,
  debuffTargetInstanceId,
  debuffLabel,
  summonedInstanceId,
  summonLabel,
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
  getDragHandlers,
  onUnitClick,
  onChoiceTarget,
  onMagneticTarget,
  onBloodGemTarget,
  onTavernSpellTarget,
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
  buffTargetInstanceId?: string;
  buffLabel?: string;
  debuffTargetInstanceId?: string;
  debuffLabel?: string;
  summonedInstanceId?: string;
  summonLabel?: string;
  choiceTargetIds?: readonly string[];
  magneticTargetIds?: readonly string[];
  magneticDropTargetId?: string;
  bloodGemTargetIds?: readonly string[];
  bloodGemDropTargetId?: string;
  bloodGemCastFeedback?: BloodGemCastFeedback | null;
  tavernSpellTargetIds?: readonly string[];
  spellTargetKind?: "tavernSpell" | "spellcraft";
  tavernSpellDropTargetId?: string;
  tavernSpellCastFeedback?: TavernSpellCastFeedback | null;
  getDragHandlers?: (
    source: DragSource,
    card: DraggableCard,
  ) => DragPointerHandlers;
  onUnitClick?: (index: number) => void;
  onChoiceTarget?: (instanceId: string) => void;
  onMagneticTarget?: (instanceId: string) => void;
  onBloodGemTarget?: (instanceId: string) => void;
  onTavernSpellTarget?: (instanceId: string) => void;
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
                  choiceTarget={isChoiceTarget}
                  magneticTarget={isMagneticTarget}
                  magneticDropTarget={isMagneticDropTarget}
                  bloodGemTarget={isBloodGemTarget}
                  bloodGemDropTarget={isBloodGemDropTarget}
                  bloodGemCast={isBloodGemCast}
                  bloodGemCastLabel={
                    isBloodGemCast && bloodGemCastFeedback
                      ? `+${bloodGemCastFeedback.attack}/+${bloodGemCastFeedback.health}`
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
                  disabled={interactionLocked && !isChoiceTarget}
                  dragHandlers={
                    side === "friendly" && getDragHandlers
                      ? getDragHandlers(
                          { zone: "board", index },
                          unit,
                        )
                      : undefined
                  }
                  onClick={
                    isChoiceTarget && onChoiceTarget
                      ? () => onChoiceTarget(unit.instanceId)
                      : isTavernSpellTarget && onTavernSpellTarget
                        ? () => onTavernSpellTarget(unit.instanceId)
                      : isBloodGemTarget && onBloodGemTarget
                        ? () => onBloodGemTarget(unit.instanceId)
                      : isMagneticTarget && onMagneticTarget
                        ? () => onMagneticTarget(unit.instanceId)
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
  rank,
  displayHealth,
  displayAlive,
  takingHeroDamage = false,
}: {
  player: PlayerState;
  humanId: string;
  opponentId?: string;
  rank: number;
  displayHealth?: number;
  displayAlive?: boolean;
  takingHeroDamage?: boolean;
}) {
  const renderedHealth = Math.max(
    0,
    displayHealth ?? player.health,
  );
  const renderedAlive = displayAlive ?? player.alive;

  return (
    <div
      className={`player-row${player.id === humanId ? " is-player" : ""}${
        !renderedAlive ? " is-dead" : ""
      }${player.id === opponentId ? " is-opponent" : ""}${
        takingHeroDamage ? " is-taking-hero-damage" : ""
      }`}
      data-rank={
        renderedAlive ? rank : (player.placement ?? rank)
      }
      data-player={player.id === humanId ? "human" : "ai"}
      data-eliminated={!renderedAlive}
      data-opponent={player.id === opponentId}
      data-displayed-health={renderedHealth}
      data-testid={`standing-${player.id}`}
    >
      <span className="player-meta">
        <strong>{player.name}</strong>
        <small>
          {player.id === opponentId
            ? "本轮对手"
            : renderedAlive
              ? `${player.board.length} 随从 · ${player.tavernTier}星`
              : `第 ${player.placement ?? rank} 名`}
        </small>
      </span>
      <span className="player-health">
        生命 {renderedHealth}
      </span>
    </div>
  );
}

export default function GameClient() {
  const [game, setGame] = useState<GameState>(() => createGame(INITIAL_SEED));
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [infoTab, setInfoTab] = useState<InfoTab>("details");
  const [showRestart, setShowRestart] = useState(false);
  const [dragSession, setDragSession] = useState<DragSession | null>(null);
  const [magneticAnnouncement, setMagneticAnnouncement] = useState("");
  const [bloodGemCastFeedback, setBloodGemCastFeedback] =
    useState<BloodGemCastFeedback | null>(null);
  const [tavernSpellCastFeedback, setTavernSpellCastFeedback] =
    useState<TavernSpellCastFeedback | null>(null);
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeed>(1);
  const [combatRewardNotice, setCombatRewardNotice] =
    useState<CombatRewardSummary | null>(null);
  const [newCombatRewardIds, setNewCombatRewardIds] = useState<string[]>(
    [],
  );
  const [battlePlayback, setBattlePlayback] =
    useState<BattlePlaybackState>({
      battle: null,
      revealedCount: 0,
      complete: false,
    });
  const [combatIntroCompletedBattle, setCombatIntroCompletedBattle] =
    useState<BattleSummary | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const dragCaptureElementRef = useRef<HTMLButtonElement | null>(null);
  const suppressCardClickRef = useRef(false);
  const battlePlaybackTimerRef = useRef<number | null>(null);
  const combatIntroTimerRef = useRef<number | null>(null);
  const bloodGemCastTimerRef = useRef<number | null>(null);
  const tavernSpellCastTimerRef = useRef<number | null>(null);
  const interactionReturnFocusRef = useRef<HTMLElement | null>(null);
  const previousInteractionIdRef = useRef<string | null>(null);
  const magneticFocusTargetRef = useRef<string | null>(null);
  const previousMagneticSelectionRef = useRef<string | null>(null);
  const preCombatHandIdsRef = useRef<Set<string> | null>(null);

  const writeDragSession = useCallback((next: DragSession | null) => {
    dragSessionRef.current = next;
    setDragSession(next);
  }, []);

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

  const clearBloodGemCastFeedback = useCallback(() => {
    if (bloodGemCastTimerRef.current !== null) {
      window.clearTimeout(bloodGemCastTimerRef.current);
      bloodGemCastTimerRef.current = null;
    }
    setBloodGemCastFeedback(null);
  }, []);

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
        const raw = safeReadLocalStorage(SAVE_KEY);
        let restored = false;
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (isGameState(saved)) {
            setGame(saved);
            setStarted(true);
            restored = true;
          } else {
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
                const migrated = migrateLegacyGameState(
                  JSON.parse(legacyRaw) as unknown,
                );
                if (isGameState(migrated)) {
                  setGame(migrated);
                  setStarted(true);
                  safeWriteLocalStorage(
                    SAVE_KEY,
                    JSON.stringify(migrated),
                  );
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
    if (!combatRewardNotice) return;
    const noticeTimer = window.setTimeout(
      clearCombatRewardFeedback,
      5200,
    );
    return () => window.clearTimeout(noticeTimer);
  }, [clearCombatRewardFeedback, combatRewardNotice]);

  const send = useCallback(
    (action: GameAction) => {
      setGame((current) => {
        const next = gameReducer(current, action);
        if (started) {
          safeWriteLocalStorage(SAVE_KEY, JSON.stringify(next));
        }
        return next;
      });
      setSelection(null);
    },
    [started],
  );

  const human = useMemo(
    () =>
      game.players.find((player) => player.id === game.humanPlayerId) ??
      game.players[0],
    [game],
  );
  const shopDisplayOffers = useMemo<ShopDisplayOffer[]>(() => {
    const minionOffers = human.shop.map((unit, shopIndex) => ({
      kind: "minion" as const,
      unit,
      shopIndex,
    }));
    if (!human.spellShop) {
      return minionOffers;
    }
    const spellPosition =
      [...human.spellShop.instanceId].reduce(
        (hash, character) =>
          (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0,
        5381,
      ) %
      (minionOffers.length + 1);
    const offers: ShopDisplayOffer[] = [...minionOffers];
    offers.splice(spellPosition, 0, {
      kind: "tavernSpell",
      spell: human.spellShop,
    });
    return offers;
  }, [human.shop, human.spellShop]);
  const humanInteraction =
    game.pendingInteraction?.playerId === human.id
      ? game.pendingInteraction
      : null;
  const targetInteraction =
    humanInteraction?.kind === "target" ? humanInteraction : null;
  const magnetizeTargetInteraction =
    humanInteraction?.kind === "magnetizeTarget"
      ? humanInteraction
      : null;
  const boardChoiceInteraction =
    magnetizeTargetInteraction ?? targetInteraction;
  const discoverInteraction =
    humanInteraction?.kind === "discover" ? humanInteraction : null;
  const tavernSpellChoiceInteraction =
    humanInteraction?.kind === "tavernSpellChoice"
      ? humanInteraction
      : null;
  const spellcraftChoiceInteraction =
    humanInteraction?.kind === "spellcraftChoice"
      ? humanInteraction
      : null;
  const interactionLocked = game.pendingInteraction !== null;

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
          humanInteraction.kind === "discover"
            ? document.querySelector<HTMLElement>(
                '[data-testid="discover-option-0"]',
              )
            : humanInteraction.kind === "tavernSpellChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="time-management-now"]',
                )
            : humanInteraction.kind === "spellcraftChoice"
              ? document.querySelector<HTMLElement>(
                  '[data-testid="escape-eruption-attack"]',
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

  const trapDiscoverFocus = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])",
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
  const combatIntroActive =
    started &&
    game.phase === "combat" &&
    battle !== null &&
    combatIntroCompletedBattle !== battle;
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
  const opponentInitialBoard =
    battle && opponentId
      ? (
          battle.initialBoards[opponentId] ??
          opponent?.board ??
          []
        ).filter(isBoardMinionInstance)
      : opponent?.board ?? [];
  const playbackEvents = useMemo(
    () => battle?.events.filter(isCombatPlaybackEvent) ?? [],
    [battle],
  );
  const playbackEventCount = playbackEvents.length;
  const playbackIsCurrent =
    game.phase === "combat" &&
    battle !== null &&
    battlePlayback.battle === battle;
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
  const displayedOpponentHealth =
    game.phase === "combat" && battle && opponentId
      ? projectCombatHealth({
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
      : human.board;
  const currentBuffLabel =
    currentBattleEvent?.type === "buff" &&
    currentBattleEvent.attackDelta !== undefined &&
    currentBattleEvent.healthDelta !== undefined
      ? `+${currentBattleEvent.attackDelta}/+${currentBattleEvent.healthDelta}`
      : undefined;
  const currentDebuffLabel =
    currentBattleEvent?.type === "keywordRemoved" &&
    currentBattleEvent.removedKeywords?.length
      ? `移除 ${currentBattleEvent.removedKeywords
          .map((keyword) =>
            keyword === "reborn" ? "复生" : "嘲讽",
          )
          .join(" · ")}`
      : undefined;
  const currentSummonLabel =
    currentBattleEvent?.type === "summon"
      ? currentBattleEvent.summonReason === "rallyFromHand"
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
    selection?.zone === "spellShop" ? human.spellShop : null;
  const selectedHandTavernSpell =
    selectedHandCard?.kind === "tavernSpell" ? selectedHandCard : null;
  const selectedTavernSpell =
    selectedHandTavernSpell ?? selectedShopSpell;
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
      ? "spellcraft"
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
  const infoOpen =
    selectedUnit !== null ||
    selectedBloodGem !== null ||
    selectedSpellcraft !== null ||
    selectedTavernSpell !== null ||
    (infoTab === "battle" && battle !== null);
  const upgradeCost = getUpgradeCost(game, human.id);
  const refreshCost = getRefreshCost(game, human.id);
  const tavernSpellPurchaseQuote = getTavernSpellPurchaseQuote(
    game,
    human.id,
  );
  const canBuyFromShop =
    game.phase === "recruit" &&
    !interactionLocked &&
    human.gold >= 3 &&
    human.hand.length < 10;
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
      ? (human.spellShop?.cost ?? 0)
      : 3;
  const selectedOfferCurrency =
    selection?.zone === "spellShop"
      ? (tavernSpellPurchaseQuote?.currency ?? "gold")
      : "gold";
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
  const discoverDestination = discoverInteraction?.destination;
  const discoverMagnetizeTarget =
    discoverDestination?.kind === "magnetize"
      ? human.board.find(
          (minion) =>
            minion.instanceId ===
            discoverDestination.targetInstanceId,
        )
      : undefined;
  const discoverTitle = discoverInteraction
    ? discoverInteraction.destination.kind === "magnetize"
      ? `${discoverSource?.name ?? "战吼"} · 发现机械并吸附到${
          discoverMagnetizeTarget?.name ?? "目标机械"
        }`
      : discoverInteraction.destination.destroyAfterPlayThroughRound !==
          undefined
        ? "惊扰墓穴 · 发现一张亡灵牌"
      : discoverInteraction.destination.playableFromRound !== undefined
        ? `搜寻时光 · 发现一个 ${discoverInteraction.filter.exactTier} 级随从`
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
    selectedBloodGem,
    selectedSpellcraft,
    selectedHandTavernSpell,
    spellcraftTargetIds,
    tavernSpellTargetIds,
  ]);

  useEffect(() => {
    clearCombatIntroTimer();
    if (
      !battle ||
      game.phase !== "combat" ||
      combatIntroCompletedBattle === battle
    ) {
      return clearCombatIntroTimer;
    }

    combatIntroTimerRef.current = window.setTimeout(() => {
      combatIntroTimerRef.current = null;
      setBattlePlayback({
        battle,
        ...initialCombatPlayback(playbackEventCount),
      });
      setCombatIntroCompletedBattle(battle);
    }, COMBAT_START_INTRO_DURATION_MS);

    return clearCombatIntroTimer;
  }, [
    battle,
    clearCombatIntroTimer,
    combatIntroCompletedBattle,
    game.phase,
    playbackEventCount,
  ]);

  useEffect(() => {
    clearBattlePlaybackTimer();
    if (
      !battle ||
      game.phase !== "combat" ||
      combatIntroActive ||
      battlePlaybackComplete
    ) {
      return clearBattlePlaybackTimer;
    }

    const currentEvent =
      playbackEvents[Math.max(0, revealedBattleEventCount - 1)];
    battlePlaybackTimerRef.current = window.setTimeout(() => {
      battlePlaybackTimerRef.current = null;
      setBattlePlayback((current) => {
        const currentIsThisBattle = current.battle === battle;
        const currentRevealedCount = currentIsThisBattle
          ? Math.min(current.revealedCount, playbackEventCount)
          : playbackEventCount > 0
            ? 1
            : 0;
        if (currentIsThisBattle && current.complete) return current;
        if (currentRevealedCount >= playbackEventCount) {
          return {
            battle,
            revealedCount: playbackEventCount,
            complete: true,
          };
        }
        return {
          battle,
          revealedCount: currentRevealedCount + 1,
          complete: false,
        };
      });
    }, battleEventDelay(currentEvent, battleSpeed));

    return clearBattlePlaybackTimer;
  }, [
    battle,
    battlePlaybackComplete,
    battleSpeed,
    clearBattlePlaybackTimer,
    game.phase,
    playbackEventCount,
    playbackEvents,
    revealedBattleEventCount,
    combatIntroActive,
  ]);

  const skipBattlePlayback = useCallback(() => {
    clearBattlePlaybackTimer();
    if (!battle || game.phase !== "combat" || combatIntroActive) {
      return;
    }
    setBattlePlayback({
      battle,
      revealedCount: playbackEventCount,
      complete: true,
    });
  }, [
    battle,
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

  const startFreshGame = useCallback(() => {
    clearBattlePlaybackTimer();
    clearCombatIntroTimer();
    clearBloodGemCastFeedback();
    clearTavernSpellCastFeedback();
    const next = createGame(newSeed());
    safeWriteLocalStorage(SAVE_KEY, JSON.stringify(next));
    setGame(next);
    setStarted(true);
    setLoaded(true);
    setSelection(null);
    setShowRestart(false);
    setInfoTab("details");
    setMagneticAnnouncement("");
    setBattlePlayback({
      battle: null,
      revealedCount: 0,
      complete: false,
    });
    setCombatIntroCompletedBattle(null);
    clearCombatRewardFeedback();
    magneticFocusTargetRef.current = null;
    preCombatHandIdsRef.current = null;
  }, [
    clearBattlePlaybackTimer,
    clearBloodGemCastFeedback,
    clearTavernSpellCastFeedback,
    clearCombatIntroTimer,
    clearCombatRewardFeedback,
  ]);

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
        (candidate) =>
          candidate.kind === "bloodGem" &&
          candidate.instanceId === cardInstanceId,
      );
      const target = human.board.find(
        (minion) => minion.instanceId === targetInstanceId,
      );
      if (!card || !target) {
        return;
      }
      if (bloodGemCastTimerRef.current !== null) {
        window.clearTimeout(bloodGemCastTimerRef.current);
      }
      setBloodGemCastFeedback({
        targetInstanceId,
        attack: human.bloodGemAttack,
        health: human.bloodGemHealth,
        token: card.instanceId,
      });
      bloodGemCastTimerRef.current = window.setTimeout(() => {
        bloodGemCastTimerRef.current = null;
        setBloodGemCastFeedback(null);
      }, 620);
      setMagneticAnnouncement(
        `已对${target.name}使用鲜血宝石，获得 +${human.bloodGemAttack}/+${human.bloodGemHealth}`,
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
          ? human.board.find(
              (minion) => minion.instanceId === targetInstanceId,
            )
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
      setMagneticAnnouncement(
        target
          ? `已对${target.name}施放塑造法术${card.name}`
          : `已施放塑造法术${card.name}：${card.description}`,
      );
      send({
        type: "CAST_SPELLCRAFT",
        cardInstanceId,
        targetInstanceId,
      });
    },
    [game, human.board, human.hand, human.id, send],
  );

  const select = useCallback((nextSelection: Exclude<Selection, null>) => {
    setSelection(nextSelection);
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

  const resolveDragTarget = useCallback(
    (
      clientX: number,
      clientY: number,
      source: DragSource,
    ): DragTarget => {
      const hit = document.elementFromPoint(clientX, clientY);
      if (!hit) return null;

      if (source.zone === "shop") {
        return canBuyFromShop &&
          hit.closest('[data-hand-drop-zone="true"]')
          ? { kind: "hand" }
          : null;
      }
      if (source.zone === "spellShop") {
        return canBuyTavernSpell &&
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
        if (
          sourceCard?.kind === "spellcraft" &&
          spellcraftNeedsTarget(sourceCard) &&
          hoveredBoardTarget &&
          getLegalSpellcraftTargetIds(
            game,
            human.id,
            sourceCard,
          ).includes(hoveredBoardTarget.instanceId)
        ) {
          return {
            kind: "spellcraft",
            targetInstanceId: hoveredBoardTarget.instanceId,
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
      canBuyFromShop,
      canBuyTavernSpell,
      game,
      human.board,
      human.hand,
      human.id,
      human.shop,
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
        (source.zone === "shop" && !canBuyFromShop) ||
        (source.zone === "spellShop" && !canBuyTavernSpell)
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
      canBuyFromShop,
      canBuyTavernSpell,
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

      writeDragSession({
        ...current,
        clientX,
        clientY,
        active,
        target: resolveDragTarget(clientX, clientY, current),
      });
      return true;
    },
    [resolveDragTarget, writeDragSession],
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
        send({ type: "BUY_TAVERN_SPELL" });
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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
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
              ? "已取消塑造法术目标选择"
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
    window.addEventListener("pointerdown", cancelStaleDrag, true);
    window.addEventListener("blur", cancelStaleDrag);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
      window.removeEventListener("pointerdown", cancelStaleDrag, true);
      window.removeEventListener("blur", cancelStaleDrag);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    finishDragSession,
    moveDragSession,
    selectedBloodGem,
    selectedSpellcraft,
    selectedHandTavernSpell,
    selectedMagneticSource,
  ]);

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
  const dragAnnouncement =
    dragSession?.active !== true
      ? ""
      : dragSession.target?.kind === "sell"
        ? `松手出售${dragSession.card.name}，获得 ${
            dragSession.card.kind === "minion"
              ? dragSession.card.sellValue
              : 0
          } 枚金币`
        : dragSession.target?.kind === "hand"
          ? dragSession.card.kind === "tavernSpell" &&
            tavernSpellPurchaseCurrency(dragSession.card) === "health"
            ? `松手购买${dragSession.card.name}，支付 ${dragSession.card.cost} 点生命`
            : `松手购买${dragSession.card.name}，支付 ${
                dragSession.card.kind === "tavernSpell"
                  ? dragSession.card.cost
                  : 3
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
              ? `松手对目标随从塑造${dragSession.card.name}`
            : dragSession.target?.kind === "castTavernSpell"
              ? `松手施放${dragSession.card.name}`
            : dragSession.target?.kind === "castSpellcraft"
              ? `松手施放塑造法术${dragSession.card.name}`
            : dragSession.target?.kind === "blockedMagnetic"
              ? `${dragSession.card.name}不能吸附到${dragSession.target.targetName}，松手将返回手牌`
          : dragSession.target?.kind === "board"
            ? `松手放到战场第 ${dragSession.target.index + 1} 个位置`
            : dragSession.zone === "shop"
              ? "拖到发光的手牌区域购买，花费 3 枚金币"
              : dragSession.zone === "spellShop" &&
                  dragSession.card.kind === "tavernSpell"
                ? tavernSpellPurchaseCurrency(
                    dragSession.card,
                  ) === "health"
                  ? `拖到发光的手牌区域购买，花费 ${dragSession.card.cost} 点生命`
                  : `拖到发光的手牌区域购买，花费 ${dragSession.card.cost} 枚金币`
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
                    ? "拖到任意发光的友方随从上施放塑造法术"
                    : "拖到战场区域施放塑造法术"
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
        ? `已选择塑造法术${selectedSpellcraft.name}，可对 ${spellcraftTargetIds.length} 个发光的友方随从施放`
        : `已选择塑造法术${selectedSpellcraft.name}，但场上没有合法目标`
      : `已选择塑造法术${selectedSpellcraft.name}，可在详情面板点击施放，或拖到战场区域`
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

  return (
    <main
      className={`game-shell${dragSession?.active ? " is-dragging" : ""}${
        interactionLocked ? " has-pending-interaction" : ""
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
        inert={interactionLocked || combatIntroActive}
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
        </div>
        <div className="hud-stat" aria-label={`金币 ${human.gold}`}>
          <small>金币</small>
          <strong>{human.gold}</strong>
        </div>
        <div className="hud-stat" aria-label={`酒馆等级 ${human.tavernTier}`}>
          <small>酒馆</small>
          <strong>{human.tavernTier} / 6</strong>
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="action-button secondary"
            disabled={interactionLocked}
            onClick={() => setShowRestart(true)}
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
        inert={interactionLocked || combatIntroActive}
      >
        <section className="play-column" aria-label="游戏区域">
          <section
            className={`panel shop-panel${
              human.frozen ? " is-frozen" : ""
            }${
              dragSession?.active && dragSession.zone === "board"
                ? " is-sell-ready"
                : ""
            }${
              dragSession?.target?.kind === "sell" ? " is-sell-target" : ""
            }`}
            aria-label="鲍勃的酒馆"
            aria-hidden={game.phase !== "recruit"}
            inert={interactionLocked || game.phase !== "recruit"}
            data-sell-drop-zone="true"
            data-frozen={human.frozen}
            data-testid="sell-drop-zone"
          >
            <div className="sell-drop-feedback" aria-hidden="true">
              <strong>出售给鲍勃</strong>
              <span>
                松手获得{" "}
                {dragSession?.card.kind === "minion"
                  ? dragSession.card.sellValue
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
              <span>{human.frozen ? "已冻结" : "招募中"}</span>
            </div>
            <div className="shop-layout">
              <div className="shop-actions">
                <button
                  type="button"
                  className="action-button secondary"
                  data-testid="upgrade-tavern"
                  disabled={
                    game.phase !== "recruit" ||
                    interactionLocked ||
                    human.tavernTier >= 6 ||
                    human.gold < upgradeCost
                  }
                  onClick={() => send({ type: "UPGRADE_TAVERN" })}
                >
                  {human.tavernTier >= 6
                    ? "酒馆已满级"
                    : `升至 ${human.tavernTier + 1}星 · ${upgradeCost}`}
                </button>
                <button
                  type="button"
                  className="action-button secondary"
                  data-testid="refresh-shop"
                  disabled={
                    game.phase !== "recruit" ||
                    interactionLocked ||
                    human.gold < refreshCost
                  }
                  onClick={() => send({ type: "REFRESH_SHOP" })}
                >
                  刷新 · {refreshCost}
                  {human.freeRefreshes > 0
                    ? `（免费剩余 ${human.freeRefreshes}）`
                    : ""}
                </button>
                <button
                  type="button"
                  className={`action-button secondary${
                    human.frozen ? " is-active" : ""
                  }`}
                  data-testid="freeze-shop"
                  aria-pressed={human.frozen}
                  disabled={
                    game.phase !== "recruit" || interactionLocked
                  }
                  onClick={() => send({ type: "TOGGLE_FREEZE" })}
                >
                  {human.frozen ? "解冻酒馆" : "冻结酒馆"}
                </button>
              </div>
              <div className="card-row" data-testid="shop-row">
                {shopDisplayOffers.map((offer) =>
                  offer.kind === "minion" ? (
                    <UnitCard
                      unit={offer.unit}
                      key={offer.unit.instanceId}
                      selected={
                        selection?.zone === "shop" &&
                        selection.index === offer.shopIndex
                      }
                      unaffordable={
                        human.gold < 3 || human.hand.length >= 10
                      }
                      disabled={interactionLocked}
                      testId={`shop-card-${offer.shopIndex}`}
                      tavernSpellTarget={tavernSpellTargetIds.includes(
                        offer.unit.instanceId,
                      )}
                      spellTargetKind="tavernSpell"
                      tavernSpellDropTarget={
                        dragSession?.target?.kind === "tavernSpell" &&
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
                        canBuyFromShop &&
                        !tavernSpellTargetIds.includes(
                          offer.unit.instanceId,
                        )
                      }
                      dragging={
                        dragSession?.active === true &&
                        dragSession.card.instanceId ===
                          offer.unit.instanceId
                      }
                      dragHandlers={
                        canBuyFromShop &&
                        !tavernSpellTargetIds.includes(
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
                      onClick={() => {
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
                      data-testid="tavern-spell-slot"
                      key={offer.spell.instanceId}
                    >
                      <TavernSpellCard
                        card={offer.spell}
                        inShop
                        selected={selection?.zone === "spellShop"}
                        unaffordable={
                          tavernSpellPurchaseQuote?.affordable !== true
                        }
                        disabled={interactionLocked}
                        testId="tavern-spell-offer"
                        dragging={
                          dragSession?.active === true &&
                          dragSession.card.instanceId ===
                            offer.spell.instanceId
                        }
                        dragHandlers={
                          canBuyTavernSpell
                            ? getDragHandlers(
                                { zone: "spellShop", index: 0 },
                                offer.spell,
                              )
                            : undefined
                        }
                        onClick={() =>
                          selectCard({
                            zone: "spellShop",
                            index: 0,
                          })
                        }
                      />
                    </div>
                  ),
                )}
                {shopDisplayOffers.length === 0 && (
                  <div className="empty-state">酒馆暂时没有随从</div>
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
                  actorInstanceId={
                    currentBattleEvent &&
                    currentBattleEvent.actorPlayerId === opponentId
                      ? currentBattleEvent.actorInstanceId
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
                      : "buff"
                  }
                  data-testid="target-choice-banner"
                >
                  <strong>
                    {magnetizeTargetInteraction
                      ? `为${targetSource?.name ?? "这张牌"}选择一个友方机械`
                      : `为${targetSource?.name ?? "这张牌"}选择一个友方随从`}
                  </strong>
                  <span>
                    {magnetizeTargetInteraction
                      ? `点击发光机械，随后连续发现 ${magnetizeTargetInteraction.remainingDiscoveries} 次并立即吸附`
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
                selection={selection}
                dragSession={dragSession}
                actorInstanceId={
                  currentBattleEvent?.actorPlayerId === human.id
                    ? currentBattleEvent.actorInstanceId
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
                onEmptyClick={deploySelected}
              />
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
            }`}
            aria-label="手牌"
            aria-hidden={game.phase !== "recruit"}
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
                  : dragSession?.card.kind === "tavernSpell" &&
                      tavernSpellPurchaseCurrency(
                        dragSession.card,
                      ) === "health"
                    ? `松手支付 ${dragSession.card.cost} 点生命`
                    : `松手支付 ${
                        dragSession?.card.kind === "tavernSpell"
                          ? dragSession.card.cost
                          : selectedOfferCost
                      } 枚金币`}
              </span>
            </div>
            <div className="panel-title">
              <span>
                手牌
                <small>
                  随从拖到战场；酒馆法术、塑造法术和鲜血宝石拖放施放；三连奖励点击使用
                </small>
              </span>
              <span>{human.hand.length} / 10</span>
            </div>
            <div className="card-row" data-testid="hand-row">
              {human.hand.map((card, index) =>
                card.kind === "tripleReward" ? (
                  <TripleRewardCard
                    card={card}
                    key={card.instanceId}
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
                    onClick={() =>
                      selectCard({ zone: "hand", index })
                    }
                  />
                ),
              )}
              {human.hand.length === 0 && (
                <div className="empty-state">购买的牌会进入这里</div>
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
              {standings.map((player, index) => (
                <PlayerRow
                  player={player}
                  humanId={game.humanPlayerId}
                  opponentId={
                    game.phase === "combat" ? opponentId : undefined
                  }
                  displayHealth={
                    game.phase === "combat" && battle
                      ? player.id === human.id
                        ? displayedHumanHealth
                        : player.id === opponentId
                          ? (displayedOpponentHealth ?? undefined)
                          : undefined
                      : undefined
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
                  rank={index + 1}
                  key={player.id}
                />
              ))}
            </div>
          </section>

          <section
            className={`panel info-panel${infoOpen ? " is-open" : ""}`}
            data-open={infoOpen}
            aria-label="随从详情与战报"
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
                      0 费塑造法术 · 回合结束时未使用会消失
                    </p>
                    <p>{selectedSpellcraft.description}</p>
                    <p
                      className="tavern-spell-play-hint"
                      data-testid="spellcraft-selection-hint"
                      role="status"
                    >
                      {spellcraftNeedsTarget(selectedSpellcraft)
                        ? spellcraftTargetIds.length > 0
                          ? `点击任意发光的友方随从，或把法术拖到目标上施放。当前有 ${spellcraftTargetIds.length} 个合法目标。`
                          : "当前没有合法随从目标；法术会留在手牌中。"
                        : "点击下方按钮施放，或把法术拖到战场区域。"}
                    </p>
                    <div className="detail-keywords">
                      <span>塑造法术</span>
                      <span>0费</span>
                      <span>回合结束消失</span>
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
                          ? "请选择发光随从"
                          : "施放塑造法术"}
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
                      {selectedTavernSpell.cost}{" "}
                      {tavernSpellPurchaseCurrency(
                        selectedTavernSpell,
                      ) === "health"
                        ? "点生命"
                        : "枚金币"}
                    </p>
                    <p>{selectedTavernSpell.description}</p>
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
                            send({ type: "BUY_TAVERN_SPELL" })
                          }
                        >
                          购买 · {selectedTavernSpell.cost}
                          {tavernSpellPurchaseCurrency(
                            selectedTavernSpell,
                          ) === "health"
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
                        搜寻时光将这张牌锁定在手牌中；下个招募回合才能打出或磁力吸附。
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
                          购买 · 3
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
                            出售 +{selectedUnit.sellValue}
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
        这是当前塑造法术的合法目标。点击或按回车键即可施放；按 Escape 键取消选择。
      </span>
      <span className="sr-only" id="buy-drop-description">
        购买随从需要 3 枚金币；酒馆法术按卡面费用支付，拼命发掘改为消耗生命值。购买时手牌必须未满，也可点击卡牌后使用详情面板中的购买按钮。
      </span>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {interactionAnnouncement}
      </span>

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
              ? `本轮获得 ${combatRewardNotice.addedCount} 张磁力机械牌`
              : "本轮未获得磁力机械牌"}
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

      {dragSession?.active && (
        <div
          className={`${
            dragSession.card.kind === "bloodGem"
              ? "blood-gem-card"
              : dragSession.card.kind === "tavernSpell"
                ? "tavern-spell-card"
                : dragSession.card.kind === "spellcraft"
                  ? "tavern-spell-card spellcraft-card"
              : "unit-card is-compact"
          } is-dragging drag-ghost${
            dragSession.pointerType === "touch" ||
            dragSession.pointerType === "pen"
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
              left: dragSession.clientX - dragSession.offsetX,
              top: dragSession.clientY - dragSession.offsetY,
              width: dragSession.width,
              height: dragSession.height,
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
            <TavernSpellCardFace card={dragSession.card} />
          ) : dragSession.card.kind === "spellcraft" ? (
            <SpellcraftCardFace card={dragSession.card} />
          ) : (
            <UnitCardFace unit={dragSession.card} />
          )}
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
          onKeyDown={trapDiscoverFocus}
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
                <span>使你当前的所有随从永久获得 +4 攻击力。</span>
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
                <span>使你当前的所有随从永久获得 +4 生命值。</span>
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
          onKeyDown={trapDiscoverFocus}
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
          onKeyDown={trapDiscoverFocus}
        >
          <div className="modal discover-modal">
            <span className="discover-kicker">发现</span>
            <h2 className="discover-title" id="discover-title">
              {discoverTitle}
            </h2>
            <p className="discover-copy">
              {discoverInteraction.destination.kind === "magnetize"
                ? "选择后会立即吸附到目标，不会进入手牌；其余候选会回到共享随从池。"
                : discoverInteraction.destination
                      .destroyAfterPlayThroughRound !== undefined
                  ? "选择一张加入手牌；本回合打出时会先完成入场效果，随后死亡并触发亡语。组成三连会清除死亡预言。"
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

      {!started && loaded && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <span className="modal-kicker">非官方本地单人版本</span>
            <h1>酒馆战棋 · 单机版</h1>
            <p>
              你将与 7 名 AI 对战。没有回合倒计时，由你决定何时结束招募并进入战斗。
            </p>
            <div className="modal-features">
              <span>8 人战局</span>
              <span>36.0.3 · 237 随从 · 65 法术数据</span>
              <span>每局开放 5 个种族</span>
              <span>鼠标与触控拖拽</span>
              <span>三连奖励与发现</span>
              <span>磁力吸附</span>
            </div>
            <button
              type="button"
              className="action-button primary"
              data-testid="start-game"
              onClick={() => {
                safeWriteLocalStorage(SAVE_KEY, JSON.stringify(game));
                setStarted(true);
              }}
            >
              开始新局
            </button>
          </div>
        </div>
      )}

      {showRestart && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>重新开始本局？</h2>
            <p>当前进度会被新的八人战局覆盖。</p>
            <div className="modal-actions">
              <button
                type="button"
                className="action-button secondary"
                onClick={() => setShowRestart(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="action-button danger"
                data-testid="confirm-restart"
                onClick={startFreshGame}
              >
                重开本局
              </button>
            </div>
          </div>
        </div>
      )}

      {game.phase === "gameOver" && !showRestart && (
        <div className="overlay" role="dialog" aria-modal="true">
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
              onClick={startFreshGame}
            >
              再来一局
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
