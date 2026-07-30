// Explicit `.ts` specifiers keep the pure engine directly runnable by Node
// 24's built-in type stripping as well as by the app's Vite bundler.
import {
  CURRENT_ROSTER_VERSION,
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "./content.ts";
import {
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellCanTargetShop,
  tavernSpellIsAvailable,
  tavernSpellNeedsTarget,
  tavernSpellPurchaseCurrency,
} from "./tavern-spells.ts";
import {
  SPELLCRAFT_DEFINITIONS,
  getSpellcraftDefinition,
  spellcraftNeedsTarget,
} from "./spellcraft.ts";
import {
  HERO_POWER_DEFINITIONS,
  getHeroPowerDefinition,
} from "./hero-powers.ts";
import {
  aiTargetBoardSize,
  getAiStrategyProfile,
  shouldAiUpgrade,
} from "./ai.ts";
import type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemBonusKeyword,
  BloodGemSpellInstance,
  BoardMinionInstance,
  BuffRandomHandMinionEffect,
  BuffEffect,
  ConsolationCoinSpellInstance,
  DiscoverDestination,
  DiscoverFilter,
  GameAction,
  GameState,
  GainTavernSpellEffect,
  GetRandomMinionEffect,
  HelpfulRefreshKind,
  HeroPowerDefinition,
  MagneticAttachment,
  MinionEffect,
  MinionInstance,
  PendingDiscoverInteraction,
  TavernSpellChoiceId,
  PlayerId,
  PlayerState,
  RallyRemoveTargetKeywordsEffect,
  RallyRemovedKeyword,
  RallySummonFromHandEffect,
  SpellcraftDefinition,
  SpellcraftSpellInstance,
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemBonusKeyword,
  BloodGemSpellInstance,
  BoardMinionInstance,
  ConsolationCoinSpellInstance,
  GameAction,
  GamePhase,
  GameState,
  HandCardInstance,
  HelpfulRefreshKind,
  HeroPowerDefinition,
  MagneticAttachment,
  MinionDefinition,
  MinionEffect,
  MinionInstance,
  PendingInteraction,
  PlayerId,
  PlayerState,
  SpellFamily,
  SpellcraftDefinition,
  SpellcraftEffect,
  SpellcraftSpellInstance,
  SpellcraftTarget,
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernSpellTarget,
  TavernTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export {
  HERO_POWER_DEFINITIONS,
  getHeroPowerDefinition,
  isHeroPowerDefinitionId,
} from "./hero-powers.ts";

export {
  AI_STRATEGY_PROFILES,
  aiTargetBoardSize,
  getAiStrategyProfile,
  shouldAiUpgrade,
} from "./ai.ts";

export {
  SPELLCRAFT_DEFINITIONS,
  getSpellcraftDefinition,
  spellcraftNeedsTarget,
} from "./spellcraft.ts";

export {
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellCanTargetShop,
  tavernSpellIsAvailable,
  tavernSpellNeedsTarget,
  tavernSpellPurchaseCurrency,
} from "./tavern-spells.ts";

export const HELPFUL_REFRESH_LABELS: Readonly<
  Record<HelpfulRefreshKind, string>
> = {
  warbandCopies: "战队原始复制",
  legendary: "传说随从",
  golden: "金色随从",
  triple: "凑成三连",
  divineShield: "全员圣盾",
  tavernBuff: "酒馆等级强化",
  majorityTribe: "多数随从类型",
  highTier: "高等级随从",
  allSame: "整页同一随从",
  utility: "功能随从",
  allSpells: "整页酒馆法术",
};

const HUMAN_PLAYER_ID = "player-0";
const PLAYER_NAMES = [
  "你",
  "酒馆老手",
  "机械收藏家",
  "恶魔商人",
  "鱼人侦察兵",
  "龙族学者",
  "海盗船长",
  "野兽驯养师",
] as const;

// Tavern Spells occupy the extra card slot documented in Patch 34.2. The UI
// interleaves that offer with these normal minion offers, as the live game does.
// Patch 23.6 reduced Tier 1 to 15 copies, matching Tier 2; the remaining copy
// counts retain the 13/11/9/7 distribution.
const SHOP_SIZE_BY_TIER = [0, 3, 4, 4, 5, 5, 6] as const;
const UPGRADE_BASE_COST = [0, 5, 7, 8, 11, 12, 0] as const;
const POOL_COPIES_BY_TIER = [0, 15, 15, 13, 11, 9, 7] as const;
const SPELL_POOL_COPIES_BY_TIER = [0, 5, 7, 9, 11, 7, 5] as const;
const HELPFUL_REFRESH_KINDS = Object.freeze(
  Object.keys(HELPFUL_REFRESH_LABELS) as HelpfulRefreshKind[],
);
const HELPFUL_UTILITY_MINION_IDS = new Set([
  "BG_DAL_775",
  "BG_LOE_077",
  "BG25_354",
]);
const DEFAULT_SEED = 0x4853544e;
const MAX_BOARD_SIZE = 7;
const MAX_HAND_SIZE = 10;
const BUY_COST = 3;
const REFRESH_COST = 1;
const MAX_COMBAT_ATTACKS = 100;
const TRIPLE_REWARD_CARD_ID = "TB_BaconShop_Triples_01" as const;
const TRIPLE_REWARD_DEFINITION_ID = "triple-reward" as const;
const BLOOD_GEM_CARD_ID = "BG20_GEM" as const;
const BLOOD_GEM_DEFINITION_ID = "blood-gem" as const;
const CONSOLATION_COIN_CARD_ID = "BG28_521t" as const;
const CONSOLATION_COIN_DEFINITION_ID = "consolation-coin" as const;
const ASTRAL_AUTOMATON_DEFINITION_ID = "BG_TTN_401" as const;
const ETERNAL_KNIGHT_DEFINITION_ID = "BG25_008" as const;
const ANCIENT_SOUL_DEFINITION_ID = "BG34_231" as const;
const ANCIENT_SOUL_DEATHS_REQUIRED = 15;
const UPBEAT_FRONTDRAKE_DEFINITION_ID = "BG26_529" as const;
const HUNGRY_TROG_DEFINITION_ID = "BG35_801" as const;
const CRIMSON_SURVIVOR_DEFINITION_ID = "BG35_814" as const;
const PERIODIC_TURN_COUNTER = "periodicEndOfTurn";
const PURCHASE_PROGRESS_COUNTER = "cardPurchases";
const LOBBY_TRIBES: readonly Tribe[] = [
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

type MutableTier = TavernTier;

interface Pairing {
  playerA: PlayerState;
  playerB: PlayerState;
  isGhost: boolean;
}

interface DeadMinion {
  minion: MinionInstance;
  index: number;
  ownerId: PlayerId;
}

interface MinionEffectSource {
  definitionId: string;
  golden: boolean;
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function cloneMagneticAttachment(
  attachment: MagneticAttachment,
): MagneticAttachment {
  return {
    ...attachment,
    attachments: attachment.attachments.map(cloneMagneticAttachment),
  };
}

function cloneMinion(minion: MinionInstance): BoardMinionInstance {
  if (minion.kind !== "minion") {
    throw new Error("Only minions can be cloned onto a combat board");
  }
  return {
    ...minion,
    kind: "minion",
    effectCounters: { ...(minion.effectCounters ?? {}) },
    attachments: minion.attachments.map(cloneMagneticAttachment),
  };
}

function cloneBoard(
  board: readonly BoardMinionInstance[],
): BoardMinionInstance[] {
  return board.map(cloneMinion);
}

function collectAttachmentEffectSources(
  attachment: MagneticAttachment,
  sources: MinionEffectSource[],
): void {
  sources.push({
    definitionId: attachment.definitionId,
    golden: attachment.golden,
  });
  for (const nested of attachment.attachments) {
    collectAttachmentEffectSources(nested, sources);
  }
}

function minionEffectSources(
  minion: MinionInstance,
): MinionEffectSource[] {
  const sources: MinionEffectSource[] = [
    {
      definitionId: minion.definitionId,
      golden: minion.golden,
    },
  ];
  for (const attachment of minion.attachments) {
    collectAttachmentEffectSources(attachment, sources);
  }
  return sources;
}

export function minionHasTribe(
  minion: Pick<BoardMinionInstance, "tribe" | "tribes">,
  tribe: Tribe | undefined,
): boolean {
  if (!tribe || tribe === "neutral") {
    return minion.tribe === "neutral";
  }
  return minion.tribes.includes("all") || minion.tribes.includes(tribe);
}

export function canMagnetize(
  source: BoardMinionInstance,
  target: BoardMinionInstance,
): boolean {
  if (source.instanceId === target.instanceId) {
    return false;
  }
  const magnetic = getMinionDefinition(source.definitionId).magnetic;
  return (
    magnetic !== undefined &&
    magnetic.targetTribes.some((tribe) =>
      minionHasTribe(target, tribe),
    )
  );
}

function definitionIsAvailable(
  definition: (typeof MINION_DEFINITIONS)[number],
  activeTribes: readonly Tribe[],
): boolean {
  if (definition.collectible === false) {
    return false;
  }
  const cardTribes =
    definition.tribes ??
    (definition.tribe === "neutral" ? [] : [definition.tribe]);
  const associatedTribes = definition.associatedTribes ?? [];
  if (
    cardTribes.length === 0 &&
    associatedTribes.length === 0
  ) {
    return true;
  }
  if (cardTribes.includes("all")) {
    return true;
  }
  return [...cardTribes, ...associatedTribes].some((tribe) =>
    activeTribes.includes(tribe),
  );
}

function normalizeSeed(seed: number | undefined): number {
  if (seed === undefined || !Number.isFinite(seed)) {
    return DEFAULT_SEED;
  }
  const normalized = seed >>> 0;
  return normalized === 0 ? DEFAULT_SEED : normalized;
}

/** xorshift32: small, fast, serializable, and deterministic on JS bitwise ops. */
function nextRandom(state: GameState): number {
  let value = state.rngState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.rngState = value >>> 0;
  return state.rngState / 0x1_0000_0000;
}

function randomIndex(state: GameState, length: number): number {
  if (length <= 1) {
    return 0;
  }
  return Math.floor(nextRandom(state) * length);
}

function shuffleInPlace<T>(state: GameState, values: T[]): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(state, index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
}

function findPlayer(
  state: GameState,
  playerId: PlayerId,
): PlayerState | undefined {
  return state.players.find((player) => player.id === playerId);
}

function humanPlayer(state: GameState): PlayerState {
  const player = findPlayer(state, state.humanPlayerId);
  if (!player) {
    throw new Error("Game state has no human player");
  }
  return player;
}

interface HeroDamageResult {
  armorAbsorbed: number;
  healthDamage: number;
}

function damagePlayer(
  player: PlayerState,
  amount: number,
): HeroDamageResult {
  const safeAmount = Math.max(0, amount);
  const armorAbsorbed = Math.min(player.armor, safeAmount);
  const healthDamage = safeAmount - armorAbsorbed;
  player.armor -= armorAbsorbed;
  player.health -= healthDamage;
  return { armorAbsorbed, healthDamage };
}

function playerHasHeroPower(
  player: PlayerState,
  effect: HeroPowerDefinition["effect"],
): boolean {
  return (
    player.heroPowerId !== null &&
    getHeroPowerDefinition(player.heroPowerId).effect === effect
  );
}

function initialEffectCounters(
  definitionId: string,
): Record<string, number> {
  if (definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID) {
    return { [PERIODIC_TURN_COUNTER]: 3 };
  }
  if (definitionId === HUNGRY_TROG_DEFINITION_ID) {
    return { [PURCHASE_PROGRESS_COUNTER]: 0 };
  }
  return {};
}

function createMinionInstance(
  state: GameState,
  definitionId: string,
  poolCopies: number,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const instance: BoardMinionInstance = {
    kind: "minion",
    instanceId: `minion-${state.nextInstanceId}`,
    definitionId: definition.id,
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
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: initialEffectCounters(definition.id),
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies,
    attachments: [],
  };
  state.nextInstanceId += 1;
  refreshDynamicMinionDescription(instance);
  return instance;
}

function describeGoldenMinion(description: string): string {
  return `金色随从：基础属性已翻倍；可倍增的效果会按金色规则结算。普通版本牌面：${description}`;
}

function goldenMinionDescription(definitionId: string): string {
  const definition = getMinionDefinition(definitionId);
  return (
    definition.goldenDescription ??
    describeGoldenMinion(definition.description)
  );
}

function effectCounter(
  minion: MinionInstance,
  key: string,
  fallback: number,
): number {
  return minion.effectCounters?.[key] ?? fallback;
}

function setEffectCounter(
  minion: MinionInstance,
  key: string,
  value: number,
): void {
  minion.effectCounters ??= {};
  minion.effectCounters[key] = value;
}

function refreshDynamicMinionDescription(
  minion: MinionInstance,
): void {
  if (minion.definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID) {
    const remaining = Math.max(
      1,
      effectCounter(minion, PERIODIC_TURN_COUNTER, 3),
    );
    const reward = minion.golden ? "2张龙牌" : "一张龙牌";
    const status =
      remaining === 1
        ? "（就是这回合！）"
        : `（还剩${remaining}回合！）`;
    minion.description = `每3个回合，在回合结束时，随机获取${reward}。${status}`;
    return;
  }
  if (minion.definitionId === HUNGRY_TROG_DEFINITION_ID) {
    const definition = getMinionDefinition(minion.definitionId);
    const purchases = effectCounter(
      minion,
      PURCHASE_PROGRESS_COUNTER,
      0,
    );
    const required = definition.afterCardPurchased?.purchases ?? 4;
    const stats = minion.golden ? "+8/+8" : "+4/+4";
    const status =
      purchases < 0
        ? "（已完成！）"
        : `（还剩${Math.max(0, required - purchases)}张！）`;
    minion.description = `一旦你购买了${required}张牌，获得${stats}。${status}`;
    return;
  }
  if (
    minion.definitionId === CRIMSON_SURVIVOR_DEFINITION_ID &&
    minion.divineShield &&
    minion.attack >= 6
  ) {
    minion.description =
      "一旦本随从的攻击力达到6点，获得圣盾。（已完成！）";
  }
}

function makeGoldenToken(
  minion: BoardMinionInstance,
): BoardMinionInstance {
  if (minion.golden) {
    return minion;
  }
  const definition = getMinionDefinition(minion.definitionId);
  minion.golden = true;
  minion.cardId = definition.goldenCardId ?? definition.cardId;
  minion.name = `金色·${definition.name}`;
  minion.attack *= 2;
  minion.health *= 2;
  minion.sellValue =
    definition.goldenSellValue ?? minion.sellValue;
  minion.description = goldenMinionDescription(definition.id);
  if (definition.id === ANCIENT_SOUL_DEFINITION_ID) {
    minion.ancientSoulFriendlyDeaths = ANCIENT_SOUL_DEATHS_REQUIRED;
  }
  refreshDynamicMinionDescription(minion);
  return minion;
}

function makeMinionGoldenPreservingEnchantments(
  minion: MinionInstance,
): MinionInstance {
  if (minion.golden) {
    return minion;
  }
  const definition = getMinionDefinition(minion.definitionId);
  minion.golden = true;
  minion.cardId = definition.goldenCardId ?? definition.cardId;
  minion.name = `金色·${definition.name}`;
  // Golden Touch and Eyes of the Earth Mother add the second copy of the
  // printed base stats. Existing
  // Tavern buffs and enchantments are retained once rather than doubled.
  minion.attack += definition.attack;
  minion.health += definition.health;
  minion.sellValue =
    definition.goldenSellValue ?? minion.sellValue;
  minion.description = goldenMinionDescription(definition.id);
  minion.grantsTripleReward = false;
  if (definition.id === ANCIENT_SOUL_DEFINITION_ID) {
    minion.ancientSoulFriendlyDeaths = ANCIENT_SOUL_DEATHS_REQUIRED;
  }
  refreshDynamicMinionDescription(minion);
  return minion;
}

function createTripleRewardSpell(
  state: GameState,
  tavernTier: TavernTier,
): TripleRewardSpellInstance {
  const rewardTier = Math.min(6, tavernTier + 1) as TavernTier;
  const instance: TripleRewardSpellInstance = {
    kind: "tripleReward",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: TRIPLE_REWARD_DEFINITION_ID,
    cardId: TRIPLE_REWARD_CARD_ID,
    name: "三连奖励",
    tier: rewardTier,
    tribe: "neutral",
    tribes: [],
    associatedTribes: [],
    effectSupport: "complete",
    sellValue: 0,
    attack: 0,
    health: 0,
    golden: false,
    taunt: false,
    divineShield: false,
    reborn: false,
    poisonous: false,
    venomous: false,
    windfury: false,
    cleave: false,
    alwaysAttacksLowestAttack: false,
    description: `发现一个 ${rewardTier} 级随从。`,
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    whereverAttackBonus: 0,
    whereverHealthBonus: 0,
    astralAutomatonSummoned: false,
    ancientSoulFriendlyDeaths: 0,
    effectCounters: {},
    temporaryAttack: 0,
    temporaryHealth: 0,
    temporaryTaunt: false,
    temporaryDivineShield: false,
    temporaryCrabDeathrattles: 0,
    temporaryGoldenCrabDeathrattles: 0,
    grantsTripleReward: false,
    poolCopies: 0,
    attachments: [],
  };
  state.nextInstanceId += 1;
  return instance;
}

function grantTripleRewardBeforeGeneratedCards(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (!minion.grantsTripleReward) {
    return;
  }
  minion.grantsTripleReward = false;
  if (player.hand.length < MAX_HAND_SIZE) {
    player.hand.push(
      createTripleRewardSpell(state, player.tavernTier),
    );
  }
}

function bloodGemBonusDescription(
  bonusKeyword: BloodGemBonusKeyword | undefined,
): string {
  switch (bonusKeyword) {
    case "rebornForQuilboar":
      return "如果目标是野猪人，还会使其获得复生。";
    case "divineShieldForQuilboar":
      return "如果目标是野猪人，还会使其获得圣盾。";
    default:
      return "";
  }
}

function createBloodGemSpell(
  state: GameState,
  bonusKeyword?: BloodGemBonusKeyword,
): BloodGemSpellInstance {
  const instance: BloodGemSpellInstance = {
    kind: "bloodGem",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: BLOOD_GEM_DEFINITION_ID,
    cardId: BLOOD_GEM_CARD_ID,
    name: "鲜血宝石",
    description: `使一个友方随从获得+1/+1。${bloodGemBonusDescription(
      bonusKeyword,
    )}`,
    spellFamily: "bloodGem",
    ...(bonusKeyword ? { bonusKeyword } : {}),
  };
  state.nextInstanceId += 1;
  return instance;
}

function createConsolationCoin(
  state: GameState,
): ConsolationCoinSpellInstance {
  const instance: ConsolationCoinSpellInstance = {
    kind: "consolationCoin",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: CONSOLATION_COIN_DEFINITION_ID,
    cardId: CONSOLATION_COIN_CARD_ID,
    name: "补贴铸币",
    description: "获得1枚铸币。（没有有效随从。）",
    spellFamily: "coin",
  };
  state.nextInstanceId += 1;
  return instance;
}

function createSpellcraftSpell(
  state: GameState,
  definition: SpellcraftDefinition,
  golden = false,
): SpellcraftSpellInstance {
  const instance: SpellcraftSpellInstance = {
    kind: "spellcraft",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId:
      golden && definition.goldenCardId
        ? definition.goldenCardId
        : definition.cardId,
    name: definition.name,
    description:
      golden && definition.goldenDescription
        ? definition.goldenDescription
        : definition.description,
    spellFamily: "spellcraft",
    target: definition.target,
    effectMultiplier: golden ? 2 : 1,
  };
  state.nextInstanceId += 1;
  return instance;
}

function createTavernSpell(
  state: GameState,
  definition: TavernSpellDefinition,
): TavernSpellInstance {
  const instance: TavernSpellInstance = {
    kind: "tavernSpell",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: definition.id,
    cardId: definition.cardId,
    name: definition.name,
    tier: definition.tier,
    cost: definition.cost,
    description: definition.description,
    spellFamily: "tavern",
    target: definition.target,
  };
  state.nextInstanceId += 1;
  return instance;
}

function drawTavernSpell(
  state: GameState,
  tavernTier: TavernTier,
  excludedDefinitionIds: ReadonlySet<string> = new Set(),
): TavernSpellInstance | null {
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= tavernTier &&
      !excludedDefinitionIds.has(definition.id) &&
      tavernSpellIsAvailable(definition, state.activeTribes) &&
      (state.spellPool[definition.id] ?? 0) > 0,
  );
  const totalCopies = eligible.reduce(
    (total, definition) =>
      total + (state.spellPool[definition.id] ?? 0),
    0,
  );
  if (totalCopies <= 0) {
    return null;
  }
  let roll = Math.floor(nextRandom(state) * totalCopies);
  let definition = eligible[0];
  for (const candidate of eligible) {
    const copies = state.spellPool[candidate.id] ?? 0;
    if (roll < copies) {
      definition = candidate;
      break;
    }
    roll -= copies;
  }
  state.spellPool[definition.id] -= 1;
  return createTavernSpell(state, definition);
}

function addBloodGems(
  state: GameState,
  player: PlayerState,
  count: number,
  bonusKeyword?: BloodGemBonusKeyword,
): number {
  let added = 0;
  for (
    let index = 0;
    index < count && player.hand.length < MAX_HAND_SIZE;
    index += 1
  ) {
    player.hand.push(createBloodGemSpell(state, bonusKeyword));
    added += 1;
  }
  return added;
}

function addConsolationCoin(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  player.hand.push(createConsolationCoin(state));
  return true;
}

function addRandomSpellcraftSpells(
  state: GameState,
  player: PlayerState,
  count: number,
): number {
  const eligible = SPELLCRAFT_DEFINITIONS.filter(
    (definition) => definition.sourceTier <= player.tavernTier,
  );
  let added = 0;
  while (
    added < count &&
    player.hand.length < MAX_HAND_SIZE &&
    eligible.length > 0
  ) {
    const definition = eligible[randomIndex(state, eligible.length)];
    player.hand.push(createSpellcraftSpell(state, definition));
    added += 1;
  }
  return added;
}

function addMinionSpellcraft(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  component: MinionEffectSource,
): boolean {
  const spellcraft =
    getMinionDefinition(component.definitionId).spellcraft;
  if (!spellcraft) {
    return false;
  }
  player.pendingSpellcraft.push({
    sourceInstanceId,
    definitionId: spellcraft.definitionId,
    golden: component.golden,
    round: state.round,
  });
  flushPendingSpellcraft(state, player);
  return true;
}

function flushPendingSpellcraft(
  state: GameState,
  player: PlayerState,
): void {
  player.pendingSpellcraft = player.pendingSpellcraft.filter(
    (pending) => {
      if (pending.round !== state.round) {
        return false;
      }
      const source = player.board.find(
        (minion) => minion.instanceId === pending.sourceInstanceId,
      );
      return (
        source !== undefined &&
        minionEffectSources(source).some(
          (component) =>
            getMinionDefinition(component.definitionId).spellcraft
              ?.definitionId === pending.definitionId,
        )
      );
    },
  );
  while (
    player.hand.length < MAX_HAND_SIZE &&
    player.pendingSpellcraft.length > 0
  ) {
    const pending = player.pendingSpellcraft.shift();
    if (!pending) {
      break;
    }
    player.hand.push(
      createSpellcraftSpell(
        state,
        getSpellcraftDefinition(pending.definitionId),
        pending.golden,
      ),
    );
  }
}

function grantPlayedMinionSpellcraft(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  for (const component of minionEffectSources(minion)) {
    addMinionSpellcraft(
      state,
      player,
      minion.instanceId,
      component,
    );
  }
}

function applyBloodGem(
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  applyBloodGemStats(
    target,
    player.bloodGemAttack,
    player.bloodGemHealth,
  );
}

function applyBloodGemStats(
  target: BoardMinionInstance,
  attack: number,
  health: number,
): void {
  target.attack += attack;
  target.health += health;
  target.bloodGemAttack += attack;
  target.bloodGemHealth += health;
  reconcileConditionalMinion(target);
}

function nextInteractionId(state: GameState): string {
  const interactionId = `interaction-${state.nextInteractionId}`;
  state.nextInteractionId += 1;
  return interactionId;
}

function returnAttachmentToPool(
  state: GameState,
  attachment: MagneticAttachment,
): void {
  if (attachment.poolCopies > 0) {
    state.pool[attachment.definitionId] =
      (state.pool[attachment.definitionId] ?? 0) +
      attachment.poolCopies;
  }
  for (const nested of attachment.attachments) {
    returnAttachmentToPool(state, nested);
  }
}

function returnMinionToPool(state: GameState, minion: MinionInstance): void {
  if (minion.poolCopies > 0) {
    state.pool[minion.definitionId] =
      (state.pool[minion.definitionId] ?? 0) + minion.poolCopies;
  }
  for (const attachment of minion.attachments) {
    returnAttachmentToPool(state, attachment);
  }
}

function claimGeneratedShopMinion(minion: BoardMinionInstance): void {
  if ((minion.poolCopiesOnPurchase ?? 0) > 0) {
    minion.poolCopies += minion.poolCopiesOnPurchase ?? 0;
    delete minion.poolCopiesOnPurchase;
  }
}

function clearAttachmentPoolCopies(
  attachment: MagneticAttachment,
): MagneticAttachment {
  return {
    ...attachment,
    poolCopies: 0,
    attachments: attachment.attachments.map(clearAttachmentPoolCopies),
  };
}

function attachmentGrantedStats(
  attachment: MagneticAttachment,
): { attack: number; health: number } {
  return attachment.attachments.reduce(
    (total, nested) => {
      const nestedStats = attachmentGrantedStats(nested);
      return {
        attack:
          total.attack + nested.attackGranted + nestedStats.attack,
        health:
          total.health + nested.healthGranted + nestedStats.health,
      };
    },
    { attack: 0, health: 0 },
  );
}

function createMagneticAttachment(
  source: BoardMinionInstance,
): MagneticAttachment {
  const nestedStats = source.attachments.reduce(
    (total, attachment) => {
      const descendantStats = attachmentGrantedStats(attachment);
      return {
        attack:
          total.attack +
          attachment.attackGranted +
          descendantStats.attack,
        health:
          total.health +
          attachment.healthGranted +
          descendantStats.health,
      };
    },
    { attack: 0, health: 0 },
  );
  return {
    sourceInstanceId: source.instanceId,
    definitionId: source.definitionId,
    cardId: source.cardId,
    name: source.name,
    description: source.description,
    effectSupport: source.effectSupport,
    golden: source.golden,
    poolCopies: 0,
    attackGranted:
      source.attack -
      source.temporaryAttack -
      nestedStats.attack,
    healthGranted:
      source.health -
      source.temporaryHealth -
      nestedStats.health,
    attachments: source.attachments.map(clearAttachmentPoolCopies),
  };
}

function drawMatchingFromPool(
  state: GameState,
  tavernTier: MutableTier,
  matches: (
    definition: (typeof MINION_DEFINITIONS)[number],
  ) => boolean,
): BoardMinionInstance | null {
  const eligible = MINION_DEFINITIONS.filter(
    (definition) =>
      definitionIsAvailable(definition, state.activeTribes) &&
      definition.tier <= tavernTier &&
      (state.pool[definition.id] ?? 0) > 0 &&
      matches(definition),
  );
  let totalCopies = 0;
  for (const definition of eligible) {
    totalCopies += state.pool[definition.id] ?? 0;
  }
  if (totalCopies <= 0) {
    return null;
  }

  let roll = Math.floor(nextRandom(state) * totalCopies);
  for (const definition of eligible) {
    const copies = state.pool[definition.id] ?? 0;
    if (roll < copies) {
      state.pool[definition.id] = copies - 1;
      return createMinionInstance(state, definition.id, 1);
    }
    roll -= copies;
  }
  return null;
}

function drawFromPool(
  state: GameState,
  tavernTier: MutableTier,
): BoardMinionInstance | null {
  return drawMatchingFromPool(state, tavernTier, () => true);
}

function definitionHasTribe(
  definition: (typeof MINION_DEFINITIONS)[number],
  tribe: Tribe,
): boolean {
  const tribes =
    definition.tribes ??
    (definition.tribe === "neutral" ? [] : [definition.tribe]);
  return tribes.includes("all") || tribes.includes(tribe);
}

function reserveDiscoverOptions(
  state: GameState,
  filter: DiscoverFilter,
): BoardMinionInstance[] {
  const candidates = MINION_DEFINITIONS.filter((definition) => {
    if (
      !definitionIsAvailable(definition, state.activeTribes) ||
      (state.pool[definition.id] ?? 0) <= 0
    ) {
      return false;
    }
    if (
      filter.exactTier !== undefined &&
      definition.tier !== filter.exactTier
    ) {
      return false;
    }
    if (
      filter.maximumTier !== undefined &&
      definition.tier > filter.maximumTier
    ) {
      return false;
    }
    if (
      filter.ability === "battlecry" &&
      !definition.printedMechanics?.includes("BATTLECRY")
    ) {
      return false;
    }
    if (
      filter.ability === "deathrattle" &&
      !definition.printedMechanics?.includes("DEATHRATTLE")
    ) {
      return false;
    }
    return (
      filter.tribe === undefined ||
      definitionHasTribe(definition, filter.tribe)
    );
  });
  const options: BoardMinionInstance[] = [];
  while (candidates.length > 0 && options.length < 3) {
    const totalCopies = candidates.reduce(
      (total, definition) => total + (state.pool[definition.id] ?? 0),
      0,
    );
    if (totalCopies <= 0) {
      break;
    }
    let roll = Math.floor(nextRandom(state) * totalCopies);
    let candidateIndex = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const copies = state.pool[candidates[index].id] ?? 0;
      if (roll < copies) {
        candidateIndex = index;
        break;
      }
      roll -= copies;
    }
    const [definition] = candidates.splice(candidateIndex, 1);
    state.pool[definition.id] -= 1;
    options.push(createMinionInstance(state, definition.id, 1));
  }
  return options;
}

function tavernSpellShopOffers(
  player: PlayerState,
): TavernSpellInstance[] {
  return [
    ...(player.spellShop ? [player.spellShop] : []),
    ...player.additionalSpellShop,
  ];
}

function releaseShop(state: GameState, player: PlayerState): void {
  for (const minion of player.shop) {
    returnMinionToPool(state, minion);
  }
  player.shop = [];
  for (const spell of tavernSpellShopOffers(player)) {
    state.spellPool[spell.definitionId] =
      (state.spellPool[spell.definitionId] ?? 0) + 1;
  }
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
}

function applyPersistentTavernBonuses(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  const matchingBuffs = player.tavernTypeBuffs.filter(
    (buff) =>
      buff.tribes.length > 0 &&
      (minion.tribes.includes("all") ||
        buff.tribes.some((tribe) => minionHasTribe(minion, tribe))),
  );
  minion.attack +=
    player.tavernMinionAttackBonus +
    matchingBuffs.reduce((total, buff) => total + buff.attack, 0);
  minion.health +=
    player.tavernMinionHealthBonus +
    matchingBuffs.reduce((total, buff) => total + buff.health, 0);
}

function applyOwnedUndeadArmyBonus(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  if (!minionHasTribe(minion, "undead")) {
    return;
  }
  minion.attack += player.undeadArmyAttackBonus;
  minion.health += player.undeadArmyHealthBonus;
}

function ancientSoulDescription(remainingDeaths: number): string {
  return `当本随从在你手牌中时，在15个友方随从死亡后，将本随从变为金色。（还剩${Math.max(
    0,
    remainingDeaths,
  )}个！）`;
}

function refreshAncientSoulDescription(
  minion: MinionInstance,
): void {
  if (minion.definitionId !== ANCIENT_SOUL_DEFINITION_ID) {
    return;
  }
  if (minion.golden) {
    minion.description = goldenMinionDescription(minion.definitionId);
    return;
  }
  minion.description = ancientSoulDescription(
    ANCIENT_SOUL_DEATHS_REQUIRED -
      (minion.ancientSoulFriendlyDeaths ?? 0),
  );
}

function desiredWhereverBonuses(
  minion: MinionInstance,
  astralAutomatonsSummoned: number,
  eternalKnightsDied: number,
): { attack: number; health: number } {
  if (minion.definitionId === ASTRAL_AUTOMATON_DEFINITION_ID) {
    const otherSummons = Math.max(
      0,
      astralAutomatonsSummoned -
        (minion.astralAutomatonSummoned === true ? 1 : 0),
    );
    return minion.golden
      ? { attack: otherSummons * 6, health: otherSummons * 4 }
      : { attack: otherSummons * 3, health: otherSummons * 2 };
  }
  if (minion.definitionId === ETERNAL_KNIGHT_DEFINITION_ID) {
    return minion.golden
      ? { attack: eternalKnightsDied * 8, health: eternalKnightsDied * 4 }
      : { attack: eternalKnightsDied * 4, health: eternalKnightsDied * 2 };
  }
  return { attack: 0, health: 0 };
}

function reconcileWhereverMinion(
  minion: MinionInstance,
  astralAutomatonsSummoned: number,
  eternalKnightsDied: number,
): { attack: number; health: number } {
  const desired = desiredWhereverBonuses(
    minion,
    astralAutomatonsSummoned,
    eternalKnightsDied,
  );
  const attackDelta =
    desired.attack - (minion.whereverAttackBonus ?? 0);
  const healthDelta =
    desired.health - (minion.whereverHealthBonus ?? 0);
  minion.attack += attackDelta;
  minion.health += healthDelta;
  minion.whereverAttackBonus = desired.attack;
  minion.whereverHealthBonus = desired.health;
  refreshAncientSoulDescription(minion);
  return { attack: attackDelta, health: healthDelta };
}

function ownedMinionCards(player: PlayerState): BoardMinionInstance[] {
  return [
    ...player.board,
    ...player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    ),
    ...player.shop,
  ];
}

function reconcileConditionalMinion(
  minion: MinionInstance,
): boolean {
  const effect =
    getMinionDefinition(minion.definitionId).conditionalKeyword;
  const gainedDivineShield =
    effect?.keyword === "divineShield" &&
    minion.attack >= effect.attackAtLeast &&
    !minion.divineShield;
  if (gainedDivineShield) {
    minion.divineShield = true;
    minion.temporaryDivineShield = false;
  }
  refreshDynamicMinionDescription(minion);
  return gainedDivineShield;
}

function reconcileConditionalMinions(player: PlayerState): void {
  for (const minion of ownedMinionCards(player)) {
    reconcileConditionalMinion(minion);
  }
}

function observeCardPurchase(player: PlayerState): void {
  for (const source of [...player.board]) {
    const effect =
      getMinionDefinition(source.definitionId).afterCardPurchased;
    if (!effect) {
      continue;
    }
    const progress = effectCounter(
      source,
      PURCHASE_PROGRESS_COUNTER,
      0,
    );
    if (progress < 0) {
      continue;
    }
    const nextProgress = progress + 1;
    if (nextProgress >= effect.purchases) {
      const scale =
        source.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
      source.attack += effect.attack * scale;
      source.health += effect.health * scale;
      setEffectCounter(source, PURCHASE_PROGRESS_COUNTER, -1);
    } else {
      setEffectCounter(
        source,
        PURCHASE_PROGRESS_COUNTER,
        nextProgress,
      );
    }
    refreshDynamicMinionDescription(source);
  }
  reconcileConditionalMinions(player);
}

function reconcilePlayerWhereverMinions(player: PlayerState): void {
  const astralAutomatonsSummoned =
    player.astralAutomatonsSummoned ?? 0;
  const eternalKnightsDied = player.eternalKnightsDied ?? 0;
  for (const minion of ownedMinionCards(player)) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned,
      eternalKnightsDied,
    );
  }
}

function observeRecruitAutomatonSummon(
  player: PlayerState,
  summoned: MinionInstance,
): void {
  if (
    summoned.kind !== "minion" ||
    summoned.definitionId !== ASTRAL_AUTOMATON_DEFINITION_ID
  ) {
    return;
  }
  summoned.astralAutomatonSummoned = true;
  player.astralAutomatonsSummoned =
    (player.astralAutomatonsSummoned ?? 0) + 1;
  reconcilePlayerWhereverMinions(player);
}

function observeAncientSoulFriendlyDeath(player: PlayerState): void {
  for (const card of player.hand) {
    if (
      card.kind !== "minion" ||
      card.definitionId !== ANCIENT_SOUL_DEFINITION_ID ||
      card.golden
    ) {
      continue;
    }
    card.ancientSoulFriendlyDeaths = Math.min(
      ANCIENT_SOUL_DEATHS_REQUIRED,
      (card.ancientSoulFriendlyDeaths ?? 0) + 1,
    );
    if (
      card.ancientSoulFriendlyDeaths >= ANCIENT_SOUL_DEATHS_REQUIRED
    ) {
      makeMinionGoldenPreservingEnchantments(card);
      card.grantsTripleReward = false;
    }
    refreshAncientSoulDescription(card);
  }
}

function observePersistentFriendlyDeath(
  player: PlayerState,
  minion: MinionInstance,
): void {
  observeAncientSoulFriendlyDeath(player);
  if (minion.definitionId !== ETERNAL_KNIGHT_DEFINITION_ID) {
    return;
  }
  player.eternalKnightsDied =
    (player.eternalKnightsDied ?? 0) + 1;
  reconcilePlayerWhereverMinions(player);
}

function tavernCardCapacity(player: PlayerState): number {
  return SHOP_SIZE_BY_TIER[player.tavernTier] + 1;
}

function applyAfterTavernRefreshEffects(
  state: GameState,
  player: PlayerState,
): void {
  if (
    player.tavernBloodGemBarrageAttack > 0 ||
    player.tavernBloodGemBarrageHealth > 0
  ) {
    for (const minion of player.shop) {
      applyBloodGemStats(
        minion,
        player.tavernBloodGemBarrageAttack,
        player.tavernBloodGemBarrageHealth,
      );
    }
  }
  if (player.shop.length > 0) {
    for (const buff of player.rideTheWindBuffs) {
      const target =
        player.shop[randomIndex(state, player.shop.length)];
      target.attack += buff.attack;
      target.health += buff.health;
    }
  }
}

function fillShop(state: GameState, player: PlayerState): void {
  const normalMinionTargetSize = SHOP_SIZE_BY_TIER[player.tavernTier];
  const totalTargetSize = tavernCardCapacity(player);
  const currentSpellCount = tavernSpellShopOffers(player).length;
  const minionTargetSize = player.spellOnlyRefreshActive
    ? Math.max(0, totalTargetSize - currentSpellCount)
    : Math.min(
        normalMinionTargetSize,
        Math.max(0, totalTargetSize - currentSpellCount),
      );
  let tavernRefreshed = false;
  while (player.shop.length < minionTargetSize) {
    const minion = drawFromPool(state, player.tavernTier);
    if (!minion) {
      break;
    }
    applyPersistentTavernBonuses(player, minion);
    reconcileWhereverMinion(
      minion,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
    );
    player.shop.push(minion);
    tavernRefreshed = true;
  }
  if (
    !player.spellOnlyRefreshActive &&
    player.spellShop === null &&
    player.shop.length + tavernSpellShopOffers(player).length <
      totalTargetSize
  ) {
    const spell = drawTavernSpell(state, player.tavernTier);
    if (spell) {
      player.spellShop = spell;
      tavernRefreshed = true;
    }
  }
  if (tavernRefreshed) {
    applyAfterTavernRefreshEffects(state, player);
  }
}

export function getUpgradeCost(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = findPlayer(state, playerId);
  if (!player || player.tavernTier >= 6) {
    return 0;
  }
  const baseCost = UPGRADE_BASE_COST[player.tavernTier];
  const heroPowerDiscount = playerHasHeroPower(
    player,
    "upgradeDiscount",
  )
    ? 1
    : 0;
  return Math.max(
    0,
    baseCost - player.upgradeDiscount - heroPowerDiscount,
  );
}

export function getRefreshCost(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = findPlayer(state, playerId);
  return player?.freeRefreshes ? 0 : REFRESH_COST;
}

export interface TavernSpellPurchaseQuote {
  currency: "gold" | "health";
  cost: number;
  affordable: boolean;
}

function tavernSpellPurchaseCost(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  return tavernSpellPurchaseCurrency(spell) === "gold"
    ? Math.max(
        0,
        spell.cost - (player.nextTavernSpellDiscount ?? 0),
      )
    : spell.cost;
}

export function getTavernSpellPurchaseQuote(
  state: GameState,
  playerId: PlayerId,
  spellInstanceId?: string,
): TavernSpellPurchaseQuote | null {
  const player = findPlayer(state, playerId);
  const spell = player
    ? spellInstanceId
      ? tavernSpellShopOffers(player).find(
          (candidate) => candidate.instanceId === spellInstanceId,
        )
      : player.spellShop
    : undefined;
  if (!player || !spell) {
    return null;
  }
  const currency = tavernSpellPurchaseCurrency(spell);
  const cost = tavernSpellPurchaseCost(player, spell);
  return {
    currency,
    cost,
    affordable:
      player.hand.length < MAX_HAND_SIZE &&
      (currency === "health"
        ? player.health > cost
        : player.gold >= cost),
  };
}

function tavernSpellLegalTargets(
  player: PlayerState,
  spell: TavernSpellDefinition | TavernSpellInstance,
): BoardMinionInstance[] {
  const definition =
    "kind" in spell
      ? getTavernSpellDefinition(spell.definitionId)
      : spell;
  if (!tavernSpellNeedsTarget(definition)) {
    return [];
  }
  const candidates = tavernSpellCanTargetShop(definition)
    ? [...player.board, ...player.shop]
    : [...player.board];
  if (definition.effect === "stackedAvalanche") {
    return candidates.filter((candidate) =>
      player.board.some(
        (minion) =>
          minion.instanceId !== candidate.instanceId &&
          minionHasTribe(minion, "elemental"),
      ),
    );
  }
  if (definition.effect === "arcaneAbsorption") {
    if (player.shop.length === 0) {
      return [];
    }
    return candidates.filter((candidate) =>
      minionHasTribe(candidate, "elemental"),
    );
  }
  if (definition.effect === "slaughter") {
    return candidates.filter((candidate) =>
      minionHasTribe(candidate, "undead"),
    );
  }
  if (definition.effect === "corruptedCupcakes") {
    return candidates.filter((candidate) =>
      minionHasTribe(candidate, "demon"),
    );
  }
  if (definition.effect === "invokeTheDevourer") {
    return candidates.filter((candidate) =>
      player.board.includes(candidate),
    );
  }
  if (definition.effect === "eyesOfTheEarthMother") {
    return candidates.filter(
      (candidate) =>
        player.board.includes(candidate) &&
        candidate.tier <= 4 &&
        !candidate.golden,
    );
  }
  if (definition.effect === "lostStaffOfHamuul") {
    return candidates.filter(
      (candidate) =>
        candidate.tribes.length > 0 &&
        candidate.tribes.some((tribe) => tribe !== "neutral"),
    );
  }
  return candidates;
}

export function getLegalTavernSpellTargetIds(
  state: GameState,
  playerId: PlayerId,
  spell: TavernSpellDefinition | TavernSpellInstance,
): string[] {
  const player = findPlayer(state, playerId);
  return player
    ? tavernSpellLegalTargets(player, spell).map(
        (minion) => minion.instanceId,
      )
    : [];
}

function spellcraftLegalTargets(
  player: PlayerState,
  spell: SpellcraftDefinition | SpellcraftSpellInstance,
): BoardMinionInstance[] {
  return spellcraftNeedsTarget(spell) ? [...player.board] : [];
}

export function getLegalSpellcraftTargetIds(
  state: GameState,
  playerId: PlayerId,
  spell: SpellcraftDefinition | SpellcraftSpellInstance,
): string[] {
  const player = findPlayer(state, playerId);
  return player
    ? spellcraftLegalTargets(player, spell).map(
        (minion) => minion.instanceId,
      )
    : [];
}

function applyBuff(target: MinionInstance, effect: BuffEffect, scale: number): void {
  target.attack = Math.max(0, target.attack + effect.attack * scale);
  target.health = Math.max(1, target.health + effect.health * scale);
  if (effect.taunt) {
    target.taunt = true;
    target.temporaryTaunt = false;
  }
  reconcileConditionalMinion(target);
}

function recruitEffectTargets(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effect: BuffEffect,
): MinionInstance[] {
  switch (effect.target) {
    case "self":
      return [source];
    case "allFriendly":
      return [...player.board];
    case "otherFriendly":
      return player.board.filter(
        (minion) => minion.instanceId !== source.instanceId,
      );
    case "otherFriendlyTribe":
      return player.board.filter(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, effect.tribe),
      );
    case "friendlyTribe":
      return player.board.filter((minion) =>
        minionHasTribe(minion, effect.tribe),
      );
    case "adjacentFriendly": {
      const sourceIndex = player.board.findIndex(
        (minion) => minion.instanceId === source.instanceId,
      );
      return player.board.filter(
        (minion, index) =>
          minion.instanceId !== source.instanceId &&
          Math.abs(index - sourceIndex) === 1,
      );
    }
    case "randomFriendlyTribe": {
      const candidates = player.board.filter(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, effect.tribe),
      );
      return candidates.length === 0
        ? []
        : [candidates[randomIndex(state, candidates.length)]];
    }
    case "randomFriendly": {
      const candidates = player.board.filter(
        (minion) => minion.instanceId !== source.instanceId,
      );
      if (candidates.length === 0) {
        return [];
      }
      return [candidates[randomIndex(state, candidates.length)]];
    }
  }
}

function applyRecruitEffects(
  state: GameState,
  player: PlayerState,
  source: MinionInstance,
  effects: readonly MinionEffect[] | undefined,
  scaleOverride?: number,
): void {
  if (!effects) {
    return;
  }
  const scale = scaleOverride ?? (source.golden ? 2 : 1);
  const effectSourceIsGolden =
    scaleOverride === undefined ? source.golden : scaleOverride > 1;
  for (const effect of effects) {
    if (effect.kind === "buff") {
      for (const target of recruitEffectTargets(state, player, source, effect)) {
        applyBuff(target, effect, scale);
      }
    } else if (effect.kind === "grantShield") {
      if (effect.target === "self") {
        source.divineShield = true;
        source.temporaryDivineShield = false;
      } else {
        const candidates = player.board.filter(
          (minion) => minion.instanceId !== source.instanceId,
        );
        for (
          let count = 0;
          count < scale && candidates.length > 0;
          count += 1
        ) {
          const targetIndex = randomIndex(state, candidates.length);
          candidates[targetIndex].divineShield = true;
          candidates[targetIndex].temporaryDivineShield = false;
          candidates.splice(targetIndex, 1);
        }
      }
    } else if (effect.kind === "gainGold") {
      player.gold += effect.amount * scale;
    } else if (effect.kind === "gainNextTurnGold") {
      player.pendingNextTurnGold += effect.amount * scale;
    } else if (effect.kind === "gainTavernSpell") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      const definition = getTavernSpellDefinition(
        effect.definitionId,
      );
      for (
        let count = 0;
        count < gainCount && player.hand.length < MAX_HAND_SIZE;
        count += 1
      ) {
        player.hand.push(createTavernSpell(state, definition));
      }
    } else if (effect.kind === "gainMinion") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      for (let count = 0; count < gainCount; count += 1) {
        addGeneratedMinionCopyToHand(
          state,
          player,
          effect.definitionId,
        );
      }
    } else if (effect.kind === "getRandomMinion") {
      const gainCount =
        effect.count *
        (effect.goldenMode === "doubleCount" ? scale : 1);
      for (let count = 0; count < gainCount; count += 1) {
        addDrawnMinionToHand(
          state,
          player,
          drawMatchingFromPool(
            state,
            player.tavernTier,
            (definition) =>
              (effect.filter.tribe === undefined ||
                definitionHasTribe(
                  definition,
                  effect.filter.tribe,
                )) &&
              (effect.filter.magnetic !== true ||
                definition.magnetic !== undefined) &&
              (effect.filter.exactTier === undefined ||
                definition.tier === effect.filter.exactTier),
          ),
        );
      }
    } else if (effect.kind === "damageHero") {
      damagePlayer(player, effect.amount);
    } else if (effect.kind === "gainMissingHealth") {
      source.health +=
        Math.max(0, 40 - player.health) * effect.multiplier * scale;
    } else if (effect.kind === "gainBloodGems") {
      addBloodGems(
        state,
        player,
        effect.count * scale,
        effect.bonusKeyword,
      );
    } else if (effect.kind === "improveBloodGems") {
      player.bloodGemAttack += effect.attack * scale;
      player.bloodGemHealth += effect.health * scale;
    } else if (effect.kind === "improveBallers") {
      if (effect.attack > 0) {
        buffMinions(
          player.board,
          player.ballerAttackBonus * scale,
          0,
        );
        player.ballerAttackBonus += effect.attack * scale;
      }
      if (effect.health > 0) {
        buffMinions(
          player.board,
          0,
          player.ballerHealthBonus * scale,
        );
        player.ballerHealthBonus += effect.health * scale;
      }
    } else if (effect.kind === "buffTavernType") {
      const attack = effect.attack * scale;
      const health = effect.health * scale;
      const existing = player.tavernTypeBuffs.find(
        (buff) =>
          buff.tribes.length === 1 &&
          buff.tribes[0] === effect.tribe,
      );
      if (existing) {
        existing.attack += attack;
        existing.health += health;
      } else {
        player.tavernTypeBuffs.push({
          tribes: [effect.tribe],
          attack,
          health,
        });
      }
      buffMinions(
        player.shop.filter((minion) =>
          minionHasTribe(minion, effect.tribe),
        ),
        attack,
        health,
      );
    } else if (effect.kind === "improveUndeadArmy") {
      const attack = effect.attack * scale;
      const health = effect.health * scale;
      player.undeadArmyAttackBonus += attack;
      player.undeadArmyHealthBonus += health;
      buffMinions(
        [
          ...player.board,
          ...player.hand.filter(
            (card): card is BoardMinionInstance =>
              card.kind === "minion",
          ),
        ].filter((minion) => minionHasTribe(minion, "undead")),
        attack,
        health,
      );
    } else if (effect.kind === "consumeRandomShopMinion") {
      if (player.shop.length === 0) {
        continue;
      }
      const consumedIndex = randomIndex(state, player.shop.length);
      const [consumed] = player.shop.splice(consumedIndex, 1);
      const statScale =
        effect.goldenMode === "doubleStats" ? scale : 1;
      source.attack += consumed.attack * statScale;
      source.health += consumed.health * statScale;
      returnMinionToPool(state, consumed);
    } else if (effect.kind === "discountNextTavernSpell") {
      player.nextTavernSpellDiscount =
        (player.nextTavernSpellDiscount ?? 0) +
        effect.amount * scale;
    } else if (effect.kind === "makeSelfGolden") {
      if (source.kind === "minion") {
        makeMinionGoldenPreservingEnchantments(source);
      }
    } else if (effect.kind === "summon") {
      const baseCount =
        effect.count === "sourceAttack" ? source.attack : effect.count;
      const doublesCount =
        effectSourceIsGolden && effect.goldenMode === "doubleCount";
      const summonCount = baseCount * (doublesCount ? 2 : 1);
      for (
        let count = 0;
        count < summonCount && player.board.length < MAX_BOARD_SIZE;
        count += 1
      ) {
        const summoned = createMinionInstance(state, effect.definitionId, 0);
        if (effectSourceIsGolden && !doublesCount) {
          makeGoldenToken(summoned);
        }
        if (effect.taunt) {
          summoned.taunt = true;
        }
        applyOwnedUndeadArmyBonus(player, summoned);
        player.board.push(summoned);
        applyRecruitSummonTriggers(player, summoned);
      }
    }
  }
}

function applyRecruitSummonTriggers(
  player: PlayerState,
  summoned: MinionInstance,
): void {
  if (summoned.kind === "minion") {
    reconcileWhereverMinion(
      summoned,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
    );
  }
  observeRecruitAutomatonSummon(player, summoned);
  for (const watcher of player.board) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlySummoned;
      if (
        !trigger ||
        trigger.grantShield ||
        !minionHasTribe(summoned, trigger.tribe) ||
        watcher.instanceId === summoned.instanceId
      ) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      summoned.attack += (trigger.attack ?? 0) * scale;
      summoned.health += (trigger.health ?? 0) * scale;
    }
  }
}

function applyAfterFriendlyPlayed(
  state: GameState,
  player: PlayerState,
  played: MinionInstance,
): void {
  if (minionHasTribe(played, "elemental")) {
    player.elementalsPlayedThisTurn += 1;
  }
  for (const watcher of player.board) {
    if (watcher.instanceId === played.instanceId) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyPlayed;
      if (!trigger || !minionHasTribe(played, trigger.tribe)) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      watcher.attack += (trigger.attack ?? 0) * scale;
      watcher.health += (trigger.health ?? 0) * scale;
      damagePlayer(player, (trigger.heroDamage ?? 0) * scale);
      addBloodGems(
        state,
        player,
        (trigger.gainBloodGems ?? 0) * scale,
      );
    }
  }
}

function battlecryTriggerCount(player: PlayerState): number {
  return (
    1 +
    player.board.reduce((largestExtra, minion) => {
      return minionEffectSources(minion).reduce(
        (componentLargest, component) => {
          const extra =
            getMinionDefinition(component.definitionId)
              .extraBattlecries ?? 0;
          return Math.max(
            componentLargest,
            extra * (component.golden ? 2 : 1),
          );
        },
        largestExtra,
      );
    }, 0)
  );
}

function applyStartOfTurnEffects(
  state: GameState,
  player: PlayerState,
): void {
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      addMinionSpellcraft(
        state,
        player,
        source.instanceId,
        component,
      );
      const effects =
        getMinionDefinition(component.definitionId).startOfTurn;
      applyRecruitEffects(
        state,
        player,
        source,
        effects,
        component.golden ? 2 : 1,
      );
    }
  }
}

function applyEndOfTurnEffects(
  state: GameState,
  player: PlayerState,
): void {
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      const effect =
        getMinionDefinition(component.definitionId).endOfTurn;
      if (!effect) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      if (effect.kind === "gainBloodGems") {
        addBloodGems(
          state,
          player,
          effect.count * scale,
          effect.bonusKeyword,
        );
        continue;
      }
      if (effect.kind === "periodicGainRandomMinion") {
        const remaining =
          effectCounter(
            source,
            PERIODIC_TURN_COUNTER,
            effect.everyTurns,
          ) - 1;
        if (remaining <= 0) {
          const rewardCount =
            effect.count *
            (effect.goldenMode === "doubleCount" ? scale : 1);
          for (let count = 0; count < rewardCount; count += 1) {
            addDrawnMinionToHand(
              state,
              player,
              drawMatchingFromPool(
                state,
                player.tavernTier,
                (definition) =>
                  definitionHasTribe(definition, effect.tribe),
              ),
            );
          }
          setEffectCounter(
            source,
            PERIODIC_TURN_COUNTER,
            effect.everyTurns,
          );
        } else {
          setEffectCounter(
            source,
            PERIODIC_TURN_COUNTER,
            remaining,
          );
        }
        refreshDynamicMinionDescription(source);
        continue;
      }
      if (effect.kind === "onePerTribe") {
        const seen = new Set<Tribe>();
        for (const target of player.board) {
          const targetTribe =
            target.tribes.find((tribe) => tribe !== "all") ??
            (target.tribes.includes("all") ? "all" : "neutral");
          if (targetTribe === "neutral" || seen.has(targetTribe)) {
            continue;
          }
          seen.add(targetTribe);
          target.attack += effect.attack * scale;
          target.health += effect.health * scale;
        }
        continue;
      }

      const sourceIndex = player.board.findIndex(
        (minion) => minion.instanceId === source.instanceId,
      );
      const targets =
        effect.target === "self"
          ? [source]
          : player.board.filter(
              (_, index) => Math.abs(index - sourceIndex) === 1,
            );
      const repetitions =
        1 +
        (effect.repeatPerGoldenFriendly
          ? player.board.filter((minion) => minion.golden).length
          : 0);
      for (const target of targets) {
        target.attack += effect.attack * scale * repetitions;
        target.health += effect.health * scale * repetitions;
      }
    }
  }
}

function applyAfterMagnetizedEffects(
  state: GameState,
  player: PlayerState,
): void {
  for (const watcher of [...player.board]) {
    for (const component of minionEffectSources(watcher)) {
      const effects =
        getMinionDefinition(component.definitionId).afterMagnetized;
      applyRecruitEffects(
        state,
        player,
        watcher,
        effects,
        component.golden ? 2 : 1,
      );
    }
  }
}

function resolveTriples(state: GameState, player: PlayerState): void {
  let combined = true;
  while (combined) {
    combined = false;
    const definitionIds = [
      ...player.board.map((minion) => minion.definitionId),
      ...player.hand
        .filter(
          (card): card is BoardMinionInstance => card.kind === "minion",
        )
        .map((minion) => minion.definitionId),
    ];
    for (const definitionId of definitionIds) {
      const boardMatches = player.board.filter(
        (minion) =>
          minion.definitionId === definitionId && minion.golden === false,
      );
      const handMatches = player.hand.filter(
        (minion): minion is BoardMinionInstance =>
          minion.kind === "minion" &&
          minion.definitionId === definitionId && minion.golden === false,
      );
      const matches = [...boardMatches, ...handMatches];
      if (matches.length < 3) {
        continue;
      }

      const consumed = matches.slice(0, 3);
      const consumedIds = new Set(consumed.map((minion) => minion.instanceId));
      player.board = player.board.filter(
        (minion) => !consumedIds.has(minion.instanceId),
      );
      player.hand = player.hand.filter(
        (minion) => !consumedIds.has(minion.instanceId),
      );

      const definition = getMinionDefinition(definitionId);
      const undeadArmyAttack =
        definitionHasTribe(definition, "undead")
          ? player.undeadArmyAttackBonus
          : 0;
      const undeadArmyHealth =
        definitionHasTribe(definition, "undead")
          ? player.undeadArmyHealthBonus
          : 0;
      const extraAttack = consumed.reduce(
        (total, minion) =>
          total +
          (minion.attack -
            definition.attack -
            undeadArmyAttack -
            (minion.whereverAttackBonus ?? 0)),
        0,
      );
      const extraHealth = consumed.reduce(
        (total, minion) =>
          total +
          (minion.health -
            definition.health -
            undeadArmyHealth -
            (minion.whereverHealthBonus ?? 0)),
        0,
      );
      const golden = createMinionInstance(
        state,
        definitionId,
        consumed.reduce((total, minion) => total + minion.poolCopies, 0),
      );
      golden.golden = true;
      golden.cardId = definition.goldenCardId ?? definition.cardId;
      golden.grantsTripleReward = true;
      golden.name = `金色·${definition.name}`;
      golden.attack =
        definition.attack * 2 + undeadArmyAttack + extraAttack;
      golden.health =
        definition.health * 2 + undeadArmyHealth + extraHealth;
      golden.bloodGemAttack = consumed.reduce(
        (total, minion) => total + minion.bloodGemAttack,
        0,
      );
      golden.bloodGemHealth = consumed.reduce(
        (total, minion) => total + minion.bloodGemHealth,
        0,
      );
      golden.temporaryAttack = consumed.reduce(
        (total, minion) => total + minion.temporaryAttack,
        0,
      );
      golden.temporaryHealth = consumed.reduce(
        (total, minion) => total + minion.temporaryHealth,
        0,
      );
      golden.temporaryCrabDeathrattles = consumed.reduce(
        (total, minion) =>
          total + minion.temporaryCrabDeathrattles,
        0,
      );
      golden.temporaryGoldenCrabDeathrattles = consumed.reduce(
        (total, minion) =>
          total + (minion.temporaryGoldenCrabDeathrattles ?? 0),
        0,
      );
      if (definitionId === UPBEAT_FRONTDRAKE_DEFINITION_ID) {
        setEffectCounter(
          golden,
          PERIODIC_TURN_COUNTER,
          Math.min(
            ...consumed.map((minion) =>
              effectCounter(minion, PERIODIC_TURN_COUNTER, 3),
            ),
          ),
        );
      } else if (definitionId === HUNGRY_TROG_DEFINITION_ID) {
        const purchaseProgress = consumed.some(
          (minion) =>
            effectCounter(minion, PURCHASE_PROGRESS_COUNTER, 0) < 0,
        )
          ? -1
          : Math.max(
              ...consumed.map((minion) =>
                effectCounter(
                  minion,
                  PURCHASE_PROGRESS_COUNTER,
                  0,
                ),
              ),
            );
        setEffectCounter(
          golden,
          PURCHASE_PROGRESS_COUNTER,
          purchaseProgress,
        );
      }
      const playableFromRound = Math.max(
        0,
        ...consumed.map((minion) => minion.playableFromRound ?? 0),
      );
      if (playableFromRound > 0) {
        golden.playableFromRound = playableFromRound;
      }
      const hasPermanentTaunt =
        definition.taunt === true ||
        consumed.some(
          (minion) => minion.taunt && !minion.temporaryTaunt,
        );
      golden.temporaryTaunt =
        !hasPermanentTaunt &&
        consumed.some((minion) => minion.temporaryTaunt);
      golden.taunt =
        hasPermanentTaunt || golden.temporaryTaunt;
      const hasPermanentDivineShield =
        definition.divineShield === true ||
        consumed.some(
          (minion) =>
            minion.divineShield &&
            !minion.temporaryDivineShield,
        );
      golden.temporaryDivineShield =
        !hasPermanentDivineShield &&
        consumed.some((minion) => minion.temporaryDivineShield);
      golden.divineShield =
        hasPermanentDivineShield ||
        golden.temporaryDivineShield;
      golden.reborn =
        definition.reborn === true ||
        consumed.some((minion) => minion.reborn);
      golden.poisonous =
        definition.poisonous === true ||
        consumed.some((minion) => minion.poisonous);
      golden.venomous =
        definition.venomous === true ||
        consumed.some((minion) => minion.venomous);
      golden.windfury =
        definition.windfury === true ||
        consumed.some((minion) => minion.windfury);
      golden.cleave =
        definition.cleave === true ||
        consumed.some((minion) => minion.cleave);
      golden.alwaysAttacksLowestAttack =
        definition.alwaysAttacksLowestAttack === true ||
        consumed.some(
          (minion) => minion.alwaysAttacksLowestAttack,
        );
      golden.attachments = consumed.flatMap((minion) =>
        minion.attachments.map(cloneMagneticAttachment),
      );
      if (
        consumed.some(
          (minion) => minion.effectSupport === "partial",
        )
      ) {
        golden.effectSupport = "partial";
      }
      golden.sellValue =
        definition.goldenSellValue ?? definition.sellValue ?? 1;
      golden.description = goldenMinionDescription(definition.id);
      if (definition.id === ANCIENT_SOUL_DEFINITION_ID) {
        golden.ancientSoulFriendlyDeaths =
          ANCIENT_SOUL_DEATHS_REQUIRED;
      }
      reconcileWhereverMinion(
        golden,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
      );
      refreshDynamicMinionDescription(golden);
      player.hand.push(golden);
      combined = true;
      break;
    }
  }
}

function buyMinion(
  state: GameState,
  player: PlayerState,
  shopIndex: number,
): boolean {
  if (
    player.gold < BUY_COST ||
    player.hand.length >= MAX_HAND_SIZE ||
    shopIndex < 0 ||
    shopIndex >= player.shop.length
  ) {
    return false;
  }
  const [minion] = player.shop.splice(shopIndex, 1);
  player.gold -= BUY_COST;
  claimGeneratedShopMinion(minion);
  applyOwnedUndeadArmyBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  player.hand.push(minion);
  observeCardPurchase(player);
  resolveTriples(state, player);
  return true;
}

function buyTavernSpell(
  state: GameState,
  player: PlayerState,
  spellInstanceId?: string,
): boolean {
  const offers = tavernSpellShopOffers(player);
  const spell = spellInstanceId
    ? offers.find((candidate) => candidate.instanceId === spellInstanceId)
    : player.spellShop;
  if (!spell || player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const currency = tavernSpellPurchaseCurrency(spell);
  const cost = tavernSpellPurchaseCost(player, spell);
  if (
    (currency === "gold" && player.gold < cost) ||
    (currency === "health" && player.health <= cost)
  ) {
    return false;
  }
  if (currency === "health") {
    player.health -= cost;
  } else {
    player.gold -= cost;
    player.nextTavernSpellDiscount = 0;
  }
  state.spellPool[spell.definitionId] =
    (state.spellPool[spell.definitionId] ?? 0) + 1;
  player.hand.push(spell);
  observeCardPurchase(player);
  if (player.spellShop?.instanceId === spell.instanceId) {
    player.spellShop = player.additionalSpellShop.shift() ?? null;
  } else {
    player.additionalSpellShop = player.additionalSpellShop.filter(
      (candidate) => candidate.instanceId !== spell.instanceId,
    );
  }
  return true;
}

function sellMinionTransaction(
  state: GameState,
  player: PlayerState,
  boardIndex: number,
): BoardMinionInstance | null {
  if (boardIndex < 0 || boardIndex >= player.board.length) {
    return null;
  }
  const [minion] = player.board.splice(boardIndex, 1);
  returnMinionToPool(state, minion);
  player.gold += minion.sellValue;
  applyRecruitEffects(
    state,
    player,
    minion,
    getMinionDefinition(minion.definitionId).afterSold,
  );
  return minion;
}

function sellMinion(
  state: GameState,
  player: PlayerState,
  boardIndex: number,
): boolean {
  return sellMinionTransaction(state, player, boardIndex) !== null;
}

function playMinion(
  state: GameState,
  player: PlayerState,
  handIndex: number,
  boardIndex?: number,
): boolean {
  const card = player.hand[handIndex];
  if (
    player.board.length >= MAX_BOARD_SIZE ||
    handIndex < 0 ||
    handIndex >= player.hand.length ||
    card?.kind !== "minion" ||
    (card.playableFromRound ?? 0) > state.round
  ) {
    return false;
  }
  const [removed] = player.hand.splice(handIndex, 1);
  if (removed.kind !== "minion") {
    throw new Error("PLAY_MINION removed a non-minion hand card");
  }
  const minion = removed;
  const insertAt =
    boardIndex === undefined
      ? player.board.length
      : Math.max(0, Math.min(boardIndex, player.board.length));
  player.board.splice(insertAt, 0, minion);
  grantTripleRewardBeforeGeneratedCards(state, player, minion);
  grantPlayedMinionSpellcraft(state, player, minion);
  const battlecry = getMinionDefinition(minion.definitionId).battlecry;
  const triggerCount = battlecry ? battlecryTriggerCount(player) : 0;
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, minion, battlecry);
  }
  applyRecruitSummonTriggers(player, minion);
  applyAfterFriendlyPlayed(state, player, minion);
  resolveTriples(state, player);
  beginInteractiveBattlecry(state, player, minion);
  if (state.pendingInteraction === null) {
    resolveStirTheGraveyardDeath(state, player, minion.instanceId);
  }
  return true;
}

function destroyRecruitMinion(
  state: GameState,
  player: PlayerState,
  instanceId: string,
): BoardMinionInstance | null {
  const boardIndex = player.board.findIndex(
    (minion) => minion.instanceId === instanceId,
  );
  const source = player.board[boardIndex];
  if (!source) {
    return null;
  }

  player.board.splice(boardIndex, 1);
  returnMinionToPool(state, source);
  observePersistentFriendlyDeath(player, source);
  for (const watcher of player.board) {
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyDied;
      if (!trigger || !minionHasTribe(source, trigger.tribe)) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      watcher.attack += (trigger.attack ?? 0) * scale;
      watcher.health += (trigger.health ?? 0) * scale;
    }
  }

  const repetitions = 1 + extraDeathrattles(player.board);
  for (const component of minionEffectSources(source)) {
    const deathrattle =
      getMinionDefinition(component.definitionId).deathrattle;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      applyRecruitEffects(
        state,
        player,
        source,
        deathrattle,
        component.golden ? 2 : 1,
      );
    }
  }
  for (
    let count = 0;
    count < source.temporaryCrabDeathrattles * repetitions &&
    player.board.length < MAX_BOARD_SIZE;
    count += 1
  ) {
    const crab = createMinionInstance(state, "live-crab-token", 0);
    player.board.splice(
      Math.min(boardIndex + count, player.board.length),
      0,
      crab,
    );
    applyRecruitSummonTriggers(player, crab);
  }
  for (
    let count = 0;
    count <
      (source.temporaryGoldenCrabDeathrattles ?? 0) * repetitions &&
    player.board.length < MAX_BOARD_SIZE;
    count += 1
  ) {
    const crab = createMinionInstance(state, "live-crab-token", 0);
    makeGoldenToken(crab);
    player.board.splice(
      Math.min(
        boardIndex +
          source.temporaryCrabDeathrattles * repetitions +
          count,
        player.board.length,
      ),
      0,
      crab,
    );
    applyRecruitSummonTriggers(player, crab);
  }
  if (source.reborn && player.board.length < MAX_BOARD_SIZE) {
    const reborn = createMinionInstance(
      state,
      source.definitionId,
      0,
    );
    if (source.golden) {
      makeGoldenToken(reborn);
    }
    reborn.health = 1;
    reborn.reborn = false;
    applyOwnedUndeadArmyBonus(player, reborn);
    player.board.splice(
      Math.min(boardIndex, player.board.length),
      0,
      reborn,
    );
    applyRecruitSummonTriggers(player, reborn);
  }
  return source;
}

function resolveStirTheGraveyardDeath(
  state: GameState,
  player: PlayerState,
  instanceId: string,
): void {
  const source = player.board.find(
    (minion) => minion.instanceId === instanceId,
  );
  if (
    !source ||
    source.destroyAfterPlayThroughRound === undefined ||
    source.destroyAfterPlayThroughRound < state.round
  ) {
    return;
  }
  destroyRecruitMinion(state, player, instanceId);
}

function resolvePendingStirDeaths(
  state: GameState,
  player: PlayerState,
): void {
  for (const minion of [...player.board]) {
    if (
      minion.destroyAfterPlayThroughRound !== undefined &&
      minion.destroyAfterPlayThroughRound >= state.round
    ) {
      resolveStirTheGraveyardDeath(
        state,
        player,
        minion.instanceId,
      );
    }
  }
}

function magnetizeMinion(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  const target = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  if (
    handIndex < 0 ||
    card?.kind !== "minion" ||
    !target ||
    !canMagnetize(card, target) ||
    (card.playableFromRound ?? 0) > state.round
  ) {
    return false;
  }

  const [removed] = player.hand.splice(handIndex, 1);
  if (removed.kind !== "minion") {
    throw new Error("MAGNETIZE_MINION removed a non-minion hand card");
  }
  const source = removed;
  grantTripleRewardBeforeGeneratedCards(state, player, source);
  const battlecry = getMinionDefinition(source.definitionId).battlecry;
  const triggerCount = battlecry ? battlecryTriggerCount(player) : 0;
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, source, battlecry);
  }

  fuseMinionIntoHost(state, player, source, target);

  applyAfterFriendlyPlayed(state, player, source);
  applyAfterMagnetizedEffects(state, player);
  resolveTriples(state, player);
  return true;
}

function fuseMinionIntoHost(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
  target: BoardMinionInstance,
): void {
  // Patch 27.0 changed Battlegrounds Magnetic pool behavior: every pool copy
  // represented by the source returns immediately when it is Magnetized.
  // The attached component therefore retains its effects but carries zero
  // future pool contribution when the host is sold or eliminated.
  returnMinionToPool(state, source);
  target.attack += source.attack;
  target.health += source.health;
  target.bloodGemAttack += source.bloodGemAttack;
  target.bloodGemHealth += source.bloodGemHealth;
  target.temporaryAttack += source.temporaryAttack;
  target.temporaryHealth += source.temporaryHealth;
  target.temporaryCrabDeathrattles +=
    source.temporaryCrabDeathrattles;
  target.temporaryGoldenCrabDeathrattles =
    (target.temporaryGoldenCrabDeathrattles ?? 0) +
    (source.temporaryGoldenCrabDeathrattles ?? 0);
  if (source.temporaryTaunt && !target.taunt) {
    target.temporaryTaunt = true;
  }
  if (source.temporaryDivineShield && !target.divineShield) {
    target.temporaryDivineShield = true;
  }
  target.taunt ||= source.taunt;
  target.divineShield ||= source.divineShield;
  if (source.taunt && !source.temporaryTaunt) {
    target.temporaryTaunt = false;
  }
  if (
    source.divineShield &&
    !source.temporaryDivineShield
  ) {
    target.temporaryDivineShield = false;
  }
  target.reborn ||= source.reborn;
  target.poisonous ||= source.poisonous;
  target.venomous ||= source.venomous;
  target.windfury ||= source.windfury;
  target.cleave ||= source.cleave;
  target.alwaysAttacksLowestAttack ||=
    source.alwaysAttacksLowestAttack;
  if (source.effectSupport === "partial") {
    target.effectSupport = "partial";
  }
  target.attachments.push(createMagneticAttachment(source));
}

function castTripleReward(
  state: GameState,
  player: PlayerState,
  handIndex: number,
): boolean {
  const card = player.hand[handIndex];
  if (card?.kind !== "tripleReward") {
    return false;
  }
  player.hand.splice(handIndex, 1);
  beginDiscoverInteraction(
    state,
    player,
    card.instanceId,
    { exactTier: card.tier },
    1,
    { kind: "hand" },
  );
  return true;
}

function castBloodGem(
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  const target = player.board.find(
    (minion) => minion.instanceId === targetInstanceId,
  );
  if (handIndex < 0 || card?.kind !== "bloodGem" || !target) {
    return false;
  }
  player.hand.splice(handIndex, 1);
  applyBloodGem(player, target);
  if (minionHasTribe(target, "quilboar")) {
    if (card.bonusKeyword === "rebornForQuilboar") {
      target.reborn = true;
    } else if (card.bonusKeyword === "divineShieldForQuilboar") {
      target.divineShield = true;
      target.temporaryDivineShield = false;
    }
  }
  return true;
}

function randomBoardSubset(
  state: GameState,
  board: readonly BoardMinionInstance[],
  count: number,
): BoardMinionInstance[] {
  const candidates = [...board];
  const selected: BoardMinionInstance[] = [];
  while (candidates.length > 0 && selected.length < count) {
    selected.push(candidates.splice(randomIndex(state, candidates.length), 1)[0]);
  }
  return selected;
}

function buffMinions(
  minions: readonly BoardMinionInstance[],
  attack: number,
  health: number,
): void {
  for (const minion of minions) {
    minion.attack += attack;
    minion.health += health;
    reconcileConditionalMinion(minion);
  }
}

function buffMinionsFromTavernSpell(
  player: PlayerState,
  minions: readonly BoardMinionInstance[],
  attack: number,
  health: number,
  repetitions = 1,
): void {
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    buffMinions(
      minions,
      attack + player.tavernSpellAttackBonus,
      health + player.tavernSpellHealthBonus,
    );
  }
}

function applyTemporarySpellcraftBuff(
  target: BoardMinionInstance,
  attack: number,
  health: number,
  keywords: {
    taunt?: boolean;
    divineShield?: boolean;
  } = {},
): void {
  target.attack += attack;
  target.health += health;
  target.temporaryAttack += attack;
  target.temporaryHealth += health;
  if (keywords.taunt && !target.taunt) {
    target.taunt = true;
    target.temporaryTaunt = true;
  }
  if (keywords.divineShield && !target.divineShield) {
    target.divineShield = true;
    target.temporaryDivineShield = true;
  }
  reconcileConditionalMinion(target);
}

function clearTemporarySpellcraftBuffs(
  minion: BoardMinionInstance,
): void {
  minion.attack = Math.max(
    0,
    minion.attack - minion.temporaryAttack,
  );
  minion.health = Math.max(
    1,
    minion.health - minion.temporaryHealth,
  );
  minion.temporaryAttack = 0;
  minion.temporaryHealth = 0;
  if (minion.temporaryTaunt) {
    minion.taunt = false;
    minion.temporaryTaunt = false;
  }
  if (minion.temporaryDivineShield) {
    minion.divineShield = false;
    minion.temporaryDivineShield = false;
  }
  minion.temporaryCrabDeathrattles = 0;
  minion.temporaryGoldenCrabDeathrattles = 0;
}

function castSpellcraft(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId?: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  if (handIndex < 0 || card?.kind !== "spellcraft") {
    return false;
  }
  const definition = getSpellcraftDefinition(card.definitionId);
  const effectMultiplier = card.effectMultiplier ?? 1;
  const legalTargets = spellcraftLegalTargets(player, definition);
  const target = targetInstanceId
    ? legalTargets.find(
        (minion) => minion.instanceId === targetInstanceId,
      )
    : undefined;
  if (
    (spellcraftNeedsTarget(definition) && !target) ||
    (!spellcraftNeedsTarget(definition) &&
      targetInstanceId !== undefined)
  ) {
    return false;
  }

  player.hand.splice(handIndex, 1);
  switch (definition.effect) {
    case "crabRider":
      if (target) {
        if (effectMultiplier > 1) {
          target.temporaryGoldenCrabDeathrattles =
            (target.temporaryGoldenCrabDeathrattles ?? 0) + 1;
        } else {
          target.temporaryCrabDeathrattles += 1;
        }
      }
      break;
    case "anglersLure":
      if (target) {
        applyTemporarySpellcraftBuff(target, 2, 6, {
          taunt: true,
        });
      }
      break;
    case "glowingCrown":
      if (target) {
        applyTemporarySpellcraftBuff(target, 0, 0, {
          divineShield: true,
        });
      }
      break;
    case "sickRiffs":
      if (target) {
        applyTemporarySpellcraftBuff(
          target,
          player.tavernTier * effectMultiplier,
          player.tavernTier * effectMultiplier,
        );
      }
      break;
    case "deepBlueBlues":
      if (target) {
        const amount = 2 + player.deepBlueBonus;
        applyTemporarySpellcraftBuff(target, amount, amount);
        player.deepBlueBonus += 1;
      }
      break;
    case "escapeEruption":
      if (player.isHuman) {
        state.pendingInteraction = {
          kind: "spellcraftChoice",
          interactionId: nextInteractionId(state),
          playerId: player.id,
          sourceInstanceId: card.instanceId,
          definitionId: definition.id,
          optionIds: [
            "escapeEruptionAttack",
            "escapeEruptionHealth",
          ],
        };
      } else {
        const totalAttack = player.board.reduce(
          (total, minion) => total + minion.attack,
          0,
        );
        const totalHealth = player.board.reduce(
          (total, minion) => total + minion.health,
          0,
        );
        buffMinions(
          player.board,
          totalAttack <= totalHealth ? 4 : 0,
          totalAttack <= totalHealth ? 0 : 4,
        );
      }
      break;
    case "evolvingStrategy":
      addDrawnMinionToHand(
        state,
        player,
        drawMatchingFromPool(
          state,
          1,
          (candidate) =>
            candidate.tier === 1 &&
            definitionHasTribe(candidate, "naga"),
        ),
      );
      break;
    case "meditation":
      player.tavernSpellAttackBonus += 1;
      player.tavernSpellHealthBonus += 1;
      break;
    case "rimeOrReason":
      addRandomStatTavernSpell(state, player);
      break;
  }
  return true;
}

function mostCommonBoardTribe(player: PlayerState): Tribe | null {
  let best: Tribe | null = null;
  let bestCount = 0;
  for (const tribe of LOBBY_TRIBES) {
    const count = player.board.filter((minion) =>
      minionHasTribe(minion, tribe),
    ).length;
    if (count > bestCount) {
      best = tribe;
      bestCount = count;
    }
  }
  return best;
}

function addDrawnMinionToHand(
  state: GameState,
  player: PlayerState,
  minion: BoardMinionInstance | null,
): void {
  if (!minion) {
    return;
  }
  if (player.hand.length >= MAX_HAND_SIZE) {
    returnMinionToPool(state, minion);
    return;
  }
  claimGeneratedShopMinion(minion);
  applyOwnedUndeadArmyBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  player.hand.push(minion);
  resolveTriples(state, player);
}

function addGeneratedMinionCopyToHand(
  state: GameState,
  player: PlayerState,
  definitionId: string,
): void {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return;
  }
  const minion = createMinionInstance(state, definitionId, 0);
  applyOwnedUndeadArmyBonus(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  player.hand.push(minion);
  resolveTriples(state, player);
}

const STAT_GRANTING_TAVERN_SPELL_EFFECTS = new Set<string>([
  "fortify",
  "pointyArrow",
  "tavernDishBanana",
  "themApples",
  "mightOfStormwind",
  "healthyBounty",
  "hostileBounty",
  "selfishBounty",
  "shinyRing",
  "staffOfEnrichment",
  "trickyTrousers",
  "stackedAvalanche",
  "backToBack",
  "deepwaterClan",
  "defendersRites",
  "misplacedTeaSet",
  "naturalBlessing",
  "shiftingTide",
  "blazingInferno",
  "arcaneAbsorption",
  "slaughter",
  "corruptedCupcakes",
  "nozdormusProgeny",
  "invokeTheDevourer",
  "queensCommand",
  "sanctify",
  "waveOfGold",
  "azeriteEmpowerment",
  "perfectVision",
]);

function addRandomStatTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      STAT_GRANTING_TAVERN_SPELL_EFFECTS.has(definition.effect) &&
      tavernSpellIsAvailable(definition, state.activeTribes),
  );
  if (eligible.length === 0) {
    return false;
  }
  player.hand.push(
    createTavernSpell(
      state,
      eligible[randomIndex(state, eligible.length)],
    ),
  );
  return true;
}

function applyAfterTavernSpellCastTriggers(player: PlayerState): void {
  for (const source of player.board) {
    for (const component of minionEffectSources(source)) {
      if (component.definitionId !== "BG27_005") {
        continue;
      }
      buffMinions(player.board, component.golden ? 2 : 1, 0);
    }
  }
}

function finishTavernSpellCast(player: PlayerState): void {
  player.tavernSpellsCastThisTurn += 1;
  applyAfterTavernSpellCastTriggers(player);
}

function chefsChoiceMatches(
  candidate: (typeof MINION_DEFINITIONS)[number],
  target: BoardMinionInstance,
): boolean {
  if (candidate.id === target.definitionId) {
    return false;
  }
  if (target.tribes.includes("all")) {
    return LOBBY_TRIBES.some((tribe) =>
      definitionHasTribe(candidate, tribe),
    );
  }
  const targetTribes = target.tribes.filter(
    (tribe) => tribe !== "neutral" && tribe !== "all",
  );
  return targetTribes.some((tribe) =>
    definitionHasTribe(candidate, tribe),
  );
}

function transformMinionKeepingStats(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
): boolean {
  const wasInShop = player.shop.includes(target);
  const replacementTier = Math.min(6, target.tier + 1) as MutableTier;
  const replacement = drawMatchingFromPool(
    state,
    replacementTier,
    (candidate) => candidate.tier === replacementTier,
  );
  if (!replacement) {
    return false;
  }
  const replacementBaseAttack = replacement.attack;
  const replacementBaseHealth = replacement.health;
  if (wasInShop) {
    applyPersistentTavernBonuses(player, replacement);
  }
  const preserved = {
    instanceId: target.instanceId,
    attack:
      target.attack +
      (replacement.attack - replacementBaseAttack),
    health:
      target.health +
      (replacement.health - replacementBaseHealth),
    // This special transform keeps only the final numbers, not the old
    // enchantment provenance. Later Gem Confiscation must not recover Blood
    // Gems that were already baked into the transformed minion's stats.
    bloodGemAttack: 0,
    bloodGemHealth: 0,
    temporaryAttack: target.temporaryAttack,
    temporaryHealth: target.temporaryHealth,
    temporaryTaunt: false,
    temporaryDivineShield: false,
  };
  returnMinionToPool(state, target);
  delete target.poolCopiesOnPurchase;
  Object.assign(target, replacement, preserved);
  reconcileWhereverMinion(
    target,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  if (player.board.includes(target)) {
    resolveTriples(state, player);
  }
  return true;
}

function adjacentRecruitMinions(
  player: PlayerState,
  target: BoardMinionInstance,
): BoardMinionInstance[] {
  const boardIndex = player.board.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  if (boardIndex >= 0) {
    return [player.board[boardIndex - 1], player.board[boardIndex + 1]]
      .filter(
        (minion): minion is BoardMinionInstance =>
          minion !== undefined,
      );
  }

  const shopIndex = player.shop.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  if (shopIndex < 0) {
    return [];
  }
  const displayOffers: Array<
    | { kind: "minion"; minion: BoardMinionInstance }
    | { kind: "spell"; spell: TavernSpellInstance }
  > = player.shop.map((minion) => ({ kind: "minion", minion }));
  for (const spell of tavernSpellShopOffers(player)) {
    const spellPosition =
      [...spell.instanceId].reduce(
        (hash, character) =>
          (Math.imul(hash, 33) + character.charCodeAt(0)) >>> 0,
        5381,
      ) %
      (displayOffers.length + 1);
    displayOffers.splice(spellPosition, 0, { kind: "spell", spell });
  }
  const targetDisplayIndex = displayOffers.findIndex(
    (offer) =>
      offer.kind === "minion" &&
      offer.minion.instanceId === target.instanceId,
  );
  return [targetDisplayIndex - 1, targetDisplayIndex + 1].flatMap(
    (displayIndex) => {
      const offer = displayOffers[displayIndex];
      return offer?.kind === "minion" ? [offer.minion] : [];
    },
  );
}

function selectDistinctMinionsByTribe(
  state: GameState,
  board: readonly BoardMinionInstance[],
): BoardMinionInstance[] {
  const tribes = [...LOBBY_TRIBES];
  shuffleInPlace(state, tribes);
  const assignedTribeByInstance = new Map<string, Tribe>();

  const assign = (tribe: Tribe, visited: Set<string>): boolean => {
    const candidates = board.filter((minion) =>
      minionHasTribe(minion, tribe),
    );
    shuffleInPlace(state, candidates);
    for (const candidate of candidates) {
      if (visited.has(candidate.instanceId)) {
        continue;
      }
      visited.add(candidate.instanceId);
      const previousTribe = assignedTribeByInstance.get(
        candidate.instanceId,
      );
      if (
        previousTribe === undefined ||
        assign(previousTribe, visited)
      ) {
        assignedTribeByInstance.set(candidate.instanceId, tribe);
        return true;
      }
    }
    return false;
  };

  for (const tribe of tribes) {
    assign(tribe, new Set<string>());
  }
  const selectedIds = new Set(assignedTribeByInstance.keys());
  return board.filter((minion) => selectedIds.has(minion.instanceId));
}

function heroPowerAiScore(
  player: PlayerState,
  definition: HeroPowerDefinition,
): number {
  switch (definition.effect) {
    case "upgradeDiscount":
      return player.tavernTier < 6 ? 9 : 1;
    case "gainGoldAfterUpgrade":
      return player.tavernTier < 6 ? 8 : 1;
    case "freeRefreshAtTurnStart":
      return 7;
    case "buffCombatSummons":
      return 4 + player.board.filter((minion) => {
        const minionDefinition = getMinionDefinition(minion.definitionId);
        return minionDefinition.deathrattle?.some(
          (effect) => effect.kind === "summon",
        );
      }).length;
  }
}

function beginHeroPowerChoice(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
  definition: TavernSpellDefinition,
): boolean {
  const candidates = HERO_POWER_DEFINITIONS.filter(
    (candidate) => candidate.id !== player.heroPowerId,
  ).map((candidate) => ({ ...candidate }));
  shuffleInPlace(state, candidates);
  const options = candidates.slice(0, 3);
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    player.heroPowerId = [...options].sort((left, right) => {
      const scoreDifference =
        heroPowerAiScore(player, right) -
        heroPowerAiScore(player, left);
      return scoreDifference !== 0
        ? scoreDifference
        : left.id.localeCompare(right.id);
    })[0].id;
    return false;
  }
  state.pendingInteraction = {
    kind: "heroPowerChoice",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: spell.instanceId,
    definitionId: definition.id,
    optionIds: options.map((option) => option.id),
  };
  return true;
}

function refreshWithTavernSpells(
  state: GameState,
  player: PlayerState,
): boolean {
  releaseShop(state, player);
  player.frozen = false;
  player.spellOnlyRefreshActive = true;
  const excluded = new Set(["tavern-spell-saloons-finest"]);
  const offers: TavernSpellInstance[] = [];
  while (offers.length < 7) {
    const offer = drawTavernSpell(
      state,
      player.tavernTier,
      excluded,
    );
    if (!offer) {
      break;
    }
    offers.push(offer);
  }
  const populated = offers.length > 0;
  player.spellShop = offers.shift() ?? null;
  player.additionalSpellShop = offers;
  return populated;
}

type LiveMinionDefinition = (typeof MINION_DEFINITIONS)[number];

function specialRefreshDefinitions(
  state: GameState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
  matches: (definition: LiveMinionDefinition) => boolean,
): LiveMinionDefinition[] {
  return MINION_DEFINITIONS.filter(
    (definition) =>
      definition.collectible !== false &&
      definitionIsAvailable(definition, state.activeTribes) &&
      definition.tier >= minimumTier &&
      definition.tier <= maximumTier &&
      matches(definition),
  );
}

function drawOrGenerateSpecialMinion(
  state: GameState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
  matches: (definition: LiveMinionDefinition) => boolean,
  generateBeyondPool: boolean,
): BoardMinionInstance | null {
  const candidates = specialRefreshDefinitions(
    state,
    maximumTier,
    minimumTier,
    matches,
  );
  if (candidates.length === 0) {
    return null;
  }
  const pooled = drawMatchingFromPool(
    state,
    maximumTier,
    (definition) =>
      definition.tier >= minimumTier && matches(definition),
  );
  if (pooled || !generateBeyondPool) {
    return pooled;
  }
  // Wisdomball overflow is outside the pool while offered. Buying or stealing
  // it turns it into one returnable copy; releasing an unbought offer does not.
  const generated = createMinionInstance(
    state,
    candidates[randomIndex(state, candidates.length)].id,
    0,
  );
  generated.poolCopiesOnPurchase = 1;
  return generated;
}

function addSpecialShopMinion(
  player: PlayerState,
  minion: BoardMinionInstance,
): void {
  applyPersistentTavernBonuses(player, minion);
  reconcileWhereverMinion(
    minion,
    player.astralAutomatonsSummoned ?? 0,
    player.eternalKnightsDied ?? 0,
  );
  player.shop.push(minion);
}

function drawOrGenerateSpecificWisdomballCopy(
  state: GameState,
  definitionId: string,
): BoardMinionInstance {
  const definition = getMinionDefinition(definitionId);
  const pooled = drawMatchingFromPool(
    state,
    definition.tier,
    (candidate) => candidate.id === definitionId,
  );
  if (pooled) {
    return pooled;
  }
  const generated = createMinionInstance(state, definitionId, 0);
  if (definition.collectible !== false) {
    generated.poolCopiesOnPurchase = 1;
  }
  return generated;
}

function fillSpecialMinionPage(
  state: GameState,
  player: PlayerState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
  matches: (definition: LiveMinionDefinition) => boolean,
  generateBeyondPool: boolean,
): boolean {
  const capacity = tavernCardCapacity(player);
  while (player.shop.length < capacity) {
    const minion = drawOrGenerateSpecialMinion(
      state,
      maximumTier,
      minimumTier,
      matches,
      generateBeyondPool,
    );
    if (!minion) {
      break;
    }
    addSpecialShopMinion(player, minion);
  }
  if (player.shop.length === 0) {
    return false;
  }
  applyAfterTavernRefreshEffects(state, player);
  return true;
}

function fillWarbandCopyPage(
  state: GameState,
  player: PlayerState,
): boolean {
  const sources = player.board.slice(0, tavernCardCapacity(player));
  if (sources.length === 0) {
    return false;
  }
  for (const source of sources) {
    addSpecialShopMinion(
      player,
      drawOrGenerateSpecificWisdomballCopy(
        state,
        source.definitionId,
      ),
    );
  }
  applyAfterTavernRefreshEffects(state, player);
  return true;
}

function mostCommonActiveBoardTribe(
  state: GameState,
  player: PlayerState,
): Tribe | null {
  const counts = state.activeTribes.map((tribe) => ({
    tribe,
    count: player.board.filter((minion) =>
      minionHasTribe(minion, tribe),
    ).length,
  }));
  const bestCount = Math.max(0, ...counts.map(({ count }) => count));
  if (bestCount === 0) {
    return null;
  }
  const tied = counts.filter(({ count }) => count === bestCount);
  return tied[randomIndex(state, tied.length)]?.tribe ?? null;
}

function helpfulTripleCandidates(
  player: PlayerState,
): Array<{ definitionId: string; copiesNeeded: number }> {
  const definitionIds = new Set(
    [...player.board, ...player.hand]
      .filter(
        (card): card is BoardMinionInstance =>
          card.kind === "minion" && !card.golden,
      )
      .map((minion) => minion.definitionId),
  );
  return [...definitionIds]
    .map((definitionId) => {
      const owned = ownedNormalCount(player, definitionId);
      return {
        definitionId,
        copiesNeeded: Math.max(0, 3 - owned),
      };
    })
    .filter(
      ({ copiesNeeded }) => copiesNeeded > 0 && copiesNeeded <= 2,
    );
}

function fillHelpfulTriplePage(
  state: GameState,
  player: PlayerState,
  maximumTier: TavernTier,
  minimumTier: TavernTier,
): boolean {
  const candidates = helpfulTripleCandidates(player);
  const chosen = candidates[randomIndex(state, candidates.length)];
  if (!chosen) {
    return false;
  }
  for (let count = 0; count < chosen.copiesNeeded; count += 1) {
    addSpecialShopMinion(
      player,
      drawOrGenerateSpecificWisdomballCopy(
        state,
        chosen.definitionId,
      ),
    );
  }
  return fillSpecialMinionPage(
    state,
    player,
    maximumTier,
    minimumTier,
    () => true,
    true,
  );
}

function populateHelpfulRefresh(
  state: GameState,
  player: PlayerState,
  kind: HelpfulRefreshKind,
): boolean {
  if (kind !== "allSpells") {
    player.spellOnlyRefreshActive = false;
  }
  const maximumTier = player.tavernTier;
  const minimumTier = 1 as TavernTier;
  switch (kind) {
    case "warbandCopies":
      return fillWarbandCopyPage(state, player);
    case "legendary":
      return fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        (definition) => definition.legendary === true,
        true,
      );
    case "golden": {
      const populated = fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        () => true,
        true,
      );
      if (!populated) {
        return false;
      }
      const target =
        player.shop[randomIndex(state, player.shop.length)];
      makeMinionGoldenPreservingEnchantments(target);
      reconcileWhereverMinion(
        target,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
      );
      return true;
    }
    case "triple":
      return fillHelpfulTriplePage(
        state,
        player,
        maximumTier,
        minimumTier,
      );
    case "divineShield": {
      const populated = fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        () => true,
        true,
      );
      if (populated) {
        player.shop.forEach((minion) => {
          minion.divineShield = true;
        });
      }
      return populated;
    }
    case "tavernBuff": {
      const populated = fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        () => true,
        true,
      );
      if (populated) {
        buffMinions(
          player.shop,
          player.tavernTier,
          player.tavernTier,
        );
      }
      return populated;
    }
    case "majorityTribe": {
      const tribe = mostCommonActiveBoardTribe(state, player);
      return (
        tribe !== null &&
        fillSpecialMinionPage(
          state,
          player,
          maximumTier,
          minimumTier,
          (definition) => definitionHasTribe(definition, tribe),
          true,
        )
      );
    }
    case "highTier":
      return fillSpecialMinionPage(
        state,
        player,
        6,
        player.tavernTier,
        () => true,
        true,
      );
    case "allSame": {
      const candidates = specialRefreshDefinitions(
        state,
        maximumTier,
        minimumTier,
        () => true,
      );
      if (candidates.length === 0) {
        return false;
      }
      const definitionId =
        candidates[randomIndex(state, candidates.length)].id;
      return fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        (definition) => definition.id === definitionId,
        true,
      );
    }
    case "utility":
      return fillSpecialMinionPage(
        state,
        player,
        maximumTier,
        minimumTier,
        (definition) =>
          HELPFUL_UTILITY_MINION_IDS.has(definition.id),
        true,
      );
    case "allSpells":
      return refreshWithTavernSpells(state, player);
  }
}

function refreshWithWisdomball(
  state: GameState,
  player: PlayerState,
): HelpfulRefreshKind | null {
  releaseShop(state, player);
  player.frozen = false;
  const kinds = [...HELPFUL_REFRESH_KINDS];
  shuffleInPlace(state, kinds);
  for (const kind of kinds) {
    if (populateHelpfulRefresh(state, player, kind)) {
      player.lastHelpfulRefreshKind = kind;
      return kind;
    }
  }
  releaseShop(state, player);
  fillShop(state, player);
  player.lastHelpfulRefreshKind = null;
  return null;
}

function hamuulTargetTribe(
  state: GameState,
  target: BoardMinionInstance,
): Tribe | null {
  if (target.tribes.includes("all")) {
    return state.activeTribes[
      randomIndex(state, state.activeTribes.length)
    ] ?? null;
  }
  const printed = target.tribes.filter(
    (tribe) => tribe !== "neutral" && tribe !== "all",
  );
  const active = printed.filter((tribe) =>
    state.activeTribes.includes(tribe),
  );
  const candidates = active.length > 0 ? active : printed;
  return candidates[randomIndex(state, candidates.length)] ?? null;
}

function refreshWithHamuul(
  state: GameState,
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  const tribe = hamuulTargetTribe(state, target);
  releaseShop(state, player);
  player.frozen = false;
  if (tribe) {
    fillSpecialMinionPage(
      state,
      player,
      player.tavernTier,
      1,
      (definition) => definitionHasTribe(definition, tribe),
      false,
    )
  }
}

function applyTavernSpellEffect(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
  definition: TavernSpellDefinition,
  target: BoardMinionInstance | undefined,
): boolean {
  switch (definition.effect) {
    case "discoverTierOne":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        { exactTier: 1 },
        1,
        { kind: "hand" },
      );
      break;
    case "stealRandomShopMinion": {
      if (player.shop.length === 0) {
        break;
      }
      const [stolen] = player.shop.splice(
        randomIndex(state, player.shop.length),
        1,
      );
      addDrawnMinionToHand(state, player, stolen);
      break;
    }
    case "fortify":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 0, 3);
        target.taunt = true;
        target.temporaryTaunt = false;
      }
      break;
    case "pointyArrow":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 4, 0);
      }
      break;
    case "recruitTrainee":
      addDrawnMinionToHand(
        state,
        player,
        drawMatchingFromPool(state, 1, (candidate) => candidate.tier === 1),
      );
      break;
    case "gainOneGold":
      player.gold += 1;
      break;
    case "tavernDishBanana":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 2, 2);
      }
      break;
    case "themApples":
      buffMinionsFromTavernSpell(player, player.shop, 1, 2);
      break;
    case "chefsChoice": {
      if (!target) {
        break;
      }
      const minion = drawMatchingFromPool(
        state,
        player.tavernTier,
        (candidate) => chefsChoiceMatches(candidate, target),
      );
      if (!minion) {
        addConsolationCoin(state, player);
      } else {
        addDrawnMinionToHand(state, player, minion);
      }
      break;
    }
    case "hastyExcavation":
      player.gold += 1;
      break;
    case "searchThePast":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        { exactTier: player.tavernTier },
        1,
        {
          kind: "hand",
          playableFromRound: state.round + 1,
        },
      );
      break;
    case "freeRefreshes":
      player.freeRefreshes += 2;
      break;
    case "mightOfStormwind":
      buffMinionsFromTavernSpell(
        player,
        randomBoardSubset(state, player.board, 4),
        1,
        2,
      );
      break;
    case "increaseMaxGold":
      player.maxGold += 1;
      break;
    case "carefulInvestment":
      player.pendingNextTurnGold += 2;
      break;
    case "fleetingVigor":
      player.nextCombatAttackBonus +=
        2 + player.tavernSpellAttackBonus;
      player.nextCombatHealthBonus +=
        1 + player.tavernSpellHealthBonus;
      break;
    case "friendlyBounty": {
      const tribe = mostCommonBoardTribe(player);
      addDrawnMinionToHand(
        state,
        player,
        tribe
          ? drawMatchingFromPool(
              state,
              player.tavernTier,
              (candidate) => definitionHasTribe(candidate, tribe),
            )
          : null,
      );
      break;
    }
    case "healthyBounty":
      buffMinionsFromTavernSpell(
        player,
        randomBoardSubset(state, player.board, 4),
        0,
        4,
      );
      break;
    case "hostileBounty":
      buffMinionsFromTavernSpell(
        player,
        randomBoardSubset(state, player.board, 4),
        4,
        0,
      );
      break;
    case "selfishBounty":
      if (player.board[0]) {
        buffMinionsFromTavernSpell(
          player,
          [player.board[0]],
          6,
          6,
        );
      }
      break;
    case "shinyRing":
      buffMinionsFromTavernSpell(player, player.board, 1, 1);
      break;
    case "staffOfEnrichment": {
      const attack = 2 + player.tavernSpellAttackBonus;
      const health = 2 + player.tavernSpellHealthBonus;
      player.tavernMinionAttackBonus += attack;
      player.tavernMinionHealthBonus += health;
      buffMinions(player.shop, attack, health);
      break;
    }
    case "trickyTrousers":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 1, 2);
        target.taunt = !target.taunt;
        target.temporaryTaunt = false;
      }
      break;
    case "gainTwoGold":
      player.gold += 2;
      break;
    case "planarTelescope": {
      const tribe = mostCommonBoardTribe(player);
      const discovered =
        tribe !== null &&
        beginDiscoverInteraction(
          state,
          player,
          spell.instanceId,
          { maximumTier: player.tavernTier, tribe },
          1,
          { kind: "hand" },
        );
      if (!discovered) {
        addConsolationCoin(state, player);
      }
      break;
    }
    case "hubris":
      player.nextCombatWinGold += 3;
      player.nextCombatTieGold += 1;
      break;
    case "carefulMutation":
      if (target) {
        transformMinionKeepingStats(state, player, target);
      }
      break;
    case "timeManagement":
      if (player.isHuman) {
        state.pendingInteraction = {
          kind: "tavernSpellChoice",
          interactionId: nextInteractionId(state),
          playerId: player.id,
          sourceInstanceId: spell.instanceId,
          definitionId: definition.id,
          optionIds: [
            "timeManagementNow",
            "timeManagementNextTurn",
          ],
        };
        return false;
      }
      {
        const profile = getAiStrategyProfile(player.id);
        const needsImmediateTempo =
          player.health + player.armor <
            profile.minimumUpgradeHealth ||
          player.board.length < aiTargetBoardSize(state.round);
        if (needsImmediateTempo) {
          buffMinionsFromTavernSpell(
            player,
            player.board,
            2,
            2,
          );
        } else {
          player.nextTurnBoardAttackBonus +=
            (2 + player.tavernSpellAttackBonus) * 2;
          player.nextTurnBoardHealthBonus +=
            (2 + player.tavernSpellHealthBonus) * 2;
          player.nextTurnBoardBuffPulses += 2;
        }
      }
      break;
    case "stackedAvalanche": {
      if (!target) {
        break;
      }
      const boardIndex = player.board.findIndex(
        (minion) => minion.instanceId === target.instanceId,
      );
      const sold = sellMinionTransaction(state, player, boardIndex);
      const leftmostElemental = player.board.find((minion) =>
        minionHasTribe(minion, "elemental"),
      );
      if (sold && leftmostElemental) {
        buffMinionsFromTavernSpell(
          player,
          [leftmostElemental],
          sold.attack,
          sold.health,
        );
      }
      break;
    }
    case "bloodGemBarrage":
      player.tavernBloodGemBarrageAttack += player.bloodGemAttack;
      player.tavernBloodGemBarrageHealth += player.bloodGemHealth;
      break;
    case "cloneHorn": {
      const original = drawMatchingFromPool(
        state,
        player.tavernTier,
        (candidate) => definitionHasTribe(candidate, "murloc"),
      );
      if (original) {
        const definitionId = original.definitionId;
        addDrawnMinionToHand(state, player, original);
        addGeneratedMinionCopyToHand(state, player, definitionId);
      }
      break;
    }
    case "beetleBlessing":
      player.nextCombatBeetles += 2;
      break;
    case "slimySeafood":
      addRandomSpellcraftSpells(state, player, 3);
      break;
    case "gemConfiscation": {
      if (!target) {
        break;
      }
      applyBloodGem(player, target);
      applyBloodGem(player, target);
      for (const neighbor of adjacentRecruitMinions(player, target)) {
        const stolenAttack = neighbor.bloodGemAttack;
        const stolenHealth = neighbor.bloodGemHealth;
        neighbor.attack = Math.max(
          0,
          neighbor.attack - stolenAttack,
        );
        neighbor.health = Math.max(
          1,
          neighbor.health - stolenHealth,
        );
        neighbor.bloodGemAttack = 0;
        neighbor.bloodGemHealth = 0;
        target.attack += stolenAttack;
        target.health += stolenHealth;
        target.bloodGemAttack += stolenAttack;
        target.bloodGemHealth += stolenHealth;
      }
      break;
    }
    case "backToBack":
      if (target) {
        const amount = 4 + player.backToBackBonus;
        buffMinionsFromTavernSpell(
          player,
          [target],
          amount,
          amount,
        );
        player.backToBackBonus += 4;
      }
      break;
    case "deepwaterClan":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 2, 2);
        buffMinionsFromTavernSpell(
          player,
          player.board.filter((minion) =>
            minionHasTribe(minion, "murloc"),
          ),
          2,
          2,
        );
      }
      break;
    case "defendersRites":
      if (target) {
        buffMinionsFromTavernSpell(player, [target], 6, 6);
        target.taunt = true;
        target.temporaryTaunt = false;
      }
      break;
    case "misplacedTeaSet": {
      const selected = selectDistinctMinionsByTribe(
        state,
        player.board,
      );
      buffMinionsFromTavernSpell(player, selected, 2, 2);
      break;
    }
    case "naturalBlessing":
      if (target) {
        const allRecruitMinions = [...player.board, ...player.shop];
        const targetTribes = target.tribes.filter(
          (tribe) => tribe !== "neutral" && tribe !== "all",
        );
        const matches = target.tribes.includes("all")
          ? allRecruitMinions.filter((minion) =>
              minion.tribes.some((tribe) => tribe !== "neutral"),
            )
          : targetTribes.length === 0
            ? []
            : allRecruitMinions.filter((minion) =>
                targetTribes.some((tribe) =>
                  minionHasTribe(minion, tribe),
                ),
              );
        buffMinionsFromTavernSpell(player, matches, 3, 3);
      }
      break;
    case "shiftingTide":
      if (target) {
        const repetitions = minionHasTribe(target, "naga") ? 4 : 2;
        buffMinionsFromTavernSpell(
          player,
          [target],
          1,
          1,
          repetitions,
        );
      }
      break;
    case "temperatureShift":
      for (const definitionId of ["BG31_816", "BG31_818"]) {
        addDrawnMinionToHand(
          state,
          player,
          drawMatchingFromPool(
            state,
            player.tavernTier,
            (candidate) => candidate.id === definitionId,
          ),
        );
      }
      break;
    case "rideTheWind":
      player.rideTheWindBuffs.push({
        attack: 6 + player.tavernSpellAttackBonus,
        health: 6 + player.tavernSpellHealthBonus,
      });
      break;
    case "stirTheGraveyard":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        {
          maximumTier: player.tavernTier,
          tribe: "undead",
        },
        1,
        {
          kind: "hand",
          destroyAfterPlayThroughRound: state.round,
        },
      );
      break;
    case "blazingInferno":
      if (target) {
        const amount = 4 + player.elementalsPlayedThisTurn;
        buffMinionsFromTavernSpell(
          player,
          [target],
          amount,
          amount,
        );
      }
      break;
    case "arcaneAbsorption":
      if (target && player.shop.length > 0) {
        const highestHealth = Math.max(
          ...player.shop.map((minion) => minion.health),
        );
        const sources = player.shop.filter(
          (minion) => minion.health === highestHealth,
        );
        const source = sources[randomIndex(state, sources.length)];
        buffMinionsFromTavernSpell(
          player,
          [target],
          Math.floor(source.attack / 2),
          Math.floor(source.health / 2),
        );
      }
      break;
    case "eonarsFavor":
      if (target) {
        const tribes = target.tribes.includes("all")
          ? [...LOBBY_TRIBES]
          : target.tribes.filter(
              (tribe) => tribe !== "neutral" && tribe !== "all",
            );
        const buff = {
          tribes,
          attack: 3 + player.tavernSpellAttackBonus,
          health: 3 + player.tavernSpellHealthBonus,
        };
        player.tavernTypeBuffs.push(buff);
        buffMinions(
          player.shop.filter(
            (minion) =>
              tribes.length > 0 &&
              (minion.tribes.includes("all") ||
                tribes.some((tribe) =>
                  minionHasTribe(minion, tribe),
                )),
          ),
          buff.attack,
          buff.health,
        );
      }
      break;
    case "armorStash":
      player.armor = 5;
      break;
    case "overpowered":
      player.nextCombatSetEnemyHealthToOne += 1;
      break;
    case "slaughter":
      if (target) {
        const destroyed = destroyRecruitMinion(
          state,
          player,
          target.instanceId,
        );
        if (destroyed) {
          const attack =
            5 + player.tavernSpellAttackBonus;
          const health = player.tavernSpellHealthBonus;
          player.undeadArmyAttackBonus += attack;
          player.undeadArmyHealthBonus += health;
          for (const minion of [
            ...player.board,
            ...player.hand.filter(
              (card): card is BoardMinionInstance =>
                card.kind === "minion",
            ),
          ]) {
            if (minionHasTribe(minion, "undead")) {
              minion.attack += attack;
              minion.health += health;
            }
          }
        }
      }
      break;
    case "corruptedCupcakes":
      if (target && player.shop.length > 0) {
        let attack = 0;
        let health = 0;
        for (
          let count = 0;
          count < 3 && player.shop.length > 0;
          count += 1
        ) {
          const [consumed] = player.shop.splice(
            randomIndex(state, player.shop.length),
            1,
          );
          attack += consumed.attack;
          health += consumed.health;
          returnMinionToPool(state, consumed);
        }
        buffMinionsFromTavernSpell(
          player,
          [target],
          attack,
          health,
        );
      }
      break;
    case "goldenTouch": {
      const candidates = player.shop.filter(
        (minion) => !minion.golden,
      );
      if (candidates.length > 0) {
        const goldenTarget =
          candidates[randomIndex(state, candidates.length)];
        makeMinionGoldenPreservingEnchantments(goldenTarget);
        reconcileWhereverMinion(
          goldenTarget,
          player.astralAutomatonsSummoned ?? 0,
          player.eternalKnightsDied ?? 0,
        );
      }
      break;
    }
    case "saloonsFinest":
      refreshWithTavernSpells(state, player);
      break;
    case "reservedCorpse":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        {
          maximumTier: player.tavernTier,
          ability: "deathrattle",
        },
        1,
        { kind: "hand" },
      );
      break;
    case "headhunter":
      beginDiscoverInteraction(
        state,
        player,
        spell.instanceId,
        {
          maximumTier: player.tavernTier,
          ability: "battlecry",
        },
        1,
        { kind: "hand" },
      );
      break;
    case "nozdormusProgeny":
      player.nextCombatDoubleLeftmostAttack.push({
        attack: player.tavernSpellAttackBonus,
        health: player.tavernSpellHealthBonus,
      });
      break;
    case "invokeTheDevourer":
      if (target) {
        const boardIndex = player.board.findIndex(
          (minion) => minion.instanceId === target.instanceId,
        );
        const sold = sellMinionTransaction(
          state,
          player,
          boardIndex,
        );
        if (sold && player.board.length > 0) {
          const recipient =
            player.board[randomIndex(state, player.board.length)];
          buffMinionsFromTavernSpell(
            player,
            [recipient],
            sold.attack,
            sold.health,
          );
        }
      }
      break;
    case "unmaskedIdentity":
      if (
        beginHeroPowerChoice(
          state,
          player,
          spell,
          definition,
        )
      ) {
        return false;
      }
      break;
    case "queensCommand":
      buffMinionsFromTavernSpell(player, player.board, 2, 2);
      buffMinionsFromTavernSpell(
        player,
        player.board.filter((minion) => minionHasTribe(minion, "naga")),
        2,
        2,
      );
      break;
    case "sanctify":
      buffMinionsFromTavernSpell(
        player,
        player.board.filter((minion) => minion.divineShield),
        6,
        0,
      );
      break;
    case "waveOfGold":
      buffMinionsFromTavernSpell(player, player.board, 3, 2);
      buffMinionsFromTavernSpell(
        player,
        player.board.filter((minion) => minion.golden),
        3,
        2,
      );
      break;
    case "azeriteEmpowerment":
      buffMinionsFromTavernSpell(player, player.board, 4, 4);
      break;
    case "perfectVision":
      if (target) {
        target.attack =
          20 +
          target.temporaryAttack +
          player.tavernSpellAttackBonus;
        target.health =
          20 +
          target.temporaryHealth +
          player.tavernSpellHealthBonus;
      }
      break;
    case "knockoffWisdomball":
      player.helpfulRefreshes += 2;
      break;
    case "eyesOfTheEarthMother":
      if (target) {
        makeMinionGoldenPreservingEnchantments(target);
        reconcileWhereverMinion(
          target,
          player.astralAutomatonsSummoned ?? 0,
          player.eternalKnightsDied ?? 0,
        );
      }
      break;
    case "lostStaffOfHamuul":
      if (target) {
        refreshWithHamuul(state, player, target);
      }
      break;
  }
  return true;
}

function castTavernSpell(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  targetInstanceId?: string,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  const card = player.hand[handIndex];
  if (handIndex < 0 || card?.kind !== "tavernSpell") {
    return false;
  }
  const definition = getTavernSpellDefinition(card.definitionId);
  const legalTargets = tavernSpellLegalTargets(player, definition);
  const target = targetInstanceId
    ? legalTargets.find(
        (minion) => minion.instanceId === targetInstanceId,
      )
    : undefined;
  if (
    (tavernSpellNeedsTarget(definition) && !target) ||
    (!tavernSpellNeedsTarget(definition) && targetInstanceId !== undefined)
  ) {
    return false;
  }
  player.hand.splice(handIndex, 1);
  const finished = applyTavernSpellEffect(
    state,
    player,
    card,
    definition,
    target,
  );
  if (finished) {
    finishTavernSpellCast(player);
  }
  return true;
}

function playHandCard(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  boardIndex?: number,
): boolean {
  const handIndex = player.hand.findIndex(
    (card) => card.instanceId === cardInstanceId,
  );
  if (handIndex < 0) {
    return false;
  }
  const card = player.hand[handIndex];
  if (card.kind === "minion") {
    return playMinion(state, player, handIndex, boardIndex);
  }
  if (card.kind === "consolationCoin") {
    player.hand.splice(handIndex, 1);
    player.gold += 1;
    return true;
  }
  return card.kind === "tripleReward"
    ? castTripleReward(state, player, handIndex)
    : false;
}

function refreshShop(state: GameState, player: PlayerState): boolean {
  const refreshCost = player.freeRefreshes > 0 ? 0 : REFRESH_COST;
  if (player.gold < refreshCost) {
    return false;
  }
  if (player.freeRefreshes > 0) {
    player.freeRefreshes -= 1;
  } else {
    player.gold -= refreshCost;
  }
  player.frozen = false;
  if (player.helpfulRefreshes > 0) {
    const helpfulKind = refreshWithWisdomball(state, player);
    if (helpfulKind !== null) {
      player.helpfulRefreshes -= 1;
    }
    return true;
  }
  player.lastHelpfulRefreshKind = null;
  releaseShop(state, player);
  fillShop(state, player);
  return true;
}

function upgradeTavern(state: GameState, player: PlayerState): boolean {
  if (player.tavernTier >= 6) {
    return false;
  }
  const cost = getUpgradeCost(state, player.id);
  if (player.gold < cost) {
    return false;
  }
  player.gold -= cost;
  player.tavernTier = (player.tavernTier + 1) as MutableTier;
  player.upgradeDiscount = 0;
  if (playerHasHeroPower(player, "gainGoldAfterUpgrade")) {
    player.gold += 2;
  }
  return true;
}

function ownedNormalCount(player: PlayerState, definitionId: string): number {
  return [...player.board, ...player.hand].filter(
    (minion) =>
      minion.kind === "minion" &&
      minion.definitionId === definitionId && minion.golden === false,
  ).length;
}

function tribeCount(player: PlayerState, tribe: Tribe): number {
  return player.board.filter((minion) => minionHasTribe(minion, tribe)).length;
}

const AI_ECONOMY_EFFECT_KINDS = new Set<MinionEffect["kind"]>([
  "gainGold",
  "gainNextTurnGold",
  "gainTavernSpell",
  "gainMinion",
  "getRandomMinion",
  "gainBloodGems",
  "discountNextTavernSpell",
]);

function minionScore(
  player: PlayerState,
  minion: BoardMinionInstance,
): number {
  const profile = getAiStrategyProfile(player.id);
  let score = (minion.attack + minion.health) * profile.statWeight;
  if (minion.divineShield) {
    score += Math.max(3, minion.attack * 0.65);
  }
  if (minion.taunt) {
    score += 1.5;
  }
  if (minion.poisonous || minion.venomous) {
    score += 8;
  }
  if (minion.reborn) {
    score += 4;
  }
  if (minion.cleave) {
    score += Math.max(3, minion.attack * 0.6);
  }
  if (minion.windfury) {
    score += Math.max(3, minion.attack * 0.5);
  }
  const definitions = minionEffectSources(minion).map((component) =>
    getMinionDefinition(component.definitionId),
  );
  const ownedDefinitions = player.board.flatMap((owned) =>
    minionEffectSources(owned).map((component) =>
      getMinionDefinition(component.definitionId),
    ),
  );
  const battlecryScale =
    1 +
    ownedDefinitions.reduce(
      (best, definition) =>
        Math.max(best, definition.extraBattlecries ?? 0),
      0,
    );
  const deathrattleScale =
    1 +
    ownedDefinitions.reduce(
      (best, definition) =>
        Math.max(best, definition.extraDeathrattles ?? 0),
      0,
    );
  if (definitions.some((definition) => definition.deathrattle)) {
    score += profile.deathrattleBonus * deathrattleScale;
  }
  if (definitions.some((definition) => definition.battlecry)) {
    score += profile.battlecryBonus * battlecryScale;
  }
  for (const definition of definitions) {
    const consumeEffect = (definition.battlecry ?? []).find(
      (effect) => effect.kind === "consumeRandomShopMinion",
    );
    if (consumeEffect) {
      const edible = player.shop.filter(
        (offer) => offer.instanceId !== minion.instanceId,
      );
      const averageStats =
        edible.length === 0
          ? 0
          : edible.reduce(
              (total, offer) =>
                total + offer.attack + offer.health,
              0,
            ) / edible.length;
      score +=
        averageStats *
        (minion.golden &&
        consumeEffect.goldenMode === "doubleStats"
          ? 2
          : 1) *
        0.7;
    }
    if (definition.spellcraft) {
      score += 3;
    }
    if (definition.afterCardPurchased) {
      score += 2.5;
    }
    if (definition.conditionalKeyword) {
      score += 2;
    }
    if (
      definition.endOfTurn?.kind ===
      "periodicGainRandomMinion"
    ) {
      score += profile.economyBonus + 2;
    }
  }
  if (
    definitions.some(
      (definition) =>
        (definition.battlecry ?? []).some((effect) =>
          AI_ECONOMY_EFFECT_KINDS.has(effect.kind),
        ) ||
        (definition.afterSold ?? []).some((effect) =>
          AI_ECONOMY_EFFECT_KINDS.has(effect.kind),
        ) ||
        (definition.sellValue ?? 1) > 1,
    )
  ) {
    score += profile.economyBonus;
  }
  if (
    definitions.some((definition) => definition.magnetic) &&
    player.board.some((target) => canMagnetize(minion, target))
  ) {
    score += profile.magneticBonus;
  }
  const synergyTribes = minion.tribes.filter(
    (tribe) => tribe !== "all" && tribe !== "neutral",
  );
  const strongestTribeCount = synergyTribes.reduce(
    (best, tribe) => Math.max(best, tribeCount(player, tribe)),
    0,
  );
  score += strongestTribeCount * profile.synergyWeight;
  if (
    profile.preferredTribe !== null &&
    minionHasTribe(minion, profile.preferredTribe)
  ) {
    const committedCopies = tribeCount(player, profile.preferredTribe);
    const commitment =
      committedCopies >= 2 ? 1 : committedCopies === 1 ? 0.55 : 0.15;
    score += profile.preferredTribeBonus * commitment;
  }
  score += minion.tier * profile.highTierBonus;
  const copies = ownedNormalCount(player, minion.definitionId);
  if (copies === 1) {
    score += profile.pairBonus;
  } else if (copies >= 2) {
    score += profile.tripleBonus;
  }
  return score;
}

export function scoreMinionForAi(
  player: PlayerState,
  minion: BoardMinionInstance,
): number {
  return minionScore(player, minion);
}

function bestMinionByScore(
  player: PlayerState,
  options: readonly BoardMinionInstance[],
): BoardMinionInstance {
  return [...options].sort((left, right) => {
    const scoreDifference =
      minionScore(player, right) - minionScore(player, left);
    return scoreDifference !== 0
      ? scoreDifference
      : left.instanceId.localeCompare(right.instanceId);
  })[0];
}

function returnDiscoverOptions(
  state: GameState,
  options: readonly BoardMinionInstance[],
  selectedInstanceId?: string,
): void {
  for (const option of options) {
    if (option.instanceId !== selectedInstanceId) {
      returnMinionToPool(state, option);
    }
  }
}

function beginDiscoverInteraction(
  state: GameState,
  player: PlayerState,
  sourceInstanceId: string,
  filter: DiscoverFilter,
  discoveries: number,
  destination: DiscoverDestination,
): boolean {
  if (
    discoveries <= 0 ||
    (destination.kind === "hand" &&
      player.hand.length >= MAX_HAND_SIZE) ||
    state.pendingInteraction !== null
  ) {
    return false;
  }
  const options = reserveDiscoverOptions(state, filter);
  for (const option of options) {
    reconcileWhereverMinion(
      option,
      player.astralAutomatonsSummoned ?? 0,
      player.eternalKnightsDied ?? 0,
    );
  }
  if (options.length === 0) {
    return false;
  }
  if (!player.isHuman) {
    const selected = bestMinionByScore(player, options);
    returnDiscoverOptions(state, options, selected.instanceId);
    if (destination.kind === "hand") {
      if (destination.playableFromRound !== undefined) {
        selected.playableFromRound = destination.playableFromRound;
      }
      if (destination.destroyAfterPlayThroughRound !== undefined) {
        selected.destroyAfterPlayThroughRound =
          destination.destroyAfterPlayThroughRound;
      }
      applyOwnedUndeadArmyBonus(player, selected);
      reconcileWhereverMinion(
        selected,
        player.astralAutomatonsSummoned ?? 0,
        player.eternalKnightsDied ?? 0,
      );
      player.hand.push(selected);
      resolveTriples(state, player);
    } else {
      const target = player.board.find(
        (minion) =>
          minion.instanceId === destination.targetInstanceId,
      );
      if (!target) {
        returnMinionToPool(state, selected);
        return false;
      }
      fuseMinionIntoHost(state, player, selected, target);
      applyAfterMagnetizedEffects(state, player);
    }
    beginDiscoverInteraction(
      state,
      player,
      sourceInstanceId,
      filter,
      discoveries - 1,
      destination,
    );
    return true;
  }
  const interaction: PendingDiscoverInteraction = {
    kind: "discover",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId,
    options,
    filter: { ...filter },
    remainingDiscoveries: discoveries,
    destination: { ...destination },
  };
  state.pendingInteraction = interaction;
  return true;
}

function beginInteractiveBattlecry(
  state: GameState,
  player: PlayerState,
  source: BoardMinionInstance,
): void {
  const ability = getMinionDefinition(
    source.definitionId,
  ).interactiveBattlecry;
  if (!ability) {
    return;
  }
  const goldenRepetitions =
    source.golden && ability.goldenMode === "repeat" ? 2 : 1;
  const repetitions =
    battlecryTriggerCount(player) * goldenRepetitions;
  if (ability.kind === "discoverMinion") {
    beginDiscoverInteraction(
      state,
      player,
      source.instanceId,
      {
        maximumTier: player.tavernTier,
        tribe: ability.tribe,
      },
      repetitions,
      { kind: "hand" },
    );
    return;
  }

  if (ability.kind === "targetedDiscoverMagnetize") {
    const candidates = player.board.filter(
      (minion) =>
        minion.instanceId !== source.instanceId &&
        minionHasTribe(minion, ability.targetTribe),
    );
    if (candidates.length === 0) {
      return;
    }
    const filter: DiscoverFilter = {
      maximumTier: player.tavernTier,
      tribe: ability.discoverTribe,
    };
    if (!player.isHuman) {
      const target = bestMinionByScore(player, candidates);
      beginDiscoverInteraction(
        state,
        player,
        source.instanceId,
        filter,
        repetitions,
        {
          kind: "magnetize",
          targetInstanceId: target.instanceId,
        },
      );
      return;
    }
    state.pendingInteraction = {
      kind: "magnetizeTarget",
      interactionId: nextInteractionId(state),
      playerId: player.id,
      sourceInstanceId: source.instanceId,
      optionInstanceIds: candidates.map(
        (minion) => minion.instanceId,
      ),
      filter,
      remainingDiscoveries: repetitions,
    };
    return;
  }

  const candidates = player.board.filter(
    (minion) => minion.instanceId !== source.instanceId,
  );
  if (candidates.length === 0) {
    return;
  }
  const attack =
    ability.attack +
    ability.attackPerTavernSpell * player.tavernSpellsCastThisTurn;
  const health =
    ability.health +
    ability.healthPerTavernSpell * player.tavernSpellsCastThisTurn;
  if (!player.isHuman) {
    const target = bestMinionByScore(player, candidates);
    target.attack += attack * repetitions;
    target.health += health * repetitions;
    return;
  }
  state.pendingInteraction = {
    kind: "target",
    interactionId: nextInteractionId(state),
    playerId: player.id,
    sourceInstanceId: source.instanceId,
    optionInstanceIds: candidates.map((minion) => minion.instanceId),
    attack,
    health,
    repetitions,
  };
}

function resolvePendingInteraction(
  state: GameState,
  action: Extract<GameAction, { type: "RESOLVE_INTERACTION" }>,
): GameState {
  const pending = state.pendingInteraction;
  if (
    !pending ||
    pending.interactionId !== action.interactionId ||
    pending.playerId !== state.humanPlayerId
  ) {
    return state;
  }
  const player = findPlayer(state, pending.playerId);
  if (!player) {
    return state;
  }
  if (pending.kind === "target") {
    if (!pending.optionInstanceIds.includes(action.optionInstanceId)) {
      return state;
    }
    const target = player.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!target) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextTarget = nextPlayer?.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!nextTarget) {
      return state;
    }
    nextTarget.attack += pending.attack * pending.repetitions;
    nextTarget.health += pending.health * pending.repetitions;
    next.pendingInteraction = null;
    return next;
  }

  if (pending.kind === "magnetizeTarget") {
    if (!pending.optionInstanceIds.includes(action.optionInstanceId)) {
      return state;
    }
    const target = player.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!target) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextTarget = nextPlayer?.board.find(
      (minion) => minion.instanceId === action.optionInstanceId,
    );
    if (!nextPlayer || !nextTarget) {
      return state;
    }
    next.pendingInteraction = null;
    beginDiscoverInteraction(
      next,
      nextPlayer,
      pending.sourceInstanceId,
      pending.filter,
      pending.remainingDiscoveries,
      {
        kind: "magnetize",
        targetInstanceId: nextTarget.instanceId,
      },
    );
    return next;
  }

  if (pending.kind === "tavernSpellChoice") {
    if (
      !pending.optionIds.includes(
        action.optionInstanceId as TavernSpellChoiceId,
      )
    ) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    if (
      !nextPlayer ||
      nextPending?.kind !== "tavernSpellChoice"
    ) {
      return state;
    }
    if (action.optionInstanceId === "timeManagementNow") {
      buffMinionsFromTavernSpell(
        nextPlayer,
        nextPlayer.board,
        2,
        2,
      );
    } else {
      nextPlayer.nextTurnBoardAttackBonus +=
        (2 + nextPlayer.tavernSpellAttackBonus) * 2;
      nextPlayer.nextTurnBoardHealthBonus +=
        (2 + nextPlayer.tavernSpellHealthBonus) * 2;
      nextPlayer.nextTurnBoardBuffPulses += 2;
    }
    next.pendingInteraction = null;
    finishTavernSpellCast(nextPlayer);
    return next;
  }

  if (pending.kind === "heroPowerChoice") {
    if (!pending.optionIds.includes(action.optionInstanceId)) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    const nextPending = next.pendingInteraction;
    if (
      !nextPlayer ||
      nextPending?.kind !== "heroPowerChoice"
    ) {
      return state;
    }
    try {
      getHeroPowerDefinition(action.optionInstanceId);
    } catch {
      return state;
    }
    nextPlayer.heroPowerId = action.optionInstanceId;
    next.pendingInteraction = null;
    finishTavernSpellCast(nextPlayer);
    return next;
  }

  if (pending.kind === "spellcraftChoice") {
    if (
      action.optionInstanceId !== "escapeEruptionAttack" &&
      action.optionInstanceId !== "escapeEruptionHealth"
    ) {
      return state;
    }
    const next = cloneState(state);
    const nextPlayer = findPlayer(next, pending.playerId);
    if (!nextPlayer) {
      return state;
    }
    if (action.optionInstanceId === "escapeEruptionAttack") {
      buffMinions(nextPlayer.board, 4, 0);
    } else {
      buffMinions(nextPlayer.board, 0, 4);
    }
    next.pendingInteraction = null;
    return next;
  }

  const selected = pending.options.find(
    (option) => option.instanceId === action.optionInstanceId,
  );
  if (
    !selected ||
    (pending.destination.kind === "hand" &&
      player.hand.length >= MAX_HAND_SIZE)
  ) {
    return state;
  }
  const next = cloneState(state);
  const nextPlayer = findPlayer(next, pending.playerId);
  const nextPending = next.pendingInteraction;
  if (!nextPlayer || nextPending?.kind !== "discover") {
    return state;
  }
  const nextSelected = nextPending.options.find(
    (option) => option.instanceId === action.optionInstanceId,
  );
  if (!nextSelected) {
    return state;
  }
  returnDiscoverOptions(
    next,
    nextPending.options,
    nextSelected.instanceId,
  );
  const destination = nextPending.destination;
  if (destination.kind === "hand") {
    if (destination.playableFromRound !== undefined) {
      nextSelected.playableFromRound = destination.playableFromRound;
    }
    if (destination.destroyAfterPlayThroughRound !== undefined) {
      nextSelected.destroyAfterPlayThroughRound =
        destination.destroyAfterPlayThroughRound;
    }
    applyOwnedUndeadArmyBonus(nextPlayer, nextSelected);
    reconcileWhereverMinion(
      nextSelected,
      nextPlayer.astralAutomatonsSummoned ?? 0,
      nextPlayer.eternalKnightsDied ?? 0,
    );
    nextPlayer.hand.push(nextSelected);
    resolveTriples(next, nextPlayer);
  } else {
    const target = nextPlayer.board.find(
      (minion) =>
        minion.instanceId === destination.targetInstanceId,
    );
    if (!target) {
      returnMinionToPool(next, nextSelected);
      next.pendingInteraction = null;
      return next;
    }
    fuseMinionIntoHost(next, nextPlayer, nextSelected, target);
    applyAfterMagnetizedEffects(next, nextPlayer);
  }
  next.pendingInteraction = null;
  beginDiscoverInteraction(
    next,
    nextPlayer,
    nextPending.sourceInstanceId,
    nextPending.filter,
    nextPending.remainingDiscoveries - 1,
    destination,
  );
  return next;
}

function playBestAiBloodGem(player: PlayerState): boolean {
  const gem = player.hand.find(
    (card): card is BloodGemSpellInstance => card.kind === "bloodGem",
  );
  if (!gem || player.board.length === 0) {
    return false;
  }
  const keywordTargets =
    gem.bonusKeyword === "rebornForQuilboar"
      ? player.board.filter(
          (minion) => minionHasTribe(minion, "quilboar") && !minion.reborn,
        )
      : gem.bonusKeyword === "divineShieldForQuilboar"
        ? player.board.filter(
            (minion) =>
              minionHasTribe(minion, "quilboar") &&
              !minion.divineShield,
          )
        : [];
  const target = bestMinionByScore(
    player,
    keywordTargets.length > 0 ? keywordTargets : player.board,
  );
  return castBloodGem(player, gem.instanceId, target.instanceId);
}

function playBestAiSpellcraft(
  state: GameState,
  player: PlayerState,
): boolean {
  const spells = player.hand.filter(
    (card): card is SpellcraftSpellInstance =>
      card.kind === "spellcraft",
  );
  for (const spell of spells) {
    const definition = getSpellcraftDefinition(spell.definitionId);
    if (spellcraftNeedsTarget(definition)) {
      const targets = spellcraftLegalTargets(player, definition);
      if (targets.length === 0) {
        continue;
      }
      const target = bestMinionByScore(player, targets);
      return castSpellcraft(
        state,
        player,
        spell.instanceId,
        target.instanceId,
      );
    }
    return castSpellcraft(state, player, spell.instanceId);
  }
  return false;
}

function playBestAiTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  const spells = player.hand.filter(
    (card): card is TavernSpellInstance => card.kind === "tavernSpell",
  ).sort((left, right) => {
    const scoreDifference =
      tavernSpellAiScore(player, right) -
      tavernSpellAiScore(player, left);
    return scoreDifference !== 0
      ? scoreDifference
      : left.instanceId.localeCompare(right.instanceId);
  });
  for (const spell of spells) {
    const definition = getTavernSpellDefinition(spell.definitionId);
    if (tavernSpellNeedsTarget(definition)) {
      const legalTargets = tavernSpellLegalTargets(player, definition);
      const targets =
        definition.effect === "stackedAvalanche"
          ? legalTargets.filter((candidate) =>
              player.board.some(
                (minion) =>
                  minion.instanceId !== candidate.instanceId &&
                  minionHasTribe(minion, "elemental"),
              ),
            )
          : legalTargets;
      if (targets.length === 0) {
        continue;
      }
      const hamuulTarget =
        definition.effect === "lostStaffOfHamuul"
          ? [...targets].sort((left, right) => {
              const matchingBoardCount = (
                candidate: BoardMinionInstance,
              ) =>
                LOBBY_TRIBES.reduce(
                  (best, tribe) =>
                    candidate.tribes.includes("all") ||
                    candidate.tribes.includes(tribe)
                      ? Math.max(
                          best,
                          player.board.filter((minion) =>
                            minionHasTribe(minion, tribe),
                          ).length,
                        )
                      : best,
                  0,
                );
              return (
                matchingBoardCount(right) -
                  matchingBoardCount(left) ||
                left.instanceId.localeCompare(right.instanceId)
              );
            })[0]
          : undefined;
      const target =
        hamuulTarget ??
        (definition.effect === "stackedAvalanche" ||
        definition.effect === "carefulMutation" ||
        definition.effect === "slaughter" ||
        definition.effect === "invokeTheDevourer"
          ? [...targets].sort((left, right) => {
              const scoreDifference =
                minionScore(player, left) -
                minionScore(player, right);
              return scoreDifference !== 0
                ? scoreDifference
                : left.instanceId.localeCompare(
                    right.instanceId,
                  );
            })[0]
          : bestMinionByScore(player, targets));
      return castTavernSpell(
        state,
        player,
        spell.instanceId,
        target.instanceId,
      );
    }
    return castTavernSpell(state, player, spell.instanceId);
  }
  return false;
}

function aiReservedRallyHandMinionIds(
  player: PlayerState,
): Set<string> {
  let reserveCount = 0;
  for (const minion of player.board) {
    for (const component of minionEffectSources(minion)) {
      const definition = getMinionDefinition(component.definitionId);
      for (const rally of definition.rally ?? []) {
        if (rally.kind !== "summonFromHand") {
          continue;
        }
        const count =
          rally.count *
          (component.golden && rally.goldenMode === "doubleCount"
            ? 2
            : 1);
        reserveCount = Math.max(reserveCount, count);
      }
    }
  }
  if (reserveCount === 0) {
    return new Set();
  }
  return new Set(
    player.hand
      .filter(
        (card): card is BoardMinionInstance => card.kind === "minion",
      )
      .sort((left, right) => {
        if (left.attack !== right.attack) {
          return right.attack - left.attack;
        }
        return left.instanceId.localeCompare(right.instanceId);
      })
      .slice(0, reserveCount)
      .map((minion) => minion.instanceId),
  );
}

function playAiHand(state: GameState, player: PlayerState): void {
  while (
    player.hand.length > 0 ||
    player.pendingSpellcraft.length > 0
  ) {
    flushPendingSpellcraft(state, player);
    if (player.hand.length === 0) {
      break;
    }
    const consolationCoin = player.hand.find(
      (card): card is ConsolationCoinSpellInstance =>
        card.kind === "consolationCoin",
    );
    if (consolationCoin) {
      playHandCard(state, player, consolationCoin.instanceId);
      continue;
    }
    const reward = player.hand.find(
      (card): card is TripleRewardSpellInstance =>
        card.kind === "tripleReward",
    );
    if (reward) {
      playHandCard(state, player, reward.instanceId);
      continue;
    }
    const playableMinions = player.hand.filter(
      (card): card is BoardMinionInstance =>
        card.kind === "minion" &&
        (card.playableFromRound ?? 0) <= state.round &&
        (card.destroyAfterPlayThroughRound ?? -1) < state.round,
    );
    const reservedRallyTargets =
      aiReservedRallyHandMinionIds(player);
    const unreservedPlayableMinions = playableMinions.filter(
      (card) =>
        !reservedRallyTargets.has(card.instanceId) &&
        getMinionDefinition(card.definitionId)
          .inHandStartOfCombat === undefined,
    );
    const canKeepAncientSoulInHand =
      player.board.length > 0 ||
      unreservedPlayableMinions.some(
        (card) =>
          card.definitionId !== ANCIENT_SOUL_DEFINITION_ID ||
          card.golden,
      );
    const minions = canKeepAncientSoulInHand
      ? unreservedPlayableMinions.filter(
          (card) =>
            card.definitionId !== ANCIENT_SOUL_DEFINITION_ID ||
            card.golden,
        )
      : unreservedPlayableMinions;
    if (minions.length === 0) {
      if (playBestAiTavernSpell(state, player)) {
        continue;
      }
      if (playBestAiSpellcraft(state, player)) {
        continue;
      }
      if (playBestAiBloodGem(player)) {
        continue;
      }
      break;
    }
    if (player.board.length >= MAX_BOARD_SIZE) {
      const magneticOptions = minions
        .map((source) => ({
          source,
          targets: player.board.filter((target) =>
            canMagnetize(source, target),
          ),
        }))
        .filter((option) => option.targets.length > 0)
        .sort((left, right) => {
          const scoreDifference =
            minionScore(player, right.source) -
            minionScore(player, left.source);
          return scoreDifference !== 0
            ? scoreDifference
            : left.source.instanceId.localeCompare(
                right.source.instanceId,
              );
        });
      const magnetic = magneticOptions[0];
      if (!magnetic) {
        const profile = getAiStrategyProfile(player.id);
        const strongestHandMinion = bestMinionByScore(player, minions);
        const weakestIndex = weakestBoardIndex(player);
        const handScore = minionScore(player, strongestHandMinion);
        const weakestScore = minionScore(
          player,
          player.board[weakestIndex],
        );
        if (
          handScore >= weakestScore + profile.replacementMargin &&
          sellMinion(state, player, weakestIndex)
        ) {
          continue;
        }
        if (playBestAiTavernSpell(state, player)) {
          continue;
        }
        if (playBestAiSpellcraft(state, player)) {
          continue;
        }
        if (playBestAiBloodGem(player)) {
          continue;
        }
        break;
      }
      const target = bestMinionByScore(player, magnetic.targets);
      if (!magnetizeMinion(
        state,
        player,
        magnetic.source.instanceId,
        target.instanceId,
      )) {
        break;
      }
      continue;
    }
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < minions.length; index += 1) {
      const score = minionScore(player, minions[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const chosen = minions[bestIndex];
    playHandCard(state, player, chosen.instanceId);
  }
}

function canAiSpendHealth(
  player: PlayerState,
  cost: number,
): boolean {
  const floor = getAiStrategyProfile(player.id).healthSpendFloor;
  return player.health > cost && player.health - cost >= floor;
}

function canAiPurchaseTavernSpell(
  player: PlayerState,
  spell: TavernSpellInstance,
): boolean {
  if (player.hand.length >= MAX_HAND_SIZE) {
    return false;
  }
  return tavernSpellPurchaseCurrency(spell) === "health"
    ? canAiSpendHealth(player, spell.cost)
    : player.gold >= tavernSpellPurchaseCost(player, spell);
}

function baseTavernSpellAiScore(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  const effect = getTavernSpellDefinition(spell.definitionId).effect;
  const boardSize = player.board.length;
  const targetCount = tavernSpellLegalTargets(player, spell).length;
  switch (effect) {
    case "discoverTierOne":
    case "recruitTrainee":
    case "searchThePast":
      return 4;
    case "stealRandomShopMinion":
      return player.shop.length > 0 ? 7 : 0;
    case "fortify":
    case "pointyArrow":
    case "tavernDishBanana":
    case "trickyTrousers":
      return targetCount > 0 ? 6 : 0;
    case "backToBack":
    case "defendersRites":
    case "shiftingTide":
    case "perfectVision":
      return targetCount > 0 ? 10 : 0;
    case "knockoffWisdomball":
      return 12 + Math.min(4, player.helpfulRefreshes);
    case "eyesOfTheEarthMother":
      return targetCount > 0 ? 14 : 0;
    case "lostStaffOfHamuul":
      return targetCount > 0 ? 11 : 0;
    case "deepwaterClan":
    case "naturalBlessing":
      return targetCount > 0 ? 12 : 0;
    case "chefsChoice":
      return targetCount > 0 ? 6 : 0;
    case "hastyExcavation":
      return canAiSpendHealth(player, spell.cost) ? 4 : 0;
    case "gainOneGold":
      return 1.5;
    case "gainTwoGold":
      return 3;
    case "freeRefreshes":
      return 4;
    case "increaseMaxGold":
      return stateRoundValue(player);
    case "carefulInvestment":
      return 3;
    case "themApples":
      return player.shop.length * 2.5;
    case "staffOfEnrichment":
      return player.shop.length * 3 + 5;
    case "friendlyBounty":
    case "planarTelescope":
      return mostCommonBoardTribe(player) ? 6 : 0;
    case "hubris":
      return 4;
    case "carefulMutation":
      return targetCount > 0 ? 8 : 0;
    case "timeManagement":
      return boardSize * 5;
    case "stackedAvalanche":
      return player.board.some((candidate) =>
        player.board.some(
          (minion) =>
            minion.instanceId !== candidate.instanceId &&
            minionHasTribe(minion, "elemental"),
        ),
      )
        ? 8
        : 0;
    case "bloodGemBarrage":
      return player.shop.length * 3 + 5;
    case "cloneHorn":
      return player.hand.length <= 8 ? 10 : 4;
    case "beetleBlessing":
      return player.board.length < MAX_BOARD_SIZE ? 8 : 4;
    case "slimySeafood":
      return player.hand.length <= 7 && boardSize > 0 ? 10 : 2;
    case "gemConfiscation":
      return targetCount > 0 ? 9 : 0;
    case "temperatureShift":
      return player.hand.length <= 8 ? 10 : 3;
    case "rideTheWind":
      return 11;
    case "stirTheGraveyard":
      return player.hand.length < MAX_HAND_SIZE ? 8 : 0;
    case "blazingInferno":
      return targetCount > 0
        ? 8 + player.elementalsPlayedThisTurn
        : 0;
    case "arcaneAbsorption":
      return targetCount > 0 ? 10 : 0;
    case "eonarsFavor":
      return targetCount > 0 ? 10 : 0;
    case "armorStash":
      return player.armor < 5 ? (5 - player.armor) * 2 : 0;
    case "overpowered":
      return 8;
    case "slaughter":
      return targetCount > 0 ? 11 : 0;
    case "corruptedCupcakes":
      return targetCount > 0 && player.shop.length > 0
        ? player.shop
            .map((minion) => minion.attack + minion.health)
            .sort((left, right) => right - left)
            .slice(0, 3)
            .reduce((total, value) => total + value, 0) / 2
        : 0;
    case "goldenTouch":
      return player.shop.some((minion) => !minion.golden) ? 12 : 0;
    case "saloonsFinest":
      return player.spellOnlyRefreshActive ? 0 : 9;
    case "reservedCorpse":
    case "headhunter":
      return player.hand.length < MAX_HAND_SIZE ? 8 : 0;
    case "nozdormusProgeny":
      return boardSize > 0 ? 10 : 3;
    case "invokeTheDevourer":
      return targetCount > 1 ? 10 : targetCount === 1 ? 2 : 0;
    case "unmaskedIdentity":
      return 8;
    case "selfishBounty":
      return boardSize > 0 ? 12 : 0;
    case "fleetingVigor":
    case "shinyRing":
    case "azeriteEmpowerment":
      return boardSize * 3;
    case "mightOfStormwind":
    case "healthyBounty":
    case "hostileBounty":
    case "misplacedTeaSet":
    case "queensCommand":
    case "sanctify":
    case "waveOfGold":
      return boardSize * 4;
  }
}

const AI_ECONOMY_TAVERN_SPELL_EFFECTS = new Set<
  TavernSpellDefinition["effect"]
>([
  "discoverTierOne",
  "recruitTrainee",
  "stealRandomShopMinion",
  "knockoffWisdomball",
  "hastyExcavation",
  "gainOneGold",
  "gainTwoGold",
  "freeRefreshes",
  "increaseMaxGold",
  "carefulInvestment",
  "cloneHorn",
  "temperatureShift",
  "reservedCorpse",
  "headhunter",
  "saloonsFinest",
]);

function tavernSpellAiScore(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  const profile = getAiStrategyProfile(player.id);
  const effect = getTavernSpellDefinition(spell.definitionId).effect;
  const economyBonus = AI_ECONOMY_TAVERN_SPELL_EFFECTS.has(effect)
    ? profile.economyBonus * 0.75
    : 0;
  return (
    baseTavernSpellAiScore(player, spell) *
      profile.spellValueMultiplier +
    economyBonus
  );
}

function stateRoundValue(player: PlayerState): number {
  return player.maxGold < 13 ? 5 : 1;
}

function weakestBoardIndex(player: PlayerState): number {
  let weakestIndex = 0;
  let weakestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index < player.board.length; index += 1) {
    const score = minionScore(player, player.board[index]);
    if (score < weakestScore) {
      weakestScore = score;
      weakestIndex = index;
    }
  }
  return weakestIndex;
}

function bestShopIndex(player: PlayerState): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < player.shop.length; index += 1) {
    const score = minionScore(player, player.shop[index]);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function bestMagneticShopIndex(player: PlayerState): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < player.shop.length; index += 1) {
    const offer = player.shop[index];
    if (
      !player.board.some((target) => canMagnetize(offer, target))
    ) {
      continue;
    }
    const score = minionScore(player, offer);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function arrangeAiBoard(
  player: PlayerState,
  opponent?: PlayerState,
): void {
  const profile = getAiStrategyProfile(player.id);
  const opponentHasTaunt =
    opponent?.board.some((minion) => minion.taunt) ?? false;
  const opponentHasShieldedTaunt =
    opponent?.board.some(
      (minion) => minion.taunt && minion.divineShield,
    ) ?? false;
  const opponentHasCleave =
    opponent?.board.some((minion) => minion.cleave) ?? false;
  const hasDeathrattle = (minion: BoardMinionInstance) =>
    minionEffectSources(minion).some(
      (component) =>
        getMinionDefinition(component.definitionId).deathrattle !==
        undefined,
    );
  const isSupport = (minion: BoardMinionInstance) =>
    minionEffectSources(minion).some((component) => {
      const definition = getMinionDefinition(component.definitionId);
      return (
        (definition.extraBattlecries ?? 0) > 0 ||
        (definition.extraDeathrattles ?? 0) > 0 ||
        definition.aura !== undefined ||
        definition.afterFriendlyPlayed !== undefined ||
        definition.afterFriendlySummoned !== undefined ||
        definition.afterFriendlyDied !== undefined
      );
    });

  player.board.sort((left, right) => {
    const attackOrder = (minion: BoardMinionInstance) => {
      if (minion.taunt) {
        return 5;
      }
      if (opponentHasTaunt && minion.cleave) {
        return 0;
      }
      if (hasDeathrattle(minion)) {
        return profile.id === "deathrattle" ? 0 : 1;
      }
      if (isSupport(minion)) {
        return 4;
      }
      return 2;
    };
    const orderDifference = attackOrder(left) - attackOrder(right);
    if (orderDifference !== 0) {
      return orderDifference;
    }
    if (left.attack !== right.attack) {
      return right.attack - left.attack;
    }
    return left.instanceId.localeCompare(right.instanceId);
  });

  if (
    opponentHasShieldedTaunt &&
    profile.scoutingWeight >= 0.5
  ) {
    const shieldBreakerIndex = player.board.reduce(
      (bestIndex, minion, index) => {
        if (
          minion.attack <= 0 ||
          minion.taunt ||
          minion.cleave ||
          isSupport(minion)
        ) {
          return bestIndex;
        }
        if (bestIndex < 0) {
          return index;
        }
        const best = player.board[bestIndex];
        return minion.attack < best.attack ||
          (minion.attack === best.attack &&
            minion.instanceId.localeCompare(best.instanceId) < 0)
          ? index
          : bestIndex;
      },
      -1,
    );
    if (shieldBreakerIndex > 0) {
      const [shieldBreaker] = player.board.splice(
        shieldBreakerIndex,
        1,
      );
      player.board.unshift(shieldBreaker);
    }
  }

  if (opponentHasCleave) {
    const firstTauntIndex = player.board.findIndex(
      (minion) => minion.taunt,
    );
    if (firstTauntIndex > 1) {
      const bufferIndex = player.board.reduce(
        (bestIndex, minion, index) => {
          if (
            index >= firstTauntIndex ||
            minion.taunt ||
            hasDeathrattle(minion) ||
            isSupport(minion)
          ) {
            return bestIndex;
          }
          if (bestIndex < 0) {
            return index;
          }
          const best = player.board[bestIndex];
          const minionValue = minion.attack + minion.health;
          const bestValue = best.attack + best.health;
          return minionValue < bestValue ||
            (minionValue === bestValue &&
              minion.instanceId.localeCompare(best.instanceId) < 0)
            ? index
            : bestIndex;
        },
        -1,
      );
      if (bufferIndex >= 0 && bufferIndex !== firstTauntIndex - 1) {
        const [buffer] = player.board.splice(bufferIndex, 1);
        const nextTauntIndex = player.board.findIndex(
          (minion) => minion.taunt,
        );
        player.board.splice(nextTauntIndex, 0, buffer);
      }
    }
  }
}

export function planAiBoardOrder(
  player: PlayerState,
  opponent?: PlayerState,
): string[] {
  const workingPlayer: PlayerState = {
    ...player,
    board: [...player.board],
  };
  arrangeAiBoard(workingPlayer, opponent);
  return workingPlayer.board.map((minion) => minion.instanceId);
}

function previouslyObservedOpponent(
  battles: readonly BattleSummary[],
  observer: PlayerState,
  opponent: PlayerState,
): PlayerState | undefined {
  if (observer.lastOpponentId !== opponent.id) {
    return undefined;
  }
  const previousMatchup = battles.find(
    (battle) =>
      (battle.playerAId === observer.id &&
        battle.playerBId === opponent.id) ||
      (battle.playerAId === opponent.id &&
        battle.playerBId === observer.id),
  );
  const observedBoard =
    previousMatchup?.initialBoards[opponent.id]?.filter(
      (minion): minion is BoardMinionInstance =>
        minion.kind === "minion",
    );
  if (!observedBoard) {
    return undefined;
  }
  return {
    ...opponent,
    board: observedBoard,
    hand: [],
    shop: [],
    spellShop: null,
    additionalSpellShop: [],
  };
}

function shouldUpgradeAiTavern(
  state: GameState,
  player: PlayerState,
): boolean {
  const bestIndex = bestShopIndex(player);
  const bestAffordableSpellScore =
    tavernSpellShopOffers(player)
      .filter((spell) => canAiPurchaseTavernSpell(player, spell))
      .reduce(
        (best, spell) =>
          Math.max(best, tavernSpellAiScore(player, spell)),
        Number.NEGATIVE_INFINITY,
      );
  const weakestIndex =
    player.board.length > 0 ? weakestBoardIndex(player) : -1;
  return shouldAiUpgrade({
    profile: getAiStrategyProfile(player.id),
    round: state.round,
    tavernTier: player.tavernTier,
    health: player.health,
    armor: player.armor,
    gold: player.gold,
    upgradeCost: getUpgradeCost(state, player.id),
    boardSize: player.board.length,
    bestShopScore:
      bestIndex >= 0
        ? minionScore(player, player.shop[bestIndex])
        : Number.NEGATIVE_INFINITY,
    weakestBoardScore:
      weakestIndex >= 0
        ? minionScore(player, player.board[weakestIndex])
        : 0,
    bestAffordableSpellScore,
  });
}

const AI_IMMEDIATE_MINION_SPELL_EFFECTS =
  new Set<TavernSpellEffect>([
    "discoverTierOne",
    "stealRandomShopMinion",
    "recruitTrainee",
    "chefsChoice",
    "friendlyBounty",
    "planarTelescope",
    "cloneHorn",
    "temperatureShift",
    "reservedCorpse",
    "headhunter",
  ]);

function immediateAiSpellGoldGain(effect: TavernSpellEffect): number {
  switch (effect) {
    case "hastyExcavation":
    case "gainOneGold":
      return 1;
    case "gainTwoGold":
      return 2;
    default:
      return 0;
  }
}

/**
 * A real player does not spend the only three Gold on a small buff and enter
 * combat with an empty board. Until the stage target is met, a spell must
 * either supply a playable minion itself or leave enough Gold to buy one.
 */
function aiSpellPreservesTempo(
  player: PlayerState,
  spell: TavernSpellInstance,
): boolean {
  const definition = getTavernSpellDefinition(spell.definitionId);
  if (AI_IMMEDIATE_MINION_SPELL_EFFECTS.has(definition.effect)) {
    return true;
  }
  const goldCost =
    tavernSpellPurchaseCurrency(spell) === "health"
      ? 0
      : tavernSpellPurchaseCost(player, spell);
  return (
    player.gold -
      goldCost +
      immediateAiSpellGoldGain(definition.effect) >=
    BUY_COST
  );
}

function runAiRecruit(state: GameState, player: PlayerState): void {
  const profile = getAiStrategyProfile(player.id);
  let actions = 0;
  let upgradedThisTurn = false;
  playAiHand(state, player);

  if (
    shouldUpgradeAiTavern(state, player) &&
    upgradeTavern(state, player)
  ) {
    upgradedThisTurn = true;
    actions += 1;
  }

  let refreshes = 0;
  while (actions < 50) {
    playAiHand(state, player);
    if (
      !upgradedThisTurn &&
      shouldUpgradeAiTavern(state, player) &&
      upgradeTavern(state, player)
    ) {
      upgradedThisTurn = true;
      actions += 1;
      continue;
    }
    const shopIndex = bestShopIndex(player);
    const bestMinionOffer =
      shopIndex >= 0 ? player.shop[shopIndex] : undefined;
    const bestMinionScore = bestMinionOffer
      ? minionScore(player, bestMinionOffer)
      : Number.NEGATIVE_INFINITY;
    const spellOffer = tavernSpellShopOffers(player)
      .filter((offer) => canAiPurchaseTavernSpell(player, offer))
      .sort((left, right) => {
        const scoreDifference =
          tavernSpellAiScore(player, right) -
          tavernSpellAiScore(player, left);
        return scoreDifference !== 0
          ? scoreDifference
          : left.instanceId.localeCompare(right.instanceId);
      })[0] ?? null;
    const spellCurrency = spellOffer
      ? tavernSpellPurchaseCurrency(spellOffer)
      : "gold";
    const canAffordSpell =
      spellOffer !== null &&
      canAiPurchaseTavernSpell(player, spellOffer);
    const spellScore = spellOffer
      ? tavernSpellAiScore(player, spellOffer)
      : Number.NEGATIVE_INFINITY;
    const spellPurchaseCost = spellOffer
      ? tavernSpellPurchaseCost(player, spellOffer)
      : 0;
    const spellEfficiency = spellOffer
      ? spellScore / Math.max(1, spellPurchaseCost)
      : Number.NEGATIVE_INFINITY;
    const minionEfficiency =
      bestMinionOffer && player.gold >= BUY_COST
        ? bestMinionScore / BUY_COST
        : Number.NEGATIVE_INFINITY;
    const minionCompletesTriple =
      bestMinionOffer !== undefined &&
      ownedNormalCount(player, bestMinionOffer.definitionId) >= 2;
    const needsBoardMinion =
      bestMinionOffer !== undefined &&
      player.gold >= BUY_COST &&
      player.board.length < aiTargetBoardSize(state.round);
    const spellPreservesTempo =
      spellOffer === null ||
      !needsBoardMinion ||
      aiSpellPreservesTempo(player, spellOffer);
    const preferSpell =
      spellPreservesTempo &&
      (spellCurrency === "health" ||
        bestMinionOffer === undefined ||
        player.gold < BUY_COST ||
        (!minionCompletesTriple &&
          spellEfficiency >= minionEfficiency * 0.85));
    if (
      spellOffer &&
      player.hand.length < MAX_HAND_SIZE &&
      canAffordSpell &&
      preferSpell &&
      spellScore >=
        (spellCurrency === "health"
          ? 3
          : Math.max(1.5, spellPurchaseCost * 1.7)) &&
      buyTavernSpell(state, player, spellOffer.instanceId)
    ) {
      actions += 1;
      continue;
    }
    if (
      shopIndex >= 0 &&
      player.gold >= BUY_COST &&
      player.hand.length < MAX_HAND_SIZE
    ) {
      if (player.board.length < MAX_BOARD_SIZE) {
        const weakestIndex =
          player.board.length > 0 ? weakestBoardIndex(player) : -1;
        const weakestScore =
          weakestIndex >= 0
            ? minionScore(player, player.board[weakestIndex])
            : Number.NEGATIVE_INFINITY;
        const ownedCopies = ownedNormalCount(
          player,
          player.shop[shopIndex].definitionId,
        );
        const shouldBuy =
          player.board.length < aiTargetBoardSize(state.round) ||
          ownedCopies >= 1 ||
          bestMinionScore >=
            weakestScore + profile.replacementMargin / 2;
        if (
          shouldBuy &&
          buyMinion(state, player, shopIndex)
        ) {
          actions += 1;
          continue;
        }
      } else {
        const magneticShopIndex = bestMagneticShopIndex(player);
        if (
          magneticShopIndex >= 0 &&
          buyMinion(state, player, magneticShopIndex)
        ) {
          actions += 1;
          playAiHand(state, player);
          continue;
        }
        const weakestIndex = weakestBoardIndex(player);
        const candidateScore = minionScore(player, player.shop[shopIndex]);
        const weakestScore = minionScore(player, player.board[weakestIndex]);
        if (
          candidateScore >=
          weakestScore + profile.replacementMargin
        ) {
          sellMinion(state, player, weakestIndex);
          actions += 1;
          if (buyMinion(state, player, bestShopIndex(player))) {
            actions += 1;
            continue;
          }
        }
      }
    }

    const refreshCost = player.freeRefreshes > 0 ? 0 : REFRESH_COST;
    const refreshLimit =
      profile.maxRefreshes +
      (player.health + player.armor <
      profile.minimumUpgradeHealth
        ? 1
        : 0);
    const canBuyAfterRefresh =
      player.hand.length < MAX_HAND_SIZE &&
      player.gold - refreshCost >= BUY_COST;
    const canSpeculativelyRefresh =
      player.hand.length < MAX_HAND_SIZE &&
      refreshes === 0 &&
      ((refreshCost === 0 && player.freeRefreshes > 0) ||
        (refreshCost === REFRESH_COST &&
          player.gold === REFRESH_COST &&
          player.board.length >= aiTargetBoardSize(state.round)));
    if (
      refreshes < refreshLimit &&
      (canBuyAfterRefresh || canSpeculativelyRefresh)
    ) {
      refreshShop(state, player);
      refreshes += 1;
      actions += 1;
      continue;
    }
    break;
  }

  playAiHand(state, player);
  const bestRemaining =
    player.shop.length > 0 ? player.shop[bestShopIndex(player)] : undefined;
  const bestRemainingSpell = [...tavernSpellShopOffers(player)].sort(
    (left, right) => {
      const scoreDifference =
        tavernSpellAiScore(player, right) -
        tavernSpellAiScore(player, left);
      return scoreDifference !== 0
        ? scoreDifference
        : left.instanceId.localeCompare(right.instanceId);
    },
  )[0];
  const freezePairCount = profile.id === "triple" ? 1 : 2;
  const freezeMinion =
    bestRemaining !== undefined &&
    (player.gold < BUY_COST ||
      player.hand.length >= MAX_HAND_SIZE) &&
    (ownedNormalCount(player, bestRemaining.definitionId) >=
      freezePairCount ||
      minionScore(player, bestRemaining) >=
        7 +
          player.tavernTier * 2 -
          profile.freezeScoreBonus);
  const freezeSpell =
    bestRemainingSpell !== undefined &&
    tavernSpellAiScore(player, bestRemainingSpell) >=
      8 - profile.freezeScoreBonus;
  player.frozen = freezeMinion || freezeSpell;
  reconcileConditionalMinions(player);
  arrangeAiBoard(player);
}

function pushBattleEvent(
  events: BattleEvent[],
  event: Omit<BattleEvent, "index">,
): void {
  events.push({ ...event, index: events.length });
}

function availableAttackIndex(
  board: readonly MinionInstance[],
  cursor: number,
): number {
  if (board.length === 0) {
    return -1;
  }
  for (let offset = 0; offset < board.length; offset += 1) {
    const index = (cursor + offset) % board.length;
    if (board[index].attack > 0) {
      return index;
    }
  }
  return -1;
}

function removeDead(
  board: MinionInstance[],
  ownerId: PlayerId,
): DeadMinion[] {
  const dead: DeadMinion[] = [];
  for (let index = 0; index < board.length; index += 1) {
    if (board[index].health <= 0) {
      dead.push({ minion: board[index], index, ownerId });
    }
  }
  for (let index = dead.length - 1; index >= 0; index -= 1) {
    board.splice(dead[index].index, 1);
  }
  return dead;
}

interface CombatStatBuff {
  attack: number;
  health: number;
}

interface CombatContext {
  state: GameState;
  events: BattleEvent[];
  playerIds: readonly [PlayerId, PlayerId];
  /** A ghost board fights normally but must never mutate its former owner. */
  ghostOwnerId?: PlayerId;
  boards: Record<PlayerId, MinionInstance[]>;
  deadMechs: Record<PlayerId, MinionInstance[]>;
  tribeBuffs: Record<PlayerId, Partial<Record<Tribe, CombatStatBuff>>>;
  pendingBeetles: Record<PlayerId, number>;
  astralAutomatonsSummoned: Record<PlayerId, number>;
  eternalKnightsDied: Record<PlayerId, number>;
}

function opponentId(context: CombatContext, ownerId: PlayerId): PlayerId {
  return context.playerIds[0] === ownerId
    ? context.playerIds[1]
    : context.playerIds[0];
}

function persistentCombatOwner(
  context: CombatContext,
  ownerId: PlayerId,
): PlayerState | undefined {
  if (context.ghostOwnerId === ownerId) {
    return undefined;
  }
  const owner = findPlayer(context.state, ownerId);
  return owner?.alive ? owner : undefined;
}

function pushWhereverBuffEvent(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
  target: MinionInstance,
  delta: { attack: number; health: number },
  message: string,
): void {
  if (delta.attack === 0 && delta.health === 0) {
    return;
  }
  pushBattleEvent(context.events, {
    type: "buff",
    actorPlayerId: ownerId,
    actorInstanceId,
    targetPlayerId: ownerId,
    targetInstanceId: target.instanceId,
    attackDelta: delta.attack,
    healthDelta: delta.health,
    minion: cloneMinion(target),
    message,
  });
}

function reconcileCombatWhereverMinions(
  context: CombatContext,
  ownerId: PlayerId,
  actorInstanceId: string,
  message: string,
): void {
  for (const minion of context.boards[ownerId]) {
    const delta = reconcileWhereverMinion(
      minion,
      context.astralAutomatonsSummoned[ownerId],
      context.eternalKnightsDied[ownerId],
    );
    pushWhereverBuffEvent(
      context,
      ownerId,
      actorInstanceId,
      minion,
      delta,
      message,
    );
  }
}

function observeCombatAutomatonSummon(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: BoardMinionInstance,
): void {
  if (summoned.definitionId !== ASTRAL_AUTOMATON_DEFINITION_ID) {
    return;
  }
  summoned.astralAutomatonSummoned = true;
  context.astralAutomatonsSummoned[ownerId] += 1;
  const persistentOwner = persistentCombatOwner(context, ownerId);
  if (persistentOwner) {
    persistentOwner.astralAutomatonsSummoned += 1;
    reconcilePlayerWhereverMinions(persistentOwner);
  }
  reconcileCombatWhereverMinions(
    context,
    ownerId,
    summoned.instanceId,
    `${summoned.name}的召唤强化了其他星元自动机。`,
  );
}

function observeCombatFriendlyDeath(
  context: CombatContext,
  death: DeadMinion,
): void {
  const persistentOwner = persistentCombatOwner(
    context,
    death.ownerId,
  );
  if (persistentOwner) {
    observePersistentFriendlyDeath(persistentOwner, death.minion);
  }
  if (death.minion.definitionId !== ETERNAL_KNIGHT_DEFINITION_ID) {
    return;
  }
  context.eternalKnightsDied[death.ownerId] += 1;
  reconcileCombatWhereverMinions(
    context,
    death.ownerId,
    death.minion.instanceId,
    `${death.minion.name}的死亡强化了永恒骑士。`,
  );
}

function combatBuffTargets(
  state: GameState,
  board: MinionInstance[],
  source: MinionInstance,
  effect: BuffEffect,
): MinionInstance[] {
  switch (effect.target) {
    case "self":
      return [];
    case "allFriendly":
      return [...board];
    case "otherFriendly":
      return board.filter(
        (minion) => minion.instanceId !== source.instanceId,
      );
    case "otherFriendlyTribe":
      return board.filter(
        (minion) =>
          minion.instanceId !== source.instanceId &&
          minionHasTribe(minion, effect.tribe),
      );
    case "friendlyTribe":
      return board.filter((minion) =>
        minionHasTribe(minion, effect.tribe),
      );
    case "randomFriendlyTribe": {
      const candidates = board.filter(
        (minion) => minionHasTribe(minion, effect.tribe),
      );
      return candidates.length === 0
        ? []
        : [candidates[randomIndex(state, candidates.length)]];
    }
    case "adjacentFriendly":
      return [];
    case "randomFriendly":
      return board.length === 0
        ? []
        : [board[randomIndex(state, board.length)]];
  }
}

function applyStartOfCombatEffects(
  state: GameState,
  board: MinionInstance[],
): void {
  for (const source of [...board]) {
    for (const component of minionEffectSources(source)) {
      const effects =
        getMinionDefinition(component.definitionId).startOfCombat ?? [];
      const scale = component.golden ? 2 : 1;
      for (const effect of effects) {
        if (effect.kind === "buff") {
          const targets =
            effect.target === "self"
              ? [source]
              : combatBuffTargets(state, board, source, effect);
          for (const target of targets) {
            applyBuff(target, effect, scale);
          }
        } else if (effect.kind === "grantShield") {
          if (effect.target === "self") {
            source.divineShield = true;
            continue;
          }
          const candidates = board.filter(
            (minion) => minion.instanceId !== source.instanceId,
          );
          for (
            let count = 0;
            count < scale && candidates.length > 0;
            count += 1
          ) {
            const targetIndex = randomIndex(state, candidates.length);
            candidates[targetIndex].divineShield = true;
            candidates.splice(targetIndex, 1);
          }
        }
      }
    }
  }
}

function applyCombatAuras(board: MinionInstance[]): void {
  for (const source of board) {
    for (const component of minionEffectSources(source)) {
      const aura = getMinionDefinition(component.definitionId).aura;
      if (!aura) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      for (const target of board) {
        if (
          !minionHasTribe(target, aura.tribe) ||
          (aura.otherOnly && target.instanceId === source.instanceId)
        ) {
          continue;
        }
        target.attack += aura.attack * scale;
        target.health += aura.health * scale;
      }
    }
  }
  for (const minion of board) {
    reconcileConditionalMinion(minion);
  }
}

function applyExistingAurasToSummoned(
  board: readonly MinionInstance[],
  summoned: MinionInstance,
): void {
  for (const source of board) {
    for (const component of minionEffectSources(source)) {
      const aura = getMinionDefinition(component.definitionId).aura;
      if (
        !aura ||
        !minionHasTribe(summoned, aura.tribe) ||
        (aura.otherOnly && summoned.instanceId === source.instanceId)
      ) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      summoned.attack += aura.attack * scale;
      summoned.health += aura.health * scale;
    }
  }
  reconcileConditionalMinion(summoned);
}

function applyNewAuraSource(
  board: readonly MinionInstance[],
  source: MinionInstance,
  ownerId: PlayerId,
): Omit<BattleEvent, "index">[] {
  const events: Omit<BattleEvent, "index">[] = [];
  for (const component of minionEffectSources(source)) {
    const aura = getMinionDefinition(component.definitionId).aura;
    if (!aura) {
      continue;
    }
    const scale = component.golden ? 2 : 1;
    for (const target of board) {
      if (
        !minionHasTribe(target, aura.tribe) ||
        (aura.otherOnly && target.instanceId === source.instanceId)
      ) {
        continue;
      }
      const attackDelta = aura.attack * scale;
      const healthDelta = aura.health * scale;
      target.attack += attackDelta;
      target.health += healthDelta;
      reconcileConditionalMinion(target);
      events.push({
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: cloneMinion(target),
        message: `${source.name}的光环使${target.name}获得+${attackDelta}/+${healthDelta}。`,
      });
    }
  }
  return events;
}

function removeCombatAuraSource(
  context: CombatContext,
  death: DeadMinion,
): void {
  for (const component of minionEffectSources(death.minion)) {
    const aura = getMinionDefinition(component.definitionId).aura;
    if (!aura) {
      continue;
    }
    const scale = component.golden ? 2 : 1;
    for (const target of context.boards[death.ownerId]) {
      if (!minionHasTribe(target, aura.tribe)) {
        continue;
      }
      const attackDelta = -aura.attack * scale;
      const healthDelta = -aura.health * scale;
      target.attack += attackDelta;
      target.health += healthDelta;
      const targetSnapshot = cloneMinion(target);
      targetSnapshot.health = Math.max(0, targetSnapshot.health);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        targetPlayerId: death.ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: targetSnapshot,
        message: `${death.minion.name}阵亡后，${target.name}失去光环加成。`,
      });
    }
  }
}

function extraDeathrattles(board: readonly MinionInstance[]): number {
  return board.reduce((total, minion) => {
    return (
      total +
      minionEffectSources(minion).reduce((sourceTotal, component) => {
        const extra =
          getMinionDefinition(component.definitionId)
            .extraDeathrattles ?? 0;
        return sourceTotal + extra * (component.golden ? 2 : 1);
      }, 0)
    );
  }, 0);
}

function applyPersistentTribeBuff(
  context: CombatContext,
  ownerId: PlayerId,
  minion: MinionInstance,
): void {
  for (const [tribe, buff] of Object.entries(
    context.tribeBuffs[ownerId],
  ) as [Tribe, CombatStatBuff][]) {
    if (!buff || !minionHasTribe(minion, tribe)) {
      continue;
    }
    minion.attack += buff.attack;
    minion.health += buff.health;
  }
}

function applyCombatSummonHeroPower(
  context: CombatContext,
  ownerId: PlayerId,
  minion: MinionInstance,
): void {
  const owner = findPlayer(context.state, ownerId);
  if (!owner || !playerHasHeroPower(owner, "buffCombatSummons")) {
    return;
  }
  minion.attack += 1;
  minion.health += 2;
  minion.taunt = true;
}

function triggerAfterFriendlySummoned(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: MinionInstance,
): Omit<BattleEvent, "index">[] {
  const events: Omit<BattleEvent, "index">[] = [];
  for (const watcher of context.boards[ownerId]) {
    if (watcher.instanceId === summoned.instanceId) {
      continue;
    }
    for (const component of minionEffectSources(watcher)) {
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlySummoned;
      if (!trigger || !minionHasTribe(summoned, trigger.tribe)) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      if (trigger.grantShield) {
        const attackDelta = (trigger.attack ?? 0) * scale;
        const healthDelta = (trigger.health ?? 0) * scale;
        watcher.attack += attackDelta;
        watcher.health += healthDelta;
        watcher.divineShield = true;
        reconcileConditionalMinion(watcher);
        events.push({
          type: "buff",
          actorPlayerId: ownerId,
          actorInstanceId: summoned.instanceId,
          targetPlayerId: ownerId,
          targetInstanceId: watcher.instanceId,
          attackDelta,
          healthDelta,
          minion: cloneMinion(watcher),
          message: `${summoned.name}被召唤后，${watcher.name}获得+${attackDelta}/+${healthDelta}和圣盾。`,
        });
      } else {
        summoned.attack += (trigger.attack ?? 0) * scale;
        summoned.health += (trigger.health ?? 0) * scale;
        reconcileConditionalMinion(summoned);
      }
    }
  }
  return events;
}

function summonCombatMinion(
  context: CombatContext,
  ownerId: PlayerId,
  definitionId: string,
  insertAt: number,
  source: MinionInstance,
  golden = false,
  taunt = false,
): MinionInstance | null {
  if (context.boards[ownerId].length >= MAX_BOARD_SIZE) {
    return null;
  }
  const summoned = createMinionInstance(context.state, definitionId, 0);
  if (golden) {
    makeGoldenToken(summoned);
  }
  if (taunt) {
    summoned.taunt = true;
  }
  return insertCombatMinion(
    context,
    ownerId,
    summoned,
    insertAt,
    source,
    `${source.name}召唤了${summoned.name}。`,
  );
}

function insertCombatMinion(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: BoardMinionInstance,
  insertAt: number,
  source: MinionInstance,
  message: string,
  summonReason?: BattleEvent["summonReason"],
): MinionInstance | null {
  const board = context.boards[ownerId];
  if (board.length >= MAX_BOARD_SIZE) {
    return null;
  }
  reconcileWhereverMinion(
    summoned,
    context.astralAutomatonsSummoned[ownerId],
    context.eternalKnightsDied[ownerId],
  );
  if (summonReason !== "rallyFromHand") {
    applyPersistentTribeBuff(context, ownerId, summoned);
  }
  applyCombatSummonHeroPower(context, ownerId, summoned);
  applyExistingAurasToSummoned(board, summoned);
  const boardIndex = Math.min(Math.max(0, insertAt), board.length);
  board.splice(boardIndex, 0, summoned);
  const auraEvents = applyNewAuraSource(board, summoned, ownerId);
  const afterSummonEvents = triggerAfterFriendlySummoned(
    context,
    ownerId,
    summoned,
  );
  for (const minion of board) {
    reconcileConditionalMinion(minion);
  }
  pushBattleEvent(context.events, {
    type: "summon",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: summoned.instanceId,
    boardIndex,
    minion: cloneMinion(summoned),
    summonReason,
    message,
  });
  for (const event of [...auraEvents, ...afterSummonEvents]) {
    pushBattleEvent(context.events, event);
  }
  observeCombatAutomatonSummon(context, ownerId, summoned);
  return summoned;
}

function summonPendingBeetles(
  context: CombatContext,
  ownerId: PlayerId,
): void {
  while (
    context.pendingBeetles[ownerId] > 0 &&
    context.boards[ownerId].length < MAX_BOARD_SIZE
  ) {
    const beetle = createMinionInstance(
      context.state,
      "live-beetle-token",
      0,
    );
    beetle.taunt = true;
    const summoned = insertCombatMinion(
      context,
      ownerId,
      beetle,
      context.boards[ownerId].length,
      beetle,
      "甲虫恩泽召唤了一只具有嘲讽的甲虫。",
      "beetle",
    );
    if (!summoned) {
      return;
    }
    context.pendingBeetles[ownerId] -= 1;
  }
}

function targetForEnemyDamage(
  context: CombatContext,
  enemyId: PlayerId,
  rule: "random" | "highestHealth",
): MinionInstance | null {
  const candidates = context.boards[enemyId].filter(
    (minion) => minion.health > 0,
  );
  if (candidates.length === 0) {
    return null;
  }
  if (rule === "random") {
    return candidates[randomIndex(context.state, candidates.length)];
  }
  const highestHealth = Math.max(...candidates.map((minion) => minion.health));
  const healthiest = candidates.filter(
    (minion) => minion.health === highestHealth,
  );
  return healthiest[randomIndex(context.state, healthiest.length)];
}

function triggerSelfDamaged(
  context: CombatContext,
  ownerId: PlayerId,
  target: MinionInstance,
): void {
  const board = context.boards[ownerId];
  const sourceIndex = Math.max(
    0,
    board.findIndex((minion) => minion.instanceId === target.instanceId),
  );
  for (const component of minionEffectSources(target)) {
    const effects =
      getMinionDefinition(component.definitionId).afterSelfDamaged;
    if (!effects) {
      continue;
    }
    for (const effect of effects) {
      if (effect.kind === "buffRandomHandMinion") {
        resolveCombatHandBuff(
          context,
          ownerId,
          target,
          component,
          effect,
        );
        continue;
      }
      if (effect.kind !== "summon") {
        continue;
      }
      const baseCount =
        effect.count === "sourceAttack" ? target.attack : effect.count;
      for (let count = 0; count < baseCount; count += 1) {
        summonCombatMinion(
          context,
          ownerId,
          effect.definitionId,
          sourceIndex + 1 + count,
          target,
          component.golden,
        );
      }
    }
  }
}

function resolveCombatHandBuff(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: BuffRandomHandMinionEffect,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const candidates = owner.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  if (candidates.length === 0) {
    return;
  }
  const target =
    candidates[randomIndex(context.state, candidates.length)];
  const scale = component.golden ? 2 : 1;
  const attackDelta = effect.attack * scale;
  const healthDelta = effect.health * scale;
  target.attack += attackDelta;
  target.health += healthDelta;
  reconcileConditionalMinion(target);
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const sourceLabel = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  pushBattleEvent(context.events, {
    type: "handBuff",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: owner.isHuman ? target.instanceId : undefined,
    attackDelta,
    healthDelta,
    cardName: owner.isHuman ? target.name : undefined,
    cardKind: "minion",
    message: owner.isHuman
      ? `${sourceLabel}使你手牌中的「${target.name}」获得+${attackDelta}/+${healthDelta}。`
      : `${sourceLabel}使${owner.name}手牌中的一张随从牌获得+${attackDelta}/+${healthDelta}。`,
  });
}

function dealCombatDamage(
  context: CombatContext,
  sourceOwnerId: PlayerId,
  source: MinionInstance,
  targetOwnerId: PlayerId,
  target: MinionInstance,
  amount: number,
  poisonous: boolean,
): void {
  if (amount <= 0 || target.health <= 0) {
    return;
  }
  if (reconcileConditionalMinion(target)) {
    const threshold =
      getMinionDefinition(target.definitionId).conditionalKeyword
        ?.attackAtLeast ?? target.attack;
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: targetOwnerId,
      actorInstanceId: target.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      message: `${target.name}达到${threshold}点攻击力，获得圣盾。`,
    });
  }
  if (target.divineShield) {
    target.divineShield = false;
    pushBattleEvent(context.events, {
      type: "shieldBroken",
      actorPlayerId: sourceOwnerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: target.instanceId,
      minion: cloneMinion(target),
      message: `${target.name}的圣盾被击破。`,
    });
    return;
  }
  target.health -= amount;
  if (poisonous || source.venomous) {
    target.health = Math.min(0, target.health);
  }
  if (source.venomous) {
    source.venomous = false;
  }
  const targetSnapshot = cloneMinion(target);
  targetSnapshot.health = Math.max(0, targetSnapshot.health);
  pushBattleEvent(context.events, {
    type: "damage",
    actorPlayerId: sourceOwnerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: targetOwnerId,
    targetInstanceId: target.instanceId,
    amount,
    minion: targetSnapshot,
    message: `${target.name}受到${amount}点伤害，剩余${targetSnapshot.health}点生命。`,
  });
  triggerSelfDamaged(context, targetOwnerId, target);
}

function chooseAttackTarget(
  context: CombatContext,
  attacker: MinionInstance,
  enemyId: PlayerId,
): MinionInstance | null {
  const enemyBoard = context.boards[enemyId].filter(
    (minion) => minion.health > 0,
  );
  if (enemyBoard.length === 0) {
    return null;
  }
  if (attacker.alwaysAttacksLowestAttack) {
    const lowestAttack = Math.min(
      ...enemyBoard.map((minion) => minion.attack),
    );
    const candidates = enemyBoard.filter(
      (minion) => minion.attack === lowestAttack,
    );
    return candidates[randomIndex(context.state, candidates.length)];
  }
  const taunts = enemyBoard.filter((minion) => minion.taunt);
  const candidates = taunts.length > 0 ? taunts : enemyBoard;
  return candidates[randomIndex(context.state, candidates.length)];
}

function resolveCombatGetRandomMinion(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GetRandomMinionEffect,
  triggerLabel?: string,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const componentName = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  const sourceLabel = triggerLabel
    ? `${componentName}的${triggerLabel}`
    : componentName;
  const gainCount =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount"
      ? 2
      : 1);

  for (let count = 0; count < gainCount; count += 1) {
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得磁力机械。`
          : `${sourceLabel}未能使${owner.name}获得磁力机械。`,
      });
      continue;
    }
    const gained = drawMatchingFromPool(
      context.state,
      owner.tavernTier,
      (definition) =>
        (effect.filter.tribe === undefined ||
          definitionHasTribe(definition, effect.filter.tribe)) &&
        (effect.filter.magnetic !== true ||
          definition.magnetic !== undefined) &&
        (effect.filter.exactTier === undefined ||
          definition.tier === effect.filter.exactTier),
    );
    if (!gained) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardGainResult: "noCandidate",
        message: owner.isHuman
          ? `当前共享池中没有可由${sourceLabel}获取的磁力机械。`
          : `${sourceLabel}没有找到可获取的磁力机械。`,
      });
      continue;
    }
    applyOwnedUndeadArmyBonus(owner, gained);
    reconcileWhereverMinion(
      gained,
      owner.astralAutomatonsSummoned ?? 0,
      owner.eternalKnightsDied ?? 0,
    );
    const gainedSnapshot = cloneMinion(gained);
    owner.hand.push(gained);
    resolveTriples(context.state, owner);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      minion: owner.isHuman ? gainedSnapshot : undefined,
      cardGainResult: "added",
      message: owner.isHuman
        ? `${sourceLabel}使你获得了「${gained.name}」。`
        : `${sourceLabel}使${owner.name}获得了一张磁力机械。`,
    });
  }
}

function resolveCombatGainTavernSpell(
  context: CombatContext,
  ownerId: PlayerId,
  source: MinionInstance,
  component: MinionEffectSource,
  effect: GainTavernSpellEffect,
): void {
  const owner = persistentCombatOwner(context, ownerId);
  if (!owner) {
    return;
  }
  const componentDefinition = getMinionDefinition(
    component.definitionId,
  );
  const sourceLabel = component.golden
    ? `金色·${componentDefinition.name}`
    : componentDefinition.name;
  const spellDefinition = getTavernSpellDefinition(
    effect.definitionId,
  );
  const gainCount =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);

  for (let count = 0; count < gainCount; count += 1) {
    if (owner.hand.length >= MAX_HAND_SIZE) {
      pushBattleEvent(context.events, {
        type: "cardGain",
        actorPlayerId: ownerId,
        actorInstanceId: source.instanceId,
        targetPlayerId: ownerId,
        amount: 0,
        cardName: owner.isHuman ? spellDefinition.name : undefined,
        cardKind: "tavernSpell",
        cardGainResult: "handFull",
        message: owner.isHuman
          ? `手牌已满，${sourceLabel}未能使你获得「${spellDefinition.name}」。`
          : `${sourceLabel}未能使${owner.name}获得一张酒馆法术。`,
      });
      continue;
    }
    const gained = createTavernSpell(context.state, spellDefinition);
    owner.hand.push(gained);
    pushBattleEvent(context.events, {
      type: "cardGain",
      actorPlayerId: ownerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: ownerId,
      targetInstanceId: owner.isHuman
        ? gained.instanceId
        : undefined,
      amount: 1,
      cardName: owner.isHuman ? gained.name : undefined,
      cardKind: "tavernSpell",
      cardGainResult: "added",
      message: owner.isHuman
        ? `${sourceLabel}使你获得了「${gained.name}」。`
        : `${sourceLabel}使${owner.name}获得了一张酒馆法术。`,
    });
  }
}

function selectHighestAttackHandMinions(
  state: GameState,
  owner: PlayerState,
  count: number,
): BoardMinionInstance[] {
  const candidates = owner.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  const selected: BoardMinionInstance[] = [];
  while (selected.length < count && candidates.length > 0) {
    const highestAttack = Math.max(
      ...candidates.map((candidate) => candidate.attack),
    );
    const highestCandidates = candidates.filter(
      (candidate) => candidate.attack === highestAttack,
    );
    const choice =
      highestCandidates.length === 1
        ? highestCandidates[0]
        : highestCandidates[randomIndex(state, highestCandidates.length)];
    selected.push(choice);
    candidates.splice(candidates.indexOf(choice), 1);
  }
  return selected;
}

function cloneOwnedMinionForCombat(
  state: GameState,
  minion: BoardMinionInstance,
): BoardMinionInstance {
  const combatCopy = cloneMinion(minion);
  combatCopy.instanceId = `minion-${state.nextInstanceId}`;
  combatCopy.poolCopies = 0;
  combatCopy.grantsTripleReward = false;
  combatCopy.attachments = combatCopy.attachments.map(
    clearAttachmentPoolCopies,
  );
  state.nextInstanceId += 1;
  return combatCopy;
}

function resolveRallySummonFromHand(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  component: MinionEffectSource,
  effect: RallySummonFromHandEffect,
): void {
  const owner = findPlayer(context.state, ownerId);
  const board = context.boards[ownerId];
  if (!owner || board.length >= MAX_BOARD_SIZE) {
    return;
  }
  const count =
    effect.count *
    (component.golden && effect.goldenMode === "doubleCount" ? 2 : 1);
  const selections = selectHighestAttackHandMinions(
    context.state,
    owner,
    Math.min(count, MAX_BOARD_SIZE - board.length),
  );
  const definition = getMinionDefinition(component.definitionId);
  for (const [selectionIndex, selected] of selections.entries()) {
    const attackerIndex = board.findIndex(
      (minion) => minion.instanceId === attacker.instanceId,
    );
    if (attackerIndex < 0 || board.length >= MAX_BOARD_SIZE) {
      break;
    }
    const summoned = cloneOwnedMinionForCombat(
      context.state,
      selected,
    );
    insertCombatMinion(
      context,
      ownerId,
      summoned,
      attackerIndex + 1 + selectionIndex,
      attacker,
      `${definition.name}的进击从手牌召唤了${summoned.name}（仅限本场战斗）。`,
      "rallyFromHand",
    );
  }
}

function removedKeywordLabel(
  keywords: readonly RallyRemovedKeyword[],
): string {
  return keywords
    .map((keyword) => (keyword === "reborn" ? "复生" : "嘲讽"))
    .join("和");
}

function resolveRallyKeywordRemoval(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  target: MinionInstance,
  component: MinionEffectSource,
  effect: RallyRemoveTargetKeywordsEffect,
): void {
  const removedKeywords: RallyRemovedKeyword[] = [];
  for (const keyword of effect.keywords) {
    if (keyword === "reborn" && target.reborn) {
      target.reborn = false;
      removedKeywords.push(keyword);
    } else if (keyword === "taunt" && target.taunt) {
      target.taunt = false;
      removedKeywords.push(keyword);
    }
  }
  if (removedKeywords.length === 0) {
    return;
  }
  const definition = getMinionDefinition(component.definitionId);
  pushBattleEvent(context.events, {
    type: "keywordRemoved",
    actorPlayerId: ownerId,
    actorInstanceId: attacker.instanceId,
    targetPlayerId: opponentId(context, ownerId),
    targetInstanceId: target.instanceId,
    removedKeywords,
    minion: cloneMinion(target),
    message: `${definition.name}的进击移除了${target.name}的${removedKeywordLabel(removedKeywords)}。`,
  });
}

function triggerRally(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
  attackTarget: MinionInstance,
): void {
  for (const component of minionEffectSources(attacker)) {
    const definition = getMinionDefinition(component.definitionId);
    const effects = definition.rally ?? [];
    for (const effect of effects) {
      if (effect.kind === "getRandomMinion") {
        resolveCombatGetRandomMinion(
          context,
          ownerId,
          attacker,
          component,
          effect,
          "进击",
        );
        continue;
      }

      if (effect.kind === "summonFromHand") {
        resolveRallySummonFromHand(
          context,
          ownerId,
          attacker,
          component,
          effect,
        );
        continue;
      }

      if (effect.kind === "removeTargetKeywords") {
        resolveRallyKeywordRemoval(
          context,
          ownerId,
          attacker,
          attackTarget,
          component,
          effect,
        );
        continue;
      }

      const board = context.boards[ownerId];
      const attackerIndex = board.findIndex(
        (minion) => minion.instanceId === attacker.instanceId,
      );
      const target =
        attackerIndex >= 0 ? board[attackerIndex + 1] : undefined;
      if (
        effect.target !== "rightFriendly" ||
        !target ||
        target.health <= 0
      ) {
        continue;
      }

      const scale =
        component.golden && effect.goldenMode === "doubleStats" ? 2 : 1;
      const attackDelta = effect.attack * scale;
      const healthDelta = effect.health * scale;
      target.attack = Math.max(0, target.attack + attackDelta);
      target.health = Math.max(1, target.health + healthDelta);
      reconcileConditionalMinion(target);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: target.instanceId,
        attackDelta,
        healthDelta,
        minion: cloneMinion(target),
        message: `${definition.name}的进击使右侧的${target.name}获得+${attackDelta}/+${healthDelta}。`,
      });
    }
  }
}

interface AttackStrikeOptions {
  immediate?: boolean;
  windfuryStrike?: boolean;
}

function performAttackStrike(
  context: CombatContext,
  ownerId: PlayerId,
  attackerInstanceId: string,
  options: AttackStrikeOptions = {},
): boolean {
  const attacker = context.boards[ownerId].find(
    (minion) => minion.instanceId === attackerInstanceId,
  );
  if (!attacker || attacker.health <= 0 || attacker.attack <= 0) {
    return false;
  }

  const enemyId = opponentId(context, ownerId);
  const enemyBoard = context.boards[enemyId];
  const target = chooseAttackTarget(context, attacker, enemyId);
  if (!target) {
    return false;
  }
  const targetIndex = enemyBoard.findIndex(
    (minion) => minion.instanceId === target.instanceId,
  );
  const cleaveTargets = attacker.cleave
    ? [enemyBoard[targetIndex - 1], enemyBoard[targetIndex + 1]].filter(
        (minion): minion is BoardMinionInstance =>
          minion !== undefined,
      )
    : [];

  pushBattleEvent(context.events, {
    type: "attack",
    actorPlayerId: ownerId,
    actorInstanceId: attacker.instanceId,
    targetPlayerId: enemyId,
    targetInstanceId: target.instanceId,
    amount: attacker.attack,
    message: `${attacker.name}${options.immediate ? "立即攻击" : "攻击"}${target.name}${options.windfuryStrike ? "（风怒）" : ""}。`,
  });
  triggerRally(context, ownerId, attacker, target);

  dealCombatDamage(
    context,
    ownerId,
    attacker,
    enemyId,
    target,
    attacker.attack,
    attacker.poisonous,
  );
  dealCombatDamage(
    context,
    enemyId,
    target,
    ownerId,
    attacker,
    target.attack,
    target.poisonous,
  );
  for (const adjacent of cleaveTargets) {
    dealCombatDamage(
      context,
      ownerId,
      attacker,
      enemyId,
      adjacent,
      attacker.attack,
      attacker.poisonous,
    );
  }
  resolveCombatDeaths(context);
  return true;
}

function performImmediateAttack(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
): void {
  performAttackStrike(context, ownerId, attacker.instanceId, {
    immediate: true,
  });
}

function triggerAfterFriendlyDied(
  context: CombatContext,
  ownerId: PlayerId,
  death: DeadMinion,
): void {
  const enemyId = opponentId(context, ownerId);
  for (const watcher of context.boards[ownerId]) {
    for (const component of minionEffectSources(watcher)) {
      const definition = getMinionDefinition(component.definitionId);
      const trigger = definition.afterFriendlyDied;
      const scale = component.golden ? 2 : 1;
      if (trigger && minionHasTribe(death.minion, trigger.tribe)) {
        const attackDelta = (trigger.attack ?? 0) * scale;
        const healthDelta = (trigger.health ?? 0) * scale;
        watcher.attack += attackDelta;
        watcher.health += healthDelta;
        reconcileConditionalMinion(watcher);
        if (attackDelta !== 0 || healthDelta !== 0) {
          pushBattleEvent(context.events, {
            type: "buff",
            actorPlayerId: ownerId,
            actorInstanceId: watcher.instanceId,
            targetPlayerId: ownerId,
            targetInstanceId: watcher.instanceId,
            attackDelta,
            healthDelta,
            minion: cloneMinion(watcher),
            message: `${watcher.name}因友方随从死亡获得+${
              attackDelta
            }/+${healthDelta}。`,
          });
        }
        if (trigger.damageEnemy) {
          for (let hit = 0; hit < scale; hit += 1) {
            const target = targetForEnemyDamage(
              context,
              enemyId,
              trigger.damageTarget ?? "random",
            );
            if (!target) {
              break;
            }
            dealCombatDamage(
              context,
              ownerId,
              watcher,
              enemyId,
              target,
              trigger.damageEnemy,
              false,
            );
          }
        }
      }

      const combatDeathTrigger =
        definition.afterFriendlyCombatDied;
      if (!combatDeathTrigger) {
        continue;
      }
      const attackDelta = combatDeathTrigger.attack * scale;
      const healthDelta = combatDeathTrigger.health * scale;
      watcher.attack += attackDelta;
      watcher.health += healthDelta;
      reconcileConditionalMinion(watcher);
      pushBattleEvent(context.events, {
        type: "buff",
        actorPlayerId: ownerId,
        actorInstanceId: watcher.instanceId,
        targetPlayerId: ownerId,
        targetInstanceId: watcher.instanceId,
        attackDelta,
        healthDelta,
        minion: cloneMinion(watcher),
        message: `${watcher.name}因友方随从死亡获得+${
          attackDelta
        }攻击力${
          healthDelta > 0 ? `和+${healthDelta}生命值` : ""
        }。`,
      });
    }
  }
}

function resolveOneDeathrattle(
  context: CombatContext,
  death: DeadMinion,
): void {
  const source = death.minion;
  const ownerId = death.ownerId;
  const enemyId = opponentId(context, ownerId);
  const board = context.boards[ownerId];
  const repetitions = 1 + extraDeathrattles(board);
  for (const component of minionEffectSources(source)) {
    const effects =
      getMinionDefinition(component.definitionId).deathrattle ?? [];
    const scale = component.golden ? 2 : 1;
    for (let repetition = 0; repetition < repetitions; repetition += 1) {
      for (const effect of effects) {
        if (effect.kind === "summon") {
          const baseCount =
            effect.count === "sourceAttack" ? source.attack : effect.count;
          const doublesCount =
            component.golden && effect.goldenMode === "doubleCount";
          const summonCount = baseCount * (doublesCount ? 2 : 1);
          for (
            let count = 0;
            count < summonCount && board.length < MAX_BOARD_SIZE;
            count += 1
          ) {
            const summoned = summonCombatMinion(
              context,
              ownerId,
              effect.definitionId,
              death.index + count,
              source,
              component.golden && !doublesCount,
              effect.taunt === true,
            );
            if (summoned && effect.immediateAttack) {
              performImmediateAttack(context, ownerId, summoned);
            }
          }
        } else if (effect.kind === "buff") {
          if (
            effect.target === "friendlyTribe" &&
            effect.tribe
          ) {
            const current =
              context.tribeBuffs[ownerId][effect.tribe] ?? {
                attack: 0,
                health: 0,
              };
            context.tribeBuffs[ownerId][effect.tribe] = {
              attack: current.attack + effect.attack * scale,
              health: current.health + effect.health * scale,
            };
          }
          for (const target of combatBuffTargets(
            context.state,
            board,
            source,
            effect,
          )) {
            applyBuff(target, effect, scale);
            pushBattleEvent(context.events, {
              type: "buff",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              attackDelta: effect.attack * scale,
              healthDelta: effect.health * scale,
              minion: cloneMinion(target),
              message: `${source.name}的亡语使${target.name}获得+${
                effect.attack * scale
              }/+${effect.health * scale}。`,
            });
          }
        } else if (effect.kind === "grantShield") {
          const candidates = [...board];
          for (
            let count = 0;
            count < scale && candidates.length > 0;
            count += 1
          ) {
            const targetIndex = randomIndex(context.state, candidates.length);
            const target = candidates[targetIndex];
            target.divineShield = true;
            candidates.splice(targetIndex, 1);
            pushBattleEvent(context.events, {
              type: "buff",
              actorPlayerId: ownerId,
              actorInstanceId: source.instanceId,
              targetPlayerId: ownerId,
              targetInstanceId: target.instanceId,
              minion: cloneMinion(target),
              message: `${source.name}的亡语使${target.name}获得圣盾。`,
            });
          }
        } else if (effect.kind === "damageEnemy") {
          const target = targetForEnemyDamage(context, enemyId, effect.target);
          if (target) {
            for (let hit = 0; hit < scale; hit += 1) {
              const nextTarget = targetForEnemyDamage(
                context,
                enemyId,
                effect.target,
              );
              if (!nextTarget) {
                break;
              }
              dealCombatDamage(
                context,
                ownerId,
                source,
                enemyId,
                nextTarget,
                effect.amount,
                false,
              );
            }
          }
        } else if (effect.kind === "damageAllMinions") {
          const repeats =
            component.golden && effect.goldenMode === "repeat" ? 2 : 1;
          const amount =
            component.golden && effect.goldenMode !== "repeat"
              ? effect.amount * 2
              : effect.amount;
          for (let hit = 0; hit < repeats; hit += 1) {
            for (const targetOwnerId of context.playerIds) {
              for (const target of [...context.boards[targetOwnerId]]) {
                if (
                  targetOwnerId === ownerId &&
                  effect.excludeFriendlyTribe &&
                  minionHasTribe(target, effect.excludeFriendlyTribe)
                ) {
                  continue;
                }
                dealCombatDamage(
                  context,
                  ownerId,
                  source,
                  targetOwnerId,
                  target,
                  amount,
                  false,
                );
              }
            }
          }
        } else if (effect.kind === "resummonMechs") {
          const history = context.deadMechs[ownerId];
          for (
            let index = 0;
            index < effect.count * scale &&
            index < history.length &&
            board.length < MAX_BOARD_SIZE;
            index += 1
          ) {
            summonCombatMinion(
              context,
              ownerId,
              history[index].definitionId,
              death.index + index,
              source,
              history[index].golden,
            );
          }
        } else if (effect.kind === "summonRandomDeathrattle") {
          const candidates = MINION_DEFINITIONS.filter(
            (candidate) =>
              definitionIsAvailable(
                candidate,
                context.state.activeTribes,
              ) &&
              candidate.deathrattle !== undefined &&
              candidate.id !== component.definitionId,
          );
          for (
            let count = 0;
            count < effect.count * scale &&
            candidates.length > 0 &&
            board.length < MAX_BOARD_SIZE;
            count += 1
          ) {
            const choice =
              candidates[randomIndex(context.state, candidates.length)];
            summonCombatMinion(
              context,
              ownerId,
              choice.id,
              death.index + count,
              source,
            );
          }
        } else if (effect.kind === "getRandomMinion") {
          resolveCombatGetRandomMinion(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        } else if (effect.kind === "gainTavernSpell") {
          resolveCombatGainTavernSpell(
            context,
            ownerId,
            source,
            component,
            effect,
          );
        }
      }
    }
  }
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (
      let count = 0;
      count < source.temporaryCrabDeathrattles &&
      board.length < MAX_BOARD_SIZE;
      count += 1
    ) {
      summonCombatMinion(
        context,
        ownerId,
        "live-crab-token",
        death.index + count,
        source,
        false,
        false,
      );
    }
    for (
      let count = 0;
      count < (source.temporaryGoldenCrabDeathrattles ?? 0) &&
      board.length < MAX_BOARD_SIZE;
      count += 1
    ) {
      summonCombatMinion(
        context,
        ownerId,
        "live-crab-token",
        death.index +
          source.temporaryCrabDeathrattles +
          count,
        source,
        true,
        false,
      );
    }
  }
}

function resolveCombatDeaths(context: CombatContext): void {
  for (let wave = 0; wave < 50; wave += 1) {
    const deaths = context.playerIds.flatMap((ownerId) =>
      removeDead(context.boards[ownerId], ownerId),
    );
    if (deaths.length === 0) {
      return;
    }

    for (const death of deaths) {
      if (minionHasTribe(death.minion, "mech")) {
        context.deadMechs[death.ownerId].push(cloneMinion(death.minion));
      }
      const deathSnapshot = cloneMinion(death.minion);
      deathSnapshot.health = 0;
      pushBattleEvent(context.events, {
        type: "death",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        minion: deathSnapshot,
        message: `${death.minion.name}被消灭。`,
      });
    }
    for (const death of deaths) {
      removeCombatAuraSource(context, death);
    }
    for (const death of deaths) {
      observeCombatFriendlyDeath(context, death);
    }
    for (const death of deaths) {
      triggerAfterFriendlyDied(context, death.ownerId, death);
    }
    for (const death of deaths) {
      resolveOneDeathrattle(context, death);
    }
    for (const death of deaths) {
      if (
        !death.minion.reborn ||
        context.boards[death.ownerId].length >= MAX_BOARD_SIZE
      ) {
        continue;
      }
      const reborn = createMinionInstance(
        context.state,
        death.minion.definitionId,
        0,
      );
      if (death.minion.golden) {
        makeGoldenToken(reborn);
      }
      reborn.health = 1;
      reborn.reborn = false;
      insertCombatMinion(
        context,
        death.ownerId,
        reborn,
        death.index,
        death.minion,
        `${death.minion.name}复生了。`,
        "reborn",
      );
    }
    for (const ownerId of context.playerIds) {
      summonPendingBeetles(context, ownerId);
    }
  }
}

function buildPairings(state: GameState): Pairing[] {
  const alive = state.players.filter((player) => player.alive);
  shuffleInPlace(state, alive);
  const pairings: Pairing[] = [];
  const ghost =
    alive.length % 2 === 1
      ? state.players
          .filter((player) => !player.alive && player.eliminatedRound !== undefined)
          .sort((left, right) => {
            const roundDifference =
              (right.eliminatedRound ?? -1) - (left.eliminatedRound ?? -1);
            return roundDifference !== 0
              ? roundDifference
              : left.id.localeCompare(right.id);
          })[0]
      : undefined;

  const pairedAlive = ghost ? alive.slice(0, -1) : alive;
  for (let index = 0; index < pairedAlive.length; index += 2) {
    pairings.push({
      playerA: pairedAlive[index],
      playerB: pairedAlive[index + 1],
      isGhost: false,
    });
  }
  if (ghost) {
    pairings.push({
      playerA: alive[alive.length - 1],
      playerB: ghost,
      isGhost: true,
    });
  }
  return pairings;
}

function resultForPlayer(
  winnerId: PlayerId | null,
  playerId: PlayerId,
): BattleResult {
  if (winnerId === null) {
    return "tie";
  }
  return winnerId === playerId ? "win" : "loss";
}

function settleNextCombatGold(
  player: PlayerState,
  result: BattleResult,
  events: BattleEvent[],
): void {
  const amount =
    result === "win"
      ? player.nextCombatWinGold
      : result === "tie"
        ? player.nextCombatTieGold
        : 0;
  player.nextCombatWinGold = 0;
  player.nextCombatTieGold = 0;
  if (amount <= 0) {
    return;
  }
  player.pendingNextTurnGold += amount;
  pushBattleEvent(events, {
    type: "goldReward",
    actorPlayerId: player.id,
    amount,
    message: `${player.name}的“自负”将在下回合提供 ${amount} 枚铸币。`,
  });
}

function applyQueuedStartOfCombatSpells(
  context: CombatContext,
  owner: PlayerState,
  enemy: PlayerState,
  isGhostOwner: boolean,
): void {
  if (isGhostOwner) {
    return;
  }
  const ownBoard = context.boards[owner.id];
  for (const buff of owner.nextCombatDoubleLeftmostAttack) {
    const target = ownBoard[0];
    if (!target) {
      continue;
    }
    const attackDelta = target.attack + buff.attack;
    const healthDelta = buff.health;
    target.attack += attackDelta;
    target.health += healthDelta;
    reconcileConditionalMinion(target);
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: owner.id,
      targetPlayerId: owner.id,
      targetInstanceId: target.instanceId,
      attackDelta,
      healthDelta,
      minion: cloneMinion(target),
      message: `诺兹多姆的子嗣使${target.name}的攻击力翻倍。`,
    });
  }
  owner.nextCombatDoubleLeftmostAttack = [];

  const enemyBoard = context.boards[enemy.id];
  for (
    let count = 0;
    count < owner.nextCombatSetEnemyHealthToOne &&
    enemyBoard.length > 0;
    count += 1
  ) {
    const target = enemyBoard[randomIndex(context.state, enemyBoard.length)];
    const healthDelta = 1 - target.health;
    target.health = 1;
    pushBattleEvent(context.events, {
      type: "buff",
      actorPlayerId: owner.id,
      targetPlayerId: enemy.id,
      targetInstanceId: target.instanceId,
      attackDelta: 0,
      healthDelta,
      minion: cloneMinion(target),
      message: `优势压制将${target.name}的生命值变为1。`,
    });
  }
  owner.nextCombatSetEnemyHealthToOne = 0;
}

function resolveInHandStartOfCombatMinions(
  context: CombatContext,
  player: PlayerState,
  isGhost: boolean,
): void {
  if (isGhost) {
    return;
  }
  const board = context.boards[player.id];
  for (const card of player.hand) {
    if (card.kind !== "minion" || board.length >= MAX_BOARD_SIZE) {
      continue;
    }
    const effect =
      getMinionDefinition(card.definitionId).inHandStartOfCombat;
    if (effect?.kind !== "summonSelfCopy") {
      continue;
    }
    const summoned = cloneOwnedMinionForCombat(context.state, card);
    if (card.golden && effect.goldenMode === "doubleStats") {
      summoned.attack *= 2;
      summoned.health *= 2;
    }
    insertCombatMinion(
      context,
      player.id,
      summoned,
      board.length,
      card,
      `${card.name}从手牌召唤了一个仅限本场战斗的复制。`,
      "inHandStartOfCombat",
    );
  }
}

function simulateBattle(
  state: GameState,
  pairing: Pairing,
): BattleSummary {
  const { playerA, playerB, isGhost } = pairing;
  const boardA = cloneBoard(playerA.board);
  const boardB = cloneBoard(playerB.board);
  const events: BattleEvent[] = [];
  const astralAutomatonsSummoned = {
    [playerA.id]: playerA.astralAutomatonsSummoned,
    [playerB.id]: playerB.astralAutomatonsSummoned,
  };
  const eternalKnightsDied = {
    [playerA.id]: playerA.eternalKnightsDied,
    [playerB.id]: playerB.eternalKnightsDied,
  };
  for (const minion of boardA) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned[playerA.id],
      eternalKnightsDied[playerA.id],
    );
  }
  for (const minion of boardB) {
    reconcileWhereverMinion(
      minion,
      astralAutomatonsSummoned[playerB.id],
      eternalKnightsDied[playerB.id],
    );
  }
  buffMinions(
    boardA,
    playerA.nextCombatAttackBonus,
    playerA.nextCombatHealthBonus,
  );
  buffMinions(
    boardB,
    playerB.nextCombatAttackBonus,
    playerB.nextCombatHealthBonus,
  );
  playerA.nextCombatAttackBonus = 0;
  playerA.nextCombatHealthBonus = 0;
  playerB.nextCombatAttackBonus = 0;
  playerB.nextCombatHealthBonus = 0;
  applyStartOfCombatEffects(state, boardA);
  applyStartOfCombatEffects(state, boardB);
  applyCombatAuras(boardA);
  applyCombatAuras(boardB);
  const initialBoards: Record<PlayerId, MinionInstance[]> = {
    [playerA.id]: cloneBoard(boardA),
    [playerB.id]: cloneBoard(boardB),
  };
  const context: CombatContext = {
    state,
    events,
    playerIds: [playerA.id, playerB.id],
    ...(isGhost ? { ghostOwnerId: playerB.id } : {}),
    boards: {
      [playerA.id]: boardA,
      [playerB.id]: boardB,
    },
    deadMechs: {
      [playerA.id]: [],
      [playerB.id]: [],
    },
    tribeBuffs: {
      [playerA.id]: {
        undead: {
          attack: playerA.undeadArmyAttackBonus,
          health: playerA.undeadArmyHealthBonus,
        },
      },
      [playerB.id]: {
        undead: {
          attack: playerB.undeadArmyAttackBonus,
          health: playerB.undeadArmyHealthBonus,
        },
      },
    },
    pendingBeetles: {
      [playerA.id]: playerA.nextCombatBeetles,
      [playerB.id]: isGhost ? 0 : playerB.nextCombatBeetles,
    },
    astralAutomatonsSummoned,
    eternalKnightsDied,
  };
  const healthABefore = playerA.health;
  const healthBBefore = playerB.health;
  const armorABefore = playerA.armor;
  const armorBBefore = playerB.armor;
  pushBattleEvent(events, {
    type: "battleStart",
    actorPlayerId: playerA.id,
    targetPlayerId: playerB.id,
    message: `${playerA.name}对阵${isGhost ? "幽灵·" : ""}${playerB.name}。`,
  });
  resolveInHandStartOfCombatMinions(context, playerA, false);
  resolveInHandStartOfCombatMinions(context, playerB, isGhost);
  applyQueuedStartOfCombatSpells(
    context,
    playerA,
    playerB,
    false,
  );
  applyQueuedStartOfCombatSpells(
    context,
    playerB,
    playerA,
    isGhost,
  );
  summonPendingBeetles(context, playerA.id);
  summonPendingBeetles(context, playerB.id);

  let attackingPlayerId: PlayerId;
  if (boardA.length > boardB.length) {
    attackingPlayerId = playerA.id;
  } else if (boardB.length > boardA.length) {
    attackingPlayerId = playerB.id;
  } else {
    attackingPlayerId =
      randomIndex(state, 2) === 0 ? playerA.id : playerB.id;
  }

  const cursors: Record<PlayerId, number> = {
    [playerA.id]: 0,
    [playerB.id]: 0,
  };
  let attackCount = 0;
  let consecutiveSkips = 0;

  while (
    boardA.length > 0 &&
    boardB.length > 0 &&
    attackCount < MAX_COMBAT_ATTACKS
  ) {
    const attackingA = attackingPlayerId === playerA.id;
    const ownBoard = attackingA ? boardA : boardB;
    const attackerOwner = attackingA ? playerA : playerB;
    const defenderOwner = attackingA ? playerB : playerA;
    const attackIndex = availableAttackIndex(
      ownBoard,
      cursors[attackerOwner.id] ?? 0,
    );
    if (attackIndex < 0) {
      consecutiveSkips += 1;
      if (consecutiveSkips >= 2) {
        break;
      }
      attackingPlayerId = defenderOwner.id;
      continue;
    }
    consecutiveSkips = 0;

    const attacker = ownBoard[attackIndex];
    const attackerInstanceId = attacker.instanceId;
    const strikes = attacker.windfury ? 2 : 1;
    for (
      let strike = 0;
      strike < strikes &&
      boardA.length > 0 &&
      boardB.length > 0 &&
      attackCount < MAX_COMBAT_ATTACKS;
      strike += 1
    ) {
      const attacked = performAttackStrike(
        context,
        attackerOwner.id,
        attackerInstanceId,
        { windfuryStrike: strike > 0 },
      );
      if (!attacked) {
        break;
      }
      attackCount += 1;
    }

    const survivingAttackerIndex = ownBoard.findIndex(
      (minion) => minion.instanceId === attackerInstanceId,
    );
    cursors[attackerOwner.id] =
      ownBoard.length === 0
        ? 0
        : survivingAttackerIndex >= 0
          ? (survivingAttackerIndex + 1) % ownBoard.length
          : Math.min(attackIndex, ownBoard.length - 1);
    attackingPlayerId = defenderOwner.id;
  }

  playerA.nextCombatBeetles =
    context.pendingBeetles[playerA.id];
  if (!isGhost) {
    playerB.nextCombatBeetles =
      context.pendingBeetles[playerB.id];
  }

  let winnerId: PlayerId | null = null;
  if (boardA.length > 0 && boardB.length === 0) {
    winnerId = playerA.id;
  } else if (boardB.length > 0 && boardA.length === 0) {
    winnerId = playerB.id;
  }

  let damageToPlayerA = 0;
  let damageToPlayerB = 0;
  if (winnerId === playerA.id) {
    damageToPlayerB =
      playerA.tavernTier +
      boardA.reduce((total, minion) => total + minion.tier, 0);
    if (!isGhost) {
      const damage = damagePlayer(playerB, damageToPlayerB);
      pushBattleEvent(events, {
        type: "heroDamage",
        actorPlayerId: playerA.id,
        targetPlayerId: playerB.id,
        amount: damageToPlayerB,
        armorAbsorbed: damage.armorAbsorbed,
        healthDamage: damage.healthDamage,
        message:
          damage.armorAbsorbed > 0
            ? `${playerB.name}受到 ${damageToPlayerB} 点伤害，护甲抵挡 ${damage.armorAbsorbed} 点。`
            : `${playerB.name}受到 ${damageToPlayerB} 点伤害。`,
      });
    } else {
      damageToPlayerB = 0;
    }
  } else if (winnerId === playerB.id) {
    damageToPlayerA =
      playerB.tavernTier +
      boardB.reduce((total, minion) => total + minion.tier, 0);
    const damage = damagePlayer(playerA, damageToPlayerA);
    pushBattleEvent(events, {
      type: "heroDamage",
      actorPlayerId: playerB.id,
      targetPlayerId: playerA.id,
      amount: damageToPlayerA,
      armorAbsorbed: damage.armorAbsorbed,
      healthDamage: damage.healthDamage,
      message:
        damage.armorAbsorbed > 0
          ? `${playerA.name}受到 ${damageToPlayerA} 点伤害，护甲抵挡 ${damage.armorAbsorbed} 点。`
          : `${playerA.name}受到 ${damageToPlayerA} 点伤害。`,
    });
  }

  if (playerA.alive) {
    settleNextCombatGold(
      playerA,
      resultForPlayer(winnerId, playerA.id),
      events,
    );
  }
  if (!isGhost && playerB.alive) {
    settleNextCombatGold(
      playerB,
      resultForPlayer(winnerId, playerB.id),
      events,
    );
  }

  const resultText =
    winnerId === null
      ? "战斗以平局结束。"
      : `${winnerId === playerA.id ? playerA.name : playerB.name}获胜。`;
  pushBattleEvent(events, {
    type: "battleEnd",
    actorPlayerId: winnerId ?? undefined,
    message: resultText,
  });

  const humanInBattle =
    playerA.id === state.humanPlayerId || playerB.id === state.humanPlayerId;
  return {
    round: state.round,
    playerAId: playerA.id,
    playerBId: playerB.id,
    playerAName: playerA.name,
    playerBName: playerB.name,
    isGhost,
    winnerId,
    resultForHuman: humanInBattle
      ? resultForPlayer(winnerId, state.humanPlayerId)
      : undefined,
    damageToPlayerA,
    damageToPlayerB,
    playerAHealthBefore: healthABefore,
    playerBHealthBefore: healthBBefore,
    playerAHealthAfter: playerA.health,
    playerBHealthAfter: playerB.health,
    playerAArmorBefore: armorABefore,
    playerBArmorBefore: armorBBefore,
    playerAArmorAfter: playerA.armor,
    playerBArmorAfter: playerB.armor,
    initialBoards,
    finalBoards: {
      [playerA.id]: cloneBoard(boardA),
      [playerB.id]: cloneBoard(boardB),
    },
    events,
  };
}

function releaseEliminatedPlayer(
  state: GameState,
  player: PlayerState,
): void {
  const ownedMinions = player.hand.filter(
    (card): card is BoardMinionInstance => card.kind === "minion",
  );
  for (const minion of [...player.board, ...ownedMinions, ...player.shop]) {
    returnMinionToPool(state, minion);
  }
  for (const spell of tavernSpellShopOffers(player)) {
    state.spellPool[spell.definitionId] =
      (state.spellPool[spell.definitionId] ?? 0) + 1;
  }
  for (const minion of player.board) {
    clearTemporarySpellcraftBuffs(minion);
  }
  player.board = player.board.map((minion) => ({
    ...minion,
    poolCopies: 0,
    attachments: minion.attachments.map(clearAttachmentPoolCopies),
  }));
  player.hand = [];
  player.pendingSpellcraft = [];
  player.shop = [];
  player.spellShop = null;
  player.additionalSpellShop = [];
  player.spellOnlyRefreshActive = false;
  player.helpfulRefreshes = 0;
  player.lastHelpfulRefreshKind = null;
  player.frozen = false;
}

function settleEliminations(state: GameState): void {
  const newlyEliminated = state.players.filter(
    (player) => player.alive && player.health <= 0,
  );
  for (const player of newlyEliminated) {
    player.alive = false;
    player.eliminatedRound = state.round;
    releaseEliminatedPlayer(state, player);
  }

  const alivePlayers = state.players.filter((player) => player.alive);
  const sharedPlacement = alivePlayers.length + 1;
  for (const player of newlyEliminated) {
    player.placement = sharedPlacement;
  }
  if (alivePlayers.length === 1) {
    alivePlayers[0].placement = 1;
    state.winnerId = alivePlayers[0].id;
  } else if (alivePlayers.length === 0) {
    state.winnerId = null;
  }
}

function endTurn(state: GameState): void {
  const previousRoundBattles = state.lastRoundBattles;
  const human = humanPlayer(state);
  if (human.alive) {
    applyEndOfTurnEffects(state, human);
    reconcileConditionalMinions(human);
    human.hand = human.hand.filter(
      (card) => card.kind !== "spellcraft",
    );
    human.pendingSpellcraft = [];
  }
  const aiPlayers = state.players.filter(
    (player) => player.alive && !player.isHuman,
  );
  shuffleInPlace(state, aiPlayers);
  for (const player of aiPlayers) {
    runAiRecruit(state, player);
    applyEndOfTurnEffects(state, player);
    reconcileConditionalMinions(player);
    player.hand = player.hand.filter(
      (card) => card.kind !== "spellcraft",
    );
    player.pendingSpellcraft = [];
  }

  const pairings = buildPairings(state);
  const battles: BattleSummary[] = [];
  for (const pairing of pairings) {
    const playerAObservation = previouslyObservedOpponent(
      previousRoundBattles,
      pairing.playerA,
      pairing.playerB,
    );
    const playerBObservation = pairing.isGhost
      ? undefined
      : previouslyObservedOpponent(
          previousRoundBattles,
          pairing.playerB,
          pairing.playerA,
        );
    if (!pairing.playerA.isHuman) {
      arrangeAiBoard(pairing.playerA, playerAObservation);
    }
    if (!pairing.isGhost && !pairing.playerB.isHuman) {
      arrangeAiBoard(pairing.playerB, playerBObservation);
    }
    pairing.playerA.lastOpponentId = pairing.playerB.id;
    if (!pairing.isGhost) {
      pairing.playerB.lastOpponentId = pairing.playerA.id;
    }
    battles.push(simulateBattle(state, pairing));
  }
  state.lastRoundBattles = battles;
  state.lastBattle =
    battles.find(
      (battle) =>
        battle.playerAId === state.humanPlayerId ||
        battle.playerBId === state.humanPlayerId,
    ) ?? null;
  settleEliminations(state);
  state.phase = "combat";
}

function beginNextRecruit(state: GameState): void {
  const alivePlayers = state.players.filter((player) => player.alive);
  const human = humanPlayer(state);
  if (!human.alive || alivePlayers.length <= 1) {
    state.phase = "gameOver";
    return;
  }

  state.round += 1;
  state.phase = "recruit";
  state.lastBattle = null;
  for (const player of state.players) {
    for (const minion of player.board) {
      clearTemporarySpellcraftBuffs(minion);
    }
    for (const card of player.hand) {
      if (card.kind !== "minion") {
        continue;
      }
      clearTemporarySpellcraftBuffs(card);
      if (
        card.destroyAfterPlayThroughRound !== undefined &&
        card.destroyAfterPlayThroughRound < state.round
      ) {
        delete card.destroyAfterPlayThroughRound;
      }
    }
  }
  for (const player of alivePlayers) {
    player.gold =
      Math.min(player.maxGold, state.round + 2) +
      player.pendingNextTurnGold;
    player.pendingNextTurnGold = 0;
    player.tavernSpellsCastThisTurn = 0;
    player.elementalsPlayedThisTurn = 0;
    if (playerHasHeroPower(player, "freeRefreshAtTurnStart")) {
      player.freeRefreshes += 1;
    }
    if (
      player.nextTurnBoardAttackBonus > 0 ||
      player.nextTurnBoardHealthBonus > 0
    ) {
      const pulses = Math.max(1, player.nextTurnBoardBuffPulses);
      const attackPerPulse =
        player.nextTurnBoardAttackBonus / pulses;
      const healthPerPulse =
        player.nextTurnBoardHealthBonus / pulses;
      for (let pulse = 0; pulse < pulses; pulse += 1) {
        buffMinions(
          player.board,
          attackPerPulse,
          healthPerPulse,
        );
      }
      player.nextTurnBoardAttackBonus = 0;
      player.nextTurnBoardHealthBonus = 0;
      player.nextTurnBoardBuffPulses = 0;
    }
    if (player.tavernTier < 6) {
      player.upgradeDiscount += 1;
    }
    applyStartOfTurnEffects(state, player);
    if (player.frozen) {
      player.frozen = false;
      player.spellOnlyRefreshActive = false;
      fillShop(state, player);
    } else {
      releaseShop(state, player);
      fillShop(state, player);
    }
    reconcileConditionalMinions(player);
  }
}

export function createGame(seed?: number): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const players: PlayerState[] = PLAYER_NAMES.map((name, index) => ({
    id: `player-${index}`,
    name,
    isHuman: index === 0,
    health: 40,
    armor: 0,
    alive: true,
    heroPowerId: null,
    tavernTier: 1,
    gold: 3,
    board: [],
    hand: [],
    pendingSpellcraft: [],
    shop: [],
    spellShop: null,
    additionalSpellShop: [],
    spellOnlyRefreshActive: false,
    frozen: false,
    upgradeDiscount: 0,
    nextTavernSpellDiscount: 0,
    tavernSpellsCastThisTurn: 0,
    maxGold: 10,
    pendingNextTurnGold: 0,
    freeRefreshes: 0,
    helpfulRefreshes: 0,
    lastHelpfulRefreshKind: null,
    tavernMinionAttackBonus: 0,
    tavernMinionHealthBonus: 0,
    nextCombatAttackBonus: 0,
    nextCombatHealthBonus: 0,
    nextCombatSetEnemyHealthToOne: 0,
    nextCombatDoubleLeftmostAttack: [],
    nextCombatWinGold: 0,
    nextCombatTieGold: 0,
    nextTurnBoardAttackBonus: 0,
    nextTurnBoardHealthBonus: 0,
    nextTurnBoardBuffPulses: 0,
    tavernBloodGemBarrageAttack: 0,
    tavernBloodGemBarrageHealth: 0,
    backToBackBonus: 0,
    tavernSpellAttackBonus: 0,
    tavernSpellHealthBonus: 0,
    tavernTypeBuffs: [],
    rideTheWindBuffs: [],
    elementalsPlayedThisTurn: 0,
    nextCombatBeetles: 0,
    ballerAttackBonus: 1,
    ballerHealthBonus: 1,
    deepBlueBonus: 0,
    undeadArmyAttackBonus: 0,
    undeadArmyHealthBonus: 0,
    astralAutomatonsSummoned: 0,
    eternalKnightsDied: 0,
    bloodGemAttack: 1,
    bloodGemHealth: 1,
  }));
  const pool: Record<string, number> = {};
  const spellPool: Record<string, number> = {};
  const state: GameState = {
    version: 11,
    contentVersion: CURRENT_ROSTER_VERSION,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextInstanceId: 1,
    nextInteractionId: 1,
    phase: "recruit",
    round: 1,
    humanPlayerId: HUMAN_PLAYER_ID,
    activeTribes: [],
    players,
    pool,
    spellPool,
    pendingInteraction: null,
    lastBattle: null,
    lastRoundBattles: [],
    winnerId: null,
  };
  const shuffledTribes = [...LOBBY_TRIBES];
  shuffleInPlace(state, shuffledTribes);
  const chosenTribes = new Set(shuffledTribes.slice(0, 5));
  state.activeTribes = LOBBY_TRIBES.filter((tribe) =>
    chosenTribes.has(tribe),
  );
  for (const definition of MINION_DEFINITIONS) {
    pool[definition.id] = definitionIsAvailable(
      definition,
      state.activeTribes,
    )
      ? POOL_COPIES_BY_TIER[definition.tier]
      : 0;
  }
  for (const definition of TAVERN_SPELL_DEFINITIONS) {
    spellPool[definition.id] =
      tavernSpellIsAvailable(definition, state.activeTribes)
        ? SPELL_POOL_COPIES_BY_TIER[definition.tier]
        : 0;
  }
  for (const player of state.players) {
    fillShop(state, player);
  }
  return state;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESOLVE_INTERACTION") {
    const resolved = resolvePendingInteraction(state, action);
    if (resolved !== state && resolved.phase === "recruit") {
      flushPendingSpellcraft(resolved, humanPlayer(resolved));
    }
    if (
      resolved !== state &&
      resolved.pendingInteraction === null &&
      resolved.phase === "recruit"
    ) {
      const player = humanPlayer(resolved);
      resolvePendingStirDeaths(resolved, player);
    }
    return resolved;
  }
  if (state.pendingInteraction !== null) {
    return state;
  }
  const next = cloneState(state);
  if (action.type === "CONTINUE") {
    if (next.phase === "combat") {
      beginNextRecruit(next);
    }
    return next;
  }
  if (next.phase !== "recruit") {
    return state;
  }

  const player = humanPlayer(next);
  if (!player.alive) {
    return state;
  }
  switch (action.type) {
    case "BUY_MINION":
      buyMinion(next, player, action.shopIndex);
      break;
    case "BUY_TAVERN_SPELL":
      buyTavernSpell(next, player, action.spellInstanceId);
      break;
    case "SELL_MINION":
      sellMinion(next, player, action.boardIndex);
      break;
    case "PLAY_MINION":
      playMinion(next, player, action.handIndex, action.boardIndex);
      break;
    case "PLAY_HAND_CARD":
      playHandCard(
        next,
        player,
        action.cardInstanceId,
        action.boardIndex,
      );
      break;
    case "MAGNETIZE_MINION":
      magnetizeMinion(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_BLOOD_GEM":
      castBloodGem(
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_TAVERN_SPELL":
      castTavernSpell(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "CAST_SPELLCRAFT":
      castSpellcraft(
        next,
        player,
        action.cardInstanceId,
        action.targetInstanceId,
      );
      break;
    case "REFRESH_SHOP":
      refreshShop(next, player);
      break;
    case "TOGGLE_FREEZE":
      player.frozen = !player.frozen;
      break;
    case "UPGRADE_TAVERN":
      upgradeTavern(next, player);
      break;
    case "MOVE_MINION": {
      if (
        action.fromIndex >= 0 &&
        action.fromIndex < player.board.length &&
        action.toIndex >= 0 &&
        action.toIndex < player.board.length
      ) {
        const [minion] = player.board.splice(action.fromIndex, 1);
        player.board.splice(action.toIndex, 0, minion);
      }
      break;
    }
    case "END_TURN":
      endTurn(next);
      break;
  }
  if (next.phase === "recruit") {
    flushPendingSpellcraft(next, player);
    reconcileConditionalMinions(player);
  }
  return next;
}
