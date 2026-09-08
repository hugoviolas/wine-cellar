import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import type { AiImageMediaType } from './schemas';

const MODEL = 'claude-sonnet-5';

/**
 * Clé API lue à l'appel, pas au chargement du module : `next build` importe
 * les fichiers de route pour les analyser, sans qu'une vraie clé soit
 * forcément présente à ce moment — même précaution que SESSION_SECRET
 * (voir src/domain/session.ts).
 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY doit être défini pour appeler Claude.');
  }
  return new Anthropic({ apiKey });
}

export class AiResponseError extends Error {}

export type AiTextBlock = { type: 'text'; text: string };
export type AiImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: AiImageMediaType; data: string };
};
export type AiMessageContent = string | Array<AiTextBlock | AiImageBlock>;

export interface ClaudeJsonCallParams<T> {
  system: string;
  content: AiMessageContent;
  schema: z.ZodType<T>;
}

/**
 * Envoie un message à Claude, extrait le premier bloc texte de la réponse,
 * le parse en JSON et le valide avec le schéma Zod fourni. Sortie
 * structurée par prompt + validation (pas de tool-use), voir le spec IA.
 * Lève `AiResponseError` si la réponse n'est pas un JSON valide ou ne
 * correspond pas au schéma — pas de nouvelle tentative automatique en V1,
 * l'utilisateur relance manuellement (bouton Régénérer / autre photo).
 */
export async function callClaudeForJson<T>({ system, content, schema }: ClaudeJsonCallParams<T>): Promise<T> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new AiResponseError('Réponse Claude sans contenu texte.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    throw new AiResponseError('Réponse Claude non conforme (JSON invalide).');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiResponseError('Réponse Claude non conforme au schéma attendu.');
  }
  return result.data;
}
