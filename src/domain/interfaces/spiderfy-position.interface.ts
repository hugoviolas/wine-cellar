import type { MapPoint } from './map-point.interface';

/** Position d'un point une fois la grappe dépliée en étoile. */
export interface SpiderfyPosition {
  readonly point: MapPoint;
  readonly x: number;
  readonly y: number;
}
