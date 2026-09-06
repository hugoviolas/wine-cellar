import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export function createDb(url: string) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

export const db = createDb(process.env.DATABASE_URL ?? 'file:./data/cave.db');
