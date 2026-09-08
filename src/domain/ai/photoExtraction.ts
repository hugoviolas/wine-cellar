import type { AiImageBlock, AiMessageContent, AiTextBlock } from './client';
import type { AiImageMediaType } from './schemas';

export function buildPhotoExtractionPrompt(
  imageBase64: string,
  mediaType: AiImageMediaType,
): { system: string; content: AiMessageContent } {
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
  "region": "string | null"
}

"category" est une supposition parmi ces 5 valeurs exactement : "wine", "sparkling", "cider", "beer", "spirit" — choisis celle qui correspond le mieux à ce que tu vois sur l'étiquette. "color" n'est pertinent que si "category" vaut "wine" (valeurs possibles : "rouge", "blanc", "rose", "autre", ou null si indéterminable). Tous les champs sont nullable : si tu ne détectes pas une information avec certitude, laisse-la à null plutôt que d'inventer une valeur.`,
  };

  return { system, content: [imageBlock, textBlock] };
}
