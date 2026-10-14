import { getAiStrategyProfile } from "./ai.ts";
import { getMinionDefinition, TRIBE_NAMES } from "./content.ts";
import { getTrinketDefinition } from "./lobby-systems.ts";
import type {
  BloodGemBonusKeyword, BoardMinionInstance, MagneticAttachment,
  MinionDefinition, PlayerState, Tribe,
} from "./types.ts";

function hasTribe(minion: BoardMinionInstance, tribe: Tribe): boolean {
  return minion.tribes.includes(tribe) || minion.tribes.includes("all");
}

/** One physical target per tribe, including dual tribes and multiple wildcards. */
function distinctTribeTargetCount(board: readonly BoardMinionInstance[]): number {
  const assigned = new Map<BoardMinionInstance, Tribe>();
  const assign = (tribe: Tribe, visited: Set<BoardMinionInstance>): boolean => {
    for (const target of board) {
      if (!hasTribe(target, tribe) || visited.has(target)) continue;
      visited.add(target);
      const previous = assigned.get(target);
      if (previous === undefined || assign(previous, visited)) {
        assigned.set(target, tribe);
        return true;
      }
    }
    return false;
  };
  for (const tribe of Object.keys(TRIBE_NAMES) as Tribe[]) {
    if (tribe !== "all" && tribe !== "neutral") assign(tribe, new Set());
  }
  return assigned.size;
}

function components(minion: BoardMinionInstance): Array<{
  definition: MinionDefinition; scale: number;
}> {
  const result = [{
    definition: getMinionDefinition(minion.definitionId),
    scale: minion.golden ? 2 : 1,
  }];
  const visit = (attachment: MagneticAttachment) => {
    result.push({
      definition: getMinionDefinition(attachment.definitionId),
      scale: attachment.golden ? 2 : 1,
    });
    attachment.attachments.forEach(visit);
  };
  minion.attachments.forEach(visit);
  return result;
}

function counter(minion: BoardMinionInstance, key: string): number {
  return Math.max(0, minion.effectCounters?.[key] ?? 0);
}

function keywordCount(minion: BoardMinionInstance): number {
  return [minion.taunt, minion.divineShield, minion.reborn, minion.stealth,
    minion.venomous, minion.windfury].filter(Boolean).length;
}

function endTurnRepetitions(player: PlayerState, board: readonly BoardMinionInstance[]): number {
  return 1 + board.reduce((largest, source) => components(source).reduce(
    (best, { definition, scale }) => Math.max(best,
      (definition.extraEndOfTurnTriggers ?? 0) * scale), largest), 0) +
    player.trinketIds.filter((id) =>
      getTrinketDefinition(id).cardId === "BG32_MagicItem_367").length;
}

function keywordGemValue(
  player: PlayerState, board: readonly BoardMinionInstance[], keyword?: BloodGemBonusKeyword,
): number {
  if (!keyword) return 0;
  const field = keyword === "tauntForQuilboar" ? "taunt" :
    keyword === "rebornForQuilboar" ? "reborn" : "divineShield";
  return Math.max(0, ...board.filter((target) => hasTribe(target, "quilboar") &&
    !target[field]).map((target) => components(target).reduce((total, component) => {
      const engine = component.definition.endOfTurn;
      return total + (engine?.kind === "applyBloodGemToAllPerBonusKeyword" ?
        engine.count * (engine.goldenMode === "doubleCount" ? component.scale : 1) : 0);
    }, 0))) * board.length * (player.bloodGemAttack + player.bloodGemHealth) *
    endTurnRepetitions(player, board) * 0.65;
}

/** Value only combat buffs that can actually reach a retained target. */
function retainedCombatGrowth(board: readonly BoardMinionInstance[]): number {
  let value = 0;
  const retained = new Map<BoardMinionInstance, number>();
  for (const keeper of board) {
    for (const { definition, scale } of components(keeper)) {
      const retention = definition.combatEnchantmentRetention;
      if (!retention) continue;
      const keeperIndex = board.indexOf(keeper);
      const targets = board.filter((target, index) =>
        (retention.target === "self" ? target === keeper :
          target !== keeper && (retention.target !== "adjacentFriendlyTribe" ||
            Math.abs(index - keeperIndex) === 1)) &&
        (!retention.tribe || hasTribe(target, retention.tribe)));
      for (const target of targets) {
        retained.set(target, Math.max(retained.get(target) ?? 0,
          retention.goldenMode === "doubleStats" ? scale : 1));
      }
    }
  }
  for (const [target, retentionScale] of retained) {
    for (const source of board) {
      for (const component of components(source)) {
        for (const buff of component.definition.startOfCombat ?? []) {
          if (buff.kind !== "buffRandomOtherTribe" || source === target ||
            !hasTribe(target, buff.tribe)) continue;
          const eligible = board.filter((other) =>
            other !== source && hasTribe(other, buff.tribe)).length;
          const chance = Math.min(1, buff.count *
            (buff.goldenMode === "doubleCount" ? component.scale : 1) /
            Math.max(1, eligible));
          value += chance * ((buff.attack + buff.health) * retentionScale +
            (buff.divineShield && !target.divineShield ?
              Math.max(3, target.attack * 0.65) : 0));
        }
        for (const buff of component.definition.afterFriendlyAttacks ?? []) {
          if (buff.kind !== "buffAttacker" ||
            (buff.otherOnly && source === target) ||
            (buff.tribe && !hasTribe(target, buff.tribe))) continue;
          value += (buff.attack + buff.health) *
            (buff.goldenMode === "doubleStats" ? component.scale : 1) *
            (target.windfury ? 2 : 1) * retentionScale;
        }
      }
    }
  }
  return value;
}

function deathrattleSupportValue(
  player: PlayerState, board: readonly BoardMinionInstance[], extra: number,
): number {
  if (extra === 0) return 0;
  let value = 0;
  for (const source of board) {
    const effects = [...components(source),
      ...(source.learnedDeathrattles ?? []).map((learned) => ({
        definition: getMinionDefinition(learned.definitionId),
        scale: learned.golden ? 2 : 1,
      }))];
    for (const { definition, scale } of effects) {
      for (const effect of definition.deathrattle ?? []) {
        if (effect.kind === "summon") {
          const token = getMinionDefinition(effect.definitionId);
          const count = typeof effect.count === "number" ? effect.count :
            Math.min(3, source.attack);
          value += Math.min(2, count) * (token.attack + token.health) *
            scale * 0.3;
        } else if (effect.kind === "applyBloodGemsToTribe") {
          value += board.filter((target) => target !== source &&
            hasTribe(target, effect.tribe)).length * effect.count * scale *
            (player.bloodGemAttack + player.bloodGemHealth) * 0.3;
        } else if (effect.kind === "damageEnemy") {
          value += effect.amount * scale * 0.4;
        } else if (effect.kind === "destroyKiller") {
          value += 8 * scale;
        }
      }
    }
  }
  return value * extra;
}

/** A short visible-state growth estimate, never a rollout or a new RNG source. */
export function aiCompositionValue(
  player: PlayerState, board: readonly BoardMinionInstance[] = player.board,
): number {
  if (player.tavernTier < 4 || board.length === 0) return 0;
  const profile = getAiStrategyProfile(player.id);
  const horizon = player.health + player.armor < profile.minimumUpgradeHealth ?
    0.6 : 1.25;
  const sources = board.flatMap((source) => components(source).map((component) =>
    ({ source, ...component })));
  const repetitions = endTurnRepetitions(player, board);
  const gemStats = player.bloodGemAttack + player.bloodGemHealth;
  const boardIds = new Set(board.map((minion) => minion.instanceId));
  let handSpace = Math.max(0, 10 - player.hand.filter((card) =>
    !boardIds.has(card.instanceId)).length);
  const valuedKeywords = new Set(player.hand.flatMap((card) =>
    card.kind === "bloodGem" && card.bonusKeyword ? [card.bonusKeyword] : []));
  const edible = player.shop.filter((offer) => !boardIds.has(offer.instanceId))
    .map((offer) => ({ attack: offer.attack, health: offer.health }));
  let growth = 0;
  const resource = (count: number, value: number) => {
    const gained = Math.min(handSpace, count);
    handSpace -= gained;
    return gained * value;
  };
  for (const { source, definition, scale } of sources) {
    const effect = definition.endOfTurn;
    if (!effect) continue;
    const sourceIndex = board.indexOf(source);
    switch (effect.kind) {
      case "applyBloodGemToAllPerBonusKeyword":
        growth += board.length * gemStats * effect.count *
          (effect.goldenMode === "doubleCount" ? scale : 1) *
          (1 + keywordCount(source)) * repetitions;
        break;
      case "onePerTribe": {
        growth += distinctTribeTargetCount(board) *
          (effect.attack + effect.health) * scale * repetitions;
        break;
      }
      case "buff":
        growth += (effect.target === "self" ? 1 :
          board.filter((_, index) => Math.abs(index - sourceIndex) === 1).length) *
          (effect.attack + effect.health) * scale * repetitions *
          (1 + (effect.repeatPerGoldenFriendly ?
            board.filter((target) => target.golden).length : 0));
        break;
      case "dynamicWarbandEndOfTurn":
        growth += board.length * repetitions * ((effect.attack + effect.health) *
          scale + counter(source, "dynamicEndOfTurnAttack") +
          counter(source, "dynamicEndOfTurnHealth"));
        break;
      case "leftmostTribeRepeatPerCardPlayed":
        if (board.some((target) => hasTribe(target, effect.tribe))) {
          growth += (effect.attack + effect.health) * scale * repetitions *
            (1 + player.cardsPlayedThisTurn);
        }
        break;
      case "demonsConsumeShop":
      case "consumeHighestHealthShop": {
        const count = repetitions * (effect.kind === "demonsConsumeShop" ?
          board.filter((target) => hasTribe(target, "demon")).length : 1);
        for (let consumed = 0; consumed < count && edible.length > 0; consumed++) {
          let stats: number;
          if (effect.kind === "consumeHighestHealthShop") {
            edible.sort((left, right) => right.health - left.health);
            const offer = edible.shift()!;
            stats = offer.attack + offer.health;
          } else {
            const mean = edible.reduce((total, offer) => ({
              attack: total.attack + offer.attack / edible.length,
              health: total.health + offer.health / edible.length,
            }), { attack: 0, health: 0 });
            stats = mean.attack + mean.health;
            edible.shift();
            // Random removal leaves the same expected mean for the remainder.
            edible.forEach((offer) => Object.assign(offer, mean));
          }
          growth += stats *
            (effect.goldenMode === "doubleStats" ? scale : 1);
        }
        break;
      }
      case "gainUpgradingMagneticSatellites": {
        const magnetic = getMinionDefinition(effect.definitionId).magnetic;
        const hosts = board.filter((target) => magnetic?.targetTribes.some((tribe) =>
          hasTribe(target, tribe)));
        if (hosts.length === 0) break;
        const copied = hosts.reduce((best, host) => Math.max(best,
          sources.reduce((total, component) => {
            const copy = component.definition.copyOtherMagnetization;
            return total + (component.source !== host && copy ?
              copy.copies * component.scale : 0);
          }, 0)), 0);
        growth += resource(effect.count * repetitions,
          ((effect.attack + effect.health) *
            (effect.goldenMode === "doubleStats" ? scale : 1) +
            counter(source, "magneticSatelliteAttackBonus") +
            counter(source, "magneticSatelliteHealthBonus")) * (1 + copied) * 0.6);
        break;
      }
      case "gainBloodGems": {
        const spaceBefore = handSpace;
        growth += resource(effect.count * scale * repetitions, gemStats * 0.65);
        if (handSpace < spaceBefore && effect.bonusKeyword &&
          !valuedKeywords.has(effect.bonusKeyword)) {
          growth += keywordGemValue(player, board, effect.bonusKeyword);
          valuedKeywords.add(effect.bonusKeyword);
        }
        break;
      }
      case "gainRandomTavernSpell":
      case "gainTavernSpell":
        growth += resource(effect.count * scale * repetitions, 2);
        break;
      case "periodicGainRandomMinion":
        growth += resource(effect.count *
          (effect.goldenMode === "doubleCount" ? scale : 1) *
          Math.max(0, 1 + Math.floor((repetitions -
            (counter(source, "periodicEndOfTurn") || effect.everyTurns)) /
            effect.everyTurns)), 3);
        break;
    }
  }
  const deathrattleExtra = sources.reduce((total, { definition, scale }) =>
    total + (definition.extraDeathrattles ?? 0) * scale, 0);
  return horizon * (growth + retainedCombatGrowth(board) +
    deathrattleSupportValue(player, board, deathrattleExtra));
}

/** Immediate missing-keyword access; already-played Battlecries earn no credit. */
export function aiCompositionOnPlayValue(
  player: PlayerState, minion: BoardMinionInstance,
  board: readonly BoardMinionInstance[] = player.board,
): number {
  if (player.tavernTier < 4 || player.board.some((target) =>
    target.instanceId === minion.instanceId)) return 0;
  let space = 10 - player.hand.filter((card) => card.instanceId !== minion.instanceId).length;
  const keywords = new Set(player.hand.flatMap((card) =>
    card.kind === "bloodGem" && card.bonusKeyword ? [card.bonusKeyword] : []));
  let value = 0;
  for (const { definition } of components(minion)) {
    for (const effect of definition.battlecry ?? []) {
      if (effect.kind !== "gainBloodGems" || effect.count <= 0 || space <= 0) continue;
      if (effect.bonusKeyword && !keywords.has(effect.bonusKeyword)) {
        value += keywordGemValue(player, board, effect.bonusKeyword);
        keywords.add(effect.bonusKeyword);
      }
      space -= effect.count;
    }
  }
  return value * (player.health + player.armor <
    getAiStrategyProfile(player.id).minimumUpgradeHealth ? 0.6 : 1.25);
}

/** Compare owned cores by removal, and new cards using a legal seven-unit board. */
export function aiCompositionMarginalValue(
  player: PlayerState, minion: BoardMinionInstance,
): number {
  const before = aiCompositionValue(player);
  const owned = player.board.findIndex((target) => target.instanceId === minion.instanceId);
  if (owned >= 0) {
    return before - aiCompositionValue(player,
      player.board.filter((_, index) => index !== owned));
  }
  const projections = player.board.length < 7 ? [[...player.board, minion]] :
    player.board.map((_, soldIndex) => player.board.map((target, index) =>
      index === soldIndex ? minion : target));
  return Math.max(...projections.map((board) => aiCompositionValue(player, board) +
    aiCompositionOnPlayValue(player, minion, board))) - before;
}
