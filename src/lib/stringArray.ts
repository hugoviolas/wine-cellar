/**
 * Tableau de chaînes lu depuis une colonne JSON. SQLite ne contraint pas ce
 * qu'on y a écrit, donc `aiPairings` & co. arrivent en `unknown` : une
 * vérification élément par élément vaut mieux qu'un transtypage qui ferait
 * planter l'affichage sur une valeur inattendue.
 */
export const stringArrayOrEmpty = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
};
