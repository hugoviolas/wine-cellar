import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describeError, logger } from '@/lib/logger';
import type { RunToolArgs } from './interfaces/run-tool-args.interface';

/**
 * Refus attendu, à montrer tel quel à Claude : bouteille introuvable, rôle
 * insuffisant, stock épuisé… Le message doit lui permettre de corriger son
 * appel ou d'expliquer la situation à l'utilisateur.
 */
export class ToolError extends Error {}

const INTERNAL_ERROR_MESSAGE = 'Erreur interne du serveur Ma Cave.';

/**
 * Exécute un tool et met son résultat au format MCP : du JSON en texte.
 * Les champs `null` en sont retirés — « absent » vaut « non renseigné »,
 * et une cave de cent bouteilles aux champs souvent vides coûte nettement
 * moins de contexte ainsi. Toute erreur autre qu'une `ToolError` est
 * journalisée et remplacée par un message générique.
 */
export const runTool = async ({ tool, work }: RunToolArgs): Promise<CallToolResult> => {
  try {
    const result = await work();
    const text = JSON.stringify(result, (_key, value: unknown) => (value === null ? undefined : value));
    return { content: [{ type: 'text', text }] };
  } catch (error: unknown) {
    if (error instanceof ToolError) {
      return toErrorResult(error.message);
    }
    logger.error('Échec inattendu dans un tool MCP', { tool, ...describeError(error) });
    return toErrorResult(INTERNAL_ERROR_MESSAGE);
  }
};

const toErrorResult = (message: string): CallToolResult => {
  return { isError: true, content: [{ type: 'text', text: message }] };
};
