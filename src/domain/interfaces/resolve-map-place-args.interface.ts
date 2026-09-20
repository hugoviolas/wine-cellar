import type { MapPrecision } from '../wineMap';

export interface ResolveMapPlaceArgs {
  readonly region: string | null;
  readonly subRegion: string | null;
  readonly precision: MapPrecision;
}
