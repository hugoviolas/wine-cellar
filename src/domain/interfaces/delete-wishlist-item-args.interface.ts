import type { Db } from '../../db/client';

export interface DeleteWishlistItemArgs {
  readonly db: Db;
  readonly id: string;
}
