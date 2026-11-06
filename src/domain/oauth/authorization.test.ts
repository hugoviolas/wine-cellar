import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../db/testDb';
import { firstRow } from '../../db/testRows';
import { oauthCodes } from '../../db/schema';
import type { Db } from '../../db/client';
import { hashToken } from '../token';
import { checkAuthorizationRequest, issueAuthorizationCode } from './authorization';
import {
  TEST_REDIRECT_URI,
  TEST_RESOURCE_URL,
  createPkcePair,
  insertTestUser,
  registerTestClient,
} from './oauthTestSupport';

const validParams = async (db: Db): Promise<Record<string, string>> => {
  const client = await registerTestClient(db);
  return {
    client_id: client.client_id,
    redirect_uri: TEST_REDIRECT_URI,
    response_type: 'code',
    code_challenge: createPkcePair().challenge,
    code_challenge_method: 'S256',
    state: 'etat',
    resource: TEST_RESOURCE_URL,
  };
};

const check = async (
  db: Db,
  params: Record<string, string>,
): ReturnType<typeof checkAuthorizationRequest> => {
  return checkAuthorizationRequest({ db, params, resourceUrl: TEST_RESOURCE_URL });
};

describe('checkAuthorizationRequest', () => {
  it('accepte une demande complète', async () => {
    const db = await createTestDb();
    const params = await validParams(db);

    const result = await check(db, params);

    expect(result).toMatchObject({
      status: 'ok',
      request: {
        clientId: params.client_id,
        clientName: 'Claude',
        redirectUri: TEST_REDIRECT_URI,
        state: 'etat',
      },
    });
  });

  it("prend l'unique adresse enregistrée quand la demande n'en donne pas", async () => {
    const db = await createTestDb();
    const params = await validParams(db);
    delete params.redirect_uri;

    expect(await check(db, params)).toMatchObject({
      status: 'ok',
      request: { redirectUri: TEST_REDIRECT_URI },
    });
  });

  it('accepte la ressource avec une barre finale', async () => {
    const db = await createTestDb();
    const params = await validParams(db);

    expect((await check(db, { ...params, resource: `${TEST_RESOURCE_URL}/` })).status).toBe('ok');
  });

  it('affiche une erreur, sans rediriger, pour un client inconnu', async () => {
    const db = await createTestDb();
    const params = await validParams(db);

    expect((await check(db, { ...params, client_id: 'inconnu' })).status).toBe('invalid');
  });

  it('affiche une erreur, sans rediriger, pour une adresse de retour non enregistrée', async () => {
    const db = await createTestDb();
    const params = await validParams(db);

    const result = await check(db, { ...params, redirect_uri: 'https://claude.ai/autre' });

    expect(result.status).toBe('invalid');
  });

  it.each([
    ['response_type différent de code', { response_type: 'token' }, 'unsupported_response_type'],
    ['PKCE en plain', { code_challenge_method: 'plain' }, 'invalid_request'],
    ['code_challenge mal formé', { code_challenge: 'court' }, 'invalid_request'],
    ['une autre ressource', { resource: 'https://ailleurs.example.com/mcp' }, 'invalid_target'],
  ])("renvoie l'erreur au client pour %s", async (_label, override, error) => {
    const db = await createTestDb();
    const params = await validParams(db);

    const result = await check(db, { ...params, ...override });

    if (result.status !== 'redirect_error') {
      throw new Error(`redirect_error attendu, reçu ${result.status}`);
    }
    const redirect = new URL(result.redirectUrl);
    expect(`${redirect.origin}${redirect.pathname}`).toBe(TEST_REDIRECT_URI);
    expect(redirect.searchParams.get('error')).toBe(error);
    expect(redirect.searchParams.get('state')).toBe('etat');
  });

  it('refuse une demande sans PKCE', async () => {
    const db = await createTestDb();
    const params = await validParams(db);
    delete params.code_challenge;

    expect((await check(db, params)).status).toBe('redirect_error');
  });
});

describe('issueAuthorizationCode', () => {
  it("renvoie le code et l'état sur l'adresse de retour, et n'en stocke que l'empreinte", async () => {
    const db = await createTestDb();
    const userId = await insertTestUser(db);
    const result = await check(db, await validParams(db));
    if (result.status !== 'ok') {
      throw new Error('demande valide attendue');
    }

    const redirect = new URL(await issueAuthorizationCode({ db, request: result.request, userId }));

    const code = redirect.searchParams.get('code') ?? '';
    expect(redirect.searchParams.get('state')).toBe('etat');
    const row = firstRow(
      await db
        .select()
        .from(oauthCodes)
        .where(eq(oauthCodes.codeHash, hashToken(code))),
    );
    expect(row.userId).toBe(userId);
  });
});
