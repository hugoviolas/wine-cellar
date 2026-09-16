import type { Db } from '../../db/client';
import type { UpdateCellarInfoInput } from './update-cellar-info-input.interface';

export interface UpdateCellarInfoArgs {
  readonly db: Db;
  readonly cellarId: string;
  readonly input: UpdateCellarInfoInput;
}
