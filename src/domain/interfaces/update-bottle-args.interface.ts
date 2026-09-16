import type { Db } from '../../db/client';
import type { UpdateBottleInput } from './update-bottle-input.interface';

export interface UpdateBottleArgs {
  readonly db: Db;
  readonly bottleId: string;
  readonly input: UpdateBottleInput;
}
