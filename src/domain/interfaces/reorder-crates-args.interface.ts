import type { Db } from '../../db/client';

export interface ReorderCratesArgs {
  readonly db: Db;
  readonly cellarId: string;
  readonly orderedIds: string[];
}
