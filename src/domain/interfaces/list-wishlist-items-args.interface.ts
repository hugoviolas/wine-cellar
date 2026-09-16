import type { Db } from '../../db/client';

export interface ListWishlistItemsArgs {
  readonly db: Db;
  readonly userId: string;
}
