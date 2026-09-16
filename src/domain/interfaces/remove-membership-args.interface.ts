import type { Db } from '../../db/client';

export interface RemoveMembershipArgs {
  readonly db: Db;
  readonly membershipId: string;
}
