import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getSession } from '@/domain/session';

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect('/login');

  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
