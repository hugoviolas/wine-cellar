import { eq } from 'drizzle-orm';
import { bottles } from '../../db/schema';
import type { AiMessageContent } from './client';
import type { AiPriceEstimate } from './schemas';
import type { BottleAnalysisInput } from './interfaces/bottle-analysis-input.interface';
import type { BuildBottlePricePromptArgs } from './interfaces/build-bottle-price-prompt-args.interface';
import type { SaveBottlePriceEstimateArgs } from './interfaces/save-bottle-price-estimate-args.interface';

export type { BottleAnalysisInput };

/**
 * Estimation de prix : un appel à part, et pas un champ de plus dans
 * l'analyse.
 *
 * Les deux générations n'ont pas du tout le même coût en temps. L'analyse
 * se rédige de mémoire et rend la main en quelques secondes ; le prix
 * exige une recherche web, donc des requêtes et des lectures de pages en
 * série. Les avoir fusionnés faisait attendre l'analyse — déjà prête —
 * derrière la recherche, devant un bouton qui tourne. Séparés, la fiche
 * s'affiche tout de suite et le prix la rejoint quand il est trouvé.
 *
 * Tout y tient en une règle : le prix vient des sources trouvées, ou il
 * n'y a pas de prix. Le modèle « connaît » des ordres de grandeur de
 * mémoire, et c'est précisément ce qu'on refuse — une estimation inventée
 * est indiscernable d'une estimation recoupée une fois affichée.
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

export const buildBottlePricePrompt = ({
  bottle,
}: BuildBottlePricePromptArgs): { system: string; content: AiMessageContent } => {
  const system =
    'Tu es un sommelier expert. Tu réponds uniquement avec un objet JSON valide, sans texte avant ni après, correspondant exactement au schéma demandé.';
  const content = `Estime le prix de cette bouteille et réponds avec un objet JSON de cette forme exacte :
{
  "priceEstimate": { ... } | null
}

${PRICE_ESTIMATE_INSTRUCTIONS}Bouteille :
- Nom : ${bottle.name}
- Producteur : ${bottle.producer ?? 'inconnu'}
- Millésime : ${bottle.vintage ?? 'inconnu'}
- Catégorie : ${bottle.category}
- Région : ${bottle.region ?? 'inconnue'}
- Sous-région : ${bottle.subRegion ?? 'inconnue'}
- Appellation : ${bottle.appellation ?? 'inconnue'}`;
  return { system, content };
};

/**
 * Écrit l'estimation, ou l'efface si la recherche n'a rien donné : une
 * recherche qui ne retrouve plus de source dit quelque chose, justement —
 * ce prix-là n'est plus vérifiable.
 *
 * `asOf` est posé ici et non par le modèle. C'est la date du relevé, et
 * elle ne peut plus être empruntée à `aiGeneratedAt` depuis que les deux
 * générations sont indépendantes.
 */
export const saveBottlePriceEstimate = async ({
  db,
  bottleId,
  estimate,
  now = new Date(),
}: SaveBottlePriceEstimateArgs): Promise<void> => {
  const stored: AiPriceEstimate | null = estimate ? { ...estimate, asOf: now.toISOString() } : null;
  await db.update(bottles).set({ aiPriceEstimate: stored }).where(eq(bottles.id, bottleId));
};
