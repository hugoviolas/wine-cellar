FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

EXPOSE 3000

# Applique les migrations (idempotent — drizzle ne rejoue pas ce qui est déjà
# appliqué) avant de démarrer le serveur. Le bootstrap du premier compte
# reste une commande manuelle (voir README) : le rejouer créerait un
# conflit sur l'email déjà pris.
CMD ["sh", "-c", "yarn db:migrate && yarn start"]
