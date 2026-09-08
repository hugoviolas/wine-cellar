# Inscription libre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone create an account and get their own brand-new cellar (as `owner`) in one step, from a public signup page — fully separate from the existing invitation system, which only ever adds a member to a cellar someone else already owns.

**Architecture:** One new domain function (`registerSelfServeUser`, mirroring the existing `bootstrapSuperAdmin`'s three-insert pattern but with self-serve-appropriate defaults), one new API route, one new public page/component pair, and two small entry-point links on existing pages.

**Tech Stack:** Next.js App Router (server components + API routes), Drizzle ORM/SQLite, Zod, Vitest.

**Spec:** docs/superpowers/specs/2026-09-08-inscription-libre-design.md

## Global Constraints

- Self-service signup is **fully separate** from the invitation system: it always creates a brand-new cellar with the signing-up user as `owner`. It never offers to join an existing cellar — that remains exclusively the invitation flow's job.
- New cellar defaults: `name: 'Ma Cave'` (no name field on the signup form — renaming happens later via the existing `/cave/parametres` form), `aiEnabled: false` (deliberately different from `bootstrapSuperAdmin`'s default of `true` — self-service signup is open to anyone, so a new cellar must not default to having access to the shared `ANTHROPIC_API_KEY`).
- `registrationEnabled` (existing `appSettings` row, `src/domain/appSettings.ts`) gates BOTH signup paths with the same single toggle — no new admin setting.
- The new signup form's disabled-button styling MUST be visible (`disabled:opacity-40 disabled:cursor-not-allowed`) whenever the submit button is disabled — this exact class pair was added to `AcceptInvitationForm.tsx` earlier the same day to fix a real bug (a disabled button with no visual distinction from an enabled one looks broken, not disabled). Do not reintroduce that bug here.
- No email verification, no password-reset UI for self-served accounts — explicitly out of scope (see spec §7).

---

### Task 1: `registerSelfServeUser` domain function

**Files:**
- Modify: `src/domain/accounts.ts`
- Modify: `src/domain/accounts.test.ts`

**Interfaces:**
- Consumes: `hashPassword` (`src/domain/auth.ts`), `newId` (`src/db/id.ts`), `users`/`cellars`/`cellarMemberships` (`src/db/schema.ts`), `Db` (`src/db/client.ts`). Reuses the existing `EmailAlreadyExistsError` class already in `accounts.ts`.
- Produces: `registerSelfServeUser(db: Db, email: string, password: string): Promise<{ userId: string; cellarId: string }>`. Consumed by Task 2 (the signup route).

- [ ] **Step 1: Write the failing tests**

Add to `src/domain/accounts.test.ts` (add `cellars`, `cellarMemberships` to the existing `from '../db/schema'` import, and `registerSelfServeUser` to the existing `from './accounts'` import):

```ts
import { cellars, cellarMemberships } from '../db/schema';
```

```ts
describe('registerSelfServeUser', () => {
  it('crée un compte, une cave "Ma Cave" avec l’IA désactivée, et une adhésion owner', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await registerSelfServeUser(db, 'nouveau@example.com', 'mot-de-passe-solide');

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('nouveau@example.com');
    expect(user.isSuperAdmin).toBe(false);
    expect(user.isActive).toBe(true);
    expect(await verifyPassword('mot-de-passe-solide', user.passwordHash)).toBe(true);

    const [cellar] = await db.select().from(cellars).where(eq(cellars.id, cellarId));
    expect(cellar.name).toBe('Ma Cave');
    expect(cellar.ownerId).toBe(userId);
    expect(cellar.aiEnabled).toBe(false);

    const [membership] = await db
      .select()
      .from(cellarMemberships)
      .where(eq(cellarMemberships.cellarId, cellarId));
    expect(membership.userId).toBe(userId);
    expect(membership.role).toBe('owner');
  });

  it('refuse un email déjà utilisé', async () => {
    const db = await createTestDb();
    await registerSelfServeUser(db, 'nouveau@example.com', 'x'.repeat(8));
    await expect(registerSelfServeUser(db, 'nouveau@example.com', 'y'.repeat(8))).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it('normalise l’email en minuscules', async () => {
    const db = await createTestDb();
    const { userId } = await registerSelfServeUser(db, 'Nouveau@Example.com', 'x'.repeat(8));
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe('nouveau@example.com');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn vitest run src/domain/accounts.test.ts`
Expected: FAIL — `registerSelfServeUser` not exported.

- [ ] **Step 3: Implement in `src/domain/accounts.ts`**

The file's current imports are:

```ts
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from './auth';
import { newId } from '../db/id';
```

`newId` and `hashPassword` are already imported — only the schema import needs
`cellars`/`cellarMemberships` added. Change the `users` import line to:

```ts
import { users, cellars, cellarMemberships } from '../db/schema';
```

Append at the end of the file:

```ts
/**
 * Inscription libre (page publique /signup) : crée un compte, une nouvelle
 * cave dont l'utilisateur est owner, et l'adhésion correspondante — en un
 * seul geste, sans intervention du super-admin. Contrairement à
 * bootstrapSuperAdmin (réservé au tout premier compte, via script CLI) :
 * isSuperAdmin toujours false, et aiEnabled toujours false sur la cave
 * créée — l'inscription étant ouverte à n'importe qui, une nouvelle cave
 * ne doit pas avoir accès par défaut à la clé API IA partagée (le
 * super-admin l'active au cas par cas depuis /admin/caves).
 */
export async function registerSelfServeUser(
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: string; cellarId: string }> {
  const normalizedEmail = email.toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing) throw new EmailAlreadyExistsError();

  const now = new Date().toISOString();
  const userId = newId();
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    isSuperAdmin: false,
    isActive: true,
    createdAt: now,
  });

  const cellarId = newId();
  await db.insert(cellars).values({
    id: cellarId,
    name: 'Ma Cave',
    ownerId: userId,
    aiEnabled: false,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn vitest run src/domain/accounts.test.ts`
Expected: PASS (all tests green, including the pre-existing `createUserAccount` tests).

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `yarn tsc --noEmit && yarn lint && yarn test`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain/accounts.ts src/domain/accounts.test.ts
git commit -m "feat: add registerSelfServeUser for self-service signup"
```

---

### Task 2: `POST /api/auth/signup` route

**Files:**
- Create: `src/app/api/auth/signup/route.ts`

**Interfaces:**
- Consumes: `registerSelfServeUser`, `EmailAlreadyExistsError` (Task 1, `src/domain/accounts.ts`); `getAppSettings` (`src/domain/appSettings.ts`); `getSession` (`src/domain/session.ts`); `db` (`src/db/client.ts`).
- Produces: `POST /api/auth/signup`, body `{ email: string, password: string }`, success response `{ ok: true }` (200) with the session cookie set — mirrors `POST /api/auth/login`'s response shape. Consumed by Task 3 (the signup page/form).

- [ ] **Step 1: Create `src/app/api/auth/signup/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { getSession } from '@/domain/session';
import { getAppSettings } from '@/domain/appSettings';
import { registerSelfServeUser, EmailAlreadyExistsError } from '@/domain/accounts';

const signupBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
  })
  .strict();

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const parsed = signupBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const settings = await getAppSettings(db);
  if (!settings.registrationEnabled) {
    return NextResponse.json(
      { error: 'Les inscriptions sont actuellement fermées.' },
      { status: 403 },
    );
  }

  let userId: string;
  try {
    ({ userId } = await registerSelfServeUser(db, parsed.data.email, parsed.data.password));
  } catch (err) {
    if (err instanceof EmailAlreadyExistsError) {
      return NextResponse.json(
        { error: 'Un compte existe déjà pour cet email — connecte-toi plutôt.' },
        { status: 409 },
      );
    }
    throw err;
  }

  const session = await getSession();
  session.userId = userId;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck, lint, full suite**

Run: `yarn tsc --noEmit && yarn lint && yarn test`
Expected: all clean. (This codebase has no route-level test framework — `find src/app -name '*.test.ts*'` returns nothing — so there is no TDD cycle for this step; Task 3's manual verification exercises this route end-to-end.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/signup/route.ts
git commit -m "feat: add POST /api/auth/signup route"
```

---

### Task 3: `/signup` page + form component

**Files:**
- Create: `src/components/SignupForm.tsx`
- Create: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `PasswordInput` (`src/components/PasswordInput.tsx`); `POST /api/auth/signup` (Task 2); `getAppSettings` (`src/domain/appSettings.ts`) for the server component's gate.
- Produces: the `/signup` route. Consumed by Task 4 (the two entry-point links).

- [ ] **Step 1: Create `src/components/SignupForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordInput } from '@/components/PasswordInput';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Impossible de créer ton compte.');
        return;
      }
      router.push('/accueil');
      router.refresh();
    } catch {
      setError('Impossible de contacter le serveur — vérifie ta connexion et réessaie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

      <label className="block text-xs uppercase tracking-wide mb-1">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
        required
      />

      <label className="block text-xs uppercase tracking-wide mb-1">Mot de passe</label>
      <PasswordInput
        value={password}
        onChange={setPassword}
        className="mb-3"
        placeholder="8 caractères minimum"
        minLength={8}
        required
      />

      <label className="block text-xs uppercase tracking-wide mb-1">Confirmer le mot de passe</label>
      <PasswordInput
        value={confirmPassword}
        onChange={setConfirmPassword}
        className="mb-1"
        required
      />
      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className="text-xs text-red-700 mb-2">Les mots de passe ne correspondent pas.</p>
      )}
      {password.length > 0 && password.length < 8 && (
        <p className="text-xs text-red-700 mb-2">Le mot de passe doit faire au moins 8 caractères.</p>
      )}

      <button
        type="submit"
        disabled={busy || password.length < 8 || !passwordsMatch}
        className="w-full bg-forest text-cream rounded py-2 text-sm mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Créer mon compte
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Déjà un compte ? <a href="/login" className="underline">Connecte-toi</a>
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/signup/page.tsx`**

```tsx
import { db } from '@/db/client';
import { getAppSettings } from '@/domain/appSettings';
import { SignupForm } from '@/components/SignupForm';

export default async function SignupPage() {
  const settings = await getAppSettings(db);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="bg-white p-8 rounded shadow-sm w-full max-w-sm">
        <h1 className="text-xl mb-6">Ma Cave</h1>
        {settings.registrationEnabled ? (
          <SignupForm />
        ) : (
          <p className="text-sm text-gray-500">
            Les inscriptions sont actuellement fermées. Contacte l’administrateur qui pourra créer
            ton compte.
          </p>
        )}
      </div>
    </div>
  );
}
```

Note: this page's own `registrationEnabled` check controls whether the form renders at all (matches the pattern already used on `/invitations/[token]`'s page for the same setting). The API route in Task 2 re-checks the same setting server-side regardless — never trust the page-level gate alone, exactly as this codebase's other AI/registration gates already do.

- [ ] **Step 3: Typecheck and lint**

Run: `yarn tsc --noEmit && yarn lint`
Expected: both clean.

- [ ] **Step 4: Manual verification**

Start the dev server (or use the already-running Docker container `wine-cellar-start` on localhost:3000). Go to `/signup`. Fill in a fresh email and matching 8+ character passwords — confirm the submit button is disabled (visibly greyed, not just inert) until both conditions are met, then submit. Confirm redirect to `/accueil` and that you're logged in as the new account. Then check `/cave` shows a cellar named "Ma Cave" with zero crates, and — logged in separately as the super-admin — check `/admin/caves` shows this new cellar with AI **disabled**. Also try submitting the same email again (in a fresh tab, logged out) and confirm the "Un compte existe déjà..." message appears rather than a raw 500 or a silent failure.

- [ ] **Step 5: Commit**

```bash
git add src/components/SignupForm.tsx src/app/signup/page.tsx
git commit -m "feat: add public signup page"
```

---

### Task 4: Entry-point links on `/login` and `/`

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing new (the `/signup` route from Task 3).
- Produces: nothing new — this task just links to what Task 3 built.

- [ ] **Step 1: Add a "Créer un compte" link to `src/app/login/page.tsx`**

Find the closing `</form>` tag (right after the "Se connecter" submit button) and add, immediately after the `<button type="submit">...</button>` but still inside the `<form>` (or right after the form closes — either is fine visually, place it right after the submit button as a new element):

```tsx
        <button type="submit" className="w-full bg-forest text-cream rounded py-2 text-sm">
          Se connecter
        </button>
        <p className="text-xs text-gray-500 mt-4 text-center">
          Pas de compte ? <a href="/signup" className="underline">Crée-en un</a>
        </p>
```

- [ ] **Step 2: Add a "Créer un compte" button to `src/app/page.tsx`**

Find the existing "Se connecter" link:

```tsx
        <a
          href="/login"
          className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
        >
          Se connecter
        </a>
```

Add a second link right after it, inside the same container, using the app's established secondary-button style (bordered, not filled — same pattern as the "Liste des vins"/"Gérer les clayettes" buttons on `/cave`):

```tsx
        <a
          href="/login"
          className="inline-block bg-forest text-cream rounded px-4 py-2 text-sm"
        >
          Se connecter
        </a>
        <a
          href="/signup"
          className="inline-block border border-gray-300 text-forest rounded px-4 py-2 text-sm ml-2"
        >
          Créer un compte
        </a>
```

- [ ] **Step 3: Typecheck and lint**

Run: `yarn tsc --noEmit && yarn lint`
Expected: both clean.

- [ ] **Step 4: Manual verification**

Log out (or use a private/incognito-style fresh session if available). Visit `/` — confirm both "Se connecter" and "Créer un compte" render side by side without wrapping awkwardly. Click "Créer un compte" — confirm it lands on `/signup`. Go to `/login` directly — confirm the "Pas de compte ? Crée-en un" line renders below the submit button and links to `/signup`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/page.tsx
git commit -m "feat: link to signup from login and the public landing page"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (`registerSelfServeUser`) → Task 1. §3 (signup route, `registrationEnabled` gate) → Task 2. §4 (signup page/form, disabled-button styling constraint) → Task 3. §5 (entry points) → Task 4. §6 (nothing else changes) — no task touches the invitation system, `createUserAccount`, `POST /api/admin/cellars`, or `bootstrapSuperAdmin`. §7 (out of scope) — no task adds email verification or password reset.
- **Placeholder scan:** none found — every step has real code.
- **Type consistency:** `registerSelfServeUser(db, email, password): Promise<{userId, cellarId}>` (Task 1) matches its only call site in Task 2's route (`({ userId } = await registerSelfServeUser(...))`). `SignupForm` (Task 3) matches its only call site in `signup/page.tsx` (same task). The `/api/auth/signup` request/response shape defined in Task 2 matches exactly what `SignupForm` sends/expects in Task 3.
