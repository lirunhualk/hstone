import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_ROSTER_VERSION,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  createGame,
  gameReducer,
  getScheduledPairings,
  getTavernSpellDefinition,
  planAiBoardOrder,
  scoreMinionForAi,
  type BoardMinionInstance,
  type GameState,
  type MagneticAttachment,
  type PlayerState,
  type TavernSpellInstance,
} from "../lib/game/engine.ts";
import {
  LEGACY_SCHEMA_11_CONTENT_VERSION_V28,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

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
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
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

function attachment(
  definitionId: string,
  sourceInstanceId: string,
): MagneticAttachment {
  const definition = getMinionDefinition(definitionId);
  return {
    sourceInstanceId,
    definitionId,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    effectSupport: definition.effectSupport ?? "complete",
    golden: false,
    poolCopies: 0,
    attackGranted: 0,
    healthGranted: 0,
    attachments: [],
  };
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

function keepOnlyOneOpponent(
  state: GameState,
  enemyBoard: BoardMinionInstance[],
): PlayerState {
  for (const [index, player] of state.players.entries()) {
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (index > 1) {
      player.alive = false;
      player.health = 0;
      player.board = [];
      player.eliminatedRound = undefined;
    }
  }
  const enemy = state.players[1];
  enemy.alive = true;
  enemy.health = 100;
  enemy.board = enemyBoard;
  return enemy;
}

function enemyWall(
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  return definitionMinion("BG29_611", instanceId, {
    attack: 1_000_000,
    health: 1_000_000,
    taunt: true,
    divineShield: false,
    reborn: false,
    ...overrides,
  });
}

function permanentMinion(
  state: GameState,
  instanceId: string,
): BoardMinionInstance {
  const minion = humanPlayer(state).board.find(
    (candidate) => candidate.instanceId === instanceId,
  );
  assert.ok(minion);
  return minion;
}

test("Tarecgosa, Persistent Poet, and Fire-forged Evoker map exact fixed-build rules", () => {
  const tarecgosa = getMinionDefinition("BG21_015");
  assert.equal(tarecgosa.effectSupport, "complete");
  assert.deepEqual(
    [
      tarecgosa.name,
      tarecgosa.tier,
      tarecgosa.attack,
      tarecgosa.health,
      tarecgosa.description,
      tarecgosa.goldenCardId,
      tarecgosa.goldenDescription,
    ],
    [
      "泰蕾苟萨",
      2,
      4,
      4,
      "本随从可永久保留战斗阶段获得的额外关键词和属性值。",
      "BG21_015_G",
      "本随从可永久保留战斗阶段获得的额外关键词和双倍属性值。",
    ],
  );
  assert.deepEqual(tarecgosa.combatEnchantmentRetention, {
    target: "self",
    goldenMode: "doubleStats",
  });

  const poet = getMinionDefinition("BG29_813");
  assert.equal(poet.effectSupport, "complete");
  assert.deepEqual(
    [poet.name, poet.tier, poet.attack, poet.health, poet.divineShield],
    ["执念诗心龙", 4, 2, 3, true],
  );
  assert.equal(
    poet.description,
    "圣盾。相邻的龙可永久保留战斗阶段获得的额外关键词和属性值。",
  );
  assert.equal(
    poet.goldenDescription,
    "圣盾。相邻的龙可永久保留战斗阶段获得的额外关键词和双倍属性值。",
  );
  assert.deepEqual(poet.combatEnchantmentRetention, {
    target: "adjacentFriendlyTribe",
    tribe: "dragon",
    goldenMode: "doubleStats",
  });

  const evoker = getMinionDefinition("BG32_822");
  assert.equal(evoker.effectSupport, "complete");
  assert.deepEqual(
    [evoker.name, evoker.tier, evoker.attack, evoker.health],
    ["火铸唤魔师", 6, 8, 5],
  );
  assert.equal(
    evoker.description,
    "战斗开始时：使你的龙获得+2/+1。在你施放一个酒馆法术后永久提升此效果。",
  );
  assert.equal(
    evoker.goldenDescription,
    "战斗开始时：使你的龙获得+4/+2。在你施放一个酒馆法术后永久提升此效果。",
  );
  assert.deepEqual(evoker.startOfCombat, [
    {
      kind: "growingTribeBuff",
      tribe: "dragon",
      attack: 2,
      health: 1,
      goldenMode: "doubleStats",
    },
  ]);
  assert.deepEqual(evoker.afterTavernSpellCast, [
    {
      kind: "improveStartOfCombatBuff",
      attack: 2,
      health: 1,
    },
  ]);
});

test("ordinary and Golden Tarecgosa retain event-time stats and a Divine Shield even after dying", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0x8200 + caseIndex);
    const human = humanPlayer(state);
    const amber = definitionMinion(
      "BG24_500",
      `tarecgosa-amber-${caseIndex}`,
    );
    const tarecgosa = golden
      ? goldenMinion("BG21_015", `tarecgosa-${caseIndex}`, {
          divineShield: false,
        })
      : definitionMinion("BG21_015", `tarecgosa-${caseIndex}`, {
          divineShield: false,
        });
    const before = {
      attack: tarecgosa.attack,
      health: tarecgosa.health,
    };
    human.board = [amber, tarecgosa];
    keepOnlyOneOpponent(state, [
      enemyWall(`tarecgosa-wall-${caseIndex}`),
    ]);
    human.board = [amber, tarecgosa];

    const combat = gameReducer(state, { type: "END_TURN" });
    const permanent = permanentMinion(combat, tarecgosa.instanceId);
    const multiplier = golden ? 2 : 1;
    assert.deepEqual(
      [permanent.attack, permanent.health],
      [before.attack + 2 * multiplier, before.health + 2 * multiplier],
    );
    assert.equal(permanent.divineShield, true);
    assert.equal(permanent.temporaryDivineShield, false);
    assert.ok(
      combat.lastBattle?.events.some(
        (event) =>
          event.type === "death" &&
          event.actorInstanceId === tarecgosa.instanceId,
      ),
    );
    assert.ok(
      combat.lastBattle?.events.some(
        (event) =>
          event.type === "shieldBroken" &&
          event.targetInstanceId === tarecgosa.instanceId,
      ),
    );
    const retained = combat.lastBattle?.events.find(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === tarecgosa.instanceId &&
        event.actorInstanceId === amber.instanceId,
    );
    assert.ok(retained);
    assert.equal(retained.retained, true);
    assert.equal(retained.retentionMultiplier, multiplier);
  }
});

test("Persistent Poet protects only its current adjacent Dragons and Golden sources do not stack", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    const state = createGame(0x8210 + caseIndex);
    const human = humanPlayer(state);
    const evoker = definitionMinion(
      "BG32_822",
      `poet-evoker-${caseIndex}`,
    );
    const target = definitionMinion(
      "BG34_636t",
      `poet-target-${caseIndex}`,
    );
    const nonDragon = definitionMinion(
      "BG29_611",
      `poet-non-dragon-${caseIndex}`,
      { divineShield: false },
    );
    const poet = golden
      ? goldenMinion("BG29_813", `poet-${caseIndex}`)
      : definitionMinion("BG29_813", `poet-${caseIndex}`);
    human.board = [evoker, target, poet, nonDragon];
    keepOnlyOneOpponent(state, [
      enemyWall(`poet-wall-${caseIndex}`),
    ]);
    human.board = [evoker, target, poet, nonDragon];

    const combat = gameReducer(state, { type: "END_TURN" });
    const permanentTarget = permanentMinion(
      combat,
      target.instanceId,
    );
    const permanentNonDragon = permanentMinion(
      combat,
      nonDragon.instanceId,
    );
    const multiplier = golden ? 2 : 1;
    assert.deepEqual(
      [permanentTarget.attack, permanentTarget.health],
      [target.attack + 2 * multiplier, target.health + multiplier],
    );
    assert.deepEqual(
      [permanentNonDragon.attack, permanentNonDragon.health],
      [nonDragon.attack, nonDragon.health],
    );
  }

  const state = createGame(0x8212);
  const human = humanPlayer(state);
  const leftPoet = goldenMinion("BG29_813", "left-golden-poet");
  const target = definitionMinion("BG34_636t", "double-poet-target");
  const rightPoet = goldenMinion("BG29_813", "right-golden-poet");
  const evoker = definitionMinion("BG32_822", "double-poet-evoker");
  human.board = [leftPoet, target, rightPoet, evoker];
  keepOnlyOneOpponent(state, [enemyWall("double-poet-wall")]);
  human.board = [leftPoet, target, rightPoet, evoker];

  const combat = gameReducer(state, { type: "END_TURN" });
  const permanent = permanentMinion(combat, target.instanceId);
  assert.deepEqual(
    [permanent.attack, permanent.health],
    [target.attack + 4, target.health + 2],
  );
});

test("Persistent Poet re-evaluates adjacency at each gain and stops protecting after it dies", () => {
  {
    const state = createGame(0x8213);
    const human = humanPlayer(state);
    const poet = definitionMinion(
      "BG29_813",
      "moving-adjacency-poet",
      { attack: 0, divineShield: false },
    );
    const sacrifice = definitionMinion(
      "BG26_529",
      "moving-adjacency-sacrifice",
      { attack: 1, health: 1 },
    );
    const target = definitionMinion(
      "BG34_636t",
      "moving-adjacency-target",
      {
        attack: 0,
        health: 20,
        attachments: [
          attachment("BG25_013", "moving-adjacency-trigger"),
        ],
      },
    );
    human.board = [poet, sacrifice, target];
    keepOnlyOneOpponent(state, [
      enemyWall("moving-adjacency-wall"),
    ]);
    human.board = [poet, sacrifice, target];

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      permanentMinion(combat, target.instanceId).attack,
      target.attack + 1,
    );
    assert.ok(
      combat.lastBattle?.events.some(
        (event) =>
          event.type === "buff" &&
          event.targetInstanceId === target.instanceId &&
          event.retentionMultiplier === 1,
      ),
    );
  }

  {
    const state = createGame(0x8214);
    const human = humanPlayer(state);
    const poet = definitionMinion(
      "BG29_813",
      "dead-poet",
      {
        attack: 1,
        health: 1,
        divineShield: false,
      },
    );
    const target = definitionMinion(
      "BG34_636t",
      "dead-poet-target",
      {
        attack: 0,
        health: 20,
        attachments: [attachment("BG25_013", "dead-poet-trigger")],
      },
    );
    human.board = [poet, target];
    keepOnlyOneOpponent(state, [enemyWall("dead-poet-wall")]);
    human.board = [poet, target];

    const combat = gameReducer(state, { type: "END_TURN" });
    assert.equal(
      permanentMinion(combat, target.instanceId).attack,
      target.attack,
    );
    const combatBuff = combat.lastBattle?.events.find(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === target.instanceId &&
        event.message.includes("友方随从死亡"),
    );
    assert.ok(combatBuff);
    assert.notEqual(combatBuff.retained, true);
  }
});

test("combat auras are not retained by Tarecgosa or Persistent Poet", () => {
  const state = createGame(0x8220);
  const human = humanPlayer(state);
  const warleader = definitionMinion(
    "murloc-warleader",
    "retention-aura-source",
  );
  const target = definitionMinion("BG34_636t", "retention-aura-target", {
    tribes: ["all"],
  });
  const poet = definitionMinion("BG29_813", "retention-aura-poet");
  const tarecgosa = definitionMinion(
    "BG21_015",
    "retention-aura-tarecgosa",
    { tribes: ["all"] },
  );
  human.board = [warleader, target, poet, tarecgosa];
  keepOnlyOneOpponent(state, [enemyWall("retention-aura-wall")]);
  human.board = [warleader, target, poet, tarecgosa];

  const combat = gameReducer(state, { type: "END_TURN" });
  assert.deepEqual(
    [
      permanentMinion(combat, target.instanceId).attack,
      permanentMinion(combat, tarecgosa.instanceId).attack,
    ],
    [target.attack, tarecgosa.attack],
  );
});

test("Fire-forged Evoker improves by its full base vector for each Recruit Tavern Spell", () => {
  for (const [caseIndex, golden] of [false, true].entries()) {
    let state = createGame(0x8230 + caseIndex);
    let human = humanPlayer(state);
    const evoker = golden
      ? goldenMinion("BG32_822", `spell-evoker-${caseIndex}`)
      : definitionMinion("BG32_822", `spell-evoker-${caseIndex}`);
    const target = definitionMinion(
      "BG34_636t",
      `spell-evoker-target-${caseIndex}`,
    );
    human.board = [evoker, target];
    human.hand = [
      tavernSpell(
        "tavern-spell-tavern-coin",
        `spell-evoker-coin-${caseIndex}`,
      ),
    ];
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `spell-evoker-coin-${caseIndex}`,
    });
    human = humanPlayer(state);
    const persistentEvoker = human.board.find(
      (minion) => minion.instanceId === evoker.instanceId,
    );
    assert.ok(persistentEvoker);
    const scale = golden ? 2 : 1;
    assert.deepEqual(persistentEvoker.effectCounters, {
      startOfCombatAttackBonus: 2 * scale,
      startOfCombatHealthBonus: scale,
    });
    assert.match(
      persistentEvoker.description,
      new RegExp(`\\+${4 * scale}/\\+${2 * scale}`),
    );

    keepOnlyOneOpponent(state, [
      enemyWall(`spell-evoker-wall-${caseIndex}`),
    ]);
    const combat = gameReducer(state, { type: "END_TURN" });
    const buff = combat.lastBattle?.events.find(
      (event) =>
        event.type === "buff" &&
        event.actorInstanceId === evoker.instanceId &&
        event.targetInstanceId === target.instanceId,
    );
    assert.ok(buff);
    assert.deepEqual(
      [buff.attackDelta, buff.healthDelta],
      [4 * scale, 2 * scale],
    );
    assert.deepEqual(
      [
        permanentMinion(combat, target.instanceId).attack,
        permanentMinion(combat, target.instanceId).health,
      ],
      [target.attack, target.health],
    );
  }
});

test("combat-cast Tavern Spells improve Fire-forged Evoker permanently and Poet retains their buffs", () => {
  const state = createGame(0x8240);
  const human = humanPlayer(state);
  const guard = definitionMinion(
    "BG34_926",
    "combat-spell-queen-guard",
    { attack: 10, health: 10 },
  );
  const evoker = definitionMinion(
    "BG32_822",
    "combat-spell-evoker",
  );
  const target = definitionMinion(
    "BG34_636t",
    "combat-spell-poet-target",
  );
  const poet = definitionMinion(
    "BG29_813",
    "combat-spell-poet",
  );
  human.board = [guard, evoker, target, poet];
  keepOnlyOneOpponent(state, [
    enemyWall("combat-spell-wall", { attack: 0, health: 1 }),
  ]);
  human.board = [guard, evoker, target, poet];

  const combat = gameReducer(state, { type: "END_TURN" });
  const permanentEvoker = permanentMinion(combat, evoker.instanceId);
  assert.deepEqual(permanentEvoker.effectCounters, {
    startOfCombatAttackBonus: 2,
    startOfCombatHealthBonus: 1,
  });
  assert.match(permanentEvoker.description, /\+4\/\+2/);
  const permanentTarget = permanentMinion(combat, target.instanceId);
  assert.deepEqual(
    [permanentTarget.attack, permanentTarget.health],
    [target.attack + 4, target.health + 3],
  );
  assert.ok(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId === evoker.instanceId &&
        event.attackDelta === 0 &&
        event.healthDelta === 0 &&
        event.permanentEffectImprovement === true &&
        event.message.includes("永久提升至+4/+2"),
    ),
  );
});

test("a temporary hand copy can animate its own retention text without changing the original hand card", () => {
  const state = createGame(0x8241);
  const human = humanPlayer(state);
  const forager = definitionMinion(
    "BG27_556",
    "temporary-tarecgosa-forager",
    { attack: 0 },
  );
  const guard = definitionMinion(
    "BG34_926",
    "temporary-tarecgosa-guard",
    { attack: 10, health: 10 },
  );
  const tarecgosa = definitionMinion(
    "BG21_015",
    "temporary-tarecgosa-hand",
    {
      attack: 0,
      health: 10,
      tribes: ["all"],
    },
  );
  human.board = [forager, guard];
  human.hand = [tarecgosa];
  keepOnlyOneOpponent(state, [
    enemyWall("temporary-tarecgosa-wall", {
      attack: 0,
      health: 1,
    }),
  ]);
  human.board = [forager, guard];
  human.hand = [tarecgosa];

  const combat = gameReducer(state, { type: "END_TURN" });
  const original = humanPlayer(combat).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.instanceId === tarecgosa.instanceId,
  );
  assert.ok(original);
  assert.deepEqual(
    [original.attack, original.health],
    [tarecgosa.attack, tarecgosa.health],
  );
  const summoned = combat.lastBattle?.events.find(
    (event) =>
      event.type === "summon" &&
      event.summonReason === "startOfCombatFromHand",
  );
  assert.ok(summoned?.targetInstanceId);
  const temporaryBuff = combat.lastBattle?.events.find(
    (event) =>
      event.type === "buff" &&
      event.targetInstanceId === summoned.targetInstanceId &&
      event.attackDelta === 2 &&
      event.healthDelta === 2,
  );
  assert.ok(temporaryBuff);
  assert.notEqual(temporaryBuff.retained, true);
});

test("retained gains follow an original Dragon through a combat-time triple", () => {
  const state = createGame(0x8242);
  const human = humanPlayer(state);
  const chromawingDefinitionIds = [
    "BG34_634t",
    "BG34_635t",
    "BG34_636t",
    "BG34_637t",
    "BG34_638t",
  ];
  const protectedDefinitionIds = new Set([
    "BG34_637t",
    "BG34_638t",
  ]);
  const boardChromawings = chromawingDefinitionIds.map(
    (definitionId, index) =>
      definitionMinion(
        definitionId,
        `retention-triple-board-${index}`,
        { taunt: true },
      ),
  );
  const poet = definitionMinion(
    "BG29_813",
    "retention-triple-poet",
    { health: 100 },
  );
  const researcher = definitionMinion(
    "BG34_632",
    "retention-triple-researcher",
    { attack: 0, health: 100, stealth: true },
  );
  keepOnlyOneOpponent(state, [
    enemyWall("retention-triple-wall", {
      attack: 1_000,
      health: 1_000_000,
    }),
  ]);
  const protectedChromawings = boardChromawings.filter(
    (minion) => protectedDefinitionIds.has(minion.definitionId),
  );
  const unprotectedChromawings = boardChromawings.filter(
    (minion) => !protectedDefinitionIds.has(minion.definitionId),
  );
  human.board = [
    protectedChromawings[0],
    poet,
    protectedChromawings[1],
    ...unprotectedChromawings,
    researcher,
  ];
  human.hand = chromawingDefinitionIds.map(
    (definitionId, index) =>
      definitionMinion(
        definitionId,
        `retention-triple-hand-${index}`,
      ),
  );
  human.nextCombatAttackBonus = 1;
  human.nextCombatHealthBonus = 1;

  const combat = gameReducer(state, { type: "END_TURN" });
  const golden = humanPlayer(combat).hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      chromawingDefinitionIds.includes(card.definitionId) &&
      card.golden,
  );
  assert.ok(golden);
  assert.ok(
    protectedDefinitionIds.has(golden.definitionId),
    `generated ${golden.definitionId}`,
  );
  const definition = getMinionDefinition(golden.definitionId);
  assert.deepEqual(
    [golden.attack, golden.health],
    [definition.attack * 2 + 1, definition.health * 2 + 1],
  );
  assert.ok(
    combat.lastBattle?.events.some(
      (event) =>
        event.type === "buff" &&
        event.targetInstanceId ===
          boardChromawings.find(
            (minion) =>
              minion.definitionId === golden.definitionId,
          )?.instanceId &&
        event.retained === true,
    ),
  );
});

test("tripling Fire-forged Evokers sums absolute prior improvements and future Golden casts add +4/+2", () => {
  let state = createGame(0x8250);
  let human = humanPlayer(state);
  human.board = [];
  human.hand = [
    definitionMinion("BG32_822", "triple-evoker-a", {
      effectCounters: {
        startOfCombatAttackBonus: 2,
        startOfCombatHealthBonus: 1,
      },
    }),
    definitionMinion("BG32_822", "triple-evoker-b", {
      effectCounters: {
        startOfCombatAttackBonus: 4,
        startOfCombatHealthBonus: 2,
      },
    }),
    definitionMinion("BG32_822", "triple-evoker-c"),
  ];
  state = gameReducer(state, { type: "PLAY_MINION", handIndex: 0 });
  human = humanPlayer(state);
  const golden = human.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG32_822" &&
      card.golden,
  );
  assert.ok(golden);
  assert.deepEqual(golden.effectCounters, {
    startOfCombatAttackBonus: 6,
    startOfCombatHealthBonus: 3,
  });
  assert.match(golden.description, /\+10\/\+5/);

  human.board = [golden];
  human.hand = [
    tavernSpell("tavern-spell-tavern-coin", "golden-evoker-coin"),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "golden-evoker-coin",
  });
  const improved = humanPlayer(state).board[0];
  assert.deepEqual(improved.effectCounters, {
    startOfCombatAttackBonus: 10,
    startOfCombatHealthBonus: 5,
  });
  assert.match(improved.description, /\+14\/\+7/);
});

test("AI values accumulated Fire-forged growth and places Poet between its best Dragons", () => {
  const state = createGame(0x8251);
  const player = state.players[1];
  const poet = definitionMinion("BG29_813", "ai-poet");
  const strongestDragon = definitionMinion(
    "BG34_636t",
    "ai-poet-strongest",
    { attack: 30, health: 30 },
  );
  const secondDragon = definitionMinion(
    "BG34_638t",
    "ai-poet-second",
    { attack: 20, health: 20 },
  );
  const nonDragon = definitionMinion(
    "BG29_611",
    "ai-poet-non-dragon",
    { attack: 25, health: 25 },
  );
  player.board = [poet, nonDragon, secondDragon, strongestDragon];
  const order = planAiBoardOrder(player);
  const poetIndex = order.indexOf(poet.instanceId);
  assert.ok(poetIndex > 0 && poetIndex < order.length - 1);
  assert.deepEqual(
    new Set([order[poetIndex - 1], order[poetIndex + 1]]),
    new Set([strongestDragon.instanceId, secondDragon.instanceId]),
  );

  const base = definitionMinion("BG32_822", "ai-evoker-base");
  const improved = definitionMinion(
    "BG32_822",
    "ai-evoker-improved",
    {
      effectCounters: {
        startOfCombatAttackBonus: 8,
        startOfCombatHealthBonus: 4,
      },
    },
  );
  assert.ok(
    scoreMinionForAi(player, improved) >
      scoreMinionForAi(player, base),
  );
});

test("AI keeps multiple Persistent Poets in one Dragon protection chain", () => {
  for (const dragonCount of [1, 2]) {
    const state = createGame(0x8252 + dragonCount);
    const player = state.players[1];
    const firstPoet = definitionMinion(
      "BG29_813",
      `ai-chain-poet-a-${dragonCount}`,
    );
    const secondPoet = definitionMinion(
      "BG29_813",
      `ai-chain-poet-b-${dragonCount}`,
    );
    const dragons = [
      definitionMinion(
        "BG34_636t",
        `ai-chain-dragon-a-${dragonCount}`,
        { attack: 30, health: 30 },
      ),
      definitionMinion(
        "BG34_638t",
        `ai-chain-dragon-b-${dragonCount}`,
        { attack: 20, health: 20 },
      ),
    ].slice(0, dragonCount);
    const neutral = definitionMinion(
      "BG29_611",
      `ai-chain-neutral-${dragonCount}`,
      { attack: 40, health: 40 },
    );
    player.board = [
      firstPoet,
      neutral,
      ...dragons,
      secondPoet,
    ];

    const order = planAiBoardOrder(player);
    const chainIds = new Set([
      firstPoet.instanceId,
      secondPoet.instanceId,
      ...dragons.map((dragon) => dragon.instanceId),
    ]);
    const chainPositions = order
      .map((instanceId, index) =>
        chainIds.has(instanceId) ? index : -1,
      )
      .filter((index) => index >= 0);
    assert.deepEqual(
      chainPositions,
      Array.from(
        { length: chainPositions.length },
        (_, index) => chainPositions[0] + index,
      ),
    );
    const poetIds = new Set([
      firstPoet.instanceId,
      secondPoet.instanceId,
    ]);
    for (const instanceId of chainIds) {
      const index = order.indexOf(instanceId);
      assert.ok(
        poetIds.has(order[index - 1] ?? "") ||
          poetIds.has(order[index + 1] ?? ""),
        `${instanceId} should be adjacent to a Persistent Poet`,
      );
    }
  }
});

test("AI assigns its Golden Persistent Poet to the highest-value Dragon", () => {
  const state = createGame(0x8255);
  const player = state.players[1];
  const ordinaryPoet = definitionMinion(
    "BG29_813",
    "ai-mixed-poet-ordinary",
  );
  const goldenPoet = goldenMinion(
    "BG29_813",
    "ai-mixed-poet-golden",
  );
  const strongestDragon = definitionMinion(
    "BG34_636t",
    "ai-mixed-dragon-strongest",
    { attack: 100, health: 100 },
  );
  const otherDragons = [
    definitionMinion(
      "BG34_637t",
      "ai-mixed-dragon-second",
      { attack: 20, health: 20 },
    ),
    definitionMinion(
      "BG34_638t",
      "ai-mixed-dragon-third",
      { attack: 10, health: 10 },
    ),
  ];
  player.board = [
    ordinaryPoet,
    strongestDragon,
    ...otherDragons,
    goldenPoet,
  ];

  const order = planAiBoardOrder(player);
  const strongestIndex = order.indexOf(strongestDragon.instanceId);
  assert.ok(
    order[strongestIndex - 1] === goldenPoet.instanceId ||
      order[strongestIndex + 1] === goldenPoet.instanceId,
  );
});

test("a ghost can animate retention cards without mutating its eliminated owner", () => {
  const state = createGame(0x8260);
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
  for (const player of state.players.slice(0, 3)) {
    player.alive = true;
    player.health = 100;
    player.board = [
      definitionMinion("BG29_611", `ghost-live-${player.id}`, {
        attack: 0,
        health: 10_000,
        reborn: false,
      }),
    ];
  }
  const ghost = state.players[3];
  ghost.eliminatedRound = 1;
  const guard = definitionMinion(
    "BG34_926",
    "ghost-retention-guard",
    { attack: 10, health: 1_000 },
  );
  const tarecgosa = definitionMinion(
    "BG21_015",
    "ghost-retention-tarecgosa",
    { attack: 10, health: 1_000 },
  );
  const evoker = definitionMinion(
    "BG32_822",
    "ghost-retention-evoker",
    { attack: 10, health: 1_000 },
  );
  ghost.board = [guard, tarecgosa, evoker];
  const before = structuredClone(ghost.board);
  const pairing = getScheduledPairings(state).find(
    (candidate) => candidate.isGhost,
  );
  assert.equal(pairing?.playerBId, ghost.id);

  const combat = gameReducer(state, { type: "END_TURN" });
  const nextGhost = combat.players.find(
    (player) => player.id === ghost.id,
  );
  assert.ok(nextGhost);
  assert.deepEqual(nextGhost.board, before);
  assert.ok(
    combat.lastRoundBattles.some(
      (battle) =>
        battle.isGhost &&
        battle.events.some(
          (event) =>
            event.type === "buff" &&
            event.targetInstanceId === tarecgosa.instanceId,
        ),
    ),
  );
});

test("v28 saves migrate through v31 while preserving Fire-forged counters and excluding combat ledgers", () => {
  const legacy = createGame(0x8270);
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V28;
  const human = humanPlayer(legacy);
  const evoker = definitionMinion(
    "BG32_822",
    "saved-fire-forged-evoker",
    {
      effectCounters: {
        startOfCombatAttackBonus: 6,
        startOfCombatHealthBonus: 3,
      },
      description:
        "战斗开始时：使你的龙获得+2/+1。在你施放一个酒馆法术后永久提升此效果。",
    },
  );
  human.board = [evoker];
  const migrated = normalizePersistedGameState(
    JSON.parse(JSON.stringify(legacy)),
  ) as GameState | null;
  assert.ok(migrated);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(
    CURRENT_ROSTER_VERSION,
    "battlegrounds-36.0.3-247416-v34",
  );
  const saved = humanPlayer(migrated).board[0];
  assert.deepEqual(saved.effectCounters, evoker.effectCounters);
  assert.match(saved.description, /\+8\/\+4/);
  assert.equal(
    Object.hasOwn(migrated, "retainedCombatEnchantments"),
    false,
  );
});
