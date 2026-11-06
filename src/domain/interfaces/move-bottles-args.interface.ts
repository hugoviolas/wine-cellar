import type { Db } from '../../db/client';

export interface MoveBottlesArgs {
  readonly db: Db;
  readonly bottleId: string;
  readonly toCrateId: string;
  /** Nombre de bouteilles à déplacer ; absent = tout le stock. */
  readonly quantity?: number;
}
