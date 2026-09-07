# Partage multi-utilisateurs et dashboard admin — Design

Date : 2026-09-07
Statut : validé en brainstorming, en attente de revue finale avant plan d'implémentation.

## 1. Vue d'ensemble

Ce plan construit, par-dessus la base mono-utilisateur déjà livrée (docs/superpowers/specs/2026-09-06-cave-a-vin-design.md,
implémentée dans docs/superpowers/plans/2026-09-06-fondations-cave-mono-utilisateur.md),
les deux morceaux du spec original section 4 et 7 encore non construits :

- Le partage d'une cave avec d'autres comptes, par invitation, avec des rôles
  (`owner` / `editor` / `reader`).
- Le dashboard super-admin (gestion des utilisateurs, vue transverse des caves,
  réglages globaux).

Tout ce qui suit s'appuie sur des éléments déjà en place et inchangés : `users`,
`cellars`, `cellarMemberships`, `checkCellarAccess` (renvoie déjà le rôle exact —
`owner` / `editor` / `reader` / `super_admin`), `requireUser` / `requireApiUser`,
`is_super_admin` sur `users`.

## 2. Modèle de données

Deux nouvelles tables, un nouveau champ :

```
invitations
  id, cellarId, email, role ('editor'|'reader'), token, status ('pending'|'accepted'|'expired'),
  invitedByUserId, expiresAt, createdAt

password_reset_tokens
  id, userId, token, expiresAt, usedAt (nullable), createdAt

users.isActive : boolean, défaut true
```

Table séparée pour chaque type de token plutôt qu'une table générique unifiée :
une invitation cible un email (le compte n'existe pas forcément encore) plus une
cave et un rôle ; un reset cible un `userId` déjà existant. Les formes divergent
assez pour qu'un schéma commun soit plus confus qu'utile.

`token` : chaîne aléatoire (32 octets, encodée en hex — même approche que
`SESSION_SECRET`), générée côté serveur, jamais devinable. Expiration : 7 jours
pour une invitation, 24h pour un reset — assez long pour que le owner ait le
temps de transmettre le lien, assez court pour limiter l'exposition d'un lien
oublié quelque part.

## 3. Modèle de permissions

Aucun changement de schéma : `checkCellarAccess(db, userId, cellarId)` renvoie déjà
`{ allowed: true, role }` avec le rôle exact. Deux petits helpers de domaine
(`src/domain/permissions.ts`) au-dessus de ce rôle :

```ts
export function canManageCellar(role: CellarRole): boolean {
  return role === 'owner' || role === 'super_admin';
}

export function canEditCellarContent(role: CellarRole): boolean {
  return role === 'owner' || role === 'editor' || role === 'super_admin';
}
```

Matrice de permissions par rôle :

| Action | owner | editor | reader | super_admin |
|---|---|---|---|---|
| Consulter (clayettes, bouteilles, historique) | ✅ | ✅ | ✅ | ✅ |
| Consommer une bouteille + noter | ✅ | ✅ | ✅ | ✅ |
| Créer/renommer/supprimer/réordonner une clayette | ✅ | ✅ | ❌ | ✅ |
| Créer/modifier/déplacer/supprimer une bouteille | ✅ | ✅ | ❌ | ✅ |
| Activer/désactiver `ai_enabled` de la cave | ✅ | ❌ | ❌ | ✅ |
| Inviter/retirer un membre, changer un rôle | ✅ | ❌ | ❌ | ✅ |
| Créer une nouvelle cave | ❌ | ❌ | ❌ | ✅ (seul point d'entrée) |

Chaque route de mutation existante (`crates`, `bottles`) qui vérifie aujourd'hui
seulement `access.allowed` gagne un appel à `canEditCellarContent(access.role)`
avant d'agir, renvoyant 403 sinon. Les routes de consommation/note restent
inchangées (déjà ouvertes à tout membre).

## 4. Flux d'invitation et gestion des membres

Nouvelle page `/cave/parametres` (visible seulement si `canManageCellar(role)` —
403/redirection sinon), deux sections. Elle ne gère que le partage dans ce
plan : pas de renommage de cave, pas de toggle `ai_enabled` (lié à l'intégration
IA, hors scope ici, non construit).

**Inviter** : formulaire email + rôle → `POST /api/invitations` crée la ligne,
renvoie le token. L'UI affiche le lien complet (`{origin}/invitations/{token}`)
dans un champ à copier — pas d'envoi automatique, le owner le transmet par le
canal de son choix.

**Membres actuels** : liste des `cellarMemberships` de la cave (email, rôle,
depuis quand), avec pour chaque ligne autre que le owner lui-même : changer le
rôle (`editor` ↔ `reader`) et retirer le membre (supprime le membership ;
l'utilisateur perd l'accès à la cave, ses éventuelles notes/consommations
passées restent en base — elles référencent `consumedByUserId`, pas le
membership). Le owner ne peut pas se retirer lui-même ni changer son propre
rôle depuis cette liste (une cave a toujours exactement un owner ; transférer
la propriété n'est pas un besoin exprimé, hors scope).

Page `/invitations/[token]` (publique, pas de garde d'auth) :
- Token invalide/expiré/déjà utilisé → message clair, pas de détail technique.
- Utilisateur déjà connecté avec l'email correspondant à l'invitation → bouton
  "Rejoindre" direct.
- Utilisateur déjà connecté avec un autre email → message expliquant que
  l'invitation est pour une autre adresse, propose de se déconnecter.
- Utilisateur non connecté, email a déjà un compte → formulaire de connexion,
  puis rejoint automatiquement après authentification réussie.
- Utilisateur non connecté, email n'a pas de compte → si `registration_enabled`
  est vrai, formulaire de création de compte (email pré-rempli, verrouillé, +
  mot de passe) puis rejoint automatiquement ; si faux, message "les inscriptions
  sont actuellement fermées, contacte l'administrateur qui pourra créer ton
  compte" (le super-admin peut toujours créer un compte "à la main" — hors
  scope de ce plan, non nécessaire : il peut ajouter directement un membership
  en base au pire cas, ou on pourra ajouter cette action au dashboard plus tard
  si le besoin se présente réellement).

Acceptation : crée le `cellarMembership` (cellarId, userId, role de
l'invitation), marque l'invitation `accepted`.

## 5. Réinitialisation de mot de passe

Depuis la fiche utilisateur du dashboard (`/admin/utilisateurs/[id]`), bouton
"Générer un lien de réinitialisation" → `POST
/api/admin/users/[id]/reset-token` crée la ligne `password_reset_tokens`,
affiche le lien à copier (même pattern que l'invitation). Page
`/reset-password/[token]` (publique) : token invalide/expiré/déjà utilisé →
message clair ; sinon formulaire nouveau mot de passe → met à jour
`passwordHash`, marque le token `usedAt`.

## 6. Inscription et désactivation de compte

**Inscription** : aucune page publique d'inscription. Un compte ne se crée
qu'en acceptant une invitation, et seulement si `registration_enabled` est
vrai à ce moment-là (le réglage est vérifié à l'acceptation, pas à la création
de l'invitation — une invitation créée avant la fermeture des inscriptions
reste utilisable pour un email ayant déjà un compte, mais ne peut plus servir
à en créer un nouveau).

**Désactivation** : `users.isActive` passé à `false` depuis
`/admin/utilisateurs`. Vérifié dans `requireUser()` et `requireApiUser()` à
chaque requête (pas seulement à la connexion) : un compte désactivé est
déconnecté dès sa prochaine requête, pas seulement bloqué à la prochaine
tentative de connexion. Réversible (réactivation), memberships et historique
intacts.

## 7. Dashboard super-admin

Nouvelle section `src/app/(app)/admin/**`, garde dédiée `requireSuperAdmin()`
(construite sur `requireUser()` + vérification `isSuperAdmin`, redirige vers
`/cave` si non super-admin — pas de lien vers `/admin` dans la nav pour les
autres utilisateurs). Quatre pages :

- **`/admin/utilisateurs`** — liste des comptes (email, super-admin ou non,
  actif ou non), actions : activer/désactiver, générer un lien de reset,
  promouvoir/rétrograder super-admin.
- **`/admin/caves`** — liste de toutes les caves tous utilisateurs confondus
  (nom, owner, nombre de membres), formulaire de création (nom + choix du
  owner parmi les comptes existants — seul point d'entrée pour créer une
  cave), lien vers chaque cave en accès direct (le super-admin y accède comme
  n'importe quel `role: super_admin` via `checkCellarAccess`, sans
  membership).
- **`/admin/reglages`** — toggle `registration_enabled`.
- **Supervision technique** — intégrée en haut de `/admin/caves` : taille du
  fichier SQLite (`fs.statSync`), date de dernière sauvegarde (si un mécanisme
  de sauvegarde existe déjà — sinon "aucune sauvegarde configurée"), statut de
  la clé API Anthropic (`ANTHROPIC_API_KEY` présente en variable
  d'environnement ou non — jamais affichée en clair). Pas de logs d'erreurs
  serveur dans ce plan : `docker compose logs start` reste le moyen de les
  consulter ; les intégrer proprement demanderait un vrai système de logs
  (fichier tournant ou table dédiée), hors de proportion pour un usage perso.

## Hors scope (ce plan)

- Envoi d'email réel (invitations et resets sont des liens à partager
  manuellement).
- Page d'inscription publique indépendante des invitations.
- Logs d'erreurs serveur dans le dashboard.
- Création de compte "à la main" par le super-admin sans passer par une
  invitation (si le besoin apparaît, ajout simple à un plan ultérieur).
- Retrait d'un membre d'une cave depuis le dashboard admin (reste géré depuis
  les réglages de la cave elle-même, par le owner).
