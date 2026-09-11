import { describe, it, expect } from 'vitest';
import { canManageCellar, canEditCellarContent } from './permissions';

describe('canManageCellar', () => {
  it('autorise owner et super_admin', () => {
    expect(canManageCellar('owner')).toBe(true);
    expect(canManageCellar('super_admin')).toBe(true);
  });

  it('refuse editor et reader', () => {
    expect(canManageCellar('editor')).toBe(false);
    expect(canManageCellar('reader')).toBe(false);
  });
});

describe('canEditCellarContent', () => {
  it('autorise owner, editor et super_admin', () => {
    expect(canEditCellarContent('owner')).toBe(true);
    expect(canEditCellarContent('editor')).toBe(true);
    expect(canEditCellarContent('super_admin')).toBe(true);
  });

  it('refuse reader', () => {
    expect(canEditCellarContent('reader')).toBe(false);
  });
});
