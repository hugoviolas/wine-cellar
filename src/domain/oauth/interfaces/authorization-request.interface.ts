/**
 * Demande d'autorisation validée : tout ce qu'il faut pour émettre un code
 * une fois l'utilisateur authentifié. `redirectUri` est l'une des adresses
 * enregistrées par le client, jamais une valeur libre.
 */
export interface AuthorizationRequest {
  clientId: string;
  clientName: string | null;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
}
