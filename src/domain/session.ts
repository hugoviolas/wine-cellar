import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    'SESSION_SECRET doit être défini dans .env avec au moins 32 caractères (voir .env.example).',
  );
}

export interface SessionData {
  userId?: string;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'cave_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 90,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
