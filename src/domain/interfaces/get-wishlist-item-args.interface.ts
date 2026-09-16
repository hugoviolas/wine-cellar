import type { Db } from '../../db/client';

export interface GetWishlistItemArgs {
  readonly db: Db;
  readonly id: string;
}
