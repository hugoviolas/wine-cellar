/** Lot d'un vin dans une clayette donnée, tel qu'affiché dans la liste des vins. */
export interface WineListLot {
  readonly id: string;
  readonly crateLabel: string;
  readonly quantity: number;
}
