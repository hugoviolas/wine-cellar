export interface RunToolArgs {
  /** Nom du tool, pour les logs. */
  tool: string;
  work: () => Promise<unknown>;
}
