import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { wishlistItems } from '../../db/schema';
import { parseBottleDetails, type BottleCategory } from '../bottleCategories';
import type { AiBottleAnalysis } from './schemas';
import type { BottleAnalysisInput } from './bottleAnalysis';

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
  color: string | null;
  grapeVarieties: string[];
  appellation: string | null;
}

export function toBottleAnalysisInput(item: WishlistItemForAi): BottleAnalysisInput {
  return {
    name: item.name,
    producer: item.producer,
    vintage: item.vintage,
    category: item.category,
    region: item.region,
    color: item.color,
    grapeVarieties: item.grapeVarieties,
    appellation: item.appellation,
  };
}

export interface WishlistItemForAiSave {
  id: string;
  category: BottleCategory;
  drinkFrom: number | null;
  drinkUntil: number | null;
  region: string | null;
  details: unknown;
}

/**
 * Mêmes règles d'écrasement que `saveBottleAiAnalysis`, dont c'est le
 * pendant pour la wishlist : les quatre champs `ai*` sont toujours
 * réécrits, y compris à la régénération, tandis que `drinkFrom`,
 * `drinkUntil`, `region`, les cépages et l'appellation ne sont remplis que
 * s'ils sont vides — ce que tu as saisi à la main ne doit jamais être
 * écrasé par une génération.
 */
export async function saveWishlistAiAnalysis(
  db: Db,
  item: WishlistItemForAiSave,
  analysis: AiBottleAnalysis,
): Promise<void> {
  const set: {
    aiAnalysis: string;
    aiPairings: string[];
    aiTastingAdvice: string;
    aiGeneratedAt: string;
    drinkFrom?: number;
    drinkUntil?: number;
    region?: string;
    details?: unknown;
  } = {
    aiAnalysis: analysis.analysis,
    aiPairings: analysis.pairings,
    aiTastingAdvice: analysis.tastingAdvice,
    aiGeneratedAt: new Date().toISOString(),
  };
  if (item.drinkFrom === null && analysis.drinkFromYear !== null) set.drinkFrom = analysis.drinkFromYear;
  if (item.drinkUntil === null && analysis.drinkUntilYear !== null) set.drinkUntil = analysis.drinkUntilYear;
  if (item.region === null && analysis.region !== null) set.region = analysis.region;

  if (item.category === 'wine' || item.category === 'sparkling') {
    let details = parseBottleDetails(item.category, item.details);
    let detailsChanged = false;
    if (details.grapeVarieties.length === 0 && analysis.grapeVarieties && analysis.grapeVarieties.length > 0) {
      details = { ...details, grapeVarieties: analysis.grapeVarieties };
      detailsChanged = true;
    }
    if (item.category === 'wine') {
      const wineDetails = details as ReturnType<typeof parseBottleDetails<'wine'>>;
      if (!wineDetails.appellation && analysis.appellation) {
        details = { ...wineDetails, appellation: analysis.appellation };
        detailsChanged = true;
      }
    }
    if (detailsChanged) set.details = details;
  }

  await db.update(wishlistItems).set(set).where(eq(wishlistItems.id, item.id));
}
