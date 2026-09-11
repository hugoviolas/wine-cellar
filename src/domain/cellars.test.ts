import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { getCellarById, updateCellarInfo } from './cellars';

describe('getCellarById', () => {
  it('retourne la cave', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Ma Cave' });
    const cellar = await getCellarById(db, cellarId);
    expect(cellar?.name).toBe('Ma Cave');
    expect(cellar?.brand).toBeNull();
    expect(cellar?.model).toBeNull();
    expect(cellar?.notes).toBeNull();
  });

  it('retourne null pour un identifiant inconnu', async () => {
    const db = await createTestDb();
    expect(await getCellarById(db, 'inconnu')).toBeNull();
  });
});

describe('updateCellarInfo', () => {
  it('met à jour la marque, le modèle et les notes', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Ma Cave' });

    await updateCellarInfo(db, cellarId, {
      brand: 'EuroCave',
      model: 'Premiere S',
      notes: 'Cave à double zone, achetée en 2024.',
    });

    const cellar = await getCellarById(db, cellarId);
    expect(cellar?.brand).toBe('EuroCave');
    expect(cellar?.model).toBe('Premiere S');
    expect(cellar?.notes).toBe('Cave à double zone, achetée en 2024.');
  });

  it('efface un champ si une valeur vide est fournie', async () => {
    const db = await createTestDb();
    const { cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Ma Cave' });
    await updateCellarInfo(db, cellarId, { brand: 'EuroCave', model: null, notes: null });

    await updateCellarInfo(db, cellarId, { brand: '', model: null, notes: null });

    const cellar = await getCellarById(db, cellarId);
    expect(cellar?.brand).toBeNull();
  });
});
