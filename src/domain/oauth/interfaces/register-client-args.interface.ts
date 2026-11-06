import type { Db } from '../../../db/client';
import type { RegisterClientInput } from './register-client-input.interface';

export interface RegisterClientArgs {
  db: Db;
  input: RegisterClientInput;
}
