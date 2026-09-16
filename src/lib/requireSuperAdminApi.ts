import { NextResponse } from 'next/server';
import { requireApiUser, type ApiUserResult } from './requireApiUser';

export const requireSuperAdminApi = async (): Promise<ApiUserResult> => {
  const auth = await requireApiUser();
  if ('error' in auth) {
    return auth;
  }
  if (!auth.user.isSuperAdmin) {
    return {
      error: NextResponse.json({ error: 'Accès réservé au super-admin.' }, { status: 403 }),
    };
  }
  return auth;
};
