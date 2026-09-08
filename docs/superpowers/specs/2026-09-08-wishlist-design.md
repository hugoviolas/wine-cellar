# Wishlist — Design

Date : 2026-09-08
Statut : validé en brainstorming, en attente de revue finale avant plan d'implémentation.

## 1. Vue d'ensemble

Nouveau chantier de backlog (`## Batch 3` du fichier de suivi) : permettre à
un utilisateur d'ajouter une bouteille à une liste d'envies — même formulaire
qu'un ajout normal (manuel ou par photo), mais sans clayette, sans quantité,
et sans analyse IA à ce stade — puis, depuis la fiche de cet item, de la
« promouvoir » vers une vraie clayette d'une de ses caves. Une fois promue,
c'est une bouteille normale : le bouton d'analyse IA déjà existant sur
`/bottles/[id]` fonctionne sans aucun changement.

**Décision structurante, actée en clarification** : la wishlist est à la
maille de l'**utilisateur**, pas de la cave. Un item n'appartient à aucune
cave et n'est visible par personne d'autre que son créateur — y compris un
super-admin (contrairement aux caves, où le super-admin a un accès
transverse). C'est une donnée strictement privée jusqu'à sa promotion, à
laquelle elle devient une bouteille normale (donc visible par les membres de
la cave choisie, comme n'importe quelle bouteille).

## 2. Modèle de données

Nouvelle table `wishlist_items` (`src/db/schema.ts`), indépendante de
`bottles`/`crates` — pas de `crateId`, pas de `cellarId` :

```ts
export const wishlistItems = sqliteTable('wishlist_items', {
  id: text('id').primaryKey(),
  // Nullable + set null, même raison que cellars.ownerId : deleteUser ne
  // supprime jamais ce qu'un compte possède, seulement la ligne users.
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
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
  // Même schéma par catégorie que bottles.details (cépages, appellation...).
  details: text('details', { mode: 'json' }).notNull(),
  status: text('status', { enum: ['pending', 'promoted'] }).notNull().default('pending'),
  // Rempli à la promotion. Nullable + set null : si la bouteille promue est
  // ensuite supprimée (consommée puis retirée, ou cave supprimée), l'item
  // wishlist reste "promoted" mais perd son lien plutôt que d'empêcher la
  // suppression de la bouteille.
  promotedBottleId: text('promoted_bottle_id').references(() => bottles.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
});
```

Champs volontairement absents (décisions de clarification) :
- Pas de `quantity` — n'a de sens qu'au moment de la promotion (comme un
  ajout normal), pas avant.
- Pas de `drinkFrom`/`drinkUntil` — ces colonnes n'ont d'ailleurs pas de
  saisie manuelle même sur `bottles` aujourd'hui (seule l'IA les renseigne).
- Pas de champs IA (`aiAnalysis`, `aiPairings`, etc.) — jamais analysée en
  tant qu'item wishlist, par décision explicite du chantier.

Migration générée via `yarn db:generate`, appliquée au dev réel via
`yarn db:migrate` (ne pas oublier cette étape manuelle — voir l'incident
similaire du chantier admin, où la migration était restée sur disque sans
être appliquée à `data/cave.db`).

## 3. Domaine — `src/domain/wishlist.ts`

Même schéma de détails par catégorie que les bouteilles
(`parseBottleDetails`/`detailsSchemaByCategory` de `bottleCategories.ts`,
réutilisé tel quel — aucune duplication).

```ts
export interface CreateWishlistItemInput {
  userId: string;
  category: BottleCategory;
  name: string;
  producer?: string;
  vintage?: number;
  region?: string;
  color?: string;
  abv?: number;
  volumeMl?: number;
  details: unknown;
}
export async function createWishlistItem(db: Db, input: CreateWishlistItemInput): Promise<string>;

export async function listWishlistItems(db: Db, userId: string);
// Retourne tous les items (pending + promoted) triés par createdAt desc ;
// la page liste groupe/filtre à l'affichage (voir section 5).

export async function getWishlistItem(db: Db, id: string);

export type WishlistItemAccessResult =
  | { status: 'ok'; item: <ligne wishlist_items> }
  | { status: 'not_found' }
  | { status: 'forbidden' };
export async function resolveWishlistItemAccess(db: Db, userId: string, itemId: string): Promise<WishlistItemAccessResult>;
// item.userId !== userId → forbidden. Pas de bypass super-admin (voir §1).

export const updateWishlistItemBodySchema = z.object({
  name: z.string().min(1).optional(),
  producer: z.string().nullable().optional(),
  vintage: z.number().int().nullable().optional(),
  region: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  abv: z.number().nullable().optional(),
  volumeMl: z.number().int().nullable().optional(),
  details: z.unknown().optional(),
}).strict();
// category volontairement absente : immuable après création, comme sur bottles.
export async function updateWishlistItem(db: Db, id: string, input: UpdateWishlistItemInput): Promise<void>;

export async function deleteWishlistItem(db: Db, id: string): Promise<void>;

export const promoteWishlistItemBodySchema = z.object({
  crateId: z.string().min(1),
  quantity: z.number().int().min(1),
}).strict();
export async function promoteWishlistItem(
  db: Db,
  item: <ligne wishlist_items, status 'pending'>,
  input: { crateId: string; quantity: number },
): Promise<{ bottleId: string }>;
// Construit un CreateBottleInput à partir des champs de l'item (category,
// name, producer, vintage, region, color, abv, volumeMl, details) +
// crateId/quantity fournis, appelle createBottle (src/domain/bottles.ts,
// inchangé), puis met à jour l'item : status='promoted', promotedBottleId.
// Refuse (throw) si item.status !== 'pending' — pas de double promotion.
```

## 4. Disponibilité de l'IA pour la wishlist

`isAiAvailable(cellar)` existant reste inchangé (toujours utilisé tel quel
pour les bouteilles réelles, chantiers A/B existants). Nouvelle fonction,
même fichier `src/domain/ai/available.ts` :

```ts
export async function isAiAvailableForUser(db: Db, userId: string): Promise<boolean> {
  if (!hasApiKeyConfigured()) return false;
  const rows = await db
    .select({ aiEnabled: cellars.aiEnabled })
    .from(cellarMemberships)
    .innerJoin(cellars, eq(cellarMemberships.cellarId, cellars.id))
    .where(eq(cellarMemberships.userId, userId));
  return rows.some((row) => row.aiEnabled);
}
```

Décision de clarification : disponible dès qu'**au moins une** des caves de
l'utilisateur a `aiEnabled = true` (et que la clé API globale est
configurée) — même logique de bon sens que l'accès à la fonctionnalité
elle-même. Un super-admin qui désactive l'IA sur *toutes* les caves d'un
utilisateur bloque donc aussi sa wishlist ; ce n'est pas un cas jugé à
traiter spécifiquement.

Utilisée pour : (a) afficher ou non le bouton « Remplir depuis une photo »
sur `/wishlist/ajouter` ; (b) revérifiée côté serveur dans la nouvelle route
d'extraction (voir §6), jamais uniquement côté UI — même garde-fou que les
chantiers A/B existants.

## 5. Pages

Toutes sous `(app)`, donc protégées par `requireUser` (login requis), mais
**indépendantes de `resolveViewedCellarId`** — pas de notion de cave
courante ici.

- **`/wishlist`** — liste des items de l'utilisateur connecté
  (`listWishlistItems`). Deux sections : « À trouver » (status `pending`,
  triés du plus récent au plus ancien) et « Déjà en cave » (status
  `promoted`, avec lien direct vers `/bottles/[promotedBottleId]`) — décision
  de clarification : les items promus restent visibles, pas supprimés.
- **`/wishlist/ajouter`** — formulaire de création. Repris de
  `AddBottleForm` en retirant clayette et quantité (n'existent pas encore à
  ce stade) ; le bouton photo utilise la nouvelle route d'extraction dédiée
  (§6), gardé par `isAiAvailableForUser`.
- **`/wishlist/[id]`** — détail + édition (repris de `EditBottleForm`, mêmes
  champs identité + cépages/appellation par catégorie) + section
  « Ajouter à ma cave » si `status === 'pending'` : sélecteur de clayette
  (limité aux caves où l'utilisateur a `canEditCellarContent`, regroupées
  par nom de cave) + quantité + bouton « Ajouter à ma cave », qui appelle la
  route de promotion (§6) et redirige vers `/bottles/[bottleId]` (la
  bouteille fraîchement créée) à la réussite. Si l'utilisateur n'a de droit
  d'édition sur aucune cave, la section affiche un message au lieu du
  formulaire plutôt que de planter ou de rester vide sans explication. Si
  `status === 'promoted'`, affiche un lien « Voir la bouteille » à la place.

Nav (`src/components/MobileNav.tsx`) : lien « Wishlist » ajouté juste après
« Cave ».

## 6. Routes API

- **`POST /api/wishlist`** — création. Corps : les champs de
  `CreateWishlistItemInput` sans `userId` (pris de la session). Gating :
  `requireApiUser` uniquement — pas de vérification de cave, cohérent avec
  le caractère user-scoped.
- **`PATCH /api/wishlist/[id]`** — édition. Gating : `requireApiUser` →
  `resolveWishlistItemAccess` → doit être `status: 'ok'` (donc déjà garanti
  propriétaire). `details` revalidé via `parseBottleDetails(item.category, ...)`
  avant écriture, même pattern que `PATCH /api/bottles/[id]`.
- **`DELETE /api/wishlist/[id]`** — suppression. Même gating.
- **`POST /api/wishlist/[id]/promote`** — promotion. Gating :
  `requireApiUser` → `resolveWishlistItemAccess` (propriétaire) → item doit
  être `pending` (409 sinon) → la `crateId` fournie doit appartenir à une
  cave où `canEditCellarContent(role)` est vrai pour cet utilisateur (même
  vérification que `POST /api/bottles`, réutilisée via `getCrateById` +
  `checkCellarAccess`). Appelle `promoteWishlistItem`, retourne
  `{ bottleId }`.
- **`POST /api/wishlist/extract-from-photo`** — nouvelle route dédiée
  (ne réutilise pas `/api/bottles/extract-from-photo`, qui est ancrée à un
  `cellarId` précis). Corps : `{ imageBase64, mediaType }` (pas de
  `cellarId`). Gating : `requireApiUser` → `isAiAvailableForUser(db, userId)`.
  Réutilise tel quel `buildPhotoExtractionPrompt` et
  `aiPhotoExtractionSchema` (déjà génériques, aucune duplication) — seule la
  fonction de gating change par rapport à la route existante.

## 7. Ce qui ne change pas

- `createBottle`, `bottles` (table, domaine, routes), `AiAnalysisButton`,
  `/bottles/[id]/ai-generate` — aucune modification. Une fois promu, un item
  wishlist devient une bouteille comme une autre, avec tout le flux IA
  existant.
- `AddBottleForm`/`EditBottleForm` — pas touchés ; les formulaires wishlist
  sont de nouveaux composants dédiés (`WishlistAddForm`/`WishlistEditForm`)
  qui partagent la même forme de champs mais pas le composant lui-même
  (celui de la bouteille est lié à `cellarId`/`crateId`/`quantity`, celui de
  la wishlist ne l'est pas — les fusionner introduirait plus de
  branchement conditionnel que de code réellement partagé).

## 8. Hors scope (ce chantier)

- Quantité souhaitée sur l'item wishlist — décision de clarification,
  seulement au moment de la promotion.
- Notification/rappel sur les items en attente — jamais évoqué.
- Partage d'un item wishlist avec d'autres utilisateurs — contredit la
  décision structurante (§1).
- Affichage du nombre d'items wishlist sur `/accueil` — pas demandé, pas
  ajouté sans nouvelle demande explicite.
