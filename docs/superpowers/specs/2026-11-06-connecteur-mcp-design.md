# Connecteur MCP — Design

Date : 2026-11-06
Statut : implémenté.

## 1. Objectif

Donner à Claude (claude.ai, Claude Code) un accès à la cave : consulter le stock, conseiller
une bouteille, enregistrer une dégustation, ranger un achat, tenir la wishlist — au nom
d'un utilisateur et avec ses droits.

## 2. Décisions structurantes

- **Dans l'app Next, pas à côté.** Route `/mcp` (transport Streamable HTTP sans session,
  réponses JSON, un serveur MCP par requête). Les tools appellent les fonctions du domaine
  et les mêmes contrôles d'accès que les routes de l'API : pas de second accès à la base,
  pas de règle dupliquée, un seul conteneur à déployer. Les règles d'édition d'une
  bouteille que la route `PATCH /api/bottles/[id]` portait seule (champs personnels
  ouverts aux lecteurs, déplacement limité à la cave) sont passées dans
  `domain/bottleEditing.ts`, partagé par les deux.
- **Multi-utilisateur.** Le jeton OAuth est lié à un compte de la cave ; chaque tool agit
  avec les rôles de ce compte (owner / editor / reader, super-admin compris). La wishlist
  reste strictement personnelle.
- **L'app est son propre serveur OAuth**, comme le serveur MCP Mealie et health-mcp :
  enregistrement dynamique (RFC 7591), code + PKCE S256, refresh tournant, révocation
  (RFC 7009), métadonnées RFC 8414 et RFC 9728. Pas d'Express ni de `mcpAuthRouter` : les
  endpoints sont des route handlers, et l'état (clients, codes, jetons) vit en base —
  deux route handlers ne partagent pas forcément un module en mémoire.
- **Opt-in par environnement** : `MCP_PUBLIC_URL` (émetteur OAuth). Absente, tout répond
  404 — c'est le cas de la préprod.

## 3. Sécurité

- Page d'autorisation : email + mot de passe du compte **à chaque autorisation**, même
  avec une session ouverte (pas d'autorisation en un clic depuis un lien piégé). Mêmes
  seaux de limitation de débit que `/api/auth/login`.
- Adresses de retour limitées à `https://claude.ai`, `https://claude.com` et la boucle
  locale : l'enregistrement étant ouvert, c'est ce qui empêche un tiers de récupérer un
  code émis sur le bon domaine.
- Jetons et codes : 32 octets aléatoires, seule l'empreinte SHA-256 est stockée. Code à
  usage unique, brûlé dès sa présentation. Refresh : la paire précédente est supprimée à
  chaque renouvellement.
- Validité liée au compte : compte désactivé ou supprimé, ou mot de passe réinitialisé
  après l'autorisation (`users.sessionsValidFrom` comparé à l'heure de l'autorisation
  d'origine, conservée d'un refresh à l'autre) ⇒ accès refusé.
- Clients jamais utilisés purgés au bout d'un jour ; enregistrement limité par IP.
- `/mcp` et les endpoints OAuth appelés par des machines sont exemptés du contrôle
  d'origine de `proxy.ts` : sans cookie, pas de CSRF possible.

## 4. Tools

| Lecture               | Écriture                                                      |
| --------------------- | ------------------------------------------------------------- |
| `list_cellars`        | `add_bottle`, `update_bottle`, `delete_bottle`                |
| `get_cellar_overview` | `save_bottle_analysis` (analyse rédigée par Claude)           |
| `search_bottles`      | `consume_bottle`, `update_consumption`, `delete_consumption`  |
| `get_bottle`          | `add_wishlist_item`, `update_wishlist_item`                   |
| `list_consumptions`   | `delete_wishlist_item`, `promote_wishlist_item`               |
| `list_wishlist`       |                                                               |

- Paramètres et réponses en snake_case ; champs `null` omis des réponses.
- `search_bottles` filtre en mémoire (recherche sans accents, impossible en SQL avec
  SQLite) : une cave tient en quelques centaines de lignes. Pagination `limit`/`offset`.
- `save_bottle_analysis` écrit au même endroit que l'analyse IA de l'app, avec les mêmes
  règles de non-écrasement (`buildAiAnalysisPatch`), sans appel payant à l'API.
- Jours en `AAAA-MM-JJ` à l'heure de Paris (`domain/parisDate.ts`).

## 5. Hors périmètre (pistes)

- Page « Applications connectées » dans l'app pour lister et révoquer les autorisations.
- Gestion des clayettes (création, renommage) et des membres par MCP.
- CORS sur `/mcp` pour un client MCP 100 % navigateur.
