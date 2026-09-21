import type { MapPoint } from './map-point.interface';

export interface BuildMapClustersArgs {
  /** Points projetés, du plus fourni au moins fourni (l'ordre de `buildMapPlaces`). */
  readonly points: readonly MapPoint[];
  /** Rayon d'un disque pour un nombre de bouteilles donné — celui du rendu. */
  readonly radiusOf: (bottles: number) => number;
}
