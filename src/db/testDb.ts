import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDb, type Db } from './client';

export async function createTestDb(): Promise<Db> {
  const db = createDb(':memory:');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  return db;
}
