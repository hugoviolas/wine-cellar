const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/**
 * Durées de vie, reprises du serveur MCP health-mcp, qui fonctionne déjà
 * comme connecteur claude.ai : un jeton d'accès long évite une reconnexion
 * au moindre raté de renouvellement côté client, et le refresh token tourne
 * à chaque usage. Une réinitialisation de mot de passe ou un compte
 * désactivé les invalide tous immédiatement (voir tokens.ts).
 */
export const OAUTH_DURATIONS_MS = {
  accessToken: 30 * DAY_MS,
  refreshToken: 180 * DAY_MS,
  authorizationCode: 5 * MINUTE_MS,
  /** Un client enregistré qui n'a jamais obtenu de jeton est purgé au-delà. */
  idleClient: DAY_MS,
} as const;

export const SUPPORTED_CLIENT_AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const;

export type ClientAuthMethod = (typeof SUPPORTED_CLIENT_AUTH_METHODS)[number];
