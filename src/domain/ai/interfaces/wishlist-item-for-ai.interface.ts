/**
 * Un item de wishlist porte exactement les champs dont
 * `buildBottleAnalysisPrompt` a besoin — on réutilise donc le prompt des
 * bouteilles tel quel, sans en écrire un second. Volontaire : c'est ce qui
 * permet de reverser l'analyse à la promotion (voir promoteWishlistItem)
 * plutôt que de repayer un appel à l'IA sur la bouteille créée.
 *
 * Le contenu reste pertinent avant achat — la fenêtre de garde surtout,
 * qui est un vrai critère de décision. Un prompt dédié « conseil d'achat »
 * a été écarté : ce qui déciderait vraiment (prix, disponibilité) est
 * précisément ce que le modèle ne sait pas et inventerait.
 */
export interface WishlistItemForAi {
  name: string;
  producer: string | null;
  vintage: number | null;
  category: string;
  region: string | null;
  subRegion: string | null;
  color: string | null;
  grapeVarieties: string[];
  appellation: string | null;
}
