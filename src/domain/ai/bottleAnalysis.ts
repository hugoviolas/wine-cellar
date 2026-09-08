import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { bottles } from '../../db/schema';
import { parseBottleDetails, type BottleCategory } from '../bottleCategories';
import type { AiMessageContent } from './client';
import type { AiBottleAnalysis } from './schemas';

export interface BottleAnalysisInput {
  name: string;
  producer: string | null;
  vintage: number | null;
  category: string;
  region: string | null;
  color: string | null;
  grapeVarieties: string[];
  appellation: string | null;
}

export function buildBottleAnalysisPrompt(
  bottle: BottleAnalysisInput,
  currentYear: number,
): { system: string; content: AiMessageContent } {
  const system =
    'Tu es un sommelier expert. Tu réponds uniquement avec un objet JSON valide, sans texte avant ni après, correspondant exactement au schéma demandé.';
  const content = `Analyse cette bouteille et réponds avec un objet JSON de cette forme exacte :
{
  "analysis": "string — 2 à 4 phrases d'analyse du profil du vin",
  "pairings": ["string", "..."],
  "tastingAdvice": "string — conseils de service (température, carafage, verre...)",
  "drinkFromYear": 2027,
  "drinkUntilYear": 2032,
  "region": "string | null",
  "grapeVarieties": ["string", "..."] ,
  "appellation": "string | null"
}

"pairings" contient 3 à 5 suggestions d'accords mets-vin. "drinkFromYear" et "drinkUntilYear" sont des entiers (années) : donne toujours une estimation best-effort dès que tu connais le millésime et que la catégorie a une notion de garde (vin, effervescent, cidre...), même si la fenêtre est déjà passée — dans ce cas, propose une fenêtre déjà entamée ou terminée plutôt que d'abandonner, et signale l'incertitude dans "analysis" ou "tastingAdvice" si pertinent (certaines bouteilles anciennes sont gardées comme vin de collection sans objectif immédiat de consommation, d'autres sont probablement passées leur optimum : les deux sont possibles, tu ne peux pas savoir laquelle s'applique). Réserve "null" (pour la garde) aux cas où il n'y a vraiment aucun ancrage possible : pas de millésime connu, ou une catégorie sans notion de garde (par exemple la bière).

"region" est ta meilleure estimation de la région ou appellation viticole, déduite du nom, du producteur et de tes connaissances œnologiques (même si la "Région" indiquée ci-dessous est déjà "inconnue") — laisse null seulement si tu n'as vraiment aucun indice permettant de la déduire.

"grapeVarieties" (uniquement pertinent pour "wine" et "sparkling", sinon tableau vide) et "appellation" (uniquement pertinent pour "wine", sinon null) sont tes meilleures estimations à partir du nom, du producteur, de la région et de tes connaissances œnologiques — comme pour "region", ne laisse vide/null que si tu n'as vraiment aucun indice. Si les cépages ou l'appellation sont déjà connus (voir ci-dessous), ne les invente pas différemment : confirme-les ou complète les cépages manquants sans contredire ceux déjà renseignés.

Bouteille :
- Nom : ${bottle.name}
- Producteur : ${bottle.producer ?? 'inconnu'}
- Millésime : ${bottle.vintage ?? 'inconnu'}
- Catégorie : ${bottle.category}
- Région : ${bottle.region ?? 'inconnue'}
- Couleur : ${bottle.color ?? 'inconnue'}
- Cépages connus : ${bottle.grapeVarieties.length > 0 ? bottle.grapeVarieties.join(', ') : 'inconnus'}
- Appellation connue : ${bottle.appellation ?? 'inconnue'}
- Année actuelle : ${currentYear}`;
  return { system, content };
}

export interface BottleForAiSave {
  id: string;
  category: BottleCategory;
  drinkFrom: number | null;
  drinkUntil: number | null;
  region: string | null;
  details: unknown;
}

/**
 * `aiAnalysis`/`aiPairings`/`aiTastingAdvice`/`aiGeneratedAt` sont toujours
 * écrasés, y compris à la régénération. `drinkFrom`/`drinkUntil`/`region`/
 * `grapeVarieties`/`appellation` ne sont écrits que si la bouteille n'a
 * actuellement pas de valeur — une fenêtre de garde, une région, des
 * cépages ou une appellation déjà renseignés (manuellement, par une photo,
 * ou par une génération précédente) ne sont jamais écrasés (voir le spec
 * IA, section Chantier A).
 */
export async function saveBottleAiAnalysis(
  db: Db,
  bottle: BottleForAiSave,
  analysis: AiBottleAnalysis,
): Promise<void> {
  const set: {
    aiAnalysis: string;
    aiPairings: string[];
    aiTastingAdvice: string;
    aiGeneratedAt: string;
    drinkFrom?: number;
    drinkUntil?: number;
    region?: string;
    details?: unknown;
  } = {
    aiAnalysis: analysis.analysis,
    aiPairings: analysis.pairings,
    aiTastingAdvice: analysis.tastingAdvice,
    aiGeneratedAt: new Date().toISOString(),
  };
  if (bottle.drinkFrom === null && analysis.drinkFromYear !== null) set.drinkFrom = analysis.drinkFromYear;
  if (bottle.drinkUntil === null && analysis.drinkUntilYear !== null) set.drinkUntil = analysis.drinkUntilYear;
  if (bottle.region === null && analysis.region !== null) set.region = analysis.region;

  if (bottle.category === 'wine' || bottle.category === 'sparkling') {
    let details = parseBottleDetails(bottle.category, bottle.details);
    let detailsChanged = false;
    if (details.grapeVarieties.length === 0 && analysis.grapeVarieties && analysis.grapeVarieties.length > 0) {
      details = { ...details, grapeVarieties: analysis.grapeVarieties };
      detailsChanged = true;
    }
    if (bottle.category === 'wine') {
      const wineDetails = details as ReturnType<typeof parseBottleDetails<'wine'>>;
      if (!wineDetails.appellation && analysis.appellation) {
        details = { ...wineDetails, appellation: analysis.appellation };
        detailsChanged = true;
      }
    }
    if (detailsChanged) set.details = details;
  }

  await db.update(bottles).set(set).where(eq(bottles.id, bottle.id));
}
