import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { authenticateUser } from '@/domain/authenticate';
import { getSession } from '@/domain/session';
import { checkLoginRateLimit, clearLoginRateLimit } from '@/lib/loginRateLimit';
import { readJsonBody } from '@/lib/readJsonBody';

/**
 * Validation volontairement minimale — pas de `.email()` ni de longueur : ce
 * n'est pas une inscription, et refuser en 400 une adresse mal formée
 * apprendrait à un attaquant ce que la base considère comme une adresse
 * valide. Tout ce qui n'authentifie pas ressort en 401 identique.
 */
const loginBodySchema = z
  .object({
    email: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

const tooManyAttempts = (retryAfterSeconds: number): NextResponse => {
  return NextResponse.json(
    { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
};

export const POST = async (request: Request): Promise<NextResponse> => {
  const parsed = loginBodySchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const limit = checkLoginRateLimit({ headers: request.headers, email });
  if (!limit.allowed) {
    return tooManyAttempts(limit.retryAfterSeconds);
  }

  const user = await authenticateUser({ db, email, password });
  if (!user) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
  }

  clearLoginRateLimit({ headers: request.headers, email });

  const session = await getSession();
  session.userId = user.id;
  session.issuedAt = new Date().toISOString();
  await session.save();

  return NextResponse.json({ ok: true });
};
