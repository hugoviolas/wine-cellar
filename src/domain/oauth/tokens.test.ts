import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { createTestDb } from '../../db/testDb';
import { createDb } from '../../db/client';
import { oauthCodes, oauthTokens, users } from '../../db/schema';
import type { Db } from '../../db/client';
import type { OAuthClientRow } from '../../db/rows';
import { authenticateClient } from './clients';
import { exchangeAuthorizationCode, refreshTokens, revokeToken, verifyAccessToken } from './tokens';
import { authorizeForTest, createPkcePair, insertTestUser, registerTestClient } from './oauthTestSupport';
import type { IssuedTokens } from './interfaces/issued-tokens.interface';

interface Setup {
  db: Db;
  client: OAuthClientRow;
  userId: string;
}

const setup = async (): Promise<Setup> => {
  const db = await createTestDb();
  const userId = await insertTestUser(db);
  const registered = await registerTestClient(db);
  const client = await authenticateClient({
    db,
    credentials: { clientId: registered.client_id, clientSecret: null },
  });
  return { db, client, userId };
};

const connect = async ({ db, client, userId }: Setup): Promise<IssuedTokens> => {
  const pkce = createPkcePair();
  const code = await authorizeForTest({ db, clientId: client.id, userId, pkce });
  return exchangeAuthorizationCode({ db, client, code, codeVerifier: pkce.verifier, redirectUri: null });
};

describe('exchangeAuthorizationCode', () => {
  it("échange un code contre un jeton qui identifie l'utilisateur", async () => {
    const context = await setup();

    const tokens = await connect(context);

    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(30 * 24 * 60 * 60);
    const user = await verifyAccessToken({ db: context.db, token: tokens.access_token });
    expect(user).toEqual({ id: context.userId, email: 'claude@example.com', isSuperAdmin: false });
  });

  it("ne stocke que l'empreinte des jetons", async () => {
    const context = await setup();
    const tokens = await connect(context);

    const stored = (await context.db.select().from(oauthTokens)).map((row) => row.tokenHash);

    expect(stored).not.toContain(tokens.access_token);
    expect(stored).not.toContain(tokens.refresh_token);
  });

  it('refuse un code rejoué', async () => {
    const context = await setup();
    const { db, client, userId } = context;
    const pkce = createPkcePair();
    const code = await authorizeForTest({ db, clientId: client.id, userId, pkce });
    await exchangeAuthorizationCode({ db, client, code, codeVerifier: pkce.verifier, redirectUri: null });

    await expect(
      exchangeAuthorizationCode({ db, client, code, codeVerifier: pkce.verifier, redirectUri: null }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('brûle le code présenté avec un mauvais verifier', async () => {
    const { db, client, userId } = await setup();
    const pkce = createPkcePair();
    const code = await authorizeForTest({ db, clientId: client.id, userId, pkce });

    await expect(
      exchangeAuthorizationCode({
        db,
        client,
        code,
        codeVerifier: createPkcePair().verifier,
        redirectUri: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
    await expect(
      exchangeAuthorizationCode({ db, client, code, codeVerifier: pkce.verifier, redirectUri: null }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it("refuse le code d'un autre client", async () => {
    const { db, client, userId } = await setup();
    const pkce = createPkcePair();
    const code = await authorizeForTest({ db, clientId: client.id, userId, pkce });
    const other = await registerTestClient(db);
    const otherClient = await authenticateClient({
      db,
      credentials: { clientId: other.client_id, clientSecret: null },
    });

    await expect(
      exchangeAuthorizationCode({
        db,
        client: otherClient,
        code,
        codeVerifier: pkce.verifier,
        redirectUri: null,
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('refuse une adresse de retour différente de celle de la demande', async () => {
    const { db, client, userId } = await setup();
    const pkce = createPkcePair();
    const code = await authorizeForTest({ db, clientId: client.id, userId, pkce });

    await expect(
      exchangeAuthorizationCode({
        db,
        client,
        code,
        codeVerifier: pkce.verifier,
        redirectUri: 'https://claude.ai/autre',
      }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('refuse un code expiré', async () => {
    const { db, client, userId } = await setup();
    const pkce = createPkcePair();
    const code = await authorizeForTest({ db, clientId: client.id, userId, pkce });
    await db.update(oauthCodes).set({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    await expect(
      exchangeAuthorizationCode({ db, client, code, codeVerifier: pkce.verifier, redirectUri: null }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

describe('refreshTokens', () => {
  it('remplace la paire : les anciens jetons ne valent plus rien', async () => {
    const context = await setup();
    const { db, client } = context;
    const first = await connect(context);

    const second = await refreshTokens({ db, client, refreshToken: first.refresh_token });

    expect(await verifyAccessToken({ db, token: second.access_token })).not.toBeNull();
    expect(await verifyAccessToken({ db, token: first.access_token })).toBeNull();
    await expect(refreshTokens({ db, client, refreshToken: first.refresh_token })).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it("révoque toute l'autorisation quand un refresh token consommé revient, branche du voleur comprise", async () => {
    const context = await setup();
    const { db, client } = context;
    const stolen = await connect(context);

    // Le voleur renouvelle le premier et obtient sa propre paire…
    const thief = await refreshTokens({ db, client, refreshToken: stolen.refresh_token });
    // …puis le client légitime présente le même refresh token.
    await expect(refreshTokens({ db, client, refreshToken: stolen.refresh_token })).rejects.toMatchObject({
      code: 'invalid_grant',
    });

    expect(await verifyAccessToken({ db, token: thief.access_token })).toBeNull();
    await expect(refreshTokens({ db, client, refreshToken: thief.refresh_token })).rejects.toMatchObject({
      code: 'invalid_grant',
    });
    expect(await db.select().from(oauthTokens)).toEqual([]);
  });

  it("n'émet jamais deux paires pour deux renouvellements simultanés du même jeton", async () => {
    // Sur un vrai fichier : la base en mémoire n'a qu'une connexion, et le
    // second appel y échouerait pour une raison sans rapport avec la règle.
    const db = createDb(`file:${join(mkdtempSync(join(tmpdir(), 'cave-oauth-')), 'cave.db')}`);
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    const userId = await insertTestUser(db);
    const registered = await registerTestClient(db);
    const client = await authenticateClient({
      db,
      credentials: { clientId: registered.client_id, clientSecret: null },
    });
    const tokens = await connect({ db, client, userId });

    const results = await Promise.allSettled([
      refreshTokens({ db, client, refreshToken: tokens.refresh_token }),
      refreshTokens({ db, client, refreshToken: tokens.refresh_token }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it("refuse le refresh token d'un autre client", async () => {
    const context = await setup();
    const tokens = await connect(context);
    const other = await registerTestClient(context.db);
    const otherClient = await authenticateClient({
      db: context.db,
      credentials: { clientId: other.client_id, clientSecret: null },
    });

    await expect(
      refreshTokens({ db: context.db, client: otherClient, refreshToken: tokens.refresh_token }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it("refuse un jeton d'accès présenté comme refresh token", async () => {
    const context = await setup();
    const tokens = await connect(context);

    await expect(
      refreshTokens({ db: context.db, client: context.client, refreshToken: tokens.access_token }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

describe("validité de l'autorisation", () => {
  it('tombe entièrement après une réinitialisation du mot de passe', async () => {
    const context = await setup();
    const { db, client, userId } = context;
    const tokens = await connect(context);

    await db
      .update(users)
      .set({ sessionsValidFrom: new Date(Date.now() + 1000).toISOString() })
      .where(eq(users.id, userId));

    expect(await verifyAccessToken({ db, token: tokens.access_token })).toBeNull();
    await expect(refreshTokens({ db, client, refreshToken: tokens.refresh_token })).rejects.toMatchObject({
      code: 'invalid_grant',
    });
    expect(await db.select().from(oauthTokens)).toEqual([]);
  });

  it('ne vaut plus pour un compte désactivé', async () => {
    const context = await setup();
    const tokens = await connect(context);

    await context.db.update(users).set({ isActive: false }).where(eq(users.id, context.userId));

    expect(await verifyAccessToken({ db: context.db, token: tokens.access_token })).toBeNull();
  });

  it('disparaît avec le compte', async () => {
    const context = await setup();
    await connect(context);

    await context.db.delete(users).where(eq(users.id, context.userId));

    expect(await context.db.select().from(oauthTokens)).toEqual([]);
  });

  it('refuse un jeton expiré', async () => {
    const context = await setup();
    const tokens = await connect(context);

    await context.db.update(oauthTokens).set({ expiresAt: new Date(Date.now() - 1000).toISOString() });

    expect(await verifyAccessToken({ db: context.db, token: tokens.access_token })).toBeNull();
  });
});

describe('revokeToken', () => {
  it("révoque toute l'autorisation, quel que soit le jeton présenté", async () => {
    const context = await setup();
    const tokens = await connect(context);

    await revokeToken({ db: context.db, client: context.client, token: tokens.refresh_token });

    expect(await verifyAccessToken({ db: context.db, token: tokens.access_token })).toBeNull();
  });

  it('ignore la révocation demandée par un autre client', async () => {
    const context = await setup();
    const tokens = await connect(context);
    const other = await registerTestClient(context.db);
    const otherClient = await authenticateClient({
      db: context.db,
      credentials: { clientId: other.client_id, clientSecret: null },
    });

    await revokeToken({ db: context.db, client: otherClient, token: tokens.access_token });

    expect(await verifyAccessToken({ db: context.db, token: tokens.access_token })).not.toBeNull();
  });
});
