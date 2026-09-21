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
 * Sites de vente et de cote sur lesquels chercher un prix.
 *
 * Sans cette liste, le modèle tombait massivement sur des cartes de
 * restaurant — elles sont nombreuses en ligne et citent bien un prix pour
 * la bonne bouteille. Mais un prix de restaurant porte la marge du
 * restaurateur : une bouteille à 20 € chez un caviste s'y affiche à 50 ou
 * 60 €, et l'estimation devenait absurde pour quelqu'un qui veut savoir ce
 * que vaut sa cave.
 *
 * Restreindre les domaines règle le problème à la racine plutôt que par
 * une consigne que le modèle peut négliger, et accélère la recherche au
 * passage. Le prix à payer est assumé : une bouteille absente de ces sites
 * n'aura pas d'estimation du tout, ce qui vaut mieux qu'un prix faux.
 *
 * C'est le levier à ajuster si trop de bouteilles ressortent sans prix.
 */
const PRICE_SOURCE_DOMAINS = [
  'wine-searcher.com',
  'idealwine.com',
  'vivino.com',
  'vinatis.com',
  'millesima.fr',
  'lavinia.fr',
  'twil.fr',
  '1jour1vin.com',
  'cavissima.com',
  'chateaunet.com',
];

/**
 * Recherche web côté Anthropic : aucune boucle d'outil à tenir ici, le
 * modèle cherche et lit pendant l'appel, et la réponse arrive déjà
 * enrichie. Utilisée pour l'estimation de prix, qu'aucun modèle ne peut
 * produire de mémoire sans l'inventer.
 *
 * `max_uses` borne le coût *et* la durée : trois requêtes suffisent à
 * recouper deux ou trois marchands, chaque recherche est facturée, et
 * chacune allonge le temps passé devant un bouton qui tourne.
 */
export const WEB_SEARCH_TOOL: Anthropic.Messages.WebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 3,
  allowed_domains: PRICE_SOURCE_DOMAINS,
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
  // Une seule reprise automatique au lieu de deux : les reprises du SDK
  // consomment le budget de l'appel (voir `CALL_BUDGET_MS`), et sur une
  // requête qui dure déjà une minute, en enchaîner trois ne fait
  // qu'éloigner le moment où l'utilisateur apprend que ça a échoué.
  return new Anthropic({ apiKey, maxRetries: 1 });
};

export class AiResponseError extends Error {}

/** Le budget de temps de l'appel est épuisé — voir `CALL_BUDGET_MS`. */
export class AiTimeoutError extends Error {}

/**
 * Budget de temps d'un appel complet, reprises et tentatives comprises.
 *
 * Rien ne le bornait jusqu'ici, et les valeurs par défaut du SDK se
 * multiplient : 10 minutes par requête, 2 reprises automatiques, jusqu'à
 * quatre requêtes pour épuiser les `pause_turn`, plus un éventuel rejeu
 * sans outil. Une génération pouvait donc tenir le bouton sur
 * « Génération… » pendant des heures sans jamais rien afficher — c'est ce
 * qui a été constaté en préprod sur la régénération d'une analyse.
 *
 * Quatre minutes : une analyse avec recherche web tient largement dedans,
 * et au-delà il vaut mieux rendre la main avec un message clair que faire
 * patienter indéfiniment.
 */
const CALL_BUDGET_MS = 4 * 60 * 1000;

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
 * Le JSON d'une réponse, quelle que soit la façon dont le modèle l'a
 * emballé.
 *
 * Prendre le dernier bloc texte suffisait tant qu'il n'y avait pas
 * d'outils. Avec la recherche web, la réponse finale arrive couramment
 * découpée en plusieurs blocs texte — les citations s'attachent bloc par
 * bloc — et le dernier n'est alors que la fin du JSON : c'est ce qui a
 * fait échouer la génération en préprod avec « JSON invalide ».
 *
 * D'où les trois tentatives, de la plus fidèle à la plus tolérante :
 * le dernier bloc seul (cas sans outil, le plus courant), puis tous les
 * blocs recollés (cas d'une réponse découpée), puis la tranche allant de
 * la première accolade à la dernière (cas d'une phrase d'introduction ou
 * de conclusion restée autour du JSON malgré la consigne).
 */
const extractJson = (texts: readonly string[]): unknown => {
  const joined = texts.join('');
  const last = texts[texts.length - 1] ?? '';
  const sliceBetweenBraces = (text: string): string => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return start !== -1 && end > start ? text.slice(start, end + 1) : '';
  };

  const candidates = [
    stripMarkdownCodeFence(last),
    stripMarkdownCodeFence(joined),
    sliceBetweenBraces(joined),
  ];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  // L'extrait part au log et jamais au client (voir callForRoute) : sans
  // lui, un échec de parsing ne laisse aucune trace de ce que le modèle a
  // réellement répondu, et le diagnostic repart de zéro à chaque fois.
  throw new AiResponseError(
    `Réponse Claude non conforme (JSON invalide). Début de la réponse : ${joined.slice(0, 300)}`,
  );
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
  deadline,
}: {
  client: Anthropic;
  system: string;
  content: AiMessageContent;
  tools: Anthropic.Messages.ToolUnion[] | undefined;
  maxTokens: number;
  deadline: number;
}): Promise<Anthropic.Messages.Message> => {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content }];
  const send = (): Promise<Anthropic.Messages.Message> => {
    // Le temps restant sert de délai à la requête : le budget couvre tout
    // l'appel, pas chacune de ses reprises prise isolément.
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new AiTimeoutError('Budget de temps épuisé avant la réponse de Claude.');
    }
    return client.messages.create(
      {
        model: MODEL,
        max_tokens: maxTokens,
        // Les modèles Claude 5 pensent de façon adaptative par défaut
        // (effort "high" : le modèle décide seul de réfléchir ou non).
        // Aucun des chantiers (extraction structurée courte) n'a besoin de
        // raisonnement étendu, donc on le désactive explicitement — ça
        // évite aussi qu'un bloc `thinking` précède le bloc texte.
        thinking: { type: 'disabled' },
        system,
        messages,
        ...(tools ? { tools } : {}),
      },
      { timeout: remaining },
    );
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
 * Envoie un message à Claude, extrait le JSON de sa réponse (voir
 * `extractJson`) et le valide avec le schéma Zod fourni. Sortie
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
  budgetMs,
}: ClaudeJsonCallParams<T>): Promise<T> => {
  const client = getClient();
  // Une seule échéance pour tout l'appel, rejeu sans outil compris : deux
  // budgets séparés se cumuleraient, ce qui reviendrait à ne rien borner.
  const deadline = Date.now() + (budgetMs ?? CALL_BUDGET_MS);
  const args = { client, system, content, maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS, deadline };

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

  // Vérifié avant le parsing : une réponse coupée par `max_tokens` produit
  // un JSON tronqué, donc invalide, et l'erreur générique ferait chercher
  // du côté du modèle un problème qui n'est que de budget.
  if (message.stop_reason === 'max_tokens') {
    throw new AiResponseError('Réponse Claude tronquée : plafond max_tokens atteint.');
  }

  const texts = message.content.filter((b) => b.type === 'text').map((b) => b.text);
  if (texts.length === 0) {
    throw new AiResponseError('Réponse Claude sans contenu texte.');
  }

  const parsed = extractJson(texts);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiResponseError('Réponse Claude non conforme au schéma attendu.');
  }
  return result.data;
};
