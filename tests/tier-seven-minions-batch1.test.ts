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

function enemyWall(instanceId: string): BoardMinionInstance {
  return definitionMinion("BG29_611", instanceId, {
    attack: 100,
    health: 1_000,
    taunt: true,
    reborn: false,
  });
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

test("Tier 7 Sanguine Champion and Champion of Sargeras expose exact complete rules", () => {
  const sanguine = getMinionDefinition("BG23_017");
  assert.equal(sanguine.effectSupport, "complete");
  assert.deepEqual(
    [sanguine.tier, sanguine.attack, sanguine.health, sanguine.tribe],
    [7, 18, 3, "quilboar"],
  );
  assert.equal(sanguine.goldenCardId, "BG23_017_G");
  assert.equal(
    sanguine.goldenDescription,
    "战吼，亡语：在本局对战中，你的鲜血宝石使随从额外获得+2/+2。",
  );
  assert.deepEqual(sanguine.battlecry, [
    { kind: "improveBloodGems", attack: 1, health: 1 },
  ]);
  assert.deepEqual(sanguine.deathrattle, sanguine.battlecry);

  const sargeras = getMinionDefinition("BG27_016");
  assert.equal(sargeras.effectSupport, "complete");
  assert.deepEqual(
    [sargeras.tier, sargeras.attack, sargeras.health, sargeras.tribe],
    [7, 10, 10, "demon"],
  );
  assert.equal(sargeras.goldenCardId, "BG27_016_G");
  assert.equal(
    sargeras.goldenDescription,
    "战吼，亡语：在本局对战中，酒馆中的随从拥有+10/+10。",
  );
  assert.deepEqual(sargeras.battlecry, [
    {
      kind: "buffTavern",
      attack: 5,
      health: 5,
      goldenMode: "repeat",
    },
  ]);
  assert.deepEqual(sargeras.deathrattle, sargeras.battlecry);
});

test("Sanguine Champion Battlecry scales ordinary and Golden future Blood Gems", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0x7100 + index);
    const player = humanPlayer(state);
    const target = definitionMinion(
      "BG35_801",
      `sanguine-target-${index}`,
    );
    const source = golden
      ? goldenMinion("BG23_017", `sanguine-source-${index}`)
      : definitionMinion("BG23_017", `sanguine-source-${index}`);
    const targetBefore = [target.attack, target.health];
    player.board = [target];
    player.hand = [source, bloodGem(`sanguine-gem-${index}`)];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    let nextPlayer = humanPlayer(state);
    const expectedGemStat = golden ? 3 : 2;
    assert.deepEqual(
      [nextPlayer.bloodGemAttack, nextPlayer.bloodGemHealth],
      [expectedGemStat, expectedGemStat],
    );

    state = gameReducer(state, {
      type: "CAST_BLOOD_GEM",
      cardInstanceId: `sanguine-gem-${index}`,
      targetInstanceId: target.instanceId,
    });
    nextPlayer = humanPlayer(state);
    const buffedTarget = nextPlayer.board.find(
      (candidate) => candidate.instanceId === target.instanceId,
    );
    assert.ok(buffedTarget);
    assert.deepEqual(
      [
        buffedTarget.attack,
        buffedTarget.health,
        buffedTarget.bloodGemAttack,
        buffedTarget.bloodGemHealth,
      ],
      [
        targetBefore[0] + expectedGemStat,
        targetBefore[1] + expectedGemStat,
        expectedGemStat,
        expectedGemStat,
      ],
    );
  }
});

test("Champion of Sargeras Battlecry buffs current and refreshed Tavern pages", () => {
  for (const [index, golden] of [false, true].entries()) {
    let state = createGame(0x7110 + index);
    let player = humanPlayer(state);
    player.gold = 10;
    const shopDefinition = getMinionDefinition("BG35_801");
    player.shop = [
      definitionMinion("BG35_801", `sargeras-shop-${index}`),
    ];
    player.spellShop = null;
    player.additionalSpellShop = [];
    const source = golden
      ? goldenMinion("BG27_016", `sargeras-source-${index}`)
      : definitionMinion("BG27_016", `sargeras-source-${index}`);
    player.hand = [source];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    player = humanPlayer(state);
    const expectedBonus = golden ? 10 : 5;
    assert.deepEqual(
      [
        player.tavernMinionAttackBonus,
        player.tavernMinionHealthBonus,
        player.shop[0].attack,
        player.shop[0].health,
      ],
      [
        expectedBonus,
        expectedBonus,
        shopDefinition.attack + expectedBonus,
        shopDefinition.health + expectedBonus,
      ],
    );

    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    for (const definitionId of Object.keys(state.pool)) {
      state.pool[definitionId] = 0;
    }
    state.pool.BG35_801 = 20;
    state = gameReducer(state, { type: "REFRESH_SHOP" });
    player = humanPlayer(state);
    assert.ok(player.shop.length > 0);
    assert.ok(
      player.shop.every(
        (minion) =>
          minion.definitionId === "BG35_801" &&
          minion.attack === shopDefinition.attack + expectedBonus &&
          minion.health === shopDefinition.health + expectedBonus,
      ),
    );
  }
});

test("Sanguine Champion Deathrattle scales for Golden and Titus", () => {
  const scenarios = [
    { golden: false, titus: false, expectedGain: 1 },
    { golden: true, titus: false, expectedGain: 2 },
    { golden: false, titus: true, expectedGain: 2 },
    { golden: true, titus: true, expectedGain: 4 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x7120 + index);
    const player = humanPlayer(state);
    player.bloodGemAttack = 1;
    player.bloodGemHealth = 1;
    const source = scenario.golden
      ? goldenMinion("BG23_017", `sanguine-death-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        })
      : definitionMinion("BG23_017", `sanguine-death-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        });
    const humanBoard = [source];
    if (scenario.titus) {
      humanBoard.push(
        definitionMinion("BG25_354", `sanguine-titus-${index}`, {
          attack: 1_000,
          health: 1_000,
        }),
      );
    }
    isolateCombat(state, humanBoard, [enemyWall(`sanguine-wall-${index}`)]);

    state = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(state);
    assert.deepEqual(
      [nextPlayer.bloodGemAttack, nextPlayer.bloodGemHealth],
      [1 + scenario.expectedGain, 1 + scenario.expectedGain],
    );
  }
});

test("Champion of Sargeras Deathrattle scales for Golden and Titus", () => {
  const scenarios = [
    { golden: false, titus: false, expectedGain: 5 },
    { golden: true, titus: false, expectedGain: 10 },
    { golden: false, titus: true, expectedGain: 10 },
    { golden: true, titus: true, expectedGain: 20 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x7130 + index);
    const shopTarget = definitionMinion(
      "BG35_801",
      `sargeras-death-shop-${index}`,
    );
    const shopBefore = [shopTarget.attack, shopTarget.health];
    const source = scenario.golden
      ? goldenMinion("BG27_016", `sargeras-death-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        })
      : definitionMinion("BG27_016", `sargeras-death-${index}`, {
          attack: 0,
          health: 1,
          taunt: true,
        });
    const humanBoard = [source];
    if (scenario.titus) {
      humanBoard.push(
        definitionMinion("BG25_354", `sargeras-titus-${index}`, {
          attack: 1_000,
          health: 1_000,
        }),
      );
    }
    isolateCombat(state, humanBoard, [enemyWall(`sargeras-wall-${index}`)]);
    humanPlayer(state).shop = [shopTarget];

    state = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(state);
    assert.deepEqual(
      [
        nextPlayer.tavernMinionAttackBonus,
        nextPlayer.tavernMinionHealthBonus,
        nextPlayer.shop[0].attack,
        nextPlayer.shop[0].health,
      ],
      [
        scenario.expectedGain,
        scenario.expectedGain,
        shopBefore[0] + scenario.expectedGain,
        shopBefore[1] + scenario.expectedGain,
      ],
    );
  }
});
