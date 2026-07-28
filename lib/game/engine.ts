// Explicit `.ts` specifiers keep the pure engine directly runnable by Node
// 24's built-in type stripping as well as by the app's Vite bundler.
import {
  CURRENT_ROSTER_VERSION,
  MINION_DEFINITIONS,
  getMinionDefinition,
} from "./content.ts";
import type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  BuffEffect,
  GameAction,
  GameState,
  MinionEffect,
  MinionInstance,
  PlayerId,
  PlayerState,
  Tribe,
} from "./types.ts";

export type {
  BattleEvent,
  BattleResult,
  BattleSummary,
  GameAction,
  GamePhase,
  GameState,
  MinionDefinition,
  MinionEffect,
  MinionInstance,
  PlayerId,
  PlayerState,
  Tribe,
} from "./types.ts";

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

// Tavern spells occupy the extra card slot documented in Patch 34.2. This
// minion-only game keeps the real minion-offer counts from beneath that slot.
// Patch 23.6 reduced Tier 1 to 15 copies, matching Tier 2; the remaining copy
// counts retain the 13/11/9/7 distribution.
const SHOP_SIZE_BY_TIER = [0, 3, 4, 4, 5, 5, 6] as const;
const UPGRADE_BASE_COST = [0, 5, 7, 8, 11, 12, 0] as const;
const POOL_COPIES_BY_TIER = [0, 15, 15, 13, 11, 9, 7] as const;
const TIER_UP_ROUND = [0, 0, 2, 4, 6, 9, 11] as const;
const DEFAULT_SEED = 0x4853544e;
const MAX_BOARD_SIZE = 7;
const MAX_HAND_SIZE = 10;
const BUY_COST = 3;
const REFRESH_COST = 1;
const MAX_COMBAT_ATTACKS = 100;
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

type MutableTier = 1 | 2 | 3 | 4 | 5 | 6;

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

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function cloneMinion(minion: MinionInstance): MinionInstance {
  return { ...minion };
}

function cloneBoard(board: readonly MinionInstance[]): MinionInstance[] {
  return board.map(cloneMinion);
}

function minionHasTribe(
  minion: Pick<MinionInstance, "tribe" | "tribes">,
  tribe: Tribe | undefined,
): boolean {
  if (!tribe || tribe === "neutral") {
    return minion.tribe === "neutral";
  }
  return minion.tribes.includes("all") || minion.tribes.includes(tribe);
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
): MinionInstance {
  const definition = getMinionDefinition(definitionId);
  const instance: MinionInstance = {
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
    poolCopies,
  };
  state.nextInstanceId += 1;
  return instance;
}

function describeGoldenMinion(description: string): string {
  return `金色随从：基础属性已翻倍；可倍增的效果会按金色规则结算。普通版本牌面：${description}`;
}

function makeGoldenToken(minion: MinionInstance): MinionInstance {
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

function returnMinionToPool(state: GameState, minion: MinionInstance): void {
  if (minion.poolCopies <= 0) {
    return;
  }
  state.pool[minion.definitionId] =
    (state.pool[minion.definitionId] ?? 0) + minion.poolCopies;
}

function drawFromPool(
  state: GameState,
  tavernTier: MutableTier,
): MinionInstance | null {
  const eligible = MINION_DEFINITIONS.filter(
    (definition) =>
      definitionIsAvailable(definition, state.activeTribes) &&
      definition.tier <= tavernTier &&
      (state.pool[definition.id] ?? 0) > 0,
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

function releaseShop(state: GameState, player: PlayerState): void {
  for (const minion of player.shop) {
    returnMinionToPool(state, minion);
  }
  player.shop = [];
}

function fillShop(state: GameState, player: PlayerState): void {
  const targetSize = SHOP_SIZE_BY_TIER[player.tavernTier];
  while (player.shop.length < targetSize) {
    const minion = drawFromPool(state, player.tavernTier);
    if (!minion) {
      break;
    }
    player.shop.push(minion);
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
): void {
  if (!effects) {
    return;
  }
  const scale = source.golden ? 2 : 1;
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
    } else if (effect.kind === "summon") {
      const baseCount =
        effect.count === "sourceAttack" ? source.attack : effect.count;
      const doublesCount =
        source.golden && effect.goldenMode === "doubleCount";
      const summonCount = baseCount * (doublesCount ? 2 : 1);
      for (
        let count = 0;
        count < summonCount && player.board.length < MAX_BOARD_SIZE;
        count += 1
      ) {
        const summoned = createMinionInstance(state, effect.definitionId, 0);
        if (source.golden && !doublesCount) {
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
    const trigger = getMinionDefinition(
      watcher.definitionId,
    ).afterFriendlySummoned;
    if (
      !trigger ||
      trigger.grantShield ||
      !minionHasTribe(summoned, trigger.tribe) ||
      watcher.instanceId === summoned.instanceId
    ) {
      continue;
    }
    const scale = watcher.golden ? 2 : 1;
    summoned.attack += (trigger.attack ?? 0) * scale;
    summoned.health += (trigger.health ?? 0) * scale;
  }
}

function applyAfterFriendlyPlayed(
  player: PlayerState,
  played: MinionInstance,
): void {
  for (const watcher of player.board) {
    if (watcher.instanceId === played.instanceId) {
      continue;
    }
    const trigger = getMinionDefinition(
      watcher.definitionId,
    ).afterFriendlyPlayed;
    if (!trigger || !minionHasTribe(played, trigger.tribe)) {
      continue;
    }
    const scale = watcher.golden ? 2 : 1;
    watcher.attack += (trigger.attack ?? 0) * scale;
    watcher.health += (trigger.health ?? 0) * scale;
    player.health -= (trigger.heroDamage ?? 0) * scale;
  }
}

function battlecryTriggerCount(player: PlayerState): number {
  return (
    1 +
    player.board.reduce((largestExtra, minion) => {
      const extra =
        getMinionDefinition(minion.definitionId).extraBattlecries ?? 0;
      return Math.max(
        largestExtra,
        extra * (minion.golden ? 2 : 1),
      );
    }, 0)
  );
}

function applyEndOfTurnEffects(player: PlayerState): void {
  for (const source of [...player.board]) {
    const effect = getMinionDefinition(source.definitionId).endOfTurn;
    if (!effect) {
      continue;
    }
    const scale = source.golden ? 2 : 1;
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

function resolveTriples(state: GameState, player: PlayerState): void {
  let combined = true;
  while (combined) {
    combined = false;
    const definitionIds = [
      ...player.board.map((minion) => minion.definitionId),
      ...player.hand.map((minion) => minion.definitionId),
    ];
    for (const definitionId of definitionIds) {
      const boardMatches = player.board.filter(
        (minion) =>
          minion.definitionId === definitionId && minion.golden === false,
      );
      const handMatches = player.hand.filter(
        (minion) =>
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
      golden.name = `金色·${definition.name}`;
      golden.attack = definition.attack * 2 + extraAttack;
      golden.health = definition.health * 2 + extraHealth;
      golden.taunt =
        definition.taunt === true || consumed.some((minion) => minion.taunt);
      golden.divineShield =
        definition.divineShield === true ||
        consumed.some((minion) => minion.divineShield);
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
  return true;
}

function playMinion(
  state: GameState,
  player: PlayerState,
  handIndex: number,
  boardIndex?: number,
): boolean {
  if (
    player.board.length >= MAX_BOARD_SIZE ||
    handIndex < 0 ||
    handIndex >= player.hand.length
  ) {
    return false;
  }
  const [minion] = player.hand.splice(handIndex, 1);
  const insertAt =
    boardIndex === undefined
      ? player.board.length
      : Math.max(0, Math.min(boardIndex, player.board.length));
  player.board.splice(insertAt, 0, minion);
  const battlecry = getMinionDefinition(minion.definitionId).battlecry;
  const triggerCount = battlecry ? battlecryTriggerCount(player) : 0;
  for (let count = 0; count < triggerCount; count += 1) {
    applyRecruitEffects(state, player, minion, battlecry);
  }
  applyRecruitSummonTriggers(player, minion);
  applyAfterFriendlyPlayed(player, minion);
  resolveTriples(state, player);
  return true;
}

function refreshShop(state: GameState, player: PlayerState): boolean {
  if (player.gold < REFRESH_COST) {
    return false;
  }
  player.gold -= REFRESH_COST;
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
      minion.definitionId === definitionId && minion.golden === false,
  ).length;
}

function tribeCount(player: PlayerState, tribe: Tribe): number {
  return player.board.filter((minion) => minionHasTribe(minion, tribe)).length;
}

function minionScore(player: PlayerState, minion: MinionInstance): number {
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
  const definition = getMinionDefinition(minion.definitionId);
  if (definition.deathrattle) {
    score += 2.5;
  }
  if (definition.battlecry) {
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

function playAiHand(state: GameState, player: PlayerState): void {
  while (player.hand.length > 0 && player.board.length < MAX_BOARD_SIZE) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < player.hand.length; index += 1) {
      const score = minionScore(player, player.hand[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    playMinion(state, player, bestIndex);
  }
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

function arrangeAiBoard(player: PlayerState): void {
  player.board.sort((left, right) => {
    const leftDeathrattle =
      getMinionDefinition(left.definitionId).deathrattle !== undefined ? 1 : 0;
    const rightDeathrattle =
      getMinionDefinition(right.definitionId).deathrattle !== undefined ? 1 : 0;
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
    const shopIndex = bestShopIndex(player);
    if (shopIndex >= 0 && player.gold >= BUY_COST) {
      if (player.board.length < MAX_BOARD_SIZE) {
        if (buyMinion(state, player, shopIndex)) {
          actions += 1;
          continue;
        }
      } else {
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

    if (player.gold >= BUY_COST + REFRESH_COST && refreshes < 3) {
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
    const effects =
      getMinionDefinition(source.definitionId).startOfCombat ?? [];
    const scale = source.golden ? 2 : 1;
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

function applyCombatAuras(board: MinionInstance[]): void {
  for (const source of board) {
    const aura = getMinionDefinition(source.definitionId).aura;
    if (!aura) {
      continue;
    }
    const scale = source.golden ? 2 : 1;
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

function applyExistingAurasToSummoned(
  board: readonly MinionInstance[],
  summoned: MinionInstance,
): void {
  for (const source of board) {
    const aura = getMinionDefinition(source.definitionId).aura;
    if (
      !aura ||
      !minionHasTribe(summoned, aura.tribe) ||
      (aura.otherOnly && summoned.instanceId === source.instanceId)
    ) {
      continue;
    }
    const scale = source.golden ? 2 : 1;
    summoned.attack += aura.attack * scale;
    summoned.health += aura.health * scale;
  }
}

function applyNewAuraSource(
  board: readonly MinionInstance[],
  source: MinionInstance,
): void {
  const aura = getMinionDefinition(source.definitionId).aura;
  if (!aura) {
    return;
  }
  const scale = source.golden ? 2 : 1;
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

function removeCombatAuraSource(
  context: CombatContext,
  death: DeadMinion,
): void {
  const aura = getMinionDefinition(death.minion.definitionId).aura;
  if (!aura) {
    return;
  }
  const scale = death.minion.golden ? 2 : 1;
  for (const target of context.boards[death.ownerId]) {
    if (!minionHasTribe(target, aura.tribe)) {
      continue;
    }
    target.attack -= aura.attack * scale;
    target.health -= aura.health * scale;
  }
}

function extraDeathrattles(board: readonly MinionInstance[]): number {
  return board.reduce((total, minion) => {
    const extra =
      getMinionDefinition(minion.definitionId).extraDeathrattles ?? 0;
    return total + extra * (minion.golden ? 2 : 1);
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
    const trigger = getMinionDefinition(
      watcher.definitionId,
    ).afterFriendlySummoned;
    if (!trigger || !minionHasTribe(summoned, trigger.tribe)) {
      continue;
    }
    const scale = watcher.golden ? 2 : 1;
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

function summonCombatMinion(
  context: CombatContext,
  ownerId: PlayerId,
  definitionId: string,
  insertAt: number,
  source: MinionInstance,
  golden = false,
  taunt = false,
): MinionInstance | null {
  const board = context.boards[ownerId];
  if (board.length >= MAX_BOARD_SIZE) {
    return null;
  }
  const summoned = createMinionInstance(context.state, definitionId, 0);
  if (golden) {
    makeGoldenToken(summoned);
  }
  if (taunt) {
    summoned.taunt = true;
  }
  applyPersistentTribeBuff(context, ownerId, summoned);
  applyExistingAurasToSummoned(board, summoned);
  board.splice(Math.min(Math.max(0, insertAt), board.length), 0, summoned);
  applyNewAuraSource(board, summoned);
  triggerAfterFriendlySummoned(context, ownerId, summoned);
  pushBattleEvent(context.events, {
    type: "summon",
    actorPlayerId: ownerId,
    actorInstanceId: source.instanceId,
    targetPlayerId: ownerId,
    targetInstanceId: summoned.instanceId,
    minion: cloneMinion(summoned),
    message: `${source.name}召唤了${summoned.name}。`,
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
  const effects = getMinionDefinition(target.definitionId).afterSelfDamaged;
  if (!effects) {
    return;
  }
  const board = context.boards[ownerId];
  const sourceIndex = Math.max(
    0,
    board.findIndex((minion) => minion.instanceId === target.instanceId),
  );
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
        target.golden,
      );
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

function performImmediateAttack(
  context: CombatContext,
  ownerId: PlayerId,
  attacker: MinionInstance,
): void {
  const enemyId = opponentId(context, ownerId);
  const target = chooseAttackTarget(context, attacker, enemyId);
  if (!target) {
    return;
  }
  pushBattleEvent(context.events, {
    type: "attack",
    actorPlayerId: ownerId,
    actorInstanceId: attacker.instanceId,
    targetPlayerId: enemyId,
    targetInstanceId: target.instanceId,
    amount: attacker.attack,
    message: `${attacker.name}立即攻击${target.name}。`,
  });
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
  resolveCombatDeaths(context);
}

function triggerAfterFriendlyDied(
  context: CombatContext,
  ownerId: PlayerId,
  death: DeadMinion,
): void {
  const enemyId = opponentId(context, ownerId);
  for (const watcher of context.boards[ownerId]) {
    const trigger = getMinionDefinition(
      watcher.definitionId,
    ).afterFriendlyDied;
    if (!trigger || !minionHasTribe(death.minion, trigger.tribe)) {
      continue;
    }
    const scale = watcher.golden ? 2 : 1;
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

function resolveOneDeathrattle(
  context: CombatContext,
  death: DeadMinion,
): void {
  const source = death.minion;
  const ownerId = death.ownerId;
  const enemyId = opponentId(context, ownerId);
  const board = context.boards[ownerId];
  const definition = getMinionDefinition(source.definitionId);
  const scale = source.golden ? 2 : 1;
  const effects = definition.deathrattle ?? [];
  const repetitions = 1 + extraDeathrattles(board);
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const effect of effects) {
      if (effect.kind === "summon") {
        const baseCount =
          effect.count === "sourceAttack" ? source.attack : effect.count;
        const doublesCount =
          source.golden && effect.goldenMode === "doubleCount";
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
            source.golden && !doublesCount,
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
          source.golden && effect.goldenMode === "repeat" ? 2 : 1;
        const amount =
          source.golden && effect.goldenMode !== "repeat"
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
            candidate.id !== source.definitionId,
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
      board.splice(Math.min(death.index, board.length), 0, reborn);
      triggerAfterFriendlySummoned(context, death.ownerId, reborn);
      pushBattleEvent(context.events, {
        type: "summon",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        targetPlayerId: death.ownerId,
        targetInstanceId: reborn.instanceId,
        minion: cloneMinion(reborn),
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
    const enemyBoard = attackingA ? boardB : boardA;
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
      const currentAttacker = ownBoard.find(
        (minion) => minion.instanceId === attackerInstanceId,
      );
      if (!currentAttacker || currentAttacker.attack <= 0) {
        break;
      }
      const target = chooseAttackTarget(
        context,
        currentAttacker,
        defenderOwner.id,
      );
      if (!target) {
        break;
      }
      const targetIndex = enemyBoard.findIndex(
        (minion) => minion.instanceId === target.instanceId,
      );
      const cleaveTargets = currentAttacker.cleave
        ? [enemyBoard[targetIndex - 1], enemyBoard[targetIndex + 1]].filter(
            (minion): minion is MinionInstance => minion !== undefined,
          )
        : [];
      pushBattleEvent(events, {
        type: "attack",
        actorPlayerId: attackerOwner.id,
        actorInstanceId: currentAttacker.instanceId,
        targetPlayerId: defenderOwner.id,
        targetInstanceId: target.instanceId,
        amount: currentAttacker.attack,
        message: `${currentAttacker.name}攻击${target.name}${strike > 0 ? "（风怒）" : ""}。`,
      });

      dealCombatDamage(
        context,
        attackerOwner.id,
        currentAttacker,
        defenderOwner.id,
        target,
        currentAttacker.attack,
        currentAttacker.poisonous,
      );
      dealCombatDamage(
        context,
        defenderOwner.id,
        target,
        attackerOwner.id,
        currentAttacker,
        target.attack,
        target.poisonous,
      );
      for (const adjacent of cleaveTargets) {
        dealCombatDamage(
          context,
          attackerOwner.id,
          currentAttacker,
          defenderOwner.id,
          adjacent,
          currentAttacker.attack,
          currentAttacker.poisonous,
        );
      }
      resolveCombatDeaths(context);
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
  for (const minion of [...player.board, ...player.hand, ...player.shop]) {
    returnMinionToPool(state, minion);
  }
  player.board = player.board.map((minion) => ({
    ...minion,
    poolCopies: 0,
  }));
  player.hand = [];
  player.shop = [];
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
    player.gold = Math.min(10, state.round + 2);
    if (player.tavernTier < 6) {
      player.upgradeDiscount += 1;
    }
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
    frozen: false,
    upgradeDiscount: 0,
  }));
  const pool: Record<string, number> = {};
  const state: GameState = {
    version: 2,
    contentVersion: CURRENT_ROSTER_VERSION,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextInstanceId: 1,
    phase: "recruit",
    round: 1,
    humanPlayerId: HUMAN_PLAYER_ID,
    activeTribes: [],
    players,
    pool,
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
  for (const player of state.players) {
    fillShop(state, player);
  }
  return state;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
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
    case "SELL_MINION":
      sellMinion(next, player, action.boardIndex);
      break;
    case "PLAY_MINION":
      playMinion(next, player, action.handIndex, action.boardIndex);
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
