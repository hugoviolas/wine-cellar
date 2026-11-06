export interface ConsumptionView {
  entry_id: string;
  /** Bouteille d'origine, si elle existe encore dans une cave. */
  bottle_id: string | null;
  consumed_at: string;
  quantity: number;
  rating: number | null;
  comment: string | null;
  occasion: string | null;
  /** Vrai si c'est l'utilisateur connecté qui a enregistré la consommation. */
  by_me: boolean;
  /** Bouteille telle qu'elle était au moment de la consommation. */
  name: string;
  producer: string | null;
  vintage: number | null;
  category: string;
}
