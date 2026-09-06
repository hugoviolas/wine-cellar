# Fondations — Cave Mono-Utilisateur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une application de gestion de cave à vin fonctionnelle de bout en bout
pour un unique utilisateur super-admin : connexion, organisation des clayettes,
ajout/consultation/consommation de bouteilles (tous types d'alcool), fenêtre de garde,
et historique de consommation — sans IA, sans partage multi-utilisateurs, sans dashboard
admin ni déploiement (ces sujets sont couverts par des plans suivants qui s'appuient sur
ce socle).

**Architecture:** Next.js (App Router, TypeScript) mono-projet, base SQLite via
`@libsql/client` + Drizzle ORM (pas de compilation native, compatible cross-build
ARM64), logique métier isolée dans `src/domain/*` et testée en isolation avec une base
de test en mémoire, routes API et pages en fine couche au-dessus de ce domaine.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS, Drizzle ORM +
`@libsql/client`, Zod, iron-session, bcryptjs, Vitest, tsx, yarn.

**Spec:** `docs/superpowers/specs/2026-09-06-cave-a-vin-design.md`

## Global Constraints

- Gestionnaire de paquets : **yarn** (convention déjà utilisée dans les autres projets
  de l'utilisateur).
- Node.js 20 LTS. TypeScript en mode `strict: true`.
- Toute l'interface utilisateur (textes, labels, messages d'erreur) est **en français**.
- Base de données : SQLite via `@libsql/client` (driver `file:` local), jamais
  `better-sqlite3` (évite la compilation native lors du build croisé ARM64 décrit dans
  le spec, section 10).
- Mots de passe hashés avec **bcryptjs**, facteur de coût 12.
- Sessions via **iron-session**, cookie `cave_session`, durée 90 jours.
- Palette "éditorial vert sauge" (spec section 8) : fond `#f4f1ea` (crème), texte
  principal `#20342b` (vert forêt), accent `#6f8f6a` (sauge), accents or `#c9a646` /
  `#d4af37`. Titres en serif italique (Georgia), contenu utilitaire en sans-serif
  (Helvetica Neue / Arial).
- La logique métier vit dans `src/domain/*`, prend une instance `Db` en paramètre (jamais
  d'import du singleton `db` à l'intérieur d'une fonction de domaine) — c'est ce qui
  permet de la tester contre une base en mémoire sans toucher aux routes Next.js.
- Les routes API et pages Next.js restent de la fine colle : elles authentifient la
  session, appellent une fonction de `src/domain/*`, et formatent la réponse. Elles ne
  sont pas testées automatiquement dans ce plan (limitation connue de `next/headers` en
  dehors du runtime Next.js) — elles sont vérifiées manuellement à la Tâche 20.

## Hors scope de ce plan (couvert par des plans suivants)

- Génération IA (analyse, accords, dégustation), import des référentiels
  Wikidata/Kaggle, autocomplétion.
- Invitations, rôles éditeur/lecteur multi-utilisateurs, inscription de nouveaux
  comptes, dashboard super-admin.
- Dockerfile, docker-compose, tunnel Cloudflare, PWA, sauvegardes automatisées.

---

### Task 1: Scaffold du projet, thème visuel et outillage

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`,
  `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `.eslintrc.json`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

**Interfaces:**
- Produces: projet Next.js exécutable (`yarn dev`, `yarn build`), Vitest configuré
  (`yarn test`), palette Tailwind (`cream`, `forest`, `sage`, `gold`, `goldLight`) et
  polices (`font-serif` = Georgia, `font-sans` = Helvetica Neue) utilisées par toutes
  les tâches UI suivantes.

- [ ] **Step 1: Générer le projet Next.js**

Dans `/Users/hugoviolas/Desktop/code/wine-cellar` (déjà git-initialisé avec `.gitignore`
et `docs/`) :

```bash
yarn create next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --use-yarn --no-turbopack
```

Si l'outil refuse un répertoire non vide, répondre "y" pour continuer (seuls `.git`,
`.gitignore` et `docs/` préexistent, ce qui est sans risque).

- [ ] **Step 2: Installer les dépendances métier**

```bash
yarn add drizzle-orm @libsql/client zod iron-session bcryptjs
yarn add -D drizzle-kit vitest tsx dotenv @types/bcryptjs
```

- [ ] **Step 3: Configurer TypeScript en mode strict**

Éditer `tsconfig.json` pour s'assurer que `"strict": true` est présent dans
`compilerOptions` (Next.js le met par défaut avec `--typescript` — vérifier, sinon
l'ajouter).

- [ ] **Step 4: Configurer Vitest**

Créer `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 5: Ajouter les scripts npm**

Dans `package.json`, section `scripts`, ajouter :

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx scripts/migrate.ts",
    "bootstrap": "tsx scripts/bootstrap.ts"
  }
}
```

- [ ] **Step 6: Palette et thème Tailwind**

Remplacer `tailwind.config.ts` par :

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f4f1ea',
        forest: '#20342b',
        sage: '#6f8f6a',
        gold: '#c9a646',
        goldLight: '#d4af37',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Remplacer le contenu de `src/app/globals.css` par :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-cream text-forest font-sans;
}

h1, h2, h3 {
  @apply font-serif italic;
}
```

- [ ] **Step 7: Layout racine minimal**

Remplacer `src/app/layout.tsx` :

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ma Cave',
  description: 'Gestion de cave à vin, champagne et autres alcools',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

Remplacer `src/app/page.tsx` par une redirection temporaire (sera remplacée à la
Tâche 8 par la redirection vers `/login` ou `/cave`) :

```tsx
export default function HomePage() {
  return <p className="p-6">Ma Cave — en construction.</p>;
}
```

- [ ] **Step 8: Fichier d'environnement d'exemple**

Créer `.env.example` :

```
DATABASE_URL=file:./data/cave.db
SESSION_SECRET=changez-moi-en-une-chaine-aleatoire-d-au-moins-32-caracteres
BOOTSTRAP_EMAIL=vous@example.com
BOOTSTRAP_PASSWORD=changez-moi
BOOTSTRAP_CELLAR_NAME=Ma Cave
```

- [ ] **Step 9: Vérifier que le projet build**

Run: `yarn build`
Expected: exit code 0, aucune erreur TypeScript.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with editorial-sage theme"
```

---

### Task 2: Schéma de base de données et migrations

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`, `src/db/id.ts`, `src/db/client.ts`,
  `src/db/testDb.ts`, `scripts/migrate.ts`
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Produces: tables Drizzle `users`, `cellars`, `cellarMemberships`, `crates`, `bottles`,
  `consumptionHistory` ; `newId(): string` ; `createDb(url: string): Db` ; `db: Db`
  (singleton pointant sur `DATABASE_URL`) ; `createTestDb(): Promise<Db>` (base en
  mémoire migrée, utilisée par tous les tests de domaine suivants) ; type `Db`.

- [ ] **Step 1: Définir le schéma**

Créer `src/db/schema.ts` :

```ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const cellars = sqliteTable('cellars', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  aiEnabled: integer('ai_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const cellarMemberships = sqliteTable('cellar_memberships', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'editor', 'reader'] }).notNull(),
  createdAt: text('created_at').notNull(),
});

export const crates = sqliteTable('crates', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const bottles = sqliteTable('bottles', {
  id: text('id').primaryKey(),
  crateId: text('crate_id').notNull().references(() => crates.id),
  category: text('category', {
    enum: ['wine', 'sparkling', 'cider', 'beer', 'spirit'],
  }).notNull(),
  name: text('name').notNull(),
  producer: text('producer'),
  vintage: integer('vintage'),
  region: text('region'),
  color: text('color'),
  abv: real('abv'),
  volumeMl: integer('volume_ml'),
  quantity: integer('quantity').notNull().default(1),
  drinkFrom: integer('drink_from'),
  drinkUntil: integer('drink_until'),
  details: text('details', { mode: 'json' }).notNull(),
  aiAnalysis: text('ai_analysis'),
  aiPairings: text('ai_pairings', { mode: 'json' }),
  aiTastingAdvice: text('ai_tasting_advice'),
  aiGeneratedAt: text('ai_generated_at'),
  userNote: text('user_note'),
  createdAt: text('created_at').notNull(),
});

export const consumptionHistory = sqliteTable('consumption_history', {
  id: text('id').primaryKey(),
  bottleId: text('bottle_id').notNull().references(() => bottles.id),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  consumedByUserId: text('consumed_by_user_id').notNull().references(() => users.id),
  consumedAt: text('consumed_at').notNull(),
  rating: integer('rating'),
  comment: text('comment'),
  occasion: text('occasion'),
  bottleNameSnapshot: text('bottle_name_snapshot').notNull(),
  bottleProducerSnapshot: text('bottle_producer_snapshot'),
  bottleVintageSnapshot: integer('bottle_vintage_snapshot'),
  bottleCategorySnapshot: text('bottle_category_snapshot').notNull(),
});
```

- [ ] **Step 2: Helpers d'identifiants et de client DB**

Créer `src/db/id.ts` :

```ts
import { randomUUID } from 'node:crypto';

export function newId(): string {
  return randomUUID();
}
```

Créer `src/db/client.ts` :

```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export function createDb(url: string) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

export const db = createDb(process.env.DATABASE_URL ?? 'file:./data/cave.db');
```

Créer `src/db/testDb.ts` :

```ts
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createDb, type Db } from './client';

export async function createTestDb(): Promise<Db> {
  const db = createDb(':memory:');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  return db;
}
```

- [ ] **Step 3: Configurer drizzle-kit et générer la migration**

Créer `drizzle.config.ts` :

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/cave.db',
  },
} satisfies Config;
```

Run: `yarn db:generate`
Expected: un fichier SQL apparaît dans `src/db/migrations/`.

- [ ] **Step 4: Script de migration pour la base réelle**

Créer `scripts/migrate.ts` :

```ts
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
```

- [ ] **Step 5: Écrire le test d'intégration du schéma**

Créer `src/db/schema.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from './testDb';
import { users, cellars, cellarMemberships, crates, bottles, consumptionHistory } from './schema';
import { newId } from './id';

describe('schema', () => {
  it('permet d’insérer et de relire la chaîne complète user -> cellar -> crate -> bottle -> historique', async () => {
    const db = await createTestDb();
    const userId = newId();
    await db.insert(users).values({
      id: userId,
      email: 'test@example.com',
      passwordHash: 'hash',
      isSuperAdmin: true,
      createdAt: new Date().toISOString(),
    });

    const cellarId = newId();
    await db.insert(cellars).values({
      id: cellarId,
      name: 'Ma Cave',
      ownerId: userId,
      aiEnabled: true,
      createdAt: new Date().toISOString(),
    });

    await db.insert(cellarMemberships).values({
      id: newId(),
      cellarId,
      userId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    });

    const crateId = newId();
    await db.insert(crates).values({
      id: crateId,
      cellarId,
      name: 'Clayette 1',
      capacity: 12,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    });

    const bottleId = newId();
    await db.insert(bottles).values({
      id: bottleId,
      crateId,
      category: 'wine',
      name: 'Château Margaux',
      quantity: 1,
      details: { grapeVarieties: ['Cabernet Sauvignon'] },
      createdAt: new Date().toISOString(),
    });

    await db.insert(consumptionHistory).values({
      id: newId(),
      bottleId,
      cellarId,
      consumedByUserId: userId,
      consumedAt: new Date().toISOString(),
      bottleNameSnapshot: 'Château Margaux',
      bottleCategorySnapshot: 'wine',
    });

    const rows = await db.select().from(bottles);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Château Margaux');

    const history = await db.select().from(consumptionHistory);
    expect(history).toHaveLength(1);
    expect(history[0].bottleNameSnapshot).toBe('Château Margaux');
  });
});
```

- [ ] **Step 6: Lancer le test**

Run: `yarn test src/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: define database schema and test db helper"
```

---

### Task 3: Hashage des mots de passe

**Files:**
- Create: `src/domain/auth.ts`
- Test: `src/domain/auth.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`,
  `verifyPassword(password: string, hash: string): Promise<boolean>`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/auth.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('auth', () => {
  it('vérifie un mot de passe correct', async () => {
    const hash = await hashPassword('mon-mot-de-passe');
    expect(await verifyPassword('mon-mot-de-passe', hash)).toBe(true);
  });

  it('rejette un mot de passe incorrect', async () => {
    const hash = await hashPassword('mon-mot-de-passe');
    expect(await verifyPassword('autre-chose', hash)).toBe(false);
  });

  it('génère un hash différent à chaque appel (salage)', async () => {
    const hash1 = await hashPassword('mon-mot-de-passe');
    const hash2 = await hashPassword('mon-mot-de-passe');
    expect(hash1).not.toBe(hash2);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Implémenter**

Créer `src/domain/auth.ts` :

```ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add password hashing helpers"
```

---

### Task 4: Statut et progression de la fenêtre de garde

**Files:**
- Create: `src/domain/gardeStatus.ts`
- Test: `src/domain/gardeStatus.test.ts`

**Interfaces:**
- Produces: `type GardeStatus = 'too_young' | 'ready' | 'closing_window' | 'unknown'`,
  `computeGardeStatus(drinkFrom: number | null, drinkUntil: number | null, currentYear: number): GardeStatus`,
  `computeGardeProgress(vintage: number | null, drinkUntil: number | null, currentYear: number): number`
  (fraction entre 0 et 1, utilisée pour la jauge de la fiche bouteille).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/gardeStatus.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { computeGardeStatus, computeGardeProgress } from './gardeStatus';

describe('computeGardeStatus', () => {
  it('retourne "unknown" si la fenêtre n’est pas connue', () => {
    expect(computeGardeStatus(null, null, 2026)).toBe('unknown');
  });

  it('retourne "too_young" avant le début de la fenêtre', () => {
    expect(computeGardeStatus(2028, 2035, 2026)).toBe('too_young');
  });

  it('retourne "ready" au milieu de la fenêtre', () => {
    expect(computeGardeStatus(2020, 2032, 2026)).toBe('ready');
  });

  it('retourne "closing_window" à 2 ans ou moins de la fin', () => {
    expect(computeGardeStatus(2020, 2028, 2026)).toBe('closing_window');
  });

  it('retourne "closing_window" après la fin de la fenêtre', () => {
    expect(computeGardeStatus(2010, 2020, 2026)).toBe('closing_window');
  });
});

describe('computeGardeProgress', () => {
  it('retourne 0 si les bornes sont inconnues', () => {
    expect(computeGardeProgress(null, null, 2026)).toBe(0);
  });

  it('retourne une valeur entre 0 et 1 au milieu de la fenêtre', () => {
    const progress = computeGardeProgress(2015, 2035, 2025);
    expect(progress).toBeCloseTo(0.5, 1);
  });

  it('clampe à 1 après la fin de la fenêtre', () => {
    expect(computeGardeProgress(2015, 2020, 2030)).toBe(1);
  });

  it('clampe à 0 avant le millésime', () => {
    expect(computeGardeProgress(2020, 2035, 2015)).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/gardeStatus.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/gardeStatus.ts` :

```ts
export type GardeStatus = 'too_young' | 'ready' | 'closing_window' | 'unknown';

export function computeGardeStatus(
  drinkFrom: number | null,
  drinkUntil: number | null,
  currentYear: number,
): GardeStatus {
  if (drinkFrom == null || drinkUntil == null) return 'unknown';
  if (currentYear < drinkFrom) return 'too_young';
  if (currentYear >= drinkUntil - 2) return 'closing_window';
  return 'ready';
}

export function computeGardeProgress(
  vintage: number | null,
  drinkUntil: number | null,
  currentYear: number,
): number {
  if (vintage == null || drinkUntil == null || drinkUntil <= vintage) return 0;
  const fraction = (currentYear - vintage) / (drinkUntil - vintage);
  return Math.min(1, Math.max(0, fraction));
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/gardeStatus.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add garde/apogee status and progress calculation"
```

---

### Task 5: Validation des champs spécifiques par catégorie

**Files:**
- Create: `src/domain/bottleCategories.ts`
- Test: `src/domain/bottleCategories.test.ts`

**Interfaces:**
- Produces: `type BottleCategory = 'wine' | 'sparkling' | 'cider' | 'beer' | 'spirit'`,
  `detailsSchemaByCategory` (record de schémas Zod), `parseBottleDetails(category: BottleCategory, details: unknown)`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/bottleCategories.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { parseBottleDetails } from './bottleCategories';

describe('parseBottleDetails', () => {
  it('valide des détails de vin corrects', () => {
    const result = parseBottleDetails('wine', {
      grapeVarieties: ['Merlot', 'Cabernet Franc'],
      appellation: 'Saint-Émilion',
    });
    expect(result.grapeVarieties).toEqual(['Merlot', 'Cabernet Franc']);
  });

  it('applique une valeur par défaut pour les champs optionnels manquants', () => {
    const result = parseBottleDetails('wine', {});
    expect(result.grapeVarieties).toEqual([]);
  });

  it('valide des détails de cidre corrects', () => {
    const result = parseBottleDetails('cider', {
      appleVarieties: ['Douce Coët Ligné'],
      method: 'fermier',
      sweetness: 'brut',
    });
    expect(result.method).toBe('fermier');
  });

  it('rejette une méthode de cidre invalide', () => {
    expect(() => parseBottleDetails('cider', { method: 'industriel' })).toThrow();
  });

  it('valide des détails de spiritueux corrects', () => {
    const result = parseBottleDetails('spirit', { spiritType: 'Whisky', age: 12 });
    expect(result.age).toBe(12);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/bottleCategories.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/bottleCategories.ts` :

```ts
import { z } from 'zod';

export const wineDetailsSchema = z.object({
  grapeVarieties: z.array(z.string()).default([]),
  appellation: z.string().optional(),
  classification: z.string().optional(),
});

export const sparklingDetailsSchema = z.object({
  grapeVarieties: z.array(z.string()).default([]),
  dosage: z.string().optional(),
  method: z.string().optional(),
  disgorgementDate: z.string().optional(),
});

export const ciderDetailsSchema = z.object({
  appleVarieties: z.array(z.string()).default([]),
  method: z.enum(['bouche', 'fermier']).optional(),
  sweetness: z.enum(['doux', 'brut']).optional(),
});

export const beerDetailsSchema = z.object({
  style: z.string().optional(),
  ibu: z.number().optional(),
  ebc: z.number().optional(),
  fermentation: z.string().optional(),
});

export const spiritDetailsSchema = z.object({
  spiritType: z.string().optional(),
  cask: z.string().optional(),
  age: z.number().optional(),
  origin: z.string().optional(),
});

export const detailsSchemaByCategory = {
  wine: wineDetailsSchema,
  sparkling: sparklingDetailsSchema,
  cider: ciderDetailsSchema,
  beer: beerDetailsSchema,
  spirit: spiritDetailsSchema,
} as const;

export type BottleCategory = keyof typeof detailsSchemaByCategory;

export function parseBottleDetails(category: BottleCategory, details: unknown) {
  return detailsSchemaByCategory[category].parse(details);
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/bottleCategories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add per-category bottle details validation"
```

---

### Task 6: Bootstrap du super-admin et de sa première cave

**Files:**
- Create: `src/domain/bootstrap.ts`, `scripts/bootstrap.ts`
- Test: `src/domain/bootstrap.test.ts`

**Interfaces:**
- Consumes: `Db` (Task 2), `hashPassword`/`verifyPassword` (Task 3), `newId` (Task 2).
- Produces: `bootstrapSuperAdmin(db: Db, params: { email: string; password: string; cellarName: string }): Promise<{ userId: string; cellarId: string }>`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/bootstrap.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { verifyPassword } from './auth';
import { users, cellars, cellarMemberships } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('bootstrapSuperAdmin', () => {
  it('crée un utilisateur super-admin et sa première cave', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'un-mot-de-passe-solide',
      cellarName: 'Ma Cave',
    });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('admin@example.com');
    expect(user.isSuperAdmin).toBe(true);
    expect(await verifyPassword('un-mot-de-passe-solide', user.passwordHash)).toBe(true);

    const [cellar] = await db.select().from(cellars).where(eq(cellars.id, cellarId));
    expect(cellar.name).toBe('Ma Cave');
    expect(cellar.ownerId).toBe(userId);

    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.cellarId, cellarId));
    expect(membership.role).toBe('owner');
    expect(membership.userId).toBe(userId);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/bootstrap.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/bootstrap.ts` :

```ts
import type { Db } from '../db/client';
import { users, cellars, cellarMemberships } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';

export interface BootstrapParams {
  email: string;
  password: string;
  cellarName: string;
}

export async function bootstrapSuperAdmin(db: Db, params: BootstrapParams) {
  const now = new Date().toISOString();
  const userId = newId();
  await db.insert(users).values({
    id: userId,
    email: params.email,
    passwordHash: await hashPassword(params.password),
    isSuperAdmin: true,
    createdAt: now,
  });

  const cellarId = newId();
  await db.insert(cellars).values({
    id: cellarId,
    name: params.cellarName,
    ownerId: userId,
    aiEnabled: true,
    createdAt: now,
  });

  await db.insert(cellarMemberships).values({
    id: newId(),
    cellarId,
    userId,
    role: 'owner',
    createdAt: now,
  });

  return { userId, cellarId };
}
```

Créer `scripts/bootstrap.ts` :

```ts
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
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/bootstrap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add super-admin bootstrap script"
```

---

### Task 7: Authentification (domaine + routes de session)

**Files:**
- Create: `src/domain/authenticate.ts`, `src/domain/session.ts`,
  `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`
- Test: `src/domain/authenticate.test.ts`

**Interfaces:**
- Consumes: `bootstrapSuperAdmin` (Task 6), `verifyPassword` (Task 3).
- Produces: `authenticateUser(db: Db, email: string, password: string): Promise<{ id: string; email: string; isSuperAdmin: boolean } | null>`,
  `getSession(): Promise<IronSession<SessionData>>` avec `SessionData = { userId?: string }`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/authenticate.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { authenticateUser } from './authenticate';

describe('authenticateUser', () => {
  it('retourne l’utilisateur si email et mot de passe sont corrects', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'bon-mot-de-passe',
      cellarName: 'Ma Cave',
    });

    const user = await authenticateUser(db, 'admin@example.com', 'bon-mot-de-passe');
    expect(user).not.toBeNull();
    expect(user?.email).toBe('admin@example.com');
  });

  it('retourne null si le mot de passe est incorrect', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'bon-mot-de-passe',
      cellarName: 'Ma Cave',
    });

    expect(await authenticateUser(db, 'admin@example.com', 'mauvais')).toBeNull();
  });

  it('retourne null si l’email est inconnu', async () => {
    const db = await createTestDb();
    expect(await authenticateUser(db, 'inconnu@example.com', 'peu-importe')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/authenticate.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le domaine**

Créer `src/domain/authenticate.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { verifyPassword } from './auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  isSuperAdmin: boolean;
}

export async function authenticateUser(
  db: Db,
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/authenticate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Configurer la session (pas de test automatisé — colle framework)**

Créer `src/domain/session.ts` :

```ts
import { getIronSession, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  userId?: string;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'cave_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 90,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
```

- [ ] **Step 6: Routes de connexion et déconnexion**

Créer `src/app/api/auth/login/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { authenticateUser } from '@/domain/authenticate';
import { getSession } from '@/domain/session';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  const user = await authenticateUser(db, body.email, body.password);
  if (!user) {
    return NextResponse.json({ error: 'Identifiants invalides' }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

Créer `src/app/api/auth/logout/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { getSession } from '@/domain/session';

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add authentication domain logic and session routes"
```

---

### Task 8: Contrôle d'accès aux caves et garde de page

**Files:**
- Create: `src/domain/access.ts`, `src/lib/requireUser.ts`, `src/app/(app)/layout.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/domain/access.test.ts`

**Interfaces:**
- Consumes: `Db`, `getSession` (Task 7).
- Produces: `type CellarRole = 'owner' | 'editor' | 'reader' | 'super_admin'`,
  `checkCellarAccess(db: Db, userId: string, cellarId: string): Promise<{ allowed: true; role: CellarRole } | { allowed: false }>`,
  `requireUser(): Promise<{ id: string; email: string; isSuperAdmin: boolean }>` (redirige
  vers `/login` si absent — utilisé par toutes les pages protégées suivantes).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/access.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { checkCellarAccess } from './access';
import { users } from '../db/schema';
import { newId } from '../db/id';
import { hashPassword } from './auth';

describe('checkCellarAccess', () => {
  it('autorise le super-admin même sans membership', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    const result = await checkCellarAccess(db, userId, cellarId);
    expect(result).toEqual({ allowed: true, role: 'super_admin' });
  });

  it('autorise un membre owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    // le bootstrap crée déjà le membership owner pour son propre user ; on le relit via un user non-admin dédié
    const result = await checkCellarAccess(db, (await db.select().from(users))[0].id, cellarId);
    expect(result.allowed).toBe(true);
  });

  it('refuse un utilisateur sans lien avec la cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Ma Cave',
    });
    const otherId = newId();
    await db.insert(users).values({
      id: otherId,
      email: 'autre@example.com',
      passwordHash: await hashPassword('x'),
      isSuperAdmin: false,
      createdAt: new Date().toISOString(),
    });
    const result = await checkCellarAccess(db, otherId, cellarId);
    expect(result).toEqual({ allowed: false });
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/access.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/access.ts` :

```ts
import { eq, and } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cellarMemberships, users } from '../db/schema';

export type CellarRole = 'owner' | 'editor' | 'reader' | 'super_admin';
export type AccessResult = { allowed: true; role: CellarRole } | { allowed: false };

export async function checkCellarAccess(db: Db, userId: string, cellarId: string): Promise<AccessResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { allowed: false };
  if (user.isSuperAdmin) return { allowed: true, role: 'super_admin' };

  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(and(eq(cellarMemberships.cellarId, cellarId), eq(cellarMemberships.userId, userId)))
    .limit(1);

  if (!membership) return { allowed: false };
  return { allowed: true, role: membership.role as CellarRole };
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/access.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Garde de page (pas de test automatisé — colle framework)**

Créer `src/lib/requireUser.ts` :

```ts
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getSession } from '@/domain/session';

export async function requireUser() {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect('/login');

  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
```

- [ ] **Step 6: Layout protégé avec navigation**

Créer `src/app/(app)/layout.tsx` :

```tsx
import Link from 'next/link';
import { requireUser } from '@/lib/requireUser';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div>
      <header className="bg-forest text-cream px-5 py-4 flex items-center justify-between">
        <span className="font-serif italic text-lg">Ma Cave</span>
        <nav className="flex gap-4 text-xs uppercase tracking-wide">
          <Link href="/cave">Cave</Link>
          <Link href="/historique">Historique</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Déconnexion</button>
          </form>
        </nav>
      </header>
      <main className="p-4 max-w-5xl mx-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Rediriger la page d'accueil**

Remplacer `src/app/page.tsx` :

```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/cave');
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add cellar access control and protected app layout"
```

---

### Task 9: Page de connexion

**Files:**
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 7).

- [ ] **Step 1: Écrire la page de connexion**

Créer `src/app/login/page.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Une erreur est survenue');
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-6">Ma Cave</h1>
        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
        <label className="block text-xs uppercase tracking-wide mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
          required
        />
        <label className="block text-xs uppercase tracking-wide mb-1">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 mb-6 text-sm"
          required
        />
        <button type="submit" className="w-full bg-forest text-cream rounded py-2 text-sm">
          Se connecter
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add login page"
```

---

### Task 10: Domaine et API des clayettes

**Files:**
- Create: `src/domain/crates.ts`, `src/app/api/crates/route.ts`,
  `src/app/api/crates/[id]/route.ts`
- Test: `src/domain/crates.test.ts`

**Interfaces:**
- Consumes: `Db`, `newId` (Task 2).
- Produces: `createCrate(db, input): Promise<string>`,
  `listCrates(db, cellarId): Promise<Crate[]>`,
  `renameCrate(db, crateId, name): Promise<void>`,
  `deleteCrate(db, crateId): Promise<void>`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/crates.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate, listCrates, renameCrate, deleteCrate } from './crates';

describe('crates', () => {
  it('crée puis liste une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });

    await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const crates = await listCrates(db, cellarId);
    expect(crates).toHaveLength(1);
    expect(crates[0].name).toBe('Clayette 1');
    expect(crates[0].capacity).toBe(12);
  });

  it('renomme une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Ancien nom', capacity: 6 });
    await renameCrate(db, crateId, 'Nouveau nom');
    const crates = await listCrates(db, cellarId);
    expect(crates[0].name).toBe('Nouveau nom');
  });

  it('supprime une clayette', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'À supprimer', capacity: 6 });
    await deleteCrate(db, crateId);
    expect(await listCrates(db, cellarId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/crates.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter le domaine**

Créer `src/domain/crates.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { crates } from '../db/schema';
import { newId } from '../db/id';

export interface CreateCrateInput {
  cellarId: string;
  name: string;
  capacity: number;
}

export async function createCrate(db: Db, input: CreateCrateInput): Promise<string> {
  const id = newId();
  await db.insert(crates).values({
    id,
    cellarId: input.cellarId,
    name: input.name,
    capacity: input.capacity,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listCrates(db: Db, cellarId: string) {
  return db.select().from(crates).where(eq(crates.cellarId, cellarId)).orderBy(crates.sortOrder);
}

export async function renameCrate(db: Db, crateId: string, name: string): Promise<void> {
  await db.update(crates).set({ name }).where(eq(crates.id, crateId));
}

export async function deleteCrate(db: Db, crateId: string): Promise<void> {
  await db.delete(crates).where(eq(crates.id, crateId));
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/crates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Routes API (pas de test automatisé — colle framework)**

Créer `src/app/api/crates/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { createCrate, listCrates } from '@/domain/crates';

export async function GET(request: Request) {
  const user = await requireUser();
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listCrates(db, cellarId));
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = await request.json();
  const access = await checkCellarAccess(db, user.id, body.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const id = await createCrate(db, {
    cellarId: body.cellarId,
    name: body.name,
    capacity: body.capacity,
  });
  return NextResponse.json({ id });
}
```

Créer `src/app/api/crates/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { renameCrate, deleteCrate } from '@/domain/crates';
import { db } from '@/db/client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const body = await request.json();
  await renameCrate(db, id, body.name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  await deleteCrate(db, id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add crate domain logic and API routes"
```

---

### Task 11: Page de gestion des clayettes

**Files:**
- Create: `src/app/(app)/cave/clayettes/page.tsx`, `src/components/CrateManager.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/crates`, `PATCH/DELETE /api/crates/[id]` (Task 10),
  `requireUser` (Task 8).

- [ ] **Step 1: Composant client de gestion des clayettes**

Créer `src/components/CrateManager.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Crate {
  id: string;
  name: string;
  capacity: number;
}

export function CrateManager({ cellarId, initialCrates }: { cellarId: string; initialCrates: Crate[] }) {
  const router = useRouter();
  const [crates, setCrates] = useState(initialCrates);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(12);

  async function addCrate(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/crates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellarId, name, capacity }),
    });
    const data = await response.json();
    setCrates([...crates, { id: data.id, name, capacity }]);
    setName('');
    router.refresh();
  }

  async function removeCrate(id: string) {
    await fetch(`/api/crates/${id}`, { method: 'DELETE' });
    setCrates(crates.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addCrate} className="flex gap-2 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Clayette 3 — Cidres"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Capacité</label>
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
            min={1}
            required
          />
        </div>
        <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Ajouter
        </button>
      </form>

      <ul className="divide-y divide-gray-200 bg-white rounded">
        {crates.map((crate) => (
          <li key={crate.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{crate.name} ({crate.capacity} emplacements)</span>
            <button onClick={() => removeCrate(crate.id)} className="text-red-700 text-xs">
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Page serveur**

Créer `src/app/(app)/cave/clayettes/page.tsx` :

```tsx
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { listCrates } from '@/domain/crates';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CrateManager } from '@/components/CrateManager';

export default async function ClayettesPage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .limit(1);

  const crates = membership ? await listCrates(db, membership.cellarId) : [];

  return (
    <div>
      <h2 className="text-lg mb-4">Gérer les clayettes</h2>
      {membership ? (
        <CrateManager cellarId={membership.cellarId} initialCrates={crates} />
      ) : (
        <p className="text-sm">Aucune cave associée à ce compte.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add crate management page"
```

---

### Task 12: Domaine des bouteilles (création, listage actif/complet)

**Files:**
- Create: `src/domain/bottles.ts`
- Test: `src/domain/bottles.test.ts`

**Interfaces:**
- Consumes: `parseBottleDetails`, `BottleCategory` (Task 5), `Db`, `newId` (Task 2).
- Produces: `createBottle(db, input): Promise<string>`,
  `listBottlesByCellar(db, cellarId): Promise<BottleWithCrate[]>` (toutes, y compris
  épuisées), `listActiveBottlesByCellar(db, cellarId): Promise<BottleWithCrate[]>`
  (quantité > 0 uniquement — utilisée par la vue cave).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/bottles.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle, listBottlesByCellar, listActiveBottlesByCellar } from './bottles';

describe('bottles', () => {
  it('crée une bouteille avec des détails valides pour sa catégorie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Château Margaux',
      quantity: 1,
      details: { grapeVarieties: ['Cabernet Sauvignon'] },
    });

    const bottles = await listBottlesByCellar(db, cellarId);
    expect(bottles).toHaveLength(1);
    expect(bottles[0].bottle.name).toBe('Château Margaux');
  });

  it('rejette des détails invalides pour la catégorie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    await expect(
      createBottle(db, {
        crateId,
        category: 'cider',
        name: 'Cidre du Perche',
        quantity: 1,
        details: { method: 'industriel' },
      }),
    ).rejects.toThrow();
  });

  it('isole les bouteilles par cave', async () => {
    const db = await createTestDb();
    const cave1 = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave 1' });
    const cave2 = await bootstrapSuperAdmin(db, { email: 'b@example.com', password: 'x', cellarName: 'Cave 2' });
    const crate1 = await createCrate(db, { cellarId: cave1.cellarId, name: 'C1', capacity: 6 });
    const crate2 = await createCrate(db, { cellarId: cave2.cellarId, name: 'C2', capacity: 6 });

    await createBottle(db, { crateId: crate1, category: 'wine', name: 'Vin A', quantity: 1, details: {} });
    await createBottle(db, { crateId: crate2, category: 'wine', name: 'Vin B', quantity: 1, details: {} });

    const bottlesCave1 = await listBottlesByCellar(db, cave1.cellarId);
    expect(bottlesCave1).toHaveLength(1);
    expect(bottlesCave1[0].bottle.name).toBe('Vin A');
  });

  it('exclut les bouteilles épuisées de la liste active', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });

    await createBottle(db, { crateId, category: 'wine', name: 'Épuisée', quantity: 0, details: {} });
    await createBottle(db, { crateId, category: 'wine', name: 'Disponible', quantity: 2, details: {} });

    const active = await listActiveBottlesByCellar(db, cellarId);
    expect(active).toHaveLength(1);
    expect(active[0].bottle.name).toBe('Disponible');

    const all = await listBottlesByCellar(db, cellarId);
    expect(all).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/bottles.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/bottles.ts` :

```ts
import { eq, and, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bottles, crates } from '../db/schema';
import { newId } from '../db/id';
import { parseBottleDetails, type BottleCategory } from './bottleCategories';

export interface CreateBottleInput {
  crateId: string;
  category: BottleCategory;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  color?: string;
  abv?: number;
  volumeMl?: number;
  quantity: number;
  drinkFrom?: number;
  drinkUntil?: number;
  details: unknown;
}

export async function createBottle(db: Db, input: CreateBottleInput): Promise<string> {
  const details = parseBottleDetails(input.category, input.details);
  const id = newId();
  await db.insert(bottles).values({
    id,
    crateId: input.crateId,
    category: input.category,
    name: input.name,
    producer: input.producer ?? null,
    vintage: input.vintage ?? null,
    region: input.region ?? null,
    color: input.color ?? null,
    abv: input.abv ?? null,
    volumeMl: input.volumeMl ?? null,
    quantity: input.quantity,
    drinkFrom: input.drinkFrom ?? null,
    drinkUntil: input.drinkUntil ?? null,
    details,
    userNote: null,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function listBottlesByCellar(db: Db, cellarId: string) {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(eq(crates.cellarId, cellarId));
}

export async function listActiveBottlesByCellar(db: Db, cellarId: string) {
  return db
    .select({ bottle: bottles, crate: crates })
    .from(bottles)
    .innerJoin(crates, eq(bottles.crateId, crates.id))
    .where(and(eq(crates.cellarId, cellarId), gt(bottles.quantity, 0)));
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/bottles.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add bottle creation and cellar-scoped listing"
```

---

### Task 13: Domaine et API du détail/mise à jour d'une bouteille

**Files:**
- Create: `src/app/api/bottles/route.ts`, `src/app/api/bottles/[id]/route.ts`
- Modify: `src/domain/bottles.ts`
- Test: `src/domain/bottles.test.ts` (ajout de cas)

**Interfaces:**
- Produces: `getBottle(db, bottleId): Promise<Bottle | null>`,
  `updateBottle(db, bottleId, input): Promise<void>`,
  `deleteBottle(db, bottleId): Promise<void>`.

- [ ] **Step 1: Ajouter les tests qui échouent**

Ajouter à `src/domain/bottles.test.ts` :

```ts
import { getBottle, updateBottle, deleteBottle } from './bottles';

describe('getBottle / updateBottle / deleteBottle', () => {
  it('retourne null pour un identifiant inconnu', async () => {
    const db = await createTestDb();
    expect(await getBottle(db, 'inconnu')).toBeNull();
  });

  it('met à jour la note personnelle et la quantité', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });

    await updateBottle(db, bottleId, { userNote: 'Superbe avec un gigot', quantity: 1 });
    const bottle = await getBottle(db, bottleId);
    expect(bottle?.userNote).toBe('Superbe avec un gigot');
    expect(bottle?.quantity).toBe(1);
  });

  it('supprime une bouteille', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await deleteBottle(db, bottleId);
    expect(await getBottle(db, bottleId)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/bottles.test.ts`
Expected: FAIL — `getBottle`/`updateBottle`/`deleteBottle` non exportés.

- [ ] **Step 3: Implémenter**

Ajouter à `src/domain/bottles.ts` :

```ts
export async function getBottle(db: Db, bottleId: string) {
  const [row] = await db.select().from(bottles).where(eq(bottles.id, bottleId)).limit(1);
  return row ?? null;
}

export interface UpdateBottleInput {
  name?: string;
  quantity?: number;
  userNote?: string | null;
  drinkFrom?: number | null;
  drinkUntil?: number | null;
}

export async function updateBottle(db: Db, bottleId: string, input: UpdateBottleInput): Promise<void> {
  await db.update(bottles).set(input).where(eq(bottles.id, bottleId));
}

export async function deleteBottle(db: Db, bottleId: string): Promise<void> {
  await db.delete(bottles).where(eq(bottles.id, bottleId));
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/bottles.test.ts`
Expected: PASS (7 tests au total).

- [ ] **Step 5: Routes API (pas de test automatisé — colle framework)**

Créer `src/app/api/bottles/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { createBottle, listActiveBottlesByCellar } from '@/domain/bottles';

export async function GET(request: Request) {
  const user = await requireUser();
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listActiveBottlesByCellar(db, cellarId));
}

export async function POST(request: Request) {
  await requireUser();
  const body = await request.json();
  try {
    const id = await createBottle(db, body);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: 'Détails invalides pour cette catégorie' }, { status: 400 });
  }
}
```

Créer `src/app/api/bottles/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { db } from '@/db/client';
import { getBottle, updateBottle, deleteBottle } from '@/domain/bottles';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const bottle = await getBottle(db, id);
  if (!bottle) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(bottle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const body = await request.json();
  await updateBottle(db, id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  await deleteBottle(db, id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add bottle detail, update and delete API routes"
```

---

### Task 14: Page de vue de la cave

**Files:**
- Create: `src/app/(app)/cave/page.tsx`, `src/components/CrateCard.tsx`

**Interfaces:**
- Consumes: `listCrates` (Task 10), `listActiveBottlesByCellar` (Task 12), `requireUser`
  (Task 8).

- [ ] **Step 1: Composant carte de clayette**

Créer `src/components/CrateCard.tsx` :

```tsx
'use client';

import Link from 'next/link';

interface BottleRow {
  id: string;
  name: string;
  vintage: number | null;
  quantity: number;
  color: string | null;
}

export function CrateCard({ name, capacity, bottles }: { name: string; capacity: number; bottles: BottleRow[] }) {
  const occupied = bottles.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <h4 className="text-sm italic">{name}</h4>
        <span className="text-xs text-gray-500">{occupied}/{capacity}</span>
      </div>
      <div className="bg-white rounded shadow-sm divide-y divide-gray-100">
        {bottles.length === 0 && <p className="text-xs text-gray-400 px-3 py-3">Aucune bouteille</p>}
        {bottles.map((bottle) => (
          <Link
            key={bottle.id}
            href={`/bottles/${bottle.id}`}
            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <span className="flex-1">{bottle.name}</span>
            <span className="text-xs text-gray-500">{bottle.vintage ?? 'NV'}</span>
            <span className="text-xs bg-green-50 text-green-800 rounded-full px-2 py-0.5">×{bottle.quantity}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page serveur de la vue cave**

Créer `src/app/(app)/cave/page.tsx` :

```tsx
import Link from 'next/link';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCrates } from '@/domain/crates';
import { listActiveBottlesByCellar } from '@/domain/bottles';
import { CrateCard } from '@/components/CrateCard';

export default async function CavePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .limit(1);

  if (!membership) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const crates = await listCrates(db, membership.cellarId);
  const bottleRows = await listActiveBottlesByCellar(db, membership.cellarId);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg">Ma Cave</h2>
        <div className="flex gap-3 text-sm">
          <Link href="/cave/clayettes" className="text-forest underline">Gérer les clayettes</Link>
          <Link href="/cave/ajouter" className="bg-forest text-cream rounded px-3 py-1.5">+ Ajouter</Link>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {crates.map((crate) => (
          <CrateCard
            key={crate.id}
            name={crate.name}
            capacity={crate.capacity}
            bottles={bottleRows
              .filter((row) => row.crate.id === crate.id)
              .map((row) => ({
                id: row.bottle.id,
                name: row.bottle.name,
                vintage: row.bottle.vintage,
                quantity: row.bottle.quantity,
                color: row.bottle.color,
              }))}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add cellar overview page"
```

---

### Task 15: Flux d'ajout d'une bouteille

**Files:**
- Create: `src/app/(app)/cave/ajouter/page.tsx`, `src/components/AddBottleForm.tsx`

**Interfaces:**
- Consumes: `GET /api/crates`, `POST /api/bottles` (Tasks 10, 13).

- [ ] **Step 1: Formulaire d'ajout**

Créer `src/components/AddBottleForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Crate {
  id: string;
  name: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  wine: 'Vin',
  sparkling: 'Champagne / effervescent',
  cider: 'Cidre',
  beer: 'Bière',
  spirit: 'Spiritueux',
};

export function AddBottleForm({ crates }: { crates: Crate[] }) {
  const router = useRouter();
  const [crateId, setCrateId] = useState(crates[0]?.id ?? '');
  const [category, setCategory] = useState('wine');
  const [name, setName] = useState('');
  const [producer, setProducer] = useState('');
  const [vintage, setVintage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/bottles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crateId,
        category,
        name,
        producer: producer || undefined,
        vintage: vintage ? Number(vintage) : undefined,
        quantity,
        details: {},
      }),
    });
    if (!response.ok) {
      setError('Impossible d’ajouter cette bouteille.');
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-6 max-w-md space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Clayette</label>
        <select
          value={crateId}
          onChange={(e) => setCrateId(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          required
        >
          {crates.map((crate) => (
            <option key={crate.id} value={crate.id}>{crate.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Catégorie</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="Château Margaux"
          required
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Producteur</label>
        <input
          value={producer}
          onChange={(e) => setProducer(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Millésime</label>
          <input
            value={vintage}
            onChange={(e) => setVintage(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-28"
            placeholder="2015"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Quantité</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-24"
            min={1}
            required
          />
        </div>
      </div>

      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Ajouter à la cave
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Page serveur**

Créer `src/app/(app)/cave/ajouter/page.tsx` :

```tsx
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCrates } from '@/domain/crates';
import { AddBottleForm } from '@/components/AddBottleForm';

export default async function AddBottlePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .limit(1);

  const crates = membership ? await listCrates(db, membership.cellarId) : [];

  return (
    <div>
      <h2 className="text-lg mb-4">Ajouter une bouteille</h2>
      {crates.length === 0 ? (
        <p className="text-sm">Crée d’abord une clayette avant d’ajouter une bouteille.</p>
      ) : (
        <AddBottleForm crates={crates} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add bottle creation flow"
```

---

### Task 16: Page de détail d'une bouteille

**Files:**
- Create: `src/app/(app)/bottles/[id]/page.tsx` (route groups n'apparaissent pas dans
  l'URL : cette page reste accessible sur `/bottles/[id]` tout en héritant de la garde
  d'authentification et de la navigation du layout `(app)` défini à la Tâche 8),
  `src/components/GardeBadge.tsx`, `src/components/GardeGauge.tsx`,
  `src/components/UserNoteEditor.tsx`

**Interfaces:**
- Consumes: `getBottle` (Task 13), `computeGardeStatus`/`computeGardeProgress`
  (Task 4), `PATCH /api/bottles/[id]` (Task 13).

- [ ] **Step 1: Badge de statut**

Créer `src/components/GardeBadge.tsx` :

```tsx
import type { GardeStatus } from '@/domain/gardeStatus';

const LABELS: Record<GardeStatus, string> = {
  too_young: 'Trop jeune',
  ready: 'À boire maintenant',
  closing_window: 'À surveiller, fin de fenêtre',
  unknown: 'Fenêtre de garde inconnue',
};

const STYLES: Record<GardeStatus, string> = {
  too_young: 'bg-blue-50 text-blue-800',
  ready: 'bg-green-50 text-green-800',
  closing_window: 'bg-amber-50 text-amber-800',
  unknown: 'bg-gray-100 text-gray-600',
};

export function GardeBadge({ status }: { status: GardeStatus }) {
  return (
    <span className={`text-xs px-3 py-1 rounded-full ${STYLES[status]}`}>
      ● {LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 2: Jauge de progression**

Créer `src/components/GardeGauge.tsx` :

```tsx
export function GardeGauge({
  progress,
  vintage,
  drinkFrom,
  drinkUntil,
}: {
  progress: number;
  vintage: number | null;
  drinkFrom: number | null;
  drinkUntil: number | null;
}) {
  if (drinkFrom == null || drinkUntil == null) return null;

  return (
    <div>
      <div className="bg-gray-200 h-1.5 rounded-full relative">
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-gold to-sage"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>{vintage}</span>
        <span>Apogée {drinkFrom}–{drinkUntil}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Éditeur de note personnelle**

Créer `src/components/UserNoteEditor.tsx` :

```tsx
'use client';

import { useState } from 'react';

export function UserNoteEditor({ bottleId, initialNote }: { bottleId: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saved, setSaved] = useState(true);

  async function save() {
    await fetch(`/api/bottles/${bottleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userNote: note }),
    });
    setSaved(true);
  }

  return (
    <div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
        rows={3}
        placeholder="Ajouter une note ou corriger l’analyse…"
      />
      {!saved && (
        <button onClick={save} className="mt-2 text-xs bg-forest text-cream rounded px-3 py-1.5">
          Enregistrer
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Page de détail**

Créer `src/app/(app)/bottles/[id]/page.tsx` :

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getBottle } from '@/domain/bottles';
import { computeGardeStatus, computeGardeProgress } from '@/domain/gardeStatus';
import { GardeBadge } from '@/components/GardeBadge';
import { GardeGauge } from '@/components/GardeGauge';
import { UserNoteEditor } from '@/components/UserNoteEditor';

export default async function BottleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bottle = await getBottle(db, id);
  if (!bottle) notFound();

  const currentYear = new Date().getFullYear();
  const status = computeGardeStatus(bottle.drinkFrom, bottle.drinkUntil, currentYear);
  const progress = computeGardeProgress(bottle.vintage, bottle.drinkUntil, currentYear);

  return (
    <div className="max-w-lg">
      <Link href="/cave" className="text-xs text-forest mb-2 inline-block">← Retour à la cave</Link>
      <h2 className="text-xl mb-1">{bottle.name}</h2>
      <p className="text-xs text-gray-500 mb-4">
        {bottle.vintage ?? 'NV'} · {bottle.region ?? '—'} · {bottle.category}
      </p>

      <div className="flex gap-2 mb-6">
        <GardeBadge status={status} />
        <span className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1">
          {bottle.quantity} bouteille{bottle.quantity > 1 ? 's' : ''} en cave
        </span>
      </div>

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Fenêtre de garde</h4>
        <GardeGauge
          progress={progress}
          vintage={bottle.vintage}
          drinkFrom={bottle.drinkFrom}
          drinkUntil={bottle.drinkUntil}
        />
      </section>

      {bottle.aiAnalysis && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Analyse</h4>
          <p className="text-sm italic font-serif">{bottle.aiAnalysis}</p>
        </section>
      )}

      {bottle.aiTastingAdvice && (
        <section className="mb-6">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Conseils de dégustation</h4>
          <p className="text-sm italic font-serif">{bottle.aiTastingAdvice}</p>
        </section>
      )}

      <section className="mb-6">
        <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ta note</h4>
        <UserNoteEditor bottleId={bottle.id} initialNote={bottle.userNote} />
      </section>

      <a
        href={`/bottles/${bottle.id}/consommer`}
        className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Consommer une bouteille
      </a>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add bottle detail page with garde status"
```

---

### Task 17: Domaine et API de consommation

**Files:**
- Create: `src/domain/consume.ts`, `src/app/api/bottles/[id]/consume/route.ts`
- Test: `src/domain/consume.test.ts`

**Interfaces:**
- Consumes: `Db`, `bottles`, `consumptionHistory` (Task 2).
- Produces: `class BottleUnavailableError extends Error`,
  `consumeBottle(db, input): Promise<string>` (retourne l'id de l'entrée d'historique).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/consume.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle, getBottle } from './bottles';
import { consumeBottle, BottleUnavailableError } from './consume';
import { consumptionHistory } from '../db/schema';

describe('consumeBottle', () => {
  it('décrémente la quantité et crée une entrée d’historique', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 2, details: {} });

    await consumeBottle(db, {
      bottleId,
      consumedByUserId: userId,
      consumedAt: '2026-09-06',
      rating: 4,
      comment: 'Excellent',
      occasion: 'Dîner',
    });

    const bottle = await getBottle(db, bottleId);
    expect(bottle?.quantity).toBe(1);

    const history = await db.select().from(consumptionHistory).where(eq(consumptionHistory.bottleId, bottleId));
    expect(history).toHaveLength(1);
    expect(history[0].rating).toBe(4);
    expect(history[0].bottleNameSnapshot).toBe('Vin');
    expect(history[0].cellarId).toBe(cellarId);
  });

  it('refuse de consommer une bouteille épuisée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 0, details: {} });

    await expect(
      consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: '2026-09-06' }),
    ).rejects.toBeInstanceOf(BottleUnavailableError);

    const history = await db.select().from(consumptionHistory).where(eq(consumptionHistory.bottleId, bottleId));
    expect(history).toHaveLength(0);
  });

  it('conserve la ligne de bouteille à quantité 0 après la dernière consommation', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });

    await consumeBottle(db, { bottleId, consumedByUserId: userId, consumedAt: '2026-09-06' });

    const bottle = await getBottle(db, bottleId);
    expect(bottle).not.toBeNull();
    expect(bottle?.quantity).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/consume.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/consume.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { bottles, crates, consumptionHistory } from '../db/schema';
import { newId } from '../db/id';

export class BottleUnavailableError extends Error {}

export interface ConsumeBottleInput {
  bottleId: string;
  consumedByUserId: string;
  consumedAt: string;
  rating?: number;
  comment?: string;
  occasion?: string;
}

async function getCellarIdForCrate(db: Db, crateId: string): Promise<string> {
  const [crate] = await db.select().from(crates).where(eq(crates.id, crateId)).limit(1);
  if (!crate) throw new Error('Clayette introuvable');
  return crate.cellarId;
}

export async function consumeBottle(db: Db, input: ConsumeBottleInput): Promise<string> {
  const [bottle] = await db.select().from(bottles).where(eq(bottles.id, input.bottleId)).limit(1);
  if (!bottle || bottle.quantity < 1) {
    throw new BottleUnavailableError('Aucune bouteille disponible à consommer');
  }

  await db.update(bottles).set({ quantity: bottle.quantity - 1 }).where(eq(bottles.id, bottle.id));

  const cellarId = await getCellarIdForCrate(db, bottle.crateId);
  const historyId = newId();
  await db.insert(consumptionHistory).values({
    id: historyId,
    bottleId: bottle.id,
    cellarId,
    consumedByUserId: input.consumedByUserId,
    consumedAt: input.consumedAt,
    rating: input.rating ?? null,
    comment: input.comment ?? null,
    occasion: input.occasion ?? null,
    bottleNameSnapshot: bottle.name,
    bottleProducerSnapshot: bottle.producer,
    bottleVintageSnapshot: bottle.vintage,
    bottleCategorySnapshot: bottle.category,
  });

  return historyId;
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/consume.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Route API (pas de test automatisé — colle framework)**

Créer `src/app/api/bottles/[id]/consume/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { db } from '@/db/client';
import { consumeBottle, BottleUnavailableError } from '@/domain/consume';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const historyId = await consumeBottle(db, {
      bottleId: id,
      consumedByUserId: user.id,
      consumedAt: body.consumedAt ?? new Date().toISOString().slice(0, 10),
      rating: body.rating,
      comment: body.comment,
      occasion: body.occasion,
    });
    return NextResponse.json({ historyId });
  } catch (err) {
    if (err instanceof BottleUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add bottle consumption domain logic and API route"
```

---

### Task 18: Flux UI de consommation

**Files:**
- Create: `src/app/(app)/bottles/[id]/consommer/page.tsx` (mêmes raisons de placement que
  la Tâche 16 — hérite de la garde d'authentification et de la navigation),
  `src/components/ConsumeForm.tsx`

**Interfaces:**
- Consumes: `POST /api/bottles/[id]/consume` (Task 17), `getBottle` (Task 13).

- [ ] **Step 1: Formulaire de consommation**

Créer `src/components/ConsumeForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ConsumeForm({ bottleId }: { bottleId: string }) {
  const router = useRouter();
  const [consumedAt, setConsumedAt] = useState(new Date().toISOString().slice(0, 10));
  const [rating, setRating] = useState(3);
  const [comment, setComment] = useState('');
  const [occasion, setOccasion] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/bottles/${bottleId}/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumedAt, rating, comment, occasion }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible d’enregistrer la consommation.');
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-6 max-w-md space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Date</label>
        <input
          type="date"
          value={consumedAt}
          onChange={(e) => setConsumedAt(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Note (0 à 5)</label>
        <input
          type="number"
          min={0}
          max={5}
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-20"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Occasion</label>
        <input
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="Dîner entre amis"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Commentaire</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Confirmer la consommation
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Page serveur**

Créer `src/app/(app)/bottles/[id]/consommer/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getBottle } from '@/domain/bottles';
import { ConsumeForm } from '@/components/ConsumeForm';

export default async function ConsumeBottlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bottle = await getBottle(db, id);
  if (!bottle) notFound();

  return (
    <div>
      <h2 className="text-lg mb-4">Consommer « {bottle.name} »</h2>
      <ConsumeForm bottleId={bottle.id} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add consumption flow UI"
```

---

### Task 19: Historique de consommation

**Files:**
- Create: `src/domain/history.ts`, `src/app/(app)/historique/page.tsx`
- Test: `src/domain/history.test.ts`

**Interfaces:**
- Produces: `listConsumptionHistory(db, cellarId): Promise<ConsumptionHistoryEntry[]>`
  (triée du plus récent au plus ancien).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/history.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle } from './bottles';
import { consumeBottle } from './consume';
import { listConsumptionHistory } from './history';

describe('listConsumptionHistory', () => {
  it('retourne uniquement l’historique de la cave demandée, du plus récent au plus ancien', async () => {
    const db = await createTestDb();
    const caveA = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });
    const caveB = await bootstrapSuperAdmin(db, { email: 'b@example.com', password: 'x', cellarName: 'Cave B' });

    const crateA = await createCrate(db, { cellarId: caveA.cellarId, name: 'C1', capacity: 6 });
    const crateB = await createCrate(db, { cellarId: caveB.cellarId, name: 'C1', capacity: 6 });

    const bottleA1 = await createBottle(db, { crateId: crateA, category: 'wine', name: 'Vin A1', quantity: 2, details: {} });
    const bottleA2 = await createBottle(db, { crateId: crateA, category: 'wine', name: 'Vin A2', quantity: 1, details: {} });
    const bottleB = await createBottle(db, { crateId: crateB, category: 'wine', name: 'Vin B', quantity: 1, details: {} });

    await consumeBottle(db, { bottleId: bottleA1, consumedByUserId: caveA.userId, consumedAt: '2026-01-01' });
    await consumeBottle(db, { bottleId: bottleA2, consumedByUserId: caveA.userId, consumedAt: '2026-06-01' });
    await consumeBottle(db, { bottleId: bottleB, consumedByUserId: caveB.userId, consumedAt: '2026-03-01' });

    const historyA = await listConsumptionHistory(db, caveA.cellarId);
    expect(historyA).toHaveLength(2);
    expect(historyA[0].bottleNameSnapshot).toBe('Vin A2');
    expect(historyA[1].bottleNameSnapshot).toBe('Vin A1');
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/history.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/history.ts` :

```ts
import { eq, desc } from 'drizzle-orm';
import type { Db } from '../db/client';
import { consumptionHistory } from '../db/schema';

export async function listConsumptionHistory(db: Db, cellarId: string) {
  return db
    .select()
    .from(consumptionHistory)
    .where(eq(consumptionHistory.cellarId, cellarId))
    .orderBy(desc(consumptionHistory.consumedAt));
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Page d'historique (pas de test automatisé — colle framework)**

Créer `src/app/(app)/historique/page.tsx` :

```tsx
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listConsumptionHistory } from '@/domain/history';

export default async function HistoriquePage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .limit(1);

  const entries = membership ? await listConsumptionHistory(db, membership.cellarId) : [];

  return (
    <div>
      <h2 className="text-lg mb-4">Historique</h2>
      <ul className="bg-white rounded divide-y divide-gray-100">
        {entries.map((entry) => (
          <li key={entry.id} className="px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="font-serif italic">{entry.bottleNameSnapshot}</span>
              <span className="text-xs text-gray-500">{entry.consumedAt}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {entry.occasion && <span>{entry.occasion} · </span>}
              {entry.rating != null && <span>Note {entry.rating}/5</span>}
            </div>
            {entry.comment && <p className="text-xs mt-1">{entry.comment}</p>}
          </li>
        ))}
        {entries.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">Aucune consommation enregistrée.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add consumption history page"
```

---

### Task 20: Vérification manuelle de bout en bout

**Files:** aucun fichier créé — vérification manuelle uniquement.

- [ ] **Step 1: Lancer la suite de tests complète**

Run: `yarn test`
Expected: tous les tests passent (schema, auth, gardeStatus, bottleCategories,
bootstrap, authenticate, access, crates, bottles, consume, history).

- [ ] **Step 2: Préparer l'environnement local**

```bash
cp .env.example .env
# éditer .env : définir SESSION_SECRET (chaîne aléatoire), BOOTSTRAP_EMAIL,
# BOOTSTRAP_PASSWORD, BOOTSTRAP_CELLAR_NAME
mkdir -p data
yarn db:migrate
yarn bootstrap
```

- [ ] **Step 3: Lancer l'application et vérifier le parcours complet**

```bash
yarn dev
```

Dans le navigateur (`http://localhost:3000`), vérifier dans l'ordre :
1. Redirection automatique vers `/login` si non connecté.
2. Connexion avec les identifiants du bootstrap → redirection vers `/cave`.
3. `/cave/clayettes` : créer deux clayettes (ex. "Bordeaux", "Champagne").
4. `/cave/ajouter` : ajouter une bouteille de vin avec millésime et quantité 2, puis
   une bouteille de champagne, puis une bouteille de cidre.
5. `/cave` : vérifier que les clayettes affichent bien les bonnes bouteilles et
   quantités, en grille sur desktop (fenêtre large) et empilées sur mobile (réduire la
   fenêtre ou utiliser les outils de développement en mode responsive).
6. Cliquer sur une bouteille → vérifier la fiche (badge "Fenêtre de garde inconnue"
   puisqu'aucune n'a été renseignée, note personnelle éditable).
7. Éditer la note personnelle, recharger la page, vérifier qu'elle est conservée.
8. Cliquer "Consommer une bouteille", remplir le formulaire, confirmer → vérifier que
   la quantité a diminué dans `/cave` et que l'entrée apparaît dans `/historique`.
9. Consommer la dernière unité d'une bouteille → vérifier qu'elle disparaît de `/cave`
   mais reste dans `/historique`.
10. Se déconnecter → vérifier la redirection vers `/login`.

- [ ] **Step 4: Consigner les écarts**

Si un des points ci-dessus échoue, corriger avant de considérer ce plan terminé — ce
socle sert de fondation à tous les plans suivants (IA, partage/admin, déploiement).
