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
 * Valeur d'affichage d'une caractéristique, ou `null` si elle est vide.
 * Un zéro numérique est une valeur, pas un vide — d'où la conversion avant
 * le test de présence.
 */
export const factValue = (value: string | number | null | undefined): string | null => {
  const text = typeof value === 'number' ? String(value) : value;
  return text?.trim() ? text : null;
};

/**
 * Ligne de caractéristiques séparées par des points médians, montée depuis
 * des valeurs dont beaucoup sont nulles ou vides (producteur, millésime,
 * note...). Filtrer puis joindre évite les séparateurs orphelins que
 * produisent les `{x && <span>{x} · </span>}` enchaînés.
 *
 * Réservé aux vues denses — listes, historique — où une ligne compacte vaut
 * mieux qu'un tableau. Sur une fiche, c'est `FactList` qui s'applique : on y
 * lit une bouteille à la fois, et le libellé lève l'ambiguïté entre deux
 * valeurs voisines (région et sous-région, notamment).
 */
export const factLine = (facts: ReadonlyArray<string | number | null | undefined>): string => {
  return facts
    .map(factValue)
    .filter((fact): fact is string => fact !== null)
    .join(' · ');
};
