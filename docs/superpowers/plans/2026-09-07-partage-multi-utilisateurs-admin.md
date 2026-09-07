# Partage Multi-Utilisateurs et Dashboard Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le partage d'une cave entre plusieurs comptes (invitations par
lien, rôles owner/éditeur/lecteur) et le dashboard super-admin (utilisateurs,
caves, réglages), par-dessus la base mono-utilisateur déjà livrée.

**Architecture:** Même stack et mêmes conventions que la base existante : logique
métier dans `src/domain/*` (fonctions prenant `Db` en paramètre, testées contre
`createTestDb()`), routes API en fine colle (`requireApiUser`/`requireSuperAdminApi`
+ appel domaine + réponse), pages serveur protégées (`requireUser`/`requireSuperAdmin`).
Deux nouveaux mécanismes de token à usage unique (invitation, reset de mot de
passe) suivant le même schéma : générer, afficher un lien à copier, valider à
l'usage.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Drizzle ORM +
`@libsql/client`, Zod, iron-session, bcryptjs, Vitest, Tailwind CSS v4, yarn.

**Spec:** `docs/superpowers/specs/2026-09-07-partage-multi-utilisateurs-admin-design.md`
(et `docs/superpowers/specs/2026-09-06-cave-a-vin-design.md` pour le contexte
produit global, sections 4 et 7).

## Global Constraints

- Gestionnaire de paquets : **yarn**. Node.js 22 (contrainte de `iron-session`,
  déjà en place). TypeScript `strict: true`.
- Toute l'interface est **en français**.
- SQLite via `@libsql/client` (jamais `better-sqlite3`).
- Palette "éditorial vert sauge" déjà en place (`bg-cream`, `bg-forest`,
  `text-cream`, `bg-sage`, `bg-gold` — tokens Tailwind v4 définis via `@theme`
  dans `src/app/globals.css`), à réutiliser telle quelle, pas de nouvelle
  couleur.
- Les fonctions de `src/domain/*` prennent `Db` en paramètre et n'importent
  jamais le singleton `db` — c'est ce qui les rend testables contre
  `createTestDb()`. Les routes/pages importent `db` depuis `@/db/client` et le
  passent explicitement.
- Toute route API protégée utilise `requireApiUser()` (401 JSON si session
  invalide/expirée) — jamais `requireUser()` (redirection), réservé aux pages.
  Toute page protégée utilise `requireUser()`.
- Tokens (invitation, reset de mot de passe) : `crypto.randomBytes(32).toString('hex')`
  — jamais devinables, générés côté serveur uniquement.
- Durée de vie : invitation 7 jours, lien de reset de mot de passe 24h.
- Un compte ne se crée que par acceptation d'une invitation valide, et
  seulement si `registration_enabled` est vrai **au moment de l'acceptation**
  (pas à la création de l'invitation).
- Le membership `owner` d'une cave ne peut jamais être modifié ni retiré
  depuis la liste des membres — une cave a toujours exactement un owner.
- `npx tsc --noEmit`, `yarn lint`, et la suite `yarn test` doivent rester
  propres après chaque tâche — ce projet a une histoire de régressions
  invisibles à `vitest run` seul (qui ne type-check pas), donc les deux
  commandes sont à lancer, pas seulement les tests.

---

### Task 1: Schéma — invitations, reset de mot de passe, réglages globaux, compte désactivable

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/db/migrations/0003_*.sql` (généré, nom exact choisi par
  `drizzle-kit`)
- Create: `src/domain/token.ts`
- Test: `src/domain/token.test.ts`

**Interfaces:**
- Produces: tables Drizzle `invitations`, `passwordResetTokens`, `appSettings` ;
  colonne `users.isActive` ; `generateToken(): string`.

- [ ] **Step 1: Écrire le test qui échoue pour `generateToken`**

Créer `src/domain/token.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { generateToken } from './token';

describe('generateToken', () => {
  it('génère une chaîne hexadécimale de 64 caractères (32 octets)', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('génère un token différent à chaque appel', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/token.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/token.ts` :

```ts
import { randomBytes } from 'node:crypto';

/** Token à usage unique (invitation, reset de mot de passe) — jamais devinable. */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/token.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Étendre le schéma**

Dans `src/db/schema.ts`, ajouter `isActive` à la table `users` existante (juste
après `isSuperAdmin`) :

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});
```

Puis ajouter, à la fin du fichier (après `consumptionHistory`), les trois
nouvelles tables :

```ts
export const invitations = sqliteTable('invitations', {
  id: text('id').primaryKey(),
  cellarId: text('cellar_id').notNull().references(() => cellars.id),
  email: text('email').notNull(),
  role: text('role', { enum: ['editor', 'reader'] }).notNull(),
  token: text('token').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'expired'] }).notNull().default('pending'),
  invitedByUserId: text('invited_by_user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
});

export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey(),
  registrationEnabled: integer('registration_enabled', { mode: 'boolean' }).notNull().default(true),
});
```

- [ ] **Step 6: Générer et appliquer la migration**

Run: `yarn db:generate`
Expected: un nouveau fichier `src/db/migrations/0003_*.sql` apparaît. Ouvrir ce
fichier et confirmer qu'il contient un `ALTER TABLE users ADD is_active
integer DEFAULT true NOT NULL` (ou équivalent) et trois `CREATE TABLE` pour
`invitations`, `password_reset_tokens`, `app_settings` — pas de recréation de
table nécessaire cette fois (une colonne avec `DEFAULT` s'ajoute directement en
SQLite, contrairement au changement de type de clé étrangère fait dans une
migration précédente).

Run: `yarn db:migrate`
Expected: `Migrations appliquées.`

- [ ] **Step 7: Vérifier que le reste compile toujours**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `yarn test`
Expected: tous les tests existants passent toujours (aucune régression).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add schema for invitations, password resets, app settings, account deactivation"
```

---

### Task 2: Permissions par rôle

**Files:**
- Create: `src/domain/permissions.ts`
- Test: `src/domain/permissions.test.ts`

**Interfaces:**
- Consumes: `CellarRole` (déjà exporté par `src/domain/access.ts`).
- Produces: `canManageCellar(role: CellarRole): boolean`,
  `canEditCellarContent(role: CellarRole): boolean`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/permissions.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { canManageCellar, canEditCellarContent } from './permissions';

describe('canManageCellar', () => {
  it('autorise owner et super_admin', () => {
    expect(canManageCellar('owner')).toBe(true);
    expect(canManageCellar('super_admin')).toBe(true);
  });

  it('refuse editor et reader', () => {
    expect(canManageCellar('editor')).toBe(false);
    expect(canManageCellar('reader')).toBe(false);
  });
});

describe('canEditCellarContent', () => {
  it('autorise owner, editor et super_admin', () => {
    expect(canEditCellarContent('owner')).toBe(true);
    expect(canEditCellarContent('editor')).toBe(true);
    expect(canEditCellarContent('super_admin')).toBe(true);
  });

  it('refuse reader', () => {
    expect(canEditCellarContent('reader')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/permissions.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/permissions.ts` :

```ts
import type { CellarRole } from './access';

/** Inviter/retirer un membre, changer un rôle, réglages de la cave. */
export function canManageCellar(role: CellarRole): boolean {
  return role === 'owner' || role === 'super_admin';
}

/** Créer/modifier/déplacer/supprimer une clayette ou une bouteille. */
export function canEditCellarContent(role: CellarRole): boolean {
  return role === 'owner' || role === 'editor' || role === 'super_admin';
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/permissions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cellar role permission helpers"
```

---

### Task 3: Comptes désactivables (authentification + gardes)

**Files:**
- Modify: `src/domain/authenticate.ts`
- Modify: `src/domain/authenticate.test.ts`
- Modify: `src/lib/requireUser.ts`
- Modify: `src/lib/requireApiUser.ts`

**Interfaces:**
- Consumes: `users.isActive` (Task 1).
- Produces: `authenticateUser` refuse désormais un compte désactivé ;
  `requireUser`/`requireApiUser` idem à chaque requête.

- [ ] **Step 1: Étendre le test existant (RED)**

Dans `src/domain/authenticate.test.ts`, ajouter ce cas après les tests
existants (garder les imports et tests déjà présents inchangés) :

```ts
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';

// ... (tests existants inchangés) ...

describe('authenticateUser — compte désactivé', () => {
  it('retourne null pour un compte désactivé même avec le bon mot de passe', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'bon-mot-de-passe',
      cellarName: 'Ma Cave',
    });
    await db.update(users).set({ isActive: false }).where(eq(users.id, userId));

    expect(await authenticateUser(db, 'admin@example.com', 'bon-mot-de-passe')).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/authenticate.test.ts`
Expected: FAIL — le compte désactivé s'authentifie encore.

- [ ] **Step 3: Implémenter le check dans `authenticateUser`**

Dans `src/domain/authenticate.ts`, remplacer le corps de la fonction :

```ts
export async function authenticateUser(
  db: Db,
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;
  if (!user.isActive) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/authenticate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Appliquer le même check dans les gardes de page et d'API**

Dans `src/lib/requireUser.ts`, remplacer le corps de la fonction :

```ts
export async function requireUser() {
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) redirect('/login');

  return { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin };
}
```

Dans `src/lib/requireApiUser.ts`, remplacer le corps de `requireApiUser` :

```ts
export async function requireApiUser(): Promise<ApiUserResult> {
  const session = await getSession();
  if (!session.userId) {
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) {
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }

  return { user: { id: user.id, email: user.email, isSuperAdmin: user.isSuperAdmin } };
}
```

(Ces deux fichiers n'ont pas de test automatisé — colle framework, comme le
reste des gardes d'authentification dans ce projet ; vérifié manuellement à la
Tâche 19.)

- [ ] **Step 6: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test`
Expected: exit 0, tous les tests passent.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: deactivated accounts are refused at login and on every request"
```

---

### Task 4: Création de compte (via invitation)

**Files:**
- Create: `src/domain/accounts.ts`
- Test: `src/domain/accounts.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (`src/domain/auth.ts`), `newId` (`src/db/id.ts`).
- Produces: `class EmailAlreadyExistsError extends Error`,
  `createUserAccount(db: Db, email: string, password: string): Promise<string>`
  (retourne l'id du nouvel utilisateur, `isSuperAdmin: false`, `isActive: true`).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/domain/accounts.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { createUserAccount, EmailAlreadyExistsError } from './accounts';
import { verifyPassword } from './auth';
import { users } from '../db/schema';

describe('createUserAccount', () => {
  it('crée un compte non-admin avec le mot de passe hashé', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'mot-de-passe-membre');

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('membre@example.com');
    expect(user.isSuperAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(await verifyPassword('mot-de-passe-membre', user.passwordHash)).toBe(true);
  });

  it('refuse un email déjà utilisé', async () => {
    const db = await createTestDb();
    await createUserAccount(db, 'membre@example.com', 'x');
    await expect(createUserAccount(db, 'membre@example.com', 'y')).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/accounts.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/accounts.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';

export class EmailAlreadyExistsError extends Error {}

export async function createUserAccount(db: Db, email: string, password: string): Promise<string> {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new EmailAlreadyExistsError();

  const id = newId();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  return id;
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/accounts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add non-admin account creation for invitation acceptance"
```

---

### Task 5: Domaine des invitations (créer, résoudre par token, accepter)

**Files:**
- Create: `src/domain/invitations.ts`
- Test: `src/domain/invitations.test.ts`

**Interfaces:**
- Consumes: `Db`, `newId`, `generateToken` (Task 1).
- Produces: `createInvitationBodySchema` (Zod), `CreateInvitationInput`,
  `createInvitation(db, input): Promise<{ id: string; token: string }>`,
  `type InvitationLookup = { status: 'valid'; invitation } | { status: 'not_found' } | { status: 'expired' } | { status: 'already_used' }`,
  `getInvitationByToken(db, token): Promise<InvitationLookup>`,
  `acceptInvitation(db, token, userId): Promise<{ cellarId: string }>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/domain/invitations.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
} from './invitations';
import { invitations, cellarMemberships } from '../db/schema';

describe('createInvitation', () => {
  it('crée une invitation en attente avec une date d’expiration future', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'owner@example.com',
      password: 'x',
      cellarName: 'Cave',
    });

    const { id, token } = await createInvitation(db, {
      cellarId,
      email: 'invite@example.com',
      role: 'editor',
      invitedByUserId: userId,
    });

    const [row] = await db.select().from(invitations).where(eq(invitations.id, id));
    expect(row.status).toBe('pending');
    expect(row.token).toBe(token);
    expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('getInvitationByToken', () => {
  it('retourne "valid" pour une invitation en attente et non expirée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const { token } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'reader', invitedByUserId: userId });

    const lookup = await getInvitationByToken(db, token);
    expect(lookup.status).toBe('valid');
  });

  it('retourne "not_found" pour un token inconnu', async () => {
    const db = await createTestDb();
    expect((await getInvitationByToken(db, 'inconnu')).status).toBe('not_found');
  });

  it('retourne "expired" pour une invitation expirée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const { token, id } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'reader', invitedByUserId: userId });
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).where(eq(invitations.id, id));

    expect((await getInvitationByToken(db, token)).status).toBe('expired');
  });

  it('retourne "already_used" pour une invitation déjà acceptée', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const { token, id } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'reader', invitedByUserId: userId });
    await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, id));

    expect((await getInvitationByToken(db, token)).status).toBe('already_used');
  });
});

describe('acceptInvitation', () => {
  it('crée le membership avec le rôle de l’invitation et marque celle-ci acceptée', async () => {
    const db = await createTestDb();
    const { userId: ownerId, cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { token, id } = await createInvitation(db, { cellarId, email: 'invite@example.com', role: 'editor', invitedByUserId: ownerId });
    const inviteeId = await createUserAccount(db, 'invite@example.com', 'x');

    const result = await acceptInvitation(db, token, inviteeId);
    expect(result.cellarId).toBe(cellarId);

    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.userId, inviteeId));
    expect(membership.role).toBe('editor');
    expect(membership.cellarId).toBe(cellarId);

    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id));
    expect(invitation.status).toBe('accepted');
  });

  it('rejette un token invalide', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    await expect(acceptInvitation(db, 'inconnu', userId)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/invitations.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/invitations.ts` :

```ts
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { invitations, cellarMemberships } from '../db/schema';
import { newId } from '../db/id';
import { generateToken } from './token';

export const createInvitationBodySchema = z
  .object({
    cellarId: z.string().min(1),
    email: z.string().email(),
    role: z.enum(['editor', 'reader']),
  })
  .strict();

export interface CreateInvitationInput {
  cellarId: string;
  email: string;
  role: 'editor' | 'reader';
  invitedByUserId: string;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createInvitation(
  db: Db,
  input: CreateInvitationInput,
): Promise<{ id: string; token: string }> {
  const id = newId();
  const token = generateToken();
  const now = new Date();
  await db.insert(invitations).values({
    id,
    cellarId: input.cellarId,
    email: input.email,
    role: input.role,
    token,
    status: 'pending',
    invitedByUserId: input.invitedByUserId,
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  });
  return { id, token };
}

type InvitationRow = typeof invitations.$inferSelect;

export type InvitationLookup =
  | { status: 'valid'; invitation: InvitationRow }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_used' };

export async function getInvitationByToken(db: Db, token: string): Promise<InvitationLookup> {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  if (!invitation) return { status: 'not_found' };
  if (invitation.status === 'accepted') return { status: 'already_used' };
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return { status: 'expired' };
  return { status: 'valid', invitation };
}

export async function acceptInvitation(
  db: Db,
  token: string,
  userId: string,
): Promise<{ cellarId: string }> {
  const lookup = await getInvitationByToken(db, token);
  if (lookup.status !== 'valid') {
    throw new Error('Invitation invalide.');
  }

  await db.insert(cellarMemberships).values({
    id: newId(),
    cellarId: lookup.invitation.cellarId,
    userId,
    role: lookup.invitation.role,
    createdAt: new Date().toISOString(),
  });
  await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, lookup.invitation.id));

  return { cellarId: lookup.invitation.cellarId };
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/invitations.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add invitation domain logic (create, lookup, accept)"
```

---

### Task 6: Domaine des membres d'une cave (lister, changer un rôle, retirer)

**Files:**
- Create: `src/domain/cellarMembers.ts`
- Test: `src/domain/cellarMembers.test.ts`

**Interfaces:**
- Consumes: `Db`, `cellarMemberships`, `users` (schéma).
- Produces: `class CannotModifyOwnerError extends Error`,
  `listCellarMembersWithEmail(db, cellarId): Promise<{ membershipId, userId, email, role, createdAt }[]>`,
  `getMembershipById(db, membershipId): Promise<CellarMembership | null>`,
  `updateMembershipRole(db, membershipId, role: 'editor' | 'reader'): Promise<void>`,
  `removeMembership(db, membershipId): Promise<void>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/domain/cellarMembers.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { newId } from '../db/id';
import { cellarMemberships } from '../db/schema';
import {
  listCellarMembersWithEmail,
  getMembershipById,
  updateMembershipRole,
  removeMembership,
  CannotModifyOwnerError,
} from './cellarMembers';

async function addMember(db: Awaited<ReturnType<typeof createTestDb>>, cellarId: string, email: string, role: 'editor' | 'reader') {
  const userId = await createUserAccount(db, email, 'x');
  const membershipId = newId();
  await db.insert(cellarMemberships).values({
    id: membershipId,
    cellarId,
    userId,
    role,
    createdAt: new Date().toISOString(),
  });
  return { userId, membershipId };
}

describe('listCellarMembersWithEmail', () => {
  it('liste les membres avec leur email et leur rôle', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    await addMember(db, cellarId, 'editeur@example.com', 'editor');

    const members = await listCellarMembersWithEmail(db, cellarId);
    expect(members).toHaveLength(2);
    const emails = members.map((m) => m.email).sort();
    expect(emails).toEqual(['editeur@example.com', 'owner@example.com']);
  });
});

describe('updateMembershipRole', () => {
  it('change le rôle d’un membre non-owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { membershipId } = await addMember(db, cellarId, 'membre@example.com', 'reader');

    await updateMembershipRole(db, membershipId, 'editor');
    const updated = await getMembershipById(db, membershipId);
    expect(updated?.role).toBe('editor');
  });

  it('refuse de changer le rôle du owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const [ownerMembership] = await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));

    await expect(updateMembershipRole(db, ownerMembership.id, 'editor')).rejects.toBeInstanceOf(
      CannotModifyOwnerError,
    );
  });
});

describe('removeMembership', () => {
  it('retire un membre non-owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const { membershipId } = await addMember(db, cellarId, 'membre@example.com', 'reader');

    await removeMembership(db, membershipId);
    expect(await getMembershipById(db, membershipId)).toBeNull();
  });

  it('refuse de retirer le owner', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'owner@example.com', password: 'x', cellarName: 'Cave' });
    const [ownerMembership] = await db.select().from(cellarMemberships).where(eq(cellarMemberships.cellarId, cellarId));

    await expect(removeMembership(db, ownerMembership.id)).rejects.toBeInstanceOf(CannotModifyOwnerError);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/cellarMembers.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/cellarMembers.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cellarMemberships, users } from '../db/schema';

export class CannotModifyOwnerError extends Error {}

export async function listCellarMembersWithEmail(db: Db, cellarId: string) {
  return db
    .select({
      membershipId: cellarMemberships.id,
      userId: cellarMemberships.userId,
      email: users.email,
      role: cellarMemberships.role,
      createdAt: cellarMemberships.createdAt,
    })
    .from(cellarMemberships)
    .innerJoin(users, eq(cellarMemberships.userId, users.id))
    .where(eq(cellarMemberships.cellarId, cellarId));
}

export async function getMembershipById(db: Db, membershipId: string) {
  const [row] = await db.select().from(cellarMemberships).where(eq(cellarMemberships.id, membershipId)).limit(1);
  return row ?? null;
}

export async function updateMembershipRole(
  db: Db,
  membershipId: string,
  role: 'editor' | 'reader',
): Promise<void> {
  const membership = await getMembershipById(db, membershipId);
  if (!membership) throw new Error('Membre introuvable.');
  if (membership.role === 'owner') throw new CannotModifyOwnerError();
  await db.update(cellarMemberships).set({ role }).where(eq(cellarMemberships.id, membershipId));
}

export async function removeMembership(db: Db, membershipId: string): Promise<void> {
  const membership = await getMembershipById(db, membershipId);
  if (!membership) throw new Error('Membre introuvable.');
  if (membership.role === 'owner') throw new CannotModifyOwnerError();
  await db.delete(cellarMemberships).where(eq(cellarMemberships.id, membershipId));
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/cellarMembers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cellar membership listing, role change, removal"
```

---

### Task 7: Appliquer les permissions par rôle aux routes existantes

**Files:**
- Modify: `src/domain/bottleAccess.ts`
- Modify: `src/domain/bottleAccess.test.ts`
- Modify: `src/app/api/crates/route.ts`
- Modify: `src/app/api/crates/[id]/route.ts`
- Modify: `src/app/api/crates/reorder/route.ts`
- Modify: `src/app/api/bottles/route.ts`
- Modify: `src/app/api/bottles/[id]/route.ts`

**Interfaces:**
- Consumes: `canEditCellarContent` (Task 2).
- Produces: `resolveBottleAccess`'s variante `'ok'` gagne un champ `role:
  CellarRole` ; les routes de mutation (POST/PATCH/DELETE sur clayettes et
  bouteilles, hors consommation) renvoient 403 pour un `reader`.

- [ ] **Step 1: Étendre le test de `resolveBottleAccess` (RED)**

Dans `src/domain/bottleAccess.test.ts`, ajouter ce cas (garder les tests
existants inchangés) :

```ts
it('inclut le rôle du membre dans le résultat "ok"', async () => {
  const db = await createTestDb();
  const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
  const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
  const bottleId = await createBottle(db, { crateId, category: 'wine', name: 'Vin', quantity: 1, details: {} });
  const owner = (await db.select().from(users))[0];

  const result = await resolveBottleAccess(db, owner.id, bottleId);
  expect(result).toMatchObject({ status: 'ok', role: 'super_admin' });
});
```

(Réutilise l'import `users` depuis `'../db/schema'` déjà présent ou à ajouter
en haut du fichier si absent — vérifier les imports existants du fichier avant
d'ajouter une ligne dupliquée.)

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `yarn test src/domain/bottleAccess.test.ts`
Expected: FAIL — `role` absent du résultat.

- [ ] **Step 3: Ajouter `role` au résultat de `resolveBottleAccess`**

Remplacer le contenu de `src/domain/bottleAccess.ts` :

```ts
import type { Db } from '../db/client';
import { getBottle } from './bottles';
import { getCrateById } from './crates';
import { checkCellarAccess, type CellarRole } from './access';

export type BottleAccessResult =
  | { status: 'ok'; bottle: NonNullable<Awaited<ReturnType<typeof getBottle>>>; role: CellarRole }
  | { status: 'not_found' }
  | { status: 'forbidden' };

export async function resolveBottleAccess(
  db: Db,
  userId: string,
  bottleId: string,
): Promise<BottleAccessResult> {
  const bottle = await getBottle(db, bottleId);
  if (!bottle) return { status: 'not_found' };
  if (!bottle.crateId) return { status: 'not_found' };
  const crate = await getCrateById(db, bottle.crateId);
  if (!crate) return { status: 'not_found' };
  const access = await checkCellarAccess(db, userId, crate.cellarId);
  if (!access.allowed) return { status: 'forbidden' };
  return { status: 'ok', bottle, role: access.role };
}
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `yarn test src/domain/bottleAccess.test.ts`
Expected: PASS (tests existants + le nouveau).

- [ ] **Step 5: Gater les routes de clayettes**

Dans `src/app/api/crates/route.ts`, ajouter l'import de `canEditCellarContent`
et le check dans `POST` (juste après la ligne qui vérifie `access.allowed`) :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { createCrate, listCrates, getCrateById, createCrateBodySchema } from '@/domain/crates';

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listCrates(db, cellarId));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rawBody = await request.json().catch(() => null);
  const parsed = createCrateBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Clayette invalide : nom, capacité et cave sont requis.' }, { status: 400 });
  }
  const input = parsed.data;

  const access = await checkCellarAccess(db, user.id, input.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const id = await createCrate(db, input);
  return NextResponse.json(await getCrateById(db, id));
}
```

- [ ] **Step 6: Gater `crates/[id]/route.ts`**

Remplacer le contenu de `src/app/api/crates/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { renameCrate, deleteCrate, getCrateById, crateHasActiveBottles } from '@/domain/crates';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { db } from '@/db/client';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Nom de clayette requis.' }, { status: 400 });

  await renameCrate(db, id, name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;
  const crate = await getCrateById(db, id);
  if (!crate) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  if (await crateHasActiveBottles(db, id)) {
    return NextResponse.json(
      { error: 'Cette clayette contient encore des bouteilles.' },
      { status: 409 },
    );
  }

  await deleteCrate(db, id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Gater `crates/reorder/route.ts`**

Dans `src/app/api/crates/reorder/route.ts`, ajouter l'import et le check :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { reorderCrates } from '@/domain/crates';

const reorderBodySchema = z
  .object({
    cellarId: z.string().min(1),
    orderedIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rawBody = await request.json().catch(() => null);
  const parsed = reorderBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête de réordonnancement invalide.' }, { status: 400 });
  }
  const { cellarId, orderedIds } = parsed.data;

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  try {
    await reorderCrates(db, cellarId, orderedIds);
  } catch {
    return NextResponse.json(
      { error: 'La liste fournie ne correspond pas aux clayettes de cette cave.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Gater `bottles/route.ts` (POST uniquement — GET reste ouvert à tout membre)**

Dans `src/app/api/bottles/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canEditCellarContent } from '@/domain/permissions';
import { getCrateById } from '@/domain/crates';
import { createBottle, listActiveBottlesByCellar } from '@/domain/bottles';

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const cellarId = new URL(request.url).searchParams.get('cellarId');
  if (!cellarId) return NextResponse.json({ error: 'cellarId requis' }, { status: 400 });

  const access = await checkCellarAccess(db, user.id, cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  return NextResponse.json(await listActiveBottlesByCellar(db, cellarId));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;
  const body = await request.json();

  const crate = await getCrateById(db, body.crateId);
  if (!crate) return NextResponse.json({ error: 'Clayette introuvable' }, { status: 404 });
  const access = await checkCellarAccess(db, user.id, crate.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canEditCellarContent(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  try {
    const id = await createBottle(db, body);
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json({ error: 'Détails invalides pour cette catégorie' }, { status: 400 });
  }
}
```

- [ ] **Step 9: Gater `bottles/[id]/route.ts` (PATCH/DELETE — GET reste ouvert)**

Dans `src/app/api/bottles/[id]/route.ts`, ajouter l'import de
`canEditCellarContent` et le check dans `PATCH` et `DELETE` uniquement (pas
`GET`) :

```ts
import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/requireApiUser';
import { db } from '@/db/client';
import { updateBottle, deleteBottle, updateBottleBodySchema } from '@/domain/bottles';
import { getCrateById } from '@/domain/crates';
import { canEditCellarContent } from '@/domain/permissions';
import { resolveBottleAccess, type BottleAccessResult } from '@/domain/bottleAccess';

type BottleAccessOutcome =
  | { bottle: Extract<BottleAccessResult, { status: 'ok' }>['bottle']; role: Extract<BottleAccessResult, { status: 'ok' }>['role']; error: null }
  | { bottle: null; role: null; error: NextResponse };

async function requireBottleAccess(userId: string, bottleId: string): Promise<BottleAccessOutcome> {
  const result = await resolveBottleAccess(db, userId, bottleId);
  if (result.status === 'not_found') {
    return { bottle: null, role: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  if (result.status === 'forbidden') {
    return { bottle: null, role: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { bottle: result.bottle, role: result.role, error: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { bottle, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  return NextResponse.json(bottle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { bottle, role, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  if (!canEditCellarContent(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = updateBottleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs de mise à jour invalides.' }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  if (parsed.data.crateId) {
    const currentCrate = await getCrateById(db, bottle.crateId as string);
    const targetCrate = await getCrateById(db, parsed.data.crateId);
    if (!targetCrate) {
      return NextResponse.json({ error: 'Clayette de destination introuvable.' }, { status: 404 });
    }
    if (!currentCrate || targetCrate.cellarId !== currentCrate.cellarId) {
      return NextResponse.json(
        { error: 'La clayette de destination doit appartenir à la même cave.' },
        { status: 400 },
      );
    }
  }

  await updateBottle(db, id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;
  const { role, error } = await requireBottleAccess(auth.user.id, id);
  if (error) return error;
  if (!canEditCellarContent(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour cette action.' }, { status: 403 });
  }
  await deleteBottle(db, id);
  return NextResponse.json({ ok: true });
}
```

Ne pas modifier `src/app/api/bottles/[id]/consume/route.ts` : la consommation
et la note personnelle restent ouvertes à tout membre, y compris `reader`.

- [ ] **Step 10: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test`
Expected: exit 0, tous les tests passent (existants + nouveaux).

Run: `yarn lint`
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: enforce editor/reader role boundary on crate and bottle mutations"
```

---

### Task 8: Routes API des invitations et des membres

**Files:**
- Create: `src/app/api/invitations/route.ts`
- Create: `src/app/api/invitations/[token]/accept/route.ts`
- Create: `src/app/api/cellar-memberships/[id]/route.ts`

**Interfaces:**
- Consumes: `createInvitationBodySchema`, `createInvitation`,
  `getInvitationByToken`, `acceptInvitation` (Task 5) ; `getMembershipById`,
  `updateMembershipRole`, `updateMembershipRole`'s `CannotModifyOwnerError`,
  `removeMembership` (Task 6) ; `canManageCellar` (Task 2) ;
  `createUserAccount`, `EmailAlreadyExistsError` (Task 4) ; `getAppSettings`
  (Task 9 — **attention** : cette route dépend de la Tâche 9, à réaliser dans
  cet ordre, ou stubber temporairement `registrationEnabled: true` si les
  tâches sont parallélisées ; ce plan les place dans l'ordre 5→6→7→8→9 donc en
  pratique la Tâche 9 (réglages) est faite juste après celle-ci — voir note
  au Step 3).

- [ ] **Step 1: `POST /api/invitations`**

Créer `src/app/api/invitations/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import { createInvitation, createInvitationBodySchema } from '@/domain/invitations';

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rawBody = await request.json().catch(() => null);
  const parsed = createInvitationBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invitation invalide : email, rôle et cave sont requis.' }, { status: 400 });
  }
  const input = parsed.data;

  const access = await checkCellarAccess(db, user.id, input.cellarId);
  if (!access.allowed) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  if (!canManageCellar(access.role)) {
    return NextResponse.json({ error: 'Rôle insuffisant pour inviter un membre.' }, { status: 403 });
  }

  const { token } = await createInvitation(db, { ...input, invitedByUserId: user.id });
  return NextResponse.json({ token });
}
```

- [ ] **Step 2: `PATCH`/`DELETE /api/cellar-memberships/[id]`**

Créer `src/app/api/cellar-memberships/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import {
  getMembershipById,
  updateMembershipRole,
  removeMembership,
  CannotModifyOwnerError,
} from '@/domain/cellarMembers';

const updateRoleBodySchema = z.object({ role: z.enum(['editor', 'reader']) }).strict();

async function requireManageAccess(userId: string, membershipId: string) {
  const membership = await getMembershipById(db, membershipId);
  if (!membership) {
    return { cellarId: null, error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) };
  }
  const access = await checkCellarAccess(db, userId, membership.cellarId);
  if (!access.allowed || !canManageCellar(access.role)) {
    return { cellarId: null, error: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
  }
  return { cellarId: membership.cellarId, error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const { error } = await requireManageAccess(auth.user.id, id);
  if (error) return error;

  const rawBody = await request.json().catch(() => null);
  const parsed = updateRoleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
  }

  try {
    await updateMembershipRole(db, id, parsed.data.role);
  } catch (err) {
    if (err instanceof CannotModifyOwnerError) {
      return NextResponse.json({ error: 'Le rôle du owner ne peut pas être modifié.' }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const { error } = await requireManageAccess(auth.user.id, id);
  if (error) return error;

  try {
    await removeMembership(db, id);
  } catch (err) {
    if (err instanceof CannotModifyOwnerError) {
      return NextResponse.json({ error: 'Le owner ne peut pas être retiré.' }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: `POST /api/invitations/[token]/accept`**

Cette route a besoin de `getAppSettings` (Task 9, pas encore fait à ce stade
si les tâches sont exécutées strictement dans l'ordre du plan). Créer d'abord
un stub minimal directement dans `src/domain/appSettings.ts` pour ne pas
bloquer cette tâche :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appSettings } from '../db/schema';

const SETTINGS_ID = 'singleton';

export async function getAppSettings(db: Db): Promise<{ registrationEnabled: boolean }> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).limit(1);
  if (row) return row;
  const defaults = { id: SETTINGS_ID, registrationEnabled: true };
  await db.insert(appSettings).values(defaults);
  return defaults;
}
```

(La Tâche 9 complète ce fichier avec `setRegistrationEnabled` et son test —
ne pas dupliquer `getAppSettings` là-bas, juste l'étendre.)

Créer `src/app/api/invitations/[token]/accept/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { getSession } from '@/domain/session';
import { getInvitationByToken, acceptInvitation } from '@/domain/invitations';
import { createUserAccount, EmailAlreadyExistsError } from '@/domain/accounts';
import { getAppSettings } from '@/domain/appSettings';
import { authenticateUser } from '@/domain/authenticate';

const acceptBodySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('login') }).strict(),
  z.object({ mode: z.literal('signup'), password: z.string().min(8) }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await getInvitationByToken(db, token);
  if (lookup.status !== 'valid') {
    return NextResponse.json({ error: 'Invitation invalide ou expirée.' }, { status: 400 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = acceptBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  let userId: string;

  if (parsed.data.mode === 'login') {
    const auth = await requireApiUser();
    if ('error' in auth) return auth.error;
    if (auth.user.email !== lookup.invitation.email) {
      return NextResponse.json(
        { error: 'Cette invitation est destinée à une autre adresse email.' },
        { status: 403 },
      );
    }
    userId = auth.user.id;
  } else {
    const settings = await getAppSettings(db);
    if (!settings.registrationEnabled) {
      return NextResponse.json(
        { error: 'Les inscriptions sont actuellement fermées. Contacte l’administrateur.' },
        { status: 403 },
      );
    }
    try {
      userId = await createUserAccount(db, lookup.invitation.email, parsed.data.password);
    } catch (err) {
      if (err instanceof EmailAlreadyExistsError) {
        return NextResponse.json(
          { error: 'Un compte existe déjà pour cet email — connecte-toi plutôt.' },
          { status: 409 },
        );
      }
      throw err;
    }
    const authedUser = await authenticateUser(db, lookup.invitation.email, parsed.data.password);
    if (!authedUser) throw new Error('Échec inattendu de connexion après création du compte.');
    const session = await getSession();
    session.userId = authedUser.id;
    await session.save();
  }

  const { cellarId } = await acceptInvitation(db, token, userId);
  return NextResponse.json({ cellarId });
}
```

- [ ] **Step 4: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test`
Expected: exit 0, tous les tests passent.

Run: `yarn lint`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add invitation and membership management API routes"
```

---

### Task 9: Réglages globaux — `registration_enabled`

**Files:**
- Modify: `src/domain/appSettings.ts` (créé en Task 8, complété ici)
- Test: `src/domain/appSettings.test.ts`
- Create: `src/app/api/admin/settings/route.ts`

**Interfaces:**
- Consumes: `Db`, `appSettings` (schéma, Task 1).
- Produces: `getAppSettings(db): Promise<{ registrationEnabled: boolean }>`
  (déjà créé Task 8), `setRegistrationEnabled(db, enabled: boolean): Promise<void>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/domain/appSettings.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { getAppSettings, setRegistrationEnabled } from './appSettings';

describe('getAppSettings', () => {
  it('retourne des valeurs par défaut si aucune ligne n’existe encore', async () => {
    const db = await createTestDb();
    const settings = await getAppSettings(db);
    expect(settings.registrationEnabled).toBe(true);
  });

  it('retourne la ligne existante si déjà initialisée', async () => {
    const db = await createTestDb();
    await getAppSettings(db);
    await setRegistrationEnabled(db, false);
    expect((await getAppSettings(db)).registrationEnabled).toBe(false);
  });
});

describe('setRegistrationEnabled', () => {
  it('met à jour le réglage même si aucune ligne n’existait avant', async () => {
    const db = await createTestDb();
    await setRegistrationEnabled(db, false);
    expect((await getAppSettings(db)).registrationEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/appSettings.test.ts`
Expected: FAIL — `setRegistrationEnabled` non exporté.

- [ ] **Step 3: Compléter l'implémentation**

Remplacer le contenu de `src/domain/appSettings.ts` (créé en Task 8) :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { appSettings } from '../db/schema';

const SETTINGS_ID = 'singleton';

export async function getAppSettings(db: Db): Promise<{ registrationEnabled: boolean }> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID)).limit(1);
  if (row) return row;
  const defaults = { id: SETTINGS_ID, registrationEnabled: true };
  await db.insert(appSettings).values(defaults);
  return defaults;
}

export async function setRegistrationEnabled(db: Db, enabled: boolean): Promise<void> {
  await getAppSettings(db);
  await db.update(appSettings).set({ registrationEnabled: enabled }).where(eq(appSettings.id, SETTINGS_ID));
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/appSettings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Route API (super-admin uniquement — dépend de
  `requireSuperAdminApi`, créé Task 12 ; si exécuté avant, stubber avec
  `requireApiUser` + check `auth.user.isSuperAdmin` inline comme ci-dessous,
  qui fonctionne déjà avec ce qui existe)**

Créer `src/app/api/admin/settings/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireApiUser } from '@/lib/requireApiUser';
import { setRegistrationEnabled } from '@/domain/appSettings';

const updateSettingsBodySchema = z.object({ registrationEnabled: z.boolean() }).strict();

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ('error' in auth) return auth.error;
  if (!auth.user.isSuperAdmin) {
    return NextResponse.json({ error: 'Accès réservé au super-admin.' }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = updateSettingsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  await setRegistrationEnabled(db, parsed.data.registrationEnabled);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add app settings domain logic and admin settings route"
```

---

### Task 10: Page de réglages de la cave (inviter, gérer les membres)

**Files:**
- Create: `src/app/(app)/cave/parametres/page.tsx`
- Create: `src/components/InviteMemberForm.tsx`
- Create: `src/components/MembersList.tsx`

**Interfaces:**
- Consumes: `POST /api/invitations`, `PATCH`/`DELETE
  /api/cellar-memberships/[id]` (Task 8) ; `listCellarMembersWithEmail`
  (Task 6) ; `canManageCellar` (Task 2) ; `requireUser` (existant).

- [ ] **Step 1: Formulaire d'invitation**

Créer `src/components/InviteMemberForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function InviteMemberForm({ cellarId }: { cellarId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'reader'>('editor');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLink(null);
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellarId, email, role }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de créer l’invitation.');
      return;
    }
    const data = await response.json();
    setLink(`${window.location.origin}/invitations/${data.token}`);
    setEmail('');
    router.refresh();
  }

  return (
    <div className="bg-white rounded p-4 mb-6">
      <h3 className="text-sm mb-3">Inviter un membre</h3>
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide mb-1">Rôle</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'reader')}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="editor">Éditeur</option>
            <option value="reader">Lecteur</option>
          </select>
        </div>
        <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
          Créer l’invitation
        </button>
      </form>
      {link && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-gray-500 mb-1">
            Lien à copier et transmettre toi-même (valable 7 jours) :
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-gray-50"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Liste des membres**

Créer `src/components/MembersList.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Member {
  membershipId: string;
  email: string;
  role: 'owner' | 'editor' | 'reader';
}

export function MembersList({ initialMembers }: { initialMembers: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string | null>(null);

  async function readError(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function changeRole(membershipId: string, role: 'editor' | 'reader') {
    setError(null);
    const response = await fetch(`/api/cellar-memberships/${membershipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de changer ce rôle.'));
      return;
    }
    setMembers(members.map((m) => (m.membershipId === membershipId ? { ...m, role } : m)));
    router.refresh();
  }

  async function removeMember(membershipId: string) {
    setError(null);
    const response = await fetch(`/api/cellar-memberships/${membershipId}`, { method: 'DELETE' });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de retirer ce membre.'));
      return;
    }
    setMembers(members.filter((m) => m.membershipId !== membershipId));
    router.refresh();
  }

  return (
    <div className="bg-white rounded">
      {error && <p className="text-sm text-red-700 px-4 pt-3">{error}</p>}
      <ul className="divide-y divide-gray-100">
        {members.map((member) => (
          <li key={member.membershipId} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{member.email}</span>
            {member.role === 'owner' ? (
              <span className="text-xs text-gray-500">Owner</span>
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={member.role}
                  onChange={(e) => changeRole(member.membershipId, e.target.value as 'editor' | 'reader')}
                  className="border border-gray-300 rounded px-2 py-1 text-xs"
                >
                  <option value="editor">Éditeur</option>
                  <option value="reader">Lecteur</option>
                </select>
                <button
                  onClick={() => removeMember(member.membershipId)}
                  className="text-red-700 text-xs"
                >
                  Retirer
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Page serveur**

Créer `src/app/(app)/cave/parametres/page.tsx` :

```tsx
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/requireUser';
import { checkCellarAccess } from '@/domain/access';
import { canManageCellar } from '@/domain/permissions';
import { cellarMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { listCellarMembersWithEmail } from '@/domain/cellarMembers';
import { InviteMemberForm } from '@/components/InviteMemberForm';
import { MembersList } from '@/components/MembersList';

export default async function CavePametresPage() {
  const user = await requireUser();
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, user.id))
    .limit(1);

  if (!membership) {
    return <p className="text-sm">Aucune cave associée à ce compte.</p>;
  }

  const access = await checkCellarAccess(db, user.id, membership.cellarId);
  if (!access.allowed || !canManageCellar(access.role)) {
    redirect('/cave');
  }

  const members = await listCellarMembersWithEmail(db, membership.cellarId);

  return (
    <div className="max-w-xl">
      <h2 className="text-lg mb-4">Réglages de la cave</h2>
      <InviteMemberForm cellarId={membership.cellarId} />
      <h3 className="text-sm mb-3">Membres</h3>
      <MembersList initialMembers={members} />
    </div>
  );
}
```

- [ ] **Step 4: Vérifier l'ensemble**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `yarn build`
Expected: succès, la page apparaît dans la table de routes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add cellar settings page (invite, manage members)"
```

---

### Task 11: Page d'acceptation d'invitation

**Files:**
- Create: `src/app/invitations/[token]/page.tsx`
- Create: `src/components/AcceptInvitationForm.tsx`

**Interfaces:**
- Consumes: `getInvitationByToken` (Task 5), `getSession` (existant), `POST
  /api/invitations/[token]/accept` (Task 8).

Page publique (hors du groupe `(app)`, pas de garde `requireUser` — un
visiteur non connecté doit pouvoir l'atteindre).

- [ ] **Step 1: Composant client du formulaire d'acceptation**

Créer `src/components/AcceptInvitationForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptInvitationForm({
  token,
  email,
  currentUserEmail,
}: {
  token: string;
  email: string;
  currentUserEmail: string | null;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(mode: 'login' | 'signup') {
    setError(null);
    setBusy(true);
    const response = await fetch(`/api/invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'login' ? { mode } : { mode, password }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible d’accepter l’invitation.');
      return;
    }
    router.push('/cave');
    router.refresh();
  }

  if (currentUserEmail === email) {
    return (
      <div>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <button
          onClick={() => submit('login')}
          disabled={busy}
          className="bg-forest text-cream rounded px-4 py-2 text-sm"
        >
          Rejoindre la cave
        </button>
      </div>
    );
  }

  if (currentUserEmail && currentUserEmail !== email) {
    return (
      <div className="text-sm">
        <p className="mb-3">
          Cette invitation est destinée à <strong>{email}</strong>, mais tu es connecté avec{' '}
          <strong>{currentUserEmail}</strong>.
        </p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-forest underline text-xs">
            Se déconnecter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <label className="block text-xs uppercase tracking-wide mb-1">Mot de passe</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
        placeholder="Choisis un mot de passe (8 caractères minimum)"
        minLength={8}
        required
      />
      <button
        onClick={() => submit('signup')}
        disabled={busy || password.length < 8}
        className="bg-forest text-cream rounded px-4 py-2 text-sm"
      >
        Créer mon compte et rejoindre
      </button>
      <p className="text-xs text-gray-500 mt-2">
        Un compte existe déjà pour {email} ? <a href="/login" className="underline">Connecte-toi</a> puis
        reviens sur ce lien.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Page serveur**

Créer `src/app/invitations/[token]/page.tsx` :

```tsx
import { db } from '@/db/client';
import { getSession } from '@/domain/session';
import { getInvitationByToken } from '@/domain/invitations';
import { getAppSettings } from '@/domain/appSettings';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AcceptInvitationForm } from '@/components/AcceptInvitationForm';

const STATUS_MESSAGES: Record<'not_found' | 'expired' | 'already_used', string> = {
  not_found: "Ce lien d'invitation n'existe pas.",
  expired: 'Ce lien d’invitation a expiré.',
  already_used: 'Cette invitation a déjà été utilisée.',
};

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await getInvitationByToken(db, token);

  if (lookup.status !== 'valid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="bg-white p-8 rounded shadow-sm max-w-sm text-center">
          <p className="text-sm">{STATUS_MESSAGES[lookup.status]}</p>
        </div>
      </div>
    );
  }

  const session = await getSession();
  let currentUserEmail: string | null = null;
  if (session.userId) {
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (user) currentUserEmail = user.email;
  }

  const settings = await getAppSettings(db);
  const canSignUp = currentUserEmail !== null || settings.registrationEnabled;

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-2">Ma Cave</h1>
        <p className="text-sm mb-4">
          Tu es invité·e à rejoindre une cave en tant que{' '}
          <strong>{lookup.invitation.role === 'editor' ? 'éditeur' : 'lecteur'}</strong>.
        </p>
        {canSignUp ? (
          <AcceptInvitationForm
            token={token}
            email={lookup.invitation.email}
            currentUserEmail={currentUserEmail}
          />
        ) : (
          <p className="text-sm">
            Les inscriptions sont actuellement fermées. Contacte l’administrateur qui pourra créer
            ton compte.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn build`
Expected: exit 0, `/invitations/[token]` apparaît dans la table de routes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add invitation acceptance page"
```

---

### Task 12: Domaine et route du reset de mot de passe

**Files:**
- Create: `src/domain/passwordReset.ts`
- Test: `src/domain/passwordReset.test.ts`
- Create: `src/app/api/reset-password/[token]/route.ts`

**Interfaces:**
- Consumes: `generateToken` (Task 1), `hashPassword` (existant).
- Produces: `createResetToken(db, userId): Promise<string>`,
  `type ResetTokenLookup = { status: 'valid'; userId } | { status: 'not_found' } | { status: 'expired' } | { status: 'already_used' }`,
  `validateResetToken(db, token): Promise<ResetTokenLookup>`,
  `resetPasswordWithToken(db, token, newPassword): Promise<void>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/domain/passwordReset.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { verifyPassword } from './auth';
import {
  createResetToken,
  validateResetToken,
  resetPasswordWithToken,
} from './passwordReset';
import { passwordResetTokens, users } from '../db/schema';

describe('createResetToken / validateResetToken', () => {
  it('génère un token valide et non expiré', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);

    const lookup = await validateResetToken(db, token);
    expect(lookup).toEqual({ status: 'valid', userId });
  });

  it('retourne "not_found" pour un token inconnu', async () => {
    const db = await createTestDb();
    expect((await validateResetToken(db, 'inconnu')).status).toBe('not_found');
  });

  it('retourne "expired" pour un token expiré', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);
    await db
      .update(passwordResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(passwordResetTokens.token, token));

    expect((await validateResetToken(db, token)).status).toBe('expired');
  });

  it('retourne "already_used" pour un token déjà consommé', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);
    await resetPasswordWithToken(db, token, 'nouveau-mot-de-passe');

    expect((await validateResetToken(db, token)).status).toBe('already_used');
  });
});

describe('resetPasswordWithToken', () => {
  it('met à jour le mot de passe et consomme le token', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'ancien', cellarName: 'Cave' });
    const token = await createResetToken(db, userId);

    await resetPasswordWithToken(db, token, 'nouveau-mot-de-passe');

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(await verifyPassword('nouveau-mot-de-passe', user.passwordHash)).toBe(true);
    expect(await verifyPassword('ancien', user.passwordHash)).toBe(false);
  });

  it('rejette un token invalide', async () => {
    const db = await createTestDb();
    await expect(resetPasswordWithToken(db, 'inconnu', 'x')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/passwordReset.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/passwordReset.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { passwordResetTokens, users } from '../db/schema';
import { newId } from '../db/id';
import { generateToken } from './token';
import { hashPassword } from './auth';

const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export async function createResetToken(db: Db, userId: string): Promise<string> {
  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    id: newId(),
    userId,
    token,
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  });
  return token;
}

export type ResetTokenLookup =
  | { status: 'valid'; userId: string }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_used' };

export async function validateResetToken(db: Db, token: string): Promise<ResetTokenLookup> {
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
  if (!row) return { status: 'not_found' };
  if (row.usedAt) return { status: 'already_used' };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { status: 'expired' };
  return { status: 'valid', userId: row.userId };
}

export async function resetPasswordWithToken(db: Db, token: string, newPassword: string): Promise<void> {
  const lookup = await validateResetToken(db, token);
  if (lookup.status !== 'valid') {
    throw new Error('Lien de réinitialisation invalide.');
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, lookup.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordResetTokens.token, token));
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/passwordReset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Route API publique de consommation du token**

Créer `src/app/api/reset-password/[token]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { resetPasswordWithToken } from '@/domain/passwordReset';

const resetBodySchema = z.object({ password: z.string().min(8) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = resetBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mot de passe invalide (8 caractères minimum).' }, { status: 400 });
  }

  try {
    await resetPasswordWithToken(db, token, parsed.data.password);
  } catch {
    return NextResponse.json({ error: 'Lien de réinitialisation invalide ou expiré.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add password reset domain logic and API route"
```

---

### Task 13: Page de réinitialisation de mot de passe

**Files:**
- Create: `src/app/reset-password/[token]/page.tsx`
- Create: `src/components/ResetPasswordForm.tsx`

**Interfaces:**
- Consumes: `validateResetToken` (Task 12), `POST /api/reset-password/[token]`
  (Task 12).

- [ ] **Step 1: Composant client**

Créer `src/components/ResetPasswordForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/reset-password/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de réinitialiser le mot de passe.');
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/login'), 1500);
  }

  if (done) {
    return <p className="text-sm">Mot de passe mis à jour. Redirection vers la connexion…</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
      <label className="block text-xs uppercase tracking-wide mb-1">Nouveau mot de passe</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3"
        minLength={8}
        required
      />
      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Réinitialiser
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Page serveur**

Créer `src/app/reset-password/[token]/page.tsx` :

```tsx
import { db } from '@/db/client';
import { validateResetToken } from '@/domain/passwordReset';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

const STATUS_MESSAGES: Record<'not_found' | 'expired' | 'already_used', string> = {
  not_found: "Ce lien de réinitialisation n'existe pas.",
  expired: 'Ce lien de réinitialisation a expiré.',
  already_used: 'Ce lien de réinitialisation a déjà été utilisé.',
};

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await validateResetToken(db, token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-4">Ma Cave</h1>
        {lookup.status === 'valid' ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm">{STATUS_MESSAGES[lookup.status]}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn build`
Expected: exit 0, `/reset-password/[token]` apparaît dans la table de routes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add password reset page"
```

---

### Task 14: Garde super-admin et section admin

**Files:**
- Create: `src/lib/requireSuperAdmin.ts`
- Create: `src/lib/requireSuperAdminApi.ts`
- Create: `src/app/(app)/admin/layout.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `requireUser` (existant), `requireApiUser` (existant).
- Produces: `requireSuperAdmin()` (redirige vers `/cave` si non super-admin),
  `requireSuperAdminApi(): Promise<ApiUserResult>` (403 JSON sinon).

- [ ] **Step 1: Garde de page**

Créer `src/lib/requireSuperAdmin.ts` :

```ts
import { redirect } from 'next/navigation';
import { requireUser } from './requireUser';

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!user.isSuperAdmin) redirect('/cave');
  return user;
}
```

- [ ] **Step 2: Garde d'API**

Créer `src/lib/requireSuperAdminApi.ts` :

```ts
import { NextResponse } from 'next/server';
import { requireApiUser, type ApiUserResult } from './requireApiUser';

export async function requireSuperAdminApi(): Promise<ApiUserResult> {
  const auth = await requireApiUser();
  if ('error' in auth) return auth;
  if (!auth.user.isSuperAdmin) {
    return { error: NextResponse.json({ error: 'Accès réservé au super-admin.' }, { status: 403 }) };
  }
  return auth;
}
```

- [ ] **Step 3: Layout de la section admin**

Créer `src/app/(app)/admin/layout.tsx` :

```tsx
import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/requireSuperAdmin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div>
      <nav className="flex gap-4 text-xs uppercase tracking-wide mb-6 border-b border-gray-200 pb-3">
        <Link href="/admin/utilisateurs">Utilisateurs</Link>
        <Link href="/admin/caves">Caves</Link>
        <Link href="/admin/reglages">Réglages</Link>
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Lien "Admin" dans la navigation principale (super-admin
  uniquement)**

Dans `src/app/(app)/layout.tsx`, remplacer le contenu du fichier :

```tsx
import Link from 'next/link';
import { requireUser } from '@/lib/requireUser';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div>
      <header className="bg-forest text-cream px-5 py-4 flex items-center justify-between">
        <span className="font-serif italic text-lg">Ma Cave</span>
        <nav className="flex gap-4 text-xs uppercase tracking-wide">
          <Link href="/cave">Cave</Link>
          <Link href="/historique">Historique</Link>
          {user.isSuperAdmin && <Link href="/admin/utilisateurs">Admin</Link>}
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

- [ ] **Step 5: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add super-admin route guard and admin section layout"
```

---

### Task 15: Domaine et route de gestion des utilisateurs (admin)

**Files:**
- Create: `src/domain/admin.ts`
- Test: `src/domain/admin.test.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`

**Interfaces:**
- Consumes: `Db`, `users` (schéma).
- Produces: `listAllUsers(db): Promise<UserRow[]>`,
  `getUserById(db, userId): Promise<UserRow | null>`,
  `setUserActive(db, userId, isActive): Promise<void>`,
  `setUserSuperAdmin(db, userId, isSuperAdmin): Promise<void>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/domain/admin.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import {
  listAllUsers,
  getUserById,
  setUserActive,
  setUserSuperAdmin,
} from './admin';

describe('listAllUsers', () => {
  it('liste tous les comptes tous statuts confondus', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, { email: 'admin@example.com', password: 'x', cellarName: 'Cave' });
    await createUserAccount(db, 'membre@example.com', 'x');

    const list = await listAllUsers(db);
    expect(list).toHaveLength(2);
  });
});

describe('setUserActive', () => {
  it('désactive puis réactive un compte', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'x');

    await setUserActive(db, userId, false);
    expect((await getUserById(db, userId))?.isActive).toBe(false);

    await setUserActive(db, userId, true);
    expect((await getUserById(db, userId))?.isActive).toBe(true);
  });
});

describe('setUserSuperAdmin', () => {
  it('promeut puis rétrograde un compte', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'membre@example.com', 'x');

    await setUserSuperAdmin(db, userId, true);
    expect((await getUserById(db, userId))?.isSuperAdmin).toBe(true);

    await setUserSuperAdmin(db, userId, false);
    expect((await getUserById(db, userId))?.isSuperAdmin).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/admin.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/domain/admin.ts` :

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';

export async function listAllUsers(db: Db) {
  return db.select().from(users);
}

export async function getUserById(db: Db, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function setUserActive(db: Db, userId: string, isActive: boolean): Promise<void> {
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

export async function setUserSuperAdmin(db: Db, userId: string, isSuperAdmin: boolean): Promise<void> {
  await db.update(users).set({ isSuperAdmin }).where(eq(users.id, userId));
}
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/admin.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Route API (super-admin uniquement)**

Créer `src/app/api/admin/users/[id]/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { getUserById, setUserActive, setUserSuperAdmin } from '@/domain/admin';

const updateUserBodySchema = z
  .object({
    isActive: z.boolean().optional(),
    isSuperAdmin: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const target = await getUserById(db, id);
  if (!target) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const rawBody = await request.json().catch(() => null);
  const parsed = updateUserBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour.' }, { status: 400 });
  }

  if (parsed.data.isActive !== undefined) {
    await setUserActive(db, id, parsed.data.isActive);
  }
  if (parsed.data.isSuperAdmin !== undefined) {
    await setUserSuperAdmin(db, id, parsed.data.isSuperAdmin);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add admin user management domain logic and API route"
```

---

### Task 16: Pages admin — utilisateurs

**Files:**
- Create: `src/app/(app)/admin/utilisateurs/page.tsx`
- Create: `src/app/(app)/admin/utilisateurs/[id]/page.tsx`
- Create: `src/components/AdminUserDetail.tsx`

**Interfaces:**
- Consumes: `listAllUsers`, `getUserById` (Task 15) ; `PATCH
  /api/admin/users/[id]` (Task 15) ; `POST
  /api/admin/users/[id]/reset-token` (Task 17 — cette page affiche le bouton,
  la route est créée à la tâche suivante ; l'ordre est intentionnel pour
  garder chaque tâche testable seule, mais le bouton "Générer un lien" ne
  fonctionnera qu'une fois la Tâche 17 faite — noté explicitement dans le
  composant).

- [ ] **Step 1: Page liste**

Créer `src/app/(app)/admin/utilisateurs/page.tsx` :

```tsx
import Link from 'next/link';
import { db } from '@/db/client';
import { listAllUsers } from '@/domain/admin';

export default async function AdminUsersPage() {
  const usersList = await listAllUsers(db);

  return (
    <div>
      <h2 className="text-lg mb-4">Utilisateurs</h2>
      <ul className="bg-white rounded divide-y divide-gray-100">
        {usersList.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <Link href={`/admin/utilisateurs/${u.id}`} className="text-forest underline">
              {u.email}
            </Link>
            <span className="text-xs text-gray-500">
              {u.isSuperAdmin ? 'Super-admin' : 'Compte standard'} ·{' '}
              {u.isActive ? 'Actif' : 'Désactivé'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Composant client de détail**

Créer `src/components/AdminUserDetail.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserDetail {
  id: string;
  email: string;
  isActive: boolean;
  isSuperAdmin: boolean;
}

export function AdminUserDetail({ user }: { user: UserDetail }) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(user.isActive);
  const [isSuperAdmin, setIsSuperAdmin] = useState(user.isSuperAdmin);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readError(response: Response, fallback: string): Promise<string> {
    const data = await response.json().catch(() => null);
    return typeof data?.error === 'string' ? data.error : fallback;
  }

  async function updateUser(patch: { isActive?: boolean; isSuperAdmin?: boolean }) {
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de mettre à jour ce compte.'));
      return;
    }
    if (patch.isActive !== undefined) setIsActive(patch.isActive);
    if (patch.isSuperAdmin !== undefined) setIsSuperAdmin(patch.isSuperAdmin);
    router.refresh();
  }

  async function generateResetLink() {
    setError(null);
    const response = await fetch(`/api/admin/users/${user.id}/reset-token`, { method: 'POST' });
    if (!response.ok) {
      setError(await readError(response, 'Impossible de générer un lien.'));
      return;
    }
    const data = await response.json();
    setResetLink(`${window.location.origin}/reset-password/${data.token}`);
  }

  return (
    <div className="bg-white rounded p-4 max-w-md space-y-4">
      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between text-sm">
        <span>Compte actif</span>
        <button
          onClick={() => updateUser({ isActive: !isActive })}
          className="text-xs border border-gray-300 rounded px-3 py-1"
        >
          {isActive ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span>Super-admin</span>
        <button
          onClick={() => updateUser({ isSuperAdmin: !isSuperAdmin })}
          className="text-xs border border-gray-300 rounded px-3 py-1"
        >
          {isSuperAdmin ? 'Rétrograder' : 'Promouvoir'}
        </button>
      </div>

      <div>
        <button
          onClick={generateResetLink}
          className="text-xs bg-forest text-cream rounded px-3 py-2"
        >
          Générer un lien de réinitialisation
        </button>
        {resetLink && (
          <input
            readOnly
            value={resetLink}
            onFocus={(e) => e.target.select()}
            className="w-full border border-gray-300 rounded px-3 py-2 text-xs bg-gray-50 mt-2"
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Page détail**

Créer `src/app/(app)/admin/utilisateurs/[id]/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { getUserById } from '@/domain/admin';
import { AdminUserDetail } from '@/components/AdminUserDetail';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserById(db, id);
  if (!user) notFound();

  return (
    <div>
      <h2 className="text-lg mb-4">{user.email}</h2>
      <AdminUserDetail
        user={{
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          isSuperAdmin: user.isSuperAdmin,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn build`
Expected: exit 0, `/admin/utilisateurs` et `/admin/utilisateurs/[id]`
apparaissent dans la table de routes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add admin users list and detail pages"
```

---

### Task 17: Route de génération du lien de reset (admin)

**Files:**
- Create: `src/app/api/admin/users/[id]/reset-token/route.ts`

**Interfaces:**
- Consumes: `requireSuperAdminApi` (Task 14), `getUserById` (Task 15),
  `createResetToken` (Task 12).

- [ ] **Step 1: Route API**

Créer `src/app/api/admin/users/[id]/reset-token/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { getUserById } from '@/domain/admin';
import { createResetToken } from '@/domain/passwordReset';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;
  const { id } = await params;

  const target = await getUserById(db, id);
  if (!target) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const token = await createResetToken(db, id);
  return NextResponse.json({ token });
}
```

- [ ] **Step 2: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn build`
Expected: exit 0. Le bouton "Générer un lien de réinitialisation" de la Tâche
16 fonctionne maintenant de bout en bout.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add admin password reset link generation route"
```

---

### Task 18: Domaine, route et page — caves (vue transverse, création, supervision)

**Files:**
- Modify: `src/domain/admin.ts`
- Modify: `src/domain/admin.test.ts`
- Create: `src/domain/supervision.ts`
- Create: `src/app/api/admin/cellars/route.ts`
- Create: `src/app/(app)/admin/caves/page.tsx`
- Create: `src/components/CreateCellarForm.tsx`

**Interfaces:**
- Produces: `listAllCellarsWithOwner(db): Promise<{id, name, ownerId, ownerEmail, createdAt}[]>`,
  `countMembersByCellarId(db): Promise<Record<string, number>>`,
  `createCellarByAdmin(db, {name, ownerId}): Promise<string>` (ajoutés à
  `src/domain/admin.ts`) ; `getDbFileSizeBytes(): number | null`,
  `hasApiKeyConfigured(): boolean` (`src/domain/supervision.ts`).

- [ ] **Step 1: Étendre les tests d'admin (RED)**

Dans `src/domain/admin.test.ts`, ajouter ces cas (garder les tests existants
inchangés) :

```ts
import { createCrate } from './crates';
import {
  listAllCellarsWithOwner,
  countMembersByCellarId,
  createCellarByAdmin,
} from './admin';

// ... (describes existants inchangés) ...

describe('listAllCellarsWithOwner', () => {
  it('liste toutes les caves avec l’email du owner', async () => {
    const db = await createTestDb();
    await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });

    const list = await listAllCellarsWithOwner(db);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Cave A');
    expect(list[0].ownerEmail).toBe('a@example.com');
  });
});

describe('countMembersByCellarId', () => {
  it('compte les membres par cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave A' });

    const counts = await countMembersByCellarId(db);
    expect(counts[cellarId]).toBe(1);
  });
});

describe('createCellarByAdmin', () => {
  it('crée une cave et son membership owner', async () => {
    const db = await createTestDb();
    const ownerId = await createUserAccount(db, 'owner@example.com', 'x');

    const cellarId = await createCellarByAdmin(db, { name: 'Nouvelle cave', ownerId });

    const list = await listAllCellarsWithOwner(db);
    expect(list.find((c) => c.id === cellarId)?.ownerEmail).toBe('owner@example.com');
    const counts = await countMembersByCellarId(db);
    expect(counts[cellarId]).toBe(1);
  });
});
```

(Note : `createCrate` importé ci-dessus n'est pas utilisé par ces tests
précis — ne pas l'ajouter si l'éditeur de code signale un import inutile ;
seul `createUserAccount` depuis `./accounts` est nécessaire en plus des
imports déjà présents dans le fichier.)

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `yarn test src/domain/admin.test.ts`
Expected: FAIL — fonctions non exportées.

- [ ] **Step 3: Étendre `src/domain/admin.ts`**

Ajouter à la fin du fichier (garder tout ce qui existe déjà inchangé) :

```ts
import { cellars, cellarMemberships } from '../db/schema';
import { newId } from '../db/id';

export async function listAllCellarsWithOwner(db: Db) {
  return db
    .select({
      id: cellars.id,
      name: cellars.name,
      ownerId: cellars.ownerId,
      ownerEmail: users.email,
      createdAt: cellars.createdAt,
    })
    .from(cellars)
    .innerJoin(users, eq(cellars.ownerId, users.id));
}

export async function countMembersByCellarId(db: Db): Promise<Record<string, number>> {
  const rows = await db.select({ cellarId: cellarMemberships.cellarId }).from(cellarMemberships);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.cellarId] = (counts[row.cellarId] ?? 0) + 1;
  }
  return counts;
}

export interface CreateCellarInput {
  name: string;
  ownerId: string;
}

export async function createCellarByAdmin(db: Db, input: CreateCellarInput): Promise<string> {
  const id = newId();
  const now = new Date().toISOString();
  await db.insert(cellars).values({
    id,
    name: input.name,
    ownerId: input.ownerId,
    aiEnabled: true,
    createdAt: now,
  });
  await db.insert(cellarMemberships).values({
    id: newId(),
    cellarId: id,
    userId: input.ownerId,
    role: 'owner',
    createdAt: now,
  });
  return id;
}
```

(Déplacer l'import de `cellars`/`cellarMemberships`/`newId` en haut du
fichier avec les autres imports plutôt qu'au milieu — respecter la
convention du fichier existant.)

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `yarn test src/domain/admin.test.ts`
Expected: PASS (6 tests au total).

- [ ] **Step 5: Domaine de supervision technique (pas de test — lit le
  système de fichiers et l'environnement, colle framework)**

Créer `src/domain/supervision.ts` :

```ts
import { statSync } from 'node:fs';

/** Taille du fichier SQLite en octets, ou `null` si le fichier n'existe pas
 * encore (ex : DATABASE_URL pointe vers `:memory:` ou un chemin inexistant). */
export function getDbFileSizeBytes(): number | null {
  const url = process.env.DATABASE_URL ?? 'file:./data/cave.db';
  const path = url.startsWith('file:') ? url.slice('file:'.length) : url;
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

export function hasApiKeyConfigured(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY.length > 0;
}
```

- [ ] **Step 6: Route API de création de cave**

Créer `src/app/api/admin/cellars/route.ts` :

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSuperAdminApi } from '@/lib/requireSuperAdminApi';
import { createCellarByAdmin } from '@/domain/admin';

const createCellarBodySchema = z.object({ name: z.string().min(1), ownerId: z.string().min(1) }).strict();

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if ('error' in auth) return auth.error;

  const rawBody = await request.json().catch(() => null);
  const parsed = createCellarBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nom et owner requis.' }, { status: 400 });
  }

  const id = await createCellarByAdmin(db, parsed.data);
  return NextResponse.json({ id });
}
```

- [ ] **Step 7: Formulaire de création de cave**

Créer `src/components/CreateCellarForm.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserOption {
  id: string;
  email: string;
}

export function CreateCellarForm({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [ownerId, setOwnerId] = useState(users[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch('/api/admin/cellars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownerId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de créer cette cave.');
      return;
    }
    setName('');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded p-4 mb-6 flex gap-2 items-end flex-wrap">
      {error && <p className="text-sm text-red-700 w-full">{error}</p>}
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Nom de la cave</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide mb-1">Owner</label>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          required
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="bg-forest text-cream rounded px-4 py-2 text-sm">
        Créer la cave
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Page admin des caves**

Créer `src/app/(app)/admin/caves/page.tsx` :

```tsx
import Link from 'next/link';
import { db } from '@/db/client';
import { listAllCellarsWithOwner, countMembersByCellarId, listAllUsers } from '@/domain/admin';
import { getDbFileSizeBytes, hasApiKeyConfigured } from '@/domain/supervision';
import { CreateCellarForm } from '@/components/CreateCellarForm';

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'fichier introuvable';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function AdminCellarsPage() {
  const [cellarsList, memberCounts, usersList] = await Promise.all([
    listAllCellarsWithOwner(db),
    countMembersByCellarId(db),
    listAllUsers(db),
  ]);

  return (
    <div>
      <h2 className="text-lg mb-4">Caves</h2>

      <div className="bg-white rounded p-4 mb-6 text-xs text-gray-600 space-y-1">
        <p>Base SQLite : {formatBytes(getDbFileSizeBytes())}</p>
        <p>Clé API Anthropic : {hasApiKeyConfigured() ? 'configurée' : 'non configurée'}</p>
      </div>

      <CreateCellarForm users={usersList.map((u) => ({ id: u.id, email: u.email }))} />

      <ul className="bg-white rounded divide-y divide-gray-100">
        {cellarsList.map((cellar) => (
          <li key={cellar.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{cellar.name} — owner {cellar.ownerEmail}</span>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{memberCounts[cellar.id] ?? 0} membre(s)</span>
              <Link href={`/cave?cellarId=${cellar.id}`} className="text-forest underline">
                Ouvrir
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(Le lien "Ouvrir" cible `/cave` — la page `/cave` existante résout aujourd'hui
la cave via le premier membership de l'utilisateur, sans lire de paramètre
`cellarId` ; comme un super-admin a accès à toutes les caves via
`checkCellarAccess` mais n'a pas forcément de membership dessus, ce lien reste
volontairement approximatif dans ce plan — un super-admin qui veut inspecter
une cave dont il n'est pas membre doit avoir un vrai point d'entrée dédié,
hors scope ici : noté comme limitation connue plutôt que résolu à moitié.)

- [ ] **Step 9: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn test && yarn build`
Expected: exit 0 partout, `/admin/caves` apparaît dans la table de routes.

Run: `yarn lint`
Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add admin cellars page (cross-cellar view, creation, technical supervision)"
```

---

### Task 19: Page admin — réglages globaux

**Files:**
- Create: `src/app/(app)/admin/reglages/page.tsx`
- Create: `src/components/RegistrationToggle.tsx`

**Interfaces:**
- Consumes: `getAppSettings` (Task 9), `PATCH /api/admin/settings` (Task 9).

- [ ] **Step 1: Composant client du toggle**

Créer `src/components/RegistrationToggle.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RegistrationToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const response = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationEnabled: !enabled }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'Impossible de mettre à jour ce réglage.');
      return;
    }
    setEnabled(!enabled);
    router.refresh();
  }

  return (
    <div className="bg-white rounded p-4 max-w-md">
      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}
      <div className="flex items-center justify-between text-sm">
        <div>
          <p>Inscriptions ouvertes</p>
          <p className="text-xs text-gray-500">
            Autorise la création d’un compte à l’acceptation d’une invitation.
          </p>
        </div>
        <button onClick={toggle} className="text-xs border border-gray-300 rounded px-3 py-1">
          {enabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page serveur**

Créer `src/app/(app)/admin/reglages/page.tsx` :

```tsx
import { db } from '@/db/client';
import { getAppSettings } from '@/domain/appSettings';
import { RegistrationToggle } from '@/components/RegistrationToggle';

export default async function AdminSettingsPage() {
  const settings = await getAppSettings(db);

  return (
    <div>
      <h2 className="text-lg mb-4">Réglages</h2>
      <RegistrationToggle initialEnabled={settings.registrationEnabled} />
    </div>
  );
}
```

- [ ] **Step 3: Vérifier l'ensemble**

Run: `npx tsc --noEmit && yarn build`
Expected: exit 0, `/admin/reglages` apparaît dans la table de routes.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add admin global settings page"
```

---

### Task 20: Vérification manuelle de bout en bout

**Files:** aucun fichier créé — vérification manuelle uniquement.

- [ ] **Step 1: Suite de tests complète**

Run: `yarn test`
Expected: tous les tests passent (existants + tous ceux ajoutés par ce plan).

Run: `npx tsc --noEmit && yarn lint && yarn build`
Expected: exit 0 partout.

- [ ] **Step 2: Parcours d'invitation et de rôles**

Avec le compte super-admin déjà bootstrappé (`admin@example.com` du plan
précédent) :
1. `/cave/parametres` → inviter un email avec le rôle `editor`, copier le
   lien affiché.
2. Ouvrir ce lien dans une fenêtre de navigation privée (pas de session) →
   vérifier le formulaire de création de compte, le remplir, confirmer la
   redirection vers `/cave` avec les bouteilles/clayettes de la cave
   invitée visibles.
3. Depuis ce compte `editor`, vérifier qu'ajouter une clayette et une
   bouteille fonctionne, mais que `/cave/parametres` redirige vers `/cave`
   (pas de droit `canManageCellar`).
4. Depuis le compte super-admin, `/cave/parametres` → changer le rôle de ce
   membre en `reader`, vérifier depuis son compte qu'il ne peut plus ajouter
   de bouteille (403 côté API si testé directement, ou le formulaire
   correspondant absent/refusé) mais peut toujours consommer et noter.
5. Retirer ce membre depuis `/cave/parametres` → vérifier qu'il perd l'accès
   à la cave à sa prochaine requête.

- [ ] **Step 3: Parcours de réinitialisation de mot de passe**

1. `/admin/utilisateurs/[id]` sur un compte existant → générer un lien de
   reset, l'ouvrir en navigation privée, définir un nouveau mot de passe,
   vérifier la connexion avec ce nouveau mot de passe.
2. Réessayer d'ouvrir le même lien une seconde fois → vérifier le message
   "déjà utilisé".

- [ ] **Step 4: Parcours de désactivation de compte**

1. Désactiver un compte depuis `/admin/utilisateurs/[id]`.
2. Si ce compte a une session active dans un autre navigateur/onglet,
   vérifier qu'un rechargement de page le déconnecte (redirection `/login`).
3. Vérifier qu'une tentative de connexion avec ses identifiants corrects
   échoue tant qu'il est désactivé.
4. Réactiver le compte, vérifier que la connexion refonctionne.

- [ ] **Step 5: Réglages globaux et création de cave**

1. `/admin/reglages` → désactiver les inscriptions.
2. Créer une nouvelle invitation, l'ouvrir en navigation privée avec un email
   sans compte existant → vérifier le message "inscriptions fermées" au lieu
   du formulaire de création de compte.
3. Réactiver les inscriptions.
4. `/admin/caves` → vérifier que la taille de la base SQLite et le statut de
   la clé API s'affichent, créer une nouvelle cave en désignant un owner
   existant, vérifier qu'elle apparaît dans la liste avec 1 membre.

- [ ] **Step 6: Consigner les écarts**

Si un des points ci-dessus échoue, corriger avant de considérer ce plan
terminé.
