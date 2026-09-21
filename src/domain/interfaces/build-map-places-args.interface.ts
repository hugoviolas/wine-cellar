import type { BottleForMap } from './bottle-for-map.interface';
import type { MapPrecision } from '../wineMap';

export interface BuildMapPlacesArgs {
  readonly bottles: readonly BottleForMap[];
  readonly precision: MapPrecision;
}
