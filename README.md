# Ma Cave

Application de gestion de cave à vin (mono-utilisateur) : clayettes, bouteilles de tous
types (vin, effervescent, cidre, bière, spiritueux), fenêtre de garde et historique de
consommation.

Stack : Next.js (App Router) + TypeScript strict, SQLite via `@libsql/client` + Drizzle
ORM, Zod, iron-session, Tailwind CSS, Vitest. Gestionnaire de paquets : **yarn**.

## Démarrage

```bash
cp .env.example .env
# Éditer .env :
#   SESSION_SECRET       -> une chaîne aléatoire d'au moins 32 caractères (obligatoire)
#   BOOTSTRAP_EMAIL      -> l'e-mail du compte super-admin à créer
#   BOOTSTRAP_PASSWORD   -> son mot de passe
#   BOOTSTRAP_CELLAR_NAME-> le nom de la cave initiale
#   ANTHROPIC_API_KEY    -> active les fonctions IA (analyse de bouteille, extraction
#                           par photo) ; l'app fonctionne sans, ces fonctions restent
#                           simplement masquées

mkdir -p data        # dossier de la base SQLite (DATABASE_URL=file:./data/cave.db)
yarn install
yarn db:migrate      # applique les migrations Drizzle
yarn bootstrap       # crée le super-admin, sa cave et son membership
yarn dev
```

L'application est ensuite disponible sur [http://localhost:3000](http://localhost:3000).
Se connecter sur `/login` avec les identifiants `BOOTSTRAP_EMAIL` /
`BOOTSTRAP_PASSWORD`.

> `yarn bootstrap` n'est à lancer qu'une seule fois : il échoue si l'e-mail existe déjà.
> Sans `SESSION_SECRET` d'au moins 32 caractères, l'application refuse de démarrer avec
> un message explicite.

## Docker (test local)

Deux services, définis dans `docker-compose.yml` (image `node:24` officielle, code monté
en direct depuis l'hôte — pas besoin de `docker compose watch`, qui demande Docker
Compose ≥ 2.22 ; ceci fonctionne dès la 2.x) :

- **`start`** — lance l'app avec `yarn dev`. Le serveur de développement de Next.js
  recharge déjà tout seul à chaque modification de fichier.
- **`build`** — vérification de types en continu (`tsc --watch`), pour un retour rapide
  sur les erreurs TypeScript pendant que tu codes. Ne redémarre pas `start`.

```bash
cp .env.example .env        # comme ci-dessus, avec de vraies valeurs
mkdir -p data

docker compose up start build     # ou : yarn docker:up
# ou séparément : yarn docker:start / yarn docker:watch
```

`node_modules` et `.next` sont des volumes anonymes propres à chaque conteneur (pas
partagés avec l'hôte) : le premier démarrage lance `yarn install` à l'intérieur du
conteneur (les binaires natifs de `@libsql/client` compilés sur macOS ne fonctionnent
pas dans un conteneur Linux), et ne mélange pas le cache Turbopack du conteneur avec un
éventuel `.next` de build local sur l'hôte.

La première fois, il faut créer le compte super-admin depuis l'intérieur du conteneur
`start` :

```bash
docker compose exec start yarn bootstrap
docker compose exec start yarn db:migrate   # si besoin, sinon appliqué au démarrage
```

Le fichier `data/cave.db` vit dans un volume monté depuis l'hôte, donc il survit aux
redémarrages des conteneurs.

> Ceci vise le test local sur ta machine. Un `Dockerfile` + `.dockerignore` séparés
> existent aussi pour construire une vraie image de production autonome
> (`docker build -t wine-cellar .`) — c'est ce que le déploiement réel sur le Raspberry
> Pi (build croisé ARM64, tunnel Cloudflare) utilisera, dans un chantier séparé comme
> prévu au design. `docker-compose.yml` ne s'en sert pas : il privilégie le montage en
> direct pour le confort d'itération locale.

## Scripts

| Commande                     | Rôle                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `yarn dev`                   | Serveur de développement                                     |
| `yarn build`                 | Build de production                                          |
| `yarn build:watch`           | Vérification de types en continu (`tsc --watch`, sans build) |
| `yarn start`                 | Serveur de production (après `yarn build`)                   |
| `yarn test`                  | Suite de tests Vitest (logique métier de `src/domain/*`)     |
| `yarn lint`                  | ESLint (type-aware) + conventions du projet                  |
| `yarn format`                | Vérifie le formatage Prettier (exécuté aussi en CI)          |
| `yarn format:fix`            | Applique le formatage Prettier                               |
| `yarn db:generate`           | Génère une migration Drizzle à partir du schéma              |
| `yarn db:migrate`            | Applique les migrations à la base                            |
| `yarn bootstrap`             | Crée le compte super-admin et sa cave initiale               |
| `yarn db:backfill-geography` | Recale région/sous-région des lignes existantes (idempotent) |
| `yarn docker:start`          | `docker compose up start` (lance l'app en conteneur)         |
| `yarn docker:watch`          | `docker compose up build` (vérification de types en continu) |
| `yarn docker:up`             | `docker compose up` (les deux services ensemble)             |

## Connecteur MCP (Claude)

L'app expose un serveur MCP sur `/mcp` (transport Streamable HTTP, sans session) : Claude
peut consulter et modifier la cave au nom d'un utilisateur, avec son rôle dans chaque cave
dont il est membre — jamais au-delà, même pour un super-admin. Désactivé tant que `MCP_PUBLIC_URL` n'est pas défini (voir `.env.example`).

- **Connexion** : dans claude.ai, Paramètres → Connecteurs → Ajouter un connecteur
  personnalisé, URL `<MCP_PUBLIC_URL>/mcp`. Claude ouvre la page `/oauth/authorize`, où
  l'on s'identifie avec son compte de la cave (email + mot de passe, redemandés à chaque
  autorisation).
- **OAuth** : l'app est son propre serveur d'autorisation (OAuth 2.1, enregistrement
  dynamique, PKCE S256). Jetons opaques, seule leur empreinte est stockée ; accès 30 jours,
  renouvellement 180 jours, tournant à chaque usage. Un refresh token réutilisé (signe
  d'un vol) révoque toute l'autorisation. Une réinitialisation de mot de passe ou un
  compte désactivé coupe immédiatement l'accès. Les adresses de retour sont limitées
  à claude.ai, claude.com et la boucle locale (Claude Code, MCP Inspector).
- **Tools** (`src/mcp/`) : `list_cellars`, `get_cellar_overview`, `search_bottles`,
  `get_bottle`, `add_bottle`, `update_bottle`, `delete_bottle`, `save_bottle_analysis`,
  `consume_bottle`, `list_consumptions`, `update_consumption`, `delete_consumption`,
  `list_wishlist`, `add_wishlist_item`, `update_wishlist_item`, `delete_wishlist_item`,
  `promote_wishlist_item`. Ils passent par les mêmes fonctions du domaine et les mêmes
  contrôles de rôle que les routes de l'API.
- **En local** : `MCP_PUBLIC_URL=http://localhost:3000`, puis
  `npx @modelcontextprotocol/inspector` sur `http://localhost:3000/mcp`, ou
  `claude mcp add --transport http ma-cave http://localhost:3000/mcp` dans Claude Code.

## Organisation du code

- `src/domain/*` — logique métier pure : chaque fonction reçoit une instance `Db` en
  paramètre (jamais le singleton), ce qui la rend testable contre une base en mémoire.
- `src/lib/*` — colle framework (session, garde d'authentification pour les pages et
  pour les routes API).
- `src/app/api/**` — routes API : elles authentifient, valident l'entrée, appellent le
  domaine et formatent la réponse.
- `src/app/(app)/**` — pages rendues côté serveur, protégées par `requireUser()`.
- `src/db/*` — schéma Drizzle, migrations et fabrique de base de test.
- `src/domain/oauth/*` — serveur d'autorisation OAuth qui protège `/mcp`.
- `src/mcp/*` — serveur MCP : tools, contrôles d'accès, mise en forme des réponses.

## Géographie viticole

Une bouteille porte trois niveaux, du plus large au plus précis : `region`
(Bordeaux), `sub_region` (Haut-Médoc) et l'appellation, dans `details` pour le
vin (Saint-Julien). `src/domain/wineGeography.ts` tient la table de
rattachement et le résolveur qui les recale les uns sur les autres — une AOC
connue détermine sa région, et une sous-région saisie dans le champ Région est
promue au bon niveau. Toute écriture (saisie, extraction par photo, génération
IA) y passe, et `yarn db:backfill-geography` l'applique aux lignes déjà en
base. Les tables sont volontairement partielles : une valeur inconnue est
conservée telle quelle, jamais effacée.
