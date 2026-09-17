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

/**
 * Ligne de caractéristiques séparées par des points médians, montée depuis
 * des valeurs dont beaucoup sont nulles ou vides (producteur, appellation,
 * note...). Filtrer puis joindre évite les séparateurs orphelins que
 * produisent les `{x && <span>{x} · </span>}` enchaînés.
 */
export const factLine = (facts: ReadonlyArray<string | number | null | undefined>): string => {
  return facts
    .map((fact) => (typeof fact === 'number' ? String(fact) : fact))
    .filter((fact): fact is string => Boolean(fact))
    .join(' · ');
};
