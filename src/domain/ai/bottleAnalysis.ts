import { eq } from 'drizzle-orm';
import { bottles } from '../../db/schema';
import type { AiMessageContent } from './client';
import { buildAiAnalysisPatch } from './analysisPatch';
import { WINE_REGIONS } from '../wineGeography';
import type { BottleAnalysisInput } from './interfaces/bottle-analysis-input.interface';
import type { BottleForAiSave } from './interfaces/bottle-for-ai-save.interface';
import type { BuildBottleAnalysisPromptArgs } from './interfaces/build-bottle-analysis-prompt-args.interface';
import type { SaveBottleAiAnalysisArgs } from './interfaces/save-bottle-ai-analysis-args.interface';

export type { BottleAnalysisInput, BottleForAiSave };

/**
 * Consigne de prix, jointe au prompt seulement quand la recherche web est
 * de la partie. Tout y tient en une règle : le prix vient des sources
 * trouvées, ou il n'y a pas de prix. Le modèle « connaît » des ordres de
 * grandeur de mémoire, et c'est précisément ce qu'on refuse ici — une
 * estimation inventée est indiscernable d'une estimation recoupée une fois
 * affichée sur la fiche.
 */
const PRICE_ESTIMATE_INSTRUCTIONS = `"priceEstimate" est une estimation du prix de cette bouteille, ou \`null\`. Sa forme :
{
  "lowEur": 24.5,
  "highEur": 31,
  "note": "string | null — ce que la fourchette couvre (format, millésime réellement trouvé, marché)",
  "sources": [{ "label": "string — nom du site", "url": "string — URL consultée" }]
}

Règles, dans cet ordre de priorité :
1. Utilise l'outil de recherche web pour trouver des prix réels (cavistes en ligne, places de marché du vin, cotes de référence). N'utilise jamais un prix que tu crois connaître de mémoire.
2. Il faut au moins deux sources distinctes que tu as réellement consultées pendant cette recherche, et tu reportes leur URL exacte. Une seule source, ou une URL reconstruite de tête : renvoie \`null\`.
3. Si tu ne trouves pas de prix pour cette bouteille, renvoie \`null\` — c'est une réponse attendue, pas un échec. Ne remplace jamais un prix introuvable par une approximation, une moyenne de la catégorie ou le prix d'un autre millésime sans le dire.
4. Prix TTC en euros, **à l'achat chez un marchand** : caviste, boutique en ligne, place de marché, ou cote de référence. Une bouteille au format standard, sur le marché français quand il existe.
5. N'utilise JAMAIS un prix de carte de restaurant, de bar, de bistrot ou de prix au verre : ils portent la marge de l'établissement et valent deux à trois fois le prix d'achat. Si les seules sources trouvées sont de ce type, renvoie \`null\`.
6. Si les prix trouvés portent sur un autre millésime ou un autre format, dis-le dans "note".
7. La fourchette reflète la dispersion réellement constatée entre les sources, pas une marge de confort ajoutée après coup.

`;

export const buildBottleAnalysisPrompt = ({
  bottle,
  currentYear,
  withPriceEstimate = false,
}: BuildBottleAnalysisPromptArgs): { system: string; content: AiMessageContent } => {
  const system =
    'Tu es un sommelier expert. Tu réponds uniquement avec un objet JSON valide, sans texte avant ni après, correspondant exactement au schéma demandé.';
  const priceEstimateField = withPriceEstimate ? ',\n  "priceEstimate": { ... } | null' : '';
  const content = `Analyse cette bouteille et réponds avec un objet JSON de cette forme exacte :
{
  "analysis": "string — 2 à 4 phrases d'analyse du profil du vin",
  "pairings": ["string", "..."],
  "tastingAdvice": "string — conseils de service (température, carafage, verre...)",
  "drinkFromYear": 2027,
  "drinkUntilYear": 2032,
  "region": "string | null",
  "subRegion": "string | null",
  "grapeVarieties": ["string", "..."] ,
  "appellation": "string | null"${priceEstimateField}
}

"pairings" contient 3 à 5 suggestions d'accords mets-vin. "drinkFromYear" et "drinkUntilYear" sont des entiers (années) : donne toujours une estimation best-effort dès que tu connais le millésime et que la catégorie a une notion de garde (vin, effervescent, cidre...), même si la fenêtre est déjà passée — dans ce cas, propose une fenêtre déjà entamée ou terminée plutôt que d'abandonner, et signale l'incertitude dans "analysis" ou "tastingAdvice" si pertinent (certaines bouteilles anciennes sont gardées comme vin de collection sans objectif immédiat de consommation, d'autres sont probablement passées leur optimum : les deux sont possibles, tu ne peux pas savoir laquelle s'applique). Réserve "null" (pour la garde) aux cas où il n'y a vraiment aucun ancrage possible : pas de millésime connu, ou une catégorie sans notion de garde (par exemple la bière).

La géographie se remplit sur trois niveaux distincts, du plus large au plus précis — ne mets pas la même valeur dans deux d'entre eux :
- "region" : la grande région viticole, choisie dans cette liste quand le vin est français : ${WINE_REGIONS.join(', ')}. Pour un vin étranger, donne la région du pays (ex. "Toscane", "Rioja").
- "subRegion" : la sous-région, entre la région et l'appellation (ex. "Haut-Médoc", "Côte de Nuits", "Rhône septentrional", "Touraine"). null si la région n'a pas de découpage pertinent ou si tu n'en es pas sûr.
- "appellation" : l'AOC/AOP exacte de l'étiquette (ex. "Saint-Julien", "Gevrey-Chambertin", "Châteauneuf-du-Pape").

Exemple : un Château Gruaud-Larose donne "region": "Bordeaux", "subRegion": "Haut-Médoc", "appellation": "Saint-Julien" — surtout pas "region": "Haut-Médoc". Déduis ces trois champs du nom, du producteur et de tes connaissances œnologiques, même si la "Région" indiquée ci-dessous est déjà "inconnue" ; laisse null seulement si tu n'as vraiment aucun indice.

"grapeVarieties" (uniquement pertinent pour "wine" et "sparkling", sinon tableau vide) et "appellation" (uniquement pertinent pour "wine", sinon null) sont tes meilleures estimations à partir du nom, du producteur, de la région et de tes connaissances œnologiques — comme pour "region", ne laisse vide/null que si tu n'as vraiment aucun indice. Si les cépages ou l'appellation sont déjà connus (voir ci-dessous), ne les invente pas différemment : confirme-les ou complète les cépages manquants sans contredire ceux déjà renseignés.

${withPriceEstimate ? PRICE_ESTIMATE_INSTRUCTIONS : ''}Bouteille :
- Nom : ${bottle.name}
- Producteur : ${bottle.producer ?? 'inconnu'}
- Millésime : ${bottle.vintage ?? 'inconnu'}
- Catégorie : ${bottle.category}
- Région : ${bottle.region ?? 'inconnue'}
- Sous-région : ${bottle.subRegion ?? 'inconnue'}
- Couleur : ${bottle.color ?? 'inconnue'}
- Cépages connus : ${bottle.grapeVarieties.length > 0 ? bottle.grapeVarieties.join(', ') : 'inconnus'}
- Appellation connue : ${bottle.appellation ?? 'inconnue'}
- Année actuelle : ${currentYear}`;
  return { system, content };
};

/**
 * `aiAnalysis`/`aiPairings`/`aiTastingAdvice`/`aiGeneratedAt` sont toujours
 * écrasés, y compris à la régénération. `drinkFrom`/`drinkUntil`/`region`/
 * `grapeVarieties`/`appellation` ne sont écrits que si la bouteille n'a
 * actuellement pas de valeur — une fenêtre de garde, une région, des
 * cépages ou une appellation déjà renseignés (manuellement, par une photo,
 * ou par une génération précédente) ne sont jamais écrasés (voir le spec
 * IA, section Chantier A).
 *
 * `aiPriceEstimate` suit les champs `ai*` : toujours réécrit, y compris à
 * `null`. Un prix est daté par `aiGeneratedAt` — garder celui d'une
 * génération précédente à côté d'une analyse fraîche le ferait passer pour
 * un relevé du jour, et une régénération qui ne retrouve pas de source dit
 * quelque chose, justement : ce prix-là n'est plus vérifiable.
 *
 * C'est le seul champ que la wishlist ne partage pas (voir
 * `saveWishlistAiAnalysis`) : elle n'a pas la colonne, et ses générations
 * ne demandent pas de prix faute de recherche web.
 */
export const saveBottleAiAnalysis = async ({
  db,
  bottle,
  analysis,
}: SaveBottleAiAnalysisArgs): Promise<void> => {
  const patch = buildAiAnalysisPatch({ target: bottle, analysis });
  await db
    .update(bottles)
    .set({ ...patch, aiPriceEstimate: analysis.priceEstimate ?? null })
    .where(eq(bottles.id, bottle.id));
};
