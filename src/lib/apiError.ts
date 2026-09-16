import { readJsonBody } from './readJsonBody';

/**
 * Message d'erreur d'une réponse d'API, tel que l'UI doit l'afficher. Les
 * routes répondent toutes `{ error: string }` en cas d'échec, mais une
 * réponse peut aussi venir d'ailleurs (proxy, page d'erreur, coupure) :
 * d'où la vérification de forme, et le repli fourni par l'appelant.
 */
export const errorMessageFromResponse = async (response: Response, fallback: string): Promise<string> => {
  const body: unknown = await readJsonBody(response);
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body;
    if (typeof error === 'string' && error.length > 0) {
      return error;
    }
  }
  return fallback;
};
