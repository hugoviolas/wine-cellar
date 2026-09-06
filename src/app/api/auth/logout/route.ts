import { NextResponse } from 'next/server';
import { getSession } from '@/domain/session';

export async function POST(request: Request) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL('/login', request.url));
}
