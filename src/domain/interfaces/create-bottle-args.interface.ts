import type { CreateBottleInput } from './create-bottle-input.interface';
import type { DbOrTx } from '../../db/client';

export interface CreateBottleArgs {
  readonly db: DbOrTx;
  readonly input: CreateBottleInput;
}
