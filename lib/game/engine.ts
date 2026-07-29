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
  tavernSpellNeedsTarget,
} from "./tavern-spells.ts";
import type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemSpellInstance,
  BoardMinionInstance,
  BuffEffect,
  DiscoverDestination,
  DiscoverFilter,
  GameAction,
  GameState,
  GetRandomMinionEffect,
  MagneticAttachment,
  MinionEffect,
  MinionInstance,
  PendingDiscoverInteraction,
  PlayerId,
  PlayerState,
  RallyRemoveTargetKeywordsEffect,
  RallyRemovedKeyword,
  RallySummonFromHandEffect,
  TavernSpellDefinition,
  TavernSpellInstance,
  TavernTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  BloodGemSpellInstance,
  BoardMinionInstance,
  GameAction,
  GamePhase,
  GameState,
  HandCardInstance,
  MagneticAttachment,
  MinionDefinition,
  MinionEffect,
  MinionInstance,
  PendingInteraction,
  PlayerId,
  PlayerState,
  SpellFamily,
  TavernSpellDefinition,
  TavernSpellEffect,
  TavernSpellInstance,
  TavernSpellTarget,
  TavernTier,
  Tribe,
  TripleRewardSpellInstance,
} from "./types.ts";

export {
  TAVERN_SPELL_DEFINITIONS,
  getTavernSpellDefinition,
  tavernSpellCanTargetShop,
  tavernSpellNeedsTarget,
} from "./tavern-spells.ts";

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
const TIER_UP_ROUND = [0, 0, 2, 4, 6, 9, 11] as const;
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

function minionHasTribe(
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
    grantsTripleReward: false,
    poolCopies,
    attachments: [],
  };
  state.nextInstanceId += 1;
  return instance;
}

function describeGoldenMinion(description: string): string {
  return `金色随从：基础属性已翻倍；可倍增的效果会按金色规则结算。普通版本牌面：${description}`;
}

function makeGoldenToken(
  minion: BoardMinionInstance,
): BoardMinionInstance {
  if (minion.golden) {
    return minion;
  }
  const definition = getMinionDefinition(minion.definitionId);
  minion.golden = true;
  minion.name = `金色·${minion.name}`;
  minion.attack *= 2;
  minion.health *= 2;
  minion.sellValue =
    definition.goldenSellValue ?? minion.sellValue;
  minion.description = describeGoldenMinion(minion.description);
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

function createBloodGemSpell(state: GameState): BloodGemSpellInstance {
  const instance: BloodGemSpellInstance = {
    kind: "bloodGem",
    instanceId: `card-${state.nextInstanceId}`,
    definitionId: BLOOD_GEM_DEFINITION_ID,
    cardId: BLOOD_GEM_CARD_ID,
    name: "鲜血宝石",
    description: "使一个友方随从获得+1/+1。",
    spellFamily: "bloodGem",
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
): TavernSpellInstance | null {
  const eligible = TAVERN_SPELL_DEFINITIONS.filter(
    (definition) =>
      definition.tier <= tavernTier &&
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
): number {
  let added = 0;
  for (
    let index = 0;
    index < count && player.hand.length < MAX_HAND_SIZE;
    index += 1
  ) {
    player.hand.push(createBloodGemSpell(state));
    added += 1;
  }
  return added;
}

function applyBloodGem(
  player: PlayerState,
  target: BoardMinionInstance,
): void {
  target.attack += player.bloodGemAttack;
  target.health += player.bloodGemHealth;
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
    attackGranted: source.attack - nestedStats.attack,
    healthGranted: source.health - nestedStats.health,
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

function releaseShop(state: GameState, player: PlayerState): void {
  for (const minion of player.shop) {
    returnMinionToPool(state, minion);
  }
  player.shop = [];
  if (player.spellShop) {
    state.spellPool[player.spellShop.definitionId] =
      (state.spellPool[player.spellShop.definitionId] ?? 0) + 1;
  }
  player.spellShop = null;
}

function fillShop(state: GameState, player: PlayerState): void {
  const targetSize = SHOP_SIZE_BY_TIER[player.tavernTier];
  while (player.shop.length < targetSize) {
    const minion = drawFromPool(state, player.tavernTier);
    if (!minion) {
      break;
    }
    minion.attack += player.tavernMinionAttackBonus;
    minion.health += player.tavernMinionHealthBonus;
    player.shop.push(minion);
  }
  if (player.spellShop === null) {
    player.spellShop = drawTavernSpell(state, player.tavernTier);
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
  return Math.max(0, baseCost - player.upgradeDiscount);
}

export function getRefreshCost(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = findPlayer(state, playerId);
  return player?.freeRefreshes ? 0 : REFRESH_COST;
}

function applyBuff(target: MinionInstance, effect: BuffEffect, scale: number): void {
  target.attack = Math.max(0, target.attack + effect.attack * scale);
  target.health = Math.max(1, target.health + effect.health * scale);
  if (effect.taunt) {
    target.taunt = true;
  }
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
          candidates.splice(targetIndex, 1);
        }
      }
    } else if (effect.kind === "gainGold") {
      player.gold += effect.amount * scale;
    } else if (effect.kind === "damageHero") {
      player.health -= effect.amount;
    } else if (effect.kind === "gainMissingHealth") {
      source.health +=
        Math.max(0, 40 - player.health) * effect.multiplier * scale;
    } else if (effect.kind === "gainBloodGems") {
      addBloodGems(state, player, effect.count * scale);
    } else if (effect.kind === "improveBloodGems") {
      player.bloodGemAttack += effect.attack * scale;
      player.bloodGemHealth += effect.health * scale;
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
      player.health -= (trigger.heroDamage ?? 0) * scale;
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

function applyEndOfTurnEffects(player: PlayerState): void {
  for (const source of [...player.board]) {
    for (const component of minionEffectSources(source)) {
      const effect =
        getMinionDefinition(component.definitionId).endOfTurn;
      if (!effect) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
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
      const extraAttack = consumed.reduce(
        (total, minion) => total + (minion.attack - definition.attack),
        0,
      );
      const extraHealth = consumed.reduce(
        (total, minion) => total + (minion.health - definition.health),
        0,
      );
      const golden = createMinionInstance(
        state,
        definitionId,
        consumed.reduce((total, minion) => total + minion.poolCopies, 0),
      );
      golden.golden = true;
      golden.grantsTripleReward = true;
      golden.name = `金色·${definition.name}`;
      golden.attack = definition.attack * 2 + extraAttack;
      golden.health = definition.health * 2 + extraHealth;
      golden.taunt =
        definition.taunt === true || consumed.some((minion) => minion.taunt);
      golden.divineShield =
        definition.divineShield === true ||
        consumed.some((minion) => minion.divineShield);
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
      golden.description = describeGoldenMinion(definition.description);
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
  player.hand.push(minion);
  resolveTriples(state, player);
  return true;
}

function buyTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  const spell = player.spellShop;
  if (
    !spell ||
    player.gold < spell.cost ||
    player.hand.length >= MAX_HAND_SIZE
  ) {
    return false;
  }
  player.gold -= spell.cost;
  state.spellPool[spell.definitionId] =
    (state.spellPool[spell.definitionId] ?? 0) + 1;
  player.hand.push(spell);
  player.spellShop = null;
  return true;
}

function sellMinion(
  state: GameState,
  player: PlayerState,
  boardIndex: number,
): boolean {
  if (boardIndex < 0 || boardIndex >= player.board.length) {
    return false;
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
  return true;
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
    card?.kind !== "minion"
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
  const battlecry = getMinionDefinition(minion.definitionId).battlecry;
  const triggerCount = battlecry ? battlecryTriggerCount(player) : 0;
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, minion, battlecry);
  }
  applyRecruitSummonTriggers(player, minion);
  applyAfterFriendlyPlayed(state, player, minion);
  resolveTriples(state, player);
  beginInteractiveBattlecry(state, player, minion);
  return true;
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
    !canMagnetize(card, target)
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
  target.taunt ||= source.taunt;
  target.divineShield ||= source.divineShield;
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
  }
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
  player.hand.push(minion);
  resolveTriples(state, player);
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

function applyTavernSpellEffect(
  state: GameState,
  player: PlayerState,
  spell: TavernSpellInstance,
  definition: TavernSpellDefinition,
  target: BoardMinionInstance | undefined,
): void {
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
        target.health += 3;
        target.taunt = true;
      }
      break;
    case "pointyArrow":
      if (target) {
        target.attack += 4;
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
        target.attack += 2;
        target.health += 2;
      }
      break;
    case "themApples":
      buffMinions(player.shop, 1, 2);
      break;
    case "freeRefreshes":
      player.freeRefreshes += 2;
      break;
    case "mightOfStormwind":
      buffMinions(randomBoardSubset(state, player.board, 4), 1, 2);
      break;
    case "increaseMaxGold":
      player.maxGold += 1;
      break;
    case "carefulInvestment":
      player.pendingNextTurnGold += 2;
      break;
    case "fleetingVigor":
      player.nextCombatAttackBonus += 2;
      player.nextCombatHealthBonus += 1;
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
      buffMinions(randomBoardSubset(state, player.board, 4), 0, 4);
      break;
    case "hostileBounty":
      buffMinions(randomBoardSubset(state, player.board, 4), 4, 0);
      break;
    case "selfishBounty":
      if (player.board[0]) {
        buffMinions([player.board[0]], 6, 6);
      }
      break;
    case "shinyRing":
      buffMinions(player.board, 1, 1);
      break;
    case "staffOfEnrichment":
      player.tavernMinionAttackBonus += 2;
      player.tavernMinionHealthBonus += 2;
      buffMinions(player.shop, 2, 2);
      break;
    case "trickyTrousers":
      if (target) {
        target.attack += 1;
        target.health += 2;
        target.taunt = !target.taunt;
      }
      break;
    case "gainTwoGold":
      player.gold += 2;
      break;
    case "backToBack":
      if (target) {
        const amount = 4 + player.backToBackBonus;
        buffMinions([target], amount, amount);
        player.backToBackBonus += 4;
      }
      break;
    case "deepwaterClan":
      if (target) {
        buffMinions([target], 2, 2);
        buffMinions(
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
        buffMinions([target], 6, 6);
        target.taunt = true;
      }
      break;
    case "misplacedTeaSet": {
      const selectedIds = new Set<string>();
      const selected: BoardMinionInstance[] = [];
      for (const tribe of LOBBY_TRIBES) {
        const candidates = player.board.filter(
          (minion) =>
            !selectedIds.has(minion.instanceId) &&
            minionHasTribe(minion, tribe),
        );
        if (candidates.length === 0) {
          continue;
        }
        const chosen = candidates[randomIndex(state, candidates.length)];
        selectedIds.add(chosen.instanceId);
        selected.push(chosen);
      }
      buffMinions(selected, 2, 2);
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
        buffMinions(matches, 3, 3);
      }
      break;
    case "shiftingTide":
      if (target) {
        const repetitions = minionHasTribe(target, "naga") ? 4 : 2;
        buffMinions([target], repetitions, repetitions);
      }
      break;
    case "queensCommand":
      buffMinions(player.board, 2, 2);
      buffMinions(
        player.board.filter((minion) => minionHasTribe(minion, "naga")),
        2,
        2,
      );
      break;
    case "sanctify":
      buffMinions(
        player.board.filter((minion) => minion.divineShield),
        6,
        0,
      );
      break;
    case "waveOfGold":
      buffMinions(player.board, 3, 2);
      buffMinions(
        player.board.filter((minion) => minion.golden),
        3,
        2,
      );
      break;
    case "azeriteEmpowerment":
      buffMinions(player.board, 4, 4);
      break;
    case "perfectVision":
      if (target) {
        target.attack = 20;
        target.health = 20;
      }
      break;
  }
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
  const target = targetInstanceId
    ? (player.board.find(
        (minion) => minion.instanceId === targetInstanceId,
      ) ??
      (tavernSpellCanTargetShop(definition)
        ? player.shop.find(
            (minion) => minion.instanceId === targetInstanceId,
          )
        : undefined))
    : undefined;
  if (
    (tavernSpellNeedsTarget(definition) && !target) ||
    (!tavernSpellNeedsTarget(definition) && targetInstanceId !== undefined)
  ) {
    return false;
  }
  player.hand.splice(handIndex, 1);
  applyTavernSpellEffect(state, player, card, definition, target);
  player.tavernSpellsCastThisTurn += 1;
  applyAfterTavernSpellCastTriggers(player);
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

function minionScore(
  player: PlayerState,
  minion: BoardMinionInstance,
): number {
  let score = minion.attack + minion.health;
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
  if (definitions.some((definition) => definition.deathrattle)) {
    score += 2.5;
  }
  if (definitions.some((definition) => definition.battlecry)) {
    score += 1.5;
  }
  const synergyTribe = minion.tribes.find(
    (tribe) => tribe !== "all" && tribe !== "neutral",
  );
  if (synergyTribe) {
    score += tribeCount(player, synergyTribe) * 0.8;
  }
  const copies = ownedNormalCount(player, minion.definitionId);
  if (copies === 1) {
    score += 3;
  } else if (copies >= 2) {
    score += 10;
  }
  return score;
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
): void {
  if (
    discoveries <= 0 ||
    (destination.kind === "hand" &&
      player.hand.length >= MAX_HAND_SIZE) ||
    state.pendingInteraction !== null
  ) {
    return;
  }
  const options = reserveDiscoverOptions(state, filter);
  if (options.length === 0) {
    return;
  }
  if (!player.isHuman) {
    const selected = bestMinionByScore(player, options);
    returnDiscoverOptions(state, options, selected.instanceId);
    if (destination.kind === "hand") {
      player.hand.push(selected);
      resolveTriples(state, player);
    } else {
      const target = player.board.find(
        (minion) =>
          minion.instanceId === destination.targetInstanceId,
      );
      if (!target) {
        returnMinionToPool(state, selected);
        return;
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
    return;
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
  const target = bestMinionByScore(player, player.board);
  return castBloodGem(player, gem.instanceId, target.instanceId);
}

function playBestAiTavernSpell(
  state: GameState,
  player: PlayerState,
): boolean {
  const spells = player.hand.filter(
    (card): card is TavernSpellInstance => card.kind === "tavernSpell",
  );
  for (const spell of spells) {
    const definition = getTavernSpellDefinition(spell.definitionId);
    if (tavernSpellNeedsTarget(definition)) {
      const targets = tavernSpellCanTargetShop(definition)
        ? [...player.board, ...player.shop]
        : player.board;
      if (targets.length === 0) {
        continue;
      }
      const target = bestMinionByScore(player, targets);
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

function playAiHand(state: GameState, player: PlayerState): void {
  while (player.hand.length > 0) {
    const reward = player.hand.find(
      (card): card is TripleRewardSpellInstance =>
        card.kind === "tripleReward",
    );
    if (reward) {
      playHandCard(state, player, reward.instanceId);
      continue;
    }
    const minions = player.hand.filter(
      (card): card is BoardMinionInstance => card.kind === "minion",
    );
    if (minions.length === 0) {
      if (playBestAiTavernSpell(state, player)) {
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
        if (playBestAiTavernSpell(state, player)) {
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

function tavernSpellAiScore(
  player: PlayerState,
  spell: TavernSpellInstance,
): number {
  const effect = getTavernSpellDefinition(spell.definitionId).effect;
  const boardSize = player.board.length;
  const targetCount =
    boardSize + (tavernSpellCanTargetShop(spell) ? player.shop.length : 0);
  switch (effect) {
    case "discoverTierOne":
    case "recruitTrainee":
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
    case "deepwaterClan":
    case "naturalBlessing":
      return targetCount > 0 ? 12 : 0;
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
      return mostCommonBoardTribe(player) ? 6 : 0;
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

function arrangeAiBoard(player: PlayerState): void {
  player.board.sort((left, right) => {
    const leftDeathrattle =
      minionEffectSources(left).some(
        (component) =>
          getMinionDefinition(component.definitionId).deathrattle !==
          undefined,
      )
        ? 1
        : 0;
    const rightDeathrattle =
      minionEffectSources(right).some(
        (component) =>
          getMinionDefinition(component.definitionId).deathrattle !==
          undefined,
      )
        ? 1
        : 0;
    if (leftDeathrattle !== rightDeathrattle) {
      return rightDeathrattle - leftDeathrattle;
    }
    if (left.taunt !== right.taunt) {
      return left.taunt ? 1 : -1;
    }
    if (left.attack !== right.attack) {
      return right.attack - left.attack;
    }
    return left.instanceId.localeCompare(right.instanceId);
  });
}

function runAiRecruit(state: GameState, player: PlayerState): void {
  let actions = 0;
  playAiHand(state, player);

  const nextTier = player.tavernTier + 1;
  const shouldUpgrade =
    player.tavernTier < 6 &&
    state.round >= TIER_UP_ROUND[nextTier] &&
    (player.health >= 16 || player.board.length >= Math.min(5, state.round));
  if (shouldUpgrade && upgradeTavern(state, player)) {
    actions += 1;
  }

  let refreshes = 0;
  while (actions < 50) {
    playAiHand(state, player);
    const spellOffer = player.spellShop;
    if (
      spellOffer &&
      player.hand.length < MAX_HAND_SIZE &&
      player.gold >= spellOffer.cost &&
      tavernSpellAiScore(player, spellOffer) >=
        Math.max(1.5, spellOffer.cost * 1.7) &&
      buyTavernSpell(state, player)
    ) {
      actions += 1;
      continue;
    }
    const shopIndex = bestShopIndex(player);
    if (shopIndex >= 0 && player.gold >= BUY_COST) {
      if (player.board.length < MAX_BOARD_SIZE) {
        if (buyMinion(state, player, shopIndex)) {
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
        if (candidateScore >= weakestScore + 2.5) {
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
    if (
      player.gold >= BUY_COST + refreshCost &&
      refreshes < 3
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
  player.frozen =
    bestRemaining !== undefined &&
    player.gold < BUY_COST &&
    (ownedNormalCount(player, bestRemaining.definitionId) >= 2 ||
      minionScore(player, bestRemaining) >=
        7 + player.tavernTier * 2);
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
  boards: Record<PlayerId, MinionInstance[]>;
  deadMechs: Record<PlayerId, MinionInstance[]>;
  tribeBuffs: Record<PlayerId, Partial<Record<Tribe, CombatStatBuff>>>;
}

function opponentId(context: CombatContext, ownerId: PlayerId): PlayerId {
  return context.playerIds[0] === ownerId
    ? context.playerIds[1]
    : context.playerIds[0];
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
}

function applyNewAuraSource(
  board: readonly MinionInstance[],
  source: MinionInstance,
): void {
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
      target.attack -= aura.attack * scale;
      target.health -= aura.health * scale;
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

function triggerAfterFriendlySummoned(
  context: CombatContext,
  ownerId: PlayerId,
  summoned: MinionInstance,
): void {
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
        watcher.attack += (trigger.attack ?? 0) * scale;
        watcher.health += (trigger.health ?? 0) * scale;
        watcher.divineShield = true;
      } else {
        summoned.attack += (trigger.attack ?? 0) * scale;
        summoned.health += (trigger.health ?? 0) * scale;
      }
    }
  }
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
  applyPersistentTribeBuff(context, ownerId, summoned);
  applyExistingAurasToSummoned(board, summoned);
  const boardIndex = Math.min(Math.max(0, insertAt), board.length);
  board.splice(boardIndex, 0, summoned);
  applyNewAuraSource(board, summoned);
  triggerAfterFriendlySummoned(context, ownerId, summoned);
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
  return summoned;
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
  if (target.divineShield) {
    target.divineShield = false;
    pushBattleEvent(context.events, {
      type: "shieldBroken",
      actorPlayerId: sourceOwnerId,
      actorInstanceId: source.instanceId,
      targetPlayerId: targetOwnerId,
      targetInstanceId: target.instanceId,
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
  const owner = findPlayer(context.state, ownerId);
  if (!owner?.alive) {
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
          definition.magnetic !== undefined),
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
      const trigger = getMinionDefinition(
        component.definitionId,
      ).afterFriendlyDied;
      if (!trigger || !minionHasTribe(death.minion, trigger.tribe)) {
        continue;
      }
      const scale = component.golden ? 2 : 1;
      watcher.attack += (trigger.attack ?? 0) * scale;
      watcher.health += (trigger.health ?? 0) * scale;
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
        }
      }
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
      removeCombatAuraSource(context, death);
      pushBattleEvent(context.events, {
        type: "death",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        message: `${death.minion.name}被消灭。`,
      });
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
      applyPersistentTribeBuff(context, death.ownerId, reborn);
      const board = context.boards[death.ownerId];
      const boardIndex = Math.min(death.index, board.length);
      board.splice(boardIndex, 0, reborn);
      triggerAfterFriendlySummoned(context, death.ownerId, reborn);
      pushBattleEvent(context.events, {
        type: "summon",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        targetPlayerId: death.ownerId,
        targetInstanceId: reborn.instanceId,
        boardIndex,
        minion: cloneMinion(reborn),
        summonReason: "reborn",
        message: `${death.minion.name}复生了。`,
      });
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

function simulateBattle(
  state: GameState,
  pairing: Pairing,
): BattleSummary {
  const { playerA, playerB, isGhost } = pairing;
  const boardA = cloneBoard(playerA.board);
  const boardB = cloneBoard(playerB.board);
  const events: BattleEvent[] = [];
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
    boards: {
      [playerA.id]: boardA,
      [playerB.id]: boardB,
    },
    deadMechs: {
      [playerA.id]: [],
      [playerB.id]: [],
    },
    tribeBuffs: {
      [playerA.id]: {},
      [playerB.id]: {},
    },
  };
  const healthABefore = playerA.health;
  const healthBBefore = playerB.health;
  pushBattleEvent(events, {
    type: "battleStart",
    actorPlayerId: playerA.id,
    targetPlayerId: playerB.id,
    message: `${playerA.name}对阵${isGhost ? "幽灵·" : ""}${playerB.name}。`,
  });

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
      playerB.health -= damageToPlayerB;
      pushBattleEvent(events, {
        type: "heroDamage",
        actorPlayerId: playerA.id,
        targetPlayerId: playerB.id,
        amount: damageToPlayerB,
        message: `${playerB.name}受到 ${damageToPlayerB} 点伤害。`,
      });
    } else {
      damageToPlayerB = 0;
    }
  } else if (winnerId === playerB.id) {
    damageToPlayerA =
      playerB.tavernTier +
      boardB.reduce((total, minion) => total + minion.tier, 0);
    playerA.health -= damageToPlayerA;
    pushBattleEvent(events, {
      type: "heroDamage",
      actorPlayerId: playerB.id,
      targetPlayerId: playerA.id,
      amount: damageToPlayerA,
      message: `${playerA.name}受到 ${damageToPlayerA} 点伤害。`,
    });
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
  if (player.spellShop) {
    state.spellPool[player.spellShop.definitionId] =
      (state.spellPool[player.spellShop.definitionId] ?? 0) + 1;
  }
  player.board = player.board.map((minion) => ({
    ...minion,
    poolCopies: 0,
    attachments: minion.attachments.map(clearAttachmentPoolCopies),
  }));
  player.hand = [];
  player.shop = [];
  player.spellShop = null;
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
  const human = humanPlayer(state);
  if (human.alive) {
    applyEndOfTurnEffects(human);
  }
  const aiPlayers = state.players.filter(
    (player) => player.alive && !player.isHuman,
  );
  shuffleInPlace(state, aiPlayers);
  for (const player of aiPlayers) {
    runAiRecruit(state, player);
    applyEndOfTurnEffects(player);
  }

  const pairings = buildPairings(state);
  const battles: BattleSummary[] = [];
  for (const pairing of pairings) {
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
  state.lastRoundBattles = [];
  for (const player of alivePlayers) {
    player.gold =
      Math.min(player.maxGold, state.round + 2) +
      player.pendingNextTurnGold;
    player.pendingNextTurnGold = 0;
    player.tavernSpellsCastThisTurn = 0;
    if (player.tavernTier < 6) {
      player.upgradeDiscount += 1;
    }
    applyStartOfTurnEffects(state, player);
    if (player.frozen) {
      player.frozen = false;
      fillShop(state, player);
    } else {
      releaseShop(state, player);
      fillShop(state, player);
    }
  }
}

export function createGame(seed?: number): GameState {
  const normalizedSeed = normalizeSeed(seed);
  const players: PlayerState[] = PLAYER_NAMES.map((name, index) => ({
    id: `player-${index}`,
    name,
    isHuman: index === 0,
    health: 40,
    alive: true,
    tavernTier: 1,
    gold: 3,
    board: [],
    hand: [],
    shop: [],
    spellShop: null,
    frozen: false,
    upgradeDiscount: 0,
    tavernSpellsCastThisTurn: 0,
    maxGold: 10,
    pendingNextTurnGold: 0,
    freeRefreshes: 0,
    tavernMinionAttackBonus: 0,
    tavernMinionHealthBonus: 0,
    nextCombatAttackBonus: 0,
    nextCombatHealthBonus: 0,
    backToBackBonus: 0,
    bloodGemAttack: 1,
    bloodGemHealth: 1,
  }));
  const pool: Record<string, number> = {};
  const spellPool: Record<string, number> = {};
  const state: GameState = {
    version: 7,
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
      SPELL_POOL_COPIES_BY_TIER[definition.tier];
  }
  for (const player of state.players) {
    fillShop(state, player);
  }
  return state;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "RESOLVE_INTERACTION") {
    return resolvePendingInteraction(state, action);
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
      buyTavernSpell(next, player);
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
  return next;
}
