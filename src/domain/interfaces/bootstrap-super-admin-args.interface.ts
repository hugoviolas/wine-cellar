import type { BootstrapParams } from './bootstrap-params.interface';
import type { Db } from '../../db/client';

export interface BootstrapSuperAdminArgs {
  readonly db: Db;
  readonly params: BootstrapParams;
}
