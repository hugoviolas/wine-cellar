import type { GardeStatus } from '../gardeStatus';
import type { WineListLot } from './wine-list-lot.interface';

/**
 * Une ligne de la liste des vins : un vin (voir `isSameWine`), toutes
 * clayettes confondues.
 */
export interface WineListEntry {
  /** Lot principal (le plus fourni), vers lequel pointe le nom. */
  readonly id: string;
  readonly name: string;
  readonly producer: string | null;
  readonly category: string;
  readonly color: string | null;
  readonly vintage: number | null;
  /** Total, tous lots confondus. */
  readonly quantity: number;
  readonly rating: number | null;
  readonly gardeStatus: GardeStatus;
  /** Entrée en cave la plus ancienne des lots. */
  readonly createdAt: string;
  /** Un lot par clayette, dans l'ordre des clayettes. */
  readonly lots: readonly WineListLot[];
}
