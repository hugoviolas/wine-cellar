import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimits, resetRateLimit, clientKeyFromHeaders } from './rateLimit';

const rule = { limit: 3, windowMs: 60_000 };

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('autorise jusqu’à la limite puis refuse', () => {
    const now = 1_000_000;
    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(true);
    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(true);
    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(true);
    const refused = checkRateLimit({ key: 'a', rule, now });
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(60);
  });

  it('compte chaque clé séparément', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: 'a', rule, now });
    }
    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(false);
    expect(checkRateLimit({ key: 'b', rule, now }).allowed).toBe(true);
  });

  it('repart à zéro une fois la fenêtre passée', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) {
      checkRateLimit({ key: 'a', rule, now });
    }
    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(false);
    expect(checkRateLimit({ key: 'a', rule, now: now + rule.windowMs + 1 }).allowed).toBe(true);
  });

  it('décompte le temps restant au fur et à mesure', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) {
      checkRateLimit({ key: 'a', rule, now });
    }
    expect(checkRateLimit({ key: 'a', rule, now: now + 30_000 }).retryAfterSeconds).toBe(30);
  });
});

describe('resetRateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('libère la clé visée sans toucher aux autres', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) {
      checkRateLimit({ key: 'a', rule, now });
      checkRateLimit({ key: 'b', rule, now });
    }
    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(false);

    resetRateLimit('a');

    expect(checkRateLimit({ key: 'a', rule, now }).allowed).toBe(true);
    expect(checkRateLimit({ key: 'b', rule, now }).allowed).toBe(false);
  });
});

describe('clientKeyFromHeaders', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('préfère cf-connecting-ip, non usurpable derrière le tunnel', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': '10.0.0.1' });
    expect(clientKeyFromHeaders(headers)).toBe('203.0.113.5');
  });

  it('ignore x-forwarded-for par défaut : n’importe qui peut le poser lui-même', () => {
    expect(clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }))).toBe('unknown');
  });

  it('lit x-forwarded-for seulement si le déploiement déclare un proxy de confiance', () => {
    vi.stubEnv('TRUST_FORWARDED_FOR', 'true');
    expect(clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }))).toBe('10.0.0.1');
  });

  it('retombe sur une clé partagée sans en-tête d’origine', () => {
    expect(clientKeyFromHeaders(new Headers())).toBe('unknown');
  });
});
