/**
 * Un cookie iron-session est autoporteur : il reste valide jusqu'à son
 * expiration, sans que le serveur ne tienne de registre des sessions
 * ouvertes. Changer un mot de passe ne suffit donc pas à déconnecter
 * quelqu'un — or c'est précisément le geste qu'on fait quand un compte est
 * compromis.
 *
 * D'où cette comparaison, faite à chaque requête authentifiée : la session
 * porte sa date d'émission (`issuedAt`), le compte porte la date du dernier
 * geste devant invalider l'existant (`sessionsValidFrom`). Une session
 * émise avant est refusée.
 *
 * Les autres leviers d'administration n'ont pas besoin de ce mécanisme :
 * `isActive` et `isSuperAdmin` sont relus en base à chaque requête (voir
 * requireUser / requireApiUser), donc désactiver ou rétrograder un compte
 * prend effet immédiatement.
 */
export interface SessionValidityUser {
  sessionsValidFrom: string | null;
}

export function isSessionStillValid(
  user: SessionValidityUser,
  issuedAt: string | undefined,
): boolean {
  // Aucun geste d'invalidation sur ce compte : rien à comparer. C'est le
  // cas de tous les comptes existants au moment du déploiement de cette
  // fonctionnalité — leurs sessions en cours ne sont pas cassées.
  if (!user.sessionsValidFrom) return true;

  // Le compte a été invalidé mais la session ne porte pas de date : elle a
  // été émise avant que `issuedAt` n'existe, donc forcément avant
  // l'invalidation. Refusée.
  if (!issuedAt) return false;

  const issued = new Date(issuedAt).getTime();
  const validFrom = new Date(user.sessionsValidFrom).getTime();
  // Date illisible (cookie forgé, format inattendu) : on refuse plutôt que
  // de laisser passer sur une comparaison avec NaN, toujours fausse.
  if (Number.isNaN(issued) || Number.isNaN(validFrom)) return false;

  return issued >= validFrom;
}
