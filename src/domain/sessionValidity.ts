import type { SessionValidityUser } from './interfaces/session-validity-user.interface';
import type { IsSessionStillValidArgs } from './interfaces/is-session-still-valid-args.interface';

export type { SessionValidityUser };

export const isSessionStillValid = ({ user, issuedAt }: IsSessionStillValidArgs): boolean => {
  // Aucun geste d'invalidation sur ce compte : rien à comparer. C'est le
  // cas de tous les comptes existants au moment du déploiement de cette
  // fonctionnalité — leurs sessions en cours ne sont pas cassées.
  if (!user.sessionsValidFrom) {
    return true;
  }

  // Le compte a été invalidé mais la session ne porte pas de date : elle a
  // été émise avant que `issuedAt` n'existe, donc forcément avant
  // l'invalidation. Refusée.
  if (!issuedAt) {
    return false;
  }

  const issued = new Date(issuedAt).getTime();
  const validFrom = new Date(user.sessionsValidFrom).getTime();
  // Date illisible (cookie forgé, format inattendu) : on refuse plutôt que
  // de laisser passer sur une comparaison avec NaN, toujours fausse.
  if (Number.isNaN(issued) || Number.isNaN(validFrom)) {
    return false;
  }

  return issued >= validFrom;
};
