# Inscription libre — Design

Date : 2026-09-08
Statut : validé en brainstorming, en attente de revue finale avant plan d'implémentation.

## 1. Vue d'ensemble

Aujourd'hui, il n'existe aucun moyen pour une personne sans invitation de
créer un compte et sa propre cave. Les deux seules façons dont une ligne
`cellars` est créée sont le script CLI `scripts/bootstrap.ts` (one-shot,
piloté par variables d'env) et `POST /api/admin/cellars`, réservé au
super-admin et qui exige en plus l'id d'un utilisateur déjà existant. Le
système d'invitation, lui, ne fait qu'ajouter un membre à une cave
**existante** — il ne crée jamais de nouvelle cave.

Ce chantier ajoute un vrai parcours self-service : une page d'inscription
publique où n'importe qui peut créer un compte **et obtenir sa propre cave
en un seul geste**, sans intervention du super-admin. Décision structurante
actée en clarification : ce parcours est **totalement séparé** du système
d'invitation existant — s'inscrire librement crée toujours une nouvelle
cave dont on est `owner` ; rejoindre la cave de quelqu'un d'autre reste
uniquement possible via une invitation (rôle `editor`/`reader`), système
inchangé.

## 2. Domaine — `src/domain/accounts.ts`

Nouvelle fonction, à côté de `createUserAccount` déjà existante (réutilise
`EmailAlreadyExistsError`), sur le même modèle à trois inserts que
`bootstrapSuperAdmin` (`src/domain/bootstrap.ts`) mais avec des valeurs par
défaut différentes, actées en clarification :

```ts
export async function registerSelfServeUser(db: Db, email: string, password: string): Promise<{ userId: string; cellarId: string }> {
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
    // false, contrairement à bootstrapSuperAdmin : une cave auto-créée par
    // une inscription libre — potentiellement n'importe qui sur internet —
    // ne doit pas avoir accès par défaut à la clé API IA partagée. Le
    // super-admin l'active au cas par cas depuis /admin/caves (inchangé).
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

Pas de nom personnalisable à l'inscription (décision de clarification) —
`'Ma Cave'` par défaut, renommable ensuite via le champ "Nom" déjà présent
sur `/cave/parametres` (chantier "Batch 3" livré le même jour). Aucun champ
supplémentaire sur le formulaire d'inscription pour ça.

## 3. Route — `POST /api/auth/signup`

Nouveau fichier `src/app/api/auth/signup/route.ts`. Corps : `{ email,
password }` (zod `.strict()`, email valide, mot de passe `min(8)` — même
règle que le mode signup de `POST /api/invitations/[token]/accept`).

Gating : vérifie `getAppSettings(db).registrationEnabled` **avant** tout
appel à `registerSelfServeUser` — décision de clarification : un seul
réglage pour les deux parcours de création de compte (inscription libre et
acceptation d'invitation en mode signup), pas un interrupteur séparé. Si
`false`, retourne 403 avec un message identique en esprit à celui déjà
utilisé sur la page d'invitation ("Les inscriptions sont actuellement
fermées.").

```ts
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

Connecte immédiatement l'utilisateur (même pattern que
`POST /api/invitations/[token]/accept` en mode signup) — pas d'étape de
confirmation intermédiaire.

## 4. Page — `src/app/signup/page.tsx`

Nouvelle route publique, au même niveau que `src/app/login/page.tsx` (hors
du groupe `(app)`, donc pas de nav applicative). Reprend fidèlement le
pattern déjà établi :
- Champs email + mot de passe + confirmation, avec le composant
  `PasswordInput` existant (`src/components/PasswordInput.tsx`), exactement
  comme `AcceptInvitationForm` (`src/components/AcceptInvitationForm.tsx`).
- **Bouton avec style disabled visible** (`disabled:opacity-40
  disabled:cursor-not-allowed`) quand le mot de passe fait moins de 8
  caractères ou que la confirmation ne correspond pas, plus le message
  d'aide correspondant — reprend explicitement le correctif appliqué le
  même jour sur `AcceptInvitationForm` (le bug où un bouton disabled sans
  style visible donnait l'impression que le clic ne faisait rien). Ne pas
  réintroduire ce bug ici.
- À la réussite : `router.push('/accueil')` + `router.refresh()`, comme un
  login normal.
- Erreur "email déjà utilisé" (409) affichée avec un lien vers `/login`,
  même esprit que le message équivalent sur `AcceptInvitationForm`.

## 5. Points d'entrée

- `src/app/login/page.tsx` : ajout d'un lien "Créer un compte" sous le
  formulaire, vers `/signup`.
- `src/app/page.tsx` (landing publique) : ajout d'un second bouton "Créer
  un compte" à côté du bouton "Se connecter" existant.

Si `registrationEnabled` est à `false`, ces liens restent visibles (la
page `/signup` elle-même affiche le message de fermeture après clic,
cohérent avec la manière dont `/invitations/[token]` gère déjà ce cas côté
serveur plutôt que de masquer les liens un peu partout côté client).

## 6. Ce qui ne change pas

- Le système d'invitation (`src/domain/invitations.ts`, la page
  `/invitations/[token]`, `AcceptInvitationForm`, la route d'acceptation)
  — aucune modification. Rejoindre une cave existante reste exclusivement
  ce parcours.
- `createUserAccount` (utilisée par le mode signup de l'acceptation
  d'invitation) — inchangée, coexiste avec la nouvelle
  `registerSelfServeUser` sans la remplacer (l'une crée un compte seul,
  l'autre crée compte + cave + membership).
- `POST /api/admin/cellars` et le reste du dashboard admin — inchangés.
  Un super-admin peut toujours créer une cave pour un utilisateur existant
  manuellement si besoin.
- `bootstrapSuperAdmin`/`scripts/bootstrap.ts` — inchangés, restent la
  façon de créer le tout premier compte super-admin.

## 7. Hors scope (ce chantier)

- Vérification d'email — aucune infrastructure d'envoi de mail n'existe
  dans cette app aujourd'hui, et le parcours d'acceptation d'invitation
  existant n'en fait pas non plus ; cohérent avec l'existant, pas une
  régression introduite ici.
- Récupération de mot de passe pour un compte auto-inscrit — le mécanisme
  `passwordResetTokens` existe déjà en base mais son parcours utilisateur
  n'est pas dans le scope de ce chantier (déjà hors scope avant, non remis
  en cause ici).
- Personnalisation du nom de la cave à l'inscription — décision de
  clarification, renommage seulement après coup via `/cave/parametres`.
- Choisir de rejoindre une cave existante depuis la page d'inscription
  libre plutôt que via une invitation — décision de clarification,
  contredit la séparation stricte actée en §1.
