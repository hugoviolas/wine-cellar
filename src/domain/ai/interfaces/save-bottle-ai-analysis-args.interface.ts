import type { AiBottleAnalysis } from '../schemas';
import type { BottleForAiSave } from './bottle-for-ai-save.interface';
import type { Db } from '../../../db/client';

export interface SaveBottleAiAnalysisArgs {
  readonly db: Db;
  readonly bottle: BottleForAiSave;
  readonly analysis: AiBottleAnalysis;
}
