# Cave à Vin — Design

Date : 2026-09-06
Statut : validé en brainstorming, en attente de revue finale avant plan d'implémentation.

## 1. Vue d'ensemble

Application web responsive (mobile + desktop) de gestion d'une cave à vin personnelle,
hébergée initialement sur un Raspberry Pi 4 sur le réseau local, puis exposée plus tard
via un tunnel Cloudflare. Interface entièrement en français.

Fonctions principales :
- Organiser virtuellement les clayettes (casiers) et les bouteilles qu'elles contiennent.
- Ajouter/retirer des bouteilles, avec recherche texte assistée par IA.
- Consulter une fiche par bouteille : analyse, accords mets-vins, conseils de dégustation,
  fenêtre de garde/apogée.
- Gérer plusieurs types d'alcool (vin, champagne/effervescent, cidre, bière, spiritueux)
  avec des champs adaptés à chaque catégorie.
- Historique de consommation avec note personnelle, commentaire et occasion.
- Comptes multi-utilisateurs, caves partageables avec rôles, et un rôle super-admin global.

## 2. Stack technique

- **Next.js (App Router, TypeScript)** — front et API dans un seul projet, déployé comme
  un unique conteneur Docker.
- **SQLite** en fichier unique, via **Drizzle ORM** (migrations versionnées). Sauvegarde =
  copie horodatée du fichier `.db`.
- **Tailwind CSS**, direction visuelle "éditorial vert sauge" (fond crème, typo serif
  italique pour les titres, accents vert sauge et or — voir section 8).
- **PWA** installable sur mobile et desktop.
- **API Claude (Anthropic)** appelée côté serveur uniquement, clé API en variable
  d'environnement (jamais en base, jamais exposée au client).
- Pas de service séparé, pas de queue/worker : un seul processus Next.js suffit à cette
  échelle (quelques utilisateurs, cave de départ < 50 bouteilles, conçue pour rester
  simple plutôt que pour un scale hypothétique).

## 3. Modèle de données

Tables SQLite (Drizzle) :

- **`users`** — id, email, password_hash, is_super_admin, created_at.
- **`cellars`** (caves) — id, name, owner_id, ai_enabled (bool, activé par défaut à la
  création d'une cave, désactivable par le owner), created_at.
- **`cellar_memberships`** — cellar_id, user_id, role (`owner` / `editor` / `reader`).
- **`invitations`** — cellar_id, email, role, token, status (`pending` / `accepted` /
  `expired`), created_at, expires_at.
- **`crates`** (clayettes) — id, cellar_id, name, capacity, sort_order.
- **`bottles`** — id, crate_id, category (`wine` / `sparkling` / `cider` / `beer` /
  `spirit`), name, producer, vintage (nullable, non-millésimé possible), region, color,
  abv, volume_ml, quantity, drink_from (année), drink_until (année), `details` (JSON,
  schéma de validation différent par catégorie — voir section 6), ai_analysis,
  ai_pairings (JSON), ai_tasting_advice, ai_generated_at, user_note, created_at.
- **`consumption_history`** — id, bottle_id (FK), cellar_id, consumed_by_user_id,
  consumed_at, rating, comment, occasion, + instantané des champs clés de la bouteille
  (nom, producteur, millésime, catégorie) copié au moment de la consommation pour rester
  lisible même si la ligne bouteille est un jour supprimée.
- **`referentials`** — table de référence (régions, appellations, cépages) importée une
  fois depuis Wikidata et le dataset Kaggle wine reviews, utilisée uniquement pour
  l'autocomplétion. Jamais modifiée en écriture par l'application elle-même.
- **`app_settings`** — une ligne unique : `registration_enabled` (bool). Le statut de la
  clé API Anthropic (présente/valide) est dérivé de la configuration serveur, pas stocké.

Règles :
- Sortir une bouteille décrémente `quantity` et crée une ligne dans
  `consumption_history`. À `quantity = 0`, la ligne disparaît de la vue clayette mais
  reste consultable via l'historique (elle n'est pas supprimée, pour conserver l'analyse
  IA déjà générée en cas de réapprovisionnement futur).
- `ai_enabled` est un réglage **par cave**, pas global. Le owner d'une cave peut
  l'activer/désactiver dans les réglages de sa cave ; le super-admin peut le faire pour
  n'importe quelle cave via sa vue transverse.

## 4. Authentification et partage

- Comptes email + mot de passe (hashé), session cookie longue durée.
- Une cave a un owner et peut avoir des membres avec un rôle `editor` ou `reader`,
  invités par email depuis les réglages de la cave. Un invité sans compte en crée un à
  l'acceptation de l'invitation, puis rejoint automatiquement la cave.
- Un utilisateur peut posséder plusieurs caves et être membre de caves d'autres
  utilisateurs, mais **seul le super-admin crée une nouvelle cave** (il en désigne le
  owner à la création). Un compte simple ne peut pas créer de cave lui-même — il ne
  peut que gérer/partager les caves dont il est déjà owner ou éditeur.
- Un booléen `is_super_admin` sur `users` donne accès complet à toutes les caves du
  système et au dashboard admin (section 7), indépendamment des memberships classiques.

## 5. Flux principaux

- **Ajout d'une bouteille** : recherche texte (autocomplétion sur `referentials` + tes
  bouteilles déjà connues) → choix d'une clayette et d'une quantité → bouton optionnel
  « Générer l'analyse IA » (visible seulement si la cave a `ai_enabled` et qu'une clé API
  est configurée) qui remplit analyse/accords/dégustation/fenêtre de garde depuis un
  seul appel Claude, éditable ensuite.
- **Vue cave** : clayettes empilées (mobile) ou en grille (desktop), recherche/filtre par
  nom, catégorie, couleur, statut de garde.
- **Fiche bouteille** : badge de statut de garde (trop jeune / à boire maintenant / en
  fin de fenêtre), jauge visuelle de la période de garde, sections analyse/accords/
  dégustation (masquées si l'IA est désactivée pour la cave, sans message — juste
  absentes), et une note personnelle toujours éditable qui prime sur le texte généré.
- **Sortir une bouteille** : bouton « Consommer » → formulaire rapide (date pré-remplie,
  note, commentaire, occasion) → décrémente la quantité, crée l'entrée d'historique.
- **Onglet Historique** : liste chronologique des bouteilles consommées dans la cave,
  filtrable et triable par note et date.
- **Partage d'une cave** : le owner invite par email + rôle depuis les réglages de la
  cave.

## 6. Catégories d'alcool et champs adaptés

Une seule table `bottles` avec un socle commun (nom, producteur, millésime, région,
couleur, degré, contenance, quantité, fenêtre de garde) et une colonne `details` en JSON,
dont le schéma de validation dépend de `category` :

- **Vin** (`wine`) : cépages, appellation, classification.
- **Champagne/effervescent** (`sparkling`) : dosage, méthode, date de dégorgement,
  cépages.
- **Cidre** (`cider`) : variétés de pommes, méthode (bouché/fermier), doux/brut.
- **Bière** (`beer`) : style, IBU, EBC, fermentation.
- **Spiritueux** (`spirit`) : type, fût, âge, région/origine.

Ajouter une nouvelle catégorie est une petite modification de code (nouveau schéma de
validation + champs de formulaire dédiés), pas une migration de schéma de base.

## 7. Dashboard super-admin

Accessible uniquement si `is_super_admin`, lien absent du reste de l'UI pour les autres
utilisateurs.

- **Utilisateurs** : liste des comptes, désactivation, réinitialisation de mot de passe,
  attribution/retrait du rôle super-admin.
- **Caves (vue transverse)** : liste de toutes les caves tous utilisateurs confondus,
  création d'une nouvelle cave avec désignation de son owner (seul point d'entrée pour
  créer une cave), et accès direct en lecture/écriture à n'importe laquelle sans en être
  membre — y compris pour activer/désactiver `ai_enabled` sur une cave.
- **Réglages globaux** : `registration_enabled` (autoriser ou non la création de
  nouveaux comptes), autres interrupteurs globaux à venir.
- **Supervision technique** : taille du fichier SQLite et date de dernière sauvegarde,
  statut de la clé API Anthropic (présente/valide, jamais affichée en clair), dernières
  erreurs serveur lues depuis les logs applicatifs (pas de table de logs dédiée — hors
  de proportion pour ce volume).

## 8. Direction visuelle

Style "éditorial vert sauge", validé via mockups :
- Fond crème (#f4f1ea), texte principal vert forêt foncé (#20342b).
- Typographie serif (Georgia) en italique pour les titres, sans-serif (Helvetica Neue)
  pour le contenu utilitaire (badges, métadonnées, formulaires).
- Accents vert sauge (#6f8f6a) et or (#c9a646/#d4af37) pour les indicateurs d'état et
  éléments interactifs.
- Vue cave : clayettes en cartes blanches sur fond crème, empilées en mobile, en grille
  sur desktop. Bouton d'ajout flottant en mobile, barre d'actions en desktop.
- Fiche bouteille : badge de statut de garde, jauge de progression de la fenêtre de
  garde, sections d'analyse en italique serif, tags d'accords mets-vins en pastilles.

## 9. Intégration IA et données de référence

- **Import initial** (script one-shot, pas un service permanent) : télécharge et importe
  dans `referentials` les régions/appellations/cépages depuis Wikidata (SPARQL), enrichi
  par le dataset Kaggle wine reviews. Exécuté une fois au déploiement, ré-exécutable pour
  rafraîchir les données.
- **Génération à la demande** : un appel à l'API Claude par bouteille (nom, producteur,
  millésime, catégorie, région, contexte du référentiel local si trouvé) retourne un
  JSON structuré (analyse, 3 à 5 accords, conseils de dégustation, fenêtre de garde
  estimée). Stocké tel quel, jamais régénéré automatiquement — un bouton « Régénérer »
  permet de relancer l'appel.
- **Coupe-circuit par cave** : si `ai_enabled` est faux pour la cave, ou si la clé API
  est absente/invalide, le bouton et les sections IA disparaissent simplement de
  l'interface, sans message. Le reste de l'app (ajout manuel, clayettes, historique)
  continue de fonctionner normalement.
- **Hors scope V1** : scan de code-barres / Open Food Facts. Noté comme extension
  possible, mais pas nécessaire pour la première version puisque le flux d'ajout retenu
  est recherche texte + IA.

## 10. Déploiement

- **Docker Compose** sur le Pi 4 : un conteneur Next.js + un volume monté pour le fichier
  SQLite.
- **Build croisé** : image ARM64 buildée sur le Mac de l'utilisateur
  (`docker buildx build --platform linux/arm64`), transférée sur le Pi (registry perso ou
  `docker save` / `scp` / `docker load`), lancée via `docker compose up -d`.
- **Réseau local d'abord** : app exposée sur le LAN via l'IP du Pi, pas de HTTPS
  nécessaire à ce stade.
- **Tunnel Cloudflare plus tard** : conteneur `cloudflared` ajouté au compose quand
  l'utilisateur sera prêt, pointant vers le service Next.js. Pas de nom de domaine câblé
  pour l'instant — la procédure générique sera documentée pour brancher un domaine plus
  tard.

## 11. Tests et robustesse

- **Tests unitaires** sur la logique métier sensible : calcul du statut de garde (trop
  jeune / à boire / en fin de fenêtre), décrément de quantité + création d'historique,
  résolution des rôles/permissions (owner/éditeur/lecteur/super-admin).
- **Tests d'intégration** sur les routes API critiques : ajout/consommation de bouteille,
  invitation et acceptation, bascule du coupe-circuit IA par cave.
- **Pas de tests end-to-end navigateur** en V1 — vérification manuelle des parcours clés
  (ajout, consommation, partage) une fois l'app lancée sur le réseau local.
- **Sauvegardes** : le fichier SQLite étant la seule source de vérité, une commande de
  sauvegarde simple (copie horodatée, éventuellement via cron sur le Pi) sera
  documentée.

## Hors scope (V1)

- Scan de code-barres / Open Food Facts.
- Prix d'achat, valeur de la cave, statistiques financières.
- Photos des bouteilles.
- Lien de partage public en lecture seule sans compte.
- Multilingue (interface français uniquement pour l'instant).
