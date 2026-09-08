import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { resolveViewedCellarId } from './viewedCellar';

describe('resolveViewedCellarId', () => {
  it('utilise le cellarId demandé quand l’utilisateur y a accès', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Cave',
    });

    expect(await resolveViewedCellarId(db, userId, cellarId)).toBe(cellarId);
  });

  it('un super-admin peut demander n’importe quelle cave, même sans en être membre', async () => {
    const db = await createTestDb();
    const { userId: adminId } = await bootstrapSuperAdmin(db, {
      email: 'admin@example.com',
      password: 'x',
      cellarName: 'Cave admin',
    });
    const otherUserId = await createUserAccount(db, 'other@example.com', 'x');
    const other = await bootstrapSuperAdmin(db, { email: 'x2@example.com', password: 'x', cellarName: 'Autre cave' });
    void otherUserId;

    expect(await resolveViewedCellarId(db, adminId, other.cellarId)).toBe(other.cellarId);
  });

  it('ignore silencieusement un cellarId demandé sans y avoir accès, et retombe sur le premier membership', async () => {
    const db = await createTestDb();
    const { cellarId: ownCellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave A',
    });
    const outsiderId = await createUserAccount(db, 'outsider@example.com', 'x');

    expect(await resolveViewedCellarId(db, outsiderId, ownCellarId)).toBeNull();
  });

  it('retombe sur le premier membership quand aucun cellarId n’est demandé', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, {
      email: 'a@example.com',
      password: 'x',
      cellarName: 'Cave A',
    });

    expect(await resolveViewedCellarId(db, userId, undefined)).toBe(cellarId);
  });

  it('retourne null quand l’utilisateur n’a aucun membership et n’a rien demandé', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount(db, 'nobody@example.com', 'x');

    expect(await resolveViewedCellarId(db, userId, undefined)).toBeNull();
  });
});
