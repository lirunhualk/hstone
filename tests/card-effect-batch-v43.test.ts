import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  gameReducer,
  getSpellcraftDefinition,
  getTavernSpellDefinition,
  scoreMinionForAi,
  type BattleSummary,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const COMPLETED_CARD_IDS = [
  "BG23_318",
  "BG25_039",
  "BG33_825",
  "BG34_321",
] as const;

const BOUNTY_IDS = [
  "tavern-spell-friendly-bounty",
  "tavern-spell-healthy-bounty",
  "tavern-spell-hostile-bounty",
  "tavern-spell-selfish-bounty",
  "tavern-spell-wealthy-bounty",
] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player);
  return player;
}

function definitionMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: definition.sellValue ?? 1,
    attack: definition.attack,
    health: definition.health,
    golden: false,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    reborn: definition.reborn === true,
    poisonous: definition.poisonous === true,
    venomous: definition.venomous === true,
    windfury: definition.windfury === true,
    cleave: definition.cleave === true,
    alwaysAttacksLowestAttack:
      definition.alwaysAttacksLowestAttack === true,
    description: definition.description,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryVenomous: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    crabDeathrattles: 0,
    goldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
  };
}

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  assert.ok(definition.goldenCardId);
  assert.ok(definition.goldenDescription);
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    cardId: definition.goldenCardId,
    description: definition.goldenDescription,
    attack: definition.attack * 2,
    health: definition.health * 2,
    ...overrides,
  });
}

function tavernSpell(
  definitionId: string,
  instanceId: string,
): TavernSpellInstance {
  const definition = getTavernSpellDefinition(definitionId);
  return {
    kind: "tavernSpell",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
}

function spellcraft(
  definitionId: string,
  instanceId: string,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: definition.spellFamily ?? "spellcraft",
    target: definition.target,
    effectMultiplier: 1,
  };
}

function bloodGem(instanceId: string): BloodGemSpellInstance {
  return {
    kind: "bloodGem",
    instanceId,
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  };
}

function boardMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const minion = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion);
  return minion;
}

function keepOnlyOneOpponent(state: GameState): PlayerState {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.isHuman || player.id === opponent.id) {
      player.alive = true;
      player.health = 1_000;
    } else {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = 0;
    }
  }
  return opponent;
}

function advanceTurn(state: GameState): GameState {
  const opponent = keepOnlyOneOpponent(state);
  opponent.board = [];
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

function runCombat(
  seed: number,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): { state: GameState; battle: BattleSummary } {
  const state = createGame(seed);
  const human = humanPlayer(state);
  const enemy = keepOnlyOneOpponent(state);
  human.board = humanBoard;
  human.hand = [];
  enemy.board = enemyBoard;
  enemy.hand = [];
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  assert.ok(combat.lastBattle);
  return { state: combat, battle: combat.lastBattle };
}

test("v43 exposes complete ordinary and Golden rules for the four-card batch", () => {
  assert.equal(CURRENT_ROSTER_VERSION, "battlegrounds-36.0.3-247416-v50");
  for (const definitionId of COMPLETED_CARD_IDS) {
    const definition = getMinionDefinition(definitionId);
    assert.equal(definition.effectSupport, "complete", definitionId);
    assert.equal(definition.goldenCardId, `${definitionId}_G`);
    assert.ok(definition.goldenDescription);
  }
  assert.deepEqual(getMinionDefinition("BG23_318").deathrattle, [
    { kind: "destroyKiller" },
  ]);
  assert.deepEqual(
    getMinionDefinition("BG25_039").afterTargetedSpellCast,
    { kind: "gainVenomous", goldenMode: "permanent" },
  );
  assert.equal(getMinionDefinition("BG33_825").bountyExtraCasts, 1);
  assert.deepEqual(getMinionDefinition("BG34_321").afterCardPlayed, {
    filter: { tribe: "beast" },
    effects: [
      {
        kind: "buffThenDamageFriendly",
        tribes: ["beast"],
        attack: 3,
        health: 3,
        damage: 1,
        goldenMode: "repeat",
      },
    ],
  });
});

test("Crazed Panther resolves complete buff-then-damage pulses and breaks Divine Shield", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf430 + Number(golden));
    const player = humanPlayer(state);
    const panther = golden
      ? goldenMinion("BG34_321", `panther-${golden}`)
      : definitionMinion("BG34_321", `panther-${golden}`);
    const shieldedBeast = definitionMinion(
      "BG31_803",
      `shielded-beast-${golden}`,
      { attack: 1, health: 20, divineShield: true },
    );
    const nonBeast = definitionMinion(
      "BG23_318",
      `non-beast-${golden}`,
      { attack: 2, health: 20 },
    );
    const played = definitionMinion(
      "BG31_803",
      `played-beast-${golden}`,
    );
    const playedBefore = { attack: played.attack, health: played.health };
    player.board = [panther, shieldedBeast, nonBeast];
    player.hand = [played];

    state = gameReducer(state, {
      type: "PLAY_MINION",
      handIndex: 0,
      boardIndex: 3,
    });

    const pulses = golden ? 2 : 1;
    const currentPanther = boardMinion(state, panther.instanceId);
    const currentShielded = boardMinion(state, shieldedBeast.instanceId);
    const currentNonBeast = boardMinion(state, nonBeast.instanceId);
    const currentPlayed = boardMinion(state, played.instanceId);
    assert.deepEqual(
      [currentPanther.attack, currentPanther.health],
      [panther.attack + 3 * pulses, panther.health + 2 * pulses],
    );
    assert.deepEqual(
      [currentShielded.attack, currentShielded.health],
      [1 + 3 * pulses, 20 + 3 * pulses - Math.max(0, pulses - 1)],
    );
    assert.equal(currentShielded.divineShield, false);
    assert.deepEqual(
      [currentPlayed.attack, currentPlayed.health],
      [playedBefore.attack + 3 * pulses, playedBefore.health + 2 * pulses],
    );
    assert.deepEqual(
      [currentNonBeast.attack, currentNonBeast.health],
      [2, 20],
    );
  }
});

test("Pufferquil observes Tavern Spells, Spellcraft, and Blood Gems", () => {
  const casts = [
    {
      card: () => tavernSpell("tavern-spell-fortify", "puffer-tavern"),
      action: (targetInstanceId: string) => ({
        type: "CAST_TAVERN_SPELL" as const,
        cardInstanceId: "puffer-tavern",
        targetInstanceId,
      }),
    },
    {
      card: () => spellcraft("spellcraft-deep-blue-blues", "puffer-craft"),
      action: (targetInstanceId: string) => ({
        type: "CAST_SPELLCRAFT" as const,
        cardInstanceId: "puffer-craft",
        targetInstanceId,
      }),
    },
    {
      card: () => bloodGem("puffer-gem"),
      action: (targetInstanceId: string) => ({
        type: "CAST_BLOOD_GEM" as const,
        cardInstanceId: "puffer-gem",
        targetInstanceId,
      }),
    },
  ];

  for (const [index, cast] of casts.entries()) {
    let state = createGame(0xf440 + index);
    const player = humanPlayer(state);
    const puffer = definitionMinion("BG25_039", `puffer-${index}`);
    player.board = [puffer];
    player.hand = [cast.card()];
    state = gameReducer(state, cast.action(puffer.instanceId));
    const current = boardMinion(state, puffer.instanceId);
    assert.equal(current.venomous, true);
    assert.equal(current.temporaryVenomous, true);
  }
});

test("ordinary Pufferquil loses temporary Venomous next turn while Golden keeps it", () => {
  for (const golden of [false, true]) {
    let state = createGame(0xf450 + Number(golden));
    const player = humanPlayer(state);
    const puffer = golden
      ? goldenMinion("BG25_039", `duration-puffer-${golden}`)
      : definitionMinion("BG25_039", `duration-puffer-${golden}`);
    player.board = [puffer];
    player.hand = [bloodGem(`duration-gem-${golden}`)];
    state = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: `duration-gem-${golden}`,
      targetInstanceId: puffer.instanceId,
    });
    assert.equal(boardMinion(state, puffer.instanceId).venomous, true);
    assert.equal(
      boardMinion(state, puffer.instanceId).temporaryVenomous,
      !golden,
    );

    state = advanceTurn(state);
    const nextTurnPuffer = boardMinion(state, puffer.instanceId);
    assert.equal(nextTurnPuffer.venomous, golden);
    assert.equal(nextTurnPuffer.temporaryVenomous, false);
  }
});

test("Proud Privateer uses only the strongest Aura and every Bounty copy is a real cast", () => {
  for (const [golden, expectedCasts] of [
    [false, 2],
    [true, 3],
  ] as const) {
    for (const [index, bountyId] of BOUNTY_IDS.entries()) {
      let state = createGame(0xf460 + index + Number(golden) * 10);
      const player = humanPlayer(state);
      const privateer = golden
        ? goldenMinion("BG33_825", `privateer-${golden}-${index}`)
        : definitionMinion("BG33_825", `privateer-${golden}-${index}`);
      const secondOrdinary = definitionMinion(
        "BG33_825",
        `second-privateer-${golden}-${index}`,
      );
      const target = definitionMinion(
        "BG23_318",
        `bounty-target-${golden}-${index}`,
        { health: 100 },
      );
      player.board = [privateer, secondOrdinary, target];
      player.hand = [tavernSpell(bountyId, `bounty-${golden}-${index}`)];

      state = gameReducer(state, {
        type: "CAST_TAVERN_SPELL",
        cardInstanceId: `bounty-${golden}-${index}`,
      });
      const current = humanPlayer(state);
      assert.equal(current.tavernSpellsCastThisTurn, expectedCasts);
      assert.equal(current.tavernSpellsCast, expectedCasts);
      assert.equal(current.cardsPlayedThisTurn, 1);
      if (bountyId === "tavern-spell-healthy-bounty") {
        assert.equal(
          boardMinion(state, target.instanceId).health,
          100 + expectedCasts * 4,
        );
      }
    }
  }
});

test("Leeroy destroys its surviving killer but does not target an already-dead killer", () => {
  for (const golden of [false, true]) {
    const leeroy = golden
      ? goldenMinion("BG23_318", `leeroy-${golden}`)
      : definitionMinion("BG23_318", `leeroy-${golden}`);
    const killer = definitionMinion(
      "BG35_801",
      `killer-${golden}`,
      { attack: 100, health: 1_000, divineShield: true },
    );
    const { battle } = runCombat(
      0xf470 + Number(golden),
      [leeroy],
      [killer],
    );
    assert.ok(
      battle.events.some(
        (event) =>
          event.type === "trigger" &&
          event.actorInstanceId === leeroy.instanceId &&
          event.targetInstanceId === killer.instanceId,
      ),
    );
    assert.ok(
      battle.events.some(
        (event) =>
          event.type === "death" &&
          event.actorInstanceId === killer.instanceId,
      ),
    );
  }

  const leeroy = definitionMinion("BG23_318", "simultaneous-leeroy");
  const dyingKiller = definitionMinion(
    "BG35_801",
    "simultaneous-killer",
    { attack: 100, health: 1 },
  );
  const { battle } = runCombat(0xf472, [leeroy], [dyingKiller]);
  assert.equal(
    battle.events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === leeroy.instanceId &&
        event.targetInstanceId === dyingKiller.instanceId,
    ),
    false,
  );
});

test("combat Blood Gems visibly grant Pufferquil Venomous", () => {
  const gemCaster = definitionMinion("BG26_867", "combat-gem-caster", {
    attack: 0,
    health: 1,
    taunt: true,
  });
  const puffer = definitionMinion("BG25_039", "combat-puffer", {
    attack: 0,
    health: 100,
  });
  const attacker = definitionMinion("BG35_801", "combat-gem-attacker", {
    attack: 10,
    health: 100,
  });
  const { battle } = runCombat(
    0xf480,
    [gemCaster, puffer],
    [attacker],
  );
  assert.ok(
    battle.events.some(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === puffer.instanceId &&
        event.minion?.venomous === true &&
        event.message.includes("烈毒"),
    ),
  );
});

test("v42 saves migrate the targeted-spell keyword layer safely", () => {
  const state = createGame(0xf490);
  const puffer = definitionMinion("BG25_039", "migrated-puffer");
  humanPlayer(state).board = [puffer];
  const legacy = structuredClone(state) as GameState;
  legacy.contentVersion = "battlegrounds-36.0.3-247416-v42";
  delete legacy.players.find((player) => player.isHuman)?.board[0]
    .temporaryVenomous;

  const normalized = normalizePersistedGameState(legacy) as GameState | null;
  assert.ok(normalized);
  assert.equal(normalized.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(
    humanPlayer(normalized).board[0].temporaryVenomous,
    false,
  );
});

test("AI valuation recognizes targeted-spell and Bounty payoff", () => {
  const state = createGame(0xf4a0);
  const player = humanPlayer(state);
  const puffer = definitionMinion("BG25_039", "ai-puffer");
  const privateer = definitionMinion("BG33_825", "ai-privateer");
  player.board = [];
  player.hand = [];
  const pufferWithoutSpell = scoreMinionForAi(player, puffer);
  const privateerWithoutBounty = scoreMinionForAi(player, privateer);
  player.hand = [
    bloodGem("ai-gem"),
    tavernSpell("tavern-spell-healthy-bounty", "ai-bounty"),
  ];
  assert.ok(scoreMinionForAi(player, puffer) > pufferWithoutSpell);
  assert.ok(
    scoreMinionForAi(player, privateer) > privateerWithoutBounty,
  );
});
