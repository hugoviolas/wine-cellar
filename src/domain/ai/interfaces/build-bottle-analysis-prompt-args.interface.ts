import type { BottleAnalysisInput } from './bottle-analysis-input.interface';

export interface BuildBottleAnalysisPromptArgs {
  readonly bottle: BottleAnalysisInput;
  readonly currentYear: number;
}
