/**
 * Limiteur de débit en mémoire, par fenêtre fixe. Suffisant ici : l'app
 * tourne en un seul conteneur (voir docker-compose.prod.yml), donc un état
 * partagé externe (Redis…) n'apporterait rien — et repartir de zéro à
 * chaque redémarrage est acceptable pour ce que ça protège (les routes
 * d'authentification publiques, pas un quota de facturation).
 */
export interface RateLimitRule {
  /** Nombre de tentatives autorisées par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en millisecondes. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Secondes avant que la fenêtre courante ne se réinitialise (0 si autorisé). */
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Purge les fenêtres expirées. Appelée à chaque vérification plutôt que sur
 * un timer : sans ça, une attaque distribuée ferait grossir la Map
 * indéfiniment (une entrée par IP vue), alors que ces entrées ne servent
 * plus à rien une fois leur fenêtre passée.
 */
function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitResult {
  evictExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > rule.limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Réinitialise l'état du limiteur — réservé aux tests. */
export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Adresse du client. `cf-connecting-ip` d'abord : en production le seul
 * chemin d'entrée est le tunnel Cloudflare, qui réécrit cet en-tête et
 * empêche donc de l'usurper. `x-forwarded-for` ensuite pour un éventuel
 * reverse-proxy local, puis une clé constante en dernier recours (préprod
 * sur le LAN, accès direct) : un seau partagé limite alors tout le monde
 * ensemble, ce qui est plus sûr que de ne rien limiter du tout.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}
