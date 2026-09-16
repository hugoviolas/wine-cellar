/** Utilisateur authentifié tel qu'une route d'API le reçoit. */
export interface ApiUser {
  readonly id: string;
  readonly email: string;
  readonly isSuperAdmin: boolean;
}
