/** Fenêtre courante d'une clé : son compteur et l'instant où elle expire. */
export interface RateLimitBucket {
  count: number;
  readonly resetAt: number;
}
