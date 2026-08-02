import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";

const TIER_SIX_REWARD_IDS = [
  "BG26_175",
  "BG32_846",
  "BG35_342",
  "BG35_890",
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
    stealth: definition.stealth === true,
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
    cardId: definition.goldenCardId,
    name: `金色·${definition.name}`,
    description: definition.goldenDescription,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
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

function setOnlyTierSixRewardsInPool(state: GameState): void {
  state.activeTribes = ["elemental", "mech"];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of TIER_SIX_REWARD_IDS) {
    assert.equal(getMinionDefinition(definitionId).tier, 6);
    state.pool[definitionId] = 1;
  }
}

function rewardPoolCopies(state: GameState): number {
  return TIER_SIX_REWARD_IDS.reduce(
    (total, definitionId) => total + (state.pool[definitionId] ?? 0),
    0,
  );
}

function tierSixRewards(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.tier === 6,
  );
}

function isolateCombat(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): void {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.ghostHand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.lastOpponentId = undefined;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = undefined;
    }
  }
  const human = humanPlayer(state);
  const enemy = state.players[1];
  human.alive = true;
  human.health = 1_000;
  human.board = humanBoard;
  enemy.alive = true;
  enemy.health = 1_000;
  enemy.board = enemyBoard;
  enemy.hand = [];
}

function enemyAttacker(instanceId: string): BoardMinionInstance {
  return definitionMinion("BG29_611", instanceId, {
    attack: 100,
    health: 1,
    taunt: false,
    reborn: false,
  });
}

test("Highkeeper Ra exposes exact ordinary and Golden Tier 6 effects", () => {
  const ra = getMinionDefinition("BG34_319");
  const effect = {
    kind: "getRandomMinion",
    count: 1,
    filter: { exactTier: 6 },
    maximumTier: 6,
    source: "sharedPool",
    goldenMode: "doubleCount",
  } as const;

  assert.equal(ra.effectSupport, "complete");
  assert.deepEqual(
    [ra.tier, ra.attack, ra.health, ra.tribe],
    [7, 6, 6, "neutral"],
  );
  assert.equal(ra.goldenCardId, "BG34_319_G");
  assert.equal(
    ra.goldenDescription,
    "战吼，亡语，进击：随机获取两张等级6的随从牌。",
  );
  assert.deepEqual(ra.battlecry, [effect]);
  assert.deepEqual(ra.deathrattle, [effect]);
  assert.deepEqual(ra.rally, [effect]);
});

test("Highkeeper Ra Battlecry ignores a low owner Tavern and scales for Golden and Brann", () => {
  const scenarios = [
    { golden: false, brann: false, expected: 1 },
    { golden: true, brann: false, expected: 2 },
    { golden: false, brann: true, expected: 2 },
    { golden: true, brann: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x7200 + index);
    setOnlyTierSixRewardsInPool(state);
    const player = humanPlayer(state);
    player.tavernTier = 1;
    player.board = scenario.brann
      ? [definitionMinion("BG_LOE_077", `ra-brann-${index}`)]
      : [];
    const source = scenario.golden
      ? goldenMinion("BG34_319", `ra-battlecry-${index}`)
      : definitionMinion("BG34_319", `ra-battlecry-${index}`);
    player.hand = [source];
    const poolBefore = rewardPoolCopies(state);

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    const nextPlayer = humanPlayer(state);
    const rewards = tierSixRewards(nextPlayer);
    assert.equal(rewards.length, scenario.expected);
    assert.ok(rewards.every((reward) => reward.tier === 6));
    assert.equal(
      rewardPoolCopies(state),
      poolBefore - scenario.expected,
    );
  }
});

test("numeric Tier 6 does not change existing ownerTavern effects", () => {
  let state = createGame(0x7210);
  setOnlyTierSixRewardsInPool(state);
  const player = humanPlayer(state);
  player.tavernTier = 1;
  const source = definitionMinion("BGS_123", "owner-tavern-source");
  player.hand = [source];
  const poolBefore = rewardPoolCopies(state);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  assert.equal(tierSixRewards(humanPlayer(state)).length, 0);
  assert.equal(rewardPoolCopies(state), poolBefore);
});

test("Golden Brann overflow returns every excess Highkeeper Ra Battlecry draw", () => {
  let state = createGame(0x7220);
  setOnlyTierSixRewardsInPool(state);
  const player = humanPlayer(state);
  player.tavernTier = 1;
  player.board = [definitionMinion("BG_LOE_077", "overflow-brann")];
  const source = goldenMinion("BG34_319", "overflow-ra");
  player.hand = [
    source,
    ...Array.from({ length: 9 }, (_, index) =>
      bloodGem(`overflow-gem-${index}`),
    ),
  ];
  const poolBefore = rewardPoolCopies(state);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(tierSixRewards(nextPlayer).length, 1);
  assert.equal(rewardPoolCopies(state), poolBefore - 1);
});

test("Highkeeper Ra Deathrattle scales for Golden and Titus without Rally", () => {
  const scenarios = [
    { golden: false, titus: false, expected: 1 },
    { golden: true, titus: false, expected: 2 },
    { golden: false, titus: true, expected: 2 },
    { golden: true, titus: true, expected: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x7230 + index);
    setOnlyTierSixRewardsInPool(state);
    const source = scenario.golden
      ? goldenMinion("BG34_319", `ra-death-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        })
      : definitionMinion("BG34_319", `ra-death-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        });
    const humanBoard = [source];
    if (scenario.titus) {
      humanBoard.push(
        definitionMinion("BG25_354", `ra-titus-${index}`, {
          attack: 1_000,
          health: 1_000,
        }),
      );
    }
    isolateCombat(
      state,
      humanBoard,
      Array.from(
        { length: humanBoard.length + 1 },
        (_, enemyIndex) =>
          enemyAttacker(`ra-death-enemy-${index}-${enemyIndex}`),
      ),
    );
    const poolBefore = rewardPoolCopies(state);

    state = gameReducer(state, { type: "END_TURN" });
    const rewards = tierSixRewards(humanPlayer(state));
    assert.equal(rewards.length, scenario.expected);
    assert.ok(rewards.every((reward) => reward.tier === 6));
    assert.equal(
      rewardPoolCopies(state),
      poolBefore - scenario.expected,
    );
  }
});

test("Highkeeper Ra Rally gains strict Tier 6 rewards and full combat hands preserve the pool", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0x7240 + index);
    setOnlyTierSixRewardsInPool(state);
    const source = golden
      ? goldenMinion("BG34_319", `ra-rally-${index}`, {
          attack: 1,
          health: 100,
        })
      : definitionMinion("BG34_319", `ra-rally-${index}`, {
          attack: 1,
          health: 100,
        });
    isolateCombat(
      state,
      [source, definitionMinion("BG35_801", `ra-inert-${index}`)],
      [
        definitionMinion("BG29_611", `ra-rally-target-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
          reborn: false,
        }),
      ],
    );
    const poolBefore = rewardPoolCopies(state);

    state = gameReducer(state, { type: "END_TURN" });
    const expected = golden ? 2 : 1;
    const rewards = tierSixRewards(humanPlayer(state));
    assert.equal(rewards.length, expected);
    assert.ok(rewards.every((reward) => reward.tier === 6));
    assert.equal(rewardPoolCopies(state), poolBefore - expected);
  }

  let fullHandState = createGame(0x7242);
  setOnlyTierSixRewardsInPool(fullHandState);
  const fullHandSource = goldenMinion("BG34_319", "ra-full-rally", {
    attack: 1,
    health: 100,
  });
  isolateCombat(
    fullHandState,
    [fullHandSource, definitionMinion("BG35_801", "ra-full-inert")],
    [
      definitionMinion("BG29_611", "ra-full-target", {
        attack: 0,
        health: 1,
        taunt: true,
        reborn: false,
      }),
    ],
  );
  humanPlayer(fullHandState).hand = Array.from(
    { length: 10 },
    (_, index) => bloodGem(`ra-full-gem-${index}`),
  );
  const poolBefore = rewardPoolCopies(fullHandState);

  fullHandState = gameReducer(fullHandState, { type: "END_TURN" });
  assert.equal(humanPlayer(fullHandState).hand.length, 10);
  assert.equal(rewardPoolCopies(fullHandState), poolBefore);
  const handFullEvents =
    fullHandState.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === fullHandSource.instanceId &&
        event.cardGainResult === "handFull",
    ) ?? [];
  assert.equal(handFullEvents.length, 2);
});
