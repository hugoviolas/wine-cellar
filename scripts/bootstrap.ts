import 'dotenv/config';
import { db } from '../src/db/client';
import { bootstrapSuperAdmin } from '../src/domain/bootstrap';

async function main() {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;
  const cellarName = process.env.BOOTSTRAP_CELLAR_NAME ?? 'Ma Cave';

  if (!email || !password) {
    throw new Error('BOOTSTRAP_EMAIL et BOOTSTRAP_PASSWORD doivent être définis dans .env');
  }

  const { userId, cellarId } = await bootstrapSuperAdmin(db, { email, password, cellarName });
  console.log(`Super-admin créé : ${email} (${userId})`);
  console.log(`Cave créée : ${cellarName} (${cellarId})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
