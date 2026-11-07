import type { DbOrTx } from '../../../db/client';

export interface GrantOwnerArgs {
  db: DbOrTx;
  userId: string;
  grantedAt: string;
}
