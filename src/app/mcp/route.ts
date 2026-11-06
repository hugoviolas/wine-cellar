import { NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { db } from '@/db/client';
import { createCaveMcpServer } from '@/mcp/server';
import { getMcpPublicUrl } from '@/lib/mcpPublicUrl';
import { BodyTooLargeError, readBodyText } from '@/lib/readBodyText';
import { requireMcpUser } from '@/lib/requireMcpUser';
import type { JsonRpcErrorArgs } from './interfaces/json-rpc-error-args.interface';

/** Un appel de tool tient en quelques kilo-octets ; 1 Mo laisse une marge large. */
const MAX_BODY_BYTES = 1_000_000;

/**
 * Point d'entrée MCP (transport Streamable HTTP), sans session : chaque
 * POST crée un serveur, traite le message JSON-RPC et répond en JSON. Rien
 * n'est gardé en mémoire d'une requête à l'autre, ce qui convient à un
 * conteneur unique qui redémarre à chaque déploiement.
 */
export const POST = async (request: Request): Promise<Response> => {
  const publicUrl = getMcpPublicUrl();
  if (!publicUrl) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const auth = await requireMcpUser({ request, publicUrl });
  if ('error' in auth) {
    return auth.error;
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(await readBodyText({ request, maxBytes: MAX_BODY_BYTES }));
  } catch (error: unknown) {
    if (error instanceof BodyTooLargeError) {
      return jsonRpcError({ status: 413, code: -32600, message: 'Request body too large.' });
    }
    return jsonRpcError({ status: 400, code: -32700, message: 'Parse error.' });
  }

  const server = createCaveMcpServer({ db, user: auth.user });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, { parsedBody });
  } finally {
    await server.close();
  }
};

/**
 * Pas de flux SSE (GET) ni de session à fermer (DELETE) : la spécification
 * prévoit un 405 pour un serveur qui n'en propose pas.
 */
const methodNotAllowed = (): Response => {
  return jsonRpcError({ status: 405, code: -32000, message: 'Method not allowed.', allow: 'POST' });
};

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;

const jsonRpcError = ({ status, code, message, allow }: JsonRpcErrorArgs): Response => {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code, message }, id: null },
    { status, headers: allow === undefined ? {} : { Allow: allow } },
  );
};
