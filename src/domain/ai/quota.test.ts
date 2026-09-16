import { describe, it, expect, beforeEach } from 'vitest';
import { resetRateLimits } from '@/lib/rateLimit';
import { checkAiQuota } from './quota';

describe('checkAiQuota', () => {
  beforeEach(() => resetRateLimits());

  it('laisse passer un usage normal', () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkAiQuota('user-1', now)).toBeNull();
    }
  });

  it('refuse au-delà du quota horaire, avec un 429 et un Retry-After', () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i++) {
      checkAiQuota('user-1', now);
    }
    const refused = checkAiQuota('user-1', now);
    expect(refused).not.toBeNull();
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('compte chaque utilisateur pour lui-même', () => {
    const now = 1_000_000;
    for (let i = 0; i < 21; i++) {
      checkAiQuota('user-1', now);
    }
    expect(checkAiQuota('user-1', now)).not.toBeNull();
    expect(checkAiQuota('user-2', now)).toBeNull();
  });

  it('refuse aussi au-delà du plafond journalier, même étalé sur la journée', () => {
    const start = 1_000_000;
    // 100 appels répartis sur 10 heures : chaque heure reste sous le quota
    // horaire, mais le plafond du jour est atteint.
    for (let hour = 0; hour < 10; hour++) {
      for (let i = 0; i < 10; i++) {
        checkAiQuota('user-1', start + hour * 3_600_000);
      }
    }
    expect(checkAiQuota('user-1', start + 10 * 3_600_000)).not.toBeNull();
  });

  it('repart à zéro le lendemain', () => {
    const start = 1_000_000;
    for (let hour = 0; hour < 10; hour++) {
      for (let i = 0; i < 10; i++) {
        checkAiQuota('user-1', start + hour * 3_600_000);
      }
    }
    expect(checkAiQuota('user-1', start + 25 * 3_600_000)).toBeNull();
  });
});
