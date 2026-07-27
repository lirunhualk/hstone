// Explicit `.ts` specifiers keep the pure engine directly runnable by Node
// 24's built-in type stripping as well as by the app's Vite bundler.
import { MINION_DEFINITIONS, getMinionDefinition } from "./content.ts";
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
  "铆钉旅人",
  "雾港船长",
  "荒原学者",
  "星桥守卫",
  "炉心工匠",
  "潮痕猎手",
  "林间先知",
] as const;

const SHOP_SIZE_BY_TIER = [0, 3, 4, 4, 5, 5, 6] as const;
const UPGRADE_BASE_COST = [0, 5, 7, 8, 9, 10, 0] as const;
const POOL_COPIES_BY_TIER = [0, 18, 15, 13, 11, 9, 7] as const;
const TIER_UP_ROUND = [0, 0, 2, 4, 6, 9, 11] as const;
const DEFAULT_SEED = 0x4853544e;
const MAX_BOARD_SIZE = 7;
const MAX_HAND_SIZE = 10;
const BUY_COST = 3;
const REFRESH_COST = 1;
const MAX_COMBAT_ATTACKS = 100;

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
    name: definition.name,
    tier: definition.tier,
    tribe: definition.tribe,
    attack: definition.attack,
    health: definition.health,
    golden: false,
    taunt: definition.taunt === true,
    divineShield: definition.divineShield === true,
    description: definition.description,
    poolCopies,
  };
  state.nextInstanceId += 1;
  return instance;
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
      definition.collectible !== false &&
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
    case "friendlyTribe":
      return player.board.filter((minion) => minion.tribe === effect.tribe);
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
        if (candidates.length > 0) {
          candidates[randomIndex(state, candidates.length)].divineShield = true;
        }
      }
    } else if (effect.kind === "gainGold") {
      player.gold += effect.amount * scale;
    } else if (effect.kind === "summon") {
      const summonCount = effect.count * scale;
      for (
        let count = 0;
        count < summonCount && player.board.length < MAX_BOARD_SIZE;
        count += 1
      ) {
        player.board.push(
          createMinionInstance(state, effect.definitionId, 0),
        );
      }
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
      golden.description = `金色：${definition.description}`;
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
  player.gold += 1;
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
  applyRecruitEffects(
    state,
    player,
    minion,
    getMinionDefinition(minion.definitionId).battlecry,
  );
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
  fillShop(state, player);
  return true;
}

function ownedNormalCount(player: PlayerState, definitionId: string): number {
  return [...player.board, ...player.hand].filter(
    (minion) =>
      minion.definitionId === definitionId && minion.golden === false,
  ).length;
}

function tribeCount(player: PlayerState, tribe: Tribe): number {
  return player.board.filter((minion) => minion.tribe === tribe).length;
}

function minionScore(player: PlayerState, minion: MinionInstance): number {
  let score = minion.attack + minion.health;
  if (minion.divineShield) {
    score += Math.max(3, minion.attack * 0.65);
  }
  if (minion.taunt) {
    score += 1.5;
  }
  const definition = getMinionDefinition(minion.definitionId);
  if (definition.deathrattle) {
    score += 2.5;
  }
  if (definition.battlecry) {
    score += 1.5;
  }
  if (minion.tribe !== "neutral") {
    score += tribeCount(player, minion.tribe) * 0.8;
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
    case "otherFriendly":
      return [...board];
    case "friendlyTribe":
      return board.filter((minion) => minion.tribe === effect.tribe);
    case "randomFriendly":
      return board.length === 0
        ? []
        : [board[randomIndex(state, board.length)]];
  }
}

function resolveDeathrattles(
  state: GameState,
  board: MinionInstance[],
  dead: DeadMinion[],
  events: BattleEvent[],
): void {
  for (const death of dead) {
    const source = death.minion;
    const definition = getMinionDefinition(source.definitionId);
    const scale = source.golden ? 2 : 1;
    const effects = definition.deathrattle ?? [];
    for (const effect of effects) {
      if (effect.kind === "summon") {
        for (
          let count = 0;
          count < effect.count * scale && board.length < MAX_BOARD_SIZE;
          count += 1
        ) {
          const summoned = createMinionInstance(
            state,
            effect.definitionId,
            0,
          );
          const insertAt = Math.min(death.index + count, board.length);
          board.splice(insertAt, 0, summoned);
          pushBattleEvent(events, {
            type: "summon",
            actorPlayerId: death.ownerId,
            actorInstanceId: source.instanceId,
            targetPlayerId: death.ownerId,
            targetInstanceId: summoned.instanceId,
            minion: cloneMinion(summoned),
            message: `${source.name}召唤了${summoned.name}。`,
          });
        }
      } else if (effect.kind === "buff") {
        for (const target of combatBuffTargets(state, board, source, effect)) {
          applyBuff(target, effect, scale);
        }
      } else if (effect.kind === "grantShield") {
        if (board.length > 0) {
          const target = board[randomIndex(state, board.length)];
          target.divineShield = true;
        }
      }
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
  const initialBoards: Record<PlayerId, MinionInstance[]> = {
    [playerA.id]: cloneBoard(boardA),
    [playerB.id]: cloneBoard(boardB),
  };
  const events: BattleEvent[] = [];
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
    const tauntTargets = enemyBoard
      .map((minion, index) => ({ minion, index }))
      .filter(({ minion }) => minion.taunt);
    const targetPool =
      tauntTargets.length > 0
        ? tauntTargets
        : enemyBoard.map((minion, index) => ({ minion, index }));
    const chosenTarget = targetPool[randomIndex(state, targetPool.length)];
    const target = chosenTarget.minion;
    pushBattleEvent(events, {
      type: "attack",
      actorPlayerId: attackerOwner.id,
      actorInstanceId: attacker.instanceId,
      targetPlayerId: defenderOwner.id,
      targetInstanceId: target.instanceId,
      amount: attacker.attack,
      message: `${attacker.name}攻击${target.name}。`,
    });

    const attackerDamage = target.attack;
    const targetDamage = attacker.attack;
    if (targetDamage > 0 && target.divineShield) {
      target.divineShield = false;
      pushBattleEvent(events, {
        type: "shieldBroken",
        actorPlayerId: attackerOwner.id,
        actorInstanceId: attacker.instanceId,
        targetPlayerId: defenderOwner.id,
        targetInstanceId: target.instanceId,
        message: `${target.name}的护盾被击破。`,
      });
    } else {
      target.health -= targetDamage;
    }
    if (attackerDamage > 0 && attacker.divineShield) {
      attacker.divineShield = false;
      pushBattleEvent(events, {
        type: "shieldBroken",
        actorPlayerId: defenderOwner.id,
        actorInstanceId: target.instanceId,
        targetPlayerId: attackerOwner.id,
        targetInstanceId: attacker.instanceId,
        message: `${attacker.name}的护盾被击破。`,
      });
    } else {
      attacker.health -= attackerDamage;
    }

    const deadOwn = removeDead(ownBoard, attackerOwner.id);
    const deadEnemy = removeDead(enemyBoard, defenderOwner.id);
    for (const death of [...deadOwn, ...deadEnemy]) {
      pushBattleEvent(events, {
        type: "death",
        actorPlayerId: death.ownerId,
        actorInstanceId: death.minion.instanceId,
        message: `${death.minion.name}被消灭。`,
      });
    }
    resolveDeathrattles(state, ownBoard, deadOwn, events);
    resolveDeathrattles(state, enemyBoard, deadEnemy, events);

    const survivingAttackerIndex = ownBoard.findIndex(
      (minion) => minion.instanceId === attacker.instanceId,
    );
    cursors[attackerOwner.id] =
      ownBoard.length === 0
        ? 0
        : survivingAttackerIndex >= 0
          ? (survivingAttackerIndex + 1) % ownBoard.length
          : Math.min(attackIndex, ownBoard.length - 1);
    attackingPlayerId = defenderOwner.id;
    attackCount += 1;
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
  const aiPlayers = state.players.filter(
    (player) => player.alive && !player.isHuman,
  );
  shuffleInPlace(state, aiPlayers);
  for (const player of aiPlayers) {
    runAiRecruit(state, player);
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
  for (const definition of MINION_DEFINITIONS) {
    pool[definition.id] =
      definition.collectible === false
        ? 0
        : POOL_COPIES_BY_TIER[definition.tier];
  }
  const state: GameState = {
    version: 1,
    seed: normalizedSeed,
    rngState: normalizedSeed,
    nextInstanceId: 1,
    phase: "recruit",
    round: 1,
    humanPlayerId: HUMAN_PLAYER_ID,
    players,
    pool,
    lastBattle: null,
    lastRoundBattles: [],
    winnerId: null,
  };
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
