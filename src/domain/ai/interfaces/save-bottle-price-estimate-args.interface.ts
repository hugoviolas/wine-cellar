import type { Db } from '../../../db/client';
import type { AiPriceEstimate } from '../schemas';

export interface SaveBottlePriceEstimateArgs {
  readonly db: Db;
  readonly bottleId: string;
  /** `null` quand la recherche n'a pas trouvé de prix sourcé — un résultat, pas un échec. */
  readonly estimate: AiPriceEstimate | null;
  /** Instant du relevé — injecté par les tests, sinon maintenant. */
  readonly now?: Date;
}
