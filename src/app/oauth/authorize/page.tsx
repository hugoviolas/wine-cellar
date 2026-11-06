import { notFound, redirect } from 'next/navigation';
import { db } from '@/db/client';
import { checkAuthorizationRequest } from '@/domain/oauth/authorization';
import { mcpResourceUrl } from '@/domain/oauth/metadata';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import { OAuthAuthorizeForm } from '@/components/OAuthAuthorizeForm';
import type { ReactElement } from 'react';

// Lit la base à chaque affichage : jamais de pré-rendu à la construction.
export const dynamic = 'force-dynamic';

/**
 * Page d'autorisation OAuth, ouverte par Claude dans le navigateur lors de
 * l'ajout du connecteur. L'utilisateur s'y identifie avec son compte de la
 * cave : les tools MCP agiront ensuite en son nom, avec ses droits.
 */
const AuthorizePage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> => {
  const publicUrl = getMcpPublicUrl();
  if (!publicUrl) {
    notFound();
  }

  // Un paramètre répété arrive en tableau : la RFC 6749 (§3.1) l'interdit,
  // il est donc écarté et la demande échoue à la validation.
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') {
      params[key] = value;
    }
  }

  const check = await checkAuthorizationRequest({ db, params, resourceUrl: mcpResourceUrl(publicUrl) });
  if (check.status === 'redirect_error') {
    redirect(check.redirectUrl);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-4">Ma Cave</h1>
        {check.status === 'ok' ? (
          <OAuthAuthorizeForm
            params={params}
            clientName={check.request.clientName}
            redirectHost={new URL(check.request.redirectUri).host}
          />
        ) : (
          <p className="text-sm">{check.message}</p>
        )}
      </div>
    </div>
  );
};

export default AuthorizePage;
