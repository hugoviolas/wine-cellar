export interface RateLimitResult {
  readonly allowed: boolean;
  /** Secondes avant que la fenêtre courante ne se réinitialise (0 si autorisé). */
  readonly retryAfterSeconds: number;
}
