import type { MapCoords } from './map-coords.interface';
import type { BottleForMap } from './bottle-for-map.interface';

/** Un point de la carte : un lieu viticole et les bouteilles qui s'y rattachent. */
export interface MapPlace {
  /** Clé stable, préfixée par le niveau — une sous-région et une région homonymes ne se confondent pas. */
  readonly key: string;
  readonly label: string;
  /** Région parente, renseignée seulement quand le lieu est une sous-région. */
  readonly parentRegion: string | null;
  readonly coords: MapCoords;
  /** Somme des quantités, pas le nombre de références. */
  bottles: number;
  wines: BottleForMap[];
}
