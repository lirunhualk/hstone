import {
  canMagnetize,
  createGame,
  gameTransition,
  getHeroPowerActivationQuote,
  getLegalSpellcraftTargetIds,
  getLegalTavernSpellTargetIds,
  getMinionPurchaseQuote,
  getMaximumTavernTier,
  getTavernRefreshQuote,
  getTavernSpellPurchaseQuote,
  getUpgradeCost,
  MAX_BOARD_SIZE,
  MAX_HAND_SIZE,
} from "./engine.ts";
import {
  createAiTrainingObservation,
  type AiTrainingCardReference,
  type AiTrainingObservation,
  type DeepReadonly,
} from "./ai-training.ts";
import {
  createInitialHeroPowerCounters,
  heroPowerIsPlayable,
} from "./hero-powers.ts";
import { DEFAULT_INITIAL_HEALTH } from "./setup.ts";
import { spellcraftNeedsTarget } from "./spellcraft.ts";
import { tavernSpellNeedsTarget } from "./tavern-spells.ts";
import type {
  BattleResult,
  BattleSummary,
  GameAction,
  GameState,
  PendingInteraction,
  PlayerState,
} from "./types.ts";

export const AI_TRAINING_ENVIRONMENT_VERSION = 4 as const;

export interface AiTrainingEnvironmentConfiguration {
  /** Optional implemented power assigned to the controlled seat for training. */
  heroPowerId?: string | null;
}

export type AiTrainingPlannerDisposition =
  | "deterministic"
  | "replan"
  | "terminal"
  | "unsupported";

export interface AiTrainingActionCost {
  currency: "gold" | "health";
  amount: number;
}

export interface AiTrainingLegalAction {
  /** Opaque and valid only for the state revision that produced this mask. */
  token: string;
  type: GameAction["type"];
  source: AiTrainingCardReference | null;
  target: AiTrainingCardReference | null;
  boardIndex: number | null;
  choiceIndex: number | null;
  /** Public price shown to the controlled player, when the action has one. */
  cost: Readonly<AiTrainingActionCost> | null;
  /**
   * Conservative pre-execution boundary. `replan` may include deterministic
   * actions, but `deterministic` must never consume private engine RNG.
   */
  plannerDisposition: AiTrainingPlannerDisposition;
}

export type AiTrainingPlannerTransition =
  | Readonly<{
      kind: "replanBoundary";
      action: Readonly<AiTrainingLegalAction>;
    }>
  | Readonly<{
      kind: "deterministic";
      action: Readonly<AiTrainingLegalAction>;
      environment: AiTrainingEnvironment;
      observation: DeepReadonly<AiTrainingObservation>;
      done: boolean;
    }>;

export interface AiTrainingOwnBattleObservation {
  round: number;
  opponentSeat: number;
  result: BattleResult;
  isGhost: boolean;
  damageDealt: number;
  damageTaken: number;
  healthBefore: number;
  healthAfter: number;
  armorBefore: number;
  armorAfter: number;
}

export interface AiTrainingRewardSignals {
  healthDelta: number;
  armorDelta: number;
  goldDelta: number;
  boardSizeDelta: number;
  handSizeDelta: number;
  tavernTierDelta: number;
  battleResult: BattleResult | null;
  damageDealt: number;
  damageTaken: number;
  placement: number | null;
  /** 1 for first place and 0 for eighth place; null before elimination. */
  terminalPlacementReward: number | null;
}

export interface AiTrainingStepResult {
  environmentVersion: typeof AI_TRAINING_ENVIRONMENT_VERSION;
  observation: DeepReadonly<AiTrainingObservation>;
  legalActions: readonly Readonly<AiTrainingLegalAction>[];
  action: Readonly<AiTrainingLegalAction> | null;
  accepted: boolean;
  /** Whether the accepted transition advanced the private engine RNG. */
  randomnessConsumed: boolean;
  done: boolean;
  ownBattle: Readonly<AiTrainingOwnBattleObservation> | null;
  rewardSignals: Readonly<AiTrainingRewardSignals>;
}

interface CandidateAction {
  action: GameAction;
  descriptor: Omit<AiTrainingLegalAction, "token">;
}

type ActionMaskScope = "all" | "planner";

interface CachedActionMask {
  revision: number;
  candidates: readonly CandidateAction[];
  actions: readonly Readonly<AiTrainingLegalAction>[];
}

const INTERNAL_FORK_TOKEN = Symbol("ai-training-environment-fork");

interface InternalForkSnapshot {
  token: typeof INTERNAL_FORK_TOKEN;
  state: GameState;
  stateRevision: number;
  actionMasks: ReadonlyMap<ActionMaskScope, CachedActionMask>;
}

function validateControlledSeat(
  state: GameState,
  controlledSeat: number,
): void {
  if (
    !Number.isInteger(controlledSeat) ||
    controlledSeat < 0 ||
    controlledSeat >= state.players.length
  ) {
    throw new RangeError(`Unknown controlled seat: ${controlledSeat}`);
  }
}

function controlledPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  if (!player) {
    throw new Error(`Missing controlled player ${state.humanPlayerId}`);
  }
  return player;
}

function configureControlledSeat(
  state: GameState,
  controlledSeat: number,
  configuration: AiTrainingEnvironmentConfiguration = {},
): void {
  validateControlledSeat(state, controlledSeat);
  state.humanPlayerId = state.players[controlledSeat].id;
  state.players.forEach((player, seat) => {
    player.isHuman = seat === controlledSeat;
  });
  if (configuration.heroPowerId !== undefined) {
    const player = state.players[controlledSeat];
    if (configuration.heroPowerId === null) {
      player.heroPowerId = null;
      player.heroPowerCounters = {};
    } else {
      if (!heroPowerIsPlayable(configuration.heroPowerId)) {
        throw new RangeError(
          `Unsupported training Hero Power: ${configuration.heroPowerId}`,
        );
      }
      player.heroPowerId = configuration.heroPowerId;
      player.heroPowerCounters = createInitialHeroPowerCounters(
        configuration.heroPowerId,
      );
    }
    player.heroPowerActiveThisTurn = false;
  }
}

function reference(
  zone: AiTrainingCardReference["zone"],
  index: number,
): AiTrainingCardReference {
  return { zone, index };
}

function candidate(
  action: GameAction,
  fields: Partial<
    Omit<AiTrainingLegalAction, "token" | "type">
  > = {},
): CandidateAction {
  return {
    action,
    descriptor: {
      type: action.type,
      source: fields.source ?? null,
      target: fields.target ?? null,
      boardIndex: fields.boardIndex ?? null,
      choiceIndex: fields.choiceIndex ?? null,
      cost: fields.cost ?? null,
      plannerDisposition:
        fields.plannerDisposition ?? plannerDisposition(action.type),
    },
  };
}

function plannerDisposition(
  type: GameAction["type"],
): AiTrainingPlannerDisposition {
  switch (type) {
    case "TOGGLE_FREEZE":
    case "MOVE_MINION":
      return "deterministic";
    case "END_TURN":
      return "terminal";
    case "CONTINUE":
      return "unsupported";
    default:
      return "replan";
  }
}

function pendingOptionIds(interaction: PendingInteraction): string[] {
  switch (interaction.kind) {
    case "target":
    case "magnetizeTarget":
      return [...interaction.optionInstanceIds];
    case "discover":
    case "tavernSpellDiscover":
    case "darkmoonPrizeDiscover":
      return interaction.options.map((option) => option.instanceId);
    case "tavernSpellChoice":
    case "spellcraftChoice":
    case "heroPowerChoice":
    case "secretChoice":
    case "heroChoice":
    case "trinketChoice":
    case "minionChoice":
      return [...interaction.optionIds];
  }
}

function pendingCandidates(
  state: GameState,
  interaction: PendingInteraction,
): CandidateAction[] {
  if (interaction.playerId !== state.humanPlayerId) return [];
  return pendingOptionIds(interaction).map((optionInstanceId, choiceIndex) =>
    candidate(
      {
        type: "RESOLVE_INTERACTION",
        interactionId: interaction.interactionId,
        optionInstanceId,
      },
      { choiceIndex },
    ),
  );
}

function recruitCandidates(state: GameState): CandidateAction[] {
  const player = controlledPlayer(state);
  const candidates: CandidateAction[] = [];
  if (player.hand.length < MAX_HAND_SIZE) {
    player.shop.forEach((_minion, shopIndex) => {
      const quote = getMinionPurchaseQuote(
        state,
        player.id,
        shopIndex,
      );
      if (!quote?.affordable) {
        return;
      }
      candidates.push(
        candidate(
          { type: "BUY_MINION", shopIndex },
          {
            source: reference("shop", shopIndex),
            cost: { currency: quote.currency, amount: quote.cost },
          },
        ),
      );
    });
  }
  const spellOffers = [
    ...(player.spellShop
      ? [
          {
            spell: player.spellShop,
            source: reference("spellShop", 0),
          },
        ]
      : []),
    ...player.additionalSpellShop.map((spell, index) => ({
      spell,
      source: reference("additionalSpellShop", index),
    })),
  ];
  for (const offer of spellOffers) {
    const quote = getTavernSpellPurchaseQuote(
      state,
      player.id,
      offer.spell.instanceId,
    );
    if (!quote?.affordable) continue;
    candidates.push(
      candidate(
        {
          type: "BUY_TAVERN_SPELL",
          spellInstanceId: offer.spell.instanceId,
        },
        {
          source: offer.source,
          cost: { currency: quote.currency, amount: quote.cost },
        },
      ),
    );
  }

  player.board.forEach((_minion, boardIndex) => {
    candidates.push(
      candidate(
        { type: "SELL_MINION", boardIndex },
        { source: reference("board", boardIndex) },
      ),
    );
  });

  const boardTargets = player.board.map((_minion, index) =>
    reference("board", index),
  );
  const shopTargets = player.shop.map((_minion, index) =>
    reference("shop", index),
  );
  player.hand.forEach((card, handIndex) => {
    const source = reference("hand", handIndex);
    switch (card.kind) {
      case "minion":
        if (
          player.board.length < MAX_BOARD_SIZE &&
          (card.playableFromRound ?? 0) <= state.round
        ) {
          for (
            let boardIndex = 0;
            boardIndex <= player.board.length;
            boardIndex += 1
          ) {
            candidates.push(
              candidate(
                {
                  type: "PLAY_HAND_CARD",
                  cardInstanceId: card.instanceId,
                  boardIndex,
                },
                { source, boardIndex },
              ),
            );
          }
        }
        for (const target of boardTargets) {
          if (
            (card.playableFromRound ?? 0) > state.round ||
            !canMagnetize(card, player.board[target.index])
          ) {
            continue;
          }
          candidates.push(
            candidate(
              {
                type: "MAGNETIZE_MINION",
                cardInstanceId: card.instanceId,
                targetInstanceId:
                  player.board[target.index].instanceId,
              },
              { source, target },
            ),
          );
        }
        break;
      case "tripleReward":
      case "consolationCoin":
        candidates.push(
          candidate(
            {
              type: "PLAY_HAND_CARD",
              cardInstanceId: card.instanceId,
            },
            { source },
          ),
        );
        break;
      case "bloodGem":
        for (const target of boardTargets) {
          candidates.push(
            candidate(
              {
                type: "CAST_BLOOD_GEM",
                cardInstanceId: card.instanceId,
                targetInstanceId:
                  player.board[target.index].instanceId,
              },
              { source, target },
            ),
          );
        }
        break;
      case "tavernSpell":
        if (!tavernSpellNeedsTarget(card)) {
          candidates.push(
            candidate(
              {
                type: "CAST_TAVERN_SPELL",
                cardInstanceId: card.instanceId,
              },
              { source },
            ),
          );
        }
        const legalTavernSpellTargets = new Set(
          getLegalTavernSpellTargetIds(
            state,
            player.id,
            card,
          ),
        );
        for (const target of [...boardTargets, ...shopTargets]) {
          const targetInstanceId =
            target.zone === "board"
              ? player.board[target.index].instanceId
              : player.shop[target.index].instanceId;
          if (!legalTavernSpellTargets.has(targetInstanceId)) continue;
          candidates.push(
            candidate(
              {
                type: "CAST_TAVERN_SPELL",
                cardInstanceId: card.instanceId,
                targetInstanceId,
              },
              { source, target },
            ),
          );
        }
        break;
      case "spellcraft":
        if (!spellcraftNeedsTarget(card)) {
          candidates.push(
            candidate(
              {
                type: "CAST_SPELLCRAFT",
                cardInstanceId: card.instanceId,
              },
              { source },
            ),
          );
        }
        const legalSpellcraftTargets = new Set(
          getLegalSpellcraftTargetIds(state, player.id, card),
        );
        for (const target of boardTargets) {
          const targetInstanceId =
            player.board[target.index].instanceId;
          if (!legalSpellcraftTargets.has(targetInstanceId)) continue;
          candidates.push(
            candidate(
              {
                type: "CAST_SPELLCRAFT",
                cardInstanceId: card.instanceId,
                targetInstanceId,
              },
              { source, target },
            ),
          );
        }
        break;
    }
  });

  const heroPowerQuote = getHeroPowerActivationQuote(
    state,
    player.id,
  );
  if (
    heroPowerQuote?.affordable &&
    heroPowerQuote.usable
  ) {
    const cost = {
      currency: "gold" as const,
      amount: heroPowerQuote.cost,
    };
    if (heroPowerQuote.targetKind === null) {
      candidates.push(
        candidate(
          { type: "ACTIVATE_HERO_POWER" },
          { cost },
        ),
      );
    } else {
      const targets =
        heroPowerQuote.targetKind === "shop"
          ? player.shop.map((_minion, index) => reference("shop", index))
          : player.board.map((_minion, index) => reference("board", index));
      for (const target of targets) {
        const targetInstanceId =
          target.zone === "shop"
            ? player.shop[target.index].instanceId
            : player.board[target.index].instanceId;
        const targetQuote = getHeroPowerActivationQuote(
          state,
          player.id,
          targetInstanceId,
        );
        if (!targetQuote?.usable) continue;
        candidates.push(
          candidate(
            { type: "ACTIVATE_HERO_POWER", targetInstanceId },
            { target, cost },
          ),
        );
      }
    }
  }

  const refreshQuote = getTavernRefreshQuote(state, player.id);
  if (refreshQuote?.affordable) {
    candidates.push(
      candidate(
        { type: "REFRESH_SHOP" },
        {
          cost: {
            currency: refreshQuote.currency,
            amount: refreshQuote.cost,
          },
        },
      ),
    );
  }
  candidates.push(candidate({ type: "TOGGLE_FREEZE" }));
  const upgradeCost = getUpgradeCost(state, player.id);
  if (
    player.tavernTier < getMaximumTavernTier(state) &&
    player.gold >= upgradeCost
  ) {
    candidates.push(
      candidate(
        { type: "UPGRADE_TAVERN" },
        { cost: { currency: "gold", amount: upgradeCost } },
      ),
    );
  }
  for (let fromIndex = 0; fromIndex < player.board.length; fromIndex += 1) {
    for (let toIndex = 0; toIndex < player.board.length; toIndex += 1) {
      if (fromIndex === toIndex) continue;
      candidates.push(
        candidate(
          { type: "MOVE_MINION", fromIndex, toIndex },
          {
            source: reference("board", fromIndex),
            target: reference("board", toIndex),
          },
        ),
      );
    }
  }
  candidates.push(candidate({ type: "END_TURN" }));
  return candidates;
}

function acceptedCandidates(
  state: GameState,
  scope: ActionMaskScope,
): CandidateAction[] {
  const player = controlledPlayer(state);
  if (
    !player.alive ||
    player.placement !== undefined ||
    state.phase === "gameOver"
  ) {
    return [];
  }
  if (state.pendingInteraction) {
    return pendingCandidates(state, state.pendingInteraction).filter(
      ({ action }) => gameTransition(state, action).accepted,
    );
  }
  if (state.phase === "combat") {
    return [candidate({ type: "CONTINUE" })];
  }
  if (state.phase !== "recruit") return [];
  const candidates = recruitCandidates(state);
  if (scope === "planner") {
    // recruitCandidates applies the same canonical cost, capacity, target,
    // timing, and magnetize queries as the reducer. Keeping this path pure
    // avoids cloning the complete eight-player state once per search action;
    // step() still commits every chosen token through the real reducer.
    return candidates.filter(
      ({ action }) => action.type !== "MOVE_MINION",
    );
  }
  return candidates.filter(
    ({ action }) =>
      action.type === "END_TURN" ||
      gameTransition(state, action).accepted,
  );
}

function publicLegalActions(
  candidates: readonly CandidateAction[],
  stateRevision: number,
  scope: ActionMaskScope,
): readonly Readonly<AiTrainingLegalAction>[] {
  return Object.freeze(
    candidates.map(({ descriptor }, index) =>
      Object.freeze({
        ...descriptor,
        source: descriptor.source
          ? Object.freeze({ ...descriptor.source })
          : null,
        target: descriptor.target
          ? Object.freeze({ ...descriptor.target })
          : null,
        cost: descriptor.cost
          ? Object.freeze({ ...descriptor.cost })
          : null,
        token:
          scope === "all"
            ? `${stateRevision}:${index}`
            : `${stateRevision}:planner:${index}`,
      }),
    ),
  );
}

function actionMaskScopeForToken(
  token: string,
  stateRevision: number,
): ActionMaskScope {
  return token.startsWith(`${stateRevision}:planner:`)
    ? "planner"
    : "all";
}

function seatForPlayerId(state: GameState, playerId: string): number {
  const seat = state.players.findIndex((player) => player.id === playerId);
  if (seat < 0) throw new Error(`Unknown player ${playerId}`);
  return seat;
}

function observeOwnBattle(
  state: GameState,
  battle: BattleSummary | null,
): Readonly<AiTrainingOwnBattleObservation> | null {
  if (!battle) return null;
  const player = controlledPlayer(state);
  const observerIsA = battle.playerAId === player.id;
  if (!observerIsA && battle.playerBId !== player.id) return null;
  const opponentId = observerIsA
    ? battle.playerBId
    : battle.playerAId;
  return Object.freeze({
    round: battle.round,
    opponentSeat: seatForPlayerId(state, opponentId),
    result:
      battle.winnerId === null
        ? "tie"
        : battle.winnerId === player.id
          ? "win"
          : "loss",
    isGhost: battle.isGhost,
    damageDealt: observerIsA
      ? battle.damageToPlayerB
      : battle.damageToPlayerA,
    damageTaken: observerIsA
      ? battle.damageToPlayerA
      : battle.damageToPlayerB,
    healthBefore: observerIsA
      ? battle.playerAHealthBefore
      : battle.playerBHealthBefore,
    healthAfter: observerIsA
      ? battle.playerAHealthAfter
      : battle.playerBHealthAfter,
    armorBefore: observerIsA
      ? battle.playerAArmorBefore
      : battle.playerBArmorBefore,
    armorAfter: observerIsA
      ? battle.playerAArmorAfter
      : battle.playerBArmorAfter,
  });
}

function rewardSignals(
  before: PlayerState,
  after: PlayerState,
  ownBattle: Readonly<AiTrainingOwnBattleObservation> | null,
): Readonly<AiTrainingRewardSignals> {
  const placement = after.placement ?? null;
  return Object.freeze({
    healthDelta: after.health - before.health,
    armorDelta: after.armor - before.armor,
    goldDelta: after.gold - before.gold,
    boardSizeDelta: after.board.length - before.board.length,
    handSizeDelta: after.hand.length - before.hand.length,
    tavernTierDelta: after.tavernTier - before.tavernTier,
    battleResult: ownBattle?.result ?? null,
    damageDealt: ownBattle?.damageDealt ?? 0,
    damageTaken: ownBattle?.damageTaken ?? 0,
    placement,
    terminalPlacementReward:
      placement === null || before.placement !== undefined
        ? null
        : (8 - placement) / 7,
  });
}

/**
 * One controlled seat plus seven existing AIs. Internal GameState and opaque
 * runtime IDs remain private; callers choose only a revision-scoped token.
 */
export class AiTrainingEnvironment {
  #state: GameState;
  #controlledSeat: number;
  #initialHealth: number;
  #configuration: AiTrainingEnvironmentConfiguration;
  #stateRevision: number;
  #actionMasks: Map<ActionMaskScope, CachedActionMask>;

  constructor(
    seed: number,
    controlledSeat = 0,
    initialHealth = DEFAULT_INITIAL_HEALTH,
    configuration: AiTrainingEnvironmentConfiguration = {},
    internalFork?: InternalForkSnapshot,
  ) {
    if (internalFork?.token === INTERNAL_FORK_TOKEN) {
      this.#state = internalFork.state;
      this.#controlledSeat = controlledSeat;
      this.#initialHealth = initialHealth;
      this.#configuration = { ...configuration };
      this.#stateRevision = internalFork.stateRevision;
      this.#actionMasks = new Map(internalFork.actionMasks);
      return;
    }
    this.#state = createGame(seed, initialHealth);
    configureControlledSeat(this.#state, controlledSeat, configuration);
    this.#controlledSeat = controlledSeat;
    this.#initialHealth = this.#state.initialHealth;
    this.#configuration = { ...configuration };
    this.#stateRevision = 0;
    this.#actionMasks = new Map();
  }

  reset(
    seed: number,
    controlledSeat = this.#controlledSeat,
    initialHealth = this.#initialHealth,
    configuration = this.#configuration,
  ): DeepReadonly<AiTrainingObservation> {
    const state = createGame(seed, initialHealth);
    configureControlledSeat(state, controlledSeat, configuration);
    this.#state = state;
    this.#controlledSeat = controlledSeat;
    this.#initialHealth = state.initialHealth;
    this.#configuration = { ...configuration };
    this.#stateRevision += 1;
    this.#actionMasks.clear();
    return this.observe();
  }

  observe(): DeepReadonly<AiTrainingObservation> {
    return createAiTrainingObservation(this.#state, this.#controlledSeat);
  }

  /** Independent deterministic branch for offline search or counterfactuals. */
  fork(): AiTrainingEnvironment {
    return new AiTrainingEnvironment(
      0,
      this.#controlledSeat,
      this.#initialHealth,
      this.#configuration,
      {
        token: INTERNAL_FORK_TOKEN,
        state: structuredClone(this.#state),
        stateRevision: this.#stateRevision,
        actionMasks: this.#actionMasks,
      },
    );
  }

  legalActions(): readonly Readonly<AiTrainingLegalAction>[] {
    return this.#actionMask("all").actions;
  }

  /** Correctness-preserving fast mask for visible Recruit search. */
  plannerLegalActions(): readonly Readonly<AiTrainingLegalAction>[] {
    return this.#actionMask("planner").actions;
  }

  /**
   * Counterfactual transition for the Recruit planner. Replan-boundary actions
   * are deliberately not executed here, so their private random outcome can
   * only be observed after the caller commits the token to the real episode.
   */
  plannerTransition(
    actionToken: string,
  ): AiTrainingPlannerTransition {
    const action = this.plannerLegalActions().find(
      (candidate) => candidate.token === actionToken,
    );
    if (!action) {
      throw new Error("Unknown planner action token");
    }
    if (action.plannerDisposition === "replan") {
      return Object.freeze({
        kind: "replanBoundary",
        action,
      });
    }
    if (action.plannerDisposition !== "deterministic") {
      throw new Error(
        `Planner cannot transition ${action.plannerDisposition} action`,
      );
    }
    const environment = this.fork();
    const transition = environment.step(action.token, {
      includeLegalActions: false,
    });
    if (!transition.accepted) {
      throw new Error("Advertised deterministic planner action was rejected");
    }
    if (transition.randomnessConsumed) {
      throw new Error(
        "Deterministic planner action consumed private engine RNG",
      );
    }
    return Object.freeze({
      kind: "deterministic",
      action,
      environment,
      observation: transition.observation,
      done: transition.done,
    });
  }

  step(
    actionToken: string,
    options: { includeLegalActions?: boolean } = {},
  ): AiTrainingStepResult {
    const scope = actionMaskScopeForToken(
      actionToken,
      this.#stateRevision,
    );
    const { candidates, actions } = this.#actionMask(scope);
    const actionIndex = actions.findIndex(
      (action) => action.token === actionToken,
    );
    const chosen = actionIndex >= 0 ? candidates[actionIndex] : undefined;
    const publicAction = actionIndex >= 0 ? actions[actionIndex] : null;
    const before = structuredClone(controlledPlayer(this.#state));
    const rngStateBefore = this.#state.rngState;
    let accepted = false;
    let actionType: GameAction["type"] | null = null;
    if (chosen) {
      actionType = chosen.action.type;
      const transition = gameTransition(this.#state, chosen.action);
      accepted = transition.accepted;
      if (accepted) {
        this.#state = transition.state;
        this.#stateRevision += 1;
        this.#actionMasks.clear();
      }
    }
    const after = controlledPlayer(this.#state);
    const ownBattle =
      accepted && actionType === "END_TURN"
        ? observeOwnBattle(this.#state, this.#state.lastBattle)
        : null;
    const done =
      after.placement !== undefined || this.#state.phase === "gameOver";
    return {
      environmentVersion: AI_TRAINING_ENVIRONMENT_VERSION,
      observation: this.observe(),
      legalActions:
        options.includeLegalActions === false
          ? Object.freeze([])
          : this.legalActions(),
      action: publicAction,
      accepted,
      randomnessConsumed:
        accepted && this.#state.rngState !== rngStateBefore,
      done,
      ownBattle,
      rewardSignals: rewardSignals(before, after, ownBattle),
    };
  }

  #actionMask(scope: ActionMaskScope): CachedActionMask {
    const cached = this.#actionMasks.get(scope);
    if (cached?.revision === this.#stateRevision) return cached;
    const candidates = Object.freeze(
      acceptedCandidates(this.#state, scope),
    );
    const actions = publicLegalActions(
      candidates,
      this.#stateRevision,
      scope,
    );
    const mask = Object.freeze({
      revision: this.#stateRevision,
      candidates,
      actions,
    });
    this.#actionMasks.set(scope, mask);
    return mask;
  }
}
