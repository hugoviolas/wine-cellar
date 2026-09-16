import type { Db } from '../../db/client';

export interface SetUserSuperAdminArgs {
  readonly db: Db;
  readonly userId: string;
  readonly isSuperAdmin: boolean;
}
