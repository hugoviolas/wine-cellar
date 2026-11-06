/**
 * Champs rangés dans `details` : absent = inchangé, `null` = effacé (en
 * création, seuls les champs fournis comptent).
 */
export interface DetailsInput {
  appellation?: string | null;
  classification?: string | null;
  grape_varieties?: string[] | null;
}
