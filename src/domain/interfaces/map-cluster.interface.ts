import type { MapPoint } from './map-point.interface';

/**
 * Une grappe de points qui se chevauchent, rendue comme un seul disque.
 * Une grappe d'un seul point reste une grappe : le rendu n'a ainsi qu'un
 * seul cas à traiter.
 */
export interface MapCluster {
  /** Clé stable, dérivée du lieu le plus fourni de la grappe. */
  readonly key: string;
  /** Lieux de la grappe, du plus fourni au moins fourni. */
  readonly points: readonly MapPoint[];
  /** Somme des bouteilles de la grappe. */
  readonly bottles: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}
