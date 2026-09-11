import 'dotenv/config';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from '../src/db/client';

migrate(db, { migrationsFolder: './src/db/migrations' })
  .then(() => {
    console.log('Migrations appliquées.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
