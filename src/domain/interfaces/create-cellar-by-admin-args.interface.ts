import type { CreateCellarInput } from './create-cellar-input.interface';
import type { Db } from '../../db/client';

export interface CreateCellarByAdminArgs {
  readonly db: Db;
  readonly input: CreateCellarInput;
}
