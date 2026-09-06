import { describe, it, expect } from 'vitest';
import { parseBottleDetails } from './bottleCategories';

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

  it('valide des détails de spiritueux corrects', () => {
    const result = parseBottleDetails('spirit', { spiritType: 'Whisky', age: 12 });
    expect(result.age).toBe(12);
  });
});
