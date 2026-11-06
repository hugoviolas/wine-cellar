import type { Db } from '../../db/client';

export interface CheckCrateMoveArgs {
  db: Db;
  fromCrateId: string;
  toCrateId: string;
}
