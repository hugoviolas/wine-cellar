/**
 * Ce qu'une requête et une réponse ont en commun pour ce dont on a besoin :
 * un corps JSON à lire. Déclaré ici plutôt que d'accepter `Request | Response`,
 * dont le `json()` natif est typé `Promise<any>`.
 */
export interface JsonSource {
  json: () => Promise<unknown>;
}
