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
    const { content } = buildBottleAnalysisPrompt(
      {
        name: 'Château Margaux',
        producer: 'Château Margaux SA',
        vintage: 2015,
        category: 'wine',
        region: 'Bordeaux',
        color: 'rouge',
        grapeVarieties: ['Cabernet Sauvignon', 'Merlot'],
        appellation: 'Margaux',
      },
      2026,
    );

    expect(typeof content).toBe('string');
    const text = content as string;
    expect(text).toContain('Château Margaux');
    expect(text).toContain('Château Margaux SA');
    expect(text).toContain('2015');
    expect(text).toContain('wine');
    expect(text).toContain('Bordeaux');
    expect(text).toContain('Couleur : rouge');
    expect(text).toContain('Cépages connus : Cabernet Sauvignon, Merlot');
    expect(text).toContain('Appellation connue : Margaux');
    expect(text).toContain('Année actuelle : 2026');
    expect(text).toContain('3 à 5');
  });

  it('gère les champs absents sans planter', () => {
    const { content } = buildBottleAnalysisPrompt(
      {
        name: 'Cidre mystère',
        producer: null,
        vintage: null,
        category: 'cider',
        region: null,
        color: null,
        grapeVarieties: [],
        appellation: null,
      },
      2026,
    );

    const text = content as string;
    expect(text).toContain('Cidre mystère');
    expect(text).toContain('Producteur : inconnu');
    expect(text).toContain('Région : inconnue');
    expect(text).toContain('Couleur : inconnue');
    expect(text).toContain('Cépages connus : inconnus');
    expect(text).toContain('Appellation connue : inconnue');
  });

  it('demande une estimation best-effort même pour un vin ancien probablement en fin de vie', () => {
    const { content } = buildBottleAnalysisPrompt(
      {
        name: 'Côtes du Rhône',
        producer: null,
        vintage: 1998,
        category: 'wine',
        region: null,
        color: 'rouge',
        grapeVarieties: [],
        appellation: null,
      },
      2026,
    );

    const text = content as string;
    expect(text).toContain('même si la fenêtre est déjà passée');
    expect(text).toContain('vin de collection');
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
    region: 'Bordeaux',
    grapeVarieties: ['Niellucciu', 'Syrah'],
    appellation: 'Patrimonio',
  };

  const emptyBottleRef = { id: '', category: 'wine' as const, drinkFrom: null, drinkUntil: null, region: null, details: {} };

  it('écrit les champs IA, la fenêtre de garde, la région, les cépages et l’appellation quand ils sont vides', async () => {
    const { db, bottleId } = await setupBottle();
    const before = await getBottle(db, bottleId);
    expect(before?.drinkFrom).toBeNull();
    expect(before?.drinkUntil).toBeNull();
    expect(before?.region).toBeNull();

    await saveBottleAiAnalysis(db, { ...emptyBottleRef, id: bottleId }, analysis);

    const after = await getBottle(db, bottleId);
    expect(after?.aiAnalysis).toBe(analysis.analysis);
    expect(after?.aiPairings).toEqual(analysis.pairings);
    expect(after?.aiTastingAdvice).toBe(analysis.tastingAdvice);
    expect(after?.aiGeneratedAt).toBeTruthy();
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
    expect(after?.region).toBe('Bordeaux');
    expect(after?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });

  it('n’écrase pas une fenêtre de garde, une région, des cépages ou une appellation déjà renseignés', async () => {
    const { db, bottleId } = await setupBottle();
    const existingDetails = { grapeVarieties: ['Merlot'], appellation: 'Saint-Émilion' };
    await db
      .update(bottles)
      .set({ drinkFrom: 2020, drinkUntil: 2024, region: 'Bourgogne', details: existingDetails })
      .where(eq(bottles.id, bottleId));

    await saveBottleAiAnalysis(
      db,
      { id: bottleId, category: 'wine', drinkFrom: 2020, drinkUntil: 2024, region: 'Bourgogne', details: existingDetails },
      analysis,
    );

    const after = await getBottle(db, bottleId);
    expect(after?.drinkFrom).toBe(2020);
    expect(after?.drinkUntil).toBe(2024);
    expect(after?.region).toBe('Bourgogne');
    expect(after?.details).toEqual(existingDetails);
    // Les champs IA eux sont toujours écrasés, y compris à la régénération.
    expect(after?.aiAnalysis).toBe(analysis.analysis);
  });

  it('remplace le contenu IA précédent lors d’une régénération', async () => {
    const { db, bottleId } = await setupBottle();
    await saveBottleAiAnalysis(db, { ...emptyBottleRef, id: bottleId }, analysis);

    const secondAnalysis = {
      ...analysis,
      analysis: 'Nouvelle analyse.',
      pairings: ['Volaille', 'Poisson', 'Fromage'],
      drinkFromYear: 2035,
      drinkUntilYear: 2040,
      region: 'Alsace',
      grapeVarieties: ['Grenache'],
      appellation: 'Châteauneuf-du-Pape',
    };
    await saveBottleAiAnalysis(
      db,
      {
        id: bottleId,
        category: 'wine',
        drinkFrom: 2027,
        drinkUntil: 2032,
        region: 'Bordeaux',
        details: { grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' },
      },
      secondAnalysis,
    );

    const after = await getBottle(db, bottleId);
    expect(after?.aiAnalysis).toBe('Nouvelle analyse.');
    expect(after?.aiPairings).toEqual(['Volaille', 'Poisson', 'Fromage']);
    // La garde, la région, les cépages et l'appellation étaient déjà remplis par le premier appel : pas réécrasés par le second.
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
    expect(after?.region).toBe('Bordeaux');
    expect(after?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });
});
