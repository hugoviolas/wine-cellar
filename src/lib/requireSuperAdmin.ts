import { redirect } from 'next/navigation';
import { requireUser } from './requireUser';

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect('/cave');
  return user;
}
