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

| Commande           | Rôle                                                      |
| ------------------ | --------------------------------------------------------- |
| `yarn dev`         | Serveur de développement                                   |
| `yarn build`       | Build de production                                        |
| `yarn build:watch` | Vérification de types en continu (`tsc --watch`, sans build)|
| `yarn start`       | Serveur de production (après `yarn build`)                  |
| `yarn test`        | Suite de tests Vitest (logique métier de `src/domain/*`)    |
| `yarn lint`        | ESLint                                                     |
| `yarn db:generate` | Génère une migration Drizzle à partir du schéma            |
| `yarn db:migrate`  | Applique les migrations à la base                           |
| `yarn bootstrap`   | Crée le compte super-admin et sa cave initiale              |
| `yarn docker:start`| `docker compose up start` (lance l'app en conteneur)         |
| `yarn docker:watch`| `docker compose up build` (vérification de types en continu) |
| `yarn docker:up`   | `docker compose up` (les deux services ensemble)              |

## Organisation du code

- `src/domain/*` — logique métier pure : chaque fonction reçoit une instance `Db` en
  paramètre (jamais le singleton), ce qui la rend testable contre une base en mémoire.
- `src/lib/*` — colle framework (session, garde d'authentification pour les pages et
  pour les routes API).
- `src/app/api/**` — routes API : elles authentifient, valident l'entrée, appellent le
  domaine et formatent la réponse.
- `src/app/(app)/**` — pages rendues côté serveur, protégées par `requireUser()`.
- `src/db/*` — schéma Drizzle, migrations et fabrique de base de test.
