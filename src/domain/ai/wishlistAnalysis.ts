import { eq } from 'drizzle-orm';
import { wishlistItems } from '../../db/schema';
import { buildAiAnalysisPatch } from './analysisPatch';
import type { BottleAnalysisInput } from './bottleAnalysis';
import type { WishlistItemForAi } from './interfaces/wishlist-item-for-ai.interface';
import type { WishlistItemForAiSave } from './interfaces/wishlist-item-for-ai-save.interface';
import type { SaveWishlistAiAnalysisArgs } from './interfaces/save-wishlist-ai-analysis-args.interface';

export type { WishlistItemForAi, WishlistItemForAiSave };

export const toBottleAnalysisInput = (item: WishlistItemForAi): BottleAnalysisInput => {
  return {
    name: item.name,
    producer: item.producer,
    vintage: item.vintage,
    category: item.category,
    region: item.region,
    subRegion: item.subRegion,
    color: item.color,
    grapeVarieties: item.grapeVarieties,
    appellation: item.appellation,
  };
};

/**
 * Mêmes règles d'écrasement que `saveBottleAiAnalysis`, dont c'est le
 * pendant pour la wishlist : les quatre champs `ai*` sont toujours
 * réécrits, y compris à la régénération, tandis que `drinkFrom`,
 * `drinkUntil`, les cépages et l'appellation ne sont remplis que s'ils sont
 * vides — ce que tu as saisi à la main ne doit jamais être écrasé par une
 * génération. `region` et `subRegion` sont l'exception documentée dans
 * `buildAiAnalysisPatch` : ils sont résolus, pas remplis.
 */
export const saveWishlistAiAnalysis = async ({
  db,
  item,
  analysis,
}: SaveWishlistAiAnalysisArgs): Promise<void> => {
  const patch = buildAiAnalysisPatch({ target: item, analysis });
  await db.update(wishlistItems).set(patch).where(eq(wishlistItems.id, item.id));
};
