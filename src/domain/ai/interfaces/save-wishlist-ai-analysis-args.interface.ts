import type { AiBottleAnalysis } from '../schemas';
import type { Db } from '../../../db/client';
import type { WishlistItemForAiSave } from './wishlist-item-for-ai-save.interface';

export interface SaveWishlistAiAnalysisArgs {
  readonly db: Db;
  readonly item: WishlistItemForAiSave;
  readonly analysis: AiBottleAnalysis;
}
