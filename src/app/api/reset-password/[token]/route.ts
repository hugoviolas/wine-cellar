import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { resetPasswordWithToken } from '@/domain/passwordReset';

const resetBodySchema = z.object({ password: z.string().min(8) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
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
