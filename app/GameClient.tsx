"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type PointerEventHandler,
} from "react";
import {
  createGame,
  gameReducer,
  getUpgradeCost,
  type BattleEvent,
  type BattleResult,
  type BattleSummary,
  type GameAction,
  type GameState,
  type MinionInstance,
  type PlayerState,
  type Tribe,
} from "../lib/game/engine";
import {
  CURRENT_ROSTER_VERSION,
  TRIBE_NAMES,
} from "../lib/game/content";

const SAVE_KEY = "hearthstone-battlegrounds-local.save.v2";
const INITIAL_SEED = 0x53544152;
const BOARD_LIMIT = 7;
const DRAG_THRESHOLD_PX = 8;

type Selection =
  | { zone: "shop" | "hand" | "board"; index: number }
  | null;

type InfoTab = "details" | "battle";

type DragSource = {
  zone: "shop" | "hand" | "board";
  index: number;
};

type DragTarget =
  | { kind: "board"; index: number }
  | { kind: "hand" }
  | { kind: "sell" }
  | null;

type DragSession = DragSource & {
  unit: MinionInstance;
  pointerId: number;
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

type BattlePlaybackState = {
  battle: BattleSummary | null;
  revealedCount: number;
  complete: boolean;
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

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 2 &&
    candidate.contentVersion === CURRENT_ROSTER_VERSION &&
    typeof candidate.seed === "number" &&
    Array.isArray(candidate.activeTribes) &&
    candidate.activeTribes.length === 5 &&
    Array.isArray(candidate.players) &&
    candidate.players.length === 8 &&
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

function newSeed(): number {
  const seed = Date.now() >>> 0;
  return seed === 0 ? INITIAL_SEED : seed;
}

function resultLabel(result: BattleResult | undefined): string {
  if (result === "win") return "战斗胜利";
  if (result === "loss") return "战斗失利";
  return "势均力敌";
}

function isPlaybackEvent(event: BattleEvent): boolean {
  return event.type !== "battleEnd";
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
        : event?.type === "shieldBroken"
          ? 500
          : event?.type === "death"
            ? 600
            : event?.type === "summon"
              ? 650
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
  if (!selection) return null;
  return player[selection.zone][selection.index] ?? null;
}

function unitKeyword(unit: MinionInstance): string {
  return (
    [
      unit.golden ? "金色" : "",
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
  dragHandlers,
  testId,
  onClick,
}: {
  unit: MinionInstance;
  selected?: boolean;
  unaffordable?: boolean;
  compact?: boolean;
  dragEnabled?: boolean;
  dragging?: boolean;
  combatActor?: boolean;
  combatTarget?: boolean;
  dragHandlers?: DragPointerHandlers;
  testId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`unit-card${selected ? " is-selected" : ""}${
        unaffordable ? " is-unaffordable" : ""
      }${compact ? " is-compact" : ""}${
        dragEnabled ? " is-draggable" : ""
      }${dragging ? " is-drag-source" : ""}${
        combatActor ? " is-combat-actor" : ""
      }${combatTarget ? " is-combat-target" : ""}`}
      aria-label={`${unit.name}，${unit.attack} 攻击，${unit.health} 生命`}
      aria-pressed={selected}
      aria-describedby={dragEnabled ? "drag-instructions" : undefined}
      data-combat-role={
        combatActor && combatTarget
          ? "actor target"
          : combatActor
            ? "actor"
            : combatTarget
              ? "target"
              : undefined
      }
      data-drag-enabled={dragEnabled}
      data-testid={testId}
      data-unit-instance-id={unit.instanceId}
      onClick={onClick}
      style={{ "--card-hue": TRIBE_HUE[unit.tribe] } as CSSProperties}
      {...dragHandlers}
    >
      <UnitCardFace unit={unit} />
    </button>
  );
}

function CardArtwork({
  unit,
  kind,
}: {
  unit: MinionInstance;
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
      data-fallback={`${unit.name} · ${printedTribeLabel(unit)}`}
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
  getDragHandlers,
  onUnitClick,
  onEmptyClick,
}: {
  units: MinionInstance[];
  side: "enemy" | "friendly";
  selection?: Selection;
  canDeploy?: boolean;
  dragSession?: DragSession | null;
  actorInstanceId?: string;
  targetInstanceId?: string;
  getDragHandlers?: (
    source: DragSource,
    unit: MinionInstance,
  ) => DragPointerHandlers;
  onUnitClick?: (index: number) => void;
  onEmptyClick?: (index: number) => void;
}) {
  const slotCount =
    side === "enemy"
      ? units.length
      : dragSession?.active && dragSession.zone === "hand"
        ? Math.min(BOARD_LIMIT, units.length + 1)
        : canDeploy && units.length < BOARD_LIMIT
          ? units.length + 1
          : units.length;

  return (
    <div
      className={`board-row${side === "enemy" ? " enemy" : ""}${
        side === "friendly" && dragSession?.active ? " is-drag-active" : ""
      }`}
      data-side={side}
    >
      {Array.from({ length: slotCount }, (_, index) => {
        const unit = units[index];
        const isValidDragTarget =
          side === "friendly" &&
          dragSession?.active === true &&
          (dragSession.zone === "hand"
            ? units.length < BOARD_LIMIT && index <= units.length
            : dragSession.zone === "board"
              ? index < units.length
              : false);
        const isDropTarget =
          isValidDragTarget &&
          dragSession?.target?.kind === "board" &&
          dragSession.target.index === index;
        const slotProps = {
          "data-board-slot-index":
            side === "friendly" ? index : undefined,
          "data-valid": isValidDragTarget || (unit === undefined && canDeploy),
          "data-target": isDropTarget,
        };
        if (unit) {
          return (
            <div className="slot" key={unit.instanceId} {...slotProps}>
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
                  side === "friendly" && getDragHandlers !== undefined
                }
                dragging={
                  dragSession?.active === true &&
                  dragSession.unit.instanceId === unit.instanceId
                }
                combatActor={unit.instanceId === actorInstanceId}
                combatTarget={unit.instanceId === targetInstanceId}
                dragHandlers={
                  side === "friendly" && getDragHandlers
                    ? getDragHandlers({ zone: "board", index }, unit)
                    : undefined
                }
                onClick={
                  onUnitClick ? () => onUnitClick(index) : undefined
                }
              />
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
          />
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
}: {
  player: PlayerState;
  humanId: string;
  opponentId?: string;
  rank: number;
}) {
  return (
    <div
      className={`player-row${player.id === humanId ? " is-player" : ""}${
        !player.alive ? " is-dead" : ""
      }${player.id === opponentId ? " is-opponent" : ""}`}
      data-rank={player.placement ?? rank}
      data-player={player.id === humanId ? "human" : "ai"}
      data-eliminated={!player.alive}
      data-opponent={player.id === opponentId}
      data-testid={`standing-${player.id}`}
    >
      <span className="player-meta">
        <strong>{player.name}</strong>
        <small>
          {player.id === opponentId
            ? "本轮对手"
            : player.alive
              ? `${player.board.length} 随从 · ${player.tavernTier}星`
              : `第 ${player.placement ?? rank} 名`}
        </small>
      </span>
      <span className="player-health">
        生命 {Math.max(0, player.health)}
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
  const [battleSpeed, setBattleSpeed] = useState<BattleSpeed>(1);
  const [battlePlayback, setBattlePlayback] =
    useState<BattlePlaybackState>({
      battle: null,
      revealedCount: 0,
      complete: false,
    });
  const dragSessionRef = useRef<DragSession | null>(null);
  const dragCaptureElementRef = useRef<HTMLButtonElement | null>(null);
  const suppressCardClickRef = useRef(false);
  const battlePlaybackTimerRef = useRef<number | null>(null);

  const writeDragSession = useCallback((next: DragSession | null) => {
    dragSessionRef.current = next;
    setDragSession(next);
  }, []);

  const clearBattlePlaybackTimer = useCallback(() => {
    if (battlePlaybackTimerRef.current === null) return;
    window.clearTimeout(battlePlaybackTimerRef.current);
    battlePlaybackTimerRef.current = null;
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (isGameState(saved)) {
            setGame(saved);
            setStarted(true);
          } else {
            window.localStorage.removeItem(SAVE_KEY);
          }
        }
      } catch {
        window.localStorage.removeItem(SAVE_KEY);
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (!loaded || !started) return;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  }, [game, loaded, started]);

  const send = useCallback(
    (action: GameAction) => {
      setGame((current) => {
        const next = gameReducer(current, action);
        if (started) {
          window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
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

  const standings = useMemo(
    () =>
      [...game.players].sort((left, right) => {
        if (left.alive !== right.alive) return left.alive ? -1 : 1;
        if (left.alive) {
          return (
            right.health - left.health ||
            right.tavernTier - left.tavernTier ||
            left.id.localeCompare(right.id)
          );
        }
        return (
          (left.placement ?? 99) - (right.placement ?? 99) ||
          left.id.localeCompare(right.id)
        );
      }),
    [game.players],
  );

  const battle = game.lastBattle;
  const opponentId = battle
    ? battle.playerAId === game.humanPlayerId
      ? battle.playerBId
      : battle.playerAId
    : human.lastOpponentId;
  const opponent = game.players.find((player) => player.id === opponentId);
  const opponentBoard =
    battle && opponentId
      ? battle.initialBoards[opponentId] ?? opponent?.board ?? []
      : opponent?.board ?? [];
  const playbackEvents = useMemo(
    () => battle?.events.filter(isPlaybackEvent) ?? [],
    [battle],
  );
  const playbackEventCount = playbackEvents.length;
  const playbackIsCurrent =
    game.phase === "combat" &&
    battle !== null &&
    battlePlayback.battle === battle;
  const revealedBattleEventCount =
    game.phase === "combat" && battle
      ? playbackIsCurrent
        ? Math.min(battlePlayback.revealedCount, playbackEventCount)
        : playbackEventCount > 0
          ? 1
          : 0
      : 0;
  const battlePlaybackComplete =
    game.phase === "combat" && battle
      ? playbackIsCurrent
        ? battlePlayback.complete
        : playbackEventCount === 0
      : false;
  const currentBattleEvent =
    revealedBattleEventCount > 0
      ? playbackEvents[revealedBattleEventCount - 1]
      : undefined;
  const friendlyCombatBoard =
    game.phase === "combat" && battle
      ? battle.initialBoards[human.id] ?? human.board
      : human.board;
  const revealedBattleLogEvents = battle
    ? game.phase !== "combat" || battlePlaybackComplete
      ? battle.events
      : playbackEvents.slice(0, revealedBattleEventCount)
    : [];
  const selectedUnit = selectionUnit(selection, human);
  const infoOpen =
    selectedUnit !== null || (infoTab === "battle" && battle !== null);
  const upgradeCost = getUpgradeCost(game, human.id);
  const canBuyFromShop =
    game.phase === "recruit" &&
    human.gold >= 3 &&
    human.hand.length < 10;
  const selectedCanBuy =
    selection?.zone === "shop" && canBuyFromShop;
  const selectedCanPlay =
    selection?.zone === "hand" && human.board.length < BOARD_LIMIT;
  const buyUnavailableReason =
    human.hand.length >= 10
      ? "手牌已满"
      : human.gold < 3
        ? "金币不足，需要 3 枚金币"
        : null;

  useEffect(() => {
    clearBattlePlaybackTimer();
    if (
      !battle ||
      game.phase !== "combat" ||
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
  ]);

  const skipBattlePlayback = useCallback(() => {
    clearBattlePlaybackTimer();
    if (!battle || game.phase !== "combat") return;
    setBattlePlayback({
      battle,
      revealedCount: playbackEventCount,
      complete: true,
    });
  }, [
    battle,
    clearBattlePlaybackTimer,
    game.phase,
    playbackEventCount,
  ]);

  const startFreshGame = useCallback(() => {
    const next = createGame(newSeed());
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    setGame(next);
    setStarted(true);
    setLoaded(true);
    setSelection(null);
    setShowRestart(false);
    setInfoTab("details");
  }, []);

  const deploySelected = useCallback(
    (boardIndex?: number) => {
      if (selection?.zone !== "hand") return;
      send({
        type: "PLAY_MINION",
        handIndex: selection.index,
        boardIndex,
      });
    },
    [selection, send],
  );

  const select = useCallback((nextSelection: Exclude<Selection, null>) => {
    setSelection(nextSelection);
    setInfoTab("details");
  }, []);

  const selectCard = useCallback(
    (nextSelection: Exclude<Selection, null>) => {
      if (suppressCardClickRef.current) {
        suppressCardClickRef.current = false;
        return;
      }
      select(nextSelection);
    },
    [select],
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

      if (
        source.zone === "board" &&
        hit.closest('[data-sell-drop-zone="true"]')
      ) {
        return { kind: "sell" };
      }

      const slot = hit.closest<HTMLElement>("[data-board-slot-index]");
      if (!slot) return null;
      const index = Number(slot.dataset.boardSlotIndex);
      if (!Number.isInteger(index)) return null;

      if (source.zone === "hand") {
        if (
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
    [canBuyFromShop, human.board.length],
  );

  const beginDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      source: DragSource,
      unit: MinionInstance,
    ) => {
      if (
        dragSessionRef.current !== null ||
        game.phase !== "recruit" ||
        (event.pointerType === "mouse" && event.button !== 0) ||
        (source.zone === "hand" && human.board.length >= BOARD_LIMIT) ||
        (source.zone === "shop" && !canBuyFromShop)
      ) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      dragCaptureElementRef.current = event.currentTarget;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The browser can decline capture if the pointer ended immediately.
      }
      writeDragSession({
        ...source,
        unit,
        pointerId: event.pointerId,
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
      game.phase,
      human.board.length,
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
      const active = current.active || distance >= DRAG_THRESHOLD_PX;
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
      const wasActive = current.active || distance >= DRAG_THRESHOLD_PX;
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

      if (!target) return true;
      if (current.zone === "shop" && target.kind === "hand") {
        send({ type: "BUY_MINION", shopIndex: current.index });
        return true;
      }
      if (current.zone === "hand" && target.kind === "board") {
        send({
          type: "PLAY_MINION",
          handIndex: current.index,
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
    [resolveDragTarget, send, writeDragSession],
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
      unit: MinionInstance,
    ): DragPointerHandlers => ({
      onPointerDown: (event) => beginDrag(event, source, unit),
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
      if (event.key === "Escape") cancelStaleDrag();
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
  }, [finishDragSession, moveDragSession]);

  useEffect(() => {
    const current = dragSessionRef.current;
    if (game.phase !== "recruit" && current) {
      finishDragSession(
        current.pointerId,
        current.clientX,
        current.clientY,
        true,
      );
    }
  }, [finishDragSession, game.phase]);

  const dragAnnouncement =
    dragSession?.active !== true
      ? ""
      : dragSession.target?.kind === "sell"
        ? `松手出售${dragSession.unit.name}，获得 ${dragSession.unit.sellValue} 枚金币`
        : dragSession.target?.kind === "hand"
          ? `松手购买${dragSession.unit.name}，支付 3 枚金币`
          : dragSession.target?.kind === "board"
            ? `松手放到战场第 ${dragSession.target.index + 1} 个位置`
            : dragSession.zone === "shop"
              ? "拖到发光的手牌区域购买，花费 3 枚金币"
              : dragSession.zone === "board"
                ? "拖到战场位置来换位，或拖到鲍勃的酒馆出售"
                : "拖到发光的战场位置上场";
  const interactionAnnouncement =
    dragAnnouncement ||
    (selection?.zone === "shop" && buyUnavailableReason
      ? `无法购买${selectedUnit?.name ?? "该随从"}：${buyUnavailableReason}`
      : "");

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
      className={`game-shell${dragSession?.active ? " is-dragging" : ""}`}
      data-phase={game.phase}
      data-loaded={loaded}
      data-dragging={dragSession?.active === true}
      data-testid="game-shell"
    >
      <header className="top-hud">
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
        <div className="hud-stat" aria-label={`生命 ${human.health}`}>
          <small>生命</small>
          <strong>{Math.max(0, human.health)}</strong>
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
            onClick={() => setShowRestart(true)}
          >
            重开
          </button>
          <button
            type="button"
            className="action-button primary"
            data-testid="end-turn"
            disabled={game.phase !== "recruit" || !started}
            onClick={() => {
              setInfoTab("battle");
              send({ type: "END_TURN" });
            }}
          >
            {game.phase === "recruit" ? "结束回合" : "战斗中"}
          </button>
        </div>
      </header>

      <div className="main-grid">
        <section className="play-column" aria-label="游戏区域">
          <section
            className={`panel shop-panel${
              dragSession?.active && dragSession.zone === "board"
                ? " is-sell-ready"
                : ""
            }${
              dragSession?.target?.kind === "sell" ? " is-sell-target" : ""
            }`}
            aria-label="鲍勃的酒馆"
            data-sell-drop-zone="true"
            data-testid="sell-drop-zone"
          >
            <div className="sell-drop-feedback" aria-hidden="true">
              <strong>出售给鲍勃</strong>
              <span>
                松手获得 {dragSession?.unit.sellValue ?? 1} 枚金币
              </span>
            </div>
            <div className="panel-title">
              <span>
                鲍勃的酒馆
                <small>
                  每个随从 3 金币 · 本局{" "}
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
                  disabled={game.phase !== "recruit" || human.gold < 1}
                  onClick={() => send({ type: "REFRESH_SHOP" })}
                >
                  刷新 · 1
                </button>
                <button
                  type="button"
                  className={`action-button secondary${
                    human.frozen ? " is-active" : ""
                  }`}
                  data-testid="freeze-shop"
                  disabled={game.phase !== "recruit"}
                  onClick={() => send({ type: "TOGGLE_FREEZE" })}
                >
                  {human.frozen ? "解冻酒馆" : "冻结酒馆"}
                </button>
              </div>
              <div className="card-row" data-testid="shop-row">
                {human.shop.map((unit, index) => (
                  <UnitCard
                    unit={unit}
                    key={unit.instanceId}
                    selected={
                      selection?.zone === "shop" &&
                      selection.index === index
                    }
                    unaffordable={
                      human.gold < 3 || human.hand.length >= 10
                    }
                    testId={`shop-card-${index}`}
                    dragEnabled={canBuyFromShop}
                    dragging={
                      dragSession?.active === true &&
                      dragSession.unit.instanceId === unit.instanceId
                    }
                    dragHandlers={
                      canBuyFromShop
                        ? getDragHandlers({ zone: "shop", index }, unit)
                        : undefined
                    }
                    onClick={() => selectCard({ zone: "shop", index })}
                  />
                ))}
                {human.shop.length === 0 && (
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
                    currentBattleEvent.targetPlayerId === opponentId
                      ? currentBattleEvent.targetInstanceId
                      : undefined
                  }
                />
              )}
              {game.phase === "combat" &&
                battle &&
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
                    >
                      <span className="combat-playback-progress">
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
                battlePlaybackComplete && (
                  <div className="combat-banner" role="status">
                    <strong>{resultLabel(battle.resultForHuman)}</strong>
                    <span>
                      {battleDamage > 0
                        ? `${battleDamage} 点英雄伤害`
                        : "双方英雄未受伤害"}
                    </span>
                    <button
                      type="button"
                      className="action-button primary"
                      data-testid="continue-after-combat"
                      onClick={() => send({ type: "CONTINUE" })}
                    >
                      {human.alive ? "继续招募" : "查看最终名次"}
                    </button>
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
                  currentBattleEvent?.targetPlayerId === human.id
                    ? currentBattleEvent.targetInstanceId
                    : undefined
                }
                canDeploy={
                  game.phase === "recruit" &&
                  selection?.zone === "hand" &&
                  human.board.length < BOARD_LIMIT
                }
                getDragHandlers={
                  game.phase === "recruit" ? getDragHandlers : undefined
                }
                onUnitClick={(index) =>
                  game.phase === "recruit" &&
                  selectCard({ zone: "board", index })
                }
                onEmptyClick={deploySelected}
              />
              {game.phase === "recruit" && human.board.length === 0 && (
                <div className="empty-state board-empty">
                  从手牌选择随从，再点空位上场
                </div>
              )}
            </div>
          </section>

          <section
            className={`panel hand-panel${
              dragSession?.active && dragSession.zone === "shop"
                ? " is-buy-ready"
                : ""
            }${
              dragSession?.target?.kind === "hand" ? " is-buy-target" : ""
            }${
              selection?.zone === "shop" && buyUnavailableReason
                ? " is-buy-unavailable"
                : ""
            }`}
            aria-label="手牌"
            aria-describedby="buy-drop-description"
            data-drop-cost="3"
            data-drop-kind="buy"
            data-drop-reason={buyUnavailableReason ?? undefined}
            data-drop-state={
              dragSession?.target?.kind === "hand"
                ? "target"
                : dragSession?.active && dragSession.zone === "shop"
                  ? "ready"
                  : selection?.zone === "shop" && buyUnavailableReason
                    ? "unavailable"
                    : "idle"
            }
            data-drop-valid={canBuyFromShop}
            data-hand-drop-zone="true"
            data-testid="buy-drop-zone"
          >
            <div className="buy-drop-feedback" aria-hidden="true">
              <strong>
                {selection?.zone === "shop" && buyUnavailableReason
                  ? "无法购买"
                  : "购买到手牌"}
              </strong>
              <span>
                {selection?.zone === "shop" && buyUnavailableReason
                  ? buyUnavailableReason
                  : "松手支付 3 枚金币"}
              </span>
            </div>
            <div className="panel-title">
              <span>
                手牌
                <small>选择随从后放到战场</small>
              </span>
              <span>{human.hand.length} / 10</span>
            </div>
            <div className="card-row" data-testid="hand-row">
              {human.hand.map((unit, index) => (
                <UnitCard
                  unit={unit}
                  compact
                  key={unit.instanceId}
                  selected={
                    selection?.zone === "hand" && selection.index === index
                  }
                  testId={`hand-card-${index}`}
                  dragEnabled={
                    game.phase === "recruit" &&
                    human.board.length < BOARD_LIMIT
                  }
                  dragging={
                    dragSession?.active === true &&
                    dragSession.unit.instanceId === unit.instanceId
                  }
                  dragHandlers={
                    game.phase === "recruit" &&
                    human.board.length < BOARD_LIMIT
                      ? getDragHandlers({ zone: "hand", index }, unit)
                      : undefined
                  }
                  onClick={() => selectCard({ zone: "hand", index })}
                />
              ))}
              {human.hand.length === 0 && (
                <div className="empty-state">购买的随从会进入这里</div>
              )}
            </div>
          </section>
        </section>

        <aside className="side-rail" aria-label="排名与战报">
          <section className="panel standings-panel">
            <div className="panel-title">
              <span>8 人战局</span>
              <span>{game.players.filter((player) => player.alive).length} 存活</span>
            </div>
            <div className="standings" data-testid="standings">
              {standings.map((player, index) => (
                <PlayerRow
                  player={player}
                  humanId={game.humanPlayerId}
                  opponentId={
                    game.phase === "combat" ? opponentId : undefined
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
                {selectedUnit ? (
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
                    {selectedUnit.effectSupport === "partial" && (
                      <p
                        className="rules-support-note"
                        data-testid="partial-rules-note"
                      >
                        本地版已结算这张牌的基础属性与卡面关键词；专属文字效果仍在逐张适配。
                      </p>
                    )}
                    <div className="detail-keywords">
                      {selectedUnit.taunt && <span>嘲讽</span>}
                      {selectedUnit.divineShield && <span>圣盾</span>}
                      {selectedUnit.reborn && <span>复生</span>}
                      {selectedUnit.poisonous && <span>剧毒</span>}
                      {selectedUnit.venomous && <span>烈毒</span>}
                      {selectedUnit.windfury && <span>风怒</span>}
                      {selectedUnit.cleave && <span>顺劈</span>}
                      {selectedUnit.golden && <span>金色随从</span>}
                    </div>
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
                          部署到战场
                        </button>
                      )}
                      {selection?.zone === "board" && (
                        <>
                          <button
                            type="button"
                            className="action-button secondary"
                            disabled={selection.index === 0}
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
              <div className="battle-log" aria-live="polite">
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

      <span className="sr-only" id="drag-instructions">
        可按住并拖动。商店随从拖到手牌区域购买；手牌拖到战场上场；场上随从可拖动换位，或拖到鲍勃的酒馆出售。也可点击卡牌后使用详情面板中的按钮。
      </span>
      <span className="sr-only" id="buy-drop-description">
        购买随从需要 3 枚金币且手牌未满。点击商店随从后也可使用详情面板中的购买按钮。
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {interactionAnnouncement}
      </span>

      {dragSession?.active && (
        <div
          className="unit-card is-compact is-dragging drag-ghost"
          aria-hidden="true"
          data-testid="drag-ghost"
          style={
            {
              "--card-hue": TRIBE_HUE[dragSession.unit.tribe],
              left: dragSession.clientX - dragSession.offsetX,
              top: dragSession.clientY - dragSession.offsetY,
              width: dragSession.width,
              height: dragSession.height,
            } as CSSProperties
          }
        >
          <UnitCardFace unit={dragSession.unit} />
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
              <span>36.0.3 · 237 张随从</span>
              <span>每局开放 5 个种族</span>
              <span>鼠标与触控拖拽</span>
              <span>三连金色随从</span>
            </div>
            <button
              type="button"
              className="action-button primary"
              data-testid="start-game"
              onClick={() => {
                window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
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
