import type { Db } from '../../db/client';

export interface DeleteCellarCascadeArgs {
  readonly db: Db;
  readonly cellarId: string;
}
