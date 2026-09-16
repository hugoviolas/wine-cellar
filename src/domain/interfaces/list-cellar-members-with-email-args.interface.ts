import type { Db } from '../../db/client';

export interface ListCellarMembersWithEmailArgs {
  readonly db: Db;
  readonly cellarId: string;
}
