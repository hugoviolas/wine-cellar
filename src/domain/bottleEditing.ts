/**
 * Champs qu'un simple lecteur d'une cave peut modifier sur une bouteille :
 * sa note personnelle et sa note sur 5 (matrice de permissions du spec :
 * « Consommer une bouteille + noter »). Tout autre champ, seul ou combiné à
 * ceux-ci, reste réservé aux rôles qui éditent le contenu de la cave.
 * Partagé par `PATCH /api/bottles/[id]` et le tool MCP `update_bottle`.
 */
const PERSONAL_BOTTLE_FIELDS: ReadonlySet<string> = new Set(['userNote', 'rating']);

export const isPersonalBottlePatch = (fields: readonly string[]): boolean => {
  return fields.every((field) => PERSONAL_BOTTLE_FIELDS.has(field));
};
