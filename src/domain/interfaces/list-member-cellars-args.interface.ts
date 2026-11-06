import type { DbOrTx } from '../../db/client';

export interface ListMemberCellarsArgs {
  db: DbOrTx;
  userId: string;
}
