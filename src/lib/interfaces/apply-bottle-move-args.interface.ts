import type { MoveBottlesResult } from '@/domain/interfaces/move-bottles-result.interface';

export interface ApplyBottleMoveArgs<T extends { readonly id: string; readonly quantity: number }> {
  readonly bottlesByCrate: Readonly<Record<string, readonly T[]>>;
  readonly bottle: T;
  readonly fromCrateId: string;
  readonly toCrateId: string;
  readonly quantity: number;
  readonly result: MoveBottlesResult;
}
