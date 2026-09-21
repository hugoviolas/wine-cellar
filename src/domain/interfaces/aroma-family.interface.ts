import type { WineShade } from './wine-shade.type';

/**
 * Une famille d'arômes et ses exemples, par couleur de vin.
 *
 * `null` quand la réglette n'en donne aucun pour cette couleur — le cas des
 * « autres arômes » en rosé. C'est une absence de la source, pas un trou à
 * combler.
 */
export interface AromaFamily {
  readonly family: string;
  readonly examples: Readonly<Record<WineShade, string | null>>;
}
