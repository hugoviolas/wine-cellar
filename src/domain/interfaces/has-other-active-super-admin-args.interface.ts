import type { Db } from '../../db/client';

export interface HasOtherActiveSuperAdminArgs {
  readonly db: Db;
  readonly excludeUserId: string;
}
