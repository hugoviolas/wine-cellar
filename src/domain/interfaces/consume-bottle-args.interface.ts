import type { ConsumeBottleInput } from './consume-bottle-input.interface';
import type { Db } from '../../db/client';

export interface ConsumeBottleArgs {
  readonly db: Db;
  readonly input: ConsumeBottleInput;
}
