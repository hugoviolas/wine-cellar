import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getSession } from '@/domain/session';
import { isSessionStillValid } from '@/domain/sessionValidity';

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) redirect('/login');
  // Session antérieure à une réinitialisation de mot de passe : le cookie
  // est intact et déchiffrable, mais ne vaut plus rien.
  //
  // Pas de `session.destroy()` ici, contrairement à requireApiUser : on est
  // dans le rendu d'un Server Component, où Next.js interdit d'écrire un
  // cookie (« Cookies can only be modified in a Server Action or Route
  // Handler ») — l'appeler renvoyait une 500 au lieu de la redirection.
  // Le cookie périmé reste donc dans le navigateur, sans conséquence : il
  // est rejeté à chaque requête, et le premier appel d'API le supprime.
  if (!isSessionStillValid(user, session.issuedAt)) redirect('/login');

  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
