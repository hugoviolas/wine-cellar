import { lt } from 'drizzle-orm';
import { z } from 'zod';
import { oauthCodes } from '../../db/schema';
import { generateToken, hashToken } from '../token';
import { getClient } from './clients';
import { CODE_CHALLENGE_PATTERN } from './secrets';
import { OAUTH_DURATIONS_MS } from './settings';
import type { AuthorizationRequest } from './interfaces/authorization-request.interface';
import type { CheckAuthorizationRequestArgs } from './interfaces/check-authorization-request-args.interface';
import type { IssueAuthorizationCodeArgs } from './interfaces/issue-authorization-code-args.interface';
import type { BuildErrorRedirectArgs } from './interfaces/build-error-redirect-args.interface';

export type { AuthorizationRequest };

/**
 * Issue de la vérification d'une demande d'autorisation, en trois cas que
 * la RFC 6749 (§4.1.2.1) distingue :
 * - `invalid` : client inconnu ou adresse de retour douteuse. On ne
 *   redirige surtout pas — ce serait renvoyer l'utilisateur vers une
 *   adresse que rien ne garantit —, on affiche l'erreur.
 * - `redirect_error` : le client et son adresse de retour sont sûrs, mais
 *   la demande est incorrecte. L'erreur lui est renvoyée sur cette adresse.
 * - `ok` : la demande peut être présentée à l'utilisateur.
 */
export type AuthorizationRequestCheck =
  | { status: 'ok'; request: AuthorizationRequest }
  | { status: 'invalid'; message: string }
  | { status: 'redirect_error'; redirectUrl: string };

const MAX_PARAM_LENGTH = 2000;

/**
 * Paramètres lus tels quels : leur vérification fine se fait plus bas, une
 * fois le client identifié, parce que l'erreur ne se signale pas de la même
 * manière selon qu'on peut ou non faire confiance à l'adresse de retour.
 */
const paramsSchema = z.object({
  client_id: z.string().min(1).max(MAX_PARAM_LENGTH),
  redirect_uri: z.string().max(MAX_PARAM_LENGTH).optional(),
  response_type: z.string().max(MAX_PARAM_LENGTH).optional(),
  code_challenge: z.string().max(MAX_PARAM_LENGTH).optional(),
  code_challenge_method: z.string().max(MAX_PARAM_LENGTH).optional(),
  state: z.string().max(MAX_PARAM_LENGTH).optional(),
  resource: z.string().max(MAX_PARAM_LENGTH).optional(),
});

export const checkAuthorizationRequest = async ({
  db,
  params,
  resourceUrl,
}: CheckAuthorizationRequestArgs): Promise<AuthorizationRequestCheck> => {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return { status: 'invalid', message: "Demande d'autorisation invalide." };
  }
  const query = parsed.data;

  const client = await getClient({ db, clientId: query.client_id });
  if (!client) {
    return { status: 'invalid', message: 'Application inconnue : relance la connexion depuis Claude.' };
  }

  // Sans adresse fournie, l'unique adresse enregistrée fait foi (RFC 6749
  // §3.1.2.3) ; s'il y en a plusieurs, impossible de choisir à sa place.
  const redirectUri =
    query.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0] : undefined);
  if (redirectUri === undefined || !client.redirectUris.includes(redirectUri)) {
    return { status: 'invalid', message: 'Adresse de retour non enregistrée pour cette application.' };
  }

  const state = query.state ?? null;
  const fail = (error: string, description: string): AuthorizationRequestCheck => {
    return {
      status: 'redirect_error',
      redirectUrl: buildRedirect({ redirectUri, state, error, description }),
    };
  };

  if (query.response_type !== 'code') {
    return fail('unsupported_response_type', 'Seul response_type=code est pris en charge.');
  }
  // PKCE obligatoire, en S256 seulement (OAuth 2.1, spécification MCP).
  const codeChallenge = query.code_challenge;
  if (
    query.code_challenge_method !== 'S256' ||
    codeChallenge === undefined ||
    !CODE_CHALLENGE_PATTERN.test(codeChallenge)
  ) {
    return fail('invalid_request', 'PKCE requis : code_challenge en S256.');
  }
  if (query.resource !== undefined && !isSameResource(query.resource, resourceUrl)) {
    return fail('invalid_target', 'Ressource inconnue de ce serveur.');
  }

  return {
    status: 'ok',
    request: {
      clientId: client.id,
      clientName: client.name,
      redirectUri,
      codeChallenge,
      state,
    },
  };
};

/**
 * Émet un code d'autorisation pour l'utilisateur authentifié et renvoie
 * l'adresse vers laquelle le navigateur doit repartir. Le code n'existe en
 * clair que dans cette adresse ; la base n'en garde que l'empreinte.
 */
export const issueAuthorizationCode = async ({
  db,
  request,
  userId,
}: IssueAuthorizationCodeArgs): Promise<string> => {
  const now = new Date();
  // Les codes ne vivent que quelques minutes : on balaie ceux qui ont
  // expiré sans être échangés à chaque émission, plutôt qu'avec une tâche
  // planifiée que l'app n'a pas.
  await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now.toISOString()));

  const code = generateToken();
  await db.insert(oauthCodes).values({
    codeHash: hashToken(code),
    clientId: request.clientId,
    userId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    expiresAt: new Date(now.getTime() + OAUTH_DURATIONS_MS.authorizationCode).toISOString(),
    createdAt: now.toISOString(),
  });

  const redirect = new URL(request.redirectUri);
  redirect.searchParams.set('code', code);
  if (request.state !== null) {
    redirect.searchParams.set('state', request.state);
  }
  return redirect.toString();
};

/**
 * Un client peut saisir l'adresse du serveur avec ou sans barre finale :
 * les deux désignent la même ressource.
 */
const isSameResource = (candidate: string, resourceUrl: string): boolean => {
  return candidate.replace(/\/+$/, '') === resourceUrl.replace(/\/+$/, '');
};

const buildRedirect = ({ redirectUri, state, error, description }: BuildErrorRedirectArgs): string => {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state !== null) {
    url.searchParams.set('state', state);
  }
  return url.toString();
};
