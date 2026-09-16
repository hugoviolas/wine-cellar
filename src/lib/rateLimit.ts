import type { RateLimitBucket } from './interfaces/rate-limit-bucket.interface';
import type { RateLimitResult } from './interfaces/rate-limit-result.interface';
import type { RateLimitRule } from './interfaces/rate-limit-rule.interface';

/**
 * Limiteur de débit en mémoire, par fenêtre fixe. Suffisant ici : l'app
 * tourne en un seul conteneur (voir docker-compose.prod.yml), donc un état
 * partagé externe (Redis…) n'apporterait rien — et repartir de zéro à
 * chaque redémarrage est acceptable pour ce que ça protège (les routes
 * d'authentification publiques, pas un quota de facturation).
 */
const buckets = new Map<string, RateLimitBucket>();

export const checkRateLimit = (
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult => {
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
};

/** Réinitialise l'état du limiteur — réservé aux tests. */
export const resetRateLimits = (): void => {
  buckets.clear();
};

/**
 * Adresse du client. `cf-connecting-ip` d'abord : en production le seul
 * chemin d'entrée est le tunnel Cloudflare, qui réécrit cet en-tête et
 * empêche donc de l'usurper. `x-forwarded-for` ensuite pour un éventuel
 * reverse-proxy local, puis une clé constante en dernier recours (préprod
 * sur le LAN, accès direct) : un seau partagé limite alors tout le monde
 * ensemble, ce qui est plus sûr que de ne rien limiter du tout.
 */
export const clientKeyFromHeaders = (headers: Headers): string => {
  const cloudflareIp = headers.get('cf-connecting-ip');
  if (cloudflareIp) {
    return cloudflareIp.trim();
  }
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return 'unknown';
};

/**
 * Purge les fenêtres expirées. Appelée à chaque vérification plutôt que sur
 * un timer : sans ça, une attaque distribuée ferait grossir la Map
 * indéfiniment (une entrée par IP vue), alors que ces entrées ne servent
 * plus à rien une fois leur fenêtre passée.
 */
const evictExpired = (now: number): void => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};
