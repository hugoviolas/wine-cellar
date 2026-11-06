import { SUPPORTED_CLIENT_AUTH_METHODS } from './settings';

/**
 * Chemins publics du serveur OAuth et de la ressource MCP. Réunis ici parce
 * que les documents de découverte, les routes et l'en-tête
 * `WWW-Authenticate` de `/mcp` doivent tous désigner les mêmes adresses.
 */
export const OAUTH_PATHS = {
  mcp: '/mcp',
  authorize: '/oauth/authorize',
  token: '/api/oauth/token',
  register: '/api/oauth/register',
  revoke: '/api/oauth/revoke',
  protectedResourceMetadata: '/.well-known/oauth-protected-resource/mcp',
} as const;

/** Adresse de la ressource protégée, telle qu'elle se saisit dans claude.ai. */
export const mcpResourceUrl = (publicUrl: URL): string => {
  return `${publicUrl.origin}${OAUTH_PATHS.mcp}`;
};

/** Métadonnées du serveur d'autorisation (RFC 8414). */
export const buildAuthorizationServerMetadata = (publicUrl: URL): Record<string, unknown> => {
  const { origin } = publicUrl;
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${OAUTH_PATHS.authorize}`,
    token_endpoint: `${origin}${OAUTH_PATHS.token}`,
    registration_endpoint: `${origin}${OAUTH_PATHS.register}`,
    revocation_endpoint: `${origin}${OAUTH_PATHS.revoke}`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: SUPPORTED_CLIENT_AUTH_METHODS,
    revocation_endpoint_auth_methods_supported: SUPPORTED_CLIENT_AUTH_METHODS,
  };
};

/** Métadonnées de la ressource protégée `/mcp` (RFC 9728). */
export const buildProtectedResourceMetadata = (publicUrl: URL): Record<string, unknown> => {
  return {
    resource: mcpResourceUrl(publicUrl),
    authorization_servers: [publicUrl.origin],
    bearer_methods_supported: ['header'],
    resource_name: 'Ma Cave',
  };
};
