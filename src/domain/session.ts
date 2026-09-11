import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId?: string;
}

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
  const sessionOptions = {
    password: getSessionSecret(),
    cookieName: 'cave_session',
    cookieOptions: {
      secure: isCookieSecure(),
      maxAge: 60 * 60 * 24 * 90,
    },
  };
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
