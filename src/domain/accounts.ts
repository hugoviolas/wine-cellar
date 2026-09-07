import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';

export class EmailAlreadyExistsError extends Error {}

export async function createUserAccount(db: Db, email: string, password: string): Promise<string> {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new EmailAlreadyExistsError();

  const id = newId();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  return id;
}
