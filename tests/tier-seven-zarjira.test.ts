import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getMinionDefinition } from "../lib/game/content.ts";
import {
  SPELLCRAFT_DEFINITIONS,
  advanceHeadlessGame,
  createGame,
  createHeadlessGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  getSpellcraftDefinition,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
} from "../lib/game/engine.ts";
import { normalizePersistedGameState } from "../lib/game/save.ts";

const ZARJIRA_DEFINITION_ID = "BG27_514";
const SIRENS_SONG_DEFINITION_ID = "spellcraft-sirens-song";

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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    suppressedBloodGemAttack: 0,
    suppressedBloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
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

function sirensSong(
  instanceId: string,
  golden = false,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(SIRENS_SONG_DEFINITION_ID);
  assert.ok(!golden || definition.goldenCardId);
  assert.ok(!golden || definition.goldenDescription);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId: definition.id,
    cardId: golden
      ? (definition.goldenCardId as string)
      : definition.cardId,
    name: definition.name,
    description: golden
      ? (definition.goldenDescription as string)
      : definition.description,
    spellFamily: definition.spellFamily ?? "spellcraft",
    target: definition.target,
    effectMultiplier: golden ? 2 : 1,
  };
}

function minionsInHand(player: PlayerState): BoardMinionInstance[] {
  return player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
}

test("Sea Witch Zar'jira and Siren's Song expose the exact complete Tier 7 rules", () => {
  const zarjira = getMinionDefinition(ZARJIRA_DEFINITION_ID);
  assert.equal(zarjira.effectSupport, "complete");
  assert.deepEqual(
    [
      zarjira.name,
      zarjira.tier,
      zarjira.attack,
      zarjira.health,
      zarjira.tribe,
    ],
    ["海巫扎尔吉拉", 7, 4, 5, "naga"],
  );
  assert.equal(
    zarjira.description,
    "塑造法术：选择酒馆中一个不同的随从，获取一张复制。",
  );
  assert.equal(zarjira.goldenCardId, "BG27_514_G");
  assert.equal(
    zarjira.goldenDescription,
    "塑造法术：选择酒馆中一个不同的随从，获取2张复制。",
  );
  assert.deepEqual(zarjira.spellcraft, {
    definitionId: SIRENS_SONG_DEFINITION_ID,
  });

  const song = getSpellcraftDefinition(SIRENS_SONG_DEFINITION_ID);
  assert.deepEqual(
    {
      cardId: song.cardId,
      goldenCardId: song.goldenCardId,
      name: song.name,
      description: song.description,
      goldenDescription: song.goldenDescription,
      sourceTier: song.sourceTier,
      effect: song.effect,
      target: song.target,
      randomlyGeneratable: song.randomlyGeneratable,
    },
    {
      cardId: "BG27_514t",
      goldenCardId: "BG27_514_Gt",
      name: "海妖之歌",
      description:
        "选择酒馆中的一个随从（海巫扎尔吉拉除外），获取一张复制。",
      goldenDescription:
        "选择酒馆中的一个随从（海巫扎尔吉拉除外），获取2张复制。",
      sourceTier: 7,
      effect: "sirensSong",
      target: "shop",
      randomlyGeneratable: false,
    },
  );
  assert.ok(
    SPELLCRAFT_DEFINITIONS.some(
      (definition) => definition.id === SIRENS_SONG_DEFINITION_ID,
    ),
  );
});

test("normal and Golden Zar'jira generate the correct Siren's Song cards and copy counts", () => {
  for (const golden of [false, true]) {
    let state = createGame(golden ? 0x7515 : 0x7514);
    let player = humanPlayer(state);
    const source = golden
      ? goldenMinion(ZARJIRA_DEFINITION_ID, "zarjira-golden")
      : definitionMinion(ZARJIRA_DEFINITION_ID, "zarjira-normal");
    const target = definitionMinion(
      "BG23_009",
      golden ? "golden-song-target" : "normal-song-target",
    );
    player.hand = [source];
    player.shop = [target];

    state = gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: source.instanceId,
      boardIndex: 0,
    });
    player = humanPlayer(state);
    const song = player.hand.find(
      (card): card is SpellcraftSpellInstance =>
        card.kind === "spellcraft" &&
        card.definitionId === SIRENS_SONG_DEFINITION_ID,
    );
    assert.ok(song);
    assert.deepEqual(
      [song.cardId, song.effectMultiplier, song.target],
      [golden ? "BG27_514_Gt" : "BG27_514t", golden ? 2 : 1, "shop"],
    );

    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId: song.instanceId,
      targetInstanceId: target.instanceId,
    });
    const copies = minionsInHand(humanPlayer(state)).filter(
      (card) => card.definitionId === target.definitionId,
    );
    assert.equal(copies.length, golden ? 2 : 1);
    assert.equal(new Set(copies.map((copy) => copy.instanceId)).size, copies.length);
    assert.ok(copies.every((copy) => copy.instanceId !== target.instanceId));
  }
});

test("Siren's Song only targets non-Zar'jira Tavern minions", () => {
  let state = createGame(0x7516);
  let player = humanPlayer(state);
  const legal = definitionMinion("BG23_009", "legal-shop-target");
  const excludedNormal = definitionMinion(
    ZARJIRA_DEFINITION_ID,
    "excluded-normal-zarjira",
  );
  const excludedGolden = goldenMinion(
    ZARJIRA_DEFINITION_ID,
    "excluded-golden-zarjira",
  );
  const boardMinion = definitionMinion("BG27_004", "friendly-board-minion");
  const song = sirensSong("target-legality-song");
  player.board = [boardMinion];
  player.shop = [excludedNormal, legal, excludedGolden];
  player.hand = [song];

  assert.deepEqual(
    getLegalSpellcraftTargetIds(state, player.id, song),
    [legal.instanceId],
  );

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: song.instanceId,
    targetInstanceId: excludedNormal.instanceId,
  });
  player = humanPlayer(state);
  assert.ok(player.hand.some((card) => card.instanceId === song.instanceId));

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: song.instanceId,
    targetInstanceId: boardMinion.instanceId,
  });
  assert.ok(
    humanPlayer(state).hand.some((card) => card.instanceId === song.instanceId),
  );
});

test("Siren's Song preserves copyable state while every new copy owns zero shared-pool cards", () => {
  let state = createGame(0x7517);
  let player = humanPlayer(state);
  const target = goldenMinion("BG23_009", "enchanted-shop-target", {
    attack: 31,
    health: 42,
    taunt: true,
    divineShield: true,
    reborn: true,
    venomous: true,
    windfury: true,
    temporaryAttack: 5,
    temporaryHealth: 7,
    temporaryTaunt: true,
    effectCounters: { copyableCounter: 9 },
    poolCopies: 3,
    poolCopiesByDefinitionId: {
      BG23_009: 2,
      BG27_004: 1,
    },
    poolCopiesOnPurchase: 1,
    attachments: [
      {
        sourceInstanceId: "nested-magnetic-source",
        definitionId: "BG27_004",
        cardId: "BG27_004",
        name: "滩头指挥官",
        description: "复制测试磁力组件",
        effectSupport: "complete",
        golden: false,
        poolCopies: 1,
        attackGranted: 3,
        healthGranted: 2,
        attachments: [],
      },
    ],
  });
  const song = sirensSong("state-copy-song");
  player.shop = [target];
  player.hand = [song];
  state.pool.BG23_009 = 17;
  state.pool.BG27_004 = 19;

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: song.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const copy = minionsInHand(player)[0];
  assert.ok(copy);
  assert.notEqual(copy.instanceId, target.instanceId);
  assert.deepEqual(
    {
      definitionId: copy.definitionId,
      cardId: copy.cardId,
      attack: copy.attack,
      health: copy.health,
      golden: copy.golden,
      taunt: copy.taunt,
      divineShield: copy.divineShield,
      reborn: copy.reborn,
      venomous: copy.venomous,
      windfury: copy.windfury,
      temporaryAttack: copy.temporaryAttack,
      temporaryHealth: copy.temporaryHealth,
      temporaryTaunt: copy.temporaryTaunt,
      effectCounters: copy.effectCounters,
    },
    {
      definitionId: target.definitionId,
      cardId: target.cardId,
      attack: target.attack,
      health: target.health,
      golden: target.golden,
      taunt: target.taunt,
      divineShield: target.divineShield,
      reborn: target.reborn,
      venomous: target.venomous,
      windfury: target.windfury,
      temporaryAttack: target.temporaryAttack,
      temporaryHealth: target.temporaryHealth,
      temporaryTaunt: target.temporaryTaunt,
      effectCounters: target.effectCounters,
    },
  );
  assert.equal(copy.poolCopies, 0);
  assert.equal(copy.poolCopiesByDefinitionId, undefined);
  assert.equal(copy.poolCopiesOnPurchase, undefined);
  assert.deepEqual(copy.attachments, [
    {
      ...target.attachments[0],
      poolCopies: 0,
    },
  ]);
  assert.deepEqual(
    [state.pool.BG23_009, state.pool.BG27_004],
    [17, 19],
  );

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: copy.instanceId,
    boardIndex: 0,
  });
  state = gameReducer(state, { type: "SELL_MINION", boardIndex: 0 });
  assert.deepEqual(
    [state.pool.BG23_009, state.pool.BG27_004],
    [17, 19],
  );
});

test("shop-targeted Siren's Song bypasses friendly multipliers, Lava Lurker, and Zesty Shaker", () => {
  let state = createGame(0x7518);
  let player = humanPlayer(state);
  const multiplier = definitionMinion(
    "BG35_883",
    "friendly-spell-multiplier",
  );
  const lava = definitionMinion("BG23_009", "shop-lava-lurker");
  const zesty = definitionMinion("BG26_505", "shop-zesty-shaker");
  const lavaCounters = structuredClone(lava.effectCounters);
  const zestyCounters = structuredClone(zesty.effectCounters);
  const firstSong = sirensSong("lava-copy-song");
  const secondSong = sirensSong("zesty-copy-song");
  player.board = [multiplier];
  player.shop = [lava, zesty];
  player.hand = [firstSong, secondSong];

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: firstSong.instanceId,
    targetInstanceId: lava.instanceId,
  });
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: secondSong.instanceId,
    targetInstanceId: zesty.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    minionsInHand(player).map((card) => card.definitionId).sort(),
    ["BG23_009", "BG26_505"],
  );
  assert.equal(
    player.hand.some((card) => card.kind === "spellcraft"),
    false,
  );
  assert.deepEqual(player.shop[0]?.effectCounters, lavaCounters);
  assert.deepEqual(player.shop[1]?.effectCounters, zestyCounters);
});

test("AI casts Siren's Song on the strongest legal Tavern target", () => {
  const state = createHeadlessGame(0x7519);
  for (const [index, player] of state.players.entries()) {
    player.alive = index < 2;
    player.health = index < 2 ? 1_000 : 0;
    player.gold = 0;
    player.freeRefreshes = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
  }
  const controlled = state.players[0];
  const weak = definitionMinion("BG27_004", "weak-ai-shop-target", {
    attack: 1,
    health: 1,
  });
  const strong = definitionMinion("BG23_009", "strong-ai-shop-target", {
    attack: 100,
    health: 100,
  });
  controlled.hand = [sirensSong("ai-sirens-song")];
  controlled.shop = [weak, strong];

  const next = advanceHeadlessGame(state);
  const nextControlled = next.players.find(
    (player) => player.id === controlled.id,
  );
  assert.ok(nextControlled);
  assert.ok(
    nextControlled.board.some(
      (minion) =>
        minion.definitionId === strong.definitionId &&
        minion.attack === strong.attack &&
        minion.health === strong.health &&
        minion.instanceId !== strong.instanceId,
    ),
  );
});

test("Siren's Song survives save normalization and GameClient exposes Tavern targeting", () => {
  const state = createGame(0x7520);
  humanPlayer(state).hand = [sirensSong("saved-sirens-song", true)];
  const restored = normalizePersistedGameState(
    structuredClone(state),
  ) as GameState | null;
  assert.ok(restored);
  const restoredSong = humanPlayer(restored).hand[0];
  assert.ok(restoredSong?.kind === "spellcraft");
  assert.deepEqual(
    [restoredSong.definitionId, restoredSong.cardId, restoredSong.target],
    [SIRENS_SONG_DEFINITION_ID, "BG27_514_Gt", "shop"],
  );

  const clientSource = readFileSync(
    new URL("../app/GameClient.tsx", import.meta.url),
    "utf8",
  ).replace(/\s+/gu, " ");
  assert.match(clientSource, /value\.target !== "shop"/u);
  assert.match(
    clientSource,
    /human\.board\.find\([\s\S]*?human\.shop\.find/u,
  );
  assert.match(
    clientSource,
    /hoveredBoardTarget \?\? hoveredShopTarget/u,
  );
  assert.match(clientSource, /点击任意发光的酒馆随从/u);
  assert.match(clientSource, /拖到酒馆随从上塑造/u);
});
