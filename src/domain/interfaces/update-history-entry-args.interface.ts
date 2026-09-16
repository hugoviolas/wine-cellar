import type { Db } from '../../db/client';
import type { UpdateHistoryEntryInput } from '../history';

export interface UpdateHistoryEntryArgs {
  readonly db: Db;
  readonly entryId: string;
  readonly input: UpdateHistoryEntryInput;
}
