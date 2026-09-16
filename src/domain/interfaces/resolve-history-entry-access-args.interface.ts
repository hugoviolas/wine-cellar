import type { Db } from '../../db/client';

export interface ResolveHistoryEntryAccessArgs {
  readonly db: Db;
  readonly userId: string;
  readonly entryId: string;
}
