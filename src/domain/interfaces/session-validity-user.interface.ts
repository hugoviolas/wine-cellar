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
