import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const createMock = vi.fn();

/** Le SDK porte ses classes d'erreur sur l'export par défaut : le mock aussi. */
class MockBadRequestError extends Error {}

vi.mock('@anthropic-ai/sdk', () => {
  const client = vi.fn().mockImplementation(function () {
    return { messages: { create: createMock } };
  });
  return { default: Object.assign(client, { BadRequestError: MockBadRequestError }) };
});

const { callClaudeForJson, AiResponseError, WEB_SEARCH_TOOL } = await import('./client');

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
        thinking: { type: 'disabled' },
      }),
    );
  });

  it('parse la réponse même quand un bloc thinking précède le bloc texte', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: 'internal reasoning...' },
        { type: 'text', text: JSON.stringify({ ok: true }) },
      ],
    });

    const result = await callClaudeForJson({ system: 'sys', content: 'hello', schema });

    expect(result).toEqual({ ok: true });
  });

  it('parse le JSON même entouré d’un bloc de code markdown ```json ... ```', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n' + JSON.stringify({ ok: true }) + '\n```' }],
    });

    const result = await callClaudeForJson({ system: 'sys', content: 'hello', schema });

    expect(result).toEqual({ ok: true });
  });

  it('parse le JSON même entouré d’un bloc de code markdown sans langage (``` ... ```)', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: '```\n' + JSON.stringify({ ok: true }) + '\n```' }],
    });

    const result = await callClaudeForJson({ system: 'sys', content: 'hello', schema });

    expect(result).toEqual({ ok: true });
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

  it('joint les outils serveur et relève le plafond de tokens quand on les fournit', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
    });

    await callClaudeForJson({
      system: 'sys',
      content: 'hello',
      schema,
      tools: [WEB_SEARCH_TOOL],
      maxTokens: 4096,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ tools: [WEB_SEARCH_TOOL], max_tokens: 4096 }),
    );
  });

  it('retient le dernier bloc texte, pas le premier — le modèle commente ses recherches avant de conclure', async () => {
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: 'Je cherche le prix de cette bouteille...' },
        { type: 'server_tool_use', name: 'web_search', input: {} },
        { type: 'web_search_tool_result', content: [] },
        { type: 'text', text: JSON.stringify({ ok: true }) },
      ],
    });

    expect(
      await callClaudeForJson({ system: 'sys', content: 'hello', schema, tools: [WEB_SEARCH_TOOL] }),
    ).toEqual({ ok: true });
  });

  it('reprend un tour interrompu par la boucle d’outils serveur (pause_turn)', async () => {
    const paused = [{ type: 'server_tool_use', name: 'web_search', input: {} }];
    createMock.mockResolvedValueOnce({ stop_reason: 'pause_turn', content: paused }).mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
    });

    const result = await callClaudeForJson({
      system: 'sys',
      content: 'hello',
      schema,
      tools: [WEB_SEARCH_TOOL],
    });

    expect(result).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledTimes(2);
    // La reprise renvoie le tour d'assistant en l'état, sans message
    // utilisateur ajouté : l'API repart d'elle-même de la recherche en cours.
    expect(createMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: paused },
        ],
      }),
    );
  });

  it('abandonne si le tour reste en pause indéfiniment', async () => {
    createMock.mockResolvedValue({ stop_reason: 'pause_turn', content: [] });

    await expect(
      callClaudeForJson({ system: 'sys', content: 'hello', schema, tools: [WEB_SEARCH_TOOL] }),
    ).rejects.toThrow(AiResponseError);
  });

  it('rejoue sans outil si la requête outillée est refusée — l’analyse sort, sans prix', async () => {
    createMock
      .mockRejectedValueOnce(new MockBadRequestError('web search not enabled'))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] });

    const result = await callClaudeForJson({
      system: 'sys',
      content: 'hello',
      schema,
      tools: [WEB_SEARCH_TOOL],
    });

    expect(result).toEqual({ ok: true });
    expect(createMock).toHaveBeenCalledTimes(2);
    const [retryArgs] = createMock.mock.calls[1] as [Record<string, unknown>];
    expect(retryArgs.tools).toBeUndefined();
  });

  it('ne rejoue pas une erreur qui n’est pas un refus de la requête', async () => {
    createMock.mockRejectedValue(new Error('rate limited'));

    await expect(
      callClaudeForJson({ system: 'sys', content: 'hello', schema, tools: [WEB_SEARCH_TOOL] }),
    ).rejects.toThrow('rate limited');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('lève une erreur si ANTHROPIC_API_KEY est absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });
});
