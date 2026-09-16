import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { verifyPassword } from './auth';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import type { AuthenticateUserArgs } from './interfaces/authenticate-user-args.interface';

export type { AuthenticatedUser };

export const authenticateUser = async ({
  db,
  email,
  password,
}: AuthenticateUserArgs): Promise<AuthenticatedUser | null> => {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) {
    return null;
  }
  if (!user.isActive) {
    return null;
  }
  const valid = await verifyPassword({ password, hash: user.passwordHash });
  if (!valid) {
    return null;
  }
  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
};
