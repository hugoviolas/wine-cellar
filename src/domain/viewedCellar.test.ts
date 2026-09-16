import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { bootstrapSuperAdmin } from './bootstrap';
import { createUserAccount } from './accounts';
import { resolveViewedCellarId } from './viewedCellar';

describe('resolveViewedCellarId', () => {
  it('utilise le cellarId demandé quand l’utilisateur y a accès', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'admin@example.com',
        password: 'x',
        cellarName: 'Cave',
      },
    });

    expect(await resolveViewedCellarId({ db, userId, requestedCellarId: cellarId })).toBe(cellarId);
  });

  it('un super-admin peut demander n’importe quelle cave, même sans en être membre', async () => {
    const db = await createTestDb();
    const { userId: adminId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'admin@example.com',
        password: 'x',
        cellarName: 'Cave admin',
      },
    });
    const otherUserId = await createUserAccount({ db, email: 'other@example.com', password: 'x' });
    const other = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'x2@example.com',
        password: 'x',
        cellarName: 'Autre cave',
      },
    });
    void otherUserId;

    expect(await resolveViewedCellarId({ db, userId: adminId, requestedCellarId: other.cellarId })).toBe(
      other.cellarId,
    );
  });

  it('ignore silencieusement un cellarId demandé sans y avoir accès, et retombe sur le premier membership', async () => {
    const db = await createTestDb();
    const { cellarId: ownCellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave A',
      },
    });
    const outsiderId = await createUserAccount({ db, email: 'outsider@example.com', password: 'x' });

    expect(
      await resolveViewedCellarId({ db, userId: outsiderId, requestedCellarId: ownCellarId }),
    ).toBeNull();
  });

  it('retombe sur le premier membership quand aucun cellarId n’est demandé', async () => {
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin({
      db,
      params: {
        email: 'a@example.com',
        password: 'x',
        cellarName: 'Cave A',
      },
    });

    expect(await resolveViewedCellarId({ db, userId, requestedCellarId: undefined })).toBe(cellarId);
  });

  it('retourne null quand l’utilisateur n’a aucun membership et n’a rien demandé', async () => {
    const db = await createTestDb();
    const userId = await createUserAccount({ db, email: 'nobody@example.com', password: 'x' });

    expect(await resolveViewedCellarId({ db, userId, requestedCellarId: undefined })).toBeNull();
  });
});
