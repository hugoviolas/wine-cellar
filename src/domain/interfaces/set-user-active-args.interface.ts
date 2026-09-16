import type { Db } from '../../db/client';

export interface SetUserActiveArgs {
  readonly db: Db;
  readonly userId: string;
  readonly isActive: boolean;
}
