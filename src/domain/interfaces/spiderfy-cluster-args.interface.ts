import type { MapCluster } from './map-cluster.interface';

export interface SpiderfyClusterArgs {
  readonly cluster: MapCluster;
  /** Cadre de la carte (le `viewBox`), pour qu'aucune branche n'en sorte. */
  readonly bounds: { readonly width: number; readonly height: number };
  /** Marge entre deux disques dépliés, et entre un disque et le bord. */
  readonly gap: number;
}
