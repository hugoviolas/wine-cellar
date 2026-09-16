import { NextResponse } from 'next/server';
import { describeError, logger } from '@/lib/logger';
import { AiResponseError, callClaudeForJson } from './client';
import type { ClaudeJsonCallParams } from './interfaces/claude-json-call-params.interface';
import type { AiRouteCallArgs } from './interfaces/ai-route-call-args.interface';

export type AiRouteCallResult<T> = { data: T } | { error: NextResponse };

/**
 * Appel de Claude tel que les quatre routes IA en ont besoin : la réponse
 * validée, ou déjà la réponse HTTP à renvoyer. Les quatre routes
 * répétaient auparavant le même try/catch, au mot près — seul le message
 * destiné à l'utilisateur change réellement d'une route à l'autre.
 *
 * Le détail de l'échec part au log et jamais au client : il peut contenir
 * la réponse brute du modèle ou un message du fournisseur.
 */
export const callAiForRoute = async <T>(args: AiRouteCallArgs<T>): Promise<AiRouteCallResult<T>> => {
  const params: ClaudeJsonCallParams<T> = {
    system: args.system,
    content: args.content,
    schema: args.schema,
  };
  try {
    return { data: await callClaudeForJson(params) };
  } catch (error: unknown) {
    logger.error(`Appel IA en échec (${args.route}).`, describeError(error));
    if (error instanceof AiResponseError) {
      return {
        error: NextResponse.json({ error: args.invalidResponseMessage }, { status: 502 }),
      };
    }
    return {
      error: NextResponse.json({ error: 'Appel IA impossible pour le moment.' }, { status: 502 }),
    };
  }
};
