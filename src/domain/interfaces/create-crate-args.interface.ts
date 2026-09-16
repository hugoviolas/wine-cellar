import type { CreateCrateInput } from './create-crate-input.interface';
import type { Db } from '../../db/client';

export interface CreateCrateArgs {
  readonly db: Db;
  readonly input: CreateCrateInput;
}
