/**
 * Membre d'une cave tel que la liste des membres l'affiche. `userId` et
 * `email` sont nuls quand le compte a été supprimé : l'adhésion lui
 * survit (voir `deleteUser`).
 */
export interface CellarMemberWithEmail {
  readonly membershipId: string;
  readonly userId: string | null;
  readonly email: string | null;
  readonly role: 'owner' | 'editor' | 'reader';
  readonly createdAt: string;
}
