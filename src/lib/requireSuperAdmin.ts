import { redirect } from 'next/navigation';
import type { ApiUser } from './interfaces/api-user.interface';
import { requireUser } from './requireUser';

export const requireSuperAdmin = async (): Promise<ApiUser> => {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    redirect('/cave');
  }
  return user;
};
