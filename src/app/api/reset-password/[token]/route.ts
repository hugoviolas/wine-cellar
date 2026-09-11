import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { resetPasswordWithToken } from '@/domain/passwordReset';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rateLimit';

/**
 * Route publique dont le seul secret est le jeton de l'URL. Celui-ci fait
 * 32 octets aléatoires (indevinable), mais rien ne justifie de laisser une
 * même origine en essayer un nombre illimité.
 */
const PER_IP = { limit: 10, windowMs: 15 * 60 * 1000 };

const resetBodySchema = z.object({ password: z.string().min(8) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limit = checkRateLimit(`reset:ip:${clientKeyFromHeaders(request.headers)}`, PER_IP);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const { token } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = resetBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mot de passe invalide (8 caractères minimum).' }, { status: 400 });
  }

  try {
    await resetPasswordWithToken(db, token, parsed.data.password);
  } catch {
    return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
