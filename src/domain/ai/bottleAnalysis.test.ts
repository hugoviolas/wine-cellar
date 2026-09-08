import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../db/testDb';
import { bootstrapSuperAdmin } from '../bootstrap';
import { createCrate } from '../crates';
import { createBottle, getBottle } from '../bottles';
import { bottles } from '../../db/schema';
import { buildBottleAnalysisPrompt, saveBottleAiAnalysis } from './bottleAnalysis';

describe('buildBottleAnalysisPrompt', () => {
  it('inclut les champs de la bouteille dans le prompt', () => {
    const { content } = buildBottleAnalysisPrompt({
      name: 'Château Margaux',
      producer: 'Château Margaux SA',
      vintage: 2015,
      category: 'wine',
      region: 'Bordeaux',
    });

    expect(typeof content).toBe('string');
    const text = content as string;
    expect(text).toContain('Château Margaux');
    expect(text).toContain('Château Margaux SA');
    expect(text).toContain('2015');
    expect(text).toContain('wine');
    expect(text).toContain('Bordeaux');
    expect(text).toContain('3 à 5');
  });

  it('gère les champs absents sans planter', () => {
    const { content } = buildBottleAnalysisPrompt({
      name: 'Cidre mystère',
      producer: null,
      vintage: null,
      category: 'cider',
      region: null,
    });

    expect(content as string).toContain('Cidre mystère');
    expect(content as string).toContain('inconnu');
  });
});

describe('saveBottleAiAnalysis', () => {
  async function setupBottle() {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Cave',
    });
    const crateId = await createCrate(db, { cellarId, name: 'Clayette 1', capacity: 12 });
    const bottleId = await createBottle(db, {
      crateId,
      category: 'wine',
      name: 'Vin test',
      quantity: 1,
      details: {},
    });
    return { db, bottleId };
  }

  const analysis = {
    analysis: 'Un vin bien structuré.',
    pairings: ['Bœuf', 'Fromage', 'Gibier'],
    tastingAdvice: 'Servir à 16°C.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
  };

  it('écrit les champs IA et la fenêtre de garde quand elle est vide', async () => {
    const { db, bottleId } = await setupBottle();
    const before = await getBottle(db, bottleId);
    expect(before?.drinkFrom).toBeNull();
    expect(before?.drinkUntil).toBeNull();

    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: null, drinkUntil: null }, analysis);

    const after = await getBottle(db, bottleId);
    expect(after?.aiAnalysis).toBe(analysis.analysis);
    expect(after?.aiPairings).toEqual(analysis.pairings);
    expect(after?.aiTastingAdvice).toBe(analysis.tastingAdvice);
    expect(after?.aiGeneratedAt).toBeTruthy();
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
  });

  it('n’écrase pas une fenêtre de garde déjà renseignée', async () => {
    const { db, bottleId } = await setupBottle();
    await db.update(bottles).set({ drinkFrom: 2020, drinkUntil: 2024 }).where(eq(bottles.id, bottleId));

    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: 2020, drinkUntil: 2024 }, analysis);

    const after = await getBottle(db, bottleId);
    expect(after?.drinkFrom).toBe(2020);
    expect(after?.drinkUntil).toBe(2024);
    // Les champs IA eux sont toujours écrasés, y compris à la régénération.
    expect(after?.aiAnalysis).toBe(analysis.analysis);
  });

  it('remplace le contenu IA précédent lors d’une régénération', async () => {
    const { db, bottleId } = await setupBottle();
    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: null, drinkUntil: null }, analysis);

    const secondAnalysis = { ...analysis, analysis: 'Nouvelle analyse.', pairings: ['Volaille', 'Poisson', 'Fromage'] };
    await saveBottleAiAnalysis(db, { id: bottleId, drinkFrom: 2027, drinkUntil: 2032 }, secondAnalysis);

    const after = await getBottle(db, bottleId);
    expect(after?.aiAnalysis).toBe('Nouvelle analyse.');
    expect(after?.aiPairings).toEqual(['Volaille', 'Poisson', 'Fromage']);
    // La garde était déjà remplie par le premier appel : pas réécrasée par le second.
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
  });
});
