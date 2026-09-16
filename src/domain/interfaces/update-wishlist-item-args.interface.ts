import type { Db } from '../../db/client';
import type { UpdateWishlistItemInput } from './update-wishlist-item-input.interface';

export interface UpdateWishlistItemArgs {
  readonly db: Db;
  readonly id: string;
  readonly input: UpdateWishlistItemInput;
}
