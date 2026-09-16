import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDb, type Db } from './client';

export const createTestDb = async (): Promise<Db> => {
  const db = createDb(':memory:');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  return db;
};
