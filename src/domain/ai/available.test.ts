import { describe, it, expect, afterEach, vi } from 'vitest';
import { isAiAvailable } from './available';

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
