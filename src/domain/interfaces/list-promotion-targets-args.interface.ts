import type { Db } from '../../db/client';

export interface ListPromotionTargetsArgs {
  readonly db: Db;
  readonly userId: string;
}
