import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../db/testDb';
import { bootstrapSuperAdmin } from '../bootstrap';
import { createCrate } from '../crates';
import { createBottle, getBottle } from '../bottles';
import { bottles } from '../../db/schema';
import { buildBottleAnalysisPrompt, saveBottleAiAnalysis } from './bottleAnalysis';
import { saveBottlePriceEstimate } from './bottlePrice';
import type { Db } from '../../db/client';

describe('buildBottleAnalysisPrompt', () => {
  it('inclut les champs de la bouteille dans le prompt', () => {
    const { content } = buildBottleAnalysisPrompt({
      bottle: {
        name: 'Château Margaux',
        producer: 'Château Margaux SA',
        vintage: 2015,
        category: 'wine',
        region: 'Bordeaux',
        subRegion: null,
        color: 'rouge',
        grapeVarieties: ['Cabernet Sauvignon', 'Merlot'],
        appellation: 'Margaux',
      },
      currentYear: 2026,
    });

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
    const { content } = buildBottleAnalysisPrompt({
      bottle: {
        name: 'Cidre mystère',
        producer: null,
        vintage: null,
        category: 'cider',
        region: null,
        subRegion: null,
        color: null,
        grapeVarieties: [],
        appellation: null,
      },
      currentYear: 2026,
    });

    const text = content as string;
    expect(text).toContain('Cidre mystère');
    expect(text).toContain('Producteur : inconnu');
    expect(text).toContain('Région : inconnue');
    expect(text).toContain('Couleur : inconnue');
    expect(text).toContain('Cépages connus : inconnus');
    expect(text).toContain('Appellation connue : inconnue');
  });

  it('demande une estimation best-effort même pour un vin ancien probablement en fin de vie', () => {
    const { content } = buildBottleAnalysisPrompt({
      bottle: {
        name: 'Côtes du Rhône',
        producer: null,
        vintage: 1998,
        category: 'wine',
        region: null,
        subRegion: null,
        color: 'rouge',
        grapeVarieties: [],
        appellation: null,
      },
      currentYear: 2026,
    });

    const text = content as string;
    expect(text).toContain('même si la fenêtre est déjà passée');
    expect(text).toContain('vin de collection');
  });
});

interface SetupBottleResult {
  db: Db;
  bottleId: string;
}

describe('saveBottleAiAnalysis', () => {
  const setupBottle = async (): Promise<SetupBottleResult> => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'admin@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });
    const crateId = await createCrate({ db, input: { cellarId, name: 'Clayette 1', capacity: 12 } });
    const bottleId = await createBottle({
      db,
      input: {
        crateId,
        category: 'wine',
        name: 'Vin test',
        quantity: 1,
        details: {},
      },
    });
    return { db, bottleId };
  };

  const analysis = {
    analysis: 'Un vin bien structuré.',
    pairings: ['Bœuf', 'Fromage', 'Gibier'],
    tastingAdvice: 'Servir à 16°C.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
    region: 'Corse',
    subRegion: null,
    grapeVarieties: ['Niellucciu', 'Syrah'],
    appellation: 'Patrimonio',
  };

  const emptyBottleRef = {
    id: '',
    category: 'wine' as const,
    drinkFrom: null,
    drinkUntil: null,
    region: null,
    subRegion: null,
    details: {},
  };

  it('ne touche pas à l’estimation de prix, qui a sa propre génération', async () => {
    const { db, bottleId } = await setupBottle();
    const priceEstimate = {
      lowEur: 24.5,
      highEur: 31,
      note: null,
      asOf: '2026-09-20T20:00:00.000Z',
      sources: [
        { label: 'Caviste A', url: 'https://caviste-a.fr/vin' },
        { label: 'Caviste B', url: 'https://caviste-b.fr/vin' },
      ],
    };
    await saveBottlePriceEstimate({
      db,
      bottleId,
      estimate: priceEstimate,
      now: new Date(priceEstimate.asOf),
    });

    await saveBottleAiAnalysis({ db, bottle: { ...emptyBottleRef, id: bottleId }, analysis });

    // Régénérer l'analyse effaçait le prix quand les deux voyageaient
    // ensemble ; séparés, chacun garde sa date et sa durée de vie.
    expect((await getBottle({ db, bottleId }))?.aiPriceEstimate).toEqual(priceEstimate);
  });

  it('écrit les champs IA, la fenêtre de garde, la région, les cépages et l’appellation quand ils sont vides', async () => {
    const { db, bottleId } = await setupBottle();
    const before = await getBottle({ db, bottleId });
    expect(before?.drinkFrom).toBeNull();
    expect(before?.drinkUntil).toBeNull();
    expect(before?.region).toBeNull();

    await saveBottleAiAnalysis({ db, bottle: { ...emptyBottleRef, id: bottleId }, analysis });

    const after = await getBottle({ db, bottleId });
    expect(after?.aiAnalysis).toBe(analysis.analysis);
    expect(after?.aiPairings).toEqual(analysis.pairings);
    expect(after?.aiTastingAdvice).toBe(analysis.tastingAdvice);
    expect(after?.aiGeneratedAt).toBeTruthy();
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
    expect(after?.region).toBe('Corse');
    expect(after?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });

  it('résout la région depuis l’appellation, même contre celle que le modèle a proposée', async () => {
    const { db, bottleId } = await setupBottle();

    // Réponse volontairement incohérente : le modèle annonce Bordeaux alors
    // qu'il donne une appellation corse. L'appellation tranche.
    await saveBottleAiAnalysis({
      db,
      bottle: { ...emptyBottleRef, id: bottleId },
      analysis: { ...analysis, region: 'Bordeaux' },
    });

    const after = await getBottle({ db, bottleId });
    expect(after?.region).toBe('Corse');
  });

  it('n’écrase pas la garde, les cépages ni l’appellation, mais recale la région sur l’appellation', async () => {
    const { db, bottleId } = await setupBottle();
    // Région saisie trop fine, comme un Saint-Émilion rangé en « Bourgogne » :
    // c'est précisément ce que la résolution doit rattraper.
    const existingDetails = { grapeVarieties: ['Merlot'], appellation: 'Saint-Émilion' };
    await db
      .update(bottles)
      .set({ drinkFrom: 2020, drinkUntil: 2024, region: 'Bourgogne', details: existingDetails })
      .where(eq(bottles.id, bottleId));

    await saveBottleAiAnalysis({
      db,
      bottle: {
        id: bottleId,
        category: 'wine',
        drinkFrom: 2020,
        drinkUntil: 2024,
        region: 'Bourgogne',
        subRegion: null,
        details: existingDetails,
      },
      analysis,
    });

    const after = await getBottle({ db, bottleId });
    expect(after?.drinkFrom).toBe(2020);
    expect(after?.drinkUntil).toBe(2024);
    expect(after?.details).toEqual(existingDetails);
    // La région, elle, est résolue et non « remplie » : Saint-Émilion est
    // dans le Libournais, à Bordeaux — pas en Bourgogne.
    expect(after?.region).toBe('Bordeaux');
    expect(after?.subRegion).toBe('Libournais');
    // Les champs IA eux sont toujours écrasés, y compris à la régénération.
    expect(after?.aiAnalysis).toBe(analysis.analysis);
  });

  it('remplace le contenu IA précédent lors d’une régénération', async () => {
    const { db, bottleId } = await setupBottle();
    await saveBottleAiAnalysis({ db, bottle: { ...emptyBottleRef, id: bottleId }, analysis });

    const secondAnalysis = {
      ...analysis,
      analysis: 'Nouvelle analyse.',
      pairings: ['Volaille', 'Poisson', 'Fromage'],
      drinkFromYear: 2035,
      drinkUntilYear: 2040,
      region: 'Rhône',
      subRegion: 'Rhône méridional',
      grapeVarieties: ['Grenache'],
      appellation: 'Châteauneuf-du-Pape',
    };
    await saveBottleAiAnalysis({
      db,
      bottle: {
        id: bottleId,
        category: 'wine',
        drinkFrom: 2027,
        drinkUntil: 2032,
        region: 'Corse',
        subRegion: null,
        details: { grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' },
      },
      analysis: secondAnalysis,
    });

    const after = await getBottle({ db, bottleId });
    expect(after?.aiAnalysis).toBe('Nouvelle analyse.');
    expect(after?.aiPairings).toEqual(['Volaille', 'Poisson', 'Fromage']);
    // La garde, les cépages et l'appellation étaient déjà remplis par le
    // premier appel : pas réécrasés par le second. La région reste Corse
    // parce qu'elle découle de l'appellation stockée (Patrimonio), et non
    // de celle que la seconde réponse propose.
    expect(after?.drinkFrom).toBe(2027);
    expect(after?.drinkUntil).toBe(2032);
    expect(after?.region).toBe('Corse');
    expect(after?.details).toEqual({ grapeVarieties: ['Niellucciu', 'Syrah'], appellation: 'Patrimonio' });
  });
});
