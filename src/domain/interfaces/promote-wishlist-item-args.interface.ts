import type { Db } from '../../db/client';
import type { WishlistItemRow } from '../../db/rows';

export interface PromoteWishlistItemArgs {
  readonly db: Db;
  readonly item: WishlistItemRow;
  readonly input: { crateId: string; quantity: number };
}
