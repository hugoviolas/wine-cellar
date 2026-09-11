import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getSession } from '@/domain/session';
import { isSessionStillValid } from '@/domain/sessionValidity';

export interface ApiUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

export type ApiUserResult = { user: ApiUser } | { error: NextResponse };

export async function requireApiUser(): Promise<ApiUserResult> {
  const session = await getSession();
  if (!session.userId) {
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) {
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }
  // Session antérieure à une réinitialisation de mot de passe : le cookie
  // est intact et déchiffrable, mais ne vaut plus rien.
  if (!isSessionStillValid(user, session.issuedAt)) {
    session.destroy();
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }

  return { user: { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin } };
}
