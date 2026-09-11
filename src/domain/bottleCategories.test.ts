import { describe, it, expect } from 'vitest';
import { parseBottleDetails, getGrapeVarieties, getAppellation } from './bottleCategories';

describe('parseBottleDetails', () => {
  it('valide des détails de vin corrects', () => {
    const result = parseBottleDetails('wine', {
      grapeVarieties: ['Merlot', 'Cabernet Franc'],
      appellation: 'Saint-Émilion',
    });
    expect(result.grapeVarieties).toEqual(['Merlot', 'Cabernet Franc']);
  });

  it('applique une valeur par défaut pour les champs optionnels manquants', () => {
    const result = parseBottleDetails('wine', {});
    expect(result.grapeVarieties).toEqual([]);
  });

  it('valide des détails de cidre corrects', () => {
    const result = parseBottleDetails('cider', {
      appleVarieties: ['Douce Coët Ligné'],
      method: 'fermier',
      sweetness: 'brut',
    });
    expect(result.method).toBe('fermier');
  });

  it('rejette une méthode de cidre invalide', () => {
    expect(() => parseBottleDetails('cider', { method: 'industriel' })).toThrow();
  });

  it('valide des détails de bière corrects', () => {
    const result = parseBottleDetails('beer', {
      style: 'IPA',
      ibu: 55,
      ebc: 12,
      fermentation: 'haute',
    });
    expect(result.style).toBe('IPA');
    expect(result.ibu).toBe(55);
    expect(result.fermentation).toBe('haute');
  });

  it('valide des détails d’effervescent corrects', () => {
    const result = parseBottleDetails('sparkling', {
      grapeVarieties: ['Chardonnay', 'Pinot Noir'],
      dosage: 'brut nature',
      method: 'méthode traditionnelle',
      disgorgementDate: '2023-04-15',
    });
    expect(result.grapeVarieties).toEqual(['Chardonnay', 'Pinot Noir']);
    expect(result.dosage).toBe('brut nature');
    expect(result.method).toBe('méthode traditionnelle');
    expect(result.disgorgementDate).toBe('2023-04-15');
  });

  it('valide des détails de spiritueux corrects', () => {
    const result = parseBottleDetails('spirit', { spiritType: 'Whisky', age: 12 });
    expect(result.age).toBe(12);
  });
});

describe('getGrapeVarieties', () => {
  it('lit les cépages pour un vin', () => {
    expect(getGrapeVarieties('wine', { grapeVarieties: ['Niellucciu', 'Syrah'] })).toEqual(['Niellucciu', 'Syrah']);
  });

  it('lit les cépages pour un effervescent', () => {
    expect(getGrapeVarieties('sparkling', { grapeVarieties: ['Chardonnay'] })).toEqual(['Chardonnay']);
  });

  it('renvoie [] pour une catégorie sans cépages', () => {
    expect(getGrapeVarieties('beer', { style: 'IPA' })).toEqual([]);
  });
});

describe('getAppellation', () => {
  it('lit l’appellation pour un vin', () => {
    expect(getAppellation('wine', { appellation: 'Patrimonio' })).toBe('Patrimonio');
  });

  it('renvoie null si absente', () => {
    expect(getAppellation('wine', {})).toBeNull();
  });

  it('renvoie null pour une catégorie sans appellation', () => {
    expect(getAppellation('sparkling', { grapeVarieties: ['Chardonnay'] })).toBeNull();
  });
});
