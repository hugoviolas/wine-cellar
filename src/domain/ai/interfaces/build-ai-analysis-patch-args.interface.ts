import type { AiAnalysisTarget } from './ai-analysis-target.interface';
import type { AiBottleAnalysis } from '../schemas';

export interface BuildAiAnalysisPatchArgs {
  readonly target: AiAnalysisTarget;
  readonly analysis: AiBottleAnalysis;
}
