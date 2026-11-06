import { describe, it, expect, beforeAll, vi } from 'vitest';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { db } from '@/db/client';
import { registerSelfServeUser } from '@/domain/accounts';
import { createCrate } from '@/domain/crates';
import { createPkcePair } from '@/domain/oauth/oauthTestSupport';
import { GET as getResourceMetadata } from '@/app/.well-known/oauth-protected-resource/mcp/route';
import { GET as getServerMetadata } from '@/app/.well-known/oauth-authorization-server/route';
import { POST as register } from '@/app/api/oauth/register/route';
import { POST as authorize } from '@/app/api/oauth/authorize/route';
import { POST as token } from '@/app/api/oauth/token/route';
import { POST as revoke } from '@/app/api/oauth/revoke/route';
import { DELETE as mcpDelete, GET as mcpGet, POST as mcpPost } from './route';

/**
 * Parcours complet tel que claude.ai le fait, route par route : 401 sur
 * /mcp, découverte, enregistrement, autorisation avec le compte de la cave,
 * échange du code, appels de tools, renouvellement puis révocation.
 */

const BASE = 'https://cave.example.com';
const REDIRECT_URI = 'https://claude.ai/api/mcp/auth_callback';
const EMAIL = 'hugo@example.com';
const PASSWORD = 'mot-de-passe-solide';

vi.stubEnv('MCP_PUBLIC_URL', BASE);
vi.stubEnv('DATABASE_URL', ':memory:');

const tokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

const initialize = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tests', version: '0' } },
});

const postMcp = (accessToken: string | null): Promise<Response> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (accessToken !== null) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return mcpPost(new Request(`${BASE}/mcp`, { method: 'POST', headers, body: initialize }));
};

const form = (path: string, values: Record<string, string>): Request => {
  return new Request(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values).toString(),
  });
};

/** Client MCP du SDK, branché directement sur les handlers de la route. */
const connectOverHttp = async (accessToken: string): Promise<Client> => {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    fetch: async (input, init): Promise<Response> => {
      const request = new Request(input, init);
      if (request.method === 'POST') {
        return mcpPost(request);
      }
      return request.method === 'DELETE' ? mcpDelete() : mcpGet();
    },
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const client = new Client({ name: 'tests', version: '0' });
  await client.connect(transport);
  return client;
};

describe('connecteur MCP, de bout en bout', () => {
  let cellarId: string;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    ({ cellarId } = await registerSelfServeUser({ db, email: EMAIL, password: PASSWORD }));
    await createCrate({ db, input: { cellarId, name: 'Rouges', capacity: 12 } });
  });

  it('refuse /mcp sans jeton et indique où découvrir le serveur OAuth', async () => {
    const response = await postMcp(null);

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp"`,
    );
    expect(await getResourceMetadata().json()).toEqual({
      resource: `${BASE}/mcp`,
      authorization_servers: [BASE],
      bearer_methods_supported: ['header'],
      resource_name: 'Ma Cave',
    });
    expect(await getServerMetadata().json()).toMatchObject({
      issuer: BASE,
      authorization_endpoint: `${BASE}/oauth/authorize`,
      token_endpoint: `${BASE}/api/oauth/token`,
      registration_endpoint: `${BASE}/api/oauth/register`,
      code_challenge_methods_supported: ['S256'],
    });
  });

  it('refuse un jeton inconnu, avec le code invalid_token', async () => {
    const response = await postMcp('inconnu');

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });

  it("enregistre Claude, l'autorise avec le compte de la cave, puis sert les tools", async () => {
    // Enregistrement dynamique, client confidentiel (secret en client_secret_post).
    const registration = await register(
      new Request(`${BASE}/api/oauth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: 'Claude',
          redirect_uris: [REDIRECT_URI],
          token_endpoint_auth_method: 'client_secret_post',
        }),
      }),
    );
    expect(registration.status).toBe(201);
    const client = z
      .object({ client_id: z.string(), client_secret: z.string() })
      .parse(await registration.json());

    // Autorisation : mauvais mot de passe, puis le bon.
    const pkce = createPkcePair();
    const params = {
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      state: 'etat-claude',
      resource: `${BASE}/mcp`,
    };
    const authorizeWith = (password: string): Promise<Response> => {
      return authorize(
        new Request(`${BASE}/api/oauth/authorize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: EMAIL, password, params }),
        }),
      );
    };
    expect((await authorizeWith('faux')).status).toBe(401);
    const granted = await authorizeWith(PASSWORD);
    expect(granted.status).toBe(200);
    const redirect = new URL(z.object({ redirectUrl: z.string() }).parse(await granted.json()).redirectUrl);
    expect(`${redirect.origin}${redirect.pathname}`).toBe(REDIRECT_URI);
    expect(redirect.searchParams.get('state')).toBe('etat-claude');

    // Échange du code, sans puis avec le secret du client.
    const exchange = {
      grant_type: 'authorization_code',
      code: redirect.searchParams.get('code') ?? '',
      code_verifier: pkce.verifier,
      redirect_uri: REDIRECT_URI,
      client_id: client.client_id,
    };
    expect((await token(form('/api/oauth/token', exchange))).status).toBe(401);
    const issued = await token(
      form('/api/oauth/token', { ...exchange, client_secret: client.client_secret }),
    );
    expect(issued.status).toBe(200);
    expect(issued.headers.get('cache-control')).toBe('no-store');
    const tokens = tokensSchema.parse(await issued.json());

    // Appels MCP avec le jeton obtenu.
    const initialized = await postMcp(tokens.access_token);
    expect(initialized.status).toBe(200);
    expect(await initialized.json()).toMatchObject({ result: { serverInfo: { name: 'ma-cave' } } });

    const mcp = await connectOverHttp(tokens.access_token);
    const cellars = await mcp.callTool({ name: 'list_cellars', arguments: {} });
    expect(JSON.stringify(cellars.content)).toContain(cellarId);
    await mcp.close();

    // Renouvellement : l'ancien jeton d'accès cesse de valoir.
    const refreshed = await token(
      form('/api/oauth/token', {
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        client_secret: client.client_secret,
      }),
    );
    const renewed = tokensSchema.parse(await refreshed.json());
    expect((await postMcp(tokens.access_token)).status).toBe(401);
    expect((await postMcp(renewed.access_token)).status).toBe(200);

    // Révocation par le client (en-tête Basic cette fois).
    const basic = Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64');
    const revoked = await revoke(
      new Request(`${BASE}/api/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
        body: new URLSearchParams({ token: renewed.refresh_token }).toString(),
      }),
    );
    expect(revoked.status).toBe(200);
    expect((await postMcp(renewed.access_token)).status).toBe(401);
  });

  it("refuse l'enregistrement d'une adresse de retour hors de Claude", async () => {
    const response = await register(
      new Request(`${BASE}/api/oauth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uris: ['https://evil.example.com/callback'] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_redirect_uri' });
  });

  it('répond 405 à GET : pas de flux SSE', () => {
    const response = mcpGet();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });
});
