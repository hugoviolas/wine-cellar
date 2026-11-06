import type { ClientAuthMethod } from '../settings';

export interface RegisterClientInput {
  redirectUris: string[];
  clientName: string | null;
  tokenEndpointAuthMethod: ClientAuthMethod;
}
