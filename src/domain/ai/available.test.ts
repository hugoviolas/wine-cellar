import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAiAvailable, isAiAvailableForUser } from './available';
import { createTestDb } from '../../db/testDb';
import { bootstrapSuperAdmin } from '../bootstrap';
import { setCellarAiEnabled } from '../admin';

describe('isAiAvailable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("vrai si la cave a l'IA activée et qu'une clé API est configurée", () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
    expect(isAiAvailable({ aiEnabled: true })).toBe(true);
  });

  it("faux si la cave a désactivé l'IA, même avec une clé configurée", () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
    expect(isAiAvailable({ aiEnabled: false })).toBe(false);
  });

  it("faux si aucune clé API n'est configurée, même si la cave l'autorise", () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(isAiAvailable({ aiEnabled: true })).toBe(false);
  });
});

describe('isAiAvailableForUser', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('vrai si au moins une des caves de l\'utilisateur a l\'IA activée', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    expect(await isAiAvailableForUser(db, userId)).toBe(true);
  });

  it('faux si toutes les caves de l\'utilisateur ont l\'IA désactivée', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
    const db = await createTestDb();
    const { userId, cellarId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });
    await setCellarAiEnabled(db, cellarId, false);

    expect(await isAiAvailableForUser(db, userId)).toBe(false);
  });

  it('faux si aucune clé API configurée, même avec une cave IA activée', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const db = await createTestDb();
    const { userId } = await bootstrapSuperAdmin(db, { email: 'a@example.com', password: 'x', cellarName: 'Cave' });

    expect(await isAiAvailableForUser(db, userId)).toBe(false);
  });
});
