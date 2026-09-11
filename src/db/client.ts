import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export function createDb(url: string) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

// Instancié à la première utilisation réelle (premier `db.select()`,
// `db.insert()`, ...), pas à l'import du module : `next build` importe les
// fichiers de route pour en analyser les pages sans jamais appeler leurs
// handlers, et ouvrirait sinon un vrai fichier SQLite (ou échouerait si le
// dossier `data/` n'existe pas encore, comme dans l'image Docker au moment
// du build).
let instance: Db | undefined;

function getInstance(): Db {
  if (!instance) {
    instance = createDb(process.env.DATABASE_URL ?? 'file:./data/cave.db');
  }
  return instance;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance() as object, prop, receiver);
  },
});
