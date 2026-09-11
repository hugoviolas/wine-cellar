import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { authenticateUser } from '@/domain/authenticate';
import { getSession } from '@/domain/session';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rateLimit';

/**
 * Deux seaux distincts : par IP (limite un attaquant unique qui balaie
 * plusieurs comptes) et par email visé (limite une attaque distribuée sur
 * un seul compte, où chaque requête vient d'une IP différente). bcrypt en
 * coût 12 ralentit déjà chaque essai, mais ne borne pas leur nombre.
 */
const PER_IP = { limit: 10, windowMs: 5 * 60 * 1000 };
const PER_EMAIL = { limit: 5, windowMs: 5 * 60 * 1000 };

function tooManyAttempts(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  const ipLimit = checkRateLimit(`login:ip:${clientKeyFromHeaders(request.headers)}`, PER_IP);
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);
  const emailLimit = checkRateLimit(`login:email:${body.email.toLowerCase()}`, PER_EMAIL);
  if (!emailLimit.allowed) return tooManyAttempts(emailLimit.retryAfterSeconds);

  const user = await authenticateUser(db, body.email, body.password);
  if (!user) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.issuedAt = new Date().toISOString();
  await session.save();

  return NextResponse.json({ ok: true });
}
