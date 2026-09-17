import type { AiImageBlock, AiMessageContent, AiTextBlock } from './client';
import type { BuildPhotoExtractionPromptArgs } from './interfaces/build-photo-extraction-prompt-args.interface';
import { WINE_REGIONS } from '../wineGeography';

export const buildPhotoExtractionPrompt = ({
  imageBase64,
  mediaType,
}: BuildPhotoExtractionPromptArgs): { system: string; content: AiMessageContent } => {
  const system =
    'Tu es un sommelier expert. Tu réponds uniquement avec un objet JSON valide, sans texte avant ni après, correspondant exactement au schéma demandé.';

  const imageBlock: AiImageBlock = {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: imageBase64 },
  };

  const textBlock: AiTextBlock = {
    type: 'text',
    text: `Extrais les informations visibles sur l'étiquette de cette photo de bouteille et réponds avec un objet JSON de cette forme exacte :
{
  "name": "string | null",
  "producer": "string | null",
  "vintage": 2018,
  "category": "wine",
  "color": "rouge",
  "region": "string | null",
  "subRegion": "string | null",
  "grapeVarieties": ["string", "..."] ,
  "appellation": "string | null"
}

"category" est une supposition parmi ces 5 valeurs exactement : "wine", "sparkling", "cider", "beer", "spirit" — choisis celle qui correspond le mieux à ce que tu vois sur l'étiquette. "color" est pertinent si "category" vaut "wine" ou "sparkling" (un champagne ou effervescent peut être blanc ou rosé, pas seulement le vin tranquille) — valeurs possibles : "rouge", "blanc", "rose", "autre", ou null si indéterminable. "grapeVarieties" (pertinent si "category" vaut "wine" ou "sparkling") et "appellation" (pertinent si "category" vaut "wine") ne concernent que ce qui est explicitement lisible sur l'étiquette — n'invente rien à partir de tes propres connaissances si l'étiquette ne l'indique pas.

"region", "subRegion" et "appellation" sont trois niveaux distincts, du plus large au plus précis : ne répète pas la même valeur dans deux d'entre eux. "region" est la grande région viticole, prise dans cette liste pour un vin français : ${WINE_REGIONS.join(', ')}. "subRegion" est le niveau intermédiaire (ex. "Haut-Médoc", "Côte de Nuits"). "appellation" est l'AOC exacte imprimée sur l'étiquette. Une étiquette portant "Saint-Julien" donne donc "region": "Bordeaux", "subRegion": "Haut-Médoc", "appellation": "Saint-Julien" — jamais "region": "Saint-Julien". La région et la sous-région peuvent se déduire de l'appellation lue, elles ne sont pas soumises à la règle du "strictement lisible". Tous les champs sont nullable : si tu ne détectes pas une information avec certitude, laisse-la à null (ou tableau vide pour "grapeVarieties") plutôt que d'inventer une valeur.`,
  };

  return { system, content: [imageBlock, textBlock] };
};
