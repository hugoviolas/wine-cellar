import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits, clientKeyFromHeaders } from './rateLimit';

const rule = { limit: 3, windowMs: 60_000 };

describe('checkRateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('autorise jusqu’à la limite puis refuse', () => {
    const now = 1_000_000;
    expect(checkRateLimit('a', rule, now).allowed).toBe(true);
    expect(checkRateLimit('a', rule, now).allowed).toBe(true);
    expect(checkRateLimit('a', rule, now).allowed).toBe(true);
    const refused = checkRateLimit('a', rule, now);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(60);
  });

  it('compte chaque clé séparément', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit('a', rule, now);
    expect(checkRateLimit('a', rule, now).allowed).toBe(false);
    expect(checkRateLimit('b', rule, now).allowed).toBe(true);
  });

  it('repart à zéro une fois la fenêtre passée', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) checkRateLimit('a', rule, now);
    expect(checkRateLimit('a', rule, now).allowed).toBe(false);
    expect(checkRateLimit('a', rule, now + rule.windowMs + 1).allowed).toBe(true);
  });

  it('décompte le temps restant au fur et à mesure', () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) checkRateLimit('a', rule, now);
    expect(checkRateLimit('a', rule, now + 30_000).retryAfterSeconds).toBe(30);
  });
});

describe('clientKeyFromHeaders', () => {
  it('préfère cf-connecting-ip, non usurpable derrière le tunnel', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': '10.0.0.1' });
    expect(clientKeyFromHeaders(headers)).toBe('203.0.113.5');
  });

  it('retombe sur la première entrée de x-forwarded-for', () => {
    expect(clientKeyFromHeaders(new Headers({ 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }))).toBe('10.0.0.1');
  });

  it('retombe sur une clé partagée sans en-tête d’origine', () => {
    expect(clientKeyFromHeaders(new Headers())).toBe('unknown');
  });
});
