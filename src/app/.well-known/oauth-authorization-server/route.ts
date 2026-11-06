import { NextResponse } from 'next/server';
import { buildAuthorizationServerMetadata } from '@/domain/oauth/metadata';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import { oauthDisabled } from '@/lib/oauthHttp';

/** Découverte du serveur d'autorisation (RFC 8414), lue par Claude avant tout. */
export const GET = (): NextResponse => {
  const publicUrl = getMcpPublicUrl();
  if (!publicUrl) {
    return oauthDisabled();
  }
  return NextResponse.json(buildAuthorizationServerMetadata(publicUrl));
};
