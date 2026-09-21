import type { TastingCriterion } from './tasting-criterion.interface';

/** Une des quatre étapes du mémo, dans l'ordre où on les traverse. */
export interface TastingStep {
  readonly key: string;
  readonly label: string;
  readonly criteria: readonly TastingCriterion[];
}
