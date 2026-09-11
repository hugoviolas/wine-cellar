import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { getSession } from '@/domain/session';
import { getAppSettings } from '@/domain/appSettings';
import { registerSelfServeUser, EmailAlreadyExistsError } from '@/domain/accounts';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/rateLimit';

/**
 * Sur l'énumération de comptes : tant que l'inscription est ouverte et
 * qu'aucun email de confirmation n'est envoyé, elle reste possible par
 * construction — le simple fait qu'une inscription réussisse prouve que
 * l'adresse était libre. Uniformiser le message d'erreur (voir plus bas)
 * ne fait que retirer la confirmation explicite ; ce qui borne réellement
 * un balayage d'adresses, c'est la limitation de débit ci-dessous. La
 * correction complète supposerait une inscription validée par email, donc
 * un envoi d'emails que l'app n'a pas aujourd'hui.
 */

/** Route publique : borne la création de comptes en masse depuis une même origine. */
const PER_IP = { limit: 5, windowMs: 60 * 60 * 1000 };

const signupBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict();

export async function POST(request: Request) {
  const limit = checkRateLimit(`signup:ip:${clientKeyFromHeaders(request.headers)}`, PER_IP);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessaie dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

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
      // Message volontairement muet sur l'existence du compte : confirmer
      // qu'un email est déjà pris permet de tester une liste d'adresses.
      // Atténuation seulement, pas une correction complète — voir le
      // commentaire en tête de fichier.
      return NextResponse.json(
        {
          error:
            'Impossible de créer un compte avec cet email. S’il t’appartient déjà, connecte-toi ou demande un lien de réinitialisation.',
        },
        { status: 409 },
      );
    }
    throw err;
  }

  const session = await getSession();
  session.userId = userId;
  session.issuedAt = new Date().toISOString();
  await session.save();

  return NextResponse.json({ ok: true });
}
