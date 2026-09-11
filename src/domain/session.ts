import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId?: string;
  /**
   * Date d'émission ISO, posée à chaque ouverture de session (connexion,
   * inscription, acceptation d'invitation). Comparée à
   * `users.sessionsValidFrom` pour refuser une session antérieure à une
   * réinitialisation de mot de passe — voir domain/sessionValidity.ts.
   */
  issuedAt?: string;
}

/** Durée de vie d'une session, en secondes. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

/**
 * Vérifiée à l'appel (pas au chargement du module) : `next build` importe
 * les fichiers de route pour en analyser les pages, sans qu'un `.env` avec
 * un vrai SESSION_SECRET soit forcément présent à ce moment (par exemple
 * dans une image Docker, où `.env` n'entre délibérément pas dans le build).
 * Une vérification au chargement du module ferait échouer le build lui-même
 * plutôt que d'attendre le premier accès réel à une session.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET doit être défini dans .env avec au moins 32 caractères (voir .env.example).',
    );
  }
  return secret;
}

/**
 * Un cookie `Secure` n'est jamais stocké par le navigateur sur une connexion
 * non chiffrée — or `NODE_ENV` vaut toujours "production" une fois l'image
 * buildée, que le déploiement soit servi en HTTPS (prod, derrière le tunnel
 * Cloudflare — le navigateur ne voit que du HTTPS jusqu'à Cloudflare, même
 * si le tunnel relaie ensuite en HTTP en interne) ou en HTTP simple
 * (préprod, LAN uniquement, sans tunnel). D'où `COOKIE_SECURE`, explicite
 * par environnement plutôt que déduit de `NODE_ENV` : `false` en préprod,
 * sinon le comportement historique (vrai en production) reste le défaut.
 */
function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

export async function getSession(): Promise<IronSession<SessionData>> {
  // `ttl` autant que `cookieOptions.maxAge` : le premier borne la validité
  // du sceau chiffré, le second la durée de conservation du cookie par le
  // navigateur. iron-session ne déduit pas l'un de l'autre — fournir
  // `maxAge` seul laissait le `ttl` à son défaut de 14 jours, et la session
  // expirait donc bien avant les 90 jours annoncés par le cookie.
  const sessionOptions = {
    password: getSessionSecret(),
    cookieName: 'cave_session',
    ttl: SESSION_TTL_SECONDS,
    cookieOptions: {
      secure: isCookieSecure(),
      maxAge: SESSION_TTL_SECONDS,
    },
  };
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
