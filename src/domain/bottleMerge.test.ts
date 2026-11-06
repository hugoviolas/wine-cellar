import { describe, it, expect } from 'vitest';
import { buildLotMergePatch } from './bottleMerge';
import type { BottleRow } from '../db/rows';

const lot = (overrides: Partial<BottleRow>): BottleRow => ({
  id: 'lot',
  crateId: 'crate',
  sortOrder: 0,
  category: 'wine',
  name: 'Château Margaux',
  producer: 'Château Margaux',
  vintage: 2015,
  region: null,
  subRegion: null,
  color: 'red',
  abv: null,
  volumeMl: 750,
  quantity: 1,
  drinkFrom: null,
  drinkUntil: null,
  details: { grapeVarieties: [] },
  aiAnalysis: null,
  aiPairings: null,
  aiTastingAdvice: null,
  aiPriceEstimate: null,
  aiGeneratedAt: null,
  userNote: null,
  rating: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

describe('buildLotMergePatch', () => {
  it('ne change rien quand la cible sait déjà tout', () => {
    const target = lot({
      userNote: 'Note',
      rating: 4,
      drinkFrom: 2025,
      drinkUntil: 2040,
      abv: 13.5,
      region: 'Bordeaux',
      subRegion: 'Haut-Médoc',
      details: { grapeVarieties: ['Merlot'], appellation: 'Margaux' },
      aiGeneratedAt: '2026-05-01T00:00:00.000Z',
    });
    const source = lot({
      rating: 2,
      drinkFrom: 2030,
      abv: 14,
      region: 'Autre',
      details: { grapeVarieties: ['Cabernet Sauvignon'], appellation: 'Pauillac' },
      aiAnalysis: 'Ancienne',
      aiGeneratedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
    });

    expect(buildLotMergePatch({ target, source, absorbsSource: true })).toEqual({});
  });

  it('comble les vides de la cible avec ce que sait la source', () => {
    const source = lot({
      userNote: 'À ouvrir en 2030',
      rating: 5,
      drinkFrom: 2030,
      drinkUntil: 2060,
      abv: 13.5,
      region: 'Bordeaux',
      subRegion: 'Haut-Médoc',
      details: { grapeVarieties: ['Merlot'], appellation: 'Margaux' },
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(buildLotMergePatch({ target: lot({}), source, absorbsSource: false })).toEqual({
      userNote: 'À ouvrir en 2030',
      rating: 5,
      drinkFrom: 2030,
      drinkUntil: 2060,
      abv: 13.5,
      region: 'Bordeaux',
      subRegion: 'Haut-Médoc',
      details: { grapeVarieties: ['Merlot'], appellation: 'Margaux' },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('met deux notes différentes bout à bout seulement si la source disparaît', () => {
    const target = lot({ userNote: 'Cadeau de Paul' });
    const source = lot({ userNote: 'Pour les grandes occasions' });

    expect(buildLotMergePatch({ target, source, absorbsSource: true }).userNote).toBe(
      'Cadeau de Paul\n\nPour les grandes occasions',
    );
    expect(buildLotMergePatch({ target, source, absorbsSource: false }).userNote).toBeUndefined();
    expect(
      buildLotMergePatch({ target, source: lot({ userNote: ' Cadeau de Paul ' }), absorbsSource: true })
        .userNote,
    ).toBeUndefined();
  });

  it('garde l’analyse IA la plus récente, d’un bloc', () => {
    const target = lot({ aiAnalysis: 'Ancienne', aiTastingAdvice: 'Carafer', aiGeneratedAt: '2026-01-01' });
    const source = lot({
      aiAnalysis: 'Récente',
      aiPairings: ['Agneau'],
      aiTastingAdvice: null,
      aiGeneratedAt: '2026-03-01',
    });

    expect(buildLotMergePatch({ target, source, absorbsSource: false })).toMatchObject({
      aiAnalysis: 'Récente',
      aiPairings: ['Agneau'],
      aiTastingAdvice: null,
      aiGeneratedAt: '2026-03-01',
    });
  });

  it('laisse les détails de la cible intacts si ceux de la source sont mal formés', () => {
    const source = lot({ details: { grapeVarieties: 'Merlot' } });

    expect(buildLotMergePatch({ target: lot({}), source, absorbsSource: false }).details).toBeUndefined();
  });
});
