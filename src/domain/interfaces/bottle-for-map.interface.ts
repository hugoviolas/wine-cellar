/**
 * Ce que la carte a besoin de savoir d'une bouteille : de quoi la placer
 * (région, sous-région) et de quoi la nommer dans le panneau latéral. Les
 * détails propres à sa catégorie (cépages, appellation...) n'y sont pas —
 * l'appellation a déjà joué son rôle à l'écriture, en déterminant la
 * sous-région.
 */
export interface BottleForMap {
  readonly id: string;
  readonly name: string;
  readonly producer: string | null;
  readonly vintage: number | null;
  readonly color: string | null;
  readonly quantity: number;
  readonly region: string | null;
  readonly subRegion: string | null;
}
