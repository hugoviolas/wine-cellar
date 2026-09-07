import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { verifyPassword } from './auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

export async function authenticateUser(
  db: Db,
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  if (!user.isActive) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
