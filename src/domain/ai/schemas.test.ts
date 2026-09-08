import { describe, it, expect } from 'vitest';
import {
  aiBottleAnalysisSchema,
  aiPhotoExtractionSchema,
  extractFromPhotoRequestSchema,
} from './schemas';

describe('aiBottleAnalysisSchema', () => {
  const valid = {
    analysis: 'Un vin structuré avec de beaux tanins.',
    pairings: ['Bœuf braisé', 'Fromages affinés', 'Gibier'],
    tastingAdvice: 'Servir à 16-18°C, carafer 1h avant dégustation.',
    drinkFromYear: 2027,
    drinkUntilYear: 2032,
  };

  it('accepte une réponse conforme', () => {
    expect(aiBottleAnalysisSchema.safeParse(valid).success).toBe(true);
  });

  it('accepte drinkFromYear et drinkUntilYear nuls', () => {
    const result = aiBottleAnalysisSchema.safeParse({ ...valid, drinkFromYear: null, drinkUntilYear: null });
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
    const { tastingAdvice: _omit, ...incomplete } = valid;
    expect(aiBottleAnalysisSchema.safeParse(incomplete).success).toBe(false);
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
