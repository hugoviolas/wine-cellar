import { describe, it, expect } from 'vitest';
import { crateLabel } from './crateLabel';

describe('crateLabel', () => {
  it('inclut le nom quand il est renseigné', () => {
    expect(crateLabel({ number: 3, name: 'Rosés' })).toBe('Clayette 3 — Rosés');
  });

  it('n’affiche que « Clayette N » sans nom, sans doublon', () => {
    expect(crateLabel({ number: 3, name: null })).toBe('Clayette 3');
  });
});
