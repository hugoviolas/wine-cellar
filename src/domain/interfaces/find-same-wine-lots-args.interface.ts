import type { DbOrTx } from '../../db/client';
import type { BottleRow } from '../../db/rows';

export interface FindSameWineLotsArgs {
  readonly db: DbOrTx;
  readonly bottle: BottleRow;
  readonly crateIds: readonly string[];
}
