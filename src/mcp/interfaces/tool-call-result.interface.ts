export interface ToolCallResult {
  isError: boolean;
  /** Texte brut de la réponse (message d'erreur, ou JSON). */
  text: string;
}
