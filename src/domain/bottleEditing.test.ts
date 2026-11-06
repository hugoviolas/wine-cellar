import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createCrate } from './crates';
import { checkCrateMove, isPersonalBottlePatch } from './bottleEditing';

describe('isPersonalBottlePatch', () => {
  it('reconnaît un patch limité à la note personnelle et à la note sur 5', () => {
    expect(isPersonalBottlePatch(['userNote'])).toBe(true);
    expect(isPersonalBottlePatch(['userNote', 'rating'])).toBe(true);
    expect(isPersonalBottlePatch(['rating', 'quantity'])).toBe(false);
  });
});

describe('checkCrateMove', () => {
  it("n'autorise le déplacement qu'à l'intérieur de la même cave", async () => {
    const db = await createTestDb();
    const first = await bootstrapSuperAdmin({
      db,
      params: { email: 'a@example.com', password: 'x', cellarName: 'A' },
    });
    const second = await bootstrapSuperAdmin({
      db,
      params: { email: 'b@example.com', password: 'x', cellarName: 'B' },
    });
    const from = await createCrate({ db, input: { cellarId: first.cellarId, capacity: 6 } });
    const sameCellar = await createCrate({ db, input: { cellarId: first.cellarId, capacity: 6 } });
    const otherCellar = await createCrate({ db, input: { cellarId: second.cellarId, capacity: 6 } });

    expect(await checkCrateMove({ db, fromCrateId: from, toCrateId: sameCellar })).toBe('ok');
    expect(await checkCrateMove({ db, fromCrateId: from, toCrateId: otherCellar })).toBe('other_cellar');
    expect(await checkCrateMove({ db, fromCrateId: from, toCrateId: 'inconnue' })).toBe('target_not_found');
  });
});
