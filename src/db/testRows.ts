/**
 * Première ligne d'un résultat de requête, en échouant explicitement si la
 * requête n'a rien renvoyé. Réservé aux tests : sous
 * `noUncheckedIndexedAccess`, un `const [row] = await db.select()` donne un
 * `row` optionnel, et le code de test deviendrait illisible à force de
 * vérifier une absence qui, dans un test, est de toute façon un échec.
 */
export const firstRow = <T>(rows: readonly T[]): T => {
  const [row] = rows;
  if (row === undefined) {
    throw new Error('Requête sans résultat : la ligne attendue par le test est absente.');
  }
  return row;
};

/**
 * Ligne à un rang précis d'un résultat, même usage et même raison que
 * `firstRow` : dans un test, une ligne absente est un échec, pas un cas à
 * gérer.
 */
export const rowAt = <T>(rows: readonly T[], index: number): T => {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`Requête sans résultat au rang ${String(index)} : ligne attendue par le test absente.`);
  }
  return row;
};
