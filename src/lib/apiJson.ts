import { readJsonBody } from './readJsonBody';

/**
 * Champ texte d'une réponse d'API (`{ token }`, `{ bottleId }`, ...). Le
 * `json()` natif est typé `any`, ce qui laisserait lire n'importe quel
 * chemin sans contrôle : ici la forme est vérifiée, et une réponse
 * inattendue donne `null` au lieu d'une valeur `undefined` recopiée telle
 * quelle dans une URL.
 */
export const stringFieldFromResponse = async (response: Response, field: string): Promise<string | null> => {
  const body: unknown = await readJsonBody(response);
  if (typeof body !== 'object' || body === null || !(field in body)) {
    return null;
  }
  const value: unknown = Reflect.get(body, field);
  return typeof value === 'string' ? value : null;
};
