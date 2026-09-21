import type { MapPlace } from './map-place.interface';

/** Un lieu déjà projeté dans le repère SVG de la carte, avec le rayon de son point. */
export interface MapPoint {
  readonly place: MapPlace;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}
