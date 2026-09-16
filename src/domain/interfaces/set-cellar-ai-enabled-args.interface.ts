import type { Db } from '../../db/client';

export interface SetCellarAiEnabledArgs {
  readonly db: Db;
  readonly cellarId: string;
  readonly aiEnabled: boolean;
}
