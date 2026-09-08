export const WINE_COLOR_LABELS: Record<string, string> = {
  rouge: 'Rouge',
  blanc: 'Blanc',
  rose: 'Rosé',
  autre: 'Autre',
};

const WINE_COLOR_STRIPE: Record<string, string> = {
  rouge: 'border-l-4 border-l-[#7a2331]',
  blanc: 'border-l-4 border-l-[#d4af37]',
  rose: 'border-l-4 border-l-[#e0a3ad]',
  autre: 'border-l-4 border-l-gray-400',
};

/** Tailwind classes for a colored side stripe matching a wine's `color` field, or empty if none/unset. */
export function wineColorStripeClass(color: string | null): string {
  if (!color) return '';
  return WINE_COLOR_STRIPE[color] ?? '';
}

const WINE_COLOR_DOT: Record<string, string> = {
  rouge: 'bg-[#7a2331]',
  blanc: 'bg-[#d4af37]',
  rose: 'bg-[#e0a3ad]',
  autre: 'bg-gray-400',
};

/** Tailwind background class for a small color marker (ex. une puce de bouteille), gris clair si couleur inconnue. */
export function wineColorDotClass(color: string | null): string {
  if (!color) return 'bg-gray-200';
  return WINE_COLOR_DOT[color] ?? 'bg-gray-200';
}
