/**
 * Identité présentée par un client à l'endpoint de jetons ou de
 * révocation : `clientSecret` est nul pour un client public, qui ne
 * s'authentifie que par PKCE.
 */
export interface ClientCredentials {
  clientId: string;
  clientSecret: string | null;
}
