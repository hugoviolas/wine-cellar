import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { createBottle } from './bottles';
import { createWishlistItem } from './wishlist';
import { backfillWineGeography } from './backfillGeography';
import { bottles, wishlistItems } from '../db/schema';
import type { Db } from '../db/client';

const setup = async (): Promise<{ db: Db; crateId: string; userId: string }> => {
  const db = await createTestDb();
  const { cellarId, userId } = await bootstrapSuperAdmin({
    db,
    params: { email: 'a@example.com', password: 'x', cellarName: 'Cave' },
  });
  const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
  return { db, crateId, userId };
};

/**
 * `createBottle` normalise déjà à l'écriture : pour simuler une ligne
 * héritée, il faut la dégrader après coup, comme le ferait une base
 * remplie avant ce chantier.
 */
const degrade = async (db: Db, bottleId: string, region: string | null): Promise<void> => {
  await db.update(bottles).set({ region, subRegion: null }).where(eq(bottles.id, bottleId));
};

describe('backfillWineGeography', () => {
  it('recale une bouteille dont la région portait en fait une sous-région', async () => {
    const { db, crateId } = await setup();
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Château Gruaud-Larose',
        quantity: 1,
        details: { grapeVarieties: [], appellation: 'Saint-Julien' },
      },
    });
    await degrade(db, bottleId, 'Haut-Médoc');

    const report = await backfillWineGeography({ db });

    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]).toMatchObject({
      table: 'bottles',
      name: 'Château Gruaud-Larose',
      from: { region: 'Haut-Médoc', subRegion: null },
      to: { region: 'Bordeaux', subRegion: 'Haut-Médoc' },
    });

    const [after] = await db.select().from(bottles).where(eq(bottles.id, bottleId));
    expect(after?.region).toBe('Bordeaux');
    expect(after?.subRegion).toBe('Haut-Médoc');
  });

  it('est idempotent : la seconde exécution ne change plus rien', async () => {
    const { db, crateId } = await setup();
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Château Gruaud-Larose',
        quantity: 1,
        details: { grapeVarieties: [], appellation: 'Saint-Julien' },
      },
    });
    await degrade(db, bottleId, 'Haut-Médoc');

    expect((await backfillWineGeography({ db })).changes).toHaveLength(1);
    expect((await backfillWineGeography({ db })).changes).toEqual([]);
  });

  it('ne touche pas une région hors table', async () => {
    const { db, crateId } = await setup();
    const bottleId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Chianti', quantity: 1, details: { grapeVarieties: [] } },
    });
    await degrade(db, bottleId, 'Toscane');

    const report = await backfillWineGeography({ db });

    expect(report.changes).toEqual([]);
    const [after] = await db.select().from(bottles).where(eq(bottles.id, bottleId));
    expect(after?.region).toBe('Toscane');
  });

  it('couvre aussi la wishlist', async () => {
    const { db, userId } = await setup();
    const itemId = await createWishlistItem({
      db,
      input: {
        userId,
        category: 'wine',
        name: 'Clos de Vougeot',
        details: { grapeVarieties: [], appellation: 'Clos de Vougeot' },
      },
    });
    await db.update(wishlistItems).set({ region: null, subRegion: null }).where(eq(wishlistItems.id, itemId));

    const report = await backfillWineGeography({ db });

    expect(report.changes).toHaveLength(1);
    expect(report.changes[0]?.table).toBe('wishlist_items');
    const [after] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, itemId));
    expect(after?.region).toBe('Bourgogne');
    expect(after?.subRegion).toBe('Côte de Nuits');
  });

  it('signale une ligne aux détails illisibles au lieu de la réécrire', async () => {
    const { db, crateId } = await setup();
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Fiche abîmée',
        quantity: 1,
        details: { grapeVarieties: [] },
      },
    });
    // `grapeVarieties` doit être un tableau : cette ligne ne peut plus être
    // relue par `parseBottleDetails`.
    await db
      .update(bottles)
      .set({ details: { grapeVarieties: 'Merlot' }, region: 'Haut-Médoc' })
      .where(eq(bottles.id, bottleId));

    const report = await backfillWineGeography({ db });

    expect(report.skipped).toEqual([`bottles/${bottleId}`]);
    expect(report.changes).toEqual([]);
    const [after] = await db.select().from(bottles).where(eq(bottles.id, bottleId));
    expect(after?.region).toBe('Haut-Médoc');
  });

  it('compte toutes les lignes examinées', async () => {
    const { db, crateId, userId } = await setup();
    await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'A', quantity: 1, details: { grapeVarieties: [] } },
    });
    await createWishlistItem({
      db,
      input: { userId, category: 'wine', name: 'B', details: { grapeVarieties: [] } },
    });

    expect((await backfillWineGeography({ db })).scanned).toBe(2);
  });
});
