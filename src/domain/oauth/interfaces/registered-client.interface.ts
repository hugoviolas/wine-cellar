import type { ClientAuthMethod } from '../settings';

/**
 * Réponse d'enregistrement (RFC 7591 §3.2.1). `client_secret` n'y figure
 * qu'une fois, à la création : la base n'en garde que l'empreinte.
 */
export interface RegisteredClient {
  client_id: string;
  client_id_issued_at: number;
  client_name?: string;
  redirect_uris: string[];
  token_endpoint_auth_method: ClientAuthMethod;
  grant_types: string[];
  response_types: string[];
  client_secret?: string;
  client_secret_expires_at?: number;
}
