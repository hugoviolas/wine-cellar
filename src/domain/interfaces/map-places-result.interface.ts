import type { BottleForMap } from './bottle-for-map.interface';
import type { MapPlace } from './map-place.interface';

export interface MapPlacesResult {
  /** Lieux à afficher, du plus fourni au moins fourni. */
  readonly places: MapPlace[];
  /** Bouteilles qu'aucune coordonnée ne permet de placer (vin étranger, région hors table). */
  readonly unlocated: BottleForMap[];
}
