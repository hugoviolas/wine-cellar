import type { AiAnalysisTarget } from './ai-analysis-target.interface';
import type { AiBottleAnalysis } from '../schemas';

export interface MergedDetailsArgs {
  readonly target: AiAnalysisTarget;
  readonly analysis: AiBottleAnalysis;
}
