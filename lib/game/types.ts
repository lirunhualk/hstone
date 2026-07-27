export type PlayerId = string;

export type GamePhase = "recruit" | "combat" | "gameOver";

export type Tribe =
  | "wild"
  | "construct"
  | "ember"
  | "tide"
  | "astral"
  | "neutral";

export type EffectTarget =
  | "self"
  | "randomFriendly"
  | "allFriendly"
  | "otherFriendly"
  | "friendlyTribe";

export interface BuffEffect {
  kind: "buff";
  target: EffectTarget;
  attack: number;
  health: number;
  tribe?: Tribe;
}

export interface SummonEffect {
  kind: "summon";
  definitionId: string;
  count: number;
}

export interface GrantShieldEffect {
  kind: "grantShield";
  target: "self" | "randomFriendly";
}

export interface GainGoldEffect {
  kind: "gainGold";
  amount: number;
}

export type MinionEffect =
  | BuffEffect
  | SummonEffect
  | GrantShieldEffect
  | GainGoldEffect;

export interface MinionDefinition {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tribe: Tribe;
  attack: number;
  health: number;
  description: string;
  taunt?: boolean;
  divineShield?: boolean;
  battlecry?: readonly MinionEffect[];
  deathrattle?: readonly MinionEffect[];
  collectible?: boolean;
}

/**
 * The complete, JSON-safe representation of a minion owned by a player or
 * reserved in a shop. Combat works on cloned instances, never on the permanent
 * board itself.
 */
export interface MinionInstance {
  instanceId: string;
  definitionId: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  tribe: Tribe;
  attack: number;
  health: number;
  golden: boolean;
  taunt: boolean;
  divineShield: boolean;
  description: string;
  /**
   * Number of base copies represented in the shared pool. It is 1 for a
   * regular purchased minion, 3 for a golden minion, and 0 for combat tokens.
   */
  poolCopies: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  isHuman: boolean;
  health: number;
  alive: boolean;
  tavernTier: 1 | 2 | 3 | 4 | 5 | 6;
  gold: number;
  board: MinionInstance[];
  hand: MinionInstance[];
  shop: MinionInstance[];
  frozen: boolean;
  upgradeDiscount: number;
  lastOpponentId?: PlayerId;
  eliminatedRound?: number;
  placement?: number;
}

export type BattleEventType =
  | "battleStart"
  | "attack"
  | "shieldBroken"
  | "death"
  | "summon"
  | "heroDamage"
  | "battleEnd";

/**
 * Battle events deliberately contain IDs and a readable fallback message.
 * A simple UI can render `message`; an animated UI can use the structured
 * fields and the battle's initial boards.
 */
export interface BattleEvent {
  index: number;
  type: BattleEventType;
  message: string;
  actorPlayerId?: PlayerId;
  actorInstanceId?: string;
  targetPlayerId?: PlayerId;
  targetInstanceId?: string;
  amount?: number;
  minion?: MinionInstance;
}

export type BattleResult = "win" | "loss" | "tie";

export interface BattleSummary {
  round: number;
  playerAId: PlayerId;
  playerBId: PlayerId;
  playerAName: string;
  playerBName: string;
  isGhost: boolean;
  winnerId: PlayerId | null;
  resultForHuman?: BattleResult;
  damageToPlayerA: number;
  damageToPlayerB: number;
  playerAHealthBefore: number;
  playerBHealthBefore: number;
  playerAHealthAfter: number;
  playerBHealthAfter: number;
  initialBoards: Record<PlayerId, MinionInstance[]>;
  finalBoards: Record<PlayerId, MinionInstance[]>;
  events: BattleEvent[];
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  nextInstanceId: number;
  phase: GamePhase;
  round: number;
  humanPlayerId: PlayerId;
  players: PlayerState[];
  /** Available (not owned and not reserved in a shop) copies by definition ID. */
  pool: Record<string, number>;
  /** The human player's most recently resolved battle. */
  lastBattle: BattleSummary | null;
  /** All battles resolved by the latest END_TURN action. */
  lastRoundBattles: BattleSummary[];
  winnerId: PlayerId | null;
}

export type GameAction =
  | { type: "BUY_MINION"; shopIndex: number }
  | { type: "SELL_MINION"; boardIndex: number }
  | { type: "PLAY_MINION"; handIndex: number; boardIndex?: number }
  | { type: "REFRESH_SHOP" }
  | { type: "TOGGLE_FREEZE" }
  | { type: "UPGRADE_TAVERN" }
  | { type: "MOVE_MINION"; fromIndex: number; toIndex: number }
  | { type: "END_TURN" }
  | { type: "CONTINUE" };
