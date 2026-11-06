import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { authenticateUser } from '@/domain/authenticate';
import { checkAuthorizationRequest, issueAuthorizationCode } from '@/domain/oauth/authorization';
import { mcpResourceUrl } from '@/domain/oauth/metadata';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import { checkLoginRateLimit, clearLoginRateLimit } from '@/lib/loginRateLimit';
import { oauthDisabled } from '@/lib/oauthHttp';
import { readJsonBody } from '@/lib/readJsonBody';
import { FIELD_MAX } from '@/domain/fieldLimits';

/**
 * Validation du formulaire de `/oauth/authorize` : identifiants de la cave
 * et paramètres de la demande, renvoyés tels qu'affichés. Rien n'est gardé
 * côté serveur entre l'affichage et l'envoi — la demande est revérifiée
 * entièrement ici, un paramètre modifié dans la page n'apporte donc rien.
 *
 * Le mot de passe est redemandé même si une session est ouverte : c'est ce
 * qui empêche un lien piégé de faire autoriser une application en un clic
 * à quelqu'un de déjà connecté.
 */
const bodySchema = z
  .object({
    email: z.string().min(1).max(FIELD_MAX.email),
    password: z.string().min(1).max(FIELD_MAX.password),
    params: z.record(z.string(), z.string()),
  })
  .strict();

export const POST = async (request: Request): Promise<NextResponse> => {
  const publicUrl = getMcpPublicUrl();
  if (!publicUrl) {
    return oauthDisabled();
  }
  const parsed = bodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
  }
  const { email, password, params } = parsed.data;

  const check = await checkAuthorizationRequest({ db, params, resourceUrl: mcpResourceUrl(publicUrl) });
  if (check.status !== 'ok') {
    return NextResponse.json(
      { error: "Demande d'autorisation invalide : relance la connexion depuis Claude." },
      { status: 400 },
    );
  }

  const limit = checkLoginRateLimit({ headers: request.headers, email });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }
  const user = await authenticateUser({ db, email, password });
  if (!user) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
  }
  clearLoginRateLimit({ headers: request.headers, email });

  const redirectUrl = await issueAuthorizationCode({ db, request: check.request, userId: user.id });
  return NextResponse.json({ redirectUrl }, { headers: { 'Cache-Control': 'no-store' } });
};
