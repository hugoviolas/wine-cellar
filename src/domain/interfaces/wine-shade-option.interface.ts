import type { WineShade } from './wine-shade.type';

/** Une couleur de vin telle qu'elle s'affiche dans le filtre et les en-têtes. */
export interface WineShadeOption {
  readonly key: WineShade;
  /** « Blanc », pour le filtre. */
  readonly label: string;
  /** « Vins blancs », pour l'en-tête du tableau d'arômes. */
  readonly plural: string;
  readonly dot: string;
}
