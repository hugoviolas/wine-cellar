import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { parseClientRegistration, registerClient } from '@/domain/oauth/clients';
import { OAuthError } from '@/domain/oauth/oauthError';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import { oauthDisabled, oauthErrorResponse, oauthJson } from '@/lib/oauthHttp';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rateLimit';
import { readJsonBody } from '@/lib/readJsonBody';

/**
 * Route publique, sans authentification (RFC 7591) : Claude s'enregistre
 * lui-même à la première connexion. Bornée par IP pour qu'on ne puisse pas
 * remplir la table de clients en boucle — ceux qui n'obtiennent jamais de
 * jeton sont de toute façon purgés au bout d'un jour (voir clients.ts).
 */
const PER_IP = { limit: 20, windowMs: 60 * 60 * 1000 };

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!getMcpPublicUrl()) {
    return oauthDisabled();
  }
  const limit = checkRateLimit({
    key: `oauth-register:ip:${clientKeyFromHeaders(request.headers)}`,
    rule: PER_IP,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'too_many_requests', error_description: 'Trop de tentatives. Réessaie plus tard.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const input = parseClientRegistration(await readJsonBody(request));
    return oauthJson({ body: await registerClient({ db, input }), status: 201 });
  } catch (error: unknown) {
    if (error instanceof OAuthError) {
      return oauthErrorResponse(error);
    }
    throw error;
  }
};
