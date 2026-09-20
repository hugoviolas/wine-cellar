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

const { callClaudeForJson, AiResponseError, AiTimeoutError, WEB_SEARCH_TOOL } = await import('./client');

describe('callClaudeForJson', () => {
  beforeEach(() => {
    createMock.mockReset();
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const schema = z.object({ ok: z.boolean() });

  /**
   * Corps de la n-ième requête. `messages.create` reçoit désormais un
   * second argument (les options, dont le délai calculé sur le budget
   * restant) : on lit donc l'argument voulu plutôt que de comparer
   * l'appel entier.
   */
  const callBody = (index: number): Record<string, unknown> => {
    const call = createMock.mock.calls.at(index) as [Record<string, unknown>, unknown];
    return call[0];
  };

  it('parse et valide une réponse JSON conforme', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
    });

    const result = await callClaudeForJson({ system: 'sys', content: 'hello', schema });

    expect(result).toEqual({ ok: true });
    expect(callBody(0)).toMatchObject({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'hello' }],
      thinking: { type: 'disabled' },
    });
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

  it('recolle une réponse découpée en plusieurs blocs texte (cas de la recherche web)', async () => {
    // Les citations s'attachent bloc par bloc : avec la recherche web, le
    // JSON final arrive couramment en morceaux. Le dernier bloc seul n'est
    // alors que sa fin — c'est ce qui cassait la génération en préprod.
    const json = JSON.stringify({ ok: true });
    const cut = Math.floor(json.length / 2);
    createMock.mockResolvedValue({
      content: [
        { type: 'text', text: json.slice(0, cut) },
        { type: 'text', text: json.slice(cut) },
      ],
    });

    expect(await callClaudeForJson({ system: 'sys', content: 'hello', schema })).toEqual({ ok: true });
  });

  it('extrait le JSON d’un bloc encadré de phrases', async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: `Après vérification chez deux cavistes :\n${JSON.stringify({ ok: true })}\nJ'espère que cela convient.`,
        },
      ],
    });

    expect(await callClaudeForJson({ system: 'sys', content: 'hello', schema })).toEqual({ ok: true });
  });

  it('nomme la troncature plutôt que de la faire passer pour un JSON invalide', async () => {
    createMock.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"ok": tr' }],
    });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(/tronquée/);
  });

  it('joint un extrait de la réponse à l’erreur, pour le log', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Je n’ai pas trouvé de prix fiable pour cette bouteille.' }],
    });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow(
      /Je n’ai pas trouvé de prix fiable/,
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

    expect(callBody(0)).toMatchObject({ tools: [WEB_SEARCH_TOOL], max_tokens: 4096 });
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
    expect(callBody(-1)).toMatchObject({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: paused },
      ],
    });
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

  it('borne l’appel dans le temps plutôt que de laisser la requête traîner', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: '{}' }] });

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema, budgetMs: 0 })).rejects.toThrow(
      AiTimeoutError,
    );
    // Le budget est vérifié avant d'appeler : épuisé, on n'engage pas de
    // requête qu'on ne pourra pas attendre.
    expect(createMock).not.toHaveBeenCalled();
  });

  it('passe le temps restant en délai de requête', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] });

    await callClaudeForJson({ system: 'sys', content: 'hello', schema, budgetMs: 60_000 });

    const [, options] = createMock.mock.calls[0] as [unknown, { timeout: number }];
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.timeout).toBeLessThanOrEqual(60_000);
  });

  it('lève une erreur si ANTHROPIC_API_KEY est absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    await expect(callClaudeForJson({ system: 'sys', content: 'hello', schema })).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });
});
