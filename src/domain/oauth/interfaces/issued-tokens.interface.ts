/** Réponse de l'endpoint de jetons (RFC 6749 §5.1), envoyée telle quelle. */
export interface IssuedTokens {
  access_token: string;
  token_type: 'Bearer';
  /** Durée de vie du jeton d'accès, en secondes. */
  expires_in: number;
  refresh_token: string;
}
