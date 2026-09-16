import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { authenticateUser } from '@/domain/authenticate';
import { getSession } from '@/domain/session';
import { checkRateLimit, clientKeyFromHeaders, resetRateLimit } from '@/lib/rateLimit';
import { readJsonBody } from '@/lib/readJsonBody';

/**
 * Deux seaux distincts : par IP (limite un attaquant unique qui balaie
 * plusieurs comptes) et par email visé (limite une attaque distribuée sur
 * un seul compte, où chaque requête vient d'une IP différente). bcrypt en
 * coût 12 ralentit déjà chaque essai, mais ne borne pas leur nombre.
 */
const PER_IP = { limit: 10, windowMs: 5 * 60 * 1000 };
const PER_EMAIL = { limit: 5, windowMs: 5 * 60 * 1000 };

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

  const ipKey = `login:ip:${clientKeyFromHeaders(request.headers)}`;
  const emailKey = `login:email:${email.toLowerCase()}`;

  const ipLimit = checkRateLimit({ key: ipKey, rule: PER_IP });
  if (!ipLimit.allowed) {
    return tooManyAttempts(ipLimit.retryAfterSeconds);
  }
  const emailLimit = checkRateLimit({ key: emailKey, rule: PER_EMAIL });
  if (!emailLimit.allowed) {
    return tooManyAttempts(emailLimit.retryAfterSeconds);
  }

  const user = await authenticateUser({ db, email, password });
  if (!user) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
  }

  // Les seaux ne comptent que les échecs : une connexion réussie les
  // libère, sinon quiconque connaît une adresse pouvait saturer son seau
  // et bloquer son propriétaire pendant toute la fenêtre.
  resetRateLimit(ipKey);
  resetRateLimit(emailKey);

  const session = await getSession();
  session.userId = user.id;
  session.issuedAt = new Date().toISOString();
  await session.save();

  return NextResponse.json({ ok: true });
};
