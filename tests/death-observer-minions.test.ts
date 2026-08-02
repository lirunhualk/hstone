import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V32,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const CHROMAWING_DEFINITION_IDS = [
  "BG34_634t",
  "BG34_635t",
  "BG34_636t",
  "BG34_637t",
  "BG34_638t",
] as const;

const FILLER_DEFINITION_IDS = [
  "BG25_001",
  "BG25_008",
  "BG25_009",
  "BG25_010",
  "BG25_011",
  "BG25_013",
  "BG25_016",
  "BG25_022",
  "BG25_041",
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
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
    bloodGemAttack: overrides.bloodGemAttack ?? 0,
    bloodGemHealth: overrides.bloodGemHealth ?? 0,
    temporaryAttack: overrides.temporaryAttack ?? 0,
    temporaryHealth: overrides.temporaryHealth ?? 0,
    temporaryTaunt: overrides.temporaryTaunt ?? false,
    temporaryDivineShield:
      overrides.temporaryDivineShield ?? false,
    temporaryCrabDeathrattles:
      overrides.temporaryCrabDeathrattles ?? 0,
    temporaryGoldenCrabDeathrattles:
      overrides.temporaryGoldenCrabDeathrattles ?? 0,
  };
}

function goldenMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return definitionMinion(definitionId, instanceId, {
    cardId: definition.goldenCardId ?? definition.cardId,
    name: `金色·${definition.name}`,
    description:
      definition.goldenDescription ?? definition.description,
    attack: definition.attack * 2,
    health: definition.health * 2,
    golden: true,
    ...overrides,
  });
}

function enemyWall(
  instanceId: string,
  attack = 100,
): BoardMinionInstance {
  return definitionMinion("BG29_611", instanceId, {
    attack,
    health: 1_000_000,
    taunt: true,
    reborn: false,
  });
}

function isolateCombat(
  state: GameState,
  humanBoard: BoardMinionInstance[],
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
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
      player.hand = [];
      player.eliminatedRound = undefined;
    }
  }
  const human = humanPlayer(state);
  const enemy = state.players[1];
  human.alive = true;
  human.health = 100;
  human.board = humanBoard;
  enemy.alive = true;
  enemy.health = 100;
  enemy.board = enemyBoard;
  enemy.hand = [];
  return enemy;
}

function bloodGemCount(player: PlayerState): number {
  return player.hand.filter((card) => card.kind === "bloodGem").length;
}

function chromawingsInHand(
  player: PlayerState,
): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      CHROMAWING_DEFINITION_IDS.includes(
        card.definitionId as (typeof CHROMAWING_DEFINITION_IDS)[number],
      ),
  );
}

function fillHand(player: PlayerState, prefix: string): void {
  player.hand = FILLER_DEFINITION_IDS.map((definitionId, index) =>
    definitionMinion(
      definitionId,
      `${prefix}-filler-${index}`,
    ),
  );
}

test("the six death-chain minions map exact fixed-build normal and Golden rules", () => {
  const scrapsmith = getMinionDefinition("BG24_707");
  assert.equal(scrapsmith.effectSupport, "complete");
  assert.equal(
    scrapsmith.description,
    "在一个友方嘲讽随从死亡后，获取一张鲜血宝石。",
  );
  assert.equal(scrapsmith.goldenCardId, "BG24_707_G");
  assert.equal(
    scrapsmith.goldenDescription,
    "在一个友方嘲讽随从死亡后，获取2张鲜血宝石。",
  );
  assert.deepEqual(scrapsmith.afterFriendlyDied, {
    taunt: true,
    effects: [{ kind: "gainBloodGems", count: 1 }],
  });

  const mummifier = getMinionDefinition("BG28_309");
  assert.equal(mummifier.effectSupport, "complete");
  assert.equal(mummifier.goldenCardId, "BG28_309_G");
  assert.deepEqual(mummifier.deathrattle, [
    {
      kind: "grantKeyword",
      keyword: "reborn",
      target: "otherFriendlyTribe",
      tribe: "undead",
      count: 1,
      goldenMode: "doubleCount",
    },
  ]);

  const conjurer = getMinionDefinition("BG29_862");
  assert.equal(conjurer.effectSupport, "complete");
  assert.equal(conjurer.goldenCardId, "BG29_862_G");
  assert.deepEqual(conjurer.deathrattle, [
    {
      kind: "getRandomMinion",
      count: 1,
      filter: { battlecry: true },
      maximumTier: "ownerTavern",
      source: "sharedPool",
      goldenMode: "doubleCount",
    },
  ]);

  const barnstormer = getMinionDefinition("BG26_162");
  assert.equal(barnstormer.effectSupport, "complete");
  assert.equal(barnstormer.goldenCardId, "BG26_162_G");
  assert.deepEqual(barnstormer.battlecry, barnstormer.deathrattle);
  assert.deepEqual(barnstormer.battlecry, [
    {
      kind: "buffTavernType",
      tribe: "elemental",
      attack: 8,
      health: 8,
      goldenMode: "repeat",
    },
  ]);

  const caretaker = getMinionDefinition("BG34_633");
  assert.equal(caretaker.effectSupport, "complete");
  assert.equal(caretaker.goldenCardId, "BG34_633_G");
  assert.deepEqual(caretaker.battlecry, caretaker.deathrattle);
  assert.deepEqual(caretaker.battlecry?.[0], {
    kind: "gainRandomGeneratedMinion",
    definitionIds: CHROMAWING_DEFINITION_IDS,
    count: 1,
    goldenMode: "doubleCount",
  });

  const vinewhisperer = getMinionDefinition("BG35_437");
  assert.equal(vinewhisperer.effectSupport, "complete");
  assert.equal(vinewhisperer.goldenCardId, "BG35_437_G");
  assert.deepEqual(vinewhisperer.afterFriendlyDied, {
    deathrattle: true,
    effects: [
      {
        kind: "improveBloodGems",
        attack: 2,
        health: 0,
      },
    ],
  });
});

test("Scrapsmith and Vinewhisperer observe Recruit deaths by Taunt and printed Deathrattle", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 0xd3301 : 0xd3300);
    let player = humanPlayer(state);
    const scrapsmith = golden
      ? goldenMinion("BG24_707", `recruit-scrap-${golden}`)
      : definitionMinion("BG24_707", `recruit-scrap-${golden}`);
    const vinewhisperer = golden
      ? goldenMinion("BG35_437", `recruit-vine-${golden}`)
      : definitionMinion("BG35_437", `recruit-vine-${golden}`);
    const victim = definitionMinion(
      "BG25_806",
      `recruit-printed-deathrattle-${golden}`,
      {
        taunt: true,
        destroyAfterPlayThroughRound: state.round,
      },
    );
    assert.equal(
      getMinionDefinition(victim.definitionId).effectSupport,
      "complete",
    );
    player.board = [scrapsmith, vinewhisperer];
    player.hand = [victim];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: victim.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(bloodGemCount(player), golden ? 2 : 1);
    assert.equal(player.bloodGemAttack, golden ? 5 : 3);
    assert.equal(player.bloodGemHealth, 1);
  }
});

test("Vinewhisperer recognizes temporary Deathrattles but Scrapsmith ignores a non-Taunt death", () => {
  let state = createGame(0xd3302);
  let player = humanPlayer(state);
  const scrapsmith = definitionMinion(
    "BG24_707",
    "temporary-deathrattle-scrap",
  );
  const vinewhisperer = definitionMinion(
    "BG35_437",
    "temporary-deathrattle-vine",
  );
  const victim = definitionMinion(
    "BG35_801",
    "temporary-deathrattle-victim",
    {
      taunt: false,
      temporaryCrabDeathrattles: 1,
      destroyAfterPlayThroughRound: state.round,
    },
  );
  player.board = [scrapsmith, vinewhisperer];
  player.hand = [victim];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: victim.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(bloodGemCount(player), 0);
  assert.equal(player.bloodGemAttack, 3);
  assert.ok(
    player.board.some(
      (minion) => minion.definitionId === "live-crab-token",
    ),
  );
});

test("Vinewhisperer recognizes a Deathrattle carried by a Magnetic attachment", () => {
  let state = createGame(0xd3303);
  let player = humanPlayer(state);
  const vinewhisperer = definitionMinion(
    "BG35_437",
    "attachment-deathrattle-vine",
  );
  const attachmentDefinition = getMinionDefinition("BG26_360");
  const victim = definitionMinion(
    "BG35_801",
    "attachment-deathrattle-victim",
    {
      destroyAfterPlayThroughRound: state.round,
      attachments: [
        {
          sourceInstanceId: "deathrattle-attachment",
          definitionId: attachmentDefinition.id,
          cardId: attachmentDefinition.cardId,
          name: attachmentDefinition.name,
          description: attachmentDefinition.description,
          effectSupport:
            attachmentDefinition.effectSupport ?? "complete",
          golden: false,
          poolCopies: 0,
          attackGranted: 0,
          healthGranted: 0,
          attachments: [],
        },
      ],
    },
  );
  player.board = [vinewhisperer];
  player.hand = [victim];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: victim.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.bloodGemAttack, 3);
});

test("a death observer killed in the same cleave wave cannot trigger", () => {
  const state = createGame(0xd3304);
  const player = humanPlayer(state);
  const victim = definitionMinion(
    "BG26_360",
    "same-wave-deathrattle-victim",
    { attack: 0, health: 1, taunt: false },
  );
  const vinewhisperer = definitionMinion(
    "BG35_437",
    "same-wave-vine",
    { attack: 0, health: 1, taunt: true },
  );
  const cleaver = enemyWall("same-wave-cleaver");
  cleaver.cleave = true;
  isolateCombat(
    state,
    [victim, vinewhisperer],
    [
      cleaver,
      enemyWall("same-wave-enemy-2", 0),
      enemyWall("same-wave-enemy-3", 0),
    ],
  );
  player.hand = [];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(humanPlayer(combat).bloodGemAttack, 1);
  assert.equal(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === vinewhisperer.instanceId,
    ),
    false,
  );
});

test("Golden Mummifier grants Reborn to two distinct Undead in Recruit", () => {
  let state = createGame(0xd3310);
  let player = humanPlayer(state);
  const left = definitionMinion("BG25_008", "mummifier-left", {
    reborn: false,
  });
  const right = definitionMinion("BG25_008", "mummifier-right", {
    reborn: false,
  });
  const nonUndead = definitionMinion(
    "BG35_801",
    "mummifier-non-undead",
    { reborn: false },
  );
  const source = goldenMinion("BG28_309", "golden-mummifier", {
    destroyAfterPlayThroughRound: state.round,
  });
  player.board = [left, nonUndead, right];
  player.hand = [source];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: source.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === left.instanceId,
    )?.reborn,
    true,
  );
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === right.instanceId,
    )?.reborn,
    true,
  );
  assert.equal(
    player.board.find(
      (minion) => minion.instanceId === nonUndead.instanceId,
    )?.reborn,
    false,
  );
});

test("Golden Mummifier emits two distinct combat Reborn enchantments", () => {
  const state = createGame(0xd3311);
  const source = goldenMinion(
    "BG28_309",
    "combat-golden-mummifier",
    { attack: 0, health: 1, taunt: true },
  );
  const left = definitionMinion(
    "BG25_008",
    "combat-mummifier-left",
    { attack: 0, health: 1_000_000, reborn: false },
  );
  const right = definitionMinion(
    "BG25_008",
    "combat-mummifier-right",
    { attack: 0, health: 1_000_000, reborn: false },
  );
  isolateCombat(
    state,
    [source, left, right],
    [enemyWall("combat-mummifier-wall")],
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const events =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === source.instanceId &&
        event.minion?.reborn === true,
    ) ?? [];
  assert.equal(events.length, 2);
  assert.equal(
    new Set(events.map((event) => event.targetInstanceId)).size,
    2,
  );
});

test("Golden Scrapsmith fills one remaining combat hand slot and reports the overflow Gem", () => {
  const state = createGame(0xd3312);
  const player = humanPlayer(state);
  const victim = definitionMinion(
    "BG35_801",
    "combat-scrapsmith-victim",
    { attack: 0, health: 1, taunt: true },
  );
  const scrapsmith = goldenMinion(
    "BG24_707",
    "combat-golden-scrapsmith",
    { attack: 0, health: 1_000_000 },
  );
  fillHand(player, "scrapsmith");
  isolateCombat(
    state,
    [victim, scrapsmith],
    [enemyWall("combat-scrapsmith-wall")],
  );
  fillHand(player, "scrapsmith");

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(combat);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(bloodGemCount(nextPlayer), 1);
  const gainEvents =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === scrapsmith.instanceId &&
        event.cardKind === "bloodGem",
    ) ?? [];
  assert.deepEqual(
    gainEvents.map((event) => event.cardGainResult),
    ["added", "handFull"],
  );
});

test("Golden Barnstormer keeps complete +8/+8 pulses for Brann and Titus", () => {
  {
    let state = createGame(0xd3320);
    let player = humanPlayer(state);
    const brann = definitionMinion(
      "BG_LOE_077",
      "barnstormer-brann",
    );
    const elemental = definitionMinion(
      "BG31_815",
      "barnstormer-shop-elemental",
    );
    const nonElemental = definitionMinion(
      "BG35_801",
      "barnstormer-shop-non-elemental",
    );
    const source = goldenMinion(
      "BG26_162",
      "battlecry-barnstormer",
    );
    const elementalBefore = [elemental.attack, elemental.health];
    const nonElementalBefore = [
      nonElemental.attack,
      nonElemental.health,
    ];
    player.board = [brann];
    player.shop = [elemental, nonElemental];
    player.hand = [source];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
    });
    player = humanPlayer(state);
    assert.deepEqual(player.tavernTypeBuffs, [
      { tribes: ["elemental"], attack: 32, health: 32 },
    ]);
    assert.deepEqual(
      [player.shop[0].attack, player.shop[0].health],
      [elementalBefore[0] + 32, elementalBefore[1] + 32],
    );
    assert.deepEqual(
      [player.shop[1].attack, player.shop[1].health],
      nonElementalBefore,
    );
  }

  {
    const state = createGame(0xd3321);
    const player = humanPlayer(state);
    const source = goldenMinion(
      "BG26_162",
      "deathrattle-barnstormer",
      { attack: 0, health: 1, taunt: true },
    );
    const titus = definitionMinion(
      "BG25_354",
      "barnstormer-titus",
      { attack: 0, health: 1_000_000 },
    );
    const shopElemental = definitionMinion(
      "BG31_815",
      "deathrattle-shop-elemental",
    );
    const shopBefore = [
      shopElemental.attack,
      shopElemental.health,
    ];
    player.shop = [shopElemental];
    isolateCombat(
      state,
      [source, titus],
      [enemyWall("barnstormer-wall")],
    );
    player.shop = [shopElemental];

    const combat = gameReducer(state, { type: "END_TURN" });
    const nextPlayer = humanPlayer(combat);
    assert.deepEqual(nextPlayer.tavernTypeBuffs, [
      { tribes: ["elemental"], attack: 32, health: 32 },
    ]);
    assert.deepEqual(
      [nextPlayer.shop[0].attack, nextPlayer.shop[0].health],
      [shopBefore[0] + 32, shopBefore[1] + 32],
    );
    const pulseEvents =
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "trigger" &&
          event.actorInstanceId === source.instanceId &&
          event.permanentEffectImprovement === true,
      ) ?? [];
    assert.equal(pulseEvents.length, 4);
    assert.ok(
      pulseEvents.every(
        (event) =>
          event.attackDelta === 8 && event.healthDelta === 8,
      ),
    );
  }
});

test("Dragon Caretaker uses generated Chromawings for both Brann Battlecry and Titus Deathrattle", () => {
  {
    let state = createGame(0xd3330);
    let player = humanPlayer(state);
    const brann = definitionMinion(
      "BG_LOE_077",
      "caretaker-brann",
    );
    const caretaker = definitionMinion(
      "BG34_633",
      "battlecry-caretaker",
    );
    const poolBefore = Object.fromEntries(
      CHROMAWING_DEFINITION_IDS.map((definitionId) => [
        definitionId,
        state.pool[definitionId],
      ]),
    );
    player.board = [brann];
    player.hand = [caretaker];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: caretaker.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(chromawingsInHand(player).length, 2);
    assert.ok(
      chromawingsInHand(player).every(
        (minion) => minion.poolCopies === 0,
      ),
    );
    assert.deepEqual(
      Object.fromEntries(
        CHROMAWING_DEFINITION_IDS.map((definitionId) => [
          definitionId,
          state.pool[definitionId],
        ]),
      ),
      poolBefore,
    );
  }

  {
    const state = createGame(0xd3331);
    const caretaker = definitionMinion(
      "BG34_633",
      "deathrattle-caretaker",
      { attack: 0, health: 1, taunt: true },
    );
    const titus = definitionMinion(
      "BG25_354",
      "caretaker-titus",
      { attack: 0, health: 1_000_000 },
    );
    isolateCombat(
      state,
      [caretaker, titus],
      [enemyWall("caretaker-wall")],
    );

    const combat = gameReducer(state, { type: "END_TURN" });
    const gained = chromawingsInHand(humanPlayer(combat));
    assert.equal(gained.length, 2);
    assert.ok(gained.every((minion) => minion.poolCopies === 0));
    assert.equal(
      combat.lastBattle?.events.filter(
        (event) =>
          event.type === "cardGain" &&
          event.actorInstanceId === caretaker.instanceId &&
          event.cardGainResult === "added",
      ).length,
      2,
    );
  }
});

test("Golden Barrens Conjurer draws only Battlecry minions from the shared pool and preserves it when full", () => {
  const state = createGame(0xd3340);
  const player = humanPlayer(state);
  const conjurer = goldenMinion(
    "BG29_862",
    "golden-barrens-conjurer",
    { attack: 0, health: 1, taunt: true },
  );
  player.tavernTier = 6;
  fillHand(player, "conjurer");
  isolateCombat(
    state,
    [conjurer],
    [enemyWall("conjurer-wall")],
  );
  fillHand(player, "conjurer");
  for (const definition of MINION_DEFINITIONS) {
    state.pool[definition.id] = 0;
  }
  state.pool.BG27_002 = 2;

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextPlayer = humanPlayer(combat);
  assert.equal(nextPlayer.hand.length, 10);
  assert.equal(
    nextPlayer.hand.filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === "BG27_002",
    ).length,
    1,
  );
  assert.equal(combat.pool.BG27_002, 1);
  const gainEvents =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "cardGain" &&
        event.actorInstanceId === conjurer.instanceId,
    ) ?? [];
  assert.deepEqual(
    gainEvents.map((event) => event.cardGainResult),
    ["added", "handFull"],
  );
});

test("AI Barrens Conjurer card gains do not reveal private hand details", () => {
  const state = createGame(0xd3341);
  const human = humanPlayer(state);
  const enemy = isolateCombat(
    state,
    [enemyWall("privacy-human-wall")],
    [
      definitionMinion(
        "BG29_862",
        "privacy-ai-conjurer",
        { attack: 0, health: 1, taunt: true },
      ),
    ],
  );
  human.hand = [];
  enemy.tavernTier = 6;
  for (const definition of MINION_DEFINITIONS) {
    state.pool[definition.id] = 0;
  }
  state.pool.BG27_002 = 1;

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextEnemy = combat.players[1];
  assert.equal(nextEnemy.hand.length, 1);
  assert.equal(nextEnemy.hand[0].definitionId, "BG27_002");
  const event = combat.lastBattle?.events.find(
    (candidate) =>
      candidate.type === "cardGain" &&
      candidate.actorPlayerId === enemy.id &&
      candidate.actorInstanceId === "privacy-ai-conjurer",
  );
  assert.ok(event);
  assert.equal(event.cardKind, "minion");
  assert.equal(event.cardName, undefined);
  assert.equal(event.minion, undefined);
  assert.equal(event.targetInstanceId, undefined);
});

test("Vinewhisperer triggers once per Deathrattle minion death even when Titus repeats that Deathrattle", () => {
  const state = createGame(0xd3350);
  const player = humanPlayer(state);
  const victim = definitionMinion(
    "BG26_360",
    "vine-combat-victim",
    { attack: 0, health: 1, taunt: true },
  );
  const vinewhisperer = definitionMinion(
    "BG35_437",
    "vine-combat-watcher",
    { attack: 0, health: 1_000_000 },
  );
  const titus = definitionMinion(
    "BG25_354",
    "vine-combat-titus",
    { attack: 0, health: 1_000_000 },
  );
  isolateCombat(
    state,
    [victim, vinewhisperer, titus],
    [enemyWall("vine-combat-wall")],
  );
  player.hand = [];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(humanPlayer(combat).bloodGemAttack, 3);
  const improvements =
    combat.lastBattle?.events.filter(
      (event) =>
        event.type === "trigger" &&
        event.actorInstanceId === vinewhisperer.instanceId &&
        event.permanentEffectImprovement === true,
    ) ?? [];
  assert.equal(improvements.length, 1);
  assert.equal(improvements[0].attackDelta, 2);
});

test("ghost death rewards never mutate hand, Blood Gems, Tavern buffs, or the shared pool", () => {
  const state = createGame(0xd3360);
  for (const player of state.players) {
    player.alive = false;
    player.health = 0;
    player.gold = 0;
    player.hand = [];
    player.board = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.eliminatedRound = undefined;
  }
  for (const [index, player] of state.players.slice(0, 3).entries()) {
    player.alive = true;
    player.health = 100;
    player.board = [
      enemyWall(`ghost-opponent-${index}`),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 0;
  ghost.bloodGemAttack = 4;
  ghost.bloodGemHealth = 3;
  const conjurer = goldenMinion(
    "BG29_862",
    "ghost-conjurer",
    { attack: 0, health: 1, taunt: true },
  );
  ghost.board = [
    conjurer,
    goldenMinion("BG24_707", "ghost-scrapsmith", {
      attack: 0,
      health: 1_000_000,
    }),
    goldenMinion("BG35_437", "ghost-vinewhisperer", {
      attack: 0,
      health: 1_000_000,
    }),
  ];
  const handBefore = structuredClone(ghost.hand);
  const buffsBefore = structuredClone(ghost.tavernTypeBuffs);
  const poolBefore = structuredClone(state.pool);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players[3];
  assert.deepEqual(nextGhost.hand, handBefore);
  assert.equal(nextGhost.bloodGemAttack, 4);
  assert.equal(nextGhost.bloodGemHealth, 3);
  assert.deepEqual(nextGhost.tavernTypeBuffs, buffsBefore);
  assert.deepEqual(combat.pool, poolBefore);
  const ghostBattle = combat.lastRoundBattles.find(
    (battle) =>
      battle.isGhost &&
      (battle.playerAId === ghost.id ||
        battle.playerBId === ghost.id),
  );
  assert.ok(ghostBattle);
  assert.equal(
    ghostBattle.events.some(
      (event) =>
        event.actorPlayerId === ghost.id &&
        (event.type === "cardGain" ||
          event.permanentEffectImprovement === true),
    ),
    false,
  );
});

test("v32 saves migrate to v33 and refresh the six complete card definitions", () => {
  const legacy = structuredClone(createGame(0xd3370));
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V32;
  const player = humanPlayer(legacy);
  player.board = [
    definitionMinion("BG24_707", "legacy-scrapsmith"),
    definitionMinion("BG35_437", "legacy-vinewhisperer"),
  ];

  const migrated = normalizePersistedGameState(legacy);
  assert.ok(migrated);
  const migratedState = migrated as GameState;
  assert.equal(
    migratedState.contentVersion,
    CURRENT_ROSTER_VERSION,
  );
  assert.equal(
    humanPlayer(migratedState).board.every(
      (minion) => minion.effectSupport === "complete",
    ),
    true,
  );
  for (const definitionId of [
    "BG24_707",
    "BG28_309",
    "BG29_862",
    "BG26_162",
    "BG34_633",
    "BG35_437",
  ]) {
    assert.equal(
      getMinionDefinition(definitionId).effectSupport,
      "complete",
    );
  }
});
