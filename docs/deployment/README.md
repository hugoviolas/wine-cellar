# Déploiement CI/CD — guide de mise en place

Ce guide couvre tout ce que les workflows GitHub Actions ne peuvent pas
faire eux-mêmes : configurer le Raspberry Pi, GitHub, et Cloudflare, une
fois. Les fichiers concernés :

- `.github/workflows/preprod.yml` — build + tests + déploiement préprod,
  sur push à `dev` ou activité sur une PR vers `master`.
- `.github/workflows/prod.yml` — build + tests + déploiement prod
  (approbation manuelle), sur push à `master`.
- `.github/workflows/rollback-preprod.yml` /
  `.github/workflows/rollback-prod.yml` — redéploiement manuel d'un tag
  d'image antérieur.
- `docker-compose.preprod.yml` / `docker-compose.prod.yml` — les deux
  stacks.

## 1. Renommer la branche en `dev`

Il n'existe aujourd'hui que `master` et `feat/wine-cellar` sur GitHub.
Renommage local + push :

```bash
git branch -m feat/wine-cellar dev
git push origin dev
git push origin --delete feat/wine-cellar
```

Si une pull request est déjà ouverte depuis `feat/wine-cellar`, fais le
renommage **depuis l'interface GitHub** à la place (Branches → renommer) :
GitHub met alors la PR à jour automatiquement pour pointer vers le nouveau
nom. Un renommage en ligne de commande (delete + push) ne préserve pas
une PR existante.

## 2. Préparer le Raspberry Pi

Docker + Compose doivent être installés (`docker --version`,
`docker compose version`). Le runner GitHub Actions doit pouvoir lancer
`docker compose` sans `sudo` :

```bash
sudo usermod -aG docker $USER
# se reconnecter (ou `newgrp docker`) pour que ça prenne effet
```

Corepack (Yarn) doit être activé une fois pour toutes au niveau machine —
si Node vient du gestionnaire de paquets du système, ses binaires
appartiennent à root et un `corepack enable` lancé par le runner (utilisateur
normal) échoue avec `EACCES`. D'où ce `sudo`, une seule fois :

```bash
sudo corepack enable
```

Crée les deux dossiers persistants, séparés de tout checkout git — c'est
là que vivent les vraies données et les secrets, jamais dans le repo :

```bash
sudo mkdir -p /opt/cave-vin-preprod/data /opt/cave-vin-prod/data
sudo chown -R $USER:$USER /opt/cave-vin-preprod /opt/cave-vin-prod
```

Crée le fichier `.env` de chaque environnement (jamais commité, sert à la
fois de config compose et d'environnement du conteneur) :

`/opt/cave-vin-preprod/.env` :
```env
DATABASE_URL=file:./data/cave.db
SESSION_SECRET=<chaîne aléatoire d'au moins 32 caractères, différente de la prod>
BOOTSTRAP_EMAIL=toi@example.com
BOOTSTRAP_PASSWORD=<mot de passe temporaire>
BOOTSTRAP_CELLAR_NAME=Préprod
ANTHROPIC_API_KEY=
```

`/opt/cave-vin-prod/.env` :
```env
DATABASE_URL=file:./data/cave.db
SESSION_SECRET=<chaîne aléatoire d'au moins 32 caractères, différente de la préprod>
BOOTSTRAP_EMAIL=toi@example.com
BOOTSTRAP_PASSWORD=<mot de passe temporaire>
BOOTSTRAP_CELLAR_NAME=Ma Cave
ANTHROPIC_API_KEY=<ta vraie clé, si tu veux l'IA en prod>
TUNNEL_TOKEN=<rempli à l'étape 5>
```

`ANTHROPIC_API_KEY` vide en préprod est volontaire — pas besoin d'exposer
la clé à un environnement de test.

Génère un `SESSION_SECRET` avec :
```bash
openssl rand -base64 32
```

Chaque environnement générera son propre `cellars.ai_enabled` par cave —
ce `.env` ne contrôle que la disponibilité globale de la clé, pas quelles
caves y ont accès (réglable ensuite depuis `/admin/caves`).

## 3. Installer le runner self-hosted

Sur le Pi (architecture ARM64). Dans GitHub : Settings du repo → Actions →
Runners → New self-hosted runner → Linux ARM64, pour obtenir le lien de
téléchargement exact et le token d'enregistrement (le token expire vite,
lance les commandes qui suivent tout de suite après l'avoir copié).

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-arm64.tar.gz -L \
  https://github.com/actions/runner/releases/download/vX.Y.Z/actions-runner-linux-arm64-X.Y.Z.tar.gz
tar xzf actions-runner-linux-arm64.tar.gz

./config.sh --url https://github.com/hugoviolas/wine-cellar --token <TOKEN_COPIÉ>
# Nom du runner, labels : laisse les valeurs par défaut, le label "self-hosted"
# suffit — c'est exactement ce que `runs-on: self-hosted` cible dans les workflows.

sudo ./svc.sh install
sudo ./svc.sh start
```

`svc.sh install` fait tourner le runner comme service systemd — il survit
aux redémarrages du Pi et se relance tout seul. Vérifie qu'il apparaît
« Idle » dans Settings → Actions → Runners après `sudo ./svc.sh start`.

## 4. Protéger le déploiement prod (approbation manuelle)

Settings du repo → Environments → New environment → nom exact `production`
(les workflows y font référence littéralement). Coche **Required
reviewers**, ajoute-toi. À partir de là, le job `deploy-prod` du workflow
prod (et `rollback-prod`) reste en pause tant que tu n'as pas cliqué
« Approve » dans l'onglet Actions de la run concernée.

## 5. Cloudflare Tunnel

Dans le dashboard Cloudflare Zero Trust (`one.dash.cloudflare.com`) →
Networks → Tunnels → Create a tunnel → Cloudflared → donne-lui un nom
(ex. `cave-vin-prod`).

À l'étape « Install connector », choisis Docker — Cloudflare affiche une
commande contenant un token ; copie uniquement le token (la longue chaîne
après `--token`) dans `TUNNEL_TOKEN=` de `/opt/cave-vin-prod/.env` (voir
étape 2). Le conteneur `cloudflared` du `docker-compose.prod.yml` le
récupère automatiquement au démarrage — pas besoin de lancer la commande
que Cloudflare affiche telle quelle.

Étape « Public Hostname » du même tunnel :
- Subdomain : `cave`
- Domain : `paupau-cuisine.com`
- Service Type : `HTTP`
- URL : `app:3000`

`app:3000` fonctionne parce que `cloudflared` et `app` sont deux services
du même `docker-compose.prod.yml` — ils se voient par nom de service sur
le réseau Docker créé automatiquement par Compose, sans rien exposer sur
l'hôte.

## 6. Premier déploiement

Une fois tout ce qui précède en place :

```bash
git push origin dev            # déclenche preprod.yml
# vérifie http://<ip-locale-du-pi>:3001

git checkout master && git merge dev && git push origin master   # déclenche prod.yml
# approuve le déploiement dans l'onglet Actions (étape 4)
# vérifie https://cave.paupau-cuisine.com
```

Puis, une seule fois par environnement, initialise le premier compte :

```bash
docker compose -f /opt/cave-vin-prod/docker-compose.yml exec app yarn bootstrap
docker compose -f /opt/cave-vin-preprod/docker-compose.yml exec app yarn bootstrap
```

(Utilise les valeurs `BOOTSTRAP_*` définies dans le `.env` de chaque
environnement à l'étape 2.)

## 7. Rollback

Depuis l'onglet Actions du repo → workflow « Rollback préprod » ou
« Rollback prod » → Run workflow → colle le SHA du commit à redéployer
(visible dans l'historique des commits, ou dans les tags d'image sur
`ghcr.io/hugoviolas/wine-cellar` — packages du repo GitHub). Le rollback
prod passe par la même approbation manuelle que le déploiement normal.

## Résumé de ce qui vit où

| Où | Quoi |
|---|---|
| Dans le repo git | Code, `Dockerfile`, workflows, `docker-compose.*.yml` (structure, sans secret) |
| `/opt/cave-vin-preprod/` sur le Pi | `.env` (secrets préprod), `data/` (SQLite préprod), `docker-compose.yml` (copié par le workflow à chaque déploiement) |
| `/opt/cave-vin-prod/` sur le Pi | `.env` (secrets prod, dont `TUNNEL_TOKEN`), `data/` (SQLite prod), `docker-compose.yml` (copié par le workflow) |
| `ghcr.io/hugoviolas/wine-cellar` | Images Docker taggées par SHA de commit, plus `:preprod` et `:prod` (dernière déployée dans chaque environnement) |
