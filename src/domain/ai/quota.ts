import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import type { RateLimitRule } from '@/lib/interfaces/rate-limit-rule.interface';

/**
 * Quota d'appels IA par utilisateur.
 *
 * `isAiAvailable` dit *si* l'IA est permise pour une cave, jamais *combien*
 * de fois : sans ce plafond, tout compte ayant accès à une cave où l'IA est
 * activée pouvait enchaîner les appels — chacun portant jusqu'à 5 Mo
 * d'image — sur la clé API partagée, sans autre limite que sa patience.
 * C'est le seul endroit de l'app où une action d'utilisateur coûte de
 * l'argent à chaque exécution.
 *
 * Deux fenêtres plutôt qu'une : l'horaire absorbe une rafale accidentelle
 * (photos en série, régénérations successives) sans gêner un usage normal,
 * la journalière borne ce qu'une même personne peut dépenser au total,
 * quelle que soit la façon dont elle étale ses appels.
 */
const PER_HOUR: RateLimitRule = { limit: 20, windowMs: 60 * 60 * 1000 };
const PER_DAY: RateLimitRule = { limit: 100, windowMs: 24 * 60 * 60 * 1000 };

/**
 * `null` si l'appel peut avoir lieu, sinon la réponse à renvoyer tel quel.
 * Vérifié avant l'appel au modèle, jamais après : le but est justement de
 * ne pas le déclencher.
 */
export const checkAiQuota = (userId: string, now: number = Date.now()): NextResponse | null => {
  const hourly = checkRateLimit(`ai:hour:${userId}`, PER_HOUR, now);
  if (!hourly.allowed) {
    return quotaExceeded(hourly.retryAfterSeconds);
  }
  const daily = checkRateLimit(`ai:day:${userId}`, PER_DAY, now);
  if (!daily.allowed) {
    return quotaExceeded(daily.retryAfterSeconds);
  }
  return null;
};

const quotaExceeded = (retryAfterSeconds: number): NextResponse => {
  return NextResponse.json(
    { error: 'Quota d’analyses IA atteint. Réessaie un peu plus tard.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
};
