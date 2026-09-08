# Intégration IA — Design

Date : 2026-09-08
Statut : validé en brainstorming, en attente de revue finale avant plan d'implémentation.

## 1. Vue d'ensemble

Ce plan construit le chantier IA identifié depuis le début du projet (section 9
du spec original, docs/superpowers/specs/2026-09-06-cave-a-vin-design.md),
avec une révision de scope validée en brainstorming et une extension non
prévue au départ :

- **Révision** : le pipeline d'import de référentiels (Wikidata + dataset
  Kaggle) prévu au spec original comme enrichissement de contexte est
  abandonné. Claude a une connaissance large et à jour des vins, régions et
  appellations sans dataset local — l'enrichissement n'apporte pas assez
  pour justifier un pipeline de données à maintenir. Les colonnes existantes
  (`aiAnalysis`, `aiPairings`, `aiTastingAdvice`, `aiGeneratedAt` sur
  `bottles`, `aiEnabled` sur `cellars`) restent inchangées et suffisent.
- **Chantier A** : fiche IA à la demande par bouteille (analyse, accords,
  conseils de dégustation, estimation de fenêtre de garde) — c'est le cœur
  du spec original, jusqu'ici non implémenté malgré le schéma déjà prêt.
- **Chantier B** : ajout de bouteille par photo — nouvelle idée, pas prévue
  au spec original (qui excluait explicitement le scan de code-barres /
  Open Food Facts, mais ne mentionnait pas l'extraction par photo). Utilise
  la vision de Claude pour pré-remplir le formulaire d'ajout depuis une
  photo d'étiquette.

Les deux chantiers partagent une même base technique et un même coupe-circuit.

## 2. Approche technique commune

- **SDK officiel `@anthropic-ai/sdk`** (nouvelle dépendance) plutôt que des
  appels `fetch` bruts vers l'API Claude — gère l'authentification, les
  erreurs et le typage des réponses proprement.
- **Un seul modèle** pour le texte et la vision : `claude-sonnet-5`, capable
  des deux (pas de modèle séparé pour l'extraction photo).
- **Sortie structurée par prompt + validation Zod** : le prompt décrit le
  schéma JSON attendu ; la réponse texte de Claude est parsée (`JSON.parse`)
  puis validée avec un schéma Zod avant tout usage. Une réponse qui ne
  correspond pas au schéma est traitée comme une erreur (pas de tentative de
  réparation automatique ni de nouvel essai en V1 — l'utilisateur relance
  manuellement s'il le faut, via le bouton "Régénérer" ou en reprenant une
  photo).
- **Coupe-circuit unique et partagé** : une fonction domaine
  `isAiAvailable(cellar)` = `cellar.aiEnabled === true` ET la variable
  d'environnement `ANTHROPIC_API_KEY` est présente et non vide. Utilisée à
  l'identique par les chantiers A et B : si faux, le bouton ou la section
  correspondante ne s'affiche simplement pas côté UI, sans message
  d'erreur — cohérent avec le coupe-circuit déjà décrit au spec original.
  Les routes API des deux chantiers revérifient `isAiAvailable` côté
  serveur (jamais uniquement côté UI) avant tout appel à Claude.
- **Client Claude partagé** : un module `src/domain/ai/client.ts` construit
  une seule instance `Anthropic` (clé lue depuis `process.env.ANTHROPIC_API_KEY`
  à l'appel, pas au chargement du module — même précaution que
  `SESSION_SECRET`, pour ne pas faire échouer `next build` si la clé est
  absente au moment du build) et expose une fonction générique d'appel avec
  gestion d'erreur commune (réseau, JSON invalide, réponse hors schéma).

## 3. Chantier A — Fiche IA à la demande

**Déclenchement** : bouton sur la fiche bouteille (`/bottles/[id]`), visible
seulement si `isAiAvailable(cellar)` est vrai pour la cave de la bouteille.
Le libellé du bouton dépend de l'état actuel : "Générer l'analyse IA" si
`aiGeneratedAt` est encore nul, "Régénérer l'analyse IA" sinon.

**Permission** : la génération modifie la bouteille (contenu de la cave),
donc gardée par `canEditCellarContent` — même règle que déplacer/éditer une
bouteille, pas ouverte aux lecteurs (contrairement à la note personnelle).

**Route** : `POST /api/bottles/[id]/ai-generate`, sans corps de requête (l'id
de la bouteille dans l'URL suffit). Gating : `requireApiUser` →
`resolveBottleAccess` → `canEditCellarContent(role)` → `isAiAvailable(cellar)`
(403 générique si un de ces contrôles échoue — la route ne fait pas
confiance à l'UI qui cache déjà le bouton).

**Prompt envoyé à Claude** : nom, producteur, millésime, catégorie et région
de la bouteille (tous les champs déjà connus, aucun champ supplémentaire à
saisir). Le prompt demande explicitement un objet JSON avec cette forme :

```json
{
  "analysis": "string — 2 à 4 phrases d'analyse du profil du vin",
  "pairings": ["string", "..."],
  "tastingAdvice": "string — conseils de service (température, carafage, verre...)",
  "drinkFromYear": 2027,
  "drinkUntilYear": 2032
}
```

`pairings` contient 3 à 5 suggestions d'accords mets-vin. `drinkFromYear` et
`drinkUntilYear` sont des entiers (années) ou `null` si Claude n'a pas assez
d'éléments pour estimer une fenêtre de garde (ex : bouteille sans millésime
ou catégorie sans notion de garde comme la bière).

**Schéma Zod de validation** (`src/domain/ai/schemas.ts`) :

```ts
export const aiBottleAnalysisSchema = z.object({
  analysis: z.string().min(1),
  pairings: z.array(z.string().min(1)).min(3).max(5),
  tastingAdvice: z.string().min(1),
  drinkFromYear: z.number().int().nullable(),
  drinkUntilYear: z.number().int().nullable(),
});
```

**Écriture en base** : `aiAnalysis`, `aiPairings` (le tableau JSON tel
quel), `aiTastingAdvice`, `aiGeneratedAt` (horodatage de l'appel) sont
toujours mis à jour, y compris lors d'une régénération. `drinkFrom` et
`drinkUntil` (colonnes existantes, déjà utilisées pour la fenêtre de garde
manuelle) sont écrits **seulement si actuellement `null`** — une valeur déjà
renseignée (à la création ou modifiée à la main via le formulaire d'édition
complet) n'est jamais écrasée, y compris par une régénération ultérieure.

**Affichage** : la fiche bouteille a déjà des blocs conditionnels pour
"Analyse" et "Conseils de dégustation" (`{bottle.aiAnalysis && <section>}`,
etc.), simplement invisibles aujourd'hui faute de contenu — aucun changement
nécessaire sur ces deux blocs au-delà du contenu qui apparaîtra une fois
généré. Un nouveau bloc "Accords mets-vin" est ajouté (rendu la liste
`aiPairings` en tags/pastilles, dans le même esprit que les badges déjà
utilisés ailleurs dans l'app) — ce bloc n'existe pas du tout aujourd'hui.
Le bouton Générer/Régénérer est placé au-dessus de ces sections, visible
uniquement si `isAiAvailable`.

## 4. Chantier B — Ajout de bouteille par photo

**Déclenchement** : sur `/cave/ajouter`, un bouton "Remplir depuis une
photo" au-dessus du formulaire existant, visible seulement si
`isAiAvailable(cellar)` pour la cave courante. Au clic, ouvre un sélecteur
de fichier (`<input type="file" accept="image/*" capture="environment">` —
`capture="environment"` donne un accès direct à l'appareil photo arrière sur
mobile ; sur desktop ou si la caméra n'est pas disponible, ouvre simplement
la sélection de fichier classique).

**Limite** : la photo choisie est limitée à 5 Mo côté client (vérification
avant envoi, message d'erreur clair si dépassée) — pas de redimensionnement
automatique en V1, une photo de smartphone moderne dépasse rarement cette
taille une fois compressée par le navigateur au moment de la sélection.

**Route** : `POST /api/bottles/extract-from-photo`, corps `{ cellarId,
imageBase64, mediaType }` (`mediaType` : le type MIME de l'image, ex.
`image/jpeg`). Gating : `requireApiUser` → `checkCellarAccess` sur
`cellarId` → `canEditCellarContent(role)` → `isAiAvailable(cellar)` — même
niveau de permission qu'ajouter une bouteille manuellement, puisque
l'extraction sert exactement ce flux.

**Prompt envoyé à Claude (vision)** : l'image en pièce jointe du message,
avec un prompt demandant l'extraction des informations visibles sur
l'étiquette, sous cette forme JSON :

```json
{
  "name": "string | null",
  "producer": "string | null",
  "vintage": 2018,
  "category": "wine",
  "color": "rouge",
  "region": "string | null"
}
```

`category` est une supposition parmi les 5 catégories existantes
(`wine`, `sparkling`, `cider`, `beer`, `spirit`) — Claude choisit celle qui
correspond le mieux à ce qu'il voit sur l'étiquette. `color` n'est pertinent
que si `category` vaut `wine` (valeurs : `rouge`, `blanc`, `rose`, `autre`,
ou `null` si indéterminable). Tous les champs sont nullable : Claude peut ne
pas tout détecter selon la qualité de la photo, mieux vaut laisser un champ
vide que d'inventer une valeur.

**Schéma Zod de validation** (même fichier `src/domain/ai/schemas.ts`) :

```ts
export const aiPhotoExtractionSchema = z.object({
  name: z.string().min(1).nullable(),
  producer: z.string().min(1).nullable(),
  vintage: z.number().int().nullable(),
  category: z.enum(['wine', 'sparkling', 'cider', 'beer', 'spirit']).nullable(),
  color: z.enum(['rouge', 'blanc', 'rose', 'autre']).nullable(),
  region: z.string().min(1).nullable(),
});
```

**Pas d'écriture en base à cette étape** — la route retourne le JSON validé
tel quel au client. Le formulaire `AddBottleForm` reçoit ces valeurs et
pré-remplit ses champs correspondants (nom, producteur, millésime,
catégorie, couleur — la région n'est aujourd'hui pas un champ du formulaire
d'ajout ; elle est ignorée côté pré-remplissage, pas de changement de scope
du formulaire pour ce chantier). L'utilisateur choisit toujours la clayette
et la quantité à la main (jamais extractibles d'une photo), vérifie et
corrige les champs pré-remplis si besoin, puis soumet normalement via le
`POST /api/bottles` déjà existant — aucun changement à cette route.

**La photo elle-même n'est jamais persistée** : ni sur disque, ni en base
de données, ni dans un état React qui survivrait à la réponse de
l'extraction. Une fois le formulaire pré-rempli, la photo est oubliée.

## 5. Hors scope (ce chantier)

- Import de référentiels externes (Wikidata, Kaggle) — décision de
  brainstorming, Claude s'appuie sur ses propres connaissances.
- Stockage et affichage de la photo de la bouteille sur sa fiche — décision
  de brainstorming, cohérente avec l'exclusion déjà actée au spec original
  ("Photos des bouteilles" listé en hors-scope V1).
- Scan de code-barres / Open Food Facts — déjà hors scope au spec original,
  non remis en cause ici.
- Nouvelle tentative automatique en cas de réponse Claude invalide ou
  d'erreur réseau — l'utilisateur relance manuellement (bouton Régénérer,
  ou reprendre une photo).
- Redimensionnement/compression automatique de la photo avant envoi — une
  limite stricte de taille suffit pour cette V1.
