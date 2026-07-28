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
import {
  CLASSIC_ROSTER_VERSION,
  TRIBE_NAMES,
} from "../lib/game/content";

const SAVE_KEY = "hearthstone-battlegrounds-local.save.v2";
const INITIAL_SEED = 0x53544152;
const BOARD_LIMIT = 7;

type Selection =
  | { zone: "shop" | "hand" | "board"; index: number }
  | null;

type InfoTab = "details" | "battle";

const TRIBE_HUE: Record<Tribe, number> = {
  beast: 106,
  mech: 198,
  demon: 286,
  murloc: 190,
  dragon: 18,
  pirate: 42,
  neutral: 42,
};

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 2 &&
    candidate.contentVersion === CLASSIC_ROSTER_VERSION &&
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
  if (result === "win") return "战斗胜利";
  if (result === "loss") return "战斗失利";
  return "势均力敌";
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
  const keyword =
    [
      unit.golden ? "金色" : "",
      unit.taunt ? "嘲讽" : "",
      unit.divineShield ? "圣盾" : "",
      unit.reborn ? "复生" : "",
      unit.poisonous ? "剧毒" : "",
      unit.windfury ? "风怒" : "",
      unit.cleave ? "顺劈" : "",
    ]
      .filter(Boolean)
      .join(" · ") || TRIBE_NAMES[unit.tribe];

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
      <CardArtwork unit={unit} kind="portrait" />
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
      data-fallback={`${unit.name} · ${TRIBE_NAMES[unit.tribe]}`}
    >
      {source ? (
        // A plain img is required for the local -> remote -> placeholder chain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={kind === "detail" ? `${unit.name}卡牌图` : ""}
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
  const infoOpen =
    selectedUnit !== null || (infoTab === "battle" && battle !== null);
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
          酒馆战棋 · 单机版
          <small>第 {game.round} 回合 · 经典怀旧卡池</small>
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
          <section className="panel shop-panel" aria-label="鲍勃的酒馆">
            <div className="panel-title">
              <span>
                鲍勃的酒馆
                <small>每个随从 3 金币</small>
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
                    onClick={() => select({ zone: "shop", index })}
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
                <BoardRow units={opponentBoard} side="enemy" />
              )}
              {game.phase === "combat" && battle && (
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
                  从手牌选择随从，再点空位上场
                </div>
              )}
            </div>
          </section>

          <section className="panel hand-panel" aria-label="手牌">
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
                  onClick={() => select({ zone: "hand", index })}
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
                      {selectedUnit.taunt && <span>嘲讽</span>}
                      {selectedUnit.divineShield && <span>圣盾</span>}
                      {selectedUnit.reborn && <span>复生</span>}
                      {selectedUnit.poisonous && <span>剧毒</span>}
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
                    <strong>选择一个随从</strong>
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
                    点击“结束回合”后，7 名 AI 会完成招募并自动战斗。
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
            <span className="modal-kicker">非官方本地单人版本</span>
            <h1>经典酒馆战棋</h1>
            <p>
              你将与 7 名 AI 对战。没有回合倒计时，由你决定何时结束招募并进入战斗。
            </p>
            <div className="modal-features">
              <span>8 人战局</span>
              <span>经典怀旧随从</span>
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
