export type GardeStatus = 'too_young' | 'ready' | 'closing_window' | 'unknown';

export function computeGardeStatus(
  drinkFrom: number | null,
  drinkUntil: number | null,
  currentYear: number,
): GardeStatus {
  if (drinkFrom == null || drinkUntil == null) return 'unknown';
  if (currentYear < drinkFrom) return 'too_young';
  if (currentYear >= drinkUntil - 2) return 'closing_window';
  return 'ready';
}

export function computeGardeProgress(
  vintage: number | null,
  drinkUntil: number | null,
  currentYear: number,
): number {
  if (vintage == null || drinkUntil == null || drinkUntil <= vintage) return 0;
  const fraction = (currentYear - vintage) / (drinkUntil - vintage);
  return Math.min(1, Math.max(0, fraction));
}
