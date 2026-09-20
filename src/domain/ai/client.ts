import Anthropic from '@anthropic-ai/sdk';
import type { AiImageMediaType } from './schemas';
import type { ClaudeJsonCallParams } from './interfaces/claude-json-call-params.interface';

export type { ClaudeJsonCallParams };

const MODEL = 'claude-sonnet-5';

/**
 * 2048 : de la marge pour les payloads JSON des deux chantiers (tableau
 * d'accords, texte d'analyse plus long) — le thinking étant désactivé, ce
 * budget n'est consommé que par la réponse elle-même.
 */
const DEFAULT_MAX_TOKENS = 2048;

/**
 * Nombre de reprises après un `pause_turn`. La boucle d'outils serveur
 * d'Anthropic s'arrête d'elle-même au bout de 10 itérations et rend la
 * main avec ce `stop_reason` : sans reprise, on récupérerait une réponse
 * tronquée au milieu des recherches, donc sans le JSON final.
 */
const MAX_SERVER_TOOL_CONTINUATIONS = 3;

/**
 * Recherche web côté Anthropic : aucune boucle d'outil à tenir ici, le
 * modèle cherche et lit pendant l'appel, et la réponse arrive déjà
 * enrichie. Utilisée pour l'estimation de prix, qu'aucun modèle ne peut
 * produire de mémoire sans l'inventer.
 *
 * `max_uses` borne le coût : quelques requêtes suffisent à recouper deux ou
 * trois marchands, et chaque recherche est facturée.
 */
export const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 5,
};

/**
 * Clé API lue à l'appel, pas au chargement du module : `next build` importe
 * les fichiers de route pour les analyser, sans qu'une vraie clé soit
 * forcément présente à ce moment — même précaution que SESSION_SECRET
 * (voir src/domain/session.ts).
 */
const getClient = (): Anthropic => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY doit être défini pour appeler Claude.');
  }
  return new Anthropic({ apiKey });
};

export class AiResponseError extends Error {}

export type AiTextBlock = { type: 'text'; text: string };
export type AiImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: AiImageMediaType; data: string };
};
export type AiMessageContent = string | Array<AiTextBlock | AiImageBlock>;

/**
 * Claude entoure parfois sa réponse d'un bloc de code markdown (```json ...
 * ``` ou ``` ... ```) même quand le prompt demande explicitement du JSON
 * seul, sans texte autour — constaté en usage réel malgré la consigne.
 * Retire cet entourage s'il est présent avant le `JSON.parse`.
 */
const stripMarkdownCodeFence = (text: string): string => {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  return match?.[1] ?? trimmed;
};

/**
 * Envoie la conversation et rend la réponse, en reprenant les tours mis en
 * pause par la boucle d'outils serveur (`pause_turn`). La reprise ne
 * rajoute pas de message utilisateur : l'API repart d'elle-même du dernier
 * bloc `server_tool_use` quand on lui renvoie le tour d'assistant en état.
 */
const createMessage = async ({
  client,
  system,
  content,
  tools,
  maxTokens,
}: {
  client: Anthropic;
  system: string;
  content: AiMessageContent;
  tools: Anthropic.Messages.ToolUnion[] | undefined;
  maxTokens: number;
}): Promise<Anthropic.Messages.Message> => {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content }];
  const send = (): Promise<Anthropic.Messages.Message> => {
    return client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // Les modèles Claude 5 pensent de façon adaptative par défaut (effort
      // "high" par défaut : le modèle décide seul de réfléchir ou non).
      // Aucun des chantiers (extraction structurée courte) n'a besoin de
      // raisonnement étendu, donc on le désactive explicitement — ça évite
      // aussi qu'un bloc `thinking` précède le bloc texte dans la réponse.
      thinking: { type: 'disabled' },
      system,
      messages,
      ...(tools ? { tools } : {}),
    });
  };

  let message = await send();
  for (let attempt = 0; message.stop_reason === 'pause_turn'; attempt += 1) {
    if (attempt >= MAX_SERVER_TOOL_CONTINUATIONS) {
      throw new AiResponseError('Recherche Claude interrompue (trop de reprises).');
    }
    messages.push({ role: 'assistant', content: message.content });
    message = await send();
  }

  return message;
};

/**
 * Envoie un message à Claude, extrait le dernier bloc texte de la réponse,
 * le parse en JSON et le valide avec le schéma Zod fourni. Sortie
 * structurée par prompt + validation (pas de tool-use côté app), voir le
 * spec IA. Lève `AiResponseError` si la réponse n'est pas un JSON valide ou
 * ne correspond pas au schéma — pas de nouvelle tentative automatique en
 * V1, l'utilisateur relance manuellement (bouton Régénérer / autre photo).
 */
export const callClaudeForJson = async <T>({
  system,
  content,
  schema,
  tools,
  maxTokens,
}: ClaudeJsonCallParams<T>): Promise<T> => {
  const client = getClient();
  const args = { client, system, content, maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS };

  let message: Anthropic.Messages.Message;
  try {
    message = await createMessage({ ...args, tools });
  } catch (error: unknown) {
    // Les outils serveur dépendent de ce que la clé API a le droit
    // d'utiliser : si la recherche web est refusée, l'analyse doit quand
    // même sortir (sans prix) plutôt que d'échouer entièrement. Seul un
    // refus de la requête est rattrapé ainsi — un 429 ou un 500 se
    // repropage, le rejouer ne ferait que payer deux fois.
    if (!tools || !(error instanceof Anthropic.BadRequestError)) {
      throw error;
    }
    message = await createMessage({ ...args, tools: undefined });
  }

  // Le dernier bloc texte, pas le premier : avec la recherche web, le
  // modèle commente souvent ses recherches avant de conclure, et le JSON
  // demandé est ce qu'il écrit en dernier. Sans outil, il n'y a qu'un bloc
  // texte et les deux reviennent au même.
  const block = message.content.findLast((b) => b.type === 'text');
  if (!block) {
    throw new AiResponseError('Réponse Claude sans contenu texte.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(block.text));
  } catch {
    throw new AiResponseError('Réponse Claude non conforme (JSON invalide).');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiResponseError('Réponse Claude non conforme au schéma attendu.');
  }
  return result.data;
};
