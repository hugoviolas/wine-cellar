import { checkRateLimit, clientKeyFromHeaders, resetRateLimit } from './rateLimit';
import type { LoginRateLimitArgs } from './interfaces/login-rate-limit-args.interface';
import type { RateLimitResult } from './interfaces/rate-limit-result.interface';
import type { LoginRateLimitKeys } from './interfaces/login-rate-limit-keys.interface';

/**
 * Deux seaux distincts : par IP (limite un attaquant unique qui balaie
 * plusieurs comptes) et par email visé (limite une attaque distribuée sur
 * un seul compte, où chaque requête vient d'une IP différente). bcrypt en
 * coût 12 ralentit déjà chaque essai, mais ne borne pas leur nombre.
 *
 * Partagés par tout ce qui vérifie un mot de passe — la connexion à l'app
 * et l'autorisation d'une application tierce (voir api/oauth/authorize) :
 * des seaux séparés doubleraient le nombre d'essais offerts à un attaquant.
 */
const PER_IP = { limit: 10, windowMs: 5 * 60 * 1000 };
const PER_EMAIL = { limit: 5, windowMs: 5 * 60 * 1000 };

const keysFor = ({ headers, email }: LoginRateLimitArgs): LoginRateLimitKeys => {
  return {
    ipKey: `login:ip:${clientKeyFromHeaders(headers)}`,
    emailKey: `login:email:${email.toLowerCase()}`,
  };
};

/** Compte une tentative ; refusée dès que l'un des deux seaux est plein. */
export const checkLoginRateLimit = (args: LoginRateLimitArgs): RateLimitResult => {
  const { ipKey, emailKey } = keysFor(args);
  const ipLimit = checkRateLimit({ key: ipKey, rule: PER_IP });
  if (!ipLimit.allowed) {
    return ipLimit;
  }
  return checkRateLimit({ key: emailKey, rule: PER_EMAIL });
};

/**
 * Les seaux ne comptent que les échecs : une connexion réussie les libère,
 * sinon quiconque connaît une adresse pouvait saturer son seau et bloquer
 * son propriétaire pendant toute la fenêtre.
 */
export const clearLoginRateLimit = (args: LoginRateLimitArgs): void => {
  const { ipKey, emailKey } = keysFor(args);
  resetRateLimit(ipKey);
  resetRateLimit(emailKey);
};
