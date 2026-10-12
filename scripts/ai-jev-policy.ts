import { createHash } from "node:crypto";

import { aiRefreshLimit, type AiStrategyProfile } from "../lib/game/ai.ts";
import { scoreAiRecruitObservation } from "../lib/game/ai-recruit-planner.ts";
import type { AiTrainingEnvironment, AiTrainingLegalAction } from "../lib/game/ai-training-environment.ts";
import type { AiTrainingObservation, DeepReadonly } from "../lib/game/ai-training.ts";
import { getHeroPowerDefinition } from "../lib/game/hero-powers.ts";
import { getSystemEventDefinition, getTrinketDefinition } from "../lib/game/lobby-systems.ts";
import { JevClientError, reserveJevInputTokens, validateJevResponse, type JevClient, type JevQuestion, type JevResponse, type JevValidationRule, type JevValidationDiagnostic } from "./ai-jev-client.ts";

export const JEV_RECRUIT_POLICY_VERSION = "jev-visible-recruit-v4-noul-ranked-benefit";
export type JevDecisionMode = "all-decisions" | "critical-decisions";
export const JEV_RECRUIT_PRESET = Object.freeze({
  maxCandidates: 6,
  maxDecisionsPerTurn: 50,
  minimumEvidenceSpread: 1e-6,
  maxInputReservationPerRequest: 32_000,
  dimensions: Object.freeze({ tempo: 0.40, growth: 0.25, economy: 0.20, preservation: 0.15 }),
});

export interface JevTurnDiagnostics {
  decisions: number;
  calls: number;
  successfulResponses: number;
  appliedActions: number;
  emergencyChoiceActions: number;
  rejectedActions: number;
  staleResponses: number;
  limitHits: number;
  completed: boolean;
  fallbacks: Record<string, number>;
  latenciesMs: number[];
  inputTokens: number;
  outputTokens: number;
}

type PublicAction = Omit<Readonly<AiTrainingLegalAction>, "token">;
export interface JevDecisionRecord {
  mode: JevDecisionMode;
  decisionIndex: number;
  round: number;
  requestHash: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
  response: JevResponse | null;
  selectedAction: PublicAction | null;
  status: string;
  providerStatus: number | null;
  providerValidationRule?: JevValidationRule;
  providerValidationDiagnostic?: JevValidationDiagnostic;
  candidateBenefitEvidence?: Record<string, number>;
}

export interface JevRecruitOptions {
  mode: JevDecisionMode;
  client: Pick<JevClient, "evaluate">;
  profile: AiStrategyProfile;
  /** Must match the pinned model on the client; also validates test providers. */
  model: string;
  signal?: AbortSignal;
  maxDecisionsPerTurn?: number;
  onDecision?: (record: JevDecisionRecord) => void;
}

export type JevRecruitEnvironment = Pick<AiTrainingEnvironment,
  "observe" | "safeRecruitLegalActions" | "plannerLegalActions" | "plannerTransition" | "step" | "completeLegacyRecruitTurn"
>;

function publicAction(action: Readonly<AiTrainingLegalAction>): PublicAction {
  const { type, source, target, boardIndex, choiceIndex, cost, plannerDisposition } = action;
  return { type, source, target, boardIndex, choiceIndex, cost, plannerDisposition };
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function referencedCard(observation: DeepReadonly<AiTrainingObservation>, reference: AiTrainingLegalAction["source"]) {
  if (!reference) return null;
  switch (reference.zone) {
    case "board": return observation.own.board[reference.index] ?? null;
    case "hand": return observation.own.hand[reference.index] ?? null;
    case "shop": return observation.own.shop[reference.index] ?? null;
    case "spellShop": return observation.own.spellShop;
    case "additionalSpellShop": return observation.own.additionalSpellShop[reference.index] ?? null;
  }
}

function priority(observation: DeepReadonly<AiTrainingObservation>, action: Readonly<AiTrainingLegalAction>): number {
  const source = referencedCard(observation, action.source);
  const stats = source?.kind === "minion" ? source.attack + source.health : 0;
  switch (action.type) {
    case "RESOLVE_INTERACTION": {
      const card = action.choiceIndex === null ? null : observation.own.pendingInteraction?.optionCards[action.choiceIndex];
      return 400 + (card ? card.attack + card.health + card.tier * 3 : 0);
    }
    case "PLAY_HAND_CARD": return 300 + stats;
    case "MAGNETIZE_MINION": return 310 + stats;
    case "CAST_BLOOD_GEM": case "CAST_SPELLCRAFT": case "CAST_TAVERN_SPELL": return 280;
    case "BUY_MINION": {
      const copies = source?.kind === "minion"
        ? [...observation.own.board, ...observation.own.hand].filter((card) => card.kind === "minion" && !card.golden && card.definitionId === source.definitionId).length : 0;
      return 150 + stats + copies * 30;
    }
    case "BUY_TAVERN_SPELL": return 130;
    case "UPGRADE_TAVERN": return 140;
    case "ACTIVATE_HERO_POWER": return 160;
    case "SELL_MINION": return (observation.own.board.length === 7 ? 120 : -50) - stats;
    case "REFRESH_SHOP": return 30;
    case "MOVE_MINION": return 0;
    case "TOGGLE_FREEZE": return -10;
    case "END_TURN": return -20;
    default: return -100;
  }
}

/** Local pruning is fixed before evaluation; it never explores a random branch. */
export function selectJevCandidates(
  environment: JevRecruitEnvironment,
  profile: AiStrategyProfile,
  turn: { refreshes: number; freezes: number; moves: number },
): readonly Readonly<AiTrainingLegalAction>[] {
  const observation = environment.observe();
  const refreshLimit = aiRefreshLimit(profile, observation.own.tavernTier, observation.own.board.length, observation.own.health + observation.own.armor);
  const legal = environment.safeRecruitLegalActions().filter((action) =>
    action.type !== "CONTINUE" &&
    action.plannerDisposition !== "unsupported" &&
    (action.type !== "REFRESH_SHOP" || turn.refreshes < refreshLimit) &&
    (action.type !== "TOGGLE_FREEZE" || turn.freezes < 1) &&
    (action.type !== "MOVE_MINION" || turn.moves < 2),
  );
  const ordered = [...legal].sort((left, right) => priority(observation, right) - priority(observation, left) || left.token.localeCompare(right.token));
  // Keep each action family, then fill the remaining slots with local candidates.
  const selected: Readonly<AiTrainingLegalAction>[] = [];
  const types = new Set<string>();
  for (const action of ordered) {
    if (!types.has(action.type) && selected.length < JEV_RECRUIT_PRESET.maxCandidates) {
      selected.push(action);
      types.add(action.type);
    }
  }
  // Always preserve the legal finish option even with many action families.
  const end = legal.find((action) => action.type === "END_TURN");
  if (end && !selected.includes(end)) {
    if (selected.length === JEV_RECRUIT_PRESET.maxCandidates) selected.pop();
    selected.push(end);
  }
  for (const action of ordered) {
    if (selected.length === JEV_RECRUIT_PRESET.maxCandidates) break;
    if (!selected.includes(action)) selected.push(action);
  }
  return Object.freeze(selected);
}

/** Explicit checkpoints, not a claim to intercept every legacy policy decision. */
export function isJevCriticalCheckpoint(observation: DeepReadonly<AiTrainingObservation>, actions: readonly Readonly<AiTrainingLegalAction>[]): boolean {
  return (observation.own.pendingInteraction !== null && actions.length > 1) ||
    actions.some((action) => action.type === "UPGRADE_TAVERN") ||
    (observation.own.board.length === 7 && actions.some((action) => action.type === "SELL_MINION") &&
      actions.some((action) => ["BUY_MINION", "PLAY_HAND_CARD", "MAGNETIZE_MINION"].includes(action.type)));
}

function rulesFor(observation: DeepReadonly<AiTrainingObservation>) {
  const power = observation.own.heroPowerId ? getHeroPowerDefinition(observation.own.heroPowerId) : null;
  const event = observation.public.systemEventId ? getSystemEventDefinition(observation.public.systemEventId) : null;
  return {
    heroPower: power ? { name: power.name, description: power.description } : null,
    trinkets: observation.own.trinketIds.map((id) => {
      const trinket = getTrinketDefinition(id);
      return { id, name: trinket.name, description: trinket.description };
    }),
    systemEvent: event ? { name: event.name, description: event.description } : null,
  };
}

const EXPLICIT_DEFAULT_FIELDS = new Set([
  "board", "hand", "shop", "spellShop", "additionalSpellShop", "optionCards", "optionIds", "optionReferences",
  "source", "target", "index", "boardIndex", "choiceIndex", "controlledSeat", "seat", "round",
  "gold", "health", "armor", "attack", "tier", "tavernTier", "frozen", "pendingInteraction",
]);

/** Lossless defaults under the explicit input convention; never shorten text. */
function compactDefaults(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactDefaults);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const compacted = compactDefaults(child);
    const defaultValue = compacted === null || compacted === false || compacted === 0 ||
      (Array.isArray(compacted) && compacted.length === 0) ||
      (compacted !== null && typeof compacted === "object" && !Array.isArray(compacted) && Object.keys(compacted).length === 0);
    return defaultValue && !EXPLICIT_DEFAULT_FIELDS.has(key) ? [] : [[key, compacted]];
  }));
}

export function createJevDecisionRequest(environment: JevRecruitEnvironment, actions: readonly Readonly<AiTrainingLegalAction>[], profile: AiStrategyProfile) {
  const observation = environment.observe();
  const baseline = scoreAiRecruitObservation(observation, profile);
  const candidates = actions.map((action, index) => {
    let deterministicDelta: Record<string, number> | null = null;
    // The all-actions and planner tokens use separate masks. Match a public
    // descriptor before using the planner's no-RNG transition, never step a
    // random action on a fork to discover its hidden outcome.
    if (action.plannerDisposition === "deterministic" && action.type !== "MOVE_MINION") {
      try {
        const matching = environment.plannerLegalActions().find((item) => hash(publicAction(item)) === hash(publicAction(action)));
        if (!matching) throw new Error("No deterministic planner counterpart");
        const transition = environment.plannerTransition(matching.token);
        if (transition.kind === "deterministic") {
          const score = scoreAiRecruitObservation(transition.observation, profile);
          deterministicDelta = {
            boardPower: score.boardPower - baseline.boardPower,
            handPotential: score.handPotential - baseline.handPotential,
            tavernTierValue: score.tavernTierValue - baseline.tavernTierValue,
            futureEconomy: score.futureEconomy - baseline.futureEconomy,
          };
        }
      } catch {
        // Different masks may not share tokens. Absence of a prediction is
        // explicit, and never causes a random branch to be sampled.
      }
    }
    return { id: `a${index}`, ...publicAction(action), sourceName: referencedCard(observation, action.source)?.name ?? null,
      targetName: referencedCard(observation, action.target)?.name ?? null, deterministicDelta,
      commitment: action.type === "END_TURN" ? "Finish now; forgo remaining gold and playable hand cards."
        : action.type === "RESOLVE_INTERACTION" ? "Commit the displayed option and its full effects at the displayed destination."
        : "Pay the quoted currency and amount; include source loss and target effects." };
  });
  const decisionCriteria = {
    tempo: "A good next action for near-term combat survival: net board coverage, stats, keywords and damage risk after full effects, costs and affordable follow-up plays of known cards.",
    growth: "A good next action for sustainable growth: net printed scaling, triples and tavern access after full effects and costs; unknown rolls remain unknown.",
    economy: "A good next action for resource efficiency: net gold, hand/board capacity, cycling and forgone purchases compared with listed alternatives.",
    preservation: "A good next action for preserving core and functional board order: net source loss, target changes and sacrificed scaling.",
  };
  const state = {
    policyVersion: JEV_RECRUIT_POLICY_VERSION,
    observation: compactDefaults(observation) as DeepReadonly<AiTrainingObservation>,
    rules: rulesFor(observation),
    candidates,
    decisionCriteria,
    objective: "Improve final placement in this fixed-version Battlegrounds game. Use printed effects and current counters. Omitted numeric counters mean 0, omitted boolean keywords mean false, omitted collections mean empty, and omitted optional values mean null. Full descriptions and zone order are retained. Hidden opponents, random future shops, and shared pool counts are unavailable. Unknown random outcomes are not predictions. Preserve core synergies and account for gold, health, hand space and board space.",
  };
  const questions: Record<string, JevQuestion> = Object.fromEntries(candidates.flatMap((candidate, index) =>
    Object.keys(decisionCriteria).map((dimension) => [`${candidate.id}_${dimension}`, {
      type: "noul", instructions: `After its complete effects and quoted costs, does candidates[${index}] satisfy decisionCriteria.${dimension}? Judge against the listed alternatives.`,
    }]),
  ));
  // Only the audited, public observation and token-free descriptors cross the
  // network boundary. Detached JSON also protects against later state changes.
  return JSON.parse(JSON.stringify({ state, questions })) as { state: typeof state; questions: Record<string, JevQuestion> };
}

function fingerprint(environment: JevRecruitEnvironment): string {
  return hash({ observation: environment.observe(), actions: environment.safeRecruitLegalActions() });
}

function freshDiagnostics(): JevTurnDiagnostics {
  return { decisions: 0, calls: 0, successfulResponses: 0, appliedActions: 0, emergencyChoiceActions: 0,
    rejectedActions: 0, staleResponses: 0, limitHits: 0, completed: false, fallbacks: {}, latenciesMs: [], inputTokens: 0, outputTokens: 0 };
}

function fallback(environment: JevRecruitEnvironment, diagnostics: JevTurnDiagnostics, reason: string): JevTurnDiagnostics {
  diagnostics.fallbacks[reason] = (diagnostics.fallbacks[reason] ?? 0) + 1;
  // Human-style pending choices cannot be handed to production runAiRecruit.
  // A bounded first-legal resolution is an explicit emergency policy, never
  // counted as a model decision or authentic legacy equivalence.
  for (let count = 0; environment.observe().own.pendingInteraction !== null && count < 50; count += 1) {
    const action = environment.safeRecruitLegalActions().find((item) => item.type === "RESOLVE_INTERACTION");
    if (!action || !environment.step(action.token, { includeLegalActions: false }).accepted) {
      diagnostics.rejectedActions += 1;
      return diagnostics;
    }
    diagnostics.emergencyChoiceActions += 1;
  }
  const observation = environment.observe();
  if (observation.own.pendingInteraction !== null) {
    diagnostics.limitHits += 1;
    return diagnostics;
  }
  if (observation.public.phase !== "recruit" || !observation.own.alive) return diagnostics;
  const transition = environment.completeLegacyRecruitTurn();
  diagnostics.completed = transition.accepted;
  if (!transition.accepted) diagnostics.rejectedActions += 1;
  return diagnostics;
}

/** Asynchronous, one-seat research runner. It is never imported by the UI. */
export async function runJevRecruitTurn(environment: JevRecruitEnvironment, options: JevRecruitOptions): Promise<JevTurnDiagnostics> {
  if (!["all-decisions", "critical-decisions"].includes(options.mode) || !/^jev-\d+\.\d+\.\d+$/.test(options.model)) throw new RangeError("Invalid Jev policy configuration");
  const maximum = options.maxDecisionsPerTurn ?? JEV_RECRUIT_PRESET.maxDecisionsPerTurn;
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 50) throw new RangeError("Jev decision limit must be from 1 to 50");
  const diagnostics = freshDiagnostics();
  const turn = { refreshes: 0, freezes: 0, moves: 0 };
  const visited = new Set<string>();
  for (let index = 0; index < maximum; index += 1) {
    const observation = environment.observe();
    if (observation.public.phase !== "recruit" || !observation.own.alive) return diagnostics;
    if (options.signal?.aborted) return fallback(environment, diagnostics, "aborted");
    const visibleHash = hash(observation);
    if (visited.has(visibleHash)) return fallback(environment, diagnostics, "cycle");
    visited.add(visibleHash);
    const actions = selectJevCandidates(environment, options.profile, turn);
    if (actions.length === 0) return fallback(environment, diagnostics, "no-candidates");
    if (options.mode === "critical-decisions" && !isJevCriticalCheckpoint(observation, environment.safeRecruitLegalActions())) return fallback(environment, diagnostics, "non-critical");
    if (actions.length === 1) return fallback(environment, diagnostics, "forced-choice");
    const before = fingerprint(environment);
    const request = createJevDecisionRequest(environment, actions, options.profile);
    const record: JevDecisionRecord = { mode: options.mode, decisionIndex: index, round: observation.public.round,
      requestHash: hash(request), ...request, response: null, selectedAction: null, status: "pending", providerStatus: null };
    const body = JSON.stringify({ state: request.state, model: options.model, questions: request.questions });
    if (reserveJevInputTokens(body, Object.keys(request.questions).length) > JEV_RECRUIT_PRESET.maxInputReservationPerRequest) {
      record.status = "input-limit";
      options.onDecision?.(record);
      return fallback(environment, diagnostics, "input-limit");
    }
    diagnostics.decisions += 1;
    diagnostics.calls += 1;
    let response: JevResponse;
    try {
      const result = await options.client.evaluate(request.state, request.questions, options.signal);
      response = validateJevResponse(result, request.questions, options.model, result.latencyMs);
    } catch (error) {
      const reason = error instanceof JevClientError ? error.code : "provider-error";
      record.status = reason;
      record.providerStatus = error instanceof JevClientError ? error.status ?? null : null;
      if (error instanceof JevClientError && error.validationRule) {
        record.providerValidationRule = error.validationRule;
        record.providerValidationDiagnostic = error.validationDiagnostic;
      }
      options.onDecision?.(record);
      return fallback(environment, diagnostics, reason);
    }
    record.response = response;
    diagnostics.successfulResponses += 1;
    diagnostics.latenciesMs.push(response.latencyMs);
    diagnostics.inputTokens += response.usage.input_tokens;
    diagnostics.outputTokens += response.usage.output_tokens;
    if (options.signal?.aborted || before !== fingerprint(environment)) {
      diagnostics.staleResponses += 1;
      record.status = "stale-response";
      options.onDecision?.(record);
      return fallback(environment, diagnostics, "stale-response");
    }
    const scores: Record<string, number> = {};
    for (const [ordinal] of actions.entries()) {
      const id = `a${ordinal}`;
      scores[id] = 0;
      for (const [dimension, weight] of Object.entries(JEV_RECRUIT_PRESET.dimensions)) {
        const answer = response.answers[`${id}_${dimension}`];
        if (answer.type !== "noul") throw new Error("Validated Jev answer type changed");
        scores[id] += weight * answer.noul;
      }
    }
    record.candidateBenefitEvidence = scores;
    // Independent binary judgments need not sum to one across candidates.
    // Their weighted evidence is neither expected return nor winning odds.
    // A stable tie uses the already-frozen local candidate ordering.
    const selected = Object.keys(scores).sort((left, right) => {
      const difference = scores[right] - scores[left];
      return Math.abs(difference) > 1e-12 ? difference : Number(left.slice(1)) - Number(right.slice(1));
    })[0];
    const spread = Math.max(...Object.values(scores)) - Math.min(...Object.values(scores));
    if (spread <= JEV_RECRUIT_PRESET.minimumEvidenceSpread) {
      record.status = "unresolved-benefit-ranking";
      options.onDecision?.(record);
      return fallback(environment, diagnostics, record.status);
    }
    const action = actions[Number(selected.slice(1))];
    record.selectedAction = publicAction(action);
    const transition = environment.step(action.token, { includeLegalActions: false });
    if (!transition.accepted) {
      diagnostics.rejectedActions += 1;
      record.status = "rejected-action";
      options.onDecision?.(record);
      return fallback(environment, diagnostics, "rejected-action");
    }
    diagnostics.appliedActions += 1;
    record.status = "applied";
    options.onDecision?.(record);
    if (action.type === "REFRESH_SHOP") turn.refreshes += 1;
    if (action.type === "TOGGLE_FREEZE") turn.freezes += 1;
    if (action.type === "MOVE_MINION") turn.moves += 1;
    if (action.type === "END_TURN") { diagnostics.completed = true; return diagnostics; }
  }
  diagnostics.limitHits += 1;
  return fallback(environment, diagnostics, "decision-limit");
}
