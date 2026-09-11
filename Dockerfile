FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

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
