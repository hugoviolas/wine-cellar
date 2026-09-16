import type { Db } from '../../db/client';

export interface ResolveWishlistItemAccessArgs {
  readonly db: Db;
  readonly userId: string;
  readonly itemId: string;
}
