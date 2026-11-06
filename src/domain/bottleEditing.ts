import { getCrateById } from './crates';
import type { CheckCrateMoveArgs } from './interfaces/check-crate-move-args.interface';

/**
 * Champs qu'un simple lecteur d'une cave peut modifier sur une bouteille :
 * sa note personnelle et sa note sur 5 (matrice de permissions du spec :
 * « Consommer une bouteille + noter »). Tout autre champ, seul ou combiné à
 * ceux-ci, reste réservé aux rôles qui éditent le contenu de la cave.
 */
const PERSONAL_BOTTLE_FIELDS: ReadonlySet<string> = new Set(['userNote', 'rating']);

export const isPersonalBottlePatch = (fields: readonly string[]): boolean => {
  return fields.every((field) => PERSONAL_BOTTLE_FIELDS.has(field));
};

export type CrateMoveCheck = 'ok' | 'target_not_found' | 'other_cellar';

/**
 * Une bouteille ne change de clayette qu'à l'intérieur de sa cave : sans
 * cette vérification, déplacer une bouteille vers la clayette d'une autre
 * cave (dont on connaîtrait l'identifiant) la ferait changer de cave —
 * faille déjà corrigée une fois sur `PATCH /api/bottles/[id]`.
 */
export const checkCrateMove = async ({
  db,
  fromCrateId,
  toCrateId,
}: CheckCrateMoveArgs): Promise<CrateMoveCheck> => {
  const target = await getCrateById({ db, crateId: toCrateId });
  if (!target) {
    return 'target_not_found';
  }
  const current = await getCrateById({ db, crateId: fromCrateId });
  if (!current || current.cellarId !== target.cellarId) {
    return 'other_cellar';
  }
  return 'ok';
};
