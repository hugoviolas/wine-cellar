import type { Db } from '../db/client';
import { getBottle } from './bottles';
import { getCrateById } from './crates';
import { checkCellarAccess } from './access';

export type BottleAccessResult =
  | { status: 'ok'; bottle: NonNullable<Awaited<ReturnType<typeof getBottle>>> }
  | { status: 'not_found' }
  | { status: 'forbidden' };

export async function resolveBottleAccess(
  db: Db,
  userId: string,
  bottleId: string,
): Promise<BottleAccessResult> {
  const bottle = await getBottle(db, bottleId);
  if (!bottle) return { status: 'not_found' };
  if (!bottle.crateId) return { status: 'not_found' };
  const crate = await getCrateById(db, bottle.crateId);
  if (!crate) return { status: 'not_found' };
  const access = await checkCellarAccess(db, userId, crate.cellarId);
  if (!access.allowed) return { status: 'forbidden' };
  return { status: 'ok', bottle };
}
