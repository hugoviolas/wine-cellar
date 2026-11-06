import { NextResponse } from 'next/server';
import { buildProtectedResourceMetadata } from '@/domain/oauth/metadata';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import { oauthDisabled } from '@/lib/oauthHttp';

/**
 * Métadonnées de la ressource `/mcp` (RFC 9728), à l'adresse que désigne
 * l'en-tête `WWW-Authenticate` d'un 401 sur `/mcp`.
 */
export const GET = (): NextResponse => {
  const publicUrl = getMcpPublicUrl();
  if (!publicUrl) {
    return oauthDisabled();
  }
  return NextResponse.json(buildProtectedResourceMetadata(publicUrl));
};
