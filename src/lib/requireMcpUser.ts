import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { verifyAccessToken } from '@/domain/oauth/tokens';
import { OAUTH_PATHS } from '@/domain/oauth/metadata';
import type { ApiUser } from './interfaces/api-user.interface';
import type { RequireMcpUserArgs } from './interfaces/require-mcp-user-args.interface';

export type McpUserResult = { user: ApiUser } | { error: NextResponse };

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/**
 * Pendant de `requireApiUser` pour `/mcp` : l'utilisateur vient du jeton
 * OAuth de l'en-tête `Authorization`, jamais du cookie de session.
 *
 * Le 401 porte l'adresse des métadonnées de la ressource (RFC 9728) : c'est
 * par elle qu'un client qui n'a pas encore de jeton découvre où
 * s'enregistrer et faire autoriser l'accès.
 */
export const requireMcpUser = async ({ request, publicUrl }: RequireMcpUserArgs): Promise<McpUserResult> => {
  const token = BEARER_PATTERN.exec(request.headers.get('authorization') ?? '')?.[1];
  const user = token === undefined ? null : await verifyAccessToken({ db, token });
  if (user) {
    return { user };
  }

  const resourceMetadata = `resource_metadata="${publicUrl.origin}${OAUTH_PATHS.protectedResourceMetadata}"`;
  // Sans jeton, pas de code d'erreur : la RFC 6750 (§3.1) le réserve à un
  // jeton présenté puis refusé. En anglais et sans accent : un en-tête HTTP
  // n'admet que de l'ASCII.
  const challenge =
    token === undefined
      ? `Bearer ${resourceMetadata}`
      : `Bearer error="invalid_token", error_description="The access token is invalid or expired", ${resourceMetadata}`;
  return {
    error: NextResponse.json(
      { error: 'invalid_token', error_description: 'Authentification requise.' },
      { status: 401, headers: { 'WWW-Authenticate': challenge } },
    ),
  };
};
