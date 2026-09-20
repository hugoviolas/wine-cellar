import { describe, it, expect } from 'vitest';
import {
  aiBottleAnalysisSchema,
  aiPhotoExtractionSchema,
  extractFromPhotoRequestSchema,
  wishlistExtractFromPhotoRequestSchema,
} from './schemas';
import { parseAiPriceEstimate } from './priceEstimate';

describe('aiBottleAnalysisSchema', () => {
  const valid = {
    analysis: 'Un vin structuré avec de beaux tanins.',
    pairings: ['Bœuf braisé', 'Fromages affinés', 'Gibier'],
    tastingAdvice: 'Servir à 16-18°C, carafer 1h avant dégustation.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
    region: 'Bordeaux',
    subRegion: 'Haut-Médoc',
    grapeVarieties: ['Cabernet Sauvignon', 'Merlot'],
    appellation: 'Margaux',
  };

  it('accepte une réponse conforme', () => {
    expect(aiBottleAnalysisSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte drinkFromYear, drinkUntilYear, region, grapeVarieties et appellation nuls', () => {
    const result = aiBottleAnalysisSchema.safeParse({
      ...valid,
      drinkFromYear: null,
      drinkUntilYear: null,
      region: null,
      subRegion: null,
      grapeVarieties: null,
      appellation: null,
    });
    expect(result.success).toBe(true);
  });

  it('refuse moins de 3 accords', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...valid, pairings: ['Bœuf', 'Fromage'] });
    expect(result.success).toBe(false);
  });

  it('refuse plus de 5 accords', () => {
    const result = aiBottleAnalysisSchema.safeParse({
      ...valid,
      pairings: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.success).toBe(false);
  });

  it('refuse une analyse vide', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...valid, analysis: '' });
    expect(result.success).toBe(false);
  });

  it('refuse un champ manquant', () => {
    const incomplete = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== 'tastingAdvice'));
    expect(aiBottleAnalysisSchema.safeParse(incomplete).success).toBe(false);
  });
});

describe('aiBottleAnalysisSchema — priceEstimate', () => {
  const analysis = {
    analysis: 'Un vin structuré avec de beaux tanins.',
    pairings: ['Bœuf braisé', 'Fromages affinés', 'Gibier'],
    tastingAdvice: 'Servir à 16-18°C.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
    region: 'Bordeaux',
    subRegion: 'Haut-Médoc',
    grapeVarieties: ['Merlot'],
    appellation: 'Margaux',
  };
  const price = {
    lowEur: 24.5,
    highEur: 31,
    note: 'Millésime 2015, bouteille de 75 cl.',
    sources: [
      { label: 'Caviste A', url: 'https://caviste-a.fr/vin' },
      { label: 'Caviste B', url: 'https://caviste-b.fr/vin' },
    ],
  };

  it('accepte une estimation sourcée', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...analysis, priceEstimate: price });
    expect(result.success).toBe(true);
    expect(result.data?.priceEstimate?.lowEur).toBe(24.5);
  });

  it('accepte un prix absent ou nul — le modèle n’a rien trouvé', () => {
    expect(aiBottleAnalysisSchema.safeParse(analysis).data?.priceEstimate ?? null).toBeNull();
    expect(
      aiBottleAnalysisSchema.safeParse({ ...analysis, priceEstimate: null }).data?.priceEstimate,
    ).toBeNull();
  });

  it('dégrade en « pas de prix » plutôt que de faire échouer l’analyse', () => {
    // Une seule source, une fourchette inversée, une URL non http : dans les
    // trois cas l'analyse reste valide et c'est seulement le prix qui saute.
    const cases = [
      { ...price, sources: [price.sources[0]] },
      { ...price, lowEur: 40 },
      { ...price, sources: [{ label: 'X', url: 'javascript:alert(1)' }, price.sources[1]] },
    ];
    for (const priceEstimate of cases) {
      const result = aiBottleAnalysisSchema.safeParse({ ...analysis, priceEstimate });
      expect(result.success).toBe(true);
      expect(result.data?.priceEstimate ?? null).toBeNull();
    }
  });
});

describe('parseAiPriceEstimate', () => {
  it('relit une estimation écrite en base', () => {
    const stored = {
      lowEur: 20,
      highEur: 25,
      note: null,
      sources: [
        { label: 'A', url: 'https://a.fr' },
        { label: 'B', url: 'https://b.fr' },
      ],
    };
    expect(parseAiPriceEstimate(stored)).toEqual(stored);
  });

  it('rend null sur une valeur inattendue plutôt que de planter la fiche', () => {
    expect(parseAiPriceEstimate(null)).toBeNull();
    expect(parseAiPriceEstimate('20 €')).toBeNull();
    expect(parseAiPriceEstimate({ lowEur: 20 })).toBeNull();
  });
});

describe('aiPhotoExtractionSchema', () => {
  const valid = {
    name: 'Château Margaux',
    producer: 'Château Margaux',
    vintage: 2018,
    category: 'wine' as const,
    color: 'rouge' as const,
    region: 'Bordeaux',
    subRegion: 'Haut-Médoc',
    grapeVarieties: ['Cabernet Sauvignon', 'Merlot'],
    appellation: 'Margaux',
  };

  it('accepte une réponse conforme', () => {
    expect(aiPhotoExtractionSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte tous les champs à null (photo peu lisible)', () => {
    const allNull = {
      name: null,
      producer: null,
      vintage: null,
      category: null,
      color: null,
      region: null,
      subRegion: null,
      grapeVarieties: null,
      appellation: null,
    };
    expect(aiPhotoExtractionSchema.safeParse(allNull).success).toBe(true);
  });

  it('refuse une catégorie hors énumération', () => {
    const result = aiPhotoExtractionSchema.safeParse({ ...valid, category: 'digestif' });
    expect(result.success).toBe(false);
  });

  it('refuse une couleur hors énumération', () => {
    const result = aiPhotoExtractionSchema.safeParse({ ...valid, color: 'orange' });
    expect(result.success).toBe(false);
  });
});

describe('extractFromPhotoRequestSchema', () => {
  const valid = { cellarId: 'cellar-1', imageBase64: 'AAAA', mediaType: 'image/jpeg' as const };

  it('accepte un corps conforme', () => {
    expect(extractFromPhotoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse un mediaType non supporté', () => {
    const result = extractFromPhotoRequestSchema.safeParse({ ...valid, mediaType: 'image/heic' });
    expect(result.success).toBe(false);
  });

  it('refuse un champ supplémentaire (.strict())', () => {
    const result = extractFromPhotoRequestSchema.safeParse({ ...valid, extra: 'nope' });
    expect(result.success).toBe(false);
  });

  it('refuse un imageBase64 vide', () => {
    const result = extractFromPhotoRequestSchema.safeParse({ ...valid, imageBase64: '' });
    expect(result.success).toBe(false);
  });
});

describe('wishlistExtractFromPhotoRequestSchema', () => {
  const valid = { imageBase64: 'AAAA', mediaType: 'image/jpeg' as const };

  it('accepte un corps conforme (sans cellarId)', () => {
    expect(wishlistExtractFromPhotoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse un cellarId (n'a pas sa place ici)", () => {
    const result = wishlistExtractFromPhotoRequestSchema.safeParse({ ...valid, cellarId: 'x' });
    expect(result.success).toBe(false);
  });

  it('refuse un imageBase64 vide', () => {
    expect(wishlistExtractFromPhotoRequestSchema.safeParse({ ...valid, imageBase64: '' }).success).toBe(
      false,
    );
  });
});
