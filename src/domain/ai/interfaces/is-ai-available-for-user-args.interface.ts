import type { Db } from '../../../db/client';

export interface IsAiAvailableForUserArgs {
  readonly db: Db;
  readonly userId: string;
}
