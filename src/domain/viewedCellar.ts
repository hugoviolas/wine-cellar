import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cellarMemberships } from '../db/schema';
import { checkCellarAccess } from './access';

/**
 * Résout la cave à afficher pour cette requête : `requestedCellarId` (ex.
 * `?cellarId=X` depuis le lien "Ouvrir" du dashboard admin) si
 * l'utilisateur y a accès (un super-admin a accès à toute cave sans en
 * être membre, voir `checkCellarAccess`), sinon son premier membership —
 * le comportement historique de ces pages, une cave "par défaut". Un
 * cellarId demandé mais non autorisé est silencieusement ignoré plutôt que
 * de révéler quoi que ce soit sur son existence.
 */
export async function resolveViewedCellarId(
  db: Db,
  userId: string,
  requestedCellarId: string | undefined,
): Promise<string | null> {
  if (requestedCellarId) {
    const access = await checkCellarAccess(db, userId, requestedCellarId);
    if (access.allowed) return requestedCellarId;
  }
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.userId, userId))
    .orderBy(cellarMemberships.createdAt)
    .limit(1);
  return membership?.cellarId ?? null;
}
