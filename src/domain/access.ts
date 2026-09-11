import { eq, and } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cellarMemberships, users } from '../db/schema';

export type CellarRole = 'owner' | 'editor' | 'reader' | 'super_admin';
export type AccessResult = { allowed: true; role: CellarRole } | { allowed: false };

export async function checkCellarAccess(db: Db, userId: string, cellarId: string): Promise<AccessResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { allowed: false };
  if (user.isSuperAdmin) return { allowed: true, role: 'super_admin' };

  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(and(eq(cellarMemberships.cellarId, cellarId), eq(cellarMemberships.userId, userId)))
    .limit(1);

  if (!membership) return { allowed: false };
  return { allowed: true, role: membership.role as CellarRole };
}
