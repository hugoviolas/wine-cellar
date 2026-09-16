export interface RateLimitRule {
  /** Nombre de tentatives autorisées par fenêtre. */
  readonly limit: number;
  /** Durée de la fenêtre, en millisecondes. */
  readonly windowMs: number;
}
