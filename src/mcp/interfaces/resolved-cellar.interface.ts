import type { CellarRow } from '@/db/rows';
import type { CellarRole } from '@/domain/access';

export interface ResolvedCellar {
  readonly cellar: CellarRow;
  readonly role: CellarRole;
}
