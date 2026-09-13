import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../db/testDb';
import { bootstrapSuperAdmin } from '../bootstrap';
import { createWishlistItem, getWishlistItem } from '../wishlist';
import { wishlistItems } from '../../db/schema';
import { saveWishlistAiAnalysis } from './wishlistAnalysis';
import type { AiBottleAnalysis } from './schemas';

const analysis: AiBottleAnalysis = {
  analysis: 'Un rouge corsé aux tanins fondus.',
  pairings: ['Agneau', 'Fromages affinés', 'Daube'],
  tastingAdvice: 'Carafer une heure, servir à 17 °C.',
  drinkFromYear: 2027,
  drinkUntilYear: 2034,
  region: 'Patrimonio',
  grapeVarieties: ['Niellucciu'],
  appellation: 'Patrimonio',
};

async function seedItem(db: Awaited<ReturnType<typeof createTestDb>>, details: unknown) {
  const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
  return createWishlistItem(db, { userId, category: 'wine', name: 'Clos Poggiale', details });
}

describe('saveWishlistAiAnalysis', () => {
  it('écrit l’analyse et remplit les champs vides', async () => {
    const db = await createTestDb();
    const id = await seedItem(db, { grapeVarieties: [] });

    await saveWishlistAiAnalysis(
      db,
      { id, category: 'wine', drinkFrom: null, drinkUntil: null, region: null, details: { grapeVarieties: [] } },
      analysis,
    );

    const item = await getWishlistItem(db, id);
    expect(item?.aiAnalysis).toBe('Un rouge corsé aux tanins fondus.');
    expect(item?.aiPairings).toEqual(['Agneau', 'Fromages affinés', 'Daube']);
    expect(item?.aiTastingAdvice).toBe('Carafer une heure, servir à 17 °C.');
    expect(item?.aiGeneratedAt).not.toBeNull();
    expect(item?.drinkFrom).toBe(2027);
    expect(item?.drinkUntil).toBe(2034);
    expect(item?.region).toBe('Patrimonio');
    expect(item?.details).toEqual({ grapeVarieties: ['Niellucciu'], appellation: 'Patrimonio' });
  });

  it('n’écrase jamais ce qui a été saisi à la main', async () => {
    const db = await createTestDb();
    const id = await seedItem(db, { grapeVarieties: ['Sciaccarellu'], appellation: 'Ajaccio' });
    await db
      .update(wishlistItems)
      .set({ drinkFrom: 2025, drinkUntil: 2030, region: 'Corse' })
      .where(eq(wishlistItems.id, id));

    await saveWishlistAiAnalysis(
      db,
      {
        id,
        category: 'wine',
        drinkFrom: 2025,
        drinkUntil: 2030,
        region: 'Corse',
        details: { grapeVarieties: ['Sciaccarellu'], appellation: 'Ajaccio' },
      },
      analysis,
    );

    const item = await getWishlistItem(db, id);
    expect(item?.drinkFrom).toBe(2025);
    expect(item?.drinkUntil).toBe(2030);
    expect(item?.region).toBe('Corse');
    expect(item?.details).toEqual({ grapeVarieties: ['Sciaccarellu'], appellation: 'Ajaccio' });
    // Les champs `ai*`, eux, sont bien réécrits — c'est le but d'une régénération.
    expect(item?.aiAnalysis).toBe('Un rouge corsé aux tanins fondus.');
  });

  it('réécrit les champs ai* à chaque génération', async () => {
    const db = await createTestDb();
    const id = await seedItem(db, { grapeVarieties: [] });
    const base = { id, category: 'wine' as const, drinkFrom: null, drinkUntil: null, region: null, details: { grapeVarieties: [] } };

    await saveWishlistAiAnalysis(db, base, analysis);
    await saveWishlistAiAnalysis(db, base, { ...analysis, analysis: 'Seconde lecture, plus sévère.' });

    expect((await getWishlistItem(db, id))?.aiAnalysis).toBe('Seconde lecture, plus sévère.');
  });

  it('ignore cépages et appellation hors des catégories concernées', async () => {
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'b@example.com', password: 'x', cellarName: 'Cave' });
    const id = await createWishlistItem(db, { userId, category: 'beer', name: 'Triple Karmeliet', details: {} });

    await saveWishlistAiAnalysis(
      db,
      { id, category: 'beer', drinkFrom: null, drinkUntil: null, region: null, details: {} },
      analysis,
    );

    const item = await getWishlistItem(db, id);
    expect(item?.details).toEqual({});
    expect(item?.aiAnalysis).toBe('Un rouge corsé aux tanins fondus.');
  });
});
