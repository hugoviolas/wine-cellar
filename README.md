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

Pour lancer l'app dans un conteneur, avec reconstruction automatique de l'image à
chaque modification de fichier :

```bash
cp .env.example .env        # comme ci-dessus, avec de vraies valeurs
mkdir -p data

docker compose watch
```

`docker compose watch` démarre le conteneur (`docker-compose.yml`, service `app`) et
surveille les fichiers du projet : chaque sauvegarde reconstruit l'image et relance le
conteneur avec le code à jour. Le fichier `data/cave.db` vit dans un volume monté depuis
l'hôte, donc il survit aux rebuilds.

La première fois, il faut créer le compte super-admin depuis l'intérieur du conteneur :

```bash
docker compose exec app yarn bootstrap
```

(les migrations, elles, s'appliquent automatiquement à chaque démarrage du conteneur —
`yarn db:migrate` est idempotent).

Sans `--watch`, `docker compose up --build` fonctionne aussi pour un lancement simple
sans reconstruction automatique.

> Ceci vise le test local sur ta machine. Le déploiement réel sur le Raspberry Pi (build
> croisé ARM64, tunnel Cloudflare) reste à faire dans un chantier séparé, comme prévu au
> design.

## Scripts

| Commande           | Rôle                                                      |
| ------------------ | --------------------------------------------------------- |
| `yarn dev`         | Serveur de développement                                   |
| `yarn build`       | Build de production                                        |
| `yarn start`       | Serveur de production (après `yarn build`)                  |
| `yarn test`        | Suite de tests Vitest (logique métier de `src/domain/*`)    |
| `yarn lint`        | ESLint                                                     |
| `yarn db:generate` | Génère une migration Drizzle à partir du schéma            |
| `yarn db:migrate`  | Applique les migrations à la base                           |
| `yarn bootstrap`   | Crée le compte super-admin et sa cave initiale              |

## Organisation du code

- `src/domain/*` — logique métier pure : chaque fonction reçoit une instance `Db` en
  paramètre (jamais le singleton), ce qui la rend testable contre une base en mémoire.
- `src/lib/*` — colle framework (session, garde d'authentification pour les pages et
  pour les routes API).
- `src/app/api/**` — routes API : elles authentifient, valident l'entrée, appellent le
  domaine et formatent la réponse.
- `src/app/(app)/**` — pages rendues côté serveur, protégées par `requireUser()`.
- `src/db/*` — schéma Drizzle, migrations et fabrique de base de test.
