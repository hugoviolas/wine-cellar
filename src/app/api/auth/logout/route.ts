import { NextResponse } from 'next/server';
import { getSession } from '@/domain/session';

export const POST = async (request: Request): Promise<NextResponse> => {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL('/login', request.url));
};
