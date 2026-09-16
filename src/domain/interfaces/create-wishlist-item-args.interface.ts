import type { CreateWishlistItemInput } from './create-wishlist-item-input.interface';
import type { Db } from '../../db/client';

export interface CreateWishlistItemArgs {
  readonly db: Db;
  readonly input: CreateWishlistItemInput;
}
