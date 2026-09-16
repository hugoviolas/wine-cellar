import type { Db } from '../../db/client';

export interface GetMembershipByIdArgs {
  readonly db: Db;
  readonly membershipId: string;
}
