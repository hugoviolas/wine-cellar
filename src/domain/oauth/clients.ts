import { and, eq, lt, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { oauthClients, oauthCodes, oauthTokens } from '../../db/schema';
import { newId } from '../../db/id';
import type { OAuthClientRow } from '../../db/rows';
import { generateToken, hashToken } from '../token';
import { FIELD_MAX } from '../fieldLimits';
import { OAuthError } from './oauthError';
import { isAllowedRedirectUri } from './redirectUris';
import { constantTimeEquals } from './secrets';
import { OAUTH_DURATIONS_MS, SUPPORTED_CLIENT_AUTH_METHODS } from './settings';
import type { RegisterClientArgs } from './interfaces/register-client-args.interface';
import type { RegisterClientInput } from './interfaces/register-client-input.interface';
import type { RegisteredClient } from './interfaces/registered-client.interface';
import type { GetClientArgs } from './interfaces/get-client-args.interface';
import type { AuthenticateClientArgs } from './interfaces/authenticate-client-args.interface';
import type { PurgeIdleClientsArgs } from './interfaces/purge-idle-clients-args.interface';

const MAX_REDIRECT_URIS = 10;
const MAX_URI_LENGTH = 2000;

/**
 * Métadonnées d'enregistrement acceptées (RFC 7591 §2). Les champs non
 * listés sont ignorés plutôt que refusés, comme le demande la RFC : un
 * client envoie volontiers son logo, ses contacts ou sa version.
 *
 * `token_endpoint_auth_method` vaut `client_secret_basic` par défaut,
 * toujours selon la RFC — un client qui n'en dit rien reçoit un secret.
 */
const registrationSchema = z.object({
  redirect_uris: z.array(z.string().max(MAX_URI_LENGTH)).min(1).max(MAX_REDIRECT_URIS),
  client_name: z.string().max(FIELD_MAX.shortText).optional(),
  token_endpoint_auth_method: z.enum(SUPPORTED_CLIENT_AUTH_METHODS).default('client_secret_basic'),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

const GRANT_TYPES = ['authorization_code', 'refresh_token'];
const RESPONSE_TYPES = ['code'];

/**
 * Valide un corps d'enregistrement et le traduit en entrée du domaine.
 * Lève une `OAuthError` au code attendu par le client : une adresse de
 * retour refusée n'est pas la même erreur qu'un document mal formé.
 */
export const parseClientRegistration = (body: unknown): RegisterClientInput => {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    throw new OAuthError('invalid_client_metadata', "Métadonnées d'enregistrement invalides.");
  }
  const { data } = parsed;
  if (!data.redirect_uris.every(isAllowedRedirectUri)) {
    throw new OAuthError(
      'invalid_redirect_uri',
      'Adresse de retour non autorisée : seuls claude.ai, claude.com et la boucle locale sont acceptés.',
    );
  }
  // Ce serveur ne sait faire que le flux par code avec renouvellement : un
  // client qui exige autre chose ne pourrait de toute façon rien en tirer.
  const unsupportedGrant = data.grant_types?.some((grant) => !GRANT_TYPES.includes(grant)) ?? false;
  const unsupportedResponse = data.response_types?.some((type) => !RESPONSE_TYPES.includes(type)) ?? false;
  if (unsupportedGrant || unsupportedResponse) {
    throw new OAuthError('invalid_client_metadata', 'Seul le flux authorization_code est pris en charge.');
  }
  return {
    redirectUris: data.redirect_uris,
    clientName: data.client_name?.trim() || null,
    tokenEndpointAuthMethod: data.token_endpoint_auth_method,
  };
};

export const registerClient = async ({ db, input }: RegisterClientArgs): Promise<RegisteredClient> => {
  const now = new Date();
  await purgeIdleClients({ db, now });

  const clientId = newId();
  const clientSecret = input.tokenEndpointAuthMethod === 'none' ? null : generateToken();
  await db.insert(oauthClients).values({
    id: clientId,
    name: input.clientName,
    redirectUris: input.redirectUris,
    tokenEndpointAuthMethod: input.tokenEndpointAuthMethod,
    clientSecretHash: clientSecret === null ? null : hashToken(clientSecret),
    createdAt: now.toISOString(),
  });

  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(now.getTime() / 1000),
    ...(input.clientName === null ? {} : { client_name: input.clientName }),
    redirect_uris: input.redirectUris,
    token_endpoint_auth_method: input.tokenEndpointAuthMethod,
    grant_types: GRANT_TYPES,
    response_types: RESPONSE_TYPES,
    // 0 = le secret n'expire pas (RFC 7591 §3.2.1).
    ...(clientSecret === null ? {} : { client_secret: clientSecret, client_secret_expires_at: 0 }),
  };
};

export const getClient = async ({ db, clientId }: GetClientArgs): Promise<OAuthClientRow | null> => {
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1);
  return row ?? null;
};

/**
 * Identifie le client qui appelle l'endpoint de jetons ou de révocation.
 * Un client confidentiel doit présenter son secret ; un client public
 * (`none`) n'en a pas et n'est protégé que par PKCE. Même erreur pour un
 * client inconnu et un secret faux.
 */
export const authenticateClient = async ({
  db,
  credentials,
}: AuthenticateClientArgs): Promise<OAuthClientRow> => {
  const client = await getClient({ db, clientId: credentials.clientId });
  if (!client) {
    throw new OAuthError('invalid_client', 'Client inconnu ou secret invalide.');
  }
  if (client.tokenEndpointAuthMethod === 'none') {
    return client;
  }
  const secretMatches =
    credentials.clientSecret !== null &&
    client.clientSecretHash !== null &&
    constantTimeEquals(hashToken(credentials.clientSecret), client.clientSecretHash);
  if (!secretMatches) {
    throw new OAuthError('invalid_client', 'Client inconnu ou secret invalide.');
  }
  return client;
};

/**
 * Supprime les clients enregistrés depuis plus d'un jour sans avoir jamais
 * obtenu ni code ni jeton. L'enregistrement étant ouvert à tous, c'est ce
 * qui empêche la table de grossir sans fin sous des enregistrements
 * abandonnés (ou malveillants) — la limite de débit de la route ne fait que
 * ralentir l'accumulation.
 */
const purgeIdleClients = async ({ db, now }: PurgeIdleClientsArgs): Promise<void> => {
  const cutoff = new Date(now.getTime() - OAUTH_DURATIONS_MS.idleClient).toISOString();
  await db
    .delete(oauthClients)
    .where(
      and(
        lt(oauthClients.createdAt, cutoff),
        notInArray(oauthClients.id, db.select({ id: oauthTokens.clientId }).from(oauthTokens)),
        notInArray(oauthClients.id, db.select({ id: oauthCodes.clientId }).from(oauthCodes)),
      ),
    );
};
