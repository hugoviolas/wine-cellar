import type { ToolContext } from './tool-context.interface';

export interface ResolveCellarArgs {
  context: ToolContext;
  /** Cave demandée ; absente, la cave par défaut de l'utilisateur. */
  cellarId: string | undefined;
}
