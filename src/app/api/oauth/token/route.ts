import type { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { authenticateClient } from '@/domain/oauth/clients';
import { OAuthError } from '@/domain/oauth/oauthError';
import { exchangeAuthorizationCode, refreshTokens, type IssuedTokens } from '@/domain/oauth/tokens';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import {
  oauthDisabled,
  oauthErrorResponse,
  oauthJson,
  readClientCredentials,
  readOAuthParams,
} from '@/lib/oauthHttp';
import type { GrantArgs } from './interfaces/grant-args.interface';

/**
 * Endpoint de jetons (RFC 6749 §3.2) : échange d'un code d'autorisation,
 * puis renouvellements. Appelé par les serveurs de Claude, pas par un
 * navigateur — aucun cookie n'y entre en jeu.
 */
export const POST = async (request: Request): Promise<NextResponse> => {
  if (!getMcpPublicUrl()) {
    return oauthDisabled();
  }
  try {
    const params = await readOAuthParams(request);
    const client = await authenticateClient({
      db,
      credentials: readClientCredentials({ headers: request.headers, params }),
    });
    return oauthJson({ body: await grant({ params, client }) });
  } catch (error: unknown) {
    if (error instanceof OAuthError) {
      return oauthErrorResponse(error);
    }
    throw error;
  }
};

const grant = async ({ params, client }: GrantArgs): Promise<IssuedTokens> => {
  if (params.grant_type === 'authorization_code') {
    const { code, code_verifier: codeVerifier } = params;
    if (!code || !codeVerifier) {
      throw new OAuthError('invalid_request', 'code et code_verifier sont requis.');
    }
    return exchangeAuthorizationCode({
      db,
      client,
      code,
      codeVerifier,
      redirectUri: params.redirect_uri ?? null,
    });
  }
  if (params.grant_type === 'refresh_token') {
    const { refresh_token: refreshToken } = params;
    if (!refreshToken) {
      throw new OAuthError('invalid_request', 'refresh_token est requis.');
    }
    return refreshTokens({ db, client, refreshToken });
  }
  throw new OAuthError('unsupported_grant_type', 'grant_type non pris en charge.');
};
