export interface RequestBottleMoveArgs {
  readonly bottleId: string;
  readonly crateId: string;
  /** Absent = tout le stock. */
  readonly quantity?: number;
}
