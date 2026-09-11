import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { getSession } from '@/domain/session';
import { getAppSettings } from '@/domain/appSettings';
import { registerSelfServeUser, EmailAlreadyExistsError } from '@/domain/accounts';

const signupBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict();

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = signupBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const settings = await getAppSettings(db);
  if (!settings.registrationEnabled) {
    return NextResponse.json(
      { error: 'Les inscriptions sont actuellement fermées.' },
      { status: 403 },
    );
  }

  let userId: string;
  try {
    ({ userId } = await registerSelfServeUser(db, parsed.data.email, parsed.data.password));
  } catch (err) {
    if (err instanceof EmailAlreadyExistsError) {
      return NextResponse.json(
        { error: 'Un compte existe déjà pour cet email — connecte-toi plutôt.' },
        { status: 409 },
      );
    }
    throw err;
  }

  const session = await getSession();
  session.userId = userId;
  await session.save();

  return NextResponse.json({ ok: true });
}
