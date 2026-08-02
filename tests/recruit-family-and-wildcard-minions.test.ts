import assert from "node:assert/strict";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  gameTransition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type Tribe,
} from "../lib/game/engine.ts";
import { deriveRecruitPresentation } from "../lib/game/recruit-presentation.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V41,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const ALL_LOBBY_TRIBES: Tribe[] = [
  "beast",
  "mech",
  "demon",
  "murloc",
  "dragon",
  "pirate",
  "elemental",
  "naga",
  "quilboar",
  "undead",
];

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function definitionMinion(
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const golden = overrides.golden === true;
  return {
    kind: "minion",
    instanceId,
    definitionId,
    cardId: golden
      ? definition.goldenCardId ?? `${definition.cardId}_G`
      : definition.cardId,
    name: golden ? `金色·${definition.name}` : definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    tribes: [
      ...(definition.tribes ??
        (definition.tribe === "neutral" ? [] : [definition.tribe])),
    ],
    associatedTribes: [...(definition.associatedTribes ?? [])],
    effectSupport: definition.effectSupport ?? "complete",
    sellValue: golden
      ? definition.goldenSellValue ?? definition.sellValue ?? 1
      : definition.sellValue ?? 1,
    attack: definition.attack * (golden ? 2 : 1),
    health: definition.health * (golden ? 2 : 1),
    golden,
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
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
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
  return definitionMinion(definitionId, instanceId, {
    golden: true,
    ...overrides,
  });
}

function minionByInstanceId(
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance {
  const minion = player.board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion, `${instanceId} must remain on the board`);
  return minion;
}

function minionInHand(
  player: PlayerState,
  definitionId: string,
  golden?: boolean,
): BoardMinionInstance {
  const minion = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === definitionId &&
      (golden === undefined || card.golden === golden),
  );
  assert.ok(minion, `${definitionId} must exist in hand`);
  return minion;
}

function restrictMinionPool(
  state: GameState,
  copies: Readonly<Record<string, number>>,
): void {
  state.activeTribes = [...ALL_LOBBY_TRIBES];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const [definitionId, count] of Object.entries(copies)) {
    state.pool[definitionId] = count;
  }
}

function playCard(
  state: GameState,
  cardInstanceId: string,
): GameState {
  return gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId,
  });
}

function chooseDiscover(
  state: GameState,
  definitionId: string,
): GameState {
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  const option = pending.options.find(
    (candidate) => candidate.definitionId === definitionId,
  );
  assert.ok(option, `discover must offer ${definitionId}`);
  return gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: option.instanceId,
  });
}

function keepOnlyOneEmptyOpponent(state: GameState): void {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    if (player.isHuman) {
      continue;
    }
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    player.hand = [];
    player.board = [];
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 999;
    } else {
      player.alive = false;
      player.health = 0;
      player.eliminatedRound = 0;
    }
  }
}

function continueRecruitRound(state: GameState): GameState {
  const combat = gameReducer(state, { type: "END_TURN" });
  assert.equal(combat.phase, "combat");
  const recruit = gameReducer(combat, { type: "CONTINUE" });
  assert.equal(recruit.phase, "recruit");
  return recruit;
}

test("the five Recruit-family cards expose the fixed-build ordinary and Golden metadata", () => {
  const expected = [
    {
      id: "BG34_781",
      name: "邪能恐角龙",
      tier: 3,
      attack: 2,
      health: 4,
      tribes: ["demon", "beast"] as Tribe[],
      ordinaryText: "其他恶魔和野兽获得+1/+2",
      goldenText: "触发四次",
    },
    {
      id: "BG35_140",
      name: "莫格顿大妈",
      tier: 3,
      attack: 5,
      health: 3,
      tribes: ["murloc"] as Tribe[],
      ordinaryText: "其他鱼人获得+2攻击力",
      goldenText: "其他鱼人获得+4攻击力",
    },
    {
      id: "BG35_141",
      name: "莫格顿老爹",
      tier: 3,
      attack: 3,
      health: 5,
      tribes: ["murloc"] as Tribe[],
      ordinaryText: "其他鱼人获得+2生命值",
      goldenText: "其他鱼人获得+4生命值",
    },
    {
      id: "BG32_873",
      name: "灰烬腐蚀者",
      tier: 5,
      attack: 6,
      health: 6,
      tribes: ["demon"] as Tribe[],
      ordinaryText: "酒馆中的随从在本回合中获得+1/+1",
      goldenText: "酒馆中的随从在本回合中获得+2/+2",
    },
    {
      id: "BG26_175",
      name: "惊喜元素",
      tier: 6,
      attack: 8,
      health: 8,
      tribes: ["elemental"] as Tribe[],
      ordinaryText: "可以与任意元素三连",
      goldenText: "可与任意元素组成三连",
    },
  ] as const;

  for (const card of expected) {
    const definition = getMinionDefinition(card.id);
    assert.equal(definition.cardId, card.id);
    assert.equal(definition.goldenCardId, `${card.id}_G`);
    assert.equal(definition.name, card.name);
    assert.equal(definition.tier, card.tier);
    assert.equal(definition.attack, card.attack);
    assert.equal(definition.health, card.health);
    assert.deepEqual(definition.tribes, card.tribes);
    assert.equal(definition.effectSupport, "complete");
    assert.ok(
      definition.description.replace(/\s+/gu, "").includes(card.ordinaryText),
    );
    assert.ok(
      definition.goldenDescription
        ?.replace(/\s+/gu, "")
        .includes(card.goldenText),
    );
  }

  assert.equal(getMinionDefinition("BG26_175").divineShield, true);
});

test("Felhorn buffs and damages only other Demons or Beasts for two complete pulses", () => {
  let state = createGame(0xd420);
  const player = humanPlayer(state);
  const beast = definitionMinion("BG31_803", "felhorn-beast", {
    attack: 10,
    health: 10,
  });
  const shieldedDemon = definitionMinion(
    "BG26_174",
    "felhorn-shielded-demon",
    {
      attack: 10,
      health: 10,
      divineShield: true,
    },
  );
  const dualTribe = definitionMinion("BG34_781", "felhorn-dual", {
    attack: 10,
    health: 10,
  });
  const neutral = definitionMinion("BG24_715", "felhorn-neutral", {
    attack: 10,
    health: 10,
  });
  const source = definitionMinion("BG34_781", "felhorn-source");
  player.board = [beast, shieldedDemon, dualTribe, neutral];
  player.hand = [source];

  state = playCard(state, source.instanceId);
  const nextPlayer = humanPlayer(state);
  assert.deepEqual(
    [
      minionByInstanceId(nextPlayer, beast.instanceId).attack,
      minionByInstanceId(nextPlayer, beast.instanceId).health,
    ],
    [12, 12],
  );
  assert.deepEqual(
    [
      minionByInstanceId(nextPlayer, shieldedDemon.instanceId).attack,
      minionByInstanceId(nextPlayer, shieldedDemon.instanceId).health,
      minionByInstanceId(nextPlayer, shieldedDemon.instanceId).divineShield,
    ],
    [12, 13, false],
    "the first damage pulse must break Divine Shield before the second deals Health damage",
  );
  assert.deepEqual(
    [
      minionByInstanceId(nextPlayer, dualTribe.instanceId).attack,
      minionByInstanceId(nextPlayer, dualTribe.instanceId).health,
    ],
    [12, 12],
    "a dual Demon-Beast is affected once per pulse, not once per tribe",
  );
  assert.deepEqual(
    [
      minionByInstanceId(nextPlayer, neutral.instanceId).attack,
      minionByInstanceId(nextPlayer, neutral.instanceId).health,
    ],
    [10, 10],
  );
  assert.deepEqual(
    [
      minionByInstanceId(nextPlayer, source.instanceId).attack,
      minionByInstanceId(nextPlayer, source.instanceId).health,
    ],
    [2, 4],
    "Felhorn must exclude the source itself",
  );
});

test("Golden Felhorn resolves four pulses per Battlecry and Brann repeats all four", () => {
  let state = createGame(0xd421);
  const player = humanPlayer(state);
  const brann = definitionMinion("BG_LOE_077", "felhorn-brann");
  const target = definitionMinion("BG31_803", "felhorn-golden-target", {
    attack: 10,
    health: 10,
  });
  const source = goldenMinion("BG34_781", "felhorn-golden-source");
  player.board = [brann, target];
  player.hand = [source];

  state = playCard(state, source.instanceId);
  const nextTarget = minionByInstanceId(
    humanPlayer(state),
    target.instanceId,
  );
  assert.deepEqual([nextTarget.attack, nextTarget.health], [18, 18]);
  assert.deepEqual(
    [
      minionByInstanceId(humanPlayer(state), source.instanceId).attack,
      minionByInstanceId(humanPlayer(state), source.instanceId).health,
    ],
    [4, 8],
  );
});

test("only played Mrrglton parents advance the shared ledger before their Battlecries", () => {
  let state = createGame(0xd430);
  let player = humanPlayer(state);
  const target = definitionMinion("BG29_300", "mrrglton-target", {
    attack: 10,
    health: 10,
  });
  const unrelatedMurloc = definitionMinion(
    "BG22_202",
    "mrrglton-unrelated",
  );
  const mama = definitionMinion("BG35_140", "mrrglton-mama");
  const papa = definitionMinion("BG35_141", "mrrglton-papa");
  player.board = [target];
  player.hand = [unrelatedMurloc, mama, papa];
  player.mrrgltonsPlayed = 0;

  state = playCard(state, unrelatedMurloc.instanceId);
  assert.equal(humanPlayer(state).mrrgltonsPlayed, 0);

  state = playCard(state, mama.instanceId);
  player = humanPlayer(state);
  assert.equal(player.mrrgltonsPlayed, 1);
  assert.equal(minionByInstanceId(player, target.instanceId).attack, 13);
  assert.equal(minionByInstanceId(player, mama.instanceId).attack, 5);
  assert.match(
    minionByInstanceId(player, mama.instanceId).description,
    /\+3攻击力/u,
  );

  state = playCard(state, papa.instanceId);
  player = humanPlayer(state);
  assert.equal(player.mrrgltonsPlayed, 2);
  assert.equal(minionByInstanceId(player, target.instanceId).health, 14);
  assert.equal(minionByInstanceId(player, mama.instanceId).health, 7);
  assert.equal(minionByInstanceId(player, papa.instanceId).health, 5);
  assert.match(
    minionByInstanceId(player, papa.instanceId).description,
    /\+4生命值/u,
  );

  keepOnlyOneEmptyOpponent(state);
  state = continueRecruitRound(state);
  assert.equal(humanPlayer(state).mrrgltonsPlayed, 2);
});

test("Golden Mrrglton doubles the accumulated value while Brann repeats one counted play", () => {
  let state = createGame(0xd431);
  const player = humanPlayer(state);
  const target = definitionMinion("BG29_300", "golden-mrrglton-target", {
    attack: 10,
    health: 10,
  });
  const brann = definitionMinion("BG_LOE_077", "golden-mrrglton-brann");
  const mama = goldenMinion("BG35_140", "golden-mrrglton-mama");
  player.board = [target, brann];
  player.hand = [mama];
  player.mrrgltonsPlayed = 2;

  state = playCard(state, mama.instanceId);
  const nextPlayer = humanPlayer(state);
  assert.equal(nextPlayer.mrrgltonsPlayed, 3);
  assert.equal(
    minionByInstanceId(nextPlayer, target.instanceId).attack,
    30,
    "Golden Mama gives 2 * (2 + 3) twice through Brann",
  );
  assert.match(
    minionByInstanceId(nextPlayer, mama.instanceId).description,
    /\+10攻击力/u,
  );
});

test("Ashen Corruptors rewind one damage event once and stack this-turn Tavern buffs", () => {
  let state = createGame(0xd440);
  let player = humanPlayer(state);
  const ordinary = definitionMinion("BG32_873", "ashen-ordinary");
  const golden = goldenMinion("BG32_873", "ashen-golden");
  const percussionist = definitionMinion(
    "BG26_525",
    "ashen-percussionist",
  );
  const currentOffer = definitionMinion("BGS_115", "ashen-current-offer", {
    attack: 10,
    health: 10,
    poolCopies: 1,
  });
  player.tavernTier = 4;
  player.health = 20;
  player.armor = 4;
  player.gold = 10;
  player.board = [ordinary, golden];
  player.hand = [percussionist];
  player.shop = [currentOffer];
  restrictMinionPool(state, { BG26_174: 1 });

  state = playCard(state, percussionist.instanceId);
  state = chooseDiscover(state, "BG26_174");
  player = humanPlayer(state);
  assert.deepEqual([player.health, player.armor], [20, 4]);
  assert.deepEqual(
    [
      player.shop[0]?.attack,
      player.shop[0]?.health,
      player.shop[0]?.temporaryAttack,
      player.shop[0]?.temporaryHealth,
    ],
    [13, 13, 3, 3],
  );

  restrictMinionPool(state, { BGS_115: 7 });
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  for (const offer of player.shop) {
    assert.equal(offer.definitionId, "BGS_115");
    assert.deepEqual(
      [
        offer.attack,
        offer.health,
        offer.temporaryAttack,
        offer.temporaryHealth,
      ],
      [6, 6, 3, 3],
      "later Refreshes inherit every Ashen pulse from this turn",
    );
  }

  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  player = humanPlayer(state);
  const purchased = minionInHand(player, "BGS_115", false);
  assert.deepEqual(
    [
      purchased.attack,
      purchased.health,
      purchased.temporaryAttack,
      purchased.temporaryHealth,
    ],
    [6, 6, 3, 3],
    "the temporary Tavern buff follows a bought minion through this turn",
  );

  player.frozen = true;
  keepOnlyOneEmptyOpponent(state);
  state = continueRecruitRound(state);
  player = humanPlayer(state);
  const clearedPurchase = minionInHand(player, "BGS_115", false);
  assert.deepEqual(
    [
      clearedPurchase.attack,
      clearedPurchase.health,
      clearedPurchase.temporaryAttack,
      clearedPurchase.temporaryHealth,
    ],
    [3, 3, 0, 0],
  );
  assert.ok(player.shop.length > 0, "the frozen Tavern must be retained");
  for (const offer of player.shop) {
    assert.deepEqual(
      [offer.attack, offer.health, offer.temporaryAttack, offer.temporaryHealth],
      [3, 3, 0, 0],
      "frozen offers lose Ashen's this-turn enchantment next Recruit phase",
    );
  }
});

test("one Elemental of Surprise completes a pair and returns every mixed pool copy", () => {
  let state = createGame(0xd450);
  let player = humanPlayer(state);
  const first = definitionMinion("BGS_126", "surprise-pair-one", {
    poolCopies: 1,
  });
  const second = definitionMinion("BGS_126", "surprise-pair-two", {
    poolCopies: 1,
    taunt: true,
  });
  const surprise = definitionMinion("BG26_175", "surprise-pair-wildcard", {
    poolCopies: 1,
  });
  player.board = [];
  player.hand = [first, second, surprise];

  state = playCard(state, surprise.instanceId);
  player = humanPlayer(state);
  const triple = minionInHand(player, "BGS_126", true);
  assert.deepEqual([triple.attack, triple.health], [20, 14]);
  assert.equal(triple.divineShield, true);
  assert.equal(triple.taunt, true);
  assert.equal(triple.grantsTripleReward, true);
  assert.equal(triple.poolCopies, 3);
  assert.deepEqual(triple.poolCopiesByDefinitionId, {
    BGS_126: 2,
    BG26_175: 1,
  });

  state.pool.BGS_126 = 0;
  state.pool.BG26_175 = 0;
  player.board = [triple];
  player.hand = [];
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.deepEqual(
    [state.pool.BGS_126, state.pool.BG26_175],
    [2, 1],
  );
});

test("two ordinary Surprises complete one Elemental and contribute both stats and pool copies", () => {
  let state = createGame(0xd451);
  const player = humanPlayer(state);
  const target = definitionMinion("BGS_126", "double-surprise-target", {
    poolCopies: 1,
  });
  const first = definitionMinion("BG26_175", "double-surprise-one", {
    poolCopies: 1,
  });
  const second = definitionMinion("BG26_175", "double-surprise-two", {
    poolCopies: 1,
  });
  player.board = [];
  player.hand = [target, first, second];

  state = playCard(state, target.instanceId);
  const triple = minionInHand(humanPlayer(state), "BGS_126", true);
  assert.deepEqual([triple.attack, triple.health], [28, 22]);
  assert.equal(triple.divineShield, true);
  assert.equal(triple.poolCopies, 3);
  assert.deepEqual(triple.poolCopiesByDefinitionId, {
    BGS_126: 1,
    BG26_175: 2,
  });
});

test("an exact ordinary triple resolves before a Surprise wildcard candidate", () => {
  let state = createGame(0xd452);
  const player = humanPlayer(state);
  const first = definitionMinion("BGS_126", "exact-elemental-one", {
    poolCopies: 1,
  });
  const second = definitionMinion("BGS_126", "exact-elemental-two", {
    poolCopies: 1,
  });
  const third = definitionMinion("BGS_126", "exact-elemental-three", {
    poolCopies: 1,
  });
  const surprise = definitionMinion("BG26_175", "unused-surprise", {
    poolCopies: 1,
  });
  player.board = [];
  player.hand = [first, second, third, surprise];

  state = playCard(state, first.instanceId);
  const nextPlayer = humanPlayer(state);
  const triple = minionInHand(nextPlayer, "BGS_126", true);
  assert.deepEqual([triple.attack, triple.health], [12, 6]);
  assert.equal(triple.poolCopies, 3);
  assert.equal(
    nextPlayer.hand.some(
      (card) =>
        card.kind === "minion" &&
        card.instanceId === surprise.instanceId &&
        card.golden === false,
    ),
    true,
  );
});

test("a Golden Surprise remains one wildcard card while its three-copy ledger is retained", () => {
  let state = createGame(0xd453);
  const player = humanPlayer(state);
  const first = definitionMinion("BGS_126", "golden-surprise-target-one", {
    poolCopies: 1,
  });
  const second = definitionMinion("BGS_126", "golden-surprise-target-two", {
    poolCopies: 1,
  });
  const surprise = goldenMinion(
    "BG26_175",
    "golden-surprise-wildcard",
    {
      poolCopies: 3,
      poolCopiesByDefinitionId: { BG26_175: 3 },
    },
  );
  player.board = [];
  player.hand = [first, second, surprise];

  state = playCard(state, surprise.instanceId);
  const triple = minionInHand(humanPlayer(state), "BGS_126", true);
  assert.deepEqual([triple.attack, triple.health], [28, 22]);
  assert.equal(triple.divineShield, true);
  assert.equal(triple.poolCopies, 5);
  assert.deepEqual(triple.poolCopiesByDefinitionId, {
    BGS_126: 2,
    BG26_175: 3,
  });
});

test("Golden Surprises can combine again with another Surprise", () => {
  let state = createGame(0xd454);
  const player = humanPlayer(state);
  const first = goldenMinion("BG26_175", "retrip-surprise-one", {
    poolCopies: 3,
  });
  const second = goldenMinion("BG26_175", "retrip-surprise-two", {
    poolCopies: 3,
  });
  const third = definitionMinion("BG26_175", "retrip-surprise-three", {
    poolCopies: 1,
  });
  player.board = [];
  player.hand = [first, second, third];

  state = playCard(state, third.instanceId);
  const triple = minionInHand(humanPlayer(state), "BG26_175", true);
  assert.deepEqual([triple.attack, triple.health], [32, 32]);
  assert.equal(triple.divineShield, true);
  assert.equal(triple.poolCopies, 7);
});

test("end-of-turn triples wait until the next Recruit phase", () => {
  let state = createGame(0x7426);
  const player = humanPlayer(state);
  restrictMinionPool(state, { BG26_529: 100 });
  player.board = [
    definitionMinion("BG26_529", "deferred-frontdrake-board"),
  ];
  player.hand = [
    definitionMinion("BG26_529", "deferred-frontdrake-hand"),
  ];

  for (let turn = 1; turn <= 2; turn += 1) {
    keepOnlyOneEmptyOpponent(state);
    state = continueRecruitRound(state);
  }

  keepOnlyOneEmptyOpponent(state);
  const combat = gameReducer(state, { type: "END_TURN" });
  const combatPlayer = humanPlayer(combat);
  assert.equal(combat.phase, "combat");
  assert.ok(combat.deferredTriplePlayerIds.includes(combatPlayer.id));
  assert.equal(
    [...combatPlayer.board, ...combatPlayer.hand].filter(
      (card) =>
        card.kind === "minion" && card.definitionId === "BG26_529",
    ).length,
    3,
  );
  assert.equal(
    [...combatPlayer.board, ...combatPlayer.hand].some(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === "BG26_529" &&
        card.golden,
    ),
    false,
  );

  const recruit = gameReducer(combat, { type: "CONTINUE" });
  const recruitPlayer = humanPlayer(recruit);
  assert.equal(recruit.deferredTriplePlayerIds.length, 0);
  assert.equal(
    [...recruitPlayer.board, ...recruitPlayer.hand].filter(
      (card) =>
        card.kind === "minion" &&
        card.definitionId === "BG26_529" &&
        card.golden,
    ).length,
    1,
  );
});

test("current-version JSON saves preserve the Mrrglton counter and mixed Surprise pool ledger", () => {
  const state = createGame(0xd460);
  const player = humanPlayer(state);
  player.mrrgltonsPlayed = 7;
  state.deferredTriplePlayerIds = [player.id];
  player.board = [
    goldenMinion("BGS_126", "persisted-surprise-triple", {
      poolCopies: 5,
      poolCopiesByDefinitionId: {
        BGS_126: 2,
        BG26_175: 3,
      },
    }),
  ];

  const restored = normalizePersistedGameState(
    JSON.parse(JSON.stringify(state)),
  );
  assert.ok(restored);
  assert.deepEqual((restored as GameState).deferredTriplePlayerIds, [
    player.id,
  ]);
  const restoredPlayer = humanPlayer(restored as GameState);
  assert.equal(restoredPlayer.mrrgltonsPlayed, 7);
  assert.equal(restoredPlayer.board[0]?.poolCopies, 5);
  assert.deepEqual(restoredPlayer.board[0]?.poolCopiesByDefinitionId, {
    BGS_126: 2,
    BG26_175: 3,
  });
});

test("v41 saves migrate the new family and this-turn Tavern ledgers conservatively", () => {
  const legacy = JSON.parse(JSON.stringify(createGame(0xd461))) as Record<
    string,
    unknown
  >;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V41;
  delete legacy.deferredTriplePlayerIds;
  const players = legacy.players as Array<Record<string, unknown>>;
  for (const player of players) {
    delete player.mrrgltonsPlayed;
    delete player.tavernMinionAttackBonusThisTurn;
    delete player.tavernMinionHealthBonusThisTurn;
  }

  const migrated = normalizePersistedGameState(legacy);
  assert.ok(migrated);
  assert.deepEqual((migrated as GameState).deferredTriplePlayerIds, []);
  for (const player of (migrated as GameState).players) {
    assert.equal(player.mrrgltonsPlayed, 0);
    assert.equal(player.tavernMinionAttackBonusThisTurn, 0);
    assert.equal(player.tavernMinionHealthBonusThisTurn, 0);
  }
});

test("Surprise triples present all three consumed identities", () => {
  const before = createGame(0xd462);
  const player = humanPlayer(before);
  const first = definitionMinion("BGS_126", "present-target-one", {
    poolCopies: 1,
  });
  const second = definitionMinion("BGS_126", "present-target-two", {
    poolCopies: 1,
  });
  const surprise = definitionMinion("BG26_175", "present-surprise", {
    poolCopies: 1,
  });
  player.hand = [first, second];
  player.shop = [surprise];
  player.gold = 10;
  const action = { type: "BUY_MINION", shopIndex: 0 } as const;
  const transition = gameTransition(before, action);
  const events = deriveRecruitPresentation(
    before,
    transition.state,
    action,
    transition.trace,
  );
  const triple = events.find((event) => event.kind === "triple");
  assert.ok(triple?.kind === "triple");
  assert.equal(triple.golden.definitionId, "BGS_126");
  assert.deepEqual(
    new Set(triple.knownConsumedInstanceIds),
    new Set([first.instanceId, second.instanceId, surprise.instanceId]),
  );
});
