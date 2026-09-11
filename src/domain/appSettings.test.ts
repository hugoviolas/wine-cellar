import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db/testDb';
import { getAppSettings, setRegistrationEnabled } from './appSettings';

describe('getAppSettings', () => {
  it('retourne des valeurs par défaut si aucune ligne n\'existe encore', async () => {
    const db = await createTestDb();
    const settings = await getAppSettings(db);
    expect(settings.registrationEnabled).toBe(true);
  });

  it('retourne la ligne existante si déjà initialisée', async () => {
    const db = await createTestDb();
    await getAppSettings(db);
    await setRegistrationEnabled(db, false);
    expect((await getAppSettings(db)).registrationEnabled).toBe(false);
  });
});

describe('setRegistrationEnabled', () => {
  it('met à jour le réglage même si aucune ligne n\'existait avant', async () => {
    const db = await createTestDb();
    await setRegistrationEnabled(db, false);
    expect((await getAppSettings(db)).registrationEnabled).toBe(false);
  });
});
