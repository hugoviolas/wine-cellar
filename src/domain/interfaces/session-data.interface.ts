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
