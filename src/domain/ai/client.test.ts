import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { messages: { create: createMock } };
    }),
  };
});

const { callClaudeForJson, AiResponseError } = await import('./client');

describe('callClaudeForJson', () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const schema = z.object({ ok: z.boolean() });

  it('parse et valide une réponse JSON conforme', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
    });

    const result = await callClaudeForJson({ system: 'sys', content: 'hello', schema });

    expect(result).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        system: 'sys',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    );
  });

  it('lève AiResponseError si le texte n’est pas du JSON valide', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'pas du json' }] });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      AiResponseError,
    );
  });

  it('lève AiResponseError si la réponse ne correspond pas au schéma', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: 'pas un booléen' }) }],
    });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      AiResponseError,
    );
  });

  it('lève AiResponseError si la réponse n’a pas de bloc texte', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'image', source: {} }] });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      AiResponseError,
    );
  });

  it('lève une erreur si ANTHROPIC_API_KEY est absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });
});
