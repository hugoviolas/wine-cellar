import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { resetPasswordWithToken } from '@/domain/passwordReset';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rateLimit';
import { readJsonBody } from '@/lib/readJsonBody';
import { FIELD_MAX } from '@/domain/fieldLimits';

/**
 * Route publique dont le seul secret est le jeton de l'URL. Celui-ci fait
 * 32 octets aléatoires (indevinable), mais rien ne justifie de laisser une
 * même origine en essayer un nombre illimité.
 */
const PER_IP = { limit: 10, windowMs: 15 * 60 * 1000 };

const resetBodySchema = z.object({ password: z.string().min(8).max(FIELD_MAX.password) }).strict();

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> => {
  const limit = checkRateLimit({ key: `reset:ip:${clientKeyFromHeaders(request.headers)}`, rule: PER_IP });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const { token } = await params;
  const rawBody = await readJsonBody(request);
  const parsed = resetBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mot de passe invalide (8 caractères minimum).' }, { status: 400 });
  }

  try {
    await resetPasswordWithToken({ db, token, newPassword: parsed.data.password });
  } catch {
    return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
};
