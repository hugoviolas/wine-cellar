import type { Db } from '../db/client';
import { getBottle } from './bottles';
import { getCrateById } from './crates';
import { checkCellarAccess, type CellarRole } from './access';
import type { BottleRow } from '../db/rows';

/**
 * La bouteille du cas 'ok' porte forcément une clayette : sans clayette,
 * rien ne rattache la bouteille à une cave, donc aucun accès n'est
 * calculable et le résultat est 'not_found'. Le type le dit, pour que les
 * appelants n'aient pas à le redire.
 */
export type BottleAccessResult =
  | { status: 'ok'; bottle: BottleRow & { crateId: string }; role: CellarRole }
  | { status: 'not_found' }
  | { status: 'forbidden' };

export const resolveBottleAccess = async (
  db: Db,
  userId: string,
  bottleId: string,
): Promise<BottleAccessResult> => {
  const bottle = await getBottle(db, bottleId);
  if (!bottle) {
    return { status: 'not_found' };
  }
  const { crateId } = bottle;
  if (crateId === null) {
    return { status: 'not_found' };
  }
  const crate = await getCrateById(db, crateId);
  if (!crate) {
    return { status: 'not_found' };
  }
  const access = await checkCellarAccess(db, userId, crate.cellarId);
  if (!access.allowed) {
    return { status: 'forbidden' };
  }
  return { status: 'ok', bottle: { ...bottle, crateId }, role: access.role };
};
