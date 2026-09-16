import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from './interfaces/session-data.interface';

export type { SessionData };

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
const getSessionSecret = (): string => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET doit être défini dans .env avec au moins 32 caractères (voir .env.example).',
    );
  }
  return secret;
};

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
const isCookieSecure = (): boolean => {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
};

export const getSession = async (): Promise<IronSession<SessionData>> => {
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
      // `httpOnly` et `sameSite` explicites, bien qu'ils correspondent aux
      // défauts d'iron-session : ce sont les deux protections qui font que
      // le cookie reste hors de portée d'un script de page et d'un POST
      // venu d'un autre site. Les laisser implicites, c'est les confier à
      // une valeur par défaut qu'une montée de version peut changer sans
      // que rien ici ne le signale — or `proxy.ts` s'appuie sur
      // `sameSite: 'lax'` dans son propre raisonnement.
      httpOnly: true,
      sameSite: 'lax' as const,
    },
  };
  return getIronSession<SessionData>(await cookies(), sessionOptions);
};
