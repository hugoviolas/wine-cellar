/**
 * Ce qui fait qu'une bouteille est « le même vin » qu'une autre (voir
 * `bottleIdentity.ts`). Sous-ensemble des colonnes de `bottles`, pour que
 * les lignes de la base comme les objets allégés de l'UI s'y conforment.
 */
export interface BottleIdentityFields {
  readonly category: string;
  readonly name: string;
  readonly producer: string | null;
  readonly vintage: number | null;
  readonly color: string | null;
  readonly volumeMl: number | null;
}
