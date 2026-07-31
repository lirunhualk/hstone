import {
  getMinionSellValue,
  getRefreshCost,
  getTavernSpellPurchaseQuote,
  getUpgradeCost,
} from "./engine.ts";
import type {
  BoardMinionInstance,
  GameAction,
  GameActionTrace,
  GameState,
  PlayerState,
  TavernSpellInstance,
} from "./types.ts";

export type RecruitPresentationCurrency = "gold" | "health";

export type RecruitPresentationReason =
  | "buy"
  | "sell"
  | "refresh"
  | "upgrade";

export type RecruitPresentationCard =
  | BoardMinionInstance
  | TavernSpellInstance;

export type RecruitPresentationEvent =
  | {
      kind: "currency";
      currency: RecruitPresentationCurrency;
      delta: number;
      reason: RecruitPresentationReason;
    }
  | {
      kind: "cardMove";
      motion: "shop-to-hand" | "board-to-bob";
      card: RecruitPresentationCard;
      purchaseCost?: number;
      purchaseCurrency?: RecruitPresentationCurrency;
    }
  | {
      kind: "shopRefresh";
      outgoingInstanceIds: string[];
      incomingInstanceIds: string[];
      free: boolean;
    }
  | {
      kind: "tavernUpgrade";
      fromTier: number;
      toTier: number;
    }
  | {
      kind: "triple";
      golden: BoardMinionInstance;
      /**
       * IDs recoverable from before/after state. An effect-created third copy
       * can be forged and consumed inside one reducer call, so presentation
       * must not claim this list is always exhaustive.
       */
      knownConsumedInstanceIds: string[];
    }
  | {
      kind: "bloodGemPulse";
      targetInstanceId: string;
      targetName: string;
      attack: number;
      health: number;
      origin: "hand" | "roogug";
      bonusKeyword?: string;
      pulseIndex: number;
      pulseCount: number;
      boardBeforePulse: BoardMinionInstance[];
      boardAfterPulse: BoardMinionInstance[];
    };

export function enqueueRecruitPresentation<T>(
  queue: readonly T[],
  next: T,
): T[] {
  return [...queue, next];
}

export function completeRecruitPresentation<
  T extends { token: number },
>(
  queue: T[],
  activeToken: number,
): T[] {
  return queue[0]?.token === activeToken ? queue.slice(1) : queue;
}

function playerFor(
  state: GameState,
  playerId: string,
): PlayerState | null {
  return state.players.find((player) => player.id === playerId) ?? null;
}

function ownedMinions(player: PlayerState): BoardMinionInstance[] {
  return [
    ...player.board,
    ...player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
  ];
}

function shopOfferIds(player: PlayerState): string[] {
  return [
    ...player.shop.map((minion) => minion.instanceId),
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((spell) => spell.instanceId),
  ];
}

function tavernSpellOffer(
  player: PlayerState,
  instanceId?: string,
): TavernSpellInstance | null {
  const offers = [
    ...(player.spellShop ? [player.spellShop] : []),
    ...player.additionalSpellShop,
  ];
  return instanceId
    ? (offers.find((spell) => spell.instanceId === instanceId) ?? null)
    : (player.spellShop ?? null);
}

function orderedUnique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function tripleEvents(
  beforePlayer: PlayerState,
  afterPlayer: PlayerState,
  purchasedMinion: BoardMinionInstance | null,
): RecruitPresentationEvent[] {
  const beforeOwned = ownedMinions(beforePlayer);
  const afterOwned = ownedMinions(afterPlayer);
  const beforeIds = new Set(
    beforeOwned.map((minion) => minion.instanceId),
  );
  const afterIds = new Set(afterOwned.map((minion) => minion.instanceId));
  const newlyForged = afterOwned.filter(
    (minion) =>
      minion.golden === true &&
      minion.grantsTripleReward === true &&
      !beforeIds.has(minion.instanceId),
  );

  return newlyForged.map((golden) => {
    const missingOwnedIds = beforeOwned
      .filter(
        (minion) =>
          minion.golden === false &&
          minion.definitionId === golden.definitionId &&
          !afterIds.has(minion.instanceId),
      )
      .map((minion) => minion.instanceId);
    const purchasedId =
      purchasedMinion?.golden === false &&
      purchasedMinion.definitionId === golden.definitionId &&
      !afterIds.has(purchasedMinion.instanceId)
        ? purchasedMinion.instanceId
        : null;

    return {
      kind: "triple" as const,
      golden,
      knownConsumedInstanceIds: orderedUnique([
        ...missingOwnedIds,
        ...(purchasedId ? [purchasedId] : []),
      ]).slice(0, 3),
    };
  });
}

function bloodGemPulseEvents(
  beforePlayer: PlayerState,
  trace: GameActionTrace | undefined,
): RecruitPresentationEvent[] {
  const pulses = trace?.recruitBloodGemPulses ?? [];
  if (pulses.length === 0) {
    return [];
  }
  let stagedBoard = [...beforePlayer.board];
  return pulses.map((pulse, pulseIndex) => {
    const boardBeforePulse = [...stagedBoard];
    const targetIndex = stagedBoard.findIndex(
      (minion) => minion.instanceId === pulse.targetInstanceId,
    );
    if (targetIndex >= 0) {
      stagedBoard = [...stagedBoard];
      stagedBoard[targetIndex] = pulse.targetAfter;
    }
    return {
      kind: "bloodGemPulse",
      targetInstanceId: pulse.targetInstanceId,
      targetName: pulse.targetAfter.name,
      attack: pulse.attackDelta,
      health: pulse.healthDelta,
      origin: pulse.origin,
      ...(pulse.gainedKeywords.includes("reborn")
        ? { bonusKeyword: "rebornForQuilboar" }
        : pulse.gainedKeywords.includes("divineShield")
          ? { bonusKeyword: "divineShieldForQuilboar" }
          : {}),
      pulseIndex,
      pulseCount: pulses.length,
      boardBeforePulse,
      boardAfterPulse: [...stagedBoard],
    };
  });
}

/**
 * Derives short-lived recruit presentation from an immutable reducer
 * transition. The events intentionally stay outside GameState and saves.
 */
export function deriveRecruitPresentation(
  before: GameState,
  after: GameState,
  action: GameAction,
  trace?: GameActionTrace,
): RecruitPresentationEvent[] {
  const playerId = before.humanPlayerId;
  const beforePlayer = playerFor(before, playerId);
  const afterPlayer = playerFor(after, playerId);
  if (!beforePlayer || !afterPlayer) {
    return [];
  }

  const events: RecruitPresentationEvent[] = [];
  let purchasedMinion: BoardMinionInstance | null = null;

  if (action.type === "CAST_BLOOD_GEM") {
    events.push(
      ...bloodGemPulseEvents(beforePlayer, trace),
    );
  } else if (action.type === "BUY_MINION") {
    const offered = beforePlayer.shop[action.shopIndex];
    const stillOffered =
      offered !== undefined &&
      afterPlayer.shop.some(
        (minion) => minion.instanceId === offered.instanceId,
      );
    if (offered && !stillOffered) {
      purchasedMinion = offered;
      events.push(
        {
          kind: "currency",
          currency: "gold",
          delta: -3,
          reason: "buy",
        },
        {
          kind: "cardMove",
          motion: "shop-to-hand",
          card: offered,
          purchaseCost: 3,
          purchaseCurrency: "gold",
        },
      );
    }
  } else if (action.type === "BUY_TAVERN_SPELL") {
    const offered = tavernSpellOffer(
      beforePlayer,
      action.spellInstanceId,
    );
    const stillOffered =
      offered !== null &&
      shopOfferIds(afterPlayer).includes(offered.instanceId);
    if (offered && !stillOffered) {
      const quote = getTavernSpellPurchaseQuote(
        before,
        playerId,
        offered.instanceId,
      );
      if (quote) {
        if (quote.cost > 0) {
          events.push({
            kind: "currency",
            currency: quote.currency,
            delta: -quote.cost,
            reason: "buy",
          });
        }
        events.push({
          kind: "cardMove",
          motion: "shop-to-hand",
          card: offered,
          purchaseCost: quote.cost,
          purchaseCurrency: quote.currency,
        });
      }
    }
  } else if (action.type === "SELL_MINION") {
    const sold = beforePlayer.board[action.boardIndex];
    const stillOwned =
      sold !== undefined &&
      ownedMinions(afterPlayer).some(
        (minion) => minion.instanceId === sold.instanceId,
      );
    if (sold && !stillOwned) {
      events.push(
        {
          kind: "cardMove",
          motion: "board-to-bob",
          card: sold,
        },
        {
          kind: "currency",
          currency: "gold",
          delta: getMinionSellValue(before, beforePlayer.id, sold),
          reason: "sell",
        },
      );
    }
  } else if (action.type === "REFRESH_SHOP") {
    const outgoingInstanceIds = shopOfferIds(beforePlayer);
    const incomingInstanceIds = shopOfferIds(afterPlayer);
    const offersChanged =
      outgoingInstanceIds.length !== incomingInstanceIds.length ||
      outgoingInstanceIds.some(
        (instanceId, index) => incomingInstanceIds[index] !== instanceId,
      );
    const cost = getRefreshCost(before, playerId);
    const paid =
      afterPlayer.goldSpentThisTurn > beforePlayer.goldSpentThisTurn;
    const consumedFreeRefresh =
      afterPlayer.freeRefreshes < beforePlayer.freeRefreshes;
    if (offersChanged || paid || consumedFreeRefresh) {
      if (cost > 0) {
        events.push({
          kind: "currency",
          currency: "gold",
          delta: -cost,
          reason: "refresh",
        });
      }
      events.push({
        kind: "shopRefresh",
        outgoingInstanceIds,
        incomingInstanceIds,
        free: cost === 0,
      });
    }
  } else if (
    action.type === "UPGRADE_TAVERN" &&
    afterPlayer.tavernTier > beforePlayer.tavernTier
  ) {
    const cost = getUpgradeCost(before, playerId);
    if (cost > 0) {
      events.push({
        kind: "currency",
        currency: "gold",
        delta: -cost,
        reason: "upgrade",
      });
    }
    events.push({
      kind: "tavernUpgrade",
      fromTier: beforePlayer.tavernTier,
      toTier: afterPlayer.tavernTier,
    });
    const rewardGold = afterPlayer.gold - (beforePlayer.gold - cost);
    if (rewardGold > 0) {
      events.push({
        kind: "currency",
        currency: "gold",
        delta: rewardGold,
        reason: "upgrade",
      });
    }
  }

  events.push(
    ...tripleEvents(beforePlayer, afterPlayer, purchasedMinion),
  );
  return events;
}

export function recruitPresentationAnnouncement(
  events: readonly RecruitPresentationEvent[],
): string {
  const move = events.find((event) => event.kind === "cardMove");
  const refresh = events.find((event) => event.kind === "shopRefresh");
  const upgrade = events.find((event) => event.kind === "tavernUpgrade");
  const currencies = events.filter((event) => event.kind === "currency");
  const triples = events.filter((event) => event.kind === "triple");
  const bloodGemPulse = events.find(
    (event) => event.kind === "bloodGemPulse",
  );
  const parts: string[] = [];

  if (bloodGemPulse?.kind === "bloodGemPulse") {
    parts.push(
      `${
        bloodGemPulse.origin === "roogug"
          ? "鲁古格转投"
          : "鲜血宝石"
      }：${bloodGemPulse.targetName} +${bloodGemPulse.attack}/+${
        bloodGemPulse.health
      }${
        bloodGemPulse.pulseCount > 1
          ? `（第${bloodGemPulse.pulseIndex + 1}/${
              bloodGemPulse.pulseCount
            }颗）`
          : ""
      }`,
    );
  } else if (move?.kind === "cardMove") {
    parts.push(
      move.motion === "shop-to-hand"
        ? `购买${move.card.name}`
        : `出售${move.card.name}`,
    );
  } else if (refresh?.kind === "shopRefresh") {
    parts.push(refresh.free ? "免费刷新酒馆" : "刷新酒馆");
  } else if (upgrade?.kind === "tavernUpgrade") {
    parts.push(`酒馆升至${upgrade.toTier}星`);
  }

  for (const currency of currencies) {
    const resource =
      currency.currency === "gold" ? "枚金币" : "点生命";
    parts.push(
      `${currency.delta > 0 ? "获得" : "消耗"}${Math.abs(
        currency.delta,
      )}${resource}`,
    );
  }
  for (const triple of triples) {
    parts.push(`凑成三连，获得${triple.golden.name}`);
  }
  return parts.join("，");
}

export function recruitPresentationDuration(
  events: readonly RecruitPresentationEvent[],
): number {
  if (events.some((event) => event.kind === "bloodGemPulse")) {
    return 720;
  }
  if (events.some((event) => event.kind === "triple")) {
    return 1500;
  }
  return events.filter((event) => event.kind === "currency").length > 1
    ? 1260
    : 980;
}
