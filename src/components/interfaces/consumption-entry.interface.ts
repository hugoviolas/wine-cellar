/**
 * Une consommation telle que la fiche bouteille l'affiche. Volontairement
 * plus étroite que `ConsumptionHistoryRow` : les champs « snapshot » (nom,
 * producteur, millésime figés à la consommation) n'ont rien à y faire —
 * on est déjà sur la fiche de cette bouteille, ils y seraient redondants.
 */
export interface ConsumptionEntry {
  readonly id: string;
  readonly consumedAt: string;
  readonly quantity: number;
  readonly rating: number | null;
  readonly occasion: string | null;
  readonly comment: string | null;
}
