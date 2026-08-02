import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getRefreshCost,
  getTrinketDefinition,
  getUpgradeCost,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  getTrinketAliasKind,
  type TrinketDefinition,
} from "../lib/game/lobby-systems.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function trinketForCard(cardId: string): TrinketDefinition {
  const definition = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === cardId,
  );
  assert.ok(definition, `${cardId} must be in the active Trinket pool`);
  return definition;
}

function resolveTrinket(
  state: GameState,
  definition: TrinketDefinition,
  replaceTrinketId?: string,
): GameState {
  const player = humanPlayer(state);
  player.gold = 100;
  state.pendingInteraction = {
    kind: "trinketChoice",
    interactionId: `choose-${definition.cardId}`,
    playerId: player.id,
    sourceInstanceId: `source-${definition.cardId}`,
    trinketTier: definition.tier,
    optionIds: [definition.id],
    ...(replaceTrinketId ? { replaceTrinketId } : {}),
  };
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: state.pendingInteraction.interactionId,
    optionInstanceId: definition.id,
  });
}

function continueThroughCombat(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function assertGreaterOffer(state: GameState) {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "trinketChoice");
  assert.equal(pending.trinketTier, "greater");
  assert.equal(pending.optionIds.length, 4);
  assert.ok(
    pending.optionIds.every(
      (id) => getTrinketDefinition(id).tier === "greater",
    ),
  );
  return pending;
}

test("Ancient Wishbone makes triggered Hero Powers resolve twice", () => {
  let state = createGame(0xf001, 999);
  state = resolveTrinket(state, trinketForCard("BG30_MagicItem_804"));
  let player = humanPlayer(state);
  player.heroPowerId = "hero-power-ever-blooming";
  player.heroPowerCounters = {};
  player.tavernTier = 1;
  player.gold = 100;
  const upgradeCost = getUpgradeCost(state, player.id);

  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  player = humanPlayer(state);
  assert.equal(player.gold, 100 - upgradeCost + 4);

  player.heroPowerId = "hero-power-see-the-future";
  player.heroPowerCounters = {};
  state = continueThroughCombat(state);
  player = humanPlayer(state);
  const goldBeforeRefreshes = player.gold;

  assert.equal(getRefreshCost(state, player.id), 0);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).gold, goldBeforeRefreshes);
  assert.equal(getRefreshCost(state, player.id), 0);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).gold, goldBeforeRefreshes);
  assert.equal(getRefreshCost(state, player.id), 1);
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(state).gold, goldBeforeRefreshes - 1);
});

test("Souvenir Stand transforms into an independently keyed copy of a bought Greater Trinket", () => {
  let state = createGame(0xf002, 999);
  const souvenir = trinketForCard("BG30_MagicItem_888");
  const tipJar = trinketForCard("BG30_MagicItem_996");
  state = resolveTrinket(state, souvenir);
  const maxGoldBefore = humanPlayer(state).maxGold;
  state = resolveTrinket(state, tipJar);

  const player = humanPlayer(state);
  assert.equal(player.trinketIds.length, 2);
  const rawTipJarId = player.trinketIds.find(
    (id) => getTrinketAliasKind(id) === null,
  );
  const souvenirCopyId = player.trinketIds.find(
    (id) => getTrinketAliasKind(id) === "souvenirCopy",
  );
  assert.equal(rawTipJarId, tipJar.id);
  assert.ok(souvenirCopyId);
  assert.equal(getTrinketDefinition(souvenirCopyId).cardId, tipJar.cardId);
  assert.equal(player.maxGold, maxGoldBefore + 4);
  assert.deepEqual(
    Object.keys(player.trinketCounters).sort(),
    [...player.trinketIds].sort(),
  );

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored, "the transformed copy must survive save validation");
  assert.deepEqual(humanPlayer(restored).trinketIds, player.trinketIds);
});

test("Trip Vouchers offers four Greater Trinkets after two turns and replaces itself", () => {
  let state = createGame(0xf003, 999);
  const vouchers = trinketForCard("BG30_MagicItem_891");
  const tipJar = trinketForCard("BG30_MagicItem_996");
  state.round = 6;
  state = resolveTrinket(state, vouchers);
  state.lobbySystemsEnabled = true;
  state.systemEventId = "system-event-money-match";

  state = continueThroughCombat(state);
  assert.equal(state.round, 7);
  assert.equal(state.pendingInteraction, null);
  assert.equal(
    humanPlayer(state).trinketCounters[vouchers.id],
    1,
  );

  state = continueThroughCombat(state);
  assert.equal(state.round, 8);
  const offer = assertGreaterOffer(state);
  assert.equal(offer.replaceTrinketId, vouchers.id);
  const restoredOffer = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restoredOffer);
  assert.equal(
    restoredOffer.pendingInteraction?.kind === "trinketChoice"
      ? restoredOffer.pendingInteraction.replaceTrinketId
      : null,
    vouchers.id,
  );
  offer.optionIds = [tipJar.id];
  const maxGoldBefore = humanPlayer(state).maxGold;
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: offer.interactionId,
    optionInstanceId: tipJar.id,
  });

  let player = humanPlayer(state);
  assert.equal(player.trinketIds.includes(vouchers.id), false);
  const replacementId = player.trinketIds.find(
    (id) => getTrinketAliasKind(id) === "tripVoucherReplacement",
  );
  assert.ok(replacementId);
  assert.equal(getTrinketDefinition(replacementId).cardId, tipJar.cardId);
  assert.equal(player.maxGold, maxGoldBefore + 4);

  state = continueThroughCombat(state);
  assert.equal(state.round, 9);
  const regularGreaterOffer = assertGreaterOffer(state);
  assert.equal(regularGreaterOffer.replaceTrinketId, undefined);
  player = humanPlayer(state);
  assert.equal(
    player.trinketIds.some(
      (id) =>
        getTrinketAliasKind(id) === null &&
        getTrinketDefinition(id).tier === "greater",
    ),
    false,
  );
});

test("Ornate Clock grants two Coins, offers the Greater Trinket next turn, and skips turn 9", () => {
  let state = createGame(0xf004, 999);
  const clock = trinketForCard("BG32_MagicItem_271");
  const tipJar = trinketForCard("BG30_MagicItem_996");
  state.round = 6;
  const goldBeforeClock = humanPlayer(state).gold = 100;
  state = resolveTrinket(state, clock);
  assert.equal(humanPlayer(state).gold, goldBeforeClock + 2);
  state.lobbySystemsEnabled = true;
  state.systemEventId = "system-event-money-match";

  state = continueThroughCombat(state);
  assert.equal(state.round, 7);
  const earlyOffer = assertGreaterOffer(state);
  assert.equal(earlyOffer.replaceTrinketId, undefined);
  const restoredOffer = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restoredOffer);
  assert.equal(restoredOffer.pendingInteraction?.kind, "trinketChoice");
  earlyOffer.optionIds = [tipJar.id];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: earlyOffer.interactionId,
    optionInstanceId: tipJar.id,
  });
  assert.ok(humanPlayer(state).trinketIds.includes(tipJar.id));

  state = continueThroughCombat(state);
  assert.equal(state.round, 8);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  assert.equal(state.round, 9);
  assert.equal(state.pendingInteraction, null);
});

test("Mysterious Orb grants eight Gold and replaces the turn-nine Greater offer with four Lesser choices", () => {
  let state = createGame(0xf005, 999);
  const orb = trinketForCard("BG35_MagicItem_818");
  state.round = 6;
  const goldBeforeOrb = (humanPlayer(state).gold = 100);
  state = resolveTrinket(state, orb);
  assert.equal(humanPlayer(state).gold, goldBeforeOrb + 8);
  assert.equal(humanPlayer(state).trinketCounters[orb.id], 1);
  state.lobbySystemsEnabled = true;
  state.systemEventId = "system-event-money-match";

  state = continueThroughCombat(state);
  assert.equal(state.round, 7);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  assert.equal(state.round, 8);
  assert.equal(state.pendingInteraction, null);
  state = continueThroughCombat(state);
  assert.equal(state.round, 9);

  const offer = state.pendingInteraction;
  assert.ok(offer?.kind === "trinketChoice");
  assert.equal(offer.trinketTier, "lesser");
  assert.equal(offer.additionalTrinketSourceId, orb.id);
  assert.equal(offer.optionIds.length, 4);
  assert.ok(
    offer.optionIds.every(
      (id) =>
        id !== orb.id && getTrinketDefinition(id).tier === "lesser",
    ),
  );
  const restoredOffer = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restoredOffer);
  assert.equal(
    restoredOffer.pendingInteraction?.kind === "trinketChoice"
      ? restoredOffer.pendingInteraction.additionalTrinketSourceId
      : null,
    orb.id,
  );

  const selectedId = offer.optionIds[0];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: offer.interactionId,
    optionInstanceId: selectedId,
  });
  const player = humanPlayer(state);
  assert.equal(player.trinketIds.includes(selectedId), true);
  assert.equal(player.trinketCounters[orb.id], 2);
  assert.equal(
    player.trinketIds.filter(
      (id) => getTrinketDefinition(id).tier === "lesser",
    ).length,
    2,
  );
  assert.equal(
    state.pendingInteraction?.kind === "trinketChoice"
      ? state.pendingInteraction.trinketTier
      : null,
    null,
  );
  assert.ok(
    normalizePersistedGameState(
      JSON.parse(JSON.stringify(state)) as unknown,
    ),
  );
});
