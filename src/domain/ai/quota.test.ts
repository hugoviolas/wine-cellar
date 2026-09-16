import { describe, it, expect, beforeEach } from 'vitest';
import { resetRateLimits } from '@/lib/rateLimit';
import { checkAiQuota } from './quota';

describe('checkAiQuota', () => {
  beforeEach(() => resetRateLimits());

  it('laisse passer un usage normal', () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now })).toBeNull();
    }
  });

  it('refuse au-delà du quota horaire, avec un 429 et un Retry-After', () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i++) {
      checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now });
    }
    const refused = checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now });
    expect(refused).not.toBeNull();
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('compte chaque utilisateur pour lui-même', () => {
    const now = 1_000_000;
    for (let i = 0; i < 21; i++) {
      checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now });
    }
    expect(checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now })).not.toBeNull();
    expect(checkAiQuota({ userId: 'user-2', isSuperAdmin: false, now })).toBeNull();
  });

  it('refuse aussi au-delà du plafond journalier, même étalé sur la journée', () => {
    const start = 1_000_000;
    // 100 appels répartis sur 10 heures : chaque heure reste sous le quota
    // horaire, mais le plafond du jour est atteint.
    for (let hour = 0; hour < 10; hour++) {
      for (let i = 0; i < 10; i++) {
        checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now: start + hour * 3_600_000 });
      }
    }
    expect(
      checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now: start + 10 * 3_600_000 }),
    ).not.toBeNull();
  });

  it('repart à zéro le lendemain', () => {
    const start = 1_000_000;
    for (let hour = 0; hour < 10; hour++) {
      for (let i = 0; i < 10; i++) {
        checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now: start + hour * 3_600_000 });
      }
    }
    expect(checkAiQuota({ userId: 'user-1', isSuperAdmin: false, now: start + 25 * 3_600_000 })).toBeNull();
  });

  it('ne compte jamais un super-admin : la clé API est la sienne', () => {
    const now = 1_000_000;
    for (let i = 0; i < 200; i++) {
      expect(checkAiQuota({ userId: 'admin', isSuperAdmin: true, now })).toBeNull();
    }
  });

  it('ne laisse pas un super-admin consommer le quota d’un autre compte', () => {
    const now = 1_000_000;
    for (let i = 0; i < 200; i++) {
      checkAiQuota({ userId: 'admin', isSuperAdmin: true, now });
    }
    expect(checkAiQuota({ userId: 'admin', isSuperAdmin: false, now })).toBeNull();
  });
});
