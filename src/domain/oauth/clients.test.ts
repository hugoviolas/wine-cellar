import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../../db/testDb';
import { firstRow } from '../../db/testRows';
import { oauthClients } from '../../db/schema';
import { hashToken } from '../token';
import { authenticateClient, parseClientRegistration } from './clients';
import { OAuthError } from './oauthError';
import { TEST_REDIRECT_URI, registerTestClient } from './oauthTestSupport';

const expectOAuthError = (work: () => unknown, code: string): void => {
  try {
    work();
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(OAuthError);
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`OAuthError ${code} attendue`);
};

describe('parseClientRegistration', () => {
  it('accepte une inscription claude.ai et ignore les champs inconnus', () => {
    const input = parseClientRegistration({
      redirect_uris: [TEST_REDIRECT_URI],
      client_name: 'Claude',
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      logo_uri: 'https://claude.ai/logo.png',
    });

    expect(input).toEqual({
      redirectUris: [TEST_REDIRECT_URI],
      clientName: 'Claude',
      tokenEndpointAuthMethod: 'none',
    });
  });

  it('applique client_secret_basic par défaut, comme le veut la RFC 7591', () => {
    expect(parseClientRegistration({ redirect_uris: [TEST_REDIRECT_URI] }).tokenEndpointAuthMethod).toBe(
      'client_secret_basic',
    );
  });

  it('refuse une adresse de retour hors liste', () => {
    expectOAuthError(
      () => parseClientRegistration({ redirect_uris: [TEST_REDIRECT_URI, 'https://evil.example.com/cb'] }),
      'invalid_redirect_uri',
    );
  });

  it('refuse un flux non pris en charge', () => {
    expectOAuthError(
      () =>
        parseClientRegistration({ redirect_uris: [TEST_REDIRECT_URI], grant_types: ['client_credentials'] }),
      'invalid_client_metadata',
    );
  });

  it('refuse un document sans adresse de retour', () => {
    expectOAuthError(() => parseClientRegistration({ client_name: 'x' }), 'invalid_client_metadata');
  });
});

describe('registerClient / authenticateClient', () => {
  it("ne remet pas de secret à un client public, et l'authentifie sur son seul identifiant", async () => {
    const db = await createTestDb();
    const client = await registerTestClient(db, 'none');

    expect(client.client_secret).toBeUndefined();
    const authenticated = await authenticateClient({
      db,
      credentials: { clientId: client.client_id, clientSecret: null },
    });
    expect(authenticated.id).toBe(client.client_id);
  });

  it("remet un secret à un client confidentiel et n'en stocke que l'empreinte", async () => {
    const db = await createTestDb();
    const client = await registerTestClient(db, 'client_secret_post');
    const secret = client.client_secret ?? '';

    const row = firstRow(await db.select().from(oauthClients).where(eq(oauthClients.id, client.client_id)));
    expect(secret).toHaveLength(64);
    expect(row.clientSecretHash).toBe(hashToken(secret));
    const authenticated = await authenticateClient({
      db,
      credentials: { clientId: client.client_id, clientSecret: secret },
    });
    expect(authenticated.id).toBe(client.client_id);
  });

  it.each([
    ['sans secret', null],
    ['avec un secret faux', 'faux'],
  ])('refuse un client confidentiel %s', async (_label, clientSecret) => {
    const db = await createTestDb();
    const client = await registerTestClient(db, 'client_secret_basic');

    await expect(
      authenticateClient({ db, credentials: { clientId: client.client_id, clientSecret } }),
    ).rejects.toMatchObject({ code: 'invalid_client' });
  });

  it('refuse un client inconnu', async () => {
    const db = await createTestDb();

    await expect(
      authenticateClient({ db, credentials: { clientId: 'inconnu', clientSecret: null } }),
    ).rejects.toMatchObject({ code: 'invalid_client' });
  });

  it("purge à l'enregistrement les clients restés sans jeton depuis plus d'un jour", async () => {
    const db = await createTestDb();
    const stale = await registerTestClient(db);
    await db
      .update(oauthClients)
      .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() })
      .where(eq(oauthClients.id, stale.client_id));

    const fresh = await registerTestClient(db);

    const ids = (await db.select({ id: oauthClients.id }).from(oauthClients)).map((row) => row.id);
    expect(ids).toEqual([fresh.client_id]);
  });
});
