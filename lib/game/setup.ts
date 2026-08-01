export const DEFAULT_INITIAL_HEALTH = 40;
export const MIN_INITIAL_HEALTH = 1;
export const MAX_INITIAL_HEALTH = 999;

export function isValidInitialHealth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_INITIAL_HEALTH &&
    value <= MAX_INITIAL_HEALTH
  );
}

export function normalizeInitialHealth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_INITIAL_HEALTH;
  }
  return Math.min(
    MAX_INITIAL_HEALTH,
    Math.max(MIN_INITIAL_HEALTH, Math.round(value)),
  );
}

export function parseInitialHealthInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return isValidInitialHealth(parsed) ? parsed : null;
}
