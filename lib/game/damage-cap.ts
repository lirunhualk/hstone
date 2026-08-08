/**
 * Solo Battlegrounds limits post-combat hero damage while more than four
 * players are alive. The cap increases with the recruit round and is removed
 * for the Top 4.
 */
export type SoloCombatDamageCap = 5 | 10 | 15;

export function getSoloCombatDamageCap(
  round: number,
  alivePlayerCount: number,
): SoloCombatDamageCap | null {
  if (alivePlayerCount <= 4) {
    return null;
  }
  if (round < 4) {
    return 5;
  }
  if (round < 8) {
    return 10;
  }
  return 15;
}
