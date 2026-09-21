import type { WineShade } from './wine-shade.type';

/**
 * Un critère du mémo : son intitulé et les valeurs proposées.
 *
 * `values` vide veut dire que la réglette ne propose rien — c'est une ligne
 * à remplir de sa tête, pas un oubli.
 */
export interface TastingCriterion {
  readonly label: string;
  readonly values: readonly string[];
  /** Les valeurs vont du moins au plus : l'ordre porte du sens et se montre. */
  readonly ordered?: boolean;
  /** Ligne propre à une couleur de vin, mise de côté quand on en déguste une autre. */
  readonly shade?: WineShade;
  /** Les valeurs sont des teintes : chacune s'accompagne de sa pastille. */
  readonly hues?: boolean;
}
