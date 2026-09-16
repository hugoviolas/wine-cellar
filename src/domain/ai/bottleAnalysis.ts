import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { bottles } from '../../db/schema';
import type { AiMessageContent } from './client';
import { buildAiAnalysisPatch } from './analysisPatch';
import type { AiBottleAnalysis } from './schemas';
import type { BottleAnalysisInput } from './interfaces/bottle-analysis-input.interface';
import type { BottleForAiSave } from './interfaces/bottle-for-ai-save.interface';

export type { BottleAnalysisInput, BottleForAiSave };

export const buildBottleAnalysisPrompt = (
  bottle: BottleAnalysisInput,
  currentYear: number,
): { system: string; content: AiMessageContent } => {
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
};

/**
 * `aiAnalysis`/`aiPairings`/`aiTastingAdvice`/`aiGeneratedAt` sont toujours
 * écrasés, y compris à la régénération. `drinkFrom`/`drinkUntil`/`region`/
 * `grapeVarieties`/`appellation` ne sont écrits que si la bouteille n'a
 * actuellement pas de valeur — une fenêtre de garde, une région, des
 * cépages ou une appellation déjà renseignés (manuellement, par une photo,
 * ou par une génération précédente) ne sont jamais écrasés (voir le spec
 * IA, section Chantier A).
 */
export const saveBottleAiAnalysis = async (
  db: Db,
  bottle: BottleForAiSave,
  analysis: AiBottleAnalysis,
): Promise<void> => {
  const patch = buildAiAnalysisPatch(bottle, analysis);
  await db.update(bottles).set(patch).where(eq(bottles.id, bottle.id));
};
