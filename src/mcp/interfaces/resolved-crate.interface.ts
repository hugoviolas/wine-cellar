import type { CrateRow } from '@/db/rows';
import type { CellarRole } from '@/domain/access';

export interface ResolvedCrate {
  readonly crate: CrateRow;
  readonly role: CellarRole;
}
