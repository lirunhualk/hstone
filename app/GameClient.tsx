"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createGame,
  gameReducer,
  getUpgradeCost,
  type BattleResult,
  type GameAction,
  type GameState,
  type MinionInstance,
  type PlayerState,
  type Tribe,
} from "../lib/game/engine";
import { TRIBE_NAMES } from "../lib/game/content";

const SAVE_KEY = "starport-battlegrounds.save.v1";
const INITIAL_SEED = 0x53544152;
const BOARD_LIMIT = 7;

type Selection =
  | { zone: "shop" | "hand" | "board"; index: number }
  | null;

type InfoTab = "details" | "battle";

const TRIBE_ICON: Record<Tribe, string> = {
  wild: "🦎",
  construct: "🤖",
  ember: "🔥",
  tide: "🐙",
  astral: "✨",
  neutral: "🛰️",
};

const TRIBE_HUE: Record<Tribe, number> = {
  wild: 116,
  construct: 192,
  ember: 18,
  tide: 205,
  astral: 268,
  neutral: 42,
};

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 1 &&
    typeof candidate.seed === "number" &&
    Array.isArray(candidate.players) &&
    candidate.players.length === 8 &&
    typeof candidate.humanPlayerId === "string" &&
    (candidate.phase === "recruit" ||
      candidate.phase === "combat" ||
      candidate.phase === "gameOver")
  );
}

function newSeed(): number {
  const seed = Date.now() >>> 0;
  return seed === 0 ? INITIAL_SEED : seed;
}

function resultLabel(result: BattleResult | undefined): string {
  if (result === "win") return "交锋胜利";
  if (result === "loss") return "防线失守";
  return "势均力敌";
}

function phaseLabel(phase: GameState["phase"]): string {
  if (phase === "recruit") return "整备";
  if (phase === "combat") return "交锋";
  return "终局";
}

function selectionUnit(
  selection: Selection,
  player: PlayerState,
): MinionInstance | null {
  if (!selection) return null;
  return player[selection.zone][selection.index] ?? null;
}

function UnitCard({
  unit,
  selected = false,
  unaffordable = false,
  compact = false,
  testId,
  onClick,
}: {
  unit: MinionInstance;
  selected?: boolean;
  unaffordable?: boolean;
  compact?: boolean;
  testId?: string;
  onClick?: () => void;
}) {
  const keyword = unit.golden
    ? "金色"
    : unit.divineShield
      ? "护盾"
      : unit.taunt
        ? "守卫"
        : TRIBE_NAMES[unit.tribe];

  return (
    <button
      type="button"
      className={`unit-card${selected ? " is-selected" : ""}${
        unaffordable ? " is-unaffordable" : ""
      }${compact ? " is-compact" : ""}`}
      aria-label={`${unit.name}，${unit.attack} 攻击，${unit.health} 生命`}
      aria-pressed={selected}
      data-testid={testId}
      onClick={onClick}
      style={{ "--card-hue": TRIBE_HUE[unit.tribe] } as React.CSSProperties}
    >
      <span className="card-art" data-icon={TRIBE_ICON[unit.tribe]}>
        <span aria-hidden="true">{TRIBE_ICON[unit.tribe]}</span>
      </span>
      <span className="card-tier">{unit.tier}</span>
      <span className="card-name">
        {unit.golden ? "✦ " : ""}
        {unit.name}
      </span>
      <span className="keyword">{keyword}</span>
      <span className="card-stats">
        <span className="stat" data-stat="attack">
          ATK {unit.attack}
        </span>
        <span className="stat" data-stat="health">
          HP {unit.health}
        </span>
      </span>
    </button>
  );
}

function BoardRow({
  units,
  side,
  selection,
  canDeploy,
  onUnitClick,
  onEmptyClick,
}: {
  units: MinionInstance[];
  side: "enemy" | "friendly";
  selection?: Selection;
  canDeploy?: boolean;
  onUnitClick?: (index: number) => void;
  onEmptyClick?: (index: number) => void;
}) {
  return (
    <div
      className={`board-row${side === "enemy" ? " enemy" : ""}`}
      data-side={side}
    >
      {Array.from({ length: BOARD_LIMIT }, (_, index) => {
        const unit = units[index];
        if (unit) {
          return (
            <div className="slot" key={unit.instanceId}>
              <UnitCard
                unit={unit}
                compact
                selected={
                  side === "friendly" &&
                  selection?.zone === "board" &&
                  selection.index === index
                }
                testId={`${side}-unit-${index}`}
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
            data-valid={canDeploy === true}
            aria-label={
              canDeploy ? `部署到第 ${index + 1} 个位置` : "空阵位"
            }
            key={`${side}-empty-${index}`}
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
      <span className="player-avatar" aria-hidden="true">
        {player.isHuman ? "🧭" : player.alive ? "🛸" : "◇"}
      </span>
      <span className="player-meta">
        <strong>{player.name}</strong>
        <small>
          {player.id === opponentId
            ? "本轮对手"
            : player.alive
              ? `${player.board.length} 单位 · ${player.tavernTier}级`
              : `第 ${player.placement ?? rank} 名`}
        </small>
      </span>
      <span className="player-health">♥ {Math.max(0, player.health)}</span>
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

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (raw) {
          const saved: unknown = JSON.parse(raw);
          if (isGameState(saved)) {
            setGame(saved);
            setStarted(true);
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
  const selectedUnit = selectionUnit(selection, human);
  const upgradeCost = getUpgradeCost(game, human.id);
  const selectedCanBuy =
    selection?.zone === "shop" && human.gold >= 3 && human.hand.length < 10;
  const selectedCanPlay =
    selection?.zone === "hand" && human.board.length < BOARD_LIMIT;

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
      className="game-shell"
      data-phase={game.phase}
      data-loaded={loaded}
      data-testid="game-shell"
    >
      <header className="top-hud">
        <div className="brand">
          星港战阵
          <small>第 {game.round} 回合 · 单人战局</small>
        </div>
        <span className="phase-pill">{phaseLabel(game.phase)}</span>
        <div className="hud-stat" aria-label={`生命 ${human.health}`}>
          <small>生命</small>
          <strong>♥ {Math.max(0, human.health)}</strong>
        </div>
        <div className="hud-stat" aria-label={`金币 ${human.gold}`}>
          <small>金币</small>
          <strong>◉ {human.gold}</strong>
        </div>
        <div className="hud-stat" aria-label={`基地等级 ${human.tavernTier}`}>
          <small>基地</small>
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
          <section className="panel shop-panel" aria-label="补给站">
            <div className="panel-title">
              <span>
                补给站
                <small>每个单位 3 金币</small>
              </span>
              <span>{human.frozen ? "已锁定" : "整备中"}</span>
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
                    ? "基地已满级"
                    : `升级至 ${human.tavernTier + 1}级 · ${upgradeCost}`}
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
                  {human.frozen ? "解除锁定" : "锁定补给"}
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
                    onClick={() => select({ zone: "shop", index })}
                  />
                ))}
                {human.shop.length === 0 && (
                  <div className="empty-state">补给池暂时为空</div>
                )}
              </div>
            </div>
          </section>

          <section className="panel board-panel" aria-label="战斗阵列">
            <div className="panel-title">
              <span>
                {game.phase === "combat" ? "交锋航道" : "你的阵列"}
                <small>
                  {game.phase === "combat"
                    ? `对阵 ${opponent?.name ?? "幽灵舰队"}`
                    : "单位从左到右依次出击"}
                </small>
              </span>
              <span>{human.board.length} / 7</span>
            </div>
            <div className="board">
              {game.phase === "combat" && (
                <BoardRow units={opponentBoard} side="enemy" />
              )}
              {game.phase === "combat" && battle && (
                <div className="combat-banner" role="status">
                  <strong>{resultLabel(battle.resultForHuman)}</strong>
                  <span>
                    {battleDamage > 0
                      ? `${battleDamage} 点核心伤害`
                      : "双方核心未受损"}
                  </span>
                  <button
                    type="button"
                    className="action-button primary"
                    data-testid="continue-after-combat"
                    onClick={() => send({ type: "CONTINUE" })}
                  >
                    {human.alive ? "继续整备" : "查看最终名次"}
                  </button>
                </div>
              )}
              <BoardRow
                units={human.board}
                side="friendly"
                selection={selection}
                canDeploy={
                  game.phase === "recruit" &&
                  selection?.zone === "hand" &&
                  human.board.length < BOARD_LIMIT
                }
                onUnitClick={(index) =>
                  game.phase === "recruit" &&
                  select({ zone: "board", index })
                }
                onEmptyClick={deploySelected}
              />
              {game.phase === "recruit" && human.board.length === 0 && (
                <div className="empty-state board-empty">
                  从手牌选择单位，再点空阵位部署
                </div>
              )}
            </div>
          </section>

          <section className="panel hand-panel" aria-label="手牌">
            <div className="panel-title">
              <span>
                战术储备
                <small>选择单位后部署到阵列</small>
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
                  onClick={() => select({ zone: "hand", index })}
                />
              ))}
              {human.hand.length === 0 && (
                <div className="empty-state">购买的单位会进入这里</div>
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
            className="panel info-panel is-open"
            data-open="true"
            aria-label="单位详情与战报"
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
            </div>

            {infoTab === "details" ? (
              <div className="details-content">
                {selectedUnit ? (
                  <>
                    <div
                      className="detail-art"
                      data-icon={TRIBE_ICON[selectedUnit.tribe]}
                      aria-hidden="true"
                    >
                      {TRIBE_ICON[selectedUnit.tribe]}
                    </div>
                    <h2>
                      {selectedUnit.golden ? "✦ " : ""}
                      {selectedUnit.name}
                    </h2>
                    <p className="detail-meta">
                      {selectedUnit.tier} 级 ·{" "}
                      {TRIBE_NAMES[selectedUnit.tribe]} · ATK{" "}
                      {selectedUnit.attack} / HP {selectedUnit.health}
                    </p>
                    <p>{selectedUnit.description}</p>
                    <div className="detail-keywords">
                      {selectedUnit.taunt && <span>守卫</span>}
                      {selectedUnit.divineShield && <span>护盾</span>}
                      {selectedUnit.golden && <span>金色单位</span>}
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
                          部署到阵列
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
                            ← 左移
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
                            右移 →
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
                            出售 +1
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state details-empty">
                    <strong>选择一个单位</strong>
                    <span>查看属性、能力与可用操作</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="battle-log" aria-live="polite">
                {battle?.events?.length ? (
                  battle.events.slice(-80).map((event) => (
                    <p key={`${battle.round}-${event.index}`}>
                      <strong>{event.index + 1}</strong> {event.message}
                    </p>
                  ))
                ) : (
                  <div className="empty-state">
                    点击“结束回合”后，7 名 AI 会完成整备并自动交锋。
                  </div>
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      {!started && loaded && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <span className="modal-kicker">本地单人自动战棋</span>
            <h1>星港战阵</h1>
            <p>
              你将与 7 名 AI 对战。没有回合倒计时，由你决定何时结束整备并进入交锋。
            </p>
            <div className="modal-features">
              <span>8 人战局</span>
              <span>共享补给池</span>
              <span>三连金色单位</span>
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
              {game.winnerId === game.humanPlayerId ? "航道已肃清" : "战局结束"}
            </span>
            <h1>
              {game.winnerId === game.humanPlayerId
                ? "你赢得了战局"
                : `最终第 ${human.placement ?? 8} 名`}
            </h1>
            <p>
              坚持 {game.round} 回合，最终阵列保留 {human.board.length} 个单位。
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
