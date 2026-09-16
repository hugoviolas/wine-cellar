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

/**
 * Libère une clé. Sert après une authentification réussie : sans ça, le
 * seau par email comptait toutes les tentatives, y compris les bonnes —
 * connaître une adresse suffisait donc à empêcher son propriétaire de se
 * connecter pendant toute la fenêtre. Seuls les échecs doivent compter.
 */
export const resetRateLimit = (key: string): void => {
  buckets.delete(key);
};

/** Réinitialise l'état complet du limiteur — réservé aux tests. */
export const resetRateLimits = (): void => {
  buckets.clear();
};

/**
 * Adresse du client, telle qu'on peut raisonnablement lui faire confiance.
 *
 * `cf-connecting-ip` d'abord : en production le seul chemin d'entrée est le
 * tunnel Cloudflare, qui réécrit cet en-tête à chaque requête et empêche
 * donc de l'usurper.
 *
 * `x-forwarded-for` seulement si le déploiement déclare `TRUST_FORWARDED_FOR`.
 * Cet en-tête n'est qu'une chaîne posée par le client : sans un proxy en
 * amont qui le réécrive, n'importe qui pouvait en changer à chaque requête
 * et s'offrir un seau neuf à volonté — le limiteur ne protégeait alors plus
 * rien sur tout déploiement joignable directement (la préprod sur le LAN).
 *
 * Sans en-tête digne de foi, clé constante : un seau partagé limite tout le
 * monde ensemble, ce qui est moins précis mais reste une limite, alors
 * qu'une clé usurpable n'en est pas une.
 */
export const clientKeyFromHeaders = (headers: Headers): string => {
  const cloudflareIp = headers.get('cf-connecting-ip');
  if (cloudflareIp) {
    return cloudflareIp.trim();
  }
  if (process.env.TRUST_FORWARDED_FOR === 'true') {
    const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
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
