import type { Db } from '../../db/client';

export interface DeleteHistoryEntryArgs {
  readonly db: Db;
  readonly entryId: string;
}
