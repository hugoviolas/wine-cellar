/**
 * Libellé affiché d'une clayette. Sans nom (`null`), affiche seulement
 * « Clayette N » — jamais « Clayette N — Clayette N », d'où le calcul ici
 * plutôt qu'un nom par défaut stocké en base.
 */
export function crateLabel(number: number, name: string | null): string {
  return name ? `Clayette ${number} — ${name}` : `Clayette ${number}`;
}
