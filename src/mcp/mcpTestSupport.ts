import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Db } from '@/db/client';
import { cellarMemberships, cellars, users } from '@/db/schema';
import { newId } from '@/db/id';
import { createCaveMcpServer } from './server';
import type { ToolContext } from './interfaces/tool-context.interface';
import type { TestMember } from './interfaces/test-member.interface';
import type { ToolCallResult } from './interfaces/tool-call-result.interface';
import type { CallToolArgs } from './interfaces/call-tool-args.interface';

/**
 * Outils de test des tools MCP. Réservés aux tests, comme db/testRows.ts :
 * rien ici ne doit être importé par du code applicatif.
 */

/**
 * Compte et cave créés directement en base, sans bcrypt : ces tests
 * portent sur les tools, pas sur la connexion.
 */
export const createTestMember = async (db: Db, email: string): Promise<TestMember> => {
  const now = new Date().toISOString();
  const userId = newId();
  const cellarId = newId();
  await db.insert(users).values({ id: userId, email, passwordHash: 'non-utilisé', createdAt: now });
  await db
    .insert(cellars)
    .values({ id: cellarId, name: `Cave de ${email}`, ownerId: userId, createdAt: now });
  await db.insert(cellarMemberships).values({ id: newId(), cellarId, userId, role: 'owner', createdAt: now });
  return { user: { id: userId, email, isSuperAdmin: false }, cellarId };
};

/** Client MCP relié en mémoire à un serveur ouvert au nom de `context.user`. */
export const connectTestClient = async (context: ToolContext): Promise<Client> => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createCaveMcpServer(context).connect(serverTransport);
  const client = new Client({ name: 'ma-cave-tests', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
};

export const callTool = async ({ client, name, args = {} }: CallToolArgs): Promise<ToolCallResult> => {
  const result = await client.callTool({ name, arguments: args });
  const first: unknown = Array.isArray(result.content) ? result.content[0] : undefined;
  const text =
    typeof first === 'object' && first !== null && 'text' in first && typeof first.text === 'string'
      ? first.text
      : '';
  return { isError: result.isError === true, text };
};

/** Appel qui doit réussir ; renvoie le JSON de la réponse. */
export const callToolJson = async (args: CallToolArgs): Promise<unknown> => {
  const result = await callTool(args);
  if (result.isError) {
    throw new Error(`Le tool ${args.name} a échoué : ${result.text}`);
  }
  return JSON.parse(result.text);
};
