export interface MoveBottlesResult {
  /** Lot qui contient désormais les bouteilles déplacées, dans la clayette cible. */
  readonly bottleId: string;
  /** `true` si elles ont rejoint un lot du même vin déjà présent. */
  readonly merged: boolean;
}
