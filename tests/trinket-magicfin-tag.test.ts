import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_TRINKET_DEFINITIONS,
  createGame,
  gameReducer,
  getTavernSpellDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const MAGICFIN_TAG_CARD_ID = "BG35_MagicItem_750";
const MAGICFIN_APPRENTICE_DEFINITION_ID = "BG33_890t";

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function equipMagicfinTag(state: GameState): string {
  const trinket = ACTIVE_TRINKET_DEFINITIONS.find(
    (candidate) => candidate.cardId === MAGICFIN_TAG_CARD_ID,
  );
  assert.ok(trinket);
  const player = humanPlayer(state);
  player.trinketIds = [trinket.id];
  player.trinketCounters = { [trinket.id]: 0 };
  return trinket.id;
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
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

function buyOfferedSpell(
  state: GameState,
  definitionId: string,
  serial: number,
): GameState {
  const player = humanPlayer(state);
  player.gold = 100;
  player.spellShop = tavernSpell(definitionId, `spell-offer-${serial}`);
  player.additionalSpellShop = [];
  return gameReducer(state, { type: "BUY_TAVERN_SPELL" });
}

function apprentices(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === MAGICFIN_APPRENTICE_DEFINITION_ID,
  );
}

test("Magicfin Tag teaches the first two bought Tavern Spells each round", () => {
  let state = createGame(0x7501);
  const player = humanPlayer(state);
  player.hand = [];
  player.board = [];
  state.pendingInteraction = null;
  state.round = 7;
  const trinketId = equipMagicfinTag(state);

  state = buyOfferedSpell(state, "tavern-spell-tavern-coin", 1);
  state = buyOfferedSpell(state, "tavern-spell-strike-oil", 2);
  state = buyOfferedSpell(state, "tavern-spell-careful-investment", 3);

  assert.deepEqual(
    apprentices(humanPlayer(state)).map(
      (card) => card.taughtTavernSpellDefinitionId,
    ),
    ["tavern-spell-tavern-coin", "tavern-spell-strike-oil"],
  );

  state.round += 1;
  state = buyOfferedSpell(state, "tavern-spell-careful-investment", 4);
  assert.equal(apprentices(humanPlayer(state)).length, 3);
  assert.equal(
    apprentices(humanPlayer(state)).at(-1)?.taughtTavernSpellDefinitionId,
    "tavern-spell-careful-investment",
  );
  assert.ok(humanPlayer(state).trinketCounters[trinketId] > 0);
});

test("a taught Magicfin Apprentice survives save normalization and casts its Battlecry", () => {
  let state = createGame(0x7502);
  const player = humanPlayer(state);
  player.hand = [];
  player.board = [];
  player.gold = 100;
  state.pendingInteraction = null;
  equipMagicfinTag(state);

  state = buyOfferedSpell(state, "tavern-spell-tavern-coin", 1);
  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)) as unknown,
  ) as GameState | null;
  assert.ok(restored);
  const restoredPlayer = humanPlayer(restored);
  const apprentice = apprentices(restoredPlayer)[0];
  assert.ok(apprentice);
  assert.equal(
    apprentice.taughtTavernSpellDefinitionId,
    "tavern-spell-tavern-coin",
  );

  restoredPlayer.hand = [apprentice];
  restoredPlayer.gold = 5;
  const played = gameReducer(restored, {
    type: "PLAY_MINION",
    handIndex: 0,
  });
  assert.equal(humanPlayer(played).gold, 6);
  assert.equal(played.pendingInteraction, null);
});
