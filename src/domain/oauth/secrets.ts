import { createHash, timingSafeEqual } from 'node:crypto';
import type { VerifyCodeVerifierArgs } from './interfaces/verify-code-verifier-args.interface';

/**
 * Comparaison en temps constant de deux chaînes : sans elle, la durée d'un
 * refus révèle combien de caractères du début étaient justes. Les longueurs
 * différentes sont refusées tout de suite — elles ne disent rien de plus
 * que ce que le format public des valeurs comparées dit déjà.
 */
export const constantTimeEquals = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Caractères autorisés dans un code_verifier, et sa longueur (RFC 7636 §4.1). */
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

/** Empreinte S256 : SHA-256 encodé en base64url sans remplissage, 43 caractères. */
export const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Vérification PKCE (RFC 7636), méthode S256 seule : `plain` n'apporte
 * rien contre l'interception du code, ce contre quoi PKCE existe.
 */
export const verifyCodeVerifier = ({ verifier, challenge }: VerifyCodeVerifierArgs): boolean => {
  if (!VERIFIER_PATTERN.test(verifier)) {
    return false;
  }
  const computed = createHash('sha256').update(verifier).digest('base64url');
  return constantTimeEquals(computed, challenge);
};
