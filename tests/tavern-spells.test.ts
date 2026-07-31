import assert from "node:assert/strict";
import test from "node:test";

import {
  HERO_POWER_DEFINITIONS,
  SPELLCRAFT_DEFINITIONS,
  TAVERN_SPELL_DEFINITIONS,
  createGame,
  gameReducer,
  getLegalSpellcraftTargetIds,
  getLegalTavernSpellTargetIds,
  getSpellcraftDefinition,
  getTavernSpellPurchaseQuote,
  getTavernSpellDefinition,
  getUpgradeCost,
  tavernSpellIsAvailable,
  type BloodGemSpellInstance,
  type BoardMinionInstance,
  type GameState,
  type PlayerState,
  type SpellcraftSpellInstance,
  type TavernSpellInstance,
  type TavernTier,
  type Tribe,
} from "../lib/game/engine.ts";
import {
  CURRENT_ROSTER_VERSION,
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "../lib/game/content.ts";
import {
  RIME_OR_REASON_STAT_GRANTING_CARD_IDS,
} from "../lib/game/tavern-spells.ts";
import {
  LEGACY_SCHEMA_5_CONTENT_VERSION,
  LEGACY_SCHEMA_6_CONTENT_VERSION,
  LEGACY_SCHEMA_7_CONTENT_VERSION,
  LEGACY_SCHEMA_8_CONTENT_VERSION,
  LEGACY_SCHEMA_9_CONTENT_VERSION,
  LEGACY_SCHEMA_10_CONTENT_VERSION,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V23,
  LEGACY_SCHEMA_11_CONTENT_VERSION_V24,
  migrateSchema5GameState,
  migrateSchema6GameState,
  migrateSchema7GameState,
  migrateSchema8GameState,
  migrateSchema9GameState,
  migrateSchema10GameState,
  migrateSchema11GameState,
  normalizePersistedGameState,
} from "../lib/game/save.ts";

const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;
const STAT_GRANTING_TAVERN_SPELL_CARD_IDS = [
  "BG28_168",
  "BG28_169",
  "BG28_503",
  "BG28_519",
  "BG28_520",
  "BG28_825",
  "BG28_838",
  "BG28_845",
  "BG28_886",
  "BG28_888",
  "BG28_897",
  "BG28_966",
  "BG31_881",
  "BG32_815",
  "BG33_811",
  "BG33_812",
  "BG33_813",
  "BG33_817",
  "BG33_899",
  "BG34_444",
  "BG34_990",
  "BG35_149",
  "BG35_910",
  "BG35_911",
  "BG35_912",
  "BG35_922",
  "BG35_951",
  "BG35_952",
  "EBG_Spell_014",
  "EBG_Spell_032",
] as const;

function humanPlayer(state: GameState): PlayerState {
  const player = state.players.find(
    (candidate) => candidate.id === state.humanPlayerId,
  );
  assert.ok(player, "the human player must exist");
  return player;
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function definitionMinion(
  template: BoardMinionInstance,
  definitionId: string,
  instanceId: string,
  overrides: Partial<BoardMinionInstance> = {},
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  return {
    ...template,
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
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
    ...overrides,
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

function spellcraft(
  definitionId: string,
  instanceId: string,
): SpellcraftSpellInstance {
  const definition = getSpellcraftDefinition(definitionId);
  return {
    kind: "spellcraft",
    instanceId,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    description: definition.description,
    spellFamily: "spellcraft",
    target: definition.target,
  };
}

function createGameWithTribes(
  tribes: readonly Tribe[],
  startingSeed: number,
): GameState {
  for (let seed = startingSeed; seed < startingSeed + 100_000; seed += 1) {
    const state = createGame(seed);
    if (tribes.every((tribe) => state.activeTribes.includes(tribe))) {
      return state;
    }
  }
  throw new Error(`Could not create a lobby containing ${tribes.join(", ")}`);
}

function gameWithHelpfulRefresh(
  kind: NonNullable<PlayerState["lastHelpfulRefreshKind"]>,
  setup: (state: GameState, player: PlayerState) => void,
): GameState {
  for (let seed = 0x7600; seed < 0x7800; seed += 1) {
    const state = createGame(seed);
    const player = humanPlayer(state);
    player.tavernTier = 6;
    setup(state, player);
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.helpfulRefreshes = 1;
    player.freeRefreshes = 1;
    player.gold = 0;
    const refreshed = gameReducer(state, { type: "REFRESH_SHOP" });
    if (humanPlayer(refreshed).lastHelpfulRefreshKind === kind) {
      return refreshed;
    }
  }
  throw new Error(`Could not produce helpful Refresh kind ${kind}`);
}

function replaceSpellOffer(
  state: GameState,
  player: PlayerState,
  definitionId: string,
  instanceId = `controlled-${definitionId}`,
): TavernSpellInstance {
  for (const offer of [
    ...(player.spellShop ? [player.spellShop] : []),
    ...player.additionalSpellShop,
  ]) {
    state.spellPool[offer.definitionId] =
      (state.spellPool[offer.definitionId] ?? 0) + 1;
  }
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
  assert.ok(
    (state.spellPool[definitionId] ?? 0) > 0,
    `${definitionId} must have an available pool copy`,
  );
  state.spellPool[definitionId] -= 1;
  const spell = tavernSpell(definitionId, instanceId);
  player.spellShop = spell;
  return spell;
}

function totalSpellCopies(state: GameState, definitionId: string): number {
  return (
    (state.spellPool[definitionId] ?? 0) +
    state.players.reduce(
      (total, player) =>
        total +
        [
          ...(player.spellShop ? [player.spellShop] : []),
          ...player.additionalSpellShop,
        ].filter((offer) => offer.definitionId === definitionId).length,
      0,
    )
  );
}

function keepOnlyOneOpponent(
  state: GameState,
  opponentBoard: BoardMinionInstance[],
): PlayerState {
  const opponent = state.players.find((player) => !player.isHuman);
  assert.ok(opponent);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.additionalSpellShop = [];
    player.spellOnlyRefreshActive = false;
    player.frozen = false;
    if (player.id === opponent.id) {
      player.alive = true;
      player.health = 40;
      player.hand = [];
      player.board = opponentBoard;
    } else if (!player.isHuman) {
      player.alive = false;
      player.health = 0;
      player.hand = [];
      player.board = [];
    }
  }
  return opponent;
}

function firstXorshiftRandom(seed: number): number {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x1_0000_0000;
}

function seedForRoll(roll: number, total: number): number {
  for (let seed = 1; seed < 1_000_000; seed += 1) {
    if (Math.floor(firstXorshiftRandom(seed) * total) === roll) {
      return seed;
    }
  }
  throw new Error(`Could not find deterministic seed for roll ${roll}/${total}`);
}

function controlledWeightedSpellDraw(rngState: number): GameState {
  const state = createGame(0x7100);
  const player = humanPlayer(state);
  player.gold = 1;
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
  state.spellPool["tavern-spell-new-sprout"] = 1;
  state.spellPool["tavern-spell-enchanted-lasso"] = 3;
  state.rngState = rngState;
  return gameReducer(state, { type: "REFRESH_SHOP" });
}

function legacyState(
  version: 5 | 6,
  seed: number,
): Record<string, unknown> {
  const current = createGame(seed);
  current.players.forEach((player, index) => {
    player.tavernTier = ((index % 6) + 1) as TavernTier;
  });
  humanPlayer(current).gold = 7;
  const legacy = jsonClone(current) as unknown as Record<string, unknown>;
  legacy.version = version;
  legacy.contentVersion =
    version === 5
      ? LEGACY_SCHEMA_5_CONTENT_VERSION
      : LEGACY_SCHEMA_6_CONTENT_VERSION;
  delete legacy.spellPool;
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  for (const player of players) {
    assert.ok(player !== null && typeof player === "object");
    const record = player as Record<string, unknown>;
    delete record.spellShop;
    delete record.maxGold;
    delete record.pendingNextTurnGold;
    delete record.freeRefreshes;
    delete record.tavernMinionAttackBonus;
    delete record.tavernMinionHealthBonus;
    delete record.nextCombatAttackBonus;
    delete record.nextCombatHealthBonus;
    delete record.nextCombatWinGold;
    delete record.nextCombatTieGold;
    delete record.nextTurnBoardAttackBonus;
    delete record.nextTurnBoardHealthBonus;
    delete record.nextTurnBoardBuffPulses;
    delete record.tavernBloodGemBarrageCount;
    delete record.tavernBloodGemBarrageAttack;
    delete record.tavernBloodGemBarrageHealth;
    delete record.backToBackBonus;
    delete record.tavernSpellAttackBonus;
    delete record.tavernSpellHealthBonus;
    delete record.tavernTypeBuffs;
    delete record.rideTheWindBuffs;
    delete record.elementalsPlayedThisTurn;
    delete record.nextCombatBeetles;
    delete record.ballerAttackBonus;
    delete record.ballerHealthBonus;
    delete record.deepBlueBonus;
    if (version === 5) {
      delete record.bloodGemAttack;
      delete record.bloodGemHealth;
    }
  }
  removePostSchema7MinionFields(legacy);
  return legacy;
}

function removePostSchema7MinionFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(removePostSchema7MinionFields);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "minion" || record.kind === "tripleReward") {
    delete record.bloodGemAttack;
    delete record.bloodGemHealth;
    delete record.playableFromRound;
    delete record.temporaryAttack;
    delete record.temporaryHealth;
    delete record.temporaryTaunt;
    delete record.temporaryDivineShield;
    delete record.temporaryCrabDeathrattles;
    delete record.destroyAfterPlayThroughRound;
  }
  Object.values(record).forEach(removePostSchema7MinionFields);
}

function removeSchema9MinionFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(removeSchema9MinionFields);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "minion" || record.kind === "tripleReward") {
    delete record.temporaryAttack;
    delete record.temporaryHealth;
    delete record.temporaryTaunt;
    delete record.temporaryDivineShield;
    delete record.temporaryCrabDeathrattles;
    delete record.destroyAfterPlayThroughRound;
  }
  Object.values(record).forEach(removeSchema9MinionFields);
}

function assertSchema9MinionFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertSchema9MinionFields);
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "minion" || record.kind === "tripleReward") {
    assert.equal(typeof record.bloodGemAttack, "number");
    assert.equal(typeof record.bloodGemHealth, "number");
    assert.equal(typeof record.temporaryAttack, "number");
    assert.equal(typeof record.temporaryHealth, "number");
    assert.equal(typeof record.temporaryTaunt, "boolean");
    assert.equal(typeof record.temporaryDivineShield, "boolean");
    assert.equal(typeof record.temporaryCrabDeathrattles, "number");
  }
  Object.values(record).forEach(assertSchema9MinionFields);
}

function legacySchema8State(seed: number): Record<string, unknown> {
  const current = createGame(seed);
  current.players.forEach((player, index) => {
    player.tavernTier = ((index % 6) + 1) as TavernTier;
  });
  humanPlayer(current).gold = 7;
  const legacy = jsonClone(current) as unknown as Record<string, unknown>;
  legacy.version = 8;
  legacy.contentVersion = LEGACY_SCHEMA_8_CONTENT_VERSION;
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  for (const player of players) {
    assert.ok(player !== null && typeof player === "object");
    const record = player as Record<string, unknown>;
    delete record.tavernSpellAttackBonus;
    delete record.tavernSpellHealthBonus;
    delete record.tavernTypeBuffs;
    delete record.rideTheWindBuffs;
    delete record.elementalsPlayedThisTurn;
    delete record.nextCombatBeetles;
    delete record.ballerAttackBonus;
    delete record.ballerHealthBonus;
    delete record.deepBlueBonus;
  }
  removeSchema9MinionFields(legacy);
  return legacy;
}

function assertMigratedSchema11(value: unknown): asserts value is GameState {
  assert.ok(value !== null && typeof value === "object");
  const migrated = value as GameState;
  assert.equal(migrated.version, 11);
  assert.equal(migrated.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(humanPlayer(migrated).gold, 7);
  assert.equal(
    new Set(
      migrated.players.map((player) => player.spellShop?.instanceId),
    ).size,
    migrated.players.length,
  );
  for (const player of migrated.players) {
    assert.ok(player.spellShop);
    assert.ok(player.spellShop.tier <= player.tavernTier);
    assert.equal(player.armor, 0);
    assert.equal(player.heroPowerId, null);
    assert.deepEqual(player.additionalSpellShop, []);
    assert.equal(player.spellOnlyRefreshActive, false);
    assert.equal(player.maxGold, 10);
    assert.equal(player.pendingNextTurnGold, 0);
    assert.equal(player.freeRefreshes, 0);
    assert.equal(player.helpfulRefreshes, 0);
    assert.equal(player.lastHelpfulRefreshKind, null);
    assert.equal(player.tavernMinionAttackBonus, 0);
    assert.equal(player.tavernMinionHealthBonus, 0);
    assert.equal(player.nextCombatAttackBonus, 0);
    assert.equal(player.nextCombatHealthBonus, 0);
    assert.equal(player.nextCombatSetEnemyHealthToOne, 0);
    assert.deepEqual(player.nextCombatDoubleLeftmostAttack, []);
    assert.equal(player.nextCombatWinGold, 0);
    assert.equal(player.nextCombatTieGold, 0);
    assert.equal(player.nextTurnBoardAttackBonus, 0);
    assert.equal(player.nextTurnBoardHealthBonus, 0);
    assert.equal(player.nextTurnBoardBuffPulses, 0);
    assert.equal(player.tavernBloodGemBarrageCount, 0);
    assert.equal(player.tavernBloodGemBarrageAttack, 0);
    assert.equal(player.tavernBloodGemBarrageHealth, 0);
    assert.equal(player.backToBackBonus, 0);
    assert.equal(player.tavernSpellAttackBonus, 0);
    assert.equal(player.tavernSpellHealthBonus, 0);
    assert.deepEqual(player.tavernTypeBuffs, []);
    assert.deepEqual(player.rideTheWindBuffs, []);
    assert.equal(player.elementalsPlayedThisTurn, 0);
    assert.equal(player.nextCombatBeetles, 0);
    assert.equal(player.ballerAttackBonus, 1);
    assert.equal(player.ballerHealthBonus, 1);
    assert.equal(player.deepBlueBonus, 0);
    assert.equal(player.undeadArmyAttackBonus, 0);
    assert.equal(player.undeadArmyHealthBonus, 0);
  }
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(migrated, definition.id),
      tavernSpellIsAvailable(definition, migrated.activeTribes)
        ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
        : 0,
      `${definition.name} must conserve its shared pool during migration`,
    );
  }
  assertSchema9MinionFields(migrated);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated)), migrated);
}

test("the playable Tavern Spell pool covers every current Solo Tier 1-3 spell", () => {
  const expected = [
    ["tavern-spell-chefs-choice", "BG28_518", 2, 2, "主厨甄选", []],
    ["tavern-spell-hasty-excavation", "BG28_571", 2, 3, "拼命发掘", []],
    ["tavern-spell-search-the-past", "BG34_330", 2, 2, "搜寻时光", []],
    ["tavern-spell-planar-telescope", "BG28_521", 3, 4, "位面望远镜", []],
    ["tavern-spell-hubris", "BG28_884", 3, 1, "自负", []],
    ["tavern-spell-careful-mutation", "BG30_804", 3, 1, "稳健异变", []],
    ["tavern-spell-time-management", "BG31_881", 3, 4, "时间管理", []],
    [
      "tavern-spell-stacked-avalanche",
      "BG33_899",
      3,
      2,
      "累叠雪崩",
      ["elemental"],
    ],
    [
      "tavern-spell-blood-gem-barrage",
      "BG34_689",
      3,
      1,
      "鲜血宝石弹幕",
      ["quilboar"],
    ],
  ] as const;

  for (const [
    definitionId,
    cardId,
    tier,
    cost,
    name,
    associatedTribes,
  ] of expected) {
    const definition = getTavernSpellDefinition(definitionId);
    assert.equal(definition.cardId, cardId);
    assert.equal(definition.tier, tier);
    assert.equal(definition.cost, cost);
    assert.equal(definition.name, name);
    assert.deepEqual(
      (definition as { associatedTribes?: readonly string[] })
        .associatedTribes ?? [],
      associatedTribes,
    );
  }

  assert.deepEqual(
    Object.fromEntries(
      [1, 2, 3].map((tier) => [
        tier,
        TAVERN_SPELL_DEFINITIONS.filter(
          (definition) => definition.tier === tier,
        ).length,
      ]),
    ),
    { 1: 8, 2: 6, 3: 16 },
  );
});

test("the playable Tavern Spell pool covers all 16 current Solo Tier 4 spells", () => {
  const expected = [
    [
      "tavern-spell-clone-horn",
      "BG28_601",
      4,
      "克隆螺号",
      ["murloc"],
    ],
    [
      "tavern-spell-beetle-blessing",
      "BG28_603",
      1,
      "甲虫恩泽",
      ["beast"],
    ],
    [
      "tavern-spell-slimy-seafood",
      "BG28_606",
      2,
      "恶鳞套餐",
      ["naga"],
    ],
    [
      "tavern-spell-gem-confiscation",
      "BG28_698",
      1,
      "查抄宝石",
      ["quilboar"],
    ],
    [
      "tavern-spell-back-to-back",
      "BG35_952",
      1,
      "背靠背",
      [],
    ],
    [
      "tavern-spell-deepwater-clan",
      "BG35_149",
      2,
      "深水族群",
      ["murloc"],
    ],
    [
      "tavern-spell-defenders-rites",
      "BG28_825",
      2,
      "防御者的仪式",
      [],
    ],
    [
      "tavern-spell-misplaced-tea-set",
      "BG28_888",
      2,
      "乱放的茶具",
      [],
    ],
    [
      "tavern-spell-natural-blessing",
      "BG28_845",
      4,
      "自然祝福",
      [],
    ],
    [
      "tavern-spell-shifting-tide",
      "BG32_815",
      1,
      "变换之潮",
      ["naga"],
    ],
    [
      "tavern-spell-temperature-shift",
      "BG31_819",
      4,
      "寒热骤变",
      ["elemental"],
    ],
    [
      "tavern-spell-ride-the-wind",
      "BG34_444",
      1,
      "乘借东风",
      ["elemental"],
    ],
    [
      "tavern-spell-stir-the-graveyard",
      "BG34_888",
      2,
      "惊扰墓穴",
      ["undead"],
    ],
    [
      "tavern-spell-blazing-inferno",
      "BG35_910",
      2,
      "燃焰",
      ["elemental"],
    ],
    [
      "tavern-spell-arcane-absorption",
      "BG35_911",
      1,
      "奥术吸收",
      ["elemental"],
    ],
    [
      "tavern-spell-eonars-favor",
      "BG35_912",
      2,
      "艾欧娜尔的眷顾",
      [],
    ],
  ] as const;

  for (const [
    definitionId,
    cardId,
    cost,
    name,
    associatedTribes,
  ] of expected) {
    const definition = getTavernSpellDefinition(definitionId);
    assert.equal(definition.cardId, cardId);
    assert.equal(definition.tier, 4);
    assert.equal(definition.cost, cost);
    assert.equal(definition.name, name);
    assert.deepEqual(definition.associatedTribes ?? [], associatedTribes);
  }

  assert.equal(
    TAVERN_SPELL_DEFINITIONS.filter(
      (definition) => definition.tier === 4,
    ).length,
    16,
  );
  assert.equal(TAVERN_SPELL_DEFINITIONS.length, 65);
});

test("the playable Tavern Spell pool covers all 14 current Solo Tier 5 spells", () => {
  const expected = [
    ["tavern-spell-armor-stash", "BG28_500", 3, "护甲储备", []],
    ["tavern-spell-overpowered", "BG28_573", 3, "优势压制", []],
    [
      "tavern-spell-slaughter",
      "BG28_604",
      2,
      "宰割",
      ["undead"],
    ],
    [
      "tavern-spell-corrupted-cupcakes",
      "BG28_607",
      4,
      "腐化糕点",
      ["demon"],
    ],
    ["tavern-spell-golden-touch", "BG28_830", 5, "点金之触", []],
    ["tavern-spell-saloons-finest", "BG28_849", 2, "顶尖好酒", []],
    ["tavern-spell-reserved-corpse", "BG28_882", 3, "预订遗体", []],
    [
      "tavern-spell-headhunter",
      "BG28_GIL_836",
      3,
      "猎头招聘",
      [],
    ],
    [
      "tavern-spell-sanctify",
      "BG33_817",
      1,
      "圣洁庇护",
      ["mech"],
    ],
    [
      "tavern-spell-nozdormus-progeny",
      "BG34_889",
      2,
      "诺兹多姆的子嗣",
      ["dragon"],
    ],
    [
      "tavern-spell-wave-of-gold",
      "BG34_990",
      2,
      "黄金狂潮",
      ["pirate"],
    ],
    [
      "tavern-spell-queens-command",
      "BG35_922",
      2,
      "女王的命令",
      ["naga"],
    ],
    [
      "tavern-spell-invoke-the-devourer",
      "EBG_Spell_032",
      4,
      "祈请吞噬者",
      [],
    ],
    [
      "tavern-spell-unmasked-identity",
      "EBG_Spell_037",
      3,
      "身份揭晓",
      [],
    ],
  ] as const;

  for (const [
    definitionId,
    cardId,
    cost,
    name,
    associatedTribes,
  ] of expected) {
    const definition = getTavernSpellDefinition(definitionId);
    assert.equal(definition.cardId, cardId);
    assert.equal(definition.tier, 5);
    assert.equal(definition.cost, cost);
    assert.equal(definition.name, name);
    assert.deepEqual(definition.associatedTribes ?? [], associatedTribes);
  }

  assert.deepEqual(
    Object.fromEntries(
      [1, 2, 3, 4, 5, 6].map((tier) => [
        tier,
        TAVERN_SPELL_DEFINITIONS.filter(
          (definition) => definition.tier === tier,
        ).length,
      ]),
    ),
    { 1: 8, 2: 6, 3: 16, 4: 16, 5: 14, 6: 5 },
  );
});

test("the playable Tavern Spell pool covers all five current Solo Tier 6 spells", () => {
  const expected = [
    ["tavern-spell-azerite-empowerment", "BG28_169", 4, "艾泽里特强化"],
    ["tavern-spell-perfect-vision", "BG28_838", 2, "完美形象"],
    [
      "tavern-spell-knockoff-wisdomball",
      "BG30_802",
      4,
      "冒牌的智慧之球",
    ],
    [
      "tavern-spell-eyes-of-earth-mother",
      "EBG_Spell_017",
      4,
      "大地母亲之眼",
    ],
    [
      "tavern-spell-lost-staff-of-hamuul",
      "EBG_Spell_038",
      2,
      "哈缪尔遗失的法杖",
    ],
  ] as const;

  for (const [definitionId, cardId, cost, name] of expected) {
    const definition = getTavernSpellDefinition(definitionId);
    assert.equal(definition.cardId, cardId);
    assert.equal(definition.tier, 6);
    assert.equal(definition.cost, cost);
    assert.equal(definition.name, name);
  }
});

test("Tavern Spell support metadata exposes the two bounded local approximations", () => {
  const partial = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) => definition.effectSupport === "partial",
  );
  assert.deepEqual(
    partial.map((definition) => definition.cardId).sort(),
    ["BG30_802", "EBG_Spell_037"],
  );
  assert.match(
    getTavernSpellDefinition(
      "tavern-spell-unmasked-identity",
    ).implementationNote ?? "",
    /4个已完整支持的英雄技能/u,
  );
  assert.match(
    getTavernSpellDefinition(
      "tavern-spell-knockoff-wisdomball",
    ).implementationNote ?? "",
    /7星随从页面/u,
  );
  assert.equal(
    TAVERN_SPELL_DEFINITIONS.filter(
      (definition) => definition.effectSupport === "complete",
    ).length,
    63,
  );
});

test("Rime or Reason uses the exact 30 stat-granting Tavern Spell card IDs", () => {
  assert.equal(RIME_OR_REASON_STAT_GRANTING_CARD_IDS.length, 30);
  assert.deepEqual(
    [...RIME_OR_REASON_STAT_GRANTING_CARD_IDS].sort(),
    [...STAT_GRANTING_TAVERN_SPELL_CARD_IDS].sort(),
  );
  assert.deepEqual(
    TAVERN_SPELL_DEFINITIONS.filter((definition) =>
      RIME_OR_REASON_STAT_GRANTING_CARD_IDS.some(
        (cardId) => cardId === definition.cardId,
      ),
    )
      .map((definition) => definition.cardId)
      .sort(),
    [...STAT_GRANTING_TAVERN_SPELL_CARD_IDS].sort(),
  );
});

test("the pinned pool exposes all nine ordinary Spellcraft definitions", () => {
  const expected = [
    [
      "spellcraft-crab-rider",
      "BG27_004t",
      1,
      "螃蟹坐骑",
      "crabRider",
      "friendly",
    ],
    [
      "spellcraft-sick-riffs",
      "BG26_501t",
      2,
      "精彩即兴",
      "sickRiffs",
      "friendly",
    ],
    [
      "spellcraft-anglers-lure",
      "BG23_004t",
      3,
      "钓客的诱饵",
      "anglersLure",
      "friendly",
    ],
    [
      "spellcraft-deep-blue-blues",
      "BG26_502t",
      3,
      "深沉蓝调",
      "deepBlueBlues",
      "friendly",
    ],
    [
      "spellcraft-escape-eruption",
      "BG30_117t",
      4,
      "躲避喷发",
      "escapeEruption",
      "none",
    ],
    [
      "spellcraft-rime-or-reason",
      "BG33_319t",
      4,
      "霜鳞之理",
      "rimeOrReason",
      "none",
    ],
    [
      "spellcraft-glowing-crown",
      "BG23_008t",
      5,
      "闪鳞头冠",
      "glowingCrown",
      "friendly",
    ],
    [
      "spellcraft-evolving-strategy",
      "BG31_920t",
      5,
      "战略迭代",
      "evolvingStrategy",
      "none",
    ],
    [
      "spellcraft-meditation",
      "BG32_835t",
      5,
      "冥想",
      "meditation",
      "none",
    ],
  ] as const;

  assert.equal(SPELLCRAFT_DEFINITIONS.length, expected.length);
  for (const [
    definitionId,
    cardId,
    sourceTier,
    name,
    effect,
    target,
  ] of expected) {
    const definition = getSpellcraftDefinition(definitionId);
    assert.equal(definition.cardId, cardId);
    assert.equal(definition.sourceTier, sourceTier);
    assert.equal(definition.name, name);
    assert.equal(definition.effect, effect);
    assert.equal(definition.target, target);
  }
});

test("playable Tavern Spell text removes client-only dynamic branches", () => {
  assert.deepEqual(
    Object.fromEntries(
      [
        "tavern-spell-fortify",
        "tavern-spell-pointy-arrow",
        "tavern-spell-healthy-bounty",
        "tavern-spell-hostile-bounty",
        "tavern-spell-sanctify",
        "tavern-spell-search-the-past",
        "tavern-spell-slimy-seafood",
        "tavern-spell-defenders-rites",
        "tavern-spell-arcane-absorption",
        "tavern-spell-azerite-empowerment",
        "tavern-spell-knockoff-wisdomball",
      ].map((definitionId) => {
        const definition = getTavernSpellDefinition(definitionId);
        return [definition.cardId, definition.description];
      }),
    ),
    {
      BG28_503: "使一个随从获得+3生命值和嘲讽。",
      EBG_Spell_014: "使一个随从获得+4攻击力。",
      BG33_811: "使四个友方随从获得+4生命值。",
      BG33_812: "使四个友方随从获得+4攻击力。",
      BG33_817: "使你具有圣盾的随从获得+6攻击力。",
      BG34_330:
        "发现一张你当前等级的随从牌，将其锁入你的手牌1个回合。",
      BG28_606: "随机获取3张塑造法术的法术牌。",
      BG28_825: "使一个友方随从获得+6/+6和嘲讽。",
      BG35_911:
        "使一个友方元素获得酒馆中生命值最高的随从的一半属性值。",
      BG28_169: "使你的随从获得+2/+2，触发两次。",
      BG30_802: "你的下2次刷新均为有用的刷新！（还剩2次！）",
    },
  );
  assert.ok(
    TAVERN_SPELL_DEFINITIONS.every(
      (definition) => !definition.description.includes("\n"),
    ),
  );
});

test("every player gets an independent, tier-legal Tavern Spell offer", () => {
  const state = createGame(0x7110);
  const offers = state.players.map((player) => {
    assert.ok(player.spellShop);
    assert.equal(player.spellShop.spellFamily, "tavern");
    assert.ok(player.spellShop.tier <= player.tavernTier);
    return player.spellShop.instanceId;
  });
  assert.equal(new Set(offers).size, state.players.length);

  for (let tier = 1; tier <= 6; tier += 1) {
    const tierState = createGame(0x7120 + tier);
    const player = humanPlayer(tierState);
    player.tavernTier = tier as TavernTier;
    player.gold = 20;
    const refreshed = gameReducer(tierState, { type: "REFRESH_SHOP" });
    const offer = humanPlayer(refreshed).spellShop;
    assert.ok(offer);
    assert.ok(offer.tier <= tier);
  }
});

test("the shared Tavern Spell pool is tier-weighted and reserves shop offers", () => {
  const state = createGame(0x7130);
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(state, definition.id),
      tavernSpellIsAvailable(definition, state.activeTribes)
        ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
        : 0,
    );
  }

  const lowRoll = controlledWeightedSpellDraw(seedForRoll(0, 4));
  assert.equal(
    humanPlayer(lowRoll).spellShop?.definitionId,
    "tavern-spell-new-sprout",
  );
  for (const roll of [1, 2, 3]) {
    const weighted = controlledWeightedSpellDraw(seedForRoll(roll, 4));
    assert.equal(
      humanPlayer(weighted).spellShop?.definitionId,
      "tavern-spell-enchanted-lasso",
      `weighted copy ${roll} should select the three-copy spell`,
    );
  }
});

test("buying a Tavern Spell returns its pool copy immediately", () => {
  const state = createGame(0x7140);
  const player = humanPlayer(state);
  player.gold = 5;
  player.hand = [];
  const offer = replaceSpellOffer(
    state,
    player,
    "tavern-spell-tavern-dish-banana",
  );
  const beforePool = state.spellPool[offer.definitionId];

  const bought = gameReducer(state, { type: "BUY_TAVERN_SPELL" });
  const nextPlayer = humanPlayer(bought);
  assert.equal(nextPlayer.gold, 4);
  assert.equal(nextPlayer.spellShop, null);
  assert.equal(nextPlayer.hand.length, 1);
  assert.equal(nextPlayer.hand[0].instanceId, offer.instanceId);
  assert.equal(
    bought.spellPool[offer.definitionId],
    beforePool + 1,
  );
});

test("Tavern Spell purchases are atomic when gold or hand space is missing", () => {
  const underfunded = createGame(0x7150);
  const poorPlayer = humanPlayer(underfunded);
  poorPlayer.gold = 2;
  replaceSpellOffer(
    underfunded,
    poorPlayer,
    "tavern-spell-strike-oil",
  );
  assert.deepEqual(
    gameReducer(underfunded, { type: "BUY_TAVERN_SPELL" }),
    underfunded,
  );

  const fullHand = createGame(0x7151);
  const fullPlayer = humanPlayer(fullHand);
  const template = fullPlayer.shop[0];
  assert.ok(template);
  fullPlayer.gold = 10;
  fullPlayer.hand = Array.from({ length: 10 }, (_, index) =>
    definitionMinion(
      template,
      template.definitionId,
      `full-hand-${index}`,
    ),
  );
  replaceSpellOffer(
    fullHand,
    fullPlayer,
    "tavern-spell-tavern-dish-banana",
  );
  assert.deepEqual(
    gameReducer(fullHand, { type: "BUY_TAVERN_SPELL" }),
    fullHand,
  );
});

test("Hasty Excavation is bought with nonlethal Health and then grants Gold", () => {
  const state = createGame(0x7152);
  const player = humanPlayer(state);
  player.health = 4;
  player.gold = 0;
  player.hand = [];
  const offer = replaceSpellOffer(
    state,
    player,
    "tavern-spell-hasty-excavation",
  );
  const poolBefore = state.spellPool[offer.definitionId];
  assert.deepEqual(getTavernSpellPurchaseQuote(state, player.id), {
    currency: "health",
    cost: 3,
    affordable: true,
  });

  let next = gameReducer(state, { type: "BUY_TAVERN_SPELL" });
  let nextPlayer = humanPlayer(next);
  assert.equal(nextPlayer.health, 1);
  assert.equal(nextPlayer.gold, 0);
  assert.equal(nextPlayer.hand[0]?.instanceId, offer.instanceId);
  assert.equal(next.spellPool[offer.definitionId], poolBefore + 1);

  next = gameReducer(next, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: offer.instanceId,
  });
  nextPlayer = humanPlayer(next);
  assert.equal(nextPlayer.health, 1);
  assert.equal(nextPlayer.gold, 1);
  assert.equal(nextPlayer.hand.length, 0);

  const lethal = createGame(0x7153);
  const lethalPlayer = humanPlayer(lethal);
  lethalPlayer.health = 3;
  lethalPlayer.gold = 10;
  lethalPlayer.hand = [];
  replaceSpellOffer(
    lethal,
    lethalPlayer,
    "tavern-spell-hasty-excavation",
  );
  assert.equal(
    getTavernSpellPurchaseQuote(lethal, lethalPlayer.id)?.affordable,
    false,
  );
  assert.deepEqual(
    gameReducer(lethal, { type: "BUY_TAVERN_SPELL" }),
    lethal,
  );
});

test("refresh replaces the spell slot while Freeze preserves it for one turn", () => {
  const refreshState = createGame(0x7160);
  const refreshPlayer = humanPlayer(refreshState);
  refreshPlayer.gold = 10;
  refreshPlayer.frozen = true;
  const oldOfferId = refreshPlayer.spellShop?.instanceId;
  assert.ok(oldOfferId);
  const refreshed = gameReducer(refreshState, { type: "REFRESH_SHOP" });
  assert.equal(humanPlayer(refreshed).gold, 9);
  assert.equal(humanPlayer(refreshed).frozen, false);
  assert.notEqual(
    humanPlayer(refreshed).spellShop?.instanceId,
    oldOfferId,
  );

  let frozen = createGame(0x7161);
  const frozenOfferId = humanPlayer(frozen).spellShop?.instanceId;
  const frozenMinionIds = humanPlayer(frozen).shop.map(
    (minion) => minion.instanceId,
  );
  assert.ok(frozenOfferId);
  frozen = gameReducer(frozen, { type: "TOGGLE_FREEZE" });
  frozen = gameReducer(frozen, { type: "END_TURN" });
  frozen = gameReducer(frozen, { type: "CONTINUE" });
  assert.equal(humanPlayer(frozen).frozen, false);
  assert.equal(
    humanPlayer(frozen).spellShop?.instanceId,
    frozenOfferId,
  );
  assert.deepEqual(
    humanPlayer(frozen).shop.map((minion) => minion.instanceId),
    frozenMinionIds,
  );
});

test("targeted and targetless Tavern Spells cast through distinct legal paths", () => {
  let state = createGame(0x7170);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "spell-target", {
      attack: 3,
      health: 4,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "fortify"),
    tavernSpell("tavern-spell-tavern-coin", "coin"),
  ];
  player.gold = 2;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "fortify",
    targetInstanceId: "spell-target",
  });
  player = humanPlayer(state);
  assert.equal(player.board[0].health, 7);
  assert.equal(player.board[0].taunt, true);
  assert.equal(player.tavernSpellsCastThisTurn, 1);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "coin",
  });
  player = humanPlayer(state);
  assert.equal(player.gold, 3);
  assert.equal(player.hand.length, 0);
  assert.equal(player.tavernSpellsCastThisTurn, 2);
});

test("spells that say any minion can target Tavern offers", () => {
  let state = createGame(0x7171);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [];
  player.shop = [
    definitionMinion(template, template.definitionId, "shop-buff-target", {
      attack: 2,
      health: 3,
      taunt: false,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "shop-fortify"),
    tavernSpell("tavern-spell-defenders-rites", "friendly-only-rites"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "shop-fortify",
    targetInstanceId: "shop-buff-target",
  });
  player = humanPlayer(state);
  assert.equal(player.shop[0].health, 6);
  assert.equal(player.shop[0].taunt, true);
  assert.equal(player.hand.length, 1);

  const beforeFriendlyOnlyCast = state;
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "friendly-only-rites",
    targetInstanceId: "shop-buff-target",
  });
  assert.deepEqual(state, beforeFriendlyOnlyCast);
});

test("Chef's Choice draws a different matching type or gives a Consolation Coin", () => {
  let state = createGame(0x7173);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  state.activeTribes = [
    "beast",
    "mech",
    "elemental",
    "murloc",
    "quilboar",
  ];
  player.tavernTier = 2;
  player.board = [
    definitionMinion(template, "BG27_004", "chef-beast-target"),
  ];
  player.hand = [
    tavernSpell("tavern-spell-chefs-choice", "chef-choice"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG26_805 = 1;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "chef-choice",
    targetInstanceId: "chef-beast-target",
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 1);
  assert.equal(player.hand[0]?.kind, "minion");
  assert.equal(player.hand[0]?.definitionId, "BG26_805");
  assert.equal(state.pool.BG26_805, 0);

  const empty = createGame(0x7174);
  const emptyPlayer = humanPlayer(empty);
  const emptyTemplate = emptyPlayer.shop[0];
  assert.ok(emptyTemplate);
  empty.activeTribes = [...state.activeTribes];
  emptyPlayer.board = [
    definitionMinion(
      emptyTemplate,
      "BG27_004",
      "chef-empty-target",
    ),
  ];
  emptyPlayer.hand = [
    tavernSpell("tavern-spell-chefs-choice", "chef-empty"),
  ];
  emptyPlayer.gold = 2;
  for (const definitionId of Object.keys(empty.pool)) {
    empty.pool[definitionId] = 0;
  }
  const compensated = gameReducer(empty, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "chef-empty",
    targetInstanceId: "chef-empty-target",
  });
  const compensatedPlayer = humanPlayer(compensated);
  assert.equal(compensatedPlayer.gold, 2);
  assert.equal(compensatedPlayer.hand.length, 1);
  assert.equal(compensatedPlayer.hand[0]?.kind, "consolationCoin");
  assert.equal(compensatedPlayer.hand[0]?.cardId, "BG28_521t");
  assert.equal(compensatedPlayer.tavernSpellsCastThisTurn, 1);
  const paid = gameReducer(compensated, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: compensatedPlayer.hand[0].instanceId,
  });
  assert.equal(humanPlayer(paid).gold, 3);
  assert.equal(humanPlayer(paid).hand.length, 0);
  assert.equal(humanPlayer(paid).tavernSpellsCastThisTurn, 1);
});

test("Planar Telescope discovers only the majority minion type", () => {
  let state = createGame(0x7175);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  state.activeTribes = [
    "beast",
    "murloc",
    "mech",
    "elemental",
    "quilboar",
  ];
  player.tavernTier = 2;
  player.board = [
    definitionMinion(template, "BG27_004", "majority-beast-one"),
    definitionMinion(template, "BG31_803", "majority-beast-two"),
    definitionMinion(template, "BG32_330", "minority-murloc"),
  ];
  player.hand = [
    tavernSpell("tavern-spell-planar-telescope", "telescope"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG26_805 = 1;
  state.pool.BG22_202 = 1;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "telescope",
  });
  const pending = state.pendingInteraction;
  assert.equal(pending?.kind, "discover");
  assert.ok(pending?.kind === "discover");
  assert.deepEqual(
    pending.options.map((option) => option.definitionId),
    ["BG26_805"],
  );
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand[0]?.definitionId, "BG26_805");
  assert.equal(state.pool.BG22_202, 1);

  const noCandidate = createGame(0x7176);
  const noCandidatePlayer = humanPlayer(noCandidate);
  const noCandidateTemplate = noCandidatePlayer.shop[0];
  assert.ok(noCandidateTemplate);
  noCandidate.activeTribes = [...state.activeTribes];
  noCandidatePlayer.board = [
    definitionMinion(
      noCandidateTemplate,
      "BG27_004",
      "telescope-empty-majority",
    ),
  ];
  noCandidatePlayer.hand = [
    tavernSpell(
      "tavern-spell-planar-telescope",
      "telescope-empty",
    ),
  ];
  for (const definitionId of Object.keys(noCandidate.pool)) {
    noCandidate.pool[definitionId] = 0;
  }
  const compensated = gameReducer(noCandidate, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "telescope-empty",
  });
  assert.equal(compensated.pendingInteraction, null);
  assert.equal(humanPlayer(compensated).hand.length, 1);
  assert.equal(
    humanPlayer(compensated).hand[0]?.kind,
    "consolationCoin",
  );
});

test("Search the Past locks an exact-Tier discover until the next Recruit turn", () => {
  let state = createGame(0x7176);
  let player = humanPlayer(state);
  state.activeTribes = [
    "beast",
    "murloc",
    "mech",
    "elemental",
    "quilboar",
  ];
  player.tavernTier = 2;
  player.board = [];
  player.hand = [
    tavernSpell("tavern-spell-search-the-past", "search-past"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG26_805 = 1;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "search-past",
  });
  const pending = state.pendingInteraction;
  assert.equal(pending?.kind, "discover");
  assert.ok(pending?.kind === "discover");
  assert.equal(pending.filter.exactTier, 2);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  player = humanPlayer(state);
  const locked = player.hand[0];
  assert.ok(locked?.kind === "minion");
  assert.equal(locked.playableFromRound, 2);
  assert.deepEqual(
    gameReducer(state, {
      type: "PLAY_HAND_CARD",
      cardInstanceId: locked.instanceId,
    }),
    state,
  );

  keepOnlyOneOpponent(state, []);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(state.round, 2);
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: locked.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 0);
  assert.equal(player.board[0]?.definitionId, "BG26_805");
});

test("AI leaves Search the Past minions locked instead of retrying them forever", () => {
  const state = createGame(0x7177);
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  for (const player of state.players) {
    player.gold = 0;
    player.shop = [];
    player.spellShop = null;
    player.hand = [];
    player.board = [];
  }
  const locked = definitionMinion(
    template,
    template.definitionId,
    "ai-locked-minion",
    { playableFromRound: state.round + 1 },
  );
  ai.hand = [locked];

  const combat = gameReducer(state, { type: "END_TURN" });
  const recruitedAi = combat.players.find(
    (player) => player.id === ai.id,
  );
  assert.ok(recruitedAi);
  assert.equal(recruitedAi.board.length, 0);
  assert.deepEqual(
    recruitedAi.hand.map((card) => card.instanceId),
    ["ai-locked-minion"],
  );
});

test("a Search the Past triple keeps the latest hand lock", () => {
  let state = createGame(0x7178);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  state.activeTribes = [
    "beast",
    "murloc",
    "mech",
    "elemental",
    "quilboar",
  ];
  player.tavernTier = 2;
  player.hand = [
    definitionMinion(template, "BG26_805", "triple-copy-one"),
    definitionMinion(template, "BG26_805", "triple-copy-two"),
    tavernSpell("tavern-spell-search-the-past", "triple-search"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG26_805 = 1;
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "triple-search",
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "discover");
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: pending.options[0].instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 1);
  assert.equal(player.hand[0]?.kind, "minion");
  assert.equal(
    player.hand[0]?.kind === "minion"
      ? player.hand[0].golden
      : false,
    true,
  );
  assert.equal(
    player.hand[0]?.kind === "minion"
      ? player.hand[0].playableFromRound
      : undefined,
    2,
  );
});

test("Natural Blessing buffs matching types across the board and Tavern", () => {
  let state = createGame(0x7172);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "board-beast", {
      attack: 1,
      health: 1,
      tribe: "beast",
      tribes: ["beast"],
    }),
    definitionMinion(template, template.definitionId, "board-neutral", {
      attack: 2,
      health: 2,
      tribe: "neutral",
      tribes: [],
    }),
    definitionMinion(template, template.definitionId, "board-all", {
      attack: 3,
      health: 3,
      tribe: "all",
      tribes: ["all"],
    }),
  ];
  player.shop = [
    definitionMinion(template, template.definitionId, "shop-beast", {
      attack: 4,
      health: 4,
      tribe: "beast",
      tribes: ["beast"],
    }),
    definitionMinion(template, template.definitionId, "shop-murloc", {
      attack: 5,
      health: 5,
      tribe: "murloc",
      tribes: ["murloc"],
    }),
    definitionMinion(template, template.definitionId, "shop-neutral", {
      attack: 6,
      health: 6,
      tribe: "neutral",
      tribes: [],
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-natural-blessing", "bless-beast"),
    tavernSpell("tavern-spell-natural-blessing", "bless-all"),
    tavernSpell("tavern-spell-natural-blessing", "bless-neutral"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "bless-beast",
    targetInstanceId: "shop-beast",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [4, 4],
      [2, 2],
      [6, 6],
    ],
  );
  assert.deepEqual(
    player.shop.map((minion) => [minion.attack, minion.health]),
    [
      [7, 7],
      [5, 5],
      [6, 6],
    ],
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "bless-all",
    targetInstanceId: "board-all",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [7, 7],
      [2, 2],
      [9, 9],
    ],
  );
  assert.deepEqual(
    player.shop.map((minion) => [minion.attack, minion.health]),
    [
      [10, 10],
      [8, 8],
      [6, 6],
    ],
  );

  const beforeNeutralBlessing = jsonClone(player);
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "bless-neutral",
    targetInstanceId: "shop-neutral",
  });
  player = humanPlayer(state);
  assert.deepEqual(player.board, beforeNeutralBlessing.board);
  assert.deepEqual(player.shop, beforeNeutralBlessing.shop);
});

test("illegal Tavern Spell targets never consume the card or increment casts", () => {
  const state = createGame(0x7180);
  const player = humanPlayer(state);
  const opponent = state.players.find(
    (candidate) => candidate.id !== state.humanPlayerId,
  );
  const template = player.shop[0];
  assert.ok(template);
  assert.ok(opponent);
  player.board = [
    definitionMinion(template, template.definitionId, "friendly-target"),
  ];
  opponent.board = [
    definitionMinion(template, template.definitionId, "enemy-target"),
  ];
  player.hand = [
    tavernSpell("tavern-spell-fortify", "invalid-fortify"),
    tavernSpell("tavern-spell-tavern-coin", "invalid-coin"),
  ];
  player.tavernSpellsCastThisTurn = 4;

  for (const action of [
    {
      type: "CAST_TAVERN_SPELL" as const,
      cardInstanceId: "invalid-fortify",
    },
    {
      type: "CAST_TAVERN_SPELL" as const,
      cardInstanceId: "invalid-fortify",
      targetInstanceId: "enemy-target",
    },
    {
      type: "CAST_TAVERN_SPELL" as const,
      cardInstanceId: "invalid-coin",
      targetInstanceId: "friendly-target",
    },
  ]) {
    assert.deepEqual(gameReducer(state, action), state);
  }
});

test("Careful Mutation preserves final stats while replacing identity and pool ownership", () => {
  let state = createGame(0x7181);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  state.activeTribes = [
    "beast",
    "murloc",
    "mech",
    "elemental",
    "quilboar",
  ];
  const target = definitionMinion(
    template,
    "BG27_004",
    "mutation-target",
    {
      attack: 11,
      health: 13,
      taunt: true,
      bloodGemAttack: 3,
      bloodGemHealth: 4,
      poolCopies: 1,
    },
  );
  player.board = [target];
  player.hand = [
    tavernSpell("tavern-spell-careful-mutation", "mutation"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG26_805 = 1;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "mutation",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const transformed = player.board[0];
  assert.equal(transformed.instanceId, "mutation-target");
  assert.equal(transformed.definitionId, "BG26_805");
  assert.equal(transformed.attack, 11);
  assert.equal(transformed.health, 13);
  assert.equal(transformed.bloodGemAttack, 0);
  assert.equal(transformed.bloodGemHealth, 0);
  assert.equal(
    transformed.taunt,
    getMinionDefinition("BG26_805").taunt === true,
  );
  assert.equal(state.pool.BG27_004, 1);
  assert.equal(state.pool.BG26_805, 0);

  const tierSix = definitionMinion(
    template,
    "BG33_885",
    "tier-six-mutation-target",
    { poolCopies: 1 },
  );
  player.board = [tierSix];
  player.shop = [];
  player.hand = [
    tavernSpell(
      "tavern-spell-careful-mutation",
      "tier-six-mutation",
    ),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG26_175 = 1;
  const mutation = tavernSpell(
    "tavern-spell-careful-mutation",
    "tier-six-mutation",
  );
  assert.deepEqual(
    getLegalTavernSpellTargetIds(
      state,
      player.id,
      mutation,
    ),
    ["tier-six-mutation-target"],
  );
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "tier-six-mutation",
    targetInstanceId: "tier-six-mutation-target",
  });
  player = humanPlayer(state);
  assert.equal(player.board[0].definitionId, "BG26_175");
  assert.equal(player.board[0].tier, 6);
  assert.equal(state.pool.BG33_885, 1);
  assert.equal(state.pool.BG26_175, 0);

  let shopState = createGame(0x71811);
  let shopPlayer = humanPlayer(shopState);
  const shopTemplate = shopPlayer.shop[0];
  assert.ok(shopTemplate);
  shopState.activeTribes = [...state.activeTribes];
  shopPlayer.tavernTier = 2;
  shopPlayer.tavernMinionAttackBonus = 2;
  shopPlayer.tavernMinionHealthBonus = 2;
  shopPlayer.shop = [
    definitionMinion(
      shopTemplate,
      "BG27_004",
      "shop-mutation-target",
      { attack: 7, health: 9, poolCopies: 1 },
    ),
  ];
  shopPlayer.hand = [
    tavernSpell(
      "tavern-spell-careful-mutation",
      "shop-mutation",
    ),
  ];
  for (const definitionId of Object.keys(shopState.pool)) {
    shopState.pool[definitionId] = 0;
  }
  shopState.pool.BG26_805 = 1;
  shopState = gameReducer(shopState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "shop-mutation",
    targetInstanceId: "shop-mutation-target",
  });
  shopPlayer = humanPlayer(shopState);
  assert.deepEqual(
    [shopPlayer.shop[0].attack, shopPlayer.shop[0].health],
    [9, 11],
    "the transformed Tavern minion keeps its old final stats and receives the persistent Tavern bonus again",
  );
});

test("Time Management resolves exactly once through either immediate or delayed choice", () => {
  let immediate = createGame(0x7182);
  let immediatePlayer = humanPlayer(immediate);
  const immediateTemplate = immediatePlayer.shop[0];
  assert.ok(immediateTemplate);
  immediatePlayer.board = [
    definitionMinion(
      immediateTemplate,
      immediateTemplate.definitionId,
      "time-now-target",
      { attack: 3, health: 5 },
    ),
  ];
  immediatePlayer.hand = [
    tavernSpell("tavern-spell-time-management", "time-now"),
  ];

  immediate = gameReducer(immediate, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "time-now",
  });
  const immediatePending = immediate.pendingInteraction;
  assert.equal(immediatePending?.kind, "tavernSpellChoice");
  assert.ok(immediatePending?.kind === "tavernSpellChoice");
  assert.equal(humanPlayer(immediate).tavernSpellsCastThisTurn, 0);
  assert.deepEqual(
    gameReducer(immediate, {
      type: "RESOLVE_INTERACTION",
      interactionId: immediatePending.interactionId,
      optionInstanceId: "not-a-choice",
    }),
    immediate,
  );
  immediate = gameReducer(immediate, {
    type: "RESOLVE_INTERACTION",
    interactionId: immediatePending.interactionId,
    optionInstanceId: "timeManagementNow",
  });
  immediatePlayer = humanPlayer(immediate);
  assert.equal(immediate.pendingInteraction, null);
  assert.deepEqual(
    [immediatePlayer.board[0].attack, immediatePlayer.board[0].health],
    [5, 7],
  );
  assert.equal(immediatePlayer.tavernSpellsCastThisTurn, 1);

  let delayed = createGame(0x7183);
  let delayedPlayer = humanPlayer(delayed);
  const delayedTemplate = delayedPlayer.shop[0];
  assert.ok(delayedTemplate);
  delayedPlayer.board = [
    definitionMinion(
      delayedTemplate,
      delayedTemplate.definitionId,
      "time-later-target",
      { attack: 2, health: 4 },
    ),
  ];
  delayedPlayer.hand = [
    tavernSpell("tavern-spell-time-management", "time-later"),
  ];
  delayed = gameReducer(delayed, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "time-later",
  });
  const delayedPending = delayed.pendingInteraction;
  assert.ok(delayedPending?.kind === "tavernSpellChoice");
  delayed = gameReducer(delayed, {
    type: "RESOLVE_INTERACTION",
    interactionId: delayedPending.interactionId,
    optionInstanceId: "timeManagementNextTurn",
  });
  delayedPlayer = humanPlayer(delayed);
  assert.deepEqual(
    [delayedPlayer.board[0].attack, delayedPlayer.board[0].health],
    [2, 4],
  );
  assert.deepEqual(
    [
      delayedPlayer.nextTurnBoardAttackBonus,
      delayedPlayer.nextTurnBoardHealthBonus,
      delayedPlayer.nextTurnBoardBuffPulses,
    ],
    [4, 4, 2],
  );

  keepOnlyOneOpponent(delayed, []);
  delayed = gameReducer(delayed, { type: "END_TURN" });
  delayed = gameReducer(delayed, { type: "CONTINUE" });
  delayedPlayer = humanPlayer(delayed);
  assert.deepEqual(
    [delayedPlayer.board[0].attack, delayedPlayer.board[0].health],
    [6, 8],
  );
  assert.deepEqual(
    [
      delayedPlayer.nextTurnBoardAttackBonus,
      delayedPlayer.nextTurnBoardHealthBonus,
      delayedPlayer.nextTurnBoardBuffPulses,
    ],
    [0, 0, 0],
  );
});

test("Stacked Avalanche performs a real sale before buffing the leftmost Elemental", () => {
  let state = createGame(0x7184);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const sold = definitionMinion(
    template,
    "BG27_004",
    "avalanche-sale",
    {
      attack: 7,
      health: 9,
      poolCopies: 1,
    },
  );
  const elemental = definitionMinion(
    template,
    "BG31_815",
    "avalanche-elemental",
    { attack: 2, health: 3 },
  );
  player.board = [sold, elemental];
  player.gold = 0;
  player.hand = [
    tavernSpell("tavern-spell-stacked-avalanche", "avalanche"),
  ];
  state.pool.BG27_004 = 0;
  assert.deepEqual(
    getLegalTavernSpellTargetIds(
      state,
      player.id,
      player.hand[0] as TavernSpellInstance,
    ),
    ["avalanche-sale"],
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "avalanche",
    targetInstanceId: "avalanche-sale",
  });
  player = humanPlayer(state);
  assert.equal(player.gold, sold.sellValue);
  assert.equal(state.pool.BG27_004, 1);
  assert.deepEqual(
    player.board.map((minion) => [
      minion.instanceId,
      minion.attack,
      minion.health,
    ]),
    [["avalanche-elemental", 9, 12]],
  );
});

test("Blood Gems remain separate from Tavern Spell cast counters", () => {
  const state = createGame(0x7190);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "gem-target", {
      attack: 5,
      health: 6,
    }),
  ];
  const gem: BloodGemSpellInstance = {
    kind: "bloodGem",
    instanceId: "standalone-blood-gem",
    definitionId: "blood-gem",
    cardId: "BG20_GEM",
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
  };
  player.hand = [gem];
  player.tavernSpellsCastThisTurn = 3;

  const cast = gameReducer(state, {
    type: "CAST_BLOOD_GEM",
    cardInstanceId: gem.instanceId,
    targetInstanceId: "gem-target",
  });
  const castPlayer = humanPlayer(cast);
  assert.equal(castPlayer.board[0].attack, 6);
  assert.equal(castPlayer.board[0].health, 7);
  assert.equal(castPlayer.tavernSpellsCastThisTurn, 3);
});

test("core stat and Tavern-buffing spells apply their live values", () => {
  let state = createGame(0x71a0);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "buff-one", {
      attack: 2,
      health: 3,
    }),
    definitionMinion(template, template.definitionId, "buff-two", {
      attack: 4,
      health: 5,
    }),
  ];
  player.shop = [
    definitionMinion(template, template.definitionId, "shop-one", {
      attack: 1,
      health: 1,
    }),
    definitionMinion(template, template.definitionId, "shop-two", {
      attack: 3,
      health: 2,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-tavern-dish-banana", "banana"),
    tavernSpell("tavern-spell-them-apples", "apples"),
    tavernSpell("tavern-spell-shiny-ring", "ring"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "banana",
    targetInstanceId: "buff-one",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "apples",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "ring",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [5, 6],
      [5, 6],
    ],
  );
  assert.deepEqual(
    player.shop.map((minion) => [minion.attack, minion.health]),
    [
      [2, 3],
      [4, 4],
    ],
  );
  assert.equal(player.tavernSpellsCastThisTurn, 3);
});

test("core economy spells track free refreshes, max Gold, and next-turn Gold", () => {
  let state = createGame(0x71b0);
  let player = humanPlayer(state);
  player.gold = 4;
  player.hand = [
    tavernSpell("tavern-spell-leaf-through-the-pages", "pages"),
    tavernSpell("tavern-spell-strike-oil", "oil"),
    tavernSpell("tavern-spell-careful-investment", "investment"),
  ];

  for (const cardInstanceId of ["pages", "oil", "investment"]) {
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId,
    });
  }
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 2);
  assert.equal(player.maxGold, 11);
  assert.equal(player.pendingNextTurnGold, 2);
  assert.equal(player.gold, 4);

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 1);
  assert.equal(player.gold, 4);

  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(player.gold, 6);
  assert.equal(player.pendingNextTurnGold, 0);
});

test("Hubris pays only the next combat result and clears every wager", () => {
  const scenarios = [
    { result: "win", copies: 2, reward: 6 },
    { result: "tie", copies: 1, reward: 1 },
    { result: "loss", copies: 1, reward: 0 },
  ] as const;

  for (const [index, scenario] of scenarios.entries()) {
    let state = createGame(0x71b1 + index);
    let player = humanPlayer(state);
    const template = player.shop[0];
    assert.ok(template);
    const humanBoard =
      scenario.result === "win"
        ? [
            definitionMinion(
              template,
              template.definitionId,
              `hubris-human-${index}`,
            ),
          ]
        : [];
    const opponentBoard =
      scenario.result === "loss"
        ? [
            definitionMinion(
              template,
              template.definitionId,
              `hubris-opponent-${index}`,
            ),
          ]
        : [];
    player.board = humanBoard;
    player.hand = Array.from({ length: scenario.copies }, (_, copy) =>
      tavernSpell(
        "tavern-spell-hubris",
        `hubris-${index}-${copy}`,
      ),
    );
    for (const card of [...player.hand]) {
      state = gameReducer(state, {
        type: "CAST_TAVERN_SPELL",
        cardInstanceId: card.instanceId,
      });
    }
    player = humanPlayer(state);
    assert.equal(player.nextCombatWinGold, scenario.copies * 3);
    assert.equal(player.nextCombatTieGold, scenario.copies);
    keepOnlyOneOpponent(state, opponentBoard);

    state = gameReducer(state, { type: "END_TURN" });
    player = humanPlayer(state);
    assert.equal(state.lastBattle?.resultForHuman, scenario.result);
    assert.equal(player.nextCombatWinGold, 0);
    assert.equal(player.nextCombatTieGold, 0);
    assert.equal(player.pendingNextTurnGold, scenario.reward);
    const rewards =
      state.lastBattle?.events.filter(
        (event) =>
          event.type === "goldReward" &&
          event.actorPlayerId === player.id,
      ) ?? [];
    assert.equal(rewards.length, scenario.reward > 0 ? 1 : 0);
    assert.equal(rewards[0]?.amount, scenario.reward || undefined);

    state = gameReducer(state, { type: "CONTINUE" });
    assert.equal(humanPlayer(state).gold, 4 + scenario.reward);
  }
});

test("Blood Gem Barrage uses current Blood Gem values on every real Tavern refill", () => {
  let state = createGame(0x71b4);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  state.activeTribes = [
    "quilboar",
    "beast",
    "mech",
    "elemental",
    "murloc",
  ];
  player.gold = 20;
  player.bloodGemAttack = 2;
  player.bloodGemHealth = 3;
  player.shop = [
    definitionMinion(template, "BG20_100", "pre-barrage-shop", {
      attack: 1,
      health: 1,
      poolCopies: 0,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-blood-gem-barrage", "barrage"),
  ];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG20_100 = 20;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "barrage",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.shop[0].attack, player.shop[0].health],
    [1, 1],
  );
  assert.deepEqual(
    [
      player.tavernBloodGemBarrageCount,
      player.tavernBloodGemBarrageAttack,
      player.tavernBloodGemBarrageHealth,
    ],
    [1, 0, 0],
  );

  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  const base = getMinionDefinition("BG20_100");
  assert.equal(player.shop.length, 3);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.attack === base.attack + 2 &&
        minion.health === base.health + 3 &&
        minion.bloodGemAttack === 2 &&
        minion.bloodGemHealth === 3,
    ),
  );

  player.bloodGemAttack = 7;
  player.bloodGemHealth = 8;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.attack === base.attack + 7 &&
        minion.health === base.health + 8 &&
        minion.bloodGemAttack === 7 &&
        minion.bloodGemHealth === 8,
    ),
    "later Blood Gem upgrades must change every Barrage trigger",
  );

  for (const [index, ai] of state.players
    .filter((candidate) => !candidate.isHuman)
    .entries()) {
    ai.gold = 0;
    ai.shop = [];
    ai.spellShop = null;
    ai.hand = [];
    ai.board = [];
    ai.alive = index === 0;
    ai.health = index === 0 ? 40 : 0;
  }
  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  const fullyFrozenStats = humanPlayer(state).shop.map((minion) => [
    minion.instanceId,
    minion.attack,
    minion.health,
  ]);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  assert.deepEqual(
    humanPlayer(state).shop.map((minion) => [
      minion.instanceId,
      minion.attack,
      minion.health,
    ]),
    fullyFrozenStats,
    "a full frozen Tavern must not retrigger Barrage",
  );

  player = humanPlayer(state);
  player.gold = 10;
  state = gameReducer(state, { type: "BUY_TAVERN_SPELL" });
  player = humanPlayer(state);
  assert.equal(player.spellShop, null);
  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  const spellOnlyFrozenStats = new Map(
    humanPlayer(state).shop.map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.ok(player.spellShop);
  for (const minion of player.shop) {
    const before = spellOnlyFrozenStats.get(minion.instanceId);
    assert.ok(before);
    assert.deepEqual(
      [minion.attack, minion.health],
      [before.attack + 7, before.health + 8],
      "refilling only the bought Tavern Spell slot must retrigger Barrage on every frozen minion",
    );
  }

  player = humanPlayer(state);
  player.gold = 10;
  state = gameReducer(state, { type: "BUY_MINION", shopIndex: 0 });
  state = gameReducer(state, { type: "TOGGLE_FREEZE" });
  const survivingFrozen = new Map(
    humanPlayer(state).shop.map((minion) => [
      minion.instanceId,
      { attack: minion.attack, health: minion.health },
    ]),
  );
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 3);
  for (const minion of player.shop) {
    const before = survivingFrozen.get(minion.instanceId);
    if (before) {
      assert.deepEqual(
        [minion.attack, minion.health],
        [before.attack + 7, before.health + 8],
      );
    } else {
      assert.deepEqual(
        [minion.bloodGemAttack, minion.bloodGemHealth],
        [7, 8],
      );
    }
  }
});

test("multiple Blood Gem Barrages preserve Meditation bonuses across a JSON round-trip", () => {
  let state = createGame(0x71b5);
  let player = humanPlayer(state);
  player.gold = 20;
  player.bloodGemAttack = 2;
  player.bloodGemHealth = 3;
  player.hand = [
    spellcraft("spellcraft-meditation", "barrage-meditation"),
    tavernSpell("tavern-spell-blood-gem-barrage", "barrage-one"),
    tavernSpell("tavern-spell-blood-gem-barrage", "barrage-two"),
  ];

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "barrage-meditation",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "barrage-one",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "barrage-two",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [
      player.tavernBloodGemBarrageCount,
      player.tavernBloodGemBarrageAttack,
      player.tavernBloodGemBarrageHealth,
    ],
    [2, 2, 2],
    "each cast must preserve one Meditation bonus in addition to its live Blood Gem value",
  );

  const normalized = normalizePersistedGameState(jsonClone(state));
  assert.ok(normalized !== null && typeof normalized === "object");
  state = normalized as GameState;
  player = humanPlayer(state);
  assert.deepEqual(
    [
      player.tavernBloodGemBarrageCount,
      player.tavernBloodGemBarrageAttack,
      player.tavernBloodGemBarrageHealth,
    ],
    [2, 2, 2],
  );

  player.gold = 20;
  player.bloodGemAttack = 5;
  player.bloodGemHealth = 7;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.bloodGemAttack === 12 &&
        minion.bloodGemHealth === 16,
    ),
    "two Barrages must use 2 x current Blood Gem values plus both banked Meditation bonuses",
  );
});

test("v23 Blood Gem Barrage saves migrate conservatively without losing visible stats", () => {
  const legacy = jsonClone(createGame(0x71b6)) as GameState;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V23;
  for (const player of legacy.players) {
    delete (player as Partial<PlayerState>).tavernBloodGemBarrageCount;
  }
  const legacyPlayer = humanPlayer(legacy);
  legacyPlayer.bloodGemAttack = 5;
  legacyPlayer.bloodGemHealth = 7;
  legacyPlayer.tavernBloodGemBarrageAttack = 13;
  legacyPlayer.tavernBloodGemBarrageHealth = 17;

  const migrated = migrateSchema11GameState(legacy);
  assert.ok(migrated !== null && typeof migrated === "object");
  let state = migrated as GameState;
  let player = humanPlayer(state);
  assert.equal(state.contentVersion, CURRENT_ROSTER_VERSION);
  assert.deepEqual(
    [
      player.tavernBloodGemBarrageCount,
      player.tavernBloodGemBarrageAttack,
      player.tavernBloodGemBarrageHealth,
    ],
    [1, 8, 10],
    "v23 aggregate stats can only prove one cast, so migration must preserve the remainder as a fixed bonus",
  );
  assert.deepEqual(
    [
      player.tavernBloodGemBarrageCount * player.bloodGemAttack +
        player.tavernBloodGemBarrageAttack,
      player.tavernBloodGemBarrageCount * player.bloodGemHealth +
        player.tavernBloodGemBarrageHealth,
    ],
    [13, 17],
  );

  player.gold = 20;
  player.bloodGemAttack = 6;
  player.bloodGemHealth = 9;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.ok(player.shop.length > 0);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.bloodGemAttack === 14 &&
        minion.bloodGemHealth === 19,
    ),
  );
});

test("v24 saves migrate to v25 while refreshing Queen's Guard support and preserving persistent state", () => {
  const legacy = jsonClone(createGame(0x71b7)) as GameState;
  legacy.contentVersion = LEGACY_SCHEMA_11_CONTENT_VERSION_V24;
  const legacyPlayer = humanPlayer(legacy);
  const template = legacyPlayer.shop[0];
  assert.ok(template);
  const guard = definitionMinion(
    template,
    "BG34_926",
    "legacy-golden-queen-guard",
    {
      golden: true,
      cardId: "BG34_926",
      description: "战吼，亡语，进击：施放女王的命令。",
      effectSupport: "partial",
      attack: 37,
      health: 41,
    },
  );
  legacyPlayer.board = [guard];
  legacyPlayer.tavernSpellAttackBonus = 4;
  legacyPlayer.tavernSpellHealthBonus = 5;
  legacyPlayer.nextTavernSpellDiscount = 3;

  const migrated = migrateSchema11GameState(
    jsonClone(legacy),
  );
  assert.ok(migrated !== null && typeof migrated === "object");
  const state = migrated as GameState;
  const player = humanPlayer(state);
  const migratedGuard = player.board[0];
  assert.equal(state.contentVersion, CURRENT_ROSTER_VERSION);
  assert.equal(migratedGuard.instanceId, guard.instanceId);
  assert.equal(migratedGuard.effectSupport, "complete");
  assert.equal(migratedGuard.cardId, "BG34_926_G");
  assert.equal(
    migratedGuard.description,
    "战吼，亡语，进击：施放女王的命令，触发两次。",
  );
  assert.deepEqual(
    [migratedGuard.attack, migratedGuard.health],
    [37, 41],
  );
  assert.deepEqual(
    [
      player.tavernSpellAttackBonus,
      player.tavernSpellHealthBonus,
      player.nextTavernSpellDiscount,
    ],
    [4, 5, 3],
  );

  const normalized = normalizePersistedGameState(
    jsonClone(state),
  );
  assert.ok(normalized !== null && typeof normalized === "object");
  assert.equal(
    humanPlayer(normalized as GameState).board[0].cardId,
    "BG34_926_G",
  );
});

test("Azerite Empowerment applies two full Tavern Spell bonus pulses", () => {
  let state = createGame(0x71b7);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG20_100", "azerite-target", {
      attack: 1,
      health: 2,
      poolCopies: 0,
    }),
  ];
  player.tavernSpellAttackBonus = 1;
  player.tavernSpellHealthBonus = 2;
  player.hand = [
    tavernSpell(
      "tavern-spell-azerite-empowerment",
      "azerite-empowerment",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "azerite-empowerment",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [7, 10],
    "each +2/+2 pulse must independently include the +1/+2 Tavern Spell bonus",
  );
  assert.equal(player.tavernSpellsCastThisTurn, 1);
});

test("Back to Back repeats the complete buff, including Tavern Spell bonuses", () => {
  let state = createGame(0x71b8);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, "BG20_100", "back-to-back-target", {
      attack: 1,
      health: 2,
      poolCopies: 0,
    }),
  ];
  player.tavernSpellAttackBonus = 1;
  player.tavernSpellHealthBonus = 2;
  player.hand = [
    tavernSpell("tavern-spell-back-to-back", "back-to-back-one"),
    tavernSpell("tavern-spell-back-to-back", "back-to-back-two"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "back-to-back-one",
    targetInstanceId: "back-to-back-target",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [6, 8],
  );
  assert.equal(player.backToBackBonus, 4);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "back-to-back-two",
    targetInstanceId: "back-to-back-target",
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [16, 20],
    "the second cast must repeat the full +5/+6 modified buff twice",
  );
  assert.equal(player.backToBackBonus, 8);
  assert.equal(player.tavernSpellsCastThisTurn, 2);
});

test("Trainee and Lasso add real pool/shop minions to hand deterministically", () => {
  let traineeState = createGame(0x71c0);
  let traineePlayer = humanPlayer(traineeState);
  const traineeTemplate = traineePlayer.shop[0];
  assert.ok(traineeTemplate);
  const traineeDefinitionId = traineeTemplate.definitionId;
  for (const definitionId of Object.keys(traineeState.pool)) {
    traineeState.pool[definitionId] = 0;
  }
  traineeState.pool[traineeDefinitionId] = 1;
  traineePlayer.hand = [
    tavernSpell("tavern-spell-recruit-a-trainee", "trainee-spell"),
  ];

  traineeState = gameReducer(traineeState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "trainee-spell",
  });
  traineePlayer = humanPlayer(traineeState);
  assert.equal(traineePlayer.hand.length, 1);
  assert.equal(traineePlayer.hand[0].kind, "minion");
  assert.equal(
    traineePlayer.hand[0].definitionId,
    traineeDefinitionId,
  );
  assert.equal(traineeState.pool[traineeDefinitionId], 0);

  let lassoState = createGame(0x71c1);
  let lassoPlayer = humanPlayer(lassoState);
  const lassoTemplate = lassoPlayer.shop[0];
  assert.ok(lassoTemplate);
  const stolen = definitionMinion(
    lassoTemplate,
    lassoTemplate.definitionId,
    "only-lasso-target",
  );
  lassoPlayer.shop = [stolen];
  lassoPlayer.hand = [
    tavernSpell("tavern-spell-enchanted-lasso", "lasso-spell"),
  ];

  lassoState = gameReducer(lassoState, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "lasso-spell",
  });
  lassoPlayer = humanPlayer(lassoState);
  assert.equal(lassoPlayer.shop.length, 0);
  assert.deepEqual(
    lassoPlayer.hand.map((card) => card.instanceId),
    ["only-lasso-target"],
  );
});

test("Clone Horn and Temperature Shift preserve real versus generated pool ownership", () => {
  let state = createGameWithTribes(
    ["murloc", "elemental"],
    0x7400,
  );
  let player = humanPlayer(state);
  player.tavernTier = 4;
  const template = player.shop[0];
  assert.ok(template);
  const murloc = MINION_DEFINITIONS.find(
    (definition) => definition.id === "BG32_330",
  );
  assert.ok(murloc);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool[murloc.id] = 1;
  state.pool.BG31_816 = 1;
  state.pool.BG31_818 = 1;
  player.hand = [
    tavernSpell("tavern-spell-clone-horn", "clone-horn"),
    tavernSpell(
      "tavern-spell-temperature-shift",
      "temperature-shift",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "clone-horn",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "temperature-shift",
  });
  player = humanPlayer(state);

  const clonedMurlocs = player.hand.filter(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === murloc.id,
  );
  assert.equal(clonedMurlocs.length, 2);
  assert.deepEqual(
    clonedMurlocs
      .map((minion) => minion.poolCopies)
      .sort((left, right) => left - right),
    [0, 1],
  );
  assert.equal(state.pool[murloc.id], 0);

  const fireBaller = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG31_816",
  );
  const snowBaller = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG31_818",
  );
  assert.ok(fireBaller);
  assert.ok(snowBaller);
  assert.equal(fireBaller.poolCopies, 1);
  assert.equal(snowBaller.poolCopies, 1);
  assert.equal(state.pool.BG31_816, 0);
  assert.equal(state.pool.BG31_818, 0);

  const witness = definitionMinion(
    template,
    "BG35_801",
    "baller-witness",
    { attack: 7, health: 9 },
  );
  player.board = [witness];
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: fireBaller.instanceId,
  });
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: snowBaller.instanceId,
  });
  player = humanPlayer(state);
  const fireIndex = player.board.findIndex(
    (minion) => minion.definitionId === "BG31_816",
  );
  assert.ok(fireIndex >= 0);
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: fireIndex,
  });
  player = humanPlayer(state);
  const snowIndex = player.board.findIndex(
    (minion) => minion.definitionId === "BG31_818",
  );
  assert.ok(snowIndex >= 0);
  state = gameReducer(state, {
    type: "SELL_MINION",
    boardIndex: snowIndex,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [8, 10],
  );
  assert.equal(player.ballerAttackBonus, 2);
  assert.equal(player.ballerHealthBonus, 2);
});

test("Slimy Seafood draws tier-gated Spellcraft with replacement and respects hand space", () => {
  let state = createGameWithTribes(["naga"], 0x7410);
  let player = humanPlayer(state);
  player.tavernTier = 4;
  state.rngState = 1;
  player.hand = [
    tavernSpell("tavern-spell-slimy-seafood", "slimy-seafood"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "slimy-seafood",
  });
  player = humanPlayer(state);
  const generated = player.hand.filter(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft",
  );
  assert.equal(generated.length, 3);
  assert.equal(
    generated[0].definitionId,
    generated[1].definitionId,
    "independent draws must allow duplicate Spellcraft spells",
  );
  assert.ok(
    generated.every(
      (card) =>
        getSpellcraftDefinition(card.definitionId).sourceTier <= 4,
    ),
  );

  state = createGameWithTribes(["naga"], 0x7411);
  player = humanPlayer(state);
  player.tavernTier = 4;
  player.hand = [
    tavernSpell("tavern-spell-slimy-seafood", "full-slimy"),
    ...Array.from({ length: 9 }, (_, index) =>
      tavernSpell(
        "tavern-spell-tavern-coin",
        `slimy-filler-${index}`,
      ),
    ),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "full-slimy",
  });
  player = humanPlayer(state);
  assert.equal(player.hand.length, 10);
  assert.equal(
    player.hand.filter((card) => card.kind === "spellcraft").length,
    1,
  );
});

test("Gem Confiscation casts two current Blood Gems and steals only neighboring Gem stats", () => {
  let state = createGameWithTribes(["quilboar"], 0x7420);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.bloodGemAttack = 2;
  player.bloodGemHealth = 3;
  player.shop = [];
  player.board = [
    definitionMinion(
      template,
      template.definitionId,
      "left-gem-neighbor",
      {
        attack: 8,
        health: 8,
        bloodGemAttack: 3,
        bloodGemHealth: 2,
      },
    ),
    definitionMinion(
      template,
      template.definitionId,
      "gem-target",
      {
        attack: 7,
        health: 8,
        bloodGemAttack: 0,
        bloodGemHealth: 0,
      },
    ),
    definitionMinion(
      template,
      template.definitionId,
      "right-gem-neighbor",
      {
        attack: 3,
        health: 14,
        bloodGemAttack: 1,
        bloodGemHealth: 4,
      },
    ),
  ];
  player.hand = [
    tavernSpell(
      "tavern-spell-gem-confiscation",
      "gem-confiscation",
    ),
  ];
  assert.deepEqual(
    getLegalTavernSpellTargetIds(
      state,
      player.id,
      player.hand[0] as TavernSpellInstance,
    ),
    player.board.map((minion) => minion.instanceId),
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "gem-confiscation",
    targetInstanceId: "gem-target",
  });
  player = humanPlayer(state);
  const [left, target, right] = player.board;
  assert.deepEqual(
    [
      left.attack,
      left.health,
      left.bloodGemAttack,
      left.bloodGemHealth,
    ],
    [5, 6, 0, 0],
  );
  assert.deepEqual(
    [
      right.attack,
      right.health,
      right.bloodGemAttack,
      right.bloodGemHealth,
    ],
    [2, 10, 0, 0],
  );
  assert.deepEqual(
    [
      target.attack,
      target.health,
      target.bloodGemAttack,
      target.bloodGemHealth,
    ],
    [15, 20, 8, 12],
  );
});

test("Gem Confiscation treats deterministically interleaved Tavern Spells as adjacency blockers", () => {
  let state = createGameWithTribes(["quilboar"], 0x7421);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.bloodGemAttack = 2;
  player.bloodGemHealth = 3;
  player.board = [];
  player.shop = [
    definitionMinion(template, template.definitionId, "m0", {
      attack: 8,
      health: 8,
      bloodGemAttack: 3,
      bloodGemHealth: 2,
    }),
    definitionMinion(template, template.definitionId, "m1", {
      attack: 7,
      health: 8,
      bloodGemAttack: 0,
      bloodGemHealth: 0,
    }),
    definitionMinion(template, template.definitionId, "m2", {
      attack: 3,
      health: 14,
      bloodGemAttack: 1,
      bloodGemHealth: 4,
    }),
  ];
  player.spellShop = tavernSpell(
    "tavern-spell-tavern-coin",
    "mix-0",
  );
  player.additionalSpellShop = [
    tavernSpell("tavern-spell-tavern-coin", "mix-1"),
    tavernSpell("tavern-spell-tavern-coin", "mix-3"),
  ];
  player.hand = [
    tavernSpell(
      "tavern-spell-gem-confiscation",
      "mixed-gem-confiscation",
    ),
  ];

  const displayOffers: Array<{
    kind: "minion" | "spell";
    instanceId: string;
  }> = player.shop.map((minion) => ({
    kind: "minion",
    instanceId: minion.instanceId,
  }));
  for (const spell of [
    player.spellShop,
    ...player.additionalSpellShop,
  ]) {
    const position =
      [...spell.instanceId].reduce(
        (hash, character) =>
          (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0,
        5381,
      ) %
      (displayOffers.length + 1);
    displayOffers.splice(position, 0, {
      kind: "spell",
      instanceId: spell.instanceId,
    });
  }
  assert.deepEqual(
    displayOffers.map(({ kind, instanceId }) => [kind, instanceId]),
    [
      ["spell", "mix-0"],
      ["minion", "m0"],
      ["spell", "mix-1"],
      ["minion", "m1"],
      ["minion", "m2"],
      ["spell", "mix-3"],
    ],
  );
  const targetDisplayIndex = displayOffers.findIndex(
    (offer) => offer.instanceId === "m1",
  );
  const expectedNeighborIds = [
    displayOffers[targetDisplayIndex - 1],
    displayOffers[targetDisplayIndex + 1],
  ].flatMap((offer) =>
    offer?.kind === "minion" ? [offer.instanceId] : [],
  );
  assert.deepEqual(expectedNeighborIds, ["m2"]);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "mixed-gem-confiscation",
    targetInstanceId: "m1",
  });
  player = humanPlayer(state);
  const [blocked, target, adjacent] = player.shop;
  assert.deepEqual(
    [
      blocked.attack,
      blocked.health,
      blocked.bloodGemAttack,
      blocked.bloodGemHealth,
    ],
    [8, 8, 3, 2],
  );
  assert.deepEqual(
    [
      adjacent.attack,
      adjacent.health,
      adjacent.bloodGemAttack,
      adjacent.bloodGemHealth,
    ],
    [2, 10, 0, 0],
  );
  assert.deepEqual(
    [
      target.attack,
      target.health,
      target.bloodGemAttack,
      target.bloodGemHealth,
    ],
    [12, 18, 5, 10],
  );
});

test("Ride the Wind and Eonar's Favor stack on current and future Tavern minions", () => {
  let state = createGameWithTribes(["elemental"], 0x7430);
  let player = humanPlayer(state);
  player.tavernTier = 4;
  const template = player.shop[0];
  assert.ok(template);
  const typeTarget = definitionMinion(
    template,
    "BG31_815",
    "eonar-type-target",
  );
  player.board = [typeTarget];
  player.shop = [];
  player.hand = [
    tavernSpell("tavern-spell-ride-the-wind", "ride-the-wind"),
    tavernSpell("tavern-spell-eonars-favor", "eonars-favor"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "ride-the-wind",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "eonars-favor",
    targetInstanceId: typeTarget.instanceId,
  });
  player = humanPlayer(state);
  assert.deepEqual(player.rideTheWindBuffs, [
    { attack: 6, health: 6 },
  ]);
  assert.deepEqual(player.tavernTypeBuffs, [
    {
      tribes: ["elemental"],
      attack: 3,
      health: 3,
    },
  ]);

  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(state.spellPool)) {
    state.spellPool[definitionId] = 0;
  }
  state.pool.BG31_816 = 1;
  player.gold = 1;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 1);
  assert.equal(player.shop[0].definitionId, "BG31_816");
  assert.deepEqual(
    [player.shop[0].attack, player.shop[0].health],
    [13, 12],
  );
});

test("Blazing Inferno counts Elementals played this turn and Arcane Absorption uses half Tavern stats", () => {
  let state = createGameWithTribes(["elemental"], 0x7440);
  let player = humanPlayer(state);
  player.tavernTier = 4;
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG31_815",
    "inferno-target",
  );
  const nonElemental = definitionMinion(
    template,
    template.definitionId,
    "non-elemental-target",
  );
  nonElemental.tribe = "neutral";
  nonElemental.tribes = [];
  player.board = [target, nonElemental];
  player.shop = [
    definitionMinion(
      template,
      template.definitionId,
      "arcane-source",
      { attack: 9, health: 11 },
    ),
  ];
  player.hand = [
    definitionMinion(
      template,
      "BG31_816",
      "played-fire-baller",
    ),
    definitionMinion(
      template,
      "BG31_818",
      "played-snow-baller",
    ),
    tavernSpell("tavern-spell-blazing-inferno", "blazing-inferno"),
    tavernSpell(
      "tavern-spell-arcane-absorption",
      "arcane-absorption",
    ),
  ];

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "played-fire-baller",
  });
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: "played-snow-baller",
  });
  player = humanPlayer(state);
  assert.equal(player.elementalsPlayedThisTurn, 2);
  assert.ok(
    !getLegalTavernSpellTargetIds(
      state,
      player.id,
      player.hand.find(
        (card): card is TavernSpellInstance =>
          card.kind === "tavernSpell" &&
          card.instanceId === "arcane-absorption",
      )!,
    ).includes(nonElemental.instanceId),
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "blazing-inferno",
    targetInstanceId: target.instanceId,
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "arcane-absorption",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const buffed = player.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(buffed);
  assert.deepEqual([buffed.attack, buffed.health], [13, 13]);
  assert.equal(player.tavernSpellsCastThisTurn, 2);
});

test("Stir the Graveyard kills a same-turn play, fires its Deathrattle, and clears on a triple", () => {
  let state = createGameWithTribes(["undead"], 0x7450);
  let player = humanPlayer(state);
  player.tavernTier = 4;
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG28_300 = 1;
  player.shop = [];
  player.hand = [
    tavernSpell(
      "tavern-spell-stir-the-graveyard",
      "stir-the-graveyard",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "stir-the-graveyard",
  });
  const graveyardDiscover = state.pendingInteraction;
  assert.ok(graveyardDiscover?.kind === "discover");
  assert.equal(graveyardDiscover.options.length, 1);
  const option = graveyardDiscover.options[0];
  assert.ok(option);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: graveyardDiscover.interactionId,
    optionInstanceId: option.instanceId,
  });
  player = humanPlayer(state);
  const discovered = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG28_300",
  );
  assert.ok(discovered);
  assert.equal(discovered.destroyAfterPlayThroughRound, state.round);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: discovered.instanceId,
  });
  player = humanPlayer(state);
  assert.ok(
    player.board.every(
      (minion) => minion.definitionId === "live-skeleton-token",
    ),
  );
  assert.equal(player.board.length, 2);
  assert.equal(state.pool.BG28_300, 1);

  state = createGameWithTribes(["undead"], 0x7451);
  player = humanPlayer(state);
  player.tavernTier = 4;
  const template = player.shop[0];
  assert.ok(template);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG28_300 = 1;
  player.shop = [];
  player.board = [
    definitionMinion(template, "BG28_300", "graveyard-copy-a", {
      poolCopies: 1,
    }),
  ];
  player.hand = [
    definitionMinion(template, "BG28_300", "graveyard-copy-b", {
      poolCopies: 1,
    }),
    tavernSpell(
      "tavern-spell-stir-the-graveyard",
      "triple-graveyard",
    ),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "triple-graveyard",
  });
  const tripleDiscover = state.pendingInteraction;
  assert.ok(tripleDiscover?.kind === "discover");
  const tripleOption = tripleDiscover.options[0];
  assert.ok(tripleOption);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: tripleDiscover.interactionId,
    optionInstanceId: tripleOption.instanceId,
  });
  player = humanPlayer(state);
  const golden = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.definitionId === "BG28_300" &&
      card.golden,
  );
  assert.ok(golden);
  assert.equal(golden.destroyAfterPlayThroughRound, undefined);
  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: golden.instanceId,
  });
  assert.ok(
    humanPlayer(state).board.some(
      (minion) =>
        minion.definitionId === "BG28_300" && minion.golden,
    ),
  );
});

test("Stir the Graveyard leaves a one-Health Reborn copy in the played position", () => {
  let state = createGameWithTribes(["undead"], 0x7452);
  let player = humanPlayer(state);
  player.tavernTier = 4;
  const template = player.shop[0];
  assert.ok(template);
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG25_001 = 1;
  player.shop = [];
  player.board = [
    definitionMinion(template, "BG35_801", "reborn-left-anchor"),
    definitionMinion(template, "BG35_801", "reborn-right-anchor"),
  ];
  player.hand = [
    tavernSpell(
      "tavern-spell-stir-the-graveyard",
      "reborn-graveyard",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "reborn-graveyard",
  });
  const discover = state.pendingInteraction;
  assert.ok(discover?.kind === "discover");
  assert.equal(discover.options.length, 1);
  const option = discover.options[0];
  assert.equal(option.definitionId, "BG25_001");
  assert.equal(option.reborn, true);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: discover.interactionId,
    optionInstanceId: option.instanceId,
  });
  player = humanPlayer(state);
  const discovered = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG25_001",
  );
  assert.ok(discovered);

  state = gameReducer(state, {
    type: "PLAY_HAND_CARD",
    cardInstanceId: discovered.instanceId,
    boardIndex: 1,
  });
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => minion.instanceId),
    [
      "reborn-left-anchor",
      player.board[1].instanceId,
      "reborn-right-anchor",
    ],
  );
  const reborn = player.board[1];
  assert.equal(reborn.definitionId, "BG25_001");
  assert.notEqual(reborn.instanceId, discovered.instanceId);
  assert.equal(reborn.health, 1);
  assert.equal(reborn.reborn, false);
  assert.equal(reborn.poolCopies, 0);
  assert.equal(reborn.destroyAfterPlayThroughRound, undefined);
  assert.equal(state.pool.BG25_001, 1);
});

test("Beetle Blessing summons two 2/2 Taunt Beetles in the next combat", () => {
  let state = createGameWithTribes(["beast"], 0x7460);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const opponent = keepOnlyOneOpponent(state, [
    definitionMinion(
      template,
      template.definitionId,
      "beetle-opponent",
      { attack: 0, health: 100 },
    ),
  ]);
  player.hand = [
    tavernSpell(
      "tavern-spell-beetle-blessing",
      "beetle-blessing",
    ),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "beetle-blessing",
  });
  assert.equal(humanPlayer(state).nextCombatBeetles, 2);

  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === player.id ||
      candidate.playerBId === player.id,
  );
  assert.ok(battle);
  assert.ok(
    [battle.playerAId, battle.playerBId].includes(opponent.id),
  );
  const beetleSummons = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.equal(beetleSummons.length, 2);
  assert.ok(
    beetleSummons.every(
      (event) =>
        event.minion?.attack === 2 &&
        event.minion.health === 2 &&
        event.minion.taunt,
    ),
  );
  assert.equal(humanPlayer(state).nextCombatBeetles, 0);
});

test("targeted Spellcraft stacks temporary stats and keywords, grows Deep Blue, then expires", () => {
  let state = createGame(0x7470);
  let player = humanPlayer(state);
  player.tavernTier = 4;
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG31_815",
    "spellcraft-target",
    {
      attack: 5,
      health: 7,
      taunt: false,
      divineShield: false,
    },
  );
  player.board = [target];
  const shopTarget = definitionMinion(
    template,
    template.definitionId,
    "illegal-spellcraft-shop-target",
  );
  player.shop = [shopTarget];
  player.hand = [
    spellcraft("spellcraft-crab-rider", "crab-rider"),
    spellcraft("spellcraft-anglers-lure", "anglers-lure"),
    spellcraft("spellcraft-glowing-crown", "glowing-crown"),
    spellcraft("spellcraft-sick-riffs", "sick-riffs"),
    spellcraft("spellcraft-deep-blue-blues", "deep-blue-one"),
    spellcraft("spellcraft-deep-blue-blues", "deep-blue-two"),
    spellcraft("spellcraft-rime-or-reason", "unused-spellcraft"),
  ];

  assert.deepEqual(
    getLegalSpellcraftTargetIds(
      state,
      player.id,
      player.hand[0] as SpellcraftSpellInstance,
    ),
    [target.instanceId],
  );
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "crab-rider",
    targetInstanceId: shopTarget.instanceId,
  });
  assert.ok(
    humanPlayer(state).hand.some(
      (card) => card.instanceId === "crab-rider",
    ),
  );

  for (const [cardInstanceId, targetInstanceId] of [
    ["crab-rider", target.instanceId],
    ["anglers-lure", target.instanceId],
    ["glowing-crown", target.instanceId],
    ["sick-riffs", target.instanceId],
    ["deep-blue-one", target.instanceId],
    ["deep-blue-two", target.instanceId],
  ] as const) {
    state = gameReducer(state, {
      type: "CAST_SPELLCRAFT",
      cardInstanceId,
      targetInstanceId,
    });
  }
  player = humanPlayer(state);
  const temporarilyBuffed = player.board[0];
  assert.deepEqual(
    [temporarilyBuffed.attack, temporarilyBuffed.health],
    [16, 22],
  );
  assert.deepEqual(
    [
      temporarilyBuffed.temporaryAttack,
      temporarilyBuffed.temporaryHealth,
      temporarilyBuffed.temporaryTaunt,
      temporarilyBuffed.temporaryDivineShield,
      temporarilyBuffed.temporaryCrabDeathrattles,
    ],
    [11, 15, true, true, 1],
  );
  assert.equal(temporarilyBuffed.taunt, true);
  assert.equal(temporarilyBuffed.divineShield, true);
  assert.equal(player.deepBlueBonus, 2);

  state = gameReducer(state, { type: "END_TURN" });
  assert.ok(
    humanPlayer(state).hand.every(
      (card) => card.kind !== "spellcraft",
    ),
    "unused Spellcraft must disappear at the end of Recruit",
  );
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  const cleared = player.board[0];
  assert.deepEqual([cleared.attack, cleared.health], [5, 7]);
  assert.deepEqual(
    [
      cleared.temporaryAttack,
      cleared.temporaryHealth,
      cleared.temporaryTaunt,
      cleared.temporaryDivineShield,
      cleared.temporaryCrabDeathrattles,
    ],
    [0, 0, false, false, 0],
  );
  assert.equal(cleared.taunt, false);
  assert.equal(cleared.divineShield, false);
  assert.equal(player.deepBlueBonus, 2);
  assert.equal(player.elementalsPlayedThisTurn, 0);
});

test("eliminated players clear every temporary Spellcraft effect before becoming ghosts", () => {
  let state = createGame(0x7471);
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  const ghost = state.players.find((candidate) => !candidate.isHuman);
  assert.ok(ghost);
  ghost.alive = false;
  ghost.health = 0;
  ghost.eliminatedRound = state.round;
  ghost.hand = [];
  ghost.shop = [];
  ghost.spellShop = null;
  ghost.board = [
    definitionMinion(
      template,
      "BG31_815",
      "temporary-ghost-minion",
      {
        attack: 10,
        health: 11,
        taunt: true,
        divineShield: true,
        temporaryAttack: 7,
        temporaryHealth: 9,
        temporaryTaunt: true,
        temporaryDivineShield: true,
        temporaryCrabDeathrattles: 2,
      },
    ),
  ];
  state.phase = "combat";

  state = gameReducer(state, { type: "CONTINUE" });
  const cleanedGhost = state.players.find(
    (candidate) => candidate.id === ghost.id,
  );
  assert.ok(cleanedGhost);
  assert.deepEqual(
    [
      cleanedGhost.board[0].attack,
      cleanedGhost.board[0].health,
      cleanedGhost.board[0].taunt,
      cleanedGhost.board[0].divineShield,
      cleanedGhost.board[0].temporaryAttack,
      cleanedGhost.board[0].temporaryHealth,
      cleanedGhost.board[0].temporaryTaunt,
      cleanedGhost.board[0].temporaryDivineShield,
      cleanedGhost.board[0].temporaryCrabDeathrattles,
    ],
    [3, 2, false, false, 0, 0, false, false, 0],
  );

  for (const player of state.players) {
    if (!player.alive) {
      continue;
    }
    player.gold = 0;
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
  }
  state = gameReducer(state, { type: "END_TURN" });
  const ghostBattle = state.lastRoundBattles.find(
    (battle) =>
      battle.isGhost && battle.playerBId === cleanedGhost.id,
  );
  assert.ok(ghostBattle);
  const ghostMinion = ghostBattle.initialBoards[cleanedGhost.id][0];
  assert.deepEqual(
    [
      ghostMinion.attack,
      ghostMinion.health,
      ghostMinion.taunt,
      ghostMinion.divineShield,
      ghostMinion.temporaryCrabDeathrattles,
    ],
    [3, 2, false, false, 0],
  );
});

test("targetless Spellcraft resolves choices, draws from the pool, and empowers Tavern Spells", () => {
  let state = createGameWithTribes(["naga"], 0x7480);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    template.definitionId,
    "meditation-target",
    { attack: 5, health: 7 },
  );
  const other = definitionMinion(
    template,
    template.definitionId,
    "eruption-other",
    { attack: 2, health: 3 },
  );
  player.board = [target, other];
  player.shop = [];
  for (const definitionId of Object.keys(state.pool)) {
    state.pool[definitionId] = 0;
  }
  state.pool.BG27_004 = 1;
  player.hand = [
    spellcraft(
      "spellcraft-escape-eruption",
      "escape-eruption",
    ),
    spellcraft(
      "spellcraft-evolving-strategy",
      "evolving-strategy",
    ),
    spellcraft("spellcraft-meditation", "meditation"),
    spellcraft("spellcraft-rime-or-reason", "rime-or-reason"),
    tavernSpell("tavern-spell-tavern-dish-banana", "meditated-banana"),
  ];

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "escape-eruption",
  });
  assert.equal(state.pendingInteraction?.kind, "spellcraftChoice");
  const choiceInteraction = state.pendingInteraction;
  assert.ok(choiceInteraction?.kind === "spellcraftChoice");
  const unresolved = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: choiceInteraction.interactionId,
    optionInstanceId: "not-a-choice",
  });
  assert.equal(unresolved, state);
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: choiceInteraction.interactionId,
    optionInstanceId: "escapeEruptionAttack",
  });
  assert.deepEqual(
    humanPlayer(state).board.map((minion) => minion.attack),
    [9, 6],
  );

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "evolving-strategy",
  });
  player = humanPlayer(state);
  const drawnNaga = player.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" && card.definitionId === "BG27_004",
  );
  assert.ok(drawnNaga);
  assert.equal(drawnNaga.poolCopies, 1);
  assert.equal(state.pool.BG27_004, 0);

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "meditation",
  });
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "meditated-banana",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const meditated = player.board.find(
    (minion) => minion.instanceId === target.instanceId,
  );
  assert.ok(meditated);
  assert.deepEqual([meditated.attack, meditated.health], [12, 10]);
  assert.equal(player.tavernSpellAttackBonus, 1);
  assert.equal(player.tavernSpellHealthBonus, 1);
  assert.equal(player.tavernSpellsCastThisTurn, 1);

  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "rime-or-reason",
  });
  player = humanPlayer(state);
  const generatedSpell = player.hand.find(
    (card): card is TavernSpellInstance =>
      card.kind === "tavernSpell",
  );
  assert.ok(generatedSpell);
  assert.ok(
    STAT_GRANTING_TAVERN_SPELL_CARD_IDS.some(
      (cardId) => cardId === generatedSpell.cardId,
    ),
  );
});

test("Crab Rider's temporary Deathrattle summons a 3/2 Crab in combat", () => {
  let state = createGame(0x7490);
  const player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const source = definitionMinion(
    template,
    "BG31_815",
    "crab-rider-source",
    { attack: 1, health: 1 },
  );
  player.board = [source];
  player.hand = [
    spellcraft("spellcraft-crab-rider", "combat-crab-rider"),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion(
      template,
      template.definitionId,
      "crab-rider-opponent",
      { attack: 10, health: 10 },
    ),
  ]);
  state = gameReducer(state, {
    type: "CAST_SPELLCRAFT",
    cardInstanceId: "combat-crab-rider",
    targetInstanceId: source.instanceId,
  });
  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === player.id ||
      candidate.playerBId === player.id,
  );
  assert.ok(battle);
  const crabSummon = battle.events.find(
    (event) =>
      event.type === "summon" &&
      event.minion?.definitionId === "live-crab-token",
  );
  assert.ok(crabSummon);
  assert.deepEqual(
    [crabSummon.minion?.attack, crabSummon.minion?.health],
    [3, 2],
  );
});

test("Armor Stash sets Armor to exactly 5 and combat damage consumes Armor first", () => {
  let state = createGame(0x7500);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.armor = 9;
  player.board = [
    definitionMinion(template, template.definitionId, "armored-loser", {
      attack: 0,
      health: 1,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-armor-stash", "armor-stash"),
  ];
  const opponent = keepOnlyOneOpponent(state, [
    definitionMinion(template, template.definitionId, "armor-winner", {
      attack: 10,
      health: 10,
    }),
  ]);

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "armor-stash",
  });
  player = humanPlayer(state);
  assert.equal(player.armor, 5);

  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === player.id ||
      candidate.playerBId === player.id,
  );
  assert.ok(battle);
  const damageEvent = battle.events.find(
    (event) =>
      event.type === "heroDamage" &&
      event.targetPlayerId === player.id,
  );
  assert.ok(damageEvent);
  assert.equal(damageEvent.amount, opponent.tavernTier + template.tier);
  assert.equal(damageEvent.armorAbsorbed, damageEvent.amount);
  assert.equal(damageEvent.healthDamage, 0);
  assert.equal(battle.playerAId === player.id
    ? battle.playerAArmorBefore
    : battle.playerBArmorBefore, 5);
  assert.equal(humanPlayer(state).health, 40);
  assert.equal(
    humanPlayer(state).armor,
    5 - (damageEvent.amount ?? 0),
  );
});

test("paying Health for Hasty Excavation bypasses Armor", () => {
  let state = createGame(0x7501);
  let player = humanPlayer(state);
  player.health = 20;
  player.armor = 5;
  replaceSpellOffer(
    state,
    player,
    "tavern-spell-hasty-excavation",
    "armored-excavation",
  );

  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: "armored-excavation",
  });
  player = humanPlayer(state);
  assert.equal(player.health, 17);
  assert.equal(player.armor, 5);
});

test("Upper Hand and Nozdormu's Progeny stack as structured start-of-combat effects", () => {
  let state = createGame(0x7502);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "leftmost-double", {
      attack: 3,
      health: 20,
    }),
  ];
  player.hand = [
    tavernSpell("tavern-spell-nozdormus-progeny", "nozdormu-1"),
    tavernSpell("tavern-spell-nozdormus-progeny", "nozdormu-2"),
    tavernSpell("tavern-spell-overpowered", "upper-hand-1"),
    tavernSpell("tavern-spell-overpowered", "upper-hand-2"),
  ];
  const opponent = keepOnlyOneOpponent(state, [
    definitionMinion(template, template.definitionId, "upper-hand-target", {
      attack: 0,
      health: 20,
    }),
  ]);
  for (const cardInstanceId of [
    "nozdormu-1",
    "nozdormu-2",
    "upper-hand-1",
    "upper-hand-2",
  ]) {
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId,
    });
  }
  player = humanPlayer(state);
  assert.equal(player.nextCombatDoubleLeftmostAttack.length, 2);
  assert.equal(player.nextCombatSetEnemyHealthToOne, 2);

  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === player.id ||
      candidate.playerBId === player.id,
  );
  assert.ok(battle);
  const initialLeftmost =
    battle.initialBoards[player.id]?.find(
      (minion) => minion.instanceId === "leftmost-double",
    );
  const initialEnemy =
    battle.initialBoards[opponent.id]?.find(
      (minion) => minion.instanceId === "upper-hand-target",
    );
  assert.equal(initialLeftmost?.attack, 3);
  assert.equal(initialEnemy?.health, 20);
  const nozdormuEvents = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorPlayerId === player.id &&
      event.targetInstanceId === "leftmost-double",
  );
  assert.deepEqual(
    nozdormuEvents.map((event) => event.minion?.attack),
    [6, 12],
  );
  const upperHandEvents = battle.events.filter(
    (event) =>
      event.type === "buff" &&
      event.actorPlayerId === player.id &&
      event.targetInstanceId === "upper-hand-target",
  );
  assert.equal(upperHandEvents.length, 2);
  assert.ok(upperHandEvents.every((event) => event.minion?.health === 1));
  assert.deepEqual(humanPlayer(state).nextCombatDoubleLeftmostAttack, []);
  assert.equal(humanPlayer(state).nextCombatSetEnemyHealthToOne, 0);
});

test("Slaughter destroys only a friendly Undead and empowers current and future owned Undead", () => {
  let state = createGameWithTribes(["undead"], 0x7503);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const doomed = definitionMinion(
    template,
    template.definitionId,
    "slaughter-doomed",
    {
      tribe: "undead",
      tribes: ["undead"],
      attack: 2,
      health: 2,
      poolCopies: 0,
    },
  );
  const survivor = definitionMinion(
    template,
    template.definitionId,
    "slaughter-survivor",
    {
      tribe: "undead",
      tribes: ["undead"],
      attack: 4,
      health: 5,
    },
  );
  const outsider = definitionMinion(
    template,
    template.definitionId,
    "slaughter-outsider",
    {
      tribe: "neutral",
      tribes: [],
      attack: 6,
      health: 7,
    },
  );
  player.board = [doomed, survivor, outsider];
  player.hand = [
    tavernSpell("tavern-spell-slaughter", "slaughter-spell"),
  ];
  const legalTargets = getLegalTavernSpellTargetIds(
    state,
    player.id,
    player.hand[0] as TavernSpellInstance,
  );
  assert.deepEqual(
    new Set(legalTargets),
    new Set(["slaughter-doomed", "slaughter-survivor"]),
  );
  const goldBefore = player.gold;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "slaughter-spell",
    targetInstanceId: "slaughter-doomed",
  });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBefore);
  assert.equal(
    player.board.some((minion) => minion.instanceId === "slaughter-doomed"),
    false,
  );
  assert.equal(player.undeadArmyAttackBonus, 5);
  assert.equal(player.undeadArmyHealthBonus, 0);
  assert.equal(
    player.board.find((minion) => minion.instanceId === "slaughter-survivor")
      ?.attack,
    9,
  );
  assert.equal(
    player.board.find((minion) => minion.instanceId === "slaughter-outsider")
      ?.attack,
    6,
  );

  const futureUndead = player.shop.find((minion) =>
    minion.tribes.includes("undead"),
  );
  if (futureUndead) {
    const baseAttack = futureUndead.attack;
    const shopIndex = player.shop.indexOf(futureUndead);
    player.gold = 3;
    state = gameReducer(state, { type: "BUY_MINION", shopIndex });
    const bought = humanPlayer(state).hand.find(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        card.instanceId === futureUndead.instanceId,
    );
    assert.equal(bought?.attack, baseAttack + 5);
  }
});

test("Corrupted Cupcakes consumes up to three Tavern minions and conserves their pool copies", () => {
  let state = createGameWithTribes(["demon"], 0x7504);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const demon = definitionMinion(
    template,
    template.definitionId,
    "cupcake-demon",
    {
      tribe: "demon",
      tribes: ["demon"],
      attack: 3,
      health: 4,
    },
  );
  player.board = [demon];
  player.shop = player.shop.slice(0, 3);
  assert.equal(player.shop.length, 3);
  const consumed = player.shop.map((minion) => ({
    definitionId: minion.definitionId,
    attack: minion.attack,
    health: minion.health,
    poolCopies: minion.poolCopies,
    poolBefore: state.pool[minion.definitionId] ?? 0,
  }));
  player.hand = [
    tavernSpell(
      "tavern-spell-corrupted-cupcakes",
      "corrupted-cupcakes",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "corrupted-cupcakes",
    targetInstanceId: demon.instanceId,
  });
  player = humanPlayer(state);
  const buffed = player.board.find(
    (minion) => minion.instanceId === demon.instanceId,
  );
  assert.equal(
    buffed?.attack,
    3 + consumed.reduce((total, minion) => total + minion.attack, 0),
  );
  assert.equal(
    buffed?.health,
    4 + consumed.reduce((total, minion) => total + minion.health, 0),
  );
  assert.equal(player.shop.length, 0);
  for (const minion of consumed) {
    assert.equal(
      state.pool[minion.definitionId],
      minion.poolBefore + minion.poolCopies,
    );
  }
});

test("Golden Touch adds only printed base stats and never fabricates Triple ownership", () => {
  let state = createGame(0x7505);
  let player = humanPlayer(state);
  const target = player.shop[0];
  assert.ok(target);
  const definition = getMinionDefinition(target.definitionId);
  target.attack += 5;
  target.health += 7;
  const attackBefore = target.attack;
  const healthBefore = target.health;
  const poolCopiesBefore = target.poolCopies;
  player.shop = [target];
  player.hand = [
    tavernSpell("tavern-spell-golden-touch", "golden-touch"),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "golden-touch",
  });
  player = humanPlayer(state);
  const golden = player.shop[0];
  assert.equal(golden.golden, true);
  assert.equal(golden.attack, attackBefore + definition.attack);
  assert.equal(golden.health, healthBefore + definition.health);
  assert.equal(golden.poolCopies, poolCopiesBefore);
  assert.equal(golden.grantsTripleReward, false);
});

test("Reserved Corpse and Headhunter Discover from printed mechanics rather than implemented-effect flags", () => {
  for (const [definitionId, ability, seed] of [
    ["tavern-spell-reserved-corpse", "DEATHRATTLE", 0x7506],
    ["tavern-spell-headhunter", "BATTLECRY", 0x7507],
  ] as const) {
    let state = createGame(seed);
    let player = humanPlayer(state);
    player.tavernTier = 6;
    player.hand = [tavernSpell(definitionId, `${definitionId}-cast`)];
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId: `${definitionId}-cast`,
    });
    const pending = state.pendingInteraction;
    assert.ok(pending?.kind === "discover");
    assert.equal(
      pending.filter.ability,
      ability === "DEATHRATTLE" ? "deathrattle" : "battlecry",
    );
    assert.ok(pending.options.length > 0);
    assert.ok(
      pending.options.every((option) =>
        getMinionDefinition(option.definitionId)
          .printedMechanics?.includes(ability),
      ),
    );
    const selected = pending.options[0];
    state = gameReducer(state, {
      type: "RESOLVE_INTERACTION",
      interactionId: pending.interactionId,
      optionInstanceId: selected.instanceId,
    });
    player = humanPlayer(state);
    assert.equal(state.pendingInteraction, null);
    assert.ok(
      player.hand.some(
        (card) =>
          card.kind === "minion" &&
          card.instanceId === selected.instanceId,
      ),
    );
    assert.equal(player.tavernSpellsCastThisTurn, 1);
  }
});

test("Queen's Command, Sanctify, and Wave of Gold preserve their distinct double-buff conditions", () => {
  let state = createGame(0x7508);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const nagaShield = definitionMinion(
    template,
    template.definitionId,
    "tier-five-naga-shield",
    {
      tribe: "naga",
      tribes: ["naga"],
      attack: 10,
      health: 10,
      divineShield: true,
    },
  );
  const golden = definitionMinion(
    template,
    template.definitionId,
    "tier-five-golden",
    {
      attack: 10,
      health: 10,
      golden: true,
    },
  );
  const ordinary = definitionMinion(
    template,
    template.definitionId,
    "tier-five-ordinary",
    { attack: 10, health: 10 },
  );
  player.board = [nagaShield, golden, ordinary];
  player.hand = [
    tavernSpell("tavern-spell-queens-command", "queen-command"),
    tavernSpell("tavern-spell-sanctify", "sanctify"),
    tavernSpell("tavern-spell-wave-of-gold", "wave-of-gold"),
  ];
  for (const cardInstanceId of [
    "queen-command",
    "sanctify",
    "wave-of-gold",
  ]) {
    state = gameReducer(state, {
      type: "CAST_TAVERN_SPELL",
      cardInstanceId,
    });
  }
  player = humanPlayer(state);
  assert.deepEqual(
    player.board.map((minion) => [minion.attack, minion.health]),
    [
      [23, 16],
      [18, 16],
      [15, 14],
    ],
  );
});

test("Invoke the Devourer performs a real sale before buffing the only remaining friendly minion", () => {
  let state = createGame(0x7509);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const sold = definitionMinion(
    template,
    template.definitionId,
    "devourer-sold",
    { attack: 4, health: 6, sellValue: 2, poolCopies: 0 },
  );
  const recipient = definitionMinion(
    template,
    template.definitionId,
    "devourer-recipient",
    { attack: 3, health: 5 },
  );
  player.board = [sold, recipient];
  player.hand = [
    tavernSpell(
      "tavern-spell-invoke-the-devourer",
      "invoke-devourer",
    ),
  ];
  const goldBefore = player.gold;

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "invoke-devourer",
    targetInstanceId: sold.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.gold, goldBefore + 2);
  assert.equal(player.board.length, 1);
  assert.equal(player.board[0].instanceId, recipient.instanceId);
  assert.deepEqual(
    [player.board[0].attack, player.board[0].health],
    [7, 11],
  );
});

test("Saloon's Finest creates seven independently purchasable spell offers and conserves the shared pool", () => {
  let state = createGame(0x7510);
  let player = humanPlayer(state);
  player.tavernTier = 5;
  player.hand = [
    tavernSpell("tavern-spell-saloons-finest", "saloons-finest"),
  ];
  const totalsBefore = Object.fromEntries(
    TAVERN_SPELL_DEFINITIONS.map((definition) => [
      definition.id,
      totalSpellCopies(state, definition.id),
    ]),
  );

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "saloons-finest",
  });
  player = humanPlayer(state);
  const offers = [
    ...(player.spellShop ? [player.spellShop] : []),
    ...player.additionalSpellShop,
  ];
  assert.equal(player.spellOnlyRefreshActive, true);
  assert.equal(player.shop.length, 0);
  assert.equal(offers.length, 7);
  assert.ok(
    offers.every(
      (offer) =>
        offer.tier <= player.tavernTier &&
        offer.definitionId !== "tavern-spell-saloons-finest",
    ),
  );
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(state, definition.id),
      totalsBefore[definition.id],
      `${definition.name} must remain conserved after the spell-only refresh`,
    );
  }

  const chosen = player.additionalSpellShop.at(-1);
  assert.ok(chosen);
  player.gold = 100;
  state = gameReducer(state, {
    type: "BUY_TAVERN_SPELL",
    spellInstanceId: chosen.instanceId,
  });
  player = humanPlayer(state);
  assert.ok(
    player.hand.some((card) => card.instanceId === chosen.instanceId),
  );
  assert.equal(
    player.additionalSpellShop.some(
      (offer) => offer.instanceId === chosen.instanceId,
    ),
    false,
  );
  assert.equal(
    totalSpellCopies(state, chosen.definitionId),
    totalsBefore[chosen.definitionId],
  );

  const remainingOfferIds = [
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((offer) => offer.instanceId),
  ];
  assert.equal(remainingOfferIds.length, 6);
  player.frozen = true;
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  const nextTurnOfferIds = [
    ...(player.spellShop ? [player.spellShop.instanceId] : []),
    ...player.additionalSpellShop.map((offer) => offer.instanceId),
  ];
  assert.equal(
    player.spellOnlyRefreshActive,
    false,
    "the frozen special page becomes an ordinary mixed Tavern next turn",
  );
  assert.equal(player.frozen, false);
  assert.deepEqual(nextTurnOfferIds, remainingOfferIds);
  assert.equal(
    player.shop.length,
    0,
    "Tier 5 already has its six-card start-of-turn Tavern cap",
  );
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(state, definition.id),
      totalsBefore[definition.id],
      `${definition.name} must remain conserved across a frozen round`,
    );
  }
});

test("Knockoff Wisdomball grants exactly two paid helpful Refreshes and never creates an empty Tavern", () => {
  let state = createGame(0x7520);
  let player = humanPlayer(state);
  player.tavernTier = 6;
  player.hand = [
    tavernSpell(
      "tavern-spell-knockoff-wisdomball",
      "knockoff-wisdomball",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "knockoff-wisdomball",
  });
  player = humanPlayer(state);
  assert.equal(player.helpfulRefreshes, 2);
  assert.equal(player.lastHelpfulRefreshKind, null);

  player.gold = 0;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.helpfulRefreshes, 2);

  player.freeRefreshes = 1;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.freeRefreshes, 0);
  assert.equal(player.helpfulRefreshes, 1);
  assert.ok(player.lastHelpfulRefreshKind);
  assert.equal(
    player.shop.length +
      (player.spellShop ? 1 : 0) +
      player.additionalSpellShop.length,
    7,
  );

  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  player = humanPlayer(state);
  assert.equal(
    player.helpfulRefreshes,
    1,
    "the automatic start-of-turn Tavern does not consume Wisdomball",
  );

  player.gold = 1;
  state = gameReducer(state, { type: "REFRESH_SHOP" });
  player = humanPlayer(state);
  assert.equal(player.gold, 0);
  assert.equal(player.helpfulRefreshes, 0);
  assert.ok(player.lastHelpfulRefreshKind);
  assert.ok(
    player.shop.length +
      (player.spellShop ? 1 : 0) +
      player.additionalSpellShop.length >
      0,
  );

  let exhausted = createGame(0x7523);
  let exhaustedPlayer = humanPlayer(exhausted);
  exhaustedPlayer.shop = [];
  exhaustedPlayer.spellShop = null;
  exhaustedPlayer.additionalSpellShop = [];
  for (const definitionId of Object.keys(exhausted.pool)) {
    exhausted.pool[definitionId] = 0;
  }
  for (const definitionId of Object.keys(exhausted.spellPool)) {
    exhausted.spellPool[definitionId] = 0;
  }
  exhaustedPlayer.helpfulRefreshes = 1;
  exhaustedPlayer.gold = 1;
  exhausted = gameReducer(exhausted, { type: "REFRESH_SHOP" });
  exhaustedPlayer = humanPlayer(exhausted);
  assert.ok(exhaustedPlayer.shop.length > 0);
  assert.ok(
    exhaustedPlayer.shop.every(
      (minion) =>
        minion.poolCopies === 0 &&
        minion.poolCopiesOnPurchase === 1,
    ),
    "Wisdomball overflow must not expand the finite shared pool",
  );
  let claimed = jsonClone(exhausted);
  let claimedPlayer = humanPlayer(claimed);
  const claimedOffer = claimedPlayer.shop[0];
  assert.ok(claimedOffer);
  claimedPlayer.gold = 3;
  claimed = gameReducer(claimed, {
    type: "BUY_MINION",
    shopIndex: 0,
  });
  claimedPlayer = humanPlayer(claimed);
  const claimedMinion = claimedPlayer.hand.find(
    (card): card is BoardMinionInstance =>
      card.kind === "minion" &&
      card.instanceId === claimedOffer.instanceId,
  );
  assert.ok(claimedMinion);
  assert.equal(claimedMinion.poolCopies, 1);
  assert.equal(claimedMinion.poolCopiesOnPurchase, undefined);
  claimedPlayer.hand = [];
  claimedPlayer.board = [claimedMinion];
  claimed = gameReducer(claimed, {
    type: "SELL_MINION",
    boardIndex: 0,
  });
  assert.equal(claimed.pool[claimedMinion.definitionId], 1);

  exhaustedPlayer.gold = 1;
  exhausted = gameReducer(exhausted, { type: "REFRESH_SHOP" });
  assert.ok(
    Object.values(exhausted.pool).every((copies) => copies === 0),
    "releasing unbought overflow keeps an exhausted pool exhausted",
  );
});

test("Wisdomball uses plain warband copies, a full Legendary page, and enough copies for a triple", () => {
  let firstCopyPoolBefore = 0;
  let secondCopyPoolBefore = 0;
  const copied = gameWithHelpfulRefresh(
    "warbandCopies",
    (state, player) => {
      const template = player.shop[0];
      assert.ok(template);
      firstCopyPoolBefore = state.pool.BG35_801;
      secondCopyPoolBefore = state.pool.BG_LOE_077;
      player.board = [
        definitionMinion(template, "BG35_801", "copy-source-one", {
          attack: 40,
          health: 40,
          golden: true,
        }),
        definitionMinion(template, "BG_LOE_077", "copy-source-two", {
          attack: 30,
          health: 30,
        }),
      ];
    },
  );
  const copiedShop = humanPlayer(copied).shop;
  assert.deepEqual(
    copiedShop.map((minion) => minion.definitionId),
    ["BG35_801", "BG_LOE_077"],
  );
  assert.ok(copiedShop.every((minion) => !minion.golden));
  assert.ok(copiedShop.every((minion) => minion.poolCopies === 1));
  assert.equal(copied.pool.BG35_801, firstCopyPoolBefore - 1);
  assert.equal(copied.pool.BG_LOE_077, secondCopyPoolBefore - 1);
  assert.deepEqual(
    copiedShop.map((minion) => [minion.attack, minion.health]),
    [
      [
        getMinionDefinition("BG35_801").attack,
        getMinionDefinition("BG35_801").health,
      ],
      [
        getMinionDefinition("BG_LOE_077").attack,
        getMinionDefinition("BG_LOE_077").health,
      ],
    ],
  );

  const legendary = gameWithHelpfulRefresh(
    "legendary",
    (_state, player) => {
      player.board = [];
      player.hand = [];
    },
  );
  const legendaryShop = humanPlayer(legendary).shop;
  assert.equal(legendaryShop.length, 7);
  assert.ok(
    legendaryShop.every(
      (minion) =>
        getMinionDefinition(minion.definitionId).legendary === true,
    ),
  );

  let triplePoolBefore = 0;
  const triple = gameWithHelpfulRefresh(
    "triple",
    (state, player) => {
      const template = player.shop[0];
      assert.ok(template);
      triplePoolBefore = state.pool.BG35_801;
      player.board = [
        definitionMinion(template, "BG35_801", "triple-source", {
          attack: 50,
          health: 50,
        }),
      ];
      player.hand = [];
    },
  );
  const tripleShop = humanPlayer(triple).shop;
  assert.equal(tripleShop.length, 7);
  assert.deepEqual(
    tripleShop.slice(0, 2).map((minion) => minion.definitionId),
    ["BG35_801", "BG35_801"],
  );
  assert.ok(
    tripleShop.slice(0, 2).every(
      (minion) =>
        minion.attack === getMinionDefinition("BG35_801").attack &&
        minion.health === getMinionDefinition("BG35_801").health &&
        minion.poolCopies === 1,
    ),
  );
  assert.equal(triple.pool.BG35_801, triplePoolBefore - 2);
});

test("Eyes of the Earth Mother targets only a friendly non-Golden Tier 4-or-lower minion and preserves enchantments", () => {
  let state = createGameWithTribes(["quilboar"], 0x7521);
  let player = humanPlayer(state);
  const template = player.shop[0];
  assert.ok(template);
  const definition = getMinionDefinition("BG28_583");
  const target = definitionMinion(
    template,
    definition.id,
    "eyes-target",
    {
      attack: definition.attack + 5,
      health: definition.health + 7,
      bloodGemAttack: 2,
      bloodGemHealth: 3,
      poolCopies: 1,
    },
  );
  const tooHigh = definitionMinion(
    template,
    "BG23_018",
    "eyes-too-high",
  );
  const alreadyGolden = definitionMinion(
    template,
    definition.id,
    "eyes-golden",
    { golden: true },
  );
  player.board = [target, tooHigh, alreadyGolden];
  const spell = tavernSpell(
    "tavern-spell-eyes-of-earth-mother",
    "eyes-of-earth-mother",
  );
  player.hand = [spell];

  assert.deepEqual(
    getLegalTavernSpellTargetIds(state, player.id, spell),
    [target.instanceId],
  );
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: spell.instanceId,
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  const golden = player.board[0];
  assert.equal(golden.golden, true);
  assert.equal(golden.attack, definition.attack * 2 + 5);
  assert.equal(golden.health, definition.health * 2 + 7);
  assert.equal(golden.bloodGemAttack, 2);
  assert.equal(golden.bloodGemHealth, 3);
  assert.equal(golden.poolCopies, 1);
  assert.equal(golden.grantsTripleReward, false);
  assert.equal(player.hand.length, 0);
});

test("Hamuul's Lost Staff replaces the full Tavern with the chosen minion type", () => {
  let state = createGameWithTribes(["quilboar"], 0x7522);
  let player = humanPlayer(state);
  player.tavernTier = 6;
  const template = player.shop[0];
  assert.ok(template);
  const target = definitionMinion(
    template,
    "BG20_100",
    "hamuul-quilboar",
  );
  player.board = [target];
  player.hand = [
    tavernSpell(
      "tavern-spell-lost-staff-of-hamuul",
      "lost-staff-of-hamuul",
    ),
  ];

  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "lost-staff-of-hamuul",
    targetInstanceId: target.instanceId,
  });
  player = humanPlayer(state);
  assert.equal(player.shop.length, 7);
  assert.equal(player.spellShop, null);
  assert.deepEqual(player.additionalSpellShop, []);
  assert.ok(
    player.shop.every(
      (minion) =>
        minion.tribes.includes("quilboar") ||
        minion.tribes.includes("all"),
    ),
  );
  assert.equal(player.frozen, false);

  let exhausted = createGameWithTribes(["quilboar"], 0x7524);
  let exhaustedPlayer = humanPlayer(exhausted);
  const exhaustedTemplate = exhaustedPlayer.shop[0];
  assert.ok(exhaustedTemplate);
  const exhaustedTarget = definitionMinion(
    exhaustedTemplate,
    "BG20_100",
    "hamuul-exhausted-target",
  );
  exhaustedPlayer.board = [exhaustedTarget];
  exhaustedPlayer.hand = [
    tavernSpell(
      "tavern-spell-lost-staff-of-hamuul",
      "lost-staff-exhausted",
    ),
  ];
  exhaustedPlayer.shop = [];
  exhaustedPlayer.spellShop = null;
  exhaustedPlayer.additionalSpellShop = [];
  for (const definition of MINION_DEFINITIONS) {
    if (
      definition.tribes?.some(
        (tribe) => tribe === "quilboar" || tribe === "all",
      )
    ) {
      exhausted.pool[definition.id] = 0;
    }
  }
  exhausted = gameReducer(exhausted, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "lost-staff-exhausted",
    targetInstanceId: exhaustedTarget.instanceId,
  });
  exhaustedPlayer = humanPlayer(exhausted);
  assert.equal(
    exhaustedPlayer.shop.length,
    0,
    "Hamuul respects an exhausted matching shared pool",
  );
  assert.equal(exhaustedPlayer.spellShop, null);
  assert.deepEqual(exhaustedPlayer.additionalSpellShop, []);
});

test("Unmasked Identity exposes only the four implemented powers and resolves exactly once", () => {
  assert.deepEqual(
    new Set(HERO_POWER_DEFINITIONS.map((definition) => definition.effect)),
    new Set([
      "upgradeDiscount",
      "freeRefreshAtTurnStart",
      "gainGoldAfterUpgrade",
      "buffCombatSummons",
    ]),
  );
  let state = createGame(0x7511);
  let player = humanPlayer(state);
  player.heroPowerId = HERO_POWER_DEFINITIONS[0].id;
  player.hand = [
    tavernSpell(
      "tavern-spell-unmasked-identity",
      "unmasked-identity",
    ),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "unmasked-identity",
  });
  const pending = state.pendingInteraction;
  assert.ok(pending?.kind === "heroPowerChoice");
  assert.equal(pending.optionIds.length, 3);
  assert.equal(new Set(pending.optionIds).size, 3);
  assert.ok(
    pending.optionIds.every(
      (optionId) =>
        optionId !== player.heroPowerId &&
        HERO_POWER_DEFINITIONS.some(
          (definition) => definition.id === optionId,
        ),
    ),
  );
  const invalid = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: "unsupported-hero-power",
  });
  assert.equal(invalid, state);

  const chosenId = pending.optionIds[0];
  state = gameReducer(state, {
    type: "RESOLVE_INTERACTION",
    interactionId: pending.interactionId,
    optionInstanceId: chosenId,
  });
  player = humanPlayer(state);
  assert.equal(player.heroPowerId, chosenId);
  assert.equal(state.pendingInteraction, null);
  assert.equal(player.tavernSpellsCastThisTurn, 1);
});

test("the restricted Hero Power pool applies upgrade, economy, refresh, and combat-summon effects", () => {
  let state = createGame(0x7512);
  let player = humanPlayer(state);
  player.heroPowerId = "hero-power-experienced-bartender";
  const discountedCost = getUpgradeCost(state, player.id);
  player.heroPowerId = null;
  assert.equal(discountedCost, getUpgradeCost(state, player.id) - 1);

  player.heroPowerId = "hero-power-ever-blooming";
  player.gold = 20;
  const upgradeCost = getUpgradeCost(state, player.id);
  state = gameReducer(state, { type: "UPGRADE_TAVERN" });
  player = humanPlayer(state);
  assert.equal(player.gold, 20 - upgradeCost + 2);

  player.heroPowerId = "hero-power-see-the-future";
  const template = player.shop[0];
  assert.ok(template);
  player.board = [
    definitionMinion(template, template.definitionId, "future-refresh-board", {
      attack: 0,
      health: 20,
    }),
  ];
  keepOnlyOneOpponent(state, [
    definitionMinion(template, template.definitionId, "future-refresh-enemy", {
      attack: 0,
      health: 20,
    }),
  ]);
  state = gameReducer(state, { type: "END_TURN" });
  state = gameReducer(state, { type: "CONTINUE" });
  assert.equal(humanPlayer(state).freeRefreshes, 1);

  player = humanPlayer(state);
  player.heroPowerId = "hero-power-sprout-it-out";
  player.hand = [
    tavernSpell("tavern-spell-beetle-blessing", "hero-beetles"),
  ];
  state = gameReducer(state, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "hero-beetles",
  });
  state = gameReducer(state, { type: "END_TURN" });
  const battle = state.lastRoundBattles.find(
    (candidate) =>
      candidate.playerAId === player.id ||
      candidate.playerBId === player.id,
  );
  assert.ok(battle);
  const beetles = battle.events.filter(
    (event) =>
      event.type === "summon" &&
      event.actorPlayerId === player.id &&
      event.minion?.definitionId === "live-beetle-token",
  );
  assert.equal(beetles.length, 2);
  assert.ok(
    beetles.every(
      (event) =>
        event.minion?.attack === 3 &&
        event.minion.health === 4 &&
        event.minion.taunt,
    ),
  );
});

test("AI buys and casts useful Tavern Spells through the normal recruit path", () => {
  const state = createGame(0x71d0);
  const template = humanPlayer(state).shop[0];
  assert.ok(template);
  for (const player of state.players) {
    player.gold = 0;
    player.board = [];
    player.hand = [];
    player.shop = [];
    player.spellShop = null;
    player.frozen = false;
  }
  const ai = state.players.find((player) => !player.isHuman);
  assert.ok(ai);
  ai.gold = 1;
  ai.board = [
    definitionMinion(template, template.definitionId, "ai-spell-target", {
      attack: 5,
      health: 7,
    }),
  ];
  ai.spellShop = tavernSpell(
    "tavern-spell-tavern-dish-banana",
    "ai-banana-offer",
  );

  const combat = gameReducer(state, { type: "END_TURN" });
  const recruitedAi = combat.players.find(
    (player) => player.id === ai.id,
  );
  assert.ok(recruitedAi);
  assert.equal(recruitedAi.gold, 0);
  assert.equal(recruitedAi.spellShop, null);
  assert.equal(recruitedAi.hand.length, 0);
  assert.equal(recruitedAi.board[0].attack, 7);
  assert.equal(recruitedAi.board[0].health, 9);
  assert.equal(recruitedAi.tavernSpellsCastThisTurn, 1);
});

test("schema 10 saves migrate the complete Tier 6 spell pool to schema 11", () => {
  const current = createGame(0x71dd);
  const currentPlayer = humanPlayer(current);
  currentPlayer.gold = 7;
  const template = currentPlayer.shop[0];
  assert.ok(template);
  currentPlayer.board = [
    definitionMinion(template, "BG33_888", "legacy-hog-shepherd", {
      effectSupport: "partial",
    }),
  ];
  currentPlayer.hand = [
    definitionMinion(template, "BG35_433", "legacy-redtooth", {
      effectSupport: "partial",
    }),
  ];
  const legacy = jsonClone(current) as unknown as Record<string, unknown>;
  legacy.version = 10;
  legacy.contentVersion = LEGACY_SCHEMA_10_CONTENT_VERSION;
  const spellPool = legacy.spellPool;
  assert.ok(spellPool !== null && typeof spellPool === "object");
  for (const definitionId of [
    "tavern-spell-knockoff-wisdomball",
    "tavern-spell-eyes-of-earth-mother",
    "tavern-spell-lost-staff-of-hamuul",
  ]) {
    delete (spellPool as Record<string, unknown>)[definitionId];
  }
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  for (const legacyPlayer of players) {
    assert.ok(
      legacyPlayer !== null && typeof legacyPlayer === "object",
    );
    delete (legacyPlayer as Record<string, unknown>).helpfulRefreshes;
    delete (legacyPlayer as Record<string, unknown>)
      .lastHelpfulRefreshKind;
  }

  const migrated = migrateSchema10GameState(legacy);
  assertMigratedSchema11(migrated);
  const migratedPlayer = humanPlayer(migrated);
  assert.equal(migratedPlayer.board[0].effectSupport, "complete");
  const migratedHandCard = migratedPlayer.hand[0];
  assert.equal(
    migratedHandCard?.kind === "minion"
      ? migratedHandCard.effectSupport
      : null,
    "complete",
  );
  for (const definitionId of [
    "tavern-spell-knockoff-wisdomball",
    "tavern-spell-eyes-of-earth-mother",
    "tavern-spell-lost-staff-of-hamuul",
  ]) {
    assert.equal(
      totalSpellCopies(migrated, definitionId),
      SPELL_POOL_COPIES_BY_TIER[6],
    );
  }
  assert.equal(
    migrateSchema10GameState({
      version: 10,
      contentVersion: "wrong-content-version",
    }),
    null,
  );
});

test("schema 9 saves migrate Tier 5 state to schema 11 and conserve every spell offer", () => {
  const current = createGame(0x71de);
  humanPlayer(current).gold = 7;
  const legacy = jsonClone(current) as unknown as Record<string, unknown>;
  legacy.version = 9;
  legacy.contentVersion = LEGACY_SCHEMA_9_CONTENT_VERSION;
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  for (const legacyPlayer of players) {
    assert.ok(
      legacyPlayer !== null && typeof legacyPlayer === "object",
    );
    const record = legacyPlayer as Record<string, unknown>;
    delete record.armor;
    delete record.heroPowerId;
    delete record.additionalSpellShop;
    delete record.spellOnlyRefreshActive;
    delete record.nextCombatSetEnemyHealthToOne;
    delete record.nextCombatDoubleLeftmostAttack;
    delete record.undeadArmyAttackBonus;
    delete record.undeadArmyHealthBonus;
  }
  const lastBattle = legacy.lastBattle;
  if (lastBattle !== null && typeof lastBattle === "object") {
    const battle = lastBattle as Record<string, unknown>;
    delete battle.playerAArmorBefore;
    delete battle.playerBArmorBefore;
    delete battle.playerAArmorAfter;
    delete battle.playerBArmorAfter;
  }

  const migrated = migrateSchema9GameState(legacy);
  assertMigratedSchema11(migrated);
  assert.equal(
    migrateSchema9GameState({
      version: 9,
      contentVersion: "wrong-content-version",
    }),
    null,
  );
});

test("schema 7 saves migrate every minion zone and pending discover to schema 11", () => {
  let current = createGame(0x71df);
  const player = humanPlayer(current);
  player.gold = 7;
  player.hand = [
    tavernSpell("tavern-spell-new-sprout", "legacy-discover"),
  ];
  current = gameReducer(current, {
    type: "CAST_TAVERN_SPELL",
    cardInstanceId: "legacy-discover",
  });
  assert.equal(current.pendingInteraction?.kind, "discover");

  const legacy = jsonClone(current) as unknown as Record<string, unknown>;
  legacy.version = 7;
  legacy.contentVersion = LEGACY_SCHEMA_7_CONTENT_VERSION;
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  for (const legacyPlayer of players) {
    assert.ok(
      legacyPlayer !== null && typeof legacyPlayer === "object",
    );
    const record = legacyPlayer as Record<string, unknown>;
    delete record.nextCombatWinGold;
    delete record.nextCombatTieGold;
    delete record.nextTurnBoardAttackBonus;
    delete record.nextTurnBoardHealthBonus;
    delete record.nextTurnBoardBuffPulses;
    delete record.tavernBloodGemBarrageCount;
    delete record.tavernBloodGemBarrageAttack;
    delete record.tavernBloodGemBarrageHealth;
  }
  removePostSchema7MinionFields(legacy);

  const migrated = migrateSchema7GameState(legacy);
  assertMigratedSchema11(migrated);
  assert.equal(migrated.pendingInteraction?.kind, "discover");
});

test("schema 8 saves initialize Tier 4 and Spellcraft state in schema 11", () => {
  const migrated = migrateSchema8GameState(
    legacySchema8State(0x71e3),
  );
  assertMigratedSchema11(migrated);
  assert.equal(
    migrateSchema8GameState({
      version: 8,
      contentVersion: "wrong-content-version",
    }),
    null,
  );
});

test("schema 6 saves migrate to schema 11 and survive a JSON round-trip", () => {
  const migrated = migrateSchema6GameState(legacyState(6, 0x71e0));
  assertMigratedSchema11(migrated);
  assert.equal(humanPlayer(migrated).bloodGemAttack, 1);
  assert.equal(humanPlayer(migrated).bloodGemHealth, 1);
});

test("schema 6 migration does not reserve Tavern Spells for eliminated players", () => {
  const legacy = legacyState(6, 0x71e2);
  const players = legacy.players;
  assert.ok(Array.isArray(players));
  const eliminated = players[players.length - 1];
  assert.ok(eliminated !== null && typeof eliminated === "object");
  (eliminated as Record<string, unknown>).alive = false;
  (eliminated as Record<string, unknown>).health = 0;

  const migrated = migrateSchema6GameState(legacy);
  assert.ok(migrated !== null && typeof migrated === "object");
  const state = migrated as GameState;
  assert.equal(state.players.at(-1)?.spellShop, null);
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    assert.equal(
      totalSpellCopies(state, definition.id),
      tavernSpellIsAvailable(definition, state.activeTribes)
        ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
        : 0,
      `${definition.name} must not be locked by an eliminated player`,
    );
  }
});

test("schema 5 saves migrate through schema 6 to schema 11", () => {
  const migrated = migrateSchema5GameState(legacyState(5, 0x71e1));
  assertMigratedSchema11(migrated);
  assert.equal(humanPlayer(migrated).bloodGemAttack, 1);
  assert.equal(humanPlayer(migrated).bloodGemHealth, 1);
  assert.equal(migrateSchema5GameState({ version: 5 }), null);
  assert.equal(migrateSchema6GameState({ version: 6 }), null);
});
