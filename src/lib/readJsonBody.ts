import type { JsonSource } from './interfaces/json-source.interface';

/**
 * Corps JSON d'une requête ou d'une réponse, en `unknown` et jamais en
 * `any` : le typage natif de `json()` laisserait passer n'importe quel
 * accès sans contrôle, alors que tout corps entrant doit de toute façon
 * traverser un schéma zod (côté serveur) ou une vérification de forme
 * (côté client) avant d'être lu. Un corps absent ou mal formé donne `null`,
 * que les schémas rejettent comme le reste.
 */
export const readJsonBody = async (source: JsonSource): Promise<unknown> => {
  try {
    return await source.json();
  } catch {
    return null;
  }
};
