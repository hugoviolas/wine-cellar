import type { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { authenticateClient } from '@/domain/oauth/clients';
import { OAuthError } from '@/domain/oauth/oauthError';
import { revokeToken } from '@/domain/oauth/tokens';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import {
  oauthDisabled,
  oauthErrorResponse,
  oauthJson,
  readClientCredentials,
  readOAuthParams,
} from '@/lib/oauthHttp';

/**
 * Révocation (RFC 7009) : appelée quand on déconnecte le connecteur côté
 * Claude. Répond 200 même pour un jeton inconnu, comme le veut la RFC — la
 * réponse ne doit rien apprendre sur l'existence d'un jeton.
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
    if (!params.token) {
      throw new OAuthError('invalid_request', 'token est requis.');
    }
    await revokeToken({ db, client, token: params.token });
    return oauthJson({ body: {} });
  } catch (error: unknown) {
    if (error instanceof OAuthError) {
      return oauthErrorResponse(error);
    }
    throw error;
  }
};
