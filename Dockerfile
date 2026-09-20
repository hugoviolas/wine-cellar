# syntax=docker/dockerfile:1
# La directive `syntax` garantit le frontend BuildKit qui comprend le
# `--mount=type=cache` ci-dessous, quelle que soit la version de Docker
# installée sur le runner. Sans elle, un Docker un peu ancien refuserait le
# Dockerfile au lieu de l'exécuter.

FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./

# Deux protections contre la connexion résidentielle du Pi, où cette étape
# a déjà fait échouer deux déploiements d'affilée sur un ESOCKETTIMEDOUT :
#
# - `--network-timeout` : yarn v1 abandonne une requête au bout de 30 s par
#   défaut, ce qui ne suffit pas pour un gros tarball en ADSL montante
#   saturée. Dix minutes laissent le téléchargement finir au lieu de perdre
#   les six tentatives précédentes.
# - le cache monté : il survit d'un build à l'autre sur le runner, donc une
#   relance après un échec ne repart pas de zéro et ne redemande au réseau
#   que ce qui manque. C'est ce qui rend un `Re-run failed jobs` utile
#   plutôt qu'un second coup de dés.
#
# Le cache ne remplace pas le lockfile : `--frozen-lockfile` reste la
# source de vérité, le cache n'évite que le retéléchargement.
#
# `YARN_CACHE_FOLDER` est posé sur la ligne plutôt qu'en `ENV` : il vaut
# pour cette commande seule, donc l'image finale ne garde pas un chemin de
# cache qui n'existera plus à l'exécution. Il évite surtout d'avoir à
# deviner où yarn place son cache dans cette image — le point de montage
# et le cache sont le même chemin par construction.
RUN --mount=type=cache,target=/yarn-cache \
    YARN_CACHE_FOLDER=/yarn-cache yarn install --frozen-lockfile --network-timeout 600000

COPY . .

RUN yarn build

# Le serveur tourne sous le compte non privilégié `node` (uid 1000, fourni
# par l'image officielle) : rien dans l'app n'a besoin de root, et une
# éventuelle exécution de code arbitraire n'hériterait pas de ses droits.
#
# ATTENTION — `data/` est monté depuis l'hôte (voir docker-compose.*.yml),
# et un `chown` fait ici ne s'applique PAS au volume monté au démarrage.
# Le dossier doit appartenir à l'uid 1000 côté hôte, sinon `yarn db:migrate`
# ne peut plus écrire dans la base et le conteneur s'arrête. À faire une
# seule fois sur le Pi, avant de déployer cette version :
#   sudo chown -R 1000:1000 /opt/cave-vin-prod/data /opt/cave-vin-preprod/data
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Applique les migrations (idempotent — drizzle ne rejoue pas ce qui est déjà
# appliqué) avant de démarrer le serveur. Le bootstrap du premier compte
# reste une commande manuelle (voir README) : le rejouer créerait un
# conflit sur l'email déjà pris.
CMD ["sh", "-c", "yarn db:migrate && yarn start"]
