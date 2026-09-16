import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Type écrit explicitement plutôt que déduit de `createDb` : la fonction
 * peut alors annoncer son propre type de retour, ce qu'un
 * `ReturnType<typeof createDb>` rendait circulaire.
 */
export type Db = LibSQLDatabase<typeof schema>;

/**
 * Connexion ou transaction en cours. Une fonction du domaine qui écrit
 * plusieurs lignes doit pouvoir être appelée aussi bien directement que
 * depuis un `db.transaction(...)` : les deux exposent la même API de
 * requête, mais pas le même type.
 */
export type DbOrTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export const createDb = (url: string): Db => {
  const client = createClient({ url });
  return drizzle(client, { schema });
};

// Instancié à la première utilisation réelle (premier `db.select()`,
// `db.insert()`, ...), pas à l'import du module : `next build` importe les
// fichiers de route pour en analyser les pages sans jamais appeler leurs
// handlers, et ouvrirait sinon un vrai fichier SQLite (ou échouerait si le
// dossier `data/` n'existe pas encore, comme dans l'image Docker au moment
// du build).
let instance: Db | undefined;

/**
 * `{} as Db` est le seul transtypage que ce module ne peut pas éviter : la
 * cible d'un `Proxy` doit déjà porter le type de l'objet qu'il imite, alors
 * que tout l'intérêt est ici de n'en construire aucun avant le premier
 * accès. Aucune propriété n'est jamais lue sur cet objet vide — le piège
 * `get` redirige tout vers l'instance réelle.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver): unknown {
    return Reflect.get(getInstance(), prop, receiver);
  },
});

const getInstance = (): Db => {
  if (!instance) {
    instance = createDb(process.env.DATABASE_URL ?? 'file:./data/cave.db');
  }
  return instance;
};
