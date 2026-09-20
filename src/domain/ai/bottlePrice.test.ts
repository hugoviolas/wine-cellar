import { describe, it, expect } from 'vitest';
import { createTestDb } from '../../db/testDb';
import { bootstrapSuperAdmin } from '../bootstrap';
import { createCrate } from '../crates';
import { createBottle, getBottle } from '../bottles';
import { buildBottlePricePrompt, saveBottlePriceEstimate } from './bottlePrice';
import type { Db } from '../../db/client';

const bottle = {
  name: 'Château Gruaud-Larose',
  producer: 'Château Gruaud-Larose SA',
  vintage: 2015,
  category: 'wine',
  region: 'Bordeaux',
  subRegion: 'Haut-Médoc',
  color: 'rouge',
  grapeVarieties: ['Merlot'],
  appellation: 'Saint-Julien',
};

describe('buildBottlePricePrompt', () => {
  it('identifie la bouteille à chercher', () => {
    const { content } = buildBottlePricePrompt({ bottle });

    const text = content as string;
    expect(text).toContain('Château Gruaud-Larose');
    expect(text).toContain('2015');
    expect(text).toContain('Saint-Julien');
  });

  it('demande un prix sourcé, et le refus d’inventer', () => {
    const text = buildBottlePricePrompt({ bottle }).content as string;

    expect(text).toContain('"priceEstimate"');
    expect(text).toContain('recherche web');
    expect(text).toContain('au moins deux sources distinctes');
    expect(text).toContain('de mémoire');
    expect(text).toContain("c'est une réponse attendue, pas un échec");
  });

  it('exclut les prix de restaurant, qui portent la marge de l’établissement', () => {
    const text = buildBottlePricePrompt({ bottle }).content as string;

    expect(text).toContain("à l'achat chez un marchand");
    expect(text).toContain('carte de restaurant');
    expect(text).toContain('au verre');
  });

  it('ne demande rien d’autre que le prix — l’analyse est un appel séparé', () => {
    const text = buildBottlePricePrompt({ bottle }).content as string;

    expect(text).not.toContain('"pairings"');
    expect(text).not.toContain('"tastingAdvice"');
  });
});

interface SetupResult {
  db: Db;
  bottleId: string;
}

describe('saveBottlePriceEstimate', () => {
  const setup = async (): Promise<SetupResult> => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: { email: 'admin@example.com', password: 'x', cellarName: 'Cave' },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: { crateId, category: 'wine', name: 'Vin test', quantity: 1, details: {} },
    });
    return { db, bottleId };
  };

  const estimate = {
    lowEur: 24.5,
    highEur: 31,
    note: null,
    sources: [
      { label: 'Caviste A', url: 'https://caviste-a.fr/vin' },
      { label: 'Caviste B', url: 'https://caviste-b.fr/vin' },
    ],
  };

  it('écrit l’estimation en la datant du relevé', async () => {
    const { db, bottleId } = await setup();

    await saveBottlePriceEstimate({
      db,
      bottleId,
      estimate,
      now: new Date('2026-09-20T20:00:00.000Z'),
    });

    // La date vient de l'écriture, pas du modèle : elle dit quand le prix a
    // réellement été relevé, indépendamment de l'âge de l'analyse.
    expect((await getBottle({ db, bottleId }))?.aiPriceEstimate).toEqual({
      ...estimate,
      asOf: '2026-09-20T20:00:00.000Z',
    });
  });

  it('efface l’estimation quand la recherche ne trouve plus rien', async () => {
    const { db, bottleId } = await setup();

    await saveBottlePriceEstimate({ db, bottleId, estimate });
    await saveBottlePriceEstimate({ db, bottleId, estimate: null });

    expect((await getBottle({ db, bottleId }))?.aiPriceEstimate).toBeNull();
  });
});
