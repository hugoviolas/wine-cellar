import { describe, it, expect } from 'vitest';
import { factLine, factValue } from './stringArray';

describe('factLine', () => {
  it('joint les valeurs présentes par un point médian', () => {
    expect(factLine(['Domaine X', 2015, 'Note 4/5'])).toBe('Domaine X · 2015 · Note 4/5');
  });

  it('ignore null, undefined et chaîne vide sans laisser de séparateur orphelin', () => {
    expect(factLine(['Domaine X', null, undefined, ''])).toBe('Domaine X');
  });

  it('renvoie une chaîne vide quand rien n’est renseigné', () => {
    expect(factLine([null, undefined, ''])).toBe('');
  });

  it('garde le zéro numérique, qui est une valeur et non un vide', () => {
    expect(factLine([0, 'ml'])).toBe('0 · ml');
  });
});

describe('factValue', () => {
  it('rend la valeur telle quelle quand elle est renseignée', () => {
    expect(factValue('Rhône')).toBe('Rhône');
    expect(factValue(2021)).toBe('2021');
  });

  it('renvoie null pour null, undefined, vide ou blanc', () => {
    expect(factValue(null)).toBeNull();
    expect(factValue(undefined)).toBeNull();
    expect(factValue('')).toBeNull();
    expect(factValue('   ')).toBeNull();
  });

  it('garde le zéro numérique, qui est une valeur et non un vide', () => {
    expect(factValue(0)).toBe('0');
  });
});
