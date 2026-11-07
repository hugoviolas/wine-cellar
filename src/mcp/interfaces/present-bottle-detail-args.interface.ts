import type { ConsumptionHistoryRow } from '@/db/rows';
import type { CellarRole } from '@/domain/access';
import type { PresentBottleArgs } from './present-bottle-args.interface';

export interface PresentBottleDetailArgs extends PresentBottleArgs {
  role: CellarRole;
  /** Consommations à joindre ; absentes, la fiche n'en parle pas. */
  consumptions?: readonly ConsumptionHistoryRow[];
  /** Utilisateur connecté, pour `by_me`. */
  userId: string;
}
